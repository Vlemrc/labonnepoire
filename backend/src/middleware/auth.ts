import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";
import { hashToken } from "../lib/ids.js";
import { HttpError } from "./error.js";

/** Auth par token porteur opaque. Remplacable par un magic link sans toucher aux routes. */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    return next(new HttpError(401, "UNAUTHENTICATED", "Token manquant."));
  }
  const user = await prisma.user.findUnique({
    where: { authTokenHash: hashToken(header.slice(7).trim()) },
  });
  if (!user) return next(new HttpError(401, "UNAUTHENTICATED", "Token invalide."));
  req.user = user;
  next();
};

/** A utiliser apres requireAuth : evite un `!` a chaque handler. */
export function currentUser(req: { user?: { id: string } }): { id: string } {
  if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "Authentification requise.");
  return req.user;
}
