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

## Étape 14 (DA uniforme, notifications, vie amoureuse) — v240

- **Notifications** : en haut de l'écran, centrées, sous l'encoche. Pendant la course, la conférence de presse ou un événement, elles attendent et s'affichent à la sortie, les messages regroupés (« 2 nouveaux messages »). Le filtre de 40 qui devait différer les « Nouveau message » les abandonnait : remplacé par cette file. Les messages courts (showToast) rejoignent la même pile.
- **Widgets** : « Prochaine course » et « Rêves de carrière » retirés des écrans où ils répétaient l'accueil et l'héritage.
- **Titres de section** : presse (journal du paddock, vos déclarations), patrimoine, calendrier, panthéon, accomplissements et fil social prennent les rayures rouges communes.
- **Cartes et marges** : statistiques, boutique, activités, panthéon, académie, contacts, encadrés posés dans le HTML… prennent la tuile de l'accueil ; les blocs n'ajoutent plus de marge latérale à la gouttière de l'écran.
- **Style de vie** : catégories en pastilles, boutons d'achat et d'activité pleins et rouges, icônes teintées, moments de la saison en lignes.
- **Face-à-face** (`js/ui/126-face-a-face.js`) : tuile du duel (toi en rouge, le rival en or, le score de catégories au centre), choix du rival en panneau, catégories sur une ligne avec jauge partagée, verdict et points par manche en colonne de droite.
- **Vie amoureuse** (`js/career/127-amour.js`) : rencontre à partir de 18 ans, selon la réputation (vie discrète, personnalité connue, célébrité) ; étapes par message (vie commune, fiançailles, mariage, désir d'enfant, grossesse, naissance) ; une relation glacée mène à « il faut qu'on parle » ; presse people dans Médias › Presse (« Vie privée ») ; le foyer dans Vie perso.

Suites `habillage` et `amour`.

## Étape 15 (avatars) — v241

- **Portraits générés** (`js/ui/128-avatars.js`) : visage construit (pommettes, angle de la mâchoire, menton ; cinq formes : ovale, carré, rond, allongé, fin), éclairage latéral, orbites, paupières, iris texturé, grain de peau, barbe en poils, cheveux mèche par mèche, légère asymétrie. L'âge vieillit le visage (enfant, rides, cheveux gris) ; le rôle choisit la tenue (combinaison aux couleurs de l'écurie et au numéro du joueur, polo et casque radio du staff, veste et badge presse, habits de ville) ; le teint et les cheveux suivent le pays.
- **Même visage partout** : les traits d'un personnage sont tirés de son nom. Chaque portrait devient une image mise en cache ; en petit, une version allégée.
- **Ton pilote** : un éditeur dans la création de carrière (étape du numéro) — teint, forme du visage, coupe (vignettes à ton visage), cheveux, yeux, barbe, lunettes, traits, tirage aléatoire ; modifiable ensuite depuis l'avatar du bandeau (« Modifier mon avatar »). Une photo importée reste prioritaire. Sauvegardé avec la partie (`G.pilot.avatar`).
- **Les initiales disparaissent** : bandeau, profil, classement du championnat et de l'accueil, messagerie, entourage (cartes et fiche), face-à-face, réseaux sociaux, foyer (partenaire, enfants).

Suite `avatars`.

## Correctif — une carrière neuve sans rivaux (v242)

- **Le symptôme** : dans une carrière créée depuis l'écran de création, le classement des pilotes ne montrait que le joueur.
- **La cause** : le vivier des pilotes (`04o-driver-pool.js`) lit les listes de pilotes dans le code de `initRivals`. Depuis la restructuration des points d'extension (00-hooks), `initRivals` n'est plus qu'un relais vers `_initRivalsCoeur` : le vivier restait vide, tout en étant marqué « initialisé ». La voie de secours (`_buildRivalsFromPool`, 03) calculait alors « 0 rival à créer » et s'arrêtait là.
- **Le correctif** : le vivier lit `_initRivalsCoeur` ; un vivier vide n'est plus marqué initialisé et se reconstruit ; la voie de secours rend la main aux listes d'origine quand le vivier n'a personne pour la catégorie ; au chargement, une partie sans rivaux est réparée.

Suite `rivaux` : carrière créée par l'écran de création, classement complet, rivaux qui marquent, sauvegarde réparée.

## DA de la création et du week-end — v243

