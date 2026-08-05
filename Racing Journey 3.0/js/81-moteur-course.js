/* =====================================================================
 * 81-moteur-course.js — CLASSEMENT EN COURSE : COHÉRENCE ET RÉALISME
 *
 * SYMPTÔME : parti en pole, le joueur tombait à la 20e place, revenait
 * premier, repartait dernier — plusieurs fois dans la même course.
 *
 * DIAGNOSTIC (course F1 instrumentée, position relevée à chaque tour) :
 * le rang du joueur au score restait STABLE (19e sur 20) pendant que sa
 * position affichée passait de P1 à P18 puis P2. La position n'était donc
 * pas dérivée du classement : elle était produite par un algorithme qui
 * partait en vrille.
 *
 * ── CAUSE 1 : le repli catastrophique de la résolution de collisions
 *
 * updateLivePositions (04-race-engine) procédait ainsi :
 *   1. tri par score décroissant → rang idéal ;
 *   2. bridage du déplacement à 2 places par mise à jour ;
 *   3. attribution des positions avec résolution des collisions :
 *          while (prise[p] && p < n) p++;
 *          if (prise[p]) { premier libre EN PARTANT DE 1 }   ← ici
 *
 * Ce dernier repli est destructeur. Un pilote qui vise le fond de grille
 * trouve les dernières places occupées, la recherche ascendante bute sur
 * la borne n, et il se voit alors attribuer… la première position libre en
 * partant de la tête. Le 19e se retrouve P2. Au tour suivant le bridage le
 * fait redescendre, jusqu'à ce que le repli le renvoie devant : c'est
 * exactement l'oscillation observée.
 *
 * CORRECTIF : l'attribution devient séquentielle. On trie les pilotes par
 * position souhaitée (départage par rang au score) puis on distribue 1..n
 * dans cet ordre. L'unicité est garantie par construction, aucune collision
 * n'est possible, donc aucun repli n'est nécessaire. Le bridage subsiste —
 * il évite les téléportations — mais il ne peut plus produire d'inversion.
 *
 * ── CAUSE 2 : le rythme de course ignorait la qualification
 *
 * La grille venait des qualifs, mais le score de course était tiré
 * indépendamment. Un pilote pouvait donc partir en pole avec le rythme du
 * dernier : même corrigée, la course le faisait glisser jusqu'au fond, ce
 * qui reste absurde à voiture et pilote identiques.
 *
 * CORRECTIF : au départ, on réordonne les scores selon un rang mixte —
 * 60 % la grille, 40 % le mérite propre calculé par le moteur. Les VALEURS
 * de score ne changent pas (gaps, seuils et calibrages restent intacts),
 * seule leur répartition entre pilotes est corrigée. La course garde donc
 * toute sa part d'imprévu, mais un poleman n'a plus le rythme d'un dernier.
 *
 * OPTION A — aucun fichier cœur modifié : updateLivePositions est remplacée
 * à l'exécution, runRaceLive est enveloppée.
 *
 * Réversible : window._rj81Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[81-moteur-course]";

  /* Part de la grille dans le rythme de départ. 1 = la course suit
     exactement la qualif, 0 = comportement d'avant (aucun lien). */
  var POIDS_GRILLE = 0.7;

  /* Places gagnées ou perdues au maximum par mise à jour. */
  var SAUT_MAX = 2;
  var SAUT_MAX_APRES_ARRET = 6;   // sortie des stands : les écarts sont réels

  function LR() { return (typeof window.LIVE_RACE !== "undefined") ? window.LIVE_RACE : null; }

  /* Score effectif : le score brut moins le poids des pénalités, comme
     partout ailleurs dans le moteur. */
  function scoreEffectif(d) {
    return (d.score || 0) - ((d.penaltySec || 0) / 45);
  }

  /* ==================================================================
   * 1. ATTRIBUTION DES POSITIONS
   * ================================================================== */

  function attribuer(liste) {
    var lr = LR();
    for (var i = 0; i < liste.length; i++) {
      liste[i].pos = i + 1;
      delete liste[i]._posSouhaitee;
      delete liste[i]._rangCible;
      delete liste[i]._cappedPos;
    }
    /* Écarts au leader, dans l'unité du moteur (45 s par point de score). */
    var leader = liste[0];
    for (var j = 0; j < liste.length; j++) {
      var d = liste[j];
      if (!leader || d === leader) { d.gap = 0; continue; }
      var ecart = 45 * (scoreEffectif(leader) - scoreEffectif(d));
      d.gap = parseFloat(Math.max(0, ecart).toFixed(1));
    }
    /* Les abandons occupent les positions suivantes, dans l'ordre. */
    if (lr && lr.drivers) {
      var suivante = liste.length + 1;
      for (var k = 0; k < lr.drivers.length; k++) {
        if (lr.drivers[k] && lr.drivers[k].dnf) lr.drivers[k].pos = suivante++;
      }
    }
  }

  function nouvelleUpdateLivePositions() {
    var lr = LR();
    if (!lr || !lr.drivers) return;

    var vivants = lr.drivers.filter(function (d) { return d && !d.dnf; });
    if (!vivants.length) return;

    /* Premier tour : la grille de départ fait foi, sans réordonnancement. */
    if (lr.cur <= 1) {
      vivants.sort(function (a, b) {
        return (a.gridPos || a.pos || 99) - (b.gridPos || b.pos || 99);
      });
      attribuer(vivants);
      return;
    }

    /* Rang visé : l'ordre des scores effectifs. */
    var cible = vivants.slice().sort(function (a, b) {
      return scoreEffectif(b) - scoreEffectif(a);
    });
    for (var i = 0; i < cible.length; i++) cible[i]._rangCible = i + 1;

    /* Bridage : on se rapproche du rang visé sans téléportation. */
    var bypass = lr._bypassPositionCap;
    if (bypass) lr._bypassPositionCap = false;

    /* Dernier tour : le bridage doit disparaître. Sinon le classement
       affiché à l'arrivée reste figé à mi-chemin de l'ordre réel, et il
       diverge du résultat calculé par le moteur au moment du drapeau. */
    if (lr.total && lr.cur >= lr.total - 1) bypass = true;

    for (var j = 0; j < vivants.length; j++) {
      var d = vivants[j];
      var precedente = d.pos || d._rangCible;
      var saut = SAUT_MAX;
      if (d._lastPitLap && (lr.cur - d._lastPitLap) <= 2) saut = SAUT_MAX_APRES_ARRET;
      if (bypass) saut = vivants.length;

      var delta = d._rangCible - precedente;
      if (delta > saut) delta = saut;
      else if (delta < -saut) delta = -saut;
      d._posSouhaitee = precedente + delta;
    }

    /* Attribution séquentielle : unicité par construction. Le rang visé
       départage deux pilotes qui convoitent la même place — c'est le plus
       rapide qui passe devant, jamais un repli arbitraire. */
    vivants.sort(function (a, b) {
      if (a._posSouhaitee !== b._posSouhaitee) return a._posSouhaitee - b._posSouhaitee;
      return a._rangCible - b._rangCible;
    });
    attribuer(vivants);
  }

  /* ==================================================================
   * 2. RYTHME DE DÉPART COHÉRENT AVEC LA GRILLE
   * ================================================================== */

  /* Certaines disciplines font courir plusieurs classes sur la même piste :
     en endurance, un plateau LMP2/GT3 roule volontairement sous le rythme de
     la classe reine, et le résultat du joueur est sa position DANS SA CLASSE.
     Ces voitures de trafic (_mc) doivent donc rester où le module 35 les a
     placées — les mêler au reste ferait remonter des GT3 devant des Hypercar
     et fausserait le classement de classe. */
  function estTrafic(d) {
    return !!(d && (d._mc || (d.cls && d.cls !== "Hypercar" && !d.isPlayer && d.gridPos === 99)));
  }

  function recalibrerSurLaGrille() {
    var lr = LR();
    if (!lr || !lr.drivers || lr.drivers.length < 3) return;

    var pilotes = lr.drivers.filter(function (d) { return !estTrafic(d); });
    if (pilotes.length < 3) return;
    var n = pilotes.length;

    /* Rang au mérite, tel que le moteur l'a calculé. */
    var parScore = pilotes.slice().sort(function (a, b) {
      return scoreEffectif(b) - scoreEffectif(a);
    });
    var rangMerite = {};
    for (var i = 0; i < parScore.length; i++) rangMerite[parScore[i].name] = i + 1;

    /* Rang mixte : la grille pèse, le mérite garde sa part. */
    for (var j = 0; j < pilotes.length; j++) {
      var d = pilotes[j];
      var grille = d.gridPos || d.startPos || d.pos || (j + 1);
      var merite = rangMerite[d.name] || (j + 1);
      d._rangMixte = POIDS_GRILLE * grille + (1 - POIDS_GRILLE) * merite;
    }

    /* On permute les scores existants : les valeurs, donc les écarts et les
       calibrages du moteur, restent exactement les mêmes. */
    var valeurs = parScore.map(function (d) {
      return { score: d.score, baseScore: d.baseScore };
    });
    var ordreFinal = pilotes.slice().sort(function (a, b) {
      if (a._rangMixte !== b._rangMixte) return a._rangMixte - b._rangMixte;
      return (rangMerite[a.name] || 99) - (rangMerite[b.name] || 99);
    });

    for (var k = 0; k < ordreFinal.length; k++) {
      var p = ordreFinal[k];
      var v = valeurs[k];
      if (!v) continue;
      p.score = v.score;
      p.baseScore = (typeof v.baseScore === "number") ? v.baseScore : v.score;
      delete p._rangMixte;
    }

    decompresserEchelle(ordreFinal);

    console.log(TAG, "rythme de départ aligné sur la grille (" +
                Math.round(POIDS_GRILLE * 100) + " % grille)");
  }

  /* ------------------------------------------------------------------
   * Décompression de l'échelle des scores
   *
   * Mesuré au départ d'un Grand Prix : onze pilotes sur vingt collés entre
   * 0.960 et 0.970. À ce niveau de saturation il n'existe plus de hiérarchie
   * — les écarts affichés tombent à zéro et l'ordre entre eux devient
   * arbitraire, ce qui alimentait l'instabilité du classement.
   *
   * On conserve l'amplitude réelle (le meilleur et le dernier gardent leur
   * score, donc les calibrages du moteur restent valables) et on redistribue
   * les valeurs intermédiaires sur une courbe en puissance : peloton de tête
   * resserré, milieu de grille étalé, fond décroché — la forme d'une grille
   * de Formule 1. Un léger bruit évite une régularité mécanique.
   * ---------------------------------------------------------------- */
  var COURBE = 1.35;

  function decompresserEchelle(ordreFinal) {
    var n = ordreFinal.length;
    if (n < 4) return;

    var scores = ordreFinal.map(function (d) { return d.score || 0; });
    var haut = Math.max.apply(null, scores);
    var bas = Math.min.apply(null, scores);

    /* On ne descend jamais sous le plateau de trafic : sa hiérarchie est
       posée par la discipline, pas par nous. */
    try {
      var lr = LR();
      var trafic = (lr && lr.drivers) ? lr.drivers.filter(estTrafic) : [];
      if (trafic.length) {
        var plafondTrafic = Math.max.apply(null, trafic.map(function (d) { return d.score || 0; }));
        if (bas < plafondTrafic + 0.03) bas = plafondTrafic + 0.03;
        if (haut <= bas) return;
      }
    } catch (e) {}
    var amplitude = haut - bas;
    if (amplitude <= 0.02) return;          // échelle déjà plate : on ne touche à rien

    /* Nombre de pilotes agglutinés dans le haut du tableau. */
    var satures = scores.filter(function (v) { return v >= haut - 0.02; }).length;
    if (satures < 3) return;                // pas de saturation à corriger

    for (var i = 0; i < n; i++) {
      var d = ordreFinal[i];
      var t = (n > 1) ? (i / (n - 1)) : 0;
      var valeur = haut - amplitude * Math.pow(t, COURBE);
      valeur += (Math.random() - 0.5) * 0.006;
      d.score = Math.max(0.02, Math.min(0.99, valeur));
      d.baseScore = d.score;
    }
    console.log(TAG, "échelle décompressée (" + satures + " pilotes étaient au plafond)");
  }

  /* ==================================================================
   * 3. INSTALLATION
   * ================================================================== */

  var _origUpdate = null, _origRun = null;

  function installer() {
    if (typeof window.updateLivePositions === "function" && !window.updateLivePositions._rj81) {
      _origUpdate = window.updateLivePositions;
      window.updateLivePositions = nouvelleUpdateLivePositions;
      window.updateLivePositions._rj81 = true;
    }

    if (typeof window.runRaceLive === "function" && !window.runRaceLive._rj81) {
      _origRun = window.runRaceLive;
      window.runRaceLive = function () {
        var r = _origRun.apply(this, arguments);
        try {
          var lr = LR();
          if (lr && lr.drivers && lr.drivers.length) recalibrerSurLaGrille();
        } catch (e) { console.warn(TAG, "recalibrage :", e && e.message); }
        return r;
      };
      window.runRaceLive._rj81 = true;
    }

    return !!(window.updateLivePositions._rj81 && window.runRaceLive && window.runRaceLive._rj81);
  }

  function boot() {
    var essais = 0;
    (function tenter() {
      if (installer()) {
        console.log(TAG, "actif — classement séquentiel, plus de repli en tête de grille");
        return;
      }
      if (essais++ < 80) setTimeout(tenter, 150);
      else console.warn(TAG, "installation impossible (updateLivePositions introuvable)");
    })();

    window._rj81 = {
      recalibrer: recalibrerSurLaGrille,
      positions: nouvelleUpdateLivePositions,
      poidsGrille: function (v) { if (typeof v === "number") POIDS_GRILLE = Math.max(0, Math.min(1, v)); return POIDS_GRILLE; }
    };

    window._rj81Uninstall = function () {
      if (_origUpdate) window.updateLivePositions = _origUpdate;
      if (_origRun) window.runRaceLive = _origRun;
      console.log(TAG, "désinstallé");
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
