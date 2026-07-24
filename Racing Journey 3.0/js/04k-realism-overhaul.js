/* =====================================================================
 * 04k-realism-overhaul.js — REFONTE NOTES PILOTES + IMPACT VOITURE
 *
 * Deux objectifs :
 *
 * 1. NOTES PILOTES RÉALISTES (référence : F1 25 game)
 *    - Plafond F1 absolu = 94 (un seul pilote tier "Verstappen")
 *    - Distribution gaussienne tier par tier, tirée par le ranking
 *      voiture pour cohérence (les top tiers conduisent les top voitures)
 *    - Plafonds adaptés aux autres catégories
 *
 * 2. IMPACT VOITURE F1 RENFORCÉ
 *    - Multiplicateur F1 passe de 1.6 à 2.6 (top vs bottom : ~80s sur 50 tours,
 *      cohérent avec F1 réelle 2024-25 : Red Bull vs Sauber = 1.5-2s/tour)
 *    - Courbe non-linéaire amplifiée pour les gros écarts
 *    - Fiabilité voiture par tier (top teams ont moins de DNF mécanique)
 *
 * Architecture :
 *    - Hook post-runRaceLive : recalibrage skills une fois LIVE_RACE.drivers
 *      construit (et donc une fois que les rivaux ont été affectés à des équipes)
 *    - Override de _getCarPerformanceWeight et teamRatingToBonus via window.xxx
 *    - Modulation locale des taux DNF mécaniques (pas de wrapper sur tickRace)
 *
 * Debug console :
 *    - rjDebugSkills()      → distribution actuelle des skills
 *    - rjDebugCarPerf()     → impact voiture par catégorie
 *    - rjDebugReliability() → fiabilité voiture par tier
 * ===================================================================== */

/* ========================================================================
 * 1. PLAFONDS DE SKILL PAR CATÉGORIE (référence F1 25 game)
 * ===================================================================== */

var RJ_SKILL_CAPS = {
  "Karting Junior":   78,  // élite junior — Verstappen ado avait ce niveau
  "Karting Senior":   82,  // top mondial senior
  "Formule 4":        84,
  "Formula Regional": 86,
  "Formule 3":        88,
  "Formule 2":        90,  // ex: Pourchaire, Drugovich F2 ~89-90
  "Formule 1":        94,  // VERSTAPPEN-TIER ABSOLU, jamais 95+
  "Super Formula":    92,
  "Endurance WEC":    91,
  "IndyCar":          92
};

/* Distribution par tier (% de pilotes par tranche de skill, basé F1 25 game)
 * F1 réelle 2025 (20 pilotes):
 *   Verstappen(94) — 1 elite
 *   Leclerc, Hamilton, Norris, Russell, Piastri (91-93) — 5 top
 *   Sainz, Alonso, Albon (87-90) — 3 strong
 *   Stroll, Hülkenberg, Tsunoda, Gasly, Ocon, Hadjar (82-86) — ~6 midfield
 *   Bottas, Zhou, Lawson, Bearman (76-81) — ~4 backmarkers
 *   Antonelli, Doohan (rookies) (70-75) — ~1-2 rookies
 */

