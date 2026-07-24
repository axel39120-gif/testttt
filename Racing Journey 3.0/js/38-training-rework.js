/* =====================================================================
 * 38-training-rework.js — REFONTE DE L'ENTRAÎNEMENT
 *
 * Remplace les sessions plates « +1 fixe » par un système de FOCUS à
 * issue variable, relié à l'arbre (module 34) et à la fatigue.
 *
 * MOTEUR (ce fichier) :
 *   - 4 focus alignés sur les branches de l'arbre. Lancer un focus coûte
 *     1 PA + fatigue ; il oriente les gains vers ses sous-stats, modulés
 *     par fatigue / âge / potentiel restant, avec événements (déclic,
 *     plateau, séance ratée).
 *   - Préserve le déblocage des spécialités T1 en réutilisant
 *     recordTrainingSession (le mécanisme d'origine).
 *   - Programmes PREMIUM optionnels (argent) : stage simu, coach, semaine
 *     intensive.
 *
 * Option A : ne réécrit pas le cœur. L'UI (remplacement de l'écran) est
 * branchée séparément. Réversible : window._rjTrainUninstall().
 *
 * S'appuie sur : G.pa, G.budget, recordTrainingSession, gainSubStat,
 * computeLegacyStats, getTraining, window._rjProg (âge/archétype).
 * =================================================================== */
