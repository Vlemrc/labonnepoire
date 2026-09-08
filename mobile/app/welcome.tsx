import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { AVATAR_IDS } from "../src/avatars/registry";
import { Avatar, Body, Button, Screen, Title } from "../src/components/ui";
import { colors, spacing } from "../src/theme";

/**
 * Ecran d'arrivee. Aucun compte requis : on demande d'abord ce que le joueur
 * veut faire, et le profil ne vient qu'une fois le salon choisi.
 */
export default function Welcome() {
  const router = useRouter();

  return (
    <Screen
      footer={
        <>
          <Button label="Creer un salon" onPress={() => router.push("/salons/new")} />
          <Button
            label="Rejoindre avec un code"
            variant="ghost"
            onPress={() => router.push("/salons/join")}
          />
        </>
      }
    >
      <View style={s.hero}>
        <Title>La Bonne Poire</Title>
        <Body muted>
          Un joueur connait la vraie reponse et invente des mensonges. Les autres
          repartissent leurs jetons sur ce qui leur semble vrai. Celui qui se
          fait avoir paie.
        </Body>
      </View>

      <View style={s.avatars}>
        {AVATAR_IDS.map((id) => (
          <Avatar key={id} avatar={id} size={46} />
        ))}
      </View>

      <Body muted>Cree un salon et partage son code, ou rejoins celui d'un ami.</Body>
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { gap: spacing.sm, paddingTop: spacing.xl },
  avatars: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "center",
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
});
