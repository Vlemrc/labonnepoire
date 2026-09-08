/**
 * Temps restant avant la deadline du round.
 *
 * Cette information n'est pas decorative : depasser la deadline coute des
 * points (forfait du parieur, penalite du bluffeur). La masquer reviendrait a
 * sanctionner un joueur pour une echeance qu'il ne pouvait pas voir.
 */
export function formatRemaining(deadlineAt: string | null): string | null {
  if (!deadlineAt) return null;
  const ms = new Date(deadlineAt).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return "Temps ecoule";

  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days >= 1) return `${days} j restant${days > 1 ? "s" : ""}`;
  if (hours >= 1) return `${hours} h restante${hours > 1 ? "s" : ""}`;
  return `${Math.max(1, minutes)} min restantes`;
}

/** Vrai quand il reste moins de deux heures : on passe l'affichage en alerte. */
export function isUrgent(deadlineAt: string | null): boolean {
  if (!deadlineAt) return false;
  const ms = new Date(deadlineAt).getTime() - Date.now();
  return ms > 0 && ms < 2 * 3_600_000;
}
