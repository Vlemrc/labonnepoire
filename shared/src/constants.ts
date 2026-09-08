/** Valeurs par defaut d'un salon. Surchargeables a la creation. */
export const DEFAULT_STARTING_POINTS = 20;
/** Nombre de jetons que le parieur repartit librement a chaque round. */
export const DEFAULT_STAKE_BUDGET = 10;
export const DEFAULT_ROUND_DURATION_HOURS = 24;

export const MIN_PLAYERS_PER_SESSION = 2;
export const MAX_PLAYERS_PER_GROUP = 8;

/** Nombre de fausses reponses attendues du bluffeur selon le mode. */
export const FAKE_ANSWERS_STANDARD = 2;
export const FAKE_ANSWERS_FULL_BLUFF = 3;
export const ANSWERS_PER_ROUND = 3;

export const GROUP_CODE_LENGTH = 6;

/**
 * Avatars disponibles. Ce sont des identifiants stables : le backend ne connait
 * que ces chaines et ignore totalement l'apparence. Ajouter un avatar = poser le
 * PNG dans mobile/assets/avatars, ajouter son id ici et une ligne dans le
 * registre de l'app. Aucune migration.
 */
export const AVATAR_IDS = [
  "alien",
  "cloud",
  "freezer",
  "ghost",
  "labubu",
  "peach",
  "t-rex",
  "zombie",
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

export const DEFAULT_AVATAR: AvatarId = "alien";
