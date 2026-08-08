/* =====================================================================
 * 99-media-days.js — LES CONFÉRENCES DE PRESSE REVIENNENT
 *
 * CE QU'IL Y AVAIT
 * Le media day existait — écran complet, huit questions, effets sur la
 * réputation — mais il était pratiquement introuvable :
 *   · UNE SEULE fois par saison, sur vingt-quatre manches ;
 *   · accessible par une ligne discrète de l'accueil, qu'il fallait penser
 *     à regarder ;
 *   · la fenêtre se refermait à la dernière course, sans le moindre
 *     avertissement.
 *
 * On pouvait donc jouer une carrière entière sans jamais en voir un.
 *
 * LA FRÉQUENCE RÉELLE
 * En Formule 1, la FIA convoque six pilotes en conférence de presse à
 * chaque week-end de Grand Prix. Sur vingt-quatre manches et une vingtaine
 * de pilotes, chacun y passe donc six à sept fois par saison — sans compter
 * les conférences d'après-course, réservées au podium.
 *
 * C'est ce rythme qui est repris ici, atténué dans les catégories
 * inférieures où la presse est moins présente.
 *
 * CE QUE FAIT CE MODULE
 *   · un quota par saison au lieu d'une occasion unique ;
 *   · la conférence est PROPOSÉE au moment d'avancer le temps, plutôt que
 *     d'attendre qu'on la trouve ;
 *   · elle reste accessible à la demande depuis l'accueil, tant qu'il reste
 *     des convocations.
 *
 * Réversible : window._rj99Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[99-media-days]";

  /* Convocations par saison. La Formule 1 suit le rythme réel ; en dessous,
     la presse se déplace moins. */
  var QUOTA = {
    "Formule 1": 6,
    "Formule 2": 4,
    "Formule 3": 3,
    "Formula Regional": 2,
    "Formule 4": 2
  };

  function G_() { return (typeof window.G !== "undefined") ? window.G : null; }

  function quotaSaison() {
    var G = G_();
    return (G && QUOTA[G.cat]) || 0;
  }

  function faites() {
    var G = G_();
    if (!G) return 0;
    if (!G._rjMediaDays || G._rjMediaDays.saison !== G.saison) {
      G._rjMediaDays = { saison: G.saison, faites: 0, derniereSemaine: -99 };
    }
    return G._rjMediaDays.faites;
  }

  function reste() { return Math.max(0, quotaSaison() - faites()); }

  function enregistrer() {
    var G = G_();
    if (!G) return;
    faites();                        // garantit la structure
    G._rjMediaDays.faites++;
    G._rjMediaDays.derniereSemaine = G.semaine || 0;
  }

  /* Disponible tant qu'il reste des convocations et que la saison court.
     On laisse respirer deux semaines entre deux conférences. */
  function disponible() {
    var G = G_();
    if (!G || !quotaSaison()) return false;
    if (reste() <= 0) return false;
    try {
      var manches = (window.CAL_RACES || []).length || 10;
      if ((G.races || []).length >= manches) return false;
    } catch (e) {}
    var ecart = (G.semaine || 0) - ((G._rjMediaDays && G._rjMediaDays.derniereSemaine) || -99);
    return ecart >= 2;
  }

  /* Probabilité calculée pour épuiser le quota avant la fin de saison :
     s'il reste beaucoup de convocations et peu de semaines, elle monte. */
  function chance() {
    var G = G_();
    if (!G) return 0;
    /* Sauvegarde de test « media day » : la première conférence est
       garantie, pour que le parcours soit reproductible. Ensuite, le
       rythme normal reprend.
       Le marqueur n'est pas restauré dans l'état de jeu — le chargement ne
       reprend qu'une liste fermée de champs — on le lit donc directement
       dans le fichier de sauvegarde. */
    try {
      if (faites() === 0 && estPartieDeTest()) return 1;
    } catch (e) {}
    var manches = (window.CAL_RACES || []).length || 10;
    var restantes = Math.max(1, manches - (G.races || []).length);
    var p = reste() / restantes;
    return Math.max(0.12, Math.min(0.55, p));
  }

  function estPartieDeTest() {
    var G = G_();
    if (!G) return false;
    if (typeof G._rjEstTest === "boolean") return G._rjEstTest;
    var trouve = false;
    try {
      var slot = (typeof G._slot === "number") ? G._slot : 0;
      var cle = (window.SAVE_KEYS && window.SAVE_KEYS[slot]) || ("rj_s" + (slot + 1));
      var brut = localStorage.getItem(cle);
      if (brut) trouve = JSON.parse(brut)._rjTestSave === true;
    } catch (e) {}
    G._rjEstTest = trouve;
    return trouve;
  }

  var _orig = {};

  /* ------------------------------------------------------------------
   * Proposition au moment d'avancer le temps
   * ---------------------------------------------------------------- */
  function proposer() {
    try {
      if (!disponible()) return false;
      if (Math.random() > chance()) return false;
      if (typeof window.openMediaDay !== "function") return false;
      window.openMediaDay();
      return true;
    } catch (e) { console.warn(TAG, "proposition :", e && e.message); return false; }
  }

  function installer() {
    /* Le quota remplace l'occasion unique. */
    if (typeof window.mediaDayAvailable === "function" && !window.mediaDayAvailable._rj99) {
      _orig.mediaDayAvailable = window.mediaDayAvailable;
      window.mediaDayAvailable = disponible;
      window.mediaDayAvailable._rj99 = true;
    }

    /* On compte les conférences tenues plutôt que de fermer la porte. */
    if (typeof window.endMediaDay === "function" && !window.endMediaDay._rj99) {
      _orig.endMediaDay = window.endMediaDay;
      window.endMediaDay = function () {
        try { enregistrer(); } catch (e) {}
        var r = _orig.endMediaDay.apply(this, arguments);
        try {
          if (typeof window.MD_STATE !== "undefined") window.MD_STATE.usedThisSeason = false;
          if (typeof window.updateMediaDayRow === "function") window.updateMediaDayRow();
        } catch (e) {}
        return r;
      };
      window.endMediaDay._rj99 = true;
    }

    /* La conférence vient au joueur, et non l'inverse. */
    if (typeof window.advanceToNextMoment === "function" && !window.advanceToNextMoment._rj99) {
      _orig.advanceToNextMoment = window.advanceToNextMoment;
      window.advanceToNextMoment = function () {
        /* La décision se prend AVANT de faire avancer le temps. L'ancienne
           version laissait l'écran de préparation s'afficher une seconde
           avant d'être recouvert par la conférence — un clignotement
           désagréable. La conférence a lieu le jeudi, donc AVANT d'entrer
           dans le week-end : on l'ouvre d'abord, l'avancée reprend après. */
        var G = G_();
        try {
          var ici = document.querySelector(".scr.on");
          var id = ici ? ici.id : "";
          if ((id === "S-home" || id === "") && disponible() &&
              Math.random() <= chance() && typeof window.openMediaDay === "function") {
            if (G) G._rj99Reprendre = true;
            window.openMediaDay();
            return;
          }
        } catch (e) {}
        return _orig.advanceToNextMoment.apply(this, arguments);
      };
      window.advanceToNextMoment._rj99 = true;
    }

    return !!(window.mediaDayAvailable && window.mediaDayAvailable._rj99 &&
              window.advanceToNextMoment && window.advanceToNextMoment._rj99);
  }

  /* Appelée par le module 100 à la sortie de la conférence : si l'avancée
     du temps a été suspendue pour la tenir, on la reprend maintenant. */
  function reprendre() {
    var G = G_();
    if (!G || !G._rj99Reprendre) return false;
    delete G._rj99Reprendre;
    try {
      if (typeof _orig.advanceToNextMoment === "function") {
        setTimeout(function () { _orig.advanceToNextMoment(); }, 60);
        return true;
      }
    } catch (e) {}
    return false;
  }

  function boot() {
    var essais = 0;
    (function tenter() {
      if (installer()) {
        console.log(TAG, "actif — " + quotaSaison() + " convocation(s) par saison en " +
                    ((G_() && G_().cat) || "?"));
        try { if (typeof window.updateMediaDayRow === "function") window.updateMediaDayRow(); } catch (e) {}
        return;
      }
      if (essais++ < 80) setTimeout(tenter, 150);
    })();

    window._rj99 = {
      quota: quotaSaison, reste: reste, disponible: disponible,
      chance: chance, proposer: proposer, reprendre: reprendre
    };
    window._rj99Uninstall = function () {
      Object.keys(_orig).forEach(function (k) { window[k] = _orig[k]; });
      console.log(TAG, "désinstallé");
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
