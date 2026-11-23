/* =====================================================================
 * 142-defilement.js — L'ÉCRAN RESTE OÙ IL EST APRÈS UN APPUI
 *
 * POURQUOI
 * Sur iPhone, appuyer sur certains boutons (« Lancer · 1 PA » à
 * l'entraînement, des boutons en course…) faisait remonter l'écran tout en
 * haut : le bouton redessine une partie de l'écran, et Safari remet alors
 * la zone de défilement à zéro (non reproduit sur Chrome).
 *
 * CE QUE FAIT LE MODULE
 * Au moment d'un appui, il retient la position de défilement de l'écran
 * affiché. Juste après (au rendu suivant, puis 120 et 400 ms plus tard),
 * si l'on est toujours sur le même écran et le même onglet et que la zone
 * est revenue en haut alors qu'elle ne l'était pas, il remet la position.
 * Une navigation (changement d'écran ou d'onglet) n'est jamais retenue.
 *
 * Aucun état. Réversible : window._rj142Uninstall().
 * =================================================================== */
/* v301 : le menu de l'en-tête finit au même endroit que le contenu. Le bord droit
   du contenu dépend de l'écran (pleine largeur, colonne centrée) : on le mesure. */
(function () {
  "use strict";
  function aligner() {
    var s = document.querySelector(".scr.on"), t = s && s.querySelector(":scope > .tabs"), sc = s && s.querySelector(":scope > .scroll");
    if (!t || !sc) return;
    // offset* : juste aussi quand le jeu est pivoté (portrait)
    var bord = 0;
    sc.querySelectorAll(".t-sec, .sec-lbl, .apex-sec, div, section, button").forEach(function (e) {
      if (!e.offsetParent || e.offsetWidth < 200 || e.offsetWidth >= sc.clientWidth) return;
      var cs = getComputedStyle(e);
      if (!(parseFloat(cs.borderRightWidth) > 0) && !/\b(t-sec|sec-lbl|apex-sec)\b/.test(e.className)) return;
      var x = e.offsetWidth; for (var n = e; n && n !== sc && sc.contains(n); n = n.offsetParent) x += n.offsetLeft;
      if (!sc.contains(n)) x -= sc.offsetLeft;
      if (x <= sc.clientWidth) bord = Math.max(bord, x);
    });
    s.style.setProperty("--menu-d", (bord > sc.offsetWidth * .8 ? Math.max(8, sc.offsetWidth - bord) : 14) + "px");
  }
  function boot() {
    if (!Array.isArray(window.RJ_SCREEN_HOOKS)) return setTimeout(boot, 100);
    var m = 0, tard = function () { clearTimeout(m); m = setTimeout(aligner, 120); };
    window.RJ_SCREEN_HOOKS.push({ id: "142-menu", ecran: "*", apres: tard });
    document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest(".scr > .tabs")) tard(); });
    addEventListener("resize", tard);
  }
  boot();
})();

(function () {
  "use strict";

  // (la messagerie place elle-même sa vue à l'ouverture et au retour d'une conversation)
  var NAV = /\b(navTo|navMore|go|goBack|ptab|rtab|chtab|mtab|lstab|ctab|stab|switchTab|openScreen|openMailThread|backToMailList)\s*\(/;

  function onglet(ecran) {
    var t = ecran && ecran.querySelector(".tab.on, .tabs .on, [data-tab].on");
    return t ? (t.getAttribute("data-tab") || t.textContent) : "";
  }

  function surAppui(e) {
    var ecran = document.querySelector(".scr.on"); if (!ecran) return;
    var cible = e.target && e.target.closest ? e.target.closest("button, [onclick], a, [role=button]") : null;
    if (!cible) return;
    /* Les boutons de navigation et les onglets changent volontairement de page. */
    if (cible.closest(".tabs, .tab, nav, .bnav, #main-nav") || NAV.test(cible.getAttribute("onclick") || "")) return;
    var zones = [].slice.call(ecran.querySelectorAll(".scroll")).filter(function (z) { return z.scrollTop > 40; });
    if (!zones.length) return;
    var avant = zones.map(function (z) { return z.scrollTop; }), id = ecran.id, tab = onglet(ecran);
    function remettre() {
      var maintenant = document.querySelector(".scr.on");
      if (!maintenant || maintenant.id !== id || onglet(maintenant) !== tab) return;   // on a navigué
      zones.forEach(function (z, i) {
        if (z.isConnected && z.scrollTop < 8 && z.scrollHeight > z.clientHeight + avant[i] * 0.5) z.scrollTop = avant[i];
      });
    }
    requestAnimationFrame(remettre);
    setTimeout(remettre, 120);
    setTimeout(remettre, 400);
  }

  document.addEventListener("click", surAppui, true);
  window._rj142Uninstall = function () { document.removeEventListener("click", surAppui, true); };
})();