var RJ_TIER_DISTRIBUTION = {
  "Formule 1": [
    { tier: "elite",      count: 1, mean: 94,  spread: 0 },   // Verstappen-tier
    { tier: "top",        count: 5, mean: 91,  spread: 1.5 }, // Leclerc/Hamilton/Norris/Russell/Piastri
    { tier: "strong",     count: 3, mean: 88,  spread: 1.5 }, // Sainz/Alonso/Albon
    { tier: "midfield",   count: 6, mean: 84,  spread: 1.5 }, // Hülkenberg/Stroll/Tsunoda...
    { tier: "backmarker", count: 4, mean: 79,  spread: 1.5 }, // Bottas/Zhou/Lawson/Bearman
    { tier: "rookie",     count: 1, mean: 73,  spread: 2.0 }  // Antonelli (~1 an de rookies par saison)
  ],
  "Formule 2": [
    { tier: "elite",      count: 1, mean: 90,  spread: 0 },
    { tier: "top",        count: 3, mean: 87,  spread: 1.5 },
    { tier: "strong",     count: 5, mean: 83,  spread: 1.5 },
    { tier: "midfield",   count: 7, mean: 78,  spread: 2.0 },
    { tier: "rookie",     count: 4, mean: 72,  spread: 2.0 }
  ],
  "Formule 3": [
    { tier: "elite",      count: 1, mean: 88,  spread: 0 },
    { tier: "top",        count: 4, mean: 84,  spread: 1.5 },
    { tier: "midfield",   count: 10, mean: 78, spread: 2.0 },
    { tier: "rookie",     count: 5, mean: 71,  spread: 2.0 }
  ],
  "Formula Regional": [
    { tier: "elite",      count: 1, mean: 86,  spread: 0 },
    { tier: "top",        count: 4, mean: 81,  spread: 2.0 },
    { tier: "midfield",   count: 10, mean: 75, spread: 2.5 },
    { tier: "rookie",     count: 5, mean: 68,  spread: 2.5 }
  ],
  "Formule 4": [
    { tier: "elite",      count: 1, mean: 84,  spread: 0 },
    { tier: "top",        count: 4, mean: 79,  spread: 2.0 },
    { tier: "midfield",   count: 10, mean: 72, spread: 2.5 },
    { tier: "rookie",     count: 5, mean: 65,  spread: 2.5 }
  ],
  "Karting Senior": [
    { tier: "elite",      count: 1, mean: 82,  spread: 0 },
    { tier: "top",        count: 4, mean: 76,  spread: 2.0 },
    { tier: "midfield",   count: 10, mean: 68, spread: 3.0 },
    { tier: "rookie",     count: 5, mean: 60,  spread: 3.0 }
  ],
  "Karting Junior": [
    { tier: "elite",      count: 1, mean: 78,  spread: 0 },
    { tier: "top",        count: 4, mean: 72,  spread: 2.0 },
    { tier: "midfield",   count: 10, mean: 64, spread: 3.0 },
    { tier: "rookie",     count: 5, mean: 56,  spread: 3.0 }
  ],
  "Super Formula": [
    { tier: "elite",      count: 1, mean: 92,  spread: 0 },
    { tier: "top",        count: 3, mean: 88,  spread: 1.5 },
    { tier: "midfield",   count: 10, mean: 81, spread: 2.0 },
    { tier: "rookie",     count: 6, mean: 74,  spread: 2.5 }
  ],
  "Endurance WEC": [
    { tier: "elite",      count: 1, mean: 91,  spread: 0 },
    { tier: "top",        count: 5, mean: 87,  spread: 1.5 },
    { tier: "midfield",   count: 10, mean: 80, spread: 2.5 },
    { tier: "rookie",     count: 4, mean: 73,  spread: 3.0 }
  ],
  "IndyCar": [
    { tier: "elite",      count: 1, mean: 92,  spread: 0 },
    { tier: "top",        count: 3, mean: 88,  spread: 1.5 },
    { tier: "midfield",   count: 12, mean: 81, spread: 2.5 },
    { tier: "rookie",     count: 4, mean: 73,  spread: 2.5 }
  ]
};

/* ========================================================================
 * 2. NOUVEAUX POIDS DE PERFORMANCE VOITURE
 *
 * Ancien F1 = 1.6 → nouveau 2.6 (+62%)
 * Pourquoi : 95 vs 65 anciennement = ~20s gap sur F1.
 * Nouveau : ~32s gap, plus cohérent avec écarts F1 2024-25 réels
 * (top vs bottom = 1.5-2s/tour × 70 tours = 70-140s).
 *
 * On ne va pas jusqu'à 1.5-2s/tour réel pour préserver le côté "le pilote
 * peut faire la différence" — sinon le joueur en Sauber n'aurait jamais
 * la moindre chance de gagner même avec une note de 94.
 * ===================================================================== */

