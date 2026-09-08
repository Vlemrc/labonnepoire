import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { GameRuleError } from "../../game/errors.js";
import { HttpError } from "../../middleware/error.js";
import { FULL_BLUFF_PROBABILITY, type RoundMode, type RoundSnapshot } from "../../game/types.js";
import {
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
    stakeBudget: round.stakeBudget,
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
  return resolveModifiers(round.twistCode, {
    bettorCount: round.participants.filter((p) => p.role === "BETTOR").length,
    baseStakeBudget: round.stakeBudget,
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
async function drawCard(groupId: string, themes: string[]) {
  const seen = await prisma.groupSeenCard.findMany({
    where: { groupId },
    select: { cardId: true },
  });
  const seenIds = seen.map((s) => s.cardId);

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
    throw new GameRuleError("NO_CARD_AVAILABLE", "Aucune carte pour ces thematiques.");
  }
  const [card] = await prisma.card.findMany({
    where,
    skip: Math.floor(Math.random() * count),
    take: 1,
  });
  return card!;
}

export async function createNextRound(sessionId: string, userId: string) {
  // Le joueur qui demande le round suivant est justement celui que bloque un
  // round expire : on le fait tomber avant de refuser pour ROUND_IN_PROGRESS.
  const { sweepExpiredRounds } = await import("./sweep.js");
  await sweepExpiredRounds({ sessionId });
  const session = await loadSession(sessionId);
  if (session.status !== "IN_PROGRESS") {
    throw new GameRuleError("SESSION_NOT_RUNNING", "Cette partie n'est pas en cours.");
  }
  if (!session.players.some((p) => p.userId === userId)) {
    throw new HttpError(403, "NOT_IN_SESSION", "Tu ne joues pas cette partie.");
  }
  const last = session.rounds[0] ?? null;
  if (last && (last.status === "WRITING" || last.status === "BETTING")) {
    throw new GameRuleError("ROUND_IN_PROGRESS", "Le round precedent n'est pas termine.");
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
    throw new GameRuleError("SESSION_FINISHED", "La partie est terminee.");
  }

  const bluffeur = nextBluffeur(snapshots, last?.bluffeurId ?? null);
  const active = session.players.filter((p) => !p.isEliminated);
  const bettors = active.filter((p) => p.userId !== bluffeur.userId);
  if (bettors.length === 0) {
    throw new GameRuleError("NO_BETTOR", "Il n'y a plus de parieur disponible.");
  }

  const group = session.group;
  const card = await drawCard(group.id, group.themes);
  // Mode tire au sort et cache : voir FULL_BLUFF_PROBABILITY.
  const mode: RoundMode =
    group.allowNoneOption && Math.random() < FULL_BLUFF_PROBABILITY ? "FULL_BLUFF" : "STANDARD";

  const round = await prisma.$transaction(async (tx) => {
    const created = await tx.round.create({
      data: {
        sessionId,
        number: session.currentRoundNumber + 1,
        cardId: card.id,
        bluffeurId: bluffeur.userId,
        mode,
        status: "WRITING",
        stakeBudget: group.stakeBudget,
        allowNoneOption: group.allowNoneOption,
        deadlineAt: addHours(new Date(), group.roundDurationHours),
        participants: {
          create: [
            { userId: bluffeur.userId, role: "BLUFFEUR", budget: 0 },
            ...bettors.map((b) => ({ userId: b.userId, role: "BETTOR" as const, budget: 0 })),
          ],
        },
      },
    });
    await tx.gameSession.update({
      where: { id: sessionId },
      data: { currentRoundNumber: created.number },
    });
    // Des que la carte est distribuee elle est brulee pour ce salon, meme si le
    // round est ensuite annule : le bluffeur a deja vu la reponse.
    await tx.groupSeenCard.upsert({
      where: { groupId_cardId: { groupId: group.id, cardId: card.id } },
      create: { groupId: group.id, cardId: card.id },
      update: {},
    });
    return created;
  });

  return loadRound(round.id);
}

export async function submitAnswers(roundId: string, userId: string, texts: string[]) {
  const round = await loadRound(roundId);
  assertCanSubmitAnswers(toSnapshot(round), userId);

  const fakes = validateFakeAnswers(texts, round.mode, round.card.trueAnswer);
  const entries: { text: string; isTrue: boolean; origin: "CARD" | "PLAYER"; authorId: string | null }[] =
    fakes.map((text) => ({ text, isTrue: false, origin: "PLAYER" as const, authorId: userId }));

  if (round.mode === "STANDARD") {
    entries.push({
      text: round.card.trueAnswer,
      isTrue: true,
      origin: "CARD",
      authorId: null,
    });
  }

  const positions = shufflePositions(entries.length);
  const modifiers = modifiersFor(round);
  const budgetFor = (points: number) =>
    Math.max(0, Math.min(Math.round(round.stakeBudget * modifiers.stakeBudgetMultiplier), points));

  await prisma.$transaction(async (tx) => {
    await tx.answer.createMany({
      data: entries.map((entry, i) => ({ ...entry, roundId, position: positions[i]! })),
    });
    await tx.roundParticipant.update({
      where: { roundId_userId: { roundId, userId } },
      data: { hasSubmitted: true },
    });
    // Le budget est fige ici, plafonne au capital de chaque parieur : personne
    // ne peut miser plus que ce qu'il possede.
    for (const participant of round.participants) {
      if (participant.role !== "BETTOR") continue;
      const player = round.session.players.find((p) => p.userId === participant.userId);
      await tx.roundParticipant.update({
        where: { id: participant.id },
        data: { budget: budgetFor(player?.points ?? 0) },
      });
    }
    await tx.round.update({
      where: { id: roundId },
      data: {
        status: "BETTING",
        writingEndedAt: new Date(),
        deadlineAt: addHours(new Date(), round.session.group.roundDurationHours),
      },
    });
  });

  return loadRound(roundId);
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
    throw new GameRuleError("TWISTS_DISABLED", "Les twists sont desactives sur ce salon.");
  }
  if (round.status !== "WRITING") {
    throw new GameRuleError(
      "TWIST_TOO_LATE",
      "Un twist s'active avant que le bluffeur ait valide ses reponses.",
    );
  }
  if (round.twistCode) {
    throw new GameRuleError("TWIST_ALREADY_ACTIVE", "Un twist est deja actif sur ce round.");
  }
  const player = round.session.players.find((p) => p.userId === userId);
  if (!player) throw new HttpError(403, "NOT_IN_SESSION", "Tu ne joues pas cette partie.");
  if (player.twistCardUsed) {
    throw new GameRuleError("TWIST_CARD_SPENT", "Tu as deja utilise ta carte twist.");
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
    throw new GameRuleError("ROUND_NOT_READY", "Tous les parieurs n'ont pas encore mise.");
  }

  const budgets: Record<string, number> = {};
  const forfeits: { bettorId: string; amount: number }[] = [];
  for (const p of round.participants) {
    if (p.role !== "BETTOR") continue;
    budgets[p.userId] = p.budget;
    if (!p.hasSubmitted && p.budget > 0) forfeits.push({ bettorId: p.userId, amount: p.budget });
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
