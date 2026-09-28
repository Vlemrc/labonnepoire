-- Numero de manche sur chaque carte.
ALTER TABLE "Round" ADD COLUMN "manche" INTEGER NOT NULL DEFAULT 1;

-- Le budget de mise n'existe plus : un parieur engage la totalite de son
-- capital, qui vit sur SessionPlayer.
ALTER TABLE "Round" DROP COLUMN "stakeBudget";
ALTER TABLE "Group" DROP COLUMN "stakeBudget";
