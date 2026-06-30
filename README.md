# QENTINA — Pizzeria à Louviers 🍕

Site web vitrine moderne pour la pizzeria artisanale **QENTINA**, située à Louviers.

## ✨ Aperçu

Un site **one-page** responsive, élégant et animé, conçu pour mettre en valeur
la pizzeria, sa carte et ses informations pratiques.

### Fonctionnalités

- **Design moderne** dans l'air du temps (palette chaleureuse, typographie soignée)
- **Animations fluides** : apparition au défilement, bandeau défilant, pizza animée, curseur personnalisé
- **100 % responsive** (mobile, tablette, ordinateur) avec menu mobile
- **Carte des pizzas** signature avec prix
- **Section histoire** de la maison
- **Informations pratiques** (adresse, horaires, téléphone)
- **Formulaire de réservation** avec validation
- **Accessibilité** : respect de `prefers-reduced-motion`, navigation au clavier

## 🚀 Lancer le site

Aucune dépendance, aucun build. Il suffit d'ouvrir le fichier `index.html`
dans un navigateur, ou de lancer un petit serveur local :

```bash
# avec Python
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## 📁 Structure

```
.
├── index.html   # Structure et contenu
├── styles.css   # Styles et animations
├── script.js    # Interactions (menu, défilement, formulaire)
└── README.md
```

## 🎨 Personnalisation

- **Couleurs & polices** : variables CSS en haut de `styles.css` (`:root`)
- **Carte / prix / textes** : directement dans `index.html`
- **Coordonnées** (adresse, horaires, téléphone) : section `#infos` de `index.html`

> Les images sont actuellement représentées par des emojis pour rester légères.
> Remplacez-les par de vraies photos de vos pizzas pour un rendu encore plus appétissant.
