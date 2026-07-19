/* =====================================================================
 * 04l-engine-fixes.js — CORRECTIONS DE BUGS DU MOTEUR DE COURSE
 *
 * Module qui regroupe les corrections de bugs identifiés dans
 * 04-race-engine.js par analyse statique. Toutes les corrections sont
 * non-destructives (wrappers, overrides) — le code legacy n'est pas modifié.
 *
 * Bugs corrigés :
 *
 * ── FIX #1 ── newCatIdx undefined dans startNextSeason
 *    Cause : variable utilisée mais jamais déclarée.
 *    Effet : la branche "rétrograder en Karting Junior depuis Karting
 *            Senior" est morte. Tout pilote indépendant non-karting est
 *            forcé en saison blanche au lieu d'être rétrogradé.
 *    Fix   : pose `window.newCatIdx = CATEGORIES.indexOf(G.cat)` AVANT
 *            chaque appel à startNextSeason via wrapper.
 *
 * ── FIX #2 ── finalizeLiveRace appelée 2 fois (double points, double UI)
 *    Cause : pas de garde idempotence. Si tickRace plante en parallèle
 *            de la fin normale de course, deux setTimeout(finalize) sont
 *            armés.
 *    Effet : G.rivals[i].pts incrémenté 2× → classement championnat faux.
 *    Fix   : wrapper finalizeLiveRace qui pose et vérifie LIVE_RACE._finalized.
 *
 * ── FIX #3 ── QUALI_STATE pas reset entre courses
 *    Cause : resetRaceScreen ne reset que session=0, pas spectatorMode,
 *            survived, playerElimSes, playerFinalPos, drivers.
 *    Effet : si éliminé Q1 d'une course, prochaine course peut hériter du
 *            mode spectateur ou afficher "Tu es éliminé en Q1".
 *    Fix   : wrapper resetRaceScreen qui reset l'état complet.
 *
 * ── FIX #4 ── Joueur consistency hardcodé à 0.85 en qualif
 *    Cause : QUALI_STATE.drivers.push({...consistency:.85, ...}) en dur.
 *    Effet : les stats régularité/concentration du joueur n'ont aucun
 *            impact sur sa consistency en quali. Joueur regularite=95
 *            traité comme joueur regularite=50.
 *    Fix   : wrapper startQual qui patche driver[0].consistency post-init
 *            avec une valeur calculée depuis G.stats.
 *
 * Architecture :
 *    - Chaque fix vit dans une IIFE auto-installée
 *    - Toutes utilisent retry-loops pour gérer le chargement async
 *    - Le module entier ne touche qu'à window.* (pas de patch source)
 *
 * Debug console :
 *    - rjEngineFixesDebug() → état des 4 fixes
 * ===================================================================== */

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
