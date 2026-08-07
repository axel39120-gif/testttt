/* =====================================================================
 * 04j-corrections.js — CORRECTIONS ET CALIBRAGES DU MOTEUR
 *
 * Regroupe quatre modules de correction écrits au fil du temps sur le
 * moteur de course : filet de sécurité en fin de course, corrections de
 * bugs, ajustements d'expérience, rééquilibrage de la note du pilote.
 *
 * Ils n'ont pas de sujet commun autre que d'être des correctifs — c'est
 * précisément pourquoi ils étaient dispersés. L'ordre de chargement
 * d'origine est conservé.
 * =================================================================== */

/* ==================================================================== *
 * Filet de sécurité en fin de course
 * (anciennement 04j-race-finalization-fix.js)
 * ==================================================================== */

(function rjInstallFinalizeLiveRaceFix() {
  if (typeof window === "undefined") return;
  if (window._rjFinalizeRaceFixInstalled) return;
  
  function tryInstall() {
    if (typeof window.finalizeLiveRace !== "function") {
      if (typeof setTimeout !== "undefined") setTimeout(tryInstall, 50);
      return;
    }
    
    if (window._rjFinalizeRaceFixInstalled) return;
    window._rjFinalizeRaceFixInstalled = true;
    
    var origFinalize = window.finalizeLiveRace;
    
    window.finalizeLiveRace = function rjGuardedFinalize() {
      var startedAt = Date.now();
      var caughtError = null;
      
      try {
        return origFinalize.apply(this, arguments);
      } catch(e) {
        caughtError = e;
        console.error("[RJ] finalizeLiveRace a planté :", e && e.message, e && e.stack);
      } finally {
        // Annule le watchdog si actif (on est arrivé au finalize)
        if (window._rjRaceWatchdogId) {
          clearTimeout(window._rjRaceWatchdogId);
          window._rjRaceWatchdogId = null;
        }
        
        // Marque LIVE_RACE comme fini
        try {
          if (typeof LIVE_RACE !== "undefined" && LIVE_RACE) {
            LIVE_RACE.finished = true;
            LIVE_RACE.paused = false;
          }
        } catch(_e) {}
        
        // Si exception, garantit que showResult sera appelé
        // pour que le bouton soit réactivé
        if (caughtError) {
          try {
            if (typeof window.showResult === "function") {
              // Pose une position de fallback si elle n'a pas été calculée
              if (typeof window.LIVE_RACE_FINAL_POS !== "number" || !window.LIVE_RACE_FINAL_POS) {
                var pp = LIVE_RACE && LIVE_RACE.drivers && LIVE_RACE.drivers.find(function(d){return d.isPlayer;});
                window.LIVE_RACE_FINAL_POS = pp ? (pp.dnf ? LIVE_RACE.drivers.length : (pp.pos || 99)) : 1;
              }
              window.showResult();
            } else {
              // Pas de showResult dispo, force réactivation directe du bouton
              _rjForceReactivateRaceButton("finalizeLiveRace planté + showResult absent");
            }
          } catch(e2) {
            console.error("[RJ] showResult a aussi planté :", e2 && e2.message);
            _rjForceReactivateRaceButton("finalizeLiveRace + showResult plantés");
          }
        }
      }
    };
  }
  
  tryInstall();
})();

/* ========================================================================
 * COUCHE 2 — Wrap showResult
 * ===================================================================== */

(function rjInstallShowResultFix() {
  if (typeof window === "undefined") return;
  if (window._rjShowResultFixInstalled) return;
  
  function tryInstall() {
    if (typeof window.showResult !== "function") {
      if (typeof setTimeout !== "undefined") setTimeout(tryInstall, 50);
      return;
    }
    
    if (window._rjShowResultFixInstalled) return;
    window._rjShowResultFixInstalled = true;
    
    var origShowResult = window.showResult;
    
    window.showResult = function rjGuardedShowResult() {
      try {
        return origShowResult.apply(this, arguments);
      } catch(e) {
        console.error("[RJ] showResult a planté :", e && e.message, e && e.stack);
        
        // Tente quand même de basculer vers l'écran résultat
        try {
          if (typeof window.rtab === "function") {
            window.rtab("res", true);
          }
        } catch(_e) {}
        
        // Force la réactivation du bouton
        _rjForceReactivateRaceButton("showResult planté");
        
        // Tente de marquer la course comme courue (pour que markRaceDone
        // n'échoue pas la prochaine fois)
        try {
          if (G && G.races && Array.isArray(G.races)) {
            var fallbackPos = window.LIVE_RACE_FINAL_POS || 99;
            G.races.push({
              nom: "Course (erreur de finalisation)",
              pos: fallbackPos,
              pts: 0,
              detail: "Une erreur s'est produite à la fin de la course.",
              saison: G.saison,
              cat: G.cat,
              _hadError: true
            });
          }
        } catch(_e) {}
        
        return null;
      }
    };
  }
  
  tryInstall();
})();

/* ========================================================================
 * COUCHE 3 — Watchdog sur runRaceLive
 * ===================================================================== */

(function rjInstallRaceWatchdog() {
  if (typeof window === "undefined") return;
  if (window._rjRaceWatchdogInstalled) return;
  
  function tryInstall() {
    if (typeof window.runRaceLive !== "function") {
      if (typeof setTimeout !== "undefined") setTimeout(tryInstall, 50);
      return;
    }
    
    if (window._rjRaceWatchdogInstalled) return;
    window._rjRaceWatchdogInstalled = true;
    
    var origRun = window.runRaceLive;
    
    window.runRaceLive = function rjWatchdogRunRaceLive() {
      // Annule un watchdog précédent si existant (course relancée)
      if (window._rjRaceWatchdogId) {
        clearTimeout(window._rjRaceWatchdogId);
        window._rjRaceWatchdogId = null;
      }
      
      var result = origRun.apply(this, arguments);
      
      // Calcule le temps maximum attendu de la course
      // tickRace tourne avec un setTimeout de t ms entre chaque tour.
      // On prend une marge généreuse : 2.5× le temps prévu + 30 secondes.
      // Pour une course de 50 tours à 400ms/tour = 20s, le watchdog
      // se déclenchera après ~80 secondes max.
      try {
        var totalLaps = (typeof LIVE_RACE !== "undefined" && LIVE_RACE && LIVE_RACE.total) ? 
                        LIVE_RACE.total : (G && G.totalLaps ? G.totalLaps : 50);
        // tickInterval moyen ~400-500ms en fonction de la catégorie
        var estimatedTickMs = 500;
        var maxRaceMs = totalLaps * estimatedTickMs * 2.5 + 30000;
        // Plafond raisonnable : 10 minutes max
        maxRaceMs = Math.min(maxRaceMs, 10 * 60 * 1000);
        
        window._rjRaceWatchdogId = setTimeout(function rjRaceWatchdogTrigger() {
          window._rjRaceWatchdogId = null;
          
          // Si la course est déjà finalisée proprement, on ne fait rien
          if (typeof LIVE_RACE === "undefined" || !LIVE_RACE) return;
          if (LIVE_RACE.finished) return;
          
          // Vérif état du bouton — s'il a été réactivé manuellement, on laisse
          var btn = (typeof document !== "undefined") ? document.getElementById("race-btn") : null;
          if (!btn || !btn.disabled) return;
          
          // À ce stade : course pas finalisée + bouton encore désactivé = anomalie
          console.warn("[RJ] WATCHDOG : course bloquée après " + Math.round(maxRaceMs/1000) + "s, force la finalisation");
          
          // Stoppe le tickRace s'il tourne encore
          try {
            if (LIVE_RACE.interval) {
              clearInterval(LIVE_RACE.interval);
              LIVE_RACE.interval = null;
            }
          } catch(_e) {}
          
          LIVE_RACE.finished = true;
          LIVE_RACE.paused = false;
          
          // Tente d'appeler finalizeLiveRace une dernière fois
          // (les couches 1 et 2 garantissent que ça réactive le bouton)
          try {
            if (typeof window.finalizeLiveRace === "function") {
              window.finalizeLiveRace();
            } else {
              _rjForceReactivateRaceButton("watchdog + finalizeLiveRace absent");
            }
          } catch(e) {
            console.error("[RJ] Watchdog : finalizeLiveRace a planté :", e && e.message);
            _rjForceReactivateRaceButton("watchdog + finalizeLiveRace planté");
          }
        }, maxRaceMs);
      } catch(e) {
        console.warn("[RJ] Erreur installation watchdog :", e && e.message);
      }
      
      return result;
    };
  }
  
  tryInstall();
  
  console.log("[RJ] Module Race Finalization Fix chargé — bouton race-btn protégé contre blocages");
})();

