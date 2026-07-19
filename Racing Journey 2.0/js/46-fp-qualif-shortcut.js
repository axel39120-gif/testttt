/* =====================================================================
 * 46-fp-qualif-shortcut.js — RACCOURCI QUALIF DANS LE DEBRIEF ESSAIS LIBRES
 *
 * Quand le pop-up de debrief de tour (#fpl-debrief) affiche un setup
 * PARFAIT PARTOUT (tous les paramètres évalués en "perfect" → icône ✓),
 * on injecte en tête des boutons un « Accéder aux qualifs » qui ferme le
 * pop-up et lance directement goToQualifStep().
 *
 * Détection : MutationObserver sur l'apparition de #fpl-debrief ; lecture
 * des icônes de paramètres (span[style*="min-width:14px"]). Le bouton n'est
 * ajouté que si tous les paramètres sont ✓ (et au moins un paramètre).
 * N'altère rien d'autre ; les boutons existants restent.
 *
 * Réversible : window._rjFpQualifShortcutUninstall().
 * =================================================================== */
(function () {
  "use strict";

  var BTN_ID = "fpl-perfect-qualif";
  var PERFECT = "\u2713"; // ✓

  function allPerfect(overlay) {
    var icons = overlay.querySelectorAll('span[style*="min-width:14px"]');
    if (!icons.length) return false;
    for (var i = 0; i < icons.length; i++) {
      if ((icons[i].textContent || "").trim() !== PERFECT) return false;
    }
    return true;
  }

  function goQualif() {
    var fn = (typeof window.goToQualifStep === "function") ? window.goToQualifStep
           : (typeof goToQualifStep === "function") ? goToQualifStep : null;
    if (fn) { try { fn(); } catch (e) { console.warn("[46] goToQualifStep:", e); } }
  }

  function enhance(overlay) {
    if (!overlay || overlay.querySelector("#" + BTN_ID)) return;
    var closeBtn = overlay.querySelector("#fpl-debrief-close");
    if (!closeBtn || !closeBtn.parentNode) return;
    if (!allPerfect(overlay)) return;

    var box = closeBtn.parentNode;
    var btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.style.cssText = [
      "width:100%", "padding:14px 16px",
      "background:linear-gradient(135deg,var(--red2) 0%,var(--red) 100%)",
      "border:none", "color:#fff", "font-family:var(--font-display)",
      "font-size:13px", "font-weight:900", "letter-spacing:.14em",
      "text-transform:uppercase", "cursor:pointer",
      "-webkit-tap-highlight-color:transparent", "border-radius:8px",
      "display:flex", "align-items:center", "justify-content:center", "gap:8px"
    ].join(";");
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="2.4"><polyline points="9 18 15 12 9 6"/></svg>' +
      'Acc\u00E9der aux qualifs';

    btn.addEventListener("click", function () {
      var ov = document.getElementById("fpl-debrief");
      if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
      goQualif();
    });

    box.insertBefore(btn, box.firstChild); // tout en haut des boutons
  }

  function scan(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.id === "fpl-debrief") { enhance(node); return; }
    if (node.querySelector) {
      var ov = node.querySelector("#fpl-debrief");
      if (ov) enhance(ov);
    }
  }

  var obs = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var ad = muts[i].addedNodes;
      for (var j = 0; j < ad.length; j++) scan(ad[j]);
    }
  });

  function start() {
    if (!document.body) { setTimeout(start, 100); return; }
    obs.observe(document.body, { childList: true, subtree: true });
    var ex = document.getElementById("fpl-debrief");
    if (ex) enhance(ex);
    console.log("[46-fp-qualif-shortcut] actif");
  }

  window._rjFpQualifShortcutUninstall = function () {
    obs.disconnect();
    var b = document.getElementById(BTN_ID);
    if (b && b.parentNode) b.parentNode.removeChild(b);
    console.log("[46-fp-qualif-shortcut] désinstallé");
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
