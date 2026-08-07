/* =====================================================================
 * 86-infrastructure.js — REGISTRES ET DÉGRAISSAGE
 *
 * Regroupe quatre modules d'infrastructure écrits séparément au fil du
 * chantier de restructuration. Ils n'ont aucune dépendance entre eux et
 * remplissent le même office : offrir aux modules du jeu un endroit où se
 * brancher, au lieu de les laisser s'empiler en enveloppes successives sur
 * les fonctions du moteur.
 *
 * CE QU'IL CONTIENT
 *   1. Dégraissage       — neutralise les couches devenues inertes sur le
 *                          calcul des positions.
 *   2. Persistance       — RJ_SAVE_HOOKS : un seul point d'écriture dans
 *                          la sauvegarde.
 *   3. Navigation        — RJ_SCREEN_HOOKS : réactions par écran, et
 *                          RJ_TOAST_FILTERS : filtres de notification.
 *   4. Saison, classement — RJ_SEASON_HOOKS et RJ_LEADERBOARD_HOOKS.
 *
 * Les registres du tour et du départ de course (RJ_LAP_HOOKS,
 * RJ_RACE_START_HOOKS) restent dans 81-moteur-course, où ils sont
 * déclenchés.
 *
 * Chaque partie conserve sa fonction de désinstallation d'origine
 * (_rj86Uninstall, _rj87Uninstall, _rj88Uninstall, _rj89Uninstall) : le
 * regroupement ne change rien au comportement, seulement au nombre de
 * fichiers.
 * =================================================================== */

/* ==================================================================== *
 * 1. DÉGRAISSAGE DES COUCHES INERTES
 * (anciennement 86-degraissage-couches.js)
 * ==================================================================== */

