/* =====================================================================
 * 36-indycar-identity.js — IDENTITÉ DE DISCIPLINE : INDYCAR
 *
 * Système 1/3 — PUSH-TO-PASS JOUABLE.
 *   Une réserve de boost limitée (en secondes) que le joueur déclenche
 *   à la demande pour un gain de pace temporaire : c'est l'équivalent
 *   IndyCar du DRS, mais piloté par le joueur (levier d'agency à doser
 *   entre attaque et défense). Le boost applique un offset de score
 *   pendant un tour, puis se retire ; la réserve diminue à chaque usage.
 *
 * (Systèmes 2/3 pack racing ovale et 3/3 fuel-save — à venir.)
 *
 * Option A : aucun fichier cœur modifié. Un watcher (pattern auto-pit
 * module 31 / WEC module 35) gère l'init et le décompte sur LIVE_RACE,
 * idempotent. L'UI (bouton) est branchée dans le module 33.
 * Réversible : window._rjIndyUninstall().
 *
 * S'appuie sur : _isOvalRace, calcPlayerRating, rjRadioPush.
 * Détection IndyCar via G.cat === "IndyCar".
 * =================================================================== */
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
