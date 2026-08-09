/* =====================================================================
 * 40-weekend-ajustements.js — RÉGLAGES ET CALIBRAGES DU WEEK-END
 *
 * Regroupe huit modules qui interviennent tous sur le même moment du jeu :
 * le week-end de course, de l'entrée en piste au verrouillage des onglets
 * une fois le drapeau tombé. Réglages de la voiture, vitesse de
 * simulation, calibrage du réalisme, équilibrage, confort de lecture.
 *
 * Aucun ne dépend des autres : chacun s'installe seul et se désinstalle
 * seul. Ils étaient séparés parce qu'écrits à huit moments différents.
 *
 * L'ordre de chargement d'origine est conservé, car deux fonctions sont
 * ajustées par plusieurs de ces modules — la vitesse de simulation et
 * l'initialisation de l'état de course — et le résultat dépend de qui
 * passe en dernier.
 * =================================================================== */

/* ==================================================================== *
 * Réglages — présentation des curseurs
 * (anciennement 40-setup-icons.js)
 * ==================================================================== */

(function () {
  "use strict";

  /* contenu interne SVG par clé de réglage (tracé en currentColor) */
  var PATHS = {
    aileron_av:        '<path d="M3 14h18M5 14c2-5 12-5 14 0"/>',
    aileron_ar:        '<path d="M3 10h18M5 10c2 5 12 5 14 0"/>',
    antiroulis_av:     '<path d="M5 7v10M19 7v10M5 12h14"/>',
    antiroulis_ar:     '<path d="M5 7v10M19 7v10M5 12h14"/>',
    carrossage:        '<path d="M8 4l2 16M18 4l-3 16M6 4h5M13 20h6"/>',
    suspension:        '<path d="M6 4h12M6 20h12M9 4l6 4-6 4 6 4-6 4"/>',
    pression_pneus:    '<circle cx="12" cy="12" r="8"/><path d="M12 12l4-3M12 12v4"/>',
    differentiel:      '<circle cx="12" cy="12" r="3.5"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/>',
    repartition_frein: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M16.5 6.5l-2.2 2.2"/>',
    agress_debut:      '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    agress_fin:        '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    gestion_pneus:     '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
    depassement:       '<path d="M7 8h11l-3-3M7 8l3 3M17 16H6l3-3M17 16l-3 3"/>'
  };

  function advIcon(key) {
    var p = PATHS[key];
    if (!p) return "";
    return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:6px;opacity:.8;flex:0 0 auto">' + p + "</svg>";
  }

  var _origAdvSlider = null;
  function wrapAdvSlider() {
    if (typeof window.renderAdvSlider !== "function") return false;
    if (window.renderAdvSlider._rjIcon) return true;
    _origAdvSlider = window.renderAdvSlider;
    window.renderAdvSlider = function (label, type, key) {
      var args = Array.prototype.slice.call(arguments);
      var ic = advIcon(key);
      if (ic && typeof label === "string") args[0] = ic + label;
      return _origAdvSlider.apply(this, args);
    };
    window.renderAdvSlider._rjIcon = true;
    return true;
  }

  function install() {
    if (window._rjSetupIconsInstalled) return;
    window._rjSetupIconsInstalled = true;
    var tries = 0;
    (function boot() {
      if (wrapAdvSlider()) {
        try { if (typeof window.renderAdvancedSetupUI === "function") window.renderAdvancedSetupUI(); } catch (e) {}
        return;
      }
      if (tries++ < 50 && typeof setTimeout === "function") setTimeout(boot, 150);
    })();
    window._rjSetupIcons = { advIcon: advIcon, PATHS: PATHS };
    window._rjSetupIconsUninstall = function () {
      if (_origAdvSlider) window.renderAdvSlider = _origAdvSlider;
      window._rjSetupIconsInstalled = false;
      console.log("[40-setup-icons] désinstallé");
    };
    console.log("[40-setup-icons] actif — icônes sur les réglages");
  }

  install();
})();


/* ==================================================================== *
 * Entrée en week-end — corrections de parcours
 * (anciennement 42-weekend-entry-fixes.js)
 * ==================================================================== */

