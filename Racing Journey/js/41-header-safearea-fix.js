/* =====================================================================
 * 41-header-safearea-fix.js — HEADER FORCÉ TOUT EN HAUT (chaque écran)
 *
 * Objectif : sur chaque écran du jeu, le header doit être collé au sommet
 * de la zone d'affichage. En PWA iOS, certains écrans le rendent ~1
 * safe-area trop bas (bug de rendu non reproductible en desktop).
 *
 * Ce module MESURE l'écart réel entre le haut du header et le haut de la
 * zone des écrans (.screens) sur l'écran actif, et le compense par un
 * translateY négatif sur l'écran. Améliorations vs version initiale :
 *   - détection GÉNÉRIQUE du header : .hdr, .apex-cockpit-hdr,
 *     .apex-create-hdr, .lec-header-v2, .rj-bcast-hdr, sinon 1er élément ;
 *   - couvre donc l'accueil, la création, le broadcast… pas seulement .hdr ;
 *   - re-corrige après chaque re-rendu d'écran (pas seulement au changement
 *     d'écran), pour résister aux refreshScreen() ;
 *   - seuil bas (coller vraiment en haut), no-op total en desktop (écart 0).
 *
 * Réversible : window._rjHeaderFixUninstall().
 * =================================================================== */
(function () {
  "use strict";

  var THRESHOLD = 3; // px : en-dessous, l'écran est considéré collé en haut
  var HDR_SEL = ".hdr, .apex-cockpit-hdr, .apex-create-hdr, .lec-header-v2, .rj-bcast-hdr";
  var screensEl = null, observer = null, pending = false;

  function getScreens() {
    if (!screensEl) screensEl = document.querySelector(".screens");
    return screensEl;
  }

  function findHeader(scr) {
    return scr.querySelector(HDR_SEL) || scr.firstElementChild;
  }

  function fixOffset(scr) {
    var screens = getScreens();
    if (!scr || !screens || !scr.classList.contains("on")) return;
    var hdr = findHeader(scr);
    if (!hdr) return;

    // repartir d'un état neutre pour mesurer le décalage réel
    if (scr.style.transform) scr.style.transform = "";
    var gap = Math.round(
      hdr.getBoundingClientRect().top - screens.getBoundingClientRect().top
    );
    if (gap > THRESHOLD) {
      scr.style.transform = "translateY(-" + gap + "px)";
      scr.setAttribute("data-rj-hfix", gap);
    } else if (scr.hasAttribute("data-rj-hfix")) {
      scr.removeAttribute("data-rj-hfix");
    }
  }

  // un seul passage par frame, sur l'écran actif (double rAF : laisser iOS
  // finir son reflow safe-area avant de mesurer)
  function fixActive() {
    if (pending || typeof requestAnimationFrame !== "function") {
      if (typeof requestAnimationFrame !== "function") {
        var s0 = document.querySelector(".scr.on"); if (s0) fixOffset(s0);
      }
      return;
    }
    pending = true;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        pending = false;
        var scr = document.querySelector(".scr.on");
        if (scr) fixOffset(scr);
      });
    });
  }

  function install() {
    if (window._rjHeaderFixInstalled) return;
    var screens = getScreens();
    if (!screens) { if (typeof setTimeout === "function") setTimeout(install, 150); return; }
    window._rjHeaderFixInstalled = true;

    // changement d'écran (.on) ET re-rendu de contenu : on observe les deux.
    // On NE surveille PAS l'attribut style → notre propre translateY ne
    // redéclenche pas l'observer (pas de boucle).
    if (typeof MutationObserver === "function") {
      observer = new MutationObserver(function () { fixActive(); });
      observer.observe(screens, {
        attributes: true, attributeFilter: ["class"],
        childList: true, subtree: true
      });
    }

    if (typeof window.addEventListener === "function") {
      window.addEventListener("resize", fixActive);
      window.addEventListener("orientationchange", function () { setTimeout(fixActive, 60); });
    }

    fixActive();
    if (typeof setTimeout === "function") {
      setTimeout(fixActive, 250);
      setTimeout(fixActive, 800);
      setTimeout(fixActive, 1600);
    }

    window._rjHeaderFixUninstall = function () {
      if (observer) observer.disconnect();
      if (typeof window.removeEventListener === "function") window.removeEventListener("resize", fixActive);
      var fixed = document.querySelectorAll(".scr[data-rj-hfix]");
      for (var i = 0; i < fixed.length; i++) {
        fixed[i].style.transform = "";
        fixed[i].removeAttribute("data-rj-hfix");
      }
      window._rjHeaderFixInstalled = false;
      console.log("[41-header-safearea-fix] désinstallé");
    };

    console.log("[41-header-safearea-fix] actif — header forcé en haut sur chaque écran");
  }

  if (document.readyState === "loading" && typeof document.addEventListener === "function") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
})();
