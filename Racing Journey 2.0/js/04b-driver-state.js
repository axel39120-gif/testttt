/* =====================================================================
 * 04b-driver-state.js — REFONTE PHASE 1
 * 
 * Fondations pour la simulation émergente. Définit les structures :
 *   - DriverState : état mental + relations + style de pilotage
 *   - CarState    : état pneus (4 roues + fenêtre temp) + thermique + carburant
 * 
 * EN PHASE 1 : ces structures sont initialisées et exposées en debug,
 * mais N'INFLUENCENT PAS encore le calcul du résultat.
 * 
 * Hooks d'initialisation :
 *   - rjInitDriverStatesForRace(LIVE_RACE)  → appelé au début de runRaceLive
 *   - rjInitDriverPersonalitiesAtSeason(G)  → appelé au début de saison
 * 
 * Diagnostic console :
 *   - rjDebugStates()                       → affiche l'état complet
 * 
 * Architecture future :
 *   - Phase 2 : modèle pneus actif (utilisera CarState.tyres)
 *   - Phase 3 : tour construit étape par étape (utilisera Mental + Tyres)
 *   - Phase 4 : IA décisionnelle (utilisera Mental + Relations)
 *   - Phase 5 : piste vivante
 *   - Phase 6 : narration émergente (utilisera tout)
 * ===================================================================== */

/* ========================================================================
 * 1. CONSTANTES & DESCRIPTEURS
 * ===================================================================== */

var RJ_MENTAL_STATS = {
  confidence:   { label:"Confiance",   range:[0,100], default:65, desc:"Monte avec succès, baisse avec erreurs/DNF" },
  pressure:     { label:"Pression",    range:[0,100], default:30, desc:"Monte avec enjeu (pole, fin de course, rival proche)" },
  aggression:   { label:"Agressivité", range:[0,100], default:50, desc:"Propension à prendre des risques (état ponctuel)" },
  frustration:  { label:"Frustration", range:[0,100], default:0,  desc:"Monte avec trafic, blocages, ordres équipe ignorés" },
  momentum:     { label:"Momentum",    range:[-100,100], default:0, desc:"Série de bons (+) ou mauvais (-) tours récents" },
  focus:        { label:"Concentration", range:[0,100], default:80, desc:"Baisse avec fatigue, distractions, longs stints" },
  morale:       { label:"Moral",       range:[0,100], default:60, desc:"Plus stable, hérite saison/écurie/relations équipe" },
  riskAppetite: { label:"Appétit pour le risque", range:[0,100], default:50, desc:"Calculé dynamiquement depuis aggression+frustration+pressure+confidence" }
};

/* ========================================================================
 * 2. UTILITAIRES INTERNES
 * ===================================================================== */

function _rjClamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function _rjRandRange(min, max) {
  return min + Math.random() * (max - min);
}

/* ========================================================================
 * 3. CRÉATION D'UN DriverState
 * Appelé depuis rjInitDriverStatesForRace pour chaque pilote en course.
 * Persiste à travers les courses via le wrapper rivals[i]._rjState ou
 * G._playerRjState. Si déjà existant, on conserve les valeurs (mental
 * traîne entre les courses).
 * ===================================================================== */

function rjBuildDriverMental(seedTrait) {
  // seedTrait : trait de personnalité du pilote ("competiteur", "sangfroid", etc.)
  // Modifie les valeurs initiales selon le trait pour donner une vraie diversité
  var base = {
    confidence:   65,
    pressure:     30,
    aggression:   50,
    frustration:  0,
    momentum:     0,
    focus:        80,
    morale:       60,
    riskAppetite: 50
  };
  
  switch(seedTrait) {
    case "competiteur":
      base.aggression += 12; base.confidence += 5;  base.riskAppetite += 10; break;
    case "sangfroid":
      base.pressure -= 10;   base.focus += 8;       base.aggression -= 5;    break;
    case "leader":
      base.confidence += 10; base.morale += 8;      base.pressure -= 5;      break;
    case "perfectionniste":
      base.frustration += 5; base.focus += 10;      base.aggression -= 3;    break;
    case "intuitif":
      base.aggression += 5;  base.riskAppetite += 8; break;
    case "instinctif":
      base.aggression += 8;  base.riskAppetite += 12; base.focus -= 5;        break;
    case "analyste":
      base.focus += 12;      base.aggression -= 5;  base.riskAppetite -= 8;  break;
    case "medias":
      base.confidence += 5;  base.morale += 3; break;
  }
  
  // Petite variation aléatoire ±5 pour rendre chaque pilote unique
  Object.keys(base).forEach(function(k) {
    if (k === "momentum") return; // momentum reste à 0 au départ
    base[k] += Math.round((Math.random() - 0.5) * 10);
  });
  
  // Clamp dans les ranges
  Object.keys(RJ_MENTAL_STATS).forEach(function(k) {
    var r = RJ_MENTAL_STATS[k].range;
    base[k] = _rjClamp(base[k], r[0], r[1]);
  });
  
  return base;
}