(function () {
  "use strict";

  function curScreenId() {
    try { var el = document.querySelector(".scr.on"); return el ? el.id : null; }
    catch (e) { return null; }
  }

  function weekendKey() {
    var G = window.G || {};
    var circuit = "";
    try {
      var nr = (typeof getNextRace === "function") ? getNextRace() : null;
      circuit = nr ? (nr.name || nr.circuit || "") : "";
    } catch (e) {}
    if (!circuit) {
      var rs = window.RACE_STATE;
      circuit = (rs && rs.circuit) || "";
    }
    var races = (G.races && typeof G.races.length === "number") ? G.races.length : 0;
    var saison = G.saison || 0;
    return circuit + "#" + races + "#" + saison;
  }

  // --- BUG 1 : réinitialiser les essais à l'entrée d'un nouveau week-end ---
  function ensureFreshPractice() {
    try {
      if (typeof hasPracticeSystem !== "function" || !hasPracticeSystem()) return;
      var rs = window.RACE_STATE;
      if (!rs) return;
      var key = weekendKey();
      var pr = rs.practice;
      if (!pr || pr._wkndEntry !== key) {
        if (typeof initPracticeState === "function") {
          initPracticeState();
          if (rs.practice) rs.practice._wkndEntry = key;
        }
      }
    } catch (e) { /* no-op */ }
  }

  function installPracticeFix() {
    if (typeof window.goToRaceWeekend !== "function") return false;
    if (window.goToRaceWeekend._rjWkndFix) return true;
    var orig = window.goToRaceWeekend;
    window.goToRaceWeekend = function () {
      var r = orig.apply(this, arguments);
      ensureFreshPractice();
      return r;
    };
    window.goToRaceWeekend._rjWkndFix = true;
    window.goToRaceWeekend._rjOrig = orig;
    return true;
  }

  // --- BUG 2 : notif "Nouveau message" seulement à l'accueil ---
  function installToastFix() {
    if (typeof window.pushHomeToast !== "function") return false;
    if (window.pushHomeToast._rjMsgGate) return true;
    var orig = window.pushHomeToast;
    /* Les nouveaux messages attendent le retour sur l'accueil. */
    if (!Array.isArray(window.RJ_TOAST_FILTERS)) window.RJ_TOAST_FILTERS = [];
    if (!window.RJ_TOAST_FILTERS.some(function (f) { return f && f.id === "42-weekend-entry"; })) {
      window.RJ_TOAST_FILTERS.push({
        id: "42-weekend-entry",
        filtre: function (label) {
          try {
            if (label === "Nouveau message") {
              var scr = curScreenId();
              if (scr && scr !== "S-home") return false;
            }
          } catch (e) {}
        }
      });
    }
    window.pushHomeToast._rjMsgGate = true;
    window.pushHomeToast._rjOrig = orig;
    return true;
  }

  function boot(retries) {
    if (typeof window === "undefined") return;
    var ok1 = installPracticeFix();
    var ok2 = installToastFix();
    if ((!ok1 || !ok2) && (retries = (retries == null ? 20 : retries)) > 0) {
      setTimeout(function () { boot(retries - 1); }, 150);
      return;
    }
    window._rjWeekendEntryFixUninstall = function () {
      if (window.goToRaceWeekend && window.goToRaceWeekend._rjOrig) window.goToRaceWeekend = window.goToRaceWeekend._rjOrig;
      if (window.pushHomeToast && window.pushHomeToast._rjOrig) window.pushHomeToast = window.pushHomeToast._rjOrig;
      console.log("[42-weekend-entry-fixes] désinstallé");
    };
    console.log("[42-weekend-entry-fixes] actif (essais reset:" + ok1 + ", notif gate:" + ok2 + ")");
  }

  if (document.readyState === "loading" && typeof document.addEventListener === "function") {
    document.addEventListener("DOMContentLoaded", function () { boot(); });
  } else {
    boot();
  }
})();


/* ==================================================================== *
 * Réalisme — calibrage de l'état de course
 * (anciennement 43-realism-tuning.js)
 * ==================================================================== */

