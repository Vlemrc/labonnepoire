-- Une manche distribue une carte a chaque joueur. Tous ecrivent en parallele,
-- puis les cartes se jouent une par une : PENDING est l'etat d'une carte dont
-- les mensonges sont ecrits mais dont le tour n'est pas venu.
ALTER TYPE "RoundStatus" ADD VALUE IF NOT EXISTS 'PENDING' BEFORE 'BETTING';
