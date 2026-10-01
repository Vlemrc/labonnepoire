/**
 * Palette : fond creme tres clair, cartes vert feuille (celui de l'icone),
 * encre noire des yeux, saumon des joues pour les moments speciaux.
 *
 * Pas de blanc : le creme du fond est la seule couleur claire de l'app.
 *
 * Deux encres coexistent. Le texte pose directement sur le fond creme prend
 * l'encre `ink`, le noir des yeux, et ses variantes. Dans les cartes et le
 * pied d'ecran vert feuille, le texte est creme. Les composants de texte de
 * ui.tsx choisissent seuls la bonne encre selon qu'ils sont dans une carte ou
 * non (cf. `useInk`).
 *
 * `primary` (creme) porte les actions et les reperes de jeu : boutons, code du
 * salon, points, selection. `secondary` (saumon) marque les moments speciaux —
 * twists et rounds « tout est faux ». `success` et `danger` restent reserves
 * aux gains et aux pertes : s'en servir aussi comme accents rendrait l'ecran
 * de resultats illisible.
 *
 * Le vert feuille est assez clair pour que les accents vifs y deviennent
 * illisibles (le saumon de l'icone y tombe a 2.2:1) : sur les cartes, les
 * accents sont des teintes tres pales, qui se distinguent surtout par leur
 * contexte.
 *
 * Contrastes verifies. Sur les cartes : creme a 5:1, attenue a 4.7:1, saumon
 * pale a 4.7:1, citron pale a 4.8:1, rose pale a 4.6:1. Sur le fond : encre a
 * 15.5:1, encre attenuee a 5.5:1, saumon fonce a 5.4:1, vert feuille a 5:1,
 * rouge fonce a 7.5:1.
 */
export const colors = {
  // Le fond de l'app : creme tres clair, tirant vers le jaune-vert.
  bg: "#F6F7E3",
  // Encres du texte pose directement sur le fond creme.
  ink: "#1D1D1B",
  inkMuted: "#62654F",
  inkSecondary: "#A8452A",
  inkSuccess: "#127C00",
  inkDanger: "#9B1C12",
  // Les cartes prennent le vert de la feuille.
  surface: "#127C00",
  surfaceHigh: "#0E6600",
  border: "#0B5200",
  text: "#F6F7E3",
  textMuted: "#EEF1D5",
  // Le creme du fond sert aussi aux boutons et au texte des cartes.
  primary: "#F6F7E3",
  primaryText: "#127C00",
  secondary: "#FFEDE6",
  danger: "#FFE8E4",
  success: "#E4FF7A",
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 } as const;

/**
 * Typographie.
 *
 * Bricolage Grotesque porte les titres : une grotesque contemporaine au dessin
 * marque, qui donne au jeu une tete a lui. Outfit assure la lecture courante.
 * Gluten, ronde et bonhomme, est reservee au logo : ailleurs elle ferait
 * concurrence au titre. Space Mono est reserve au code du salon — une vraie
 * chasse fixe, pour que les caracteres s'alignent et se dictent sans ambiguite.
 *
 * Avec des polices chargees, on ne declare JAMAIS de fontWeight : iOS
 * fabriquerait une fausse graisse par-dessus la vraie. La graisse se choisit en
 * nommant la variante.
 */
export const fonts = {
  display: "BricolageGrotesque_800ExtraBold",
  displaySemi: "BricolageGrotesque_600SemiBold",
  logo: "Gluten_800ExtraBold",
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
  shadowColor: "#0B4A00",
  shadowOpacity: 1,
  shadowRadius: 0,
  shadowOffset: { width: 3, height: 5 },
  elevation: 6,
} as const;
