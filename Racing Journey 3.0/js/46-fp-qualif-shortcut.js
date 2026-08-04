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
 * SECOND VOLET — NOMENCLATURE DES SESSIONS DE QUALIF (voir plus bas)
 * L'en-tête du classement annonçait « Q1 — Élimination (0 pilote éliminé) »
 * dans toutes les catégories, y compris celles qui ne disputent qu'une
 * séance unique sans aucune élimination (karting, F4, F3, F2, WEC…).
 * On rétablit un intitulé fidèle au format réel de chaque catégorie.
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


  /* ===================================================================
   * NOMENCLATURE DES SESSIONS DE QUALIFICATION
   *
   * Le moteur connaît déjà le format de chaque catégorie
   * (_qualiFormatForCat : maxSessions, singleSession, durée), mais l'en-tête
   * du classement était écrit pour la seule Formule 1 : il annonçait une
   * élimination même là où personne n'est éliminé.
   *
   * On réécrit donc titre, badge et ligne de détail après le rendu, sans
   * toucher au fichier cœur ni à la logique de qualification elle-même.
   * =================================================================== */

  /* Intitulé de la séance unique, catégorie par catégorie. */
  var SEANCE_UNIQUE = {
    "Karting Junior":   { titre: "Qualification",            detail: "Séance unique — le meilleur tour fixe la grille" },
    "Karting Senior":   { titre: "Qualification",            detail: "Séance unique — le meilleur tour fixe la grille" },
    "Formule 4":        { titre: "Qualification",            detail: "Séance unique — le meilleur tour fixe la grille" },
    "Formula Regional": { titre: "Qualification",            detail: "Séance unique — le meilleur tour fixe la grille" },
    "Formule 3":        { titre: "Qualification",            detail: "Séance unique — le meilleur tour fixe la grille" },
    "Formule 2":        { titre: "Qualification",            detail: "Séance unique — le meilleur tour fixe la grille" },
    "Endurance WEC":    { titre: "Hyperpole",                detail: "Séance unique — une voiture par équipage" },
    "IndyCar":          { titre: "Qualification",            detail: "Tours lancés en solo — un pilote à la fois" }
  };

  /* Intitulés des formats à élimination, par catégorie et par session. */
  var MULTI = {
    "Formule 1": {
      badge: function (n) { return "Q" + n; },
      titre: function (n, elim, restants) {
        if (n >= 3) return "Q3 — Bataille pour la pole";
        return "Q" + n + " — Élimination";
      },
      detail: function (n, elim, restants) {
        if (n >= 3) return restants + " pilotes en piste pour la pole";
        return elim > 0
          ? "Les " + elim + " derniers sont éliminés"
          : restants + " pilotes en piste";
      }
    },
    "Super Formula": {
      badge: function (n) { return "Q" + n; },
      titre: function (n) { return n >= 3 ? "Q3 — Bataille pour la pole" : "Q" + n + " — Élimination"; },
      detail: function (n, elim, restants) {
        return n >= 3 ? restants + " pilotes pour la pole"
                      : (elim > 0 ? "Les " + elim + " derniers sont éliminés" : restants + " pilotes en piste");
      }
    },
    "IndyCar": {
      badge: function (n) { return n >= 3 ? "FAST 6" : (n === 2 ? "FAST 12" : "SEG. 1"); },
      titre: function (n) {
        if (n >= 3) return "Fast Six — Bataille pour la pole";
        if (n === 2) return "Fast Twelve";
        return "Segment 1 — Élimination";
      },
      detail: function (n, elim, restants) {
        if (n >= 3) return "Les six plus rapides se disputent la pole";
        if (n === 2) return "Les six meilleurs passent en Fast Six";
        return elim > 0 ? "Les " + elim + " derniers sont éliminés" : restants + " pilotes en piste";
      }
    }
  };

  function formatCat(cat) {
    try {
      if (typeof window._qualiFormatForCat === "function") return window._qualiFormatForCat(cat);
    } catch (e) {}
    return { maxSessions: 1, singleSession: true, duration: {} };
  }

  function intitule() {
    var G = window.G;
    var cat = (G && G.cat) || "Formule 1";
    var st = window.QUALI_STATE;
    if (!st) return null;

    var n = st.session || 1;
    var restants = (st.survived && st.survived.length) || 0;
    var fmt = formatCat(cat);
    var elim = 0;
    try {
      if (!fmt.singleSession && n < (fmt.maxSessions || 1) && typeof window.getQualiElimCount === "function") {
        elim = window.getQualiElimCount(n) || 0;
      }
    } catch (e) {}

    /* Séance unique : aucune élimination à annoncer. */
    if (fmt.singleSession || (fmt.maxSessions || 1) <= 1) {
      var u = SEANCE_UNIQUE[cat] || { titre: "Qualification", detail: "Séance unique — le meilleur tour fixe la grille" };
      return { titre: u.titre, detail: u.detail, badge: "QUALIF", restants: restants };
    }

    var m = MULTI[cat] || MULTI["Formule 1"];
    return {
      titre: m.titre(n, elim, restants),
      detail: m.detail(n, elim, restants),
      badge: m.badge(n),
      restants: restants
    };
  }

  function habillerEnTete() {
    var host = document.getElementById("quali-session-header");
    if (!host) return;
    var info = intitule();
    if (!info) return;

    var G = window.G;
    var st = window.QUALI_STATE;
    var n = (st && st.session) || 1;

    var circuit = "";
    try { circuit = (window.RACE_STATE && window.RACE_STATE.circuit) || (G && G.cat) || ""; } catch (e) {}
    var minutes = "";
    try {
      var d = formatCat(G && G.cat).duration || {};
      var v = d[n] || (window.QUALI_DURATION && window.QUALI_DURATION[n]);
      if (v) minutes = v + " minutes";
    } catch (e) {}

    var bouts = [info.restants + " pilotes"];
    if (circuit) bouts.push(circuit);
    if (minutes) bouts.push(minutes);

    var couleurs = { 1: "var(--blue)", 2: "var(--amber)", 3: "#F59E0B" };
    var coul = (info.badge === "QUALIF") ? "var(--blue)" : (couleurs[n] || "var(--blue)");
    var classeBadge = (info.badge === "QUALIF") ? "b-blue"
                    : (n >= 3 ? "b-gold" : (n === 2 ? "b-amber" : "b-blue"));

    /* On regénère l'en-tête entier : le retoucher nœud par nœud dépendait
       d'une structure interne qui n'a pas à être un contrat. */
    host.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0 6px">' +
        '<div>' +
          '<div style="font-size:16px;font-weight:800;color:' + coul + '">' + info.titre + '</div>' +
          '<div style="font-size:11px;color:var(--text3);margin-top:1px">' + bouts.join(" \u00b7 ") + '</div>' +
          '<div style="font-size:11px;color:var(--text3);margin-top:2px;opacity:.85">' + info.detail + '</div>' +
        '</div>' +
        '<span class="badge ' + classeBadge + '">' + info.badge + '</span>' +
      '</div>';

    /* Le compteur du bandeau annonçait « Q1 » même sans session multiple. */
    var compteur = document.getElementById("rj-quali-counter");
    if (compteur) compteur.textContent = (info.badge === "QUALIF") ? "" : info.badge;

    habillerBouton(info);
  }

  /* « Lancer Q1 » n'a pas de sens là où il n'y a pas de Q2. */
  function habillerBouton(info) {
    if (!info || info.badge !== "QUALIF") return;
    var zone = document.getElementById("quali-btn-zone");
    if (!zone) return;
    var boutons = zone.querySelectorAll("button");
    for (var i = 0; i < boutons.length; i++) {
      var b = boutons[i];
      var t = (b.textContent || "");
      if (/Lancer\s*Q\d/i.test(t)) {
        b.innerHTML = b.innerHTML.replace(/Lancer\s*Q\d/i, "Lancer la qualification");
      }
    }
  }

  /* ===================================================================
   * REMISE À ZÉRO DES SECTEURS ENTRE LES SESSIONS
   *
   * renderQualiSession vide bestTime, lastTime, laps et improved à chaque
   * nouvelle session — mais laisse intacts bestSectors (record personnel),
   * QUALI_STATE.bestSectors (record de session) et lastSectorFlags.
   *
   * Conséquence : le premier tour de Q2 était comparé aux secteurs de Q1.
   * Comme un premier tour est presque toujours plus lent que le meilleur de
   * la session précédente, les trois secteurs s'affichaient en jaune. Or par
   * convention, sur un chrono qui repart de zéro, le premier tour est
   * nécessairement une amélioration : vert au minimum, violet s'il devient
   * la référence.
   *
   * On vide donc les références au début de chaque session. renderQualiSession
   * n'est appelée qu'à l'ouverture d'une session (init, advanceQuali,
   * watchNextQuali), jamais en cours de séance : aucun record en cours ne
   * peut être effacé par erreur.
   * =================================================================== */

  var _dernierePhase = null;

  function clePhase() {
    var G = window.G, st = window.QUALI_STATE;
    var courses = 0, circuit = "";
    try { courses = (G && G.races) ? G.races.length : 0; } catch (e) {}
    try { circuit = (window.RACE_STATE && window.RACE_STATE.circuit) || ""; } catch (e) {}
    return courses + "|" + circuit + "|" + ((st && st.session) || 0);
  }

  function reinitialiserSecteurs() {
    var st = window.QUALI_STATE;
    if (!st) return;
    try {
      var pilotes = st.drivers || [];
      for (var i = 0; i < pilotes.length; i++) {
        var d = pilotes[i];
        if (!d) continue;
        d.bestSectors = [null, null, null];
        d.lastSectors = null;
        d.lastSectorFlags = null;
      }
      st.bestSectors = [null, null, null];
      st.bestSectorsHolder = [null, null, null];
    } catch (e) { console.warn("[46-qualif] remise à zéro des secteurs :", e && e.message); }
  }

  var _origRender = null, _origPick = null;

  function installBoutonTiming() {
    if (typeof window._qualiPickTiming !== "function") return false;
    if (window._qualiPickTiming._rj46) return true;
    _origPick = window._qualiPickTiming;
    window._qualiPickTiming = function () {
      var r = _origPick.apply(this, arguments);
      try { habillerBouton(intitule()); } catch (e) {}
      return r;
    };
    window._qualiPickTiming._rj46 = true;
    return true;
  }

  function installNomenclature() {
    if (typeof window.renderQualiSession !== "function") return false;
    if (window.renderQualiSession._rj46) return true;
    _origRender = window.renderQualiSession;
    window.renderQualiSession = function () {
      try {
        var cle = clePhase();
        if (cle !== _dernierePhase) { reinitialiserSecteurs(); _dernierePhase = cle; }
      } catch (e) {}
      var r = _origRender.apply(this, arguments);
      try { habillerEnTete(); } catch (e) { console.warn("[46-qualif] en-tête :", e && e.message); }
      return r;
    };
    window.renderQualiSession._rj46 = true;
    return true;
  }

  function start() {
    if (!document.body) { setTimeout(start, 100); return; }
    obs.observe(document.body, { childList: true, subtree: true });
    var essais = 0;
    (function bootQ() {
      installBoutonTiming();
      if (installNomenclature()) return;
      if (essais++ < 60) setTimeout(bootQ, 150);
    })();
    var ex = document.getElementById("fpl-debrief");
    if (ex) enhance(ex);
    console.log("[46-fp-qualif-shortcut] actif");
  }

  window._rjFpQualifShortcutUninstall = function () {
    if (_origRender) window.renderQualiSession = _origRender;
    if (_origPick) window._qualiPickTiming = _origPick;
    obs.disconnect();
    var b = document.getElementById(BTN_ID);
    if (b && b.parentNode) b.parentNode.removeChild(b);
    console.log("[46-fp-qualif-shortcut] désinstallé");
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
