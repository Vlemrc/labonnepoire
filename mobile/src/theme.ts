/**
 * Palette : fond bleu flash, violet en secondaire.
 *
 * `primary` (blanc) porte les actions et les reperes de jeu : boutons, code du
 * salon, points, selection. `secondary` (violet) marque les moments speciaux —
 * twists et rounds « tout est faux ». `success` et `danger` restent reserves
 * aux gains et aux pertes : s'en servir aussi comme accents rendrait l'ecran
 * de resultats illisible.
 *
 * Contrastes verifies : texte blanc a 6.3:1 sur le fond et 8.5:1 sur les
 * cartes, texte attenue a 4.7:1, violet a 4.7:1 sur les cartes. C'est la
 * raison d'etre des cartes bleu profond — sur le bleu vif seul, le violet
 * tombe a 2.4:1 et devient illisible.
 */
export const colors = {
  // Le fond de l'app : bleu flash.
  bg: "#2348F5",
  // Les cartes sont un bleu nettement plus profond. C'est ce qui permet aux
  // accents — et surtout au violet — de rester lisibles : sur le bleu vif du
  // fond, un violet a trop peu d'ecart de luminosite pour se detacher.
  surface: "#0F2199",
  surfaceHigh: "#17309F",
  border: "#4A6BFF",
  text: "#FFFFFF",
  textMuted: "#D6DEFF",
  // Bouton blanc sur fond bleu : le contraste maximal disponible ici.
  primary: "#FFFFFF",
  primaryText: "#0F2199",
  secondary: "#C084FC",
  danger: "#FF8A80",
  success: "#4ADE80",
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
