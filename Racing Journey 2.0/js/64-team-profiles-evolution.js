/* =====================================================================
 * 64-team-profiles-evolution.js — LES ÉCURIES CHANGENT DE CARACTÈRE
 *
 * CONSTAT : le moteur donne à chaque écurie un profil technique à quatre
 * dimensions — vitesse, aéro, agilité, freinage — qui décide de son
 * affinité avec chaque circuit (Ferrari +0,40 s à Monza, +0,09 s à Monaco).
 * Mais ce profil est FIGÉ : _TEAM_PROFILES_F1 n'est jamais réécrit. Même
 * après un changement de règlement, qui redistribue pourtant toutes les
 * notes globales au hasard, Ferrari gardait exactement la même voiture.
 *
 * CE MODULE fait vivre ces profils, sur trois mécanismes :
 *
 *  1. DÉRIVE ANNUELLE — chaque saison, chaque dimension bouge légèrement
 *     (±0,06) avec un rappel vers le centre, pour que les caractères
 *     évoluent sans dériver à l'infini.
 *
 *  2. CHANGEMENT DE RÈGLEMENT — quand le moteur rebat les notes (il pose
 *     TEAM_RATINGS[cat_saison_reset]), les profils sont redistribués. Une
 *     part de l'ancien caractère est conservée (20 %) : une écurie garde
 *     sa philosophie, elle ne devient pas quelqu'un d'autre du jour au
 *     lendemain. L'amplitude dépend de la nouvelle note : une écurie de
 *     pointe a des forces plus marquées qu'un fond de grille.
 *
 *  3. DÉVELOPPEMENT — l'évolution de la note d'une saison sur l'autre
 *     oriente la dérive : une écurie qui progresse nettement RENFORCE sa
 *     dimension dominante (elle a trouvé une direction qui marche) ;
 *     une écurie qui s'effondre voit ce point fort s'éroder.
 *
 * L'aléa est déterministe (graine tirée du nom, de la catégorie et de la
 * saison) : une même partie rechargée donne exactement la même histoire.
 *
 * Réversible : window._rj64Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var wrapped = {};
  var etat = { installe: false, erreur: null };
  window._rj64Status = function () { return etat; };

  var REGLAGES = {
    derive: 0.07,        // amplitude de la dérive annuelle par dimension
    rappel: 0.02,        // rappel très léger : une écurie garde son identité,
                         // le rappel ne sert qu'à empêcher l'emballement
    devSeuil: 3,         // écart de note à partir duquel le développement pèse
    devEffet: 0.05,      // renforcement/érosion de la dimension dominante
    memoire: 0.20,       // part du caractère conservée après un règlement
    borne: 0.90
  };

  /* ---------------------------------------------------- aléa reproductible */
  function graine(txt) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function alea(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function borne(v) { return Math.max(-REGLAGES.borne, Math.min(REGLAGES.borne, v)); }

  /* ------------------------------------------------------------ stockage */
  function store() {
    if (typeof G === "undefined" || !G) return null;
    if (!G._rjProfiles) G._rjProfiles = {};
    if (!G._rjProfilesSaison) G._rjProfilesSaison = {};
    return G._rjProfiles;
  }

  // Profil d'origine : table explicite en F1, génération déterministe ailleurs.
  function profilBase(team, cat) {
    try {
      if (wrapped._getTeamProfile) return wrapped._getTeamProfile(team, cat).slice();
    } catch (e) {}
    return [0, 0, 0, 0];
  }

  function equipesDe(cat) {
    try {
      if (typeof TEAMS_BY_CAT !== "undefined" && TEAMS_BY_CAT[cat]) return TEAMS_BY_CAT[cat].slice();
    } catch (e) {}
    return [];
  }

  function notesDe(cat, saison) {
    try {
      if (typeof TEAM_RATINGS !== "undefined") return TEAM_RATINGS[cat + "_" + saison] || null;
    } catch (e) {}
    return null;
  }

  function reglementChange(cat, saison) {
    try {
      return !!(typeof TEAM_RATINGS !== "undefined" && TEAM_RATINGS[cat + "_" + saison + "_reset"]);
    } catch (e) { return false; }
  }

  /* ------------------------------------------------------- une transition */
  function transition(team, cat, saison, profil) {
    var r = alea(graine(team + "|" + cat + "|" + saison));
    var notesN = notesDe(cat, saison);
    var notesP = notesDe(cat, saison - 1);
    var note = (notesN && notesN[team]) || 72;

    if (reglementChange(cat, saison)) {
      // Nouvelle réglementation : le caractère est largement redistribué,
      // avec une amplitude proportionnelle au niveau de l'écurie.
      var ampleur = 0.35 + 0.45 * Math.max(0, Math.min(1, (note - 58) / 40));
      var neuf = [];
      for (var i = 0; i < 4; i++) {
        var tirage = (r() * 2 - 1) * ampleur;
        neuf.push(borne(profil[i] * REGLAGES.memoire + tirage * (1 - REGLAGES.memoire)));
      }
      return { profil: neuf, cause: "règlement" };
    }

    // Saison ordinaire : dérive légère + rappel + effet du développement.
    var out = profil.slice();
    for (var j = 0; j < 4; j++) {
      out[j] = out[j] * (1 - REGLAGES.rappel) + (r() * 2 - 1) * REGLAGES.derive;
    }

    if (notesN && notesP && typeof notesP[team] === "number") {
      var delta = note - notesP[team];
      if (Math.abs(delta) >= REGLAGES.devSeuil) {
        // dimension dominante = celle où l'écurie est la plus marquée
        var idx = 0, best = -1;
        for (var k = 0; k < 4; k++) {
          if (Math.abs(out[k]) > best) { best = Math.abs(out[k]); idx = k; }
        }
        var sens = out[idx] >= 0 ? 1 : -1;
        out[idx] += (delta > 0 ? 1 : -1) * sens * REGLAGES.devEffet;
      }
    }

    for (var m = 0; m < 4; m++) out[m] = borne(Math.round(out[m] * 100) / 100);
    return { profil: out, cause: "dérive" };
  }

  /* ------------------------------------------- mise à jour d'une catégorie */
  function majCategorie(cat, saison) {
    var s = store();
    if (!s || !cat || !saison) return;
    if (!s[cat]) s[cat] = {};
    var derniere = G._rjProfilesSaison[cat] || 0;

    // initialisation : on part des profils d'origine du jeu
    if (!derniere) {
      equipesDe(cat).forEach(function (t) {
        if (!s[cat][t]) s[cat][t] = profilBase(t, cat);
      });
      G._rjProfilesSaison[cat] = saison;
      return;
    }
    if (saison <= derniere) return;

    for (var an = derniere + 1; an <= saison; an++) {
      equipesDe(cat).forEach(function (t) {
        if (!s[cat][t]) s[cat][t] = profilBase(t, cat);
        var res = transition(t, cat, an, s[cat][t]);
        s[cat][t] = res.profil;
      });
    }
    G._rjProfilesSaison[cat] = saison;
  }


  /* ------------------------------------------------------- persistance ---
   * saveGame() ne sérialise qu'une liste FERMÉE de champs de G : tout ce que
   * les modules ajoutent (couleurs et logos d'écurie, profils techniques,
   * journal anti-répétition de la messagerie) était perdu au rechargement.
   * On complète donc l'écriture et la lecture de la sauvegarde. */
  var CHAMPS_SUP = ["_rjTeamStyle", "_rjProfiles", "_rjProfilesSaison", "_rjMailLog"];

  function cleSlot(slot) {
    try {
      if (typeof SAVE_KEYS === "undefined") return null;
      if (slot === undefined || slot === null) slot = (G && G._slot) || 0;
      return SAVE_KEYS[slot] || null;
    } catch (e) { return null; }
  }

  function installerPersistance() {
    if (typeof window.saveGame === "function" && !window.saveGame._rj64) {
      var o1 = window.saveGame;
      var f1 = function (slot) {
        var r = o1.apply(this, arguments);
        try {
          var k = cleSlot(slot);
          if (k) {
            var brut = localStorage.getItem(k);
            if (brut) {
              var obj = JSON.parse(brut);
              CHAMPS_SUP.forEach(function (c) { if (G[c] !== undefined) obj[c] = G[c]; });
              localStorage.setItem(k, JSON.stringify(obj));
            }
          }
        } catch (e) { console.warn("[64] persistance écriture :", e); }
        return r;
      };
      f1._rj64 = true;
      wrapped.saveGame = o1;
      window.saveGame = f1;
    }

    if (typeof window.loadSave === "function" && !window.loadSave._rj64) {
      var o2 = window.loadSave;
      var f2 = function (slot) {
        var r = o2.apply(this, arguments);
        try {
          var k = cleSlot(slot);
          if (k) {
            var brut = localStorage.getItem(k);
            if (brut) {
              var obj = JSON.parse(brut);
              CHAMPS_SUP.forEach(function (c) { if (obj[c] !== undefined) G[c] = obj[c]; });
            }
          }
          // les logos personnalisés doivent être réappliqués APRÈS restauration
          setTimeout(function () {
            try { if (typeof window._rj63Apply === "function") window._rj63Apply(); } catch (e) {}
          }, 40);
        } catch (e) { console.warn("[64] persistance lecture :", e); }
        return r;
      };
      f2._rj64 = true;
      wrapped.loadSave = o2;
      window.loadSave = f2;
    }
  }

  /* --------------------------------------------------------- surcharge --- */
  function installer() {
    if (typeof window._getTeamProfile !== "function") return false;

    if (!window._getTeamProfile._rj64) {
      wrapped._getTeamProfile = window._getTeamProfile;
      var fn = function (team, cat) {
        try {
          if (team && team !== "Indépendant") {
            var s = store();
            var saison = (typeof G !== "undefined" && G && G.saison) || 1;
            if (s) {
              if (!s[cat] || G._rjProfilesSaison[cat] !== saison) majCategorie(cat, saison);
              if (s[cat] && s[cat][team]) return s[cat][team].slice();
            }
          }
        } catch (e) {}
        return wrapped._getTeamProfile.apply(this, arguments);
      };
      fn._rj64 = true;
      window._getTeamProfile = fn;
    }

    // le renommage d'une écurie doit emporter son profil
    if (typeof window._geRenameTeam === "function" && !window._geRenameTeam._rj64) {
      var o2 = window._geRenameTeam;
      var f2 = function (oldName, newName) {
        var r = o2.apply(this, arguments);
        try {
          var s = store();
          if (s && oldName !== newName) {
            Object.keys(s).forEach(function (cat) {
              if (s[cat] && s[cat][oldName]) { s[cat][newName] = s[cat][oldName]; delete s[cat][oldName]; }
            });
          }
        } catch (e) {}
        return r;
      };
      f2._rj64 = true;
      wrapped._geRenameTeam = o2;
      window._geRenameTeam = f2;
    }

    installerPersistance();
    return true;
  }

  var essais = 0;
  function boot() {
    try {
      if (installer()) {
        etat.installe = true;
        console.log("[64-team-profiles-evolution] actif — profils techniques évolutifs (dérive, règlement, développement)");
        return;
      }
    } catch (e) { etat.erreur = String(e && e.message || e); }
    if (essais++ < 80) setTimeout(boot, 80);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj64Uninstall = function () {
    Object.keys(wrapped).forEach(function (k) { if (window[k]) window[k] = wrapped[k]; });
    console.log("[64-team-profiles-evolution] désinstallé");
  };
  window._rj64Reglages = REGLAGES;
  window._rj64Profil = function (team, cat) {
    var s = store();
    return (s && s[cat] && s[cat][team]) ? s[cat][team].slice() : null;
  };
})();
