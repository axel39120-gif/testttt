/* =====================================================================
 * 56-race-ux-tuning.js — CONFORT DE COURSE
 *
 * A. INCIDENTS DE COURSE REPLIABLES (écran résultat)
 *    L'écran de résultat déroulait la liste complète des incidents, ce qui
 *    noyait le classement. La liste est conservée mais repliée derrière son
 *    en-tête, qui devient un bouton « Incidents de course (N) ▾ ».
 *
 * B. MOINS D'ÉVÉNEMENTS EN COURSE (−60 %)
 *    Les événements arrivent par deux canaux :
 *      1. le calendrier pré-établi (buildLiveEventSchedule) ;
 *      2. les tirages par tour (triggerPassiveEvent / tryTriggerChoiceRaceEvent).
 *    On applique le même facteur 0,40 aux deux — soit 60 % d'événements en
 *    moins au total, sans toucher aux probabilités écrites dans le moteur.
 *
 * Le facteur est réglable : window._rj56Tuning.eventFactor (0,40 par défaut ;
 * 1 = comportement d'origine).
 *
 * C. PODIUM DES TROIS PREMIERS (écran résultat)
 *    Au-dessus du classement, un podium visuel : marches or / argent /
 *    bronze, avec pour chacun l'initiale du prénom, le nom et le drapeau
 *    du pays (via le rendu SVG de drapeaux déjà présent dans le jeu).
 *
 * D. WEEK-END 50 % PLUS LENT
 *    getSimSpeedMult() pilote la cadence des qualifs et de la course.
 *    On le multiplie par 2 : toutes les phases prennent deux fois plus de
 *    temps. (Les essais libres ont leurs propres constantes, doublées
 *    directement dans 30-essais-consolidated.js.)
 *
 * Réversible : window._rj56Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TUNING = { eventFactor: 0.42 };
  var wrapped = {};

  /* ---------------------------------------------------------- A. incidents */
  var MARK = "data-rj56-collapsed";

  function collapseIncidents(root) {
    var scope = (root && root.querySelectorAll) ? root : document;
    var headers;
    try { headers = scope.querySelectorAll("div"); } catch (e) { return; }
    for (var i = 0; i < headers.length; i++) {
      var h = headers[i];
      if (h.getAttribute(MARK)) continue;
      var txt = (h.textContent || "").trim();
      // en-tête exact de la section (le titre seul, pas le conteneur entier)
      if (!/^Incidents de course \(\d+\)$/.test(txt)) continue;
      var box = h.parentNode;
      if (!box) continue;

      // les frères qui suivent l'en-tête = les lignes d'incidents
      var items = [];
      var n = h.nextSibling;
      while (n) {
        if (n.nodeType === 1) items.push(n);
        n = n.nextSibling;
      }
      // IMPORTANT : ne marquer comme traité QUE si les lignes existent déjà.
      // L'en-tête est inséré avant elles : marquer trop tôt empêcherait
      // définitivement le repli lors du passage suivant.
      if (!items.length) continue;
      h.setAttribute(MARK, "1");

      var open = false;
      items.forEach(function (el) { el.style.display = "none"; });

      h.style.cursor = "pointer";
      h.style.userSelect = "none";
      h.style.touchAction = "manipulation";
      h.style.display = "flex";
      h.style.alignItems = "center";
      h.style.justifyContent = "space-between";

      var caret = document.createElement("span");
      caret.textContent = "▾";
      caret.style.cssText = "font-size:12px;opacity:.8;transition:transform .15s";
      h.appendChild(caret);

      function toggle() {
        open = !open;
        items.forEach(function (el) { el.style.display = open ? "" : "none"; });
        caret.style.transform = open ? "rotate(180deg)" : "";
      }
      h.addEventListener("click", toggle);
      h.addEventListener("touchend", function () { }, { passive: true });
    }
  }

  var obs = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var added = muts[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        if (added[j].nodeType === 1) collapseIncidents(added[j]);
      }
    }
    // le contenu du résultat est réécrit en bloc : on repasse sur l'écran
    collapseIncidents(document.getElementById("res-content"));
    buildPodium();
  });

  /* ------------------------------------------------- B. moins d'événements */
  function wrapChance(name) {
    if (typeof window[name] !== "function" || window[name]._rj56) return false;
    var orig = window[name];
    var fn = function () {
      // on laisse passer seulement une fraction des déclenchements
      if (Math.random() >= TUNING.eventFactor) return;
      return orig.apply(this, arguments);
    };
    fn._rj56 = true;
    wrapped[name] = orig;
    window[name] = fn;
    return true;
  }

  function wrapSchedule() {
    if (typeof window.buildLiveEventSchedule !== "function") return false;
    if (window.buildLiveEventSchedule._rj56) return true;
    var orig = window.buildLiveEventSchedule;
    var fn = function () {
      var sched = orig.apply(this, arguments);
      try {
        if (Object.prototype.toString.call(sched) === "[object Array]") {
          var kept = sched.filter(function (ev) {
            if (ev && ev.always && Math.random() < 0.6) return true; // imposés : largement conservés
            return Math.random() < TUNING.eventFactor;
          });
          return kept;
        }
      } catch (e) {}
      return sched;
    };
    fn._rj56 = true;
    wrapped.buildLiveEventSchedule = orig;
    window.buildLiveEventSchedule = fn;
    return true;
  }


  /* --------------------------------------------------- C. podium top 3 */
  var PODIUM_ID = "rj56-podium";
  var MEDALS = [
    { c: "#d4a842", h: 92,  label: "1" },   // or
    { c: "#9098b0", h: 68,  label: "2" },   // argent
    { c: "#c07840", h: 52,  label: "3" }    // bronze
  ];

  // "Charles Leclerc" -> "C. Leclerc"
  function shortName(full) {
    var s = String(full || "").trim().replace(/\s+/g, " ");
    if (!s) return "";
    var parts = s.split(" ");
    if (parts.length === 1) return parts[0];
    return parts[0].charAt(0).toUpperCase() + ". " + parts.slice(1).join(" ");
  }

  function natOf(d) {
    try {
      if (d.isPlayer) return (G.pilot && G.pilot.nat) || "FR";
      if (d.nat) return d.nat;
      if (typeof d.rivalIdx === "number" && G.rivals && G.rivals[d.rivalIdx]) {
        return G.rivals[d.rivalIdx].nat || "FR";
      }
    } catch (e) {}
    return "FR";
  }

  function flagOf(code) {
    try { if (typeof flagSvg === "function") return flagSvg(code, 16); } catch (e) {}
    return "";
  }

  function top3() {
    try {
      var d = (window.LIVE_RACE && LIVE_RACE.drivers) ? LIVE_RACE.drivers.slice() : [];
      d = d.filter(function (x) { return x && !x.dnf && typeof x.pos === "number"; });
      d.sort(function (a, b) { return a.pos - b.pos; });
      return d.slice(0, 3);
    } catch (e) { return []; }
  }

  function buildPodium() {
    var host = document.getElementById("res-content");
    if (!host || document.getElementById(PODIUM_ID)) return;
    var t = top3();
    if (t.length < 3) return;

    var wrap = document.createElement("div");
    wrap.id = PODIUM_ID;
    wrap.style.cssText =
      "margin:10px 14px 12px;padding:16px 12px 0;background:linear-gradient(180deg,var(--bg2) 0%,var(--bg) 100%);" +
      "border:1px solid var(--border-hi);border-radius:var(--r);overflow:hidden";

    var row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:flex-end;justify-content:center;gap:8px";

    // ordre visuel : 2e, 1er, 3e
    [1, 0, 2].forEach(function (idx) {
      var d = t[idx], m = MEDALS[idx];
      if (!d) return;
      var col = document.createElement("div");
      col.style.cssText = "flex:1 1 0;max-width:120px;display:flex;flex-direction:column;align-items:center;text-align:center";

      var nameBox = document.createElement("div");
      nameBox.style.cssText = "margin-bottom:6px;min-height:40px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px";
      var flag = document.createElement("div");
      flag.style.cssText = "line-height:0";
      flag.innerHTML = flagOf(natOf(d));
      var nm = document.createElement("div");
      nm.style.cssText = "font-family:var(--font-display);font-size:11px;font-weight:800;letter-spacing:.02em;color:" +
        (d.isPlayer ? "var(--white)" : "var(--text2)") + ";line-height:1.2;word-break:break-word";
      nm.textContent = shortName(d.name);
      nameBox.appendChild(flag); nameBox.appendChild(nm);

      var step = document.createElement("div");
      step.style.cssText =
        "width:100%;height:" + m.h + "px;border-radius:6px 6px 0 0;" +
        "background:linear-gradient(180deg," + m.c + "40 0%," + m.c + "12 100%);" +
        "border:1px solid " + m.c + ";border-bottom:none;display:flex;align-items:flex-start;justify-content:center;padding-top:8px" +
        (d.isPlayer ? ";box-shadow:0 0 16px " + m.c + "55" : "");
      var num = document.createElement("div");
      num.style.cssText = "font-family:var(--font-display);font-size:22px;font-weight:900;color:" + m.c + ";line-height:1";
      num.textContent = m.label;
      step.appendChild(num);

      col.appendChild(nameBox); col.appendChild(step);
      row.appendChild(col);
    });

    wrap.appendChild(row);
    host.insertBefore(wrap, host.firstChild);
  }

  /* ------------------------------------------- D. week-end 50 % plus lent */
  var SPEED_FACTOR = 2;
  function installSpeed() {
    if (typeof window.getSimSpeedMult !== "function") return false;
    if (window.getSimSpeedMult._rj56) return true;
    var orig = window.getSimSpeedMult;
    var fn = function () {
      var v = orig.apply(this, arguments);
      return (typeof v === "number" ? v : 1.8) * SPEED_FACTOR;
    };
    fn._rj56 = true;
    wrapped.getSimSpeedMult = orig;
    window.getSimSpeedMult = fn;
    return true;
  }

  /* ------------------------------------------------------------------ boot */
  var tries = 0;
  function boot() {
    var a = wrapChance("triggerPassiveEvent");
    var b = wrapChance("tryTriggerChoiceRaceEvent");
    var c = wrapSchedule();
    var d = installSpeed();
    if (document.body) {
      collapseIncidents(document);
      buildPodium();
      obs.observe(document.body, { childList: true, subtree: true });
    }
    if (a && b && c && d && document.body) {
      console.log("[56-race-ux-tuning] actif — événements −" + Math.round((1 - TUNING.eventFactor) * 100) +
                  " %, incidents repliables, podium top 3, week-end ×" + SPEED_FACTOR + " plus lent");
      return;
    }
    if (tries++ < 80) setTimeout(boot, 80);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj56Uninstall = function () {
    obs.disconnect();
    Object.keys(wrapped).forEach(function (k) { window[k] = wrapped[k]; });
    console.log("[56-race-ux-tuning] désinstallé");
  };
  window._rj56Tuning = TUNING;
})();