(function () {
  "use strict";

  var MULT_FIXES = {
    // Écarts de performance réels par rapport à la F1 sur un même tracé.
    // Les catégories juniors étaient trop rapides : une F4 tourne ~35-45 %
    // plus lentement qu'une F1, pas 20 %.
    "Formule 4": 1.35,          // était 1.205 — F4 Monza ~1:55 vs F1 ~1:21
    "Formula Regional": 1.22,   // était 1.154
    "Formule 3": 1.17,          // était 1.115
    "Formule 2": 1.10,          // était 1.064
    "Super Formula": 1.06,      // était 1.026
    "Endurance WEC": 1.13,      // Hypercar ~+13 % vs F1 (était 1.20, avant 1.308)
    "IndyCar": 1.10             // inchangé — cohérent sur circuit routier
  }

  // refLapF1 = temps F1 équivalent (s) ; ×CAT_LAP_MULT donne le temps de la catégorie
  var REFLAP_FIXES = {
    "24h Le Mans": 171,      // WEC ×1.20 -> ~3:25
    "GP Valencia": 98,       // ~1:38
    "GP Portimao": 78,       // ~1:18
    // GP français fictifs (temps F1 équivalents variés)
    "GP Lorraine": 84, "GP Alsace": 79, "GP Normandie": 88, "GP Bretagne": 82,
    "GP Bourgogne": 91, "GP Auvergne": 76, "GP Picardie": 80, "GP Provence": 86,
    "GP Languedoc": 83, "GP Cote Azur": 74, "GP Lyon": 89,
    // circuits karting dédiés : refLapF1 du tracé d'origine (cohérent multi-catégories)
    "GP Monaco Kart": 72, "GP Spa Kart": 105, "GP Monza Kart": 80,
    "GP Zandvoort Kart": 70, "GP Abu Dhabi Kart": 83, "GP Bahrain Kart": 91,
    "GP Silverstone Kart": 87
  };

  var _origMult = {};
  var _patchedCircuits = [];

  function getCircuits() {
    if (typeof CIRCUITS !== "undefined" && CIRCUITS) return CIRCUITS;
    if (typeof CIRCUIT_DATA !== "undefined" && CIRCUIT_DATA) return CIRCUIT_DATA;
    return null;
  }


  /* ------------------------------------------------------------------
   * DISTANCES DE COURSE (nombre de tours de base, avant modulateur circuit)
   * Les catégories juniors couraient beaucoup trop longtemps : une course
   * de F4 dure 25-30 min en réalité, pas 50. À l'inverse le WEC, dont les
   * manches font 6 h minimum, se terminait en 48 minutes simulées.
   * Rappel : un tour ≈ 1 s de temps de jeu réel, allonger une course
   * n'allonge donc pas sensiblement la partie.
   * ---------------------------------------------------------------- */
  var LAPS_FIXES = {
    "Formule 4": 15,          // était 30 → ~27 min (réel : 25-30 min)
    "Formula Regional": 19,   // était 30 → ~35 min
    "Formule 3": 23,          // était 35 → ~40 min (course principale)
    "Formule 2": 33,          // était 40 → ~55 min
    "Super Formula": 32,      // était 53 → ~48 min
    "IndyCar": 85,            // était 70 → ~95 min sur circuit routier
    "Endurance WEC": 60       // était 25 → ~2 h 30 sur les manches 6 h.
                              // Volontairement en deçà des 6 h réelles : le système
                              // d'arrêts plafonne à 3 arrêts planifiés et n'est pas
                              // dimensionné pour de vrais relais d'endurance.
  };

  /* ------------------------------------------------------------------
   * ARRÊTS AU STAND — la F4, la Formula Regional et la F3 n'en font
   * AUCUN en compétition réelle. Le jeu imposait un arrêt en F4 et FR.
   * On garde l'usure des pneus (degradeTyres) : elle existe bien, c'est
   * seulement le changement en course qui n'a pas lieu.
   * Le WEC passe à 10-16 arrêts, cohérent avec une manche de 6 h.
   * ---------------------------------------------------------------- */
  var PIT_FIXES = {
    "Formule 4":        { minStops: 0, maxStops: 0 },
    "Formula Regional": { minStops: 0, maxStops: 0 },
    "Formule 3":        { minStops: 0, maxStops: 0 },
    "Endurance WEC":    { minStops: 3, maxStops: 6 }   // aligné sur ce que l'UI sait planifier
  };

  var _origLaps = {}, _origPit = {};

  function applyLapsAndPits() {
    var n = 0;
    if (typeof CAT_LAPS !== "undefined" && CAT_LAPS) {
      for (var cat in LAPS_FIXES) {
        if (!LAPS_FIXES.hasOwnProperty(cat)) continue;
        if (typeof CAT_LAPS[cat] === "number") {
          if (!(cat in _origLaps)) _origLaps[cat] = CAT_LAPS[cat];
          CAT_LAPS[cat] = LAPS_FIXES[cat];
          n++;
        }
      }
    }
    if (typeof PIT_CONFIG !== "undefined" && PIT_CONFIG) {
      for (var c2 in PIT_FIXES) {
        if (!PIT_FIXES.hasOwnProperty(c2)) continue;
        var cfg = PIT_CONFIG[c2];
        if (!cfg) continue;
        if (!(c2 in _origPit)) _origPit[c2] = { minStops: cfg.minStops, maxStops: cfg.maxStops };
        cfg.minStops = PIT_FIXES[c2].minStops;
        cfg.maxStops = PIT_FIXES[c2].maxStops;
        n++;
      }
    }
    return n;
  }


  /* G.totalLaps est figé à la création de carrière (ou au changement de
   * catégorie) : une partie déjà commencée garderait l'ancienne distance.
   * On le resynchronise à l'entrée de chaque week-end, jamais en course. */
  function installLapsRefresh() {
    if (typeof window.initRaceState !== "function") return false;
    if (window.initRaceState._rj43) return true;
    var orig = window.initRaceState;
    var fn = function () {
      var r = orig.apply(this, arguments);
      try {
        var enCourse = (typeof LIVE_RACE !== "undefined" && LIVE_RACE &&
                        LIVE_RACE.total > 0 && !LIVE_RACE.finished && (LIVE_RACE.cur || 0) > 0);
        if (!enCourse && typeof getCatLaps === "function" && typeof G !== "undefined" && G) {
          var n = getCatLaps(G.cat);
          if (typeof n === "number" && n > 0 && G.totalLaps !== n) G.totalLaps = n;
        }
      } catch (e) {}
      return r;
    };
    fn._rj43 = true;
    window.initRaceState = fn;
    return true;
  }

  function apply(retries) {
    var multOk = (typeof CAT_LAP_MULT !== "undefined" && CAT_LAP_MULT);
    var circuits = getCircuits();
    if ((!multOk || !circuits) && (retries = (retries == null ? 25 : retries)) > 0) {
      if (typeof setTimeout === "function") setTimeout(function () { apply(retries - 1); }, 150);
      return;
    }
    if (window._rjRealismTuned) return;
    window._rjRealismTuned = true;

    // 1. multiplicateurs de catégorie
    if (multOk) {
      for (var cat in MULT_FIXES) {
        if (typeof CAT_LAP_MULT[cat] === "number") {
          if (!(cat in _origMult)) _origMult[cat] = CAT_LAP_MULT[cat];
          CAT_LAP_MULT[cat] = MULT_FIXES[cat];
        }
      }
    }

    // 2. refLapF1 manquants uniquement
    if (circuits) {
      for (var k in circuits) {
        var c = circuits[k];
        if (!c) continue;
        var nm = c.name || k;
        if (Object.prototype.hasOwnProperty.call(REFLAP_FIXES, nm) && !c.refLapF1) {
          _patchedCircuits.push({ obj: c, prev: c.refLapF1 });
          c.refLapF1 = REFLAP_FIXES[nm];
        }
      }
    }

    // 3. distances de course + arrêts au stand par catégorie
    var nLapPit = applyLapsAndPits();
    installLapsRefresh();

    window._rjRealismTuningUninstall = function () {
      for (var lc in _origLaps) {
        if (typeof CAT_LAPS !== "undefined" && CAT_LAPS) CAT_LAPS[lc] = _origLaps[lc];
      }
      for (var pc in _origPit) {
        if (typeof PIT_CONFIG !== "undefined" && PIT_CONFIG && PIT_CONFIG[pc]) {
          PIT_CONFIG[pc].minStops = _origPit[pc].minStops;
          PIT_CONFIG[pc].maxStops = _origPit[pc].maxStops;
        }
      }
      for (var cat in _origMult) {
        if (typeof CAT_LAP_MULT !== "undefined" && CAT_LAP_MULT) CAT_LAP_MULT[cat] = _origMult[cat];
      }
      _patchedCircuits.forEach(function (e) { e.obj.refLapF1 = e.prev; });
      window._rjRealismTuned = false;
      console.log("[43-realism-tuning] désinstallé");
    };

    console.log("[43-realism-tuning] actif — " + Object.keys(MULT_FIXES).length +
      " multiplicateurs, " + nLapPit + " réglages distances/arrêts, " +
      _patchedCircuits.length + " circuits renseignés");
  }

  if (document.readyState === "loading" && typeof document.addEventListener === "function") {
    document.addEventListener("DOMContentLoaded", function () { apply(); });
  } else {
    apply();
  }
})();


