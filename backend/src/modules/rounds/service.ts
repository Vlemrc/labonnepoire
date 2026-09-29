import { Prisma } from "@prisma/client";
import { FORFEIT_RATIO } from "@poire/shared";
import { prisma } from "../../lib/prisma.js";
import { GameRuleError } from "../../game/errors.js";
import { HttpError } from "../../middleware/error.js";
import { FULL_BLUFF_PROBABILITY, type RoundMode, type RoundSnapshot } from "../../game/types.js";
import {
  allCardsWritten,
  assertCanSubmitAnswers,
  assertCanSubmitBets,
  canResolve,
  evaluateSessionOutcome,
  nextBluffeur,
  shufflePositions,
  validateBetDistribution,
  validateFakeAnswers,
  type BetLine,
} from "../../game/stateMachine.js";
import { resolveRound as computeRound } from "../../game/scoring.js";
import { getTwist, listTwists, resolveModifiers } from "../../game/twists/registry.js";
import { pickRandom } from "../../lib/ids.js";
import { loadSession, sessionInclude } from "../sessions/service.js";

export const roundInclude = {
  card: true,
  bluffeur: true,
  twistActivatedBy: true,
  session: { include: { group: true, players: { include: { user: true } } } },
  participants: { include: { user: true } },
  answers: { include: { author: true }, orderBy: { position: "asc" } },
  bets: { include: { bettor: true } },
} satisfies Prisma.RoundInclude;

export type RoundWithRelations = NonNullable<Awaited<ReturnType<typeof findRound>>>;

export function findRound(roundId: string) {
  return prisma.round.findUnique({ where: { id: roundId }, include: roundInclude });
}

export async function loadRound(roundId: string) {
  const round = await findRound(roundId);
  if (!round) throw new HttpError(404, "ROUND_NOT_FOUND", "Round introuvable.");
  return round;
}

function toSnapshot(round: RoundWithRelations): RoundSnapshot {
  return {
    id: round.id,
    status: round.status,
    mode: round.mode,
    bluffeurId: round.bluffeurId,
    allowNoneOption: round.allowNoneOption,
    deadlineAt: round.deadlineAt,
    participants: round.participants.map((p) => ({
      userId: p.userId,
      role: p.role,
      hasSubmitted: p.hasSubmitted,
      budget: p.budget,
    })),
  };
}

function modifiersFor(round: RoundWithRelations) {
  const bluffeur = round.session.players.find((p) => p.userId === round.bluffeurId);
  return resolveModifiers(round.twistCode, {
    bettorCount: round.participants.filter((p) => p.role === "BETTOR").length,
    bluffeurPoints: bluffeur?.points ?? 0,
  });
}

/**
 * Tire une carte des thematiques du salon.
 *
 * L'exclusion porte sur le SALON, pas sur la partie : une carte deja servie a
 * ce groupe est brulee definitivement, parce que celui qui en a ete bluffeur
 * connait la reponse et que celui qui a parie s'en souvient. Une exclusion par
 * partie ferait repiocher dans le paquet complet des la deuxieme soiree.
 */
async function drawCard(groupId: string, themes: string[], alsoExclude: string[] = []) {
  const seen = await prisma.groupSeenCard.findMany({
    where: { groupId },
    select: { cardId: true },
  });
  // `alsoExclude` couvre les cartes deja tirees pour cette meme manche, qui ne
  // sont pas encore enregistrees en base au moment ou l'on tire les suivantes.
  const seenIds = [...seen.map((s) => s.cardId), ...alsoExclude];

  const playable: Prisma.CardWhereInput = {
    theme: { in: themes },
    status: { not: "REJECTED" },
  };
  let where: Prisma.CardWhereInput = {
    ...playable,
    ...(seenIds.length > 0 ? { id: { notIn: seenIds } } : {}),
  };
  let count = await prisma.card.count({ where });

  if (count === 0) {
    // Paquet epuise : on recycle plutot que de bloquer la partie en cours.
    where = playable;
    count = await prisma.card.count({ where });
  }
  if (count === 0) {
    throw new GameRuleError("NO_CARD_AVAILABLE", "Aucune carte pour ces thématiques.");
  }
  const [card] = await prisma.card.findMany({
    where,
    skip: Math.floor(Math.random() * count),
    take: 1,
  });
  return card!;
}

