# La Bonne Poire

> *Une bonne poire, c'est celui qui se fait avoir sans rien voir venir.*

Jeu de bluff multijoueur asynchrone. Un joueur recoit une carte (question insolite
+ vraie reponse), invente de fausses reponses, et les autres repartissent un
budget de mise entre les propositions. Chacun joue quand il veut : aucune
connexion simultanee n'est necessaire.

**Statut : boucle de jeu jouable de bout en bout**, backend + app mobile.
Le visuel est volontairement minimaliste et les assets d'avatars sont
provisoires.

---

## Regles du jeu

Une partie se joue en **manches**. Chaque manche suit deux temps :

**1. Tout le monde ecrit, en meme temps.** Chaque joueur recoit *sa* carte —
une question insolite et sa vraie reponse — et invente **2 fausses reponses**.
La manche ne demarre que lorsque le dernier a soumis.

**2. Les cartes se jouent une par une.** On affiche la carte d'un joueur avec
les 3 reponses melangees, tous les autres misent, on fait le point des scores,
puis on passe a la carte suivante. Quand toutes les cartes sont jouees, la
manche est close et on peut en relancer une.

Ce decoupage est ce qui rend le jeu tenable en asynchrone : **deux temps
d'attente par manche**, au lieu de deux par joueur si les cartes s'enchainaient
une a une du debut a la fin.

### Les jetons

Chaque joueur demarre avec un **capital** (20 par defaut, configurable). Sur
chaque carte, il **engage la totalite de ce qu'il lui reste** et le repartit
librement entre les propositions.

- jetons poses sur la **vraie** reponse -> recuperes, ils repartent sur la carte suivante
- jetons poses sur une **fausse** reponse -> perdus ; leur auteur en touche le
  total divise par le nombre de parieurs de la carte (20 perdus a 4 parieurs :
  5 pour le menteur), le reste sort du jeu

Exemple : tu commences a 20, tu mises 10 sur la bonne reponse et 10 a cote ; a
la carte suivante tu joues avec 10.

Un joueur a **0 point est elimine** ; la partie s'arrete quand il ne reste
qu'un joueur.

**Aucun point n'est cree** : ce que le menteur ne touche pas disparait, la
masse totale ne fait que baisser, ce qui garantit qu'une partie se termine. Cet
invariant est verifie par assertion a chaque resolution (`assertNoPointCreated`).
Corollaire moins evident : un transfert ne peut jamais rendre un capital
negatif, y compris sous un twist qui double les echanges — la sortie est
plafonnee a ce que le joueur possede reellement.

### Quand un joueur laisse tomber

Il n'y a **pas d'echeance** : une carte attend, aussi longtemps qu'il le faut,
que tout le monde ait joue. La manche n'avance que lorsque chaque joueur a
ecrit ses mensonges, puis chaque carte ne se resout que lorsque tous ses
parieurs ont mise. Aucune penalite, aucun forfait.

Un joueur qui ne revient pas bloque donc la partie. La seule facon de la
debloquer est qu'il la **quitte** (`POST /sessions/:id/quit`, ou en quittant le
salon) :

| situation au moment du depart | consequence |
|---|---|
| sa carte est en ecriture ou en cours de mises | elle est annulee, sans mouvement de points ; la manche reprend son cours (la carte suivante s'ouvre si tout le monde a ecrit) |
| sa carte est deja ecrite et attend son tour | elle sera jouee normalement, ses mensonges restent en jeu |
| il etait le dernier parieur attendu sur la carte en cours | la carte se resout aussitot, puis la suivante s'ouvre |
| dans tous les cas | il est elimine et ses points sortent du jeu |

Un joueur deja a sec n'a rien a miser : il est compte comme ayant joue, la carte
ne l'attend pas.

### Deux mecaniques cachees

**Mode « tout est faux » (FULL_BLUFF).** Dans ~15 % des rounds (si l'option est
activee sur le salon), le bluffeur doit ecrire **3** fausses reponses : la vraie
n'est pas dans la liste. Seuls les parieurs qui choisissent *« aucune de ces
reponses »* gagnent. Ce mode est **invisible cote parieur** — meme interface,
meme payload API — sinon l'option deviendrait un choix gratuit.

**Mises secretes.** Les mises ne sont jamais renvoyees par l'API avant la
resolution du round, y compris a un joueur qui a deja mise. Personne ne peut
etre influence par les autres.

### Twists

Une fois par partie, un joueur peut activer une carte twist pendant la phase
d'ecriture. Trois twists sont livres (`DOUBLE_STAKES`, `ALL_IN`,
`BLUFFEUR_ANTE`), mais la table est extensible : voir
`backend/src/game/twists/registry.ts`.

