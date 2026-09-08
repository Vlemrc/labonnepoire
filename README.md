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

- Chaque joueur demarre avec un **capital** (20 points par defaut).
- A chaque round, un **bluffeur** recoit une carte et ecrit **2 fausses reponses**.
- Les 3 reponses sont presentees melangees aux **parieurs**, qui repartissent
  librement un **budget fixe** (10 jetons par defaut) entre elles — par exemple
  7 / 2 / 1. La totalite du budget doit etre engagee.
- Resolution :
  - jetons poses sur la **vraie** reponse -> recuperes,
  - jetons poses sur une **fausse** reponse -> perdus au profit de son auteur,
  - parieur qui **ne mise pas** avant la deadline -> son budget part au bluffeur.
- Les roles tournent a chaque round. Un joueur a **0 point est elimine** ; la
  partie s'arrete quand il ne reste qu'un joueur.

Le jeu est **a somme nulle** : aucun point n'est cree ni detruit, ce qui garantit
qu'une partie se termine. Cet invariant est verifie par assertion a chaque
resolution (`assertZeroSum`) et par les tests.

### Quand un joueur laisse tomber

C'est le mode de panne le plus probable d'un jeu asynchrone, et il est traite
explicitement : **un seul joueur inactif ne doit jamais pouvoir figer une
partie.**

| situation | consequence |
|---|---|
| un parieur laisse passer la deadline | son budget entier part au bluffeur, comme s'il avait tout mise a cote |
| le bluffeur n'ecrit pas a temps | le round est annule, il perd un budget de mise (`stakeBudget`) reparti a parts egales entre les parieurs, et on passe au bluffeur suivant |
| un joueur quitte la partie | il est elimine, ses rounds en cours sont annules |

La penalite du bluffeur est un **total**, pas un montant par joueur : indexee
sur le nombre de parieurs, elle l'eliminerait des le premier oubli dans un salon
un peu fourni. Elle est plafonnee a son capital, donc elle peut l'eliminer mais
jamais le faire passer sous zero.

Ces transferts passent par les memes fonctions pures que le reste et respectent
l'invariant de somme nulle.

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

**Un seul ecran pour tout un round.** `app/round/[id].tsx` derive la vue de
l'etat serveur (phase + role) au lieu de naviguer entre trois routes. En
asynchrone la phase change sous les pieds du joueur — le bluffeur valide
pendant qu'on regarde l'ecran d'attente — et une navigation figee laisserait
l'ecran bloque sur une phase revolue.

**Rafraichissement.** L'app interroge l'API toutes les 5 s sur la partie et le
round en cours, et s'arrete des que le round est resolu. C'est la solution de
depart ; les notifications push restent indispensables (voir *Points ouverts*).

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
> un affichage a 120 pt). **Quatre d'entre elles sont le meme fichier** :
> `freezer`, `labubu`, `peach` et `t-rex` ont un MD5 identique, donc quatre
> entrees du selecteur affichent le meme visage. A remplacer.

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
| `POST` | `/rounds/:id/resolve` | forcer la resolution apres la deadline |
| `GET` | `/cards/themes` `/cards/twists` | catalogues |
| `POST` | `/cards/:cardId/report` | signaler une carte fausse ou ambigue |
| `POST` | `/maintenance/sweep` | fait avancer tous les rounds expires (tache planifiee) |

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

### Tache planifiee

`POST /maintenance/sweep` fait avancer tous les rounds expires de la base. Il
est protege par un secret partage : definir `MAINTENANCE_TOKEN` (32 caracteres
ou plus) et l'envoyer dans l'en-tete `x-maintenance-token`. **Tant que la
variable n'est pas definie, l'endpoint repond 503** — mieux vaut une maintenance
inerte qu'une route ouverte capable de resoudre les rounds de n'importe qui.

Cote Railway, un cron toutes les 10 minutes :

```
curl -fsS -X POST "$API_URL/maintenance/sweep" -H "x-maintenance-token: $MAINTENANCE_TOKEN"
```

Ce n'est pas indispensable au fonctionnement : l'API balaie deja les rounds
expires quand un joueur consulte une partie ou un round. Le cron sert aux cas ou
personne ne regarde — et il deviendra obligatoire avec les notifications push,
qui doivent partir sans que quiconque ait ouvert l'app.

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
| 6b. Deblocage automatique des rounds expires | fait |
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
