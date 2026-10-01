import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { RoundView, SessionView } from "@poire/shared";
import { useAuth } from "../../src/auth/AuthContext";
import { useActivateTwist, useRound, useSession } from "../../src/api/hooks";
import { BluffScreen } from "../../src/screens/BluffScreen";
import { BetScreen } from "../../src/screens/BetScreen";
import { ResultScreen } from "../../src/screens/ResultScreen";
import { LiveBetsScreen } from "../../src/screens/LiveBetsScreen";
import { Avatar, Body, Button, Card, ErrorText, ErrorView, Heading, Loading, Pill, Screen, Title } from "../../src/components/ui";
import { Deadline } from "../../src/components/Deadline";
import { colors, fonts, spacing } from "../../src/theme";

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
  const router = useRouter();
  const round = useRound(id);
  const session = useSession(round.data?.sessionId);

  // Une fois ses mensonges ecrits, on attend sur sa propre carte. Des que tout
  // le monde a ecrit, une carte s'ouvre aux mises : on y bascule tout seul,
  // plutot que de laisser le joueur sur un ecran d'attente perime.
  const r0 = round.data;
  const playing = session.data?.currentRound;
  const waitingHere =
    r0 !== undefined &&
    (r0.status === "PENDING" || (r0.status === "WRITING" && !isMyTurnToWrite(r0, user?.id)));
  const nextId = waitingHere && playing?.status === "BETTING" && playing.id !== r0.id ? playing.id : null;
  useEffect(() => {
    if (nextId) router.replace(`/round/${nextId}`);
  }, [nextId, router]);

  if (round.isPending) return <Loading />;
  if (round.error) return <ErrorView error={round.error} onRetry={() => void round.refetch()} />;

  const r = round.data;
  const me = r.participants.find((p) => p.user.id === user?.id);

  if (r.status === "CANCELLED") return <Cancelled round={r} />;

  if (r.status === "RESOLVED") return <ResultScreen round={r} />;

  if (nextId) return <Loading />;

  const stillWriting = session.data?.mancheCards.some((c) => c.status === "WRITING") ?? false;

  if (r.status === "PENDING" && !stillWriting) {
    return (
      <Waiting
        round={r}
        title="Carte en attente"
        subtitle="Les cartes se jouent une par une. Celle-ci passera à son tour."
      />
    );
  }

  if (r.status === "WRITING" || r.status === "PENDING") {
    if (isMyTurnToWrite(r, user?.id)) return <BluffScreen round={r} />;
    // Tout le monde ecrit en meme temps : si l'on est ici, il reste des joueurs
    // a la traine. Ce round n'est pas forcement le notre (c'est celui d'un
    // retardataire), on ne peut donc affirmer « tes mensonges sont prets » que
    // si c'est bien notre carte.
    return (
      <Waiting
        round={r}
        title="En attente des autres"
        subtitle={
          r.myRole === "BLUFFEUR"
            ? "Tes mensonges sont prêts. La manche démarre quand tout le monde aura écrit."
            : "D'autres joueurs écrivent encore. La manche démarre quand tout le monde aura écrit."
        }
        writers={session.data}
      />
    );
  }

  if (r.myRole === "BLUFFEUR") return <LiveBetsScreen round={r} />;

  // BETTING
  if (r.myRole === "BETTOR" && !me?.hasSubmitted) {
    return <BetScreen round={r} budget={r.myBudget} />;
  }
  return (
    <Waiting
      round={r}
      title="Mises en cours"
      subtitle={
        // A sec, on est marque « a mise » d'office : on regarde la carte passer.
        r.myBudget === 0 && !r.myBets
          ? "Tu n'as plus de jetons : cette carte se joue sans toi."
          : "Tes mises sont enregistrées, secrètes jusqu'au bout."
      }
    />
  );
}

function isMyTurnToWrite(round: RoundView, userId: string | undefined) {
  return (
    round.status === "WRITING" &&
    round.myRole === "BLUFFEUR" &&
    !round.participants.find((p) => p.user.id === userId)?.hasSubmitted
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
      <Title>Round annulé</Title>
      <Body muted>
        {timeout
          ? `${round.bluffeur.pseudo} n'a pas envoyé ses réponses à temps. Sa mise de départ est répartie entre vous.`
          : `${round.bluffeur.pseudo} a quitté la partie.`}
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
              <Avatar avatar={d.user.avatar} size={28} />
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

function Waiting({
  round,
  title,
  subtitle,
  writers,
}: {
  round: RoundView;
  title: string;
  subtitle: string;
  /** Pendant l'ecriture : la manche entiere, pour montrer qui a deja ecrit. */
  writers?: SessionView;
}) {
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
        <Card style={{ borderColor: colors.secondary }}>
          <Pill text={`Twist : ${round.twist.label}`} tone="secondary" />
          <Body muted>{round.twist.description}</Body>
          {round.twist.activatedBy ? (
            <Body muted>Activé par {round.twist.activatedBy.pseudo}.</Body>
          ) : null}
        </Card>
      ) : null}

      {writers ? (
        <Card>
          <Heading>Qui a écrit</Heading>
          {writers.mancheCards.map((c) => {
            const done = c.status !== "WRITING";
            return (
              <View key={c.roundId} style={s.row}>
                <Avatar avatar={c.bluffeur.avatar} size={32} />
                <Text style={s.name}>{c.bluffeur.pseudo}</Text>
                <Pill text={done ? "Prêt" : "Écrit…"} tone={done ? "good" : "muted"} />
              </View>
            );
          })}
        </Card>
      ) : (
      <Card>
        <Heading>On attend</Heading>
        {pending.length === 0 ? (
          <Body muted>Tout le monde a joué. La résolution arrive.</Body>
        ) : (
          pending.map((p) => (
            <View key={p.user.id} style={s.row}>
              <Avatar avatar={p.user.avatar} size={32} />
              <Text style={s.name}>{p.user.pseudo}</Text>
              <Body muted>{p.role === "BLUFFEUR" ? "écrit" : "mise"}</Body>
            </View>
          ))
        )}
      </Card>
      )}

      {canTwist ? (
        <>
          {twist.error ? <ErrorText>{(twist.error as Error).message}</ErrorText> : null}
          <Button
            label="Jouer ma carte twist"
            variant="ghost"
            onPress={() => void twist.mutateAsync()}
            loading={twist.isPending}
          />
          <Body muted>Une seule fois par partie. Elle change la règle du round en cours.</Body>
        </>
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  // Le delai passe sous le titre : a cote, un titre long le poussait hors de l'ecran.
  titleRow: { alignItems: "flex-start", gap: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { flex: 1, color: colors.text, fontSize: 16 },
  bigDelta: { fontFamily: fonts.display, fontSize: 44 },
  delta: { fontFamily: fonts.display, fontSize: 17, minWidth: 40, textAlign: "right" },
});
