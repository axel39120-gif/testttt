/* =====================================================================
 * 165-contrat-tenu.js — CE QUI EST SIGNÉ EST PAYÉ
 *
 * POURQUOI (audit v306)
 * Le salaire signé était effacé au changement de saison (revenus remis à la
 * somme des sponsors), les primes de victoire et de podium n'étaient jamais
 * versées, et la durée, le statut et la prime de podium négociés étaient
 * oubliés à la signature.
 *
 * CE QUE FAIT LE MODULE
 * À la signature, les conditions négociées deviennent celles de l'offre et
 * sont notées (G._contratFutur) ; elles prennent effet à la saison suivante
 * (G._contrat) : salaire dans les revenus, primes après chaque course.
 * Les contrats signés avant la v306 ne sont pas repris.
 * Réversible : window._rj165Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var ID = "165-contrat";
  function val(o, c, b) { return o[c] !== null && o[c] !== undefined ? o[c] : o[b]; }

  function signer(args, suite) {
    var o = (G.offers || [])[args[0]];
    if (!o) return suite();
    var avant = G.pendingTransfer, duree = G.contractDur, sauve = { duration: o.duration, role: o.role, bonusPodium: o.bonusPodium };
    var prolonge = o.team === G.currentTeam && o.cat === G.cat;
    o.duration = val(o, "cDuration", "duration") || o.dur || 1;
    o.role = o.cRole || o.role;
    o.bonusPodium = val(o, "cBonusPodium", "bonusPodium") || 0;
    var r = suite();
    var signe = prolonge ? G.contractDur !== duree : G.pendingTransfer && G.pendingTransfer !== avant && G.pendingTransfer.team === o.team;
    if (signe) G._contratFutur = { team: o.team, cat: o.cat, salaire: val(o, "cSalary", "salary") || 0, victoire: val(o, "cBonus", "bonusWin") || 0, podium: o.bonusPodium, role: o.role || "num2" };
    else Object.assign(o, sauve);
    return r;
  }

  function nouvelleSaison() {
    var f = G._contratFutur, ici = function (c) { return c && c.team === G.currentTeam && c.cat === G.cat; };
    if (ici(f)) { G._contrat = f; G._playerRole = f.role; }
    G._contratFutur = null;
    if (!ici(G._contrat)) { G._contrat = null; return; }
    G.revenue = (G.sponsors || []).reduce(function (t, s) { return t + (s.fee || 0); }, 0) + G._contrat.salaire;
  }

  function apresCourse() {
    var c = G._contrat, n = (G.races || []).length, x = n && G.races[n - 1], cle = G.saison + "#" + n;
    if (!c || !x || c.paye === cle || c.team !== G.currentTeam || c.cat !== G.cat) return;
    c.paye = cle;
    var m = x.pos === 1 ? c.victoire : x.pos === 2 || x.pos === 3 ? c.podium : 0;
    if (!m) return;
    G.budget += m;
    if (typeof pushHomeToast === "function") pushHomeToast(x.pos === 1 ? "Prime de victoire" : "Prime de podium", "+" + m.toLocaleString("fr-FR") + " € versés par " + c.team + ".", "#34D399");
  }

  function boot() {
    if (typeof rjInscrire !== "function" || typeof signContract !== "function" || !Array.isArray(window.RJ_SEASON_HOOKS) || !Array.isArray(window.RACE_POST_HOOKS) || !Array.isArray(window.RJ_SAVE_HOOKS)) return setTimeout(boot, 120);
    rjInscrire("signContract", { id: ID, ordre: -9000, remplace: signer });
    window.RJ_SEASON_HOOKS.push({ id: ID, apres: nouvelleSaison });
    window.RACE_POST_HOOKS.push({ id: ID, run: apresCourse });
    window.RJ_SAVE_HOOKS.push({ cle: "rj165", ecrire: function (g) { return { c: g._contrat || null, f: g._contratFutur || null }; }, lire: function (b, g) { g._contrat = b && b.c || null; g._contratFutur = b && b.f || null; } });
    window._rj165Uninstall = function () {
      rjDesinscrire([ID], "signContract");
      ["RJ_SEASON_HOOKS", "RACE_POST_HOOKS"].forEach(function (k) { window[k] = window[k].filter(function (h) { return !h || h.id !== ID; }); });
    };
    console.log("[165-contrat] actif — salaire et primes versés");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
