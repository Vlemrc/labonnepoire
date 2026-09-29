import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { resolveAbandonedRound } from "../../game/scoring.js";
import { evaluateSessionOutcome, isAbandonedInWriting } from "../../game/stateMachine.js";
import { eliminationUpdate, loadRound, resolveRoundAndScore } from "./service.js";

export interface SweepResult {
  /** Rounds dont la deadline de mise est passee : resolus avec forfait. */
  resolved: string[];
  /** Rounds dont le bluffeur n'a pas ecrit a temps : annules avec penalite. */
  cancelled: string[];
  failed: { roundId: string; reason: string }[];
}

/**
 * Fait avancer les rounds dont la deadline est passee, SANS qu'un joueur ait
 * a le demander.
 *
 * C'est le filet de securite du mode asynchrone. La deadline n'etait jusqu'ici
 * qu'une permission — `canResolve` autorisait la resolution, mais rien ne la
 * declenchait. Il suffisait donc d'un joueur qui laisse tomber pour figer une
 * partie definitivement : en phase de mises, plus personne ne validait ; en
 * phase d'ecriture, c'etait pire, aucune sortie n'existait puisqu'un round sans
 * reponses ne peut pas etre resolu.
 *
 * Appelable sur toute la base (cron) ou restreinte a une partie / un round
 * (balayage paresseux a la lecture).
 */
export async function sweepExpiredRounds(
  scope: { sessionId?: string; roundId?: string } = {},
  now: Date = new Date(),
): Promise<SweepResult> {
  const where: Prisma.RoundWhereInput = {
    status: { in: ["WRITING", "BETTING"] },
    deadlineAt: { lte: now },
    session: { status: "IN_PROGRESS" },
    ...(scope.sessionId ? { sessionId: scope.sessionId } : {}),
    ...(scope.roundId ? { id: scope.roundId } : {}),
  };

  const expired = await prisma.round.findMany({ where, select: { id: true, status: true } });
  const result: SweepResult = { resolved: [], cancelled: [], failed: [] };

  for (const round of expired) {
    try {
      if (round.status === "WRITING") {
        await cancelAbandonedRound(round.id, now);
        result.cancelled.push(round.id);
      } else {
        await resolveRoundAndScore(round.id);
        result.resolved.push(round.id);
      }
    } catch (error) {
      // Un round en echec ne doit pas empecher les autres d'avancer : le cron
      // passe sur toutes les parties de la base.
      result.failed.push({
        roundId: round.id,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return result;
}

/**
 * Part du capital que perd un joueur qui n'ecrit pas ses mensonges a temps.
 * Sa carte bloque toute la manche : les autres ne peuvent pas avancer.
 */
const ABANDON_RATIO = 0.25;

/**
 * Annule une carte dont le proprietaire n'a jamais ecrit, et lui prend une
 * penalite repartie entre les joueurs qui ont attendu pour rien. La carte reste
 * brulee pour le salon — il en a vu la reponse.
 */
export async function cancelAbandonedRound(roundId: string, now: Date = new Date()) {
  const round = await loadRound(roundId);
  const snapshot = {
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
  if (!isAbandonedInWriting(snapshot, now)) return round;

  const bettorIds = round.participants
    .filter((p) => p.role === "BETTOR")
    .map((p) => p.userId);

  // Le bluffeur absent ne mise rien : sa penalite s'indexe sur son capital.
  const bluffeurPoints =
    round.session.players.find((p) => p.userId === round.bluffeurId)?.points ?? 0;
  const outcome = resolveAbandonedRound({
    bluffeurId: round.bluffeurId,
    bettorIds,
    penalty: Math.max(1, Math.round(bluffeurPoints * ABANDON_RATIO)),
    players: round.session.players.map((p) => ({ userId: p.userId, points: p.points })),
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
        data: { points: after, ...eliminationUpdate(player.isEliminated, after, now, round) },
      });
    }
    await tx.round.update({
      where: { id: roundId },
      data: {
        status: "CANCELLED",
        resolvedAt: now,
        result: {
          reason: "BLUFFEUR_TIMEOUT",
          deltas: outcome.deltas,
          pointsAfter: outcome.pointsAfter,
        },
      },
    });
    if (sessionOutcome.isFinished) {
      await tx.gameSession.update({
        where: { id: round.sessionId },
        data: { status: "FINISHED", finishedAt: now, winnerId: sessionOutcome.winnerId },
      });
    }
  });

  // Une carte annulee ne doit pas figer la manche : la suivante prend le relais.
  if (!sessionOutcome.isFinished) {
    const { openNextCardIfReady } = await import("./service.js");
    await openNextCardIfReady(round.sessionId, round.manche);
  }

  return loadRound(roundId);
}
