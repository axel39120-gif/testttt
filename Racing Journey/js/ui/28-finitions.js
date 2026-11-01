/* =====================================================================
 * 28-finitions.js — LOT DE FINITIONS
 *
 * Issu de l'ancien legacy/28-corrections-interface.js, rangé par domaine (T8).
 * =================================================================== */

/* ==================================================================== *
 * Lot de finitions
 * (anciennement 28-polish-consolidated.js)
 * ==================================================================== */

(function () {
  'use strict';
  var TAG = '[19-practice-setup-popup]';
  var POPUP_ID = 'fpl-debrief';
  var PANEL_ID = 'fpl-debrief-setup';

  function fn(name) { return typeof window[name] === 'function'; }

  // Injecte le panneau de réglages dans le pop-up de débrief s'il n'y est pas.
  function injectInto(popup) {
    try {
      if (!popup || popup.querySelector('#' + PANEL_ID)) return; // déjà fait
      if (!fn('buildSetupPanel')) return;

      // Le card est le conteneur scrollable (1er élément du pop-up).
      var card = popup.querySelector('div');
      if (!card) return;

      var panel = window.buildSetupPanel();
      if (!panel) return;                 // catégorie sans réglages (rien à ajuster)
      panel.id = PANEL_ID;                // évite le conflit d'id avec le panneau de séance
      panel.style.margin = '0 16px 12px';

      // Bloc d'introduction : explique que l'on règle d'après le retour ingénieur.
      var intro = document.createElement('div');
      intro.style.cssText = 'margin:4px 16px 8px;display:flex;align-items:center;gap:8px';
      intro.innerHTML =
        '<span style="width:3px;height:13px;background:#22D3EE;border-radius:2px"></span>' +
        '<span style="font-family:var(--font-display);font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--text2)">Ajuste tes réglages</span>';

      // On insère avant la zone de boutons si on la repère, sinon en fin de card.
      var firstBtn = card.querySelector('button');
      var anchor = null;
      if (firstBtn) {
        // remonter jusqu'à l'enfant direct du card qui contient le bouton
        var node = firstBtn;
        while (node && node.parentElement !== card) node = node.parentElement;
        anchor = node;
      }
      if (anchor) {
        card.insertBefore(intro, anchor);
        card.insertBefore(panel, anchor);
      } else {
        card.appendChild(intro);
        card.appendChild(panel);
      }

      if (fn('refreshSetupValues')) { try { window.refreshSetupValues(); } catch (e) { /* no-op */ } }
    } catch (e) {
      console.warn(TAG, 'injection:', e);
    }
  }

  function scanExisting() {
    var p = document.getElementById(POPUP_ID);
    if (p) injectInto(p);
  }

  function start() {
    // Pop-up déjà présent ?
    scanExisting();
    // Observe les apparitions futures du pop-up.
    try {
      var obs = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
          var added = mutations[i].addedNodes;
          for (var j = 0; j < added.length; j++) {
            var n = added[j];
            if (n.nodeType !== 1) continue;
            if (n.id === POPUP_ID) { injectInto(n); }
            else if (n.querySelector) {
              var inner = n.querySelector('#' + POPUP_ID);
              if (inner) injectInto(inner);
            }
          }
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      window._td19Observer = obs;
    } catch (e) {
      console.warn(TAG, 'observer:', e);
    }
  }

  function boot(retries) {
    if (typeof window === 'undefined') return;
    if (document.body) {
      start();
      window.rjDebugPracticeSetupPopup = function () {
        console.log(TAG, 'buildSetupPanel:', fn('buildSetupPanel'), '| pop-up présent:', !!document.getElementById(POPUP_ID));
      };
      console.log(TAG, 'activé — réglages ajustables dans le débrief des essais. Debug: rjDebugPracticeSetupPopup()');
      return;
    }
    if (retries > 0) { setTimeout(function () { boot(retries - 1); }, 300); return; }
  }

  boot(40);
})();



// ===================================================================

// ===== Bloc intégré : 21-ux-fixes.js =====

// ===================================================================

