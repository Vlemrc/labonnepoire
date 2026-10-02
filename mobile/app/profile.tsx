import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { PSEUDO_MAX_LENGTH, PSEUDO_MIN_LENGTH, type GroupSummary } from "@poire/shared";
import { api } from "../src/api/client";
import { useAuth } from "../src/auth/AuthContext";
import { usePendingSalon } from "../src/onboarding/PendingSalon";
import { AVATAR_IDS, AVATAR_LABELS, DEFAULT_AVATAR, type AvatarId } from "../src/avatars/registry";
import { Avatar, Body, Button, ErrorText, Field, Label, Screen, Title } from "../src/components/ui";
import { colors, fonts, radius, spacing } from "../src/theme";

/**
 * Dernier ecran avant d'entrer dans le salon : pseudo et avatar.
 *
 * C'est ici que tout part en une fois — creation du compte, puis creation ou
 * adhesion au salon — avec le token retourne par signUp plutot que celui du
 * contexte, qui n'est pas encore propage a ce stade du rendu.
 */
export default function Profile() {
  const router = useRouter();
  const { signUp } = useAuth();
  const { pending, setPending } = usePendingSalon();
  const queryClient = useQueryClient();

  const [pseudo, setPseudo] = useState("");
  const [avatar, setAvatar] = useState<AvatarId>(DEFAULT_AVATAR);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = pseudo.trim().length >= PSEUDO_MIN_LENGTH && !submitting && pending !== null;

  async function submit() {
    if (!pending) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await signUp(pseudo.trim(), avatar);
      const group =
        pending.kind === "create"
          ? await api<{ group: GroupSummary }>("/groups", {
              method: "POST",
              token,
              body: {
                name: pending.name,
                themes: pending.themes,
                startingPoints: pending.startingPoints,
              },
            })
          : await api<{ group: GroupSummary }>("/groups/join", {
              method: "POST",
              token,
              body: { code: pending.code },
            });

      setPending(null);
      void queryClient.invalidateQueries({ queryKey: ["groups"] });
      router.replace(`/salon/${group.group.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de terminer l'inscription.");
      setSubmitting(false);
    }
  }

  // Arrivee directe sans intention (rechargement de l'app en plein flux).
  if (!pending) {
    return (
      <Screen footer={<Button label="Retour" onPress={() => router.replace("/welcome")} />}>
        <Title>Reprenons du début</Title>
        <Body muted>Choisis d'abord un salon à créer ou à rejoindre.</Body>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <>
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button
            label={pending.kind === "create" ? "Créer le salon" : "Rejoindre le salon"}
            onPress={submit}
            disabled={!canSubmit}
            loading={submitting}
          />
        </>
      }
    >
      <Title>Qui es-tu ?</Title>
      <Body muted>
        {pending.kind === "create"
          ? `Encore une étape avant d'ouvrir « ${pending.name} ».`
          : `Encore une étape avant de rejoindre le salon ${pending.code}.`}
      </Body>

      <View style={s.preview}>
        <Avatar avatar={avatar} size={120} />
        {/* Apercu de l'identite telle que les autres la verront : le pseudo
            s'ecrit ici a mesure qu'on le tape, pas le nom de la vignette. */}
        <Text style={[s.previewName, !pseudo.trim() && s.previewNamePlaceholder]}>
          {pseudo.trim() || "Ton pseudo"}
        </Text>
      </View>

      <Field
        label="Pseudo"
        value={pseudo}
        onChangeText={setPseudo}
        placeholder="Ton pseudo"
        maxLength={PSEUDO_MAX_LENGTH}
        autoCapitalize="words"
        autoCorrect={false}
      />

      <View style={{ gap: spacing.sm }}>
        <Label>Avatar</Label>
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
  previewName: {
    fontFamily: fonts.display,
    fontSize: 26,
    letterSpacing: -0.5,
    color: colors.ink,
    textAlign: "center",
  },
  previewNamePlaceholder: { color: colors.inkMuted, opacity: 0.6 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  option: {
    padding: 4,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.secondary, backgroundColor: colors.surfaceHigh },
});
