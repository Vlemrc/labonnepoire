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

/**
 * Typographie.
 *
 * Bricolage Grotesque porte les titres : une grotesque contemporaine au dessin
 * marque, qui donne au jeu une tete a lui. Outfit assure la lecture courante.
 * Space Mono est reserve au code du salon — une vraie chasse fixe, pour que les
 * caracteres s'alignent et se dictent sans ambiguite.
 *
 * Avec des polices chargees, on ne declare JAMAIS de fontWeight : iOS
 * fabriquerait une fausse graisse par-dessus la vraie. La graisse se choisit en
 * nommant la variante.
 */
export const fonts = {
  display: "BricolageGrotesque_800ExtraBold",
  displaySemi: "BricolageGrotesque_600SemiBold",
  body: "Outfit_500Medium",
  bodySemi: "Outfit_600SemiBold",
  bodyBold: "Outfit_700Bold",
  mono: "SpaceMono_700Bold",
} as const;

export const font = {
  title: { fontFamily: fonts.display, fontSize: 32, letterSpacing: -1 },
  heading: { fontFamily: fonts.display, fontSize: 20, letterSpacing: -0.4 },
  body: { fontFamily: fonts.body, fontSize: 16 },
  label: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1.4 },
  mono: { fontFamily: fonts.mono, fontSize: 26, letterSpacing: 2 },
} as const;

/**
 * Ombre portee franche, sans flou : les cartes se posent comme des cartons sur
 * une table plutot que de flotter. C'est ce qui donne au jeu son air de jeu.
 */
export const sticker = {
  shadowColor: "#08165E",
  shadowOpacity: 1,
  shadowRadius: 0,
  shadowOffset: { width: 3, height: 5 },
  elevation: 6,
} as const;
