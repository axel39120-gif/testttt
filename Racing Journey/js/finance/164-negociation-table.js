/* =====================================================================
 * 164-negociation-table.js — LA TABLE DE NÉGOCIATION
 *
 * POURQUOI (audit v306)
 *   - vingt-quatre boutons empilés dans des rubriques à déplier, les
 *     conditions hors de l'écran, des mains dessinées en fil de fer ;
 *   - « prochaine demande favorisée » (autre offre, sponsor, agent) n'avait
 *     aucun effet ; une demande refusée pouvait être répétée jusqu'au oui ;
 *   - réduire un apport nul ou augmenter un salaire nul coûtait de la
 *     patience pour rien ; « Accepter » ne signait pas.
 *
 * CE QUE FAIT LE MODULE
 *   - une seule page : les deux mains, les conditions, quatre onglets de
 *     demandes, et la décision toujours visible ;
 *   - chaque demande se fait une fois ; le levier joué compte vraiment pour
 *     la suivante ; un refus peut amener une contre-proposition ;
 *   - « Signer » conclut vraiment le contrat (signContract).
 * Le calcul (patience, chances) reste dans 06, 11 et 117.
 * Réversible : window._rj164Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var ID = "164-table", onglet = "argent", signature = false;
  var CONCESSIONS = 5, CHANCE_CONTRE = 0.4;
  var CONTRE = { cut_cost_50: "cut_cost_25", cut_cost_25: "cut_cost_10", up_salary_50: "up_salary_25", up_salary_25: "up_salary_10" };
  var TON = { p: "Prudent", f: "Ferme", a: "Audacieux" };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function eur(n) { return Math.round(n || 0).toLocaleString("fr-FR") + " €"; }
  function court(n) { n = n || 0; return n >= 1e6 ? (n / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " M€" : n >= 1e4 ? Math.round(n / 1e3).toLocaleString("fr-FR") + " k€" : eur(n); }
  function offre() { return typeof NEG_IDX !== "undefined" && NEG_IDX >= 0 ? (G.offers || [])[NEG_IDX] : null; }
  function val(o, c, b) { return o[c] !== null && o[c] !== undefined ? o[c] : o[b] || 0; }

  /* --- Les demandes ---------------------------------------------------- */
  function demandes(o) {
    var cout = val(o, "cCost", "cost"), sal = val(o, "cSalary", "salary"), vic = val(o, "cBonus", "bonusWin"), pod = val(o, "cBonusPodium", "bonusPodium"), dur = val(o, "cDuration", "duration") || 1;
    var role = o.cRole || o.role || "num2", argent = [];
    if (cout > 0) argent.push(["cut_cost_10", "Baquet −10 %", court(cout * 0.9), "p"], ["cut_cost_25", "Baquet −25 %", court(cout * 0.75), "f"], ["cut_cost_50", "Baquet à moitié prix", court(cout * 0.5), "a"]);
    if (sal > 0) argent.push(["up_salary_10", "Salaire +10 %", court(sal * 1.1) + " par mois", "p"], ["up_salary_25", "Salaire +25 %", court(sal * 1.25) + " par mois", "f"], ["up_salary_50", "Salaire +50 %", court(sal * 1.5) + " par mois", "a"]);
    var primes = [["bonus_champ_driver", "Prime de titre", court((o.bonusWin || 1800) * 4) + " si champion", "f"], ["bonus_top3_season", "Prime top 3", court((o.bonusWin || 1800) * 1.5) + " en fin de saison", "p"],
      ["bonus_champ_constructor", "Titre constructeurs", court((o.bonusWin || 1800) * 2.5) + " si l'écurie gagne", "p"], ["bonus_fastest_lap", "Meilleur tour", court((o.bonusPodium || 700) * 0.15) + " à chaque fois", "p"]];
    if (pod > 0) primes.unshift(["up_bonus_podium", "Podium +30 %", court(pod * 1.3), "p"]);
    if (vic > 0) primes.unshift(["up_bonus_win", "Victoire +30 %", court(vic * 1.3), "f"]);
    var contrat = [];
    if (dur < 4) contrat.push(["duration_extend", "Un an de plus", (dur + 1) + " saisons", "p"]);
    if (dur > 1) contrat.push(["duration_shorten", "Un an de moins", (dur - 1) + " saison" + (dur > 2 ? "s" : ""), "f"]);
    if (role !== "num1") contrat.push(["ask_n1", "Statut de n° 1", "L'écurie travaille pour toi", "a"]);
    contrat.push(["clause_no_dump", "Place garantie", "Pas de renvoi en cours de saison", "a"]);
    var autres = _negCountOtherOffers(NEG_IDX), pro = G.agent && G.agent.type !== "parent";
    var pression = [["use_other_offer", "J'ai une autre offre", autres ? autres + " écurie" + (autres > 1 ? "s t'attendent" : " t'attend") : "C'est un bluff", autres ? "p" : "a"]];
    if (cout > 0) pression.push(["bring_sponsor", "J'amène un sponsor", "Il paie une part du baquet", "p"]);
    if (pro) pression.push(["agent_intervene", "Faire parler l'agent", G.agent.name || "Ton agent", "f"]);
    pression.push(["walk_away_bluff", "Menacer de partir", "Tout gagner ou tout perdre", "a"]);
    return { argent: argent, primes: primes, contrat: contrat, pression: pression };
  }
  var ONGLETS = [["argent", "Argent"], ["primes", "Primes"], ["contrat", "Contrat"], ["pression", "Pression"]];

  /* --- Les mains --------------------------------------------------------
     Même main des deux côtés, en miroir : manche, poignet, paume, quatre
     doigts, pouce. Deux calques pour que les doigts s'emboîtent. */
  function main(manche, revers, peau, ombre) {
    var doigts = [[34, 40], [43, 44], [52, 42], [61, 36]].map(function (d) {
      return '<rect x="92" y="' + d[0] + '" width="' + d[1] + '" height="9.5" rx="4.75" fill="' + peau + '" stroke="' + ombre + '" stroke-width="1.2"/>';
    }).join("");
    return { dos: '<path d="M-400 30 H44 Q50 30 50 36 V70 Q50 76 44 76 H-400 Z" style="fill:' + manche + '"/><path d="M-400 62 H50 V70 Q50 76 44 76 H-400 Z" fill="#000" opacity=".22"/>' +
        '<rect x="44" y="27" width="15" height="52" rx="4" fill="' + revers + '"/><path d="M58 34 H76 Q104 30 108 40 V66 Q106 74 92 74 H58 Z" fill="' + peau + '" stroke="' + ombre + '" stroke-width="1.2"/>' + doigts +
        '<path d="M62 37 H101 V71 H62 Z" fill="' + peau + '"/><path d="M66 66 Q84 72 100 64" fill="none" stroke="' + ombre + '" stroke-width="1.4" opacity=".6"/>',
      pouce: '<path d="M70 40 Q80 20 98 17 Q108 16 109 23 Q109 28 101 30 Q96 33 94 46 Z" fill="' + peau + '" stroke="' + ombre + '" stroke-width="1.2"/>' };
  }
  function mains() {
    var moi = main("var(--m1)", "#f4f4f6", "#E8B58E", "#9A6A48"), eux = main("var(--m2)", "#f4f4f6", "#D9A27A", "#8A5C3C");
    var miroir = function (x) { return '<g class="rj164-d"><g transform="translate(400 0) scale(-1 1)">' + x + "</g></g>"; };
    return '<svg class="rj164-mains" viewBox="0 12 400 72" aria-hidden="true"><ellipse class="rj164-lueur" cx="200" cy="54" rx="120" ry="46"/>' +
      '<g class="rj164-poignee">' + miroir(eux.dos) + '<g class="rj164-g">' + moi.dos + "</g>" + miroir(eux.pouce) + '<g class="rj164-g">' + moi.pouce + "</g></g></svg>";
  }
  function progres() {
    if (signature || (NEG_STATE && NEG_STATE.status === "signed")) return 1;
    var n = ((NEG_STATE && NEG_STATE.history) || []).filter(function (h) { return h && h.success; }).length;
    return Math.min(0.9, n / CONCESSIONS);
  }
  function humeur(s) {
    var p = s.initialPatience > 0 ? s.patience / s.initialPatience : s.patience / 100;
    return s.status !== "active" && s.status !== "signed" ? ["Rupture", "#EF4444"] : p > 0.6 ? ["Écurie sereine", "#34D399"] : p > 0.3 ? ["Écurie qui se crispe", "#F59E0B"] : ["Écurie à bout", "#EF4444"];
  }
  function couleurEcurie(nom) {
    if (nom === "Ferrari") return "#C8102E";           // son logo porte d'abord le drapeau italien
    var m = String(typeof getTeamLogo === "function" ? getTeamLogo(nom) || "" : "").match(/#[0-9A-Fa-f]{6}/g) || [];
    return m.filter(function (c) { var n = parseInt(c.slice(1), 16), l = (n >> 16) * 0.3 + (n >> 8 & 255) * 0.59 + (n & 255) * 0.11; return l > 35 && l < 215; })[0] || "#3B4252";
  }

  /* --- L'écran ----------------------------------------------------------- */
  function conditions(o) {
    var cout = val(o, "cCost", "cost"), sal = val(o, "cSalary", "salary"), vic = val(o, "cBonus", "bonusWin"), pod = val(o, "cBonusPodium", "bonusPodium"), dur = val(o, "cDuration", "duration") || 1, role = o.cRole || o.role || "num2";
    var c = [["Baquet", cout ? court(cout) : "Offert", cout < (o.cost || 0)], ["Salaire", sal ? court(sal) + "/mois" : "Aucun", sal > (o.salary || 0)], ["Victoire", court(vic), vic > (o.bonusWin || 0)], ["Podium", court(pod), pod > (o.bonusPodium || 0)],
      ["Durée", dur + " an" + (dur > 1 ? "s" : ""), o.cDuration != null && dur !== o.duration], ["Statut", role === "num1" ? "N° 1" : role === "equal" ? "Égal" : role === "num3" ? "Réserve" : "N° 2", !!o.cRole]];
    var plus = [["cBonusChampDriver", "Prime titre"], ["cBonusTop3Season", "Prime top 3"], ["cBonusChampConstructor", "Constructeurs"], ["cBonusFastestLap", "Meilleur tour"], ["cNoDump", "Place garantie"]].filter(function (x) { return o[x[0]]; });
    return '<div class="rj164-cond">' + c.map(function (x) { return '<span class="' + (x[2] ? "mieux" : "") + '"><em>' + x[0] + "</em><b>" + x[1] + "</b></span>"; }).join("") +
      plus.map(function (x) { return '<span class="mieux"><em>' + x[1] + "</em><b>" + (o[x[0]] === true ? "Oui" : court(o[x[0]])) + "</b></span>"; }).join("") + "</div>";
  }
  function retour(s) {
    if (!s.lastMsg) return '<div class="rj164-dit">Choisis ce que tu demandes. Chaque demande use un peu leur patience.</div>';
    return '<div class="rj164-dit ' + (s.lastSuccess ? "oui" : s.lastSuccess === false ? "non" : "") + '"><b>' + esc(s.lastMsg) + ".</b> " + esc(s.lastDetail || "") + "</div>";
  }
  function boutons(o, s) {
    var D = demandes(o);
    if (!D[onglet].length) onglet = "primes";
    return '<div class="rj164-onglets" role="tablist">' + ONGLETS.map(function (x) {
      return D[x[0]].length ? '<button type="button" role="tab" data-o="' + x[0] + '" aria-selected="' + (x[0] === onglet) + '">' + x[1] + "</button>" : "";
    }).join("") + '</div><div class="rj164-actions">' + D[onglet].map(function (d) {
      var fait = s.usedActions[d[0]], acquis = fait && s.history.some(function (h) { return h.action === d[0] && h.success; });
      return '<button type="button" class="rj164-a ' + d[3] + (fait ? acquis ? " ok" : " ko" : "") + '"' + (fait ? " disabled" : "") + " onclick=\"negDoAction('" + d[0] + "')\"><b>" + d[1] + "</b><span>" + (fait ? acquis ? "Obtenu" : "Déjà demandé" : esc(d[2])) + "</span><i>" + TON[d[3]] + "</i></button>";
    }).join("") + "</div>";
  }
  function fiche(o) {
    var f = document.createElement("div"); f.className = "rj166-voile"; f.setAttribute("data-rj-noround", "1");
    f.innerHTML = '<div class="rj166-carte"><div class="rj166-tete"><b>' + esc(o.team) + '</b><button type="button" class="rj166-x" aria-label="Fermer">×</button></div><div class="rj166-corps">' + _negSummaryHTML(o) + (window.RJProjection ? RJProjection(o.team) : "") + "</div></div>";
    f.addEventListener("click", function (e) { if (e.target === f || e.target.closest(".rj166-x")) f.remove(); });
    document.body.appendChild(f);
  }

  function rendre() {
    var o = offre(), s = NEG_STATE, scr = document.getElementById("S-neg");
    if (!o || !s || !scr) return;
    var t = document.getElementById("neg-team"); if (t) t.textContent = o.team + " — " + o.cat;
    ["neg-summary", "neg-sliders"].forEach(function (id) { var e = document.getElementById(id); if (e) e.style.display = "none"; });
    var bar = document.getElementById("neg-round-bar"), opts = document.getElementById("neg-options"), hum = humeur(s), prog = progres();
    scr.classList.add("rj164");
    if (!bar.querySelector(".rj164-scene")) bar.innerHTML = '<div class="rj164-scene">' + mains() + '<div class="rj164-noms"><span></span><b></b><span></span></div></div>';
    var sc = bar.firstChild, rupture = s.status === "expired" || s.status === "walked_away";
    sc.style.setProperty("--ton", hum[1]);
    sc.style.setProperty("--m1", couleurEcurie(G.currentTeam)); sc.style.setProperty("--m2", couleurEcurie(o.team));
    sc.style.setProperty("--ecart", (rupture ? 60 : prog === 1 ? -86 : Math.round(34 - prog * 92)) + "px");
    sc.classList.toggle("rompu", rupture); sc.classList.toggle("conclu", prog === 1);
    var n = sc.querySelectorAll(".rj164-noms > *");
    n[0].textContent = "Toi"; n[2].textContent = o.team;
    n[1].textContent = prog === 1 ? "Accord conclu" : rupture ? "Négociation rompue" : (prog >= 0.6 ? "Tout proche" : prog >= 0.2 ? "Ça se rapproche" : "Premiers échanges") + " · " + hum[0];
    if (rupture) opts.innerHTML = conditions(o) + retour(s) + '<div class="rj164-pied"><button type="button" class="rj164-quitter" onclick="closeNeg()">Retour aux offres</button></div>';
    else opts.innerHTML = conditions(o) + retour(s) + boutons(o, s) +
      '<div class="rj164-pied"><button type="button" class="rj164-quitter" onclick="closeNeg()">Réfléchir</button><button type="button" class="rj164-fiche">L\'écurie</button><button type="button" class="rj164-signer" onclick="negDoAction(\'sign_now\')">Signer</button></div>';
  }
  function surClic(e) {
    var b = e.target.closest && e.target.closest("#S-neg [data-o], #S-neg .rj164-fiche"); if (!b) return;
    if (b.hasAttribute("data-o")) { onglet = b.getAttribute("data-o"); rendre(); } else if (offre()) fiche(offre());
  }

  /* --- Règles ------------------------------------------------------------ */
  function chance(p, args) { return Math.min(0.95, p + (args[0] && args[0].bonusChance || 0)); }
  function demander(args, suite) {
    var s = args[0], o = args[1], a = args[2], r = suite();
    s.bonusChance = 0;                                   // le levier a servi
    if (!s.lastSuccess && s.status === "active" && CONTRE[a] && !s.usedActions[CONTRE[a]] && Math.random() < CHANCE_CONTRE) {
      var pat = s.patience, vrai = Math.random;
      try { Math.random = function () { return 0; }; s.patience = 100; _negApplyAction(s, o, CONTRE[a]); } finally { Math.random = vrai; s.patience = pat; }
      s.history[s.history.length - 1].patience = pat;
      s.lastDetail = "Ils refusent ta demande, mais font un pas vers toi.";
      s.lastMsg = "Contre-proposition : " + s.lastMsg.charAt(0).toLowerCase() + s.lastMsg.slice(1);
    }
    return r;
  }
  function agir(args, suite) {
    var o = offre(), a = args[0];
    if (!o || !NEG_STATE || NEG_STATE.status !== "active" || signature) return;
    if (a !== "sign_now") { if (NEG_STATE.usedActions[a]) return; return suite(); }
    signature = true; rendre();
    setTimeout(function () {
      signature = false;
      if ((G.offers || []).indexOf(o) < 0) return;
      o.negOk = true;                                    // si la signature échoue (âge, fonds), on peut reprendre
      closeNeg();
      setTimeout(function () { signContract((G.offers || []).indexOf(o)); }, 120);
    }, 1700);
  }
  /* Une écurie qui a quitté la table ne signe plus. */
  function signer(args, suite) {
    var o = (G.offers || [])[args[0]];
    if (!o || !o.expired) return suite();
    G.offers.splice(args[0], 1);
    if (typeof renderOffers === "function") renderOffers();
    if (typeof showFb === "function") showFb("cont-fb", "err", "Offre perdue", o.team + " a quitté la table.");
    return null;
  }

  function boot() {
    if (typeof rjInscrire !== "function" || typeof negDoAction !== "function" || typeof signContract !== "function" || typeof _negComputeAcceptance !== "function") return setTimeout(boot, 120);
    rjInscrire("_negComputeAcceptance", { id: ID + ":levier", ordre: 9000, apres: chance });
    rjInscrire("_negApplyAction", { id: ID + ":contre", ordre: -9000, remplace: demander });
    rjInscrire("negDoAction", { id: ID + ":table", ordre: -9000, remplace: agir });
    rjInscrire("signContract", { id: ID + ":perdue", ordre: -9900, remplace: signer });
    document.addEventListener("click", surClic);
    window.RJTable = { rendre: rendre, demandes: demandes, progres: progres };
    window._rj164Uninstall = function () {
      ["_negComputeAcceptance", "_negApplyAction", "negDoAction", "signContract"].forEach(function (n) { rjDesinscrire([ID], n); });
      document.removeEventListener("click", surClic); delete window.RJTable;
    };
    console.log("[164-table] actif — négociation sur une page");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
