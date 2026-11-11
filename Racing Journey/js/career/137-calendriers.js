/* =====================================================================
 * 137-calendriers.js — DES CALENDRIERS QUI ÉVOLUENT D'UNE SAISON À L'AUTRE
 *
 * POURQUOI
 * Chaque catégorie courait chaque année les mêmes manches, dans le même
 * ordre. En vrai, le calendrier de la F1 bouge : des Grands Prix arrivent,
 * d'autres s'en vont, le nombre de sprints varie.
 *
 * CE QUE FAIT LE MODULE
 *   - F1 : 20 à 26 Grands Prix. Des piliers ne bougent jamais (Melbourne,
 *     Bahreïn, Suzuka, Monaco, Silverstone, Monza, Abu Dhabi) ; certaines
 *     saisons, un ou deux circuits s'en vont et un ou deux arrivent ou
 *     reviennent, parmi un vivier réaliste (Imola, Zandvoort, Portimão,
 *     Paul Ricard, Istanbul, Sepang, Kyalami, Nürburgring…). Les manches
 *     restent rangées dans l'ordre de la saison (mars à décembre).
 *     Sprints : 6 à 12, la plupart reconduits d'une année sur l'autre.
 *   - F2 et F3 courent en lever de rideau de la F1 : leurs manches suivent
 *     le calendrier de F1 de la saison (Macao clôt toujours la F3).
 *   - IndyCar et WEC : une rotation plus rare d'une ou deux épreuves.
 *   - Super Formula, F4, Formula Regional, karting : inchangés.
 *
 * Le calendrier d'une saison se déduit, sans hasard libre, d'une graine de
 * carrière : il est le même à chaque rechargement. Une partie déjà
 * commencée garde son calendrier actuel ; l'évolution démarre à la saison
 * suivante.
 *
 * API : RJCalendrier.plan(cat, saison) → { courses, semaines, sprints } ou null.
 * Persistance : bloc « rj137 » (graine, saison de départ).
 * Réversible : window._rj137Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[137-calendriers]";

  /* --- Les circuits de F1 : place dans la saison (mois) et statut -------- */
  var F1 = {
    "Melbourne":   { mois: 3.1, statut: "pilier" },
    "Shanghai":    { mois: 3.5, statut: "regulier" },
    "Kyalami":     { mois: 3.8, statut: "candidat" },
    "Suzuka":      { mois: 4.0, statut: "pilier" },
    "Bahrain":     { mois: 4.3, statut: "pilier" },
    "Jeddah":      { mois: 4.6, statut: "regulier" },
    "Portimao":    { mois: 4.8, statut: "candidat" },
    "Miami":       { mois: 5.1, statut: "regulier" },
    "Imola":       { mois: 5.3, statut: "candidat" },
    "Montréal":    { mois: 5.6, statut: "regulier" },
    "Monaco":      { mois: 6.0, statut: "pilier" },
    "Barcelone":   { mois: 6.3, statut: "regulier" },
    "Spielberg":   { mois: 6.6, statut: "regulier" },
    "Paul Ricard": { mois: 6.8, statut: "candidat" },
    "Silverstone": { mois: 7.0, statut: "pilier" },
    "Nürburgring": { mois: 7.2, statut: "candidat" },
    "Spa":         { mois: 7.5, statut: "regulier" },
    "Budapest":    { mois: 7.8, statut: "regulier" },
    "Zandvoort":   { mois: 8.5, statut: "regulier" },
    "Istanbul":    { mois: 8.8, statut: "candidat" },
    "Monza":       { mois: 9.0, statut: "pilier" },
    "Madrid":      { mois: 9.2, statut: "regulier" },
    "Baku":        { mois: 9.5, statut: "regulier" },
    "Singapore":   { mois: 10.0, statut: "regulier" },
    "Sepang":      { mois: 10.2, statut: "candidat" },
    "Austin":      { mois: 10.5, statut: "regulier" },
    "Mexico":      { mois: 10.8, statut: "regulier" },
    "Sao Paulo":   { mois: 11.0, statut: "regulier" },
    "Las Vegas":   { mois: 11.3, statut: "regulier" },
    "Qatar":       { mois: 11.6, statut: "regulier" },
    "Abu Dhabi":   { mois: 12.0, statut: "pilier" }
  };
  /* Le calendrier de référence (24 Grands Prix, 6 sprints). */
  var F1_BASE = Object.keys(F1).filter(function (n) { return F1[n].statut !== "candidat"; });
  var F1_SPRINTS = ["Shanghai", "Miami", "Montréal", "Silverstone", "Zandvoort", "Singapore"];
  var F1_SPRINT_EXCLUS = { "Monaco": 1 };

  /* F2 / F3 : leurs circuits préférés parmi ceux de la F1 de la saison. */
  var F2_PREF = ["Melbourne", "Bahrain", "Jeddah", "Imola", "Monaco", "Barcelone", "Madrid", "Spielberg", "Silverstone", "Spa", "Budapest", "Monza", "Baku", "Qatar", "Abu Dhabi", "Zandvoort"];
  var F3_PREF = ["Melbourne", "Bahrain", "Imola", "Monaco", "Barcelone", "Madrid", "Spielberg", "Silverstone", "Spa", "Budapest", "Monza", "Zandvoort"];

  /* IndyCar et WEC : épreuves fixes et rotation possible. */
  var ROTATIONS = {
    "IndyCar": {
      ordre: ["St. Petersburg", "Texas", "Long Beach", "Indianapolis 500", "Detroit", "Road America", "Iowa", "Nashville", "Portland", "Laguna Seca", "Gateway", "Milwaukee"],
      fixes: { "St. Petersburg": 1, "Long Beach": 1, "Indianapolis 500": 1, "Detroit": 1, "Road America": 1, "Laguna Seca": 1 },
      mini: 11, maxi: 12, proba: 0.2
    },
    "Endurance WEC": {
      ordre: ["Sebring 12h", "Portimao 6h", "Imola 6h", "Spa 6h", "24h Le Mans", "Sao Paulo 6h", "Monza 6h", "Austin 6h", "Fuji 6h", "Bahrain 8h"],
      base: ["Sebring 12h", "Portimao 6h", "Spa 6h", "24h Le Mans", "Sao Paulo 6h", "Monza 6h", "Fuji 6h", "Bahrain 8h"],
      fixes: { "Spa 6h": 1, "24h Le Mans": 1, "Fuji 6h": 1, "Bahrain 8h": 1 },
      mini: 8, maxi: 8, proba: 0.25
    }
  };

  /* --- Hasard reproductible ---------------------------------------------- */
  function hache(t) { var h = 2166136261; t = String(t); for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function alea(graine) {
    var a = graine >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function graine() {
    if (typeof G === "undefined" || !G) return 1;
    if (!G._calGraine) G._calGraine = (Math.random() * 4294967296) >>> 0;
    return G._calGraine;
  }
  function melanger(l, rnd) { l = l.slice(); for (var i = l.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = l[i]; l[i] = l[j]; l[j] = t; } return l; }

  /* --- F1 : une saison à partir de la précédente ------------------------- */
  function evoluerF1(prec, rnd) {
    var courses = prec.courses.slice(), arrivees = [], departs = [];
    /* De temps en temps seulement : une saison sur trois environ, le plus
       souvent un circuit qui part et un autre qui arrive (ou revient). */
    var nbDeparts = 0, nbArrivees = 0;
    if (rnd() < 0.35) {
      // une manche gagnée ou perdue, ou un échange ; aux bornes (20 et 26), le calendrier revient vers le milieu
      var n0 = courses.length, pAjout = n0 <= 20 ? 0.75 : n0 >= 26 ? 0.03 : 0.34, pRetrait = n0 >= 26 ? 0.75 : n0 <= 20 ? 0.03 : 0.34;
      var genre = rnd();
      if (genre < pAjout) nbArrivees = 1;
      else if (genre < pAjout + pRetrait) nbDeparts = 1;
      else { nbDeparts = 1; nbArrivees = 1; }
      if (rnd() < 0.12) { nbDeparts++; nbArrivees++; }           // une saison de grands changements
    }
    melanger(courses.filter(function (n) { return F1[n] && F1[n].statut !== "pilier"; }), rnd).slice(0, nbDeparts)
      .forEach(function (n) { courses.splice(courses.indexOf(n), 1); departs.push(n); });
    melanger(Object.keys(F1).filter(function (n) { return courses.indexOf(n) < 0 && departs.indexOf(n) < 0; }), rnd).slice(0, nbArrivees)
      .forEach(function (n) { courses.push(n); arrivees.push(n); });
    // 20 à 26 Grands Prix
    var dispo = melanger(Object.keys(F1).filter(function (n) { return courses.indexOf(n) < 0; }), rnd);
    while (courses.length < 20 && dispo.length) { var a = dispo.shift(); courses.push(a); arrivees.push(a); }
    var partants = melanger(courses.filter(function (n) { return F1[n].statut !== "pilier"; }), rnd);
    while (courses.length > 26 && partants.length) { var d = partants.shift(); courses.splice(courses.indexOf(d), 1); departs.push(d); }
    courses.sort(function (x, y) { return F1[x].mois - F1[y].mois; });
    // sprints : 6 à 12, la plupart reconduits
    /* Le nombre de sprints bouge d'une unité certaines saisons, entre 6 et 12. */
    var nbS = prec.sprints.length, cible = nbS;
    if (rnd() < 0.35) {
      var monte = nbS <= 6 ? 0.85 : nbS >= 12 ? 0.1 : 0.55;
      cible = Math.max(6, Math.min(12, nbS + (rnd() < monte ? 1 : -1)));
    }
    var sprints = prec.sprints.filter(function (n) { return courses.indexOf(n) >= 0 && rnd() < 0.92; });
    var candidats = melanger(courses.filter(function (n) { return !F1_SPRINT_EXCLUS[n] && sprints.indexOf(n) < 0; }), rnd);
    while (sprints.length < cible && candidats.length) sprints.push(candidats.shift());
    while (sprints.length > cible) sprints.splice(Math.floor(rnd() * sprints.length), 1);
    sprints.sort(function (x, y) { return F1[x].mois - F1[y].mois; });
    return { courses: courses, sprints: sprints, arrivees: arrivees, departs: departs };
  }

  var cache = {};
  function departEvolution() { return (typeof G !== "undefined" && G && typeof G._calDepart === "number") ? G._calDepart : null; }

  /* Le calendrier de F1 d'une saison : rejoué depuis la saison de départ. */
  function planF1(saison) {
    var dep = departEvolution(); if (dep === null || saison < dep) return null;
    var cle = graine() + ":" + dep + ":" + saison;
    if (cache[cle]) return cache[cle];
    var p = { courses: F1_BASE.slice(), sprints: F1_SPRINTS.slice(), arrivees: [], departs: [] };
    for (var s = dep + 1; s <= saison; s++) p = evoluerF1(p, alea(hache(graine() + "|F1|" + s)));
    return (cache[cle] = p);
  }

  function planSupport(cat, saison) {
    var f1 = planF1(saison); if (!f1) return null;
    var pref = cat === "Formule 2" ? F2_PREF : F3_PREF, nb = cat === "Formule 2" ? 12 : 10;
    var courses = pref.filter(function (n) { return f1.courses.indexOf(n) >= 0; }).slice(0, nb);
    courses.sort(function (x, y) { return F1[x].mois - F1[y].mois; });
    if (cat === "Formule 3") courses.push("Macao GP");   // hors championnat, toujours en fin de saison
    return { courses: courses, sprints: null };
  }

  function planRotation(cat, saison) {
    var dep = departEvolution(); if (dep === null || saison < dep) return null;
    var R = ROTATIONS[cat], cle = cat + ":" + graine() + ":" + dep + ":" + saison;
    if (cache[cle]) return cache[cle];
    var courses = (R.base || R.ordre).slice();
    for (var s = dep + 1; s <= saison; s++) {
      var rnd = alea(hache(graine() + "|" + cat + "|" + s));
      if (rnd() >= R.proba) continue;
      var sortants = courses.filter(function (n) { return !R.fixes[n]; });
      var entrants = R.ordre.filter(function (n) { return courses.indexOf(n) < 0; });
      if (courses.length > R.mini && sortants.length && (rnd() < 0.5 || !entrants.length)) courses.splice(courses.indexOf(sortants[Math.floor(rnd() * sortants.length)]), 1);
      else if (entrants.length && courses.length < R.maxi) courses.push(entrants[Math.floor(rnd() * entrants.length)]);
      else if (entrants.length && sortants.length) { courses.splice(courses.indexOf(sortants[Math.floor(rnd() * sortants.length)]), 1); courses.push(entrants[Math.floor(rnd() * entrants.length)]); }
      courses.sort(function (x, y) { return R.ordre.indexOf(x) - R.ordre.indexOf(y); });
    }
    return (cache[cle] = { courses: courses, sprints: null });
  }

  /* Semaines : réparties de la 3e à la 46e, toujours croissantes. */
  function semaines(n) {
    var l = [];
    for (var i = 0; i < n; i++) l.push(n > 1 ? Math.round(3 + i * (43 / (n - 1))) : 3);
    for (var k = 1; k < l.length; k++) if (l[k] <= l[k - 1]) l[k] = l[k - 1] + 1;
    return l;
  }

  function plan(cat, saison) {
    var p = null;
    if (cat === "Formule 1") p = planF1(saison);
    else if (cat === "Formule 2" || cat === "Formule 3") p = planSupport(cat, saison);
    else if (ROTATIONS[cat]) p = planRotation(cat, saison);
    if (!p) return null;
    return { courses: p.courses.slice(), semaines: semaines(p.courses.length), sprints: p.sprints ? p.sprints.slice() : null,
             arrivees: (p.arrivees || []).slice(), departs: (p.departs || []).slice() };
  }

  /* Ce qui change entre deux saisons, pour l'annonce. */
  function changements(cat, saison) {
    var a = plan(cat, saison - 1), b = plan(cat, saison);
    if (!b) return null;
    var avant = a ? a.courses : null;
    if (!avant) return null;
    return { arrivees: b.courses.filter(function (n) { return avant.indexOf(n) < 0; }),
             departs: avant.filter(function (n) { return b.courses.indexOf(n) < 0; }),
             nb: b.courses.length, sprints: b.sprints ? b.sprints.length : null, sprintsAvant: a.sprints ? a.sprints.length : null };
  }

  function annoncer() {
    if (typeof G === "undefined" || !G || typeof pushMail !== "function") return;
    var ch = changements(G.cat, G.saison);
    if (!ch || (!ch.arrivees.length && !ch.departs.length && ch.sprints === ch.sprintsAvant)) return;
    var nom = function (n) { try { var c = typeof _getCircuitCountry === "function" ? _getCircuitCountry(n) : null; return c && c.name ? n + " (" + c.name + ")" : n; } catch (e) { return n; } };
    var lignes = [];
    if (ch.arrivees.length) lignes.push("Arrivée" + (ch.arrivees.length > 1 ? "s" : "") + " : " + ch.arrivees.map(nom).join(", ") + ".");
    if (ch.departs.length) lignes.push("Départ" + (ch.departs.length > 1 ? "s" : "") + " : " + ch.departs.map(nom).join(", ") + ".");
    lignes.push(ch.nb + " manches au programme" + (ch.sprints ? ", dont " + ch.sprints + " week-ends sprint" : "") + ".");
    try {
      pushMail({ from: "Direction de course — " + G.cat, role: "media", subject: "Le calendrier de la saison " + G.saison,
        body: "Le calendrier de la saison est publié.\n\n" + lignes.join("\n"),
        actions: [{ label: "Noté", kind: "dismiss", responseBody: "Merci." }] });
    } catch (e) {}
  }

  /* Une carrière qui commence : l'évolution part de sa première saison. */
  function demarrer() { if (typeof G !== "undefined" && G && typeof G._calDepart !== "number") G._calDepart = G.saison || 1; }

  function installer() {
    if (typeof rjInscrire !== "function" || !Array.isArray(window.RJ_SAVE_HOOKS) || typeof window.launchGame !== "function") return false;
    if (!window.RJ_SAVE_HOOKS.some(function (h) { return h && h.cle === "rj137"; })) {
      window.RJ_SAVE_HOOKS.push({ cle: "rj137",
        ecrire: function () { return { graine: G._calGraine || null, depart: typeof G._calDepart === "number" ? G._calDepart : null }; },
        lire: function (bloc, G_) {
          if (bloc && bloc.graine) G_._calGraine = bloc.graine;
          if (bloc && typeof bloc.depart === "number") G_._calDepart = bloc.depart;
          else G_._calDepart = (G_.saison || 1) + 1;     // partie antérieure : la saison en cours garde son calendrier
        } });
    }
    rjInscrire("launchGame", { id: "137-calendriers:depart", apres: function () {
      try { demarrer(); window.CAL_RACES = []; buildCalendar(); } catch (e) { console.warn(TAG, e && e.message); }
    } });
    if (!Array.isArray(window.RJ_SEASON_HOOKS)) window.RJ_SEASON_HOOKS = [];
    if (!window.RJ_SEASON_HOOKS.some(function (h) { return h && h.id === "137-calendriers"; })) {
      window.RJ_SEASON_HOOKS.push({ id: "137-calendriers",
        avant: function () { if (typeof G !== "undefined" && G && typeof G._calDepart !== "number") G._calDepart = (G.saison || 1) + 1; },
        apres: function () { try { annoncer(); } catch (e) {} } });
    }
    return true;
  }

  window.RJCalendrier = { plan: plan, changements: changements, F1: F1, semaines: semaines };
  window._rj137Uninstall = function () {
    if (typeof rjDesinscrire === "function") rjDesinscrire(["137-calendriers"], "launchGame");
    window.RJ_SAVE_HOOKS = (window.RJ_SAVE_HOOKS || []).filter(function (h) { return !(h && h.cle === "rj137"); });
    window.RJ_SEASON_HOOKS = (window.RJ_SEASON_HOOKS || []).filter(function (h) { return !(h && h.id === "137-calendriers"); });
    delete window.RJCalendrier;
  };

  var essais = 0;
  (function boot() {
    if (installer()) { console.log(TAG, "actif"); return; }
    if (essais++ < 80) setTimeout(boot, 120);
  })();
})();
