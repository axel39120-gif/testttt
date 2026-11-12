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
(function () {
  "use strict";

  var NAV = /\b(navTo|navMore|go|goBack|ptab|rtab|chtab|mtab|lstab|ctab|stab|switchTab|openScreen)\s*\(/;

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
