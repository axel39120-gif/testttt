/* =====================================================================
 * 151-historique.js — UNE SAISON, UNE LIGNE
 *
 * POURQUOI
 * La saison est enregistrée à chaque ouverture du bilan de fin de saison
 * (showSeasonEnd → saveSeasonToHistory). Rouvert, après un retour ou un
 * rechargement, le bilan l'ajoutait de nouveau : une saison de Formule 4
 * apparaissait trois fois dans l'onglet Carrière (et comptait trois titres),
 * chez le joueur comme chez ses rivaux.
 *
 * CE QUE FAIT LE MODULE
 * Une seule ligne par saison et par catégorie, la dernière enregistrée
 * (la plus complète) : après chaque enregistrement, et au chargement d'une
 * partie (les sauvegardes existantes sont nettoyées).
 *
 * Réversible : window._rj151Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  /* Garde la DERNIÈRE ligne de chaque saison+catégorie, dans l'ordre d'origine. */
  function dedoublonner(L) {
    if (!Array.isArray(L) || L.length < 2) return 0;
    var vu = {}, garde = [];
    for (var i = L.length - 1; i >= 0; i--) {
      var h = L[i]; if (!h) continue;
      var k = h.saison + "|" + (h.cat || "");
      if (vu[k]) continue;
      vu[k] = 1; garde.unshift(h);
    }
    var retire = L.length - garde.length;
    if (retire) { L.length = 0; Array.prototype.push.apply(L, garde); }
    return retire;
  }

  function nettoyer() {
    var n = 0;
    try { if (typeof CAREER_HISTORY !== "undefined") n += dedoublonner(CAREER_HISTORY); } catch (e) {}
    try { (window.G && G.rivals || []).forEach(function (r) { if (r) n += dedoublonner(r.careerHistory); }); } catch (e) {}
    try {
      if (typeof RIVAL_CAREER_REGISTRY !== "undefined") Object.keys(RIVAL_CAREER_REGISTRY).forEach(function (k) { n += dedoublonner(RIVAL_CAREER_REGISTRY[k]); });
    } catch (e) {}
    return n;
  }

  function boot() {
    if (typeof rjInscrire !== "function" || typeof window.saveSeasonToHistory !== "function") return setTimeout(boot, 150);
    /* Avant d'enregistrer, la ligne déjà présente pour cette saison est retirée :
       les modules accrochés à l'enregistrement (Super Licence, rêves…) ne voient
       jamais la saison en double. Le plus à l'extérieur possible (ordre bas). */
    rjInscrire("saveSeasonToHistory", { id: "151-historique:saison", ordre: -99000, remplace: function (args, suite) {
      var noteFin = 0;
      try {
        var k = G.saison + "|" + (G.cat || "");
        // v302 : note figée à la première clôture — rouvrir le bilan après un entraînement ne la change plus
        (typeof CAREER_HISTORY !== "undefined" ? CAREER_HISTORY : []).forEach(function (h) { if (h && h.saison + "|" + (h.cat || "") === k && h.rating) noteFin = h.rating; });
        var hors = function (L) {
          if (!Array.isArray(L)) return;
          for (var i = L.length - 1; i >= 0; i--) if (L[i] && L[i].saison + "|" + (L[i].cat || "") === k) L.splice(i, 1);
        };
        if (typeof CAREER_HISTORY !== "undefined") hors(CAREER_HISTORY);
        (G.rivals || []).forEach(function (r) { if (r) hors(r.careerHistory); });
      } catch (e) {}
      var r = suite();
      if (noteFin) { var L = CAREER_HISTORY[CAREER_HISTORY.length - 1]; if (L && L.saison === G.saison) L.rating = noteFin; }
      nettoyer();
      return r;
    } });
    if (typeof window.loadSave === "function") rjInscrire("loadSave", { id: "151-historique:chargement", apres: function () { nettoyer(); setTimeout(nettoyer, 800); } });
    /* filet : l'onglet Carrière nettoie avant de s'afficher */
    if (typeof window.renderCareerHistory === "function") rjInscrire("renderCareerHistory", { id: "151-historique:affichage", avant: function () { nettoyer(); } });
    nettoyer();
    window._rj151 = { nettoyer: nettoyer, dedoublonner: dedoublonner };
    window._rj151Uninstall = function () { ["saveSeasonToHistory", "loadSave", "renderCareerHistory"].forEach(function (f) { rjDesinscrire(["151-historique:"], f); }); };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
