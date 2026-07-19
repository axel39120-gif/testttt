/* =====================================================================
 * 04d-lap-builder.js — REFONTE PHASE 3
 * 
 * Le tour est construit étape par étape, plutôt que calculé d'une formule.
 * Chaque tour de chaque pilote produit :
 *   - une décomposition (pace, pneus, mental, trafic, micro-events)
 *   - éventuellement un événement narratif émergent (à utiliser plus tard
 *     en Phase 6 pour la radio team contextuelle)
 *   - un delta de score qui s'ajoute aux systèmes existants
 * 
 * INTÉGRATION :
 *   - Hook sur updateLivePositions (déjà installé par Phase 2)
 *   - Pour chaque pilote actif, appelle rjBuildLap(driver, ctx)
 *   - Le résultat narratif est stocké dans driver._rjLastLap pour debug
 *     et future utilisation par la radio team (Phase 6)
 * 
 * BUDGET CPU :
 *   - 20 pilotes × ~8 micro-calculs par tour = ~160 ops par tick
 *   - Avec Phase 2 (~400 ops), on est à ~560 ops/tick — OK pour mobile
 * 
 * EXPOSE :
 *   - rjBuildLap(driver, ctx) → {pace, components, events, scoreDelta}
 *   - rjLastLapNarrative(driver) → {events, narrative} pour debug/radio
 *   - rjGetLapEvents(driver, count) → derniers événements narratifs
 *   - rjDebugLap() → affichage console
 *   - rjDebugLapOf(driverName) → détails d'un pilote
 * ===================================================================== */

/* ========================================================================
 * 1. CATALOGUE DES MICRO-ÉVÉNEMENTS DE TOUR
 * Ce sont les briques qui composent un tour. À chaque tour, certains
 * peuvent se produire selon les conditions (probabilités contextuelles).
 * 
 * STRUCTURE :
 *   id           : identifiant
 *   weight       : poids de base pour la sélection (1 = standard)
 *   when         : fonction(ctx) qui retourne true si l'événement peut survenir
 *   apply        : fonction(driver, ctx) qui applique l'effet
 *   narrative    : fonction(driver, ctx) qui retourne un texte court
 *   isPositive   : pour la radio team
 * ===================================================================== */

