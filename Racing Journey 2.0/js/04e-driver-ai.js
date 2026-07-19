/* =====================================================================
 * 04e-driver-ai.js — REFONTE PHASE 4
 * 
 * IA décisionnelle des pilotes. Chaque IA évalue chaque tour et choisit
 * une intention tactique parmi 6 :
 *   - push_max         : tout donner
 *   - push_normal      : équilibre
 *   - preserve         : économiser
 *   - attack_ahead     : cibler le pilote devant
 *   - defend_behind    : bloquer le pilote derrière
 *   - cover_strategy   : couvrir un rival stratégique
 * 
 * L'intention se traduit en :
 *   - pushLevel (lu par Phase 2 modèle pneus)
 *   - bonus/malus de score directs (overtake / défense réussi)
 *   - mise à jour des relations avec les voisins
 * 
 * INTÉGRATION :
 *   - Hook sur rjEstimatePushLevel (Phase 2) pour utiliser la décision IA
 *   - Hook sur updateLivePositions pour évaluer les décisions chaque tour
 *   - Le calcul tourne après le lap-builder Phase 3
 * 
 * BUDGET CPU :
 *   - 20 pilotes × ~10 calculs simples par tour = ~200 ops par tick
 *   - Cumul Phase 1+2+3+4 : ~750 ops/tick → OK pour mobile
 * 
 * EXPOSE :
 *   - rjDecideIntent(driver, ctx)         → nouvelle décision tactique
 *   - rjGetCurrentIntent(driver)          → intention actuelle
 *   - rjUpdateRelations(driverA, driverB, kind, weight) → met à jour relations
 *   - rjDebugAI()                         → tableau des décisions actuelles
 *   - rjDebugRelationsOf(driverName)      → relations d'un pilote
 * ===================================================================== */

/* ========================================================================
 * 1. CATALOGUE DES INTENTIONS
 * ===================================================================== */

var RJ_INTENTS = {
  push_max: {
    label: "Push max",
    pushLevel: 0.92,
    desc: "Tout donner, accepter de cuire les pneus",
    color: "#EF4444"
  },
  push_normal: {
    label: "Push normal",
    pushLevel: 0.65,
    desc: "Rythme soutenu, équilibre",
    color: "#F59E0B"
  },
  preserve: {
    label: "Preservation",
    pushLevel: 0.35,
    desc: "Économiser pneus et moteur",
    color: "#34D399"
  },
  attack_ahead: {
    label: "Attaque devant",
    pushLevel: 0.85,
    desc: "Cibler le pilote devant, risque calculé",
    color: "#DC2626"
  },
  defend_behind: {
    label: "Défense",
    pushLevel: 0.70,
    desc: "Bloquer le pilote derrière",
    color: "#7C3AED"
  },
  cover_strategy: {
    label: "Couvrir",
    pushLevel: 0.60,
    desc: "Rester collé à un rival stratégique",
    color: "#60A5FA"
  }
};

/* ========================================================================
 * 2. ÉVALUATEUR DE SITUATION
 * Construit un score pour chaque intention possible. L'IA choisit la plus
 * forte avec un peu d'aléatoire pour éviter le déterminisme.
 * ===================================================================== */

