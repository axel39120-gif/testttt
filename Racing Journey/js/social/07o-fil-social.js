
// ===========================================================================
// FIX 20 : RÉSEAUX SOCIAUX — Feed visible et action "Poster"
// ---------------------------------------------------------------------------
// Problème : renderSocialTab() existe et génère le feed, mais l'onglet
// "Réseaux sociaux" de S-media ne l'affiche pas (mt-reseaux est display:none
// et renderSocialTab() n'est pas appelée depuis refreshScreen).
// Solution : wrapper mtab pour déclencher renderSocialTab sur onglet "reseaux",
// + injection d'un bouton "Poster ce soir" visible dans le header de S-media
// avec feedback immédiat (followers gagnés, effet rep).
// ===========================================================================
(function _rjFixSocialFeed() {

  // (renderSocialTab est appelée par mtab via renderRepMediaScreen("reseaux").)

  // Wrapper refreshScreen pour S-media
  (function _rjWrapRefreshForSocial() {
    function doWrap() {
      if (typeof window.refreshScreen !== 'function') {
        setTimeout(doWrap, 500); return;
      }
      if (window.refreshScreen._rjSocialWrapped) return;
      var orig = window.refreshScreen;
      /* Réaction à l'écran médias : inscription au registre (module 88). */
      if (!Array.isArray(window.RJ_SCREEN_HOOKS)) window.RJ_SCREEN_HOOKS = [];
      if (!window.RJ_SCREEN_HOOKS.some(function (h) { return h && h.id === "07-user-fixes-media"; })) {
        window.RJ_SCREEN_HOOKS.push({
          id: "07-user-fixes-media",
          ecran: "S-media",
          apres: function (screenId) {
        
        try {
          if (screenId === 'S-media') {
            // Injecter le bouton "Poster" dans le header de S-media
            setTimeout(_rjInjectSocialPostButton, 50);
            // Si l'onglet réseaux est actif, le rendre
            var reseauxTab = document.querySelector('#S-media .tab[data-tab="reseaux"].on');
            if (reseauxTab && typeof renderSocialTab === 'function') renderSocialTab();
          }
        } catch(e) { console.warn('[07-FIX20] refresh social:', e); }          }
        });
      }
      window.refreshScreen._rjSocialWrapped = true;
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', doWrap);
    } else { doWrap(); }
  })();

  // Injecter le bouton "Poster" dans l'onglet réseaux si absent
  function _rjInjectSocialPostButton() {
    var reseauxDiv = document.getElementById('mt-reseaux');
    if (!reseauxDiv) return;
    if (reseauxDiv.querySelector('#rj-social-post-btn-wrap')) return;

    // Insérer un bouton rapide "Poster ce soir" après les stats ig
    var igBlock = reseauxDiv.querySelector('[id^="ig-"]');
    if (!igBlock) return;

    // Remonter jusqu'au parent direct de mt-reseaux
    var insertAfter = reseauxDiv.querySelector('#ig-feed');
    if (!insertAfter) return;

    var wrap = document.createElement('div');
    wrap.id = 'rj-social-post-btn-wrap';
    wrap.style.cssText = 'padding:0 16px 12px';

    var btnLabel = (typeof SOCIAL_LAST_WEEK !== 'undefined' && SOCIAL_LAST_WEEK === G.semaine)
      ? 'Déjà posté cette semaine'
      : 'Poster ce soir — 1 PA';

    var disabled = (typeof SOCIAL_LAST_WEEK !== 'undefined' && SOCIAL_LAST_WEEK === G.semaine) || (G.pa || 0) < 1;

    wrap.innerHTML = '<div style="margin-bottom:10px;padding:12px 14px;background:rgba(131,58,180,.08);border:1px solid rgba(131,58,180,.25);border-radius:var(--r)">'
      + '<div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:#A855F7;letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px">Action de la semaine</div>'
      + '<div style="display:flex;flex-direction:column;gap:8px" id="rj-post-type-btns">'
      + _rjBuildPostTypeBtn('victoire', '🏆 Célébrer une victoire', disabled)
      + _rjBuildPostTypeBtn('entrainement', '💪 Montrer l\'entraînement', disabled)
      + _rjBuildPostTypeBtn('lifestyle', '✨ Moment lifestyle', disabled)
      + _rjBuildPostTypeBtn('rien', '📱 Post neutre', disabled)
      + '</div>'
      + '</div>';

    insertAfter.parentNode.insertBefore(wrap, insertAfter);
  }

  function _rjBuildPostTypeBtn(tone, label, disabled) {
    var baseStyle = 'padding:10px 14px;border-radius:var(--r);font-size:12px;font-weight:700;font-family:var(--font-display);cursor:pointer;text-align:left;width:100%;border:none;transition:opacity .15s;';
    if (disabled) {
      return '<button style="' + baseStyle + 'background:var(--surface2);color:var(--muted);cursor:not-allowed;opacity:.5" disabled>' + label + '</button>';
    }
    return '<button onclick="rjDoSocialPost(\'' + tone + '\')" style="' + baseStyle + 'background:rgba(131,58,180,.15);border:1px solid rgba(131,58,180,.3);color:#E8E8EC;" onmouseover="this.style.background=\'rgba(131,58,180,.28)\'" onmouseout="this.style.background=\'rgba(131,58,180,.15)\'">' + label + '</button>';
  }

  // Action poster avec feedback riche
  window.rjDoSocialPost = function(tone) {
    if (typeof doSocial !== 'function') return;
    if (typeof SOCIAL_LAST_WEEK !== 'undefined' && SOCIAL_LAST_WEEK === G.semaine) {
      if (typeof showToast === 'function') showToast('Tu as déjà posté cette semaine.');
      return;
    }
    if ((G.pa || 0) < 1) {
      if (typeof showToast === 'function') showToast('Pas assez de PA (1 requis).');
      return;
    }
    // Consommer 1 PA
    G.pa = Math.max(0, (G.pa || 1) - 1);
    // Appeler doSocial existant
    var prevFollowers = typeof getIgFollowers === 'function' ? getIgFollowers() : (G.igFollowers || 0);
    doSocial(tone);
    var newFollowers = typeof getIgFollowers === 'function' ? getIgFollowers() : (G.igFollowers || 0);
    var gained = newFollowers - prevFollowers;

    // Toast feedback
    var msg = gained > 0
      ? ('Post publié ! +' + (typeof fmtFollowers === 'function' ? fmtFollowers(gained) : gained) + ' abonnés')
      : 'Post publié.';
    if (typeof showToast === 'function') showToast(msg);
    if (typeof updateUI === 'function') updateUI();

    // Re-render
    setTimeout(function() {
      if (typeof renderSocialTab === 'function') renderSocialTab();
      // Remplacer les boutons par le message "déjà posté"
      var btnWrap = document.getElementById('rj-post-type-btns');
      if (btnWrap) {
        btnWrap.innerHTML = '<div style="padding:8px;text-align:center;font-size:12px;color:#A855F7;font-style:italic">Post publié cette semaine. Reviens la semaine prochaine.</div>';
      }
    }, 100);
  };

  // Générer le feed social si SOCIAL_FEED est vide quand on ouvre l'onglet
  (function _rjEnsureFeedOnLoad() {
    function doCheck() {
      if (typeof SOCIAL_FEED !== 'undefined' && SOCIAL_FEED.length === 0
          && typeof generateWeeklySocialFeed === 'function'
          && G && G.saison) {
        try { generateWeeklySocialFeed(); } catch(e) {}
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { setTimeout(doCheck, 1500); });
    } else { setTimeout(doCheck, 1500); }
  })();

  // Hook weekly pour générer le feed automatiquement chaque semaine
  if (typeof WEEKLY_TICK_HOOKS !== 'undefined') {
    var alreadyHasFeed = WEEKLY_TICK_HOOKS.some(function(h){ return h.id === 'socialFeedGen'; });
    if (!alreadyHasFeed) {
      WEEKLY_TICK_HOOKS.push({
        id: 'socialFeedGen',
        run: function() {
          if (typeof generateWeeklySocialFeed === 'function') {
            try { generateWeeklySocialFeed(); } catch(e) {}
          }
        }
      });
      console.log('[07-FIX20] Hook socialFeedGen enregistré');
    }
  }

  console.log('[07-FIX20] Réseaux sociaux patchés');
})();