var RJ_LAP_MICRO_EVENTS = [
  // ===== ÉVÉNEMENTS POSITIFS =====
  {
    id: "perfect_sector",
    weight: 1.0,
    isPositive: true,
    when: function(ctx) {
      // Un secteur magique : favorisé par bon mental + bonne fenêtre pneus
      var d = ctx.driver;
      var conf = d._rjDriverState && d._rjDriverState.mental.confidence || 50;
      var grip = ctx.tyreGrip;
      return conf > 60 && grip > 0.95 && Math.random() < 0.04;
    },
    apply: function(d, ctx) {
      d.score = Math.min(0.99, d.score + 0.004);
      // Boost momentum
      if (d._rjDriverState) {
        d._rjDriverState.mental.momentum = Math.min(100, (d._rjDriverState.mental.momentum || 0) + 8);
        d._rjDriverState.mental.confidence = Math.min(100, d._rjDriverState.mental.confidence + 0.5);
      }
    },
    narrative: function(d, ctx) {
      var sector = ["S1", "S2", "S3"][Math.floor(Math.random() * 3)];
      return { type: "perfect_sector", text: sector + " parfait", weight: 0.6 };
    }
  },
  {
    id: "tow_advantage",
    weight: 1.0,
    isPositive: true,
    when: function(ctx) {
      // Aspiration : doit y avoir un pilote devant à <0.5s
      return ctx.gapAhead !== null && ctx.gapAhead < 0.5 && ctx.gapAhead > 0.05 && Math.random() < 0.10;
    },
    apply: function(d, ctx) {
      d.score = Math.min(0.99, d.score + 0.002);
    },
    narrative: function(d, ctx) {
      return { type: "tow", text: "profite de l'aspiration", weight: 0.4 };
    }
  },
  {
    id: "rhythm_zone",
    weight: 0.8,
    isPositive: true,
    when: function(ctx) {
      // Pilote en rythme : forte consistency + momentum positif
      var s = ctx.driver._rjDriverState;
      if (!s) return false;
      var consistency = s.style.consistency || 0.7;
      var mom = s.mental.momentum || 0;
      return consistency > 0.85 && mom > 30 && Math.random() < 0.06;
    },
    apply: function(d, ctx) {
      d.score = Math.min(0.99, d.score + 0.003);
      if (d._rjDriverState) {
        d._rjDriverState.mental.confidence = Math.min(100, d._rjDriverState.mental.confidence + 0.3);
      }
    },
    narrative: function(d, ctx) {
      return { type: "rhythm", text: "trouve son rythme", weight: 0.5 };
    }
  },
  
  // ===== ÉVÉNEMENTS NEUTRES À LÉGÈREMENT NÉGATIFS =====
  {
    id: "minor_lockup",
    weight: 1.2,
    isPositive: false,
    when: function(ctx) {
      // Petit blocage de roue : favorisé par mental sous pression + pneus chauds
      var d = ctx.driver;
      var s = d._rjDriverState;
      if (!s) return false;
      var press = s.mental.pressure || 30;
      var freeze = s.mental.focus || 80;
      var baseChance = 0.05;
      if (press > 60) baseChance += 0.04;
      if (freeze < 65) baseChance += 0.03;
      if (ctx.tyreTemp > 110) baseChance += 0.02;
      return Math.random() < baseChance;
    },
    apply: function(d, ctx) {
      d.score = Math.max(0.01, d.score - 0.0025);
      if (d._rjDriverState) {
        d._rjDriverState.mental.frustration = Math.min(100, (d._rjDriverState.mental.frustration || 0) + 4);
        d._rjDriverState.mental.momentum = Math.max(-100, (d._rjDriverState.mental.momentum || 0) - 5);
      }
    },
    narrative: function(d, ctx) {
      return { type: "lockup", text: "petit blocage de roue", weight: 0.5 };
    }
  },
  {
    id: "traffic_block",
    weight: 1.0,
    isPositive: false,
    when: function(ctx) {
      // Trafic : doit y avoir un pilote devant à <1s qui bloque
      // Plus probable si on est plus rapide qu'eux
      if (ctx.gapAhead === null || ctx.gapAhead > 1.2) return false;
      if (ctx.gapAhead < 0.1) return false; // déjà collé, c'est plutôt un duel
      return Math.random() < 0.07;
    },
    apply: function(d, ctx) {
      d.score = Math.max(0.01, d.score - 0.002);
      if (d._rjDriverState) {
        d._rjDriverState.mental.frustration = Math.min(100, (d._rjDriverState.mental.frustration || 0) + 6);
      }
    },
    narrative: function(d, ctx) {
      var aheadName = ctx.aheadDriver && ctx.aheadDriver.name ? ctx.aheadDriver.name.split(" ").pop() : "le pilote devant";
      return { type: "traffic", text: "coincé derrière " + aheadName, weight: 0.6 };
    }
  },
  {
    id: "wide_corner",
    weight: 1.0,
    isPositive: false,
    when: function(ctx) {
      // Sortie large dans un virage : favorisé par push élevé + faible focus
      var d = ctx.driver;
      var s = d._rjDriverState;
      if (!s) return false;
      var pushLevel = ctx.pushLevel || 0.5;
      var focus = s.mental.focus || 80;
      var consistency = s.style.consistency || 0.7;
      var baseChance = 0.025;
      if (pushLevel > 0.8) baseChance += 0.03;
      if (focus < 60) baseChance += 0.02;
      baseChance *= (1.2 - consistency); // moins consistant = plus d'erreurs
      return Math.random() < baseChance;
    },
    apply: function(d, ctx) {
      d.score = Math.max(0.01, d.score - 0.003);
      if (d._rjDriverState) {
        d._rjDriverState.mental.momentum = Math.max(-100, (d._rjDriverState.mental.momentum || 0) - 6);
        d._rjDriverState.mental.frustration = Math.min(100, (d._rjDriverState.mental.frustration || 0) + 3);
      }
    },
    narrative: function(d, ctx) {
      return { type: "wide", text: "sortie large", weight: 0.55 };
    }
  },
  {
    id: "tyre_overheat",
    weight: 1.0,
    isPositive: false,
    when: function(ctx) {
      // Surchauffe pneus : pneus déjà chauds + push fort
      if (ctx.tyreTemp < 108) return false;
      if (ctx.pushLevel < 0.6) return false;
      return Math.random() < 0.05;
    },
    apply: function(d, ctx) {
      d.score = Math.max(0.01, d.score - 0.0025);
      // Augmente encore la temp des pneus
      if (d._rjCarState) {
        ["FL","FR","RL","RR"].forEach(function(p) {
          d._rjCarState.tyres[p].temp += 1.5;
        });
      }
    },
    narrative: function(d, ctx) {
      return { type: "overheat", text: "pneus en surchauffe", weight: 0.55 };
    }
  },
  {
    id: "grip_loss",
    weight: 1.0,
    isPositive: false,
    when: function(ctx) {
      // Perte d'adhérence ponctuelle : pneus dégradés + push élevé
      if (ctx.tyreWear < 60) return false;
      var pushLevel = ctx.pushLevel || 0.5;
      var baseChance = 0.04;
      if (pushLevel > 0.7) baseChance += 0.03;
      return Math.random() < baseChance;
    },
    apply: function(d, ctx) {
      d.score = Math.max(0.01, d.score - 0.002);
    },
    narrative: function(d, ctx) {
      return { type: "grip_loss", text: "glisse en sortie", weight: 0.45 };
    }
  },
  
  // ===== ÉVÉNEMENTS DÉPENDANTS DU MENTAL =====
  {
    id: "pressure_cracks",
    weight: 1.5,
    isPositive: false,
    when: function(ctx) {
      // Le pilote craque sous la pression : pression élevée + focus bas
      var d = ctx.driver;
      var s = d._rjDriverState;
      if (!s) return false;
      var press = s.mental.pressure || 30;
      var focus = s.mental.focus || 80;
      if (press < 70 || focus > 60) return false;
      return Math.random() < 0.06;
    },
    apply: function(d, ctx) {
      d.score = Math.max(0.01, d.score - 0.005);
      if (d._rjDriverState) {
        d._rjDriverState.mental.confidence = Math.max(0, d._rjDriverState.mental.confidence - 1.5);
        d._rjDriverState.mental.momentum = Math.max(-100, (d._rjDriverState.mental.momentum || 0) - 12);
      }
    },
    narrative: function(d, ctx) {
      return { type: "pressure", text: "craque sous la pression", weight: 0.7 };
    }
  },
  {
    id: "calm_under_pressure",
    weight: 1.0,
    isPositive: true,
    when: function(ctx) {
      // Sang-froid : pression élevée mais pilote sang-froid résiste
      var d = ctx.driver;
      var s = d._rjDriverState;
      if (!s) return false;
      var press = s.mental.pressure || 30;
      var baseAgg = s.style.baseAggression || 50;
      if (press < 60) return false;
      if (baseAgg > 50) return false; // surtout pour les sang-froid
      return Math.random() < 0.05;
    },
    apply: function(d, ctx) {
      d.score = Math.min(0.99, d.score + 0.002);
      if (d._rjDriverState) {
        d._rjDriverState.mental.confidence = Math.min(100, d._rjDriverState.mental.confidence + 0.7);
      }
    },
    narrative: function(d, ctx) {
      return { type: "calm", text: "garde son sang-froid", weight: 0.5 };
    }
  },
  
  // ===== ÉVÉNEMENT D'ADAPTATION CIRCUIT =====
  {
    id: "circuit_specialty",
    weight: 0.8,
    isPositive: true,
    when: function(ctx) {
      // Le pilote a une affinité avec ce circuit (décidé en début de course)
      var d = ctx.driver;
      var s = d._rjDriverState;
      if (!s || !s.style) return false;
      // En Phase 3, on simule un avantage random initialisé en début de course
      // (Phase 5 raffinera avec vraie liste preferredCircuits)
      var affinity = d._rjCircuitAffinity || 0;
      if (affinity < 0.3) return false;
      return Math.random() < 0.05 * affinity;
    },
    apply: function(d, ctx) {
      d.score = Math.min(0.99, d.score + 0.0025);
    },
    narrative: function(d, ctx) {
      return { type: "specialty", text: "à l'aise sur ce tracé", weight: 0.45 };
    }
  }
];

