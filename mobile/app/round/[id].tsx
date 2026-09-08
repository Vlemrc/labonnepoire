import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { RoundView } from "@poire/shared";
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
import { Deadline } from "../../src/components/Deadline";
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

  if (r.status === "CANCELLED") return <Cancelled round={r} />;

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

/**
 * Un round annule n'est pas un ecran vide : la penalite du bluffeur absent a
 * deja change les scores, il faut dire pourquoi et combien.
 */
function Cancelled({ round }: { round: RoundView }) {
  const router = useRouter();
  const { user } = useAuth();
  const deltas = round.result?.deltas ?? [];
  const mine = deltas.find((d) => d.user.id === user?.id);
  const timeout = round.cancelReason === "BLUFFEUR_TIMEOUT";

  return (
    <Screen
      footer={
        <Button
          label="Retour au salon"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/salons"))}
        />
      }
    >
      <Title>Round annule</Title>
      <Body muted>
        {timeout
          ? `${round.bluffeur.pseudo} n'a pas envoye ses reponses a temps. Sa mise de depart est repartie entre vous.`
          : `${round.bluffeur.pseudo} a quitte la partie.`}
      </Body>

      {mine && mine.delta !== 0 ? (
        <Card style={{ borderColor: mine.delta > 0 ? colors.success : colors.danger }}>
          <Text style={[s.bigDelta, { color: mine.delta > 0 ? colors.success : colors.danger }]}>
            {mine.delta > 0 ? "+" : ""}
            {mine.delta}
          </Text>
          <Body muted>Il te reste {mine.pointsAfter} points.</Body>
        </Card>
      ) : null}

      {deltas.length > 0 ? (
        <Card>
          <Heading>Bilan</Heading>
          {deltas.map((d) => (
            <View key={d.user.id} style={s.row}>
              <Avatar config={d.user.avatarConfig} size={28} />
              <Text style={s.name}>{d.user.pseudo}</Text>
              <Text
                style={[
                  s.delta,
                  { color: d.delta > 0 ? colors.success : d.delta < 0 ? colors.danger : colors.textMuted },
                ]}
              >
                {d.delta > 0 ? "+" : ""}
                {d.delta}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

function Waiting({ round, title, subtitle }: { round: RoundView; title: string; subtitle: string }) {
  const twist = useActivateTwist(round.id);
  const pending = round.participants.filter((p) => !p.hasSubmitted);
  const canTwist = round.status === "WRITING" && !round.twist;

  return (
    <Screen>
      <View style={s.titleRow}>
        <Title>{title}</Title>
        <Deadline deadlineAt={round.deadlineAt} />
      </View>
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
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { flex: 1, color: colors.text, fontSize: 16 },
  bigDelta: { fontSize: 40, fontWeight: "800" },
  delta: { fontSize: 16, fontWeight: "800", minWidth: 40, textAlign: "right" },
  error: { color: colors.danger, fontSize: 14, textAlign: "center" },
});
