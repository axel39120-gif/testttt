/* =====================================================================
 * 04f-track-life.js — REFONTE PHASE 5
 * 
 * La piste devient vivante :
 *   1. Évolution du grip général : cold → rubber-in → peak → degraded
 *   2. Trafic backmarkers : les pilotes lents ralentissent ceux qui les croisent
 *   3. Drapeaux jaunes localisés : émergent des events Phase 3 (wide, contact)
 *   4. Safety car émergent : déclenché par un incident sévère réel d'un pilote
 * 
 * ARCHITECTURE :
 *   - Nouveau TRACK_STATE qui vit dans LIVE_RACE._track
 *   - Update à chaque tour via hook updateLivePositions
 *   - Effets appliqués sur driver.score (lissés et bornés)
 * 
 * COMPORTEMENT ÉMERGENT ATTENDU :
 *   - Tour 1-5 : grip bas (0.96), tout le monde un peu lent
 *   - Tour 5-30 : grip optimal (1.0-1.02), course "normale"
 *   - Tour 30+ : grip dégrade (gomme s'use, surface cracke)
 *   - Si Hamilton sort large fort → secteur jaune pendant 2-3 tours,
 *     ralentit les pilotes qui passent
 *   - Si incident très sévère → safety car déclenché
 * 
 * EXPOSE :
 *   - rjGetTrackState()                  → état actuel de la piste
 *   - rjGetGripMultiplier()              → multiplicateur grip courant
 *   - rjIsSafetyCarActive()              → bool
 *   - rjGetActiveYellowSectors()         → liste des secteurs jaunes
 *   - rjDebugTrack()                     → affichage console
 * ===================================================================== */

/* ========================================================================
 * 1. PROFILS D'ÉVOLUTION DU GRIP
 * 
 * Le grip de piste évolue selon une courbe :
 *   - Tour 1-3 (cold)      : 0.96 (gomme froide, peu de trace)
 *   - Tour 3-8 (rubber-in) : 0.96 → 1.00 (caoutchouc se dépose)
 *   - Tour 8-30 (peak)     : 1.00 → 1.02 (peak grip)
 *   - Tour 30+ (degraded)  : 1.02 → 0.98 (surface se crackelle, débris)
 * 
 * Modulation par météo :
 *   - Pluie : grip plafonné à 0.92, lessive le gommage
 *   - Hot   : grip max 1.04 (peak plus haut) mais dégrade plus vite
 * ===================================================================== */

function _rjComputeTrackGrip(lap, total, weatherId) {
  if (total < 1) return 1.0;
  
  var pct = lap / total;
  var baseGrip;
  
  // Courbe d'évolution
  if (pct < 0.06) {
    // Phase cold (3-6% de la course)
    baseGrip = 0.96 + (pct / 0.06) * 0.01;  // 0.96 → 0.97
  } else if (pct < 0.18) {
    // Rubber-in
    baseGrip = 0.97 + ((pct - 0.06) / 0.12) * 0.03;  // 0.97 → 1.00
  } else if (pct < 0.65) {
    // Peak
    baseGrip = 1.00 + ((pct - 0.18) / 0.47) * 0.02;  // 1.00 → 1.02
  } else if (pct < 0.85) {
    // Plateau dégradant
    baseGrip = 1.02 - ((pct - 0.65) / 0.20) * 0.015; // 1.02 → 1.005
  } else {
    // Fin : dégradation accélérée
    baseGrip = 1.005 - ((pct - 0.85) / 0.15) * 0.025; // 1.005 → 0.98
  }
  
  // Modulation météo
  if (weatherId === "wet" || weatherId === "storm") {
    // Pluie : la piste ne se gomme pas, et lessive si elle l'avait fait
    baseGrip = Math.min(baseGrip, 0.93);
  } else if (weatherId === "hot") {
    // Chaud : peak un peu plus haut MAIS dégradation plus rapide
    if (pct < 0.65) baseGrip += 0.01;
    else baseGrip -= 0.01;
  } else if (weatherId === "cloudy") {
    // Nuageux : peak un peu plus bas (moins chaud)
    baseGrip -= 0.005;
  }
  
  return baseGrip;
}

