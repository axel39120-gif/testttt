/* =====================================================================
 * 28-corrections-interface.js — CORRECTIONS D'INTERFACE
 *
 * Regroupe deux lots de corrections portant sur la présentation et les
 * libellés : cohérence des textes, nettoyage des noms, ajustements
 * d'écrans. Aucun ne touche à la simulation.
 * =================================================================== */

/* ==================================================================== *
 * Lot de finitions
 * (anciennement 28-polish-consolidated.js)
 * ==================================================================== */

(function () {
  'use strict';
  var TAG = '[19-practice-setup-popup]';
  var POPUP_ID = 'fpl-debrief';
  var PANEL_ID = 'fpl-debrief-setup';

  function fn(name) { return typeof window[name] === 'function'; }

  // Injecte le panneau de réglages dans le pop-up de débrief s'il n'y est pas.
  function injectInto(popup) {
    try {
      if (!popup || popup.querySelector('#' + PANEL_ID)) return; // déjà fait
      if (!fn('buildSetupPanel')) return;

      // Le card est le conteneur scrollable (1er élément du pop-up).
      var card = popup.querySelector('div');
      if (!card) return;

      var panel = window.buildSetupPanel();
      if (!panel) return;                 // catégorie sans réglages (rien à ajuster)
      panel.id = PANEL_ID;                // évite le conflit d'id avec le panneau de séance
      panel.style.margin = '0 16px 12px';

      // Bloc d'introduction : explique que l'on règle d'après le retour ingénieur.
      var intro = document.createElement('div');
      intro.style.cssText = 'margin:4px 16px 8px;display:flex;align-items:center;gap:8px';
      intro.innerHTML =
        '<span style="width:3px;height:13px;background:#22D3EE;border-radius:2px"></span>' +
        '<span style="font-family:var(--font-display);font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--text2)">Ajuste tes réglages</span>';

      // On insère avant la zone de boutons si on la repère, sinon en fin de card.
      var firstBtn = card.querySelector('button');
      var anchor = null;
      if (firstBtn) {
        // remonter jusqu'à l'enfant direct du card qui contient le bouton
        var node = firstBtn;
        while (node && node.parentElement !== card) node = node.parentElement;
        anchor = node;
      }
      if (anchor) {
        card.insertBefore(intro, anchor);
        card.insertBefore(panel, anchor);
      } else {
        card.appendChild(intro);
        card.appendChild(panel);
      }

      if (fn('refreshSetupValues')) { try { window.refreshSetupValues(); } catch (e) { /* no-op */ } }
    } catch (e) {
      console.warn(TAG, 'injection:', e);
    }
  }

  function scanExisting() {
    var p = document.getElementById(POPUP_ID);
    if (p) injectInto(p);
  }

  function start() {
    // Pop-up déjà présent ?
    scanExisting();
    // Observe les apparitions futures du pop-up.
    try {
      var obs = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
          var added = mutations[i].addedNodes;
          for (var j = 0; j < added.length; j++) {
            var n = added[j];
            if (n.nodeType !== 1) continue;
            if (n.id === POPUP_ID) { injectInto(n); }
            else if (n.querySelector) {
              var inner = n.querySelector('#' + POPUP_ID);
              if (inner) injectInto(inner);
            }
          }
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      window._td19Observer = obs;
    } catch (e) {
      console.warn(TAG, 'observer:', e);
    }
  }

  function boot(retries) {
    if (typeof window === 'undefined') return;
    if (document.body) {
      start();
      window.rjDebugPracticeSetupPopup = function () {
        console.log(TAG, 'buildSetupPanel:', fn('buildSetupPanel'), '| pop-up présent:', !!document.getElementById(POPUP_ID));
      };
      console.log(TAG, 'activé — réglages ajustables dans le débrief des essais. Debug: rjDebugPracticeSetupPopup()');
      return;
    }
    if (retries > 0) { setTimeout(function () { boot(retries - 1); }, 300); return; }
  }

  boot(40);
})();



