import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { BetInput, RoundView } from "@poire/shared";
import { useSubmitBets } from "../api/hooks";
import { Body, Button, Card, Heading, Label, Pill, Screen, Title } from "../components/ui";
import { Deadline } from "../components/Deadline";
import { colors, fonts, radius, spacing, sticker } from "../theme";

const NONE_KEY = "__none__";

/**
 * Ecran du parieur : repartir son budget entre les propositions.
 *
 * Le backend exige que la totalite du budget soit engagee (une mise partielle
 * serait une option sans risque). L'ecran refuse donc l'envoi tant qu'il reste
 * des jetons, et affiche en permanence ce qu'il reste a placer.
 */
export function BetScreen({ round, budget }: { round: RoundView; budget: number }) {
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const submit = useSubmitBets(round.id);

  const placed = useMemo(
    () => Object.values(amounts).reduce((sum, n) => sum + n, 0),
    [amounts],
  );
  const remaining = budget - placed;

  const change = (key: string, delta: number) =>
    setAmounts((current) => {
      const next = Math.max(0, (current[key] ?? 0) + delta);
      if (delta > 0 && remaining <= 0) return current;
      return { ...current, [key]: next };
    });

  const options = [
    ...(round.answers ?? []).map((a) => ({ key: a.id, text: a.text, isNone: false })),
    ...(round.allowNoneOption
      ? [{ key: NONE_KEY, text: "Aucune de ces reponses", isNone: true }]
      : []),
  ];

  async function send() {
    const bets: BetInput[] = Object.entries(amounts)
      .filter(([, amount]) => amount > 0)
      .map(([key, amount]) =>
        key === NONE_KEY
          ? { answerId: null, isNoneOption: true, amount }
          : { answerId: key, isNoneOption: false, amount },
      );
    await submit.mutateAsync(bets);
  }

  return (
    <Screen
      footer={
        <>
          {submit.error ? <Text style={s.error}>{(submit.error as Error).message}</Text> : null}
          <Button
            label={remaining > 0 ? `Encore ${remaining} jeton${remaining > 1 ? "s" : ""}` : "Valider mes mises"}
            onPress={() => void send()}
            disabled={remaining !== 0 || submit.isPending}
            loading={submit.isPending}
          />
        </>
      }
    >
      <View style={s.header}>
        <View style={{ gap: spacing.xs }}>
          <Title>Ou tu mises ?</Title>
          <Deadline deadlineAt={round.deadlineAt} />
        </View>
        <View style={s.budget}>
          <Text style={s.budgetValue}>{remaining}</Text>
          <Label>restants</Label>
        </View>
      </View>

      {round.twist ? (
        <Card style={{ borderColor: colors.secondary }}>
          <Pill text={`Twist : ${round.twist.label}`} tone="secondary" />
          <Body muted>{round.twist.description}</Body>
        </Card>
      ) : null}

      <Body muted>
        Repartis tes {budget} jetons comme tu veux. Ceux poses sur la vraie
        reponse te reviennent, les autres partent chez celui qui a menti. Si tu
        laisses passer le delai, tu les perds tous.
      </Body>

      {options.map((option, index) => {
        const amount = amounts[option.key] ?? 0;
        return (
          <View
            key={option.key}
            // Les propositions sont posees de travers, comme des cartes jetees
            // sur une table. L'angle alterne pour qu'aucune ne semble alignee.
            style={{ transform: [{ rotate: `${(index % 2 === 0 ? -1 : 1) * 1.1}deg` }] }}
          >
          <Card style={amount > 0 ? { borderColor: colors.secondary } : undefined}>
            <View style={s.optionHead}>
              <View style={[s.index, amount > 0 && s.indexActive]}>
                <Text style={[s.indexText, amount > 0 && s.indexTextActive]}>
                  {option.isNone ? "?" : index + 1}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                {option.isNone ? <Label>Pari risque</Label> : null}
                <Heading>{option.text}</Heading>
              </View>
            </View>
            <View style={s.stepper}>
              <StepperButton label="−" onPress={() => change(option.key, -1)} disabled={amount === 0} />
              <Text style={s.amount}>{amount}</Text>
              <StepperButton
                label="+"
                onPress={() => change(option.key, 1)}
                disabled={remaining === 0}
              />
              <View style={{ flex: 1 }} />
              {amount > 0 && remaining > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => change(option.key, remaining)}
                >
                  <Text style={s.allIn}>Tout ici</Text>
                </Pressable>
              ) : null}
            </View>
          </Card>
          </View>
        );
      })}
    </Screen>
  );
}

function StepperButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === "+" ? "Ajouter un jeton" : "Retirer un jeton"}
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [s.step, disabled && s.stepDisabled, pressed && !disabled && { opacity: 0.7 }]}
    >
      <Text style={s.stepLabel}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  budget: { alignItems: "center" },
  budgetValue: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 42,
    color: colors.primary,
  },
  optionHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  index: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  indexActive: { borderColor: colors.secondary, backgroundColor: colors.secondary },
  indexText: { fontFamily: fonts.display, fontSize: 16, color: colors.textMuted },
  indexTextActive: { color: colors.surface },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.xs },
  step: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    ...sticker,
  },
  stepDisabled: { opacity: 0.3 },
  stepLabel: { fontFamily: fonts.display, fontSize: 22, color: colors.text, lineHeight: 26 },
  amount: { fontFamily: fonts.display, fontSize: 24, color: colors.text, minWidth: 34, textAlign: "center" },
  allIn: { color: colors.textMuted, fontSize: 13, textDecorationLine: "underline" },
  error: { color: colors.danger, fontSize: 14, textAlign: "center" },
});
