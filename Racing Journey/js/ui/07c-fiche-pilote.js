/* =====================================================================
 * 07c-fiche-pilote.js — FICHE PILOTE ET HISTORIQUE DE CARRIÈRE
 *
 * Issu de l'ancien legacy/07-user-fixes.js (« corrections demandées par
 * l'utilisateur »), rangé par domaine lors de la restructuration (T8).
 * =================================================================== */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;



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
    rjInscrire("showDriverProfileModal", { id: "07c-fiche-pilote:showDriverProfileModal", ordre: -2200, remplace: function (args, suite) {
      var opts = args[0];
      var result = suite();

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
    } });
    window.showDriverProfileModal._rjUserFixCareer = true;
    console.log('[07] showDriverProfileModal enhanced (full career history)');
    return true;
  }

  function appliquer() {
    try { wrapShowDriverProfileModal(); } catch (e) { console.warn('[07] wrapShowDriverProfileModal();', e); }
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
