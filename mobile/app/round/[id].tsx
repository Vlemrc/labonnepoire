import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import type { RoundView } from "@bluff/shared";
import { useAuth } from "../../src/auth/AuthContext";
import { useActivateTwist, useRound, useSession } from "../../src/api/hooks";
import { BluffScreen } from "../../src/screens/BluffScreen";
import { BetScreen } from "../../src/screens/BetScreen";
import { ResultScreen } from "../../src/screens/ResultScreen";
import {
  Avatar,
  Body,
  Button,
  Card,
  ErrorView,
  Heading,
  Loading,
  Pill,
  Screen,
  Title,
} from "../../src/components/ui";
import { colors, spacing } from "../../src/theme";

/**
 * Point d'entree unique d'un round.
 *
 * Une seule route plutot que trois ecrans separes : en asynchrone, la phase
 * peut changer sous les pieds du joueur (le bluffeur valide pendant qu'on
 * regarde l'ecran d'attente). Un ecran qui derive de l'etat serveur affiche
 * toujours la bonne chose, la ou une navigation figee laisserait le joueur
 * bloque sur une phase revolue.
 */
export default function Round() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const round = useRound(id);

  if (round.isPending) return <Loading />;
  if (round.error) return <ErrorView error={round.error} onRetry={() => void round.refetch()} />;

  const r = round.data;
  const me = r.participants.find((p) => p.user.id === user?.id);

  if (r.status === "CANCELLED") {
    return (
      <Screen>
        <Title>Round annule</Title>
        <Body muted>Le bluffeur a quitte la partie.</Body>
      </Screen>
    );
  }

  if (r.status === "RESOLVED") return <ResultScreen round={r} />;

  if (r.status === "WRITING") {
    if (r.myRole === "BLUFFEUR" && !me?.hasSubmitted) return <BluffScreen round={r} />;
    return <Waiting round={r} title="En attente du bluffeur" subtitle={`${r.bluffeur.pseudo} prepare ses mensonges.`} />;
  }

  // BETTING
  if (r.myRole === "BETTOR" && !me?.hasSubmitted) {
    return <BetScreen round={r} budget={me?.budget ?? r.stakeBudget} />;
  }
  return (
    <Waiting
      round={r}
      title="Mises en cours"
      subtitle={
        r.myRole === "BLUFFEUR"
          ? "Tes reponses sont parties. On attend les paris."
          : "Tes mises sont enregistrees, secretes jusqu'au bout."
      }
    />
  );
}

function Waiting({ round, title, subtitle }: { round: RoundView; title: string; subtitle: string }) {
  const twist = useActivateTwist(round.id);
  const pending = round.participants.filter((p) => !p.hasSubmitted);
  const canTwist = round.status === "WRITING" && !round.twist;

  return (
    <Screen>
      <Title>{title}</Title>
      <Body muted>{subtitle}</Body>

      {round.twist ? (
        <Card style={{ borderColor: colors.success }}>
          <Pill text={`Twist : ${round.twist.label}`} tone="good" />
          <Body muted>{round.twist.description}</Body>
          {round.twist.activatedBy ? (
            <Body muted>Active par {round.twist.activatedBy.pseudo}.</Body>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <Heading>On attend</Heading>
        {pending.length === 0 ? (
          <Body muted>Tout le monde a joue. La resolution arrive.</Body>
        ) : (
          pending.map((p) => (
            <View key={p.user.id} style={s.row}>
              <Avatar config={p.user.avatarConfig} size={32} />
              <Text style={s.name}>{p.user.pseudo}</Text>
              <Body muted>{p.role === "BLUFFEUR" ? "ecrit" : "mise"}</Body>
            </View>
          ))
        )}
      </Card>

      {canTwist ? (
        <>
          {twist.error ? <Text style={s.error}>{(twist.error as Error).message}</Text> : null}
          <Button
            label="Jouer ma carte twist"
            variant="ghost"
            onPress={() => void twist.mutateAsync()}
            loading={twist.isPending}
          />
          <Body muted>Une seule fois par partie. Elle change la regle du round en cours.</Body>
        </>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { flex: 1, color: colors.text, fontSize: 16 },
  error: { color: colors.danger, fontSize: 14, textAlign: "center" },
});
