/**
 * Jeu de cartes de test.
 *
 * ATTENTION : ce contenu est un PLACEHOLDER destine a faire tourner la boucle
 * de jeu. Les reponses n'ont pas ete verifiees une par une et certaines sont
 * approximatives ou datees. A relire / remplacer avant toute mise en ligne
 * publique — c'est du contenu editorial, pas du code.
 */
export interface SeedCard {
  question: string;
  trueAnswer: string;
  theme: string;
  difficulty: number;
}

export const THEMES = {
  NATURE: "nature-animaux",
  HISTOIRE: "histoire",
  INSOLITE: "faits-insolites",
} as const;

export const SEED_CARDS: SeedCard[] = [
  // --- Nature & animaux ---------------------------------------------------
  { theme: THEMES.NATURE, difficulty: 1, question: "Combien de coeurs possede une pieuvre ?", trueAnswer: "Trois" },
  { theme: THEMES.NATURE, difficulty: 2, question: "De quelle couleur est le sang d'une pieuvre ?", trueAnswer: "Bleu" },
  { theme: THEMES.NATURE, difficulty: 2, question: "Quel animal possede des empreintes digitales presque identiques a celles de l'humain ?", trueAnswer: "Le koala" },
  { theme: THEMES.NATURE, difficulty: 2, question: "Combien de temps dure environ la gestation d'une elephante d'Afrique ?", trueAnswer: "Environ 22 mois" },
  { theme: THEMES.NATURE, difficulty: 1, question: "Combien de compartiments compte l'estomac d'une vache ?", trueAnswer: "Quatre" },
  { theme: THEMES.NATURE, difficulty: 1, question: "Quel est le seul mammifere capable de vol actif ?", trueAnswer: "La chauve-souris" },
  { theme: THEMES.NATURE, difficulty: 2, question: "Quel oiseau est capable de voler en marche arriere ?", trueAnswer: "Le colibri" },
  { theme: THEMES.NATURE, difficulty: 2, question: "Combien d'os compte le squelette d'un requin ?", trueAnswer: "Aucun, il est entierement en cartilage" },
  { theme: THEMES.NATURE, difficulty: 2, question: "Quelle est la vitesse de pointe approximative d'un guepard ?", trueAnswer: "Environ 110 km/h" },
  { theme: THEMES.NATURE, difficulty: 3, question: "Combien de paupieres un chameau possede-t-il par oeil ?", trueAnswer: "Trois" },
  { theme: THEMES.NATURE, difficulty: 3, question: "Quel animal terrestre a la morsure la plus puissante ?", trueAnswer: "Le crocodile marin" },
  { theme: THEMES.NATURE, difficulty: 2, question: "Combien de temps un escargot peut-il dormir d'affilee en periode d'estivation ?", trueAnswer: "Jusqu'a plusieurs mois" },

  // --- Histoire -----------------------------------------------------------
  { theme: THEMES.HISTOIRE, difficulty: 2, question: "Combien de temps a reellement dure la guerre de Cent Ans ?", trueAnswer: "116 ans" },
  { theme: THEMES.HISTOIRE, difficulty: 3, question: "Combien de temps a dure la guerre anglo-zanzibarienne, le conflit le plus court de l'histoire ?", trueAnswer: "Environ 38 minutes" },
  { theme: THEMES.HISTOIRE, difficulty: 2, question: "Quel age avait Toutankhamon a sa mort ?", trueAnswer: "Environ 19 ans" },
  { theme: THEMES.HISTOIRE, difficulty: 3, question: "Combien de temps la grande pyramide de Gizeh est-elle restee la plus haute construction humaine ?", trueAnswer: "Environ 3800 ans" },
  { theme: THEMES.HISTOIRE, difficulty: 1, question: "Quels animaux Hannibal a-t-il fait traverser les Alpes ?", trueAnswer: "Des elephants" },
  { theme: THEMES.HISTOIRE, difficulty: 1, question: "En quelle annee les freres Wright ont-ils realise leur premier vol motorise ?", trueAnswer: "1903" },
  { theme: THEMES.HISTOIRE, difficulty: 2, question: "Quelle boisson faisait partie de la remuneration des ouvriers des pyramides egyptiennes ?", trueAnswer: "La biere" },
  { theme: THEMES.HISTOIRE, difficulty: 1, question: "Combien d'epouses a eu Henri VIII d'Angleterre ?", trueAnswer: "Six" },
  { theme: THEMES.HISTOIRE, difficulty: 2, question: "Combien de temps a dure la construction de la tour Eiffel ?", trueAnswer: "Un peu plus de deux ans" },
  { theme: THEMES.HISTOIRE, difficulty: 3, question: "Quel pays a offert la statue de la Liberte aux Etats-Unis ?", trueAnswer: "La France" },
  { theme: THEMES.HISTOIRE, difficulty: 3, question: "Quelle civilisation utilisait des cordelettes a noeuds appelees quipus pour compter ?", trueAnswer: "Les Incas" },
  { theme: THEMES.HISTOIRE, difficulty: 2, question: "Quel empereur romain aurait voulu faire de son cheval un consul ?", trueAnswer: "Caligula" },

  // --- Faits insolites ----------------------------------------------------
  { theme: THEMES.INSOLITE, difficulty: 3, question: "Combien pese environ un nuage de type cumulus ?", trueAnswer: "Environ 500 tonnes" },
  { theme: THEMES.INSOLITE, difficulty: 2, question: "Combien de temps met la lumiere du Soleil pour atteindre la Terre ?", trueAnswer: "Environ 8 minutes et 20 secondes" },
  { theme: THEMES.INSOLITE, difficulty: 3, question: "Quelle partie du corps humain ne contient aucun vaisseau sanguin ?", trueAnswer: "La cornee" },
  { theme: THEMES.INSOLITE, difficulty: 3, question: "Combien de fuseaux horaires la France couvre-t-elle avec ses territoires ?", trueAnswer: "Douze" },
  { theme: THEMES.INSOLITE, difficulty: 1, question: "Combien de touches compte un piano standard ?", trueAnswer: "88" },
  { theme: THEMES.INSOLITE, difficulty: 2, question: "Quel aliment peut se conserver des millenaires sans se perimer ?", trueAnswer: "Le miel" },
  { theme: THEMES.INSOLITE, difficulty: 3, question: "Combien d'alveoles compte en moyenne une balle de golf ?", trueAnswer: "Environ 336" },
  { theme: THEMES.INSOLITE, difficulty: 2, question: "Combien de secondes compte une journee ?", trueAnswer: "86 400" },
  { theme: THEMES.INSOLITE, difficulty: 3, question: "Combien d'etoiles figurent sur le drapeau du Bresil ?", trueAnswer: "27" },
  { theme: THEMES.INSOLITE, difficulty: 2, question: "Quelle est la seule lettre absente du nom de tous les Etats americains ?", trueAnswer: "Le Q" },
  { theme: THEMES.INSOLITE, difficulty: 2, question: "Combien de fois peut-on plier en deux une feuille de papier standard ?", trueAnswer: "Sept fois" },
  { theme: THEMES.INSOLITE, difficulty: 3, question: "Quel est le seul aliment que les astronautes ont demande a emporter des la premiere mission Apollo ?", trueAnswer: "Des cubes de nourriture lyophilisee" },
];
