import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { DEFAULT_STARTING_POINTS } from "@poire/shared";
import { useCreateGroup, useThemes } from "../../src/api/hooks";
import { useAuth } from "../../src/auth/AuthContext";
import { usePendingSalon } from "../../src/onboarding/PendingSalon";
import { Body, Button, ErrorText, ErrorView, Field, Label, Loading, Screen, Title } from "../../src/components/ui";
import { colors, fonts, radius, spacing } from "../../src/theme";

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
            <ErrorText>{(createGroup.error as Error).message}</ErrorText>
          ) : null}
          <Button
            label={token ? "Créer le salon" : "Continuer"}
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
        <Label>Thématiques</Label>
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
                <Text style={[s.themeCount, active && s.themeCountActive]}>{t.cardCount}</Text>
              </Pressable>
            );
          })}
        </View>
        {/* Une carte n'est servie qu'une fois par salon : le nombre de cartes
            cochees determine directement le nombre de soirees jouables. */}
        <Body muted>
          {totalCards === 0 ? (
            "Coche au moins une thématique."
          ) : (
            <>
              <Text style={s.strong}>{totalCards} cartes disponibles.</Text> Une carte n'est
              jamais rejouée dans ce salon, alors coche large.
            </>
          )}
        </Body>
      </View>

      <Field
        label="Capital de départ"
        value={startingPoints}
        onChangeText={setStartingPoints}
        keyboardType="number-pad"
      />
      {/* Il n'y a plus de budget par carte : on mise tout ce qu'il reste. */}
      <Body muted>
        Chacun démarre avec ce capital et l'engage entièrement à chaque carte.
        Ce qu'on récupère, on le rejoue sur la suivante.
      </Body>
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
  // Couleurs inversees : le creme marque la selection, comme ailleurs dans l'app.
  // Le lisere vert garde la pastille visible sur le fond creme.
  themeActive: { borderColor: colors.surface, backgroundColor: colors.primary },
  themeLabel: { fontFamily: fonts.bodySemi, color: colors.textMuted },
  themeLabelActive: { color: colors.primaryText },
  themeCount: { color: colors.textMuted, fontSize: 12 },
  themeCountActive: { color: colors.primaryText, opacity: 0.6 },
  // Pas de couleur : elle vient du Body englobant, qui l'adapte au fond.
  strong: { fontFamily: fonts.bodyBold },
  row: { flexDirection: "row", gap: spacing.md },
});
