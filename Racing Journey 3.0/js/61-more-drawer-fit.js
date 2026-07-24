/* =====================================================================
 * 61-more-drawer-fit.js — LE TIROIR « PLUS » NE DÉBORDE PLUS
 *
 * PROBLÈME : sur téléphone, le menu déroulant « Plus » est coupé — ses
 * dernières entrées passent sous la barre de navigation du bas.
 *
 * CAUSE (mesurée) : le tiroir est positionné avec un décalage FIXE
 * (bottom:70px) et n'a AUCUNE hauteur maximale. Or la barre du bas
 * n'a pas toujours 70px : sur iPhone, la marge de sécurité (indicateur
 * d'accueil) la fait grandir. Relevé en test : bas du tiroir à y=782
 * alors que la barre commence à y=745 → 37px masqués. Et comme rien ne
 * limite la hauteur, ajouter des entrées aggrave le débordement.
 *
 * CORRECTIF : à chaque ouverture, on mesure la position réelle de la
 * barre de navigation et le conteneur, puis on cale le tiroir JUSTE
 * au-dessus de la barre et on lui donne une hauteur maximale égale à
 * l'espace réellement disponible. S'il y a trop d'entrées pour tenir,
 * il devient défilant au lieu d'être coupé.
 *
 * Le calcul est refait à la rotation et au redimensionnement.
 *
 * Réversible : window._rj61Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var MARGE_BARRE = 10;   // respiration entre le tiroir et la barre du bas
  var MARGE_HAUT = 12;    // respiration en haut de l'écran
  var wrapped = {};
  var timer = null;

  function els() {
    return {
      drawer: document.getElementById("more-drawer"),
      nav: document.getElementById("main-nav"),
      app: document.getElementById("app")
    };
  }

  function place() {
    var e = els();
    if (!e.drawer || !e.app) return;
    // on ne recalcule que si le tiroir est ouvert (sinon getBoundingClientRect ment)
    if (!e.drawer.classList.contains("open")) return;

    var ra = e.app.getBoundingClientRect();
    // La barre du bas est en position:fixed : offsetParent vaut null même
    // quand elle est visible. On teste donc l'affichage réel.
    var basDispo = 8;   // valeur par défaut si aucune barre n'est affichée
    if (e.nav) {
      var cs = window.getComputedStyle(e.nav);
      var rn = e.nav.getBoundingClientRect();
      var visible = cs.display !== "none" && cs.visibility !== "hidden" && rn.height > 0;
      if (visible) basDispo = Math.max(0, ra.bottom - rn.top);
    }

    var bottom = Math.round(basDispo + MARGE_BARRE);
    var dispo = Math.round(ra.height - bottom - MARGE_HAUT);
    if (dispo < 120) dispo = 120;   // garde-fou : toujours utilisable

    e.drawer.style.bottom = bottom + "px";
    e.drawer.style.maxHeight = dispo + "px";
    e.drawer.style.overflowY = "auto";
    e.drawer.style.webkitOverflowScrolling = "touch";
    e.drawer.style.overscrollBehavior = "contain";
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(place, 60);
  }

  function wrap(name) {
    if (typeof window[name] !== "function" || window[name]._rj61) return false;
    var orig = window[name];
    var fn = function () {
      var r = orig.apply(this, arguments);
      try { setTimeout(place, 20); } catch (e) {}
      return r;
    };
    fn._rj61 = true;
    wrapped[name] = orig;
    window[name] = fn;
    return true;
  }

  // filet : si la classe .open est posée ailleurs, on réagit quand même
  var obs = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var t = muts[i].target;
      if (t && t.id === "more-drawer") { schedule(); return; }
    }
  });

  var tries = 0;
  function boot() {
    var e = els();
    if (!e.drawer) { if (tries++ < 100) setTimeout(boot, 100); return; }

    wrap("toggleMore");
    wrap("navMore");
    wrap("closeMore");

    obs.observe(e.drawer, { attributes: true, attributeFilter: ["class", "style"] });
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);

    console.log("[61-more-drawer-fit] actif — tiroir « Plus » calé au-dessus de la barre du bas");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj61Uninstall = function () {
    obs.disconnect();
    Object.keys(wrapped).forEach(function (k) { window[k] = wrapped[k]; });
    window.removeEventListener("resize", schedule);
    window.removeEventListener("orientationchange", schedule);
    var d = document.getElementById("more-drawer");
    if (d) { d.style.bottom = ""; d.style.maxHeight = ""; d.style.overflowY = ""; }
    console.log("[61-more-drawer-fit] désinstallé");
  };
})();
