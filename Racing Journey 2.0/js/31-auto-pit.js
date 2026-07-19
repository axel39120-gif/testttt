/* =============================================================================
 * 31-auto-pit.js — ARRÊTS AU STAND AUTOMATIQUES + POPUP DE SIMULATION
 * =============================================================================
 *
 * OBJECTIF (demande Axel)
 * -----------------------
 *  1. Supprimer le BOUTON d'arrêt manuel : le pilote ne décide plus librement
 *     de rentrer au stand.
 *  2. ARRÊT AUTOMATIQUE selon la stratégie évoquée (G.raceStrategy.plannedStops)
 *     réparti dans la fenêtre d'arrêt de la catégorie.
 *  3. En cas de PROBLÈME en course (Safety Car ici ; la météo est gérée par
 *     l'événement `weather_call` du module 27), un événement explique le souci
 *     et demande au pilote s'il veut s'arrêter ou non.
 *  4. POPUP DE SIMULATION d'arrêt : choix des pneus, temps de changement de
 *     pneus (immobile) + traversée pit-lane + temps perdu total, façon réaliste.
 *
 * APPROCHE (Option A — enrichissement sûr, aucun fichier cœur modifié)
 * --------------------------------------------------------------------
 *  - On enveloppe `window._playerPit` : tout arrêt « réel » (auto, météo, SC)
 *    passe d'abord par le popup de simulation, qui rappelle ensuite le vrai
 *    `_playerPit` (mécanique d'origine intacte : places perdues, pneus neufs…).
 *  - On enveloppe `window.renderPitButton` pour retirer le bouton manuel
 *    (`#pit-button-container`) tout en gardant le bouton « Mur des stands » info.
 *  - Un watcher (setInterval) déclenche l'arrêt auto aux tours-cibles et propose
 *    l'arrêt sous Safety Car.
 *
 * Réversibilité : retirer ce script de index.html restaure le comportement
 * d'origine (bouton manuel + popup compound simple).
 * =============================================================================
 */
