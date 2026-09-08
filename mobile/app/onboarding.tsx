import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { AvatarConfig } from "@poire/shared";
import { useAuth } from "../src/auth/AuthContext";
import {
  ACCESSORY_EMOJI,
  AVATAR_ACCESSORIES,
  AVATAR_BACKGROUNDS,
  AVATAR_BASES,
  AVATAR_SKINS,
  colorFor,
  emojiFor,
} from "../src/avatars/registry";
import { Avatar, Body, Button, Field, Label, Screen, Title } from "../src/components/ui";
import { colors, radius, spacing } from "../src/theme";

export default function Onboarding() {
  const { signUp } = useAuth();
  const router = useRouter();

  const [pseudo, setPseudo] = useState("");
  const [base, setBase] = useState(AVATAR_BASES[0]!);
  const [background, setBackground] = useState(AVATAR_BACKGROUNDS[0]!);
  const [accessories, setAccessories] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config: AvatarConfig = { base, background, skin: AVATAR_SKINS[0]!, accessories };
  const canSubmit = pseudo.trim().length >= 2 && !submitting;

  const toggleAccessory = (item: string) =>
    setAccessories((current) =>
      current.includes(item)
        ? current.filter((a) => a !== item)
        : current.length >= 3
          ? current
          : [...current, item],
    );

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await signUp(pseudo.trim(), config);
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
        <Avatar config={config} size={104} />
        <View style={s.previewAccessories}>
          {accessories.map((a) => (
            <Text key={a} style={s.accessoryChip}>
              {ACCESSORY_EMOJI[a]}
            </Text>
          ))}
        </View>
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

      <Picker
        label="Animal"
        items={AVATAR_BASES}
        selected={[base]}
        onSelect={setBase}
        render={(item) => <Text style={s.optionEmoji}>{emojiFor(item)}</Text>}
      />

      <Picker
        label="Couleur"
        items={AVATAR_BACKGROUNDS}
        selected={[background]}
        onSelect={setBackground}
        render={(item) => <View style={[s.swatch, { backgroundColor: colorFor(item) }]} />}
      />

      <Picker
        label={`Accessoires (${accessories.length}/3)`}
        items={AVATAR_ACCESSORIES}
        selected={accessories}
        onSelect={toggleAccessory}
        render={(item) => <Text style={s.optionEmoji}>{ACCESSORY_EMOJI[item]}</Text>}
      />
    </Screen>
  );
}

function Picker({
  label,
  items,
  selected,
  onSelect,
  render,
}: {
  label: string;
  items: string[];
  selected: string[];
  onSelect: (item: string) => void;
  render: (item: string) => React.ReactNode;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Label>{label}</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
        {items.map((item) => (
          <Pressable
            key={item}
            accessibilityRole="button"
            accessibilityState={{ selected: selected.includes(item) }}
            onPress={() => onSelect(item)}
            style={[s.option, selected.includes(item) && s.optionSelected]}
          >
            {render(item)}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  preview: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
  previewAccessories: { flexDirection: "row", gap: spacing.xs, minHeight: 24 },
  accessoryChip: { fontSize: 20 },
  row: { gap: spacing.sm, paddingRight: spacing.md },
  option: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  optionSelected: { borderColor: colors.primary },
  optionEmoji: { fontSize: 26 },
  swatch: { width: 30, height: 30, borderRadius: 15 },
  error: { color: colors.danger, fontSize: 14, textAlign: "center" },
});
