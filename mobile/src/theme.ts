/**
 * Palette : fond vert emeraude, cartes vert foret tres sombre, creme pour le
 * texte et les boutons, citron de l'icone pour le logo et les gains, violet
 * en secondaire.
 *
 * Pas de blanc : le creme est la seule couleur claire de l'app.
 *
 * Deux encres coexistent. Le texte pose directement sur le fond emeraude
 * prend l'encre `ink` et ses variantes, calibrees pour lui ; dans les cartes
 * et le pied d'ecran, plus sombres, les accents peuvent etre plus vifs. Les
 * composants de texte de ui.tsx choisissent seuls la bonne encre selon qu'ils
 * sont dans une carte ou non (cf. `useInk`).
 *
 * `primary` (creme) porte les actions et les reperes de jeu : boutons, code du
 * salon, points, selection. `secondary` (violet) marque les moments speciaux —
 * twists et rounds « tout est faux ». `success` et `danger` restent reserves
 * aux gains et aux pertes : s'en servir aussi comme accents rendrait l'ecran
 * de resultats illisible.
 *
 * Contrastes verifies. Sur les cartes : creme a 11.7:1, attenue a 9.8:1,
 * violet a 4.8:1, rouge a 5.6:1, citron a 8.2:1. Sur le fond : creme a 5:1,
 * attenue a 4.5:1, violet pale a 4.7:1, citron pale a 4.9:1, rose pale a
 * 4.6:1 ; le logo citron, en tres grand, a 3.6:1. C'est la raison d'etre des
 * cartes sombres : sur l'emeraude seul, le violet tombe a 2.1:1.
 */
export const colors = {
  // Le fond de l'app : vert emeraude.
  bg: "#047857",
  // Encres du texte pose directement sur le fond emeraude.
  ink: "#F6F7E3",
  inkMuted: "#D9EEDF",
  inkSecondary: "#F3E8FF",
  inkSuccess: "#E4FF7A",
  inkDanger: "#FFE4E0",
  // Le citron de l'icone, reserve au logo.
  brand: "#B5E000",
  // Les cartes sont un vert foret bien plus sombre : c'est ce qui permet aux
  // accents — et surtout au violet — de rester lisibles.
  surface: "#043B24",
  surfaceHigh: "#0A5236",
  border: "#10A06B",
  text: "#F6F7E3",
  textMuted: "#CFE8D8",
  // Bouton creme a texte vert foret : le contraste maximal disponible ici.
  primary: "#F6F7E3",
  primaryText: "#043B24",
  secondary: "#C084FC",
  danger: "#FF8A80",
  success: "#B5E000",
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
  shadowColor: "#022416",
  shadowOpacity: 1,
  shadowRadius: 0,
  shadowOffset: { width: 3, height: 5 },
  elevation: 6,
} as const;
