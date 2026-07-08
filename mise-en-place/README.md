# Mise en Place — QENTINA 🍕

Petit outil interne dédié à la **bonne gestion et à la mise en place** du
restaurant QENTINA. Aucune dépendance, aucun build : app web statique qui
fonctionne directement dans le navigateur (et se déploie telle quelle).

Il y a **deux espaces** :

| Espace | Fichier | Pour qui | Rôle |
|--------|---------|----------|------|
| **Salarié** | `index.html` | le salarié | Voit et coche les mises en place du jour. Rien d'autre. |
| **Responsable** | `admin.html` | vous | Crée/modifie les postes et leurs tâches, gère stocks & tâches, et **génère le lien à envoyer au salarié**. |

## Comment ça marche

Le site étant **statique** (pas de serveur ni de base de données), la
configuration des postes voyage **dans le lien** que vous transmettez :

1. Ouvrez `admin.html`, saisissez le **code d'accès**.
2. Dans l'onglet **Mise en place**, créez vos postes et leurs tâches
   (ajouter / renommer / réordonner / supprimer). Tout s'enregistre au fur
   et à mesure.
3. Cliquez sur **« Copier le lien salarié »** et envoyez ce lien au salarié
   (SMS, WhatsApp…).
4. Le salarié ouvre le lien : il voit les checklists et coche au fil du
   service. Sa progression **se remet à zéro chaque jour**.

> À chaque modification des postes, **renvoyez le lien** pour transmettre la
> mise à jour (le salarié verra un bandeau « Liste mise à jour »).

## Code d'accès de l'espace responsable

Le code par défaut est `qentina`. **Changez-le** en modifiant la constante
`ADMIN_PASSCODE` en haut de `admin.js`.

> ⚠️ Cette protection est **légère** (côté navigateur, sur un site public).
> Elle empêche un accès accidentel, mais n'est pas une sécurité forte. Le
> vrai garde-fou : ne communiquez au salarié **que** le lien `index.html`,
> jamais l'adresse `admin.html`. Pour une vraie authentification, il
> faudrait un serveur.

## Lancer en local

```bash
# depuis la racine du dépôt
python3 -m http.server 8000
# salarié     → http://localhost:8000/mise-en-place/
# responsable → http://localhost:8000/mise-en-place/admin.html
```

## Données

- **Config des postes** : `localStorage` (`qentina.mep.config`) + transmise
  via le lien.
- **Avancement du jour** (cases cochées) : propre à chaque appareil,
  réinitialisé chaque jour.
- **Stocks / tâches** du responsable : `localStorage`, sur son appareil.

Rien n'est envoyé sur un serveur.

## Fichiers

```
mise-en-place/
├── index.html   # espace salarié
├── staff.js     # logique salarié
├── admin.html   # espace responsable
├── admin.js     # logique responsable (éditeur, lien, stocks, tâches)
├── shared.js    # modèle de config commun (encodage du lien, utilitaires)
├── app.css      # styles (identité QENTINA)
└── README.md
```
