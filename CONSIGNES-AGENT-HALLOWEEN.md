# Consignes agent — Concours Halloween QENTINA 2026

Mission : rendre opérationnels les deux jeux concours déjà en ligne, puis assurer
le suivi jusqu'à la finale. Lire aussi `AGENTS.md` (workflow du dépôt) et
`DEPLOIEMENT-CONCOURS.md` (guide détaillé Cloudflare).

## Contexte

| Élément | Où | État au 21/10/2026 |
|---|---|---|
| Jeu « La Nuit du Four Hanté » | https://qentina.fr/halloween/ — `halloween/index.html` | en ligne, mode entraînement |
| Roue d'Halloween (1 tour / email) | https://qentina.fr/halloween/roue.html — `halloween/roue.html` | en ligne, « ouverture le 24 » |
| Règlement | https://qentina.fr/halloween/reglement.html | en ligne |
| Serveur scores + roue | `worker-concours.js` (Cloudflare Worker + D1) | **à déployer** |
| Site | GitHub Pages, push sur `main` = mise en ligne en 1–2 min | |

Calendrier : classement et roue ouverts du **samedi 24/10 0 h** au **vendredi 30/10 23 h 59** (Paris).
Finale live **samedi 31/10 à 18 h 30** au restaurant. Les dates sont codées en dur côté serveur
(`START`, `END`) et côté pages (`CONFIG.start`, `CONFIG.end`) : ne pas les modifier.

---

## Étape 1 — Déployer le serveur (avant vendredi 23/10 23 h)

1. **Base D1** `qentina-concours` : exécuter tout le bloc SQL de `DEPLOIEMENT-CONCOURS.md` (étape 1).
   Il crée 4 tables : `players`, `plays`, `wheel_spins`, `wheel_lots`.
2. **Worker** `qentina-concours` : code = contenu exact de `worker-concours.js`, sans modification.
3. **Liaisons** :
   - binding D1 nommé exactement `DB` → base `qentina-concours`
   - secret `ADMIN_KEY` : générer une chaîne aléatoire d'au moins 24 caractères.
     **Ne jamais la committer ni la publier.** La transmettre à Yohan par un canal privé.
   - (facultatif) `ALLOWED_ORIGINS` : laisser vide, la valeur par défaut est `https://qentina.fr,https://www.qentina.fr`.
4. **Cron RGPD** : Triggers → Cron → `0 3 * * *` (vide la base à partir du 31/01/2027).

Avec wrangler, l'équivalent est : `wrangler d1 create qentina-concours`, `wrangler d1 execute
qentina-concours --remote --file schema.sql`, `wrangler secret put ADMIN_KEY`, `wrangler deploy`
avec un `wrangler.toml` déclarant `[[d1_databases]] binding = "DB"` et `[triggers] crons = ["0 3 * * *"]`.

## Étape 2 — Vérifier le serveur

Remplacer `API` par l'adresse du Worker (ex. `https://qentina-concours.xxx.workers.dev`).

| Commande | Réponse attendue |
|---|---|
| `curl API/api/top` | `{"top":[],"players":0}` |
| `curl API/api/wheel` | JSON avec `"open":false` avant le 24/10 |
| `curl -X POST API/api/scores -H 'Content-Type: application/json' -d '{}'` | `{"error":"not_started"}` (403) avant le 24/10 |
| `curl -X POST API/api/wheel -H 'Content-Type: application/json' -d '{}'` | `{"error":"not_started"}` (403) avant le 24/10 |
| `curl -i -X OPTIONS API/api/scores -H 'Origin: https://qentina.fr'` | `204` + `Access-Control-Allow-Origin: https://qentina.fr` |
| `curl "API/api/admin/export?key=MAUVAISE"` | `{"error":"forbidden"}` (403) |

## Étape 3 — Tirer les instants gagnants de la roue (avant le 24/10)

Ouvrir **une seule fois** : `API/api/admin/wheel-init?key=ADMIN_KEY`
Réponse attendue : `{"ok":true,"lots":[...]}` avec la date du tirage (`tire_au_sort_le`) **antérieure au 24/10**.
C'est la preuve que les instants ont été fixés avant l'ouverture (exigence du règlement, art. 7 bis).
Le rappeler est sans effet (idempotent). **Ne pas chercher à lire les instants avant la clôture.**

## Étape 4 — Brancher le site

Dans **les deux fichiers**, remplacer `apiBase: '',` par l'adresse du Worker, sans `/` final :
- `halloween/index.html` (bloc `CONFIG`)
- `halloween/roue.html` (bloc `CONFIG`)

Branche `feat/branchement-concours`, commit, merge sur `main`, push. Attendre la fin du workflow
« Déploiement GitHub Pages ».

