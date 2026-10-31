/* =====================================================================
 * 94-ecran-course-epure.js — CE QUI RESTE À L'ÉCRAN PENDANT LA COURSE
 *
 * DEUX DÉFAUTS CONSTATÉS
 *
 * 1. En-tête dupliqué et texte en vrac.
 *    L'écran de course affichait DEUX fois le même en-tête : celui de
 *    l'écran (« MANCHE 1 / FRANCE · GP LORRAINE ») puis celui du direct
 *    (« MANCHE 1 / France · GP Lorraine »), drapeau compris. Entre les deux
 *    et la boîte « Direct » s'intercalaient le nom du circuit, les jalons
 *    (DÉPART / MI-COURSE / ARRIVÉE) et une phrase d'ambiance, affichés sans
 *    mise en forme sur certains chargements — d'où les lignes accolées du
 *    type « DÉPARTMI-COURSEARRIVÉE ».
 *
 *    Ne subsiste qu'une boîte : la barre de progression et le tour en
 *    cours. Le circuit et la manche sont déjà dans l'en-tête de l'écran,
 *    les répéter n'apportait rien.
 *
 * 2. Barre de navigation sur l'écran de résultat.
 *    Elle permettait de quitter la course par le bas, alors que l'écran
 *    propose déjà « Retour au calendrier » et « Tableau de bord ». On la
 *    retire sur cet onglet : la sortie passe par les deux boutons prévus.
 *
 * Réversible : window._rj94Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[94-course-epure]";
  var CSS_ID = "rj94-css";

  function injecterCSS() {
    if (document.getElementById(CSS_ID)) return;
    var css = [
      /* --- en-tête du direct : doublon de celui de l'écran ------------- */
      "#live-race-header{display:none !important}",

      /* --- boîte de progression réduite à l'essentiel ------------------
         On garde le compteur de tours et la barre. Le nom du circuit, les
         jalons et la phrase d'ambiance sortent : l'information est déjà
         dans l'en-tête, ou n'apporte rien pendant la course. */
      "#rj90-circuit,#rj90-jalons,#rj90-etat{display:none !important}",
      "#rj90-progression{margin:12px 16px 0 !important;padding:14px 16px !important;" +
        "box-sizing:border-box;border:1px solid var(--border-hi);border-radius:var(--r,12px);" +
        "background:linear-gradient(160deg,var(--bg2) 0%,var(--bg) 100%)}",
      "#rj90-progression .tour{display:flex !important;align-items:baseline !important;" +
        "gap:7px !important;margin:0 0 11px !important}",
      "#rj90-progression .tour .n{font-family:var(--font-display) !important;font-size:30px !important;" +
        "font-weight:900 !important;color:var(--white) !important;line-height:1 !important}",
      "#rj90-progression .tour .sur{font-family:var(--font-display) !important;font-size:14px !important;" +
        "font-weight:800 !important;color:var(--muted) !important}",
      "#rj90-progression .tour .lbl{font-size:11px !important;color:var(--text3) !important;" +
        "text-transform:uppercase !important;letter-spacing:.1em !important;margin-left:2px !important}",
      "#rj90-barre{position:relative;height:5px;border-radius:3px;overflow:hidden;" +
        "background:rgba(255,255,255,.08)}",
      "#rj90-barre > span{display:block;height:100%;border-radius:3px;" +
        "background:linear-gradient(90deg,var(--red,#FF1801),#F59E0B);transition:width .3s ease}",

      /* --- écran de résultat : sortie par les boutons dédiés ----------- */
      "body.rj94-resultat #main-nav,body.rj94-resultat .ni,body.rj94-resultat .apex-nav," +
      "body.rj94-resultat .apex-tabbar{display:none !important}"
    ].join("\n");
    var st = document.createElement("style");
    st.id = CSS_ID; st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  /* ------------------------------------------------------------------
   * La barre du bas ne disparaît que sur l'onglet Résultat : partout
   * ailleurs, y compris sur les autres onglets du week-end, elle reste.
   * ---------------------------------------------------------------- */
  function majBarreDuBas() {
    try {
      var course = document.getElementById("S-race");
      var surCourse = course && course.classList.contains("on");
      var res = document.getElementById("rt-res");
      var onglet = res && getComputedStyle(res).display !== "none";

      /* Garde-fou : on ne retire la barre que si l'écran offre réellement
         une sortie. Sans ce contrôle, un cas où les boutons ne seraient pas
         rendus laisserait le joueur enfermé dans l'écran de résultat. */
      var sortie = false;
      if (onglet) {
        var cliquables = res.querySelectorAll("button, [onclick]");
        for (var i = 0; i < cliquables.length; i++) {
          if (/calendrier|tableau de bord|accueil|bilan de saison/i.test(cliquables[i].innerText || "")) {
            sortie = true; break;
          }
        }
      }
      document.body.classList.toggle("rj94-resultat", !!(surCourse && onglet && sortie));
    } catch (e) {}
  }

  var _origRtab = null;

  function boot() {
    injecterCSS();
    majBarreDuBas();

    /* La bascule d'onglet est le seul moment où l'état change. */
    if (typeof window.rtab === "function" && !window.rtab._rj94) {
      _origRtab = window.rtab;
      window.rtab = function () {
        var r = _origRtab.apply(this, arguments);
        try { setTimeout(majBarreDuBas, 40); } catch (e) {}
        return r;
      };
      window.rtab._rj94 = true;
    }

    /* Quitter l'écran de course rétablit la barre. */
    if (Array.isArray(window.RJ_SCREEN_HOOKS) &&
        !window.RJ_SCREEN_HOOKS.some(function (h) { return h && h.id === "94-course-epure"; })) {
      window.RJ_SCREEN_HOOKS.push({
        id: "94-course-epure",
        ecran: "*",
        apres: function () { setTimeout(majBarreDuBas, 40); }
      });
    }

    console.log(TAG, "écran de course épuré, barre du bas retirée du résultat");

    window._rj94 = { maj: majBarreDuBas };
    window._rj94Uninstall = function () {
      var css = document.getElementById(CSS_ID);
      if (css && css.parentNode) css.parentNode.removeChild(css);
      document.body.classList.remove("rj94-resultat");
      if (_origRtab) window.rtab = _origRtab;
      console.log(TAG, "désinstallé");
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
