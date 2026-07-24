// === Racing Journey: F1 Dreams ===
// Module 29 — Média consolidé
// -----------------------------------------------------------------------------
// Regroupe deux anciens modules média, sans modification de leur logique.
// Chacun reste une IIFE indépendante (portées isolées) :
//   - 17-media-press     (« Le Paddock » : espace presse/média, enveloppe mtab)
//   - 25-media-preseason (feed social de pré-saison, enveloppe generateWeeklySocialFeed)
// Position de chargement : après 05 (définit mtab + generateWeeklySocialFeed) et
// après 07 (qui enveloppe mtab), pour que le wrap de 17 reste le plus externe.
// Réversibilité : remplacer ce fichier par les deux originaux dans index.html.
// -----------------------------------------------------------------------------



// ===================================================================

// ===== Bloc intégré : 17-media-press.js =====

// ===================================================================

/* =============================================================================
 * 17-media-press.js — LE PADDOCK : espace presse & médias
 * =============================================================================
 *
 * OBJECTIF
 * --------
 * Ajouter, dans l'écran des réseaux sociaux (S-media), un onglet « Médias »
 * façon journal du paddock, qui regroupe l'actualité du sport :
 *   - UNE      : le gros titre du moment (centré sur le joueur + le paddock)
 *   - RÉSULTATS: les vainqueurs des différentes catégories (F1, F2, F3,
 *                IndyCar, WEC, Super Formula… + la catégorie du joueur)
 *   - TRANSFERTS: signatures, rumeurs, éviction (réutilise le module 14)
 *   - TECHNIQUE : les écuries qui apportent des évolutions
 *   - EN BREF   : brèves issues du fil de presse existant (SOCIAL_FEED)
 *
 * SOURCES
 * -------
 *   - État réel : G.races (dernier résultat), G.champPos/champPts, G.rivals,
 *     TEAM_OFFERS[cat] (écuries), SOCIAL_FEED (brèves presse), et le module 14
 *     (G._entityMemory.td14.lastFired) pour les évictions.
 *   - Génération procédurale DÉTERMINISTE par semaine (graine = saison·semaine)
 *     pour les vainqueurs des autres catégories et les évolutions techniques :
 *     le « numéro » reste stable toute la semaine, puis change.
 *
 * ARCHITECTURE (Option A — aucun fichier cœur modifié)
 * ----------------------------------------------------
 *   - Injection DOM d'un onglet + d'un panneau dans #S-media (pas d'édition HTML).
 *   - Wrap de `mtab` pour gérer le nouvel onglet « presse ».
 *   - Numéro mémorisé dans G._entityMemory.press17 (persisté par le save).
 *   - Pattern bootstrap/retry, idempotent, try/catch partout.
 *
 * ORDRE DE CHARGEMENT : après 03/05 (mtab, SOCIAL_FEED) et 14 (évictions).
 * ===========================================================================*/
