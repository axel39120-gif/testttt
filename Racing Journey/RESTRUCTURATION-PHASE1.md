# Racing Journey: F1 Dreams — Restructuration, Phase 1
## Inventaire, carte des dépendances et plan

*Document de référence. Il ne modifie rien : c'est la base de décision avant toute fusion ou suppression.*

---

## 1. Synthèse

- **43 fichiers JS chargés** par `index.html`, **3,42 Mo** au total.
- **Les 6 cœurs (01, 02, 03, 04, 05, 06) pèsent 2,34 Mo, soit 68 % du code.** Quatre sont minifiés sur une seule ligne (01, 02, 03, 05). Ils sont **intouchables** hors bugfix chirurgical : on ne les fusionne pas, on ne les édite pas à la main.
- Le reste (≈ 1,08 Mo) se répartit entre la **couche de simulation 04b–04r** et les **modules de fonctionnalité 07–27**.
- **Anomalies réconciliées :** `13-essais-libres-live.js` et `17-media-press.js`, autrefois référencés mais absents de la source, sont maintenant présents et valides. `index.html` est cohérent.
- **Seul code mort identifié :** `22-strategy-planner.js` → **supprimé (action 1, ci-dessous).**

---

## 2. Le point critique : la simulation est un oignon de wraps

La profondeur de simulation n'est pas une collection de modules indépendants : c'est une **pile de fonctions enveloppées dans un ordre précis**. Deux chaînes portent tout le moteur de course :

```
updateLivePositions  (8 couches, par tour) :
  04b état pilote → 04c pneus → 04d lap-builder → 04e IA → 04f piste
  → 04g radio → 04k réalisme → 04m safety car

runRaceLive  (8 couches, orchestration course) :
  04b → 04i tuning catégorie → 04j finalisation → 04k réalisme
  → 04n forme rivaux → 04p stratégie → 08 radio → 20 week-end
```

Chaque couche capture la version précédente de la fonction. **Changer l'ordre, fusionner ou retirer un maillon casse la chaîne**, et la casse ne se voit qu'en jouant un week-end complet en navigateur (pas de tests automatisés). C'est précisément « l'historique des patchs » que protègent les règles du projet.

**Règle de sûreté qui en découle :** un module *enveloppeur* peut être déplacé/fusionné **uniquement vers une position plus tardive que toutes les fonctions qu'il enveloppe**, et jamais à l'intérieur d'une chaîne multi-fichiers existante.

### Autres chaînes de wrap (à préserver telles quelles)

| Fonction | Chaîne (ordre de chargement) |
|---|---|
| `renderLiveLeaderboard` | 04h → 04j → 08 |
| `showResult` | 04j → 09 → 20 |
| `loadSave` / `saveGame` | 10 → 11 → 07 |
| `refreshScreen` | 11 → 07 |
| `tickRace` | 04m → 04p |
| `resolveLiveEvent` | 04m → 27 |
| `finalizeLiveRace` | 04j → 04l |
| `startQual` | 04l → 04n |
| `startNextSeason` | 04l → 04o |
| `initRivals` | 04o → 04r |
| `navTo` | 06 → 09 |
| `mtab` | 07 → 17 |
| `renderAdvancedSetupUI` | 04p → 07 |
| `updateHomeBadges` | 04q → 07 |
| `pushHomeToast` | 07 → 21 |
| `renderLiveNewsFeed` | 08 → 16 |
| `doPracticeTest` / `doEndPracticeSession` / `renderPracticeSection` | 12 → 13 |
| `getPracticeMaxSessions` | 13 → 18 |

---

## 3. Inventaire complet

Légende type : **C** = cœur (intouchable) · **S** = couche de simulation (chaîne, intouchable) · **F** = fonctionnalité · **U** = UI/polish.

