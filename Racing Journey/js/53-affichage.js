/* =====================================================================
 * 53-affichage.js — AJUSTEMENTS D'AFFICHAGE
 *
 * Regroupe neuf modules qui n'ont qu'un point commun, mais décisif : ils
 * ne touchent qu'à la présentation. Aucun ne modifie l'état du jeu, aucun
 * n'intervient dans la simulation. Ils corrigent un écran, adaptent une
 * taille, mettent une notification en file, ajustent une densité.
 *
 * Ils étaient éparpillés sur neuf fichiers parce qu'ils ont été écrits à
 * neuf moments différents, pas parce qu'ils relèvent de neuf sujets.
 *
 * L'ordre de chargement d'origine est conservé : certains ajustements
 * s'appuient sur ceux qui précèdent (l'adaptation à la fenêtre avant la
 * densité, par exemple). Chaque partie garde sa désinstallation.
 * =================================================================== */

/* ==================================================================== *
 * Écran de résultat — corrections d'affichage
 * (anciennement 53-result-screen-fix.js)
 * ==================================================================== */

(function () {
  "use strict";

  function fix() {
    var rtRes = document.getElementById("rt-res");
    var rtCourse = document.getElementById("rt-course");
    if (!rtRes || !rtCourse) return false;
    // déjà frères ? rien à faire
    if (rtRes.parentElement === rtCourse) {
      var host = rtCourse.parentElement;
      if (!host) return false;
      // insérer rt-res juste après rt-course, dans le même parent
      if (rtCourse.nextSibling) host.insertBefore(rtRes, rtCourse.nextSibling);
      else host.appendChild(rtRes);
      // s'assurer qu'il reste masqué tant qu'on ne bascule pas dessus
      rtRes.style.display = "none";
      console.log("[53-result-screen-fix] #rt-res re-parenté comme frère de #rt-course");
    }
    return true;
  }

  var tries = 0;
  function boot() {
    if (fix()) return;
    if (tries++ < 60) setTimeout(boot, 60);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj53Uninstall = function () {
    console.log("[53-result-screen-fix] désinstallé (rechargez pour revenir à l'origine)");
  };
})();


/* ==================================================================== *
 * Notifications — mise en file hors de l'accueil
 * (anciennement 58-toast-scope.js)
 * ==================================================================== */

(function () {
  "use strict";

  var HOME = "S-home";       // écran d'accueil de carrière
  var MAX_QUEUE = 6;
  var queue = [];
  var origPush = null;
  var wrapped = {};

  function currentScreen() {
    try {
      var el = document.querySelector(".scr.on");
      return el ? el.id : null;
    } catch (e) { return null; }
  }

  function onHome() { return currentScreen() === HOME; }

  function enqueue(args) {
    var key = String(args[0] || "") + "|" + String(args[1] || "");
    for (var i = 0; i < queue.length; i++) {
      if (queue[i].key === key) return;   // doublon : on ne l'ajoute pas deux fois
    }
    queue.push({ key: key, args: args });
    if (queue.length > MAX_QUEUE) queue.shift();
  }

  function flush() {
    if (!origPush || !queue.length || !onHome()) return;
    var pending = queue.slice();
    queue.length = 0;
    // léger décalage pour laisser l'accueil se dessiner, puis on espace les toasts
    pending.forEach(function (item, i) {
      setTimeout(function () {
        try { origPush.apply(null, item.args); } catch (e) {}
      }, 400 + i * 220);
    });
  }

  function installPush() {
    if (typeof window.pushHomeToast !== "function") return false;
    if (window.pushHomeToast._rj58) return true;
    origPush = window.pushHomeToast;
    var fn = function () {
      var args = Array.prototype.slice.call(arguments);
      if (onHome()) {
        try { return origPush.apply(this, args); } catch (e) { return; }
      }
      enqueue(args);   // ailleurs : on garde pour plus tard
    };
    fn._rj58 = true;
    window.pushHomeToast = fn;
    return true;
  }

  // Vider la file dès que le joueur revient sur l'accueil.
  function wrapNav(name) {
    if (typeof window[name] !== "function" || window[name]._rj58) return false;
    var orig = window[name];
    var fn = function () {
      var r = orig.apply(this, arguments);
      try { if (onHome()) flush(); } catch (e) {}
      return r;
    };
    fn._rj58 = true;
    wrapped[name] = orig;
    window[name] = fn;
    return true;
  }

  var tries = 0;
  function boot() {
    var a = installPush();
    var b = wrapNav("go");
    var c = wrapNav("navTo");
    wrapNav("refreshScreen");
    if (a && b && c) {
      if (onHome()) flush();
      console.log("[58-toast-scope] actif — notifications limitées à l'accueil (file d'attente ailleurs)");
      return;
    }
    if (tries++ < 80) setTimeout(boot, 80);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj58Uninstall = function () {
    if (origPush) { window.pushHomeToast = origPush; origPush = null; }
    Object.keys(wrapped).forEach(function (k) { window[k] = wrapped[k]; });
    queue.length = 0;
    console.log("[58-toast-scope] désinstallé");
  };
  window._rj58Queue = function () { return queue.slice(); };
})();


/* ==================================================================== *
 * Page des événements — mise en forme
 * (anciennement 59-events-page-design.js)
 * ==================================================================== */

(function () {
  "use strict";

  var STYLE_ID = "rj59-events-design";

  var CSS = [
    /* ---- carte d'événement ---- */
    "#evt-media-list .rep-evt-card{",
    "  position:relative;margin:10px 14px;padding:16px 14px 14px;",
    "  background:linear-gradient(160deg,var(--bg2) 0%,var(--bg) 100%);",
    "  border:1px solid var(--border-hi);border-left:1px solid var(--border-hi);",
    "  border-top:2px solid var(--red,#FF1801);",
    "  border-radius:var(--r,10px);overflow:hidden;",
    "}",
    /* halo discret en haut à droite, comme sur l'écran de résultat */
    "#evt-media-list .rep-evt-card::after{",
    "  content:'';position:absolute;top:-18px;right:-18px;width:90px;height:90px;",
    "  background:radial-gradient(circle,rgba(255,24,1,.16) 0%,transparent 70%);",
    "  pointer-events:none;",
    "}",

    /* ---- titre ---- */
    "#evt-media-list .rep-evt-title{",
    "  font-family:var(--font-display);font-size:13px;font-weight:900;",
    "  letter-spacing:.05em;text-transform:uppercase;color:var(--white,#fff);",
    "  margin-bottom:2px;line-height:1.25;",
    "}",

    /* ---- contexte ---- */
    "#evt-media-list .rep-evt-desc{",
    "  font-size:12.5px;color:var(--text2);line-height:1.55;",
    "  margin:6px 0 12px;padding-left:10px;",
    "  border-left:2px solid rgba(255,255,255,.07);",
    "}",

    /* ---- liste de choix ---- */
    "#evt-media-list .rep-evt-choices{display:flex;flex-direction:column;gap:7px}",

    /* ---- bouton de choix ---- */
    "#evt-media-list .rep-choice-btn{",
    "  position:relative;display:block;width:100%;text-align:left;",
    "  padding:12px 30px 12px 13px;",
    "  background:rgba(255,255,255,.035);",
    "  border:2px solid var(--border-hi);border-radius:10px;",
    "  color:var(--text);font-family:inherit;font-size:12.5px;font-weight:600;line-height:1.35;",
    "  cursor:pointer;touch-action:manipulation;-webkit-appearance:none;appearance:none;",
    "  transition:border-color .15s,background .15s,transform .08s;",
    "}",
    "#evt-media-list .rep-choice-btn::after{",
    "  content:'\\203A';position:absolute;right:12px;top:50%;transform:translateY(-50%);",
    "  font-size:17px;line-height:1;color:var(--text3);",
    "}",
    "#evt-media-list .rep-choice-btn:hover{",
    "  border-color:var(--red,#FF1801);background:rgba(255,24,1,.07);",
    "}",
    "#evt-media-list .rep-choice-btn:active{transform:scale(.985)}",

    /* ---- pastilles d'effet (spans en style inline dans le bouton) ---- */
    "#evt-media-list .rep-choice-btn span{",
    "  display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;",
    "  font-family:var(--font-display)!important;font-size:10px!important;font-weight:800!important;",
    "  letter-spacing:.04em;background:rgba(255,255,255,.06);",
    "  border:1px solid rgba(255,255,255,.10);",
    "}",
    "#evt-media-list .rep-choice-btn > div{",
    "  margin-top:8px!important;display:flex;gap:6px;flex-wrap:wrap;",
    "}",

    /* ---- état vide ---- */
    "#evt-media-list > div[style*='color:var(--text3)']{",
    "  margin:10px 14px;padding:16px 14px!important;",
    "  background:linear-gradient(160deg,var(--bg2) 0%,var(--bg) 100%);",
    "  border:1px solid var(--border-hi);border-radius:var(--r,10px);",
    "  font-size:12.5px!important;line-height:1.55;",
    "}",

    /* ---- historique ---- */
    "#evt-history-list > div{",
    "  margin:6px 14px;padding:10px 12px;",
    "  background:var(--bg3);border:1px solid var(--border);",
    "  border-radius:8px;font-size:12px;",
    "}"
  ].join("\n");

  function install() {
    if (document.getElementById(STYLE_ID)) return true;
    if (!document.head) return false;
    var st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent = CSS;
    document.head.appendChild(st);
    return true;
  }

  var tries = 0;
  function boot() {
    if (install()) {
      console.log("[59-events-page-design] page événements alignée sur le design actuel");
      return;
    }
    if (tries++ < 60) setTimeout(boot, 100);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj59Uninstall = function () {
    var st = document.getElementById(STYLE_ID);
    if (st && st.parentNode) st.parentNode.removeChild(st);
    console.log("[59-events-page-design] désinstallé");
  };
})();


/* ==================================================================== *
 * Ajustement automatique des écrans
 * (anciennement 60-auto-screen-fit.js)
 * ==================================================================== */

(function () {
  "use strict";

  var SETTINGS_KEY = "rj_settings_v1";
  var wrapped = {};
  var resizeTimer = null;

  function bounds() {
    if (typeof APP_SIZE_BOUNDS !== "undefined" && APP_SIZE_BOUNDS) return APP_SIZE_BOUNDS;
    return { width: { min: 340, max: 600, step: 10, default: 430 },
             height: { min: 700, max: 1200, step: 20, default: 932 } };
  }

  function viewport() {
    var w, h;
    try {
      if (window.visualViewport && window.visualViewport.width) {
        w = window.visualViewport.width; h = window.visualViewport.height;
      }
    } catch (e) {}
    if (!w) { w = window.innerWidth || document.documentElement.clientWidth; }
    if (!h) { h = window.innerHeight || document.documentElement.clientHeight; }
    return { w: Math.round(w), h: Math.round(h) };
  }

  // Ramène dans les bornes, aligné sur le pas, arrondi vers le bas.
  function fit(value, b) {
    var v = Math.floor(value / b.step) * b.step;
    if (v < b.min) v = b.min;
    if (v > b.max) v = b.max;
    return v;
  }

  function detect() {
    var b = bounds(), vp = viewport();
    return { width: fit(vp.w, b.width), height: fit(vp.h, b.height), vp: vp };
  }

  function applyDetected(persist) {
    if (typeof SETTINGS === "undefined" || !SETTINGS) return null;
    var d = detect();
    SETTINGS.appWidth = d.width;
    SETTINGS.appHeight = d.height;
    if (persist !== false) {
      try { if (typeof saveSettings === "function") saveSettings(); } catch (e) {}
    }
    try { if (typeof applyAppSize === "function") applyAppSize(); } catch (e) {}
    try { if (typeof renderDisplaySetup === "function" &&
               document.getElementById("display-setup-content")) renderDisplaySetup(); } catch (e) {}
    return d;
  }

  /* --------------------------------------------- 1. première installation */
  function isFreshInstall() {
    try { return !localStorage.getItem(SETTINGS_KEY); } catch (e) { return false; }
  }

  /* ------------------------------------------------- 2. bouton réutilisable */
  function makeButton(label, onTap) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.style.cssText =
      "width:100%;padding:12px;margin:10px 0 2px;border-radius:10px;cursor:pointer;" +
      "background:rgba(0,212,255,.10);border:2px solid var(--teal,#00D4FF);color:var(--teal,#00D4FF);" +
      "font-family:var(--font-display);font-size:11px;font-weight:800;letter-spacing:.08em;" +
      "text-transform:uppercase;touch-action:manipulation;-webkit-appearance:none;appearance:none;";
    btn.addEventListener("click", onTap);
    return btn;
  }

  function feedback(btn, d) {
    var old = btn.textContent;
    btn.textContent = "Ajusté : " + d.width + " × " + d.height;
    setTimeout(function () { btn.textContent = old; }, 1800);
  }

  // bouton sur l'écran de calibrage du premier lancement
  function injectSetupButton() {
    var host = document.getElementById("display-setup-content");
    if (!host || document.getElementById("rj60-setup-btn")) return;
    var btn = makeButton("Ajuster automatiquement à mon écran", function () {
      var d = applyDetected(true);
      if (d) feedback(btn, d);
    });
    btn.id = "rj60-setup-btn";
    host.parentNode.insertBefore(btn, host.nextSibling);
  }

  /* ------------------------------------------------------------------
   * PARAMÈTRES — refonte du réglage d'écran et retrait du mode clair
   *
   * Avant : une section « Apparence » proposant un thème clair jamais
   * abouti, une section « Affichage » avec deux curseurs bruts, et la carte
   * ajoutée par ce module — soit deux endroits pour régler la même chose.
   *
   * Après : un bloc unique, avec un aperçu du téléphone aux proportions
   * réelles, des incréments au pas des molettes, trois formats prêts à
   * l'emploi et la détection automatique.
   * ---------------------------------------------------------------- */

  function forcerThemeSombre() {
    try {
      if (typeof SETTINGS !== "undefined" && SETTINGS && SETTINGS.theme === "light") {
        SETTINGS.theme = "dark";
        if (typeof saveSettings === "function") saveSettings();
      }
      var root = document.documentElement;
      if (root) root.classList.remove("theme-light");
    } catch (e) {}
  }

  // Retire la section « Apparence » (titre + choix de thème).
  function retirerApparence(host) {
    var enfants = Array.prototype.slice.call(host.children);
    for (var i = 0; i < enfants.length; i++) {
      var el = enfants[i];
      if (el.querySelector && el.querySelector('[onclick*="theme"]')) {
        var titre = enfants[i - 1];
        if (titre && /apparence/i.test(titre.textContent || "")) titre.style.display = "none";
        el.style.display = "none";
        return;
      }
    }
  }

  function ligneReglage(label, valeur, unite, moins, plus) {
    return '' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;' +
      'padding:9px 0;border-top:1px solid rgba(255,255,255,.05)">' +
        '<div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:var(--dim,#6b6b78);' +
        'letter-spacing:.12em;text-transform:uppercase">' + label + '</div>' +
        '<div style="display:flex;align-items:center;gap:8px">' +
          '<button type="button" data-act="' + moins + '" style="' + styleStepper() + '">−</button>' +
          '<div style="min-width:64px;text-align:center;font-family:var(--font-display);font-size:15px;' +
          'font-weight:900;color:var(--white,#fff)">' + valeur + '<span style="font-size:9px;color:var(--dim,#6b6b78);' +
          'margin-left:3px">' + unite + '</span></div>' +
          '<button type="button" data-act="' + plus + '" style="' + styleStepper() + '">+</button>' +
        '</div>' +
      '</div>';
  }

  function styleStepper() {
    return "width:34px;height:34px;border-radius:9px;background:rgba(255,255,255,.05);" +
           "border:1px solid var(--border-hi);color:var(--text);font-size:17px;line-height:1;" +
           "cursor:pointer;touch-action:manipulation;-webkit-appearance:none;appearance:none;" +
           "display:flex;align-items:center;justify-content:center;font-weight:700;";
  }

  function stylePreset(actif) {
    return "flex:1;padding:9px 4px;border-radius:9px;cursor:pointer;touch-action:manipulation;" +
           "-webkit-appearance:none;appearance:none;font-family:var(--font-display);font-size:9.5px;" +
           "font-weight:800;letter-spacing:.06em;text-transform:uppercase;" +
           (actif
             ? "background:rgba(0,212,255,.14);border:1.5px solid var(--teal,#00D4FF);color:var(--teal,#00D4FF);"
             : "background:rgba(255,255,255,.04);border:1.5px solid var(--border-hi);color:var(--text2);");
  }

  // Aperçu : une silhouette de téléphone aux proportions réglées.
  function apercuHTML(w, h) {
    var maxH = 104;
    var ratio = w / h;
    var ph = maxH, pw = Math.round(maxH * ratio);
    var vp = viewport();
    var deborde = (w > vp.w + 1);
    var col = deborde ? "#F59E0B" : "var(--teal,#00D4FF)";
    return '' +
      '<div style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:6px">' +
        '<div style="width:' + pw + 'px;height:' + ph + 'px;border-radius:9px;border:1.5px solid ' + col + ';' +
        'background:linear-gradient(180deg,rgba(255,255,255,.06) 0%,rgba(255,255,255,.02) 100%);' +
        'padding:5px 4px;display:flex;flex-direction:column;gap:3px;box-sizing:border-box">' +
          '<div style="height:7px;border-radius:2px;background:' + col + '55"></div>' +
          '<div style="flex:1;border-radius:3px;background:rgba(255,255,255,.05)"></div>' +
          '<div style="height:9px;border-radius:2px;background:rgba(255,255,255,.10)"></div>' +
        '</div>' +
        '<div style="font-family:var(--font-display);font-size:8.5px;font-weight:800;letter-spacing:.1em;' +
        'text-transform:uppercase;color:' + (deborde ? "#F59E0B" : "var(--dim,#6b6b78)") + '">' +
        (deborde ? "dépasse l'écran" : "aperçu") + '</div>' +
      '</div>';
  }

  var PRESETS = [
    { id: "compact", nom: "Compact", w: 360, h: 760 },
    { id: "standard", nom: "Standard", w: 400, h: 860 },
    { id: "large", nom: "Large", w: 440, h: 940 }
  ];

  function blocHTML() {
    var b = bounds();
    var w = (SETTINGS && SETTINGS.appWidth) || b.width.default;
    var h = (SETTINGS && SETTINGS.appHeight) || b.height.default;
    var vp = viewport();
    var auto = !!(SETTINGS && SETTINGS.appAutoSize);

    var presets = PRESETS.map(function (p) {
      var actif = (Math.abs(p.w - w) <= 10 && Math.abs(p.h - h) <= 20);
      return '<button type="button" data-act="preset:' + p.id + '" style="' + stylePreset(actif) + '">' + p.nom + '</button>';
    }).join("");

    return '' +
      '<div id="rj60-bloc" style="margin:10px 14px;padding:14px;border-radius:var(--r,10px);' +
      'background:linear-gradient(160deg,var(--bg2) 0%,var(--bg) 100%);border:1px solid var(--border-hi)">' +

        '<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--dim,#6b6b78);' +
        'letter-spacing:.14em;text-transform:uppercase;margin-bottom:10px">Zone de jeu</div>' +

        '<div style="display:flex;align-items:center;gap:14px">' +
          apercuHTML(w, h) +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-size:11.5px;color:var(--text2);line-height:1.45;margin-bottom:2px">' +
            'Écran détecté <strong style="color:var(--text)">' + vp.w + ' × ' + vp.h + '</strong></div>' +
            ligneReglage("Largeur", w, "px", "w-", "w+") +
            ligneReglage("Hauteur", h, "px", "h-", "h+") +
          '</div>' +
        '</div>' +

        '<div style="display:flex;gap:6px;margin-top:12px">' + presets + '</div>' +

        '<button type="button" data-act="auto" style="width:100%;margin-top:8px;padding:12px;border-radius:10px;' +
        'cursor:pointer;touch-action:manipulation;-webkit-appearance:none;appearance:none;' +
        'background:rgba(0,212,255,.10);border:2px solid var(--teal,#00D4FF);color:var(--teal,#00D4FF);' +
        'font-family:var(--font-display);font-size:11px;font-weight:800;letter-spacing:.08em;' +
        'text-transform:uppercase">Ajuster à mon écran</button>' +

        '<label style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:11.5px;' +
        'color:var(--text2);cursor:pointer">' +
          '<input type="checkbox" data-act="autotoggle"' + (auto ? " checked" : "") + '>' +
          'Réajuster automatiquement (rotation, changement d\'écran)' +
        '</label>' +
      '</div>';
  }

  function appliquer(w, h) {
    var b = bounds();
    if (typeof SETTINGS === "undefined" || !SETTINGS) return;
    SETTINGS.appWidth = Math.max(b.width.min, Math.min(b.width.max, w));
    SETTINGS.appHeight = Math.max(b.height.min, Math.min(b.height.max, h));
    try { if (typeof saveSettings === "function") saveSettings(); } catch (e) {}
    try { if (typeof applyAppSize === "function") applyAppSize(); } catch (e) {}
    majBloc();
  }

  function majBloc() {
    var anc = document.getElementById("rj60-bloc");
    if (!anc || !anc.parentNode) return;
    var tmp = document.createElement("div");
    tmp.innerHTML = blocHTML();
    var neuf = tmp.firstChild;
    anc.parentNode.replaceChild(neuf, anc);
    brancher(neuf);
  }

  function brancher(bloc) {
    if (!bloc) return;
    var b = bounds();
    bloc.addEventListener("click", function (ev) {
      var el = ev.target;
      while (el && el !== bloc && !el.getAttribute("data-act")) el = el.parentElement;
      if (!el || el === bloc) return;
      var act = el.getAttribute("data-act");
      var w = (SETTINGS && SETTINGS.appWidth) || b.width.default;
      var h = (SETTINGS && SETTINGS.appHeight) || b.height.default;
      if (act === "w-") appliquer(w - b.width.step, h);
      else if (act === "w+") appliquer(w + b.width.step, h);
      else if (act === "h-") appliquer(w, h - b.height.step);
      else if (act === "h+") appliquer(w, h + b.height.step);
      else if (act === "auto") { applyDetected(true); majBloc(); }
      else if (act === "autotoggle") {
        SETTINGS.appAutoSize = !!el.checked;
        try { if (typeof saveSettings === "function") saveSettings(); } catch (e) {}
        if (el.checked) { applyDetected(true); majBloc(); }
      } else if (act.indexOf("preset:") === 0) {
        var id = act.split(":")[1];
        for (var i = 0; i < PRESETS.length; i++) {
          if (PRESETS[i].id === id) { appliquer(PRESETS[i].w, PRESETS[i].h); break; }
        }
      }
    });
  }

  function injectSettingsCard() {
    var host = document.getElementById("settings-container");
    if (!host || document.getElementById("rj60-bloc")) return;

    forcerThemeSombre();
    retirerApparence(host);

    // La section « Affichage » d'origine (deux curseurs) est remplacée.
    var cible = null, titre = null;
    var enfants = Array.prototype.slice.call(host.children);
    for (var i = 0; i < enfants.length; i++) {
      if (enfants[i].querySelector && enfants[i].querySelector('input[type="range"]')) {
        cible = enfants[i];
        if (enfants[i - 1] && /affichage/i.test(enfants[i - 1].textContent || "")) titre = enfants[i - 1];
        break;
      }
    }

    var tmp = document.createElement("div");
    tmp.innerHTML = blocHTML();
    var bloc = tmp.firstChild;

    if (cible) {
      if (titre) titre.style.display = "none";
      cible.parentNode.replaceChild(bloc, cible);
    } else {
      host.insertBefore(bloc, host.firstChild);
    }
    brancher(bloc);
  }

  /* --------------------------------------- 3. suivi rotation / redimension */
  function onResize() {
    if (typeof SETTINGS === "undefined" || !SETTINGS || !SETTINGS.appAutoSize) return;
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { applyDetected(true); }, 300);
  }

  function wrapRender(name, after) {
    if (typeof window[name] !== "function" || window[name]._rj60) return false;
    var orig = window[name];
    var fn = function () {
      var r = orig.apply(this, arguments);
      try { setTimeout(after, 30); } catch (e) {}
      return r;
    };
    fn._rj60 = true;
    wrapped[name] = orig;
    window[name] = fn;
    return true;
  }

  var tries = 0;
  function boot() {
    var ready = (typeof SETTINGS !== "undefined" && SETTINGS && typeof applyAppSize === "function");
    if (!ready) { if (tries++ < 100) setTimeout(boot, 80); return; }

    var fresh = isFreshInstall();
    if (fresh) {
      SETTINGS.appAutoSize = true;
      var d = applyDetected(true);
      console.log("[60-auto-screen-fit] première installation — zone ajustée à " +
                  (d ? d.width + " × " + d.height : "?") + " (écran " + viewport().w + " × " + viewport().h + ")");
    }

    wrapRender("renderDisplaySetup", injectSetupButton);
    wrapRender("renderSettingsScreen", injectSettingsCard);
    injectSetupButton();
    injectSettingsCard();

    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    if (!fresh) console.log("[60-auto-screen-fit] actif — ajustement automatique disponible dans les Paramètres");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rjAutoFitScreen = function () { return applyDetected(true); };
  window._rj60Uninstall = function () {
    Object.keys(wrapped).forEach(function (k) { window[k] = wrapped[k]; });
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
    var a = document.getElementById("rj60-setup-btn"); if (a && a.parentNode) a.parentNode.removeChild(a);
    var b = document.getElementById("rj60-settings-card"); if (b && b.parentNode) b.parentNode.removeChild(b);
    console.log("[60-auto-screen-fit] désinstallé");
  };
})();


/* ==================================================================== *
 * Tiroir « Plus » — ajustement
 * (anciennement 61-more-drawer-fit.js)
 * ==================================================================== */

(function () {
  "use strict";

  var MARGE_BARRE = 10;   // respiration entre le tiroir et la barre du bas
  var MARGE_HAUT = 12;    // respiration en haut de l'écran
  var wrapped = {};
  var timer = null;

  function els() {
    return {
      drawer: document.getElementById("more-drawer"),
      nav: document.getElementById("main-nav"),
      app: document.getElementById("app")
    };
  }

  function place() {
    var e = els();
    if (!e.drawer || !e.app) return;
    // on ne recalcule que si le tiroir est ouvert (sinon getBoundingClientRect ment)
    if (!e.drawer.classList.contains("open")) return;

    var ra = e.app.getBoundingClientRect();
    // La barre du bas est en position:fixed : offsetParent vaut null même
    // quand elle est visible. On teste donc l'affichage réel.
    var basDispo = 8;   // valeur par défaut si aucune barre n'est affichée
    if (e.nav) {
      var cs = window.getComputedStyle(e.nav);
      var rn = e.nav.getBoundingClientRect();
      var visible = cs.display !== "none" && cs.visibility !== "hidden" && rn.height > 0;
      if (visible) basDispo = Math.max(0, ra.bottom - rn.top);
    }

    var bottom = Math.round(basDispo + MARGE_BARRE);
    var dispo = Math.round(ra.height - bottom - MARGE_HAUT);
    if (dispo < 120) dispo = 120;   // garde-fou : toujours utilisable

    e.drawer.style.bottom = bottom + "px";
    e.drawer.style.maxHeight = dispo + "px";
    e.drawer.style.overflowY = "auto";
    e.drawer.style.webkitOverflowScrolling = "touch";
    e.drawer.style.overscrollBehavior = "contain";
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(place, 60);
  }

  function wrap(name) {
    if (typeof window[name] !== "function" || window[name]._rj61) return false;
    var orig = window[name];
    var fn = function () {
      var r = orig.apply(this, arguments);
      try { setTimeout(place, 20); } catch (e) {}
      return r;
    };
    fn._rj61 = true;
    wrapped[name] = orig;
    window[name] = fn;
    return true;
  }

  // filet : si la classe .open est posée ailleurs, on réagit quand même
  var obs = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var t = muts[i].target;
      if (t && t.id === "more-drawer") { schedule(); return; }
    }
  });

  var tries = 0;
  function boot() {
    var e = els();
    if (!e.drawer) { if (tries++ < 100) setTimeout(boot, 100); return; }

    wrap("toggleMore");
    wrap("navMore");
    wrap("closeMore");

    obs.observe(e.drawer, { attributes: true, attributeFilter: ["class", "style"] });
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);

    console.log("[61-more-drawer-fit] actif — tiroir « Plus » calé au-dessus de la barre du bas");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj61Uninstall = function () {
    obs.disconnect();
    Object.keys(wrapped).forEach(function (k) { window[k] = wrapped[k]; });
    window.removeEventListener("resize", schedule);
    window.removeEventListener("orientationchange", schedule);
    var d = document.getElementById("more-drawer");
    if (d) { d.style.bottom = ""; d.style.maxHeight = ""; d.style.overflowY = ""; }
    console.log("[61-more-drawer-fit] désinstallé");
  };
})();


