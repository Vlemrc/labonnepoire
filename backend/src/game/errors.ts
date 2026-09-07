/** Erreur de regle du jeu : mappee en 4xx par le middleware d'erreur. */
export class GameRuleError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 409,
  ) {
    super(message);
    this.name = "GameRuleError";
  }
}