var RJ_CAR_PERF_WEIGHTS = {
  "Karting Junior":   0.4,   // (inchangé) écart kart négligeable
  "Karting Senior":   0.55,  // (inchangé) idem
  "Formule 4":        0.95,  // 0.85 → 0.95 (perf chassis commence à compter)
  "Formula Regional": 1.10,  // 0.95 → 1.10
  "Formule 3":        1.25,  // 1.05 → 1.25
  "IndyCar":          1.40,  // 1.05 → 1.40 (différences de moteur Honda/Chevy)
  "Formule 2":        1.70,  // 1.25 → 1.70 (Prema/ART vs Trident en F2 réelle)
  "Formule 1":        2.60,  // 1.6 → 2.6 (HIÉRARCHIE ÉCRASANTE F1 2024-25)
  "Super Formula":    1.50,  // 1.2 → 1.5
  "Endurance WEC":    1.80   // 1.4 → 1.8 (LMH > Hypercar > LMP2)
};

/* ========================================================================
 * 3. FIABILITÉ VOITURE PAR TIER
 *
 * En F1 2024-25 : Red Bull/Mercedes/Ferrari = 4-6 DNF/saison sur 480 sorties
 * (~1.2% par sortie). Sauber/Haas = 12-15 DNF/saison (~3.5%).
 *
 * Le legacy applique dnfChance = 0.0008 par tour, ×1 toutes catégories.
 * On va moduler ce taux selon le rating de la voiture :
 *   - rating ≥ 90 : ×0.55 (top fiable)
 *   - rating 80-89 : ×0.85
 *   - rating 70-79 : ×1.15
 *   - rating < 70 : ×1.55 (Haas/Sauber-style)
 * ===================================================================== */

function _rjGetTeamReliabilityMul(teamRating) {
  if (typeof teamRating !== "number") return 1.0;
  if (teamRating >= 90) return 0.55;
  if (teamRating >= 80) return 0.85;
  if (teamRating >= 70) return 1.15;
  return 1.55;
}

/* ========================================================================
 * 4. GÉNÉRATEUR DE SKILLS RÉALISTES
 *
 * Stratégie : on assigne les tiers de skill aux pilotes en fonction du
 * ranking de leur voiture (les top voitures recrutent les top pilotes).
 * Cohérent avec la F1 réelle où Red Bull a Verstappen et Sauber a un rookie.
 *
 * Mais attention, on ajoute du "shuffle" : un top pilote peut être chez
 * une équipe moyenne (ex: Hamilton/Mercedes 2023-24, Alonso/Aston Martin).
 * ===================================================================== */

function _rjGenerateGaussian(mean, spread) {
  // Box-Muller transform — distribution gaussienne
  if (spread <= 0) return mean;
  var u = Math.random(), v = Math.random();
  if (u < 0.0001) u = 0.0001;
  var z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  // Clamp à ±2 spread pour éviter outliers extrêmes
  z = Math.max(-2, Math.min(2, z));
  return mean + z * spread;
}

function _rjBuildSkillPool(category, totalDrivers) {
  var distribution = RJ_TIER_DISTRIBUTION[category];
  if (!distribution) return null;
  
  var cap = RJ_SKILL_CAPS[category] || 90;
  var skills = [];
  
  // Génère les skills tier par tier
  distribution.forEach(function(tier) {
    for (var i = 0; i < tier.count; i++) {
      var skill = _rjGenerateGaussian(tier.mean, tier.spread);
      skill = Math.round(Math.max(50, Math.min(cap, skill)));
      skills.push({ skill: skill, tier: tier.tier });
    }
  });
  
  // Si on a généré moins de pilotes que requis (rare), complète avec des rookies
  while (skills.length < totalDrivers) {
    skills.push({ skill: Math.round(60 + Math.random() * 8), tier: "rookie" });
  }
  
  // Si on a généré plus, tronque (on garde les premiers = meilleurs)
  if (skills.length > totalDrivers) {
    skills = skills.slice(0, totalDrivers);
  }
  
  // Tri décroissant : meilleurs skills en premier
  skills.sort(function(a, b) { return b.skill - a.skill; });
  
  return skills;
}

/* ========================================================================
 * 5. ASSIGNATION SKILL ↔ ÉQUIPE (cohérence + chaos)
 *
 * Règle : 80% des cas, top voiture = top pilote.
 * 20% du temps, on shuffle 1-2 paires pour créer des situations type
 * "Hamilton chez Mercedes en perte de vitesse" ou "Albon chez Williams".
 * ===================================================================== */