/* ==================================================================== *
 * Vitesse de simulation
 * (anciennement 49-race-speed.js)
 * ==================================================================== */

(function () {
  "use strict";

  var FACTOR = 1.6; // course ~60% plus lente (280×1.8×1.6 ≈ 806ms/tour)

  function inLiveRace() {
    try {
      var L = window.LIVE_RACE;
      return !!(L && L.total > 0 && (L.cur || 0) >= 1 && !L.finished);
    } catch (e) { return false; }
  }

  function install() {
    if (window._rjRaceSpeedInstalled) return;
    if (typeof window.getSimSpeedMult !== "function") {
      if (typeof setTimeout === "function") setTimeout(install, 300);
      return;
    }
    window._rjRaceSpeedInstalled = true;
    var orig = window.getSimSpeedMult;
    window._rjOrigSimSpeedMult = orig;
    window.getSimSpeedMult = function () {
      var base = orig ? orig.apply(this, arguments) : 1;
      return inLiveRace() ? base * FACTOR : base;
    };
    window._rjRaceSpeedUninstall = function () {
      if (window._rjOrigSimSpeedMult) window.getSimSpeedMult = window._rjOrigSimSpeedMult;
      window._rjRaceSpeedInstalled = false;
      console.log("[49-race-speed] désinstallé");
    };
    console.log("[49-race-speed] course ralentie ×" + FACTOR + " (qualifs inchangées)");
  }

  if (document.readyState === "loading" && typeof document.addEventListener === "function") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
})();


/* ==================================================================== *
 * Après la course — verrouillage des onglets
 * (anciennement 54-post-race-lock.js)
 * ==================================================================== */

