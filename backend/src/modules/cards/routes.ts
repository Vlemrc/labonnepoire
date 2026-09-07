import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { listTwists } from "../../game/twists/registry.js";
import { requireAuth, currentUser } from "../../middleware/auth.js";
import { reportCard } from "./service.js";

export const cardsRouter = Router();

/** Thematiques jouables, avec leur nombre de cartes : utile a la creation d'un salon. */
cardsRouter.get("/themes", async (_req, res) => {
  const grouped = await prisma.card.groupBy({
    by: ["theme"],
    where: { status: { not: "REJECTED" } },
    _count: { _all: true },
  });
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

const reportSchema = z.object({ reason: z.string().trim().max(500).optional() });

/** Signaler une carte fausse ou ambigue. Reserve aux joueurs qui l'ont vue. */
cardsRouter.post<{ cardId: string }>("/:cardId/report", requireAuth, async (req, res) => {
  const { reason } = reportSchema.parse(req.body);
  const card = await reportCard(req.params.cardId, currentUser(req).id, reason);
  res.status(201).json({
    card: { id: card.id, status: card.status, reportCount: card.reportCount },
  });
});
