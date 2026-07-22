/* =====================================================================
 * 72-menu-liste.js — MENU PRINCIPAL EN LISTE (Carrière / Business / Vie)
 *
 * Le menu de l'accueil était une grille de trois colonnes de tuiles
 * carrées, chacune portant une icône colorée au-dessus de son libellé.
 * Il devient une liste verticale : plus d'icônes, un bouton pleine largeur
 * par entrée, empilés de haut en bas, avec un fond légèrement plus clair
 * une ligne sur deux pour guider la lecture.
 *
 * MÉTHODE — feuille de styles injectée, aucune modification du HTML.
 * Les 20 tuiles gardent leur balisage, leurs identifiants (ico-tile-*,
 * h-pilot-badge…) et leurs gestionnaires onclick. Les modules qui
 * peignent les icônes à l'exécution continuent de travailler dans le
 * vide sans rien casser : leur conteneur est simplement masqué.
 *
 * Le rayage se fait en :nth-child, calculé par section — chaque
 * .apex-actions-grid recommence à zéro, donc l'alternance est correcte
 * dans Carrière, dans Business et dans Vie indépendamment.
 *
 * Les pastilles de notification (.apex-action-badge) sont conservées et
 * repositionnées à droite : les masquer ferait disparaître un signal
 * utile.
 *
 * Réversible : window._rj72Uninstall() retire la feuille et le menu
 * reprend sa forme d'origine, sans rechargement.
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[72-menu-liste]";
  var ID = "rj72-css";

  function css() {
    if (document.getElementById(ID)) return;
    var st = document.createElement("style");
    st.id = ID;
    st.textContent = [
      /* la grille devient une pile */
      "#S-home > .scroll > .apex-actions-grid{display:flex !important;flex-direction:column !important;",
      "gap:0 !important;padding:4px 12px 2px !important;align-items:stretch !important;",
      "grid-template-columns:none !important;flex:0 0 auto !important}",

      /* chaque tuile devient une ligne pleine largeur */
      "#S-home > .scroll > .apex-actions-grid > .apex-action-tile{min-height:0 !important;width:100% !important;",
      "box-sizing:border-box !important;",
      "padding:13px 14px !important;border-radius:0 !important;border:0 !important;",
      "border-bottom:1px solid var(--border) !important;background:transparent !important;",
      "flex-direction:row !important;align-items:center !important;",
      "justify-content:flex-start !important;text-align:left !important;",
      "transition:background .14s ease !important}",

      /* fond alterné, une ligne sur deux */
      "#S-home > .scroll > .apex-actions-grid > .apex-action-tile:nth-child(odd){",
      "background:rgba(255,255,255,.035) !important}",

      /* première et dernière : coins arrondis pour délimiter le bloc */
      "#S-home > .scroll > .apex-actions-grid > .apex-action-tile:first-child{",
      "border-top-left-radius:11px !important;border-top-right-radius:11px !important}",
      "#S-home > .scroll > .apex-actions-grid > .apex-action-tile:last-child{",
      "border-bottom-left-radius:11px !important;border-bottom-right-radius:11px !important;",
      "border-bottom:0 !important}",

      "#S-home > .scroll > .apex-actions-grid > .apex-action-tile:active{",
      "background:rgba(255,255,255,.075) !important;transform:none !important}",

      /* plus d'icônes */
      "#S-home > .scroll > .apex-actions-grid .apex-action-icon{display:none !important}",

      /* le libellé porte seul la ligne */
      "#S-home > .scroll > .apex-actions-grid .apex-action-title{margin:0 !important;text-align:left !important;",
      "font-size:14px !important;font-weight:600 !important;line-height:1.3 !important;",
      "color:var(--text) !important;flex:1 !important;white-space:normal !important}",

      /* chevron discret, purement décoratif */
      "#S-home > .scroll > .apex-actions-grid > .apex-action-tile::after{content:'\\203A';margin-left:10px;",
      "color:var(--text3);font-size:17px;line-height:1;flex-shrink:0;opacity:.65}",

      /* pastille de notification ramenée à droite, avant le chevron */
      "#S-home > .scroll > .apex-actions-grid .apex-action-badge{position:static !important;margin-left:8px !important;",
      "flex-shrink:0 !important}"
    ].join("");
    document.head.appendChild(st);
  }

  function boot() {
    if (!document.head) { setTimeout(boot, 60); return; }
    css();
    console.log(TAG + " actif — menu en liste, sans icônes, fond alterné");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj72Uninstall = function () {
    var st = document.getElementById(ID);
    if (st && st.parentNode) st.parentNode.removeChild(st);
    console.log(TAG + " désinstallé — menu d'origine restauré");
  };
})();
