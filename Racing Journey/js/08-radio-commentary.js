/* =============================================================================
 * 08 — RADIO POPUPS & RACE COMMENTARY (immersion course) — v3
 * =============================================================================
 *
 * v3 — CANAL DIRECT UNIFIÉ (fusion 08 + 16)
 * -----------------------------------------
 * Ce module est désormais l'UNIQUE propriétaire du fil « DIRECT » en course.
 * L'ancien module 16-race-radio-plus est absorbé ici et n'est plus chargé.
 *
 * Cause racine corrigée : la file était tronquée à 3 AU PUSH (_pushDirect),
 * si bien que les messages étaient perdus avant même d'être affichés, et 16
 * réécrivait par-dessus le même nœud DOM (double propriétaire, flicker).
 *
 * Désormais :
 *   - La file (LIVE_RACE.directFeed) n'est plus tronquée au push : elle garde
 *     TOUTE la course (plafond mémoire RJ_FEED_MAX, anti-fuite), récent en tête.
 *   - Plus de purge par TTL : tout le fil reste consultable.
 *   - UN SEUL rendu (_renderDirect) dans un PANNEAU à hauteur fixe + scroll
 *     interne (mobile-first, n'empiète pas sur le classement).
 *   - Les sources autrefois portées par 16 (manœuvres de stratégie rivale du
 *     module 15, arrêts au stand, point de situation « ambiance ») sont
 *     collectées ici, dans la file unique (_collectExternalSources).
 *   - API publique window.rjRadioPush(item) pour pousser depuis un autre module.
 *
 * RÈGLES INCHANGÉES
 * -----------------
 *   - Radios rares (~22% / tour éligible, cooldown 6 tours)
 *   - Commentaires adaptatifs au rythme :
 *       slow 65% / normal 50% / fast 35% / instant 12%
 *   - En-tête distinctif "DIRECT" avec LED rouge animée
 *   - Chaque ligne préfixée du tour (T<n>) à gauche, icône SVG à droite
 *
 * TAXONOMIE DES ICÔNES
 * --------------------
 *   radio         → ondes radio
 *   lead_change   → couronne / podium
 *   overtake      → flèche haut
 *   downgrade     → flèche bas
 *   battle        → épées croisées
 *   pressure      → cible
 *   chase         → ligne pointée
 *   safety        → triangle SC
 *   flag          → drapeau
 *   penalty       → sanction
 *   dnf           → croix
 *   weather       → nuage
 *   best_lap      → chrono
 *   phase         → drapeau à damier
 *
 * ORDRE DE CHARGEMENT : APRÈS 07-user-fixes.js
 * ===========================================================================*/