/* ========================================================================
 * 2. STRUCTURE TRACK_STATE
 * Initialisée au début de course, vit dans LIVE_RACE._track
 * ===================================================================== */

function _rjInitTrackState() {
  if (!LIVE_RACE) return;
  
  LIVE_RACE._track = {
    grip: 0.96,                  // multiplicateur actuel
    
    yellowSectors: [],           // liste de {sectorId, lapsRemaining, severity, originDriver}
    
    safetyCar: {
      active: false,
      lapsRemaining: 0,
      lapStarted: 0,
      reason: null
    },
    
    trafficZones: [],            // pilotes lents qui constituent du trafic (calculé chaque tour)
    
    incidents: []                // log des incidents qui ont créé événements piste
  };
}

/* ========================================================================
 * 3. ÉVOLUTION DU GRIP À CHAQUE TOUR
 * ===================================================================== */

function _rjUpdateTrackGrip() {
  if (!LIVE_RACE || !LIVE_RACE._track) return;
  
  var weatherId = (typeof RACE_STATE !== "undefined" && RACE_STATE.weather) ? RACE_STATE.weather.id : "dry";
  var newGrip = _rjComputeTrackGrip(LIVE_RACE.cur, LIVE_RACE.total, weatherId);
  
  // Lissage : convergence douce vers le nouveau grip
  LIVE_RACE._track.grip += (newGrip - LIVE_RACE._track.grip) * 0.4;
}

/* ========================================================================
 * 4. APPLICATION DU GRIP DE PISTE
 * Le grip de piste s'applique TRÈS subtilement au score (le pilote roule
 * un poil plus vite ou lentement selon l'état de la surface).
 * Tous les pilotes sont affectés équitablement.
 * 
 * Effet maximum : ±0.04% par tour (très léger, mais cumulé sur 50 tours
 * peut faire 0.5-1s de variation totale, ce qui est crédible).
 * ===================================================================== */

function _rjApplyTrackGripToDrivers() {
  if (!LIVE_RACE || !LIVE_RACE._track || !LIVE_RACE.drivers) return;
  
  var grip = LIVE_RACE._track.grip;
  // Delta autour de 1.0
  var delta = (grip - 1.0) * 0.0008;  // grip 0.96 → -0.032% ; grip 1.02 → +0.016%
  // Cap dur
  delta = Math.max(-0.001, Math.min(0.001, delta));
  
  if (Math.abs(delta) < 0.00005) return; // négligeable
  
  LIVE_RACE.drivers.forEach(function(d) {
    if (d.dnf) return;
    d.score = Math.max(0.02, Math.min(0.99, d.score + delta));
  });
}

/* ========================================================================
 * 5. TRAFIC BACKMARKERS
 * On identifie les pilotes "backmarkers" (les 3-4 derniers en piste) et,
 * quand un leader est à courte distance derrière eux, on lui inflige un
 * petit malus de score (bloqué par le trafic).
 * 
 * Pour éviter d'appliquer ça à chaque pilote (coûteux en CPU), on le fait
 * juste sur le top 10 quand ils croisent un backmarker.
 * ===================================================================== */

