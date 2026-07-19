/* =====================================================================
 * 35-wec-identity.js — IDENTITÉ DE DISCIPLINE : ENDURANCE WEC
 *
 * Système 1 — RELAIS DE PILOTES RÉEL (partage du volant).
 *   La voiture est partagée entre le joueur et un (ou deux, au Mans)
 *   coéquipier(s). Pendant le stint d'un coéquipier, le score de la
 *   voiture reçoit un offset (skillCoéquipier − ratingJoueur) atténué :
 *   ton résultat dépend aussi de tes équipiers. Remplace l'effet
 *   « relais » cosmétique de tickRace.
 *
 * Système 2 — MULTI-CLASSES + TRAFIC.
 *   On injecte un plateau LMP2 + GT3 plus lent (le joueur et ses rivaux
 *   directs sont la classe reine Hypercar). Comme le trafic roule sous
 *   le rythme Hypercar, la position scratch du joueur reste sa position
 *   en classe — points et résultat inchangés. Le trafic crée de la
 *   variance (incidents à négocier, modulés par la concentration).
 *
 * Option A : aucun fichier cœur modifié. Injection via wrap de
 * runRaceLive ; maintenance via un watcher (pattern auto-pit module 31)
 * sur LIVE_RACE, idempotent. Réversible : window._rjWecUninstall().
 *
 * S'appuie sur : getTeammateRival, _isWECRace, _isLongEnduranceRace,
 * _isLeMansRace, calcPlayerRating, runRaceLive, rjRadioPush.
 * =================================================================== */
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