/* ========================================================================
 * BONUS : Wrapper protecteur sur le rendu live pendant la course
 * 
 * Si renderLiveLeaderboard plante au dernier tour (à cause d'un module
 * Phase 1-6 ou Graphics), ça empêcherait le clearInterval+finalize qui
 * suit dans tickRace. On rend ce render plus défensif : si une exception
 * remonte, on l'avale (le tickRace legacy a déjà un try/catch global mais
 * on est ceinture+bretelles).
 * ===================================================================== */

(function rjMakeRenderDefensive() {
  if (typeof window === "undefined") return;
  if (window._rjRenderDefensiveInstalled) return;
  
  function tryInstall() {
    if (typeof window.renderLiveLeaderboard !== "function") {
      if (typeof setTimeout !== "undefined") setTimeout(tryInstall, 50);
      return;
    }
    
    if (window._rjRenderDefensiveInstalled) return;
    window._rjRenderDefensiveInstalled = true;
    
    var origRender = window.renderLiveLeaderboard;
    
    /* Le garde défensif du classement (avaler une erreur d'affichage pour
       ne pas interrompre la course) est désormais assuré une seule fois
       par le module 89, qui l'accompagne d'un message en console. */
  }
  
  // S'installe APRÈS les autres wrappers (Graphics, etc.) pour être l'enveloppe extérieure
  // Délai pour laisser les autres modules s'installer en premier
  setTimeout(tryInstall, 200);
})();


/* ==================================================================== *
 * Corrections de bugs du moteur
 * (anciennement 04l-engine-fixes.js)
 * ==================================================================== */

