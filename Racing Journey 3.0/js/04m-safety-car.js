/* =====================================================================
 * 04m-safety-car.js — SAFETY CAR / VSC / RED FLAG MÉCANIQUES
 *
 * Transforme les drapeaux qui n'existaient que comme événements narratifs
 * ponctuels en VRAIES MÉCANIQUES SYSTÉMIQUES qui changent l'issue des
 * courses : regroupement des écarts, pit stops gratuits, restarts tendus.
 *
 * 3 TYPES DE NEUTRALISATION :
 *
 *   🟡 VSC (Virtual Safety Car) : événement mineur
 *      • Durée 2-3 tours
 *      • Tous ralentissent uniformément (lapTime × 1.35)
 *      • Pit cost réduit à 65% (gain modéré)
 *      • Pas de regroupement
 *
 *   🟠 SAFETY CAR (SC) : accident significatif, débris
 *      • Durée 3-5 tours
 *      • Tous regroupés derrière le leader (écarts → 1-2 sec)
 *      • Pit cost réduit à 30% (énorme gain)
 *      • Restart au dernier tour : possibilité gros mouvements
 *
 *   🔴 RED FLAG (RF) : crash majeur
 *      • Durée 1 tour de neutralisation puis restart
 *      • Pit gratuit (changement pneus sans pénalité)
 *      • Tous regroupés à la position de neutralisation
 *      • Course raccourcie d'autant
 *
 * PROBABILITÉS PAR CATÉGORIE :
 *   Karting Junior/Senior : 0% (pas de SC en kart)
 *   F4, FR              : VSC 5% / SC 15% / RF 2%
 *   F3, F2              : VSC 10% / SC 20% / RF 4%
 *   F1                  : VSC 15% / SC 25% / RF 5%
 *   Endurance WEC       : VSC 25% / SC 40% / RF 8%
 *   IndyCar             : VSC 12% / SC 35% / RF 5%
 *   Super Formula       : VSC 8% / SC 18% / RF 3%
 *
 * INTÉGRATION :
 *   • Hook sur tickRace pour gérer les déclenchements/durations
 *   • Hook sur updateLivePositions pour le regroupement
 *   • Réutilise le modal live-event existant (showLiveEvent)
 *   • Ajoute un badge persistant dans live-race-header
 *   • Cohabite avec les wrappers existants (04j, 04k, 04l)
 *
 * Debug console :
 *   • rjSafetyCarDebug()              → état actuel
 *   • rjForceSC()                     → force un SC (test)
 *   • rjForceVSC()                    → force un VSC (test)
 *   • rjForceRedFlag()                → force un drapeau rouge (test)
 *   • _rjVerbose = true               → log les triggers
 * ===================================================================== */

