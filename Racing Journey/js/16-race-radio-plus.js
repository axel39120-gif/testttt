/* =============================================================================
 * 16-race-radio-plus.js — FIL RADIO & COMMENTAIRES ENRICHI (écran de course)
 * =============================================================================
 *
 * CE QUI EXISTE DÉJÀ
 * ------------------
 * Le module 08 affiche une section « DIRECT » au-dessus du classement, alimentée
 * par les radios (04g) et des commentaires. MAIS elle est plafonnée à 3 messages
 * éphémères (LIVE_RACE.directFeed tronqué à 3), si bien qu'on rate vite les infos.
 * Par ailleurs les manœuvres de stratégie de l'IA rivale (module 15 :
 * undercut / overcut / arrêt sous safety car) ne remontent pas dans la radio.
 *
 * CE QUE CE MODULE AJOUTE (Option A — aucun fichier cœur modifié)
 * --------------------------------------------------------------
 *   1. FIL PLUS FOURNI ET PERSISTANT — une file longue (jusqu'à 18 messages)
 *      conservée pendant la course, avec historique défilant sous la section.
 *   2. PLUS DE MESSAGES VISIBLES — 6 messages affichés au lieu de 3, le reste
 *      consultable en scroll.
 *   3. INTÉGRATION STRATÉGIE — les manœuvres des rivaux (module 15) et les
 *      arrêts au stand remontent dans le fil comme commentaires « stratégie ».
 *   4. COMMENTAIRES D'AMBIANCE — quand le fil est creux, un point de situation
 *      (écart devant, usure, position) évite l'écran « en attente ».
 *
 * COMMENT
 * -------
 *   - On enveloppe `renderLiveNewsFeed` (exposée par 08, appelée à chaque rendu) :
 *     APRÈS le rendu d'origine, on re-garnit `#rj-direct-list` avec la file longue,
 *     en réutilisant les classes CSS de 08 (rj-direct-item, …) pour garder le style.
 *   - La file vit sur LIVE_RACE (recréée à chaque course → pas de fuite entre
 *     courses) ; on purge en plus tout item dont le tour dépasse le tour courant.
 *   - Pattern bootstrap/retry, idempotent, try/catch partout.
 *
 * ORDRE DE CHARGEMENT : APRÈS 08-radio-commentary.js (et 15-rival-strategy.js).
 * ===========================================================================*/
