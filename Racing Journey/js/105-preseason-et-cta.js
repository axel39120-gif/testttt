/* =====================================================================
 * 105-preseason-et-cta.js — SAVOIR OÙ L'ON VA AVANT DE PARTIR
 *
 * DEUX CHOSES
 *
 * 1. LE PLAN DE PRÉ-SAISON DEVENAIT FACULTATIF
 *    Rien n'obligeait à le remplir : on pouvait enchaîner toute une saison
 *    sans objectif, sans répartition de budget, sans angle de communication
 *    — et donc sans les effets qui vont avec. L'écran existait, mais il
 *    fallait penser à y aller.
 *    Désormais, la première pression sur « Continuer » d'une saison mène au
 *    plan. Une fois validé, on repart vers la première course.
 *
 * 2. LE BOUTON « CONTINUER » NE DISAIT RIEN DE LA SUITE
 *    Toujours de la même couleur, quel que soit ce qui attendait : une
 *    course, un événement de paddock, une conférence de presse, un bilan
 *    de saison. Il prend maintenant la teinte de sa destination — on sait
 *    où l'on va avant d'appuyer.
 *
 * Réversible : window._rj105Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[105-preseason]";
  var CSS_ID = "rj105-css";

  function G_() { return (typeof window.G !== "undefined") ? window.G : null; }

  /* ==================================================================
   * 1. LE PLAN DE PRÉ-SAISON
   * ================================================================== */
  function planFait() {
    var G = G_();
    if (!G) return true;
    try {
      var p = G.preseason;
      return !!(p && p.configured && p.saison === G.saison);
    } catch (e) { return true; }
  }

  /* Le plan n'a de sens qu'avant la première course de la saison : après,
     la saison est lancée et les choix n'auraient plus de portée. */
  function planAttendu() {
    var G = G_();
    if (!G) return false;
    if (planFait()) return false;
    try {
      if ((G.races || []).length > 0) return false;
      if (!G.currentTeam || G.currentTeam === "Indépendant") return false;
    } catch (e) { return false; }
    return true;
  }

  /* ==================================================================
   * 2. LA DESTINATION DU BOUTON
   * ================================================================== */
  var TEINTES = {
    preseason: { c: "#F5C542", lbl: "Plan de saison" },
    race:      { c: "#FF1801", lbl: "Course" },
    event:     { c: "#A78BFA", lbl: "Événement" },
    mediaday:  { c: "#34D399", lbl: "Conférence de presse" },
    saison:    { c: "#F5C542", lbl: "Bilan de saison" },
    defaut:    { c: "#FF1801", lbl: "" }
  };

  function destination() {
    var G = G_();
    if (!G) return TEINTES.defaut;

    if (planAttendu()) return TEINTES.preseason;

    /* La fin de saison prime : quand la saison est close, le clic mène au
       bilan quoi qu'il arrive, même si une conférence restait programmée. */
    try { if (G.seasonOver) return TEINTES.saison; } catch (e) {}

    /* Une conférence prévue cette semaine passe ensuite : c'est elle qui
       s'ouvrira au clic. */
    try {
      if (window._rj99 && window._rj99.disponible && window._rj99.disponible() &&
          window._rj99.convoqueCetteSemaine && window._rj99.convoqueCetteSemaine()) {
        return TEINTES.mediaday;
      }
    } catch (e) {}

    try {
      if (typeof window.getNextMoment === "function") {
        var m = window.getNextMoment();
        if (!m) return TEINTES.saison;
        if (m.type === "event") return TEINTES.event;
        return TEINTES.race;
      }
    } catch (e) {}
    return TEINTES.defaut;
  }

  function injecterCSS() {
    if (document.getElementById(CSS_ID)) return;
    var css = [
      /* Le fond coloré doit aller sur le DISQUE, pas sur le conteneur : celui-ci
         est un carré de 64 pixels transparent, et le teinter faisait déborder
         un carré derrière le bouton rond.
         Trois éléments à accorder : le halo pulsé, le disque et son ombre. */
      "#ni-cta-continue .ni-cta-icon{" +
        "background:linear-gradient(135deg," +
          "color-mix(in srgb,var(--rj105-c,#FF1801) 82%,#ffffff) 0%," +
          "var(--rj105-c,#FF1801) 100%) !important;" +
        "box-shadow:0 8px 24px color-mix(in srgb,var(--rj105-c,#FF1801) 50%,transparent)," +
          "0 0 0 1px rgba(255,255,255,0.10) inset," +
          "0 -2px 4px rgba(0,0,0,0.30) inset !important;" +
        "transition:background .3s ease,box-shadow .3s ease}",
      "#ni-cta-continue .ni-cta-ring{" +
        "background:radial-gradient(circle," +
          "color-mix(in srgb,var(--rj105-c,#FF1801) 40%,transparent) 0%,transparent 65%) !important;" +
        "transition:background .3s ease}"
    ].join("\n");
    var st = document.createElement("style");
    st.id = CSS_ID; st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  function teinter() {
    var btn = document.getElementById("ni-cta-continue");
    if (!btn) return;
    injecterCSS();
    var d = destination();
    btn.style.setProperty("--rj105-c", d.c);
    if (d.lbl) btn.setAttribute("title", d.lbl);
    btn.setAttribute("data-rj105", d.lbl || "");
  }

  /* ==================================================================
   * 3. INSTALLATION
   * ================================================================== */
  var _orig = {};

  function installer() {
    if (typeof window.advanceToNextMoment !== "function") return false;
    if (window.advanceToNextMoment._rj105) return true;

    _orig.advanceToNextMoment = window.advanceToNextMoment;
    window.advanceToNextMoment = function () {
      /* Le plan passe avant tout le reste : on ne part pas en saison sans
         avoir dit où l'on va. */
      if (planAttendu()) {
        try {
          if (typeof window.navTo === "function") window.navTo("S-preseason", null);
          if (typeof window.renderPreseasonPlanning === "function") {
            setTimeout(function () {
              try { window.renderPreseasonPlanning(); } catch (e) {}
            }, 40);
          }
        } catch (e) { console.warn(TAG, e && e.message); }
        return;
      }
      return _orig.advanceToNextMoment.apply(this, arguments);
    };
    window.advanceToNextMoment._rj105 = true;

    /* Une fois le plan validé, on enchaîne sur la première course plutôt
       que de laisser le joueur chercher son chemin. */
    if (typeof window.savePreseasonPlan === "function" && !window.savePreseasonPlan._rj105) {
      _orig.savePreseasonPlan = window.savePreseasonPlan;
      window.savePreseasonPlan = function () {
        var r = _orig.savePreseasonPlan.apply(this, arguments);
        setTimeout(function () {
          try {
            teinter();
            if (typeof window.advanceToNextMoment === "function") window.advanceToNextMoment();
          } catch (e) {}
        }, 260);
        return r;
      };
      window.savePreseasonPlan._rj105 = true;
    }

    teinter();
    return true;
  }

  function brancherRafraichissement() {
    if (Array.isArray(window.RJ_SCREEN_HOOKS) &&
        !window.RJ_SCREEN_HOOKS.some(function (h) { return h && h.id === "105-cta"; })) {
      window.RJ_SCREEN_HOOKS.push({
        id: "105-cta", ecran: "*",
        apres: function () { setTimeout(teinter, 60); }
      });
      return true;
    }
    return false;
  }

  function boot() {
    var essais = 0;
    (function tenter() {
      if (installer()) {
        brancherRafraichissement();
        /* Filet : la destination change aussi hors navigation (fin de
           course, semaine qui avance). Une vérification légère suffit. */
        setInterval(teinter, 1500);
        console.log(TAG, "plan de pré-saison obligatoire, bouton coloré selon la suite");
        return;
      }
      if (essais++ < 80) setTimeout(tenter, 150);
    })();

    window._rj105 = {
      destination: destination, planAttendu: planAttendu,
      planFait: planFait, teinter: teinter, TEINTES: TEINTES
    };
    window._rj105Uninstall = function () {
      Object.keys(_orig).forEach(function (k) { window[k] = _orig[k]; });
      var c = document.getElementById(CSS_ID); if (c) c.remove();
      console.log(TAG, "désinstallé");
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
