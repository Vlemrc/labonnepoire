/**
 * Rendu provisoire des avatars.
 *
 * Le backend ne manipule que des identifiants (« renard », « lunettes »…) et
 * ignore totalement l'apparence. Cette table est le seul endroit a remplacer le
 * jour ou les vrais assets arrivent : aucun changement d'API, aucune migration.
 */
export const AVATAR_EMOJI: Record<string, string> = {
  renard: "🦊",
  chouette: "🦉",
  blaireau: "🦡",
  heron: "🐦",
  loutre: "🦦",
  corbeau: "🐦‍⬛",
};

export const BACKGROUND_COLOR: Record<string, string> = {
  menthe: "#2E6F5E",
  abricot: "#A6613A",
  lilas: "#5C4A86",
  azur: "#33608C",
  brique: "#8C3F3F",
  olive: "#5F6B33",
};

export const ACCESSORY_EMOJI: Record<string, string> = {
  lunettes: "👓",
  moustache: "👨",
  chapeau: "🎩",
  "noeud-papillon": "🎀",
  "boucle-oreille": "💎",
  cicatrice: "⚡",
  casquette: "🧢",
  monocle: "🧐",
};

export const AVATAR_BASES = Object.keys(AVATAR_EMOJI);
export const AVATAR_BACKGROUNDS = Object.keys(BACKGROUND_COLOR);
export const AVATAR_ACCESSORIES = Object.keys(ACCESSORY_EMOJI);
export const AVATAR_SKINS = ["sable", "roux", "ardoise", "creme", "encre"];

export function emojiFor(base: string): string {
  return AVATAR_EMOJI[base] ?? "🎭";
}

export function colorFor(background: string): string {
  return BACKGROUND_COLOR[background] ?? "#3B3550";
}
