import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { RoundView } from "@poire/shared";
import { useSubmitAnswers } from "../api/hooks";
import { Appear } from "../components/Appear";
import { Body, Button, Card, ErrorText, Field, Heading, Label, Pill, Screen, Title } from "../components/ui";
import { colors, fonts, spacing } from "../theme";

/**
 * Ecran du bluffeur : il voit la carte, vraie reponse comprise, et invente les
 * fausses. En mode FULL_BLUFF il en ecrit trois et la vraie reponse ne sera pas
 * proposee — c'est le seul joueur a le savoir.
 */
export function BluffScreen({ round }: { round: RoundView }) {
  const fullBluff = round.mode === "FULL_BLUFF";
  const expected = fullBluff ? 3 : 2;
  const submit = useSubmitAnswers(round.id);

  // Le nombre de champs se derive du round a CHAQUE rendu, il n'est jamais fige
  // dans l'etat. Le mode du round peut arriver apres le premier rendu, et un
  // useState initialise une seule fois laisserait alors deux champs a l'ecran
  // pour un round qui en exige trois : le bluffeur ne pourrait plus valider.
  const [typed, setTyped] = useState<string[]>([]);
  const answers = Array.from({ length: expected }, (_, i) => typed[i] ?? "");

  const filled = answers.map((a) => a.trim()).filter(Boolean);
  const canSubmit = filled.length === expected && !submit.isPending;

  return (
    <Screen
      footer={
        <>
          {submit.error ? <ErrorText>{(submit.error as Error).message}</ErrorText> : null}
          <Button
            label="Envoyer mes mensonges"
            onPress={() => void submit.mutateAsync(answers.map((a) => a.trim()))}
            disabled={!canSubmit}
            loading={submit.isPending}
          />
        </>
      }
    >
      <Title>À toi de mentir</Title>
      <Body muted>
        Tout le monde écrit en même temps. Les cartes s'ouvrent aux mises dès que
        chacun a envoyé ses mensonges.
      </Body>

      <Appear index={0}>
      <Card style={{ borderColor: colors.secondary }}>
        <Label>La question</Label>
        <Heading>{round.card?.question}</Heading>
        <View style={s.truth}>
          <Label>La vraie réponse</Label>
          <Text style={s.truthText}>{round.card?.trueAnswer}</Text>
        </View>
      </Card>
      </Appear>

      {fullBluff ? (
        <Card style={{ borderColor: colors.secondary }}>
          <Pill text="Round spécial" tone="secondary" />
          <Body>
            La vraie réponse ne sera pas proposée. Écris trois mensonges : seuls
            les parieurs qui répondent « aucune de ces réponses » gagneront.
          </Body>
          <Body muted>Ils l'ignorent totalement. Ne te trahis pas.</Body>
        </Card>
      ) : (
        <Body muted>
          Invente {expected} réponses crédibles. Tu touches une part de ce que
          les adversaires y perdent : le total divisé par le nombre de parieurs.
        </Body>
      )}

      {answers.map((value, index) => (
        <Appear key={index} index={1 + index}>
        <Field
          label={`Mensonge ${index + 1}`}
          value={value}
          onChangeText={(text) =>
            setTyped(answers.map((a, i) => (i === index ? text : a)))
          }
          placeholder="Une réponse plausible…"
          maxLength={200}
        />
        </Appear>
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
  truthText: { fontFamily: fonts.display, fontSize: 19, color: colors.success },
});