(function () {
  'use strict';
  var TAG = '[17-media-press]';

  function fn(name) { return typeof window[name] === 'function'; }
  function G_() { return (typeof window !== 'undefined' && window.G) ? window.G : null; }

  /* ---- PRNG déterministe (graine = saison·semaine) ---- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
  function pickN(rng, arr, n) {
    var copy = arr.slice(), out = [];
    while (copy.length && out.length < n) out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
    return out;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function lastName(full) { var p = String(full || '').trim().split(/\s+/); return p[p.length - 1] || full; }

  /* ---- Pools de noms par catégorie (immersion) ---- */
  var CAT_POOLS = {
    'Formule 1': ['Max Verstappen', 'Lando Norris', 'Charles Leclerc', 'George Russell', 'Oscar Piastri', 'Lewis Hamilton'],
    'Formule 2': ['Oliver Bearman', 'Victor Martins', 'Zane Maloney', 'Gabriel Bortoleto', 'Paul Aron'],
    'Formule 3': ['Gabriele Min\u00ec', 'Luke Browning', 'Leonardo Fornaroli', 'Arvid Lindblad'],
    'Formula Regional': ['Rafael Camara', 'Kean Nakamura', 'Tim Tramnitz', 'Nikola Tsolov'],
    'IndyCar': ['Alex Palou', "Pato O'Ward", 'Scott Dixon', 'Colton Herta', 'Will Power'],
    'Endurance WEC': ['S\u00e9bastien Buemi', 'Kevin Estre', 'Antonio Giovinazzi', 'Brendon Hartley'],
    'Super Formula': ['Tomoki Nojiri', 'Ritomo Miyata', 'Sho Tsuboi', 'Liam Lawson']
  };
  var TECH_PARTS = [
    'un nouveau fond plat', 'un aileron arri\u00e8re revu', 'une \u00e9volution moteur',
    'un package a\u00e9ro inédit', 'de nouveaux \u00e9carteurs de freins', 'une suspension arri\u00e8re redessin\u00e9e',
    'un diffuseur retravaill\u00e9', 'des \u00e9coppes de refroidissement r\u00e9vis\u00e9es', 'un plancher \u00e9volu\u00e9'
  ];
  var TECH_VERDICTS = [
    'Les premiers retours en piste sont encourageants.',
    'L\u2019\u00e9quipe attend confirmation en course.',
    'Les rivaux observent de pr\u00e8s.',
    'Un gain estim\u00e9 de quelques diximes au tour.',
    'Le paddock parle d\u2019un possible tournant de saison.'
  ];
  var TRANSFER_TEMPLATES = [
    function (d, t) { return '<strong>' + esc(lastName(d)) + '</strong> serait courtis\u00e9 par ' + esc(t) + '.'; },
    function (d, t) { return 'Rumeur : ' + esc(t) + ' aurait approch\u00e9 <strong>' + esc(lastName(d)) + '</strong> pour la saison prochaine.'; },
    function (d, t) { return '<strong>' + esc(lastName(d)) + '</strong> proche d\u2019un accord avec ' + esc(t) + ', selon le paddock.'; },
    function (d, t) { return 'Des discussions seraient en cours entre <strong>' + esc(lastName(d)) + '</strong> et ' + esc(t) + '.'; }
  ];
  var PRESS_SOURCES = ['Paddock Insider', 'Pit Lane Times', 'Le Tour de Piste', 'Apex Magazine', 'Motorsport Daily', 'Box Box News'];

  /* ----------------------------------------------------------------------- *
   *  Génération du « numéro » de la semaine
   * ----------------------------------------------------------------------- */
  function weekKey() {
    var G = G_(); if (!G) return '0-0';
    return (G.saison || 1) + '-' + (G.semaine || G.week || 0);
  }

  function teamsForCat() {
    var G = G_(); if (!G) return [];
    var teams = [];
    try {
      if (typeof window.TEAM_OFFERS !== 'undefined' && window.TEAM_OFFERS[G.cat]) {
        teams = window.TEAM_OFFERS[G.cat].map(function (o) { return o.team; });
      }
    } catch (e) { /* no-op */ }
    if (!teams.length && G.rivals) {
      G.rivals.forEach(function (r) { if (r.team && r.team !== 'Ind\u00e9pendant' && teams.indexOf(r.team) < 0) teams.push(r.team); });
    }
    if (G.currentTeam && G.currentTeam !== 'Ind\u00e9pendant' && teams.indexOf(G.currentTeam) < 0) teams.push(G.currentTeam);
    return teams;
  }

  function generateIssue() {
    var G = G_(); if (!G) return null;
    var key = weekKey();
    var seed = (G.saison || 1) * 1000 + (G.semaine || G.week || 0) * 7 + 13;
    var rng = mulberry32(seed);

    var playerName = (G.pilot ? ((G.pilot.prenom ? G.pilot.prenom + ' ' : '') + (G.pilot.nom || '')) : 'le pilote');
    var cat = G.cat || 'Formule 4';

    // ----- RÉSULTATS : vainqueurs par catégorie -----
    var results = [];
    // Catégorie du joueur d'abord (résultat réel si dispo).
    var lastRace = (G.races && G.races.length) ? G.races[G.races.length - 1] : null;
    var catWinner;
    if (lastRace && lastRace.pos === 1) catWinner = playerName;
    else if (G.rivals && G.rivals.length) {
      var sorted = G.rivals.slice().filter(function (r) { return r.name; }).sort(function (a, b) { return (b.pts || 0) - (a.pts || 0); });
      catWinner = sorted.length ? sorted[0].name : pick(rng, CAT_POOLS['Formule 3']);
    } else catWinner = pick(rng, CAT_POOLS['Formule 3']);
    results.push({ cat: cat, winner: catWinner, you: (catWinner === playerName) });

    // Autres catégories (4 tirées).
    var otherCats = Object.keys(CAT_POOLS).filter(function (c) { return c !== cat; });
    pickN(rng, otherCats, 4).forEach(function (c) {
      results.push({ cat: c, winner: pick(rng, CAT_POOLS[c]), you: false });
    });

    // ----- TRANSFERTS -----
    var transfers = [];
    // Éviction réelle (module 14).
    try {
      var lf = G._entityMemory && G._entityMemory.td14 && G._entityMemory.td14.lastFired;
      if (lf && lf.team) transfers.push('<strong>Officiel</strong> : ' + esc(playerName) + ' et ' + esc(lf.team) + ' mettent fin \u00e0 leur collaboration.');
    } catch (e) { /* no-op */ }
    // Rumeurs procédurales à partir des rivaux + écuries.
    var teams = teamsForCat();
    var ridx = (G.rivals || []).filter(function (r) { return r.name; });
    if (ridx.length && teams.length) {
      var picks = pickN(rng, ridx, Math.min(3, ridx.length));
      picks.forEach(function (r) {
        var t = pick(rng, teams.filter(function (x) { return x !== r.team; }).concat(teams));
        var tmpl = pick(rng, TRANSFER_TEMPLATES);
        transfers.push(tmpl(r.name, t));
      });
    }
    if (!transfers.length) transfers.push('March\u00e9 des transferts calme cette semaine. Le paddock retient son souffle.');

    // ----- TECHNIQUE -----
    var tech = [];
    var techTeams = pickN(rng, teams.length ? teams : ['L\u2019\u00e9curie de t\u00eate'], Math.min(3, Math.max(1, teams.length)));
    techTeams.forEach(function (tm) {
      tech.push('<strong>' + esc(tm) + '</strong> introduit ' + pick(rng, TECH_PARTS) + '. ' + pick(rng, TECH_VERDICTS));
    });

    // ----- UNE (gros titre) -----
    var champPos = G.champPos || null, champPts = G.champPts || 0;
    var une;
    if (lastRace && lastRace.pos === 1) une = { h: esc(playerName) + ' s\u2019impose en ' + esc(cat) + ' !', s: 'Une victoire qui change la dynamique de la saison.' };
    else if (lastRace && lastRace.pos && lastRace.pos <= 3) une = { h: 'Podium pour ' + esc(playerName) + ' en ' + esc(cat), s: 'P' + lastRace.pos + ' \u2014 le pilote confirme sa mont\u00e9e en puissance.' };
    else if (champPos && champPos <= 3) une = { h: esc(playerName) + ' dans le top 3 du championnat ' + esc(cat), s: 'Avec ' + champPts + ' pts, la bataille pour le titre fait rage.' };
    else if (results[0]) une = { h: esc(lastName(results[0].winner)) + ' fait la loi en ' + esc(cat), s: 'Le reste du plateau cherche la parade.' };
    else une = { h: 'Le paddock en \u00e9bullition', s: 'Toute l\u2019actualit\u00e9 du sport auto cette semaine.' };
    une.source = pick(rng, PRESS_SOURCES);

    // ----- EN BREF (depuis le fil de presse existant) -----
    var briefs = [];
    try {
      if (typeof window.SOCIAL_FEED !== 'undefined' && window.SOCIAL_FEED && window.SOCIAL_FEED.length) {
        window.SOCIAL_FEED.filter(function (p) { return p && (p.type === 'press' || p.type === 'team') && p.body; })
          .slice(0, 4).forEach(function (p) {
            briefs.push({ src: p.author || pick(rng, PRESS_SOURCES), body: String(p.body).slice(0, 180) });
          });
      }
    } catch (e) { /* no-op */ }

    var issue = { key: key, saison: G.saison || 1, semaine: G.semaine || G.week || 0, une: une, results: results, transfers: transfers, tech: tech, briefs: briefs };
    if (!G._entityMemory) G._entityMemory = {};
    G._entityMemory.press17 = issue;
    return issue;
  }

  function getIssue() {
    var G = G_(); if (!G) return null;
    var cached = G._entityMemory && G._entityMemory.press17;
    if (cached && cached.key === weekKey()) return cached;
    return generateIssue();
  }

  /* ----------------------------------------------------------------------- *
   *  Rendu de l'onglet « Médias »
   * ----------------------------------------------------------------------- */
  var FLAG = '#A78BFA';
  function sectionTitle(txt) {
    return '<div style="margin:18px 16px 8px;display:flex;align-items:center;gap:8px">'
      + '<span style="width:3px;height:13px;background:' + FLAG + ';border-radius:2px"></span>'
      + '<span style="font-family:var(--font-display);font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--text2)">' + esc(txt) + '</span>'
      + '</div>';
  }
  function catBadge(cat) {
    return '<span style="flex-shrink:0;font-family:var(--font-display);font-size:9px;font-weight:800;letter-spacing:.04em;padding:2px 7px;border-radius:5px;background:rgba(167,139,250,.14);color:' + FLAG + ';border:1px solid rgba(167,139,250,.3)">' + esc(cat) + '</span>';
  }

  function renderPress() {
    var host = document.getElementById('mt-presse');
    if (!host) return;
    var issue = getIssue();
    if (!issue) { host.innerHTML = '<div style="padding:20px;color:var(--text3);font-size:13px">Aucune actualit\u00e9 disponible.</div>'; return; }

    var html = '';

    // En-tête journal
    html += '<div style="margin:10px 16px 0;padding:14px;border-radius:14px;background:linear-gradient(135deg,rgba(167,139,250,.12),rgba(167,139,250,.03));border:1px solid rgba(167,139,250,.32)">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">'
      + '<span style="font-family:var(--font-display);font-size:15px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:' + FLAG + '">Le Paddock</span>'
      + '<span style="font-size:10px;color:var(--text3);letter-spacing:.05em">Saison ' + issue.saison + ' · Sem. ' + issue.semaine + '</span>'
      + '</div>'
      + '<div style="font-family:var(--font-display);font-size:18px;font-weight:900;line-height:1.18;color:var(--white)">' + issue.une.h + '</div>'
      + '<div style="font-size:12.5px;color:var(--text2);line-height:1.45;margin-top:5px">' + issue.une.s + '</div>'
      + '<div style="font-size:10px;color:var(--text3);margin-top:7px;font-style:italic">— ' + esc(issue.une.source) + '</div>'
      + '</div>';

    // Résultats / vainqueurs
    html += sectionTitle('R\u00e9sultats \u00b7 Vainqueurs');
    html += '<div style="margin:0 16px;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--surface2)">';
    issue.results.forEach(function (r, i) {
      html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;' + (i ? 'border-top:1px solid rgba(255,255,255,.05)' : '') + (r.you ? ';background:rgba(167,139,250,.07)' : '') + '">'
        + catBadge(r.cat)
        + '<span style="flex:1;min-width:0;font-size:13px;color:var(--text);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(r.winner) + (r.you ? ' <span style="color:' + FLAG + ';font-weight:800">(toi !)</span>' : '') + '</span>'
        + '<span style="flex-shrink:0;font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em">Vainqueur</span>'
        + '</div>';
    });
    html += '</div>';

    // Transferts
    html += sectionTitle('Transferts & rumeurs');
    html += '<div style="margin:0 16px;display:flex;flex-direction:column;gap:7px">';
    issue.transfers.forEach(function (t) {
      html += '<div style="padding:11px 12px;border:1px solid var(--border);border-radius:11px;background:var(--surface2);font-size:12.5px;color:var(--text2);line-height:1.45">' + t + '</div>';
    });
    html += '</div>';

    // Technique
    html += sectionTitle('Technique \u00b7 \u00c9volutions');
    html += '<div style="margin:0 16px;display:flex;flex-direction:column;gap:7px">';
    issue.tech.forEach(function (t) {
      html += '<div style="padding:11px 12px;border:1px solid var(--border);border-radius:11px;background:var(--surface2);border-left:3px solid ' + FLAG + ';font-size:12.5px;color:var(--text2);line-height:1.45">' + t + '</div>';
    });
    html += '</div>';

    // En bref
    if (issue.briefs && issue.briefs.length) {
      html += sectionTitle('En bref');
      html += '<div style="margin:0 16px;display:flex;flex-direction:column;gap:7px">';
      issue.briefs.forEach(function (b) {
        html += '<div style="padding:10px 12px;border:1px solid var(--border);border-radius:11px;background:var(--surface2)">'
          + '<div style="font-size:10px;color:' + FLAG + ';font-weight:700;letter-spacing:.04em;margin-bottom:3px">' + esc(b.src) + '</div>'
          + '<div style="font-size:12px;color:var(--text2);line-height:1.45">' + esc(b.body) + '</div>'
          + '</div>';
      });
      html += '</div>';
    }

    html += '<div style="height:30px"></div>';
    host.innerHTML = html;
  }

  /* ----------------------------------------------------------------------- *
   *  Injection de l'onglet dans S-media + wrap de mtab
   * ----------------------------------------------------------------------- */
  function injectTab() {
    var media = document.getElementById('S-media');
    if (!media) return false;
    if (document.getElementById('mt-presse')) return true; // déjà injecté

    var tabs = media.querySelector('.tabs');
    var scroll = media.querySelector('.scroll');
    if (!tabs || !scroll) return false;

    // Bouton d'onglet
    var btn = document.createElement('button');
    btn.className = 'tab';
    btn.setAttribute('data-tab', 'presse');
    btn.textContent = 'M\u00e9dias';
    btn.onclick = function () { if (fn('mtab')) window.mtab('presse'); };
    tabs.appendChild(btn);

    // Panneau de contenu
    var panel = document.createElement('div');
    panel.id = 'mt-presse';
    panel.style.display = 'none';
    scroll.appendChild(panel);
    return true;
  }

  function wrapMtab() {
    if (!fn('mtab') || window.mtab._td17) return false;
    var orig = window.mtab;
    window.mtab = function (e) {
      var r;
      try { r = orig.apply(this, arguments); } catch (err) { console.warn(TAG, 'mtab orig:', err); }
      try {
        var panel = document.getElementById('mt-presse');
        if (panel) {
          if (e === 'presse') { panel.style.display = 'block'; renderPress(); }
          else { panel.style.display = 'none'; }
        }
        // Garde l'état actif visuel cohérent
        var media = document.getElementById('S-media');
        if (media) media.querySelectorAll('.tab').forEach(function (t) {
          t.classList.toggle('on', t.getAttribute('data-tab') === e);
        });
      } catch (err) { console.warn(TAG, 'mtab wrap:', err); }
      return r;
    };
    window.mtab._td17 = true;
    return true;
  }

  function install() {
    var okTab = injectTab();
    var okWrap = wrapMtab();
    return okTab && okWrap;
  }

  function boot(retries) {
    if (typeof window === 'undefined') return;
    // On a besoin que #S-media existe et que mtab soit défini.
    if (document.getElementById('S-media') && fn('mtab')) {
      install();
      // Régénère le numéro à chaque nouvelle semaine, même sans ouvrir l'onglet.
      if (Array.isArray(window.WEEKLY_TICK_HOOKS) && !window._td17Hooked) {
        window._td17Hooked = true;
        window.WEEKLY_TICK_HOOKS.push({
          id: 'td17_press', run: function () {
            try {
              var G = G_();
              if (G && G._entityMemory && G._entityMemory.press17 && G._entityMemory.press17.key !== weekKey()) {
                generateIssue();
              }
            } catch (e) { /* no-op */ }
          }
        });
      }
      // Réinjecte si le DOM est reconstruit plus tard.
      setTimeout(install, 1500);
      window.rjDebugMediaPress = function () { console.log(TAG, getIssue()); };
      console.log(TAG, 'activé — onglet M\u00e9dias (Le Paddock) dans l\u2019\u00e9cran r\u00e9seaux. Debug: rjDebugMediaPress()');
      return;
    }
    if (retries > 0) { setTimeout(function () { boot(retries - 1); }, 400); return; }
    console.warn(TAG, 'abandon — #S-media ou mtab introuvable.');
  }

  boot(60);
})();