/* ========================================================================
 * 2. CONSTRUCTION DU CONTEXTE D'UN TOUR
 * ===================================================================== */

function _rjBuildLapContext(driver) {
  if (!driver || !LIVE_RACE) return null;
  
  var lapPct = LIVE_RACE.total > 0 ? LIVE_RACE.cur / LIVE_RACE.total : 0;
  var pushLevel = (typeof rjEstimatePushLevel === "function") ? rjEstimatePushLevel(driver, lapPct) : 0.5;
  
  // Pneus
  var tyreGrip = (typeof rjGetAvgTyreGrip === "function") ? rjGetAvgTyreGrip(driver) : 1.0;
  var tyreWear = (typeof rjGetAvgTyreWear === "function") ? rjGetAvgTyreWear(driver) : 0;
  var tyreTemp = (typeof rjGetAvgTyreTemp === "function") ? rjGetAvgTyreTemp(driver) : 90;
  
  // Voisins
  var pos = driver.pos || 99;
  var aheadDriver = LIVE_RACE.drivers.find(function(d) { return !d.dnf && d.pos === pos - 1; });
  var behindDriver = LIVE_RACE.drivers.find(function(d) { return !d.dnf && d.pos === pos + 1; });
  
  function _gapBetween(a, b) {
    if (!a || !b) return null;
    var aScore = a.score - (a.penaltySec || 0) / 45;
    var bScore = b.score - (b.penaltySec || 0) / 45;
    return Math.abs((aScore - bScore) * 45);
  }
  
  return {
    driver:       driver,
    lap:          LIVE_RACE.cur,
    total:        LIVE_RACE.total,
    lapPct:       lapPct,
    pushLevel:    pushLevel,
    tyreGrip:     tyreGrip,
    tyreWear:     tyreWear,
    tyreTemp:     tyreTemp,
    aheadDriver:  aheadDriver,
    behindDriver: behindDriver,
    gapAhead:     _gapBetween(driver, aheadDriver),
    gapBehind:    _gapBetween(driver, behindDriver),
    weather:      typeof RACE_STATE !== "undefined" && RACE_STATE.weather ? RACE_STATE.weather.id : "dry"
  };
}

