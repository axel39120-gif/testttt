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
      return startY + ((saison == null ? 1 : saison) - 1);
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

  /* v302 : l'écurie avec son logo. */
  function _ecurie(t) {
    var svg = t && window.TEAM_LOGOS && TEAM_LOGOS[t];
    return '<span class="eq">' + (svg || '') + _safeEsc(t || '—') + '</span>';
  }

  /* v302 : la carrière ENTIÈRE d'un pilote. Les saisons qu'il a courues hors de la
     catégorie du joueur, ou avant le début de la partie, sont reconstituées :
     toujours les mêmes (tirage fixé par le nom), cohérentes avec son âge, sa
     catégorie connue la plus proche et son niveau. */
  var ECHELLE = ["Karting Junior", "Karting Senior", "Formule 4", "Formula Regional", "Formule 3", "Formule 2", "Formule 1"];
  var ARRIVEE = [10, 13, 15, 17, 18, 20, 22];          // âge habituel d'arrivée
  var MANCHES = { "Karting Junior": 8, "Karting Senior": 10, "Formule 4": 14, "Formula Regional": 18, "Formule 3": 18, "Formule 2": 24, "Formule 1": 22, "Super Formula": 12, "Endurance WEC": 8, "IndyCar": 17 };
  var BAREME = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  function _tirage(t) { var h = 2166136261; t = String(t); for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; }
  function _ecuriesDe(cat) {
    var L = (typeof TEAM_OFFERS !== 'undefined' && TEAM_OFFERS[cat] || []).map(function (t) { return t.team; });
    return L.length ? L : ['Indépendant'];
  }
  function _saisonReconstituee(nom, saison, cat, niveau, suivante) {
    var r = _tirage(nom + saison + cat), n = MANCHES[cat] || 14, L = _ecuriesDe(cat);
    var pos = Math.max(1, Math.min(20, Math.round(1 + (1 - niveau) * 12 + r * 7)));
    var moyen = BAREME[Math.min(9, pos - 1)] * .72, wins = pos <= 4 ? Math.round(n * [.42, .22, .12, .06][pos - 1] * (.7 + r * .6)) : 0;
    // deux saisons de suite dans la même catégorie : même écurie deux fois sur trois
    var team = suivante && suivante.cat === cat && suivante.team && r < .66 ? suivante.team : cat === "Karting Junior" ? "Indépendant" : L[Math.floor(_tirage(nom + cat + Math.floor(saison / 2)) * L.length)];
    return { saison: saison, cat: cat, team: team, pos: pos, pts: pos > 10 ? Math.round((20 - pos) * r) : Math.round(moyen * n), races: n, wins: wins, pods: pos <= 7 ? Math.min(n, wins + Math.round(n * Math.max(0, .5 - pos * .07))) : 0, _rec: true };
  }
  function _carriereComplete(rival, connu) {
    var L = connu.slice().sort(function (a, b) { return a.saison - b.saison; }), S = (window.G && G.saison) || 1, d = null;
    (Array.isArray(G.driverPool) ? G.driverPool : Object.keys(G.driverPool || {}).map(function (k) { return G.driverPool[k]; })).forEach(function (x) { if (x && x.name === rival.name) d = x; });
    var age = d && d.age, an = typeof gameYear === 'function' ? gameYear() : 2024;
    if (!age && rival.dob && rival.dob.year) age = an - rival.dob.year;
    if (!age) age = ARRIVEE[Math.max(0, ECHELLE.indexOf(G.cat))] + 2;
    var rs = G.rivals || [], rang = rs.filter(function (x) { return (x.skill || 0) > (rival.skill || 0); }).length, niveau = rs.length ? 1 - rang / rs.length : .5;
    // saisons connues mais simulées sans écurie ni nombre de courses
    L.forEach(function (h) {
      if (!h.races) h.races = MANCHES[h.cat] || 14;
      if (!h.team || h.team === "—") h.team = h.cat === "Karting Junior" ? "Indépendant" : _ecuriesDe(h.cat)[Math.floor(_tirage(rival.name + h.cat + Math.floor(h.saison / 2)) * _ecuriesDe(h.cat).length)];
    });
    var par = {}; L.forEach(function (h) { par[h.saison] = h; });
    var ref = L[0] || { saison: S, cat: G.cat, team: rival.team }, ageRef = age - (S - ref.saison);
    // à reculons, depuis la première saison connue
    var rung = ECHELLE.indexOf(ref.cat), alt = rung < 0; if (alt) rung = 5;
    var entree = Math.min(ageRef, (alt ? 23 : ARRIVEE[rung]) + Math.floor(_tirage(rival.name + "entree") * 3)), suiv = ref;
    for (var s = ref.saison - 1, a = ageRef - 1; a >= 10; s--, a--) {
      var cat = ref.cat;
      if (a < entree) {
        var avant = entree - 1 - a, i = alt ? rung + 1 : rung;      // deux saisons par échelon environ
        while (i > 0 && avant >= 0) { i--; avant -= i <= 1 ? 3 : 1 + Math.floor(_tirage(rival.name + i) * 2); }
        cat = ECHELLE[i];
        var min = typeof CAT_MIN_AGE !== 'undefined' ? CAT_MIN_AGE[cat] : undefined;
        while (min !== undefined && a < min && i > 0) { cat = ECHELLE[--i]; min = CAT_MIN_AGE[cat]; }
      }
      suiv = par[s] = _saisonReconstituee(rival.name, s, cat, niveau, suiv);
    }
    // trous entre deux saisons connues, jusqu'à la saison passée
    for (var t = ref.saison + 1; t < S; t++) if (!par[t]) par[t] = _saisonReconstituee(rival.name, t, par[t - 1].cat, niveau, par[t - 1]);
    return Object.keys(par).map(function (k) { return par[k]; });
  }
  window.RJCarriereComplete = _carriereComplete;

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
                '<td style="color:var(--text2);max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _ecurie(s.team) + '</td>' +
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
      /* v296 : toutes les saisons, pas seulement celle en cours. Un rival recréé
         à chaque saison repart avec un historique vide ; ses saisons passées
         vivent dans le registre sauvegardé et dans le vivier (d.history). */
      var vues = {}, hist = [];
      var ajouter = function (r) {
        if (!r || r.saison == null) return;
        var k = r.saison + '|' + (r.cat || '');
        if (vues[k]) return;
        vues[k] = 1; hist.push(r);
      };
      (Array.isArray(rival.careerHistory) ? rival.careerHistory : []).forEach(ajouter);
      try { (window.RIVAL_CAREER_REGISTRY && RIVAL_CAREER_REGISTRY[rival.name] || []).forEach(ajouter); } catch (e) {}
      try {
        var P = (window.G && G.driverPool) || {};
        Object.keys(P).forEach(function (cle) {
          var d = P[cle];
          if (!d || d.name !== rival.name || !Array.isArray(d.history)) return;
          d.history.forEach(function (h) {
            ajouter({ saison: h.saison, cat: h.cat, team: h.team, pos: h.finalPos, pts: h.points, wins: h.wins, pods: h.podiums, races: h.races || 0 });
          });
        });
      } catch (e) {}
      hist = _carriereComplete(rival, hist.map(function (h) { return Object.assign({}, h); }));
      hist.sort(function (a, b) { return a.saison - b.saison; });

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
                '<td style="color:var(--text2);max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _ecurie(s.team) + '</td>' +
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
