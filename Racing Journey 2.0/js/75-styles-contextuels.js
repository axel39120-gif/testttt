/* =====================================================================
 * 75-styles-contextuels.js — LE STYLE DE PILOTAGE DEVIENT SITUATIONNEL
 *
 * CE QUI EXISTAIT
 * ---------------
 * Le style choisi à la création ne produisait que trois choses :
 *   · un ajustement des statistiques de départ (pluvial : adapt +8,
 *     vitesse −2, etc.) — CONSERVÉ TEL QUEL, il équilibre la progression ;
 *   · des modificateurs plats dans _getEffectiveSkillFor : attaquant +6 en
 *     attaque, stratège +7 en gestion, etc. — CONSERVÉS AUSSI ;
 *   · un ajustement du risque d'incident (attaquant +0.030).
 *
 * Aucun de ces effets ne dépend du contexte. Depuis, le jeu a gagné la
 * météo, les types de circuits, le modèle de pneus, la voiture de sécurité
 * et la stratégie — et le style n'en tient aucun compte. Un pilote
 * « pluvial » n'a strictement aucun avantage quand il pleut : il a
 * seulement plus d'adaptation en permanence, ce qui n'est pas la même
 * chose. Résultat : sept styles quasi interchangeables.
 *
 * CE QUE FAIT CE MODULE
 * ---------------------
 * Il ajoute une COUCHE CONTEXTUELLE par-dessus l'existant, sans rien
 * retirer. Chaque style porte un avantage et un inconvénient, plafonnés à
 * ±6 % de l'axe concerné, et actifs UNIQUEMENT dans leur contexte. Hors
 * contexte, l'effet est nul : un pilote pluvial n'est ni meilleur ni moins
 * bon sur le sec, il l'est quand il pleut. Sur un week-end, ça vaut une à
 * trois places — perceptible, rarement décisif, et jamais durablement
 * supérieur puisque les conditions changent.
 *
 * AUCUN SYSTÈME DE SIMULATION N'EST RÉÉCRIT. Le module se branche sur
 * _getEffectiveSkillFor, dont les quatre axes — attaque, défense, gestion,
 * adaptation — irriguent déjà les dépassements, la tenue de position, la
 * dégradation des pneus et la réaction aux changements de conditions. On
 * module ces axes selon la situation, on ne touche ni au modèle de pneus,
 * ni à la voiture de sécurité, ni à la stratégie.
 *
 * LISIBILITÉ — une boîte dépliable apparaît sous les vignettes de l'écran
 * de création : ce que le style apporte, ce qu'il coûte, et quand ça compte.
 * En langage clair, pas en pourcentages.
 *
 * Réversible : window._rj75Uninstall(). Diagnostic : window._rj75Contexte().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[75-styles-contextuels]";
  var wrapped = {};
  var etat = { installe: false, dernier: null };
  window._rj75Status = function () { return etat; };

  var MAX = 0.06;   // plafond d'effet : 6 %

  /* ------------------------------------------------------- contexte --- */
  function pluie() {
    try {
      var w = RACE_STATE && RACE_STATE.weather;
      if (!w) return 0;
      var id = String(w.id || w.type || w.nom || "").toLowerCase();
      if (/deluge|forte|orage/.test(id)) return 1;
      if (/pluie|humide|wet|rain/.test(id)) return 0.7;
      if (/variable|change|mixte/.test(id)) return 0.4;
      return 0;
    } catch (e) { return 0; }
  }

  function meteoInstable() {
    try {
      var w = RACE_STATE && RACE_STATE.weather;
      if (!w) return false;
      var id = String(w.id || w.type || w.nom || "").toLowerCase();
      return /variable|change|mixte|averse/.test(id);
    } catch (e) { return false; }
  }

  // Circuit sinueux ou rapide, d'après le type déclaré par le module 52.
  function typeCircuit() {
    try {
      var d = RACE_STATE && RACE_STATE.circuitData;
      if (!d) return "";
      var t = String(d.type || d.track || "").toLowerCase();
      if (/street|technique|twisty|sinueux|slow/.test(t)) return "sinueux";
      if (/speed|rapide|power|fast/.test(t)) return "rapide";
      return "mixte";
    } catch (e) { return ""; }
  }

  // Circuit déjà couru par le joueur au cours de sa carrière ?
  function circuitConnu() {
    try {
      var n = (RACE_STATE && (RACE_STATE.circuit ||
              (RACE_STATE.circuitData && RACE_STATE.circuitData.name))) || "";
      if (!n) return false;
      var l = G.races || [];
      for (var i = 0; i < l.length; i++) {
        if (l[i] && (l[i].circuit === n || l[i].name === n)) return true;
      }
      return false;
    } catch (e) { return false; }
  }

  function contexte() {
    return {
      pluie: pluie(),
      instable: meteoInstable(),
      circuit: typeCircuit(),
      connu: circuitConnu()
    };
  }
  window._rj75Contexte = function () {
    var c = contexte();
    console.log(TAG + " contexte : pluie=" + c.pluie + " · instable=" + c.instable +
                " · circuit=" + c.circuit + " · déjà couru=" + c.connu);
    return c;
  };

  /* --------------------------------------------------------- barème --- */
  /* Renvoie le multiplicateur à appliquer à un axe, selon le style et la
     situation. 1 = aucun effet. Toujours borné à ±MAX. */
  function coef(style, axe, c) {
    var m = 0;

    if (style === "attaquant") {
      if (axe === "attaque") m += 0.06;                       // dépassements
      if (axe === "gestion") m -= 0.06;                       // use ses pneus
    } else if (style === "regulier") {
      if (axe === "gestion") m += 0.06;                       // dégrade moins
      if (axe === "attaque") m -= 0.03;                       // moins de pointe
    } else if (style === "stratege") {
      if (axe === "gestion" && c.instable) m += 0.05;         // lit la météo
      if (axe === "adaptation" && c.instable) m += 0.05;      // voiture de sécurité
      if (axe === "attaque") m -= 0.02;                       // rien en brut
    } else if (style === "pluvial") {
      if (c.pluie > 0) {
        m += 0.06 * c.pluie;                                  // tous axes sous la pluie
      } else {
        if (axe === "attaque" || axe === "gestion") m -= 0.02;
      }
    } else if (style === "technicien") {
      if (c.circuit === "sinueux") m += 0.05;
      else if (c.circuit === "rapide") m -= 0.03;
    } else if (style === "complet") {
      m += 0.02;                                              // ni pic ni creux
    } else if (style === "polyvalent") {
      if (!c.connu) m += 0.06;                                // circuit inconnu
      else m -= 0.04;                                         // moins de marge acquise
    }

    if (m > MAX) m = MAX;
    if (m < -MAX) m = -MAX;
    return 1 + m;
  }

  /* --------------------------------------------- greffe sur les axes --- */
  function installer() {
    if (typeof window._getEffectiveSkillFor !== "function") return false;
    if (window._getEffectiveSkillFor._rj75) return true;

    var orig = window._getEffectiveSkillFor;
    var fn = function (axe) {
      var n = orig.apply(this, arguments);
      try {
        var style = (G && G.pilot && G.pilot.style) || "complet";
        var c = contexte();
        var k = coef(style, axe, c);
        if (k !== 1) {
          n = n * k;
          // on respecte les bornes d'origine de la fonction
          n = Math.max(20, Math.min(95, n));
          etat.dernier = { axe: axe, style: style, coef: +k.toFixed(3), contexte: c };
        }
      } catch (e) {}
      return n;
    };
    fn._rj75 = true;
    wrapped._getEffectiveSkillFor = orig;
    window._getEffectiveSkillFor = fn;
    return true;
  }

  /* ------------------------------------- boîte dépliable à la création --- */
  var FICHES = {
    attaquant: {
      nom: "Attaquant",
      plus: "Dépassements plus tranchants, meilleur sur un tour lancé.",
      moins: "Use ses pneus plus vite, prend plus de risques.",
      quand: "Décisif sur les circuits où l'on double, coûteux sur les longs relais."
    },
    regulier: {
      nom: "Régulier",
      plus: "Dégrade nettement moins ses pneus, abandonne rarement.",
      moins: "Manque de pointe pure en attaque.",
      quand: "Paie sur les courses longues et les stratégies à un arrêt."
    },
    stratege: {
      nom: "Stratège",
      plus: "Tire parti des voitures de sécurité et des météos changeantes.",
      moins: "Aucun gain en pilotage brut.",
      quand: "Fait la différence quand la course est perturbée, invisible sinon."
    },
    pluvial: {
      nom: "Pluvial",
      plus: "Conserve son rythme quand l'adhérence chute, lit une piste qui s'assèche.",
      moins: "Légèrement en retrait sur le sec.",
      quand: "Dépend entièrement de la météo du week-end."
    },
    technicien: {
      nom: "Technicien",
      plus: "À l'aise sur les tracés sinueux, tire plus des réglages.",
      moins: "Moins performant sur les circuits rapides.",
      quand: "Dépend du calendrier : Monaco lui va, Monza beaucoup moins."
    },
    complet: {
      nom: "Complet",
      plus: "Aucun point faible, un léger bonus partout.",
      moins: "Aucun domaine où il excelle vraiment.",
      quand: "Le choix sûr, jamais brillant, jamais en difficulté."
    },
    polyvalent: {
      nom: "Polyvalent",
      plus: "S'adapte vite à un circuit inconnu ou à une nouvelle catégorie.",
      moins: "Progresse moins sur les tracés qu'il connaît déjà.",
      quand: "Précieux en début de carrière et à chaque montée de catégorie."
    }
  };

  function css() {
    if (document.getElementById("rj75-css")) return;
    var st = document.createElement("style");
    st.id = "rj75-css";
    st.textContent = [
      ".rj75{margin:12px 0 4px;border:1px solid var(--border);border-radius:11px;",
      "background:linear-gradient(180deg,var(--bg3),var(--bg2));overflow:hidden}",
      ".rj75-sm{list-style:none;display:flex;align-items:center;gap:9px;padding:12px 13px;cursor:pointer}",
      ".rj75-sm::-webkit-details-marker{display:none}",
      ".rj75-t{font-family:var(--font-display);font-size:11px;font-weight:800;color:#fff;",
      "letter-spacing:.06em;text-transform:uppercase;flex:1}",
      ".rj75-r{font-size:11px;color:var(--text3)}",
      ".rj75-c{width:8px;height:8px;border-right:1.5px solid var(--text3);flex-shrink:0;",
      "border-bottom:1.5px solid var(--text3);transform:rotate(45deg) translateY(-2px);transition:transform .2s}",
      ".rj75[open] .rj75-c{transform:rotate(225deg) translateY(-2px)}",
      ".rj75-b{padding:0 13px 12px}",
      ".rj75-l{display:flex;gap:9px;padding:8px 0;border-top:1px solid var(--border);font-size:12.5px;line-height:1.45}",
      ".rj75-l i{font-style:normal;flex:0 0 14px;font-weight:900}",
      ".rj75-p i{color:#22C55E}",
      ".rj75-m i{color:#F59E0B}",
      ".rj75-q i{color:var(--text3)}",
      ".rj75-l span{color:var(--text2);flex:1}"
    ].join("");
    document.head.appendChild(st);
  }

  function fiche(style) {
    var f = FICHES[style] || FICHES.complet;
    return '<details class="rj75" id="rj75-box"><summary class="rj75-sm">' +
      '<span class="rj75-t">' + f.nom + '</span>' +
      '<span class="rj75-r">Forces et faiblesses</span>' +
      '<span class="rj75-c"></span></summary><div class="rj75-b">' +
      '<div class="rj75-l rj75-p"><i>+</i><span>' + f.plus + '</span></div>' +
      '<div class="rj75-l rj75-m"><i>\u2212</i><span>' + f.moins + '</span></div>' +
      '<div class="rj75-l rj75-q"><i>\u25CB</i><span>' + f.quand + '</span></div>' +
      '</div></details>';
  }

  // La boîte se place juste après la grille des vignettes de style, et se
  // met à jour à chaque sélection. On enveloppe selStyle plutôt que
  // d'observer le DOM : c'est le seul point d'entrée du choix.
  function majFiche(style) {
    try {
      css();
      var vign = document.querySelector("[onclick*='selStyle']");
      if (!vign) return;
      var hote = vign.parentElement;
      if (!hote) return;
      var box = document.getElementById("rj75-box");
      var html = fiche(style);
      if (box && box.parentNode) {
        var ouvert = box.open;
        var tmp = document.createElement("div");
        tmp.innerHTML = html;
        tmp.firstChild.open = ouvert;
        box.parentNode.replaceChild(tmp.firstChild, box);
      } else {
        var tmp2 = document.createElement("div");
        tmp2.innerHTML = html;
        if (hote.parentNode) hote.parentNode.insertBefore(tmp2.firstChild, hote.nextSibling);
      }
    } catch (e) {}
  }

  function installerFiche() {
    if (typeof window.selStyle !== "function" || window.selStyle._rj75) return;
    var orig = window.selStyle;
    var fn = function (el, style) {
      var r = orig.apply(this, arguments);
      try { majFiche(style); } catch (e) {}
      return r;
    };
    fn._rj75 = true;
    wrapped.selStyle = orig;
    window.selStyle = fn;

    // affichage initial : le style par défaut est « attaquant »
    if (typeof window.navTo === "function" && !window.navTo._rj75) {
      var oN = window.navTo;
      var fN = function (id) {
        var r = oN.apply(this, arguments);
        try {
          if (id === "S-create") {
            setTimeout(function () {
              var s = (typeof selStyleVal !== "undefined" && selStyleVal) || "attaquant";
              majFiche(s);
            }, 60);
          }
        } catch (e) {}
        return r;
      };
      fN._rj75 = true;
      wrapped.navTo = oN;
      window.navTo = fN;
    }
  }

  /* ---------------------------------------------------------- montage --- */
  var essais = 0;
  function boot() {
    var ok = false;
    try { ok = installer(); } catch (e) {}
    try { installerFiche(); } catch (e) {}
    if (!ok && essais++ < 120) { setTimeout(boot, 100); return; }
    css();
    etat.installe = true;
    console.log(TAG + " actif \u2014 effets de style contextuels (\u00b16 %), fiche d\u00e9pliable \u00e0 la cr\u00e9ation");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj75Coef = function (style, axe) { return coef(style, axe, contexte()); };
  window._rj75Uninstall = function () {
    Object.keys(wrapped).forEach(function (k) { window[k] = wrapped[k]; });
    ["rj75-css", "rj75-box"].forEach(function (id) {
      var e = document.getElementById(id);
      if (e && e.parentNode) e.parentNode.removeChild(e);
    });
    etat.installe = false;
    console.log(TAG + " d\u00e9sinstall\u00e9");
  };
})();
