/* =====================================================================
 * 55-race-balance.js — ÉQUILIBRAGE COURSE : ÉVÉNEMENTS & PLATEAU D'ENTRÉE
 *
 * Deux déséquilibres mesurés en simulation réelle (karting, plateau de 20) :
 *
 * A. LES ÉVÉNEMENTS FONT TROP GAGNER DE PLACES
 *    Chaque choix réussi ajoute définitivement 0,4 × mod au « score » de
 *    performance du pilote, sans aucun plafond cumulé sur la course. Or les
 *    scores du plateau s'étalent sur ~0,42 pour 20 pilotes, soit ~0,022 de
 *    score par place : +0,02 de bonus = 1 place gagnée, et 4 événements
 *    suffisaient à passer de P20 à P1 dès le tour 8.
 *    -> On plafonne l'effet des événements : par événement, et surtout en
 *       CUMULÉ sur la course. Un week-end bien géré rapporte quelques places,
 *       pas la victoire depuis le fond de grille. Les erreurs coûtent un peu
 *       plus cher que les réussites ne rapportent (asymétrie réaliste).
 *
 * B. LE DÉBUTANT EST SOUS TOUT LE PLATEAU EN KARTING
 *    Un pilote qui débute a une note ~47-48, alors que le plateau Karting
 *    Junior tourne autour de 51,8 de moyenne (45 à 57). Résultat mesuré sur
 *    300 qualifications : médiane P14/20, 27 % du temps dans les 3 derniers,
 *    8 % seulement dans le top 5 — aucune marge pour se battre en qualif.
 *    -> On recentre le plateau des catégories d'entrée sur le niveau d'un
 *       débutant, en conservant l'écart entre les pilotes (donc la hiérarchie
 *       et les écarts de talent). Le débutant se retrouve en milieu de grille
 *       et sa progression le fait réellement remonter le classement.
 *
 * Les deux réglages sont regroupés dans TUNING ci-dessous pour être ajustés
 * facilement. Réversible : window._rj55Uninstall() (restaure les notes).
 * =================================================================== */
