import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { RoundView } from "@poire/shared";
import { useAuth } from "../auth/AuthContext";
import { useReportCard, useSession, useStartManche } from "../api/hooks";
import { Appear } from "../components/Appear";
import { Avatar, Body, Button, Card, Heading, Label, Pill, Screen, Title } from "../components/ui";
import { colors, fonts, spacing } from "../theme";

export function ResultScreen({ round }: { round: RoundView }) {
  const router = useRouter();
  const { user } = useAuth();
  const report = useReportCard();
  const [reported, setReported] = useState(false);
  const session = useSession(round.sessionId);
  const startManche = useStartManche();
  const result = round.result;
  if (!result) return null;

  // La suite depend de la partie, pas de ce round : une carte peut deja etre
  // ouverte aux mises, ou une nouvelle manche lancee par un autre joueur.
  const game = session.data;
  const next = game?.currentRound && game.currentRound.id !== round.id ? game.currentRound : null;
  const nextOpen = next && (next.status === "WRITING" || next.status === "BETTING") ? next : null;
  const canStartManche =
    game?.status === "IN_PROGRESS" &&
    !nextOpen &&
    !game.mancheCards.some((c) => c.status === "WRITING" || c.status === "PENDING" || c.status === "BETTING");

  async function nextManche() {
    try {
      const { session: fresh } = await startManche.mutateAsync(round.sessionId);
      if (fresh.currentRound) router.replace(`/round/${fresh.currentRound.id}`);
    } catch {}
  }

  const footer = game?.status === "FINISHED" ? (
    <Button
      label="Voir le classement"
      onPress={() => router.replace(`/classement/${round.sessionId}`)}
    />
  ) : nextOpen ? (
    <Button
      label={nextOpen.status === "WRITING" ? "Écrire mes mensonges" : "Carte suivante"}
      onPress={() => router.replace(`/round/${nextOpen.id}`)}
    />
  ) : canStartManche ? (
    <>
      {startManche.error ? (
        <Text style={s.error}>{(startManche.error as Error).message}</Text>
      ) : null}
      <Button label="Manche suivante" onPress={() => void nextManche()} loading={startManche.isPending} />
    </>
  ) : (
    <Button
      label="Retour au salon"
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/salons"))}
    />
  );

  const fullBluff = result.answers.every((a) => !a.isTrue);
  const myDelta = result.deltas.find((d) => d.user.id === user?.id);

  return (
    <Screen
      footer={footer}
    >
      <Title>Résultats</Title>
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
          <Pill text="Round spécial" tone="secondary" />
          <Body>Aucune de ces réponses n'était vraie. Seul « aucune de ces réponses » rapportait.</Body>
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
            <Body muted>Réponse de la carte</Body>
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
            <Body muted>Personne n'a misé dessus.</Body>
          )}
        </Card>
        </Appear>
      ))}

      <Appear index={2 + result.answers.length + 1} style={{ gap: spacing.sm }}>
        <Heading>Bilan</Heading>
        <Card>
          {/* Deux nombres par joueur : sans en-tete, on ne sait pas lequel est
              le gain de la carte et lequel est le capital qui reste. */}
          <View style={s.deltaRow}>
            <Text style={[s.column, s.colPlayer]}>Joueur</Text>
            <Text style={[s.column, s.colDelta]}>Carte</Text>
            <Text style={[s.column, s.colAfter]}>Points restants</Text>
          </View>
          {result.deltas.map((d) => (
            <View key={d.user.id} style={s.deltaRow}>
              <View style={[s.colPlayer, s.player]}>
                <Avatar avatar={d.user.avatar} size={28} />
                <Text style={s.deltaName} numberOfLines={1}>
                  {d.user.pseudo}
                </Text>
              </View>
              <Text
                style={[
                  s.delta,
                  s.colDelta,
                  { color: d.delta > 0 ? colors.success : d.delta < 0 ? colors.danger : colors.textMuted },
                ]}
              >
                {d.delta > 0 ? "+" : ""}
                {d.delta}
              </Text>
              <Text style={[s.after, s.colAfter]}>{d.pointsAfter}</Text>
            </View>
          ))}
        </Card>
      </Appear>

      {/* La relecture du contenu par les joueurs est le seul mecanisme qui
          passe a l'echelle : toutes les cartes sont en statut non verifie. */}
      <Button
        label={reported ? "Carte signalée" : "Signaler cette carte"}
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
  error: { color: colors.danger, fontSize: 14, textAlign: "center" },
  bigDelta: { fontFamily: fonts.display, fontSize: 44 },
  answerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  authorRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  bets: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
  betChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  betAmount: { fontFamily: fonts.display, fontSize: 14, color: colors.text },
  deltaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  player: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  deltaName: { flexShrink: 1, fontFamily: fonts.bodyBold, color: colors.text, fontSize: 16 },
  delta: { fontFamily: fonts.display, fontSize: 17 },
  after: { fontFamily: fonts.display, color: colors.text, fontSize: 17 },
  column: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.2, color: colors.textMuted, textTransform: "uppercase" },
  colPlayer: { flex: 1, textAlign: "left" },
  colDelta: { width: 52, textAlign: "right" },
  colAfter: { width: 76, textAlign: "right" },
});
