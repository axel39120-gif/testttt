# Racing Journey — état du projet

Version **BUILD v234**. Ce document décrit l'organisation du code après la
restructuration (étape 1) et le passage en paysage (étape 2), ce qui reste
à faire, et comment reprendre.

---

## Déployer

Copier à la racine du site : `index.html`, `service-worker.js`, `styles.css`,
`manifest.json`, `_headers`, et les dossiers `css/` et `js/` avec leurs
sous-dossiers.

Le badge en bas à droite doit afficher `BUILD v234 · OK`. S'il liste des
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
             115 économie (barème réel, milieu familial),
             07k migrations, 86 registres
js/data/     circuits, catégories, écuries, plateau de pilotes, notation
js/race/     moteur (04), safety car, radio, évènements, décisions (107),
             modèle de piste (108), course sur le circuit (111), fin de course (04j)
js/weekend/  week-end de course, en-tête, ajustements, ingénieur, réglages
js/career/   progression, saison, fin de carrière, réserve, pré-saison,
             Super Licence (112), mercato (113), rêves et héritage (114)…
js/social/   médias, conférences, réseaux sociaux, messagerie, réseau
js/finance/  finances, négociation (11, 117), sponsors, patrimoine
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

### Course fiable et lisible (v222)

- **Arrivée faussée** : un pilote P17 au dernier tour pouvait finir P1. Le
  classement officiel (`_finalizeOfficialOrder`, 04) ajoutait une seconde
  fois le temps passé au stand, déjà compté pendant la course. Seule la
  pénalité d'arrêt obligatoire manqué (`_penaliteArrivee`) compte désormais :
  l'ordre au drapeau est celui du dernier tour. Suite `arrivee`.
- **Rythme** : un tour dure `dureeTourCourse()` (04) — 8 s en lent, 4,5 s en
  normal, 2 s en rapide — lu à chaque tour, donc un changement de vitesse
  s'applique tout de suite. L'ancienne « course ralentie » (49, dans 40) ne
  s'appliquait jamais : elle est retirée.
- **Vue** : les voitures roulent à l'allure réelle d'un tour et se recalent en
  douceur (celle qui dépasse accélère, celle qui cède lève le pied), sans arrêt
  net ; silhouettes orientées dans le sens de la piste ; tour de classement
  (position, écurie, écart) à gauche du tracé, masquée sous 800 px ; damier,
  secteurs, limites de piste. Test de fluidité dans la suite `circuit`.

### Course en temps réel (v222)

Le moteur résout toujours la course tour par tour ; `js/race/108-modele-piste.js`
la rejoue en continu, comme un match de Football Manager :

- à chaque tour calculé, chaque voiture reçoit son instant de passage sur la
  ligne (temps du leader + écart, dans l'ordre du classement) ; un arrêt au
  stand devient une immobilisation dans l'allée des stands ;
- l'écran a **un tour de retard** sur le moteur : il rejoue le tour dont il
  connaît déjà l'arrivée. Positions, classement et écarts sont exacts à chaque
  instant, et égaux à ceux du moteur à chaque passage de ligne ;
- avant le départ, les feux s'allument un à un ; le drapeau tombe quand le
  dernier tour est fini **à l'écran** (`drapeauApresDernierTour`, 04) ;
- une pause (décision en course) fige l'horloge sans la remettre à zéro ;
- la tour de classement (111), le mini-classement (107, via `RJ_FRAME_HOOKS`)
  et la barre de progression (90) suivent le direct ; le récit d'un tour
  (fil « Direct », 08) paraît quand ce tour se termine à l'écran, la radio
  reste immédiate.

## Étape 4 (simulation de carrière) — ce qui a été fait

Trois chantiers choisis, dans l'ordre :

- **Super Licence FIA** (`js/career/112-super-licence.js`) : points par
  saison selon la catégorie et la place finale (barème inspiré de la FIA),
  sur les trois dernières saisons, une catégorie par saison ; 40 points et
  18 ans pour un baquet de F1, licence conservée après une saison de F1.
  Sans licence, une écurie de F1 ne propose qu'un rôle de réserviste (règle
  appliquée dans `buildOffer`, par où passent toutes les offres). Carte dans
  l'onglet Carrière du pilote, bilan à chaque fin de saison. Calculée depuis
  `CAREER_HISTORY` : rien de plus à sauvegarder.
