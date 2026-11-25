/* =====================================================================
 * 176-debauchage.js — CHANGER D'ACADÉMIE, RAREMENT
 *
 * RÈGLES (retour du joueur, v317)
 *   - Courir dans une écurie qui n'est pas partenaire de ton académie baisse un
 *     peu la relation, sans jamais ouvrir la porte d'une autre académie.
 *   - On ne change d'académie que si une autre vient te chercher : elle écrit,
 *     avec un baquet dans la catégorie supérieure, à condition de la rejoindre
 *     l'année suivante. Répondre oui fait partir l'offre de l'écurie ; la signer
 *     t'engage : la saison suivante commence dans cette écurie ET dans cette
 *     académie. Sans signature, rien ne change.
 *   - C'est rare : deux saisons au moins dans ton académie, le top 3 du
 *     championnat, la seconde moitié de saison, une petite chance par semaine,
 *     une fois toutes les trois saisons et deux fois dans une carrière.
 *
 * État : G._debauche { nb, derniere, projet: { acad, team, cat, saison, etat } }.
 * Persistance : bloc « rj176 ». Réversible : window._rj176Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[176-debauchage]", ID = "176-debauchage";
  var CHANCE = .012, ANCIENNETE = 2, REPOS = 3, CARRIERE = 2, DELAI = 5, MALUS = 5;

  function E() { return G._debauche || (G._debauche = { nb: 0, derniere: -99, projet: null }); }
  function semAbs() { return (G.saison || 1) * 48 + (G.semaine || 1); }
  function nomActuel() { return PLAYER_ACADEMY.id ? getAcademy(PLAYER_ACADEMY.id) : null; }
  function place() {
    var t = [{ p: G.champPts || 0, m: 1 }].concat((G.rivals || []).map(function (x) { return { p: x.pts || 0 }; }));
    return t.sort(function (a, b) { return b.p - a.p; }).findIndex(function (x) { return x.m; }) + 1;
  }
  function anciennete() {
    var L = window.RJParcours ? RJParcours.liste() : [], o = L.filter(function (x) { return x.fin == null; })[0];
    return o ? (G.gameYear || 2024) - o.debut : 0;
  }
  function catSuivante() { return (getCatNextOptions(G.cat) || []).filter(function (c) { return c !== "Formule 1" && !(typeof isAltPath === "function" && isAltPath(c)); })[0] || null; }

  /* Les académies qui pourraient te vouloir : une place partenaire au-dessus, ton niveau, pas de passé fâché. */
  function candidates() {
    var cat = catSuivante(), moi = PLAYER_ACADEMY.id, note = (typeof calcPlayerRating === "function" && calcPlayerRating()) || 50;
    if (!cat) return [];
    return Object.keys(ACADEMIES).filter(function (n) {
      var a = ACADEMIES[n], mem = typeof getEntityMemory === "function" ? getEntityMemory(n) : null;
      return a.id !== moi && !(mem && mem.status === "broken") && note >= a.minRating && ecurie(n, cat);
    });
  }
  /* Une écurie partenaire de cette académie, mais pas de la tienne. */
  function ecurie(nom, cat) {
    var L = (ACADEMIES[nom].affiliates[cat] || []).filter(function (t) {
      return !isAcademyAffiliate(t, cat) && (TEAM_OFFERS[cat] || []).some(function (o) { return o.team === t; }) && !(G.offers || []).some(function (o) { return o && o.team === t && o.cat === cat; });
    });
    return L.length ? (TEAM_OFFERS[cat] || []).filter(function (o) { return L.indexOf(o.team) >= 0; })[0] : null;
  }
  function possible() {
    if (!PLAYER_ACADEMY.id || G.cat === "Formule 1" || G.pendingTransfer || E().projet || G.seasonOver) return false;
    if (E().nb >= CARRIERE || (G.saison || 1) - E().derniere < REPOS || anciennete() < ANCIENNETE) return false;
    var part = (G.races || []).length / ((window.CAL_RACES || []).length || 10);
    return part >= .5 && part < .95 && place() <= 3 && candidates().length > 0;
  }

  function approcher(force) {
    if (!possible() || (!force && Math.random() >= CHANCE)) return null;
    var L = candidates(), n = L[Math.floor(Math.random() * L.length)], cat = catSuivante(), t = ecurie(n, cat), e = E();
    e.nb++; e.derniere = G.saison || 1;
    e.projet = { acad: n, team: t.team, cat: cat, saison: G.saison, etat: "approche", sem: semAbs() };
    var avant = getMailbox()[0];
    pushMail({ from: n, role: "academy", subject: "Un baquet en " + cat + " pour toi",
      body: "Nous te suivons depuis longtemps, et nous avons une place : <strong>" + t.team + "</strong>, en <strong>" + cat + "</strong>, la saison prochaine. Une condition : tu quittes " + nomActuel() + " et tu nous rejoins en même temps que l'écurie.\n\nRéfléchis bien, ce genre de proposition ne revient pas. Si tu dis oui, l'écurie t'envoie son offre ; rien n'est fait tant que tu n'as pas signé.",
      actions: [{ label: "Oui, je veux cette place", kind: "accept", rj176: "oui", responseBody: "Je suis partant. Envoyez-moi l'offre de l'écurie." },
        { label: "Non, je reste fidèle à mon académie", kind: "refuse", rj176: "non", responseBody: "Merci, mais je reste où l'on m'a fait confiance." }] });
    var m = getMailbox()[0];
    if (!m || m === avant) { e.projet = null; e.nb--; e.derniere = -99; return null; }
    m.rj176 = true; m.rj124Garde = true;
    return n;
  }
  function repondre(quoi) {
    var p = E().projet; if (!p || p.etat !== "approche") return;
    if (quoi === "non") { E().projet = null; changeAcademyRelation(5, "Fidèle malgré l'offre de " + p.acad); return; }
    var r = (TEAM_OFFERS[p.cat] || []).filter(function (t) { return t.team === p.team; })[0];
    var o = r && buildOffer({ team: r.team, cat: p.cat, cost: Math.round((r.cost || 0) * .6), salary: r.salary || 0, bonusWin: r.bonusWin || 0, bonusPodium: r.bonusPodium || 0,
      duration: 2, extra: "Rejoindre aussi : " + p.acad, expire: 20, role: place() === 1 ? "equal" : "num2" });
    if (!o) { E().projet = null; return; }
    o._debauche = p.acad; o._rj62Notified = true;                        // l'écurie l'annonce elle-même
    (G.offers = G.offers || []).push(o);
    p.etat = "offre";
    changeAcademyRelation(-4, "Discussions avec " + p.acad);
    pushMail({ from: "Direction sportive — " + p.team, role: "team_boss", subject: "Notre offre pour " + p.cat,
      body: p.acad + " nous a parlé de toi. Voici notre offre pour la saison prochaine, en <strong>" + p.cat + "</strong>. En la signant, tu rejoins l'écurie et l'académie dès le début de la saison.",
      actions: [{ label: "Voir l'offre", kind: "link", effect: { type: "nav", data: { target: "S-contracts", tab: "offres" } }, responseBody: "Merci, je regarde tout de suite." }, { label: "Je prends le temps", kind: "dismiss", responseBody: "Merci, je vous réponds vite." }] });
  }
  /* L'offre signée engage ; refusée ou expirée, le projet tombe. */
  function suivre() {
    var p = E().projet; if (!p) return;
    if (p.etat === "approche" && semAbs() - p.sem > DELAI) { E().projet = null; return; }
    if (p.etat === "offre") {
      if (G.pendingTransfer && G.pendingTransfer.team === p.team && G.pendingTransfer.cat === p.cat) engager(p);
      else if (G.pendingTransfer || !(G.offers || []).some(function (o) { return o && o._debauche === p.acad; })) E().projet = null;
    } else if (p.etat === "signe" && !(G.pendingTransfer && G.pendingTransfer.team === p.team && G.pendingTransfer.cat === p.cat) && G.saison === p.saison) E().projet = null;
  }
  function engager(p) {
    p.etat = "signe";
    if (typeof pushMail === "function") pushMail({ from: nomActuel(), role: "academy", subject: "Nous avons appris la nouvelle",
      body: "Tu pars chez " + p.acad + " à la fin de la saison. Nous en prenons acte. Termine ton programme avec nous comme un professionnel." });
    try { recordDecision("academy", "S'engage avec " + p.acad, p.team + " en " + p.cat + " dès la saison prochaine", "mixed", [p.acad]); } catch (e) {}
  }
  function nouvelleSaison() {
    var p = E().projet; E().projet = null;                               // l'offre peut aussi se signer au mercato : c'est l'écurie rejointe qui fait foi
    if (PLAYER_ACADEMY.id && G.cat === "Formule 1") return;               // diplômé (173)
    if (p && p.etat !== "approche" && PLAYER_ACADEMY.id && G.currentTeam === p.team && G.cat === p.cat && ACADEMIES[p.acad]) {
      leaveAcademy("Débauché par " + p.acad);
      joinAcademy(p.acad);
      if (typeof pushHomeToast === "function") pushHomeToast("Nouvelle académie", p.acad + " et " + p.team, ACADEMIES[p.acad].color);
      return;
    }
    if (PLAYER_ACADEMY.id && G.currentTeam && G.currentTeam !== "Indépendant" && !isAcademyAffiliate(G.currentTeam, G.cat))
      changeAcademyRelation(-MALUS, G.currentTeam + " n'est pas une écurie partenaire");
  }

  function boot() {
    if (typeof rjInscrire !== "function" || typeof signContract !== "function" || !window.RJParcours || !Array.isArray(window.WEEKLY_TICK_HOOKS) || !Array.isArray(window.RJ_SEASON_HOOKS) || !Array.isArray(window.RJ_SAVE_HOOKS)) return setTimeout(boot, 130);
    var sur = function (f) { return function () { try { f(); } catch (e) { console.warn(TAG, e && e.message); } }; };
    window.WEEKLY_TICK_HOOKS.push({ id: ID, run: sur(function () { suivre(); approcher(); }) });
    window.RJ_SEASON_HOOKS.push({ id: ID, avant: sur(suivre), apres: sur(nouvelleSaison) });
    rjInscrire("signContract", { id: ID, ordre: -9800, apres: sur(suivre) });
    rjInscrire("handleMailAction", { id: ID, apres: function (res, args) {
      var m = getMailbox().filter(function (x) { return x.id === args[0]; })[0], a = m && m.rj176 && m.actions && m.actions[args[1]];
      if (!a || !a.rj176 || m.rj176Fait) return;
      m.rj176Fait = true; sur(function () { repondre(a.rj176); })();
    } });
    window.RJ_SAVE_HOOKS.push({ cle: "rj176", ecrire: function (g) { return g._debauche || null; }, lire: function (b, g) { g._debauche = b || null; } });
    window.RJDebauchage = { etat: E, possible: possible, approcher: approcher, repondre: repondre, suivre: suivre, nouvelleSaison: nouvelleSaison, candidates: candidates, CHANCE: CHANCE };
    window._rj176Uninstall = function () {
      ["WEEKLY_TICK_HOOKS", "RJ_SEASON_HOOKS"].forEach(function (k) { window[k] = window[k].filter(function (h) { return !h || h.id !== ID; }); });
      window.RJ_SAVE_HOOKS = window.RJ_SAVE_HOOKS.filter(function (h) { return !h || h.cle !== "rj176"; });
      rjDesinscrire([ID], "signContract"); rjDesinscrire([ID], "handleMailAction"); delete window.RJDebauchage;
    };
    console.log(TAG, "actif");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