/* ========================================================================
 * 3. CONSTRUCTION DU TOUR
 * Calcule les "événements vécus" du tour. Au plus 1-2 micro-events par tour
 * pour ne pas saturer.
 * ===================================================================== */

function rjBuildLap(driver) {
  if (!driver || driver.dnf || !driver._rjDriverState) return null;
  
  var ctx = _rjBuildLapContext(driver);
  if (!ctx) return null;
  
  // Calcul des événements potentiels
  var possible = [];
  RJ_LAP_MICRO_EVENTS.forEach(function(event) {
    try {
      if (event.when(ctx)) {
        possible.push(event);
      }
    } catch (e) {
      // Event qui plante ne casse pas le tour
    }
  });
  
  // Tirage : 0 à 2 événements par tour, pondérés par weight
  var triggered = [];
  if (possible.length > 0) {
    // Premier événement : choix pondéré
    var totalWeight = possible.reduce(function(s, e) { return s + (e.weight || 1); }, 0);
    var r = Math.random() * totalWeight;
    var acc = 0;
    var chosen = null;
    for (var i = 0; i < possible.length; i++) {
      acc += possible[i].weight || 1;
      if (r <= acc) {
        chosen = possible[i];
        break;
      }
    }
    if (chosen) triggered.push(chosen);
    
    // Petite chance d'un 2e événement (15%) : si le premier était négatif,
    // chance plus élevée d'un 2e négatif (effet boule de neige du mental)
    if (chosen && Math.random() < 0.15) {
      var others = possible.filter(function(e) { return e.id !== chosen.id; });
      if (others.length > 0) {
        var second = others[Math.floor(Math.random() * others.length)];
        triggered.push(second);
      }
    }
  }
  
  // Application des événements
  var narratives = [];
  triggered.forEach(function(event) {
    try {
      event.apply(driver, ctx);
      var n = event.narrative(driver, ctx);
      if (n) {
        n.eventId = event.id;
        n.isPositive = event.isPositive;
        n.lap = LIVE_RACE.cur;
        narratives.push(n);
      }
    } catch (e) {
      // Event qui plante ne casse pas le tour
    }
  });
  
  // Stocke pour debug et radio future
  driver._rjLastLap = {
    lap: LIVE_RACE.cur,
    pushLevel: ctx.pushLevel,
    tyreGrip: ctx.tyreGrip,
    tyreWear: ctx.tyreWear,
    events: narratives
  };
  
  // Buffer historique : garde les 10 derniers événements pour la radio team
  if (!driver._rjLapHistory) driver._rjLapHistory = [];
  if (narratives.length > 0) {
    driver._rjLapHistory.push.apply(driver._rjLapHistory, narratives);
    if (driver._rjLapHistory.length > 10) {
      driver._rjLapHistory = driver._rjLapHistory.slice(-10);
    }
  }
  
  // Décay automatique de la frustration en l'absence d'événements négatifs
  if (driver._rjDriverState && driver._rjDriverState.mental.frustration > 0) {
    driver._rjDriverState.mental.frustration = Math.max(0, driver._rjDriverState.mental.frustration - 0.5);
  }
  // Décay de la pressure quand pas d'enjeu
  if (driver._rjDriverState && driver._rjDriverState.mental.pressure > 30) {
    var pressureDecay = 0.3;
    // En fin de course avec rivaux proches, la pressure ne descend pas
    if (ctx.lapPct > 0.85 && (ctx.gapAhead < 2.0 || ctx.gapBehind < 2.0)) {
      pressureDecay = 0;
    }
    driver._rjDriverState.mental.pressure = Math.max(30, driver._rjDriverState.mental.pressure - pressureDecay);
  }
  // Momentum tend vers 0 (régression à la moyenne)
  if (driver._rjDriverState && driver._rjDriverState.mental.momentum) {
    driver._rjDriverState.mental.momentum *= 0.95;
  }
  
  return {
    events: narratives,
    pushLevel: ctx.pushLevel,
    ctx: ctx
  };
}

