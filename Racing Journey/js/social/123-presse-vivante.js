/* =====================================================================
 * 123-presse-vivante.js — UNE PRESSE QUI SE SOUVIENT
 *
 * POURQUOI
 * Les conférences de presse (100) avaient des journalistes nommés et des
 * réponses qui comptaient, mais rien n'en restait : aucun média ne vous
 * aimait ni ne vous détestait, personne ne titrait sur votre week-end, et
 * l'audience restait à zéro tant qu'on ne publiait pas soi-même, même
 * après un podium.
 *
 * CE QUE FAIT LE MODULE
 *  1. Chaque média a une ligne éditoriale (tirée du ton de son
 *     journaliste) et une sympathie pour vous, de 0 à 100. Vos
 *     déclarations la font bouger selon ses goûts : le tabloïd aime la
 *     provocation, la presse bienveillante l'humilité, l'analyste la mesure.
 *  2. Une déclaration forte (assurée, provocatrice) devient une promesse.
 *     La presse la ressort au premier résultat qui la confirme ou la dément.
 *  3. Après chaque course, trois médias titrent sur vous, selon le résultat
 *     et selon ce qu'ils pensent de vous : la revue de presse.
 *  4. Une victoire, un podium ou un abandon vaut une interview
 *     d'après-course, par message : le ton choisi est publié et pèse.
 *  5. L'audience suit les résultats et les polémiques, sans attendre que
 *     vous publiiez.
 * Tout se lit dans Médias › Presse et se sauvegarde, déclarations comprises
 * (elles étaient perdues au rechargement).
 *
 * Réversible : window._rj123Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[123-presse]";

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function borne(v) { return Math.max(0, Math.min(100, v)); }
  function hasard(t) { return t[Math.floor(Math.random() * t.length)]; }

  /* ------------------------------------------------------------ état --- */
  function P() {
    if (!G._rjPresse) G._rjPresse = { medias: {}, promesses: [], revue: [], polemique: 0 };
    var p = G._rjPresse;
    journalistes().forEach(function (j) {
      if (!p.medias[j.media]) p.medias[j.media] = { sym: LIGNES[ligneDe(j)].sym0 };
    });
    return p;
  }

  function journalistes() { return (window._rj100 && window._rj100.journalistes) || []; }

  /* ------------------------------------------------ lignes éditoriales --- */
  var LIGNES = {
    Analyse:       { sym0: 50, couleur: "#00D4FF", gouts: { mesure: 3, humble: 1, assure: 1, provocateur: -2, evasif: -3 } },
    Passion:       { sym0: 55, couleur: "#F59E0B", gouts: { assure: 3, provocateur: 2, humble: 1, mesure: 0, evasif: -3 } },
    Critique:      { sym0: 42, couleur: "#EF4444", gouts: { mesure: 2, humble: 1, assure: -1, provocateur: -1, evasif: -4 } },
    Sensation:     { sym0: 45, couleur: "#EC4899", gouts: { provocateur: 5, assure: 2, humble: -1, mesure: -1, evasif: -3 } },
    Bienveillance: { sym0: 60, couleur: "#34D399", gouts: { humble: 4, mesure: 2, assure: 0, provocateur: -4, evasif: -1 } }
  };
  var DU_TON = { technique: "Analyse", passionne: "Passion", incisif: "Critique", tabloid: "Sensation", bienveillant: "Bienveillance" };
  function ligneDe(j) { return DU_TON[j.ton] || "Analyse"; }

  function medias() {
    var p = P(), vus = {};
    return journalistes().filter(function (j) { return !vus[j.media] && (vus[j.media] = 1); }).map(function (j) {
      var l = ligneDe(j);
      return { nom: j.media, ligne: l, couleur: LIGNES[l].couleur, sym: Math.round(p.medias[j.media].sym), journaliste: j };
    });
  }

  /* Toute la presse lit une déclaration ; le média qui l'a recueillie
     réagit davantage. */
  function reagir(ton, mediaSource) {
    var p = P();
    medias().forEach(function (m) {
      var d = LIGNES[m.ligne].gouts[ton] || 0;
      if (m.nom === mediaSource) d *= 1.5;
      p.medias[m.nom].sym = borne(p.medias[m.nom].sym + d);
    });
    if (ton === "provocateur") p.polemique = (p.polemique || 0) + 1;
  }

  function retenirPromesse(texte, ton, media) {
    if (!texte || (ton !== "assure" && ton !== "provocateur")) return;
    var p = P();
    p.promesses.unshift({ s: G.saison || 1, w: G.semaine || 1, texte: String(texte).slice(0, 70), ton: ton, media: media, resolue: false });
    if (p.promesses.length > 6) p.promesses.length = 6;
  }

  /* Les déclarations de conférence (100) pas encore lues par la presse. */
  function lireDeclarations() {
    (G._rjDeclarations || []).slice().reverse().forEach(function (d) {
      if (!d || d._rj123) return;
      d._rj123 = true;
      reagir(d.ton, d.media);
      retenirPromesse(d.citation || d.titre, d.ton, d.media);
    });
  }

  /* ----------------------------------------------------------- titres --- */
  function pilote() {
    try { var n = ((G.pilot.prenom || "") + " " + (G.pilot.nom || "")).trim(); if (n) return n; } catch (e) {}
    return "Le pilote";
  }

  function classe(c) {
    if (!c || c.dnf || !c.pos) return "abandon";
    return c.pos === 1 ? "victoire" : c.pos <= 3 ? "podium" : c.pos <= 10 ? "points" : "hors";
  }

  /* Un titre par résultat et par regard : favorable, neutre ou hostile. */
  var TITRES = {
    victoire: {
      pos: ["{p} survole {c} : la victoire d'un grand", "{c} : {p}, magistral de bout en bout"],
      neu: ["{p} s'impose à {c}", "Victoire de {p} à {c}"],
      neg: ["{p} gagne à {c}, aidé par les circonstances", "{c} : une victoire de {p} qui ne dit pas tout"]
    },
    podium: {
      pos: ["{p} sur le podium à {c} : la régularité paie", "{c} : {p} confirme sa montée en puissance"],
      neu: ["{p} P{n} à {c}", "Podium pour {p} à {c}"],
      neg: ["{p} P{n} à {c}, encore loin de la victoire", "{c} : {p} sur le podium, sans convaincre"]
    },
    points: {
      pos: ["{p} sauve des points précieux à {c}", "{c} : {p} limite la casse avec sang-froid"],
      neu: ["{p} termine P{n} à {c}", "{c} : P{n} pour {p}"],
      neg: ["{p} P{n} à {c} : le compte n'y est pas", "{c} : {p}, un dimanche sans relief"]
    },
    hors: {
      pos: ["{c} : un dimanche à oublier pour {p}, la voiture en cause", "{p} P{n} à {c} : l'équipe doit réagir"],
      neu: ["{p} hors des points à {c}", "{c} : {p} seulement P{n}"],
      neg: ["{p} sombre à {c}", "{c} : {p}, P{n}, le doute s'installe"]
    },
    abandon: {
      pos: ["{c} : la malchance frappe {p}", "Abandon cruel pour {p} à {c}"],
      neu: ["{p} abandonne à {c}", "{c} : fin de course prématurée pour {p}"],
      neg: ["{c} : {p} abandonne, une erreur de trop ?", "Nouvel abandon de {p} : {c} tourne au fiasco"]
    }
  };

  function remplir(t, course, k) {
    return t.replace(/\{p\}/g, pilote()).replace(/\{c\}/g, course.circuit || course.name || course.nom || "la dernière course").replace(/\{n\}/g, course.pos || "");
  }

  function rappelPromesse(course, k) {
    var p = P(), pr = p.promesses.filter(function (x) { return !x.resolue; }).pop();
    if (!pr || k === "points") return null;
    pr.resolue = true;
    var bien = k === "victoire" || k === "podium";
    return { media: pr.media, humeur: bien ? "pos" : "neg",
      titre: bien ? "Il l'avait annoncé : « " + pr.texte + " ». " + pilote() + " tient parole à " + remplir("{c}", course, k)
                  : "« " + pr.texte + " » : " + remplir("{p} rattrapé par ses mots à {c}", course, k) };
  }

  function titrer(course, k) {
    var ms = medias();
    if (!ms.length) return [];
    var depart = (G.races ? G.races.length : 0) * 3, titres = [];
    var rappel = rappelPromesse(course, k);
    if (rappel) titres.push(rappel);
    for (var i = 0; titres.length < 3 && i < ms.length; i++) {
      var m = ms[(depart + i) % ms.length];
      if (rappel && m.nom === rappel.media) continue;
      var regard = m.sym >= 60 ? "pos" : m.sym <= 40 ? "neg" : "neu";
      titres.push({ media: m.nom, humeur: regard, titre: remplir(hasard(TITRES[k][regard]), course, k) });
    }
    var p = P();
    titres.slice().reverse().forEach(function (t) {
      p.revue.unshift({ s: G.saison || 1, w: G.semaine || 1, media: t.media, titre: t.titre, humeur: t.humeur });
    });
    if (p.revue.length > 15) p.revue.length = 15;
    return titres;
  }

  /* --------------------------------------------------------- audience --- */
  var EXPOSITION = { "Formule 1": 25000, "IndyCar": 8000, "Endurance WEC": 5000, "Formule 2": 4000, "Super Formula": 2000,
    "Formule 3": 1500, "Formula Regional": 600, "Formule 4": 300, "Karting Senior": 80, "Karting Junior": 50 };
  var ECHO = { victoire: 1, podium: 0.6, points: 0.25, hors: 0.08, abandon: 0.05 };

  function social() {
    if (!G._rjSocial) {
      var base = G.igFollowers || 0;   // même amorce que 66-social
      G._rjSocial = { x: { f: Math.round(base * 0.55), posts: [], sem: 0, nb: 0 }, ig: { f: base, posts: [], sem: 0, nb: 0 } };
    }
    return G._rjSocial;
  }
  function abonnes() { var s = social(); return (s.x.f || 0) + (s.ig.f || 0); }

  function audience(k) {
    var s = social(), p = P();
    var mult = ECHO[k] * (p.polemique ? 1.5 : 1);
    var gain = Math.round(((EXPOSITION[G.cat] || 500) + abonnes() * 0.01) * mult * (0.8 + Math.random() * 0.4));
    p.polemique = 0;
    s.x.f = Math.round(s.x.f + gain * 0.45);
    s.ig.f = Math.round(s.ig.f + gain * 0.55);
    G.igFollowers = s.ig.f;
    return gain;
  }

  /* -------------------------------------------------------- interview --- */
  var INTERVIEWS = {
    victoire: { q: "Une victoire à {c} : qu'avez-vous à dire ce soir ?", r: [
      { ton: "assure", label: "C'était écrit. Et ce n'est que le début." },
      { ton: "humble", label: "Tout le mérite revient à l'équipe." },
      { ton: "provocateur", label: "Ceux qui doutaient de moi ont leur réponse." } ] },
    podium: { q: "Un podium à {c} : satisfait, ou il manquait quelque chose ?", r: [
      { ton: "assure", label: "La victoire viendra, et vite." },
      { ton: "humble", label: "Un beau résultat pour toute l'équipe." },
      { ton: "provocateur", label: "Sans le trafic, je gagnais." } ] },
    abandon: { q: "Un abandon à {c} : que s'est-il passé ?", r: [
      { ton: "mesure", label: "On analysera à froid. Ça arrive." },
      { ton: "humble", label: "C'est sur moi, je dois faire mieux." },
      { ton: "provocateur", label: "Ce n'est pas à moi qu'il faut poser la question." } ] }
  };

  function interview(course, k) {
    var modele = INTERVIEWS[k];
    if (!modele || typeof pushMail !== "function") return null;
    var m = hasard(medias()), j = m.journaliste;
    var r = pushMail({ from: j.prenom + " " + j.nom, role: "journalist", subject: "Interview d'après-course — " + m.nom,
      body: "« " + remplir(modele.q, course, k) + " »\n\n" + j.prenom + " " + j.nom + " (" + m.nom + ") attend ta réponse en zone mixte.",
      actions: modele.r.map(function (x) { return { label: x.label, kind: "accept", ton: x.ton }; }) });
    if (r) r.rj123 = { media: m.nom, auteur: j.prenom + " " + j.nom, circuit: course.circuit || course.name || "" };
    return r;
  }

  var EFFET_REP = { assure: 2, humble: 1, mesure: 1, provocateur: 3, evasif: -2 };

  function repondreInterview(m, a) {
    if (!m || !m.rj123 || !a || !a.ton || m.rj123.repondu) return;
    m.rj123.repondu = true;
    reagir(a.ton, m.rj123.media);
    retenirPromesse(a.label, a.ton, m.rj123.media);
    G._rjDeclarations = G._rjDeclarations || [];
    G._rjDeclarations.unshift({ saison: G.saison || 1, semaine: G.semaine || 1, _rj123: true,
      titre: pilote() + " : « " + a.label + " »", media: m.rj123.media, auteur: m.rj123.auteur, ton: a.ton,
      citation: "", reaction: "Interview d'après-course" + (m.rj123.circuit ? ", " + m.rj123.circuit : ""), couleur: "#A78BFA" });
    if (G._rjDeclarations.length > 12) G._rjDeclarations.length = 12;
    try { if (G.rep) G.rep.medias = borne((G.rep.medias || 0) + (EFFET_REP[a.ton] || 0)); } catch (e) {}
    try {
      var parts = m.rj123.auteur.split(" ");
      if (typeof window._rj101SurDeclaration === "function") window._rj101SurDeclaration({ prenom: parts[0], nom: parts.slice(1).join(" "), media: m.rj123.media }, a.ton, null);
    } catch (e) {}
  }

  /* ------------------------------------------------------ après course --- */
  function apresCourse(course) {
    if (!course) return { titres: [], gain: 0 };
    lireDeclarations();
    var k = classe(course);
    var titres = titrer(course, k), gain = audience(k);
    interview(course, k);
    return { titres: titres, gain: gain };
  }

  /* ------------------------------------------------------------ écran --- */
  function injecter() {
    var hote = document.getElementById("mt-presse");
    if (!hote || !G) return;
    var p = P(), bloc = document.getElementById("rj123-bloc");
    if (!bloc) { bloc = document.createElement("div"); bloc.id = "rj123-bloc"; }
    hote.insertBefore(bloc, hote.firstChild);
    var h = '<div class="rj123-sous">La revue de presse</div>';
    h += p.revue.length ? p.revue.slice(0, 6).map(function (t) {
      return '<div class="rj123-titre rj123-' + t.humeur + '"><span>' + esc(t.media) + " · S" + t.s + " sem. " + t.w + "</span>" + esc(t.titre) + "</div>";
    }).join("") : '<div class="rj123-vide">Pas encore de titre : la presse attend ta première course.</div>';
    /* Les médias, du plus favorable au plus hostile, en lignes compactes. */
    h += '<div class="rj123-sous">Ce que la presse pense de toi</div><div class="rj123-medias">' +
      medias().sort(function (a, b) { return b.sym - a.sym; }).map(function (m) {
        return '<div class="rj123-media" style="--t:' + m.couleur + '"><b>' + esc(m.nom) + "</b><small>" + m.ligne + "</small>" +
          '<span class="rj123-jauge" style="--v:' + m.sym + '%"></span><em>' + m.sym + "</em></div>";
      }).join("") + "</div>";
    bloc.innerHTML = h;
  }

  /* ------------------------------------------------------ installation --- */
  function installer() {
    if (!window._rj100 || typeof rjInscrire !== "function" || !Array.isArray(window.RACE_POST_HOOKS)) return false;
    window.RACE_POST_HOOKS.push({ id: "123-presse", run: function () {
      try { apresCourse(G.races && G.races[G.races.length - 1]); } catch (e) { console.warn(TAG, "après course :", e && e.message); }
    } });
    rjInscrire("handleMailAction", { id: "123-presse:handleMailAction", apres: function (res, args) {
      try {
        var m = getMailbox().filter(function (x) { return x.id === args[0]; })[0];
        if (m && m.rj123) repondreInterview(m, m.actions && m.actions[args[1]]);
      } catch (e) { console.warn(TAG, "interview :", e && e.message); }
    } });
    if (!Array.isArray(window.RJ_MEDIA_TAB_HOOKS)) window.RJ_MEDIA_TAB_HOOKS = [];
    window.RJ_MEDIA_TAB_HOOKS.push({ id: "123-presse", onglet: "presse", apres: function () { setTimeout(injecter, 90); } });
    if (typeof window._rj64Champs === "function") { window._rj64Champs("_rjPresse"); window._rj64Champs("_rjDeclarations"); }
    return true;
  }

  var essais = 0;
  function boot() {
    if (installer()) { console.log(TAG, "actif — médias, revue de presse, interviews, audience"); return; }
    if (essais++ < 80) setTimeout(boot, 150); else console.warn(TAG, "conférences (100) absentes : non installé");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  window._rj123 = { medias: medias, lireDeclarations: lireDeclarations, apresCourse: apresCourse, abonnes: abonnes,
    revue: function () { return P().revue; }, injecter: injecter, LIGNES: LIGNES };
  window._rj123Uninstall = function () {
    window.RACE_POST_HOOKS = (window.RACE_POST_HOOKS || []).filter(function (h) { return h.id !== "123-presse"; });
    window.RJ_MEDIA_TAB_HOOKS = (window.RJ_MEDIA_TAB_HOOKS || []).filter(function (h) { return h.id !== "123-presse"; });
    rjDesinscrire(["123-presse:"], "handleMailAction");
    var b = document.getElementById("rj123-bloc"); if (b) b.remove();
    delete window._rj123;
  };
})();
