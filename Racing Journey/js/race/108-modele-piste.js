/* =====================================================================
 * 108-modele-piste.js — LA COURSE EN TEMPS RÉEL
 *
 * POURQUOI
 * Le moteur (04) résout la course tour par tour : à chaque tour, il sait
 * qui est devant et de combien de secondes. Affiché tel quel, tout bondit
 * d'un coup à chaque tour. Une course se suit en continu, comme un match
 * de Football Manager : les voitures roulent, se doublent à un endroit
 * précis du circuit, les écarts bougent à chaque instant.
 *
 * COMMENT — une horloge de course qui rejoue chaque tour
 *   - À chaque tour calculé, on relève l'instant où chaque voiture passe la
 *     ligne (temps du leader + écart, dans l'ordre du classement) : c'est
 *     son chronométrage. Un arrêt au stand ajoute une immobilisation dans
 *     l'allée des stands, au lieu de ralentir tout le tour.
 *   - L'affichage a un tour de retard sur le moteur : pendant qu'il calcule
 *     le tour k+1, on rejoue le tour k, dont on connaît déjà l'arrivée.
 *     Position, classement et écarts sont donc exacts à chaque instant, et
 *     coïncident avec ceux du moteur à chaque passage de ligne.
 *   - Avant le premier tour, les voitures attendent sur la grille, feux
 *     allumés un à un ; un dépassement se produit là où les deux voitures
 *     se croisent sur la piste.
 *
 * CE QUE LE MODULE FOURNIT
 *   RJModelePiste.etat(maintenant?) → {     (maintenant : un autre instant, en ms)
 *     tour, total, tempsTour (s), temps (s de course), fini, feux (0–5),
 *     voitures: [{ nom, pos (en direct), joueur, abandon, autreCategorie,
 *                  auStand, distance (tours), ecart (s au leader) }]
 *   }
 * Pour placer un point : getCircuitData(RACE_STATE.circuit).path (SVG) et
 * getPointAtLength((distance % 1) × longueur du tracé).
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[108-piste]";
  var GRILLE = 0.004;        // écart entre deux places sur la grille, en tours
  var ALLEE = 0.92;          // l'arrêt se fait à 92 % du tour, dans l'allée des stands
  var ESPACE = 0.15;         // deux voitures passent la ligne à 0,15 s au moins d'écart

  var course = null;         // { lr, traces: { nom: [{ t, d }] }, dernier, temps }

  function LR() { return (typeof window.LIVE_RACE !== "undefined") ? window.LIVE_RACE : null; }
  function tempsTour(lr) { return lr.baseRef > 0 ? lr.baseRef : 90; }
  function parPos(a, b) { return a.pos - b.pos; }

  function nouvelleCourse(lr) {
    var traces = {};
    [false, true].forEach(function (autre) {
      lr.drivers.filter(function (d) { return !!d._mc === autre; }).sort(parPos).forEach(function (d, i) {
        traces[d.name] = [{ t: 0, d: -i * GRILLE }];
      });
    });
    course = { lr: lr, traces: traces, dernier: 0, temps: 0 };
  }

  /* Fin du tour k : chaque voiture encore en course passe la ligne. */
  function surTour(k) {
    var lr = LR();
    if (!lr || !lr.drivers) return;
    if (!course || course.lr !== lr) nouvelleCourse(lr);
    if (course.dernier >= k) return;
    var T = tempsTour(lr);
    [false, true].forEach(function (autre) {
      var L = lr.drivers.filter(function (d) { return !d.dnf && !!d._mc === autre; }).sort(parPos);
      var tours = L.map(function (d) {
        var tr = course.traces[d.name];
        return tr ? Math.max(1, k * T + Math.max(0, d.gap || 0) - tr[tr.length - 1].t) : T;
      }).filter(function (x, i) { return L[i]._lastPitLap !== k; }).sort(function (a, b) { return a - b; });
      var normal = tours.length ? tours[tours.length >> 1] : T;       // tour médian sans arrêt
      var precedent = -Infinity;
      L.forEach(function (d) {
        var tr = course.traces[d.name] || (course.traces[d.name] = [{ t: 0, d: 0 }]);
        var depuis = tr[tr.length - 1];
        // Jamais plus vite qu'un demi-tour de référence, et l'ordre au passage est celui du classement.
        var passage = Math.max(k * T + Math.max(0, d.gap || 0), depuis.t + 0.5 * T, precedent + ESPACE);
        precedent = passage;
        // Immobilisation visible : la perte de temps mesurée, entre 12 et 25 % du tour.
        var budget = passage - depuis.t, arret = Math.min(0.25 * budget, Math.max(budget - normal, 0.12 * budget));
        if (d._lastPitLap === k) {
          var dEntree = k - 1 + ALLEE;
          var entree = depuis.t + (budget - arret) * (dEntree - depuis.d) / (k - depuis.d);
          if (dEntree > depuis.d) {
            tr.push({ t: entree, d: dEntree, stand: true });
            tr.push({ t: entree + arret, d: dEntree });
          }
        }
        tr.push({ t: passage, d: k });
      });
    });
    course.dernier = k;
  }

  /* Où en est une trace à l'instant t (interpolation linéaire). */
  function surTrace(tr, t) {
    if (t <= tr[0].t) return { d: tr[0].d, stand: false };
    for (var i = 1; i < tr.length; i++) {
      if (t <= tr[i].t) {
        var a = tr[i - 1], b = tr[i], f = (t - a.t) / ((b.t - a.t) || 1);
        return { d: a.d + (b.d - a.d) * f, stand: !!a.stand };
      }
    }
    return { d: tr[tr.length - 1].d, stand: false };
  }

  /* L'instant où une trace a atteint la distance d. */
  function instant(tr, d) {
    if (d <= tr[0].d) return tr[0].t;
    for (var i = 1; i < tr.length; i++) {
      if (d <= tr[i].d) {
        var a = tr[i - 1], b = tr[i];
        return a.t + (b.t - a.t) * ((d - a.d) / ((b.d - a.d) || 1));
      }
    }
    return tr[tr.length - 1].t;
  }

  /* Avancée dans le tour rejoué (0 → 1) : figée pendant une pause. */
  function avancee(lr, maintenant) {
    if (!lr.cur && !lr._dernierTour) return 0;
    var duree = typeof dureeTourCourse === "function" ? dureeTourCourse() : 4500;
    // après le dernier tour du premier, l'horloge continue jusqu'au dernier (04, lr._fMax)
    return Math.max(0, Math.min(lr._fMax || 1, ((maintenant || Date.now()) - (lr._dernierTour || 0)) / duree));
  }

  function etat(maintenant) {
    var lr = LR();
    if (!lr || !lr.drivers || !lr.drivers.length) return null;
    if (!course || course.lr !== lr) nouvelleCourse(lr);
    if ((lr.cur || 0) > course.dernier) surTour(lr.cur);
    var T = tempsTour(lr), total = lr.total || 0, cur = lr.cur || 0;
    var f = avancee(lr, maintenant);
    var fini = !!lr.finished || (cur >= total && f >= (lr._fMax || 1));
    // Horloge rejouée : un tour de retard sur le moteur, jamais en arrière.
    var temps = fini ? Infinity : cur === 0 ? 0 : (cur - 1 + f) * T;
    if (!fini && lr.paused) temps = course.temps;
    temps = fini ? course.temps : Math.max(course.temps, temps);
    if (!maintenant) course.temps = temps;      // une lecture à un autre instant ne déplace pas l'horloge
    var feux = cur === 0 && !fini ? Math.min(5, 1 + Math.floor(f * 5)) : 0;

    var voitures = lr.drivers.map(function (d) {
      var tr = course.traces[d.name], ici = tr ? surTrace(tr, fini ? Infinity : temps) : { d: 0, stand: false };
      return {
        nom: d.name, pos: d.pos, joueur: !!d.isPlayer, abandon: !!d.dnf, autreCategorie: !!d._mc,
        auStand: !d.dnf && ici.stand, distance: d.dnf ? null : ici.d, ecart: 0, trace: tr
      };
    });
    /* Classement en direct : l'ordre sur la piste, catégorie par catégorie.
       À l'arrivée, c'est celui du moteur. */
    [false, true].forEach(function (autre) {
      var L = voitures.filter(function (v) { return !v.abandon && v.autreCategorie === autre; });
      if (!L.length) return;
      var premier = Math.min.apply(null, L.map(function (v) { return v.pos; }));
      if (!fini) L.sort(function (a, b) { return (b.distance - a.distance) || (a.pos - b.pos); });
      else L.sort(parPos);
      var tete = L[0];
      L.forEach(function (v, i) {
        v.pos = premier + i;
        if (i && v.trace && tete.trace) {
          v.ecart = fini ? instant(v.trace, total) - instant(tete.trace, total)
            : Math.max(0, temps - instant(tete.trace, v.distance));
        }
      });
    });
    voitures.forEach(function (v) { delete v.trace; });
    var tour = fini ? total : Math.max(1, Math.min(total, cur));
    return { tour: tour, total: total, tempsTour: T, temps: fini ? total * T : temps, fini: fini, feux: feux, voitures: voitures };
  }

  function boot() {
    if (!Array.isArray(window.RJ_LAP_HOOKS) || !Array.isArray(window.RJ_RACE_START_HOOKS)) return setTimeout(boot, 100);
    if (!window.RJ_LAP_HOOKS.some(function (h) { return h && h.id === "108-piste"; })) {
      window.RJ_LAP_HOOKS.push({ id: "108-piste", run: function (tour) { surTour(tour); } });
      window.RJ_RACE_START_HOOKS.push({ id: "108-piste", apres: function () { var lr = LR(); if (lr && lr.drivers) nouvelleCourse(lr); } });
    }
    window.RJModelePiste = { etat: etat };
    window._rj108Uninstall = function () {
      ["RJ_LAP_HOOKS", "RJ_RACE_START_HOOKS"].forEach(function (r) {
        window[r] = window[r].filter(function (h) { return !(h && h.id === "108-piste"); });
      });
      delete window.RJModelePiste;
    };
    console.log(TAG, "actif — course rejouée en temps réel (RJModelePiste.etat)");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
