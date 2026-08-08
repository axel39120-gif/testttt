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
      nationalite: (G && G.pilot && G.pilot.nat) || ""
    };
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
      ".rj95-apercu{width:100%;border-radius:12px;border:1px solid rgba(255,255,255,.12);display:block;margin-bottom:14px}"
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
  }

  function afficherCarte(d) {
    var cv;
    try { cv = dessiner(d); }
    catch (e) { console.warn(TAG, "dessin :", e && e.message); return; }

    var url = cv.toDataURL("image/png");
    var nomFichier = "racing-journey-" +
      d.pilote.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".png";

    var f = ouvrir(
      '<div class="rj95-eyebrow">Ta carrière</div>' +
      '<div class="rj95-titre">' + esc(d.rang) + '</div>' +
      '<img class="rj95-apercu" src="' + url + '" alt="Carte de carrière">' +
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
      if (installer()) { console.log(TAG, "confirmation et carte de carrière actives"); return; }
      if (essais++ < 80) setTimeout(tenter, 150);
    })();

    window._rj95 = {
      apercu: function () { var d = donnees(); return d ? dessiner(d).toDataURL("image/png") : null; },
      donnees: donnees,
      confirmer: demanderConfirmation
    };
    window._rj95Uninstall = function () {
      if (_orig74) window._rj74Terminer = _orig74;
      fermer();
      var css = document.getElementById(CSS_ID);
      if (css && css.parentNode) css.parentNode.removeChild(css);
      console.log(TAG, "désinstallé");
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
