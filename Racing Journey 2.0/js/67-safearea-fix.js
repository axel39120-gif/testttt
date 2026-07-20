/* =====================================================================
 * 67-safearea-fix.js — MARGE DE SÉCURITÉ COMPTÉE DEUX FOIS (iOS installé)
 *
 * SYMPTÔME : en PWA installée sur iPhone, un large vide apparaît au-dessus
 * de l'en-tête de plusieurs écrans. Invisible sur ordinateur.
 *
 * CAUSE, mesurée sur iPhone 16 Pro Max :
 *     Écran (fenêtre) ....... 440 x 894
 *     Hauteur réelle du tél .. 956
 *     env(safe-area-inset-top) 62
 *     zone des écrans à y ..... 62
 *
 * 894 + 62 = 956 : la fenêtre EXCLUT DÉJÀ la zone de l'îlot dynamique.
 * Mais env(safe-area-inset-top) continue de renvoyer 62 px, que la mise en
 * page applique une seconde fois — d'où un vide de la hauteur de l'îlot.
 * Sur ordinateur la marge vaut 0, le défaut est donc invisible : c'est ce
 * qui rendait le bug irreproductible en développement.
 *
 * CORRECTIF : on compare la hauteur de la fenêtre à celle de l'écran. Si la
 * fenêtre exclut déjà l'encoche, on neutralise --safe-top ; sinon on n'y
 * touche pas. Même raisonnement pour le bas, où l'indicateur d'accueil
 * chevauche généralement le contenu et doit donc être conservé.
 *
 * Aucun réglage en dur : tout est déduit des mesures de l'appareil, et
 * recalculé à la rotation ou au changement de fenêtre.
 *
 * Réversible : window._rj67Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var etat = { applique: false, hautNeutralise: false, basNeutralise: false, mesures: null };
  window._rj67Status = function () { return etat; };

  function px(v) {
    var n = parseFloat(String(v || "").replace("px", ""));
    return isFinite(n) ? n : 0;
  }

  function insetsBruts() {
    // On lit les valeurs env() via une sonde, pour ne pas dépendre de
    // --safe-top qu'on est justement en train de modifier.
    var sonde = document.getElementById("rj67-sonde");
    if (!sonde) {
      sonde = document.createElement("div");
      sonde.id = "rj67-sonde";
      sonde.style.cssText = "position:fixed;left:-9999px;top:0;width:0;height:0;" +
        "padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);";
      document.body.appendChild(sonde);
    }
    var cs = getComputedStyle(sonde);
    return { haut: px(cs.paddingTop), bas: px(cs.paddingBottom) };
  }

  function appliquer() {
    try {
      if (!document.body) return false;
      var brut = insetsBruts();
      var vh = window.innerHeight || document.documentElement.clientHeight || 0;
      var sh = (window.screen && window.screen.height) || 0;

      // La fenêtre exclut-elle déjà l'encoche ? On tolère 2 px d'arrondi.
      var hautDejaExclu = (sh > 0 && brut.haut > 0 && vh <= sh - brut.haut + 2);
      // En bas, l'indicateur d'accueil chevauche presque toujours : on ne
      // neutralise que si la fenêtre l'exclut aussi (cas rare).
      var basDejaExclu = (sh > 0 && brut.bas > 0 && vh <= sh - brut.haut - brut.bas + 2);

      var root = document.documentElement;
      if (hautDejaExclu) root.style.setProperty("--safe-top", "0px");
      else root.style.removeProperty("--safe-top");
      if (basDejaExclu) root.style.setProperty("--safe-bot", "0px");
      else root.style.removeProperty("--safe-bot");

      etat.applique = true;
      etat.hautNeutralise = hautDejaExclu;
      etat.basNeutralise = basDejaExclu;
      etat.mesures = { fenetre: vh, ecran: sh, insetHaut: brut.haut, insetBas: brut.bas };

      if (hautDejaExclu || basDejaExclu) {
        console.log("[67-safearea-fix] marge comptée deux fois — fenêtre " + vh +
                    ", écran " + sh + ", encoche " + brut.haut +
                    " → --safe-top" + (hautDejaExclu ? " neutralisé" : " conservé") +
                    (basDejaExclu ? ", --safe-bot neutralisé" : ""));
      }
      return true;
    } catch (e) {
      console.warn("[67-safearea-fix] :", e);
      return false;
    }
  }

  var minuteur = null;
  function differer() {
    if (minuteur) clearTimeout(minuteur);
    minuteur = setTimeout(appliquer, 200);
  }

  var essais = 0;
  function boot() {
    if (!document.body) { if (essais++ < 100) setTimeout(boot, 80); return; }
    appliquer();
    window.addEventListener("resize", differer);
    window.addEventListener("orientationchange", differer);
    // iOS met parfois un instant à stabiliser ses marges après l'ouverture
    setTimeout(appliquer, 400);
    setTimeout(appliquer, 1200);
    console.log("[67-safearea-fix] actif");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj67Uninstall = function () {
    var root = document.documentElement;
    root.style.removeProperty("--safe-top");
    root.style.removeProperty("--safe-bot");
    window.removeEventListener("resize", differer);
    window.removeEventListener("orientationchange", differer);
    var s = document.getElementById("rj67-sonde");
    if (s && s.parentNode) s.parentNode.removeChild(s);
    console.log("[67-safearea-fix] désinstallé");
  };
})();
