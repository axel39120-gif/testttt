/* =====================================================================
 * 81-moteur-course.js — LA COURSE AU CHRONOMÈTRE
 *
 * POURQUOI
 * Le classement en course était un tri par note, bridé à ±2 places par
 * tour ; les écarts n'étaient que la note × 45 et la grille dictait le
 * rythme (70 % de la note venait de la place de départ). Résultat mesuré :
 * des courses figées, des écarts qui ne se creusaient jamais, et une voiture
 * rapide partie dernière qui roulait lentement (audit du week-end, étape 6).
 *
 * LE MODÈLE
 * Chaque pilote a un temps cumulé. À chaque tour :
 *   - temps au tour = référence du circuit × (1 − K × (note − note moyenne)),
 *     plus un aléa selon sa régularité. La note (04, runRaceLive) porte le
 *     talent, la voiture, la pluie, la forme, les événements de course ;
 *   - un arrêt au stand ajoute sa durée (pénalités, module 82) ;
 *   - premier tour : décalage de la place sur la grille et temps de réaction ;
 *   - dépassement : une voiture plus rapide qui rattrape celle de devant ne
 *     passe que si son avance de rythme dépasse le seuil du circuit (facilité
 *     de dépassement de getCircuitData : Monaco 0,1, Monza 0,6) ; sinon elle
 *     reste dans l'air sale, quelques dixièmes derrière ;
 *   - safety car et drapeau rouge : le peloton se regroupe derrière le
 *     leader ; VSC : tout le monde ralentit d'autant, sans dépasser.
 * Classement = ordre des temps cumulés ; écart = vrai écart en secondes
 * (plus d'un tour de référence : tour de retard).
 *
 * Un déplacement imposé de l'extérieur (moments décisifs, 106) est traduit en
 * temps : la voiture prend place entre ses nouveaux voisins.
 *
 * Ce module porte aussi les points d'accroche « une fois par tour »
 * (RJ_LAP_HOOKS) et le recalage des notes au départ (« 81-echelle »).
 *
 * Réversible : window._rj81Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[81-moteur-course]";

  var K_RYTHME = 0.03;      // 0,1 de note = 0,3 % du temps au tour
  var GRILLE_PAS = 0.18;    // s entre deux places sur la grille au départ
  var AIR_SALE = [0.3, 0.8];// s derrière une voiture qu'on ne passe pas
  var ECART_SC = 0.6;       // s entre deux voitures derrière la safety car

  function LR() { return (typeof window.LIVE_RACE !== "undefined") ? window.LIVE_RACE : null; }

  function gauss() {
    var u = 1 - Math.random(), v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /* Avance de rythme (s/tour) qu'il faut pour doubler, selon le circuit. */
  function seuilDepassement(circuit) {
    var c = typeof getCircuitData === "function" ? getCircuitData(circuit || "") : null;
    var facilite = c && typeof c.overtake === "number" ? c.overtake : 0.35;
    return Math.max(0.2, Math.min(1.4, 0.25 + 1.6 * (0.6 - facilite)));
  }

  function regularite(d) {
    if (d.isPlayer) return (G && G.stats && typeof G.stats.regularite === "number") ? G.stats.regularite / 100 : 0.75;
    var r = (typeof d.rivalIdx === "number" && G && G.rivals && G.rivals[d.rivalIdx]) || null;
    return r && typeof r.consistency === "number" ? r.consistency : 0.8;
  }

  /* ------------------------------------------------------------------
   * Chronomètre de la course
   * ---------------------------------------------------------------- */
  function chrono(lr) {
    if (lr._chrono) return lr._chrono;
    var principaux = lr.drivers.filter(function (d) { return !d._mc && typeof d.baseScore === "number"; });
    var ref = principaux.reduce(function (s, d) { return s + d.baseScore; }, 0) / (principaux.length || 1);
    var circuit = (window.RACE_STATE && RACE_STATE.circuit) || "";
    lr._chrono = { tour: 0, ref: ref, base: lr.baseRef > 0 ? lr.baseRef : 90, seuil: seuilDepassement(circuit) };
    lr.drivers.forEach(function (d) {
      d._t = ((d.gridPos || d.pos || 99) - 1) * 1e-4;   // ordre de la grille
      d._tPen = d.penaltySec || 0;
    });
    return lr._chrono;
  }

  function rythme(d, c) { return c.base * (1 - K_RYTHME * ((d.score || 0) - c.ref)); }

  function neutralisation(lr) {
    var n = lr && lr._rjNeutral;
    return n && n.active ? (n.type || "sc") : null;
  }

  /* Un tour de course pour tout le plateau vivant. */
  function avancerUnTour(lr, c, vivants) {
    var premier = lr.cur <= 1, neutre = neutralisation(lr);
    var ordre = vivants.slice().sort(function (a, b) { return a._t - b._t; });   // ordre sur la piste
    var devant = null;
    ordre.forEach(function (d) {
      var r = rythme(d, c), tour = r + gauss() * c.base * 0.0022 * (1.25 - regularite(d));
      /* Effets d'événements du tour (secondes, posées par le cœur) : un bon choix fait gagner
         du temps, un mauvais en fait perdre, pendant leur durée. */
      var evt = d._rj81EvtSec || 0;
      if (evt) { tour += evt; d._rj81EvtSec = 0; }
      d._rj81EvtTour = evt;     // compté aussi dans le rythme qui permet de dépasser
      var pen = Math.max(0, (d.penaltySec || 0) - (d._tPen || 0));
      d._tPen = d.penaltySec || 0;
      if (neutre === "vsc") tour = c.base * 1.35;
      if (premier) tour += ((d.gridPos || d.pos || 1) - 1) * GRILLE_PAS + Math.abs(gauss()) * 0.25;
      var arrivee = d._t + tour + pen;

      /* Rattrape la voiture de devant (même tour, sur la piste) : passe-t-il ? */
      if (devant && !d._mc && !devant._mc && !pen && d._t - devant._t < c.base * 0.5 && arrivee < devant._arrivee + AIR_SALE[0]) {
        var avance = (rythme(devant, c) + (devant._rj81EvtTour || 0)) - (r + evt);
        var seuil = c.seuil * (premier ? 0.5 : 1);
        var chance = Math.min(0.8, Math.max(0, (avance - 0.03) / seuil) * 0.9);
        if (neutre === "vsc" || Math.random() >= chance) {
          arrivee = Math.max(arrivee, devant._arrivee + AIR_SALE[0] + Math.random() * (AIR_SALE[1] - AIR_SALE[0]));
        }
      }
      d._arrivee = arrivee;
      // La suivante se mesure à la voiture physiquement juste devant elle :
      // celle des deux qui passe la ligne le plus tard.
      if (!devant || d._arrivee >= devant._arrivee) devant = d;
    });
    ordre.forEach(function (d) { d._t = d._arrivee; delete d._arrivee; });

    /* Safety car / drapeau rouge : regroupement derrière le leader. */
    if (neutre === "sc" || neutre === "rf") {
      var file = vivants.filter(function (d) { return !d._mc; }).sort(function (a, b) { return a._t - b._t; });
      for (var i = 1; i < file.length; i++) file[i]._t = Math.min(file[i]._t, file[i - 1]._t + ECART_SC);
    }
  }

  /* Déplacement imposé de l'extérieur : la voiture prend place, en temps,
     entre ses nouveaux voisins. */
  function reconcilier(vivants) {
    var bouge = vivants.some(function (d) { return typeof d._rj81PosLaissee === "number" && d.pos !== d._rj81PosLaissee; });
    if (!bouge) return;
    var parPos = vivants.slice().sort(function (a, b) { return a.pos - b.pos; });
    for (var i = 0; i < parPos.length; i++) {
      var d = parPos[i];
      if (d.pos === d._rj81PosLaissee) continue;
      var avant = i > 0 ? parPos[i - 1]._t : null, apres = null;
      for (var k = i + 1; k < parPos.length; k++) if (parPos[k].pos === parPos[k]._rj81PosLaissee) { apres = parPos[k]._t; break; }
      d._t = avant === null ? (apres === null ? d._t : apres - 0.3) : apres === null || apres <= avant ? avant + 0.3 : (avant + apres) / 2;
    }
    for (var j = 1; j < parPos.length; j++) if (parPos[j]._t <= parPos[j - 1]._t) parPos[j]._t = parPos[j - 1]._t + 0.2;
  }

  /* ==================================================================
   * Attribution des positions et des écarts
   * ================================================================== */
  function attribuer(liste) {
    var lr = LR();
    /* Endurance : le trafic des catégories inférieures (_mc) reste classé
       derrière la catégorie du joueur. */
    var principaux = liste.filter(function (d) { return !d._mc; });
    if (principaux.length && principaux.length < liste.length) {
      var trafic = liste.filter(function (d) { return d._mc; });
      liste.length = 0;
      Array.prototype.push.apply(liste, principaux.concat(trafic));
    }
    var leader = liste[0];
    for (var i = 0; i < liste.length; i++) {
      var d = liste[i];
      d.pos = i + 1;
      d._rj81PosLaissee = i + 1;
      d.gap = !leader || d === leader ? 0 : parseFloat(Math.max(0, (d._t || 0) - (leader._t || 0)).toFixed(1));
    }
    if (lr && lr.drivers) {
      var suivante = liste.length + 1;
      for (var k = 0; k < lr.drivers.length; k++) if (lr.drivers[k] && lr.drivers[k].dnf) lr.drivers[k].pos = suivante++;
    }
  }

  function classement() {
    var lr = LR();
    if (!lr || !lr.drivers) return;
    var vivants = lr.drivers.filter(function (d) { return d && !d.dnf; });
    if (!vivants.length) return;
    var c = chrono(lr);
    /* Voiture ajoutée en cours d'épreuve (trafic d'endurance) : elle part
       derrière le dernier. */
    var dernier = 0;
    vivants.forEach(function (d) { if (typeof d._t === "number") dernier = Math.max(dernier, d._t); });
    vivants.forEach(function (d) { if (typeof d._t !== "number") { d._t = dernier + 1; d._tPen = d.penaltySec || 0; } });
    reconcilier(vivants);
    if ((lr.cur || 0) > c.tour) {
      for (var t = c.tour; t < lr.cur; t++) avancerUnTour(lr, c, vivants);
      c.tour = lr.cur;
    }
    vivants.sort(function (a, b) { return a._t - b._t; });
    attribuer(vivants);
    declencherHooksDeTour();
  }

  /* ------------------------------------------------------------------
   * POINT D'ACCROCHE OFFICIEL « UNE FOIS PAR TOUR »
   *   window.RJ_LAP_HOOKS.push({ id: "monModule", run: function (tour) { … } });
   * ---------------------------------------------------------------- */
  function declencherHooksDeTour() {
    var lr = LR();
    if (!lr || !Array.isArray(window.RJ_LAP_HOOKS)) return;
    if (lr._rj81DernierTour === lr.cur) return;      // une seule fois par tour
    lr._rj81DernierTour = lr.cur;
    for (var i = 0; i < window.RJ_LAP_HOOKS.length; i++) {
      var h = window.RJ_LAP_HOOKS[i];
      if (!h || typeof h.run !== "function") continue;
      try { h.run(lr.cur, lr); }
      catch (e) { console.warn(TAG, "hook de tour « " + (h.id || "?") + "» :", e && e.message); }
    }
  }

  /* ------------------------------------------------------------------
   * Recalage des notes au départ : après toutes les couches qui les
   * ajustent (04k, 55…), le meilleur est ramené à PLAFOND_NOTE et l'écart au
   * dernier resserré dans BANDE_NOTE (l'ordre ne change jamais). Les bornes
   * de chaque tour (0,97 / 0,99 dans tickRace) ne mordent plus, et le
   * chronomètre lit des écarts de rythme réalistes.
   * ---------------------------------------------------------------- */
  var PLAFOND_NOTE = 0.93, BANDE_NOTE = 0.85;
  function recalerLesNotes(pilotes) {
    var notes = pilotes.filter(function (d) { return typeof d.baseScore === "number"; }).map(function (d) { return d.baseScore; });
    if (!notes.length) return;
    var max = Math.max.apply(null, notes), min = Math.min.apply(null, notes);
    var k = max - min > BANDE_NOTE ? BANDE_NOTE / (max - min) : 1;
    if (max <= PLAFOND_NOTE && k === 1) return;
    var cible = Math.min(max, PLAFOND_NOTE);
    function recaler(v) { return cible - (max - v) * k; }
    pilotes.forEach(function (d) {
      if (typeof d.baseScore === "number") d.baseScore = recaler(d.baseScore);
      if (typeof d.score === "number") d.score = recaler(d.score);
    });
  }

  /* Le registre RJ_RACE_START_HOOKS (avant / apres la construction de la
     grille) est déclenché par runRaceLive (04-race-engine). */

  /* ==================================================================
   * Installation
   * ================================================================== */
  function installer() {
    if (typeof window.updateLivePositions !== "function") return false;
    if (!window.updateLivePositions._rj81) {
      rjInscrire("updateLivePositions", { id: "81-moteur-course:updateLivePositions", ordre: -6000, remplace: function () { classement(); } });
      window.updateLivePositions._rj81 = true;
    }
    if (!window.RJ_RACE_START_HOOKS.some(function (h) { return h && h.id === "81-echelle"; })) {
      window.RJ_RACE_START_HOOKS.push({ id: "81-echelle", ordre: 90, apres: function (lr) {
        if (lr && lr.drivers && lr.drivers.length) { recalerLesNotes(lr.drivers); delete lr._chrono; }
      } });
    }
    return true;
  }

  function boot() {
    if (!Array.isArray(window.RJ_LAP_HOOKS)) window.RJ_LAP_HOOKS = [];
    if (!Array.isArray(window.RJ_RACE_START_HOOKS)) window.RJ_RACE_START_HOOKS = [];
    var essais = 0;
    (function tenter() {
      if (installer()) { console.log(TAG, "actif — course au chronomètre"); return; }
      if (essais++ < 80) setTimeout(tenter, 150);
      else console.warn(TAG, "installation impossible (updateLivePositions introuvable)");
    })();

    window._rj81 = {
      positions: classement,
      seuil: seuilDepassement,
      hooks: function () { return window.RJ_LAP_HOOKS; },
      hooksDepart: function () { return window.RJ_RACE_START_HOOKS; }
    };
    window._rj81Uninstall = function () {
      rjDesinscrire(["81-moteur-course:"], "updateLivePositions");
      console.log(TAG, "désinstallé");
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
