/* =====================================================================
 * 35-identites-disciplines.js — CE QUI DISTINGUE CHAQUE CHAMPIONNAT
 *
 * Regroupe les trois modules d'identité de discipline. Chacun ajoute au
 * moteur commun ce qui fait la singularité de son championnat : plateau
 * multi-classes et relais en endurance, ovales et push-to-pass en IndyCar,
 * overtake system en Super Formula.
 *
 * Ils sont indépendants les uns des autres — aucun n'appelle l'autre, et
 * chacun ne s'active que dans sa propre catégorie. Leur regroupement ne
 * change donc rien à leur comportement, seulement au nombre de fichiers.
 *
 * Chaque partie conserve sa désinstallation d'origine : _rjWecUninstall,
 * _rjIndyUninstall, _rjSFUninstall.
 * =================================================================== */

/* ==================================================================== *
 * ENDURANCE WEC — multi-classes, relais, Hyperpole
 * (anciennement 35-wec-identity.js)
 * ==================================================================== */

(function () {
  "use strict";

  function G_() { return window.G; }
  function lr() { return window.LIVE_RACE; }

  function isWec() {
    try { return typeof _isWECRace === "function" && _isWECRace(); } catch (e) { return false; }
  }
  function isWecEndurance() {
    try {
      return isWec() && typeof _isLongEnduranceRace === "function" && _isLongEnduranceRace();
    } catch (e) { return false; }
  }
  function isLeMans() {
    try { return typeof _isLeMansRace === "function" && _isLeMansRace(); } catch (e) { return false; }
  }

  function raceLive() {
    var L = lr();
    return !!(L && !L.finished && L.total > 0 && Array.isArray(L.drivers) && L.drivers.length);
  }
  function playerDriver() {
    var L = lr();
    if (!L || !L.drivers) return null;
    for (var i = 0; i < L.drivers.length; i++) if (L.drivers[i].isPlayer) return L.drivers[i];
    return null;
  }
  function playerRating() {
    if (typeof calcPlayerRating === "function") { try { return calcPlayerRating(); } catch (e) {} }
    return 60;
  }
  function radio(title, msg, color) {
    try { if (typeof window.rjRadioPush === "function") { window.rjRadioPush(title, msg, { color: color || "#22D3EE" }); return; } } catch (e) {}
    try { if (typeof window.showToast === "function") window.showToast(msg); } catch (e) {}
  }

  /* ===================== SYSTÈME 1 — RELAIS ========================= */

  function lineup() {
    var mates = [];
    var tm = (typeof getTeammateRival === "function") ? getTeammateRival() : null;
    if (tm && tm.name) mates.push({ name: tm.name, skill: (typeof tm.skill === "number" ? tm.skill : playerRating() - 4) });
    else mates.push({ name: "Coéquipier", skill: Math.max(40, Math.min(92, playerRating() - 5)) });
    if (isLeMans()) mates.push({ name: "3e pilote", skill: Math.max(40, Math.min(92, playerRating() - 7)) });
    return mates;
  }

  function buildPlan() {
    var mates = lineup(), nMate = mates.length;
    var stints = isLeMans() ? 8 : 5;
    var share = (G_() && G_()._wecRelayShare) || 0.55;
    share = Math.max(0.30, Math.min(0.80, share));
    var playerStints = Math.max(1, Math.min(stints - 1, Math.round(share * stints)));
    var mateStints = stints - playerStints;

    var seq = [], pCount = 0, mCount = 0, mateRot = 0;
    for (var i = 0; i < stints; i++) {
      var remP = playerStints - pCount, remM = mateStints - mCount;
      var prev = seq.length ? seq[seq.length - 1].who : null, who;
      if (remP <= 0) who = "mate";
      else if (remM <= 0) who = "player";
      else who = (prev === "player") ? "mate" : "player";
      if (who === "player") { seq.push({ who: "player" }); pCount++; }
      else { seq.push({ who: "mate", mate: mateRot % nMate }); mCount++; mateRot++; }
    }
    var plan = [];
    for (var j = 0; j < stints; j++) plan.push({ from: j / stints, to: (j + 1) / stints, who: seq[j].who, mate: seq[j].mate });
    return { mates: mates, plan: plan };
  }

  function segAt(plan, pct) {
    for (var i = 0; i < plan.length; i++) if (pct >= plan[i].from && pct < plan[i].to) return plan[i];
    return plan[plan.length - 1];
  }
  function mateOffset(mateSkill) {
    var v = (mateSkill - playerRating()) / 100;
    return Math.max(-0.18, Math.min(0.10, v * 0.85));
  }

  function syncRelay() {
    if (!raceLive() || !isWecEndurance()) return;
    var L = lr(), pd = playerDriver();
    if (!pd) return;
    if (!L._relayPlan) { var b = buildPlan(); L._relayPlan = b.plan; L._relayMates = b.mates; L._relayDriver = null; L._relayOffset = 0; }
    var pct = L.total > 0 ? L.cur / L.total : 0;
    var seg = segAt(L._relayPlan, pct);
    var key = seg.who === "player" ? "player" : ("mate" + seg.mate);
    if (L._relayDriver === key) return;
    if (L._relayOffset) { pd.score = Math.max(.02, Math.min(.98, pd.score - L._relayOffset)); L._relayOffset = 0; }
    if (seg.who === "mate") {
      var mate = (L._relayMates && L._relayMates[seg.mate]) || { name: "Coéquipier", skill: playerRating() - 5 };
      var off = mateOffset(mate.skill);
      pd.score = Math.max(.02, Math.min(.98, pd.score + off));
      L._relayOffset = off; L._relayMateName = mate.name;
      radio("Changement de pilote", mate.name + " prend le relais.", "#22D3EE");
    } else {
      L._relayMateName = null;
      radio("Changement de pilote", "Tu reprends le volant.", "#22D3EE");
    }
    L._relayDriver = key;
  }

  /* ================== SYSTÈME 2 — MULTI-CLASSES ==================== */

  function minHypercarScore() {
    var L = lr(), m = 1;
    if (L && L.drivers) L.drivers.forEach(function (d) { if (!d._mc && typeof d.score === "number" && d.score < m) m = d.score; });
    return m === 1 ? 0.6 : m;
  }

  function mkCar(cls, num, score) {
    return {
      name: cls + " " + num, nat: "", isPlayer: false, _mc: true, cls: cls,
      score: score, baseScore: score, consistency: 0.8, skill: Math.round(score * 100),
      pos: 99, gridPos: 99, gap: 0, dnf: false, eliminated: false, laps: 0, team: cls, evtMod: 0
    };
  }

  function buildTrafficField() {
    var field = [], i;
    for (i = 0; i < 4; i++) field.push(mkCar("LMP2", "#" + (20 + i), 0.40 + Math.random() * 0.11));
    for (i = 0; i < 6; i++) field.push(mkCar("GT3", "#" + (50 + i), 0.25 + Math.random() * 0.12));
    // garantir un score strictement sous la classe reine
    var cap = Math.min(minHypercarScore() - 0.04, 0.52);
    field.forEach(function (c) { if (c.score > cap) { c.score = cap - 0.02 * Math.random(); c.baseScore = c.score; } });
    return field;
  }

  function injectTraffic() {
    var L = lr();
    if (!L || !Array.isArray(L.drivers) || L._mcInjected) return;
    if (!isWec()) return;
    L.drivers.forEach(function (d) { if (!d._mc && !d.cls) d.cls = "Hypercar"; });
    var field = buildTrafficField(), base = L.drivers.length;
    field.forEach(function (c, i) { c.pos = base + i + 1; c.gridPos = base + i + 1; L.drivers.push(c); });
    L._mcInjected = true; L._mcCount = field.length;
    radio("Plateau multi-classes", field.length + " LMP2 et GT en piste — gère le trafic.", "#FFB300");
  }

  /* Sécurité : garde le trafic strictement derrière la classe reine. */
  function clampTraffic() {
    var L = lr();
    if (!L || !L._mcInjected) return;
    var cap = minHypercarScore() - 0.03;
    L.drivers.forEach(function (d) { if (d._mc && d.score > cap) d.score = Math.max(.02, cap); });
  }

  /* Incidents de trafic : variance modulée par la concentration. */
  function applyTrafficIncident() {
    var L = lr(), pd = playerDriver();
    if (!pd) return;
    var conc = (G_() && G_().substats && G_().substats.concentration) || 50;
    var skillFactor = (conc - 50) / 50;                 // -1..+1
    var delta = (0.015 * skillFactor) - 0.012 * Math.random();
    delta = Math.max(-0.025, Math.min(0.015, delta));
    pd.score = Math.max(.02, Math.min(.98, pd.score + delta));
    var good = delta >= 0;
    radio("Trafic", good ? "Trafic bien négocié, tu grappilles du temps." : "Bloqué derrière une GT, tu perds du terrain.",
          good ? "#00E676" : "#FFB300");
  }

  function trafficTick() {
    var L = lr();
    if (!L || !L._mcInjected) return;
    if (!L._mcTrafficPts) { L._mcTrafficPts = [0.22, 0.50, 0.74]; L._mcTrafficDone = []; }
    var pct = L.total > 0 ? L.cur / L.total : 0;
    for (var i = 0; i < L._mcTrafficPts.length; i++) {
      if (pct >= L._mcTrafficPts[i] && L._mcTrafficDone.indexOf(i) < 0) {
        L._mcTrafficDone.push(i);
        applyTrafficIncident();
      }
    }
  }

  /* ===================== boucle + install ========================== */

  function syncWec() {
    if (!raceLive()) return;
    if (isWec()) { injectTraffic(); clampTraffic(); trafficTick(); }
    if (isWecEndurance()) { syncRelay(); }
  }

  var _timer = null;
  function startWatch() { if (_timer) return; _timer = setInterval(function () { try { syncWec(); } catch (e) {} }, 400); }
  function stopWatch() { if (_timer) { clearInterval(_timer); _timer = null; } }

  function install() {
    if (window._rjWecInstalled) return;
    window._rjWecInstalled = true;
    startWatch();   // injection + maintenance pilotées par le watcher (idempotent), sans toucher runRaceLive

    window._rjWec = {
      syncWec: syncWec, syncRelay: syncRelay, buildPlan: buildPlan, segAt: segAt,
      mateOffset: mateOffset, lineup: lineup, playerDriver: playerDriver,
      isWec: isWec, isWecEndurance: isWecEndurance,
      injectTraffic: injectTraffic, buildTrafficField: buildTrafficField,
      clampTraffic: clampTraffic, trafficTick: trafficTick,
      applyTrafficIncident: applyTrafficIncident, minHypercarScore: minHypercarScore,
      setRelayShare: function (x) { var G = G_(); if (G) G._wecRelayShare = Math.max(0.30, Math.min(0.80, x)); },
      replanRelay: function () {
        var L = lr(), pd = playerDriver();
        if (!L) return;
        if (pd && L._relayOffset) pd.score = Math.max(.02, Math.min(.98, pd.score - L._relayOffset));
        L._relayOffset = 0; L._relayPlan = null; L._relayDriver = null; L._relayMateName = null;
      }
    };
    window._rjWecUninstall = function () {
      stopWatch();
      window._rjWecInstalled = false;
      console.log("[35-wec-identity] désinstallé");
    };
    console.log("[35-wec-identity] actif — relais de pilotes + multi-classes WEC");
  }

  install();
})();