/**
 * Ouvre une manche : une carte par joueur actif, toutes en ecriture.
 *
 * Tout le monde ecrit ses mensonges en meme temps, puis les cartes se jouent
 * une par une. C'est ce qui rend le jeu tenable en asynchrone : deux temps
 * d'attente par manche au lieu de deux par joueur.
 */
export async function startManche(sessionId: string, userId: string) {
  const { sweepExpiredRounds } = await import("./sweep.js");
  await sweepExpiredRounds({ sessionId });
  const session = await loadSession(sessionId);

  if (session.status !== "IN_PROGRESS") {
    throw new GameRuleError("SESSION_NOT_RUNNING", "Cette partie n'est pas en cours.");
  }
  if (!session.players.some((p) => p.userId === userId)) {
    throw new HttpError(403, "NOT_IN_SESSION", "Tu ne joues pas cette partie.");
  }

  const pending = await prisma.round.count({
    where: { sessionId, status: { in: ["WRITING", "PENDING", "BETTING"] } },
  });
  if (pending > 0) {
    throw new GameRuleError("MANCHE_IN_PROGRESS", "La manche en cours n'est pas terminée.");
  }

  const snapshots = session.players.map((p) => ({
    userId: p.userId,
    points: p.points,
    isEliminated: p.isEliminated,
    turnOrder: p.turnOrder,
  }));
  const outcome = evaluateSessionOutcome(snapshots);
  if (outcome.isFinished) {
    await finishSession(sessionId, outcome.winnerId);
    throw new GameRuleError("SESSION_FINISHED", "La partie est terminée.");
  }

  const active = session.players
    .filter((p) => !p.isEliminated)
    .sort((a, b) => a.turnOrder - b.turnOrder);
  if (active.length < 2) {
    throw new GameRuleError("NOT_ENOUGH_PLAYERS", "Il faut au moins deux joueurs actifs.");
  }

  const group = session.group;
  const manche = (await prisma.round.aggregate({
    where: { sessionId },
    _max: { manche: true },
  }))._max.manche;
  const nextManche = (manche ?? 0) + 1;
  const deadline = addHours(new Date(), group.roundDurationHours);

  // Une carte differente par joueur, tirees d'avance : drawCard exclut les
  // cartes deja vues par le salon, donc l'appeler en boucle evite les doublons
  // seulement si chaque tirage est enregistre au fur et a mesure.
  const rounds: { userId: string; cardId: string; mode: RoundMode; number: number }[] = [];
  for (const [index, player] of active.entries()) {
    const card = await drawCard(group.id, group.themes, rounds.map((r) => r.cardId));
    rounds.push({
      userId: player.userId,
      cardId: card.id,
      mode:
        group.allowNoneOption && Math.random() < FULL_BLUFF_PROBABILITY
          ? "FULL_BLUFF"
          : "STANDARD",
      number: index + 1,
    });
  }

  await prisma.$transaction(async (tx) => {
    for (const r of rounds) {
      await tx.round.create({
        data: {
          sessionId,
          manche: nextManche,
          number: r.number,
          cardId: r.cardId,
          bluffeurId: r.userId,
          mode: r.mode,
          status: "WRITING",
          allowNoneOption: group.allowNoneOption,
          deadlineAt: deadline,
          participants: {
            create: active.map((p) => ({
              userId: p.userId,
              role: p.userId === r.userId ? ("BLUFFEUR" as const) : ("BETTOR" as const),
              budget: 0,
            })),
          },
        },
      });
      await tx.groupSeenCard.upsert({
        where: { groupId_cardId: { groupId: group.id, cardId: r.cardId } },
        create: { groupId: group.id, cardId: r.cardId },
        update: {},
      });
    }
    await tx.gameSession.update({
      where: { id: sessionId },
      data: { currentRoundNumber: nextManche },
    });
  });

  return loadSession(sessionId);
}

