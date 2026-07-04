# QENTINA — Plan de salle & réservations 🍽️

Outil **interne** pour gérer les réservations et le plan de salle du restaurant,
directement dans le navigateur. Aucune installation, aucun compte, aucune donnée
envoyée sur Internet : tout est enregistré **localement** dans le navigateur
(localStorage).

Accessible à l'adresse : **`/salle/`** (ex. `https://qentina.fr/salle/`).

## Ce que l'outil permet

- **Un plan de salle par jour** — le plan change souvent ; chaque date garde le
  sien. Un bouton permet de **reprendre un plan existant** pour ne pas tout
  recommencer.
- **Éditer le plan en glisser-déposer** :
  - Ajouter des tables **carrées**, **rondes** ou **longues**
  - Les **déplacer** (glisser), les **redimensionner** (poignée orange), régler
    le **nombre de couverts** et leur **numéro/nom**
- **Composer une grande table** — sélectionner plusieurs tables
  (clic + `Maj`/`Ctrl`-clic) puis « Composer une grande table » : elles forment
  une seule unité dont les couverts s'additionnent. « Dissocier » pour annuler.
- **Attribuer une réservation à une table** — créer la réservation puis la
  **glisser** sur une table du plan (fonctionne à la **souris** comme au
  **tactile** sur tablette). Un ✕ sur l'étiquette libère la table.
- **Services Midi / Soir** séparés, statistiques en bas (tables, couverts,
  couverts placés, en attente), alerte ⚠︎ si une réservation dépasse la
  capacité de la table.

## Prise en main rapide

1. **Éditer le plan** (bouton en haut à droite) → placer/organiser les tables du
   jour.
2. Revenir sur **Réservations** → ajouter les réservations (nom, heure,
   couverts).
3. **Glisser** chaque réservation sur sa table. Composer une grande table pour
   les gros groupes.

## Notes techniques

- 100 % statique (HTML / CSS / JS), aucune dépendance ni build.
- Les données restent sur l'appareil utilisé : pour partager le même plan entre
  plusieurs postes, il faudrait ajouter une synchronisation serveur (évolution
  possible).
- Page non indexée (`noindex`).

## Fichiers

```
salle/
├── index.html   # structure
├── salle.css    # styles (charte QENTINA)
└── salle.js     # logique : plan, glisser-déposer, groupes, réservations
```
