/* =====================================================================
 * 00-hooks.js — POINTS D'EXTENSION DES FONCTIONS DU JEU
 *
 * POURQUOI
 * Les modules modifiaient le jeu en enveloppant ses fonctions
 * (var orig = window.X; window.X = function () { … orig … }). Ces couches
 * s'empilaient, et le comportement final dépendait de l'ordre de chargement.
 *
 * LA RÈGLE
 * Une fonction n'est définie qu'une fois. Si des modules doivent y réagir,
 * elle passe par rjAppeler, et les modules s'inscrivent :
 *
 *   function X(a, b) { return rjAppeler("X", _XCoeur, this, arguments); }
 *
 *   rjInscrire("X", {
 *     id, ordre,                  // ordre croissant (0 par défaut), puis inscription
 *     avant(args),                // effet préalable
 *     remplace(args, suite),      // prend la main ; suite() poursuit la chaîne
 *     apres(resultat, args)       // effet postérieur ; une valeur ≠ undefined
 *   });                           //   remplace le résultat
 *
 * Les écrans, la saison, le départ de course, etc. ont leurs propres
 * registres (RJ_SCREEN_HOOKS, RJ_SEASON_HOOKS…), plus anciens : même idée.
 * =================================================================== */

window.RJ_HOOKS = window.RJ_HOOKS || {};

function rjInscrire(nom, hook) {
  var L = (window.RJ_HOOKS[nom] = window.RJ_HOOKS[nom] || []);
  if (hook && hook.id && L.some(function (h) { return h.id === hook.id; })) return;
  L.push(hook);
}

function rjAppeler(nom, coeur, self, args) {
  var L = (window.RJ_HOOKS[nom] || [])
    .map(function (h, i) { return { h: h, i: i }; })
    .filter(function (x) { return !!x.h; })
    .sort(function (a, b) { return ((a.h.ordre || 0) - (b.h.ordre || 0)) || (a.i - b.i); })
    .map(function (x) { return x.h; });

  function essayer(h, m, a) {
    try { return h[m].apply(h, a); }
    catch (e) { console.warn("[" + nom + "] « " + (h.id || "?") + " » (" + m + ") :", e && e.message); }
  }

  L.forEach(function (h) { if (typeof h.avant === "function") essayer(h, "avant", [args]); });

  /* remplace(args, suite) est appelé avec le this de l'appel d'origine ;
     suite(autresArgs?) poursuit la chaîne, avec d'autres arguments au besoin. */
  var remplacants = L.filter(function (h) { return typeof h.remplace === "function"; });
  function suite(k, a) {
    return function (autres) {
      var b = autres ? [].slice.call(autres) : a;
      if (k >= remplacants.length) return coeur.apply(self, b);
      return remplacants[k].remplace.call(self, b, suite(k + 1, b));
    };
  }
  var r = suite(0, args)();

  L.forEach(function (h) {
    if (typeof h.apres !== "function") return;
    var v = essayer(h, "apres", [r, args]);
    if (v !== undefined) r = v;
  });
  return r;
}
