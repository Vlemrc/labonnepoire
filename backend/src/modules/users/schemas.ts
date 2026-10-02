import { z } from "zod";
import { AVATAR_IDS, PSEUDO_MAX_LENGTH, PSEUDO_MIN_LENGTH } from "@poire/shared";

export const avatarSchema = z.enum(AVATAR_IDS);

export const pseudoSchema = z
  .string()
  .trim()
  .min(PSEUDO_MIN_LENGTH, `Le pseudo fait au moins ${PSEUDO_MIN_LENGTH} caractères.`)
  .max(PSEUDO_MAX_LENGTH, `Le pseudo fait au plus ${PSEUDO_MAX_LENGTH} caractères.`);

export const updateMeSchema = z.object({
  pseudo: pseudoSchema.optional(),
  avatar: avatarSchema.optional(),
  email: z.string().email().optional().nullable(),
});