---

## Demarrer en local

### Prerequis

- Node >= 20
- PostgreSQL en local (une base `bonne_poire`)

### Installation

```bash
npm install
```

### Base de donnees

Le projet fournit un `docker-compose.yml` (Postgres sur le port **5433**) :

```bash
npm run db:up
```

Si tu utilises un PostgreSQL local plutot que Docker, cree simplement la base :

```bash
createdb bonne_poire
```

Puis renseigne `backend/.env` (copie de `backend/.env.example`) :

```
DATABASE_URL="postgresql://<user>@localhost:5432/bonne_poire?schema=public"
PORT=4000
NODE_ENV=development
CORS_ORIGIN="*"
```

### Migrations + donnees de test

```bash
npm run db:migrate
npm run db:seed
```

Le seed installe **100 cartes** reparties sur 5 thematiques (`animaux`,
`insolite`, `histoire`, `mots-et-langues`, `lois-et-traditions`) et les 3 twists.

> **Aucune carte n'est verifiee.** Les 100 cartes sont toutes en statut `DRAFT` :
> elles sont jouables, mais leurs reponses n'ont pas ete controlees contre une
> source. Voir *Contenu des cartes* plus bas pour le circuit de relecture.

### Lancer l'API

```bash
npm run dev:backend
```

L'API ecoute sur `http://localhost:4000`. Verification : `curl localhost:4000/health`.

### Lancer l'app mobile

Dans un second terminal, l'API devant tourner :

```bash
npm run dev:mobile
```

Puis `i` pour le simulateur iOS, `a` pour Android, `w` pour le navigateur, ou
scanner le QR code avec Expo Go.

#### Expo Go ou build natif

| commande | ce que ca fait | prerequis |
|---|---|---|
| `npm run ios -w mobile` | ouvre l'app dans **Expo Go** | aucun, c'est le chemin par defaut |
| `npm run ios:native -w mobile` | compile un vrai binaire | **Xcode 26.4+** |
| `npm run prebuild -w mobile` | regenere `mobile/ios` et `mobile/android` | — |

