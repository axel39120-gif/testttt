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
    "Endurance WEC": 1.20,
    "IndyCar": 1.10
  };

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

    window._rjRealismTuningUninstall = function () {
      for (var cat in _origMult) {
        if (typeof CAT_LAP_MULT !== "undefined" && CAT_LAP_MULT) CAT_LAP_MULT[cat] = _origMult[cat];
      }
      _patchedCircuits.forEach(function (e) { e.obj.refLapF1 = e.prev; });
      window._rjRealismTuned = false;
      console.log("[43-realism-tuning] désinstallé");
    };

    console.log("[43-realism-tuning] actif — WEC 1.20 / IndyCar 1.10, " +
      _patchedCircuits.length + " circuits renseignés");
  }

  if (document.readyState === "loading" && typeof document.addEventListener === "function") {
    document.addEventListener("DOMContentLoaded", function () { apply(); });
  } else {
    apply();
  }
})();
