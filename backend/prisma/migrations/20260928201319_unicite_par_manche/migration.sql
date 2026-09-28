-- Les numeros de carte repartent a 1 a chaque manche : l'unicite doit inclure
-- la manche, sinon la deuxieme manche entre en collision avec la premiere.
DROP INDEX IF EXISTS "Round_sessionId_number_key";
CREATE UNIQUE INDEX "Round_sessionId_manche_number_key" ON "Round"("sessionId", "manche", "number");
