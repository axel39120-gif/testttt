/* =====================================================================
 * 57-emoji-to-icons.js — EMOJIS → VRAIES ICÔNES
 *
 * Le jeu contient encore ~460 emojis répartis dans une vingtaine de
 * fichiers, dont les fichiers cœur (03/04/05/06) qu'on ne réécrit pas.
 * Plutôt que de toucher à ces sources, on substitue à l'affichage : à
 * chaque insertion de contenu, les emojis présents dans les nœuds de
 * texte sont remplacés par l'icône SVG correspondante du jeu
 * (renderIcon, 123 icônes disponibles) — et les emojis drapeaux par le
 * rendu SVG de drapeau déjà utilisé partout ailleurs (flagSvg).
 *
 * Avantages : aucun fichier cœur modifié, couvre aussi les textes générés
 * dynamiquement, et se retire d'une ligne.
 *
 * Les emojis sans équivalent pertinent sont simplement retirés plutôt que
 * remplacés par une icône approximative. Le sélecteur de variante (U+FE0F),
 * invisible mais source d'espacements bizarres, est supprimé.
 *
 * Réversible : window._rj57Uninstall() (rechargement conseillé).
 * =================================================================== */
(function () {
  "use strict";

  // emoji -> nom d'icône du catalogue (01-icons.js)
  var MAP = {
    "\u26A0": "alerte",        // ⚠ avertissement
    "\u26A1": "boost",         // ⚡ éclair
    "\u2B50": "star",          // ⭐
    "\u2605": "star",          // ★
    "\u2606": "star",          // ☆
    "\uD83C\uDFC6": "trophee",     // 🏆
    "\uD83E\uDD47": "trophee_p1",  // 🥇
    "\uD83E\uDD48": "podium",      // 🥈
    "\uD83E\uDD49": "podium",      // 🥉
    "\uD83C\uDFC1": "damier",      // 🏁
    "\uD83D\uDCFB": "radio",       // 📻
    "\uD83D\uDCAA": "musculation",  // 💪
    "\uD83D\uDD27": "moteur",      // 🔧
    "\uD83D\uDD34": "drapeau_rouge",// 🔴
    "\uD83D\uDFE1": "alerte",      // 🟡
    "\uD83D\uDD25": "chaleur",     // 🔥
    "\u2600": "sec",           // ☀
    "\u2601": "nuageux",       // ☁
    "\uD83C\uDF27": "pluie",       // 🌧
    "\uD83C\uDF29": "orage",       // 🌩
    "\uD83D\uDCA8": "vitesse",     // 💨
    "\uD83C\uDFAF": "objectif",    // 🎯
    "\uD83D\uDCC8": "trend_up",    // 📈
    "\uD83D\uDCC9": "trend_down",  // 📉
    "\uD83D\uDCB0": "argent",      // 💰
    "\uD83D\uDCB5": "salaire",     // 💵
    "\uD83D\uDCB6": "argent",      // 💶
    "\uD83D\uDCC5": "calendrier",  // 📅
    "\uD83D\uDDD3": "calendrier",  // 🗓
    "\uD83C\uDFCE": "voiture",     // 🏎
    "\uD83D\uDE97": "voiture",     // 🚗
    "\u23F1": "chrono",        // ⏱
    "\u23F0": "chrono",        // ⏰
    "\uD83D\uDC64": "pilote",      // 👤
    "\uD83D\uDC65": "public",      // 👥
    "\uD83D\uDCE3": "medias",      // 📣
    "\uD83D\uDCE2": "medias",      // 📢
    "\uD83D\uDCF0": "actualite",   // 📰
    "\uD83D\uDCE7": "messages",    // 📧
    "\u2709": "messages",      // ✉
    "\uD83D\uDCAC": "commentaire", // 💬
    "\u2764": "bonheur",       // ❤
    "\uD83E\uDDE0": "mental",      // 🧠
    "\u2699": "parametres",    // ⚙
    "\uD83D\uDD0D": "analyse_donnees", // 🔍
    "\uD83D\uDCCA": "analyse_donnees", // 📊
    "\uD83D\uDCC1": "donnees",     // 📁
    "\uD83C\uDFC5": "champion",    // 🏅
    "\uD83D\uDEE0": "moteur",      // 🛠
    "\uD83D\uDD0B": "energie",     // 🔋
    "\uD83C\uDFAB": "paddock_pass",// 🎫
    "\uD83C\uDFE0": "maison",      // 🏠
    "\uD83D\uDCF1": "telephone",   // 📱
    "\uD83E\uDD1D": "poignee_main",// 🤝
    "\uD83D\uDEE1": "confort",     // 🛡
    "\uD83C\uDF93": "diplome",     // 🎓
    "\uD83D\uDCA4": "repos",       // 💤
    "\uD83C\uDFD6": "vacances",    // 🏖
    "\uD83D\uDD04": "reset"        // 🔄
  };

  // emojis sans équivalent pertinent : on les retire proprement
  var DROP = ["\uFE0F", "\u2728", "\uD83D\uDC4D", "\uD83D\uDC4E", "\uD83D\uDE4C", "\uD83D\uDE05", "\uD83D\uDE0A"];

  // plage large pour la détection (pictogrammes + symboles + drapeaux)
  var EMOJI_RE = /[\u2600-\u27BF\u2B00-\u2BFF\u2190-\u21FF\u2900-\u297F\uFE0F\u23E9-\u23FA]|\uD83C[\uDDE6-\uDDFF]|[\uD83C-\uD83E][\uDC00-\uDFFF]/g;
  // on ne touche PAS à ces caractères : ce sont des signes typographiques utiles
  var KEEP = { "\u2192": 1, "\u2190": 1, "\u2191": 1, "\u2193": 1, "\u2713": 1, "\u2714": 1, "\u2717": 1, "\u2718": 1, "\u2022": 1, "\u2026": 1, "\u25B8": 1, "\u25BE": 1, "\u00D7": 1 };

  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1, SVG: 1, PATH: 1, CANVAS: 1 };
  var MARK = "data-rj57";

  function icon(name, size) {
    try {
      if (typeof renderIcon === "function") return renderIcon(name, size || 14, "currentColor");
    } catch (e) {}
    return "";
  }

  // paire d'indicateurs régionaux (🇫🇷) -> code pays (FR)
  function regionalPair(str, i) {
    var a = str.charCodeAt(i), b = str.charCodeAt(i + 1);
    if (a !== 0xD83C) return null;
    var c = str.charCodeAt(i + 2), d = str.charCodeAt(i + 3);
    if (b < 0xDDE6 || b > 0xDDFF || c !== 0xD83C || d < 0xDDE6 || d > 0xDDFF) return null;
    var l1 = String.fromCharCode(65 + (b - 0xDDE6));
    var l2 = String.fromCharCode(65 + (d - 0xDDE6));
    return l1 + l2;
  }

  function flag(code) {
    try { if (typeof flagSvg === "function") return flagSvg(code, 14); } catch (e) {}
    return "";
  }

  // Convertit un texte en HTML avec icônes. Renvoie null si rien à faire.
  function convert(text) {
    if (!text) return null;
    EMOJI_RE.lastIndex = 0;
    if (!EMOJI_RE.test(text)) return null;

    var out = "", i = 0, changed = false;
    while (i < text.length) {
      // drapeau ?
      var code = regionalPair(text, i);
      if (code) {
        var f = flag(code);
        out += f || "";
        changed = true; i += 4; continue;
      }
      var ch = text[i], pair = text.substr(i, 2);
      var key = MAP[pair] ? pair : (MAP[ch] ? ch : null);
      if (key) {
        var svg = icon(MAP[key]);
        if (svg) {
          out += '<span style="display:inline-flex;vertical-align:-2px;line-height:0">' + svg + "</span>";
          changed = true; i += key.length; continue;
        }
      }
      if (DROP.indexOf(pair) >= 0) { changed = true; i += 2; continue; }
      if (DROP.indexOf(ch) >= 0) { changed = true; i += 1; continue; }
      // autre emoji non mappé : on le retire s'il n'est pas typographique
      if (!KEEP[ch]) {
        EMOJI_RE.lastIndex = 0;
        var isEmoji = EMOJI_RE.test(ch) || EMOJI_RE.test(pair);
        if (isEmoji) {
          // surrogate pair ?
          var cc = text.charCodeAt(i);
          var step = (cc >= 0xD800 && cc <= 0xDBFF) ? 2 : 1;
          changed = true; i += step; continue;
        }
      }
      out += ch.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      i++;
    }
    return changed ? out : null;
  }

  function processNode(node) {
    if (!node) return;
    var walker;
    try {
      walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
          var p = n.parentNode;
          if (!p || SKIP_TAGS[p.nodeName]) return NodeFilter.FILTER_REJECT;
          if (p.closest && p.closest("[" + MARK + "]")) return NodeFilter.FILTER_REJECT;
          return n.nodeValue && n.nodeValue.length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      });
    } catch (e) { return; }

    var targets = [], t;
    while ((t = walker.nextNode())) targets.push(t);

    for (var k = 0; k < targets.length; k++) {
      var tn = targets[k];
      var html = convert(tn.nodeValue);
      if (html === null) continue;
      var span = document.createElement("span");
      span.setAttribute(MARK, "1");
      span.innerHTML = html;
      if (tn.parentNode) tn.parentNode.replaceChild(span, tn);
    }
  }

  var pending = false;
  function schedule(node) {
    processNode(node);
    if (pending) return;
    pending = true;
    setTimeout(function () { pending = false; }, 60);
  }

  var obs = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var added = muts[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var n = added[j];
        if (n.nodeType === 1 || n.nodeType === 3) schedule(n.nodeType === 3 ? n.parentNode : n);
      }
    }
  });

  var tries = 0;
  function start() {
    if (!document.body || typeof renderIcon !== "function") {
      if (tries++ < 100) setTimeout(start, 100);
      return;
    }
    processNode(document.body);
    obs.observe(document.body, { childList: true, subtree: true });
    console.log("[57-emoji-to-icons] actif — emojis remplacés par les icônes du jeu");
  }

  window._rj57Uninstall = function () {
    obs.disconnect();
    console.log("[57-emoji-to-icons] désinstallé (rechargez la page)");
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
