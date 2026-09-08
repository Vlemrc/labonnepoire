import { Router } from "express";
import { timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";
import { HttpError } from "../../middleware/error.js";
import { sweepExpiredRounds } from "../rounds/sweep.js";

export const maintenanceRouter = Router();

function assertMaintenanceToken(provided: string | undefined) {
  const expected = env.MAINTENANCE_TOKEN;
  if (!expected) {
    throw new HttpError(
      503,
      "MAINTENANCE_DISABLED",
      "MAINTENANCE_TOKEN n'est pas configure : le balayage planifie est desactive.",
    );
  }
  const a = Buffer.from(provided ?? "");
  const b = Buffer.from(expected);
  // Comparaison a temps constant. Les longueurs sont verifiees avant, car
  // timingSafeEqual leve quand elles different.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new HttpError(401, "UNAUTHENTICATED", "Token de maintenance invalide.");
  }
}

/**
 * Fait avancer tous les rounds expires de la base. Destine a une tache planifiee
 * (cron Railway) ; c'est ce qui permettra d'envoyer une notification « le round
 * est resolu » a quelqu'un qui n'a pas ouvert l'app.
 */
maintenanceRouter.post("/sweep", async (req, res) => {
  assertMaintenanceToken(req.header("x-maintenance-token") ?? undefined);
  const result = await sweepExpiredRounds();
  res.json({
    resolved: result.resolved.length,
    cancelled: result.cancelled.length,
    failed: result.failed,
  });
});
