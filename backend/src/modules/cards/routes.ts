import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { listTwists } from "../../game/twists/registry.js";

export const cardsRouter = Router();

/** Thematiques disponibles, avec le nombre de cartes : utile a la creation d'un salon. */
cardsRouter.get("/themes", async (_req, res) => {
  const grouped = await prisma.card.groupBy({ by: ["theme"], _count: { _all: true } });
  res.json({
    themes: grouped
      .map((g) => ({ theme: g.theme, cardCount: g._count._all }))
      .sort((a, b) => a.theme.localeCompare(b.theme)),
  });
});

cardsRouter.get("/twists", async (_req, res) => {
  const rows = await prisma.twist.findMany({ where: { isActive: true } });
  const active = new Set(rows.map((r) => r.code));
  res.json({
    twists: listTwists()
      .filter((t) => active.size === 0 || active.has(t.code))
      .map((t) => ({ code: t.code, label: t.label, description: t.description })),
  });
});
