import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GroupSummary, RoundView, SessionView, BetInput } from "@poire/shared";
import { api } from "./client";
import { useAuth, useToken } from "../auth/AuthContext";

/**
 * Le jeu etant asynchrone, l'app decouvre les actions des autres par
 * interrogation reguliere. 5 s est un compromis : assez reactif pour qu'une
 * resolution de round apparaisse « en direct » quand tout le monde est present,
 * assez lent pour ne pas marteler l'API quand personne ne joue.
 */
const POLL_MS = 5000;

export function useGroups() {
  const token = useToken();
  return useQuery({
    queryKey: ["groups"],
    queryFn: () => api<{ groups: GroupSummary[] }>("/groups", { token }),
    select: (d) => d.groups,
  });
}

export function useGroup(groupId: string | undefined) {
  const token = useToken();
  return useQuery({
    queryKey: ["group", groupId],
    enabled: Boolean(groupId),
    queryFn: () => api<{ group: GroupSummary }>(`/groups/${groupId}`, { token }),
    select: (d) => d.group,
    refetchInterval: POLL_MS,
  });
}

export function useThemes() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ["themes"],
    queryFn: () => api<{ themes: { theme: string; cardCount: number }[] }>("/cards/themes", { token }),
    select: (d) => d.themes,
  });
}

export function useSession(sessionId: string | undefined) {
  const token = useToken();
  return useQuery({
    queryKey: ["session", sessionId],
    enabled: Boolean(sessionId),
    queryFn: () => api<{ session: SessionView }>(`/sessions/${sessionId}`, { token }),
    select: (d) => d.session,
    refetchInterval: POLL_MS,
  });
}

export function useRound(roundId: string | undefined) {
  const token = useToken();
  return useQuery({
    queryKey: ["round", roundId],
    enabled: Boolean(roundId),
    queryFn: () => api<{ round: RoundView }>(`/rounds/${roundId}`, { token }),
    select: (d) => d.round,
    // On arrete d'interroger une fois le round resolu : plus rien ne bougera.
    refetchInterval: (query) =>
      query.state.data?.round.status === "RESOLVED" ? false : POLL_MS,
  });
}

/** Invalide tout ce qui peut avoir bouge apres une action de jeu. */
function useRefreshGame() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["session"] });
    void queryClient.invalidateQueries({ queryKey: ["round"] });
    void queryClient.invalidateQueries({ queryKey: ["group"] });
  };
}

export function useCreateGroup() {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; themes: string[]; startingPoints?: number; stakeBudget?: number }) =>
      api<{ group: GroupSummary }>("/groups", { method: "POST", body: input, token }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["groups"] }),
  });
}

export function useJoinGroup() {
  const token = useToken();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      api<{ group: GroupSummary }>("/groups/join", { method: "POST", body: { code }, token }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["groups"] }),
  });
}

export function useStartSession() {
  const token = useToken();
  const refresh = useRefreshGame();
  return useMutation({
    mutationFn: (groupId: string) =>
      api<{ session: SessionView }>(`/groups/${groupId}/sessions`, { method: "POST", token }),
    onSuccess: refresh,
  });
}

export function useStartRound() {
  const token = useToken();
  const refresh = useRefreshGame();
  return useMutation({
    mutationFn: (sessionId: string) =>
      api<{ round: RoundView }>(`/sessions/${sessionId}/rounds`, { method: "POST", token }),
    onSuccess: refresh,
  });
}

export function useSubmitAnswers(roundId: string) {
  const token = useToken();
  const refresh = useRefreshGame();
  return useMutation({
    mutationFn: (answers: string[]) =>
      api<{ round: RoundView }>(`/rounds/${roundId}/answers`, {
        method: "POST",
        body: { answers },
        token,
      }),
    onSuccess: refresh,
  });
}

export function useSubmitBets(roundId: string) {
  const token = useToken();
  const refresh = useRefreshGame();
  return useMutation({
    mutationFn: (bets: BetInput[]) =>
      api<{ round: RoundView }>(`/rounds/${roundId}/bets`, {
        method: "POST",
        body: { bets },
        token,
      }),
    onSuccess: refresh,
  });
}

export function useActivateTwist(roundId: string) {
  const token = useToken();
  const refresh = useRefreshGame();
  return useMutation({
    mutationFn: () =>
      api<{ round: RoundView }>(`/rounds/${roundId}/twist`, { method: "POST", token }),
    onSuccess: refresh,
  });
}

export function useReportCard() {
  const token = useToken();
  return useMutation({
    mutationFn: ({ cardId, reason }: { cardId: string; reason?: string }) =>
      api(`/cards/${cardId}/report`, { method: "POST", body: { reason }, token }),
  });
}
