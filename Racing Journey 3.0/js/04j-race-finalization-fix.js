/* =====================================================================
 * 04j-race-finalization-fix.js — FILET DE SÉCURITÉ FIN DE COURSE
 * 
 * Corrige le bug où le bouton "race-btn" reste figé à "En course..."
 * quand finalizeLiveRace ou showResult plante en cours d'exécution.
 * 
 * Le legacy a déjà un try/catch dans tickRace, mais il n'a pas de
 * protection si finalizeLiveRace OU showResult plante. Ce module pose
 * 3 couches défensives :
 * 
 *   Couche 1 : Wrap finalizeLiveRace pour catcher toute exception et
 *              forcer la réactivation du bouton dans le finally.
 * 
 *   Couche 2 : Wrap showResult pour catcher toute exception et forcer
 *              le rtab("res") + réactivation du bouton.
 * 
 *   Couche 3 : Watchdog dans runRaceLive — démarre un timer de sécurité
 *              au lancement de course. Si après 2.5× le temps attendu la
 *              course n'a pas finalisé (LIVE_RACE.finished !== true OU le
 *              bouton est encore désactivé), on force la réactivation.
 * 
 * Le watchdog est annulé proprement quand finalizeLiveRace réussit
 * normalement (ce qui sera 99% des cas).
 * ===================================================================== */

/* ========================================================================
 * Helper : réactive le bouton race-btn de façon sûre
 * ===================================================================== */

function _rjForceReactivateRaceButton(reason) {
  if (typeof document === "undefined") return false;
  var btn = document.getElementById("race-btn");
  if (!btn) return false;
  
  // On ne touche au bouton que s'il est dans l'état "En course..."
  // pour ne pas écraser un autre état légitime
  if (btn.disabled || (btn.textContent && btn.textContent.indexOf("course") >= 0)) {
    btn.disabled = false;
    btn.textContent = "Départ !";
    if (reason) console.warn("[RJ] Bouton race-btn forcé à 'Départ !' — raison:", reason);
    return true;
  }
  return false;
}

/* ========================================================================
 * COUCHE 1 — Wrap finalizeLiveRace
 * ===================================================================== */

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
    
    window.renderLiveLeaderboard = function rjDefensiveRender() {
      try {
        return origRender.apply(this, arguments);
      } catch(e) {
        // Avale silencieusement pour ne pas bloquer le tickRace
        if (window._rjVerbose) {
          console.warn("[RJ] renderLiveLeaderboard exception (avalée) :", e && e.message);
        }
        return null;
      }
    };
  }
  
  // S'installe APRÈS les autres wrappers (Graphics, etc.) pour être l'enveloppe extérieure
  // Délai pour laisser les autres modules s'installer en premier
  setTimeout(tryInstall, 200);
})();
