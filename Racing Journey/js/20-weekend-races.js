/* =============================================================================
 * 20-weekend-races.js — REFONTE WEEK-END · PHASE 2 : COURSES MULTIPLES
 * =============================================================================
 *
 * OBJECTIF
 * --------
 * Transformer le week-end « une seule course » en une SÉQUENCE de courses
 * fidèle à la catégorie (table WEEKEND_FORMATS du module 18) :
 *   Karting : Manche 1 → Manche 2 → Préfinale → Finale
 *   F4      : Course 1 → Course 2 → Course 3 (grille partiellement inversée)
 *   F2/F3   : Course Sprint (grille inversée) → Course Principale
 *   autres  : 1 course (comportement inchangé)
 *
 * LE POINT DUR (et sa solution)
 * -----------------------------
 * `showResult` (moteur) fait TOUT en un bloc : calcul position/points,
 * enregistrement dans G.races, PUIS clôture du week-end — incrément de
 * G.semaine + runWeeklyTicks (événements + finances hebdo). Relancer une
 * course après chaque showResult ferait donc avancer la semaine et créditer
 * les finances une fois PAR MANCHE → progression et argent corrompus.
 *
 * SOLUTION : pour toute manche SAUF la dernière, on neutralise la clôture
 * pendant l'exécution de showResult (runWeeklyTicks rendu inerte + G.semaine
 * restauré), on enregistre le résultat de la manche, puis on relance
 * `runRaceLive()` avec la grille de départ de la manche suivante. La clôture
 * (avancement de semaine + finances) ne s'exécute qu'UNE fois, après la
 * dernière course.
 *
 * GRILLE DE DÉPART : `runRaceLive` lit RACE_STATE.qualiPos. On la règle selon
 * la définition de la course (résultats de qualif, grille de la manche
 * précédente, inversion partielle).
 *
 * ARCHITECTURE : Option A (wraps), réversible, idempotent, try/catch partout.
 * ORDRE : après 04 (showResult/runRaceLive) et 18 (WEEKEND_FORMATS).
 * ===========================================================================*/
