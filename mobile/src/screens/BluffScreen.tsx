import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { RoundView } from "@poire/shared";
import { useSubmitAnswers } from "../api/hooks";
import { Body, Button, Card, Field, Heading, Label, Pill, Screen, Title } from "../components/ui";
import { colors, spacing } from "../theme";

/**
 * Ecran du bluffeur : il voit la carte, vraie reponse comprise, et invente les
 * fausses. En mode FULL_BLUFF il en ecrit trois et la vraie reponse ne sera pas
 * proposee — c'est le seul joueur a le savoir.
 */
export function BluffScreen({ round }: { round: RoundView }) {
  const fullBluff = round.mode === "FULL_BLUFF";
  const expected = fullBluff ? 3 : 2;
  const [answers, setAnswers] = useState<string[]>(Array(expected).fill(""));
  const submit = useSubmitAnswers(round.id);

  const filled = answers.map((a) => a.trim()).filter(Boolean);
  const canSubmit = filled.length === expected && !submit.isPending;

  return (
    <Screen
      footer={
        <>
          {submit.error ? <Text style={s.error}>{(submit.error as Error).message}</Text> : null}
          <Button
            label="Envoyer mes mensonges"
            onPress={() => void submit.mutateAsync(answers.map((a) => a.trim()))}
            disabled={!canSubmit}
            loading={submit.isPending}
          />
        </>
      }
    >
      <Title>A toi de mentir</Title>

      <Card style={{ borderColor: colors.primary }}>
        <Label>La question</Label>
        <Heading>{round.card?.question}</Heading>
        <View style={s.truth}>
          <Label>La vraie reponse</Label>
          <Text style={s.truthText}>{round.card?.trueAnswer}</Text>
        </View>
      </Card>

      {fullBluff ? (
        <Card style={{ borderColor: colors.info }}>
          <Pill text="Round special" tone="info" />
          <Body>
            La vraie reponse ne sera pas proposee. Ecris trois mensonges : seuls
            les parieurs qui repondent « aucune de ces reponses » gagneront.
          </Body>
          <Body muted>Ils l'ignorent totalement. Ne te trahis pas.</Body>
        </Card>
      ) : (
        <Body muted>
          Invente {expected} reponses credibles. Chaque point mise dessus par un
          adversaire tombe dans ta poche.
        </Body>
      )}

      {answers.map((value, index) => (
        <Field
          key={index}
          label={`Mensonge ${index + 1}`}
          value={value}
          onChangeText={(text) =>
            setAnswers((current) => current.map((a, i) => (i === index ? text : a)))
          }
          placeholder="Une reponse plausible…"
          maxLength={200}
        />
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  truth: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  truthText: { fontSize: 18, fontWeight: "700", color: colors.success },
  error: { color: colors.danger, fontSize: 14, textAlign: "center" },
});