(function () {
  "use strict";

  var LOCKABLE = ["prep", "essais", "qualif", "strat", "sprint", "course"];
  var origUpdate = null, origRtab = null;

  function raceIsOver() {
    try {
      return !!(typeof RACE_WEEKEND_STATE !== "undefined" &&
                RACE_WEEKEND_STATE && RACE_WEEKEND_STATE.courseDone);
    } catch (e) { return false; }
  }

  function tabEl(name) {
    return document.getElementById("race-tab-" + name) ||
           document.querySelector('#S-race .tab[data-tab="' + name + '"]');
  }

  function lockTabs() {
    if (!raceIsOver()) return;
    for (var i = 0; i < LOCKABLE.length; i++) {
      var el = tabEl(LOCKABLE[i]);
      if (!el) continue;
      el.style.opacity = "0.3";
      el.style.color = "var(--text3)";
      el.style.pointerEvents = "none";
      el.style.cursor = "not-allowed";
      el.setAttribute("disabled", "disabled");
      el.setAttribute("aria-disabled", "true");
    }
    // l'onglet Résultat doit rester accessible
    var res = tabEl("res");
    if (res) {
      res.style.opacity = "";
      res.style.color = "";
      res.style.pointerEvents = "";
      res.style.cursor = "";
      res.removeAttribute("disabled");
      res.removeAttribute("aria-disabled");
    }
  }

  function install() {
    if (typeof window.updateRaceTabsVisibility === "function" && !origUpdate) {
      origUpdate = window.updateRaceTabsVisibility;
      window.updateRaceTabsVisibility = function () {
        var r = origUpdate.apply(this, arguments);
        try { lockTabs(); } catch (e) {}
        return r;
      };
    }
    if (typeof window.rtab === "function" && !origRtab) {
      origRtab = window.rtab;
      window.rtab = function (tab, force) {
        // Week-end terminé : seul l'onglet Résultat reste navigable.
        if (raceIsOver() && tab && tab !== "res") {
          return;
        }
        return origRtab.apply(this, arguments);
      };
    }
    return !!(origUpdate && origRtab);
  }

  var tries = 0;
  function boot() {
    var ok = install();
    try { lockTabs(); } catch (e) {}
    if (ok) {
      console.log("[54-post-race-lock] actif — onglets verrouillés après la course");
      return;
    }
    if (tries++ < 80) setTimeout(boot, 80);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj54Uninstall = function () {
    if (origUpdate) { window.updateRaceTabsVisibility = origUpdate; origUpdate = null; }
    if (origRtab) { window.rtab = origRtab; origRtab = null; }
    console.log("[54-post-race-lock] désinstallé");
  };
})();


/* ==================================================================== *
 * Équilibrage de course
 * (anciennement 55-race-balance.js)
 * ==================================================================== */

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


/* ==================================================================== *
 * Confort de lecture pendant la course
 * (anciennement 56-race-ux-tuning.js)
 * ==================================================================== */

(function () {
  "use strict";

  var TUNING = { eventFactor: 0.42 };
  var wrapped = {};

  /* ---------------------------------------------------------- A. incidents */
  var MARK = "data-rj56-collapsed";

  function collapseIncidents(root) {
    var scope = (root && root.querySelectorAll) ? root : document;
    var headers;
    try { headers = scope.querySelectorAll("div"); } catch (e) { return; }
    for (var i = 0; i < headers.length; i++) {
      var h = headers[i];
      if (h.getAttribute(MARK)) continue;
      var txt = (h.textContent || "").trim();
      // en-tête exact de la section (le titre seul, pas le conteneur entier)
      if (!/^Incidents de course \(\d+\)$/.test(txt)) continue;
      var box = h.parentNode;
      if (!box) continue;

      // les frères qui suivent l'en-tête = les lignes d'incidents
      var items = [];
      var n = h.nextSibling;
      while (n) {
        if (n.nodeType === 1) items.push(n);
        n = n.nextSibling;
      }
      // IMPORTANT : ne marquer comme traité QUE si les lignes existent déjà.
      // L'en-tête est inséré avant elles : marquer trop tôt empêcherait
      // définitivement le repli lors du passage suivant.
      if (!items.length) continue;
      h.setAttribute(MARK, "1");

      var open = false;
      items.forEach(function (el) { el.style.display = "none"; });

      h.style.cursor = "pointer";
      h.style.userSelect = "none";
      h.style.touchAction = "manipulation";
      h.style.display = "flex";
      h.style.alignItems = "center";
      h.style.justifyContent = "space-between";

      var caret = document.createElement("span");
      caret.textContent = "▾";
      caret.style.cssText = "font-size:12px;opacity:.8;transition:transform .15s";
      h.appendChild(caret);

      function toggle() {
        open = !open;
        items.forEach(function (el) { el.style.display = open ? "" : "none"; });
        caret.style.transform = open ? "rotate(180deg)" : "";
      }
      h.addEventListener("click", toggle);
      h.addEventListener("touchend", function () { }, { passive: true });
    }
  }

  var obs = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var added = muts[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        if (added[j].nodeType === 1) collapseIncidents(added[j]);
      }
    }
    // le contenu du résultat est réécrit en bloc : on repasse sur l'écran
    collapseIncidents(document.getElementById("res-content"));
    buildPodium();
  });

  /* ------------------------------------------------- B. moins d'événements */
  function wrapChance(name) {
    if (typeof window[name] !== "function" || window[name]._rj56) return false;
    var orig = window[name];
    var fn = function () {
      // on laisse passer seulement une fraction des déclenchements
      if (Math.random() >= TUNING.eventFactor) return;
      return orig.apply(this, arguments);
    };
    fn._rj56 = true;
    wrapped[name] = orig;
    window[name] = fn;
    return true;
  }

  function wrapSchedule() {
    if (typeof window.buildLiveEventSchedule !== "function") return false;
    if (window.buildLiveEventSchedule._rj56) return true;
    var orig = window.buildLiveEventSchedule;
    var fn = function () {
      var sched = orig.apply(this, arguments);
      try {
        if (Object.prototype.toString.call(sched) === "[object Array]") {
          var kept = sched.filter(function (ev) {
            if (ev && ev.always && Math.random() < 0.6) return true; // imposés : largement conservés
            return Math.random() < TUNING.eventFactor;
          });
          return kept;
        }
      } catch (e) {}
      return sched;
    };
    fn._rj56 = true;
    wrapped.buildLiveEventSchedule = orig;
    window.buildLiveEventSchedule = fn;
    return true;
  }


  /* --------------------------------------------------- C. podium top 3 */
  var PODIUM_ID = "rj56-podium";
  var MEDALS = [
    { c: "#d4a842", h: 92,  label: "1" },   // or
    { c: "#9098b0", h: 68,  label: "2" },   // argent
    { c: "#c07840", h: 52,  label: "3" }    // bronze
  ];

  // "Charles Leclerc" -> "C. Leclerc"
  function shortName(full) {
    var s = String(full || "").trim().replace(/\s+/g, " ");
    if (!s) return "";
    var parts = s.split(" ");
    if (parts.length === 1) return parts[0];
    return parts[0].charAt(0).toUpperCase() + ". " + parts.slice(1).join(" ");
  }

  function natOf(d) {
    try {
      if (d.isPlayer) return (G.pilot && G.pilot.nat) || "FR";
      if (d.nat) return d.nat;
      if (typeof d.rivalIdx === "number" && G.rivals && G.rivals[d.rivalIdx]) {
        return G.rivals[d.rivalIdx].nat || "FR";
      }
    } catch (e) {}
    return "FR";
  }

  function flagOf(code) {
    try { if (typeof flagSvg === "function") return flagSvg(code, 16); } catch (e) {}
    return "";
  }

  function top3() {
    try {
      var d = (window.LIVE_RACE && LIVE_RACE.drivers) ? LIVE_RACE.drivers.slice() : [];
      d = d.filter(function (x) { return x && !x.dnf && typeof x.pos === "number"; });
      d.sort(function (a, b) { return a.pos - b.pos; });
      return d.slice(0, 3);
    } catch (e) { return []; }
  }

  function buildPodium() {
    var host = document.getElementById("res-content");
    if (!host || document.getElementById(PODIUM_ID)) return;
    var t = top3();
    if (t.length < 3) return;

    var wrap = document.createElement("div");
    wrap.id = PODIUM_ID;
    wrap.style.cssText =
      "margin:10px 14px 12px;padding:16px 12px 0;background:linear-gradient(180deg,var(--bg2) 0%,var(--bg) 100%);" +
      "border:1px solid var(--border-hi);border-radius:var(--r);overflow:hidden";

    var row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:flex-end;justify-content:center;gap:8px";

    // ordre visuel : 2e, 1er, 3e
    [1, 0, 2].forEach(function (idx) {
      var d = t[idx], m = MEDALS[idx];
      if (!d) return;
      var col = document.createElement("div");
      col.style.cssText = "flex:1 1 0;max-width:120px;display:flex;flex-direction:column;align-items:center;text-align:center";

      var nameBox = document.createElement("div");
      nameBox.style.cssText = "margin-bottom:6px;min-height:40px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px";
      var flag = document.createElement("div");
      flag.style.cssText = "line-height:0";
      flag.innerHTML = flagOf(natOf(d));
      var nm = document.createElement("div");
      nm.style.cssText = "font-family:var(--font-display);font-size:11px;font-weight:800;letter-spacing:.02em;color:" +
        (d.isPlayer ? "var(--white)" : "var(--text2)") + ";line-height:1.2;word-break:break-word";
      nm.textContent = shortName(d.name);
      nameBox.appendChild(flag); nameBox.appendChild(nm);

      var step = document.createElement("div");
      step.style.cssText =
        "width:100%;height:" + m.h + "px;border-radius:6px 6px 0 0;" +
        "background:linear-gradient(180deg," + m.c + "40 0%," + m.c + "12 100%);" +
        "border:1px solid " + m.c + ";border-bottom:none;display:flex;align-items:flex-start;justify-content:center;padding-top:8px" +
        (d.isPlayer ? ";box-shadow:0 0 16px " + m.c + "55" : "");
      var num = document.createElement("div");
      num.style.cssText = "font-family:var(--font-display);font-size:22px;font-weight:900;color:" + m.c + ";line-height:1";
      num.textContent = m.label;
      step.appendChild(num);

      col.appendChild(nameBox); col.appendChild(step);
      row.appendChild(col);
    });

    wrap.appendChild(row);
    host.insertBefore(wrap, host.firstChild);
  }

  /* ------------------------------------------- D. week-end 50 % plus lent */
  var SPEED_FACTOR = 2;
  function installSpeed() {
    if (typeof window.getSimSpeedMult !== "function") return false;
    if (window.getSimSpeedMult._rj56) return true;
    var orig = window.getSimSpeedMult;
    var fn = function () {
      var v = orig.apply(this, arguments);
      return (typeof v === "number" ? v : 1.8) * SPEED_FACTOR;
    };
    fn._rj56 = true;
    wrapped.getSimSpeedMult = orig;
    window.getSimSpeedMult = fn;
    return true;
  }

  /* ------------------------------------------------------------------ boot */
  var tries = 0;
  function boot() {
    var a = wrapChance("triggerPassiveEvent");
    var b = wrapChance("tryTriggerChoiceRaceEvent");
    var c = wrapSchedule();
    var d = installSpeed();
    if (document.body) {
      collapseIncidents(document);
      buildPodium();
      obs.observe(document.body, { childList: true, subtree: true });
    }
    if (a && b && c && d && document.body) {
      console.log("[56-race-ux-tuning] actif — événements −" + Math.round((1 - TUNING.eventFactor) * 100) +
                  " %, incidents repliables, podium top 3, week-end ×" + SPEED_FACTOR + " plus lent");
      return;
    }
    if (tries++ < 80) setTimeout(boot, 80);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj56Uninstall = function () {
    obs.disconnect();
    Object.keys(wrapped).forEach(function (k) { window[k] = wrapped[k]; });
    console.log("[56-race-ux-tuning] désinstallé");
  };
  window._rj56Tuning = TUNING;
})();