(function rjEngineFixes() {
  if (typeof window === "undefined") return;
  if (window._rjEngineFixesInstalled) return;
  window._rjEngineFixesInstalled = true;

  /* ====================================================================
   * FIX #1 — newCatIdx undefined dans startNextSeason
   * ================================================================= */
  
  function _rjFixNewCatIdx() {
    if (typeof window.startNextSeason !== "function") return false;
    if (window._rjFix1Installed) return true;
    window._rjFix1Installed = true;
    
    var origStartNextSeason = window.startNextSeason;
    window.startNextSeason = function rjFix1WrappedStartNextSeason() {
      // Pose newCatIdx en variable globale AVANT que la fonction soit
      // exécutée. Le legacy l'utilise sans la déclarer (cf. ligne ~1655) :
      //   1===newCatIdx?(G.cat="Karting Junior"...)
      // Sans cette correction, newCatIdx est undefined et la branche
      // "rétrograder en Karting Junior" ne se déclenche jamais.
      try {
        if (typeof CATEGORIES !== "undefined" && CATEGORIES && typeof G !== "undefined" && G) {
          // Idée legacy : si la cat actuelle est juste au-dessus de Karting Junior
          // (idx=1 = Karting Senior), on rétrograde au lieu de saison blanche.
          window.newCatIdx = CATEGORIES.indexOf(G.cat);
        }
      } catch(e) {}
      
      return origStartNextSeason.apply(this, arguments);
    };
    return true;
  }

  /* ====================================================================
   * FIX #2 — Idempotence finalizeLiveRace
   * ================================================================= */
  
  function _rjFixFinalizeIdempotent() {
    if (typeof window.finalizeLiveRace !== "function") return false;
    if (window._rjFix2Installed) return true;
    window._rjFix2Installed = true;
    
    var origFinalize = window.finalizeLiveRace;
    window.finalizeLiveRace = function rjFix2WrappedFinalize() {
      // Garde idempotence : si finalize a déjà été appelée pour cette course,
      // on n'exécute pas une 2e fois (sinon points doublés, UI dupliquée).
      // Le flag est posé sur LIVE_RACE qui est recréé à chaque runRaceLive.
      if (typeof LIVE_RACE !== "undefined" && LIVE_RACE) {
        if (LIVE_RACE._rjFinalized) {
          if (window._rjVerbose) {
            console.warn("[RJ Fix #2] finalizeLiveRace déjà appelée pour cette course — skip");
          }
          return;
        }
        LIVE_RACE._rjFinalized = true;
      }
      
      return origFinalize.apply(this, arguments);
    };
    return true;
  }

  /* ====================================================================
   * FIX #3 — Reset complet QUALI_STATE dans resetRaceScreen
   * ================================================================= */
  
  function _rjFixQualiStateReset() {
    if (typeof window.resetRaceScreen !== "function") return false;
    if (window._rjFix3Installed) return true;
    window._rjFix3Installed = true;
    
    var origResetRaceScreen = window.resetRaceScreen;
    window.resetRaceScreen = function rjFix3WrappedResetRaceScreen() {
      var result = origResetRaceScreen.apply(this, arguments);
      
      // Reset complet de QUALI_STATE pour éviter persistance entre courses
      try {
        if (typeof QUALI_STATE !== "undefined" && QUALI_STATE) {
          QUALI_STATE.spectatorMode = false;
          QUALI_STATE.survived = [];
          QUALI_STATE.nextSurvived = [];
          QUALI_STATE.drivers = [];
          QUALI_STATE.playerElimSes = 0;
          QUALI_STATE.playerFinalPos = undefined;
          QUALI_STATE.phase = "idle";
          QUALI_STATE.session = 0;
          // Nettoie les intervals si encore actifs (ceinture+bretelles)
          if (QUALI_STATE.chronoInterval) {
            clearInterval(QUALI_STATE.chronoInterval);
            QUALI_STATE.chronoInterval = null;
          }
          if (QUALI_STATE.lapInterval) {
            clearInterval(QUALI_STATE.lapInterval);
            QUALI_STATE.lapInterval = null;
          }
        }
      } catch(e) {
        if (window._rjVerbose) console.warn("[RJ Fix #3] Reset QUALI_STATE :", e && e.message);
      }
      
      return result;
    };
    return true;
  }

  /* ====================================================================
   * FIX #4 — Joueur consistency en quali calculée depuis stats
   * ================================================================= */
  
  function _rjFixPlayerQualiConsistency() {
    if (typeof window.startQual !== "function") return false;
    if (window._rjFix4Installed) return true;
    window._rjFix4Installed = true;
    
    var origStartQual = window.startQual;
    window.startQual = function rjFix4WrappedStartQual() {
      var result = origStartQual.apply(this, arguments);
      
      // Le legacy hardcode driver[0].consistency = 0.85 pour le joueur.
      // On corrige post-init avec une formule basée sur les stats
      // régularité (60% du poids) et concentration (40% du poids).
      // Mapping : moyenne des 2 stats (0-100) → consistency [0.55, 0.95]
      try {
        if (typeof QUALI_STATE !== "undefined" && QUALI_STATE && 
            QUALI_STATE.drivers && QUALI_STATE.drivers.length > 0 &&
            typeof G !== "undefined" && G && G.stats) {
          var playerDriver = QUALI_STATE.drivers.find(function(d) { return d.isPlayer; });
          if (playerDriver) {
            var reg = (G.stats.regularite !== undefined) ? G.stats.regularite : 70;
            var conc = (G.stats.concentration !== undefined) ? G.stats.concentration : 70;
            // Pondération : 60% régularité, 40% concentration
            var avg = (0.6 * reg + 0.4 * conc) / 100; // [0, 1]
            // Mapping linéaire vers [0.55, 0.95] pour que le joueur ait toujours
            // une consistency raisonnable (un pilote pro même médiocre n'est pas
            // total chaos), mais que les stats hautes soient récompensées.
            var consistency = 0.55 + avg * 0.40;
            consistency = Math.max(0.55, Math.min(0.97, consistency));
            playerDriver.consistency = consistency;
            
            if (window._rjVerbose) {
              console.log("[RJ Fix #4] Joueur consistency en quali : 0.85 → " + 
                          consistency.toFixed(3) + " (reg=" + reg + ", conc=" + conc + ")");
            }
          }
        }
      } catch(e) {
        if (window._rjVerbose) console.warn("[RJ Fix #4] Player quali consistency :", e && e.message);
      }
      
      return result;
    };
    return true;
  }

  /* ====================================================================
   * AUTO-INSTALLATION AVEC RETRY LOOP
   *
   * Les 4 fonctions à wrapper (startNextSeason, finalizeLiveRace,
   * resetRaceScreen, startQual) sont définies dans 04-race-engine.js.
   * Mais comme ce module est chargé après 04-race-engine.js, les fonctions
   * existent normalement déjà. On garde quand même un retry léger pour
   * les cas où le navigateur charge dans un ordre inattendu.
   * ================================================================= */
  
  var attempts = 0, maxAttempts = 60; // 6s à 100ms
  
  function _rjTryInstallAllFixes() {
    var fix1 = _rjFixNewCatIdx();
    var fix2 = _rjFixFinalizeIdempotent();
    var fix3 = _rjFixQualiStateReset();
    var fix4 = _rjFixPlayerQualiConsistency();
    
    return fix1 && fix2 && fix3 && fix4;
  }
  
  function _rjInstallLoop() {
    attempts++;
    var allInstalled = _rjTryInstallAllFixes();
    
    if (allInstalled) {
      console.log("[RJ Fixes] Module Engine Fixes chargé — 4 bugs corrigés (newCatIdx, finalize, qualiReset, playerQualiConsistency)");
      return;
    }
    
    if (attempts >= maxAttempts) {
      // Stop le retry, log les fixes qui n'ont pas pu s'installer
      var missing = [];
      if (!window._rjFix1Installed) missing.push("#1 newCatIdx");
      if (!window._rjFix2Installed) missing.push("#2 finalize idempotent");
      if (!window._rjFix3Installed) missing.push("#3 quali reset");
      if (!window._rjFix4Installed) missing.push("#4 player quali consistency");
      if (missing.length) {
        console.warn("[RJ Fixes] Fixes non installés (fonctions cibles absentes) : " + missing.join(", "));
      }
      return;
    }
    
    if (typeof setTimeout !== "undefined") setTimeout(_rjInstallLoop, 100);
  }
  
  _rjInstallLoop();

  /* ====================================================================
   * DEBUG CONSOLE
   * ================================================================= */
  
  window.rjEngineFixesDebug = function() {
    console.log("=== État des Engine Fixes ===");
    console.log("Fix #1 (newCatIdx) :", window._rjFix1Installed ? "✓ installé" : "⚠ non installé");
    console.log("Fix #2 (finalize idempotent) :", window._rjFix2Installed ? "✓ installé" : "⚠ non installé");
    console.log("Fix #3 (quali state reset) :", window._rjFix3Installed ? "✓ installé" : "⚠ non installé");
    console.log("Fix #4 (player quali consistency) :", window._rjFix4Installed ? "✓ installé" : "⚠ non installé");
    
    if (typeof QUALI_STATE !== "undefined" && QUALI_STATE) {
      console.log("");
      console.log("État QUALI_STATE actuel :");
      console.log("  session       =", QUALI_STATE.session);
      console.log("  spectatorMode =", QUALI_STATE.spectatorMode);
      console.log("  drivers.len   =", QUALI_STATE.drivers ? QUALI_STATE.drivers.length : "?");
      console.log("  survived.len  =", QUALI_STATE.survived ? QUALI_STATE.survived.length : "?");
      console.log("  playerElimSes =", QUALI_STATE.playerElimSes);
      console.log("  playerFinalPos=", QUALI_STATE.playerFinalPos);
    }
    
    if (typeof LIVE_RACE !== "undefined" && LIVE_RACE) {
      console.log("");
      console.log("État LIVE_RACE :");
      console.log("  cur/total     =", LIVE_RACE.cur + "/" + LIVE_RACE.total);
      console.log("  finished      =", LIVE_RACE.finished);
      console.log("  _rjFinalized  =", LIVE_RACE._rjFinalized);
    }
    
    if (typeof G !== "undefined" && G && G.stats) {
      var reg = G.stats.regularite || 70;
      var conc = G.stats.concentration || 70;
      var avg = (0.6 * reg + 0.4 * conc) / 100;
      var cons = Math.max(0.55, Math.min(0.97, 0.55 + avg * 0.40));
      console.log("");
      console.log("Calcul consistency joueur (preview Fix #4) :");
      console.log("  regularité=" + reg + ", concentration=" + conc);
      console.log("  → consistency = " + cons.toFixed(3) + " (vs 0.85 hardcodé legacy)");
    }
  };

})();


/* ==================================================================== *
 * Ajustements d'expérience et d'affichage
 * (anciennement 04q-polish-rebalance.js)
 * ==================================================================== */