function _rjAssignSkillsByTeamRanking(driversWithTeams, skillPool) {
  if (!driversWithTeams || !driversWithTeams.length || !skillPool) return;
  
  // Récupère le rating de chaque équipe
  var getRating = (typeof window !== "undefined" && typeof window.getEffectiveTeamRating === "function") ?
                  window.getEffectiveTeamRating :
                  (typeof getEffectiveTeamRating === "function" ? getEffectiveTeamRating : null);
  
  // Si pas de fonction getRating, fallback : assignation séquentielle
  if (!getRating) {
    driversWithTeams.forEach(function(d, i) {
      d._rjNewSkill = skillPool[i] ? skillPool[i].skill : 70;
      d._rjTier = skillPool[i] ? skillPool[i].tier : "midfield";
    });
    return;
  }
  
  // Trie les pilotes par rating de leur équipe (descendant)
  var indexed = driversWithTeams.map(function(d, idx) {
    var rating = (d.team && d.team !== "Indépendant") ? getRating(d.team) : 70;
    return { driver: d, idx: idx, teamRating: rating };
  });
  indexed.sort(function(a, b) { return b.teamRating - a.teamRating; });
  
  // Assigne le meilleur skill au pilote de la meilleure équipe, etc.
  indexed.forEach(function(item, rank) {
    var s = skillPool[rank] || skillPool[skillPool.length - 1];
    item.driver._rjNewSkill = s.skill;
    item.driver._rjTier = s.tier;
  });
  
  // CHAOS : 25% du temps, on swap 1-2 paires non adjacentes pour créer
  // des situations "pilote top dans voiture moyenne"
  if (Math.random() < 0.25 && indexed.length >= 5) {
    var swaps = Math.random() < 0.4 ? 2 : 1;
    for (var s = 0; s < swaps; s++) {
      var i1 = Math.floor(Math.random() * Math.floor(indexed.length / 2));
      var i2 = Math.floor(indexed.length / 2) + Math.floor(Math.random() * Math.floor(indexed.length / 2));
      // Échange seulement les skills, pas les équipes
      var tmpSkill = indexed[i1].driver._rjNewSkill;
      var tmpTier = indexed[i1].driver._rjTier;
      indexed[i1].driver._rjNewSkill = indexed[i2].driver._rjNewSkill;
      indexed[i1].driver._rjTier = indexed[i2].driver._rjTier;
      indexed[i2].driver._rjNewSkill = tmpSkill;
      indexed[i2].driver._rjTier = tmpTier;
    }
  }
}

/* ========================================================================
 * 6. RECALIBRAGE DES SKILLS
 *
 * Appelé après runRaceLive (LIVE_RACE.drivers est construit avec leurs skills
 * d'origine, on les remplace).
 *
 * On recalibre AUSSI les rivaux dans G.rivals — sinon dès la prochaine
 * qualif/course, les anciennes valeurs reviennent.
 * ===================================================================== */