/* ==================================================================== *
 * Réglages — incidence sur le temps de qualification
 * (anciennement 76-setup-qualif.js)
 * ==================================================================== */

(function () {
  "use strict";

  var TAG = "[76-setup-qualif]";
  var FACTEUR = 0.12;      // performance → temps au tour
  var PLAFOND = 0.01;      // ±1 % du temps de référence

  var wrapped = {};
  var etat = { installe: false, dernier: null };
  window._rj76Status = function () { return etat; };

  function bonusReglage() {
    try {
      if (typeof computeSetupImpact !== "function") return 0;
      var i = computeSetupImpact();
      var b = (i && typeof i.scoreBonus === "number") ? i.scoreBonus : 0;
      return isFinite(b) ? b : 0;
    } catch (e) { return 0; }
  }

  // Delta relatif à appliquer au temps au tour. Négatif = plus rapide.
  function delta() {
    var d = -bonusReglage() * FACTEUR;
    if (d > PLAFOND) d = PLAFOND;
    if (d < -PLAFOND) d = -PLAFOND;
    return d;
  }

  window._rj76Gain = function () {
    var b = bonusReglage(), d = delta();
    var ref = 0;
    try { ref = (typeof QUALI_STATE !== "undefined" && QUALI_STATE) ? (QUALI_STATE.baseRef || 0) : 0; } catch (e) {}
    var txt = "réglage " + (b >= 0 ? "+" : "") + (b * 100).toFixed(1) + " % de performance → " +
              (d >= 0 ? "+" : "") + (d * 100).toFixed(2) + " % de temps au tour" +
              (ref ? " ≈ " + (d * ref).toFixed(3) + " s sur " + ref.toFixed(1) + " s" : "");
    console.log(TAG + " " + txt);
    return { scoreBonus: b, deltaTemps: d, secondes: ref ? +(d * ref).toFixed(3) : null };
  };

  function installer() {
    if (typeof window.qualiDriverTime !== "function") return false;
    if (window.qualiDriverTime._rj76) return true;

    var orig = window.qualiDriverTime;
    var fn = function (pilote, session, tour, total, avancement) {
      var t = orig.apply(this, arguments);
      try {
        if (pilote && pilote.isPlayer && typeof t === "number" && isFinite(t)) {
          var d = delta();
          if (d !== 0) {
            var avant = t;
            t = t * (1 + d);
            etat.dernier = {
              avant: +avant.toFixed(3), apres: +t.toFixed(3),
              gain: +(t - avant).toFixed(3), delta: +(d * 100).toFixed(2)
            };
          }
        }
      } catch (e) {}
      return t;
    };
    fn._rj76 = true;
    wrapped.qualiDriverTime = orig;
    window.qualiDriverTime = fn;
    return true;
  }

  var essais = 0;
  function boot() {
    var ok = false;
    try { ok = installer(); } catch (e) {}
    if (!ok) {
      if (essais++ < 120) { setTimeout(boot, 100); return; }
      console.warn(TAG + " abandon : qualiDriverTime introuvable");
      return;
    }
    etat.installe = true;
    console.log(TAG + " actif — le réglage voiture influe sur le temps au tour en qualification");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj76Uninstall = function () {
    Object.keys(wrapped).forEach(function (k) { window[k] = wrapped[k]; });
    etat.installe = false;
    console.log(TAG + " désinstallé");
  };
})();

/* =====================================================================
 * VERROUILLAGE DES ÉTAPES FRANCHIES
 *
 * On pouvait revenir sur « Préparation » et « Qualifications » après les
 * avoir passées. Deux conséquences : on retouchait les réglages de la
 * voiture une fois les qualifications courues — alors qu'ils sont censés
 * être figés au parc fermé — et le week-end perdait sa progression, chaque
 * étape restant indéfiniment ouverte.
 *
 * Le verrouillage existant ne fermait ces deux onglets qu'une fois la
 * course terminée : « Préparation » n'était jamais verrouillée en cours de
 * week-end, et « Qualifications » s'ouvrait précisément au moment où elle
 * aurait dû se fermer.
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[40-etapes]";
  var _orig = null;

  function verrouiller(onglet, ferme) {
    if (!onglet) return;
    try {
      if (typeof window._setTabLocked === "function") {
        window._setTabLocked(onglet, ferme);
        return;
      }
    } catch (e) {}
    if (ferme) onglet.setAttribute("disabled", "");
    else onglet.removeAttribute("disabled");
  }

  function appliquer() {
    var e = window.RACE_WEEKEND_STATE;
    if (!e) return;
    /* Une fois les qualifications courues, la voiture est figée et la
       séance est derrière nous : les deux onglets se ferment. */
    if (!e.qualifDone) return;

    var prep = document.querySelector('#S-race .tab[data-tab="prep"]');
    var qualif = document.getElementById("race-tab-qualif");
    verrouiller(prep, true);
    verrouiller(qualif, true);

    /* Si l'un d'eux est encore affiché au moment du verrouillage, on
       bascule sur l'étape courante plutôt que de laisser le joueur sur un
       écran qu'il ne peut plus quitter par onglet. */
    try {
      var ouvert = document.querySelector("#S-race .tab.on");
      var t = ouvert ? ouvert.getAttribute("data-tab") : "";
      if ((t === "prep" || t === "qualif") && typeof window.rtab === "function") {
        var suite = e.courseDone ? "res" : (e.strategyDone ? "course" : "strat");
        window.rtab(suite, true);
      }
    } catch (err) {}
  }

  function installer() {
    if (typeof window.updateRaceTabsVisibility !== "function") return false;
    if (window.updateRaceTabsVisibility._rj40etapes) return true;
    _orig = window.updateRaceTabsVisibility;
    window.updateRaceTabsVisibility = function () {
      var r = _orig.apply(this, arguments);
      try { appliquer(); } catch (e) { console.warn(TAG, e && e.message); }
      return r;
    };
    window.updateRaceTabsVisibility._rj40etapes = true;
    return true;
  }

  var essais = 0;
  (function tenter() {
    if (installer()) { console.log(TAG, "étapes franchies verrouillées"); return; }
    if (essais++ < 80) setTimeout(tenter, 150);
  })();

  window._rj40Etapes = { appliquer: appliquer };
  window._rj40EtapesUninstall = function () {
    if (_orig) window.updateRaceTabsVisibility = _orig;
    console.log(TAG, "désinstallé");
  };
})();

