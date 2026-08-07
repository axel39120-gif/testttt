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

  /* --- Fiches des TRAITS DE CARACTERE ---------------------------------
     Valeurs relevees dans le code : bonus de stats de depart, et
     getMentalSensitivity() qui pilote la reaction du pilote aux bons et
     mauvais resultats (posMult, negMult), sa resistance a la pression
     (pressureResist : plus bas = meilleur) et sa vitesse de recuperation. */
  var TRAITS = {
    leader: {
      nom: "Leader n\u00e9",
      plus: "Tient bien la pression, f\u00e9d\u00e8re l'\u00e9quipe autour de lui.",
      moins: "Peu de gain technique pur.",
      quand: "Utile sur la dur\u00e9e d'une saison, discret sur un week-end isol\u00e9."
    },
    competiteur: {
      nom: "Comp\u00e9titeur",
      plus: "Gros bonus en attaque et en vitesse, rebondit vite apr\u00e8s un revers.",
      moins: "Encaisse mal les mauvaises s\u00e9ries, sensible \u00e0 la pression.",
      quand: "Redoutable en confiance, fragile quand la saison tourne mal."
    },
    analyste: {
      nom: "Analyste",
      plus: "Forte strat\u00e9gie et adaptation, encaisse bien les revers.",
      moins: "Aucun gain en pilotage brut.",
      quand: "Paie sur les courses \u00e0 d\u00e9cisions, moins en bagarre directe."
    },
    medias: {
      nom: "Bon client m\u00e9dias",
      plus: "Profite davantage des bons r\u00e9sultats aupr\u00e8s du public et des m\u00e9dias.",
      moins: "Aucun bonus de pilotage, et les mauvaises passes se paient plus cher.",
      quand: "Un choix de carri\u00e8re et d'image, pas de performance."
    },
    sangfroid: {
      nom: "Sang-froid",
      plus: "Tr\u00e8s r\u00e9sistant \u00e0 la pression, encaisse presque tout, r\u00e9cup\u00e8re vite.",
      moins: "Profite moins de l'\u00e9lan d'une bonne s\u00e9rie.",
      quand: "Le trait des fins de championnat serr\u00e9es."
    },
    intuitif: {
      nom: "Intuitif",
      plus: "Excellente adaptation, un peu d'attaque en plus.",
      moins: "Un peu plus sensible \u00e0 la pression.",
      quand: "Efficace face \u00e0 l'impr\u00e9vu et sur circuit d\u00e9couvert."
    },
    perfectionniste: {
      nom: "Perfectionniste",
      plus: "R\u00e9gularit\u00e9, strat\u00e9gie et gestion des pneus renforc\u00e9es.",
      moins: "Encaisse tr\u00e8s mal l'\u00e9chec, tr\u00e8s sensible \u00e0 la pression.",
      quand: "Solide quand tout va bien, en difficult\u00e9 apr\u00e8s une contre-performance."
    },
    instinctif: {
      nom: "Instinctif",
      plus: "Attaque et vitesse en hausse, rebondit vite.",
      moins: "Strat\u00e9gie en retrait.",
      quand: "Brille en course, moins dans les choix de stand."
    }
  };

  function css() {
    if (document.getElementById("rj75-css")) return;
    var st = document.createElement("style");
    st.id = "rj75-css";
    st.textContent = [
      /* le panneau occupe toute la largeur de la grille a deux colonnes */
      ".rj75{grid-column:1/-1;border:1px solid var(--border-hi);border-radius:11px;",
      "background:linear-gradient(180deg,var(--bg3),var(--bg2));overflow:hidden;",
      "margin:-2px 0 2px;animation:rj75in .18s ease}",
      "@keyframes rj75in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}",
      ".rj75-b{padding:11px 13px}",
      ".rj75-l{display:flex;gap:9px;padding:7px 0;font-size:12.5px;line-height:1.45}",
      ".rj75-l+.rj75-l{border-top:1px solid var(--border)}",
      ".rj75-l i{font-style:normal;flex:0 0 13px;font-weight:900}",
      ".rj75-p i{color:#22C55E}",
      ".rj75-m i{color:#F59E0B}",
      ".rj75-q i{color:var(--text3)}",
      ".rj75-l span{color:var(--text2);flex:1}",

      /* Les sous-titres d'origine (« +Vitesse +Attaque \u2212R\u00e9gularit\u00e9 ») font
         doublon avec la fiche d\u00e9pliable, qui dit la m\u00eame chose en plus
         complet et en langage clair. On les masque sur les deux \u00e9crans de
         choix ; ils sont conserv\u00e9s dans le HTML, donc rien n'est perdu. */
      "#style-grid .trait-s,#trait-list .trait-s{display:none !important}",
      "#style-grid .trait-opt,#trait-list .trait-opt{display:flex;align-items:center;",
      "justify-content:center;text-align:center;min-height:46px}"
    ].join("");
    document.head.appendChild(st);
  }

  function corps(f) {
    return '<div class="rj75" id="rj75-box"><div class="rj75-b">' +
      '<div class="rj75-l rj75-p"><i>+</i><span>' + f.plus + '</span></div>' +
      '<div class="rj75-l rj75-m"><i>\u2212</i><span>' + f.moins + '</span></div>' +
      '<div class="rj75-l rj75-q"><i>\u25CB</i><span>' + f.quand + '</span></div>' +
      '</div></div>';
  }

  /* Le panneau se place en fin de la RANGEE qui contient la vignette
     choisie : dans une grille a deux colonnes, inserer directement apres
     la vignette de gauche pousserait sa voisine sur la ligne suivante. */
  function poser(grille, cle, fiches) {
    if (!grille) return;
    css();
    var anc = document.getElementById("rj75-box");
    if (anc && anc.parentNode) anc.parentNode.removeChild(anc);

    var f = fiches[cle];
    if (!f) return;

    var opts = [];
    for (var i = 0; i < grille.children.length; i++) {
      if (grille.children[i].classList &&
          grille.children[i].classList.contains("trait-opt")) opts.push(grille.children[i]);
    }
    if (!opts.length) return;

    var idx = -1;
    for (var k = 0; k < opts.length; k++) {
      if (opts[k].classList.contains("on")) { idx = k; break; }
    }
    if (idx < 0) idx = 0;

    var finRangee = Math.min(idx - (idx % 2) + 1, opts.length - 1);
    var tmp = document.createElement("div");
    tmp.innerHTML = corps(f);
    var box = tmp.firstChild;
    var ref = opts[finRangee];
    if (ref.nextSibling) grille.insertBefore(box, ref.nextSibling);
    else grille.appendChild(box);
  }

  function majStyle(cle) { poser(document.getElementById("style-grid"), cle, FICHES); }
  function majTrait(cle) { poser(document.getElementById("trait-list"), cle, TRAITS); }

  function envelopper(nom, maj) {
    if (typeof window[nom] !== "function" || window[nom]._rj75) return;
    var orig = window[nom];
    var fn = function (el, cle) {
      var r = orig.apply(this, arguments);
      try { setTimeout(function () { maj(cle); }, 0); } catch (e) {}
      return r;
    };
    fn._rj75 = true;
    wrapped[nom] = orig;
    window[nom] = fn;
  }

  function installerFiche() {
    envelopper("selStyle", majStyle);
    envelopper("selTrait", majTrait);

    // Affichage initial : les deux ecrans ont deja une vignette « on ».
    if (typeof window.creNext === "function" && !window.creNext._rj75) {
      var orig = window.creNext;
      var fn = function () {
        var r = orig.apply(this, arguments);
        try {
          setTimeout(function () {
            var e = (typeof creStep !== "undefined") ? creStep : 0;
            if (e === 3) majStyle((typeof selStyleVal !== "undefined" && selStyleVal) || "attaquant");
            if (e === 4) majTrait((typeof selTraitVal !== "undefined" && selTraitVal) || "leader");
          }, 40);
        } catch (e) {}
        return r;
      };
      fn._rj75 = true;
      wrapped.creNext = orig;
      window.creNext = fn;
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
