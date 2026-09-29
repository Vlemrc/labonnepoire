import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AVATAR_IDS } from "../src/avatars/registry";
import { Appear } from "../src/components/Appear";
import { Avatar, Body, Button, Screen } from "../src/components/ui";
import { colors, fonts, radius, spacing, sticker } from "../src/theme";

/**
 * Ecran d'arrivee. Aucun compte requis : on demande d'abord ce que le joueur
 * veut faire, et le profil ne vient qu'une fois le salon choisi.
 *
 * Mise en page volontairement bancale — titre enorme coupe en trois, vignettes
 * en eventail, pastilles de travers. C'est un jeu d'ambiance : un alignement
 * parfait le ferait passer pour un utilitaire.
 */
export default function Welcome() {
  const router = useRouter();

  return (
    <Screen
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
      <View style={s.hero}>
        {["LA", "BONNE", "POIRE"].map((word, i) => (
          <Appear key={word} index={i}>
            <Text
              style={[
                s.heroLine,
                i === 1 && s.heroLineShift,
                i === 2 && s.heroAccent,
              ]}
            >
              {word}
            </Text>
          </Appear>
        ))}
      </View>

      <View style={s.fan}>
        {AVATAR_IDS.map((id, i) => (
          <Appear
            key={id}
            index={3 + i}
            style={[
              s.fanItem,
              {
                // Eventail : rotation croissante de part et d'autre du centre,
                // et les cartes se chevauchent comme une main de cartes.
                transform: [{ rotate: `${(i - (AVATAR_IDS.length - 1) / 2) * 5}deg` }],
                marginLeft: i === 0 ? 0 : -14,
                marginTop: Math.abs(i - (AVATAR_IDS.length - 1) / 2) * 4,
              },
            ]}
          >
            <Avatar avatar={id} size={52} />
          </Appear>
        ))}
      </View>

      <View style={s.pitch}>
        <Appear index={11} style={[s.tag, s.tagLeft]}>
          <Text style={s.tagText}>1 ment</Text>
        </Appear>
        <Appear index={12} style={[s.tag, s.tagRight]}>
          <Text style={s.tagText}>les autres misent</Text>
        </Appear>
      </View>

      <Body muted>
        Un joueur connaît la vraie réponse et invente des mensonges. Les autres
        répartissent leurs jetons sur ce qui leur semble vrai. Celui qui se fait
        avoir paie.
      </Body>
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { paddingTop: spacing.lg, paddingBottom: spacing.sm },
  heroLine: {
    fontFamily: fonts.display,
    fontSize: 54,
    lineHeight: 52,
    letterSpacing: -2.5,
    color: colors.text,
  },
  heroLineShift: { marginLeft: spacing.lg },
  heroAccent: { color: colors.secondary, marginLeft: spacing.sm },
  fan: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  fanItem: {
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 3,
    ...sticker,
  },
  pitch: { flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.xs },
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
  tagRight: { transform: [{ rotate: "2.5deg" }], borderColor: colors.secondary },
  tagText: {
    fontFamily: fonts.display,
    fontSize: 13,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.text,
  },
});