function rjBuildDriverStyle(skill, seedTrait, rivalData) {
  // skill : 0..100 (skill global du pilote)
  // Construit un profil persistant qui ne change pas pendant la course
  var style = {
    baseAggression: 50,    // ce vers quoi mental.aggression revient au calme
    consistency:    0.75,  // 0..1, capacité à reproduire bons tours
    wetSpec:        0,     // -1..+1, doué/mauvais sous pluie
    qualifSpec:     0,     // -0.3..+0.3, bonus qualif (Hamilton-like)
    raceSpec:       0,     // -0.3..+0.3, bonus course (Alonso-like)
    preferredCircuits: [],
    weakCircuits: []
  };
  
  // Trait → baseAggression
  switch(seedTrait) {
    case "competiteur": style.baseAggression = 65; break;
    case "instinctif":  style.baseAggression = 70; break;
    case "sangfroid":   style.baseAggression = 40; break;
    case "analyste":    style.baseAggression = 42; break;
    case "perfectionniste": style.baseAggression = 48; break;
    case "leader":      style.baseAggression = 55; break;
  }
  
  // Spécialisations aléatoires basées sur skill (les meilleurs ont plus de chance d'avoir une spé marquée)
  var specRange = 0.05 + (skill / 100) * 0.25;
  style.wetSpec     = _rjRandRange(-specRange, specRange);
  style.qualifSpec  = _rjRandRange(-specRange, specRange);
  style.raceSpec    = _rjRandRange(-specRange, specRange);
  style.consistency = 0.6 + (skill / 100) * 0.35 + (Math.random() - 0.5) * 0.1;
  style.consistency = _rjClamp(style.consistency, 0.4, 0.98);
  
  // Si rival data dispo, hérite consistency déjà existante
  if (rivalData && typeof rivalData.consistency === "number") {
    style.consistency = rivalData.consistency;
  }
  
  return style;
}

function rjBuildDriverState(driver, isPlayer, persistedState) {
  // driver : objet driver de LIVE_RACE.drivers (ou pilot pour joueur)
  // persistedState : si déjà existant entre courses, on garde les valeurs longue-durée
  
  var trait = isPlayer ? (G.pilot && G.pilot.trait) : (driver && driver.trait) || null;
  var skill = isPlayer ? 75 : (driver && driver.skill) || 70;
  
  // Mental : si persisté, on garde mais on reset les éphémères (frustration, momentum, pressure)
  var mental;
  if (persistedState && persistedState.mental) {
    mental = Object.assign({}, persistedState.mental);
    mental.frustration = 0;
    mental.momentum    = 0;
    // pressure : on conserve un fond, mais pas plus que 50
    mental.pressure = Math.min(mental.pressure || 30, 50);
    // focus : reset à plein avant la course
    mental.focus = 80 + Math.round((Math.random() - 0.5) * 10);
    mental.focus = _rjClamp(mental.focus, 60, 95);
  } else {
    mental = rjBuildDriverMental(trait);
  }
  
  // Style : persistant, ne change que rarement (intersaison)
  var style;
  if (persistedState && persistedState.style) {
    style = persistedState.style;
  } else {
    style = rjBuildDriverStyle(skill, trait, driver);
  }
  
  // Relations : map driverIdx → relationData. Vide au départ, se construit avec les courses.
  var relations = (persistedState && persistedState.relations) || {
    rivals:  {},     // map<rivalIdx, {tension, respect, history:[]}>
    teammate: null   // {tension, respect, isPlayer}
  };
  
  return {
    mental: mental,
    style: style,
    relations: relations,
    _isPlayer: !!isPlayer
  };
}