// ===================================================================

// ===== Bloc intégré : 25-media-preseason.js =====

// ===================================================================

/* =============================================================================
 * 25-media-preseason.js — MÉDIAS DE PRÉ-SAISON RÉALISTES
 * =============================================================================
 *
 * PROBLÈME (cause racine)
 * -----------------------
 * Le fil social/presse est rempli par generateWeeklySocialFeed() (05). Or :
 *   - _genPressPost() sort des phrases qui supposent la saison EN COURS
 *     (« le classement constructeurs continue de se dessiner », « avant la
 *     prochaine manche »…) → absurde AVANT la 1ʳᵉ course.
 *   - _genDriverPost / _genFanPost évoquent des résultats déjà acquis
 *     (« on a rien lâché », « cette saison est DINGUE jusqu'ici »…).
 *   - _simulateOtherCatEvents() IGNORE son paramètre et fabrique ~40 % du temps
 *     un vainqueur d'une autre catégorie → « X s'impose en F1 » même hors course.
 *
 * CORRECTION
 * ----------
 * Tant qu'aucune course de la saison n'a eu lieu (fenêtre de pré-saison), on :
 *   1. neutralise les faux résultats (_simulateOtherCatEvents → []),
 *   2. remplace le flavor des posts pilote/écurie/fan/presse par du contenu de
 *      pré-saison (préparation hivernale, présentation, pronostics…),
 *   3. injecte de vraies PREVIEWS DE TITRE : favoris, cotes et outsiders calculés
 *      à partir du niveau pilote (stats joueur / skill rivaux) ET de la force de
 *      la voiture (getTeamRatings). On signale aussi un changement de règlement
 *      le cas échéant.
 * Hors pré-saison, tout le comportement d'origine est conservé tel quel.
 *
 * ARCHITECTURE : Option A — wraps non destructifs, idempotents, réversibles.
 * ORDRE DE CHARGEMENT : après 05 (generateWeeklySocialFeed + générateurs).
 * ===========================================================================*/
