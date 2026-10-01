import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { Appear } from "../src/components/Appear";
import { Logo } from "../src/components/Logo";
import { Body, Button, Screen } from "../src/components/ui";
import { colors, fonts, radius, spacing, sticker } from "../src/theme";

/**
 * Ecran d'arrivee. Aucun compte requis : on demande d'abord ce que le joueur
 * veut faire, et le profil ne vient qu'une fois le salon choisi.
 *
 * Le logo trone au milieu ; le pitch, pastilles de travers comprises, attend
 * en bas pres des boutons. C'est un jeu d'ambiance : un alignement
 * parfait le ferait passer pour un utilitaire.
 */
export default function Welcome() {
  const router = useRouter();
  // « BONNE », la ligne la plus large, mesure environ 3,8 fois le corps : on
  // plafonne la taille pour qu'elle tienne entre les marges des petits ecrans.
  const { width } = useWindowDimensions();
  const logoSize = Math.min(68, (width - spacing.md * 2) / 3.8);

  return (
    <View style={s.root}>
      <Screen
        headerless
        footer={
          <>
            <Button label="Créer un salon" onPress={() => router.push("/salons/new")} />
            <Button
              label="Rejoindre avec un code"
              variant="ghost"
              onPress={() => router.push("/salons/join")}
            />
          </>
        }
      >
        {/* Pousse le pitch en bas, juste au-dessus des boutons. */}
        <View style={s.spacer} />

        <View style={s.pitch}>
          <Appear index={3} style={[s.tag, s.tagLeft]}>
            <Text style={s.tagText}>1 ment</Text>
          </Appear>
          <Appear index={4} style={[s.tag, s.tagRight]}>
            <Text style={s.tagText}>les autres misent</Text>
          </Appear>
        </View>

        <Appear index={5}>
          <Body muted style={s.description}>
            Un joueur connaît la vraie réponse et invente des mensonges. Les autres
            répartissent leurs jetons sur ce qui leur semble vrai. Celui qui se fait
            avoir paie.
          </Body>
        </Appear>
      </Screen>

      {/* Le logo est centre sur l'ecran entier, pas sur l'espace laisse libre
          par le pitch et les boutons : en dehors du flux, et transparent aux
          touchers pour ne pas masquer ce qu'il chevaucherait. */}
      <View style={s.hero} pointerEvents="none">
        <Logo size={logoSize} stacked animated />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  spacer: { flex: 1 },
  // Centre de l'ecran, remonte de 50 px : au centre exact, « POIRE »
  // chevauchait les pastilles du pitch.
  hero: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateY: -50 }],
  },
  pitch: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  description: { textAlign: "center" },
  tag: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
    ...sticker,
  },
  tagLeft: { transform: [{ rotate: "-3deg" }] },
  tagRight: { transform: [{ rotate: "2.5deg" }] },
  tagText: {
    fontFamily: fonts.display,
    fontSize: 13,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.text,
  },
});