| # | Fichier | Taille | Type | Rôle |
|--:|---|--:|:--:|---|
| 1 | 01-icons | 47 Ko | C | Icônes SVG (minifié) |
| 2 | 02-ui-settings | 42 Ko | C | Réglages UI / thème (minifié) |
| 3 | 03-data-agent | 780 Ko | C | Données, circuits, navigation, agent (minifié, le plus gros) |
| 4 | 04-race-engine | 768 Ko | C | Moteur de course |
| 5 | 04b-driver-state | 20 Ko | S | État pilote (entrée des 2 chaînes) |
| 6 | 04c-tyre-model | 22 Ko | S | Modèle de pneus |
| 7 | 04d-lap-builder | 25 Ko | S | Construction des tours |
| 8 | 04e-driver-ai | 26 Ko | S | IA pilotes |
| 9 | 04f-track-life | 20 Ko | S | Évolution de la piste |
| 10 | 04g-radio-emergent | 25 Ko | S | Radio émergente |
| 11 | 04h-graphics-overlay | 16 Ko | S | Overlay graphique du classement live |
| 12 | 04i-category-tuning | 18 Ko | S | Réglages par catégorie |
| 13 | 04j-race-finalization-fix | 12 Ko | S | Finalisation de course |
| 14 | 04k-realism-overhaul | 28 Ko | S | Refonte réalisme |
| 15 | 04l-engine-fixes | 13 Ko | S | Correctifs moteur (saison/quali) |
| 16 | 04m-safety-car | 27 Ko | S | Safety car / VSC / drapeau rouge |
| 17 | 04n-rival-form | 24 Ko | S | Forme des rivaux |
| 18 | 04o-driver-pool | 43 Ko | S | Vivier de pilotes, transferts, alumni |
| 19 | 04p-race-strategy | 56 Ko | S | Stratégie de course, setup avancé, arrêts |
| 20 | 04q-polish-rebalance | 35 Ko | S/U | Polish + colonne pneus + observer DOM |
| 21 | 04r-skill-rebalance | 18 Ko | S | Rééquilibrage des skills |
| 22 | 10-finance | 50 Ko | F | Finances |
| 23 | 11-neg-patch | 35 Ko | F | Négociations de contrats |
| 24 | 05-progression | 546 Ko | C | Progression de carrière (minifié) |
| 25 | 06-screens | 249 Ko | C | Écrans et navigation |
| 26 | 07-user-fixes | 134 Ko | F | Méga-patch : réseau, sponsors, vie perso, carrière, stats… |
| 27 | 08-radio-commentary | 35 Ko | F/S | Commentaire radio + news feed live |
| 28 | 09-race-header | 22 Ko | F | En-tête de course / navigation |
| 29 | 12-essais-libres | 36 Ko | F | Essais libres (base) |
| 30 | 13-essais-libres-live | 86 Ko | F | Essais libres live : chrono continu, runs, usure, débrief |
| 31 | 14-team-dynamics | 27 Ko | F | Dynamique d'équipe (rôles, offres, confiance, objectifs) |
| 32 | 15-rival-strategy | 11 Ko | F | IA stratégie des rivaux (arrêts) |
| 33 | 16-race-radio-plus | 13 Ko | F | Feed radio enrichi |
| 34 | 17-media-press | 19 Ko | F | « Le Paddock » (espace presse/média) |
| 35 | 18-weekend-formats | 8 Ko | F | Table des formats de week-end |
| 36 | 19-practice-setup-popup | 5 Ko | U | Popup réglages essais |
| 37 | 20-weekend-races | 10 Ko | F | Orchestration des courses du week-end |
| 38 | 21-ux-fixes | 2 Ko | U | Petits correctifs UX (toast) |
| 39 | 23-dedup-strategie | 3 Ko | U | Déduplication de l'écran stratégie |
| 40 | 24-weekend-calendar | 15 Ko | F | Calendrier du week-end |
| 41 | 25-media-preseason | 13 Ko | F | Média pré-saison (feed social) |
| 42 | 26-race-header-style | 3 Ko | U | Style de l'en-tête de course |
| 43 | 27-events-overhaul | 29 Ko | F | Refonte des événements de course |
| — | **22-strategy-planner** | 12 Ko | **MORT** | Planificateur de stratégie jamais branché → **à supprimer** |

