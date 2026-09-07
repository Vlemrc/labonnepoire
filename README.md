# Bluff Party

Jeu de bluff multijoueur asynchrone. Un joueur recoit une carte (question insolite
+ vraie reponse), invente de fausses reponses, et les autres repartissent un
budget de mise entre les propositions. Chacun joue quand il veut : aucune
connexion simultanee n'est necessaire.

**Statut : backend fonctionnel et teste. L'app mobile n'est pas encore
scaffoldee** (voir *Suite du plan* en bas).

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
- PostgreSQL en local (une base `bluff_party`)

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
createdb bluff_party
```

Puis renseigne `backend/.env` (copie de `backend/.env.example`) :

```
DATABASE_URL="postgresql://<user>@localhost:5432/bluff_party?schema=public"
PORT=4000
NODE_ENV=development
CORS_ORIGIN="*"
```

### Migrations + donnees de test

```bash
npm run db:migrate
npm run db:seed
```

Le seed installe **36 cartes** sur 3 thematiques (`nature-animaux`, `histoire`,
`faits-insolites`) et les 3 twists.

> Le contenu des cartes est un **placeholder** destine a faire tourner la boucle
> de jeu. Les reponses n'ont pas ete verifiees une par une — a relire avant toute
> mise en ligne publique. Il vit dans `backend/prisma/seed/cards.ts`.

### Lancer l'API

```bash
npm run dev:backend
```

L'API ecoute sur `http://localhost:4000`. Verification : `curl localhost:4000/health`.

### Tests

```bash
npm test
```

59 tests : moteur de score pur, machine a etats, et une suite end-to-end qui
joue des parties completes via HTTP. Les tests e2e utilisent une base separee
`bluff_party_test` (creee avec `createdb bluff_party_test`, puis
`DATABASE_URL=... npx prisma migrate deploy` depuis `backend/`). Surchargeable
avec `TEST_DATABASE_URL`.

### Outils

```bash
npm run db:studio   # explorateur Prisma
npm run build       # compile shared + backend
```

---

## Architecture

```
bluff-party/
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
└── mobile/          # (a venir) Expo + expo-router
```

Le dossier `game/` ne fait aucune I/O : tout entre par les arguments. C'est ce
qui permet de tester l'integralite des regles sans base de donnees, et de les
faire evoluer sans toucher aux routes.

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
| 4. Mobile : onboarding, salon, les 3 ecrans de round | **a faire** |
| 5. Twists supplementaires, contenu editorial | a faire |
| 6. Notifications push (le mode asynchrone en a besoin) | a faire |
| 7. Deploiement Railway | config prete, non deployee |
| 8. Polish visuel, assets d'avatars definitifs | a faire |

### Points ouverts

- **Notifications push.** Un jeu asynchrone sans notification ne tourne pas : les
  joueurs oublient leur tour. A prevoir avant tout test reel a plusieurs
  (Expo Notifications + un champ `pushToken` sur `User`).
- **Resolution automatique a la deadline.** Aujourd'hui la deadline autorise la
  resolution mais ne la declenche pas : il faut qu'un joueur appelle
  `POST /rounds/:id/resolve`. Un cron Railway reglerait ca proprement.
- **Equipes.** Le schema prevoit `SessionPlayer.teamId`, mais rien ne l'utilise.
- **Magic link.** `User.email` existe deja ; il ne manque qu'un provider d'envoi
  et une table de tokens a expiration.
