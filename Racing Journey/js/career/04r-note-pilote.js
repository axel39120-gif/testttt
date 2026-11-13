/* =====================================================================
 * 04r-note-pilote.js — RÉÉQUILIBRAGE DE LA NOTE DU PILOTE
 *
 * Issu de l'ancien legacy/04j-corrections.js, rangé par domaine (T8).
 * =================================================================== */

/* ==================================================================== *
 * Rééquilibrage de la note du pilote
 * (anciennement 04r-skill-rebalance.js)
 * ==================================================================== */

(function() {
  'use strict';
  if (typeof window === 'undefined') return;

  // ========================================================================
  // BARÈME REBALANCE : mapping ancien → nouveau par catégorie (note joueur)
  // ========================================================================
  var REBALANCE_TABLE = {
    "Karting Junior":   { oldMin: 37, oldMax: 54, newMin: 28, newMax: 45 },
    "Karting Senior":   { oldMin: 47, oldMax: 65, newMin: 38, newMax: 56 },
    "Formule 4":        { oldMin: 52, oldMax: 72, newMin: 45, newMax: 65 },
    "Formula Regional": { oldMin: 58, oldMax: 78, newMin: 52, newMax: 72 },
    "Formule 3":        { oldMin: 63, oldMax: 83, newMin: 58, newMax: 78 },
    "Formule 2":        { oldMin: 69, oldMax: 88, newMin: 65, newMax: 83 },
    "Formule 1":        { oldMin: 75, oldMax: 96, newMin: 70, newMax: 95 },
    "Super Formula":    { oldMin: 75, oldMax: 90, newMin: 70, newMax: 87 },
    "Endurance WEC":    { oldMin: 76, oldMax: 90, newMin: 70, newMax: 86 },
    "IndyCar":          { oldMin: 75, oldMax: 90, newMin: 70, newMax: 86 }
  };

  // ========================================================================
  // FONCTION DE RÉÉQUILIBRAGE
  // Transpose une note de l'ancienne échelle vers la nouvelle pour une cat.
  // ========================================================================
  function rebalanceSkill(oldSk, cat) {
    var t = REBALANCE_TABLE[cat];
    if (!t || typeof oldSk !== "number") return oldSk;
    var oldRange = t.oldMax - t.oldMin;
    if (oldRange <= 0) return oldSk;
    var rel = (oldSk - t.oldMin) / oldRange;
    rel = Math.max(0, Math.min(1, rel));
    var newRange = t.newMax - t.newMin;
    var newSk = t.newMin + rel * newRange;
    return Math.round(newSk);
  }

  /* Une seule échelle pour toute la carrière (v286). Avant, chaque catégorie
     avait sa table, plafonnée à son maximum : en Karting Junior la note se
     figeait à 45 quand les stats dépassaient le plafond, puis bondissait à 55
     au passage en Karting Senior (même stats, autre table). La courbe reprend
     les points des tables par catégorie (elles se recoupaient presque), sans
     plafond : la note continue de monter. Le frein est ailleurs, là où il est
     réaliste — l'entraînement rapporte de moins en moins au-dessus du niveau
     de la catégorie (_overCapPenalty, 03). */
  var COURBE = [[37, 28], [54, 45], [65, 56], [72, 65], [78, 72], [83, 78], [88, 83], [96, 95], [99, 98]];
  function noteContinue(brute) {
    if (brute <= COURBE[0][0]) return Math.round(brute - (COURBE[0][0] - COURBE[0][1]));
    for (var i = 1; i < COURBE.length; i++) {
      var a = COURBE[i - 1], b = COURBE[i];
      if (brute <= b[0]) return Math.round(a[1] + (brute - a[0]) * (b[1] - a[1]) / (b[0] - a[0]));
    }
    return Math.min(99, Math.round(brute - 1));
  }

  // ========================================================================
  // WRAP calcPlayerRating — rebalance la note du joueur (SEUL volet actif)
  // ========================================================================
  function wrapCalcPlayerRating() {
    if (typeof window.calcPlayerRating !== "function") return false;
    if (window.calcPlayerRating._rjRebalanced) return true;

    var orig = window.calcPlayerRating;
    rjInscrire("calcPlayerRating", { id: "04r-note-pilote:calcPlayerRating", ordre: -1100, remplace: function (args, suite) {
      var oldRating;
      try { oldRating = suite(); }
      catch (e) { return 50; }
      if (typeof oldRating !== "number") return oldRating;

      return noteContinue(oldRating);
    } });
    window.calcPlayerRating._rjRebalanced = true;
    console.log("[04r] calcPlayerRating wrappé (note joueur rebalancée)");
    return true;
  }

  // ========================================================================
  // BOOTSTRAP — applique le wrap dès que calcPlayerRating est disponible
  // ========================================================================
  function boot(retries) {
    if (wrapCalcPlayerRating()) {
      console.log("[04r] Player Rating Rebalance — actif (note joueur uniquement)");
      return;
    }
    if (retries > 0) { setTimeout(function() { boot(retries - 1); }, 300); return; }
    console.warn("[04r] calcPlayerRating introuvable — rebalance joueur non appliqué.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() { boot(40); });
  } else {
    boot(40);
  }

  // ========================================================================
  // DEBUG
  // ========================================================================
  window.rjRebalanceDebug = function() {
    var wrapped = !!(window.calcPlayerRating && window.calcPlayerRating._rjRebalanced);
    var cat = (typeof G !== "undefined" && G) ? G.cat : null;
    console.log("=== 04r Player Rating Rebalance ===");
    console.log("calcPlayerRating wrappé :", wrapped);
    console.log("catégorie courante      :", cat);
    if (wrapped && typeof window.calcPlayerRating === "function") {
      console.log("note joueur (rebalancée):", window.calcPlayerRating());
    }
  };

  window._RJ_REBAL = {
    rebalanceSkill: rebalanceSkill,
    noteContinue: noteContinue,
    REBALANCE_TABLE: REBALANCE_TABLE
  };

})();
