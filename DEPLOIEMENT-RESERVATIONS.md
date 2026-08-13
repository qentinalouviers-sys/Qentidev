# 📋 Récapitulatif de service & validation des réservations

Ce guide met en place le système demandé :

- les réservations du site sont **enregistrées** ;
- **2 h avant chaque service** (au moment où le site bloque les réservations),
  vous recevez **un email** avec la liste des réservations et un lien vers la
  **feuille de service** ;
- sur cette feuille, chaque réservation a un **bouton vert « Valider »** et un
  **bouton rouge « Refuser »** ; le clic ouvre le **message au client déjà
  rédigé**, que vous modifiez si besoin, puis vous l'envoyez par email,
  WhatsApp ou SMS en un geste.

Durée : ~20 minutes. **Tout est gratuit** : aucun service payant, aucun compte
à créer en dehors de Cloudflare, que vous avez déjà.

> Tant que vous n'avez pas terminé ce guide, **rien ne change** sur le site :
> les demandes continuent d'arriver par email comme aujourd'hui.

---

## Pourquoi c'est gratuit

| Besoin | Solution retenue | Coût |
|---|---|---|
| Héberger le mini-serveur | Cloudflare Workers | gratuit (100 000 requêtes/jour) |
| Stocker les réservations | Cloudflare D1 | gratuit (5 Go) |
| Vous envoyer le récap | **Web3Forms**, déjà utilisé par le site | gratuit (250 envois/mois) |
| Écrire au client | **votre propre messagerie**, WhatsApp ou SMS | gratuit |

Aucun service d'emailing tiers n'est nécessaire. Les réponses aux clients
partent de **votre vraie adresse**, ce qui est mieux : le client peut vous
répondre directement, et rien ne tombe dans les indésirables.

---

## Étape 1 — Récupérer votre clé Web3Forms

Elle est déjà dans le site. Ouvrez `index.html` et cherchez la ligne :

```html
<input type="hidden" name="access_key" value="..." />
```

Copiez la valeur. C'est la même clé qui reçoit déjà vos demandes de
réservation — pas de nouveau compte à créer.

---

## Étape 2 — Créer la base de données

1. Tableau de bord Cloudflare → **« Storage & Databases » → « D1 SQL Database »**.
2. **« Create database »**, nommez-la **`qentina-resa`**, validez.
3. Ouvrez l'onglet **« Console »** de la base, collez ceci et exécutez :

```sql
CREATE TABLE reservations (
  id          TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL,
  date        TEXT NOT NULL,
  time        TEXT NOT NULL,
  slot_min    INTEGER NOT NULL,
  service     TEXT NOT NULL,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  email       TEXT,
  guests      TEXT,
  place       TEXT,
  message     TEXT,
  newsletter  TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',
  handled_at  TEXT,
  reply       TEXT
);

CREATE INDEX idx_service ON reservations (date, service);

CREATE TABLE recaps (
  key      TEXT PRIMARY KEY,
  sent_at  TEXT NOT NULL
);
```

---

## Étape 3 — Créer le Worker

1. **« Workers & Pages » → « Create » → « Create Worker »**.
2. Nommez-le **`qentina-resa`**, puis **« Deploy »**.
3. **« Edit code »** : effacez tout et collez le contenu de
   [`worker-reservations.js`](./worker-reservations.js).
4. **« Deploy »**.

Notez son adresse, du type :

```
https://qentina-resa.VOTRE-SOUS-DOMAINE.workers.dev
```

---

## Étape 4 — Les réglages du Worker

Dans le Worker → **« Settings » → « Variables and Secrets »**, ajoutez :

| Nom | Type | Valeur |
|---|---|---|
| `WEB3FORMS_KEY` | Secret | la clé de l'étape 1 |
| `SIGNING_SECRET` | Secret | une longue phrase au hasard, ≥ 32 caractères |
| `RESTAURANT_EMAIL` | Texte | `qentina.louviers@gmail.com` |
| `ALLOWED_ORIGIN` | Texte | `https://qentina.fr` |
| `PUBLIC_URL` | Texte | l'adresse du Worker, **sans `/` final** |

> `SIGNING_SECRET` protège la feuille de service et les boutons : sans lui,
> n'importe qui devinant l'adresse pourrait lire vos réservations ou en valider
> une à votre place. Tapez n'importe quoi de long, vous n'aurez jamais à vous
> en souvenir.

Puis **« Settings » → « Bindings » → « Add » → « D1 database »** :

- **Variable name** : `DB`
- **D1 database** : `qentina-resa`

Enregistrez et redéployez.

---

## Étape 5 — Le déclenchement automatique

Dans le Worker → **« Settings » → « Triggers » → « Cron Triggers » → « Add »** :

```
*/15 * * * *
```

Le Worker se réveille toutes les 15 minutes, regarde si le blocage d'un service
vient de tomber, et envoie le récap le cas échéant. **Un seul email par
service**, et **aucun email s'il n'y a aucune réservation**.

---

## Étape 6 — Brancher le site

Dans `script.js`, tout en haut, remplissez :

```js
var RESA_ENDPOINT = "";
```

avec l'adresse de votre Worker. **Dites-le-moi et je m'en occupe** — c'est une
ligne à changer.

---

## Comment ça se passe au quotidien

**17h00, service du soir.** Le site vient de fermer les réservations. Vous
recevez un email :

> **6 réservations — service du soir, mardi 18 août**
> Service : Soir — mardi 18 août
> Résumé : 6 réservations · 14 couverts
> Détail :
> 19h30 — Marie Demange · 2 personnes · 06 12 34 56 78 · « Anniversaire »
> 20h00 — Potin · 4 personnes · 06 98 76 54 32
> Feuille de service : https://qentina-resa…/service?t=…

**Vous ouvrez la feuille de service.** Chaque réservation y est affichée avec
ses deux boutons. Vous cliquez sur **✅ Valider** : le message est déjà écrit.

> Bonjour Marie,
>
> C'est confirmé : nous vous attendons le mardi 18 août à 19h30 pour
> 2 personnes (Terrasse). […]

Vous le modifiez si vous voulez, vous enregistrez, puis vous choisissez le
canal : **✉️ Par email** (ouvre votre messagerie avec tout de pré-rempli),
**WhatsApp**, **SMS** ou **Appeler**.

La feuille se met à jour : la réservation passe en « ✅ Validée ». Vous pouvez
rouvrir le lien autant de fois que nécessaire pendant le service.

---

## Bon à savoir

**Rien n'est perdu si le Worker tombe.** Le site continue d'envoyer chaque
demande par email via Web3Forms, exactement comme aujourd'hui. Le récap est
un **plus**, jamais l'unique canal.

**La limite Web3Forms.** L'offre gratuite couvre 250 envois par mois. Vous êtes
autour de 36 réservations + une soixantaine de récaps, soit ~100. De la marge,
mais si votre activité double, il faudra surveiller.

**Les horaires sont écrits à deux endroits.** `script.js` (le site) et
`worker-reservations.js` (le serveur) contiennent chacun `SERVICES` et
`CLOSURES`. Si vous changez vos horaires ou ajoutez une fermeture,
**il faut modifier les deux** — sinon le site et le récap ne seront plus
d'accord. Demandez-le-moi, je fais les deux d'un coup.

**Vos données restent chez vous.** La base est la vôtre, hébergée chez
Cloudflare. Aucune plateforme ne s'intercale entre vous et vos clients, aucune
commission par couvert.
