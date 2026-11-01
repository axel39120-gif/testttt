/* =====================================================================
 * 115-economie.js — L'ÉCONOMIE DE LA CARRIÈRE, AUX VRAIS ORDRES DE GRANDEUR
 *
 * POURQUOI
 * Un baquet de F3 coûtait 30 000 à 58 000 €, la F2 était souvent gratuite,
 * un salaire de F1 plafonnait à 600 000 €/an, alors que les sponsors
 * rapportaient jusqu'à 10 M€/an en F2. L'argent ne freinait jamais une
 * carrière. En vrai, les places se paient, et cher.
 *
 * CE FICHIER EST LA SOURCE UNIQUE DES MONTANTS
 *   BAREME      prix des baquets et salaires par catégorie (par saison),
 *               de l'écurie la plus modeste à la plus huppée ; les données
 *               d'écuries (TEAM_OFFERS, 03) en sont tirées une fois pour
 *               toutes (outil : tests/outils/bareme-ecuries.js).
 *   SPONSORS    multiplicateur des cachets mensuels par catégorie (remplace
 *               le 1,7 par échelon de getSponsorPool).
 *   MILIEUX     le milieu familial choisi à la création : budget de départ
 *               et soutien mensuel, tant que la carrière est en karting ou
 *               en formule de promotion (jusqu'à la Formula Regional).
 * Les montants du jeu restent mensuels pour les revenus (salaire, sponsors),
 * le prix d'un baquet se paie à la signature.
 *
 * Les sauvegardes antérieures sont converties au chargement (bloc
 * « economie ») : cachets de sponsors et revenus remis à la nouvelle échelle.
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[115-economie]";
  var VERSION = 1;

  /* Par saison, en euros : [plus modeste, plus huppée]. */
  var BAREME = {
    "Karting Junior":   { baquet: [60e3, 120e3] },
    "Karting Senior":   { baquet: [120e3, 250e3] },
    "Formule 4":        { baquet: [300e3, 450e3] },
    "Formula Regional": { baquet: [600e3, 900e3] },
    "Formule 3":        { baquet: [900e3, 1.4e6] },
    "Formule 2":        { baquet: [1.8e6, 2.8e6] },
    "Formule 1":        { salaire: [1e6, 30e6] },
    "Super Formula":    { salaire: [200e3, 1e6] },
    "Endurance WEC":    { salaire: [300e3, 1.5e6], baquetBas: [200e3, 500e3] },   // usines payées, privés payants
    "IndyCar":          { salaire: [1e6, 3e6], baquetBas: [1e6, 3e6] }
  };

  /* Multiplicateur du cachet mensuel des sponsors (baseFee × multiplicateur),
     calé pour que les trois plus gros sponsors accessibles rapportent à peu
     près : karting 15–50 k€/an, F4 200 k€, FR 300 k€, F3 1 M€, F2 2 M€,
     F1 20 M€, SF 1 M€, WEC 2 M€, IndyCar 5 M€. */
  var SPONSORS = {
    "Karting Junior": 1, "Karting Senior": 1, "Formule 4": 1.6, "Formula Regional": 1.7,
    "Formule 3": 3.3, "Formule 2": 2.7, "Formule 1": 19.3,
    "Super Formula": 4.5, "Endurance WEC": 4.7, "IndyCar": 9.2
  };
  var ANCIEN_TIER = {
    "Karting Junior": 0, "Karting Senior": 1, "Formule 4": 2, "Formula Regional": 3, "Formule 3": 4,
    "Formule 2": 5, "Formule 1": 6, "Super Formula": 5, "Endurance WEC": 5, "IndyCar": 6
  };

  var MILIEUX = {
    modeste: { nom: "Famille modeste", budget: 30e3, mensuel: 2e3,
      desc: "Tes parents se saignent pour le karting. Il faudra vite trouver des sponsors, ou une académie." },
    moyenne: { nom: "Classe moyenne", budget: 120e3, mensuel: 10e3,
      desc: "Assez pour le karting et une saison de F4 avec de l'aide. Ensuite, les sponsors devront prendre le relais." },
    aisee:   { nom: "Famille aisée", budget: 600e3, mensuel: 50e3,
      desc: "Le budget n'est pas un problème au départ. Il faudra quand même prouver que tu mérites ta place." }
  };
  var SOUTIEN_JUSQUA = ["Karting Junior", "Karting Senior", "Formule 4", "Formula Regional"];

  function multSponsor(cat) { return SPONSORS[cat] || 1; }
  function rapportSponsors(cat) { return multSponsor(cat) / Math.pow(1.7, ANCIEN_TIER[cat] || 0); }

  /* --- Sponsors : nouveau multiplicateur -------------------------------- */
  function recalerSponsors(pool) {
    if (!Array.isArray(pool)) return pool;
    var rapport = rapportSponsors(G.cat);   // le cachet arrive déjà calculé à l'ancienne échelle
    pool.forEach(function (s) { if (s && s.fee) s.fee = 100 * Math.round(s.fee * rapport / 100); });
    return pool;
  }

  /* --- Milieu familial --------------------------------------------------- */
  function milieu() { return MILIEUX[G._milieu] || null; }

  function soutienMensuel() {
    var m = milieu();
    return m && SOUTIEN_JUSQUA.indexOf(G.cat) >= 0 ? m.mensuel : 0;
  }

  /* Versé chaque semaine avec les revenus (applyWeeklyIncome(semaines)). */
  function verserSoutien(r, args) {
    var s = soutienMensuel(), semaines = Number(args && args[0]) || 1;
    if (s > 0) G.budget += Math.round(s * semaines / 4);
  }

  function choisirMilieu(el, cle) {
    if (!MILIEUX[cle]) return;
    G._milieuChoisi = cle;
    document.querySelectorAll(".rj115-milieu").forEach(function (o) { o.classList.toggle("sel", o === el); });
  }

  /* Les trois milieux, dans l'étape « origines » de la création. */
  function rendreMilieux() {
    var zone = document.getElementById("rj115-milieux");
    if (!zone) return;
    var choisi = G._milieuChoisi || "moyenne", euro = function (n) { return n.toLocaleString("fr-FR") + " €"; };
    zone.innerHTML = '<div class="rj115-titre">Ton milieu familial</div>' + Object.keys(MILIEUX).map(function (cle) {
      var m = MILIEUX[cle];
      return '<div class="rj115-milieu' + (cle === choisi ? " sel" : "") + '" onclick="RJEconomie.choisirMilieu(this,\'' + cle + '\')">' +
        "<b>" + m.nom + "</b><span>" + euro(m.budget) + " au départ · " + euro(m.mensuel) + " par mois</span><p>" + m.desc + "</p></div>";
    }).join("") + '<div class="rj115-note">Le soutien mensuel dure tant que tu cours en karting ou en formule de promotion (jusqu\'à la Formula Regional).</div>';
  }

  function demarrer() {
    // Mode carrière seulement : le bac à sable fixe son propre budget.
    if (G._gameMode === "sandbox") return;
    var cle = G._milieuChoisi || "moyenne";
    G._milieu = cle;
    G.budget = MILIEUX[cle].budget;
  }

  /* --- Conversion des sauvegardes antérieures --------------------------- */
  function convertir(G) {
    var rapport = rapportSponsors(G.cat);
    var avant = 0, apres = 0;
    (G.sponsors || []).forEach(function (s) {
      avant += s.fee || 0;
      s.fee = 100 * Math.round((s.fee || 0) * rapport / 100);
      apres += s.fee;
    });
    G.revenue = Math.max(0, (G.revenue || 0) - avant + apres);
    if (!G._milieu) G._milieu = "moyenne";
  }

  function boot() {
    if (typeof rjInscrire !== "function" || typeof getSponsorPool !== "function" ||
        typeof applyWeeklyIncome !== "function" || !Array.isArray(window.RJ_SAVE_HOOKS)) return setTimeout(boot, 100);
    rjInscrire("getSponsorPool", { id: "115-economie:sponsors", apres: function (pool) { return recalerSponsors(pool); } });
    rjInscrire("applyWeeklyIncome", { id: "115-economie:soutien", apres: verserSoutien });
    rjInscrire("launchGame", { id: "115-economie:depart", apres: function () { demarrer(); } });   // après le budget de départ du cœur
    if (!window.RJ_SAVE_HOOKS.some(function (h) { return h && h.cle === "economie"; }))
      window.RJ_SAVE_HOOKS.push({
        cle: "economie",
        ecrire: function (G) { return { version: VERSION, milieu: G._milieu || null }; },
        lire: function (bloc, G) {
          if (!bloc || !bloc.version) convertir(G);      // partie d'avant la nouvelle échelle
          else G._milieu = bloc.milieu || G._milieu || null;
        }
      });
    window.RJEconomie = { BAREME: BAREME, SPONSORS: SPONSORS, MILIEUX: MILIEUX, multSponsor: multSponsor,
      soutienMensuel: soutienMensuel, choisirMilieu: choisirMilieu, convertir: convertir };
    rendreMilieux();
    if (typeof creNext === "function") rjInscrire("updateCreUI", { id: "115-economie:creation", apres: function () { rendreMilieux(); } });
    window._rj115Uninstall = function () { rjDesinscrire(["115-economie:"]); };
    console.log(TAG, "actif — barème réel, sponsors recalés, milieu familial");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
