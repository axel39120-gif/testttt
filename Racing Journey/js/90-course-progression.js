/* =====================================================================
 * 90-course-progression.js — LA COURSE SE SUIT À LA BARRE, PAS AU TABLEAU
 *
 * POURQUOI
 * Le classement en direct était la source de presque tous les défauts
 * rencontrés : positions qui oscillent, sauts incompréhensibles, écarts
 * incohérents, composants d'affichage empilés. Il demandait au moteur une
 * précision tour par tour dont le joueur n'a pas besoin — ce qui compte,
 * c'est le résultat et les décisions qui y mènent.
 *
 * CE QUE DEVIENT L'ÉCRAN DE COURSE
 *   · pendant l'épreuve : le circuit, le tour en cours, une barre de
 *     progression, et les événements auxquels répondre ;
 *   · au drapeau : le classement complet s'affiche d'un coup.
 *
 * Les positions continuent d'être calculées à chaque tour — les événements
 * en dépendent — elles ne sont simplement plus montrées avant l'arrivée.
 *
 * CE QUI EST MASQUÉ PENDANT LA COURSE
 * Le classement en direct et le fil d'actualité. Ils restent en place dans
 * la page et réapparaissent à l'arrivée : rien n'est supprimé, tout est
 * différé.
 *
 * Réversible : window._rj90Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[90-course]";
  var CSS_ID = "rj90-css";

  function fn(n) { return typeof window[n] === "function"; }
  function LR() { return (typeof window.LIVE_RACE !== "undefined") ? window.LIVE_RACE : null; }

  function injecterCSS() {
    if (document.getElementById(CSS_ID)) return;
    var css = [
      "#rj90-progression{margin:14px 16px 0;padding:18px 16px;border:1px solid var(--border-hi);" +
        "border-radius:var(--r);background:linear-gradient(160deg,var(--bg2) 0%,var(--bg) 100%)}",
      "#rj90-progression .circuit{font-family:var(--font-display);font-size:11px;font-weight:800;" +
        "letter-spacing:.18em;text-transform:uppercase;color:var(--muted)}",
      "#rj90-progression .tour{display:flex;align-items:baseline;gap:8px;margin:8px 0 14px}",
      "#rj90-progression .tour .n{font-family:var(--font-display);font-size:34px;font-weight:900;" +
        "color:var(--white);line-height:1}",
      "#rj90-progression .tour .sur{font-family:var(--font-display);font-size:15px;font-weight:800;color:var(--muted)}",
      "#rj90-progression .tour .lbl{margin-left:auto;font-size:11px;color:var(--text3);font-family:var(--font-body)}",
      "#rj90-barre{height:6px;background:var(--line);border-radius:3px;overflow:hidden}",
      "#rj90-barre>span{display:block;height:100%;background:linear-gradient(90deg,var(--red),#FF6B4A);" +
        "transition:width .35s ease}",
      "#rj90-progression .etat{margin-top:12px;font-size:12.5px;color:var(--soft);line-height:1.5;" +
        "font-family:var(--font-body);min-height:19px}",
      "#rj90-progression.finie .tour .n{color:var(--green)}",
      "#rj90-progression.finie #rj90-barre>span{background:var(--green)}"
    ].join("");
    var st = document.createElement("style");
    st.id = CSS_ID; st.textContent = css;
    document.head.appendChild(st);
  }

  /* ==================================================================
   * Le bloc de progression
   * ================================================================== */

  function bloc() {
    var b = document.getElementById("rj90-progression");
    if (b) return b;
    var ecran = document.getElementById("race-screen");
    if (!ecran) return null;
    injecterCSS();
    b = document.createElement("div");
    b.id = "rj90-progression";
    b.innerHTML =
      '<div class="circuit" id="rj90-circuit"></div>' +
      '<div class="tour"><span class="n" id="rj90-tour">0</span>' +
        '<span class="sur" id="rj90-total">/ 0</span>' +
        '<span class="lbl" id="rj90-lbl">tours</span></div>' +
      '<div id="rj90-barre"><span style="width:0%"></span></div>' +
      '<div class="etat" id="rj90-etat"></div>';
    var entete = document.getElementById("live-race-header");
    if (entete && entete.nextSibling) ecran.insertBefore(b, entete.nextSibling);
    else ecran.insertBefore(b, ecran.firstChild);
    return b;
  }

  /* Messages d'ambiance, sans chiffres de position : ils ne doivent rien
     révéler du classement avant l'arrivée. */
  function etatDeCourse(part) {
    if (part < 0.02) return "Extinction des feux.";
    if (part < 0.2) return "Les premiers tours s'enchaînent, le rythme se met en place.";
    if (part < 0.45) return "La course s'installe. Les écarts se dessinent.";
    if (part < 0.6) return "Mi-course. C'est maintenant que tout se joue.";
    if (part < 0.8) return "Dernier tiers. La tension monte dans les stands.";
    if (part < 0.97) return "Fin de course. Chaque tour compte.";
    return "Dernier tour.";
  }

  function majProgression() {
    var lr = LR();
    var b = bloc();
    if (!b || !lr) return;

    var total = lr.total || 0;
    var tour = Math.min(lr.cur || 0, total);
    var part = total ? tour / total : 0;

    var c = document.getElementById("rj90-circuit");
    if (c) {
      var circuit = "";
      try { circuit = (window.RACE_STATE && RACE_STATE.circuit) || ""; } catch (e) {}
      c.textContent = circuit || (window.G ? G.cat : "");
    }
    var t = document.getElementById("rj90-tour");
    if (t) t.textContent = tour;
    var tt = document.getElementById("rj90-total");
    if (tt) tt.textContent = "/ " + total;
    var barre = document.querySelector("#rj90-barre > span");
    if (barre) barre.style.width = Math.round(part * 100) + "%";
    var etat = document.getElementById("rj90-etat");

    if (lr.finished) {
      b.classList.add("finie");
      if (etat) etat.textContent = "Drapeau à damier. Voici le classement.";
      var l = document.getElementById("rj90-lbl");
      if (l) l.textContent = "tours parcourus";
      revelerClassement();
    } else {
      b.classList.remove("finie");
      if (etat) etat.textContent = etatDeCourse(part);
      masquerClassement();
    }
  }

  /* ==================================================================
   * Masquage du classement pendant la course
   * ================================================================== */

  /* Liste blanche plutôt que liste noire : pendant la course, seuls
     l'en-tête, la progression et le bouton d'action restent visibles. Tout
     le reste — classement, fil d'actualité, bandeau de stratégie, bouton
     d'arrêt, encarts divers — est masqué, y compris ce que d'autres modules
     injectent après coup. Chasser chaque bloc un par un aurait demandé de
     connaître leurs identifiants, dont plusieurs n'en ont pas. */
  var VISIBLES = ["live-race-header", "rj90-progression", "race-btn"];

  /* Certains éléments flottent hors de l'écran de course : le bouton
     d'arrêt au stand et son bandeau de stratégie, positionnés dans la page
     et non dans le conteneur. Ils n'ont plus d'objet — les arrêts sont
     automatiques et la stratégie a été retirée du jeu. */
  var FLOTTANTS = ["pit-button-container"];

  function masquerClassement() {
    var ecran = document.getElementById("race-screen");
    if (!ecran) return;
    var enfants = ecran.children;
    for (var i = 0; i < enfants.length; i++) {
      var e = enfants[i];
      var garder = VISIBLES.indexOf(e.id) >= 0;
      if (e._rj90Base === undefined) e._rj90Base = e.style.display || "";
      e.style.display = garder ? e._rj90Base : "none";
    }
    for (var f = 0; f < FLOTTANTS.length; f++) {
      var fl = document.getElementById(FLOTTANTS[f]);
      if (fl) { if (fl._rj90Base === undefined) fl._rj90Base = fl.style.display || ""; fl.style.display = "none"; }
    }
  }

  function revelerClassement() {
    var ecran = document.getElementById("race-screen");
    if (!ecran) return;
    var enfants = ecran.children;
    for (var i = 0; i < enfants.length; i++) {
      var e = enfants[i];
      if (e.id === "rj90-progression") continue;      // la progression reste
      e.style.display = (e._rj90Base !== undefined) ? e._rj90Base : "";
    }
    /* Le bouton d'arrêt reste masqué même à l'arrivée : il n'a plus d'usage. */
  }

  /* ==================================================================
   * Branchements
   * ================================================================== */

  var _orig = {};

  function installer() {
    /* Une fois par tour : la barre avance. */
    if (!Array.isArray(window.RJ_LAP_HOOKS)) window.RJ_LAP_HOOKS = [];
    if (!window.RJ_LAP_HOOKS.some(function (h) { return h && h.id === "90-progression"; })) {
      window.RJ_LAP_HOOKS.push({ id: "90-progression", run: majProgression });
    }

    /* Au départ : remettre la barre à zéro et masquer le classement. */
    if (!Array.isArray(window.RJ_RACE_START_HOOKS)) window.RJ_RACE_START_HOOKS = [];
    if (!window.RJ_RACE_START_HOOKS.some(function (h) { return h && h.id === "90-progression"; })) {
      window.RJ_RACE_START_HOOKS.push({
        id: "90-progression",
        apres: function () { try { majProgression(); masquerClassement(); } catch (e) {} }
      });
    }

    /* Le classement continue d'être rendu — il est simplement caché — mais
       on s'assure qu'il réapparaît dès que la course est finie. */
    if (!Array.isArray(window.RJ_LEADERBOARD_HOOKS)) window.RJ_LEADERBOARD_HOOKS = [];
    if (!window.RJ_LEADERBOARD_HOOKS.some(function (h) { return h && h.id === "90-progression"; })) {
      window.RJ_LEADERBOARD_HOOKS.push({
        id: "90-progression",
        apres: function () {
          var lr = LR();
          if (lr && lr.finished) revelerClassement(); else masquerClassement();
        }
      });
    }

    /* À l'arrivée, le moteur affiche l'écran de résultat : on rend la main. */
    if (fn("showResult") && !window.showResult._rj90) {
      _orig.showResult = window.showResult;
      window.showResult = function () {
        try { revelerClassement(); majProgression(); } catch (e) {}
        return _orig.showResult.apply(this, arguments);
      };
      window.showResult._rj90 = true;
    }

    return !!(window.showResult && window.showResult._rj90);
  }

  function boot() {
    var essais = 0;
    (function tenter() {
      if (installer()) {
        console.log(TAG, "actif — progression pendant la course, classement à l'arrivée");
        return;
      }
      if (essais++ < 80) setTimeout(tenter, 150);
    })();

    window._rj90 = { maj: majProgression, masquer: masquerClassement, reveler: revelerClassement };
    window._rj90Uninstall = function () {
      try {
        if (_orig.showResult) window.showResult = _orig.showResult;
        revelerClassement();
        var b = document.getElementById("rj90-progression");
        if (b && b.parentNode) b.parentNode.removeChild(b);
        var css = document.getElementById(CSS_ID);
        if (css && css.parentNode) css.parentNode.removeChild(css);
        ["RJ_LAP_HOOKS", "RJ_RACE_START_HOOKS", "RJ_LEADERBOARD_HOOKS"].forEach(function (r) {
          if (!Array.isArray(window[r])) return;
          for (var i = window[r].length - 1; i >= 0; i--) {
            if (window[r][i] && window[r][i].id === "90-progression") window[r].splice(i, 1);
          }
        });
        console.log(TAG, "désinstallé");
      } catch (e) {}
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
