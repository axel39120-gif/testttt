/* =====================================================================
 * 07e-vie-perso.js — VIE PERSONNELLE
 *
 * Issu de l'ancien legacy/07-user-fixes.js (« corrections demandées par
 * l'utilisateur »), rangé par domaine lors de la restructuration (T8).
 * =================================================================== */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;



  // ========================================================================
  // FIX 9 — STYLE DE VIE > VIE PERSO : RETIRER LES SOUS-TITRES
  // ========================================================================
  // Demande utilisateur : supprimer les sous-titres "Parents", "Amis proches",
  // "Coach personnel" qui apparaissent comme sections (.t-sec) dans l'onglet
  // Vie perso. Les noms restent visibles dans les cartes elles-mêmes.
  //
  // Stratégie : wrap renderVieperso pour, après le rendu, parcourir
  // #vp-content et retirer tout .t-sec dont le texte matche ces 3 labels.
  // C'est plus robuste qu'un strip HTML car ça couvre :
  //   - Les cartes de relation (Parents, Amis proches, Coach recruté)
  //   - Le bloc de recrutement coach (quand pas encore embauché)
  //   - Tout futur ajout par d'autres modules
  // ========================================================================

  var _RJ_HIDDEN_LABELS = ['Parents', 'Amis proches', 'Coach personnel'];

  function _hideRelationSubtitles() {
    try {
      var container = document.getElementById('vp-content');
      if (!container) return;
      var secs = container.querySelectorAll('.t-sec');
      for (var i = 0; i < secs.length; i++) {
        var txt = (secs[i].textContent || '').trim();
        if (_RJ_HIDDEN_LABELS.indexOf(txt) >= 0) {
          secs[i].style.display = 'none';
        }
      }
    } catch (e) {
      console.warn('[07] _hideRelationSubtitles error:', e);
    }
  }

  function wrapRenderVieperso() {
    if (typeof window.renderVieperso !== 'function') return false;
    if (window.renderVieperso._rjUserFixNoSub) return true;

    var orig = window.renderVieperso;
    rjInscrire("renderVieperso", { id: "07e-vie-perso:renderVieperso", ordre: -2400, remplace: function (args, suite) {
      var r;
      try { r = suite(); }
      catch (e) { console.warn('[07] renderVieperso orig:', e); }
      // Après le rendu : masque les sous-titres
      _hideRelationSubtitles();
      // Re-tentative async au cas où le DOM est mis à jour de manière différée
      setTimeout(_hideRelationSubtitles, 50);
      return r;
    } });
    window.renderVieperso._rjUserFixNoSub = true;
    console.log('[07] renderVieperso wrapped (hide Parents/Amis/Coach sub-titles)');
    return true;
  }

  var _viePersoWatchInterval = setInterval(function() {
    try {
      var lifestyle = document.getElementById('S-lifestyle');
      var vpEl = document.getElementById('ls-vieperso');
      if (lifestyle && lifestyle.classList && lifestyle.classList.contains('on') &&
          vpEl && vpEl.style.display !== 'none') {
        _hideRelationSubtitles();
      }
    } catch (e) {}
  }, 1500);

  function appliquer() {
    try { wrapRenderVieperso(); } catch (e) { console.warn('[07] wrapRenderVieperso();', e); }
    try { _hideRelationSubtitles(); } catch (e) { console.warn('[07] _hideRelationSubtitles();', e); }
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
