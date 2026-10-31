/* =====================================================================
 * 07i-emojis-texte.js — ÉMOJIS RETIRÉS DES TEXTES
 *
 * Issu de l'ancien legacy/07-user-fixes.js (« corrections demandées par
 * l'utilisateur »), rangé par domaine lors de la restructuration (T8).
 * =================================================================== */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;



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
    /* Retrait des émojis dans les notifications : c'est un filtre, pas un
       affichage. Inscription au registre des filtres (module 88). */
    if (!Array.isArray(window.RJ_TOAST_FILTERS)) window.RJ_TOAST_FILTERS = [];
    if (!window.RJ_TOAST_FILTERS.some(function (f) { return f && f.id === "07-user-fixes"; })) {
      window.RJ_TOAST_FILTERS.push({
        id: "07-user-fixes",
        filtre: function (label, text, color) {
          try {
            if (typeof label === 'string') label = window._rjStripEmoji(label);
            if (typeof text === 'string') text = window._rjStripEmoji(text);
          } catch (e) {}
          return [label, text, color];
        }
      });
    }
    window.pushHomeToast._rjEmojiWrapped = true;
  })();

  // Wrap showToast : single arg
  (function _rjWrapShowToast() {
    if (typeof window.showToast !== 'function') return;
    if (window.showToast._rjEmojiWrapped) return;
    var orig = window.showToast;
    rjInscrire("showToast", { id: "07i-emojis-texte:showToast", ordre: -2800, remplace: function (args, suite) {
      var text = args[0];
      try {
        if (typeof text === 'string') text = window._rjStripEmoji(text);
      } catch (e) {}
      return suite([text]);
    } });
    window.showToast._rjEmojiWrapped = true;
  })();

  // Wrap pushMail : body goes through HTML conversion (renders as innerHTML)
  // subject and from are textContent → strip
  (function _rjWrapPushMail() {
    if (typeof window.pushMail !== 'function') return;
    if (window.pushMail._rjEmojiWrapped) return;
    var orig = window.pushMail;
    rjInscrire("pushMail", { id: "07i-emojis-texte:pushMail", ordre: -2800, remplace: function (args, suite) {
      var e = args[0];
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
      return suite([e]);
    } });
    window.pushMail._rjEmojiWrapped = true;
  })();

  // Wrap _addFeedPost : body in social feed is rendered as innerHTML
  (function _rjWrapAddFeedPost() {
    if (typeof window._addFeedPost !== 'function') return;
    if (window._addFeedPost._rjEmojiWrapped) return;
    var orig = window._addFeedPost;
    rjInscrire("_addFeedPost", { id: "07i-emojis-texte:_addFeedPost", ordre: -2800, remplace: function (args, suite) {
      var post = args[0];
      if (post && typeof post === 'object') {
        try {
          if (typeof post.body === 'string') post.body = window._rjEmojiToSvg(post.body);
          if (typeof post.author === 'string') post.author = window._rjStripEmoji(post.author);
        } catch (e) {}
      }
      return suite([post]);
    } });
    window._addFeedPost._rjEmojiWrapped = true;
  })();

})();
