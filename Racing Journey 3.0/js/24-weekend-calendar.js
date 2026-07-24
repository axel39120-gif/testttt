/* =============================================================================
 * 24-weekend-calendar.js — WEEK-ENDS MULTI-JOURS DANS LE CALENDRIER
 * =============================================================================
 *
 * PROBLÈME (cause racine)
 * -----------------------
 * Dans 04-race-engine.js, renderCal() place chaque course au jour `7×week` de
 * l'année via un helper local m(week,"race"). Comme le 1er janvier = jeudi dans
 * ce calendrier, 7×week tombe TOUJOURS un mercredi, sur UNE SEULE case. Aucune
 * notion de week-end : essais / qualif / courses sont invisibles, tout est
 * écrasé sur un jour unique.
 *
 * CORRECTION
 * ----------
 * On surcharge window.renderCal (04 n'est pas une IIFE → renderCal est global,
 * donc surchargeable proprement par un module chargé APRÈS 04). La course est
 * désormais placée le DIMANCHE de sa semaine (7×week+4) et le week-end s'étale
 * sur les jours précédents, en nombre réaliste PAR CATÉGORIE :
 *
 *   Karting 2 (Sam–Dim) · F4 3 (Ven–Dim) · Formula Regional 3 · F3 3 · F2 3 ·
 *   F1 3 (Ven–Dim) · Super Formula 2 · WEC 3 (Le Mans 4) · IndyCar 2 (Indy500 3)
 *
 * Le rendu reprend fidèlement la grille mensuelle + la liste « ce mois-ci » +
 * « Saison complète » de l'original, avec :
 *   - case course (dimanche) en bande pleine, cases d'avant en bande estompée ;
 *   - libellés en plages de dates (ex. « Ven 12 → Dim 14 Mai »).
 * La logique des ÉVÉNEMENTS planifiés est portée à l'identique de l'original.
 *
 * ARCHITECTURE : Option A — surcharge non destructive, idempotente, réversible.
 *   window._origRenderCal conserve l'original. En cas d'erreur, fallback dessus.
 *   Pour revenir à l'ancien rendu : window.renderCal = window._origRenderCal.
 * ORDRE DE CHARGEMENT : après 04 (renderCal, buildCalendar, CAL_RACES, gYear).
 * ===========================================================================*/
