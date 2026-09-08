import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/auth/AuthContext";
import { AVATAR_IDS, AVATAR_LABELS, DEFAULT_AVATAR, type AvatarId } from "../src/avatars/registry";
import { Avatar, Body, Button, Field, Label, Screen, Title } from "../src/components/ui";
import { colors, radius, spacing } from "../src/theme";

export default function Onboarding() {
  const { signUp } = useAuth();
  const router = useRouter();

  const [pseudo, setPseudo] = useState("");
  const [avatar, setAvatar] = useState<AvatarId>(DEFAULT_AVATAR);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = pseudo.trim().length >= 2 && !submitting;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await signUp(pseudo.trim(), avatar);
      router.replace("/salons");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de creer le compte.");
      setSubmitting(false);
    }
  }

  return (
    <Screen
      footer={
        <>
          {error ? <Text style={s.error}>{error}</Text> : null}
          <Button label="C'est parti" onPress={submit} disabled={!canSubmit} loading={submitting} />
        </>
      }
    >
      <Title>Bienvenue</Title>
      <Body muted>Choisis un pseudo et une tete. Tu pourras les changer plus tard.</Body>

      <View style={s.preview}>
        <Avatar avatar={avatar} size={120} />
        <Text style={s.previewName}>{AVATAR_LABELS[avatar]}</Text>
      </View>

      <Field
        label="Pseudo"
        value={pseudo}
        onChangeText={setPseudo}
        placeholder="Ton pseudo"
        maxLength={20}
        autoCapitalize="words"
        autoCorrect={false}
      />

      <View style={{ gap: spacing.sm }}>
        <Label>Avatar</Label>
        {/* Grille plutot qu'un carrousel horizontal : tout le catalogue tient a
            l'ecran, on choisit sans avoir a deviner qu'il faut faire defiler. */}
        <View style={s.grid}>
          {AVATAR_IDS.map((id) => (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityLabel={AVATAR_LABELS[id]}
              accessibilityState={{ selected: id === avatar }}
              onPress={() => setAvatar(id)}
              style={[s.option, id === avatar && s.optionSelected]}
            >
              <Avatar avatar={id} size={60} />
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  preview: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
  previewName: { ...{ fontSize: 15, fontWeight: "700" }, color: colors.textMuted },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  option: {
    padding: 4,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.surfaceHigh },
  error: { color: colors.danger, fontSize: 14, textAlign: "center" },
});
