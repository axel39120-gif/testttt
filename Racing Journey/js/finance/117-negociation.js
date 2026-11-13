/* =====================================================================
 * 117-negociation.js — L'ARGENT ET LA CONCURRENCE À LA TABLE
 *
 * POURQUOI
 * La négociation existait déjà (patience de l'écurie, actions, leviers,
 * clauses : 06 et 11) mais ignorait les deux choses qui décident d'un baquet :
 * l'argent et les autres candidats (116). Apporter un sponsor rapportait
 * 8 000 €, et une négociation ratée ne profitait à personne.
 *
 * CE QUE LE MODULE CHANGE
 *   - PATIENCE DE DÉPART : selon ta marge sur le deuxième candidat. Seul en
 *     lice avec une large avance, l'écurie t'écoute ; un rival te talonne, elle
 *     a un plan B et le sait.
 *   - APPORTER UN SPONSOR : engage la moitié d'une saison de tes revenus de
 *     sponsors pour réduire le prix du baquet (ou l'apport). Réussite selon ta
 *     réputation et ton agent ; une fois par négociation.
 *   - ÉCHEC : si l'écurie quitte la table alors qu'un rival attendait, elle
 *     le signe à ta place.
 *   - RÉSUMÉ : le prix du baquet et son échéancier, l'apport demandé, ce que
 *     l'écurie regarde et tes concurrents.
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[117-negociation]";

  function euros(n) {
    n = Math.round(n || 0);
    return Math.abs(n) >= 1e6 ? (n / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " M€"
      : Math.abs(n) >= 1e3 ? Math.round(n / 1e3).toLocaleString("fr-FR") + " k€" : n + " €";
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function sponsorsAnnuels() { return (G.sponsors || []).reduce(function (a, s) { return a + (s.fee || 0); }, 0) * 12; }
  function prixActuel(o) { return o.cCost !== null && o.cCost !== undefined ? o.cCost : (o.cost || 0); }

  /* --- Patience de départ ---------------------------------------------- */
  function ajustementPatience(o) {
    var c = o && o._concurrence;
    if (!c || !c.rival) return 0;
    if (c.marge < 0) return -20;          // deuxième choix : le premier s'est désisté
    if (c.marge < 0.05) return -15;       // un rival te talonne
    if (c.marge < 0.15) return -5;
    return 10;                            // l'écurie te veut toi
  }

  /* --- Apporter un sponsor ----------------------------------------------- */
  function apporterSponsor(args, suite) {
    var state = args[0], o = args[1], levier = args[2];
    if (levier !== "bring_sponsor") return suite();
    state.usedActions.bring_sponsor = (state.usedActions.bring_sponsor || 0) + 1;
    var engage = Math.round(sponsorsAnnuels() * 0.5 / 1e4) * 1e4, prix = prixActuel(o);
    if (state.usedActions.bring_sponsor > 1 || engage <= 0 || prix <= 0) {
      state.patience -= 6;
      state.lastMsg = engage <= 0 ? "Aucun sponsor à engager" : prix <= 0 ? "Rien à financer" : "Tes sponsors sont déjà engagés";
      state.lastDetail = engage <= 0 ? "Sans sponsor personnel, tu n'as rien à mettre sur la table."
        : "L'écurie n'attend pas d'argent de ta part sur cette offre." ;
      state.lastSuccess = false;
    } else {
      var agent = G.agent && G.agent.type !== "parent" ? (G.agent.skill || 30) : 20;
      var chance = Math.min(0.9, 0.45 + (G.reputation || 0) / 300 + agent / 400);
      if (Math.random() < chance) {
        var baisse = Math.min(prix, engage);
        o.cCost = prix - baisse;
        state.patience = Math.min(100, state.patience + 8);
        state.bonusChance = (state.bonusChance || 0) + 0.08;
        state.lastMsg = "Tes sponsors financent ta place";
        state.lastDetail = "Ils s'engagent à hauteur de " + euros(baisse) + " : le prix passe à " + euros(o.cCost) + ".";
        state.lastSuccess = true;
      } else {
        state.patience -= 8;
        state.lastMsg = "L'écurie n'est pas convaincue";
        state.lastDetail = "Elle préfère un engagement ferme au nom d'un partenaire plus solide.";
        state.lastSuccess = false;
      }
    }
    state.history.push({ action: levier, msg: state.lastMsg, patience: state.patience });
    if (state.patience <= 0) { state.status = "expired"; state.lastDetail += " L'écurie quitte la table."; }
    return state;
  }

  /* --- Échec : l'écurie signe son plan B ------------------------------------ */
  function apresAction() {
    if (typeof NEG_STATE === "undefined" || !NEG_STATE || typeof NEG_IDX === "undefined") return;
    var o = (G.offers || [])[NEG_IDX];
    if (!o || o._planB || !(NEG_STATE.status === "expired" || NEG_STATE.status === "walked_away")) return;
    var rival = o._concurrence && o._concurrence.rival;
    o._planB = true;
    o.expired = true; o.expire = 0;
    if (rival && typeof pushHomeToast === "function")
      pushHomeToast(o.team + " a signé " + rival.nom, "Faute d'accord avec toi, l'écurie s'est tournée vers son deuxième choix.", "#F97316");
  }

  /* --- Résumé de l'offre --------------------------------------------------- */
  function resume(html, args) {
    var o = args[0];
    if (!o) return html;
    var lignes = [], prix = prixActuel(o), c = o._concurrence;
    if (prix > 0) lignes.push("<div><span>Prix du baquet</span><b>" + euros(prix) + "</b><em>un tiers à la signature, le reste sur huit mois</em></div>");
    if (o._apport) lignes.push("<div><span>Dont apport demandé</span><b>" + euros(o._apport) + "</b><em>l'écurie compte sur ton argent</em></div>");
    if (o._prixAvantAcademie) lignes.push("<div><span>Pris en charge par ton académie</span><b>" + euros(o._prixAvantAcademie) + "</b></div>");
    if (o._baquetOffert) lignes.push("<div><span>Baquet offert par l'écurie</span><b>0 €</b><em>tu n'as rien à payer pour signer</em></div>");
    if (sponsorsAnnuels() > 0 && prix > 0) lignes.push("<div><span>Tes sponsors sur une saison</span><b>" + euros(sponsorsAnnuels()) + "</b></div>");
    if (c) {
      var w = c.priorites, regard = w.argent >= 0.35 ? "surtout l'argent apporté" : w.argent >= 0.2 ? "le talent et l'argent" : "surtout le talent";
      lignes.push("<div><span>Ce que l'écurie regarde</span><b>" + regard + "</b></div>");
      if (c.rival) lignes.push("<div><span>" + (c.marge < 0.05 ? "Rival qui te talonne" : "Autre candidat") + "</span><b>" + esc(c.rival.nom) +
        "</b><em>note " + Math.round(c.rival.talent) + " · soutien " + euros(c.rival.argent) + "</em></div>");
    }
    return lignes.length ? html + '<div class="rj117-argent">' + lignes.join("") + "</div>" : html;
  }

  /* Onglet « Offres équipes » (v287) : le contrat du moment sous son propre
     titre, au-dessus des offres. renderOffers (03) le met en tête de la liste
     des offres (bloc sans classe .offer-card) ; on le déplace. */
  function contratActuel() {
    var place = document.getElementById("ct-contrat-actuel"), liste = document.getElementById("offers-list");
    if (!place || !liste) return;
    var bloc = [].slice.call(liste.children).filter(function (x) { return !x.classList.contains("offer-card") && /contrat en cours/i.test(x.textContent || ""); })[0];
    place.innerHTML = "";
    if (bloc) place.appendChild(bloc);
    else place.innerHTML = '<div class="rj117-sans-contrat">' + (G.currentTeam && G.currentTeam !== "Indépendant" ? "Contrat en fin de course." : "Aucun contrat : tu roules en indépendant.") + "</div>";
  }

  function boot() {
    if (typeof rjInscrire !== "function" || typeof computeInitialPatience !== "function" || typeof _negResolveLeverage !== "function" ||
        typeof _negSummaryHTML !== "function" || typeof negDoAction !== "function") return setTimeout(boot, 150);
    rjInscrire("computeInitialPatience", { id: "117-negociation:patience", apres: function (p, args) {
      return Math.max(15, Math.min(100, p + ajustementPatience(args[0])));
    } });
    rjInscrire("_negResolveLeverage", { id: "117-negociation:sponsor", remplace: apporterSponsor });
    rjInscrire("_negSummaryHTML", { id: "117-negociation:resume", apres: resume });
    rjInscrire("negDoAction", { id: "117-negociation:planB", apres: apresAction });
    rjInscrire("renderOffers", { id: "117-negociation:contrat-actuel", apres: function (r) { try { contratActuel(); } catch (e) {} return r; } });
    window.RJNegociation = { ajustementPatience: ajustementPatience, sponsorsAnnuels: sponsorsAnnuels };
    window._rj117Uninstall = function () { rjDesinscrire(["117-negociation:"]); delete window.RJNegociation; };
    console.log(TAG, "actif — argent et concurrence à la table");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
