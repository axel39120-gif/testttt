/* =====================================================================
 * 37-superformula-identity.js — IDENTITÉ DE DISCIPLINE : SUPER FORMULA
 *
 * Système 1 — OVERTAKE SYSTEM (OTS).
 *   Le levier emblématique de la Super Formula : un boost moteur à la
 *   demande, mais en usages LIMITÉS et avec un COOLDOWN entre deux
 *   activations (saveur distincte du push-to-pass IndyCar). C'est LE
 *   moyen de dépasser sur les tracés japonais rapides.
 *
 * Système 2 — IDENTITÉ VITESSE PURE.
 *   Ces monoplaces récompensent la vitesse brute : un offset de pace
 *   maintenu, lié à la sous-stat vitesse_pure du joueur, donne son
 *   caractère sprint à la discipline (un pilote rapide y brille, un
 *   profil régulier/stratège un peu moins).
 *
 * Option A : aucun fichier cœur modifié. Watcher (pattern WEC/IndyCar)
 * sur LIVE_RACE, offsets maintenus et réversibles, n'agissant que sur le
 * score du joueur. UI (bouton OTS) branchée dans le module 33.
 * Réversible : window._rjSFUninstall(). Détection via G.cat.
 * =================================================================== */
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