(function () {
  'use strict';
  var TAG = '[25-media-preseason]';

  function G() { return window.G; }
  function rnd(a) { return a[Math.floor(Math.random() * a.length)]; }
  function fnOk(n) { return typeof window[n] === 'function'; }

  /* ---- Détection de la fenêtre de pré-saison ---------------------------- */
  function firstRaceWeek() {
    var cr = window.CAL_RACES;
    if (!cr || !cr.length) return 9999;
    var w = 9999;
    for (var i = 0; i < cr.length; i++) if (typeof cr[i].week === 'number' && cr[i].week < w) w = cr[i].week;
    return w;
  }
  function anyRaceDone() {
    var cr = window.CAL_RACES || [];
    for (var i = 0; i < cr.length; i++) if (cr[i].done) return true;
    return false;
  }
  function isPreSeason() {
    var g = G();
    if (!g || !window.CAL_RACES || !window.CAL_RACES.length) return false;
    return !anyRaceDone() && (g.semaine || 0) < firstRaceWeek();
  }

  /* ---- Niveau pilote / voiture → cotes de titre ------------------------- */
  function playerOverall() {
    var g = G();
    if (!g || !g.stats) return 70;
    var keys = ['vitesse', 'attaque', 'regularite', 'sangfroid', 'pneus', 'strategie', 'physique', 'adapt'];
    var sum = 0, n = 0;
    keys.forEach(function (k) { if (typeof g.stats[k] === 'number') { sum += g.stats[k]; n++; } });
    return n ? sum / n : 70;
  }
  function teamRating(team) {
    if (!team) return 72;
    try {
      var tr = fnOk('getTeamRatings') ? window.getTeamRatings() : null;
      if (tr && typeof tr[team] === 'number') return tr[team];
    } catch (e) {}
    return 72;
  }
  function playerName() {
    var p = G() && G().pilot ? G().pilot : {};
    return ((p.prenom ? p.prenom + ' ' : '') + (p.nom || 'Pilote')).trim();
  }

  // Liste triée des prétendants avec score combiné pilote+voiture et cote en %.
  function contenders() {
    var g = G();
    if (!g) return [];
    var list = [];
    list.push({ name: playerName(), team: g.currentTeam || null, skill: playerOverall(), isPlayer: true });
    (g.rivals || []).forEach(function (r) {
      list.push({ name: r.name, team: r.team || null, skill: (typeof r.skill === 'number' ? r.skill : 72), consistency: r.consistency });
    });
    list.forEach(function (c) {
      var car = teamRating(c.team);
      // pondération : pilote 58 % / voiture 42 %, petit bonus de régularité
      c.car = car;
      c.score = 0.58 * c.skill + 0.42 * car + (typeof c.consistency === 'number' ? (c.consistency - 70) * 0.04 : 0);
    });
    list.sort(function (a, b) { return b.score - a.score; });
    // cotes via softmax (température pour étaler)
    var T = 3.5, max = list.length ? list[0].score : 0, denom = 0;
    list.forEach(function (c) { c._e = Math.exp((c.score - max) / T); denom += c._e; });
    list.forEach(function (c) { c.odds = denom ? Math.round(c._e / denom * 100) : 0; });
    return list;
  }

  function regulationReset() {
    // 04 pose TEAM_RATINGS[cat_saison + "_reset"] quand le règlement change.
    try {
      var g = G(), key = g.cat + '_' + g.saison + '_reset';
      return !!(window.TEAM_RATINGS && window.TEAM_RATINGS[key]);
    } catch (e) { return false; }
  }

  /* ---- Générateurs de pré-saison ---------------------------------------- */
  function preseasonPress() {
    var g = G(), cat = (g && g.cat) || 'la catégorie';
    var c = contenders();
    var top = c.slice(0, 3).map(function (x) { return x.name; });
    var pool = [
      { w: 4, t: 'PRÉSAISON — Sur le papier, ' + (top[0] || 'les favoris') + ' part avec les faveurs des pronostics en ' + cat + ' cette saison.' },
      { w: 3, t: 'ANALYSE — ' + (top[0] || 'le favori') + ' et ' + (top[1] || 'son rival') + ' devraient se disputer le titre, mais ' + (top[2] || 'un outsider') + ' n\u2019est pas loin.' },
      { w: 3, t: 'Avant le coup d\u2019envoi : les essais hivernaux ont rebattu les cartes. Notre grille des forces en présence est en ligne.' },
      { w: 2, t: 'Mercato bouclé, livrées dévoilées : place aux choses sérieuses. Qui pour le titre ' + cat + ' ?' },
      { w: 2, t: 'OPINION — Une grille jamais aussi dense. Le moindre détail fera la différence dès la première manche.' }
    ];
    if (regulationReset()) pool.push({ w: 4, t: 'RÈGLEMENT — Nouvelle réglementation cette saison : la hiérarchie est totalement rebattue. Tout est possible.' });
    var tot = 0; pool.forEach(function (p) { tot += p.w; });
    var r = Math.random() * tot;
    for (var i = 0; i < pool.length; i++) { if ((r -= pool[i].w) <= 0) return pool[i].t; }
    return pool[0].t;
  }

  function preseasonDriver() {
    return rnd([
      'Travail hivernal bouclé. Prêt à attaquer cette nouvelle saison. ',
      'Hâte de retrouver la piste. Les sensations au volant m\u2019ont manqué.',
      'Préparation physique au top, mental affûté. On vise haut cette année.',
      'Nouvelle saison, nouvelle page. L\u2019objectif est clair dans ma tête.',
      'Premiers tours de roue lors des essais : la voiture répond bien. À confirmer en course.',
      'Reconnaissance des circuits et debrief data toute la semaine. On ne laisse rien au hasard.'
    ]);
  }

  function preseasonTeam(name) {
    return rnd([
      'Présentation de notre livrée cette semaine ! Hâte de vous montrer ça.',
      'Essais hivernaux terminés : données encourageantes, le bureau d\u2019études a bien bossé.',
      'Nouvelle saison qui arrive. Toute l\u2019équipe est mobilisée pour le premier rendez-vous.',
      'Roll-out réussi à l\u2019usine. La voiture a tourné sans souci, prochaine étape : la piste.',
      'Objectifs annoncés en interne. On y croit. Merci à nos partenaires de nous suivre dans l\u2019aventure.'
    ]);
  }

  function preseasonFan() {
    return rnd([
      'Vivement le début de saison, les pronostics vont bon train ',
      'Cette grille s\u2019annonce ULTRA relevée cette année, j\u2019ai trop hâte',
      'Pré-saison = la meilleure période pour rêver. Mon favori va tout casser je le sens',
      'Les essais hivernaux disent rien mais on s\u2019enflamme quand même, c\u2019est ça qu\u2019on aime',
      'Qui voyez-vous champion cette année ? Moi j\u2019ai mon idée mais je dis rien ',
      'Nouvelle livrée = nouveau fond d\u2019écran. Les designers ont assuré cette année'
    ]);
  }

  // Posts de PREVIEW dédiés (favoris + cotes + outsider) injectés une fois/semaine.
  function injectTitlePreview() {
    if (!fnOk('_addFeedPost')) return;
    var g = G();
    var press = window.SOCIAL_PRESS_ACCOUNTS && window.SOCIAL_PRESS_ACCOUNTS.length
      ? rnd(window.SOCIAL_PRESS_ACCOUNTS) : { name: 'Paddock Insider', handle: '@paddockinsider', color: '#60A5FA' };
    var c = contenders();
    if (!c.length) return;
    var fav = c[0], second = c[1], dark = c.length > 3 ? c[3] : (c[2] || c[0]);

    // 1) cotes des prétendants
    var oddsTxt = c.slice(0, 3).map(function (x) { return x.name + ' ' + x.odds + '%'; }).join(' · ');
    window._addFeedPost({
      type: 'press', author: press.name, handle: press.handle, color: press.color,
      body: 'COTES TITRE ' + (g.cat || '') + ' — Nos prédictions avant le départ : ' + oddsTxt + '. Tout reste à faire.'
    });

    // 2) favori + voiture à battre
    var press2 = window.SOCIAL_PRESS_ACCOUNTS && window.SOCIAL_PRESS_ACCOUNTS.length ? rnd(window.SOCIAL_PRESS_ACCOUNTS) : press;
    var carLine = fav.team ? ' ' + fav.team + ' semble disposer d\u2019un des meilleurs packages.' : '';
    window._addFeedPost({
      type: 'press', author: press2.name, handle: press2.handle, color: press2.color,
      body: 'FAVORI — ' + fav.name + ' s\u2019annonce comme l\u2019homme à battre cette saison.' + carLine
        + (dark && dark.name !== fav.name ? ' Outsider à surveiller : ' + dark.name + '.' : '')
    });

    // 3) éclairage joueur s'il n'est pas déjà tout en haut
    var pIdx = c.findIndex(function (x) { return x.isPlayer; });
    if (pIdx > 1) {
      var press3 = window.SOCIAL_PRESS_ACCOUNTS && window.SOCIAL_PRESS_ACCOUNTS.length ? rnd(window.SOCIAL_PRESS_ACCOUNTS) : press;
      var msg = pIdx <= 4
        ? playerName() + ' fait partie des prétendants crédibles selon nos experts. À lui de le confirmer en piste.'
        : playerName() + ' devra hausser le ton pour exister dans une grille aussi relevée.';
      window._addFeedPost({ type: 'press', author: press3.name, handle: press3.handle, color: press3.color, body: msg });
    }
  }

  /* ---- Installation des wraps ------------------------------------------- */
  function wrap(name, builder) {
    if (!fnOk(name)) return false;
    if (window[name]._ps25) return true;
    var orig = window[name];
    window[name] = function () {
      try { if (isPreSeason()) return builder.apply(this, arguments); } catch (e) {}
      return orig.apply(this, arguments);
    };
    window[name]._ps25 = true;
    return true;
  }

  function install() {
    if (!fnOk('generateWeeklySocialFeed')) return false;

    wrap('_genPressPost', function () { return preseasonPress(); });
    wrap('_genDriverPost', function () { return preseasonDriver(); });
    wrap('_genTeamPost', function (n) { return preseasonTeam(n); });
    wrap('_genFanPost', function () { return preseasonFan(); });
    // pas de faux résultats d'autres catégories avant le départ
    wrap('_simulateOtherCatEvents', function () { return []; });

    if (!window.generateWeeklySocialFeed._ps25) {
      var origGen = window.generateWeeklySocialFeed;
      window._lastPreviewInject = window._lastPreviewInject || { saison: -1, week: -1 };
      window.generateWeeklySocialFeed = function () {
        var g = G();
        var need = !window.LAST_FEED_GEN_WEEK ||
          window.LAST_FEED_GEN_WEEK.saison !== g.saison || window.LAST_FEED_GEN_WEEK.week !== g.semaine;
        var ret = origGen.apply(this, arguments);
        try {
          if (need && isPreSeason() &&
              (window._lastPreviewInject.saison !== g.saison || window._lastPreviewInject.week !== g.semaine)) {
            window._lastPreviewInject = { saison: g.saison, week: g.semaine };
            injectTitlePreview();
          }
        } catch (e) { console.warn(TAG, 'inject preview:', e && e.message); }
        return ret;
      };
      window.generateWeeklySocialFeed._ps25 = true;
    }

    window.rjDebugPreseason = function () {
      console.log(TAG, 'préSaison =', isPreSeason(), '| 1ʳᵉ course semaine', firstRaceWeek(), '| semaine', G() && G().semaine);
      console.log(TAG, 'cotes:', contenders().slice(0, 6).map(function (c) { return c.name + ' ' + c.odds + '% (pilote ' + Math.round(c.skill) + '/voiture ' + Math.round(c.car) + ')'; }));
    };
    return true;
  }

  function boot(retries) {
    if (typeof window === 'undefined') return;
    if (install()) {
      console.log(TAG, 'activé — previews de titre en pré-saison (résultats neutralisés avant la 1ʳᵉ course). Debug: rjDebugPreseason()');
      return;
    }
    if (retries > 0) { setTimeout(function () { boot(retries - 1); }, 400); return; }
    console.warn(TAG, 'abandon — generateWeeklySocialFeed introuvable.');
  }

  boot(50);
})();