(function () {
  "use strict";
  var TAG = "[31-auto-pit]";

  var _origPlayerPit = null;
  var _origRenderPitButton = null;
  var _origShowCompound = null;
  var _watchTimer = null;

  // --- Accès sûrs aux globales du jeu --------------------------------------
  function G_() { return (typeof G !== "undefined") ? G : null; }
  function LR() { return (typeof LIVE_RACE !== "undefined") ? LIVE_RACE : null; }
  function isKartCat() { var g = G_(); return !!(g && (g.cat === "Karting Junior" || g.cat === "Karting Senior")); }
  function pitEnabled() { return typeof _pitEnabledForCurrentRace === "function" && _pitEnabledForCurrentRace(); }
  function liveOK() { var l = LR(); return !!(l && !l.finished); }
  function player() { var l = LR(); return (l && l.drivers) ? l.drivers.find(function (d) { return d.isPlayer; }) : null; }
  function pitCfg() { return (typeof _pitConfigForCat === "function") ? _pitConfigForCat() : null; }
  function suggestCompound() { return (typeof _suggestedCompound === "function") ? _suggestedCompound() : "medium"; }
  function compEff(c) { return (typeof _compoundEffects === "function") ? _compoundEffects(c) : { label: c, color: "#9aa", icon: "" }; }
  function neutralActive() {
    var l = LR();
    // neutralisation gérée par le module 27 (et compatible 04m)
    return !!(l && l._rjNeutral && l._rjNeutral.active);
  }

  // --- Fenêtre d'arrêt (en tours) ------------------------------------------
  function winLaps() {
    var l = LR(), cfg = pitCfg();
    if (!l || !cfg || !cfg.enabled || !l.total) return null;
    var ws = (typeof cfg.windowStart === "number") ? cfg.windowStart : 0.20;
    var we = (typeof cfg.windowEnd === "number") ? cfg.windowEnd : 0.80;
    return { start: Math.max(1, Math.round(l.total * ws)), end: Math.max(1, Math.round(l.total * we)) };
  }

  // --- Radio ingénieur (compatible avec les différents canaux du jeu) ------
  function engineerRadio(desc, color) {
    try {
      if (typeof pushRadioMsg === "function") return pushRadioMsg("Ingénieur", desc, { ttl: 5, color: color || "#F59E0B" });
      if (typeof window.rjRadioPush === "function") return window.rjRadioPush({ from: "Ingénieur", text: desc, color: color || "#F59E0B" });
      if (typeof showToast === "function") return showToast(desc);
    } catch (e) { }
  }

  // --- Bouton d'arrêt MANUEL optionnel (id propre, non touché par le wrap) --
  function ensureManualButton(show) {
    var existing = document.getElementById("rj-manual-pit-btn");
    if (!show) { if (existing) existing.remove(); return; }
    if (existing) return;
    var btn = document.createElement("button");
    btn.id = "rj-manual-pit-btn";
    btn.style.cssText = "position:fixed;bottom:90px;right:14px;z-index:8000;padding:8px 12px;"
      + "background:linear-gradient(180deg,#2f6df0,#1d4ed8);color:#fff;border:1px solid rgba(96,165,250,0.55);"
      + "border-radius:10px;font-family:var(--font-display,inherit);font-size:10px;font-weight:800;letter-spacing:.05em;"
      + "text-transform:uppercase;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;"
      + "box-shadow:0 6px 18px rgba(37,99,235,0.45),0 0 0 1px rgba(255,255,255,0.06) inset;-webkit-tap-highlight-color:transparent";
    btn.innerHTML = '<span style="font-size:14px;line-height:1">🔧</span><span>Stand</span>';
    btn.onclick = function () {
      if (!liveOK()) return;
      if (document.getElementById("rj-pitsim-overlay") || document.getElementById("rj-pitdecision-overlay")) return;
      ensureManualButton(false);
      showPitSim(suggestCompound());
    };
    document.body.appendChild(btn);
  }

  // --- Plan d'arrêts : tours-cibles depuis la stratégie --------------------
  function plannedStopCount() {
    var g = G_(), cfg = pitCfg();
    if (!cfg || !cfg.enabled) return 0;
    var n = (g && g.raceStrategy && typeof g.raceStrategy.plannedStops === "number")
      ? g.raceStrategy.plannedStops
      : (cfg.minStops || 0);
    return Math.max(cfg.minStops || 0, Math.min(cfg.maxStops || 1, n));
  }
  function targetLaps() {
    if (!liveOK() || typeof getPlayerPitStatus !== "function") return [];
    var st = getPlayerPitStatus();
    if (!st) return [];
    var n = plannedStopCount();
    if (n <= 0) return [];
    var laps = [];
    for (var i = 0; i < n; i++) {
      laps.push(Math.round(st.windowStart + (st.windowEnd - st.windowStart) * (i + 1) / (n + 1)));
    }
    return laps;
  }

  // --- Temps d'arrêt réalistes (cosmétiques pour le popup) ------------------
  function realisticTimes() {
    var cfg = pitCfg() || { stopTimeMin: 20, stopTimeMax: 24 };
    var total = cfg.stopTimeMin + Math.random() * (cfg.stopTimeMax - cfg.stopTimeMin);
    // immobile (changement de pneus) : 2.2–3.8s ; +ravitaillement si fuelStops
    var tyre = 2.2 + Math.random() * 1.6;
    var botched = Math.random() < 0.08;
    if (botched) tyre += 1.5 + Math.random() * 3;
    if (cfg.fuelStops) tyre += 4 + Math.random() * 6; // ravitaillement (WEC / IndyCar)
    if (tyre > total - 1) tyre = Math.max(2.0, total - 1);
    return { total: total, tyre: tyre, lane: Math.max(0, total - tyre), botched: botched };
  }

  // --- Exécution réelle de l'arrêt (mécanique d'origine) -------------------
  function doRealPit(compound) {
    var l = LR();
    if (l) l._rjPitSimInProgress = true;
    try { if (_origPlayerPit) _origPlayerPit(true, compound); }
    catch (e) { console.warn(TAG, "doRealPit:", e); }
    if (l) l._rjPitSimInProgress = false;
  }

  // --- Popup de simulation d'arrêt -----------------------------------------
  function showPitSim(presetCompound) {
    if (!liveOK()) return;
    if (document.getElementById("rj-pitsim-overlay")) return;
    LIVE_RACE.paused = true;

    var times = realisticTimes();
    var weather = (typeof RACE_STATE !== "undefined" && RACE_STATE.weather && RACE_STATE.weather.id) || "dry";
    var compounds = (weather === "wet" || weather === "storm") ? ["wet"] : ["soft", "medium", "hard"];
    var chosen = presetCompound || suggestCompound();
    if (compounds.indexOf(chosen) < 0) chosen = compounds[0];

    var ov = document.createElement("div");
    ov.id = "rj-pitsim-overlay";
    ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.80);z-index:9600;display:flex;align-items:center;justify-content:center;padding:18px;backdrop-filter:blur(4px)";

    function render() {
      var rows = compounds.map(function (c) {
        var e = compEff(c), sel = (c === chosen);
        return '<button data-c="' + c + '" style="flex:1;padding:12px 8px;border-radius:10px;border:2px solid '
          + (sel ? e.color : 'var(--border,#2A2A35)') + ';background:' + (sel ? 'rgba(255,255,255,0.07)' : 'var(--surface2,#1a1a22)')
          + ';color:var(--text,#eee);font-family:inherit;font-weight:700;font-size:13px;cursor:pointer;-webkit-tap-highlight-color:transparent">'
          + (e.icon ? e.icon + " " : "") + e.label + '</button>';
      }).join("");

      ov.innerHTML =
        '<div style="background:var(--bg2,#16161D);border:1px solid var(--border-hi,#333);border-top:3px solid #60A5FA;border-radius:14px;max-width:420px;width:100%;box-shadow:0 16px 48px rgba(0,0,0,0.7)">'
        + '<div style="padding:14px 16px;border-bottom:1px solid var(--line,#262630)">'
        + '<div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:#60A5FA;letter-spacing:.22em">ARRÊT AU STAND</div>'
        + '<div style="font-size:15px;font-weight:700;color:var(--text,#eee);margin-top:3px">Choix des pneus</div>'
        + '</div>'
        + '<div style="padding:16px">'
        + '<div style="display:flex;gap:8px;margin-bottom:14px">' + rows + '</div>'
        + '<div style="background:var(--surface2,#15151c);border-radius:10px;padding:12px 14px;font-size:13px;color:var(--text2,#bbb);line-height:1.8">'
        + '<div style="display:flex;justify-content:space-between"><span>Changement de pneus (immobile)</span><strong style="color:var(--text,#eee)">' + times.tyre.toFixed(1) + 's</strong></div>'
        + '<div style="display:flex;justify-content:space-between"><span>Traversée pit-lane</span><strong style="color:var(--text,#eee)">' + times.lane.toFixed(1) + 's</strong></div>'
        + '<div style="display:flex;justify-content:space-between;border-top:1px solid var(--line,#262630);margin-top:6px;padding-top:6px"><span>Temps perdu total</span><strong style="color:#F59E0B">' + times.total.toFixed(1) + 's</strong></div>'
        + (times.botched ? '<div style="color:#EF4444;font-size:11px;margin-top:8px;font-weight:700">⚠ Arrêt raté — écrou récalcitrant</div>' : '')
        + '</div>'
        + '<button id="rj-pitsim-go" style="margin-top:14px;width:100%;padding:13px;border:none;border-radius:10px;background:#60A5FA;color:#06121f;font-weight:800;font-size:14px;font-family:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent">Confirmer l\'arrêt</button>'
        + '</div></div>';

      [].forEach.call(ov.querySelectorAll('button[data-c]'), function (b) {
        b.onclick = function () { chosen = b.getAttribute('data-c'); render(); };
      });
      var go = ov.querySelector('#rj-pitsim-go');
      if (go) go.onclick = function () {
        ov.remove();
        doRealPit(chosen);
        // reprise de la course après l'arrêt (le popup l'avait mise en pause)
        if (LR()) LIVE_RACE.paused = false;
      };
    }

    render();
    document.body.appendChild(ov);
  }

  // --- Popup de décision (problème → s'arrêter ou non) ---------------------
  function showPitDecision(title, body) {
    if (!liveOK()) return;
    if (document.getElementById("rj-pitdecision-overlay") || document.getElementById("rj-pitsim-overlay")) return;
    LIVE_RACE.paused = true;
    var ov = document.createElement("div");
    ov.id = "rj-pitdecision-overlay";
    ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:9550;display:flex;align-items:center;justify-content:center;padding:18px;backdrop-filter:blur(4px)";
    ov.innerHTML =
      '<div style="background:var(--bg2,#16161D);border:1px solid var(--border-hi,#333);border-top:3px solid #F59E0B;border-radius:14px;max-width:420px;width:100%;box-shadow:0 16px 48px rgba(0,0,0,0.7)">'
      + '<div style="padding:14px 16px;border-bottom:1px solid var(--line,#262630)">'
      + '<div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:#F59E0B;letter-spacing:.22em">RADIO DU STAND</div>'
      + '<div style="font-size:15px;font-weight:700;color:var(--text,#eee);margin-top:3px">' + title + '</div>'
      + '</div>'
      + '<div style="padding:16px">'
      + '<div style="font-size:14px;color:var(--text,#eee);line-height:1.5;margin-bottom:14px">' + body + '</div>'
      + '<button id="rj-pd-yes" style="width:100%;padding:13px;border:none;border-radius:10px;background:#60A5FA;color:#06121f;font-weight:800;font-size:14px;font-family:inherit;cursor:pointer;margin-bottom:8px">Rentrer au stand</button>'
      + '<button id="rj-pd-no" style="width:100%;padding:13px;border:1px solid var(--border,#2A2A35);border-radius:10px;background:var(--surface2,#1a1a22);color:var(--text,#eee);font-weight:700;font-size:14px;font-family:inherit;cursor:pointer">Rester en piste</button>'
      + '</div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#rj-pd-yes').onclick = function () { ov.remove(); showPitSim(suggestCompound()); };
    ov.querySelector('#rj-pd-no').onclick = function () { ov.remove(); if (LR()) LIVE_RACE.paused = false; };
  }

  // --- Watcher : auto-pit + offre Safety Car -------------------------------
  function tick() {
    try {
      if (!liveOK() || LIVE_RACE.paused) { ensureManualButton(false); return; }
      if (document.getElementById("rj-pitsim-overlay") || document.getElementById("rj-pitdecision-overlay")) return;
      if (isKartCat() || !pitEnabled()) { ensureManualButton(false); return; }
      var p = player();
      if (!p || p.dnf) { ensureManualButton(false); return; }

      // le bouton manuel natif reste retiré (on gère notre propre bouton)
      var native = document.getElementById("pit-button-container");
      if (native) native.remove();

      var cfg = pitCfg();
      var done = p._pitsDone || 0;
      var maxS = cfg.maxStops || 1, minS = cfg.minStops || 0;
      var cur = LIVE_RACE.cur, total = LIVE_RACE.total || 0;
      var w = winLaps();
      var inWindow = !!(w && cur >= w.start && cur <= w.end);

      // 1) RADIO INGÉNIEUR à l'ouverture de la fenêtre (une seule fois)
      if (w && cur >= w.start && !LIVE_RACE._rjPitWindowAnnounced && done < maxS && (total - cur) > 1) {
        LIVE_RACE._rjPitWindowAnnounced = true;
        engineerRadio("Fenêtre d'arrêt ouverte. Tu peux rentrer quand tu le sens — je te rappelle avant la fermeture.", "#F59E0B");
      }

      // 2) OFFRE SOUS SAFETY CAR (une fois par neutralisation) : arrêt peu coûteux
      if (neutralActive() && done < maxS) {
        var nLap = (LIVE_RACE._rjNeutral && LIVE_RACE._rjNeutral.startLap) || cur;
        if (LIVE_RACE._rjScPitOfferedFor !== nLap) {
          LIVE_RACE._rjScPitOfferedFor = nLap;
          var pct = total > 0 ? cur / total : 0;
          if (pct >= (cfg.windowStart - 0.1) && pct <= (cfg.windowEnd + 0.05) && (total - cur) > 2) {
            ensureManualButton(false);
            showPitDecision(
              "Safety Car déployé",
              "La voiture de sécurité est en piste — c'est le moment idéal pour un arrêt à coût réduit. On rentre ?"
            );
            return;
          }
        }
      }

      // 3) BOUTON MANUEL pendant la fenêtre (arrêt optionnel, tant qu'il reste des arrêts dispo)
      ensureManualButton(inWindow && done < maxS && (total - cur) > 1);

      // 4) FILET : garantir l'arrêt OBLIGATOIRE en fin de fenêtre si le joueur n'a rien fait
      if (w && done < minS && cur >= w.end) {
        if (LIVE_RACE._rjNetPitDoneCount !== done) {
          LIVE_RACE._rjNetPitDoneCount = done;
          ensureManualButton(false);
          engineerRadio("Fenêtre presque fermée — arrêt obligatoire, je te fais rentrer.", "#EF4444");
          // exécution réelle directe (sans popup) : c'est un filet
          var l = LR(); if (l) l._rjPitSimInProgress = true;
          try { if (_origPlayerPit) _origPlayerPit(true, suggestCompound()); }
          catch (e) { console.warn(TAG, "filet pit:", e); }
          if (l) l._rjPitSimInProgress = false;
        }
      }
    } catch (e) { console.warn(TAG, "tick:", e); ensureManualButton(false); }
  }

  function startWatcher() {
    if (_watchTimer) clearInterval(_watchTimer);
    _watchTimer = setInterval(tick, 500);
  }

  // --- Installation : wraps + watcher --------------------------------------
  var tries = 0;
  function install() {
    if (typeof window._playerPit !== "function" || typeof window.renderPitButton !== "function") {
      if (tries++ < 120) return void setTimeout(install, 250);
      console.warn(TAG + " : _playerPit/renderPitButton introuvables, abandon.");
      return;
    }

    // Wrap _playerPit → passe par le popup de simulation (sauf exécution réelle / karting / pit désactivé)
    _origPlayerPit = window._playerPit;
    window._playerPit = function (forceFromEvent, chosenCompound) {
      var l = LR();
      if (l && l._rjPitSimInProgress) return _origPlayerPit.apply(this, arguments);
      if (isKartCat() || !pitEnabled()) return _origPlayerPit.apply(this, arguments);
      // sinon : popup de simulation (choix gomme + timing) qui rappellera le vrai pit
      showPitSim(chosenCompound);
    };

    // Wrap renderPitButton → retire le bouton d'arrêt manuel (garde l'info Mur des stands)
    _origRenderPitButton = window.renderPitButton;
    window.renderPitButton = function () {
      var r;
      try { r = _origRenderPitButton.apply(this, arguments); } catch (e) { }
      var c = document.getElementById("pit-button-container");
      if (c) c.remove();
      return r;
    };

    // Neutralise le choix d'arrêt manuel du « Mur des stands » (qui passait par
    // _showCompoundPopup) : plus aucun arrêt manuel possible. Notre popup de
    // simulation n'utilise PAS _showCompoundPopup, donc c'est sans effet sur l'auto-pit.
    if (typeof window._showCompoundPopup === "function") {
      _origShowCompound = window._showCompoundPopup;
      window._showCompoundPopup = function () {
        if (typeof showToast === "function") showToast("🔧 L'arrêt se déclenche automatiquement selon ta stratégie");
      };
    }

    startWatcher();

    // API de réversibilité
    window._rjAutoPit = {
      uninstall: function () {
        if (_origPlayerPit) window._playerPit = _origPlayerPit;
        if (_origRenderPitButton) window.renderPitButton = _origRenderPitButton;
        if (_watchTimer) { clearInterval(_watchTimer); _watchTimer = null; }
        var b = document.getElementById("rj-manual-pit-btn"); if (b) b.remove();
      },
      showPitSim: showPitSim,
      targetLaps: targetLaps
    };

    console.log(TAG + " activé — arrêt MANUEL optionnel (bouton Stand + radio à l'ouverture de la fenêtre), filet auto en fin de fenêtre pour l'arrêt obligatoire.");
  }

  install();
})();