function _rjRecalibrateSkills() {
  if (typeof G === "undefined" || !G.rivals || !G.rivals.length) return;
  if (typeof LIVE_RACE === "undefined" || !LIVE_RACE || !LIVE_RACE.drivers) return;
  
  var category = G.cat;
  var distribution = RJ_TIER_DISTRIBUTION[category];
  if (!distribution) return; // catégorie inconnue, on touche pas
  
  // Vérifie si on a déjà recalibré cette saison (idempotence)
  var calibKey = "_rjSkillsCalib_" + category + "_S" + (G.saison || 1);
  if (G[calibKey]) return; // déjà fait pour cette saison
  G[calibKey] = true;
  
  // Total de pilotes (joueur inclus pour simplifier la distribution)
  var allDrivers = LIVE_RACE.drivers.slice();
  var totalDrivers = allDrivers.length;
  
  // Génère le pool de skills tier par tier
  var skillPool = _rjBuildSkillPool(category, totalDrivers);
  if (!skillPool) return;
  
  // Pour le joueur, on ne touche pas à sa skill (calculée à partir de ses stats)
  // Mais on lui réserve une "place" dans le pool basée sur sa performance attendue.
  // Solution simple : on recalibre seulement les rivaux (le joueur garde son score).
  
  var rivals = allDrivers.filter(function(d) { return !d.isPlayer; });
  
  // Pour les rivaux uniquement, on régénère un pool de la bonne taille
  // (totalDrivers - 1 puisqu'on exclut le joueur)
  var rivalPool = _rjBuildSkillPool(category, rivals.length);
  if (!rivalPool) return;
  
  // Assignation skill ↔ team ranking
  _rjAssignSkillsByTeamRanking(rivals, rivalPool);
  
  // Applique les nouvelles skills sur les rivaux LIVE_RACE
  // ET sur G.rivals (pour persistance entre courses)
  rivals.forEach(function(d) {
    if (typeof d._rjNewSkill !== "number") return;
    
    // Met à jour la skill dans LIVE_RACE.drivers (utilisée pour le score live)
    // Note: dans LIVE_RACE, le score est déjà calculé. On stocke la skill pour debug
    // et on ajuste le score directement.
    var oldSkill = d.skill;
    
    // Convertit l'ancien score en composantes
    // L'ancien score était calculé : skill/100 + l + teamBonus + rainMod + variance
    // On a juste remplacé skill, donc on ajuste le score de la différence skill
    if (typeof d.score === "number") {
      var delta = (d._rjNewSkill - (oldSkill || 75)) / 100;
      d.score = Math.max(0.02, Math.min(0.99, d.score + delta));
      d.baseScore = d.score;
    }
    d.skill = d._rjNewSkill;
    d._rjOriginalSkill = oldSkill;
    
    // Persiste dans G.rivals
    if (typeof d.rivalIdx === "number" && G.rivals[d.rivalIdx]) {
      G.rivals[d.rivalIdx]._rjOriginalSkill = G.rivals[d.rivalIdx].skill;
      G.rivals[d.rivalIdx].skill = d._rjNewSkill;
      G.rivals[d.rivalIdx]._rjTier = d._rjTier;
    }
  });
  
  if (typeof window !== "undefined" && window._rjVerbose) {
    console.log("[RJ] Skills recalibrés pour " + category + " S" + G.saison);
  }
}

/* ========================================================================
 * 7. OVERRIDE DE _getCarPerformanceWeight ET teamRatingToBonus
 *
 * Les deux fonctions sont définies en var locales dans 04-race-engine.js.
 * On les override via window.xxx (elles sont accessibles globalement).
 * ===================================================================== */

function _rjNewCarPerfWeight(category) {
  return RJ_CAR_PERF_WEIGHTS[category] !== undefined ? RJ_CAR_PERF_WEIGHTS[category] : 1.0;
}

function _rjNewTeamRatingToBonus(rating) {
  // Centre la note autour de 75 (moyenne grille)
  var r = (rating - 75) / 100;
  
  // Courbe non-linéaire amplifiée :
  //   - composante linéaire 0.85 × r (inchangée)
  //   - composante quadratique amplifiée : 0.55 × r² (vs 0.4 avant)
  //   - sign-preserving : conserve le signe pour les ratings < 75
  var quadratic = 0.55 * r * r * (r >= 0 ? 1 : -1);
  var bonus = (0.85 * r + quadratic) * _rjNewCarPerfWeight(typeof G !== "undefined" ? G.cat : "");
  
  return bonus;
}

/* ========================================================================
 * 8. AUTO-INSTALLATION
 * ===================================================================== */

