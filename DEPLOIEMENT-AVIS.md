# 🔐 Installer les avis Google en toute sécurité

Ce guide met en place un **proxy** : un mini-serveur gratuit (Cloudflare Worker)
qui garde votre **clé API Google secrète**. Le site web n'appelle que ce proxy,
la clé n'apparaît donc **jamais** dans le code public.

Durée : ~10 minutes. Aucune carte bancaire requise pour Cloudflare.

---

## Étape 1 — Préparer la clé Google (côté Google Cloud)

1. Allez sur https://console.cloud.google.com/
2. Créez un projet (ou réutilisez le vôtre).
3. Menu **« API et services » → « Bibliothèque »** : activez **« Places API »**
   (l'ancienne, suffisante ici) — ou **« Places API (New) »**.
4. Menu **« API et services » → « Identifiants »** : votre **clé API** est là
   (ou créez-en une).
5. **Sécurisez-la** (recommandé) :
   - **Restrictions liées aux API** → cochez uniquement **Places API**.
   - Définissez un **quota** / une **alerte de budget** pour éviter toute surprise.
   > Pas besoin de restriction par domaine ici : la clé n'est utilisée que par
   > le proxy, jamais exposée publiquement.

⚠️ **Ne me communiquez pas la clé dans la conversation.** Vous la collerez
directement dans Cloudflare à l'étape 3.

---

## Étape 2 — Créer le Worker Cloudflare

1. Créez un compte gratuit sur https://dash.cloudflare.com/sign-up
2. Dans le tableau de bord : **« Workers & Pages » → « Create » → « Create Worker »**.
3. Donnez-lui un nom, ex. **`qentina-avis`**, puis **« Deploy »**.
4. Cliquez sur **« Edit code »**.
5. **Effacez** le code par défaut et **collez tout le contenu** du fichier
   [`worker.js`](./worker.js) de ce dépôt.
6. Cliquez sur **« Deploy »**.

Votre proxy a maintenant une adresse du type :
```
https://qentina-avis.VOTRE-SOUS-DOMAINE.workers.dev
```
Notez-la, elle servira à l'étape 4.

---

## Étape 3 — Ajouter la clé (en secret) dans le Worker

Dans votre Worker : **« Settings » → « Variables and Secrets »**, ajoutez :

| Nom | Type | Valeur |
|-----|------|--------|
| `GOOGLE_API_KEY` | **Secret** (chiffré) | votre clé API Google |
| `ALLOWED_ORIGIN` | Text | `https://qentinalouviers-sys.github.io` |
| `PLACE_ID` | Text *(optionnel)* | l'identifiant exact de votre établissement |

> **Trouver votre PLACE_ID** (optionnel mais plus précis) :
> https://developers.google.com/maps/documentation/places/web-service/place-id
> Si vous ne le mettez pas, le proxy recherche automatiquement
> « QENTINA pizzeria 20 rue Maréchal Foch 27400 Louviers ».

Cliquez sur **« Deploy »** pour enregistrer.

✅ **Test** : ouvrez l'adresse de votre Worker dans le navigateur — vous devez
voir s'afficher vos avis au format texte (JSON).

---

## Étape 4 — Brancher le site sur le proxy

Communiquez-moi simplement **l'adresse de votre Worker**
(ex. `https://qentina-avis.xxxx.workers.dev`).

Je remplacerai alors `__WORKER_URL__` dans le fichier `reviews.js`, je pousserai
la modification, et **vos vrais avis Google apparaîtront automatiquement** sur le
site — mis à jour tout seuls, sans aucune clé visible. 🎉

---

### Récapitulatif sécurité
- 🔒 La clé est stockée **chiffrée** chez Cloudflare, jamais dans le site ni sur GitHub.
- 🌐 Le proxy n'accepte que votre domaine (`ALLOWED_ORIGIN`).
- ⏱️ Les réponses sont **mises en cache ~1h** : très peu d'appels à Google (coût quasi nul).
