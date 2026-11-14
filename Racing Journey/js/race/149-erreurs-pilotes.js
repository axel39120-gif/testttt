/* =====================================================================
 * 149-erreurs-pilotes.js — LES PILOTES SE TROMPENT AUSSI
 *
 * POURQUOI
 * Les retournements de course venaient d'un bruit invisible sur la note
 * (82, variance), si fort qu'un débutant gagnait au hasard. Une vraie course
 * se renverse sur des fautes : un blocage de roue, un tout-droit, un
 * tête-à-queue. On les voit, on sait qui les a commises et ce qu'elles ont
 * coûté.
 *
 * CE QUE FAIT CE MODULE
 * À chaque tour, chaque pilote en piste a une petite chance de commettre une
 * faute, plus grande s'il est peu régulier (rivaux : consistency ; joueur :
 * sa régularité). La faute coûte du temps au tour suivant, par le canal du
 * chronomètre (81, _rj81EvtSec) : le pilote perd ses places naturellement.
 * Elle est marquée sur le pilote (d._rj149) pour la vue du circuit (111 :
 * pastille qui clignote, mention dans la tour de classement) et annoncée
 * dans le bandeau du direct (145).
 *
 * Réversible : window._rj149Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[149-erreurs]";
  /* Probabilité par tour pour un pilote de régularité 0,8 (≈ 2 fautes par
     course sur un plateau de vingt). */
  var BASE = 0.006, BASE_KART = 0.009;
  var FAUTES = [
    { id: "blocage", poids: 6, perte: [0.5, 1.2], court: "BLOC", texte: ["{n} bloque une roue au freinage.", "Blocage de roue pour {n}, de la fumée et du temps perdu."], moi: ["Tu bloques une roue au freinage."] },
    { id: "large", poids: 3, perte: [1.5, 3.0], court: "LARGE", texte: ["{n} tire tout droit et coupe par l'herbe !", "Sortie large de {n}, qui reprend la piste plus loin."], moi: ["Tu tires tout droit et passes par l'herbe !"] },
    { id: "taq", poids: 1, perte: [4.0, 7.0], court: "TAQ", texte: ["Tête-à-queue de {n} ! Il repart, mais le peloton défile.", "{n} part en tête-à-queue et perd gros."], moi: ["Tête-à-queue ! Tu repars, mais le peloton défile."] }
  ];

  function LR() { return typeof window.LIVE_RACE !== "undefined" ? window.LIVE_RACE : null; }
  function court(nom) { var m = String(nom || "").trim().split(/\s+/); return m.length > 1 ? m.slice(1).join(" ") : m[0] || ""; }
  function regularite(d) {
    if (d.isPlayer) return (window.G && G.stats && typeof G.stats.regularite === "number") ? G.stats.regularite / 100 : 0.75;
    var r = (typeof d.rivalIdx === "number" && window.G && G.rivals && G.rivals[d.rivalIdx]) || null;
    return r && typeof r.consistency === "number" ? r.consistency : 0.8;
  }
  function tirer() {
    var tot = FAUTES.reduce(function (s, f) { return s + f.poids; }, 0), x = Math.random() * tot;
    for (var i = 0; i < FAUTES.length; i++) { x -= FAUTES[i].poids; if (x < 0) return FAUTES[i]; }
    return FAUTES[0];
  }

  /* Une faute commise ce tour-ci par ce pilote ? Rend la faute ou null. */
  function fauteDuTour(d, kart) {
    var p = (kart ? BASE_KART : BASE) * Math.max(0.3, (1.25 - regularite(d)) / 0.45);
    return Math.random() < p ? tirer() : null;
  }

  function surTour(tour, lr) {
    lr = lr || LR();
    if (!lr || !lr.drivers || lr.finished || !(tour > 1)) return;     // pas au départ (82 gère l'envol)
    if (lr._rjNeutral && lr._rjNeutral.active) return;                   // pas sous safety car
    var kart = /karting/i.test((window.G && G.cat) || "");
    lr.drivers.forEach(function (d) {
      if (!d || d.dnf || d._mc || d.auStand || d._pitThisLap) return;
      var f = fauteDuTour(d, kart);
      if (!f) return;
      var perte = f.perte[0] + Math.random() * (f.perte[1] - f.perte[0]);
      d._rj81EvtSec = (d._rj81EvtSec || 0) + perte;
      d._rj149 = { tour: tour, id: f.id, court: f.court, perte: perte };
      (lr._rj149 = lr._rj149 || []).push({ nom: d.name, tour: tour, id: f.id, perte: +perte.toFixed(1), joueur: !!d.isPlayer });
      try {
        if (window.RJBandeau) {
          var L = d.isPlayer ? f.moi : f.texte, t = L[Math.floor(Math.random() * L.length)].replace("{n}", court(d.name));
          RJBandeau.poser(t + " (−" + perte.toFixed(1) + " s)", d.isPlayer ? 3 : (d.pos <= 5 ? 2 : 1));
        }
      } catch (e) {}
    });
  }

  /* Faute récente (ce tour ou le précédent) : pour l'affichage. */
  function recente(d, lr) {
    lr = lr || LR();
    return !!(d && d._rj149 && lr && (lr.cur || 0) - d._rj149.tour <= 1) ? d._rj149 : null;
  }

  function boot() {
    if (!Array.isArray(window.RJ_LAP_HOOKS)) return setTimeout(boot, 100);
    if (!window.RJ_LAP_HOOKS.some(function (h) { return h && h.id === "149-erreurs"; }))
      window.RJ_LAP_HOOKS.push({ id: "149-erreurs", run: surTour });
    window._rj149 = { recente: recente, fautes: FAUTES, base: function () { return { BASE: BASE, BASE_KART: BASE_KART }; }, surTour: surTour };
    window._rj149Uninstall = function () {
      window.RJ_LAP_HOOKS = window.RJ_LAP_HOOKS.filter(function (h) { return !h || h.id !== "149-erreurs"; });
    };
    console.log(TAG, "actif");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
