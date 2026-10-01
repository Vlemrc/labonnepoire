import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { rankPlayers, type SessionPlayerView } from "@poire/shared";
import { useAuth } from "../../src/auth/AuthContext";
import { useSession } from "../../src/api/hooks";
import { Appear } from "../../src/components/Appear";
import { Avatar, Body, Button, Card, ErrorView, Heading, Loading, Pill, Screen, Title } from "../../src/components/ui";
import { colors, fonts, radius, spacing } from "../../src/theme";

/**
 * Fin de partie : le vainqueur, puis les perdants du dernier elimine au
 * premier. Deux joueurs tombes sur la meme carte partagent leur rang.
 */
export default function Classement() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const session = useSession(id);

  if (session.isPending) return <Loading />;
  if (session.error) return <ErrorView error={session.error} onRetry={() => void session.refetch()} />;

  const s = session.data;
  const ranking = rankPlayers(s.players, s.winnerId);
  const winner = ranking.find((r) => r.player.userId === s.winnerId)?.player ?? null;
  const losers = ranking.filter((r) => r.player.userId !== s.winnerId);
  const iWon = winner?.userId === user?.id;

  return (
    <Screen
      footer={
        <Button
          label="Retour au salon"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace(`/salon/${s.groupId}`)
          }
        />
      }
    >
      <Title>Partie terminée</Title>

      <Appear index={0}>
        {winner ? (
          <Card style={s_.winnerCard}>
            {/* La pastille s'aligne a gauche d'elle-meme : on la recentre. */}
            <View style={{ alignSelf: "center" }}>
              <Pill text={iWon ? "Tu gagnes" : "Vainqueur"} tone="good" />
            </View>
            <Avatar avatar={winner.avatar} size={96} />
            <Text style={s_.winnerName}>{winner.pseudo}</Text>
            <Body muted>
              {winner.points} point{winner.points > 1 ? "s" : ""} en poche, dernier en jeu.
            </Body>
          </Card>
        ) : (
          <Card>
            <Heading>Personne ne l'emporte</Heading>
            <Body muted>Les derniers joueurs sont tombés sur la même carte.</Body>
          </Card>
        )}
      </Appear>

      {losers.length > 0 ? (
        <Appear index={1} style={{ gap: spacing.sm }}>
          <Heading>Classement</Heading>
          <Card>
            {losers.map(({ player, rank }) => (
              <View key={player.userId} style={s_.row}>
                <View style={s_.rank}>
                  <Text style={s_.rankText}>{rank}</Text>
                </View>
                <Avatar avatar={player.avatar} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={[s_.name, player.userId === user?.id && s_.me]}>
                    {player.pseudo}
                    {player.userId === user?.id ? " (toi)" : ""}
                  </Text>
                  <Text style={s_.detail}>
                    {eliminationLabel(player)}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        </Appear>
      ) : null}
    </Screen>
  );
}

/** Manche et carte fatales : c'est ce qui rend l'ordre des perdants lisible. */
function eliminationLabel(player: SessionPlayerView): string {
  if (player.eliminatedManche && player.eliminatedCard) {
    return `Éliminé à la manche ${player.eliminatedManche}, carte ${player.eliminatedCard}`;
  }
  if (player.eliminatedManche) return `A quitté la partie à la manche ${player.eliminatedManche}`;
  return player.isEliminated ? "Éliminé" : `${player.points} points`;
}

const s_ = StyleSheet.create({
  winnerCard: { alignItems: "center", gap: spacing.sm, borderColor: colors.success, paddingVertical: spacing.lg },
  winnerName: { fontFamily: fonts.display, fontSize: 34, color: colors.text },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rank: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { fontFamily: fonts.display, fontSize: 15, color: colors.text },
  name: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text },
  me: { fontFamily: fonts.display },
  detail: { color: colors.textMuted, fontSize: 13 },
});
