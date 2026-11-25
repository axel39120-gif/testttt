/* =====================================================================
 * 173-parcours-academies.js — L'ACADÉMIE : UN PARCOURS ET UN PATRON
 *
 * CE QUE FAIT LE MODULE
 *   - PARCOURS : chaque passage en académie (années, logo) se lit dans
 *     l'onglet Carrière, et se sauvegarde. Les parties existantes le
 *     retrouvent dans le journal des décisions.
 *   - FIN DE PROGRAMME : arrivé en F1, le pilote quitte l'académie, diplômé,
 *     sans pénalité.
 *   - PATRON : le directeur de ton académie est un contact (Messages ›
 *     Contacts). On peut lui demander un baquet dans une écurie partenaire
 *     de la catégorie supérieure : la réponse dépend de la relation, de ta
 *     place et de ton passé, et un mauvais moment se paie.
 *   - HAAS → ASTON MARTIN : une partie commencée chez Haas continue chez
 *     Aston Martin.
 *
 * Persistance : bloc « rj173 ». Réversible : window._rj173Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[173-academies]", ID = "173-academies";
  var ANCIENS = { HDA: "AMDA" }, NOMS_ANCIENS = { "Haas Driver Academy": "Aston Martin Driver Academy" };
  var PATRONS = { FDA: "Renzo Galvani", RBJT: "Klaus Steinmann", MJP: "Martin Hofer", AA: "Étienne Carlier", MDD: "Stuart Ellery",
    AMDA: "Graham Whitcombe", AUDI: "Jonas Reinhardt", WRA: "Peter Langford" };
  var ATTENTE = 10;                          // semaines entre deux négociations de baquet

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function annee(saison) { return (G.gameYear || 2024) - ((G.saison || 1) - (saison || G.saison || 1)); }
  function semAbs() { return (G.saison || 1) * 48 + (G.semaine || 1); }
  function L() { return G._academies || (G._academies = []); }
  function ouvert() { return L().filter(function (x) { return x.fin == null; })[0] || null; }
  function acad() { return PLAYER_ACADEMY.id ? getPlayerAcademy() : null; }
  function place() {
    var t = [{ p: G.champPts || 0, m: 1 }].concat((G.rivals || []).map(function (x) { return { p: x.pts || 0 }; }));
    return t.sort(function (a, b) { return b.p - a.p; }).findIndex(function (x) { return x.m; }) + 1;
  }

  /* --- Parcours ------------------------------------------------------------- */
  function entrer(nom) {
    var a = ACADEMIES[nom]; if (!a) return;
    sortir();
    L().push({ id: a.id, nom: nom, debut: annee(), fin: null });
  }
  function sortir(diplome) {
    var o = ouvert(); if (!o) return;
    o.fin = annee(); if (diplome) o.diplome = true;
  }
  /* Partie d'avant la v316 : le journal des décisions garde les entrées et les sorties. */
  function reconstituer() {
    if (G._academies) return;
    G._academies = [];
    (G.decisions || []).slice().reverse().forEach(function (d) {
      if (!d || d.category !== "academy") return;
      var m = String(d.title || "").match(/^(Rejoint|Départ de) (.+)$/); if (!m) return;
      var nom = NOMS_ANCIENS[m[2]] || m[2], a = ACADEMIES[nom]; if (!a) return;
      var an = d.gameYear || annee(d.saison);
      if (m[1] === "Rejoint") { var o = ouvert(); if (o) o.fin = an; G._academies.push({ id: a.id, nom: nom, debut: an, fin: null }); }
      else { var p = ouvert(); if (p && p.id === a.id) p.fin = an; }
    });
    var actuel = PLAYER_ACADEMY.id && getAcademy(PLAYER_ACADEMY.id), o = ouvert();
    if (!actuel && o) o.fin = annee();
    if (actuel && (!o || o.id !== PLAYER_ACADEMY.id)) { if (o) o.fin = annee(); G._academies.push({ id: PLAYER_ACADEMY.id, nom: actuel, debut: annee(), fin: null }); }
  }
  function migrer() {
    if (ANCIENS[PLAYER_ACADEMY.id]) PLAYER_ACADEMY.id = ANCIENS[PLAYER_ACADEMY.id];
    var e = PLAYER_ACADEMY._rj138;
    if (e && Array.isArray(e.approches)) e.approches = e.approches.map(function (n) { return NOMS_ANCIENS[n] || n; });
    if (e && e.approche && NOMS_ANCIENS[e.approche.id]) e.approche.id = NOMS_ANCIENS[e.approche.id];
  }
  /* Arrivé en F1 : le programme a rempli son rôle. */
  function diplomer() {
    if (!window.G || G.cat !== "Formule 1" || !PLAYER_ACADEMY.id) return false;
    var nom = getAcademy(PLAYER_ACADEMY.id);
    sortir(true);
    PLAYER_ACADEMY.id = null; PLAYER_ACADEMY.relation = 0; PLAYER_ACADEMY.canLeave = false; PLAYER_ACADEMY.f1Offer = false; PLAYER_ACADEMY._pendingF1Offer = false;
    try { recordDecision("academy", "Diplômé de " + nom, "Arrivée en Formule 1 : le programme est terminé", "positive", [nom]); } catch (e) {}
    if (typeof pushMail === "function") pushMail({ from: nom, role: "academy", subject: "Mission accomplie",
      body: "Te voilà en Formule 1. C'est pour ce jour que le programme existe : ton passage chez nous s'achève ici, avec toute notre fierté. La porte reste ouverte, en ami." });
    return true;
  }

  function carte() {
    var h = document.getElementById("career-detail-content");
    if (!h) return;
    var b = document.getElementById("rj173"); if (b) b.remove();
    reconstituer();
    if (!L().length) return;
    b = document.createElement("div"); b.id = "rj173";
    b.innerHTML = '<div class="t-sec">Académies</div><div class="rj173-l">' + L().map(function (x) {
      var a = ACADEMIES[x.nom];
      return '<div class="rj173-a"><em>' + x.debut + " – " + (x.fin == null ? "aujourd'hui" : x.fin) + "</em>" + (a ? acadLogoHtml(a, 26) : "") + "<b>" + esc(x.nom) + "</b>" + (x.diplome ? "<i>Diplômé en F1</i>" : "") + "</div>";
    }).join("") + "</div>";
    h.insertBefore(b, h.firstChild);
  }

  /* --- Le patron ------------------------------------------------------------ */
  function etat() { var e = PLAYER_ACADEMY._rj138 = PLAYER_ACADEMY._rj138 || {}; return e; }
  function rel() { return PLAYER_ACADEMY.relation || 0; }
  function catSuivante() {
    var a = acad(); if (!a) return null;
    return (getCatNextOptions(G.cat) || []).filter(function (c) { return c !== "Formule 1" && a.affiliates[c] && a.affiliates[c].length; })[0] || null;
  }
  function peutNegocier() {
    var c = catSuivante();
    if (!c || G.pendingTransfer || (G.races || []).length < 3) return false;
    if ((G.offers || []).some(function (o) { return o && o.cat === c && isAcademyAffiliate(o.team, c); })) return false;
    return semAbs() - (etat().baquetSem || -99) >= ATTENTE;
  }
  /* Entre 4 et 45 % : une relation solide ET des résultats, sinon c'est non. */
  function chance() {
    var p = place(), x = .04 + Math.max(0, rel() - 40) * .0045 + (p === 1 ? .16 : p <= 3 ? .1 : p <= 5 ? .04 : p <= 8 ? 0 : -.1);
    if (etat().avertissement === G.saison - 1 || etat().avertissement === G.saison) x -= .1;
    return Math.max(.04, Math.min(.45, x));
  }
  function ouvrirBaquet() {
    var a = acad(), cat = catSuivante(); if (!a || !cat) return "Aucune place";
    var equipes = a.affiliates[cat], r = (TEAM_OFFERS[cat] || []).filter(function (t) { return equipes.indexOf(t.team) >= 0; })
      .sort(function (x, y) { return (x.repReq || 0) - (y.repReq || 0); })[0];       // la plus accessible des partenaires
    if (!r) return "Aucune place";
    var o = buildOffer({ team: r.team, cat: cat, cost: r.cost || 0, salary: r.salary || 0, bonusWin: r.bonusWin || 0, bonusPodium: r.bonusPodium || 0,
      duration: 1, extra: "Négocié par l'académie", expire: 20, role: "num2" });
    if (!o) return "Aucune place";
    o._academie = true;
    if (window.RJBaquets && RJBaquets.prix) RJBaquets.prix(o);
    (G.offers = G.offers || []).push(o);
    return "Offre de " + r.team + " en " + cat;
  }
  function bouge(d, raison) { return { type: "custom", fn: function () { changeAcademyRelation(d, raison); return (d > 0 ? "+" : "−") + Math.abs(d) + " relation académie"; } }; }

  var SUJETS = [
    { id: "ac_baquet", label: "Négocier un baquet partenaire", playerMsg: "J'aimerais monter la saison prochaine. Pouvez-vous me trouver une place chez une écurie partenaire ?",
      available: function () { return peutNegocier(); },
      outcomes: function () {
        etat().baquetSem = semAbs();
        var c = Math.round(100 * chance()), froid = rel() < 40, cat = catSuivante();
        return [
          { weight: c, label: "Accord", npcResponse: "J'ai passé trois coups de fil. Il y a une place en " + cat + ", pour une saison. Ne me fais pas regretter.", effects: [{ type: "custom", fn: ouvrirBaquet }, bouge(-4, "Faveur : baquet négocié")] },
          { weight: Math.round((100 - c) * (froid ? .5 : .8)), label: "Pas maintenant", npcResponse: "Les places sont prises, et d'autres poussent derrière toi. Montre-moi encore quelques courses et on en reparle.", effects: [bouge(-2, "Demande de baquet refusée")] },
          { weight: Math.round((100 - c) * (froid ? .5 : .2)), label: "Mal pris", npcResponse: "Tu demandes avant d'avoir donné. Ici, on gagne sa place en piste, pas au téléphone.", effects: [bouge(-7, "Demande de baquet mal reçue"), { type: "mental", value: -1 }] }
        ];
      } },
    { id: "ac_bilan", label: "Où en suis-je dans le programme ?", playerMsg: "Je voudrais savoir ce que vous pensez de ma saison.",
      npcResponse: function () {
        var p = place(), x = (window.RJCaracteres && RJCaracteres.academie(PLAYER_ACADEMY.id)) || { place: 12, relation: 20 };
        return p <= 3 ? "P" + p + " : c'est ce qu'on attend d'un de nos pilotes. Garde ce niveau." : p <= x.place ? "P" + p + " : correct. Pour que je me batte pour toi, il me faut un podium au championnat." : "P" + p + " : en dessous de nos attentes (top " + x.place + "). La revue de fin de saison sera dure si ça continue.";
      }, effects: [] },
    { id: "ac_simu", label: "Demander du temps de simulateur", playerMsg: "Est-ce que je peux venir rouler au simulateur de l'usine ?", available: function () { return rel() >= 30; },
      outcomes: function () { return [
        { weight: Math.max(10, rel()), label: "Accordé", npcResponse: "Deux jours, mercredi et jeudi. Apporte tes notes.", effects: [{ type: "stat", key: "vitesse_pure", value: .4, label: "vitesse" }, { type: "stat", key: "concentration", value: .4, label: "concentration" }, bouge(1, "Simulateur")] },
        { weight: 45, label: "Complet", npcResponse: "Les titulaires l'occupent jusqu'à la fin du mois. Une autre fois.", effects: [] } ]; } },
    { id: "ac_aide", label: "Demander une aide financière", playerMsg: "Le budget est serré cette saison. L'académie peut-elle m'aider ?", available: function () { return rel() >= 45 && etat().aideSaison !== G.saison && G.cat !== "Formule 1"; },
      outcomes: function () { etat().aideSaison = G.saison; var m = Math.round((6000 + rel() * 250) / 1000) * 1000; return [
        { weight: Math.max(10, rel() - 30), label: "Accordée", npcResponse: "On prend une partie en charge. C'est un investissement, pas un cadeau.", effects: [{ type: "money", value: m }, bouge(-3, "Aide financière")] },
        { weight: 55, label: "Refusée", npcResponse: "Le budget des juniors est déjà bouclé. Cherche un sponsor.", effects: [bouge(-1, "Aide refusée")] } ]; } },
    { id: "ac_f1", label: "Parler du plan F1", playerMsg: "Est-ce que vous me voyez en Formule 1 ?", available: function () { return /Formule [23]|Super Formula/.test(G.cat); },
      npcResponse: function () { return PLAYER_ACADEMY.f1Offer ? "Tu es dans le plan. En " + G.cat + ", un podium au championnat et la Super Licence, et je pose ton dossier sur la table." : rel() >= 60 ? "Tu n'en es pas loin. Encore une saison solide et je défends ton nom." : "Pas encore. Je dois d'abord être sûr de toi, en piste comme en dehors."; }, effects: [] },
    { id: "ac_merci", label: "Donner des nouvelles", playerMsg: "Je voulais juste vous tenir au courant et vous remercier.", npcResponse: "Ça fait plaisir, peu de pilotes y pensent. Continue à travailler.", effects: [{ type: "custom", fn: function () { changeAcademyRelation(1, "Des nouvelles"); return "+1 relation académie"; } }] },
    { id: "ac_excuse", label: "S'expliquer après une mauvaise série", playerMsg: "Mes dernières courses ne sont pas au niveau. Je tenais à vous le dire moi-même.", available: function () { var r = (G.races || []).slice(-2); return r.length === 2 && r.every(function (x) { return (x.pos || 99) > 8; }); },
      outcomes: function () { return [
        { weight: 6, label: "Apprécié", npcResponse: "J'apprécie que tu viennes le dire. Maintenant, corrige.", effects: [bouge(3, "Franchise")] },
        { weight: 4, label: "Froid", npcResponse: "Les excuses ne marquent pas de points.", effects: [bouge(-1, "Excuses froidement reçues")] } ]; } }
  ];
  function inscrirePatron() {
    if (CONTACTS_CATALOG.some(function (c) { return c.id === "academy_boss"; })) return;
    CONTACTS_CATALOG.push({ id: "academy_boss",
      isAvailable: function () { return !!acad() && G.cat !== "Formule 1"; },
      getName: function () { return PATRONS[PLAYER_ACADEMY.id] || "Directeur de l'académie"; },
      getRole: function () { return "academy"; },
      getColor: function () { var a = acad(); return (a && a.color) || "#A78BFA"; },
      getIcon: function () { return "diplome"; },
      getDescription: function () { return "Directeur · " + (getAcademy(PLAYER_ACADEMY.id) || "Académie") + " · relation " + rel() + "/100"; },
      topics: SUJETS });
  }

  function boot() {
    if (typeof rjInscrire !== "function" || typeof joinAcademy !== "function" || typeof CONTACTS_CATALOG === "undefined" || !Array.isArray(window.WEEKLY_TICK_HOOKS) || !Array.isArray(window.RJ_SAVE_HOOKS) || !window.RJAcademie) return setTimeout(boot, 120);
    ["joinAcademy", "leaveAcademy"].forEach(function (f) {
      var orig = window[f];
      window[f] = function (x) {
        reconstituer();
        if (f === "leaveAcademy") { sortir(); return orig.apply(this, arguments); }
        var r = orig.apply(this, arguments); if (r) entrer(x); return r;
      };
    });
    inscrirePatron();
    window.WEEKLY_TICK_HOOKS.push({ id: ID, run: function () { try { diplomer(); } catch (e) { console.warn(TAG, e && e.message); } } });
    if (typeof window.startNextSeason === "function") rjInscrire("startNextSeason", { id: ID + ":saison", apres: function () { try { diplomer(); } catch (e) {} } });
    rjInscrire("renderCareerDetail", { id: ID + ":carte", ordre: -9000, apres: function () { try { carte(); } catch (e) { console.warn(TAG, e && e.message); } } });
    window.RJ_SAVE_HOOKS.push({ cle: "rj173", ecrire: function (g) { return g._academies || null; }, lire: function (b, g) {
      g._academies = Array.isArray(b) ? b : null; setTimeout(function () { try { migrer(); reconstituer(); diplomer(); } catch (e) { console.warn(TAG, e && e.message); } }, 60); migrer(); } });
    migrer();
    window.RJParcours = { liste: function () { reconstituer(); return L(); }, chance: chance, diplomer: diplomer, peutNegocier: peutNegocier, ouvrirBaquet: ouvrirBaquet, carte: carte, patrons: PATRONS, migrer: migrer };
    console.log(TAG, "actif");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