function _rjUpdateTraffic() {
  if (!LIVE_RACE || !LIVE_RACE.drivers || LIVE_RACE.drivers.length < 8) return;
  
  // Identifier les backmarkers : 3 derniers non-DNF
  var sorted = LIVE_RACE.drivers.slice().filter(function(d) { return !d.dnf; })
                                .sort(function(a, b) { return (a.pos || 99) - (b.pos || 99); });
  if (sorted.length < 8) return;
  
  // Sur une course longue (50 tours), le leader prend ~1-2 tours à des backmarkers.
  // On simule ça par une probabilité par tour appliquée au top 5 (pilotes les plus
  // susceptibles de devoir négocier du trafic en F1).
  // 
  // Probabilité par tour : 8% de croiser du trafic pour les top 5
  // → sur 50 tours, ~4 occurrences total répartis = crédible
  
  var top5 = sorted.slice(0, 5);
  
  top5.forEach(function(leader) {
    if (leader.dnf) return;
    
    // Pas de trafic dans les 5 premiers tours (peloton encore groupé)
    if (LIVE_RACE.cur < 5) return;
    // Pas de trafic en fin de course (les retardataires ont fini ou sont loin)
    if (LIVE_RACE.cur / LIVE_RACE.total > 0.92) return;
    
    if (Math.random() < 0.08) {
      // Léger malus
      leader.score = Math.max(0.02, leader.score - 0.0010);
      
      // Update mental : frustration légère
      if (leader._rjDriverState) {
        leader._rjDriverState.mental.frustration = Math.min(100, 
          (leader._rjDriverState.mental.frustration || 0) + 3);
      }
      
      // Log
      if (!LIVE_RACE._track.trafficZones) LIVE_RACE._track.trafficZones = [];
      LIVE_RACE._track.trafficZones.push({
        lap: LIVE_RACE.cur,
        leader: leader.name,
        type: "backmarker_block"
      });
      if (LIVE_RACE._track.trafficZones.length > 10) {
        LIVE_RACE._track.trafficZones = LIVE_RACE._track.trafficZones.slice(-10);
      }
    }
  });
}

/* ========================================================================
 * 6. DRAPEAUX JAUNES LOCALISÉS
 * Quand une IA a un événement narratif sévère (wide_corner critique, ou un
 * combo de plusieurs events négatifs récents), on déclenche un secteur
 * jaune temporaire de 2-3 tours.
 * 
 * Tous les pilotes qui "passent par" ce secteur (en pratique, tous les pilotes
 * proches en position) ralentissent légèrement.
 * 
 * On ne déclenche jamais 2 jaunes simultanés en début de course (frustrant).
 * ===================================================================== */

function _rjDetectIncidentForYellow(driver) {
  // Détecte si un pilote a eu un événement assez fort pour mériter un drapeau jaune
  if (!driver || !driver._rjLastLap || !driver._rjLastLap.events) return null;
  
  // Cherche dans les events de ce tour
  var events = driver._rjLastLap.events;
  var severeEvent = null;
  
  events.forEach(function(e) {
    if (e.type === "wide" || e.type === "lockup") {
      // Wide ou gros lockup peut déclencher un jaune si frustration cumulative
      var frust = driver._rjDriverState && driver._rjDriverState.mental.frustration || 0;
      // Plus la frustration est haute, plus la probabilité monte
      var prob = 0.10 + (frust / 200);  // 10% base, jusqu'à 60%
      if (Math.random() < prob) {
        severeEvent = e;
      }
    }
  });
  
  return severeEvent;
}

