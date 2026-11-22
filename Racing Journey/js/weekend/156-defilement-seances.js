/* =====================================================================
 * 156-defilement-seances.js — PAS DE REMONTÉE AUTOMATIQUE EN SÉANCE
 *
 * POURQUOI
 * Pendant les essais libres et les qualifications, l'écran se redessine à
 * chaque relais, chaque tour et chaque chrono. Plusieurs de ces redessins
 * (contenu remplacé, retour d'onglet, message qui « se montre ») ramenaient
 * l'écran tout en haut : on perdait la feuille de temps ou les réglages
 * qu'on était en train de regarder.
 *
 * CE QUE FAIT LE MODULE
 * Dans l'écran de course, onglets Essais et Qualif : la position choisie par
 * le joueur (doigt, molette, clavier) est retenue ; tout saut de défilement
 * qu'il n'a pas provoqué est annulé aussitôt. Un changement d'onglet ou
 * d'écran repart normalement du haut.
 *
 * Réversible : window._rj156Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[156-defilement]";
  var geste = 0;                 // dernier geste du joueur (ms)
  var retenu = new WeakMap();    // élément qui défile → position voulue par le joueur
  var onglet = null;

  function ongletActif() {
    var t = document.querySelector("#S-race .tab.on");
    return t ? t.getAttribute("data-tab") : null;
  }
  function enSeance() {
    var e = document.getElementById("S-race");
    if (!e || !e.classList.contains("on")) return false;
    var o = ongletActif();
    return o === "essais" || o === "qualif";
  }

  function auGeste() { geste = Date.now(); }

  function auDefilement(ev) {
    var el = ev.target === document ? document.scrollingElement : ev.target;
    if (!el || !el.closest || !el.closest("#S-race")) return;
    var o = ongletActif();
    if (o !== onglet) { onglet = o; retenu = new WeakMap(); }   // nouvel onglet : on repart du haut
    if (!enSeance()) return;
    if (Date.now() - geste < 900) { retenu.set(el, el.scrollTop); return; }
    var voulu = retenu.get(el);
    // saut que le joueur n'a pas fait : on remet sa position
    if (typeof voulu === "number" && Math.abs(el.scrollTop - voulu) > 4) el.scrollTop = voulu;
  }

  function boot() {
    var s = document.getElementById("S-race");
    if (!s) return setTimeout(boot, 200);
    ["touchstart", "touchmove", "wheel", "pointerdown", "keydown"].forEach(function (t) { addEventListener(t, auGeste, { passive: true, capture: true }); });
    document.addEventListener("scroll", auDefilement, { passive: true, capture: true });
    /* Un redessin qui raccourcit le contenu remet la position à zéro sans événement
       « scroll » sur l'ancien contenu : on la reprend après chaque redessin. */
    var obs = new MutationObserver(function () {
      if (!enSeance() || Date.now() - geste < 900) return;
      document.querySelectorAll("#S-race, #S-race .scroll").forEach(function (el) {
        var voulu = retenu.get(el);
        if (typeof voulu === "number" && Math.abs(el.scrollTop - voulu) > 4) el.scrollTop = voulu;
      });
    });
    obs.observe(s, { childList: true, subtree: true });
    window._rj156Uninstall = function () {
      obs.disconnect();
      document.removeEventListener("scroll", auDefilement, true);
      ["touchstart", "touchmove", "wheel", "pointerdown", "keydown"].forEach(function (t) { removeEventListener(t, auGeste, true); });
    };
    console.log(TAG, "actif — l'écran reste où le joueur l'a mis pendant les séances");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