(function() {
  'use strict';
  if (typeof window === 'undefined') return;

  // ========================================================================
  // 1. POINT 4 — FIX BANDEAU S-SAVE COUPÉ
  // ========================================================================
  //
  // PROBLÈME : showSaveMenu() utilise classList.add("on") direct sans
  // passer par navTo()/go(), ce qui omet _scrollScreenTop et fait apparaître
  // l'écran avec un état CSS incomplet.
  //
  // FIX : wrap showSaveMenu pour qu'après son rendu, on appelle go() (qui
  // fait le bon scroll-top + classes correctes) au lieu de juste classList.add.
  // ========================================================================

  function wrapShowSaveMenu() {
    if (typeof window.showSaveMenu !== "function") return false;
    if (window.showSaveMenu._rjPolishedSave) return true;

    var orig = window.showSaveMenu;
    window.showSaveMenu = function rjShowSaveMenuWrapped() {
      var r;
      try {
        r = orig.apply(this, arguments);
      } catch (err) {
        console.warn("[04q] showSaveMenu orig error:", err);
      }
      // Re-applique l'ouverture proprement via go() si dispo
      try {
        if (typeof window.go === "function") {
          // go() fait le _scrollScreenTop et applique correctement les classes
          window.go("S-save");
        } else {
          // Fallback : reset scroll manuel
          var scr = document.getElementById("S-save");
          if (scr) {
            if (typeof scr.scrollTop === "number") scr.scrollTop = 0;
            scr.querySelectorAll(".scroll").forEach(function(el) {
              el.scrollTop = 0;
            });
          }
        }
        // Masque main-nav comme l'original
        var mn = document.getElementById("main-nav");
        if (mn) mn.classList.remove("show");
      } catch (e) {
        console.warn("[04q] showSaveMenu post error:", e);
      }
      return r;
    };
    window.showSaveMenu._rjPolishedSave = true;
    console.log("[04q] showSaveMenu wrapped (bandeau S-save fix)");
    return true;
  }

  // ========================================================================
  // 2. POINT 2 — SUPPRESSION DES KM/H DANS QUALIF/ESSAIS
  // ========================================================================
  //
  // CONTEXTE : .quali-live-sec-vmax affiche "245 km/h" en bas des secteurs
  // pendant qualif/essais. À masquer entièrement (pas pertinent dans un
  // simulateur où la vitesse de pointe n'a pas de sens représentatif).
  //
  // STRATÉGIE : ajouter une règle CSS qui masque tous les .quali-live-sec-vmax
  // ainsi que tout élément avec id ou classe similaire. Plus robuste qu'un
  // wrap car indépendant du timing.
  // ========================================================================

  function injectVmaxHideStyles() {
    if (document.getElementById("rj-vmax-hide-styles")) return;
    var st = document.createElement("style");
    st.id = "rj-vmax-hide-styles";
    st.textContent = [
      "/* Hide km/h en qualif/essais (point 2 demande utilisateur) */",
      ".quali-live-sec-vmax { display: none !important; }",
      "[class*='quali-live-sec-vmax'] { display: none !important; }",
      // Header secteur "Vmax" peut aussi rester orphelin → on cherche label sibling
      ".quali-live-sec-vmax-label { display: none !important; }",
      // FP equivalents si existants
      ".fp-live-sec-vmax { display: none !important; }",
      ".practice-live-sec-vmax { display: none !important; }"
    ].join("\n");
    document.head.appendChild(st);
    console.log("[04q] Styles km/h masqués injectés");
  }

  // ========================================================================
  // 3. POINT 4 — NOTIFICATIONS MENU PRINCIPAL (badges)
  // ========================================================================
  //
  // CONTEXTE :
  //   - h-agent-badge : actuellement affiche unread mails agent → SUPPRIMER
  //   - h-contracts-badge : déjà fonctionnel (offres en attente)
  //   - h-sponsors-badge : pas activé → ACTIVER quand offres sponsors dispo
  //
  // STRATÉGIE : wrap updateHomeBadges pour :
  //   1. Toujours masquer h-agent-badge
  //   2. Calculer les sponsors dispos et activer h-sponsors-badge
  //   3. (h-contracts-badge laissé tel quel : déjà OK)
  // ========================================================================

  function countAvailableSponsorOffers() {
    if (typeof G === "undefined" || !G) return 0;
    // sponsorOffers = offres reçues, pas encore signées/déclinées
    var offers = G.sponsorOffers || [];
    if (!Array.isArray(offers)) return 0;
    var c = 0;
    for (var i = 0; i < offers.length; i++) {
      var o = offers[i];
      if (!o) continue;
      if (o.signed || o.declined || o.expired) continue;
      c++;
    }
    return c;
  }

  function countAvailableContractOffers() {
    if (typeof G === "undefined" || !G) return 0;
    var offers = G.offers || [];
    if (!Array.isArray(offers)) return 0;
    var c = 0;
    for (var i = 0; i < offers.length; i++) {
      var o = offers[i];
      if (!o) continue;
      if (o.signed || o.declined) continue;
      c++;
    }
    return c;
  }

  function applyHomeBadges() {
    try {
      // 1. Badge agent : TOUJOURS masqué (point 4 — l'agent passe par messagerie)
      var ba = document.getElementById("h-agent-badge");
      if (ba) {
        ba.style.display = "none";
        ba.textContent = "";
      }

      // 2. Badge sponsors : afficher si offres dispo
      var bs = document.getElementById("h-sponsors-badge");
      if (bs) {
        var nSpons = countAvailableSponsorOffers();
        if (nSpons > 0) {
          bs.style.display = "inline-flex";
          bs.textContent = nSpons > 9 ? "9+" : String(nSpons);
        } else {
          bs.style.display = "none";
          bs.textContent = "";
        }
      }

      // 3. Badge contrats : afficher si offres dispo (vérif redondante avec
      // updateHomeBadges existant, on s'aligne juste pour être sûr)
      var bc = document.getElementById("h-contracts-badge");
      if (bc) {
        var nCont = countAvailableContractOffers();
        if (nCont > 0) {
          bc.style.display = "inline-flex";
          bc.textContent = nCont > 9 ? "9+" : String(nCont);
        } else {
          bc.style.display = "none";
          bc.textContent = "";
        }
      }
    } catch (e) {
      console.warn("[04q] applyHomeBadges error:", e);
    }
  }

  function wrapUpdateHomeBadges() {
    if (typeof window.updateHomeBadges !== "function") return false;
    if (window.updateHomeBadges._rjPolishedBadges) return true;

    var orig = window.updateHomeBadges;
    window.updateHomeBadges = function rjUpdateHomeBadgesWrapped() {
      var r;
      try {
        r = orig.apply(this, arguments);
      } catch (e) {
        console.warn("[04q] updateHomeBadges orig:", e);
      }
      // Override : nos règles l'emportent
      applyHomeBadges();
      return r;
    };
    window.updateHomeBadges._rjPolishedBadges = true;
    console.log("[04q] updateHomeBadges wrapped (badges agent/sponsors/contrats)");
    return true;
  }

  // ========================================================================
  // 4. WATCHDOG : RÉAPPLIQUE LES BADGES PÉRIODIQUEMENT
  // ========================================================================
  //
  // Le code original peut appeler des fonctions qui re-affichent le badge
  // agent. On surveille toutes les secondes et on applique nos règles.
  // ========================================================================

  function startBadgeWatchdog() {
    setInterval(applyHomeBadges, 1500);
  }

  // ========================================================================
  // 5. APPLY ALL
  // ========================================================================

  function applyAllPolish() {
    var ok = 0, total = 0;
    function tryApply(fn) {
      total++;
      try { if (fn()) ok++; } catch (e) { console.warn("[04q] apply:", e); }
    }
    tryApply(wrapShowSaveMenu);
    tryApply(wrapUpdateHomeBadges);
    console.log("[04q] " + ok + "/" + total + " polish wraps appliqués");
  }

  // Init styles immédiatement
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      injectVmaxHideStyles();
      applyAllPolish();
      setTimeout(applyAllPolish, 500);
      setTimeout(applyAllPolish, 1500);
      setTimeout(applyHomeBadges, 200);
      startBadgeWatchdog();
    });
  } else {
    injectVmaxHideStyles();
    applyAllPolish();
    setTimeout(applyAllPolish, 500);
    setTimeout(applyAllPolish, 1500);
    setTimeout(applyHomeBadges, 200);
    startBadgeWatchdog();
  }

  // ========================================================================
  // 6. DEBUG API
  // ========================================================================

  window.rjPolishDebug = function() {
    console.log("=== 04q Polish Debug ===");
    console.log("showSaveMenu wrapped:",
      !!(window.showSaveMenu && window.showSaveMenu._rjPolishedSave));
    console.log("updateHomeBadges wrapped:",
      !!(window.updateHomeBadges && window.updateHomeBadges._rjPolishedBadges));
    console.log("Sponsor offers dispo:", countAvailableSponsorOffers());
    console.log("Contract offers dispo:", countAvailableContractOffers());
    console.log("Vmax styles injectés:",
      !!document.getElementById("rj-vmax-hide-styles"));
  };

  console.log("[04q] Polish & Rebalance module loaded");

})();

