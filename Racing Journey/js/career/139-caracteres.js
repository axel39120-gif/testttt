/* =====================================================================
 * 139-caracteres.js — LE CARACTÈRE DES ÉCURIES DE F1 ET DES ACADÉMIES
 *
 * POURQUOI
 * Toutes les écuries de F1 recrutaient de la même façon, et toutes les
 * académies géraient leurs jeunes pareil. En vrai, Red Bull mise sur sa
 * filière et ne patiente pas, Ferrari préfère l'expérience, Mercedes fait
 * confiance à ses juniors…
 *
 * CE QUE FAIT LE MODULE
 *   - ÉCURIES DE F1 : chaque écurie a un caractère qui pèse dans le choix
 *     entre candidats à un baquet (116) : fidélité à sa filière, goût de
 *     l'expérience ou de la jeunesse, poids de l'argent, patience avant de
 *     renvoyer un pilote (14). Le style et le trait du pilote choisis à la
 *     création comptent un peu (2 à 3 points de note) auprès des écuries
 *     qui les apprécient.
 *   - ACADÉMIES : sévérité de la revue de fin de saison, nombre de saisons
 *     ratées avant le renvoi, place à atteindre pour un baquet de F1 (138).
 *   - AFFICHAGE : les labels du caractère sur la fiche de l'écurie, sur les
 *     offres de F1 et sur la page Académie ; un baquet perdu dit pourquoi
 *     quand le caractère de l'écurie a pesé.
 *
 * Données fixes, rien à sauvegarder. Réversible : window._rj139Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[139-caracteres]", F1 = "Formule 1";

  /* fidelite : points accordés aux pilotes de sa filière (et retirés à moitié aux
     débutants venus d'ailleurs) ; experience : points retirés à un débutant de la
     catégorie (négatif : l'écurie préfère la jeunesse) ; argent : multiplie le poids
     de l'apport ; patience : décale la confiance au moment du renvoi (14). */
  var ECURIES = {
    "Red Bull Racing": { fidelite: 10, experience: -2, argent: 0.6, patience: -6, styles: ["attaquant", "polyvalent"], traits: ["competiteur", "instinctif"],
      labels: ["Filière maison", "Mise sur la jeunesse", "Impitoyable"],
      texte: "Promeut ses propres juniors et les remplace vite s'ils déçoivent. Un pilote venu d'ailleurs y entre difficilement." },
    "Racing Bulls": { fidelite: 12, experience: -4, argent: 0.6, patience: -4, styles: ["attaquant", "polyvalent"], traits: ["competiteur", "instinctif"],
      labels: ["Antichambre de Red Bull", "Filière maison", "Mise sur la jeunesse"],
      texte: "L'école de Red Bull : on y lance les juniors de la maison, et les meilleurs montent chez Red Bull." },
    "Ferrari": { fidelite: 4, experience: 6, argent: 1, patience: -2, styles: ["stratege", "regulier", "complet"], traits: ["leader", "sangfroid"],
      labels: ["Préfère l'expérience", "Exigeante"],
      texte: "Recrute surtout des pilotes confirmés. Un jeune y arrive en dominant, ou en passant par Haas." },
    "Mercedes": { fidelite: 7, experience: 0, argent: 0.8, patience: 6, styles: ["technicien", "complet"], traits: ["analyste", "perfectionniste"],
      labels: ["Fait confiance à ses juniors", "Patiente"],
      texte: "N'hésite pas à lancer un junior de sa filière et lui laisse le temps de grandir." },
    "McLaren": { fidelite: 2, experience: 0, argent: 0.7, patience: 2, styles: ["attaquant", "complet"], traits: ["analyste", "competiteur"],
      labels: ["Recrute le talent", "Ouverte aux jeunes"],
      texte: "Prend le meilleur talent disponible, d'où qu'il vienne, jeune ou non." },
    "Aston Martin": { fidelite: 0, experience: 5, argent: 1.3, patience: 0, styles: ["regulier", "stratege"], traits: ["medias", "leader"],
      labels: ["Préfère l'expérience", "Sensible aux sponsors"],
      texte: "Mise sur des pilotes d'expérience et regarde de près le soutien financier." },
    "Alpine": { fidelite: 4, experience: 0, argent: 1.1, patience: -3, styles: ["polyvalent", "pluvial"], traits: ["intuitif", "sangfroid"],
      labels: ["Juniors bienvenus", "Instable"],
      texte: "Donne sa chance aux juniors, mais change souvent de pilotes." },
    "Haas F1 Team": { fidelite: 3, experience: 3, argent: 1.4, patience: 0, styles: ["regulier", "stratege"], traits: ["sangfroid", "leader"],
      labels: ["Tremplin Ferrari", "Sensible aux sponsors"],
      texte: "Petite structure liée à Ferrari : accueille ses juniors, et l'apport financier compte." },
    "Audi": { fidelite: 0, experience: 4, argent: 1.2, patience: 3, styles: ["technicien", "regulier"], traits: ["perfectionniste", "analyste"],
      labels: ["Préfère l'expérience", "Projet patient"],
      texte: "Un constructeur qui bâtit sur la durée, avec des pilotes expérimentés." },
    "Williams": { fidelite: 4, experience: -2, argent: 1.2, patience: 4, styles: ["technicien", "regulier"], traits: ["analyste", "perfectionniste"],
      labels: ["Ouverte aux jeunes", "Patiente", "Tremplin Mercedes"],
      texte: "Lance volontiers des jeunes, souvent venus de Mercedes, et leur laisse le temps." }
  };

  /* place / relation : seuils de la revue de fin de saison ; renvoi : saisons ratées
     d'affilée avant le renvoi ; baquet : place à atteindre pour un baquet de F1. */
  var ACADEMIES_C = {
    RBJT: { place: 6, relation: 40, renvoi: 1, baquet: 5, labels: ["Impitoyable", "Promotion rapide", "Filière Racing Bulls"],
      texte: "Un top 5 en F2 suffit pour Racing Bulls, mais une seule saison ratée et le programme s'arrête." },
    FDA: { place: 8, relation: 25, renvoi: 2, baquet: 1, labels: ["Exigeante", "Promotion par étapes", "Tremplin Haas"],
      texte: "Seul un titre ouvre un baquet (Haas, ou Ferrari pour un protégé). Sinon, la réserve d'abord." },
    MJP: { place: 12, relation: 20, renvoi: 3, baquet: 3, labels: ["Patiente", "Formation complète", "Tremplin Williams"],
      texte: "Laisse trois saisons pour rebondir ; un podium en F2 mène chez Williams." },
    AA: { place: 12, relation: 20, renvoi: 2, baquet: 3, labels: ["Ouverte", "Voie endurance"],
      texte: "Accueille largement, avec une porte vers l'endurance." },
    MDD: { place: 10, relation: 20, renvoi: 2, baquet: 3, labels: ["Recrute le talent", "Multi-disciplines"],
      texte: "Juge sur le talent, et ouvre aussi l'IndyCar." },
    HDA: { place: 14, relation: 15, renvoi: 2, baquet: 5, labels: ["Peu de concurrence", "Accès F1 rapide"],
      texte: "Peu de pilotes dans le programme : un top 5 en F2 suffit pour un baquet chez Haas." },
    WRA: { place: 14, relation: 15, renvoi: 3, baquet: 3, labels: ["Patiente", "Réseau britannique"],
      texte: "Laisse du temps et s'appuie sur les championnats britanniques." }
  };

  function ecurie(team, cat) { return (cat === undefined || cat === F1) ? (ECURIES[team] || null) : null; }
  function academie(id) { return ACADEMIES_C[id] || null; }

  function membreDe(team) {
    var a = typeof getPlayerAcademy === "function" ? getPlayerAcademy() : null;
    return !!a && (a.f1Team === team || (a.f1Alt || []).indexOf(team) >= 0);
  }
  function historique() { return typeof CAREER_HISTORY !== "undefined" && Array.isArray(CAREER_HISTORY) ? CAREER_HISTORY : []; }

  /* Le joueur vu comme candidat à un baquet de `cat`. */
  function joueur(cat, team) {
    return { joueur: true, membre: membreDe(team), style: G.pilot && G.pilot.style, trait: G.pilot && G.pilot.trait,
      rookie: G.cat !== cat && !historique().some(function (h) { return h && h.cat === cat; }) };
  }

  /* Points ajoutés à la note d'un candidat (échelle de talent 50-95). */
  function ajustement(cat, team, c) {
    var p = ecurie(team, cat); if (!p || !c) return 0;
    var v = c.rookie ? -p.experience : p.experience / 2;
    if (c.membre) v += p.fidelite;
    else if (c.rookie) v -= p.fidelite / 2;
    if (c.joueur) v += affinite(p);
    return v;
  }
  function affinite(p) {
    if (!p || !G.pilot) return 0;
    return (p.styles.indexOf(G.pilot.style) >= 0 ? 2 : 0) + (p.traits.indexOf(G.pilot.trait) >= 0 ? 1 : 0);
  }

  /* Pourquoi le caractère a coûté le baquet, ou null. */
  function motif(cat, team, premier) {
    var p = ecurie(team, cat); if (!p) return null;
    var j = joueur(cat, team);
    if (p.fidelite >= 7 && !j.membre && premier && premier.membre) return team + " mise sur sa filière";
    if (p.experience >= 3 && j.rookie && premier && !premier.rookie) return team + " a préféré l'expérience";
    if (p.fidelite >= 7 && !j.membre && j.rookie) return team + " lance d'abord ses propres juniors";
    return null;
  }

  function patience(team) { var p = ecurie(team); return p ? p.patience : 0; }

  /* --- Affichage ---------------------------------------------------------- */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function puces(labels, couleur) {
    couleur = couleur || "#A78BFA";
    return '<div class="rj139-labels" style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px">' + labels.map(function (l) {
      return '<span style="padding:2px 7px;background:' + couleur + '1f;border:1px solid ' + couleur + '55;border-radius:4px;font-family:var(--font-display);font-size:9.5px;font-weight:800;color:' + couleur + ';letter-spacing:.04em">' + esc(l) + "</span>";
    }).join("") + "</div>";
  }

  /* Couleur de l'académie, ou une teinte claire si elle est trop sombre pour un fond noir. */
  function lisible(c) {
    var m = /^#([0-9a-f]{6})$/i.exec(c || ""); if (!m) return undefined;
    var n = parseInt(m[1], 16), l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return l < 0.45 ? undefined : c;
  }

  function ficheEcurie(r, args) {
    var team = args && args[0], p = ecurie(team), boite = document.querySelector("#team-profile-modal > div");
    if (!p || !boite || boite.querySelector(".rj139-fiche")) return;
    var aff = affinite(p), d = document.createElement("div");
    d.className = "rj139-fiche";
    d.style.cssText = "padding:10px 14px;border-bottom:1px solid var(--border)";
    d.innerHTML = '<div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:var(--muted);letter-spacing:.14em;text-transform:uppercase">Caractère</div>' +
      puces(p.labels) + '<div style="font-size:12px;color:var(--text2);line-height:1.45;margin-top:7px">' + esc(p.texte) + "</div>" +
      (aff ? '<div style="font-size:11.5px;color:#34D399;margin-top:5px">Ton profil de pilote plaît à cette écurie.</div>' : "");
    boite.insertBefore(d, boite.children[1] || null);
  }

  function cartesOffres() {
    var cartes = [].slice.call(document.querySelectorAll("#offers-list .offer-card"));
    (G.offers || []).forEach(function (o) {
      var p = o && ecurie(o.team, o.cat);
      if (!p) return;
      var c = cartes.filter(function (x) { return !x.querySelector(".rj139-labels") && x.textContent.indexOf(o.team) >= 0; })[0];
      if (!c) return;
      var d = document.createElement("div");
      d.innerHTML = puces(p.labels);
      d.style.margin = "-4px 0 10px";
      c.insertBefore(d, c.children[1] || null);
    });
  }

  function pageAcademie(r, args) {
    var zone = document.getElementById(args && args[0]); if (!zone || typeof ACADEMIES === "undefined") return;
    Object.keys(ACADEMIES).forEach(function (nom) {
      var c = academie(ACADEMIES[nom].id); if (!c) return;
      [].slice.call(zone.querySelectorAll("div")).filter(function (el) {
        return !el.children.length && el.textContent.trim() === nom && +(el.style.fontWeight || 0) >= 800;
      }).forEach(function (el) {
        if (el.parentNode.querySelector(".rj139-labels")) return;
        var d = document.createElement("div");
        d.innerHTML = puces(c.labels, lisible(ACADEMIES[nom].color)) + '<div style="font-size:11px;color:var(--text2);line-height:1.4;margin-top:5px">' + esc(c.texte) + "</div>";
        el.parentNode.appendChild(d);
      });
    });
  }

  function installer() {
    if (typeof rjInscrire !== "function" || typeof window.showTeamProfileModal !== "function" || typeof window.renderOffers !== "function" || typeof window.renderAcademyPage !== "function") return false;
    rjInscrire("showTeamProfileModal", { id: "139-caracteres:fiche", apres: function (r, a) { try { ficheEcurie(r, a); } catch (e) { console.warn(TAG, e && e.message); } } });
    rjInscrire("renderOffers", { id: "139-caracteres:offres", apres: function () { try { cartesOffres(); } catch (e) { console.warn(TAG, e && e.message); } } });
    rjInscrire("renderAcademyPage", { id: "139-caracteres:academie", apres: function (r, a) { try { pageAcademie(r, a); } catch (e) { console.warn(TAG, e && e.message); } } });
    return true;
  }

  window.RJCaracteres = { ECURIES: ECURIES, ACADEMIES: ACADEMIES_C, ecurie: ecurie, academie: academie, joueur: joueur,
    ajustement: ajustement, affinite: affinite, motif: motif, patience: patience };
  window._rj139Uninstall = function () {
    if (typeof rjDesinscrire === "function") {
      rjDesinscrire(["139-caracteres"], "showTeamProfileModal");
      rjDesinscrire(["139-caracteres"], "renderOffers");
      rjDesinscrire(["139-caracteres"], "renderAcademyPage");
    }
    delete window.RJCaracteres;
  };

  var essais = 0;
  (function boot() {
    if (installer()) { console.log(TAG, "actif"); return; }
    if (essais++ < 80) setTimeout(boot, 120);
  })();
})();
