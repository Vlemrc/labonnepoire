import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { BetInput, RoundView } from "@poire/shared";
import { useSubmitBets } from "../api/hooks";
import { Appear } from "../components/Appear";
import { Body, Button, Card, ErrorText, Heading, Label, Pill, Screen, Title } from "../components/ui";
import { Deadline } from "../components/Deadline";
import { QuestionCard } from "../components/QuestionCard";
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
      ? [{ key: NONE_KEY, text: "Aucune de ces réponses", isNone: true }]
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
          {submit.error ? <ErrorText>{(submit.error as Error).message}</ErrorText> : null}
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
          <Title>Mise !</Title>
          <Deadline deadlineAt={round.deadlineAt} />
        </View>
        <View style={s.budget}>
          <Text style={s.budgetValue}>{remaining}</Text>
          <Label>{remaining > 1 ? "points restants" : "point restant"}</Label>
        </View>
      </View>

      <Appear index={0}>
        <QuestionCard question={round.question} />
      </Appear>

      {round.twist ? (
        <Card style={{ borderColor: colors.secondary }}>
          <Pill text={`Twist : ${round.twist.label}`} tone="secondary" />
          <Body muted>{round.twist.description}</Body>
        </Card>
      ) : null}

      <Body muted>
        Tu engages la totalité de ton capital : {budget} jetons. Ceux posés sur
        la vraie réponse te reviennent et repartent sur la carte suivante, les
        autres sont perdus.
      </Body>

      {options.map((option, index) => {
        const amount = amounts[option.key] ?? 0;
        return (
          <Appear
            key={option.key}
            index={index + 1}
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
                {option.isNone ? <Label>Pari risqué</Label> : null}
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
              {/* Le budget est le capital entier : il peut depasser la
                  cinquantaine, et un pas de 1 rendrait l'ecran inutilisable. */}
              <StepperButton
                label="+5"
                small
                onPress={() => change(option.key, Math.min(5, remaining))}
                disabled={remaining === 0}
              />
              <View style={{ flex: 1 }} />
              {remaining > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Tout miser sur ${option.text}`}
                  onPress={() => change(option.key, remaining)}
                  style={({ pressed }) => [s.step, s.stepWide, pressed && { opacity: 0.7 }]}
                >
                  <Text style={[s.stepLabel, s.stepLabelSmall]}>All in</Text>
                </Pressable>
              ) : null}
            </View>
          </Card>
          </Appear>
        );
      })}
    </Screen>
  );
}

function StepperButton({
  label,
  onPress,
  disabled,
  small,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  small?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === "+" ? "Ajouter un jeton" : "Retirer un jeton"}
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [s.step, small && s.stepSmall, disabled && s.stepDisabled, pressed && !disabled && { opacity: 0.7 }]}
    >
      <Text style={[s.stepLabel, small && s.stepLabelSmall]}>{label}</Text>
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
    color: colors.ink,
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
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
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
  // Meme hauteur pour tous les boutons de la rangee : seule la largeur suit le libelle.
  stepSmall: { width: 56 },
  stepWide: { width: "auto", paddingHorizontal: spacing.md },
  stepDisabled: { opacity: 0.3 },
  stepLabel: { fontFamily: fonts.display, fontSize: 22, color: colors.text, lineHeight: 26 },
  stepLabelSmall: { fontSize: 15, lineHeight: 18 },
  amount: { fontFamily: fonts.display, fontSize: 24, color: colors.text, minWidth: 34, textAlign: "center" },
});