- **Création du pilote** : bandeau commun (titre en capitales, flèche de retour simple, filet rouge), nom de chaque étape en titre de section à rayures, tuiles pour les choix (continent, pays, milieu, style, trait) avec un éclat rouge sur le choix retenu, champs et boutons du jeu ; plus d'initiales posées sur le portrait du récapitulatif.
- **Classements sans visages** : les portraits des pilotes rivaux n'apparaissent plus dans les classements (championnat, accueil), seulement sur leur fiche (ouverte depuis le classement).
- **Week-end de course** (parcouru en photos : conférence, préparation, essais, qualifications, course, résultats) :
  - les titres de section masqués par un module restaient visibles et vides (le `display:flex !important` commun l'emportait) — corrigé pour tout le jeu (Media Day, Vie perso) ;
  - Media Day : l'ancien contenu reste masqué même quand le jeu régénère l'écran ; portrait du journaliste ; « Votre réponse » en titre de section ;
  - qualifications : « Q1 — Élimination » en titre de section (la couleur de la session reste sur le badge) ;
  - résultats : récit corrigé (accents, plus de « Course compliquee — course compliquee ») ;
  - trophées en bandeaux compacts.

## Écran des modes et sections vides — v244

- **Écran des modes** (avant la création) : en-tête commun (surtitre gris, titre en capitales, filet rouge), cartes en tuiles du jeu, choix retenu en rouge au lieu du cyan, bouton au dégradé rouge. Le rouge remplace aussi le cyan dans la pastille « Mode Carrière — changer », la carte « Mode de jeu » du récapitulatif et le bloc « Écurie de cœur ».
- **Sections vides** (module `129-sections-vides.js`) : sur l'écran affiché, un sous-titre sans rien dessous reçoit une courte phrase d'attente, propre au sujet (« Aucun titre pour l'instant : ton palmarès s'écrira au fil des saisons. », rivalités, décisions, trophées, offres, messages…) ou générique (« Rien à afficher pour l'instant. »). Elle disparaît dès que la section a du contenu. Le module observe l'écran, sans toucher aux modules qui dessinent les sections. Parcours de tous les écrans et onglets (sauvegarde de test et carrière neuve) : les sections ont toutes déjà un contenu ou leur propre phrase ; le module sert de filet (contenu pas encore dessiné, nouveaux écrans). Test : suite `vides`.
- **Onglets du bandeau inaccessibles** : les notifications et trophées du haut (v240) se posaient sur le bandeau et captaient le clic ; comme la file se renouvelle, les onglets restaient couverts presque tout le temps. Ils laissent désormais passer le clic (ils se ferment seuls). Test : suite `vides`.
- **Colonnes alignées en haut** : en mise en colonnes, la marge haute du premier bloc décalait la première colonne vers le bas (ex. « Relations »). Marge retirée au premier bloc et à ses premiers enfants, ainsi qu'aux enveloppes rembourrées (`.mg`, fiche de note) ; parcours de tous les écrans et onglets : plus aucun écart.
- **Pneus dessinés** : un seul dessin (`rjPneu`, moteur de course) remplace les ronds « S/M/H/I/W » partout — gomme noire, bande de la couleur du composé sur le flanc, jante à cinq branches ; la lettre reste au centre sur les grandes cartes de choix du composé.

## Tracés inventés et course en direct — v244

- **Tracés de circuits** (module `130-traces-circuits.js`) : chaque circuit (70, karting compris) reçoit un tracé original, tiré d'une graine (son nom), donc identique d'une partie à l'autre. C'est un polygone de virages arrondis, avec des replis vers l'intérieur, au moins une épingle, des chicanes sur les longues lignes droites et des rayons selon le caractère du lieu (urbain : angles droits serrés ; rapide : grandes courbes ; karting : court et sinueux) ; les ovales sont des ovales. Le tirage s'inspire de la longueur et du nombre de virages du lieu réel ; le meilleur de 60 candidats sans croisement est gardé. Un même lieu sous deux noms (Barcelone/Barcelona, Budapest/Hungaroring, Spielberg/Red Bull Ring, Monterey/Laguna Seca) a un seul tracé.
- **Infos mesurées sur le tracé** : longueur, virages, plus longue ligne droite, zones DRS (lignes droites ≥ 500 m, pour les lieux qui en ont), gros freinages, freinage, appui (part du tour passée pied au plancher, rangée d'un circuit à l'autre), dépassement, secteurs (temps aux tiers de la distance), temps de référence (celui du lieu, ajusté de ±12 % par le tracé pour garder des chronos crédibles). La note du circuit commence par ces faits et garde les phrases d'ambiance du lieu (climat, nuit, altitude…).
- **Course en direct** : la ligne d'arrivée est au milieu de la ligne droite principale ; chaque voiture est un rond aux couleurs de l'écurie avec les trois premières lettres du nom du pilote (le joueur : plus grand, cerclé de blanc, avec sa position) ; la voie des stands longe la ligne droite (entrée et sortie raccordées à la piste, muret, garages), et les voitures arrêtées s'y rangent.
- Tests : suite `circuits`.

## Classement en direct façon télé — v245

- La tour de classement à côté du circuit prend l'allure d'une retransmission : en-tête avec la catégorie et le tour en cours (ou « ARRIVÉE »), position dans une case, liseré de l'écurie, code pilote en capitales, écart au millième (au dixième en karting), « TÊTE » pour le leader, badge « PIT » au stand, ligne du joueur surlignée.
- Un habillage par catégorie, sans logo réel : F1 rouge, F2 bleu, F3 argent, F4 vert, Super Formula rose, IndyCar jaune, WEC turquoise, karting orange. Test : suite `circuits`.
- Vingt pilotes affichés sans défilement ; le joueur reste toujours visible (à la dernière ligne, détachée, s'il est plus loin). L'écusson de l'écurie remplace le liseré de couleur quand l'écurie en a un. Le nom du circuit n'est plus répété au-dessus de la carte (il est dans le bandeau).

## Logos d'écuries — v246-v249

- **v249 : logos de F1 repris avec plus de matière** (dégradés, chrome, ombres, lettrages), dans l'esprit des logos d'origine sans copier les marques ; les variantes de nom (Scuderia Ferrari, Mercedes AMG F1…) reprennent le même dessin. Les dégradés propres à un logo sont rangés eux aussi dans le bloc commun, avec des identifiants uniques.
- **Kick Sauber devient Audi** : données (équipes de F1, staff, notes, radio, couleur), logo argent et rouge inventé (sans les anneaux), et migration des anciennes sauvegardes au chargement (toutes les valeurs et clés « Kick Sauber » de la partie deviennent « Audi »).

- **v248 : retour aux logos d'origine**, jugés plus réalistes : chaque écurie garde son dessin d'origine, légèrement retouché (coins arrondis, reflet sur le haut, liseré clair et ombre intérieure). Les modèles ci-dessous restent proposés dans l'éditeur pour personnaliser une écurie ; « Rétablir le blason d'origine » ramène au logo d'origine retouché.

- Toutes les écuries reçoivent un blason inventé dans l'esprit du sport auto (aucune marque réelle reprise) : lettrage penché avec traits de vitesse, monogramme rapide souligné, écu à bandes de course, ailes balayées, drapeau à damier, doubles chevrons, bandes de capot, plaque numérotée. Le modèle est tiré du nom de l'écurie ; la couleur est celle de l'écurie (rouge Ferrari, orange McLaren… ; sinon la couleur dominante de son ancien logo).
- Rendu commun à tous les modèles, éditeur compris : fond teinté, contour métal, ombre portée, monogramme gravé, reflet. Les dégradés sont rangés dans un bloc unique toujours rendu (un logo présent dans un écran masqué devenait invisible partout).
- Éditeur : section « Sport auto » en tête du sélecteur, plaque au nom de l'écurie et écu à damier en plus ; « Rétablir le blason d'origine » revient vraiment au blason par défaut et montre sa vignette (le nettoyeur d'icônes du module 57 l'effaçait).
- Test : suite `logos`.

## Contacts, essais et qualifs, casque — v250-v252

- **Messagerie › Contacts** (module `131-contacts.js`) : une colonne de fiches (portrait ou pictogramme, rôle, jauge de relation, disponibilité, aperçu de la dernière réponse). La conversation a un en-tête (retour, portrait, jauge), un fil daté (tes bulles à droite, les siennes à gauche, effets obtenus sous chaque échange) et « Que veux-tu lui écrire ? » : chaque sujet montre le message envoyé, ses effets possibles et, s'il y a plusieurs réponses, leurs chances. L'ancien affichage (en colonnes) faisait chevaucher l'en-tête et les messages et y glissait des widgets.
- **Audit des essais libres et des qualifications** (week-end joué en entier, comme un joueur) — corrigé :
  - le tour de sortie des qualifs était chronométré et comptait comme meilleur tour (« premier tour chrono, P7 ») : il ne l'est plus, pour personne ; le joueur voit « tour de sortie : pneus en température » ;
  - la décision « Sortie des stands » tombait au 2ᵉ tour et revenait à chaque tour : elle devient « Lancement du tour », posée au premier tour lancé du relais ;
  - en essais, un composé épuisé laissait « Envoyer en piste » sans effet : on passe sur un composé disponible ;
  - usure des pneus en essais divisée par deux (≈ 7 %/tour en tendres au lieu de 14 %) ;
  - l'ingénieur disait « Première séance » en EL2 et EL3 : une phrase propre à chaque séance ;
  - la feuille de temps annonçait « meilleur 1:25.100 » (la référence du circuit) avant le moindre tour ;
  - retours de réglage accordés (« L'aileron… », « La suspension est un peu trop haute. Réduis-la. ») ;
  - pneus de qualif nommés en français (« Tendre », plus de « Soft Pirelli »), libellés de tour en français (« Tour lancé », « Dernière tentative »), pneus dessinés dans le choix des composés en essais.
- **Casque du pilote** (module `132-casque.js`, Carrière › Stats › Personnalisation) : éditeur avec aperçu dessiné (profil, visière, aération, numéro), trois couleurs (principale, secondaire, accent, plus une teinte libre), dix motifs (uni, bande centrale, bandes, chevron, flammes, damier, étoiles, éclair, diagonale, dégradé), quatre visières (fumée, iridium bleu, or, argent), trois finitions (brillant, mat, chromé) et le numéro. Enregistré avec le pilote ; la carte de Stats montre le casque.
- Tests : suites `contacts`, `essais`, `casque`.

## Retouches — v253

- **Pilote › Stats** : l'icône et la note des cartes (Performance, Technique, Mental, Physique…) touchaient le bord de la carte (en-tête sans marge intérieure) ; elles ont désormais le même retrait que les lignes.
- **Débrief des essais libres** : le réglage y était présenté réglage par réglage (aileron avant, antiroulis…), autrement qu'en début de séance. Il reprend la présentation de l'onglet Préparation : confiance du pilote, cinq ressentis (équilibre, freinage, appui, traction, vitesse) avec leur verdict, et la parole du pilote.

## Casque, réseaux sociaux, notes des pilotes — v254-v256

- **Casque plus réaliste** : profil d'un casque intégral de course redessiné — coque haute et ronde, nuque qui redescend, mentonnière avancée, volume par reflet et ombre de pourtour, bande au-dessus de la visière, visière avec pivot et languette d'arrachage, aileron arrière, prises d'air au sommet et à la mentonnière, bourrelet de nuque. Les motifs et finitions suivent la nouvelle forme.
- **Réseaux sociaux** : une seule colonne centrée comme une vraie appli ; profil avec bannière aux couleurs de l'écurie et portrait du pilote ; visages pour les fans et les pilotes ; @mentions et #hashtags en couleur ; une partie des publications des médias et de l'écurie porte une « photo » de course ; compteur de vues ; rangée de tendances (#Catégorie, #Nom, #Écurie, #GPCircuit).
- **Notes des pilotes** (module `133-notes-pilotes.js`) : quatre notes à la manière des jeux de F1 — Expérience, Combativité, Vigilance, Rythme — et une note générale. Chaque catégorie a sa fourchette (F1 74–96, IndyCar 70–91, WEC 68–89, Super Formula 66–87, F2 64–84, F3 56–78, F4 48–70, karting senior 42–64, junior 34–56). La place dans la grille vient de la compétence ; les points forts des statistiques détaillées différencient les quatre notes ; l'expérience suit l'âge et les saisons. La fiche d'un pilote (et du joueur) montre la carte des notes ; la note générale est la même en fiche, au classement et au mercato. Affichage seulement : la simulation n'en dépend pas.
- Corrigé au passage : « Offre de le garage familial » devient « Offre du garage familial ».
- Tests : suites `notes`, `reseaux`.

## Pilote de réserve et catégories parallèles — v257

- **Grilles** : un pilote remplacé ce week-end ou parti en cours de saison ne prend plus le départ (qualifs et course, `rivalAuDepart` dans 04) ; il garde ses points. Un réserviste pur n'occupe plus de baquet (04o) : son écurie aligne ses deux titulaires. Un baquet libéré est repris par une recrue de la catégorie inférieure ; promu dans sa catégorie, le joueur prend la place du titulaire le moins performant.
- **Réserve** (79) : la réserve se fait en F1 (pure, ou cumulée avec un baquet en F2, Super Formula, WEC ou IndyCar) et en WEC ; contrat cumulé avec sa propre confiance, une vraie référence (vivier 04o), des essais sur un circuit du bon calendrier, et des remplacements en Grand Prix (bascule de contexte puis retour intact). Course simulée sans le joueur : la régularité compte à nouveau. Les séances et occupations font progresser de vraies sous-statistiques ; le simulateur améliore la note de l'écurie (+0,25 par séance, +1,5 au plus). Deux EL1 officielles par saison en F1.
- **Catégories parallèles** (module `134-categories-paralleles.js`) : offres d'IndyCar, de WEC ou de Super Formula pour un pilote de F1 (offres « latérales ») ; voies IndyCar ↔ Super Formula ; IndyCar sans pilote sans écurie ni doublon ECR / Foyt, ovales cohérents (Texas, Iowa, Gateway, Milwaukee), Milwaukee remplace Monterey ; bonus IndyCar (pole, tours menés) ; WEC en Hypercar seule, points doublés au Mans, São Paulo 6h remplace le doublon de Bahreïn ; Super Formula avec TOM'S et Dandelion Racing au lieu des motoristes ; un même lieu sous plusieurs noms partage une fiche. Les anciennes sauvegardes sont mises à jour au chargement.
- Tests : suites `reserve`, `paralleles`.

## Audit complet — v258

Trouvé en jouant des saisons entières avec un joueur automatique, puis corrigé :
- **Fin de saison bloquée avec une écurie** : `_evaluateSeasonTrustCoeur` (04) commençait par un `return` resté du reformatage du 31 octobre ; le bilan n'était jamais renvoyé, `showSeasonEnd` plantait et l'écran de fin de saison ne s'ouvrait pas.
- **Talent des rivaux** (04k) : le recalibrage de début de saison classe les pilotes par leur propre talent (et non plus par la note de leur écurie), sans permutation au hasard ; la valeur est reportée dans le vivier et le marqueur de saison est sauvegardé (bloc « rj04k »).
- **Rechargement** (04s) : les rivaux sont sauvegardés avec leur identité (nom, écurie, talent, statut) et recollés par nom ; le vivier sauvegardé est relu avant de reconstruire la grille.
- **Radio des disciplines** (08) : `rjRadioPush` accepte aussi (titre, texte, options) ; les messages de relais, trafic, push-to-pass, overtake system et arrêts au stand s'affichent.
- **Karting** (92) : talents du junior et du senior relevés ; un débutant n'est plus au-dessus de toute la grille.
- Deux erreurs de console répétées à chaque tour supprimées (08, 04b).
- Tests : suite `audit`.

## Saisons complètes — v259

Un joueur automatique (`tests/joueur-auto.js`) joue désormais des saisons entières (week-ends, sprints, événements, journées médias, fin de saison, mercato) et vérifie la cohérence à chaque course et à chaque changement de saison. Parcours joués : F1 (2 saisons), F2, F3 (4 saisons), Super Formula, IndyCar, WEC, karting depuis une carrière neuve, pilote de réserve sur 2 saisons. Corrigé au passage :
- **Contrats** : un contrat pluriannuel se poursuit au mercato même sans nouvelle offre (avant : seule « Saison blanche » était proposée et le pilote perdait son baquet) ; l'offre de prolongation de sa propre écurie reste ouverte jusqu'au mercato ; un réserviste promu est engagé pour la saison suivante.
- **Saison blanche** (module `135-saison-blanche.js`) : une saison peut commencer sans contrat. Le temps avance (avant : bloqué), les courses se disputent sans le joueur, et des écuries proposent un baquet au fil de la saison selon les opportunités (baquets libérés), son talent (comparé au niveau de la grille) et sa réputation. Une offre de sa catégorie prend effet tout de suite (il court dès la manche suivante, l'écurie garde deux voitures) ; celles de la catégorie inférieure valent pour la saison suivante.
- **Fin de saison d'un réserviste** : la saison se termine quand toutes les manches sont passées (et non quand le joueur en a couru autant) ; le bilan de réserve passe au plus tard au changement de saison.
- **Talents** (04k) : plancher abaissé de 50 à 30 — tout le plateau du karting était ramené à 50-52. Karting rééquilibré : un débutant finit dans le haut du classement sans dominer.
- Mercato du personnel : un classement d'écuries absent ne fait plus planter le recrutement (06). Module mort de redirection de la stratégie retiré (28).
- Tests : suite `saison` (règles de contrat et une saison complète de F1).

## Appuis sur iPhone — v262

- **Jeu pivoté** (module `136-appui-pivote.js`) : téléphone tenu à l'horizontale avec la rotation verrouillée, le jeu est pivoté par une transformation CSS (css/paysage.css) et Safari iOS ciblait mal les appuis (menus qui ne répondaient pas ou demandaient plusieurs appuis). Dans ce mode, un appui court (< 10 px, < 600 ms) envoie un clic à l'élément réellement sous le doigt et annule le clic du navigateur ; saisie, curseurs et glissements restent natifs.
- Un léger glissé du doigt (< 10 px) n'est plus annulé (110).
- Badge des contrats : un seul décompte, réécrit seulement s'il change (03, 04q, 07d) — il était remplacé toutes les 1,5 s sous le doigt.
- Tests : suite `appui`.

## Calendriers évolutifs — v263

- **Module `137-calendriers.js`** : le calendrier d'une saison se déduit d'une graine de carrière (identique à chaque rechargement). F1 : 20 à 26 Grands Prix, des piliers fixes (Melbourne, Bahreïn, Suzuka, Monaco, Silverstone, Monza, Abu Dhabi), une saison sur trois environ un circuit part et un autre arrive ou revient parmi un vivier réaliste ; 6 à 12 sprints, reconduits pour la plupart. F2 (12 manches) et F3 (10, plus Macao) suivent les circuits de la F1 de la saison ; IndyCar et WEC tournent plus rarement ; Super Formula, F4, Formula Regional et karting inchangés. Le calendrier est annoncé par message en début de saison.
- Nouveaux circuits : Shanghai, Montréal, Qatar (Lusail), Madrid, Istanbul, Sepang, Kyalami, Nürburgring (fiches, pays, tracés inventés par 130).
- Sauvegarde : chaque manche est enregistrée avec son nom, sa semaine et son format, puis relue telle quelle. Une partie antérieure garde le calendrier de sa saison en cours ; l'évolution part de la suivante.
- Le pilote de réserve (79) suit le calendrier de la saison.
- Tests : suite `calendrier`.

## Académies de pilotes — v265

- **Voie F1** (module `138-academie.js`) : une fois le plan F1 annoncé, à partir de la mi-saison, en F2, en Super Formula ou champion de F3, l'académie propose une place pour la saison suivante, sans condition de réputation. Sur le podium : un baquet dans l'écurie sœur (Haas pour Ferrari, Racing Bulls pour Red Bull, Williams pour Mercedes), dans l'écurie phare pour un champion très proche de l'académie. Sinon, ou si la Super Licence projetée en fin de saison manque : pilote de réserve de l'écurie phare (cette offre remplace une offre de réserve ordinaire). L'offre reste ouverte jusqu'au mercato et n'est pas remise en jeu par la concurrence des baquets (116) ; à défaut, elle revient la saison suivante. Avant : seule l'écurie phare était tentée, avec une réputation hors de portée, et l'offre se perdait au premier échec.
- **Revue de fin de saison** : sur le podium, relation +8 ; une saison sous les attentes (place ou relation trop basses, plus strict chez Red Bull) vaut un avertissement, la seconde d'affilée un renvoi.
- **Quitter** : possible à tout moment (avant : impossible sauf après avoir quitté une écurie partenaire) ; réputation paddock −3, et l'académie ne reprend pas le pilote.
- **Invitations** par message, une fois par saison, quand une académie est accessible.
- Entrée : en début de saison, c'est la place de la saison passée qui compte (avant : tout le monde à 0 point, le joueur passait pour 1er).
- L'accueil n'annonce un volant F1 que si l'offre existe vraiment. Données : Ferrari → Haas (et non Audi), Mercedes → Williams, McLaren sans Arrow McLaren (IndyCar).
- Sauvegarde : bloc `rj138`. Tests : suite `academie`.

## Caractère des écuries de F1 et des académies — v266

- **Écuries de F1** (module `139-caracteres.js`) : chaque écurie a un caractère qui pèse dans le choix entre candidats à un baquet (116) — fidélité à sa filière, goût de l'expérience ou de la jeunesse, poids de l'argent — et dans sa patience avant de renvoyer un pilote en fin de saison (14). Red Bull et Racing Bulls misent sur leur filière et ne patientent pas ; Ferrari, Aston Martin et Audi préfèrent l'expérience ; Mercedes et Williams font confiance aux jeunes et patientent ; McLaren recrute le talent ; Haas, Aston Martin et Williams regardent l'apport financier.
- **Profil du pilote** : le style et le trait choisis à la création comptent un peu (3 points de note au plus) auprès des écuries qui les apprécient.
- **Académies** : sévérité de la revue, saisons ratées avant le renvoi (Red Bull : une seule ; Mercedes et Williams : trois), place à atteindre pour un baquet de F1 (Red Bull et Haas : top 5 ; Ferrari : le titre, sinon la réserve d'abord ; les autres : le podium).
- **Labels affichés** sur la fiche de chaque écurie (avec une phrase et « Ton profil de pilote plaît à cette écurie » le cas échéant), sur chaque offre de F1 et sur chaque académie de la page Académie. Un baquet perdu dit quand le caractère de l'écurie a pesé (« Ferrari a préféré l'expérience »).
- Tests : suite `caracteres` ; suite `academie` adaptée.

## Création du pilote sans défiler — v267

- **Module `140-creation-compacte.js` et `css/creation.css`** : sur un téléphone tenu à l'horizontale (852×393), chaque étape défilait (plus de 1 000 px pour atteindre « Continuer » à la première). Désormais, une colonne centrée, plus dense :
  - Retour et Continuer dans une barre fixe en bas, toujours visible, le message d'erreur entre les deux ; de même pour le choix du mode de jeu (la ligne « D'autres modes viendront » est retirée) ;
  - la progression et le rappel du mode dans le bandeau ;
  - prénom et nom sur une ligne ; date de naissance et année de début sur une ligne ; ville et âge calculé sur une ligne ;
  - continents sur une ligne, **sans drapeaux** (seuls les pays gardent le leur) ; pays sur sept colonnes ; l'écurie de cœur, facultative, se replie en une ligne ;
  - style et caractère en quatre tuiles par ligne (le détail du choix suit, 75) ;
  - visage : un réglage par ligne, le numéro sous l'aperçu ; récapitulatif sans le rappel du mode (déjà dans le bandeau), statistiques sur deux colonnes.
- Sous-titres d'étape courts, sans point final : « Identité — Nom et nationalité », « Origines — Naissance et débuts », « Style — Pilotage », « Caractère — Trait dominant », « Profil — Visage et numéro », « Récapitulatif ».
- Résultat (852×393) : aucune étape ne défile, sauf Origines (21 px) et Profil (14 px), et la liste des pays tant qu'elle est ouverte. Sur un grand téléphone (932×430), rien ne défile.
- Tests : suite `creation`.

## Logos des académies — v268

- Les sept logos d'académies sont redessinés comme ceux des écuries de F1 : tuile 40×40 en dégradé, emblème qui rappelle l'écurie mère, plaque de texte en bas, et la même finition (coins arrondis, reflet, double liseré, appliquée par 63). Ferrari : l'écu jaune et le tricolore, monogramme FDA, « Driver Academy » ; Red Bull : le soleil et un taureau, « Junior Team » ; Mercedes : l'étoile dans son anneau pétrole, « Junior » ; Alpine : le A et son triangle rose, « Academy » ; McLaren : la virgule papaye, « Development » ; Haas : les bandes rouge et blanche, « Academy » ; Williams : le W bleu ciel, « Academy ».
- Tests : suite `logos` (finition des logos d'académies).

## Création du pilote : centrage et corrections — v269

- Le contenu de chaque étape est centré entre le bandeau et la barre d'action (il défile depuis le haut s'il est plus grand que la place).
- **Style de pilotage et caractère obligatoires** : plus de choix par défaut (Attaquant, Leader né) ; Continuer reste inactif tant que le joueur n'a pas choisi, et la création refuse de passer l'étape sinon (« Choisis ton style de pilotage », « Choisis ton trait de caractère »).
- **Nouvelle partie remise à zéro** : quitter la création vers l'accueil puis relancer une partie reprenait l'ancienne saisie et l'étape où l'on s'était arrêté (la saisie conservée pour un aller-retour par « changer » de mode n'était jamais effacée), ce qui pouvait aussi afficher un titre d'étape décalé. La saisie n'est désormais conservée que pour « changer » de mode ; quitter ou relancer repart de zéro (écurie de cœur et milieu familial compris).
- Tests : suite `creation` (choix obligatoires, « changer » garde la saisie, nouvelle partie à zéro).

## Étape Profil : Continuer bloqué — v270

- Après un réglage du visage, Continuer ne faisait plus rien : l'éditeur (128) redessine la colonne de l'aperçu, où la création compacte (140) avait placé le champ du numéro, qui disparaissait de la page ; la création plantait alors sur un numéro introuvable. Le bloc du numéro est désormais replacé après chaque redessin, avec sa valeur.
- Tests : suite `creation` (régler le visage, saisir un numéro, continuer).

## Entraînement et progression — v271

- **Gains affichés = gains réels** : le résultat d'une séance annonçait le gain avant le potentiel, l'âge et le plafond (sur 40 séances : +77 affiché, +16 réel). Il montre désormais ce que le pilote a vraiment gagné, au dixième près.
- **L'âge ne compte qu'une fois** : il réduisait le nombre de points de la séance, puis chaque point gagné ; après le pic, l'entraînement tombait à un cinquième de l'effet prévu (à 36 ans, +4 pour 40 séances). À 36 ans, on gagne maintenant environ la moitié de ce qu'on gagne à 24 ans.
- **Développement visible dès le début** : le lancement de la carrière effaçait le profil (potentiels, archétype, arbre), recréé seulement au premier gain ; la section restait vide. Il est créé au lancement et à l'affichage.
- **Effets utiles** : la spécialité « Gestionnaire pneus » devient « Constance » (+ régularité en course, débloquée par les séances mentales) et le palier 3 de la branche Course devient « Rythme constant » (+ constance sur toute la course) ; ils agissaient sur l'usure des pneus, retirée (82).
- **Coach** : le coach recruté dans les relations renforce de 25 % les focus de sa spécialité (technique : pilotage et racecraft ; mental : conditions ; physique : préparation physique).
- **Spécialités** : chaque focus a son type de séance ; Pilotage et Racecraft débloquaient ensemble « Spécialiste qualif » et « Maître des départs ».
- **Fatigue** : au-delà de 60, environ −1 % de performance en course, au-delà de 80, environ −3 % (contre −1 % au-delà de 80 avant) ; l'écran d'entraînement le signale.
- Ancien catalogue de séances (TRAIN_CATALOG, doTrain), remplacé par les focus, retiré (−345 lignes).
- Tests : suite `entrainement`. La suite de création sur téléphone devient `creationtel` : elle portait le même nom que la suite « Création d'une carrière », qui ne tournait plus depuis la v267.

## Arrêts au stand automatiques — v272

- Le joueur ne décide plus de ses arrêts : le bouton « Box » disparaît, et toute demande d'arrêt (bouton, choix d'un événement, texte d'un choix) est ignorée (82). Le muret fait rentrer tout le monde selon le plan de course.
- L'ingénieur annonce chaque arrêt à la radio : « Box, box ! On change les pneus. » (en endurance, un relais sur trois environ : « On garde les pneus, ravitaillement seulement. »).
- **Météo** : quand la piste passe du sec au mouillé (ou l'inverse), tout le plateau rentre dans les trois tours (« Box, box ! Pneus pluie. » / « On repasse en slicks. ») ; un arrêt prévu tout près est fusionné. L'événement « La pluie arrive » propose désormais une façon de rouler (attaquer, rester prudent) au lieu de l'arrêt.
- **Événements** : les choix d'arrêt (Safety Car, VSC, undercut, couvrir un rival…) sont retirés juste avant l'affichage ; un événement qui ne parle que d'arrêt est sauté ; la Safety Car et la VSC proposent des choix de relance. Trois moments décisifs fondés sur un arrêt (neutralisation tardive, seul sur la grille, ravitaillement en ovale) ne sont plus tirés ; « Le déluge » propose « Lever le pied ».
- Tests : suite `arrets`.

## Widgets Contrat et Super Licence — v273

- Le widget « Contrat » ne s'affiche plus que dans Pilote › Carrière (avant : Pilote, tous onglets, Messagerie, Patrimoine) ; le widget « Super Licence » est retiré de Contrats, Championnat et Pilote : l'onglet Carrière a déjà sa carte Super Licence (112). Le widget Budget reste dans Style de vie (119).
- Tests : suite `habillage`.

## Essais et qualifs sans défiler — v274

- **Module `141-essais-qualifs.js` et `css/seances.css`** : sur un téléphone à l'horizontale, les onglets Essais et Qualif défilaient de 350 à 500 px (feuille de temps de vingt grandes lignes, statut des qualifs sous la liste et donc invisible, bouton « Rentrer au stand » tout en bas).
  - Feuilles de temps : les trois premiers (quatre si le joueur y figure), puis le joueur et ses deux voisins, séparés par un trait ; le bouton « Classement complet (20) » ouvre les vingt pilotes en deux colonnes de dix, sans défilement, le joueur repéré. Appliqué à chaque redessin en direct.
  - Le statut des qualifs (« Qualifié Q2 — actuellement P7 ») remonte sous l'en-tête de séance.
  - Blocs resserrés : en-tête, pneus, chrono, carte de séance ; pendant un relais d'essais, l'en-tête « Tour lancé » et la barre des séances (redondants) s'effacent, le conseil de l'ingénieur tient sur une ligne.
  - « Terminer EL1 → EL2 » perdait sa flèche (absente de la police) : « Terminer l'EL1, passer à l'EL2 ».
- Résultat (852×393) : rien ne défile, sauf 7 px pendant un relais d'essais.
- Tests : suite `seances`.

## Corrections course — v275

- **Qualifs karting toujours en fond de grille** : un bug. L'usure des pneus de qualif n'était remise à zéro qu'entre deux segments (Q1→Q2) ; le karting n'en a qu'un, donc l'usure du joueur s'accumulait de week-end en week-end (53,6 s puis 54,6 s…). Pneus neufs à chaque qualif (`_startQualCoeur`, 04).
- **Événements de course sans effet** : leurs secondes étaient converties en « score » à l'échelle de l'ancien moteur (÷45), seize fois trop faible pour le moteur 81, et l'écart restait après la fin de l'effet. Elles passent désormais telles quelles au temps du tour (`_rj81EvtSec`, 04 → 81) et comptent aussi dans la règle de dépassement (sinon l'air sale annulait le gain). Un −3 s fait maintenant gagner 3 s et la place.
- **L'écran remontait après un appui** (« Lancer · 1 PA », boutons en course ; signalé sur iPhone, non reproduit sur Chrome) : module `142-defilement.js`, qui remet la position si la zone revient en haut sans changement d'écran ni d'onglet.
- **Préparation physique passait dans la colonne de droite** (non reproduit ; corrigé par précaution) : les cartes de l'entraînement ne se coupent plus entre deux colonnes et le repos commence toujours la seconde (`seances.css`).
- Gain d'entraînement : « +0,3 » s'affichait « +0 » (arrondi global de 04q), corrigé.
- **Classement en course** : un appui sur la tour bascule entre ÉCART (au premier) et INTERVALLE (à la voiture de devant), choix retenu ; le panneau de droite garde devant / derrière. Sur la grille, plus de « +0,0 » : la tour, le panneau de droite et le tableau du pilote restent vides (ou « — ») jusqu'au départ. La tour ne porte pas `role="button"` : le module 57 la viderait.
- Tests : suite `corrections`.

## Essais libres et qualif cohérents — v276

- **Meilleur temps en essais, fond de grille en qualif** : les deux séances n'utilisaient pas le même modèle.
  - Les essais (18) ignoraient la voiture : rivaux et joueur placés au seul talent du pilote, sur une échelle cinq fois plus large que la qualif ; un pilote d'une petite écurie y dominait. Ils prennent maintenant le niveau de la qualif (pilote + voiture, `_rjNiveauEssais`) et son échelle (0,1 de niveau = 0,22 % du tour).
  - Le joueur gagnait en essais des avantages que la qualif ne compte pas : jusqu'à −1,2 % de « connaissance de la voiture » (ramenée à ±0,15 %) et un réglage valant jusqu'à 4,5 % ; le réglage vaut désormais exactement l'effet qu'il aura en qualif (module 40, ±1 %, `_rj76Delta`).
  - Pneus et mode de pilotage sont comptés par rapport au tour de référence des rivaux (pneus chauds, ~8 % d'usure, rythme normal) au lieu de ne pénaliser que le joueur.
  - Le recalibrage des niveaux de la saison (04k, `rjCalibrerPeloton`) et la forme du week-end (04n) s'appliquent dès les essais, plus seulement au lancement de la qualif.
- **Secteurs violets avec le moins bon chrono** : chaque secteur était tiré à ±1,6 % du tour, plus que l'écart entre la pole et le dernier ; un tour lent pouvait poser un secteur record. Aléa ramené à ±0,3 % (qualif, essais, course) : un secteur violet suppose un tour à moins de 1 % de la pole.
- Tests : suite `coherence`.

## Entraînement : colonnes fixes — v277

- « Préparation physique » passait encore à droite (signalé après la v275, sur iPhone). Cause : le bloc des focus était mis en colonnes par le CSS multi-colonnes, qui rééquilibre à chaque redessin ; après « Lancer », le résultat de la séance s'insère en haut à gauche et Safari repoussait la quatrième carte dans la colonne de droite (les sauts de colonne de la v275, sans préfixe `-webkit-`, n'y suffisaient pas).
- Le gabarit (34) écrit maintenant deux colonnes (`.rjf-col`) : à gauche le résultat, l'état, l'alerte de fatigue et les quatre focus ; à droite « Récupérer » et les programmes premium. Une grille les place côte à côte, ou l'une sous l'autre si l'écran est trop étroit (`seances.css`) : plus aucun rééquilibrage.
- Vérifié sur Chrome à cinq tailles de téléphone, à l'ouverture, après défilement et après « Lancer » ; non vérifié sur un vrai iPhone.
- Tests : suites `corrections` et `entrainement`.

## Événements de course : audit et refonte — v278

- **Inventaire** (40 courses, 4 par catégorie, choix au hasard) : 1 à 5 événements par course, 1 en moyenne en karting junior. Presque toujours les mêmes : départ, « Duel avec … » (107), « Derniers tours » (107) et « Dernier tour — … à portée » (04), souvent deux scènes de fin dans la même course. Les événements propres à une discipline (OTS, ovale, nuit, relais) ne sortaient presque jamais.
- **Bugs corrigés**
  - Chances affichées (47) : sur un événement en piste, celles du dernier événement à choix s'affichaient (« Bianchi à attaquer » montrait les 97/89 % de « Alerte mécanique ») ; `chance.dnf` (un booléen : « l'échec, c'est l'abandon ») était lu comme une probabilité, d'où « 0 % de réussite, 100 % critique » sur des choix risqués à 12-38 %.
  - Effets : tout `mod` sous 0,012 était ignoré, si bien que les choix prudents ne changeaient rien et le résultat disait « Impact limité. ». Conversion désormais proportionnelle (`_convertLegacyMod` : 0,01 ≈ 0,9 s, de 0,3 à 4,5 s sur 1 à 6 tours).
  - Le départ, événement imposé, était retiré dans 58 % des courses : 40 l'épargnait sur une marque `always` que le calendrier ne posait pas.
  - Les choix d'arrêt écrits au format `label` (« Rentrer immédiatement (intermédiaires) ») passaient le filtre des arrêts automatiques (82).
  - « Dernier tour » s'affichait quatre tours avant l'arrivée : « Fin de course », sauf au vrai dernier tour (`_rjFinCourse`).
  - Le résultat ne restait affiché que 1,2 s : 2,6 s.
- **Variété** — module `143-evenements.js` :
  - une banque de 43 événements selon la discipline (karting : carburation, carénage, chaîne, petit train ; F4/F3 : débutant agressif, freins froids, aileron plié, pneus tendres ; F1 : batterie, mode moteur, méplat, vent ; Super Formula : OTS, pneus Yokohama ; WEC : Hypercar, Full Course Yellow, double relais, phares, consommation ; IndyCar : ligne haute, push-to-pass, vent sur l'ovale), la météo (aquaplaning, ligne sèche, gerbes), le circuit (mur, bosses en ville) et la course (débris, huile, attardé, drapeaux bleus, consigne d'équipe, radio coupée…) ;
  - le calendrier garde un seul duel et une seule scène de fin, puis se complète jusqu'à 3 (karting) à 6 événements (courses longues) ; les événements vus lors des dernières courses passent après les autres (mémoire sauvegardée, `rj143`) ;
  - 107 ne rejoue plus un duel ou une fin déjà vus dans la course, et son geste dépend de la discipline (aspiration, DRS, OTS, push-to-pass, trafic WEC).
- **Fenêtre d'événement** (`css/evenements.css`) : centrée à droite de la barre de navigation, la position et les écarts en tête, les choix côte à côte avec leur risque (« Sans risque », « 70 % de réussite », « Abandon si raté · 12 % ») et leur effet (« ≈ 3,2 s gagnées · raté : ≈ 2,7 s perdues ») ; puis un résultat clair (« Réussi · Tu gagnes ≈ 0,8 s sur 2 tours »).
- Tests : suite `evenements`.

## Retours d'une saison de karting — v279

- **Qualifs : le joueur ne s'améliorait jamais, secteurs violets sur un mauvais chrono.** En karting, les tours 2 et suivants étaient réservés à la « séquence du tour chaud » (trois micro-choix), qui n'existe pas en karting : leurs temps étaient jetés, mais leurs secteurs comptaient quand même (d'où les violets). Le joueur posait un temps au premier tour, puis chutait à mesure que les rivaux s'amélioraient. Chaque tour compte désormais ; ailleurs, les secteurs d'un tour chaud sont posés sur son temps final, plus sur le temps provisoire (04, `runQualiSession`).
- **Classement complet** (141) : lu dans les données de la séance (qualif : `QUALI_STATE` ; essais : `_rjEssaisClassement`, exposé par 18), mis à jour pendant qu'il est ouvert. Deux causes aux chronos vides et périmés : la feuille des essais, cachée mais vivante, réécrivait la fenêtre ouverte depuis les qualifs, et l'arrondi global (04q) effaçait les millièmes. Au passage, `formatQualiTime` affichait « 0:50.1000 » pour 50,9996 s.
- **Fin d'un tour de qualif** : « Meilleur tour personnel » remplacé par l'écart à la pole, ce qu'il faut pour gagner une place et, en Q1/Q2, la marge sur l'élimination (ou ce qui manque pour passer).
- **Onglet Course** : il gardait la course précédente jusqu'au « Départ ! ». Le filet existant (40) se croyait en course dès qu'un classement était rempli — celui de la course précédente. Chaque course est désormais marquée à son départ (état du week-end, sprint ou course) ; ailleurs, l'écran est vidé (classement, progression, carte, radio, voisins), et un message radio en retard de la course précédente n'y entre plus (08).
- **Arrivée** : la course s'arrêtait quand le premier passait la ligne. Elle continue à l'écran jusqu'au passage du dernier (au plus un tour : un attardé prend le drapeau au passage suivant) (04 `drapeauApresDernierTour`, 108).
- **Abandons** : ils restent dans la tour de classement, en bas, grisés, « OUT » à la place de l'écart (111).
- **Réglages** : les cinq ressentis (équilibre, freinage, appui, traction, vitesse) sont des curseurs qu'on fait glisser ; au lâcher, les réglages qui les composent bougent d'autant, pondérés, couplages compris (120, `amener`). La partie « − / + » est retirée. Les mêmes curseurs remplacent, en essais libres, le renvoi vers l'onglet Préparation (18).
- **Bilan financier** : il s'ouvrait dès qu'on avançait hors week-end (événement, semaine de pause). Les semaines s'additionnent en un seul bilan, montré à la fin du prochain week-end de course (10).
- **Messages** (124)
  - Mesuré : 48 à 51 messages pour 6 courses de karting. Félicitations de quatre expéditeurs pour une même victoire, une interview et une note technique à chaque course. Désormais une félicitation (tous expéditeurs), une interview et une note technique au plus toutes les six semaines, comme amis et famille ; agent et sponsors espacés. Résultat : 38 messages sur la même période ; une vraie décision passe toujours.
  - Une seule notification pour les messages arrivés ensemble (« Messagerie — 3 nouveaux messages à lire »), sur tous les écrans.
  - Messagerie : une conversation s'ouvre au début de son dernier échange (plus tout en bas), et le retour à la liste rend la position qu'on avait (03). Le garde-défilement (142) laisse la messagerie placer sa vue.
- **Fin de saison** : après le plan de pré-saison, retour à l'accueil de la nouvelle saison au lieu de partir directement sur la première course (105).
- Tests : suite `retours`.

## Débrief de relais — v280

- Débrief des essais : la partie « Ajuste tes réglages » (ancien panneau de réglages injecté par 28) est retirée, puisque les curseurs de ressentis règlent directement la voiture ; leur intertitre devient « Ajustement des réglages » (18). Les curseurs du débrief se redessinent après un réglage, comme ceux des essais (120).

## Pistes suivantes

- Appliquer les caractères aux pilotes gérés par l'ordinateur (Red Bull promouvant réellement ses juniors sur la grille).

- Développement des voitures en cours de saison (évolutions, essais
  privés, retours du pilote), écarté au choix de l'étape 4.
- Rumeurs de transfert entre écuries (le plateau ne déplace aujourd'hui les
  pilotes qu'entre catégories ; les écuries sont réattribuées à la volée).