(function() {
  'use strict';
  if (typeof window === 'undefined') return;

  // ========================================================================
  // CONFIG v3 — canal DIRECT unifié (fusion des anciens 08 + 16)
  // ------------------------------------------------------------------------
  // La file n'est plus tronquée à 3 au push : elle garde toute la course,
  // affichée dans un panneau à hauteur fixe avec scroll interne (récent en
  // haut). Les sources autrefois portées par 16 (manœuvres de stratégie
  // rivale, arrêts au stand, point de situation « ambiance ») sont
  // désormais collectées ici même, dans la file unique.
  // ========================================================================
  var RJ_FEED_MAX  = 80;   // plafond mémoire de la file (anti-fuite course longue)
  var RJ_AMBIENT_GAP = 4;  // tours sans message avant un point de situation

  // ========================================================================
  // ICÔNES SVG — palette sobre, monochrome, currentColor
  // ========================================================================
  var ICONS = {
    radio:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M4 11a8 8 0 0 1 16 0"/><path d="M7 14a5 5 0 0 1 10 0"/>' +
      '<circle cx="12" cy="17.5" r="1.5" fill="currentColor"/></svg>',
    lead_change:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M3 17l3-9 4 5 2-8 2 8 4-5 3 9z"/><line x1="3" y1="20" x2="21" y2="20"/></svg>',
    overtake:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg>',
    downgrade:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M12 5v14"/><path d="M6 13l6 6 6-6"/></svg>',
    battle:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/>' +
      '<path d="M19 21l2-2"/><path d="M9.5 14.5L21 3"/></svg>',
    pressure:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>',
    chase:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M3 12h3"/><path d="M9 12h2"/><path d="M14 12h2"/><path d="M19 12l2 0"/>' +
      '<path d="M17 8l4 4-4 4"/></svg>',
    safety:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M12 3l9 16H3z"/><line x1="12" y1="10" x2="12" y2="14"/>' +
      '<circle cx="12" cy="17" r="0.8" fill="currentColor"/></svg>',
    flag:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M4 21V4"/><path d="M4 4h12l-2 4 2 4H4"/></svg>',
    penalty:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M6 2h12"/><path d="M6 22h12"/><path d="M6 2v4l6 6-6 6v4"/><path d="M18 2v4l-6 6 6 6v4"/></svg>',
    dnf:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="9"/><line x1="8" y1="8" x2="16" y2="16"/><line x1="16" y1="8" x2="8" y2="16"/></svg>',
    weather:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M16 17a4 4 0 0 0 0-8 6 6 0 0 0-11.7 1.5A4 4 0 0 0 6 17"/>' +
      '<line x1="9" y1="20" x2="9" y2="22"/><line x1="13" y1="20" x2="13" y2="22"/></svg>',
    best_lap:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5"/>' +
      '<path d="M9 2h6"/><path d="M12 2v3"/></svg>',
    phase:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M5 21V4"/><rect x="5" y="4" width="14" height="10"/>' +
      '<path d="M5 4h3v3H5z" fill="currentColor"/><path d="M11 4h3v3h-3z" fill="currentColor"/>' +
      '<path d="M8 7h3v3H8z" fill="currentColor"/><path d="M14 7h3v3h-3z" fill="currentColor"/>' +
      '<path d="M5 10h3v3H5z" fill="currentColor"/><path d="M11 10h3v3h-3z" fill="currentColor"/></svg>',
    comment:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.4 8.4 0 0 1-3.8-.9L3 21l1-4.6a8.4 8.4 0 1 1 17 0z"/></svg>',
    strategy:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M4 8h11"/><path d="M12 5l3 3-3 3"/><path d="M20 16H9"/><path d="M12 13l-3 3 3 3"/></svg>',
    pit:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M9 11a3 3 0 1 0 6 0 3 3 0 0 0-6 0z"/><path d="M12 8V3"/><path d="M5 21l2-7"/><path d="M19 21l-2-7"/></svg>'
  };

  // ========================================================================
  // CSS — section DIRECT au-dessus du classement
  // ========================================================================
  function injectCSS() {
    if (document.getElementById('rj-radio-commentary-css')) return;
    var style = document.createElement('style');
    style.id = 'rj-radio-commentary-css';
    style.textContent = [
      '#rj-direct-section{margin:0 16px 8px;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:linear-gradient(180deg,rgba(20,22,30,0.92) 0%,rgba(14,16,22,0.88) 100%)}',
      '.rj-direct-hdr{display:flex;align-items:center;gap:8px;padding:8px 13px 7px;background:linear-gradient(90deg,rgba(239,68,68,0.10) 0%,rgba(239,68,68,0.02) 60%,transparent 100%);border-bottom:1px solid var(--border)}',
      '.rj-direct-led{width:7px;height:7px;border-radius:50%;background:#EF4444;box-shadow:0 0 6px #EF4444,0 0 12px rgba(239,68,68,.4);animation:rjDirectBlink 1.4s ease-in-out infinite}',
      '@keyframes rjDirectBlink{0%,100%{opacity:1}50%{opacity:.35}}',
      '.rj-direct-label{font-family:var(--font-display);font-size:10px;font-weight:800;color:#EF4444;letter-spacing:.18em;text-transform:uppercase}',
      '.rj-direct-count{margin-left:auto;font-family:var(--font-display);font-size:9px;font-weight:700;color:var(--text3);letter-spacing:.08em;text-transform:uppercase}',
      '.rj-direct-empty{padding:13px 14px;font-size:11.5px;color:var(--text3);font-style:italic;text-align:center}',
      '.rj-direct-list{padding:4px 0;max-height:208px;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.18) transparent;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}',
      '.rj-direct-list::-webkit-scrollbar{width:5px}',
      '.rj-direct-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,.16);border-radius:3px}',
      '.rj-direct-list::-webkit-scrollbar-track{background:transparent}',
      '.rj-direct-item{display:flex;align-items:flex-start;gap:11px;padding:9px 13px;border-bottom:1px solid rgba(255,255,255,.04);transition:opacity .25s}',
      '.rj-direct-item:last-child{border-bottom:none}',
      '.rj-direct-lap{flex-shrink:0;font-family:var(--font-display);font-size:10px;font-weight:800;color:var(--accent,#9CA3AF);letter-spacing:.04em;min-width:24px;padding:2px 6px;background:rgba(255,255,255,.03);border:1px solid var(--accent-border,rgba(156,163,175,.25));border-radius:5px;text-align:center;line-height:1.25}',
      '.rj-direct-text{flex:1;min-width:0;font-size:12px;color:var(--text2);line-height:1.45;padding-top:1px}',
      '.rj-direct-text strong{color:var(--text);font-weight:700}',
      '.rj-direct-item.is-radio .rj-direct-text{font-style:italic;color:#A8D8E8}',
      '.rj-direct-item.is-radio .rj-direct-text strong{color:#67E8F9}',
      '.rj-direct-radio-prefix{font-family:var(--font-display);font-size:9px;font-weight:800;color:#22D3EE;letter-spacing:.10em;text-transform:uppercase;margin-right:6px;display:inline-block;font-style:normal}',
      '.rj-direct-ico{flex-shrink:0;width:28px;height:28px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;color:var(--accent,#9CA3AF);background:var(--accent-bg,rgba(156,163,175,.08));border:1px solid var(--accent-border,rgba(156,163,175,.2));margin-top:-1px}',
      '.rj-direct-item:first-child{animation:rjDirectIn .32s ease-out}',
      '@keyframes rjDirectIn{0%{opacity:0;transform:translateX(8px)}100%{opacity:1;transform:translateX(0)}}'
    ].join('');
    document.head.appendChild(style);
  }

  // ========================================================================
  // 1) S'assurer que la section DIRECT existe et est placée au bon endroit
  // ========================================================================
  function _ensureDirectSection() {
    var existing = document.getElementById('rj-direct-section');
    if (existing) return existing;

    var leaderboard = document.getElementById('live-leaderboard');
    if (!leaderboard || !leaderboard.parentNode) return null;

    var section = document.createElement('div');
    section.id = 'rj-direct-section';
    section.innerHTML =
      '<div class="rj-direct-hdr">' +
        '<span class="rj-direct-led"></span>' +
        '<span class="rj-direct-label">Direct</span>' +
        '<span class="rj-direct-count" id="rj-direct-count"></span>' +
      '</div>' +
      '<div class="rj-direct-list" id="rj-direct-list">' +
        '<div class="rj-direct-empty">En attente d\'événements en piste…</div>' +
      '</div>';

    leaderboard.parentNode.insertBefore(section, leaderboard);
    return section;
  }

  // ========================================================================
  // 2) Classification → icône + couleur d'accent
  // ========================================================================
  // ========================================================================
  // SOURCES ABSORBÉES DE L'ANCIEN MODULE 16 — collecte dans la file unique
  // ========================================================================
  function _stripTags(s) { return String(s == null ? '' : s).replace(/<[^>]*>/g, ''); }

  // Manœuvres de stratégie rivale (module 15) + arrêts au stand, lues dans
  // le journal d'événements de la course, et point de situation « ambiance ».
  function _collectExternalSources() {
    if (!LIVE_RACE || LIVE_RACE.finished) return;

    var log = (typeof RACE_STATE !== 'undefined' && RACE_STATE && RACE_STATE.eventsLog) || [];
    for (var i = 0; i < log.length; i++) {
      var e = log[i];
      if (!e || !e.text) continue;
      var isStrat = (e.note === 'Stratégie rivale');
      var isPit = /entre aux stands/i.test(e.text);
      if (!isStrat && !isPit) continue;
      var clean = _stripTags(e.text);
      _pushDirect({
        lap: (e.lap != null ? e.lap : LIVE_RACE.cur),
        isRadio: false,
        text: '<strong>' + _escapeHTML(clean) + '</strong>',
        color: e.color || (isPit ? '#60A5FA' : '#A78BFA'),
        _key: (isPit ? 'pitlog_' : 'strat_') + clean.slice(0, 18)
      });
    }

    _maybeAmbient();
  }

  // Point de situation léger quand rien ne s'est passé depuis quelques tours.
  function _maybeAmbient() {
    if (!LIVE_RACE || !LIVE_RACE.drivers) return;
    var cur = LIVE_RACE.cur || 0;
    var feed = LIVE_RACE.directFeed || [];
    var last = feed.length ? Math.max.apply(null, feed.map(function (it) { return it.lap || 0; })) : -99;
    if (cur - last < RJ_AMBIENT_GAP) return;
    if (LIVE_RACE._commAmbientLast != null && (cur - LIVE_RACE._commAmbientLast) < RJ_AMBIENT_GAP) return;

    var p = LIVE_RACE.drivers.find(function (d) { return d.isPlayer; });
    if (!p || p.dnf) return;
    var msg = null, color = '#9CA3AF';

    var ahead = LIVE_RACE.drivers.find(function (d) { return d.pos === p.pos - 1 && !d.dnf; });
    if (ahead && typeof p.gap === 'number' && typeof ahead.gap === 'number') {
      var g = +(p.gap - ahead.gap).toFixed(1);
      if (g > 0 && g < 1.2) {
        msg = 'Tu reviens sur <strong>' + _shortName(ahead.name) + '</strong> — ' + g + 's, l\u2019occasion se dessine.';
        color = '#34D399';
      }
    }
    if (!msg && typeof p._tyreLife === 'number') {
      var tl = Math.round(p._tyreLife);
      if (tl < 25) { msg = 'Gomme en fin de vie (' + tl + '%) — il va falloir gérer ou s\u2019arrêter.'; color = '#EF4444'; }
      else if (tl < 40) { msg = 'Les pneus commencent à décrocher (' + tl + '%).'; color = '#FBBF24'; }
    }
    if (!msg) {
      msg = 'P' + p.pos + ' — on tient le rythme, rien à signaler côté stand.';
      color = '#9CA3AF';
    }

    LIVE_RACE._commAmbientLast = cur;
    _pushDirect({ lap: cur, isRadio: false, text: msg, color: color, _key: 'amb_' + cur });
  }

  function _classify(item) {
    if (item.isRadio) {
      return { icon: ICONS.radio, color: '#22D3EE' };
    }

    var key = item._key || '';
    var text = item.text || '';
    var fallbackColor = item.color || '#9CA3AF';

    // Sources absorbées de l'ancien module 16
    if (key.indexOf('strat_') === 0)      return { icon: ICONS.strategy, color: item.color || '#A78BFA' };
    if (key.indexOf('amb_') === 0)        return { icon: ICONS.comment,  color: item.color || '#9CA3AF' };
    if (/entre aux stands|arrêt au stand|pit\b/i.test(text)) return { icon: ICONS.pit, color: item.color || '#60A5FA' };

    if (key === 'lead_change')             return { icon: ICONS.lead_change, color: '#F59E0B' };
    if (key === 'player_dnf')              return { icon: ICONS.dnf,         color: '#EF4444' };
    if (key === 'player_penalty')          return { icon: ICONS.penalty,     color: '#F59E0B' };
    if (key.indexOf('player_up_') === 0)   return { icon: ICONS.overtake,    color: '#34D399' };
    if (key.indexOf('player_down_') === 0) return { icon: ICONS.downgrade,   color: '#EF4444' };
    if (key === 'p1_battle' || key === 'p3_battle') return { icon: ICONS.battle, color: '#F59E0B' };
    if (key === 'player_under_pressure')   return { icon: ICONS.pressure,    color: '#FBBF24' };
    if (key === 'player_close_ahead')      return { icon: ICONS.chase,       color: '#60A5FA' };
    if (key === 'best_lap')                return { icon: ICONS.best_lap,    color: '#A78BFA' };
    if (key === 'race_start' || key === 'race_mid' || key === 'race_end')
                                            return { icon: ICONS.phase,      color: fallbackColor };

    if (/safety car/i.test(text))          return { icon: ICONS.safety,     color: '#F59E0B' };
    if (/slow zone/i.test(text))           return { icon: ICONS.safety,     color: '#34D399' };
    if (/drapeau\s+jaune/i.test(text))     return { icon: ICONS.flag,       color: '#F59E0B' };
    if (/drapeau\s+rouge/i.test(text))     return { icon: ICONS.flag,       color: '#EF4444' };
    if (/abandonne/i.test(text))           return { icon: ICONS.dnf,        color: '#EF4444' };
    if (/crevaison/i.test(text))           return { icon: ICONS.dnf,        color: '#F59E0B' };
    if (/aquaplaning|pluie|averse/i.test(text)) return { icon: ICONS.weather, color: '#60A5FA' };
    if (/contact/i.test(text))             return { icon: ICONS.battle,     color: '#EF4444' };
    if (/p[eé]nalit[eé]/i.test(text))      return { icon: ICONS.penalty,    color: '#F59E0B' };

    return { icon: ICONS.comment, color: fallbackColor };
  }

  function _hexToRgba(hex, alpha) {
    if (!hex || hex[0] !== '#') return 'rgba(156,163,175,' + alpha + ')';
    var r, g, b;
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else {
      r = parseInt(hex.slice(1, 3), 16);
      g = parseInt(hex.slice(3, 5), 16);
      b = parseInt(hex.slice(5, 7), 16);
    }
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  // ========================================================================
  // 3) Feeds & rendu
  // ========================================================================
  function _ensureFeeds() {
    if (!LIVE_RACE) return null;
    if (!LIVE_RACE.directFeed) LIVE_RACE.directFeed = [];
    if (!LIVE_RACE._commLastLap) LIVE_RACE._commLastLap = -99;
    if (!LIVE_RACE._radioLastLap) LIVE_RACE._radioLastLap = -99;
    if (!LIVE_RACE._commPrevState) LIVE_RACE._commPrevState = {};
    return LIVE_RACE.directFeed;
  }

  function _pushDirect(item) {
    var feed = _ensureFeeds();
    if (!feed) return;
    if (item.lap == null) item.lap = LIVE_RACE.cur;

    if (item._key) {
      var dup = feed.some(function(f) {
        return f._key === item._key && f.lap === item.lap;
      });
      if (dup) return;
      var recent = feed.some(function(f) {
        return f._key === item._key && (LIVE_RACE.cur - f.lap) < 2;
      });
      if (recent) return;
    }

    feed.unshift(item);
    // v3 : plus de troncature à 3 au push. Le fil conserve toute la course
    // (récent en tête) ; seul un plafond mémoire évite la fuite sur très
    // longue épreuve. L'affichage (panneau scrollable) décide du visible.
    if (feed.length > RJ_FEED_MAX) feed.length = RJ_FEED_MAX;
  }

  function _renderDirect() {
    _ensureDirectSection();

    // v3 : on alimente la file unique avec les sources autrefois portées
    // par 16 (stratégie rivale, arrêts, point de situation) AVANT de rendre.
    try { _collectExternalSources(); } catch (e) { console.warn('rjCollectSources:', e); }

    var feed = (LIVE_RACE && LIVE_RACE.directFeed) || [];
    var list = document.getElementById('rj-direct-list');
    var count = document.getElementById('rj-direct-count');
    if (!list) return;

    if (count) {
      count.textContent = feed.length > 0
        ? (feed.length + (feed.length > 1 ? ' messages' : ' message'))
        : '';
    }

    if (feed.length === 0) {
      list.innerHTML = '<div class="rj-direct-empty">En attente d\'événements en piste…</div>';
      return;
    }

    // Préserver la position de lecture : si l'utilisateur a scrollé pour
    // consulter l'historique, on ne le ramène pas de force en haut.
    var prevTop = list.scrollTop;
    var wasAtTop = prevTop <= 4;

    var html = '';
    feed.forEach(function(item) {
      var cls = _classify(item);
      var accent = cls.color;
      var accentBg = _hexToRgba(accent, 0.10);
      var accentBd = _hexToRgba(accent, 0.30);

      var itemCls = 'rj-direct-item' + (item.isRadio ? ' is-radio' : '');
      var styleVars = '--accent:' + accent + ';--accent-bg:' + accentBg + ';--accent-border:' + accentBd;

      var textHTML;
      if (item.isRadio) {
        var cleanTitle = String(item.title || '').replace(/^[📻\s]+/, '');
        var cleanDesc = item.desc ? String(item.desc).replace(/^[📻\s]+/, '') : '';
        textHTML = '<span class="rj-direct-radio-prefix">Radio team</span>';
        textHTML += '<strong>' + _escapeHTML(cleanTitle) + '</strong>';
        if (cleanDesc) {
          textHTML += ' <span style="opacity:.88">« ' + _escapeHTML(cleanDesc) + ' »</span>';
        }
      } else {
        textHTML = item.text;
      }

      html += '<div class="' + itemCls + '" style="' + styleVars + '">';
      html += '<span class="rj-direct-lap">T' + item.lap + '</span>';
      html += '<span class="rj-direct-text">' + textHTML + '</span>';
      html += '<span class="rj-direct-ico">' + cls.icon + '</span>';
      html += '</div>';
    });
    list.innerHTML = html;

    // Récent en haut : on reste en haut par défaut, sinon on conserve la
    // position de lecture de l'historique.
    list.scrollTop = wasAtTop ? 0 : prevTop;
  }

  function _escapeHTML(s) {
    return String(s || '').replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ========================================================================
  // 4) WRAP pushRadioMsg
  // ========================================================================
  function wrapPushRadioMsg() {
    if (typeof window.pushRadioMsg !== 'function') return false;
    if (window._rjRadioDirectPatched) return true;
    window._rjRadioDirectPatched = true;

    window.pushRadioMsg = function rjPushRadioMsgDirect(title, desc, opts) {
      try {
        _ensureFeeds();
        _pushDirect({
          isRadio: true,
          title: title,
          desc: desc,
          _key: 'radio_' + String(title || '').slice(0, 15).toLowerCase().replace(/\s+/g, '_'),
          color: (opts && opts.color) || '#22D3EE'
        });
        LIVE_RACE._radioLastLap = LIVE_RACE.cur;
        if (typeof playRadioOpen === 'function') {
          try { playRadioOpen(); } catch (e) {}
        }
        _renderDirect();
      } catch (e) {
        console.warn('pushRadioMsgDirect:', e);
      }
    };
    return true;
  }

  // ========================================================================
  // 5) WRAP tryContextualRadio — radios rares
  // ========================================================================
  function wrapTryContextualRadio() {
    if (typeof window.tryContextualRadio !== 'function') return false;
    if (window._rjRadioRarityPatched) return true;
    window._rjRadioRarityPatched = true;

    var orig = window.tryContextualRadio;
    window.tryContextualRadio = function rjRareContextualRadio() {
      try {
        if (!LIVE_RACE || LIVE_RACE.finished || LIVE_RACE.paused) return;
        LIVE_RACE._lastRadioLap = LIVE_RACE._lastRadioLap || -99;
        if (LIVE_RACE.cur - LIVE_RACE._lastRadioLap < 6) return;
        if (Math.random() > 0.22) return;
        return orig.apply(this, arguments);
      } catch (e) {
        console.warn('rjRareContextualRadio:', e);
      }
    };
    return true;
  }

  // ========================================================================
  // 6) GÉNÉRATION DE COMMENTAIRES
  // ========================================================================
  function _generateCommentary() {
    if (!LIVE_RACE || !LIVE_RACE.drivers) return false;
    var drivers = LIVE_RACE.drivers;
    var alive = drivers.filter(function(d) { return !d.dnf; });
    if (alive.length === 0) return false;

    var prev = LIVE_RACE._commPrevState || {};
    var lap = LIVE_RACE.cur;
    var total = LIVE_RACE.total;
    var phase = lap / Math.max(1, total);

    var leader = alive.find(function(d) { return d.pos === 1; });
    var player = drivers.find(function(d) { return d.isPlayer; });

    // 1) Changement de leader
    if (leader && prev.leaderName && leader.name !== prev.leaderName && lap >= 2) {
      var prevLeaderShort = _shortName(prev.leaderName);
      var newLeaderShort = leader.isPlayer ? 'Toi' : _shortName(leader.name);
      var verb = leader.isPlayer ? 'prends la tête de la course' : 'passe en tête';
      var subj = leader.isPlayer ? 'Tu ' : '<strong>' + newLeaderShort + '</strong> ';
      _pushDirect({
        text: subj + verb + ' devant <strong>' + prevLeaderShort + '</strong> !',
        color: '#F59E0B',
        _key: 'lead_change'
      });
      _persistState(leader, player, alive);
      return true;
    }

    // 2) Event log frais
    var lastEventLog = (RACE_STATE && RACE_STATE.eventsLog && RACE_STATE.eventsLog.length)
      ? RACE_STATE.eventsLog[RACE_STATE.eventsLog.length - 1] : null;
    if (lastEventLog && lastEventLog.lap === lap && prev._lastEventLogLap !== lap) {
      var txt = lastEventLog.text || '';
      if (/safety car|drapeau|slow zone|abandon|crevaison|aquaplaning|contact|averse|VSC/i.test(txt)) {
        var commText = _formatEventLogAsComment(lastEventLog);
        if (commText) {
          _pushDirect({
            text: commText,
            color: lastEventLog.color || '#F59E0B',
            _key: 'evlog_' + txt.slice(0, 20).replace(/\s+/g, '_').toLowerCase()
          });
          prev._lastEventLogLap = lap;
          _persistState(leader, player, alive);
          return true;
        }
      }
    }

    // 3) Pénalité fraîche
    if (player && !player.dnf) {
      var curPen = player.penaltySec || 0;
      var prevPen = prev.playerPen || 0;
      if (curPen > prevPen + 0.4 && lap > 1) {
        var diff = curPen - prevPen;
        _pushDirect({
          text: 'Tu écopes d\'une <strong>pénalité de ' + diff.toFixed(0) + 's</strong>. Les commissaires sanctionnent.',
          color: '#F59E0B',
          _key: 'player_penalty'
        });
        _persistState(leader, player, alive);
        return true;
      }
    }

    // 4) DNF joueur
    if (player && player.dnf && !prev.playerDnf) {
      _pushDirect({
        text: '<strong>Tu abandonnes</strong> au tour ' + lap + '. La course est terminée pour toi.',
        color: '#EF4444',
        _key: 'player_dnf'
      });
      _persistState(leader, player, alive);
      return true;
    }

    // ---- CANDIDATS PONDÉRÉS ----
    var candidates = [];

    if (player && !player.dnf && prev.playerPos && player.pos) {
      var dp = prev.playerPos - player.pos;
      if (dp >= 1) {
        candidates.push({
          text: 'Tu dépasses <strong>' + (dp === 1 ? 'un rival' : (dp + ' rivaux')) + '</strong>, te voilà <strong>P' + player.pos + '</strong>.',
          color: '#34D399', _key: 'player_up_p' + player.pos, weight: 4
        });
      } else if (dp <= -1) {
        candidates.push({
          text: 'Tu perds <strong>' + (dp === -1 ? 'une place' : (-dp + ' places')) + '</strong>, tu redescends à <strong>P' + player.pos + '</strong>.',
          color: '#EF4444', _key: 'player_down_p' + player.pos, weight: 4
        });
      }
    }

    if (leader && alive.length >= 2 && lap > 2 && phase < 0.95) {
      var second = alive.find(function(d) { return d.pos === 2; });
      if (second && typeof second.gap === 'number' && second.gap < 1.2) {
        var leaderShort = leader.isPlayer ? 'Toi' : _shortName(leader.name);
        var secondShort = second.isPlayer ? 'toi' : _shortName(second.name);
        candidates.push({
          text: '<strong>' + leaderShort + '</strong> mène avec <strong>' + secondShort + '</strong> dans le rétro à seulement <strong>' + second.gap.toFixed(1) + 's</strong>.',
          color: '#F59E0B', _key: 'p1_battle', weight: 3
        });
      }
    }

    if (player && !player.dnf && player.pos > 1) {
      var ahead = alive.find(function(d) { return d.pos === player.pos - 1; });
      if (ahead) {
        var aheadScore = ahead.score - (ahead.penaltySec || 0) / 45;
        var plScore = player.score - (player.penaltySec || 0) / 45;
        var gapToAhead = (aheadScore - plScore) * 45;
        if (gapToAhead < 1.0 && gapToAhead > -0.5 && lap > 2 && phase < 0.9) {
          candidates.push({
            text: 'Tu colles <strong>' + _shortName(ahead.name) + '</strong> à <strong>' + gapToAhead.toFixed(1) + 's</strong>, l\'attaque se prépare.',
            color: '#60A5FA', _key: 'player_close_ahead', weight: 3
          });
        }
      }
    }

    if (player && !player.dnf && player.pos < alive.length) {
      var behind = alive.find(function(d) { return d.pos === player.pos + 1; });
      if (behind) {
        var plScore2 = player.score - (player.penaltySec || 0) / 45;
        var behindScore = behind.score - (behind.penaltySec || 0) / 45;
        var gapToBehind = (plScore2 - behindScore) * 45;
        if (gapToBehind < 0.8 && gapToBehind > -0.5 && lap > 2 && phase < 0.95) {
          candidates.push({
            text: '<strong>' + _shortName(behind.name) + '</strong> dans tes échappements à <strong>' + gapToBehind.toFixed(1) + 's</strong>, il pousse fort.',
            color: '#FBBF24', _key: 'player_under_pressure', weight: 3
          });
        }
      }
    }

    if (alive.length >= 4 && phase > 0.25 && phase < 0.95) {
      var p3 = alive.find(function(d) { return d.pos === 3; });
      var p4 = alive.find(function(d) { return d.pos === 4; });
      if (p3 && p4 && !p3.isPlayer && !p4.isPlayer) {
        var s3 = p3.score - (p3.penaltySec || 0) / 45;
        var s4 = p4.score - (p4.penaltySec || 0) / 45;
        var gap34 = (s3 - s4) * 45;
        if (gap34 < 1.2 && gap34 > 0) {
          candidates.push({
            text: 'Duel pour le podium : <strong>' + _shortName(p3.name) + '</strong> et <strong>' + _shortName(p4.name) + '</strong> séparés de <strong>' + gap34.toFixed(1) + 's</strong>.',
            color: '#A78BFA', _key: 'p3_battle', weight: 2
          });
        }
      }
    }

    if (lap === 2 && !prev._saidStart) {
      candidates.push({
        text: '<strong>Départ donné !</strong> ' + total + ' tours à parcourir, la course est lancée.',
        color: '#22D3EE', _key: 'race_start', weight: 5
      });
      prev._saidStart = true;
    }
    if (lap === Math.floor(total / 2) && !prev._saidMid && total >= 8) {
      var leadName = leader ? (leader.isPlayer ? 'Toi' : _shortName(leader.name)) : 'le leader';
      candidates.push({
        text: 'Mi-course. <strong>' + leadName + '</strong> mène la danse, ' + (alive.length - 1) + ' poursuivants en chasse.',
        color: '#9CA3AF', _key: 'race_mid', weight: 4
      });
      prev._saidMid = true;
    }
    if (lap === total - 2 && !prev._saidEnd && total >= 6) {
      candidates.push({
        text: '<strong>Derniers tours !</strong> ' + (total - lap + 1) + ' tour' + ((total - lap + 1) > 1 ? 's' : '') + ' à parcourir, tout peut basculer.',
        color: '#F59E0B', _key: 'race_end', weight: 5
      });
      prev._saidEnd = true;
    }

    if (LIVE_RACE.bestLap && LIVE_RACE.bestLap.lap === lap && prev._bestLapAnnouncedAt !== lap) {
      var blDriver = LIVE_RACE.bestLap.isPlayer ? 'Toi' : _shortName(LIVE_RACE.bestLap.driverName || '');
      candidates.push({
        text: '<strong>' + blDriver + '</strong> signe le <strong>meilleur tour</strong> en course.',
        color: '#A78BFA', _key: 'best_lap', weight: 3
      });
      prev._bestLapAnnouncedAt = lap;
    }

    if (candidates.length === 0) {
      _persistState(leader, player, alive);
      return false;
    }

    var totalWeight = candidates.reduce(function(a, c) { return a + (c.weight || 1); }, 0);
    var r = Math.random() * totalWeight;
    var acc = 0, picked = candidates[0];
    for (var i = 0; i < candidates.length; i++) {
      acc += candidates[i].weight || 1;
      if (r <= acc) { picked = candidates[i]; break; }
    }
    _pushDirect({ text: picked.text, color: picked.color, _key: picked._key });
    LIVE_RACE._commLastLap = lap;
    _persistState(leader, player, alive);
    return true;
  }

  function _persistState(leader, player, alive) {
    if (!LIVE_RACE._commPrevState) LIVE_RACE._commPrevState = {};
    var p = LIVE_RACE._commPrevState;
    p.leaderName = leader ? leader.name : null;
    p.playerPos = (player && !player.dnf) ? player.pos : null;
    p.playerPen = player ? (player.penaltySec || 0) : 0;
    p.playerDnf = !!(player && player.dnf);
  }

  function _shortName(fullName) {
    if (!fullName) return 'un pilote';
    var parts = String(fullName).trim().split(/\s+/);
    return parts[parts.length - 1] || fullName;
  }

  function _formatEventLogAsComment(ev) {
    var txt = ev.text || '';
    if (/safety car/i.test(txt))    return '<strong>Safety Car</strong> déployée en piste. Peloton regroupé.';
    if (/slow zone/i.test(txt))     return '<strong>Slow Zone</strong> sur la piste. Vitesse limitée temporairement.';
    if (/drapeau jaune/i.test(txt)) return '<strong>Drapeau jaune</strong> en piste. Pas de dépassement.';
    if (/abandon/i.test(txt)) {
      var m = txt.match(/abandon\s+(.+?)(?:\s*\(|\s*$)/i);
      if (m) return '<strong>' + _shortName(m[1].trim()) + '</strong> abandonne. ' + (ev.note || '');
      return txt;
    }
    if (/crevaison/i.test(txt)) {
      var m2 = txt.match(/crevaison\s+(.+)$/i);
      if (m2) return '<strong>' + _shortName(m2[1].trim()) + '</strong> est victime d\'une <strong>crevaison</strong>.';
      return 'Crevaison en piste.';
    }
    if (/aquaplaning/i.test(txt))  return 'Un pilote part en <strong>aquaplaning</strong> sous la pluie.';
    if (/contact/i.test(txt))      return txt;
    if (/averse|pluie/i.test(txt)) return '<strong>La pluie tombe</strong> sur le circuit. Adhérence perturbée.';
    return txt;
  }

  // ========================================================================
  // 7) WRAP renderLiveNewsFeed
  // ========================================================================
  function wrapRenderLiveNewsFeed() {
    if (typeof window.renderLiveNewsFeed !== 'function') return false;
    if (window._rjDirectRenderPatched) return true;
    window._rjDirectRenderPatched = true;

    window.renderLiveNewsFeed = function rjRenderDirectFeed() {
      try {
        var oldFeed = document.getElementById('live-news-feed');
        if (oldFeed && oldFeed.style.display !== 'none') {
          oldFeed.style.display = 'none';
          oldFeed.innerHTML = '';
        }
        _renderDirect();
      } catch (e) {
        console.warn('rjRenderDirectFeed:', e);
      }
    };
    return true;
  }

  // ========================================================================
  // 8) WRAP tickNewsFeed — TTL
  // ========================================================================
  function wrapTickNewsFeed() {
    if (typeof window.tickNewsFeed !== 'function') return false;
    if (window._rjDirectTickPatched) return true;
    window._rjDirectTickPatched = true;

    window.tickNewsFeed = function rjTickDirect() {
      try {
        if (!LIVE_RACE) return;
        // v3 : plus de purge par TTL. Le fil DIRECT conserve toute la course
        // (récent en haut, le reste accessible au scroll). Le plafond mémoire
        // est appliqué au push (RJ_FEED_MAX). On retire seulement d'éventuels
        // items orphelins d'un tour futur (sécurité relance de course).
        var feed = LIVE_RACE.directFeed;
        if (!feed || feed.length === 0) return;
        var cur = LIVE_RACE.cur;
        LIVE_RACE.directFeed = feed.filter(function(item) {
          return (item.lap == null) || (item.lap <= cur);
        });
      } catch (e) {
        console.warn('rjTickDirect:', e);
      }
    };
    return true;
  }

  // ========================================================================
  // 9) WRAP renderLiveLeaderboard — hook de génération
  // ========================================================================
  function wrapRenderLiveLeaderboardForCommentary() {
    if (typeof window.renderLiveLeaderboard !== 'function') return false;
    if (window._rjCommentaryHookPatched) return true;
    window._rjCommentaryHookPatched = true;

    var orig = window.renderLiveLeaderboard;
    window.renderLiveLeaderboard = function rjRenderLBWithCommentary() {
      var ret = orig.apply(this, arguments);
      try {
        _ensureDirectSection();

        if (!LIVE_RACE || LIVE_RACE.finished || LIVE_RACE.paused) {
          _renderDirect();
          return ret;
        }
        _ensureFeeds();

        var speedProb = _commentaryProbabilityForSpeed();
        var sinceLast = LIVE_RACE.cur - (LIVE_RACE._commLastLap || -99);
        if (sinceLast < 1 && LIVE_RACE.directFeed.length > 0) {
          _renderDirect();
          return ret;
        }

        if (Math.random() > speedProb) {
          var alive = LIVE_RACE.drivers.filter(function(d) { return !d.dnf; });
          var leader = alive.find(function(d) { return d.pos === 1; });
          var player = LIVE_RACE.drivers.find(function(d) { return d.isPlayer; });
          _persistState(leader, player, alive);
          _renderDirect();
          return ret;
        }

        _generateCommentary();
        _renderDirect();
      } catch (e) {
        console.warn('rjRenderLBWithCommentary:', e);
      }
      return ret;
    };
    return true;
  }

  function _commentaryProbabilityForSpeed() {
    var mult = (typeof getSimSpeedMult === 'function') ? getSimSpeedMult() : 1.8;
    if (mult <= 0.1) return 0.12;
    if (mult <= 1.0) return 0.35;
    if (mult <= 1.9) return 0.50;
    return 0.65;
  }

  // ========================================================================
  // 10) WRAP runRaceLive — reset
  // ========================================================================
  function wrapRunRaceLive() {
    if (typeof window.runRaceLive !== 'function') return false;
    if (window._rjDirectResetPatched) return true;
    window._rjDirectResetPatched = true;

    var orig = window.runRaceLive;
    window.runRaceLive = function rjRunRaceLiveWithReset() {
      try {
        if (LIVE_RACE) {
          LIVE_RACE.directFeed = [];
          LIVE_RACE._commLastLap = -99;
          LIVE_RACE._radioLastLap = -99;
          LIVE_RACE._commPrevState = {};
        }
        var list = document.getElementById('rj-direct-list');
        if (list) list.innerHTML = '<div class="rj-direct-empty">En attente d\'événements en piste…</div>';
        var count = document.getElementById('rj-direct-count');
        if (count) count.textContent = '';
      } catch (e) {}
      return orig.apply(this, arguments);
    };
    return true;
  }

  // ========================================================================
  // 11) BOOTSTRAP
  // ========================================================================
  function bootstrap() {
    injectCSS();
    var allOk =
      wrapPushRadioMsg() &
      wrapTryContextualRadio() &
      wrapRenderLiveNewsFeed() &
      wrapTickNewsFeed() &
      wrapRenderLiveLeaderboardForCommentary() &
      wrapRunRaceLive();
    if (!allOk) {
      setTimeout(bootstrap, 80);
    } else {
      // API publique : pousser un message dans le fil DIRECT depuis un autre
      // module (ex. arrêts auto), puis rafraîchir. item = {text|title/desc,
      // color, isRadio, _key, lap?}.
      window.rjRadioPush = function (item) {
        try { if (item) { _pushDirect(item); _renderDirect(); } } catch (e) { console.warn('rjRadioPush:', e); }
      };
      window.rjDebugRadio = function () {
        var f = (LIVE_RACE && LIVE_RACE.directFeed) || [];
        console.log('[08-radio v3] fil DIRECT :', f.length, 'messages');
        f.slice(0, 12).forEach(function (i) {
          console.log('  T' + i.lap, i.isRadio ? '[radio]' : '', _stripTags(i.title || i.text || ''));
        });
      };
      console.log('[08-radio-commentary v3] activé — canal DIRECT unifié (08+16), fil complet scrollable. Debug: rjDebugRadio()');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
