import { Platform, Share } from "react-native";

/**
 * Envoie un code d'invitation par la feuille de partage native.
 *
 * Sur mobile c'est le geste attendu : Messages, WhatsApp, etc. Sur le web la
 * feuille de partage n'existe pas partout, on retombe sur le presse-papiers.
 * Retourne ce qui s'est passe pour que l'ecran puisse le confirmer.
 */
export async function shareInviteCode(
  code: string,
  salonName: string,
): Promise<"shared" | "copied" | "failed"> {
  const message = `Rejoins mon salon « ${salonName} » sur La Bonne Poire avec le code ${code}`;

  if (Platform.OS === "web") {
    try {
      const nav = globalThis.navigator as Navigator | undefined;
      if (nav?.share) {
        await nav.share({ text: message });
        return "shared";
      }
      await nav?.clipboard?.writeText(code);
      return "copied";
    } catch {
      return "failed";
    }
  }

  try {
    const result = await Share.share({ message });
    return result.action === Share.dismissedAction ? "failed" : "shared";
  } catch {
    return "failed";
  }
}
