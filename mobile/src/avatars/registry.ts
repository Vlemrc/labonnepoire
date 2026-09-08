import type { ImageSourcePropType } from "react-native";
import { AVATAR_IDS, DEFAULT_AVATAR, type AvatarId } from "@poire/shared";

/**
 * Correspondance identifiant -> image.
 *
 * Metro exige des `require` statiques : impossible de construire le chemin a la
 * volee depuis l'identifiant. Ajouter un avatar demande donc trois gestes : le
 * PNG dans assets/avatars, son id dans AVATAR_IDS (paquet partage), et une ligne
 * ici. Le backend, lui, n'a rien a savoir.
 */
const SOURCES: Record<AvatarId, ImageSourcePropType> = {
  alien: require("../../assets/avatars/alien.png"),
  cloud: require("../../assets/avatars/cloud.png"),
  freezer: require("../../assets/avatars/freezer.png"),
  ghost: require("../../assets/avatars/ghost.png"),
  labubu: require("../../assets/avatars/labubu.png"),
  peach: require("../../assets/avatars/peach.png"),
  "t-rex": require("../../assets/avatars/t-rex.png"),
  zombie: require("../../assets/avatars/zombie.png"),
};

export const AVATAR_LABELS: Record<AvatarId, string> = {
  alien: "Alien",
  cloud: "Nuage",
  freezer: "Freezer",
  ghost: "Fantome",
  labubu: "Labubu",
  peach: "Peche",
  "t-rex": "T-Rex",
  zombie: "Zombie",
};

/** Un identifiant inconnu (avatar retire du catalogue) ne doit pas casser l'ecran. */
export function avatarSource(avatar: string): ImageSourcePropType {
  return SOURCES[avatar as AvatarId] ?? SOURCES[DEFAULT_AVATAR];
}

export { AVATAR_IDS, DEFAULT_AVATAR };
export type { AvatarId };
