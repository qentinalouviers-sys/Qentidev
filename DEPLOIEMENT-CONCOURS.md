# 🎃 Activer le concours « La Nuit du Four Hanté »

Le jeu est en ligne sur **https://qentina.fr/halloween/**. Tant que ce guide
n'est pas fait, il tourne en **mode entraînement** : on peut jouer et partager
son score, mais rien n'est enregistré et le bouton d'inscription n'apparaît pas.

Ce guide branche le mini-serveur qui enregistre les scores, tient le classement,
délivre les codes tiramisu et exporte les gagnants. Durée : **~10 minutes**.
**Gratuit** (Cloudflare Workers + D1, offre gratuite).

> ⏰ À faire **avant le mercredi 21 octobre 2026 à 18 h**, heure d'ouverture du classement et de la roue.

---

## Étape 1 — Créer la base de données

1. Tableau de bord Cloudflare → **« Storage & Databases » → « D1 SQL Database »**.
2. **« Create database »**, nommez-la **`qentina-concours`**, validez.
3. Onglet **« Console »** de la base : collez tout le bloc ci-dessous et exécutez.

```sql
CREATE TABLE players (
  email          TEXT PRIMARY KEY,
  pseudo         TEXT NOT NULL,
  best           INTEGER NOT NULL DEFAULT 0,
  best_pizzas    INTEGER NOT NULL DEFAULT 0,
  best_at        TEXT,
  newsletter     INTEGER NOT NULL DEFAULT 0,
  tiramisu_code  TEXT,
  hidden         INTEGER NOT NULL DEFAULT 0,
  plays          INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL,
  last_play_at   TEXT
);
CREATE UNIQUE INDEX players_pseudo ON players (pseudo COLLATE NOCASE);
CREATE INDEX players_rank ON players (hidden, best DESC, best_at);

CREATE TABLE plays (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT NOT NULL,
  score       INTEGER NOT NULL,
  pizzas      INTEGER NOT NULL,
  day         TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX plays_day ON plays (day, score DESC);

CREATE TABLE wheel_spins (
  email       TEXT PRIMARY KEY,
  result      TEXT NOT NULL,
  code        TEXT,
  newsletter  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);
CREATE INDEX wheel_result ON wheel_spins (result);

CREATE TABLE wheel_lots (
  id        INTEGER PRIMARY KEY,
  kind      TEXT NOT NULL,
  instant   TEXT NOT NULL,
  drawn_at  TEXT NOT NULL,
  email     TEXT,
  won_at    TEXT
);
```

---

## Étape 2 — Créer le Worker

1. **« Workers & Pages » → « Create » → « Create Worker »**.
2. Nommez-le **`qentina-concours`**, puis **« Deploy »**.
3. **« Edit code »** : effacez tout, collez le contenu de **`worker-concours.js`**
   (à la racine du dépôt), puis **« Deploy »**.

## Étape 3 — Brancher la base et le mot de passe

Dans le Worker → **« Settings »** :

1. **« Bindings » → « Add » → « D1 database »**
   - Variable name : **`DB`** (en majuscules, exactement)
   - Database : **`qentina-concours`**
2. **« Variables and Secrets » → « Add »**
   - Type **Secret**, nom **`ADMIN_KEY`**, valeur : un mot de passe à vous
     (ex. une phrase sans espace). Il protège les exports des gagnants.
3. **« Deploy »** pour appliquer.

## Étape 4 — Tester

Ouvrez dans le navigateur : `https://qentina-concours.VOTRE-SOUS-DOMAINE.workers.dev/api/top`

Vous devez voir : `{"top":[],"players":0}`. ✅

Puis ouvrez **une seule fois** :
`https://qentina-concours.VOTRE-SOUS-DOMAINE.workers.dev/api/admin/wheel-init?key=MOTDEPASSE`

