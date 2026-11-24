/* =====================================================================
 * 150-contrats.js — LE MERCATO SIGNE POUR DE VRAI
 *
 * POURQUOI (audit v293)
 *   - Au mercato, « Confirmer » une offre lançait la saison suivante avec le
 *     seul salaire : le prix du baquet n'était jamais payé, la négociation
 *     et l'échéancier (116) étaient court-circuités. Attendre le mercato
 *     suffisait à rouler gratuitement.
 *   - Les cartes du mercato ne montraient pas le prix du baquet.
 *   - L'onglet « Pilotes » du mercato distribuait « Reconduit / Transfert /
 *     Nouveau contrat / En négo / Libre » en boucle, sans rapport avec la
 *     réalité.
 *   - La durée du contrat s'affichait en mois sur une base de 48 semaines
 *     par saison (« 8 mois restants » pour un contrat de deux saisons).
 *
 * CE QUE FAIT LE MODULE
 *   - une offre choisie au mercato passe par la vraie signature
 *     (signContract : âge, prix du baquet, échéancier, réserviste…) ; si
 *     elle échoue (budget), le mercato le dit et la saison ne démarre pas ;
 *   - chaque carte d'offre affiche le prix du baquet ;
 *   - les mentions factices de l'onglet Pilotes sont retirées ;
 *   - le contrat en cours s'affiche en saisons : « jusqu'à fin S9 ».
 *
 * Réversible : window._rj150Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[150-contrats]";
  function euros(n) {
    n = Math.round(n || 0);
    return n >= 1e6 ? (n / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " M€" : Math.round(n / 1e3).toLocaleString("fr-FR") + " k€";
  }
  function prix(o) { return o ? (o.cCost != null ? o.cCost : (o.cost || 0)) : 0; }

  /* L'offre de G.offers qui correspond à une carte du mercato. */
  function offreDe(carte) {
    if (!carte || !carte.team || carte.isPendingTransfer || carte.keepContract || carte.isSaisonBlanche) return -1;
    var cat = carte.nextCat || G.cat;
    for (var i = 0; i < (G.offers || []).length; i++) {
      var o = G.offers[i];
      if (o && o.team === carte.team && o.cat === cat) return i;
    }
    return -1;
  }

  function message(texte) {
    var L = document.getElementById("tr-offers-list");
    if (!L) return;
    var m = document.getElementById("rj150-fb");
    if (!m) { m = document.createElement("div"); m.id = "rj150-fb"; m.className = "rj150-fb"; L.parentNode.insertBefore(m, L); }
    m.textContent = texte;
  }

  /* startNextSeason(carte) : signer d'abord, comme dans l'écran des contrats. */
  function avantSaison(args, suite) {
    var carte = args[0], i = offreDe(carte);
    if (i < 0) return suite();
    var o = G.offers[i], cout = prix(o), avant = G.pendingTransfer, dureeAvant = G.contractDur, budgetAvant = G.budget;
    try { signContract(i); } catch (e) { console.warn(TAG, e && e.message); }
    var signe = (G.pendingTransfer && G.pendingTransfer !== avant && G.pendingTransfer.team === o.team) ||
      (o.team === G.currentTeam && o.cat === G.cat && (G.contractDur !== dureeAvant || G.budget !== budgetAvant || !(G.offers || []).some(function (x) { return x === o; })));
    if (!signe) {
      message(cout > G.budget
        ? "Signature impossible avec " + o.team + " : il faut " + euros(cout) + ", ton budget est de " + euros(G.budget) + ". Négocie dans Contrats & revenus, ou choisis une autre offre."
        : "Signature impossible avec " + o.team + " pour le moment. Ouvre Contrats & revenus pour voir pourquoi.");
      return null;
    }
    return suite();
  }

  /* Après le dessin du mercato : prix des baquets, mentions factices retirées. */
  function apresMercato() {
    var L = document.getElementById("tr-offers-list");
    if (L) Array.prototype.forEach.call(L.children, function (div) {
      if (div.querySelector(".rj150-prix")) return;
      var t = div.textContent || "";
      var o = (G.offers || []).filter(function (x) {
        return x && t.indexOf(x.team) >= 0 && (x.cat === G.cat ? true : t.indexOf(x.cat) >= 0);
      })[0];
      if (!o) return;
      var c = prix(o), btn = div.querySelector("button");
      var p = document.createElement("div");
      var tiers = Math.round(c / 3);
      p.className = "rj150-prix" + (c > 0 ? (c > G.budget ? " trop" : "") : " offert");
      p.textContent = c > 0 ? "Baquet : " + euros(c) + " — " + euros(tiers) + " à la signature, le reste sur huit mois" + (o._prixAvantAcademie ? " (l'académie a payé " + euros(o._prixAvantAcademie) + ")" : "") + (c > G.budget ? " · budget " + euros(G.budget) + " : insuffisant" : "")
        : "Baquet offert";
      if (btn) div.insertBefore(p, btn); else div.appendChild(p);
    });
    var grille = document.getElementById("tr-grid-list");
    if (grille) grille.querySelectorAll("span").forEach(function (s) {
      if (/^(Reconduit|Transfert|Nouveau contrat|En nego|Libre)$/.test((s.textContent || "").trim())) s.remove();
    });
  }

  /* Contrat en cours : en saisons, d'après la durée réelle (contractDur). */
  function apresOffres() {
    var bloc = document.getElementById("ct-contrat-actuel") || document.getElementById("ct-offres");
    if (!bloc || !G.currentTeam || G.currentTeam === "Indépendant") return;
    var dur = Math.max(1, G.contractDur || 1), fin = (G.saison || 1) + dur - 1;
    var sous = dur === 1 ? "dernière saison" : (dur - 1) + " saison" + (dur > 2 ? "s" : "") + " de plus";
    bloc.querySelectorAll("div").forEach(function (d) {
      if ((d.textContent || "").trim() === "restants" && d.previousElementSibling) {
        d.previousElementSibling.textContent = "Fin S" + fin;
        d.textContent = sous;
      }
    });
  }

  function installer() {
    if (typeof rjInscrire !== "function" || typeof window.startNextSeason !== "function" || typeof window.buildTransferOffers !== "function" || typeof window.renderOffers !== "function") return false;
    rjInscrire("startNextSeason", { id: "150-contrats:signature", ordre: -9000, remplace: avantSaison });
    rjInscrire("buildTransferOffers", { id: "150-contrats:mercato", apres: function () { try { apresMercato(); } catch (e) { console.warn(TAG, e && e.message); } } });
    /* 11 et 117 redessinent et déplacent le bloc juste après : on repasse ensuite. */
    rjInscrire("renderOffers", { id: "150-contrats:duree", apres: function () { [0, 80, 300].forEach(function (t) { setTimeout(function () { try { apresOffres(); } catch (e) { console.warn(TAG, e && e.message); } }, t); }); } });
    window._rj150 = { offreDe: offreDe, apresMercato: apresMercato, apresOffres: apresOffres };
    window._rj150Uninstall = function () { ["startNextSeason", "buildTransferOffers", "renderOffers"].forEach(function (f) { rjDesinscrire(["150-contrats:"], f); }); };
    console.log(TAG, "actif");
    return true;
  }

  (function boot() {
    var n = 0;
    (function tenter() { if (!installer() && n++ < 80) setTimeout(tenter, 150); })();
  })();
})();
