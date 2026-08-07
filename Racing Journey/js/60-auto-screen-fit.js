/* =====================================================================
 * 60-auto-screen-fit.js — AJUSTEMENT AUTOMATIQUE À L'ÉCRAN DU TÉLÉPHONE
 *
 * PROBLÈME : la zone de jeu est fixée à 430 × 932 par défaut, quel que
 * soit l'appareil. Sur un iPhone SE (375 × 667) ou un iPhone 14 (390 ×
 * 844), la zone déborde de l'écran ; le joueur doit régler deux molettes
 * à la main au premier lancement pour retomber sur ses pieds.
 *
 * CE QUE FAIT CE MODULE :
 *   1. À LA PREMIÈRE INSTALLATION (aucun réglage enregistré), il mesure
 *      l'écran réel et applique la zone de jeu correspondante avant même
 *      l'affichage de l'écran de calibrage. Le jeu est donc déjà à la
 *      bonne taille ; les molettes ne servent plus qu'à affiner.
 *   2. Il ajoute un bouton « Ajuster automatiquement » sur l'écran de
 *      calibrage ET dans les Paramètres, pour relancer la détection.
 *   3. En mode automatique, la zone se recalcule au changement
 *      d'orientation ou de taille de fenêtre (débounce 300 ms).
 *
 * MESURE : on privilégie visualViewport (qui exclut les barres du
 * navigateur et tient compte du zoom) et on retombe sur innerWidth /
 * innerHeight. La valeur est ramenée dans les bornes du jeu et alignée
 * sur le pas des molettes, en arrondissant vers le BAS pour ne jamais
 * dépasser l'écran.
 *
 * Réversible : window._rj60Uninstall().
 * =================================================================== */
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
