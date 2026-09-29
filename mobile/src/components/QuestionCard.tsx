import type { ReactNode } from "react";
import { Card, Heading, Label } from "./ui";
import { colors } from "../theme";

/**
 * La question de la carte en jeu. Elle reste sous les yeux pendant les mises :
 * sans elle, les propositions n'ont aucun sens.
 */
export function QuestionCard({ question, children }: { question: string | null; children?: ReactNode }) {
  if (!question) return null;
  return (
    <Card style={{ borderColor: colors.secondary }}>
      <Label>La question</Label>
      <Heading>{question}</Heading>
      {children}
    </Card>
  );
}
