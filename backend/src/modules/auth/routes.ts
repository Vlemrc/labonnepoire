import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { generateAuthToken, hashToken } from "../../lib/ids.js";
import { requireAuth, currentUser } from "../../middleware/auth.js";
import { randomAvatar, AVATAR_IDS } from "../users/avatars.js";
import { avatarSchema, pseudoSchema, updateMeSchema } from "../users/schemas.js";
import { toPublicUser } from "../users/serializers.js";

export const authRouter = Router();

const createSessionSchema = z.object({
  pseudo: pseudoSchema,
  avatar: avatarSchema.optional(),
});

/**
 * Cree un compte invite et retourne son token.
 * Le token est genere ici et n'est jamais reaffiche : l'app le stocke dans
 * SecureStore. L'email reste optionnel, pour brancher un magic link plus tard.
 */
authRouter.post("/session", async (req, res) => {
  const body = createSessionSchema.parse(req.body);
  const token = generateAuthToken();
  const user = await prisma.user.create({
    data: {
      pseudo: body.pseudo,
      avatar: body.avatar ?? randomAvatar(),
      authTokenHash: hashToken(token),
    },
  });
  res.status(201).json({ token, user: toPublicUser(user) });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const me = await prisma.user.findUniqueOrThrow({ where: { id: currentUser(req).id } });
  res.json({ user: toPublicUser(me), email: me.email });
});

authRouter.patch("/me", requireAuth, async (req, res) => {
  const body = updateMeSchema.parse(req.body);
  const user = await prisma.user.update({
    where: { id: currentUser(req).id },
    data: {
      ...(body.pseudo !== undefined ? { pseudo: body.pseudo } : {}),
      ...(body.avatar !== undefined ? { avatar: body.avatar } : {}),
      ...(body.email !== undefined ? { email: body.email } : {}),
    },
  });
  res.json({ user: toPublicUser(user), email: user.email });
});

authRouter.get("/avatars", (_req, res) => {
  res.json({ avatars: AVATAR_IDS });
});
