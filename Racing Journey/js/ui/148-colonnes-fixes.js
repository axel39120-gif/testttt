/* =====================================================================
 * 148-colonnes-fixes.js — CHAQUE BLOC GARDE SA COLONNE
 *
 * POURQUOI
 * En paysage, le contenu des écrans coule sur deux colonnes (paysage.css,
 * column-width) : un bloc passe à gauche ou à droite selon la hauteur de
 * ceux qui le précèdent. En qualification, le classement descendait tout
 * en bas de la colonne gauche, puis sautait à droite dès que le bouton
 * changeait de taille.
 *
 * CE QUE FAIT CE MODULE
 * Pour chaque conteneur en colonnes de l'écran affiché, la coupure est
 * choisie UNE fois (au plus près de la moitié de la hauteur) et retenue
 * pour cette combinaison de blocs : ensuite, le même bloc ouvre toujours la
 * colonne de droite, quelle que soit la hauteur des autres. Quelques
 * coupures sont imposées (qualification : piste et classement à droite).
 * Aucun bloc n'est déplacé dans le DOM : une classe sur le bloc qui ouvre
 * la colonne de droite suffit (break-before: column).
 *
 * Réversible : window._rj148Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var COUPE = "rj148-coupe", DEUX = "rj148-deux";
  /* Coupures imposées : conteneur → blocs candidats pour ouvrir la droite. */
  var IMPOSEES = { "quali-screen": ["rj146", "quali-timing-board"] };
  var memoire = {};

  function visible(e) { return e.offsetParent !== null || getComputedStyle(e).position === "fixed"; }
  function cle(e, i) {
    if (e.id) return "#" + e.id;
    var c = (e.className && typeof e.className === "string") ? e.className.trim().split(/\s+/).filter(function (x) { return x !== COUPE; })[0] : "";
    return (c ? "." + c : e.tagName.toLowerCase()) + ":" + i;
  }

  function conteneurs(ecran) {
    var L = [];
    ecran.querySelectorAll(".scroll > *, .scroll > * > *").forEach(function (e) {
      var cs = getComputedStyle(e);
      if (cs.columnWidth === "auto" || cs.display === "none") return;
      var w = parseFloat(cs.columnWidth) || 0, gap = parseFloat(cs.columnGap) || 0;
      if (w && e.clientWidth >= 2 * w + gap) L.push(e);     // au moins deux colonnes réelles
    });
    return L;
  }

  function couper(c) {
    var enfants = Array.prototype.filter.call(c.children, visible);
    if (enfants.length < 2) { c.classList.remove(DEUX); return; }
    var cles = enfants.map(cle);
    var nom = (c.id || c.className || "c") + "|" + cles.join(",");
    var choix = memoire[nom];
    if (!choix) {
      var imp = IMPOSEES[c.id];
      if (imp) choix = imp.map(function (id) { return "#" + id; }).filter(function (k) { return cles.indexOf(k) > 0; })[0];
      if (!choix) {
        var h = enfants.map(function (e) { return e.offsetHeight; }), tot = h.reduce(function (a, b) { return a + b; }, 0), cum = 0, best = 1, ecart = Infinity;
        for (var i = 1; i < enfants.length; i++) {
          cum += h[i - 1];
          var d = Math.abs(cum - (tot - cum));
          if (d < ecart) { ecart = d; best = i; }
        }
        /* Un titre de section suit toujours son contenu à droite. */
        while (best > 1 && enfants[best - 1].matches(".t-sec, .apex-sec, .sec-lbl, .rj114-titre, .rj122-groupe-titre")) best--;
        choix = cles[best];
      }
      memoire[nom] = choix;
    }
    c.classList.add(DEUX);
    enfants.forEach(function (e, i) { e.classList.toggle(COUPE, cles[i] === choix); });
  }

  var attente = null;
  function appliquer() {
    attente = null;
    var ecran = document.querySelector(".scr.on");
    if (!ecran) return;
    try { conteneurs(ecran).forEach(couper); } catch (e) { console.warn("[148-colonnes]", e && e.message); }
  }
  function plusTard() { if (!attente) attente = setTimeout(appliquer, 200); }
  /* Ajouts et retraits de blocs, ou changement d'écran ; pas les styles (la course en change à chaque image). */
  function surMutation(liste) {
    for (var i = 0; i < liste.length; i++) {
      var m = liste[i];
      if (m.type === "childList" || (m.target.classList && m.target.classList.contains("scr"))) { plusTard(); return; }
    }
  }

  var obs = null;
  function boot() {
    var css = document.createElement("style");
    css.id = "rj148-css";
    css.textContent = "." + DEUX + "{column-count:2!important;column-fill:balance}" +
      "." + DEUX + ">." + COUPE + "{break-before:column!important}";
    document.head.appendChild(css);
    obs = new MutationObserver(surMutation);
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    window.addEventListener("resize", plusTard);
    plusTard();
    window._rj148 = { appliquer: appliquer, memoire: memoire };
    window._rj148Uninstall = function () {
      if (obs) obs.disconnect();
      window.removeEventListener("resize", plusTard);
      css.remove();
      document.querySelectorAll("." + COUPE + ",." + DEUX).forEach(function (e) { e.classList.remove(COUPE, DEUX); });
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
