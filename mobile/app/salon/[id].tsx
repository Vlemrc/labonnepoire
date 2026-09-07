import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { RoundView, SessionView } from "@bluff/shared";
import { useAuth } from "../../src/auth/AuthContext";
import { useGroup, useSession, useStartRound, useStartSession } from "../../src/api/hooks";
import {
  Avatar,
  Body,
  Button,
  Card,
  ErrorView,
  Heading,
  Label,
  Loading,
  Pill,
  Screen,
  Title,
} from "../../src/components/ui";
import { colors, font, spacing } from "../../src/theme";

export default function Salon() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const group = useGroup(id);
  const session = useSession(group.data?.activeSessionId ?? undefined);
  const startSession = useStartSession();
  const startRound = useStartRound();

  if (group.isPending) return <Loading />;
  if (group.error) return <ErrorView error={group.error} onRetry={() => void group.refetch()} />;

  const g = group.data;
  const s = session.data;
  const isOwner = g.ownerId === user?.id;
  const round = s?.currentRound ?? null;
  const roundOpen = round && round.status !== "RESOLVED" && round.status !== "CANCELLED";

  return (
    <Screen footer={<Footer />}>
      <View style={st.header}>
        <Title>{g.name}</Title>
        <Text style={st.code}>{g.code}</Text>
      </View>
      <Body muted>Partage ce code pour inviter du monde.</Body>

      {s ? <Scoreboard session={s} meId={user?.id} /> : <Lobby group={g} />}

      {round ? <RoundCard round={round} /> : null}
    </Screen>
  );

  function Footer() {
    if (!s) {
      if (!isOwner) return <Body muted>En attente que l'hote lance la partie.</Body>;
      return (
        <>
          {startSession.error ? (
            <Text style={st.error}>{(startSession.error as Error).message}</Text>
          ) : null}
          <Button
            label="Lancer la partie"
            onPress={() => void startSession.mutateAsync(g.id)}
            disabled={g.members.length < 2 || startSession.isPending}
            loading={startSession.isPending}
          />
          {g.members.length < 2 ? <Body muted>Il faut au moins 2 joueurs.</Body> : null}
        </>
      );
    }

    if (s.status === "FINISHED") {
      const winner = s.players.find((p) => p.userId === s.winnerId);
      return (
        <>
          <Body>{winner ? `${winner.pseudo} remporte la partie.` : "Partie terminee."}</Body>
          {isOwner ? (
            <Button
              label="Nouvelle partie"
              onPress={() => void startSession.mutateAsync(g.id)}
              loading={startSession.isPending}
            />
          ) : null}
        </>
      );
    }

    if (roundOpen && round) {
      return <Button label="Ouvrir le round" onPress={() => router.push(`/round/${round.id}`)} />;
    }

    return (
      <>
        {startRound.error ? (
          <Text style={st.error}>{(startRound.error as Error).message}</Text>
        ) : null}
        <Button
          label={round ? "Round suivant" : "Demarrer le premier round"}
          onPress={async () => {
            const res = await startRound.mutateAsync(s.id);
            router.push(`/round/${res.round.id}`);
          }}
          loading={startRound.isPending}
        />
      </>
    );
  }
}

function Lobby({ group }: { group: { members: { id: string; pseudo: string; avatarConfig: any }[] } }) {
  return (
    <Card>
      <Heading>Joueurs ({group.members.length})</Heading>
      {group.members.map((m) => (
        <View key={m.id} style={st.playerRow}>
          <Avatar config={m.avatarConfig} size={36} />
          <Text style={st.playerName}>{m.pseudo}</Text>
        </View>
      ))}
    </Card>
  );
}

function Scoreboard({ session, meId }: { session: SessionView; meId?: string }) {
  const ranked = [...session.players].sort((a, b) => b.points - a.points);
  return (
    <Card>
      <View style={st.header}>
        <Heading>Classement</Heading>
        <Label>Round {session.currentRoundNumber}</Label>
      </View>
      {ranked.map((p) => (
        <View key={p.userId} style={[st.playerRow, p.isEliminated && st.eliminated]}>
          <Avatar config={p.avatarConfig} size={36} />
          <Text style={[st.playerName, p.userId === meId && st.me]}>
            {p.pseudo}
            {p.userId === meId ? " (toi)" : ""}
          </Text>
          {p.isEliminated ? <Pill text="Elimine" tone="bad" /> : null}
          <Text style={st.points}>{p.points}</Text>
        </View>
      ))}
    </Card>
  );
}

function RoundCard({ round }: { round: RoundView }) {
  const waiting = round.participants.filter((p) => !p.hasSubmitted);
  const status =
    round.status === "WRITING"
      ? `${round.bluffeur.pseudo} prepare ses fausses reponses`
      : round.status === "BETTING"
        ? `${waiting.length} joueur${waiting.length > 1 ? "s" : ""} n'ont pas encore mise`
        : "Round termine";

  return (
    <Card>
      <View style={st.header}>
        <Heading>Round {round.number}</Heading>
        <Pill
          text={round.status === "RESOLVED" ? "Termine" : round.status === "WRITING" ? "Ecriture" : "Mises"}
          tone={round.status === "RESOLVED" ? "muted" : "info"}
        />
      </View>
      <Body muted>{status}</Body>
      {round.twist ? <Pill text={`Twist : ${round.twist.label}`} tone="good" /> : null}
      <View style={st.waitingRow}>
        {round.participants.map((p) => (
          <View key={p.user.id} style={{ opacity: p.hasSubmitted ? 1 : 0.35 }}>
            <Avatar config={p.user.avatarConfig} size={28} />
          </View>
        ))}
      </View>
    </Card>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  code: { ...font.heading, color: colors.primary, letterSpacing: 3 },
  playerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  playerName: { ...font.body, color: colors.text, flex: 1 },
  me: { fontWeight: "800" },
  points: { ...font.heading, color: colors.primary },
  eliminated: { opacity: 0.45 },
  waitingRow: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.xs },
  error: { color: colors.danger, fontSize: 14, textAlign: "center" },
});
