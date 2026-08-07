/* =====================================================================
 * 50-strategy-tap-fix.js (v3) — SÉLECTION DU STYLE DE PILOTAGE (iOS)
 *
 * SYMPTÔME : dans le modal stratégie, le style reste bloqué sur celui du
 * milieu (« Gérer ») sur iPhone. En Chromium (souris ET tap tactile simulé)
 * la sélection fonctionne : le bug est propre au moteur WebKit d'iOS, que
 * je ne peux pas reproduire ici.
 *
 * POURQUOI LES VERSIONS PRÉCÉDENTES ONT ÉCHOUÉ : elles essayaient de
 * RATTRAPER un tap perdu (délégation click/pointerup/touchend sur document).
 * La v2 allait jusqu'à appeler preventDefault() pour tuer le « click
 * fantôme » — ce qui, si le rattrapage échouait, pouvait rendre le bouton
 * totalement inerte. On corrigeait le symptôme, pas la fragilité.
 *
 * v3 — ON SUPPRIME LA FRAGILITÉ : les choix sont des <div onclick="…">, et
 * iOS ne synthétise pas toujours un « click » sur un <div> non interactif
 * recréé dynamiquement. On remplace donc chaque <div> par un VRAI <button>
 * natif (apparence identique, styles recopiés), avec un écouteur attaché
 * DIRECTEMENT sur l'élément. Un bouton natif reçoit le tap de façon fiable
 * sur toutes les versions d'iOS — c'est le comportement standard du HTML,
 * plus une émulation.
 *
 * Aucun preventDefault : rien ne peut plus neutraliser le clic natif.
 * Le modal se redessine à chaque choix : un MutationObserver reconvertit
 * les boutons après chaque rendu.
 *
 * Réversible : window._rjStrategyTapFixUninstall() (rechargement conseillé).
 * =================================================================== */
(function () {
  "use strict";

  var SEL = '[onclick*="_rjStratPickStyle"], [onclick*="_rjStratPickCompound"], [onclick*="_rjStratSetStops"]';
  var MARK = "data-rj50";
  var lastKey = "", lastAt = 0;

  function parseCall(oc) {
    if (!oc) return null;
    var m = oc.match(/(_rjStrat\w+)\s*\(\s*(?:'([^']*)'|"([^"]*)"|([^)]*))?\s*\)/);
    if (!m) return null;
    var arg = (m[2] !== undefined) ? m[2] : (m[3] !== undefined) ? m[3] : (m[4] !== undefined ? m[4].trim() : undefined);
    return { fn: m[1], arg: arg };
  }

  function invoke(call) {
    if (!call || typeof window[call.fn] !== "function") return;
    var key = call.fn + ":" + call.arg;
    var now = Date.now();
    if (key === lastKey && (now - lastAt) < 400) return; // anti-double
    lastKey = key; lastAt = now;
    try {
      if (call.arg === undefined || call.arg === "") window[call.fn]();
      else if (/^-?\d+(\.\d+)?$/.test(call.arg)) window[call.fn](parseFloat(call.arg));
      else window[call.fn](call.arg);
    } catch (e) { console.warn("[50] appel " + call.fn + " :", e); }
  }

  // Remplace un <div onclick> par un <button> natif visuellement identique.
  function toNativeButton(el) {
    if (!el || el.getAttribute(MARK) || el.tagName === "BUTTON") return;
    var call = parseCall(el.getAttribute("onclick"));
    if (!call) return;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.innerHTML = el.innerHTML;
    btn.className = el.className || "";
    // apparence : on recopie le style du div, puis on neutralise le style natif
    btn.style.cssText = el.getAttribute("style") || "";
    btn.style.font = "inherit";
    btn.style.fontFamily = "inherit";
    btn.style.color = "inherit";
    btn.style.textAlign = "left";
    btn.style.width = "100%";
    btn.style.display = "block";
    btn.style.webkitAppearance = "none";
    btn.style.appearance = "none";
    btn.style.cursor = "pointer";
    btn.style.touchAction = "manipulation";
    btn.style.webkitTapHighlightColor = "transparent";
    btn.setAttribute(MARK, "1");
    btn.setAttribute("aria-label", (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60));

    // Écouteur DIRECT sur l'élément : chemin natif, sans délégation.
    btn.addEventListener("click", function () { invoke(call); });
    // Filet tactile, sans preventDefault (ne peut donc pas tuer le clic natif).
    btn.addEventListener("touchend", function () { invoke(call); }, { passive: true });

    if (el.parentNode) el.parentNode.replaceChild(btn, el);
  }

  function convertAll(root) {
    var scope = (root && root.querySelectorAll) ? root : document;
    var list;
    try { list = scope.querySelectorAll(SEL); } catch (e) { return; }
    for (var i = 0; i < list.length; i++) toNativeButton(list[i]);
  }

  var obs = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var added = muts[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var n = added[j];
        if (n.nodeType !== 1) continue;
        if (n.matches && n.matches(SEL)) toNativeButton(n);
        else convertAll(n);
      }
    }
  });

  function start() {
    if (!document.body) { setTimeout(start, 100); return; }
    convertAll(document);
    obs.observe(document.body, { childList: true, subtree: true });
    console.log("[50-strategy-tap-fix v3] boutons de stratégie convertis en boutons natifs");
  }

  window._rjStrategyTapFixUninstall = function () {
    obs.disconnect();
    console.log("[50-strategy-tap-fix] désinstallé (rechargez la page)");
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
