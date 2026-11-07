/* =====================================================================
 * 124-messagerie.js — UNE MESSAGERIE DE JEU, PAS UNE PILE DE FORMULAIRES
 *
 * POURQUOI
 * L'audit : 29 messages sur 31 imposaient un choix, rien n'avait d'ordre
 * d'importance, une proposition restait ouverte pour toujours, personne ne
 * répondait jamais à vos réponses, et l'on ne pouvait écrire à personne.
 *
 * CE QUE FAIT LE MODULE
 *  1. Priorités : chaque conversation est « à répondre », « personnel » ou
 *     « info » ; la boîte affiche la pastille et se filtre.
 *  2. Expiration : une proposition sans réponse expire au bout de trois
 *     semaines (jamais une négociation d'écurie) ; l'expéditeur s'en souvient.
 *  3. Conversations : répondre à quelqu'un de votre entourage amène sa
 *     réponse la semaine suivante, selon votre choix et son caractère.
 *  4. Messages sans choix : après chaque course, l'ingénieur de course
 *     débriefe.
 *  5. Écrire : depuis la fiche d'un contact (122), on lui écrit sur un sujet
 *     propre à son rôle ; il répond la semaine suivante.
 *
 * Réversible : window._rj124Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[124-messagerie]";
  var EXPIRATION = 3;          // semaines
  var filtre = "tout";

  function R() { return window._rj101; }
  function etat() { if (!G._rj124) G._rj124 = { attente: [] }; return G._rj124; }
  function hasard(t) { return t[Math.floor(Math.random() * t.length)]; }
  function prenom(n) { return String(n || "").split(" ")[0]; }

  /* ---------------------------------------------------------- priorités --- */
  var PERSONNEL = { family: 1, friends: 1, partner: 1, parents: 1 };
  function priorite(m) {
    if (!m) return "info";
    if (m.actions && m.actions.length && !m.replied) return "urgent";
    return PERSONNEL[m.role] ? "personnel" : "info";
  }
  var LIBELLES = { urgent: "À répondre", personnel: "Personnel", info: "Info" };

  /* --------------------------------------------------------- expiration --- */
  function age(m) { return ((G.saison || 1) - (m.saison || 1)) * 48 + ((G.semaine || 1) - (m.week || 1)); }
  function expirable(m) {
    if (!m || m.replied || !m.actions || !m.actions.length || m.tpApproach || m.rj124Garde) return false;
    return !m.actions.some(function (a) { return a.effect && a.effect.type === "nav"; });
  }
  function expirer() {
    var n = 0;
    (typeof getMailbox === "function" ? getMailbox() : []).forEach(function (m) {
      if (!expirable(m) || age(m) < EXPIRATION) return;
      m.actions.push({ label: "Sans réponse", kind: "dismiss", responseBody: "[Proposition expirée : tu n'as pas répondu à temps.]" });
      m.action_taken = m.actions.length - 1;
      m.replied = true;
      m.rj124Expire = true;
      var c = m.contactKey && G._network && G._network[m.contactKey];
      if (c && R()) R().bouger(c, -2, "Tu n'as jamais répondu à « " + (m.subject || "son message") + " »");
      n++;
    });
    return n;
  }

  /* -------------------------------------------------- envoi d'un contact --- */
  var ROLE_MAIL = { tp: "team_boss", dir_sport: "team", dir_tech: "team", ing_course: "team", agent: "agent",
    journaliste: "journalist", sponsor: "sponsor", pilote: "rival" };

  function ecrireDe(cle, objet, corps, type) {
    var c = G._network && G._network[cle];
    if (!c || typeof pushMail !== "function") return null;
    var avant = getMailbox()[0];
    pushMail({ from: c.name, role: ROLE_MAIL[c.role] || "team", subject: objet, body: corps + "\n\n— " + c.name });
    var m = getMailbox()[0];
    if (!m || m === avant) return null;
    m.contactKey = cle; m.contactName = c.name; m.rj124 = type;
    return m;
  }

  /* ------------------------------------------------- réponses différées --- */
  function texteSuite(c, a) {
    var o = a.objet, t = c.trait;
    if (a.kind === "accept") return hasard(["Merci pour ta réponse au sujet de « " + o + " ». C'est noté, on compte sur toi.",
      "Bien reçu pour « " + o + " ». Ça fait plaisir de voir que tu suis."]) + (t === "chaleureux" ? " Vraiment, merci." : "");
    if (a.kind === "refuse") {
      if (t === "rancunier" || t === "exigeant") return "Pour « " + o + " », j'ai pris note de ton refus. Je m'en souviendrai.";
      if (t === "loyal" || t === "chaleureux") return "Pas de souci pour « " + o + " », ce sera pour une autre fois.";
      return "Dommage pour « " + o + " ». On fera sans.";
    }
    return "Merci pour ton retour sur « " + o + " ».";
  }

  /* Ce que chacun sait, selon son rôle. */
  function nbOffres() { return (G.offers || []).filter(function (o) { return !o.declined && !o.signed; }).length; }
  function derniere() { return (G.races || [])[(G.races || []).length - 1] || null; }
  var SUJETS = {
    agent: [{ id: "marche", lbl: "Où en est mon marché ?", texte: function (c) {
      var n = nbOffres();
      return n ? n + " écurie" + (n > 1 ? "s ont" : " a") + " fait une offre : elles sont dans tes contrats. Ne signe rien sans m'en parler."
        : c.relation >= 60 ? "Pas d'offre ferme, mais ton nom circule. Encore deux ou trois bons résultats et le téléphone sonnera."
        : "Calme plat pour l'instant. Les résultats parleront pour toi.";
    } }],
    tp: [{ id: "avenir", lbl: "Parler de mon avenir", texte: function (c) {
      return c.relation >= 70 ? "Tu fais partie de nos plans. Continue comme ça et on parlera prolongation."
        : c.relation >= 45 ? "Ton avenir ici dépend de la suite de la saison. Rien n'est décidé."
        : "Franchement ? Il va falloir hausser le niveau. Le baquet ne t'appartient pas.";
    } }],
    ing_course: [{ id: "debrief", lbl: "Demander un débrief", texte: function () {
      var r = derniere();
      if (!r) return "Pas encore de course à analyser. On en reparle après le premier week-end.";
      return "Sur " + (r.circuit || "la dernière course") + " : parti P" + (r.qualiPos || "?") + ", arrivé P" + (r.pos || "?") +
        ". " + ((r.qualiPos || 0) > (r.pos || 99) ? "Bonne remontée, ton rythme en course est là." : "La qualif reste la clé : c'est là qu'on peut gagner le plus.");
    } }],
    dir_sport: [{ id: "marche", lbl: "Les rumeurs du paddock", texte: function () {
      return hasard(["Deux écuries regardent les pilotes de ta génération. Reste propre en piste.", "Le marché est calme, mais les décisions se prennent maintenant, pas en fin de saison."]);
    } }],
    dir_tech: [{ id: "voiture", lbl: "Les évolutions à venir", texte: function () {
      return hasard(["Un nouveau fond plat arrive dans quelques manches. Il devrait aider en virage rapide.", "On travaille surtout sur la fiabilité ce mois-ci. Patience."]);
    } }],
    journaliste: [{ id: "rumeur", lbl: "Une rumeur à vérifier ?", texte: function (c) {
      return c.relation >= 55 ? "Entre nous : ton nom revient dans plusieurs rédactions. Fais attention à ce que tu dis en conférence."
        : "Je n'ai rien pour toi pour l'instant. Les infos, ça se mérite.";
    } }],
    sponsor: [{ id: "visibilite", lbl: "Faire le point sur le partenariat", texte: function (c) {
      return c.relation >= 60 ? "Nous sommes ravis de la visibilité. Continuez ainsi !" : "Nous attendons un peu plus de présence sur les réseaux et sur le podium.";
    } }],
    pilote: [{ id: "respect", lbl: "Clarifier un duel en piste", texte: function (c) {
      return c.relation >= 50 ? "Pas de souci, c'était propre. On se bat dur, mais à la régulière." : "Tu m'as serré un peu fort l'autre jour. La prochaine fois, je ne laisse pas de place.";
    } }]
  };
  function sujets(c) { return (c && (SUJETS[c.role] || SUJETS.dir_sport)) || []; }

  function enAttente(cle) { return etat().attente.some(function (a) { return a.cle === cle && a.type === "ecrit"; }); }

  /* Le joueur écrit : la réponse arrive la semaine suivante. */
  function ecrire(cle, sujetId) {
    var c = G._network && G._network[cle];
    if (!c || enAttente(cle)) return false;
    var s = sujets(c).filter(function (x) { return x.id === sujetId; })[0] || sujets(c)[0];
    if (!s) return false;
    etat().attente.push({ cle: cle, ticks: 1, type: "ecrit", sujet: s.id, objet: s.lbl });
    c.interactions = (c.interactions || 0) + 1;
    if (R()) R().noter(c, "Tu lui as écrit : « " + s.lbl + " »", 0);
    return true;
  }

  function livrer(a) {
    var c = G._network && G._network[a.cle];
    if (!c) return;
    if (a.type === "ecrit") {
      var s = sujets(c).filter(function (x) { return x.id === a.sujet; })[0];
      ecrireDe(a.cle, "Re : " + a.objet, s ? s.texte(c) : "Bien reçu, je reviens vers toi.", "reponse");
      if (R()) R().bouger(c, 1, "Il t'a répondu : « " + a.objet + " »");
    } else {
      ecrireDe(a.cle, "Re : " + a.objet, texteSuite(c, a), "suite");
    }
  }

  function tick(n) {
    expirer();
    var e = etat(), garder = [];
    e.attente.forEach(function (a) {
      a.ticks -= (n || 1);
      if (a.ticks <= 0) { try { livrer(a); } catch (err) { console.warn(TAG, "livraison :", err && err.message); } }
      else garder.push(a);
    });
    e.attente = garder;
  }

  /* ------------------------------------------------- débrief de course --- */
  function debrief() {
    var r = derniere();
    if (!r || !R()) return null;
    var ing = R().tous().filter(function (c) { return c.role === "ing_course" && c.team === G.currentTeam; })[0];
    if (!ing) return null;
    var cle = Object.keys(G._network).filter(function (k) { return G._network[k] === ing; })[0];
    var lieu = r.circuit || r.nom || "la course", gain = (r.qualiPos || 0) - (r.pos || 0), corps;
    if (!r.pos || r.dnf) corps = "Course terminée trop tôt à " + lieu + ". On démonte tout pour comprendre, je te tiens au courant.";
    else corps = "P" + r.pos + " à " + lieu + (r.qualiPos ? ", parti P" + r.qualiPos : "") + ". " +
      (gain > 2 ? "Belle remontée : ton rythme en course est vraiment bon." : gain < -2 ? "On a perdu des places en course, on regarde la gestion des pneus." : "Course propre, sans surprise.") +
      (r.tmPos ? " Ton coéquipier finit P" + r.tmPos + "." : "");
    var m = ecrireDe(cle, "Débrief — " + lieu, corps, "debrief");
    if (m) m.read = false;
    return m;
  }

  /* ------------------------------------------------------- boîte : UI --- */
  function habiller() {
    var liste = document.getElementById("mailbox-list");
    if (!liste || typeof _getMailThreads !== "function") return;
    var cartes = [].slice.call(liste.querySelectorAll("[onclick^=\"openMailThread(\"]"));
    if (!cartes.length) return;
    var fils = {};
    _getMailThreads().forEach(function (t) {
      var p = t.messages.some(function (m) { return priorite(m) === "urgent"; }) ? "urgent" : priorite(t.lastMail);
      fils[t.key] = { p: p, exp: t.messages.filter(expirable).map(function (m) { return EXPIRATION - age(m); }).sort()[0] };
    });
    cartes.forEach(function (carte) {
      var cle = (carte.getAttribute("onclick").match(/openMailThread\('(.*)'\)/) || [])[1];
      var f = fils[cle] || { p: "info" };
      carte.setAttribute("data-rj124", f.p);
      if (!carte.querySelector(".rj124-prio")) {
        var b = document.createElement("span");
        b.className = "rj124-prio rj124-" + f.p;
        b.textContent = LIBELLES[f.p] + (f.p === "urgent" && f.exp != null ? " · " + (f.exp <= 1 ? "expire bientôt" : f.exp + " sem.") : "");
        carte.appendChild(b);
      }
      carte.style.display = filtre === "tout" || filtre === f.p ? "" : "none";
    });
    if (!liste.querySelector(".rj124-filtres")) {
      var barre = document.createElement("div");
      barre.className = "rj124-filtres";
      barre.innerHTML = [["tout", "Tout"], ["urgent", "À répondre"], ["personnel", "Personnel"], ["info", "Infos"]].map(function (x) {
        return '<button type="button" class="rj124-filtre' + (filtre === x[0] ? " on" : "") + '" data-f="' + x[0] + '">' + x[1] + "</button>";
      }).join("");
      barre.addEventListener("click", function (e) {
        var b = e.target.closest && e.target.closest("[data-f]");
        if (!b) return;
        filtre = b.getAttribute("data-f");
        [].slice.call(barre.children).forEach(function (x) { x.classList.toggle("on", x === b); });
        habiller();
      });
      var tete = liste.firstElementChild;
      liste.insertBefore(barre, tete ? tete.nextSibling : null);
    }
  }

  /* -------------------------------------------------------- installation --- */
  function installer() {
    if (!R() || typeof rjInscrire !== "function" || !Array.isArray(window.WEEKLY_TICK_HOOKS) || !Array.isArray(window.RACE_POST_HOOKS)) return false;
    window.WEEKLY_TICK_HOOKS.push({ id: "124-messagerie", run: tick });
    window.RACE_POST_HOOKS.push({ id: "124-messagerie", run: function () { try { debrief(); } catch (e) { console.warn(TAG, "débrief :", e && e.message); } } });
    rjInscrire("handleMailAction", { id: "124-messagerie:handleMailAction", apres: function (res, args) {
      var m = getMailbox().filter(function (x) { return x.id === args[0]; })[0];
      var a = m && m.actions && m.actions[args[1]];
      if (!m || !a || !m.contactKey || m.rj124 || m.rj123 || a.kind === "dismiss") return;
      etat().attente.push({ cle: m.contactKey, ticks: 1, type: "suite", objet: m.subject || "ton message", kind: a.kind });
    } });
    rjInscrire("renderMailbox", { id: "124-messagerie:renderMailbox", apres: function () { habiller(); } });
    if (typeof window._rj64Champs === "function") window._rj64Champs("_rj124");
    return true;
  }

  var essais = 0;
  function boot() {
    if (installer()) { console.log(TAG, "actif — priorités, expiration, réponses, débrief, écrire"); return; }
    if (essais++ < 80) setTimeout(boot, 150); else console.warn(TAG, "réseau (101) absent : non installé");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  window._rj124 = { priorite: priorite, expirer: expirer, tick: tick, ecrire: ecrire, sujets: sujets, enAttente: enAttente, debrief: debrief };
  window._rj124Uninstall = function () {
    window.WEEKLY_TICK_HOOKS = (window.WEEKLY_TICK_HOOKS || []).filter(function (h) { return h.id !== "124-messagerie"; });
    window.RACE_POST_HOOKS = (window.RACE_POST_HOOKS || []).filter(function (h) { return h.id !== "124-messagerie"; });
    rjDesinscrire(["124-messagerie:"]);
    delete window._rj124;
  };
})();