/* =============================================================================
 * 21-ux-fixes.js — CORRECTIONS UX
 * =============================================================================
 *
 * #1 — Notifications de message intempestives
 * -------------------------------------------
 * `pushMail()` déclenche `pushHomeToast("Nouveau message", …)` à chaque mail.
 * Des mails étant générés dès la création du pilote / le choix d'agent, le
 * toast s'affiche sur des écrans où il n'a aucun sens. On masque la
 * NOTIFICATION (le mail reste créé et consultable dans la boîte) tant que le
 * joueur est sur un écran d'onboarding (S-create, S-agent).
 *
 * Option A (wrap), réversible, idempotent, try/catch.
 * ORDRE : après 03 (pushHomeToast).
 * ===========================================================================*/
(function () {
  'use strict';
  var TAG = '[21-ux-fixes]';

  // Écrans sur lesquels aucune notification ne doit apparaître.
  var SILENT_SCREENS = ['S-create', 'S-agent'];

  function activeScreenId() {
    try {
      var s = document.querySelector('.scr.on');
      return s ? s.id : '';
    } catch (e) { return ''; }
  }

  function boot(retries) {
    if (typeof window === 'undefined') return;
    if (typeof window.pushHomeToast === 'function' && !window.pushHomeToast._ux21) {
      var orig = window.pushHomeToast;
      /* Pas de notification pendant l'accueil de partie. */
      if (!Array.isArray(window.RJ_TOAST_FILTERS)) window.RJ_TOAST_FILTERS = [];
      if (!window.RJ_TOAST_FILTERS.some(function (f) { return f && f.id === "28-polish"; })) {
        window.RJ_TOAST_FILTERS.push({
          id: "28-polish",
          filtre: function () {
            if (SILENT_SCREENS.indexOf(activeScreenId()) >= 0) return false;
          }
        });
      }
      window.pushHomeToast._ux21 = true;
      console.log(TAG, 'activé — notifications masquées pendant création/agent');
      return;
    }
    if (retries > 0) { setTimeout(function () { boot(retries - 1); }, 400); return; }
    console.warn(TAG, 'abandon — pushHomeToast introuvable.');
  }

  boot(50);
})();



// ===================================================================

// ===== Bloc intégré : 23-dedup-strategie.js =====

// ===================================================================

/* =============================================================================
 * 23-dedup-strategie.js — SUPPRESSION DU DOUBLON D'ÉCRAN DE STRATÉGIE
 * =============================================================================
 * Entre la qualif et la course, deux écrans de réglages s'enchaînaient :
 *   1) l'écran de stratégie NATIF (04, renderStrategyScreen) — basique,
 *      en partie déconnecté du moteur ;
 *   2) le modal de stratégie de 04p (openStrategyModal) — complet (composé,
 *      nombre d'arrêts, style) et réellement branché au moteur (build car
 *      state, usure des pneus tour par tour). C'est aussi celui qui alimente
 *      la pastille pneu du classement et que prolonge le planner graphique.
 *
 * Ce module redirige l'écran natif vers le modal complet : où qu'on arrive
 * (après la qualif ou en cliquant l'onglet Stratégie), on ne voit plus qu'UN
 * seul écran, le bon. Aucune modification des fichiers cœur.
 *
 * Réversible : retirer la ligne <script src="js/23-dedup-strategie.js"> de
 * index.html restaure le comportement d'origine.
 * ===========================================================================*/