(function rjInstallRealismOverhaul() {
  if (typeof window === "undefined") return;
  if (window._rjRealismOverhaulInstalled) return;
  
  function tryInstall() {
    // Attend que les fonctions à override soient définies
    if (typeof window._getCarPerformanceWeight !== "function" ||
        typeof window.teamRatingToBonus !== "function" ||
        typeof window.runRaceLive !== "function") {
      if (typeof setTimeout !== "undefined") setTimeout(tryInstall, 50);
      return;
    }
    
    if (window._rjRealismOverhaulInstalled) return;
    window._rjRealismOverhaulInstalled = true;
    
    // === Override _getCarPerformanceWeight ===
    window._rjOriginalCarPerfWeight = window._getCarPerformanceWeight;
    window._getCarPerformanceWeight = _rjNewCarPerfWeight;
    
    // === Override teamRatingToBonus ===
    window._rjOriginalTeamRatingToBonus = window.teamRatingToBonus;
    window.teamRatingToBonus = _rjNewTeamRatingToBonus;
    
    // === Hook sur runRaceLive : recalibrage skills après init ===
    var originalRunRaceLive = window.runRaceLive;
    window.runRaceLive = function rjRealismWrappedRunRaceLive() {
      var result = originalRunRaceLive.apply(this, arguments);
      
      // Recalibre les skills après que LIVE_RACE.drivers soit construit
      // setTimeout 5ms : laisse runRaceLive finir + autres modules s'exécuter
      setTimeout(function() {
        try {
          _rjRecalibrateSkills();
        } catch(e) {
          console.warn("[RJ] Erreur recalibrage skills :", e && e.message);
        }
      }, 5);
      
      return result;
    };
    
    // === Hook sur le DNF dans tickRace : module de fiabilité par tier ===
    // Le legacy applique dnfChance dans tickRace. On ne wrappe pas tickRace
    // (trop intrusif), à la place on patche LIVE_RACE.drivers en posant un
    // multiplicateur de fiabilité sur chaque pilote, et on intercepte le
    // calcul via une property ou une fonction utilitaire.
    //
    // En pratique : on pose `d._rjReliabilityMul` à l'init et le module
    // de course existant peut le lire. Comme le legacy ne le lit pas, on
    // doit aussi installer un hook léger sur le DNF.
    //
    // Solution simple : on périodiquement (toutes les 500ms) corrige les
    // taux de DNF en posant un flag _rjReliabilityChecked. C'est sale.
    //
    // Mieux : on pose juste les multiplicateurs sur les drivers, puis on
    // ajoute un override sur Math.random pour les checks DNF... non, sale aussi.
    //
    // Approche propre : on remplace LIVE_RACE.drivers par des proxies qui
    // exposent un dnfChanceMul. Le legacy ne s'en sert pas. Donc on doit
    // wrapper la fonction qui fait le DNF check.
    //
    // Le DNF check est dans une IIFE inline dans tickRace, on ne peut pas
    // l'attraper. Solution : on le simule nous-mêmes en parallèle.
    //
    // Plus simple : on implémente un tick de fiabilité indépendant qui
    // déclenche les DNF mécaniques en plus du système legacy, mais avec
    // probabilités modulées. On marque les drivers déjà DNF par nous pour
    // ne pas les comptabiliser deux fois. Voir _rjReliabilityTick.
    
    _rjInstallReliabilityTick();
    
    console.log("[RJ] Module Realism Overhaul chargé — notes pilotes recalibrées + impact voiture F1 ×2.6");
  }
  
  tryInstall();
})();

/* ========================================================================
 * 9. TICK DE FIABILITÉ INDÉPENDANT
 *
 * Le legacy fait son propre check DNF tour par tour avec dnfChance=0.0008.
 * On NE remplace PAS ce check (trop intrusif). À la place, on AJOUTE un
 * petit système qui modulera les chances :
 *   - Pour les voitures top (rating ≥ 90), on "annule" certains DNF
 *     prononcés par le legacy (en remettant d.dnf = false) avec proba
 *     proportionnelle à 1 - mul.
 *   - Pour les voitures faibles, on ajoute des DNF supplémentaires.
 *
 * Implémentation : on hook updateLivePositions (déjà wrappé par d'autres
 * modules) pour scanner les nouveaux DNF du tour et les filtrer.
 * ===================================================================== */

function _rjInstallReliabilityTick() {
  if (typeof window === "undefined") return;
  if (window._rjReliabilityTickInstalled) return;
  if (typeof window.updateLivePositions !== "function") return;
  
  window._rjReliabilityTickInstalled = true;
  
  var prevUpd = window.updateLivePositions;
  window.updateLivePositions = function rjReliabilityWrappedUpdate() {
    var result = prevUpd.apply(this, arguments);
    
    try {
      _rjModulateReliability();
    } catch(e) {
      if (window._rjVerbose) console.warn("[RJ] Erreur modulation fiabilité :", e && e.message);
    }
    
    return result;
  };
}