function _rjUpdateYellowSectors() {
  if (!LIVE_RACE || !LIVE_RACE._track) return;
  
  // 1. Decay des jaunes existants
  LIVE_RACE._track.yellowSectors = LIVE_RACE._track.yellowSectors.filter(function(y) {
    y.lapsRemaining--;
    return y.lapsRemaining > 0;
  });
  
  // 2. Pas de nouveau jaune si on en a déjà un actif (évite saturation)
  if (LIVE_RACE._track.yellowSectors.length > 0) return;
  
  // 3. Pas de jaune en début de course (premiers 8% des tours)
  if (LIVE_RACE.cur / LIVE_RACE.total < 0.08) return;
  
  // 4. Pas de jaune si SC actif
  if (LIVE_RACE._track.safetyCar.active) return;
  
  // 5. Cherche un pilote qui aurait incident sévère ce tour
  for (var i = 0; i < LIVE_RACE.drivers.length; i++) {
    var d = LIVE_RACE.drivers[i];
    if (d.dnf) continue;
    
    var incident = _rjDetectIncidentForYellow(d);
    if (incident) {
      // Cooldown : pas plus d'un jaune toutes les 5 tours
      if (LIVE_RACE._track._lastYellowLap && 
          LIVE_RACE.cur - LIVE_RACE._track._lastYellowLap < 5) break;
      
      LIVE_RACE._track._lastYellowLap = LIVE_RACE.cur;
      
      // Détermine le secteur (pseudo-aléatoire stable basé sur driver + lap)
      var sectorId = ["S1", "S2", "S3"][Math.floor(Math.random() * 3)];
      var duration = 2 + Math.floor(Math.random() * 2);  // 2 ou 3 tours
      
      LIVE_RACE._track.yellowSectors.push({
        sectorId: sectorId,
        lapsRemaining: duration,
        severity: 0.5,  // 0..1
        originDriver: d.name,
        startLap: LIVE_RACE.cur
      });
      
      // Log dans incidents
      LIVE_RACE._track.incidents.push({
        lap: LIVE_RACE.cur,
        type: "yellow_flag",
        sector: sectorId,
        origin: d.name,
        text: d.name + " sortie large " + sectorId + " — drapeau jaune"
      });
      if (LIVE_RACE._track.incidents.length > 20) {
        LIVE_RACE._track.incidents = LIVE_RACE._track.incidents.slice(-20);
      }
      
      break; // un seul nouveau jaune par tour
    }
  }
}

function _rjApplyYellowSectorEffects() {
  if (!LIVE_RACE || !LIVE_RACE._track || !LIVE_RACE.drivers) return;
  if (LIVE_RACE._track.yellowSectors.length === 0) return;
  
  // Effet : tous les pilotes ralentissent légèrement quand ils traversent le secteur
  // Approximation : on applique un micro-malus à tous les pilotes (sauf l'originDriver
  // qui a déjà eu son malus via l'event), pour symboliser le respect du drapeau jaune.
  
  var totalSeverity = 0;
  LIVE_RACE._track.yellowSectors.forEach(function(y) {
    totalSeverity += y.severity;
  });
  
  // Malus très léger (chaque pilote perd 0.05% de score, soit ~0.02s)
  var malus = -0.0005 * Math.min(2, totalSeverity);
  
  LIVE_RACE.drivers.forEach(function(d) {
    if (d.dnf) return;
    d.score = Math.max(0.02, d.score + malus);
  });
}

/* ========================================================================
 * 7. SAFETY CAR ÉMERGENT
 * Déclenché par un incident très sévère :
 *   - Un pilote qui a 3+ events négatifs dans les 3 derniers tours
 *   - Combiné à une frustration > 80
 *   - OU un wide critique en zone à risque
 * 
 * Effet du SC :
 *   - Resserre les écarts de score (effet "compression")
 *   - Dure 4-6 tours
 *   - Lift les jaunes existants (englobe tout)
 * 
 * Très rare en jeu : ~10-15% de chance par course.
 * ===================================================================== */

