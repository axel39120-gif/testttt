/* =====================================================================
 * 113-mercato.js — LE MERCATO SE VOIT
 *
 * POURQUOI
 * Le plateau vivait déjà : retraites, promotions, descentes de F1, nouvelles
 * recrues en karting (_handleDriverMovements, 05), écuries qui montent ou
 * chutent, nouveaux règlements (initTeamRatings, 04). Mais tout se passait
 * hors de la vue du joueur : le paddock semblait figé.
 *
 * CE QUE LE MODULE AJOUTE
 *   - RUMEURS : aux deux tiers de la saison, le paddock parle — vétérans de
 *     F1 qui pourraient raccrocher, espoirs de F2 pressentis en F1, et le
 *     nom du joueur s'il brille dans une formule de promotion.
 *   - INTERSAISON : en fin de saison, le relevé de tous les mouvements du
 *     plateau ; chaque rumeur y est confirmée ou démentie. Au début de la
 *     saison suivante, les arrivées et transferts sur la grille du joueur,
 *     et le nouveau règlement s'il rebat la hiérarchie.
 *   - un onglet « Mercato » au Championnat, et une notification à chaque
 *     temps fort.
 * Données : G._mercato (sauvegardé, bloc « mercato »).
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[113-mercato]";
  var SEUIL_RUMEURS = 0.6;     // part de la saison courue avant les rumeurs
  var GARDE = 3;               // intersaisons conservées
  var NIVEAU = {
    "Karting Junior": 0, "Karting Senior": 1, "Formule 4": 2, "Formula Regional": 3,
    "Formule 3": 4, "Formule 2": 5, "Super Formula": 5, "Endurance WEC": 5, "IndyCar": 5, "Formule 1": 6
  };
  var SUIVANTE = { "Formule 4": "Formula Regional", "Formula Regional": "Formule 3", "Formule 3": "Formule 2", "Formule 2": "Formule 1" };

  function m() {
    if (!G._mercato) G._mercato = { rumeurs: [], intersaisons: [] };
    return G._mercato;
  }
  function pool() { return G.driverPool || {}; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function prevenir(titre, texte) { if (typeof pushHomeToast === "function") pushHomeToast(titre, texte, "#A78BFA"); }

  /* --- Rumeurs ----------------------------------------------------------- */
  function rumeurs() {
    var M = m(), total = (typeof CAL_RACES !== "undefined" && CAL_RACES.length) || 10;
    if ((G.races || []).length < Math.ceil(total * SEUIL_RUMEURS)) return;
    if (M.rumeurs.some(function (r) { return r.saison === G.saison; })) return;
    var P = pool(), actifs = Object.keys(P).map(function (cle) { return P[cle] && Object.assign({}, P[cle], { id: cle }); })
      .filter(function (d) { return d && !d.retired; });   // la clé du plateau fait foi, pas le champ id
    var nouvelles = [];

    actifs.filter(function (d) { return d.cat === "Formule 1" && d.age >= 34; })
      .sort(function (a, b) { return b.age - a.age; }).slice(0, 2)
      .forEach(function (d) {
        nouvelles.push({ type: "retraite", id: d.id, nom: d.name,
          texte: d.name + " (" + d.age + " ans) songerait à raccrocher à la fin de la saison." });
      });
    actifs.filter(function (d) { return d.cat === "Formule 2"; })
      .sort(function (a, b) { return (b.skill + (b.potential || 0)) - (a.skill + (a.potential || 0)); }).slice(0, 2)
      .forEach(function (d) {
        nouvelles.push({ type: "promotion", id: d.id, nom: d.name, cible: "Formule 1",
          texte: d.name + " serait pressenti pour un baquet de F1 la saison prochaine." });
      });
    var suivante = SUIVANTE[G.cat];
    if (suivante && G.champPos >= 1 && G.champPos <= 3) {
      nouvelles.push({ type: "joueur", cible: suivante, nom: "",
        texte: "Ton nom circule : des écuries de " + suivante + " suivent tes résultats de près." });
    }
    nouvelles.forEach(function (r) { r.saison = G.saison; r.statut = "rumeur"; M.rumeurs.push(r); });
    M.rumeurs = M.rumeurs.filter(function (r) { return r.saison >= G.saison - 2; });
    if (nouvelles.length) prevenir("Le mercato s'agite", nouvelles.length + " rumeur(s) dans le paddock — Championnat › Mercato.");
  }

  /* --- Intersaison : avant et après les mouvements du plateau ------------ */
  var avant = null;

  function photo() {
    var P = pool(), cliche = {}, equipes = {};
    Object.keys(P).forEach(function (id) { var d = P[id]; cliche[id] = { cat: d.cat, retired: !!d.retired }; });
    (G.rivals || []).forEach(function (r) { if (r && r._poolId && r.team) equipes[r._poolId] = r.team; });
    avant = { cliche: cliche, equipes: equipes, cat: G.cat };
  }

  function releve() {
    if (!avant) return;
    var P = pool(), M = m();
    var bilan = { saison: G.saison, retraites: [], promotions: [], descentes: [], lateraux: [], recrues: 0, transferts: [], arrivees: [], reglement: null };
    Object.keys(P).forEach(function (id) {
      var d = P[id], a = avant.cliche[id];
      if (!a) { if (!d.retired) bilan.recrues++; return; }
      if (a.retired) return;
      if (d.retired) { bilan.retraites.push({ id: id, nom: d.name, age: d.age, cat: a.cat }); return; }
      if (d.cat === a.cat) return;
      var mvt = { id: id, nom: d.name, de: a.cat, vers: d.cat };
      var na = NIVEAU[a.cat], nd = NIVEAU[d.cat];
      (nd > na ? bilan.promotions : nd < na ? bilan.descentes : bilan.lateraux).push(mvt);
    });
    M.rumeurs.forEach(function (r) {
      if (r.saison !== G.saison || r.type === "joueur") return;
      var d = P[r.id];
      var vrai = r.type === "retraite" ? !!(d && d.retired) : !!(d && d.cat === r.cible);
      r.statut = vrai ? "confirmée" : "démentie";
    });
    M.intersaisons.unshift(bilan);
    M.intersaisons = M.intersaisons.slice(0, GARDE);
    M._equipesAvant = avant.equipes;
    M._catAvant = avant.cat;
    avant = null;
    prevenir("Intersaison", bilan.retraites.length + " retraite(s), " + bilan.promotions.length +
      " promotion(s) — tout le mercato dans Championnat › Mercato.");
  }

  /* Début de la saison suivante : la nouvelle grille du joueur est connue. */
  function nouvelleGrille() {
    var M = m(), bilan = M.intersaisons[0];
    if (!bilan || bilan.saison !== G.saison - 1 || !M._equipesAvant) return;
    var avantEq = M._equipesAvant;
    (G.rivals || []).forEach(function (r) {
      if (!r || !r._poolId || !r.team) return;
      var ancienne = avantEq[r._poolId];
      if (ancienne && ancienne !== r.team && M._catAvant === G.cat) bilan.transferts.push({ nom: r.name, de: ancienne, vers: r.team });
      var promu = bilan.promotions.concat(bilan.descentes, bilan.lateraux).find(function (x) { return x.id === r._poolId; });
      if (promu && promu.vers === G.cat) bilan.arrivees.push({ nom: r.name, de: promu.de, equipe: r.team });
    });
    if (typeof TEAM_RATINGS !== "undefined" && TEAM_RATINGS[G.cat + "_" + G.saison + "_reset"]) bilan.reglement = G.cat;
    M.rumeurs.forEach(function (r) {
      if (r.type === "joueur" && r.saison === bilan.saison) r.statut = G.cat === r.cible ? "confirmée" : "démentie";
    });
    delete M._equipesAvant; delete M._catAvant;
    if (bilan.reglement) prevenir("Nouveau règlement", "La hiérarchie de " + G.cat + " est rebattue cette saison.");
  }

  /* --- Onglet Championnat › Mercato --------------------------------------- */
  function liste(titre, items, rendu, max) {
    if (!items.length) return "";
    max = max || 10;
    return '<div class="rj113-bloc"><div class="rj113-titre">' + titre + " · " + items.length + "</div>" +
      items.slice(0, max).map(function (x) { return '<div class="rj113-ligne">' + rendu(x) + "</div>"; }).join("") +
      (items.length > max ? '<div class="rj113-plus">+ ' + (items.length - max) + " autre(s)</div>" : "") + "</div>";
  }

  function renderMercato() {
    var p = document.getElementById("cht-mercato");
    if (!p) return;
    var M = m(), html = "";
    var rum = M.rumeurs.filter(function (r) { return r.saison >= G.saison - 1; }).slice().reverse();
    html += liste("Rumeurs du paddock", rum, function (r) {
      return '<span class="rj113-texte">' + esc(r.texte) + '</span><span class="rj113-statut ' +
        (r.statut === "confirmée" ? "ok" : r.statut === "démentie" ? "non" : "") + '">' + esc(r.statut) + "</span>";
    }, 8);
    var b = M.intersaisons[0];
    if (b) {
      html += '<div class="rj113-entete">Intersaison ' + esc(b.saison) + " → " + esc(b.saison + 1) + "</div>";
      if (b.reglement) html += '<div class="rj113-alerte">Nouveau règlement en ' + esc(b.reglement) + " : la hiérarchie des écuries est rebattue.</div>";
      html += liste("Arrivées sur ta grille", b.arrivees, function (x) {
        return "<b>" + esc(x.nom) + "</b> arrive de " + esc(x.de) + (x.equipe ? " chez " + esc(x.equipe) : ""); });
      html += liste("Transferts sur ta grille", b.transferts, function (x) {
        return "<b>" + esc(x.nom) + "</b> quitte " + esc(x.de) + " pour " + esc(x.vers); });
      html += liste("Promotions", b.promotions, function (x) {
        return "<b>" + esc(x.nom) + "</b> passe de " + esc(x.de) + " à " + esc(x.vers); });
      html += liste("Retraites", b.retraites, function (x) {
        return "<b>" + esc(x.nom) + "</b> raccroche à " + esc(x.age) + " ans (" + esc(x.cat) + ")"; });
      html += liste("Descentes", b.descentes, function (x) {
        return "<b>" + esc(x.nom) + "</b> redescend de " + esc(x.de) + " en " + esc(x.vers); });
      html += liste("Changements de série", b.lateraux, function (x) {
        return "<b>" + esc(x.nom) + "</b> quitte " + esc(x.de) + " pour " + esc(x.vers); });
      if (b.recrues) html += '<div class="rj113-bloc"><div class="rj113-titre">Recrues · ' + b.recrues + '</div><div class="rj113-ligne">' +
        b.recrues + " jeunes pilotes font leurs débuts en karting.</div></div>";
    }
    if (!html) html = '<div class="rj113-vide">Le mercato s\'animera aux deux tiers de la saison : premières rumeurs, puis le grand bilan de l\'intersaison.</div>';
    p.innerHTML = html;
  }

  function boot() {
    if (typeof rjInscrire !== "function" || typeof _handleDriverMovements !== "function" ||
        !Array.isArray(window.RJ_SEASON_HOOKS) || !Array.isArray(window.RJ_SAVE_HOOKS)) return setTimeout(boot, 100);
    rjInscrire("_handleDriverMovements", { id: "113-mercato:mouvements", avant: photo, apres: releve });
    if (!window.RJ_SEASON_HOOKS.some(function (h) { return h && h.id === "113-mercato"; }))
      window.RJ_SEASON_HOOKS.push({ id: "113-mercato", apres: nouvelleGrille });
    if (!Array.isArray(window.RACE_POST_HOOKS)) window.RACE_POST_HOOKS = [];
    if (!window.RACE_POST_HOOKS.some(function (h) { return h && h.id === "113-mercato"; }))
      window.RACE_POST_HOOKS.push({ id: "113-mercato", run: function () { try { rumeurs(); } catch (e) { console.warn(TAG, e && e.message); } } });
    if (!window.RJ_SAVE_HOOKS.some(function (h) { return h && h.cle === "mercato"; }))
      window.RJ_SAVE_HOOKS.push({
        cle: "mercato",
        ecrire: function (G) { return G && G._mercato ? G._mercato : null; },
        lire: function (bloc, G) { if (G) G._mercato = bloc && Array.isArray(bloc.rumeurs) ? bloc : null; }
      });
    window.renderMercato = renderMercato;
    window.RJMercato = { rumeurs: rumeurs, rendu: renderMercato };
    window._rj113Uninstall = function () {
      rjDesinscrire(["113-mercato:"]);
      ["RJ_SEASON_HOOKS", "RACE_POST_HOOKS"].forEach(function (r) {
        window[r] = (window[r] || []).filter(function (h) { return !(h && h.id === "113-mercato"); });
      });
      window.RJ_SAVE_HOOKS = window.RJ_SAVE_HOOKS.filter(function (h) { return !(h && h.cle === "mercato"); });
      delete window.RJMercato; delete window.renderMercato;
    };
    console.log(TAG, "actif — rumeurs, intersaison, onglet Championnat › Mercato");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