/* ========================================================================
 * 4. INIT D'AFFINITÉS CIRCUIT (rough Phase 3 → raffiné en Phase 5)
 * Au début de chaque course, attribue à chaque pilote une affinité
 * pseudo-aléatoire avec le circuit. Ce sera remplacé par les vraies
 * preferredCircuits/weakCircuits en Phase 5.
 * ===================================================================== */

function rjAssignCircuitAffinities() {
  if (!LIVE_RACE || !LIVE_RACE.drivers) return;
  LIVE_RACE.drivers.forEach(function(d) {
    // Affinité pseudo-aléatoire basée sur le hash du nom + circuit
    // Pour donner un effet stable sur la course
    var name = (d.name || "") + (typeof RACE_STATE !== "undefined" && RACE_STATE.circuit ? RACE_STATE.circuit : "");
    var hash = 0;
    for (var i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
    }
    // Hash mappé à 0..1
    var pseudoRand = ((hash >>> 0) % 100) / 100;
    // 20% des pilotes ont une affinité forte (>0.7), 60% neutre, 20% faible
    if (pseudoRand > 0.8) {
      d._rjCircuitAffinity = 0.6 + (pseudoRand - 0.8) * 2.0; // 0.6..1.0
    } else if (pseudoRand < 0.2) {
      d._rjCircuitAffinity = -0.5 + pseudoRand * 2.5; // -0.5..0
    } else {
      d._rjCircuitAffinity = 0;
    }
  });
}

