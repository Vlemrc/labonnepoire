import request from "supertest";
import type { Express } from "express";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { SEED_CARDS } from "../../prisma/seed/cards.js";
import { listTwists } from "../../src/game/twists/registry.js";

export const app: Express = createApp();

/** Base vierge + un jeu de cartes minimal, pour des tests deterministes. */
export async function resetDatabase() {
  await prisma.bet.deleteMany();
  await prisma.answer.deleteMany();
  await prisma.roundParticipant.deleteMany();
  await prisma.round.deleteMany();
  await prisma.sessionPlayer.deleteMany();
  await prisma.gameSession.deleteMany();
  await prisma.cardReport.deleteMany();
  await prisma.groupSeenCard.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.group.deleteMany();
  await prisma.user.deleteMany();
  await prisma.card.deleteMany();
  await prisma.twist.deleteMany();

  await prisma.card.createMany({ data: SEED_CARDS });
  await prisma.twist.createMany({
    data: listTwists().map((t) => ({
      code: t.code,
      label: t.label,
      description: t.description,
      isActive: true,
    })),
  });
}

export interface TestPlayer {
  token: string;
  id: string;
  pseudo: string;
}

export async function signUp(pseudo: string): Promise<TestPlayer> {
  const res = await request(app).post("/auth/session").send({ pseudo }).expect(201);
  return { token: res.body.token, id: res.body.user.id, pseudo };
}

export const as = (player: TestPlayer) => ({
  get: (url: string) => request(app).get(url).set("Authorization", `Bearer ${player.token}`),
  post: (url: string) => request(app).post(url).set("Authorization", `Bearer ${player.token}`),
  patch: (url: string) => request(app).patch(url).set("Authorization", `Bearer ${player.token}`),
});