(function () {
  'use strict';

  var TRIES = 0, MAX = 80;

  function install() {
    TRIES++;
    var rss = window.renderStrategyScreen;
    var ui = window._RJ_STRAT_UI;

    var ready = (typeof rss === 'function') &&
                ui && typeof ui.openStrategyModal === 'function';

    if (ready) {
      if (!rss._rjDedup) {
        rjInscrire("renderStrategyScreen", { id: "28-finitions:renderStrategyScreen", ordre: -3900, remplace: function (args, suite) {
          try {
            // L'écran/onglet de stratégie natif déclenche le modal complet 04p.
            window._RJ_STRAT_UI.openStrategyModal();
            return;
          } catch (e) {
            // En cas de souci, on retombe sur l'écran natif d'origine.
            console.warn('[23] redirection stratégie échouée, fallback natif :', e);
            return suite();
          }
        } });
        window.renderStrategyScreen._rjDedup = true;
        console.log('[23] Écran stratégie natif redirigé vers le modal 04p — doublon supprimé.');
      }
      return true;
    }

    if (TRIES < MAX) { setTimeout(install, 250); }
    else { console.warn('[23] renderStrategyScreen ou _RJ_STRAT_UI introuvable — déduplication non installée.'); }
    return false;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
})();



// ===================================================================

// ===== Bloc intégré : 26-race-header-style.js =====

// ===================================================================

/* =============================================================================
 * 26-race-header-style.js — RESTYLE DU HEADER DE WEEK-END (S-race)
 * =============================================================================
 *
 * DEMANDE
 * -------
 *   1. Le sous-titre sous « Manche X » (pays • circuit) doit s'afficher en
 *      minuscules, et non en majuscules.
 *   2. Le drapeau doit : rester centré verticalement, être un peu plus petit,
 *      ne plus être dans un cadre (bordure/fond/ombre) mais « à l'air libre »,
 *      et passer à droite de l'écran.
 *
 * CAUSE RACINE
 * ------------
 * Le module 09 injecte #rj-race-header-css :
 *   - #race-sub  → text-transform:uppercase !important
 *   - #rj-race-flag-wrap → cadre 46×32 (bordure + fond --surface2 + ombre +
 *     arrondi), inséré à GAUCHE du titre.
 *
 * CORRECTION
 * ----------
 * Le .hdr de S-race est en display:flex → tout se règle en CSS, sans toucher
 * au DOM :
 *   - #race-sub  → text-transform:lowercase + tracking réduit.
 *   - #rj-race-flag-wrap → cadre supprimé, taille réduite, order:9 pour le
 *     pousser à l'extrémité droite (le bloc titre est flex:1), centré vertical.
 * Chargé APRÈS 09, donc ce <style> est plus tardif dans le <head> et l'emporte
 * (même spécificité + !important + ordre source). Réversible : supprimer ce
 * module (ou le <style id="rj-race-header-restyle">) rend le rendu d'origine.
 *
 * ARCHITECTURE : Option A — surcouche CSS non destructive, idempotente.
 * ===========================================================================*/
(function () {
  'use strict';
  var TAG = '[26-race-header-style]';
  var STYLE_ID = 'rj-race-header-restyle';

  function inject() {
    if (document.getElementById(STYLE_ID)) return true;
    if (!document.head) return false;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = [
      // 1) Sous-titre pays • circuit → minuscules, tracking adouci
      '#S-race > .hdr #race-sub{text-transform:lowercase!important;letter-spacing:.02em!important}',

      // 2) Drapeau : sorti du cadre, plus petit, centré vertical, poussé à droite
      '#S-race > .hdr #rj-race-flag-wrap{' +
        'order:9!important;' +              /* dans le flex : tout à droite */
        'align-self:center!important;' +    /* reste centré verticalement */
        'width:auto!important;height:auto!important;' + /* s'ajuste au disque réduit */
        'margin:0 2px 0 12px!important;' +  /* gap à gauche, plus de marge droite */
        'border:0!important;background:transparent!important;' +
        'box-shadow:none!important;border-radius:0!important;overflow:visible!important' +
      '}',
      '#S-race > .hdr #rj-race-flag-wrap>span{width:26px!important;height:26px!important;align-items:stretch!important}' +
      '#S-race > .hdr #rj-race-flag-wrap svg{width:100%!important;height:100%!important;display:block!important;border-radius:0!important}'
    ].join('');
    document.head.appendChild(st);
    return true;
  }

  function boot(retries) {
    if (typeof document === 'undefined') return;
    if (inject()) { console.log(TAG, 'activé — sous-titre en minuscules, drapeau à droite sans cadre.'); return; }
    if (retries > 0) { setTimeout(function () { boot(retries - 1); }, 200); return; }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { boot(30); });
  else boot(30);
})();
