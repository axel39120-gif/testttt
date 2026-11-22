/* =====================================================================
 * 00-ecran.js — LE JEU S'ADAPTE À L'APPAREIL
 *
 * POURQUOI
 * Toute l'interface est dessinée en pixels pour un téléphone tenu en
 * paysage, d'environ 852 × 393. Telle quelle, elle restait minuscule sur
 * une tablette (tuiles géantes et vides, texte de 14 px sur 10 pouces) et
 * tassée sur un petit téléphone (640 × 360 : libellés coupés).
 *
 * CE QUE FAIT LE MODULE (chargé en premier, avant toute mise en page)
 *   - ÉCHELLE : il calcule le facteur qui fait tenir le canevas de
 *     référence (852 × 393) dans l'écran réel — plus grand sur tablette,
 *     un peu plus petit sur petit téléphone, 1 sur un téléphone courant —
 *     et l'applique par la balise viewport : tout le jeu (texte, cartes,
 *     circuits, toucher) grandit ou rétrécit d'un bloc, sans flou ni
 *     décalage des appuis. Bornes : 0,78 à 2.
 *   - Il recalcule à chaque rotation ou changement de taille (écran
 *     pliable, multi-fenêtre, tablette tournée).
 *   - CLASSE : html[data-appareil] = petit | telephone | tablette, et
 *     --rj-echelle, pour les rares réglages propres à un format.
 *   - ENCOCHE : l'application Android (MainActivity) transmet les zones
 *     occupées par l'encoche ou le poinçon de la caméra (en dp) ; elles
 *     deviennent --rj-enc-g / -d / -h / -b, que paysage.css réserve en plus
 *     des zones sûres du navigateur.
 * Sur ordinateur (souris), le navigateur ignore la balise viewport : rien
 * ne change.
 *
 * API : window.RJEcran = { appliquer(), etat(), encoche({g,d,h,b}) }.
 * =================================================================== */
(function () {
  "use strict";

  var REF_L = 852, REF_H = 393;          // canevas de référence (téléphone en paysage)
  var MIN = 0.78, MAX = 2;
  var etatCourant = null, encocheDp = { g: 0, d: 0, h: 0, b: 0 };

  function meta() {
    var m = document.querySelector('meta[name="viewport"]');
    if (!m) { m = document.createElement("meta"); m.name = "viewport"; document.head.appendChild(m); }
    return m;
  }

  /* Taille de l'écran en pixels CSS à l'échelle 1, dans l'orientation actuelle. */
  function ecranBrut() {
    var sw = screen.width || innerWidth, sh = screen.height || innerHeight;
    var long = Math.max(sw, sh), court = Math.min(sw, sh);
    var paysage = window.matchMedia ? matchMedia("(orientation: landscape)").matches : innerWidth >= innerHeight;
    return { l: paysage ? long : court, h: paysage ? court : long, paysage: paysage };
  }

  function calculer() {
    var e = ecranBrut();
    // le jeu se joue en paysage (en portrait il se dessine pivoté) : on raisonne sur le côté long et le côté court
    var long = Math.max(e.l, e.h), court = Math.min(e.l, e.h);
    var s = Math.min(court / REF_H, long / REF_L);
    s = Math.max(MIN, Math.min(MAX, s));
    s = Math.round(s * 1000) / 1000;
    var tactile = !!(window.Capacitor || (window.matchMedia && matchMedia("(pointer: coarse)").matches));
    var appareil = !tactile ? "ordinateur" : court >= 600 ? "tablette" : (long < 760 || court < 370) ? "petit" : "telephone";
    return { echelle: s, appareil: appareil, ecran: e, logique: { l: Math.round(e.l / s), h: Math.round(e.h / s) } };
  }

  function appliquer() {
    var c = calculer();
    var contenu = "width=" + c.logique.l + ", initial-scale=" + c.echelle + ", minimum-scale=" + c.echelle +
      ", maximum-scale=" + c.echelle + ", user-scalable=no, viewport-fit=cover";
    var m = meta();
    if (m.getAttribute("content") !== contenu) m.setAttribute("content", contenu);
    var r = document.documentElement;
    r.setAttribute("data-appareil", c.appareil);
    r.style.setProperty("--rj-echelle", String(c.echelle));
    etatCourant = c;
    poserEncoche();
    return c;
  }

  /* Zones d'encoche reçues de l'application (dp) → pixels CSS du jeu mis à l'échelle. */
  function poserEncoche() {
    var s = (etatCourant && etatCourant.echelle) || 1, r = document.documentElement;
    ["g", "d", "h", "b"].forEach(function (k) { r.style.setProperty("--rj-enc-" + k, ((encocheDp[k] || 0) / s).toFixed(1) + "px"); });
  }
  function encoche(z) {
    if (!z) return;
    ["g", "d", "h", "b"].forEach(function (k) { if (typeof z[k] === "number" && isFinite(z[k])) encocheDp[k] = Math.max(0, z[k]); });
    poserEncoche();
  }

  var attente = null;
  function plusTard() { clearTimeout(attente); attente = setTimeout(appliquer, 120); }

  window.RJEcran = { appliquer: appliquer, etat: function () { return etatCourant; }, encoche: encoche, REF: { l: REF_L, h: REF_H } };
  appliquer();
  window.addEventListener("resize", plusTard);
  window.addEventListener("orientationchange", function () { setTimeout(appliquer, 250); });
  if (window.screen && screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener("change", function () { setTimeout(appliquer, 250); });
})();