- **Mercato vivant** (`js/career/113-mercato.js`) : rumeurs aux deux tiers
  de la saison (vétérans de F1, espoirs de F2, le joueur s'il brille),
  confirmées ou démenties ; relevé de l'intersaison (retraites, promotions,
  descentes, changements de série, recrues), arrivées et transferts sur la
  grille du joueur, nouveau règlement. Onglet Championnat › Mercato.
- **Rêves et héritage** (`js/career/114-heritage.js`) : jusqu'à trois rêves
  choisis parmi huit (champion du monde, Triple Couronne Monaco-Indy-Le Mans,
  roi de Monaco, légende de l'endurance, couronné partout, prodige, une vie
  une écurie, dynastie), progression calculée sur la carrière, réussite
  célébrée (bonheur +10) et conservée ; frise de carrière saison par saison.
  Onglet Héritage du pilote.

Suites `superlicence`, `mercato`, `heritage`.

### Un baquet se gagne et se finance

- **Économie réelle** (`js/core/115-economie.js`, source unique des
  montants) : baquets F4 300–450 k€, FR 600–900 k€, F3 0,9–1,4 M€, F2
  1,8–2,8 M€ ; salaires de F1 de 1 à 30 M€ ; WEC et IndyCar avec usines
  salariées et équipes privées payantes ; sponsors ramenés aux montants
  réels par catégorie. Les données d'écuries (`TEAM_OFFERS`) sont tirées du
  barème par `tests/outils/bareme-ecuries.js` (rejouable). Milieu familial à
  la création (budget de départ, soutien mensuel jusqu'à la Formula
  Regional). Anciennes sauvegardes converties au chargement.
- **Baquets limités et concurrence** (`js/career/116-baquets.js`) : places
  libres par catégorie et par saison (F1 : 2 à 4) ; chaque offre oppose le
  joueur à des pilotes du plateau (talent, argent, image) selon les
  priorités de l'écurie ; soutien financier propre à chaque pilote ; apport
  demandé par les écuries qui regardent l'argent ; académie qui prend le
  baquet en charge ; prix payé un tiers à la signature, le reste sur huit mois.
- **Négociation** (`js/finance/117-negociation.js`, sur la négociation de 06
  et 11) : patience selon la marge sur le rival, sponsors engagés pour
  baisser le prix, plan B signé en cas d'échec, résumé de l'offre avec prix,
  échéancier, apport, priorités et rival.
- **Régression corrigée** : la restructuration (b77fc20) avait supprimé les
  fonctions de base de l'écran de négociation, qui levait une erreur à
  l'ouverture ; restaurées, et le module 11 s'y inscrit par `rjInscrire`.

- **Le point de l'agent** : deux fois par saison, un message chiffré (baquets
  libres dans la catégorie visée, écuries où tu es premier choix, ce qui
  manque pour le baquet le moins cher, pistes : sponsors, académie, séries où
  les usines paient).
- **Remise au talent** : une écurie qui te choisit pour ton talent sans que tu
  aies le budget baisse son prix (grandes écuries 70 %, baquet offert au
  champion ; milieu de grille 40 % ; petites écuries : aucune).

Équilibrage « réaliste », mesuré par `tests/outils/equilibrage-baquets.js`
(chance d'au moins un baquet payable par intersaison, petit budget = 10 % du
soutien médian) :

| Vers | Champion | 3e | 6e | 6e + soutien moyen | 6e + gros soutien |
|---|---|---|---|---|---|
| F1 | 54 % | 7 % | 0 % | 6 % | 42 % |
| F2 | 84 % | offres, à financer | 0 % | 49 % | 75 % |
| F3 | 97 % | offres, à financer | 0 % | 98 % | 100 % |

Suites `economie`, `baquets`, `negociation`.

---

## Étape 5 (présentation de jeu mobile) — ce qui a été fait (v223)

Forme seulement, rien ne change dans le jeu. Objectif : un affichage optimisé
et ergonomique en paysage.

