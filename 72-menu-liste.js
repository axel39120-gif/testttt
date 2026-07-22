/* =====================================================================
 * 72-menu-accueil.js — MENU PRINCIPAL ET BANDEAU DE SAISON
 *
 * 1. LES ICÔNES DESSINÉES DISPARAISSENT, la grille reste. Neuf entrées en
 *    trois groupes de trois se saisissent d'un seul regard et créent une
 *    mémoire spatiale — au bout de quelques parties, on ne lit plus
 *    « Sponsors », on va au milieu à droite. Une liste de neuf lignes
 *    détruit ce repère et occupe environ 420 px contre 250 pour la
 *    grille, sur un canevas qui doit déjà loger l'en-tête et la carte de
 *    course. Les pictogrammes, eux, étaient génériques : ils occupaient
 *    de la place pendant que l'œil allait lire le texte de toute façon.
 *    Ils sont remplacés par une pastille de couleur unie, qui conserve le
 *    repère chromatique sans le bruit visuel du dessin.
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

      /* Le dessin s'en va, le cadre coloré reste : c'est lui qui porte le
         repère visuel, en pastille unie plus discrète que le pictogramme. */
      "#S-home > .scroll > .apex-actions-grid .apex-action-icon svg{display:none !important}",
      "#S-home > .scroll > .apex-actions-grid .apex-action-icon{width:10px !important;",
      "height:10px !important;border-radius:50% !important;margin-bottom:9px !important;",
      "background:var(--accent,var(--red)) !important;border:0 !important;",
      "box-shadow:0 0 10px var(--accent-bg,rgba(255,24,1,.4)) !important}",

      /* le libellé reprend la place libérée */
      "#S-home > .scroll > .apex-actions-grid .apex-action-title{font-size:12.5px !important;",
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
    console.log(TAG + " actif — grille sans pictogrammes, pastilles de couleur, bandeau de saison masqué");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj72Uninstall = function () {
    var st = document.getElementById(ID);
    if (st && st.parentNode) st.parentNode.removeChild(st);
    console.log(TAG + " désinstallé — icônes et bandeau de saison restaurés");
  };
})();
