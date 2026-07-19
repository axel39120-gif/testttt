/* =====================================================================
 * 43-realism-tuning.js — RECALIBRAGE DU RÉALISME DES TEMPS AU TOUR
 *
 * Corrige les anomalies relevées par l'audit de réalisme :
 *
 * 1. CAT_LAP_MULT (multiplicateur de temps vs F1=1.0) :
 *    - Endurance WEC : 1.308 -> 1.20  (Hypercar ~+20% vs F1, et non +31%)
 *    - IndyCar       : 0.974 -> 1.10  (~+10% sur circuit routier, et non plus rapide que F1)
 *
 * 2. refLapF1 manquants (circuits à 0 -> fallback générique 85s) :
 *    - 24h Le Mans : 171 -> WEC ~3:25 (circuit de 13,6 km, ininterprétable avec 85s)
 *    - GP Valencia : 98  (~1:38 F1), GP Portimao : 78 (~1:18 F1)
 *    - 12 GP français fictifs : temps F1 équivalents variés (fin de l'indifférenciation)
 *    - circuits "X Kart" : refLapF1 du circuit original réel (cohérent quelle que
 *      soit la catégorie ; en karting ×0.667 donne des temps plausibles 45-70s)
 *
 * getCircuitBaseRef = refLapF1 × CAT_LAP_MULT[cat], donc patcher ces deux
 * sources suffit ; les patches sont relus dynamiquement à chaque calcul.
 *
 * Patche les objets de données au boot ; ne touche un refLapF1 que s'il est
 * absent (0/null), pour ne jamais écraser un vrai temps.
 * Réversible : window._rjRealismTuningUninstall().
 * =================================================================== */
