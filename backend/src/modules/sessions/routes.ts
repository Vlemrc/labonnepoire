import { Router } from "express";
import { requireAuth, currentUser } from "../../middleware/auth.js";
import { assertSessionPlayer, loadSession, quitSession } from "./service.js";
import { toSessionView } from "./serializers.js";
import { startManche } from "../rounds/service.js";
import { sweepExpiredRounds } from "../rounds/sweep.js";

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

/** Distribue une carte a chaque joueur et ouvre la phase d'ecriture. */
sessionsRouter.post("/:sessionId/manches", async (req, res) => {
  const userId = currentUser(req).id;
  await assertSessionPlayer(req.params.sessionId, userId);
  const session = await startManche(req.params.sessionId, userId);
  res.status(201).json({ session: toSessionView(session, userId) });
});

sessionsRouter.post("/:sessionId/quit", async (req, res) => {
  const userId = currentUser(req).id;
  await assertSessionPlayer(req.params.sessionId, userId);
  const session = await quitSession(req.params.sessionId, userId);
  res.json({ session: toSessionView(session, userId) });
});