Le projet natif a ete genere (`expo prebuild`), donc `mobile/ios/LaBonnePoire.xcworkspace`
s'ouvre dans Xcode. **Il ne compile pas sous Xcode 26.1.1** : Expo SDK 57 construit
`ExpoModulesJSI` depuis les sources a chaque build, sans binaire precompile de
secours, et ce code utilise la syntaxe `weak let` qui n'existe qu'a partir de
Swift 6.3 — donc Xcode 26.4 ou plus. Voir
[expo/expo#46242](https://github.com/expo/expo/issues/46242).

`mobile/ios/` et `mobile/android/` ne sont pas versionnes : `app.json` reste la
source de verite et `expo prebuild --clean` les regenere. A versionner seulement
le jour ou du code natif est ecrit a la main — il faudra alors arreter de lancer
prebuild, qui les ecraserait.

Le build natif deviendra obligatoire pour les **notifications push** : Expo Go ne
recoit pas les notifications distantes.

L'app derive l'adresse de l'API depuis l'hote du bundler Metro : sur un
telephone physique, « localhost » designerait le telephone lui-meme. Pour
pointer ailleurs (staging, Railway) :

```bash
EXPO_PUBLIC_API_URL=https://mon-api.up.railway.app npm run dev:mobile
```

### Tests

```bash
npm test
```

66 tests : moteur de score pur, machine a etats, et une suite end-to-end qui
joue des parties completes via HTTP. Les tests e2e utilisent une base separee
`bonne_poire_test` : cree-la une fois avec `createdb bonne_poire_test`, les
migrations sont ensuite appliquees automatiquement avant chaque `npm test`.
Surchargeable avec `TEST_DATABASE_URL`.

### Outils

```bash
npm run db:studio   # explorateur Prisma
npm run build       # compile shared + backend
```

---

## Architecture

```
la-bonne-poire/
├── shared/          # types + constantes partages backend <-> mobile
├── backend/
│   ├── prisma/      # schema, migrations, seed
│   └── src/
│       ├── game/    # REGLES DU JEU — pur, sans Express ni Prisma
│       │   ├── scoring.ts       # resolution d'un round
│       │   ├── stateMachine.ts  # transitions et validations
│       │   └── twists/          # table extensible
│       ├── modules/ # une route + un service par domaine
│       ├── middleware/
│       └── lib/
└── mobile/          # Expo + expo-router
    ├── app/         # routage par fichiers
    │   ├── onboarding.tsx
    │   ├── salons/  # liste, creation, rejoindre
    │   ├── salon/[id].tsx
    │   └── round/[id].tsx
    └── src/
        ├── api/     # client HTTP + hooks react-query
        ├── auth/    # token en SecureStore
        ├── avatars/ # rendu provisoire, remplacable sans toucher a l'API
        ├── screens/ # BluffScreen, BetScreen, ResultScreen
        └── components/
```

### Cote mobile

**Le compte se cree en dernier.** L'ecran d'arrivee ne demande rien : creer un
salon, ou en rejoindre un avec son code. Le pseudo et l'avatar ne sont demandes
qu'ensuite, et tout part en une seule fois — compte puis salon.

L'API exige pourtant un token pour creer ou rejoindre un salon. Plutot que
d'ouvrir un compte anonyme au lancement, qui laisserait un compte vide derriere
chaque visiteur qui abandonne, le choix du joueur est retenu en memoire
(`src/onboarding/PendingSalon.tsx`) et rejoue apres l'inscription. Un joueur
deja inscrit saute simplement l'etape.

Consequence sur le routage : `welcome`, `profile`, `salons/new` et
`salons/join` sont accessibles sans token — voir `isPublicRoute` dans
`app/_layout.tsx`. Tout le reste redirige vers l'accueil.

**Un seul ecran pour tout un round.** `app/round/[id].tsx` derive la vue de
l'etat serveur (phase + role) au lieu de naviguer entre trois routes. En
asynchrone la phase change sous les pieds du joueur — le bluffeur valide
pendant qu'on regarde l'ecran d'attente — et une navigation figee laisserait
l'ecran bloque sur une phase revolue.

**Rafraichissement.** L'app interroge l'API toutes les 5 s sur la partie et le
round en cours, et s'arrete des que le round est resolu. C'est la solution de
depart ; les notifications push restent indispensables (voir *Points ouverts*).

**Couleurs.** Toute la palette vit dans `mobile/src/theme.ts` : fond bleu
flash, violet en secondaire, boutons blancs.

Les cartes sont d'un bleu nettement plus profond que le fond, et ce n'est pas
un choix esthetique. Bleu et violet sont voisins et de luminosite proche : pose
directement sur le bleu vif, le violet tombe a 2.4:1 et devient illisible. Sur
les cartes il remonte a 4.7:1. Tout ce qui est violet vit donc sur une carte —
points du classement, code du salon dans la liste, twists, rounds speciaux,
bordures de selection. Ce qui repose sur le fond bleu reste blanc : le code du
salon en en-tete, le budget de mise.

Vert et rouge restent reserves aux gains et aux pertes : s'en servir aussi
comme accents rendrait l'ecran de resultats illisible.

**Typographie.** Trois familles, chargees au demarrage via `expo-font` :
**Bricolage Grotesque** pour les titres, boutons et chiffres — une grotesque au
dessin marque qui donne au jeu une tete a lui ; **Outfit** pour la lecture
courante ; **Space Mono** pour le code du salon, une vraie chasse fixe, pour que
les caracteres s'alignent et se dictent sans ambiguite.

Regle a ne pas oublier : avec des polices chargees, **jamais de `fontWeight`**.
iOS fabriquerait une fausse graisse par-dessus la vraie. La graisse se choisit
en nommant la variante (`fonts.display`, `fonts.bodySemi`…).

**Habillage.** Les cartes portent une bordure de 2 px et une ombre portee
franche sans flou (`sticker` dans le theme) : elles se posent comme des cartons
sur une table au lieu de flotter. Les boutons s'enfoncent au toucher — l'ombre
disparait et le bouton descend d'autant. Plusieurs elements sont legerement de
travers (propositions de mise, tampon du code, vignettes en eventail sur
l'accueil) : c'est un jeu d'ambiance, un alignement parfait le ferait passer
pour un utilitaire.

**Animations d'apparition.** `src/components/Appear.tsx` enveloppe un element
et le fait monter en fondu, avec un decalage par `index` pour qu'une liste
entre en cascade plutot que d'un bloc. Utilise la ou le rythme sert le jeu :
revelation des reponses sur l'ecran de resultats, distribution des propositions
de mise, arrivee du titre et des vignettes sur l'accueil.

Deux points a ne pas defaire :

- Il s'appuie sur l'API `Animated` **du coeur de React Native**, pas sur les
  animations d'entree de Reanimated. Ces dernieres ne se declenchent pas de
  facon fiable sur le web pour un composant monte apres le premier rendu :
  l'ecran reste vide alors que le contenu est bien present dans le DOM.
  Constate sur l'ecran de resultats, qui passe par un ecran de chargement.
- Le reglage systeme de reduction des animations est respecte : il ne reste
  alors qu'un fondu, sans mouvement.

**Avatars.** Un joueur choisit une vignette parmi un catalogue fixe. Le backend
ne stocke que son identifiant (`User.avatar`) et ignore totalement l'apparence :
les images vivent dans `mobile/assets/avatars/`.

Ajouter un avatar demande trois gestes, et aucune migration :

1. poser le PNG dans `mobile/assets/avatars/`
2. ajouter son identifiant a `AVATAR_IDS` dans `shared/src/constants.ts`
3. ajouter une ligne dans `mobile/src/avatars/registry.ts` — Metro exige des
   `require` statiques, le chemin ne peut pas etre construit a la volee

> Les images actuelles viennent de `~/Documents/labonnepoire/avatars`,
> redimensionnees a 512 px a la copie (les originaux font 1006 px, inutile pour
> un affichage a 120 pt).
>
> `freezer` et `labubu` designent des personnages appartenant a des tiers
> (Dragon Ball, Pop Mart). Sans consequence pour des parties entre amis, a
> revoir avant toute publication.

Le dossier `game/` ne fait aucune I/O : tout entre par les arguments. C'est ce
qui permet de tester l'integralite des regles sans base de donnees, et de les
faire evoluer sans toucher aux routes.

### Contenu des cartes

Les cartes vivent dans **`backend/prisma/seed/data/cards.json`**, pas dans du
code : a plusieurs centaines d'entrees, un fichier TypeScript devient illisible
en diff et penible a editer pour qui n'ecrit pas de code. Le seed valide le
fichier avec zod avant de l'importer (question minimale, thematique en
kebab-case, doublons de question) et echoue avec le numero de la carte fautive.

Chaque carte porte un `status` :

| statut | effet |
|---|---|
| `DRAFT` | jouable, mais pas encore relue contre une source |
| `VERIFIED` | fait controle, `source` renseignee |
| `REJECTED` | sortie du tirage, jamais supprimee (des rounds y font reference) |

Re-lancer `npm run db:seed` met a jour le contenu existant, cree les nouvelles
cartes, et **retire du tirage** celles qui ne sont plus dans le fichier. Le
statut et le compteur de signalements d'une carte deja en base ne sont jamais
ecrases.

**Signalement en jeu.** `POST /cards/:cardId/report` permet a un joueur qui a
reellement vu la carte de la signaler. Au troisieme signalement, elle passe
automatiquement en `REJECTED`. C'est le seul mecanisme de relecture qui passe a
l'echelle : les joueurs reperent une carte fausse bien mieux qu'une relecture en
amont.

**Une carte ne sert qu'une fois par salon.** La table `GroupSeenCard` retient
les cartes deja distribuees a un groupe. Une exclusion limitee a la partie ferait
repiocher dans le paquet complet des la deuxieme soiree, alors qu'une carte deja
vue est brulee : le bluffeur connait la reponse, le parieur s'en souvient. Quand
le paquet d'un salon est epuise, le tirage recycle plutot que de bloquer la
partie.

Ordre de grandeur : 100 cartes sur 5 thematiques font 20 cartes par thematique.
Un salon qui n'en coche que deux joue dans un paquet de 40, soit deux ou trois
soirees. **Cocher large, ou ecrire davantage de cartes.**

### Modele de donnees

`Group` (salon persistant) contient des `GameSession` (parties). Les points
vivent sur `SessionPlayer`, pas sur le salon — sinon on ne pourrait pas relancer
une partie. Un `Round` porte son `stakeBudget` et son `allowNoneOption` figes a
la creation : changer un reglage du salon ne modifie jamais un round deja lance.

---

## API

Authentification : `Authorization: Bearer <token>`, obtenu a la creation du compte.

| Methode | Route | Role |
|---|---|---|
| `POST` | `/auth/session` | cree un compte invite, renvoie le token |
| `DELETE` | `/auth/session` | depart definitif : quitte tous les salons et invalide le token (le compte reste pour l'historique) |
| `GET` `PATCH` | `/auth/me` | profil (pseudo, avatar, email optionnel) |
| `GET` | `/auth/avatar-catalog` | bases et accessoires disponibles |
| `GET` `POST` | `/groups` | lister / creer un salon |
| `POST` | `/groups/join` | rejoindre via code d'invitation |
| `GET` | `/groups/:id` | detail d'un salon |
| `PATCH` | `/groups/:id/settings` | thematiques, capital, budget de mise |
| `POST` | `/groups/:id/sessions` | lancer une partie |
| `GET` | `/sessions/:id` | **etat complet** — endpoint de polling de l'app |
| `POST` | `/sessions/:id/rounds` | demarrer le round suivant |
| `POST` | `/sessions/:id/quit` | abandonner |
| `GET` | `/rounds/:id` | vue du round **filtree selon le role** |
| `POST` | `/rounds/:id/answers` | bluffeur : deposer les fausses reponses |
| `POST` | `/rounds/:id/bets` | parieur : repartir son budget |
| `POST` | `/rounds/:id/twist` | activer sa carte twist |
| `GET` | `/cards/themes` `/cards/twists` | catalogues |
| `POST` | `/cards/:cardId/report` | signaler une carte fausse ou ambigue |

`GET /rounds/:id` est le point sensible : la vraie reponse, l'auteur de chaque
fausse reponse, le mode du round et les mises des autres joueurs ne sont ajoutes
au payload que lorsque le demandeur a le droit de les voir. Trois tests e2e
verrouillent ce comportement.

---

## Deploiement Railway

`railway.json` est fourni. Cote Railway :

1. ajouter un service **PostgreSQL** ;
2. sur le service applicatif, definir `DATABASE_URL` (reference de la base),
   `NODE_ENV=production` et `CORS_ORIGIN` ;
3. le `startCommand` applique les migrations (`prisma migrate deploy`) avant de
   demarrer l'API.

Le seed n'est pas execute automatiquement : le lancer une fois a la main
(`npm run db:seed -w backend` avec le `DATABASE_URL` de production).

---

## Suite du plan

| Etape | Etat |
|---|---|
| 0. Monorepo, outillage | fait |
| 1. Schema Prisma, migration, seed | fait |
| 2. Moteur de regles + tests unitaires | fait |
| 3. API complete + tests e2e | fait |
| 4. Mobile : onboarding, salon, les 3 phases de round | fait |
| 5. Twists supplementaires | a faire |
| 5b. Relecture des 100 cartes (toutes en `DRAFT`) | **a faire** |
| 6. Notifications push (le mode asynchrone en a besoin) | **a faire** |
| 7. Deploiement Railway | config prete, non deployee |
| 8. Polish visuel, assets d'avatars definitifs | a faire |
| 9. Tests de l'app mobile (aucun pour l'instant) | **a faire** |

### Points ouverts

- **Mise en page sur telephone.** Tout a ete verifie en 800x450 puis en 375x812.
  Ca defile correctement, mais sur l'ecran du bluffeur les champs de saisie
  passent sous la ligne de flottaison : la tache principale demande un scroll.
  A retravailler au passage de polish visuel.

- **Notifications push.** Un jeu asynchrone sans notification ne tourne pas : les
  joueurs oublient leur tour. A prevoir avant tout test reel a plusieurs
  (Expo Notifications + un champ `pushToken` sur `User`).
- **Equipes.** Le schema prevoit `SessionPlayer.teamId`, mais rien ne l'utilise.
- **Magic link.** `User.email` existe deja ; il ne manque qu'un provider d'envoi
  et une table de tokens a expiration.
