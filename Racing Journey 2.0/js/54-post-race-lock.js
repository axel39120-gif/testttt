/* =====================================================================
 * 54-post-race-lock.js — VERROUILLAGE DES ONGLETS APRÈS LA COURSE
 *
 * PROBLÈME : une fois la course terminée, les onglets « Qualif », « Stratégie »,
 * « Course »… restent cliquables. On peut donc revenir en arrière sur un
 * week-end déjà joué, et surtout l'onglet Stratégie permet de RELANCER une
 * simulation de course déjà disputée.
 *
 * CAUSE : updateRaceTabsVisibility() calcule les verrous à partir de
 * qualifDone / strategyDone uniquement. Aucune de ces conditions ne
 * redevient fausse une fois la course finie, donc rien n'est reverrouillé
 * quand RACE_WEEKEND_STATE.courseDone passe à true.
 *
 * CORRECTIF (2 niveaux, ceinture + bretelles) :
 *   1. après chaque updateRaceTabsVisibility(), si courseDone est vrai, on
 *      désactive visuellement tous les onglets sauf « Résultat » ;
 *   2. on filtre rtab() pour refuser toute bascule vers un autre onglet que
 *      « Résultat » tant que le week-end est terminé — ainsi même un appel
 *      programmatique (ou un onclick résiduel) ne peut pas relancer la course.
 *
 * Le verrou disparaît de lui-même au week-end suivant (resetRaceWeekend
 * remet courseDone à false).
 *
 * Réversible : window._rj54Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var LOCKABLE = ["prep", "essais", "qualif", "strat", "sprint", "course"];
  var origUpdate = null, origRtab = null;

  function raceIsOver() {
    try {
      return !!(typeof RACE_WEEKEND_STATE !== "undefined" &&
                RACE_WEEKEND_STATE && RACE_WEEKEND_STATE.courseDone);
    } catch (e) { return false; }
  }

  function tabEl(name) {
    return document.getElementById("race-tab-" + name) ||
           document.querySelector('#S-race .tab[data-tab="' + name + '"]');
  }

  function lockTabs() {
    if (!raceIsOver()) return;
    for (var i = 0; i < LOCKABLE.length; i++) {
      var el = tabEl(LOCKABLE[i]);
      if (!el) continue;
      el.style.opacity = "0.3";
      el.style.color = "var(--text3)";
      el.style.pointerEvents = "none";
      el.style.cursor = "not-allowed";
      el.setAttribute("disabled", "disabled");
      el.setAttribute("aria-disabled", "true");
    }
    // l'onglet Résultat doit rester accessible
    var res = tabEl("res");
    if (res) {
      res.style.opacity = "";
      res.style.color = "";
      res.style.pointerEvents = "";
      res.style.cursor = "";
      res.removeAttribute("disabled");
      res.removeAttribute("aria-disabled");
    }
  }

  function install() {
    if (typeof window.updateRaceTabsVisibility === "function" && !origUpdate) {
      origUpdate = window.updateRaceTabsVisibility;
      window.updateRaceTabsVisibility = function () {
        var r = origUpdate.apply(this, arguments);
        try { lockTabs(); } catch (e) {}
        return r;
      };
    }
    if (typeof window.rtab === "function" && !origRtab) {
      origRtab = window.rtab;
      window.rtab = function (tab, force) {
        // Week-end terminé : seul l'onglet Résultat reste navigable.
        if (raceIsOver() && tab && tab !== "res") {
          return;
        }
        return origRtab.apply(this, arguments);
      };
    }
    return !!(origUpdate && origRtab);
  }

  var tries = 0;
  function boot() {
    var ok = install();
    try { lockTabs(); } catch (e) {}
    if (ok) {
      console.log("[54-post-race-lock] actif — onglets verrouillés après la course");
      return;
    }
    if (tries++ < 80) setTimeout(boot, 80);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj54Uninstall = function () {
    if (origUpdate) { window.updateRaceTabsVisibility = origUpdate; origUpdate = null; }
    if (origRtab) { window.rtab = origRtab; origRtab = null; }
    console.log("[54-post-race-lock] désinstallé");
  };
})();
