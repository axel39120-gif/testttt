/* =====================================================================
 * 70-fin-de-saison.js — RÉTROSPECTIVE DE FIN DE SAISON
 *
 * REMPLACE le contenu de l'écran S-season-end. L'écran, son identifiant et
 * toutes les navigations qui y mènent sont conservés : seul le rendu change,
 * via une interception de showSeasonEnd(). Rien n'est édité dans 03 ni 04.
 *
 * CE QUE ÇA APPORTE
 * -----------------
 *  1. PALMARÈS PERSISTANT — il n'en existait aucun. Ni pour le joueur, ni
 *     pour les écuries, ni pour les pilotes du vivier. G.champPts ne garde
 *     que les points de la saison en cours, et le Panthéon exigeait déjà
 *     « minimum 1 championnat remporté » sans avoir de quoi le vérifier.
 *     Les titres sont désormais inscrits dans G._rjPalmares, sauvegardé
 *     avec la partie via _rj64Champs.
 *
 *  2. CHAMPIONS DE TOUTES LES CATÉGORIES — pilotes et écuries. Le vivier
 *     global de 04o-driver-pool fournit la matière. Sa simulation fantôme
 *     calcule en revanche le rang de chaque pilote indépendamment, à partir
 *     d'un tri par skill bruité à chaque appel : elle ne garantit pas un
 *     champion unique et cohérent par catégorie. On calcule donc un vrai
 *     classement, une fois, semé sur la saison (FNV + Mulberry32), de sorte
 *     que deux affichages de la même saison donnent le même vainqueur.
 *
 *  3. RÈGLES DE TITRE. Un champion d'une catégorie de formation ne peut
 *     plus y courir : c'est la règle réelle de la F2, transposée à toute la
 *     filière. Le titre l'oblige à monter, en respectant les fenêtres d'âge
 *     de la catégorie visée, et les chemins déclarés par CAT_PATHS. Les
 *     catégories terminales (F1, IndyCar, WEC, Super Formula) n'imposent
 *     rien : on peut y gagner et y rester.
 *
 *     L'application est faite APRÈS startNextSeason, donc après que
 *     04o a fait évoluer son vivier : on ne lui dispute pas la main, on
 *     corrige seulement les cas qui violent la règle.
 *
 *  4. MOUVEMENTS ATTENDUS pour la saison suivante, retraites, recrues.
 *     Au moment de la rétrospective la saison suivante n'a pas démarré :
 *     ce sont donc des mouvements déduits du classement et des règles de
 *     titre, présentés comme tels et non comme des faits accomplis.
 *
 *  5. DÉCLENCHEUR. Le bouton « avancer le temps » de l'accueil passe en
 *     doré quand une saison est terminée et non encore débriefée, et mène
 *     à cette page au lieu de l'action habituelle.
 *
 * Réversible : window._rj70Uninstall(). Diagnostic : window._rj70Status().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[70-fin-de-saison]";
  var OR = "#E9B949";

  var wrapped = {};
  var etat = { installe: false, derniereSaison: null, categories: 0, erreur: null };
  window._rj70Status = function () { return etat; };

  /* --------------------------------------------------------- tirages --- */
  function fnv(t) {
    var h = 2166136261; t = String(t);
    for (var i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }
  function mulberry(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ------------------------------------------------------ catégories --- */
  var CATS = ["Karting Junior", "Karting Senior", "Formule 4", "Formula Regional",
              "Formule 3", "Formule 2", "Formule 1", "Super Formula",
              "Endurance WEC", "IndyCar"];

  // Catégories de formation : y être sacré interdit d'y revenir.
  var FORMATION = {
    "Karting Junior": 1, "Karting Senior": 1, "Formule 4": 1,
    "Formula Regional": 1, "Formule 3": 1, "Formule 2": 1
  };

  // Fenêtres d'âge, utilisées pour choisir une promotion crédible.
  var AGES = {
    "Karting Junior":   { min: 8,  max: 15 },
    "Karting Senior":   { min: 12, max: 18 },
    "Formule 4":        { min: 14, max: 20 },
    "Formula Regional": { min: 15, max: 22 },
    "Formule 3":        { min: 16, max: 24 },
    "Formule 2":        { min: 17, max: 27 },
    "Formule 1":        { min: 17, max: 45 },
    "Super Formula":    { min: 17, max: 40 },
    "Endurance WEC":    { min: 17, max: 48 },
    "IndyCar":          { min: 17, max: 45 }
  };

  function chemins(cat) {
    try {
      if (typeof CAT_PATHS !== "undefined" && CAT_PATHS && CAT_PATHS[cat]) return CAT_PATHS[cat].slice();
    } catch (e) {}
    var i = CATS.indexOf(cat);
    return (i >= 0 && i < 6) ? [CATS[i + 1]] : [];
  }

  // Première destination compatible avec l'âge ; à défaut, la première tout
  // court — mieux vaut une promotion imparfaite qu'un pilote coincé dans une
  // catégorie où il n'a plus le droit de courir.
  function destination(cat, age) {
    var opts = chemins(cat);
    for (var i = 0; i < opts.length; i++) {
      var a = AGES[opts[i]];
      if (!a || (age >= a.min && age <= a.max)) return opts[i];
    }
    return opts.length ? opts[0] : null;
  }

  /* --------------------------------------------------------- palmarès --- */
  function P() {
    if (typeof G === "undefined" || !G) return null;
    if (!G._rjPalmares) {
      G._rjPalmares = { saisons: [], joueur: { titres: [], bannis: [] }, ecuries: {}, pilotes: {} };
    }
    var p = G._rjPalmares;
    if (!p.joueur) p.joueur = { titres: [], bannis: [] };
    if (!p.joueur.titres) p.joueur.titres = [];
    if (!p.joueur.bannis) p.joueur.bannis = [];
    if (!p.ecuries) p.ecuries = {};
    if (!p.pilotes) p.pilotes = {};
    if (!p.saisons) p.saisons = [];
    return p;
  }

  function saisonCourante() { try { return G.saison || 1; } catch (e) { return 1; } }
  function anneeCourante() {
    try { return G.gameYear || (G.pilot && G.pilot.startYear) || 2024; } catch (e) { return 2024; }
  }

  function inscrireTitre(cible, cat, saison, annee) {
    var p = P(); if (!p) return;
    if (!p[cible.type][cible.cle]) p[cible.type][cible.cle] = [];
    var l = p[cible.type][cible.cle];
    for (var i = 0; i < l.length; i++) if (l[i].saison === saison && l[i].cat === cat) return;
    l.push({ cat: cat, saison: saison, annee: annee });
  }

  /* ----------------------------------------------- classements simulés --- */
  function vivier() {
    try { return (G.driverPool || []).filter(function (d) { return d && !d.retired; }); }
    catch (e) { return []; }
  }

  // Classement déterministe d'une catégorie : force du pilote, régularité,
  // et un aléa semé sur la saison. Deux appels donnent le même résultat.
  function classement(cat, saison) {
    var liste = vivier().filter(function (d) { return d.cat === cat; });
    if (!liste.length) return null;
    var rnd = mulberry(fnv("cat|" + cat + "|" + saison));
    var notes = liste.map(function (d) {
      var skill = (typeof d.skill === "number") ? d.skill : 60;
      var reg = (typeof d.consistency === "number") ? d.consistency : 0.7;
      var alea = (rnd() - 0.5) * 9;
      return { d: d, note: skill + reg * 8 + alea };
    });
    notes.sort(function (a, b) { return b.note - a.note; });

    var n = notes.length;
    var pts = notes.map(function (x, i) {
      var base = Math.max(0, Math.round((n - i) * 6 + (n - i) * (n - i) * 0.12));
      return { pilote: x.d, points: base };
    });

    // Titre constructeur : cumul des points des pilotes de chaque écurie.
    var parEcurie = {};
    pts.forEach(function (x) {
      var t = x.pilote.team || "Indépendant";
      parEcurie[t] = (parEcurie[t] || 0) + x.points;
    });
    var ecuries = Object.keys(parEcurie).map(function (t) { return { nom: t, points: parEcurie[t] }; });
    ecuries.sort(function (a, b) { return b.points - a.points; });

    return { cat: cat, pilotes: pts, ecuries: ecuries };
  }

  /* ------------------------------------------------- couronnement --- */
  function chiffres() {
    var r = { courses: 0, victoires: 0, podiums: 0, points: 0, abandons: 0, top10: 0, meilleure: null };
    try {
      var l = G.races || [];
      for (var i = 0; i < l.length; i++) {
        var c = l[i]; if (!c) continue;
        r.courses++;
        r.points += (c.pts || 0);
        if (c.dnf || c.pos == null) { r.abandons++; continue; }
        if (c.pos === 1) r.victoires++;
        if (c.pos <= 3) r.podiums++;
        if (c.pos <= 10) r.top10++;
        if (r.meilleure === null || c.pos < r.meilleure) r.meilleure = c.pos;
      }
    } catch (e) {}
    return r;
  }

  function dejaCouronnee(saison) {
    var p = P(); if (!p) return false;
    for (var i = 0; i < p.saisons.length; i++) if (p.saisons[i].saison === saison) return true;
    return false;
  }

  function resultatJoueur() {
    var r = { cat: null, pos: null, points: 0, titre: false };
    try {
      r.cat = G.cat || null;
      r.points = G.champPts || 0;
      if (typeof getChampionshipStandings === "function") {
        var st = getChampionshipStandings();
        if (st && st.length) {
          for (var i = 0; i < st.length; i++) {
            if (st[i] && (st[i].me || st[i].isPlayer)) { r.pos = i + 1; break; }
          }
        }
      }
      if (r.pos === null && G.rivals && G.rivals.length) {
        var mieux = 0;
        for (var j = 0; j < G.rivals.length; j++) {
          if ((G.rivals[j].pts || 0) > r.points) mieux++;
        }
        r.pos = mieux + 1;
      }
      r.titre = (r.pos === 1);
    } catch (e) {}
    return r;
  }

  function couronner() {
    var p = P(); if (!p) return null;
    var saison = saisonCourante(), annee = anneeCourante();
    if (dejaCouronnee(saison)) {
      for (var k = 0; k < p.saisons.length; k++) if (p.saisons[k].saison === saison) return p.saisons[k];
    }

    var joueur = resultatJoueur();
    var bilan = { saison: saison, annee: annee, joueur: joueur, categories: {}, mouvements: [] };

    for (var i = 0; i < CATS.length; i++) {
      var cat = CATS[i];
      var cl = classement(cat, saison);

      // La catégorie du joueur : c'est SON championnat qui fait foi, pas la
      // simulation du vivier. Sinon le jeu couronnerait quelqu'un d'autre
      // dans la catégorie que le joueur vient de gagner en piste.
      if (cat === joueur.cat && joueur.titre) {
        var nomJ = "";
        try { nomJ = ((G.pilot.prenom || "") + " " + (G.pilot.nom || "")).trim(); } catch (e) {}
        var eqJ = "";
        try { eqJ = G.currentTeam || "Indépendant"; } catch (e) {}
        bilan.categories[cat] = {
          pilote: { nom: nomJ || "Toi", id: "__joueur", team: eqJ, points: joueur.points, estJoueur: true },
          ecurie: { nom: eqJ || "Indépendant", points: joueur.points }
        };
        inscrireTitre({ type: "joueur", cle: "titres" }, cat, saison, annee);
        if (eqJ) inscrireTitre({ type: "ecuries", cle: eqJ }, cat, saison, annee);
        if (FORMATION[cat]) {
          if (p.joueur.bannis.indexOf(cat) < 0) p.joueur.bannis.push(cat);
          bilan.mouvements.push({
            type: "regle", cat: cat, qui: nomJ || "Toi", estJoueur: true,
            vers: destination(cat, (G.age || 18)),
            texte: "Titre en " + cat + " — tu ne peux plus y courir."
          });
        }
        continue;
      }

      if (!cl || !cl.pilotes.length) continue;
      var champ = cl.pilotes[0], champEc = cl.ecuries[0];
      bilan.categories[cat] = {
        pilote: {
          nom: champ.pilote.name || "Pilote", id: champ.pilote.id,
          team: champ.pilote.team || "Indépendant", points: champ.points
        },
        ecurie: champEc ? { nom: champEc.nom, points: champEc.points } : null
      };

      if (champ.pilote.id != null) inscrireTitre({ type: "pilotes", cle: String(champ.pilote.id) }, cat, saison, annee);
      if (champEc && champEc.nom) inscrireTitre({ type: "ecuries", cle: champEc.nom }, cat, saison, annee);

      // Règle de titre : interdiction de revenir dans une catégorie de formation.
      if (FORMATION[cat]) {
        var d = champ.pilote;
        if (!d._rjBanni) d._rjBanni = [];
        if (d._rjBanni.indexOf(cat) < 0) d._rjBanni.push(cat);
        var vers = destination(cat, d.age || 18);
        bilan.mouvements.push({
          type: "regle", cat: cat, qui: d.name || "Pilote", vers: vers,
          texte: (d.name || "Pilote") + " est sacré en " + cat +
                 (vers ? " et doit monter en " + vers + "." : " et quitte la catégorie.")
        });
      }
    }

    // CUMUL DE CARRIERE — startNextSeason vide G.races a chaque changement
    // de saison. Les victoires, podiums et departs etaient donc perdus, et
    // le calcul des points de partie du module 74, qui lisait G.races, ne
    // voyait que la saison en cours. On totalise ici, au moment ou la
    // saison est couronnee, dans un champ persistant.
    if (!p.carriere) {
      p.carriere = { victoires: 0, podiums: 0, departs: 0, abandons: 0, pointsChamp: 0, meilleure: null };
    }
    var n = chiffres();
    bilan.chiffres = {
      courses: n.courses, victoires: n.victoires, podiums: n.podiums,
      abandons: n.abandons, points: n.points, meilleure: n.meilleure
    };
    p.carriere.victoires += n.victoires;
    p.carriere.podiums += n.podiums;
    p.carriere.departs += n.courses;
    p.carriere.abandons += n.abandons;
    p.carriere.pointsChamp += n.points;
    if (n.meilleure !== null && (p.carriere.meilleure === null || n.meilleure < p.carriere.meilleure)) {
      p.carriere.meilleure = n.meilleure;
    }

    p.saisons.push(bilan);
    if (p.saisons.length > 40) p.saisons.shift();
    etat.derniereSaison = saison;
    etat.categories = Object.keys(bilan.categories).length;
    sauver();
    return bilan;
  }

  function sauver() {
    try { if (typeof saveGame === "function") saveGame((G && G._slot) || 0); } catch (e) {}
  }

  /* ------------------------------------- application des règles ------- */
  // Passe corrective exécutée APRÈS startNextSeason : 04o a déjà fait
  // évoluer son vivier, on ne rectifie que les cas interdits.
  function faireRespecterLesRegles() {
    var pool = vivier();
    var corriges = 0;
    for (var i = 0; i < pool.length; i++) {
      var d = pool[i];
      if (!d._rjBanni || !d._rjBanni.length) continue;
      if (d._rjBanni.indexOf(d.cat) < 0) continue;

      var vers = destination(d.cat, d.age || 18);
      if (!vers) {
        // Aucune destination : le pilote quitte la filière plutôt que de
        // rester dans une catégorie où il n'a plus le droit de courir.
        d.retired = true;
        corriges++;
        continue;
      }
      d.cat = vers;
      corriges++;
    }
    if (corriges) console.log(TAG + " règles de titre appliquées à " + corriges + " pilote(s)");
    return corriges;
  }

  /* ------------------------------------------------------------ vues --- */
  function css() {
    if (document.getElementById("rj70-css")) return;
    var st = document.createElement("style");
    st.id = "rj70-css";
    st.textContent = [
      ".rj70{padding:14px 14px 22px}",
      ".rj70-hero{text-align:center;padding:22px 14px 20px;border-radius:16px;",
      "background:var(--bg2);border:1px solid var(--border-hi);margin-bottom:10px}",
      ".rj70-an{font-family:var(--font-display);font-size:10px;font-weight:800;letter-spacing:.16em;",
      "text-transform:uppercase;color:var(--text3);margin-bottom:8px}",
      ".rj70-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px}",
      ".rj70-st{background:var(--bg2);border-radius:11px;padding:11px 4px;text-align:center}",
      ".rj70-stv{font-family:var(--font-display);font-size:19px;font-weight:900;color:#fff;line-height:1}",
      ".rj70-stl{font-size:9.5px;color:var(--text3);letter-spacing:.06em;text-transform:uppercase;margin-top:4px}",
      ".rj70-pl{border:1px solid var(--border);border-radius:12px;margin-bottom:7px;overflow:hidden;",
      "background:var(--bg2)}",
      ".rj70-pl[open]{border-color:var(--border-hi)}",
      ".rj70-sm{list-style:none;display:flex;align-items:center;gap:9px;padding:13px 13px;cursor:pointer;",
      "-webkit-tap-highlight-color:transparent}",
      ".rj70-sm::-webkit-details-marker{display:none}",
      ".rj70-smt{font-family:var(--font-display);font-size:12px;font-weight:800;color:#fff;",
      "letter-spacing:.03em;flex:1}",
      ".rj70-smr{font-size:11px;color:var(--text3)}",
      ".rj70-chev{width:8px;height:8px;border-right:1.5px solid var(--text3);flex-shrink:0;",
      "border-bottom:1.5px solid var(--text3);transform:rotate(45deg) translateY(-2px);transition:transform .2s}",
      ".rj70-pl[open] .rj70-chev{transform:rotate(225deg) translateY(-2px)}",
      ".rj70-plc{padding:0 13px 12px}",
      ".rj70-kv>div{display:flex;justify-content:space-between;align-items:baseline;padding:7px 0;",
      "border-top:1px solid var(--border);font-size:12.5px}",
      ".rj70-kv span{color:var(--text3)}",
      ".rj70-kv b{color:#fff;font-family:var(--font-display);font-weight:800}",
      ".rj70-hl{display:flex;align-items:baseline;gap:10px;padding:7px 0;border-top:1px solid var(--border);font-size:12.5px}",
      ".rj70-hl span{color:var(--text3);font-family:var(--font-display);font-weight:800;flex:0 0 42px}",
      ".rj70-hl b{color:var(--text);font-weight:600;flex:1}",
      ".rj70-hl em{font-style:normal;color:" + OR + ";font-family:var(--font-display);font-weight:800;font-size:11.5px}",
      ".rj70-note{font-size:11px;color:var(--text3);line-height:1.45;margin-top:8px;",
      "padding-top:8px;border-top:1px solid var(--border)}",
      ".rj70-hero.titre{border-color:" + OR + ";background:rgba(233,185,73,.07)}",
      ".rj70-couronne{font-family:var(--font-display);font-size:10px;font-weight:800;letter-spacing:.18em;",
      "text-transform:uppercase;color:" + OR + ";margin-bottom:6px}",
      ".rj70-h1{font-family:var(--font-display);font-size:32px;font-weight:900;color:#fff;line-height:1.05;letter-spacing:-.01em}",
      ".rj70-h2{font-size:13px;color:var(--text2);margin-top:7px}",
      ".rj70-sec{font-family:var(--font-display);font-size:10px;font-weight:800;color:var(--dim,#6b6b78);",
      "letter-spacing:.14em;text-transform:uppercase;margin:18px 0 8px}",
      ".rj70-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--border)}",
      ".rj70-cat{flex:0 0 104px;font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;",
      "color:var(--text3);font-family:var(--font-display);line-height:1.25}",
      ".rj70-who{flex:1;min-width:0}",
      ".rj70-p{font-size:13.5px;color:#fff;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".rj70-t{font-size:11.5px;color:var(--text3);margin-top:1px}",
      ".rj70-pts{flex:0 0 auto;font-family:var(--font-display);font-size:13px;font-weight:900;color:var(--text2)}",
      ".rj70-moi .rj70-p{color:" + OR + "}",
      ".rj70-card{border:1px solid var(--border);border-radius:11px;padding:11px 12px;margin-bottom:8px;background:var(--bg2)}",
      ".rj70-mv{font-size:12.5px;color:var(--text);line-height:1.5;padding:7px 0;border-top:1px solid var(--border)}",
      ".rj70-mv b{color:" + OR + "}",
      ".rj70-pal{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}",
      ".rj70-badge{font-family:var(--font-display);font-size:10px;font-weight:800;letter-spacing:.06em;",
      "text-transform:uppercase;padding:5px 9px;border-radius:999px;border:1px solid " + OR + ";",
      "color:" + OR + ";background:rgba(233,185,73,.08)}",
      ".rj70-vide{font-size:12.5px;color:var(--text3);padding:10px 0}",
      ".rj70-ver{text-align:center;font-size:9.5px;color:var(--text4,#404048);letter-spacing:.1em;",
      "text-transform:uppercase;margin-top:14px}",
      ".rj70-btns{margin-top:10px;display:flex;flex-direction:column;gap:8px}",
      ".rj70-btn{width:100%;padding:13px;border-radius:11px;font-family:var(--font-display);font-size:12px;",
      "font-weight:800;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;",
      "-webkit-appearance:none;appearance:none}",
      ".rj70-btn.p{background:" + OR + ";border:0;color:#171410}",
      ".rj70-btn.s{background:transparent;border:1px solid var(--border-hi);color:var(--text2)}",
      /* bouton doré de l'accueil */
      /* Bouton « Continuer » du menu du bas — c'est CELUI-CI que le joueur
         voit et utilise. La couleur vient de .ni-cta-icon et .ni-cta-ring,
         pas du bouton lui-même. */
      "#ni-cta-continue.rj70-or .ni-cta-icon{background:linear-gradient(135deg," + OR + " 0%,#C9962F 100%);",
      "box-shadow:0 8px 24px rgba(233,185,73,.5),0 0 0 1px rgba(255,255,255,.10) inset,0 -2px 4px rgba(0,0,0,.3) inset}",
      "#ni-cta-continue.rj70-or .ni-cta-ring{background:radial-gradient(circle,rgba(233,185,73,.42) 0%,transparent 65%)}",
      ".apex-hero-race.rj70-or{border-color:" + OR + "66}",
      ".apex-hero-race.rj70-or::before{background:linear-gradient(90deg,transparent 0%," + OR + " 30%," + OR + " 70%,transparent 100%)}",
      ".apex-hero-race.rj70-or::after{background:radial-gradient(circle,rgba(233,185,73,.30) 0%,transparent 70%)}"
    ].join("");
    document.head.appendChild(st);
  }

  function ech(t) {
    return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Bilan chiffré de la saison du joueur, reconstruit depuis ses courses.
  function stat(valeur, libelle, or) {
    return '<div class="rj70-st"><div class="rj70-stv"' + (or ? ' style="color:' + OR + '"' : '') + '>' +
           ech(valeur) + '</div><div class="rj70-stl">' + ech(libelle) + '</div></div>';
  }

  function pliant(titre, resume, contenu, ouvert) {
    return '<details class="rj70-pl"' + (ouvert ? ' open' : '') + '>' +
      '<summary class="rj70-sm"><span class="rj70-smt">' + ech(titre) + '</span>' +
      '<span class="rj70-smr">' + ech(resume) + '</span>' +
      '<span class="rj70-chev" aria-hidden="true"></span></summary>' +
      '<div class="rj70-plc">' + contenu + '</div></details>';
  }

  function rendre() {
    var scr = document.getElementById("S-season-end");
    if (!scr) return false;
    css();
    var bilan = couronner();
    if (!bilan) return false;
    var p = P();
    var j = bilan.joueur;
    var n = chiffres();

    var h = '<div class="rj70">';

    /* ---- 1. Ce qui compte : la saison du joueur, toujours visible ---- */
    h += '<div class="rj70-hero' + (j.titre ? " titre" : "") + '">' +
      '<div class="rj70-an">' + ech(bilan.annee) + ' · ' + ech(j.cat || "") + '</div>' +
      '<div class="rj70-h1">' + (j.titre ? "Champion" : (j.pos ? "P" + j.pos : "Saison terminée")) + '</div>' +
      (j.titre ? '<div class="rj70-h2">Titre remporté en ' + ech(j.cat || "") + '</div>'
               : '<div class="rj70-h2">' + (j.pos ? j.pos + "ᵉ du championnat" : "Bilan de la saison " + bilan.saison) + '</div>') +
      '</div>';

    h += '<div class="rj70-stats">' +
      stat(n.points, "points", true) +
      stat(n.victoires, n.victoires > 1 ? "victoires" : "victoire") +
      stat(n.podiums, "podiums") +
      stat(n.courses, "courses") +
      '</div>';

    /* ---- 2. Palmarès : court, toujours visible ---- */
    if (p.joueur.titres.length) {
      h += '<div class="rj70-pal">' + p.joueur.titres.slice(-6).map(function (t) {
        return '<span class="rj70-badge">' + ech(t.cat) + " " + ech(t.annee) + '</span>';
      }).join("") + '</div>';
    }

    /* ---- 3. Le reste, replié ---- */
    var detail = '<div class="rj70-kv">' +
      '<div><span>Meilleur résultat</span><b>' + (n.meilleure ? "P" + n.meilleure : "—") + '</b></div>' +
      '<div><span>Arrivées dans les points</span><b>' + n.top10 + '</b></div>' +
      '<div><span>Abandons</span><b>' + n.abandons + '</b></div>' +
      '<div><span>Écurie</span><b>' + ech((function () { try { return G.currentTeam || "Indépendant"; } catch (e) { return "—"; } })()) + '</b></div>' +
      '</div>';
    h += pliant("Ma saison en détail", n.courses + " courses", detail, false);

    var autres = "";
    for (var i = 0; i < CATS.length; i++) {
      var c = bilan.categories[CATS[i]];
      if (!c || CATS[i] === j.cat) continue;
      autres += '<div class="rj70-row">' +
        '<div class="rj70-cat">' + ech(CATS[i]) + '</div>' +
        '<div class="rj70-who"><div class="rj70-p">' + ech(c.pilote.nom) + '</div>' +
        '<div class="rj70-t">' + ech(c.ecurie ? c.ecurie.nom : c.pilote.team) + '</div></div></div>';
    }
    var mienne = bilan.categories[j.cat];
    if (mienne) {
      autres = '<div class="rj70-row rj70-moi">' +
        '<div class="rj70-cat">' + ech(j.cat) + '</div>' +
        '<div class="rj70-who"><div class="rj70-p">' + ech(mienne.pilote.nom) + '</div>' +
        '<div class="rj70-t">' + ech(mienne.ecurie ? mienne.ecurie.nom : mienne.pilote.team) + '</div></div></div>' + autres;
    }
    h += pliant("Champions " + bilan.annee, Object.keys(bilan.categories).length + " catégories",
                autres || '<div class="rj70-vide">Vivier indisponible.</div>', false);

    var mv = bilan.mouvements.length
      ? bilan.mouvements.map(function (m) {
          return '<div class="rj70-mv">' + (m.estJoueur ? "<b>" + ech(m.texte) + "</b>" : ech(m.texte)) + '</div>';
        }).join("") + '<div class="rj70-note">Un champion d\'une catégorie de formation ne peut plus y courir la saison suivante.</div>'
      : '<div class="rj70-vide">Aucun changement imposé par les règles de titre.</div>';
    h += pliant("Mouvements", bilan.mouvements.length ? bilan.mouvements.length + " changements" : "aucun", mv, false);

    if (p.saisons.length > 1) {
      var hist = p.saisons.slice(0, -1).reverse().slice(0, 8).map(function (b) {
        var mien = b.categories && b.categories[b.joueur.cat];
        var champ = (mien && mien.pilote.estJoueur) ? "Titre" : (b.joueur.pos ? "P" + b.joueur.pos : "—");
        return '<div class="rj70-hl"><span>' + ech(b.annee) + '</span><b>' + ech(b.joueur.cat || "") + '</b><em>' + ech(champ) + '</em></div>';
      }).join("");
      h += pliant("Saisons précédentes", p.saisons.length - 1 + " saisons", hist, false);
    }

    // Repère de version : permet de vérifier d'un coup d'œil quelle mise en
    // page est réellement servie, sans dépendre du cache du navigateur.
    h += '<div class="rj70-ver">bilan v2 · cartes dépliantes</div>';

    h += '<div class="rj70-btns">' +
      '<button class="rj70-btn p" type="button" onclick="_rj70Transferts()">Période des transferts →</button>' +
      '<button class="rj70-btn s" type="button" onclick="_rj70Accueil()">Retour accueil</button>' +
      '</div></div>';

    var corps = scr.querySelector(".scroll") || scr;
    var mien2 = corps.querySelector(".rj70");
    if (mien2 && mien2.parentNode) mien2.parentNode.removeChild(mien2);
    var enfants = corps.children;
    for (var ci = 0; ci < enfants.length; ci++) {
      var el = enfants[ci];
      if (el.classList && el.classList.contains("rj70")) continue;
      if (!el.hasAttribute("data-rj70-hidden")) {
        el.setAttribute("data-rj70-hidden", el.style.display || "");
        el.style.display = "none";
      }
    }
    var boite = document.createElement("div");
    boite.innerHTML = h;
    corps.appendChild(boite.firstChild);

    var sub = document.getElementById("se-sub");
    if (sub) sub.textContent = "Saison " + bilan.saison + " · " + bilan.annee;
    return true;
  }

  window._rj70Transferts = function () {
    try { if (typeof goTransferWindow === "function") { goTransferWindow(); return; } } catch (e) {}
    try { navTo("S-transfer", "ni-home"); } catch (e) {}
  };
  window._rj70Accueil = function () {
    // On ne touche plus à G.seasonOver : le bilan doit rester accessible
    // tant que la saison suivante n'a pas démarré.
    majBouton();
    try { navTo("S-home", "ni-home"); } catch (e) {}
  };
  window._rj70Rendre = rendre;
  window._rj70MajBouton = majBouton;
  window._rj70Regles = faireRespecterLesRegles;

  /* ------------------------------------------------ bouton de l'accueil --- */
  // Une saison est à débriefer si toutes les manches du calendrier sont
  // courues ET qu'elle n'a pas encore été couronnée. On ne se fie plus au
  // seul drapeau G.seasonOver : au chargement d'une sauvegarde faite en fin
  // de saison, il revient à faux et le bilan devenait inaccessible.
  // Une fois la saison inscrite au palmarès, la condition retombe d'elle-même,
  // donc le bouton doré ne peut pas rester allumé indéfiniment.
  function calendrierTermine() {
    try {
      var cal = (typeof CAL_RACES !== "undefined" && CAL_RACES) ? CAL_RACES : G.calRaces;
      if (cal && cal.length) {
        for (var i = 0; i < cal.length; i++) if (cal[i] && !cal[i].done) return false;
        return true;
      }
      if (G.races && G.races.length && G.calRaces && G.calRaces.length) {
        return G.races.length >= G.calRaces.length;
      }
    } catch (e) {}
    return false;
  }

  function saisonADebriefer() {
    try {
      // CORRECTIF — on testait ici « saison déjà couronnée ». Or couronner()
      // s'exécute dès le PREMIER affichage du bilan : dès qu'on ouvrait
      // l'écran puis qu'on revenait en arrière, la condition retombait, le
      // bouton repassait au rouge et l'accès au bilan était définitivement
      // perdu — le clic retombait sur le comportement d'origine, qui n'a
      // rien à faire quand la saison est finie.
      //
      // Le bon critère est le calendrier seul. Il se réinitialise tout seul
      // au démarrage de la saison suivante, puisque les manches repassent
      // à « non courues » : le bouton ne peut donc pas rester doré
      // indéfiniment, et le bilan reste consultable autant de fois qu'on
      // veut tant qu'on n'a pas lancé la saison suivante.
      if (G.seasonOver) return true;
      return calendrierTermine();
    } catch (e) { return false; }
  }

  function majBouton() {
    try {
      var el = document.querySelector(".apex-hero-race");
      if (!el) return;
      var actif = saisonADebriefer();
      if (actif) el.classList.add("rj70-or");
      else el.classList.remove("rj70-or");

      // Le bouton effectivement utilisé par le joueur est celui du menu du
      // bas. La carte d'accueil ne suffisait pas.
      var cta = document.getElementById("ni-cta-continue");
      if (cta) {
        if (actif) cta.classList.add("rj70-or");
        else cta.classList.remove("rj70-or");
      }

      // Le libellé de l'accueil continuait d'annoncer « Prochaine course
      // Manche 18 » alors que la saison était terminée et que le bouton
      // menait au bilan. On le remplace, et on restaure l'original dès que
      // la saison est débriefée.
      // ATTENTION : #h-race-tag CONTIENT #h-race-s. Réécrire son innerHTML
      // supprimait #h-race-s du document, et updateUI() plantait ensuite sur
      // « Cannot set properties of null » — ce qui bloquait startNextSeason,
      // donc le bouton « Continuer » de la période des transferts. On ne
      // touche donc plus qu'au texte de #h-race-s et à la pastille.
      var sub = document.getElementById("h-race-s");
      var tag = document.getElementById("h-race-tag");
      var pastille = tag ? tag.querySelector("span:not(#h-race-s)") : null;
      if (actif) {
        if (sub && sub.textContent !== "Bilan de saison") sub.textContent = "Bilan de saison";
        if (pastille) pastille.style.background = OR;
      } else if (pastille) {
        pastille.style.background = "";
      }
    } catch (e) {}
  }

  /* ---------------------------------------------------------- montage --- */
  function installer() {
    var ok = false;

    if (typeof window.showSeasonEnd === "function" && !window.showSeasonEnd._rj70) {
      var origShow = window.showSeasonEnd;
      var fnShow = function () {
        var r;
        try { r = origShow.apply(this, arguments); } catch (e) { console.warn(TAG, e); }
        try { setTimeout(rendre, 0); } catch (e) {}
        try { setTimeout(majBouton, 30); } catch (e) {}
        return r;
      };
      fnShow._rj70 = true;
      wrapped.showSeasonEnd = origShow;
      window.showSeasonEnd = fnShow;
      ok = true;
    }

    if (typeof window.advanceToNextMoment === "function" && !window.advanceToNextMoment._rj70) {
      var origAdv = window.advanceToNextMoment;
      var fnAdv = function () {
        try {
          var cur = document.querySelector(".scr.on");
          var id = cur ? cur.id : "";
          if (saisonADebriefer() && id === "S-home") {
            css();
            try { navTo("S-season-end", "ni-home"); } catch (e) {}
            setTimeout(rendre, 0);
            return;
          }
        } catch (e) { etat.erreur = String(e && e.message || e); }
        return origAdv.apply(this, arguments);
      };
      fnAdv._rj70 = true;
      wrapped.advanceToNextMoment = origAdv;
      window.advanceToNextMoment = fnAdv;
      ok = true;
    }

    // Règles de titre appliquées après l'évolution du vivier.
    if (typeof window.startNextSeason === "function" && !window.startNextSeason._rj70) {
      var origNext = window.startNextSeason;
      var fnNext = function () {
        var r = origNext.apply(this, arguments);
        try { faireRespecterLesRegles(); sauver(); } catch (e) { console.warn(TAG, e); }
        try { majBouton(); } catch (e) {}
        return r;
      };
      fnNext._rj70 = true;
      wrapped.startNextSeason = origNext;
      window.startNextSeason = fnNext;
    }

    // Le champ doit être sauvegardé avec la partie.
    try { if (typeof window._rj64Champs === "function") window._rj64Champs("_rjPalmares"); } catch (e) {}

    return ok;
  }

  var essais = 0;
  function boot() {
    var pret = false;
    try { pret = installer(); } catch (e) { etat.erreur = String(e && e.message || e); }
    if (!pret) { if (essais++ < 120) { setTimeout(boot, 100); return; } }

    css();
    majBouton();
    // Le bouton doit virer à l'or dès que la saison se termine, sans attendre
    // un rechargement : on surveille les retours sur l'accueil.
    try {
      if (typeof window.navTo === "function" && !window.navTo._rj70) {
        var origNav = window.navTo;
        var fnNav = function () {
          var r = origNav.apply(this, arguments);
          try { setTimeout(majBouton, 20); } catch (e) {}
          return r;
        };
        fnNav._rj70 = true;
        wrapped.navTo = origNav;
        window.navTo = fnNav;
      }
    } catch (e) {}

    etat.installe = true;
    console.log(TAG + " actif — palmarès persistant, champions des " + CATS.length +
                " catégories, règles de titre" + (pret ? "" : " (interception partielle)"));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj70Uninstall = function () {
    Object.keys(wrapped).forEach(function (k) { window[k] = wrapped[k]; });
    var st = document.getElementById("rj70-css");
    if (st && st.parentNode) st.parentNode.removeChild(st);
    var el = document.querySelector(".apex-hero-race");
    if (el) el.classList.remove("rj70-or");
    var cta = document.getElementById("ni-cta-continue");
    if (cta) cta.classList.remove("rj70-or");
    etat.installe = false;
    console.log(TAG + " désinstallé");
  };
})();
