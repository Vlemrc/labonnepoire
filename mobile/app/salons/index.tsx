import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Link, Stack, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useAuth } from "../../src/auth/AuthContext";
import { useGroups } from "../../src/api/hooks";
import { Appear } from "../../src/components/Appear";
import { Avatar, Body, Button, Card, ErrorView, Heading, Loading, Screen, Title } from "../../src/components/ui";
import { colors, font, spacing } from "../../src/theme";

export default function Salons() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { data: groups, isPending, error, refetch } = useGroups();

  // On ne s'est jamais vraiment connecte : pas de mot de passe, juste un
  // pseudo. Partir efface pourtant le seul acces a ce pseudo et a ses salons,
  // et une icone se touche vite par megarde, d'ou la confirmation.
  async function leave() {
    try {
      await signOut();
    } catch (e) {
      Alert.alert(
        "Impossible de partir",
        `${e instanceof Error ? e.message : "Une erreur est survenue."} Réessaie dans un instant.`,
      );
    }
  }

  function confirmLeave() {
    Alert.alert(
      "Partir ?",
      "Tu perdras ton pseudo et tes salons sur cet appareil.",
      [
        { text: "Rester", style: "cancel" },
        { text: "Partir", style: "destructive", onPress: () => void leave() },
      ],
    );
  }

  if (isPending) return <Loading />;
  if (error) return <ErrorView error={error} onRetry={() => void refetch()} />;

  return (
    <Screen
      footer={
        <>
          <Button label="Créer un salon" onPress={() => router.push("/salons/new")} />
          <Button label="Rejoindre avec un code" variant="ghost" onPress={() => router.push("/salons/join")} />
        </>
      }
    >
      <Stack.Screen options={{ headerRight: () => <SignOutButton onPress={confirmLeave} /> }} />

      {user ? (
        <View style={s.me}>
          <Avatar avatar={user.avatar} size={48} />
          <View style={{ flex: 1 }}>
            <Title>{user.pseudo}</Title>
          </View>
        </View>
      ) : null}

      {groups.length === 0 ? (
        // Pas de carte ici : encadre, le message passait pour un bouton. Pose a
        // meme le fond et centre sur tout l'ecran, il se lit comme un etat vide.
        <View style={s.empty} pointerEvents="none">
          <Heading>Aucun salon</Heading>
          <Text style={s.emptyText}>
            Crée un salon et partage son code, ou rejoins celui d'un ami.
          </Text>
        </View>
      ) : (
        groups.map((group, i) => (
          <Appear key={group.id} index={i}>
          <Link href={`/salon/${group.id}`} asChild>
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
          </Appear>
        ))
      )}
    </Screen>
  );
}

function SignOutButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Partir"
      hitSlop={8}
      style={({ pressed }) => [s.headerIcon, pressed && { opacity: 0.6 }]}
    >
      <SymbolView
        name="rectangle.portrait.and.arrow.right"
        tintColor={colors.ink}
        size={20}
        weight="semibold"
        // SF Symbols n'existe que sur iOS : ailleurs, une fleche suffit.
        fallback={<Text style={s.headerFallback}>⎋</Text>}
      />
    </Pressable>
  );
}

const s = StyleSheet.create({
  me: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerFallback: { color: colors.ink, fontSize: 20 },
  groupHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  code: { ...font.mono, fontSize: 15, color: colors.secondary },
  avatars: { flexDirection: "row", gap: spacing.xs },
  empty: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
  },
  emptyText: { ...font.body, fontSize: 16, lineHeight: 23, color: colors.inkMuted, textAlign: "center" },
});
