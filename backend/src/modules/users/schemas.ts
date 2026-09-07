import { z } from "zod";
import {
  AVATAR_ACCESSORIES,
  AVATAR_BACKGROUNDS,
  AVATAR_BASES,
  AVATAR_SKINS,
  MAX_ACCESSORIES,
} from "./avatars.js";

export const avatarConfigSchema = z.object({
  base: z.enum(AVATAR_BASES),
  skin: z.enum(AVATAR_SKINS),
  background: z.enum(AVATAR_BACKGROUNDS),
  accessories: z.array(z.enum(AVATAR_ACCESSORIES)).max(MAX_ACCESSORIES).default([]),
});

export const pseudoSchema = z
  .string()
  .trim()
  .min(2, "Le pseudo fait au moins 2 caracteres.")
  .max(20, "Le pseudo fait au plus 20 caracteres.");

export const updateMeSchema = z.object({
  pseudo: pseudoSchema.optional(),
  avatarConfig: avatarConfigSchema.optional(),
  email: z.string().email().optional().nullable(),
});
