/* =====================================================================
 * 07h-stats-carriere.js — FILTRES DES STATISTIQUES DE CARRIÈRE
 *
 * Issu de l'ancien legacy/07-user-fixes.js (« corrections demandées par
 * l'utilisateur »), rangé par domaine lors de la restructuration (T8).
 * =================================================================== */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;



  // ===========================================================================
  // FIX 12 : filtre par categorie sur l'historique des saisons
  // ---------------------------------------------------------------------------
  // Le menu deroulant "Toute la carriere / Karting Junior / F4 / ..." sur la
  // page Pilote -> Carriere filtrait uniquement les chiffres agreges (Saisons,
  // Courses, Victoires, Podiums, Poles, Titres) du panneau du haut. Les cartes
  // de saison rendues en dessous restaient toutes visibles, independamment du
  // filtre choisi.
  //
  // Ce fix :
  //   - Tague chaque carte saison avec data-rj-cat="<categorie>" apres chaque
  //     appel a renderCareerDetail() (base sur l'ordre de window._careerAllSeasons)
  //   - Wrap selectCareerFilter et filterCareerStats pour, en plus du calcul
  //     d'agregats existant, afficher/masquer les cartes selon la categorie.
  //   - "all" -> toutes les cartes visibles (comportement par defaut).
  //   - Idempotent, robuste si _careerAllSeasons n'est pas peuple.
  // ===========================================================================
  function _rjTagCareerSeasonCards() {
    try {
      var container = document.getElementById('career-detail-content');
      if (!container) return;
      var seasons = window._careerAllSeasons;
      if (!Array.isArray(seasons) || !seasons.length) return;
      var ordered = seasons.slice().reverse();
      // Fallback if :scope unsupported in old WebViews
      var allDivs;
      try { allDivs = container.querySelectorAll(':scope > div'); }
      catch (_) { allDivs = []; for (var ii=0; ii<container.children.length; ii++) { if (container.children[ii].tagName === 'DIV') allDivs.push(container.children[ii]); } }
      var cards = [];
      for (var i = 0; i < allDivs.length; i++) {
        var s = allDivs[i].getAttribute('style') || '';
        if (s.indexOf('border-radius:var(--r)') !== -1 &&
            s.indexOf('surface2') !== -1 &&
            allDivs[i].id !== 'career-stats-grid' &&
            allDivs[i].id !== 'career-stats-sep') {
          cards.push(allDivs[i]);
        }
      }
      var n = Math.min(cards.length, ordered.length);
      for (var k = 0; k < n; k++) {
        var seasonCat = ordered[k] && ordered[k].cat ? String(ordered[k].cat) : '';
        cards[k].setAttribute('data-rj-cat', seasonCat);
      }
    } catch (e) {
      console.warn('[07] _rjTagCareerSeasonCards failed:', e);
    }
  }

  function _rjApplyCareerSeasonFilter(cat) {
    try {
      var container = document.getElementById('career-detail-content');
      if (!container) return;
      var cards = container.querySelectorAll('[data-rj-cat]');
      var anyVisible = false;
      for (var i = 0; i < cards.length; i++) {
        var c = cards[i];
        var cardCat = c.getAttribute('data-rj-cat');
        var show = (!cat || cat === 'all') ? true : (cardCat === cat);
        c.style.display = show ? '' : 'none';
        if (show) anyVisible = true;
      }
      var sep = document.getElementById('career-stats-sep');
      if (sep) sep.style.display = anyVisible ? '' : 'none';
    } catch (e) {
      console.warn('[07] _rjApplyCareerSeasonFilter failed:', e);
    }
  }

  (function _rjWrapRenderCareerDetail() {
    if (typeof renderCareerDetail !== 'function') return;
    if (renderCareerDetail._rjTagged) return;
    var orig = renderCareerDetail;
    rjInscrire("renderCareerDetail", { id: "07h-stats-carriere:renderCareerDetail", ordre: -2700, remplace: function (args, suite) {
      var r = suite();
      try {
        _rjTagCareerSeasonCards();
        var dd = document.getElementById('career-filter-dd');
        var current = 'all';
        if (dd) {
          var on = dd.querySelector('.cf-dd-opt.on');
          if (on) {
            var dc = on.getAttribute('data-cat');
            if (dc) current = dc;
          }
        }
        _rjApplyCareerSeasonFilter(current);
      } catch (e) {}
      return r;
    } });
    window.renderCareerDetail._rjTagged = true;
  })();

  (function _rjWrapFilterCareerStats() {
    if (typeof filterCareerStats !== 'function') return;
    if (filterCareerStats._rjWrapped) return;
    var orig = filterCareerStats;
    rjInscrire("filterCareerStats", { id: "07h-stats-carriere:filterCareerStats", ordre: -2700, remplace: function (args, suite) {
      var cat = args[0];
      var r = suite();
      try { _rjApplyCareerSeasonFilter(cat); } catch (e) {}
      return r;
    } });
    window.filterCareerStats._rjWrapped = true;
  })();

})();
