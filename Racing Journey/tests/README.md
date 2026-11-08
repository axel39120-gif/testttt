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
| `piste` | course rejouée en temps réel : distances dans les bornes, classement en direct conforme à l'ordre sur la piste, arrêts au stand visibles dans le tour rejoué |
| `parcours` | ouverture de chaque écran et de chaque onglet sans erreur (les `onclick` échappent à la mesure de couverture) |
| `qualifications` | intitulés de session par catégorie, remise à zéro des références de secteurs entre Q1/Q2/Q3 |
| `course` | déroulé complet dans quatre catégories : positions distinctes, écarts positifs, sauts bornés, résultat enregistré, absence d'usure de pneus, plateau multi-classes de l'endurance, arrêts au stand |
| `course-rapide` | la même chose sur la seule Formule 1, pour une vérification en une minute |
| `endurance` | six courses d'endurance : plus grand saut de places par course (défaut connu signalé, à corriger avec le nouveau moteur) |
| `weekend` | stratégie retirée du parcours et inatteignable, réglages dans la préparation, feuille de temps en fenêtre |
| `circuit` | course en direct sur le tracé : bon circuit, un point par voiture, jamais de recul, dépassements de moins d'1,2 s, stand, abandon, animation arrêtée hors écran et au drapeau, mouvement fluide à l'allure d'un tour |
| `arrivee` | le classement inscrit au drapeau est celui du dernier tour, temps au stand compris (F1, F2, IndyCar) |
| `simulation` | arrivée liée au niveau des pilotes avec arrêts (F1, IndyCar, endurance), même nombre d'arrêts pour les rivaux, pas d'ex æquo en tête, qualification sans temps identiques, coéquipiers différents |
| `equite` | joueur moyen au milieu du peloton (F3, F1), pluie identique pour tous, écart de qualification sous 4 %, talents de la saison fixés dès la qualification |
| `chronometre` | course au chronomètre : écarts qui se creusent et croissants avec la position, dépassements en piste, départ qui peut changer l'ordre, voiture rapide partie dernière qui remonte, lente partie en pole qui recule, Monaco plus dur que Monza |
| `ecrans` | iPhone en portrait : jeu pivoté aux proportions du paysage, toucher qui suit la rotation ; iPhone en paysage avec encoche simulée : rail, HUD, badge et contenu hors des zones sûres ; application figée ; listes ouvertes en panneau de choix, choix appliqué avec son onchange |
| `reglages` | atelier de réglages : ressentis et réglages selon la catégorie, bouton + qui règle, tour d'essai qui fait parler le pilote, fenêtres qui se resserrent, confiance maximale au réglage idéal |
| `entourage` | réseau sans doublon (fusion au rôle officiel et à la meilleure relation), pilotes et souvenirs ajoutés par les courses, message rattaché à son auteur et réponse qui change la relation, trait pour chaque contact et qui pèse, écran par cercles, fiche avec trait, action à 1 PA |
| `presse` | médias avec ligne éditoriale et sympathie, provocation qui plaît au tabloïd et refroidit la presse bienveillante, promesse retenue puis rappelée après un mauvais résultat, titres du week-end avec le circuit, interview d'après-course à plusieurs tons dont la réponse est publiée et pèse, audience qui grandit après une course sans publication, sauvegarde de la presse et des déclarations, revue et sympathies dans Médias › Presse |
| `messagerie` | accusé de réception sans effet changé en info, bouton unique à petit effet appliqué à la réception, vrais choix gardés, priorité de chaque message, proposition qui expire au bout de trois semaines (négociation d'écurie épargnée) et dont l'expéditeur se souvient, réponse du contact la semaine suivante sans choix, débrief de l'ingénieur après une course, écrire à un contact depuis sa fiche, pastilles et filtres de la boîte |
| `vieperso` | proches qui ne s'effondrent plus sans action, moments de la saison (anniversaire, Grand Prix à domicile, rencontre), choix qui rapproche, rencontre qui crée une relation, proches qui écrivent après une victoire, moments affichés |
| `habillage` | notification en haut au centre, file pendant la course puis affichage regroupé au retour, messages courts dans la même pile, plus de widgets course et rêves, tuile du duel au face-à-face, titres communs, cartes en tuile |
| `amour` | pas de rencontre avant 18 ans, profil selon la réputation, couple avec une célébrité et presse people, emménagement, enfant (proposition puis naissance), rupture après une relation glacée, rubrique Vie privée, foyer dans Vie perso |
| `avatars` | même visage pour un même personnage, cheveux selon le pays, trente portraits en moins d'une seconde et demie, éditeur à la création qui enregistre, portraits dans le bandeau, la messagerie, l'entourage, les classements et le face-à-face, modification depuis le bandeau, sauvegarde |
| `rivaux` | carrière créée par l'écran de création avec des rivaux et un classement complet, rivaux qui marquent après une course, sauvegarde sans rivaux réparée au chargement |
| `vides` | un sous-titre sans contenu reçoit une phrase d’attente, retirée quand le contenu arrive |
| `circuits` | chaque circuit a un tracé fermé partant de la ligne droite principale, des infos (longueur, virages, secteurs, note) mesurées sur ce tracé ; tracé stable d’une partie à l’autre |
| `logos` | chaque écurie a un blason généré dont les dégradés sont rangés dans un bloc toujours rendu ; tous les modèles de l’éditeur se dessinent ; couleurs d’écurie connues |
| `contacts` | Messagerie › Contacts : une fiche par contact, sujets avec effets possibles, envoi qui ajoute l’échange au fil et bloque jusqu’à la semaine suivante |
| `essais` | retours de l’ingénieur accordés, briefing propre à chaque séance (EL1/EL2/EL3), pneus de qualif nommés en français |
| `casque` | éditeur de casque : motifs dessinés, choix enregistrés avec le pilote (couleurs, motif, visière, numéro), casque visible dans Stats |
| `superlicence` | barème, fenêtre de trois saisons, âge, licence conservée, offre de F1 changée en réserviste sans licence, carte affichée |
| `mercato` | rumeurs une fois par saison et fondées, relevé fidèle de l'intersaison, verdicts, sauvegarde, onglet |
| `heritage` | rêves (trois au plus), Triple Couronne, pas de double comptage, réussite célébrée une fois, sauvegarde, onglet et frise |
| `economie` | barème des baquets et salaires, sponsors par catégorie, soutien familial, conversion des anciennes sauvegardes |
| `baquets` | places libres, soutien des pilotes du plateau, priorités des écuries, filtrage des offres, apport, paiement échelonné |
| `negociation` | écran ouvert de bout en bout, clause du module 11, patience selon le rival, sponsors engagés, plan B |
| `decisions` | décisions en course, mini-classement, chien de garde |
| `ui` | hauteurs d'écran sous leurs seuils (en écrans paysage), absence d'icônes dans les boutons d'action, navigation sans erreur |
| `paysage` | à trois tailles : rail à gauche (présent sur les écrans de consultation), un seul écran affiché, même bandeau partout, ressources (HUD) à l'accueil seulement et à jour, aucun onglet coupé, sélecteur Pilotes / Écuries du championnat de l'accueil, onglets dans le bandeau entre titre et HUD, même gouttière partout, accueil sans défilement avec saison et forme, rien ne déborde ; écran « tourne ton téléphone » en portrait |

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