Vérifier ensuite sur https://qentina.fr/halloween/ (forcer le rechargement) :
- avant le 24/10 : la note « le classement ouvre samedi 24 octobre » reste affichée, c'est normal ;
- aucune erreur dans la console du navigateur.

## Interdits

- **Ne jamais faire de tour de roue de test en production** : un test peut consommer un instant
  gagnant (1 an de pizzas ou plein) ou un tiramisu du stock. Les vérifications se font avant le 24/10
  (réponses `not_started`) ou en local avec `wrangler dev`.
- Ne pas inscrire de faux scores au classement après l'ouverture.
- Ne pas modifier les lots, quantités, dates ou textes du règlement sans accord écrit de Yohan.
- Ne pas exposer `ADMIN_KEY`, ni les exports CSV (ils contiennent des emails).

---

## Pendant le concours (24 → 30/10)

**Chaque matin vers 9 h** (champion de la veille) :
`API/api/admin/export?what=daily&key=ADMIN_KEY` → envoyer à Yohan le pseudo et l'email du champion
de la veille (1 pizza offerte ; un même joueur ne gagne qu'une fois, l'export le gère déjà).
Proposer une story : « Champion du jour : <pseudo> avec <score> points ».

**Chaque jour** : `curl API/api/top` et `curl API/api/wheel` → courte synthèse (joueurs inscrits,
top 5, tiramisus restants, gros lots de la roue encore en jeu). Signaler à Yohan tout pseudo
choquant ou score anormal ; masquage uniquement sur son accord :
`UPDATE players SET hidden = 1 WHERE pseudo = '…';` (console D1).

**Codes à vérifier au comptoir** : `TIRA-XXXXX` (jeu) dans `export?what=players`,
`ROUE-XXXXX` (roue) dans `export?what=wheel`.

## Samedi 31/10 — Finale

- **8 h** : `API/api/admin/export?what=finalists&key=ADMIN_KEY` → préparer pour Yohan l'email aux 5 finalistes
  (finale à 18 h 30, 20 rue Maréchal Foch, Louviers ; venir avec une pièce d'identité ;
  un absent est remplacé par le suivant du classement). Yohan valide avant envoi.
- **Avant 18 h 30** : `API/api/admin/export?what=instants&key=ADMIN_KEY` → gagnants des gros lots de la roue,
  à contacter (code `ROUE-…` + pièce d'identité).
- **Pendant la finale** : tirage du plein d'essence du jeu : `API/api/admin/draw?n=1&key=ADMIN_KEY`
  (un seul appel, en direct, résultat conservé par capture d'écran).

## Après le concours

- **1er novembre** : retirer le bandeau `#bandeau-halloween` de `index.html` (bloc commenté
  « BANDEAU TEMPORAIRE ») et remplacer la note du jeu par « Concours terminé » si besoin.
- **Avant le 31/01/2027** : exporter les joueurs `newsletter = oui` (seuls contacts réutilisables),
  puis laisser le cron vider la base. Ne conserver aucun autre export.

---

## Communication réseaux

Visuels fournis à Yohan : `affiche-four-hante-A4.pdf` (affichage restaurant, QR codes vérifiés :
gauche = jeu, droite = roue) et `post-four-hante-1080x1350.png` (Instagram / Facebook).

Planning proposé :
| Quand | Quoi |
|---|---|
| Mer. 21 ou jeu. 22/10 | Post d'annonce (« ouverture samedi, entraîne-toi dès maintenant ») |
| Ven. 23/10 soir | Affiche imprimée et posée (vitrine, comptoir, ardoise) |
| Sam. 24/10 0 h–9 h | Post « C'est parti » + story avec lien `https://qentina.fr/halloween/` |
| 25 → 30/10 | Story quotidienne champion du jour + rappel de la roue |
| Ven. 30/10 | « Dernières heures pour entrer dans le top 5 » |
| Sam. 31/10 | Live / stories de la finale, annonce des gagnants (pseudos uniquement) |

Texte du post d'annonce :

> 🎃 Cette nuit, le four se réveille. Et il a faim.
>
> Du 24 au 30 octobre, QENTINA vous propose un double jeu concours d'Halloween :
> 🔥 Séance 1 — La Nuit du Four Hanté : sortez les pizzas du four sans toucher l'ananas maudit. Le top 5 joue la finale live le 31 octobre à 18 h 30.
> 🎡 Séance 2 — La Roue d'Halloween : pas joueur ? Un email = un tour de roue.
>
> À gagner : 1 an de pizzas, des pleins d'essence et 250 tiramisus.
> 100 % gratuit, sans achat. Entraînez-vous dès maintenant 👉 qentina.fr/halloween
>
> Jeux gratuits réservés aux 18 ans et plus. Règlement sur qentina.fr/halloween
> #Louviers #Halloween #Pizza #FeuDeBois #JeuConcours #QENTINA

Ne jamais publier d'email de joueur ; les pseudos seuls peuvent être cités.
