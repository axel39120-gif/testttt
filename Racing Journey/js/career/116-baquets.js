/* =====================================================================
 * 116-baquets.js — UN BAQUET SE GAGNE, ET SE FINANCE
 *
 * POURQUOI
 * Un bon pilote recevait des offres presque à coup sûr. En vrai, peu de
 * baquets se libèrent chaque année, plusieurs pilotes les visent, et l'argent
 * pèse autant que le chrono : les petites écuries prennent souvent celui qui
 * apporte le budget.
 *
 * RÈGLES
 *   - PLACES : à chaque saison, un nombre limité de baquets se libère par
 *     catégorie (F1 : 2 à 4), plus souvent chez les petites écuries, deux au
 *     plus par écurie.
 *   - CONCURRENCE : pour chaque offre que le jeu s'apprête à faire, l'écurie
 *     compare le joueur à des pilotes du plateau (même catégorie et catégorie
 *     inférieure) : talent, argent apporté, image. Ses priorités dépendent de
 *     son rang : les grandes écuries regardent le talent, les petites l'argent.
 *     Le joueur garde l'offre s'il arrive premier ; deuxième, une fois sur trois
 *     (le premier choix signe ailleurs).
 *   - ARGENT : chaque pilote du plateau a un soutien financier, tiré une fois
 *     pour toutes. Celui du joueur : son budget, plus une saison de revenus de
 *     sponsors. Une académie prend en charge le baquet chez ses écuries
 *     partenaires. En F1, en IndyCar et dans les équipes privées du WEC, une
 *     écurie qui regarde l'argent demande un apport.
 *   - PAIEMENT : un baquet payant se règle un tiers à la signature, le reste
 *     chaque semaine pendant huit mois.
 * Renouvellements chez l'écurie actuelle : hors concurrence (ta place est à toi).
 * Données : G._baquets (sauvegardé, bloc « baquets »).
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[116-baquets]";
  var PLACES = {
    "Formule 1": [2, 4], "Formule 2": [8, 14], "Formule 3": [10, 16], "Formula Regional": [12, 20],
    "Formule 4": [12, 20], "Karting Senior": [15, 25], "Super Formula": [3, 6], "Endurance WEC": [6, 12], "IndyCar": [3, 7]
  };
  var SOUTIEN_MEDIAN = {
    "Karting Senior": 50e3, "Formule 4": 250e3, "Formula Regional": 500e3, "Formule 3": 900e3, "Formule 2": 1.8e6,
    "Formule 1": 4e6, "Super Formula": 300e3, "Endurance WEC": 400e3, "IndyCar": 1.5e6
  };
  var VIVIERS = {
    "Formule 1": ["Formule 2"], "Formule 2": ["Formule 3"], "Formule 3": ["Formula Regional"],
    "Formula Regional": ["Formule 4"], "Formule 4": ["Karting Senior"], "Karting Senior": ["Karting Junior"],
    "Super Formula": ["Formule 2", "Formule 3"], "Endurance WEC": ["Formule 2", "Formule 1"], "IndyCar": ["Formule 2", "Formule 1"]
  };
  var CHANCE_DEUXIEME = 1 / 3;
  var ECHEANCES = 32;          // semaines (huit mois)

  function etat() {
    if (!G._baquets || G._baquets.saison !== G.saison) G._baquets = { saison: G.saison, places: {}, perdus: [], echeancier: (G._baquets && G._baquets.echeancier) || null };
    return G._baquets;
  }
  function equipes(cat) {
    return (typeof TEAM_OFFERS !== "undefined" && TEAM_OFFERS[cat] || []).slice()
      .sort(function (a, b) { return (b.repReq || 0) - (a.repReq || 0); });
  }
  /* 1 = l'écurie la plus huppée de la catégorie, 0 = la plus modeste. */
  function rang(cat, equipe) {
    var L = equipes(cat), i = L.map(function (o) { return o.team; }).indexOf(equipe);
    return i < 0 || L.length < 2 ? 0.5 : 1 - i / (L.length - 1);
  }

  /* --- Places libres ----------------------------------------------------- */
  function places(cat) {
    var E = etat();
    if (E.places[cat]) return E.places[cat];
    var L = equipes(cat), plan = {}, borne = PLACES[cat] || [4, 8];
    var n = Math.min(L.length * 2, borne[0] + Math.floor(Math.random() * (borne[1] - borne[0] + 1)));
    for (var k = 0, essais = 0; k < n && essais < 200; essais++) {
      var poids = L.map(function (o) { return (plan[o.team] || 0) >= 2 ? 0 : 1.3 - rang(cat, o.team); });
      var total = poids.reduce(function (a, b) { return a + b; }, 0), tire = Math.random() * total;
      for (var i = 0; i < L.length; i++) { tire -= poids[i]; if (tire <= 0 && poids[i] > 0) { plan[L[i].team] = (plan[L[i].team] || 0) + 1; k++; break; } }
    }
    E.places[cat] = plan;
    return plan;
  }

  /* --- Les candidats ------------------------------------------------------ */
  function soutien(d, cat) {
    if (d._soutien === undefined) {
      // Log-normal autour de la médiane de la catégorie : quelques pilotes très riches.
      var u = Math.max(1e-6, Math.random()), v = Math.random();
      var normal = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      d._soutien = Math.round((SOUTIEN_MEDIAN[d.cat] || SOUTIEN_MEDIAN[cat] || 5e5) * Math.exp(0.9 * normal) / 1e4) * 1e4;
    }
    return d._soutien;
  }

  function apportJoueur() {
    var sponsors = (G.sponsors || []).reduce(function (a, s) { return a + (s.fee || 0); }, 0) * 12;
    return Math.max(0, G.budget || 0) + sponsors;
  }

  function prixPlace(cat, offre) { return offre && offre.cost ? offre.cost : 0; }

  /* Caractère de l'écurie (139) : points ajoutés à la note d'un candidat. */
  function ajC(cat, equipe, c) { return window.RJCaracteres && c ? RJCaracteres.ajustement(cat, equipe, c) : 0; }

  /* Ce que l'écurie regarde, selon son rang et la catégorie. */
  function priorites(cat, equipe, payant) {
    var p = rang(cat, equipe);
    // Baquet payant : même les grandes écuries regardent l'argent, mais misent sur un talent.
    var argent = payant ? 0.12 + 0.33 * (1 - p) : 0.55 * Math.pow(1 - p, 1.5);
    var car = window.RJCaracteres && RJCaracteres.ecurie(equipe, cat);
    if (car) argent = Math.min(0.6, argent * car.argent);
    return { talent: 0.85 - argent, argent: argent, image: 0.15 };
  }

  function classer(cat, equipe, offre) {
    var payant = prixPlace(cat, offre) > 0;
    var besoin = payant ? prixPlace(cat, offre) : (SOUTIEN_MEDIAN[cat] || 1e6) * 2;
    var w = priorites(cat, equipe, payant);
    var note = function (talent, argent, image) {
      // Talent sur une échelle contrastée : de 50 à 95, l'écart entre 78 et 92 doit peser.
      var t = Math.max(0, Math.min(1, (talent - 50) / 45));
      return w.talent * t + w.argent * Math.min(1, argent / besoin) + w.image * image;
    };
    var P = G.driverPool || {}, viviers = [cat].concat(VIVIERS[cat] || []);
    var actifs = Object.keys(P).map(function (k) { return P[k]; })
      .filter(function (d) { return d && !d.retired && viviers.indexOf(d.cat) >= 0 && !(d.team === equipe && d.cat === cat); });
    // Les meilleurs de la catégorie inférieure, et quelques pilotes de la catégorie.
    var monte = actifs.filter(function (d) { return d.cat !== cat; }).sort(function (a, b) { return b.skill - a.skill; }).slice(0, 4);
    var reste = actifs.filter(function (d) { return d.cat === cat; }).sort(function () { return Math.random() - 0.5; }).slice(0, 3);
    var candidats = monte.concat(reste).map(function (d) {
      var argent = soutien(d, cat);
      var rookie = d.cat !== cat;                                  // il arrive de la catégorie inférieure
      return { nom: d.name, talent: d.skill, argent: argent, rookie: rookie, score: note(d.skill + ajC(cat, equipe, { rookie: rookie }), argent, 0.5) };
    });
    var bonusResultats = G.cat === cat || (VIVIERS[cat] || []).indexOf(G.cat) >= 0
      ? (G.champPos === 1 ? 10 : G.champPos === 2 ? 7 : G.champPos === 3 ? 5 : G.champPos <= 5 ? 3 : 0) : 0;
    var talentJoueur = (typeof calcPlayerRating === "function" ? calcPlayerRating() : 60) + bonusResultats;
    var academie = typeof isAcademyAffiliate === "function" && isAcademyAffiliate(equipe, cat);
    var argentJoueur = academie && payant ? besoin : apportJoueur();
    candidats.push({ nom: "joueur", joueur: true, talent: talentJoueur, argent: argentJoueur,
      score: note(talentJoueur + ajC(cat, equipe, window.RJCaracteres && RJCaracteres.joueur(cat, equipe)), argentJoueur, Math.min(1, (G.reputation || 0) / 100)) });
    candidats.sort(function (a, b) { return b.score - a.score; });
    return { priorites: w, besoin: besoin, academie: academie, candidats: candidats,
             rangJoueur: candidats.map(function (c) { return !!c.joueur; }).indexOf(true) + 1 };
  }

  /* --- Les offres du jeu passent par la concurrence ----------------------- */
  function apportDemande(cat, equipe, w) {
    if (cat === "Formule 1" || cat === "IndyCar" || cat === "Super Formula" || cat === "Endurance WEC") {
      if (w.argent < 0.25) return 0;
      return Math.round((SOUTIEN_MEDIAN[cat] || 1e6) * 2 * (w.argent / 0.55) / 1e5) * 1e5;
    }
    return 0;
  }

  function filtrer(offres) {
    var E = etat(), garde = [];
    offres.forEach(function (o) {
      if (!o || o.isRenewalForced || o._academie || (o.team === G.currentTeam && o.cat === G.cat)) { garde.push(o); return; }
      var plan = places(o.cat);
      if (!plan[o.team]) { E.perdus.push({ equipe: o.team, cat: o.cat, raison: "complet" }); return; }
      var c = classer(o.cat, o.team, o);
      var gagne = c.rangJoueur === 1 || (c.rangJoueur === 2 && Math.random() < CHANCE_DEUXIEME);
      var premier = c.candidats.filter(function (x) { return !x.joueur; })[0];
      if (!gagne) {
        E.perdus.push({ equipe: o.team, cat: o.cat, raison: "concurrence", choisi: premier && premier.nom,
          atout: premier && premier.argent >= c.besoin && c.priorites.argent >= 0.3 ? "argent" : "talent", argent: premier && premier.argent,
          motif: window.RJCaracteres ? RJCaracteres.motif(o.cat, o.team, premier) : null });
        return;
      }
      var moi = c.candidats.filter(function (x) { return x.joueur; })[0];
      o._concurrence = { rang: c.rangJoueur, priorites: c.priorites, academie: c.academie,
        marge: premier && moi.score > 0 ? (moi.score - premier.score) / moi.score : 1,   // < 0 : deuxième, sauvé par le désistement du premier
        rival: premier ? { nom: premier.nom, talent: premier.talent, argent: premier.argent } : null,
        adversaires: c.candidats.filter(function (x) { return !x.joueur; }).slice(0, 3)
          .map(function (x) { return { nom: x.nom, talent: x.talent, argent: x.argent }; }) };
      if (c.academie && o.cost > 0) { o._prixAvantAcademie = o.cost; o.cost = 0; }
      // Choisi pour son talent sans en avoir les moyens : l'écurie baisse son prix
      // (grandes écuries 70 %, offert au champion ; milieu de grille 40 % ; petites rien :
      // elles vivent de cet argent).
      else if (o.cost > 0 && apportJoueur() < o.cost) {
        var remise = c.priorites.argent < 0.25 ? (G.champPos === 1 ? 1 : 0.7) : c.priorites.argent < 0.35 ? 0.4 : 0;   // le champion : baquet offert
        if (remise) { o._remiseTalent = Math.round(o.cost * remise / 1e4) * 1e4; o.cost -= o._remiseTalent; }
      }
      var apport = c.academie ? 0 : apportDemande(o.cat, o.team, c.priorites);
      if (apport > 0) { o._apport = apport; o.cost = (o.cost || 0) + apport; }
      plan[o.team]--;
      garde.push(o);
    });
    return garde;
  }

  /* --- Le point de l'agent, deux fois par saison -------------------------- */
  function euros(n) {
    return n >= 1e6 ? (n / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " M€" : Math.round(n / 1e3) + " k€";
  }

  function conseil() {
    var total = (typeof CAL_RACES !== "undefined" && CAL_RACES.length) || 10, faites = (G.races || []).length;
    var vague = faites >= Math.floor(total * 0.8) ? 2 : faites >= Math.floor(total * 0.3) ? 1 : 0;
    var E = etat();
    E.conseils = E.conseils || [];
    if (!vague || E.conseils.indexOf(vague) >= 0 || !G.agent || typeof pushMail !== "function") return null;
    var suivantes = typeof getCatNextOptions === "function" ? getCatNextOptions(G.cat) : [];
    var cible = suivantes.filter(function (c) { return TEAM_OFFERS[c]; })[0] || G.cat;
    var plan = places(cible), libres = Object.keys(plan).filter(function (t) { return plan[t] > 0; });
    if (!libres.length) return null;
    E.conseils.push(vague);

    var rangs = libres.map(function (t) {
      var o = (TEAM_OFFERS[cible] || []).filter(function (x) { return x.team === t; })[0] || {};
      return { equipe: t, prix: o.cost || 0, c: classer(cible, t, o) };
    });
    var premier = rangs.filter(function (r) { return r.c.rangJoueur === 1; });
    var proche = rangs.filter(function (r) { return r.c.rangJoueur === 2; });
    var argent = rangs.filter(function (r) { return r.c.rangJoueur > 1 && r.c.priorites.argent >= 0.3; });
    var prixMin = Math.min.apply(null, rangs.map(function (r) { return r.prix; }).filter(function (p) { return p > 0; }).concat([Infinity]));
    var capacite = apportJoueur();
    var parent = G.agent.type === "parent";

    var lignes = ["<strong>" + libres.length + " baquet(s)</strong> devraient se libérer en " + cible + " pour la saison prochaine."];
    lignes.push(premier.length ? "Tu es aujourd'hui le premier choix chez <strong>" + premier.map(function (r) { return r.equipe; }).join(", ") + "</strong>."
      : proche.length ? "Tu es dans la short-list chez <strong>" + proche.map(function (r) { return r.equipe; }).join(", ") + "</strong>, mais quelqu'un passe encore devant toi."
      : "Pour l'instant, aucune écurie ne te place en tête de sa liste.");
    if (isFinite(prixMin) && capacite < prixMin)
      lignes.push("Le baquet le moins cher coûte <strong>" + euros(prixMin) + "</strong> ; avec ton budget et tes sponsors, tu peux mettre " + euros(capacite) + ". Il manque <strong>" + euros(prixMin - capacite) + "</strong>.");
    if (argent.length)
      lignes.push(argent.length + " écurie(s) regardent surtout l'argent apporté : de nouveaux sponsors changeraient la donne.");
    if (typeof getPlayerAcademy === "function" && !getPlayerAcademy() && ["Formule 4", "Formula Regional", "Formule 3", "Formule 2"].indexOf(G.cat) >= 0)
      lignes.push("Une académie de constructeur prendrait ton baquet en charge chez ses écuries partenaires : ça vaut le coup de candidater.");
    if (cible === "Formule 1" && !premier.length)
      lignes.push("Si la F1 se refuse, l'IndyCar, le WEC ou la Super Formula offrent des volants payés par les usines.");

    return pushMail({
      from: parent ? (G.agent.firstName || (G.agent.parentRole === "mother" ? "Maman" : "Papa")) : (G.agent.name || "Ton agent"),
      role: "agent",
      subject: "Le point sur le marché — " + cible,
      body: (parent ? "Mon grand, j'ai fait le tour des écuries. " : "J'ai fait le tour des écuries. ") + lignes.join("<br><br>"),
      actions: [{ label: "Compris", kind: "dismiss", responseBody: "Merci, je m'organise." }]
    });
  }

  var avant = null;
  function photo() { avant = (G.offers || []).slice(); }
  function apresOffres() {
    if (!avant) return;
    var nouvelles = (G.offers || []).filter(function (o) { return avant.indexOf(o) < 0; });
    var gardees = filtrer(nouvelles);
    G.offers = avant.concat(gardees);
    avant = null;
    try { conseil(); } catch (e) { console.warn(TAG, e && e.message); }
    var perdus = etat().perdus.filter(function (p) { return p.raison === "concurrence" && !p._annonce; });
    var marquant = perdus.sort(function (a, b) { return (b.argent || 0) - (a.argent || 0); })[0];
    if (marquant && typeof pushHomeToast === "function") {
      perdus.forEach(function (p) { p._annonce = true; });
      pushHomeToast("Baquet perdu — " + marquant.equipe, marquant.choisi + " a été préféré" +
        (marquant.atout === "argent" ? ", avec " + (marquant.argent / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " M€ de soutien." : " pour son talent.") +
        (marquant.motif ? " (" + marquant.motif + ".)" : ""), "#F97316");
    }
  }

  /* --- Paiement échelonné du baquet ---------------------------------------- */
  function signer(args, suite) {
    var o = (G.offers || [])[args[0]];          // signContract(numéro de l'offre)
    if (!o || !(o.cost > 0)) return suite();
    var total = o.cCost !== null && o.cCost !== undefined ? o.cCost : o.cost;
    var tiers = Math.round(total / 3), cCost = o.cCost;
    o.cCost = tiers;
    var budgetAvant = G.budget, r;
    try { r = suite(); } finally { o.cCost = cCost; }
    if (G.budget < budgetAvant) {             // la signature a eu lieu
      etat().echeancier = { equipe: o.team, reste: total - tiers, parSemaine: Math.ceil((total - tiers) / ECHEANCES) };
    }
    return r;
  }

  function prelever(r, args) {
    var e = etat().echeancier;
    if (!e || e.reste <= 0) return;
    var semaines = Number(args && args[0]) || 1, du = Math.min(e.reste, e.parSemaine * semaines);
    G.budget -= du; e.reste -= du;
    if (e.reste <= 0) etat().echeancier = null;
  }

  function boot() {
    if (typeof rjInscrire !== "function" || typeof generateTeamOffers !== "function" || typeof signContract !== "function" ||
        typeof applyWeeklyIncome !== "function" || !Array.isArray(window.RJ_SAVE_HOOKS)) return setTimeout(boot, 100);
    rjInscrire("generateTeamOffers", { id: "116-baquets:offres", avant: photo, apres: apresOffres });
    rjInscrire("signContract", { id: "116-baquets:signature", remplace: signer });
    rjInscrire("applyWeeklyIncome", { id: "116-baquets:echeances", apres: prelever });
    if (!window.RJ_SAVE_HOOKS.some(function (h) { return h && h.cle === "baquets"; }))
      window.RJ_SAVE_HOOKS.push({
        cle: "baquets",
        ecrire: function (G) {
          var soutiens = {};
          Object.keys(G.driverPool || {}).forEach(function (k) { if (G.driverPool[k]._soutien !== undefined) soutiens[k] = G.driverPool[k]._soutien; });
          return { etat: G._baquets || null, soutiens: soutiens };
        },
        lire: function (bloc, G) {
          if (!bloc) return;
          G._baquets = bloc.etat || null;
          Object.keys(bloc.soutiens || {}).forEach(function (k) { if (G.driverPool && G.driverPool[k]) G.driverPool[k]._soutien = bloc.soutiens[k]; });
        }
      });
    window.RJBaquets = { places: places, classer: classer, filtrer: filtrer, apportJoueur: apportJoueur, soutien: soutien, etat: etat, conseil: conseil };
    window._rj116Uninstall = function () {
      rjDesinscrire(["116-baquets:"]);
      window.RJ_SAVE_HOOKS = window.RJ_SAVE_HOOKS.filter(function (h) { return !(h && h.cle === "baquets"); });
      delete window.RJBaquets;
    };
    console.log(TAG, "actif — places limitées, concurrence, apport, paiement échelonné");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
