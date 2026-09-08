import { z } from "zod";
import {
  DEFAULT_ROUND_DURATION_HOURS,
  DEFAULT_STAKE_BUDGET,
  DEFAULT_STARTING_POINTS,
  GROUP_CODE_LENGTH,
} from "@poire/shared";

export const groupSettingsSchema = z.object({
  startingPoints: z.number().int().min(5).max(200).default(DEFAULT_STARTING_POINTS),
  stakeBudget: z.number().int().min(1).max(50).default(DEFAULT_STAKE_BUDGET),
  themes: z.array(z.string().min(1)).min(1, "Choisis au moins une thematique."),
  allowNoneOption: z.boolean().default(true),
  twistsEnabled: z.boolean().default(true),
  roundDurationHours: z.number().int().min(1).max(168).default(DEFAULT_ROUND_DURATION_HOURS),
});

export const createGroupSchema = groupSettingsSchema.partial().extend({
  name: z.string().trim().min(2).max(40),
  themes: z.array(z.string().min(1)).min(1),
});

export const joinGroupSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .length(GROUP_CODE_LENGTH, `Le code fait ${GROUP_CODE_LENGTH} caracteres.`),
});

export const updateSettingsSchema = groupSettingsSchema.partial();
