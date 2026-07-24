/* =============================================================================
 * 07 — USER FIXES (corrections demandées par l'utilisateur)
 * =============================================================================
 *
 * OBJECTIF
 * --------
 * Module de corrections d'expérience qui regroupe 7 fixes UX demandés
 * sans toucher aux fichiers source. Wraps de fonctions + injection CSS.
 *
 * CORRECTIONS APPLIQUÉES :
 *   1. Bandeau éditeur de jeu : padding-top augmenté (safe-area iOS PWA)
 *   2. Doublon Prema Powerteam / Prema Racing : merge en Prema Racing
 *   4. "Demander à l'ingénieur" dans Équilibre voiture : verif/amélioration
 *   5. (déjà OK dans cette version) Stratégie supprimée d'Équilibre voiture
 *   6. (déjà OK) Page Stratégie de course : couleurs pneus + tuiles carrées
 *   7. Historique carrière complet sur fiche pilote (joueur + rivaux)
 *   8. Notifications menu accueil : agent OFF, sponsors+contrats ON
 *   9. Vie perso : sous-titres "Parents"/"Amis proches"/"Coach personnel" masqués
 *  10. Refonte esthétique complète de la page pré-saison (DA F1)
 *  11. Réglages voiture : panneau de jauges de comportement temps réel
 *      (rotation, stabilité, traction, agressivité, pneus, vitesse)
 *      + diagnostic ingénieur dynamique sur setups extrêmes
 *
 * ORDRE DE CHARGEMENT :
 *   - APRÈS 03-data-agent.js (TEAM_GROUPS, TEAM_PRINCIPAL_SEEDS, HISTORIC_TITLES)
 *   - APRÈS 04-race-engine.js (renderStrategyScreen, askEngineerHint)
 *   - APRÈS 05-progression.js
 *   - APRÈS 06-screens.js (showDriverProfileModal, renderSponsorsNew)
 *   - Place : tout à la fin des scripts
 *
 * COMPATIBILITÉ :
 *   - Aucune modification de gameplay
 *   - Tous les wraps préservent les fonctions originales
 * ===========================================================================*/

