/**
 * Catalogue d'avatars : bases + accessoires combinables.
 * Ce sont des identifiants stables, pas des chemins de fichiers — l'app mobile
 * fait la correspondance vers ses propres assets. Les visuels definitifs
 * peuvent donc arriver plus tard sans migration ni changement d'API.
 */
export const AVATAR_BASES = ["renard", "chouette", "blaireau", "heron", "loutre", "corbeau"] as const;
export const AVATAR_SKINS = ["sable", "roux", "ardoise", "creme", "encre"] as const;
export const AVATAR_BACKGROUNDS = ["menthe", "abricot", "lilas", "azur", "brique", "olive"] as const;
export const AVATAR_ACCESSORIES = [
  "lunettes",
  "moustache",
  "chapeau",
  "noeud-papillon",
  "boucle-oreille",
  "cicatrice",
  "casquette",
  "monocle",
] as const;

export const MAX_ACCESSORIES = 3;

export type AvatarBase = (typeof AVATAR_BASES)[number];

export const AVATAR_CATALOG = {
  bases: AVATAR_BASES,
  skins: AVATAR_SKINS,
  backgrounds: AVATAR_BACKGROUNDS,
  accessories: AVATAR_ACCESSORIES,
  maxAccessories: MAX_ACCESSORIES,
};

export function randomAvatarConfig() {
  const pick = <T>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]!;
  return {
    base: pick(AVATAR_BASES),
    skin: pick(AVATAR_SKINS),
    background: pick(AVATAR_BACKGROUNDS),
    accessories: Math.random() < 0.6 ? [pick(AVATAR_ACCESSORIES)] : [],
  };
}