/* ==================================================================== *
 * INDYCAR — ovales, push-to-pass, segments de qualification
 * (anciennement 36-indycar-identity.js)
 * ==================================================================== */

(function () {
  "use strict";

  var RESERVE_INIT = 180;   // secondes de push-to-pass par course
  var COST = 18;            // coût d'une activation (s)
  var BOOST = 0.06;         // offset de score pendant l'activation
  var DURATION = 1;         // durée en tours

  function G_() { return window.G; }
  function lr() { return window.LIVE_RACE; }

  function isIndy() {
    try { return !!(G_() && G_().cat === "IndyCar"); } catch (e) { return false; }
  }
  function isOval() {
    try { return typeof _isOvalRace === "function" && _isOvalRace(); } catch (e) { return false; }
  }
  function raceLive() {
    var L = lr();
    return !!(L && !L.finished && L.total > 0 && Array.isArray(L.drivers) && L.drivers.length);
  }
  function playerDriver() {
    var L = lr();
    if (!L || !L.drivers) return null;
    for (var i = 0; i < L.drivers.length; i++) if (L.drivers[i].isPlayer) return L.drivers[i];
    return null;
  }
  function radio(title, msg, color) {
    try { if (typeof window.rjRadioPush === "function") { window.rjRadioPush(title, msg, { color: color || "#FF1801" }); return; } } catch (e) {}
    try { if (typeof window.showToast === "function") window.showToast(msg); } catch (e) {}
  }

  function ensureP2P() {
    var L = lr();
    if (!L) return null;
    if (!L._p2p) L._p2p = { reserve: RESERVE_INIT, active: false, until: -1, boost: 0 };
    return L._p2p;
  }

  /* Activation — déclenchée par le bouton de l'overlay (module 33). */
  function activateP2P() {
    if (!raceLive() || !isIndy()) return false;
    var L = lr(), pd = playerDriver();
    if (!pd || pd.dnf) return false;
    var s = ensureP2P();
    if (s.active) return false;                       // déjà en cours
    if (s.reserve < COST) { radio("Push to pass", "Réserve épuisée.", "#EF4444"); return false; }
    s.reserve -= COST;
    s.boost = BOOST;
    pd.score = Math.min(.98, pd.score + s.boost);
    s.active = true;
    s.until = (L.cur || 0) + DURATION;
    radio("Push to pass", "Boost enclenché — à l'attaque !", "#FF1801");
    return true;
  }

  /* Décompte : retire le boost en fin d'activation (deltas préservés). */
  function p2pTick() {
    if (!raceLive() || !isIndy()) return;
    var L = lr(), pd = playerDriver(), s = ensureP2P();
    if (s && s.active && pd && (L.cur || 0) >= s.until) {
      pd.score = Math.max(.02, pd.score - s.boost);
      s.boost = 0; s.active = false;
    }
  }

  /* ============ SYSTÈME 2 — PACK RACING OVALE (aspiration) ========== */
  /* Sur ovale, l'aspiration colle les voitures : dans le sillage on
     gagne, en tête de peloton on est exposé. Effet maintenu sur le score
     du joueur (offset réversible recalculé chaque tick), modélisant le
     pack racing sans toucher aux rivaux ni à la mécanique des écarts. */
  var DRAFT_RANGE = 1.0;   // écart (s) sous lequel l'aspiration agit
  var DRAFT_BOOST = 0.04;  // boost max dans le sillage
  var LEAD_DRAG  = 0.02;   // pénalité max en tête de peloton

  function clearDraft() {
    var L = lr();
    if (!L) return;
    if (L._draftOffset) {
      var pd = playerDriver();
      if (pd) pd.score = Math.max(.02, Math.min(.98, pd.score - L._draftOffset));
    }
    L._draftOffset = 0; L._draftMode = null; L._draft = { active: false, mode: null };
  }

  function ovalDraftTick() {
    if (!raceLive() || !isIndy() || !isOval()) { clearDraft(); return; }
    var L = lr(), pd = playerDriver();
    if (!pd || pd.dnf) { clearDraft(); return; }
    var alive = L.drivers.filter(function (d) { return !d.dnf; });
    var ahead = alive.find(function (d) { return d.pos === pd.pos - 1; });
    var behind = alive.find(function (d) { return d.pos === pd.pos + 1; });

    var target = 0, mode = null;
    if (ahead) {
      var gA = Math.abs((pd.gap || 0) - (ahead.gap || 0));
      if (gA < DRAFT_RANGE) { target = DRAFT_BOOST * (1 - gA / DRAFT_RANGE); mode = "draft"; }
    }
    if (!mode && behind) {
      var gB = Math.abs((behind.gap || 0) - (pd.gap || 0));
      if (gB < DRAFT_RANGE) { target = -LEAD_DRAG * (1 - gB / DRAFT_RANGE); mode = "leading"; }
    }

    var prev = L._draftOffset || 0;
    pd.score = Math.max(.02, Math.min(.98, pd.score - prev + target));   // retire l'ancien, pose le nouveau
    L._draftOffset = target;

    if (L._draftMode !== mode) {
      L._draftMode = mode;
      if (mode === "draft") radio("Aspiration", "Dans le sillage — reste collé pour attaquer !", "#00E676");
      else if (mode === "leading") radio("Tête de peloton", "Tu mènes le pack, exposé à l'aspiration.", "#FFB300");
    }
    L._draft = { active: !!mode, mode: mode };
  }

  /* ============== SYSTÈME 3 — FUEL-SAVE STRATÉGIQUE ================= */
  /* Le carburant n'a aucun effet mécanique dans le moteur ; on lui donne
     un sens autonome et fidèle à l'IndyCar : le mode économie coûte de la
     pace mais accumule une marge, encaissée en push dans la dernière
     partie de course. Arbitrage lift-and-coast tôt → sprint final. */
  var SAVE_DRAG = 0.025;       // pace perdue en économie
  var SAVE_RATE = 0.8;         // marge accumulée par tour économisé
  var FUEL_FINAL = 0.85;       // fraction de course où la marge s'encaisse
  var FUEL_BOOST_MAX = 0.08;
  var FUEL_BOOST_FACTOR = 0.006;

  function ensureFuel() {
    var L = lr();
    if (!L) return null;
    if (!L._fuel) L._fuel = { saving: false, margin: 0, dragOffset: 0, boostOffset: 0, cashed: false, _lastLap: -1 };
    return L._fuel;
  }
  function setFuelSave(on) {
    if (!isIndy()) return false;
    var f = ensureFuel();
    if (!f || f.cashed) return false;          // plus d'économie après encaissement
    f.saving = !!on;
    try { var pd = playerDriver(); if (pd && pd._rjCarState && pd._rjCarState.fuel) { pd._rjCarState.fuel.saving = !!on; pd._rjCarState.fuel.consumption = on ? 0.85 : 1.0; } } catch (e) {}
    radio("Carburant", on ? "Mode économie — on lève le pied pour la fin." : "Économie coupée, rythme normal.", on ? "#FFB300" : "#9CA3AF");
    return true;
  }
  function toggleFuelSave() { var f = ensureFuel(); return setFuelSave(!(f && f.saving)); }

  function fuelTick() {
    if (!raceLive() || !isIndy()) return;
    var L = lr(), pd = playerDriver(), f = ensureFuel();
    if (!pd || pd.dnf || !f) return;
    var pct = L.total > 0 ? L.cur / L.total : 0;

    if (pct >= FUEL_FINAL && !f.cashed) {       // phase finale : encaisser la marge
      if (f.dragOffset) { pd.score = Math.max(.02, Math.min(.98, pd.score - f.dragOffset)); f.dragOffset = 0; }
      f.saving = false;
      var boost = Math.min(FUEL_BOOST_MAX, f.margin * FUEL_BOOST_FACTOR);
      if (boost > 0) { pd.score = Math.min(.98, pd.score + boost); f.boostOffset = boost; radio("Carburant", "Marge encaissée — push final !", "#00E676"); }
      f.cashed = true;
      return;
    }
    if (pct < FUEL_FINAL) {
      var targetDrag = f.saving ? -SAVE_DRAG : 0;
      if ((f.dragOffset || 0) !== targetDrag) {
        pd.score = Math.max(.02, Math.min(.98, pd.score - (f.dragOffset || 0) + targetDrag));
        f.dragOffset = targetDrag;
      }
      if (f.saving && f._lastLap !== L.cur) { f.margin += SAVE_RATE; f._lastLap = L.cur; }
    }
  }

  /* ---------------------------- watcher ----------------------------- */
  var _timer = null;
  function startWatch() {
    if (_timer) return;
    _timer = setInterval(function () {
      try {
        if (raceLive() && isIndy()) {
          ensureP2P(); p2pTick(); fuelTick();
          if (isOval()) ovalDraftTick(); else clearDraft();
        }
      } catch (e) {}
    }, 400);
  }
  function stopWatch() { if (_timer) { clearInterval(_timer); _timer = null; } }

  /* ---------------------------- install ----------------------------- */
  function install() {
    if (window._rjIndyInstalled) return;
    window._rjIndyInstalled = true;
    startWatch();

    window._rjIndy = {
      activateP2P: activateP2P, p2pTick: p2pTick, ensureP2P: ensureP2P,
      getP2P: function () { var L = lr(); return L ? L._p2p : null; },
      ovalDraftTick: ovalDraftTick, clearDraft: clearDraft,
      getDraft: function () { var L = lr(); return L ? L._draft : null; },
      setFuelSave: setFuelSave, toggleFuelSave: toggleFuelSave, fuelTick: fuelTick,
      getFuel: function () { var L = lr(); return L ? L._fuel : null; },
      isIndy: isIndy, isOval: isOval, playerDriver: playerDriver,
      P2P_COST: COST, P2P_RESERVE_INIT: RESERVE_INIT
    };
    window._rjIndyUninstall = function () {
      stopWatch();
      window._rjIndyInstalled = false;
      console.log("[36-indycar-identity] désinstallé");
    };
    console.log("[36-indycar-identity] actif — push-to-pass IndyCar");
  }

  install();
})();


