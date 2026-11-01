/* =====================================================================
 * 114-heritage.js — LES RÊVES DE CARRIÈRE ET L'HÉRITAGE
 *
 * POURQUOI
 * Les accomplissements comptent ce qui est fait (victoires, poles, titres).
 * Rien ne disait ce que le joueur VEUT faire de sa carrière : un pilote vise
 * le titre mondial, un autre la Triple Couronne (Monaco, Indianapolis,
 * Le Mans), qui oblige à passer par l'IndyCar et l'endurance.
 *
 * CE QUE LE MODULE AJOUTE (onglet Héritage du pilote)
 *   - RÊVES : jusqu'à trois à la fois, choisis dans un catalogue ; leur
 *     progression se calcule sur l'historique de carrière. Un rêve réalisé
 *     est célébré (bonheur +10) et conservé avec la saison et l'âge.
 *   - FRISE : la carrière saison par saison, avec ses grands moments
 *     (débuts dans une catégorie, première victoire, titres, rêves réalisés).
 * Données : G._reves (sauvegardé, bloc « reves »).
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[114-heritage]";
  var MAX_ACTIFS = 3, F1 = "Formule 1", RECOMPENSE = 10;

  /* --- Ce que l'on mesure sur la carrière ------------------------------ */
  function historique() { return typeof CAREER_HISTORY !== "undefined" && Array.isArray(CAREER_HISTORY) ? CAREER_HISTORY : []; }

  function contexte() {
    var H = historique();
    var enCours = H.some(function (h) { return h.saison === G.saison; });
    var saisons = H.slice();
    if (!enCours) saisons.push({ saison: G.saison, cat: G.cat, pos: null, age: G.age, team: G.currentTeam, raceDetails: G.races || [], enCours: true });
    var courses = [];
    saisons.forEach(function (s) {
      (s.raceDetails || []).forEach(function (c) { courses.push({ circuit: c.circuit, pos: c.pos, cat: s.cat }); });
    });
    var titres = H.filter(function (h) { return h.pos === 1; });
    return { saisons: saisons, courses: courses, titres: titres };
  }

  function victoires(ctx, circuit, cat) {
    return ctx.courses.filter(function (c) { return c.pos === 1 && c.circuit === circuit && (!cat || c.cat === cat); }).length;
  }
  function titresEn(ctx, cat) { return ctx.titres.filter(function (t) { return t.cat === cat; }).length; }

  var CATALOGUE = [
    { id: "champion_monde", nom: "Champion du monde", desc: "Remporter le titre en Formule 1.", cible: 1,
      mesure: function (c) { return titresEn(c, F1); } },
    { id: "triple_couronne", nom: "Triple Couronne", desc: "Gagner le Grand Prix de Monaco, l'Indy 500 et les 24 Heures du Mans.", cible: 3,
      mesure: function (c) {
        return (victoires(c, "Monaco", F1) ? 1 : 0) + (victoires(c, "Indianapolis 500") ? 1 : 0) + (victoires(c, "24h Le Mans") ? 1 : 0);
      } },
    { id: "roi_monaco", nom: "Roi de Monaco", desc: "Trois victoires au Grand Prix de Monaco.", cible: 3,
      mesure: function (c) { return victoires(c, "Monaco", F1); } },
    { id: "legende_endurance", nom: "Légende de l'endurance", desc: "Trois victoires aux 24 Heures du Mans.", cible: 3,
      mesure: function (c) { return victoires(c, "24h Le Mans"); } },
    { id: "couronne_partout", nom: "Couronné partout", desc: "Être champion dans trois catégories différentes.", cible: 3,
      mesure: function (c) {
        var cats = {}; c.titres.forEach(function (t) { cats[t.cat] = true; }); return Object.keys(cats).length;
      } },
    { id: "prodige", nom: "Le prodige", desc: "Être champion de Formule 1 avant 25 ans.", cible: 1,
      mesure: function (c) { return c.titres.some(function (t) { return t.cat === F1 && t.age < 25; }) ? 1 : 0; } },
    { id: "fidelite", nom: "Une vie, une écurie", desc: "Huit saisons sous les couleurs de la même écurie.", cible: 8,
      mesure: function (c) {
        var n = {}, best = 0;
        historique().forEach(function (h) {
          if (!h.team || h.team === "Indépendant") return;
          n[h.team] = (n[h.team] || 0) + 1; best = Math.max(best, n[h.team]);
        });
        return best;
      } },
    { id: "dynastie", nom: "Dynastie", desc: "Quatre titres de champion du monde de Formule 1.", cible: 4,
      mesure: function (c) { return titresEn(c, F1); } }
  ];
  function reve(id) { return CATALOGUE.filter(function (r) { return r.id === id; })[0]; }

  /* --- État et actions ------------------------------------------------- */
  function etat() {
    if (!G._reves) G._reves = { actifs: [], accomplis: [] };
    return G._reves;
  }
  function actifs() { return etat().actifs.slice(); }
  function accompli(id) { return etat().accomplis.some(function (a) { return a.id === id; }); }

  function progression(id, ctx) {
    var r = reve(id); if (!r) return null;
    var v = Math.min(r.cible, r.mesure(ctx || contexte()));
    return { actuel: v, cible: r.cible };
  }

  function choisir(id) {
    var E = etat();
    if (!reve(id) || accompli(id) || E.actifs.indexOf(id) >= 0 || E.actifs.length >= MAX_ACTIFS) return false;
    E.actifs.push(id);
    verifier();
    rendre();
    return true;
  }
  function abandonner(id) {
    var E = etat();
    E.actifs = E.actifs.filter(function (x) { return x !== id; });
    rendre();
  }

  function verifier() {
    var E = etat(), ctx = contexte();
    E.actifs.slice().forEach(function (id) {
      var p = progression(id, ctx);
      if (!p || p.actuel < p.cible || accompli(id)) return;
      E.accomplis.push({ id: id, saison: G.saison, age: G.age });
      E.actifs = E.actifs.filter(function (x) { return x !== id; });
      G.happiness = Math.min(100, (G.happiness || 50) + RECOMPENSE);
      if (typeof pushHomeToast === "function")
        pushHomeToast("Rêve réalisé : " + reve(id).nom, reve(id).desc + " Saison " + G.saison + ", à " + G.age + " ans.", "#F59E0B");
    });
  }

  /* --- Onglet Héritage ---------------------------------------------------- */
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function carteReve(r, ctx, actif) {
    var p = progression(r.id, ctx), part = Math.round(p.actuel / p.cible * 100);
    return '<div class="rj114-reve' + (actif ? "" : " libre") + '">' +
      '<div class="rj114-reve-tete"><b>' + esc(r.nom) + '</b><span>' + p.actuel + " / " + p.cible + "</span></div>" +
      '<div class="rj114-reve-desc">' + esc(r.desc) + "</div>" +
      '<div class="rj114-barre"><span style="width:' + part + '%"></span></div>' +
      (actif ? '<button class="rj114-lien" onclick="RJHeritage.abandonner(\'' + r.id + '\')">Abandonner ce rêve</button>'
             : '<button class="rj114-choisir" onclick="RJHeritage.choisir(\'' + r.id + '\')">Poursuivre ce rêve</button>') +
      "</div>";
  }

  function frise(ctx) {
    var vues = {}, premiereVictoire = false, accomplis = etat().accomplis;
    return ctx.saisons.slice().sort(function (a, b) { return a.saison - b.saison; }).map(function (s) {
      var marques = [];
      if (!vues[s.cat]) { vues[s.cat] = true; marques.push("Débuts en " + s.cat); }
      var gagne = (s.raceDetails || []).some(function (c) { return c.pos === 1; }) || s.wins > 0;
      if (gagne && !premiereVictoire) { premiereVictoire = true; marques.push("Première victoire"); }
      if (s.pos === 1 && !s.enCours) marques.push("Champion " + s.cat);
      accomplis.filter(function (a) { return a.saison === s.saison; })
        .forEach(function (a) { marques.push("Rêve : " + reve(a.id).nom); });
      return '<div class="rj114-saison' + (s.pos === 1 && !s.enCours ? " titre" : "") + '">' +
        '<span class="rj114-annee">S' + esc(s.saison) + "</span>" +
        '<div class="rj114-detail"><div><b>' + esc(s.cat) + "</b> · " + esc(s.team || "Indépendant") +
          (s.enCours ? " · en cours" : s.pos ? " · P" + esc(s.pos) : "") + (s.age ? " · " + esc(s.age) + " ans" : "") + "</div>" +
          (marques.length ? '<div class="rj114-marques">' + marques.map(function (m) { return "<span>" + esc(m) + "</span>"; }).join("") + "</div>" : "") +
        "</div></div>";
    }).join("");
  }

  function rendre() {
    var p = document.getElementById("pt-heritage");
    if (!p || p.style.display === "none") return;
    var E = etat(), ctx = contexte();
    var libres = CATALOGUE.filter(function (r) { return E.actifs.indexOf(r.id) < 0 && !accompli(r.id); });
    var html = '<div class="rj114-bloc"><div class="rj114-titre">Tes rêves · ' + E.actifs.length + " / " + MAX_ACTIFS + "</div>" +
      (E.actifs.length ? E.actifs.map(function (id) { return carteReve(reve(id), ctx, true); }).join("")
                       : '<div class="rj114-vide">Choisis ce que tu veux accomplir : ta carrière prendra une direction.</div>') + "</div>";
    if (E.actifs.length < MAX_ACTIFS && libres.length)
      html += '<div class="rj114-bloc"><div class="rj114-titre">Rêves à poursuivre</div>' +
        libres.map(function (r) { return carteReve(r, ctx, false); }).join("") + "</div>";
    if (E.accomplis.length)
      html += '<div class="rj114-bloc"><div class="rj114-titre">Rêves réalisés · ' + E.accomplis.length + "</div>" +
        E.accomplis.map(function (a) {
          var r = reve(a.id);
          return '<div class="rj114-reve accompli"><div class="rj114-reve-tete"><b>' + esc(r.nom) + "</b><span>Saison " +
            esc(a.saison) + " · " + esc(a.age) + ' ans</span></div><div class="rj114-reve-desc">' + esc(r.desc) + "</div></div>";
        }).join("") + "</div>";
    html += '<div class="rj114-bloc rj114-frise"><div class="rj114-titre">Ta carrière</div>' + frise(ctx) + "</div>";
    p.innerHTML = html;
  }

  function boot() {
    if (typeof rjInscrire !== "function" || typeof ptab !== "function" || !Array.isArray(window.RJ_SAVE_HOOKS)) return setTimeout(boot, 100);
    rjInscrire("saveSeasonToHistory", { id: "114-heritage:saveSeasonToHistory", apres: function () { verifier(); } });
    if (!Array.isArray(window.RACE_POST_HOOKS)) window.RACE_POST_HOOKS = [];
    if (!window.RACE_POST_HOOKS.some(function (h) { return h && h.id === "114-heritage"; }))
      window.RACE_POST_HOOKS.push({ id: "114-heritage", run: function () { try { verifier(); } catch (e) { console.warn(TAG, e && e.message); } } });
    if (!window.RJ_SAVE_HOOKS.some(function (h) { return h && h.cle === "reves"; }))
      window.RJ_SAVE_HOOKS.push({
        cle: "reves",
        ecrire: function (G) { return G && G._reves ? G._reves : null; },
        lire: function (bloc, G) { if (G) G._reves = bloc && Array.isArray(bloc.actifs) ? bloc : null; }
      });
    window.renderHeritage = rendre;
    window.RJHeritage = {
      catalogue: function () { return CATALOGUE.map(function (r) { return { id: r.id, nom: r.nom, desc: r.desc, cible: r.cible }; }); },
      actifs: actifs, progression: progression, choisir: choisir, abandonner: abandonner, verifier: verifier
    };
    window._rj114Uninstall = function () {
      rjDesinscrire(["114-heritage:"]);
      window.RACE_POST_HOOKS = window.RACE_POST_HOOKS.filter(function (h) { return !(h && h.id === "114-heritage"); });
      window.RJ_SAVE_HOOKS = window.RJ_SAVE_HOOKS.filter(function (h) { return !(h && h.cle === "reves"); });
      delete window.RJHeritage; delete window.renderHeritage;
    };
    console.log(TAG, "actif — " + CATALOGUE.length + " rêves de carrière, frise dans l'onglet Héritage");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
