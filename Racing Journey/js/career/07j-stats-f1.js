/* =====================================================================
 * 07j-stats-f1.js — STATISTIQUES F1 MASQUÉES
 *
 * Issu de l'ancien legacy/07-user-fixes.js (« corrections demandées par
 * l'utilisateur »), rangé par domaine lors de la restructuration (T8).
 * =================================================================== */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;



  // ===========================================================================
  // FIX 15 : suppression de la section "Statistiques F1" dans Pilote → Carrière
  // ---------------------------------------------------------------------------
  // La section est définie statiquement dans index.html (id="f1stats-section")
  // et rendue par renderF1Stats() lors du switch d'onglet vers "rep".
  // Approche : forcer display:none et neutraliser renderF1Stats.
  // ===========================================================================

  function _rjHideF1StatsSection() {
    try {
      var sec = document.getElementById('f1stats-section');
      if (sec) sec.style.display = 'none';
    } catch (e) {}
  }

  // Neutraliser renderF1Stats : conserver une référence au cas où, mais ne plus rien afficher
  (function _rjNeutralizeRenderF1Stats() {
    if (window.renderF1Stats && window.renderF1Stats._rjNeutralized) return;
    window.renderF1Stats = function() {
      _rjHideF1StatsSection();
    };
    window.renderF1Stats._rjNeutralized = true;
  })();

  // Cacher la section au démarrage et à chaque navigation vers l'onglet "rep"
  (function _rjPatchPtabForF1Stats() {
    // Cacher au chargement
    if (typeof document !== 'undefined' && document.readyState !== 'loading') {
      _rjHideF1StatsSection();
    } else if (typeof document !== 'undefined') {
      document.addEventListener('DOMContentLoaded', _rjHideF1StatsSection);
    }
    // Wrapper sur ptab si présent (changement d'onglet pilote)
    if (typeof window.ptab === 'function' && !window.ptab._rjF1StatsWrapped) {
      var orig = window.ptab;
      window.ptab = function(tab) {
        var r = orig.apply(this, arguments);
        try { _rjHideF1StatsSection(); } catch (e) {}
        return r;
      };
      window.ptab._rjF1StatsWrapped = true;
    }
  })();

})();
