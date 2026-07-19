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

  // carte dans les Paramètres
  function injectSettingsCard() {
    var host = document.getElementById("settings-container");
    if (!host || document.getElementById("rj60-settings-card")) return;
    var card = document.createElement("div");
    card.id = "rj60-settings-card";
    card.style.cssText =
      "margin:10px 14px;padding:14px;border-radius:var(--r,10px);" +
      "background:linear-gradient(160deg,var(--bg2) 0%,var(--bg) 100%);" +
      "border:1px solid var(--border-hi);";
    var vp = viewport(), d = detect();
    card.innerHTML =
      '<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--dim,#6b6b78);' +
      'letter-spacing:.14em;text-transform:uppercase;margin-bottom:6px">Taille d\'écran</div>' +
      '<div style="font-size:12px;color:var(--text2);line-height:1.5">Écran détecté : <strong style="color:var(--text)">' +
      vp.w + ' × ' + vp.h + '</strong> · zone conseillée : <strong style="color:var(--text)">' +
      d.width + ' × ' + d.height + '</strong></div>';
    var btn = makeButton("Ajuster automatiquement", function () {
      var r = applyDetected(true);
      if (r) feedback(btn, r);
    });
    card.appendChild(btn);
    var lbl = document.createElement("label");
    lbl.style.cssText = "display:flex;align-items:center;gap:8px;margin-top:8px;font-size:12px;color:var(--text2);cursor:pointer";
    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!(typeof SETTINGS !== "undefined" && SETTINGS && SETTINGS.appAutoSize);
    cb.addEventListener("change", function () {
      if (typeof SETTINGS === "undefined" || !SETTINGS) return;
      SETTINGS.appAutoSize = !!cb.checked;
      try { if (typeof saveSettings === "function") saveSettings(); } catch (e) {}
      if (cb.checked) applyDetected(true);
    });
    lbl.appendChild(cb);
    lbl.appendChild(document.createTextNode("Garder l'ajustement automatique (rotation, changement d'écran)"));
    card.appendChild(lbl);
    host.insertBefore(card, host.firstChild);
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
