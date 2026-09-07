import Constants from "expo-constants";

/**
 * URL de l'API.
 *
 * Sur un telephone physique, « localhost » designe le telephone lui-meme : on
 * derive donc l'adresse de la machine de dev depuis l'hote du bundler Metro.
 * EXPO_PUBLIC_API_URL permet de forcer une autre cible (staging, Railway).
 */
function resolveBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(":")[0];
  return `http://${host ?? "localhost"}:4000`;
}

export const API_URL = resolveBaseUrl();

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token } = options;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    // Cas le plus frequent en dev : le backend n'est pas lance, ou le telephone
    // n'est pas sur le meme reseau. Un message explicite evite vingt minutes
    // de recherche pour rien.
    throw new ApiError(0, "NETWORK", `Impossible de joindre l'API (${API_URL}).`);
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? "Une erreur est survenue.",
    );
  }
  return payload as T;
}