- **Bandeau unique** : titre à gauche, onglets en pastilles au centre,
  ressources à droite. La colonne d'onglets (118 px) a disparu : le contenu
  prend toute la largeur. Trop d'onglets : la rangée défile au doigt. La place
  du HUD est mesurée par 109 (`--hud`) et non plus fixée.
- **Rail** : icône et libellé ; le bouton Jouer affiche l'étape suivante sous
  le disque. Il reste présent sur tous les écrans de consultation (patrimoine,
  sponsors, messagerie, paramètres, boutique…) ; seuls les parcours guidés
  (création, événement, intersaison, transfert, fin de saison) prennent tout
  l'écran (`go`, 03).
- **Accueil** (`js/ui/118-accueil.js`) : un bouton dans la carte de la
  prochaine course, au nom et à la couleur de l'étape suivante ; sous chaque
  tuile, l'information utile (note, séances restantes, contrat, sponsors,
  budget, bonheur, messages non lus). Tuiles en ligne, ou en colonne sur petit
  téléphone, plus grandes sur tablette.
- **Calendrier** : le mois entier tient dans l'écran.
- **Écran titre** (v224) : une seule colonne centrée — le logo, la partie à
  reprendre (action principale dès qu'une sauvegarde existe), puis « Nouvelle
  carrière », plus discrète dans ce cas. Les emplacements vides et les
  notifications de la partie n'y apparaissent plus.
- **Boutons du menu** (v225) : chaque raccourci de l'accueil a sa couleur,
  une icône en pastille dégradée, une lueur de sa teinte et une flèche.
- **Widgets** (`js/ui/119-widgets.js`, v225) : contrat actuel, prochaine
  course, saison (classement, points, forme), budget, Super Licence, rêves.
  Chaque écran reçoit ceux qui le complètent (`WIDGETS_PAR_ECRAN`) ; ils se
  glissent dans les colonnes de l'onglet affiché, qui s'équilibrent et
  comblent les vides, ou forment une rangée en bas sans colonnes. Toucher un
  widget mène à l'écran concerné. Les durées de contrat suivent la lecture de
  l'écran Contrats (4 semaines par mois, 48 par saison).
- **Accueil : forme et championnat** (v230) : la forme et le mental dans un
  même cadre ; le championnat dans une carte avec un sélecteur Pilotes /
  Écuries (s'il y a un championnat des écuries, `TEAMS_BY_CAT`), podium or,
  argent, bronze, liseré aux couleurs de l'écurie, ta ligne en avant (109).
  Écrans bas : trois lignes, et sous 400 px les pastilles de saison
  s'effacent (classement et points sont au championnat).
- **Angles** (v226) : un seul arrondi, `--r` (6 px), pour les cartes,
  boutons et blocs de tout le jeu ; `--r2` et `--r3` le suivent. Les arrondis
  de 8 à 18 px écrits en dur dans styles.css et les modules sont passés à
  `var(--r)`, sauf ceux des cercles et pilules (largeur ou hauteur ≤ 2 ×
  rayon + 2). Changer l'arrondi du jeu : une seule ligne dans paysage.css.
- **Titres de section** (v226) : un seul style partout — trois rayures
  inclinées rouges, le titre en capitales blanches espacées, un filet qui part
  du rouge et s'efface (t-sec, apex-sec, sec-lbl, rêves, paramètres,
  entraînement, écran titre).


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

## Étape 6 (simulation du week-end) — urgences de l'audit (v227)

Un audit (lecture du code, 90 courses et 360 qualifications mesurées) a
montré que l'arrivée était quasi aléatoire dans toutes les catégories à
arrêts au stand (lien arrivée ↔ niveau ≈ 0). Corrigé :

- **Un seul système d'arrêts** : celui du module 82 (même nombre d'arrêts
  pour tous). L'ancien planning du moteur (`_applyRivalPitsForLap`) s'y
  ajoutait (2 à 6 arrêts par voiture) et `_decayPitPenalty` rendait du temps
  à ceux qui s'étaient arrêtés tôt : les deux appels sont retirés de tickRace.
- **Un arrêt coûte sa durée** (18 à 26 s selon la catégorie), au lieu d'une
  pénalité calculée pour faire perdre un nombre de places.