function _rjEvalIntents(driver, ctx) {
  // ctx contient déjà : lapPct, gapAhead, gapBehind, tyreGrip, tyreWear, tyreTemp
  var s = driver._rjDriverState;
  if (!s) return null;
  var m = s.mental;
  var style = s.style;
  
  // Position relative
  var pos = driver.pos || 99;
  var totalDrivers = (LIVE_RACE && LIVE_RACE.drivers && LIVE_RACE.drivers.length) || 20;
  var isLeader  = pos === 1;
  var inTop3    = pos <= 3;
  var inPoints  = pos <= 10;
  var nearBack  = pos >= totalDrivers - 3;
  
  // Phase de course
  var lapPct      = ctx.lapPct;
  var earlyRace   = lapPct < 0.20;
  var midRace     = lapPct >= 0.20 && lapPct < 0.75;
  var lateRace    = lapPct >= 0.75;
  var finalLaps   = lapPct >= 0.92;
  
  // État pneus
  var tyreCliff       = ctx.tyreWear > 75;
  var tyresFresh      = ctx.tyreWear < 20;
  var tyresOptimal    = ctx.tyreGrip > 0.95 && ctx.tyreWear < 60;
  var tyresOverheat   = ctx.tyreTemp > 110;
  var tyresColdPit    = ctx.tyreTemp < 70 && ctx.tyreWear < 5; // sortie de pit récent
  
  // Voisins
  var hasAheadClose   = ctx.gapAhead !== null && ctx.gapAhead < 1.5;
  var hasAheadVeryClose = ctx.gapAhead !== null && ctx.gapAhead < 0.7;
  var hasBehindClose  = ctx.gapBehind !== null && ctx.gapBehind < 1.5;
  var hasBehindVeryClose = ctx.gapBehind !== null && ctx.gapBehind < 0.7;
  var farFromAll      = (ctx.gapAhead === null || ctx.gapAhead > 4.0) && 
                        (ctx.gapBehind === null || ctx.gapBehind > 4.0);
  
  // Relations avec voisins
  var aheadRivalIdx = ctx.aheadDriver && typeof ctx.aheadDriver.rivalIdx === "number" ? ctx.aheadDriver.rivalIdx : null;
  var behindRivalIdx = ctx.behindDriver && typeof ctx.behindDriver.rivalIdx === "number" ? ctx.behindDriver.rivalIdx : null;
  var tensionAhead = (s.relations.rivals[aheadRivalIdx] && s.relations.rivals[aheadRivalIdx].tension) || 0;
  var tensionBehind = (s.relations.rivals[behindRivalIdx] && s.relations.rivals[behindRivalIdx].tension) || 0;
  
  // Mental
  var aggression  = m.aggression;
  var pressure    = m.pressure;
  var frustration = m.frustration;
  var confidence  = m.confidence;
  var riskAppetite = m.riskAppetite;
  
  // ===== SCORES PAR INTENTION =====
  
  var scores = {
    push_max:        0,
    push_normal:     30,  // base par défaut (raisonnable mais battable)
    preserve:        0,
    attack_ahead:    0,
    defend_behind:   0,
    cover_strategy:  0
  };
  
  // ----- PUSH_MAX -----
  if (lateRace && inPoints) scores.push_max += 35;        // sprint final si en points
  if (finalLaps) scores.push_max += 30;                    // dernier tours
  if (tyresFresh) scores.push_max += 25;                   // pneus neufs
  if (riskAppetite > 70) scores.push_max += 18;            // pilote dispo au risque
  if (style.baseAggression > 65) scores.push_max += 12;    // style agressif
  if (tyreCliff) scores.push_max -= 40;                    // pneus morts → non
  if (tyresOverheat) scores.push_max -= 20;                // surchauffe → non
  if (tensionAhead > 50 && hasAheadClose) scores.push_max += 12; // rival devant
  if (driver.gridPos && pos > driver.gridPos + 3) scores.push_max += 12; // remontée nécessaire
  
  // ----- PRESERVE -----
  if (tyreCliff) scores.preserve += 40;                    // pneus crient
  if (tyresOverheat) scores.preserve += 28;
  if (farFromAll && !lateRace) scores.preserve += 25;      // course solo, économise
  if (isLeader && !hasBehindClose && midRace) scores.preserve += 20; // leader confortable
  if (style.consistency > 0.85) scores.preserve += 10;     // pilotes consistents préservent
  if (riskAppetite < 35) scores.preserve += 15;
  if (tyresColdPit) scores.preserve += 30;                 // sortie de pit
  if (m.frustration > 70) scores.preserve -= 12;           // frustré veut bouger
  if (finalLaps && inPoints) scores.preserve -= 30;        // pas le moment
  if (style.baseAggression < 45) scores.preserve += 8;     // pilote prudent
  
  // ----- ATTACK_AHEAD -----
  if (hasAheadVeryClose) {
    scores.attack_ahead += 45;                              // collé, attaque très probable
    if (riskAppetite > 60) scores.attack_ahead += 18;
    if (tensionAhead > 30) scores.attack_ahead += 14;
    if (tensionAhead > 60) scores.attack_ahead += 12;
    if (tyresOptimal) scores.attack_ahead += 15;
  } else if (hasAheadClose) {
    scores.attack_ahead += 28;                              // proche mais pas collé
    if (riskAppetite > 60) scores.attack_ahead += 12;
    if (style.baseAggression > 55) scores.attack_ahead += 8;
  } else if (ctx.gapAhead !== null && ctx.gapAhead < 3.0 && midRace) {
    scores.attack_ahead += 10;                              // chasse possible en milieu
    if (style.baseAggression > 65) scores.attack_ahead += 8;
  }
  if (tyreCliff) scores.attack_ahead -= 25;
  if (pressure > 75) scores.attack_ahead -= 10;
  if (style.baseAggression > 60 && hasAheadClose) scores.attack_ahead += 10;
  if (frustration > 60 && hasAheadClose) scores.attack_ahead += 10;
  if (lateRace && inPoints && hasAheadClose) scores.attack_ahead += 18;
  if (m.momentum > 30 && hasAheadClose) scores.attack_ahead += 8;
  
  // ----- DEFEND_BEHIND -----
  if (hasBehindVeryClose) {
    scores.defend_behind += 40;
    if (style.baseAggression > 55) scores.defend_behind += 10;
    if (tensionBehind > 50) scores.defend_behind += 14;
  } else if (hasBehindClose) {
    scores.defend_behind += 22;
  }
  if (isLeader && hasBehindClose) scores.defend_behind += 18;
  if (inTop3 && lateRace && hasBehindClose) scores.defend_behind += 15;
  if (tyreCliff) scores.defend_behind -= 15;
  if (style.consistency > 0.85) scores.defend_behind += 8;
  if (pressure > 80) scores.defend_behind -= 8;
  
  // ----- COVER_STRATEGY -----
  if (midRace && hasAheadClose && tensionAhead > 30) scores.cover_strategy += 22;
  if (midRace && hasBehindClose && tensionBehind > 30) scores.cover_strategy += 18;
  if (style.consistency > 0.85) scores.cover_strategy += 8;
  if (style.baseAggression < 50) scores.cover_strategy += 6;
  
  // ----- PUSH_NORMAL (default) -----
  if (midRace && !hasAheadClose && !hasBehindClose) scores.push_normal += 18;
  if (tyresOptimal && !hasAheadClose && !hasBehindClose) scores.push_normal += 12;
  if (earlyRace) scores.push_normal += 10;                  // début de course neutre
  
  // ===== PÉNALITÉS COMMUNES =====
  
  // Rookie ou pilote sans confiance évite les options agressives
  if (confidence < 40) {
    scores.push_max -= 15;
    scores.attack_ahead -= 12;
  }
  
  // Pilote en mode "rage" (frustration > 80) prend plus de risques
  if (frustration > 80) {
    scores.push_max += 10;
    scores.attack_ahead += 12;
    scores.preserve -= 10;
  }
  
  // Momentum positif → pilote pousse plus
  if (m.momentum > 30) {
    scores.push_max += 8;
    scores.push_normal += 5;
  } else if (m.momentum < -30) {
    scores.preserve += 6;
    scores.push_max -= 8;
  }
  
  return scores;
}

