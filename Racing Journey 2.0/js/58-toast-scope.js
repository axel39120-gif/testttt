/* =====================================================================
 * 58-toast-scope.js — LES NOTIFICATIONS RESTENT SUR L'ACCUEIL
 *
 * PROBLÈME : les notifications (« Nouveau message », transferts, gains…)
 * apparaissaient n'importe où — en pleine course, dans les réglages, sur
 * l'écran de résultat. Elles sont pourtant conçues pour l'accueil.
 *
 * CAUSE : pushHomeToast() crée un toast en position fixe et ne consulte
 * jamais l'écran actif, malgré son nom. Sept modules l'appellent.
 *
 * CORRECTIF : on filtre à la source. Si le joueur est sur l'accueil, la
 * notification s'affiche normalement. Sinon elle est MISE EN FILE plutôt
 * que jetée, puis affichée à son retour sur l'accueil — on ne rate donc
 * aucun message, ils arrivent juste au bon endroit.
 *
 * La file est plafonnée (6 entrées, doublons fusionnés) pour éviter une
 * avalanche après un long week-end de course.
 *
 * Réversible : window._rj58Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var HOME = "S-home";       // écran d'accueil de carrière
  var MAX_QUEUE = 6;
  var queue = [];
  var origPush = null;
  var wrapped = {};

  function currentScreen() {
    try {
      var el = document.querySelector(".scr.on");
      return el ? el.id : null;
    } catch (e) { return null; }
  }

  function onHome() { return currentScreen() === HOME; }

  function enqueue(args) {
    var key = String(args[0] || "") + "|" + String(args[1] || "");
    for (var i = 0; i < queue.length; i++) {
      if (queue[i].key === key) return;   // doublon : on ne l'ajoute pas deux fois
    }
    queue.push({ key: key, args: args });
    if (queue.length > MAX_QUEUE) queue.shift();
  }

  function flush() {
    if (!origPush || !queue.length || !onHome()) return;
    var pending = queue.slice();
    queue.length = 0;
    // léger décalage pour laisser l'accueil se dessiner, puis on espace les toasts
    pending.forEach(function (item, i) {
      setTimeout(function () {
        try { origPush.apply(null, item.args); } catch (e) {}
      }, 400 + i * 220);
    });
  }

  function installPush() {
    if (typeof window.pushHomeToast !== "function") return false;
    if (window.pushHomeToast._rj58) return true;
    origPush = window.pushHomeToast;
    var fn = function () {
      var args = Array.prototype.slice.call(arguments);
      if (onHome()) {
        try { return origPush.apply(this, args); } catch (e) { return; }
      }
      enqueue(args);   // ailleurs : on garde pour plus tard
    };
    fn._rj58 = true;
    window.pushHomeToast = fn;
    return true;
  }

  // Vider la file dès que le joueur revient sur l'accueil.
  function wrapNav(name) {
    if (typeof window[name] !== "function" || window[name]._rj58) return false;
    var orig = window[name];
    var fn = function () {
      var r = orig.apply(this, arguments);
      try { if (onHome()) flush(); } catch (e) {}
      return r;
    };
    fn._rj58 = true;
    wrapped[name] = orig;
    window[name] = fn;
    return true;
  }

  var tries = 0;
  function boot() {
    var a = installPush();
    var b = wrapNav("go");
    var c = wrapNav("navTo");
    wrapNav("refreshScreen");
    if (a && b && c) {
      if (onHome()) flush();
      console.log("[58-toast-scope] actif — notifications limitées à l'accueil (file d'attente ailleurs)");
      return;
    }
    if (tries++ < 80) setTimeout(boot, 80);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj58Uninstall = function () {
    if (origPush) { window.pushHomeToast = origPush; origPush = null; }
    Object.keys(wrapped).forEach(function (k) { window[k] = wrapped[k]; });
    queue.length = 0;
    console.log("[58-toast-scope] désinstallé");
  };
  window._rj58Queue = function () { return queue.slice(); };
})();