function _rjDetectSCTrigger() {
  if (!LIVE_RACE) return null;
  
  // Pas de SC si déjà actif ou si fin de course très proche
  if (LIVE_RACE._track.safetyCar.active) return null;
  if (LIVE_RACE.cur / LIVE_RACE.total > 0.92) return null;
  
  // Pas de SC dans les 5 premiers tours (laisse la course démarrer)
  if (LIVE_RACE.cur < 5) return null;
  
  // Cooldown global : pas plus d'un SC par course
  if (LIVE_RACE._track._scAlreadyTriggered) return null;
  
  // Probabilité de base très faible
  var baseProb = 0.005;  // 0.5% par tour de check
  
  // Cherche un pilote avec incident sévère
  for (var i = 0; i < LIVE_RACE.drivers.length; i++) {
    var d = LIVE_RACE.drivers[i];
    if (d.dnf) continue;
    if (!d._rjDriverState) continue;
    
    var frust = d._rjDriverState.mental.frustration || 0;
    var negEventsRecent = 0;
    
    if (d._rjLapHistory) {
      d._rjLapHistory.slice(-5).forEach(function(e) {
        if (!e.isPositive) negEventsRecent++;
      });
    }
    
    // Trigger si 3+ events négatifs récents ET frustration haute
    // OU 4+ events négatifs (même sans frustration extrême)
    var canTrigger = (negEventsRecent >= 3 && frust > 65) || (negEventsRecent >= 4 && frust > 50);
    
    if (canTrigger && Math.random() < (baseProb + 0.03)) {
      return {
        originDriver: d.name,
        reason: "incident_severe",
        negEvents: negEventsRecent,
        frust: frust
      };
    }
  }
  
  return null;
}

function _rjTriggerSafetyCar(trigger) {
  if (!LIVE_RACE || !LIVE_RACE._track) return;
  
  LIVE_RACE._track.safetyCar = {
    active: true,
    lapsRemaining: 4 + Math.floor(Math.random() * 3),  // 4-6 tours
    lapStarted: LIVE_RACE.cur,
    reason: trigger.reason,
    originDriver: trigger.originDriver
  };
  LIVE_RACE._track._scAlreadyTriggered = true;
  
  // Lift les jaunes existants (englobé par le SC)
  LIVE_RACE._track.yellowSectors = [];
  
  // Compression des écarts : tout le monde se rapproche du leader
  // On normalise les scores en gardant l'ordre mais en réduisant les gaps
  var sorted = LIVE_RACE.drivers.slice().filter(function(d) { return !d.dnf; })
                                .sort(function(a, b) { return b.score - a.score; });
  if (sorted.length > 0) {
    var leaderScore = sorted[0].score;
    sorted.forEach(function(d, idx) {
      // Compression : 30% de l'écart actuel se résorbe
      var gap = leaderScore - d.score;
      d.score = leaderScore - gap * 0.7;
    });
  }
  
  // Log
  LIVE_RACE._track.incidents.push({
    lap: LIVE_RACE.cur,
    type: "safety_car",
    origin: trigger.originDriver,
    text: "Safety car — incident " + trigger.originDriver
  });
}

function _rjUpdateSafetyCar() {
  if (!LIVE_RACE || !LIVE_RACE._track) return;
  
  // 1. Decay du SC actif
  if (LIVE_RACE._track.safetyCar.active) {
    LIVE_RACE._track.safetyCar.lapsRemaining--;
    if (LIVE_RACE._track.safetyCar.lapsRemaining <= 0) {
      LIVE_RACE._track.safetyCar.active = false;
      LIVE_RACE._track.incidents.push({
        lap: LIVE_RACE.cur,
        type: "safety_car_end",
        text: "Restart"
      });
    }
    return;  // pas de nouveau SC pendant qu'un est actif
  }
  
  // 2. Trigger possible
  var trigger = _rjDetectSCTrigger();
  if (trigger) {
    _rjTriggerSafetyCar(trigger);
  }
}

/* ========================================================================
 * 8. ACCESSEURS PUBLICS
 * ===================================================================== */

function rjGetTrackState() {
  if (!LIVE_RACE) return null;
  return LIVE_RACE._track || null;
}

function rjGetGripMultiplier() {
  if (!LIVE_RACE || !LIVE_RACE._track) return 1.0;
  return LIVE_RACE._track.grip;
}

function rjIsSafetyCarActive() {
  if (!LIVE_RACE || !LIVE_RACE._track) return false;
  return LIVE_RACE._track.safetyCar && LIVE_RACE._track.safetyCar.active;
}

function rjGetActiveYellowSectors() {
  if (!LIVE_RACE || !LIVE_RACE._track) return [];
  return LIVE_RACE._track.yellowSectors.slice();
}