/* ========================================================================
 * 5. UPDATE DU MENTAL SELON CONTEXTE COURSE
 * Appelé chaque tour pour faire évoluer le mental selon la situation :
 *   - Pression monte si rivaux proches en fin de course
 *   - Frustration monte si bloqué dans le trafic durablement
 *   - Confiance monte progressivement si on tient une position
 * ===================================================================== */

function rjUpdateMentalForLap(driver, ctx) {
  if (!driver || !driver._rjDriverState) return;
  var m = driver._rjDriverState.mental;
  
  // Pression : monte si rivaux proches en fin de course
  if (ctx.lapPct > 0.7) {
    if (ctx.gapAhead !== null && ctx.gapAhead < 2.0) {
      m.pressure = Math.min(100, m.pressure + 0.5);
    }
    if (ctx.gapBehind !== null && ctx.gapBehind < 1.5) {
      m.pressure = Math.min(100, m.pressure + 0.4);
    }
  }
  
  // Pression supplémentaire si en pole/podium et fin de course
  if (ctx.lapPct > 0.6 && driver.pos <= 3) {
    m.pressure = Math.min(100, m.pressure + 0.2);
  }
  
  // Confiance : monte progressivement si position stable et bons pneus
  if (ctx.tyreGrip > 0.95 && ctx.lap > 5) {
    m.confidence = Math.min(100, m.confidence + 0.1);
  }
  
  // Focus : descend lentement en stint long
  if (driver._rjCarState && driver._rjCarState.tyres.stintLap > 25) {
    m.focus = Math.max(45, m.focus - 0.15);
  }
  
  // Aggression : tend vers baseAggression de son style (régression à la moyenne)
  var baseAgg = driver._rjDriverState.style.baseAggression || 50;
  m.aggression += (baseAgg - m.aggression) * 0.05;
  
  // riskAppetite : recalculé dynamiquement
  // Combine aggression + (100 - pressure)*0.3 + confidence*0.3
  m.riskAppetite = m.aggression * 0.5 + (100 - m.pressure) * 0.25 + m.confidence * 0.25;
  m.riskAppetite = Math.max(0, Math.min(100, m.riskAppetite));
}

/* ========================================================================
 * 6. DEBUG CONSOLE
 * ===================================================================== */

function rjDebugLap() {
  if (typeof LIVE_RACE === "undefined" || !LIVE_RACE || !LIVE_RACE.drivers) {
    console.log("[RJ] Pas de course active");
    return;
  }
  
  console.log("=== RJ LAP STATES — Tour " + LIVE_RACE.cur + "/" + LIVE_RACE.total + " ===");
  console.log("Format: pos pilote | push | events_du_dernier_tour");
  
  LIVE_RACE.drivers.slice().sort(function(a,b){return (a.pos||99)-(b.pos||99);}).forEach(function(d) {
    if (!d._rjLastLap) return;
    var ll = d._rjLastLap;
    var label = (d.isPlayer ? "★ " : "  ") + (d.name || "?").substring(0, 22).padEnd(22);
    var pos = "P" + (d.pos || "?");
    var eventStr = ll.events && ll.events.length > 0 
      ? ll.events.map(function(e) { return (e.isPositive ? "+" : "−") + e.text; }).join(", ")
      : "(rien)";
    
    console.log(
      pos.padStart(4) + " " + label +
      " | push=" + ll.pushLevel.toFixed(2) +
      " | " + eventStr
    );
  });
}