(function () {
  'use strict';
  var TAG = '[16-race-radio-plus]';

  var MAX_FEED = 18;      // mémoire d'historique
  var SHOWN = 6;          // messages affichés (le reste défile)
  var AMBIENT_GAP = 4;    // tours sans message avant un point de situation

  function fn(name) { return typeof window[name] === 'function'; }
  function lr() { return (typeof window !== 'undefined') ? window.LIVE_RACE : null; }
  function rs() { return (typeof window !== 'undefined') ? window.RACE_STATE : null; }

  function escapeHTML(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function hexToRgba(hex, a) {
    try {
      var h = String(hex).replace('#', '');
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      var r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
      return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    } catch (e) { return 'rgba(156,163,175,' + a + ')'; }
  }
  function shortName(full) {
    if (!full) return '';
    var p = String(full).trim().split(/\s+/);
    return p[p.length - 1] || full;
  }

  function feed() {
    var L = lr();
    if (!L) return null;
    if (!L._td16Feed) L._td16Feed = [];
    return L._td16Feed;
  }

  function itemKey(it) {
    return (it._key || it.title || it.text || '?') + '@' + (it.lap != null ? it.lap : '?');
  }

  // Ajoute un item à la file longue (dédup par clé), récent en tête.
  function addItem(f, it, seen) {
    var k = itemKey(it);
    if (seen[k]) return;
    seen[k] = true;
    f.push(it);
  }

  /* ----------------------------------------------------------------------- *
   *  Collecte des sources → file longue
   * ----------------------------------------------------------------------- */
  function rebuildFeed() {
    var L = lr();
    if (!L) return [];
    var cur = L.cur || 0;
    var f = feed();

    // Purge : items d'une course précédente (tour > tour courant) ou trop vieux.
    f = f.filter(function (it) { return (it.lap == null) || (it.lap <= cur); });

    var seen = {};
    f.forEach(function (it) { seen[itemKey(it)] = true; });

    // 1) Items du fil DIRECT de 08 (radios + commentaires retenus).
    var df = L.directFeed || [];
    // directFeed est en ordre récent→ancien ; on garde cet ordre.
    df.forEach(function (it) {
      addItem(f, {
        lap: it.lap, isRadio: !!it.isRadio, title: it.title, desc: it.desc,
        text: it.text, color: it.color, _key: it._key, _src: '08'
      }, seen);
    });

    // 2) Manœuvres de stratégie & arrêts (journal d'événements).
    var log = (rs() && rs().eventsLog) || [];
    log.forEach(function (e) {
      if (!e || !e.text) return;
      var isStrat = (e.note === 'Stratégie rivale');
      var isPit = /entre aux stands/i.test(e.text);
      if (!isStrat && !isPit) return;
      var color = e.color || (isPit ? '#60A5FA' : '#A78BFA');
      addItem(f, {
        lap: e.lap, isRadio: false, text: '<strong>' + escapeHTML(_stripTags(e.text)) + '</strong>',
        color: color, _key: 'strat_' + _stripTags(e.text).slice(0, 18), _src: 'strat'
      }, seen);
    });

    // 3) Commentaire d'ambiance si le fil est creux.
    maybeAmbient(f, seen, cur);

    // Tri par tour décroissant (récent en haut), limite mémoire.
    f.sort(function (a, b) { return (b.lap || 0) - (a.lap || 0); });
    if (f.length > MAX_FEED) f.length = MAX_FEED;

    L._td16Feed = f;
    return f;
  }

  function _stripTags(s) { return String(s || '').replace(/<[^>]*>/g, ''); }

  // Point de situation léger quand rien ne s'est passé depuis quelques tours.
  function maybeAmbient(f, seen, cur) {
    var L = lr();
    if (!L || !L.drivers) return;
    var last = f.length ? Math.max.apply(null, f.map(function (i) { return i.lap || 0; })) : -99;
    if (cur - last < AMBIENT_GAP) return;
    if (L._td16LastAmbient != null && (cur - L._td16LastAmbient) < AMBIENT_GAP) return;

    var p = L.drivers.find(function (d) { return d.isPlayer; });
    if (!p || p.dnf) return;
    var msg = null, color = '#9CA3AF';

    var ahead = L.drivers.find(function (d) { return d.pos === p.pos - 1 && !d.dnf; });
    if (ahead && typeof p.gap === 'number' && typeof ahead.gap === 'number') {
      var g = +(p.gap - ahead.gap).toFixed(1);
      if (g > 0 && g < 1.2) { msg = 'Tu reviens sur <strong>' + shortName(ahead.name) + '</strong> — ' + g + 's, l\u2019occasion se dessine.'; color = '#34D399'; }
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

    L._td16LastAmbient = cur;
    addItem(f, { lap: cur, isRadio: false, text: msg, color: color, _key: 'amb_' + cur, _src: 'amb' }, seen);
  }

  /* ----------------------------------------------------------------------- *
   *  Rendu enrichi de la liste DIRECT
   * ----------------------------------------------------------------------- */
  function renderItem(it) {
    var radio = !!it.isRadio;
    var accent = radio ? '#22D3EE' : (it.color || '#9CA3AF');
    var styleVars = '--accent:' + accent + ';--accent-bg:' + hexToRgba(accent, 0.10) + ';--accent-border:' + hexToRgba(accent, 0.30);
    var lap = (it.lap != null) ? ('T' + it.lap) : '·';

    var textHTML;
    if (radio) {
      var ti = String(it.title || '').replace(/^[\uD83D\uDCFB\s]+/, '');
      var de = it.desc ? String(it.desc).replace(/^[\uD83D\uDCFB\s]+/, '') : '';
      textHTML = '<span class="rj-direct-radio-prefix">Radio team</span><strong>' + escapeHTML(ti) + '</strong>';
      if (de) textHTML += ' <span style="opacity:.88">« ' + escapeHTML(de) + ' »</span>';
    } else {
      // le texte peut contenir un <strong> volontaire ; on n'échappe pas ici
      textHTML = it.text || '';
    }

    return '<div class="rj-direct-item' + (radio ? ' is-radio' : '') + '" style="' + styleVars + '">'
      + '<span class="rj-direct-lap">' + lap + '</span>'
      + '<div class="rj-direct-text">' + textHTML + '</div>'
      + '<span style="flex-shrink:0;width:7px;height:7px;border-radius:50%;background:' + accent + ';margin-top:5px;box-shadow:0 0 6px ' + hexToRgba(accent, 0.7) + '"></span>'
      + '</div>';
  }

  function enrichRender() {
    var list = document.getElementById('rj-direct-list');
    if (!list) return; // section pas encore créée par 08
    var f = rebuildFeed();
    if (!f.length) return; // laisser l'état « en attente » de 08

    var shown = f.slice(0, SHOWN);
    list.innerHTML = shown.map(renderItem).join('');

    // Historique défilant (au-delà des messages affichés).
    if (f.length > SHOWN) {
      ensureHistory(list, f);
    } else {
      var oldH = document.getElementById('td16-history');
      if (oldH) oldH.style.display = 'none';
    }

    // Compteur
    var count = document.getElementById('rj-direct-count');
    if (count) count.textContent = f.length + (f.length > 1 ? ' messages' : ' message');
  }

  function ensureHistory(list, f) {
    var parent = list.parentNode;
    if (!parent) return;
    var hist = document.getElementById('td16-history');
    if (!hist) {
      hist = document.createElement('div');
      hist.id = 'td16-history';
      var toggle = document.createElement('button');
      toggle.id = 'td16-history-toggle';
      toggle.style.cssText = 'width:100%;background:none;border:none;border-top:1px solid rgba(255,255,255,.05);color:var(--text3);font-family:var(--font-display);font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:7px 0;cursor:pointer';
      var box = document.createElement('div');
      box.id = 'td16-history-box';
      box.style.cssText = 'display:none;max-height:170px;overflow-y:auto;border-top:1px solid rgba(255,255,255,.04)';
      toggle.onclick = function () {
        var open = box.style.display === 'none';
        box.style.display = open ? 'block' : 'none';
        toggle.setAttribute('data-open', open ? '1' : '0');
        refreshHistoryBox();
      };
      hist.appendChild(toggle);
      hist.appendChild(box);
      parent.appendChild(hist);
    }
    hist.style.display = 'block';
    var rest = f.length - SHOWN;
    var toggle = document.getElementById('td16-history-toggle');
    var box = document.getElementById('td16-history-box');
    var open = toggle && toggle.getAttribute('data-open') === '1';
    if (toggle) toggle.textContent = (open ? '▴ Masquer l\u2019historique' : '▾ Historique course (' + rest + ' de plus)');
    if (open) refreshHistoryBox();
  }

  function refreshHistoryBox() {
    var box = document.getElementById('td16-history-box');
    var f = feed();
    if (!box || !f) return;
    box.innerHTML = f.slice(SHOWN).map(renderItem).join('');
  }

  /* ----------------------------------------------------------------------- *
   *  Installation
   * ----------------------------------------------------------------------- */
  function install() {
    if (!fn('renderLiveNewsFeed') || window.renderLiveNewsFeed._td16) return false;
    var orig = window.renderLiveNewsFeed;
    window.renderLiveNewsFeed = function () {
      var r = orig.apply(this, arguments); // 08 rend sa section + 3 items
      try { enrichRender(); } catch (e) { console.warn(TAG, 'render:', e); }
      return r;
    };
    window.renderLiveNewsFeed._td16 = true;
    return true;
  }

  function boot(retries) {
    if (typeof window === 'undefined') return;
    if (install()) {
      setTimeout(install, 1200); // au cas où un autre module re-wrappe
      window.rjDebugRadioPlus = function () {
        var f = feed();
        console.log(TAG, 'file:', f ? f.length : 0, 'messages');
        (f || []).slice(0, 10).forEach(function (i) { console.log('  T' + i.lap, i.isRadio ? '[radio]' : '', _stripTags(i.title || i.text || '')); });
      };
      console.log(TAG, 'activé — fil radio/commentaires enrichi (' + SHOWN + ' visibles + historique). Debug: rjDebugRadioPlus()');
      return;
    }
    if (retries > 0) { setTimeout(function () { boot(retries - 1); }, 400); return; }
    console.warn(TAG, 'abandon — renderLiveNewsFeed introuvable (08 non chargé ?).');
  }

  boot(50);
})();
