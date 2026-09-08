import { AVATAR_IDS, type AvatarId } from "@poire/shared";

/**
 * Le backend ne connait que des identifiants d'avatar et ignore totalement leur
 * apparence : les images vivent dans l'app. Ajouter un avatar ne demande donc
 * ni changement d'API ni migration.
 */
export { AVATAR_IDS };
export type { AvatarId };

export function randomAvatar(): AvatarId {
  return AVATAR_IDS[Math.floor(Math.random() * AVATAR_IDS.length)]!;
}