Le serveur tire au sort, au hasard, les **instants gagnants** de la roue
(1 an de pizzas et plein d'essence) et note l'heure du tirage. Le faire
**avant le 21 octobre à 18 h** prouve que les instants ont été fixés avant l'ouverture.
Vous ne voyez pas les instants : ne cherchez pas à les connaître avant la fin,
c'est ce qui rend le tirage loyal. (Si vous oubliez, le serveur les tire tout
seul au premier tour de roue.)

## Étape 5 — Brancher le site

Envoyez l'adresse du Worker à Claude, **ou** faites-le vous-même :
dans **`halloween/index.html`**, cherchez la ligne

```js
apiBase: '',
```

et collez l'adresse entre les guillemets (sans `/` final), par exemple :

```js
apiBase: 'https://qentina-concours.mon-sous-domaine.workers.dev',
```

Poussez sur `main` : le site se met à jour en 1 à 2 minutes.
À partir du 21 octobre à 18 h, le bouton **« Inscrire mon score au concours »** apparaît.

---

## Pendant le concours

Remplacez `ADRESSE` par l'adresse du Worker et `MOTDEPASSE` par votre `ADMIN_KEY`.
Ces liens s'ouvrent depuis le téléphone et téléchargent un fichier Excel/CSV.

| Besoin | Lien |
|---|---|
| Tous les joueurs (emails, newsletter, codes tiramisu) | `ADRESSE/api/admin/export?what=players&key=MOTDEPASSE` |
| **Champion du jour** (meilleur score de chaque journée) | `ADRESSE/api/admin/export?what=daily&key=MOTDEPASSE` |
| **Les 5 finalistes** à prévenir le 31 au matin | `ADRESSE/api/admin/export?what=finalists&key=MOTDEPASSE` |
| **Tirage du plein d'essence** (à lancer pendant la finale) | `ADRESSE/api/admin/draw?n=1&key=MOTDEPASSE` |
| **Roue** : tous les tirages (email, lot, code) | `ADRESSE/api/admin/export?what=wheel&key=MOTDEPASSE` |
| **Roue** : instants gagnants et leurs gagnants (après le 30/10) | `ADRESSE/api/admin/export?what=instants&key=MOTDEPASSE` |

### Vérifier un code tiramisu au comptoir

Le client montre un code `TIRA-XXXXX` sur son téléphone. Il figure dans
l'export « tous les joueurs », colonne `code_tiramisu`. Un code par email,
100 codes au maximum : le serveur s'arrête tout seul au 100e.

### Codes de la roue

Les gains de la roue ont un code `ROUE-XXXXX`, visible dans l'export « roue ».
Gros lots (1 an de pizzas, plein d'essence) : le gagnant est aussi dans l'export
« instants » ; demandez une pièce d'identité à la remise, au nom du titulaire de l'email.

### Masquer un pseudo choquant

Le serveur refuse déjà les insultes courantes. Si un pseudo passe quand même,
dans la **Console** de la base D1 :

```sql
UPDATE players SET hidden = 1 WHERE pseudo = 'LePseudo';
```

Le joueur disparaît du classement et ne peut plus gagner.

### Un score paraît truqué

Même commande que ci-dessus. Le règlement prévoit l'exclusion des scores
anormaux, et la finale se joue de toute façon **en live sur la tablette du
restaurant** : seul le score réalisé sur place désigne le grand gagnant.

---

## Après le concours (RGPD)

Le règlement annonce la suppression des données **3 mois après la fin**,
soit le **31 janvier 2027**. Deux options :

- **Automatique** : Worker → « Settings » → « Triggers » → « Cron Triggers »
  → ajoutez `0 3 * * *`. Le Worker vide la base tout seul à partir du 31/01/2027.
- **Manuel** : le 31 janvier 2027, dans la Console D1 :
  ```sql
  DELETE FROM plays; DELETE FROM players; DELETE FROM wheel_spins; DELETE FROM wheel_lots;
  ```

Avant cette date, exportez la liste des joueurs ayant coché **newsletter = oui** :
ce sont les seuls que vous pouvez recontacter pour vos offres.
