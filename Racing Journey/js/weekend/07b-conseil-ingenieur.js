/* =====================================================================
 * 07b-conseil-ingenieur.js — CONSEIL DE L'INGÉNIEUR
 *
 * Issu de l'ancien legacy/07-user-fixes.js (« corrections demandées par
 * l'utilisateur »), rangé par domaine lors de la restructuration (T8).
 * =================================================================== */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;



  // ========================================================================
  // FIX 4 — "DEMANDER À L'INGÉNIEUR" DANS ÉQUILIBRE VOITURE
  // ========================================================================
  // askEngineerHint() existe déjà et déplace les curseurs (setAdvParam).
  // On wrap pour : (a) garantir un re-render visible des sliders après ajustement,
  // (b) afficher un toast de confirmation court, (c) ajouter un effet visuel
  // (highlight) sur les paramètres modifiés.
  // ========================================================================

  function wrapAskEngineerHint() {
    if (typeof window.askEngineerHint !== 'function') return false;
    if (window.askEngineerHint._rjUserFixEnhanced) return true;

    var orig = window.askEngineerHint;
    rjInscrire("askEngineerHint", { id: "07b-conseil-ingenieur:askEngineerHint", ordre: -2100, remplace: function (args, suite) {
      // Snapshot avant
      var before = null;
      try {
        if (window.G && window.G.setupAdv) {
          before = JSON.parse(JSON.stringify(window.G.setupAdv));
        }
      } catch (e) {}

      var result;
      try {
        result = suite();
      } catch (e) {
        console.warn('[07] askEngineerHint orig error:', e);
        return result;
      }

      // Après l'appel : re-render forcé pour que les curseurs bougent visuellement
      try {
        if (typeof window.renderAdvancedSetupUI === 'function') {
          window.renderAdvancedSetupUI();
        }
      } catch (e) {}

      // Highlight visuel sur les paramètres modifiés
      try {
        if (before && window.G && window.G.setupAdv) {
          var after = window.G.setupAdv;
          var changed = [];
          Object.keys(after).forEach(function(k) {
            if (before[k] !== after[k]) changed.push(k);
          });
          if (changed.length > 0) {
            // Petit délai pour laisser le DOM se rendre
            setTimeout(function() {
              changed.forEach(function(k) {
                var el = document.querySelector('[data-setup-param="' + k + '"]') ||
                         document.getElementById('setup-' + k) ||
                         document.querySelector('input[data-param="' + k + '"]');
                if (el) {
                  var card = el.closest('.setup-row') || el.closest('div');
                  if (card) {
                    card.style.transition = 'background .4s ease';
                    var oldBg = card.style.background;
                    card.style.background = 'rgba(96,165,250,0.18)';
                    setTimeout(function() {
                      card.style.background = oldBg || '';
                    }, 1100);
                  }
                }
              });
            }, 50);
          }
        }
      } catch (e) {}

      return result;
    } });
    window.askEngineerHint._rjUserFixEnhanced = true;
    console.log('[07] askEngineerHint enhanced (visible cursor moves + highlights)');
    return true;
  }

  function appliquer() {
    try { wrapAskEngineerHint(); } catch (e) { console.warn('[07] wrapAskEngineerHint();', e); }
  }
  // Comme l'ancien installateur commun : au chargement, puis trois reprises
  // (des modules chargés après peuvent redéfinir les fonctions visées).
  function planifier() {
    appliquer();
    setTimeout(appliquer, 300);
    setTimeout(appliquer, 1200);
    setTimeout(appliquer, 3000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', planifier);
  else planifier();
})();
