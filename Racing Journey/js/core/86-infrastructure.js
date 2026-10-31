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
 *   2. Persistance       — déplacée dans 04s-sauvegarde.js (RJ_SAVE_HOOKS).
 *   3. Navigation        — RJ_SCREEN_HOOKS : réactions par écran, et
 *                          RJ_TOAST_FILTERS : filtres de notification.
 *   4. Saison, classement — RJ_SEASON_HOOKS et RJ_LEADERBOARD_HOOKS.
 *
 * Les registres du tour et du départ de course (RJ_LAP_HOOKS,
 * RJ_RACE_START_HOOKS) restent dans 81-moteur-course, où ils sont
 * déclenchés.
 *
 * Chaque partie conserve sa fonction de désinstallation d'origine
 * (_rj86Uninstall, _rj88Uninstall, _rj89Uninstall) : le
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
 * (anciennement 87-persistance.js) — déplacé dans 04s-sauvegarde.js, qui
 * écrit et relit les blocs inscrits au sein d'une écriture unique.
 * ==================================================================== */


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

  /* Appelés directement par navTo, refreshScreen et pushHomeToast (03). */
  window.declencherHooksEcran = declencher;
  window.remplacementEcranDemande = remplacementDemande;
  window.filtrerNotification = filtrerNotification;
  window.redirectionEcran = function (id) {
    for (var i = 0; i < window.RJ_SCREEN_HOOKS.length; i++) {
      var h = window.RJ_SCREEN_HOOKS[i];
      if (concerne(h, id) && Array.isArray(h.redirige)) return { cible: h.redirige, ensuite: h.ensuite };
    }
    return null;
  };

  function boot() {
    console.log(TAG, "actif — " + window.RJ_SCREEN_HOOKS.length + " réaction(s) d'écran inscrite(s)");

    window._rj88 = {
      reactions: function () {
        return window.RJ_SCREEN_HOOKS.map(function (h) { return (h.id || "?") + " → " + h.ecran; });
      }
    };
    window._rj88Uninstall = function () {
      /* navTo, refreshScreen et pushHomeToast testent leur présence. */
      ["declencherHooksEcran", "remplacementEcranDemande", "filtrerNotification", "redirectionEcran"]
        .forEach(function (n) { delete window[n]; });
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

  var _origClassement = null;

  /* Appelé par startNextSeason (04). Les hooks « prioritaires » passent en
     premier : ce sont les anciennes enveloppes de 34, 70 et 74, qui
     s'exécutaient avant les autres hooks « apres ». */
  window.declencherHooksSaison = function (moment) {
    var L = window.RJ_SEASON_HOOKS;
    declencher(L.filter(function (h) { return h && h.prioritaire; }), moment);
    declencher(L.filter(function (h) { return h && !h.prioritaire; }), moment);
  };

  function installer() {

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

    return !!(window.renderLiveLeaderboard && window.renderLiveLeaderboard._rj89);
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
      if (_origClassement) window.renderLiveLeaderboard = _origClassement;
      console.log(TAG, "désinstallé");
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