/* =====================================================================
 * REMISE À ZÉRO ENTRE DEUX COURSES
 *
 * En arrivant sur le deuxième week-end, l'onglet Course affichait encore
 * l'état du précédent : barre de progression avancée, « Tour 3 / 57 »,
 * classement et commentaires de la course d'avant.
 *
 * La remise à zéro existait, mais n'était déclenchée que si l'onglet
 * Résultat se trouvait affiché au moment d'entrer dans le week-end. Or on
 * quitte rarement l'écran depuis cet onglet précis : il suffisait d'être
 * reparti depuis la préparation ou par le calendrier pour que l'état
 * survive à la course suivante.
 *
 * On la déclenche désormais sur ce qui la justifie vraiment : un nouveau
 * circuit, ou une course déjà courue.
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[40-reset-course]";
  var _orig = null;

  function nouveauWeekEnd() {
    try {
      var e = window.RACE_WEEKEND_STATE || {};
      if (e.courseDone) return true;
      if (typeof window.getNextRace === "function" && window.RACE_STATE) {
        var suivante = window.getNextRace();
        var nom = suivante ? suivante.name : "";
        if (nom && window.RACE_STATE.circuit && window.RACE_STATE.circuit !== nom) return true;
      }
    } catch (e) {}
    return false;
  }

  function installer() {
    if (typeof window.goToRaceWeekend !== "function") return false;
    if (window.goToRaceWeekend._rj40reset) return true;
    _orig = window.goToRaceWeekend;
    window.goToRaceWeekend = function () {
      try {
        if (nouveauWeekEnd() && typeof window.resetRaceScreen === "function") {
          window.resetRaceScreen();
        }
      } catch (e) { console.warn(TAG, e && e.message); }
      return _orig.apply(this, arguments);
    };
    window.goToRaceWeekend._rj40reset = true;
    return true;
  }

  var essais = 0;
  (function tenter() {
    if (installer()) { console.log(TAG, "écran de course remis à zéro entre les manches"); return; }
    if (essais++ < 80) setTimeout(tenter, 150);
  })();

  window._rj40ResetUninstall = function () {
    if (_orig) window.goToRaceWeekend = _orig;
    console.log(TAG, "désinstallé");
  };
})();

/* =====================================================================
 * ZONES OPTIMALES PRÊTES DÈS L'OUVERTURE
 *
 * À l'ouverture des réglages, une seule zone optimale était dessinée. Au
 * premier clic sur une barre, les neuf apparaissaient d'un coup et la
 * première changeait de position — d'où l'impression que la zone sautait.
 *
 * La cause : l'estimation de l'ingénieur, qui sert à tracer ces zones,
 * n'était pas encore constituée au premier rendu. Elle l'était au clic
 * suivant, et tout apparaissait alors en bloc.
 *
 * On la constitue donc AVANT de dessiner, une seule fois par circuit.
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[40-zones]";
  var _orig = null;

  function preparer() {
    try {
      var e = window.RACE_STATE;
      if (!e) return;
      var prete = e.practice && e.practice.knowledge &&
                  Object.keys(e.practice.knowledge).length;
      if (!prete && typeof window.initPracticeState === "function") {
        window.initPracticeState();
      }
    } catch (err) { console.warn(TAG, err && err.message); }
  }

  /* Le contenu des réglages est produit à l'entrée dans le week-end, puis
     simplement déplacé dans le tiroir à l'ouverture. Si l'estimation n'est
     pas constituée à ce moment-là, les barres se dessinent avec une zone
     approximative, remplacée au premier clic par la vraie : la zone semblait
     sauter. On prépare donc l'estimation dès l'entrée, avant tout rendu. */
  function preparerAlEntree() {
    if (typeof window.goToRaceWeekend !== "function") return false;
    if (window.goToRaceWeekend._rj40zones) return true;
    var origEntree = window.goToRaceWeekend;
    window.goToRaceWeekend = function () {
      var r = origEntree.apply(this, arguments);
      try {
        preparer();
        /* L'estimation venant d'être posée, on redessine une fois pour que
           les barres partent des bonnes valeurs. */
        if (typeof window.renderAdvancedSetupUI === "function") {
          setTimeout(function () { try { window.renderAdvancedSetupUI(); } catch (e) {} }, 40);
        }
      } catch (e) {}
      return r;
    };
    window.goToRaceWeekend._rj40zones = true;
    return true;
  }

  function installer() {
    if (typeof window._renderAdvancedSetupUIInner !== "function") return false;
    if (window._renderAdvancedSetupUIInner._rj40zones) return true;
    _orig = window._renderAdvancedSetupUIInner;
    window._renderAdvancedSetupUIInner = function () {
      preparer();
      return _orig.apply(this, arguments);
    };
    window._renderAdvancedSetupUIInner._rj40zones = true;
    return true;
  }

  var essais = 0;
  (function tenter() {
    if (installer()) {
      preparerAlEntree();
      console.log(TAG, "zones optimales prêtes dès l'ouverture");
      return;
    }
    if (essais++ < 80) setTimeout(tenter, 150);
  })();

  window._rj40ZonesUninstall = function () {
    if (_orig) window._renderAdvancedSetupUIInner = _orig;
  };
})();

