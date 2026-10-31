/* =====================================================================
 * 96-archives-parties.js — LES CARRIÈRES TERMINÉES SE CONSERVENT
 *
 * CE QU'IL Y AVAIT
 * Au bout de l'écran de fin de carrière, « Fermer » se contentait de
 * masquer l'écran : on retombait sur les Paramètres, la partie restait en
 * place, à moitié close. Et une fois l'écran quitté, tout le bilan
 * — score, palmarès, saison par saison — devenait inatteignable.
 *
 * CE QUE FAIT CE MODULE
 *   1. « Fermer » devient une vraie clôture : la carrière est ARCHIVÉE,
 *      l'emplacement de sauvegarde est libéré, et l'on revient à l'écran
 *      d'accueil.
 *   2. Un espace « Historique » sur l'accueil réunit les dix dernières
 *      carrières terminées.
 *   3. En ouvrir une réaffiche son bilan complet : détail des points,
 *      carrière en chiffres, saison par saison, et les téléchargements.
 *   4. Une carrière mise en favori échappe à la rotation des dix : elle
 *      reste consultable indéfiniment.
 *
 * OÙ SONT LES ARCHIVES
 * Dans le stockage local, sous une clé qui leur est propre — jamais dans
 * les emplacements de sauvegarde, qui doivent rester libres pour jouer.
 * Une archive ne contient que le bilan, pas l'état de jeu : elle pèse
 * quelques kilooctets et ne permet pas de reprendre la partie, ce qui est
 * précisément l'intention.
 *
 * Réversible : window._rj96Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[96-archives]";
  var CLE = "rj_archives";
  var MAX_ORDINAIRES = 10;          // les favorites ne comptent pas
  var CSS_ID = "rj96-css";

  function G_() { return (typeof window.G !== "undefined") ? window.G : null; }
  function nb(n) { return (n || 0).toLocaleString("fr-FR"); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ==================================================================
   * 1. STOCKAGE
   * ================================================================== */

  function lire() {
    try {
      var brut = localStorage.getItem(CLE);
      var l = brut ? JSON.parse(brut) : [];
      return Array.isArray(l) ? l : [];
    } catch (e) { return []; }
  }

  function ecrire(liste) {
    try { localStorage.setItem(CLE, JSON.stringify(liste)); return true; }
    catch (e) { console.warn(TAG, "écriture :", e && e.message); return false; }
  }

  /* Rotation : on ne garde que les dix dernières carrières ordinaires.
     Les favorites sont conservées quel qu'en soit le nombre. */
  function ranger(liste) {
    liste.sort(function (a, b) { return (b.date || 0) - (a.date || 0); });
    var vues = 0;
    return liste.filter(function (a) {
      if (a.favori) return true;
      vues++;
      return vues <= MAX_ORDINAIRES;
    });
  }

  function archiver(bilan) {
    if (!bilan) return null;
    var liste = lire();
    var archive = {
      id: "a" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      date: Date.now(),
      favori: false,
      pilote: bilan.pilote,
      rang: bilan.rang,
      total: bilan.total,
      titres: bilan.titres || [],
      victoires: bilan.victoires,
      podiums: bilan.podiums,
      departs: bilan.departs,
      abandons: bilan.abandons,
      pointsChamp: bilan.pointsChamp,
      meilleure: bilan.meilleure,
      saisons: bilan.saisons,
      saisonsF1: bilan.saisonsF1,
      parCat: bilan.parCat || {},
      rep: bilan.rep,
      patrimoine: bilan.patrimoine,
      equipe: bilan.equipe,
      detail: bilan.saisonsDetail || [],
      lignes: bilan.lignes || []
    };
    liste.unshift(archive);
    ecrire(ranger(liste));
    return archive;
  }

  function basculerFavori(id) {
    var liste = lire();
    for (var i = 0; i < liste.length; i++) {
      if (liste[i].id === id) { liste[i].favori = !liste[i].favori; break; }
    }
    ecrire(ranger(liste));
  }

  function supprimer(id) {
    ecrire(lire().filter(function (a) { return a.id !== id; }));
  }

  /* ==================================================================
   * 2. CLÔTURE DE LA PARTIE
   * ================================================================== */

  function effacerPartie() {
    var G = G_();
    try {
      var slot = (G && typeof G._slot === "number") ? G._slot : 0;
      var cle = (window.SAVE_KEYS && window.SAVE_KEYS[slot]) || ("rj_s" + (slot + 1));
      localStorage.removeItem(cle);
      /* Le module de sauvegarde de test régénère son emplacement à chaque
         chargement : on le marque pour qu'il ne le reprenne pas. */
      if (G) G._rjPartieClose = true;
    } catch (e) { console.warn(TAG, "suppression :", e && e.message); }
  }

  function cloturer() {
    /* 1. archiver le bilan avant de perdre l'état */
    try {
      var d = window._rj95 ? window._rj95.donnees() : null;
      if (d) {
        try {
          var c = window._rj74Points ? window._rj74Points() : null;
          if (c && c.lignes) d.lignes = c.lignes;
        } catch (e) {}
        archiver(d);
      }
    } catch (e) { console.warn(TAG, "archivage :", e && e.message); }

    /* 2. fermer l'écran de bilan */
    try {
      var box = document.getElementById("rj74-ecran");
      if (box) box.classList.remove("on");
    } catch (e) {}

    /* 3. libérer l'emplacement et revenir à l'accueil */
    effacerPartie();
    try {
      if (typeof window.go === "function") window.go("S-splash");
      else if (typeof window.navTo === "function") window.navTo("S-splash", null);
    } catch (e) {}
    setTimeout(function () {
      try { if (typeof window.renderSaveSlots === "function") window.renderSaveSlots(); } catch (e) {}
      injecterAccueil();
    }, 120);
  }

  /* ==================================================================
   * 3. ÉCRAN D'HISTORIQUE
   * ================================================================== */

  function injecterCSS() {
    if (document.getElementById(CSS_ID)) return;
    var css = [
      ".rj96-sec{margin-top:18px;padding:0 4px}",
      ".rj96-entree{display:flex;align-items:center;gap:11px;width:100%;padding:14px 15px;cursor:pointer;" +
        "background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.11);border-radius:13px;" +
        "font-family:inherit;text-align:left}",
      ".rj96-entree .col{flex:1;min-width:0}",
      ".rj96-entree .t{display:block;font-family:var(--font-display);font-size:11px;font-weight:800;" +
        "letter-spacing:.12em;text-transform:uppercase;color:var(--text,#e8ebf2)}",
      ".rj96-entree .s{display:block;font-size:11.5px;color:var(--muted,#8b93a7);margin-top:3px}",
      ".rj96-entree .c{color:var(--red3,#FF1801);font-size:18px;flex-shrink:0}",
      ".rj96-liste{display:flex;flex-direction:column;gap:8px;margin-top:10px}",
      ".rj96-item{display:flex;align-items:center;gap:11px;width:100%;padding:12px 13px;cursor:pointer;" +
        "background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.10);border-radius:12px;" +
        "font-family:inherit;text-align:left}",
      ".rj96-item .col{flex:1;min-width:0}",
      ".rj96-item .nom{font-family:var(--font-display);font-size:13.5px;font-weight:800;color:#fff;" +
        "overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".rj96-item .sub{font-size:11px;color:var(--muted,#8b93a7);margin-top:2px}",
      ".rj96-item .pts{font-family:var(--font-display);font-size:14px;font-weight:900;color:#F59E0B;flex-shrink:0}",
      ".rj96-fav{background:none;border:none;font-size:16px;cursor:pointer;padding:2px 4px;flex-shrink:0;" +
        "color:rgba(255,255,255,.22)}",
      ".rj96-fav.on{color:#F59E0B}",
      ".rj96-vide{padding:16px 14px;border:1px dashed rgba(255,255,255,.12);border-radius:12px;" +
        "font-size:12px;color:var(--muted,#8b93a7);text-align:center;margin-top:10px}",
      /* bilan d'une archive */
      ".rj96-fond{position:fixed;inset:0;z-index:9700;display:none;background:var(--bg,#0a0a0d);" +
        "overflow-y:auto;-webkit-overflow-scrolling:touch;padding:0}",
      ".rj96-hdr{position:sticky;top:0;z-index:2}",
      /* Les sections héritent de leurs propres marges ; le corps ne rajoute
         que l'espace vertical. Les listes, elles, gardent la gouttière. */
      ".rj96-corps{padding:12px 0 26px}",
      ".rj96-corps > .rj96-liste{padding:0 16px}",
      ".rj96-corps > .rj74-btns{padding:0 16px}",
      ".rj96-fond.on{display:block}",
      ".rj96-tete{display:flex;align-items:flex-start;gap:12px;margin-bottom:16px}",
      ".rj96-retour{background:none;border:none;color:var(--muted,#8b93a7);font-size:22px;cursor:pointer;padding:0 4px 0 0}",
      ".rj96-titre{font-family:var(--font-display);font-size:22px;font-weight:900;color:#fff;line-height:1.1}",
      ".rj96-stitre{font-size:12px;color:var(--muted,#8b93a7);margin-top:3px}"
    ].join("\n");
    var st = document.createElement("style");
    st.id = CSS_ID; st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  function dateCourte(ts) {
    try {
      var d = new Date(ts);
      return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
    } catch (e) { return ""; }
  }

  /* L'accueil n'affiche qu'un bouton : la liste complète tenait sur toute
     la hauteur de l'écran et repoussait le reste. Elle s'ouvre désormais
     dans son propre espace. */
  function injecterAccueil() {
    var splash = document.getElementById("S-splash");
    if (!splash) return;
    injecterCSS();

    var liste = lire();
    var zone = document.getElementById("rj96-sec");
    if (!liste.length) { if (zone) zone.remove(); return; }

    if (!zone) {
      zone = document.createElement("div");
      zone.id = "rj96-sec";
      zone.className = "rj96-sec";
      var pied = splash.querySelector(".apex-splash-footer");
      if (pied && pied.parentNode) pied.parentNode.insertBefore(zone, pied);
      else splash.querySelector(".splash").appendChild(zone);
    }

    zone.innerHTML =
      '<button class="rj96-entree" id="rj96-ouvrir" type="button">' +
        '<span class="col"><span class="t">Historique</span>' +
        '<span class="s">' + liste.length + " carrière" + (liste.length > 1 ? "s" : "") +
        " terminée" + (liste.length > 1 ? "s" : "") + '</span></span>' +
        '<span class="c">\u203A</span></button>';

    if (!zone._rj96) {
      zone.addEventListener("click", function (ev) {
        if (ev.target.closest && ev.target.closest("#rj96-ouvrir")) ouvrirListe();
      });
      zone._rj96 = true;
    }
  }

  /* Espace dédié : la liste des carrières conservées. */
  function ouvrirListe() {
    injecterCSS();
    var liste = lire();

    var h = '<div class="hdr rj96-hdr">' +
              '<button class="hdr-back" id="rj96-fermer-liste">\u2039</button>' +
              '<div><div class="hdr-title">Historique</div>' +
              '<div class="hdr-sub">' + liste.length + " carrière" + (liste.length > 1 ? "s" : "") +
              " conservée" + (liste.length > 1 ? "s" : "") + '</div></div>' +
            '</div><div class="rj96-corps"><div class="rj96-liste">';

    if (!liste.length) {
      h += '<div class="rj96-vide">Aucune carrière terminée pour le moment.</div>';
    } else {
      liste.forEach(function (a) {
        var sub = a.saisons + " saison" + (a.saisons > 1 ? "s" : "") +
                  (a.titres && a.titres.length ? "  ·  " + a.titres.length + " titre" + (a.titres.length > 1 ? "s" : "") : "") +
                  "  ·  " + dateCourte(a.date);
        h += '<div class="rj96-item" data-ouvrir="' + a.id + '">' +
               '<div class="col"><div class="nom">' + esc(a.pilote) + '</div>' +
               '<div class="sub">' + esc(a.rang) + "  ·  " + esc(sub) + '</div></div>' +
               '<div class="pts">' + nb(a.total) + '</div>' +
               '<button class="rj96-fav' + (a.favori ? " on" : "") + '" data-fav="' + a.id +
                 '" title="' + (a.favori ? "Retirer des favoris" : "Garder cette carrière") + '">\u2605</button>' +
             '</div>';
      });
    }
    h += "</div></div>";

    var box = document.getElementById("rj96-liste-ecran");
    if (!box) {
      box = document.createElement("div");
      box.id = "rj96-liste-ecran";
      box.className = "rj96-fond";
      document.body.appendChild(box);
      box.addEventListener("click", function (ev) {
        if (ev.target.closest && ev.target.closest("#rj96-fermer-liste")) {
          box.classList.remove("on"); return;
        }
        var fav = ev.target.closest ? ev.target.closest("[data-fav]") : null;
        if (fav) {
          ev.stopPropagation();
          basculerFavori(fav.getAttribute("data-fav"));
          ouvrirListe(); injecterAccueil();
          return;
        }
        var item = ev.target.closest ? ev.target.closest("[data-ouvrir]") : null;
        if (item) ouvrirArchive(item.getAttribute("data-ouvrir"));
      });
    }
    box.innerHTML = h;
    box.classList.add("on");
    box.scrollTop = 0;
  }

  /* ------------------------------------------------------------------
   * Bilan d'une carrière archivée — reprend la présentation de l'écran
   * de fin de carrière, à partir des données figées.
   * ---------------------------------------------------------------- */
  function pliant(titre, resume, contenu) {
    return '<details class="rj74-pl"><summary class="rj74-sm">' +
      '<span class="rj74-smt">' + esc(titre) + '</span>' +
      '<span class="rj74-smr">' + esc(resume) + '</span>' +
      '<span class="rj74-chev"></span></summary>' +
      '<div class="rj74-plc">' + contenu + "</div></details>";
  }

  function ouvrirArchive(id) {
    var a = null;
    lire().forEach(function (x) { if (x.id === id) a = x; });
    if (!a) return;
    injecterCSS();

    /* En-tête au format des autres écrans — barre pleine largeur, collée en
       haut, titre en police d'affichage. L'ancien bloc flottait à dix-huit
       pixels du bord et ne ressemblait à aucun autre écran du jeu. */
    var h = '<div class="hdr rj96-hdr">' +
              '<button class="hdr-back" id="rj96-retour">\u2039</button>' +
              '<div><div class="hdr-title">' + esc(a.pilote) + '</div>' +
              '<div class="hdr-sub">' + esc(a.rang) + "  ·  " + nb(a.total) +
              ' points  ·  ' + dateCourte(a.date) + '</div></div>' +
            '</div><div class="rj96-corps">';

    /* Détail des points */
    if (a.lignes && a.lignes.length) {
      var detail = a.lignes.map(function (x) {
        return '<div class="rj74-l"><b>' + esc(x.lbl) + '</b><span>' + esc(x.det) +
               '</span><em>' + nb(x.pts) + '</em></div>';
      }).join("");
      h += pliant("Détail des points", nb(a.total) + " au total", detail);
    }

    /* Carrière en chiffres */
    var bilan =
      '<div class="rj74-l"><b>Victoires</b><span></span><em>' + nb(a.victoires) + '</em></div>' +
      '<div class="rj74-l"><b>Podiums</b><span></span><em>' + nb(a.podiums) + '</em></div>' +
      '<div class="rj74-l"><b>Départs</b><span></span><em>' + nb(a.departs) + '</em></div>' +
      '<div class="rj74-l"><b>Meilleur résultat</b><span></span><em>' +
        (a.meilleure ? "P" + a.meilleure : "\u2014") + '</em></div>' +
      '<div class="rj74-l"><b>Abandons</b><span></span><em>' + nb(a.abandons) + '</em></div>' +
      '<div class="rj74-l"><b>Points marqués</b><span>en championnat</span><em>' + nb(a.pointsChamp) + '</em></div>' +
      '<div class="rj74-l"><b>Réputation</b><span></span><em>' + a.rep + '</em></div>' +
      '<div class="rj74-l"><b>Patrimoine</b><span></span><em>' + nb(a.patrimoine) + ' \u20ac</em></div>';
    h += pliant("Carrière en chiffres", a.departs + " départs", bilan);

    /* Détail par saison */
    if (a.detail && a.detail.length) {
      /* Même tableau compact que l'écran de bilan : une saison par ligne. */
      var lignes = '<div class="rj95-tab">' +
        (window._rj95 && window._rj95.enTete ? window._rj95.enTete() : "") +
        a.detail.map(function (s) {
          return (window._rj95 && window._rj95.ligne) ? window._rj95.ligne(s) : "";
        }).join("") + '</div>';
      h += pliant("Détail par saison", a.detail.length + " saison" + (a.detail.length > 1 ? "s" : ""), lignes);
    }

    h += '<div class="rj74-btns">' +
      '<button class="rj74-btn" type="button" id="rj96-dl-carte">Télécharger ma carrière</button>' +
      '<button class="rj74-btn" type="button" id="rj96-favori">' +
        (a.favori ? "Retirer des favoris" : "Garder cette carrière") + '</button>' +
      '<button class="rj74-btn" type="button" id="rj96-suppr">Supprimer</button>' +
      '</div></div>';

    var box = document.getElementById("rj96-ecran");
    if (!box) {
      box = document.createElement("div");
      box.id = "rj96-ecran";
      box.className = "rj96-fond";
      document.body.appendChild(box);
    }
    box.innerHTML = h;
    box.classList.add("on");
    box.scrollTop = 0;

    box.querySelector("#rj96-retour").addEventListener("click", function () {
      box.classList.remove("on");
    });
    box.querySelector("#rj96-favori").addEventListener("click", function () {
      basculerFavori(a.id);
      injecterAccueil();
      ouvrirArchive(a.id);
    });
    box.querySelector("#rj96-suppr").addEventListener("click", function () {
      supprimer(a.id);
      box.classList.remove("on");
      injecterAccueil();
    });

    /* Les images se redessinent à partir des données archivées. */
    var dl = function (suffixe, dessinateur) {
      return function () {
        try {
          var cv = dessinateur(archiveVersBilan(a));
          var lien = document.createElement("a");
          lien.href = cv.toDataURL("image/png");
          lien.download = "racing-journey-" +
            a.pilote.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + suffixe + ".png";
          document.body.appendChild(lien); lien.click(); lien.remove();
        } catch (e) { console.warn(TAG, "image :", e && e.message); }
      };
    };
    if (window._rj95 && window._rj95.dessinerComplet) {
      box.querySelector("#rj96-dl-carte").addEventListener("click", dl("", window._rj95.dessinerComplet));
    }
  }

  /* Une archive a la même forme qu'un bilan, au champ « detail » près. */
  function archiveVersBilan(a) {
    var b = {};
    for (var k in a) if (Object.prototype.hasOwnProperty.call(a, k)) b[k] = a[k];
    b.saisonsDetail = a.detail || [];
    return b;
  }

  /* ==================================================================
   * 4. INSTALLATION
   * ================================================================== */

  var _origFermer = null;

  function installer() {
    if (typeof window._rj74Fermer !== "function") return false;
    if (window._rj74Fermer._rj96) return true;
    _origFermer = window._rj74Fermer;
    window._rj74Fermer = function () {
      /* « Fermer » ne masquait que l'écran : la partie restait ouverte et
         le bilan devenait inatteignable. Il clôt désormais pour de bon. */
      cloturer();
    };
    window._rj74Fermer._rj96 = true;
    return true;
  }

  function boot() {
    var essais = 0;
    (function tenter() {
      if (installer()) {
        injecterAccueil();
        console.log(TAG, "archives actives — " + lire().length + " carrière(s) conservée(s)");
        return;
      }
      if (essais++ < 80) setTimeout(tenter, 150);
    })();

    /* L'accueil se reconstruit à chaque retour : on repose la section. */
    if (Array.isArray(window.RJ_SCREEN_HOOKS) &&
        !window.RJ_SCREEN_HOOKS.some(function (h) { return h && h.id === "96-archives"; })) {
      window.RJ_SCREEN_HOOKS.push({
        id: "96-archives",
        ecran: "S-splash",
        apres: function () { setTimeout(injecterAccueil, 80); }
      });
    }

    window._rj96 = {
      liste: lire, archiver: archiver, ouvrir: ouvrirArchive, ouvrirListe: ouvrirListe,
      favori: basculerFavori, supprimer: supprimer, rafraichir: injecterAccueil,
      cloturer: cloturer
    };
    window._rj96Uninstall = function () {
      if (_origFermer) window._rj74Fermer = _origFermer;
      var s = document.getElementById("rj96-sec"); if (s) s.remove();
      var b = document.getElementById("rj96-ecran"); if (b) b.remove();
      var bl = document.getElementById("rj96-liste-ecran"); if (bl) bl.remove();
      var c = document.getElementById(CSS_ID); if (c) c.remove();
      console.log(TAG, "désinstallé");
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
