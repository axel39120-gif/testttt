/* =============================================================================
 * 04p — RACE STRATEGY (refonte stratégie de course)
 * =============================================================================
 *
 * OBJECTIF
 * --------
 * Refondre la stratégie de course en :
 *   1. Déplaçant le moment du choix : APRÈS la qualif, AVANT le départ
 *   2. Présentant une vraie UI tactique (cartes, pas sliders)
 *   3. Ayant un IMPACT MÉCANIQUE RÉEL sur la simulation
 *
 * 3 CHOIX TACTIQUES :
 *   - Compound de départ : soft / medium / hard / inter / wet (selon météo)
 *   - Nombre d'arrêts planifiés : 0 / 1 / 2 / 3
 *   - Style de pilotage : attaquer / gérer / défendre
 *
 * IMPACTS :
 *   - Compound choisi → injecté dans rjBuildCarState (au lieu de "medium" hardcodé)
 *   - Style de pilotage → modulateur sur usure pneus + perf
 *   - Nb d'arrêts → influence le pit-strategy IA pour le joueur
 *
 * EVENT MI-COURSE :
 *   - À mi-course, possibilité de changer de style (radio ingé)
 *
 * HOOKS :
 *   - finishQuali(e, t) → après qualif, ouvrir modal stratégie
 *   - rjBuildCarState(d, isPlayer, w) → utiliser G._raceStrategy.startCompound
 *   - rjUpdateTyresForLap → modulateur usure selon style
 *   - tickRace ou similaire → trigger event radio à mi-course
 *
 * ORDRE DE CHARGEMENT :
 *   - Doit charger APRÈS 04b (rjBuildCarState), 04c (tyre model)
 *   - Doit charger APRÈS 04 (finishQuali, runRaceLive)
 *   - Place naturelle : à la fin (après 04n)
 *
 * COMPATIBILITÉ :
 *   - L'ancien G.strat (string) reste mais devient dérivé du style choisi
 *   - L'ancien G.stratAdv (sliders) est conservé pour compat mais ignoré pour la stratégie
 *   - Le strat-feedback dans rt-prep est masqué
 *
 * ===========================================================================*/

(function() {
  'use strict';

  if (typeof window === 'undefined') return;

  // ========================================================================
  // 1. CONFIGURATION DES COMPOUNDS / STYLES / ARRÊTS
  // ========================================================================

  // Compounds disponibles selon météo
  // wet/storm : wet seulement (et inter en backup)
  // (futur : "humide" entre les deux)
  var COMPOUND_DEFS = {
    soft: {
      id:        "soft",
      label:     "Tendre",
      shortLabel:"Soft",
      color:     "#EF4444",
      icon:      "🔴",
      bandColor: "#EF4444",
      desc:      "Grip max, usure rapide",
      stintDesc: "Stint court, pace rapide",
      // Multiplicateurs pour estimation longueur stint
      stintMod:  0.65, // un stint moyen sur ce compound vs medium
      gripMod:   1.06,
      wetOnly:   false,
      dryOnly:   true
    },
    medium: {
      id:        "medium",
      label:     "Médium",
      shortLabel:"Medium",
      color:     "#F59E0B",
      icon:      "🟡",
      bandColor: "#F59E0B",
      desc:      "Polyvalent, équilibré",
      stintDesc: "Stint moyen, bon compromis",
      stintMod:  1.0,
      gripMod:   1.0,
      wetOnly:   false,
      dryOnly:   true
    },
    hard: {
      id:        "hard",
      label:     "Dur",
      shortLabel:"Hard",
      color:     "#E5E7EB",
      icon:      "⚪",
      bandColor: "#9CA3AF",
      desc:      "Durable, grip réduit",
      stintDesc: "Stint long, pace mesuré",
      stintMod:  1.45,
      gripMod:   0.94,
      wetOnly:   false,
      dryOnly:   true
    },
    inter: {
      id:        "inter",
      label:     "Intermédiaire",
      shortLabel:"Inter",
      color:     "#22C55E",
      icon:      "🟢",
      bandColor: "#22C55E",
      desc:      "Pluie légère, piste humide",
      stintDesc: "Si la pluie s'arrête, à changer vite",
      stintMod:  1.0,
      gripMod:   0.95,
      wetOnly:   true,  // disponible en wet conditions
      dryOnly:   false
    },
    wet: {
      id:        "wet",
      label:     "Pluie",
      shortLabel:"Wet",
      color:     "#3B82F6",
      icon:      "🔵",
      bandColor: "#3B82F6",
      desc:      "Pluie battante uniquement",
      stintDesc: "Sécurité maximum sous l'eau",
      stintMod:  1.1,
      gripMod:   0.92,
      wetOnly:   true,
      dryOnly:   false
    }
  };

  // Styles de pilotage
  var STYLE_DEFS = {
    attack: {
      id:           "attack",
      label:        "Attaquer",
      icon:         "⚡",
      color:        "#EF4444",
      desc:         "Pace agressif, dépassements forcés",
      detail:       "Gain de pace mais usure pneus accrue et risque d'erreur plus élevé.",
      // Mécanique :
      tyreWearMult: 1.30,   // +30% usure
      perfBonus:    0.018,  // +1.8% perf brute
      mistakeMult:  1.50,   // +50% risque erreur (utilisé par 04e si dispo)
      // Mapping vers ancien G.strat
      legacyStrat:  "attack"
    },
    manage: {
      id:           "manage",
      label:        "Gérer",
      icon:         "◉",
      color:        "#3B82F6",
      desc:         "Rythme stable, gestion pneus",
      detail:       "Équilibre attaque/défense, usure normale, peu de variance.",
      tyreWearMult: 1.00,
      perfBonus:    0.0,
      mistakeMult:  1.0,
      legacyStrat:  "manage"
    },
    defend: {
      id:           "defend",
      label:        "Défendre",
      icon:         "🛡",
      color:        "#22C55E",
      desc:         "Conservateur, position avant tout",
      detail:       "Pace réduite mais pneus préservés et très peu de risque d'erreur.",
      tyreWearMult: 0.75,   // -25% usure
      perfBonus:    -0.012, // -1.2% perf brute
      mistakeMult:  0.65,
      legacyStrat:  "defend"
    }
  };

  // Recommandations nb d'arrêts selon catégorie / circuit
  function recommendStops(cat, weather, lapsCount) {
    if (!cat) return 1;
    // Pas de pit stops en karting
    if (cat === "Karting Junior" || cat === "Karting Senior") return 0;
    // Endurance : beaucoup d'arrêts
    if (cat === "Endurance WEC") return 3;
    // Pluie battante : 2 stops typique (changement compounds)
    if (weather && (weather.id === "storm" || weather.id === "wet")) return 2;
    // F4/FR/F3/F2 : 1 stop typique
    if (cat === "Formule 4" || cat === "Formula Regional" || cat === "Formule 3" || cat === "Formule 2") return 1;
    // F1 / IndyCar / SF : 1-2 selon longueur
    if (lapsCount && lapsCount > 60) return 2;
    return 1;
  }

  // Compounds disponibles selon météo
  function availableCompounds(weather) {
    var w = weather && weather.id ? weather.id : "dry";
    if (w === "storm") return ["wet"];                 // pluie battante : wet only
    if (w === "wet")   return ["inter", "wet"];        // humide : inter ou wet
    // Sinon (dry/hot/cloudy) : tous secs
    return ["soft", "medium", "hard"];
  }

  // ========================================================================
  // 2. STRUCTURE STRATÉGIE
  // ========================================================================

  // G._raceStrategy = {
  //   startCompound: "medium",
  //   plannedStops:  1,
  //   style:         "manage",
  //   midRaceStyleChange: false,
  //   eventTriggered: false,
  //   committed:     true   // validée pour cette course
  // }

  function getDefaultStrategy() {
    var weather = (typeof RACE_STATE !== "undefined" && RACE_STATE && RACE_STATE.weather) ? RACE_STATE.weather : null;
    var compounds = availableCompounds(weather);
    var defaultCompound = "medium";
    if (compounds.indexOf("medium") < 0) defaultCompound = compounds[0];
    var cat = (typeof G !== "undefined" && G) ? G.cat : null;
    var stops = recommendStops(cat, weather, null);

    return {
      startCompound:      defaultCompound,
      plannedStops:       stops,
      style:              "manage",
      midRaceStyleChange: false,
      eventTriggered:     false,
      committed:          false
    };
  }

  function getCurrentStrategy() {
    if (typeof G === "undefined" || !G) return null;
    if (!G._raceStrategy) {
      G._raceStrategy = getDefaultStrategy();
    }
    return G._raceStrategy;
  }

  function setStrategyField(field, value) {
    var s = getCurrentStrategy();
    if (!s) return;
    s[field] = value;
    // Sync legacy G.strat (string utilisé ailleurs)
    if (field === "style") {
      var styleDef = STYLE_DEFS[value];
      if (styleDef && typeof G !== "undefined") {
        G.strat = styleDef.legacyStrat;
      }
    }
    // Met à jour l'UI si modal ouvert
    try { renderStrategyModal(); } catch(e) {}
  }

  function commitStrategy() {
    var s = getCurrentStrategy();
    if (!s) return;
    s.committed = true;
    s.eventTriggered = false; // reset pour cette course
    // Sync legacy
    if (typeof G !== "undefined") {
      var styleDef = STYLE_DEFS[s.style];
      if (styleDef) G.strat = styleDef.legacyStrat;
    }
  }

  // Reset à appeler en début de week-end (avant qualif)
  function resetRaceStrategy() {
    if (typeof G !== "undefined") {
      G._raceStrategy = getDefaultStrategy();
    }
  }

  // Expose internals
  window._RJ_STRAT_CONFIG = {
    COMPOUND_DEFS:      COMPOUND_DEFS,
    STYLE_DEFS:         STYLE_DEFS,
    availableCompounds: availableCompounds,
    recommendStops:     recommendStops,
    getDefaultStrategy: getDefaultStrategy,
    getCurrentStrategy: getCurrentStrategy,
    setStrategyField:   setStrategyField,
    commitStrategy:     commitStrategy,
    resetRaceStrategy:  resetRaceStrategy
  };

  console.log("[04p] Strategy config loaded");

})();

