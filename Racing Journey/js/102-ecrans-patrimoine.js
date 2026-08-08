/* =====================================================================
 * 102-ecrans-patrimoine.js — DE LA PLACE POUR CE QU'ON BÂTIT
 *
 * POURQUOI CE REMANIEMENT
 * L'argent n'avait qu'une destination utile : le style de vie. La
 * comptabilité et les achats de performance étaient rangés dans un onglet
 * « Finances » logé au fond de « Contrats & revenus » — un endroit qu'on
 * ne visite que pour négocier un contrat. Rien ne pouvait accueillir des
 * projets de long terme.
 *
 * CE QUE FAIT CE MODULE
 *   1. Un écran PATRIMOINE, avec trois onglets : les comptes, les projets
 *      que l'on bâtit, et les investissements de performance.
 *   2. L'onglet Finances quitte l'écran des contrats, qui retrouve son
 *      objet : les offres, les primes, le réseau.
 *   3. L'AGENT rejoint l'écran d'image, aux côtés du profil public, des
 *      réseaux et de la presse — c'est là qu'est sa place, il gère
 *      l'image et les relations autant que les contrats.
 *   4. L'accueil garde ses trois sections de trois tuiles : la place
 *      libérée par l'agent revient au patrimoine. Aucune ligne bancale.
 *
 * Sur la barre d'onglets de l'écran d'image, « Réseaux sociaux » devient
 * « Réseaux » : les quatre intitulés occupaient déjà 420 pixels sur 430,
 * un cinquième n'entrait pas.
 *
 * Réversible : window._rj102Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[102-patrimoine]";
  var CSS_ID = "rj102-css";

  function G_() { return (typeof window.G !== "undefined") ? window.G : null; }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ==================================================================
   * 1. L'ÉCRAN PATRIMOINE
   * ================================================================== */
  var ONGLETS = [
    { cle: "comptes",  lbl: "Comptes" },
    { cle: "projets",  lbl: "Projets" },
    { cle: "invest",   lbl: "Investissements" }
  ];

  function injecterCSS() {
    if (document.getElementById(CSS_ID)) return;
    var css = [
      "#S-patrimoine .rj102-vide{margin:16px;padding:22px 16px;border:1px dashed rgba(255,255,255,.13);" +
        "border-radius:14px;text-align:center;color:var(--muted,#8b93a7);font-size:12.5px;line-height:1.6}",
      "#S-patrimoine .rj102-vide b{display:block;font-family:var(--font-display);font-size:12px;" +
        "font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--text2,#c7cddb);margin-bottom:8px}"
    ].join("\n");
    var st = document.createElement("style");
    st.id = CSS_ID; st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  function creerEcran() {
    if (document.getElementById("S-patrimoine")) return true;
    var app = document.querySelector(".app") || document.body;
    var modele = document.getElementById("S-contracts");
    if (!modele) return false;

    var scr = document.createElement("div");
    scr.className = "scr";
    scr.id = "S-patrimoine";
    scr.innerHTML =
      '<div class="hdr">' +
        '<button class="hdr-back" onclick="navTo(\'S-home\',\'ni-home\')">\u2039</button>' +
        '<div><div class="hdr-title">Patrimoine</div>' +
        '<div class="hdr-sub" id="pat-sub">Comptes, projets et investissements</div></div>' +
      '</div>' +
      '<div class="tabs" id="pat-tabs">' +
        ONGLETS.map(function (o, i) {
          return '<button class="tab' + (i === 0 ? " on" : "") + '" data-tab="' + o.cle +
                 '" onclick="pattab(\'' + o.cle + '\')">' + o.lbl + '</button>';
        }).join("") +
      '</div>' +
      '<div class="scroll">' +
        ONGLETS.map(function (o, i) {
          return '<div id="pat-' + o.cle + '"' + (i === 0 ? "" : ' style="display:none"') + '></div>';
        }).join("") +
      '</div>';

    modele.parentNode.insertBefore(scr, modele.nextSibling);
    return true;
  }

  window.pattab = function (cle) {
    ONGLETS.forEach(function (o) {
      var el = document.getElementById("pat-" + o.cle);
      if (el) el.style.display = (o.cle === cle) ? "block" : "none";
    });
    var tabs = document.getElementById("pat-tabs");
    if (tabs) {
      [].slice.call(tabs.querySelectorAll(".tab")).forEach(function (b) {
        b.classList.toggle("on", b.getAttribute("data-tab") === cle);
      });
    }
    rendre(cle);
  };

  function rendre(cle) {
    var G = G_();
    if (cle === "comptes") {
      /* La page de comptes existe déjà : on la fait écrire ici. */
      try {
        if (typeof window.renderFinancePage === "function") window.renderFinancePage();
      } catch (e) { console.warn(TAG, "comptes :", e && e.message); }
      extraireInvestissements();
      return;
    }
    if (cle === "projets") {
      var el = document.getElementById("pat-projets");
      if (!el) return;
      /* Le module des projets s'y branchera ; en attendant, on annonce
         l'endroit plutôt que de laisser un vide sans explication. */
      if (window._rj103 && typeof window._rj103.rendre === "function") {
        window._rj103.rendre(el);
        return;
      }
      injecterCSS();
      el.innerHTML =
        '<div class="rj102-vide"><b>Rien de lancé</b>' +
        "Fondation, marque, académie : les projets que tu bâtiras apparaîtront ici." +
        "</div>";
      return;
    }
    if (cle === "invest") {
      /* Le catalogue d'investissements est produit par la page de comptes,
         à la suite du bilan. On le rend d'abord, puis on détache la partie
         « Investissements » vers son propre onglet : sans cela il restait
         vide, et les comptes mêlaient toujours bilan et boutique. */
      try {
        if (typeof window.renderFinancePage === "function") window.renderFinancePage();
      } catch (e) {}
      extraireInvestissements();
    }
  }

  /* Repère le titre « Investissements » dans la page de comptes et déplace
     ce bloc, ainsi que tout ce qui le suit, vers l'onglet dédié. */
  function extraireInvestissements() {
    var comptes = document.getElementById("pat-comptes");
    var cible = document.getElementById("pat-invest");
    if (!comptes || !cible) return;

    var racine = comptes.firstElementChild || comptes;
    var enfants = [].slice.call(racine.children);
    var depart = -1;
    for (var i = 0; i < enfants.length; i++) {
      var t = (enfants[i].textContent || "").trim().slice(0, 40);
      if (/^investissements/i.test(t)) { depart = i; break; }
    }
    if (depart < 0) return;

    cible.innerHTML = "";
    var boite = document.createElement("div");
    boite.style.cssText = "padding:14px 16px";
    for (var k = depart; k < enfants.length; k++) boite.appendChild(enfants[k]);
    cible.appendChild(boite);
  }

  /* ==================================================================
   * 2. LA COMPTABILITÉ CHANGE DE MAISON
   *
   * renderFinancePage écrivait dans le conteneur de l'onglet Finances de
   * l'écran des contrats. On le redirige, et l'onglet d'origine disparaît.
   * ================================================================== */
  var _orig = {};

  function deplacerFinances() {
    if (typeof window.renderFinancePage !== "function") return false;
    if (window.renderFinancePage._rj102) return true;

    _orig.renderFinancePage = window.renderFinancePage;
    window.renderFinancePage = function () {
      /* On prête temporairement l'identifiant attendu au nouveau
         conteneur : la fonction d'origine reste intacte. */
      var cible = document.getElementById("pat-comptes");
      var ancien = document.getElementById("ct-finances");
      if (!cible) return _orig.renderFinancePage.apply(this, arguments);

      var idAncien = null;
      if (ancien) { idAncien = ancien.id; ancien.id = "ct-finances-parked"; }
      cible.id = "ct-finances";
      var r;
      try { r = _orig.renderFinancePage.apply(this, arguments); }
      finally {
        cible.id = "pat-comptes";
        if (ancien && idAncien) ancien.id = idAncien;
      }
      /* La page est redessinée après chaque achat : sans cette extraction,
         le catalogue d'investissements revenait se coller sous les comptes
         dès qu'on investissait. */
      try { extraireInvestissements(); } catch (e) {}
      return r;
    };
    window.renderFinancePage._rj102 = true;
    return true;
  }

  function retirerOngletFinances() {
    var scr = document.getElementById("S-contracts");
    if (!scr) return;
    var b = scr.querySelector('.tab[data-tab="finances"]');
    if (b) b.remove();
    var d = document.getElementById("ct-finances");
    if (d) d.style.display = "none";
  }

  /* ==================================================================
   * 3. L'AGENT REJOINT L'ÉCRAN D'IMAGE
   * ================================================================== */
  function ajouterOngletAgent() {
    var media = document.getElementById("S-media");
    var agent = document.getElementById("S-agent");
    if (!media || !agent) return false;
    if (media.querySelector('.tab[data-tab="agent"]')) return true;

    var tabs = media.querySelector(".tabs");
    var scroll = media.querySelector(".scroll");
    if (!tabs || !scroll) return false;

    /* Quatre intitulés occupaient déjà 420 pixels sur 430 : le cinquième
       n'entrait pas. « Réseaux sociaux » devient « Réseaux ». */
    var social = tabs.querySelector('.tab[data-tab="reseaux"]');
    if (social && /sociaux/i.test(social.textContent)) social.textContent = "Réseaux";

    /* L'écran ne parle plus seulement de réseaux : profil public, presse et
       agent y cohabitent. Le titre le reflète. */
    var titre = media.querySelector(".hdr-title");
    if (titre && /r[ée]seaux/i.test(titre.textContent)) titre.textContent = "Image & entourage";

    var b = document.createElement("button");
    b.className = "tab";
    b.setAttribute("data-tab", "agent");
    b.textContent = "Agent";
    b.onclick = function () { if (typeof window.mtab === "function") window.mtab("agent"); };
    tabs.appendChild(b);

    var hote = document.createElement("div");
    hote.id = "mt-agent";
    hote.style.display = "none";
    scroll.appendChild(hote);
    return true;
  }

  /* Le contenu de l'agent n'existe qu'en un seul exemplaire : il vit soit
     dans l'onglet, soit dans son écran d'origine. On le place explicitement
     selon l'endroit demandé, plutôt que de le déplacer au petit bonheur.
     Deux versions ont échoué ici : le va-et-vient laissait parfois deux
     exemplaires visibles, et le déplacement définitif vidait l'écran
     d'origine — dont la création de pilote se sert pour faire choisir le
     premier agent, qui se retrouvait devant une page noire. */
  function placerAgent(ou) {
    var contenu = document.getElementById("agent-content");
    if (!contenu) {
      var src = document.getElementById("S-agent");
      contenu = src ? src.querySelector(".scroll") : null;
    }
    if (!contenu) return false;

    var cible = (ou === "onglet")
      ? document.getElementById("mt-agent")
      : document.getElementById("S-agent");
    if (!cible) return false;
    if (contenu.parentNode !== cible) cible.appendChild(contenu);
    return true;
  }

  function montrerAgent(actif) {
    if (!actif) return;
    placerAgent("onglet");
    try { if (typeof window.renderAgentScreen === "function") window.renderAgentScreen(); } catch (e) {}
  }

  function brancherOngletAgent() {
    if (typeof window.mtab !== "function" || window.mtab._rj102) return false;
    _orig.mtab = window.mtab;
    window.mtab = function (t) {
      var r;
      if (t === "agent") {
        ["profil", "evenements", "reseaux", "presse", "agent"].forEach(function (k) {
          var el = document.getElementById("mt-" + k);
          if (el) el.style.display = (k === "agent") ? "block" : "none";
        });
        var media = document.getElementById("S-media");
        if (media) {
          [].slice.call(media.querySelectorAll(".tab")).forEach(function (b) {
            b.classList.toggle("on", b.getAttribute("data-tab") === "agent");
          });
        }
        montrerAgent(true);
        return;
      }
      montrerAgent(false);
      var h = document.getElementById("mt-agent");
      if (h) h.style.display = "none";
      r = _orig.mtab.apply(this, arguments);
      return r;
    };
    window.mtab._rj102 = true;
    return true;
  }

  /* ==================================================================
   * 4. L'ACCUEIL
   *
   * La tuile « Agent » cède sa place au patrimoine ; la tuile « Réseaux »
   * devient « Image », puisqu'elle réunit désormais le profil public, les
   * réseaux, la presse et l'agent.
   * ================================================================== */
  /* Un coffre-fort : porte, charnières, cadran et poignée. Aucune autre
     tuile n'utilise cette forme, et elle dit à la fois l'argent et ce
     qu'on met de côté pour plus tard — ce que sont les projets.
     Tracé au trait, comme les huit autres icônes de l'accueil. */
  var ICONE_PATRIMOINE =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
    'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
    /* Les quatre repères du cadran et la porte intérieure surchargeaient
       le tracé : à vingt pixels, tout se refermait en une tache. On garde
       le corps, le cadran, la poignée et les pieds. */
    '<rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/>' +
    '<circle cx="10" cy="12" r="3.6"/>' +
    '<path d="M10 9.6v4.8M7.6 12h4.8"/>' +
    '<path d="M17.5 9.5v5"/>' +
    '<path d="M5.5 19.5v2M18.5 19.5v2"/></svg>';

  function remanierAccueil() {
    var home = document.getElementById("S-home");
    if (!home) return;

    [].slice.call(home.querySelectorAll(".apex-action-tile")).forEach(function (t) {
      var onclick = t.getAttribute("onclick") || "";
      var lbl = t.querySelector(".apex-action-title");

      /* Réseaux → Image */
      if (/S-media/.test(onclick) && lbl && /r[ée]seaux/i.test(lbl.textContent)) {
        lbl.textContent = "Image";
      }

      /* Agent → Patrimoine */
      if (/S-agent/.test(onclick)) {
        t.setAttribute("onclick", "navTo('S-patrimoine',null)");
        if (lbl) lbl.textContent = "Patrimoine";
        var ico = t.querySelector(".apex-action-icon");
        if (ico) {
          var badge = ico.querySelector(".apex-action-badge");
          ico.innerHTML = (badge ? badge.outerHTML : "") + ICONE_PATRIMOINE;
          /* Le vert tranchait avec les huit autres tuiles, toutes au rouge
             de la charte. Rien ne justifiait de distinguer celle-ci. */
          ico.style.setProperty("--accent", "#FF1801");
          ico.style.setProperty("--accent-bg", "rgba(255,24,1,.12)");
          ico.style.setProperty("--accent-border", "rgba(255,24,1,.32)");
          /* L'ancien identifiant ferait réinjecter l'icône de l'agent au
             prochain passage du module de pictogrammes. */
          if (ico.id === "ico-tile-agent") ico.id = "ico-tile-patrimoine";
        }
      }
    });
  }

  /* ==================================================================
   * 5. NAVIGATION
   * ================================================================== */
  function brancherNav() {
    if (typeof window.navTo !== "function" || window.navTo._rj102) return false;
    _orig.navTo = window.navTo;
    window.navTo = function (id) {
      if (id === "S-patrimoine") {
        creerEcran();
        var r = _orig.navTo.apply(this, arguments);
        setTimeout(function () { window.pattab("comptes"); }, 40);
        return r;
      }
      /* Quelque chose ouvre l'écran de l'agent directement — la création de
         pilote, notamment, pour le choix du premier agent. On lui rend son
         contenu avant l'affichage. */
      if (id === "S-agent") {
        placerAgent("ecran");
        var ra = _orig.navTo.apply(this, arguments);
        try { if (typeof window.renderAgentScreen === "function") window.renderAgentScreen(); } catch (e) {}
        return ra;
      }
      return _orig.navTo.apply(this, arguments);
    };
    window.navTo._rj102 = true;
    return true;
  }

  /* ==================================================================
   * 6. INSTALLATION
   * ================================================================== */
  function installer() {
    if (typeof window.navTo !== "function") return false;
    creerEcran();
    deplacerFinances();
    retirerOngletFinances();
    ajouterOngletAgent();
    brancherOngletAgent();
    brancherNav();

    if (Array.isArray(window.RJ_SCREEN_HOOKS) &&
        !window.RJ_SCREEN_HOOKS.some(function (h) { return h && h.id === "102-patrimoine"; })) {
      window.RJ_SCREEN_HOOKS.push({
        id: "102-patrimoine",
        ecran: "S-home",
        apres: function () { setTimeout(remanierAccueil, 60); }
      });
    }
    remanierAccueil();
    return true;
  }

  function boot() {
    var essais = 0;
    (function tenter() {
      if (installer()) { console.log(TAG, "écran Patrimoine en place, agent déplacé"); return; }
      if (essais++ < 80) setTimeout(tenter, 150);
    })();

    window._rj102 = { rendre: rendre, remanierAccueil: remanierAccueil, creerEcran: creerEcran };
    window._rj102Uninstall = function () {
      Object.keys(_orig).forEach(function (k) { window[k] = _orig[k]; });
      var s = document.getElementById("S-patrimoine"); if (s) s.remove();
      var c = document.getElementById(CSS_ID); if (c) c.remove();
      console.log(TAG, "désinstallé");
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
