/* =====================================================================
 * 42-weekend-entry-fixes.js — DEUX CORRECTIONS À L'ENTRÉE DU WEEK-END
 *
 * BUG 1 — Essais libres "terminés" dès l'entrée :
 *   goToRaceWeekend() met à jour le circuit et appelle resetRaceWeekend()
 *   (qui ne réinitialise que RACE_WEEKEND_STATE), mais NE réinitialise
 *   jamais RACE_STATE.practice. Le sessionsCompleted du week-end précédent
 *   persiste ; combiné à maxSessions=1 (Karting via module 18), l'écran
 *   essais lit sessionsCompleted >= max et affiche "terminés".
 *   → On wrappe goToRaceWeekend pour ré-initialiser l'état des essais
 *     quand on entre dans un NOUVEAU week-end (clé circuit#courses#saison).
 *     La progression du week-end courant est préservée (re-entrée = même clé).
 *
 * BUG 2 — Notif "Nouveau message" hors accueil :
 *   pushMail déclenche pushHomeToast("Nouveau message", …). Ce toast
 *   s'affiche sur tout écran non listé dans SILENT_SCREENS, donc pendant
 *   le week-end. Les notifications de message ne doivent apparaître qu'à
 *   l'accueil.
 *   → On wrappe pushHomeToast pour masquer UNIQUEMENT le toast de message
 *     quand l'écran actif n'est pas S-home. Le mail est posté normalement
 *     (badge), seul le toast est différé jusqu'au retour à l'accueil.
 *
 * Réversible : window._rjWeekendEntryFixUninstall().
 * =================================================================== */
(function () {
  "use strict";

  function curScreenId() {
    try { var el = document.querySelector(".scr.on"); return el ? el.id : null; }
    catch (e) { return null; }
  }

  function weekendKey() {
    var G = window.G || {};
    var circuit = "";
    try {
      var nr = (typeof getNextRace === "function") ? getNextRace() : null;
      circuit = nr ? (nr.name || nr.circuit || "") : "";
    } catch (e) {}
    if (!circuit) {
      var rs = window.RACE_STATE;
      circuit = (rs && rs.circuit) || "";
    }
    var races = (G.races && typeof G.races.length === "number") ? G.races.length : 0;
    var saison = G.saison || 0;
    return circuit + "#" + races + "#" + saison;
  }

  // --- BUG 1 : réinitialiser les essais à l'entrée d'un nouveau week-end ---
  function ensureFreshPractice() {
    try {
      if (typeof hasPracticeSystem !== "function" || !hasPracticeSystem()) return;
      var rs = window.RACE_STATE;
      if (!rs) return;
      var key = weekendKey();
      var pr = rs.practice;
      if (!pr || pr._wkndEntry !== key) {
        if (typeof initPracticeState === "function") {
          initPracticeState();
          if (rs.practice) rs.practice._wkndEntry = key;
        }
      }
    } catch (e) { /* no-op */ }
  }

  function installPracticeFix() {
    if (typeof window.goToRaceWeekend !== "function") return false;
    if (window.goToRaceWeekend._rjWkndFix) return true;
    var orig = window.goToRaceWeekend;
    window.goToRaceWeekend = function () {
      var r = orig.apply(this, arguments);
      ensureFreshPractice();
      return r;
    };
    window.goToRaceWeekend._rjWkndFix = true;
    window.goToRaceWeekend._rjOrig = orig;
    return true;
  }

  // --- BUG 2 : notif "Nouveau message" seulement à l'accueil ---
  function installToastFix() {
    if (typeof window.pushHomeToast !== "function") return false;
    if (window.pushHomeToast._rjMsgGate) return true;
    var orig = window.pushHomeToast;
    window.pushHomeToast = function (label, text, color) {
      try {
        if (label === "Nouveau message") {
          var scr = curScreenId();
          if (scr && scr !== "S-home") return; // différé jusqu'au retour à l'accueil
        }
      } catch (e) { /* no-op */ }
      return orig.apply(this, arguments);
    };
    window.pushHomeToast._rjMsgGate = true;
    window.pushHomeToast._rjOrig = orig;
    return true;
  }

  function boot(retries) {
    if (typeof window === "undefined") return;
    var ok1 = installPracticeFix();
    var ok2 = installToastFix();
    if ((!ok1 || !ok2) && (retries = (retries == null ? 20 : retries)) > 0) {
      setTimeout(function () { boot(retries - 1); }, 150);
      return;
    }
    window._rjWeekendEntryFixUninstall = function () {
      if (window.goToRaceWeekend && window.goToRaceWeekend._rjOrig) window.goToRaceWeekend = window.goToRaceWeekend._rjOrig;
      if (window.pushHomeToast && window.pushHomeToast._rjOrig) window.pushHomeToast = window.pushHomeToast._rjOrig;
      console.log("[42-weekend-entry-fixes] désinstallé");
    };
    console.log("[42-weekend-entry-fixes] actif (essais reset:" + ok1 + ", notif gate:" + ok2 + ")");
  }

  if (document.readyState === "loading" && typeof document.addEventListener === "function") {
    document.addEventListener("DOMContentLoaded", function () { boot(); });
  } else {
    boot();
  }
})();
