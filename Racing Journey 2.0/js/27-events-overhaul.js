// === Racing Journey: F1 Dreams ===
// Module 27 — Refonte des événements de course
// -----------------------------------------------------------------------------
// Objectif (demande Axel) :
//   1. BEAUCOUP MOINS d'événements qui poppent pendant une course.
//   2. Tous les événements retravaillés : on garde une poignée d'archétypes forts,
//      on supprime les doublons/futilités, on branche de vraies conséquences durables
//      (DNF possible sur une attaque ratée, perte de place définitive, dégâts/rythme
//      sur plusieurs tours, impact confiance/championnat).
//   3. Déclencheurs liés à la safety car / drapeau jaune (restart) intégrés.
//
// Méthode : Option A, module autonome, AUCUN fichier cœur modifié.
//   - On remplace la table globale `CHOICE_RACE_EVENTS` (déclarée en var globale
//     dans 04-race-engine.js, donc accessible/réassignable).
//   - On enveloppe `tryTriggerChoiceRaceEvent` (porte par tour) pour imposer un
//     plafond de course strict + un espacement minimal. Ce plafond couvre AUSSI
//     les événements de crise (CRISIS_EVENTS), qui passent par la même porte.
//   - On enveloppe `resolveLiveEvent` pour attacher les effets relationnels
//     (confiance) des événements d'équipe, sans toucher au moteur.
//
// Réversibilité : la table d'origine est sauvegardée dans
//   window._rjOriginalChoiceEvents ; window._rjEventsOverhaul.restore() la remet.
//
// Schéma de choix honoré par resolveLiveEvent (vérifié dans 04) :
//   text, mods:{player}, difficulty, actionType('attaque'|'defense'|'gestion'|'adaptation'),
//   successMod, brilliantMod, rateMinMod, rateMajMod,
//   posGainOnBrillant, posLossOnRateMaj, posLoss, posGain,
//   paceModOnBrillant{deltaSec,laps,reason}, paceModOnRateMaj{...},
//   tyreDamageOnRateMaj{laps,severity}, chance{fail,failMod,msg,dnf,penalty},
//   dnfOnMaj:true + dnfMsg  (DNF si "Gros raté"), note.
// -----------------------------------------------------------------------------

