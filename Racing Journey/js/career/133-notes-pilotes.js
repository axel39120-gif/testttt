/* =====================================================================
 * 133-notes-pilotes.js — DES NOTES DE PILOTE COMME DANS LES JEUX DE F1
 *
 * POURQUOI
 * La note d'un rival était sa compétence brute (+ un peu de régularité) :
 * même échelle de la F1 au karting, et aucun détail.
 *
 * CE QUE FAIT LE MODULE
 * Chaque pilote reçoit quatre notes, à la manière des jeux de F1 :
 *   EXP  Expérience   — âge et saisons courues ;
 *   COM  Combativité  — attaque, dépassements (compétence + tempérament) ;
 *   VIG  Vigilance    — régularité, peu d'erreurs ;
 *   RYT  Rythme       — vitesse pure (compétence) ;
 * et une note générale (GÉN) qui les pondère (le rythme compte le plus).
 * Chaque catégorie a sa fourchette réaliste (F1 74–96, F2 64–84, F3 56–78,
 * F4 48–70, karting junior 34–56…) : la meilleure note d'une grille de F3
 * reste sous celle d'un ténor de F1. La place dans la grille vient de la
 * compétence, comparée aux autres pilotes de la catégorie.
 *
 * Affichage seulement : calcRivalRating (fiche, classement, mercato) rend la
 * note générale ; la simulation ne lit pas ces notes. La fiche d'un pilote
 * montre la carte des quatre notes.
 *
 * API : RJNotes.notes(rival), RJNotes.joueur(), RJNotes.fourchette(cat).
 * Réversible : window._rj133Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[133-notes]";
  var FOURCHETTES = {
    "Formule 1": [74, 96], "IndyCar": [70, 91], "Endurance WEC": [68, 89], "Super Formula": [66, 87],
    "Formule 2": [64, 84], "Formule 3": [56, 78], "Formule 4": [48, 70], "Formula Regional": [52, 74],
    "Karting Senior": [42, 64], "Karting Junior": [34, 56]
  };
  var LIBELLES = [["exp", "EXP", "Expérience"], ["com", "COM", "Combativité"], ["vig", "VIG", "Vigilance"], ["ryt", "RYT", "Rythme"]];

  function borne(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function fourchette(cat) { return FOURCHETTES[cat || (typeof G !== "undefined" && G.cat)] || [55, 80]; }
  function graine(t) { var h = 2166136261; t = String(t || ""); for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function ecart(nom, cle, ampleur) { return ((graine(nom + "|" + cle) % 1000) / 1000 - .5) * 2 * ampleur; }   // fixe pour un pilote donné

  /* Place de la compétence dans la grille de la catégorie (0 … 1). */
  function placeDansGrille(skill) {
    var rs = (typeof G !== "undefined" && G.rivals) || [], sk = rs.map(function (r) { return r.skill || 60; });
    if (!sk.length) return .5;
    var mn = Math.min.apply(null, sk), mx = Math.max.apply(null, sk);
    return mx > mn ? borne((skill - mn) / (mx - mn), 0, 1) : .5;
  }

  function generale(n) { return Math.round(.18 * n.exp + .27 * n.com + .2 * n.vig + .35 * n.ryt); }

  function notes(r) {
    if (!r) return null;
    var f = fourchette(r.cat), lo = f[0], hi = f[1], ampl = hi - lo;
    var base = lo + placeDansGrille(r.skill || 60) * ampl;                    // la valeur du pilote dans sa catégorie
    // ses points forts : les stats détaillées (vitesse, technique, mental) écartées de sa propre moyenne
    var ds = r.detailedStats, d = { ryt: ecart(r.name, "ryt", 2.5), com: ecart(r.name, "com", 4), vig: ecart(r.name, "vig", 3) };
    if (ds) {
      var moy = function (k) { return k.reduce(function (a, x) { return a + (ds[x] || 60); }, 0) / k.length; };
      var p = moy(["vitesse_pure", "acceleration", "reactivite"]), t = moy(["freinage", "grip", "gestion_pneus"]), m = moy(["concentration", "decision", "pression"]), tout = (p + t + m) / 3;
      d = { ryt: (p - tout) * .8, com: (t - tout) * .8, vig: (m - tout) * .8 };
    }
    var regul = typeof r.consistency === "number" ? r.consistency : .75;
    var saisons = (r.history && r.history.length) || 0, age = r.age;
    if (!age) { try {   // l'âge vient de la date de naissance, que le jeu crée à la demande
      var dob = typeof _ensureRivalDob === "function" ? _ensureRivalDob(r, (G.rivals || []).indexOf(r)) : r.dob;
      if (dob && dob.year && typeof gameYear === "function") age = gameYear() - dob.year;
    } catch (e) {} }
    age = age || 24;
    var n = {
      ryt: borne(Math.round(base + d.ryt), 20, hi),
      com: borne(Math.round(base + d.com), 20, hi),
      vig: borne(Math.round(base * .55 + (lo + borne((regul - .6) / .35, 0, 1) * ampl) * .45 + d.vig), 20, 99),
      exp: borne(Math.round(lo - 14 + (age - 16) * 1.8 + saisons * 1.4 + ecart(r.name, "exp", 3)), 20, hi)
    };
    n.gen = borne(generale(n), 20, 99);
    return n;
  }

  /* Le joueur : ses piliers (Performance, Technique, Mental) et ses saisons ; sa note générale reste celle du jeu. */
  function joueur() {
    if (typeof G === "undefined" || !G.pilot) return null;
    var s = G.substats || {};
    function moy(cles) { return Math.round(cles.reduce(function (a, k) { return a + (s[k] || 55); }, 0) / cles.length); }
    var f = fourchette(), saisons = (G.saison || 1) - 1;
    var n = {
      ryt: moy(["vitesse_pure", "acceleration", "reactivite"]),
      com: moy(["freinage", "grip", "gestion_pneus"]),
      vig: moy(["concentration", "decision", "pression"]),
      exp: borne(Math.round(f[0] - 14 + ((G.age || 18) - 16) * 1.8 + saisons * 1.4), 20, 99)
    };
    n.gen = typeof calcPlayerRating === "function" ? calcPlayerRating() : generale(n);
    return n;
  }

  function couleur(v) { return v >= 90 ? "#E040FB" : v >= 85 ? "#F59E0B" : v >= 78 ? "#34D399" : v >= 70 ? "#60A5FA" : v >= 60 ? "#A3A3B5" : "#8a8a96"; }

  function carte(n, titre) {
    if (!n) return "";
    var c = couleur(n.gen);
    return '<div class="rj133-carte" style="--c:' + c + '"><div class="rj133-gen"><b>' + n.gen + '</b><span>GÉN</span></div><div class="rj133-notes">' +
      LIBELLES.map(function (l) {
        var v = n[l[0]];
        return '<div class="rj133-n"><span class="rj133-sigle">' + l[1] + '</span><span class="rj133-barre"><i style="width:' + v + "%;background:" + couleur(v) + '"></i></span><b>' + v + '</b><span class="rj133-nom">' + l[2] + "</span></div>";
      }).join("") + "</div>" + (titre ? '<div class="rj133-titre">' + titre + "</div>" : "") + "</div>";
  }

  /* La fiche d'un pilote reçoit la carte des quatre notes. */
  function decorerFiche(args) {
    var m = document.getElementById("driver-profile-modal");
    if (!m || m.querySelector(".rj133-carte")) return;
    var o = args && args[0] || {}, n;
    if (o.type === "player") n = joueur();
    else {
      var r = typeof o.idx === "number" ? (G.rivals || [])[o.idx] : (G.rivals || []).filter(function (x) { return x.name === o.name; })[0];
      n = notes(r);
      if (n && typeof calcRivalRating === "function") n.gen = calcRivalRating(r);   // la note finale du jeu (bonus de staff compris), la même partout
    }
    var tete = m.firstElementChild && m.firstElementChild.firstElementChild;
    if (n && tete) tete.insertAdjacentHTML("afterend", carte(n, "Notes en " + (G.cat || "catégorie") + " · fourchette " + fourchette().join("–")));
  }

  function boot() {
    if (typeof window.rjInscrire !== "function" || typeof window.calcRivalRating !== "function" || typeof window.showDriverProfileModal !== "function") return setTimeout(boot, 100);
    rjInscrire("calcRivalRating", { id: "133-notes:generale", remplace: function (args) { var n = notes(args[0]); return n ? n.gen : 60; } });
    rjInscrire("showDriverProfileModal", { id: "133-notes:fiche", apres: function (res, args) { try { decorerFiche(args); } catch (e) { console.warn(TAG, e && e.message); } } });
    window.RJNotes = { notes: notes, joueur: joueur, fourchette: fourchette, carte: carte, FOURCHETTES: FOURCHETTES };
    window._rj133Uninstall = function () {
      if (typeof rjDesinscrire === "function") { rjDesinscrire(["133-notes"], "calcRivalRating"); rjDesinscrire(["133-notes"], "showDriverProfileModal"); }
      delete window.RJNotes;
    };
    console.log(TAG, "actif");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