/* ==================================================================== *
 * SUPER FORMULA — overtake system, format japonais
 * (anciennement 37-superformula-identity.js)
 * ==================================================================== */

(function () {
  "use strict";

  var OTS_USES = 5;          // activations par course
  var OTS_COOLDOWN = 3;      // tours de récupération entre activations
  var OTS_BOOST = 0.07;      // offset de score pendant l'activation
  var OTS_DURATION = 1;      // durée en tours
  var VP_REF = 70;           // vitesse_pure de référence (neutre)
  var VP_FACTOR = 0.4;
  var VP_CLAMP = 0.04;

  function G_() { return window.G; }
  function lr() { return window.LIVE_RACE; }

  function isSF() {
    try { return !!(G_() && G_().cat === "Super Formula"); } catch (e) { return false; }
  }
  function raceLive() {
    var L = lr();
    return !!(L && !L.finished && L.total > 0 && Array.isArray(L.drivers) && L.drivers.length);
  }
  function playerDriver() {
    var L = lr();
    if (!L || !L.drivers) return null;
    for (var i = 0; i < L.drivers.length; i++) if (L.drivers[i].isPlayer) return L.drivers[i];
    return null;
  }
  function radio(title, msg, color) {
    try { if (typeof window.rjRadioPush === "function") { window.rjRadioPush(title, msg, { color: color || "#B47BFF" }); return; } } catch (e) {}
    try { if (typeof window.showToast === "function") window.showToast(msg); } catch (e) {}
  }

  /* ---------------------- Overtake System --------------------------- */
  function ensureOTS() {
    var L = lr();
    if (!L) return null;
    if (!L._ots) L._ots = { uses: OTS_USES, active: false, until: -1, boost: 0, readyLap: 0 };
    return L._ots;
  }

  function activateOTS() {
    if (!raceLive() || !isSF()) return false;
    var L = lr(), pd = playerDriver();
    if (!pd || pd.dnf) return false;
    var s = ensureOTS(), cur = L.cur || 0;
    if (s.active) return false;
    if (s.uses <= 0) { radio("Overtake System", "Plus d'activations disponibles.", "#EF4444"); return false; }
    if (cur < s.readyLap) { radio("Overtake System", "Système en récupération.", "#FFB300"); return false; }
    s.uses -= 1;
    s.boost = OTS_BOOST;
    pd.score = Math.min(.98, pd.score + s.boost);
    s.active = true;
    s.until = cur + OTS_DURATION;
    s.readyLap = cur + OTS_DURATION + OTS_COOLDOWN;
    radio("Overtake System", "OTS enclenché — c'est le moment de passer !", "#B47BFF");
    return true;
  }

  function otsTick() {
    if (!raceLive() || !isSF()) return;
    var L = lr(), pd = playerDriver(), s = ensureOTS();
    if (s && s.active && pd && (L.cur || 0) >= s.until) {
      pd.score = Math.max(.02, pd.score - s.boost);
      s.boost = 0; s.active = false;
    }
  }

  /* ---------------------- Identité vitesse pure --------------------- */
  function vpOffset() {
    var vp = 70;
    try { if (G_() && G_().substats && typeof G_().substats.vitesse_pure === "number") vp = G_().substats.vitesse_pure; } catch (e) {}
    var v = ((vp - VP_REF) / 100) * VP_FACTOR;
    return Math.max(-VP_CLAMP, Math.min(VP_CLAMP, v));
  }
  function clearVP() {
    var L = lr();
    if (!L) return;
    if (L._vpOffset) { var pd = playerDriver(); if (pd) pd.score = Math.max(.02, Math.min(.98, pd.score - L._vpOffset)); }
    L._vpOffset = 0;
  }
  function vpTick() {
    if (!raceLive() || !isSF()) { clearVP(); return; }
    var L = lr(), pd = playerDriver();
    if (!pd || pd.dnf) { clearVP(); return; }
    var target = vpOffset(), prev = L._vpOffset || 0;
    if (prev !== target) {
      pd.score = Math.max(.02, Math.min(.98, pd.score - prev + target));
      L._vpOffset = target;
    }
  }

  /* ---------------------------- watcher ----------------------------- */
  var _timer = null;
  function startWatch() {
    if (_timer) return;
    _timer = setInterval(function () {
      try { if (raceLive() && isSF()) { ensureOTS(); otsTick(); vpTick(); } } catch (e) {}
    }, 400);
  }
  function stopWatch() { if (_timer) { clearInterval(_timer); _timer = null; } }

  /* ---------------------------- install ----------------------------- */
  function install() {
    if (window._rjSFInstalled) return;
    window._rjSFInstalled = true;
    startWatch();

    window._rjSF = {
      activateOTS: activateOTS, otsTick: otsTick, ensureOTS: ensureOTS,
      getOTS: function () { var L = lr(); return L ? L._ots : null; },
      vpTick: vpTick, vpOffset: vpOffset, clearVP: clearVP,
      isSF: isSF, playerDriver: playerDriver,
      OTS_USES: OTS_USES, OTS_COOLDOWN: OTS_COOLDOWN
    };
    window._rjSFUninstall = function () {
      stopWatch();
      window._rjSFInstalled = false;
      console.log("[37-superformula-identity] désinstallé");
    };
    console.log("[37-superformula-identity] actif — Overtake System + vitesse pure");
  }

  install();
})();
