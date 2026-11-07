/* =====================================================================
 * 110-plein-ecran.js — UNE APPLICATION, PAS UNE PAGE
 *
 * Plein écran au premier toucher : dans le navigateur d'un téléphone (pas
 * l'application installée, déjà en plein écran), la barre d'adresse mange
 * une bonne part de la hauteur en paysage. Au premier toucher, le jeu passe
 * en plein écran et verrouille l'orientation paysage. Une fois par
 * chargement ; sans effet sur ordinateur et sur iOS Safari, qui ne
 * permettent ni l'un ni l'autre.
 *
 * Application fixe : la page ne glisse ni ne rebondit (css/paysage.css la
 * fige, et ici un doigt qui glisse hors d'une zone qui défile ne déplace
 * rien — Safari avant iOS 16 ignorait overscroll-behavior). Le pincement
 * pour zoomer est bloqué, comme dans une application.
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[110-plein-ecran]";

  function applicable() {
    var installe = window.matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches || navigator.standalone;
    return !installe && window.matchMedia("(pointer: coarse)").matches &&
      typeof document.documentElement.requestFullscreen === "function";
  }

  function passer() {
    document.removeEventListener("pointerup", passer, true);
    if (document.fullscreenElement) return;
    document.documentElement.requestFullscreen({ navigationUI: "hide" }).then(function () {
      if (screen.orientation && typeof screen.orientation.lock === "function")
        return screen.orientation.lock("landscape").catch(function () {});
    }).catch(function (e) { console.warn(TAG, e && e.message); });
  }

  /* Un ancêtre qui défile vraiment dans ce sens ? */
  function defileur(el, vertical) {
    for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      var cs = getComputedStyle(el), o = vertical ? cs.overflowY : cs.overflowX;
      if ((o === "auto" || o === "scroll") && (vertical ? el.scrollHeight > el.clientHeight + 1 : el.scrollWidth > el.clientWidth + 1)) return true;
    }
    return false;
  }

  var depart = null, pivote = window.matchMedia("(orientation: portrait) and (pointer: coarse)");
  function surDebut(e) { depart = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }
  function surGlisse(e) {
    if (e.touches.length > 1) { e.preventDefault(); return; }      // pincement
    if (!depart || e.target.closest && e.target.closest("input[type=range]")) return;
    var dx = Math.abs(e.touches[0].clientX - depart.x), dy = Math.abs(e.touches[0].clientY - depart.y);
    // Jeu pivoté (portrait, css/paysage.css) : le haut de l'écran est la gauche du jeu.
    if (pivote.matches) { var t = dx; dx = dy; dy = t; }
    if (!defileur(e.target, dy >= dx)) e.preventDefault();
  }
  function bloquer(e) { e.preventDefault(); }

  if (applicable()) document.addEventListener("pointerup", passer, true);
  document.addEventListener("touchstart", surDebut, { passive: true });
  document.addEventListener("touchmove", surGlisse, { passive: false });
  document.addEventListener("gesturestart", bloquer, { passive: false });   // pincement, Safari

  window._rj110Uninstall = function () {
    document.removeEventListener("pointerup", passer, true);
    document.removeEventListener("touchstart", surDebut);
    document.removeEventListener("touchmove", surGlisse);
    document.removeEventListener("gesturestart", bloquer);
  };
})();
