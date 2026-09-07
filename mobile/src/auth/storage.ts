import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * expo-secure-store n'existe pas sur le web : on retombe sur localStorage, qui
 * suffit pour tester dans un navigateur pendant le dev.
 */
const isWeb = Platform.OS === "web";

export async function getItem(key: string): Promise<string | null> {
  if (isWeb) return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function removeItem(key: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
