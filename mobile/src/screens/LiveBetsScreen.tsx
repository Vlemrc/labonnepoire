import { StyleSheet, Text, View } from "react-native";
import type { PublicUser, RoundView } from "@poire/shared";
import { Appear } from "../components/Appear";
import { Avatar, Body, Card, Heading, Pill, Screen, Title } from "../components/ui";
import { Deadline } from "../components/Deadline";
import { QuestionCard } from "../components/QuestionCard";
import { colors, fonts, spacing } from "../theme";

const NONE_KEY = "__none__";

/**
 * Ecran de l'auteur de la carte pendant les mises : il ne parie pas, il
 * regarde. Chaque proposition montre ce qu'elle attire, mise a jour a chaque
 * interrogation du serveur. Il touchera ce qui tombe sur ses mensonges, divise
 * par le nombre de parieurs : c'est cette part qu'on lui affiche.
 */
export function LiveBetsScreen({ round }: { round: RoundView }) {
  const live = round.liveBets;
  const bets = live?.bets ?? [];

  const byOption = new Map<string, { bettor: PublicUser; amount: number }[]>();
  for (const bet of bets) {
    const key = bet.isNoneOption ? NONE_KEY : (bet.answerId ?? NONE_KEY);
    byOption.set(key, [...(byOption.get(key) ?? []), { bettor: bet.bettor, amount: bet.amount }]);
  }

  const options = [
    ...(round.answers ?? []).map((a) => ({ key: a.id, text: a.text })),
    ...(round.allowNoneOption ? [{ key: NONE_KEY, text: "Aucune de ces réponses" }] : []),
  ];

  const onLies = bets
    .filter((b) => !b.isNoneOption && b.answerId !== live?.trueAnswerId)
    .reduce((sum, b) => sum + b.amount, 0);
  const pending = round.participants.filter((p) => p.role === "BETTOR" && !p.hasSubmitted);
  // Le serveur divise par les parieurs engages : ceux qui ont mise, plus ceux
  // qui doivent encore le faire. Les joueurs a sec n'en font pas partie.
  const voters = new Set(bets.map((b) => b.bettor.id)).size + pending.length;
  const myShare = Math.floor(onLies / Math.max(1, voters));

  return (
    <Screen>
      <View style={s.header}>
        <View style={{ gap: spacing.xs, flex: 1 }}>
          <Title>Ta carte est en jeu</Title>
          <Deadline deadlineAt={round.deadlineAt} />
        </View>
        <View style={s.total}>
          <Text style={s.totalValue}>{myShare}</Text>
          <Text style={s.totalLabel}>pour toi</Text>
        </View>
      </View>
      <Body muted>
        Les mises arrivent en direct. Tu touches ce qui tombe sur tes mensonges,
        divisé par le nombre de parieurs{voters > 0 ? ` (${voters})` : ""}.
      </Body>

      <Appear index={0}>
        <QuestionCard question={round.question} />
      </Appear>

      {options.map((option, index) => {
        const received = byOption.get(option.key) ?? [];
        const sum = received.reduce((n, b) => n + b.amount, 0);
        const isTrue = option.key === live?.trueAnswerId;
        const isNone = option.key === NONE_KEY;
        return (
          <Appear key={option.key} index={index + 1}>
            <Card style={sum > 0 ? { borderColor: isTrue ? colors.success : colors.secondary } : undefined}>
              <View style={s.optionHead}>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  {isTrue ? (
                    <Pill text="La vraie" tone="good" />
                  ) : isNone ? null : (
                    <Pill text="Ton mensonge" tone="secondary" />
                  )}
                  <Heading>{option.text}</Heading>
                </View>
                <Text style={[s.sum, sum === 0 && s.sumEmpty]}>{sum}</Text>
              </View>
              {received.map((b) => (
                <View key={b.bettor.id} style={s.row}>
                  <Avatar avatar={b.bettor.avatar} size={28} />
                  <Text style={s.name}>{b.bettor.pseudo}</Text>
                  <Text style={s.amount}>{b.amount}</Text>
                </View>
              ))}
            </Card>
          </Appear>
        );
      })}

      <Card>
        <Heading>{pending.length === 0 ? "Tout le monde a misé" : "Pas encore misé"}</Heading>
        {pending.map((p) => (
          <View key={p.user.id} style={s.row}>
            <Avatar avatar={p.user.avatar} size={32} />
            <Text style={s.name}>{p.user.pseudo}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: spacing.sm },
  total: { alignItems: "center" },
  totalValue: { fontFamily: fonts.display, fontSize: 40, lineHeight: 42, color: colors.primary },
  totalLabel: { fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 1.4, color: colors.textMuted, textTransform: "uppercase" },
  optionHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sum: { fontFamily: fonts.display, fontSize: 32, color: colors.primary, minWidth: 44, textAlign: "right" },
  sumEmpty: { color: colors.textMuted },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { flex: 1, color: colors.text, fontSize: 16 },
  amount: { fontFamily: fonts.display, fontSize: 17, color: colors.text },
});
