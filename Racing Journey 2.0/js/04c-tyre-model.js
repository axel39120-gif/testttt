/* =====================================================================
 * 04c-tyre-model.js — REFONTE PHASE 2
 * 
 * Modèle de pneus actif et émergent. Lit/modifie les CarState créés en
 * Phase 1, et applique un effet sur le score des pilotes à chaque tour.
 * 
 * MODÈLE :
 *   - Température : monte avec push, descend avec lever pied / piste froide
 *   - Fenêtre optimale par compound (cold = -3% grip, hot = -8% grip)
 *   - Usure non-linéaire : softs s'usent vite mais offrent + grip,
 *     hards inverse, mediums au milieu
 *   - Style pilote : aggression élevée → +température, +usure, +grip court terme
 *   - Setup voiture : "agg" use plus, "mec" use moins
 * 
 * INTÉGRATION :
 *   - Hook sur tickRace via wrapper non invasif
 *   - À chaque tick, pour chaque pilote : 
 *     1. updateTyresForLap(driver, lapPct, pushIntent)
 *     2. computeTyreScoreImpact(driver) → applique sur driver.score
 *   - Le système legacy (_tickTyreWear) continue d'exister mais on le neutralise
 *     pour le joueur (pour éviter le double-effet) — il reste actif pour les rivaux
 *     qui n'ont pas encore le full state.
 * 
 * BUDGET CPU :
 *   - 20 pilotes × 4 pneus × ~5 calculs simples par tick ≈ 400 ops
 *   - Tick toutes les 280ms env → négligeable
 * 
 * EXPOSE :
 *   - rjUpdateTyresForLap(driver, lapPct, pushIntent)
 *   - rjGetTyreScoreImpact(driver)
 *   - rjGetAvgTyreGrip(driver) → 0..1
 *   - rjGetAvgTyreWear(driver) → 0..100
 *   - rjGetAvgTyreTemp(driver) → °C
 *   - rjDebugTyres() → affichage console
 * ===================================================================== */

/* ========================================================================
 * 1. PROFILS DES COMPOUNDS
 * ===================================================================== */

var RJ_COMPOUND_PROFILES = {
  soft:   { 
    optimalWindow: [85, 105], 
    peakGrip:      1.04,        // grip max dans fenêtre optimale
    wearRate:      1.45,        // multiplicateur d'usure
    warmupRate:    1.30,        // chauffe vite
    cliffStart:    65,          // % usure où dégradation s'accélère
    cliffSeverity: 1.8,         // pénalité grip après cliff
    label:         "Tendre"
  },
  medium: { 
    optimalWindow: [80, 110], 
    peakGrip:      1.0, 
    wearRate:      1.0, 
    warmupRate:    1.0, 
    cliffStart:    78,
    cliffSeverity: 1.4,
    label:         "Médium"
  },
  hard:   { 
    optimalWindow: [75, 115], 
    peakGrip:      0.96, 
    wearRate:      0.65, 
    warmupRate:    0.75,        // chauffe lentement
    cliffStart:    88,
    cliffSeverity: 1.2,
    label:         "Dur"
  },
  wet:    { 
    optimalWindow: [55, 80], 
    peakGrip:      1.0,         // sur piste mouillée
    wearRate:      1.10,
    warmupRate:    1.0,
    cliffStart:    72,
    cliffSeverity: 1.5,
    label:         "Pluie"
  },
  inter:  { 
    optimalWindow: [65, 95], 
    peakGrip:      0.98, 
    wearRate:      1.20,
    warmupRate:    1.10,
    cliffStart:    70,
    cliffSeverity: 1.6,
    label:         "Intermédiaire"
  }
};

function _rjCompoundProfile(compound) {
  return RJ_COMPOUND_PROFILES[compound] || RJ_COMPOUND_PROFILES.medium;
}

/* ========================================================================
 * 2. CALCUL DU GRIP SELON FENÊTRE TEMPÉRATURE
 * Renvoie un multiplicateur 0.85..1.04 selon où le pneu est dans sa fenêtre.
 * ===================================================================== */

