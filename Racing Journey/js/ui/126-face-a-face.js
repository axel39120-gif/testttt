/* =====================================================================
 * 126-face-a-face.js — LE FACE-À-FACE, À LA DA DU JEU
 *
 * POURQUOI
 * L'onglet Championnat › Face-à-face empilait une liste déroulante de site,
 * deux grands cadres « Toi / Rival » aux marges flottantes, des barres
 * épaisses et un verdict tout en bas : rien de la tuile de l'accueil.
 *
 * CE QUE FAIT LE MODULE
 * Remplace le rendu (renderH2H), avec les mêmes données (03) :
 *  - à gauche, la tuile du duel (toi en rouge, le rival en or, le score de
 *    catégories gagnées au centre), le choix du rival en panneau (121), et
 *    la confrontation par catégorie : valeur, intitulé, valeur, et une
 *    jauge fine qui se partage depuis le centre ;
 *  - à droite, le verdict, puis les points par manche (le tableau de 78
 *    prend la place du graphique, comme avant).
 *
 * Réversible : window._rj126Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[126-face-a-face]";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* Une catégorie : qui gagne, et la part de chacun sur la jauge. */
  function ligne(lbl, p, r, plusHaut, fmt) {
    var gagnant = null;
    if (p != null || r != null) {
      if (p == null) gagnant = "r"; else if (r == null) gagnant = "p";
      else if (p !== r) gagnant = (plusHaut ? p > r : p < r) ? "p" : "r";
    }
    var a = p || 0, b = r || 0, part;
    if (plusHaut) part = a + b ? a / (a + b) : 0.5;
    else { var ia = p == null ? 0 : Math.max(0, 30 - a), ib = r == null ? 0 : Math.max(0, 30 - b); part = ia + ib ? ia / (ia + ib) : 0.5; }
    return { lbl: lbl, p: fmt(p), r: fmt(r), gagnant: gagnant, part: Math.round(part * 100) };
  }
  var nombre = function (v) { return v == null ? "—" : v; };
  var place = function (v) { return v == null ? "—" : "P" + v.toFixed(1); };

  function rendre() {
    var c = document.getElementById("h2h-content");
    if (!c) return;
    var rivaux = G.rivals || [];
    if (!rivaux.length) { c.innerHTML = '<div class="rj126-vide">Aucun rival pour l\'instant : le face-à-face s\'ouvre avec ta première saison en championnat.</div>'; return; }
    var tries = _h2hRivals(), idx = G._h2hIdx;
    if (typeof idx !== "number" || idx < 0 || idx >= rivaux.length) { idx = tries[0].i; G._h2hIdx = idx; }
    var rival = rivaux[idx];
    var pS = _h2hStats(G.races || []), rH = rival.raceHistory || [], rS = _h2hStats(rH);
    var pQ = _h2hQualiAvg((G.races || []).map(function (x) { return x.qualiPos || 0; })), rQ = _h2hQualiAvg(rival.qualiHistory || []);
    var pNom = ((G.pilot.prenom ? G.pilot.prenom + " " : "") + (G.pilot.nom || "")).trim() || "Toi", rNom = rival.name || "Rival";
    var lignes = [
      ligne("Points", G.champPts || 0, rival.pts || 0, true, nombre),
      ligne("Victoires", pS.wins, rS.wins, true, nombre),
      ligne("Podiums", pS.podiums, rS.podiums, true, nombre),
      ligne("Top 5", pS.top5, rS.top5, true, nombre),
      ligne("Poles", pS.poles, rS.poles, true, nombre),
      ligne("Moy. qualif", pQ, rQ, false, place),
      ligne("Moy. course", pS.avgPos, rS.avgPos, false, place),
      ligne("Abandons", pS.dnf, rS.dnf, false, nombre)
    ];
    var pG = lignes.filter(function (l) { return l.gagnant === "p"; }).length, rG = lignes.filter(function (l) { return l.gagnant === "r"; }).length;
    var etat = pG > rG ? "moi" : rG > pG ? "lui" : "egal", ecart = (G.champPts || 0) - (rival.pts || 0);
    var aucune = !pS.played && !rS.played;
    var verdict = aucune ? "Aucune course disputée : la saison commence."
      : etat === "moi" ? "Tu domines " + rNom + "." : etat === "lui" ? rNom + " a le dessus." : "Égalité parfaite.";
    var detail = aucune ? "" : (ecart > 0 ? "+" + ecart : ecart) + " pts au championnat · " + pG + " catégorie" + (pG > 1 ? "s" : "") + " sur " + lignes.length;

    var h = '<div class="rj126"><div class="rj126-col">';
    h += '<div class="rj126-duel rj126-' + etat + '">' +
      (window.RJAvatar ? '<span class="rj126-visage moi">' + RJAvatar.html(RJAvatar.joueur(), 64) + "</span>" : "") +
      '<div class="rj126-camp moi"><small>Toi</small><b>' + esc(pNom) + "</b><span>" + esc(G.currentTeam || "Indépendant") + "</span></div>" +
      '<div class="rj126-score"><b>' + pG + "</b><i>–</i><b>" + rG + "</b><small>catégories</small></div>" +
      '<div class="rj126-camp lui"><small>Rival</small><b>' + esc(rNom) + "</b><span>" + esc(rival.team || "—") + "</span></div>" +
      (window.RJAvatar ? '<span class="rj126-visage lui">' + RJAvatar.html(RJAvatar.personnage(rNom, { role: "pilote", equipe: rival.team, nat: rival.nat, age: rival.age }), 64) + "</span>" : "") + "</div>";
    h += '<label class="rj126-choix"><span>Comparer avec</span><select aria-label="Comparer avec" onchange="G._h2hIdx=+this.value;renderH2H()">' +
      tries.map(function (o) { return '<option value="' + o.i + '"' + (o.i === idx ? " selected" : "") + ">" + esc(o.r.name) + " — " + (o.r.pts || 0) + " pts</option>"; }).join("") + "</select></label>";
    h += '<div class="t-sec">Confrontation par catégorie</div><div class="rj126-stats">' + lignes.map(function (l) {
      return '<div class="rj126-ligne' + (l.gagnant ? " g-" + l.gagnant : "") + '"><b class="moi">' + l.p + "</b><span>" + l.lbl + '</span><b class="lui">' + l.r + "</b>" +
        '<div class="rj126-jauge" style="--p:' + l.part + '%"></div></div>';
    }).join("") + "</div></div>";
    h += '<div class="rj126-col"><div class="t-sec">Verdict</div><div class="rj126-verdict rj126-' + (aucune ? "egal" : etat) + '"><b>' + esc(verdict) + "</b>" + (detail ? "<span>" + detail + "</span>" : "") + "</div>";
    if (pS.played || rH.length) {
      var nb = (window.CAL_RACES && CAL_RACES.length) || Math.max((G.races || []).length, rH.length);
      h += '<div class="t-sec">Évolution des points</div><div class="rj126-graphe">' + _h2hPointsChart(G.races || [], rH, nb) + "</div>";
    }
    h += "</div></div>";
    c.innerHTML = h;
  }

  function installer() {
    if (typeof rjInscrire !== "function" || typeof window.renderH2H !== "function" || typeof _h2hStats !== "function") return false;
    /* Plus intérieur que 78 (-4000) : 78 remplace ensuite le graphique par le tableau des points. */
    rjInscrire("renderH2H", { id: "126-face-a-face:renderH2H", ordre: -3000, remplace: function () { rendre(); } });
    return true;
  }
  var essais = 0;
  function boot() {
    if (installer()) { console.log(TAG, "actif"); return; }
    if (essais++ < 80) setTimeout(boot, 150);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  window._rj126Uninstall = function () { rjDesinscrire(["126-face-a-face:"], "renderH2H"); };
})();
