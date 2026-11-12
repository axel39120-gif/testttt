/* =====================================================================
 * 120-atelier-reglages.js — L'ATELIER DE RÉGLAGES
 *
 * POURQUOI
 * Les réglages se résumaient à neuf curseurs fins empilés (plus de 1 000 px
 * de liste), une zone optimale en surimpression et un « ? » : difficile au
 * doigt, et sans retour du pilote. Les jeux de gestion de course en font un
 * moment du week-end : on règle, on roule, le pilote parle, on corrige.
 *
 * CE QUE MONTRE L'ATELIER (à la place de renderAdvancedSetupUI)
 *   - la confiance du pilote, mesurée au dernier tour roulé : changer un
 *     réglage ne se juge qu'en roulant ;
 *   - cinq ressentis (équilibre, freinage, appui, traction, vitesse) : une
 *     barre, la position estimée du réglage et la fenêtre idéale, qui se
 *     resserre à mesure que l'équipe connaît le circuit (essais) ;
 *   - la parole au pilote après chaque tour d'essai, et ses temps ;
 *   - les réglages en trois groupes, boutons − / + et crans, avec les
 *     ressentis que chacun déplace.
 *
 * RIEN NE CHANGE DANS LE CALCUL : les réglages restent G.setupAdv (via
 * setAdvParam, couplages compris), la qualité reste computeAdvancedSetupScore
 * (bonus de qualif et de course), les essais restent runPracticeTest et la
 * connaissance RACE_STATE.practice.knowledge.
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[120-atelier]";

  var NOMS = {
    aileron_av: "Aileron avant", aileron_ar: "Aileron arrière", antiroulis_av: "Antiroulis avant",
    antiroulis_ar: "Antiroulis arrière", carrossage: "Carrossage", suspension: "Suspension",
    pression_pneus: "Pression des pneus", differentiel: "Différentiel", repartition_frein: "Répartition de freinage"
  };
  var GROUPES = [
    ["Aérodynamique", ["aileron_av", "aileron_ar"]],
    ["Châssis", ["antiroulis_av", "antiroulis_ar", "carrossage", "suspension"]],
    ["Pneus et freins", ["pression_pneus", "differentiel", "repartition_frein"]]
  ];

  /* Cinq ressentis : poids de chaque réglage (au-dessus de l'idéal = vers le
     second libellé). */
  var RESSENTIS = [
    { id: "equilibre", nom: "Équilibre", bornes: ["Sous-vireuse", "Survireuse"],
      poids: { aileron_av: 1, aileron_ar: -1, antiroulis_av: -0.6, antiroulis_ar: 0.6 } },
    { id: "freinage", nom: "Freinage", bornes: ["Bloque l'arrière", "Bloque l'avant"],
      poids: { repartition_frein: 1, suspension: -0.4 } },
    { id: "appui", nom: "Appui en virage", bornes: ["Peu d'appui", "Trop d'appui"],
      poids: { aileron_av: 0.5, aileron_ar: 0.5, carrossage: 0.6, pression_pneus: -0.4 } },
    { id: "traction", nom: "Traction", bornes: ["Paresseuse", "Patine"],
      poids: { differentiel: 1, antiroulis_ar: 0.5, suspension: 0.3 } },
    { id: "vitesse", nom: "Vitesse de pointe", bornes: ["Lente en ligne droite", "Trop légère"],
      poids: { aileron_ar: -1, aileron_av: -0.5 } }
  ];

  /* Ce que dit le pilote, selon le réglage le plus éloigné de l'idéal. */
  var PAROLES = {
    aileron_av: ["Ça sous-vire en entrée de virage, l'avant ne tourne pas.", "L'avant est trop vif, l'arrière se dérobe en entrée."],
    aileron_ar: ["L'arrière est léger dans les courbes rapides.", "On manque de vitesse en ligne droite."],
    antiroulis_av: ["La voiture roule trop, elle change d'appui lentement.", "L'avant rebondit sur les vibreurs."],
    antiroulis_ar: ["L'arrière est mou, ça pousse en milieu de virage.", "L'arrière est nerveux en sortie de virage."],
    carrossage: ["Pas assez d'adhérence quand je charge en appui.", "Les pneus chauffent trop sur l'intérieur."],
    suspension: ["Trop souple, elle plonge au freinage.", "Trop raide, la voiture saute sur les bosses."],
    pression_pneus: ["Les pneus surchauffent en fin de tour.", "Les pneus glissent, ils manquent de grip."],
    differentiel: ["Les roues patinent à la remise des gaz.", "Ça tire tout droit en sortie de virage."],
    repartition_frein: ["L'arrière se dérobe au freinage.", "L'avant bloque au freinage."]
  };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function params() { return typeof getAvailableSetupParams === "function" ? getAvailableSetupParams(G.cat) : []; }
  function valeur(p) { var v = G.setupAdv && G.setupAdv[p]; return typeof v === "number" ? v : 5; }
  function pratique() { return window.RACE_STATE && RACE_STATE.practice ? RACE_STATE.practice : null; }

  /* Ce que l'équipe sait de l'idéal d'un réglage : centre estimé et
     incertitude (demi-largeur), d'après les essais. */
  function connaissance(p) {
    var k = pratique() && pratique().knowledge && pratique().knowledge[p];
    if (!k) return { centre: 5, demi: 5 };
    return { centre: (k.lowerBound + k.upperBound) / 2, demi: Math.max(0.3, (k.upperBound - k.lowerBound) / 2) };
  }

  /* Un ressenti : position estimée (−1 … 1, 0 = idéal) et incertitude. */
  function ressenti(r, dispo) {
    var somme = 0, poids = 0, doute = 0;
    Object.keys(r.poids).forEach(function (p) {
      if (dispo.indexOf(p) < 0) return;
      var w = r.poids[p], k = connaissance(p);
      somme += w * (valeur(p) - k.centre) / 10;
      doute += Math.abs(w) * k.demi / 10;
      poids += Math.abs(w);
    });
    if (!poids) return null;
    return { pos: Math.max(-1, Math.min(1, somme / poids * 2)), doute: Math.min(1, doute / poids * 2) };
  }

  function verdict(x) {
    if (x.doute > 0.45) return { t: "À confirmer", c: "doute" };
    var a = Math.abs(x.pos);
    return a <= 0.08 ? { t: "Parfait", c: "parfait" } : a <= 0.2 ? { t: "Bon", c: "bon" } : a <= 0.4 ? { t: "À revoir", c: "moyen" } : { t: "Mauvais", c: "mauvais" };
  }

  /* Confiance du pilote au dernier tour roulé (100 = réglage idéal). */
  function confiance() {
    var p = pratique(), dernier = p && p.tests && p.tests[p.tests.length - 1];
    if (!dernier || !dernier.feedback) return null;
    var ecarts = Object.keys(dernier.feedback).map(function (k) { return dernier.feedback[k].absDiff || 0; });
    if (!ecarts.length) return null;
    var moy = ecarts.reduce(function (s, x) { return s + x; }, 0) / ecarts.length;
    return Math.max(0, Math.min(100, Math.round(100 - 20 * moy)));
  }

  function parole() {
    var p = pratique(), dernier = p && p.tests && p.tests[p.tests.length - 1];
    if (!dernier || !dernier.feedback) return null;
    var pire = null;
    Object.keys(dernier.feedback).forEach(function (k) {
      var f = dernier.feedback[k];
      if (!pire || (f.absDiff || 0) > pire.f.absDiff) pire = { k: k, f: f };
    });
    if (!pire || pire.f.direction === "perfect" || (pire.f.absDiff || 0) <= 0.6) return "La voiture est superbe, je ne toucherais à rien.";
    var phrases = PAROLES[pire.k];
    if (!phrases) return null;
    var dit = phrases[pire.f.direction === "too_high" ? 1 : 0];
    return pire.f.magnitude === "unknown" ? "Quelque chose cloche… " + dit.charAt(0).toLowerCase() + dit.slice(1) : dit;
  }

  function temps(t) {
    if (typeof t !== "number") return "—";
    var m = Math.floor(t / 60), s = t - 60 * m;
    return m + ":" + (s < 10 ? "0" : "") + s.toFixed(3);
  }

  function anneau(v) {
    var c = 2 * Math.PI * 34, part = v === null ? 0 : v / 100;
    var teinte = v === null ? "#3a3a44" : v >= 85 ? "#2DD4BF" : v >= 65 ? "#34D399" : v >= 40 ? "#F59E0B" : "#EF4444";
    return '<svg class="rja-anneau" viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" class="fond"/>' +
      '<circle cx="40" cy="40" r="34" class="jauge" style="stroke:' + teinte + ";stroke-dasharray:" + (c * part).toFixed(1) + " " + c.toFixed(1) + '"/></svg>' +
      '<div class="rja-anneau-val" style="color:' + teinte + '">' + (v === null ? "—" : v + "<small>%</small>") + "</div>";
  }

  /* Un ressenti est un curseur : on le fait glisser vers la fenêtre idéale et,
     au lâcher, les réglages qui le composent bougent d'autant (pondérés, avec
     leurs couplages). Plus de liste de réglages à « − / + ». */
  function barre(r, x) {
    var v = verdict(x), largeur = Math.max(6, 6 + 60 * x.doute);
    return '<div class="rja-r"><div class="rja-r-tete"><span class="nom">' + esc(r.nom) + '</span><span class="rja-verdict ' + v.c + '">' + v.t + "</span></div>" +
      '<div class="rja-barre" data-rja-r="' + r.id + '" role="slider" aria-label="' + esc(r.nom) + '" aria-valuemin="-100" aria-valuemax="100" aria-valuenow="' + Math.round(x.pos * 100) + '" tabindex="0">' +
      '<span class="zone" style="left:' + (50 - largeur / 2) + "%;width:" + largeur + '%"></span>' +
      '<span class="marque" style="left:' + (50 + 46 * x.pos).toFixed(1) + '%"></span></div>' +
      '<div class="rja-bornes"><span>' + esc(r.bornes[0]) + "</span><span>" + esc(r.bornes[1]) + "</span></div></div>";
  }

  /* La tête de l'atelier (confiance + cinq ressentis) seule, pour la montrer
     ailleurs à l'identique (essais libres, débrief). */
  function ressentisHTML() {
    var dispo = params();
    if (!dispo.length) return "";
    var h = '<div class="rja-tete"><div class="rja-conf">' + anneau(confiance()) + '<div class="rja-conf-lbl">Confiance<br>du pilote</div></div><div class="rja-ressentis">';
    RESSENTIS.forEach(function (r) {
      var x = ressenti(r, dispo);
      if (x) h += barre(r, x);
    });
    return h + "</div></div>";
  }

  /* Amener le ressenti r à la position t (−1 … 1). Sa position vaut
     Σ w·(v − centre) / Σ|w| / 5 : en déplaçant chaque réglage de w·E,
     E = 5·(t − pos)·Σ|w| / Σw², la position atteint t (à l'arrondi des crans). */
  function amener(r, t) {
    var dispo = params(), x = ressenti(r, dispo);
    if (!x) return false;
    var ps = Object.keys(r.poids).filter(function (p) { return dispo.indexOf(p) >= 0; });
    var sa = 0, s2 = 0;
    ps.forEach(function (p) { sa += Math.abs(r.poids[p]); s2 += r.poids[p] * r.poids[p]; });
    var E = 5 * (t - x.pos) * sa / s2, bouge = false;
    ps.forEach(function (p) {
      var cible = Math.max(0, Math.min(10, Math.round(valeur(p) + r.poids[p] * E)));
      if (cible !== valeur(p)) { setAdvParam("setup", p, cible); bouge = true; }
    });
    return bouge;
  }

  function rafraichir() {
    try { renderAdvancedSetupUI(); } catch (e) { }
    document.querySelectorAll(".rja-essais").forEach(function (b) { b.innerHTML = ressentisHTML(); });
  }

  var glisse = null;
  function positionDe(barreEl, clientX) {
    var rc = barreEl.getBoundingClientRect();
    var part = (clientX - rc.left) / Math.max(1, rc.width) * 100;   // 0 … 100
    return { part: Math.max(4, Math.min(96, part)), t: Math.max(-1, Math.min(1, (part - 50) / 46)) };
  }
  function surAppui(e) {
    var b = e.target && e.target.closest && e.target.closest(".rja-barre[data-rja-r]");
    if (!b) return;
    e.preventDefault();
    var r = RESSENTIS.filter(function (x) { return x.id === b.getAttribute("data-rja-r"); })[0];
    if (!r) return;
    glisse = { barre: b, r: r, marque: b.querySelector(".marque") };
    b.classList.add("rja-glisse");
    try { b.setPointerCapture(e.pointerId); } catch (x) { }
    surGlisse(e);
  }
  function surGlisse(e) {
    if (!glisse) return;
    var p = positionDe(glisse.barre, e.clientX);
    glisse.t = p.t;
    if (glisse.marque) glisse.marque.style.left = p.part.toFixed(1) + "%";
  }
  function surLacher() {
    if (!glisse) return;
    var g = glisse; glisse = null;
    g.barre.classList.remove("rja-glisse");
    if (typeof g.t === "number") amener(g.r, g.t);
    rafraichir();
  }
  function surTouche(e) {
    var b = e.target && e.target.closest && e.target.closest(".rja-barre[data-rja-r]");
    if (!b || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    var r = RESSENTIS.filter(function (x) { return x.id === b.getAttribute("data-rja-r"); })[0], x = r && ressenti(r, params());
    if (!x) return;
    e.preventDefault();
    amener(r, Math.max(-1, Math.min(1, x.pos + (e.key === "ArrowRight" ? 0.12 : -0.12))));
    rafraichir();
  }

  /* ------------------------------------------------------------------ */
  function rendre(conteneur) {
    var dispo = params();
    if (!dispo.length) { conteneur.innerHTML = ""; return; }
    if (typeof initPracticeState === "function" && typeof hasPracticeSystem === "function" && hasPracticeSystem() && !pratique()) initPracticeState();
    var p = pratique(), tests = (p && p.tests) || [];
    var max = typeof getPracticeMaxTests === "function" ? getPracticeMaxTests() : 3;
    var maxSeances = typeof getPracticeMaxSessions === "function" ? getPracticeMaxSessions() : 3;
    /* Séances et tours peuvent être illimités (essais au chronomètre) : on
       annonce la séance en cours, et les tours seulement s'ils sont comptés. */
    var finies = p && p.sessionsCompleted >= maxSeances;
    var restants = p && !finies ? Math.max(0, max - p.testsThisSession) || max : 0;
    var seance = p ? Math.min(p.sessionsCompleted + 1, maxSeances) : 0;
    var conf = confiance(), dit = parole();
    var meilleur = tests.reduce(function (m, t) { return typeof t.lapTime === "number" && (m === null || t.lapTime < m) ? t.lapTime : m; }, null);

    var h = '<div class="rja">';
    /* Tête : confiance du pilote et ressentis. */
    h += '<div class="rja-tete"><div class="rja-conf">' + anneau(conf) +
      '<div class="rja-conf-lbl">Confiance<br>du pilote</div></div><div class="rja-ressentis">';
    RESSENTIS.forEach(function (r) {
      var x = ressenti(r, dispo);
      if (x) h += barre(r, x);
    });
    h += "</div></div>";

    /* Le pilote parle, on roule. */
    h += '<div class="rja-pilote"><div class="rja-bulle">' +
      (dit ? "« " + esc(dit) + " »" : "Fais un tour d'essai : le pilote te dira ce qu'il ressent.") + "</div>" +
      '<div class="rja-actions">' +
      (p ? '<button type="button" class="rja-essai" data-rja="essai"' + (restants ? "" : " disabled") + ">Tour d'essai<small>" + (restants ? "Séance " + seance + (maxSeances < 10 ? "/" + maxSeances : "") + (max <= 50 ? " · " + restants + " tour" + (restants > 1 ? "s" : "") : "") : "essais terminés") + "</small></button>" : "") +
      (typeof askEngineerHint === "function" ? '<button type="button" class="rja-inge" data-rja="inge">Conseil de l\'ingénieur</button>' : "") +
      "</div>" +
      (tests.length ? '<div class="rja-temps">' + tests.slice(-4).map(function (t) {
        return '<span class="' + (t.lapTime === meilleur ? "meilleur" : "") + '">' + temps(t.lapTime) + "</span>";
      }).join("") + "</div>" : "") + "</div>";

    /* Les réglages se font par les curseurs ci-dessus (demande des joueurs :
       une seule façon de régler, la même en préparation et en essais). */
    h += "</div>";
    conteneur.innerHTML = h;
  }

  function surClic(e) {
    var b = e.target && e.target.closest && e.target.closest("[data-rja]");
    if (!b || b.disabled || !b.closest("#advanced-setup-container")) return;
    var quoi = b.getAttribute("data-rja");
    if (quoi === "essai") {
      var r = runPracticeTest();
      if (r && r.error === "session_full" && typeof endPracticeSession === "function") { endPracticeSession(); r = runPracticeTest(); }
      if (r && r.sessionFull && typeof endPracticeSession === "function") {
        var pr = pratique(), maxS = typeof getPracticeMaxSessions === "function" ? getPracticeMaxSessions() : 3;
        if (pr && pr.sessionsCompleted < maxS - 1) endPracticeSession();
      }
      try { if (typeof renderPracticeSection === "function") renderPracticeSection(); } catch (x) {}
      renderAdvancedSetupUI();
    } else if (quoi === "inge") {
      askEngineerHint();
    }
  }

  function boot() {
    if (typeof rjInscrire !== "function" || typeof renderAdvancedSetupUI !== "function" || typeof setAdvParam !== "function") return setTimeout(boot, 120);
    rjInscrire("renderAdvancedSetupUI", { id: "120-atelier:renderAdvancedSetupUI", ordre: -7000, remplace: function () {
      var c = document.getElementById("advanced-setup-container");
      if (!c) return;
      try { rendre(c); } catch (e) { console.warn(TAG, e && e.message); }
    } });
    document.addEventListener("click", surClic, true);
    document.addEventListener("pointerdown", surAppui, true);
    document.addEventListener("pointermove", surGlisse, true);
    document.addEventListener("pointerup", surLacher, true);
    document.addEventListener("pointercancel", surLacher, true);
    document.addEventListener("keydown", surTouche, true);
    window.RJAtelier = { ressenti: ressenti, confiance: confiance, parole: parole, ressentisHTML: ressentisHTML, RESSENTIS: RESSENTIS, amener: amener };
    window._rj120Uninstall = function () {
      rjDesinscrire(["120-atelier:"], "renderAdvancedSetupUI");
      document.removeEventListener("click", surClic, true);
      ["pointerdown", surAppui, "pointermove", surGlisse, "pointerup", surLacher, "pointercancel", surLacher, "keydown", surTouche].forEach(function (x, i, L) { if (i % 2 === 0) document.removeEventListener(x, L[i + 1], true); });
      delete window.RJAtelier;
    };
    console.log(TAG, "actif — atelier de réglages (confiance, ressentis, parole du pilote)");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