- **Plus d'ex æquo au sommet** : les plafonds de note (0,96 / 0,97 / 0,99)
  posés par le moteur, 04k, 55 et 81 sont retirés ; un dernier passage au
  départ (« 81-echelle ») ramène le meilleur à 0,93 et resserre l'écart si
  besoin, sans changer l'ordre. Avant, six pilotes de F1 finissaient au même
  plafond.
- **Qualifications** : le temps plancher (96,5 % de la référence) est souple ;
  la pole ne se joue plus à l'ordre de la liste.
- **Coéquipiers** : jamais le même talent (écart de 1 à 3 points).

Suite `simulation` : arrivée liée au niveau (F1, IndyCar, endurance), même
nombre d'arrêts pour les rivaux, pas d'ex æquo, pas de temps de qualification
identiques, pole qui change de mains, coéquipiers différents.

### Équité joueur / rivaux (v228)

Mesuré d'abord (suite `equite`) : en course, le joueur était déjà traité
comme les rivaux — l'alignement du module 55 puis le mélange avec la grille
(81) ramènent sa note au niveau d'un rival de même talent dans la même
voiture ; un joueur moyen finit au milieu. Les vraies inégalités étaient en
qualification. Corrigé :

- **Talent sous la pluie** pour tous (`talentPluie`, `effetPluie`, 04) : de
  0,6 × (spécialiste) à 1,4 × (mal à l'aise) l'effet de la pluie ; le joueur
  le tire de son adaptation, chaque rival d'un tirage stable lié à son nom.
  En qualification, joueur et rivaux au même poids (avant : le double pour
  le joueur). En course, le joueur reçoit la pluie moyenne du peloton (55).
- **Écarts de qualification** : 0,1 de niveau vaut 0,22 % du temps au tour
  (avant 0,55 %) — du premier au dernier, 2,2 % en F4, 2,6 % en F2, 3,3 % en
  F1, au lieu de 4 à 6 %.
- **Talents de la saison fixés dès la qualification** (`startQual`, 04k) : la
  première qualification de la saison ne court plus avec les anciens talents.

### La course au chronomètre (v229)

`js/race/81-moteur-course.js` est réécrit. Chaque pilote a un temps cumulé ;
à chaque tour :

- **temps au tour** = référence du circuit × (1 − 0,03 × (note − note
  moyenne)), plus un aléa selon la régularité (la note porte talent, voiture,
  pluie, forme, événements) ;
- **arrêt au stand** : sa durée s'ajoute au temps ;
- **départ** : décalage de la place sur la grille et temps de réaction, avec
  des dépassements plus faciles au premier tour ;
- **dépassement** : rattraper ne suffit pas, il faut une avance de rythme au
  moins égale au seuil du circuit (facilité `overtake` de getCircuitData :
  Monaco ≈ 1 s/tour, Monza ≈ 0,25 s/tour) ; sinon la voiture reste dans l'air
  sale, 0,3 à 0,8 s derrière ;
- **safety car / drapeau rouge** : regroupement derrière le leader ; **VSC** :
  tout le monde ralentit d'autant, sans dépasser.

Classement = ordre des temps cumulés ; écarts en vraies secondes, jusqu'aux
tours de retard ; au drapeau, `_finalizeOfficialOrder` lit ces temps (au lieu
de « 1,2 s par place »). Un déplacement imposé (moments décisifs, 106) est
traduit en temps. Retirés : le tri par note bridé à ±2 places, le mélange
note/grille au départ (la qualification dictait 70 % du rythme).

La note du joueur suit la formule des rivaux (04, runRaceLive) plus ses
leviers de jeu (réglages, rôle, ingénieur, bonheur, forme) : plus de bonus de
catégorie (écrit deux fois), de rattrapage depuis le fond de grille ni de
stratégie ; son talent sous la pluie joue aussi en course. Le module 55 ne
fait plus que borner sa variance.

Suite `chronometre` : écarts qui se creusent, écarts croissants avec la
position, dépassements en piste, départ qui peut changer l'ordre, voiture
rapide partie dernière qui remonte, lente partie en pole qui recule, Monaco
plus dur que Monza.

Restent (audit) : pneus de qualification appliqués au seul joueur, essais
libres sans rivaux, pas d'usure de pneus ni de carburant (rythme constant sur
un relais), stratégies des rivaux toutes identiques.

