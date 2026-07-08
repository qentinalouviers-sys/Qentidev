# Mise en Place — QENTINA 🍕

Petit outil interne (« sas ») dédié à la **bonne gestion et à la mise en place**
du restaurant QENTINA. Aucune dépendance, aucun build : une app web autonome
qui fonctionne directement dans le navigateur.

## Modules

- **Tableau de bord** — vue d'ensemble avant le service : avancement de la mise
  en place, stocks à surveiller, tâches ouvertes et alertes.
- **Mise en place** — checklists par poste (ouverture, pizza, froid/salades,
  salle, bar, fermeture). Les cases se **réinitialisent automatiquement chaque
  jour**.
- **Stocks** — inventaire avec quantités, unités et seuils mini. Ajustement
  rapide (+ / −), ajout/modif/suppression, et **alertes de seuil bas / rupture**.
- **Tâches** — liste de tâches avec priorités (basse / normale / haute).

## Lancer l'outil

```bash
# depuis la racine du dépôt
python3 -m http.server 8000
# puis ouvrir http://localhost:8000/mise-en-place/
```

Ou ouvrir simplement `mise-en-place/index.html` dans un navigateur.

## Données

Tout est enregistré **localement** sur l'appareil via `localStorage`
(clé `qentina.miseenplace.v1`). Rien n'est envoyé sur un serveur. Les données
restent donc propres à chaque navigateur / appareil.

## Personnalisation

- **Postes & checklists par défaut** : constante `DEFAULT_STATIONS` dans `app.js`
- **Inventaire de départ** : constante `SEED_STOCK` dans `app.js`
- **Couleurs & polices** : variables CSS `:root` dans `app.css` (identité QENTINA)
