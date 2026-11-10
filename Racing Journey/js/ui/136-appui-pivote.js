/* =====================================================================
 * 136-appui-pivote.js — DES APPUIS FIABLES QUAND LE JEU EST PIVOTÉ
 *
 * POURQUOI
 * Téléphone tenu à l'horizontale avec la rotation verrouillée en portrait
 * (cas courant sur iPhone), le jeu se dessine pivoté d'un quart de tour
 * (css/paysage.css : transform sur le body). Safari iOS calcule mal la
 * cible des appuis dans une page ainsi pivotée qui contient des éléments
 * en position fixe (rail, onglets, fenêtres) : un appui tombe à côté ou se
 * perd, et il faut taper plusieurs fois. Sur ordinateur, rien n'est pivoté.
 *
 * CE QUE FAIT LE MODULE (seulement quand le jeu est pivoté)
 * À la fin d'un appui court (moins de 10 px de glissé, moins de 600 ms),
 * on retrouve l'élément réellement sous le doigt (elementFromPoint tient
 * compte de la rotation), on lui envoie un clic, et on annule le clic que
 * le navigateur aurait synthétisé lui-même (pas de double clic). Les champs
 * de saisie, curseurs et listes gardent le comportement du navigateur, et
 * un doigt qui glisse fait toujours défiler.
 *
 * Réversible : window._rj136Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[136-appui-pivote]";
  var pivote = window.matchMedia("(orientation: portrait) and (pointer: coarse)");
  var SEUIL = 10, DUREE = 600;
  var depart = null;

  /* Ce que le navigateur doit gérer seul (saisie, focus, glissières). */
  function natif(el) {
    return !el || !el.closest || !!el.closest("input, textarea, select, [contenteditable=''], [contenteditable='true'], input[type=range], .rj121-voile [data-natif]");
  }

  function surDebut(e) {
    if (!pivote.matches || e.touches.length !== 1) { depart = null; return; }
    var t = e.touches[0];
    depart = { x: t.clientX, y: t.clientY, t: Date.now(), cible: e.target };
  }

  function surGlisse(e) {
    if (!depart || !e.touches.length) return;
    var t = e.touches[0];
    if (Math.abs(t.clientX - depart.x) >= SEUIL || Math.abs(t.clientY - depart.y) >= SEUIL) depart = null;   // c'est un glissement
  }

  function surFin(e) {
    var d = depart; depart = null;
    if (!d || !pivote.matches || e.touches.length) return;
    if (Date.now() - d.t > DUREE) return;                        // appui long : on laisse faire
    var t = e.changedTouches && e.changedTouches[0];
    if (!t || Math.abs(t.clientX - d.x) >= SEUIL || Math.abs(t.clientY - d.y) >= SEUIL) return;
    var el = document.elementFromPoint(t.clientX, t.clientY);
    if (!el || natif(el) || natif(d.cible)) return;
    /* Un vrai événement de clic : el.click() n'existe pas sur une icône SVG,
       qui est souvent l'élément exact sous le doigt. */
    var clic;
    try { clic = new MouseEvent("click", { bubbles: true, cancelable: true, view: window, clientX: t.clientX, clientY: t.clientY, screenX: t.screenX, screenY: t.screenY, detail: 1 }); }
    catch (err) { return; }                                      // sans clic de remplacement, on laisse le navigateur faire
    e.preventDefault();                                          // pas de clic synthétisé en double par le navigateur
    el.dispatchEvent(clic);
  }

  document.addEventListener("touchstart", surDebut, { passive: true, capture: true });
  document.addEventListener("touchmove", surGlisse, { passive: true, capture: true });
  document.addEventListener("touchend", surFin, { passive: false, capture: true });
  document.addEventListener("touchcancel", function () { depart = null; }, { passive: true, capture: true });

  window.RJAppuiPivote = { actif: function () { return pivote.matches; } };
  window._rj136Uninstall = function () {
    document.removeEventListener("touchstart", surDebut, true);
    document.removeEventListener("touchmove", surGlisse, true);
    document.removeEventListener("touchend", surFin, true);
    delete window.RJAppuiPivote;
  };
  console.log(TAG, "actif");
})();