## Étape 7 (paysage automatique et écrans de téléphone) — v231

- **Paysage au lancement** : application installée (manifeste
  `orientation: landscape`) et Android dans le navigateur (plein écran et
  verrouillage au premier toucher, 110) passent seuls à l'horizontale.
  Sur iPhone, où une page ne peut pas imposer l'orientation, le jeu se
  **dessine pivoté** tant que l'appareil est en portrait (css/paysage.css,
  `@media (orientation: portrait) and (pointer: coarse)`) : il apparaît en
  paysage dès qu'on tourne le téléphone, même avec le verrouillage de
  rotation. Un appareil qui tourne vraiment l'écran repasse sans pivot. Sur
  ordinateur, une fenêtre en hauteur affiche « Élargis la fenêtre ».
- **Tailles de l'application, pas de l'écran** : `--app-w` / `--app-h` et
  requêtes de conteneur `@container app` (le body est le conteneur) au lieu
  de `100dvh` et des `@media` de taille ; le correctif de hauteur iOS
  d'index.html cale `#app` sur la largeur de la fenêtre une fois pivoté.
- **Zones sûres** (encoche, Dynamic Island, barre d'accueil, coins
  arrondis) : `--sg` / `--sd` / `--sb` (gauche, droite, bas) réservées par le
  rail, le contenu, le HUD, le badge, les notifications et l'écran titre ;
  une fois pivoté, le haut de l'appareil devient la gauche du jeu.

Suite `ecrans` : iPhone tenu en portrait (jeu pivoté en 852 × 393, toucher
qui suit la rotation), iPhone en paysage avec encoche simulée (rail, HUD,
badge et contenu hors des zones sûres).

Non fait : l'agrandissement de l'interface sur tablette (le zoom du module
53, désactivé, ne suit ni le paysage ni les éléments hors de #app).

## Étape 8 (atelier de réglages) — v232

`js/weekend/120-atelier-reglages.js` remplace l'affichage des réglages
(renderAdvancedSetupUI) par un atelier, dans l'esprit des jeux de gestion de
course : on règle, on roule, le pilote parle, on corrige.

- **Confiance du pilote** (anneau) : mesurée au dernier tour d'essai roulé —
  un réglage modifié ne se juge qu'en roulant.
- **Cinq ressentis** : équilibre (sous-vireuse / survireuse), freinage, appui
  en virage, traction, vitesse de pointe. Chacun est une barre avec la
  position estimée du réglage et la fenêtre idéale, qui se resserre avec la
  connaissance du circuit (RACE_STATE.practice.knowledge) ; verdict Parfait,
  Bon, À revoir, Mauvais, ou À confirmer tant que l'équipe en sait trop peu.
- **Parole du pilote** après chaque tour d'essai (runPracticeTest), selon le
  réglage le plus éloigné de l'idéal, et ses derniers temps (meilleur en
  violet) ; conseil de l'ingénieur (askEngineerHint).
- **Réglages** en trois groupes (aérodynamique, châssis, pneus et freins),
  boutons − / + et crans, avec les ressentis que chacun déplace ; seuls ceux
  de la catégorie apparaissent (un seul en Karting Junior).

Rien ne change dans le calcul : G.setupAdv via setAdvParam (couplages
compris), qualité computeAdvancedSetupScore (bonus de qualif et de course).
Les jauges du module 07g sont masquées (les ressentis les remplacent).

Suite `reglages` : atelier à la place des curseurs, bouton + qui règle,
tour d'essai qui fait parler le pilote, fenêtres qui se resserrent, confiance
maximale au réglage idéal, karting réduit à ses réglages.

## Étape 9 (une application, pas une page) — v233

- **Listes de choix** (`js/ui/121-selecteurs.js`) : les `<select>` ont l'allure
  d'un bouton du jeu (chevron rouge) ; un toucher ouvre un panneau qui glisse
  du bas, titré par le libellé de la liste, options en lignes larges avec une
  pastille sur le choix courant. La liste d'origine reste dessous : sa valeur
  change et « change » part comme avant (onchange intacts). Le module
  intercepte le toucher, le focus (iPhone) et le clavier : il couvre aussi les
  listes créées plus tard, sans surveiller la page.
