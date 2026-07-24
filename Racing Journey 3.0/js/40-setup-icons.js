/* =====================================================================
 * 40-setup-icons.js — ICÔNES SUR LES RÉGLAGES SETUP & STRATÉGIE
 *
 * Préfixe le label de chaque slider de réglage (aileron, suspension,
 * agressivité, dépassement…) par un pictogramme évocateur, en wrappant
 * renderAdvSlider. Aucune modification du cœur. Réversible :
 * window._rjSetupIconsUninstall().
 * =================================================================== */
(function () {
  "use strict";

  /* contenu interne SVG par clé de réglage (tracé en currentColor) */
  var PATHS = {
    aileron_av:        '<path d="M3 14h18M5 14c2-5 12-5 14 0"/>',
    aileron_ar:        '<path d="M3 10h18M5 10c2 5 12 5 14 0"/>',
    antiroulis_av:     '<path d="M5 7v10M19 7v10M5 12h14"/>',
    antiroulis_ar:     '<path d="M5 7v10M19 7v10M5 12h14"/>',
    carrossage:        '<path d="M8 4l2 16M18 4l-3 16M6 4h5M13 20h6"/>',
    suspension:        '<path d="M6 4h12M6 20h12M9 4l6 4-6 4 6 4-6 4"/>',
    pression_pneus:    '<circle cx="12" cy="12" r="8"/><path d="M12 12l4-3M12 12v4"/>',
    differentiel:      '<circle cx="12" cy="12" r="3.5"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/>',
    repartition_frein: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M16.5 6.5l-2.2 2.2"/>',
    agress_debut:      '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    agress_fin:        '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    gestion_pneus:     '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
    depassement:       '<path d="M7 8h11l-3-3M7 8l3 3M17 16H6l3-3M17 16l-3 3"/>'
  };

  function advIcon(key) {
    var p = PATHS[key];
    if (!p) return "";
    return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:6px;opacity:.8;flex:0 0 auto">' + p + "</svg>";
  }

  var _origAdvSlider = null;
  function wrapAdvSlider() {
    if (typeof window.renderAdvSlider !== "function") return false;
    if (window.renderAdvSlider._rjIcon) return true;
    _origAdvSlider = window.renderAdvSlider;
    window.renderAdvSlider = function (label, type, key) {
      var args = Array.prototype.slice.call(arguments);
      var ic = advIcon(key);
      if (ic && typeof label === "string") args[0] = ic + label;
      return _origAdvSlider.apply(this, args);
    };
    window.renderAdvSlider._rjIcon = true;
    return true;
  }

  function install() {
    if (window._rjSetupIconsInstalled) return;
    window._rjSetupIconsInstalled = true;
    var tries = 0;
    (function boot() {
      if (wrapAdvSlider()) {
        try { if (typeof window.renderAdvancedSetupUI === "function") window.renderAdvancedSetupUI(); } catch (e) {}
        return;
      }
      if (tries++ < 50 && typeof setTimeout === "function") setTimeout(boot, 150);
    })();
    window._rjSetupIcons = { advIcon: advIcon, PATHS: PATHS };
    window._rjSetupIconsUninstall = function () {
      if (_origAdvSlider) window.renderAdvSlider = _origAdvSlider;
      window._rjSetupIconsInstalled = false;
      console.log("[40-setup-icons] désinstallé");
    };
    console.log("[40-setup-icons] actif — icônes sur les réglages");
  }

  install();
})();
