/* =====================================================================
 * 07k-migrations-sauvegarde.js — MIGRATIONS, EMPLACEMENTS ET EXTRAS DE SAUVEGARDE
 *
 * Issu de l'ancien legacy/07-user-fixes.js (« corrections demandées par
 * l'utilisateur »), rangé par domaine lors de la restructuration (T8).
 * =================================================================== */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;



  // ===========================================================================
  // MIGRATION : nettoyer les anciens mails qui contiennent du SVG/span injecté
  // ---------------------------------------------------------------------------
  // Cause : ancien FIX 14 convertissait les emojis du body en SVG inline, mais
  // _ppEscMailBody échappait les < en &lt; → SVG visible comme code source.
  // On nettoie en strippant tout span/svg/path/g balises injectées du body.
  // ===========================================================================
  function _rjMigrateMailbox() {
    try {
      if (!window.G || !Array.isArray(G.mailbox)) return;
      var cleaned = 0;
      G.mailbox.forEach(function(m) {
        if (!m || typeof m.body !== 'string') return;
        if (m.body.indexOf('<svg') < 0 && m.body.indexOf('<span style="display:inline-flex') < 0) return;
        var newBody = m.body.replace(/<span style="display:inline-flex[^"]*"[^>]*>[\s\S]*?<\/span>/g, '');
        newBody = newBody.replace(/<svg[\s\S]*?<\/svg>/g, '');
        newBody = newBody.replace(/ {2,}/g, ' ').replace(/\s+([.,!?;:])/g, '$1');
        if (newBody !== m.body) {
          m.body = newBody.trim();
          cleaned++;
        }
      });
      if (cleaned > 0) console.log('[07] Migration mailbox : ' + cleaned + ' mail(s) nettoyé(s) du SVG injecté');
    } catch (e) {
      console.warn('[07] Migration mailbox failed:', e);
    }
  }
  // Tentative initiale au chargement (si G est déjà là, ex: continuation de session)
  _rjMigrateMailbox();

  // ===========================================================================
  // MIGRATION : nettoyer les anciennes structures raceStrategy (stints[])
  // ---------------------------------------------------------------------------
  // L'ancien FIX 13 stockait { stints: [{compound, endLap}, ...], flexWindow, ... }
  // Le moteur natif utilise { tyreCompound, plannedStops, aggressionStart, ... }
  // Si une save existante a la forme stints[], on la convertit.
  // ===========================================================================
  function _rjMigrateRaceStrategy() {
    try {
      if (!window.G || !G.raceStrategy) return;
      var s = G.raceStrategy;
      if (Array.isArray(s.stints)) {
        var startCompound = (s.stints[0] && s.stints[0].compound) || 'medium';
        var stops = Math.max(0, s.stints.length - 1);
        var migrated = {
          tyreCompound: startCompound,
          plannedStops: stops,
          aggressionStart: s.aggressionStart || 5,
          aggressionEnd: s.aggressionEnd || 5,
          tyreManagement: s.tyreManagement || 5,
          weatherStance: 'ignore',
          confirmed: false
        };
        G.raceStrategy = migrated;
        console.log('[07] Migration raceStrategy : stints[] → modèle simple');
      }
    } catch (e) {
      console.warn('[07] migration raceStrategy failed:', e);
      try { delete G.raceStrategy; } catch (e2) {}
    }
  }
  // Tentative initiale au chargement
  _rjMigrateRaceStrategy();

  // ===========================================================================
  // FIX LOAD : robustesse du chargement des sauvegardes
  // ---------------------------------------------------------------------------
  // Problèmes diagnostiqués :
  //   - Bouton "Jouer" qui ne réagit pas (silence total)
  //   - Erreur silencieuse dans loadSave non visible pour l'utilisateur
  // Solution :
  //   1. Wrap loadSave avec logs explicites à chaque étape
  //   2. Re-render des slots après DOMContentLoaded au cas où l'init initial échoue
  //   3. Si renderSaveSlots existe, l'invoquer périodiquement au démarrage
  //   4. Ajouter un listener global sur clics "Jouer" en délégation
  // ===========================================================================

  // 1. Migrations à rejouer après le chargement d'une partie (bloc relu par 04s).
  window.RJ_SAVE_HOOKS.push({
    cle: "__migrations07",
    lire: function () {
      try { if (typeof _rjMigrateRaceStrategy === 'function') _rjMigrateRaceStrategy(); }
      catch (e) { console.warn('[07] migration stratégie :', e); }
      try { if (typeof _rjMigrateMailbox === 'function') _rjMigrateMailbox(); }
      catch (e) { console.warn('[07] migration messagerie :', e); }
    }
  });

  // 2. Re-render des slots après DOMContentLoaded ET 500ms plus tard pour sécurité
  (function _rjForceRenderSaveSlots() {
    function doRender() {
      try {
        if (typeof renderSaveSlots === 'function') {
          renderSaveSlots();
          console.log('[07] renderSaveSlots rappelé pour sécurité');
        }
      } catch (e) {
        console.warn('[07] renderSaveSlots échoué:', e);
      }
    }
    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
          setTimeout(doRender, 100);
          setTimeout(doRender, 800);
        });
      } else {
        setTimeout(doRender, 100);
        setTimeout(doRender, 800);
      }
    }
  })();

  // 3. Délégation de click globale sur les boutons "Jouer" dans #save-slots
  //    Au cas où les addEventListener individuels échouent
  (function _rjDelegateLoadClick() {
    if (typeof document === 'undefined') return;
    document.addEventListener('click', function(ev) {
      try {
        var btn = ev.target;
        if (!btn || btn.tagName !== 'BUTTON') return;
        if (btn.textContent !== 'Jouer') return;
        // Vérifier qu'on est dans le container save-slots
        var container = btn.closest && btn.closest('#save-slots');
        if (!container) return;
        // Trouver l'index du slot via la position du parent
        var slotDiv = btn.closest('#save-slots > div');
        if (!slotDiv) return;
        var idx = Array.prototype.indexOf.call(container.children, slotDiv);
        if (idx < 0) return;
        console.log('[07] Click "Jouer" délégué détecté pour slot', idx);
        // Si le handler natif n'a pas marché, déclencher loadSave en fallback
        // (mais seulement si le slot est non-vide — on suppose qu'un slot vide n'a pas de bouton "Jouer")
        if (typeof loadSave === 'function') {
          // Petit délai pour laisser le handler natif s'exécuter d'abord
          // Si après 50ms G._slot n'a pas changé, on déclenche manuellement
          var prevSlot = (typeof G !== 'undefined') ? G._slot : null;
          setTimeout(function() {
            try {
              if (typeof G !== 'undefined' && G._slot !== idx) {
                console.log('[07] Handler natif n\'a pas réagi, fallback loadSave(' + idx + ')');
                loadSave(idx);
              }
            } catch (e) {
              console.warn('[07] Fallback loadSave failed:', e);
            }
          }, 50);
        }
      } catch (e) {
        console.warn('[07] Click delegation failed:', e);
      }
    }, true); // capture phase to be early
    console.log('[07] Délégation de click "Jouer" installée');
  })();


  // ===========================================================================
  // FIX 17 : sauvegarde des données manquantes (state runtime jamais persisté)
  // ---------------------------------------------------------------------------
  // Bug d'origine : saveGame ne sauvegarde pas plusieurs propriétés importantes
  // qui sont pourtant accumulées tout au long du jeu :
  //   - G.sponsors : sponsors signés (revenus actifs)
  //   - G.currentTeamStaff : noms TP/ingénieurs de l'équipe
  //   - G._network : réseau de contacts pro
  //   - G._paddockContacts : contacts paddock historique
  //   - G.staff : staff personnel
  //   - G._recentDialogues : historique de dialogues (mémoire)
  //
  // Sans ces données, à chaque rechargement : sponsors perdus, staff régénéré
  // avec des noms aléatoires, réseau pro vidé, contacts paddock oubliés.
  // On les sauvegarde dans un bloc de la sauvegarde (04s) et on les relit au chargement.
  // ===========================================================================
  var _RJ_EXTRA_SAVE_KEYS = {
    sponsors: 'G.sponsors',
    currentTeamStaff: 'G.currentTeamStaff',
    _network: 'G._network',
    _paddockContacts: 'G._paddockContacts',
    staff: 'G.staff',
    _recentDialogues: 'G._recentDialogues'
  };

  // Écrits dans l'emplacement lui-même (bloc « extras ») : tout ou rien avec
  // le reste de la partie. L'ancienne clé rj_extra_slot_N est migrée par 04s.
  window.RJ_SAVE_HOOKS.push({
    cle: "extras",
    ecrire: function (G) {
      var extras = {};
      Object.keys(_RJ_EXTRA_SAVE_KEYS).forEach(function (prop) {
        if (G[prop] !== undefined) extras[prop] = G[prop];
      });
      return extras;
    },
    lire: function (extras, G) {
      if (!extras || typeof extras !== 'object') return;
      Object.keys(extras).forEach(function (prop) {
        if (extras[prop] !== undefined) G[prop] = extras[prop];
      });
    }
  });


})();