(function() {
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
    window.askEngineerHint = function rjAskEngineerHintEnhanced() {
      // Snapshot avant
      var before = null;
      try {
        if (window.G && window.G.setupAdv) {
          before = JSON.parse(JSON.stringify(window.G.setupAdv));
        }
      } catch (e) {}

      var result;
      try {
        result = orig.apply(this, arguments);
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
    };
    window.askEngineerHint._rjUserFixEnhanced = true;
    console.log('[07] askEngineerHint enhanced (visible cursor moves + highlights)');
    return true;
  }

  // ========================================================================
  // FIX 7 — HISTORIQUE CARRIÈRE COMPLET SUR FICHE PILOTE
  // ========================================================================
  // showDriverProfileModal affiche actuellement les 3 dernières saisons
  // (joueur uniquement). On wrap pour ajouter un tableau complet de toutes
  // les saisons jouées (joueur via CAREER_HISTORY, rival via rival.careerHistory).
  // ========================================================================

  function _safeEsc(s) {
    if (typeof window._ppEscSafe === 'function') return window._ppEscSafe(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _gameYearForSaison(saison) {
    try {
      var startY = (window.G && window.G.pilot && window.G.pilot.startYear) || 2024;
      return startY + ((saison || 1) - 1);
    } catch (e) { return saison || 1; }
  }

  function _catShort(cat) {
    if (!cat) return '—';
    return String(cat)
      .replace('Formule ', 'F')
      .replace('Formula Regional', 'FR')
      .replace('Karting Junior', 'KJ')
      .replace('Karting Senior', 'KS')
      .replace('Super Formula', 'SF')
      .replace('Endurance WEC', 'WEC')
      .replace('IndyCar', 'Indy');
  }

  function _posClass(pos) {
    if (pos === 1) return 'rj-pos-1';
    if (pos && pos <= 3) return 'rj-pos-pod';
    if (pos && pos <= 10) return 'rj-pos-top10';
    return 'rj-pos-back';
  }

  function _buildCareerTableForPlayer() {
    try {
      var hist = (typeof window.CAREER_HISTORY !== 'undefined' && window.CAREER_HISTORY) || [];
      // Construire les saisons : passées (CAREER_HISTORY) + courante si pas déjà dedans
      var rows = hist.slice(); // copie
      // Ajouter saison courante si manquante (live data)
      try {
        var curSaison = (window.G && window.G.saison) || 1;
        var curCat = (window.G && window.G.cat) || '';
        var alreadyIn = rows.some(function(r) { return r.saison === curSaison && r.cat === curCat; });
        if (!alreadyIn && window.G) {
          var curRaces = (window.G.races || []).length;
          if (curRaces > 0) {
            // Calculer position courante
            var curPos = 0;
            try {
              var allDrivers = [{
                name: (window.G.pilot && window.G.pilot.nom) || 'Pilote',
                pts: window.G.champPts || 0,
                me: true
              }].concat((window.G.rivals || []).map(function(r) {
                return { name: r.name, pts: r.pts || 0, me: false };
              }));
              allDrivers.sort(function(a, b) { return b.pts - a.pts; });
              curPos = allDrivers.findIndex(function(d) { return d.me; }) + 1;
            } catch (e) {}
            // Stats course courantes
            var curWins = 0, curPods = 0, curPoles = 0;
            (window.G.races || []).forEach(function(r) {
              if (r.pos === 1) curWins++;
              if (r.pos && r.pos <= 3) curPods++;
              if (r.pole) curPoles++;
            });
            rows.push({
              saison: curSaison,
              cat: curCat,
              pos: curPos,
              pts: window.G.champPts || 0,
              races: curRaces,
              wins: curWins,
              pods: curPods,
              poles: curPoles,
              team: window.G.currentTeam || 'Indépendant',
              _live: true
            });
          }
        }
      } catch (e) {}

      if (rows.length === 0) return '';

      // Tri chronologique (plus ancien en haut)
      rows.sort(function(a, b) { return (a.saison || 0) - (b.saison || 0); });

      var html = '<div style="padding:9px 12px;border-bottom:1px solid var(--border)">';
      html += '<div style="font-family:var(--font-display);font-size:8.5px;font-weight:800;' +
              'color:var(--muted);letter-spacing:.14em;text-transform:uppercase;margin-bottom:6px">' +
              'Historique de carrière' +
              '</div>';
      html += '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch">';
      html += '<table class="rj-career-table">';
      html += '<thead><tr>' +
              '<th>Année</th>' +
              '<th>Cat.</th>' +
              '<th>Écurie</th>' +
              '<th style="text-align:center">Pos</th>' +
              '<th style="text-align:center">C</th>' +
              '<th style="text-align:center">V</th>' +
              '<th style="text-align:center">P</th>' +
              '<th style="text-align:center">Pts</th>' +
              '</tr></thead><tbody>';
      rows.forEach(function(s) {
        var year = _gameYearForSaison(s.saison);
        var pos = s.pos || 0;
        var posClass = _posClass(pos);
        var posTxt = pos > 0 ? 'P' + pos : '—';
        var liveBadge = s._live ?
          ' <span style="font-size:8px;color:#34D399;font-weight:700">●</span>' : '';
        html += '<tr>' +
                '<td style="font-weight:600">' + year + liveBadge + '</td>' +
                '<td style="color:var(--text2)">' + _safeEsc(_catShort(s.cat)) + '</td>' +
                '<td style="color:var(--text2);max-width:90px;overflow:hidden;' +
                'text-overflow:ellipsis;white-space:nowrap">' +
                _safeEsc(s.team || '—') + '</td>' +
                '<td class="' + posClass + '" style="text-align:center">' + posTxt + '</td>' +
                '<td style="text-align:center;color:var(--text2)">' + (s.races || 0) + '</td>' +
                '<td style="text-align:center;color:#FFD23F">' + (s.wins || 0) + '</td>' +
                '<td style="text-align:center;color:#34D399">' + (s.pods || 0) + '</td>' +
                '<td style="text-align:center;font-weight:700">' + (s.pts || 0) + '</td>' +
                '</tr>';
      });
      html += '</tbody></table></div></div>';
      return html;
    } catch (e) {
      console.warn('[07] _buildCareerTableForPlayer error:', e);
      return '';
    }
  }

  function _buildCareerTableForRival(rival) {
    try {
      if (!rival) return '';
      var hist = (rival.careerHistory && Array.isArray(rival.careerHistory))
        ? rival.careerHistory.slice() : [];

      // Ajouter la saison courante si pas déjà dedans
      try {
        var curSaison = (window.G && window.G.saison) || 1;
        var curCat = (window.G && window.G.cat) || '';
        var alreadyIn = hist.some(function(r) { return r.saison === curSaison && r.cat === curCat; });
        if (!alreadyIn && (rival.pts != null || rival.lastPos != null)) {
          // Position championnat actuel : recalculer via tri
          var curPos = 0;
          try {
            var allDrivers = [{
              name: (window.G.pilot && window.G.pilot.nom) || 'Pilote',
              pts: window.G.champPts || 0
            }].concat((window.G.rivals || []).map(function(r) {
              return { name: r.name, pts: r.pts || 0 };
            }));
            allDrivers.sort(function(a, b) { return b.pts - a.pts; });
            curPos = allDrivers.findIndex(function(d) { return d.name === rival.name; }) + 1;
          } catch (e) {}
          // Stats course rivalw — depuis getRivalRaceStats si dispo
          var rivalStats = null;
          try {
            if (typeof window.getRivalRaceStats === 'function') {
              var idx = (window.G.rivals || []).indexOf(rival);
              if (idx >= 0) rivalStats = window.getRivalRaceStats(idx);
            }
          } catch (e) {}
          hist.push({
            saison: curSaison,
            cat: curCat,
            team: rival.team || '—',
            pos: curPos,
            pts: rival.pts || 0,
            races: rivalStats ? rivalStats.races : 0,
            wins: rivalStats ? rivalStats.wins : 0,
            pods: rivalStats ? rivalStats.podiums : 0,
            poles: rivalStats ? rivalStats.poles : 0,
            _live: true
          });
        }
      } catch (e) {}

      if (hist.length === 0) {
        // Pas d'historique : afficher juste un message court
        return '<div style="padding:9px 12px;border-bottom:1px solid var(--border)">' +
               '<div style="font-family:var(--font-display);font-size:8.5px;font-weight:800;' +
               'color:var(--muted);letter-spacing:.14em;text-transform:uppercase;margin-bottom:6px">' +
               'Historique de carrière' +
               '</div>' +
               '<div style="font-size:11px;color:var(--text3);text-align:center;padding:8px 0">' +
               'Pas encore d\'historique pour ce pilote' +
               '</div></div>';
      }

      // Tri chronologique
      hist.sort(function(a, b) { return (a.saison || 0) - (b.saison || 0); });

      var html = '<div style="padding:9px 12px;border-bottom:1px solid var(--border)">';
      html += '<div style="font-family:var(--font-display);font-size:8.5px;font-weight:800;' +
              'color:var(--muted);letter-spacing:.14em;text-transform:uppercase;margin-bottom:6px">' +
              'Historique de carrière' +
              '</div>';
      html += '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch">';
      html += '<table class="rj-career-table">';
      html += '<thead><tr>' +
              '<th>Année</th>' +
              '<th>Cat.</th>' +
              '<th>Écurie</th>' +
              '<th style="text-align:center">Pos</th>' +
              '<th style="text-align:center">C</th>' +
              '<th style="text-align:center">V</th>' +
              '<th style="text-align:center">P</th>' +
              '<th style="text-align:center">Pts</th>' +
              '</tr></thead><tbody>';
      hist.forEach(function(s) {
        var year = _gameYearForSaison(s.saison);
        var pos = s.pos || 0;
        var posClass = _posClass(pos);
        var posTxt = pos > 0 ? 'P' + pos : '—';
        var liveBadge = s._live ?
          ' <span style="font-size:8px;color:#34D399;font-weight:700">●</span>' : '';
        html += '<tr>' +
                '<td style="font-weight:600">' + year + liveBadge + '</td>' +
                '<td style="color:var(--text2)">' + _safeEsc(_catShort(s.cat)) + '</td>' +
                '<td style="color:var(--text2);max-width:90px;overflow:hidden;' +
                'text-overflow:ellipsis;white-space:nowrap">' +
                _safeEsc(s.team || '—') + '</td>' +
                '<td class="' + posClass + '" style="text-align:center">' + posTxt + '</td>' +
                '<td style="text-align:center;color:var(--text2)">' + (s.races || 0) + '</td>' +
                '<td style="text-align:center;color:#FFD23F">' + (s.wins || 0) + '</td>' +
                '<td style="text-align:center;color:#34D399">' + (s.pods || 0) + '</td>' +
                '<td style="text-align:center;font-weight:700">' + (s.pts || 0) + '</td>' +
                '</tr>';
      });
      html += '</tbody></table></div></div>';
      return html;
    } catch (e) {
      console.warn('[07] _buildCareerTableForRival error:', e);
      return '';
    }
  }

  function wrapShowDriverProfileModal() {
    if (typeof window.showDriverProfileModal !== 'function') return false;
    if (window.showDriverProfileModal._rjUserFixCareer) return true;

    var orig = window.showDriverProfileModal;
    window.showDriverProfileModal = function rjShowDriverProfileModalEnhanced(opts) {
      var result = orig.apply(this, arguments);

      // Après l'ouverture, on injecte le tableau d'historique dans la modal
      try {
        if (!opts) return result;
        var modal = document.getElementById('driver-profile-modal');
        if (!modal) return result;
        // Le contenu interne : on cherche le wrapper de la fiche
        var inner = modal.firstElementChild;
        if (!inner) return result;

        var careerHtml = '';
        if (opts.type === 'player') {
          careerHtml = _buildCareerTableForPlayer();
        } else {
          // Trouver le rival
          var rival = null;
          if (typeof opts.idx === 'number') {
            rival = window.G && window.G.rivals ? window.G.rivals[opts.idx] : null;
          } else if (opts.name && window.G && window.G.rivals) {
            rival = window.G.rivals.find(function(r) { return r.name === opts.name; });
          }
          careerHtml = _buildCareerTableForRival(rival);
        }

        if (!careerHtml) return result;

        // Pour le joueur, le code original affiche déjà "Carrière (3 dernières)".
        // On veut REMPLACER cette section par notre tableau complet.
        // On cherche le bloc qui contient "Carrière (3 dernières)" et on le retire.
        if (opts.type === 'player') {
          var divs = inner.querySelectorAll('div');
          for (var i = 0; i < divs.length; i++) {
            var d = divs[i];
            // Chercher la signature texte
            if (d.textContent && d.textContent.indexOf('Carrière (3 dernières)') >= 0) {
              // Le parent direct contient la liste — on monte jusqu'au padding wrapper
              // qui a "padding:9px 12px"
              var par = d;
              while (par && par !== inner) {
                if (par.style && par.style.padding && par.style.padding.indexOf('9px 12px') >= 0) {
                  break;
                }
                par = par.parentElement;
              }
              if (par && par !== inner) {
                par.parentElement.removeChild(par);
                break;
              }
            }
          }
        }

        // Insérer le nouveau tableau juste avant le dernier wrapper (le closing div),
        // c-à-d à la fin du contenu de la fiche
        var wrapper = document.createElement('div');
        wrapper.innerHTML = careerHtml;
        var careerNode = wrapper.firstElementChild;
        if (careerNode) {
          inner.appendChild(careerNode);
        }
      } catch (e) {
        console.warn('[07] showDriverProfileModal enhance error:', e);
      }

      return result;
    };
    window.showDriverProfileModal._rjUserFixCareer = true;
    console.log('[07] showDriverProfileModal enhanced (full career history)');
    return true;
  }

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
    if (typeof window.updateHomeBadges !== 'function') return false;
    if (window.updateHomeBadges._rjUserFixBadges) return true;

    var orig = window.updateHomeBadges;
    window.updateHomeBadges = function rjUpdateHomeBadgesUserFix() {
      var r;
      try { r = orig.apply(this, arguments); }
      catch (e) { console.warn('[07] updateHomeBadges orig:', e); }
      // Override : nos règles l'emportent (passe après l'original)
      applyHomeBadges();
      return r;
    };
    window.updateHomeBadges._rjUserFixBadges = true;
    console.log('[07] updateHomeBadges wrapped (agent off, sponsors+contrats on)');
    return true;
  }

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
    window.renderVieperso = function rjRenderViepersoNoSub() {
      var r;
      try { r = orig.apply(this, arguments); }
      catch (e) { console.warn('[07] renderVieperso orig:', e); }
      // Après le rendu : masque les sous-titres
      _hideRelationSubtitles();
      // Re-tentative async au cas où le DOM est mis à jour de manière différée
      setTimeout(_hideRelationSubtitles, 50);
      return r;
    };
    window.renderVieperso._rjUserFixNoSub = true;
    console.log('[07] renderVieperso wrapped (hide Parents/Amis/Coach sub-titles)');
    return true;
  }

  // ========================================================================
  // FIX 10 — REFONTE ESTHÉTIQUE PAGE PRÉ-SAISON
  // ========================================================================
  // Demande utilisateur : retravailler totalement l'esthétique de la page
  // pré-saison pour coller à la DA F1 du jeu.
  //
  // DA cible (cf. styles.css) :
  //   - Couleurs : noir profond (#000/--bg), accent rouge --red2 (#FF1801),
  //     or --gold (#FFC107), cyan --teal (#00D4FF), font Rubik display
  //   - Système card : .f1-card, .f1-section, .f1-tag, .f1-metric, .f1-pos
  //   - Pattern visuel : barre rouge décorative gauche, gradient sombre,
  //     glow rouge radial, headers uppercase letter-spacing display
  //
  // Stratégie : remplacement complet de renderPreseasonPlanning par un
  // nouveau rendu, en gardant les IDs et helpers (_psPickObj, _psAdjustBudget,
  // _psPickAngle, _psValidate, _psUpdateTotal). Helpers wrappés pour
  // s'adapter à la nouvelle structure DOM.
  // ========================================================================

  var _PS_OBJ_ICONS = {
    titre: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 010-5H6M18 9h1.5a2.5 2.5 0 000-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21-1.15.53-2.03 1.55-2.03 2.79h10c0-1.24-.88-2.26-2.03-2.79-.5-.23-.97-.66-.97-1.21V14.66M18 2v6.36C18 11.32 15.31 14 12 14s-6-2.68-6-5.64V2"/></svg>',
    victoires: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 21 6 12 16 3 6"/><line x1="3" y1="6" x2="3" y2="20"/><line x1="21" y1="6" x2="21" y2="20"/><line x1="12" y1="16" x2="12" y2="20"/></svg>',
    podium: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="6" width="6" height="14"/><rect x="2" y="11" width="7" height="9"/><rect x="15" y="9" width="7" height="11"/></svg>',
    constance: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>'
  };

  var _PS_BUDGET_ICONS = {
    sim: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    coach: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5h11l-1.5 7h-8z"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>',
    lifestyle: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>',
    savings: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>'
  };

  var _PS_ANGLE_ICONS = {
    humble: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    provocateur: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    technique: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    mysterieux: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>'
  };

  function _psBudgetMeta() {
    return [
      { k: 'sim',       label: 'Simulateur', desc: 'Performance en course, fatigue réduite', color: '#00D4FF', icon: _PS_BUDGET_ICONS.sim },
      { k: 'coach',     label: 'Entraîneur', desc: 'Progression accélérée des sub-stats',    color: '#FFB300', icon: _PS_BUDGET_ICONS.coach },
      { k: 'lifestyle', label: 'Lifestyle',  desc: 'Bonheur passif toute la saison',         color: '#EC4899', icon: _PS_BUDGET_ICONS.lifestyle },
      { k: 'savings',   label: 'Épargne',    desc: '+5 % de revenus sur la saison',          color: '#00E676', icon: _PS_BUDGET_ICONS.savings }
    ];
  }

  function _psSafe(s) {
    if (typeof window._ppEscSafe === 'function') return window._ppEscSafe(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _renderPreseasonNew() {
    var container = document.getElementById('preseason-content');
    if (!container) return;
    if (typeof window.PRESEASON_OBJECTIVES === 'undefined' ||
        typeof window.PRESEASON_ANGLES === 'undefined' ||
        typeof window.getPreseason !== 'function') return;

    var t = window.getPreseason();
    var curObj = (t && t.configured) ? t.objective : 'podium';
    var curBudget = (t && t.configured) ? t.budget : { sim: 25, coach: 25, lifestyle: 25, savings: 25 };
    var curAngle = (t && t.configured) ? t.angle : 'humble';
    window._presObjective = curObj;
    window._presBudget = Object.assign({}, curBudget);
    window._presAngle = curAngle;

    var saison = (window.G && window.G.saison) || 1;
    var startY = (window.G && window.G.pilot && window.G.pilot.startYear) || 2024;
    var year = startY + (saison - 1);
    var cat = (window.G && window.G.cat) || '';
    var team = (window.G && window.G.currentTeam) || 'Indépendant';

    var html = '';

    // ========== HERO ==========
    html += '<div class="rj-ps-hero">';
    html += '  <div class="rj-ps-hero-bg"></div>';
    html += '  <div class="rj-ps-hero-strip"></div>';
    html += '  <div class="rj-ps-hero-grid">';
    html += '    <div class="rj-ps-hero-icon">';
    html += '      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>';
    html += '    </div>';
    html += '    <div class="rj-ps-hero-stack">';
    html += '      <div class="rj-ps-hero-kicker">Saison ' + saison + ' · ' + year + '</div>';
    html += '      <div class="rj-ps-hero-title">Plan de saison</div>';
    html += '      <div class="rj-ps-hero-sub">' + _psSafe(cat) + (team !== 'Indépendant' ? ' · ' + _psSafe(team) : '') + '</div>';
    html += '    </div>';
    html += '  </div>';
    html += '  <div class="rj-ps-hero-tagline">Définis ton approche. Tes choix colorent toute l\'année et débloquent un bonus si tu tiens ton objectif.</div>';
    html += '</div>';

    // ========== OBJECTIF ==========
    html += '<div class="rj-ps-section"><span>Objectif personnel</span></div>';
    html += '<div class="rj-ps-obj-grid">';
    Object.keys(window.PRESEASON_OBJECTIVES).forEach(function(k) {
      var o = window.PRESEASON_OBJECTIVES[k];
      var sel = curObj === k;
      var icon = _PS_OBJ_ICONS[k] || _PS_OBJ_ICONS.podium;
      html += '<div id="ps-obj-' + k + '" class="rj-ps-obj-card' + (sel ? ' on' : '') +
              '" onclick="_psPickObj(\'' + k + '\')" style="--c:' + o.color + '">';
      html += '  <div class="rj-ps-obj-ico">' + icon + '</div>';
      html += '  <div class="rj-ps-obj-body">';
      html += '    <div class="rj-ps-obj-label">' + _psSafe(o.label) + '</div>';
      html += '    <div class="rj-ps-obj-desc">' + _psSafe(o.desc) + '</div>';
      html += '  </div>';
      html += '  <div class="rj-ps-obj-check">';
      html += '    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      html += '  </div>';
      html += '</div>';
    });
    html += '</div>';

    // ========== BUDGET ==========
    html += '<div class="rj-ps-section"><span>Allocation des ressources</span></div>';
    html += '<div class="rj-ps-budget-card">';
    html += '  <div class="rj-ps-budget-hint">Atteins 40 %+ sur un poste pour débloquer un bonus passif toute la saison.</div>';
    html += '  <div class="rj-ps-sliders">';
    _psBudgetMeta().forEach(function(b) {
      var v = curBudget[b.k] || 0;
      html += '<div class="rj-ps-slider-row" style="--c:' + b.color + '">';
      html += '  <div class="rj-ps-slider-head">';
      html += '    <div class="rj-ps-slider-ico">' + b.icon + '</div>';
      html += '    <div class="rj-ps-slider-info">';
      html += '      <div class="rj-ps-slider-label">' + b.label + '</div>';
      html += '      <div class="rj-ps-slider-desc">' + b.desc + '</div>';
      html += '    </div>';
      html += '    <div class="rj-ps-slider-val" id="ps-val-' + b.k + '">' + v + '<span>%</span></div>';
      html += '  </div>';
      html += '  <input type="range" id="ps-range-' + b.k + '" min="0" max="100" step="5" value="' + v +
              '" oninput="_psAdjustBudget(\'' + b.k + '\',this.value)" class="rj-ps-range">';
      html += '</div>';
    });
    html += '  </div>';
    html += '  <div class="rj-ps-total-bar">';
    html += '    <div class="rj-ps-total-lbl">Total alloué</div>';
    html += '    <div class="rj-ps-total-val" id="ps-total">100<span>%</span></div>';
    html += '  </div>';
    html += '</div>';

    // ========== ANGLE MÉDIA ==========
    html += '<div class="rj-ps-section"><span>Angle média</span></div>';
    html += '<div class="rj-ps-angle-grid">';
    Object.keys(window.PRESEASON_ANGLES).forEach(function(k) {
      var a = window.PRESEASON_ANGLES[k];
      var sel = curAngle === k;
      var icon = _PS_ANGLE_ICONS[k] || _PS_ANGLE_ICONS.humble;
      var repTags = '';
      Object.keys(a.rep || {}).forEach(function(rk) {
        var v = a.rep[rk];
        var tagCls = v > 0 ? 'pos' : 'neg';
        var sign = v > 0 ? '+' : '';
        repTags += '<span class="rj-ps-angle-tag ' + tagCls + '">' + sign + v + ' ' + rk + '</span>';
      });
      html += '<div id="ps-ang-' + k + '" class="rj-ps-angle-card' + (sel ? ' on' : '') +
              '" onclick="_psPickAngle(\'' + k + '\')" style="--c:' + a.color + '">';
      html += '  <div class="rj-ps-angle-head">';
      html += '    <div class="rj-ps-angle-ico">' + icon + '</div>';
      html += '    <div class="rj-ps-angle-label">' + _psSafe(a.label) + '</div>';
      html += '  </div>';
      html += '  <div class="rj-ps-angle-desc">' + _psSafe(a.desc) + '</div>';
      html += '  <div class="rj-ps-angle-tags">' + repTags + '</div>';
      html += '</div>';
    });
    html += '</div>';

    // ========== CTA ==========
    html += '<div class="rj-ps-cta-wrap">';
    html += '  <button id="ps-validate-btn" class="rj-ps-cta" onclick="_psValidate()">';
    html += '    <span class="rj-ps-cta-label">Valider mon plan</span>';
    html += '    <span class="rj-ps-cta-arrow">';
    html += '      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
    html += '    </span>';
    html += '  </button>';
    html += '</div>';

    container.innerHTML = html;

    if (typeof window._psUpdateTotal === 'function') window._psUpdateTotal();
  }

  function _injectPreseasonCSS() {
    if (document.getElementById('rj-ps-redesign-css')) return;
    var css = '' +
    '.rj-ps-hero{position:relative;margin:14px 14px 4px;padding:18px 16px 16px;border-radius:14px;' +
    'background:linear-gradient(180deg,rgba(255,24,1,0.10) 0%,var(--bg3) 60%,var(--bg2) 100%);' +
    'border:1px solid var(--border-hi);overflow:hidden}' +
    '.rj-ps-hero-bg{position:absolute;top:0;left:0;right:0;height:160px;' +
    'background:radial-gradient(ellipse at 50% -20%,rgba(255,24,1,0.30) 0%,transparent 60%),' +
    'radial-gradient(ellipse at 100% 50%,rgba(0,212,255,0.06) 0%,transparent 50%);' +
    'pointer-events:none;z-index:0}' +
    '.rj-ps-hero-strip{position:absolute;top:0;left:0;right:0;height:2px;' +
    'background:linear-gradient(90deg,transparent 0%,var(--red2) 25%,var(--red3) 50%,var(--red2) 75%,transparent 100%);' +
    'opacity:.85}' +
    '.rj-ps-hero-grid{position:relative;z-index:1;display:flex;align-items:center;gap:14px;margin-bottom:12px}' +
    '.rj-ps-hero-icon{flex-shrink:0;width:52px;height:52px;border-radius:12px;' +
    'background:linear-gradient(135deg,rgba(255,24,1,0.20) 0%,rgba(255,24,1,0.05) 100%);' +
    'border:1px solid rgba(255,24,1,0.40);' +
    'display:flex;align-items:center;justify-content:center;color:var(--red3);' +
    'box-shadow:0 4px 14px rgba(255,24,1,0.18)}' +
    '.rj-ps-hero-stack{flex:1;min-width:0}' +
    '.rj-ps-hero-kicker{font-family:var(--font-display);font-size:10px;font-weight:800;' +
    'color:var(--red3);letter-spacing:.20em;text-transform:uppercase;margin-bottom:2px}' +
    '.rj-ps-hero-title{font-family:var(--font-display);font-size:24px;font-weight:900;' +
    'color:var(--white);letter-spacing:.02em;text-transform:uppercase;line-height:1;margin-bottom:4px}' +
    '.rj-ps-hero-sub{font-size:12px;color:var(--soft);font-weight:600}' +
    '.rj-ps-hero-tagline{position:relative;z-index:1;font-size:12.5px;color:var(--text2);' +
    'line-height:1.5;padding-top:10px;border-top:1px solid var(--border)}' +

    '.rj-ps-section{font-family:var(--font-display);font-size:10px;font-weight:800;' +
    'color:var(--red3);letter-spacing:.20em;text-transform:uppercase;' +
    'padding:18px 16px 8px;display:flex;align-items:center;gap:10px}' +
    '.rj-ps-section::before{content:"";width:3px;height:14px;background:var(--red2);flex-shrink:0;border-radius:1px}' +
    '.rj-ps-section span{flex-shrink:0}' +
    '.rj-ps-section::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,var(--line2),transparent)}' +

    '.rj-ps-obj-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 14px}' +
    '.rj-ps-obj-card{position:relative;display:flex;flex-direction:column;gap:8px;' +
    'padding:14px 12px 12px;border-radius:12px;cursor:pointer;-webkit-tap-highlight-color:transparent;' +
    'background:linear-gradient(180deg,var(--bg3) 0%,var(--bg2) 100%);' +
    'border:1px solid var(--border-hi);border-left:3px solid rgba(255,255,255,0.06);' +
    'transition:border-color .15s ease,transform .12s ease,background .15s ease;overflow:hidden}' +
    '.rj-ps-obj-card::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;' +
    'background:radial-gradient(ellipse at top right,color-mix(in srgb,var(--c) 12%,transparent) 0%,transparent 60%);' +
    'opacity:0;transition:opacity .2s ease}' +
    '.rj-ps-obj-card.on{border-color:var(--c);border-left-color:var(--c);' +
    'box-shadow:0 0 0 1px var(--c) inset,0 6px 18px color-mix(in srgb,var(--c) 22%,transparent)}' +
    '.rj-ps-obj-card.on::before{opacity:1}' +
    '.rj-ps-obj-card:active{transform:scale(.98)}' +
    '.rj-ps-obj-ico{position:relative;z-index:1;width:36px;height:36px;border-radius:8px;' +
    'background:color-mix(in srgb,var(--c) 14%,transparent);border:1px solid color-mix(in srgb,var(--c) 32%,transparent);' +
    'color:var(--c);display:flex;align-items:center;justify-content:center}' +
    '.rj-ps-obj-card.on .rj-ps-obj-ico{background:color-mix(in srgb,var(--c) 24%,transparent);' +
    'border-color:var(--c)}' +
    '.rj-ps-obj-body{position:relative;z-index:1}' +
    '.rj-ps-obj-label{font-family:var(--font-display);font-size:13px;font-weight:800;' +
    'color:var(--text);letter-spacing:.02em;line-height:1.15;margin-bottom:3px}' +
    '.rj-ps-obj-card.on .rj-ps-obj-label{color:var(--c)}' +
    '.rj-ps-obj-desc{font-size:11px;color:var(--text3);line-height:1.35}' +
    '.rj-ps-obj-check{position:absolute;top:10px;right:10px;z-index:1;' +
    'width:20px;height:20px;border-radius:50%;background:var(--c);color:#000;' +
    'display:flex;align-items:center;justify-content:center;' +
    'opacity:0;transform:scale(.6);transition:opacity .18s ease,transform .18s ease}' +
    '.rj-ps-obj-card.on .rj-ps-obj-check{opacity:1;transform:scale(1)}' +

    '.rj-ps-budget-card{margin:0 14px;padding:14px 14px 12px;border-radius:12px;' +
    'background:linear-gradient(180deg,var(--bg3) 0%,var(--bg2) 100%);' +
    'border:1px solid var(--border-hi)}' +
    '.rj-ps-budget-hint{font-size:11px;color:var(--text3);line-height:1.45;' +
    'padding:8px 10px;margin-bottom:14px;border-radius:8px;' +
    'background:rgba(255,179,0,0.06);border-left:2px solid var(--amber)}' +
    '.rj-ps-sliders{display:flex;flex-direction:column;gap:14px}' +
    '.rj-ps-slider-head{display:flex;align-items:center;gap:10px;margin-bottom:8px}' +
    '.rj-ps-slider-ico{flex-shrink:0;width:28px;height:28px;border-radius:6px;' +
    'background:color-mix(in srgb,var(--c) 14%,transparent);border:1px solid color-mix(in srgb,var(--c) 30%,transparent);' +
    'color:var(--c);display:flex;align-items:center;justify-content:center}' +
    '.rj-ps-slider-info{flex:1;min-width:0}' +
    '.rj-ps-slider-label{font-family:var(--font-display);font-size:12px;font-weight:800;' +
    'color:var(--text);letter-spacing:.02em;line-height:1.1}' +
    '.rj-ps-slider-desc{font-size:10.5px;color:var(--text3);line-height:1.3;margin-top:2px}' +
    '.rj-ps-slider-val{font-family:var(--font-display);font-size:18px;font-weight:900;' +
    'color:var(--c);line-height:1;letter-spacing:.01em;min-width:42px;text-align:right}' +
    '.rj-ps-slider-val span{font-size:11px;color:var(--c);opacity:.7;margin-left:1px;font-weight:700}' +
    '.rj-ps-range{width:100%;height:4px;background:rgba(255,255,255,0.06);border-radius:2px;' +
    'appearance:none;-webkit-appearance:none;outline:none;cursor:pointer;accent-color:var(--c)}' +
    '.rj-ps-range::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;' +
    'width:18px;height:18px;border-radius:50%;background:var(--c);cursor:pointer;' +
    'border:2px solid var(--bg);box-shadow:0 2px 6px color-mix(in srgb,var(--c) 35%,transparent)}' +
    '.rj-ps-range::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:var(--c);' +
    'cursor:pointer;border:2px solid var(--bg);box-shadow:0 2px 6px color-mix(in srgb,var(--c) 35%,transparent)}' +
    '.rj-ps-total-bar{margin-top:14px;padding-top:12px;border-top:1px solid var(--border);' +
    'display:flex;justify-content:space-between;align-items:center}' +
    '.rj-ps-total-lbl{font-family:var(--font-display);font-size:10px;font-weight:800;' +
    'color:var(--muted);letter-spacing:.16em;text-transform:uppercase}' +
    '.rj-ps-total-val{font-family:var(--font-display);font-size:20px;font-weight:900;' +
    'color:var(--green);line-height:1;letter-spacing:.01em;transition:color .2s ease}' +
    '.rj-ps-total-val span{font-size:13px;opacity:.6;margin-left:1px}' +
    '.rj-ps-total-val.rj-ps-invalid{color:var(--red3)}' +

    '.rj-ps-angle-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 14px}' +
    '.rj-ps-angle-card{position:relative;padding:13px 12px 11px;border-radius:12px;cursor:pointer;' +
    '-webkit-tap-highlight-color:transparent;' +
    'background:linear-gradient(180deg,var(--bg3) 0%,var(--bg2) 100%);' +
    'border:1px solid var(--border-hi);border-left:3px solid rgba(255,255,255,0.06);' +
    'transition:border-color .15s ease,transform .12s ease;overflow:hidden}' +
    '.rj-ps-angle-card.on{border-color:var(--c);border-left-color:var(--c);' +
    'box-shadow:0 0 0 1px var(--c) inset,0 6px 18px color-mix(in srgb,var(--c) 22%,transparent)}' +
    '.rj-ps-angle-card:active{transform:scale(.985)}' +
    '.rj-ps-angle-head{display:flex;align-items:center;gap:8px;margin-bottom:5px}' +
    '.rj-ps-angle-ico{flex-shrink:0;width:30px;height:30px;border-radius:7px;' +
    'background:color-mix(in srgb,var(--c) 14%,transparent);' +
    'border:1px solid color-mix(in srgb,var(--c) 30%,transparent);' +
    'color:var(--c);display:flex;align-items:center;justify-content:center}' +
    '.rj-ps-angle-card.on .rj-ps-angle-ico{background:color-mix(in srgb,var(--c) 22%,transparent);' +
    'border-color:var(--c)}' +
    '.rj-ps-angle-label{font-family:var(--font-display);font-size:13px;font-weight:800;' +
    'color:var(--text);letter-spacing:.02em;line-height:1.1}' +
    '.rj-ps-angle-card.on .rj-ps-angle-label{color:var(--c)}' +
    '.rj-ps-angle-desc{font-size:11px;color:var(--text3);line-height:1.4;margin-bottom:8px;min-height:30px}' +
    '.rj-ps-angle-tags{display:flex;flex-wrap:wrap;gap:4px}' +
    '.rj-ps-angle-tag{font-family:var(--font-display);font-size:9.5px;font-weight:700;' +
    'padding:2px 6px;border-radius:3px;letter-spacing:.04em;' +
    'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);color:var(--text2)}' +
    '.rj-ps-angle-tag.pos{color:#34D399;background:rgba(52,211,153,0.10);border-color:rgba(52,211,153,0.25)}' +
    '.rj-ps-angle-tag.neg{color:#EF4444;background:rgba(239,68,68,0.10);border-color:rgba(239,68,68,0.25)}' +

    '.rj-ps-cta-wrap{margin:18px 14px 24px;padding:0}' +
    '.rj-ps-cta{width:100%;display:flex;align-items:center;justify-content:center;gap:10px;' +
    'padding:15px 18px;border-radius:12px;border:none;cursor:pointer;' +
    'background:linear-gradient(135deg,#FF1801 0%,#C8102E 100%);' +
    'color:#fff;font-family:var(--font-display);font-size:14px;font-weight:900;' +
    'letter-spacing:.10em;text-transform:uppercase;' +
    'box-shadow:0 6px 22px rgba(255,24,1,0.35),0 0 0 1px rgba(255,255,255,0.08) inset;' +
    'transition:transform .12s ease,box-shadow .15s ease,opacity .15s ease}' +
    '.rj-ps-cta:active:not(:disabled){transform:scale(.98)}' +
    '.rj-ps-cta:disabled{opacity:.45;cursor:not-allowed;background:linear-gradient(135deg,#444 0%,#333 100%);' +
    'box-shadow:none}' +
    '.rj-ps-cta-arrow{display:flex;align-items:center;justify-content:center;line-height:0}' +
    '';
    var s = document.createElement('style');
    s.id = 'rj-ps-redesign-css';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function wrapPsUpdateTotal() {
    if (typeof window._psUpdateTotal !== 'function') return false;
    if (window._psUpdateTotal._rjUserFixPS) return true;
    var orig = window._psUpdateTotal;
    window._psUpdateTotal = function rjPsUpdateTotalNew() {
      var r;
      try { r = orig.apply(this, arguments); } catch (e) {}
      try {
        var b = window._presBudget || {};
        var total = (b.sim || 0) + (b.coach || 0) + (b.lifestyle || 0) + (b.savings || 0);
        var el = document.getElementById('ps-total');
        if (el) {
          el.innerHTML = total + '<span>%</span>';
          if (total === 100) el.classList.remove('rj-ps-invalid');
          else el.classList.add('rj-ps-invalid');
        }
        var btn = document.getElementById('ps-validate-btn');
        if (btn) {
          btn.disabled = total !== 100;
        }
      } catch (e) {}
      return r;
    };
    window._psUpdateTotal._rjUserFixPS = true;
    return true;
  }

  function wrapPsPickObj() {
    if (typeof window._psPickObj !== 'function') return false;
    if (window._psPickObj._rjUserFixPS) return true;
    window._psPickObj = function rjPsPickObjNew(k) {
      try {
        window._presObjective = k;
        if (typeof window.PRESEASON_OBJECTIVES !== 'object') return;
        Object.keys(window.PRESEASON_OBJECTIVES).forEach(function(key) {
          var el = document.getElementById('ps-obj-' + key);
          if (!el) return;
          if (key === k) el.classList.add('on');
          else el.classList.remove('on');
        });
      } catch (e) { console.warn('[07] _psPickObj err:', e); }
    };
    window._psPickObj._rjUserFixPS = true;
    return true;
  }

  function wrapPsPickAngle() {
    if (typeof window._psPickAngle !== 'function') return false;
    if (window._psPickAngle._rjUserFixPS) return true;
    window._psPickAngle = function rjPsPickAngleNew(k) {
      try {
        window._presAngle = k;
        if (typeof window.PRESEASON_ANGLES !== 'object') return;
        Object.keys(window.PRESEASON_ANGLES).forEach(function(key) {
          var el = document.getElementById('ps-ang-' + key);
          if (!el) return;
          if (key === k) el.classList.add('on');
          else el.classList.remove('on');
        });
      } catch (e) { console.warn('[07] _psPickAngle err:', e); }
    };
    window._psPickAngle._rjUserFixPS = true;
    return true;
  }

  function wrapPsAdjustBudget() {
    if (typeof window._psAdjustBudget !== 'function') return false;
    if (window._psAdjustBudget._rjUserFixPS) return true;
    window._psAdjustBudget = function rjPsAdjustBudgetNew(k, t) {
      try {
        t = parseInt(t) || 0;
        if (!window._presBudget) {
          window._presBudget = { sim: 25, coach: 25, lifestyle: 25, savings: 25 };
        }
        window._presBudget[k] = t;
        var el = document.getElementById('ps-val-' + k);
        if (el) el.innerHTML = t + '<span>%</span>';
        if (typeof window._psUpdateTotal === 'function') window._psUpdateTotal();
      } catch (e) { console.warn('[07] _psAdjustBudget err:', e); }
    };
    window._psAdjustBudget._rjUserFixPS = true;
    return true;
  }

  function wrapRenderPreseasonPlanning() {
    if (typeof window.renderPreseasonPlanning !== 'function') return false;
    if (window.renderPreseasonPlanning._rjUserFixRedesign) return true;
    var orig = window.renderPreseasonPlanning;
    window.renderPreseasonPlanning = function rjRenderPreseasonPlanningNew() {
      try {
        _injectPreseasonCSS();
        _renderPreseasonNew();
      } catch (e) {
        console.warn('[07] renderPreseasonPlanning new render err, fallback:', e);
        try { return orig.apply(this, arguments); } catch (e2) {}
      }
    };
    window.renderPreseasonPlanning._rjUserFixRedesign = true;
    console.log('[07] renderPreseasonPlanning redesigned (F1 DA)');
    return true;
  }

  // ========================================================================
  // FIX 11 — RÉGLAGES VOITURE : JAUGES DE COMPORTEMENT EN TEMPS RÉEL
  // ========================================================================
  // Demande utilisateur : retravailler les réglages dans l'esprit du brief
  // "philosophie des compromis" — chaque slider doit avoir des conséquences
  // visibles, le joueur doit ressentir "j'améliore X, je perds Y".
  //
  // CONSTAT :
  //   - Le système SETUP_COUPLINGS existe DÉJÀ (couplages auto entre curseurs)
  //   - computeAdvancedSetupScore évalue la qualité par rapport au sweet spot
  //   - MAIS : le joueur ne voit pas les compromis, c'est invisible
  //
  // STRATÉGIE :
  //   1. Calculer 6 stats internes "ressenties" depuis les 9 curseurs :
  //      rotation, stabilité, traction, agressivité, gestion pneus, vitesse
  //   2. Afficher ces stats sous forme de jauges colorées en temps réel
  //   3. Détecter les setups extrêmes/déséquilibrés → message ingénieur
  //   4. Animer chaque jauge à chaque mouvement de slider
  //   5. Garder TOUS les couplages SETUP_COUPLINGS existants (logique intacte)
  //
  // Le rendu est INJECTÉ dans le card "Équilibre voiture" existant via
  // un MutationObserver (sans casser la struct DOM originale).
  // ========================================================================

  /**
   * Calcule 6 stats internes à partir des 9 curseurs setup (échelle 0-10).
   * Renvoie chaque stat sur 0-100 avec une zone "neutre" autour de 50.
   * Modèle : équilibre des compromis F1 (aero, mécanique, pneus).
   */
  function _rjComputeBehaviorStats(setup) {
    var s = setup || {};
    function v(k, def) {
      var x = s[k];
      return (typeof x === 'number') ? x : (def == null ? 5 : def);
    }
    var avA = v('aileron_av', 5);     // Aileron avant : rotation+, stabilité-
    var avR = v('aileron_ar', 5);     // Aileron arrière : traction+, vitesse-
    var arA = v('antiroulis_av', 5);  // Antiroulis av : rotation+, traction-
    var arR = v('antiroulis_ar', 5);  // Antiroulis ar : stabilité+, agilité-
    var car = v('carrossage', 5);     // Carrossage : grip+, usure+
    var sus = v('suspension', 5);     // Suspension dure : réactivité+, traction-
    var prP = v('pression_pneus', 5); // Pression : vitesse+, grip-
    var dif = v('differentiel', 5);   // Diff fermé : traction+, rotation-
    var fre = v('repartition_frein', 5); // Frein avant : freinage+, instabilité+

    // ROTATION (capacité à tourner / agilité avant)
    // Aile avant ↑, antiroulis avant ↑, suspension dure ↑, diff ouvert ↑
    var rot = 50
      + (avA - 5) * 4.5
      + (arA - 5) * 3.5
      + (sus - 5) * 2.0
      + (5 - dif) * 2.0
      - (avR - 5) * 1.8
      - (arR - 5) * 1.5;

    // STABILITÉ (sécurité, prévisibilité)
    // Aile arrière ↑, antiroulis arrière ↑, suspension souple ↑, frein arrière ↑
    var sta = 50
      + (avR - 5) * 4.5
      + (arR - 5) * 3.0
      + (5 - sus) * 2.5
      + (5 - fre) * 2.0
      - (avA - 5) * 2.5
      - (arA - 5) * 2.0
      - (prP - 5) * 1.5;

    // TRACTION (motricité en sortie de virage)
    // Aile arrière ↑, suspension souple ↑, antiroulis arrière souple ↑, diff fermé ↑
    var tra = 50
      + (avR - 5) * 3.5
      + (5 - sus) * 2.5
      + (5 - arR) * 2.0
      + (dif - 5) * 3.0
      - (arA - 5) * 1.5
      - (prP - 5) * 1.0;

    // AGRESSIVITÉ (caractère pointu, comportement nerveux)
    // Antiroulis durs ↑, aile avant ↑, suspension dure ↑, frein avant ↑
    var agg = 50
      + (arA - 5) * 3.0
      + (arR - 5) * 1.5
      + (avA - 5) * 3.0
      + (sus - 5) * 2.0
      + (fre - 5) * 2.5
      - (avR - 5) * 1.5;

    // GESTION PNEUS (durée de vie / dégradation faible)
    // Carrossage faible ↑, pression équilibrée ↑, antiroulis souples ↑
    var pne = 50
      + (5 - car) * 4.0
      - Math.abs(prP - 5) * 2.5
      + (5 - arA) * 1.2
      + (5 - arR) * 1.2
      + (5 - sus) * 1.0
      - (avA - 5) * 0.8;

    // VITESSE DE POINTE (top speed sur ligne droite)
    // Ailerons faibles ↑, pression élevée ↑, carrossage faible ↑
    var vit = 50
      + (5 - avA) * 3.5
      + (5 - avR) * 4.0
      + (prP - 5) * 2.5
      + (5 - car) * 1.5;

    function clamp(x) { return Math.max(0, Math.min(100, Math.round(x))); }
    return {
      rotation:    clamp(rot),
      stabilite:   clamp(sta),
      traction:    clamp(tra),
      agressivite: clamp(agg),
      pneus:       clamp(pne),
      vitesse:     clamp(vit)
    };
  }

  /**
   * Détecte les setups extrêmes pour un commentaire ingénieur.
   * Renvoie une chaîne courte ou null.
   */
  function _rjDiagnoseSetup(stats) {
    if (!stats) return null;
    if (stats.rotation > 78 && stats.stabilite < 35)
      return { tone: 'warn', txt: 'Avant très pointu — risque de survirage à haute vitesse.' };
    if (stats.stabilite > 80 && stats.rotation < 35)
      return { tone: 'info', txt: 'Voiture saine mais paresseuse en entrée de virage.' };
    if (stats.agressivite > 80)
      return { tone: 'warn', txt: 'Setup nerveux. Marges très fines, fatigue pilote élevée.' };
    if (stats.traction < 30)
      return { tone: 'warn', txt: 'Motricité fragile en sortie de virage.' };
    if (stats.vitesse > 80 && stats.stabilite < 40)
      return { tone: 'warn', txt: 'Dragster instable — bon en ligne droite, périlleux en courbe.' };
    if (stats.pneus < 30)
      return { tone: 'warn', txt: 'Pneus à risque — dégradation thermique probable.' };
    if (stats.rotation >= 55 && stats.stabilite >= 55 && stats.traction >= 55)
      return { tone: 'good', txt: 'Bel équilibre — la voiture devrait répondre proprement.' };
    return null;
  }

  var _RJ_BEHAVIOR_DEFS = [
    { k: 'rotation',    label: 'Rotation',    color: '#FF1801', desc: 'Agilité avant' },
    { k: 'stabilite',   label: 'Stabilité',   color: '#60A5FA', desc: 'Prévisibilité' },
    { k: 'traction',    label: 'Traction',    color: '#34D399', desc: 'Motricité' },
    { k: 'agressivite', label: 'Agressivité', color: '#F59E0B', desc: 'Caractère' },
    { k: 'pneus',       label: 'Pneus',       color: '#A78BFA', desc: 'Gestion gomme' },
    { k: 'vitesse',     label: 'Vitesse',     color: '#22D3EE', desc: 'Top speed' }
  ];

  function _rjGaugeColor(v, color) {
    if (v < 25) return '#EF4444';
    if (v < 40) return '#F59E0B';
    return color;
  }

  function _rjBuildBehaviorPanel() {
    if (typeof window.G === 'undefined' || !window.G || !window.G.setupAdv) return '';
    var stats = _rjComputeBehaviorStats(window.G.setupAdv);
    var diag = _rjDiagnoseSetup(stats);

    var html = '<div class="rj-bp" id="rj-behavior-panel">';
    html += '  <div class="rj-bp-head">';
    html += '    <div class="rj-bp-kicker">Comportement voiture</div>';
    html += '    <div class="rj-bp-hint">Chaque réglage modifie ces équilibres en temps réel.</div>';
    html += '  </div>';
    html += '  <div class="rj-bp-grid">';
    _RJ_BEHAVIOR_DEFS.forEach(function(def) {
      var v = stats[def.k];
      var c = _rjGaugeColor(v, def.color);
      html += '<div class="rj-bp-cell" style="--c:' + c + '" data-stat="' + def.k + '">';
      html += '  <div class="rj-bp-row">';
      html += '    <span class="rj-bp-label">' + def.label + '</span>';
      html += '    <span class="rj-bp-val" id="rj-bp-val-' + def.k + '">' + v + '</span>';
      html += '  </div>';
      html += '  <div class="rj-bp-bar"><div class="rj-bp-fill" id="rj-bp-fill-' + def.k +
              '" style="width:' + v + '%;background:' + c + '"></div></div>';
      html += '</div>';
    });
    html += '  </div>';
    if (diag) {
      var dCls = 'rj-bp-diag rj-bp-diag-' + diag.tone;
      html += '<div class="' + dCls + '" id="rj-bp-diag">';
      html += '  <span class="rj-bp-diag-dot"></span>';
      html += '  <span>' + _safeEsc(diag.txt) + '</span>';
      html += '</div>';
    } else {
      html += '<div class="rj-bp-diag rj-bp-diag-empty" id="rj-bp-diag" style="display:none"></div>';
    }
    html += '</div>';
    return html;
  }

  function _rjUpdateBehaviorPanel() {
    try {
      var panel = document.getElementById('rj-behavior-panel');
      if (!panel) return;
      if (!window.G || !window.G.setupAdv) return;
      var stats = _rjComputeBehaviorStats(window.G.setupAdv);
      _RJ_BEHAVIOR_DEFS.forEach(function(def) {
        var v = stats[def.k];
        var c = _rjGaugeColor(v, def.color);
        var valEl = document.getElementById('rj-bp-val-' + def.k);
        var fillEl = document.getElementById('rj-bp-fill-' + def.k);
        var cellEl = panel.querySelector('[data-stat="' + def.k + '"]');
        if (valEl) {
          // Effet "pulse" si changement significatif
          var prev = parseInt(valEl.textContent, 10);
          if (!isNaN(prev) && Math.abs(prev - v) >= 3) {
            valEl.classList.add('rj-bp-pulse');
            setTimeout(function() { valEl.classList.remove('rj-bp-pulse'); }, 380);
          }
          valEl.textContent = v;
        }
        if (fillEl) {
          fillEl.style.width = v + '%';
          fillEl.style.background = c;
        }
        if (cellEl) cellEl.style.setProperty('--c', c);
      });
      // Diagnostic
      var diag = _rjDiagnoseSetup(stats);
      var diagEl = document.getElementById('rj-bp-diag');
      if (diagEl) {
        if (diag) {
          diagEl.className = 'rj-bp-diag rj-bp-diag-' + diag.tone;
          diagEl.style.display = '';
          diagEl.innerHTML = '<span class="rj-bp-diag-dot"></span><span>' +
            _safeEsc(diag.txt) + '</span>';
        } else {
          diagEl.style.display = 'none';
          diagEl.innerHTML = '';
        }
      }
    } catch (e) { console.warn('[07] _rjUpdateBehaviorPanel err:', e); }
  }

  function _injectBehaviorPanelCSS() {
    if (document.getElementById('rj-bp-css')) return;
    var css = '' +
    '.rj-bp{margin:0 0 10px;padding:12px 14px 10px;border-radius:10px;' +
    'background:linear-gradient(180deg,var(--bg3) 0%,var(--bg2) 100%);' +
    'border:1px solid var(--border-hi);overflow:hidden;position:relative}' +
    '.rj-bp::before{content:"";position:absolute;top:0;left:0;right:0;height:1px;' +
    'background:linear-gradient(90deg,transparent 0%,var(--red2) 30%,var(--red3) 50%,var(--red2) 70%,transparent 100%);opacity:.6}' +
    '.rj-bp-head{margin-bottom:10px}' +
    '.rj-bp-kicker{font-family:var(--font-display);font-size:11px;font-weight:800;' +
    'color:var(--text);letter-spacing:.10em;text-transform:uppercase}' +
    '.rj-bp-hint{font-size:10.5px;color:var(--text3);line-height:1.35;margin-top:2px}' +
    '.rj-bp-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 14px}' +
    '.rj-bp-cell{display:flex;flex-direction:column;gap:4px}' +
    '.rj-bp-row{display:flex;justify-content:space-between;align-items:baseline}' +
    '.rj-bp-label{font-family:var(--font-display);font-size:10px;font-weight:800;' +
    'color:var(--muted);letter-spacing:.08em;text-transform:uppercase}' +
    '.rj-bp-val{font-family:var(--font-display);font-size:13px;font-weight:900;' +
    'color:var(--c);line-height:1;letter-spacing:.01em;transition:color .2s ease,transform .15s ease}' +
    '.rj-bp-val.rj-bp-pulse{transform:scale(1.18)}' +
    '.rj-bp-bar{height:4px;background:rgba(255,255,255,0.05);border-radius:2px;overflow:hidden;' +
    'position:relative}' +
    '.rj-bp-fill{height:100%;border-radius:2px;' +
    'transition:width .35s cubic-bezier(.4,0,.2,1),background .25s ease;' +
    'box-shadow:0 0 8px color-mix(in srgb,var(--c) 35%,transparent)}' +
    '.rj-bp-diag{margin-top:10px;padding:8px 10px;border-radius:7px;' +
    'display:flex;align-items:center;gap:8px;font-size:11.5px;line-height:1.35}' +
    '.rj-bp-diag-dot{flex-shrink:0;width:6px;height:6px;border-radius:50%;background:currentColor;' +
    'box-shadow:0 0 6px currentColor}' +
    '.rj-bp-diag-good{color:#34D399;background:rgba(52,211,153,0.08);' +
    'border:1px solid rgba(52,211,153,0.25)}' +
    '.rj-bp-diag-warn{color:#F59E0B;background:rgba(245,158,11,0.08);' +
    'border:1px solid rgba(245,158,11,0.25)}' +
    '.rj-bp-diag-info{color:#60A5FA;background:rgba(96,165,250,0.08);' +
    'border:1px solid rgba(96,165,250,0.25)}' +
    '';
    var s = document.createElement('style');
    s.id = 'rj-bp-css';
    s.textContent = css;
    document.head.appendChild(s);
  }

  /**
   * Injecte le panneau dans le card Équilibre voiture après chaque rendu.
   * Le panneau est ajouté en HAUT du container #advanced-setup-container,
   * juste avant le card "Équilibre voiture" original.
   */
  function _rjInjectBehaviorPanel() {
    try {
      var container = document.getElementById('advanced-setup-container');
      if (!container) return;
      // Vérifier qu'on a bien G.setupAdv (sinon le panneau n'a pas de sens)
      if (!window.G || !window.G.setupAdv) return;
      // Si déjà présent ET pas dépassé, on update juste les valeurs
      var existing = document.getElementById('rj-behavior-panel');
      if (existing && existing.parentElement === container) {
        // Si c'est le 1er enfant, on le laisse et on update
        if (container.firstElementChild === existing) {
          _rjUpdateBehaviorPanel();
          return;
        }
        // Sinon on le retire (le DOM a été reconstruit autour)
        existing.remove();
      } else if (existing) {
        existing.remove();
      }
      // Injecter en première position
      var html = _rjBuildBehaviorPanel();
      if (!html) return;
      var wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      var node = wrapper.firstElementChild;
      if (node) {
        container.insertBefore(node, container.firstChild);
      }
    } catch (e) { console.warn('[07] _rjInjectBehaviorPanel err:', e); }
  }

  function wrapRenderAdvancedSetupUI() {
    if (typeof window.renderAdvancedSetupUI !== 'function') return false;
    if (window.renderAdvancedSetupUI._rjUserFixBehavior) return true;
    var orig = window.renderAdvancedSetupUI;
    window.renderAdvancedSetupUI = function rjRenderAdvancedSetupUIBeh() {
      var r;
      try { r = orig.apply(this, arguments); }
      catch (e) { console.warn('[07] renderAdvancedSetupUI orig:', e); }
      // Après le rendu original, on injecte/update le panneau
      try { _rjInjectBehaviorPanel(); } catch (e) {}
      return r;
    };
    window.renderAdvancedSetupUI._rjUserFixBehavior = true;
    console.log('[07] renderAdvancedSetupUI wrapped (behavior gauges)');
    return true;
  }

  /**
   * Wrap setAdvParam pour mettre à jour les jauges en temps réel
   * SANS toucher à la logique de couplage existante.
   */
  function wrapSetAdvParam() {
    if (typeof window.setAdvParam !== 'function') return false;
    if (window.setAdvParam._rjUserFixBehavior) return true;
    var orig = window.setAdvParam;
    window.setAdvParam = function rjSetAdvParamBeh() {
      var r;
      try { r = orig.apply(this, arguments); }
      catch (e) { console.warn('[07] setAdvParam orig:', e); }
      // Update jauges (le re-render complet est déjà fait par l'orig,
      // mais notre wrap renderAdvancedSetupUI ré-injectera le panneau si besoin)
      try { _rjUpdateBehaviorPanel(); } catch (e) {}
      return r;
    };
    window.setAdvParam._rjUserFixBehavior = true;
    return true;
  }

  /**
   * Watchdog : si l'écran "Équilibre voiture" est ouvert et que le panneau
   * disparaît (ré-render externe), on le ré-injecte.
   */
  function _rjStartBehaviorWatchdog() {
    setInterval(function() {
      try {
        var container = document.getElementById('advanced-setup-container');
        if (!container) return;
        // L'écran de course doit être actif et l'onglet rt-prep visible
        var sRace = document.getElementById('S-race');
        if (!sRace || !sRace.classList.contains('on')) return;
        var rtPrep = document.getElementById('rt-prep');
        if (!rtPrep || rtPrep.style.display === 'none') return;
        // Le card original doit être présent
        if (!container.children.length) return;
        // Inject si pas déjà là
        if (!document.getElementById('rj-behavior-panel')) {
          _rjInjectBehaviorPanel();
        }
      } catch (e) {}
    }, 1500);
  }

  function applyAllUserFixes() {
    var ok = true;
    // FIX 1 : CSS injection (ne dépend de rien)
    try { injectGameEditorCSSFix(); } catch (e) { console.warn('[07] css inject:', e); }
    // FIX 2 : merge Prema (data only, peut être appelé avant ou après init)
    try { mergePremaTeams(); } catch (e) { console.warn('[07] prema merge:', e); }
    // FIX 4 : ask engineer enhancement
    wrapAskEngineerHint();
    // FIX 7 : driver profile career history
    wrapShowDriverProfileModal();
    // FIX 8 : home badges (agent off, sponsors+contrats on)
    wrapUpdateHomeBadges();
    applyHomeBadges();
    // FIX 9 : vie perso — masquer sous-titres Parents/Amis/Coach
    wrapRenderVieperso();
    _hideRelationSubtitles();
    // FIX 10 : refonte page pré-saison
    _injectPreseasonCSS();
    wrapRenderPreseasonPlanning();
    wrapPsPickObj();
    wrapPsPickAngle();
    wrapPsAdjustBudget();
    wrapPsUpdateTotal();
    // FIX 11 : jauges de comportement voiture (réglages)
    _injectBehaviorPanelCSS();
    wrapRenderAdvancedSetupUI();
    wrapSetAdvParam();
    return ok;
  }

  // Tentatives multiples : DOM ready, puis retries au cas où certaines
  // fonctions sont définies plus tard (modules patch chargés après).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      applyAllUserFixes();
      setTimeout(applyAllUserFixes, 300);
      setTimeout(applyAllUserFixes, 1200);
      setTimeout(applyAllUserFixes, 3000);
    });
  } else {
    applyAllUserFixes();
    setTimeout(applyAllUserFixes, 300);
    setTimeout(applyAllUserFixes, 1200);
    setTimeout(applyAllUserFixes, 3000);
  }

  // Watchdog : ré-applique le merge Prema si les données sont rechargées
  // (load save par exemple)
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

  // Watchdog : badges menu accueil — réapplique périodiquement au cas où
  // le code original ré-active le badge agent ou ne met pas à jour
  // sponsors/contrats.
  var _badgeWatchInterval = setInterval(function() {
    try {
      // N'agit que si le menu accueil est visible (sinon waste)
      var home = document.getElementById('S-home');
      if (home && home.classList && home.classList.contains('on')) {
        applyHomeBadges();
      }
    } catch (e) {}
  }, 1500);

  // Watchdog : sous-titres vie perso — réapplique le masquage si l'onglet
  // est ouvert et qu'un sous-titre indésirable réapparaît
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

  // Watchdog : panneau de comportement voiture — ré-injecte si manquant
  // pendant que l'écran "Équilibre voiture" est ouvert
  _rjStartBehaviorWatchdog();

  // Expose pour debug
  window.rjUserFixesReapply = applyAllUserFixes;

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
        if (s.indexOf('border-radius:14px') !== -1 &&
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
    window.renderCareerDetail = function rjRenderCareerDetailTagged() {
      var r = orig.apply(this, arguments);
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
    };
    window.renderCareerDetail._rjTagged = true;
  })();

  (function _rjWrapFilterCareerStats() {
    if (typeof filterCareerStats !== 'function') return;
    if (filterCareerStats._rjWrapped) return;
    var orig = filterCareerStats;
    window.filterCareerStats = function rjFilterCareerStatsWrapped(cat) {
      var r = orig.apply(this, arguments);
      try { _rjApplyCareerSeasonFilter(cat); } catch (e) {}
      return r;
    };
    window.filterCareerStats._rjWrapped = true;
  })();

  // ===========================================================================
  // FIX 14 : suppression des emojis et remplacement par SVG
  // ---------------------------------------------------------------------------
  // Mapping centralisé emoji → renderIcon name + couleur. Utilisé par :
  //  - _rjEmojiToSvg(str) : pour les contextes HTML (mails body, badges)
  //  - _rjStripEmoji(str) : pour les contextes textContent (toasts, titres)
  // Les wrappers patchent pushMail/pushHomeToast/showToast pour application auto
  // ===========================================================================

  var _RJ_EMOJI_MAP = {
    '\u2713':{i:'check',c:'#34D399'},'\u2714':{i:'check',c:'#34D399'},'\u2705':{i:'check',c:'#34D399'},
    '\u2717':{i:'x',c:'#EF4444'},'\u2715':{i:'x',c:'#EF4444'},
    '\u26A0':{i:'warn',c:'#F59E0B'},
    '\u2605':{i:'star',c:'#F59E0B'},'\u2606':{i:'star',c:'#9CA3AF'},'\uD83C\uDF1F':{i:'star',c:'#F59E0B'},
    '\uD83C\uDFC6':{i:'trophy',c:'#F59E0B'},
    '\uD83E\uDD47':{i:'medal',c:'#F59E0B'},'\uD83E\uDD48':{i:'medal',c:'#9CA3AF'},'\uD83E\uDD49':{i:'medal',c:'#C07840'},
    '\uD83D\uDC51':{i:'crown',c:'#F59E0B'},
    '\uD83C\uDFC1':{i:'damier',c:'#fff'},
    '\uD83C\uDFCE':{i:'car',c:'#EF4444'},
    '\uD83C\uDFF3':{i:'flag',c:'#fff'},'\u2691':{i:'flag',c:'#fff'},
    '\uD83D\uDD27':{i:'moteur',c:'#9CA3AF'},
    '\u26A1':{i:'zap',c:'#F59E0B'},
    '\uD83D\uDD25':{i:'fire',c:'#EF4444'},
    '\uD83D\uDCA5':{i:'boost',c:'#F59E0B'},
    '\uD83D\uDCA8':{i:'zap',c:'#60A5FA'},
    '\uD83C\uDFAF':{i:'target',c:'#EF4444'},
    '\uD83D\uDCCB':{i:'analyse_donnees',c:'#60A5FA'},'\uD83D\uDCCA':{i:'analyse_donnees',c:'#60A5FA'},
    '\uD83D\uDCC8':{i:'trend-up',c:'#34D399'},'\uD83D\uDCC9':{i:'downtrend',c:'#EF4444'},
    '\uD83D\uDCFB':{i:'radio',c:'#60A5FA'},
    '\uD83C\uDF99':{i:'mic',c:'#A78BFA'},'\uD83C\uDFA4':{i:'mic',c:'#A78BFA'},
    '\uD83D\uDCF0':{i:'news',c:'#60A5FA'},'\uD83D\uDDDE':{i:'news',c:'#60A5FA'},
    '\uD83D\uDCF1':{i:'phone',c:'#60A5FA'},'\uD83D\uDCDE':{i:'telephone',c:'#60A5FA'},
    '\uD83D\uDCAC':{i:'comment',c:'#60A5FA'},
    '\uD83D\uDCFA':{i:'tv',c:'#60A5FA'},'\uD83D\uDDA5':{i:'monitor',c:'#60A5FA'},'\uD83D\uDCBB':{i:'monitor',c:'#60A5FA'},
    '\u2709':{i:'msg_lu',c:'#60A5FA'},
    '\uD83D\uDCE5':{i:'messages',c:'#60A5FA'},'\uD83D\uDCED':{i:'messages',c:'#9CA3AF'},
    '\uD83D\uDCAA':{i:'physique',c:'#EF4444'},
    '\uD83E\uDDE0':{i:'brain',c:'#A78BFA'},
    '\u2764':{i:'heart',c:'#EF4444'},'\u2665':{i:'heart',c:'#EF4444'},
    '\uD83D\uDC95':{i:'heart',c:'#EC4899'},'\uD83D\uDC9B':{i:'heart',c:'#F59E0B'},
    '\uD83D\uDE4F':{i:'handshake',c:'#A78BFA'},'\uD83E\uDD1D':{i:'handshake',c:'#34D399'},'\uD83D\uDC4F':{i:'handshake',c:'#F59E0B'},
    '\uD83E\uDDD8':{i:'rest',c:'#A78BFA'},
    '\uD83D\uDCB0':{i:'money',c:'#F59E0B'},
    '\uD83D\uDCBC':{i:'contrats',c:'#9CA3AF'},
    '\uD83D\uDC8E':{i:'sparkles',c:'#60A5FA'},
    '\u2696':{i:'shield',c:'#A78BFA'},'\u2694':{i:'duel',c:'#EF4444'},'\uD83D\uDEE1':{i:'shield',c:'#9CA3AF'},
    '\uD83D\uDC65':{i:'users',c:'#60A5FA'},'\uD83E\uDDD1':{i:'pilote',c:'#9CA3AF'},
    '\uD83D\uDC40':{i:'public',c:'#A78BFA'},'\uD83D\uDC54':{i:'manager',c:'#9CA3AF'},
    '\uD83C\uDF93':{i:'diplome',c:'#A78BFA'},
    '\uD83D\uDCDA':{i:'news',c:'#60A5FA'},'\uD83D\uDCDC':{i:'contrats',c:'#A78BFA'},'\uD83D\uDCC4':{i:'contrats',c:'#9CA3AF'},
    '\u2600':{i:'dry',c:'#F59E0B'},'\uD83C\uDF24':{i:'dry',c:'#F59E0B'},'\u26C5':{i:'cloudy',c:'#9CA3AF'},
    '\uD83C\uDF26':{i:'wet',c:'#60A5FA'},'\uD83C\uDF27':{i:'wet',c:'#60A5FA'},'\u26C8':{i:'storm',c:'#A78BFA'},
    '\uD83D\uDCA7':{i:'wet',c:'#60A5FA'},
    '\uD83C\uDFE2':{i:'paddock',c:'#9CA3AF'},'\uD83C\uDFDB':{i:'paddock',c:'#9CA3AF'},'\uD83C\uDFE0':{i:'home',c:'#9CA3AF'},
    '\uD83C\uDF0D':{i:'globe',c:'#60A5FA'},'\uD83D\uDCCD':{i:'target',c:'#EF4444'},
    '\uD83C\uDF89':{i:'sparkles',c:'#F59E0B'},'\u2728':{i:'sparkles',c:'#F59E0B'},'\uD83C\uDF82':{i:'sparkles',c:'#EC4899'},'\uD83C\uDF7B':{i:'sparkles',c:'#F59E0B'},
    '\uD83D\uDD35':{i:'check',c:'#60A5FA'},'\uD83D\uDD34':{i:'alert',c:'#EF4444'},
    '\uD83D\uDFE1':{i:'check',c:'#F59E0B'},'\uD83D\uDFE2':{i:'check',c:'#34D399'},'\uD83D\uDFE3':{i:'check',c:'#A78BFA'},
    '\u26AA':{i:'check',c:'#9CA3AF'},
    '\u26D4':{i:'alert',c:'#EF4444'},'\uD83D\uDEAB':{i:'alert',c:'#EF4444'},'\uD83D\uDEA8':{i:'alert',c:'#EF4444'},
    '\uD83D\uDCA1':{i:'sparkles',c:'#F59E0B'},'\uD83D\uDCF8':{i:'camera',c:'#9CA3AF'},
    '\uD83D\uDD13':{i:'check',c:'#34D399'},'\uD83D\uDD04':{i:'reset',c:'#9CA3AF'},
    '\uD83D\uDDD1':{i:'x',c:'#EF4444'},
    '\uD83C\uDFAE':{i:'paddock_pass',c:'#A78BFA'},'\uD83C\uDFB2':{i:'paddock_pass',c:'#A78BFA'},'\uD83C\uDFB4':{i:'paddock_pass',c:'#A78BFA'},
    '\uD83D\uDC10':{i:'star',c:'#F59E0B'},
    '\uD83D\uDC09':{i:'fire',c:'#EF4444'},
    '\uD83D\uDD6F':{i:'flag',c:'#F59E0B'},
    '\uD83D\uDD4A':{i:'handshake',c:'#34D399'},
    '\uD83C\uDF19':{i:'rest',c:'#A78BFA'},
    '\uD83D\uDD50':{i:'clock',c:'#9CA3AF'},
    '\uD83D\uDCA2':{i:'alert',c:'#EF4444'},
    '\u275D':{i:'comment',c:'#9CA3AF'},
    '\uD83D\uDD0B':{i:'zap',c:'#34D399'}
  };

  // Smileys to remove silently (no replacement)
  var _RJ_EMOJI_REMOVE = ['\uD83D\uDE0F','\uD83D\uDE09','\uD83D\uDE04','\uD83E\uDD70','\uD83E\uDD2F'];

  // Build regex from map keys (handles surrogate pairs correctly)
  // Country flag pairs first (2 regional indicators) — must match before single emojis
  var _RJ_FLAG_PAIR_RE = /\uD83C[\uDDE6-\uDDFF]\uD83C[\uDDE6-\uDDFF]/g;
  // Emoji regex covering BMP + supplementary plane (surrogate pairs).
  // Order matters : surrogate pairs first, then BMP single chars.
  var _RJ_EMOJI_RE = /\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDC00-\uDFFF]|[\u2600-\u2604\u2607-\u269F\u26A1-\u2712\u2715\u2716\u2718-\u27BF]/g;
  // Lone regional indicator (in case a flag pair was already handled, leftover ones)
  var _RJ_LONE_FLAG_RE = /\uD83C[\uDDE6-\uDDFF]/g;

  // Convert flag pair to country code
  function _rjFlagPairToCode(pair) {
    if (!pair || pair.length < 4) return null;
    // Each char is 0x1F1E6 + (charCode - 'A')
    var c1 = pair.codePointAt(0);
    var c2 = pair.codePointAt(2);
    if (c1 < 0x1F1E6 || c1 > 0x1F1FF || c2 < 0x1F1E6 || c2 > 0x1F1FF) return null;
    var l1 = String.fromCharCode(65 + (c1 - 0x1F1E6));
    var l2 = String.fromCharCode(65 + (c2 - 0x1F1E6));
    return l1 + l2;
  }

  // Replace emojis with SVG (HTML context). Returns HTML string.
  window._rjEmojiToSvg = function(str) {
    if (typeof str !== 'string' || !str) return str;
    // Step 1 : flag pairs → flagSvg (if available)
    str = str.replace(_RJ_FLAG_PAIR_RE, function(pair) {
      var code = _rjFlagPairToCode(pair);
      if (code && typeof flagSvg === 'function') {
        try {
          return '<span style="display:inline-flex;vertical-align:middle;margin:0 2px">' + flagSvg(code, 14) + '</span>';
        } catch (e) {}
      }
      return ''; // fallback : remove
    });
    // Step 2 : single emojis → SVG icon
    str = str.replace(_RJ_EMOJI_RE, function(emoji) {
      var info = _RJ_EMOJI_MAP[emoji];
      if (info && typeof renderIcon === 'function') {
        try {
          return '<span style="display:inline-flex;vertical-align:middle;margin:0 2px">' + renderIcon(info.i, 14, info.c) + '</span>';
        } catch (e) {}
      }
      // Smiley or unmapped : remove silently
      return '';
    });
    // Strip any leftover lone regional indicators
    str = str.replace(_RJ_LONE_FLAG_RE, '');
    // Cleanup : double spaces, leading/trailing spaces
    str = str.replace(/  +/g, ' ').replace(/^ +| +$/g, '');
    return str;
  };

  // Strip emojis (text context). Replaces with empty string.
  window._rjStripEmoji = function(str) {
    if (typeof str !== 'string' || !str) return str;
    str = str.replace(_RJ_FLAG_PAIR_RE, '');
    str = str.replace(_RJ_EMOJI_RE, '');
    str = str.replace(_RJ_LONE_FLAG_RE, '');
    // Strip any <span>...<svg>...</svg>...</span> blocks generated by replacements that
    // accidentally got into a textContent context (toasts/headers).
    str = str.replace(/<span[^>]*>[\s\S]*?<\/span>/g, '');
    str = str.replace(/<svg[\s\S]*?<\/svg>/g, '');
    str = str.replace(/  +/g, ' ').replace(/^ +| +$/g, '');
    return str;
  };

  // Wrap pushHomeToast : both label & text get stripped
  (function _rjWrapPushHomeToast() {
    if (typeof window.pushHomeToast !== 'function') return;
    if (window.pushHomeToast._rjEmojiWrapped) return;
    var orig = window.pushHomeToast;
    window.pushHomeToast = function(label, text, color) {
      try {
        if (typeof label === 'string') label = window._rjStripEmoji(label);
        if (typeof text === 'string') text = window._rjStripEmoji(text);
      } catch (e) {}
      return orig.call(this, label, text, color);
    };
    window.pushHomeToast._rjEmojiWrapped = true;
  })();

  // Wrap showToast : single arg
  (function _rjWrapShowToast() {
    if (typeof window.showToast !== 'function') return;
    if (window.showToast._rjEmojiWrapped) return;
    var orig = window.showToast;
    window.showToast = function(text) {
      try {
        if (typeof text === 'string') text = window._rjStripEmoji(text);
      } catch (e) {}
      return orig.call(this, text);
    };
    window.showToast._rjEmojiWrapped = true;
  })();

  // Wrap pushMail : body goes through HTML conversion (renders as innerHTML)
  // subject and from are textContent → strip
  (function _rjWrapPushMail() {
    if (typeof window.pushMail !== 'function') return;
    if (window.pushMail._rjEmojiWrapped) return;
    var orig = window.pushMail;
    window.pushMail = function(e) {
      if (e && typeof e === 'object') {
        try {
          if (typeof e.subject === 'string') e.subject = window._rjStripEmoji(e.subject);
          if (typeof e.from === 'string') e.from = window._rjStripEmoji(e.from);
          // FIX : body est rendu via _ppEscMailBody qui échappe les <tag>.
          // Convertir en SVG produirait du code brut. On strippe les emojis comme pour subject/from.
          if (typeof e.body === 'string') e.body = window._rjStripEmoji(e.body);
          if (Array.isArray(e.actions)) {
            e.actions.forEach(function(a) {
              if (a && typeof a.label === 'string') a.label = window._rjStripEmoji(a.label);
              if (a && typeof a.responseBody === 'string') a.responseBody = window._rjStripEmoji(a.responseBody);
            });
          }
        } catch (err) { console.warn('[07] pushMail wrap failed:', err); }
      }
      return orig.call(this, e);
    };
    window.pushMail._rjEmojiWrapped = true;
  })();

  // Wrap _addFeedPost : body in social feed is rendered as innerHTML
  (function _rjWrapAddFeedPost() {
    if (typeof window._addFeedPost !== 'function') return;
    if (window._addFeedPost._rjEmojiWrapped) return;
    var orig = window._addFeedPost;
    window._addFeedPost = function(post) {
      if (post && typeof post === 'object') {
        try {
          if (typeof post.body === 'string') post.body = window._rjEmojiToSvg(post.body);
          if (typeof post.author === 'string') post.author = window._rjStripEmoji(post.author);
        } catch (e) {}
      }
      return orig.call(this, post);
    };
    window._addFeedPost._rjEmojiWrapped = true;
  })();

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
    if (typeof window.renderF1Stats !== 'function') return;
    if (window.renderF1Stats._rjNeutralized) return;
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

  // 1. Wrap loadSave avec logs détaillés
  (function _rjWrapLoadSave() {
    if (typeof window.loadSave !== 'function') {
      console.warn('[07] loadSave non défini au moment du wrap — abandon');
      return;
    }
    if (window.loadSave._rjLogWrapped) return;
    var orig = window.loadSave;
    window.loadSave = function(slotIdx) {
      console.log('[07] loadSave appelé pour slot', slotIdx);
      try {
        var save = (typeof getSave === 'function') ? getSave(slotIdx) : null;
        console.log('[07] getSave a retourné:', save ? 'OBJET (' + Object.keys(save).length + ' propriétés)' : 'NULL');
        if (!save) {
          console.warn('[07] Aucune sauvegarde au slot', slotIdx);
          if (typeof pushHomeToast === 'function') pushHomeToast('Erreur', 'Aucune sauvegarde dans cet emplacement', '#EF4444');
          return;
        }
      } catch (preErr) {
        console.error('[07] Erreur avant loadSave:', preErr);
      }
      try {
        var r = orig.call(this, slotIdx);
        console.log('[07] loadSave a terminé sans exception');
        // Exécuter les migrations APRÈS le load réussi : G est maintenant peuplé
        try { if (typeof _rjMigrateRaceStrategy === 'function') _rjMigrateRaceStrategy(); } catch (mErr) {}
        try { if (typeof _rjMigrateMailbox === 'function') _rjMigrateMailbox(); } catch (mErr) {}
        // Restaurer les sponsors signés (FIX 17)
        try { if (typeof _rjRestoreSponsors === 'function') _rjRestoreSponsors(slotIdx); } catch (rsErr) {}
        return r;
      } catch (err) {
        console.error('[07] loadSave a planté:', err, err && err.stack);
        try {
          if (typeof pushHomeToast === 'function') {
            pushHomeToast('Chargement échoué', String(err && err.message || err), '#EF4444');
          } else {
            alert('Chargement échoué :\n' + (err && err.message || err));
          }
        } catch (toastErr) {}
        return;
      }
    };
    window.loadSave._rjLogWrapped = true;
    console.log('[07] loadSave wrappé avec logs détaillés');
  })();

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
      list.innerHTML = '<div style="margin:14px;padding:18px 16px;background:linear-gradient(180deg,rgba(239,68,68,0.08),rgba(239,68,68,0.02));border:1px solid rgba(239,68,68,0.30);border-left:3px solid #EF4444;border-radius:10px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="font-family:var(--font-display);font-size:11px;font-weight:800;color:#EF4444;letter-spacing:.10em;text-transform:uppercase">Sponsors verrouillés</span></div><div style="font-size:13px;color:var(--text2);line-height:1.55">Les sponsors te contacteront <strong>après ta première course</strong>. Termine ton premier week-end de compétition pour débloquer les opportunités de partenariats.</div></div>';
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
    window.renderSponsorsNew = function() {
      if (_rjAreSponsorsLocked()) {
        return _rjShowSponsorsLockedMessage();
      }
      return orig.apply(this, arguments);
    };
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
    window.renderSponsorsActiveNew = function() {
      if (_rjAreSponsorsLocked()) {
        // Affiche aussi le message dans la liste "actifs"
        try {
          var list = document.getElementById('sp-active-list');
          if (list) list.innerHTML = '<div style="padding:18px 16px;text-align:center;color:var(--text3);font-size:13px;font-style:italic">Aucun sponsor actif — débloqué après la 1ère course</div>';
        } catch (_e) {}
        return;
      }
      return orig.apply(this, arguments);
    };
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
  // On les sauvegarde séparément en localStorage et on restaure après loadSave.
  // ===========================================================================
  var _RJ_EXTRA_SAVE_KEYS = {
    sponsors: 'G.sponsors',
    currentTeamStaff: 'G.currentTeamStaff',
    _network: 'G._network',
    _paddockContacts: 'G._paddockContacts',
    staff: 'G.staff',
    _recentDialogues: 'G._recentDialogues'
  };

  function _rjGetExtraKey(slotIdx) {
    return 'rj_extra_slot_' + (slotIdx == null ? 0 : slotIdx);
  }

  function _rjPersistExtras() {
    try {
      if (typeof window.G === 'undefined' || !window.G) return;
      var slot = G._slot;
      if (slot == null) return;
      var extras = {};
      Object.keys(_RJ_EXTRA_SAVE_KEYS).forEach(function(prop) {
        if (G[prop] !== undefined) {
          extras[prop] = G[prop];
        }
      });
      localStorage.setItem(_rjGetExtraKey(slot), JSON.stringify(extras));
    } catch (e) {
      console.warn('[07] _rjPersistExtras failed:', e);
    }
  }

  function _rjRestoreExtras(slotIdx) {
    try {
      if (typeof window.G === 'undefined' || !window.G) return;
      var raw = localStorage.getItem(_rjGetExtraKey(slotIdx));
      if (!raw) return;
      var extras = JSON.parse(raw);
      if (!extras || typeof extras !== 'object') return;
      var restored = [];
      Object.keys(extras).forEach(function(prop) {
        if (extras[prop] !== undefined) {
          G[prop] = extras[prop];
          restored.push(prop);
        }
      });
      if (restored.length) console.log('[07] Données restaurées : ' + restored.join(', '));
    } catch (e) {
      console.warn('[07] _rjRestoreExtras failed:', e);
    }
  }

  // Alias pour compat avec ancien code qui appelle _rjRestoreSponsors
  function _rjRestoreSponsors(slotIdx) { _rjRestoreExtras(slotIdx); }
  function _rjPersistSponsors() { _rjPersistExtras(); }

  // Wrap saveGame pour persister les données extras
  (function _rjWrapSaveExtras() {
    if (typeof window.saveGame !== 'function') return;
    if (window.saveGame._rjSponsorsPatched) return;
    var orig = window.saveGame;
    window.saveGame = function(slotIdx) {
      var result;
      try { result = orig.apply(this, arguments); } catch (e) { throw e; }
      try { _rjPersistExtras(); } catch (e) {}
      return result;
    };
    window.saveGame._rjSponsorsPatched = true;
    console.log('[07] saveGame wrappé pour persister les données extras');
  })();

  console.log('[07] User fixes module loaded — applying 11 UX corrections');

})();

