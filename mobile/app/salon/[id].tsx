import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { PublicUser, RoundView, SessionView } from "@poire/shared";
import { Appear } from "../../src/components/Appear";
import { useAuth } from "../../src/auth/AuthContext";
import { shareInviteCode } from "../../src/lib/share";
import { useGroup, useSession, useStartManche, useStartSession } from "../../src/api/hooks";
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
import { colors, font, fonts, spacing, sticker } from "../../src/theme";

export default function Salon() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const group = useGroup(id);
  const session = useSession(group.data?.activeSessionId ?? undefined);
  const startSession = useStartSession();
  const startManche = useStartManche();
  const [shareNote, setShareNote] = useState<string | null>(null);

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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Partager le code ${g.code}`}
          onPress={async () => {
            const outcome = await shareInviteCode(g.code, g.name);
            setShareNote(
              outcome === "copied"
                ? "Code copie."
                : outcome === "failed"
                  ? "Partage annule."
                  : null,
            );
          }}
          style={({ pressed }) => [st.codeChip, pressed && { opacity: 0.7 }]}
        >
          <Text style={st.code}>{g.code}</Text>
          <Text style={st.codeHint}>Partager</Text>
        </Pressable>
      </View>
      <Body muted>{shareNote ?? "Appuie sur le code pour l'envoyer a tes amis."}</Body>

      <Appear index={0}>
        {s ? <Scoreboard session={s} meId={user?.id} /> : <Lobby group={g} />}
      </Appear>

      {round ? (
        <Appear index={1}>
          <RoundCard round={round} cardsTotal={s?.cardsTotal ?? 0} />
        </Appear>
      ) : null}
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
      const label =
        round.status === "WRITING"
          ? "Ecrire mes mensonges"
          : round.status === "BETTING"
            ? "Miser"
            : "Ouvrir la carte";
      return <Button label={label} onPress={() => router.push(`/round/${round.id}`)} />;
    }

    return (
      <>
        {startManche.error ? (
          <Text style={st.error}>{(startManche.error as Error).message}</Text>
        ) : null}
        <Button
          label={s.manche > 0 ? "Manche suivante" : "Lancer la premiere manche"}
          onPress={() => void startManche.mutateAsync(s.id)}
          loading={startManche.isPending}
        />
      </>
    );
  }
}

function Lobby({ group }: { group: { members: PublicUser[] } }) {
  return (
    <Card>
      <Heading>Joueurs ({group.members.length})</Heading>
      {group.members.map((m) => (
        <View key={m.id} style={st.playerRow}>
          <Avatar avatar={m.avatar} size={36} />
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
        <Label>Manche {session.manche}</Label>
      </View>
      {ranked.map((p) => (
        <View key={p.userId} style={[st.playerRow, p.isEliminated && st.eliminated]}>
          <Avatar avatar={p.avatar} size={36} />
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

function RoundCard({ round, cardsTotal }: { round: RoundView; cardsTotal: number }) {
  const waiting = round.participants.filter((p) => !p.hasSubmitted);
  // CANCELLED a longtemps ete traite comme un « autre » cas et affichait
  // « Mises » : chaque statut est desormais nomme explicitement.
  const LABELS: Record<RoundView["status"], string> = {
    WRITING: "Ecriture",
    PENDING: "En attente",
    BETTING: "Mises",
    RESOLVED: "Termine",
    CANCELLED: "Annule",
  };
  const status =
    round.status === "WRITING"
      ? "Tout le monde ecrit ses mensonges"
      : round.status === "PENDING"
        ? "Cette carte attend son tour"
        : round.status === "BETTING"
        ? waiting.length === 1
          ? "1 joueur n'a pas encore mise"
          : `${waiting.length} joueurs n'ont pas encore mise`
        : round.status === "CANCELLED"
          ? `Round annule : ${round.bluffeur.pseudo} n'a pas repondu a temps`
          : "Round termine";

  return (
    <Card>
      <View style={st.header}>
        <Heading>
          Carte {round.number} / {cardsTotal}
        </Heading>
        <Pill
          text={LABELS[round.status]}
          tone={
            round.status === "CANCELLED"
              ? "bad"
              : round.status === "RESOLVED"
                ? "muted"
                : "primary"
          }
        />
      </View>
      <Body muted>{status}</Body>
      {round.twist ? <Pill text={`Twist : ${round.twist.label}`} tone="secondary" /> : null}
      <View style={st.waitingRow}>
        {round.participants.map((p) => (
          <View key={p.user.id} style={{ opacity: p.hasSubmitted ? 1 : 0.35 }}>
            <Avatar avatar={p.user.avatar} size={28} />
          </View>
        ))}
      </View>
    </Card>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  // Tampon de travers : le code doit avoir l'air pose a la main sur le salon.
  codeChip: {
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.secondary,
    backgroundColor: colors.surface,
    transform: [{ rotate: "-2.5deg" }],
    ...sticker,
  },
  code: { ...font.mono, fontSize: 22, color: colors.secondary },
  codeHint: {
    fontFamily: fonts.display,
    fontSize: 10,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  playerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  playerName: { ...font.body, color: colors.text, flex: 1 },
  me: { fontFamily: fonts.bodyBold },
  points: { ...font.heading, color: colors.secondary },
  eliminated: { opacity: 0.45 },
  waitingRow: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.xs },
  error: { color: colors.danger, fontSize: 14, textAlign: "center" },
});