(function () {
  "use strict";

  var TAG = "[27] Events overhaul";
  if (window._rjEventsOverhaulInstalled) return;

  var KART = ["Karting Junior", "Karting Senior"];
  function isKart() { return KART.indexOf(G && G.cat) >= 0; }

  // ---------------------------------------------------------------------------
  // Helpers de contexte safety car / restart
  // ---------------------------------------------------------------------------
  function neutralActive() {
    return !!(LIVE_RACE && LIVE_RACE._rjNeutral && LIVE_RACE._rjNeutral.active);
  }
  function neutralType() {
    return (LIVE_RACE && LIVE_RACE._rjNeutral && LIVE_RACE._rjNeutral.type) || "";
  }
  // Vrai pendant les ~2 tours qui suivent une fin de neutralisation (le restart).
  function restartWindow() {
    if (!LIVE_RACE || typeof LIVE_RACE._rjLastNeutralEndLap !== "number") return false;
    var d = (LIVE_RACE.cur || 0) - LIVE_RACE._rjLastNeutralEndLap;
    return d >= 0 && d <= 2;
  }
  // Un changement météo est-il en attente (signalé par le moteur) ?
  function weatherPending() {
    return !!(LIVE_RACE && LIVE_RACE._pendingWeatherChange);
  }
  function weatherIsWet() {
    var w = RACE_STATE && RACE_STATE.weather;
    return !!(w && (w.id === "wet" || w.id === "storm"));
  }

  // ---------------------------------------------------------------------------
  // TABLE D'ÉVÉNEMENTS RECONSTRUITE — 7 archétypes, tous à enjeu durable.
  // ---------------------------------------------------------------------------
  function buildEvents() {
    return [

      // ===========================================================================
      // NOUVEAUX ÉVÉNEMENTS (refonte) — situationnels & spécifiques par catégorie.
      // Catégorie/contexte lus via G.cat + helpers (isKart, _pitEnabledForCurrentRace,
      // _isWECRace). La relation à l'écurie passe par `trustDelta` (le seul champ
      // appliqué par resolveRaceEvt pour les events à CHOIX).
      // ===========================================================================

      // Trafic — doubler un attardé (toutes catégories, surpondéré en endurance).
      {
        id: "backmarker_traffic",
        weightFn: function (e) {
          if (e.phase === "depart" || neutralActive() || restartWindow()) return 0;
          if (!e.ahead || e.gapAhead === null || e.gapAhead > 1.6) return 0;
          var endur = (typeof _isWECRace === "function" && _isWECRace()) ? 2.2 : 0.6;
          return (e.phase === "mid" ? 1 : 0.7) * endur;
        },
        gen: function (e) {
          return {
            _rjId: "backmarker_traffic", phase: e.phase, lap: e.lap / e.totalLaps,
            title: "Trafic",
            text: "Tu arrives sur une voiture nettement plus lente à doubler. La fenêtre est étroite \u2014 un mauvais timing peut coûter cher.",
            choices: [
              { text: "Forcer le passage tout de suite",
                mods: { player: 0.02 }, difficulty: 0.5, actionType: "attaque",
                successMod: 0.025, brilliantMod: 0.05, rateMinMod: -0.02, rateMajMod: -0.05,
                posLossOnRateMaj: 1, paceModOnRateMaj: { deltaSec: 0.8, laps: 3, reason: "Accrochage avec l'attardé" },
                note: "Risqué, mais tu ne perds pas de temps" },
              { text: "Attendre une zone propre",
                mods: { player: -0.01 }, difficulty: 0.12, actionType: "gestion",
                successMod: -0.008, brilliantMod: 0, rateMinMod: -0.006, rateMajMod: -0.012,
                note: "Sûr, mais tu perds un peu de temps" }
            ]
          };
        }
      },

      // Alerte mécanique (toutes catégories) — ménager ou pousser (risque DNF).
      {
        id: "mechanical_warning",
        weightFn: function (e) {
          if (e.phase === "depart" || neutralActive()) return 0;
          return e.phase === "late" ? 1.1 : e.phase === "final" ? 0.8 : e.phase === "mid" ? 0.7 : 0;
        },
        gen: function (e) {
          var part = isKart() ? "Le moteur monte en température" : "Le stand voit une alerte sur la voiture";
          return {
            _rjId: "mechanical_warning", phase: e.phase, lap: e.lap / e.totalLaps,
            title: "Alerte mécanique",
            text: part + ". Tu peux lever le pied pour préserver, ou continuer à pousser en prenant le risque.",
            choices: [
              { text: "Lever le pied et préserver la voiture",
                mods: { player: -0.02 }, difficulty: 0.1, actionType: "gestion",
                successMod: -0.018, brilliantMod: 0, rateMinMod: -0.01, rateMajMod: -0.015,
                note: "Tu perds du rythme mais tu sécurises l'arrivée" },
              { text: "Continuer à pousser",
                mods: { player: 0.015 }, difficulty: 0.62, actionType: "gestion",
                successMod: 0.015, brilliantMod: 0.03, rateMinMod: -0.03, rateMajMod: -0.09,
                dnfOnMaj: true, dnfMsg: "La mécanique lâche \u2014 abandon.",
                note: "Tu gardes le rythme, mais risque de casse" }
            ]
          };
        }
      },

      // KARTING — bagarre au premier virage (départ / début).
      {
        id: "kart_start_scrap",
        weightFn: function (e) {
          if (!isKart() || neutralActive() || restartWindow()) return 0;
          if (e.phase !== "depart" && e.phase !== "early") return 0;
          if (!e.ahead && !e.behind) return 0;
          return e.phase === "depart" ? 2.0 : 1.0;
        },
        gen: function (e) {
          return {
            _rjId: "kart_start_scrap", phase: e.phase, lap: e.lap / e.totalLaps,
            title: "Bagarre au premier virage",
            text: "Ça se frotte de partout à l'entrée du premier virage. Tu peux tenter de gagner des places dans la mêlée ou assurer.",
            choices: [
              { text: "Plonger dans la mêlée pour gagner des places",
                mods: { player: 0.04 }, difficulty: 0.6, actionType: "attaque",
                successMod: 0.04, brilliantMod: 0.07, rateMinMod: -0.025, rateMajMod: -0.06,
                posGainOnBrillant: 2, posLossOnRateMaj: 1,
                note: "Gros gain possible, gros risque de contact" },
              { text: "Rester propre et garder ta trajectoire",
                mods: { player: 0.005 }, difficulty: 0.15, actionType: "gestion",
                successMod: 0.005, brilliantMod: 0.02, rateMinMod: -0.008, rateMajMod: -0.015,
                note: "Tu évites les ennuis du premier tour" }
            ]
          };
        }
      },

      // STRATÉGIE PIT — fenêtre d'undercut (catégories à arrêt obligatoire).
      {
        id: "pit_undercut",
        weightFn: function (e) {
          if (typeof _pitEnabledForCurrentRace === "function" && !_pitEnabledForCurrentRace()) return 0;
          if ((e.phase !== "mid" && e.phase !== "late") || neutralActive() || restartWindow()) return 0;
          return e.phase === "mid" ? 1.4 : 1.0;
        },
        gen: function (e) {
          return {
            _rjId: "pit_undercut", phase: e.phase, lap: e.lap / e.totalLaps,
            title: "Fenêtre d'arrêt",
            text: "Un concurrent direct vient de rentrer au stand. Tu réponds tout de suite pour l'undercut, ou tu restes en piste pour l'overcut ?",
            choices: [
              { text: "Rentrer maintenant \u2014 jouer l'undercut",
                mods: { player: 0.03 }, difficulty: 0.4, actionType: "gestion",
                successMod: 0.03, brilliantMod: 0.06, rateMinMod: -0.02, rateMajMod: -0.04,
                posGainOnBrillant: 1, _doPit: true,
                note: "Pneus neufs, mais tu peux ressortir dans le trafic" },
              { text: "Rester en piste \u2014 tenter l'overcut",
                mods: { player: 0.01 }, difficulty: 0.45, actionType: "gestion",
                successMod: 0.02, brilliantMod: 0.05, rateMinMod: -0.025, rateMajMod: -0.05,
                tyreDamageOnRateMaj: { laps: 3, severity: "minor" },
                note: "Tu gardes l'air libre si tes pneus tiennent" }
            ]
          };
        }
      },

      // CARBURANT — consigne d'économie (WEC / F1 / IndyCar). Relation équipe en jeu.
      {
        id: "fuel_save_order",
        weightFn: function (e) {
          var fuelCat = G && (G.cat === "Endurance WEC" || G.cat === "Formule 1" || G.cat === "IndyCar");
          if (!fuelCat || (e.phase !== "mid" && e.phase !== "late") || neutralActive()) return 0;
          var team = G && G.currentTeam && G.currentTeam !== "Indépendant";
          return team ? (e.phase === "late" ? 1.2 : 0.9) : 0;
        },
        gen: function (e) {
          return {
            _rjId: "fuel_save_order", phase: e.phase, lap: e.lap / e.totalLaps,
            title: "Consigne carburant",
            text: "Radio du stand : « On est short en carburant, il faut lever-décélérer pour rallier l'arrivée. » Tu respectes la cible ?",
            choices: [
              { text: "Respecter la cible \u2014 lever-décélérer",
                mods: { player: -0.02 }, difficulty: 0.1, actionType: "gestion",
                successMod: -0.018, brilliantMod: 0, rateMinMod: -0.008, rateMajMod: -0.012,
                trustDelta: 6,
                note: "Tu perds du rythme mais tu joues l'équipe (+ confiance)" },
              { text: "Ignorer et continuer à pousser",
                mods: { player: 0.02 }, difficulty: 0.5, actionType: "gestion",
                successMod: 0.02, brilliantMod: 0.035, rateMinMod: -0.02, rateMajMod: -0.06,
                trustDelta: -10,
                note: "Tu gardes le rythme mais l'équipe n'apprécie pas (\u2212 confiance)" }
            ]
          };
        }
      },

      // ENDURANCE WEC — double relais sur pneus usés.
      {
        id: "endurance_double_stint",
        weightFn: function (e) {
          if (typeof _isWECRace !== "function" || !_isWECRace()) return 0;
          if ((e.phase !== "mid" && e.phase !== "late") || neutralActive()) return 0;
          return 1.0;
        },
        gen: function (e) {
          return {
            _rjId: "endurance_double_stint", phase: e.phase, lap: e.lap / e.totalLaps,
            title: "Double relais ?",
            text: "L'équipe propose d'enchaîner un double relais sur les mêmes pneus pour gagner de la position en piste. Risqué en fin de relais.",
            choices: [
              { text: "Enchaîner le double relais",
                mods: { player: 0.02 }, difficulty: 0.45, actionType: "gestion",
                successMod: 0.025, brilliantMod: 0.05, rateMinMod: -0.025, rateMajMod: -0.05,
                posGainOnBrillant: 1, tyreDamageOnRateMaj: { laps: 5, severity: "major" }, trustDelta: 3,
                note: "Position gagnée si les pneus tiennent" },
              { text: "Rentrer comme prévu",
                mods: { player: 0 }, difficulty: 0.1, actionType: "gestion",
                successMod: 0, brilliantMod: 0.01, rateMinMod: -0.005, rateMajMod: -0.01,
                note: "Sûr, relais normal" }
            ]
          };
        }
      },

      // ÉQUIPE — sacrifice pour le coéquipier (rare, fin de course, coéquipier juste derrière).
      {
        id: "team_sacrifice",
        weightFn: function (e) {
          var team = G && G.currentTeam && G.currentTeam !== "Indépendant";
          if (!team || (e.phase !== "late" && e.phase !== "final") || neutralActive() || restartWindow()) return 0;
          var p = LIVE_RACE.drivers && LIVE_RACE.drivers.find(function (d) { return d.isPlayer; });
          var mate = LIVE_RACE.drivers && LIVE_RACE.drivers.find(function (d) { return !d.isPlayer && !d.dnf && d.team === G.currentTeam; });
          if (!p || !mate || mate.pos < p.pos || (mate.pos - p.pos) > 2) return 0;
          return 0.6; // rare
        },
        gen: function (e) {
          var mate = LIVE_RACE.drivers.find(function (d) { return !d.isPlayer && !d.dnf && d.team === G.currentTeam; });
          return {
            _rjId: "team_sacrifice", phase: e.phase, lap: e.lap / e.totalLaps,
            title: "Ordre d'équipe \u2014 enjeu de championnat",
            text: "Radio du stand : « " + (mate ? mate.name : "Ton coéquipier") + " joue gros au championnat. On te demande de lui céder la position. » Décision lourde.",
            choices: [
              { text: "Céder la position pour l'équipe",
                mods: { player: -0.03 }, difficulty: 0.08, actionType: "gestion",
                successMod: -0.03, brilliantMod: 0, rateMinMod: -0.02, rateMajMod: -0.025,
                posLoss: 1, trustDelta: 12,
                note: "Tu te sacrifies (++ confiance équipe)" },
              { text: "Refuser \u2014 c'est ta course",
                mods: { player: 0.015 }, difficulty: 0.35, actionType: "defense",
                successMod: 0.015, brilliantMod: 0.03, rateMinMod: -0.015, rateMajMod: -0.035,
                trustDelta: -15,
                note: "Tu gardes ta place (\u2212\u2212 confiance équipe)" }
            ]
          };
        }
      },

      // 1) PARI DE DÉPASSEMENT — fusionne dépassement / duel leader / duels karting / train DRS.
      //    L'attaque à fond porte un VRAI risque de contact (DNF) et d'aileron cassé (rythme).
      {
        id: "overtake_gamble",
        weightFn: function (e) {
          if (!e.ahead || e.phase === "depart") return 0;
          if (neutralActive() || restartWindow()) return 0; // géré par sc_restart
          var gap = e.gapAhead;
          if (gap === null) return 0;
          var maxGap = isKart() ? 2.2 : 1.4;
          if (gap > maxGap) return 0;
          var prox = gap < 0.5 ? 1 : gap < 1 ? 0.7 : 0.4;
          var phaseW = e.phase === "late" ? 2.4 : e.phase === "final" ? 2.0 : 1.4;
          var kart = isKart() ? 1.4 : 1;
          return phaseW * prox * kart;
        },
        gen: function (e) {
          var tgt = e.ahead;
          var isRiv = e.isRival && e.isRival(tgt);
          var tag = isRiv ? " — ton rival direct" : "";
          var gapStr = e.gapAhead !== null ? e.gapAhead.toFixed(1) + "s" : "";
          var crashMsg = isKart()
            ? "Tu plonges trop tard, accrochage à la corde — tu pars en tête-à-queue, course finie."
            : "Tu plonges trop tard, roue contre roue — contact, aileron arraché et tête-à-queue. Abandon.";
          return {
            _rjId: "overtake_gamble",
            phase: e.phase, lap: e.lap / e.totalLaps,
            title: "Fenêtre de dépassement",
            text: function () {
              return "Tu es dans les échappements de <strong>" + tgt.name + "</strong>" + tag +
                " (" + gapStr + "). La zone de freinage arrive. C'est le moment d'attaquer — ou pas.";
            },
            choices: [
              {
                text: "Plonger à l'intérieur — tout pour la place",
                mods: { player: 0.05 }, difficulty: 0.68, actionType: "attaque",
                successMod: 0.05, brilliantMod: 0.09, rateMinMod: -0.03, rateMajMod: -0.08,
                posGainOnBrillant: 1,
                posLossOnRateMaj: 1,
                paceModOnRateMaj: { deltaSec: 1.2, laps: 5, reason: "Aileron touché — la voiture ne tourne plus" },
                tyreDamageOnRateMaj: { laps: 4, severity: "minor" },
                dnfOnMaj: true, dnfMsg: crashMsg,
                note: "Va-tout — risque de contact / DNF"
              },
              {
                text: "Attaque propre en sortie de virage",
                mods: { player: 0.03 }, difficulty: 0.48, actionType: "attaque",
                successMod: 0.03, brilliantMod: 0.06, rateMinMod: -0.018, rateMajMod: -0.05,
                posGainOnBrillant: 1,
                paceModOnRateMaj: { deltaSec: 0.5, laps: 3, reason: "Sortie large — tu perds le rythme un moment" },
                note: "Dépassement maîtrisé"
              },
              {
                text: "Patienter et soigner ses pneus",
                mods: { player: 0 }, difficulty: 0.12, actionType: "gestion",
                successMod: 0, brilliantMod: 0.02, rateMinMod: -0.006, rateMajMod: -0.012,
                paceModOnBrillant: { deltaSec: -0.25, laps: 4, reason: "Pneus préservés — tu reviendras plus fort" },
                note: "Tu temporises"
              }
            ]
          };
        }
      },

      // 2) DÉFENSE SOUS PRESSION — fusionne défense / rival agressif.
      //    Le blocage dur peut finir en contact (pénalité + place perdue) ; céder = sûr mais coûteux.
      {
        id: "defend_position",
        weightFn: function (e) {
          if (!e.behind || e.phase === "depart") return 0;
          if (neutralActive() || restartWindow()) return 0;
          var gap = e.gapBehind;
          if (gap === null) return 0;
          var maxGap = isKart() ? 1.8 : 1.2;
          if (gap > maxGap) return 0;
          var prox = gap < 0.5 ? 1 : gap < 1 ? 0.6 : 0.35;
          var phaseW = e.phase === "late" ? 2.2 : e.phase === "final" ? 1.8 : 1.2;
          return phaseW * prox;
        },
        gen: function (e) {
          var tgt = e.behind;
          var isRiv = e.isRival && e.isRival(tgt);
          var tag = isRiv ? " — ton rival" : "";
          return {
            _rjId: "defend_position",
            phase: e.phase, lap: e.lap / e.totalLaps,
            title: "Sous attaque",
            text: function () {
              return "<strong>" + tgt.name + "</strong>" + tag + " est collé à ton aileron et plus rapide. " +
                "Il va tenter sa chance. Comment tu défends ?";
            },
            choices: [
              {
                text: "Fermer la porte au dernier moment",
                mods: { player: 0.035 }, difficulty: 0.6, actionType: "defense",
                successMod: 0.035, brilliantMod: 0.06, rateMinMod: -0.02, rateMajMod: -0.06,
                posLossOnRateMaj: 1,
                chance: { fail: 0.14, failMod: -0.04, penalty: 5, msg: "Manœuvre limite à la défense — 5s de pénalité" },
                note: "Défense agressive — risque de pénalité"
              },
              {
                text: "Défendre proprement la trajectoire",
                mods: { player: 0.015 }, difficulty: 0.32, actionType: "defense",
                successMod: 0.015, brilliantMod: 0.035, rateMinMod: -0.012, rateMajMod: -0.03,
                note: "Défense maîtrisée"
              },
              {
                text: "Le laisser passer et préserver la voiture",
                mods: { player: -0.02 }, difficulty: 0.06, actionType: "gestion",
                successMod: -0.02, brilliantMod: 0, rateMinMod: -0.02, rateMajMod: -0.03,
                posLoss: 1,
                paceModOnBrillant: { deltaSec: -0.3, laps: 5, reason: "Pneus et nerfs préservés" },
                note: "Tu cèdes la place mais tu restes au contact"
              }
            ]
          };
        }
      },

      // 3) PIVOT STRATÉGIQUE — fusionne dilemme pneus / undercut / essence / fenêtre pit.
      //    Le seul vrai embranchement qui rebat la fin de course. Boosté juste après un restart.
      {
        id: "strategy_pivot",
        weightFn: function (e) {
          if (e.phase === "depart" || neutralActive()) return 0;
          var base = e.phase === "late" ? 2.0 : e.phase === "final" ? 1.2 : e.phase === "mid" ? 1.0 : 0;
          if (base === 0) return 0;
          if (restartWindow()) base += 1.5; // fenêtre d'arrêt « gratuite »
          return base;
        },
        gen: function (e) {
          var ahead = e.ahead ? "<strong>" + e.ahead.name + "</strong> est à portée devant" : "tu es en bagarre pour la position";
          var restart = restartWindow();
          return {
            _rjId: "strategy_pivot",
            phase: e.phase, lap: e.lap / e.totalLaps,
            title: restart ? "Fenêtre stratégique — restart" : "Décision de stratégie",
            text: function () {
              return (restart
                ? "La course vient de repartir et la fenêtre d'arrêt est ouverte. "
                : "Tes pneus entament leur seconde vie et ") +
                ahead + ". L'ingénieur attend ta décision pour la fin de course.";
            },
            choices: [
              {
                text: "Tout sortir maintenant — pousser à fond",
                mods: { player: 0.025 }, difficulty: 0.62, actionType: "gestion",
                successMod: 0.025, brilliantMod: 0.05, rateMinMod: -0.02, rateMajMod: -0.055,
                paceModOnBrillant: { deltaSec: -0.5, laps: 4, reason: "Relais offensif réussi — tu fais l'écart" },
                paceModOnRateMaj: { deltaSec: 1.3, laps: 6, reason: "Tu as cramé les pneus — chute de rythme" },
                tyreDamageOnRateMaj: { laps: 6, severity: "major" },
                note: "Pari offensif — gros gain ou falaise de dégradation"
              },
              {
                text: "Gérer et étirer le relais",
                mods: { player: 0.005 }, difficulty: 0.18, actionType: "gestion",
                successMod: 0.005, brilliantMod: 0.025, rateMinMod: -0.006, rateMajMod: -0.015,
                paceModOnBrillant: { deltaSec: -0.25, laps: 6, reason: "Gestion parfaite — pneus encore frais en fin de course" },
                note: "Relais sécurisé"
              }
            ]
          };
        }
      },

      // 4) COUP MÉTÉO — fusionne gouttes de pluie / fenêtre météo / dilemme slick-pluie.
      //    Ne se déclenche que quand un changement météo est réellement en attente.
      {
        id: "weather_call",
        weightFn: function (e) {
          if (!weatherPending() || neutralActive()) return 0;
          return 3.5; // rare par nature, mais prioritaire quand ça arrive
        },
        gen: function (e) {
          var wc = LIVE_RACE._pendingWeatherChange || {};
          var toRain = wc.to === "wet" || wc.to === "storm";
          var storm = wc.to === "storm";
          var wet = weatherIsWet();
          var dnfMsg = "Aquaplaning sur le mauvais pneu — tu pars dans le mur. Abandon.";
          return {
            _rjId: "weather_call",
            _isWeatherEvent: true,
            phase: e.phase, lap: e.lap / e.totalLaps,
            title: toRain ? "La pluie arrive" : "La piste sèche",
            text: function () {
              return toRain
                ? "Premières gouttes" + (storm ? " — et ça va tomber fort" : "") +
                  ". La piste va changer dans les prochains tours. Tu joues comment ?"
                : "La piste commence à sécher. Rester en pneus pluie va te coûter cher bientôt. Tu fais quoi ?";
            },
            choices: [
              {
                text: "Rentrer changer de pneus maintenant",
                _weatherStrategy: "pit", _doPit: true,
                mods: { player: 0.015 }, difficulty: 0.25, actionType: "adaptation",
                successMod: 0.015, brilliantMod: 0.045, rateMinMod: -0.01, rateMajMod: -0.025,
                paceModOnBrillant: { deltaSec: -0.6, laps: 5, reason: "Timing parfait — bon pneu au bon moment" },
                note: "Décision tranchée"
              },
              {
                text: "Parier un tour de plus sur ces pneus",
                _weatherStrategy: storm ? "stay" : "push",
                mods: { player: 0.02 }, difficulty: storm ? 0.7 : 0.55, actionType: "adaptation",
                successMod: 0.02, brilliantMod: 0.07, rateMinMod: -0.025, rateMajMod: -0.07,
                posGainOnBrillant: 1,
                posLossOnRateMaj: storm ? 2 : 1,
                paceModOnRateMaj: { deltaSec: 1.5, laps: 5, reason: "Mauvais pneu sur piste changeante — tu glisses partout" },
                dnfOnMaj: storm ? true : false, dnfMsg: dnfMsg,
                note: storm ? "Pari risqué — possible sortie / DNF" : "Pari sur le bon timing"
              },
              {
                text: "Copier la stratégie de ton équipe / ton coéquipier",
                _weatherStrategy: toRain ? "stay" : "stay",
                mods: { player: 0.005 }, difficulty: 0.15, actionType: "gestion",
                successMod: 0.005, brilliantMod: 0.02, rateMinMod: -0.006, rateMajMod: -0.015,
                note: "Tu joues la sécurité"
              }
            ]
          };
        }
      },

      // 5) RESTART SAFETY CAR / DRAPEAU — déclencheur lié à la neutralisation.
      //    Apparaît dans la fenêtre qui suit une fin de SC/VSC/RF.
      {
        id: "sc_restart",
        weightFn: function (e) {
          if (!restartWindow() || neutralActive()) return 0;
          return 4.0;
        },
        gen: function (e) {
          var t = neutralType();
          var label = t === "rf" ? "drapeau rouge" : t === "vsc" ? "Virtual Safety Car" : "Safety Car";
          var ahead = e.ahead ? "Tu es derrière <strong>" + e.ahead.name + "</strong>." : "Tu mènes la relance.";
          return {
            _rjId: "sc_restart",
            phase: e.phase, lap: e.lap / e.totalLaps,
            title: "Relance après " + label,
            text: function () {
              return "Les écarts sont regroupés, la course repart. " + ahead +
                " Tout peut se jouer en quelques mètres — comment tu attaques le restart ?";
            },
            choices: [
              {
                text: "Bondir dès l'extinction — surprendre",
                mods: { player: 0.045 }, difficulty: 0.55, actionType: "attaque",
                successMod: 0.045, brilliantMod: 0.075, rateMinMod: -0.025, rateMajMod: -0.06,
                posGainOnBrillant: 1,
                chance: { fail: 0.12, failMod: -0.05, penalty: 5, msg: "Anticipation au restart — 5s de pénalité" },
                paceModOnRateMaj: { deltaSec: 0.7, laps: 3, reason: "Roues qui patinent — tu perds le bénéfice" },
                note: "Restart agressif — risque de pénalité"
              },
              {
                text: "Relance propre et collée",
                mods: { player: 0.012 }, difficulty: 0.25, actionType: "adaptation",
                successMod: 0.012, brilliantMod: 0.03, rateMinMod: -0.008, rateMajMod: -0.02,
                note: "Tu restes dans le sillage"
              },
              {
                text: "Temporiser, laisser les autres se découvrir",
                mods: { player: 0.004 }, difficulty: 0.12, actionType: "gestion",
                successMod: 0.004, brilliantMod: 0.015, rateMinMod: -0.005, rateMajMod: -0.01,
                paceModOnBrillant: { deltaSec: -0.2, laps: 3, reason: "Tu gardes tes pneus pour l'attaque suivante" },
                note: "Patience"
              }
            ]
          };
        }
      },

      // 6) APPEL DE L'ÉQUIPE — fusionne consigne d'équipe / échange coéquipier.
      //    Impact relationnel (confiance) géré dans le wrap de resolveLiveEvent.
      {
        id: "team_call",
        weightFn: function (e) {
          if (e.phase === "depart" || neutralActive() || restartWindow()) return 0;
          var team = G && G.currentTeam && G.currentTeam !== "Indépendant";
          if (!team) return 0;
          // Coéquipier présent dans la course ?
          var p = LIVE_RACE.drivers && LIVE_RACE.drivers.find(function (d) { return d.isPlayer; });
          var mate = LIVE_RACE.drivers && LIVE_RACE.drivers.find(function (d) {
            return !d.isPlayer && !d.dnf && d.team === G.currentTeam;
          });
          if (!p || !mate) return 0;
          var close = Math.abs((mate.pos || 99) - (p.pos || 0)) <= 1;
          if (!close) return 0;
          return e.phase === "late" ? 1.6 : e.phase === "final" ? 1.4 : 0.9;
        },
        gen: function (e) {
          var p = LIVE_RACE.drivers.find(function (d) { return d.isPlayer; });
          var mate = LIVE_RACE.drivers.find(function (d) {
            return !d.isPlayer && !d.dnf && d.team === G.currentTeam;
          });
          var mateAhead = mate && mate.pos < p.pos;
          return {
            _rjId: "team_call",
            phase: e.phase, lap: e.lap / e.totalLaps,
            title: "Consigne d'équipe",
            text: function () {
              return "Radio du stand : <strong>" + (mate ? mate.name : "ton coéquipier") + "</strong> est juste " +
                (mateAhead ? "devant toi" : "derrière toi") + ". " +
                (mateAhead
                  ? "L'équipe te demande de ne pas l'attaquer pour assurer le doublé."
                  : "L'équipe te demande de le laisser passer, il a un meilleur rythme \u2014 laisse-le passer sans te battre.");
            },
            choices: mateAhead ? [
              {
                text: "Respecter la consigne — pas d'attaque",
                mods: { player: 0 }, difficulty: 0.1, actionType: "gestion",
                successMod: 0, brilliantMod: 0.01, rateMinMod: -0.004, rateMajMod: -0.008,
                trustDelta: 6,
                note: "Tu joues collectif (+ confiance équipe)"
              },
              {
                text: "Ignorer et attaquer ton coéquipier",
                mods: { player: 0.03 }, difficulty: 0.55, actionType: "attaque",
                successMod: 0.03, brilliantMod: 0.06, rateMinMod: -0.02, rateMajMod: -0.05,
                posGainOnBrillant: 1, posLossOnRateMaj: 1,
                trustDelta: -10,
                note: "Tu désobéis (− confiance équipe)"
              }
            ] : [
              {
                text: "Le laisser passer comme demandé",
                mods: { player: -0.015 }, difficulty: 0.06, actionType: "gestion",
                successMod: -0.015, brilliantMod: 0, rateMinMod: -0.015, rateMajMod: -0.02,
                posLoss: 1, trustDelta: 6,
                note: "Tu cèdes la place (+ confiance équipe)"
              },
              {
                text: "Refuser et garder ta position",
                mods: { player: 0.01 }, difficulty: 0.3, actionType: "defense",
                successMod: 0.01, brilliantMod: 0.03, rateMinMod: -0.012, rateMajMod: -0.03,
                trustDelta: -10,
                note: "Tu désobéis (− confiance équipe)"
              }
            ]
          };
        }
      },

      // 7) DERNIER TOUR DÉCISIF — duel d'arrivée, tout ou rien.
      {
        id: "final_lap",
        weightFn: function (e) {
          if (e.totalLaps - e.lap > 1) return 0;
          if (neutralActive()) return 0;
          var closeAhead = e.ahead && e.gapAhead !== null && e.gapAhead < 1.8;
          var closeBehind = e.behind && e.gapBehind !== null && e.gapBehind < 1.4;
          if (!closeAhead && !closeBehind) return 0;
          return 4.5;
        },
        gen: function (e) {
          var attack = e.ahead && e.gapAhead !== null && e.gapAhead < 1.8;
          var tgt = attack ? e.ahead : e.behind;
          var gapStr = attack
            ? (e.gapAhead !== null ? e.gapAhead.toFixed(1) + "s devant" : "")
            : (e.gapBehind !== null ? e.gapBehind.toFixed(1) + "s derrière" : "");
          return {
            _rjId: "final_lap",
            phase: "final", lap: e.lap / e.totalLaps,
            title: "Dernier tour — tout se joue",
            text: function () {
              return attack
                ? "Dernier tour ! <strong>" + tgt.name + "</strong> est à " + gapStr +
                  ". Maintenant ou jamais."
                : "Dernier tour ! <strong>" + tgt.name + "</strong> est à " + gapStr +
                  ". Il va tout tenter — tiens bon.";
            },
            choices: attack ? [
              {
                text: "Attaque totale — sans aucune retenue",
                mods: { player: 0.07 }, difficulty: 0.72, actionType: "attaque",
                successMod: 0.07, brilliantMod: 0.1, rateMinMod: -0.035, rateMajMod: -0.09,
                posGainOnBrillant: 1, posLossOnRateMaj: 1,
                dnfOnMaj: true, dnfMsg: "Tu as tout tenté au dernier tour — contact, tête-à-queue. Abandon dans la dernière ligne droite.",
                note: "Tout ou rien — podium ou DNF"
              },
              {
                text: "Coup parfait en zone de freinage",
                mods: { player: 0.04 }, difficulty: 0.52, actionType: "attaque",
                successMod: 0.04, brilliantMod: 0.065, rateMinMod: -0.02, rateMajMod: -0.055,
                posGainOnBrillant: 1,
                note: "Dépassement décisif maîtrisé"
              },
              {
                text: "Sécuriser la position acquise",
                mods: { player: -0.01 }, difficulty: 0.1, actionType: "gestion",
                successMod: -0.01, brilliantMod: 0, rateMinMod: -0.012, rateMajMod: -0.02,
                note: "Tu assures l'arrivée"
              }
            ] : [
              {
                text: "Défense totale — fermer chaque porte",
                mods: { player: 0.04 }, difficulty: 0.62, actionType: "defense",
                successMod: 0.04, brilliantMod: 0.065, rateMinMod: -0.02, rateMajMod: -0.06,
                posLossOnRateMaj: 1,
                note: "Défense à mort"
              },
              {
                text: "Défense propre, sans risque inutile",
                mods: { player: 0.02 }, difficulty: 0.34, actionType: "defense",
                successMod: 0.02, brilliantMod: 0.035, rateMinMod: -0.012, rateMajMod: -0.03,
                note: "Défense maîtrisée"
              }
            ]
          };
        }
      }

    ];
  }

  // ---------------------------------------------------------------------------
  // PLAFOND DE COURSE + ESPACEMENT (la réduction de cadence)
  // ---------------------------------------------------------------------------
  function ensureBudget() {
    if (!LIVE_RACE) return;
    if (typeof LIVE_RACE._rjEvtCap !== "number") {
      var T = LIVE_RACE.total || 20;
      // BEAUCOUP moins qu'avant : 1 événement sur les courses courtes, 2 standard, 3 sur les longues.
      LIVE_RACE._rjEvtCap = T <= 18 ? 1 : T <= 40 ? 2 : 3;
      LIVE_RACE._rjEvtCount = 0;
      LIVE_RACE._rjEvtLastLap = -99;
    }
  }

  function eligibleThisLap() {
    ensureBudget();
    if (!LIVE_RACE) return false;
    if ((LIVE_RACE._rjEvtCount || 0) >= LIVE_RACE._rjEvtCap) return false;

    var T = LIVE_RACE.total || 20;
    var cur = LIVE_RACE.cur || 0;
    var spacing = Math.max(7, Math.round(T * 0.42)); // au moins ~40% de course entre 2 événements
    if (cur - (LIVE_RACE._rjEvtLastLap || -99) < spacing) return false;

    // Fenêtres étroites : restart et dernier tour ne passent pas par le tirage de probabilité
    // (sinon on les raterait), mais respectent quand même plafond + espacement.
    if (restartWindow() || (T - cur) <= 1 || weatherPending()) return true;

    // Pas d'événement dans la toute première portion de course
    var firstWin = Math.max(3, Math.round(T * 0.15));
    if (cur < firstWin) return false;

    // Tirage : une fois éligible, ~35% de chance par tour → timing variable, total sous le plafond
    return Math.random() < 0.20;
  }

  // ---------------------------------------------------------------------------
  // INSTALLATION (bootstrap/retry)
  // ---------------------------------------------------------------------------
  var tries = 0;
  function install() {
    if (window._rjEventsOverhaulInstalled) return;
    if (typeof window.tryTriggerChoiceRaceEvent !== "function" ||
        typeof window.CHOICE_RACE_EVENTS === "undefined") {
      if (tries++ < 120) return void setTimeout(install, 250);
      console.warn(TAG + " : hooks introuvables, abandon.");
      return;
    }

    // 1) Sauvegarde + remplacement de la table
    if (!window._rjOriginalChoiceEvents) {
      window._rjOriginalChoiceEvents = window.CHOICE_RACE_EVENTS;
    }
    window.CHOICE_RACE_EVENTS = buildEvents();

    // 2) Enveloppe de la porte par tour → plafond strict + espacement
    var _origTry = window.tryTriggerChoiceRaceEvent;
    window.tryTriggerChoiceRaceEvent = function () {
      try {
        if (!LIVE_RACE || LIVE_RACE.finished || LIVE_RACE.paused) return;
        if (neutralActive()) return; // pendant une neutralisation, 04m gère sa propre décision
        if (!eligibleThisLap()) return;

        var before = LIVE_RACE.pendingEvent;
        var _evtLenBefore = (typeof RACE_STATE !== "undefined" && RACE_STATE.events) ? RACE_STATE.events.length : 0;
        var ret = _origTry.apply(this, arguments);

        // Un événement a-t-il été armé (choix OU crise) ? → on le compte.
        // ATTENTION : les événements à CHOIX (tryTriggerChoiceRaceEvent → showNextRaceEvent)
        // ne posent JAMAIS LIVE_RACE.pendingEvent ; ils mettent la course en pause et
        // empilent dans RACE_STATE.events. Compter uniquement via pendingEvent ne comptait
        // donc que les crises → plafond + espacement inopérants pour les popups à choix
        // (bug : en karting, popup en boucle et course qui n'avance plus).
        var _evtLenAfter = (typeof RACE_STATE !== "undefined" && RACE_STATE.events) ? RACE_STATE.events.length : 0;
        var _armed = (LIVE_RACE.pendingEvent && LIVE_RACE.pendingEvent !== before)
          || LIVE_RACE.paused
          || (_evtLenAfter > _evtLenBefore);
        if (_armed) {
          LIVE_RACE._rjEvtCount = (LIVE_RACE._rjEvtCount || 0) + 1;
          LIVE_RACE._rjEvtLastLap = LIVE_RACE.cur || 0;
        }
        return ret;
      } catch (err) {
        console.warn(TAG + " (try):", err);
        try { return _origTry.apply(this, arguments); } catch (_e) {}
      }
    };

    // 3) Enveloppe de la résolution → effets relationnels (confiance) des consignes d'équipe
    if (typeof window.resolveLiveEvent === "function") {
      var _origResolve = window.resolveLiveEvent;
      window.resolveLiveEvent = function (idx) {
        var pe = LIVE_RACE && LIVE_RACE.pendingEvent;
        var rjId = pe && pe._rjId;
        var choice = pe && pe.choices && pe.choices[idx];
        var trustDelta = choice && typeof choice._rjTrust === "number" ? choice._rjTrust : 0;
        var ret = _origResolve.apply(this, arguments);
        try {
          if (trustDelta && typeof changeTrust === "function") {
            var reason = trustDelta > 0 ? "Consigne d'équipe respectée" : "Consigne d'équipe ignorée";
            changeTrust(trustDelta, reason, trustDelta > 0 ? "↑" : "↓");
          }
        } catch (_e) { console.warn(TAG + " (trust):", _e); }
        return ret;
      };
    }

    // 4) API de réversibilité
    window._rjEventsOverhaul = {
      restore: function () {
        if (window._rjOriginalChoiceEvents) {
          window.CHOICE_RACE_EVENTS = window._rjOriginalChoiceEvents;
        }
        window.tryTriggerChoiceRaceEvent = _origTry;
        console.log(TAG + " : table et porte d'origine restaurées.");
      },
      events: window.CHOICE_RACE_EVENTS
    };

    window._rjEventsOverhaulInstalled = true;
    console.log(TAG + " activé — " + window.CHOICE_RACE_EVENTS.length +
      " archétypes, plafond par course 1/2/3 selon longueur, déclencheurs SC/restart inclus.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
  setTimeout(install, 400);
})();
