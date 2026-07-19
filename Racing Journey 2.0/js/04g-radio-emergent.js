/* =====================================================================
 * 04g-radio-emergent.js — REFONTE PHASE 6
 * 
 * Couche d'observation qui transforme l'état des Phases 1-5 en messages
 * radio team contextuels. C'est l'aboutissement narratif de la refonte :
 * tout ce que les phases précédentes calculent devient enfin VISIBLE.
 * 
 * 9 CATÉGORIES DE MESSAGES :
 *   1. Pneus       — sortie de fenêtre, cliff, surchauffe
 *   2. Mental      — pression, momentum négatif/positif
 *   3. Rivaux      — un rival qui craque, un rival en feu
 *   4. Overtake    — un rival proche fait attack_ahead
 *   5. Track       — drapeau jaune, SC, grip change
 *   6. Trafic      — backmarker en approche
 *   7. Stratégie   — fenêtre pit, undercut possible
 *   8. Position    — changement de classement
 *   9. Phase       — début/mi/fin de course
 * 
 * COOLDOWN :
 *   - Global : 3 tours minimum entre messages (sauf urgences SC/yellow)
 *   - Par catégorie : 8 tours entre deux messages du même type
 *   - Cohabitation avec tryContextualRadio existant via _lastRadioLap
 * 
 * EXPOSE :
 *   - rjEmitContextualRadio()   → fonction principale appelée chaque tour
 *   - rjDebugRadio()            → log les triggers possibles ce tour
 *   - rjForceRadio(category)    → force un message d'une catégorie (debug)
 * ===================================================================== */

/* ========================================================================
 * 1. POOL DE TEMPLATES PAR CATÉGORIE
 * Chaque template a des variations pour éviter la répétition.
 * Le {flavor} est remplacé par un mot de la team personality.
 * ===================================================================== */

