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
      rjInscrire("_tickTyreWear", { id: "82-simulation-simplifiee:_tickTyreWear", ordre: -6100, remplace: function (args, suite) { return 0; } });
      window._tickTyreWear._rj82 = true;
    }
    if (fn("rjUpdateTyresForLap") && !window.rjUpdateTyresForLap._rj82) {
      _orig.rjUpdateTyresForLap = window.rjUpdateTyresForLap;
      window.rjUpdateTyresForLap = function () { return null; };
      window.rjUpdateTyresForLap._rj82 = true;
    }
    if (fn("_setTyreMode") && !window._setTyreMode._rj82) {
      _orig._setTyreMode = window._setTyreMode;
      rjInscrire("_setTyreMode", { id: "82-simulation-simplifiee:_setTyreMode", ordre: -6100, remplace: function (args, suite) { var lr = LR(); if (lr) lr._tyreMode = "normal"; } });
      window._setTyreMode._rj82 = true;
    }
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
    if (!Array.isArray(window.RJ_RACE_TAB_HOOKS)) window.RJ_RACE_TAB_HOOKS = [];
    if (window.RJ_RACE_TAB_HOOKS.some(function (h) { return h && h.id === "82-strategie"; })) return;
    window.RJ_RACE_TAB_HOOKS.push({
      id: "82-strategie",
      redirige: function (nom) {
        if (nom === "strat") { validerStrategieAutomatiquement(); return "course"; }
      },
      apres: function () { masquerEtapeStrategie(); masquerModeEnCourse(); }
    });
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

    /* Certaines catégories sont annoncées « avec stands » mais ne prévoient
       aucun arrêt (la Formule 3 a maxStops à 0) : il ne faut pas leur en
       inventer un. */
    if (!(cfg.maxStops > 0)) { lr._rj82Pits = null; return; }
    var nb = Math.max(1, Math.min(2, cfg.maxStops));
    var plan = {};
    for (var i = 0; i < lr.drivers.length; i++) {
      var d = lr.drivers[i];
      if (!d || d._mc) continue;                    // le trafic multi-classes ne s'arrête pas
      var tours = [];
      for (var k = 1; k <= nb; k++) {
        var centre = Math.round(lr.total * (k / (nb + 1)));
        /* Étalement large : avec une fenêtre étroite, tous les rivaux
           rentraient au même tour et le fil de direct se remplissait de
           cinq « untel entre aux stands » identiques. */
        var tour = centre + Math.round((Math.random() - 0.5) * Math.max(4, lr.total * 0.30));
        tour = Math.max(2, Math.min(lr.total - 2, tour));
        tours.push(tour);
      }
      plan[d.name] = tours;
      d._pitsDone = 0;
    }
    lr._rj82Pits = plan;
    lr._rj82PitsFaits = {};
    lr._rj82Types = {};
    lr._rj82Mouille = pisteMouillee();
  }

  function pisteMouillee() {
    var w = window.RACE_STATE && RACE_STATE.weather && RACE_STATE.weather.id;
    return w === "wet" || w === "storm";
  }

  /* La météo bascule (sec ↔ mouillé) : toute l'écurie rappelle ses pilotes
     dans les trois tours, pour tout le monde. Un arrêt prévu tout près est
     fusionné avec celui-ci. */
  function arretsMeteo(mouille) {
    var lr = LR(); if (!lr || !lr._rj82Pits) return;
    for (var i = 0; i < lr.drivers.length; i++) {
      var d = lr.drivers[i];
      if (!d || d.dnf || d._mc) continue;
      var tours = lr._rj82Pits[d.name] || (lr._rj82Pits[d.name] = []);
      var fait = d._pitsDone || 0, tour = Math.min(lr.total - 1, lr.cur + 1 + Math.floor(Math.random() * 3));
      if (tour <= lr.cur) continue;
      var restants = tours.slice(fait).filter(function (t) { return Math.abs(t - tour) > 4; });
      var nouveaux = tours.slice(0, fait).concat(restants, [tour]).sort(function (a, b) { return a - b; });
      lr._rj82Pits[d.name] = nouveaux;
      for (var k = fait; k < nouveaux.length; k++) delete lr._rj82PitsFaits[d.name + "#" + k];
      lr._rj82Types[d.name + "#" + nouveaux.indexOf(tour)] = mouille ? "pluie" : "slicks";
    }
  }

  /* Un arrêt coûte sa durée, en secondes, à tout le monde. L'ancienne
     pénalité visait un nombre de places à perdre d'après l'ordre du moment :
     deux arrêts identiques ne coûtaient pas la même chose, et l'arrivée
     dépendait de qui s'arrêtait quand (audit du week-end, étape 6). */
  function arretRival(d, dur) {
    try {
      d.penaltySec = (d.penaltySec || 0) + dur;
      d._pitsDone = (d._pitsDone || 0) + 1;
      d._lastPitLap = LR() ? LR().cur : 0;
    } catch (e) {}
  }

  /* Le joueur doit comprendre pourquoi il vient de reculer : l'ingénieur
     l'appelle au stand, comme à la radio d'une vraie course. */
  function annoncerArret(d, dur, type) {
    var lr = LR();
    var pneus = type === "pluie" ? "Pneus pluie." : type === "slicks" ? "On repasse en slicks." :
      type === "gardes" ? "On garde les pneus, ravitaillement seulement." : "On change les pneus.";
    var texte = "Arrêt au stand — " + (type === "gardes" ? "pneus conservés" : type === "pluie" ? "pneus pluie" : type === "slicks" ? "slicks" : "pneus neufs") +
      " · " + dur.toFixed(1) + " s immobilisé";
    try {
      if (fn("rjRadioPush")) window.rjRadioPush("ingenieur", "Box, box ! " + pneus);
    } catch (e) {}
    try {
      if (lr) {
        lr.newsFeed = lr.newsFeed || [];
        lr.newsFeed.push({ lap: lr.cur, text: texte, type: "pit" });
      }
      if (window.RACE_STATE && Array.isArray(RACE_STATE.eventsLog)) {
        /* L'écran de résultat lit e.choice.substring sans garde : une
           entrée sans ce champ y provoquait « showResult failed ». */
        RACE_STATE.eventsLog.push({
          lap: lr ? lr.cur : 0, phase: "pit", text: "Arrêt au stand",
          choice: "Arrêt au stand", note: texte, sign: "~", color: "#9CA3AF"
        });
      }
    } catch (e) {}
  }

  /* Les arrêts sont décidés par le muret, jamais par le joueur : le bouton
     « Box » disparaît, et toute demande d'arrêt (bouton, choix d'un
     événement, texte d'un choix) est ignorée. Le plan (planifierArrets,
     arretsMeteo) fait rentrer tout le monde, joueur compris. */
  function neutraliserPitJoueur() {
    if (fn("_playerPit") && !window._playerPit._rj82) {
      _orig._playerPit = window._playerPit;
      rjInscrire("_playerPit", { id: "82-simulation-simplifiee:_playerPit", ordre: -6100, remplace: function () { return; } });
      window._playerPit._rj82 = true;
    }
    if (fn("renderPitButton") && !window.renderPitButton._rj82) {
      rjInscrire("renderPitButton", { id: "82-simulation-simplifiee:renderPitButton", ordre: -6100, remplace: function () {
        var b = document.getElementById("pit-button-container"); if (b) b.remove();
      } });
      window.renderPitButton._rj82 = true;
    }
    var b = document.getElementById("pit-button-container"); if (b) b.remove();
  }

  /* Une quinzaine d'événements (Safety Car, VSC, undercut, météo…) proposaient
     de rentrer au stand. Juste avant l'affichage, on retire ces choix ; un
     événement qui ne parle que d'arrêt est sauté ; la Safety Car et la VSC
     gardent des choix de pilotage pour la relance. */
  var CHOIX_ARRET = /pit|\bbox\b|stand|undercut|rentrer|pneus neufs|gommes? neuves|changer de pneus|ravitaill|attendre un tour|overcut|s'arr[eê]ter|rester en piste|rester dehors/i;
  var SUJET_ARRET = /undercut|overcut|mur des stands|fenêtre (d'arrêt|pit)|stratégie pit/i;
  function texte(x) { try { return typeof x === "function" ? String(x()) : String(x || ""); } catch (e) { return ""; } }
  function sansArret(ev) {
    if (!ev || !Array.isArray(ev.choices)) return ev;
    var garde = ev.choices.filter(function (c) {
      return c && !c._doPit && c._weatherStrategy !== "pit" && !CHOIX_ARRET.test(texte(c.text || c.label));
    });
    if (garde.length === ev.choices.length) return ev;
    var neutralisation = /\[(SC|VSC)\]/.test(ev.icon || "") || /safety|vsc/i.test(texte(ev.title));
    var copie = Object.assign({}, ev);
    if (neutralisation) {
      copie.desc = texte(ev.desc).replace(/[^.]*(pit|stand)[^.]*\.?/gi, "").trim() || "La course est neutralisée, le muret gère la stratégie.";
      if (garde.length < 2) garde = [
        { text: "Préparer la relance — se placer pour attaquer", mod: 0.014, chance: { fail: 0.18, failMod: -0.006, msg: "Relance manquée, on te passe." } },
        { text: "Rester concentré — garder la position", mod: 0.008 }
      ];
    } else if (garde.length < 2 || SUJET_ARRET.test(texte(ev.title) + " " + texte(ev.desc) + " " + texte(ev.text))) {
      return null;
    }
    copie.choices = garde;
    return copie;
  }
  function filtrerEvenements() {
    if (fn("showLiveEvent") && !window.showLiveEvent._rj82) {
      rjInscrire("showLiveEvent", { id: "82-simulation-simplifiee:showLiveEvent", ordre: -6100, remplace: function (args, suite) {
        var ev = sansArret(args[0]), lr = LR();
        if (!ev) { if (lr) { lr.pendingEvent = null; lr.paused = false; } return; }
        if (lr) lr.pendingEvent = ev;
        return suite([ev]);
      } });
      window.showLiveEvent._rj82 = true;
    }
    if (fn("showNextRaceEvent") && !window.showNextRaceEvent._rj82) {
      rjInscrire("showNextRaceEvent", { id: "82-simulation-simplifiee:showNextRaceEvent", ordre: -6100, remplace: function (args, suite) {
        try {
          var evs = window.RACE_STATE && RACE_STATE.events, i = window.CURRENT_EVT_IDX || 0;
          while (evs && evs[i]) {
            var ev = sansArret(evs[i]);
            if (ev) { evs[i] = ev; break; }
            evs.splice(i, 1);
          }
        } catch (e) {}
        return suite();
      } });
      window.showNextRaceEvent._rj82 = true;
    }
  }

  function traiterArrets() {
    var lr = LR(); if (!lr || !lr.drivers || !lr._rj82Pits || lr.finished) return;
    var cfg = configPit(); if (!cfg || !cfg.enabled) return;
    var tour = lr.cur;
    lr._rj82Types = lr._rj82Types || {};
    var mouille = pisteMouillee();
    if (typeof lr._rj82Mouille !== "boolean") lr._rj82Mouille = mouille;
    else if (mouille !== lr._rj82Mouille) { lr._rj82Mouille = mouille; arretsMeteo(mouille); }

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
        /* En endurance, un relais sur deux peut se faire sans changer de pneus. */
        var type = lr._rj82Types[cle] || (G.cat === "Endurance WEC" && Math.random() < 0.35 ? "gardes" : "neufs");
        if (d.isPlayer) annoncerArret(d, dur, type);
        break;                                       // un seul arrêt par tour et par pilote
      }
    }
  }

  /* ==================================================================
   * 4. BRANCHEMENT SUR LA COURSE
   * ================================================================== */

  var _origRun = null, _origTick = null, _origConfirm = null;

  function installer() {
    window.RJ_ARRETS_AUTO = true;                    // lu par 27 et 106 : plus de choix d'arrêt
    filtrerEvenements();
    neutraliserPneus();
    neutraliserPitJoueur();

    if (!window.RJ_RACE_START_HOOKS.some(function (h) { return h && h.id === "82-depart"; })) {
      window.RJ_RACE_START_HOOKS.push({ id: "82-depart", ordre: -30, avant: function () { validerStrategieAutomatiquement(); } });
      window.RJ_RACE_START_HOOKS.push({ id: "82-depart-apres", ordre: 10, apres: function () {
        uniformiserVariance();
        planifierArrets();
        neutraliserPneus();
        neutraliserPitJoueur();
      } });
    }

    /* Ce travail est celui d'un tour de course, pas du démarrage de la
       boucle : il passe par le registre de tour (module 81) au lieu
       d'envelopper tickRace. */
    if (!Array.isArray(window.RJ_LAP_HOOKS)) window.RJ_LAP_HOOKS = [];
    if (!window.RJ_LAP_HOOKS.some(function (h) { return h && h.id === "82-simulation"; })) {
      window.RJ_LAP_HOOKS.push({
        id: "82-simulation",
        run: function () {
          var lr = LR();
          if (!lr || lr.finished) return;
          lr._tyreMode = "normal";
          traiterArrets();
          masquerModeEnCourse();
        }
      });
    }

    /* La confirmation de stratégie ne demande plus rien : elle valide. */
    if (fn("confirmStrategy") && !window.confirmStrategy._rj82) {
      _origConfirm = window.confirmStrategy;
      rjInscrire("confirmStrategy", { id: "82-simulation-simplifiee:confirmStrategy", ordre: -6100, remplace: function (args, suite) {
        validerStrategieAutomatiquement();
        return suite();
      } });
      window.confirmStrategy._rj82 = true;
    }

    masquerEtapeStrategie();
    masquerModeEnCourse();
    bloquerOngletStrategie();
    /* La condition d'arrêt du boot ne doit référencer que ce qui est
       réellement installé : elle mentionnait encore tickRace, dont on est
       sorti au profit du registre de tour. Le boot ne se terminait donc
       jamais et ré-enveloppait rtab à chaque passage, jusqu'à la récursion. */
    return window.RJ_RACE_START_HOOKS.some(function (h) { return h && h.id === "82-depart"; }) &&
           window.RJ_RACE_TAB_HOOKS.some(function (h) { return h && h.id === "82-strategie"; });
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
      sansArret: sansArret, meteo: arretsMeteo,
      variance: function (v) { if (typeof v === "number") VARIANCE = v; return VARIANCE; },
      planifier: planifierArrets,
      arrets: function () { var lr = LR(); return lr ? lr._rj82Pits : null; },
      uniformiser: uniformiserVariance
    };

    window._rj82Uninstall = function () {
      rjDesinscrire(["82-simulation-simplifiee:"], "confirmStrategy");
      Object.keys(_orig).forEach(function (k) { rjDesinscrire(["82-simulation-simplifiee:"], k); });
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
