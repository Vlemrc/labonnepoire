import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env, isProd } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { authRouter } from "./modules/auth/routes.js";
import { groupsRouter } from "./modules/groups/routes.js";
import { sessionsRouter } from "./modules/sessions/routes.js";
import { roundsRouter } from "./modules/rounds/routes.js";
import { cardsRouter } from "./modules/cards/routes.js";
import { maintenanceRouter } from "./modules/maintenance/routes.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(",") }));
  app.use(express.json({ limit: "128kb" }));
  // Express 5 laisse req.body a undefined quand la requete n'a pas de corps.
  // Les routes dont le corps est optionnel (activer un twist, resoudre un round)
  // recevraient alors un 400 de validation au lieu de s'executer.
  app.use((req, _res, next) => {
    if (req.body === undefined) req.body = {};
    next();
  });
  if (!isProd && env.NODE_ENV !== "test") app.use(morgan("dev"));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/auth", authRouter);
  app.use("/groups", groupsRouter);
  app.use("/sessions", sessionsRouter);
  app.use("/rounds", roundsRouter);
  app.use("/cards", cardsRouter);
  app.use("/maintenance", maintenanceRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
