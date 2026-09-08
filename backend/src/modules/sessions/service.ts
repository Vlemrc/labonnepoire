import { MIN_PLAYERS_PER_SESSION } from "@poire/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { GameRuleError } from "../../game/errors.js";
import { HttpError } from "../../middleware/error.js";

export const sessionInclude = {
  players: { include: { user: true }, orderBy: { turnOrder: "asc" } },
  group: true,
  rounds: {
    orderBy: { number: "desc" },
    take: 1,
    include: {
      card: true,
      bluffeur: true,
      twistActivatedBy: true,
      participants: { include: { user: true } },
      answers: { include: { author: true }, orderBy: { position: "asc" } },
      bets: { include: { bettor: true } },
    },
  },
} satisfies Prisma.GameSessionInclude;

export type SessionWithRelations = NonNullable<Awaited<ReturnType<typeof findSession>>>;

export function findSession(sessionId: string) {
  return prisma.gameSession.findUnique({ where: { id: sessionId }, include: sessionInclude });
}

export async function loadSession(sessionId: string) {
  const session = await findSession(sessionId);
  if (!session) throw new HttpError(404, "SESSION_NOT_FOUND", "Partie introuvable.");
  return session;
}

export async function assertSessionPlayer(sessionId: string, userId: string) {
  const player = await prisma.sessionPlayer.findUnique({
    where: { sessionId_userId: { sessionId, userId } },
  });
  if (!player) throw new HttpError(403, "NOT_IN_SESSION", "Tu ne joues pas cette partie.");
  return player;
}

/**
 * Lance une partie avec les membres presents dans le salon a cet instant.
 * L'ordre du tour est melange : sinon le createur du salon serait toujours
 * premier bluffeur, ce qui est un avantage systematique.
 */
export async function startSession(groupId: string, userId: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: true, sessions: { where: { status: { in: ["LOBBY", "IN_PROGRESS"] } } } },
  });
  if (!group) throw new HttpError(404, "GROUP_NOT_FOUND", "Salon introuvable.");
  if (group.ownerId !== userId) {
    throw new HttpError(403, "NOT_OWNER", "Seul le createur du salon peut lancer une partie.");
  }
  if (group.sessions.length > 0) {
    throw new GameRuleError("SESSION_ALREADY_RUNNING", "Une partie est deja en cours.");
  }
  if (group.members.length < MIN_PLAYERS_PER_SESSION) {
    throw new GameRuleError(
      "NOT_ENOUGH_PLAYERS",
      `Il faut au moins ${MIN_PLAYERS_PER_SESSION} joueurs.`,
    );
  }

  const order = group.members.map((m) => m.userId);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }

  const session = await prisma.gameSession.create({
    data: {
      groupId,
      status: "IN_PROGRESS",
      players: {
        create: order.map((memberId, index) => ({
          userId: memberId,
          points: group.startingPoints,
          turnOrder: index,
        })),
      },
    },
  });
  return loadSession(session.id);
}

/** Abandon : le joueur est elimine, ses points sortent du jeu avec lui. */
export async function quitSession(sessionId: string, userId: string) {
  const session = await loadSession(sessionId);
  if (session.status === "FINISHED") return session;
  await prisma.sessionPlayer.update({
    where: { sessionId_userId: { sessionId, userId } },
    data: { isEliminated: true, points: 0 },
  });

  const remaining = await prisma.sessionPlayer.findMany({
    where: { sessionId, isEliminated: false },
  });
  if (remaining.length <= 1) {
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        status: "FINISHED",
        finishedAt: new Date(),
        winnerId: remaining[0]?.userId ?? null,
      },
    });
    await prisma.round.updateMany({
      where: { sessionId, status: { in: ["WRITING", "BETTING"] } },
      data: { status: "CANCELLED" },
    });
  } else {
    // Un round en cours dont le bluffeur vient de partir n'est plus jouable.
    await prisma.round.updateMany({
      where: { sessionId, bluffeurId: userId, status: { in: ["WRITING", "BETTING"] } },
      data: { status: "CANCELLED" },
    });
    await prisma.roundParticipant.updateMany({
      where: { round: { sessionId, status: "BETTING" }, userId, hasSubmitted: false },
      data: { hasSubmitted: true, budget: 0 },
    });
  }
  return loadSession(sessionId);
}