(function rjSafetyCarSystem() {
  if (typeof window === "undefined") return;
  if (window._rjSafetyCarInstalled) return;
  window._rjSafetyCarInstalled = true;

  /* ====================================================================
   * 1. CONFIGURATION
   * ================================================================= */

  // Probabilités par catégorie (chance de déclenchement par tour, puis
  // diviseur appliqué pour étaler sur la course)
  var SC_PROBS = {
    "Karting Junior":   { vsc: 0.00, sc: 0.00, rf: 0.00 },
    "Karting Senior":   { vsc: 0.00, sc: 0.00, rf: 0.00 },
    "Formule 4":        { vsc: 0.05, sc: 0.15, rf: 0.02 },
    "Formula Regional": { vsc: 0.05, sc: 0.15, rf: 0.02 },
    "Formule 3":        { vsc: 0.12, sc: 0.22, rf: 0.04 },
    "Formule 2":        { vsc: 0.10, sc: 0.20, rf: 0.04 },
    "Formule 1":        { vsc: 0.18, sc: 0.30, rf: 0.05 },
    "Super Formula":    { vsc: 0.08, sc: 0.18, rf: 0.03 },
    "Endurance WEC":    { vsc: 0.25, sc: 0.40, rf: 0.08 },
    "IndyCar":          { vsc: 0.10, sc: 0.42, rf: 0.06 }
  };

  // Durées en tours (min, max) par type
  var DURATIONS = {
    vsc: [2, 3],
    sc:  [3, 5],
    rf:  [1, 1]  // 1 tour de neutralisation, puis restart
  };

  // Multiplicateur lapTime pendant la neutralisation
  var LAPTIME_MULT = {
    vsc: 1.35,
    sc:  1.50,
    rf:  1.00  // pas de tours roulés (course suspendue)
  };

  // Coût de pit pendant la neutralisation (vs normal = 1.0)
  var PIT_COST_MULT = {
    vsc: 0.65,
    sc:  0.30,
    rf:  0.00
  };

  // Cooldown après une neutralisation (pas de nouvelle pendant N tours)
  var COOLDOWN_LAPS = 8;

  // Plages où une neutralisation peut être déclenchée
  var MIN_LAP_TRIGGER = 3;       // pas avant le tour 3
  var END_LAP_RATIO   = 0.92;    // pas dans les 8% derniers tours

  /* ====================================================================
   * 2. DÉTECTION ET DÉCLENCHEMENT
   * ================================================================= */

  function _rjGetCatProbs() {
    if (typeof G === "undefined" || !G || !G.cat) return null;
    var base = SC_PROBS[G.cat] || null;
    if (!base) return null;
    // Affinage par propriétés circuit
    var cd = (typeof RACE_STATE !== "undefined" && RACE_STATE && RACE_STATE.circuitData) || {};
    var sc = base.sc, vsc = base.vsc, rf = base.rf;
    // streetWalls élève le SC
    var swMult = 1 + (((cd.streetWalls || 3) - 4) * 0.04);
    // bumpsFactor
    var buMult = 1 + (((cd.bumpsFactor || 4) - 5) * 0.02);
    // Valeur safety du circuit CIRCUIT_DATA (0.10-0.55)
    var circSC = cd.safety;
    if (circSC != null) {
      sc  = Math.min(0.70, sc * 0.4 + circSC * 0.6);
      vsc = Math.min(0.40, vsc * 0.4 + (circSC * 0.5) * 0.6);
    }
    return { sc: Math.min(0.70, sc * swMult * buMult),
             vsc: Math.min(0.40, vsc * swMult),
             rf: rf };
  }

  function _rjCanTrigger() {
    if (!LIVE_RACE || !LIVE_RACE.drivers || LIVE_RACE.drivers.length === 0) return false;
    if (LIVE_RACE.finished) return false;
    if (LIVE_RACE.cur < MIN_LAP_TRIGGER) return false;
    if (LIVE_RACE.cur >= Math.floor(LIVE_RACE.total * END_LAP_RATIO)) return false;
    
    // Cooldown après une neutralisation précédente
    if (LIVE_RACE._rjLastNeutralEndLap !== undefined &&
        (LIVE_RACE.cur - LIVE_RACE._rjLastNeutralEndLap) < COOLDOWN_LAPS) {
      return false;
    }
    
    // Pas de double neutralisation
    if (LIVE_RACE._rjNeutral && LIVE_RACE._rjNeutral.active) return false;
    
    return true;
  }

  function _rjMaybeTrigger() {
    if (!_rjCanTrigger()) return false;
    var probs = _rjGetCatProbs();
    if (!probs) return false;
    
    // Boost de probabilité si un rival haut placé vient de DNF
    var dnfBoost = 1.0;
    if (LIVE_RACE._rjLastDnfLap !== undefined && 
        (LIVE_RACE.cur - LIVE_RACE._rjLastDnfLap) <= 2 &&
        LIVE_RACE._rjLastDnfPos !== undefined && LIVE_RACE._rjLastDnfPos <= 8) {
      dnfBoost = 1.5;
    }
    
    // Boost si pluie commence
    if (typeof RACE_STATE !== "undefined" && RACE_STATE && RACE_STATE.weather && 
        RACE_STATE.weather.id !== "dry") {
      dnfBoost *= 1.2;
    }
    
    // On répartit la probabilité de course sur les tours éligibles
    var totalEligibleLaps = Math.max(1, Math.floor(LIVE_RACE.total * END_LAP_RATIO) - MIN_LAP_TRIGGER);
    var perLapVsc = (probs.vsc * dnfBoost) / totalEligibleLaps;
    var perLapSc  = (probs.sc  * dnfBoost) / totalEligibleLaps;
    var perLapRf  = (probs.rf  * dnfBoost) / totalEligibleLaps;
    
    var roll = Math.random();
    if (roll < perLapRf) {
      _rjStartNeutralization("rf");
      return true;
    }
    if (roll < perLapRf + perLapSc) {
      _rjStartNeutralization("sc");
      return true;
    }
    if (roll < perLapRf + perLapSc + perLapVsc) {
      _rjStartNeutralization("vsc");
      return true;
    }
    return false;
  }

  function _rjStartNeutralization(type) {
    if (!LIVE_RACE) return;
    var dur = DURATIONS[type];
    var duration = dur[0] + Math.floor(Math.random() * (dur[1] - dur[0] + 1));
    
    var cause = _rjGenerateCause(type);
    
    LIVE_RACE._rjNeutral = {
      active: true,
      type: type,
      startLap: LIVE_RACE.cur,
      endLap: LIVE_RACE.cur + duration,
      duration: duration,
      cause: cause,
      regrouped: false,
      restartTriggered: false
    };
    
    if (window._rjVerbose) {
      console.log("[RJ SC] Trigger " + type.toUpperCase() + " tour " + LIVE_RACE.cur + 
                  " durée " + duration + " — cause: " + cause);
    }
    
    // Pause la course et affiche l'événement
    _rjShowNeutralizationEvent(type, cause, duration);
  }

  function _rjGenerateCause(type) {
    var causes = {
      vsc: [
        "Voiture immobilisée hors-piste",
        "Débris en piste secteur 2",
        "Sortie de piste sans dégâts",
        "Pilote ralenti sur la trajectoire"
      ],
      sc: [
        "Accident en virage 4 — débris partout",
        "Voiture immobilisée en pleine ligne droite",
        "Sortie violente — barrière endommagée",
        "Crash dans le peloton — voiture en travers de la piste",
        "Panne moteur en plein virage rapide"
      ],
      rf: [
        "Accident majeur — barrière à reconstruire",
        "Crash multi-pilotes — piste impraticable",
        "Voiture détruite en plein virage rapide",
        "Conditions de piste dangereuses — interruption nécessaire"
      ]
    };
    var pool = causes[type] || ["Incident"];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /* ====================================================================
   * 3. AFFICHAGE DE L'ÉVÉNEMENT (MODAL)
   * ================================================================= */

  function _rjShowNeutralizationEvent(type, cause, duration) {
    if (!LIVE_RACE) return;
    
    var icons = { vsc: "yellow", sc: "yellow", rf: "redflag" };
    var titles = {
      vsc: "Virtual Safety Car",
      sc:  "Safety Car déployée",
      rf:  "DRAPEAU ROUGE"
    };
    var descIntros = {
      vsc: "VSC en piste. Tous les pilotes doivent ralentir uniformément.",
      sc:  "Safety Car en piste. Le peloton va se regrouper.",
      rf:  "Course suspendue. Tous les pilotes regagnent les stands."
    };
    
    var player = LIVE_RACE.drivers.find(function(d) { return d.isPlayer; });
    var isPlayerInRace = player && !player.dnf;
    
    if (!isPlayerInRace) {
      // Joueur DNF — pas de modal, juste applique la neutralisation
      _rjApplyNeutralizationStart(type);
      return;
    }
    
    var event = {
      icon: icons[type],
      title: titles[type],
      desc: cause + ". " + descIntros[type] + " Durée prévue : " + duration + " tour" + (duration > 1 ? "s" : "") + ".",
      _rjNeutralEvent: true,
      _rjNeutralType: type
    };
    
    // Choix proposés selon le type
    if (type === "rf") {
      // Drapeau rouge : pit gratuit forcé
      event.choices = [
        {
          text: "Repartir avec pneus neufs (gratuit)",
          mod: 0,
          _rjAction: "pit_fresh",
          _rjFlavor: "Tu profites du drapeau rouge pour changer de pneus sans perte de temps."
        },
        {
          text: "Garder mes pneus actuels",
          mod: 0,
          _rjAction: "keep_tyres",
          _rjFlavor: "Tu choisis de conserver tes pneus pour ne pas perdre la fenêtre stratégique."
        }
      ];
    } else {
      // VSC ou SC : choix de pit
      var costPct = Math.round((1 - PIT_COST_MULT[type]) * 100);
      event.choices = [
        {
          text: "Pit stop maintenant (" + costPct + "% gain)",
          mod: 0,
          _rjAction: "pit_now",
          _rjFlavor: "Tu profites de la neutralisation pour pit avec une perte de temps réduite."
        },
        {
          text: "Rester en piste",
          mod: 0,
          _rjAction: "stay_out",
          _rjFlavor: "Tu choisis de rester en piste et de ne pas perdre ta position."
        }
      ];
    }
    
    LIVE_RACE.pendingEvent = event;
    LIVE_RACE.paused = true;
    
    if (typeof renderLiveLeaderboard === "function") {
      try { renderLiveLeaderboard(); } catch(e) {}
    }
    if (typeof renderLiveNewsFeed === "function") {
      try { renderLiveNewsFeed(); } catch(e) {}
    }
    if (typeof showLiveEvent === "function") {
      try { showLiveEvent(event); } catch(e) {}
    }
    
    // Applique le démarrage de la neutralisation après la modal (avant que joueur clique)
    _rjApplyNeutralizationStart(type);
  }

  /* ====================================================================
   * 4. APPLICATION DES EFFETS
   * ================================================================= */

  function _rjApplyNeutralizationStart(type) {
    if (!LIVE_RACE || !LIVE_RACE._rjNeutral) return;
    
    // Pour SC et RF : regrouper les écarts
    if ((type === "sc" || type === "rf") && !LIVE_RACE._rjNeutral.regrouped) {
      _rjRegroupField(type);
      LIVE_RACE._rjNeutral.regrouped = true;
    }
    
    // Pousser un message radio team (utilise le système existant)
    var radioMsg = {
      vsc: "VSC en piste. Maintiens ton delta time.",
      sc:  "Safety Car déployée. Reste calme, on va se regrouper.",
      rf:  "Drapeau rouge ! Course interrompue, tu rentres aux stands."
    };
    if (typeof pushRadioMsg === "function") {
      try {
        pushRadioMsg({
          icon: "phone",
          author: G.currentTeam || "Équipe",
          body: radioMsg[type] || ""
        });
      } catch(e) {}
    }
  }

  function _rjRegroupField(type) {
    if (!LIVE_RACE || !LIVE_RACE.drivers) return;
    
    // Stratégie : on prend l'ordre actuel par totalTime, puis on ramène
    // tous les écarts à 1-2 secondes du leader. Le totalTime est ajusté
    // pour préserver l'ordre mais réduire les gaps.
    var alive = LIVE_RACE.drivers.filter(function(d) { return !d.dnf; });
    if (alive.length === 0) return;
    
    // Tri par totalTime (= classement actuel)
    alive.sort(function(a, b) { 
      return ((a.totalTime || 0) + (a.penaltySec || 0)) - ((b.totalTime || 0) + (b.penaltySec || 0)); 
    });
    
    var leaderTime = (alive[0].totalTime || 0) + (alive[0].penaltySec || 0);
    
    // Régroupage : chaque pilote est à 1.2s du précédent (= peloton serré)
    var GAP_BETWEEN = type === "rf" ? 0.5 : 1.2;
    
    alive.forEach(function(d, i) {
      var newTotalTime = leaderTime + i * GAP_BETWEEN;
      // On ajuste le totalTime du driver
      d.totalTime = newTotalTime - (d.penaltySec || 0);
      d.gap = i * GAP_BETWEEN;
      d.pos = i + 1;  // l'ordre est figé pendant la neutralisation
    });
    
    if (window._rjVerbose) {
      console.log("[RJ SC] Field regrouped — gap=" + GAP_BETWEEN + "s entre pilotes");
    }
  }

  function _rjApplyNeutralizationLap() {
    // Appelé à chaque tour pendant la neutralisation
    if (!LIVE_RACE || !LIVE_RACE._rjNeutral || !LIVE_RACE._rjNeutral.active) return;
    
    var n = LIVE_RACE._rjNeutral;
    
    // Si on a passé le dernier tour de neutralisation, on déclenche le restart
    if (LIVE_RACE.cur >= n.endLap && !n.restartTriggered) {
      n.restartTriggered = true;
      _rjEndNeutralization();
      return;
    }
    
    // Pendant la neutralisation, on ralentit tout le monde uniformément
    var mult = LAPTIME_MULT[n.type];
    if (mult > 1.0) {
      LIVE_RACE.drivers.forEach(function(d) {
        if (d.dnf) return;
        if (d.lastLap) {
          // Le tour vient d'être ajouté à totalTime, on ajoute le supplément
          // pour refléter le ralentissement
          var supplement = d.lastLap * (mult - 1.0);
          d.totalTime = (d.totalTime || 0) + supplement;
        }
      });
    }
    
    // Préserver l'ordre regroupé tant qu'on est en SC/RF
    if (n.type === "sc" || n.type === "rf") {
      _rjRegroupField(n.type);
    }
  }

  function _rjEndNeutralization() {
    if (!LIVE_RACE || !LIVE_RACE._rjNeutral) return;
    var n = LIVE_RACE._rjNeutral;
    
    n.active = false;
    LIVE_RACE._rjLastNeutralEndLap = LIVE_RACE.cur;
    
    if (window._rjVerbose) {
      console.log("[RJ SC] Neutralisation " + n.type.toUpperCase() + " terminée tour " + LIVE_RACE.cur);
    }
    
    // Message radio de restart
    var restartMsg = {
      vsc: "VSC terminée — tu peux relancer.",
      sc:  "Safety Car rentre — restart au prochain tour, sois prêt !",
      rf:  "Course relancée — tu repars à ta position."
    };
    if (typeof pushRadioMsg === "function") {
      try {
        pushRadioMsg({
          icon: "phone",
          author: G.currentTeam || "Équipe",
          body: restartMsg[n.type] || ""
        });
      } catch(e) {}
    }
    
    // Pour SC : ajouter de la variance sur 1-2 tours après restart (chaos)
    if (n.type === "sc") {
      LIVE_RACE._rjPostSCChaosLap = LIVE_RACE.cur;
    }
  }

  /* ====================================================================
   * 5. WRAPPER updateLivePositions
   *
   * Pendant SC/RF : préserve l'ordre regroupé (pas de tri par score).
   * En VSC ou hors neutralisation : laisse passer au wrapper suivant (04k).
   * ================================================================= */

  function _rjInstallUpdateLivePositionsWrapper() {
    if (typeof window.updateLivePositions !== "function") return false;
    if (window._rjSCPositionWrapperInstalled) return true;
    window._rjSCPositionWrapperInstalled = true;
    
    var legacyUpdate = window.updateLivePositions;
    window.updateLivePositions = function rjSCWrapped() {
      // Si neutralisation SC ou RF active → préserver l'ordre regroupé
      if (LIVE_RACE && LIVE_RACE._rjNeutral && LIVE_RACE._rjNeutral.active) {
        var type = LIVE_RACE._rjNeutral.type;
        if (type === "sc" || type === "rf") {
          // L'ordre est déjà fixé par _rjRegroupField, on ne fait rien
          return;
        }
        // Pour VSC, on laisse le wrapper suivant gérer (les écarts persistent)
      }
      return legacyUpdate.apply(this, arguments);
    };
    return true;
  }

  /* ====================================================================
   * 6. WRAPPER tickRace
   *
   * Hook pour :
   * - À chaque tour, tenter un déclenchement de neutralisation
   * - Pendant une neutralisation, appliquer les effets
   * - Détecter les DNF récents (boost probabilité)
   * ================================================================= */

  function _rjInstallTickRaceWrapper() {
    if (typeof window.tickRace !== "function") return false;
    if (window._rjSCTickWrapperInstalled) return true;
    window._rjSCTickWrapperInstalled = true;
    
    var legacyTick = window.tickRace;
    window.tickRace = function rjSCTickWrapped() {
      // Avant le tick : track les DNF déjà présents
      var dnfBefore = [];
      if (LIVE_RACE && LIVE_RACE.drivers) {
        LIVE_RACE.drivers.forEach(function(d) {
          if (d.dnf) dnfBefore.push(d.name);
        });
      }
      
      // Exécute le tick normal
      var result = legacyTick.apply(this, arguments);
      
      // Après le tick : check les nouveaux DNF
      if (LIVE_RACE && LIVE_RACE.drivers && !LIVE_RACE.finished) {
        LIVE_RACE.drivers.forEach(function(d) {
          if (d.dnf && dnfBefore.indexOf(d.name) === -1) {
            // Nouveau DNF
            LIVE_RACE._rjLastDnfLap = LIVE_RACE.cur;
            LIVE_RACE._rjLastDnfPos = d.pos || 99;
          }
        });
        
        // Appliquer les effets de la neutralisation en cours
        if (LIVE_RACE._rjNeutral && LIVE_RACE._rjNeutral.active) {
          _rjApplyNeutralizationLap();
        } else if (!LIVE_RACE.paused) {
          // Tenter un déclenchement
          _rjMaybeTrigger();
        }
      }
      
      // Mettre à jour le badge persistant
      _rjUpdateBadge();
      
      return result;
    };
    return true;
  }

  /* ====================================================================
   * 7. BADGE PERSISTANT (dans live-race-header)
   * ================================================================= */

  function _rjUpdateBadge() {
    if (typeof document === "undefined") return;
    var header = document.getElementById("live-race-header");
    if (!header) return;
    
    var existing = document.getElementById("rj-sc-badge");
    
    var active = LIVE_RACE && LIVE_RACE._rjNeutral && LIVE_RACE._rjNeutral.active;
    
    if (!active) {
      if (existing) existing.remove();
      return;
    }
    
    var n = LIVE_RACE._rjNeutral;
    var labels = {
      vsc: { txt: "VSC", color: "#F59E0B", bg: "rgba(245,158,11,0.18)" },
      sc:  { txt: "SC",  color: "#F59E0B", bg: "rgba(245,158,11,0.22)" },
      rf:  { txt: "🔴 RED FLAG", color: "#EF4444", bg: "rgba(239,68,68,0.20)" }
    };
    var lbl = labels[n.type];
    var lapsLeft = Math.max(0, n.endLap - LIVE_RACE.cur);
    
    var html = '<span style="font-family:var(--font-display);font-size:11px;font-weight:800;letter-spacing:0.08em;color:' + lbl.color + ';background:' + lbl.bg + ';padding:3px 8px;border-radius:6px;border:1px solid ' + lbl.color + ';white-space:nowrap">' + 
               lbl.txt + ' · ' + lapsLeft + 'T' +
               '</span>';
    
    if (existing) {
      existing.innerHTML = html;
    } else {
      var badge = document.createElement("div");
      badge.id = "rj-sc-badge";
      badge.style.cssText = "padding:6px 16px 0;display:flex;justify-content:flex-end";
      badge.innerHTML = html;
      header.parentNode.insertBefore(badge, header.nextSibling);
    }
  }

  /* ====================================================================
   * 8. WRAPPER resolveLiveEvent
   *
   * Pour appliquer les choix du joueur lors d'une neutralisation
   * (pit stop maintenant ou rester en piste, etc.)
   * ================================================================= */

  function _rjInstallResolveEventWrapper() {
    if (typeof window.resolveLiveEvent !== "function") return false;
    if (window._rjSCResolveWrapperInstalled) return true;
    window._rjSCResolveWrapperInstalled = true;
    
    var legacyResolve = window.resolveLiveEvent;
    window.resolveLiveEvent = function rjSCResolveWrapped(choiceIdx) {
      // Si l'événement en cours est une neutralisation, intercepte avant de passer
      if (LIVE_RACE && LIVE_RACE.pendingEvent && LIVE_RACE.pendingEvent._rjNeutralEvent) {
        var event = LIVE_RACE.pendingEvent;
        var choice = event.choices && event.choices[choiceIdx];
        if (choice && choice._rjAction) {
          _rjApplyPlayerChoice(choice._rjAction, event._rjNeutralType);
        }
      }
      return legacyResolve.apply(this, arguments);
    };
    return true;
  }

  function _rjApplyPlayerChoice(action, type) {
    if (!LIVE_RACE) return;
    var player = LIVE_RACE.drivers.find(function(d) { return d.isPlayer; });
    if (!player || player.dnf) return;
    
    if (action === "pit_now" || action === "pit_fresh") {
      // Pit stop avec coût réduit
      var pitCostMult = PIT_COST_MULT[type];
      var basePitLoss = 22;  // perte de temps F1 standard ~22s
      var actualLoss = basePitLoss * pitCostMult;
      
      player.totalTime = (player.totalTime || 0) + actualLoss;
      player._lastPitLap = LIVE_RACE.cur;
      
      // Appel au système de pneus existant si disponible
      if (typeof _refreshTyreOnPit === "function") {
        try { _refreshTyreOnPit(player); } catch(e) {}
      }
      
      if (window._rjVerbose) {
        console.log("[RJ SC] Joueur a pit pendant " + type + " — perte " + actualLoss.toFixed(1) + "s (vs " + basePitLoss + "s normal)");
      }
    }
    // "stay_out" et "keep_tyres" : pas d'action, juste flavor
  }

  /* ====================================================================
   * 9. AUTO-INSTALLATION
   * ================================================================= */
  
  var attempts = 0, maxAttempts = 80;
  
  function _rjTryInstall() {
    attempts++;
    var ulpOK = _rjInstallUpdateLivePositionsWrapper();
    var trOK = _rjInstallTickRaceWrapper();
    var rleOK = _rjInstallResolveEventWrapper();
    
    if (ulpOK && trOK && rleOK) {
      console.log("[RJ SC] Module Safety Car/VSC/Red Flag chargé — neutralisations mécaniques actives");
      return;
    }
    
    if (attempts >= maxAttempts) {
      var missing = [];
      if (!ulpOK) missing.push("updateLivePositions");
      if (!trOK) missing.push("tickRace");
      if (!rleOK) missing.push("resolveLiveEvent");
      console.warn("[RJ SC] Wrappers non posés (fonctions cibles absentes) : " + missing.join(", "));
      return;
    }
    
    if (typeof setTimeout !== "undefined") setTimeout(_rjTryInstall, 100);
  }
  
  _rjTryInstall();

  /* ====================================================================
   * 10. DEBUG / OUTILS DE TEST
   * ================================================================= */
  
  window.rjSafetyCarDebug = function() {
    console.log("=== Safety Car System ===");
    console.log("Catégorie :", typeof G !== "undefined" && G ? G.cat : "?");
    if (typeof G !== "undefined" && G && G.cat) {
      var p = SC_PROBS[G.cat];
      if (p) {
        console.log("Probabilités/course : VSC " + (p.vsc*100).toFixed(0) + "% · SC " + (p.sc*100).toFixed(0) + "% · RF " + (p.rf*100).toFixed(0) + "%");
      }
    }
    
    if (typeof LIVE_RACE !== "undefined" && LIVE_RACE) {
      console.log("");
      console.log("Course en cours :");
      console.log("  Tour :", LIVE_RACE.cur + "/" + LIVE_RACE.total);
      if (LIVE_RACE._rjNeutral) {
        var n = LIVE_RACE._rjNeutral;
        console.log("  Neutralisation :", n.type.toUpperCase(), n.active ? "ACTIVE" : "terminée");
        console.log("    Cause :", n.cause);
        console.log("    Tour début :", n.startLap, "fin :", n.endLap);
        console.log("    Regroupement :", n.regrouped);
      } else {
        console.log("  Pas de neutralisation");
      }
      if (LIVE_RACE._rjLastNeutralEndLap !== undefined) {
        console.log("  Dernière neutralisation finie tour :", LIVE_RACE._rjLastNeutralEndLap);
      }
    }
    
    console.log("");
    console.log("Wrappers installés :");
    console.log("  updateLivePositions :", window._rjSCPositionWrapperInstalled ? "✓" : "⚠");
    console.log("  tickRace :", window._rjSCTickWrapperInstalled ? "✓" : "⚠");
    console.log("  resolveLiveEvent :", window._rjSCResolveWrapperInstalled ? "✓" : "⚠");
  };

  window.rjForceSC = function() {
    if (!LIVE_RACE || !LIVE_RACE.drivers) {
      console.log("Pas de course en cours");
      return;
    }
    if (LIVE_RACE._rjNeutral && LIVE_RACE._rjNeutral.active) {
      console.log("Neutralisation déjà active");
      return;
    }
    _rjStartNeutralization("sc");
  };

  window.rjForceVSC = function() {
    if (!LIVE_RACE || !LIVE_RACE.drivers) {
      console.log("Pas de course en cours");
      return;
    }
    if (LIVE_RACE._rjNeutral && LIVE_RACE._rjNeutral.active) {
      console.log("Neutralisation déjà active");
      return;
    }
    _rjStartNeutralization("vsc");
  };

  window.rjForceRedFlag = function() {
    if (!LIVE_RACE || !LIVE_RACE.drivers) {
      console.log("Pas de course en cours");
      return;
    }
    if (LIVE_RACE._rjNeutral && LIVE_RACE._rjNeutral.active) {
      console.log("Neutralisation déjà active");
      return;
    }
    _rjStartNeutralization("rf");
  };

})();
