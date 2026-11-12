/* =====================================================================
 * 144-un-ecran.js — CHAQUE ÉCRAN TIENT SUR UN ÉCRAN
 *
 * POURQUOI (lot 1 du passage « vrai jeu mobile », v282)
 * Mesuré sur un téléphone à l'horizontale (852×393) : l'écran de résultat de
 * course défilait de 1 310 px, l'entraînement de 1 716, Pilote, Championnat,
 * Calendrier et Messagerie de 400 à 900. Un jeu mobile ne fait pas défiler
 * l'écran principal : l'essentiel est visible d'un coup d'œil, le détail
 * s'ouvre dans une fenêtre.
 *
 * L'OUTIL
 *   plier(bloc, libellé, résumé) : le bloc quitte l'écran et laisse à sa place
 *   une puce (« Mental 78 », « Incidents (7) ») ; un appui ouvre son contenu
 *   dans une fenêtre. Le bloc d'origine reste dans la page (caché) : le jeu
 *   peut continuer à le redessiner, la fenêtre en montre une copie fraîche.
 *   Les écrans sont redessinés par le jeu (innerHTML) : chaque arrangement est
 *   rejoué après rendu (observateur), et ne fait rien s'il est déjà en place.
 *
 * LES ÉCRANS (une fonction chacun, plus bas)
 *   - Week-end › Résultat : podium et place à gauche, puces des détails,
 *     boutons ; classement final resserré à droite.
 *
 * Réversible : window._rj144Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[144-un-ecran]";
  function $(id) { return document.getElementById(id); }
  // innerText garde les espaces entre blocs, mais vaut "" pour un bloc caché (plié) : textContent alors
  function texte(el) {
    if (!el) return "";
    var t = el.innerText;
    if (!t || !t.trim()) t = el.textContent || "";
    return t.replace(/\s+/g, " ").trim();
  }

  /* ------------------------------------------------------------------
   * Fenêtre : une carte centrée, sans défilement de la page ; si le
   * contenu est très long, il se répartit en colonnes dans la fenêtre.
   * ---------------------------------------------------------------- */
  function fermer() { var f = $("rj144-fenetre"); if (f) f.remove(); }
  function ouvrir(titre, contenu) {
    fermer();
    var f = document.createElement("div");
    f.id = "rj144-fenetre";
    f.setAttribute("data-rj-noround", "1");
    f.innerHTML = '<div class="rj144-carte"><div class="rj144-tete"><span>' + titre + '</span><button type="button" class="rj144-x" aria-label="Fermer">×</button></div><div class="rj144-corps"></div></div>';
    var corps = f.querySelector(".rj144-corps");
    if (typeof contenu === "string") corps.innerHTML = contenu; else corps.appendChild(contenu);
    f.addEventListener("click", function (e) { if (e.target === f || (e.target.closest && e.target.closest(".rj144-x"))) fermer(); });
    document.body.appendChild(f);
    return corps;
  }

  /* Plier un bloc : il est caché, une puce le remplace dans la rangée donnée. */
  function plier(bloc, rangee, libelle, resume, titre) {
    if (!bloc || !rangee) return;
    bloc.classList.add("rj144-plie");
    var p = document.createElement("button");
    p.type = "button"; p.className = "rj144-puce";
    p.innerHTML = '<b>' + libelle + "</b>" + (resume ? "<span>" + resume + "</span>" : "");
    p.addEventListener("click", function () {
      var copie = bloc.cloneNode(true);
      copie.classList.remove("rj144-plie");
      copie.style.margin = "0";
      // les sous-blocs repliés (▾) s'affichent ouverts dans la fenêtre
      [].forEach.call(copie.querySelectorAll("[style*='display: none'], [style*='display:none']"), function (x) { x.style.display = ""; });
      ouvrir(titre || libelle, copie);
    });
    rangee.appendChild(p);
  }

  function premierQui(enfants, re) {
    for (var i = 0; i < enfants.length; i++) if (re.test(texte(enfants[i]).slice(0, 60))) return enfants[i];
    return null;
  }

  /* ------------------------------------------------------------------
   * Week-end › Résultat
   * ---------------------------------------------------------------- */
  function resultat() {
    var c = $("res-content");
    if (!c || c.getAttribute("data-rj144") === "1" || !c.children.length) return;
    var E = [].slice.call(c.children);
    var podium = $("rj56-podium");
    var classement = premierQui(E, /^CLASSEMENT FINAL/i);
    var place = E.filter(function (x) { return /^P\d+\b/.test(texte(x)); })[0];
    if (!classement || !place) return;   // écran pas encore complet : on rejouera au rendu suivant
    c.setAttribute("data-rj144", "1");
    c.classList.add("rj144-res");
    if (podium) podium.classList.add("rj144-res-podium");
    place.classList.add("rj144-res-place");
    classement.classList.add("rj144-res-classement");
    // plus de 18 pilotes (F3 : 30) : deux colonnes de lignes dans le bloc
    var lignes = classement.children.length - 1;
    if (lignes > 18) { classement.classList.add("rj144-2col"); classement.style.setProperty("--rj144-n", Math.ceil(lignes / 2)); }

    var puces = document.createElement("div");
    puces.className = "rj144-puces rj144-res-puces";
    var mental = premierQui(E, /^MENTAL/i);
    if (mental) plier(mental, puces, "Mental", (texte(mental).match(/MENTAL\s*(\d+)/i) || [])[1] || "", "Mental et équilibre");
    var momentum = premierQui(E, /^\W{0,3}MOMENTUM/i);   // « → MOMENTUM », « ↑ MOMENTUM »…
    if (momentum) plier(momentum, puces, "Momentum", texte(momentum).replace(/^\W{0,3}MOMENTUM\s*/i, "").split(/\s+\+|\s+−|\s+-/)[0].slice(0, 22));
    var tour = premierQui(E, /^MEILLEUR TOUR/i);
    if (tour) plier(tour, puces, "Meilleur tour", (texte(tour).match(/\d+:\d\d\.\d+/) || [""])[0]);
    var incidents = premierQui(E, /^INCIDENTS/i);
    if (incidents) plier(incidents, puces, "Incidents", ((texte(incidents).match(/\((\d+)\)/) || [])[1] || "0"), "Incidents de course");
    var champ = premierQui(E, /^CHAMPIONNAT/i);
    if (champ) plier(champ, puces, "Championnat", (texte(champ).match(/P\d+/) || [""])[0] + " · " + ((texte(champ).match(/(\d+) pts/) || [])[1] || "0") + " pts");
    var recap = premierQui(E, /^Voir le récap/i);
    if (recap) { recap.classList.add("rj144-res-recap"); puces.appendChild(recap); }
    place.parentNode.insertBefore(puces, place.nextSibling);

    var boutons = document.createElement("div");
    boutons.className = "rj144-res-boutons";
    E.filter(function (x) { return x.classList && x.classList.contains("btn"); }).forEach(function (b) { boutons.appendChild(b); });
    puces.parentNode.insertBefore(boutons, puces.nextSibling);
  }

  /* ------------------------------------------------------------------
   * Deux colonnes fixes dans un conteneur : les enfants listés à droite y
   * vont, tous les autres à gauche (y compris ceux que le jeu ajoute plus
   * tard). Ne bouge rien si tout est déjà en place.
   * ---------------------------------------------------------------- */
  function deuxColonnes(conteneur, classe, aDroite) {
    var g = conteneur.querySelector(":scope > .rj144-col-g"), d = conteneur.querySelector(":scope > .rj144-col-d");
    if (!g) {
      g = document.createElement("div"); g.className = "rj144-col rj144-col-g";
      d = document.createElement("div"); d.className = "rj144-col rj144-col-d";
      conteneur.insertBefore(d, conteneur.firstChild); conteneur.insertBefore(g, d);
      conteneur.classList.add("rj144-2cols", classe);
    }
    [].slice.call(conteneur.children).forEach(function (x) {
      if (x === g || x === d) return;
      (aDroite(x) ? d : g).appendChild(x);
    });
    return { g: g, d: d };
  }

  /* Une rangée de puces reconstruite seulement si son contenu change
     (sinon l'observateur la redessinerait sans fin). */
  function rangeeDePuces(id, parent, avant, defs) {
    var r = $(id);
    var vues = defs.filter(function (x) { return x.el && texte(x.el); });
    var sig = vues.map(function (x) { return x.libelle + ":" + x.resume(x.el); }).join("|");
    if (!r) { r = document.createElement("div"); r.id = id; r.className = "rj144-puces"; }
    if (r.parentNode !== parent) parent.insertBefore(r, avant || null);
    // même contenu et blocs toujours repliés : rien à faire (un bloc redessiné par le jeu perd son repli)
    if (r.getAttribute("data-sig") === sig && vues.every(function (x) { return x.el.classList.contains("rj144-plie"); })) return r;
    r.setAttribute("data-sig", sig);
    r.innerHTML = "";
    vues.forEach(function (x) { plier(x.el, r, x.libelle, x.resume(x.el), x.titre); });
    return r;
  }

  /* ------------------------------------------------------------------
   * Week-end › Préparation : circuit à gauche (carte réduite, puces pour
   * l'historique, la course spéciale et l'objectif), réglages à droite
   * (curseurs en lignes compactes, conseil de l'ingénieur, Continuer).
   * ---------------------------------------------------------------- */
  var PREP_DROITE = { "auto-setup-banner": 1, "setup-mode-advanced": 1, "setup-feedback": 1, "prep-go-next-btn": 1 };
  function preparation() {
    var p = $("rt-prep");
    if (!p || !p.offsetParent) return;
    var cols = deuxColonnes(p, "rj144-prep", function (x) { return !!PREP_DROITE[x.id] || (x.classList && x.classList.contains("sec-lbl")); });
    var carte = $("race-circuit-map");
    rangeeDePuces("rj144-prep-puces", cols.g, carte ? carte.nextSibling : null, [
      { el: $("race-objective-banner"), libelle: "Objectif", resume: function (el) { return (texte(el).match(/Vise [^.]*?(?:ou mieux|victoire|podium|points)/i) || [texte(el).slice(0, 24)])[0]; } },
      { el: $("race-special-banner"), libelle: "Course spéciale", resume: function () { return ""; } },
      { el: $("circuit-dashboard"), libelle: "Historique", resume: function (el) { return /Première visite/i.test(texte(el)) ? "1re visite" : ""; }, titre: "Historique sur ce circuit" }
    ]);
  }

  /* ------------------------------------------------------------------
   * Sélecteur à segments (« Récupération | Développement | Arbre ») : les
   * blocs restent à leur place dans la page et gardent leurs boutons ; le
   * conteneur porte data-panneau, la feuille de style montre le bon bloc.
   * ---------------------------------------------------------------- */
  function segments(conteneur, id, avant, choix, defaut) {
    var s = $(id);
    if (!conteneur.getAttribute("data-panneau")) conteneur.setAttribute("data-panneau", defaut);
    if (!s) {
      s = document.createElement("div"); s.id = id; s.className = "rj144-seg"; s.setAttribute("role", "tablist");
      s.innerHTML = choix.map(function (c) { return '<button type="button" role="tab" data-p="' + c[0] + '">' + c[1] + "</button>"; }).join("");
      s.addEventListener("click", function (e) {
        var b = e.target.closest && e.target.closest("[data-p]"); if (!b) return;
        conteneur.setAttribute("data-panneau", b.getAttribute("data-p"));
        maj();
      });
    }
    function maj() {
      var p = conteneur.getAttribute("data-panneau");
      [].forEach.call(s.children, function (b) { var on = b.getAttribute("data-p") === p; if (b.classList.contains("on") !== on) b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
    }
    if (s.parentNode !== conteneur) conteneur.insertBefore(s, avant || null);
    maj();
    return s;
  }

  /* ------------------------------------------------------------------
   * Entraînement : bandeau de note en haut ; à gauche l'énergie et les
   * quatre focus ; à droite un sélecteur Récupération (récupérer, programmes
   * premium) | Développement (jauges) | Arbre (arbre de développement).
   * ---------------------------------------------------------------- */
  function entrainement() {
    var s = $("S-training");
    if (!s || !s.classList.contains("on")) return;
    var sc = s.querySelector(":scope > .scroll");
    if (!sc || !$("train-sessions-content")) return;
    if (!sc.classList.contains("rj144-train")) sc.classList.add("rj144-train");
    var dev = $("rj-dev-section");
    segments(sc, "rj144-train-seg", $("train-sessions-content"), [["recup", "Récupération"], ["dev", "Développement"], ["arbre", "Arbre"]], "recup");
    if (dev && dev.parentNode !== sc) sc.appendChild(dev);
    // « Plafond de catégorie atteint » (stats au-dessus du seuil) : une puce dans le bandeau
    var bandeau = $("train-rating-bar");
    if (bandeau) {
      var plafond = premierQui([].slice.call(bandeau.children), /^PLAFOND DE CATÉGORIE/i);
      rangeeDePuces("rj144-train-puces", bandeau, null, [
        { el: plafond, libelle: "Plafond atteint", resume: function (el) { var n = (texte(el).match(/\d+\/\d+/g) || []).length; return n ? n + " stat" + (n > 1 ? "s" : "") : ""; }, titre: "Plafond de catégorie atteint" }
      ]);
    }
  }

  /* ------------------------------------------------------------------
   * Pilote › Stats : note, identité et personnalisation à gauche ; les
   * quatre piliers (performance, technique, mental, physique) à droite,
   * en lignes compactes.
   * ---------------------------------------------------------------- */
  function piloteStats() {
    var p = $("pt-stats");
    if (!p || !p.offsetParent) return;
    deuxColonnes(p, "rj144-pstats", function (x) { return x.id === "p-stat-bars"; });
  }

  /* Un bloc « titre + contenu » (titre en .t-sec ou en texte seul) devient un
     seul élément à plier : on emballe les deux dans un conteneur. */
  function emballer(titre, contenu, classe) {
    if (!titre || !contenu) return null;
    if (titre.parentNode && titre.parentNode.classList.contains(classe)) return titre.parentNode;
    var w = document.createElement("div");
    w.className = classe;
    titre.parentNode.insertBefore(w, titre);
    w.appendChild(titre); w.appendChild(contenu);
    return w;
  }

  /* ------------------------------------------------------------------
   * Pilote › Carrière : Super Licence, filtre et statistiques à gauche ;
   * graphique d'évolution, puces (saisons, palmarès, biographie) et
   * contrat à droite.
   * ---------------------------------------------------------------- */
  function piloteCarriere() {
    var p = $("pt-rep"), det = $("career-detail-content");
    if (!p || !p.offsetParent || !det) return;
    var graphe = $("career-graph-content"), palm = $("palmares-content");
    var cols = deuxColonnes(p, "rj144-pcar", function (x) {
      return (graphe && x.contains(graphe)) || (palm && (x === palm || x.contains(palm))) || /^PALMARÈS$/i.test(texte(x)) || (x.classList && x.classList.contains("rj119-w")) || x.classList.contains("rj144-pcar-palm");
    });
    // chaque bloc est marqué au premier passage : aux suivants, il est déjà plié ou emballé
    var E = [].slice.call(det.children);
    var bio = det.querySelector(":scope > .rj144-pcar-bio");
    if (!bio) { var bioTitre = E.filter(function (x) { return /^BIOGRAPHIE$/i.test(texte(x)); })[0]; bio = emballer(bioTitre, bioTitre && bioTitre.nextElementSibling, "rj144-pcar-bio"); }
    var saisons = det.querySelector(":scope > .rj144-pcar-saisons");
    if (!saisons) {
      saisons = E.filter(function (x) { return !x.id && !x.className && /\bEN COURS\b|\d{4}\s*#\d+/.test(texte(x).slice(0, 40)); })[0];
      if (saisons) saisons.classList.add("rj144-pcar-saisons");
    }
    var palmares = cols.d.querySelector(":scope > .rj144-pcar-palm");
    if (!palmares) { var palmTitre = [].slice.call(cols.d.children).filter(function (x) { return /^PALMARÈS$/i.test(texte(x)); })[0]; palmares = emballer(palmTitre, palm, "rj144-pcar-palm"); }
    rangeeDePuces("rj144-pcar-puces", cols.d, graphe ? (function () { var x = graphe; while (x.parentNode !== cols.d) x = x.parentNode; return x.nextSibling; })() : null, [
      { el: saisons, libelle: "Saisons", resume: function (el) { return String((texte(el).match(/\b\d{4}\b/g) || []).length || ""); }, titre: "Historique des saisons" },
      { el: palmares, libelle: "Palmarès", resume: function (el) { return /Aucun titre/i.test(texte(el)) ? "0 titre" : ""; } },
      { el: bio, libelle: "Biographie", resume: function () { return ""; } }
    ]);
  }

  /* Titre .t-sec suivi de son contenu, dans un conteneur : emballé et marqué. */
  function sectionEmballee(conteneur, re, classe) {
    var deja = conteneur.querySelector(":scope > ." + classe);
    if (deja) return deja;
    var t = [].slice.call(conteneur.children).filter(function (x) { return re.test(texte(x)); })[0];
    return emballer(t, t && t.nextElementSibling, classe);
  }

  /* ------------------------------------------------------------------
   * Pilote › Relations : rôle, coéquipier et confiance à gauche (objectifs
   * et bonus en puces) ; rivalités et décisions à droite, sans leurs
   * longues introductions.
   * ---------------------------------------------------------------- */
  function piloteRelations() {
    var p = $("pt-relations"), trust = $("trust-objectives-container");
    if (!p || !p.offsetParent || !trust) return;
    var cols = deuxColonnes(p, "rj144-prel", function (x) {
      return x.id === "rivalries-content" || x.id === "decisions-content" || /^(RIVALITÉS|DÉCISIONS IMPORTANTES)$/i.test(texte(x));
    });
    var obj = sectionEmballee(trust, /^OBJECTIFS DE SAISON$/i, "rj144-prel-obj");
    var bonus = sectionEmballee(trust, /^BONUS DE PERFORMANCE$/i, "rj144-prel-bonus");
    rangeeDePuces("rj144-prel-puces", cols.g, null, [
      { el: obj, libelle: "Objectifs", resume: function (el) { var n = (texte(el).match(/○/g) || []).length; return n ? n + " en cours" : ""; }, titre: "Objectifs de saison" },
      { el: bonus, libelle: "Bonus", resume: function () { return ""; }, titre: "Bonus de performance" }
    ]);
  }

  /* Pilote › Héritage : les rêves restent ; la frise « Ta carrière », qui
     s'allonge chaque saison, passe en puce. */
  function piloteHeritage() {
    var p = $("pt-heritage");
    if (!p || !p.offsetParent) return;
    var frise = [].slice.call(p.querySelectorAll(":scope > .rj114-bloc")).filter(function (b) { return /^TA CARRIÈRE/i.test(texte(b.querySelector(".rj114-titre"))); })[0];
    if (!frise) return;
    rangeeDePuces("rj144-pher-puces", p, p.firstChild, [
      { el: frise, libelle: "Ta carrière", resume: function (el) { return el.querySelectorAll(".rj114-saison").length + " saison" + (el.querySelectorAll(".rj114-saison").length > 1 ? "s" : ""); } }
    ]);
  }

  /* Une liste en cartes répartie en colonnes (lignes = n / colonnes). */
  function grille(liste, classe) {
    if (!liste) return;
    if (!liste.classList.contains(classe)) liste.classList.add(classe);
    var n = liste.children.length, cols = n > 10 ? 3 : 2, r = String(Math.max(1, Math.ceil(n / cols)));
    if (liste.style.getPropertyValue("--rj144-n") !== r) liste.style.setProperty("--rj144-n", r);
    if (liste.style.getPropertyValue("--rj144-c") !== String(cols)) liste.style.setProperty("--rj144-c", cols);
  }
  function plusLongEnfant(c) {
    return [].slice.call(c.children).sort(function (a, b) { return b.children.length - a.children.length; })[0];
  }

  /* ------------------------------------------------------------------
   * Championnat : Pilotes (bandeau manches/écart/positions, classement en
   * deux colonnes), Constructeurs et Performances (cartes en colonnes, la
   * réglementation et l'analyse en puces), Face-à-face (lignes resserrées).
   * ---------------------------------------------------------------- */
  function championnat() {
    var s = $("S-champ");
    if (!s || !s.classList.contains("on")) return;
    var t = $("champ-table");
    if (t && t.offsetParent) {
      var c = $("cht-classement");
      if (!c.classList.contains("rj144-champ")) c.classList.add("rj144-champ");
      var n = String(Math.ceil(t.children.length / 2));
      if (t.style.getPropertyValue("--rj144-n") !== n) t.style.setProperty("--rj144-n", n);
    }
    var ct = $("constructeurs-table");
    if (ct && ct.offsetParent) grille(plusLongEnfant(ct), "rj144-cartes");
    var pf = $("team-perf-content");
    if (pf && pf.offsetParent) {
      var analyse = sectionEmballee(pf, /^ANALYSE DE LA SAISON$/i, "rj144-perf-analyse");
      var premierTitre = pf.querySelector(":scope > .t-sec");
      var info = pf.querySelector(":scope > .rj144-perf-info");
      if (!info && premierTitre && premierTitre.previousElementSibling && premierTitre.previousElementSibling.id !== "rj144-perf-puces") { info = premierTitre.previousElementSibling; info.classList.add("rj144-perf-info"); }
      grille(plusLongEnfant(pf), "rj144-cartes");
      rangeeDePuces("rj144-perf-puces", pf, premierTitre, [
        { el: info, libelle: info ? (texte(info.firstElementChild) || "Info").slice(0, 28) : "", resume: function () { return ""; } },
        { el: analyse, libelle: "Analyse de la saison", resume: function () { return ""; } }
      ]);
    }
  }

  /* ------------------------------------------------------------------
   * Installation : chaque arrangement est rejoué après les rendus du jeu
   * ---------------------------------------------------------------- */
  var ARRANGEMENTS = [resultat, preparation, entrainement, piloteStats, piloteCarriere, piloteRelations, piloteHeritage, championnat];
  var attente = 0;
  function arranger() {
    attente = 0;
    ARRANGEMENTS.forEach(function (f) { try { f(); } catch (e) { console.warn(TAG, f.name, e); } });
  }
  function bientot() { if (!attente) attente = requestAnimationFrame(arranger); }

  var obs = null;
  function installer() {
    if (!document.body) return false;
    obs = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var t = muts[i].target;
        if (t && t.id === "rj144-fenetre") continue;
        if (t && t.closest && t.closest("#rj144-fenetre")) continue;
        bientot(); return;
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    arranger();
    window.RJ144 = { ouvrir: ouvrir, fermer: fermer, plier: plier, arranger: arranger };
    window._rj144Uninstall = function () { if (obs) obs.disconnect(); fermer(); };
    console.log(TAG, "actif — écrans sans défilement");
    return true;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installer); else installer();
})();
