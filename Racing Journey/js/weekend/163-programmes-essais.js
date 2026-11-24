/* =====================================================================
 * 163-programmes-essais.js — CE QUE LES ESSAIS RAPPORTENT AU WEEK-END
 *
 * POURQUOI
 * Rouler aux essais libres n'apportait rien : le réglage se trouvait sans
 * quitter le stand et sauter les séances ne coûtait rien (audit v303).
 *
 * CE QUE FAIT LE MODULE
 * Une séance = un programme (choisi au stand, 18-weekend) et une médaille :
 *   - Réglages    : la zone idéale se resserre (effet : le réglage lui-même) ;
 *   - Tour rapide : jusqu'à 0,165 % du tour en qualif, 0,15 s au plus ;
 *   - Long relais : jusqu'à 0,15 % par tour sur les 40 derniers % de course.
 * Les rivaux se préparent aussi : un niveau 0 à 3 par pilote et par
 * week-end, tiré de son nom (stable) et de la force de son écurie.
 *
 * ÉTAT : G._essais = { cle, medailles } ; périmé dès que le week-end change.
 * Réversible : window._rj163Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[163-programmes]", ID = "163-programmes";
  var QUALIF = [0, 0.00055, 0.0011, 0.00165], COURSE = [0, 0.0005, 0.001, 0.0015], MAX_QUALIF = 0.15, DEBUT_FIN = 0.6;
  var NOMS = ["", "Bronze", "Argent", "Or"];

  function cle() { return [G.cat, G.saison || 0, G.semaine || 0].join("#"); }
  function etat() {
    if (!G._essais || G._essais.cle !== cle()) G._essais = { cle: cle(), medailles: {} };
    return G._essais;
  }
  function medaille(id) { return (G._essais && G._essais.cle === cle() && G._essais.medailles[id]) || 0; }
  /* La meilleure médaille du week-end reste ; renvoie celle qui compte. */
  function noter(id, m) {
    var e = etat();
    return e.medailles[id] = Math.max(e.medailles[id] || 0, m);
  }

  function hasard(txt) {
    var h = 0x811c9dc5;
    for (var i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  }
  function niveauRival(d, sujet) {
    var force = 75;
    try { if (d.team) force = getEffectiveTeamRating(d.team) || 75; } catch (e) { }
    var x = hasard(cle() + sujet + d.name) + (force - 75) / 100;
    return x < 0.15 ? 0 : x < 0.5 ? 1 : x < 0.85 ? 2 : 3;
  }
  function niveau(d, sujet) { return d.isPlayer ? medaille(sujet) : niveauRival(d, sujet); }

  function gainQualif(n, base) { return Math.min(MAX_QUALIF, QUALIF[n] * base); }

  /* Le tour vient d'être compté : le gain s'applique au tour suivant (81). */
  function surTour(tour, lr) {
    if (!lr || !lr.drivers || !lr.total || tour < lr.total * DEBUT_FIN) return;
    if (lr._rjNeutral && lr._rjNeutral.active) return;
    var base = lr.baseRef > 0 ? lr.baseRef : 90;
    lr.drivers.forEach(function (d) {
      if (!d || d.dnf || d._mc) return;
      var n = niveau(d, "relais");
      if (n) d._rj81EvtSec = (d._rj81EvtSec || 0) - COURSE[n] * base;
    });
  }

  function sec(x) { return Math.abs(x).toFixed(2).replace(".", ",") + " s"; }
  /* Une ligne : ce que les essais valent en qualif et en course. */
  function bilan(base) {
    var reglage = typeof window._rj76Delta === "function" ? window._rj76Delta() * base : 0;
    var q = reglage - gainQualif(medaille("rapide"), base);
    var c = COURSE[medaille("relais")] * base;
    return "Qualif " + (Math.abs(q) < 0.005 ? "=" : (q < 0 ? "−" : "+") + sec(q)) +
      " · Fin de course " + (c ? "−" + sec(c) + " par tour" : "=");
  }

  function boot() {
    if (typeof rjInscrire !== "function" || typeof qualiDriverTime !== "function" || !Array.isArray(window.RJ_LAP_HOOKS)) return setTimeout(boot, 100);
    rjInscrire("qualiDriverTime", { id: ID, ordre: -4400, remplace: function (args, suite) {
      var t = suite(), d = args[0];
      if (!d || typeof t !== "number" || !isFinite(t)) return t;
      return t - gainQualif(niveau(d, "rapide"), QUALI_STATE.baseRef || 0);
    } });
    window.RJ_LAP_HOOKS.push({ id: ID, run: surTour });
    window.RJEssais = { medaille: medaille, noter: noter, bilan: bilan, NOMS: NOMS, niveauRival: niveauRival, gainQualif: gainQualif };
    window._rj163Uninstall = function () {
      rjDesinscrire([ID], "qualiDriverTime");
      window.RJ_LAP_HOOKS = window.RJ_LAP_HOOKS.filter(function (h) { return !h || h.id !== ID; });
      delete window.RJEssais;
    };
    console.log(TAG, "actif — les essais comptent en qualif et en course");
  }
  boot();
})();
