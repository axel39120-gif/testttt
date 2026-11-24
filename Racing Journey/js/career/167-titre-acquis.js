/* =====================================================================
 * 167-titre-acquis.js — CHAMPION, AU MOMENT OÙ C'EST FAIT
 *
 * Après chaque manche, on compare l'avance du leader aux points encore en
 * jeu (victoire, sprint, meilleur tour, dans les manches restantes). Dès
 * qu'elle les dépasse, le titre est mathématiquement acquis : une fenêtre
 * l'annonce sur l'écran du résultat, un avis va dans la cloche, que ce soit
 * pour le joueur ou pour un rival. Une seule annonce par saison et catégorie.
 * État : G._titreAcquis (« saison#catégorie », sauvegardé).
 * Réversible : window._rj167Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var ID = "167-titre";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* Le plus que l'on puisse marquer sur une manche à venir. */
  function maxManche(c) {
    var leMans = /le ?mans/i, ici = leMans.test((window.RACE_STATE && RACE_STATE.circuit) || "");
    var victoire = _getPtsTable()[0];                              // doublée si la dernière course est Le Mans
    if (G.cat === "Endurance WEC") victoire = (ici ? victoire / 2 : victoire) * (leMans.test((c.name || "") + (c.circuit || "")) ? 2 : 1);
    var sprint = typeof _isSprintWeekendForRace === "function" && _isSprintWeekendForRace(c) ? _getSprintPtsTable()[0] || 0 : 0;
    return victoire + sprint + 1;                                  // + meilleur tour, par prudence
  }
  function etat() {
    var L = [{ nom: ((G.pilot.prenom || "") + " " + (G.pilot.nom || "")).trim(), pts: G.champPts || 0, moi: true, equipe: G.currentTeam }]
      .concat((G.rivals || []).map(function (r) { return { nom: r.name, pts: r.pts || 0, equipe: r.team }; }))
      .sort(function (a, b) { return b.pts - a.pts; });
    var cal = typeof CAL_RACES !== "undefined" ? CAL_RACES : [], faites = Math.max((G.races || []).length, cal.filter(function (c) { return c.done; }).length);
    var reste = cal.slice(faites), enJeu = reste.reduce(function (s, c) { return s + maxManche(c); }, 0);
    return { premier: L[0], second: L[1], reste: reste.length, enJeu: enJeu, total: cal.length,
      acquis: !!L[1] && cal.length > 0 && faites > 0 && L[0].pts > 0 && L[0].pts - L[1].pts > enJeu };
  }

  function verifier() {
    if (typeof G === "undefined" || !G || !G.pilot) return null;
    var cle = G.saison + "#" + G.cat;
    if (G._titreAcquis === cle) return null;
    var e = etat();
    if (!e.acquis) return null;
    G._titreAcquis = cle;
    annoncer(e);
    return e;
  }
  function annoncer(e) {
    var p = e.premier, avance = p.pts - e.second.pts, quand = e.reste ? "à " + e.reste + " manche" + (e.reste > 1 ? "s" : "") + " de la fin" : "à la dernière manche";
    var titre = p.moi ? "Tu es champion !" : p.nom + " est champion";
    var texte = "Titre de " + G.cat + " acquis " + quand + " : " + avance + " point" + (avance > 1 ? "s" : "") + " d'avance sur " + (e.second.moi ? "toi" : e.second.nom) + ".";
    if (typeof pushHomeToast === "function") pushHomeToast(p.moi ? "Titre : tu es champion" : "Titre joué : " + p.nom, texte, "#FACC15");
    var v = document.createElement("div"); v.className = "rj166-voile"; v.id = "rj167";
    v.innerHTML = '<div class="rj166-carte rj167' + (p.moi ? " moi" : "") + '"><svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10v5a5 5 0 0 1-10 0z M7 6H4a3 3 0 0 0 3 4 M17 6h3a3 3 0 0 1-3 4 M12 14v4 M8 20h8"/></svg>' +
      "<em>" + esc(G.cat) + " · Saison " + G.saison + "</em><h2>" + esc(titre) + "</h2>" + (p.equipe ? "<span>" + esc(p.equipe) + "</span>" : "") + "<p>" + esc(texte) + '</p><button type="button">Continuer</button></div>';
    v.addEventListener("click", function (x) { if (x.target.closest("button")) v.remove(); });
    document.body.appendChild(v);
  }

  function boot() {
    if (!Array.isArray(window.RJ_RESULT_HOOKS) || !Array.isArray(window.WEEKLY_TICK_HOOKS) || !Array.isArray(window.RJ_SAVE_HOOKS)) return setTimeout(boot, 120);
    var sur = function () { try { verifier(); } catch (e) { console.warn("[167-titre]", e && e.message); } };
    window.RJ_RESULT_HOOKS.push({ id: ID, apres: function () { setTimeout(sur, 900); } });
    window.WEEKLY_TICK_HOOKS.push({ id: ID, run: sur });             // réserviste : manches courues sans lui
    window.RJ_SAVE_HOOKS.push({ cle: "rj167", ecrire: function (g) { return g._titreAcquis || ""; }, lire: function (b, g) { g._titreAcquis = b || ""; } });
    window.RJTitre = { etat: etat, verifier: verifier };
    window._rj167Uninstall = function () {
      ["RJ_RESULT_HOOKS", "WEEKLY_TICK_HOOKS"].forEach(function (k) { window[k] = window[k].filter(function (h) { return !h || h.id !== ID; }); });
      delete window.RJTitre;
    };
    console.log("[167-titre] actif — titre annoncé dès qu'il est acquis");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
