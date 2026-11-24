/* =====================================================================
 * 161-accords.js — UN BAQUET SE PAIE, OU SE PROMET
 *
 * RÈGLES (retour du joueur, v302)
 *   - Une négociation reprend où on l'a laissée : son état vit sur l'offre
 *     (offre._neg, sauvegardée avec elle).
 *   - Signer un baquet demande d'avoir son prix ENTIER. Sinon, on conclut un
 *     ACCORD SOUS CONDITION : rien n'est payé, l'écurie réserve la place
 *     jusqu'à la fin de la saison. À ce moment-là : fonds réunis, l'accord est
 *     honoré (vraie signature) ; sinon il tombe.
 *   - L'accord n'empêche pas de négocier ailleurs : les autres offres restent,
 *     et s'il n'y en a aucune l'agent en cherche une.
 *   - Plusieurs accords financés : le joueur choisit au mercato.
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[161-accords]";
  function prix(o) { return o ? (o.cCost != null ? o.cCost : o.cost || 0) : 0; }
  function euros(n) { return Math.round(n || 0).toLocaleString("fr-FR") + " €"; }
  function accords() { return (G.offers || []).filter(function (o) { return o && o._accord; }); }
  function autres() { return (G.offers || []).filter(function (o) { return o && !o._accord && !o.expired && o.role !== "num3"; }); }
  function finDeSaison() { return !!G.seasonOver; }
  function agent(sujet, corps) {
    if (typeof pushMail === "function" && G.agent) pushMail({ from: "Agent", role: "agent", subject: sujet, body: corps, actions: [{ label: "Compris", kind: "dismiss", responseBody: "Merci, on reste en contact." }] });
  }
  function ageOk(o) {
    var an = G.pilot && G.pilot.dob && G.pilot.dob.year && G.gameYear ? G.gameYear + 1 - G.pilot.dob.year : (G.age || 10) + 1, min = typeof CAT_MIN_AGE !== "undefined" ? CAT_MIN_AGE[o.cat] : undefined;
    return min === undefined || an >= min;
  }

  /* Une offre de repli : l'écurie libre la moins chère, même catégorie ou suivante. */
  function chercherRepli() {
    if (autres().length || !accords().length || G.pendingTransfer || typeof buildOffer !== "function" || typeof TEAM_OFFERS === "undefined") return null;
    var prises = {}; (G.offers || []).forEach(function (o) { prises[o.team + "|" + o.cat] = 1; });
    var cats = accords().map(function (o) { return o.cat; }).concat(G.cat), liste = [];
    cats.forEach(function (cat, r) {
      if (cats.indexOf(cat) !== r) return;
      var plan = {}; try { plan = RJBaquets.places(cat) || {}; } catch (e) {}
      (TEAM_OFFERS[cat] || []).forEach(function (t) {
        if (prises[t.team + "|" + cat] || (t.team === G.currentTeam && cat === G.cat) || (plan[t.team] !== undefined && plan[t.team] <= 0)) return;
        liste.push(Object.assign({}, t, { cat: cat, duration: t.dur || 1 }));
      });
    });
    liste = liste.filter(ageOk).sort(function (a, b) { return (a.cost || 0) - (b.cost || 0); });
    if (!liste.length) return null;
    var o = buildOffer(Object.assign({}, liste[0], { expire: 12 }));
    try { RJBaquets.prix(o); } catch (e) {}
    o._repli = true;
    G.offers.push(o);
    agent("Un plan B — " + o.team, "Ton accord avec <strong>" + accords()[0].team + "</strong> n'est pas encore financé. J'ai ouvert une discussion avec <strong>" + o.team + "</strong> en " + o.cat + " (" + (prix(o) ? euros(prix(o)) : "baquet offert") + "), au cas où.");
    return o;
  }

  function conclure(o) {
    o._accord = { saison: G.saison, prix: prix(o) };
    o.negOk = true; o.expire = 99;
    if (typeof showFb === "function") showFb("cont-fb", "warn", "Accord sous condition avec " + o.team, "Il te faut " + euros(prix(o)) + " avant la fin de la saison (tu as " + euros(G.budget) + "). Rien n'est payé d'ici là.");
    agent("Accord sous condition — " + o.team, "<strong>" + o.team + "</strong> te réserve sa place en " + o.cat + ". Il faudra présenter <strong>" + euros(prix(o)) + "</strong> à la fin de la saison : il manque <strong>" + euros(Math.max(0, prix(o) - G.budget)) + "</strong>. Continue à discuter ailleurs, l'accord tombe si les fonds n'y sont pas.");
    try { if (typeof recordDecision === "function") recordDecision("contract", "Accord sous condition avec " + o.team, euros(prix(o)) + " à réunir avant la fin de saison", "neutral", [o.team]); } catch (e) {}
    chercherRepli();
    if (typeof updateUI === "function") updateUI();
    if (typeof renderOffers === "function") renderOffers();
  }

  /* signContract : tout l'argent, ou un accord (hors réserviste et remplacement immédiat). */
  function signer(args, suite) {
    var o = (G.offers || [])[args[0]], p = prix(o);
    if (!o || o._rj79Immediate || o.role === "num3" || !(p > 0) || G.budget >= p) {
      var avant = accords().filter(function (x) { return x !== o; }), r = suite();
      // une vraie signature remplace les accords en attente
      if (o && G.pendingTransfer && G.pendingTransfer.team === o.team) avant.forEach(function (x) { var i = (G.offers || []).indexOf(x); if (i >= 0) G.offers.splice(i, 1); });
      return r;
    }
    if (!ageOk(o)) return suite();          // le cœur explique l'âge insuffisant
    if (finDeSaison()) {
      if (typeof showFb === "function") showFb("cont-fb", "err", "Fonds insuffisants", "Le baquet coûte " + euros(p) + ", tu as " + euros(G.budget) + ".");
      return null;
    }
    if (!o._accord) conclure(o);
    return null;
  }

  /* Fin de saison : on honore, ou l'accord tombe. */
  function echeance() {
    if (!accords().length || G._rj161Fin === G.saison) return;
    G._rj161Fin = G.saison;
    var finances = accords().filter(function (o) { return G.budget >= prix(o); });
    accords().filter(function (o) { return finances.indexOf(o) < 0; }).forEach(function (o) {
      var i = G.offers.indexOf(o); if (i >= 0) G.offers.splice(i, 1);
      agent("Accord rompu — " + o.team, "Les " + euros(prix(o)) + " n'étaient pas réunis (tu as " + euros(G.budget) + ") : <strong>" + o.team + "</strong> donne la place à un autre pilote." + (G.offers.length ? " Il nous reste " + G.offers.length + " piste" + (G.offers.length > 1 ? "s" : "") + " au mercato." : ""));
      if (typeof pushHomeToast === "function") pushHomeToast("Accord rompu : " + o.team, "Fonds non réunis à temps.", "#EF4444");
    });
    if (finances.length === 1) {
      var o = finances[0]; delete o._accord;
      signContract(G.offers.indexOf(o));
      if (typeof pushHomeToast === "function") pushHomeToast("Contrat honoré : " + o.team, "Les fonds sont réunis, tu rejoins l'écurie.", "#34D399");
    } else finances.forEach(function (x) { x._accordFinance = true; });   // le joueur choisit au mercato
  }

  /* --- Cartes d'offre ------------------------------------------------- */
  function habiller() {
    var L = document.querySelectorAll("#offers-list .offer-card");
    [].forEach.call(L, function (c, i) {
      var o = G.offers[i], p = prix(o); if (!o || c.querySelector(".rj161")) return;
      var actions = c.lastElementChild, d = document.createElement("div"); d.className = "rj161";
      if (o._accord) {
        // la carte du cœur parle encore de budget insuffisant et d'un délai en courses
        c.querySelectorAll("div, span").forEach(function (x) { if (x.children.length) return; var t = x.textContent.trim(); if (/^Budget insuffisant|^Contre-offre acceptee/.test(t)) x.remove(); else if (/^d+ course/i.test(t)) x.textContent = "Fin de saison"; });
        var part = p > 0 ? Math.min(100, Math.floor(G.budget / p * 100)) : 100;
        d.innerHTML = "<b>Accord sous condition</b><span>" + (G.budget >= p ? "Fonds réunis : tu peux signer maintenant, ou attendre la fin de saison." : "Il manque " + euros(p - G.budget) + " avant la fin de la saison.") + '</span><i><u style="width:' + part + '%"></u></i>';
        actions.innerHTML = (G.budget >= p ? '<button class="btn btn-prim" style="flex:1;margin:0" onclick="RJAccords.signer(' + i + ')">Signer</button>' : "") + '<button class="btn btn-sec" style="flex:1;margin:0" onclick="RJAccords.renoncer(' + i + ')">Renoncer</button>';
      } else if (p > 0 && G.budget < p && !finDeSaison() && o.role !== "num3" && !o._rj79Immediate) {
        c.querySelectorAll("div").forEach(function (x) { if (!x.children.length && /^Budget insuffisant/.test(x.textContent.trim())) x.remove(); });
        d.innerHTML = "<span>Tu n'as pas encore " + euros(p) + " : tu peux réserver la place, à payer en fin de saison.</span>";
        var b = document.createElement("button"); b.className = "btn btn-prim"; b.style.cssText = "flex:1;margin:0"; b.textContent = "Accord sous condition"; b.onclick = function () { signContract(i); };
        actions.insertBefore(b, actions.firstChild);
      } else if (o._neg && o._neg.status === "active" && (o._neg.history || []).length) d.innerHTML = "<span>Négociation en cours : elle reprendra où tu l'as laissée.</span>";
      else return;
      c.insertBefore(d, actions);
    });
  }
  function renoncer(i) {
    var o = G.offers[i]; if (!o || !o._accord) return;
    G.offers.splice(i, 1);
    if (typeof showFb === "function") showFb("cont-fb", "warn", "Accord annulé", "Tu renonces à la place chez " + o.team + ".");
    renderOffers();
  }
  function signerAccord(i) { var o = G.offers[i]; if (!o) return; delete o._accord; signContract(i); }

  function boot() {
    if (typeof rjInscrire !== "function" || typeof signContract !== "function" || typeof showSeasonEnd !== "function" || !Array.isArray(window.WEEKLY_TICK_HOOKS) || !Array.isArray(window.RJ_SAVE_HOOKS)) return setTimeout(boot, 120);
    rjInscrire("signContract", { id: "161-accords:signature", ordre: -9500, remplace: signer });
    rjInscrire("showSeasonEnd", { id: "161-accords:echeance", ordre: -1000, remplace: function (args, suite) {   // après les primes (11), avant l'affichage du bilan
      G.seasonOver = true; try { echeance(); } catch (e) { console.warn(TAG, e); } return suite();
    } });
    rjInscrire("renderOffers", { id: "161-accords:cartes", ordre: 900, apres: function (r) { try { habiller(); } catch (e) { console.warn(TAG, e); } return r; } });
    window.WEEKLY_TICK_HOOKS.push({ id: "161-accords", run: function () { try { chercherRepli(); } catch (e) {} } });
    window.RJ_SAVE_HOOKS.push({ cle: "rj161", ecrire: function (g) { return { fin: g._rj161Fin || 0 }; }, lire: function (b, g) { g._rj161Fin = (b && b.fin) || 0; } });
    window.RJAccords = { liste: accords, echeance: echeance, renoncer: renoncer, signer: signerAccord, repli: chercherRepli };
    console.log(TAG, "actif — baquet payé en entier, ou accord sous condition");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
