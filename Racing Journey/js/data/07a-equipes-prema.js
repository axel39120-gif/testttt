/* =====================================================================
 * 07a-equipes-prema.js — ÉDITEUR DE JEU ET FUSION PREMA
 *
 * Issu de l'ancien legacy/07-user-fixes.js (« corrections demandées par
 * l'utilisateur »), rangé par domaine lors de la restructuration (T8).
 * =================================================================== */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;


  // ========================================================================
  // FIX 1 — BANDEAU ÉDITEUR DE JEU TROP HAUT (iOS PWA)
  // ========================================================================
  // Le header du #game-editor-modal a padding-top:calc(14px + safe-area-inset-top)
  // mais sur iOS PWA le titre "Éditeur en jeu" peut quand même être coupé.
  // Solution : augmenter via CSS avec une marge supplémentaire et garantir
  // que la safe-area est appliquée.
  // ========================================================================

  function injectGameEditorCSSFix() {
    if (document.getElementById('rj-user-fixes-css')) return;
    var style = document.createElement('style');
    style.id = 'rj-user-fixes-css';
    style.textContent =
      /* Header de l'éditeur en jeu : safe-area complète + marge supplémentaire */
      '#game-editor-modal > div > div:first-child {' +
      '  padding-top: calc(22px + env(safe-area-inset-top, 0px)) !important;' +
      '  padding-bottom: 14px !important;' +
      '}' +
      /* Si la modal s'ouvre dans la PWA iOS, garantir que le contenu commence sous la barre */
      '#game-editor-modal {' +
      '  padding-top: 0 !important;' +
      '}' +
      /* === FIX 7 : tableau historique carrière === */
      '.rj-career-table {' +
      '  width: 100%;' +
      '  border-collapse: collapse;' +
      '  font-size: 10.5px;' +
      '}' +
      '.rj-career-table th {' +
      '  text-align: left;' +
      '  padding: 5px 4px;' +
      '  background: var(--bg3);' +
      '  font-family: var(--font-display);' +
      '  font-size: 8.5px;' +
      '  font-weight: 800;' +
      '  color: var(--muted);' +
      '  letter-spacing: 0.08em;' +
      '  text-transform: uppercase;' +
      '  border-bottom: 1px solid var(--border);' +
      '}' +
      '.rj-career-table td {' +
      '  padding: 5px 4px;' +
      '  border-bottom: 1px solid var(--border);' +
      '  color: var(--text);' +
      '}' +
      '.rj-career-table tr:last-child td { border-bottom: none; }' +
      '.rj-career-table .rj-pos-1 { color: #FFD23F; font-weight: 800; }' +
      '.rj-career-table .rj-pos-pod { color: #34D399; font-weight: 700; }' +
      '.rj-career-table .rj-pos-top10 { color: var(--text); font-weight: 600; }' +
      '.rj-career-table .rj-pos-back { color: var(--muted); }';
    document.head.appendChild(style);
  }

  // ========================================================================
  // FIX 2 — DOUBLON PREMA POWERTEAM / PREMA RACING
  // ========================================================================
  // "Prema Powerteam" et "Prema Racing" sont la même entité (Prema sous des
  // noms différents selon les catégories). On merge tout dans "Prema Racing"
  // pour éviter la confusion dans les fiches d'équipe et palmarès.
  // ========================================================================

  function mergePremaTeams() {
    try {
      // 1. TEAM_GROUPS : "Prema Powerteam" -> retiré (doublon avec "Prema Racing":"prema")
      if (typeof window.TEAM_GROUPS === 'object' && window.TEAM_GROUPS) {
        if (window.TEAM_GROUPS['Prema Powerteam']) {
          delete window.TEAM_GROUPS['Prema Powerteam'];
        }
        // S'assurer que Prema Racing reste dans le groupe "prema"
        if (!window.TEAM_GROUPS['Prema Racing']) {
          window.TEAM_GROUPS['Prema Racing'] = 'prema';
        }
      }

      // 2. TEAM_PRINCIPAL_SEEDS : retirer le doublon
      if (typeof window.TEAM_PRINCIPAL_SEEDS === 'object' && window.TEAM_PRINCIPAL_SEEDS) {
        if (window.TEAM_PRINCIPAL_SEEDS['Prema Powerteam']) {
          // Si Prema Racing n'a pas encore le seed, le copier
          if (!window.TEAM_PRINCIPAL_SEEDS['Prema Racing']) {
            window.TEAM_PRINCIPAL_SEEDS['Prema Racing'] = window.TEAM_PRINCIPAL_SEEDS['Prema Powerteam'];
          }
          delete window.TEAM_PRINCIPAL_SEEDS['Prema Powerteam'];
        }
      }

      // 3. HISTORIC_TITLES : merger les titres F4 de "Prema Powerteam" dans "Prema Racing"
      if (typeof window.HISTORIC_TITLES === 'object' && window.HISTORIC_TITLES) {
        var pp = window.HISTORIC_TITLES['Prema Powerteam'];
        if (pp) {
          if (!window.HISTORIC_TITLES['Prema Racing']) {
            window.HISTORIC_TITLES['Prema Racing'] = {};
          }
          var pr = window.HISTORIC_TITLES['Prema Racing'];
          // Pour chaque catégorie de Prema Powerteam, ajouter dans Prema Racing
          Object.keys(pp).forEach(function(cat) {
            if (!pr[cat]) {
              pr[cat] = { constructors: 0, drivers: 0 };
            }
            pr[cat].constructors = (pr[cat].constructors || 0) + (pp[cat].constructors || 0);
            pr[cat].drivers = (pr[cat].drivers || 0) + (pp[cat].drivers || 0);
          });
          delete window.HISTORIC_TITLES['Prema Powerteam'];
        }
      }

      // 4. Si TEAMS_BY_CAT contient une référence "Prema Powerteam", la remplacer
      if (typeof window.TEAMS_BY_CAT === 'object' && window.TEAMS_BY_CAT) {
        Object.keys(window.TEAMS_BY_CAT).forEach(function(cat) {
          var arr = window.TEAMS_BY_CAT[cat];
          if (Array.isArray(arr)) {
            for (var i = 0; i < arr.length; i++) {
              if (arr[i] === 'Prema Powerteam') {
                // Si Prema Racing est déjà dans la liste, on retire le doublon
                if (arr.indexOf('Prema Racing') >= 0) {
                  arr.splice(i, 1);
                  i--;
                } else {
                  arr[i] = 'Prema Racing';
                }
              }
            }
          }
        });
      }

      // 5. TEAM_OFFERS : remplacer "Prema Powerteam" par "Prema Racing"
      if (typeof window.TEAM_OFFERS === 'object' && window.TEAM_OFFERS) {
        Object.keys(window.TEAM_OFFERS).forEach(function(cat) {
          var arr = window.TEAM_OFFERS[cat];
          if (!Array.isArray(arr)) return;
          var hasRacing = arr.some(function(o) { return o.team === 'Prema Racing'; });
          for (var i = 0; i < arr.length; i++) {
            if (arr[i].team === 'Prema Powerteam') {
              if (hasRacing) {
                arr.splice(i, 1);
                i--;
              } else {
                arr[i].team = 'Prema Racing';
                hasRacing = true;
              }
            }
          }
        });
      }

      // 6. Migrer le pilote courant si dans Prema Powerteam
      if (typeof window.G === 'object' && window.G) {
        if (window.G.currentTeam === 'Prema Powerteam') window.G.currentTeam = 'Prema Racing';
        if (window.G._seasonTeam === 'Prema Powerteam') window.G._seasonTeam = 'Prema Racing';
        // Migrer aussi les rivaux
        if (Array.isArray(window.G.rivals)) {
          window.G.rivals.forEach(function(r) {
            if (r && r.team === 'Prema Powerteam') r.team = 'Prema Racing';
          });
        }
      }

      console.log('[07] Prema Powerteam merged into Prema Racing');
    } catch (e) {
      console.warn('[07] mergePremaTeams error:', e);
    }
  }

  var _premaWatchInterval = setInterval(function() {
    try {
      if (window.HISTORIC_TITLES && window.HISTORIC_TITLES['Prema Powerteam']) {
        mergePremaTeams();
      }
      if (window.TEAM_GROUPS && window.TEAM_GROUPS['Prema Powerteam']) {
        mergePremaTeams();
      }
    } catch (e) {}
  }, 5000);

  function appliquer() {
    try { injectGameEditorCSSFix(); } catch (e) { console.warn('[07] injectGameEditorCSSFix();', e); }
    try { mergePremaTeams(); } catch (e) { console.warn('[07] mergePremaTeams();', e); }
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