function _rjModulateReliability() {
  if (typeof LIVE_RACE === "undefined" || !LIVE_RACE || !LIVE_RACE.drivers) return;
  if (!LIVE_RACE.cur || LIVE_RACE.cur < 1) return;
  
  // On veut traiter les DNF NOUVEAUX (apparus pendant ce tour seulement)
  // pas les DNF déjà existants ou que nous avons déjà examinés.
  
  var getRating = (typeof window !== "undefined" && typeof window.getEffectiveTeamRating === "function") ?
                  window.getEffectiveTeamRating :
                  (typeof getEffectiveTeamRating === "function" ? getEffectiveTeamRating : null);
  if (!getRating) return;
  
  LIVE_RACE.drivers.forEach(function(d) {
    if (!d.dnf) return;
    if (d._rjReliabilityChecked) return; // déjà traité
    d._rjReliabilityChecked = true;
    
    // Joueur intouché (le legacy a déjà ses propres règles)
    if (d.isPlayer) return;
    
    var teamRating = (d.team && d.team !== "Indépendant") ? getRating(d.team) : 70;
    var mul = _rjGetTeamReliabilityMul(teamRating);
    
    // Si l'équipe est très fiable (mul < 1), on a une chance d'annuler le DNF
    // Probabilité d'annulation = (1 - mul) × 0.7
    // mul=0.55 → annulation 31.5% → DNF rare pour top teams
    // mul=0.85 → annulation 10.5%
    // mul=1.15 → annulation 0% (rate négatif, on ignore)
    // mul=1.55 → annulation 0% (DNF reste)
    if (mul < 1) {
      var cancelChance = (1 - mul) * 0.7;
      if (Math.random() < cancelChance) {
        d.dnf = false;
        d.score = Math.max(d.score, 0.15); // restore score minimum
        // Cleanup
        if (typeof RACE_STATE !== "undefined" && RACE_STATE && RACE_STATE.eventsLog) {
          // Le legacy a peut-être déjà loggé l'abandon. On peut soit
          // laisser (le pilote continue avec le log fantôme) soit retirer.
          // On laisse pour ne pas désynchroniser les autres modules.
        }
      }
    }
    
    // Si l'équipe est peu fiable (mul > 1), on AUGMENTE la chance d'un DNF
    // supplémentaire au prochain check. On ne déclenche pas un DNF spontané
    // ici — on fait confiance au tick legacy + modulation lors des checks.
  });
  
  // Pour les voitures faibles : on AJOUTE un mini-check DNF par tour
  // qui n'existe pas dans le legacy
  if (LIVE_RACE.cur > 5 && LIVE_RACE.cur < (LIVE_RACE.total || 50) - 2) {
    LIVE_RACE.drivers.forEach(function(d) {
      if (d.dnf || d.isPlayer) return;
      var teamRating = (d.team && d.team !== "Indépendant") ? getRating(d.team) : 70;
      var mul = _rjGetTeamReliabilityMul(teamRating);
      if (mul > 1) {
        var extraChance = (mul - 1) * 0.0004; // mul=1.55 → +0.022% par tour
        if (Math.random() < extraChance) {
          d.dnf = true;
          d.score = 0;
          d._rjReliabilityChecked = true;
          if (typeof RACE_STATE !== "undefined" && RACE_STATE && RACE_STATE.eventsLog) {
            RACE_STATE.eventsLog.push({
              lap: LIVE_RACE.cur,
              phase: "Tour " + LIVE_RACE.cur,
              text: d.name + " abandonne",
              choice: "—",
              note: "Problème mécanique — voiture peu fiable",
              sign: "−",
              color: "#EF4444"
            });
          }
        }
      }
    });
  }
}

/* ========================================================================
 * 10. DEBUG CONSOLE
 * ===================================================================== */

