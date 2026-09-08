import { Pressable, StyleSheet, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { useAuth } from "../../src/auth/AuthContext";
import { useGroups } from "../../src/api/hooks";
import { Avatar, Body, Button, Card, ErrorView, Heading, Loading, Screen, Title } from "../../src/components/ui";
import { colors, spacing } from "../../src/theme";

export default function Salons() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { data: groups, isPending, error, refetch } = useGroups();

  if (isPending) return <Loading />;
  if (error) return <ErrorView error={error} onRetry={() => void refetch()} />;

  return (
    <Screen
      footer={
        <>
          <Button label="Creer un salon" onPress={() => router.push("/salons/new")} />
          <Button label="Rejoindre avec un code" variant="ghost" onPress={() => router.push("/salons/join")} />
        </>
      }
    >
      {user ? (
        <View style={s.me}>
          <Avatar avatar={user.avatar} size={48} />
          <View style={{ flex: 1 }}>
            <Title>{user.pseudo}</Title>
          </View>
          <Pressable onPress={() => void signOut()} accessibilityRole="button">
            <Text style={s.signOut}>Se deconnecter</Text>
          </Pressable>
        </View>
      ) : null}

      {groups.length === 0 ? (
        <Card>
          <Heading>Aucun salon</Heading>
          <Body muted>
            Cree un salon et partage son code, ou rejoins celui d'un ami.
          </Body>
        </Card>
      ) : (
        groups.map((group) => (
          <Link key={group.id} href={`/salon/${group.id}`} asChild>
            <Pressable accessibilityRole="button">
              <Card>
                <View style={s.groupHeader}>
                  <Heading>{group.name}</Heading>
                  <Text style={s.code}>{group.code}</Text>
                </View>
                <Body muted>
                  {group.members.length} joueur{group.members.length > 1 ? "s" : ""}
                  {group.activeSessionId ? " · partie en cours" : ""}
                </Body>
                <View style={s.avatars}>
                  {group.members.slice(0, 6).map((m) => (
                    <Avatar key={m.id} avatar={m.avatar} size={30} />
                  ))}
                </View>
              </Card>
            </Pressable>
          </Link>
        ))
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  me: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  signOut: { color: colors.textMuted, fontSize: 13, textDecorationLine: "underline" },
  groupHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  code: { color: colors.primary, fontWeight: "800", letterSpacing: 2 },
  avatars: { flexDirection: "row", gap: spacing.xs },
});
