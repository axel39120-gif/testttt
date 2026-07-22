/* =====================================================================
 * 72-menu-accueil.js — BANDEAU DE SAISON MASQUE
 *
 * Ce module ne touche PLUS au menu principal. Il a successivement essaye
 * une liste sans icones, une grille a pastilles de couleur, puis une
 * grille a icones reduites : aucune de ces variantes n'est conservee. La
 * grille de l'accueil retrouve ses tuiles et ses pictogrammes d'origine,
 * a leur taille d'origine, styles.css reprenant seul la main.
 *
 * Reste uniquement le retrait du bandeau « Saison 1 · Karting Junior ·
 * P1 · 0 pts · Debut », dont l'information figure deja dans l'en-tete de
 * l'accueil et dans l'ecran Championnat. Il est masque plutot que
 * supprime : _renderSeasonBanner() continue d'ecrire dans
 * #rj-season-banner sans lever d'erreur, ce qu'une suppression du noeud
 * provoquerait — c'est exactement le defaut qui avait bloque le bouton
 * « Continuer » de la periode des transferts.
 *
 * Reversible : window._rj72Uninstall().
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
      /* --- MENU PRINCIPAL : RETOUR À L'ÉTAT D'ORIGINE ---------------
         Ce module a successivement transformé la grille en liste sans
         icônes, puis en grille à pastilles de couleur, puis en grille à
         icônes réduites de 32 px. Aucune de ces variantes n'est conservée :
         la grille retrouve ses tuiles et ses pictogrammes d'origine, à
         leur taille d'origine, sans fond alterné. Plus aucune règle ne
         cible .apex-actions-grid ni .apex-action-icon — styles.css reprend
         donc seul la main, exactement comme avant toute intervention.
         ------------------------------------------------------------- */

      /* Seul réglage conservé : le bandeau « Saison 1 · Karting Junior ·
         P1 · 0 pts · Début » reste masqué, l'information figurant déjà
         dans l'en-tête de l'accueil et dans l'écran Championnat.
         Il est masqué et non supprimé : _renderSeasonBanner() continue
         d'écrire dans #rj-season-banner sans lever d'erreur. */
      "#rj-season-banner{display:none !important}"
    ].join("");
    document.head.appendChild(st);
  }

  function boot() {
    if (!document.head) { setTimeout(boot, 60); return; }
    css();
    console.log(TAG + " actif — menu principal d'origine, bandeau de saison masqué");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj72Uninstall = function () {
    var st = document.getElementById(ID);
    if (st && st.parentNode) st.parentNode.removeChild(st);
    console.log(TAG + " désinstallé — bandeau de saison restauré");
  };
})();