(function () {
  "use strict";

  var TAG = "[86-degraissage]";

  /* Marqueurs d'installation posés par chacune des couches. Les remettre à
     true empêche leur minuteur de reprise de les réinstaller. */
  var COUCHES = [
    { id: "04b", marqueur: "_rjPositionFixInstalled",     role: "nettoyage des positions" },
    { id: "04c", marqueur: "_rjTyreHookInstalled",        role: "usure des pneus" },
    { id: "04d", marqueur: "_rjLapBuilderHookInstalled",  role: "construction des tours" },
    { id: "04e", marqueur: "_rjAIDecisionHookInstalled",  role: "IA décisionnelle" },
    { id: "04f", marqueur: "_rjTrackLifeHookInstalled",   role: "vie de la piste" },
    { id: "04g", marqueur: "_rjRadioHookInstalled",       role: "radio émergente" },
    { id: "04k", marqueur: "_rjReliabilityTickInstalled", role: "fiabilité" },
    { id: "04m", marqueur: "_rjSCPositionWrapperInstalled", role: "ordre sous safety car" }
  ];

  var _avant = {};

  function neutraliser() {
    var poses = [];
    COUCHES.forEach(function (c) {
      try {
        _avant[c.marqueur] = window[c.marqueur];
        if (window[c.marqueur] !== true) poses.push(c.id);
        window[c.marqueur] = true;
      } catch (e) {}
    });
    return poses;
  }

  function verifier() {
    var f = window.updateLivePositions;
    if (typeof f !== "function") return { calculateur: null };
    return {
      calculateur: f.name || "(anonyme)",
      unique: !!f._rj81,
      hooks: Array.isArray(window.RJ_LAP_HOOKS) ? window.RJ_LAP_HOOKS.length : null
    };
  }

  function boot() {
    var essais = 0;
    (function tenter() {
      var etat = verifier();
      if (!etat.calculateur) {
        if (essais++ < 60) return setTimeout(tenter, 150);
        return console.warn(TAG, "aucun calculateur de positions trouvé");
      }
      var poses = neutraliser();
      if (etat.unique) {
        console.log(TAG, "calculateur unique en place ; " + COUCHES.length +
          " couches retirées du calcul des positions" +
          (poses.length ? " (" + poses.length + " encore armée(s) au moment du dégraissage)" : ""));
      } else {
        console.warn(TAG, "le calculateur en place n'est pas celui attendu (" +
          etat.calculateur + ") — dégraissage appliqué quand même");
      }
    })();

    window._rj86 = { couches: COUCHES, etat: verifier };
    window._rj86Uninstall = function () {
      Object.keys(_avant).forEach(function (k) {
        try { window[k] = _avant[k]; } catch (e) {}
      });
      console.log(TAG, "désinstallé — les couches pourront se réinstaller au prochain chargement");
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();


/* ==================================================================== *
 * 2. PERSISTANCE — registre RJ_SAVE_HOOKS
 * (anciennement 87-persistance.js)
 * ==================================================================== */

(function () {
  "use strict";

  var TAG = "[87-persistance]";

  function G_() { return (typeof window.G !== "undefined") ? window.G : null; }
  function fn(n) { return typeof window[n] === "function"; }

  if (!Array.isArray(window.RJ_SAVE_HOOKS)) window.RJ_SAVE_HOOKS = [];

  /* ------------------------------------------------------------------
   * Emplacement de sauvegarde
   * ---------------------------------------------------------------- */
  function cleSlot(slot) {
    try {
      if (window.SAVE_KEYS && window.SAVE_KEYS[slot] != null) return window.SAVE_KEYS[slot];
    } catch (e) {}
    return "rj_s" + (Number(slot) + 1);
  }

  function slotEffectif(slot) {
    var G = G_();
    return (typeof slot === "undefined" || slot === null) ? ((G && G._slot) || 0) : slot;
  }

  /* ------------------------------------------------------------------
   * Écriture : une seule lecture, une seule écriture
   * ---------------------------------------------------------------- */
  function ecrireBlocs(slot) {
    var G = G_(); if (!G) return;
    var cle = cleSlot(slotEffectif(slot));
    var brut;
    try { brut = localStorage.getItem(cle); } catch (e) { return; }
    if (!brut) return;

    var obj;
    try { obj = JSON.parse(brut); } catch (e) { return; }

    var ecrits = 0;
    for (var i = 0; i < window.RJ_SAVE_HOOKS.length; i++) {
      var h = window.RJ_SAVE_HOOKS[i];
      if (!h || !h.cle || typeof h.ecrire !== "function") continue;
      try {
        var bloc = h.ecrire(G);
        if (bloc === undefined) continue;
        if (bloc === null) { delete obj[h.cle]; continue; }
        obj[h.cle] = bloc;
        ecrits++;
      } catch (e) {
        console.warn(TAG, "écriture « " + h.cle + " » :", e && e.message);
      }
    }
    if (!ecrits) return;
    try { localStorage.setItem(cle, JSON.stringify(obj)); }
    catch (e) { console.warn(TAG, "sauvegarde impossible :", e && e.message); }
  }

  /* ------------------------------------------------------------------
   * Lecture : une seule lecture, distribution à tous
   * ---------------------------------------------------------------- */
  function lireBlocs(slot) {
    var G = G_(); if (!G) return;
    var brut;
    try { brut = localStorage.getItem(cleSlot(slotEffectif(slot))); } catch (e) { return; }
    var obj = null;
    if (brut) { try { obj = JSON.parse(brut); } catch (e) { obj = null; } }

    for (var i = 0; i < window.RJ_SAVE_HOOKS.length; i++) {
      var h = window.RJ_SAVE_HOOKS[i];
      if (!h || !h.cle || typeof h.lire !== "function") continue;
      try { h.lire((obj && obj[h.cle]) || null, G); }
      catch (e) { console.warn(TAG, "lecture « " + h.cle + " » :", e && e.message); }
    }
  }

  /* ------------------------------------------------------------------
   * Installation
   * ---------------------------------------------------------------- */
  var _origSave = null, _origLoad = null;

  function installer() {
    if (fn("saveGame") && !window.saveGame._rj87) {
      _origSave = window.saveGame;
      window.saveGame = function (slot) {
        var r = _origSave.apply(this, arguments);
        try { ecrireBlocs(slot); } catch (e) { console.warn(TAG, e && e.message); }
        return r;
      };
      window.saveGame._rj87 = true;
    }
    if (fn("loadSave") && !window.loadSave._rj87) {
      _origLoad = window.loadSave;
      window.loadSave = function (slot) {
        var r = _origLoad.apply(this, arguments);
        try { lireBlocs(slot); } catch (e) { console.warn(TAG, e && e.message); }
        return r;
      };
      window.loadSave._rj87 = true;
    }
    return !!(window.saveGame && window.saveGame._rj87 && window.loadSave && window.loadSave._rj87);
  }

  function boot() {
    var essais = 0;
    (function tenter() {
      if (installer()) {
        console.log(TAG, "actif — " + window.RJ_SAVE_HOOKS.length + " bloc(s) inscrit(s)");
        return;
      }
      if (essais++ < 80) setTimeout(tenter, 150);
    })();

    window._rj87 = {
      blocs: function () { return window.RJ_SAVE_HOOKS.map(function (h) { return h.cle; }); },
      ecrire: ecrireBlocs, lire: lireBlocs
    };
    window._rj87Uninstall = function () {
      if (_origSave) window.saveGame = _origSave;
      if (_origLoad) window.loadSave = _origLoad;
      console.log(TAG, "désinstallé");
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();


/* ==================================================================== *
 * 3. NAVIGATION — RJ_SCREEN_HOOKS et RJ_TOAST_FILTERS
 * (anciennement 88-navigation.js)
 * ==================================================================== */

(function () {
  "use strict";

  var TAG = "[88-navigation]";

  function fn(n) { return typeof window[n] === "function"; }

  if (!Array.isArray(window.RJ_SCREEN_HOOKS)) window.RJ_SCREEN_HOOKS = [];

  function concerne(h, id) {
    if (!h || !h.ecran) return false;
    if (h.ecran === "*") return true;
    if (Array.isArray(h.ecran)) return h.ecran.indexOf(id) >= 0;
    return h.ecran === id;
  }

  /* Un hook « remplace » prend la main sur le rendu : c'est le cas des
     écrans entièrement construits par un module (S-arcs par exemple).
     Il retourne true pour indiquer qu'il a tout fait. */
  function remplacementDemande(id) {
    for (var i = 0; i < window.RJ_SCREEN_HOOKS.length; i++) {
      var h = window.RJ_SCREEN_HOOKS[i];
      if (!concerne(h, id) || typeof h.remplace !== "function") continue;
      try {
        if (h.remplace(id) !== false) return true;
      } catch (e) {
        console.warn(TAG, "remplacement « " + (h.id || "?") + " » :", e && e.message);
      }
    }
    return false;
  }

  function declencher(moment, id) {
    for (var i = 0; i < window.RJ_SCREEN_HOOKS.length; i++) {
      var h = window.RJ_SCREEN_HOOKS[i];
      if (!concerne(h, id) || typeof h[moment] !== "function") continue;
      try { h[moment](id); }
      catch (e) { console.warn(TAG, "écran « " + (h.id || "?") + " » (" + moment + ") :", e && e.message); }
    }
  }

  /* ------------------------------------------------------------------
   * FILTRES DE NOTIFICATION
   *
   * pushHomeToast portait trois enveloppes, et aucune n'affichait quoi que
   * ce soit : toutes filtraient. L'une retirait les émojis du libellé, une
   * autre taisait les notifications sur les écrans d'accueil de partie, la
   * troisième différait les messages tant qu'on n'était pas sur l'accueil.
   *
   * Un filtre reçoit les arguments et retourne :
   *   · false            → la notification est abandonnée ;
   *   · un tableau       → les arguments, éventuellement modifiés ;
   *   · rien             → on continue sans changement.
   * ---------------------------------------------------------------- */
  if (!Array.isArray(window.RJ_TOAST_FILTERS)) window.RJ_TOAST_FILTERS = [];

  function filtrerNotification(args) {
    for (var i = 0; i < window.RJ_TOAST_FILTERS.length; i++) {
      var f = window.RJ_TOAST_FILTERS[i];
      if (!f || typeof f.filtre !== "function") continue;
      var sortie;
      try { sortie = f.filtre.apply(null, args); }
      catch (e) { console.warn(TAG, "filtre « " + (f.id || "?") + " » :", e && e.message); continue; }
      if (sortie === false) return null;
      if (Array.isArray(sortie)) args = sortie;
    }
    return args;
  }

  var _origNav = null, _origRefresh = null, _origToast = null;

  function installer() {
    if (fn("navTo") && !window.navTo._rj88) {
      _origNav = window.navTo;
      window.navTo = function (id) {
        declencher("avant", id);
        var r = _origNav.apply(this, arguments);
        try { declencher("apres", id); } catch (e) {}
        return r;
      };
      window.navTo._rj88 = true;
    }
    if (fn("refreshScreen") && !window.refreshScreen._rj88) {
      _origRefresh = window.refreshScreen;
      window.refreshScreen = function (id) {
        if (remplacementDemande(id)) return;
        var r = _origRefresh.apply(this, arguments);
        try { declencher("apres", id); } catch (e) {}
        return r;
      };
      window.refreshScreen._rj88 = true;
    }
    if (fn("pushHomeToast") && !window.pushHomeToast._rj88) {
      _origToast = window.pushHomeToast;
      window.pushHomeToast = function () {
        var args = filtrerNotification([].slice.call(arguments));
        if (!args) return;
        return _origToast.apply(this, args);
      };
      window.pushHomeToast._rj88 = true;
    }

    return !!(window.navTo && window.navTo._rj88 &&
              window.refreshScreen && window.refreshScreen._rj88);
  }

  function boot() {
    var essais = 0;
    (function tenter() {
      if (installer()) {
        console.log(TAG, "actif — " + window.RJ_SCREEN_HOOKS.length + " réaction(s) d'écran inscrite(s)");
        return;
      }
      if (essais++ < 80) setTimeout(tenter, 150);
    })();

    window._rj88 = {
      reactions: function () {
        return window.RJ_SCREEN_HOOKS.map(function (h) { return (h.id || "?") + " → " + h.ecran; });
      }
    };
    window._rj88Uninstall = function () {
      if (_origNav) window.navTo = _origNav;
      if (_origRefresh) window.refreshScreen = _origRefresh;
      if (_origToast) window.pushHomeToast = _origToast;
      console.log(TAG, "désinstallé");
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();


/* ==================================================================== *
 * 4. SAISON ET CLASSEMENT — RJ_SEASON_HOOKS, RJ_LEADERBOARD_HOOKS
 * (anciennement 89-registres.js)
 * ==================================================================== */

(function () {
  "use strict";

  var TAG = "[89-registres]";

  function fn(n) { return typeof window[n] === "function"; }

  if (!Array.isArray(window.RJ_SEASON_HOOKS)) window.RJ_SEASON_HOOKS = [];
  if (!Array.isArray(window.RJ_LEADERBOARD_HOOKS)) window.RJ_LEADERBOARD_HOOKS = [];

  function declencher(registre, moment) {
    for (var i = 0; i < registre.length; i++) {
      var h = registre[i];
      if (!h || typeof h[moment] !== "function") continue;
      try { h[moment](); }
      catch (e) { console.warn(TAG, "« " + (h.id || "?") + " » (" + moment + ") :", e && e.message); }
    }
  }

  var _origSaison = null, _origClassement = null;

  function installer() {
    if (fn("startNextSeason") && !window.startNextSeason._rj89) {
      _origSaison = window.startNextSeason;
      window.startNextSeason = function () {
        declencher(window.RJ_SEASON_HOOKS, "avant");
        var r = _origSaison.apply(this, arguments);
        declencher(window.RJ_SEASON_HOOKS, "apres");
        return r;
      };
      window.startNextSeason._rj89 = true;
    }

    if (fn("renderLiveLeaderboard") && !window.renderLiveLeaderboard._rj89) {
      _origClassement = window.renderLiveLeaderboard;
      window.renderLiveLeaderboard = function () {
        var r;
        /* Garde défensif : une erreur d'affichage ne doit pas interrompre
           la course, mais elle ne doit pas non plus disparaître en silence. */
        try { r = _origClassement.apply(this, arguments); }
        catch (e) { console.warn(TAG, "rendu du classement :", e && e.message); }
        declencher(window.RJ_LEADERBOARD_HOOKS, "apres");
        return r;
      };
      window.renderLiveLeaderboard._rj89 = true;
    }

    return !!(window.startNextSeason && window.startNextSeason._rj89 &&
              window.renderLiveLeaderboard && window.renderLiveLeaderboard._rj89);
  }

  function boot() {
    var essais = 0;
    (function tenter() {
      if (installer()) {
        console.log(TAG, "actif — " + window.RJ_SEASON_HOOKS.length + " au changement de saison, " +
                    window.RJ_LEADERBOARD_HOOKS.length + " au classement");
        return;
      }
      if (essais++ < 80) setTimeout(tenter, 150);
    })();

    window._rj89 = {
      saison: function () { return window.RJ_SEASON_HOOKS.map(function (h) { return h.id; }); },
      classement: function () { return window.RJ_LEADERBOARD_HOOKS.map(function (h) { return h.id; }); }
    };
    window._rj89Uninstall = function () {
      if (_origSaison) window.startNextSeason = _origSaison;
      if (_origClassement) window.renderLiveLeaderboard = _origClassement;
      console.log(TAG, "désinstallé");
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