// ===================================================================

// ===== Bloc intégré : 21-ux-fixes.js =====

// ===================================================================

/* =============================================================================
 * 21-ux-fixes.js — CORRECTIONS UX
 * =============================================================================
 *
 * #1 — Notifications de message intempestives
 * -------------------------------------------
 * `pushMail()` déclenche `pushHomeToast("Nouveau message", …)` à chaque mail.
 * Des mails étant générés dès la création du pilote / le choix d'agent, le
 * toast s'affiche sur des écrans où il n'a aucun sens. On masque la
 * NOTIFICATION (le mail reste créé et consultable dans la boîte) tant que le
 * joueur est sur un écran d'onboarding (S-create, S-agent).
 *
 * Option A (wrap), réversible, idempotent, try/catch.
 * ORDRE : après 03 (pushHomeToast).
 * ===========================================================================*/
(function () {
  'use strict';
  var TAG = '[21-ux-fixes]';

  // Écrans sur lesquels aucune notification ne doit apparaître.
  var SILENT_SCREENS = ['S-create', 'S-agent'];

  function activeScreenId() {
    try {
      var s = document.querySelector('.scr.on');
      return s ? s.id : '';
    } catch (e) { return ''; }
  }

  function boot(retries) {
    if (typeof window === 'undefined') return;
    if (typeof window.pushHomeToast === 'function' && !window.pushHomeToast._ux21) {
      var orig = window.pushHomeToast;
      /* Pas de notification pendant l'accueil de partie. */
      if (!Array.isArray(window.RJ_TOAST_FILTERS)) window.RJ_TOAST_FILTERS = [];
      if (!window.RJ_TOAST_FILTERS.some(function (f) { return f && f.id === "28-polish"; })) {
        window.RJ_TOAST_FILTERS.push({
          id: "28-polish",
          filtre: function () {
            if (SILENT_SCREENS.indexOf(activeScreenId()) >= 0) return false;
          }
        });
      }
      window.pushHomeToast._ux21 = true;
      console.log(TAG, 'activé — notifications masquées pendant création/agent');
      return;
    }
    if (retries > 0) { setTimeout(function () { boot(retries - 1); }, 400); return; }
    console.warn(TAG, 'abandon — pushHomeToast introuvable.');
  }

  boot(50);
})();



// ===================================================================

// ===== Bloc intégré : 23-dedup-strategie.js =====

// ===================================================================

/* =============================================================================
 * 23-dedup-strategie.js — SUPPRESSION DU DOUBLON D'ÉCRAN DE STRATÉGIE
 * =============================================================================
 * Entre la qualif et la course, deux écrans de réglages s'enchaînaient :
 *   1) l'écran de stratégie NATIF (04, renderStrategyScreen) — basique,
 *      en partie déconnecté du moteur ;
 *   2) le modal de stratégie de 04p (openStrategyModal) — complet (composé,
 *      nombre d'arrêts, style) et réellement branché au moteur (build car
 *      state, usure des pneus tour par tour). C'est aussi celui qui alimente
 *      la pastille pneu du classement et que prolonge le planner graphique.
 *
 * Ce module redirige l'écran natif vers le modal complet : où qu'on arrive
 * (après la qualif ou en cliquant l'onglet Stratégie), on ne voit plus qu'UN
 * seul écran, le bon. Aucune modification des fichiers cœur.
 *
 * Réversible : retirer la ligne <script src="js/23-dedup-strategie.js"> de
 * index.html restaure le comportement d'origine.
 * ===========================================================================*/
