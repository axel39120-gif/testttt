/* =============================================================================
 * 15-rival-strategy.js — STRATÉGIE RÉACTIVE DE L'IA RIVALE
 * =============================================================================
 *
 * OBJECTIF
 * --------
 * Les rivaux suivaient jusqu'ici un plan d'arrêts FIGÉ (fenêtre tirée au sort
 * en début de course). Ce module les rend RÉACTIFS aux conditions, sans rien
 * réécrire du moteur :
 *
 *   1. UNDERCUT — un rival aux pneus usés, collé à l'arrière d'un pilote
 *      qui n'a pas encore chaussé du neuf, AVANCE son arrêt pour ressortir
 *      devant grâce à la gomme fraîche.
 *
 *   2. OVERCUT — un rival aux pneus encore corrects, attaqué à l'undercut par
 *      la voiture derrière qui vient de s'arrêter, RETARDE son arrêt et pousse
 *      sur son relais pour la repasser au moment de s'arrêter.
 *
 *   3. OPPORTUNISME SOUS NEUTRALISATION — quand la VSC / SC / drapeau rouge
 *      sort, les rivaux qui ont encore un arrêt à faire (ou des pneus entamés)
 *      plongent aux stands pour profiter du coût d'arrêt réduit.
 *
 * COMMENT ÇA MARCHE (Option A — enrichissement sûr)
 * -------------------------------------------------
 *   - On enveloppe `_applyRivalPitsForLap` (appelée 1×/tour par le moteur).
 *   - AVANT l'exécution, on décide les arrêts réactifs en RE-DATANT au tour
 *     courant un arrêt DÉJÀ PLANIFIÉ (jamais d'arrêt « en plus » : on ne fait
 *     qu'optimiser le timing — ou on le repousse pour l'overcut).
 *   - L'arrêt est ensuite exécuté par le moteur d'origine (places perdues,
 *     pneus neufs, log « entre aux stands » : tout est réutilisé tel quel).
 *   - Le gain de l'undercut est naturel (pneus neufs = moins d'usure/tour) ;
 *     on ajoute un léger bonus de pace temporaire via `_evtAddPaceMod` pour
 *     que la manœuvre soit parfois payante, jamais déterministe.
 *
 * SÛRETÉ
 * ------
 *   - Aucun arrêt supplémentaire forcé : on ne re-date que des arrêts prévus.
 *   - Inerte au karting (PIT_CONFIG.enabled = false).
 *   - Plafond d'actions par tour pour éviter une cascade d'arrêts simultanés.
 *   - État purement transitoire (porté par LIVE_RACE) → rien à persister.
 *   - Pattern bootstrap/retry, idempotent, try/catch partout.
 *
 * ORDRE DE CHARGEMENT : après 04 (moteur), 04m (safety car), 04p (stratégie).
 * ===========================================================================*/
