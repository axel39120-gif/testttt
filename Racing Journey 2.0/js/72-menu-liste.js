/* =====================================================================
 * 72-menu-accueil.js — MENU PRINCIPAL ET BANDEAU DE SAISON
 *
 * 1. LA GRILLE ET SES ICÔNES SONT CONSERVÉES, les pictogrammes simplement
 *    réduits de 44 à 32 px. Neuf entrées en
 *    trois groupes de trois se saisissent d'un seul regard et créent une
 *    mémoire spatiale — au bout de quelques parties, on ne lit plus
 *    « Sponsors », on va au milieu à droite. Une liste de neuf lignes
 *    détruit ce repère et occupe environ 420 px contre 250 pour la
 *    grille, sur un canevas qui doit déjà loger l'en-tête et la carte de
 *    course. Les icônes gardent leur cadre coloré et leur teinte de
 *    section : le repère visuel est préservé, la tuile respire davantage.
 *
 * 2. BANDEAU DE SAISON RETIRÉ — « Saison 1 · Karting Junior · P1 · 0 pts ·
 *    Début ». L'information figure déjà dans l'en-tête de l'accueil et
 *    dans l'écran Championnat. Il est masqué plutôt que désactivé :
 *    _renderSeasonBanner() continue d'écrire dans #rj-season-banner sans
 *    lever d'erreur, contrairement à une suppression du nœud.
 *
 * MÉTHODE — feuille de styles injectée, aucune modification du HTML. Les
 * tuiles gardent leur balisage, leurs identifiants et leurs onclick.
 *
 * Réversible : window._rj72Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[72-menu-accueil]";
  var ID = "rj72-css";

  function css() {
    if (document.getElementById(ID)) return;
    var st = document.createElement("style");
    st.id = ID;
    st.textContent = [
      /* --- 1. La grille est CONSERVÉE : neuf entrées en trois groupes de
         trois se saisissent d'un regard et créent un repère spatial, ce
         qu'une liste de neuf lignes détruit tout en occupant 420 px au
         lieu de 250. Seules les icônes dessinées disparaissent. --- */

      /* Les pictogrammes sont CONSERVÉS, simplement réduits : ils gardent
         leur cadre coloré et leur teinte de section, mais passent de 44 à
         32 px, et le dessin de 22 à 16 px. La tuile respire, le repère
         visuel reste. */
      "#S-home > .scroll > .apex-actions-grid .apex-action-icon{width:32px !important;",
      "height:32px !important;border-radius:10px !important;margin-bottom:7px !important}",
      "#S-home > .scroll > .apex-actions-grid .apex-action-icon svg{width:16px !important;",
      "height:16px !important}",

      /* le libellé reprend la place libérée */
      "#S-home > .scroll > .apex-actions-grid .apex-action-title{font-size:12px !important;",
      "font-weight:600 !important;line-height:1.25 !important;letter-spacing:0 !important}",

      /* fond légèrement alterné, une tuile sur deux, pour aérer la grille */
      "#S-home > .scroll > .apex-actions-grid > .apex-action-tile:nth-child(odd){",
      "background:rgba(255,255,255,.045) !important}",

      /* la pastille de notification garde sa place en haut à droite */
      "#S-home > .scroll > .apex-actions-grid .apex-action-badge{z-index:2}",

      /* --- 2. Bandeau « Saison 1 · Karting Junior / P1 / 0 pts / Début » :
         retiré. L'information est déjà donnée par l'en-tête de l'accueil et
         par l'écran Championnat. On le masque plutôt que d'empêcher son
         rendu : _renderSeasonBanner() continue d'écrire dedans sans erreur. */
      "#rj-season-banner{display:none !important}"
    ].join("");
    document.head.appendChild(st);
  }

  function boot() {
    if (!document.head) { setTimeout(boot, 60); return; }
    css();
    console.log(TAG + " actif — grille compacte, icônes réduites, bandeau de saison masqué");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj72Uninstall = function () {
    var st = document.getElementById(ID);
    if (st && st.parentNode) st.parentNode.removeChild(st);
    console.log(TAG + " désinstallé — icônes et bandeau de saison restaurés");
  };
})();