/* =============================================================================
 * 04q — PART 2 : ROUNDING DECIMALS (point 3 utilisateur)
 * =============================================================================
 *
 * APPROCHE : MutationObserver qui visite les nodes texte du DOM et arrondit
 * les nombres décimaux selon leur contexte. Préserve les chronos.
 *
 * RÈGLES DE PRÉSERVATION (chronos + données techniques) :
 *   - Texte ressemblant à un temps de tour : "1:23.456", "1:23,4"
 *   - Texte ressemblant à un écart en course : "+0.342s", "−0.1s", "(0.5s)"
 *   - Texte ressemblant à un format K : "1.5k", "12.3K"
 *   - Attribut SVG (path d=, x=, y=, cx=, cy=, r=)
 *   - Texte dans <code>, <pre>
 *
 * RÈGLES D'ARRONDI (valeurs) :
 *   - Pourcentages : "12.5%" → "13%"
 *   - Notes/ratings : "Note 75.5" → "Note 76"
 *   - Moyennes positions : "P1.5" → "P2"
 *   - Decimal seul dans cellule : "12.3" → "12"
 *   - Montants : "1234.5 €" → "1235 €"
 *
 * STRATÉGIE :
 *   - Observer le body en mutation:childList + characterData
 *   - Pour chaque text node ajouté/modifié, parser et remplacer
 *   - Performance : debounced + skip pendant les courses (LIVE_RACE actif)
 * ===========================================================================*/

(function() {
  'use strict';
  if (typeof window === 'undefined') return;

  // Patterns de DÉTECTION (qu'est-ce qui est un chrono, qu'est-ce qui ne l'est pas)
  // ---------------------------------------------------------------------------
  // CHRONO_PATTERN : reconnait les chronos qu'on ne touche pas
  //   - "1:23.456"  (temps tour)
  //   - "1:23,4"    (avec virgule)
  //   - "+0.342s"   (gap)
  //   - "−0.1s"     (gap signé)
  //   - "0.34s"     (avec s)
  //   - "(0.342s)"  (gap entre parenthèses)
  // ---------------------------------------------------------------------------
  // K_PATTERN : "1.5k", "12.3K" → légitime, on garde
  // ---------------------------------------------------------------------------
  // VALUE_PATTERN : nombres avec décimales à arrondir
  //   - "12.5%" → "13%"
  //   - "+1.8%" → "+2%"
  //   - "P1.5"  → "P2"
  //   - "75.4"  isolé → "75"

  // Regex unique : capture nombre décimal avec contexte autour
  // Group 1 = signe optionnel (+/−/-)
  // Group 2 = entier
  // Group 3 = décimales
  // Group 4 = suffixe immédiat (%, €, k, s, ...)
  // ---------------------------------------------------------------------------
  // On évite de toucher quand le nombre est juste avant un "s" (= secondes)
  // ou juste avant un ":" (= chrono "1:23.4") ou dans "1.5k"

  // ----------------------------------------------------------------------
  // FONCTION DE TRANSFORMATION TEXTE
  // ----------------------------------------------------------------------

  function looksLikeChrono(textBefore, textAfter) {
    // Si le caractère juste avant est un chiffre + ":" → c'est un chrono "1:23.4"
    if (/\d:\s*$/.test(textBefore.slice(-3))) return true;
    // Si juste après il y a un "s" tout seul, c'est un gap en secondes
    if (/^s(?:[\s,.;:!?\)]|$)/i.test(textAfter)) return true;
    // Si juste après il y a un "k" ou "K" tout seul → followers/format K
    if (/^[kK](?:[\s,.;:!?\)]|$)/.test(textAfter)) return true;
    return false;
  }

  function processText(text) {
    if (!text || typeof text !== "string") return text;
    // Quick check : pas de point ni virgule décimale → rien à faire
    if (text.indexOf(".") < 0 && text.indexOf(",") < 0) return text;
    // Skip si très long (probablement code/CSS)
    if (text.length > 500) return text;

    // Match nombre décimal : signe? entier . décimales (point) ou , décimales (virgule)
    // On utilise [.] et exclut les décimales avec plus de 3 chiffres (probable hash/timestamp)
    var re = /([+\-−]?)(\d+)[\.,](\d{1,3})\b/g;
    var result = "";
    var lastEnd = 0;
    var m;
    while ((m = re.exec(text)) !== null) {
      var matchStart = m.index;
      var matchEnd = re.lastIndex;
      var sign = m[1] || "";
      var intPart = m[2];
      var decPart = m[3];

      // Contexte avant et après
      var before = text.substring(0, matchStart);
      var after = text.substring(matchEnd);

      // On regarde si c'est un chrono / format à préserver
      if (looksLikeChrono(before, after)) {
        // Skip : on garde le match tel quel
        result += text.substring(lastEnd, matchEnd);
        lastEnd = matchEnd;
        continue;
      }

      // Cas particulier : si le nombre est suivi immédiatement de "h" ou "min" / 
      // "kg" / "km" sans espace, on garde aussi (ex "12.5h" peut signifier h decimal)
      if (/^(?:h|min|kg|km|mph|kph|ms|ml|cl|cm|mm)\b/i.test(after)) {
        result += text.substring(lastEnd, matchEnd);
        lastEnd = matchEnd;
        continue;
      }

      // Sinon, on arrondit
      var fullNum = parseFloat(sign.replace("−", "-") + intPart + "." + decPart);
      var rounded = Math.round(fullNum);
      var roundedStr = (sign === "−" && rounded < 0) ? ("−" + Math.abs(rounded)) :
                       (rounded >= 0 && sign === "+") ? ("+" + rounded) :
                       String(rounded);

      // Append le texte avant + le nombre arrondi
      result += text.substring(lastEnd, matchStart) + roundedStr;
      lastEnd = matchEnd;
    }
    result += text.substring(lastEnd);
    return result;
  }

  // ----------------------------------------------------------------------
  // OBSERVER DOM
  // ----------------------------------------------------------------------

  // Tags qu'on ne touche pas
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, CODE: 1, PRE: 1, TEXTAREA: 1, INPUT: 1, SVG: 1 };

  // Walk un node et transforme tous ses text nodes descendants
  function walkAndProcess(node) {
    if (!node) return;
    // Skip pendant qu'une course tourne live (perf)
    if (typeof LIVE_RACE !== "undefined" && LIVE_RACE && LIVE_RACE.lap > 0 && !LIVE_RACE.finished) {
      return;
    }
    if (node.nodeType === 3) {
      // Text node
      var parent = node.parentNode;
      if (!parent) return;
      // Skip si parent a un tag à éviter
      var tag = parent.tagName;
      if (tag && SKIP_TAGS[tag]) return;
      // Skip si c'est dans un SVG
      var p = parent;
      while (p && p !== document.body) {
        if (p.tagName === "svg" || p.tagName === "SVG") return;
        if (p.hasAttribute && p.hasAttribute("data-rj-noround")) return;
        if (p.classList && (p.classList.contains("rj-bcast-counter") || 
                             p.classList.contains("rj-bcast-title") ||
                             p.classList.contains("lec-lap-display"))) {
          // Garder la précision pour ces éléments (chrono live)
          // Note : on a déjà la chrono detection mais on est conservateur
          return;
        }
        p = p.parentNode;
      }
      // Skip si parent a un attribut data-rj-noround
      if (parent.hasAttribute && parent.hasAttribute("data-rj-noround")) return;
      // Skip pour les classes spécifiques de chrono
      if (parent.classList) {
        var skipClasses = ["lap-time", "chrono", "gap-time", "sector-time", 
                          "delta-time", "best-lap", "rj-bcast-counter", "quali-live-sec-time"];
        for (var i = 0; i < skipClasses.length; i++) {
          if (parent.classList.contains(skipClasses[i])) return;
        }
      }
      var newText = processText(node.nodeValue);
      if (newText !== node.nodeValue) {
        node.nodeValue = newText;
      }
      return;
    }
    if (node.nodeType !== 1) return; // pas un élément
    // Skip tag
    if (SKIP_TAGS[node.tagName]) return;
    // Skip si data-rj-noround ailleurs
    if (node.hasAttribute && node.hasAttribute("data-rj-noround")) return;
    // Walk children
    var children = node.childNodes;
    for (var j = 0; j < children.length; j++) {
      walkAndProcess(children[j]);
    }
  }

  // Debounced run
  var roundTimer = null;
  var pendingNodes = [];

  function scheduleRound(node) {
    if (!node) return;
    pendingNodes.push(node);
    if (roundTimer) return;
    roundTimer = setTimeout(function() {
      roundTimer = null;
      var nodes = pendingNodes.slice();
      pendingNodes.length = 0;
      try {
        for (var i = 0; i < nodes.length; i++) {
          walkAndProcess(nodes[i]);
        }
      } catch (e) {
        console.warn("[04q] rounding walk:", e);
      }
    }, 150);
  }

  function startRoundingObserver() {
    if (window._rj04qRoundObserver) return;
    if (typeof MutationObserver === "undefined") return;

    var obs = new MutationObserver(function(muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === "childList") {
          for (var j = 0; j < m.addedNodes.length; j++) {
            scheduleRound(m.addedNodes[j]);
          }
        } else if (m.type === "characterData") {
          scheduleRound(m.target);
        }
      }
    });
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
    window._rj04qRoundObserver = obs;

    // Initial pass
    setTimeout(function() {
      try { walkAndProcess(document.body); } catch (e) {
        console.warn("[04q] initial round walk:", e);
      }
    }, 300);

    console.log("[04q] Rounding observer started");
  }

  // Wait DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      setTimeout(startRoundingObserver, 200);
    });
  } else {
    setTimeout(startRoundingObserver, 200);
  }

  // Expose for debug
  window._rj04qProcessText = processText;

})();

