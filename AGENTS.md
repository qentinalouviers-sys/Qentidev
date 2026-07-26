# QENTINA — Pizzeria à Louviers 🍕

Site web vitrine pour **QENTINA**, pizzeria artisanale située à Louviers (27).

## 📁 Structure du projet

```
Qentidev/
├── index.html                 # Page d'accueil (one-page)
├── pizzeria-louviers.html     # Page présentation pizzeria
├── pizza-val-de-reuil.html    # Page pizzeria Val-de-Reuil
├── bonnes-adresses-louviers.html  # Pages bonnes adresses
├── terroir-normand-louviers.html   # Page terroir normand
├── traiteur.html              # Page traiteur
├── styles.css                 # Styles + animations CSS
├── script.js                  # Interactions JS (menu, défilement, formulaire)
├── intro.js                   # Animation d'intro
├── reviews.js                 # Avis Google (via Cloudflare Worker)
├── embers.js                  # Effet braises/pizza animée
├── worker.js                  # Cloudflare Worker proxy pour les avis Google
├── banner.jpg                 # Image bannière
├── hero-pizza.jpg             # Image héro
├── carte-1.jpg / carte-2.jpg / carte-3.jpg  # Photos cartes
├── logo.jpg                   # Logo
├── traiteur.jpg               # Photo traiteur
├── CNAME                      # → qentina.fr (domaine personnalisé)
├── robots.txt                 # SEO
├── sitemap.xml                # SEO
├── .nojekyll                  # Désactive Jekyll pour GitHub Pages
├── .github/workflows/
│   └── deploy-pages.yml       # Déploiement automatique GitHub Pages
├── DEPLOIEMENT-AVIS.md        # Doc : installer les avis Google
├── AGENTS.md                  # 👈 Ce fichier — contexte pour l'IA
└── README.md                  # Documentation
```

## 🌐 Déploiement

- **Hébergement** : GitHub Pages avec domaine personnalisé `qentina.fr`
- **Déclencheur** : push sur `main` → déploiement auto (via `.github/workflows/deploy-pages.yml`)
- **Les branches `claude/*` sont aussi déployées** (compatibilité Claude Code)

## 🚀 Workflow de développement

### 1. Toujours partir de `main`
```bash
git checkout main && git pull origin main
```

### 2. Créer une branche
```bash
git checkout -b feat/description-du-changement
```
Conventions de nommage :
- `feat/...` → nouvelle fonctionnalité
- `fix/...` → correction de bug
- `content/...` → mise à jour de contenu/texte
- `design/...` → changements visuels/CSS

### 3. Faire les modifications
Utiliser les fichiers listés ci-dessus.

### 4. Commiter
```bash
git add <fichiers>
git commit -m "type: description concise"
```
Types : `feat`, `fix`, `content`, `design`, `refactor`

### 5. Pousser et créer une PR
```bash
git push -u origin HEAD
gh pr create --title "type: description" --body "## Changements\n- Liste des changements"
```

### 6. Merger sur `main`
Une fois la PR approuvée, merger → déploiement automatique sur qentina.fr.

### 7. Supprimer la branche
```bash
git checkout main && git pull origin main
git branch -d feat/description
```

## 🎨 Guide de style

- **Couleurs & polices** : variables CSS dans `styles.css` (`:root`)
- **Contenu (carte, prix, textes)** : directement dans les fichiers `.html`
- **Images** : remplacer les fichiers `.jpg` par des versions optimisées
- **Coordonnées** (adresse, horaires, téléphone) : section `#infos` de chaque page

## 🔐 Accès et services

- **Domaine** : `qentina.fr` (OVH)
- **Avis Google** : via Cloudflare Worker (voir `DEPLOIEMENT-AVIS.md`)
- **Repo GitHub** : `qentinalouviers-sys/Qentidev`
