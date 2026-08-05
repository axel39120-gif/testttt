/* =====================================================================
 * 82-simulation-simplifiee.js — LA COURSE SANS PNEUS NI STRATÉGIE
 *
 * POURQUOI
 * --------
 * Quinze modules écrivaient dans le score de course et huit enveloppaient
 * la boucle tickRace, chacun corrigeant le calibrage du précédent. Les
 * incohérences observées (positions instables, poleman relégué, classement
 * d'endurance faussé) ne venaient pas d'un bug isolé mais de cet empilement.
 *
 * On retire donc les deux couches les plus coûteuses en complexité et les
 * plus génératrices d'effets croisés : le MODÈLE DE PNEUS et la STRATÉGIE.
 *
 * CE QUI DISPARAÎT DE LA SIMULATION
 *   · usure des pneus, gommes, modes de conduite (push / manage) ;
 *   · écran et modèle de stratégie, stratégie réactive des rivaux ;
 *   · la variance de course pilotée par la stratégie, remplacée par une
 *     variance unique et bornée.
 *
 * CE QUI RESTE, ET POURQUOI
 *   · LES ARRÊTS AU STAND, en narratif : ils gardent leur effet de perte
 *     de position — pour le joueur ET pour les rivaux, qui ne s'arrêtaient
 *     jusqu'ici que par le biais de la stratégie IA qu'on supprime. Sans
 *     cet ajout, le joueur aurait été le seul à payer son passage.
 *   · LES ÉVÉNEMENTS DE COURSE à choix, dont les effets sont déjà bornés.
 *   · LE MULTI-CLASSES DE L'ENDURANCE : intact. Le plateau LMP2/GT3 reste
 *     sous le rythme de la classe reine et le classement de classe fait foi.
 *   · Météo, safety car, radio, télémétrie : inchangés.
 *
 * OPTION A — aucun fichier cœur modifié. On neutralise par les variables
 * que le cœur lit déjà (stratV, _tyreMode) et par enveloppe des fonctions
 * globales concernées.
 *
 * Réversible : window._rj82Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[82-simulation]";

  /* Variance de rythme par tour, désormais unique pour tout le monde.
     C'était le rôle de stratV, qui variait selon la stratégie choisie. */
  var VARIANCE = 0.55;
  var VARIANCE_KART = 0.75;      // le karting bouge davantage, plateau serré

  function LR() { return (typeof window.LIVE_RACE !== "undefined") ? window.LIVE_RACE : null; }
  function G_() { return (typeof window.G !== "undefined") ? window.G : null; }
  function fn(n) { return typeof window[n] === "function"; }

  function estKarting() {
    var G = G_();
    return !!(G && (G.cat === "Karting Junior" || G.cat === "Karting Senior"));
  }

  /* ==================================================================
   * 1. NEUTRALISATION DU MODÈLE DE PNEUS
   *
   * Le cœur lit trois choses : _tickTyreWear (secondes perdues par tour),
   * LIVE_RACE._tyreMode (push / manage) et l'état de gomme construit par
   * 04c. On rend les trois inertes plutôt que d'arracher les modules :
   * les écrans qui les mentionnent continuent de s'afficher sans planter.
   * ================================================================== */

  var _orig = {};

  function neutraliserPneus() {
    if (fn("_tickTyreWear") && !window._tickTyreWear._rj82) {
      _orig._tickTyreWear = window._tickTyreWear;
      window._tickTyreWear = function () { return 0; };
      window._tickTyreWear._rj82 = true;
    }
    if (fn("rjUpdateTyresForLap") && !window.rjUpdateTyresForLap._rj82) {
      _orig.rjUpdateTyresForLap = window.rjUpdateTyresForLap;
      window.rjUpdateTyresForLap = function () { return null; };
      window.rjUpdateTyresForLap._rj82 = true;
    }
    if (fn("_setTyreMode") && !window._setTyreMode._rj82) {
      _orig._setTyreMode = window._setTyreMode;
      window._setTyreMode = function () { var lr = LR(); if (lr) lr._tyreMode = "normal"; };
      window._setTyreMode._rj82 = true;
    }
    /* Les indicateurs d'usure n'ont plus rien à montrer. */
    try { if (fn("_rjTyreVisualsUninstall")) window._rjTyreVisualsUninstall(); } catch (e) {}
  }

  /* ==================================================================
   * 2. NEUTRALISATION DE LA STRATÉGIE
   *
   * Le modèle de 04p est laissé en place et pré-validé : il alimente
   * encore l'état voiture et la pastille du classement, mais plus aucune
   * décision n'est demandée au joueur et ses champs ne varient plus.
   * ================================================================== */

  function validerStrategieAutomatiquement() {
    var G = G_(); if (!G) return;
    if (!G._raceStrategy) {
      G._raceStrategy = {
        startCompound: "medium", plannedStops: 1, style: "manage",
        midRaceStyleChange: false, eventTriggered: false, committed: true
      };
    }
    G._raceStrategy.committed = true;
    G._raceStrategy.style = "manage";
    G.raceStrategy = G.raceStrategy || {};
    G.raceStrategy.confirmed = true;
    G.strat = "balanced";
  }

  /* stratV pilotait l'amplitude du bruit par tour selon la stratégie.
     On l'uniformise : même variance pour tous, bornée et lisible. */
  function uniformiserVariance() {
    var lr = LR(); if (!lr || !lr.drivers) return;
    var v = estKarting() ? VARIANCE_KART : VARIANCE;
    for (var i = 0; i < lr.drivers.length; i++) {
      var d = lr.drivers[i];
      if (!d) continue;
      d.stratV = v;
    }
    lr._tyreMode = "normal";
  }

  /* L'étape de stratégie disparaît du week-end : la qualification enchaîne
     sur la course. L'onglet reste masqué plutôt que supprimé, pour ne pas
     casser les modules qui interrogent son existence. */
  function masquerEtapeStrategie() {
    try {
      var onglet = document.getElementById("race-tab-strat");
      if (onglet) onglet.style.display = "none";
      var w = window.RACE_WEEKEND_STATE;
      if (w) w.strategyDone = true;
    } catch (e) {}
  }

  /* Le sélecteur de mode de pilotage EN COURSE (Gestion / Normal / Attaque)
     agissait par le biais du mode pneus. Comme celui-ci est neutralisé, les
     boutons restaient affichés sans plus rien produire : un choix qui ne
     change rien est pire que pas de choix du tout. On les retire. */
  function masquerModeEnCourse() {
    try {
      var c = document.getElementById("tyre-mode-container");
      if (c) c.style.display = "none";
      /* Le classement enrichi (module 33) reconstruit sa propre rangée de
         modes à chaque rendu : une simple mise en display:none serait
         réécrite au tour suivant. On pose donc une règle CSS permanente. */
      if (!document.getElementById("rj82-css")) {
        var st = document.createElement("style");
        st.id = "rj82-css";
        st.textContent = ".rjdc-modes,#tyre-mode-container{display:none !important}";
        document.head.appendChild(st);
      }
    } catch (e) {}
  }

  /* L'onglet Stratégie ne doit plus pouvoir être atteint, même en forçant
     la navigation par onglets. */
  function bloquerOngletStrategie() {
    if (!fn("rtab") || window.rtab._rj82) return;
    _orig.rtab = window.rtab;
    window.rtab = function (nom) {
      if (nom === "strat") {
        validerStrategieAutomatiquement();
        return _orig.rtab.apply(this, ["course"].concat([].slice.call(arguments, 1)));
      }
      var r = _orig.rtab.apply(this, arguments);
      try { masquerEtapeStrategie(); masquerModeEnCourse(); } catch (e) {}
      return r;
    };
    window.rtab._rj82 = true;
  }

  /* ==================================================================
   * 3. LES ARRÊTS AU STAND, EN NARRATIF
   *
   * On garde l'effet qui compte — perdre des places le temps de l'arrêt,
   * puis les reprendre quand les autres s'arrêtent — sans aucune décision
   * à prendre. Les fonctions du cœur (_computePlacesLostByPit et
   * _applyPitPenaltyForTargetDrop) sont génériques : elles s'appliquent
   * aussi bien au joueur qu'à un rival.
   * ================================================================== */

  function configPit() {
    try {
      if (fn("_pitConfigForCat")) return window._pitConfigForCat();
    } catch (e) {}
    return null;
  }

  /* Fenêtre d'arrêt : autour de la mi-course, étalée pour que tout le
     monde ne rentre pas au même tour. */
  function planifierArrets() {
    var lr = LR(); if (!lr || !lr.drivers || !lr.total) return;
    var cfg = configPit();
    if (!cfg || !cfg.enabled) { lr._rj82Pits = null; return; }

    var nb = Math.max(1, Math.min(2, cfg.maxStops || 1));
    var plan = {};
    for (var i = 0; i < lr.drivers.length; i++) {
      var d = lr.drivers[i];
      if (!d || d._mc) continue;                    // le trafic multi-classes ne s'arrête pas
      var tours = [];
      for (var k = 1; k <= nb; k++) {
        var centre = Math.round(lr.total * (k / (nb + 1)));
        var tour = centre + Math.round((Math.random() - 0.5) * Math.max(2, lr.total * 0.10));
        tour = Math.max(2, Math.min(lr.total - 2, tour));
        tours.push(tour);
      }
      plan[d.name] = tours;
      d._pitsDone = 0;
    }
    lr._rj82Pits = plan;
    lr._rj82PitsFaits = {};
  }

  function arretRival(d, dur) {
    try {
      var perte = fn("_computePlacesLostByPit") ? window._computePlacesLostByPit(d, dur) : 0;
      if (fn("_applyPitPenaltyForTargetDrop")) window._applyPitPenaltyForTargetDrop(d, perte, dur);
      else d.penaltySec = (d.penaltySec || 0) + dur;
      d._pitsDone = (d._pitsDone || 0) + 1;
      d._lastPitLap = LR() ? LR().cur : 0;
    } catch (e) {}
  }

  /* Le joueur doit comprendre pourquoi il vient de reculer. */
  function annoncerArret(d, dur) {
    var lr = LR();
    var texte = "Arrêt au stand — " + dur.toFixed(1) + " s immobilisé";
    try {
      if (fn("rjRadioPush")) window.rjRadioPush("ingenieur", "Tu rentres. " + texte + ".");
    } catch (e) {}
    try {
      if (lr) {
        lr.newsFeed = lr.newsFeed || [];
        lr.newsFeed.push({ lap: lr.cur, text: texte, type: "pit" });
      }
      if (window.RACE_STATE && Array.isArray(RACE_STATE.eventsLog)) {
        RACE_STATE.eventsLog.push({
          lap: lr ? lr.cur : 0, phase: "pit", text: "Arrêt au stand",
          note: texte, sign: "~", color: "#9CA3AF"
        });
      }
    } catch (e) {}
  }

  /* Le module d'arrêts automatiques appelle _playerPit, qui ouvre une
     fenêtre de choix de gomme. Sans pneus, ce choix n'a plus d'objet : on
     remplace la fonction par la voie directe, quel que soit l'appelant. */
  function neutraliserPitJoueur() {
    if (!fn("_playerPit") || window._playerPit._rj82) return;
    _orig._playerPit = window._playerPit;
    window._playerPit = function () {
      var lr = LR(); if (!lr || !lr.drivers || lr.finished) return;
      var cfg = configPit(); if (!cfg || !cfg.enabled) return;
      var p = lr.drivers.find(function (d) { return d.isPlayer; });
      if (!p || p.dnf) return;
      if ((p._pitsDone || 0) >= (cfg.maxStops || 2)) return;
      var dur = (cfg.stopTimeMin || 2.2) +
                Math.random() * ((cfg.stopTimeMax || 3.4) - (cfg.stopTimeMin || 2.2));
      arretRival(p, dur);
      annoncerArret(p, dur);
    };
    window._playerPit._rj82 = true;
  }

  function traiterArrets() {
    var lr = LR(); if (!lr || !lr.drivers || !lr._rj82Pits || lr.finished) return;
    var cfg = configPit(); if (!cfg || !cfg.enabled) return;
    var tour = lr.cur;

    for (var i = 0; i < lr.drivers.length; i++) {
      var d = lr.drivers[i];
      if (!d || d.dnf || d._mc) continue;
      var tours = lr._rj82Pits[d.name];
      if (!tours || !tours.length) continue;

      for (var k = 0; k < tours.length; k++) {
        var cle = d.name + "#" + k;
        if (lr._rj82PitsFaits[cle]) continue;
        /* Un arrêt déclenché ailleurs (module d'arrêts automatiques) compte
           comme fait : on ne veut pas d'un second passage dans le même tour. */
        if ((d._pitsDone || 0) > k) { lr._rj82PitsFaits[cle] = true; continue; }
        if (tour < tours[k]) continue;
        lr._rj82PitsFaits[cle] = true;

        var dur = (cfg.stopTimeMin || 2.2) +
                  Math.random() * ((cfg.stopTimeMax || 3.4) - (cfg.stopTimeMin || 2.2));

        /* On emprunte la même voie pour tout le monde. _playerPit est
           enveloppé par le module d'arrêts automatiques, qui ouvre une
           fenêtre de choix de gomme : elle n'a plus d'objet ici, et elle
           empêchait l'arrêt du joueur d'aboutir. */
        arretRival(d, dur);
        if (d.isPlayer) annoncerArret(d, dur);
        break;                                       // un seul arrêt par tour et par pilote
      }
    }
  }

  /* ==================================================================
   * 4. BRANCHEMENT SUR LA COURSE
   * ================================================================== */

  var _origRun = null, _origTick = null, _origConfirm = null;

  function installer() {
    neutraliserPneus();
    neutraliserPitJoueur();

    if (fn("runRaceLive") && !window.runRaceLive._rj82) {
      _origRun = window.runRaceLive;
      window.runRaceLive = function () {
        validerStrategieAutomatiquement();
        var r = _origRun.apply(this, arguments);
        try {
          uniformiserVariance();
          planifierArrets();
          neutraliserPneus();
          neutraliserPitJoueur();
        } catch (e) { console.warn(TAG, "init course :", e && e.message); }
        return r;
      };
      window.runRaceLive._rj82 = true;
    }

    if (fn("tickRace") && !window.tickRace._rj82) {
      _origTick = window.tickRace;
      window.tickRace = function () {
        var r = _origTick.apply(this, arguments);
        try {
          var lr = LR();
          if (lr && !lr.finished) { lr._tyreMode = "normal"; traiterArrets(); masquerModeEnCourse(); }
        } catch (e) { console.warn(TAG, "tick :", e && e.message); }
        return r;
      };
      window.tickRace._rj82 = true;
    }

    /* La confirmation de stratégie ne demande plus rien : elle valide. */
    if (fn("confirmStrategy") && !window.confirmStrategy._rj82) {
      _origConfirm = window.confirmStrategy;
      window.confirmStrategy = function () {
        validerStrategieAutomatiquement();
        return _origConfirm.apply(this, arguments);
      };
      window.confirmStrategy._rj82 = true;
    }

    masquerEtapeStrategie();
    masquerModeEnCourse();
    bloquerOngletStrategie();
    return !!(window.runRaceLive && window.runRaceLive._rj82 && window.tickRace && window.tickRace._rj82);
  }

  function boot() {
    var essais = 0;
    (function tenter() {
      if (installer()) {
        console.log(TAG, "actif — pneus et stratégie retirés de la simulation, arrêts conservés");
        return;
      }
      if (essais++ < 80) setTimeout(tenter, 150);
      else console.warn(TAG, "installation incomplète");
    })();

    window._rj82 = {
      variance: function (v) { if (typeof v === "number") VARIANCE = v; return VARIANCE; },
      planifier: planifierArrets,
      arrets: function () { var lr = LR(); return lr ? lr._rj82Pits : null; },
      uniformiser: uniformiserVariance
    };

    window._rj82Uninstall = function () {
      if (_origRun) window.runRaceLive = _origRun;
      if (_origTick) window.tickRace = _origTick;
      if (_origConfirm) window.confirmStrategy = _origConfirm;
      Object.keys(_orig).forEach(function (k) { window[k] = _orig[k]; });
      try {
        var onglet = document.getElementById("race-tab-strat");
        if (onglet) onglet.style.display = "";
        var c = document.getElementById("tyre-mode-container");
        if (c) c.style.display = "";
        var css = document.getElementById("rj82-css");
        if (css && css.parentNode) css.parentNode.removeChild(css);
      } catch (e) {}
      console.log(TAG, "désinstallé");
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