(function () {
  "use strict";

  var MULT_FIXES = {
    // Écarts de performance réels par rapport à la F1 sur un même tracé.
    // Les catégories juniors étaient trop rapides : une F4 tourne ~35-45 %
    // plus lentement qu'une F1, pas 20 %.
    "Formule 4": 1.35,          // était 1.205 — F4 Monza ~1:55 vs F1 ~1:21
    "Formula Regional": 1.22,   // était 1.154
    "Formule 3": 1.17,          // était 1.115
    "Formule 2": 1.10,          // était 1.064
    "Super Formula": 1.06,      // était 1.026
    "Endurance WEC": 1.13,      // Hypercar ~+13 % vs F1 (était 1.20, avant 1.308)
    "IndyCar": 1.10             // inchangé — cohérent sur circuit routier
  }

  // refLapF1 = temps F1 équivalent (s) ; ×CAT_LAP_MULT donne le temps de la catégorie
  var REFLAP_FIXES = {
    "24h Le Mans": 171,      // WEC ×1.20 -> ~3:25
    "GP Valencia": 98,       // ~1:38
    "GP Portimao": 78,       // ~1:18
    // GP français fictifs (temps F1 équivalents variés)
    "GP Lorraine": 84, "GP Alsace": 79, "GP Normandie": 88, "GP Bretagne": 82,
    "GP Bourgogne": 91, "GP Auvergne": 76, "GP Picardie": 80, "GP Provence": 86,
    "GP Languedoc": 83, "GP Cote Azur": 74, "GP Lyon": 89,
    // circuits karting dédiés : refLapF1 du tracé d'origine (cohérent multi-catégories)
    "GP Monaco Kart": 72, "GP Spa Kart": 105, "GP Monza Kart": 80,
    "GP Zandvoort Kart": 70, "GP Abu Dhabi Kart": 83, "GP Bahrain Kart": 91,
    "GP Silverstone Kart": 87
  };

  var _origMult = {};
  var _patchedCircuits = [];

  function getCircuits() {
    if (typeof CIRCUITS !== "undefined" && CIRCUITS) return CIRCUITS;
    if (typeof CIRCUIT_DATA !== "undefined" && CIRCUIT_DATA) return CIRCUIT_DATA;
    return null;
  }


  /* ------------------------------------------------------------------
   * DISTANCES DE COURSE (nombre de tours de base, avant modulateur circuit)
   * Les catégories juniors couraient beaucoup trop longtemps : une course
   * de F4 dure 25-30 min en réalité, pas 50. À l'inverse le WEC, dont les
   * manches font 6 h minimum, se terminait en 48 minutes simulées.
   * Rappel : un tour ≈ 1 s de temps de jeu réel, allonger une course
   * n'allonge donc pas sensiblement la partie.
   * ---------------------------------------------------------------- */
  var LAPS_FIXES = {
    "Formule 4": 15,          // était 30 → ~27 min (réel : 25-30 min)
    "Formula Regional": 19,   // était 30 → ~35 min
    "Formule 3": 23,          // était 35 → ~40 min (course principale)
    "Formule 2": 33,          // était 40 → ~55 min
    "Super Formula": 32,      // était 53 → ~48 min
    "IndyCar": 85,            // était 70 → ~95 min sur circuit routier
    "Endurance WEC": 60       // était 25 → ~2 h 30 sur les manches 6 h.
                              // Volontairement en deçà des 6 h réelles : le système
                              // d'arrêts plafonne à 3 arrêts planifiés et n'est pas
                              // dimensionné pour de vrais relais d'endurance.
  };

  /* ------------------------------------------------------------------
   * ARRÊTS AU STAND — la F4, la Formula Regional et la F3 n'en font
   * AUCUN en compétition réelle. Le jeu imposait un arrêt en F4 et FR.
   * On garde l'usure des pneus (degradeTyres) : elle existe bien, c'est
   * seulement le changement en course qui n'a pas lieu.
   * Le WEC passe à 10-16 arrêts, cohérent avec une manche de 6 h.
   * ---------------------------------------------------------------- */
  var PIT_FIXES = {
    "Formule 4":        { minStops: 0, maxStops: 0 },
    "Formula Regional": { minStops: 0, maxStops: 0 },
    "Formule 3":        { minStops: 0, maxStops: 0 },
    "Endurance WEC":    { minStops: 3, maxStops: 6 }   // aligné sur ce que l'UI sait planifier
  };

  var _origLaps = {}, _origPit = {};

  function applyLapsAndPits() {
    var n = 0;
    if (typeof CAT_LAPS !== "undefined" && CAT_LAPS) {
      for (var cat in LAPS_FIXES) {
        if (!LAPS_FIXES.hasOwnProperty(cat)) continue;
        if (typeof CAT_LAPS[cat] === "number") {
          if (!(cat in _origLaps)) _origLaps[cat] = CAT_LAPS[cat];
          CAT_LAPS[cat] = LAPS_FIXES[cat];
          n++;
        }
      }
    }
    if (typeof PIT_CONFIG !== "undefined" && PIT_CONFIG) {
      for (var c2 in PIT_FIXES) {
        if (!PIT_FIXES.hasOwnProperty(c2)) continue;
        var cfg = PIT_CONFIG[c2];
        if (!cfg) continue;
        if (!(c2 in _origPit)) _origPit[c2] = { minStops: cfg.minStops, maxStops: cfg.maxStops };
        cfg.minStops = PIT_FIXES[c2].minStops;
        cfg.maxStops = PIT_FIXES[c2].maxStops;
        n++;
      }
    }
    return n;
  }


  /* G.totalLaps est figé à la création de carrière (ou au changement de
   * catégorie) : une partie déjà commencée garderait l'ancienne distance.
   * On le resynchronise à l'entrée de chaque week-end, jamais en course. */
  function installLapsRefresh() {
    if (typeof window.initRaceState !== "function") return false;
    if (window.initRaceState._rj43) return true;
    var orig = window.initRaceState;
    var fn = function () {
      var r = orig.apply(this, arguments);
      try {
        var enCourse = (typeof LIVE_RACE !== "undefined" && LIVE_RACE &&
                        LIVE_RACE.total > 0 && !LIVE_RACE.finished && (LIVE_RACE.cur || 0) > 0);
        if (!enCourse && typeof getCatLaps === "function" && typeof G !== "undefined" && G) {
          var n = getCatLaps(G.cat);
          if (typeof n === "number" && n > 0 && G.totalLaps !== n) G.totalLaps = n;
        }
      } catch (e) {}
      return r;
    };
    fn._rj43 = true;
    window.initRaceState = fn;
    return true;
  }

  function apply(retries) {
    var multOk = (typeof CAT_LAP_MULT !== "undefined" && CAT_LAP_MULT);
    var circuits = getCircuits();
    if ((!multOk || !circuits) && (retries = (retries == null ? 25 : retries)) > 0) {
      if (typeof setTimeout === "function") setTimeout(function () { apply(retries - 1); }, 150);
      return;
    }
    if (window._rjRealismTuned) return;
    window._rjRealismTuned = true;

    // 1. multiplicateurs de catégorie
    if (multOk) {
      for (var cat in MULT_FIXES) {
        if (typeof CAT_LAP_MULT[cat] === "number") {
          if (!(cat in _origMult)) _origMult[cat] = CAT_LAP_MULT[cat];
          CAT_LAP_MULT[cat] = MULT_FIXES[cat];
        }
      }
    }

    // 2. refLapF1 manquants uniquement
    if (circuits) {
      for (var k in circuits) {
        var c = circuits[k];
        if (!c) continue;
        var nm = c.name || k;
        if (Object.prototype.hasOwnProperty.call(REFLAP_FIXES, nm) && !c.refLapF1) {
          _patchedCircuits.push({ obj: c, prev: c.refLapF1 });
          c.refLapF1 = REFLAP_FIXES[nm];
        }
      }
    }

    // 3. distances de course + arrêts au stand par catégorie
    var nLapPit = applyLapsAndPits();
    installLapsRefresh();

    window._rjRealismTuningUninstall = function () {
      for (var lc in _origLaps) {
        if (typeof CAT_LAPS !== "undefined" && CAT_LAPS) CAT_LAPS[lc] = _origLaps[lc];
      }
      for (var pc in _origPit) {
        if (typeof PIT_CONFIG !== "undefined" && PIT_CONFIG && PIT_CONFIG[pc]) {
          PIT_CONFIG[pc].minStops = _origPit[pc].minStops;
          PIT_CONFIG[pc].maxStops = _origPit[pc].maxStops;
        }
      }
      for (var cat in _origMult) {
        if (typeof CAT_LAP_MULT !== "undefined" && CAT_LAP_MULT) CAT_LAP_MULT[cat] = _origMult[cat];
      }
      _patchedCircuits.forEach(function (e) { e.obj.refLapF1 = e.prev; });
      window._rjRealismTuned = false;
      console.log("[43-realism-tuning] désinstallé");
    };

    console.log("[43-realism-tuning] actif — " + Object.keys(MULT_FIXES).length +
      " multiplicateurs, " + nLapPit + " réglages distances/arrêts, " +
      _patchedCircuits.length + " circuits renseignés");
  }

  if (document.readyState === "loading" && typeof document.addEventListener === "function") {
    document.addEventListener("DOMContentLoaded", function () { apply(); });
  } else {
    apply();
  }
})();