/* ==================================================================== *
 * Adaptation à la fenêtre — source unique
 * (anciennement 68-viewport-adaptive.js)
 * ==================================================================== */

(function () {
  "use strict";

  var TAG = "[68-viewport-adaptive]";
  var DEBOUNCE = 120;

  var etat = {
    actif: false,
    device: null,
    orient: null,
    viewport: null,
    insetsBruts: null,
    insetsEffectifs: null,
    hautNeutralise: false,
    basNeutralise: false,
    standalone: false,
    decision: null,
    zone: null,
    echelle: 1,
    auto: null,
    neutralises: []
  };
  window._rj68Status = function () { return etat; };

  /* ------------------------------------------------------------------ */
  /* Outils                                                              */
  /* ------------------------------------------------------------------ */

  function px(v) {
    var n = parseFloat(String(v || "").replace("px", ""));
    return isFinite(n) ? n : 0;
  }

  function bornes() {
    if (typeof APP_SIZE_BOUNDS !== "undefined" && APP_SIZE_BOUNDS) return APP_SIZE_BOUNDS;
    return {
      width:  { min: 340, max: 600,  step: 10, default: 430 },
      height: { min: 700, max: 1200, step: 20, default: 932 }
    };
  }

  // Ramène dans les bornes, aligné sur le pas, arrondi vers le BAS pour ne
  // jamais dépasser l'écran.
  function caler(valeur, b) {
    var v = Math.floor(valeur / b.step) * b.step;
    if (v < b.min) v = b.min;
    if (v > b.max) v = b.max;
    return v;
  }

  function mesurerViewport() {
    var w = 0, h = 0;
    try {
      if (window.visualViewport && window.visualViewport.width) {
        w = window.visualViewport.width;
        h = window.visualViewport.height;
      }
    } catch (e) {}
    if (!w) w = window.innerWidth || document.documentElement.clientWidth || 0;
    if (!h) h = window.innerHeight || document.documentElement.clientHeight || 0;
    return { w: Math.round(w), h: Math.round(h) };
  }

  /* ------------------------------------------------------------------ */
  /* A. Safe areas — source unique                                       */
  /* ------------------------------------------------------------------ */

  // Lecture des env() via une sonde dédiée : on ne peut pas lire --safe-top,
  // c'est justement la variable qu'on est en train de redéfinir.
  function sonderInsets() {
    var sonde = document.getElementById("rj68-sonde");
    if (!sonde) {
      sonde = document.createElement("div");
      sonde.id = "rj68-sonde";
      sonde.setAttribute("aria-hidden", "true");
      sonde.style.cssText =
        "position:fixed;left:-9999px;top:0;width:0;height:0;visibility:hidden;pointer-events:none;" +
        "padding-top:env(safe-area-inset-top,0px);" +
        "padding-right:env(safe-area-inset-right,0px);" +
        "padding-bottom:env(safe-area-inset-bottom,0px);" +
        "padding-left:env(safe-area-inset-left,0px);";
      (document.body || document.documentElement).appendChild(sonde);
    }
    var cs = getComputedStyle(sonde);
    return {
      haut:   px(cs.paddingTop),
      droite: px(cs.paddingRight),
      bas:    px(cs.paddingBottom),
      gauche: px(cs.paddingLeft)
    };
  }

  function estStandalone() {
    try {
      if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
      if (window.matchMedia && window.matchMedia("(display-mode: fullscreen)").matches) return true;
      if (navigator && navigator.standalone) return true;
    } catch (e) {}
    return false;
  }

  function forcageHaut() {
    try {
      if (typeof SETTINGS === "undefined" || !SETTINGS) return null;
      var v = SETTINGS.safeTopForce;
      return (typeof v === "number" && isFinite(v)) ? v : null;
    } catch (e) { return null; }
  }

  // NEUTRALISATION DÉSACTIVÉE PAR DÉFAUT — voir l'analyse ci-dessous.
  //
  // Le module 67 avait mesuré, sur iPhone 16 Pro Max : fenêtre 894, écran
  // 956, encoche 62, et .screens déjà décalé de 62. Il en avait conclu que
  // la fenêtre excluait l'îlot et que la marge était comptée deux fois.
  // La conclusion était fausse : le décalage de 62 ne venait pas de la
  // fenêtre mais de l'entretoise .sb elle-même, qui faisait exactement son
  // travail. Le vrai doublon était ailleurs — le correctif manuscrit de
  // styles.css qui rajoute la marge au .hdr de quatre écrans nommés, en
  // plus de l'entretoise. Ce doublon-là est supprimé depuis la v62.
  //
  // Conséquence du diagnostic erroné : --safe-top était mis à zéro, donc
  // l'entretoise s'effondrait et l'en-tête passait sous l'objectif sur les
  // 51 autres écrans. C'est le défaut constaté en PWA.
  //
  // La marge haute est donc appliquée telle que l'appareil la rapporte.
  // Le chemin de neutralisation reste disponible via SETTINGS.safeTopAuto,
  // au cas où un appareil justifierait de le rétablir.
  function insetsEffectifs(brut, vp) {
    var force = forcageHaut();
    if (force !== null) {
      etat.hautNeutralise = (force === 0);
      etat.decision = "forcé à " + force + "px";
      etat.standalone = estStandalone();
      return { haut: force, droite: brut.droite, bas: brut.bas, gauche: brut.gauche };
    }

    var standalone = estStandalone();
    etat.standalone = standalone;

    var heuristique = false;
    try { heuristique = !!(typeof SETTINGS !== "undefined" && SETTINGS && SETTINGS.safeTopAuto); }
    catch (e) {}

    if (!heuristique) {
      etat.hautNeutralise = false;
      etat.basNeutralise = false;
      etat.decision = "marges appliquées telles que rapportées" +
                      (standalone ? " (PWA)" : " (navigateur)");
      return { haut: brut.haut, droite: brut.droite, bas: brut.bas, gauche: brut.gauche };
    }

    var sh = 0;
    try { sh = (window.screen && window.screen.height) || 0; } catch (e) {}
    var vh = vp.h;
    var hautDejaExclu = standalone && (sh > 0 && brut.haut > 0 && vh <= sh - brut.haut + 2);
    var basDejaExclu  = standalone && (sh > 0 && brut.bas  > 0 && vh <= sh - brut.haut - brut.bas + 2);

    etat.hautNeutralise = hautDejaExclu;
    etat.basNeutralise  = basDejaExclu;
    etat.decision = "heuristique réactivée — haut " +
                    (hautDejaExclu ? "neutralisé" : "conservé");

    return {
      haut:   hautDejaExclu ? 0 : brut.haut,
      droite: brut.droite,
      bas:    basDejaExclu ? 0 : brut.bas,
      gauche: brut.gauche
    };
  }

  function publierInsets(eff) {
    var r = document.documentElement;
    if (!r) return;
    r.style.setProperty("--sa-top",    eff.haut + "px");
    r.style.setProperty("--sa-right",  eff.droite + "px");
    r.style.setProperty("--sa-bottom", eff.bas + "px");
    r.style.setProperty("--sa-left",   eff.gauche + "px");
    // Compatibilité avec le CSS existant (:root les définit en env()).
    r.style.setProperty("--safe-top", eff.haut + "px");
    r.style.setProperty("--safe-bot", eff.bas + "px");
  }

  /* ------------------------------------------------------------------ */
  /* B. Profil d'appareil — déduit des dimensions, pas du user-agent      */
  /* ------------------------------------------------------------------ */

  // Un écran 1440 × 900 a un petit côté de 900 : le seul critère de taille
  // le classait en tablette. On croise donc la taille avec la nature du
  // pointeur — un pointeur fin et survolable signe un ordinateur, jamais
  // un écran tactile. Toujours aucune lecture du user-agent.
  function pointeurPrecis() {
    try {
      return !!(window.matchMedia &&
                window.matchMedia("(hover: hover) and (pointer: fine)").matches);
    } catch (e) { return false; }
  }

  function profil(vp) {
    var petitCote = Math.min(vp.w, vp.h);
    var device;
    if (pointeurPrecis()) {
      // Souris ou trackpad : ordinateur. Une fenêtre étroite reste traitée
      // comme un téléphone, c'est le cas des outils de développement.
      device = (petitCote >= 600) ? "desktop" : "phone";
    } else {
      // Tactile : c'est la taille qui tranche. Un iPad Pro 12,9" en portrait
      // fait 1024 de large — sans ce chemin il serait classé ordinateur.
      device = (petitCote >= 600) ? "tablet" : "phone";
    }
    return { device: device, orient: (vp.w > vp.h ? "landscape" : "portrait") };
  }

  function publierProfil(p, vp) {
    var r = document.documentElement;
    if (!r) return;
    if (r.getAttribute("data-rj-device") !== p.device) r.setAttribute("data-rj-device", p.device);
    if (r.getAttribute("data-rj-orient") !== p.orient) r.setAttribute("data-rj-orient", p.orient);
    r.style.setProperty("--rj-vw", vp.w + "px");
    r.style.setProperty("--rj-vh", vp.h + "px");
    etat.device = p.device;
    etat.orient = p.orient;
  }

  /* ------------------------------------------------------------------ */
  /* C. Calcul de la zone de jeu                                         */
  /* ------------------------------------------------------------------ */

  function calculerZone(vp, eff) {
    var b = bornes();
    // Surface réellement utilisable : on retire les marges effectives.
    var utileW = vp.w - eff.gauche - eff.droite;
    var utileH = vp.h - eff.haut - eff.bas;

    var w = caler(utileW, b.width);
    var h = caler(utileH, b.height);

    // Le plancher des bornes (340 × 700) dépasse la surface utile sur les
    // très petits écrans et en paysage téléphone (844 × 390). Dans ce cas
    // le plancher est un mensonge : on annonce la surface réelle, quitte à
    // passer sous la borne, plutôt qu'une zone plus grande que l'écran.
    if (w > utileW) w = Math.max(1, Math.floor(utileW));
    if (h > utileH) h = Math.max(1, Math.floor(utileH));

    return { w: w, h: h, utileW: utileW, utileH: utileH, sousBorne: (w < b.width.min || h < b.height.min) };
  }

  function modeAuto() {
    try {
      return !!(typeof SETTINGS !== "undefined" && SETTINGS && SETTINGS.appAutoSize);
    } catch (e) { return false; }
  }

  var origApplyAppSize = null;
  var enCours = false;

  // Application effective. En mode auto, les valeurs calculées écrasent
  // celles de SETTINGS avant que le moteur d'origine ne pose les variables.
  function appliquerZone(vp, eff) {
    if (typeof SETTINGS === "undefined" || !SETTINGS) return null;
    var z = calculerZone(vp, eff);
    etat.zone = z;
    if (!modeAuto()) return z;

    var changed = (SETTINGS.appWidth !== z.w || SETTINGS.appHeight !== z.h);
    SETTINGS.appWidth = z.w;
    SETTINGS.appHeight = z.h;

    if (changed) {
      try { if (typeof saveSettings === "function") saveSettings(); } catch (e) {}
    }
    return z;
  }

  /* ------------------------------------------------------------------ */
  /* Passe complète                                                      */
  /* ------------------------------------------------------------------ */

  function passe(raison) {
    if (enCours) return;
    enCours = true;
    try {
      if (!document.body) return;
      var vp = mesurerViewport();
      var brut = sonderInsets();
      var eff = insetsEffectifs(brut, vp);

      etat.viewport = vp;
      etat.insetsBruts = brut;
      etat.insetsEffectifs = eff;
      etat.auto = modeAuto();

      publierInsets(eff);
      verifierEntretoise(eff);
      publierProfil(profil(vp), vp);
      appliquerZone(vp, eff);
      appliquerEchelle(vp, eff);

      // Pose effective des variables --app-width / --app-height.
      try {
        if (typeof applyAppSize === "function") applyAppSize();
      } catch (e) {}

      // applyAppSize ramène de force dans les bornes (340 × 700 minimum).
      // Sur un écran plus petit que le plancher, on repose la valeur réelle
      // par-dessus, sinon la zone déborderait.
      try {
        if (etat.zone && etat.zone.sousBorne && modeAuto()) {
          var rr = document.documentElement;
          rr.style.setProperty("--app-width", etat.zone.w + "px");
          rr.style.setProperty("--app-height", etat.zone.h + "px");
        }
      } catch (e) {}

      // Rafraîchit le panneau des Paramètres de 60 s'il est à l'écran.
      try {
        if (raison !== "boot" && typeof renderDisplaySetup === "function" &&
            document.getElementById("display-setup-content")) renderDisplaySetup();
      } catch (e) {}
    } catch (e) {
      console.warn(TAG, e);
    } finally {
      enCours = false;
    }
  }

  /* ------------------------------------------------------------------ */
  /* C bis. Mise à l'échelle du canevas — DÉSACTIVÉE PAR DÉFAUT          */
  /*                                                                     */
  /* Découverte en test navigateur : styles.css contient un bloc          */
  /* « EMERGENCY FULL-SCREEN FIX », sans media query et tout en           */
  /* !important, qui force #app à width:100% / max-width:100vw /          */
  /* height:100dvh. Il écrase --app-width et --app-height. Autrement dit  */
  /* la zone de jeu est INERTE depuis ce correctif : le panneau de        */
  /* réglage de 60 (molettes, préréglages, « Ajuster à mon écran »)       */
  /* n'a aucun effet visible. Le jeu remplit l'écran, mais son contenu    */
  /* reste dessiné aux tailles en px d'un canevas de 430 de large.        */
  /*                                                                     */
  /* La mise à l'échelle est LA réponse à ce problème : un facteur zoom   */
  /* sur #app fait suivre proportionnellement les ~10 900 valeurs en px,  */
  /* sans en modifier une seule. Réduction sur les écrans plus étroits    */
  /* que la référence (Galaxy Fold fermé), agrandissement sur tablette.   */
  /*                                                                     */
  /* Elle change l'aspect du jeu partout : elle reste donc désactivée     */
  /* tant que tu ne l'as pas évaluée. Activation : _rj68Scale(true).      */
  /* ------------------------------------------------------------------ */

  var REF_W = 430;          // largeur du canevas de référence
  var SCALE_MIN = 0.80;
  var SCALE_MAX = 1.60;

  function echelleActive() {
    try { return !!(typeof SETTINGS !== "undefined" && SETTINGS && SETTINGS.appScaleCanvas); }
    catch (e) { return false; }
  }

  function appliquerEchelle(vp, eff) {
    var app = document.getElementById("app");
    var r = document.documentElement;
    if (!app || !r) return;

    if (!echelleActive()) {
      app.style.removeProperty("zoom");
      app.style.removeProperty("width");
      app.style.removeProperty("height");
      app.style.removeProperty("max-width");
      app.style.removeProperty("max-height");
      r.style.setProperty("--rj-scale", "1");
      etat.echelle = 1;
      return;
    }
    var utileW = vp.w - eff.gauche - eff.droite;
    var utileH = vp.h - eff.haut - eff.bas;
    var s = utileW / REF_W;
    if (s < SCALE_MIN) s = SCALE_MIN;
    if (s > SCALE_MAX) s = SCALE_MAX;
    s = Math.round(s * 100) / 100;

    // zoom plutôt que transform:scale : pas de décalage des position:fixed,
    // pas de désalignement du toucher.
    // En revanche zoom redimensionne AUSSI la boîte : à 1.6, un #app en
    // width:100% déborderait de 60 %, et à 0.8 il ne remplirait plus que
    // 80 % de l'écran. On lui donne donc ses dimensions AVANT zoom, en
    // priorité !important pour passer devant le bloc d'urgence de styles.css.
    app.style.setProperty("width", Math.round(utileW / s) + "px", "important");
    app.style.setProperty("height", Math.round(utileH / s) + "px", "important");
    app.style.setProperty("max-width", "none", "important");
    app.style.setProperty("max-height", "none", "important");
    app.style.zoom = s;

    r.style.setProperty("--rj-scale", String(s));
    etat.echelle = s;
  }

  window._rj68Scale = function (on) {
    if (typeof SETTINGS === "undefined" || !SETTINGS) return null;
    if (typeof on === "undefined") return echelleActive();
    SETTINGS.appScaleCanvas = !!on;
    try { if (typeof saveSettings === "function") saveSettings(); } catch (e) {}
    passe("echelle");
    console.log(TAG, "mise à l'échelle " + (on ? "activée (facteur " + etat.echelle + ")" : "désactivée"));
    return etat.echelle;
  };

  /* ------------------------------------------------------------------ */
  /* Correctifs de mise en page liés aux marges                          */
  /*                                                                     */
  /* La marge HAUTE est appliquée globalement par l'entretoise <div       */
  /* class="sb"> placée en tête de #app, dont la hauteur vaut             */
  /* var(--safe-top). Le mécanisme est bon : il suffit que --safe-top     */
  /* soit juste, ce dont ce module se charge.                            */
  /*                                                                     */
  /* Deux endroits le contredisaient :                                   */
  /*  - un correctif manuscrit dans styles.css rajoute la marge haute au  */
  /*    .hdr de quatre écrans nommés (lifestyle, achievements, settings,  */
  /*    save). Avec l'entretoise déjà en place, ces quatre écrans         */
  /*    comptaient la marge DEUX FOIS ;                                  */
  /*  - un <style> en ligne dans index.html fixe .screens à              */
  /*    padding-bottom:56px, valeur en dur qui ignore l'indicateur        */
  /*    d'accueil : sur les iPhone récents, le bas du contenu passait     */
  /*    sous la barre de navigation.                                     */
  /* ------------------------------------------------------------------ */
  function injecterCorrectifs() {
    if (document.getElementById("rj68-css")) return;
    var st = document.createElement("style");
    st.id = "rj68-css";
    st.textContent = [
      /* l'entretoise reste la seule source de la marge haute */
      "#S-lifestyle > .hdr, #S-achievements > .hdr, #S-settings > .hdr, #S-save > .hdr",
      "{padding-top:10px !important}",
      /* la barre basse est en position:fixed : on rend sa réserve réelle */
      ".screens{padding-bottom:calc(56px + var(--sa-bottom,0px)) !important;",
      "padding-top:var(--rj-fallback-top,0px)}"
    ].join("");
    document.head.appendChild(st);
  }

  /* Diagnostic lisible, à lancer depuis la console de l'appareil. */
  window._rj68Marges = function () {
    var vp = etat.viewport || mesurerViewport();
    var b = etat.insetsBruts || {}, e = etat.insetsEffectifs || {};
    var sb = document.querySelector(".sb");
    var lignes = [
      "── marges de sécurité ──",
      "appareil ........ " + etat.device + " / " + etat.orient,
      "fenêtre ......... " + vp.w + " × " + vp.h,
      "écran physique .. " + ((window.screen && window.screen.height) || "?"),
      "PWA installée ... " + (etat.standalone ? "oui" : "non"),
      "env() brut ...... haut " + b.haut + " · bas " + b.bas + " · gauche " + b.gauche + " · droite " + b.droite,
      "appliqué ........ haut " + e.haut + " · bas " + e.bas,
      "décision ........ " + etat.decision,
      "entretoise .sb .. " + (sb ? Math.round(sb.getBoundingClientRect().height) + "px" : "absente"),
      "repli .screens .. " + (etat.fallback || 0) + "px",
      "forçage ......... " + (forcageHaut() === null ? "aucun (auto)" : forcageHaut() + "px")
    ];
    console.log(lignes.join("\n"));
    return lignes.join("\n");
  };

  // _rj68ForcerHaut(59) impose la marge ; _rj68ForcerHaut(null) rend la main
  // à la détection automatique. La valeur est enregistrée avec les réglages.
  window._rj68ForcerHaut = function (px) {
    if (typeof SETTINGS === "undefined" || !SETTINGS) return null;
    if (px === null || typeof px === "undefined") delete SETTINGS.safeTopForce;
    else SETTINGS.safeTopForce = Math.max(0, Math.round(px));
    try { if (typeof saveSettings === "function") saveSettings(); } catch (e) {}
    passe("forçage");
    return window._rj68Marges();
  };

  // Filet de sécurité : on ne se contente pas de POSER --safe-top, on
  // vérifie que l'entretoise .sb l'a réellement matérialisée. Si elle reste
  // écrasée (règle concurrente, display:none, flex qui la comprime), on
  // reporte la marge sur .screens. Sans cette vérification, une marge
  // correctement calculée peut rester sans effet visible — c'est
  // précisément le genre de panne qu'on ne reproduit pas en développement.
  function verifierEntretoise(eff) {
    try {
      var r = document.documentElement;
      if (!r) return;
      var attendu = eff.haut || 0;
      if (attendu <= 2) {
        r.style.setProperty("--rj-fallback-top", "0px");
        etat.entretoise = null;
        return;
      }
      var sb = document.querySelector(".sb");
      var rendu = sb ? Math.round(sb.getBoundingClientRect().height) : 0;
      etat.entretoise = rendu;
      var manque = attendu - rendu;
      if (manque > 2) {
        r.style.setProperty("--rj-fallback-top", manque + "px");
        etat.fallback = manque;
        if (!etat.fallbackSignale) {
          etat.fallbackSignale = true;
          console.log(TAG + " entretoise .sb à " + rendu + "px au lieu de " + attendu +
                      " — compensation de " + manque + "px reportée sur .screens");
        }
      } else {
        r.style.setProperty("--rj-fallback-top", "0px");
        etat.fallback = 0;
      }
    } catch (e) {}
  }

  var minuteur = null;
  function differer(raison) {
    if (minuteur) clearTimeout(minuteur);
    minuteur = setTimeout(function () { passe(raison || "resize"); }, DEBOUNCE);
  }

  /* ------------------------------------------------------------------ */
  /* Interception de applyAppSize : le mode auto est toujours prioritaire */
  /* ------------------------------------------------------------------ */

  function interceptApplyAppSize() {
    if (typeof window.applyAppSize !== "function" || window.applyAppSize._rj68) return false;
    origApplyAppSize = window.applyAppSize;
    var fn = function () {
      // Appel externe (60, molettes, boot du jeu) : en mode auto on
      // recalcule d'abord, pour que ce soit toujours la même valeur qui
      // gagne, quel que soit l'appelant.
      if (!enCours && modeAuto()) {
        try {
          var vp = mesurerViewport();
          var eff = insetsEffectifs(sonderInsets(), vp);
          var z = calculerZone(vp, eff);
          if (typeof SETTINGS !== "undefined" && SETTINGS) {
            SETTINGS.appWidth = z.w;
            SETTINGS.appHeight = z.h;
          }
          etat.zone = z;
        } catch (e) {}
      }
      return origApplyAppSize.apply(this, arguments);
    };
    fn._rj68 = true;
    window.applyAppSize = fn;
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Bascule en manuel dès que le joueur touche un réglage de 60          */
  /* ------------------------------------------------------------------ */

  function surClicReglage(ev) {
    try {
      var el = ev.target;
      while (el && el !== document.body && !(el.getAttribute && el.getAttribute("data-act"))) {
        el = el.parentElement;
      }
      if (!el || !el.getAttribute) return;
      var bloc = el.closest ? el.closest("#rj60-bloc") : null;
      if (!bloc) return;
      var act = el.getAttribute("data-act") || "";
      var manuel = (act === "w-" || act === "w+" || act === "h-" || act === "h+" ||
                    act.indexOf("preset:") === 0);
      if (!manuel) return;
      if (typeof SETTINGS !== "undefined" && SETTINGS && SETTINGS.appAutoSize) {
        SETTINGS.appAutoSize = false;
        try { if (typeof saveSettings === "function") saveSettings(); } catch (e) {}
        console.log(TAG, "réglage manuel détecté — ajustement automatique désactivé");
      }
    } catch (e) {}
  }

  /* ------------------------------------------------------------------ */
  /* Neutralisation des modules remplacés                                */
  /* ------------------------------------------------------------------ */

  function neutraliser() {
    // 67 : logique intégrée ici, source unique désormais.
    if (typeof window._rj67Uninstall === "function") {
      try { window._rj67Uninstall(); etat.neutralises.push("67-safearea-fix"); } catch (e) {}
    }
    // 41 : compensait un symptôme par translateY sur l'écran actif.
    if (typeof window._rjHeaderFixUninstall === "function") {
      try { window._rjHeaderFixUninstall(); etat.neutralises.push("41-header-safearea-fix"); } catch (e) {}
    }
    // Nettoyage de tout translateY résiduel laissé par 41.
    try {
      var restes = document.querySelectorAll(".scr[data-rj-hfix]");
      for (var i = 0; i < restes.length; i++) {
        restes[i].style.transform = "";
        restes[i].removeAttribute("data-rj-hfix");
      }
    } catch (e) {}
  }

  /* ------------------------------------------------------------------ */
  /* Démarrage                                                           */
  /* ------------------------------------------------------------------ */

  var ecouteurs = [];
  function ecouter(cible, type, fn, opts) {
    if (!cible || !cible.addEventListener) return;
    cible.addEventListener(type, fn, opts);
    ecouteurs.push([cible, type, fn, opts]);
  }

  var ro = null, mqDisplay = null;
  function onResize() { differer("resize"); }
  function onOrient() { setTimeout(function () { differer("orientation"); }, 60); }

  var essais = 0;
  function boot() {
    var pret = (document.body &&
                typeof SETTINGS !== "undefined" && SETTINGS &&
                typeof applyAppSize === "function");
    if (!pret) {
      if (essais++ < 120) { setTimeout(boot, 80); return; }
      console.warn(TAG, "abandon : SETTINGS ou applyAppSize indisponibles");
      return;
    }

    // Migration douce : les installations antérieures à 60 n'ont jamais eu
    // appAutoSize défini. On active l'automatique pour elles, sans écraser
    // un choix explicite du joueur.
    if (typeof SETTINGS.appAutoSize === "undefined" || SETTINGS.appAutoSize === null) {
      SETTINGS.appAutoSize = true;
      try { if (typeof saveSettings === "function") saveSettings(); } catch (e) {}
      console.log(TAG, "ajustement automatique activé (installation antérieure)");
    }

    neutraliser();
    injecterCorrectifs();
    interceptApplyAppSize();
    passe("boot");

    ecouter(window, "resize", onResize);
    ecouter(window, "orientationchange", onOrient);
    ecouter(window, "pageshow", onResize);
    try {
      if (window.visualViewport) {
        ecouter(window.visualViewport, "resize", onResize);
        ecouter(window.visualViewport, "scroll", onResize);
      }
    } catch (e) {}

    // Passage navigateur ↔ PWA installée : la fenêtre et les marges changent.
    try {
      if (window.matchMedia) {
        mqDisplay = window.matchMedia("(display-mode: standalone)");
        if (mqDisplay.addEventListener) mqDisplay.addEventListener("change", onResize);
        else if (mqDisplay.addListener) mqDisplay.addListener(onResize);
      }
    } catch (e) {}

    // Filet supplémentaire : certains WebView ne déclenchent pas resize.
    try {
      if (typeof ResizeObserver === "function") {
        ro = new ResizeObserver(function () { differer("observer"); });
        ro.observe(document.documentElement);
      }
    } catch (e) {}

    ecouter(document, "click", surClicReglage, true);

    // iOS stabilise ses marges avec un temps de retard après l'ouverture.
    setTimeout(function () { passe("stabilisation-400"); }, 400);
    setTimeout(function () { passe("stabilisation-1200"); }, 1200);

    etat.actif = true;
    var vp = etat.viewport || mesurerViewport();
    var z = etat.zone || {};
    console.log(TAG + " actif — " + etat.device + "/" + etat.orient +
                " · écran " + vp.w + " × " + vp.h +
                " · zone " + (z.w || "?") + " × " + (z.h || "?") +
                " · marges " + JSON.stringify(etat.insetsEffectifs) +
                " · " + etat.decision +
                (etat.neutralises.length ? " · remplace " + etat.neutralises.join(", ") : ""));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  /* ------------------------------------------------------------------ */
  /* Désinstallation                                                     */
  /* ------------------------------------------------------------------ */

  window._rj68Refit = function () { passe("manuel"); return etat.zone; };

  window._rj68Uninstall = function () {
    try {
      if (origApplyAppSize && window.applyAppSize && window.applyAppSize._rj68) {
        window.applyAppSize = origApplyAppSize;
      }
    } catch (e) {}
    for (var i = 0; i < ecouteurs.length; i++) {
      try { ecouteurs[i][0].removeEventListener(ecouteurs[i][1], ecouteurs[i][2], ecouteurs[i][3]); } catch (e) {}
    }
    ecouteurs = [];
    try { if (ro) ro.disconnect(); } catch (e) {}
    try {
      if (mqDisplay) {
        if (mqDisplay.removeEventListener) mqDisplay.removeEventListener("change", onResize);
        else if (mqDisplay.removeListener) mqDisplay.removeListener(onResize);
      }
    } catch (e) {}
    if (minuteur) clearTimeout(minuteur);

    var r = document.documentElement;
    if (r) {
      ["--sa-top", "--sa-right", "--sa-bottom", "--sa-left",
       "--safe-top", "--safe-bot", "--rj-vw", "--rj-vh", "--rj-fallback-top"].forEach(function (v) {
        r.style.removeProperty(v);
      });
      r.removeAttribute("data-rj-device");
      r.removeAttribute("data-rj-orient");
    }
    var s = document.getElementById("rj68-sonde");
    if (s && s.parentNode) s.parentNode.removeChild(s);
    var cssEl = document.getElementById("rj68-css");
    if (cssEl && cssEl.parentNode) cssEl.parentNode.removeChild(cssEl);
    var appEl = document.getElementById("app");
    if (appEl) {
      ["zoom", "width", "height", "max-width", "max-height"].forEach(function (k) {
        appEl.style.removeProperty(k);
      });
    }

    etat.actif = false;
    console.log(TAG, "désinstallé — recharger la page pour réactiver 41 et 67");
  };
})();


/* ==================================================================== *
 * Menu en liste — pastilles
 * (anciennement 72-menu-liste.js)
 * ==================================================================== */

(function () {
  "use strict";

  var TAG = "[72-menu-accueil]";
  var ID = "rj72-css";

  function css() {
    if (document.getElementById(ID)) return;
    var st = document.createElement("style");
    st.id = ID;
    st.textContent = [
      /* --- MENU PRINCIPAL : RETOUR À L'ÉTAT D'ORIGINE ---------------
         Ce module a successivement transformé la grille en liste sans
         icônes, puis en grille à pastilles de couleur, puis en grille à
         icônes réduites de 32 px. Aucune de ces variantes n'est conservée :
         la grille retrouve ses tuiles et ses pictogrammes d'origine, à
         leur taille d'origine, sans fond alterné. Plus aucune règle ne
         cible .apex-actions-grid ni .apex-action-icon — styles.css reprend
         donc seul la main, exactement comme avant toute intervention.
         ------------------------------------------------------------- */

      /* Seul réglage conservé : le bandeau « Saison 1 · Karting Junior ·
         P1 · 0 pts · Début » reste masqué, l'information figurant déjà
         dans l'en-tête de l'accueil et dans l'écran Championnat.
         Il est masqué et non supprimé : _renderSeasonBanner() continue
         d'écrire dans #rj-season-banner sans lever d'erreur. */
      "#rj-season-banner{display:none !important}",

      /* --- FUSION DE LA VIE AU PADDOCK -----------------------------
         La zone d'événements de l'accueil (#home-events-zone) et
         l'onglet « Événements » de Réseaux & Messages affichent le MÊME
         tableau REP_EVENTS_PENDING : renderHomeEvents remplit la
         première, renderRepEvents la seconde. C'était donc un doublon,
         et un doublon amputé — la zone d'accueil était en plus réservée
         à la Formule 2 et à la Formule 1, alors que l'onglet, lui, n'a
         aucune restriction de catégorie.
         La zone d'accueil disparaît ; l'onglet devient le seul endroit.
         ------------------------------------------------------------- */
      "#home-events-zone{display:none !important}"
    ].join("");
    document.head.appendChild(st);
  }

  /* Une pastille sur la tuile « Réseaux » remplace la visibilité que
     donnait la zone d'accueil : sans elle, un événement en attente
     passerait totalement inaperçu. Le badge réutilise le mécanisme
     existant (.apex-action-badge), déjà en place sur Pilote, Contrats
     et Sponsors. */
  function pastilleEvenements() {
    try {
      var tuile = document.querySelector(".apex-action-tile[onclick*='S-media'] .apex-action-icon");
      if (!tuile) return;
      var b = document.getElementById("rj72-evt-badge");
      var n = 0;
      try { n = (typeof REP_EVENTS_PENDING !== "undefined" && REP_EVENTS_PENDING) ? REP_EVENTS_PENDING.length : 0; } catch (e) {}
      if (!n) { if (b) b.style.display = "none"; return; }
      if (!b) {
        b = document.createElement("span");
        b.id = "rj72-evt-badge";
        b.className = "apex-action-badge";
        tuile.appendChild(b);
      }
      b.textContent = n;
      b.style.display = "flex";
    } catch (e) {}
  }
  window._rj72Pastille = pastilleEvenements;

  /* ------------------------------------------------------------------
   * Confirmation de suppression d'une sauvegarde : clic fantôme.
   *
   * Symptôme : le premier appui sur la croix fait apparaître la bannière
   * « Supprimer cette sauvegarde ? » qui se referme aussitôt ; il faut
   * appuyer une seconde fois pour qu'elle reste.
   *
   * Le code d'origine appelle pourtant bien stopPropagation, et le défaut
   * ne se reproduit ni au clic ni au tactile émulé sous Chromium : il est
   * propre à WebKit. Sur iOS, un appui produit touchstart, touchend, puis
   * un click différé d'environ 300 ms. La bannière étant insérée entre les
   * deux, ce click résiduel atterrit sur les boutons qui viennent
   * d'apparaître — « Annuler » referme donc ce que l'appui venait d'ouvrir.
   *
   * Remède : pendant 450 ms après l'ouverture, les boutons de la bannière
   * n'acceptent aucun clic. Un appui volontaire ne peut pas être aussi
   * rapide ; seul le clic fantôme tombe dans cette fenêtre. Même principe
   * que l'anti-rebond du module 50 sur l'écran stratégie.
   * ---------------------------------------------------------------- */
  var ouvertureConfirm = 0;

  function antiClicFantome(ev) {
    try {
      var slots = document.getElementById("save-slots");
      if (!slots || !slots.contains(ev.target)) return;
      var t = (ev.target.textContent || "").trim();
      if (t === "\u00d7") { ouvertureConfirm = Date.now(); return; }
      if (t === "Annuler" || t === "Supprimer") {
        if (ouvertureConfirm && (Date.now() - ouvertureConfirm) < 450) {
          ev.stopPropagation();
          ev.preventDefault();
          if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        }
      }
    } catch (e) {}
  }

  function boot() {
    if (!document.head) { setTimeout(boot, 60); return; }
    css();
    pastilleEvenements();
    try { document.addEventListener("click", antiClicFantome, true); } catch (e) {}
    try {
      if (typeof MutationObserver === "function") {
        var t = null;
        var obs = new MutationObserver(function () {
          if (t) clearTimeout(t);
          t = setTimeout(pastilleEvenements, 120);
        });
        obs.observe(document.body, { childList: true, subtree: true });
      }
    } catch (e) {}
    console.log(TAG + " actif — menu principal d'origine, bandeau de saison masqué");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj72Uninstall = function () {
    try { document.removeEventListener("click", antiClicFantome, true); } catch (e) {}
    var st = document.getElementById(ID);
    if (st && st.parentNode) st.parentNode.removeChild(st);
    console.log(TAG + " désinstallé — bandeau de saison restauré");
  };
})();


/* ==================================================================== *
 * Cartes de statistiques
 * (anciennement 73-cartes-stats.js)
 * ==================================================================== */

(function () {
  "use strict";

  var TAG = "[73-cartes-stats]";
  var ID = "rj73-css";
  var CYAN = "#00D4FF";
  var AMBRE = "#F59E0B";

  function css() {
    if (document.getElementById(ID)) return;
    var st = document.createElement("style");
    st.id = ID;
    st.textContent = [
      /* --- Style repris À L'IDENTIQUE des cartes de l'onglet Activités →
         Entraînement (.rjf-card, module 38) :
             border-radius: 11px
             background: linear-gradient(180deg, var(--bg3), var(--bg2))
             border: 1px solid var(--border)
             padding: 12px 13px 13px 16px
         Dégradé vertical discret, bordure neutre sur les quatre côtés,
         aucun liseré coloré, et un retrait à gauche légèrement plus
         généreux qui donne son assise à la carte. --- */

      ".mg{gap:11px !important;padding:11px 14px 5px !important}",

      ".mc, .f1-metric{",
      "border-radius:11px !important;",
      "background:linear-gradient(180deg,var(--bg3),var(--bg2)) !important;",
      "border:1px solid var(--border) !important;",
      "padding:12px 13px 13px 16px !important;",
      "position:relative !important;overflow:hidden !important}",

      /* les variantes colorées de .f1-metric ne teintent plus le bord :
         elles n'ont plus lieu d'être dans un style sans accent */
      ".f1-metric-gold, .f1-metric-green, .f1-metric-blue{",
      "border-color:var(--border) !important}",

      /* libellé calé sur .rjf-kicker, valeur sur .rjf-name en plus grand */
      ".mc .mc-l{font-size:9.5px !important;font-weight:700 !important;",
      "letter-spacing:.2em !important;text-transform:uppercase !important;",
      "color:var(--muted) !important;margin:0 0 9px !important}",

      ".mc .mc-v{font-size:21px !important;font-weight:900 !important;",
      "letter-spacing:.02em !important;line-height:1.05 !important}",

      /* une dépense reste identifiable, par la couleur du nombre seul */
      ".mc.rj73-neg .mc-v, .f1-metric.rj73-neg .mc-v{color:" + AMBRE + " !important}",

      /* --- Autres conteneurs du meme genre, alignes sur .rjf-card ------
         .rjlife-eff  : bloc « Mes biens » de l'ecran Style de vie. Il
                        portait un fond --surface2, une ombre portee et un
                        bandeau colore de 3 px a gauche (.rjlife-stripe).
         .agent-stats-card, .stat-hero, .train-hero, .f1-card, .agent-hero :
                        memes proportions, memes contenus chiffres, chacun
                        avec son propre fond et sa propre ombre.
         Tous adoptent le degrade sobre et la bordure neutre des cartes
         d'Entrainement. Le bandeau colore de Mes biens est neutralise :
         il fait double emploi avec la bordure. -------------------------- */
      ".rjlife-eff, .agent-stats-card, .stat-hero, .train-hero, .f1-card, .agent-hero{",
      "border-radius:11px !important;",
      "background:linear-gradient(180deg,var(--bg3),var(--bg2)) !important;",
      "border:1px solid var(--border) !important;",
      "box-shadow:none !important}",
      ".rjlife-stripe{display:none !important}",
      ".rjlife-eff{padding:12px 13px 13px 16px !important}"
    ].join("");
    document.head.appendChild(st);
  }

  // Une valeur négative se reconnaît au signe moins en tête, y compris sous
  // la forme « -0 € » que le jeu affiche pour une dépense nulle.
  var enEcriture = false;
  function marquer() {
    if (enEcriture) return;
    enEcriture = true;
    try {
      var cartes = document.querySelectorAll(".mc, .f1-metric");
      for (var i = 0; i < cartes.length; i++) {
        var v = cartes[i].querySelector(".mc-v, .f1-metric-val, .f1-metric-v");
        var t = v ? (v.textContent || "").trim() : "";
        var neg = /^[-−]/.test(t);
        if (neg) cartes[i].classList.add("rj73-neg");
        else cartes[i].classList.remove("rj73-neg");
      }
    } catch (e) {
    } finally {
      enEcriture = false;
    }
  }

  var minuteur = null, observer = null;
  function differer() {
    if (minuteur) clearTimeout(minuteur);
    minuteur = setTimeout(marquer, 50);
  }

  function boot() {
    if (!document.head || !document.body) { setTimeout(boot, 60); return; }
    css();
    marquer();
    try {
      if (typeof MutationObserver === "function") {
        observer = new MutationObserver(differer);
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      }
    } catch (e) {}
    console.log(TAG + " actif — cartes chiffrées unifiées, accent latéral");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj73Marquer = marquer;
  window._rj73Uninstall = function () {
    var st = document.getElementById(ID);
    if (st && st.parentNode) st.parentNode.removeChild(st);
    try { if (observer) observer.disconnect(); } catch (e) {}
    if (minuteur) clearTimeout(minuteur);
    var c = document.querySelectorAll(".rj73-neg");
    for (var i = 0; i < c.length; i++) c[i].classList.remove("rj73-neg");
    console.log(TAG + " désinstallé");
  };
})();


/* ==================================================================== *
 * Densité de la mise en page
 * (anciennement 85-densite-ui.js)
 * ==================================================================== */

(function () {
  "use strict";

  var TAG = "[85-densite]";
  var CSS_ID = "rj85-css";

  var REGLES = [

    /* ---------------------------------------------------------------
     * ACTIVITÉS ET BOUTIQUE  (137 px et 133 px par carte)
     *
     * La vignette passe de 46 à 34 px, les marges intérieures se
     * resserrent, la description tient sur une ligne — le détail complet
     * reste lisible, seule la respiration excédentaire disparaît.
     * ------------------------------------------------------------- */
    ".act-card,.ls-item{padding:9px 11px !important;margin-bottom:5px !important}",
    ".act-card > div,.ls-item > div{gap:9px !important}",
    ".ls-act-icon,.ls-item-icon{width:34px !important;height:34px !important;min-width:34px !important;" +
      "flex:0 0 34px !important;border-radius:8px !important}",

    /* description sur une seule ligne, coupée proprement */
    ".rj85-desc{display:-webkit-box !important;-webkit-line-clamp:1 !important;-webkit-box-orient:vertical !important;" +
      "overflow:hidden !important;line-height:1.35 !important;margin-top:2px !important}",

    /* badges : moins hauts, moins espacés */
    ".act-card .badge,.ls-item .badge{padding:2px 6px !important;font-size:9px !important;line-height:1.35 !important}",
    ".act-card [style*='flex-wrap:wrap'],.ls-item [style*='flex-wrap:wrap']{gap:4px !important;margin-top:5px !important}",

    /* la ligne de pied (prix + action) se resserre */
    "[data-rj39-cta]{margin-top:6px !important}",
    ".ls-btn{padding:7px 12px !important}",

    /* photo d'article : format panoramique plutôt que carré */
    ".ls-item img.ls-photo,.ls-item [style*='height:180px']{height:104px !important;object-fit:cover !important}",

    /* ---------------------------------------------------------------
     * CHAMPIONNAT  (20 lignes de 47 px)
     * Une ligne de classement n'a besoin que d'une hauteur de doigt.
     * ------------------------------------------------------------- */
    "#cht-classement .cr,#cht-classement .row{padding:7px 10px !important;min-height:38px !important}",
    "#cht-classement .cr + .cr{margin-top:3px !important}",

    /* ---------------------------------------------------------------
     * PILOTE  (650 px de barres de stats)
     *
     * Chaque pilier (Performance, Mental…) empile ses lignes une par une.
     * Les lignes passent sur deux colonnes : même information, moitié
     * moins de hauteur. En dessous de 380 px de large, retour sur une
     * colonne pour ne pas tasser les libellés.
     * ------------------------------------------------------------- */
    /* Deux colonnes ont été essayées : à 430 px de large, la jauge tombait
       à quelques pixels et la valeur passait hors cadre. On reste sur une
       colonne — l'écran Pilote est fait pour être lu, pas pour tenir à tout
       prix — et on gagne uniquement sur les espacements. */
    "#p-stat-bars .p-row{padding:3px 0 !important}",
    "#p-stat-bars .pillar-block{margin-bottom:8px !important}",
    "#p-stat-bars .pillar-head{padding:6px 0 !important}",
    "#pilot-rating-card{padding:12px 14px !important}",

    /* ---------------------------------------------------------------
     * RESPIRATION GÉNÉRALE
     * Les intitulés de section et les cartes gagnent quelques pixels
     * partout, ce qui se cumule vite sur un écran long.
     * ------------------------------------------------------------- */
    ".t-sec,.sec-lbl{margin:12px 14px 6px !important;font-size:10px !important}",
    ".card{padding:11px 13px !important}",
    ".scroll > .card + .card{margin-top:7px !important}"
  ];

  function injecter() {
    if (document.getElementById(CSS_ID)) return true;
    var st = document.createElement("style");
    st.id = CSS_ID;
    st.textContent = REGLES.join("\n");
    (document.head || document.documentElement).appendChild(st);
    return true;
  }

  /* Les descriptions n'ont pas de classe commune : on la pose nous-mêmes,
     une seule fois par élément, sur la ligne qui suit le titre d'une carte. */
  function marquerDescriptions(racine) {
    try {
      var cartes = (racine || document).querySelectorAll(".act-card, .ls-item");
      for (var i = 0; i < cartes.length; i++) {
        var corps = cartes[i].querySelector('div[style*="flex:1"]') || cartes[i];
        var enfants = corps.children;
        /* le titre est le premier bloc, la description le suivant */
        if (enfants.length >= 2) {
          var d = enfants[1];
          if (d && !d.classList.contains("rj85-desc") && !d.querySelector(".badge")) {
            d.classList.add("rj85-desc");
          }
        }
      }
    } catch (e) {}
  }

  var _orig = {};

  function wrap(nom) {
    if (typeof window[nom] !== "function" || window[nom]._rj85) return;
    var o = window[nom];
    window[nom] = function () {
      var r = o.apply(this, arguments);
      try { setTimeout(function () { marquerDescriptions(); }, 20); } catch (e) {}
      return r;
    };
    window[nom]._rj85 = true;
    _orig[nom] = o;
  }

  function boot() {
    injecter();
    marquerDescriptions();
    ["renderLifestyle", "renderLsActivities", "renderShop", "navTo", "refreshScreen"].forEach(wrap);
    console.log(TAG, "actif — mise en page resserrée");

    window._rj85Uninstall = function () {
      var css = document.getElementById(CSS_ID);
      if (css && css.parentNode) css.parentNode.removeChild(css);
      Object.keys(_orig).forEach(function (k) { window[k] = _orig[k]; });
      var d = document.querySelectorAll(".rj85-desc");
      for (var i = 0; i < d.length; i++) d[i].classList.remove("rj85-desc");
      console.log(TAG, "désinstallé");
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
