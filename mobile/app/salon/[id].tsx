import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { PublicUser, RoundView, SessionView } from "@poire/shared";
import { Appear } from "../../src/components/Appear";
import { useAuth } from "../../src/auth/AuthContext";
import { shareInviteCode } from "../../src/lib/share";
import {
  useDeleteGroup,
  useGroup,
  useLeaveGroup,
  useSession,
  useStartManche,
  useStartSession,
} from "../../src/api/hooks";
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
  const deleteGroup = useDeleteGroup();
  const leaveGroup = useLeaveGroup();
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
                ? "Code copié."
                : outcome === "failed"
                  ? "Partage annulé."
                  : null,
            );
          }}
          style={({ pressed }) => [st.codeChip, pressed && { opacity: 0.7 }]}
        >
          <Text style={st.code}>{g.code}</Text>
          <Text style={st.codeHint}>Partager</Text>
        </Pressable>
      </View>
      <Body muted>{shareNote ?? "Appuie sur le code pour l'envoyer à tes amis."}</Body>

      <Appear index={0}>
        {s ? <Scoreboard session={s} meId={user?.id} /> : <Lobby group={g} />}
      </Appear>

      {round ? (
        <Appear index={1}>
          <RoundCard round={round} cardsTotal={s?.cardsTotal ?? 0} />
        </Appear>
      ) : null}

      {/* Une partie terminee n'est plus « active » : sans ce rappel, le salon
          revient au lobby et le vainqueur n'est plus affiche nulle part. */}
      {!s && g.lastFinishedSessionId ? (
        <Appear index={1}>
          <Button
            label="Voir le dernier classement"
            variant="ghost"
            onPress={() => router.push(`/classement/${g.lastFinishedSessionId}`)}
          />
        </Appear>
      ) : null}

      {leaveGroup.error ? (
        <Text style={st.error}>{(leaveGroup.error as Error).message}</Text>
      ) : null}
      <Button
        label="Quitter le salon"
        variant="ghost"
        onPress={confirmLeave}
        loading={leaveGroup.isPending}
      />

      {isOwner ? (
        <>
          {deleteGroup.error ? (
            <Text style={st.error}>{(deleteGroup.error as Error).message}</Text>
          ) : null}
          <Button
            label="Supprimer le salon"
            variant="danger"
            onPress={confirmDelete}
            loading={deleteGroup.isPending}
          />
        </>
      ) : null}
    </Screen>
  );

  /**
   * Distribue une manche puis ouvre directement notre carte : lancer, c'est
   * pour ecrire, pas pour revenir sur un salon qui attend un second bouton.
   * Les erreurs s'affichent via l'etat des mutations, d'ou le catch muet.
   */
  async function launchManche(sessionId: string) {
    try {
      const { session: next } = await startManche.mutateAsync(sessionId);
      if (next.currentRound) router.push(`/round/${next.currentRound.id}`);
    } catch {}
  }

  async function launchGame() {
    try {
      const { session: next } = await startSession.mutateAsync(g.id);
      await launchManche(next.id);
    } catch {}
  }

  const launching = startSession.isPending || startManche.isPending;
  const launchError = (startSession.error ?? startManche.error) as Error | null;

  function confirmLeave() {
    const leave = () =>
      leaveGroup.mutate(g.id, {
        onSuccess: () => (router.canGoBack() ? router.back() : router.replace("/salons")),
      });
    // On ne demande confirmation que si l'on perd quelque chose : le salon
    // entier, ou la partie en cours. Sinon on revient quand on veut avec le code.
    const last = g.members.every((m) => m.id === user?.id);
    const playing = Boolean(s && s.status !== "FINISHED");
    if (!last && !playing) return leave();

    const lines = [
      playing ? "Tu abandonnes la partie en cours." : null,
      last ? "Tu es le dernier membre : le salon sera supprimé." : null,
    ].filter(Boolean);
    Alert.alert("Quitter le salon ?", lines.join(" "), [
      { text: "Annuler", style: "cancel" },
      { text: "Quitter", style: "destructive", onPress: leave },
    ]);
  }

  function confirmDelete() {
    const playing = s && s.status !== "FINISHED";
    Alert.alert(
      "Supprimer le salon ?",
      playing
        ? "La partie en cours sera perdue pour tout le monde. Pense à prévenir les autres joueurs."
        : "Le salon et son historique disparaîtront pour tous les joueurs.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () =>
            // Retour arriere plutot que replace : le salon est ouvert depuis la
            // liste, la remplacer empilerait une seconde liste avec un chevron.
            deleteGroup.mutate(g.id, {
              onSuccess: () => (router.canGoBack() ? router.back() : router.replace("/salons")),
            }),
        },
      ],
    );
  }

  function Footer() {
    if (!s) {
      if (!isOwner) return <Body muted>En attente que l'hôte lance la partie.</Body>;
      return (
        <>
          {launchError ? <Text style={st.error}>{launchError.message}</Text> : null}
          <Button
            label="Lancer la partie"
            onPress={() => void launchGame()}
            disabled={g.members.length < 2 || launching}
            loading={launching}
          />
          {g.members.length < 2 ? <Body muted>Il faut au moins 2 joueurs.</Body> : null}
        </>
      );
    }

    if (s.status === "FINISHED") {
      const winner = s.players.find((p) => p.userId === s.winnerId);
      return (
        <>
          <Body>{winner ? `${winner.pseudo} remporte la partie.` : "Partie terminée."}</Body>
          {launchError ? <Text style={st.error}>{launchError.message}</Text> : null}
          {isOwner ? (
            <Button label="Nouvelle partie" onPress={() => void launchGame()} loading={launching} />
          ) : null}
        </>
      );
    }

    if (roundOpen && round) {
      // Pendant l'ecriture, la carte affichee n'est la notre que s'il nous
      // reste a l'ecrire : une fois nos mensonges envoyes, c'est celle d'un
      // retardataire, et promettre « Ecrire » menerait a un ecran d'attente.
      const toWrite =
        round.myRole === "BLUFFEUR" &&
        !round.participants.find((p) => p.user.id === user?.id)?.hasSubmitted;
      const label =
        round.status === "WRITING"
          ? toWrite
            ? "Écrire mes mensonges"
            : "Voir qui écrit encore"
          : round.status === "BETTING"
            ? round.myRole === "BLUFFEUR"
              ? "Suivre les mises"
              : "Miser"
            : "Ouvrir la carte";
      return <Button label={label} onPress={() => router.push(`/round/${round.id}`)} />;
    }

    return (
      <>
        {startManche.error ? (
          <Text style={st.error}>{(startManche.error as Error).message}</Text>
        ) : null}
        <Button
          label={s.manche > 0 ? "Manche suivante" : "Lancer la première manche"}
          onPress={() => void launchManche(s.id)}
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
          {p.isEliminated ? <Pill text="Éliminé" tone="bad" /> : null}
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
    WRITING: "Écriture",
    PENDING: "En attente",
    BETTING: "Mises",
    RESOLVED: "Terminé",
    CANCELLED: "Annulé",
  };
  const status =
    round.status === "WRITING"
      ? "Tout le monde écrit ses mensonges"
      : round.status === "PENDING"
        ? "Cette carte attend son tour"
        : round.status === "BETTING"
        ? waiting.length === 1
          ? "1 joueur n'a pas encore misé"
          : `${waiting.length} joueurs n'ont pas encore misé`
        : round.status === "CANCELLED"
          ? `Round annulé : ${round.bluffeur.pseudo} n'a pas répondu à temps`
          : "Round terminé";

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
