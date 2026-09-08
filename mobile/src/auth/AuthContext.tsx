import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { AuthResponse, AvatarId, PublicUser } from "@poire/shared";
import { api } from "../api/client";
import { getItem, removeItem, setItem } from "./storage";

const TOKEN_KEY = "poire.token";

interface AuthState {
  ready: boolean;
  token: string | null;
  user: PublicUser | null;
  signUp: (pseudo: string, avatar: AvatarId) => Promise<void>;
  updateProfile: (patch: { pseudo?: string; avatar?: AvatarId }) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);

  // Au demarrage, on ne fait pas que relire le token : on le valide contre
  // l'API. Un token orphelin (base reinitialisee en dev) enverrait sinon
  // l'utilisateur dans une app entierement cassee plutot que sur l'onboarding.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await getItem(TOKEN_KEY);
      if (stored) {
        try {
          const me = await api<{ user: PublicUser }>("/auth/me", { token: stored });
          if (!cancelled) {
            setToken(stored);
            setUser(me.user);
          }
        } catch {
          await removeItem(TOKEN_KEY);
        }
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signUp = useCallback(async (pseudo: string, avatar: AvatarId) => {
    const res = await api<AuthResponse>("/auth/session", {
      method: "POST",
      body: { pseudo, avatar },
    });
    await setItem(TOKEN_KEY, res.token);
    setToken(res.token);
    setUser(res.user);
  }, []);

  const updateProfile = useCallback(
    async (patch: { pseudo?: string; avatar?: AvatarId }) => {
      const res = await api<{ user: PublicUser }>("/auth/me", {
        method: "PATCH",
        body: patch,
        token,
      });
      setUser(res.user);
    },
    [token],
  );

  const signOut = useCallback(async () => {
    await removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ ready, token, user, signUp, updateProfile, signOut }),
    [ready, token, user, signUp, updateProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit etre utilise dans un AuthProvider.");
  return ctx;
}

/** Token garanti non nul : a n'appeler que dans les ecrans derriere l'onboarding. */
export function useToken(): string {
  const { token } = useAuth();
  if (!token) throw new Error("Aucun token : ecran accessible sans authentification.");
  return token;
}
