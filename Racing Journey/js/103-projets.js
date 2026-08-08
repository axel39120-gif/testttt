/* =====================================================================
 * 103-projets.js — CE QUE L'ON BÂTIT À CÔTÉ DE LA PISTE
 *
 * POURQUOI
 * L'argent s'accumulait sans autre destination que le confort personnel.
 * L'onglet Projets annonçait « rien de lancé » — un message d'attente qui
 * n'apprenait rien : ni ce qui existait, ni comment y accéder.
 *
 * CE QUE FAIT CE MODULE
 * Il affiche le catalogue COMPLET dès la première visite. Les projets hors
 * de portée restent visibles, estompés, avec la raison exacte et l'écart
 * qu'il reste à combler — « Réputation publique 41 / 55 ». On sait donc
 * vers quoi travailler avant même de pouvoir y prétendre.
 *
 * Les conditions ne sont jamais arbitraires : une marque de vêtements
 * lancée par un pilote inconnu ne se vendrait pas, une académie n'a de
 * sens qu'après avoir gagné quelque chose, et personne ne cède des parts
 * d'écurie à quelqu'un dont le team principal se méfie.
 *
 * Réversible : window._rj103Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[103-projets]";
  var CSS_ID = "rj103-css";

  function G_() { return (typeof window.G !== "undefined") ? window.G : null; }
  function nb(n) { return Math.round(n || 0).toLocaleString("fr-FR"); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ==================================================================
   * 1. LES MESURES DISPONIBLES
   * ================================================================== */
  function mesures() {
    var G = G_() || {};
    var m = {
      budget: G.budget || 0,
      repPublic: 0, repMedias: 0,
      cat: G.cat || "",
      titres: 0,
      saisons: 0,
      meilleureRelationTP: 0
    };
    try { if (G.rep) { m.repPublic = G.rep.public || 0; m.repMedias = G.rep.medias || 0; } } catch (e) {}
    try {
      if (typeof CAREER_HISTORY !== "undefined" && CAREER_HISTORY) {
        m.saisons = CAREER_HISTORY.length;
        m.titres = CAREER_HISTORY.filter(function (h) { return h && h.pos === 1; }).length;
      }
    } catch (e) {}
    try {
      if (window._rj101) {
        window._rj101.tous().forEach(function (c) {
          if (c.role === "tp" && (c.relation || 0) > m.meilleureRelationTP) {
            m.meilleureRelationTP = c.relation;
          }
        });
      }
    } catch (e) {}
    return m;
  }

  var ECHELLE = ["Karting Junior", "Karting Senior", "Formule 4", "Formula Regional",
                 "Formule 3", "Formule 2", "Formule 1"];
  function rangCategorie(cat) {
    var i = ECHELLE.indexOf(cat);
    return i < 0 ? 6 : i;          // hors échelle : on considère un niveau élevé
  }

  /* ==================================================================
   * 2. LE CATALOGUE
   *
   * Chaque condition porte son libellé et sa mesure, pour que la carte
   * verrouillée puisse afficher l'écart exact plutôt qu'un refus sec.
   * ================================================================== */
  var CATALOGUE = [
    {
      id: "fondation",
      nom: "Fondation",
      accroche: "Ton nom au service d'une cause",
      couleur: "#34D399",
      description: "Ne rapporte rien et coûte chaque semaine. En échange, ta réputation " +
                   "publique monte lentement mais sans à-coups, et les scandales " +
                   "t'atteignent moins fort.",
      cout: 150000,
      conditions: [
        { lbl: "Trésorerie", valeur: function (m) { return m.budget; }, requis: 150000, unite: "€" },
        { lbl: "Réputation publique", valeur: function (m) { return m.repPublic; }, requis: 40 }
      ]
    },
    {
      id: "marque",
      nom: "Marque personnelle",
      accroche: "Vêtements, montres, accessoires",
      couleur: "#EC4899",
      description: "Revenus proportionnels à ta notoriété. Douze semaines de lancement " +
                   "à perte, puis une rente — ou un échec, si personne ne te connaît " +
                   "assez pour porter ton nom.",
      cout: 250000,
      conditions: [
        { lbl: "Trésorerie", valeur: function (m) { return m.budget; }, requis: 250000, unite: "€" },
        { lbl: "Réputation publique", valeur: function (m) { return m.repPublic; }, requis: 55 }
      ]
    },
    {
      id: "academie",
      nom: "École de pilotes",
      accroche: "Former ceux qui viendront après",
      couleur: "#F59E0B",
      description: "Coûteuse, peu rentable, et c'est le projet qui compte le plus sur la " +
                   "durée : tes élèves peuvent arriver en F1 huit saisons plus tard, et " +
                   "se souvenir de qui les a formés.",
      cout: 800000,
      conditions: [
        { lbl: "Trésorerie", valeur: function (m) { return m.budget; }, requis: 800000, unite: "€" },
        { lbl: "Titres remportés", valeur: function (m) { return m.titres; }, requis: 1 },
        { lbl: "Niveau atteint", valeur: function (m) { return rangCategorie(m.cat); }, requis: 4,
          affiche: function (m) { return m.cat || "—"; }, requisAffiche: "Formule 3 ou mieux" }
      ]
    },
    {
      id: "ecurie_junior",
      nom: "Écurie en catégorie junior",
      accroche: "Ton nom sur un stand",
      couleur: "#00D4FF",
      description: "Tu recrutes des pilotes, tu encaisses leurs droits d'engagement, et " +
                   "tu te construis un métier pour l'après-carrière.",
      cout: 1500000,
      conditions: [
        { lbl: "Trésorerie", valeur: function (m) { return m.budget; }, requis: 1500000, unite: "€" },
        { lbl: "Titres remportés", valeur: function (m) { return m.titres; }, requis: 1 },
        { lbl: "Saisons disputées", valeur: function (m) { return m.saisons; }, requis: 4 }
      ]
    },
    {
      id: "parts_ecurie",
      nom: "Parts dans une écurie",
      accroche: "Peser sur les décisions",
      couleur: "#A78BFA",
      description: "Très cher. En échange, ton baquet devient difficile à te retirer et " +
                   "tu pèses sur la stratégie. Personne ne cède des parts à quelqu'un " +
                   "dont le patron se méfie.",
      cout: 3000000,
      conditions: [
        { lbl: "Trésorerie", valeur: function (m) { return m.budget; }, requis: 3000000, unite: "€" },
        { lbl: "Relation avec un team principal", valeur: function (m) { return m.meilleureRelationTP; }, requis: 70 },
        { lbl: "Niveau atteint", valeur: function (m) { return rangCategorie(m.cat); }, requis: 6,
          affiche: function (m) { return m.cat || "—"; }, requisAffiche: "Formule 1" }
      ]
    }
  ];

  /* ==================================================================
   * 3. ÉVALUATION
   * ================================================================== */
  function evaluer(projet, m) {
    var manquantes = [];
    projet.conditions.forEach(function (c) {
      var v = c.valeur(m);
      if (v < c.requis) manquantes.push({ cond: c, valeur: v });
    });
    return { ouvert: manquantes.length === 0, manquantes: manquantes };
  }

  function lances() {
    var G = G_();
    if (!G) return {};
    if (!G._rjProjets) G._rjProjets = {};
    return G._rjProjets;
  }

  /* ==================================================================
   * 4. RENDU
   * ================================================================== */
  function injecterCSS() {
    if (document.getElementById(CSS_ID)) return;
    var css = [
      ".rj103-sec{margin:16px 16px 8px;display:flex;align-items:center;gap:8px}",
      ".rj103-sec .bar{width:3px;height:13px;border-radius:2px;background:var(--red3,#FF1801)}",
      ".rj103-sec .lbl{font-family:var(--font-display);font-size:11px;font-weight:800;" +
        "letter-spacing:.1em;text-transform:uppercase;color:var(--text2,#c7cddb)}",
      ".rj103-sec .cnt{margin-left:auto;font-size:11px;color:var(--text3,#6b7280)}",

      ".rj103-c{position:relative;margin:0 16px 9px;padding:14px;border-radius:14px;overflow:hidden;" +
        "background:var(--surface2,rgba(255,255,255,.035));" +
        "border:1px solid rgba(255,255,255,.09);border-left:3px solid var(--t)}",
      ".rj103-c.off{opacity:.55}",
      ".rj103-h{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}",
      ".rj103-n{font-family:var(--font-display);font-size:14.5px;font-weight:800;color:#fff}",
      ".rj103-a{font-size:11px;color:var(--muted,#8b93a7)}",
      ".rj103-p{margin-left:auto;font-family:var(--font-display);font-size:13px;font-weight:800;color:var(--t)}",
      ".rj103-d{margin-top:8px;font-size:12px;line-height:1.55;color:var(--soft,#aeb6c6)}",

      ".rj103-cond{margin-top:11px;padding-top:10px;border-top:1px solid rgba(255,255,255,.07)}",
      ".rj103-cl{display:flex;align-items:center;gap:8px;padding:4px 0;font-size:11.5px}",
      ".rj103-cl .ic{width:13px;flex-shrink:0;text-align:center;font-size:11px}",
      ".rj103-cl.ok .ic{color:#34D399}",
      ".rj103-cl.ko .ic{color:#F87171}",
      ".rj103-cl .t{flex:1;min-width:0;color:var(--soft,#aeb6c6)}",
      ".rj103-cl .v{font-variant-numeric:tabular-nums;font-weight:700}",
      ".rj103-cl.ok .v{color:#34D399}",
      ".rj103-cl.ko .v{color:#F87171}",

      ".rj103-btn{width:100%;margin-top:11px;padding:11px;border:none;border-radius:10px;cursor:pointer;" +
        "font-family:var(--font-display);font-size:11px;font-weight:800;letter-spacing:.1em;" +
        "text-transform:uppercase;background:var(--t);color:#0d0d12}",
      ".rj103-verr{margin-top:11px;padding:9px 11px;border-radius:9px;font-size:11px;" +
        "color:var(--muted,#8b93a7);background:rgba(255,255,255,.03);" +
        "border:1px solid rgba(255,255,255,.07)}",

      ".rj103-actif{border-left-width:3px}",
      ".rj103-etat{display:inline-block;margin-top:8px;padding:3px 8px;border-radius:4px;" +
        "font-family:var(--font-display);font-size:9px;font-weight:800;letter-spacing:.1em;" +
        "text-transform:uppercase;background:rgba(52,211,153,.13);color:#34D399;" +
        "border:1px solid rgba(52,211,153,.35)}"
    ].join("\n");
    var st = document.createElement("style");
    st.id = CSS_ID; st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  function section(lbl, compte) {
    return '<div class="rj103-sec"><span class="bar"></span><span class="lbl">' + esc(lbl) + '</span>' +
           (compte != null ? '<span class="cnt">' + compte + '</span>' : '') + '</div>';
  }

  function ligneCondition(c, valeur) {
    var ok = valeur >= c.requis;
    var affV = c.affiche ? c.affiche(mesures()) : nb(valeur);
    var affR = c.requisAffiche || (nb(c.requis) + (c.unite ? " " + c.unite : ""));
    if (!c.affiche && c.unite) affV = nb(valeur) + " " + c.unite;
    return '<div class="rj103-cl ' + (ok ? "ok" : "ko") + '">' +
             '<span class="ic">' + (ok ? "\u2713" : "\u2717") + '</span>' +
             '<span class="t">' + esc(c.lbl) + '</span>' +
             '<span class="v">' + esc(affV) + " / " + esc(affR) + '</span>' +
           '</div>';
  }

  function carte(p, m, actif) {
    var e = evaluer(p, m);
    var h = '<div class="rj103-c' + (actif ? " rj103-actif" : (e.ouvert ? "" : " off")) +
            '" style="--t:' + p.couleur + '">' +
      '<div class="rj103-h">' +
        '<span class="rj103-n">' + esc(actif ? (actif.nom || p.nom) : p.nom) + '</span>' +
        '<span class="rj103-a">' + esc(p.accroche) + '</span>' +
        (actif ? '' : '<span class="rj103-p">' + nb(p.cout) + ' €</span>') +
      '</div>';

    if (actif) {
      h += '<div class="rj103-etat">En activité</div>';
      h += '<div class="rj103-d">' + esc(p.description) + '</div>';
      return h + "</div>";
    }

    h += '<div class="rj103-d">' + esc(p.description) + '</div>';
    h += '<div class="rj103-cond">';
    p.conditions.forEach(function (c) { h += ligneCondition(c, c.valeur(m)); });
    h += '</div>';

    if (e.ouvert) {
      h += '<button class="rj103-btn" data-lancer="' + p.id + '">Lancer ce projet</button>';
    } else {
      /* On nomme ce qui manque plutôt que de se contenter d'un refus. */
      var quoi = e.manquantes.map(function (x) { return x.cond.lbl.toLowerCase(); });
      h += '<div class="rj103-verr">Il te manque : ' + esc(quoi.join(", ")) + ".</div>";
    }
    return h + "</div>";
  }

  function rendre(hote) {
    hote = hote || document.getElementById("pat-projets");
    if (!hote) return;
    injecterCSS();

    var m = mesures();
    var enCours = lances();
    var actifs = CATALOGUE.filter(function (p) { return enCours[p.id]; });
    var dispo = CATALOGUE.filter(function (p) {
      return !enCours[p.id] && evaluer(p, m).ouvert;
    });
    var verrous = CATALOGUE.filter(function (p) {
      return !enCours[p.id] && !evaluer(p, m).ouvert;
    });

    var h = "";
    if (actifs.length) {
      h += section("En activité", actifs.length);
      actifs.forEach(function (p) { h += carte(p, m, enCours[p.id]); });
    }
    if (dispo.length) {
      h += section("À ta portée", dispo.length);
      dispo.forEach(function (p) { h += carte(p, m, null); });
    }
    if (verrous.length) {
      h += section("Plus tard", verrous.length);
      verrous.forEach(function (p) { h += carte(p, m, null); });
    }
    hote.innerHTML = h;

    if (!hote._rj103) {
      hote.addEventListener("click", function (ev) {
        var b = ev.target.closest ? ev.target.closest("[data-lancer]") : null;
        if (b) lancer(b.getAttribute("data-lancer"));
      });
      hote._rj103 = true;
    }
  }

  /* ==================================================================
   * 5. LANCEMENT
   * ================================================================== */
  function lancer(id) {
    var p = CATALOGUE.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var G = G_();
    if (!G) return;
    var m = mesures();
    if (!evaluer(p, m).ouvert) return;

    /* La création détaillée — nom, positionnement, mise — viendra avec le
       module de chaque projet. En attendant, on enregistre l'essentiel pour
       que rien ne soit perdu et que la carte passe en activité. */
    var l = lances();
    l[id] = {
      id: id, nom: p.nom,
      saison: G.saison || 1, semaine: G.semaine || 1,
      mise: p.cout
    };
    G.budget = Math.max(0, (G.budget || 0) - p.cout);

    try { if (typeof showToast === "function") showToast(p.nom + " — lancée !"); } catch (e) {}
    try { if (typeof updateUI === "function") updateUI(); } catch (e) {}
    rendre();
  }

  /* ==================================================================
   * 6. PERSISTANCE
   * ================================================================== */
  function brancherPersistance() {
    if (!Array.isArray(window.RJ_SAVE_HOOKS)) return false;
    if (window.RJ_SAVE_HOOKS.some(function (h) { return h && h.cle === "projets"; })) return true;
    window.RJ_SAVE_HOOKS.push({
      cle: "projets",
      ecrire: function (G) { return (G && G._rjProjets) ? { liste: G._rjProjets } : null; },
      lire: function (bloc, G) { if (bloc && bloc.liste && G) G._rjProjets = bloc.liste; }
    });
    return true;
  }

  function boot() {
    brancherPersistance();
    window._rj103 = {
      rendre: rendre, catalogue: CATALOGUE, mesures: mesures,
      evaluer: function (id) {
        var p = CATALOGUE.filter(function (x) { return x.id === id; })[0];
        return p ? evaluer(p, mesures()) : null;
      },
      lances: lances, lancer: lancer
    };
    window._rj103Uninstall = function () {
      var c = document.getElementById(CSS_ID); if (c) c.remove();
      console.log(TAG, "désinstallé");
    };
    console.log(TAG, "catalogue de " + CATALOGUE.length + " projets");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
