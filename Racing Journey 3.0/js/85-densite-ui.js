/* =====================================================================
 * 85-densite-ui.js — DENSITÉ VISUELLE DE L'APPLICATION
 *
 * MESURES (fenêtre utile : 831 px)
 *   · Style de vie · Activités : 2155 px — 12 cartes de 137 px ;
 *   · Style de vie · Shopping  : 1955 px — 19 cartes de 133 px ;
 *   · Championnat              : 1340 px — 20 lignes de 47 px ;
 *   · Pilote                   : 1165 px — dont 650 px de barres de stats.
 *
 * Le problème n'est pas le NOMBRE d'éléments — un classement a vingt
 * pilotes, c'est ainsi — mais leur HAUTEUR UNITAIRE. Une activité occupe
 * 137 px pour trois lignes de texte : l'essentiel de cette hauteur est du
 * vide, des marges et des icônes surdimensionnées.
 *
 * PARTI PRIS
 * On ne rajoute ni boîte, ni bouton, ni fenêtre : c'est une application,
 * pas une pile de tiroirs. On resserre la mise en page — marges intérieures,
 * interlignes, taille des vignettes — sans jamais descendre sous les seuils
 * de lisibilité (corps de texte à 12 px minimum, cibles tactiles à 34 px).
 *
 * Tout passe par une feuille de style ciblée : aucune structure n'est
 * modifiée, donc aucun module de rendu n'est perturbé.
 *
 * Réversible : window._rj85Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[85-densite]";
  var CSS_ID = "rj85-css";

  var REGLES = [

    /* ---------------------------------------------------------------
     * ACTIVITÉS ET BOUTIQUE  (137 px et 133 px par carte)
     *
     * La vignette passe de 46 à 34 px, les marges intérieures se
     * resserrent, la description tient sur une ligne — le détail complet
     * reste lisible, seule la respiration excédentaire disparaît.
     * ------------------------------------------------------------- */
    ".act-card,.ls-item{padding:9px 11px !important;margin-bottom:5px !important}",
    ".act-card > div,.ls-item > div{gap:9px !important}",
    ".ls-act-icon,.ls-item-icon{width:34px !important;height:34px !important;min-width:34px !important;" +
      "flex:0 0 34px !important;border-radius:8px !important}",

    /* description sur une seule ligne, coupée proprement */
    ".rj85-desc{display:-webkit-box !important;-webkit-line-clamp:1 !important;-webkit-box-orient:vertical !important;" +
      "overflow:hidden !important;line-height:1.35 !important;margin-top:2px !important}",

    /* badges : moins hauts, moins espacés */
    ".act-card .badge,.ls-item .badge{padding:2px 6px !important;font-size:9px !important;line-height:1.35 !important}",
    ".act-card [style*='flex-wrap:wrap'],.ls-item [style*='flex-wrap:wrap']{gap:4px !important;margin-top:5px !important}",

    /* la ligne de pied (prix + action) se resserre */
    "[data-rj39-cta]{margin-top:6px !important}",
    ".ls-btn{padding:7px 12px !important}",

    /* photo d'article : format panoramique plutôt que carré */
    ".ls-item img.ls-photo,.ls-item [style*='height:180px']{height:104px !important;object-fit:cover !important}",

    /* ---------------------------------------------------------------
     * CHAMPIONNAT  (20 lignes de 47 px)
     * Une ligne de classement n'a besoin que d'une hauteur de doigt.
     * ------------------------------------------------------------- */
    "#cht-classement .cr,#cht-classement .row{padding:7px 10px !important;min-height:38px !important}",
    "#cht-classement .cr + .cr{margin-top:3px !important}",

    /* ---------------------------------------------------------------
     * PILOTE  (650 px de barres de stats)
     *
     * Chaque pilier (Performance, Mental…) empile ses lignes une par une.
     * Les lignes passent sur deux colonnes : même information, moitié
     * moins de hauteur. En dessous de 380 px de large, retour sur une
     * colonne pour ne pas tasser les libellés.
     * ------------------------------------------------------------- */
    /* Deux colonnes ont été essayées : à 430 px de large, la jauge tombait
       à quelques pixels et la valeur passait hors cadre. On reste sur une
       colonne — l'écran Pilote est fait pour être lu, pas pour tenir à tout
       prix — et on gagne uniquement sur les espacements. */
    "#p-stat-bars .p-row{padding:3px 0 !important}",
    "#p-stat-bars .pillar-block{margin-bottom:8px !important}",
    "#p-stat-bars .pillar-head{padding:6px 0 !important}",
    "#pilot-rating-card{padding:12px 14px !important}",

    /* ---------------------------------------------------------------
     * RESPIRATION GÉNÉRALE
     * Les intitulés de section et les cartes gagnent quelques pixels
     * partout, ce qui se cumule vite sur un écran long.
     * ------------------------------------------------------------- */
    ".t-sec,.sec-lbl{margin:12px 14px 6px !important;font-size:10px !important}",
    ".card{padding:11px 13px !important}",
    ".scroll > .card + .card{margin-top:7px !important}"
  ];

  function injecter() {
    if (document.getElementById(CSS_ID)) return true;
    var st = document.createElement("style");
    st.id = CSS_ID;
    st.textContent = REGLES.join("\n");
    (document.head || document.documentElement).appendChild(st);
    return true;
  }

  /* Les descriptions n'ont pas de classe commune : on la pose nous-mêmes,
     une seule fois par élément, sur la ligne qui suit le titre d'une carte. */
  function marquerDescriptions(racine) {
    try {
      var cartes = (racine || document).querySelectorAll(".act-card, .ls-item");
      for (var i = 0; i < cartes.length; i++) {
        var corps = cartes[i].querySelector('div[style*="flex:1"]') || cartes[i];
        var enfants = corps.children;
        /* le titre est le premier bloc, la description le suivant */
        if (enfants.length >= 2) {
          var d = enfants[1];
          if (d && !d.classList.contains("rj85-desc") && !d.querySelector(".badge")) {
            d.classList.add("rj85-desc");
          }
        }
      }
    } catch (e) {}
  }

  var _orig = {};

  function wrap(nom) {
    if (typeof window[nom] !== "function" || window[nom]._rj85) return;
    var o = window[nom];
    window[nom] = function () {
      var r = o.apply(this, arguments);
      try { setTimeout(function () { marquerDescriptions(); }, 20); } catch (e) {}
      return r;
    };
    window[nom]._rj85 = true;
    _orig[nom] = o;
  }

  function boot() {
    injecter();
    marquerDescriptions();
    ["renderLifestyle", "renderLsActivities", "renderShop", "navTo", "refreshScreen"].forEach(wrap);
    console.log(TAG, "actif — mise en page resserrée");

    window._rj85Uninstall = function () {
      var css = document.getElementById(CSS_ID);
      if (css && css.parentNode) css.parentNode.removeChild(css);
      Object.keys(_orig).forEach(function (k) { window[k] = _orig[k]; });
      var d = document.querySelectorAll(".rj85-desc");
      for (var i = 0; i < d.length; i++) d[i].classList.remove("rj85-desc");
      console.log(TAG, "désinstallé");
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