export async function submitAnswers(roundId: string, userId: string, texts: string[]) {
  const round = await loadRound(roundId);
  assertCanSubmitAnswers(toSnapshot(round), userId);

  const fakes = validateFakeAnswers(texts, round.mode, round.card.trueAnswer);
  const entries: { text: string; isTrue: boolean; origin: "CARD" | "PLAYER"; authorId: string | null }[] =
    fakes.map((text) => ({ text, isTrue: false, origin: "PLAYER" as const, authorId: userId }));

  if (round.mode === "STANDARD") {
    entries.push({ text: round.card.trueAnswer, isTrue: true, origin: "CARD", authorId: null });
  }

  const positions = shufflePositions(entries.length);

  await prisma.$transaction(async (tx) => {
    await tx.answer.createMany({
      data: entries.map((entry, i) => ({ ...entry, roundId, position: positions[i]! })),
    });
    await tx.roundParticipant.update({
      where: { roundId_userId: { roundId, userId } },
      data: { hasSubmitted: true },
    });
    // La carte attend son tour : elle ne s'ouvre aux mises que lorsque tous les
    // joueurs de la manche ont ecrit.
    await tx.round.update({
      where: { id: roundId },
      data: { status: "PENDING", writingEndedAt: new Date() },
    });
  });

  await openNextCardIfReady(round.sessionId, round.manche);
  return loadRound(roundId);
}

/**
 * Ouvre la carte suivante aux mises, si c'est le moment.
 *
 * Deux conditions : plus personne n'ecrit dans cette manche, et aucune carte
 * n'est deja en cours. Le budget de chaque parieur est fige ici — c'est la
 * totalite de son capital a cet instant, et il devra l'engager entierement.
 */
export async function openNextCardIfReady(sessionId: string, manche: number) {
  const rounds = await prisma.round.findMany({
    where: { sessionId, manche },
    orderBy: { number: "asc" },
    select: { id: true, status: true },
  });
  if (rounds.length === 0) return;
  if (!allCardsWritten(rounds.map((r) => r.status))) return;
  if (rounds.some((r) => r.status === "BETTING")) return;

  const next = rounds.find((r) => r.status === "PENDING");
  if (!next) return;

  const round = await loadRound(next.id);
  const group = round.session.group;

  await prisma.$transaction(async (tx) => {
    for (const participant of round.participants) {
      if (participant.role !== "BETTOR") continue;
      const player = round.session.players.find((p) => p.userId === participant.userId);
      await tx.roundParticipant.update({
        where: { id: participant.id },
        // Le capital entier : on avance de carte en carte avec ce qu'il reste.
        data: { budget: Math.max(0, player?.points ?? 0) },
      });
    }
    await tx.round.update({
      where: { id: next.id },
      data: {
        status: "BETTING",
        deadlineAt: addHours(new Date(), group.roundDurationHours),
      },
    });
  });
}

export async function submitBets(roundId: string, userId: string, lines: BetLine[]) {
  const round = await loadRound(roundId);
  const snapshot = toSnapshot(round);
  assertCanSubmitBets(snapshot, userId);

  const me = round.participants.find((p) => p.userId === userId)!;
  const answerIds = round.answers.map((a) => a.id);
  const accepted = validateBetDistribution(lines, me.budget, answerIds, {
    allowNoneOption: round.allowNoneOption,
    modifiers: modifiersFor(round),
  });

  await prisma.$transaction(async (tx) => {
    await tx.bet.deleteMany({ where: { roundId, bettorId: userId } });
    await tx.bet.createMany({
      data: accepted.map((line) => ({
        roundId,
        bettorId: userId,
        answerId: line.isNoneOption ? null : line.answerId,
        isNoneOption: line.isNoneOption,
        amount: line.amount,
      })),
    });
    await tx.roundParticipant.update({ where: { id: me.id }, data: { hasSubmitted: true } });
  });

  const updated = await loadRound(roundId);
  // Toutes les mises sont secretes jusqu'ici : la resolution ne part que
  // lorsque le dernier parieur a valide, donc personne ne voit les autres.
  if (canResolve(toSnapshot(updated), new Date())) {
    return resolveRoundAndScore(roundId);
  }
  return updated;
}