/* ========================================================================
 * 3. DÉCISION D'INTENTION
 * Choisit l'intention au plus haut score, avec un peu d'aléatoire
 * pour éviter le déterminisme parfait.
 * ===================================================================== */

function rjDecideIntent(driver, ctx) {
  if (!driver || !driver._rjDriverState || driver.dnf) return "push_normal";
  
  var scores = _rjEvalIntents(driver, ctx);
  if (!scores) return "push_normal";
  
  // Trouver l'intention au top score
  var sorted = Object.keys(scores).map(function(k) {
    return { intent: k, score: scores[k] };
  }).sort(function(a, b) { return b.score - a.score; });
  
  // Filtre les scores < -20 : intentions très improbables
  var viable = sorted.filter(function(s) { return s.score > -20; });
  if (viable.length === 0) return "push_normal";
  
  // Prend le top, mais avec 15% de chance de prendre le 2e si écart faible
  // (pour ajouter un peu de variabilité humaine)
  var best = viable[0];
  if (viable.length > 1) {
    var second = viable[1];
    var gap = best.score - second.score;
    if (gap < 8 && Math.random() < 0.20) {
      return second.intent;
    }
  }
  
  return best.intent;
}

/* ========================================================================
 * 4. APPLICATION DE L'INTENTION
 * Convertit l'intention en pushLevel et applique des effets directs
 * (bonus si attack/defend réussit, mise à jour relations).
 * ===================================================================== */

