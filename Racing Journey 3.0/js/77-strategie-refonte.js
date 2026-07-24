/* =====================================================================
 * 77-strategie-refonte.js — ÉCRAN STRATÉGIE (réécriture complète)
 *
 * La version précédente reconstruisait le mode de pilotage actif en
 * comparant les trois valeurs d'agressivité à des combinaisons connues.
 * Détection fragile : dès qu'un autre système touchait à l'une des
 * valeurs, plus aucun bouton n'apparaissait sélectionné et le sélecteur
 * semblait mort. Or applyStrategyPreset écrit déjà, en clair :
 *     G.raceStrategy.preset = "attack" | "manage" | "defend" | "gamble"
 * On lit désormais ce champ. Plus de déduction, plus d'échec possible.
 *
 * AUTRES PARTIS PRIS, conservés de l'analyse précédente :
 *  · la structure est construite UNE SEULE FOIS, avec de vrais <button>
 *    et des écouteurs attachés après insertion. Les fonctions de réglage
 *    d'origine se terminent toutes par renderStrategyScreen(), qui
 *    réécrivait l'innerHTML : sur iOS l'élément touché disparaissait
 *    entre le touchstart et le click, et l'appui n'aboutissait jamais.
 *    Une interaction ne met plus à jour que des classes et des textes.
 *  · les arrêts au stand, les pneus de départ et l'attitude météo sont
 *    sur cette page, pas sur un écran séparé.
 *
 * ONGLET « COURSE » SUPPRIMÉ — confirmStrategy basculait vers un onglet
 * intermédiaire qui se contentait de rappeler la stratégie et d'offrir un
 * bouton « Départ ! ». On enchaîne directement sur la course : le bouton
 * de l'onglet est masqué, et la confirmation lance la simulation. Le
 * contenu de l'onglet reste dans le document, car runRaceLive s'appuie
 * dessus ; seul le passage manuel disparaît. Le sprint, lui, garde son
 * étape propre.
 *
 * Toutes les fonctions métier d'origine sont réutilisées telles quelles.
 * Aucune règle de simulation modifiée, aucun fichier cœur édité.
 *
 * Réversible : window._rj77Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[77-strategie]";
  var wrapped = {};
  var etat = { installe: false, rendus: 0, mode: null };
  window._rj77Status = function () { return etat; };

  var MODES = [
    { id: "attack", nom: "Attaque",      desc: "Pousser fort d\u00e8s le d\u00e9part, quitte \u00e0 user les pneus." },
    { id: "manage", nom: "Gestion",      desc: "\u00c9conomiser t\u00f4t pour finir plus vite." },
    { id: "defend", nom: "Conservateur", desc: "Prot\u00e9ger la position, limiter les risques." },
    { id: "gamble", nom: "Tout ou rien", desc: "Attaque maximale, pneus sacrifi\u00e9s." }
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

  // Lecture directe du champ écrit par applyStrategyPreset.
  function modeActuel() {
    var s = S();
    return (s && typeof s.preset === "string") ? s.preset : null;
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
      "#rt-strat,#strategy-screen-content{width:100%;max-width:100%;box-sizing:border-box;overflow-x:hidden}",
      ".rj77{padding:10px 14px 18px;box-sizing:border-box;width:100%;max-width:100%}",
      ".rj77 *{box-sizing:border-box}",
      ".rj77-k{font-family:var(--font-display);font-size:9.5px;font-weight:800;letter-spacing:.18em;",
      "text-transform:uppercase;color:var(--muted);margin:16px 0 8px}",
      ".rj77-k:first-child{margin-top:2px}",
      ".rj77-modes{display:flex;flex-direction:column;gap:7px}",
      ".rj77-mode{display:block;width:100%;text-align:left;padding:12px 13px;border-radius:11px;",
      "background:linear-gradient(180deg,var(--bg3),var(--bg2));border:1px solid var(--border);",
      "color:var(--text);cursor:pointer;-webkit-appearance:none;appearance:none;",
      "-webkit-tap-highlight-color:transparent;touch-action:manipulation;",
      "transition:border-color .12s,background .12s}",
      ".rj77-mode.on{border-color:var(--red,#FF1801);background:rgba(255,24,1,.08)}",
      ".rj77-mode-n{display:block;font-family:var(--font-display);font-size:12.5px;font-weight:900;",
      "letter-spacing:.04em;text-transform:uppercase;color:#fff}",
      ".rj77-mode.on .rj77-mode-n{color:var(--red,#FF1801)}",
      ".rj77-mode-d{display:block;font-size:11.5px;color:var(--text3);margin-top:3px;line-height:1.4}",
      ".rj77-row{display:flex;gap:7px;flex-wrap:wrap}",
      ".rj77-chip{flex:1 1 0;min-width:74px;padding:11px 8px;border-radius:10px;text-align:center;",
      "background:linear-gradient(180deg,var(--bg3),var(--bg2));border:1px solid var(--border);",
      "color:var(--text2);font-family:var(--font-display);font-size:11.5px;font-weight:800;",
      "cursor:pointer;-webkit-appearance:none;appearance:none;",
      "-webkit-tap-highlight-color:transparent;touch-action:manipulation}",
      ".rj77-chip.on{border-color:var(--red,#FF1801);background:rgba(255,24,1,.08);color:#fff}",
      ".rj77-chip .pt{display:block;width:11px;height:11px;border-radius:50%;margin:0 auto 5px}",
      ".rj77-stops{display:flex;align-items:center;gap:10px;padding:11px 13px;border-radius:11px;",
      "background:linear-gradient(180deg,var(--bg3),var(--bg2));border:1px solid var(--border)}",
      ".rj77-sb{width:40px;height:40px;flex-shrink:0;border-radius:10px;border:1px solid var(--border-hi);",
      "background:transparent;color:#fff;font-size:20px;font-weight:700;cursor:pointer;line-height:1;",
      "-webkit-appearance:none;appearance:none;-webkit-tap-highlight-color:transparent;",
      "touch-action:manipulation}",
      ".rj77-sb:disabled{opacity:.3}",
      ".rj77-sv{flex:1;text-align:center}",
      ".rj77-sv b{display:block;font-family:var(--font-display);font-size:22px;font-weight:900;",
      "color:#fff;line-height:1}",
      ".rj77-sv span{font-size:10px;color:var(--text3);letter-spacing:.1em;text-transform:uppercase}",
      ".rj77-note{font-size:11.5px;color:var(--text3);line-height:1.45;margin-top:8px}",
      ".rj77-go{width:100%;margin-top:18px;padding:14px;border-radius:12px;border:0;",
      "background:var(--red,#FF1801);color:#fff;font-family:var(--font-display);font-size:12.5px;",
      "font-weight:900;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;",
      "-webkit-appearance:none;appearance:none;touch-action:manipulation}",
      /* onglet « course » retiré de la barre : on passe direct au départ */
      "#race-tab-course{display:none !important}"
    ].join("");
    document.head.appendChild(st);
  }

  /* ------------------------------------------------------------- rendu --- */
  var racine = null;

  function bouton(cls, html) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = cls;
    b.innerHTML = html;
    return b;
  }

  function rafraichir() {
    if (!racine) return;
    var s = S(), m = modeActuel();
    etat.mode = m;

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

    titre("Mode de pilotage");
    var grille = document.createElement("div");
    grille.className = "rj77-modes";
    MODES.forEach(function (mo) {
      var b = bouton("rj77-mode",
        '<span class="rj77-mode-n">' + mo.nom + '</span>' +
        '<span class="rj77-mode-d">' + mo.desc + '</span>');
      b.setAttribute("data-mode", mo.id);
      b.addEventListener("click", function () {
        try {
          if (typeof applyStrategyPreset === "function") applyStrategyPreset(mo.id);
          else {
            // Repli : on écrit nous-mêmes, le champ preset reste la référence.
            var s = S();
            s.preset = mo.id;
          }
        } catch (e) {}
        rafraichir();
      });
      grille.appendChild(b);
    });
    w.appendChild(grille);

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
        try { if (typeof setStrategyStops === "function") setStrategyStops((s.plannedStops || 0) + d); } catch (e) {}
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

    var comps = composes();
    if (comps.length) {
      titre("Pneus de d\u00e9part");
      var rc = document.createElement("div");
      rc.className = "rj77-row";
      comps.forEach(function (id) {
        var info = COMPOUNDS[id] || { nom: id, c: "#9CA3AF" };
        var b = bouton("rj77-chip", '<span class="pt" style="background:' + info.c + '"></span>' + info.nom);
        b.setAttribute("data-comp", id);
        b.addEventListener("click", function () {
          try { if (typeof setStrategyCompound === "function") setStrategyCompound(id); } catch (e) {}
          rafraichir();
        });
        rc.appendChild(b);
      });
      w.appendChild(rc);
    }

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

    var go = bouton("rj77-go", "Confirmer et prendre le d\u00e9part");
    go.addEventListener("click", function () {
      try { if (typeof confirmStrategy === "function") confirmStrategy(); } catch (e) {}
    });
    w.appendChild(go);

    hote.appendChild(w);
    rafraichir();
    etat.rendus++;
  }

  /* ------------------------------- enchaînement direct sur la course --- */
  function installDepartDirect() {
    if (typeof window.confirmStrategy !== "function" || window.confirmStrategy._rj77) return;
    var o = window.confirmStrategy;
    var f = function () {
      var r = o.apply(this, arguments);
      try {
        var w = (typeof RACE_WEEKEND_STATE !== "undefined") ? RACE_WEEKEND_STATE : null;
        var sprint = !!(w && w.sprintAvailable && !w.sprintDone);
        if (!sprint) {
          // confirmStrategy a déjà basculé sur l'onglet « course ». On y
          // déclenche le départ sans laisser l'écran intermédiaire visible.
          setTimeout(function () {
            try {
              if (typeof runRaceLive === "function" &&
                  (typeof LIVE_RACE === "undefined" || !LIVE_RACE || !LIVE_RACE.total)) {
                runRaceLive();
              }
            } catch (e) { console.warn(TAG, e); }
          }, 120);
        }
      } catch (e) {}
      return r;
    };
    f._rj77 = true;
    wrapped.confirmStrategy = o;
    window.confirmStrategy = f;
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
        if (!racine || racine.parentNode !== hote) construire(hote);
        else rafraichir();
      } catch (e) { console.warn(TAG, e); }
    };
    fn._rj77 = true;
    window.renderStrategyScreen = fn;
    return true;
  }

  // Le module 50 est retiré du projet depuis la v99 : son correctif visait
  // un balisage qui n'existe plus, et ses écouteurs touchend en capture
  // avec preventDefault gênaient les boutons natifs de cet écran.
  //
  // À noter, car l'erreur a coûté cher : les versions précédentes de ce
  // module appelaient _rj50Uninstall et _rjStrategyTapUninstall, alors que
  // le module 50 exportait _rjStrategyTapFixUninstall. Aucun des deux noms
  // ne correspondait : la neutralisation n'a jamais eu lieu, et les
  // écouteurs du 50 sont restés actifs sur iOS pendant tout ce temps.
  function neutraliser50() {
    ["_rjStrategyTapFixUninstall", "_rj50Uninstall", "_rjStrategyTapUninstall"].forEach(function (n) {
      try { if (typeof window[n] === "function") window[n](); } catch (e) {}
    });
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
    installDepartDirect();
    etat.installe = true;
    console.log(TAG + " actif \u2014 mode lu depuis raceStrategy.preset, arr\u00eats int\u00e9gr\u00e9s, d\u00e9part direct");
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