export async function activateTwist(roundId: string, userId: string, code?: string) {
  const round = await loadRound(roundId);
  if (!round.session.group.twistsEnabled) {
    throw new GameRuleError("TWISTS_DISABLED", "Les twists sont désactivés sur ce salon.");
  }
  if (round.status !== "WRITING") {
    throw new GameRuleError(
      "TWIST_TOO_LATE",
      "Un twist s'active avant que le bluffeur ait validé ses réponses.",
    );
  }
  if (round.twistCode) {
    throw new GameRuleError("TWIST_ALREADY_ACTIVE", "Un twist est déjà actif sur ce round.");
  }
  const player = round.session.players.find((p) => p.userId === userId);
  if (!player) throw new HttpError(403, "NOT_IN_SESSION", "Tu ne joues pas cette partie.");
  if (player.twistCardUsed) {
    throw new GameRuleError("TWIST_CARD_SPENT", "Tu as déjà utilisé ta carte twist.");
  }

  const available = (await prisma.twist.findMany({ where: { isActive: true } }))
    .map((t) => t.code)
    .filter((c) => getTwist(c) !== null);
  const pool = available.length > 0 ? available : listTwists().map((t) => t.code);
  const chosen = code && pool.includes(code) ? code : pickRandom(pool);

  await prisma.$transaction([
    prisma.round.update({
      where: { id: roundId },
      data: { twistCode: chosen, twistActivatedById: userId },
    }),
    prisma.sessionPlayer.update({
      where: { sessionId_userId: { sessionId: round.sessionId, userId } },
      data: { twistCardUsed: true },
    }),
  ]);
  return loadRound(roundId);
}

/**
 * Resout le round : calcule les deltas, met a jour les capitaux et termine la
 * partie s'il ne reste qu'un joueur. Idempotent par le garde-fou sur le statut.
 */
export async function resolveRoundAndScore(roundId: string) {
  const round = await loadRound(roundId);
  if (round.status === "RESOLVED") return round;
  if (round.status !== "BETTING") {
    throw new GameRuleError("ROUND_NOT_BETTING", "Ce round n'est pas en phase de mises.");
  }
  if (!canResolve(toSnapshot(round), new Date())) {
    throw new GameRuleError("ROUND_NOT_READY", "Tous les parieurs n'ont pas encore misé.");
  }

  const budgets: Record<string, number> = {};
  const forfeits: { bettorId: string; amount: number }[] = [];
  for (const p of round.participants) {
    if (p.role !== "BETTOR") continue;
    budgets[p.userId] = p.budget;
    if (!p.hasSubmitted && p.budget > 0) {
      // Pas tout son capital : il mise normalement l'integralite de ce qu'il a,
      // le lui prendre en entier l'eliminerait pour une notification ratee.
      forfeits.push({
        bettorId: p.userId,
        amount: Math.max(1, Math.round(p.budget * FORFEIT_RATIO)),
      });
    }
  }

  const outcome = computeRound({
    bluffeurId: round.bluffeurId,
    mode: round.mode,
    answers: round.answers.map((a) => ({ id: a.id, isTrue: a.isTrue, authorId: a.authorId })),
    bets: round.bets.map((b) => ({
      bettorId: b.bettorId,
      answerId: b.answerId,
      isNoneOption: b.isNoneOption,
      amount: b.amount,
    })),
    players: round.session.players.map((p) => ({ userId: p.userId, points: p.points })),
    budgets,
    forfeits,
    modifiers: modifiersFor(round),
  });

  const sessionOutcome = evaluateSessionOutcome(
    round.session.players.map((p) => ({
      userId: p.userId,
      points: outcome.pointsAfter[p.userId] ?? p.points,
      isEliminated: p.isEliminated,
      turnOrder: p.turnOrder,
    })),
  );

  await prisma.$transaction(async (tx) => {
    for (const player of round.session.players) {
      const after = outcome.pointsAfter[player.userId] ?? player.points;
      await tx.sessionPlayer.update({
        where: { id: player.id },
        data: { points: after, isEliminated: player.isEliminated || after <= 0 },
      });
    }
    await tx.round.update({
      where: { id: roundId },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        result: { deltas: outcome.deltas, pointsAfter: outcome.pointsAfter },
      },
    });
    if (sessionOutcome.isFinished) {
      await tx.gameSession.update({
        where: { id: round.sessionId },
        data: { status: "FINISHED", finishedAt: new Date(), winnerId: sessionOutcome.winnerId },
      });
    }
  });

  // La carte suivante de la manche s'ouvre dans la foulee. Quand il n'en reste
  // aucune, la manche est close et il faudra en relancer une.
  if (!sessionOutcome.isFinished) {
    await openNextCardIfReady(round.sessionId, round.manche);
  }

  return loadRound(roundId);
}

async function finishSession(sessionId: string, winnerId: string | null) {
  await prisma.gameSession.update({
    where: { id: sessionId },
    data: { status: "FINISHED", finishedAt: new Date(), winnerId },
  });
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3_600_000);
}

export { sessionInclude };