/* ========================================================================
 * 4. CRÉATION D'UN CarState
 * Initialisé pour chaque pilote au début de chaque course.
 * Ne persiste PAS entre courses (pneus neufs, voiture rebuild).
 * ===================================================================== */

function rjBuildCarState(driver, isPlayer, weatherId) {
  // Compound initial selon météo
  var initialCompound = "medium";
  if (weatherId === "wet" || weatherId === "storm") initialCompound = "wet";
  
  // Température initiale réaliste : froide au départ, monte avec les tours
  var initialTemp = 65 + Math.round(Math.random() * 10); // 65-75°C "cold"
  
  function makeTyre(compound, temp) {
    return {
      wear:     0,             // 0..100, % d'usure
      temp:     temp,          // °C
      grip:     0.92,          // 0..1, grip relatif (sera recalculé en Phase 2)
      compound: compound,
      _lastDelta: 0            // delta usure du dernier tour (pour debug Phase 2)
    };
  }
  
  // Fenêtre optimale selon compound
  var window;
  if (initialCompound === "soft")        window = [85, 105];
  else if (initialCompound === "medium") window = [80, 110];
  else if (initialCompound === "hard")   window = [75, 115];
  else if (initialCompound === "wet")    window = [55, 80];
  else                                    window = [80, 110];
  
  // Setup actuel (récupéré depuis G pour le joueur, "bal" par défaut pour l'IA)
  var setup = isPlayer ? (G.setup || "bal") : "bal";
  
  return {
    tyres: {
      FL: makeTyre(initialCompound, initialTemp),
      FR: makeTyre(initialCompound, initialTemp),
      RL: makeTyre(initialCompound, initialTemp + 3), // arrière chauffe plus vite
      RR: makeTyre(initialCompound, initialTemp + 3),
      optimalWindow:   window,
      compoundProfile: initialCompound,
      stintLap:        0       // tours sur ce train de pneus
    },
    fuel: {
      load:        100,         // % de la charge initiale
      consumption: 1.0,         // multiplicateur (1.0 = nominal)
      saving:      false        // true si pilote en mode économie
    },
    brakes: {
      temp:    180,             // °C
      wear:    0                // 0..100
    },
    engine: {
      wear:    0,
      mode:    "race",          // "qualif"/"race"/"save"
      reliability: 1.0
    },
    setup: setup,
    _isPlayer: !!isPlayer
  };
}

/* ========================================================================
 * 5. HOOKS D'INITIALISATION
 * Appelés depuis le moteur principal (04-race-engine.js).
 * En Phase 1, ils créent les états mais ne les utilisent pas pour le calcul.
 * ===================================================================== */

function rjInitDriverPersonalitiesAtSeason(GG) {
  // Crée un style/mental persistant pour chaque rival au début de saison.
  // Appelé depuis startNextSeason / initRivals dans 04 ou 05.
  if (!GG || !GG.rivals) return;
  
  GG.rivals.forEach(function(rival) {
    // Trait inventé pour les rivaux (G.rivals n'en a pas par défaut, on le simule)
    if (!rival._trait) {
      var traits = ["competiteur", "sangfroid", "leader", "perfectionniste", "intuitif", "instinctif", "analyste"];
      rival._trait = traits[Math.floor(Math.random() * traits.length)];
    }
    
    if (!rival._rjState) {
      rival._rjState = {
        mental: rjBuildDriverMental(rival._trait),
        style:  rjBuildDriverStyle(rival.skill || 70, rival._trait, rival),
        relations: { rivals: {}, teammate: null }
      };
    }
  });
  
  // État joueur : on le crée une fois et on le réutilise
  if (!GG._playerRjState) {
    GG._playerRjState = {
      mental: rjBuildDriverMental(GG.pilot && GG.pilot.trait),
      style:  rjBuildDriverStyle(75, GG.pilot && GG.pilot.trait, null),
      relations: { rivals: {}, teammate: null }
    };
  }
}

