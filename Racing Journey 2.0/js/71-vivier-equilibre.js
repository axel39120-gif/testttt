/* =====================================================================
 * 71-vivier-equilibre.js — DÉMOGRAPHIE DU VIVIER DE PILOTES
 *
 * CONSTAT (mesuré sur 15 saisons pilotées en Chromium, sans jouer de
 * course, en simulant les saisons fantômes avant chaque passage) :
 *
 *   saison  actifs  retraites  promus  descendus  nouveaux
 *      1      215        46       30        3          2
 *      2      171        58       27        0         14
 *      4      103        47        6        0         12
 *      8       57        22        4        0          9
 *
 * Le vivier passe de 205 pilotes actifs à 23 en quinze saisons. La grille
 * de Formule 1 tombe à zéro dès la saison 11, et les catégories
 * intermédiaires — Formula Regional, Formule 3, Formule 2 — sont vides
 * pendant neuf à dix saisons sur quinze. Un joueur qui met dix saisons à
 * monter en F1 arrive dans un championnat désert.
 *
 * TROIS CAUSES, toutes traitées ici :
 *
 *  1. UNE SEULE PORTE D'ENTRÉE. Le générateur de recrues ne remplit que le
 *     Karting Junior, maintenu à effectif constant. Toutes les autres
 *     catégories n'ont que des sorties. Le vivier fuit par le haut et par
 *     les côtés, et ne se remplit que par le bas.
 *
 *  2. LES DESCENTES N'EXISTENT PAS. Trois en saison 1, zéro sur toutes les
 *     suivantes. La documentation de 04o annonce pourtant que « les flop
 *     d'F1 perdent leur baquet ». Le chemin est déclaré, il n'est jamais
 *     emprunté : le système n'a aucun recyclage vers le bas.
 *
 *  3. DES RETRAITES DÉCORRÉLÉES DE L'ÂGE. Des pilotes de moins de 24 ans
 *     partent en retraite parce qu'ils ont mal fini une saison. Dans la
 *     réalité on ne prend pas sa retraite à 20 ans : on descend d'un cran.
 *
 * MÉTHODE — aucun fichier cœur modifié. Le module s'exécute APRÈS
 * startNextSeason, donc après que 04o a fait évoluer son vivier et que le
 * module 70 a appliqué ses règles de titre. On ne dispute la main à
 * personne : on corrige la démographie qui en résulte, dans cet ordre :
 *
 *     a. les retraites précoces sont annulées et converties en descente ;
 *     b. les effectifs excédentaires redescendent d'un cran ;
 *     c. les catégories sous leur cible sont comblées par promotion depuis
 *        la catégorie inférieure, tant qu'elle garde son minimum ;
 *     d. ce qui manque encore est comblé par des arrivées extérieures,
 *        d'âge et de niveau cohérents avec la catégorie ;
 *     e. le Karting Junior est réapprovisionné en dernier.
 *
 * BONUS — ABANDON SILENCIEUX DU DÉPART. En pilotant le jeu, un clic sur
 * « Départ ! » avec un état de week-end incohérent ne produit rien : pas
 * de course, pas d'exception, pas un mot en console, et un bouton qui
 * reste sur « Départ ! ». Une des enveloppes posées sur runRaceLive
 * abandonne sans le dire. Ce module journalise désormais l'abandon avec
 * l'état complet du week-end, pour que ce cas cesse d'être invisible.
 *
 * Réversible : window._rj71Uninstall(). Diagnostic : window._rj71Status().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[71-vivier-equilibre]";
  var wrapped = {};
  var etat = { installe: false, passes: 0, dernier: null, cumul: null, erreur: null };
  window._rj71Status = function () { return etat; };

  var CATS = ["Karting Junior", "Karting Senior", "Formule 4", "Formula Regional",
              "Formule 3", "Formule 2", "Formule 1", "Super Formula",
              "Endurance WEC", "IndyCar"];

  // Effectifs cibles, calqués sur les grilles réelles de chaque série.
  var CIBLE = {
    "Karting Junior": 20, "Karting Senior": 20, "Formule 4": 22,
    "Formula Regional": 20, "Formule 3": 22, "Formule 2": 20,
    "Formule 1": 20, "Super Formula": 18, "Endurance WEC": 18, "IndyCar": 22
  };
  var TOLERANCE = 3;        // au-delà de cible + tolérance, on fait descendre
  var PLANCHER = 0.7;       // une catégorie ne descend pas sous 70 % de sa cible

  var AGES = {
    "Karting Junior":   { min: 8,  max: 15, entree: [9, 12] },
    "Karting Senior":   { min: 12, max: 18, entree: [13, 16] },
    "Formule 4":        { min: 14, max: 20, entree: [15, 17] },
    "Formula Regional": { min: 15, max: 22, entree: [16, 19] },
    "Formule 3":        { min: 16, max: 24, entree: [17, 21] },
    "Formule 2":        { min: 17, max: 27, entree: [18, 23] },
    "Formule 1":        { min: 17, max: 42, entree: [19, 30] },
    "Super Formula":    { min: 17, max: 40, entree: [19, 30] },
    "Endurance WEC":    { min: 17, max: 46, entree: [21, 36] },
    "IndyCar":          { min: 17, max: 42, entree: [20, 32] }
  };

  // Niveau attendu à l'entrée de chaque catégorie.
  var NIVEAU = {
    "Karting Junior": 42, "Karting Senior": 48, "Formule 4": 54,
    "Formula Regional": 59, "Formule 3": 64, "Formule 2": 70,
    "Formule 1": 78, "Super Formula": 72, "Endurance WEC": 70, "IndyCar": 72
  };

  var RETRAITE_AGE_MIN = 24;   // en dessous, on descend, on ne raccroche pas

  /* ------------------------------------------------------------ outils --- */
  function pool() { try { return G.driverPool || []; } catch (e) { return []; } }
  function actifs() { return pool().filter(function (d) { return d && !d.retired; }); }
  function dansCat(cat) { return actifs().filter(function (d) { return d.cat === cat; }); }
  function estJoueur(d) { return !!(d && (d.isPlayer || d.id === "__joueur")); }

  function catDessous(cat) {
    var i = CATS.indexOf(cat);
    return (i > 0 && i <= 6) ? CATS[i - 1] : (i > 6 ? "Formule 2" : null);
  }
  function catDessus(cat) {
    try {
      if (typeof CAT_PATHS !== "undefined" && CAT_PATHS && CAT_PATHS[cat] && CAT_PATHS[cat].length) {
        return CAT_PATHS[cat][0];
      }
    } catch (e) {}
    var i = CATS.indexOf(cat);
    return (i >= 0 && i < 6) ? CATS[i + 1] : null;
  }

  function ageOk(cat, age) {
    var a = AGES[cat];
    return !a || (age >= a.min && age <= a.max);
  }

  function equipesDe(cat) {
    var t = {}, out = [];
    dansCat(cat).forEach(function (d) { if (d.team && !t[d.team]) { t[d.team] = 1; out.push(d.team); } });
    return out;
  }

  function nouveauPilote(cat) {
    var a = AGES[cat] || { entree: [18, 24] };
    var age = a.entree[0] + Math.floor(Math.random() * (a.entree[1] - a.entree[0] + 1));
    var niveau = (NIVEAU[cat] || 60) + Math.floor(Math.random() * 9) - 4;

    var d = null;
    try {
      if (typeof _generateNewKartingRookie === "function") d = _generateNewKartingRookie(cat);
    } catch (e) {}
    if (!d) {
      d = {
        id: "rj71_" + Date.now().toString(36) + "_" + Math.floor(Math.random() * 99999),
        name: "Pilote " + Math.floor(Math.random() * 9000 + 1000),
        consistency: 0.62 + Math.random() * 0.22
      };
    }
    d.cat = cat;
    d.age = age;
    d.skill = Math.max(30, Math.min(95, niveau));
    d.retired = false;
    if (typeof d.consistency !== "number") d.consistency = 0.62 + Math.random() * 0.22;
    var eq = equipesDe(cat);
    if (!d.team || eq.indexOf(d.team) < 0) d.team = eq.length ? eq[Math.floor(Math.random() * eq.length)] : "Indépendant";
    d._rj71Arrivee = true;
    return d;
  }

  /* ------------------------------------------------------- rééquilibrage --- */
  function equilibrer() {
    var p = pool();
    if (!p.length) return null;

    var bilan = { retraitesAnnulees: 0, descentes: 0, promotions: 0, arrivees: 0, retraitesAgees: 0 };

    // a. Retraites précoces annulées : à moins de 24 ans on descend d'un cran.
    p.forEach(function (d) {
      if (!d || estJoueur(d) || !d.retired) return;
      var age = (typeof d.age === "number") ? d.age : 99;
      if (age >= RETRAITE_AGE_MIN) return;
      var dest = d.cat;
      if (!ageOk(dest, age)) {
        var bas = catDessous(d.cat);
        if (bas && ageOk(bas, age)) dest = bas;
      }
      // un champion banni ne redescend jamais dans sa catégorie interdite
      if (d._rjBanni && d._rjBanni.indexOf(dest) >= 0) {
        var alt = catDessus(dest);
        if (alt) dest = alt;
      }
      d.retired = false;
      d.cat = dest;
      bilan.retraitesAnnulees++;
    });

    // a bis. À l'inverse, les trop âgés pour leur catégorie sortent vraiment.
    actifs().forEach(function (d) {
      if (estJoueur(d)) return;
      var a = AGES[d.cat];
      if (a && typeof d.age === "number" && d.age > a.max + 2) {
        d.retired = true;
        bilan.retraitesAgees++;
      }
    });

    // b. Excédents : les plus faibles et les plus âgés redescendent.
    CATS.forEach(function (cat) {
      var liste = dansCat(cat).filter(function (d) { return !estJoueur(d); });
      var surplus = liste.length - (CIBLE[cat] + TOLERANCE);
      if (surplus <= 0) return;
      liste.sort(function (x, y) {
        var dx = (x.skill || 0) - (y.skill || 0);
        if (dx !== 0) return dx;
        return (y.age || 0) - (x.age || 0);
      });
      var bas = catDessous(cat);
      for (var i = 0; i < surplus && i < liste.length; i++) {
        var d = liste[i];
        if (bas && ageOk(bas, d.age || 20) && !(d._rjBanni && d._rjBanni.indexOf(bas) >= 0)) {
          d.cat = bas;
          bilan.descentes++;
        } else {
          d.retired = true;
          bilan.retraitesAgees++;
        }
      }
    });

    // c. Promotions depuis la catégorie inférieure, du haut vers le bas pour
    //    que la vague remonte toute la filière en une passe.
    for (var k = CATS.length - 1; k >= 1; k--) {
      var cat = CATS[k];
      var manque = CIBLE[cat] - dansCat(cat).length;
      if (manque <= 0) continue;
      var source = catDessous(cat);
      if (!source) continue;
      var dispo = dansCat(source).filter(function (d) {
        return !estJoueur(d) && ageOk(cat, d.age || 20);
      });
      var minSource = Math.floor(CIBLE[source] * PLANCHER);
      var cedables = Math.max(0, dansCat(source).length - minSource);
      var n = Math.min(manque, cedables, dispo.length);
      if (n <= 0) continue;
      dispo.sort(function (x, y) { return (y.skill || 0) - (x.skill || 0); });
      for (var i = 0; i < n; i++) { dispo[i].cat = cat; bilan.promotions++; }
    }

    // d. Ce qui manque encore vient de l'extérieur : autres championnats,
    //    reconversions, pilotes venus d'ailleurs. C'est la porte d'entrée
    //    qui manquait à toutes les catégories sauf le Karting Junior.
    CATS.forEach(function (cat) {
      var manque = CIBLE[cat] - dansCat(cat).length;
      for (var i = 0; i < manque; i++) {
        var d = nouveauPilote(cat);
        if (d) { pool().push(d); bilan.arrivees++; }
      }
    });

    etat.passes++;
    etat.dernier = bilan;
    if (!etat.cumul) etat.cumul = { retraitesAnnulees: 0, descentes: 0, promotions: 0, arrivees: 0, retraitesAgees: 0 };
    Object.keys(bilan).forEach(function (k) { etat.cumul[k] += bilan[k]; });

    console.log(TAG + " saison rééquilibrée — " + bilan.promotions + " promotions, " +
                bilan.descentes + " descentes, " + bilan.arrivees + " arrivées, " +
                bilan.retraitesAnnulees + " retraites précoces annulées, " +
                bilan.retraitesAgees + " fins de carrière");
    return bilan;
  }

  /* -------------------------------- abandon silencieux du départ ------- */
  function installerJournalDepart() {
    if (typeof window.runRaceLive !== "function" || window.runRaceLive._rj71) return false;
    var orig = window.runRaceLive;
    var fn = function () {
      var avant = 0;
      try { avant = (G.races || []).length; } catch (e) {}
      var r = orig.apply(this, arguments);
      try {
        setTimeout(function () {
          var demarre = false;
          try {
            demarre = (typeof LIVE_RACE !== "undefined" && LIVE_RACE && (LIVE_RACE.total > 0 || LIVE_RACE.cur > 0)) ||
                      ((G.races || []).length > avant);
          } catch (e) {}
          if (!demarre) {
            var ctx = {};
            try { ctx.weekend = (typeof RACE_WEEKEND_STATE !== "undefined") ? RACE_WEEKEND_STATE : "absent"; } catch (e) {}
            try { ctx.qualiPhase = (typeof QUALI_STATE !== "undefined" && QUALI_STATE) ? QUALI_STATE.phase : "absent"; } catch (e) {}
            try { ctx.circuit = (typeof RACE_STATE !== "undefined") ? RACE_STATE.circuit : "absent"; } catch (e) {}
            try { ctx.qualiPos = (typeof RACE_STATE !== "undefined") ? RACE_STATE.qualiPos : null; } catch (e) {}
            try { ctx.rivaux = (G.rivals || []).length; } catch (e) {}
            try { ctx.cat = G.cat; } catch (e) {}
            console.warn(TAG + " départ sans effet — la course n'a pas démarré. État : " +
                         JSON.stringify(ctx));
          }
        }, 900);
      } catch (e) {}
      return r;
    };
    fn._rj71 = true;
    wrapped.runRaceLive = orig;
    window.runRaceLive = fn;
    return true;
  }

  /* ---------------------------------------------------------- montage --- */
  function installer() {
    var ok = false;
    if (typeof window.startNextSeason === "function" && !window.startNextSeason._rj71) {
      var orig = window.startNextSeason;
      var fn = function () {
        var r = orig.apply(this, arguments);
        try { equilibrer(); } catch (e) { etat.erreur = String(e && e.message || e); console.warn(TAG, e); }
        try { if (typeof saveGame === "function") saveGame((G && G._slot) || 0); } catch (e) {}
        return r;
      };
      fn._rj71 = true;
      wrapped.startNextSeason = orig;
      window.startNextSeason = fn;
      ok = true;
    }
    installerJournalDepart();
    return ok;
  }

  var essais = 0;
  function boot() {
    var ok = false;
    try { ok = installer(); } catch (e) { etat.erreur = String(e && e.message || e); }
    if (!ok && essais++ < 120) { setTimeout(boot, 100); return; }
    etat.installe = true;
    console.log(TAG + " actif — effectifs cibles par catégorie, descentes réactivées, " +
                "retraites calibrées sur l'âge");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj71Equilibrer = function () { return equilibrer(); };
  window._rj71Effectifs = function () {
    var out = {};
    CATS.forEach(function (c) { out[c] = dansCat(c).length + "/" + CIBLE[c]; });
    out._actifs = actifs().length;
    console.log(JSON.stringify(out, null, 1));
    return out;
  };
  window._rj71Uninstall = function () {
    Object.keys(wrapped).forEach(function (k) { window[k] = wrapped[k]; });
    etat.installe = false;
    console.log(TAG + " désinstallé");
  };
})();