function rjApplyIntent(driver, intent, ctx) {
  if (!driver || !RJ_INTENTS[intent]) return;
  var def = RJ_INTENTS[intent];
  
  // Stocke pour Phase 2 (rjEstimatePushLevel) et debug
  driver._rjCurrentIntent = intent;
  driver._rjCurrentPushLevel = def.pushLevel;
  
  // Effet sur le mental selon intention
  var s = driver._rjDriverState;
  if (!s) return;
  var m = s.mental;
  
  // Push max → un peu de stress
  if (intent === "push_max") {
    m.pressure = Math.min(100, m.pressure + 0.4);
    // Si pneus optimaux et pas en cliff, micro-boost confidence
    if (ctx.tyreGrip > 0.95 && ctx.tyreWear < 50) {
      m.confidence = Math.min(100, m.confidence + 0.1);
    }
  }
  
  // Preserve → relâche un peu la pression
  if (intent === "preserve") {
    m.pressure = Math.max(0, m.pressure - 0.3);
    m.focus = Math.min(100, m.focus + 0.1);
  }
  
  // Attack ahead : succès si on est plus rapide ET pneus OK
  if (intent === "attack_ahead" && ctx.aheadDriver) {
    var attacker = driver;
    var target = ctx.aheadDriver;
    // Probabilité de succès basée sur écarts de skill, mental, pneus
    var attackerStrength = (m.confidence + m.aggression) / 2 + ctx.tyreGrip * 50;
    var defenderStrength = 50;
    if (target._rjDriverState) {
      var tm = target._rjDriverState.mental;
      defenderStrength = (tm.confidence + tm.focus) / 2;
      var targetGrip = (typeof rjGetAvgTyreGrip === "function") ? rjGetAvgTyreGrip(target) : 1.0;
      defenderStrength += targetGrip * 50;
    }
    // Ratio : > 1 = avantage attaquant
    var ratio = attackerStrength / Math.max(40, defenderStrength);
    
    // Probabilité d'overtake réussi : faible (course pas que duels)
    // Mais influencée par le ratio et la proximité
    var overtakeProb = 0.0;
    if (ctx.gapAhead !== null && ctx.gapAhead < 0.5) {
      overtakeProb = 0.10 * Math.min(1.5, ratio);  // ~10-15% par tour si ratio favorable, collé
    } else if (ctx.gapAhead !== null && ctx.gapAhead < 1.0) {
      overtakeProb = 0.05 * Math.min(1.4, ratio);
    } else if (ctx.gapAhead !== null && ctx.gapAhead < 2.0) {
      overtakeProb = 0.02; // tentative possible mais peu probable
    }
    
    if (Math.random() < overtakeProb) {
      // OVERTAKE RÉUSSI : on échange les positions
      _rjExecuteOvertake(attacker, target, ctx);
    } else {
      // Tentative ratée : peut-être un peu de frustration
      if (ctx.gapAhead < 0.5 && Math.random() < 0.30) {
        m.frustration = Math.min(100, m.frustration + 3);
      }
    }
  }
  
  // Defend behind : si attaqué, score boost si pneus OK
  if (intent === "defend_behind" && ctx.behindDriver) {
    var defender = driver;
    var attacker = ctx.behindDriver;
    // Léger micro-malus de score (défense coûte du temps) mais protège la position
    if (ctx.gapBehind < 0.7) {
      // Stocke un flag : si l'attaquant choisit attack_ahead, leurs decisions s'opposent
      defender._rjDefendingAgainst = attacker.name;
      // Bonus consistency pour tenir
      if (s.style.consistency > 0.80) {
        // Petite augmentation du score pour symboliser la trajectoire défensive efficace
        defender.score = Math.min(0.99, defender.score + 0.0008);
      }
    }
  }
}