function rjDebugTrack() {
  if (typeof LIVE_RACE === "undefined" || !LIVE_RACE) {
    console.log("[RJ] Pas de course active");
    return;
  }
  if (!LIVE_RACE._track) {
    console.log("[RJ] Track state non initialisé");
    return;
  }
  
  var t = LIVE_RACE._track;
  console.log("=== RJ TRACK STATE — Tour " + LIVE_RACE.cur + "/" + LIVE_RACE.total + " ===");
  console.log("Grip de piste : " + t.grip.toFixed(4) + 
    "  (cold<0.97 / rubber 0.97-1.0 / peak 1.0-1.02 / degraded >0.65 race)");
  
  if (t.yellowSectors.length > 0) {
    console.log("Drapeaux jaunes actifs :");
    t.yellowSectors.forEach(function(y) {
      console.log("  " + y.sectorId + " — " + y.lapsRemaining + " tour(s) restant(s) — origine : " + y.originDriver);
    });
  } else {
    console.log("Pas de drapeau jaune actif");
  }
  
  if (t.safetyCar.active) {
    console.log("⚠ SAFETY CAR actif — " + t.safetyCar.lapsRemaining + " tour(s) restant(s) — origine : " + t.safetyCar.originDriver);
  } else {
    console.log("Pas de safety car");
  }
  
  if (t.incidents && t.incidents.length > 0) {
    console.log("Derniers incidents :");
    t.incidents.slice(-5).forEach(function(i) {
      console.log("  Tour " + i.lap + " — " + (i.text || i.type));
    });
  }
}

/* ========================================================================
 * 9. HOOK PRINCIPAL
 * On wrappe à nouveau updateLivePositions pour exécuter la phase de
 * piste vivante après l'IA décisionnelle de Phase 4.
 * ===================================================================== */

(function rjInstallTrackLifeHook() {
  if (typeof window === "undefined") return;
  if (window._rjTrackLifeHookInstalled) return;
  window._rjTrackLifeHookInstalled = true;
  
  var prevUpdate = window.updateLivePositions;
  if (typeof prevUpdate !== "function") {
    if (typeof setTimeout !== "undefined") setTimeout(rjInstallTrackLifeHook, 50);
    return;
  }
  
  window.updateLivePositions = function rjPhase5WrappedUpdateLivePos() {
    var result = prevUpdate.apply(this, arguments);
    
    try {
      if (LIVE_RACE && LIVE_RACE._rjPhase >= 1 && LIVE_RACE.drivers && !LIVE_RACE.finished) {
        // Init du track state au tour 1 si pas fait
        if (!LIVE_RACE._track && LIVE_RACE.cur >= 1) {
          _rjInitTrackState();
        }
        
        // 1 update par tour, après tout le reste
        if (LIVE_RACE._track && LIVE_RACE._rjLastTrackUpdate !== LIVE_RACE.cur && 
            LIVE_RACE._rjLastAIDecided === LIVE_RACE.cur) {
          LIVE_RACE._rjLastTrackUpdate = LIVE_RACE.cur;
          LIVE_RACE._rjPhase = Math.max(LIVE_RACE._rjPhase || 1, 5);
          
          // 1. Update grip de piste
          _rjUpdateTrackGrip();
          _rjApplyTrackGripToDrivers();
          
          // 2. Update trafic backmarkers
          _rjUpdateTraffic();
          
          // 3. Update jaunes localisés (decay + détection nouveaux)
          _rjUpdateYellowSectors();
          _rjApplyYellowSectorEffects();
          
          // 4. Update safety car (decay + détection trigger)
          _rjUpdateSafetyCar();
        }
      }
    } catch(e) {
      console.warn("[RJ] Erreur track life:", e && e.message);
    }
    
    return result;
  };
  
  console.log("[RJ] Module Phase 5 chargé — piste vivante. Debug: rjDebugTrack()");
})();