/* =============================================================================
 * 04q — PART 3 : SANDBOX CONSTRAINT — pas d'Indépendant hors Karting Junior
 * =============================================================================
 *
 * CONTEXTE :
 * Dans le mode bac à sable (Paddock Pass), le menu déroulant d'écuries
 * propose toujours "Indépendant" en première option, peu importe la
 * catégorie sélectionnée. Or, jouer indépendant n'a de sens qu'en Karting
 * Junior — au-delà, c'est irréaliste : aucun pilote ne court en F4/FR/F3/F2/
 * F1/SF/WEC/IndyCar sans écurie.
 *
 * STRATÉGIE :
 * Wrap _sbUpdateTeams() pour retirer l'option "Indépendant" si la catégorie
 * sélectionnée est différente de "Karting Junior". On surveille aussi les
 * changements via un MutationObserver léger sur le select sb-team.
 * ===========================================================================*/

(function() {
  'use strict';
  if (typeof window === 'undefined') return;

  function applySandboxIndepConstraint() {
    try {
      var catSel = document.getElementById("sb-cat");
      var teamSel = document.getElementById("sb-team");
      if (!catSel || !teamSel) return;
      var cat = catSel.value || "";
      // Indépendant autorisé uniquement en Karting Junior
      if (cat === "Karting Junior") {
        // S'assurer qu'on a une option Indépendant
        var hasIndep = false;
        for (var i = 0; i < teamSel.options.length; i++) {
          if (teamSel.options[i].value === "") {
            hasIndep = true; break;
          }
        }
        if (!hasIndep) {
          var opt = document.createElement("option");
          opt.value = "";
          opt.textContent = "Indépendant";
          teamSel.insertBefore(opt, teamSel.firstChild);
        }
        return;
      }
      // Pour toute autre catégorie : retire les options Indépendant
      var removed = 0;
      var toRemove = [];
      for (var j = 0; j < teamSel.options.length; j++) {
        if (teamSel.options[j].value === "") {
          toRemove.push(teamSel.options[j]);
        }
      }
      toRemove.forEach(function(o) {
        if (o.parentNode) o.parentNode.removeChild(o);
        removed++;
      });
      // Si on vient de retirer l'option sélectionnée, on bascule sur la première option
      // valide (la première équipe disponible)
      if (removed > 0 && teamSel.options.length > 0 && teamSel.value === "") {
        teamSel.value = teamSel.options[0].value;
      }
    } catch (e) {
      console.warn("[04q] sandbox indep constraint error:", e);
    }
  }

  function wrapSbUpdateTeams() {
    if (typeof window._sbUpdateTeams !== "function") return false;
    if (window._sbUpdateTeams._rjSandboxConstrained) return true;

    var orig = window._sbUpdateTeams;
    window._sbUpdateTeams = function rjSbUpdateTeamsConstrained() {
      var r;
      try { r = orig.apply(this, arguments); }
      catch (e) { console.warn("[04q] _sbUpdateTeams orig:", e); }
      // Après que l'orig a peuplé le select, applique la contrainte
      applySandboxIndepConstraint();
      return r;
    };
    window._sbUpdateTeams._rjSandboxConstrained = true;
    console.log("[04q] _sbUpdateTeams wrapped (no Indépendant hors Karting Junior)");
    return true;
  }

  // Watchdog : applique aussi la contrainte si l'écran sandbox est ouvert
  // sans que _sbUpdateTeams soit ré-appelé (au load par exemple)
  function startSandboxWatchdog() {
    setInterval(function() {
      try {
        // Si le bloc sandbox est visible, applique
        var sb = document.getElementById("sandbox-block");
        if (sb && sb.style.display === "block") {
          applySandboxIndepConstraint();
        }
      } catch (e) {}
    }, 1500);
  }

  function applySandboxConstraint() {
    var ok = wrapSbUpdateTeams();
    if (ok) startSandboxWatchdog();
    return ok;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      applySandboxConstraint();
      setTimeout(applySandboxConstraint, 500);
      setTimeout(applySandboxConstraint, 1500);
    });
  } else {
    applySandboxConstraint();
    setTimeout(applySandboxConstraint, 500);
    setTimeout(applySandboxConstraint, 1500);
  }

  // Expose pour debug
  window.rjSandboxApplyConstraint = applySandboxIndepConstraint;

  console.log("[04q] Sandbox constraint module loaded (Indépendant restricted to Karting Junior)");

})();