- **Application figée** : html et body fixes, `overscroll-behavior` (la page ne
  glisse ni ne rebondit, l'élan d'une zone qui défile s'arrête à ses bords),
  pas de zoom au double toucher ni de sélection de texte accidentelle ;
  110 ajoute le garde-fou pour Safari avant iOS 16 (un doigt qui glisse hors
  d'une zone qui défile ne déplace rien, axes inversés quand le jeu est
  pivoté) et bloque le pincement.
- Sections dépliables : jamais le triangle d'un site web.
- **Bandeau** (v234) : les ressources (semaine, budget, réputation, note)
  ne s'affichent qu'à l'accueil ; ailleurs le bandeau rend sa largeur aux
  onglets (`--hud` à 0), et sur petit écran les pastilles se resserrent :
  aucun onglet n'est coupé.

Suite `ecrans` : application figée, liste ouverte en panneau titré, choix
appliqué avec son onchange. Suite `equite` : le joueur moyen est mesuré sans
les leviers mérités de la sauvegarde de test (forme, ingénieur).

## Étape 10 (l'entourage : des personnes, pas un répertoire) — v235

- **Réseau réparé** (`js/social/101-reseau.js`) : le crochet d'après-course
  était poussé comme fonction nue dans `RACE_POST_HOOKS`, qui appelle
  `h.run(e)` — il plantait à chaque course, en silence : ni les résultats ni
  les rencontres en piste ne touchaient le réseau. Il est désormais
  `{ id, run }`. Le staff, inscrit sous deux clés (`team_…` par le cœur,
  `paddock_…` par 101), est fusionné par nom à chaque synchronisation : la
  fiche au rôle officiel, la meilleure relation, toute la mémoire.
- **Des personnes** : chaque contact a un trait de caractère (loyal,
  rancunier, exigeant, chaleureux, ambitieux, discret ; stable, tiré de son
  nom) qui pondère ce qu'il gagne ou perd, une mémoire datée de vos échanges
  (victoire, abandon, conférence de presse, réponse à un message…) et une
  humeur tirée de ses trois derniers souvenirs. Toute variation passe par
  `_rj101.bouger(c, delta, texte)`.
- **Les messages viennent de quelqu'un** : un message du team principal est
  rattaché au team principal du réseau (de même l'agent, un rival, un
  journaliste ou un sponsor nommés, `contactKey` sur le message) ; accepter
  rapproche, refuser ou ignorer éloigne, selon le trait, avec un souvenir.
- **Écran Entourage** (`js/social/122-entourage.js`, onglet Contrats ›
  Réseau) : les personnes par cercle (ton écurie, agent et partenaires,
  presse, grille, paddock), une carte avec relation et humeur ; la fiche dit
  ce que la personne peut pour toi, son trait, ce qu'elle retient de toi, et
  propose « prendre des nouvelles » ou « demander conseil » (1 PA, une fois
  par semaine et par personne ; conseil dès 60 de relation).

Suite `entourage` : pas de doublon et fusion fidèle, pilotes et souvenirs
après des courses, message rattaché et réponse qui compte, traits pour tous
et qui pèsent, écran groupé, fiche, action à 1 PA.

## Étape 11 (une presse vivante) — v236

- **Des médias qui ont un avis** (`js/social/123-presse-vivante.js`) : chaque
  média de la salle de presse a une ligne éditoriale (analyse, passion,
  critique, sensation, bienveillance, tirée du ton de son journaliste) et une
  sympathie pour toi. Toute la presse lit tes déclarations, chacune selon
  ses goûts (le tabloïd aime la provocation, la presse bienveillante
  l'humilité) ; le média qui l'a recueillie réagit davantage.
- **La presse se souvient** : une déclaration assurée ou provocatrice devient
  une promesse, ressortie au premier résultat qui la confirme (« Il l'avait
  annoncé… ») ou la dément (« … rattrapé par ses mots »).
- **La revue de presse** : après chaque course, trois médias titrent sur toi,
  selon le résultat et selon ce qu'ils pensent de toi (favorable, neutre,
  hostile). Médias › Presse montre la revue, puis la sympathie de chaque
  média, du plus favorable au plus hostile.
- **Interview d'après-course** : une victoire, un podium ou un abandon vaut
  un message d'un journaliste, avec trois tons de réponse ; la réponse est
  publiée parmi tes déclarations et pèse sur les médias et la réputation.
- **L'audience suit tes résultats**, selon l'exposition de la catégorie et
  les polémiques, sans attendre que tu publies.
- **Sauvegarde** : la presse (`_rjPresse`) et tes déclarations
  (`_rjDeclarations`, jusqu'ici perdues au rechargement) sont sauvegardées.
- Le badge de version affiche de nouveau la bonne version (il était resté à
  v234 en v235).

Suite `presse` : lignes et sympathies, provocation qui divise, promesse
retenue puis rappelée, titres avec le circuit, interview et effet de la
réponse, course réelle qui fait titrer et grandir l'audience, sauvegarde,
écran.

## Étape 12 (une messagerie de jeu) — v237

- **Priorités** (`js/social/124-messagerie.js`) : chaque conversation porte
  une pastille « À répondre » (avec le délai restant), « Personnel » ou
  « Info », et la boîte se filtre (Tout, À répondre, Personnel, Infos).
- **Les propositions expirent** : sans réponse au bout de trois semaines, une
  proposition se ferme (« Proposition expirée ») et l'expéditeur s'en
  souvient. Jamais une négociation d'écurie ni un message qui mène à un
  écran.
- **De vraies conversations** : répondre à quelqu'un de ton entourage
  amène sa réponse la semaine suivante, selon ton choix et son caractère
  (le rancunier n'oublie pas un refus, le loyal passe à autre chose).
- **Des messages sans choix** : après chaque course, ton ingénieur de course
  débriefe (positions gagnées ou perdues, coéquipier).
- **Écrire** : depuis la fiche d'un contact (Entourage), on lui écrit sur un
  sujet propre à son rôle (l'agent sur ton marché, le team principal sur
  ton avenir, l'ingénieur pour un débrief…). La réponse arrive la semaine
  suivante et dépend de votre relation.

- **Moins de faux choix** (v238) : mesuré sur 8 vraies manches, 29 messages
  sur 40 imposaient un bouton, dont la moitié un seul « Compris » ou
  « Merci » sans effet. Un seul bouton sans effet fait désormais une info ;
  un seul bouton à petit effet (bonheur, mental, réputation, confiance)
  s'applique à la réception. Vrais choix, liens vers un écran et drapeaux
  restent : 18 messages à choix sur 40, dont 2 liens.

Suite `messagerie` : faux choix retirés, priorités, expiration (et négociation épargnée),
souvenir de l'expéditeur, réponse différée sans choix, débrief après une
course, écrire depuis la fiche, filtres de la boîte.

## Étape 13 (vie perso et volume des messages) — v239

- **Vie perso** (`js/career/125-vie-perso.js`) : plus d'érosion fixe (un proche ne s'éloigne qu'après plusieurs semaines sans nouvelles, jamais sous un plancher) ; moments de saison par message (anniversaire, mariage d'un ami, Grand Prix à domicile, rencontre) ; proches qui écrivent après une course marquante ; « Moments de la saison » dans Vie perso.
- **Messagerie** (124) : délai entre deux messages d'un expéditeur secondaire, pas de redite d'un sujet avant six mois, boîte pleine qui garde les décisions en attente, débrief seulement après une course qui compte. Sur 8 manches : 22 messages au lieu de 40, amis à 48 au lieu de 15.
- **Habillage** : messages, entourage, presse et vie perso reprennent la tuile de l'accueil (lueur de la couleur du sujet en haut à gauche, fond sombre, bordure teintée, reflet) et les titres de section à rayures rouges. Dans un fil, les bulles façon téléphone (bleu, vert) deviennent des cartes du jeu : celles de l'expéditeur à sa couleur, les tiennes en rouge ; les boutons de réponse passent en capitales, l'acceptation en rouge.

## Pistes suivantes

- Développement des voitures en cours de saison (évolutions, essais
  privés, retours du pilote), écarté au choix de l'étape 4.
- Rumeurs de transfert entre écuries (le plateau ne déplace aujourd'hui les
  pilotes qu'entre catégories ; les écuries sont réattribuées à la volée).