/* ========================================================================
 * 5. EXECUTION D'UN OVERTAKE
 * Échange les positions entre attaquant et cible, met à jour les scores
 * et les relations.
 * ===================================================================== */

function _rjExecuteOvertake(attacker, target, ctx) {
  if (!attacker || !target || attacker.dnf || target.dnf) return;
  
  // FIX BUG 1 — On NE SWAP PLUS les positions manuellement.
  // À la place, on boost suffisamment le score de l'attaquant pour qu'il
  // dépasse la cible au prochain tri de updateLivePositions. Comme ça :
  //   - Pas de collision de positions
  //   - Pas de dérive du système maxJump
  //   - Le système legacy gère naturellement le changement
  
  // Calcul du boost nécessaire : pour passer devant, l'attaquant doit avoir
  // un score effectif (score - penaltySec/45) supérieur à la cible.
  var attackerEff = attacker.score - (attacker.penaltySec || 0) / 45;
  var targetEff   = target.score   - (target.penaltySec || 0)   / 45;
  
  // Boost = écart actuel + petite marge
  var requiredBoost = (targetEff - attackerEff) + 0.008;
  
  if (requiredBoost > 0) {
    attacker.score = Math.min(0.99, attacker.score + requiredBoost);
  }
  // Petit malus défenseur (perte de momentum vs maintenir position)
  target.score = Math.max(0.02, target.score - 0.003);
  
  // Mental update
  if (attacker._rjDriverState) {
    var am = attacker._rjDriverState.mental;
    am.confidence = Math.min(100, am.confidence + 1.5);
    am.momentum = Math.min(100, (am.momentum || 0) + 12);
    am.frustration = Math.max(0, am.frustration - 8);
  }
  if (target._rjDriverState) {
    var tm = target._rjDriverState.mental;
    tm.confidence = Math.max(0, tm.confidence - 0.8);
    tm.momentum = Math.max(-100, (tm.momentum || 0) - 8);
    tm.frustration = Math.min(100, tm.frustration + 5);
    tm.pressure = Math.min(100, tm.pressure + 3);
  }
  
  // Update relations
  if (typeof attacker.rivalIdx === "number" && typeof target.rivalIdx === "number") {
    rjUpdateRelations(attacker, target, "overtake_taken", 4);
    rjUpdateRelations(target, attacker, "overtake_lost", 5);
  }
  
  // Log narratif (utilisable par radio team Phase 6)
  if (!attacker._rjLapHistory) attacker._rjLapHistory = [];
  attacker._rjLapHistory.push({
    type: "overtake_success",
    text: "dépasse " + (target.name || "rival").split(" ").pop(),
    isPositive: true,
    lap: LIVE_RACE.cur,
    targetName: target.name
  });
  if (attacker._rjLapHistory.length > 10) attacker._rjLapHistory = attacker._rjLapHistory.slice(-10);
  
  if (!target._rjLapHistory) target._rjLapHistory = [];
  target._rjLapHistory.push({
    type: "overtake_lost",
    text: "perd sa place sur " + (attacker.name || "rival").split(" ").pop(),
    isPositive: false,
    lap: LIVE_RACE.cur,
    attackerName: attacker.name
  });
  if (target._rjLapHistory.length > 10) target._rjLapHistory = target._rjLapHistory.slice(-10);
}

/* ========================================================================
 * 6. SYSTÈME DE RELATIONS
 * Met à jour les relations entre pilotes selon les events.
 * Les relations sont stockées dans driver._rjDriverState.relations.rivals.
 * 
 * STRUCTURE D'UNE RELATION :
 *   { tension: 0..100, respect: 0..100, history: [{type, lap, weight}, ...] }
 * 
 * KINDS :
 *   - overtake_taken    : on a dépassé l'autre (+respect d'eux, +tension)
 *   - overtake_lost     : on s'est fait dépasser (+tension)
 *   - clean_battle      : duel propre (-tension, +respect)
 *   - blocked           : bloqué par lui (+tension)
 *   - close_pass        : passage serré (+tension)
 *   - team_dynamic      : coéquipier (boost respect)
 * ===================================================================== */