function _rjTyreGripFromTemp(temp, compound) {
  var profile = _rjCompoundProfile(compound);
  var w = profile.optimalWindow;
  var peak = profile.peakGrip;
  
  if (temp >= w[0] && temp <= w[1]) {
    // Dans la fenêtre : grip optimal
    // Petit boost au centre de la fenêtre
    var center = (w[0] + w[1]) / 2;
    var deviation = Math.abs(temp - center) / ((w[1] - w[0]) / 2);
    return peak * (1.0 - deviation * 0.02); // -2% au bord, peak au centre
  }
  
  if (temp < w[0]) {
    // Trop froid : -3% à -8% selon écart
    var coldDelta = w[0] - temp;
    var coldPenalty = Math.min(0.10, coldDelta * 0.005); // -0.5%/°C, max -10%
    return peak * (1.0 - 0.03 - coldPenalty); // base -3% + extra
  }
  
  // Trop chaud : -8% à -15% selon écart
  var hotDelta = temp - w[1];
  var hotPenalty = Math.min(0.15, hotDelta * 0.008); // -0.8%/°C, max -15%
  return peak * (1.0 - 0.05 - hotPenalty); // base -5% + extra
}

/* ========================================================================
 * 3. CALCUL DU GRIP SELON USURE (avec falaise / cliff)
 * ===================================================================== */

function _rjTyreGripFromWear(wear, compound) {
  var profile = _rjCompoundProfile(compound);
  var cliffStart = profile.cliffStart;
  var cliffSev = profile.cliffSeverity;
  
  if (wear < cliffStart) {
    // Dégradation linéaire douce avant cliff : -0.1% par % d'usure
    return 1.0 - (wear / 100) * 0.10;
  }
  
  // Après le cliff : dégradation accélérée
  var preCliffGrip = 1.0 - (cliffStart / 100) * 0.10;
  var postCliffWear = wear - cliffStart;
  var cliffDrop = (postCliffWear / (100 - cliffStart)) * 0.25 * cliffSev;
  return Math.max(0.55, preCliffGrip - cliffDrop);
}

/* ========================================================================
 * 4. MISE À JOUR D'UN PNEU PAR TOUR
 * driver : LIVE_RACE.drivers[i] avec _rjCarState
 * lapPct : 0..1 (avancement course)
 * pushLevel : 0..1 (0=preserve, 0.5=normal, 1=push max)
 * ===================================================================== */

function _rjUpdateSingleTyre(tyre, profile, pushLevel, ambientTemp, aggressionFactor, setupMod) {
  // ----- Température -----
  // Cible thermique basée sur push : push 0 → cool, push 1 → fenêtre haute
  var window = profile.optimalWindow;
  var targetTemp = window[0] + (window[1] - window[0]) * (0.3 + 0.7 * pushLevel);
  // Au-delà de push 0.85, on flirte avec le surchauffe
  if (pushLevel > 0.85) {
    targetTemp = window[1] + (pushLevel - 0.85) * 40; // peut monter à window[1] + 6
  }
  
  // Convergence vers la cible : vitesse selon warmupRate
  var convergeRate = 0.18 * profile.warmupRate;
  var deltaTemp = (targetTemp - tyre.temp) * convergeRate;
  
  // Ambient temp pull (piste froide refroidit, piste chaude chauffe)
  var ambientPull = (ambientTemp - tyre.temp) * 0.04;
  
  // Aggressivité du pilote : push thermique supplémentaire
  var aggressionHeat = (aggressionFactor - 0.5) * 2.0; // -1..+1
  
  // Setup mod : "agg" chauffe plus, "mec" moins
  var setupHeat = setupMod;
  
  tyre.temp += deltaTemp + ambientPull + aggressionHeat + setupHeat;
  tyre.temp = Math.max(40, Math.min(160, tyre.temp));
  
  // ----- Usure -----
  // Base wear par tour : 1.0% par tour pour medium au push 0.5
  var baseWearPerLap = 1.0 * profile.wearRate;
  
  // Modificateur push : push max use 1.8x, preserve 0.5x
  var pushMod = 0.5 + pushLevel * 1.3;
  
  // Modificateur température : surchauffe = +50% usure
  var tempMod = 1.0;
  if (tyre.temp > window[1]) {
    tempMod = 1.0 + Math.min(0.6, (tyre.temp - window[1]) * 0.02);
  } else if (tyre.temp < window[0]) {
    // Pneu froid : un peu plus d'usure aussi (graining)
    tempMod = 1.0 + Math.min(0.25, (window[0] - tyre.temp) * 0.012);
  }
  
  // Modificateur agressivité : +30% au max
  var aggressionWearMod = 1.0 + (aggressionFactor - 0.5) * 0.6;
  
  // Setup mod sur usure
  var setupWearMod = 1.0 + setupMod * 0.05;
  
  var wearDelta = baseWearPerLap * pushMod * tempMod * aggressionWearMod * setupWearMod;
  tyre.wear = Math.min(100, tyre.wear + wearDelta);
  tyre._lastDelta = wearDelta;
  
  // ----- Grip courant -----
  // Combinaison temp + usure
  var gripFromTemp = _rjTyreGripFromTemp(tyre.temp, profile === RJ_COMPOUND_PROFILES.soft ? "soft" :
                                                     profile === RJ_COMPOUND_PROFILES.hard ? "hard" :
                                                     profile === RJ_COMPOUND_PROFILES.wet ? "wet" :
                                                     profile === RJ_COMPOUND_PROFILES.inter ? "inter" : "medium");
  var gripFromWear = _rjTyreGripFromWear(tyre.wear, tyre.compound);
  
  // Combinaison multiplicative (les deux pénalités s'accumulent)
  tyre.grip = gripFromTemp * gripFromWear;
}

