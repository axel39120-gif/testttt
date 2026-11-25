/* =====================================================================
 * 172-concurrence.js — UN PLATEAU QUI VIT, LUI AUSSI
 *
 * POURQUOI (mesuré, v316)
 * Un joueur gagnait 65 % de ses courses avec 10 % de poles. Trois raisons,
 * toutes réservées au joueur :
 *   - ses événements de course lui rapportaient jusqu'à dix secondes par
 *     course, quand les rivaux n'en vivaient aucun ;
 *   - son réglage comptait dans l'absolu en course (en qualif, il était déjà
 *     comparé au réglage de base des écuries) ;
 *   - il progressait toute la saison, huit points au-dessus de l'élite de sa
 *     catégorie, face à un plateau figé.
 *
 * CE QUE FAIT LE MODULE
 *   - ÉVÉNEMENTS : quand tu en vis un, les rivaux vivent le leur : un bon choix
 *     moyen, avec sa part de réussite et d'échec. Bien choisir reste un gain.
 *   - PROGRÈS : les pilotes de devant progressent en cours de saison, comme toi
 *     (au plus PROGRES_MAX points, rendus à l'intersaison par le recalibrage).
 * Aucun élastique : rien ne dépend de tes résultats.
 *
 * Réversible : window._rj172Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[172-concurrence]", ID = "172-concurrence", PROGRES_MAX = 3, PART = .35;

  function gauss() { var u = 1 - Math.random(), v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  /* Ce que rapporte en moyenne le meilleur choix, en secondes (0,01 ≈ 0,9 s, conversion de 04). */
  function esperance(ev) {
    var L = (ev && ev.choices || []).map(function (c) {
      var m = typeof c.mod === "number" ? c.mod : c.mods && typeof c.mods.player === "number" ? c.mods.player : 0;
      var k = c.chance && c.chance.fail > 0 ? c.chance.fail * (c.chance.failMod || 0) : 0;
      return (m + k) * 90;
    });
    return L.length ? Math.max(0, Math.min(3, Math.max.apply(null, L))) : 0;
  }
  function pourLesRivaux(ev) {
    var lr = window.LIVE_RACE;
    if (!lr || !lr.drivers || typeof _evtAddPaceMod !== "function") return;
    var x = esperance(ev) * PART;
    if (!(x > 0)) return;
    lr.drivers.forEach(function (d) {
      if (!d || d.isPlayer || d.dnf || d._mc) return;
      var s = Math.max(-1.5, Math.min(3.5, x + gauss() * .8));
      if (Math.abs(s) >= .1) _evtAddPaceMod(d, -s / 3, 3, "Événement");
    });
  }

  function progres() {
    if (!window.G || !Array.isArray(G.rivals)) return;
    var L = G.rivals.filter(function (r) { return r && typeof r.skill === "number"; }).sort(function (a, b) { return b.skill - a.skill; });
    var cle = G.saison + "#" + G.cat;
    L.slice(0, Math.ceil(L.length / 2)).forEach(function (r) {
      if (r._rj172 !== cle) { r._rj172 = cle; r._rj172Gain = 0; }
      if (r._rj172Gain < PROGRES_MAX && r.skill < 96 && Math.random() < .32) { r.skill++; r._rj172Gain++; }
    });
  }

  function boot() {
    if (typeof rjInscrire !== "function" || !Array.isArray(window.RACE_POST_HOOKS) || typeof window.resolveLiveEvent !== "function") return setTimeout(boot, 100);
    var ev = null;
    rjInscrire("resolveLiveEvent", { id: ID, ordre: -8900,
      avant: function () { ev = window.LIVE_RACE && LIVE_RACE.pendingEvent; },
      apres: function () { try { pourLesRivaux(ev); } catch (e) { console.warn(TAG, e && e.message); } ev = null; } });
    window.RACE_POST_HOOKS.push({ id: ID, run: progres });
    window.RJConcurrence = { esperance: esperance, progres: progres, pourLesRivaux: pourLesRivaux };
    window._rj172Uninstall = function () {
      rjDesinscrire([ID], "resolveLiveEvent");
      window.RACE_POST_HOOKS = window.RACE_POST_HOOKS.filter(function (h) { return !h || h.id !== ID; });
      delete window.RJConcurrence;
    };
    console.log(TAG, "actif");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