(function () {
  'use strict';
  var TAG = '[24-weekend-calendar]';

  // Durée réaliste du week-end (nombre de jours, course incluse) par catégorie.
  var WEEKEND_DAYS = {
    'Karting Junior': 2,
    'Karting Senior': 2,
    'Formule 4': 3,
    'Formula Regional': 3,
    'Formule 3': 3,
    'Formule 2': 3,
    'Formule 1': 3,
    'Super Formula': 2,
    'Endurance WEC': 3,
    'IndyCar': 2
  };

  var MONTHS_FULL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  var MONTHS_ABBR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
  var WD_HEAD = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  var WD_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']; // 0 = lundi
  var DPM = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  var EV_COLOR = { media: '#60A5FA', sponsors: '#F0A020', relations: '#F472B6', team: '#34D399', rivalry: '#EF4444', commerce: '#A78BFA', crisis: '#F59E0B', training: '#22D3EE' };
  var EV_LABEL = { media: 'Médias', sponsors: 'Sponsor', relations: 'Perso', team: 'Écurie', rivalry: 'Rival', commerce: 'Commerce', crisis: 'Crise', training: 'Entraîn.' };

  function clampDoy(d) { return Math.min(365, Math.max(1, d)); }
  // jour de l'année (1..365) → { m: mois 0..11, d: jour 1..31 }
  function f(doy) { var t = 0, e = doy; while (t < 11 && e > DPM[t]) { e -= DPM[t]; t++; } return { m: t, d: e }; }
  // jour de l'année → index jour de semaine (0 = lundi … 6 = dimanche). 1er janv = jeudi.
  function wd(doy) { return (doy - 1 + 3) % 7; }
  function firstDoyOfMonth(m) { var e = 1; for (var t = 0; t < m; t++) e += DPM[t]; return e; }

  // Course : dimanche de la semaine (7×week tombe un mercredi → +4 = dimanche).
  function raceEndDoy(week) { return clampDoy(7 * week + 4); }
  // Événement : décalé de quelques jours avant (logique d'origine conservée).
  function eventDoy(week) { var off = [5, 3, 1][week % 3]; return clampDoy(7 * week - off); }

  function curCat() { return (window.G && window.G.cat) ? window.G.cat : null; }

  function weekendDays(cat, raceName) {
    var n = WEEKEND_DAYS[cat] || 2;
    if (cat === 'Endurance WEC' && /le mans/i.test(raceName || '')) n = 4;
    if (cat === 'IndyCar' && /indianapolis 500|indy 500/i.test(raceName || '')) n = 3;
    return n;
  }

  function gYearSafe() { try { return (typeof window.gYear === 'function') ? window.gYear() : ''; } catch (e) { return ''; } }

  function enhancedRenderCal() {
    var G = window.G;
    if (!G) return;
    if (!window.CAL_RACES || !window.CAL_RACES.length) { try { window.buildCalendar(); } catch (e) {} }
    if (!G._scheduledEvents) { try { window.scheduleSeasonEvents(); } catch (e) {} }

    var sub = document.getElementById('cal-sub');
    if (sub) sub.textContent = G.cat + ' — ' + gYearSafe();

    var cat = G.cat;
    var N = weekendDays(cat);

    // --- Construction des « moments » par mois -----------------------------
    var byMonth = {}; for (var z = 0; z < 12; z++) byMonth[z] = [];
    var raceEndMap = {};   // doy -> raceMoment (jour de course)
    var raceLeadMap = {};  // doy -> raceMoment (jour d'avant week-end)
    var eventMap = {};     // doy -> eventMoment

    (window.CAL_RACES || []).forEach(function (r) {
      var nDays = weekendDays(cat, r.name);
      var end = raceEndDoy(r.week);
      var start = clampDoy(end - (nDays - 1));
      var ei = f(end), si = f(start);
      var mom = {
        kind: 'race', week: r.week, data: r, label: r.name, done: r.done,
        endDoy: end, startDoy: start, endInfo: ei, startInfo: si, nDays: nDays,
        manche: r.manche, isSprint: r.isSprint
      };
      byMonth[ei.m].push(mom);
      raceEndMap[end] = mom;
      for (var dd = start; dd < end; dd++) { if (!raceEndMap[dd]) raceLeadMap[dd] = mom; }
    });

    (G._scheduledEvents || []).forEach(function (se) {
      if (se.saison !== G.saison || !se.announced) return;
      var def = (window.SCHEDULED_EVENTS || []).find(function (x) { return x.id === se.eventId; });
      if (!def) return;
      var doy = eventDoy(se.week), info = f(doy);
      var ec = def.cat || 'media';
      var title = EV_LABEL[ec] || 'Événement';
      try {
        if (typeof def.gen === 'function') {
          var ctx = { rep: G.reputation || 0, cat: G.cat, budget: G.budget, saison: G.saison, semaine: G.semaine, age: G.age };
          var out = def.gen(ctx);
          if (out && out.title) title = out.title;
        }
      } catch (e) {}
      var mom = {
        kind: 'event', week: se.week, data: se, label: title,
        color: EV_COLOR[ec] || '#60A5FA', cat: ec, catLabel: EV_LABEL[ec] || 'Événement',
        done: se.resolved, doy: doy, info: info
      };
      byMonth[info.m].push(mom);
      if (!eventMap[doy]) eventMap[doy] = mom;
    });

    for (var k in byMonth) byMonth[k].sort(function (a, b) {
      var da = a.kind === 'race' ? a.endDoy : a.doy, db = b.kind === 'race' ? b.endDoy : b.doy;
      return da - db;
    });

    // --- Mois affiché (semaine courante) -----------------------------------
    var todayDoy = clampDoy(7 * G.semaine + 4);
    var y = f(todayDoy).m;
    var container = document.getElementById('cal-main-container');
    if (!container) return;

    var A = '';
    var monthMoments = byMonth[y] || [];
    var nbDaysMonth = DPM[y];

    A += '<div class="cal-current-month">';
    A += '<div class="cal-current-head">';
    A += '<div class="cal-current-title">' + MONTHS_FULL[y] + '</div>';
    A += '<div class="cal-current-year">' + gYearSafe() + '</div>';
    A += '</div>';
    A += '<div class="cal-current-grid-wrap">';
    A += '<div class="cal-weekdays">';
    WD_HEAD.forEach(function (w) { A += '<div class="cal-weekday">' + w + '</div>'; });
    A += '</div>';

    var firstDoy = firstDoyOfMonth(y);
    var lead = wd(firstDoy); // colonnes vides avant le 1er
    A += '<div class="cal-grid">';
    for (var i = 0; i < lead; i++) A += '<div class="cal-cell empty"></div>';

    var todayInfo = f(todayDoy);
    var curDay = (todayInfo.m === y) ? todayInfo.d : -1;

    for (var P = 1; P <= nbDaysMonth; P++) {
      var doy = firstDoy + P - 1;
      var cls = ['cal-cell'];
      var styleAttr = '';
      var band = '';
      if (raceEndMap[doy]) {
        cls.push('has-moment', 'has-race');
        band = '<div class="cal-cell-band" style="background:var(--red2)"></div>';
      } else if (eventMap[doy]) {
        cls.push('has-moment', 'has-event');
        styleAttr = ' style="--moment-color:' + eventMap[doy].color + '"';
        band = '<div class="cal-cell-band" style="background:' + eventMap[doy].color + '"></div>';
      } else if (raceLeadMap[doy]) {
        cls.push('has-moment', 'rj-wk-lead');
        band = '<div class="cal-cell-band rj-wk-band" style="background:var(--red2);opacity:.34"></div>';
      }
      if (curDay > 0 && P === curDay) cls.push('current-day');
      A += '<div class="' + cls.join(' ') + '"' + styleAttr + '>';
      A += '<span class="cal-cell-day">' + P + '</span>';
      A += band;
      A += '</div>';
    }
    A += '</div>'; // .cal-grid
    A += '</div>'; // .cal-current-grid-wrap

    // --- Liste « ce mois-ci » ----------------------------------------------
    if (monthMoments.length > 0) {
      A += '<div class="cal-current-events">';
      monthMoments.forEach(function (m) {
        var dim = m.done ? 'opacity:.45' : '';
        if (m.kind === 'race') {
          var dateTxt = raceDateRange(m);
          var typeTxt = m.nDays > 1 ? 'Week-end' : 'Course';
          var pre = 'M' + m.manche + ' · ';
          A += '<div class="cal-event-tag" style="color:var(--red2);' + dim + '">';
          A += '<div class="cal-event-tag-date">' + dateTxt + '</div>';
          A += '<div class="cal-event-tag-type">' + typeTxt + '</div>';
          A += '<div class="cal-event-tag-title" style="color:var(--text)">' + pre + m.label + '</div>';
          A += '</div>';
        } else {
          var d2 = MONTHS_ABBR[y] + ' ' + m.info.d;
          A += '<div class="cal-event-tag" style="color:' + m.color + ';' + dim + '">';
          A += '<div class="cal-event-tag-date">' + d2 + '</div>';
          A += '<div class="cal-event-tag-type">' + m.catLabel + '</div>';
          A += '<div class="cal-event-tag-title" style="color:var(--text)">' + m.label + '</div>';
          A += '</div>';
        }
      });
      A += '</div>';
    } else {
      A += '<div style="padding:12px 14px 14px;text-align:center;font-size:12px;color:var(--muted);font-style:italic">Aucun moment programmé ce mois-ci.</div>';
    }
    A += '</div>'; // .cal-current-month

    // --- Saison complète ----------------------------------------------------
    A += '<div class="cal-other-months-title">Saison complète</div>';
    for (var j = 0; j < 12; j++) {
      if (j === y) continue;
      var arr = byMonth[j];
      if (!arr || !arr.length) continue;
      var nbR = arr.filter(function (m) { return m.kind === 'race'; }).length;
      var nbE = arr.filter(function (m) { return m.kind === 'event'; }).length;
      A += '<div class="cal-other-month">';
      A += '<div class="cal-other-month-head">';
      A += '<div class="cal-other-month-name">' + MONTHS_FULL[j] + '</div>';
      A += '<div class="cal-other-month-counts">' + (nbR > 0 ? nbR + ' course' + (nbR > 1 ? 's' : '') : '') + (nbR > 0 && nbE > 0 ? ' · ' : '') + (nbE > 0 ? nbE + ' évén.' : '') + '</div>';
      A += '</div>';
      A += '<div class="cal-other-events">';
      arr.forEach(function (m) {
        if (m.kind === 'race') {
          A += '<div class="cal-mini-event">';
          A += '<div class="cal-mini-event-dot" style="background:var(--red2)"></div>';
          A += '<div class="cal-mini-event-date">' + raceMiniRange(m) + '</div>';
          A += '<div class="cal-mini-event-title">' + m.label + '</div>';
          A += '</div>';
        } else {
          A += '<div class="cal-mini-event">';
          A += '<div class="cal-mini-event-dot" style="background:' + m.color + '"></div>';
          A += '<div class="cal-mini-event-date">' + m.info.d + ' ' + MONTHS_ABBR[j] + '</div>';
          A += '<div class="cal-mini-event-title">' + m.label + '</div>';
          A += '</div>';
        }
      });
      A += '</div>';
      A += '</div>';
    }

    container.innerHTML = A;
  }

  // « Ven 12 → Dim 14 Mai » (ou avec mois aux deux bouts si à cheval).
  function raceDateRange(m) {
    var s = m.startInfo, e = m.endInfo;
    if (m.nDays <= 1) return WD_SHORT[wd(m.endDoy)] + ' ' + e.d + ' ' + MONTHS_ABBR[e.m];
    if (s.m === e.m) {
      return WD_SHORT[wd(m.startDoy)] + ' ' + s.d + ' → ' + WD_SHORT[wd(m.endDoy)] + ' ' + e.d + ' ' + MONTHS_ABBR[e.m];
    }
    return WD_SHORT[wd(m.startDoy)] + ' ' + s.d + ' ' + MONTHS_ABBR[s.m] + ' → ' + WD_SHORT[wd(m.endDoy)] + ' ' + e.d + ' ' + MONTHS_ABBR[e.m];
  }
  // « 12–14 Mai » (ou « 30 Avr–2 Mai » si à cheval).
  function raceMiniRange(m) {
    var s = m.startInfo, e = m.endInfo;
    if (m.nDays <= 1) return e.d + ' ' + MONTHS_ABBR[e.m];
    if (s.m === e.m) return s.d + '–' + e.d + ' ' + MONTHS_ABBR[e.m];
    return s.d + ' ' + MONTHS_ABBR[s.m] + '–' + e.d + ' ' + MONTHS_ABBR[e.m];
  }

  function injectCss() {
    if (document.getElementById('rj-wk-cal-css')) return;
    var st = document.createElement('style');
    st.id = 'rj-wk-cal-css';
    st.textContent =
      '.cal-cell.rj-wk-lead .cal-cell-day{opacity:.85}' +
      '.cal-cell.rj-wk-lead .rj-wk-band{height:3px}';
    document.head.appendChild(st);
  }

  function install() {
    if (typeof window.renderCal !== 'function') return false;
    if (window.renderCal._wk24) return true;
    window._origRenderCal = window.renderCal;
    window.renderCal = function () {
      try { injectCss(); enhancedRenderCal(); }
      catch (err) {
        console.error(TAG, 'fallback original renderCal:', err && err.message);
        try { return window._origRenderCal.apply(this, arguments); } catch (e2) {}
      }
    };
    window.renderCal._wk24 = true;
    window.rjDebugWeekendCal = function () {
      var c = curCat();
      console.log(TAG, c, '→ week-end de', weekendDays(c), 'jours · course = dimanche (7×week+4)');
    };
    return true;
  }

  function boot(retries) {
    if (typeof window === 'undefined') return;
    if (install()) {
      console.log(TAG, 'activé — week-ends multi-jours dans le calendrier (course = dimanche). Debug: rjDebugWeekendCal()');
      return;
    }
    if (retries > 0) { setTimeout(function () { boot(retries - 1); }, 400); return; }
    console.warn(TAG, 'abandon — renderCal introuvable.');
  }

  boot(50);
})();
