import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { GROUP_CODE_LENGTH } from "@bluff/shared";
import { useJoinGroup } from "../../src/api/hooks";
import { Body, Button, Field, Screen, Title } from "../../src/components/ui";
import { colors, font } from "../../src/theme";

export default function JoinSalon() {
  const router = useRouter();
  const join = useJoinGroup();
  const [code, setCode] = useState("");

  async function submit() {
    const res = await join.mutateAsync(code.trim().toUpperCase());
    router.replace(`/salon/${res.group.id}`);
  }

  return (
    <Screen
      footer={
        <>
          {join.error ? <Text style={s.error}>{(join.error as Error).message}</Text> : null}
          <Button
            label="Rejoindre"
            onPress={() => void submit()}
            disabled={code.trim().length !== GROUP_CODE_LENGTH || join.isPending}
            loading={join.isPending}
          />
        </>
      }
    >
      <Title>Rejoindre un salon</Title>
      <Body muted>Demande son code a la personne qui a cree le salon.</Body>
      <Field
        label="Code"
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase())}
        placeholder="ABC123"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={GROUP_CODE_LENGTH}
        style={s.codeInput}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  codeInput: {
    ...font.mono,
    color: colors.text,
    textAlign: "center",
    backgroundColor: colors.surfaceHigh,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 18,
  },
  error: { color: colors.danger, fontSize: 14, textAlign: "center" },
});
