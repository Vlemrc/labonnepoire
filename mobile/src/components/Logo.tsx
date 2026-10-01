import { StyleSheet, Text, View } from "react-native";
import { Appear } from "./Appear";
import { colors, fonts } from "../theme";

const WORDS = ["LA", "BONNE", "POIRE"] as const;

/**
 * Logo typographique : « LA BONNE POIRE » en Gluten ExtraBold.
 *
 * Sur une ligne par defaut ; `stacked` le pose sur trois lignes centrees, un
 * mot par ligne. `size` fixe le corps ; l'interlignage en decoule, pour que le
 * logo garde ses proportions a toutes les tailles.
 */
export function Logo({
  size = 32,
  stacked = false,
  animated = false,
}: {
  size?: number;
  stacked?: boolean;
  animated?: boolean;
}) {
  const lines = stacked ? WORDS : [WORDS.join(" ")];
  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel="La Bonne Poire"
      style={stacked && s.stacked}
    >
      {lines.map((line, i) => {
        const text = (
          <Text numberOfLines={1} style={[s.logo, { fontSize: size, lineHeight: size * 1.1 }]}>
            {line}
          </Text>
        );
        return animated ? (
          <Appear key={line} index={i}>
            {text}
          </Appear>
        ) : (
          <View key={line}>{text}</View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  stacked: { alignItems: "center" },
  // Pas de fontWeight : la graisse vient de la variante chargee (cf. theme.ts).
  // Vert feuille, comme les cartes et la feuille de l'icone (5:1 sur le creme).
  logo: { fontFamily: fonts.logo, color: colors.surface, letterSpacing: -0.5 },
});
