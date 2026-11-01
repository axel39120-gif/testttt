# Filet de tests — Racing Journey

Vérifie, dans un vrai navigateur, que les parcours essentiels du jeu
fonctionnent et que les correctifs déjà livrés tiennent.

Ce filet existe pour une raison précise : la refonte de structure à venir
(fusion de modules, suppression de code mort) touchera des couches qui se
recouvrent. Sans mesure automatique, une régression passerait inaperçue
jusqu'à ce qu'elle se voie en jeu — c'est exactement ce qui s'est produit
plusieurs fois par le passé.

## Lancer les tests

```bash
node tests/rj-tests.js              # toutes les suites (environ 3 minutes)
node tests/rj-tests.js ui course    # seulement celles-là
node tests/rj-tests.js --liste      # liste les suites disponibles
```

Le code de sortie vaut `0` si tout passe, `1` sinon.

Prérequis : Node.js et Playwright avec Chromium (`npm i -D playwright`
puis `npx playwright install chromium`). Aucune autre dépendance : le
harnais sert lui-même le jeu sur `127.0.0.1:8123`, sans toucher au projet.
Pour changer de port : `RJ_PORT=9000 node tests/rj-tests.js`.
Pour utiliser un navigateur déjà installé plutôt que le Chromium de
Playwright : `RJ_CHANNEL=chrome` (ou `msedge`).

Le hasard du jeu est tiré d'une graine, affichée en tête du rapport. La
simulation dépend aussi du temps réel : la même graine rejoue un échec au
plus près, pas à l'identique. Exemple : `RJ_GRAINE=437695854 node tests/rj-tests.js course`.

## Les suites

| Suite | Ce qu'elle vérifie |
|---|---|
| `chargement` | build exposé, tous les modules chargés, aucune erreur console, reprise d'une partie sans blocage |
| `creation` | étape du mode de jeu, conservation de la saisie lors d'un aller-retour, écurie de cœur, lancement de carrière |
| `sauvegarde` | écriture et relecture des blocs hors-cœur (pilote de réserve, mode de jeu, écurie de cœur) après rechargement complet |
| `persistance` | aller-retour complet d'une partie (cœur, extras, blocs inscrits), réglages, export puis import, et chargement d'une partie réelle de la v208 figée dans `fixtures/` |
| `fiabilite` | sauvegarde tout-ou-rien : stockage plein, sauvegarde automatique, sauvegarde illisible, migration de l'ancien format, bloc en panne, sauvegarde de test seulement avec `?dev` |
| `couches` | chaque fonction aplatie n'a qu'une définition et c'est la version retenue ; changement de saison ; filet de fin de course |
| `sobriete` | au repos sur l'accueil, presque aucune surveillance du DOM ni minuterie |
| `piste` | modèle de piste : distances dans les bornes, ordre conforme au classement, arrêts au stand visibles |
| `parcours` | ouverture de chaque écran et de chaque onglet sans erreur (les `onclick` échappent à la mesure de couverture) |
| `qualifications` | intitulés de session par catégorie, remise à zéro des références de secteurs entre Q1/Q2/Q3 |
| `course` | déroulé complet dans quatre catégories : positions distinctes, écarts positifs, sauts bornés, résultat enregistré, absence d'usure de pneus, plateau multi-classes de l'endurance, arrêts au stand |
| `course-rapide` | la même chose sur la seule Formule 1, pour une vérification en une minute |
| `endurance` | six courses d'endurance : plus grand saut de places par course (défaut connu signalé, à corriger avec le nouveau moteur) |
| `weekend` | stratégie retirée du parcours et inatteignable, réglages dans la préparation, feuille de temps en fenêtre |
| `decisions` | décisions en course, mini-classement, chien de garde |
| `ui` | hauteurs d'écran sous leurs seuils (en écrans paysage), absence d'icônes dans les boutons d'action, navigation sans erreur |
| `paysage` | à trois tailles : rail d'icônes à gauche, un seul écran affiché, même bandeau partout, HUD en haut de chaque écran et à jour, onglets en colonne, même gouttière partout, accueil sans défilement avec saison et forme, rien ne déborde ; écran « tourne ton téléphone » en portrait |

## Lire un échec

Chaque ligne indique la valeur mesurée entre parenthèses, ce qui suffit
généralement à comprendre :

```
ÉCHEC Formule 1  aucun saut de position aberrant  saut max 14
```

Un récapitulatif des échecs est affiché en fin d'exécution.

## Points d'attention

**La partie de test.** Le harnais reprend la sauvegarde créée
automatiquement au premier chargement (module `51-test-save-seed`). Cette
sauvegarde est régénérée à chaque ouverture de page : c'est voulu, mais
cela signifie qu'un test ne peut pas s'appuyer sur l'emplacement 1 pour
vérifier une persistance. La suite `sauvegarde` utilise donc
l'emplacement 2.

**La vitesse de simulation.** Les courses tournent en vitesse instantanée
pour rester rapides. Certains modules d'identité (endurance, IndyCar)
s'installent par un timer de 400 ms ; le harnais leur laisse le temps de
tourner avant de dérouler la course, sinon il mesurerait une absence qui
n'existe pas en conditions réelles.

**Les modales.** Un répondeur automatique clique les événements de course,
sans quoi la simulation resterait en attente d'une décision du joueur.

**Ce que le filet ne couvre pas encore** : les essais libres joués
réellement, le mercato et les transferts, le mode bac à sable, les arcs
narratifs, le parcours du pilote de réserve de bout en bout. À compléter
au fil des chantiers.

## Mesure de couverture

```bash
node tests/couverture.js                       scénario complet (~2 min)
node tests/couverture.js --rapide              version courte
node tests/couverture.js --json rapport.json   détail sur disque
```

L'outil enveloppe toutes les fonctions globales avec un compteur, joue un
scénario long (navigation complète, quarante semaines de carrière, une
course dans chaque catégorie, tous les formats de qualification, passage de
saison, contrats, réserve, création de carrière) puis croise les appels
avec l'inventaire des fichiers.

Il produit quatre choses :

- les **fichiers non chargés** par `index.html` ;
- les **modules qui ne se sont pas activés** ;
- la **couverture par fichier**, en ne comptant que les fonctions publiées
  sur `window` — les fonctions privées des modules en IIFE ne sont pas
  observables par cette méthode, c'est signalé ;
- les **empilements** : quelles fonctions sont redéfinies par plusieurs
  fichiers, avec le nombre d'appels réels.

Deux limites, rappelées à chaque exécution :

- « jamais appelée » **ne prouve pas** que le code est mort : le scénario
  ne l'a pas atteinte. Une fonction de retraite, de bac à sable ou d'arc
  narratif rare peut être vivante sans apparaître ;
- pour les modules écrits en IIFE, seul le statut d'activation a du sens.

## Étendre le filet

Une suite est une fonction `async` qui utilise `S.verifier(intitulé,
condition, détail)`. Pour en ajouter une, l'écrire dans `rj-tests.js` et
l'inscrire dans l'objet `SUITES` en bas du fichier.

Les outils communs sont dans `socle.js` : `ouvrirJeu()`, `mesurerEcran()`,
`courirUneCourse()`, `repondeurAutomatique()`.
