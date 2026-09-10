/**
 * Palette.
 *
 * `primary` (bleu) porte les actions et les reperes de jeu : boutons, code du
 * salon, points, selection. `secondary` (violet) marque les moments speciaux —
 * twists et rounds « tout est faux ». `success` et `danger` restent reserves
 * aux gains et aux pertes : les melanger avec les accents rendrait un ecran de
 * resultats illisible.
 *
 * Les contrastes sont verifies : chaque couleur de texte atteint au moins
 * 4.5:1 sur son fond, y compris le texte sombre pose sur le bleu vif.
 */
export const colors = {
  bg: "#0F1119",
  surface: "#171A26",
  surfaceHigh: "#212533",
  border: "#2E3345",
  text: "#EEF2FB",
  textMuted: "#98A0B8",
  primary: "#2B7FFF",
  primaryText: "#04122E",
  secondary: "#A855F7",
  danger: "#F2564B",
  success: "#3ECF8E",
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 } as const;

export const font = {
  title: { fontSize: 26, fontWeight: "800" },
  heading: { fontSize: 19, fontWeight: "700" },
  body: { fontSize: 16, fontWeight: "500" },
  label: { fontSize: 13, fontWeight: "600" },
  mono: { fontSize: 28, fontWeight: "800", letterSpacing: 4 },
} as const;
