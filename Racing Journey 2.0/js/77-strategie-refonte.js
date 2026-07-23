/* =====================================================================
 * 77-strategie-refonte.js — ÉCRAN STRATÉGIE RECONSTRUIT
 *
 * TROIS PROBLÈMES, UNE SEULE CAUSE POUR LE PRINCIPAL
 * --------------------------------------------------
 *  1. DIMENSIONS. Le contenu débordait du cadre : blocs en largeur fixe,
 *     marges négatives, absence de box-sizing.
 *
 *  2. SÉLECTEUR DE MODE DE PILOTAGE INUTILISABLE. Le module 50 avait tenté
 *     un correctif par touchend en capture ; le défaut persistait. La cause
 *     racine n'était pas l'événement mais la DESTRUCTION DE LA CIBLE :
 *     chaque fonction de réglage (setStrategyStops, applyStrategyPreset…)
 *     se termine par renderStrategyScreen(), qui réécrit intégralement
 *     l'innerHTML du panneau. Sur iOS, l'élément touché disparaît entre le
 *     touchstart et le click : l'événement n'aboutit jamais.
 *
 *     Corriger l'écouteur ne pouvait donc pas suffire. La structure est
 *     désormais construite UNE SEULE FOIS, avec de vrais <button> et des
 *     écouteurs attachés après insertion. Une interaction ne met à jour que
 *     des classes et des textes : plus rien n'est détruit sous le doigt.
 *
 *  3. ARRÊTS SUR UNE PAGE SÉPARÉE. Le choix du nombre d'arrêts et des
 *     composés est rapatrié sur l'écran stratégie, avec le reste.
 *
 * MÉTHODE — renderStrategyScreen est remplacée. Toutes les fonctions
 * métier d'origine sont réutilisées telles quelles : applyStrategyPreset,
 * setStrategyStops, setStrategyCompound, setStrategyWeatherStance,
 * confirmStrategy, _strategyAvailableCompounds, _pitConfigForCat. Aucune
 * règle de simulation n'est modifiée, aucun fichier cœur édité.
 *
 * Le module 50 est neutralisé au démarrage : son correctif porte sur un
 * balisage qui n'existe plus, et ses écouteurs en capture avec
 * preventDefault gêneraient les nouveaux boutons.
 *
 * Réversible : window._rj77Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[77-strategie-refonte]";
  var wrapped = {};
  var etat = { installe: false, rendus: 0 };
  window._rj77Status = function () { return etat; };

  var MODES = [
    { id: "attack",  nom: "Attaque",     desc: "Pousser fort d\u00e8s le d\u00e9part, quitte \u00e0 user les pneus." },
    { id: "manage",  nom: "Gestion",     desc: "\u00c9conomiser t\u00f4t pour finir plus vite." },
    { id: "defend",  nom: "Conservateur", desc: "Prot\u00e9ger la position, limiter les risques." },
    { id: "gamble",  nom: "Tout ou rien", desc: "Attaque maximale, pneus sacrifi\u00e9s." }
  ];

  var COMPOUNDS = {
    soft:   { nom: "Tendres", c: "#EF4444" },
    medium: { nom: "Medium",  c: "#F59E0B" },
    hard:   { nom: "Durs",    c: "#E5E7EB" },
    inter:  { nom: "Interm.", c: "#22C55E" },
    wet:    { nom: "Pluie",   c: "#3B82F6" }
  };

  var METEO = [
    { id: "ignore",   nom: "Ignorer" },
    { id: "react",    nom: "R\u00e9agir vite" },
    { id: "anticipe", nom: "Anticiper" }
  ];

  function S() {
    try {
      if (typeof _strategyEnsureInit === "function") _strategyEnsureInit();
      return G.raceStrategy || {};
    } catch (e) { return {}; }
  }

  function modeActuel() {
    var s = S();
    var a = s.aggressionStart, b = s.aggressionEnd, t = s.tyreManagement;
    if (a === 9 && b === 5 && t === 2) return "attack";
    if (a === 5 && b === 7 && t === 7) return "manage";
    if (a === 3 && b === 4 && t === 6) return "defend";
    if (a === 10 && b === 10 && t === 1) return "gamble";
    return null;
  }

  function bornesArrets() {
    try {
      var cfg = (typeof _pitConfigForCat === "function") ? _pitConfigForCat() : null;
      if (!cfg || !cfg.enabled) return null;
      return { min: cfg.minStops || 0, max: cfg.maxStops || 0 };
    } catch (e) { return null; }
  }

  function composes() {
    try {
      return (typeof _strategyAvailableCompounds === "function") ? (_strategyAvailableCompounds() || []) : [];
    } catch (e) { return []; }
  }

  /* ------------------------------------------------------------ styles --- */
  function css() {
    if (document.getElementById("rj77-css")) return;
    var st = document.createElement("style");
    st.id = "rj77-css";
    st.textContent = [
      /* Le conteneur d'origine laissait le contenu deborder. */
      "#rt-strat,#strategy-screen-content{width:100%;max-width:100%;box-sizing:border-box;overflow-x:hidden}",
      ".rj77{padding:10px 14px 18px;box-sizing:border-box;width:100%;max-width:100%}",
      ".rj77 *{box-sizing:border-box}",
      ".rj77-k{font-family:var(--font-display);font-size:9.5px;font-weight:800;letter-spacing:.18em;",
      "text-transform:uppercase;color:var(--muted);margin:16px 0 8px}",
      ".rj77-k:first-child{margin-top:2px}",

      /* boutons de mode : vrais <button>, pleine largeur, jamais recrees */
      ".rj77-modes{display:flex;flex-direction:column;gap:7px}",
      ".rj77-mode{display:block;width:100%;text-align:left;padding:12px 13px;border-radius:11px;",
      "background:linear-gradient(180deg,var(--bg3),var(--bg2));border:1px solid var(--border);",
      "color:var(--text);cursor:pointer;-webkit-appearance:none;appearance:none;",
      "-webkit-tap-highlight-color:transparent;touch-action:manipulation;transition:border-color .12s,background .12s}",
      ".rj77-mode.on{border-color:var(--red,#FF1801);background:rgba(255,24,1,.08)}",
      ".rj77-mode-n{font-family:var(--font-display);font-size:12.5px;font-weight:900;",
      "letter-spacing:.04em;text-transform:uppercase;color:#fff}",
      ".rj77-mode.on .rj77-mode-n{color:var(--red,#FF1801)}",
      ".rj77-mode-d{font-size:11.5px;color:var(--text3);margin-top:3px;line-height:1.4}",

      /* rangees de choix compactes */
      ".rj77-row{display:flex;gap:7px;flex-wrap:wrap}",
      ".rj77-chip{flex:1 1 0;min-width:74px;padding:11px 8px;border-radius:10px;text-align:center;",
      "background:linear-gradient(180deg,var(--bg3),var(--bg2));border:1px solid var(--border);",
      "color:var(--text2);font-family:var(--font-display);font-size:11.5px;font-weight:800;",
      "cursor:pointer;-webkit-appearance:none;appearance:none;",
      "-webkit-tap-highlight-color:transparent;touch-action:manipulation}",
      ".rj77-chip.on{border-color:var(--red,#FF1801);background:rgba(255,24,1,.08);color:#fff}",
      ".rj77-chip .pt{display:block;width:11px;height:11px;border-radius:50%;margin:0 auto 5px}",

      /* compteur d'arrets */
      ".rj77-stops{display:flex;align-items:center;gap:10px;padding:11px 13px;border-radius:11px;",
      "background:linear-gradient(180deg,var(--bg3),var(--bg2));border:1px solid var(--border)}",
      ".rj77-sb{width:40px;height:40px;flex-shrink:0;border-radius:10px;border:1px solid var(--border-hi);",
      "background:transparent;color:#fff;font-size:20px;font-weight:700;cursor:pointer;line-height:1;",
      "-webkit-appearance:none;appearance:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation}",
      ".rj77-sb:disabled{opacity:.3}",
      ".rj77-sv{flex:1;text-align:center}",
      ".rj77-sv b{display:block;font-family:var(--font-display);font-size:22px;font-weight:900;color:#fff;line-height:1}",
      ".rj77-sv span{font-size:10px;color:var(--text3);letter-spacing:.1em;text-transform:uppercase}",

      ".rj77-note{font-size:11.5px;color:var(--text3);line-height:1.45;margin-top:8px}",
      ".rj77-go{width:100%;margin-top:18px;padding:14px;border-radius:12px;border:0;",
      "background:var(--red,#FF1801);color:#fff;font-family:var(--font-display);font-size:12.5px;",
      "font-weight:900;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;",
      "-webkit-appearance:none;appearance:none;touch-action:manipulation}"
    ].join("");
    document.head.appendChild(st);
  }

  /* ------------------------------------------------------------ rendu --- */
  var racine = null;

  function bouton(cls, html) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = cls;
    b.innerHTML = html;
    return b;
  }

  // Met à jour l'état visuel SANS reconstruire : c'est ce qui rend les
  // boutons fiables sur iOS.
  function rafraichir() {
    if (!racine) return;
    var s = S(), m = modeActuel();

    var modes = racine.querySelectorAll(".rj77-mode");
    for (var i = 0; i < modes.length; i++) {
      modes[i].classList.toggle("on", modes[i].getAttribute("data-mode") === m);
    }
    var chips = racine.querySelectorAll(".rj77-chip[data-comp]");
    for (var j = 0; j < chips.length; j++) {
      chips[j].classList.toggle("on", chips[j].getAttribute("data-comp") === s.tyreCompound);
    }
    var met = racine.querySelectorAll(".rj77-chip[data-meteo]");
    for (var k = 0; k < met.length; k++) {
      met[k].classList.toggle("on", met[k].getAttribute("data-meteo") === (s.weatherStance || "ignore"));
    }
    var v = racine.querySelector(".rj77-sv b");
    if (v) v.textContent = (s.plannedStops || 0);
    var bn = bornesArrets();
    var moins = racine.querySelector(".rj77-sb[data-d='-1']");
    var plus = racine.querySelector(".rj77-sb[data-d='1']");
    if (bn && moins) moins.disabled = (s.plannedStops || 0) <= bn.min;
    if (bn && plus) plus.disabled = (s.plannedStops || 0) >= bn.max;
  }

  function construire(hote) {
    css();
    hote.innerHTML = "";
    var w = document.createElement("div");
    w.className = "rj77";
    racine = w;

    function titre(t) {
      var d = document.createElement("div");
      d.className = "rj77-k";
      d.textContent = t;
      w.appendChild(d);
    }

    /* --- mode de pilotage --- */
    titre("Mode de pilotage");
    var grille = document.createElement("div");
    grille.className = "rj77-modes";
    MODES.forEach(function (mo) {
      var b = bouton("rj77-mode",
        '<span class="rj77-mode-n">' + mo.nom + '</span>' +
        '<span class="rj77-mode-d">' + mo.desc + '</span>');
      b.setAttribute("data-mode", mo.id);
      b.addEventListener("click", function () {
        try { if (typeof applyStrategyPreset === "function") applyStrategyPreset(mo.id); } catch (e) {}
        rafraichir();
      });
      grille.appendChild(b);
    });
    w.appendChild(grille);

    /* --- arrêts, désormais sur cette page --- */
    var bn = bornesArrets();
    if (bn && bn.max > 0) {
      titre("Arr\u00eats au stand");
      var box = document.createElement("div");
      box.className = "rj77-stops";
      var moins = bouton("rj77-sb", "\u2212");
      moins.setAttribute("data-d", "-1");
      var val = document.createElement("div");
      val.className = "rj77-sv";
      val.innerHTML = "<b>0</b><span>arr\u00eats pr\u00e9vus</span>";
      var plus = bouton("rj77-sb", "+");
      plus.setAttribute("data-d", "1");

      function change(d) {
        var s = S();
        var n = (s.plannedStops || 0) + d;
        try { if (typeof setStrategyStops === "function") setStrategyStops(n); } catch (e) {}
        rafraichir();
      }
      moins.addEventListener("click", function () { change(-1); });
      plus.addEventListener("click", function () { change(1); });

      box.appendChild(moins); box.appendChild(val); box.appendChild(plus);
      w.appendChild(box);

      var note = document.createElement("div");
      note.className = "rj77-note";
      note.textContent = "Entre " + bn.min + " et " + bn.max + " arr\u00eats sur cette course.";
      w.appendChild(note);
    }

    /* --- composé de départ --- */
    var comps = composes();
    if (comps.length) {
      titre("Pneus de d\u00e9part");
      var rc = document.createElement("div");
      rc.className = "rj77-row";
      comps.forEach(function (id) {
        var info = COMPOUNDS[id] || { nom: id, c: "#9CA3AF" };
        var b = bouton("rj77-chip",
          '<span class="pt" style="background:' + info.c + '"></span>' + info.nom);
        b.setAttribute("data-comp", id);
        b.addEventListener("click", function () {
          try { if (typeof setStrategyCompound === "function") setStrategyCompound(id); } catch (e) {}
          rafraichir();
        });
        rc.appendChild(b);
      });
      w.appendChild(rc);
    }

    /* --- attitude météo --- */
    titre("Face \u00e0 la m\u00e9t\u00e9o");
    var rm = document.createElement("div");
    rm.className = "rj77-row";
    METEO.forEach(function (mt) {
      var b = bouton("rj77-chip", mt.nom);
      b.setAttribute("data-meteo", mt.id);
      b.addEventListener("click", function () {
        try { if (typeof setStrategyWeatherStance === "function") setStrategyWeatherStance(mt.id); } catch (e) {}
        rafraichir();
      });
      rm.appendChild(b);
    });
    w.appendChild(rm);

    /* --- validation --- */
    var go = bouton("rj77-go", "Confirmer la strat\u00e9gie");
    go.addEventListener("click", function () {
      try { if (typeof confirmStrategy === "function") confirmStrategy(); } catch (e) {}
    });
    w.appendChild(go);

    hote.appendChild(w);
    rafraichir();
    etat.rendus++;
  }

  /* ---------------------------------------------------------- montage --- */
  function installer() {
    if (typeof window.renderStrategyScreen !== "function") return false;
    if (window.renderStrategyScreen._rj77) return true;
    wrapped.renderStrategyScreen = window.renderStrategyScreen;
    var fn = function () {
      try {
        var hote = document.getElementById("strategy-screen-content");
        if (!hote) return;
        // On ne reconstruit que si notre panneau n'est pas déjà en place :
        // les appels répétés des fonctions de réglage ne doivent plus
        // détruire les boutons.
        if (!racine || !racine.parentNode || racine.parentNode !== hote) construire(hote);
        else rafraichir();
      } catch (e) { console.warn(TAG, e); }
    };
    fn._rj77 = true;
    window.renderStrategyScreen = fn;
    return true;
  }

  function neutraliser50() {
    try { if (typeof window._rj50Uninstall === "function") window._rj50Uninstall(); } catch (e) {}
    try { if (typeof window._rjStrategyTapUninstall === "function") window._rjStrategyTapUninstall(); } catch (e) {}
  }

  var essais = 0;
  function boot() {
    var ok = false;
    try { ok = installer(); } catch (e) {}
    if (!ok) {
      if (essais++ < 120) { setTimeout(boot, 100); return; }
      console.warn(TAG + " abandon : renderStrategyScreen introuvable");
      return;
    }
    css();
    neutraliser50();
    etat.installe = true;
    console.log(TAG + " actif \u2014 panneau reconstruit, arr\u00eats int\u00e9gr\u00e9s, boutons natifs");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj77Rendre = function () {
    var h = document.getElementById("strategy-screen-content");
    if (h) construire(h);
  };
  window._rj77Uninstall = function () {
    Object.keys(wrapped).forEach(function (k) { window[k] = wrapped[k]; });
    var st = document.getElementById("rj77-css");
    if (st && st.parentNode) st.parentNode.removeChild(st);
    racine = null;
    etat.installe = false;
    console.log(TAG + " d\u00e9sinstall\u00e9");
  };
})();
