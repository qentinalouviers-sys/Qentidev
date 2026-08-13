# 📋 Récapitulatif de service & validation des réservations

Ce guide met en place le système demandé :

- les réservations du site sont **enregistrées** ;
- **2 h avant chaque service** (au moment où le site bloque les réservations),
  vous recevez **un seul email** avec toutes les réservations du service ;
- chaque réservation a un **bouton vert « Valider »** et un **bouton rouge
  « Refuser »** ; le clic ouvre une page où le **message au client est déjà
  écrit** — vous le modifiez si besoin, puis vous envoyez.

Durée : ~25 minutes. **Tout est gratuit**, aucune carte bancaire requise.

> Tant que vous n'avez pas terminé ce guide, **rien ne change** sur le site :
> les demandes continuent d'arriver par email comme aujourd'hui.

---

## Ce dont vous avez besoin

| Service | Pourquoi | Coût |
|---|---|---|
| Cloudflare | héberge le mini-serveur et la base | gratuit |
| Brevo | envoie les emails (récap + réponses aux clients) | gratuit, 300 emails/jour |

Vous avez déjà un compte Cloudflare si vous avez suivi
[`DEPLOIEMENT-AVIS.md`](./DEPLOIEMENT-AVIS.md).

---

## Étape 1 — Créer le compte Brevo

1. Inscrivez-vous sur https://www.brevo.com/fr/ (offre gratuite).
2. Menu **« Expéditeurs, domaines »** → ajoutez une adresse d'expédition
   et **validez-la** (Brevo envoie un email de confirmation).
   Utilisez de préférence une adresse à vous, ex. `contact@qentina.fr`.
   À défaut, votre Gmail fonctionne aussi.
3. Menu **« SMTP & API » → onglet « Clés API » → « Générer une nouvelle clé »**.
   Nommez-la `qentina-resa` et **copiez-la**.

⚠️ **Ne me communiquez jamais cette clé dans la conversation.** Vous la collerez
directement dans Cloudflare à l'étape 4.

---

## Étape 2 — Créer la base de données

1. Tableau de bord Cloudflare → **« Storage & Databases » → « D1 SQL Database »**.
2. **« Create database »**, nommez-la **`qentina-resa`**, validez.
3. Ouvrez l'onglet **« Console »** de la base et collez ceci, puis exécutez :

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
| `BREVO_API_KEY` | Secret | la clé copiée à l'étape 1 |
| `SIGNING_SECRET` | Secret | une longue phrase au hasard, ≥ 32 caractères |
| `RESTAURANT_EMAIL` | Texte | `qentina.louviers@gmail.com` |
| `SENDER_EMAIL` | Texte | l'adresse validée dans Brevo |
| `ALLOWED_ORIGIN` | Texte | `https://qentina.fr` |
| `PUBLIC_URL` | Texte | l'adresse du Worker (étape 3, **sans `/` final**) |

> `SIGNING_SECRET` protège les boutons Valider/Refuser : sans lui, n'importe qui
> pourrait fabriquer un lien et valider une réservation à votre place.
> Tapez n'importe quoi de long, vous n'aurez jamais à vous en souvenir.

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

Le Worker se réveille toutes les 15 minutes, regarde s'il y a un service dont
le blocage vient de tomber, et envoie le récap le cas échéant. **Un seul email
par service**, même s'il se réveille plusieurs fois.

S'il n'y a aucune réservation pour ce service, **aucun email n'est envoyé** —
inutile de vous encombrer.

---

## Étape 6 — Brancher le site

Dans le fichier `script.js`, tout en haut, remplissez la ligne :

```js
var RESA_ENDPOINT = "";
```

avec l'adresse de votre Worker :

```js
var RESA_ENDPOINT = "https://qentina-resa.VOTRE-SOUS-DOMAINE.workers.dev";
```

Puis publiez. **Dites-le-moi et je m'en occupe** — c'est une ligne à changer.

---

## Comment ça se passe au quotidien

**17h00, service du soir.** Le site vient de fermer les réservations en ligne.
Vous recevez :

> **6 réservations — service du soir, mardi 18 août**
> 6 réservations · 14 couverts
>
> **19h30 — Marie Demange · 2 personnes**
> 06 12 34 56 78 · marie@example.com — Terrasse
> 💬 Anniversaire
> **[ ✅ Valider ]  [ ❌ Refuser ]**

**Vous cliquez sur Valider.** Une page s'ouvre avec le message déjà rédigé :

> Bonjour Marie,
>
> C'est confirmé : nous vous attendons le mardi 18 août à 19h30 pour
> 2 personnes (Terrasse). […]

Vous le modifiez si vous voulez, vous envoyez — le client reçoit l'email.

**Et si le client n'a pas laissé d'email ?** (c'est le cas d'environ une
demande sur deux, le champ est facultatif). La page vous propose alors trois
boutons : **WhatsApp**, **SMS** et **Appeler**, tous pré-remplis avec le même
message. Un appui et c'est parti.

---

## Bon à savoir

**Rien n'est perdu si le Worker tombe.** Le site continue d'envoyer chaque
demande par email via Web3Forms, exactement comme aujourd'hui. Le récap est
un **plus**, jamais l'unique canal.

**Les horaires sont écrits à deux endroits.** `script.js` (le site) et
`worker-reservations.js` (le serveur) contiennent chacun la liste `SERVICES` et
`CLOSURES`. Si vous changez vos horaires ou ajoutez une fermeture,
**il faut modifier les deux** — sinon le site et le récap ne seront plus
d'accord. Demandez-le-moi, je fais les deux d'un coup.

**Les limites de l'offre gratuite.** Brevo : 300 emails/jour, très largement
au-dessus de vos besoins (2 récaps + quelques réponses par jour).
Cloudflare : 100 000 requêtes/jour et 5 Go de base.

**Vos données restent chez vous.** La base est la vôtre, hébergée chez
Cloudflare. Aucune plateforme tierce ne s'intercale entre vous et vos clients,
aucune commission par couvert.
