/* =====================================================================
 * 49-race-speed.js — RALENTIR LA SIMULATION DE COURSE (uniquement)
 *
 * La course live avance d'un tour toutes les 280ms × getSimSpeedMult().
 * Le multiplicateur (02-ui-settings, défaut 1.8) sert AUSSI aux qualifs,
 * donc on ne peut pas le changer globalement sans ralentir les qualifs
 * (qui conviennent déjà). On surcharge getSimSpeedMult pour n'appliquer
 * un facteur supplémentaire QUE pendant une course live active, détectée
 * via l'état LIVE_RACE (total défini, en cours, non terminée). Les qualifs
 * (LIVE_RACE absent ou terminé à ce moment) gardent leur vitesse.
 *
 * Réversible : window._rjRaceSpeedUninstall().
 * =================================================================== */
(function () {
  "use strict";

  var FACTOR = 1.6; // course ~60% plus lente (280×1.8×1.6 ≈ 806ms/tour)

  function inLiveRace() {
    try {
      var L = window.LIVE_RACE;
      return !!(L && L.total > 0 && (L.cur || 0) >= 1 && !L.finished);
    } catch (e) { return false; }
  }

  function install() {
    if (window._rjRaceSpeedInstalled) return;
    if (typeof window.getSimSpeedMult !== "function") {
      if (typeof setTimeout === "function") setTimeout(install, 300);
      return;
    }
    window._rjRaceSpeedInstalled = true;
    var orig = window.getSimSpeedMult;
    window._rjOrigSimSpeedMult = orig;
    window.getSimSpeedMult = function () {
      var base = orig ? orig.apply(this, arguments) : 1;
      return inLiveRace() ? base * FACTOR : base;
    };
    window._rjRaceSpeedUninstall = function () {
      if (window._rjOrigSimSpeedMult) window.getSimSpeedMult = window._rjOrigSimSpeedMult;
      window._rjRaceSpeedInstalled = false;
      console.log("[49-race-speed] désinstallé");
    };
    console.log("[49-race-speed] course ralentie ×" + FACTOR + " (qualifs inchangées)");
  }

  if (document.readyState === "loading" && typeof document.addEventListener === "function") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
})();