function rjDebugSkills() {
  if (typeof G === "undefined" || !G.rivals) {
    console.log("[RJ Debug] Pas de rivaux disponibles");
    return;
  }
  console.log("=== Distribution des skills " + G.cat + " S" + G.saison + " ===");
  console.log("Plafond catégorie : " + (RJ_SKILL_CAPS[G.cat] || "?"));
  
  var sorted = G.rivals.slice().sort(function(a, b) { return b.skill - a.skill; });
  
  // Inclus le joueur si possible
  var playerSkill = G.stats ? Math.round(0.6 * G.stats.vitesse + 0.25 * G.stats.sangfroid + 0.15 * G.stats.adapt) : null;
  
  console.log("Position | Skill | Tier        | Pilote (équipe)");
  console.log("---------|-------|-------------|------------------");
  if (playerSkill) {
    console.log("Joueur   |  " + playerSkill + "  | (calculé)   | " + (G.pilot.prenom || "") + " " + (G.pilot.nom || "") + " (" + (G.currentTeam || "?") + ")");
  }
  sorted.forEach(function(r, i) {
    var tier = r._rjTier || "?";
    var origInfo = r._rjOriginalSkill ? " (orig: " + r._rjOriginalSkill + ")" : "";
    console.log("   " + String(i + 1).padStart(2) + "    |  " + String(r.skill).padStart(2) + "  | " + tier.padEnd(11) + " | " + r.name + " (" + (r.team || "?") + ")" + origInfo);
  });
}

function rjDebugCarPerf() {
  console.log("=== Impact voiture par catégorie ===");
  console.log("Catégorie         | Poids | Diff 95-65 (score) | Gap estimé sur course");
  console.log("------------------|-------|--------------------|-----------------------");
  Object.keys(RJ_CAR_PERF_WEIGHTS).forEach(function(cat) {
    var w = RJ_CAR_PERF_WEIGHTS[cat];
    // Calcule la diff de bonus pour deux ratings extrêmes 95 vs 65
    var bonus95 = 0.85 * 0.20 + 0.55 * 0.20 * 0.20; // r=0.20
    bonus95 *= w;
    var bonus65 = 0.85 * (-0.10) + 0.55 * (-0.10) * (-0.10) * (-1); // r=-0.10, signed
    bonus65 *= w;
    var diff = bonus95 - bonus65;
    var gapSec = (diff * 45).toFixed(1);
    console.log(cat.padEnd(18) + "|  " + w.toFixed(2) + " |        " + diff.toFixed(3) + "       |     " + gapSec + "s");
  });
}

function rjDebugReliability() {
  console.log("=== Multiplicateurs de fiabilité par rating voiture ===");
  console.log("Rating ≥ 90  : ×" + _rjGetTeamReliabilityMul(90) + " (top teams, ~3 DNF/saison)");
  console.log("Rating 80-89 : ×" + _rjGetTeamReliabilityMul(85) + " (midfield+)");
  console.log("Rating 70-79 : ×" + _rjGetTeamReliabilityMul(75) + " (midfield-)");
  console.log("Rating < 70  : ×" + _rjGetTeamReliabilityMul(65) + " (backmarkers, ~12-15 DNF/saison)");
  console.log("");
  if (typeof G !== "undefined" && G.cat && typeof getTeamRatings === "function") {
    var ratings = getTeamRatings();
    if (ratings) {
      console.log("=== État actuel " + G.cat + " S" + G.saison + " ===");
      Object.keys(ratings).slice().sort(function(a, b) { return ratings[b] - ratings[a]; }).forEach(function(team) {
        var r = ratings[team];
        var mul = _rjGetTeamReliabilityMul(r);
        console.log(team.padEnd(28) + " rating " + String(r).padStart(2) + " → mul ×" + mul.toFixed(2));
      });
    }
  }
}

if (typeof window !== "undefined") {
  window.rjDebugSkills = rjDebugSkills;
  window.rjDebugCarPerf = rjDebugCarPerf;
  window.rjDebugReliability = rjDebugReliability;
  // Expose aussi les helpers et données pour inspection
  window.RJ_SKILL_CAPS = RJ_SKILL_CAPS;
  window.RJ_CAR_PERF_WEIGHTS = RJ_CAR_PERF_WEIGHTS;
  window.RJ_TIER_DISTRIBUTION = RJ_TIER_DISTRIBUTION;
}
