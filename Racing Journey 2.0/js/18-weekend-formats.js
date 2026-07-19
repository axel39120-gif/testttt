/* =============================================================================
 * 18-weekend-formats.js — REFONTE WEEK-END · PHASE 1 : FONDATION
 * =============================================================================
 *
 * OBJECTIF
 * --------
 * Établir une SOURCE UNIQUE DE VÉRITÉ décrivant le format réel du week-end de
 * chaque catégorie (séances d'essais, type de qualif, séquence de courses,
 * règles d'arrêt). Les phases suivantes (courses multiples, qualif réaliste,
 * arrêts) s'appuieront dessus.
 *
 * PHASE 1 (ce module) — périmètre volontairement sûr :
 *   - Définit WEEKEND_FORMATS + helpers (getWeekendFormat, getSessionSequence,
 *     weekendRaceDefs, weekendHasSprint…).
 *   - Branche UNIQUEMENT le nombre de séances d'essais (wrap de
 *     getPracticeMaxSessions) pour qu'il soit fidèle par catégorie.
 *   - Ne modifie PAS encore le déroulé des courses (Phase 2).
 *
 * Réalité visée (essais libres = séances de roulage avant les chronos) :
 *   Karting 1 · F4 1 · Formula Regional 2 · F3 1 · F2 1 · F1 3 ·
 *   Super Formula 2 · WEC 3 · IndyCar 2
 *
 * ARCHITECTURE : Option A — wrap non invasif, bootstrap/retry, idempotent.
 * ORDRE DE CHARGEMENT : après 03 (getPracticeMaxSessions) et 12/13 (essais).
 * ===========================================================================*/
