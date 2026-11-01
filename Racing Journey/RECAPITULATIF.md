# Racing Journey — état du projet

Version **BUILD v219**. Ce document décrit l'organisation du code après la
restructuration (étape 1) et le passage en paysage (étape 2), ce qui reste
à faire, et comment reprendre.

---

## Déployer

Copier à la racine du site : `index.html`, `service-worker.js`, `styles.css`,
`manifest.json`, `_headers`, et les dossiers `css/` et `js/` avec leurs
sous-dossiers.

Le badge en bas à droite doit afficher `BUILD v219 · OK`. S'il liste des
modules manquants, un fichier n'a pas été copié.

À chaque déploiement : passer `?vNNN` (index.html) et `CACHE_NAME`
(service-worker.js) au numéro suivant.

## Vérifier

```bash
node tests/rj-tests.js          # ~225 vérifications, quelques minutes
node tests/couverture.js        # rapport de structure (fonctions, couches)
```

Voir `tests/README.md` pour les suites, les options (`RJ_GRAINE`,
`RJ_CHANNEL`, `RJ_PORT`) et la lecture d'un échec.

---

## Organisation du code

```
css/         paysage (mise en page de jeu mobile commune à tous les écrans)
js/core/     00-hooks (points d'extension), 02 réglages, 04s sauvegarde,
             07k migrations, 86 registres
js/data/     circuits, catégories, écuries, plateau de pilotes, notation
js/race/     moteur (04), safety car, radio, évènements, décisions (107),
             modèle de piste (108), course sur le circuit (111), fin de course (04j)
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
| fonctions « extensibles » | `rjInscrire(nom, …)`, `rjDesinscrire(prefixes, nom?)` (core/00-hooks) | avant, remplace(args, suite), apres, ordre |
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

La suite de tests `couches` vérifie, dans le jeu chargé, qu'aucune des
fonctions déclarées n'est enveloppée : une couche réintroduite, sous
n'importe quelle forme, la fait échouer. Les modules qui doivent agir sur
une fonction appellent `rjInscrire` ; si la fonction n'est pas encore
extensible, `rjInscrire` lui pose son répartiteur.

---

## Étape 1 (restructuration) — ce qui a été fait

- **T0** filet de tests : hasard rejouable, partie v208 figée, persistance,
  parcours de tous les écrans.
- **T1** sauvegarde fiable : écriture unique tout-ou-rien, échecs signalés
  (autosave compris), sauvegarde illisible conservée, format versionné.
- **T2** les trois gros fichiers (03, 04, 05) remis en forme lisible.
- **T3** code mort certain supprimé ; **T4** fichiers rangés par domaine.
- **T5** plus aucune fonction enveloppée : les grandes chaînes (navTo, rtab,
  mtab, showResult, runRaceLive, startNextSeason, advanceToNextMoment,
  goToRaceWeekend…) ont leur registre, les ~150 autres passent par
  `rjAppeler` (transformation automatique par l'arbre syntaxique, puis
  vérifiée à l'exécution sur les 980 fonctions déclarées).
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

## Étape 2 (paysage) — ce qui a été fait

Le design est inchangé ; seule la mise en page passe à l'horizontale, la
même pour chaque écran (`css/paysage.css`) :

- navigation en **rail vertical** à gauche (repère actif à gauche) ;
- un **bandeau unique** de 52 px : titre à gauche, onglets à droite (ils
  défilent s'ils sont nombreux, comme au week-end de course) ;
- contenu en **colonnes de la largeur d'un téléphone en portrait** : un
  conteneur d'au moins cinq éléments se répartit sur deux colonnes dès
  que la place le permet, une carte isolée reste entière ; les écrans qui
  se lisent d'un fil (création, messagerie, événement, négociation,
  sauvegarde) gardent une colonne centrée ;
- accueil, écran titre, choix du mode, course en direct et résultats en
  deux colonnes ;
- notifications et trophées en bas à droite, tiroir « Plus » à côté du
  rail, fenêtres plafonnées à la hauteur de l'écran ;
- en portrait, un écran demande de tourner l'appareil ; le manifeste
  déclare `landscape`.

Retiré : la taille d'écran automatique (60), le placement du tiroir au-dessus
de la barre du bas (61), la section « Affichage » des Paramètres (ses
curseurs n'avaient plus d'effet) et le correctif de barre du bas d'index.html.

La suite `paysage` vérifie chaque écran à trois tailles (667 × 375,
932 × 430, 1180 × 820) ; toutes les suites tournent désormais en 932 × 430.

### Présentation de jeu mobile

- **HUD** (`js/ui/109-hud.js`) : saison et semaine, budget, réputation et
  note du pilote en haut à droite de chaque écran, mis à jour après
  `updateUI` et à chaque changement d'écran ; titre à gauche (bandeau de
  44 px).
- **Rail d'icônes** de 60 px (libellés gardés pour les lecteurs d'écran),
  bouton Avancer au centre.
- **Onglets en colonne** à gauche du contenu, comme les menus de jeu.
- **Accueil** : à gauche la prochaine course, la saison (classement,
  points, victoires, podiums), la forme (cinq derniers résultats), le
  mental et un mini-classement (leader, voisins, écart) ; à droite les
  tuiles, sans défilement.
- Marges resserrées, retour au toucher (la cible s'enfonce), fondu entre
  écrans, barres de défilement masquées.
- **Plein écran** (`js/ui/110-plein-ecran.js`) : dans le navigateur d'un
  téléphone, au premier toucher, avec verrouillage paysage (sans effet sur
  iOS Safari ni sur ordinateur).
- **Gouttière unique** : la zone de contenu donne seule la marge latérale
  (14 px) et l'écart entre colonnes ; les marges héritées du portrait
  (classes connues, marges écrites en ligne sur les trois premiers
  niveaux, simples enveloppes sans fond) sont neutralisées. Les écrans faits
  d'une poignée de cartes (agent, boutique, Paddock Pass, journée médias,
  panthéon) passent sur la colonne centrée de 720 px.
- Retiré : la gouttière portrait (91), remplacée. Elle partageait l'id de
  style de la progression de course (90), dont les styles n'étaient donc
  jamais posés (grand compteur de tours, barre, masquage de la barre en
  double et des indicateurs de pneus) : corrigé.

## Étape 3 (course en direct) — ce qui a été fait

`js/race/111-vue-circuit.js` : pendant la course, l'écran montre le tracé du
circuit couru (`getCircuitData().path`, 70 circuits) et un point par voiture
aux couleurs de son écurie (`couleurEcurie`, exposée par 11) :

- les points avancent en continu d'après `RJModelePiste.etat()` (108),
  lissés et **sans jamais reculer** ; chaque voiture se cale derrière celle
  classée devant elle, si bien qu'un dépassement ne se voit que lorsque le
  classement change, et dure moins d'1,2 s ;
- passage au stand dans la case « STAND » (visible au moins 1,2 s),
  disparition à l'abandon, autres catégories en plus petit (endurance),
  badge SC/VSC pendant une neutralisation, le joueur cerclé avec sa position ;
- l'animation ne tourne que course à l'écran : arrêt au drapeau, hors de
  l'écran de course ou application en arrière-plan, reprise au retour.

Mise en page : le circuit occupe la colonne de gauche sur toute la hauteur ;
à droite, la progression (tour, voisins, écarts) puis le fil du direct.
Suite `circuit` : tracé, un point par voiture, pas de recul, durée des
dépassements, stand, abandon, arrêt et reprise de l'animation.

---

## Reste à faire

- **Moteur.** Les positions restent calculées au score (bridées à ±2 places
  par tour) ; le modèle de piste et la vue du circuit en dérivent une
  position continue. Faire piloter les positions par la distance parcourue
  reste possible.
- **Surveillances du DOM.** Il en reste 17 ; elles ne se réveillent plus au
  repos, mais l'arrondi global des décimales (ui/04q) reste un correctif
  d'affichage à remplacer par un formatage à la source.
- **Taille de l'app.** Le module 68 (ui/53-affichage) calcule encore une
  « zone » et une mise à l'échelle (désactivée) héritées du cadre portrait ;
  seul son relevé des zones sûres (encoche) sert encore. L'écran
  `S-display-setup` et `APP_SIZE_BOUNDS` ne sont plus utilisés.
- **Pas encore essayé sur un vrai téléphone** : encoche sur le côté,
  barre d'adresse du navigateur en paysage.
- **Désinstalleurs de console** (`window._rjNNUninstall()`). Ils retirent
  leurs hooks (`rjDesinscrire(prefixes, nom)`) sans toucher aux fonctions,
  mais les drapeaux d'installation restent posés : on ne réinstalle pas un
  module sans recharger la page.

## Étapes suivantes

4. Approfondissement de la simulation de carrière.