---

## 4. Plan de restructuration par tiers

### Action 1 — Supprimer `22-strategy-planner.js` ✅ *(validée)*
Code mort : non chargé par `index.html`, n'expose que `window.RJStrategyPlanner`, **aucune référence externe**. Sa fonction (planifier la stratégie) est couverte par `04p` et les événements du module `27`.
**Impact : nul.** Rien ne l'appelle. Il suffit de retirer le fichier du dossier `js/` ; `index.html` n'a pas à changer puisqu'il ne le charge pas.

### Tier A — Fusion sûre des petits modules de polish *(faible risque, recommandé)*
Candidats : `19-practice-setup-popup`, `21-ux-fixes`, `23-dedup-strategie`, `26-race-header-style` (total ≈ 12 Ko, 4 fichiers).
Aucun n'est au milieu d'une chaîne multi-fichiers ; ils ne font qu'*ajouter* des wraps tardifs. Fusionnés en un seul module **chargé en dernier**, toutes leurs cibles de wrap sont déjà définies → ordre préservé.
**Gain : 4 fichiers → 1.** Validation : un week-end complet en navigateur (toast, écran stratégie, popup essais, en-tête).

### Tier B — Regroupement « média » *(risque moyen, optionnel)*
Candidats : `17-media-press` (Le Paddock) + `25-media-preseason` (feed pré-saison).
Thématiquement liés, pas de chaîne commune entre eux. Contrainte : la partie `17` doit rester chargée **après `07`** (chaîne `mtab : 07 → 17`). Le module fusionné prend donc la position la plus tardive des deux.
**Gain : 2 fichiers → 1.**

### Tier C — Essais libres ✅ *(réalisé)*
`12-essais-libres` + `13-essais-libres-live` → fusionnés en `30-essais-consolidated.js`.
Vérification déterminante : les deux sont des **IIFE nommées propres, sans aucune déclaration top-level**, et **adjacentes** dans l'ordre de chargement (rien entre `12` et `13`). Concaténer `12` puis `13` dans le même fichier est donc **mécaniquement équivalent** à les charger en deux balises séparées : l'override volontaire de `13` sur `12` (`doPracticeTest` / `doEndPracticeSession` / `renderPracticeSection`) est conservé à l'identique, et le module reste placé **avant `18`** pour préserver la chaîne `getPracticeMaxSessions : 13 → 18`. Le risque initialement estimé « élevé » s'est révélé faible une fois la structure réelle constatée.

### Intouchable
- **Cœurs** 01, 02, 03, 04, 05, 06 (minifiés ou massifs).
- **Oignon de simulation** 04b → 04r (les deux chaînes de 8).
- **07-user-fixes** (134 Ko, enveloppe 30+ fonctions, central) et le couple **10/11** (chaînes save/load/refresh).

---

## 5. Bilan de ce qui est réellement gagnable

| Étape | Fichiers avant | après | Risque | État |
|---|--:|--:|---|---|
| Supprimer 22 | 44 présents | 43 | nul | ✅ |
| Tier A (polish → 28) | 43 | 40 | faible | ✅ |
| Tier B (média → 29) | 40 | 39 | moyen | ✅ |
| Tier C (essais → 30) | 39 | 38 | faible (après constat) | ✅ |

**État final : 38 modules JS chargés** (contre 44 au départ), trois consolidés créés (`28` polish, `29` média, `30` essais), un mort supprimé (`22`), six anciens fichiers absorbés (`17`, `19`, `21`, `23`, `25`, `26`) et deux fusionnés (`12`, `13`). **Aucun cœur ni couche de simulation `04b–04r` touché.** Service worker en v11. Validé en navigateur : tous les hooks s'installent, zéro erreur.
