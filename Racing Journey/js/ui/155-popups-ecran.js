/* =====================================================================
 * 155-popups-ecran.js — LES FENÊTRES TIENNENT DANS L'ÉCRAN
 *
 * POURQUOI
 * Une soixantaine de fenêtres (profil d'un pilote, négociation, événements,
 * comptes rendus…) sont dessinées par des modules différents, chacun avec
 * ses tailles. Sur un téléphone tenu à l'horizontale, les plus longues
 * dépassaient la hauteur de l'écran : il fallait les faire défiler pour
 * trouver le bouton.
 *
 * CE QUE FAIT LE MODULE
 * Dès qu'une fenêtre s'ouvre ou change de contenu, il mesure ce qu'elle
 * réclame en hauteur (y compris ce qui est caché dans ses zones qui
 * défilent) et, si c'est plus que l'écran, il la réduit d'un bloc juste ce
 * qu'il faut pour qu'elle tienne entière. Il ne descend pas sous 60 % : au-delà,
 * le texte deviendrait illisible, et la fenêtre garde son défilement.
 * Il ne touche pas aux écrans du jeu (#app), seulement aux fenêtres posées
 * par-dessus.
 *
 * Réversible : window._rj155Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[155-popups]";
  var MIN = 0.6, MARGE = 12;

  /* Une fenêtre : enfant direct de <body>, fixe, visible, qui couvre l'écran. */
  function fenetres() {
    var L = [];
    [].forEach.call(document.body.children, function (e) {
      if (e.id === "app" || e.tagName === "SCRIPT" || e.tagName === "STYLE") return;
      var cs = getComputedStyle(e);
      if (cs.position !== "fixed" || cs.display === "none" || cs.visibility === "hidden") return;
      var r = e.getBoundingClientRect();
      if (r.width < innerWidth * 0.8 || r.height < innerHeight * 0.8) return;
      L.push(e);
    });
    return L;
  }

  /* La boîte : le plus grand descendant direct visible (la carte posée sur le voile). */
  function boite(f) {
    var best = null, aire = 0;
    [].forEach.call(f.children, function (c) {
      var r = c.getBoundingClientRect(), a = r.width * r.height;
      if (a > aire) { aire = a; best = c; }
    });
    return best;
  }

  /* Hauteur réclamée : la boîte, plus tout ce que cachent ses zones qui défilent. */
  function besoin(b) {
    var cache = Math.max(0, b.scrollHeight - b.clientHeight);
    [].forEach.call(b.querySelectorAll("*"), function (x) {
      if (x.clientHeight < 20) return;
      var oy = getComputedStyle(x).overflowY;
      if ((oy === "auto" || oy === "scroll") && x.scrollHeight > x.clientHeight + 2) cache = Math.max(cache, x.scrollHeight - x.clientHeight);
    });
    return b.offsetHeight + cache;   // offset : juste aussi quand le jeu est pivoté (téléphone en portrait)
  }

  function ajuster(f) {
    var b = boite(f);
    if (!b) return;
    // mesure à taille réelle, puis réduction d'un bloc si elle dépasse
    b.style.zoom = ""; b.style.maxHeight = "";
    [].forEach.call(b.querySelectorAll("[data-rj155-libre]"), function (x) { x.style.maxHeight = ""; x.removeAttribute("data-rj155-libre"); });
    var dispo = (document.body.offsetHeight || innerHeight) - 2 * MARGE, h = besoin(b);
    if (h <= dispo + 1) { b.removeAttribute("data-rj155"); return; }
    /* Les zones intérieures qui défilent sont libérées de leur limite (souvent bien plus
       basse que l'écran) : c'est la boîte entière, réduite, qui doit tenir. */
    [].forEach.call(b.querySelectorAll("*"), function (x) {
      var oy = getComputedStyle(x).overflowY;
      if ((oy === "auto" || oy === "scroll") && x.scrollHeight > x.clientHeight + 2) { x.style.maxHeight = "none"; x.setAttribute("data-rj155-libre", "1"); }
    });
    h = Math.max(b.offsetHeight, b.scrollHeight);
    // v302 : trop longue pour tenir même réduite (fiche, historique) : taille normale, lisible, et elle défile
    var z = dispo / h < MIN ? 1 : Math.floor(Math.min(1, dispo / h) * 100) / 100;
    b.style.overflowY = "";
    b.style.zoom = z === 1 ? "" : String(z);
    // la boîte occupe au plus la hauteur de l'écran ; si elle dépasse encore à 60 %, c'est elle qui défile
    b.style.maxHeight = Math.floor(dispo / z) + "px";
    if (z === 1 || getComputedStyle(b).overflowY === "visible") b.style.overflowY = "auto";
    b.setAttribute("data-rj155", String(z));
  }

  var prevu = 0;
  function plusTard() {
    if (prevu) return;
    prevu = requestAnimationFrame(function () {
      prevu = 0;
      // nos propres retouches ne doivent pas relancer la mesure (boucle sans fin)
      if (obs) obs.disconnect();
      try { fenetres().forEach(ajuster); } catch (e) { console.warn(TAG, e && e.message); }
      if (obs) { obs.takeRecords(); observer(); }
    });
  }

  var obs = null;
  function observer() { obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] }); }
  function boot() {
    if (!document.body) return setTimeout(boot, 50);
    obs = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var t = muts[i].target;
        // les changements à l'intérieur du jeu (#app) ne concernent pas les fenêtres
        if (t === document.body || !document.getElementById("app") || !document.getElementById("app").contains(t)) { plusTard(); return; }
      }
    });
    observer();
    addEventListener("resize", plusTard);
    window.RJFenetres = { ajuster: function () { fenetres().forEach(ajuster); } };
    window._rj155Uninstall = function () { if (obs) obs.disconnect(); removeEventListener("resize", plusTard); };
    console.log(TAG, "actif — les fenêtres tiennent dans l'écran");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
