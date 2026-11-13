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
 *  7. Volume : délai entre deux messages d'un même expéditeur secondaire,
 *     pas de redite d'un sujet avant six mois, boîte pleine qui garde les
 *     décisions en attente.
 *  6. Pas de faux choix : un seul bouton sans effet (« Compris ») fait une
 *     info ; un seul bouton à petit effet s'applique à la réception.
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

  /* ------------------------------------------------------ faux choix --- */
  /* Mesuré sur 8 manches : la moitié des messages « à choix » n'offraient
     qu'un bouton — « Compris », « Merci » — sans effet, ou avec un effet
     minime. Ce n'est pas une décision : sans effet, le message devient une
     info ; avec un petit effet, il s'applique à la réception. Les vrais
     choix, les liens vers un écran et les drapeaux restent. */
  var EFFETS_AUTO = { happiness: 1, mental: 1, rep: 1, trust: 1 };
  function sansFauxChoix(o) {
    var a = o && o.actions;
    if (!a || a.length !== 1 || a[0].followUp || a[0].kind === "nav") return;
    var e = a[0].effect;
    if (e && !EFFETS_AUTO[e.type]) return;
    if (e) { try { applyMailEffect(e); } catch (err) { console.warn(TAG, "effet :", err && err.message); } }
    o.actions = null;
  }

  /* ------------------------------------------------- volume et redites --- */
  /* Mesuré sur 8 manches : 40 messages, la boîte pleine qui efface les plus
     anciens, et les mêmes sollicitations deux fois (« Alors, on se couche ? »).
     Les expéditeurs secondaires ont un délai entre deux messages, un même
     sujet ne revient pas avant six mois de jeu, et une boîte pleine efface
     d'abord les infos lues, jamais une décision en attente. */
  /* Mesuré sur une saison de karting (v279) : 48 messages en 6 courses, dont
     les félicitations de quatre expéditeurs pour une même victoire, une
     interview et une note technique à chaque course. Les félicitations, tous
     expéditeurs confondus, ne reviennent qu'au bout de six semaines, les
     interviews et notes techniques aussi, comme les messages des amis et de
     la famille. Un message qui propose un vrai choix passe toujours, sauf
     interviews et félicitations, qui reviennent à chaque course. */
  var DELAI = { fans: 5, promoter: 4, rival: 3, press: 3, journalist: 3, palier: 4, agent: 3, sponsor: 4,
    friends: 6, family: 6, felicitations: 6, interview: 6, technique: 6 };
  var REDITE = 24, BOITE = 38;
  var FELICITATIONS = /gagn|victoire|on a tout vu|change tout|jour parfait|podium|bravo|félicitation|fier de toi/i;
  function semAbs() { return (G.saison || 1) * 48 + (G.semaine || 1); }
  function famille(o) {
    var sujet = o.subject || "";
    if (/^Re :/.test(sujet)) return null;
    // interviews, félicitations et notes techniques reviennent à chaque course, réponses à choix ou non
    if (/^Interview d'après-course/.test(sujet)) return "interview";
    if (/^(friends|family|fans|agent|promoter|sponsor)$/.test(o.role || "") && FELICITATIONS.test(sujet)) return "felicitations";
    if (/^(team|team_boss)$/.test(o.role || "") && /note technique|détail technique/i.test(sujet)) return "technique";
    if (o.actions && o.actions.length > 1) return null;                      // une vraie décision passe toujours
    if (/^Le point sur le marché/.test(sujet)) return null;                  // deux fois par saison (116) : jamais jeté
    if (o.role === "agent" && /\(\d+\/100\)\s*$/.test(sujet)) return "palier";
    return DELAI[o.role] ? o.role : null;
  }
  function deTrop(o) {
    var fam = o && famille(o);
    if (!fam) return false;
    var v = etat().vol || (etat().vol = { roles: {}, sujets: {} }), now = semAbs();
    var cle = o.role + "|" + o.subject;
    if (v.sujets[cle] != null && now - v.sujets[cle] < REDITE) return true;
    if (v.roles[fam] != null && now - v.roles[fam] < DELAI[fam]) return true;
    v.sujets[cle] = now; v.roles[fam] = now;
    return false;
  }
  function faireDeLaPlace() {
    var b = getMailbox();
    for (var passe = 0; passe < 2 && b.length > BOITE; passe++) {
      for (var i = b.length - 1; i >= 0 && b.length > BOITE; i--) {
        if (priorite(b[i]) !== "urgent" && (passe || b[i].read)) b.splice(i, 1);
      }
    }
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
  /* v289 : de la matière aux échanges — deux ou trois sujets par contact,
     chaque réponse tirée de ta situation réelle (contrat, résultats,
     réglages, prochain circuit, réputation), au lieu d'un sujet unique. */
  function prochaine() { try { return typeof getNextRace === "function" ? getNextRace() : null; } catch (e) { return null; } }
  function semainesContrat() { return typeof G.contractWeeksLeft === "number" ? G.contractWeeksLeft : 48 * (G.contractDur || 0); }
  function ajouter(role, s) { (SUJETS[role] = SUJETS[role] || []).push(s); }
  ajouter("agent", { id: "contrat", lbl: "Et mon contrat ?", texte: function () {
    var sem = semainesContrat();
    if (!G.currentTeam || G.currentTeam === "Indépendant") return "Tu roules en indépendant : chaque bon résultat est une carte de visite. Je fais le tour des écuries.";
    return sem <= 12 ? "Ton contrat avec " + G.currentTeam + " se termine dans " + sem + " semaines. Il faut décider vite : prolonger ou regarder ailleurs."
      : "Tu es tranquille chez " + G.currentTeam + " pour encore " + Math.round(sem / 4) + " mois. Profites-en pour marquer des points, c'est ce qui fera monter ton prochain salaire.";
  } });
  ajouter("agent", { id: "sponsors", lbl: "Des sponsors en vue ?", texte: function () {
    var n = (G.sponsors || []).length, o = (G.sponsorOffers || []).length;
    return o ? o + " marque" + (o > 1 ? "s ont" : " a") + " fait une proposition : regarde dans Sponsors. " + (n ? "Tu en as déjà " + n + ", ne surcharge pas ta combinaison." : "Ce serait ton premier partenaire.")
      : "Rien de concret. Les marques suivent les podiums et la presse : soigne tes interviews.";
  } });
  ajouter("tp", { id: "attentes", lbl: "Qu'attendez-vous de moi ?", texte: function () {
    var p = G.champPos || 0;
    return !p ? "Des points dès les premières manches, et zéro casse." : p <= 3 ? "Tu es P" + p + " au championnat : on veut le titre, rien de moins." : p <= 8 ? "P" + p + ", c'est correct, mais l'objectif est le top 3. Trouve deux ou trois dixièmes en qualif." : "P" + p + " au championnat, ce n'est pas ce qu'on attendait. Il faut des résultats, vite.";
  } });
  ajouter("tp", { id: "coequipier", lbl: "Et face à mon coéquipier ?", texte: function () {
    var r = derniere();
    if (!r || !r.tmPos) return "On en reparlera après quelques courses. Pour l'instant, vous êtes à égalité.";
    return (r.pos && r.pos < r.tmPos ? "Tu l'as battu à " + (r.circuit || "la dernière course") + " (P" + r.pos + " contre P" + r.tmPos + "). Continue, c'est comme ça qu'on devient numéro un."
      : "Il t'a devancé à " + (r.circuit || "la dernière course") + " (P" + r.tmPos + " contre P" + (r.pos || "?") + "). Dans ce sport, ton premier adversaire, c'est lui.");
  } });
  ajouter("ing_course", { id: "reglages", lbl: "Où en sont mes réglages ?", texte: function () {
    var conf = window.RJAtelier && typeof RJAtelier.confiance === "function" ? RJAtelier.confiance() : null;
    var conseil = window.RJAtelier && typeof RJAtelier.conseil === "function" ? RJAtelier.conseil() : "";
    return (conf === null ? "On n'a pas encore roulé ce week-end. " : "Ta confiance dans la voiture est à " + conf + " %. ") + (conseil || "Roule aux essais, je te dirai quoi changer.");
  } });
  ajouter("ing_course", { id: "prochain", lbl: "Le prochain circuit", texte: function () {
    var n = prochaine(), d = n && typeof getCircuitData === "function" ? getCircuitData(n.name) : null, t = d && d.type;
    if (!n) return "Plus de course cette saison. On prépare déjà la suivante.";
    return n.name + " : " + (t === "street" ? "circuit en ville, des murs partout. Suspension souple, freins stables, et pas d'erreur." : t === "highspeed" ? "circuit rapide : on retire de l'aileron, la vitesse de pointe fera la différence." : t === "technical" ? "tracé technique : on charge l'appui, l'équilibre fera le chrono." : "un tracé complet, on part d'un réglage équilibré.");
  } });
  ajouter("journaliste", { id: "image", lbl: "Que dit-on de moi ?", texte: function () {
    var r = G.rep || {}, med = Math.round(r.medias || 0), pub = Math.round(r.public || 0);
    return (med >= 60 ? "Les rédactions te suivent de près. " : med >= 35 ? "On commence à parler de toi dans la presse spécialisée. " : "Franchement, peu de gens te connaissent encore. ") +
      (pub >= 55 ? "Et le public t'adore." : pub >= 30 ? "Le public découvre ton nom." : "Le grand public, lui, attend un coup d'éclat.");
  } });
  ajouter("sponsor", { id: "bonus", lbl: "Un bonus possible ?", texte: function () {
    var pod = (G.races || []).filter(function (x) { return x && x.pos && x.pos <= 3; }).length;
    return pod ? pod + " podium" + (pod > 1 ? "s" : "") + " cette saison : notre direction est ravie. Un prochain podium déclenchera la prime prévue." : "Un premier podium déclencherait la prime prévue au contrat. Nous comptons sur vous.";
  } });
  ajouter("pilote", { id: "championnat", lbl: "Parler du championnat", texte: function (c) {
    var riv = (G.rivals || []).filter(function (x) { return x && c && x.name === c.name; })[0];
    if (!riv) return "On se reverra en piste. Le classement, on le regardera à la fin.";
    var d = (G.champPts || 0) - (riv.pts || 0);
    return d > 0 ? "Tu as " + d + " points d'avance sur moi. Profite, ça ne va pas durer." : d < 0 ? "J'ai " + (-d) + " points d'avance. Il va falloir faire mieux que ça." : "On est à égalité de points. Le prochain qui craque perd.";
  } });
  ajouter("dir_sport", { id: "strategie", lbl: "La stratégie de l'équipe", texte: function () {
    var n = prochaine();
    return "Pour " + (n ? n.name : "la prochaine course") + ", priorité aux points. On ne prend pas de risque au départ, on attaque en fin de course.";
  } });
  ajouter("dir_tech", { id: "fiabilite", lbl: "La fiabilité de la voiture", texte: function () {
    var ab = (G.races || []).filter(function (x) { return x && x.dnf; }).length;
    return ab ? ab + " abandon" + (ab > 1 ? "s" : "") + " cette saison : on a changé les pièces en cause. Ça ne doit plus arriver." : "Aucun abandon cette saison : la voiture tient. On garde la même base.";
  } });

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
    var lieu = r.circuit || r.nom || "la course", gain = r.qualiPos ? r.qualiPos - (r.pos || 0) : 0, corps;
    /* Un débrief par course doublait le courrier : l'ingénieur n'écrit
       qu'après une course qui compte (podium, abandon, trois places
       gagnées ou perdues). Sans place de départ connue, pas de comparaison. */
    var marquante = !r.pos || r.dnf || r.pos <= 3 || Math.abs(gain) >= 3;
    if (!marquante) return null;
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
    /* Couleur de l'expéditeur, reprise par l'habillage (paysage.css). */
    var couleur = function (role) { return (window.MAIL_SENDERS && MAIL_SENDERS[role] && MAIL_SENDERS[role].color) || "#60A5FA"; };
    liste.classList.toggle("rj124-fil", !!window._MAIL_OPEN_THREAD);
    if (window._MAIL_OPEN_THREAD) liste.style.setProperty("--t", couleur(String(_MAIL_OPEN_THREAD).split("::")[0]));
    var cartes = [].slice.call(liste.querySelectorAll("[onclick^=\"openMailThread(\"]"));
    if (!cartes.length) return;
    var fils = {};
    _getMailThreads().forEach(function (t) {
      var p = t.messages.some(function (m) { return priorite(m) === "urgent"; }) ? "urgent" : priorite(t.lastMail);
      fils[t.key] = { role: t.role, p: p, exp: t.messages.filter(expirable).map(function (m) { return EXPIRATION - age(m); }).sort()[0] };
    });
    cartes.forEach(function (carte) {
      var cle = (carte.getAttribute("onclick").match(/openMailThread\('(.*)'\)/) || [])[1];
      var f = fils[cle] || { p: "info" };
      carte.setAttribute("data-rj124", f.p);
      carte.classList.add("rj124-carte");
      carte.style.setProperty("--t", couleur(f.role));
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

  /* ------------------------------------- notifications au bon moment --- */
  /* Le filtre de 40 (« les nouveaux messages attendent le retour sur
     l'accueil ») les abandonnait en réalité : un message reçu pendant le
     week-end n'était jamais signalé. Ici, une vraie file : pendant la course,
     la conférence de presse ou un événement, les notifications attendent, et
     s'affichent à la sortie, les messages regroupés en une seule. Dans la
     messagerie, inutile de signaler un message qu'on a sous les yeux. */
  var CALMES = { "S-race": 1, "S-mediaday": 1, "S-event": 1, "S-season-end": 1, "S-create": 1 };
  var file = { messages: [], couleur: null, autres: [] };
  function ecran() { var e = document.querySelector(".scr.on"); return e ? e.id : ""; }
  /* Ailleurs aussi, une seule notification pour les messages : ceux qui
     arrivent ensemble (fin de course, nouvelle semaine) sont regroupés après
     un court délai, au lieu d'une notification chacun. */
  var minuterie = null;
  function filtreFile(label, texte, couleur) {
    var id = ecran();
    if (label === "Nouveau message") {
      if (id === "S-mailbox") return false;
      file.messages.push(texte); file.couleur = couleur;
      if (!CALMES[id]) {
        clearTimeout(minuterie);
        minuterie = setTimeout(function () { viderFile(ecran()); }, 900);
      }
      return false;
    }
    if (CALMES[id]) { if (file.autres.length < 6) file.autres.push([label, texte, couleur]); return false; }
  }
  function viderFile(id) {
    if (CALMES[id] || typeof _pushHomeToastCoeur !== "function") return;
    var n = file.messages.length, a = file.autres.splice(0, 3);
    if (id === "S-mailbox") n = 0;
    if (n === 1) a.unshift(["Nouveau message", file.messages[0], file.couleur]);
    else if (n > 1) a.unshift(["Messagerie", n + " nouveaux messages à lire", file.couleur]);
    file.messages = []; file.autres = [];
    a.forEach(function (x, i) { setTimeout(function () { _pushHomeToastCoeur(x[0], x[1], x[2]); }, 350 + i * 700); });
  }

  /* ------------------------------------------ un contact = un fil (v289) ---
     Un même interlocuteur écrivait sous plusieurs noms : « Tes parents » et
     « Maman », « Williams » et « Williams — Direction sportive », « Salle de
     presse » et « Service de presse », « Tes amis » et « Tes potes ». Chaque
     variante ouvrait un fil (rôle::expéditeur) : doublons dans la boîte. */
  function cleCanonique(m) {
    var de = String(m.from || ""), role = m.role || "x";
    if (role === "family" && /parents|maman|papa|m[èe]re|p[èe]re/i.test(de)) return "family::Tes parents";
    if (role === "friends") return "friends::Tes potes";
    if (role === "team_boss") {
      var equipe = de.split(/\s+[—-]\s+/)[0].trim();
      if (equipe && (equipe === G.currentTeam || (window.TEAM_LOGOS && TEAM_LOGOS[equipe]))) return "team_boss::" + equipe + " — Direction sportive";
    }
    if ((role === "press" || role === "journalist") && /salle de presse|service de presse/i.test(de)) return "press::Service de presse";
    return null;
  }

  /* --- Les écuries et les académies écrivent avec leur logo, pas un visage --- */
  function logoMail(m, t) {
    // « Williams » ou « Williams — Bureau d'études » : l'écurie elle-même ; une personne (« Erik Karlsson ») n'est pas une écurie
    var de = String((m && m.from) || ""), equipe = de.split(/\s+[—-]\s+/)[0].trim();
    var svg = window.TEAM_LOGOS && TEAM_LOGOS[equipe];
    if (svg) return '<div class="rj124-logo" style="width:' + t + "px;height:" + t + 'px">' + svg + "</div>";
    var acad = window.ACADEMIES && ACADEMIES[de];
    if (acad && typeof acadLogoHtml === "function") return acadLogoHtml(acad, t);
    return null;
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
      /* v289 : plus de « Merci pour ta réponse » la semaine suivante — ces
         accusés de réception remplissaient la boîte sans rien raconter. Seul
         un refus noté par un contact rancunier ou exigeant revient (il a une
         conséquence sur la relation). */
      var c = G._network && G._network[m.contactKey];
      if (!(a.kind === "refuse" && c && (c.trait === "rancunier" || c.trait === "exigeant"))) return;
      etat().attente.push({ cle: m.contactKey, ticks: 1, type: "suite", objet: m.subject || "ton message", kind: a.kind });
    } });
    /* Plus intérieur que 62 (-5100) : un message que 62 bloque comme doublon n'applique pas son effet. */
    rjInscrire("pushMail", { id: "124-messagerie:pushMail", ordre: 0, remplace: function (args, suite) {
      if (args[0] && /^Merci d.avoir/i.test(args[0].subject || "")) return null;   // v289 : pas de remerciements automatiques
      if (deTrop(args[0])) return null;
      faireDeLaPlace();
      sansFauxChoix(args[0]);
      return suite();
    } });
    rjInscrire("renderMailbox", { id: "124-messagerie:renderMailbox", apres: function () { habiller(); } });
    rjInscrire("_renderMailAvatar", { id: "124-messagerie:logo", ordre: -200, remplace: function (args, suite) {
      var h = null; try { h = logoMail(args[0], args[1] || 40); } catch (e) {} return h || suite();
    } });
    if (typeof window._mailThreadKey === "function" && !window._mailThreadKey._rj124) {
      var cleOrigine = window._mailThreadKey;
      window._mailThreadKey = function (m) { return (m && cleCanonique(m)) || cleOrigine(m); };
      window._mailThreadKey._rj124 = true;
    }
    /* Les messages courts (showToast : « Pas assez de PA »…) avaient leur propre
       fenêtre, posée par-dessus la pile des notifications : ils rejoignent la
       pile, en haut de l'écran, sans passer par les filtres (réponse immédiate
       à une action du joueur). */
    if (typeof _pushHomeToastCoeur === "function") rjInscrire("showToast", { id: "124-messagerie:showToast", remplace: function (args) {
      _pushHomeToastCoeur("", String(args[0] == null ? "" : args[0]), "#FF1801");
    } });
    if (!Array.isArray(window.RJ_TOAST_FILTERS)) window.RJ_TOAST_FILTERS = [];
    window.RJ_TOAST_FILTERS = window.RJ_TOAST_FILTERS.filter(function (f) { return f && f.id !== "42-weekend-entry"; });
    if (window.pushHomeToast) window.pushHomeToast._rjMsgGate = true;   // 40 ne réinstalle pas son filtre
    window.RJ_TOAST_FILTERS.unshift({ id: "124-file", filtre: filtreFile });
    if (!Array.isArray(window.RJ_SCREEN_HOOKS)) window.RJ_SCREEN_HOOKS = [];
    window.RJ_SCREEN_HOOKS.push({ id: "124-file", ecran: "*", apres: viderFile });
    if (typeof window._rj64Champs === "function") window._rj64Champs("_rj124");
    return true;
  }

  var essais = 0;
  function boot() {
    if (installer()) { console.log(TAG, "actif — priorités, expiration, réponses, débrief, écrire"); return; }
    if (essais++ < 80) setTimeout(boot, 150); else console.warn(TAG, "réseau (101) absent : non installé");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  window._rj124 = { file: file, viderFile: viderFile, deTrop: deTrop, sansFauxChoix: sansFauxChoix, priorite: priorite, expirer: expirer, tick: tick, ecrire: ecrire, sujets: sujets, enAttente: enAttente, debrief: debrief };
  window._rj124Uninstall = function () {
    window.WEEKLY_TICK_HOOKS = (window.WEEKLY_TICK_HOOKS || []).filter(function (h) { return h.id !== "124-messagerie"; });
    window.RACE_POST_HOOKS = (window.RACE_POST_HOOKS || []).filter(function (h) { return h.id !== "124-messagerie"; });
    rjDesinscrire(["124-messagerie:"]);
    delete window._rj124;
  };
})();