function rjInitDriverStatesForRace(LR) {
  // Appelé au début de runRaceLive, après que LIVE_RACE.drivers soit construit.
  // Attache un _rjDriverState et un _rjCarState à chaque driver.
  if (!LR || !LR.drivers || !LR.drivers.length) return;
  
  // S'assurer que les personnalités saison existent
  rjInitDriverPersonalitiesAtSeason(G);
  
  var weatherId = (typeof RACE_STATE !== "undefined" && RACE_STATE.weather) ? RACE_STATE.weather.id : "dry";
  
  LR.drivers.forEach(function(d) {
    if (d.isPlayer) {
      d._rjDriverState = rjBuildDriverState(d, true, G._playerRjState);
      d._rjCarState    = rjBuildCarState(d, true, weatherId);
    } else {
      // Trouve le rival source
      var rival = (typeof d.rivalIdx === "number" && G.rivals && G.rivals[d.rivalIdx]) ? G.rivals[d.rivalIdx] : null;
      d._rjDriverState = rjBuildDriverState(d, false, rival && rival._rjState);
      d._rjCarState    = rjBuildCarState(d, false, weatherId);
    }
  });
  
  // Tag pour debug : on sait que la course tourne avec les nouveaux états
  LR._rjStatesActive = true;
  LR._rjPhase = 1;
}

/* ========================================================================
 * 6. DIAGNOSTIC CONSOLE
 * Pour vérifier visuellement que les états sont bien créés.
 * Tape `rjDebugStates()` dans la console pendant une course.
 * ===================================================================== */

function rjDebugStates() {
  if (typeof LIVE_RACE === "undefined" || !LIVE_RACE || !LIVE_RACE.drivers) {
    console.log("[RJ Debug] Pas de course active");
    return;
  }
  if (!LIVE_RACE._rjStatesActive) {
    console.log("[RJ Debug] États RJ non initialisés sur cette course");
    return;
  }
  
  console.log("=== RJ DRIVER STATES — Phase " + (LIVE_RACE._rjPhase || "?") + " ===");
  console.log("Tour " + LIVE_RACE.cur + "/" + LIVE_RACE.total);
  
  LIVE_RACE.drivers.forEach(function(d) {
    var s = d._rjDriverState;
    var c = d._rjCarState;
    if (!s || !c) return;
    
    var label = d.isPlayer ? "★ " + d.name : "  " + d.name;
    var mental = s.mental;
    var avgTyreWear = ((c.tyres.FL.wear + c.tyres.FR.wear + c.tyres.RL.wear + c.tyres.RR.wear) / 4).toFixed(1);
    var avgTyreTemp = ((c.tyres.FL.temp + c.tyres.FR.temp + c.tyres.RL.temp + c.tyres.RR.temp) / 4).toFixed(0);
    
    console.log(
      label.padEnd(28) +
      " | conf=" + Math.round(mental.confidence) +
      " press=" + Math.round(mental.pressure) +
      " agg=" + Math.round(mental.aggression) +
      " mom=" + Math.round(mental.momentum) +
      " | pneu=" + c.tyres.compoundProfile + " usu=" + avgTyreWear + "% T=" + avgTyreTemp + "°"
    );
  });
}

function rjDebugStateOf(driverName) {
  // Affiche les détails complets d'un pilote spécifique
  if (typeof LIVE_RACE === "undefined" || !LIVE_RACE || !LIVE_RACE.drivers) {
    console.log("[RJ Debug] Pas de course active");
    return;
  }
  var d = LIVE_RACE.drivers.find(function(dd) {
    return dd.name && dd.name.toLowerCase().indexOf((driverName || "").toLowerCase()) >= 0;
  });
  if (!d) {
    console.log("[RJ Debug] Pilote non trouvé : " + driverName);
    return;
  }
  console.log("=== " + d.name + " ===");
  console.log("Mental :", d._rjDriverState && d._rjDriverState.mental);
  console.log("Style  :", d._rjDriverState && d._rjDriverState.style);
  console.log("Pneus  :", d._rjCarState && d._rjCarState.tyres);
  console.log("Fuel   :", d._rjCarState && d._rjCarState.fuel);
  console.log("Engine :", d._rjCarState && d._rjCarState.engine);
}

/* ========================================================================
 * 7. AUTO-INSTALLATION DU HOOK
 * On installe un wrapper sur runRaceLive qui appelle rjInitDriverStatesForRace
 * juste après la construction de LIVE_RACE.drivers.
 * Ce wrapper est non-invasif : il ne modifie pas le comportement de la course.
 * ===================================================================== */

