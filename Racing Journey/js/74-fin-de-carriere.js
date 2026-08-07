/* =====================================================================
 * 74-fin-de-carriere.js — POINTS DE PARTIE ET FIN DE CARRIÈRE
 *
 * TROIS APPORTS
 * -------------
 *  1. POINTS DE PARTIE — un score unique qui résume toute la carrière.
 *     Il est recalculé à la demande à partir de données déjà persistées
 *     (courses, palmarès du module 70, réputation, finances), et n'ajoute
 *     donc aucun nouvel état à maintenir en cohérence. Il ne peut pas se
 *     désynchroniser de la partie.
 *
 *     Barème — les titres pèsent le plus lourd, et d'autant plus que la
 *     catégorie est haute, parce que c'est ce qui distingue une carrière
 *     réussie d'une carrière longue :
 *
 *       Titre F1 .................... 5 000     Victoire ......... 120
 *       Titre IndyCar / WEC / SF .... 3 000     Podium ...........  50
 *       Titre F2 .................... 1 800     Départ ...........   8
 *       Titre F3 ....................   900     Saison courue ....  60
 *       Titre Formula Regional ......   500     Saison en F1 .... +150
 *       Titre F4 ....................   300     Réputation ...... ×12
 *       Titre karting ...............   150     Patrimoine ...... /50k
 *
 *  2. FIN DE CARRIÈRE VOLONTAIRE — un bouton dans les Paramètres permet
 *     de raccrocher quand on veut. Une confirmation est demandée : l'action
 *     est irréversible pour la partie en cours.
 *
 *  3. RETRAITE AUTOMATIQUE À 50 ANS — vérifiée au démarrage de chaque
 *     saison. Au-delà, la carrière se termine d'elle-même.
 *
 * ÉCRAN — un calque plein écran, pas un nouvel écran déclaré. Ça évite de
 * toucher au HTML et à sa liste d'écrans, dont l'équilibre des <div> est
 * déjà fragile dans ce projet. Même hiérarchie que le bilan de saison :
 * l'essentiel visible, le détail dans des cartes dépliantes.
 *
 * Réversible : window._rj74Uninstall(). Aperçu : window._rj74Apercu().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[74-fin-de-carriere]";
  var OR = "#E9B949";
  var AGE_MAX = 50;

  var wrapped = {};
  var etat = { installe: false, points: null, terminee: false };
  window._rj74Status = function () { return etat; };

  /* ---------------------------------------------------------- barème --- */
  var VAL_TITRE = {
    "Formule 1": 5000, "IndyCar": 3000, "Endurance WEC": 3000, "Super Formula": 3000,
    "Formule 2": 1800, "Formule 3": 900, "Formula Regional": 500,
    "Formule 4": 300, "Karting Senior": 150, "Karting Junior": 150
  };
  var PTS_VICTOIRE = 120, PTS_PODIUM = 50, PTS_DEPART = 8;
  var PTS_SAISON = 60, PTS_SAISON_F1 = 150, PTS_REP = 12, PATRIMOINE_PAR_POINT = 50000;

  function ech(t) {
    return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function nb(n) {
    n = Math.round(n || 0);
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "\u202F");
  }

  /* Toutes les courses de la carrière, toutes saisons confondues. */
  function courses() {
    try { return (G.races || []).filter(function (r) { return !!r; }); } catch (e) { return []; }
  }

  function palmares() {
    try { return (G._rjPalmares && G._rjPalmares.joueur && G._rjPalmares.joueur.titres) || []; }
    catch (e) { return []; }
  }

  function saisonsJouees() {
    try {
      var p = G._rjPalmares;
      if (p && p.saisons && p.saisons.length) return p.saisons.length;
      return Math.max(1, (G.saison || 1) - 1);
    } catch (e) { return 1; }
  }

  function saisonsEnF1() {
    try {
      var p = G._rjPalmares;
      if (!p || !p.saisons) return 0;
      var n = 0;
      for (var i = 0; i < p.saisons.length; i++) {
        if (p.saisons[i].joueur && p.saisons[i].joueur.cat === "Formule 1") n++;
      }
      return n;
    } catch (e) { return 0; }
  }

  function reputationTotale() {
    try {
      var r = G.rep || {};
      return (r.medias || 0) + (r.public || 0) + (r.recruteurs || 0) + (r.paddock || 0);
    } catch (e) { return 0; }
  }

  function patrimoine() {
    try { return Math.max(0, G.budget || 0); } catch (e) { return 0; }
  }

  // Le détail est renvoyé ligne par ligne : un score sans sa décomposition
  // n'apprend rien au joueur sur ce qui a compté.
  function calculer() {
    var t = palmares();

    // CORRECTIF — on lisait G.races en croyant y trouver l'historique de
    // carriere. Or startNextSeason vide ce tableau a chaque changement de
    // saison : le score ne comptait donc que la saison en cours, et une
    // longue carriere etait massivement sous-evaluee.
    //
    // Le cumul persistant vit desormais dans _rjPalmares.carriere, aliment�
    // par le module 70 au moment du couronnement. On y ajoute la saison en
    // cours UNIQUEMENT si elle n'a pas encore ete couronnee, sans quoi elle
    // serait comptee deux fois.
    var cum = { victoires: 0, podiums: 0, departs: 0, abandons: 0, pointsChamp: 0, meilleure: null };
    try {
      var pc = G._rjPalmares && G._rjPalmares.carriere;
      if (pc) {
        cum.victoires = pc.victoires || 0; cum.podiums = pc.podiums || 0;
        cum.departs = pc.departs || 0; cum.abandons = pc.abandons || 0;
        cum.pointsChamp = pc.pointsChamp || 0;
        cum.meilleure = (typeof pc.meilleure === "number") ? pc.meilleure : null;
      }
    } catch (e) {}

    var saisonDejaComptee = false;
    try {
      var sa = G._rjPalmares && G._rjPalmares.saisons;
      if (sa) {
        for (var q = 0; q < sa.length; q++) if (sa[q].saison === (G.saison || 1)) saisonDejaComptee = true;
      }
    } catch (e) {}

    var victoires = cum.victoires, podiums = cum.podiums, departs = cum.departs;
    var abandons = cum.abandons, points = cum.pointsChamp, meilleure = cum.meilleure;

    if (!saisonDejaComptee) {
      var l = courses();
      for (var i = 0; i < l.length; i++) {
        var c = l[i];
        departs++;
        points += (c.pts || 0);
        if (c.dnf || c.pos == null) { abandons++; continue; }
        if (c.pos === 1) victoires++;
        if (c.pos <= 3) podiums++;
        if (meilleure === null || c.pos < meilleure) meilleure = c.pos;
      }
    }

    var ptsTitres = 0, parCat = {};
    for (var k = 0; k < t.length; k++) {
      var v = VAL_TITRE[t[k].cat] || 200;
      ptsTitres += v;
      parCat[t[k].cat] = (parCat[t[k].cat] || 0) + 1;
    }

    var sais = saisonsJouees(), saisF1 = saisonsEnF1();
    var rep = reputationTotale(), pat = patrimoine();

    var lignes = [
      { lbl: "Titres", det: t.length + (t.length > 1 ? " titres" : " titre"), pts: ptsTitres },
      { lbl: "Victoires", det: victoires + " × " + PTS_VICTOIRE, pts: victoires * PTS_VICTOIRE },
      { lbl: "Podiums", det: podiums + " × " + PTS_PODIUM, pts: podiums * PTS_PODIUM },
      { lbl: "Départs", det: departs + " × " + PTS_DEPART, pts: departs * PTS_DEPART },
      { lbl: "Saisons", det: sais + " × " + PTS_SAISON, pts: sais * PTS_SAISON },
      { lbl: "Saisons en F1", det: saisF1 + " × " + PTS_SAISON_F1, pts: saisF1 * PTS_SAISON_F1 },
      { lbl: "Réputation", det: rep + " × " + PTS_REP, pts: rep * PTS_REP },
      { lbl: "Patrimoine", det: nb(pat) + " €", pts: Math.floor(pat / PATRIMOINE_PAR_POINT) }
    ];

    var total = 0;
    for (var m = 0; m < lignes.length; m++) total += lignes[m].pts;

    return {
      total: total, lignes: lignes,
      victoires: victoires, podiums: podiums, departs: departs, abandons: abandons,
      pointsChamp: points, meilleure: meilleure, titres: t, parCat: parCat,
      saisons: sais, saisonsF1: saisF1, rep: rep, patrimoine: pat
    };
  }
  window._rj74Points = calculer;

  /* Rang symbolique, pour donner une échelle au score. */
  function rang(total) {
    if (total >= 40000) return { nom: "Légende", txt: "Ton nom restera dans l'histoire du sport automobile." };
    if (total >= 22000) return { nom: "Champion d'exception", txt: "Une carrière que peu de pilotes atteindront." };
    if (total >= 12000) return { nom: "Grand pilote", txt: "Une carrière accomplie, au sommet de la discipline." };
    if (total >= 6000)  return { nom: "Pilote confirmé", txt: "Une belle trajectoire, jusqu'aux grandes catégories." };
    if (total >= 2500)  return { nom: "Professionnel", txt: "Une carrière solide dans les formules de promotion." };
    if (total >= 800)   return { nom: "Espoir", txt: "Le parcours s'est arrêté avant les sommets." };
    return { nom: "Débutant", txt: "Une carrière courte, mais elle a existé." };
  }

  /* ------------------------------------------------------------ styles --- */
  function css() {
    if (document.getElementById("rj74-css")) return;
    var st = document.createElement("style");
    st.id = "rj74-css";
    st.textContent = [
      ".rj74{position:fixed;inset:0;z-index:9500;background:var(--bg,#0a0a0d);",
      "overflow-y:auto;-webkit-overflow-scrolling:touch;display:none;",
      "padding:calc(18px + var(--sa-top,0px)) 14px calc(22px + var(--sa-bottom,0px))}",
      ".rj74.on{display:block}",
      ".rj74-hero{text-align:center;padding:26px 14px 22px;border-radius:16px;",
      "background:linear-gradient(180deg,var(--bg3),var(--bg2));border:1px solid " + OR + "55;",
      "margin-bottom:11px}",
      ".rj74-k{font-family:var(--font-display);font-size:9.5px;font-weight:800;letter-spacing:.2em;",
      "text-transform:uppercase;color:var(--muted);margin-bottom:9px}",
      ".rj74-pts{font-family:var(--font-display);font-size:46px;font-weight:900;color:" + OR + ";",
      "line-height:1;letter-spacing:-.02em}",
      ".rj74-ptsl{font-size:10px;color:var(--text3);letter-spacing:.18em;text-transform:uppercase;margin-top:7px}",
      ".rj74-rang{font-family:var(--font-display);font-size:16px;font-weight:900;color:#fff;margin-top:15px}",
      ".rj74-rangt{font-size:12.5px;color:var(--text2);margin-top:5px;line-height:1.45}",
      ".rj74-nom{font-size:12.5px;color:var(--text3);margin-top:12px}",
      ".rj74-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:11px}",
      ".rj74-st{background:linear-gradient(180deg,var(--bg3),var(--bg2));border:1px solid var(--border);",
      "border-radius:11px;padding:11px 4px;text-align:center}",
      ".rj74-stv{font-family:var(--font-display);font-size:18px;font-weight:900;color:#fff;line-height:1}",
      ".rj74-stl{font-size:9px;color:var(--text3);letter-spacing:.08em;text-transform:uppercase;margin-top:5px}",
      ".rj74-pal{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:11px}",
      ".rj74-badge{font-family:var(--font-display);font-size:10px;font-weight:800;letter-spacing:.06em;",
      "text-transform:uppercase;padding:5px 9px;border-radius:999px;border:1px solid " + OR + ";",
      "color:" + OR + ";background:rgba(233,185,73,.08)}",
      ".rj74-pl{border:1px solid var(--border);border-radius:11px;margin-bottom:7px;overflow:hidden;",
      "background:linear-gradient(180deg,var(--bg3),var(--bg2))}",
      ".rj74-sm{list-style:none;display:flex;align-items:center;gap:9px;padding:13px;cursor:pointer}",
      ".rj74-sm::-webkit-details-marker{display:none}",
      ".rj74-smt{font-family:var(--font-display);font-size:12px;font-weight:800;color:#fff;flex:1}",
      ".rj74-smr{font-size:11px;color:var(--text3)}",
      ".rj74-chev{width:8px;height:8px;border-right:1.5px solid var(--text3);flex-shrink:0;",
      "border-bottom:1.5px solid var(--text3);transform:rotate(45deg) translateY(-2px);transition:transform .2s}",
      ".rj74-pl[open] .rj74-chev{transform:rotate(225deg) translateY(-2px)}",
      ".rj74-plc{padding:0 13px 12px}",
      ".rj74-l{display:flex;align-items:baseline;gap:10px;padding:8px 0;",
      "border-top:1px solid var(--border);font-size:12.5px}",
      ".rj74-l b{color:#fff;flex:0 0 108px;font-weight:600}",
      ".rj74-l span{color:var(--text3);flex:1}",
      ".rj74-l em{font-style:normal;font-family:var(--font-display);font-weight:900;color:" + OR + "}",
      ".rj74-btns{margin-top:16px;display:flex;flex-direction:column;gap:8px}",
      ".rj74-btn{width:100%;padding:13px;border-radius:11px;font-family:var(--font-display);",
      "font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;",
      "-webkit-appearance:none;appearance:none}",
      ".rj74-btn.p{background:" + OR + ";border:0;color:#171410}",
      ".rj74-btn.s{background:transparent;border:1px solid var(--border-hi);color:var(--text2)}",
      /* bouton injecté dans les Paramètres */
      ".rj74-quit{width:100%;padding:12px;margin-top:10px;border-radius:11px;background:transparent;",
      "border:1px solid rgba(239,68,68,.45);color:#EF4444;font-family:var(--font-display);",
      "font-size:11.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;",
      "-webkit-appearance:none;appearance:none}"
    ].join("");
    document.head.appendChild(st);
  }

  /* ------------------------------------------------------------- écran --- */
  function pliant(titre, resume, contenu) {
    return '<details class="rj74-pl"><summary class="rj74-sm">' +
      '<span class="rj74-smt">' + ech(titre) + '</span>' +
      '<span class="rj74-smr">' + ech(resume) + '</span>' +
      '<span class="rj74-chev"></span></summary>' +
      '<div class="rj74-plc">' + contenu + '</div></details>';
  }

  function stat(v, l) {
    return '<div class="rj74-st"><div class="rj74-stv">' + ech(v) + '</div>' +
           '<div class="rj74-stl">' + ech(l) + '</div></div>';
  }

  function afficher(auto) {
    css();
    var c = calculer();
    etat.points = c.total;
    var r = rang(c.total);
    var nom = "";
    try { nom = ((G.pilot.prenom || "") + " " + (G.pilot.nom || "")).trim(); } catch (e) {}
    var age = 0; try { age = G.age || 0; } catch (e) {}

    var h = '<div class="rj74-hero">' +
      '<div class="rj74-k">' + (auto ? "Retraite \u00e0 " + age + " ans" : "Fin de carri\u00e8re") + '</div>' +
      '<div class="rj74-pts">' + nb(c.total) + '</div>' +
      '<div class="rj74-ptsl">points de partie</div>' +
      '<div class="rj74-rang">' + ech(r.nom) + '</div>' +
      '<div class="rj74-rangt">' + ech(r.txt) + '</div>' +
      '<div class="rj74-nom">' + ech(nom) + ' \u00b7 ' + c.saisons + ' saisons \u00b7 ' + c.departs + ' d\u00e9parts</div>' +
      '</div>';

    h += '<div class="rj74-stats">' +
      stat(c.titres.length, "titres") + stat(c.victoires, "victoires") +
      stat(c.podiums, "podiums") + stat(c.saisonsF1, "sais. F1") + '</div>';

    if (c.titres.length) {
      h += '<div class="rj74-pal">' + c.titres.map(function (t) {
        return '<span class="rj74-badge">' + ech(t.cat) + " " + ech(t.annee) + '</span>';
      }).join("") + '</div>';
    }

    var detail = c.lignes.map(function (x) {
      return '<div class="rj74-l"><b>' + ech(x.lbl) + '</b><span>' + ech(x.det) +
             '</span><em>' + nb(x.pts) + '</em></div>';
    }).join("");
    h += pliant("D\u00e9tail des points", nb(c.total) + " au total", detail);

    var bilan = '<div class="rj74-l"><b>Meilleur r\u00e9sultat</b><span></span><em>' +
                (c.meilleure ? "P" + c.meilleure : "\u2014") + '</em></div>' +
      '<div class="rj74-l"><b>Abandons</b><span></span><em>' + c.abandons + '</em></div>' +
      '<div class="rj74-l"><b>Points marqu\u00e9s</b><span>en championnat</span><em>' + nb(c.pointsChamp) + '</em></div>' +
      '<div class="rj74-l"><b>R\u00e9putation</b><span>4 axes cumul\u00e9s</span><em>' + c.rep + '</em></div>' +
      '<div class="rj74-l"><b>Patrimoine</b><span></span><em>' + nb(c.patrimoine) + ' \u20ac</em></div>';
    h += pliant("Carri\u00e8re en chiffres", c.departs + " d\u00e9parts", bilan);

    h += '<div class="rj74-btns">' +
      '<button class="rj74-btn p" type="button" onclick="_rj74Fermer()">Fermer</button>' +
      '</div>';

    var box = document.getElementById("rj74-ecran");
    if (!box) {
      box = document.createElement("div");
      box.id = "rj74-ecran";
      box.className = "rj74";
      document.body.appendChild(box);
    }
    box.innerHTML = h;
    box.classList.add("on");
    box.scrollTop = 0;
    etat.terminee = true;
    return c;
  }

  window._rj74Fermer = function () {
    var box = document.getElementById("rj74-ecran");
    if (box) box.classList.remove("on");
  };
  window._rj74Apercu = function () { return afficher(false); };

  /* ------------------------------------------------- fin volontaire --- */
  window._rj74Terminer = function () {
    var c = calculer();
    var msg = "Mettre fin à la carrière de ton pilote ?\n\n" +
              "Score actuel : " + nb(c.total) + " points de partie.\n" +
              "Cette action est définitive pour cette partie.";
    if (!window.confirm(msg)) return false;
    try { G._rjCarriereTerminee = true; } catch (e) {}
    try { if (typeof saveGame === "function") saveGame((G && G._slot) || 0); } catch (e) {}
    afficher(false);
    return true;
  };

  /* Bouton injecté dans les Paramètres, sans toucher au HTML. */
  function injecterBouton() {
    var scr = document.getElementById("S-settings");
    if (!scr || document.getElementById("rj74-quit")) return;
    var hote = scr.querySelector(".scroll") || scr;
    var b = document.createElement("button");
    b.id = "rj74-quit";
    b.className = "rj74-quit";
    b.type = "button";
    b.textContent = "Mettre fin \u00e0 la carri\u00e8re";
    b.onclick = function () { window._rj74Terminer(); };
    hote.appendChild(b);
  }

  /* ------------------------------------- retraite automatique à 50 --- */
  function verifierAge() {
    try {
      if (G._rjCarriereTerminee) return false;
      if ((G.age || 0) < AGE_MAX) return false;
      G._rjCarriereTerminee = true;
      try { if (typeof saveGame === "function") saveGame((G && G._slot) || 0); } catch (e) {}
      afficher(true);
      return true;
    } catch (e) { return false; }
  }
  window._rj74VerifierAge = verifierAge;

  /* ---------------------------------------------------------- montage --- */
  function installer() {
    if (typeof window.startNextSeason === "function" && !window.startNextSeason._rj74) {
      var orig = window.startNextSeason;
      var fn = function () {
        var r = orig.apply(this, arguments);
        try { setTimeout(verifierAge, 300); } catch (e) {}
        return r;
      };
      fn._rj74 = true;
      wrapped.startNextSeason = orig;
      window.startNextSeason = fn;
    }
    if (typeof window.navTo === "function" && !window.navTo._rj74) {
      var origNav = window.navTo;
      var fnNav = function (id) {
        var r = origNav.apply(this, arguments);
        try { if (id === "S-settings") setTimeout(injecterBouton, 40); } catch (e) {}
        return r;
      };
      fnNav._rj74 = true;
      wrapped.navTo = origNav;
      window.navTo = fnNav;
    }
    return true;
  }

  var essais = 0;
  function boot() {
    if (typeof G === "undefined" || !document.body) {
      if (essais++ < 120) { setTimeout(boot, 100); return; }
    }
    css();
    installer();
    injecterBouton();
    etat.installe = true;
    console.log(TAG + " actif \u2014 points de partie, fin de carri\u00e8re volontaire, retraite \u00e0 " + AGE_MAX + " ans");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj74Uninstall = function () {
    Object.keys(wrapped).forEach(function (k) { window[k] = wrapped[k]; });
    ["rj74-css", "rj74-ecran", "rj74-quit"].forEach(function (id) {
      var e = document.getElementById(id);
      if (e && e.parentNode) e.parentNode.removeChild(e);
    });
    etat.installe = false;
    console.log(TAG + " d\u00e9sinstall\u00e9");
  };
})();
