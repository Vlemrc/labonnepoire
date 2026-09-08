import { MAX_PLAYERS_PER_GROUP } from "@poire/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { generateGroupCode } from "../../lib/ids.js";
import { GameRuleError } from "../../game/errors.js";
import { HttpError } from "../../middleware/error.js";

const groupInclude = {
  members: { include: { user: true }, orderBy: { joinedAt: "asc" } },
  sessions: {
    where: { status: { in: ["LOBBY", "IN_PROGRESS"] } },
    orderBy: { createdAt: "desc" },
    take: 1,
  },
} satisfies Prisma.GroupInclude;

export type GroupWithMembers = Awaited<ReturnType<typeof loadGroup>>;

export async function loadGroup(groupId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId }, include: groupInclude });
  if (!group) throw new HttpError(404, "GROUP_NOT_FOUND", "Salon introuvable.");
  return group;
}

export async function assertMember(groupId: string, userId: string) {
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!membership) throw new HttpError(403, "NOT_A_MEMBER", "Tu n'es pas membre de ce salon.");
  return membership;
}

async function assertThemesExist(themes: string[]) {
  const known = await prisma.card.findMany({ distinct: ["theme"], select: { theme: true } });
  const knownSet = new Set(known.map((c) => c.theme));
  const unknown = themes.filter((t) => !knownSet.has(t));
  if (unknown.length > 0) {
    throw new HttpError(
      400,
      "UNKNOWN_THEME",
      `Thematique(s) inconnue(s) : ${unknown.join(", ")}.`,
    );
  }
}

export async function createGroup(
  ownerId: string,
  input: { name: string; themes: string[] } & Record<string, unknown>,
) {
  await assertThemesExist(input.themes);

  // Collision de code quasi impossible mais pas theoriquement exclue.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateGroupCode();
    const existing = await prisma.group.findUnique({ where: { code } });
    if (existing) continue;
    return prisma.group.create({
      data: {
        code,
        name: input.name,
        ownerId,
        themes: input.themes,
        ...(input.startingPoints !== undefined ? { startingPoints: input.startingPoints as number } : {}),
        ...(input.stakeBudget !== undefined ? { stakeBudget: input.stakeBudget as number } : {}),
        ...(input.allowNoneOption !== undefined ? { allowNoneOption: input.allowNoneOption as boolean } : {}),
        ...(input.twistsEnabled !== undefined ? { twistsEnabled: input.twistsEnabled as boolean } : {}),
        ...(input.roundDurationHours !== undefined
          ? { roundDurationHours: input.roundDurationHours as number }
          : {}),
        members: { create: { userId: ownerId } },
      },
      include: groupInclude,
    });
  }
  throw new HttpError(500, "CODE_GENERATION_FAILED", "Impossible de generer un code de salon.");
}

export async function joinGroup(code: string, userId: string) {
  const group = await prisma.group.findUnique({ where: { code }, include: groupInclude });
  if (!group) throw new HttpError(404, "GROUP_NOT_FOUND", "Aucun salon avec ce code.");

  if (group.members.some((m) => m.userId === userId)) return group;
  if (group.members.length >= MAX_PLAYERS_PER_GROUP) {
    throw new GameRuleError("GROUP_FULL", `Ce salon est complet (${MAX_PLAYERS_PER_GROUP} joueurs).`);
  }
  // Rejoindre en cours de partie n'ajoute pas au GameSession deja lance :
  // le nouveau membre jouera la partie suivante.
  await prisma.groupMember.create({ data: { groupId: group.id, userId } });
  return loadGroup(group.id);
}

export async function updateSettings(
  groupId: string,
  userId: string,
  patch: Record<string, unknown>,
) {
  const group = await loadGroup(groupId);
  if (group.ownerId !== userId) {
    throw new HttpError(403, "NOT_OWNER", "Seul le createur du salon peut changer les reglages.");
  }
  if (Array.isArray(patch.themes)) await assertThemesExist(patch.themes as string[]);

  const active = group.sessions[0];
  if (active?.status === "IN_PROGRESS") {
    throw new GameRuleError(
      "SESSION_IN_PROGRESS",
      "Impossible de changer les reglages pendant une partie.",
    );
  }
  await prisma.group.update({ where: { id: groupId }, data: patch });
  return loadGroup(groupId);
}

export async function listGroupsForUser(userId: string) {
  const memberships = await prisma.groupMember.findMany({
    where: { userId },
    include: { group: { include: groupInclude } },
    orderBy: { joinedAt: "desc" },
  });
  return memberships.map((m) => m.group);
}