(function () {
  'use strict';

  var TRIES = 0, MAX = 80;

  function install() {
    TRIES++;
    var rss = window.renderStrategyScreen;
    var ui = window._RJ_STRAT_UI;

    var ready = (typeof rss === 'function') &&
                ui && typeof ui.openStrategyModal === 'function';

    if (ready) {
      if (!rss._rjDedup) {
        var orig = rss;
        window.renderStrategyScreen = function rjStrategyDedup() {
          try {
            // L'écran/onglet de stratégie natif déclenche le modal complet 04p.
            window._RJ_STRAT_UI.openStrategyModal();
            return;
          } catch (e) {
            // En cas de souci, on retombe sur l'écran natif d'origine.
            console.warn('[23] redirection stratégie échouée, fallback natif :', e);
            return orig.apply(this, arguments);
          }
        };
        window.renderStrategyScreen._rjDedup = true;
        window.renderStrategyScreen._rjOrig = orig;
        console.log('[23] Écran stratégie natif redirigé vers le modal 04p — doublon supprimé.');
      }
      return true;
    }

    if (TRIES < MAX) { setTimeout(install, 250); }
    else { console.warn('[23] renderStrategyScreen ou _RJ_STRAT_UI introuvable — déduplication non installée.'); }
    return false;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
})();



// ===================================================================

// ===== Bloc intégré : 26-race-header-style.js =====

// ===================================================================

/* =============================================================================
 * 26-race-header-style.js — RESTYLE DU HEADER DE WEEK-END (S-race)
 * =============================================================================
 *
 * DEMANDE
 * -------
 *   1. Le sous-titre sous « Manche X » (pays • circuit) doit s'afficher en
 *      minuscules, et non en majuscules.
 *   2. Le drapeau doit : rester centré verticalement, être un peu plus petit,
 *      ne plus être dans un cadre (bordure/fond/ombre) mais « à l'air libre »,
 *      et passer à droite de l'écran.
 *
 * CAUSE RACINE
 * ------------
 * Le module 09 injecte #rj-race-header-css :
 *   - #race-sub  → text-transform:uppercase !important
 *   - #rj-race-flag-wrap → cadre 46×32 (bordure + fond --surface2 + ombre +
 *     arrondi), inséré à GAUCHE du titre.
 *
 * CORRECTION
 * ----------
 * Le .hdr de S-race est en display:flex → tout se règle en CSS, sans toucher
 * au DOM :
 *   - #race-sub  → text-transform:lowercase + tracking réduit.
 *   - #rj-race-flag-wrap → cadre supprimé, taille réduite, order:9 pour le
 *     pousser à l'extrémité droite (le bloc titre est flex:1), centré vertical.
 * Chargé APRÈS 09, donc ce <style> est plus tardif dans le <head> et l'emporte
 * (même spécificité + !important + ordre source). Réversible : supprimer ce
 * module (ou le <style id="rj-race-header-restyle">) rend le rendu d'origine.
 *
 * ARCHITECTURE : Option A — surcouche CSS non destructive, idempotente.
 * ===========================================================================*/
(function () {
  'use strict';
  var TAG = '[26-race-header-style]';
  var STYLE_ID = 'rj-race-header-restyle';

  function inject() {
    if (document.getElementById(STYLE_ID)) return true;
    if (!document.head) return false;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = [
      // 1) Sous-titre pays • circuit → minuscules, tracking adouci
      '#S-race > .hdr #race-sub{text-transform:lowercase!important;letter-spacing:.02em!important}',

      // 2) Drapeau : sorti du cadre, plus petit, centré vertical, poussé à droite
      '#S-race > .hdr #rj-race-flag-wrap{' +
        'order:9!important;' +              /* dans le flex : tout à droite */
        'align-self:center!important;' +    /* reste centré verticalement */
        'width:auto!important;height:auto!important;' + /* s'ajuste au disque réduit */
        'margin:0 2px 0 12px!important;' +  /* gap à gauche, plus de marge droite */
        'border:0!important;background:transparent!important;' +
        'box-shadow:none!important;border-radius:0!important;overflow:visible!important' +
      '}',
      '#S-race > .hdr #rj-race-flag-wrap>span{width:26px!important;height:26px!important;align-items:stretch!important}' +
      '#S-race > .hdr #rj-race-flag-wrap svg{width:100%!important;height:100%!important;display:block!important;border-radius:0!important}'
    ].join('');
    document.head.appendChild(st);
    return true;
  }

  function boot(retries) {
    if (typeof document === 'undefined') return;
    if (inject()) { console.log(TAG, 'activé — sous-titre en minuscules, drapeau à droite sans cadre.'); return; }
    if (retries > 0) { setTimeout(function () { boot(retries - 1); }, 200); return; }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { boot(30); });
  else boot(30);
})();


/* ==================================================================== *
 * Lot de corrections de libellés et d'affichage
 * (anciennement 78-corrections-lot.js)
 * ==================================================================== */

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
   * facultatif (\s*), « 3e » devient « 3 € ».
   *
   * CORRECTIF DÉFINITIF — ce bloc installait un second MutationObserver sur
   * #h-pts qui réécrivait « 3 € » en « 3e ». Cette réécriture était elle-même
   * une mutation, qui réveillait l'observateur du module 11, qui réappliquait
   * « 3 € », qui réveillait celui-ci… : ping-pong infini en microtâches, avec
   * le thread principal bloqué à 100 % dès l'entrée en jeu — impossible de
   * charger une sauvegarde ni de créer une carrière depuis l'écran d'accueil
   * (reproduit en navigateur : loadSave ne rendait jamais la main).
   *
   * La cause est traitée à la source dans 11-neg-patch.js : l'espace est
   * désormais obligatoire dans la regex, les ordinaux ne sont plus touchés.
   * L'observateur correctif n'a plus lieu d'être et n'est plus installé.
   * ================================================================== */
  function installEuro() {
    /* volontairement vide — voir la note ci-dessus */
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

      /* Places gagnées ou perdues depuis la grille de départ. C'est ce qui
         raconte la course : un écart au leader en secondes ne dit rien du
         travail accompli par un pilote parti dixième et arrivé quatrième. */
      var gaps = {}, couleurs = {};
      try {
        var ds = (typeof LIVE_RACE !== "undefined" && LIVE_RACE && LIVE_RACE.drivers) ? LIVE_RACE.drivers : [];
        for (var k = 0; k < ds.length; k++) {
          var d = ds[k];
          if (!d || typeof d.pos !== "number") continue;
          if (d.dnf) { gaps[d.pos] = "ABANDON"; couleurs[d.pos] = "var(--muted)"; continue; }
          var depart = d.gridPos || d.startPos || null;
          if (!depart) { gaps[d.pos] = "\u2014"; couleurs[d.pos] = "var(--text3)"; continue; }
          var delta = depart - d.pos;
          if (delta > 0) { gaps[d.pos] = "\u25B2 " + delta; couleurs[d.pos] = "var(--green)"; }
          else if (delta < 0) { gaps[d.pos] = "\u25BC " + (-delta); couleurs[d.pos] = "var(--red)"; }
          else { gaps[d.pos] = "\u2014"; couleurs[d.pos] = "var(--text3)"; }
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

        /* La pastille de gomme n'a plus d'objet : les pneus ont été retirés
           de la simulation. On la retire de la ligne. */
        try {
          var enfants = sp[1] ? sp[1].querySelectorAll("span") : [];
          for (var g = 0; g < enfants.length; g++) {
            var t = (enfants[g].textContent || "").trim();
            if (/^[SMHIW]$/.test(t)) { enfants[g].style.display = "none"; }
          }
        } catch (e) {}

        var gap = document.createElement("span");
        gap.style.cssText = "width:62px;text-align:right;font-size:11.5px;font-weight:700;" +
          "flex-shrink:0;padding-left:8px;color:" + (couleurs[pos] || "var(--text3)");
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
