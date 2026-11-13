/* =====================================================================
 * 146-qualif-piste.js — TON TOUR DE QUALIF, SUR LE TRACÉ
 *
 * POURQUOI (v283, immersion du week-end)
 * Pendant les qualifs, la colonne de gauche ne montrait qu'un titre et une
 * ligne de texte. Elle montre maintenant le circuit : à chaque tour que tu
 * boucles, ta voiture le rejoue en trois secondes, le chrono défile, chaque
 * secteur s'allume à son passage avec sa couleur (violet = meilleur de la
 * séance, vert = ton meilleur, jaune = plus lent) et son temps, puis le
 * résultat s'affiche : chrono, position, écart à la pole.
 *
 * DONNÉES (lues, jamais modifiées)
 *   QUALI_STATE.drivers[] : laps, lastTime, lastSectors[3], lastSectorFlags[3]
 *   (2 = violet, 1 = vert, 0 = jaune), bestTime, isPlayer, team.
 *   getCircuitData(circuit).path : le tracé (le même que la course, 111).
 *
 * Réversible : window._rj146Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[146-qualif-piste]";
  var NS = "http://www.w3.org/2000/svg";
  var REJEU = 3000;            // durée du rejeu d'un tour, en ms
  var carte = null, minuterie = 0, rejeu = null, vusTours = -1, anim = 0;

  function el(nom, attrs) { var e = document.createElementNS(NS, nom); Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); }); return e; }
  function chrono(t) {
    if (typeof t !== "number" || !isFinite(t)) return "—:——.———";
    var m = Math.floor(t / 60), s = t - 60 * m;
    return m + ":" + (s < 10 ? "0" : "") + s.toFixed(3);
  }
  function joueur() { return window.QUALI_STATE && QUALI_STATE.drivers ? QUALI_STATE.drivers.filter(function (d) { return d.isPlayer; })[0] : null; }
  function couleur(equipe) { return (typeof window.couleurEcurie === "function" && window.couleurEcurie(equipe)) || "#E10600"; }
  var TEINTES = { 2: "#A855F7", 1: "#22C55E", 0: "#FACC15" };

  function construire() {
    var ecran = document.getElementById("quali-screen"), statut = document.getElementById("quali-status");
    var circuit = (window.QUALI_STATE && QUALI_STATE.circuitName) || (window.RACE_STATE && RACE_STATE.circuit) || "";
    var donnees = circuit && typeof getCircuitData === "function" ? getCircuitData(circuit) : null;
    if (!ecran || !statut || !donnees || !donnees.path) return null;
    var c = document.getElementById("rj146");
    if (c && c.getAttribute("data-circuit") === circuit) return carte;
    if (c) c.remove();
    c = document.createElement("div");
    c.id = "rj146";
    c.setAttribute("data-circuit", circuit);
    c.setAttribute("data-rj-noround", "1");   // les millièmes restent (04q arrondit sinon)
    c.innerHTML = '<div class="rj146-tete"><span class="rj146-etat">Au stand</span><b class="rj146-chrono">—:——.———</b></div>' +
      '<div class="rj146-piste"></div>' +
      '<div class="rj146-secteurs"><span data-s="0">S1</span><span data-s="1">S2</span><span data-s="2">S3</span></div>' +
      '<div class="rj146-bilan"></div>';
    statut.parentNode.insertBefore(c, statut.nextSibling);
    var svg = el("svg", { "class": "rj146-svg", role: "img", "aria-label": "Ton tour sur " + circuit });
    c.querySelector(".rj146-piste").appendChild(svg);
    svg.appendChild(el("path", { d: donnees.path, "class": "rj111-bord" }));
    svg.appendChild(el("path", { d: donnees.path, "class": "rj111-limite" }));
    var piste = el("path", { d: donnees.path, "class": "rj111-piste" });
    svg.appendChild(piste);
    var L = piste.getTotalLength(), b = piste.getBBox();
    svg.setAttribute("viewBox", [b.x - 6, b.y - 6, b.width + 12, b.height + 12].join(" "));
    // trois secteurs (mêmes bornes que la vue de course : tiers du tracé), coloriés au passage
    var secteurs = [0, 1, 2].map(function (k) {
      var p = el("path", { d: donnees.path, "class": "rj146-sect", "stroke-dasharray": (L / 3).toFixed(2) + " " + L.toFixed(2), "stroke-dashoffset": (-k * L / 3).toFixed(2) });
      svg.appendChild(p);
      return p;
    });
    var depart = piste.getPointAtLength(0);
    svg.appendChild(el("circle", { cx: depart.x, cy: depart.y, r: 2.2, "class": "rj146-ligne" }));
    var p = joueur();
    var voiture = el("circle", { r: 3.4, fill: couleur(p && p.team), "class": "rj146-voiture" });
    voiture.setAttribute("transform", "translate(" + depart.x + "," + depart.y + ")");
    svg.appendChild(voiture);
    carte = { el: c, svg: svg, piste: piste, L: L, secteurs: secteurs, voiture: voiture,
      etat: c.querySelector(".rj146-etat"), chrono: c.querySelector(".rj146-chrono"),
      puces: [].slice.call(c.querySelectorAll(".rj146-secteurs span")), bilan: c.querySelector(".rj146-bilan") };
    return carte;
  }

  function classement() {
    return QUALI_STATE.drivers.filter(function (d) { return typeof d.bestTime === "number" && !d.eliminated; })
      .sort(function (a, b) { return a.bestTime - b.bestTime; });
  }

  /* Le rejeu d'un tour bouclé : voiture, chrono, secteurs. */
  function image(t) {
    anim = 0;
    if (!rejeu || !carte) return;
    var dt = Math.min(1, (t - rejeu.debut) / REJEU), cumul = rejeu.cumul, total = cumul[3];
    var tps = dt * total;   // temps du tour écoulé
    var k = tps < cumul[1] ? 0 : tps < cumul[2] ? 1 : 2;
    var part = (k + (tps - cumul[k]) / Math.max(0.001, cumul[k + 1] - cumul[k])) / 3;
    var pt = carte.piste.getPointAtLength(Math.min(0.999, part) * carte.L);
    carte.voiture.setAttribute("transform", "translate(" + pt.x.toFixed(2) + "," + pt.y.toFixed(2) + ")");
    carte.chrono.textContent = chrono(tps);
    [0, 1, 2].forEach(function (s) {
      var fait = tps >= cumul[s + 1];
      carte.secteurs[s].style.stroke = fait ? TEINTES[rejeu.flags[s] || 0] : "";
      carte.puces[s].style.background = fait ? TEINTES[rejeu.flags[s] || 0] : "";
      carte.puces[s].textContent = fait ? "S" + (s + 1) + " " + rejeu.sect[s].toFixed(3) : "S" + (s + 1);
      carte.puces[s].classList.toggle("ok", fait);
    });
    if (dt < 1) { anim = requestAnimationFrame(image); return; }
    // fin du rejeu : le résultat
    carte.chrono.textContent = chrono(total);
    var C = classement(), p = joueur(), rang = C.indexOf(p) + 1, pole = C[0];
    var ameliore = p && typeof p.bestTime === "number" && Math.abs(p.bestTime - rejeu.temps) < 1e-6;
    carte.etat.textContent = ameliore ? "Meilleur tour !" : "Tour bouclé";
    carte.el.classList.toggle("rj146-record", !!ameliore);
    carte.bilan.innerHTML = rang ? "<b>P" + rang + "</b>" + (pole && pole !== p ? '<span>+' + (p.bestTime - pole.bestTime).toFixed(3) + " de la pole</span>" : "<span>pole provisoire</span>") +
      "<em>meilleur " + chrono(p.bestTime) + "</em>" : "";
    rejeu = null;
  }

  function tic() {
    var ecran = document.getElementById("rt-qualif");
    if (!ecran || !ecran.offsetParent || !window.QUALI_STATE || !QUALI_STATE.drivers || !QUALI_STATE.drivers.length) return;
    if (!construire()) return;
    var p = joueur();
    if (!p) return;
    if (p.eliminated) { carte.etat.textContent = "Éliminé"; return; }
    /* Un tour est rejoué quand son chrono arrive (lastTime nouveau) : il n'est
       écrit qu'une fois, à la fin du tour chaud (après la séquence de choix),
       alors que les secteurs passent par une valeur provisoire. Le tour de
       sortie n'a pas de chrono : il s'annonce seulement. */
    var ok = typeof p.lastTime === "number" && Array.isArray(p.lastSectors) && p.lastSectors.every(function (x) { return typeof x === "number"; });
    var sig = ok ? p.lastTime.toFixed(4) : "";
    if (vusTours === -1) vusTours = sig;    // à l'ouverture : on ne rejoue pas un ancien tour
    if (!ok && (p.laps || 0) >= 1 && !rejeu && carte.etat.textContent !== "Tour de sortie") { carte.etat.textContent = "Tour de sortie"; }
    if (ok && sig !== vusTours) {
      vusTours = sig;
      var s = p.lastSectors, cumul = [0, s[0], s[0] + s[1], s[0] + s[1] + s[2]];
      rejeu = { debut: performance.now(), cumul: cumul, sect: s.slice(), flags: (p.lastSectorFlags || [0, 0, 0]).slice(), temps: typeof p.lastTime === "number" ? p.lastTime : cumul[3] };
      carte.etat.textContent = "Tour lancé";
      carte.el.classList.remove("rj146-record");
      if (anim) cancelAnimationFrame(anim);
      anim = requestAnimationFrame(image);
    } else if (!rejeu && QUALI_STATE._sessionRunning && carte.etat.textContent === "Au stand") {
      carte.etat.textContent = "En piste";
    }
  }

  /* ------------------------------------------------------------------
   * Essais libres : pendant un relais, une piste miniature à gauche du
   * chrono ; la voiture suit la progression du tour en cours (barre
   * #fpl-lap-prog du module 18), les secteurs passés s'allument.
   * ---------------------------------------------------------------- */
  var essai = null, animEssai = 0;
  function imageEssai() {
    animEssai = 0;
    var barre = document.getElementById("fpl-lap-prog");
    if (!essai || !barre || !document.contains(essai.svg)) { essai = null; return; }
    var part = Math.max(0, Math.min(0.999, (parseFloat(barre.style.width) || 0) / 100));
    // la barre avance par à-coups (mise à jour du module 18) : on glisse vers elle
    essai.part = essai.part == null || part < essai.part - 0.5 ? part : essai.part + (part - essai.part) * 0.2;
    var pt = essai.piste.getPointAtLength(essai.part * essai.L);
    essai.voiture.setAttribute("transform", "translate(" + pt.x.toFixed(2) + "," + pt.y.toFixed(2) + ")");
    essai.secteurs.forEach(function (s, k) { s.style.stroke = essai.part >= (k + 1) / 3 ? "#22D3EE" : ""; });
    animEssai = requestAnimationFrame(imageEssai);
  }
  function essais() {
    var barre = document.getElementById("fpl-lap-prog");
    if (!barre || !barre.offsetParent) return;
    var hote = barre.parentNode && barre.parentNode.parentNode;
    if (!hote) return;
    if (!essai || !document.contains(essai.svg)) {
      var circuit = (window.RACE_STATE && RACE_STATE.circuit) || "";
      var donnees = circuit && typeof getCircuitData === "function" ? getCircuitData(circuit) : null;
      if (!donnees || !donnees.path) return;
      var svg = el("svg", { "class": "rj146-mini-ess", "aria-hidden": "true" });
      hote.insertBefore(svg, hote.firstChild);
      hote.classList.add("rj146-essai-hote");
      svg.appendChild(el("path", { d: donnees.path, "class": "rj111-bord" }));
      svg.appendChild(el("path", { d: donnees.path, "class": "rj111-limite" }));
      var piste = el("path", { d: donnees.path, "class": "rj111-piste" });
      svg.appendChild(piste);
      var L = piste.getTotalLength(), b = piste.getBBox();
      svg.setAttribute("viewBox", [b.x - 6, b.y - 6, b.width + 12, b.height + 12].join(" "));
      var secteurs = [0, 1, 2].map(function (k) {
        var p = el("path", { d: donnees.path, "class": "rj146-sect", "stroke-dasharray": (L / 3).toFixed(2) + " " + L.toFixed(2), "stroke-dashoffset": (-k * L / 3).toFixed(2) });
        svg.appendChild(p); return p;
      });
      var voiture = el("circle", { r: 4, fill: couleur(G && G.currentTeam), "class": "rj146-voiture" });
      svg.appendChild(voiture);
      essai = { svg: svg, piste: piste, L: L, secteurs: secteurs, voiture: voiture, part: null };
    }
    if (!animEssai) animEssai = requestAnimationFrame(imageEssai);
  }

  function boot() {
    minuterie = setInterval(function () { try { tic(); } catch (e) { console.warn(TAG, e && e.message); } try { essais(); } catch (e) { console.warn(TAG, e && e.message); } }, 300);
    window.RJQualifPiste = { tic: tic, etat: function () { return { carte: !!carte, rejeu: !!rejeu, vusTours: vusTours }; } };
    window._rj146Uninstall = function () {
      clearInterval(minuterie); if (anim) cancelAnimationFrame(anim);
      var c = document.getElementById("rj146"); if (c) c.remove();
      carte = null; delete window.RJQualifPiste;
    };
    console.log(TAG, "actif — ton tour de qualif sur le tracé");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
