/* =====================================================================
 * 45-diag-strategy.js — SONDE DE DIAGNOSTIC (TEMPORAIRE, À RETIRER APRÈS)
 *
 * Bandeau à l'écran (pas besoin de console) qui trace deux choses :
 *
 * A) SÉLECTEUR DE STYLE (modal stratégie) :
 *    👆 le tap atteint-il une case ?       (sinon : zone non cliquable)
 *    ▶ la fonction pick est-elle appelée ?  (sinon : onclick mort sous WebKit)
 *    état=… UI=…                            (DESYNC = re-render échoue)
 *
 * B) FIN DE COURSE (boucle infinie) :
 *    ◆ finalize cur=…/…   ◆ showResult      (déroulé normal de fin)
 *    ⚠ runRaceLive #n APRES FINALIZE        (= la course est relancée)
 *    ⚠ cur X→Y (RELANCE?)                    (= le compteur de tours a chuté)
 *    ❌ message @fichier:ligne               (toute erreur JS)
 *
 * Lecture seule, ne modifie aucun comportement. Désactivation : _rjDiagOff().
 * =================================================================== */
(function () {
  "use strict";

  var lines = [];
  var box = null;

  function ensureBox() {
    if (box && box.parentNode) return box;
    box = document.createElement("div");
    box.id = "_rj-diag";
    box.style.cssText = [
      "position:fixed", "top:0", "left:0", "right:0", "z-index:2147483647",
      "background:rgba(0,0,0,0.88)", "color:#19ff5a",
      "font:11px/1.45 ui-monospace,Menlo,Consolas,monospace",
      "padding:6px 9px", "max-height:46vh", "overflow:auto",
      "white-space:pre-wrap", "pointer-events:none",
      "border-bottom:2px solid #19ff5a"
    ].join(";");
    (document.body || document.documentElement).appendChild(box);
    return box;
  }
  function log(s) {
    var d = new Date();
    var t = ("0" + d.getMinutes()).slice(-2) + ":" + ("0" + d.getSeconds()).slice(-2);
    lines.push(t + "  " + s);
    if (lines.length > 16) lines.shift();
    var b = ensureBox();
    b.textContent = lines.join("\n");
    b.scrollTop = b.scrollHeight;
  }
  window.__rjDiagLog = log;

  // ---- erreurs JS globales ----
  window.addEventListener("error", function (e) {
    log("\u274C " + (e.message || "?") + "  @" + ((e.filename || "").split("/").pop()) + ":" + (e.lineno || "?"));
  });

  // ================= A) SÉLECTEUR DE STYLE =================
  function nearestCase(node) {
    while (node && node.nodeType !== 1) node = node.parentNode;
    return node && node.closest ? node.closest('[onclick*="_rjStratPick"]') : null;
  }
  ["touchend", "click"].forEach(function (type) {
    document.addEventListener(type, function (ev) {
      var caseEl = nearestCase(ev.target);
      if (caseEl) {
        var oc = caseEl.getAttribute("onclick") || "";
        var m = oc.match(/_rjStratPick(\w+)\('(\w+)'/);
        log("\uD83D\uDC46 " + type + " \u2192 " + (m ? m[1] + ":" + m[2] : "case"));
      }
    }, true);
  });
  function uiSelectedStyle() {
    var modal = document.getElementById("race-strategy-modal");
    if (!modal) return "?";
    var cs = modal.querySelectorAll('[onclick*="_rjStratPickStyle"]');
    for (var i = 0; i < cs.length; i++) {
      var stl = cs[i].getAttribute("style") || "";
      var oc = (cs[i].getAttribute("onclick") || "").match(/'(\w+)'/);
      if (stl.indexOf("#252533") < 0 && oc) return oc[1];
    }
    return "?";
  }
  function wrapPick(name) {
    var orig = window[name];
    if (typeof orig !== "function") { setTimeout(function () { wrapPick(name); }, 300); return; }
    if (orig.__rjWrapped) return;
    var w = function (id) {
      log("\u25B6 " + name.replace("_rjStratPick", "") + "(" + id + ")");
      try { orig.apply(this, arguments); }
      catch (e) { log("  \u2716 throw: " + e.message); throw e; }
      setTimeout(function () {
        try {
          var st = (typeof G !== "undefined" && G && G._raceStrategy) ? G._raceStrategy.style : "?";
          var ui = uiSelectedStyle();
          log("  \u00E9tat=" + st + "  UI=" + ui + (name.indexOf("Style") >= 0 ? (st !== ui ? "  \u26A0 DESYNC" : "  \u2713") : ""));
        } catch (e) {}
      }, 45);
    };
    w.__rjWrapped = true;
    window[name] = w;
  }
  wrapPick("_rjStratPickStyle");
  wrapPick("_rjStratPickCompound");

  // ================= B) FIN DE COURSE =================
  var _rrlCount = 0, _finalizeSeen = false;
  function traceRace(name, prefix) {
    var orig = window[name];
    if (typeof orig !== "function") { setTimeout(function () { traceRace(name, prefix); }, 300); return; }
    if (orig.__rjTraced) return;
    var w = function () {
      try {
        if (name === "runRaceLive") {
          _rrlCount++;
          log(prefix + " #" + _rrlCount + (_finalizeSeen ? "  \u26A0 APRES FINALIZE = RELANCE" : ""));
        } else if (name === "finalizeLiveRace") {
          _finalizeSeen = true;
          var cur = (typeof LIVE_RACE !== "undefined" && LIVE_RACE) ? LIVE_RACE.cur : "?";
          var tot = (typeof LIVE_RACE !== "undefined" && LIVE_RACE) ? LIVE_RACE.total : "?";
          log(prefix + "  cur=" + cur + "/" + tot);
        } else {
          log(prefix);
        }
      } catch (e) {}
      try { return orig.apply(this, arguments); }
      catch (e) { log("  \u274C " + name + ": " + e.message); throw e; }
    };
    w.__rjTraced = true;
    try { for (var k in orig) { if (Object.prototype.hasOwnProperty.call(orig, k)) w[k] = orig[k]; } } catch (e) {}
    window[name] = w;
  }
  function installRaceTraces() {
    traceRace("finalizeLiveRace", "\u25C6 finalize");
    traceRace("showResult", "\u25C6 showResult");
    traceRace("runRaceLive", "\u26A0 runRaceLive");
  }
  // 04j (re)pose ses propres wraps ~200ms après son chargement : on reprend
  // le dessus à plusieurs reprises (traceRace ne re-wrappe que si écrasé).
  installRaceTraces();
  setTimeout(installRaceTraces, 1500);
  setTimeout(installRaceTraces, 3500);

  // moniteur : le compteur de tours chute-t-il (relance) ?
  var _lastCur = -1;
  setInterval(function () {
    try {
      if (typeof LIVE_RACE === "undefined" || !LIVE_RACE) return;
      var c = LIVE_RACE.cur, t = LIVE_RACE.total;
      if (typeof c === "number") {
        if (_lastCur >= 2 && c < _lastCur - 1) {
          log("\u26A0 cur " + _lastCur + "\u2192" + c + "  (RELANCE? total=" + t + ")");
        }
        _lastCur = c;
      }
    } catch (e) {}
  }, 500);

  window._rjDiagOff = function () {
    if (box && box.parentNode) box.parentNode.removeChild(box);
    box = null;
    log = function () {};
  };

  log("DIAG actif \u2014 teste le style ET termine une course");
})();
