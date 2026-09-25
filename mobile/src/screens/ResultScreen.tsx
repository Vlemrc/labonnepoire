import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { RoundView } from "@poire/shared";
import { useAuth } from "../auth/AuthContext";
import { useReportCard } from "../api/hooks";
import { Appear } from "../components/Appear";
import { Avatar, Body, Button, Card, Heading, Label, Pill, Screen, Title } from "../components/ui";
import { colors, fonts, spacing } from "../theme";

export function ResultScreen({ round }: { round: RoundView }) {
  const router = useRouter();
  const { user } = useAuth();
  const report = useReportCard();
  const [reported, setReported] = useState(false);
  const result = round.result;
  if (!result) return null;

  const fullBluff = result.answers.every((a) => !a.isTrue);
  const myDelta = result.deltas.find((d) => d.user.id === user?.id);

  return (
    <Screen
      footer={
        <Button
          label="Retour au salon"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/salons"))}
        />
      }
    >
      <Title>Resultats</Title>
      <Body muted>{result.question}</Body>

      {myDelta ? (
        <Appear index={1}>
        <Card
          style={{
            borderColor:
              myDelta.delta > 0 ? colors.success : myDelta.delta < 0 ? colors.danger : colors.border,
          }}
        >
          <Label>Ton round</Label>
          <Text
            style={[
              s.bigDelta,
              { color: myDelta.delta > 0 ? colors.success : myDelta.delta < 0 ? colors.danger : colors.textMuted },
            ]}
          >
            {myDelta.delta > 0 ? "+" : ""}
            {myDelta.delta}
          </Text>
          <Body muted>Il te reste {myDelta.pointsAfter} points.</Body>
        </Card>
        </Appear>
      ) : null}

      {fullBluff ? (
        <Card style={{ borderColor: colors.secondary }}>
          <Pill text="Round special" tone="secondary" />
          <Body>Aucune de ces reponses n'etait vraie. Seul « aucune de ces reponses » rapportait.</Body>
        </Card>
      ) : null}

      {result.answers.map((answer, i) => (
        <Appear key={answer.id} index={2 + i}>
        <Card style={answer.isTrue ? { borderColor: colors.success } : undefined}>
          <View style={s.answerHeader}>
            <Heading>{answer.text}</Heading>
            {answer.isTrue ? <Pill text="Vraie" tone="good" /> : null}
          </View>
          {answer.author ? (
            <View style={s.authorRow}>
              <Avatar avatar={answer.author.avatar} size={24} />
              <Body muted>Menti par {answer.author.pseudo}</Body>
            </View>
          ) : (
            <Body muted>Reponse de la carte</Body>
          )}
          {answer.betsReceived.length > 0 ? (
            <View style={s.bets}>
              {answer.betsReceived.map((bet) => (
                <View key={`${answer.id}-${bet.bettor.id}`} style={s.betChip}>
                  <Avatar avatar={bet.bettor.avatar} size={20} />
                  <Text style={s.betAmount}>{bet.amount}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Body muted>Personne n'a mise dessus.</Body>
          )}
        </Card>
        </Appear>
      ))}

      <Appear index={2 + result.answers.length + 1}>
      <Card>
        <Label>Bilan</Label>
        {result.deltas.map((d) => (
          <View key={d.user.id} style={s.deltaRow}>
            <Avatar avatar={d.user.avatar} size={28} />
            <Text style={s.deltaName}>{d.user.pseudo}</Text>
            <Text
              style={[
                s.delta,
                { color: d.delta > 0 ? colors.success : d.delta < 0 ? colors.danger : colors.textMuted },
              ]}
            >
              {d.delta > 0 ? "+" : ""}
              {d.delta}
            </Text>
            <Text style={s.after}>{d.pointsAfter}</Text>
          </View>
        ))}
      </Card>
      </Appear>

      {/* La relecture du contenu par les joueurs est le seul mecanisme qui
          passe a l'echelle : toutes les cartes sont en statut non verifie. */}
      <Button
        label={reported ? "Carte signalee" : "Signaler cette carte"}
        variant="ghost"
        disabled={reported || report.isPending}
        onPress={async () => {
          if (!round.cardId) return;
          try {
            await report.mutateAsync({ cardId: round.cardId });
          } finally {
            setReported(true);
          }
        }}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  bigDelta: { fontFamily: fonts.display, fontSize: 44 },
  answerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  authorRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  bets: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
  betChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  betAmount: { fontFamily: fonts.display, fontSize: 14, color: colors.text },
  deltaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  deltaName: { flex: 1, color: colors.text, fontSize: 16 },
  delta: { fontFamily: fonts.display, fontSize: 17, minWidth: 40, textAlign: "right" },
  after: { color: colors.textMuted, fontSize: 14, minWidth: 32, textAlign: "right" },
});