/* =============================================================================
 * 04p — PART 2 : UI MODAL
 * =============================================================================*/

(function() {
  'use strict';
  if (typeof window === 'undefined') return;
  if (!window._RJ_STRAT_CONFIG) {
    console.error("[04p] CONFIG missing, abort UI module");
    return;
  }

  var CFG = window._RJ_STRAT_CONFIG;
  var COMPOUND_DEFS = CFG.COMPOUND_DEFS;
  var STYLE_DEFS = CFG.STYLE_DEFS;

  // ==========================================================================
  // ID modal et helpers
  // ==========================================================================

  var MODAL_ID = "race-strategy-modal";

  function escHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getQualiPos() {
    if (typeof RACE_STATE !== "undefined" && RACE_STATE && typeof RACE_STATE.qualiPos === "number") {
      return RACE_STATE.qualiPos;
    }
    if (typeof G !== "undefined" && G && typeof G.qualiPos === "number") {
      return G.qualiPos;
    }
    return 0;
  }

  function getNbLaps() {
    // Regarde RACE_STATE.lapsCount si dispo
    if (typeof RACE_STATE !== "undefined" && RACE_STATE) {
      if (RACE_STATE.lapsCount) return RACE_STATE.lapsCount;
      if (RACE_STATE.totalLaps) return RACE_STATE.totalLaps;
      if (RACE_STATE.lapsTotal) return RACE_STATE.lapsTotal;
    }
    if (typeof LIVE_RACE !== "undefined" && LIVE_RACE && LIVE_RACE.totalLaps) {
      return LIVE_RACE.totalLaps;
    }
    return 30; // fallback
  }

  function getCircuit() {
    if (typeof RACE_STATE !== "undefined" && RACE_STATE && RACE_STATE.circuit) return RACE_STATE.circuit;
    return "";
  }

  function getWeather() {
    if (typeof RACE_STATE !== "undefined" && RACE_STATE && RACE_STATE.weather) return RACE_STATE.weather;
    return null;
  }

  // ==========================================================================
  // CRÉATION DU MODAL (DOM)
  // ==========================================================================

  function ensureModalDom() {
    var modal = document.getElementById(MODAL_ID);
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = MODAL_ID;
    modal.style.cssText = [
      "display:none",
      "position:fixed",
      "inset:0",
      "z-index:300",
      "background:rgba(0,0,0,0.92)",
      "backdrop-filter:blur(6px)",
      "-webkit-backdrop-filter:blur(6px)",
      "overflow-y:auto",
      "padding:0"
    ].join(";");
    modal.innerHTML = '<div id="rsm-content" style="width:100%;min-height:100%;display:flex;flex-direction:column;background:linear-gradient(180deg,#0d0d14 0%,#0a0a10 100%)"></div>';
    document.body.appendChild(modal);
    return modal;
  }

  // ==========================================================================
  // RENDER : COMPOUND CARDS
  // ==========================================================================

  function renderCompoundSection() {
    var s = CFG.getCurrentStrategy();
    // Karting : pas de choix de composé (pneu unique imposé par la météo).
    var _kc = (typeof G !== "undefined" && G) ? G.cat : null;
    if (_kc === "Karting Junior" || _kc === "Karting Senior") {
      return '<div style="padding:14px 16px 10px"><div style="font-family:var(--font-display);font-size:11px;font-weight:800;color:#9CA3AF;letter-spacing:.14em;text-transform:uppercase;margin-bottom:6px">Strat\u00e9gie karting</div><div style="font-size:11px;color:#6B7280;line-height:1.45">En karting : aucun arr\u00eat au stand et un pneu unique. Le pneu (sec ou pluie) s\u2019adapte automatiquement \u00e0 la m\u00e9t\u00e9o \u2014 seul ton style de pilotage se choisit ci-dessous.</div></div>';
    }
    var weather = getWeather();
    var available = CFG.availableCompounds(weather);
    var html = '<div style="padding:14px 16px 6px"><div style="font-family:var(--font-display);font-size:11px;font-weight:800;color:#9CA3AF;letter-spacing:.14em;text-transform:uppercase;margin-bottom:6px">Choix 1 · Compound de départ</div><div style="font-size:11px;color:#6B7280;line-height:1.4;margin-bottom:10px">Le pneu avec lequel tu démarreras la course. Ton choix conditionne la longueur de ton 1er stint.</div></div>';

    html += '<div style="padding:0 16px 16px;display:flex;flex-direction:column;gap:8px">';
    available.forEach(function(cId) {
      var c = COMPOUND_DEFS[cId];
      if (!c) return;
      var sel = (s.startCompound === cId);
      var stintLaps = Math.round(getNbLaps() * 0.5 * c.stintMod);
      // Borne à pas plus que la course
      stintLaps = Math.min(stintLaps, getNbLaps() - 1);
      stintLaps = Math.max(5, stintLaps);

      var bg = sel ? c.color + "22" : "#13131c";
      var border = sel ? c.color : "#252533";
      var glow = sel ? ("box-shadow:0 0 0 1px " + c.color + "55, 0 4px 16px " + c.color + "33;") : "";

      html += '<div onclick="_rjStratPickCompound(\'' + cId + '\')" style="cursor:pointer;-webkit-tap-highlight-color:transparent;padding:14px;background:' + bg + ';border:2px solid ' + border + ';border-radius:12px;transition:all .15s;' + glow + '">';
      html += '<div style="display:flex;align-items:center;gap:12px">';

      // Disque pneu coloré
      html += '<div style="flex-shrink:0;width:46px;height:46px;border-radius:50%;background:radial-gradient(circle at 30% 30%,#fff 0%,#fff 8%,' + c.color + ' 14%,' + c.color + ' 60%,#1a1a1a 75%,#0a0a0a 100%);border:2px solid #000;display:flex;align-items:center;justify-content:center;position:relative">';
      html += '<div style="position:absolute;inset:8px;border-radius:50%;border:1px solid rgba(255,255,255,0.18)"></div>';
      html += '<div style="width:14px;height:14px;border-radius:50%;background:#1a1a1a;border:1px solid rgba(255,255,255,0.15);position:relative;z-index:1"></div>';
      html += '</div>';

      // Texte
      html += '<div style="flex:1;min-width:0">';
      html += '<div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap"><div style="font-family:var(--font-display);font-size:15px;font-weight:900;color:#fff;letter-spacing:.04em;text-transform:uppercase">' + escHtml(c.label) + '</div><div style="font-size:10px;font-weight:700;color:' + c.color + ';letter-spacing:.06em;text-transform:uppercase">' + escHtml(c.shortLabel) + '</div></div>';
      html += '<div style="font-size:11px;color:#9CA3AF;margin-top:2px;line-height:1.3">' + escHtml(c.desc) + '</div>';
      html += '<div style="font-size:11px;color:#D1D5DB;margin-top:4px"><span style="color:#6B7280">Stint estimé :</span> <strong style="color:#fff">~' + stintLaps + ' tours</strong></div>';
      html += '</div>';

      // Indicateur sélection
      if (sel) {
        html += '<div style="flex-shrink:0;width:24px;height:24px;border-radius:50%;background:' + c.color + ';display:flex;align-items:center;justify-content:center;color:#fff"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></div>';
      }
      html += '</div></div>';
    });
    html += '</div>';
    return html;
  }

  // ==========================================================================
  // RENDER : STOPS CARDS
  // ==========================================================================

  function renderStopsSection() {
    var s = CFG.getCurrentStrategy();
    var cat = (typeof G !== "undefined" && G) ? G.cat : null;
    // Karting : aucun arrêt au stand → pas de section.
    if (cat === "Karting Junior" || cat === "Karting Senior") return '';
    var weather = getWeather();
    var nbLaps = getNbLaps();
    var rec = CFG.recommendStops(cat, weather, nbLaps);

    var availableStops = [0, 1, 2, 3];
    // Karting : 0 stops only
    if (cat === "Karting Junior" || cat === "Karting Senior") availableStops = [0];
    // Endurance : 2-3
    if (cat === "Endurance WEC") availableStops = [2, 3];

    var html = '<div style="padding:6px 16px 6px"><div style="font-family:var(--font-display);font-size:11px;font-weight:800;color:#9CA3AF;letter-spacing:.14em;text-transform:uppercase;margin-bottom:6px">Choix 2 · Nombre d\'arrêts planifiés</div><div style="font-size:11px;color:#6B7280;line-height:1.4;margin-bottom:10px">Combien de fois tu prévois de t\'arrêter aux stands. Recommandation circuit : <strong style="color:#22D3EE">' + rec + ' arrêt' + (rec > 1 ? 's' : '') + '</strong>.</div></div>';

    html += '<div style="padding:0 16px 16px;display:flex;gap:8px;flex-wrap:wrap">';
    availableStops.forEach(function(n) {
      var sel = (s.plannedStops === n);
      var isRec = (n === rec);

      var bg = sel ? "#3B82F622" : "#13131c";
      var border = sel ? "#3B82F6" : (isRec ? "#22D3EE55" : "#252533");
      var glow = sel ? "box-shadow:0 0 0 1px #3B82F655, 0 4px 16px #3B82F633;" : "";

      var label;
      if (n === 0) label = "0 stop";
      else if (n === 1) label = "1 arrêt";
      else label = n + " arrêts";

      var hint;
      if (n === 0) hint = "Pneus jusqu'au bout";
      else if (n === 1) hint = "Stratégie standard";
      else if (n === 2) hint = "Pace agressif";
      else hint = "Très agressif";

      html += '<div onclick="_rjStratPickStops(' + n + ')" style="flex:1;min-width:80px;cursor:pointer;-webkit-tap-highlight-color:transparent;padding:14px 8px;background:' + bg + ';border:2px solid ' + border + ';border-radius:12px;text-align:center;transition:all .15s;' + glow + '">';
      html += '<div style="font-family:var(--font-display);font-size:22px;font-weight:900;color:' + (sel ? "#3B82F6" : "#fff") + ';line-height:1">' + n + '</div>';
      html += '<div style="font-size:9px;font-weight:700;color:#9CA3AF;letter-spacing:.06em;text-transform:uppercase;margin-top:4px">' + escHtml(label) + '</div>';
      html += '<div style="font-size:10px;color:#6B7280;margin-top:4px;line-height:1.2">' + escHtml(hint) + '</div>';
      if (isRec && !sel) html += '<div style="font-size:9px;font-weight:700;color:#22D3EE;letter-spacing:.06em;text-transform:uppercase;margin-top:4px">Recommandé</div>';
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  // ==========================================================================
  // RENDER : STYLE CARDS
  // ==========================================================================

  function renderStyleSection() {
    var s = CFG.getCurrentStrategy();

    var _ks = (typeof G !== "undefined" && G) ? G.cat : null;
    var _styleTitle = (_ks === "Karting Junior" || _ks === "Karting Senior") ? 'Style de pilotage' : 'Choix 3 \u00b7 Style de pilotage';
    var html = '<div style="padding:6px 16px 6px"><div style="font-family:var(--font-display);font-size:11px;font-weight:800;color:#9CA3AF;letter-spacing:.14em;text-transform:uppercase;margin-bottom:6px">' + _styleTitle + '</div><div style="font-size:11px;color:#6B7280;line-height:1.4;margin-bottom:10px">Comment tu vas piloter pendant la course. Modulera ton usure pneus, ta perf et ton risque d\'erreur.</div></div>';

    html += '<div style="padding:0 16px 16px;display:flex;flex-direction:column;gap:8px">';
    ["attack", "manage", "defend"].forEach(function(styleId) {
      var st = STYLE_DEFS[styleId];
      var sel = (s.style === styleId);

      var bg = sel ? st.color + "22" : "#13131c";
      var border = sel ? st.color : "#252533";
      var glow = sel ? ("box-shadow:0 0 0 1px " + st.color + "55, 0 4px 16px " + st.color + "33;") : "";

      // Indicateurs chiffrés
      var wearTxt = st.tyreWearMult > 1 ? "+" + Math.round((st.tyreWearMult - 1) * 100) + "%" :
                    st.tyreWearMult < 1 ? "−" + Math.round((1 - st.tyreWearMult) * 100) + "%" : "0%";
      var wearColor = st.tyreWearMult > 1 ? "#EF4444" : st.tyreWearMult < 1 ? "#22C55E" : "#9CA3AF";
      var perfTxt = st.perfBonus > 0 ? "+" + (st.perfBonus * 100).toFixed(1) + "%" :
                    st.perfBonus < 0 ? (st.perfBonus * 100).toFixed(1) + "%" : "0%";
      var perfColor = st.perfBonus > 0 ? "#22C55E" : st.perfBonus < 0 ? "#F59E0B" : "#9CA3AF";

      html += '<div onclick="_rjStratPickStyle(\'' + styleId + '\')" style="cursor:pointer;-webkit-tap-highlight-color:transparent;padding:14px;background:' + bg + ';border:2px solid ' + border + ';border-radius:12px;transition:all .15s;' + glow + '">';
      html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">';
      html += '<div style="flex-shrink:0;width:42px;height:42px;border-radius:10px;background:' + st.color + '33;border:1px solid ' + st.color + ';display:flex;align-items:center;justify-content:center;font-size:20px">' + st.icon + '</div>';
      html += '<div style="flex:1;min-width:0">';
      html += '<div style="font-family:var(--font-display);font-size:15px;font-weight:900;color:#fff;letter-spacing:.04em;text-transform:uppercase">' + escHtml(st.label) + '</div>';
      html += '<div style="font-size:11px;color:#9CA3AF;margin-top:2px;line-height:1.3">' + escHtml(st.desc) + '</div>';
      html += '</div>';
      if (sel) {
        html += '<div style="flex-shrink:0;width:24px;height:24px;border-radius:50%;background:' + st.color + ';display:flex;align-items:center;justify-content:center;color:#fff"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></div>';
      }
      html += '</div>';

      // Detail + chiffres
      html += '<div style="font-size:11px;color:#D1D5DB;line-height:1.4;margin-bottom:8px">' + escHtml(st.detail) + '</div>';
      html += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
      html += '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 7px;background:rgba(0,0,0,0.3);border:1px solid #2a2a35;border-radius:5px;font-size:10px;color:#9CA3AF;font-family:var(--font-display);letter-spacing:.05em;text-transform:uppercase">Usure <strong style="color:' + wearColor + '">' + wearTxt + '</strong></span>';
      html += '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 7px;background:rgba(0,0,0,0.3);border:1px solid #2a2a35;border-radius:5px;font-size:10px;color:#9CA3AF;font-family:var(--font-display);letter-spacing:.05em;text-transform:uppercase">Perf <strong style="color:' + perfColor + '">' + perfTxt + '</strong></span>';
      html += '</div>';

      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  // ==========================================================================
  // RENDER : HEADER (POSITION GRILLE + RÉCAP)
  // ==========================================================================

  function renderHeader() {
    var qpos = getQualiPos();
    var circuit = getCircuit();
    var weather = getWeather();
    var cat = (typeof G !== "undefined" && G) ? G.cat : "";
    var nbLaps = getNbLaps();

    var posColor = qpos === 1 ? "#FFD700" : qpos <= 3 ? "#22D3EE" : qpos <= 10 ? "#fff" : "#9CA3AF";

    var html = '<div style="padding:18px 16px 14px;background:linear-gradient(180deg,#1a1a25 0%,#13131c 100%);border-bottom:1px solid #252533">';
    html += '<div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:#EF4444;letter-spacing:.18em;text-transform:uppercase;margin-bottom:6px;display:flex;align-items:center;gap:8px"><span style="display:inline-block;width:7px;height:7px;background:#EF4444;border-radius:50%;animation:rjBlink 1s infinite"></span>Stratégie de course</div>';
    html += '<div style="display:flex;align-items:center;gap:14px;margin-bottom:12px">';
    html += '<div style="flex-shrink:0;text-align:center"><div style="font-family:var(--font-display);font-size:9px;font-weight:700;color:#6B7280;letter-spacing:.1em;text-transform:uppercase">Grille</div><div style="font-family:var(--font-display);font-size:36px;font-weight:900;color:' + posColor + ';line-height:1">P' + qpos + '</div></div>';
    html += '<div style="flex:1;min-width:0">';
    html += '<div style="font-family:var(--font-display);font-size:15px;font-weight:800;color:#fff;letter-spacing:.04em;text-transform:uppercase;line-height:1.1;margin-bottom:3px">' + escHtml(circuit) + '</div>';
    html += '<div style="font-size:12px;color:#9CA3AF;line-height:1.3">' + escHtml(cat) + ' · ' + nbLaps + ' tours</div>';
    if (weather) {
      html += '<div style="font-size:11px;color:#9CA3AF;margin-top:4px;display:inline-flex;align-items:center;gap:5px;padding:3px 8px;background:rgba(0,0,0,0.3);border:1px solid #2a2a35;border-radius:5px"><span style="color:' + (weather.id === "wet" || weather.id === "storm" ? "#3B82F6" : weather.id === "hot" ? "#F59E0B" : "#9CA3AF") + ';font-weight:700">' + escHtml(weather.label) + '</span></div>';
    }
    html += '</div>';
    html += '</div>';

    html += '<div style="font-size:11px;color:#9CA3AF;line-height:1.4;padding:10px 12px;background:rgba(0,0,0,0.3);border:1px solid #2a2a35;border-left:3px solid #3B82F6;border-radius:6px">Tu vas partir <strong style="color:#fff">P' + qpos + '</strong>. Adapte ta stratégie : à l\'avant tu peux gérer, plus loin tu dois prendre des risques pour avancer.</div>';
    html += '</div>';
    return html;
  }

  // ==========================================================================
  // RENDER : SUMMARY + BOUTON FINAL
  // ==========================================================================

  function renderFooter() {
    var s = CFG.getCurrentStrategy();
    var c = COMPOUND_DEFS[s.startCompound] || COMPOUND_DEFS.medium;
    var st = STYLE_DEFS[s.style] || STYLE_DEFS.manage;

    var html = '<div style="padding:14px 16px 24px;background:#0a0a10;border-top:1px solid #252533">';

    html += '<button onclick="_rjStratCommit()" style="width:100%;padding:14px;background:linear-gradient(180deg,#EF4444 0%,#DC2626 100%);color:#fff;border:none;border-radius:10px;font-family:var(--font-display);font-size:13px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;-webkit-tap-highlight-color:transparent;box-shadow:0 4px 16px rgba(239,68,68,0.35)">Valider la stratégie · Aller à la course</button>';
    html += '</div>';
    return html;
  }

  // ==========================================================================
  // RENDER COMPLET DU MODAL
  // ==========================================================================

  function renderStrategyModal() {
    var modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    var content = modal.querySelector("#rsm-content");
    if (!content) return;

    var html = renderHeader();
    html += renderCompoundSection();
    html += renderStopsSection();
    html += renderStyleSection();
    html += renderFooter();

    content.innerHTML = html;
  }

  // Animations CSS
  function ensureStyles() {
    if (document.getElementById("rj-strat-styles")) return;
    var st = document.createElement("style");
    st.id = "rj-strat-styles";
    st.textContent = "@keyframes rjBlink{0%,100%{opacity:1}50%{opacity:0.3}}";
    document.head.appendChild(st);
  }

  // ==========================================================================
  // OUVERTURE / FERMETURE
  // ==========================================================================

  function openStrategyModal() {
    ensureStyles();
    ensureModalDom();
    CFG.getCurrentStrategy(); // init si nécessaire

    var modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    renderStrategyModal();
    modal.style.display = "block";
    // bloquer le scroll body
    document.body.style.overflow = "hidden";
    console.log("[04p] Modal stratégie ouvert");
  }

  function closeStrategyModal() {
    var modal = document.getElementById(MODAL_ID);
    if (modal) modal.style.display = "none";
    document.body.style.overflow = "";
  }

  // ==========================================================================
  // HANDLERS GLOBAUX (appelés par onclick)
  // ==========================================================================

  window._rjStratPickCompound = function(cId) {
    if (!COMPOUND_DEFS[cId]) return;
    CFG.setStrategyField("startCompound", cId);
  };

  window._rjStratPickStops = function(n) {
    n = parseInt(n, 10);
    if (isNaN(n) || n < 0 || n > 3) return;
    CFG.setStrategyField("plannedStops", n);
  };

  window._rjStratPickStyle = function(styleId) {
    if (!STYLE_DEFS[styleId]) return;
    CFG.setStrategyField("style", styleId);
  };

  window._rjStratCommit = function() {
    CFG.commitStrategy();
    closeStrategyModal();
    // Refresh UI race
    try {
      var btn = document.getElementById("race-btn");
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = "";
        btn.style.cursor = "";
      }
      // Affiche un récap dans rt-course
      _rjRenderStrategyRecapInRace();
    } catch(e) { console.warn("[04p] commit refresh:", e); }

    // « Aller à la course » : reproduire la transition native (sinon on reste
    // sur l'onglet Stratégie vide → écran noir). confirmStrategy() gère
    // strategyDone, la visibilité des onglets et rtab vers course/sprint.
    try {
      if (typeof confirmStrategy === "function") {
        confirmStrategy();
      } else {
        if (typeof RACE_WEEKEND_STATE !== "undefined") RACE_WEEKEND_STATE.strategyDone = true;
        if (typeof updateRaceTabsVisibility === "function") updateRaceTabsVisibility();
        var nextTab = "course";
        if (typeof RACE_WEEKEND_STATE !== "undefined" && RACE_WEEKEND_STATE.sprintAvailable && !RACE_WEEKEND_STATE.sprintDone) nextTab = "sprint";
        if (typeof rtab === "function") rtab(nextTab, true);
      }
    } catch(e) { console.warn("[04p] commit navigation:", e); }
  };

  function _rjRenderStrategyRecapInRace() {
    var s = CFG.getCurrentStrategy();
    if (!s) return;
    var c = COMPOUND_DEFS[s.startCompound] || COMPOUND_DEFS.medium;
    var st = STYLE_DEFS[s.style] || STYLE_DEFS.manage;
    var html = '<div id="race-strat-recap" style="margin:0 16px 8px;padding:10px 12px;background:#13131c;border:1px solid #252533;border-left:3px solid #3B82F6;border-radius:8px;display:flex;align-items:center;justify-content:space-between;gap:8px">';
    html += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex:1;min-width:0">';
    html += '<span style="font-family:var(--font-display);font-size:9px;font-weight:800;color:#6B7280;letter-spacing:.12em;text-transform:uppercase">Strat</span>';
    html += '<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#fff"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + c.color + '"></span>' + escHtml(c.label) + '</span>';
    html += '<span style="font-size:11px;color:#9CA3AF">·</span>';
    html += '<span style="font-size:11px;color:#fff">' + s.plannedStops + ' stop' + (s.plannedStops > 1 ? 's' : '') + '</span>';
    html += '<span style="font-size:11px;color:#9CA3AF">·</span>';
    html += '<span style="font-size:11px;color:' + st.color + '"><strong>' + st.icon + ' ' + escHtml(st.label) + '</strong></span>';
    html += '</div>';
    html += '<button onclick="_rjReopenStrategyModal()" style="flex-shrink:0;padding:6px 10px;background:#13131c;color:#9CA3AF;border:1px solid #252533;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;letter-spacing:.05em;text-transform:uppercase">Modifier</button>';
    html += '</div>';

    // Insertion juste avant race-btn parent
    var btn = document.getElementById("race-btn");
    if (!btn || !btn.parentNode) return;
    var parent = btn.parentNode;
    var existing = document.getElementById("race-strat-recap");
    if (existing) existing.parentNode.removeChild(existing);
    parent.insertAdjacentHTML("beforebegin", html);
  }

  window._rjReopenStrategyModal = function() {
    // Ne réouvre que si la course n'a pas démarré
    if (typeof LIVE_RACE !== "undefined" && LIVE_RACE && LIVE_RACE.lap > 0) {
      console.log("[04p] Course en cours, modification non autorisée via modal");
      return;
    }
    openStrategyModal();
  };

  // Expose
  window._RJ_STRAT_UI = {
    openStrategyModal: openStrategyModal,
    closeStrategyModal: closeStrategyModal,
    renderStrategyModal: renderStrategyModal
  };

  console.log("[04p] Strategy UI loaded");

})();

/* =============================================================================
 * 04p — PART 3 : HOOKS MÉCANIQUES
 * =============================================================================
 *
 * Wraps :
 *   - finishQuali : ouvre modal après qualif
 *   - rjBuildCarState : applique compound choisi
 *   - rjUpdateTyresForLap : applique multiplicateur usure selon style
 *   - tickRace : trigger event radio à mi-course (pour changer style)
 *   - runRaceLive : block si stratégie pas validée
 *
 * Cleanup UI :
 *   - Hide #strat-feedback dans rt-prep (n'a plus de sens)
 *   - Hide les sliders strat dans renderAdvancedSetupUI
 * ===========================================================================*/

(function() {
  'use strict';
  if (typeof window === 'undefined') return;
  if (!window._RJ_STRAT_CONFIG || !window._RJ_STRAT_UI) {
    console.error("[04p] CONFIG ou UI missing, abort hooks");
    return;
  }

  var CFG = window._RJ_STRAT_CONFIG;
  var UI = window._RJ_STRAT_UI;
  var STYLE_DEFS = CFG.STYLE_DEFS;

  // ==========================================================================
  // 1. WRAP finishQuali → ouvre modal stratégie après qualif
  // ==========================================================================

  function wrapFinishQuali() {
    if (typeof window.finishQuali !== "function") {
      console.warn("[04p] finishQuali introuvable, retry...");
      return false;
    }
    if (window.finishQuali._rjPatchedStrat) return true; // déjà patch

    var orig = window.finishQuali;
    window.finishQuali = function rjFinishQualiWrapped(e, t) {
      var r;
      try {
        r = orig.apply(this, arguments);
      } catch (err) {
        console.error("[04p] finishQuali orig error:", err);
      }
      // Ouvre le modal stratégie après que tout est en place
      try {
        // Reset stratégie pour cette course
        CFG.resetRaceStrategy();
        // Ouvre modal après un petit délai pour laisser l'UI qualif s'afficher
        setTimeout(function() {
          // Vérif qu'on est toujours sur l'écran race et que la qualif est bien finie
          if (typeof RACE_WEEKEND_STATE !== "undefined" && RACE_WEEKEND_STATE && RACE_WEEKEND_STATE.qualifDone) {
            UI.openStrategyModal();
          }
        }, 800);
      } catch (err) {
        console.warn("[04p] open modal error:", err);
      }
      return r;
    };
    window.finishQuali._rjPatchedStrat = true;
    console.log("[04p] finishQuali wrapped");
    return true;
  }

  // ==========================================================================
  // 2. WRAP rjBuildCarState → applique compound joueur choisi
  // ==========================================================================

  function wrapBuildCarState() {
    if (typeof window.rjBuildCarState !== "function") {
      console.warn("[04p] rjBuildCarState introuvable");
      return false;
    }
    if (window.rjBuildCarState._rjPatchedStrat) return true;

    var orig = window.rjBuildCarState;
    window.rjBuildCarState = function rjBuildCarStateWrapped(driver, isPlayer, weatherId) {
      // Détermine compound selon stratégie joueur si applicable
      var carState = orig.apply(this, arguments);
      if (!isPlayer || !carState || !carState.tyres) return carState;
      var s = CFG.getCurrentStrategy();
      if (!s || !s.committed || !s.startCompound) return carState;

      var newCompound = s.startCompound;
      // Vérif compatibilité météo
      var avail = CFG.availableCompounds({ id: weatherId });
      if (avail.indexOf(newCompound) < 0) {
        // Compound choisi incompatible météo : laisse le default
        console.log("[04p] Compound " + newCompound + " incompatible météo " + weatherId + ", fallback ignored");
        return carState;
      }

      // Override : reset tyres avec le bon compound
      var profile = (typeof RJ_COMPOUND_PROFILES !== "undefined" && RJ_COMPOUND_PROFILES[newCompound]) ? RJ_COMPOUND_PROFILES[newCompound] : null;
      if (!profile) return carState;

      ["FL", "FR", "RL", "RR"].forEach(function(pos) {
        var t = carState.tyres[pos];
        if (!t) return;
        t.compound = newCompound;
      });
      carState.tyres.compoundProfile = newCompound;
      // Fenêtre optimale
      if (newCompound === "soft") carState.tyres.optimalWindow = [85, 105];
      else if (newCompound === "medium") carState.tyres.optimalWindow = [80, 110];
      else if (newCompound === "hard") carState.tyres.optimalWindow = [75, 115];
      else if (newCompound === "wet") carState.tyres.optimalWindow = [55, 80];
      else if (newCompound === "inter") carState.tyres.optimalWindow = [60, 90];

      console.log("[04p] Joueur démarre en " + newCompound);
      return carState;
    };
    window.rjBuildCarState._rjPatchedStrat = true;
    console.log("[04p] rjBuildCarState wrapped");
    return true;
  }

  // ==========================================================================
  // 3. WRAP rjUpdateTyresForLap → applique multiplicateur usure selon style
  // ==========================================================================

  function wrapUpdateTyresForLap() {
    if (typeof window.rjUpdateTyresForLap !== "function") {
      console.warn("[04p] rjUpdateTyresForLap introuvable");
      return false;
    }
    if (window.rjUpdateTyresForLap._rjPatchedStrat) return true;

    var orig = window.rjUpdateTyresForLap;
    window.rjUpdateTyresForLap = function rjUpdateTyresForLapWrapped(driver, lapPct, pushLevel) {
      // Sauvegarde wear avant
      var preWear = null;
      if (driver && driver.isPlayer && driver._rjCarState && driver._rjCarState.tyres) {
        var t = driver._rjCarState.tyres;
        preWear = {
          FL: t.FL ? t.FL.wear : 0,
          FR: t.FR ? t.FR.wear : 0,
          RL: t.RL ? t.RL.wear : 0,
          RR: t.RR ? t.RR.wear : 0
        };
      }

      var r = orig.apply(this, arguments);

      // Applique multiplicateur si joueur
      if (driver && driver.isPlayer && driver._rjCarState && driver._rjCarState.tyres && preWear) {
        var s = CFG.getCurrentStrategy();
        if (s && s.committed) {
          var styleDef = STYLE_DEFS[s.style];
          if (styleDef && styleDef.tyreWearMult !== 1.0) {
            var mult = styleDef.tyreWearMult;
            var t2 = driver._rjCarState.tyres;
            ["FL", "FR", "RL", "RR"].forEach(function(pos) {
              if (!t2[pos]) return;
              var dWear = t2[pos].wear - (preWear[pos] || 0);
              if (dWear > 0) {
                var newWear = (preWear[pos] || 0) + dWear * mult;
                t2[pos].wear = Math.min(100, newWear);
                t2[pos]._lastDelta = dWear * mult;
              }
            });
          }
        }
      }

      return r;
    };
    window.rjUpdateTyresForLap._rjPatchedStrat = true;
    console.log("[04p] rjUpdateTyresForLap wrapped");
    return true;
  }

  // ==========================================================================
  // 4. EVENT MI-COURSE : RADIO INGÉ POUR CHANGER STYLE
  // ==========================================================================

  // Trigger une fois dans la course, à mi-course (~50% laps)
  function maybeTriggerMidRaceStyleEvent(currentLap, totalLaps) {
    var s = CFG.getCurrentStrategy();
    if (!s || s.eventTriggered) return;
    if (!totalLaps || totalLaps < 8) return; // courses trop courtes
    var pct = currentLap / totalLaps;
    // Fenêtre 45-55% pour déclenchement
    if (pct < 0.45 || pct > 0.55) return;
    // Probabilité 35% que l'ingé propose un changement
    if (Math.random() > 0.35) {
      s.eventTriggered = true;
      return;
    }
    s.eventTriggered = true;

    // Déclenche un event radio
    triggerStyleEvent(currentLap, totalLaps);
  }

  function triggerStyleEvent(currentLap, totalLaps) {
    var s = CFG.getCurrentStrategy();
    if (!s) return;

    // Détermine quels styles proposer (différents du courant)
    var styles = ["attack", "manage", "defend"];
    var proposed = styles.filter(function(x) { return x !== s.style; });

    // Détermine contexte
    var playerPos = null;
    try {
      if (typeof LIVE_RACE !== "undefined" && LIVE_RACE && LIVE_RACE.drivers) {
        for (var i = 0; i < LIVE_RACE.drivers.length; i++) {
          if (LIVE_RACE.drivers[i].isPlayer) {
            playerPos = LIVE_RACE.drivers[i].position;
            break;
          }
        }
      }
    } catch (e) {}

    var introMsg;
    if (s.style === "attack") {
      introMsg = "On attaque depuis le départ. À toi de voir : tu maintiens ou tu lèves un peu le pied ?";
    } else if (s.style === "manage") {
      introMsg = "On a bien géré la première partie. Tu veux qu'on passe à autre chose pour la fin ?";
    } else {
      introMsg = "On défend bien. Mais à mi-course, peut-être qu'on doit prendre quelques risques ?";
    }

    // Construit l'event en réutilisant le format existant des modals events
    showRadioEventModal({
      title: "Radio Ingénieur",
      icon: "📻",
      message: introMsg,
      lap: currentLap,
      totalLaps: totalLaps,
      currentStyle: s.style,
      proposed: proposed
    });
  }

  function showRadioEventModal(opts) {
    // Crée modal léger (ne réutilise pas le live-event-modal car format différent)
    var existing = document.getElementById("race-strat-radio-modal");
    if (existing) existing.parentNode.removeChild(existing);

    var modal = document.createElement("div");
    modal.id = "race-strat-radio-modal";
    modal.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:250",
      "background:rgba(0,0,0,0.85)",
      "backdrop-filter:blur(4px)",
      "-webkit-backdrop-filter:blur(4px)",
      "display:flex",
      "align-items:flex-end",
      "justify-content:center",
      "padding:0 14px 30px"
    ].join(";");

    var COMPOUND_DEFS = CFG.COMPOUND_DEFS;

    var html = '<div style="width:100%;max-width:440px;background:linear-gradient(180deg,#1a1a25 0%,#13131c 100%);border:1px solid #2a2a35;border-top:3px solid #3B82F6;border-radius:14px 14px 14px 14px;overflow:hidden;box-shadow:0 16px 48px rgba(59,130,246,0.25)">';

    // Header
    html += '<div style="padding:12px 14px;background:rgba(59,130,246,0.08);border-bottom:1px solid #252533;display:flex;align-items:center;gap:10px">';
    html += '<div style="font-size:20px">📻</div>';
    html += '<div style="flex:1"><div style="font-family:var(--font-display);font-size:11px;font-weight:800;color:#3B82F6;letter-spacing:.14em;text-transform:uppercase">Radio Ingénieur</div><div style="font-size:11px;color:#9CA3AF;margin-top:1px">Tour ' + opts.lap + ' / ' + opts.totalLaps + '</div></div>';
    html += '</div>';

    // Message
    html += '<div style="padding:14px 14px 10px;font-size:13px;color:#fff;line-height:1.5">' + (opts.message || "") + '</div>';

    // Choix
    html += '<div style="padding:6px 14px 14px;display:flex;flex-direction:column;gap:6px">';
    var currentStyleDef = STYLE_DEFS[opts.currentStyle];
    if (currentStyleDef) {
      // Option 1 : maintenir
      html += '<button onclick="_rjStratRadioChoice(\'' + opts.currentStyle + '\')" style="width:100%;padding:11px 12px;background:rgba(0,0,0,0.3);color:#fff;border:1px solid #2a2a35;border-radius:8px;font-size:13px;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent;display:flex;align-items:center;gap:8px">';
      html += '<span style="font-size:18px">' + currentStyleDef.icon + '</span>';
      html += '<div style="flex:1"><div style="font-weight:700;color:#fff">Continuer à ' + currentStyleDef.label.toLowerCase() + '</div><div style="font-size:11px;color:#9CA3AF;margin-top:2px">Pas de changement</div></div>';
      html += '</button>';
    }

    // Options de changement
    opts.proposed.forEach(function(styleId) {
      var st = STYLE_DEFS[styleId];
      if (!st) return;
      html += '<button onclick="_rjStratRadioChoice(\'' + styleId + '\')" style="width:100%;padding:11px 12px;background:' + st.color + '15;color:#fff;border:1px solid ' + st.color + '55;border-radius:8px;font-size:13px;text-align:left;cursor:pointer;-webkit-tap-highlight-color:transparent;display:flex;align-items:center;gap:8px">';
      html += '<span style="font-size:18px">' + st.icon + '</span>';
      html += '<div style="flex:1"><div style="font-weight:700;color:#fff">Passer à <span style="color:' + st.color + '">' + st.label + '</span></div><div style="font-size:11px;color:#9CA3AF;margin-top:2px">' + st.desc + '</div></div>';
      html += '</button>';
    });

    html += '</div>';
    html += '</div>';

    modal.innerHTML = html;
    document.body.appendChild(modal);
  }

  window._rjStratRadioChoice = function(styleId) {
    if (!STYLE_DEFS[styleId]) return;
    CFG.setStrategyField("style", styleId);
    var s = CFG.getCurrentStrategy();
    if (s) s.midRaceStyleChange = (styleId !== s.style);
    var modal = document.getElementById("race-strat-radio-modal");
    if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
    // Update legacy G.strat
    if (typeof G !== "undefined") G.strat = STYLE_DEFS[styleId].legacyStrat;
    // Toast feedback
    if (typeof showToast === "function") {
      showToast("Style changé : " + STYLE_DEFS[styleId].label);
    }
  };

  // ==========================================================================
  // 5. WRAP tickRace ou updateLivePositions → trigger event mi-course
  // ==========================================================================

  function wrapTickRace() {
    if (typeof window.tickRace !== "function") return false;
    if (window.tickRace._rjPatchedStrat) return true;

    var orig = window.tickRace;
    window.tickRace = function rjTickRaceStrat() {
      var r = orig.apply(this, arguments);
      try {
        if (typeof LIVE_RACE !== "undefined" && LIVE_RACE && LIVE_RACE.totalLaps) {
          maybeTriggerMidRaceStyleEvent(LIVE_RACE.lap, LIVE_RACE.totalLaps);
        }
      } catch (e) {}
      return r;
    };
    window.tickRace._rjPatchedStrat = true;
    console.log("[04p] tickRace wrapped");
    return true;
  }

  // ==========================================================================
  // 6. WRAP runRaceLive → assure que stratégie est commit avant départ
  // ==========================================================================

  function wrapRunRaceLive() {
    if (typeof window.runRaceLive !== "function") return false;
    if (window.runRaceLive._rjPatchedStrat) return true;

    var orig = window.runRaceLive;
    window.runRaceLive = function rjRunRaceLiveStrat() {
      var s = CFG.getCurrentStrategy();
      // Si pas de stratégie commit, force ouverture du modal
      if (!s || !s.committed) {
        console.log("[04p] Stratégie pas validée, ouverture modal");
        UI.openStrategyModal();
        return;
      }
      // Reset event mi-course
      s.eventTriggered = false;
      return orig.apply(this, arguments);
    };
    window.runRaceLive._rjPatchedStrat = true;
    console.log("[04p] runRaceLive wrapped");
    return true;
  }

  // ==========================================================================
  // 7. CLEANUP UI : MASQUER strat-feedback DANS rt-prep
  // ==========================================================================

  function cleanupPrepUI() {
    // Masque le strat-feedback (n'a plus de sens en prep)
    var sf = document.getElementById("strat-feedback");
    if (sf) sf.style.display = "none";
    // Le label "Setup & Stratégie" reste mais sera contextuel "Setup voiture" via wrapping
    // (cosmétique, on garde simple)
  }

  // Wrap renderAdvancedSetupUI pour exclure les paramètres strat
  function wrapRenderAdvancedSetupUI() {
    if (typeof window.renderAdvancedSetupUI !== "function") return false;
    if (window.renderAdvancedSetupUI._rjPatchedStrat) return true;

    var orig = window.renderAdvancedSetupUI;
    window.renderAdvancedSetupUI = function rjRenderAdvancedSetupUIStrat() {
      var r = orig.apply(this, arguments);
      // Après render : retire les paramètres strat de l'UI car non pertinents en prep
      try {
        var container = document.getElementById("advanced-setup-container");
        if (container) {
          // Cherche la section "Stratégie de course" et la masque
          var sections = container.querySelectorAll("div");
          for (var i = 0; i < sections.length; i++) {
            var s = sections[i];
            var txt = (s.textContent || "").toLowerCase();
            // La section strat a un titre "Stratégie de course"
            if (txt.indexOf("stratégie de course") >= 0 && s.style && s.style.background && s.style.background.indexOf("var(--bg3)") >= 0) {
              // C'est un parent contenant la section : on remonte au div parent niveau cohérence
              var parent = s.parentNode;
              while (parent && parent !== container) {
                var classes = parent.className || "";
                var styleStr = parent.getAttribute("style") || "";
                if (styleStr.indexOf("border:1px solid") >= 0 && styleStr.indexOf("border-radius") >= 0) {
                  parent.style.display = "none";
                  break;
                }
                parent = parent.parentNode;
              }
              break;
            }
          }
        }
        // Masque aussi le strat-feedback
        var sf = document.getElementById("strat-feedback");
        if (sf) sf.style.display = "none";
      } catch (e) {
        console.warn("[04p] cleanup advanced setup ui:", e);
      }
      return r;
    };
    window.renderAdvancedSetupUI._rjPatchedStrat = true;
    console.log("[04p] renderAdvancedSetupUI wrapped (cleanup strat)");
    return true;
  }

  // ==========================================================================
  // 8. WRAP refreshSetupStratFeedback pour ne plus afficher strat-feedback prep
  // ==========================================================================

  function wrapRefreshSetupStratFeedback() {
    if (typeof window.refreshSetupStratFeedback !== "function") return false;
    if (window.refreshSetupStratFeedback._rjPatchedStrat) return true;

    var orig = window.refreshSetupStratFeedback;
    window.refreshSetupStratFeedback = function rjRefreshFeedbackStrat() {
      var r = orig.apply(this, arguments);
      try {
        var sf = document.getElementById("strat-feedback");
        if (sf) {
          sf.innerHTML = "";
          sf.style.display = "none";
        }
      } catch (e) {}
      return r;
    };
    window.refreshSetupStratFeedback._rjPatchedStrat = true;
    return true;
  }

  // ==========================================================================
  // 9. INIT : APPLY ALL WRAPS
  // ==========================================================================

  function applyAllWraps() {
    var ok = 0;
    var total = 0;
    function tryWrap(fn) {
      total++;
      try {
        if (fn()) ok++;
      } catch (e) { console.warn("[04p] wrap error:", e); }
    }
    tryWrap(wrapFinishQuali);
    tryWrap(wrapBuildCarState);
    tryWrap(wrapUpdateTyresForLap);
    tryWrap(wrapTickRace);
    tryWrap(wrapRunRaceLive);
    tryWrap(wrapRenderAdvancedSetupUI);
    tryWrap(wrapRefreshSetupStratFeedback);
    console.log("[04p] " + ok + "/" + total + " wraps appliqués");
  }

  // Apply au chargement + retry après 1s pour les fonctions définies plus tard
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      applyAllWraps();
      setTimeout(applyAllWraps, 500);
      setTimeout(applyAllWraps, 1500);
    });
  } else {
    applyAllWraps();
    setTimeout(applyAllWraps, 500);
    setTimeout(applyAllWraps, 1500);
  }

  // Cleanup UI quand l'écran prep est affiché
  function watchPrepScreen() {
    setInterval(function() {
      try {
        var prep = document.getElementById("rt-prep");
        if (prep && prep.offsetParent !== null) {
          cleanupPrepUI();
        }
      } catch (e) {}
    }, 1000);
  }
  watchPrepScreen();

  // ==========================================================================
  // 10. DEBUG API
  // ==========================================================================

  window.rjStratDebug = function() {
    var s = CFG.getCurrentStrategy();
    console.log("=== Race Strategy Debug ===");
    console.log("Current strategy:", s);
    console.log("Available compounds:",
      CFG.availableCompounds(typeof RACE_STATE !== "undefined" && RACE_STATE ? RACE_STATE.weather : null)
    );
    console.log("Wraps applied:");
    console.log("  finishQuali:", !!(window.finishQuali && window.finishQuali._rjPatchedStrat));
    console.log("  rjBuildCarState:", !!(window.rjBuildCarState && window.rjBuildCarState._rjPatchedStrat));
    console.log("  rjUpdateTyresForLap:", !!(window.rjUpdateTyresForLap && window.rjUpdateTyresForLap._rjPatchedStrat));
    console.log("  tickRace:", !!(window.tickRace && window.tickRace._rjPatchedStrat));
    console.log("  runRaceLive:", !!(window.runRaceLive && window.runRaceLive._rjPatchedStrat));
    return s;
  };

  // Force open modal (debug)
  window.rjStratForceOpen = function() {
    UI.openStrategyModal();
  };

  // Force trigger radio event (debug)
  window.rjStratForceRadio = function() {
    var totalLaps = (typeof LIVE_RACE !== "undefined" && LIVE_RACE) ? LIVE_RACE.totalLaps : 30;
    var lap = (typeof LIVE_RACE !== "undefined" && LIVE_RACE) ? LIVE_RACE.lap : Math.floor(totalLaps / 2);
    triggerStyleEvent(lap, totalLaps);
  };

  console.log("[04p] Race Strategy module loaded — module 04p");

})();
