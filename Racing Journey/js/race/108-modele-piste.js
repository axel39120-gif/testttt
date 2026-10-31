/* =====================================================================
 * 108-modele-piste.js — OÙ EST CHAQUE VOITURE SUR LA PISTE
 *
 * POURQUOI
 * Le moteur classe les voitures au score : il sait qui est devant, et de
 * combien de secondes, mais pas où chacun se trouve sur le circuit. Une vue
 * de course en direct (points qui avancent, dépassent, s'arrêtent au stand)
 * a besoin d'une position continue.
 *
 * CE QUE LE MODULE FOURNIT — sans rien changer à la course
 *   RJModelePiste.etat(maintenant?) → {
 *     tour, total, tempsTour (s), fini,
 *     voitures: [{ nom, pos, joueur, abandon, autreCategorie, auStand,
 *                  distance }]          // en tours fractionnaires
 *   }
 * distance = tours bouclés par le leader − écart au leader / temps au tour,
 * plus l'avancée dans le tour en cours, interpolée d'après le rythme réel
 * des tours : l'affichage peut donc animer en continu entre deux tours.
 * Pour placer un point : getCircuitData(RACE_STATE.circuit).path (SVG) et
 * getPointAtLength((distance % 1) × longueur du tracé).
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[108-piste]";
  var rythme = { debut: 0, duree: 0, tour: -1 };   // durée réelle du dernier tour, en ms

  function LR() { return (typeof window.LIVE_RACE !== "undefined") ? window.LIVE_RACE : null; }

  function surTour(tour) {
    var t = Date.now();
    if (rythme.tour >= 0 && tour === rythme.tour + 1) rythme.duree = t - rythme.debut;
    rythme.debut = t;
    rythme.tour = tour;
  }

  function etat(maintenant) {
    var lr = LR();
    if (!lr || !lr.drivers || !lr.drivers.length) return null;
    var tempsTour = lr.baseRef > 0 ? lr.baseRef : 90;
    var tour = lr.cur || 0;
    // Avancée dans le tour en cours (0 → 1), d'après la durée réelle du précédent.
    var fraction = 0;
    if (!lr.finished && !lr.paused && rythme.duree > 0 && rythme.tour === tour) {
      fraction = Math.min(0.999, ((maintenant || Date.now()) - rythme.debut) / rythme.duree);
    }
    var voitures = lr.drivers.map(function (d) {
      var retard = Math.max(0, d.gap || 0) / tempsTour;
      return {
        nom: d.name,
        pos: d.pos,
        joueur: !!d.isPlayer,
        abandon: !!d.dnf,
        autreCategorie: !!d._mc,
        auStand: !d.dnf && d._lastPitLap === tour,
        distance: d.dnf ? null : Math.max(0, tour + fraction - retard)
      };
    });
    /* Le moteur borne les changements de place (±2 par tour) mais calcule
       l'écart au score : une voiture affichée devant peut avoir un écart
       plus grand. À l'écran, les points doivent suivre le classement : dans
       chaque catégorie, la distance décroît avec la position. */
    [false, true].forEach(function (autre) {
      var L = voitures.filter(function (v) { return !v.abandon && v.autreCategorie === autre; })
                      .sort(function (a, b) { return a.pos - b.pos; });
      for (var i = 1; i < L.length; i++) {
        if (L[i].distance > L[i - 1].distance - 0.002) L[i].distance = Math.max(0, L[i - 1].distance - 0.002);
      }
    });
    return { tour: tour, total: lr.total || 0, tempsTour: tempsTour, fini: !!lr.finished, voitures: voitures };
  }

  function boot() {
    if (!Array.isArray(window.RJ_LAP_HOOKS) || !Array.isArray(window.RJ_RACE_START_HOOKS)) return setTimeout(boot, 100);
    if (!window.RJ_LAP_HOOKS.some(function (h) { return h && h.id === "108-piste"; })) {
      window.RJ_LAP_HOOKS.push({ id: "108-piste", run: function (tour) { surTour(tour); } });
      window.RJ_RACE_START_HOOKS.push({ id: "108-piste", apres: function () { rythme = { debut: Date.now(), duree: 0, tour: 0 }; } });
    }
    window.RJModelePiste = { etat: etat };
    window._rj108Uninstall = function () {
      ["RJ_LAP_HOOKS", "RJ_RACE_START_HOOKS"].forEach(function (r) {
        window[r] = window[r].filter(function (h) { return !(h && h.id === "108-piste"); });
      });
      delete window.RJModelePiste;
    };
    console.log(TAG, "actif — position continue de chaque voiture (RJModelePiste.etat)");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