function rjUpdateRelations(driverA, driverB, kind, weight) {
  if (!driverA || !driverB || !driverA._rjDriverState) return;
  if (typeof driverB.rivalIdx !== "number" && !driverB.isPlayer) return;
  
  // Clé : pour le joueur, on stocke "player" ; sinon rivalIdx
  var keyB = driverB.isPlayer ? "player" : driverB.rivalIdx;
  
  var rels = driverA._rjDriverState.relations.rivals;
  if (!rels[keyB]) {
    rels[keyB] = { tension: 0, respect: 30, history: [] };
  }
  var rel = rels[keyB];
  
  // Effets selon kind
  var w = weight || 3;
  switch (kind) {
    case "overtake_taken":
      rel.tension = Math.min(100, rel.tension + w);
      rel.respect = Math.min(100, rel.respect + Math.round(w / 2));
      break;
    case "overtake_lost":
      rel.tension = Math.min(100, rel.tension + w);
      // Respect dépend de comment on s'est fait passer (placeholder pour Phase 5)
      rel.respect = Math.max(0, rel.respect - 1);
      break;
    case "clean_battle":
      rel.tension = Math.max(0, rel.tension - w);
      rel.respect = Math.min(100, rel.respect + w);
      break;
    case "blocked":
      rel.tension = Math.min(100, rel.tension + w * 1.5);
      break;
    case "close_pass":
      rel.tension = Math.min(100, rel.tension + Math.round(w / 2));
      break;
    case "team_dynamic":
      // Pour coéquipiers : boost respect mais peut aussi augmenter tension si on se bat
      rel.respect = Math.min(100, rel.respect + w);
      break;
  }
  
  // Historique
  rel.history.push({ type: kind, lap: LIVE_RACE.cur, weight: w });
  if (rel.history.length > 15) rel.history = rel.history.slice(-15);
}

/* ========================================================================
 * 7. ACCESSEURS DEBUG
 * ===================================================================== */

function rjGetCurrentIntent(driver) {
  if (!driver) return null;
  return driver._rjCurrentIntent || "push_normal";
}

function rjDebugAI() {
  if (typeof LIVE_RACE === "undefined" || !LIVE_RACE || !LIVE_RACE.drivers) {
    console.log("[RJ] Pas de course active");
    return;
  }
  
  console.log("=== RJ AI DECISIONS — Tour " + LIVE_RACE.cur + "/" + LIVE_RACE.total + " ===");
  
  LIVE_RACE.drivers.slice().sort(function(a,b){return (a.pos||99)-(b.pos||99);}).forEach(function(d) {
    if (!d._rjDriverState) return;
    var intent = d._rjCurrentIntent || "?";
    var def = RJ_INTENTS[intent] || { label: intent, pushLevel: 0.5 };
    var label = (d.isPlayer ? "★ " : "  ") + (d.name || "?").substring(0, 18).padEnd(18);
    var pos = "P" + (d.pos || "?");
    
    console.log(
      pos.padStart(4) + " " + label +
      " | " + def.label.padEnd(15) +
      " push=" + def.pushLevel.toFixed(2)
    );
  });
}

function rjDebugRelationsOf(driverName) {
  if (typeof LIVE_RACE === "undefined" || !LIVE_RACE || !LIVE_RACE.drivers) {
    console.log("[RJ] Pas de course active");
    return;
  }
  var d = LIVE_RACE.drivers.find(function(dd) {
    return dd.name && dd.name.toLowerCase().indexOf((driverName || "").toLowerCase()) >= 0;
  });
  if (!d || !d._rjDriverState) {
    console.log("[RJ] Pilote non trouvé : " + driverName);
    return;
  }
  var rels = d._rjDriverState.relations.rivals;
  console.log("=== Relations de " + d.name + " ===");
  if (!rels || Object.keys(rels).length === 0) {
    console.log("  Aucune relation établie pour le moment.");
    return;
  }
  Object.keys(rels).forEach(function(key) {
    var rel = rels[key];
    var otherName = "?";
    if (key === "player") otherName = "Joueur";
    else if (G.rivals && G.rivals[parseInt(key)]) otherName = G.rivals[parseInt(key)].name;
    console.log("  vs " + otherName + " :");
    console.log("    tension=" + rel.tension + " respect=" + rel.respect);
    var lastEvents = rel.history.slice(-3);
    if (lastEvents.length > 0) {
      console.log("    Derniers events :");
      lastEvents.forEach(function(h) {
        console.log("      Tour " + h.lap + " — " + h.type + " (w" + h.weight + ")");
      });
    }
  });
}