/* =====================================================================
 * L'ONGLET COURSE PART TOUJOURS D'UN ÉCRAN VIERGE
 *
 * La remise à zéro dépendait du chemin emprunté pour entrer dans le
 * week-end. Selon d'où l'on venait, l'onglet Course pouvait encore
 * afficher la barre de progression, le numéro de tour, le classement et
 * les commentaires de la manche précédente.
 *
 * Plutôt que de multiplier les points de déclenchement, on vérifie à
 * l'ouverture de l'onglet : si la course de cette manche n'a pas démarré,
 * l'écran doit être vierge. C'est vrai quel que soit le chemin.
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[40-onglet-course]";
  var _orig = null;

  /* La phase de course s'appelle « live », pas « race » : ma première
     version effaçait donc l'écran d'une course en train de se dérouler dès
     qu'on quittait l'onglet et qu'on y revenait. On se fie à la phase
     déclarée par le moteur, et au fait qu'un classement soit déjà rempli. */
  function courseEnCoursOuFinie() {
    try {
      var e = window.RACE_WEEKEND_STATE || {};
      if (e.courseDone) return true;
      var phase = window.G && window.G.racePhase;
      if (phase === "live" || phase === "result") return true;
      var cl = document.getElementById("live-leaderboard");
      if (cl && cl.children.length > 1) return true;
    } catch (err) {}
    return false;
  }

  function vider() {
    var poser = function (id, txt) {
      var el = document.getElementById(id);
      if (el) el.textContent = txt;
    };
    var vide = function (id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = "";
    };
    try {
      var bar = document.getElementById("race-bar");
      if (bar) bar.style.width = "0%";
      var total = 0;
      try { total = (window.RACE_STATE && window.RACE_STATE.totalLaps) || window.G.totalLaps || 0; } catch (e) {}
      poser("live-race-lap", total ? "Tour 0 / " + total : "Tour 0");
      poser("live-race-label", "Prêt au départ");
      vide("live-leaderboard");
      vide("live-news-feed");
      var btn = document.getElementById("race-btn");
      if (btn) { btn.disabled = false; btn.textContent = "Départ !"; }
    } catch (e) { console.warn(TAG, e && e.message); }
  }

  function installer() {
    if (typeof window.rtab !== "function") return false;
    if (window.rtab._rj40course) return true;
    _orig = window.rtab;
    window.rtab = function (onglet) {
      var r = _orig.apply(this, arguments);
      try {
        if (onglet === "course" && !courseEnCoursOuFinie()) vider();
      } catch (e) { console.warn(TAG, e && e.message); }
      return r;
    };
    window.rtab._rj40course = true;
    return true;
  }

  var essais = 0;
  (function tenter() {
    if (installer()) { console.log(TAG, "onglet Course vierge tant que la course n'a pas démarré"); return; }
    if (essais++ < 80) setTimeout(tenter, 150);
  })();

  window._rj40CourseUninstall = function () {
    if (_orig) window.rtab = _orig;
  };
})();