var RJ_RADIO_TEMPLATES = {
  // ===== 1. PNEUS =====
  tyre_overheat: [
    { title: "Pneus en surchauffe", desc: "{flavor} — sois subtil dans les virages, lève dans les rapides." },
    { title: "Tes gommes chauffent", desc: "On voit la temp grimper. Calme la cadence 2-3 tours." },
    { title: "Surchauffe avant", desc: "{flavor}, gère les freinages, on perd du grip à l'avant." }
  ],
  tyre_cliff_warning: [
    { title: "Pneus en limite", desc: "Tu approches du cliff, plus que 4-5 tours de bon rythme." },
    { title: "Surveille tes gommes", desc: "{flavor} — la dégradation s'accélère, fenêtre pit qui s'ouvre." },
    { title: "Pneus en fin de vie", desc: "On est en fin de stint, prépare-toi à rentrer." }
  ],
  tyre_cold_pit: [
    { title: "Sortie de stand — pneus froids", desc: "Chauffe-les bien sur 2 tours avant de pousser." },
    { title: "Pneus froids au out lap", desc: "{flavor}, monte la temp progressivement." }
  ],
  tyre_optimal: [
    { title: "Pneus dans la fenêtre", desc: "{flavor} ! Grip optimal, c'est le moment de pousser." }
  ],
  
  // ===== 2. MENTAL =====
  mental_pressure_high: [
    { title: "Reste concentré", desc: "{flavor}, respire. On gère, ne pense pas au reste." },
    { title: "Garde la tête froide", desc: "Ne te laisse pas envahir, focus sur ton tour." }
  ],
  mental_momentum_positive: [
    { title: "Tu es en feu !", desc: "{flavor} ! Continue comme ça, le rythme est parfait." },
    { title: "Excellent rythme", desc: "On voit le delta, tu prends du temps à tout le monde." }
  ],
  mental_momentum_negative: [
    { title: "Recale-toi", desc: "{flavor}, on perd du rythme. Reset mental, tour propre." },
    { title: "Trouve le rythme", desc: "Reprends ta concentration, on a perdu 0.3s en 2 tours." }
  ],
  mental_frustration_high: [
    { title: "Garde ton sang-froid", desc: "{flavor}, ne fais pas de bêtise. La course est longue." },
    { title: "Ne te précipite pas", desc: "On voit la frustration, mais reste maître de ton tour." }
  ],
  
  // ===== 3. RIVAUX QUI CRAQUENT/POUSSENT =====
  rival_cracking: [
    { title: "{rival} multiplie les erreurs", desc: "{flavor}, il a fait plusieurs fautes — il craque, profite-en." },
    { title: "{rival} en difficulté", desc: "On le voit faiblir, c'est le moment d'aller le chercher." }
  ],
  rival_charging: [
    { title: "{rival} en feu", desc: "Il prend du temps à tous, méfie-toi s'il revient." },
    { title: "Attention à {rival}", desc: "{flavor}, il monte en régime — surveille ton rétro." }
  ],
  
  // ===== 4. OVERTAKE IMMINENT =====
  overtake_threat: [
    { title: "{rival} dans tes échappements", desc: "Gap {gap}s, il vise l'attaque — défends à l'intérieur." },
    { title: "{rival} prépare son coup", desc: "Il t'a dans les yeux, sois prêt à fermer la porte." }
  ],
  overtake_opportunity: [
    { title: "{rival} à portée", desc: "{flavor} ! Gap {gap}s, c'est jouable au prochain tour." },
    { title: "Approche de {rival}", desc: "Tu reviens fort, prépare ta zone de dépassement." }
  ],
  
  // ===== 5. TRACK STATE =====
  track_yellow: [
    { title: "Drapeau jaune {sector}", desc: "{rival} parti large — lève le pied dans la zone." },
    { title: "Yellow flag {sector}", desc: "Incident {rival}, respecte le drapeau." }
  ],
  track_safety_car: [
    { title: "Safety Car !", desc: "Incident {rival}. Compression du peloton, fenêtre pit gratuite." },
    { title: "SC en piste", desc: "{flavor}, on va se regrouper. Réfléchis stratégie." }
  ],
  track_sc_end: [
    { title: "Restart imminent", desc: "{flavor} — le SC rentre, prépare-toi à attaquer dès la ligne." }
  ],
  track_grip_evolving: [
    { title: "La piste se gomme", desc: "Le grip monte, on voit le delta sur les meilleurs tours." }
  ],
  
  // ===== 6. TRAFIC =====
  traffic_backmarker: [
    { title: "Trafic à venir", desc: "Backmarker dans 2-3 virages, sois patient au passage." },
    { title: "Retardataire en approche", desc: "{flavor}, tu vas le doubler, ne perds pas le rythme." }
  ],
  
  // ===== 7. STRATÉGIE =====
  strategy_pit_window: [
    { title: "Fenêtre pit ouverte", desc: "On y pense pour les 5 prochains tours — dis-nous quand." }
  ],
  strategy_undercut_threat: [
    { title: "{rival} vient de pit", desc: "{flavor}, undercut possible — réagis ou tu sors derrière." }
  ],
  strategy_undercut_opportunity: [
    { title: "Undercut sur {rival} ?", desc: "Il est en fin de stint, on peut le piéger en pit maintenant." }
  ],
  
  // ===== 8. POSITION =====
  position_into_points: [
    { title: "Dans les points !", desc: "{flavor}, tu marques maintenant. Sécurise cette place." }
  ],
  position_lost_points: [
    { title: "On sort des points", desc: "Faut remonter — pas de panique, on a le temps." }
  ],
  position_podium_reach: [
    { title: "Podium à portée", desc: "{flavor}, P3 à {gap}s — c'est jouable, pousse." }
  ],
  position_leader: [
    { title: "Tu es en tête", desc: "{flavor} ! Gestion maintenant, ne fais aucune bêtise." }
  ],
  
  // ===== 9. PHASE DE COURSE =====
  phase_start: [
    { title: "Bon départ", desc: "{flavor}, tu pars P{pos} — la course commence, garde la tête froide." }
  ],
  phase_final_sprint: [
    { title: "Sprint final", desc: "{flavor} ! Derniers tours, c'est maintenant ou jamais." }
  ],
  phase_last_lap: [
    { title: "Dernier tour", desc: "{flavor}, ramène-la à la maison !" }
  ]
};

