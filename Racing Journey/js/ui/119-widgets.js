/* =====================================================================
 * 119-widgets.js — DES WIDGETS UTILES À LA PLACE DES VIDES
 *
 * POURQUOI
 * En paysage, beaucoup d'écrans laissaient une demi-page vide (Contrats,
 * Style de vie, Messagerie, Patrimoine…). Un jeu mobile y met l'essentiel
 * de la carrière, à portée de doigt.
 *
 * CE QUE FAIT LE MODULE
 * Six widgets, chacun une carte cliquable qui mène à l'écran concerné :
 *   contrat (écurie, salaire, temps restant), prochaine course, saison
 *   (classement, points, forme), budget, Super Licence, rêves de carrière.
 * Chaque écran reçoit ceux qui le complètent (WIDGETS_PAR_ECRAN). Ils se
 * glissent dans les colonnes de l'onglet affiché (css/paysage.css) : les
 * colonnes s'équilibrent et les widgets remplissent la plus courte. Sans
 * colonnes, ils forment une rangée en bas de l'écran.
 * Mise à jour : à chaque changement d'écran et d'onglet.
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[119-widgets]";
  var F1 = "Formule 1";

  var WIDGETS_PAR_ECRAN = {
    "S-contracts": ["saison", "licence", "course"],   // le contrat et le budget y sont déjà
    "S-patrimoine": ["contrat", "course"],
    "S-lifestyle": ["budget", "saison", "course"],
    "S-mailbox": ["course", "contrat", "saison"],
    "S-media": ["saison", "course"],
    "S-champ": ["course", "licence", "reves"],
    "S-pilot": ["contrat", "reves", "licence"]
  };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function argent(n) {
    n = Math.round(n || 0);
    return (n < 0 ? "−" : "") + (typeof _fmtCompactNum === "function" && Math.abs(n) >= 1000 ? _fmtCompactNum(Math.abs(n)) : Math.abs(n)) + " €";
  }
  function pluriel(n, mot) { return n + " " + mot + (n > 1 ? "s" : ""); }
  function barre(part, couleur) {
    return '<div class="rj119-barre"><span style="width:' + Math.round(Math.max(0, Math.min(1, part)) * 100) + "%;background:" + couleur + '"></span></div>';
  }
  function carte(id, couleur, titre, valeur, details, aller) {
    return '<div class="rj119-w" data-w="' + id + '" style="--w:' + couleur + '" role="button" data-aller="' + aller + '">' +
      '<div class="rj119-t">' + esc(titre) + "</div>" +
      '<div class="rj119-v">' + valeur + "</div>" + (details || "") + "</div>";
  }

  /* Chaque widget : son HTML, ou "" s'il n'a rien à dire. */
  var WIDGETS = {
    contrat: function () {
      var equipe = G.currentTeam && G.currentTeam !== "Indépendant" ? G.currentTeam : null;
      if (!equipe) return carte("contrat", "#3B82F6", "Contrat", "Sans écurie", '<div class="rj119-s">Les offres arrivent selon tes résultats et ta réputation.</div>', "contrats");
      var reste = G.contractWeeksLeft || 0, total = 48 * (G.contractDur || 0);
      // Même lecture que la carte de l'écran Contrats (renderOffers, 03) : 4 semaines par mois, 48 par saison.
      var saisons = Math.floor(reste / 48), mois = Math.round((reste - 48 * saisons) / 4);
      var duree = saisons ? pluriel(saisons, "saison") + (mois ? " + " + mois + " mois" : "") : reste >= 20 ? Math.round(reste / 4) + " mois" : pluriel(reste, "semaine");
      return carte("contrat", "#3B82F6", "Contrat actuel", esc(equipe),
        '<div class="rj119-l"><span>Salaire</span><b>' + esc(argent(G.revenue)) + " / mois</b></div>" +
        '<div class="rj119-l"><span>Fin de contrat</span><b>dans ' + esc(duree) + "</b></div>" +
        (total > reste ? barre(1 - reste / total, "#3B82F6") : ""), "contrats");
    },
    course: function () {
      var c = typeof getNextRace === "function" ? getNextRace() : null;
      if (!c) return "";
      var dans = (c.week || 0) - (G.semaine || 0);
      var faites = (CAL_RACES || []).filter(function (r) { return r.done; }).length, total = (CAL_RACES || []).length;
      return carte("course", "#FF1801", "Prochaine course", esc(c.name),
        '<div class="rj119-l"><span>Manche</span><b>' + (faites + 1) + " / " + total + "</b></div>" +
        '<div class="rj119-l"><span>Départ</span><b>' + (dans <= 0 ? "cette semaine" : "dans " + pluriel(dans, "semaine")) + "</b></div>",
        "calendrier");
    },
    saison: function () {
      var courses = Array.isArray(G.races) ? G.races : [];
      var forme = courses.slice(-5).map(function (r) {
        var p = r && r.pos > 0 && r.pos < 99 ? r.pos : null;
        return '<i class="' + (!p ? "ab" : p <= 3 ? "podium" : p <= 10 ? "points" : "") + '">' + (p ? "P" + p : "AB") + "</i>";
      }).join("");
      return carte("saison", "#F59E0B", "Saison " + (G.saison || 1),
        (G.champPos ? "P" + esc(G.champPos) : "—") + ' <small>au championnat</small>',
        '<div class="rj119-l"><span>Points</span><b>' + esc(G.champPts || 0) + "</b></div>" +
        (forme ? '<div class="rj119-forme">' + forme + "</div>" : '<div class="rj119-s">Aucune course cette saison.</div>'),
        "championnat");
    },
    budget: function () {
      var sponsors = Array.isArray(G.sponsors) ? G.sponsors.length : 0;
      return carte("budget", "#10B981", "Budget", esc(argent(G.budget)),
        '<div class="rj119-l"><span>Salaire</span><b>' + esc(argent(G.revenue)) + " / mois</b></div>" +
        '<div class="rj119-l"><span>Sponsors</span><b>' + (sponsors ? pluriel(sponsors, "contrat") : "aucun") + "</b></div>",
        "patrimoine");
    },
    licence: function () {
      if (G.cat === F1 || !window.RJSuperLicence) return "";
      var e = RJSuperLicence.etat();
      return carte("licence", "#60A5FA", "Super Licence", e.points + ' <small>/ ' + e.requis + " pts</small>",
        barre(e.points / e.requis, "#60A5FA") +
        '<div class="rj119-s">' + (e.eligible ? "Licence obtenue : la F1 t'est ouverte." : !e.ageOk ? "18 ans minimum pour la F1." : "Il manque " + e.manque + " points sur trois saisons.") + "</div>",
        "licence");
    },
    reves: function () {
      if (!window.RJHeritage) return "";
      var noms = {};
      RJHeritage.catalogue().forEach(function (r) { noms[r.id] = r.nom; });
      var actifs = RJHeritage.actifs().slice(0, 2);
      var lignes = actifs.map(function (id) {
        var p = RJHeritage.progression(id) || { actuel: 0, cible: 1 };
        return '<div class="rj119-l"><span>' + esc(noms[id] || id) + "</span><b>" + esc(p.actuel) + " / " + esc(p.cible) + "</b></div>" + barre(p.actuel / p.cible, "#A855F7");
      }).join("");
      return carte("reves", "#A855F7", "Rêves de carrière", actifs.length ? pluriel(actifs.length, "rêve") + " en cours" : "Aucun rêve choisi",
        lignes || '<div class="rj119-s">Choisis jusqu\'à trois rêves dans l\'onglet Héritage.</div>',
        "heritage");
    }
  };

  /* Où les poser : dans le conteneur en colonnes de l'onglet affiché, sinon
     dans une rangée en bas de la zone de contenu. */
  function cible(ecran) {
    var zone = ecran.querySelector(":scope > .scroll");
    if (!zone) return null;
    var colonnes = [].slice.call(zone.querySelectorAll(":scope > *, :scope > * > *")).filter(function (e) {
      return e.offsetParent !== null && !e.classList.contains("rj119-rangee") && getComputedStyle(e).columnWidth !== "auto";
    });
    if (colonnes.length) return { parent: colonnes[0], rangee: false };
    var r = zone.querySelector(":scope > .rj119-rangee");
    if (!r) { r = document.createElement("div"); r.className = "rj119-rangee"; zone.appendChild(r); }
    return { parent: r, rangee: true };
  }

  function placer() {
    if (typeof G === "undefined" || !G || !G.pilot) return;
    var ecran = document.querySelector(".scr.on"), liste = ecran && WIDGETS_PAR_ECRAN[ecran.id];
    document.querySelectorAll(".rj119-w").forEach(function (w) { w.remove(); });
    document.querySelectorAll(".rj119-rangee").forEach(function (r) { r.remove(); });
    if (!liste) return;
    var ou = cible(ecran);
    if (!ou) return;
    var html = liste.map(function (id) { try { return WIDGETS[id](); } catch (e) { console.warn(TAG, id, e && e.message); return ""; } }).join("");
    ou.parent.insertAdjacentHTML("beforeend", html);
    if (ou.rangee && !html) ou.parent.remove();
  }

  /* Où mène un widget touché. */
  var ALLER = {
    contrats: function () { navMore("S-contracts"); },
    calendrier: function () { navTo("S-cal", "ni-cal"); if (typeof renderCal === "function") renderCal(); },
    championnat: function () { navTo("S-champ", "ni-champ"); },
    patrimoine: function () { navTo("S-patrimoine", null); },
    licence: function () { navTo("S-pilot", null); if (typeof ptab === "function") ptab("rep"); },
    heritage: function () { navTo("S-pilot", null); if (typeof ptab === "function") ptab("heritage"); }
  };

  function plusTard() { setTimeout(placer, 80); }   // après le rendu de l'écran ou de l'onglet

  function surClic(e) {
    var t = e.target && e.target.closest ? e.target : null;
    if (!t) return;
    var w = t.closest(".rj119-w");
    if (w && ALLER[w.getAttribute("data-aller")]) { ALLER[w.getAttribute("data-aller")](); return; }
    if (t.closest(".scr > .tabs")) plusTard();
  }

  function boot() {
    if (!Array.isArray(window.RJ_SCREEN_HOOKS) || typeof rjInscrire !== "function") return setTimeout(boot, 100);
    if (!window.RJ_SCREEN_HOOKS.some(function (h) { return h && h.id === "119-widgets"; }))
      window.RJ_SCREEN_HOOKS.push({ id: "119-widgets", ecran: "*", apres: plusTard });
    document.addEventListener("click", surClic, true);
    window.RJWidgets = { placer: placer, widgets: WIDGETS, parEcran: WIDGETS_PAR_ECRAN };
    window._rj119Uninstall = function () {
      window.RJ_SCREEN_HOOKS = window.RJ_SCREEN_HOOKS.filter(function (h) { return !(h && h.id === "119-widgets"); });
      document.removeEventListener("click", surClic, true);
      document.querySelectorAll(".rj119-w, .rj119-rangee").forEach(function (w) { w.remove(); });
      delete window.RJWidgets;
    };
    console.log(TAG, "actif — widgets de carrière dans les espaces libres");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
