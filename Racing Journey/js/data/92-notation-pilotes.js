/* =====================================================================
 * 92-notation-pilotes.js — ÉCHELLE DE NOTATION DES PILOTES
 *
 * L'ANCIENNE ÉCHELLE
 * Un seul pilote atteignait 94 en Formule 1, cinq autres tournaient à 91,
 * et le fond de grille descendait jusqu'à 73. Deux défauts : le sommet
 * était plat — rien ne distinguait vraiment les tout meilleurs — et le bas
 * de grille était si faible qu'un titulaire de Formule 1 pouvait valoir
 * moins qu'un bon pilote de Formule 2.
 *
 * LA NOUVELLE
 *   · trois pilotes autour de 96 : le sommet absolu, que l'on n'atteint
 *     qu'exceptionnellement ;
 *   · au-dessus de 90, une poignée seulement — six pilotes sur vingt,
 *     l'élite au sens strict ;
 *   · une descente régulière ensuite, sans palier brutal ;
 *   · un fond de grille entre 78 et 82 : même le dernier titulaire de
 *     Formule 1 reste un pilote de très haut niveau.
 *
 * Les catégories inférieures suivent la même logique, décalée vers le bas :
 * élite rare, hiérarchie lisible, fond de grille resserré.
 *
 * LE POTENTIEL
 * Il valait « niveau actuel + 15 à 25 », plafonné à 99 : la plupart des
 * jeunes finissaient donc par promettre un niveau que personne n'atteint.
 * Le potentiel est désormais freiné dans le haut de l'échelle — franchir
 * 90 est difficile, 96 est le plafond absolu — et reste généreux en bas,
 * où la marge de progression est réelle.
 *
 * Ces règles s'appliquent aussi aux pilotes créés plus tard : le vivier
 * est normalisé à chaque changement de saison.
 *
 * Réversible : window._rj92Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[92-notation]";

  /* ÉCHELLE RÉÉTALÉE — les catégories de formation étaient tassées vers
     le haut : un pilote de karting junior culminait à 74, soit le niveau
     d'un milieu de grille de Formule 2. Un débutant, qui démarre autour de
     31, se retrouvait dernier avec près de trente points de retard sur
     l'avant-dernier — aucune qualification, aucune course jouable.
     L'échelle couvre désormais toute l'amplitude du karting à la Formule 1,
     et le fond de grille du karting junior rejoint le niveau d'un vrai
     débutant.

  ==================================================================
   * 1. PLAFONDS PAR CATÉGORIE
   * ================================================================== */
  var PLAFONDS = {
    "Karting Junior": 75,
    "Karting Senior": 79,
    "Formule 4": 82,
    "Formula Regional": 85,
    "Formule 3": 88,
    "Formule 2": 91,
    "Super Formula": 93,
    "IndyCar": 93,
    "Endurance WEC": 92,
    "Formule 1": 96
  };

  /* Plafond absolu, toutes catégories confondues. Le dépasser demanderait
     une carrière hors norme ; rien ne va au-delà. */
  var PLAFOND_ABSOLU = 96;

  /* ==================================================================
   * 2. DISTRIBUTION PAR CATÉGORIE
   *
   * Chaque strate donne un effectif, une moyenne et une dispersion. La
   * somme des effectifs correspond au plateau habituel de la catégorie ;
   * s'il y a plus de pilotes que prévu, la dernière strate absorbe le
   * surplus.
   * ================================================================== */
  var DISTRIBUTION = {
    /* Vingt pilotes : 3 au sommet, 6 au-dessus de 90, fond entre 78 et 82 */
    "Formule 1": [
      { tier: "sommet",      count: 3, mean: 95.5, spread: 0.7 },
      { tier: "elite",       count: 3, mean: 91.5, spread: 0.9 },
      { tier: "tresfort",    count: 4, mean: 88.0, spread: 1.1 },
      { tier: "fort",        count: 4, mean: 85.0, spread: 1.0 },
      { tier: "milieu",      count: 3, mean: 82.0, spread: 1.0 },
      { tier: "fonddegrille", count: 2, mean: 79.5, spread: 0.9 },
      { tier: "recrue",      count: 1, mean: 78.0, spread: 1.0 }
    ],
    "Formule 2": [
      { tier: "sommet",   count: 2, mean: 84.0, spread: 0.8 },
      { tier: "elite",    count: 3, mean: 81.0, spread: 1.0 },
      { tier: "fort",     count: 4, mean: 77.0, spread: 1.2 },
      { tier: "milieu",   count: 6, mean: 73.0, spread: 1.3 },
      { tier: "recrue",   count: 5, mean: 69.0, spread: 1.5 }
    ],
    "Formule 3": [
      { tier: "sommet",   count: 2, mean: 78.0, spread: 0.8 },
      { tier: "elite",    count: 4, mean: 74.0, spread: 1.2 },
      { tier: "milieu",   count: 8, mean: 68.0, spread: 1.5 },
      { tier: "recrue",   count: 6, mean: 63.0, spread: 1.8 }
    ],
    "Formula Regional": [
      { tier: "sommet",   count: 2, mean: 71.0, spread: 0.9 },
      { tier: "elite",    count: 4, mean: 67.0, spread: 1.3 },
      { tier: "milieu",   count: 8, mean: 61.0, spread: 1.8 },
      { tier: "recrue",   count: 6, mean: 56.0, spread: 2.0 }
    ],
    "Formule 4": [
      { tier: "sommet",   count: 2, mean: 64.0, spread: 1.0 },
      { tier: "elite",    count: 4, mean: 60.0, spread: 1.5 },
      { tier: "milieu",   count: 10, mean: 54.0, spread: 2.0 },
      { tier: "recrue",   count: 8, mean: 49.0, spread: 2.2 }
    ],
    "Karting Senior": [
      { tier: "sommet",   count: 2, mean: 54.0, spread: 1.0 },
      { tier: "elite",    count: 4, mean: 50.0, spread: 1.8 },
      { tier: "milieu",   count: 10, mean: 44.0, spread: 2.4 },
      { tier: "recrue",   count: 8, mean: 39.0, spread: 2.6 }
    ],
    "Karting Junior": [
      { tier: "sommet",   count: 2, mean: 46.0, spread: 1.0 },
      { tier: "elite",    count: 4, mean: 42.0, spread: 1.8 },
      { tier: "milieu",   count: 10, mean: 36.0, spread: 2.5 },
      { tier: "recrue",   count: 8, mean: 31.0, spread: 2.8 }
    ],
    "Super Formula": [
      { tier: "sommet",   count: 2, mean: 92.0, spread: 0.8 },
      { tier: "elite",    count: 3, mean: 89.0, spread: 1.0 },
      { tier: "milieu",   count: 10, mean: 84.0, spread: 1.5 },
      { tier: "recrue",   count: 5, mean: 79.5, spread: 1.5 }
    ],
    "IndyCar": [
      { tier: "sommet",   count: 2, mean: 92.0, spread: 0.8 },
      { tier: "elite",    count: 4, mean: 89.0, spread: 1.0 },
      { tier: "milieu",   count: 12, mean: 84.0, spread: 1.6 },
      { tier: "recrue",   count: 9, mean: 80.0, spread: 1.6 }
    ],
    "Endurance WEC": [
      { tier: "sommet",   count: 2, mean: 91.0, spread: 0.8 },
      { tier: "elite",    count: 4, mean: 88.0, spread: 1.0 },
      { tier: "milieu",   count: 8, mean: 83.5, spread: 1.5 },
      { tier: "recrue",   count: 6, mean: 79.0, spread: 1.6 }
    ]
  };

  /* ==================================================================
   * 3. POTENTIEL
   *
   * Ancienne règle : niveau + 15 à 25, plafonné à 99. Presque tous les
   * jeunes promettaient donc un niveau que personne n'atteint jamais.
   *
   * Nouvelle règle : la marge brute reste large en bas d'échelle, mais
   * elle se resserre fortement au-delà de 88 — franchir 90 doit rester
   * l'exception, et 96 est le plafond absolu.
   * ================================================================== */
  /* pepite : true impose le bonus de talent, false l'interdit, undefined le
     laisse au hasard. Il doit être décidé UNE FOIS à la création du pilote
     et conservé : tiré à chaque recalcul, il finissait par échoir à tout le
     monde — deux cent quarante-sept pilotes sur quatre cents promettaient
     95 ou plus après vingt-cinq saisons. */
  function potentielPour(niveau, hasard, pepite) {
    var n = Math.max(30, Math.min(PLAFOND_ABSOLU, niveau || 50));
    var alea = (typeof hasard === "number") ? hasard : Math.random();

    /* Marge brute : large pour un débutant, ténue pour un pilote déjà
       accompli. La pente est volontairement raide — un pilote à 82 ne
       promet pas 92, sans quoi la moitié du vivier annoncerait l'élite. */
    var marge = 15 - (n - 55) * 0.32;          // 15 à 55, environ 3 à 92
    /* Même au sommet, un jeune doit conserver une marge de progression :
       sans elle, un pilote de 91 serait figé à vie. */
    marge = Math.max(3.5, marge) * (0.55 + alea * 0.75);

    /* Freinage dans le haut de l'échelle : plus un pilote est déjà haut,
       moins sa marge lui rapporte. Le freinage porte sur la MARGE et non
       sur le total — appliqué au total, il ramenait le potentiel sous le
       niveau actuel, et un pilote de 91 se retrouvait figé à vie. */
    var facteur = n >= 91 ? 0.35 : (n >= 86 ? 0.50 : (n >= 80 ? 0.70 : 1));

    /* Une pépite sur quinze environ : le talent que personne n'attendait.
       Sans cette exception, aucun jeune du vivier ne pourrait viser le
       sommet, et l'élite s'éteindrait avec la génération de départ. */
    var estPepite = (pepite === true) || (pepite === undefined && alea > 0.93);
    if (estPepite) facteur *= 2.4;

    var brut = n + marge * facteur;

    return Math.round(Math.min(PLAFOND_ABSOLU, Math.max(n, brut)));
  }

  /* Remise à l'échelle du vivier : niveaux plafonnés, potentiels recalculés
     selon la nouvelle règle. Appliqué au démarrage et à chaque saison. */
  function normaliserVivier() {
    var G = (typeof window.G !== "undefined") ? window.G : null;
    if (!G || !Array.isArray(G.driverPool)) return 0;
    var touches = 0;
    G.driverPool.forEach(function (d) {
      if (!d) return;
      var plafond = PLAFONDS[d.cat] || PLAFOND_ABSOLU;
      if (typeof d.skill === "number" && d.skill > plafond) { d.skill = plafond; touches++; }
      if (typeof d.baseSkill === "number" && d.baseSkill > plafond) d.baseSkill = plafond;
      /* Le talent d'exception est décidé une fois, à la découverte du
         pilote, puis conservé. */
      if (typeof d._pepite !== "boolean") d._pepite = (Math.random() > 0.93);

      var reference = d.baseSkill || d.skill || 60;
      var potMax = potentielPour(reference, 1, d._pepite);
      if (typeof d.potential !== "number" || d.potential > potMax) {
        d.potential = potentielPour(reference, undefined, d._pepite);
        touches++;
      }
      /* Un pilote qui progresse voit son potentiel révisé à la hausse : on
         découvre son talent en le voyant courir. Sans cela, un jeune parti
         de cinquante restait plafonné à soixante-dix toute sa carrière, et
         le vivier ne produisait plus jamais de pilote de pointe. */
      var plancher = potentielPour(d.skill || reference, 0.5, d._pepite);
      if (d.potential < plancher) { d.potential = plancher; touches++; }
    });
    return touches;
  }

  /* ==================================================================
   * 3 bis. APPLICATION DE L'ÉCHELLE AUX RIVAUX
   *
   * Le recalibrage d'origine (module 04k) exige une course en cours et ne
   * s'exécute qu'une fois par saison : les notes visibles ailleurs — profils,
   * championnat, mercato — échappaient donc à l'échelle. On l'applique à la
   * source, au moment où les rivaux sont créés.
   *
   * La hiérarchie établie par le jeu est préservée : on trie les pilotes
   * par niveau, puis on leur attribue les notes de l'échelle dans le même
   * ordre. Le meilleur reste le meilleur, mais l'écart devient le nôtre.
   * ================================================================== */

  function construirePool(cat, effectif) {
    var strates = DISTRIBUTION[cat];
    if (!strates || !effectif) return null;
    var plafond = PLAFONDS[cat] || PLAFOND_ABSOLU;
    var notes = [];

    for (var i = 0; i < strates.length && notes.length < effectif; i++) {
      var st = strates[i];
      var reste = effectif - notes.length;
      /* La dernière strate absorbe le surplus si le plateau est plus grand
         que prévu ; sinon on s'en tient à l'effectif annoncé. */
      var combien = (i === strates.length - 1) ? reste : Math.min(st.count, reste);
      for (var k = 0; k < combien; k++) {
        var ecart = (Math.random() + Math.random() - 1) * (st.spread || 1);
        notes.push(Math.max(35, Math.min(plafond, Math.round(st.mean + ecart))));
      }
    }
    while (notes.length < effectif) notes.push(notes[notes.length - 1] || 60);
    return notes.sort(function (a, b) { return b - a; });
  }

  function appliquerAuxRivaux() {
    var G = (typeof window.G !== "undefined") ? window.G : null;
    if (!G || !Array.isArray(G.rivals) || !G.rivals.length) return 0;
    var cat = G.cat;
    if (!DISTRIBUTION[cat]) return 0;

    var rivaux = G.rivals.filter(function (r) { return r && typeof r.skill === "number"; });
    if (!rivaux.length) return 0;

    var notes = construirePool(cat, rivaux.length);
    if (!notes) return 0;

    /* On conserve l'ordre relatif issu du jeu. */
    var ordonnes = rivaux.slice().sort(function (a, b) { return b.skill - a.skill; });
    for (var i = 0; i < ordonnes.length; i++) {
      var r = ordonnes[i];
      r.skill = notes[i];
      if (typeof r.baseSkill === "number") r.baseSkill = notes[i];
      if (typeof r.potential === "number") r.potential = potentielPour(notes[i]);
    }
    return ordonnes.length;
  }

  /* ==================================================================
   * 4. INSTALLATION
   * ================================================================== */
  var _avant = {};

  function appliquerTables() {
    if (!window.RJ_SKILL_CAPS || !window.RJ_TIER_DISTRIBUTION) return false;
    if (!_avant.caps) {
      _avant.caps = window.RJ_SKILL_CAPS;
      _avant.distribution = window.RJ_TIER_DISTRIBUTION;
    }
    Object.keys(PLAFONDS).forEach(function (cat) { window.RJ_SKILL_CAPS[cat] = PLAFONDS[cat]; });
    Object.keys(DISTRIBUTION).forEach(function (cat) { window.RJ_TIER_DISTRIBUTION[cat] = DISTRIBUTION[cat]; });
    return true;
  }

  function boot() {
    var essais = 0;
    (function tenter() {
      if (appliquerTables()) {
        var n = normaliserVivier();
        console.log(TAG, "échelle appliquée — sommet à " + PLAFONDS["Formule 1"] +
                    (n ? ", " + n + " ajustement(s) dans le vivier" : ""));
        return;
      }
      if (essais++ < 80) setTimeout(tenter, 150);
      else console.warn(TAG, "tables de niveaux introuvables");
    })();

    /* Les pilotes créés plus tard suivent la même règle. */
    if (Array.isArray(window.RJ_SEASON_HOOKS) &&
        !window.RJ_SEASON_HOOKS.some(function (h) { return h && h.id === "92-notation"; })) {
      window.RJ_SEASON_HOOKS.push({
        id: "92-notation",
        apres: function () { try { normaliserVivier(); } catch (e) {} }
      });
    }

    /* Le vivier n'existe qu'une fois la partie chargée : on réessaie tant
       qu'il est absent, puis à chaque évolution de fin de saison — c'est là
       que les nouveaux venus sont créés. */
    var attentes = 0;
    (function attendreVivier() {
      var G = (typeof window.G !== "undefined") ? window.G : null;
      if (G && Array.isArray(G.driverPool) && G.driverPool.length) {
        var n = normaliserVivier();
        if (n) console.log(TAG, n + " ajustement(s) dans le vivier (" + G.driverPool.length + " pilotes)");
        return;
      }
      if (attentes++ < 200) setTimeout(attendreVivier, 400);
    })();

    if (typeof window._rjEvolvePoolAtSeasonEnd === "function" &&
        !window._rjEvolvePoolAtSeasonEnd._rj92) {
      var origEvol = window._rjEvolvePoolAtSeasonEnd;
      window._rjEvolvePoolAtSeasonEnd = function () {
        var r = origEvol.apply(this, arguments);
        try { normaliserVivier(); } catch (e) {}
        return r;
      };
      window._rjEvolvePoolAtSeasonEnd._rj92 = true;
      _avant.evol = origEvol;
    }

    /* Les rivaux reçoivent l'échelle dès leur création. */
    if (typeof window.initRivals === "function" && !window.initRivals._rj92) {
      var origInit = window.initRivals;
      window.initRivals = function () {
        var r = origInit.apply(this, arguments);
        try { appliquerAuxRivaux(); } catch (e) { console.warn(TAG, "application :", e && e.message); }
        return r;
      };
      window.initRivals._rj92 = true;
      _avant.initRivals = origInit;
    }

    window._rj92 = {
      plafonds: PLAFONDS,
      distribution: DISTRIBUTION,
      potentiel: potentielPour,
      normaliser: normaliserVivier,
      appliquer: appliquerAuxRivaux,
      pool: construirePool
    };
    window._rj92Uninstall = function () {
      if (_avant.caps) {
        window.RJ_SKILL_CAPS = _avant.caps;
        window.RJ_TIER_DISTRIBUTION = _avant.distribution;
      }
      if (_avant.initRivals) window.initRivals = _avant.initRivals;
      if (_avant.evol) window._rjEvolvePoolAtSeasonEnd = _avant.evol;
      console.log(TAG, "désinstallé");
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