/* ========================================================================
 * 2. UTILITAIRES
 * ===================================================================== */

function _rjPickTemplate(category) {
  var pool = RJ_RADIO_TEMPLATES[category];
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function _rjFormatRadioMsg(template, vars) {
  // Remplace {flavor}, {rival}, {gap}, {sector}, {pos} dans title et desc
  vars = vars || {};
  
  // Flavor : récupéré depuis _getTeamPersonality
  var flavor = "";
  if (typeof _getTeamPersonality === "function" && typeof _radioFlavor === "function") {
    try {
      var team = _getTeamPersonality();
      flavor = _radioFlavor(team);
    } catch(e) { flavor = ""; }
  }
  if (!flavor) flavor = "Mate";  // fallback générique
  vars.flavor = flavor;
  
  function replaceAll(str, vars) {
    if (!str) return "";
    Object.keys(vars).forEach(function(k) {
      var re = new RegExp("\\{" + k + "\\}", "g");
      str = str.replace(re, vars[k]);
    });
    return str;
  }
  
  return {
    title: replaceAll(template.title, vars),
    desc:  replaceAll(template.desc, vars)
  };
}

function _rjPushRadio(category, vars, opts) {
  if (!LIVE_RACE) return false;
  
  // Pas de message si pause (event modal)
  if (LIVE_RACE.paused) return false;
  
  // Cooldown global (sauf override par opts.urgent)
  var lastRadio = LIVE_RACE._lastRadioLap || -99;
  var globalCooldown = (opts && opts.urgent) ? 1 : 2;
  if (LIVE_RACE.cur - lastRadio < globalCooldown) return false;
  
  // Cooldown par catégorie : évite la répétition du même type
  if (!LIVE_RACE._rjRadioHistory) LIVE_RACE._rjRadioHistory = {};
  var lastCat = LIVE_RACE._rjRadioHistory[category] || -99;
  var catCooldown = (opts && opts.urgent) ? 3 : 6;
  if (LIVE_RACE.cur - lastCat < catCooldown) return false;
  
  // Pick template
  var template = _rjPickTemplate(category);
  if (!template) return false;
  
  // Format
  var formatted = _rjFormatRadioMsg(template, vars);
  
  // Push via la fonction existante
  if (typeof pushRadioMsg === "function") {
    pushRadioMsg(formatted.title, formatted.desc, {
      ttl: 5,
      color: (opts && opts.color) || "#22D3EE"
    });
  }
  
  // Update cooldowns
  LIVE_RACE._lastRadioLap = LIVE_RACE.cur;
  LIVE_RACE._rjRadioHistory[category] = LIVE_RACE.cur;
  
  return true;
}

/* ========================================================================
 * 3. DÉTECTEURS DE TRIGGERS
 * Chaque détecteur regarde l'état du jeu et retourne un message à
 * émettre, ou null si rien d'intéressant.
 * 
 * Le RETURN signale {category, vars, urgent, priority} si trigger,
 * sinon null.
 * 
 * priority : 0..10, plus haut = plus prioritaire si plusieurs détecteurs
 * matchent en même temps (un seul message par tour de toute façon).
 * ===================================================================== */

function _rjDetectTyreState(player, ctx) {
  if (!player._rjCarState) return null;
  
  var avgTemp = (typeof rjGetAvgTyreTemp === "function") ? rjGetAvgTyreTemp(player) : 90;
  var avgWear = (typeof rjGetAvgTyreWear === "function") ? rjGetAvgTyreWear(player) : 0;
  var avgGrip = (typeof rjGetAvgTyreGrip === "function") ? rjGetAvgTyreGrip(player) : 1.0;
  var compound = player._rjCarState.tyres.compoundProfile;
  var stintLap = player._rjCarState.tyres.stintLap || 0;
  
  // Cold pit (sortie de stand)
  if (stintLap > 0 && stintLap < 3 && avgTemp < 78 && avgWear < 5) {
    return { category: "tyre_cold_pit", vars: {}, priority: 4 };
  }
  
  // Cliff warning
  if (avgWear > 70 && avgWear < 88 && stintLap > 15) {
    return { category: "tyre_cliff_warning", vars: {}, priority: 6 };
  }
  
  // Surchauffe
  if (avgTemp > 112 && avgGrip < 0.95) {
    return { category: "tyre_overheat", vars: {}, priority: 5 };
  }
  
  // Pneus optimaux : seulement parfois (pas chaque tour qu'ils sont OK)
  if (avgGrip > 0.99 && avgWear < 30 && stintLap > 4 && stintLap < 12 && Math.random() < 0.15) {
    return { category: "tyre_optimal", vars: {}, priority: 2 };
  }
  
  return null;
}

function _rjDetectMentalState(player, ctx) {
  if (!player._rjDriverState) return null;
  var m = player._rjDriverState.mental;
  
  // Frustration haute
  if (m.frustration > 60) {
    return { category: "mental_frustration_high", vars: {}, priority: 4 };
  }
  
  // Pression haute en fin de course
  if (m.pressure > 65 && ctx.lapPct > 0.6) {
    return { category: "mental_pressure_high", vars: {}, priority: 4 };
  }
  
  // Momentum très positif
  if (m.momentum > 35) {
    return { category: "mental_momentum_positive", vars: {}, priority: 3 };
  }
  
  // Momentum très négatif
  if (m.momentum < -30) {
    return { category: "mental_momentum_negative", vars: {}, priority: 3 };
  }
  
  return null;
}

function _rjDetectRivalNarrative(player, ctx) {
  // Cherche un rival qui craque ou pousse, dans le top 5 ou autour du joueur
  if (!LIVE_RACE || !LIVE_RACE.drivers) return null;
  
  var pos = player.pos;
  var nearbyDrivers = LIVE_RACE.drivers.filter(function(d) {
    return !d.dnf && !d.isPlayer && Math.abs((d.pos || 99) - pos) <= 3;
  });
  
  // Cherche pilote qui craque (3+ events neg dans les 5 derniers laps)
  for (var i = 0; i < nearbyDrivers.length; i++) {
    var d = nearbyDrivers[i];
    if (!d._rjLapHistory) continue;
    var negRecent = 0;
    d._rjLapHistory.slice(-5).forEach(function(e) {
      if (!e.isPositive) negRecent++;
    });
    if (negRecent >= 3) {
      var lastName = (d.name || "Rival").split(" ").pop();
      return { category: "rival_cracking", vars: { rival: lastName }, priority: 6 };
    }
  }
  
  // Cherche pilote qui charge (momentum > 30)
  for (var i = 0; i < nearbyDrivers.length; i++) {
    var d = nearbyDrivers[i];
    if (!d._rjDriverState) continue;
    if (d._rjDriverState.mental.momentum > 30) {
      var lastName = (d.name || "Rival").split(" ").pop();
      // 60% chance de l'annoncer
      if (Math.random() < 0.6) {
        return { category: "rival_charging", vars: { rival: lastName }, priority: 5 };
      }
    }
  }
  
  return null;
}

function _rjDetectOvertake(player, ctx) {
  // Détecte si un rival proche a l'intention attack_ahead sur le joueur,
  // ou si le joueur a une opportunité d'attaque
  
  var behindD = ctx.behindDriver;
  var aheadD  = ctx.aheadDriver;
  
  // Menace : le pilote derrière est en attack_ahead
  if (behindD && behindD._rjCurrentIntent === "attack_ahead" && ctx.gapBehind !== null && ctx.gapBehind < 1.2) {
    var lastName = (behindD.name || "Rival").split(" ").pop();
    return { 
      category: "overtake_threat", 
      vars: { rival: lastName, gap: ctx.gapBehind.toFixed(1) }, 
      priority: 7 
    };
  }
  
  // Opportunité : le joueur est très proche derrière, position pas trop éloignée
  if (aheadD && ctx.gapAhead !== null && ctx.gapAhead < 1.0 && ctx.gapAhead > 0.2) {
    var lastName = (aheadD.name || "Rival").split(" ").pop();
    return { 
      category: "overtake_opportunity", 
      vars: { rival: lastName, gap: ctx.gapAhead.toFixed(1) }, 
      priority: 6 
    };
  }
  
  return null;
}

function _rjDetectTrackEvent(player, ctx) {
  if (!LIVE_RACE._track) return null;
  var track = LIVE_RACE._track;
  
  // Safety car (urgence)
  if (track.safetyCar && track.safetyCar.active) {
    // Premier tour du SC seulement → annonce
    if (LIVE_RACE.cur === track.safetyCar.lapStarted) {
      var origName = (track.safetyCar.originDriver || "un pilote").split(" ").pop();
      return { 
        category: "track_safety_car", 
        vars: { rival: origName }, 
        urgent: true, 
        priority: 10 
      };
    }
    // Dernier tour du SC → restart imminent
    if (track.safetyCar.lapsRemaining === 1) {
      return { category: "track_sc_end", vars: {}, urgent: true, priority: 9 };
    }
    return null; // pendant le SC, pas d'autres messages
  }
  
  // Drapeau jaune
  if (track.yellowSectors.length > 0) {
    var y = track.yellowSectors[0];
    // Annonce uniquement au tour de déclenchement
    if (y.startLap === LIVE_RACE.cur) {
      var origName = (y.originDriver || "Un pilote").split(" ").pop();
      return { 
        category: "track_yellow", 
        vars: { rival: origName, sector: y.sectorId }, 
        urgent: true, 
        priority: 8 
      };
    }
  }
  
  return null;
}

function _rjDetectTraffic(player, ctx) {
  if (!LIVE_RACE._track || !LIVE_RACE._track.trafficZones) return null;
  
  // Check si le joueur a été affecté par le trafic ce tour
  var lastZone = LIVE_RACE._track.trafficZones[LIVE_RACE._track.trafficZones.length - 1];
  if (lastZone && lastZone.lap === LIVE_RACE.cur && lastZone.leader === player.name) {
    return { category: "traffic_backmarker", vars: {}, priority: 4 };
  }
  
  return null;
}

function _rjDetectStrategy(player, ctx) {
  // Détecte des situations stratégiques notables
  
  // Pas de stratégie en début de course
  if (ctx.lapPct < 0.20) return null;
  if (ctx.lapPct > 0.80) return null;
  
  // Fenêtre pit ouverte (annonce 1 fois en milieu)
  if (typeof getPlayerPitStatus === "function") {
    try {
      var pitStatus = getPlayerPitStatus();
      if (pitStatus && pitStatus.inWindow && pitStatus.canPit && pitStatus.stopsRemaining > 0) {
        // 25% de chance d'annoncer une fois entrée en fenêtre
        if (Math.random() < 0.25) {
          return { category: "strategy_pit_window", vars: {}, priority: 4 };
        }
      }
    } catch(e) {}
  }
  
  // Threat undercut : un rival proche vient de pit
  var pos = player.pos;
  var nearbyDrivers = LIVE_RACE.drivers.filter(function(d) {
    return !d.dnf && !d.isPlayer && Math.abs((d.pos || 99) - pos) <= 2;
  });
  for (var i = 0; i < nearbyDrivers.length; i++) {
    var d = nearbyDrivers[i];
    if (d._lastPitLap === LIVE_RACE.cur - 1) {  // a pit tour précédent
      var lastName = (d.name || "Rival").split(" ").pop();
      return { 
        category: "strategy_undercut_threat", 
        vars: { rival: lastName }, 
        priority: 6 
      };
    }
  }
  
  return null;
}

function _rjDetectPositionChange(player, ctx) {
  // Détecte un changement de position significatif vers les points / podium
  if (!player.prevPos || player.prevPos === player.pos) return null;
  
  var pos = player.pos;
  var prev = player.prevPos;
  var pointsThreshold = 10;
  if (G.cat === "Endurance WEC" || G.cat === "Super Formula") pointsThreshold = 8;
  
  // Vient d'entrer dans les points
  if (prev > pointsThreshold && pos <= pointsThreshold) {
    return { category: "position_into_points", vars: {}, priority: 6 };
  }
  
  // Vient de sortir des points
  if (prev <= pointsThreshold && pos > pointsThreshold) {
    return { category: "position_lost_points", vars: {}, priority: 5 };
  }
  
  // Vient de prendre la tête
  if (prev > 1 && pos === 1) {
    return { category: "position_leader", vars: {}, priority: 7 };
  }
  
  // P4 ou P5 et podium proche (ahead à <2s)
  if (pos === 4 && ctx.gapAhead !== null && ctx.gapAhead < 2.5 && Math.random() < 0.3) {
    return { 
      category: "position_podium_reach", 
      vars: { gap: ctx.gapAhead.toFixed(1) }, 
      priority: 5 
    };
  }
  
  return null;
}

function _rjDetectPhaseEvent(player, ctx) {
  // Messages de phase : départ (tour 1), sprint final (>92%), dernier tour
  
  if (LIVE_RACE.cur === 1) {
    return { category: "phase_start", vars: { pos: player.pos }, priority: 5 };
  }
  
  if (ctx.lapPct > 0.95 && player.pos === 1) {
    return null; // déjà couvert par position_leader si applicable
  }
  
  if (LIVE_RACE.cur === LIVE_RACE.total) {
    return { category: "phase_last_lap", vars: {}, priority: 6 };
  }
  
  // Sprint final : tour proche de la fin, 1 fois
  if (ctx.lapPct > 0.88 && ctx.lapPct < 0.92 && Math.random() < 0.5) {
    return { category: "phase_final_sprint", vars: {}, priority: 5 };
  }
  
  return null;
}

/* ========================================================================
 * 4. ORCHESTRATEUR PRINCIPAL
 * Appelé chaque tour. Lance tous les détecteurs et émet le plus prioritaire.
 * ===================================================================== */

function rjEmitContextualRadio() {
  if (!LIVE_RACE || !LIVE_RACE.drivers || LIVE_RACE.finished || LIVE_RACE.paused) return;
  
  var player = LIVE_RACE.drivers.find(function(d) { return d.isPlayer; });
  if (!player || player.dnf) return;
  
  // Construire le contexte
  var ctx = (typeof _rjBuildLapContext === "function") ? _rjBuildLapContext(player) : null;
  if (!ctx) return;
  
  // Lancer tous les détecteurs
  var triggers = [];
  
  function tryDetect(detectorFn, name) {
    try {
      var t = detectorFn(player, ctx);
      if (t) {
        t._detector = name;
        triggers.push(t);
      }
    } catch(e) {
      // Détecteur qui plante ne casse pas le système
    }
  }
  
  // Ordre indifférent — on trie par priorité ensuite
  tryDetect(_rjDetectTrackEvent, "track");
  tryDetect(_rjDetectOvertake, "overtake");
  tryDetect(_rjDetectTyreState, "tyre");
  tryDetect(_rjDetectMentalState, "mental");
  tryDetect(_rjDetectRivalNarrative, "rival");
  tryDetect(_rjDetectStrategy, "strategy");
  tryDetect(_rjDetectPositionChange, "position");
  tryDetect(_rjDetectTraffic, "traffic");
  tryDetect(_rjDetectPhaseEvent, "phase");
  
  if (triggers.length === 0) return;
  
  // Trie par priorité décroissante
  triggers.sort(function(a, b) { return (b.priority || 0) - (a.priority || 0); });
  
  // Émet le plus prioritaire (s'il passe le cooldown)
  var best = triggers[0];
  _rjPushRadio(best.category, best.vars || {}, {
    urgent: !!best.urgent
  });
}

/* ========================================================================
 * 5. DEBUG
 * ===================================================================== */

function rjDebugRadio() {
  if (!LIVE_RACE || !LIVE_RACE.drivers) {
    console.log("[RJ] Pas de course active");
    return;
  }
  
  var player = LIVE_RACE.drivers.find(function(d) { return d.isPlayer; });
  if (!player) {
    console.log("[RJ] Pas de joueur");
    return;
  }
  
  var ctx = (typeof _rjBuildLapContext === "function") ? _rjBuildLapContext(player) : null;
  if (!ctx) {
    console.log("[RJ] Contexte indisponible");
    return;
  }
  
  console.log("=== RJ RADIO TRIGGERS — Tour " + LIVE_RACE.cur + "/" + LIVE_RACE.total + " ===");
  
  var detectors = [
    {fn: _rjDetectTrackEvent,    name: "track"},
    {fn: _rjDetectOvertake,      name: "overtake"},
    {fn: _rjDetectTyreState,     name: "tyre"},
    {fn: _rjDetectMentalState,   name: "mental"},
    {fn: _rjDetectRivalNarrative, name: "rival"},
    {fn: _rjDetectStrategy,      name: "strategy"},
    {fn: _rjDetectPositionChange, name: "position"},
    {fn: _rjDetectTraffic,       name: "traffic"},
    {fn: _rjDetectPhaseEvent,    name: "phase"}
  ];
  
  var anyTriggered = false;
  detectors.forEach(function(d) {
    try {
      var t = d.fn(player, ctx);
      if (t) {
        anyTriggered = true;
        console.log("  ✓ " + d.name.padEnd(10) + " | cat=" + t.category + " | priority=" + (t.priority || 0) + " | vars=" + JSON.stringify(t.vars || {}));
      }
    } catch(e) {
      console.log("  ✗ " + d.name + " (erreur: " + (e.message || e) + ")");
    }
  });
  
  if (!anyTriggered) {
    console.log("  Aucun trigger ce tour.");
  }
  
  // Affiche cooldowns
  console.log("\n  Cooldowns :");
  console.log("    Global lastRadio = T" + (LIVE_RACE._lastRadioLap || -99) + " (now T" + LIVE_RACE.cur + ")");
  if (LIVE_RACE._rjRadioHistory) {
    Object.keys(LIVE_RACE._rjRadioHistory).forEach(function(cat) {
      console.log("    " + cat + " = T" + LIVE_RACE._rjRadioHistory[cat]);
    });
  }
}

function rjForceRadio(category) {
  // Force l'émission d'un message de la catégorie (debug uniquement)
  if (!LIVE_RACE) return false;
  // Reset les cooldowns spécifiquement
  LIVE_RACE._lastRadioLap = -99;
  if (LIVE_RACE._rjRadioHistory) delete LIVE_RACE._rjRadioHistory[category];
  return _rjPushRadio(category, {rival: "TestPilot", sector: "S2", gap: "0.5", pos: 5});
}

/* ========================================================================
 * 6. HOOK PRINCIPAL
 * On wrappe updateLivePositions une dernière fois, après Phase 5.
 * ===================================================================== */

(function rjInstallRadioHook() {
  if (typeof window === "undefined") return;
  if (window._rjRadioHookInstalled) return;
  window._rjRadioHookInstalled = true;
  
  var prevUpdate = window.updateLivePositions;
  if (typeof prevUpdate !== "function") {
    if (typeof setTimeout !== "undefined") setTimeout(rjInstallRadioHook, 50);
    return;
  }
  
  window.updateLivePositions = function rjPhase6WrappedUpdateLivePos() {
    var result = prevUpdate.apply(this, arguments);
    
    try {
      if (LIVE_RACE && LIVE_RACE._rjPhase >= 1 && LIVE_RACE.drivers && !LIVE_RACE.finished) {
        // 1 tentative par tour, après tout le reste (track update inclus)
        if (LIVE_RACE._rjLastRadioCheck !== LIVE_RACE.cur && 
            LIVE_RACE._rjLastTrackUpdate === LIVE_RACE.cur) {
          LIVE_RACE._rjLastRadioCheck = LIVE_RACE.cur;
          LIVE_RACE._rjPhase = Math.max(LIVE_RACE._rjPhase || 1, 6);
          
          rjEmitContextualRadio();
        }
      }
    } catch(e) {
      console.warn("[RJ] Erreur radio emergent:", e && e.message);
    }
    
    return result;
  };
  
  console.log("[RJ] Module Phase 6 chargé — radio team émergente. Debug: rjDebugRadio()");
})();
