/* =====================================================================
 * 07d-badges-et-offres.js — BADGES DE L'ACCUEIL ET SURVEILLANCE DES OFFRES
 *
 * Issu de l'ancien legacy/07-user-fixes.js (« corrections demandées par
 * l'utilisateur »), rangé par domaine lors de la restructuration (T8).
 * =================================================================== */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;



  // ========================================================================
  // FIX 8 — NOTIFICATIONS MENU PRINCIPAL ACCUEIL
  // ========================================================================
  // Demande utilisateur :
  //   - Retirer le badge de notification sur l'onglet "Agent"
  //   - Ajouter / activer le badge sur "Contrats" (offres écuries en attente)
  //   - Ajouter / activer le badge sur "Sponsors" (offres sponsors en attente)
  //
  // Stratégie :
  //   - Wrap updateHomeBadges pour : (a) toujours masquer h-agent-badge,
  //     (b) calculer + activer h-sponsors-badge selon G.sponsorOffers,
  //     (c) renforcer h-contracts-badge selon G.offers.
  //   - Watchdog 1.5s pour réappliquer si le code original re-affiche le badge agent.
  // ========================================================================

  function _countAvailableSponsorOffers() {
    if (typeof window.G === 'undefined' || !window.G) return 0;
    var offers = window.G.sponsorOffers || [];
    if (!Array.isArray(offers)) return 0;
    var c = 0;
    for (var i = 0; i < offers.length; i++) {
      var o = offers[i];
      if (!o) continue;
      if (o.signed || o.declined || o.expired) continue;
      c++;
    }
    return c;
  }

  function _countAvailableContractOffers() {
    if (typeof window.G === 'undefined' || !window.G) return 0;
    var offers = window.G.offers || [];
    if (!Array.isArray(offers)) return 0;
    var c = 0;
    for (var i = 0; i < offers.length; i++) {
      var o = offers[i];
      if (!o) continue;
      if (o.signed || o.declined) continue;
      c++;
    }
    return c;
  }

  function _setBadge(id, count) {
    var el = document.getElementById(id);
    if (!el) return;
    if (count > 0) {
      el.style.display = 'inline-flex';
      el.textContent = count > 9 ? '9+' : String(count);
    } else {
      el.style.display = 'none';
      el.textContent = '';
    }
  }

  function applyHomeBadges() {
    try {
      // 1. Badge agent : TOUJOURS masqué
      var ba = document.getElementById('h-agent-badge');
      if (ba) {
        ba.style.display = 'none';
        ba.textContent = '';
      }
      // 2. Badge sponsors : afficher si offres dispo
      _setBadge('h-sponsors-badge', _countAvailableSponsorOffers());
      // 3. Badge contrats : afficher si offres dispo
      _setBadge('h-contracts-badge', _countAvailableContractOffers());
    } catch (e) {
      console.warn('[07] applyHomeBadges error:', e);
    }
  }

  function wrapUpdateHomeBadges() {
    // Nos règles l'emportent : elles passent après l'original.
    rjInscrire("updateHomeBadges", { id: "07-badges", ordre: 0, apres: function () { applyHomeBadges(); } });
    return true;
  }

  var _badgeWatchInterval = setInterval(function() {
    try {
      // N'agit que si le menu accueil est visible (sinon waste)
      var home = document.getElementById('S-home');
      if (home && home.classList && home.classList.contains('on')) {
        applyHomeBadges();
      }
    } catch (e) {}
  }, 1500);


  // ===========================================================================
  // FIX 16 : verrouillage sponsors avant première course + notifications offres
  // ---------------------------------------------------------------------------
  // (a) Bloque l'accès aux sponsors tant que G.races.length === 0
  // (b) Surveille G.offers et G.sponsorOffers : notifie le joueur quand
  //     de nouvelles offres apparaissent (toast + badge)
  // ===========================================================================

  // --- Partie (a) : verrouillage sponsors ---
  function _rjAreSponsorsLocked() {
    try {
      if (typeof window.G === 'undefined' || !window.G) return true;
      return !(G.races && G.races.length > 0);
    } catch (e) { return false; }
  }

  function _rjShowSponsorsLockedMessage() {
    try {
      var list = document.getElementById('sp-list');
      if (!list) return;
      list.innerHTML = '<div style="margin:14px;padding:18px 16px;background:linear-gradient(180deg,rgba(239,68,68,0.08),rgba(239,68,68,0.02));border:1px solid rgba(239,68,68,0.30);border-left:3px solid #EF4444;border-radius:var(--r)"><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="font-family:var(--font-display);font-size:11px;font-weight:800;color:#EF4444;letter-spacing:.10em;text-transform:uppercase">Sponsors verrouillés</span></div><div style="font-size:13px;color:var(--text2);line-height:1.55">Les sponsors te contacteront <strong>après ta première course</strong>. Termine ton premier week-end de compétition pour débloquer les opportunités de partenariats.</div></div>';
      // Aussi masquer les onglets dispo/actifs si présents
      try {
        var tabs = document.querySelectorAll('#S-sponsors .tabs .tab');
        if (tabs && tabs.length) {
          tabs.forEach(function(t) { t.style.display = 'none'; });
        }
      } catch (_eTabs) {}
    } catch (e) { console.warn('[07] lock sponsors UI failed:', e); }
  }

  // Wrap renderSponsorsNew avec test verrouillage
  (function _rjWrapSponsorsRender() {
    if (typeof window.renderSponsorsNew !== 'function') {
      // Fallback : retry après DOMContentLoaded au cas où la fonction n'est pas encore définie
      if (typeof document !== 'undefined' && document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _rjWrapSponsorsRender);
      } else {
        setTimeout(_rjWrapSponsorsRender, 500);
      }
      return;
    }
    if (window.renderSponsorsNew._rjLockWrapped) return;
    var orig = window.renderSponsorsNew;
    rjInscrire("renderSponsorsNew", { id: "07d-badges-et-offres:renderSponsorsNew", ordre: -2300, remplace: function (args, suite) {
      if (_rjAreSponsorsLocked()) {
        return _rjShowSponsorsLockedMessage();
      }
      return suite();
    } });
    window.renderSponsorsNew._rjLockWrapped = true;
    console.log('[07] renderSponsorsNew wrappé (verrouillage avant 1ère course)');
  })();

  // Idem pour renderSponsorsActiveNew (au cas où le joueur tente d'accéder aux actifs)
  (function _rjWrapSponsorsActiveRender() {
    if (typeof window.renderSponsorsActiveNew !== 'function') {
      if (typeof document !== 'undefined' && document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _rjWrapSponsorsActiveRender);
      } else {
        setTimeout(_rjWrapSponsorsActiveRender, 500);
      }
      return;
    }
    if (window.renderSponsorsActiveNew._rjLockWrapped) return;
    var orig = window.renderSponsorsActiveNew;
    rjInscrire("renderSponsorsActiveNew", { id: "07d-badges-et-offres:renderSponsorsActiveNew", ordre: -2300, remplace: function (args, suite) {
      if (_rjAreSponsorsLocked()) {
        // Affiche aussi le message dans la liste "actifs"
        try {
          var list = document.getElementById('sp-active-list');
          if (list) list.innerHTML = '<div style="padding:18px 16px;text-align:center;color:var(--text3);font-size:13px;font-style:italic">Aucun sponsor actif — débloqué après la 1ère course</div>';
        } catch (_e) {}
        return;
      }
      return suite();
    } });
    window.renderSponsorsActiveNew._rjLockWrapped = true;
    console.log('[07] renderSponsorsActiveNew wrappé');
  })();

  // --- Partie (b) : notifications nouvelles offres ---
  // On surveille périodiquement G.offers et G.sponsorOffers : à chaque nouvelle
  // offre, on push un toast + on rafraîchit les badges.

  // Initialisation du compteur à partir des offres déjà présentes (évite faux positif au premier tick)
  var _rjLastContractOffersCount = -1;
  var _rjLastSponsorOffersCount = -1;
  var _rjLastSponsorLockState = null;  // suit l'état verrouillé/débloqué pour notifier la transition
  var _rjOfferWatcherInstalled = false;

  function _rjCheckNewOffers() {
    try {
      if (typeof window.G === 'undefined' || !window.G) return;

      // Compte les offres "actives" (non signées/refusées/expirées)
      var nbContracts = _countAvailableContractOffers();
      var nbSponsors = _countAvailableSponsorOffers();
      var lockedNow = _rjAreSponsorsLocked();

      // Premier tick après chargement : on initialise sans notifier
      if (_rjLastContractOffersCount < 0) {
        _rjLastContractOffersCount = nbContracts;
        _rjLastSponsorOffersCount = nbSponsors;
        _rjLastSponsorLockState = lockedNow;
        return;
      }

      // Transition verrouillé → débloqué (juste après la 1ère course terminée)
      if (_rjLastSponsorLockState === true && lockedNow === false) {
        try {
          if (typeof pushHomeToast === 'function') {
            pushHomeToast('Sponsors disponibles', 'Ta première course est terminée. Les sponsors arrivent !', '#F0A020');
          }
        } catch (_eU) {}
      }
      _rjLastSponsorLockState = lockedNow;

      // Nouveau contrat ?
      if (nbContracts > _rjLastContractOffersCount) {
        var delta = nbContracts - _rjLastContractOffersCount;
        try {
          if (typeof pushHomeToast === 'function') {
            var label = delta === 1 ? 'Nouvelle offre d\u0027équipe' : delta + ' nouvelles offres d\u0027équipe';
            pushHomeToast(label, 'Va dans Contrats pour les consulter.', '#60A5FA');
          }
        } catch (_eT) {}
      }

      // Nouveau sponsor (uniquement si pas verrouillé : pas la peine de notifier des offres qui sont cachées)
      if (nbSponsors > _rjLastSponsorOffersCount && !lockedNow) {
        var deltaS = nbSponsors - _rjLastSponsorOffersCount;
        try {
          if (typeof pushHomeToast === 'function') {
            var labelS = deltaS === 1 ? 'Nouvelle offre de sponsor' : deltaS + ' nouvelles offres sponsors';
            pushHomeToast(labelS, 'Va dans Sponsors pour les consulter.', '#F0A020');
          }
        } catch (_eT2) {}
      }

      _rjLastContractOffersCount = nbContracts;
      _rjLastSponsorOffersCount = nbSponsors;

      // Toujours rafraîchir les badges au passage
      try { applyHomeBadges(); } catch (_eB) {}
    } catch (e) {
      console.warn('[07] _rjCheckNewOffers error:', e);
    }
  }

  function _rjInstallOfferWatcher() {
    if (_rjOfferWatcherInstalled) return;
    _rjOfferWatcherInstalled = true;
    // Premier check immédiat (initialisation des compteurs)
    setTimeout(_rjCheckNewOffers, 200);
    // Puis polling toutes les 1.5s — léger et garantit la détection
    setInterval(_rjCheckNewOffers, 1500);
    console.log('[07] Offer watcher installé (polling 1.5s)');
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _rjInstallOfferWatcher);
    } else {
      _rjInstallOfferWatcher();
    }
  }

  function appliquer() {
    try { wrapUpdateHomeBadges(); } catch (e) { console.warn('[07] wrapUpdateHomeBadges();', e); }
    try { applyHomeBadges(); } catch (e) { console.warn('[07] applyHomeBadges();', e); }
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