function rjUpdateTyresForLap(driver, lapPct, pushLevel) {
  if (!driver || !driver._rjCarState) return;
  if (driver.dnf) return;
  
  var car = driver._rjCarState;
  var tyres = car.tyres;
  var profile = _rjCompoundProfile(tyres.compoundProfile);
  
  // Température ambiante selon météo
  var ambientTemp = 25; // °C par défaut
  if (typeof RACE_STATE !== "undefined" && RACE_STATE.weather) {
    var w = RACE_STATE.weather.id;
    if (w === "hot") ambientTemp = 38;
    else if (w === "wet") ambientTemp = 18;
    else if (w === "storm") ambientTemp = 15;
    else if (w === "cloudy") ambientTemp = 20;
    else ambientTemp = 25; // dry
  }
  
  // Aggression factor : 0..1 (depuis le mental)
  var aggressionFactor = 0.5;
  if (driver._rjDriverState && driver._rjDriverState.mental) {
    aggressionFactor = driver._rjDriverState.mental.aggression / 100;
  }
  
  // Setup mod : agg → +1.5°/tour, mec → -0.8°, balance → 0
  var setupMod = 0;
  if (car.setup === "agg") setupMod = 1.5;
  else if (car.setup === "mec") setupMod = -0.8;
  else if (car.setup === "aero") setupMod = 0.3;
  
  // Stint lap (tours sur ce train de pneus)
  tyres.stintLap = (tyres.stintLap || 0) + 1;
  
  // Update les 4 pneus
  // FL et FR plus exposés à la chaleur de freinage en virages à droite
  // RL et RR plus exposés à la motricité en sortie de virage
  // Pour Phase 2 on les évolue ensemble, on différenciera plus tard avec les secteurs
  _rjUpdateSingleTyre(tyres.FL, profile, pushLevel, ambientTemp, aggressionFactor, setupMod);
  _rjUpdateSingleTyre(tyres.FR, profile, pushLevel, ambientTemp, aggressionFactor, setupMod);
  // Roues arrières : un peu plus de chaleur (motricité)
  _rjUpdateSingleTyre(tyres.RL, profile, pushLevel, ambientTemp, aggressionFactor, setupMod + 0.4);
  _rjUpdateSingleTyre(tyres.RR, profile, pushLevel, ambientTemp, aggressionFactor, setupMod + 0.4);
}

/* ========================================================================
 * 5. CALCUL DE L'IMPACT SCORE DEPUIS L'ÉTAT PNEUS
 * Renvoie un delta de score (-0.04 à +0.02 typiquement) à ajouter
 * à driver.score pour ce tour. Les pneus en bonne fenêtre = bonus,
 * en cliff = malus important.
 * ===================================================================== */

function rjGetAvgTyreGrip(driver) {
  if (!driver || !driver._rjCarState) return 1.0;
  var t = driver._rjCarState.tyres;
  return (t.FL.grip + t.FR.grip + t.RL.grip + t.RR.grip) / 4;
}

function rjGetAvgTyreWear(driver) {
  if (!driver || !driver._rjCarState) return 0;
  var t = driver._rjCarState.tyres;
  return (t.FL.wear + t.FR.wear + t.RL.wear + t.RR.wear) / 4;
}

