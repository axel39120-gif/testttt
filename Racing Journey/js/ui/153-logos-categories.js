/* =====================================================================
 * 153-logos-categories.js — UN LOGO PAR CATÉGORIE
 *
 * Chaque catégorie a son écusson : un badge incliné, à sa couleur, avec son
 * sigle et des bandes de vitesse (une par échelon : plus on monte, plus il y
 * en a). Dessins originaux, en SVG, nets à toutes les tailles.
 *
 * OÙ ILS APPARAISSENT
 *   - la tour du classement en course (module 111, à la place du sigle) ;
 *   - la carte « Prochaine course » de l'accueil ;
 *   - l'en-tête du championnat.
 *
 * API : window.RJLogoCat.svg(categorie, hauteurPx) → chaîne SVG.
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[153-logos]";
  /* sigle, couleur claire, couleur foncée, échelon (nombre de bandes) */
  var CATS = {
    "Karting Junior":   ["KJ", "#FFB23F", "#E06A00", 1],
    "Karting Senior":   ["KS", "#FF8A3D", "#C2410C", 1],
    "Formule 4":        ["F4", "#4FA3FF", "#1D4ED8", 2],
    "Formula Regional": ["FR", "#2DD4BF", "#0F766E", 2],
    "Formule 3":        ["F3", "#C084FC", "#7E22CE", 3],
    "Formule 2":        ["F2", "#38BDF8", "#075985", 3],
    "Formule 1":        ["F1", "#FF4D3D", "#B91C1C", 4],
    "Super Formula":    ["SF", "#F472B6", "#9D174D", 3],
    "Endurance WEC":    ["WEC", "#22D3EE", "#0E7490", 3],
    "IndyCar":          ["INDY", "#FACC15", "#A16207", 3]
  };

  var compteur = 0;
  function svg(cat, h) {
    var c = CATS[cat] || ["?", "#9CA3AF", "#4B5563", 1], id = "rj153-" + c[0] + "-" + (++compteur);
    h = h || 18;
    var large = c[0].length > 2 ? 30 + (c[0].length - 2) * 9 : 30, w = large + 6 + c[3] * 4;
    var bandes = "";
    for (var i = 0; i < c[3]; i++) bandes += '<path d="M' + (large + 4 + i * 4) + ',2 h2.4 l-3.2,12 h-2.4 Z" fill="' + c[1] + '" opacity="' + (1 - i * 0.18).toFixed(2) + '"/>';
    return '<svg class="rj153-logo" role="img" aria-label="' + cat + '" viewBox="0 0 ' + w + ' 16" height="' + h + '" width="' + Math.round(h * w / 16) + '">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c[1] + '"/><stop offset="1" stop-color="' + c[2] + '"/></linearGradient></defs>' +
      '<path d="M4,0 H' + large + ' L' + (large - 4) + ',16 H0 Z" fill="url(#' + id + ')"/>' +
      '<path d="M4,0 H' + large + ' L' + (large - 0.8) + ',3 H3.2 Z" fill="#fff" opacity=".22"/>' +
      '<text x="' + (large / 2) + '" y="12" text-anchor="middle" font-family="var(--font-display), sans-serif" font-size="' + (c[0].length > 2 ? 9.5 : 11) + '" font-weight="900" font-style="italic" fill="#fff" letter-spacing=".3">' + c[0] + "</text>" +
      bandes + "</svg>";
  }

  /* Pose (ou met à jour) le logo juste avant un élément. */
  function poser(id, cat) {
    var el = document.getElementById(id);
    if (!el || !el.parentNode) return;
    var avant = el.previousElementSibling;
    if (avant && avant.classList.contains("rj153-place")) {
      if (avant.getAttribute("data-cat") === cat) return;
      avant.remove();
    }
    var s = document.createElement("span");
    s.className = "rj153-place";
    s.setAttribute("data-cat", cat);
    s.innerHTML = svg(cat, 16);
    el.parentNode.insertBefore(s, el);
  }

  function maj() {
    if (typeof G === "undefined" || !G || !G.cat) return;
    ["h-race-circuit", "ch-sub"].forEach(function (id) { try { poser(id, G.cat); } catch (e) {} });
  }

  function boot() {
    if (typeof rjInscrire !== "function" || typeof updateUI !== "function" || !Array.isArray(window.RJ_SCREEN_HOOKS)) return setTimeout(boot, 100);
    rjInscrire("updateUI", { id: "153-logos:updateUI", apres: function () { setTimeout(maj, 0); } });
    if (!window.RJ_SCREEN_HOOKS.some(function (h) { return h && h.id === "153-logos"; }))
      window.RJ_SCREEN_HOOKS.push({ id: "153-logos", ecran: "*", apres: function () { setTimeout(maj, 0); } });
    maj();
    console.log(TAG, "actif — un logo par catégorie");
  }

  window.RJLogoCat = { svg: svg, CATS: CATS };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
