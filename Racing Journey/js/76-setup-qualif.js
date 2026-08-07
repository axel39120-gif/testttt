/* =====================================================================
 * 76-setup-qualif.js — LE RÉGLAGE VOITURE COMPTE ENFIN EN QUALIFICATION
 *
 * CONSTAT (lecture intégrale de runQualiSession et qualiDriverTime dans
 * 04-race-engine.js) : la qualification ignorait totalement le réglage.
 * Zéro occurrence de computeSetupImpact, setupImpact, G.setup ou setupAdv.
 * Le temps au tour n'y dépendait que du niveau du pilote, de sa régularité,
 * d'une forme du jour, de la session, du tour dans le relais, de la
 * pression de fin de session et de l'affinité écurie-circuit.
 *
 * En course, à l'inverse, le réglage agit à plusieurs niveaux : le
 * préréglage croisé au type de circuit (agressif sur tracé rapide +6 %,
 * aéro sur tracé rapide −4 %), la météo (aéro +4 % sous la pluie,
 * agressif −5 %), les neuf réglages fins des essais (jusqu'à +3,25 %), et
 * un multiplicateur d'usure des pneus.
 *
 * Conséquence : le joueur optimisait ses essais libres, l'écran lui
 * promettait un gain de performance, et sa position sur la grille n'en
 * tenait aucun compte. La boucle « je travaille mes essais → je pars plus
 * haut » n'existait pas.
 *
 * CE QUE FAIT CE MODULE
 * ---------------------
 * Il enveloppe qualiDriverTime et applique, POUR LE JOUEUR UNIQUEMENT, un
 * delta de temps au tour dérivé de computeSetupImpact().scoreBonus. Les
 * rivaux n'ont pas de réglage modélisé : leur appliquer quoi que ce soit
 * n'aurait aucun sens.
 *
 * CONVERSION — un bonus de PERFORMANCE n'est pas un gain de TEMPS. Sur un
 * tour, l'écart de talent complet (skillDelta) vaut au maximum 1,375 % du
 * temps de référence. Convertir +6 % de performance en −6 % de temps
 * donnerait 5 secondes sur un tour de 84 s : absurde. Le facteur retenu
 * est 0.12, et le résultat est plafonné à ±1 % :
 *
 *     réglage optimal   (+6 %)  →  −0,72 %  ≈  −0,60 s sur 84 s
 *     réglage inadapté  (−5 %)  →  +0,60 %  ≈  +0,50 s
 *     amplitude totale                      ≈   1,1 s
 *
 * Soit environ la moitié de l'écart de talent maximal : un bon réglage ne
 * compense jamais un mauvais pilote, mais il départage deux pilotes
 * proches — ce qui est le rôle du réglage en qualification.
 *
 * Aucun fichier cœur modifié. Diagnostic : window._rj76Gain().
 * Réversible : window._rj76Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[76-setup-qualif]";
  var FACTEUR = 0.12;      // performance → temps au tour
  var PLAFOND = 0.01;      // ±1 % du temps de référence

  var wrapped = {};
  var etat = { installe: false, dernier: null };
  window._rj76Status = function () { return etat; };

  function bonusReglage() {
    try {
      if (typeof computeSetupImpact !== "function") return 0;
      var i = computeSetupImpact();
      var b = (i && typeof i.scoreBonus === "number") ? i.scoreBonus : 0;
      return isFinite(b) ? b : 0;
    } catch (e) { return 0; }
  }

  // Delta relatif à appliquer au temps au tour. Négatif = plus rapide.
  function delta() {
    var d = -bonusReglage() * FACTEUR;
    if (d > PLAFOND) d = PLAFOND;
    if (d < -PLAFOND) d = -PLAFOND;
    return d;
  }

  window._rj76Gain = function () {
    var b = bonusReglage(), d = delta();
    var ref = 0;
    try { ref = (typeof QUALI_STATE !== "undefined" && QUALI_STATE) ? (QUALI_STATE.baseRef || 0) : 0; } catch (e) {}
    var txt = "réglage " + (b >= 0 ? "+" : "") + (b * 100).toFixed(1) + " % de performance → " +
              (d >= 0 ? "+" : "") + (d * 100).toFixed(2) + " % de temps au tour" +
              (ref ? " ≈ " + (d * ref).toFixed(3) + " s sur " + ref.toFixed(1) + " s" : "");
    console.log(TAG + " " + txt);
    return { scoreBonus: b, deltaTemps: d, secondes: ref ? +(d * ref).toFixed(3) : null };
  };

  function installer() {
    if (typeof window.qualiDriverTime !== "function") return false;
    if (window.qualiDriverTime._rj76) return true;

    var orig = window.qualiDriverTime;
    var fn = function (pilote, session, tour, total, avancement) {
      var t = orig.apply(this, arguments);
      try {
        if (pilote && pilote.isPlayer && typeof t === "number" && isFinite(t)) {
          var d = delta();
          if (d !== 0) {
            var avant = t;
            t = t * (1 + d);
            etat.dernier = {
              avant: +avant.toFixed(3), apres: +t.toFixed(3),
              gain: +(t - avant).toFixed(3), delta: +(d * 100).toFixed(2)
            };
          }
        }
      } catch (e) {}
      return t;
    };
    fn._rj76 = true;
    wrapped.qualiDriverTime = orig;
    window.qualiDriverTime = fn;
    return true;
  }

  var essais = 0;
  function boot() {
    var ok = false;
    try { ok = installer(); } catch (e) {}
    if (!ok) {
      if (essais++ < 120) { setTimeout(boot, 100); return; }
      console.warn(TAG + " abandon : qualiDriverTime introuvable");
      return;
    }
    etat.installe = true;
    console.log(TAG + " actif — le réglage voiture influe sur le temps au tour en qualification");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj76Uninstall = function () {
    Object.keys(wrapped).forEach(function (k) { window[k] = wrapped[k]; });
    etat.installe = false;
    console.log(TAG + " désinstallé");
  };
})();