(function rjInstallHook() {
  if (typeof window === "undefined" || typeof runRaceLive !== "function") {
    // Pas en navigateur ou runRaceLive pas encore défini → on retentera plus tard
    if (typeof setTimeout !== "undefined") {
      setTimeout(rjInstallHook, 50);
    }
    return;
  }
  
  if (window._rjHookInstalled) return;
  window._rjHookInstalled = true;
  
  var originalRunRaceLive = window.runRaceLive;
  window.runRaceLive = function rjWrappedRunRaceLive() {
    var result = originalRunRaceLive.apply(this, arguments);
    
    // Après que runRaceLive ait construit LIVE_RACE.drivers, on initialise les états
    // setTimeout 0 pour laisser la fin de runRaceLive se compléter d'abord
    setTimeout(function() {
      try {
        rjInitDriverStatesForRace(typeof LIVE_RACE !== "undefined" ? LIVE_RACE : null);
        if (window._rjVerbose) {
          console.log("[RJ] DriverStates initialisés pour " + (LIVE_RACE.drivers || []).length + " pilotes");
        }
      } catch(e) {
        console.warn("[RJ] Erreur init DriverStates:", e);
      }
    }, 0);
    
    return result;
  };
  
  // FIX BUG 1 — Sanitize des positions après updateLivePositions
  // Le système legacy a un anti-saut (maxJump=2) qui peut générer des positions
  // au-delà du nombre de pilotes quand plusieurs scores varient simultanément
  // (cas amplifié par les Phases 2-5 qui modifient le score activement).
  // Ce wrapper s'installe SUR le 04 original, AVANT tous les autres wrappers,
  // donc il s'exécute EN DERNIER dans la pile d'appels — parfait pour un cleanup.
  if (typeof window.updateLivePositions === "function" && !window._rjPositionFixInstalled) {
    window._rjPositionFixInstalled = true;
    var origUpdateLivePos = window.updateLivePositions;
    window.updateLivePositions = function rjPositionSanitizer() {
      var result = origUpdateLivePos.apply(this, arguments);
      
      try {
        if (LIVE_RACE && LIVE_RACE.drivers && LIVE_RACE.drivers.length) {
          var aliveDrivers = LIVE_RACE.drivers.filter(function(d){ return !d.dnf; });
          var totalAlive = aliveDrivers.length;
          
          // Détecte les positions dépassantes
          var hasOverflow = false;
          aliveDrivers.forEach(function(d) {
            if (d.pos > totalAlive) hasOverflow = true;
          });
          
          if (hasOverflow) {
            // Normalisation : on retrie par score effectif et on assigne les positions 1..N
            var sortedAlive = aliveDrivers.slice().sort(function(a, b) {
              var sa = a.score - (a.penaltySec || 0) / 45;
              var sb = b.score - (b.penaltySec || 0) / 45;
              return sb - sa;
            });
            sortedAlive.forEach(function(d, idx) {
              d.pos = idx + 1;
            });
            // Réassigne les positions DNF
            var nextPos = totalAlive + 1;
            LIVE_RACE.drivers.filter(function(d){ return d.dnf; }).forEach(function(d) {
              d.pos = nextPos++;
            });
          }
        }
      } catch(e) {
        console.warn("[RJ] Erreur sanitize positions:", e && e.message);
      }
      
      return result;
    };
  }
  
  // FIX BUG 2 — Arrondir penaltySec après chaque update
  // Le legacy _applyPitPenaltyForTargetDrop calcule des nombres flottants
  // non arrondis comme 5.111111115. On les arrondit à 1 décimale pour l'affichage.
  // Et on patch toutes les places où penaltySec est lu pour l'affichage du leaderboard.
  if (!window._rjPenaltyFixInstalled) {
    window._rjPenaltyFixInstalled = true;
    
    // Hook léger : à chaque updateLivePositions, on arrondit les penaltySec
    // de tous les pilotes à 1 décimale.
    var prevUpd2 = window.updateLivePositions;
    window.updateLivePositions = function rjPenaltyRounder() {
      try {
        if (LIVE_RACE && LIVE_RACE.drivers) {
          LIVE_RACE.drivers.forEach(function(d) {
            if (typeof d.penaltySec === "number" && d.penaltySec > 0) {
              // Arrondi à 1 décimale, en évitant les décalages de tri
              d.penaltySec = Math.round(d.penaltySec * 10) / 10;
            }
          });
        }
      } catch(e) {}
      return prevUpd2.apply(this, arguments);
    };
  }
  
  console.log("[RJ] Module Phase 1 chargé — états mental/voiture disponibles via rjDebugStates()");
})();
