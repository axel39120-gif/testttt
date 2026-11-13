/* =====================================================================
 * 147-resultat-tele.js — LE RÉSULTAT, COMME À LA TÉLÉ
 *
 * POURQUOI (v283, choix du joueur : « Résultat façon télé »)
 * L'écran de résultat garde son défilement, mais s'ouvre sur un bandeau de
 * retransmission pleine largeur, lisible sans défiler : drapeau à damier,
 * vainqueur, ta place en grand avec les places gagnées ou perdues depuis la
 * grille, les points marqués, ton rang au championnat, ton meilleur tour.
 *
 * DONNÉES (lues) : LIVE_RACE.drivers (pos, gridPos/startPos, isPlayer),
 * G.races (dernière course : pos, pts, circuit, playerBestLap, bestLap),
 * G.champPos, G.champPts.
 * Réversible : window._rj147Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var minuterie = 0;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function court(nom) { var m = String(nom || "").trim().split(/\s+/); return m.length > 1 ? m[0].charAt(0) + ". " + m.slice(1).join(" ") : m[0] || ""; }
  function chrono(t) { if (typeof t !== "number") return ""; var m = Math.floor(t / 60), s = t - 60 * m; return m + ":" + (s < 10 ? "0" : "") + s.toFixed(3); }

  function bandeau() {
    var c = document.getElementById("res-content");
    if (!c || !c.children.length || !c.offsetParent) return;
    var course = (window.G && G.races || [])[G.races.length - 1];
    var lr = window.LIVE_RACE, pilotes = lr && lr.drivers ? lr.drivers.filter(function (d) { return !d.dnf; }).slice().sort(function (a, b) { return a.pos - b.pos; }) : [];
    if (!course || !pilotes.length) return;
    var cle = (course.saison || "") + "|" + (course.nom || "") + "|" + course.pos;
    var b = document.getElementById("rj147");
    if (b && b.getAttribute("data-cle") === cle && b.parentNode === c && c.firstChild === b) return;
    if (b) b.remove();

    var moi = lr.drivers.filter(function (d) { return d.isPlayer; })[0] || {};
    var grille = moi.gridPos || moi.startPos || course.qualiPos || 0;
    var pos = course.pos, gain = grille && pos ? grille - pos : 0;
    var vainqueur = pilotes[0];
    var titre = pos === 1 ? "Victoire !" : pos <= 3 ? "Sur le podium" : course.pts > 0 ? "Dans les points" : moi.dnf ? "Abandon" : "Hors des points";
    var teinte = pos === 1 ? "or" : pos === 2 ? "argent" : pos === 3 ? "bronze" : course.pts > 0 ? "points" : "neutre";
    var meilleur = course.bestLap && course.bestLap.isPlayer;

    b = document.createElement("div");
    b.id = "rj147";
    b.className = "rj147-" + teinte;
    b.setAttribute("data-cle", cle);
    b.setAttribute("data-rj-noround", "1");
    b.innerHTML =
      '<div class="rj147-damier" aria-hidden="true"></div>' +
      '<div class="rj147-course"><span class="k">Drapeau à damier · ' + esc(course.circuit || "") + "</span>" +
        '<span class="v">' + (vainqueur.isPlayer ? "Tu remportes la course" : "Victoire de <b>" + esc(court(vainqueur.name)) + "</b>") + "</span></div>" +
      '<div class="rj147-moi"><b>' + (moi.dnf ? "AB" : "P" + pos) + "</b><span>" + esc(titre) + "</span>" +
        (grille ? '<em class="' + (gain > 0 ? "up" : gain < 0 ? "down" : "") + '">' + (gain > 0 ? "▲ " + gain : gain < 0 ? "▼ " + (-gain) : "=") + " depuis P" + grille + "</em>" : "") + "</div>" +
      '<div class="rj147-chiffres"><span><b>+' + (course.pts || 0) + "</b> pts</span>" +
        (G.champPos ? "<span>Championnat <b>P" + G.champPos + "</b> · " + (G.champPts || 0) + " pts</span>" : "") +
        (course.playerBestLap ? "<span" + (meilleur ? ' class="violet"' : "") + ">" + (meilleur ? "Meilleur tour de la course " : "Ton meilleur tour ") + "<b>" + chrono(course.playerBestLap) + "</b></span>" : "") + "</div>";
    c.insertBefore(b, c.firstChild);
  }

  function boot() {
    minuterie = setInterval(function () { try { bandeau(); } catch (e) { console.warn("[147-resultat-tele]", e && e.message); } }, 400);
    window._rj147Uninstall = function () { clearInterval(minuterie); var b = document.getElementById("rj147"); if (b) b.remove(); };
    console.log("[147-resultat-tele] actif — bandeau de résultat façon retransmission");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
