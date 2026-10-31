/* =====================================================================
 * 04j-fin-de-course.js — FILET DE SÉCURITÉ EN FIN DE COURSE
 *
 * Issu de l'ancien legacy/04j-corrections.js, rangé par domaine (T8).
 * =================================================================== */

/* ==================================================================== *
 * Filet de sécurité en fin de course
 * (anciennement 04j-race-finalization-fix.js)
 * ==================================================================== */

/* Réactive le bouton de course quand une fin de course a planté. Appelée par
   tous les filets de ce fichier — elle n'était définie nulle part, si bien que
   chaque filet levait lui-même une ReferenceError. */
function _rjForceReactivateRaceButton(raison) {
  console.warn("[RJ] bouton de course réactivé de force :", raison);
  try { var b = document.getElementById("race-btn"); if (b) b.disabled = false; } catch (e) {}
  try { if (typeof G !== "undefined" && G) G.raceLocked = false; } catch (e) {}
}

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
    
    rjInscrire("finalizeLiveRace", { id: "04j-fin-de-course:finalizeLiveRace", ordre: -800, remplace: function (args, suite) {
      var startedAt = Date.now();
      var caughtError = null;
      
      try {
        return suite();
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
    } });
  }
  
  tryInstall();
})();

/* ========================================================================
 * COUCHE 2 — Wrap showResult
 * ===================================================================== */

/* Appelé par showResult (04) quand son cœur plante : on rend quand même la
   main au joueur (onglet Résultat, bouton réactivé, course enregistrée). */
window.rjRattraperResultat = function (e) {
  console.error("[RJ] showResult a planté :", e && e.message, e && e.stack);
  try { if (typeof window.rtab === "function") window.rtab("res", true); } catch (_e) {}
  _rjForceReactivateRaceButton("showResult planté");
  // Marque la course comme courue, pour que markRaceDone n'échoue pas ensuite.
  try {
    if (G && G.races && Array.isArray(G.races)) {
      G.races.push({
        nom: "Course (erreur de finalisation)", pos: window.LIVE_RACE_FINAL_POS || 99, pts: 0,
        detail: "Une erreur s'est produite à la fin de la course.",
        saison: G.saison, cat: G.cat, _hadError: true
      });
    }
  } catch (_e) {}
  return null;
};

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
    
    if (!Array.isArray(window.RJ_RACE_START_HOOKS)) window.RJ_RACE_START_HOOKS = [];
    // Annule un watchdog précédent si existant (course relancée)
    window.RJ_RACE_START_HOOKS.push({ id: "04j-chien-de-garde-arret", ordre: 30, avant: function () {
      if (window._rjRaceWatchdogId) {
        clearTimeout(window._rjRaceWatchdogId);
        window._rjRaceWatchdogId = null;
      }
    } });
    window.RJ_RACE_START_HOOKS.push({ id: "04j-chien-de-garde", ordre: -50, apres: function () {
      
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
        var tourVu = -1, reports = 0;

        window._rjRaceWatchdogId = setTimeout(function rjRaceWatchdogTrigger() {
          window._rjRaceWatchdogId = null;
          
          // Si la course est déjà finalisée proprement, on ne fait rien
          if (typeof LIVE_RACE === "undefined" || !LIVE_RACE) return;
          if (LIVE_RACE.finished) return;

          // Le délai se compte en temps réel : les pauses de décision s'y ajoutent.
          // Une course qui avance encore, ou qui attend une réponse, n'est pas
          // bloquée : on reporte, dans la limite de 10 minutes (filet préservé).
          var modale = document.getElementById("live-event-modal");
          var attend = LIVE_RACE.paused && LIVE_RACE.pendingEvent && modale && getComputedStyle(modale).display !== "none";
          if (reports < 40 && (attend || LIVE_RACE.cur !== tourVu)) {
            tourVu = LIVE_RACE.cur;
            reports++;
            window._rjRaceWatchdogId = setTimeout(rjRaceWatchdogTrigger, 15000);
            return;
          }

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
      
    } });
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