// ===========================================================================
// FIX 18 : CONTACTS & RÉSEAU PADDOCK — renderNetworkScreen()
// ---------------------------------------------------------------------------
// Problème : G._network existe et est alimenté, mais aucun écran ne l'affiche.
// Le joueur ne voit jamais ses contacts paddock ni l'effet des relations.
// Solution : renderNetworkScreen() injectée dans refreshScreen("S-contact-thread")
// + action "Entretenir la relation" coûtant 1 PA.
// ===========================================================================
(function _rjFixNetworkScreen() {
  // Render complet de l'écran réseau paddock
  window.renderNetworkScreen = function() {
    var el = document.getElementById('network-screen-content');
    if (!el) return;

    var contacts = (typeof getNetworkList === 'function') ? getNetworkList() : [];
    var html = '';

    // Header stats
    var totalContacts = contacts.length;
    var avgRel = totalContacts > 0
      ? Math.round(contacts.reduce(function(s,c){ return s + (c.relation||50); }, 0) / totalContacts)
      : 0;
    var strongContacts = contacts.filter(function(c){ return (c.relation||0) >= 65; }).length;

    html += '<div style="padding:14px 16px 10px">';
    html += '<div style="display:flex;gap:10px;margin-bottom:14px">';
    // Stat 1 : contacts
    html += '<div style="flex:1;padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:12px;text-align:center">';
    html += '<div style="font-family:var(--font-display);font-size:22px;font-weight:900;color:var(--white)">' + totalContacts + '</div>';
    html += '<div style="font-size:10px;color:var(--muted);margin-top:2px;font-weight:600;letter-spacing:.06em;text-transform:uppercase">Contacts</div>';
    html += '</div>';
    // Stat 2 : relation moyenne
    var relColor = avgRel >= 65 ? '#4ADE80' : avgRel >= 45 ? '#F59E0B' : '#EF4444';
    html += '<div style="flex:1;padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:12px;text-align:center">';
    html += '<div style="font-family:var(--font-display);font-size:22px;font-weight:900;color:' + relColor + '">' + avgRel + '</div>';
    html += '<div style="font-size:10px;color:var(--muted);margin-top:2px;font-weight:600;letter-spacing:.06em;text-transform:uppercase">Rel. moy.</div>';
    html += '</div>';
    // Stat 3 : alliés (>= 65)
    html += '<div style="flex:1;padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:12px;text-align:center">';
    html += '<div style="font-family:var(--font-display);font-size:22px;font-weight:900;color:#4ADE80">' + strongContacts + '</div>';
    html += '<div style="font-size:10px;color:var(--muted);margin-top:2px;font-weight:600;letter-spacing:.06em;text-transform:uppercase">Alliés</div>';
    html += '</div>';
    html += '</div>'; // fin stats

    if (totalContacts === 0) {
      html += '<div style="padding:32px 16px;text-align:center;color:var(--muted);font-size:13px;font-style:italic">';
      html += 'Aucun contact pour l\'instant. Rencontre des pros du paddock en course, lors des Media Days et via ton académie.';
      html += '</div>';
    } else {
      // Grouper par rôle
      var roleOrder = {tp:0, dir_sport:1, dir_tech:2, ing_course:3};
      var roleLabels = {tp:'Team Principal', dir_sport:'Dir. Sportif', dir_tech:'Dir. Technique', ing_course:'Ingénieur de course'};
      var roleColors = {tp:'#F59E0B', dir_sport:'#22D3EE', dir_tech:'#A78BFA', ing_course:'#34D399'};

      contacts.forEach(function(c) {
        var rel = c.relation || 50;
        var relColor = rel >= 70 ? '#4ADE80' : rel >= 50 ? '#F59E0B' : rel >= 30 ? '#FB923C' : '#EF4444';
        var relLabel = rel >= 75 ? 'Allié' : rel >= 60 ? 'Positif' : rel >= 40 ? 'Neutre' : rel >= 25 ? 'Froid' : 'Hostile';
        var contactColor = c.color || roleColors[c.role] || '#60A5FA';

        // Décroissance — depuis quand vu ?
        var weeksSince = 0;
        if (c.lastSeen) {
          weeksSince = 50 * ((G.saison || 1) - (c.lastSeen.saison || 1)) + ((G.semaine || 1) - (c.lastSeen.week || 1));
        }
        var decayWarning = weeksSince > 10;

        html += '<div style="display:flex;align-items:center;gap:12px;padding:13px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:12px;margin-bottom:8px;position:relative;overflow:hidden">';
        // Accent couleur gauche
        html += '<div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:' + contactColor + ';border-radius:3px 0 0 3px"></div>';
        // Avatar
        html += '<div style="width:42px;height:42px;border-radius:50%;background:' + contactColor + '22;border:2px solid ' + contactColor + '55;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px">';
        html += (typeof renderIcon === 'function') ? renderIcon(c.icon || 'user', 18, contactColor) : '👤';
        html += '</div>';
        // Info
        html += '<div style="flex:1;min-width:0">';
        html += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">';
        html += '<span style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (c.name || 'Inconnu') + '</span>';
        if (decayWarning) {
          html += '<span style="font-size:9px;color:#EF4444;font-weight:700;background:rgba(239,68,68,.12);padding:1px 6px;border-radius:4px;letter-spacing:.05em;white-space:nowrap">INACTIF</span>';
        }
        html += '</div>';
        html += '<div style="font-size:11px;color:var(--muted);margin-top:2px">' + (roleLabels[c.role] || c.roleLabel || c.role || 'Contact') + (c.team ? ' · ' + c.team : '') + '</div>';
        // Barre relation
        html += '<div style="display:flex;align-items:center;gap:6px;margin-top:6px">';
        html += '<div style="flex:1;height:3px;background:var(--bg3);border-radius:2px;overflow:hidden">';
        html += '<div style="height:100%;width:' + rel + '%;background:' + relColor + ';border-radius:2px;transition:width .3s"></div>';
        html += '</div>';
        html += '<span style="font-size:10px;font-weight:700;color:' + relColor + ';width:34px;text-align:right">' + relLabel + '</span>';
        html += '</div>';
        html += '</div>';
        // Bouton entretenir (si PA dispo)
        var canMaintain = (G.pa || 0) >= 1 && weeksSince >= 2;
        html += '<div style="flex-shrink:0;text-align:right">';
        html += '<div style="font-family:var(--font-display);font-size:14px;font-weight:900;color:' + relColor + '">' + rel + '</div>';
        html += '<div style="font-size:9px;color:var(--muted);margin-top:1px">/ 100</div>';
        if (canMaintain) {
          html += '<button onclick="rjMaintainContact(\'' + (c.key || '') + '\')" style="margin-top:6px;padding:5px 9px;background:' + contactColor + '22;border:1px solid ' + contactColor + '55;border-radius:6px;color:' + contactColor + ';font-size:10px;font-weight:700;font-family:var(--font-display);cursor:pointer;white-space:nowrap">Contacter −1 PA</button>';
        }
        html += '</div>';
        html += '</div>'; // fin carte
      });
    }

    html += '</div>'; // fin padding
    el.innerHTML = html;
  };

  // Action "Entretenir la relation" — coûte 1 PA, gagne +5-8 relation
  window.rjMaintainContact = function(key) {
    if (!key || (G.pa || 0) < 1) {
      if (typeof showToast === 'function') showToast('Pas assez de PA.');
      return;
    }
    if (typeof getNetworkEntry !== 'function') return;
    var entry = getNetworkEntry(key);
    if (!entry) return;
    var gain = 5 + Math.floor(Math.random() * 4); // +5 à +8
    entry.relation = Math.min(100, (entry.relation || 50) + gain);
    entry.lastSeen = {saison: G.saison || 1, week: G.semaine || 1};
    entry.interactions = (entry.interactions || 0) + 1;
    G.pa = Math.max(0, (G.pa || 0) - 1);
    if (typeof showToast === 'function') showToast('Relation renforcée avec ' + (entry.name || 'ce contact') + ' (+' + gain + ')');
    if (typeof updateUI === 'function') updateUI();
    // Re-render
    renderNetworkScreen();
  };

  // Wrapper refreshScreen pour injecter renderNetworkScreen sur S-contact-thread
  (function _rjWrapRefreshForNetwork() {
    if (typeof window.refreshScreen !== 'function') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _rjWrapRefreshForNetwork);
      } else { setTimeout(_rjWrapRefreshForNetwork, 500); }
      return;
    }
    if (window.refreshScreen._rjNetworkWrapped) return;
    var orig = window.refreshScreen;
    window.refreshScreen = function(screenId) {
      var r = orig.apply(this, arguments);
      try {
        if (screenId === 'S-contact-thread') {
          // On détourne S-contact-thread pour afficher le réseau
          var titleEl = document.getElementById('ct-title');
          var subEl = document.getElementById('ct-sub');
          if (titleEl) titleEl.textContent = 'Réseau Paddock';
          if (subEl) {
            var contacts = (typeof getNetworkList === 'function') ? getNetworkList() : [];
            subEl.textContent = contacts.length + ' contact' + (contacts.length > 1 ? 's' : '');
          }
          // Injecter le contenu réseau dans le scroll du thread
          var scroll = document.querySelector('#S-contact-thread .scroll');
          if (scroll) {
            var netDiv = document.getElementById('network-screen-content');
            if (!netDiv) {
              netDiv = document.createElement('div');
              netDiv.id = 'network-screen-content';
              scroll.innerHTML = '';
              scroll.appendChild(netDiv);
            }
            renderNetworkScreen();
          }
        }
      } catch(e) { console.warn('[07-FIX18] network screen:', e); }
      return r;
    };
    window.refreshScreen._rjNetworkWrapped = true;
    console.log('[07-FIX18] renderNetworkScreen injectée');
  })();

  // Décroissance hebdomadaire des relations réseau — hook weekly
  if (typeof WEEKLY_TICK_HOOKS !== 'undefined') {
    var alreadyHasDecay = WEEKLY_TICK_HOOKS.some(function(h){ return h.id === 'networkDecay'; });
    if (!alreadyHasDecay) {
      WEEKLY_TICK_HOOKS.push({
        id: 'networkDecay',
        run: function(weeks) {
          if (typeof decayNetworkRelations === 'function') decayNetworkRelations(weeks);
        }
      });
      console.log('[07-FIX18] Hook networkDecay enregistré');
    }
  }

})();

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

  // Wrapper mtab pour s'assurer que renderSocialTab est appelée
  (function _rjWrapMtab() {
    function doWrap() {
      if (typeof window.mtab !== 'function') {
        setTimeout(doWrap, 500); return;
      }
      if (window.mtab._rjSocialWrapped) return;
      var orig = window.mtab;
      window.mtab = function(tab) {
        var r = orig.apply(this, arguments);
        try {
          if (tab === 'reseaux' && typeof renderSocialTab === 'function') {
            renderSocialTab();
          }
        } catch(e) { console.warn('[07-FIX20] mtab social:', e); }
        return r;
      };
      window.mtab._rjSocialWrapped = true;
      console.log('[07-FIX20] mtab wrappé pour renderSocialTab');
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', doWrap);
    } else { doWrap(); }
  })();

  // Wrapper refreshScreen pour S-media
  (function _rjWrapRefreshForSocial() {
    function doWrap() {
      if (typeof window.refreshScreen !== 'function') {
        setTimeout(doWrap, 500); return;
      }
      if (window.refreshScreen._rjSocialWrapped) return;
      var orig = window.refreshScreen;
      window.refreshScreen = function(screenId) {
        var r = orig.apply(this, arguments);
        try {
          if (screenId === 'S-media') {
            // Injecter le bouton "Poster" dans le header de S-media
            setTimeout(_rjInjectSocialPostButton, 50);
            // Si l'onglet réseaux est actif, le rendre
            var reseauxTab = document.querySelector('#S-media .tab[data-tab="reseaux"].on');
            if (reseauxTab && typeof renderSocialTab === 'function') renderSocialTab();
          }
        } catch(e) { console.warn('[07-FIX20] refresh social:', e); }
        return r;
      };
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

    wrap.innerHTML = '<div style="margin-bottom:10px;padding:12px 14px;background:rgba(131,58,180,.08);border:1px solid rgba(131,58,180,.25);border-radius:12px">'
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
    var baseStyle = 'padding:10px 14px;border-radius:10px;font-size:12px;font-weight:700;font-family:var(--font-display);cursor:pointer;text-align:left;width:100%;border:none;transition:opacity .15s;';
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