(function () {
  "use strict";

  var TUNING = {
    // A. plafonds d'impact des événements, en points de « score »
    evtMaxPerGain: 0.018,   // gain max d'un seul événement  (~1 place)
    evtMaxPerLoss: 0.030,   // perte max d'un seul événement (~1,5 place)
    evtMaxRaceGain: 0.045,  // gain cumulé max sur la course (~2 places)
    evtMaxRaceLoss: 0.090,  // perte cumulée max sur la course (~4 places)

    // B. niveau moyen visé pour le plateau des catégories d'entrée
    fieldTargets: {
      "Karting Junior": 47.5,
      "Karting Senior": 50.0
    }
  };

  // ---------------------------------------------------------------- utils
  function playerDriver() {
    try {
      if (typeof LIVE_RACE === "undefined" || !LIVE_RACE || !LIVE_RACE.drivers) return null;
      for (var i = 0; i < LIVE_RACE.drivers.length; i++) {
        if (LIVE_RACE.drivers[i].isPlayer) return LIVE_RACE.drivers[i];
      }
    } catch (e) {}
    return null;
  }

  // ------------------------------------------- A. plafond des événements
  // IMPORTANT : à chaque tour le moteur recalcule
  //     score = baseScore + eventScoreOffset + bruit
  // Plafonner "score" ne sert donc à rien (il est écrasé au tour suivant) :
  // le canal PERSISTANT des événements est eventScoreOffset, que le moteur
  // ne borne qu'à ±0,10 — soit ~4 à 5 places gagnées d'affilée. On le borne
  // ici à un budget de course beaucoup plus serré.
  function clampEventEffect(offsetBefore) {
    var p = playerDriver();
    if (!p) return;
    if (typeof p.eventScoreOffset !== "number") return;

    var before = (typeof offsetBefore === "number") ? offsetBefore : 0;
    var delta = p.eventScoreOffset - before;

    // plafond par événement
    if (delta > TUNING.evtMaxPerGain) delta = TUNING.evtMaxPerGain;
    if (delta < -TUNING.evtMaxPerLoss) delta = -TUNING.evtMaxPerLoss;

    var val = before + delta;
    // plafond cumulé sur la course
    if (val > TUNING.evtMaxRaceGain) val = TUNING.evtMaxRaceGain;
    if (val < -TUNING.evtMaxRaceLoss) val = -TUNING.evtMaxRaceLoss;

    p.eventScoreOffset = val;
    // on réaligne aussi le score courant pour éviter un à-coup visuel d'un tour
    if (typeof p.baseScore === "number") {
      p.score = Math.min(.97, Math.max(.03, p.baseScore + val));
    }
  }

  // ------------------- C. alignement du rythme du joueur sur son niveau réel
  // Le score de course du joueur reçoit un "bonus de catégorie" (0,040 en
  // Karting Junior, jusqu'à 0,420 en F1) dont les rivaux n'ont AUCUN
  // équivalent (leur terme de catégorie vaut 0,02 × rang de catégorie).
  // Résultat mesuré : note réelle du débutant 0,4725 (sous la moyenne rivale
  // 0,4833, cohérent avec sa qualif) mais score de course 0,5108 -> il roule
  // comme un top 3 alors qu'il se qualifie au milieu. On retire cet écart
  // pour que la grille et le rythme racontent la même histoire.
  var CAT_BONUS = {
    "Karting Junior": .040, "Karting Senior": .100, "Formule 4": .180,
    "Formula Regional": .260, "Formule 3": .300, "Formule 2": .360,
    "Formule 1": .420, "Super Formula": .340, "Endurance WEC": .340, "IndyCar": .300
  };
  var CAT_IDX = {
    "Karting Junior": 0, "Karting Senior": 1, "Formule 4": 2, "Formula Regional": 3,
    "Formule 3": 4, "Formule 2": 5, "Formule 1": 6, "Super Formula": 4,
    "Endurance WEC": 4, "IndyCar": 5
  };

  function alignPlayerPace() {
    try {
      var p = playerDriver();
      if (!p || p._rj55Aligned) return;
      var cb = CAT_BONUS[G.cat];
      if (typeof cb !== "number") { p._rj55Aligned = true; return; }
      var exp = Math.min(0.05, (G.races ? G.races.length : 0) * 0.002);
      var catCorr = (cb - exp) - 0.02 * (CAT_IDX[G.cat] || 0);

      var others = (LIVE_RACE.drivers || []).filter(function (d) { return !d.isPlayer; });
      if (!others.length) { p._rj55Aligned = true; return; }

      // Niveau réel du joueur, sur la même échelle que le "skill" des rivaux.
      var rating = (typeof computeRacePerformanceScore === "function")
        ? computeRacePerformanceScore() : null;
      if (typeof rating !== "number") { p._rj55Aligned = true; return; }

      // Ancrage sur le peloton RÉELLEMENT construit pour cette course : on
      // compare les notes (échelle skill) et les scores de course effectifs,
      // car les rivaux perdent eux aussi quelques centièmes en route.
      var sumR = 0, nR = 0;
      (G.rivals || []).forEach(function (r) {
        if (typeof r.skill === "number") { sumR += r.skill / 100; nR++; }
      });
      var sumB = 0, nB = 0;
      others.forEach(function (d) {
        if (typeof d.baseScore === "number") { sumB += d.baseScore; nB++; }
      });
      if (!nR || !nB) { p._rj55Aligned = true; return; }
      var fieldRating = sumR / nR;
      var fieldBase = sumB / nB;

      // Ce que les bonus contextuels (réglages, stratégie, forme, grille…)
      // apportent au joueur : on le conserve, c'est le levier de jeu.
      var context = p.baseScore - rating - catCorr;

      // Le joueur se place par rapport au peloton selon son écart de niveau réel.
      var target = fieldBase + (rating - fieldRating) + context;
      if (typeof p.baseScore === "number") p.baseScore = Math.min(.97, Math.max(.03, target));
      if (typeof p.score === "number") p.score = Math.min(.97, Math.max(.03, target));

      // Variance de rythme : le joueur oscillait ~1,4x plus que les rivaux.
      // Sur un plateau de 20, la plus grosse variance gagne trop souvent (on
      // tire le maximum d'une loterie plus large). On la ramène au niveau du
      // peloton, tolérance +10 %.
      try {
        var others = (LIVE_RACE.drivers || []).filter(function (d) { return !d.isPlayer; });
        if (others.length && typeof p.stratV === "number") {
          var sum = 0, k = 0;
          others.forEach(function (d) { if (typeof d.stratV === "number") { sum += d.stratV; k++; } });
          if (k) {
            var cap = (sum / k) * 1.10;
            if (p.stratV > cap) p.stratV = cap;
          }
        }
      } catch (e) {}

      p._rj55Aligned = true;
    } catch (e) {}
  }

  var wrapped = {};
  function wrapResolver(name) {
    if (typeof window[name] !== "function") return false;
    if (window[name]._rj55) return true;
    var orig = window[name];
    var fn = function () {
      var p = playerDriver();
      var before = (p && typeof p.eventScoreOffset === "number") ? p.eventScoreOffset : 0;
      var r = orig.apply(this, arguments);
      try { clampEventEffect(before); } catch (e) {}
      return r;
    };
    fn._rj55 = true;
    fn._rj55Orig = orig;
    window[name] = fn;
    wrapped[name] = orig;
    return true;
  }

  // ------------------------------ B. recentrage du plateau d'entrée
  function calibrateField() {
    try {
      if (typeof G === "undefined" || !G || !G.rivals || !G.rivals.length) return;
      var target = TUNING.fieldTargets[G.cat];
      if (typeof target !== "number") return;

      // déjà calibré pour ce plateau ?
      var pending = false;
      for (var i = 0; i < G.rivals.length; i++) {
        if (!G.rivals[i]._rj55Cal) { pending = true; break; }
      }
      if (!pending) return;

      var sum = 0, n = 0;
      G.rivals.forEach(function (r) {
        if (typeof r.skill === "number") { sum += r.skill; n++; }
      });
      if (!n) return;
      var mean = sum / n;
      var delta = target - mean;

      G.rivals.forEach(function (r) {
        if (typeof r.skill !== "number") return;
        if (typeof r._rj55Before !== "number") r._rj55Before = r.skill;
        // décalage uniforme : l'écart entre pilotes (donc la hiérarchie) est conservé
        r.skill = Math.max(25, Math.min(95, r._rj55Before + delta));
        r._rj55Cal = true;
      });
      console.log("[55-race-balance] plateau " + G.cat + " recentré : moyenne " +
                  mean.toFixed(1) + " -> " + target.toFixed(1));
    } catch (e) {}
  }

  // recalibrer aussi quand un nouveau plateau est généré (nouvelle saison,
  // changement de catégorie) : initRaceState est appelé à l'entrée du week-end.
  function wrapInitRaceState() {
    if (typeof window.initRaceState !== "function") return false;
    if (window.initRaceState._rj55) return true;
    var orig = window.initRaceState;
    var fn = function () {
      var r = orig.apply(this, arguments);
      try { calibrateField(); } catch (e) {}
      return r;
    };
    fn._rj55 = true;
    wrapped.initRaceState = orig;
    window.initRaceState = fn;
    return true;
  }

  function wrapRunRaceLive() {
    if (typeof window.runRaceLive !== "function") return false;
    if (window.runRaceLive._rj55) return true;
    var orig = window.runRaceLive;
    var fn = function () {
      var r = orig.apply(this, arguments);
      try { alignPlayerPace(); } catch (e) {}
      return r;
    };
    fn._rj55 = true;
    wrapped.runRaceLive = orig;
    window.runRaceLive = fn;
    return true;
  }

  // ---------------------------------------------------------------- boot
  var tries = 0;
  function boot() {
    var a = wrapResolver("resolveRaceEvt");
    var b = wrapResolver("resolveLiveEvent");
    var c = wrapInitRaceState();
    var d = wrapRunRaceLive();
    calibrateField();
    if (a && c && d) {
      console.log("[55-race-balance] actif — impact des événements plafonné, plateau d'entrée recentré");
      return;
    }
    if (tries++ < 80) setTimeout(boot, 80);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj55Uninstall = function () {
    Object.keys(wrapped).forEach(function (k) { window[k] = wrapped[k]; });
    try {
      (G.rivals || []).forEach(function (r) {
        if (typeof r._rj55Before === "number") r.skill = r._rj55Before;
        delete r._rj55Cal; delete r._rj55Before;
      });
    } catch (e) {}
    console.log("[55-race-balance] désinstallé");
  };
  window._rj55Tuning = TUNING;
})();