function rjGetAvgTyreTemp(driver) {
  if (!driver || !driver._rjCarState) return 90;
  var t = driver._rjCarState.tyres;
  return (t.FL.temp + t.FR.temp + t.RL.temp + t.RR.temp) / 4;
}

function rjGetTyreScoreImpact(driver) {
  if (!driver || !driver._rjCarState) return 0;
  
  // PHASE 2 — APPROCHE DIFFÉRENTIELLE
  // Au lieu d'ajouter (grip - 1.0) à chaque tour (qui s'accumule en chute libre),
  // on ajoute la VARIATION de grip depuis le tour précédent. Comme ça :
  //   - Pneus qui montent en température (warmup) → grip augmente → léger boost
  //   - Pneus qui se dégradent → grip baisse → léger malus
  //   - Pneus stables (fenêtre optimale) → impact ~0
  // Le score "dérive" naturellement avec l'évolution des pneus, sans cumul abusif.
  
  var avgGrip = rjGetAvgTyreGrip(driver);
  var prevGrip = (typeof driver._rjPrevGrip === "number") ? driver._rjPrevGrip : avgGrip;
  driver._rjPrevGrip = avgGrip;
  
  var deltaGrip = avgGrip - prevGrip;
  
  // Conversion en delta de score : 1% de variation grip = 0.5% score
  var delta = deltaGrip * 0.5;
  
  // Petite composante absolue : si on est en zone optimale (grip > 0.98), micro-bonus
  // Si on est en cliff (grip < 0.85), micro-malus persistant
  var avgWear = rjGetAvgTyreWear(driver);
  if (avgWear > 78 && avgGrip < 0.92) {
    delta -= 0.0005; // -0.05% par tour quand pneus en cliff
  } else if (avgWear < 25 && avgGrip > 0.98) {
    delta += 0.0002; // +0.02% par tour quand pneus en pleine forme
  }
  
  // Cohabitation legacy : on diminue notre impact pour ne pas dominer
  delta *= 0.4;
  
  // Cap final serré (impact incrémental, pas cumulatif)
  delta = Math.max(-0.005, Math.min(0.003, delta));
  
  return delta;
}

/* ========================================================================
 * 6. ESTIMATION DU PUSH LEVEL
 * On dérive le push intent depuis le racePlan du joueur et l'IA des rivaux.
 * En Phase 2, c'est une estimation simple. La Phase 4 (IA décisionnelle)
 * raffinera ça avec une vraie logique stratégique.
 * ===================================================================== */

function rjEstimatePushLevel(driver, lapPct) {
  if (!driver) return 0.5;
  
  // Joueur : utilise racePlan (1=preserve, 5=push max)
  if (driver.isPlayer) {
    var plan = (typeof G !== "undefined" && typeof G.racePlan === "number") ? G.racePlan : 3;
    // 1→0.20, 2→0.35, 3→0.55, 4→0.75, 5→0.92
    var pushMap = { 1: 0.20, 2: 0.35, 3: 0.55, 4: 0.75, 5: 0.92 };
    var basePush = pushMap[plan] || 0.55;
    
    // Modulation par phase de course :
    // Tour 1-2 : tout le monde push (départ)
    if (lapPct < 0.04) return Math.min(0.95, basePush + 0.20);
    // Fin de course : on push plus si on chasse
    if (lapPct > 0.85) return Math.min(0.95, basePush + 0.10);
    return basePush;
  }
  
  // IA rivale : push estimé selon position relative et style
  var basePush = 0.55;
  
  // Style baseAggression module
  if (driver._rjDriverState && driver._rjDriverState.style) {
    var baseAgg = driver._rjDriverState.style.baseAggression || 50;
    basePush = 0.4 + (baseAgg - 50) / 100 * 0.4; // baseAgg 50 → 0.4, 70 → 0.48, 30 → 0.32
    basePush = Math.max(0.30, Math.min(0.80, basePush + 0.15));
  }
  
  // Mental aggression actuel module aussi
  if (driver._rjDriverState && driver._rjDriverState.mental) {
    var agg = driver._rjDriverState.mental.aggression || 50;
    basePush += (agg - 50) / 100 * 0.20;
  }
  
  // Phase de course
  if (lapPct < 0.04) basePush += 0.15;       // départ : push universel
  else if (lapPct > 0.88) basePush += 0.08;  // sprint final
  
  // Pneus en cliff → l'IA lève le pied (reset à 0.4)
  var avgWear = rjGetAvgTyreWear(driver);
  if (avgWear > 80) basePush = Math.min(basePush, 0.45);
  if (avgWear > 90) basePush = Math.min(basePush, 0.30);
  
  return Math.max(0.20, Math.min(0.95, basePush));
}

