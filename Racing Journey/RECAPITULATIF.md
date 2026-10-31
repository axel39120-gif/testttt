# Racing Journey — état du projet

Version **BUILD v214**. Ce document décrit l'organisation du code après la
restructuration (étape 1), ce qui reste à faire, et comment reprendre.

---

## Déployer

Copier à la racine du site : `index.html`, `service-worker.js`, `styles.css`,
`manifest.json`, `_headers`, et le dossier `js/` avec ses sous-dossiers.

Le badge en bas à gauche doit afficher `BUILD v214 · OK`. S'il liste des
modules manquants, un fichier n'a pas été copié.

À chaque déploiement : passer `?vNNN` (index.html) et `CACHE_NAME`
(service-worker.js) au numéro suivant.

## Vérifier

```bash
node tests/rj-tests.js          # ~200 vérifications, quelques minutes
node tests/couverture.js        # rapport de structure (fonctions, couches)
```

Voir `tests/README.md` pour les suites, les options (`RJ_GRAINE`,
`RJ_CHANNEL`, `RJ_PORT`) et la lecture d'un échec.

---

## Organisation du code

```
js/core/     00-hooks (points d'extension), 02 réglages, 04s sauvegarde,
             07k migrations, 86 registres
js/data/     circuits, catégories, écuries, plateau de pilotes, notation
js/race/     moteur (04), safety car, radio, évènements, décisions (107),
             modèle de piste (108), fin de course (04j)
js/weekend/  week-end de course, en-tête, ajustements, ingénieur, réglages
js/career/   progression, saison, fin de carrière, réserve, pré-saison…
js/social/   médias, conférences, réseaux sociaux, messagerie, réseau
js/finance/  finances, négociation, sponsors, patrimoine
js/ui/       écrans, icônes, affichage, badges, émojis, finitions
js/dev/      sauvegarde de test (chargée seulement avec ?dev)
```

L'ordre de chargement est celui d'`index.html` ; il compte.

### Une seule règle d'extension

Une fonction du jeu n'est définie **qu'une fois**. Pour y réagir, un module
s'inscrit à un registre, il ne l'enveloppe jamais :

| Fonction | Registre | Moments |
|---|---|---|
| fonctions « extensibles » | `rjInscrire(nom, …)` (core/00-hooks) | avant, remplace(args, suite), apres, ordre |
| `saveGame` / `loadSave` | `RJ_SAVE_HOOKS` | ecrire(G), lire(bloc, G) |
| `startNextSeason` | `RJ_SEASON_HOOKS` | avant, apres, prioritaire |
| `navTo`, `refreshScreen` | `RJ_SCREEN_HOOKS` | avant, apres, redirige + ensuite, remplace |
| `pushHomeToast` | `RJ_TOAST_FILTERS` | filtre → false / arguments |
| `mtab` (Médias) | `RJ_MEDIA_TAB_HOOKS` | apres |
| `rtab` (week-end) | `RJ_RACE_TAB_HOOKS` | redirige, refuse, avant, apres |
| `runRaceLive` | `RJ_RACE_START_HOOKS` | avant, apres, ordre |
| un tour de course | `RJ_LAP_HOOKS` | run(tour, course) |
| `showResult` | `RJ_RESULT_HOOKS` | avant, apres, orchestre(cœur) |
| `advanceToNextMoment` | `RJ_ADVANCE_HOOKS` | avant, intercepte, apres, ordre |
| `goToRaceWeekend` | `RJ_WEEKEND_ENTRY_HOOKS` | avant, intercepte, apres, ordre |
| `renderLiveLeaderboard` | `RJ_LEADERBOARD_HOOKS` | apres |

La suite de tests `couches` liste les fonctions déjà ramenées à une seule
définition : une couche réintroduite la fait échouer.

---

## Étape 1 (restructuration) — ce qui a été fait

- **T0** filet de tests : hasard rejouable, partie v208 figée, persistance,
  parcours de tous les écrans.
- **T1** sauvegarde fiable : écriture unique tout-ou-rien, échecs signalés
  (autosave compris), sauvegarde illisible conservée, format versionné.
- **T2** les trois gros fichiers (03, 04, 05) remis en forme lisible.
- **T3** code mort certain supprimé ; **T4** fichiers rangés par domaine.
- **T5** toutes les chaînes de 3 couches ou plus aplaties (navTo, rtab,
  mtab, showResult, runRaceLive, startNextSeason, advanceToNextMoment,
  goToRaceWeekend…) et une vingtaine de doubles.
- **T6** le jeu ne s'agite plus au repos (178 → 3 réveils de surveillance
  du DOM par seconde ; ~1 650 → 17 setTimeout par seconde).
- **T7** bonds de places en endurance corrigés ; modèle de piste
  (`RJModelePiste.etat()`) : position continue de chaque voiture.
- **T8** `js/legacy/` vidé et rangé par domaine.

### Bugs corrigés en chemin (visibles par le joueur)

- Un changement de saison faisait avancer de **deux** saisons (âge +2,
  contrat −2).
- L'export/import de sauvegarde perdait sponsors, staff, réseau et réglages.
- La sauvegarde de test pouvait écraser une vraie partie au démarrage.
- Les filets de fin de course levaient une erreur au lieu de rendre la main.
- En endurance, le joueur sautait jusqu'à 13 places d'un tour à l'autre.

---

## Reste à faire

- **Doubles restants.** Une centaine de fonctions sont encore définies deux
  fois (une base et une enveloppe), surtout dans 11-neg-patch, 34, 40, 63,
  79, 80. Les ramener à `rjInscrire` au fil des chantiers, fonction par
  fonction, en ajoutant chacune à la suite `couches`. Pour les lister :
  `node tests/couverture.js` (section « empilements »).
- **Moteur.** Les positions restent calculées au score (bridées à ±2 places
  par tour) ; le modèle de piste en dérive une position continue. Faire
  piloter les positions par la distance parcourue est une évolution
  possible de l'étape 3.
- **Surveillances du DOM.** Il en reste 18 ; elles ne se réveillent plus au
  repos, mais l'arrondi global des décimales (ui/04q) reste un correctif
  d'affichage à remplacer par un formatage à la source (étape 2).

## Étapes suivantes

2. Passage en paysage et nouvelle direction artistique, adaptée au support.
3. Vue de course en direct (tracés SVG déjà présents dans
   `getCircuitData(circuit).path`, positions dans `RJModelePiste.etat()`).
4. Approfondissement de la simulation de carrière.
