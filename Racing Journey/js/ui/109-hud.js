/* =====================================================================
 * 109-hud.js — BARRE DE RESSOURCES EN HAUT DE CHAQUE ÉCRAN
 *
 * POURQUOI
 * Saison, budget, réputation et note n'étaient lisibles qu'à l'accueil. Un
 * jeu mobile les garde sous les yeux : une barre fixe en haut à droite, sur
 * le bandeau de chaque écran (titre à gauche, ressources à droite).
 *
 * L'accueil reprend ces chiffres dans le HUD ; ses pastilles donnent donc la
 * saison sportive : classement, points, victoires, podiums, et la forme
 * (cinq derniers résultats).
 *
 * Mise à jour : après updateUI (chaque changement d'état) et à chaque
 * changement d'écran. Placement et style : css/paysage.css.
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[109-hud]";

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function argent(n) {
    n = Math.round(n || 0);
    var signe = n < 0 ? "−" : "";
    return signe + (Math.abs(n) >= 1000 ? _fmtCompactNum(Math.abs(n)) : String(Math.abs(n))) + " €";
  }

  function hud() {
    var h = document.getElementById("rj-hud");
    if (!h) {
      h = document.createElement("div");
      h.id = "rj-hud";
      document.body.appendChild(h);
    }
    return h;
  }

  function majHud() {
    if (typeof G === "undefined" || !G || !G.pilot) return;
    var note = typeof calcPlayerRating === "function" ? calcPlayerRating() : null;
    var palier = note !== null && typeof getRatingTier === "function" ? getRatingTier(note) : null;
    hud().innerHTML =
      '<span class="rj-hud-chip" title="Saison et semaine">S' + esc(G.saison) + ' · Sem ' + esc(G.semaine) + "</span>" +
      '<span class="rj-hud-chip rj-hud-argent" title="Budget">' + esc(argent(G.budget)) + "</span>" +
      '<span class="rj-hud-chip" title="Réputation">Rép ' + esc(G.reputation) + "</span>" +
      (note === null ? "" :
        '<span class="rj-hud-chip rj-hud-note" title="Note du pilote" style="color:' + esc(palier.color) + ";border-color:" + esc(palier.color) + '66">' +
        esc(note) + " " + esc(palier.tier || "") + "</span>");
    // Le bandeau réserve au HUD sa largeur réelle (css/paysage.css, --hud).
    var l = hud().offsetWidth;
    if (l) document.documentElement.style.setProperty("--hud", l + "px");
  }

  /* Pastilles de saison et forme, à l'accueil. */
  function majAccueil() {
    if (typeof G === "undefined" || !G) return;
    var courses = Array.isArray(G.races) ? G.races : [];
    var pos = function (r) { return r && r.pos > 0 && r.pos < 99 ? r.pos : null; };
    var ecrire = function (id, v) { var e = document.getElementById(id); if (e) e.textContent = v; };
    ecrire("h-champ-pts", courses.length ? (G.champPts || 0) : "—");
    ecrire("h-wins", courses.filter(function (r) { return pos(r) === 1; }).length);
    ecrire("h-podiums", courses.filter(function (r) { var p = pos(r); return p && p <= 3; }).length);

    majClassement();

    var forme = document.getElementById("h-forme");
    if (!forme) return;
    var dernieres = courses.slice(-5);
    forme.innerHTML = '<span class="apex-forme-lbl">Forme</span>' + (dernieres.length ?
      dernieres.map(function (r) {
        var p = pos(r);
        var cls = !p ? "ab" : p === 1 ? "or" : p === 2 ? "argent" : p === 3 ? "bronze" : p <= 10 ? "points" : "";
        return '<span class="apex-forme-res ' + cls + '" title="' + esc(r.circuit || r.nom || "") + '">' + (p ? "P" + p : "AB") + "</span>";
      }).join("") :
      '<span class="apex-forme-vide">Aucune course cette saison</span>');
  }

  /* Mini-classement : au plus quatre lignes, écart au leader. Même calcul que
     l'écran Championnat (renderChamp). */
  function majClassement() {
    var boite = document.getElementById("h-champ-mini");
    if (!boite || !G.pilot || !Array.isArray(G.rivals)) return;
    var moi = { nom: (G.pilot.prenom ? G.pilot.prenom + " " : "") + G.pilot.nom, pts: G.champPts || 0, moi: true };
    var L = [moi].concat(G.rivals.map(function (r) { return { nom: r.name, pts: r.pts || 0 }; }))
      .sort(function (a, b) { return b.pts - a.pts; });
    var i = L.indexOf(moi);
    /* En tête du championnat : les trois premiers ; sinon le leader et tes voisins. */
    var rangs = (i <= 1 ? [0, 1, 2, 3] : [0, i - 1, i, i + 1])
      .filter(function (k, n, t) { return k >= 0 && k < L.length && t.indexOf(k) === n; }).slice(0, 4);
    var tete = L[0].pts;
    boite.innerHTML = '<div class="apex-champ-mini-lbl">Championnat</div>' + rangs.map(function (k) {
      var p = L[k];
      return '<div class="apex-champ-mini-row' + (p.moi ? " moi" : "") + '">' +
        '<span class="pos">' + (k + 1) + "</span>" +
        '<span class="nom">' + esc(p.nom) + "</span>" +
        '<span class="pts">' + esc(p.pts) + " pts</span>" +
        '<span class="ecart">' + (k === 0 ? "Leader" : "−" + (tete - p.pts)) + "</span></div>";
    }).join("");
  }

  function maj() {
    try { majHud(); majAccueil(); } catch (e) { console.warn(TAG, e && e.message); }
  }

  function boot() {
    if (typeof rjInscrire !== "function" || typeof updateUI !== "function" || !Array.isArray(window.RJ_SCREEN_HOOKS)) return setTimeout(boot, 100);
    rjInscrire("updateUI", { id: "109-hud:updateUI", apres: maj });
    if (!window.RJ_SCREEN_HOOKS.some(function (h) { return h && h.id === "109-hud"; }))
      window.RJ_SCREEN_HOOKS.push({ id: "109-hud", ecran: "*", apres: maj });
    maj();
    window._rj109Uninstall = function () {
      rjDesinscrire(["109-hud:"], "updateUI");
      window.RJ_SCREEN_HOOKS = window.RJ_SCREEN_HOOKS.filter(function (h) { return !(h && h.id === "109-hud"); });
      var h = document.getElementById("rj-hud"); if (h) h.remove();
    };
    console.log(TAG, "actif — ressources en haut de chaque écran");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