/* =============================================================================
 * [04q] COLONNE PNEUS dans les classements (qualif + course)
 * -----------------------------------------------------------------------------
 * Ajoute un badge couleur S/M/H/I/W (via TYRE_COMPOUND_INFO) à chaque pilote.
 * Le moteur ne suit PAS le composé des rivaux → composé simulé de façon
 * DÉTERMINISTE (graine = saison + manche + catégorie + pilote), donc stable au
 * re-render. Course = composé de fin de relais ; pour les catégories à règle des
 * 2 composés (F1, course principale F2, lues via getWeekendFormat().pit.compounds)
 * le composé de fin provient d'un plan LÉGAL (≥2 composés secs) ; sous la pluie
 * la règle saute → I/W. Le joueur utilise G._raceStrategy.startCompound si dispo
 * (course mono-gomme). NB : le classement des ESSAIS dépend du module 13 (absent)
 * → aucune table à enrichir là pour l'instant.
 * Réversible : supprimer ce bloc. Idempotent : wraps gardés par _rjPn.
 * ===========================================================================*/
(function () {
  'use strict';
  var TAG = '[04q-tyres]';

  function TI() { return (window.TYRE_COMPOUND_INFO && typeof window.TYRE_COMPOUND_INFO === 'object') ? window.TYRE_COMPOUND_INFO : null; }
  function G() { return window.G; }

  function _hash(s) { var h = 2166136261 >>> 0; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function _rng(parts) { var seed = _hash(parts.join('|')); return function () { seed = (seed + 0x6D2B79F5) >>> 0; var t = seed; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function _pick(rng, arr) { var tot = 0, i; for (i = 0; i < arr.length; i++) tot += arr[i].w; var r = rng() * tot; for (i = 0; i < arr.length; i++) { if ((r -= arr[i].w) <= 0) return arr[i].c; } return arr[arr.length - 1].c; }

  function _ctx() { var g = G() || {}; return { s: g.saison || 1, m: (g.races && g.races.length ? g.races.length : 0) + 1, cat: g.cat || '' }; }
  function _isWet() { var w = window.RACE_STATE && window.RACE_STATE.weather; var id = w && w.id; return id === 'wet' || id === 'storm' || id === 'rain'; }
  function _twoCompounds(cat) {
    try { var f = (typeof window.getWeekendFormat === 'function') ? window.getWeekendFormat(cat) : null; return !!(f && f.pit && f.pit.compounds && f.pit.compounds >= 2); } catch (e) { return false; }
  }

  function _qualiCompound(name) {
   // Le composé de qualification n'est PAS un choix individuel : il découle de
   // l'état de la piste, identique pour tout le monde à un instant donné.
   //   - piste détrempée (pluie battante) -> pneu pluie pour tous
   //   - piste humide                     -> intermédiaire pour tous
   //   - sec, nuageux ou chaud            -> tendre pour tous
   // Auparavant chaque pilote tirait sa gomme au hasard (60/40 inter-wet sous
   // la pluie, et jusqu'à 20 % de medium en Q1), ce qui donnait des grilles
   // incohérentes : deux pneus pluie différents dans la même séance.
   if (_isWet()) {
     var w = window.RACE_STATE && window.RACE_STATE.weather;
     var id = w && w.id;
     return id === 'storm' ? 'wet' : 'inter';
   }
   return 'soft';
 }

 function _raceCompound(name, isPlayer) {
    var c = _ctx(), rng = _rng(['R', c.s, c.m, c.cat, name]);
    if (_isWet()) return rng() < 0.62 ? 'inter' : 'wet';
    var two = _twoCompounds(c.cat);
    // composé réel du joueur si course mono-gomme (pas d'arrêt imposé)
    if (isPlayer && !two) {
      var g = G();
      if (g && g._raceStrategy && g._raceStrategy.startCompound && TI() && TI()[g._raceStrategy.startCompound]) return g._raceStrategy.startCompound;
    }
    if (two) return _pick(rng, [{ c: 'medium', w: 5 }, { c: 'hard', w: 4 }, { c: 'soft', w: 2 }]); // finit sur le plus dur après ≥2 composés
    return _pick(rng, [{ c: 'medium', w: 5 }, { c: 'soft', w: 4 }, { c: 'hard', w: 1 }]);
  }

  function _badge(compound, w) {
    var info = TI(); if (!info) return '';
    var t = info[compound]; if (!t) return '';
    w = w || 20;
    return '<span title="' + (t.label || '') + '" style="display:inline-flex;align-items:center;justify-content:center;width:' + w + 'px;height:' + w + 'px;border-radius:50%;background:' + (t.bg || 'transparent') + ';border:1.5px solid ' + t.color + ';color:' + t.color + ';font-size:11px;font-weight:800;font-family:var(--font-display,sans-serif);line-height:1;flex-shrink:0">' + t.short + '</span>';
  }

  // Variante sans rond : juste la lettre, à la couleur du composé (classement de course).
  function _letter(compound) {
    var info = TI(); if (!info) return '';
    var t = info[compound]; if (!t) return '';
    return '<span title="' + (t.label || '') + '" style="font-weight:900;font-size:13px;color:' + t.color + ';font-family:var(--font-display,sans-serif);line-height:1;flex-shrink:0">' + t.short + '</span>';
  }

  // Convertit les pastilles pneus (ronds 14px) du classement live, rendues par le
  // cœur (renderLiveLeaderboard), en simples lettres colorées. Idempotent.
  function _decircleLeaderboardTyres() {
    var root = document.getElementById('live-leaderboard');
    if (!root) return;
    var spans = root.querySelectorAll('span'), L = ['S', 'M', 'H', 'I', 'W'];
    for (var i = 0; i < spans.length; i++) {
      var s = spans[i], st = s.getAttribute('style') || '';
      if (st.indexOf('border-radius:50%') < 0 || st.indexOf('14px') < 0) continue;
      var txt = (s.textContent || '').trim();
      if (L.indexOf(txt) < 0) continue;
      var mm = st.match(/background:\s*([^;]+)/);
      var col = (mm && mm[1] ? mm[1] : '#fff').trim();
      s.setAttribute('style', 'font-weight:900;font-size:12px;line-height:1;flex-shrink:0;color:' + col);
    }
  }

  // --- QUALIF : colonne dans #quali-timing-board ---
  function _injectQuali() {
    var board = document.getElementById('quali-timing-board');
    if (!board || board.children.length < 2) return;
    if (board.querySelector('[data-rj-pn]')) return; // déjà fait pour ce render
    var rows = board.children;
    for (var i = 0; i < rows.length; i++) {
      var spans = rows[i].children;
      if (spans.length < 2) continue;
      if (i === 0) {
        var th = document.createElement('span');
        th.textContent = 'Pn'; th.setAttribute('data-rj-pn', '1');
        th.style.cssText = 'width:30px;text-align:center';
        rows[i].insertBefore(th, spans[spans.length - 1]); // avant Écart
        continue;
      }
      var nm = (spans[1].textContent || '').trim();
      if (!nm) continue;
      var cell = document.createElement('span');
      cell.style.cssText = 'width:30px;display:inline-flex;align-items:center;justify-content:center';
      cell.innerHTML = _badge(_qualiCompound(nm), 20);
      rows[i].insertBefore(cell, spans[spans.length - 1]);
    }
  }

  // --- COURSE : colonne dans le « Classement final » de #res-content ---
  function _injectRace() {
    var root = document.getElementById('res-content'); if (!root) return;
    var nodes = root.querySelectorAll('div,span'), header = null;
    for (var i = 0; i < nodes.length; i++) { if ((nodes[i].textContent || '').trim() === 'Classement final') { header = nodes[i]; break; } }
    if (!header || !header.parentNode) return;
    var box = header.parentNode;
    if (box.getAttribute('data-rj-pn')) return;
    box.setAttribute('data-rj-pn', '1');
    var kids = box.children;
    for (var k = 0; k < kids.length; k++) {
      var row = kids[k];
      if (row === header) continue;
      var spans = row.children;
      if (spans.length < 3) continue;
      var nameSpan = spans[1];
      var nm = nameSpan ? (nameSpan.textContent || '').replace('▶', '').replace('DNF', '').trim() : '';
      if (!nm) continue;
      var isPlayer = (row.style.cssText.indexOf('232,16,48') >= 0) || (nameSpan && nameSpan.innerHTML.indexOf('▶') >= 0);
      var cell = document.createElement('span');
      cell.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:24px;flex-shrink:0';
      cell.innerHTML = _letter(_raceCompound(nm, isPlayer));
      row.insertBefore(cell, spans[spans.length - 1]); // avant la colonne points
    }
  }

  function wrapRenders() {
    var have = false;
    // QUALIF : renderTimingBoard n'est wrappé par personne d'autre → wrap précis
    if (typeof window.renderTimingBoard === 'function') {
      have = true;
      if (!window.renderTimingBoard._rjPn) {
        var o1 = window.renderTimingBoard;
        window.renderTimingBoard = function () { var r = o1.apply(this, arguments); try { _injectQuali(); } catch (e) {} return r; };
        window.renderTimingBoard._rjPn = true;
      }
    }
    return have;
  }

  // COURSE : showResult/buildResultScreen sont ré-wrappés par d'autres modules
  // (ex. module 20) → un wrap précoce serait contourné. On observe donc le DOM :
  // dès que le « Classement final » apparaît dans #res-content, on injecte.
  // Le drapeau data-rj-pn rend l'opération idempotente (pas de double colonne).
  var _pending = false;
  function _scan() { _pending = false; try { _injectRace(); } catch (e) {} try { _injectQuali(); } catch (e) {} try { _decircleLeaderboardTyres(); } catch (e) {} }
  function _schedule() { if (_pending) return; _pending = true; setTimeout(_scan, 40); }
  function startObserver() {
    if (window._rjTyreObs) return true;
    if (typeof MutationObserver === 'undefined' || !document.body) return false;
    var obs = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) { if (muts[i].addedNodes && muts[i].addedNodes.length) { _schedule(); return; } }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    window._rjTyreObs = obs;
    return true;
  }

  window.rjDebugTyreCol = function () {
    var c = _ctx();
    console.log(TAG, 'cat', c.cat, '| 2 composés:', _twoCompounds(c.cat), '| pluie:', _isWet());
  };
  window.rjInjectTyreCols = function () { try { _injectQuali(); } catch (e) {} try { _injectRace(); } catch (e) {} };

  function boot(n) {
    var q = wrapRenders();
    startObserver();
    if (q) { console.log(TAG, 'colonne pneus activée (qualif via wrap + course via observer). Debug: rjDebugTyreCol()'); return; }
    if (n > 0) setTimeout(function () { boot(n - 1); }, 300);
    else { startObserver(); console.warn(TAG, 'renderTimingBoard introuvable — qualif non couverte, course via observer uniquement.'); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { boot(40); });
  else boot(40);
})();


/* ==================================================================== *
 * Rééquilibrage de la note du pilote
 * (anciennement 04r-skill-rebalance.js)
 * ==================================================================== */

(function() {
  'use strict';
  if (typeof window === 'undefined') return;

  // ========================================================================
  // BARÈME REBALANCE : mapping ancien → nouveau par catégorie (note joueur)
  // ========================================================================
  var REBALANCE_TABLE = {
    "Karting Junior":   { oldMin: 37, oldMax: 54, newMin: 28, newMax: 45 },
    "Karting Senior":   { oldMin: 47, oldMax: 65, newMin: 38, newMax: 56 },
    "Formule 4":        { oldMin: 52, oldMax: 72, newMin: 45, newMax: 65 },
    "Formula Regional": { oldMin: 58, oldMax: 78, newMin: 52, newMax: 72 },
    "Formule 3":        { oldMin: 63, oldMax: 83, newMin: 58, newMax: 78 },
    "Formule 2":        { oldMin: 69, oldMax: 88, newMin: 65, newMax: 83 },
    "Formule 1":        { oldMin: 75, oldMax: 96, newMin: 70, newMax: 95 },
    "Super Formula":    { oldMin: 75, oldMax: 90, newMin: 70, newMax: 87 },
    "Endurance WEC":    { oldMin: 76, oldMax: 90, newMin: 70, newMax: 86 },
    "IndyCar":          { oldMin: 75, oldMax: 90, newMin: 70, newMax: 86 }
  };

  // ========================================================================
  // FONCTION DE RÉÉQUILIBRAGE
  // Transpose une note de l'ancienne échelle vers la nouvelle pour une cat.
  // ========================================================================
  function rebalanceSkill(oldSk, cat) {
    var t = REBALANCE_TABLE[cat];
    if (!t || typeof oldSk !== "number") return oldSk;
    var oldRange = t.oldMax - t.oldMin;
    if (oldRange <= 0) return oldSk;
    var rel = (oldSk - t.oldMin) / oldRange;
    rel = Math.max(0, Math.min(1, rel));
    var newRange = t.newMax - t.newMin;
    var newSk = t.newMin + rel * newRange;
    return Math.round(newSk);
  }

  // ========================================================================
  // WRAP calcPlayerRating — rebalance la note du joueur (SEUL volet actif)
  // ========================================================================
  function wrapCalcPlayerRating() {
    if (typeof window.calcPlayerRating !== "function") return false;
    if (window.calcPlayerRating._rjRebalanced) return true;

    var orig = window.calcPlayerRating;
    window.calcPlayerRating = function rjCalcPlayerRatingRebalanced() {
      var oldRating;
      try { oldRating = orig.apply(this, arguments); }
      catch (e) { return 50; }
      if (typeof oldRating !== "number") return oldRating;

      var cat = (typeof G !== "undefined" && G) ? G.cat : null;
      if (!cat || !REBALANCE_TABLE[cat]) return oldRating;
      return rebalanceSkill(oldRating, cat);
    };
    window.calcPlayerRating._rjRebalanced = true;
    console.log("[04r] calcPlayerRating wrappé (note joueur rebalancée)");
    return true;
  }

  // ========================================================================
  // BOOTSTRAP — applique le wrap dès que calcPlayerRating est disponible
  // ========================================================================
  function boot(retries) {
    if (wrapCalcPlayerRating()) {
      console.log("[04r] Player Rating Rebalance — actif (note joueur uniquement)");
      return;
    }
    if (retries > 0) { setTimeout(function() { boot(retries - 1); }, 300); return; }
    console.warn("[04r] calcPlayerRating introuvable — rebalance joueur non appliqué.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() { boot(40); });
  } else {
    boot(40);
  }

  // ========================================================================
  // DEBUG
  // ========================================================================
  window.rjRebalanceDebug = function() {
    var wrapped = !!(window.calcPlayerRating && window.calcPlayerRating._rjRebalanced);
    var cat = (typeof G !== "undefined" && G) ? G.cat : null;
    console.log("=== 04r Player Rating Rebalance ===");
    console.log("calcPlayerRating wrappé :", wrapped);
    console.log("catégorie courante      :", cat);
    if (wrapped && typeof window.calcPlayerRating === "function") {
      console.log("note joueur (rebalancée):", window.calcPlayerRating());
    }
  };

  window._RJ_REBAL = {
    rebalanceSkill: rebalanceSkill,
    REBALANCE_TABLE: REBALANCE_TABLE
  };

})();