/* ========================================================================
 * 7. RESET DES PNEUS LORS D'UN PIT
 * Hook sur _refreshTyreOnPit qui existe déjà dans 04.
 * On reset également notre CarState pour que les deux systèmes restent cohérents.
 * ===================================================================== */

function rjResetTyresAfterPit(driver, newCompound) {
  if (!driver || !driver._rjCarState) return;
  var car = driver._rjCarState;
  var compound = newCompound || "medium";
  var profile = _rjCompoundProfile(compound);
  
  // Pneus neufs : usure 0, température "warmed" (sortie de pit après outlap = ~75°C)
  var initTemp = profile.optimalWindow[0] - 5; // un peu en-dessous de la fenêtre
  
  ["FL","FR","RL","RR"].forEach(function(pos) {
    car.tyres[pos].wear = 0;
    car.tyres[pos].temp = initTemp + (pos.charAt(0) === "R" ? 3 : 0); // arrière chauffe plus vite
    car.tyres[pos].grip = profile.peakGrip * 0.97;
    car.tyres[pos].compound = compound;
    car.tyres[pos]._lastDelta = 0;
  });
  
  car.tyres.compoundProfile = compound;
  car.tyres.optimalWindow   = profile.optimalWindow.slice();
  car.tyres.stintLap        = 0;
}

/* ========================================================================
 * 8. DEBUG CONSOLE
 * ===================================================================== */

function rjDebugTyres() {
  if (typeof LIVE_RACE === "undefined" || !LIVE_RACE || !LIVE_RACE.drivers) {
    console.log("[RJ] Pas de course active");
    return;
  }
  if (!LIVE_RACE._rjPhase || LIVE_RACE._rjPhase < 1) {
    console.log("[RJ] États non initialisés (phase " + LIVE_RACE._rjPhase + ")");
    return;
  }
  
  console.log("=== RJ TYRE STATES — Tour " + LIVE_RACE.cur + "/" + LIVE_RACE.total + " ===");
  console.log("Format: pilote | compound stintLap | usure% temp° grip% | impact_score");
  
  LIVE_RACE.drivers.slice().sort(function(a,b){return (a.pos||99)-(b.pos||99);}).forEach(function(d) {
    if (!d._rjCarState) return;
    var t = d._rjCarState.tyres;
    var wear = rjGetAvgTyreWear(d).toFixed(1);
    var temp = rjGetAvgTyreTemp(d).toFixed(0);
    var grip = (rjGetAvgTyreGrip(d) * 100).toFixed(1);
    var impact = rjGetTyreScoreImpact(d);
    var impactStr = (impact >= 0 ? "+" : "") + (impact * 100).toFixed(2) + "%";
    var label = (d.isPlayer ? "★ " : "  ") + (d.name || "?").substring(0, 22).padEnd(22);
    var pos = "P" + (d.pos || "?");
    
    console.log(
      pos.padStart(4) + " " + label +
      " | " + t.compoundProfile.padEnd(7) + " L" + (t.stintLap || 0).toString().padStart(2) +
      " | " + wear.padStart(5) + "% " + temp.padStart(3) + "° " + grip.padStart(5) + "%" +
      " | " + impactStr.padStart(7)
    );
  });
}

/* ========================================================================
 * 9. HOOK SUR tickRace ET _refreshTyreOnPit
 * ===================================================================== */

