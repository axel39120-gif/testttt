# Racing Journey — état du projet

Version **BUILD v132**. Ce document résume ce qui a été fait, ce qui reste
ouvert, et comment reprendre le travail.

---

## Comment déployer

Copier à la racine du site : `index.html`, `service-worker.js`, `styles.css`,
`manifest.json`, `_headers`. Copier le dossier `js/` tel quel.

Le badge en bas à gauche doit afficher `BUILD v132 · OK`. S'il liste des
modules manquants, un fichier n'a pas été copié.

Le dossier `_retires/` contient les fichiers sortis du projet au cours de la
restructuration. Il n'a pas besoin d'être déployé — il est fourni pour que
rien ne soit perdu et que tout retour en arrière reste possible.

## Comment vérifier que tout fonctionne

```bash
node tests/rj-tests.js          # 87 vérifications, environ 3 minutes
node tests/couverture.js        # rapport de structure
```

Voir `tests/README.md` pour le détail des suites et leurs limites.

---

## Ce qui a changé dans le jeu

### Corrections

- **Le jeu ne se figeait plus au chargement d'une partie.** Deux modules se
  renvoyaient un ordinal l'un à l'autre (`3e` ⇄ `3 €`) en boucle infinie,
  bloquant le thread principal dès l'entrée en jeu. Corrigé à la source.
- **Le classement en course n'oscille plus** entre la première et la
  dernière place. La résolution des collisions de position se rabattait sur
  « la première place libre en partant de la tête » quand le fond de grille
  était occupé.
- **Les positions suivent enfin la qualification** : on ne part plus en pole
  avec le rythme d'un dernier.
- **Les intitulés de qualification** correspondent au format de chaque
  catégorie — plus d'« élimination » annoncée là où il n'y a qu'une séance.
- **Les couleurs de secteurs** repartent de zéro à chaque session.
- **Les clauses de négociation et l'état financier étaient perdus** à chaque
  rechargement : ils n'étaient jamais écrits dans la sauvegarde.
- **L'écran de stratégie fantôme** qui s'ouvrait avant chaque course a
  disparu avec le système qui le produisait.

### Ajouts

- **Pop-up de conséquence** après chaque choix en course : verdict, texte
  narratif, puis effets concrets en vert ou rouge.
- **Le pilote de réserve** est devenu un vrai chemin de carrière : week-ends
  courts, crédibilité, remplacements, contrats cumulés, trace au palmarès.
- **Choix du mode de jeu** à la création, sur un registre extensible.
- **Écurie de cœur** : léger avantage pour y entrer, bond de moral le jour
  où l'on signe.

### Simplifications

Retirés de la simulation : **pneus** (usure, gommes, modes) et **stratégie**
(écran, modèle, décisions). Les arrêts au stand restent, avec leur effet de
perte de position, pour le joueur comme pour les rivaux.

Conservés intacts : plateau multi-classes de l'endurance, safety car,
météo, événements de course, radio.

### Interface

- Écran Sponsors : de six hauteurs d'écran à une seule.
- Week-end : préparation et essais tiennent dans l'écran, les réglages et la
  feuille de temps passent en fenêtre.
- Icônes retirées des boutons d'action, conservées dans la navigation, les
  tuiles du menu et les sélecteurs où elles portent l'information.

---

## Ce qui a changé dans la structure

| | Avant | Après |
|---|---|---|
| Fichiers | 89 | **49** |
| Volume `js/` | 4612 Ko | 4276 Ko |
| Lignes | 52 126 | 46 490 |
| Fonctions à 3 couches ou plus | 12 | 2 |

### Le principe : des registres plutôt que des enveloppes

Le problème n'était pas le nombre de fichiers mais l'empilement. Dix modules
enveloppaient le lancement d'une course, huit le calcul des positions —
non pour le modifier, mais faute d'un endroit où se brancher.

Sept registres ont été créés. Un module s'y inscrit au lieu d'envelopper :

| Registre | Moment | Déclaré dans |
|---|---|---|
| `RJ_LAP_HOOKS` | chaque tour de course | `81-moteur-course` |
| `RJ_RACE_START_HOOKS` | départ de course (avant / après) | `81-moteur-course` |
| `RJ_SEASON_HOOKS` | changement de saison (avant / après) | `86-infrastructure` |
| `RJ_LEADERBOARD_HOOKS` | rendu du classement | `86-infrastructure` |
| `RJ_SAVE_HOOKS` | écriture et lecture de la sauvegarde | `86-infrastructure` |
| `RJ_SCREEN_HOOKS` | affichage d'un écran donné | `86-infrastructure` |
| `RJ_TOAST_FILTERS` | filtrage des notifications | `86-infrastructure` |

Exemple :

```js
window.RJ_LAP_HOOKS.push({
  id: "mon-module",
  run: function (tour, course) { /* … */ }
});
```

### Fichiers regroupés

`18-weekend` (7 modules) · `53-affichage` (9) · `40-weekend-ajustements` (8)
· `04j-corrections` (4) · `34-progression` (3) · `35-identites-disciplines`
(3) · `86-infrastructure` (4) · `63-ecuries` (2) · `28-corrections-interface` (2)

### Fichiers retirés

Onze modules ne servaient plus, dont quatre entièrement inertes depuis
plusieurs versions : modèle de pneus, IA décisionnelle, stratégie de course
et son écran, construction de tours, vie de piste, radio émergente,
stratégie des rivaux, indicateurs d'usure.

---

## Ce qui reste ouvert

**Un défaut connu.** En endurance, le joueur peut faire un bond d'une
dizaine de places d'un tour à l'autre, environ une course sur six. Trois
tentatives de correction ont réduit le phénomène sans l'éliminer. Les pistes
restantes : l'injection du plateau multi-classes en cours d'épreuve, ou les
relais de coéquipiers — deux chemins qui déplacent les voitures sans passer
par le calculateur de positions.

**Deux empilements subsistent.** `runRaceLive` (4 couches) et `rtab` /
`showResult` (3 chacune). Elles contiennent des logiques de contrôle de flux
— retour anticipé, idempotence, garde défensif — moins directement
exprimables en registre.

**Les trois fichiers cœur** (`03-data-agent`, `04-race-engine`,
`05-progression`) pèsent 2,1 Mo à eux seuls, soit la moitié du projet. Ils
sont minifiés sur une ligne. Ils n'ont pas été touchés, et je ne recommande
pas de les réécrire : ils fonctionnent, ils sont couverts par les tests, et
le gain ne compenserait pas le risque.

**Le filet ne couvre pas encore** : essais libres joués réellement, mercato,
mode bac à sable, arcs narratifs, parcours complet du pilote de réserve.

---

## Deux réflexes qui ont fait la différence

**Mesurer avant de conclure.** « Ce code semble mort » est une impression ;
« ce code n'est jamais appelé sur une saison complète » est un fait. Presque
toutes les suppressions de ce chantier viennent de la seconde formulation.

**Se méfier de ses propres correctifs.** Plusieurs bugs traités ici avaient
été introduits par une correction précédente : le classement WEC faussé par
la refonte des positions, l'écran de résultat cassé par une entrée de
journal incomplète, une récursion infinie causée par une condition d'arrêt
obsolète. Le filet de tests les a tous attrapés — c'est sa raison d'être.