(function () {
  'use strict';
  var TAG = '[15-rival-strategy]';

  // Coût d'arrêt résiduel sous neutralisation (mêmes valeurs que 04m, privées
  // à son IIFE) : fraction du temps perdu qui subsiste.
  var NEUTRAL_COST = { vsc: 0.65, sc: 0.30, rf: 0.0 };

  // Réglages de comportement (modérés pour rester crédible, pas chaotique).
  var CFG = {
    maxActionsPerLap: 4,      // plafond d'arrêts/manœuvres réactifs par tour
    undercutTyreLife: 45,     // usure sous laquelle un rival songe à l'undercut
    undercutGapSec: 2.5,      // écart max devant pour tenter l'undercut
    undercutAheadFreshLife: 70, // si la cible a des pneus > ça, undercut inutile
    undercutProb: 0.28,
    undercutPaceBonus: -0.35, // s/tour (négatif = plus rapide) sur pneus neufs
    overcutTyreLife: 55,      // usure au-dessus de laquelle l'overcut est tentable
    overcutProb: 0.30,
    overcutDelayLaps: 3,      // tours de relais prolongé
    overcutPaceBonus: -0.30,
    scWornLife: 60,           // sous SC : usure qui justifie de plonger
    scStopDueWithin: 10,      // ou arrêt prévu dans ≤ N tours
    probNeutral: { sc: 0.70, vsc: 0.45, rf: 0.92 }
  };

  function fn(name) { return typeof window[name] === 'function'; }

  /* ----------------------------------------------------------------------- *
   *  Helpers de lecture de l'état de course
   * ----------------------------------------------------------------------- */
  function lr() { return (typeof window !== 'undefined') ? window.LIVE_RACE : null; }

  function neutralInfo() {
    var L = lr();
    if (L && L._rjNeutral && L._rjNeutral.active) {
      var t = L._rjNeutral.type;
      if (t !== 'vsc' && t !== 'sc' && t !== 'rf') t = 'sc';
      return { type: t, startLap: L._rjNeutral.startLap || 0 };
    }
    return null;
  }

  // Écart en secondes (le moteur : gap = 45 × Δscore ; score haut = devant).
  function gapSec(aheadScore, dScore) { return 45 * (aheadScore - dScore); }

  // Premier arrêt planifié non effectué (qu'on pourra re-dater).
  function nextUndoneStop(d) {
    if (!d._pitsScheduled) return null;
    var best = null;
    d._pitsScheduled.forEach(function (p) {
      if (!p._done && (!best || p.lap < best.lap)) best = p;
    });
    return best;
  }

  function recentlyPitted(d, cur) {
    return typeof d._lastPitLap === 'number' && (cur - d._lastPitLap) <= 2;
  }

  function tyreLife(d) {
    return (typeof d._tyreLife === 'number') ? d._tyreLife : 100;
  }

  function pushPitNote(d, txt, color) {
    var RS = (typeof window !== 'undefined') ? window.RACE_STATE : null;
    var L = lr();
    if (RS && RS.eventsLog && L) {
      RS.eventsLog.push({
        lap: L.cur, phase: 'Tour ' + L.cur,
        text: txt, choice: '—', note: 'Stratégie rivale', sign: '~', color: color || '#A78BFA'
      });
    }
  }

  function addPace(d, delta, laps, reason) {
    if (fn('_evtAddPaceMod')) {
      try { window._evtAddPaceMod(d, delta, laps, reason); } catch (e) { /* no-op */ }
    }
  }

  /* ----------------------------------------------------------------------- *
   *  Décision réactive — exécutée une fois par tour, AVANT les arrêts moteur
   * ----------------------------------------------------------------------- */
  function decideReactivePits() {
    var L = lr();
    if (!L || !L.drivers || !L.drivers.length) return;
    var cur = L.cur, total = L.total || 0;
    if (!cur || cur < 2 || !total) return;

    var cfg = fn('_pitConfigForCat') ? window._pitConfigForCat() : null;
    if (!cfg || !cfg.enabled) return; // karting : inerte

    var neutral = neutralInfo();
    var neutralKey = neutral ? (neutral.type + '@' + neutral.startLap) : null;

    // Ordre de course (score décroissant = de la tête au fond).
    var order = L.drivers.filter(function (d) { return !d.dnf; })
                         .sort(function (a, b) { return (b.score || 0) - (a.score || 0); });

    var actions = 0;

    for (var i = 0; i < order.length && actions < CFG.maxActionsPerLap; i++) {
      var d = order[i];
      if (d.isPlayer || d.dnf || !d._pitsScheduled) continue;
      if (d._td15Lap === cur) continue;           // déjà agi ce tour
      if (recentlyPitted(d, cur)) continue;        // vient de s'arrêter

      var ahead = (i > 0) ? order[i - 1] : null;
      var behind = (i < order.length - 1) ? order[i + 1] : null;
      var ns = nextUndoneStop(d);

      /* ---- 3) OPPORTUNISME SOUS NEUTRALISATION ---- */
      if (neutral) {
        if (ns && d._td15Neutral !== neutralKey) {
          var worn = tyreLife(d) < CFG.scWornLife;
          var dueSoon = (ns.lap - cur) <= CFG.scStopDueWithin;
          if (worn || dueSoon) {
            var prob = CFG.probNeutral[neutral.type] || 0.5;
            if (Math.random() < prob) {
              var baseDur = (cfg.stopTimeMin + cfg.stopTimeMax) / 2;
              ns.lap = cur;
              ns.duration = Math.max(0.4, baseDur * (NEUTRAL_COST[neutral.type]));
              d._td15Neutral = neutralKey;
              d._td15Lap = cur;
              actions++;
            }
          }
        }
        continue; // sous neutralisation, pas d'undercut/overcut « à la régulière »
      }

      /* ---- 1) UNDERCUT ---- */
      var inWindow = (cur > total * 0.25) && (cur < total * 0.85) && ((total - cur) >= 5);
      if (ns && inWindow && tyreLife(d) < CFG.undercutTyreLife && ahead) {
        var gap = gapSec(ahead.score || 0, d.score || 0);
        var aheadFresh = tyreLife(ahead) > CFG.undercutAheadFreshLife;
        if (gap > 0 && gap <= CFG.undercutGapSec && !aheadFresh) {
          if (Math.random() < CFG.undercutProb) {
            ns.lap = cur; // arrêt anticipé, durée normale
            addPace(d, CFG.undercutPaceBonus, 3, 'Undercut — pneus neufs');
            d._td15Lap = cur;
            actions++;
            pushPitNote(d, (d.name || 'Un rival') + ' tente l\u2019undercut sur ' + (ahead.name || 'le pilote devant'), '#34D399');
            continue;
          }
        }
      }

      /* ---- 2) OVERCUT (réponse à un undercut de la voiture derrière) ---- */
      if (ns && behind && tyreLife(d) > CFG.overcutTyreLife) {
        var stopImminent = (ns.lap - cur) <= 2;
        var behindJustPitted = typeof behind._lastPitLap === 'number' && (cur - behind._lastPitLap) <= 1;
        if (stopImminent && behindJustPitted && (total - cur) >= (CFG.overcutDelayLaps + 2)) {
          if (Math.random() < CFG.overcutProb) {
            ns.lap = Math.min(total - 2, ns.lap + CFG.overcutDelayLaps + Math.floor(Math.random() * 2));
            addPace(d, CFG.overcutPaceBonus, 3, 'Overcut — relais prolongé');
            d._td15Lap = cur;
            actions++;
            pushPitNote(d, (d.name || 'Un rival') + ' réagit en overcut et reste en piste', '#FBBF24');
            continue;
          }
        }
      }
    }
  }

  /* ----------------------------------------------------------------------- *
   *  Installation : wrap de _applyRivalPitsForLap
   * ----------------------------------------------------------------------- */
  function install() {
    if (!fn('_applyRivalPitsForLap') || window._applyRivalPitsForLap._td15) return false;
    var orig = window._applyRivalPitsForLap;
    window._applyRivalPitsForLap = function () {
      try { decideReactivePits(); } catch (e) { console.warn(TAG, 'décision réactive:', e); }
      return orig.apply(this, arguments);
    };
    window._applyRivalPitsForLap._td15 = true;
    return true;
  }

  function boot(retries) {
    if (typeof window === 'undefined') return;
    if (install()) {
      // Réinstalle une fois après coup, au cas où un autre module re-wrappe.
      setTimeout(install, 1200);
      window.rjDebugRivalStrategy = function () {
        var L = lr();
        if (!L || !L.drivers) { console.log(TAG, 'pas de course en cours'); return; }
        console.log(TAG, 'tour', L.cur + '/' + L.total, 'neutralisation:', neutralInfo());
        L.drivers.filter(function (d) { return !d.isPlayer; }).forEach(function (d) {
          console.log('  ', (d.name || '?'),
            '| pneus', Math.round(tyreLife(d)),
            '| arrêts', (d._pitsDone || 0),
            '| prochain', (nextUndoneStop(d) || {}).lap);
        });
      };
      console.log(TAG, 'activé — undercut / overcut / opportunisme safety car pour l\u2019IA rivale. Debug: rjDebugRivalStrategy()');
      return;
    }
    if (retries > 0) { setTimeout(function () { boot(retries - 1); }, 400); return; }
    console.warn(TAG, 'abandon — _applyRivalPitsForLap introuvable.');
  }

  boot(50);
})();
