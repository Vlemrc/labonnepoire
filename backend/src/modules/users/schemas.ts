import { z } from "zod";
import { AVATAR_IDS } from "@poire/shared";

export const avatarSchema = z.enum(AVATAR_IDS);

export const pseudoSchema = z
  .string()
  .trim()
  .min(2, "Le pseudo fait au moins 2 caracteres.")
  .max(20, "Le pseudo fait au plus 20 caracteres.");

export const updateMeSchema = z.object({
  pseudo: pseudoSchema.optional(),
  avatar: avatarSchema.optional(),
  email: z.string().email().optional().nullable(),
});
