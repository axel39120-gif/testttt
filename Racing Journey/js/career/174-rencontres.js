/* =====================================================================
 * 174-rencontres.js — RENCONTRER, SÉDUIRE, TENIR UN COUPLE
 *
 * POURQUOI
 * Une relation naissait d'un message (125) et n'était ensuite qu'une jauge.
 *
 * CE QUE FAIT LE MODULE (à partir de 18 ans, entre adultes fictifs)
 *   - RENCONTRES : chaque mois, des personnes croisent ta route (mannequin,
 *     influenceur, actrice, chanteur, sportive, inconnu…). Plus ton nom est
 *     connu, plus elles le sont. Tu choisis qui tu veux rencontrer.
 *   - SÉDUCTION : message, café, dîner, invitation au paddock, week-end,
 *     cadeau. Chacun a un caractère et ses goûts : le même geste ne plaît pas
 *     à tous. Deux attentions par semaine au plus, en points d'action et en
 *     argent. Une complicité suffisante permet de demander à être ensemble.
 *   - COUPLE : des gestes à entretenir et des situations à trancher (sa
 *     carrière, la presse, la jalousie, une tentation). 127 garde les grandes
 *     étapes : vie commune, fiançailles, mariage, enfants.
 *   - PRESSE : plus la personne est connue, plus la presse people s'en mêle.
 *
 * Persistance : bloc « rj174 ». Réversible : window._rj174Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[174-rencontres]", ID = "174-rencontres";
  function hasard(t) { return t[Math.floor(Math.random() * t.length)]; }
  function entre(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function borne(v) { return Math.max(0, Math.min(100, Math.round(v))); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function euros(n) { return Math.round(n).toLocaleString("fr-FR") + " €"; }
  function semAbs() { return (G.saison || 1) * 48 + (G.semaine || 1); }
  function R() { return getRelations(); }
  function partenaire() { return R().partner || null; }
  function E() { var e = G._rj174 = G._rj174 || { pref: "tous", liste: [], maj: -99 }; return e; }
  function majeur() { return (G.age || 0) >= 18; }
  function presse(t) { try { if (window._rj127) _rj127.rumeur(t); } catch (e) {} }
  function moi() { return ((G.pilot && ((G.pilot.prenom || "") + " " + (G.pilot.nom || ""))) || "Le pilote").trim(); }

  /* --- Qui l'on croise ------------------------------------------------------- */
  var F = ["Camille", "Inès", "Jade", "Louna", "Manon", "Alma", "Chiara", "Elena", "Sofia", "Nora", "Freya", "Lucia", "Mila", "Hana", "Amara", "Léonie", "Paola", "Yasmine"];
  var H = ["Adrien", "Nils", "Matteo", "Rayan", "Théo", "Lucas", "Diego", "Elias", "Noah", "Kenji", "Samuel", "Loris", "Ivan", "Milo", "Andrés", "Malik"];
  var NOMS = ["Delcourt", "Ferrand", "Okafor", "Bianchi-Roux", "Lindqvist", "Marchal", "Moretti", "Salazar", "Keller", "Nakagawa", "Duval", "Haddad", "Costa", "Novak", "Lemaire", "Aubry", "Santoro", "Bergström"];
  /* [féminin, masculin, notoriété 0-2] */
  var METIERS = [
    ["Mannequin", "Mannequin", 2], ["Actrice", "Acteur", 2], ["Chanteuse", "Chanteur", 2], ["Influenceuse", "Influenceur", 1], ["Animatrice télé", "Animateur télé", 1], ["Joueuse de tennis", "Joueur de tennis", 1],
    ["DJ", "DJ", 1], ["Styliste", "Styliste", 1], ["Photographe", "Photographe", 0], ["Infirmière", "Infirmier", 0], ["Architecte", "Architecte", 0], ["Professeure", "Professeur", 0], ["Vétérinaire", "Vétérinaire", 0],
    ["Étudiante en droit", "Étudiant en droit", 0], ["Cheffe de cuisine", "Chef de cuisine", 0], ["Ingénieure", "Ingénieur", 0]
  ];
  var CARACTERES = {
    romantique:   { f: "Romantique", h: "Romantique", aime: ["diner", "weekend", "cadeau"], fuit: ["paddock"], dit: "aime les attentions et le temps à deux" },
    aventure:     { f: "Aventurière", h: "Aventurier", aime: ["weekend", "paddock"], fuit: ["cadeau"], dit: "s'ennuie vite, adore les imprévus" },
    discret:      { f: "Discrète", h: "Discret", aime: ["cafe", "message"], fuit: ["paddock", "public"], dit: "fuit les caméras et les grands soirs" },
    mondain:      { f: "Mondaine", h: "Mondain", aime: ["paddock", "public", "cadeau"], fuit: ["message"], dit: "aime être vu, et avec qui" },
    independant:  { f: "Indépendante", h: "Indépendant", aime: ["cafe", "message", "paddock"], fuit: ["cadeau"], dit: "tient à sa liberté et à son travail" }
  };
  var LIEUX = ["à une soirée après la course", "dans le train du retour", "chez des amis communs", "au bord d'un circuit", "à un gala de charité", "dans un café de quartier", "à l'anniversaire d'un pilote", "sur un tournage publicitaire"];
  function genre(p, f, h) { return p.fem ? f : h; }
  function age() { return Math.max(18, Math.min(45, (G.age || 20) + entre(-3, 4))); }

  function nouvelle() {
    var e = E(), fem = e.pref === "f" ? true : e.pref === "h" ? false : Math.random() < .5, rep = G.reputation || 0;
    var max = rep >= 65 ? 2 : rep >= 35 ? 1 : 0, M = METIERS.filter(function (m) { return m[2] <= max; });
    var m = Math.random() < .6 ? hasard(M.filter(function (x) { return x[2] === max; })) : hasard(M);
    return { id: "r" + Date.now().toString(36) + entre(100, 999), fem: fem, nom: hasard(fem ? F : H) + " " + hasard(NOMS), age: age(), metier: fem ? m[0] : m[1], noto: m[2],
      caractere: hasard(Object.keys(CARACTERES)), lieu: hasard(LIEUX), lien: entre(8, 22), vu: semAbs(), gestes: 0 };
  }
  function renouveler(force) {
    var e = E();
    if (!majeur()) return;
    e.liste = e.liste.filter(function (p) { return semAbs() - p.vu <= 12; });           // sans nouvelles, chacun suit sa vie
    if (!force && semAbs() - e.maj < 4) return;
    e.maj = semAbs();
    if (partenaire()) return;
    var n = Math.min(2, 4 - e.liste.length);
    for (var i = 0; i < n; i++) { var p = nouvelle(); if (!e.liste.some(function (x) { return x.nom === p.nom; })) e.liste.push(p); }
  }

  /* --- Gestes ------------------------------------------------------------------ */
  var GESTES = {
    message: { lbl: "Envoyer un message", pa: 0, cout: 0, gain: [1, 4] },
    cafe:    { lbl: "Prendre un café", pa: 1, cout: 40, gain: [3, 7] },
    diner:   { lbl: "Dîner au restaurant", pa: 1, cout: 350, gain: [4, 9] },
    paddock: { lbl: "Inviter au paddock", pa: 1, cout: 800, gain: [4, 10], public: true },
    cadeau:  { lbl: "Offrir un cadeau", pa: 0, cout: 1200, gain: [3, 8] },
    weekend: { lbl: "Partir en week-end", pa: 2, cout: 3500, gain: [7, 14], mini: 35 },
    public:  { lbl: "Soirée officielle", pa: 1, cout: 1500, gain: [4, 9], public: true, couple: true }
  };
  var BIEN = ["Le courant passe.", "Vous avez parlé des heures.", "Un sourire qui en dit long.", "Tu repars le cœur léger.", "La soirée a filé sans qu'on regarde l'heure."];
  var MAL = ["Ce n'était pas la bonne idée.", "L'ambiance est restée froide.", "Tu sens que ça ne prend pas.", "Un long silence, puis un au revoir poli."];
  function dispo(g, p, couple) {
    var d = GESTES[g];
    if (!d || (d.couple && !couple)) return "indisponible";
    if ((d.mini || 0) > lien(p, couple)) return "trop tôt";
    if ((p.semGestes || 0) === semAbs() && (p.nGestes || 0) >= 2) return "assez pour cette semaine";
    if ((G.pa || 0) < d.pa) return "points d'action";
    if ((G.budget || 0) < d.cout) return "budget";
    return "";
  }
  function lien(p, couple) { return couple ? p.closeness : p.lien; }
  function ajouter(p, couple, v) { if (couple) { p.closeness = borne(p.closeness + v); p.lastContact = G.semaine || 1; } else p.lien = borne(p.lien + v); }
  function faire(g, id) {
    var couple = id === "couple", p = couple ? partenaire() : E().liste.filter(function (x) { return x.id === id; })[0];
    if (!p || !majeur() || dispo(g, p, couple)) return null;
    var d = GESTES[g], c = CARACTERES[p.caractere] || CARACTERES.independant;
    G.pa = Math.max(0, (G.pa || 0) - d.pa); G.budget = (G.budget || 0) - d.cout;
    if (p.semGestes !== semAbs()) { p.semGestes = semAbs(); p.nGestes = 0; }
    p.nGestes++; p.gestes = (p.gestes || 0) + 1; p.vu = semAbs();
    var aime = c.aime.indexOf(g) >= 0, fuit = c.fuit.indexOf(g) >= 0, v = entre(d.gain[0], d.gain[1]);
    if (p.dernier === g) v = Math.round(v * .5);                       // toujours la même attention lasse
    p.dernier = g;
    if (aime) v = Math.round(v * 1.5); if (fuit) v = -entre(1, 4);
    else if (Math.random() < .12) v = -entre(1, 3);                   // un mauvais soir
    if (couple) v = Math.round(v * .7);
    ajouter(p, couple, v);
    G.happiness = Math.max(0, Math.min(100, (G.happiness || 50) + (v > 0 ? 1 : -1)));
    if (d.public && p.noto >= 1 && Math.random() < .5) presse(couple ? moi() + " et " + p.name + " au bras l'un de l'autre" : moi() + " aperçu avec " + p.nom + (p.noto === 2 ? " : la photo qui fait le tour du monde" : ""));
    p.mot = (v > 0 ? hasard(BIEN) : hasard(MAL)) + " (" + (v > 0 ? "+" : "−") + Math.abs(v) + ")" + (aime && v > 0 ? " Exactement son style." : fuit ? " Ce n'est pas son style." : "");
    rendu();
    return v;
  }
  function chanceCouple(p) { return Math.max(.05, Math.min(.95, (p.lien - 45) / 45)); }
  function demander(id) {
    var e = E(), p = e.liste.filter(function (x) { return x.id === id; })[0];
    if (!p || partenaire() || !majeur() || p.lien < 50 || p.refus === semAbs()) return null;
    if (Math.random() < chanceCouple(p)) {
      R().partner = { name: p.nom, fem: p.fem, age: p.age, saisonAge: G.saison || 1, profil: ["discret", "connu", "celebrite"][p.noto], noto: p.noto, metier: p.metier.toLowerCase(), caractere: p.caractere, closeness: Math.max(50, p.lien),
        since: { saison: G.saison || 1, year: G.gameYear || 2024 }, lastContact: G.semaine || 1, mot: genre(p, "Elle", "Il") + " a dit oui." };
      e.liste = []; G.happiness = Math.min(100, (G.happiness || 50) + 8);
      if (window._rj127) _rj127.couple();
      if (p.noto === 2) presse("Officiel : " + moi() + " et " + p.nom + " sont ensemble");
    } else { p.refus = semAbs(); p.lien = borne(p.lien - 10); p.mot = genre(p, "Elle", "Il") + " préfère attendre."; G.happiness = Math.max(0, (G.happiness || 50) - 3); }
    rendu();
    return !!partenaire();
  }
  function oublier(id) { E().liste = E().liste.filter(function (x) { return x.id !== id; }); rendu(); }
  function preference(v) { var e = E(); e.pref = v; e.liste = e.liste.filter(function (p) { return v === "tous" || p.fem === (v === "f"); }); e.maj = -99; renouveler(); rendu(); }
  function rompre() {
    var p = partenaire(); if (!p || !window._rj127) return;
    _rj127.rompre(); E().maj = semAbs(); rendu();
  }

  /* --- La vie à deux : des situations à trancher -------------------------------- */
  var SITUATIONS = [
    { id: "carriere", si: function (p) { return p.noto >= 1; }, mail: function (p) { return { subject: "Le même week-end", body: "Le plus grand rendez-vous de ma saison tombe le week-end de ta course. J'aurais aimé t'avoir à mes côtés, au moins le jeudi soir.", actions: [
      { label: "Faire l'aller-retour (1 PA, 2 500 €)", kind: "accept", rj127: { proche: 10, pa: -1, budget: -2500 } }, { label: "Envoyer des fleurs et un mot", kind: "reply", rj127: { proche: 1, budget: -200 } }, { label: "Impossible, la course d'abord", kind: "refuse", rj127: { proche: -7 } }] }; } },
    { id: "presse", si: function (p) { return p.noto >= 1; }, mail: function (p) { return { subject: "Les paparazzis", body: "Ils sont encore devant chez nous. Soit on se montre une bonne fois, soit on se protège. Décide avec moi.", actions: [
      { label: "Poser ensemble pour un magazine", kind: "accept", rj127: { proche: p.caractere === "discret" ? -6 : 4, budget: 4000, presse: "{pilote} et {nom} ouvrent leur porte" } }, { label: "Se protéger, rester discrets", kind: "reply", rj127: { proche: p.caractere === "mondain" ? -4 : 5 } }] }; } },
    { id: "jalousie", mail: function (p) { return { subject: "Cette photo", body: "J'ai vu la photo de la soirée. Tu étais très proche de quelqu'un. Dis-moi ce que je dois en penser.", actions: [
      { label: "Expliquer calmement", kind: "reply", rj127: { proche: p.caractere === "independant" ? 4 : 1 } }, { label: "S'excuser et passer la soirée ensemble (1 PA)", kind: "accept", rj127: { proche: 7, pa: -1 } }, { label: "Ne pas se justifier", kind: "refuse", rj127: { proche: -8 } }] }; } },
    { id: "tentation", si: function () { return (G.reputation || 0) >= 35; }, mail: function (p) { return { subject: "Une invitation ambiguë", de: "Ton meilleur ami", body: "Quelqu'un d'assez connu veut te revoir après la soirée d'hier, en tête-à-tête. " + p.name + " n'en sait rien. Tu fais quoi ?", actions: [
      { label: "Décliner, clairement", kind: "accept", rj127: { proche: 4, mental: 1 } }, { label: "Y aller, juste pour parler", kind: "reply", rj127: Math.random() < .5 ? { proche: -12, presse: "{pilote} vu en galante compagnie, sans {nom}" } : { proche: -2 } }] }; } },
    { id: "absence", mail: function (p) { return { subject: "Tu es où ?", body: "Trois semaines que je te vois par écran interposé. Je ne te demande pas d'arrêter, juste une journée rien qu'à nous.", actions: [
      { label: "Bloquer deux jours (2 PA)", kind: "accept", rj127: { proche: 13, bonheur: 3, pa: -2 } }, { label: "Un appel long ce soir", kind: "reply", rj127: { proche: 3 } }, { label: "Après la prochaine course", kind: "refuse", rj127: { proche: -5 } }] }; } },
    { id: "famille", mail: function (p) { return { subject: "Dimanche chez mes parents", body: "Mes parents aimeraient enfin te rencontrer. Rien d'officiel : un déjeuner, et mon père te parlera sûrement de ta dernière course.", actions: [
      { label: "Y aller (1 PA)", kind: "accept", rj127: { proche: 8, pa: -1 } }, { label: "Remettre à plus tard", kind: "refuse", rj127: { proche: -4 } }] }; } },
    { id: "peur", mail: function (p) { return { subject: "J'ai eu peur", body: "J'ai vu l'accident à la télé, je n'ai pas respiré pendant dix secondes. Je sais que c'est ta vie. Parle-moi de ce que tu ressens, pour une fois.", actions: [
      { label: "En parler vraiment", kind: "accept", rj127: { proche: 8, mental: 1 } }, { label: "Rassurer et changer de sujet", kind: "reply", rj127: { proche: 1 } }] }; } },
    { id: "argent", mail: function (p) { return { subject: "Un projet à deux", body: "J'aimerais me lancer à mon compte. Il me manque un coup de pouce. Je préfère te le demander à toi plutôt qu'à une banque.", actions: [
      { label: "Aider (10 000 €)", kind: "accept", rj127: { proche: 11, budget: -10000 } }, { label: "Aider un peu (3 000 €)", kind: "reply", rj127: { proche: 4, budget: -3000 } }, { label: "Refuser", kind: "refuse", rj127: { proche: -6 } }] }; } }
  ];
  function situation() {
    var p = partenaire();
    if (!p || p.attente || semAbs() - (p.sitSem || (p.sitSem = semAbs())) < 7 || Math.random() > .4) return null;
    var vues = p.sits || (p.sits = []), S = SITUATIONS.filter(function (s) { return vues.slice(-4).indexOf(s.id) < 0 && (!s.si || s.si(p)); });
    if (!S.length) return null;
    var s = hasard(S), m = s.mail(p), avant = getMailbox()[0];
    p.sitSem = semAbs(); vues.push(s.id);
    pushMail({ from: m.de || p.name, role: m.de ? "friends" : "family", subject: m.subject, body: m.body, actions: m.actions });
    var x = getMailbox()[0]; if (!x || x === avant) return null;
    x.rj127 = "situation";
    return s.id;
  }

  /* --- L'écran ------------------------------------------------------------------- */
  function visage(nomP, fem, a) { try { return '<span class="rj174-v">' + RJAvatar.html(RJAvatar.personnage(nomP, { fem: fem, age: a, role: "civil" }), 48) + "</span>"; } catch (e) { return ""; } }
  function boutons(p, id, couple) {
    return Object.keys(GESTES).filter(function (g) { return couple || !GESTES[g].couple; }).map(function (g) {
      var d = GESTES[g], non = dispo(g, p, couple), prix = [d.pa ? d.pa + " PA" : "", d.cout ? euros(d.cout) : ""].filter(Boolean).join(" · ") || "gratuit";
      return '<button type="button" data-g="' + g + '" data-id="' + id + '"' + (non ? " disabled" : "") + "><b>" + d.lbl + "</b><span>" + (non && non !== "indisponible" ? non : prix) + "</span></button>";
    }).join("");
  }
  function carteR(p) {
    var c = CARACTERES[p.caractere], peut = p.lien >= 50 && p.refus !== semAbs();
    return '<div class="rj174-c">' + visage(p.nom, p.fem, p.age) + '<div class="rj174-t"><b>' + esc(p.nom) + "</b><span>" + p.age + " ans · " + esc(p.metier) + " · " + genre(p, c.f, c.h) + "</span><i>" + genre(p, "Rencontrée ", "Rencontré ") + esc(p.lieu) + " : " + c.dit + ".</i></div>" +
      '<div class="rj174-j"><u style="width:' + p.lien + '%"></u><em>Complicité ' + p.lien + "</em></div>" + (p.mot ? '<p class="rj174-m">' + esc(p.mot) + "</p>" : "") +
      '<div class="rj174-g">' + boutons(p, p.id, false) + '</div><div class="rj174-f">' + (p.lien >= 50 ? '<button type="button" class="oui" data-dem="' + p.id + '"' + (peut ? "" : " disabled") + ">Se mettre en couple" + (peut ? " · " + Math.round(100 * chanceCouple(p)) + " %" : "") + "</button>" : "") + '<button type="button" data-oub="' + p.id + '">Ne plus se voir</button></div></div>';
  }
  function rendu() {
    var hote = document.getElementById("vp-content"); if (!hote) return;
    var b = document.getElementById("rj174"); if (!b) { b = document.createElement("div"); b.id = "rj174"; b.addEventListener("click", clic); }
    if (!majeur()) { b.remove(); return; }
    var p = partenaire(), e = E(), h;
    if (p) {
      var c = CARACTERES[p.caractere];
      h = '<div class="t-sec">Votre couple</div><div class="rj174-c">' + (c ? '<div class="rj174-t"><i>' + genre(p, c.f, c.h) + " : " + c.dit + ".</i></div>" : "") + '<div class="rj174-j"><u style="width:' + p.closeness + '%"></u><em>Complicité ' + Math.round(p.closeness) + "</em></div>" + (p.mot ? '<p class="rj174-m">' + esc(p.mot) + "</p>" : "") +
        '<div class="rj174-g">' + boutons(p, "couple", true) + '</div><div class="rj174-f"><button type="button" data-rompre="1">' + (E().sur ? "Confirmer la rupture" : "Rompre") + "</button></div></div>";
    } else {
      h = '<div class="t-sec">Rencontres</div><div class="rj174-pref">' + [["tous", "Tout le monde"], ["f", "Des femmes"], ["h", "Des hommes"]].map(function (x) { return '<button type="button" data-pref="' + x[0] + '"' + (e.pref === x[0] ? ' class="on"' : "") + ">" + x[1] + "</button>"; }).join("") + "</div>" +
        (e.liste.length ? e.liste.map(carteR).join("") : '<div class="rj-vide">Personne en vue pour l\'instant. Les rencontres arrivent au fil des semaines.</div>');
    }
    b.innerHTML = h;
    var foyer = document.getElementById("rj127-bloc") || document.getElementById("rj125-bloc");
    if (b.parentNode !== hote || (foyer && foyer.nextSibling !== b)) hote.insertBefore(b, foyer ? foyer.nextSibling : hote.firstChild);
  }
  function clic(ev) {
    var t = ev.target.closest && ev.target.closest("button"); if (!t || t.disabled) return;
    var d = t.dataset;
    if (d.rompre) { if (E().sur) { E().sur = false; rompre(); if (typeof renderVieperso === "function") renderVieperso(); } else { E().sur = true; rendu(); } return; }
    E().sur = false;
    if (d.g) faire(d.g, d.id);
    else if (d.dem) { if (demander(d.dem) && typeof renderVieperso === "function") renderVieperso(); }
    else if (d.oub) oublier(d.oub);
    else if (d.pref) preference(d.pref);
    try { if (typeof updateUI === "function") updateUI(); } catch (e) {}
  }

  function boot() {
    if (typeof rjInscrire !== "function" || typeof getRelations !== "function" || !window._rj127 || !Array.isArray(window.WEEKLY_TICK_HOOKS) || !Array.isArray(window.RJ_SAVE_HOOKS)) return setTimeout(boot, 150);
    window.WEEKLY_TICK_HOOKS.push({ id: ID, run: function () { try { if (majeur()) { renouveler(); situation(); } } catch (e) { console.warn(TAG, e && e.message); } } });
    rjInscrire("renderVieperso", { id: ID, ordre: -9500, apres: function () { try { renouveler(); rendu(); } catch (e) { console.warn(TAG, e && e.message); } } });
    window.RJ_SAVE_HOOKS.push({ cle: "rj174", ecrire: function (g) { return g._rj174 || null; }, lire: function (b, g) { g._rj174 = b || null; } });
    window.RJRencontres = { etat: E, nouvelle: nouvelle, renouveler: renouveler, faire: faire, demander: demander, preference: preference, situation: situation, rompre: rompre, SITUATIONS: SITUATIONS, GESTES: GESTES, CARACTERES: CARACTERES, rendu: rendu };
    window._rj174Uninstall = function () {
      window.WEEKLY_TICK_HOOKS = window.WEEKLY_TICK_HOOKS.filter(function (h) { return !h || h.id !== ID; });
      window.RJ_SAVE_HOOKS = window.RJ_SAVE_HOOKS.filter(function (h) { return !h || h.cle !== "rj174"; });
      rjDesinscrire([ID], "renderVieperso"); var b = document.getElementById("rj174"); if (b) b.remove(); delete window.RJRencontres;
    };
    console.log(TAG, "actif");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
