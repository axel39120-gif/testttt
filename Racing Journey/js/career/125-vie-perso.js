/* =====================================================================
 * 125-vie-perso.js — UNE VIE PERSO FAITE DE MOMENTS
 *
 * POURQUOI
 * Les proches s'éloignaient d'un cran fixe chaque semaine : sans dépenser
 * ses points d'action en appels, les amis passaient de 55 à 15 en huit
 * courses. Une corvée, pas une vie.
 *
 * CE QUE FAIT LE MODULE
 *  1. Plus d'érosion fixe : un proche ne s'éloigne qu'après plusieurs
 *     semaines sans nouvelles, d'un point par semaine, et jamais sous un
 *     plancher (on ne perd pas sa famille en une saison).
 *  2. Chaque saison apporte des moments, annoncés par message : l'anniversaire
 *     d'un parent, le mariage d'un ami, tes parents dans les tribunes du
 *     Grand Prix de ton pays, une rencontre. Ta décision pèse sur tes
 *     proches, ton bonheur et ton mental ; ne pas répondre aussi.
 *  3. Les proches écrivent d'eux-mêmes après une course marquante.
 *  4. Vie perso affiche les moments de la saison.
 *
 * Réversible : window._rj125Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[125-vie-perso]";

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function hasard(t) { return t[Math.floor(Math.random() * t.length)]; }
  function entre(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function semAbs() { return (G.saison || 1) * 48 + (G.semaine || 1); }
  function etat() { if (!G._rj125) G._rj125 = { saison: 0, moments: [], ecrit: -99 }; return G._rj125; }

  /* ---------------------------------------------------------- érosion --- */
  var EROSION = {
    parents: { apres: 8, plancher: 45 },
    friends: { apres: 6, plancher: 35 },
    partner: { apres: 4, plancher: 20 },
    coach:   { apres: 8, plancher: 30 }
  };
  function eroder(n) {
    var R = getRelations();
    Object.keys(EROSION).forEach(function (k) {
      var p = R[k], e = EROSION[k];
      if (!p || (k === "parents" && p.alive === false)) return;
      var dernier = p.lastContact || 0, sem = G.semaine || 1;
      var silence = dernier > sem ? sem : sem - dernier;   // nouvelle saison : le compteur repart
      if (silence <= e.apres || p.closeness <= e.plancher) return;
      p.closeness = Math.max(e.plancher, p.closeness - (n || 1));
    });
  }

  /* ---------------------------------------------------------- moments --- */
  var PAYS = { Imola: "IT", Monza: "IT", Mugello: "IT", Misano: "IT", Vallelunga: "IT", Barcelone: "ES", Jerez: "ES", Valence: "ES",
    Silverstone: "GB", Brands: "GB", Donington: "GB", Spa: "BE", Zolder: "BE", Zandvoort: "NL", Assen: "NL", Budapest: "HU", Monaco: "MC",
    "Paul Ricard": "FR", "Magny-Cours": "FR", Pau: "FR", "Le Mans": "FR", Nogaro: "FR", Suzuka: "JP", Fuji: "JP", Motegi: "JP",
    Austin: "US", Miami: "US", "Las Vegas": "US", Indianapolis: "US", Mexico: "MX", "Sao Paulo": "BR", Interlagos: "BR", Montreal: "CA",
    Melbourne: "AU", Spielberg: "AT", "Red Bull Ring": "AT", Baku: "AZ", Singapore: "SG", Jeddah: "SA", Bahrain: "BH", "Abu Dhabi": "AE",
    Shanghai: "CN", Hockenheim: "DE", "Nürburgring": "DE", Portimao: "PT", Losail: "QA", Lusail: "QA" };
  function paysDe(nom) {
    for (var k in PAYS) if (String(nom || "").indexOf(k) >= 0) return PAYS[k];
    return null;
  }
  function gpMaison() {
    var nat = (G.pilot && G.pilot.nat) || "";
    return (window.CAL_RACES || []).filter(function (c) { return paysDe(c.name) === nat; })[0] || null;
  }

  var AMIS = ["Thomas", "Léa", "Hugo", "Inès", "Maxime", "Camille", "Lucas", "Jade"];
  var RENCONTRES = ["Clara Vidal", "Sacha Morel", "Alex Laurent", "Emma Rossi", "Noa Bernard", "Lou Ferreira"];

  function planifier(force) {
    var e = etat();
    if (!force && e.saison === (G.saison || 1) && e.moments.length) return e.moments;
    var m = [{ type: "anniversaire", w: entre(5, 40), qui: hasard(["ta mère", "ton père"]) }];
    if (Math.random() < 0.6) m.push({ type: "mariage", w: entre(8, 38), qui: hasard(AMIS) });
    var gp = gpMaison();
    if (gp) m.push({ type: "gp_maison", w: Math.max(1, gp.week - 1), circuit: gp.name });
    var R = getRelations();
    if (!R.partner && (G.age || 16) >= 18) {
      /* Qui l'on rencontre dépend de la réputation (127) : célébrité, visage connu ou vie discrète. */
      var pr = window._rj127 ? window._rj127.pretendant() : { qui: hasard(RENCONTRES), profil: "discret" };
      m.push({ type: "rencontre", w: entre(6, 34), qui: pr.qui, profil: pr.profil, metier: pr.metier, cache: true });
    }
    m.sort(function (a, b) { return a.w - b.w; });
    e.saison = G.saison || 1; e.moments = m;
    return m;
  }

  /* Effets d'un choix : proches, bonheur, mental, PA, budget. */
  function appliquer(eff) {
    if (!eff) return;
    ["parents", "friends", "partner"].forEach(function (k) {
      if (eff[k] && typeof applyRelationMailEffect === "function") applyRelationMailEffect("relation_" + k, { delta: eff[k] });
    });
    if (eff.happiness) G.happiness = Math.max(0, Math.min(100, (G.happiness || 50) + eff.happiness));
    if (eff.mental && typeof changeMental === "function") { try { changeMental(eff.mental, "Vie perso"); } catch (e) {} }
    if (eff.pa) G.pa = Math.max(0, (G.pa || 0) + eff.pa);
    if (eff.budget) G.budget = (G.budget || 0) + eff.budget;
    if (eff.couple) {
      var R = getRelations();
      R.partner = { name: eff.couple, profil: eff.profil || "discret", metier: eff.metier || null, closeness: 45, since: { saison: G.saison || 1, year: G.annee || (2023 + (G.saison || 1)) }, lastContact: G.semaine || 1, events: [] };
    }
  }

  var MESSAGES = {
    anniversaire: function (m) { return { from: "Tes parents", role: "family", subject: "L'anniversaire de " + m.qui,
      body: "C'est l'anniversaire de " + m.qui + " ce week-end. Toute la famille sera là pour le dîner… Tu pourras venir ?",
      actions: [
        { label: "Je rentre pour le dîner (1 PA)", kind: "accept", rj125: { pa: -1, parents: 10, happiness: 5, mental: 2 } },
        { label: "Je l'appelle en visio", kind: "reply", rj125: { parents: 3, happiness: 1 } },
        { label: "Pas cette fois, je suis en déplacement", kind: "refuse", rj125: { parents: -6, happiness: -2 } }],
      ignorer: { parents: -8, happiness: -3 } }; },
    mariage: function (m) { return { from: "Tes amis", role: "friends", subject: m.qui + " se marie !",
      body: m.qui + " se marie dans trois semaines et compte sur toi. Tout le monde sera là.",
      actions: [
        { label: "J'y serai (1 PA, 500 €)", kind: "accept", rj125: { pa: -1, budget: -500, friends: 12, happiness: 6 } },
        { label: "Je passe au vin d'honneur", kind: "reply", rj125: { friends: 4, happiness: 2 } },
        { label: "Impossible, week-end de course", kind: "refuse", rj125: { friends: -8 } }],
      ignorer: { friends: -10, happiness: -2 } }; },
    gp_maison: function (m) { return { from: "Tes parents", role: "family", subject: "On sera à " + m.circuit + " !",
      body: "Pour ton Grand Prix à domicile, toute la famille a pris des places en tribune. On est tellement fiers de toi.",
      actions: [
        { label: "Je vous obtiens des pass paddock (800 €)", kind: "accept", rj125: { budget: -800, parents: 10, happiness: 6, mental: 3 } },
        { label: "On se voit après la course", kind: "reply", rj125: { parents: 4, mental: 1 } }],
      ignorer: { parents: -3 } }; },
    rencontre: function (m) { return { from: "Tes amis", role: "friends", subject: "Une rencontre à la soirée de l'écurie",
      body: m.qui + (m.metier ? ", " + m.metier + "," : "") + " t'a parlé toute la soirée et t'a laissé son numéro. Tes amis n'en reviennent pas.",
      actions: [
        { label: "L'inviter à dîner", kind: "accept", rj125: { couple: m.qui, profil: m.profil, metier: m.metier, happiness: 4 } },
        { label: "Rester concentré sur la saison", kind: "refuse", rj125: { mental: 1 } }],
      ignorer: null }; }
  };

  function envoyer(m) {
    var o = MESSAGES[m.type] && MESSAGES[m.type](m);
    if (!o || typeof pushMail !== "function") return null;
    var avant = getMailbox()[0];
    pushMail({ from: o.from, role: o.role, subject: o.subject, body: o.body, actions: o.actions });
    var r = getMailbox()[0];
    if (!r || r === avant) return null;
    r.rj125 = m.type; r.rj125Ignorer = o.ignorer; r.rj124Garde = false;
    return r;
  }

  function tick() {
    planifier(false).forEach(function (m) {
      if (!m.fait && (G.semaine || 1) >= m.w) { m.fait = true; envoyer(m); }
    });
    /* Un moment laissé sans réponse (expiré par 124) a aussi ses conséquences. */
    getMailbox().forEach(function (r) {
      if (r.rj125 && r.rj124Expire && !r.rj125Traite) { r.rj125Traite = true; appliquer(r.rj125Ignorer); }
    });
  }

  /* --------------------------------------------- les proches écrivent --- */
  function proches(o) {
    var avant = getMailbox()[0];
    pushMail(o);
    var r = getMailbox()[0];
    return r && r !== avant ? r : null;
  }
  function apresCourse(c) {
    if (!c) return null;
    var e = etat(), lieu = c.circuit || c.nom || "la course";
    var maison = e.moments.filter(function (m) { return m.type === "gp_maison" && m.circuit === c.circuit; })[0];
    if (maison && !maison.vu) {
      maison.vu = true;
      appliquer({ happiness: 3, parents: 2 });
      return proches({ from: "Tes parents", role: "family", subject: "On était là, à " + lieu,
        body: (c.pos && c.pos <= 3 ? "Te voir sur le podium chez nous… Ta mère a pleuré." : "Quelle ambiance ! Peu importe le résultat, on était fiers de toi dans la tribune.") });
    }
    if (semAbs() - e.ecrit < 4) return null;
    var r = null;
    if (c.pos === 1) r = proches({ from: "Tes amis", role: "friends", subject: "ON A TOUT VU !!", body: "Victoire à " + lieu + " ! On était tous devant l'écran, le bar entier a crié. Champagne à ton retour." });
    else if (c.pos && c.pos <= 3) r = proches({ from: "Tes amis", role: "friends", subject: "Podium !", body: "Podium à " + lieu + ", bravo ! On t'a regardé avec toute la bande." });
    else if (!c.pos || c.dnf) r = proches({ from: "Tes parents", role: "family", subject: "Courage", body: "On a vu l'abandon à " + lieu + ". Ça arrive aux meilleurs. On t'embrasse, la prochaine sera la bonne." });
    if (r) { e.ecrit = semAbs(); appliquer(c.pos && c.pos <= 3 ? { happiness: 2 } : { mental: 2 }); }
    return r;
  }

  /* ------------------------------------------------------------ écran --- */
  var LIBELLE = {
    anniversaire: function (m) { return "L'anniversaire de " + m.qui; },
    mariage: function (m) { return "Le mariage de " + m.qui; },
    gp_maison: function (m) { return "Tes parents au Grand Prix — " + m.circuit; },
    rencontre: function (m) { return "Une rencontre"; }
  };
  function injecter() {
    var hote = document.getElementById("vp-content");
    if (!hote || !G) return;
    var ms = planifier(false).filter(function (m) { return LIBELLE[m.type] && (!m.cache || m.fait); });
    var bloc = document.getElementById("rj125-bloc") || document.createElement("div");
    bloc.id = "rj125-bloc";
    bloc.innerHTML = '<div class="rj125-titre">Moments de la saison</div>' + (ms.length ? ms.map(function (m) {
      var passe = m.fait || (G.semaine || 1) > m.w;
      return '<div class="rj125-moment' + (passe ? " passe" : "") + '"><span>Sem. ' + m.w + "</span><b>" + esc(LIBELLE[m.type](m)) + "</b><em>" +
        (passe ? "Passé" : "À venir") + "</em></div>";
    }).join("") : '<div class="rj125-moment passe"><b>Rien de prévu cette saison.</b></div>');
    hote.insertBefore(bloc, hote.firstChild);
    /* Les cartes de proches prennent la tuile de l'accueil, à leur couleur. */
    [].forEach.call(hote.querySelectorAll(".rel-card"), function (c) {
      var acc = c.querySelector(".rel-card-accent");
      if (acc) c.style.setProperty("--t", acc.style.background || "#60A5FA");
    });
  }

  /* ------------------------------------------------------ installation --- */
  function installer() {
    if (typeof rjInscrire !== "function" || typeof getRelations !== "function" || !Array.isArray(window.WEEKLY_TICK_HOOKS) || !Array.isArray(window.RACE_POST_HOOKS)) return false;
    rjInscrire("tickRelationships", { id: "125-vie-perso:tickRelationships", remplace: function (args) {
      eroder(args[0] || 1);
      if (typeof checkLifeEvents === "function") checkLifeEvents();
    } });
    window.WEEKLY_TICK_HOOKS.push({ id: "125-vie-perso", run: function () { try { tick(); } catch (e) { console.warn(TAG, "moments :", e && e.message); } } });
    window.RACE_POST_HOOKS.push({ id: "125-vie-perso", run: function () {
      try { apresCourse(G.races && G.races[G.races.length - 1]); } catch (e) { console.warn(TAG, "après course :", e && e.message); }
    } });
    rjInscrire("handleMailAction", { id: "125-vie-perso:handleMailAction", apres: function (res, args) {
      var m = getMailbox().filter(function (x) { return x.id === args[0]; })[0];
      var a = m && m.rj125 && m.actions && m.actions[args[1]];
      if (a && a.rj125 && !m.rj125Traite) { m.rj125Traite = true; appliquer(a.rj125); }
    } });
    rjInscrire("renderVieperso", { id: "125-vie-perso:renderVieperso", apres: function () { injecter(); } });
    if (typeof window._rj64Champs === "function") window._rj64Champs("_rj125");
    return true;
  }

  var essais = 0;
  function boot() {
    if (installer()) { console.log(TAG, "actif — moments de la saison, plus d'érosion fixe"); return; }
    if (essais++ < 80) setTimeout(boot, 150); else console.warn(TAG, "non installé");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  window._rj125 = { planifier: planifier, apresCourse: apresCourse, tick: tick, eroder: eroder, gpMaison: gpMaison };
  window._rj125Uninstall = function () {
    window.WEEKLY_TICK_HOOKS = (window.WEEKLY_TICK_HOOKS || []).filter(function (h) { return h.id !== "125-vie-perso"; });
    window.RACE_POST_HOOKS = (window.RACE_POST_HOOKS || []).filter(function (h) { return h.id !== "125-vie-perso"; });
    rjDesinscrire(["125-vie-perso:"]);
    var b = document.getElementById("rj125-bloc"); if (b) b.remove();
    delete window._rj125;
  };
})();