(function () {
  'use strict';
  var TAG = '[20-weekend-races]';

  // ---------------------------------------------------------------------------
  // INTERRUPTEUR — courses multiples par week-end.
  //   false → UNE seule course par week-end : la course se termine toujours
  //           normalement (clôture native du moteur). Solution sûre contre le
  //           bug "course qui se relance à l'infini au dernier tour" reproduit
  //           sur iOS. Le Karting n'a alors qu'une course au lieu de 4 manches.
  //   true  → enchaînement complet des manches (Karting : Manche 1→2→Préfinale
  //           →Finale). À ne réactiver qu'une fois le bug iOS élucidé.
  // Réglable aussi à chaud depuis la console : window.RJ_WEEKEND_MULTI_RACE = true
  // ---------------------------------------------------------------------------
  var MULTI_RACE = (typeof window !== 'undefined' && typeof window.RJ_WEEKEND_MULTI_RACE === 'boolean')
    ? window.RJ_WEEKEND_MULTI_RACE : false;

  var seq = null;          // séquence du week-end en cours : {key,idx,total,defs,lastPos}
  var pendingRelaunch = false; // une relance de manche est déjà programmée
  var weekendRaceCount = 0;    // filet anti-infini : nb de courses lancées ce week-end
  // Détection nouveau week-end vs relance de manche — DÉTERMINISTE (ne dépend
  // d'aucun timing, contrairement aux versions précédentes par booléen ou
  // horodatage, fragiles sur WebKit/iOS et cause de "même manche à l'infini").
  // La séquence est ancrée à une CLÉ de week-end (circuit + saison + semaine) :
  // pendant les 4 manches, la clôture de semaine est neutralisée donc la clé
  // reste STABLE → seq est conservée et idx progresse jusqu'à la finale. Elle ne
  // se réinitialise que si la clé change réellement (autre week-end). L'infini
  // "même manche" devient ainsi structurellement impossible.

  function fn(name) { return typeof window[name] === 'function'; }
  function G_() { return (typeof window !== 'undefined' && window.G) ? window.G : null; }

  function weekendKey() {
    var c = (typeof RACE_STATE !== 'undefined' && RACE_STATE && RACE_STATE.circuit) ? RACE_STATE.circuit : '';
    var G = G_();
    var s = (G && typeof G.saison === 'number') ? G.saison : 0;
    var w = (G && typeof G.semaine === 'number') ? G.semaine : 0;
    return c + '#' + s + '#' + w;
  }

  function raceDefs() {
    var G = G_();
    if (fn('weekendRaceDefs')) { try { return window.weekendRaceDefs(G && G.cat); } catch (e) { /* no-op */ } }
    return [{ type: 'race', label: 'Course', grid: 'quali' }];
  }

  function ensureSeq() {
    if (seq) return seq;
    var defs = raceDefs();
    seq = { key: weekendKey(), idx: 0, total: defs.length, defs: defs, lastPos: null };
    if (defs.length > 1) console.log(TAG, 'week-end ' + defs.length + ' courses :', defs.map(function (d) { return d.label; }).join(' → '));
    return seq;
  }

  // Position de départ de la manche suivante selon le type de grille.
  function gridStartPos(def, lastPos) {
    var G = G_();
    var fieldSize = (G && G.rivals ? G.rivals.length + 1 : 20);
    var g = def.grid || 'quali';
    if (g === 'quali') return (typeof RACE_STATE !== 'undefined' && RACE_STATE.qualiPos) ? RACE_STATE.qualiPos : (G && G.qualiPos) || 5;
    if (lastPos == null) lastPos = (typeof RACE_STATE !== 'undefined' && RACE_STATE.qualiPos) ? RACE_STATE.qualiPos : 5;
    if (/reverse(\d+)/.test(g)) {
      var n = parseInt(g.match(/reverse(\d+)/)[1], 10) || 10;     // top N inversés
      return (lastPos <= n) ? (n + 1 - lastPos) : lastPos;
    }
    if (g === 'partialReverse') {                                  // F4 course 3 : top 8 inversés
      var n2 = 8;
      return (lastPos <= n2) ? (n2 + 1 - lastPos) : lastPos;
    }
    // heatResult / heats / prefinal / prevResult → grille = arrivée précédente
    return Math.max(1, Math.min(fieldSize, lastPos));
  }

  function relaunchNext() {
    if (pendingRelaunch) return;   // une relance est déjà programmée (anti-doublon)
    try {
      var def = seq.defs[seq.idx];
      var start = gridStartPos(def, seq.lastPos);
      if (typeof RACE_STATE !== 'undefined') RACE_STATE.qualiPos = start;
      var G = G_(); if (G) G.qualiPos = start;
      // Réinitialise les drapeaux du week-end pour autoriser une nouvelle course.
      if (typeof RACE_WEEKEND_STATE !== 'undefined') { RACE_WEEKEND_STATE.courseDone = false; }
      pendingRelaunch = true;
      // La clé de week-end est inchangée (clôture neutralisée) → la séquence sera
      // conservée au prochain runRaceLive, qui enchaîne sur la manche suivante.
      setTimeout(function () {
        pendingRelaunch = false;
        try { window.runRaceLive(); }
        catch (e) { console.warn(TAG, 'relance:', e); }
      }, 60);
    } catch (e) { console.warn(TAG, 'relaunchNext:', e); }
  }

  function renameLast(def) {
    try {
      var G = G_();
      if (G && G.races && G.races.length && def && def.label) {
        G.races[G.races.length - 1].nom = def.label;
      }
    } catch (e) { /* no-op */ }
  }

  function install() {
    if (!fn('showResult') || !fn('runRaceLive')) return false;
    // Garde anti-double-wrap STABLE : un flag global qui survit aux re-wraps
    // d'autres modules (ex. 04j re-wrappe runRaceLive/showResult ~200ms après le
    // chargement, ce qui efface la propriété _td20 et poussait l'ancien garde à
    // ré-installer 20 PAR-DESSUS → double comptage de weekendRaceCount et clôture
    // prématurée). Avec ce flag, 20 ne s'installe qu'une fois ; comme les wraps de
    // 04j appellent la chaîne d'origine, l'orchestration de 20 reste active.
    if (window._rj20Installed) return false;
    window._rj20Installed = true;

    // MODE COURSE UNIQUE : on n'installe AUCUN wrap de relance. showResult et
    // runRaceLive restent ceux du moteur → la course finalise et clôture le
    // week-end normalement, sans jamais se relancer. Garantit qu'elle se termine.
    if (!MULTI_RACE) {
      console.log(TAG, 'v15 — mode UNE COURSE par week-end (relance multi-manches désactivée)');
      installPracticeReset();
      return true;
    }
    console.log(TAG, 'v15 — mode MULTI-MANCHES actif');

    // --- wrap runRaceLive : un nouveau week-end (clé différente) démarre une séquence ---
    var origRun = window.runRaceLive;
    window.runRaceLive = function () {
      // Si la séquence courante n'appartient pas au week-end actuel (clé changée
      // ou absente), c'est un nouveau week-end → on repart à zéro. Sinon c'est une
      // relance de manche du MÊME week-end → on conserve la séquence (idx progresse).
      var key = weekendKey();
      if (!seq || seq.key !== key) { seq = null; weekendRaceCount = 0; }
      weekendRaceCount++;
      return origRun.apply(this, arguments);
    };
    window.runRaceLive._td20 = true;

    // --- wrap showResult : orchestration de la séquence ---
    var origSR = window.showResult;
    window.showResult = function () {
      // IDEMPOTENCE : une seule orchestration par course. finalizeLiveRace peut
      // être déclenché plusieurs fois pour une même course (watchdog 04j,
      // fallback rjGuardedFinalize, double tick). Sans ce verrou, chaque appel
      // relançait la séquence et la 2ᵉ relance était prise pour un lancement
      // MANUEL → seq réinitialisée → le week-end recommençait à l'infini
      // (écran noir + événements en boucle). Le verrou est porté par l'instance
      // LIVE_RACE, recréée à chaque runRaceLive → naturellement par-course.
      try {
        if (typeof LIVE_RACE !== 'undefined' && LIVE_RACE) {
          if (LIVE_RACE._td20Resulted) return null; // résultat déjà traité
          LIVE_RACE._td20Resulted = true;
        }
      } catch (e) { /* no-op */ }

      var G = G_();
      var s = ensureSeq();
      var def = s.defs[s.idx];
      // GARDE ANTI-INFINI : on ne lance jamais plus de courses que de manches
      // prévues. Même si seq dérive (idx figé), weekendRaceCount, lui, compte les
      // courses réellement lancées et force la clôture au-delà du total.
      var isLast = (s.idx >= s.total - 1) || (weekendRaceCount >= s.total);

      if (isLast || s.total <= 1) {
        // Dernière course (ou catégorie mono-course) : clôture normale.
        var r = origSR.apply(this, arguments);
        renameLast(def);
        seq = null;                       // prêt pour le prochain week-end
        weekendRaceCount = 0;
        return r;
      }

      // Course intermédiaire : on neutralise la clôture de semaine.
      var savedSemaine = (G && typeof G.semaine === 'number') ? G.semaine : null;
      var origTicks = window.runWeeklyTicks;
      window.runWeeklyTicks = function () { /* différé jusqu'à la dernière course */ };
      try {
        origSR.apply(this, arguments);    // calcule pos/pts + push G.races (clôture neutralisée)
      } finally {
        window.runWeeklyTicks = origTicks;
        if (savedSemaine != null && G) G.semaine = savedSemaine;  // annule l'avancement de semaine
      }

      // Enregistre le résultat de la manche et enchaîne.
      try {
        var rec = (G && G.races && G.races.length) ? G.races[G.races.length - 1] : null;
        if (rec) { rec.nom = (def && def.label) || rec.nom; s.lastPos = rec.pos; }
      } catch (e) { /* no-op */ }
      s.idx++;
      relaunchNext();
      return null;
    };
    window.showResult._td20 = true;

    installPracticeReset();
    return true;
  }

  // --- wrap initRaceState : réinitialiser les ESSAIS à chaque nouveau week-end ---
  // Bug : initRaceState (03) restaure RACE_STATE.practice du week-end précédent
  // dès que sessionsCompleted != 0 (condition `!_prevPractice.sessionsCompleted`).
  // Résultat : en arrivant sur un nouveau week-end, les essais s'affichent comme
  // « terminés » (bouton « Aller en qualif »). On tamponne la pratique avec une
  // clé de week-end (circuit + manche) et on repart à neuf si elle appartient à
  // un autre week-end ; une séance en cours sur le MÊME week-end est conservée.
  // Inoffensif et utile dans les deux modes (course unique ou multi-manches).
  function installPracticeReset() {
    if (fn('initRaceState') && !window.initRaceState._rjPracReset) {
      var origIRS = window.initRaceState;
      window.initRaceState = function () {
        var r = origIRS.apply(this, arguments);
        try {
          if (fn('hasPracticeSystem') && window.hasPracticeSystem()) {
            var G = G_(), rs = window.RACE_STATE;
            if (rs) {
              var key = (rs.circuit || '') + '#' + ((G && G.races && G.races.length) || 0);
              var pr = rs.practice;
              if (pr && pr._wknd && pr._wknd !== key && fn('initPracticeState')) {
                window.initPracticeState();        // essais d'un autre week-end → frais
                pr = rs.practice;
              }
              if (pr && !pr._wknd) pr._wknd = key;  // tampon du week-end courant
            }
          }
        } catch (e) { /* no-op */ }
        return r;
      };
      window.initRaceState._rjPracReset = true;
    }
  }

  function boot(retries) {
    if (typeof window === 'undefined') return;
    if (fn('showResult') && fn('runRaceLive')) {
      install();
      setTimeout(install, 1500);
      window.rjDebugWeekendRaces = function () {
        console.log(TAG, 'mode:', MULTI_RACE ? 'multi-manches' : 'course unique', '| séquence:', seq, '| defs:', raceDefs().map(function (d) { return d.label; }));
      };
      console.log(TAG, 'activé (' + (MULTI_RACE ? 'multi-manches' : 'course unique') + '). Debug: rjDebugWeekendRaces()');
      return;
    }
    if (retries > 0) { setTimeout(function () { boot(retries - 1); }, 400); return; }
    console.warn(TAG, 'abandon — showResult/runRaceLive introuvables.');
  }

  boot(50);
})();
