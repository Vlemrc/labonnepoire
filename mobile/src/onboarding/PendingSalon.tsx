import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

/**
 * Ce que le joueur veut faire, retenu le temps qu'il choisisse son profil.
 *
 * L'API demande un token pour creer ou rejoindre un salon, mais on ne veut pas
 * creer de compte avant que le joueur ait vraiment l'intention de jouer. On
 * garde donc son choix en memoire, et tout part en une fois a la fin : compte,
 * puis salon. Personne n'abandonne en laissant un compte vide derriere lui.
 */
export type PendingSalon =
  | {
      kind: "create";
      name: string;
      themes: string[];
      startingPoints: number;
      stakeBudget: number;
    }
  | { kind: "join"; code: string };

interface PendingSalonState {
  pending: PendingSalon | null;
  setPending: (value: PendingSalon | null) => void;
}

const PendingSalonContext = createContext<PendingSalonState | null>(null);

export function PendingSalonProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingSalon | null>(null);
  const value = useMemo(() => ({ pending, setPending }), [pending]);
  return <PendingSalonContext.Provider value={value}>{children}</PendingSalonContext.Provider>;
}

export function usePendingSalon(): PendingSalonState {
  const ctx = useContext(PendingSalonContext);
  if (!ctx) throw new Error("usePendingSalon doit etre utilise dans un PendingSalonProvider.");
  return ctx;
}
