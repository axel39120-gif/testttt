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
      ".rj70-hero{text-align:center;padding:14px 10px 16px;border-radius:14px;",
      "background:var(--bg2);border:1px solid var(--border-hi);margin-bottom:14px}",
      ".rj70-hero.titre{border-color:" + OR + ";background:rgba(233,185,73,.07)}",
      ".rj70-couronne{font-family:var(--font-display);font-size:10px;font-weight:800;letter-spacing:.18em;",
      "text-transform:uppercase;color:" + OR + ";margin-bottom:6px}",
      ".rj70-h1{font-family:var(--font-display);font-size:23px;font-weight:900;color:#fff;line-height:1.15}",
      ".rj70-h2{font-size:12.5px;color:var(--text2);margin-top:5px}",
      ".rj70-sec{font-family:var(--font-display);font-size:10px;font-weight:800;color:var(--dim,#6b6b78);",
      "letter-spacing:.14em;text-transform:uppercase;margin:18px 0 8px}",
      ".rj70-row{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--border)}",
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
      ".rj70-pal{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}",
      ".rj70-badge{font-family:var(--font-display);font-size:10px;font-weight:800;letter-spacing:.06em;",
      "text-transform:uppercase;padding:5px 9px;border-radius:999px;border:1px solid " + OR + ";",
      "color:" + OR + ";background:rgba(233,185,73,.08)}",
      ".rj70-vide{font-size:12.5px;color:var(--text3);padding:10px 0}",
      ".rj70-btns{margin-top:20px;display:flex;flex-direction:column;gap:8px}",
      ".rj70-btn{width:100%;padding:13px;border-radius:11px;font-family:var(--font-display);font-size:12px;",
      "font-weight:800;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;",
      "-webkit-appearance:none;appearance:none}",
      ".rj70-btn.p{background:" + OR + ";border:0;color:#171410}",
      ".rj70-btn.s{background:transparent;border:1px solid var(--border-hi);color:var(--text2)}",
      /* bouton doré de l'accueil */
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

  function rendre() {
    var scr = document.getElementById("S-season-end");
    if (!scr) return false;
    css();
    var bilan = couronner();
    if (!bilan) return false;
    var p = P();

    var j = bilan.joueur;
    var h = '<div class="rj70">';

    h += '<div class="rj70-hero' + (j.titre ? " titre" : "") + '">' +
      (j.titre ? '<div class="rj70-couronne">Champion ' + ech(bilan.annee) + '</div>' : '') +
      '<div class="rj70-h1">' + (j.titre ? "Titre remporté" : "Saison " + bilan.saison + " terminée") + '</div>' +
      '<div class="rj70-h2">' + ech(j.cat || "") +
      (j.pos ? " · P" + j.pos : "") + " · " + (j.points || 0) + ' pts</div></div>';

    // Palmarès du joueur
    h += '<div class="rj70-sec">Ton palmarès</div>';
    if (p.joueur.titres.length) {
      h += '<div class="rj70-pal">' + p.joueur.titres.map(function (t) {
        return '<span class="rj70-badge">' + ech(t.cat) + " " + ech(t.annee) + '</span>';
      }).join("") + '</div>';
    } else {
      h += '<div class="rj70-vide">Aucun titre pour l\'instant.</div>';
    }

    // Champions de chaque catégorie
    h += '<div class="rj70-sec">Champions ' + ech(bilan.annee) + '</div>';
    var lignes = "";
    for (var i = 0; i < CATS.length; i++) {
      var c = bilan.categories[CATS[i]];
      if (!c) continue;
      lignes += '<div class="rj70-row' + (c.pilote.estJoueur ? " rj70-moi" : "") + '">' +
        '<div class="rj70-cat">' + ech(CATS[i]) + '</div>' +
        '<div class="rj70-who"><div class="rj70-p">' + ech(c.pilote.nom) + '</div>' +
        '<div class="rj70-t">' + ech(c.ecurie ? c.ecurie.nom : c.pilote.team) + '</div></div>' +
        '<div class="rj70-pts">' + (c.pilote.points || 0) + '</div></div>';
    }
    h += lignes || '<div class="rj70-vide">Vivier indisponible — championnats parallèles non calculés.</div>';

    // Règles de titre et mouvements attendus
    h += '<div class="rj70-sec">Mouvements attendus</div><div class="rj70-card">';
    if (bilan.mouvements.length) {
      h += bilan.mouvements.map(function (m) {
        return '<div class="rj70-mv">' + (m.estJoueur ? "<b>" + ech(m.texte) + "</b>" : ech(m.texte)) + '</div>';
      }).join("");
    } else {
      h += '<div class="rj70-vide">Aucun changement imposé par les règles de titre cette saison.</div>';
    }
    h += '<div class="rj70-mv" style="color:var(--text3)">Un champion d\'une catégorie de formation ne peut plus y courir la saison suivante.</div>';
    h += '</div>';

    h += '<div class="rj70-btns">' +
      '<button class="rj70-btn p" type="button" onclick="_rj70Transferts()">Période des transferts →</button>' +
      '<button class="rj70-btn s" type="button" onclick="_rj70Accueil()">Retour accueil</button>' +
      '</div></div>';

    var corps = scr.querySelector(".scroll") || scr;
    corps.innerHTML = h;

    var sub = document.getElementById("se-sub");
    if (sub) sub.textContent = "Saison " + bilan.saison + " · " + bilan.annee;
    return true;
  }

  window._rj70Transferts = function () {
    try { if (typeof goTransferWindow === "function") { goTransferWindow(); return; } } catch (e) {}
    try { navTo("S-transfer", "ni-home"); } catch (e) {}
  };
  window._rj70Accueil = function () {
    try { G.seasonOver = false; } catch (e) {}
    majBouton();
    try { navTo("S-home", "ni-home"); } catch (e) {}
  };
  window._rj70Rendre = rendre;
  window._rj70MajBouton = majBouton;
  window._rj70Regles = faireRespecterLesRegles;

  /* ------------------------------------------------ bouton de l'accueil --- */
  function saisonADebriefer() {
    try { return !!G.seasonOver; } catch (e) { return false; }
  }

  function majBouton() {
    try {
      var el = document.querySelector(".apex-hero-race");
      if (!el) return;
      if (saisonADebriefer()) el.classList.add("rj70-or");
      else el.classList.remove("rj70-or");
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
    etat.installe = false;
    console.log(TAG + " désinstallé");
  };
})();
