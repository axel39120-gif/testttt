/* =====================================================================
 * 134-categories-paralleles.js — INDYCAR, WEC ET SUPER FORMULA
 *
 * POURQUOI
 * Une fois en F1, le joueur ne pouvait plus rejoindre l'IndyCar, le WEC ou
 * la Super Formula en fin de saison (seulement après un licenciement). Les
 * points IndyCar ignoraient les bonus de pole et de tours menés. Plusieurs
 * écuries ont été renommées ou retirées (doublons, classes mélangées) : les
 * anciennes sauvegardes doivent suivre.
 *
 * CE QUE FAIT LE MODULE
 *   1. Offres latérales : à partir de la mi-saison, un pilote de F1 peut
 *      recevoir une offre d'IndyCar, de WEC ou de Super Formula (offre
 *      marquée _lateral, que le mercato traite comme un changement de
 *      catégorie). Plus probable quand la saison de F1 se passe mal.
 *   2. Points IndyCar : +1 pour la pole, +1 pour avoir mené au moins un
 *      tour, +2 de plus pour le plus de tours menés.
 *   3. Sauvegardes : écuries de Super Formula renommées (« Toyota Gazoo
 *      Racing » → « TOM'S », « Honda Racing » → « Dandelion Racing »), équipes
 *      LMP2/LMGT3 retirées du WEC, doublon « ECR / Foyt » retiré de l'IndyCar.
 *
 * API : window.RJParalleles. Réversible : window._rj134Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[134-paralleles]";
  var ALT = ["Super Formula", "Endurance WEC", "IndyCar"];

  /* --- 1. Offres latérales depuis la F1 ---------------------------------- */
  function placeAuChampionnat() {
    var pts = [{ p: G.champPts || 0, moi: true }].concat((G.rivals || []).map(function (r) { return { p: r.pts || 0 }; }));
    pts.sort(function (a, b) { return b.p - a.p; });
    return pts.map(function (x) { return !!x.moi; }).indexOf(true) + 1;
  }

  function offresLaterales() {
    if (typeof G === "undefined" || !G || G.cat !== "Formule 1") return 0;
    if (!G.currentTeam || G.currentTeam === "Indépendant" || G.pendingTransfer) return 0;
    if (G._rj134Lateral === G.saison) return 0;
    var total = (typeof CAL_RACES !== "undefined" && CAL_RACES.length) || 18;
    if ((G.races || []).length < Math.floor(total * 0.55)) return 0;
    G._rj134Lateral = G.saison;
    if (typeof buildOffer !== "function" || typeof TEAM_OFFERS === "undefined") return 0;

    var place = placeAuChampionnat(), rep = G.reputation || 0;
    var p = 0.3 + (place >= 12 ? 0.3 : place >= 8 ? 0.15 : 0) + (G._contractExpired || (G.contractDur || 0) <= 1 ? 0.1 : 0);
    var faites = [];
    ALT.slice().sort(function () { return Math.random() - 0.5; }).forEach(function (cat) {
      if (faites.length >= 2 || Math.random() >= p) return;
      if ((G.offers || []).some(function (o) { return o && o.cat === cat; })) return;
      var ecuries = (TEAM_OFFERS[cat] || []).filter(function (t) { return (t.repReq || 0) <= rep + 10; })
        .sort(function (a, b) { return (b.repReq || 0) - (a.repReq || 0); });
      var t = ecuries[Math.floor(Math.random() * Math.min(3, ecuries.length))];
      if (!t) return;
      var o = null;
      try {
        o = buildOffer({ team: t.team, cat: cat, cost: 0, salary: t.salary || 0, bonusWin: t.bonusWin || 0,
          bonusPodium: t.bonusPodium || 0, duration: Math.max(1, t.dur || 1), extra: t.extra || "", expire: 6, role: "num1" });
      } catch (e) { o = null; }
      if (!o) return;
      o._lateral = true;
      G.offers = G.offers || [];
      G.offers.push(o);
      faites.push(t.team + " (" + cat + ")");
    });
    if (faites.length && typeof pushMail === "function") {
      try {
        pushMail({
          from: "Ton agent", role: "agent",
          subject: faites.length > 1 ? "Deux portes de sortie hors de la F1" : "Une porte de sortie hors de la F1",
          body: "On m'a appelé pour toi : " + faites.join(" et ") + ".\n\nCe n'est pas une rétrogradation : " +
            "là-bas, tu serais un pilote de pointe, payé par l'usine, avec des victoires à aller chercher. " +
            "Beaucoup de pilotes de F1 y ont relancé leur carrière.\n\nLes offres sont dans tes contrats.",
          actions: [{ label: "Je regarde", kind: "dismiss", responseBody: "Je vais y réfléchir." }]
        });
      } catch (e) {}
      var dot = document.getElementById("ni-more-dot"); if (dot) dot.style.display = "block";
    }
    return faites.length;
  }

  /* --- 2. Points bonus IndyCar ------------------------------------------- */
  var toursMenes = {};
  function surTour() {
    if (typeof G === "undefined" || !G || G.cat !== "IndyCar" || typeof LIVE_RACE === "undefined" || !LIVE_RACE) return;
    var tete = (LIVE_RACE.drivers || []).filter(function (d) { return d && !d.dnf; })
      .sort(function (a, b) { return (a.pos || 99) - (b.pos || 99); })[0];
    if (tete) toursMenes[tete.name] = (toursMenes[tete.name] || 0) + 1;
  }
  function bonusIndyCar(info) {
    if (typeof G === "undefined" || !G || G.cat !== "IndyCar") return null;
    var drivers = (info && info.drivers) || (typeof LIVE_RACE !== "undefined" && LIVE_RACE && LIVE_RACE.drivers) || [];
    var bonus = {};                                                  // nom -> points
    function ajoute(nom, n) { if (nom) bonus[nom] = (bonus[nom] || 0) + n; }

    // pole : le meilleur chrono des qualifications
    var moi = drivers.filter(function (d) { return d.isPlayer; })[0];
    if (info && info.isPole && moi) ajoute(moi.name, 1);
    else if (typeof QUALI_STATE !== "undefined" && QUALI_STATE && (QUALI_STATE.drivers || []).length) {
      var q = QUALI_STATE.drivers.filter(function (d) { return d.bestTime; }).sort(function (a, b) { return a.bestTime - b.bestTime; })[0];
      if (q && !q.isPlayer) ajoute(q.name, 1);
    }
    // tours menés
    var noms = Object.keys(toursMenes), max = 0, plus = null;
    noms.forEach(function (n) { ajoute(n, 1); if (toursMenes[n] > max) { max = toursMenes[n]; plus = n; } });
    if (plus) ajoute(plus, 2);

    var parNom = {};
    drivers.forEach(function (d) { if (d) parNom[d.name] = d; });
    Object.keys(bonus).forEach(function (nom) {
      var d = parNom[nom];
      if (d && d.isPlayer) G.champPts = (G.champPts || 0) + bonus[nom];
      else if (d && typeof d.rivalIdx === "number" && G.rivals[d.rivalIdx]) G.rivals[d.rivalIdx].pts = (G.rivals[d.rivalIdx].pts || 0) + bonus[nom];
    });
    G._rj134Bonus = { tours: toursMenes, bonus: bonus };
    if (moi && bonus[moi.name] && typeof showToast === "function") {
      try { showToast("Points bonus IndyCar : +" + bonus[moi.name], "ok"); } catch (e) {}
    }
    toursMenes = {};
    return bonus;
  }

  /* --- 3. Anciennes sauvegardes ------------------------------------------ */
  var RENOMMES = {
    "Super Formula": { "Toyota Gazoo Racing": "TOM'S", "Honda Racing": "Dandelion Racing" },
    "Endurance WEC": { "United Autosports": "Proton Competition", "Cool Racing": "Proton Competition",
      "Inter Europol Competition": "Proton Competition", "Richard Mille Racing": "AF Corse", "Inception Racing": "Proton Competition" },
    "IndyCar": { "ECR / Foyt": "AJ Foyt Enterprises" }
  };
  function nouveauNom(cat, team) { var m = RENOMMES[cat]; return m && m[team] ? m[team] : team; }
  function migrer() {
    if (typeof G === "undefined" || !G) return 0;
    var n = 0;
    function fixe(o, cle, cat) { if (o && o[cle] && nouveauNom(cat, o[cle]) !== o[cle]) { o[cle] = nouveauNom(cat, o[cle]); n++; } }
    if (RENOMMES[G.cat]) {
      fixe(G, "currentTeam", G.cat); fixe(G, "_seasonTeam", G.cat);
      (G.rivals || []).forEach(function (r) { fixe(r, "team", G.cat); });
    }
    [G.pendingTransfer, G._reserveDeal].concat(G.offers || []).forEach(function (o) { if (o) fixe(o, "team", o.cat); });
    (Array.isArray(G.driverPool) ? G.driverPool : []).forEach(function (p) { if (p) fixe(p, "team", p.cat); });
    try { (typeof CAREER_HISTORY !== "undefined" ? CAREER_HISTORY : []).forEach(function (h) { if (h) fixe(h, "team", h.cat); }); } catch (e) {}
    if (n) console.log(TAG, n + " écurie(s) mise(s) à jour dans la sauvegarde");
    return n;
  }

  /* --- Installation ------------------------------------------------------ */
  function installer() {
    if (typeof rjInscrire !== "function" || typeof window.generateTeamOffers !== "function" ||
        !Array.isArray(window.RJ_LAP_HOOKS) || !Array.isArray(window.RJ_RACE_START_HOOKS) ||
        typeof RACE_POST_HOOKS === "undefined" || !Array.isArray(window.RJ_SAVE_HOOKS)) return false;
    rjInscrire("generateTeamOffers", { id: "134-paralleles:laterales", apres: function () { try { offresLaterales(); } catch (e) { console.warn(TAG, e && e.message); } } });
    if (!window.RJ_LAP_HOOKS.some(function (h) { return h && h.id === "134-paralleles"; })) {
      window.RJ_LAP_HOOKS.push({ id: "134-paralleles", run: surTour });
      window.RJ_RACE_START_HOOKS.push({ id: "134-paralleles", avant: function () { toursMenes = {}; } });
      RACE_POST_HOOKS.push({ id: "134-paralleles", run: function (info) { try { bonusIndyCar(info); } catch (e) { console.warn(TAG, e && e.message); } } });
      window.RJ_SAVE_HOOKS.push({ cle: "__rj134", lire: function () { migrer(); } });
    }
    return true;
  }

  window.RJParalleles = { offresLaterales: offresLaterales, bonusIndyCar: bonusIndyCar, surTour: surTour, migrer: migrer,
    toursMenes: function () { return toursMenes; } };
  window._rj134Uninstall = function () {
    if (typeof rjDesinscrire === "function") rjDesinscrire(["134-paralleles"], "generateTeamOffers");
    function sans(l) { return (l || []).filter(function (h) { return !(h && (h.id === "134-paralleles" || h.cle === "__rj134")); }); }
    window.RJ_LAP_HOOKS = sans(window.RJ_LAP_HOOKS);
    window.RJ_RACE_START_HOOKS = sans(window.RJ_RACE_START_HOOKS);
    window.RJ_SAVE_HOOKS = sans(window.RJ_SAVE_HOOKS);
    if (typeof RACE_POST_HOOKS !== "undefined") for (var i = RACE_POST_HOOKS.length - 1; i >= 0; i--) if (RACE_POST_HOOKS[i] && RACE_POST_HOOKS[i].id === "134-paralleles") RACE_POST_HOOKS.splice(i, 1);
    delete window.RJParalleles;
  };

  var essais = 0;
  function boot() {
    if (installer()) { console.log(TAG, "actif"); return; }
    if (essais++ < 80) setTimeout(boot, 120); else console.warn(TAG, "installation impossible");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