/* ========================================================================
 * 8. WRAP DE rjEstimatePushLevel POUR UTILISER L'IA
 * Phase 2 utilise rjEstimatePushLevel pour le modèle pneus.
 * On wrappe pour utiliser la décision IA si disponible (rivaux uniquement).
 * Pour le joueur, on continue d'utiliser racePlan.
 * ===================================================================== */

(function rjInstallAIPushOverride() {
  if (typeof window === "undefined") return;
  if (window._rjAIInstalled) return;
  window._rjAIInstalled = true;
  
  // Wrapper de rjEstimatePushLevel
  var prevEstimate = window.rjEstimatePushLevel;
  if (typeof prevEstimate !== "function") {
    if (typeof setTimeout !== "undefined") setTimeout(rjInstallAIPushOverride, 50);
    return;
  }
  
  window.rjEstimatePushLevel = function rjPhase4PushLevel(driver, lapPct) {
    // Joueur : reste sur racePlan via prevEstimate (pas de changement)
    if (driver && driver.isPlayer) {
      return prevEstimate(driver, lapPct);
    }
    
    // IA : utilise la décision si disponible, sinon fallback sur prevEstimate
    if (driver && typeof driver._rjCurrentPushLevel === "number") {
      return driver._rjCurrentPushLevel;
    }
    return prevEstimate(driver, lapPct);
  };
})();

/* ========================================================================
 * 9. HOOK SUR updateLivePositions POUR DÉCIDER CHAQUE TOUR
 * On wrappe à nouveau updateLivePositions pour exécuter la phase de
 * décision après le lap-builder de Phase 3.
 * ===================================================================== */

(function rjInstallAIDecisionHook() {
  if (typeof window === "undefined") return;
  if (window._rjAIDecisionHookInstalled) return;
  window._rjAIDecisionHookInstalled = true;
  
  var prevUpdate = window.updateLivePositions;
  if (typeof prevUpdate !== "function") {
    if (typeof setTimeout !== "undefined") setTimeout(rjInstallAIDecisionHook, 50);
    return;
  }
  
  window.updateLivePositions = function rjPhase4WrappedUpdateLivePos() {
    // Appel chaîne précédente (Phase 3 → Phase 2 → original)
    var result = prevUpdate.apply(this, arguments);
    
    try {
      if (LIVE_RACE && LIVE_RACE._rjPhase >= 1 && LIVE_RACE.drivers && !LIVE_RACE.finished) {
        // Décide une fois par tour, après lap-builder
        if (LIVE_RACE._rjLastAIDecided !== LIVE_RACE.cur && LIVE_RACE._rjLastLapBuilt === LIVE_RACE.cur) {
          LIVE_RACE._rjLastAIDecided = LIVE_RACE.cur;
          LIVE_RACE._rjPhase = Math.max(LIVE_RACE._rjPhase || 1, 4);
          
          LIVE_RACE.drivers.forEach(function(d) {
            if (d.dnf || d.isPlayer || !d._rjDriverState) return;
            
            var ctx = (typeof _rjBuildLapContext === "function") ? _rjBuildLapContext(d) : null;
            if (!ctx) return;
            
            // 1. Décide l'intention
            var intent = rjDecideIntent(d, ctx);
            
            // 2. Applique l'intention (pushLevel + effets)
            rjApplyIntent(d, intent, ctx);
          });
        }
      }
    } catch(e) {
      console.warn("[RJ] Erreur AI decision:", e && e.message);
    }
    
    return result;
  };
  
  console.log("[RJ] Module Phase 4 chargé — IA décisionnelle active. Debug: rjDebugAI()");
})();
