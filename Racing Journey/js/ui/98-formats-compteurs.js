/* =====================================================================
 * 98-formats-compteurs.js — UNE SEULE FAÇON D'ÉCRIRE LES GRANDS NOMBRES
 *
 * DEUX DÉFAUTS CONSTATÉS
 *
 * 1. Une seule décimale, arrondie sèchement.
 *    1 450 mentions « j'aime » s'affichaient « 1 k » : on perdait presque
 *    la moitié de l'information. Il en faut deux pour que le chiffre
 *    signifie quelque chose — « 1,45 k ».
 *
 * 2. Trois formateurs pour la même chose.
 *    fmt (fil X), fmtFollowers (abonnés) et _fmtCompactNum (mentions et
 *    réponses) arrondissaient chacun à leur manière. Le même nombre
 *    d'abonnés s'écrivait donc « 487.4 k » ou « 487 k » selon l'endroit du
 *    code qui redessinait l'écran — d'où l'impression de clignotement à
 *    chaque interaction.
 *
 * Une règle unique, appliquée partout : jusqu'à deux décimales, les zéros
 * inutiles retirés, la virgule française comme séparateur.
 *
 *     1 450  →  1,45 k        487 400  →  487,4 k
 *     2 000  →  2 k           1 234 567  →  1,23 M
 *
 * Réversible : window._rj98Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[98-formats]";

  /* Jusqu'à deux décimales, sans zéros inutiles, virgule française. */
  function decimales(v) {
    return v.toFixed(2)
      .replace(/0+$/, "")      // 487.40 → 487.4  ·  2.00 → 2.
      .replace(/\.$/, "")      // 2. → 2
      .replace(".", ",");      // 1.45 → 1,45
  }

  function compact(n, espace) {
    n = Math.round(Number(n) || 0);
    /* Espace insécable : avec une espace ordinaire, « 268 k » se coupait en
       fin de ligne, le « k » passant seul à la ligne suivante. */
    var sep = espace ? "\u00a0" : "";
    /* Les seuils tiennent compte de l'arrondi à deux décimales : sans cela,
       999 999 devenait « 1000k » au lieu de « 1 M ». */
    if (n >= 999995) return decimales(n / 1e6) + sep + "M";
    if (n >= 999.995) return decimales(n / 1e3) + sep + "k";
    return String(n);
  }

  var _orig = {};

  function installer() {
    var pose = 0;

    /* Mentions « j'aime », republications et réponses du fil. */
    if (typeof window._fmtCompactNum === "function" && !window._fmtCompactNum._rj98) {
      _orig._fmtCompactNum = window._fmtCompactNum;
      window._fmtCompactNum = function (n) { return compact(n, false); };
      window._fmtCompactNum._rj98 = true;
      pose++;
    }

    /* Nombre d'abonnés. */
    if (typeof window.fmtFollowers === "function" && !window.fmtFollowers._rj98) {
      _orig.fmtFollowers = window.fmtFollowers;
      window.fmtFollowers = function (n) { return compact(n, false); };
      window.fmtFollowers._rj98 = true;
      pose++;
    }

    return pose > 0 || !!(_orig._fmtCompactNum && _orig.fmtFollowers);
  }

  function boot() {
    var essais = 0;
    (function tenter() {
      if (installer()) {
        console.log(TAG, "compteurs unifiés — deux décimales, virgule française");
        try { if (typeof window.renderSocialTab === "function") window.renderSocialTab(); } catch (e) {}
        return;
      }
      if (essais++ < 80) setTimeout(tenter, 150);
    })();

    window._rj98 = { compact: compact };
    window._rj98Uninstall = function () {
      Object.keys(_orig).forEach(function (k) { window[k] = _orig[k]; });
      console.log(TAG, "désinstallé");
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
