/* =====================================================================
 * 177-biographie.js — UNE BIOGRAPHIE QUI SE RÉSUME AVEC LE TEMPS
 *
 * La biographie de l'onglet Carrière est réécrite comme un récit :
 *   - le portrait (naissance, style, caractère) se raccourcit quand la
 *     carrière s'allonge ;
 *   - les catégories anciennes tiennent en une ligne, les deux dernières
 *     sont racontées (écuries, meilleure saison, titres) ;
 *   - la saison en cours, le palmarès, les académies et la vie privée ;
 *   - le niveau actuel et l'horizon pour finir.
 * Remplace le cœur de generatePilotBio ; la phrase sur l'écurie de cœur (78)
 * s'ajoute toujours à la fin. Réversible : window._rj177Uninstall().
 * =================================================================== */
(function () {
  "use strict";
  var ID = "177-biographie";
  var NAT = { FR: "français", GB: "britannique", DE: "allemand", IT: "italien", ES: "espagnol", BR: "brésilien", NL: "néerlandais", BE: "belge", MC: "monégasque", AU: "australien", CA: "canadien", MX: "mexicain", US: "américain", JP: "japonais", FI: "finlandais", AT: "autrichien", CH: "suisse", PT: "portugais", AR: "argentin", DK: "danois", SE: "suédois", PL: "polonais", IE: "irlandais", CN: "chinois", NZ: "néo-zélandais" };
  var STYLE = { attaquant: "un pilote offensif, redoutable au freinage", regulier: "un pilote régulier, fort dans la gestion des pneus", stratege: "un stratège qui lit les courses mieux que d'autres", complet: "un pilote complet, à l'aise sur tous les tracés" };
  var TRAIT = { leader: "un leader naturel dans le paddock", competiteur: "un compétiteur sans compromis", analyste: "un esprit analytique", medias: "un pilote à l'aise devant les caméras" };
  var NIVEAU = { "S+": "parmi les meilleurs pilotes du monde", S: "un pilote de niveau mondial", "A+": "un talent de très haut niveau", A: "un pilote confirmé à fort potentiel", "B+": "un compétiteur solide qui progresse", B: "un pilote en développement constant", "C+": "un jeune pilote qui forge son expérience", C: "un pilote en tout début de parcours" };
  var PAYS = { France: "FR", "Royaume-Uni": "GB", Allemagne: "DE", Italie: "IT", Espagne: "ES", "Brésil": "BR", "Pays-Bas": "NL", Belgique: "BE", Monaco: "MC", Australie: "AU", Canada: "CA", Mexique: "MX", "États-Unis": "US", Japon: "JP", Finlande: "FI", Autriche: "AT", Suisse: "CH", Portugal: "PT", Argentine: "AR", Danemark: "DK", "Suède": "SE", Pologne: "PL", Irlande: "IE", Chine: "CN", "Nouvelle-Zélande": "NZ" };
  var MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  var NOMBRES = ["zéro", "une", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix"];

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function n(x) { return x <= 10 ? NOMBRES[x] : String(x); }
  function pl(x, mot) { return n(x) + " " + mot + (x > 1 ? "s" : ""); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function rang(p) { return p === 1 ? "1er" : p + "e"; }
  function annee(s) { return G.pilot && G.pilot.startYear ? G.pilot.startYear + (s.saison - 1) : null; }
  function somme(L, k) { return L.reduce(function (a, s) { return a + (s[k] || 0); }, 0); }
  function ecuries(L) { var t = []; L.forEach(function (s) { if (s.team && s.team !== "Indépendant" && t.indexOf(s.team) < 0) t.push(s.team); }); return t; }
  function liste(t) { return t.length < 2 ? t.join("") : t.slice(0, -1).join(", ") + " et " + t[t.length - 1]; }

  /* Les saisons regroupées par catégorie, dans l'ordre de la carrière. */
  function etapes(S) {
    var E = [];
    S.forEach(function (s) { var e = E[E.length - 1]; if (!e || e.cat !== s.cat) E.push(e = { cat: s.cat, saisons: [] }); e.saisons.push(s); });
    return E;
  }
  function periode(e) {
    var a = annee(e.saisons[0]), b = annee(e.saisons[e.saisons.length - 1]);
    return a ? (a === b ? " en " + a : " de " + a + " à " + b) : "";
  }
  function titres(e) { return e.saisons.filter(function (s) { return s.pos === 1 && !s.current; }); }
  function meilleure(e) {
    return e.saisons.filter(function (s) { return !s.current && s.pos; }).sort(function (a, b) { return a.pos - b.pos || (b.wins || 0) - (a.wins || 0); })[0];
  }

  /* Une ligne par catégorie ancienne. */
  function resume(e) {
    var t = titres(e), m = meilleure(e), x = e.cat + " (" + pl(e.saisons.length, "saison");
    x += t.length ? ", champion" + (t.length > 1 ? " " + n(t.length) + " fois" : "") : m ? ", " + rang(m.pos) + " au mieux" : "";
    return x + ")";
  }
  /* Un vrai paragraphe pour les catégories récentes. */
  function recit(e, prenom, premier, suite) {
    var fini = e.saisons.filter(function (s) { return !s.current; });
    if (!fini.length) return "";
    var eq = ecuries(fini), t = titres(e), m = meilleure(e), v = somme(fini, "wins"), pod = somme(fini, "pods");
    var x = (premier ? "Il fait ses armes en " : suite ? "Il grimpe ensuite en " : "Il passe ensuite en ") + e.cat + periode({ saisons: fini }) + (eq.length ? ", chez " + liste(eq) : "") + ". ";
    if (t.length) x += "Il y décroche " + (t.length > 1 ? n(t.length) + " titres" : "le titre") + (annee(t[0]) ? " (" + t.map(annee).join(", ") + ")" : "") + ". ";
    else if (m) x += "Sa meilleure saison le place " + rang(m.pos) + " au championnat" + (annee(m) ? " en " + annee(m) : "") + ". ";
    if (v) x += cap(pl(v, "victoire")) + " et " + pl(pod, "podium") + " " + (v >= 5 ? "en font l'un des passages les plus marquants de sa carrière" : "jalonnent ce passage") + ".";
    else if (pod) x += "Pas encore de victoire, mais " + pl(pod, "podium") + " qui montrent le chemin.";
    else x += "Des saisons d'apprentissage, sans podium, qui l'ont endurci.";
    return x;
  }

  function bio(S) {
    var p = G.pilot || {}, prenom = p.prenom || "Le pilote", nom = (prenom + " " + (p.nom || "")).trim();
    var finies = S.filter(function (s) { return !s.current; }), cours = S.filter(function (s) { return s.current; })[0];
    var longue = finies.length >= 5, P = [];

    // 1. Portrait : complet au début, ramassé quand la carrière s'allonge
    var nat = NAT[p.nat] || NAT[PAYS[p.nat]] || "international", ne = "";
    if (p.dob && p.dob.year) ne = "Né " + (longue ? "en " + p.dob.year : "le " + (p.dob.day === 1 ? "1er" : p.dob.day || 1) + " " + MOIS[Math.max(0, Math.min(11, (p.dob.month || 1) - 1))] + " " + p.dob.year) + (p.birthCity && !longue ? " à " + p.birthCity : "") + ", ";
    var portrait = ne + nom + " est un pilote " + nat + " de " + G.age + " ans, aujourd'hui en " + G.cat + (G.currentTeam && G.currentTeam !== "Indépendant" ? " chez " + G.currentTeam : "") + ".";
    if (!longue) portrait += " C'est " + (STYLE[p.style] || "un pilote talentueux") + ", et " + (TRAIT[p.trait] || "un compétiteur") + ".";
    else if (STYLE[p.style]) portrait += " On le connaît comme " + STYLE[p.style].replace(/^un /, "un ") + ".";
    P.push(portrait);

    // 2. Parcours : les anciennes catégories en une ligne, les deux dernières racontées
    var E = etapes(S), recents = E.slice(-2), anciens = E.slice(0, -2);
    var parcours = "";
    if (!finies.length) parcours = cours && cours.races ? "Sa carrière démarre en " + G.cat + " : " + pl(cours.races, "manche") + " disputée" + (cours.races > 1 ? "s" : "") + " jusqu'ici." : "Sa carrière en compétition commence tout juste.";
    else {
      if (anciens.length) parcours += (anciens.length > 2 ? "Ses débuts se résument vite : " : "Avant cela : ") + liste(anciens.map(resume)) + ". ";
      parcours += recents.map(function (e, i) { return recit(e, prenom, !anciens.length && i === 0, i > 0); }).filter(Boolean).join(" ");
    }
    P.push(parcours.trim());

    // 3. La saison en cours
    if (cours && cours.races && finies.length) {
      var c = "Cette saison" + (finies.length && finies[finies.length - 1].cat !== cours.cat ? ", sa première en " + cours.cat : "") + ", il a disputé " + pl(cours.races, "manche");
      if (cours.wins) c += " pour " + pl(cours.wins, "victoire");
      c += cours.pos ? (cours.pos <= 3 ? " et se bat pour le titre, " + rang(cours.pos) + " au championnat." : " et pointe " + rang(cours.pos) + " au championnat.") : ".";
      P.push(c);
    }

    // 4. Palmarès en chiffres
    var v = somme(S, "wins"), po = somme(S, "poles"), pd = somme(S, "pods"), courses = somme(S, "races");
    var tt = S.filter(function (s) { return s.pos === 1 && !s.current; });
    if (tt.length || v || pd >= 3) P.push("En " + pl(courses, "course") + ", il compte " + [tt.length ? pl(tt.length, "titre") : "", v ? pl(v, "victoire") : "", po ? pl(po, "pole") : "", pd ? pl(pd, "podium") : ""].filter(Boolean).join(", ") + ".");
    else if (courses >= 3) P.push("Les victoires se font encore attendre, mais chaque manche l'a rendu plus solide.");

    // 5. Hors piste : académies et vie privée (résumées sur une longue carrière)
    var hors = [];
    try {
      var A = window.RJParcours ? RJParcours.liste() : [];
      if (A.length) {
        var act = A.filter(function (a) { return a.fin == null; })[0], dip = A.filter(function (a) { return a.diplome; })[0], passes = A.filter(function (a) { return a.fin != null && !a.diplome; });
        if (dip) hors.push("diplômé du " + dip.nom);
        else if (act) hors.push("membre du " + act.nom + " depuis " + act.debut);
        if (passes.length && !longue) hors.push("passé par " + liste(passes.map(function (a) { return a.nom; })));
      }
    } catch (e) {}
    try {
      var r = typeof getRelations === "function" ? getRelations().partner : null;
      if (r && r.name) hors.push("en couple avec " + r.name + (r.since && r.since.year && !longue ? " depuis " + r.since.year : ""));
    } catch (e) {}
    if (hors.length) P.push("Hors de la piste, il est " + liste(hors) + ".");

    // 6. Niveau et horizon
    var niv = typeof getRatingTier === "function" && typeof calcPlayerRating === "function" ? getRatingTier(calcPlayerRating()).tier : "";
    var f = prenom + " est aujourd'hui " + (NIVEAU[niv] || "un pilote en progression") + ".";
    var idx = ["Karting Junior", "Karting Senior", "Formule 4", "Formula Regional", "Formule 3", "Formule 2", "Formule 1"].indexOf(G.cat);
    f += idx === 6 ? " Arrivé au sommet, il se mesure désormais aux meilleurs du monde." : idx >= 4 ? " La Formule 1 n'est plus très loin." : idx >= 0 ? " Le chemin vers la Formule 1 est encore long, mais il est tracé." : "";
    P.push(f);
    return P.filter(Boolean).map(esc).join("<br><br>");
  }

  function boot() {
    if (typeof rjInscrire !== "function" || typeof generatePilotBio !== "function") return setTimeout(boot, 120);
    rjInscrire("generatePilotBio", { id: ID, ordre: -3000, remplace: function (args, suite) {
      try { return bio(args[0] || []); } catch (e) { console.warn("[177-biographie]", e && e.message); return suite(); }
    } });
    window.RJBiographie = { texte: bio };
    window._rj177Uninstall = function () { rjDesinscrire([ID], "generatePilotBio"); delete window.RJBiographie; };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
