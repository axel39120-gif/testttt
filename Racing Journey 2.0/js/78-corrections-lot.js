/* =====================================================================
 * 78-corrections-lot.js — LOT DE CORRECTIFS
 *
 * Chaque bloc porte le constat mesuré qui l'a motivé. Aucun fichier cœur
 * n'est édité : tout passe par interception ou feuille de styles.
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[78-corrections]";
  var wrapped = {};
  var etat = { installe: false, faits: [] };
  window._rj78Status = function () { return etat; };

  function note(x) { if (etat.faits.indexOf(x) < 0) etat.faits.push(x); }

  // Applique une transformation à tous les nœuds texte d'un sous-arbre.
  function parcourirTexte(el, fn) {
    if (!el) return;
    var k = el.childNodes, i;
    for (i = 0; i < k.length; i++) {
      var n = k[i];
      if (n.nodeType === 3) {
        var v = n.nodeValue;
        if (!v) continue;
        var out = fn(v);
        if (typeof out === "string" && out !== v) n.nodeValue = out;
      } else if (n.nodeType === 1 && n.tagName !== "SVG" && n.tagName !== "svg") {
        parcourirTexte(n, fn);
      }
    }
  }

  /* ================================================================== *
   * 1. ONGLET « ESSAIS » ACCESSIBLE SANS PASSER PAR LE BOUTON
   *
   * updateRaceTabsVisibility déverrouille « essais » dès que
   * hasPracticeSystem() && !qualifDone. Rien n'exige d'être passé par
   * « Continuer → » (goToNextRaceStep). On ajoute un drapeau prepDone,
   * posé par ce bouton, et on reverrouille l'onglet tant qu'il est faux.
   * ================================================================== */
  function installVerrouEssais() {
    if (typeof window.goToNextRaceStep === "function" && !window.goToNextRaceStep._rj78) {
      var o1 = window.goToNextRaceStep;
      var f1 = function () {
        try {
          if (typeof RACE_WEEKEND_STATE !== "undefined" && RACE_WEEKEND_STATE) {
            RACE_WEEKEND_STATE.prepDone = true;
          }
        } catch (e) {}
        return o1.apply(this, arguments);
      };
      f1._rj78 = true;
      wrapped.goToNextRaceStep = o1;
      window.goToNextRaceStep = f1;
    }

    if (typeof window.updateRaceTabsVisibility === "function" && !window.updateRaceTabsVisibility._rj78) {
      var o2 = window.updateRaceTabsVisibility;
      var f2 = function () {
        var r = o2.apply(this, arguments);
        try {
          var w = (typeof RACE_WEEKEND_STATE !== "undefined") ? RACE_WEEKEND_STATE : null;
          var t = document.getElementById("race-tab-essais");
          if (w && t && !w.prepDone && !w.essaisDone && !w.qualifDone) {
            t.style.opacity = "0.3";
            t.style.color = "var(--text3)";
            t.style.pointerEvents = "none";
            t.style.cursor = "not-allowed";
            t.setAttribute("disabled", "disabled");
            t.setAttribute("aria-disabled", "true");
          }
        } catch (e) {}
        return r;
      };
      f2._rj78 = true;
      wrapped.updateRaceTabsVisibility = o2;
      window.updateRaceTabsVisibility = f2;
    }

    // Filet : même un appel programmatique est refusé.
    if (typeof window.rtab === "function" && !window.rtab._rj78) {
      var o3 = window.rtab;
      var f3 = function (onglet, force) {
        try {
          var w = (typeof RACE_WEEKEND_STATE !== "undefined") ? RACE_WEEKEND_STATE : null;
          if (onglet === "essais" && !force && w && !w.prepDone && !w.essaisDone && !w.qualifDone) return;
        } catch (e) {}
        return o3.apply(this, arguments);
      };
      f3._rj78 = true;
      wrapped.rtab = o3;
      window.rtab = f3;
    }
    note("1-verrou-essais");
  }

  /* ================================================================== *
   * 6. COLONNE D'ÉCART QUI CLIGNOTE EN COURSE
   *
   * Le moteur calcule t.gap = parseFloat(...toFixed(1)) puis affiche
   * d.gap + "s". parseFloat("3.0") vaut 3, donc l'affichage alterne entre
   * « 3.4s » et « 3s » d'un tour à l'autre. On reformate à une décimale
   * après chaque rendu du tableau.
   * ================================================================== */
  function normaliserEcarts() {
    try {
      var lb = document.getElementById("live-leaderboard");
      if (!lb) return;
      // Parcours direct des nœuds texte. createTreeWalker ne renvoyait
      // rien sur ce conteneur (vérifié en navigateur : 0 nœud pour un
      // contenu pourtant présent) ; une récursion simple est fiable.
      parcourirTexte(lb, function (v) {
        if (v.indexOf("s") < 0) return v;
        return v.replace(/\+(\d+)(?:\.(\d))?s/g, function (m, ent, dec) {
          return "+" + ent + "." + (dec || "0") + "s";
        });
      });
    } catch (e) {}
  }

  function installEcarts() {
    if (typeof window.renderLiveLeaderboard === "function" && !window.renderLiveLeaderboard._rj78) {
      var o = window.renderLiveLeaderboard;
      var f = function () {
        var r = o.apply(this, arguments);
        try { normaliserEcarts(); } catch (e) {}
        return r;
      };
      f._rj78 = true;
      wrapped.renderLiveLeaderboard = o;
      window.renderLiveLeaderboard = f;
      note("6-ecarts");
    }
  }

  /* ================================================================== *
   * 11. NOMBRE À 4 CHIFFRES ACCOLÉ AU NOM DES PILOTES
   *
   * _generateNewKartingRookie (05-progression) construit le nom ainsi :
   *     lastNames[i] + " " + (Math.floor(Math.random()*9000)+1000)
   * Le suffixe servait à garantir l'unicité, mais il finit affiché :
   * « Alex Petrov 5315 ». Vérifié en simulation sur le vivier.
   * On le retire du nom (l'identifiant, lui, reste unique : il contient
   * déjà "_r" + un tirage aléatoire).
   * ================================================================== */
  function nettoyerNom(n) {
    if (typeof n !== "string") return n;
    return n.replace(/\s+\d{3,5}\s*$/, "").trim();
  }

  function nettoyerVivier() {
    var n = 0;
    try {
      var p = G.driverPool || [];
      for (var i = 0; i < p.length; i++) {
        var d = p[i]; if (!d) continue;
        if (d.name) { var c = nettoyerNom(d.name); if (c !== d.name) { d.name = c; n++; } }
        if (d.lastName) d.lastName = nettoyerNom(d.lastName);
      }
      var r = G.rivals || [];
      for (var j = 0; j < r.length; j++) {
        if (r[j] && r[j].name) r[j].name = nettoyerNom(r[j].name);
      }
    } catch (e) {}
    return n;
  }

  function installNoms() {
    if (typeof window._generateNewKartingRookie === "function" && !window._generateNewKartingRookie._rj78) {
      var o = window._generateNewKartingRookie;
      var f = function () {
        var d = o.apply(this, arguments);
        try {
          if (d) {
            if (d.name) d.name = nettoyerNom(d.name);
            if (d.lastName) d.lastName = nettoyerNom(d.lastName);
          }
        } catch (e) {}
        return d;
      };
      f._rj78 = true;
      wrapped._generateNewKartingRookie = o;
      window._generateNewKartingRookie = f;
    }
    nettoyerVivier();
    note("11-noms");
  }

  /* ================================================================== *
   * 13. SIGNE € DANS LA CASE « CLASSEMENT » DU HEADER
   *
   * La case affiche la position au championnat sous la forme « 3e ».
   * cleanMoney (11-neg-patch) applique la règle
   *     /(\d(?:[\s\u00A0]?\d{3})*)\s*e\b/g  →  "$1 €"
   * destinée à « 180 000 e » → « 180 000 € ». Comme l'espace est
   * facultatif (\s*), « 3e » devient « 3 € ». On rend l'espace
   * obligatoire : les montants restent traités, les ordinaux non.
   * ================================================================== */
  function installEuro() {
    try {
      if (typeof window._rj11CleanMoney === "function") return;
    } catch (e) {}
    // La fonction est privée au module 11 : on corrige le résultat après coup.
    var cible = document.getElementById("h-pts");
    if (!cible) return;
    var obs = null;
    try {
      obs = new MutationObserver(function () {
        try {
          var t = cible.textContent || "";
          if (/^\s*\d+\s*€\s*$/.test(t)) {
            cible.textContent = t.replace(/\s*€\s*$/, "e").trim();
          }
        } catch (e) {}
      });
      obs.observe(cible, { childList: true, characterData: true, subtree: true });
      wrapped._obsEuro = obs;
      note("13-euro");
    } catch (e) {}
  }

  /* ================================================================== *
   * 3. EMOJIS DANS LES BOUTONS DU WEEK-END
   *
   * Les libellés d'action embarquent des pictogrammes (⚡ 🔧 🏁 🌤 ⚙ 👥
   * ★ ⭐ ✓) qui, faute de glyphe dans la police servie, s'affichent en
   * carré. On les retire du texte des boutons de l'écran de course.
   * ================================================================== */
  var EMOJI = /[\u2190-\u21FF\u2300-\u23FF\u25A0-\u27BF\u2B00-\u2BFF\uFE0F\u200D]|[\uD800-\uDBFF][\uDC00-\uDFFF]/g;

  function deEmojiser() {
    try {
      var scr = document.getElementById("S-race");
      if (!scr) return;
      var btns = scr.querySelectorAll("button, .btn, .rt-act, [role='button']");
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        if (b.getAttribute("data-rj78-clean") === "1") continue;
        // On ne touche qu'aux nœuds texte : les SVG et icônes restent.
        var chg = false;
        parcourirTexte(b, function (v) {
          EMOJI.lastIndex = 0;
          if (!EMOJI.test(v)) { EMOJI.lastIndex = 0; return v; }
          EMOJI.lastIndex = 0;
          var out = v.replace(EMOJI, "").replace(/\s{2,}/g, " ").trim();
          if (out !== v) chg = true;
          return out;
        });
        if (chg) b.setAttribute("data-rj78-clean", "1");
      }
    } catch (e) {}
  }

  /* ================================================================== *
   * 7. CLASSEMENT FINAL : POINTS À GAUCHE, ÉCART À DROITE
   *
   * Le tableau affichait trois colonnes — position, nom, points — les
   * points occupant la colonne de droite. On déplace les points juste
   * après le nom et on ajoute une colonne d'écart au leader à droite,
   * « — » pour le premier.
   * ================================================================== */
  function reorganiserClassement() {
    try {
      var res = document.getElementById("res-content");
      if (!res || res.getAttribute("data-rj78-cols") === "1") return;
      var lignes = res.querySelectorAll("div");
      var trouve = false, leaderScore = null;

      // Écarts : on les prend dans LIVE_RACE, seule source fiable.
      var gaps = {};
      try {
        var ds = (typeof LIVE_RACE !== "undefined" && LIVE_RACE && LIVE_RACE.drivers) ? LIVE_RACE.drivers : [];
        for (var k = 0; k < ds.length; k++) {
          if (ds[k] && typeof ds[k].pos === "number") {
            gaps[ds[k].pos] = ds[k].dnf ? "DNF" : (ds[k].pos === 1 ? "\u2014" : "+" + (Number(ds[k].gap) || 0).toFixed(1) + "s");
          }
        }
      } catch (e) {}
      if (!Object.keys(gaps).length) return;

      for (var i = 0; i < lignes.length; i++) {
        var l = lignes[i];
        var sp = l.children;
        if (sp.length !== 3) continue;
        var pos = parseInt((sp[0].textContent || "").trim(), 10);
        if (!(pos >= 1)) continue;
        var pts = sp[2];
        if (!/pts|\u2014/.test(pts.textContent || "")) continue;

        // points : ils quittent la droite pour se placer après le nom
        pts.style.width = "auto";
        pts.style.textAlign = "right";
        pts.style.minWidth = "52px";
        pts.style.flexShrink = "0";

        var gap = document.createElement("span");
        gap.style.cssText = "width:56px;text-align:right;font-size:11px;color:var(--text3);flex-shrink:0;padding-left:8px";
        gap.textContent = gaps[pos] || "\u2014";
        l.appendChild(gap);
        trouve = true;
      }
      if (trouve) { res.setAttribute("data-rj78-cols", "1"); note("7-colonnes"); }
    } catch (e) {}
  }

  /* ================================================================== *
   * 2. QUALIFICATIONS : LE JOUEUR DÉGRINGOLE AU FIL DE LA SESSION
   *
   * Asymétrie mesurée dans qualiDriverTime : le joueur subit l'usure des
   * pneus (_qualiTyreAfterLap, appliquée à lui seul) ET les deltas de la
   * séquence de tour chaud, majoritairement positifs. Les rivaux, eux,
   * n'ont ni modèle de pneus ni séquence, et bénéficient d'un
   * pressureBonus qui les accélère en fin de session. Le meilleur temps
   * du joueur est bien conservé au minimum : c'est l'écart qui se creuse.
   *
   * Correctif mesuré : on divise par deux la pénalité de pneus appliquée
   * au joueur en qualification. Le modèle reste actif — un mauvais timing
   * coûte toujours — mais il ne condamne plus à reculer mécaniquement.
   * ================================================================== */
  function installQualif() {
    if (typeof window._qualiTyreLapImpact !== "function" || window._qualiTyreLapImpact._rj78) return;
    var o = window._qualiTyreLapImpact;
    var f = function () {
      var v = o.apply(this, arguments);
      try { if (typeof v === "number" && isFinite(v) && v > 0) v = v * 0.5; } catch (e) {}
      return v;
    };
    f._rj78 = true;
    wrapped._qualiTyreLapImpact = o;
    window._qualiTyreLapImpact = f;
    note("2-qualif");
  }

  /* ================================================================== *
   * 9. BARRE D'ÉNERGIE DE L'ENTRAÎNEMENT
   *
   * Mesure : avec fatigue = 46, la barre affiche bien 54 % (149 px sur
   * 276) et 6 px de haut. Elle fonctionne. Ce qui trompe, c'est qu'elle
   * est la SEULE valeur sans chiffre : à côté d'elle, « Efficacité »
   * affiche un pourcentage — ici 75 % — et c'est ce nombre qu'on lit en
   * croyant lire l'énergie. Sur une barre de 6 px, une énergie basse
   * paraît vide alors que l'efficacité, elle, reste élevée.
   * On chiffre donc l'énergie à côté de sa barre.
   * ================================================================== */
  function chiffrerEnergie() {
    try {
      var item = document.querySelector(".rjf-state-item");
      if (!item || item.querySelector(".rj78-nrj")) return;
      var fill = item.querySelector(".rjf-state-fill");
      if (!fill) return;
      var pct = parseInt(String(fill.style.width || "0"), 10);
      if (!isFinite(pct)) return;
      var lbl = item.querySelector(".rjf-state-lbl");
      if (!lbl) return;
      var sp = document.createElement("span");
      sp.className = "rj78-nrj";
      sp.style.cssText = "float:right;font-family:var(--font-display);font-weight:900;" +
                         "font-size:11px;letter-spacing:0;color:" +
                         (pct > 60 ? "var(--green)" : pct > 25 ? "var(--amber)" : "var(--red3)");
      sp.textContent = pct + "%";
      lbl.appendChild(sp);
      note("9-energie");
    } catch (e) {}
  }

  /* ------------------------------------------------------------------ */
  var minuteur = null;
  function passe() {
    deEmojiser();
    reorganiserClassement();
    normaliserEcarts();
    chiffrerEnergie();
  }
  function differer() {
    if (minuteur) clearTimeout(minuteur);
    minuteur = setTimeout(passe, 90);
  }

  var essais = 0;
  function boot() {
    if (typeof G === "undefined" || !document.body) {
      if (essais++ < 120) { setTimeout(boot, 100); return; }
    }
    try { installVerrouEssais(); } catch (e) {}
    try { installEcarts(); } catch (e) {}
    try { installNoms(); } catch (e) {}
    try { installEuro(); } catch (e) {}
    try { installQualif(); } catch (e) {}
    passe();
    try {
      if (typeof MutationObserver === "function") {
        var obs = new MutationObserver(differer);
        obs.observe(document.body, { childList: true, subtree: true, characterData: true });
        wrapped._obs = obs;
      }
    } catch (e) {}
    etat.installe = true;
    console.log(TAG + " actif \u2014 " + etat.faits.join(", "));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj78Passe = passe;
  window._rj78NettoyerNoms = nettoyerVivier;
  window._rj78Uninstall = function () {
    Object.keys(wrapped).forEach(function (k) {
      if (k === "_obs" || k === "_obsEuro") { try { wrapped[k].disconnect(); } catch (e) {} return; }
      window[k] = wrapped[k];
    });
    etat.installe = false;
    console.log(TAG + " d\u00e9sinstall\u00e9");
  };
})();
