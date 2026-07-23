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
      "#rj-season-banner{display:none !important}",

      /* --- FUSION DE LA VIE AU PADDOCK -----------------------------
         La zone d'événements de l'accueil (#home-events-zone) et
         l'onglet « Événements » de Réseaux & Messages affichent le MÊME
         tableau REP_EVENTS_PENDING : renderHomeEvents remplit la
         première, renderRepEvents la seconde. C'était donc un doublon,
         et un doublon amputé — la zone d'accueil était en plus réservée
         à la Formule 2 et à la Formule 1, alors que l'onglet, lui, n'a
         aucune restriction de catégorie.
         La zone d'accueil disparaît ; l'onglet devient le seul endroit.
         ------------------------------------------------------------- */
      "#home-events-zone{display:none !important}"
    ].join("");
    document.head.appendChild(st);
  }

  /* Une pastille sur la tuile « Réseaux » remplace la visibilité que
     donnait la zone d'accueil : sans elle, un événement en attente
     passerait totalement inaperçu. Le badge réutilise le mécanisme
     existant (.apex-action-badge), déjà en place sur Pilote, Contrats
     et Sponsors. */
  function pastilleEvenements() {
    try {
      var tuile = document.querySelector(".apex-action-tile[onclick*='S-media'] .apex-action-icon");
      if (!tuile) return;
      var b = document.getElementById("rj72-evt-badge");
      var n = 0;
      try { n = (typeof REP_EVENTS_PENDING !== "undefined" && REP_EVENTS_PENDING) ? REP_EVENTS_PENDING.length : 0; } catch (e) {}
      if (!n) { if (b) b.style.display = "none"; return; }
      if (!b) {
        b = document.createElement("span");
        b.id = "rj72-evt-badge";
        b.className = "apex-action-badge";
        tuile.appendChild(b);
      }
      b.textContent = n;
      b.style.display = "flex";
    } catch (e) {}
  }
  window._rj72Pastille = pastilleEvenements;

  /* ------------------------------------------------------------------
   * Confirmation de suppression d'une sauvegarde : clic fantôme.
   *
   * Symptôme : le premier appui sur la croix fait apparaître la bannière
   * « Supprimer cette sauvegarde ? » qui se referme aussitôt ; il faut
   * appuyer une seconde fois pour qu'elle reste.
   *
   * Le code d'origine appelle pourtant bien stopPropagation, et le défaut
   * ne se reproduit ni au clic ni au tactile émulé sous Chromium : il est
   * propre à WebKit. Sur iOS, un appui produit touchstart, touchend, puis
   * un click différé d'environ 300 ms. La bannière étant insérée entre les
   * deux, ce click résiduel atterrit sur les boutons qui viennent
   * d'apparaître — « Annuler » referme donc ce que l'appui venait d'ouvrir.
   *
   * Remède : pendant 450 ms après l'ouverture, les boutons de la bannière
   * n'acceptent aucun clic. Un appui volontaire ne peut pas être aussi
   * rapide ; seul le clic fantôme tombe dans cette fenêtre. Même principe
   * que l'anti-rebond du module 50 sur l'écran stratégie.
   * ---------------------------------------------------------------- */
  var ouvertureConfirm = 0;

  function antiClicFantome(ev) {
    try {
      var slots = document.getElementById("save-slots");
      if (!slots || !slots.contains(ev.target)) return;
      var t = (ev.target.textContent || "").trim();
      if (t === "\u00d7") { ouvertureConfirm = Date.now(); return; }
      if (t === "Annuler" || t === "Supprimer") {
        if (ouvertureConfirm && (Date.now() - ouvertureConfirm) < 450) {
          ev.stopPropagation();
          ev.preventDefault();
          if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        }
      }
    } catch (e) {}
  }

  function boot() {
    if (!document.head) { setTimeout(boot, 60); return; }
    css();
    pastilleEvenements();
    try { document.addEventListener("click", antiClicFantome, true); } catch (e) {}
    try {
      if (typeof MutationObserver === "function") {
        var t = null;
        var obs = new MutationObserver(function () {
          if (t) clearTimeout(t);
          t = setTimeout(pastilleEvenements, 120);
        });
        obs.observe(document.body, { childList: true, subtree: true });
      }
    } catch (e) {}
    console.log(TAG + " actif — menu principal d'origine, bandeau de saison masqué");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj72Uninstall = function () {
    try { document.removeEventListener("click", antiClicFantome, true); } catch (e) {}
    var st = document.getElementById(ID);
    if (st && st.parentNode) st.parentNode.removeChild(st);
    console.log(TAG + " désinstallé — bandeau de saison restauré");
  };
})();
