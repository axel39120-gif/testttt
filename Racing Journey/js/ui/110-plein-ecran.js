/* =====================================================================
 * 110-plein-ecran.js — PLEIN ÉCRAN AU PREMIER TOUCHER
 *
 * Dans le navigateur d'un téléphone (pas l'application installée, déjà en
 * plein écran), la barre d'adresse mange une bonne part de la hauteur en
 * paysage. Au premier toucher, le jeu passe en plein écran et verrouille
 * l'orientation paysage, comme un jeu mobile.
 *
 * Une fois par chargement : si le joueur quitte le plein écran, on ne le
 * lui impose pas de nouveau. Sans effet sur ordinateur (pointeur fin) et sur
 * iOS Safari, qui ne permet ni l'un ni l'autre.
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

  if (applicable()) document.addEventListener("pointerup", passer, true);
  window._rj110Uninstall = function () { document.removeEventListener("pointerup", passer, true); };
})();
