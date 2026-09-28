import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, font, fonts, radius, spacing, sticker } from "../theme";
import { avatarSource } from "../avatars/registry";


export function Screen({
  children,
  scroll = true,
  footer,
}: {
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
}) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={s.scrollBody}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={s.scrollBody}>{children}</View>
  );

  return (
    <SafeAreaView style={s.screen} edges={["top", "left", "right"]}>
      {body}
      {footer ? <View style={s.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={s.title}>{children}</Text>;
}

export function Heading({ children }: { children: ReactNode }) {
  return <Text style={s.heading}>{children}</Text>;
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[s.body, muted && s.muted]}>{children}</Text>;
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={s.label}>{children}</Text>;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(isDisabled) }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        s.button,
        variant === "primary" && s.buttonPrimary,
        variant === "ghost" && s.buttonGhost,
        variant === "danger" && s.buttonDanger,
        isDisabled && s.buttonDisabled,
        pressed && !isDisabled && s.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.primaryText : colors.text} />
      ) : (
        <Text style={[s.buttonLabel, variant === "primary" && s.buttonLabelPrimary]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={s.field}>
      <Label>{label}</Label>
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={s.input}
        {...props}
      />
    </View>
  );
}

export function Avatar({ avatar, size = 44 }: { avatar: string; size?: number }) {
  // Un fond sous l'image : en developpement les vignettes arrivent depuis
  // Metro et le premier rendu est vide. Sans ce disque, la ligne d'un joueur
  // affiche un trou pendant le chargement, ce qui donne l'app pour cassee.
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.surfaceHigh,
        overflow: "hidden",
      }}
    >
      <Image
        source={avatarSource(avatar)}
        style={{ width: size, height: size }}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

export function Loading({ label = "Chargement…" }: { label?: string }) {
  return (
    <View style={s.center}>
      <ActivityIndicator color={colors.primary} />
      <Text style={[s.body, s.muted, { marginTop: spacing.sm }]}>{label}</Text>
    </View>
  );
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Une erreur est survenue.";
  return (
    <View style={s.center}>
      <Text style={[s.body, { color: colors.danger, textAlign: "center" }]}>{message}</Text>
      {onRetry ? (
        <View style={{ marginTop: spacing.md }}>
          <Button label="Reessayer" variant="ghost" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

export function Pill({ text, tone = "muted" }: { text: string; tone?: "muted" | "good" | "bad" | "primary" | "secondary" }) {
  const TONES = {
    good: colors.success,
    bad: colors.danger,
    primary: colors.primary,
    secondary: colors.secondary,
    muted: colors.textMuted,
  } as const;
  const toneColor = TONES[tone];
  return (
    <View style={[s.pill, { borderColor: toneColor }]}>
      <Text style={[s.pillText, { color: toneColor }]}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scrollBody: { padding: spacing.md, gap: spacing.md, flexGrow: 1 },
  footer: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  title: { ...font.title, color: colors.text },
  heading: { ...font.heading, color: colors.text },
  body: { ...font.body, color: colors.text, lineHeight: 23 },
  label: { ...font.label, color: colors.textMuted, textTransform: "uppercase" },
  muted: { color: colors.textMuted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    ...sticker,
  },
  button: {
    minHeight: 56,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderWidth: 2,
    borderColor: "transparent",
    ...sticker,
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonGhost: { borderColor: colors.border, backgroundColor: colors.surfaceHigh },
  buttonDanger: { backgroundColor: colors.danger },
  buttonDisabled: { opacity: 0.4 },
  // Le bouton s'enfonce : l'ombre disparait et il descend d'autant.
  buttonPressed: { transform: [{ translateX: 3 }, { translateY: 5 }], shadowOpacity: 0 },
  buttonLabel: {
    fontFamily: fonts.display,
    fontSize: 16,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.text,
  },
  buttonLabelPrimary: { color: colors.primaryText },
  field: { gap: spacing.xs },
  input: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontFamily: fonts.bodySemi,
    fontSize: 17,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  pill: {
    borderWidth: 2,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  pillText: { fontFamily: fonts.display, fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase" },
});