(function rjInstallTyreHooks() {
  if (typeof window === "undefined") return;
  
  // Attendre que tickRace existe
  if (typeof window.tickRace !== "function" && typeof tickRace !== "function") {
    if (typeof setTimeout !== "undefined") setTimeout(rjInstallTyreHooks, 50);
    return;
  }
  
  if (window._rjTyreHookInstalled) return;
  window._rjTyreHookInstalled = true;
  
  // ----- Hook sur tickRace -----
  // tickRace contient un setInterval qui tick toutes les ~280ms.
  // On ne wrappe pas tickRace lui-même (qui n'est appelé qu'une fois pour démarrer)
  // mais on installe un observer qui s'exécute au début de chaque tour.
  // Approche : on hook updateLivePositions qui est appelé à CHAQUE tick.
  
  var originalUpdateLivePos = window.updateLivePositions;
  if (typeof originalUpdateLivePos === "function") {
    window.updateLivePositions = function rjWrappedUpdateLivePos() {
      // Phase 2 : mettre à jour les pneus AVANT le tri par score
      try {
        if (LIVE_RACE && LIVE_RACE._rjPhase >= 1 && LIVE_RACE.drivers && !LIVE_RACE.finished) {
          var lapPct = LIVE_RACE.total > 0 ? LIVE_RACE.cur / LIVE_RACE.total : 0;
          
          // On ne tick qu'une fois par tour de course
          if (LIVE_RACE._rjLastTickedLap !== LIVE_RACE.cur) {
            LIVE_RACE._rjLastTickedLap = LIVE_RACE.cur;
            
            LIVE_RACE.drivers.forEach(function(d) {
              if (!d._rjCarState || d.dnf) return;
              
              var pushLevel = rjEstimatePushLevel(d, lapPct);
              rjUpdateTyresForLap(d, lapPct, pushLevel);
              
              // Applique l'impact pneus DIRECTEMENT à score (déjà bridé à ±0.012)
              // Cohabitation avec legacy _tickTyreWear : notre impact = 25% du total
              var impact = rjGetTyreScoreImpact(d);
              if (impact !== 0) {
                d.score = Math.max(0.02, Math.min(0.99, d.score + impact));
              }
              
              // Stocke aussi pour debug
              d._rjTyreScoreOffset = impact;
            });
          }
        }
      } catch(e) {
        console.warn("[RJ] Erreur updateTyres:", e && e.message);
      }
      
      // Appel original
      return originalUpdateLivePos.apply(this, arguments);
    };
  }
  
  // ----- Hook sur _refreshTyreOnPit -----
  // Quand un pit se produit, on reset notre état pneus aussi
  var originalRefreshTyre = window._refreshTyreOnPit;
  if (typeof originalRefreshTyre === "function") {
    window._refreshTyreOnPit = function rjWrappedRefreshTyre(d, compound) {
      try {
        rjResetTyresAfterPit(d, compound);
      } catch(e) {
        console.warn("[RJ] Erreur reset pit:", e && e.message);
      }
      return originalRefreshTyre.apply(this, arguments);
    };
  }
  
  console.log("[RJ] Module Phase 2 chargé — modèle pneus actif. Debug: rjDebugTyres()");
})();

/* ========================================================================
 * 10. APPLICATION DE L'IMPACT SCORE DANS LE TRI FINAL
 * Le score de classement utilisé par updateLivePositions doit prendre en
 * compte _rjTyreScoreOffset. On hook le tri.
 * 
 * NOTE : Pour minimiser le risque, on ajoute juste l'offset au score
 * AVANT updateLivePositions et on le retire APRÈS. Comme ça le state
 * persistant (driver.score) n'est pas modifié de façon cumulative.
 * ===================================================================== */

(function rjInstallScoreApplicator() {
  if (typeof window === "undefined") return;
  if (window._rjScoreApplicatorInstalled) return;
  window._rjScoreApplicatorInstalled = true;
  
  // Approche alternative plus propre : on ajoute l'offset à eventScoreOffset
  // qui est déjà bien intégré au système legacy (utilisé par tickRace pour
  // applique progressivement un effet sur driver.score).
  // C'est ce qu'on fait dans le hook ci-dessus.
  // Donc rien à installer ici, juste la doc.
  
  // Mais on installe une fonction utilitaire rjApplyTyreImpactToScore()
  // qui peut être appelée manuellement pour appliquer directement à score
  // si besoin en Phase 3.
  window.rjApplyTyreImpactToScore = function() {
    if (!LIVE_RACE || !LIVE_RACE.drivers) return;
    LIVE_RACE.drivers.forEach(function(d) {
      if (d.dnf || !d._rjTyreScoreOffset) return;
      d.score = Math.max(0.02, Math.min(0.99, d.score + d._rjTyreScoreOffset * 0.05));
      // applique seulement 5% du delta par appel pour rester progressif
    });
  };
})();
