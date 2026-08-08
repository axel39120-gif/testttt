/* =====================================================================
 * 95-carte-carriere.js — CONFIRMER, PUIS REPARTIR AVEC SA CARRIÈRE
 *
 * CE QU'IL Y AVAIT
 * « Mettre fin à la carrière » ouvrait une boîte de dialogue du navigateur
 * — le window.confirm brut, hors charte, avec ses boutons système. Une fois
 * validé, la carrière s'arrêtait sans que le joueur reparte avec quoi que
 * ce soit.
 *
 * CE QUE FAIT CE MODULE
 *   1. Une fenêtre de confirmation dans la charte du jeu, qui rappelle ce
 *      que le joueur s'apprête à clore : saisons, score, titres. L'action
 *      étant définitive, elle mérite mieux qu'un dialogue système.
 *   2. Une fois confirmée, une CARTE DE CARRIÈRE est dessinée : un visuel
 *      unique qui récapitule tout — rang, score, titres, palmarès, points,
 *      meilleur résultat, patrimoine, saisons par catégorie.
 *   3. Le joueur l'enregistre dans sa galerie ou la partage directement.
 *
 * L'image est dessinée sur un canevas, sans aucune dépendance externe :
 * ni bibliothèque, ni requête réseau. Elle fonctionne donc hors ligne,
 * comme le reste du jeu.
 *
 * Le partage utilise l'API du système quand elle accepte les fichiers —
 * c'est le cas sur mobile — et retombe sur un téléchargement classique
 * partout ailleurs.
 *
 * Réversible : window._rj95Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[95-carte-carriere]";
  var CSS_ID = "rj95-css";
  var L = 1080;                    // largeur fixe, format portrait pour les réseaux
  var H_MIN = 1350;                // hauteur minimale ; le reste s'ajuste au contenu

  function G_() { return (typeof window.G !== "undefined") ? window.G : null; }
  function nb(n) { return (n || 0).toLocaleString("fr-FR"); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ==================================================================
   * 1. DONNÉES DE CARRIÈRE
   * ================================================================== */

  function donnees() {
    var G = G_();
    var c = null;
    try { c = window._rj74Points ? window._rj74Points() : null; } catch (e) {}
    if (!c) return null;

    var pilote = "Pilote";
    try {
      if (G && G.pilot) pilote = ((G.pilot.prenom || "") + " " + (G.pilot.nom || "")).trim() || "Pilote";
    } catch (e) {}

    var rang = "Pilote";
    try {
      var t = c.total || 0;
      rang = t >= 40000 ? "Légende"
           : t >= 22000 ? "Champion d'exception"
           : t >= 12000 ? "Grand pilote"
           : t >= 6000 ? "Pilote confirmé"
           : t >= 2500 ? "Professionnel"
           : t >= 800 ? "Espoir" : "Débutant";
    } catch (e) {}

    return {
      pilote: pilote,
      rang: rang,
      total: c.total || 0,
      titres: c.titres || [],
      victoires: c.victoires || 0,
      podiums: c.podiums || 0,
      departs: c.departs || 0,
      abandons: c.abandons || 0,
      pointsChamp: c.pointsChamp || 0,
      meilleure: c.meilleure,
      saisons: c.saisons || 0,
      saisonsF1: c.saisonsF1 || 0,
      parCat: c.parCat || {},
      /* La réputation du calcul de score est un cumul pondéré ; ce qu'on
         veut afficher, c'est la note de réputation du pilote, sur cent. */
      rep: Math.min(100, Math.round((G && typeof G.reputation === "number") ? G.reputation : (c.rep || 0))),
      patrimoine: c.patrimoine || 0,
      equipe: (G && G.currentTeam) || "",
      nationalite: (G && G.pilot && G.pilot.nat) || "",
      saisonsDetail: historique()
    };
  }

  /* ------------------------------------------------------------------
   * Historique saison par saison
   *
   * CAREER_HISTORY tient déjà tout ce qu'il faut — catégorie, écurie,
   * courses, victoires, podiums, poles, abandons, points, place au
   * championnat, titre constructeur. On l'enrichit seulement de l'année
   * civile, dérivée de l'année de début du pilote.
   * ---------------------------------------------------------------- */
  /* La saison en cours ne figure pas dans CAREER_HISTORY : cette liste
     n'est alimentée qu'au passage par l'écran de fin de saison. Une
     carrière close en cours d'année — ou dès la première — n'avait donc
     aucun historique à montrer, et la section restait invisible. On la
     reconstitue depuis les courses disputées. */
  function saisonEnCours() {
    var G = G_();
    if (!G) return null;
    var courses = [];
    try { courses = G.races || []; } catch (e) {}
    if (!courses.length) return null;

    var v = 0, p = 0, pol = 0, dnf = 0, pts = 0;
    courses.forEach(function (c) {
      if (!c) return;
      pts += (c.pts || 0);
      if (c.dnf || c.pos == null || c.pos === 0) { dnf++; return; }
      if (c.pos === 1) v++;
      if (c.pos <= 3) p++;
      if (c.quali === 1 || c.pole === true || c.startPos === 1) pol++;
    });

    /* Place au championnat : le joueur parmi ses rivaux. */
    var place = null;
    try {
      var table = [{ pts: G.champPts || 0, moi: true }];
      (G.rivals || []).forEach(function (r) { table.push({ pts: r.pts || 0, moi: false }); });
      table.sort(function (a, b) { return b.pts - a.pts; });
      for (var i = 0; i < table.length; i++) if (table[i].moi) { place = i + 1; break; }
    } catch (e) {}

    return {
      saison: G.saison || 1,
      cat: G.cat || "",
      team: G._seasonTeam || G.currentTeam || "Indépendant",
      races: courses.length,
      wins: v, pods: p, poles: pol, dnfs: dnf,
      pts: G.champPts || 0,
      pos: place,
      constrChamp: null
    };
  }

  function historique() {
    var G = G_();
    var brut = [];
    try {
      if (typeof window.CAREER_HISTORY !== "undefined" && window.CAREER_HISTORY) {
        brut = window.CAREER_HISTORY.slice();
      }
    } catch (e) {}

    /* On ajoute la saison en cours si elle n'a pas encore été enregistrée. */
    try {
      var enCours = saisonEnCours();
      if (enCours) {
        var deja = brut.some(function (h) { return h && h.saison === enCours.saison; });
        if (!deja) brut.push(enCours);
      }
    } catch (e) {}

    var depart = 2024;
    try { if (G && G.pilot && G.pilot.startYear) depart = G.pilot.startYear; } catch (e) {}

    return brut.map(function (h) {
      return {
        saison: h.saison,
        annee: depart + ((h.saison || 1) - 1),
        cat: h.cat || "",
        equipe: h.team || "Indépendant",
        courses: h.races || 0,
        victoires: h.wins || 0,
        podiums: h.pods || 0,
        poles: h.poles || 0,
        abandons: h.dnfs || 0,
        points: h.pts || 0,
        place: h.pos || null,
        titrePilote: h.pos === 1,
        titreConstructeur: !!h.constrChamp
      };
    }).sort(function (a, b) { return (a.saison || 0) - (b.saison || 0); });
  }

  /* ==================================================================
   * 2. DESSIN DE LA CARTE
   * ================================================================== */

  function texte(ctx, s, x, y, opts) {
    opts = opts || {};
    ctx.save();
    ctx.font = (opts.poids || "400") + " " + (opts.taille || 32) + "px " +
               (opts.police || "'Rubik', 'Helvetica Neue', Arial, sans-serif");
    ctx.fillStyle = opts.couleur || "#ffffff";
    ctx.textAlign = opts.aligne || "left";
    if (opts.espace) {
      /* Un interlettrage manuel : le canevas ne gère pas letter-spacing. */
      var lettres = String(s).split("");
      var largeur = 0;
      lettres.forEach(function (l) { largeur += ctx.measureText(l).width + opts.espace; });
      var dx = opts.aligne === "center" ? x - largeur / 2 : (opts.aligne === "right" ? x - largeur : x);
      lettres.forEach(function (l) {
        ctx.textAlign = "left";
        ctx.fillText(l, dx, y);
        dx += ctx.measureText(l).width + opts.espace;
      });
    } else {
      ctx.fillText(s, x, y);
    }
    ctx.restore();
  }

  function boite(ctx, x, y, w, h, r, remplissage, bordure) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (remplissage) { ctx.fillStyle = remplissage; ctx.fill(); }
    if (bordure) { ctx.strokeStyle = bordure; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.restore();
  }

  function statistique(ctx, x, y, w, valeur, libelle, couleur) {
    boite(ctx, x, y, w, 150, 18, "rgba(255,255,255,0.04)", "rgba(255,255,255,0.10)");
    texte(ctx, valeur, x + w / 2, y + 78, { taille: 52, poids: "800", couleur: couleur || "#ffffff", aligne: "center" });
    texte(ctx, libelle, x + w / 2, y + 118, { taille: 24, poids: "600", couleur: "#8b93a7", aligne: "center", espace: 2 });
  }

  function dessiner(d) {
    /* La hauteur suit le contenu : sans cela, une carrière sans titre ni
       parcours détaillé laissait un tiers de l'image vide. */
    var nbTitres = Math.min((d.titres || []).length, 5) || 1;
    var tronque = (d.titres || []).length > 5 ? 46 : 0;
    var nbCats = Math.min(Object.keys(d.parCat || {}).filter(function (k) { return d.parCat[k]; }).length, 5);
    /* Base mesurée : en-tête, nom, rang, score et les deux rangées de
       chiffres occupent environ 1280 px ; le reste dépend du palmarès et du
       parcours, et l'on réserve 170 px pour le pied — sans quoi la dernière
       ligne du parcours passait dessous. */
    var H = Math.max(H_MIN, 1280 + nbTitres * 78 + tronque + (nbCats ? 46 + nbCats * 56 : 0) + 170);

    var cv = document.createElement("canvas");
    cv.width = L; cv.height = H;
    var ctx = cv.getContext("2d");

    /* Fond */
    var fond = ctx.createLinearGradient(0, 0, L, H);
    fond.addColorStop(0, "#12121a");
    fond.addColorStop(0.5, "#0b0b10");
    fond.addColorStop(1, "#14090c");
    ctx.fillStyle = fond;
    ctx.fillRect(0, 0, L, H);

    /* Halo rouge en haut */
    var halo = ctx.createRadialGradient(L / 2, 120, 40, L / 2, 120, 700);
    halo.addColorStop(0, "rgba(255,24,1,0.22)");
    halo.addColorStop(1, "rgba(255,24,1,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, L, 800);

    var M = 70;                     // marge latérale
    var y = 150;

    texte(ctx, "RACING JOURNEY", L / 2, y, { taille: 26, poids: "800", couleur: "#FF1801", aligne: "center", espace: 8 });
    y += 60;
    texte(ctx, "CARRIÈRE TERMINÉE", L / 2, y, { taille: 22, poids: "600", couleur: "#6b7280", aligne: "center", espace: 6 });

    /* Nom du pilote */
    y += 110;
    var tailleNom = d.pilote.length > 18 ? 64 : 82;
    texte(ctx, d.pilote.toUpperCase(), L / 2, y, { taille: tailleNom, poids: "800", couleur: "#ffffff", aligne: "center" });

    /* Rang */
    y += 70;
    texte(ctx, d.rang, L / 2, y, { taille: 34, poids: "600", couleur: "#F59E0B", aligne: "center" });

    /* Score */
    y += 120;
    boite(ctx, M, y - 90, L - 2 * M, 190, 24, "rgba(255,24,1,0.07)", "rgba(255,24,1,0.30)");
    texte(ctx, nb(d.total), L / 2, y + 10, { taille: 96, poids: "800", couleur: "#ffffff", aligne: "center" });
    texte(ctx, "POINTS DE PARTIE", L / 2, y + 60, { taille: 24, poids: "600", couleur: "#8b93a7", aligne: "center", espace: 4 });

    /* Titres */
    y += 180;
    if (d.titres && d.titres.length) {
      texte(ctx, "PALMARÈS", M, y, { taille: 24, poids: "800", couleur: "#FF1801", espace: 5 });
      y += 46;
      d.titres.slice(0, 5).forEach(function (t) {
        var libelle = typeof t === "string" ? t
          : ((t.cat || "") + (t.saison ? "  ·  Saison " + t.saison : ""));
        boite(ctx, M, y - 30, L - 2 * M, 62, 14, "rgba(245,158,11,0.08)", "rgba(245,158,11,0.28)");
        texte(ctx, "★", M + 26, y + 12, { taille: 30, poids: "800", couleur: "#F59E0B" });
        texte(ctx, "Champion " + libelle, M + 70, y + 12, { taille: 30, poids: "600", couleur: "#ffffff" });
        y += 78;
      });
      if (d.titres.length > 5) {
        texte(ctx, "et " + (d.titres.length - 5) + " autre(s) titre(s)", M, y + 6, { taille: 24, couleur: "#8b93a7" });
        y += 46;
      }
    } else {
      texte(ctx, "PALMARÈS", M, y, { taille: 24, poids: "800", couleur: "#FF1801", espace: 5 });
      y += 46;
      boite(ctx, M, y - 30, L - 2 * M, 62, 14, "rgba(255,255,255,0.03)", "rgba(255,255,255,0.08)");
      texte(ctx, "Aucun titre — mais la carrière a existé.", M + 30, y + 12, { taille: 27, couleur: "#8b93a7" });
      y += 78;
    }

    /* Chiffres clés, deux rangées de trois */
    y += 30;
    var lc = (L - 2 * M - 40) / 3;
    statistique(ctx, M, y, lc, nb(d.victoires), "VICTOIRES", "#F59E0B");
    statistique(ctx, M + lc + 20, y, lc, nb(d.podiums), "PODIUMS", "#34D399");
    statistique(ctx, M + 2 * (lc + 20), y, lc, nb(d.departs), "DÉPARTS", "#ffffff");
    y += 174;
    statistique(ctx, M, y, lc, nb(d.pointsChamp), "POINTS", "#00D4FF");
    statistique(ctx, M + lc + 20, y, lc, String(d.saisons), "SAISONS", "#ffffff");
    statistique(ctx, M + 2 * (lc + 20), y, lc,
      d.meilleure ? "P" + d.meilleure : "—", "MEILLEUR", "#A855F7");

    /* Détail par catégorie */
    y += 210;
    var cats = Object.keys(d.parCat || {}).filter(function (k) { return d.parCat[k]; });
    if (cats.length) {
      texte(ctx, "PARCOURS", M, y, { taille: 24, poids: "800", couleur: "#FF1801", espace: 5 });
      y += 46;
      cats.slice(0, 5).forEach(function (cat) {
        var v = d.parCat[cat];
        var n = (typeof v === "number") ? v + " saison" + (v > 1 ? "s" : "") : String(v);
        texte(ctx, cat, M, y, { taille: 28, poids: "600", couleur: "#d5d9e3" });
        texte(ctx, n, L - M, y, { taille: 28, poids: "600", couleur: "#8b93a7", aligne: "right" });
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fillRect(M, y + 16, L - 2 * M, 2);
        y += 56;
      });
    }

    /* Pied de carte */
    var yb = H - 130;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(M, yb - 40, L - 2 * M, 2);
    var gauche = d.saisonsF1
      ? d.saisonsF1 + " saison" + (d.saisonsF1 > 1 ? "s" : "") + " en Formule 1"
      : d.abandons + " abandon" + (d.abandons > 1 ? "s" : "");
    texte(ctx, gauche, M, yb + 10, { taille: 26, poids: "600", couleur: "#8b93a7" });
    texte(ctx, "Réputation " + d.rep + " / 100", L - M, yb + 10,
      { taille: 26, poids: "600", couleur: "#8b93a7", aligne: "right" });

    return cv;
  }

  /* ==================================================================
   * 3. FENÊTRES
   * ================================================================== */

  function injecterCSS() {
    if (document.getElementById(CSS_ID)) return;
    var css = [
      ".rj95-fond{position:fixed;inset:0;z-index:9800;display:none;align-items:center;" +
        "justify-content:center;padding:18px;background:rgba(0,0,0,.78);backdrop-filter:blur(4px)}",
      ".rj95-fond.on{display:flex}",
      ".rj95-boite{width:100%;max-width:420px;max-height:92vh;overflow-y:auto;padding:22px 20px;" +
        "background:linear-gradient(160deg,var(--bg3,#16161d) 0%,var(--bg2,#101015) 100%);" +
        "border:1px solid var(--border-hi,rgba(255,255,255,.16));border-radius:18px}",
      ".rj95-eyebrow{font-family:var(--font-display);font-size:10px;font-weight:800;letter-spacing:.2em;" +
        "text-transform:uppercase;color:var(--red3,#FF1801)}",
      ".rj95-titre{font-family:var(--font-display);font-size:22px;font-weight:900;color:#fff;margin:8px 0 10px;line-height:1.15}",
      ".rj95-txt{font-size:13px;color:var(--soft,#aeb6c6);line-height:1.55;margin-bottom:14px}",
      ".rj95-recap{display:flex;gap:8px;margin-bottom:16px}",
      ".rj95-recap div{flex:1;padding:11px 8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);" +
        "border-radius:10px;text-align:center}",
      ".rj95-recap .v{font-family:var(--font-display);font-size:20px;font-weight:900;color:#fff}",
      ".rj95-recap .l{font-size:9.5px;color:var(--muted,#8b93a7);text-transform:uppercase;letter-spacing:.1em;margin-top:3px}",
      ".rj95-actions{display:flex;flex-direction:column;gap:8px}",
      ".rj95-btn{width:100%;padding:13px;border:none;border-radius:10px;cursor:pointer;font-family:var(--font-display);" +
        "font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}",
      ".rj95-btn.rouge{background:var(--red,#FF1801);color:#fff}",
      ".rj95-btn.neutre{background:rgba(255,255,255,.06);color:var(--soft,#aeb6c6);border:1px solid rgba(255,255,255,.12)}",
      ".rj95-apercu{width:100%;border-radius:12px;border:1px solid rgba(255,255,255,.12);display:block;margin-bottom:14px}",
      /* --- récapitulatif saison par saison, replié par défaut --------- */
      ".rj95-detail{border:1px solid rgba(255,255,255,.10);border-radius:12px;margin-bottom:14px;overflow:hidden}",
      ".rj95-detail > summary{list-style:none;cursor:pointer;padding:13px 14px;display:flex;align-items:center;gap:9px;" +
        "background:rgba(255,255,255,.04)}",
      ".rj95-detail > summary::-webkit-details-marker{display:none}",
      ".rj95-detail > summary .t{flex:1;font-family:var(--font-display);font-size:11px;font-weight:800;" +
        "letter-spacing:.1em;text-transform:uppercase;color:var(--text,#e8ebf2)}",
      ".rj95-detail > summary .c{color:var(--muted,#8b93a7);font-size:16px;transition:transform .2s}",
      ".rj95-detail[open] > summary .c{transform:rotate(90deg)}",
      ".rj95-tab{padding:8px 10px 10px;display:flex;flex-direction:column;gap:8px}",
      /* --- carte de saison, reprise de l'historique de carrière -------- */
      ".rj95-sc{border:1px solid rgba(255,255,255,.09);border-radius:12px;overflow:hidden;" +
        "background:var(--surface2,rgba(255,255,255,.03));position:relative}",
      ".rj95-sc::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--acc)}",
      ".rj95-sc-h{display:flex;align-items:center;gap:10px;padding:10px 12px 9px 14px}",
      ".rj95-blason{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;" +
        "border-radius:5px;overflow:hidden;flex-shrink:0;background:#0a0a12}",
      ".rj95-blason.rj95-vide{background:var(--bg3,#16161d);color:var(--muted,#8b93a7)}",
      ".rj95-sc-id{flex:1;min-width:0}",
      ".rj95-sc-l1{display:flex;align-items:center;gap:7px}",
      ".rj95-sc .rj95-an{font-family:var(--font-display);font-size:17px;font-weight:900;color:#fff;line-height:1}",
      ".rj95-sc .rj95-cat{font-family:var(--font-display);font-size:9px;font-weight:800;letter-spacing:.1em;" +
        "text-transform:uppercase;color:var(--muted,#8b93a7);background:var(--bg3,#16161d);" +
        "border:1px solid rgba(255,255,255,.12);padding:2px 6px;border-radius:4px}",
      ".rj95-sc .rj95-eq{font-size:11.5px;color:var(--soft,#aeb6c6);margin-top:3px;" +
        "overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".rj95-cl{text-align:center;flex-shrink:0;min-width:38px}",
      ".rj95-cl .rj95-pos{font-family:var(--font-display);font-size:24px;font-weight:900;" +
        "color:var(--acc);line-height:1}",
      ".rj95-cl .rj95-poslb{font-family:var(--font-display);font-size:8px;font-weight:700;" +
        "letter-spacing:.12em;text-transform:uppercase;color:var(--text3,#6b7280);margin-top:2px}",
      ".rj95-sc-n{display:flex;border-top:1px solid rgba(255,255,255,.07)}",
      ".rj95-sc-n .rj95-n{flex:1;text-align:center;padding:6px 2px}",
      ".rj95-sc-n .rj95-n + .rj95-n{border-left:1px solid rgba(255,255,255,.06)}",
      ".rj95-sc-n .v{font-family:var(--font-display);font-size:13px;font-weight:800;color:var(--text,#e8ebf2)}",
      ".rj95-sc-n .l{font-size:8.5px;letter-spacing:.05em;text-transform:uppercase;" +
        "color:var(--text3,#6b7280);margin-top:1px}",
      ".rj95-sc-l1 svg{flex-shrink:0}",
      ".rj95-t{font-family:var(--font-display);font-size:8.5px;font-weight:800;letter-spacing:.09em;" +
        "text-transform:uppercase;padding:2px 6px;border-radius:3px;white-space:nowrap}",
      ".rj95-t.pil{color:#F59E0B;background:rgba(245,158,11,.14);border:1px solid rgba(245,158,11,.4)}",
      ".rj95-t.con{color:#00D4FF;background:rgba(0,212,255,.12);border:1px solid rgba(0,212,255,.35)}"
    ].join("\n");
    var st = document.createElement("style");
    st.id = CSS_ID; st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  function fermer() {
    var f = document.getElementById("rj95-fond");
    if (f) { f.classList.remove("on"); f.remove(); }
    document.body.style.overflow = "";
  }

  function ouvrir(contenu, surClicFond) {
    injecterCSS();
    fermer();
    var f = document.createElement("div");
    f.className = "rj95-fond on";
    f.id = "rj95-fond";
    f.innerHTML = '<div class="rj95-boite">' + contenu + "</div>";
    document.body.appendChild(f);
    document.body.style.overflow = "hidden";
    if (surClicFond !== false) {
      f.addEventListener("click", function (e) { if (e.target === f) fermer(); });
    }
    return f;
  }

  /* --- confirmation ------------------------------------------------- */
  function demanderConfirmation() {
    var d = donnees();
    if (!d) return;

    var f = ouvrir(
      '<div class="rj95-eyebrow">Action définitive</div>' +
      '<div class="rj95-titre">Mettre fin à la carrière de ' + esc(d.pilote) + ' ?</div>' +
      '<div class="rj95-txt">Cette partie sera close. Tu recevras une carte de carrière ' +
        'à conserver ou à partager, puis tu pourras en commencer une nouvelle.</div>' +
      '<div class="rj95-recap">' +
        '<div><div class="v">' + d.saisons + '</div><div class="l">Saisons</div></div>' +
        '<div><div class="v">' + d.titres.length + '</div><div class="l">Titres</div></div>' +
        '<div><div class="v">' + nb(d.total) + '</div><div class="l">Points</div></div>' +
      '</div>' +
      '<div class="rj95-actions">' +
        '<button class="rj95-btn rouge" id="rj95-ok">Terminer la carrière</button>' +
        '<button class="rj95-btn neutre" id="rj95-non">Continuer à jouer</button>' +
      '</div>'
    );

    f.querySelector("#rj95-non").addEventListener("click", fermer);
    f.querySelector("#rj95-ok").addEventListener("click", function () {
      terminer(d);
    });
  }

  /* Image du récapitulatif : le même tableau, en visuel téléchargeable.
     Une ligne par saison, avec les couronnes des titres. */
  /* Image unique : la carte de synthèse, puis le tableau saison par saison
     à sa suite. Deux boutons pour deux images obligeaient à enregistrer
     deux fois pour un seul et même bilan. */
  function dessinerComplet(d) {
    var carte = dessiner(d);
    var l = d.saisonsDetail || [];
    if (!l.length) return carte;

    var tableau = dessinerRecap(d, true);   // sans en-tête d'identité
    var cv = document.createElement("canvas");
    cv.width = L;
    cv.height = carte.height + tableau.height;
    var ctx = cv.getContext("2d");

    var fond = ctx.createLinearGradient(0, 0, L, cv.height);
    fond.addColorStop(0, "#12121a");
    fond.addColorStop(1, "#0b0b10");
    ctx.fillStyle = fond;
    ctx.fillRect(0, 0, L, cv.height);

    ctx.drawImage(carte, 0, 0);
    ctx.drawImage(tableau, 0, carte.height);
    return cv;
  }

  function dessinerRecap(d, sansEntete) {
    var l = d.saisonsDetail || [];
    var LIGNE = 108;
    var haut = sansEntete ? 120 : 300;
    var bas = sansEntete ? 50 : 90;
    var H = haut + l.length * LIGNE + bas;

    var cv = document.createElement("canvas");
    cv.width = L; cv.height = Math.max(600, H);
    var ctx = cv.getContext("2d");

    if (!sansEntete) {
      var fond = ctx.createLinearGradient(0, 0, L, cv.height);
      fond.addColorStop(0, "#12121a");
      fond.addColorStop(1, "#0b0b10");
      ctx.fillStyle = fond;
      ctx.fillRect(0, 0, L, cv.height);
    }

    var M = 60;
    if (sansEntete) {
      texte(ctx, "SAISON PAR SAISON", M, 70,
        { taille: 24, poids: "800", couleur: "#FF1801", espace: 6 });
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(M, 95, L - 2 * M, 2);
    } else {
      texte(ctx, "RACING JOURNEY", M, 90, { taille: 24, poids: "800", couleur: "#FF1801", espace: 7 });
      texte(ctx, d.pilote.toUpperCase(), M, 160, { taille: 52, poids: "800", couleur: "#ffffff" });
      texte(ctx, "Récapitulatif de carrière  ·  " + l.length + " saison" + (l.length > 1 ? "s" : ""),
        M, 210, { taille: 26, poids: "600", couleur: "#8b93a7" });
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(M, 245, L - 2 * M, 2);
    }

    var y = haut;
    l.forEach(function (s, i) {
      if (i % 2 === 0) {
        ctx.fillStyle = "rgba(255,255,255,0.025)";
        ctx.fillRect(M - 14, y - 46, L - 2 * M + 28, LIGNE - 10);
      }
      /* Ligne 1 : année, catégorie, écurie, titres */
      texte(ctx, String(s.annee), M, y, { taille: 34, poids: "800", couleur: "#ffffff" });
      texte(ctx, s.cat, M + 130, y, { taille: 26, poids: "600", couleur: "#aeb6c6" });
      texte(ctx, s.equipe, M + 130, y + 32, { taille: 22, couleur: "#8b93a7" });

      var couronnes = "";
      if (s.titrePilote) couronnes += "\uD83C\uDFC6";
      if (s.titreConstructeur) couronnes += " \uD83C\uDFED";
      if (couronnes) texte(ctx, couronnes, L - M, y, { taille: 30, aligne: "right" });

      /* Ligne 2 : chiffres de la saison */
      var chiffres = s.courses + " courses   ·   " + s.victoires + " V   ·   " +
                     s.podiums + " P   ·   " + s.poles + " pole" + (s.poles > 1 ? "s" : "") +
                     "   ·   " + s.abandons + " DNF";
      texte(ctx, chiffres, M + 130, y + 62, { taille: 21, couleur: "#6b7280" });

      /* À droite : points et place */
      texte(ctx, nb(s.points) + " pts", L - M, y + 34,
        { taille: 26, poids: "700", couleur: "#00D4FF", aligne: "right" });
      if (s.place) {
        texte(ctx, "P" + s.place, L - M, y + 66,
          { taille: 22, poids: "600", couleur: s.place === 1 ? "#F59E0B" : "#8b93a7", aligne: "right" });
      }

      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(M, y + 82, L - 2 * M, 1);
      y += LIGNE;
    });

    if (!sansEntete) {
      texte(ctx, nb(d.total) + " points de partie  ·  " + d.rang, M, cv.height - 40,
        { taille: 24, poids: "600", couleur: "#8b93a7" });
    }
    return cv;
  }

  /* Icônes de titre, en SVG : les émojis sont convertis par le module de
     pictogrammes, et le trophée y devenait un cercle vide. */
  var ICONE_PILOTE =
    '<svg viewBox="0 0 24 24" width="13" height="13" aria-label="Champion pilote">' +
    '<path fill="#F59E0B" d="M18 4V2H6v2H2v3a5 5 0 0 0 4.6 5A5.5 5.5 0 0 0 11 15.9V18H7v2h10v-2h-4v-2.1' +
    'A5.5 5.5 0 0 0 17.4 12 5 5 0 0 0 22 7V4zM4 7V6h2v4.8A3 3 0 0 1 4 7m16 0a3 3 0 0 1-2 2.8V6h2z"/></svg>';
  var ICONE_CONSTRUCTEUR =
    '<svg viewBox="0 0 24 24" width="13" height="13" aria-label="Champion constructeur">' +
    '<path fill="#00D4FF" d="M20.8 11.3 19 8.4A2.6 2.6 0 0 0 16.8 7H7.2A2.6 2.6 0 0 0 5 8.4l-1.8 2.9' +
    'A3 3 0 0 0 2.7 13v3.2c0 .5.4.9.9.9h1.1a2.2 2.2 0 0 0 4.3 0h6a2.2 2.2 0 0 0 4.3 0h1.1c.5 0 .9-.4.9-.9V13' +
    'a3 3 0 0 0-.5-1.7M6.7 9.4c.1-.2.3-.3.5-.3h9.6c.2 0 .4.1.5.3l1.2 1.9H5.5z"/></svg>';

  function iconesTitres(s) {
    var h = "";
    if (s.titrePilote) h += ICONE_PILOTE;
    if (s.titreConstructeur) h += ICONE_CONSTRUCTEUR;
    return h;
  }

  /* Logo de l'écurie, repris de l'historique de carrière : une saison se
     reconnaît d'abord à son blason. Sans logo connu (indépendant, écurie
     hors catalogue), un casque tient lieu de marque. */
  var CASQUE_SVG =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none">' +
    '<path d="M4 13.5c0-4.4 3.6-8 8-8s8 3.6 8 8v2a1.5 1.5 0 01-1.5 1.5H14L13 19h-2l-1-2H5.5' +
    'A1.5 1.5 0 014 15.5v-2z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>' +
    '<path d="M8 13h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

  function blasonHTML(equipe) {
    try {
      if (equipe && typeof window.TEAM_LOGOS !== "undefined" && window.TEAM_LOGOS[equipe]) {
        return '<span class="rj95-blason">' +
          window.TEAM_LOGOS[equipe].replace('width="40" height="40"', 'width="30" height="30"') +
          '</span>';
      }
    } catch (e) {}
    return '<span class="rj95-blason rj95-vide">' + CASQUE_SVG + '</span>';
  }

  var CAT_COURT = {
    "Karting Junior": "KJ", "Karting Senior": "KS", "Formule 4": "F4",
    "Formula Regional": "FR", "Formule 3": "F3", "Formule 2": "F2",
    "Formule 1": "F1", "Super Formula": "SF", "Endurance WEC": "WEC", "IndyCar": "IC"
  };

  /* Une carte par saison, sur le modèle de l'historique de carrière :
     blason, année, catégorie, écurie, puis les chiffres et le classement. */
  function ligneSaisonHTML(s) {
    var court = CAT_COURT[s.cat] || String(s.cat || "").slice(0, 3).toUpperCase();
    var accent = s.titrePilote ? "#F59E0B"
      : (s.place === 2 ? "#9CA3AF" : (s.place === 3 ? "#CD7F32" : "var(--border-hi)"));

    return '<div class="rj95-sc" style="--acc:' + accent + '">' +
      '<div class="rj95-sc-h">' +
        blasonHTML(s.equipe) +
        '<div class="rj95-sc-id">' +
          '<div class="rj95-sc-l1">' +
            '<span class="rj95-an">' + s.annee + '</span>' +
            '<span class="rj95-cat">' + esc(court) + '</span>' +
            iconesTitres(s) +
          '</div>' +
          '<div class="rj95-eq">' + esc(s.equipe || "Indépendant") + '</div>' +
        '</div>' +
        '<div class="rj95-cl">' +
          '<div class="rj95-pos">' + (s.place ? s.place : "\u2013") + '</div>' +
          '<div class="rj95-poslb">Class.</div>' +
        '</div>' +
      '</div>' +
      '<div class="rj95-sc-n">' +
        chiffre(s.courses, "Courses") +
        chiffre(s.victoires, "Vict.", "#F59E0B") +
        chiffre(s.podiums, "Pod.", "#34D399") +
        chiffre(s.poles, "Poles", "#A78BFA") +
        chiffre(s.abandons, "DNF", "var(--red-light,#F87171)") +
        chiffre(nb(s.points), "Pts") +
      '</div>' +
    '</div>';
  }

  function chiffre(v, l, couleur) {
    return '<div class="rj95-n"><div class="v"' +
      (couleur ? ' style="color:' + couleur + '"' : '') + '>' + v + '</div>' +
      '<div class="l">' + esc(l) + '</div></div>';
  }

  function enTeteColonnes() { return ""; }

  function recapitulatifHTML(d) {
    var l = d.saisonsDetail || [];
    if (!l.length) return "";
    return '<details class="rj95-detail"><summary>' +
      '<span class="t">Détail par saison (' + l.length + ')</span>' +
      '<span class="c">\u203A</span></summary>' +
      '<div class="rj95-tab">' + enTeteColonnes() +
      l.map(ligneSaisonHTML).join("") + '</div></details>';
  }

  /* --- carte et partage --------------------------------------------- */
  function terminer(d) {
    /* On clôt la partie par la voie du module d'origine, en neutralisant
       sa confirmation système : la nôtre vient d'avoir lieu. */
    var confirmOrigine = window.confirm;
    try {
      window.confirm = function () { return true; };
      /* On appelle la fonction d'origine : passer par window._rj74Terminer
         rappellerait notre propre interception et rouvrirait la
         confirmation sans jamais clore la partie. */
      if (typeof _orig74 === "function") _orig74();
    } catch (e) { console.warn(TAG, "clôture :", e && e.message); }
    finally { window.confirm = confirmOrigine; }

    afficherCarte(d);
    setTimeout(injecterDansEcran74, 200);
  }

  function afficherCarte(d) {
    var cv;
    try { cv = dessinerComplet(d); }
    catch (e) { console.warn(TAG, "dessin :", e && e.message); return; }

    var url = cv.toDataURL("image/png");
    var nomFichier = "racing-journey-" +
      d.pilote.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".png";

    var f = ouvrir(
      '<div class="rj95-eyebrow">Ta carrière</div>' +
      '<div class="rj95-titre">' + esc(d.rang) + '</div>' +
      '<img class="rj95-apercu" src="' + url + '" alt="Carte de carrière">' +
      recapitulatifHTML(d) +
      '<div class="rj95-actions">' +
        '<button class="rj95-btn rouge" id="rj95-partage">Partager</button>' +
        '<button class="rj95-btn neutre" id="rj95-tel">Enregistrer l\'image</button>' +
        '<button class="rj95-btn neutre" id="rj95-fin">Fermer</button>' +
      '</div>', false
    );

    f.querySelector("#rj95-fin").addEventListener("click", fermer);

    f.querySelector("#rj95-tel").addEventListener("click", function () {
      var a = document.createElement("a");
      a.href = url;
      a.download = nomFichier;
      document.body.appendChild(a);
      a.click();
      a.remove();
    });

    f.querySelector("#rj95-partage").addEventListener("click", function () {
      var texteP = d.pilote + " — " + d.rang + " · " + nb(d.total) + " points de partie" +
                   (d.titres.length ? " · " + d.titres.length + " titre(s)" : "") +
                   " · Racing Journey";
      cv.toBlob(function (blob) {
        if (!blob) return;
        var fichier = null;
        try { fichier = new File([blob], nomFichier, { type: "image/png" }); } catch (e) {}
        /* Partage natif avec l'image quand le système l'accepte. */
        if (fichier && navigator.share && navigator.canShare && navigator.canShare({ files: [fichier] })) {
          navigator.share({ files: [fichier], text: texteP, title: "Racing Journey" })
            .catch(function () {});
          return;
        }
        if (navigator.share) {
          navigator.share({ text: texteP, title: "Racing Journey" }).catch(function () {});
          return;
        }
        /* Sans partage système, on retombe sur l'enregistrement. */
        var a = document.createElement("a");
        a.href = url; a.download = nomFichier;
        document.body.appendChild(a); a.click(); a.remove();
      }, "image/png");
    });
  }

  /* ==================================================================
   * 3 bis. INJECTION DANS L'ÉCRAN DE FIN DE CARRIÈRE
   *
   * L'écran du module 74 — « Détail des points », « Carrière en chiffres » —
   * reste affiché derrière la carte. C'est là que le joueur revient et
   * s'attarde : le récapitulatif saison par saison doit s'y trouver aussi,
   * dans le même format dépliable que les sections existantes, et le
   * téléchargement avec lui.
   * ================================================================== */

  /* Reprise exacte du format des sections de l'écran 74 : mes classes
     approchantes laissaient le marqueur natif du navigateur et collaient
     le résumé au titre. */
  function sectionPliante(titre, resume, contenu) {
    return '<details class="rj74-pl"><summary class="rj74-sm">' +
      '<span class="rj74-smt">' + esc(titre) + '</span>' +
      '<span class="rj74-smr">' + esc(resume) + '</span>' +
      '<span class="rj74-chev"></span></summary>' +
      '<div class="rj74-plc">' + contenu + "</div></details>";
  }

  function injecterDansEcran74() {
    var box = document.getElementById("rj74-ecran");
    if (!box || !box.classList.contains("on")) return;
    if (box.querySelector("#rj95-saisons")) return;      // déjà posé

    var d = donnees();
    if (!d || !d.saisonsDetail || !d.saisonsDetail.length) return;

    injecterCSS();

    var lignes = enTeteColonnes() + d.saisonsDetail.map(ligneSaisonHTML).join("");

    var bloc = document.createElement("div");
    bloc.id = "rj95-saisons";
    bloc.innerHTML = sectionPliante(
      "Détail par saison",
      d.saisonsDetail.length + " saison" + (d.saisonsDetail.length > 1 ? "s" : ""),
      '<div class="rj95-tab">' + lignes + '</div>'
    );

    /* On le pose juste avant les boutons, à la suite des autres sections. */
    var btns = box.querySelector(".rj74-btns");
    if (btns && btns.parentNode) btns.parentNode.insertBefore(bloc, btns);
    else box.appendChild(bloc);

    /* Boutons de téléchargement, ajoutés à ceux de l'écran. */
    if (btns && !btns.querySelector("#rj95-dl-carte")) {
      /* Un seul bouton : le bilan et le détail par saison sur la même
         image, pour n'avoir qu'un fichier à conserver ou à partager. */
      var bCarte = document.createElement("button");
      bCarte.type = "button";
      bCarte.id = "rj95-dl-carte";
      bCarte.className = "rj74-btn";
      bCarte.textContent = "Télécharger ma carrière";
      bCarte.addEventListener("click", function () { telecharger(dessinerComplet(d), d, ""); });
      btns.insertBefore(bCarte, btns.firstChild);
    }
  }

  function telecharger(canevas, d, suffixe) {
    try {
      var a = document.createElement("a");
      a.href = canevas.toDataURL("image/png");
      a.download = "racing-journey-" +
        d.pilote.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") +
        (suffixe || "") + ".png";
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { console.warn(TAG, "téléchargement :", e && e.message); }
  }

  /* L'écran peut être ouvert par plusieurs chemins : on surveille son
     apparition plutôt que de deviner lequel. */
  function surveillerEcran74() {
    if (window._rj95Observer) return;
    try {
      var obs = new MutationObserver(function () {
        var box = document.getElementById("rj74-ecran");
        if (box && box.classList.contains("on")) setTimeout(injecterDansEcran74, 60);
      });
      obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
      window._rj95Observer = obs;
    } catch (e) {}
  }

  /* ==================================================================
   * 4. INSTALLATION
   * ================================================================== */

  var _orig74 = null;

  function installer() {
    if (typeof window._rj74Terminer !== "function") return false;
    if (window._rj74Terminer._rj95) return true;
    _orig74 = window._rj74Terminer;
    /* Le bouton des Paramètres appelle _rj74Terminer : on l'intercepte pour
       présenter notre confirmation, puis on appelle l'original. */
    window._rj74Terminer = function () {
      demanderConfirmation();
      return true;
    };
    window._rj74Terminer._rj95 = true;
    window._rj74Terminer._origine = _orig74;
    return true;
  }

  function boot() {
    var essais = 0;
    (function tenter() {
      if (installer()) {
        surveillerEcran74();
        setTimeout(injecterDansEcran74, 300);
        console.log(TAG, "confirmation et carte de carrière actives");
        return;
      }
      if (essais++ < 80) setTimeout(tenter, 150);
    })();

    window._rj95 = {
      apercu: function () { var d = donnees(); return d ? dessiner(d).toDataURL("image/png") : null; },
      recap: function () { var d = donnees(); return d ? dessinerRecap(d).toDataURL("image/png") : null; },
      historique: historique,
      injecter: injecterDansEcran74,
      /* Exposés pour le module d'archives : il redessine les images à
         partir de données figées, sans état de jeu. */
      dessiner: dessiner,
      ligne: ligneSaisonHTML,
      enTete: enTeteColonnes,
      dessinerRecap: dessinerRecap,
      dessinerComplet: dessinerComplet,
      donnees: donnees,
      confirmer: demanderConfirmation
    };
    window._rj95Uninstall = function () {
      if (_orig74) window._rj74Terminer = _orig74;
      if (window._rj95Observer) { window._rj95Observer.disconnect(); delete window._rj95Observer; }
      var sec = document.getElementById("rj95-saisons"); if (sec) sec.remove();
      fermer();
      var css = document.getElementById(CSS_ID);
      if (css && css.parentNode) css.parentNode.removeChild(css);
      console.log(TAG, "désinstallé");
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
