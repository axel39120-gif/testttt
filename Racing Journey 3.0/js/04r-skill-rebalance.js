/* =============================================================================
 * 04r — PLAYER RATING REBALANCE (rééquilibrage de la note du joueur) — v2
 * =============================================================================
 *
 * HISTORIQUE / POURQUOI CETTE VERSION ALLÉGÉE
 * -------------------------------------------
 * La v1 prétendait recalibrer TOUTES les notes (joueur + rivaux) et ajouter
 * un système de "potentiel caché" + évolution de fin de saison. Une analyse
 * runtime a montré que tout le volet RIVAUX était INERTE :
 *
 *   - Il ciblait la propriété `rv.sk`, qui n'existe pas sur G.rivals : les
 *     rivaux portent `skill` (construits via skill:_boostedSkill(e.sk,...)
 *     dans 03-data-agent). La garde `typeof rv.sk === "number"` échouait donc
 *     toujours → 0 rival rebalancé (mesuré : 0/19), malgré un log trompeur
 *     "N rivaux rebalanced".
 *   - `hiddenPotential` était calculé sur `rv.sk || 50` = base fixe 50,
 *     décorrélé de la vraie note, et n'était lu par aucun autre module.
 *   - `evolveRivalSkillsEndOfSeason` opérait elle aussi sur `sk` (fantôme).
 *
 * L'autorité réelle et unique sur les notes des RIVAUX est le module 04k
 * (distribution gaussienne tirée par le ranking voiture, écrite sur `skill`,
 * idempotente par catégorie/saison). 04r n'avait donc aucun effet sur eux.
 *
 * CE QUI ÉTAIT — ET RESTE — ACTIF : la note du JOUEUR.
 * Le wrap de `calcPlayerRating` reçoit bien un nombre, donc `rebalanceSkill`
 * s'y applique réellement. Cette note alimente l'affichage ET des décisions
 * (seuil d'accès académies, logique de promotion de catégorie). On la conserve
 * À L'IDENTIQUE pour ne pas toucher à l'équilibre du jeu.
 *
 * Le volet rivaux (initRivals, potentiel, évolution, season-end, migration)
 * a été retiré : code mort + logs faussement rassurants. Aucun comportement
 * observable n'est modifié par ce retrait.
 *
 * NOTE DE DESIGN (pour plus tard, hors scope de cette livraison)
 * --------------------------------------------------------------
 *   - Asymétrie connue : le joueur est rebalancé par ce module, les rivaux
 *     suivent l'échelle 04k. Ce n'est pas cosmétique (académies/promotion).
 *     À harmoniser consciemment si souhaité.
 *   - Faire vivre un vrai "potentiel + évolution des notes" est une feature
 *     à part entière : il faudrait la brancher sur `skill` ET la coordonner
 *     avec 04k (qui recalibre en début de saison). À traiter comme un chantier
 *     dédié, pas comme une réparation de ce module.
 *
 * ORDRE DE CHARGEMENT : inchangé (après 03-data-agent pour calcPlayerRating).
 * ===========================================================================*/

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

  // ========================================================================
  // WRAP calcPlayerRating — rebalance la note du joueur (SEUL volet actif)
  // ========================================================================
  function wrapCalcPlayerRating() {
    if (typeof window.calcPlayerRating !== "function") return false;
    if (window.calcPlayerRating._rjRebalanced) return true;

    var orig = window.calcPlayerRating;
    window.calcPlayerRating = function rjCalcPlayerRatingRebalanced() {
      var oldRating;
      try { oldRating = orig.apply(this, arguments); }
      catch (e) { return 50; }
      if (typeof oldRating !== "number") return oldRating;

      var cat = (typeof G !== "undefined" && G) ? G.cat : null;
      if (!cat || !REBALANCE_TABLE[cat]) return oldRating;
      return rebalanceSkill(oldRating, cat);
    };
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
    REBALANCE_TABLE: REBALANCE_TABLE
  };

})();
