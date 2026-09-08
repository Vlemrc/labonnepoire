import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { DEFAULT_STAKE_BUDGET, DEFAULT_STARTING_POINTS } from "@poire/shared";
import { useCreateGroup, useThemes } from "../../src/api/hooks";
import { useAuth } from "../../src/auth/AuthContext";
import { usePendingSalon } from "../../src/onboarding/PendingSalon";
import { Body, Button, ErrorView, Field, Label, Loading, Screen, Title } from "../../src/components/ui";
import { colors, radius, spacing } from "../../src/theme";

const THEME_LABELS: Record<string, string> = {
  animaux: "Animaux",
  insolite: "Insolite",
  histoire: "Histoire",
  "mots-et-langues": "Mots & langues",
  "lois-et-traditions": "Lois & traditions",
};

export default function NewSalon() {
  const router = useRouter();
  const { data: themes, isPending, error, refetch } = useThemes();
  const createGroup = useCreateGroup();
  const { token } = useAuth();
  const { setPending } = usePendingSalon();

  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [startingPoints, setStartingPoints] = useState(String(DEFAULT_STARTING_POINTS));
  const [stakeBudget, setStakeBudget] = useState(String(DEFAULT_STAKE_BUDGET));

  if (isPending) return <Loading />;
  if (error) return <ErrorView error={error} onRetry={() => void refetch()} />;

  const totalCards = themes
    .filter((t) => selected.includes(t.theme))
    .reduce((sum, t) => sum + t.cardCount, 0);
  const canSubmit = name.trim().length >= 2 && selected.length > 0 && !createGroup.isPending;

  async function submit() {
    const settings = {
      name: name.trim(),
      themes: selected,
      startingPoints: Number(startingPoints) || DEFAULT_STARTING_POINTS,
      stakeBudget: Number(stakeBudget) || DEFAULT_STAKE_BUDGET,
    };

    // Pas encore de compte : on retient le choix et on demande le profil. Le
    // salon ne sera cree qu'apres, en meme temps que le compte.
    if (!token) {
      setPending({ kind: "create", ...settings });
      router.push("/profile");
      return;
    }

    const group = await createGroup.mutateAsync(settings);
    router.replace(`/salon/${group.group.id}`);
  }

  return (
    <Screen
      footer={
        <>
          {createGroup.error ? (
            <Text style={s.error}>{(createGroup.error as Error).message}</Text>
          ) : null}
          <Button
            label={token ? "Creer le salon" : "Continuer"}
            onPress={() => void submit()}
            disabled={!canSubmit}
            loading={createGroup.isPending}
          />
        </>
      }
    >
      <Title>Nouveau salon</Title>
      <Field label="Nom" value={name} onChangeText={setName} placeholder="Les copains" maxLength={40} />

      <View style={{ gap: spacing.sm }}>
        <Label>Thematiques</Label>
        <View style={s.themes}>
          {themes.map((t) => {
            const active = selected.includes(t.theme);
            return (
              <Pressable
                key={t.theme}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() =>
                  setSelected((c) => (active ? c.filter((x) => x !== t.theme) : [...c, t.theme]))
                }
                style={[s.theme, active && s.themeActive]}
              >
                <Text style={[s.themeLabel, active && s.themeLabelActive]}>
                  {THEME_LABELS[t.theme] ?? t.theme}
                </Text>
                <Text style={s.themeCount}>{t.cardCount}</Text>
              </Pressable>
            );
          })}
        </View>
        {/* Une carte n'est servie qu'une fois par salon : le nombre de cartes
            cochees determine directement le nombre de soirees jouables. */}
        <Body muted>
          {totalCards === 0
            ? "Coche au moins une thematique."
            : `${totalCards} cartes disponibles. Une carte n'est jamais rejouee dans ce salon, alors coche large.`}
        </Body>
      </View>

      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Field
            label="Capital de depart"
            value={startingPoints}
            onChangeText={setStartingPoints}
            keyboardType="number-pad"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Jetons par round"
            value={stakeBudget}
            onChangeText={setStakeBudget}
            keyboardType="number-pad"
          />
        </View>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  themes: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  theme: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  themeActive: { borderColor: colors.primary, backgroundColor: colors.surfaceHigh },
  themeLabel: { color: colors.textMuted, fontWeight: "600" },
  themeLabelActive: { color: colors.text },
  themeCount: { color: colors.textMuted, fontSize: 12 },
  row: { flexDirection: "row", gap: spacing.md },
  error: { color: colors.danger, fontSize: 14, textAlign: "center" },
});