(function () {
  'use strict';
  var TAG = '[18-weekend-formats]';

  // Types de qualif : "timed" (chrono karting), "single" (1 séance),
  //   "groups" (2 groupes F4), "knockout2" (Q1/Q2), "knockout3" (Q1/Q2/Q3),
  //   "hyperpole" (WEC), "multiround" (IndyCar).
  // Types de course : "heat", "prefinal", "final", "race", "sprint", "feature".
  // Grilles : "quali", "heatResult", "heats", "prefinal", "reverse10",
  //   "reverse12", "partialReverse", "prevResult".
  var WEEKEND_FORMATS = {
    'Karting Junior': {
      practice: 1, quali: 'timed',
      races: [
        { type: 'heat', label: 'Manche 1', grid: 'quali' },
        { type: 'heat', label: 'Manche 2', grid: 'heatResult' },
        { type: 'prefinal', label: 'Préfinale', grid: 'heats' },
        { type: 'final', label: 'Finale', grid: 'prefinal' }
      ],
      pit: { min: 0 }
    },
    'Karting Senior': {
      practice: 1, quali: 'timed',
      races: [
        { type: 'heat', label: 'Manche 1', grid: 'quali' },
        { type: 'heat', label: 'Manche 2', grid: 'heatResult' },
        { type: 'prefinal', label: 'Préfinale', grid: 'heats' },
        { type: 'final', label: 'Finale', grid: 'prefinal' }
      ],
      pit: { min: 0 }
    },
    'Formule 4': {
      practice: 1, quali: 'groups',
      races: [
        { type: 'race', label: 'Course 1', grid: 'quali' },
        { type: 'race', label: 'Course 2', grid: 'quali' },
        { type: 'race', label: 'Course 3', grid: 'partialReverse' }
      ],
      pit: { min: 0 }
    },
    'Formula Regional': {
      practice: 2, quali: 'groups',
      races: [
        { type: 'race', label: 'Course 1', grid: 'quali' },
        { type: 'race', label: 'Course 2', grid: 'partialReverse' }
      ],
      pit: { min: 0 }
    },
    'Formule 3': {
      practice: 1, quali: 'single',
      races: [
        { type: 'sprint', label: 'Course Sprint', grid: 'reverse12' },
        { type: 'feature', label: 'Course Principale', grid: 'quali' }
      ],
      pit: { min: 0 }
    },
    'Formule 2': {
      practice: 1, quali: 'single',
      races: [
        { type: 'sprint', label: 'Course Sprint', grid: 'reverse10' },
        { type: 'feature', label: 'Course Principale', grid: 'quali', pit: { min: 1, compounds: 2 } }
      ],
      pit: { min: 0 }
    },
    'Formule 1': {
      practice: 3, quali: 'knockout3',
      races: [
        { type: 'feature', label: 'Grand Prix', grid: 'quali', pit: { min: 1, compounds: 2 } }
      ],
      pit: { min: 1, compounds: 2 },
      sprintWeekend: true   // certains week-ends passent en format Sprint (Phase 2)
    },
    'Super Formula': {
      practice: 2, quali: 'knockout2',
      races: [
        { type: 'feature', label: 'Course', grid: 'quali', pit: { min: 1, compounds: 2 } }
      ],
      pit: { min: 1, compounds: 2 }
    },
    'Endurance WEC': {
      practice: 3, quali: 'hyperpole',
      races: [
        { type: 'feature', label: 'Course', grid: 'quali', endurance: true }
      ],
      pit: { min: 3 }
    },
    'IndyCar': {
      practice: 2, quali: 'multiround',
      races: [
        { type: 'feature', label: 'Course', grid: 'quali' }
      ],
      pit: { min: 1 }
    }
  };

  var DEFAULT_FORMAT = {
    practice: 2, quali: 'single',
    races: [{ type: 'race', label: 'Course', grid: 'quali' }],
    pit: { min: 0 }
  };

  function fn(name) { return typeof window[name] === 'function'; }
  function curCat() { return (typeof window !== 'undefined' && window.G && window.G.cat) ? window.G.cat : null; }

  function getWeekendFormat(cat) {
    cat = cat || curCat();
    return (cat && WEEKEND_FORMATS[cat]) ? WEEKEND_FORMATS[cat] : DEFAULT_FORMAT;
  }

  // Séquence ordonnée des séances pour piloter onglets + état (Phase 2+).
  function getSessionSequence(cat) {
    var f = getWeekendFormat(cat);
    var seq = ['prep'];
    if (f.practice > 0) seq.push('essais');
    seq.push('qualif', 'strat');
    f.races.forEach(function (r, i) { seq.push({ phase: 'race', index: i, def: r }); });
    seq.push('res');
    return seq;
  }

  function weekendRaceDefs(cat) { return getWeekendFormat(cat).races.slice(); }
  function weekendHasSprint(cat) { return getWeekendFormat(cat).races.some(function (r) { return r.type === 'sprint'; }); }
  function weekendRaceCount(cat) { return getWeekendFormat(cat).races.length; }

  /* ----------------------------------------------------------------------- *
   *  Branchement Phase 1 : nombre de séances d'essais fidèle
   * ----------------------------------------------------------------------- */
  function installPracticeCount() {
    if (!fn('getPracticeMaxSessions') || window.getPracticeMaxSessions._wf18) return false;
    var orig = window.getPracticeMaxSessions;
    window.getPracticeMaxSessions = function () {
      try {
        var f = getWeekendFormat(curCat());
        if (f && typeof f.practice === 'number') return f.practice;
      } catch (e) { /* no-op */ }
      return orig.apply(this, arguments);
    };
    window.getPracticeMaxSessions._wf18 = true;
    return true;
  }

  function boot(retries) {
    if (typeof window === 'undefined') return;
    // expose pour les phases suivantes (toujours, même avant que G existe)
    window.WEEKEND_FORMATS = WEEKEND_FORMATS;
    window.getWeekendFormat = getWeekendFormat;
    window.getSessionSequence = getSessionSequence;
    window.weekendRaceDefs = weekendRaceDefs;
    window.weekendHasSprint = weekendHasSprint;
    window.weekendRaceCount = weekendRaceCount;

    if (fn('getPracticeMaxSessions')) {
      // NB : getPracticeMaxSessions contrôle le nombre de RUNS jouables dans la
      // séance d'essais live (module 13), pas le nombre de séances du format.
      // On NE le wrappe donc PAS : le brancher sur format.practice (ex. 1 en
      // karting) limitait le joueur à un seul run et terminait les essais
      // instantanément. Le nombre de séances du format est géré séparément.
      window.rjDebugWeekendFormat = function () {
        var c = curCat();
        console.log(TAG, c, '→', getWeekendFormat(c), '| essais:', (fn('getPracticeMaxSessions') ? window.getPracticeMaxSessions() : '?'));
      };
      console.log(TAG, 'activé — formats de week-end par catégorie (Phase 1 : séances d\u2019essais). Debug: rjDebugWeekendFormat()');
      return;
    }
    if (retries > 0) { setTimeout(function () { boot(retries - 1); }, 400); return; }
    console.warn(TAG, 'abandon — getPracticeMaxSessions introuvable.');
  }

  boot(50);
})();