(function () {
  "use strict";

  function G_() { return window.G; }
  function tr_() {
    if (typeof window.getTraining === "function") { try { return window.getTraining(); } catch (e) {} }
    var G = G_(); return G ? (G.training = G.training || {}) : null;
  }

  var FOCUS = {
    pilotage:   { label: "Pilotage pur",          color: "#00D4FF", sessionKey: "simu",
      stats: ["vitesse_pure", "acceleration", "freinage"], desc: "Vitesse brute, tour lancé, freinage tardif." },
    course:     { label: "Racecraft",             color: "#FF1801", sessionKey: "simu",
      stats: ["reactivite", "decision", "gestion_pneus"], desc: "Duels, départs, lecture de course." },
    conditions: { label: "Conditions",            color: "#60A5FA", sessionKey: "technical",
      stats: ["grip", "concentration", "pression"], desc: "Pluie, adaptation, sang-froid." },
    physique:   { label: "Préparation physique",  color: "#EC4899", sessionKey: "physical",
      stats: ["physique"], desc: "Cardio, résistance aux G, endurance." }
  };
  var FOCUS_KEYS = ["pilotage", "course", "conditions", "physique"];

  var PREMIUM = [
    { id: "sim_stage", label: "Stage simulateur",        cost: 8000,  desc: "Une séance de focus garantie, sans mauvaise pioche, avec un gain renforcé." },
    { id: "coach",     label: "Coach personnel (saison)", cost: 25000, desc: "Efficacité des focus +20 % jusqu'à la fin de la saison." },
    { id: "intensive", label: "Semaine intensive",        cost: 5000,  desc: "+2 PA cette semaine, mais fatigue accrue." }
  ];

  function ageMult() {
    try { if (window._rjProg && typeof window._rjProg.ageMult === "function") return window._rjProg.ageMult(); } catch (e) {}
    return 1;
  }
  function coachActive() {
    var tr = tr_(), G = G_();
    return !!(tr && G && tr._coachSeason === G.saison);
  }

  /* Issue d'un focus : budget de gain modulé, réparti aléatoirement. */
  function computeFocusOutcome(focusKey, opts) {
    opts = opts || {};
    var focus = FOCUS[focusKey];
    if (!focus) return null;
    var tr = tr_(), fatigue = (tr && tr.fatigue) || 0;
    var fatigueMult = Math.max(0.4, 1 - fatigue / 160);
    var mult = fatigueMult * ageMult() * (coachActive() ? 1.2 : 1);

    var event = "normal", eventMult = 1;
    if (!opts.guaranteed) {
      var roll = Math.random();
      if (roll < 0.12) { event = "declic"; eventMult = 2; }
      else if (roll < 0.30) { event = "plateau"; eventMult = 0.5; }
      else if (roll > 0.97) { event = "off"; eventMult = 0; }
    } else { event = "stage"; eventMult = 1.6; }      // programme premium : gain renforcé, pas d'aléa négatif

    var budget = Math.max(opts.guaranteed ? 2 : 0, Math.round(2 * mult * eventMult));
    var gains = {};
    focus.stats.forEach(function (s) { gains[s] = 0; });
    for (var i = 0; i < budget; i++) {
      var s = focus.stats[Math.floor(Math.random() * focus.stats.length)];
      gains[s] += 1;
    }
    return { focus: focusKey, event: event, gains: gains, budget: budget };
  }

  /* Applique les gains via gainSubStat (rendements décroissants du pilier 1). */
  function applyGains(gains) {
    var applied = [];
    Object.keys(gains).forEach(function (k) {
      if (gains[k] > 0 && typeof window.gainSubStat === "function") {
        try { window.gainSubStat(k, gains[k]); applied.push({ k: k, v: gains[k] }); } catch (e) {}
      }
    });
    try { if (typeof window.computeLegacyStats === "function") window.computeLegacyStats(); } catch (e) {}
    return applied;
  }

  /* Lancer un focus : coûte 1 PA + fatigue, débloque les specs (core), gains variables. */
  function runFocus(focusKey, opts) {
    opts = opts || {};
    var G = G_(), focus = FOCUS[focusKey];
    if (!G || !focus) return { ok: false, reason: "invalid" };
    if (!opts.free && (G.pa || 0) <= 0) return { ok: false, reason: "no_pa" };
    if (!opts.free) G.pa -= 1;
    // fatigue + déblocage des spécialités T1 (mécanisme d'origine)
    try { if (typeof window.recordTrainingSession === "function") window.recordTrainingSession(focus.sessionKey); } catch (e) {}
    var outcome = computeFocusOutcome(focusKey, opts);
    var applied = applyGains(outcome.gains);
    return { ok: true, event: outcome.event, gains: applied, focus: focusKey };
  }

  function premiumUsedThisWeek(id) {
    var G = G_(), tr = tr_();
    return !!(G && tr && tr._premWeek && tr._premWeek[id] === G.semaine);
  }
  function markPremium(id) {
    var G = G_(), tr = tr_();
    if (G && tr) { tr._premWeek = tr._premWeek || {}; tr._premWeek[id] = G.semaine; }
  }
  function runPremium(id, focusKey) {
    var G = G_(), tr = tr_();
    var prog = PREMIUM.filter(function (p) { return p.id === id; })[0];
    if (!G || !prog) return { ok: false, reason: "invalid" };
    if ((id === "sim_stage" || id === "intensive") && premiumUsedThisWeek(id)) return { ok: false, reason: "weekly_cap" };
    if ((G.budget || 0) < prog.cost) return { ok: false, reason: "no_budget" };
    G.budget -= prog.cost;
    if (id === "sim_stage") {
      markPremium(id);
      var fk = focusKey || lowestFocus();
      var r = runFocus(fk, { free: true, guaranteed: true });
      return { ok: true, id: id, focus: fk, result: r };
    }
    if (id === "coach") { if (tr) tr._coachSeason = G.saison; return { ok: true, id: id }; }
    if (id === "intensive") {
      markPremium(id);
      G.pa = (G.pa || 0) + 2;
      if (tr) tr.fatigue = Math.min(100, (tr.fatigue || 0) + 20);
      return { ok: true, id: id };
    }
    return { ok: false, reason: "unknown" };
  }

  /* Réinitialise fatigue et moral au début d'une nouvelle saison (repos d'intersaison). */
  function resetSeasonState() {
    var G = G_(), tr = tr_();
    if (!G) return;
    var season = G.saison || 0;
    if (tr && tr._resetSeason === season) return;   // idempotent
    if (tr) { tr._resetSeason = season; tr.fatigue = 0; }
    try { if (window.PILOT_MENTAL && typeof window.PILOT_MENTAL.value === "number") window.PILOT_MENTAL.value = 60; } catch (e) {}
  }
  var _origNextSeason = null;
  function wrapNextSeason() {
    if (typeof window.startNextSeason !== "function") return false;
    if (window.startNextSeason._rjTrainReset) return true;
    _origNextSeason = window.startNextSeason;
    window.startNextSeason = function () {
      var r = _origNextSeason.apply(this, arguments);
      try { resetSeasonState(); } catch (e) {}
      return r;
    };
    window.startNextSeason._rjTrainReset = true;
    return true;
  }

  /* Récupération : réduit la fatigue, coûte 1 PA (ton temps). */
  function doRest() {
    var G = G_(), tr = tr_();
    if (!G || !tr) return { ok: false };
    if ((G.pa || 0) <= 0) return { ok: false, reason: "no_pa" };
    G.pa -= 1;
    tr.fatigue = Math.max(0, (tr.fatigue || 0) - 35);
    try { if (typeof window.updateUI === "function") window.updateUI(); } catch (e) {}
    return { ok: true, fatigue: tr.fatigue };
  }

  /* Focus dont les sous-stats sont en moyenne les plus basses (marge de progression). */
  function lowestFocus() {
    var G = G_(); if (!G || !G.substats) return "pilotage";
    var best = "pilotage", bestAvg = Infinity;
    FOCUS_KEYS.forEach(function (k) {
      var stats = FOCUS[k].stats, sum = 0, n = 0;
      stats.forEach(function (s) {
        var v = s === "physique" ? (G.stats && G.stats.physique) : G.substats[s];
        if (typeof v === "number") { sum += v; n++; }
      });
      var avg = n ? sum / n : 70;
      if (avg < bestAvg) { bestAvg = avg; best = k; }
    });
    return best;
  }

  /* ============================== UI =============================== */
  var _lastOutcome = null;

  function subLabel(k) {
    if (k === "physique") return "Physique";
    var L = window.SUBSTAT_LABELS || {};
    return L[k] || k;
  }
  function efficiencyPct() {
    var tr = tr_(), fatigue = (tr && tr.fatigue) || 0;
    var fm = Math.max(0.4, 1 - fatigue / 160);
    return Math.round(fm * ageMult() * (coachActive() ? 1.2 : 1) * 100);
  }
  function renderOutcome(o) {
    var EV = {
      declic: { lbl: "Déclic !", col: "var(--green)" }, plateau: { lbl: "Plateau", col: "var(--amber)" },
      off: { lbl: "Séance ratée", col: "var(--red3)" }, normal: { lbl: "Séance bouclée", col: "var(--text2)" },
      stage: { lbl: "Stage simulateur", col: "#00D4FF" }
    };
    var ev = EV[o.event] || EV.normal;
    var gains = (o.gains && o.gains.length) ? o.gains.map(function (g) { return "+" + g.v + " " + subLabel(g.k); }).join(" · ") : "Aucun gain cette fois";
    return '<div class="rjf-fb" style="border-color:' + ev.col + '55"><span class="rjf-fb-ev" style="color:' + ev.col + '">' + ev.lbl + '</span><span class="rjf-fb-g">' + gains + '</span></div>';
  }
  function renderFocusUI() {
    var host = document.getElementById("train-sessions-content");
    if (!host) return;
    var G = G_(); if (!G) return;
    var tr = tr_(), fatigue = (tr && tr.fatigue) || 0, pa = G.pa || 0, budget = G.budget || 0, eff = efficiencyPct();
    var cards = FOCUS_KEYS.map(function (k) {
      var f = FOCUS[k];
      var chips = f.stats.map(function (s) { return '<span class="rjf-chip">' + subLabel(s) + "</span>"; }).join("");
      return '<div class="rjf-card" style="--bc:' + f.color + '"><div class="rjf-stripe"></div>'
        + '<div class="rjf-name" style="color:' + f.color + '">' + f.label + "</div>"
        + '<div class="rjf-desc">' + f.desc + "</div>"
        + '<div class="rjf-chips">' + chips + "</div>"
        + '<button class="rjf-go" data-focus="' + k + '"' + (pa > 0 ? "" : " disabled") + ">Lancer · 1 PA</button></div>";
    }).join("");
    var prem = PREMIUM.map(function (p) {
      var active = (p.id === "coach" && coachActive());
      var capped = (p.id === "sim_stage" || p.id === "intensive") && premiumUsedThisWeek(p.id);
      var afford = budget >= p.cost, dis = active || capped || !afford;
      var badge = active ? ' <span class="rjp-badge">actif</span>' : capped ? ' <span class="rjp-badge" style="color:var(--muted)">cette semaine</span>' : "";
      var lbl = capped ? "Fait" : p.cost.toLocaleString("fr-FR") + " €";
      return '<div class="rjp-card' + (active ? " on" : "") + '"><div class="rjp-info">'
        + '<div class="rjp-name">' + p.label + badge + "</div>"
        + '<div class="rjp-desc">' + p.desc + "</div></div>"
        + '<button class="rjp-buy" data-prem="' + p.id + '"' + (dis ? " disabled" : "") + ">" + lbl + "</button></div>";
    }).join("");
    var fatCol = fatigue < 40 ? "var(--green)" : fatigue < 75 ? "var(--amber)" : "var(--red3)";
    var effCol = eff >= 85 ? "var(--green)" : eff >= 65 ? "var(--amber)" : "var(--red3)";
    host.innerHTML = '<div class="rjf">'
      + (_lastOutcome ? renderOutcome(_lastOutcome) : "")
      + '<div class="rjf-state"><div class="rjf-state-item"><div class="rjf-state-lbl">Énergie</div>'
      + '<div class="rjf-state-bar"><div class="rjf-state-fill" style="width:' + (100 - fatigue) + "%;background:" + fatCol + '"></div></div></div>'
      + '<div class="rjf-state-eff"><div class="rjf-state-lbl">Efficacité</div><div class="rjf-state-val" style="color:' + effCol + '">' + eff + "%</div></div></div>"
      + '<div class="rjf-kicker">Focus d\'entraînement <span class="rjf-pa">' + pa + " PA</span></div>"
      + '<div class="rjf-grid">' + cards + "</div>"
      + '<button class="rjf-rest" data-rest="1"' + (pa > 0 ? "" : " disabled") + ">Récupérer · 1 PA · \u221235 énergie</button>"
      + '<div class="rjf-kicker rjf-kicker-prem">Programmes premium</div>'
      + '<div class="rjf-prem">' + prem + "</div></div>";
    if (!host._rjFocusBound) { host.addEventListener("click", onFocusClick); host._rjFocusBound = true; }
  }
  function afterAction() {
    try { if (typeof window.save === "function") window.save(); } catch (e) {}
    try { if (typeof window.updateUI === "function") window.updateUI(); } catch (e) {}
    renderFocusUI();
  }
  function onFocusClick(e) {
    var t = e.target; if (!t || !t.closest) return;
    var fb = t.closest(".rjf-go");
    if (fb) { var k = fb.getAttribute("data-focus"); var r = runFocus(k); if (r.ok) _lastOutcome = { event: r.event, gains: r.gains }; afterAction(); return; }
    var rb = t.closest(".rjf-rest");
    if (rb) { doRest(); _lastOutcome = null; afterAction(); return; }
    var pb = t.closest(".rjp-buy");
    if (pb) { var id = pb.getAttribute("data-prem"); var pr = runPremium(id); if (pr.ok && pr.result) _lastOutcome = { event: pr.result.event, gains: pr.result.gains }; afterAction(); return; }
  }
  function injectFocusCSS() {
    if (document.getElementById("rj-focus-css")) return;
    var css = [
      '.rjf{padding:0 14px;font-family:var(--font-display)}',
      '.rjf-fb{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:9px;background:var(--surface2);border:1px solid;margin-bottom:12px}',
      '.rjf-fb-ev{font-size:11px;font-weight:900;letter-spacing:.03em;white-space:nowrap}',
      '.rjf-fb-g{font-size:11px;font-weight:700;color:var(--text2)}',
      '.rjf-state{display:flex;align-items:flex-end;gap:14px;margin-bottom:14px}',
      '.rjf-state-item{flex:1}',
      '.rjf-state-lbl{font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin-bottom:5px}',
      '.rjf-state-bar{height:6px;border-radius:3px;background:rgba(255,255,255,.06);overflow:hidden}',
      '.rjf-state-fill{height:100%;border-radius:3px;transition:width .4s ease}',
      '.rjf-state-eff{text-align:right;flex-shrink:0}',
      '.rjf-state-val{font-size:16px;font-weight:900;font-variant-numeric:tabular-nums}',
      '.rjf-kicker{font-size:9.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin:0 0 11px;display:flex;align-items:center;justify-content:space-between}',
      '.rjf-kicker-prem{margin-top:20px}',
      '.rjf-pa{font-size:9.5px;font-weight:800;color:var(--text2);letter-spacing:.06em}',
      '.rjf-grid{display:flex;flex-direction:column;gap:11px}',
      '.rjf-card{position:relative;border-radius:11px;background:linear-gradient(180deg,var(--bg3),var(--bg2));border:1px solid var(--border);overflow:hidden;padding:12px 13px 13px 16px}',
      '.rjf-stripe{position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--bc);box-shadow:0 0 16px var(--bc)}',
      '.rjf-name{font-size:13px;font-weight:900;letter-spacing:.02em;text-transform:uppercase;margin-bottom:3px}',
      '.rjf-desc{font-size:10.5px;font-weight:600;color:var(--muted);line-height:1.4;margin-bottom:9px}',
      '.rjf-chips{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px}',
      '.rjf-chip{font-size:9.5px;font-weight:700;color:var(--text2);padding:3px 8px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid var(--border)}',
      '.rjf-go{width:100%;padding:10px;border-radius:8px;background:var(--bc);color:#08080a;border:none;font-family:inherit;font-size:11px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;transition:filter .15s,box-shadow .15s;box-shadow:0 0 14px -4px var(--bc)}',
      '.rjf-go:hover{filter:brightness(1.1);box-shadow:0 0 18px -2px var(--bc)}',
      '.rjf-go:disabled{opacity:.35;cursor:not-allowed;box-shadow:none}',
      '.rjf-rest{width:100%;margin-top:11px;padding:10px;border-radius:8px;background:rgba(255,255,255,.03);color:var(--text2);border:1px solid var(--border-hi);font-family:inherit;font-size:10.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;transition:background .15s}',
      '.rjf-rest:hover{background:rgba(255,255,255,.07)}',
      '.rjf-rest:disabled{opacity:.35;cursor:not-allowed}',
      '.rjf-prem{display:flex;flex-direction:column;gap:9px}',
      '.rjp-card{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:10px;background:var(--surface2);border:1px solid var(--border)}',
      '.rjp-card.on{border-color:var(--green);background:rgba(0,230,118,.05)}',
      '.rjp-info{flex:1;min-width:0}',
      '.rjp-name{font-size:11.5px;font-weight:800;color:var(--text);margin-bottom:2px}',
      '.rjp-badge{font-size:8px;font-weight:900;color:var(--green);letter-spacing:.08em;text-transform:uppercase;vertical-align:middle}',
      '.rjp-desc{font-size:9.5px;font-weight:600;color:var(--muted);line-height:1.35}',
      '.rjp-buy{flex-shrink:0;padding:8px 12px;border-radius:8px;background:rgba(255,179,0,.10);color:var(--amber);border:1px solid rgba(255,179,0,.30);font-family:inherit;font-size:10.5px;font-weight:900;font-variant-numeric:tabular-nums;cursor:pointer;white-space:nowrap;transition:background .15s}',
      '.rjp-buy:hover{background:rgba(255,179,0,.18)}',
      '.rjp-buy:disabled{opacity:.3;cursor:not-allowed}'
    ].join("");
    var st = document.createElement("style"); st.id = "rj-focus-css"; st.textContent = css;
    document.head.appendChild(st);
  }
  var _origRTS = null;
  function wrapTrainScreen() {
    if (typeof window.renderTrainScreen !== "function") return false;
    if (window.renderTrainScreen._rjFocus) return true;
    _origRTS = window.renderTrainScreen;
    window.renderTrainScreen = function () {
      var r = _origRTS.apply(this, arguments);
      try { renderFocusUI(); } catch (e) {}
      return r;
    };
    window.renderTrainScreen._rjFocus = true;
    return true;
  }

  function install() {
    if (window._rjTrainInstalled) return;
    window._rjTrainInstalled = true;
    try { injectFocusCSS(); } catch (e) {}
    try {
      var tries = 0;
      (function tryWrap() {
        var a = false, b = false;
        try { a = wrapTrainScreen(); if (a) { try { renderFocusUI(); } catch (e) {} } } catch (e) {}
        try { b = wrapNextSeason(); } catch (e) {}
        if (a && b) return;
        if (tries++ < 40 && typeof setTimeout === "function") setTimeout(tryWrap, 150);
      })();
    } catch (e) {}
    window._rjTrain = {
      FOCUS: FOCUS, FOCUS_KEYS: FOCUS_KEYS, PREMIUM: PREMIUM,
      runFocus: runFocus, computeFocusOutcome: computeFocusOutcome, runPremium: runPremium,
      doRest: doRest, lowestFocus: lowestFocus, renderFocusUI: renderFocusUI,
      premiumUsedThisWeek: premiumUsedThisWeek, resetSeasonState: resetSeasonState,
      ageMult: ageMult, coachActive: coachActive
    };
    window._rjTrainUninstall = function () {
      if (_origRTS) window.renderTrainScreen = _origRTS;
      if (_origNextSeason) window.startNextSeason = _origNextSeason;
      var s = document.getElementById("rj-focus-css"); if (s && s.parentNode) s.parentNode.removeChild(s);
      window._rjTrainInstalled = false;
      console.log("[38-training-rework] désinstallé");
    };
    console.log("[38-training-rework] actif — focus + premium + UI");
  }

  install();
})();