function rjDebugLapOf(driverName) {
  if (typeof LIVE_RACE === "undefined" || !LIVE_RACE || !LIVE_RACE.drivers) {
    console.log("[RJ] Pas de course active");
    return;
  }
  var d = LIVE_RACE.drivers.find(function(dd) {
    return dd.name && dd.name.toLowerCase().indexOf((driverName || "").toLowerCase()) >= 0;
  });
  if (!d) {
    console.log("[RJ] Pilote non trouvé : " + driverName);
    return;
  }
  console.log("=== " + d.name + " — historique narratif ===");
  if (d._rjLapHistory && d._rjLapHistory.length > 0) {
    d._rjLapHistory.forEach(function(e) {
      var sign = e.isPositive ? "+" : "−";
      console.log("  Tour " + (e.lap || "?") + " " + sign + " " + e.text);
    });
  } else {
    console.log("  Aucun événement narratif récent");
  }
  console.log("");
  console.log("Mental :", d._rjDriverState && d._rjDriverState.mental);
}

function rjLastLapNarrative(driver) {
  if (!driver || !driver._rjLastLap) return null;
  return driver._rjLastLap;
}

function rjGetLapEvents(driver, count) {
  if (!driver || !driver._rjLapHistory) return [];
  return driver._rjLapHistory.slice(-(count || 5));
}

/* ========================================================================
 * 7. HOOK SUR updateLivePositions
 * On installe sur le wrapper Phase 2 (qui existe déjà) une seconde couche
 * qui appelle rjBuildLap() pour chaque pilote et rjUpdateMentalForLap().
 * ===================================================================== */

(function rjInstallLapBuilderHook() {
  if (typeof window === "undefined") return;
  
  if (window._rjLapBuilderHookInstalled) return;
  window._rjLapBuilderHookInstalled = true;
  
  // On wrappe à nouveau updateLivePositions (qui est déjà wrappé par 04c)
  // Le wrapper 04c gère les pneus en pre-tri ; on veut faire le lap building APRÈS
  // que les pneus soient mis à jour mais AVANT le tri final.
  // 
  // Solution : on hook à un endroit qui s'exécute juste après l'update pneus,
  // qu'on appelle nous-mêmes via window._rjPostTyreUpdate.
  //
  // Plus simple : on re-wrap updateLivePositions et on fait le lap building
  // dans le même bloc "1 fois par tour".
  
  var prevUpdate = window.updateLivePositions;
  if (typeof prevUpdate !== "function") {
    if (typeof setTimeout !== "undefined") setTimeout(rjInstallLapBuilderHook, 50);
    return;
  }
  
  window.updateLivePositions = function rjPhase3WrappedUpdateLivePos() {
    // Appel du wrapper Phase 2 d'abord (qui met à jour les pneus et pose _rjLastTickedLap)
    var result = prevUpdate.apply(this, arguments);
    
    try {
      if (LIVE_RACE && LIVE_RACE._rjPhase >= 1 && LIVE_RACE.drivers && !LIVE_RACE.finished) {
        // Init affinités circuit au tour 1 si pas fait
        if (!LIVE_RACE._rjCircuitAffinitiesAssigned && LIVE_RACE.cur >= 1) {
          rjAssignCircuitAffinities();
          LIVE_RACE._rjCircuitAffinitiesAssigned = true;
        }
        
        // Lap building : 1 fois par tour, après l'update pneus
        if (LIVE_RACE._rjLastLapBuilt !== LIVE_RACE.cur && LIVE_RACE._rjLastTickedLap === LIVE_RACE.cur) {
          LIVE_RACE._rjLastLapBuilt = LIVE_RACE.cur;
          LIVE_RACE._rjPhase = Math.max(LIVE_RACE._rjPhase || 1, 3);
          
          LIVE_RACE.drivers.forEach(function(d) {
            if (d.dnf || !d._rjDriverState) return;
            var ctx = _rjBuildLapContext(d);
            if (!ctx) return;
            // 1. Update mental selon contexte
            rjUpdateMentalForLap(d, ctx);
            // 2. Build lap (events narratifs + impact score)
            rjBuildLap(d);
          });
        }
      }
    } catch(e) {
      console.warn("[RJ] Erreur lap builder:", e && e.message);
    }
    
    return result;
  };
  
  console.log("[RJ] Module Phase 3 chargé — tour construit étape par étape. Debug: rjDebugLap()");
})();
