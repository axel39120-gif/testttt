/* =====================================================================
 * 90-gouttiere.js — UNE SEULE MARGE LATÉRALE DANS TOUT LE JEU
 *
 * CE QUE LA MESURE A ÉTABLI (fenêtre de 430 px, marges gauche/droite)
 *
 *   Onglet Essais        16 / 16 partout — la référence, cohérente.
 *   Tableau de bord      16 / 16.
 *   Onglet Préparation   un mélange : 16/16 pour le tableau de bord,
 *                        14/14 pour l'intitulé de section, 0/0 pour les
 *                        blocs pleine largeur, et surtout
 *                        0 / 32 pour le bouton « Continuer » — décalé de
 *                        seize pixels vers la gauche, donc visiblement
 *                        décentré.
 *
 * Hors du week-end de course, le jeu est déjà régulier : l'inventaire n'a
 * relevé que trois asymétries, toutes légitimes (colonnes côte à côte).
 *
 * PARTI PRIS
 * Une gouttière unique de 16 pixels, appliquée aux blocs de premier niveau
 * des écrans. On ne touche pas aux éléments qui doivent occuper toute la
 * largeur — en-têtes, bandeaux, images de circuit — ni aux colonnes de
 * grille, dont l'asymétrie apparente est le fait d'être côte à côte.
 *
 * La valeur est exposée en variable CSS (--rj-gouttiere) : la changer une
 * fois suffit à décaler tout le jeu.
 *
 * Réversible : window._rj90Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[90-gouttiere]";
  var CSS_ID = "rj90-css";
  var GOUTTIERE = 16;

  /* Éléments qui doivent rester pleine largeur : les toucher casserait la
     mise en page au lieu de la régulariser. */
  var PLEINE_LARGEUR = [
    ".hdr", ".apex-cockpit-hdr", ".apex-cockpit-bg", ".nav", ".navbar",
    ".apex-nav", ".apex-tabbar", ".ni", ".rt-tabs", ".race-tabs",
    ".scroll", ".scr", "#quali-screen", "#race-screen", ".rj-bcast",
    ".modal", ".rj84-box", "#rj84-modal"
  ].join(",");

  function injecter() {
    if (document.getElementById(CSS_ID)) return;
    var g = GOUTTIERE + "px";

    /* Une première version appliquait la gouttière à TOUS les blocs de
       premier niveau des onglets. Mauvaise idée : là où elle existait déjà
       (onglet Essais), elle s'ajoutait à celle du parent — les boutons se
       retrouvaient à trente-deux pixels — et le « width:auto » qui
       l'accompagnait écrasait la largeur des éléments en display:flex.
       On ne corrige donc que ce qui est réellement désaligné, élément par
       élément, en s'appuyant sur la mesure. */
    var css = [
      ":root{--rj-gouttiere:" + g + "}",

      /* --- onglet Préparation ------------------------------------------
         Ces blocs occupaient toute la largeur (0/0) alors que le tableau
         de bord au-dessus d'eux était à seize pixels. */
      /* Ces blocs portent des styles en attribut, qui priment sur une
         feuille classique : il faut donc marquer les règles. */
      "#race-conditions,#auto-setup-banner{" +
        "box-sizing:border-box !important;width:calc(100% - 2 * var(--rj-gouttiere)) !important;" +
        "margin-left:var(--rj-gouttiere) !important;margin-right:var(--rj-gouttiere) !important}",

      /* Le bouton « Continuer » était posé à zéro à gauche et trente-deux à
         droite : décalé de seize pixels, donc visiblement décentré. */
      /* Sur un bouton, « width:auto » vaut largeur du contenu : il faut
         donc calculer la largeur pleine moins les deux gouttières. */
      "#prep-go-next-btn{" +
        "box-sizing:border-box !important;display:block !important;" +
        "width:calc(100% - 2 * var(--rj-gouttiere)) !important;" +
        "margin-left:var(--rj-gouttiere) !important;margin-right:var(--rj-gouttiere) !important}",

      /* --- toute l'application ------------------------------------------
         Deux gouttières cohabitaient : quatorze pixels sur le style de vie,
         les contrats, le championnat et une partie de l'écran pilote ;
         seize sur le week-end de course, les médias et le tableau de bord
         du circuit. On retient seize, la valeur du week-end, déjà
         uniformisée et la plus lisible.

         Les colonnes de grille (.mc) sont exclues : leur asymétrie
         apparente vient de ce qu'elles sont côte à côte, c'est voulu. */
      /* --- menus de l'accueil -------------------------------------------
         Les sections « Carrière », « Business » et « Vie » et leurs grilles
         de tuiles touchaient les bords de l'écran : une règle
         « #S-home > .scroll > … » remettait padding et margin à zéro, plus
         spécifique que la gouttière générale. On la contre en ciblant le
         même chemin, et en agissant sur le padding — la grille doit garder
         sa pleine largeur, ses colonnes se calant sur l'espace intérieur.
         Le padding vertical reste à zéro : la compacité de l'accueil est
         voulue. */
      /* Le bandeau de course, le rail de statistiques et la barre de moral
         restaient à quatorze pixels : une fois les tuiles alignées à seize,
         le décalage se voyait à l'œil sur toute la hauteur de l'accueil. */
      "#S-home > .apex-hero-race,#S-home > .apex-mental-row{" +
        "margin-left:var(--rj-gouttiere) !important;" +
        "margin-right:var(--rj-gouttiere) !important}",
      "#S-home > .apex-stats-rail{" +
        "padding-left:var(--rj-gouttiere) !important;" +
        "padding-right:var(--rj-gouttiere) !important}",

      "#S-home > .scroll > .apex-sec," +
      "#S-home > .scroll > .apex-actions-grid{" +
        "padding-left:var(--rj-gouttiere) !important;" +
        "padding-right:var(--rj-gouttiere) !important;" +
        "margin-left:0 !important;margin-right:0 !important}",

      ".t-sec,.sec-lbl,.apex-sec," +
      ".scroll > .card,.ls-item,.act-card,.rj83-row,.rj83-fams,.rj83-sub{" +
        "margin-left:var(--rj-gouttiere) !important;margin-right:var(--rj-gouttiere) !important}",

      /* Le conteneur des colonnes prend la gouttière, ses colonnes non. */
      /* Le conteneur de colonnes gère déjà son retrait par une marge
         intérieure de quatorze pixels : lui ajouter une marge extérieure
         aboutissait à trente. On aligne sa marge intérieure sur la
         gouttière et on ne lui en met aucune autre. */
      ".mg{margin-left:0 !important;margin-right:0 !important;" +
        "padding-left:var(--rj-gouttiere) !important;padding-right:var(--rj-gouttiere) !important}",
      ".mc{margin-left:0 !important;margin-right:0 !important}",

      /* Cartes de l'écran pilote, restées à quatorze pixels. */
      "#pilot-rating-card,#pt-stats > .card,.stat-hero,.p-badges{" +
        "margin-left:var(--rj-gouttiere) !important;margin-right:var(--rj-gouttiere) !important}",

      /* --- boutons d'accès aux fenêtres --------------------------------
         Ils suivent la gouttière de leur conteneur : sans marge propre
         lorsqu'ils sont déjà dans un bloc en retrait, avec la gouttière
         lorsqu'ils sont posés directement dans l'onglet. */
      ".rj84-open{box-sizing:border-box !important;width:100% !important;" +
        "margin-left:0 !important;margin-right:0 !important}",
      "#rt-prep > .rj84-open{width:calc(100% - 2 * var(--rj-gouttiere)) !important;" +
        "margin-left:var(--rj-gouttiere) !important;margin-right:var(--rj-gouttiere) !important}"
    ].join("\n");

    var st = document.createElement("style");
    st.id = CSS_ID;
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  /* --------------------------------------------------------------------
   * Contrôle : on relève les asymétries restantes pour pouvoir les traiter
   * plutôt que de les découvrir en jeu. Actif seulement sur demande, via
   * window._rj90.controler().
   * ------------------------------------------------------------------ */
  function controler() {
    var scr = document.querySelector(".scr.on");
    if (!scr) return [];
    var hote = scr.querySelector(".scroll") || scr;
    var ecarts = [];
    [].slice.call(hote.children).forEach(function (e) {
      var r = e.getBoundingClientRect();
      if (r.width < 140 || r.height < 24) return;
      var gauche = Math.round(r.left);
      var droite = Math.round((window.innerWidth || 430) - r.right);
      if (Math.abs(gauche - droite) <= 2) return;
      ecarts.push({
        element: e.id || String(e.className).slice(0, 28),
        gauche: gauche, droite: droite
      });
    });
    return ecarts;
  }

  function boot() {
    injecter();
    console.log(TAG, "actif — gouttière de " + GOUTTIERE + " px");

    window._rj90 = {
      controler: controler,
      gouttiere: function (v) {
        if (typeof v === "number") {
          GOUTTIERE = v;
          document.documentElement.style.setProperty("--rj-gouttiere", v + "px");
        }
        return GOUTTIERE;
      }
    };
    window._rj90Uninstall = function () {
      var css = document.getElementById(CSS_ID);
      if (css && css.parentNode) css.parentNode.removeChild(css);
      console.log(TAG, "désinstallé");
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
