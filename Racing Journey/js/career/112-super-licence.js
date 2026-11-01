/* =====================================================================
 * 112-super-licence.js — LA SUPER LICENCE FIA
 *
 * POURQUOI
 * Rien ne séparait un bon pilote de F3 d'un baquet de F1. En vrai, il faut
 * la Super Licence : 40 points gagnés en championnat sur les trois dernières
 * saisons, et 18 ans. Chaque saison de formule de promotion compte donc.
 *
 * RÈGLES (barème inspiré de celui de la FIA)
 *   - points selon la catégorie et la place finale au championnat ;
 *   - fenêtre : les trois dernières saisons terminées ; une seule catégorie
 *     par saison, la meilleure ;
 *   - 18 ans au volant (à l'intersaison, l'âge de la saison qui vient) ;
 *   - avoir couru en F1 sur la fenêtre garde la licence.
 * Calculé à partir de CAREER_HISTORY : rien de nouveau à sauvegarder.
 *
 * EFFET
 * Sans licence, une écurie de F1 qui veut le joueur ne peut lui proposer
 * qu'un rôle de pilote de réserve (rôle num3, module 14) : toutes les
 * offres passent par buildOffer, c'est là que la règle s'applique.
 *
 * AFFICHAGE : une carte dans l'onglet Carrière du pilote, et une
 * notification au bilan de chaque saison.
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[112-super-licence]";
  var REQUIS = 40, AGE_MIN = 18, FENETRE = 3, F1 = "Formule 1";

  /* Points par place finale (1re, 2e…). */
  var BAREME = {
    "Formule 2":        [40, 40, 40, 30, 20, 10, 8, 6, 4, 3],
    "IndyCar":          [40, 30, 20, 10, 8, 6, 4, 3, 2, 1],
    "Formule 3":        [30, 25, 20, 15, 12, 9, 7, 5, 3, 1],
    "Endurance WEC":    [30, 24, 20, 16, 12, 10, 8, 6, 4, 2],
    "Super Formula":    [25, 20, 15, 10, 8, 6, 4, 3, 2, 1],
    "Formula Regional": [25, 20, 15, 10, 7, 5, 3, 2, 1],
    "Formule 4":        [12, 10, 7, 5, 3, 2, 1],
    "Karting Senior":   [4, 3, 2, 1],
    "Karting Junior":   [3, 2, 1]
  };

  function bareme(cat) { return BAREME[cat] || []; }
  function points(saison) { return (saison && bareme(saison.cat)[saison.pos - 1]) || 0; }

  function historique() { return typeof CAREER_HISTORY !== "undefined" && Array.isArray(CAREER_HISTORY) ? CAREER_HISTORY : []; }

  function etat() {
    var fin = !!G.seasonOver;
    var reference = fin ? G.saison : G.saison - 1;           // dernière saison terminée
    var age = (G.age || 0) + (fin ? 1 : 0);                  // l'âge au volant
    var parSaison = {}, f1 = G.cat === F1 && !fin;
    historique().forEach(function (h) {
      if (h.saison > reference || h.saison <= reference - FENETRE) return;
      if (h.cat === F1) f1 = true;
      var p = points(h);
      if (!parSaison[h.saison] || p > parSaison[h.saison].points)
        parSaison[h.saison] = { saison: h.saison, cat: h.cat, pos: h.pos, points: p };
    });
    var saisons = Object.keys(parSaison).map(function (k) { return parSaison[k]; })
      .sort(function (a, b) { return a.saison - b.saison; });
    var total = saisons.reduce(function (s, x) { return s + x.points; }, 0);
    var ageOk = age >= AGE_MIN;
    return {
      points: total, requis: REQUIS, manque: Math.max(0, REQUIS - total),
      age: age, ageOk: ageOk, retenue: f1,
      eligible: ageOk && (f1 || total >= REQUIS),
      saisons: saisons
    };
  }

  /* --- Offres de F1 : sans licence, rôle de réserviste --------------- */
  function surOffre(args, suite) {
    var o = args[0];
    if (!o || o.cat !== F1 || o.role === "num3" || etat().eligible) return suite();
    var r = suite([Object.assign({}, o, { role: "num3" })]);
    if (r) r._superLicence = true;
    prevenir();
    return r;
  }

  function prevenir() {
    if (G._rj112Avis === G.saison || typeof pushHomeToast !== "function") return;
    G._rj112Avis = G.saison;
    var e = etat();
    pushHomeToast("Super Licence", "Une écurie de F1 s'intéresse à toi, mais sans Super Licence (" +
      e.points + "/" + REQUIS + (e.ageOk ? "" : ", " + AGE_MIN + " ans minimum") +
      ") elle ne peut te proposer qu'un rôle de pilote de réserve.", "#60A5FA");
  }

  /* --- Bilan de saison ------------------------------------------------ */
  function bilan() {
    var h = historique(), derniere = h[h.length - 1];
    if (!derniere || !bareme(derniere.cat).length || typeof pushHomeToast !== "function") return;
    var e = etat(), p = points(derniere);
    pushHomeToast("Super Licence : +" + p + " pts",
      derniere.cat + ", P" + derniere.pos + " au championnat — " + e.points + "/" + REQUIS +
      (e.eligible ? " : licence obtenue." : " sur les trois dernières saisons."), "#60A5FA");
  }

  /* --- Carte dans l'onglet Carrière du pilote ------------------------- */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function carte() {
    var zone = document.getElementById("pt-rep");
    if (!zone) return;
    var c = document.getElementById("rj112-carte");
    if (!c) { c = document.createElement("div"); c.id = "rj112-carte"; c.className = "rj112-carte"; zone.insertBefore(c, zone.firstChild); }
    var e = etat(), part = Math.min(100, Math.round(e.points / REQUIS * 100));
    var statut = e.eligible ? '<span class="rj112-statut ok">Éligible F1</span>'
      : !e.ageOk ? '<span class="rj112-statut">' + AGE_MIN + " ans minimum</span>"
      : '<span class="rj112-statut">Il manque ' + e.manque + " pts</span>";
    var b = bareme(G.cat);
    c.innerHTML =
      '<div class="rj112-tete"><span class="rj112-titre">Super Licence FIA</span>' + statut + "</div>" +
      '<div class="rj112-total"><span class="n">' + e.points + '</span><span class="sur">/ ' + REQUIS + " pts</span>" +
        (e.retenue ? '<span class="rj112-note">licence conservée : tu as couru en F1</span>' : "") + "</div>" +
      '<div class="rj112-barre"><span style="width:' + part + '%"></span></div>' +
      (e.saisons.length ? '<div class="rj112-saisons">' + e.saisons.map(function (s) {
        return '<div><span>Saison ' + esc(s.saison) + " · " + esc(s.cat) + " · P" + esc(s.pos) + "</span><b>+" + s.points + "</b></div>";
      }).join("") + "</div>" : '<div class="rj112-vide">Aucune saison comptée pour l\'instant.</div>') +
      (b.length ? '<div class="rj112-bareme">Cette saison en ' + esc(G.cat) + " : " +
        b.map(function (p, i) { return "P" + (i + 1) + " " + p; }).join(" · ") + "</div>" :
        G.cat === F1 ? "" : '<div class="rj112-bareme">' + esc(G.cat) + " ne rapporte pas de points de licence.</div>");
  }

  function boot() {
    if (typeof rjInscrire !== "function" || typeof buildOffer !== "function" || typeof ptab !== "function") return setTimeout(boot, 100);
    rjInscrire("buildOffer", { id: "112-super-licence:buildOffer", remplace: surOffre });
    rjInscrire("saveSeasonToHistory", { id: "112-super-licence:saveSeasonToHistory", apres: bilan });
    rjInscrire("ptab", { id: "112-super-licence:ptab", apres: function (r, args) { if (args[0] === "rep") carte(); } });
    window.RJSuperLicence = { bareme: bareme, points: points, etat: etat, requis: REQUIS };
    window._rj112Uninstall = function () {
      rjDesinscrire(["112-super-licence:"]);
      var c = document.getElementById("rj112-carte"); if (c) c.remove();
      delete window.RJSuperLicence;
    };
    console.log(TAG, "actif — " + REQUIS + " points sur trois saisons pour la F1");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
