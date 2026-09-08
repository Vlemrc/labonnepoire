import { Router } from "express";
import { requireAuth, currentUser } from "../../middleware/auth.js";
import { assertSessionPlayer, loadSession, quitSession } from "./service.js";
import { toSessionView } from "./serializers.js";
import { createNextRound } from "../rounds/service.js";
import { sweepExpiredRounds } from "../rounds/sweep.js";
import { toRoundView } from "../rounds/serializers.js";

export const sessionsRouter = Router();
sessionsRouter.use(requireAuth);

/** Etat complet de la partie : c'est l'endpoint que l'app interroge en boucle. */
sessionsRouter.get("/:sessionId", async (req, res) => {
  const userId = currentUser(req).id;
  await assertSessionPlayer(req.params.sessionId, userId);
  // Ouvrir la partie suffit a debloquer un round expire : personne n'a a
  // reclamer la resolution, et l'ecran affiche deja l'etat a jour.
  await sweepExpiredRounds({ sessionId: req.params.sessionId });
  res.json({ session: toSessionView(await loadSession(req.params.sessionId), userId) });
});

sessionsRouter.post("/:sessionId/rounds", async (req, res) => {
  const userId = currentUser(req).id;
  await assertSessionPlayer(req.params.sessionId, userId);
  const round = await createNextRound(req.params.sessionId, userId);
  res.status(201).json({ round: toRoundView(round, userId) });
});

sessionsRouter.post("/:sessionId/quit", async (req, res) => {
  const userId = currentUser(req).id;
  await assertSessionPlayer(req.params.sessionId, userId);
  const session = await quitSession(req.params.sessionId, userId);
  res.json({ session: toSessionView(session, userId) });
});
