/* =====================================================================
 * 62-mail-overhaul.js — MESSAGERIE : IDENTITÉ, VARIÉTÉ, NOUVEAUX CONTACTS
 *
 * AUDIT (mesuré sur 12 courses simulées, 9 messages générés) :
 *
 *  1. AUCUNE IDENTITÉ VISUELLE — la table MAIL_SENDERS prévoit une icône par
 *     expéditeur, mais toutes valent "" dans la source (celle de l'agent
 *     n'est qu'un caractère invisible résiduel). La liste des conversations
 *     ne contient d'ailleurs aucun SVG : que du texte.
 *
 *  2. FILS ÉCLATÉS — la clé de conversation est « rôle::expéditeur ». Or les
 *     fans et les journalistes ont un nom tiré au hasard à chaque envoi
 *     (« Lucas (Fan #4821) », journalistes nommés). Trois demandes
 *     d'interview = trois conversations distinctes. Mesuré : 7 conversations
 *     pour 9 messages.
 *
 *  3. TEXTES FIGÉS — chaque situation a UN seul texte. Gagner deux courses
 *     produit deux fois le même message, au mot près.
 *
 *  4. QUATRE EXPÉDITEURS MUETS — promoter, press, friends et team sont
 *     définis (nom, couleur) mais n'envoient jamais rien.
 *
 * CE MODULE :
 *  - donne une icône et une couleur à chaque expéditeur ;
 *  - regroupe fans et presse dans une conversation stable ;
 *  - fait tourner des variantes de texte et bloque les répétitions proches ;
 *  - fait vivre les quatre expéditeurs muets, avec des délais de repos pour
 *    ne pas saturer la boîte.
 *
 * Le volume global reste comparable (~1 message par course) : le problème
 * n'était pas la quantité mais le manque de variété.
 *
 * Réversible : window._rj62Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var wrapped = {};

  /* ------------------------------------------------- 1. identité visuelle */
  var ICONES = {
    agent: "msg_agent", team_boss: "msg_ecurie", sponsor: "msg_sponsor",
    academy: "academie_dispo", journalist: "msg_presse", rival: "rival",
    fans: "public", promoter: "championnat", press: "conference_presse",
    family: "famille", friends: "allie", team: "constructeur"
  };

  function couleurRole(role) {
    try {
      if (typeof MAIL_SENDERS !== "undefined" && MAIL_SENDERS[role] && MAIL_SENDERS[role].color) {
        return MAIL_SENDERS[role].color;
      }
    } catch (e) {}
    return "#60A5FA";
  }

  function iconeHTML(role, taille) {
    try {
      if (typeof renderIcon === "function") {
        return renderIcon(ICONES[role] || "messages", taille || 18, couleurRole(role));
      }
    } catch (e) {}
    return "";
  }

  // La liste des conversations n'affiche qu'un avatar texte : on y place
  // l'icône du rôle, lisible d'un coup d'œil.
  function habillerListe() {
    var list = document.getElementById("mailbox-list");
    if (!list) return;
    var lignes = list.querySelectorAll('[onclick*="openMailThread"]');
    for (var i = 0; i < lignes.length; i++) {
      var l = lignes[i];
      if (l.getAttribute("data-rj62")) continue;
      var oc = l.getAttribute("onclick") || "";
      var m = oc.match(/openMailThread\('([^:]+)::/);
      if (!m) continue;
      var role = m[1];
      var av = l.firstElementChild;
      if (!av) continue;
      l.setAttribute("data-rj62", "1");
      var col = couleurRole(role);
      av.innerHTML = iconeHTML(role, 18);
      av.style.display = "flex";
      av.style.alignItems = "center";
      av.style.justifyContent = "center";
      av.style.background = col + "1F";
      av.style.border = "1px solid " + col + "44";
      av.style.color = col;
    }
  }

  /* --------------------------------------------- 2. conversations stables */
  // Les expéditeurs « de masse » sont regroupés : le nom de la personne
  // reste visible dans le corps du message, mais le fil ne se démultiplie plus.
  function stabiliserExpediteur(m) {
    if (!m) return m;
    if (m.role === "fans") {
      var nom = m.from && !/tribune/i.test(m.from) ? m.from : null;
      if (nom && m.body && m.body.indexOf(nom) < 0) m.body = nom + " — " + m.body;
      m.from = "Tribune des fans";
    } else if (m.role === "journalist") {
      // on garde le média s'il est identifiable, sinon un fil unique
      var media = null;
      var par = (m.from || "").match(/\(([^)]+)\)\s*$/);
      if (par) media = par[1];
      else if (/insider|news|presse|magazine|tv|radio/i.test(m.from || "")) media = m.from;
      if (!media) {
        if (m.from && m.body && m.body.indexOf(m.from) < 0) m.body = m.from + " — " + m.body;
        m.from = "Salle de presse";
      } else if (m.from !== media) {
        if (m.body && m.body.indexOf(m.from) < 0) m.body = m.from + " — " + m.body;
        m.from = media;
      }
    }
    return m;
  }

  /* ------------------------------------ 3. variantes et anti-répétition */
  // Variantes de corps pour les messages les plus fréquents. La clé est un
  // extrait du sujet d'origine ; on remplace le corps par une variante non
  // utilisée récemment.
  var VARIANTES = {
    "Cette victoire change tout": [
      "Belle victoire. Mon téléphone n'arrête pas depuis l'arrivée — deux écuries veulent déjà savoir quand ton contrat se termine. On en parle calmement, mais garde ça en tête.",
      "Bravo. Ce genre de résultat, ça déplace des lignes dans le paddock. Je fais le tri dans les appels, je te donne les sérieux au prochain point.",
      "Victoire notée par tout le monde. On ne s'emballe pas, mais ta valeur vient de monter d'un cran. Continue exactement comme ça."
    ],
    "On en parle ?": [
      "Week-end compliqué. Deux journalistes m'ont déjà appelé pour avoir ta réaction — je préfère qu'on cale ta réponse ensemble avant que tu parles.",
      "Ça n'a pas tourné comme prévu. Ce n'est pas dramatique, mais il faut qu'on soigne la communication cette semaine. Appelle-moi.",
      "Course à oublier. L'important maintenant c'est ce que tu dis dans les prochains jours. On en discute rapidement ?"
    ],
    "On garde le cap": [
      "Résultat en demi-teinte. Le championnat est long, et j'ai vu des saisons se retourner sur trois courses. On reste sur le plan.",
      "Rien d'alarmant ce week-end. On note ce qui a manqué et on avance — inutile de tout remettre en cause.",
      "Pas le résultat espéré, mais la trajectoire reste bonne. Garde la tête froide, c'est là que ça se joue."
    ],
    "Excellent travail": [
      "Superbe course. Toute l'équipe a vu le travail — les mécanos sont les premiers à le dire. On continue sur cette lancée.",
      "Victoire méritée. C'est exactement ce qu'on attendait en te faisant confiance. Bravo.",
      "Beau week-end. Les ingénieurs sont ravis des retours que tu leur as faits, ça se sent dans la voiture."
    ],
    "Un podium qui fait plaisir": [
      "Bon podium. On sait tous qu'il manquait peu de chose pour mieux — on va chercher ça ensemble.",
      "Podium solide, dans une course qui n'était pas simple. L'équipe apprécie la propreté de ta course.",
      "Joli résultat. On prend les points, et on regarde ce qui nous sépare encore de la victoire."
    ],
    "Note technique": [
      "Les données de la dernière course sont dépouillées. Rien d'alarmant, mais tes retours sur le train avant nous seraient utiles avant la prochaine séance de réglages.",
      "On a comparé tes tours rapides avec ceux de ton coéquipier : l'écart se fait en entrée de virage lent. Rien d'inquiétant, mais on aimerait ton ressenti.",
      "Le bureau d'études prépare une évolution aéro pour dans deux courses. Ton avis sur la stabilité actuelle nous aiderait à orienter le travail.",
      "Relevés de température pneus analysés : l'arrière travaille un peu trop. Dis-nous si tu le sens en piste, on ajustera les réglages de départ."
    ],
    "Bienvenue pour la saison": [
      "Le plateau est complet et le calendrier officiel est publié. Bonne saison à toi — le championnat s'annonce disputé cette année.",
      "Les engagements sont clos. Belle grille cette année, avec plusieurs nouveaux venus ambitieux. Bonne saison.",
      "Calendrier validé et règlement technique publié. Nous te souhaitons une excellente saison."
    ],
    "Mi-championnat": [
      "Nous voilà à mi-parcours. La seconde partie de saison est souvent celle qui départage — bonne continuation.",
      "Le championnat a passé sa moitié. Historiquement, c'est sur ces dernières manches que les titres se jouent.",
      "Point d'étape à mi-saison. Les écarts sont encore réversibles, tout reste ouvert."
    ],
    "TU AS GAGNÉ": [
      "On était devant l'écran, on a hurlé. Sérieusement, bravo. On fête ça quand tu rentres ?",
      "On a suivi la fin de course debout dans le salon. Énorme. Tu nous dois un repas.",
      "Première réaction du groupe : cris. Deuxième : fierté. Bravo, vraiment."
    ],
    "On pense à toi": [
      "On a suivi les dernières courses. Pas terrible, hein. Si tu veux décrocher un soir, on est là — parfois ça fait plus de bien qu'une séance de simulateur.",
      "Série compliquée en ce moment. On ne comprend pas tout à la technique, mais on sait reconnaître quelqu'un qui encaisse. On est là si besoin.",
      "Passe nous voir quand tu veux. Pas pour parler course — juste pour souffler."
    ],
    "Proposition de portrait": [
      "Ta notoriété a franchi un cap. Un média souhaite te consacrer un portrait long format. C'est du temps, mais c'est de l'exposition durable.",
      "Une rédaction prépare une série sur les pilotes qui montent et veut t'y consacrer un chapitre. Bonne visibilité, engagement raisonnable.",
      "Demande reçue pour un portrait vidéo : une journée de tournage, diffusion large. À toi de voir si le calendrier le permet."
    ],
    "Opportunité commerciale": [
      "Votre pilotage attire l'attention. Nous proposons une journée de tournage et deux publications sponsorisées. Rémunération : 5 000 €. Intéressé ?",
      "Nous suivons votre progression avec attention et souhaitons vous associer à notre prochaine campagne. Séance photo et contenu réseaux, 5 000 €.",
      "Votre visibilité correspond à ce que nous cherchons. Un partenariat ponctuel vous tenterait-il ? Shooting et posts sponsorisés, 5 000 €."
    ]
  };

  function journal() {
    if (typeof G === "undefined" || !G) return {};
    if (!G._rjMailLog) G._rjMailLog = {};
    return G._rjMailLog;
  }
  function semaineAbs() {
    try { return (G.saison || 1) * 100 + (G.semaine || 1); } catch (e) { return 0; }
  }

  function varier(m) {
    if (!m || !m.subject) return m;
    var cle = null;
    for (var k in VARIANTES) {
      if (VARIANTES.hasOwnProperty(k) && m.subject.indexOf(k) >= 0) { cle = k; break; }
    }
    if (!cle) return m;
    var log = journal();
    var etat = log["v:" + cle] || { i: -1 };
    var lot = VARIANTES[cle];
    var i = (etat.i + 1) % lot.length;
    m.body = lot[i];
    log["v:" + cle] = { i: i, w: semaineAbs() };
    return m;
  }

  // Un même sujet peut revenir (gagner deux fois, c'est deux victoires), mais
  // pas coup sur coup : court délai de garde. C'est la ROTATION DES VARIANTES
  // qui évite la sensation de déjà-lu, pas le blocage.
  var REPOS = 4;
  function tropRecent(m) {
    if (!m || !m.subject) return false;
    var log = journal();
    var k = "s:" + (m.role || "") + "|" + m.subject;
    var last = log[k];
    var now = semaineAbs();
    if (typeof last === "number" && (now - last) < REPOS) return true;
    log[k] = now;
    return false;
  }

  /* ------------------------------------- 4. les quatre expéditeurs muets */
  function envoyer(o) {
    try { if (typeof pushMail === "function") pushMail(o); } catch (e) {}
  }
  function cooldownOK(cle, semaines) {
    var log = journal();
    var now = semaineAbs();
    var last = log["c:" + cle];
    if (typeof last === "number" && (now - last) < semaines) return false;
    log["c:" + cle] = now;
    return true;
  }

  function nbCourses() { try { return (G.races || []).length; } catch (e) { return 0; } }
  function dernieresPos(n) {
    try {
      return (G.races || []).slice(-n).map(function (r) { return r.pos || 0; });
    } catch (e) { return []; }
  }

  function tickCourrier() {
    try {
      if (typeof G === "undefined" || !G || !G.pilot) return;

      // — PROMOTEUR : ouverture de saison, puis point de mi-championnat
      if ((G.semaine || 1) <= 3 && cooldownOK("promo_ouverture", 40)) {
        envoyer({
          role: "promoter", from: "Promoteur " + (G.cat || "championnat"),
          subject: "Bienvenue pour la saison " + (G.saison || 1),
          body: "Le plateau est complet et le calendrier officiel est publié. Bonne saison à toi — le championnat s'annonce disputé cette année.",
          actions: [{ label: "Merci", kind: "reply" }]
        });
      } else if (nbCourses() >= 5 && cooldownOK("promo_mi_saison", 40)) {
        envoyer({
          role: "promoter", from: "Promoteur " + (G.cat || "championnat"),
          subject: "Mi-championnat — point d'étape",
          body: "Nous voilà à mi-parcours. Tu totalises " + (G.champPts || 0) +
                " points. La seconde partie de saison est souvent celle qui départage — bonne continuation.",
          actions: [{ label: "Compris", kind: "reply" }]
        });
      }

      // — AMIS : soutien après une mauvaise série, ou félicitations après une victoire
      var derniers = dernieresPos(3);
      var mauvaise = derniers.length === 3 && derniers.every(function (p) { return p === 0 || p > 12; });
      if (mauvaise && cooldownOK("amis_soutien", 16)) {
        envoyer({
          role: "friends", from: "Ta bande",
          subject: "On pense à toi",
          body: "On a suivi les dernières courses. Pas terrible, hein. Si tu veux décrocher un soir, on est là — parfois ça fait plus de bien qu'une séance de simulateur.",
          actions: [
            { label: "Merci, ça fait du bien", kind: "reply", effect: { type: "mental", data: { delta: 3, reason: "Soutien des amis" } } },
            { label: "Pas le moment", kind: "dismiss" }
          ]
        });
      } else if (derniers[derniers.length - 1] === 1 && cooldownOK("amis_victoire", 14)) {
        envoyer({
          role: "friends", from: "Ta bande",
          subject: "TU AS GAGNÉ !",
          body: "On était devant l'écran, on a hurlé. Sérieusement, bravo. On fête ça quand tu rentres ?",
          actions: [
            { label: "On fête ça", kind: "reply", effect: { type: "mental", data: { delta: 2, reason: "Célébration entre amis" } } },
            { label: "Plus tard", kind: "dismiss" }
          ]
        });
      }

      // — PRESSE & COM : sollicitation quand la notoriété grimpe
      var rep = (G.rep && G.rep.medias) || 0;
      if (rep >= 45 && cooldownOK("presse_portrait", 30)) {
        envoyer({
          role: "press", from: "Service de presse",
          subject: "Proposition de portrait",
          body: "Ta notoriété a franchi un cap. Un média souhaite te consacrer un portrait long format. C'est du temps, mais c'est de l'exposition durable.",
          actions: [
            { label: "J'accepte", kind: "accept", effect: { type: "rep", data: { delta: 3 } } },
            { label: "Je décline", kind: "refuse" }
          ]
        });
      }

      // — ÉCURIE (technique) : note d'ingénierie entre deux courses
      if (G.currentTeam && G.currentTeam !== "Indépendant" &&
          nbCourses() >= 2 && cooldownOK("ecurie_technique", 16)) {
        envoyer({
          role: "team", from: (G.currentTeam || "L'écurie") + " — Bureau d'études",
          subject: "Note technique",
          body: "Les données de la dernière course sont dépouillées. Rien d'alarmant, mais tes retours sur le train avant nous seraient utiles avant la prochaine séance de réglages.",
          actions: [
            { label: "Je fais un retour détaillé", kind: "reply", effect: { type: "trust", data: { delta: 2, reason: "Retour technique" } } },
            { label: "Rien à signaler", kind: "dismiss" }
          ]
        });
      }
      scanOffres();
    } catch (e) { console.warn("[62-mail-overhaul] tick :", e); }
  }



  /* ------------------------------------------ 6. refonte visuelle du fil */
  /* Le fil de conversation utilisait des bulles en bleu iOS (#0A84FF), sans
   * rapport avec le langage visuel du jeu, et des avatars en initiales.
   * On repasse le tout aux couleurs de l'expéditeur, avec son icône. */

  function roleDuFilOuvert() {
    try {
      if (typeof _MAIL_OPEN_THREAD === "string" && _MAIL_OPEN_THREAD) {
        return _MAIL_OPEN_THREAD.split("::")[0];
      }
    } catch (e) {}
    return "agent";
  }

  function habillerFil() {
    var list = document.getElementById("mailbox-list");
    if (!list) return;
    var enFil = !!list.querySelector('[onclick*="backToMailList"]');

    // --- état vide : carte du jeu plutôt qu'un cadre en pointillés ---
    if (!enFil) {
      var vide = Array.prototype.slice.call(list.children).filter(function (d) {
        return d.getAttribute && /dashed/.test(d.getAttribute("style") || "");
      })[0];
      if (vide && !vide.getAttribute("data-rj62b")) {
        vide.setAttribute("data-rj62b", "1");
        var txt = vide.textContent;
        vide.setAttribute("style",
          "margin:14px;padding:22px 16px;border-radius:var(--r,10px);text-align:center;" +
          "background:linear-gradient(160deg,var(--bg2) 0%,var(--bg) 100%);" +
          "border:1px solid var(--border-hi);");
        vide.innerHTML =
          '<div style="opacity:.5;margin-bottom:8px">' + iconeHTML("agent", 26) + "</div>" +
          '<div style="font-family:var(--font-display);font-size:11px;font-weight:800;color:var(--dim,#6b6b78);' +
          'letter-spacing:.14em;text-transform:uppercase;margin-bottom:5px">Boîte vide</div>' +
          '<div style="font-size:12.5px;color:var(--text2);line-height:1.5">' + txt + "</div>";
      }
      return;
    }

    var role = roleDuFilOuvert();
    var col = couleurRole(role);

    // --- bulles : couleur de l'expéditeur au lieu du bleu iOS ---
    var tous = list.querySelectorAll("div");
    for (var i = 0; i < tous.length; i++) {
      var d = tous[i];
      var st = d.getAttribute("style") || "";
      if (st.indexOf("0A84FF") >= 0 && !d.getAttribute("data-rj62b")) {
        d.setAttribute("data-rj62b", "1");
        d.style.background = "linear-gradient(135deg," + rgbaHex(col, .20) + " 0%," + rgbaHex(col, .10) + " 100%)";
        d.style.border = "1px solid " + rgbaHex(col, .38);
        d.style.color = "var(--text)";
      }
      // avatars en initiales -> icône du rôle
      if (/border-radius:50%/.test(st.replace(/\s/g, "")) && !d.getAttribute("data-rj62b")) {
        var taille = parseInt((st.match(/width:\s*(\d+)px/) || [])[1] || "0", 10);
        if (taille >= 24) {
          d.setAttribute("data-rj62b", "1");
          d.style.background = rgbaHex(col, .16);
          d.style.border = "1px solid " + rgbaHex(col, .45);
          d.style.boxShadow = "none";
          d.innerHTML = iconeHTML(role, Math.round(taille * 0.55));
        }
      }
    }

    // --- boutons d'action : CTA du jeu ---
    var btns = list.querySelectorAll("button");
    for (var j = 0; j < btns.length; j++) {
      var b = btns[j];
      var t = (b.textContent || "").trim();
      if (!t || t === "‹" || t === "✗" || b.getAttribute("data-rj62b")) continue;
      b.setAttribute("data-rj62b", "1");
      var primaire = j === btns.length - 2 || /voir|accepte|j'accepte|merci|ok/i.test(t);
      b.style.cssText +=
        ";padding:11px 14px;border-radius:10px;font-family:var(--font-display);font-size:11px;" +
        "font-weight:800;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;" +
        "touch-action:manipulation;-webkit-appearance:none;appearance:none;" +
        (primaire
          ? "background:" + rgbaHex(col, .18) + ";border:2px solid " + col + ";color:" + col + ";"
          : "background:rgba(255,255,255,.04);border:2px solid var(--border-hi);color:var(--text2);");
    }
  }

  function rgbaHex(hex, a) {
    if (!hex || hex.charAt(0) !== "#" || hex.length < 7) return "rgba(255,255,255," + a + ")";
    var r = parseInt(hex.substr(1, 2), 16), g = parseInt(hex.substr(3, 2), 16), b = parseInt(hex.substr(5, 2), 16);
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }

  /* ------------------------------------------ 5. offres : notification */
  /* Certaines offres déclenchaient déjà un message, d'autres arrivaient en
   * silence (deux points d'ajout dans 03 et un dans 14 n'envoyaient rien, et
   * les offres de sponsors ne prévenaient que si le pilote avait un agent).
   * On comble les trous en marquant chaque offre annoncée, sans doublonner
   * celles que le jeu signale déjà. */

  function dejaSignale(nom) {
    try {
      var now = semaineAbs();
      return (G.mailbox || []).some(function (m) {
        var w = (m.saison || 1) * 100 + (m.week || 1);
        if (now - w > 2) return false;
        var t = (m.subject || "") + " " + (m.body || "");
        return nom && t.indexOf(nom) >= 0;
      });
    } catch (e) { return false; }
  }

  function agentExpediteur() {
    try {
      if (typeof getAgentSender === "function") {
        var a = getAgentSender();
        if (a && a.from) return { role: a.role || "agent", from: a.from };
      }
    } catch (e) {}
    return { role: "agent", from: "Ton agent" };
  }

  function euros(n) {
    try { return Number(n || 0).toLocaleString("fr-FR") + " €"; } catch (e) { return (n || 0) + " €"; }
  }

  function scanOffres() {
    try {
      if (typeof G === "undefined" || !G) return;

      // --- offres d'écurie ---
      (G.offers || []).forEach(function (o) {
        if (!o || o._rj62Notified) return;
        o._rj62Notified = true;
        if (dejaSignale(o.team)) return;   // le jeu l'a déjà annoncée

        var exp = agentExpediteur();
        var role = o.role === "num1" ? "pilote n°1" : o.role === "equal" ? "statut équivalent" : "second pilote";
        var lignes = [
          "Salaire : " + euros(o.salary || o.budget || 0) + " par mois",
          "Durée : " + (o.duration || o.dur || 1) + " saison" + ((o.duration || o.dur || 1) > 1 ? "s" : ""),
          "Statut : " + role
        ];
        if (o.cost > 0) lignes.push("Apport demandé : " + euros(o.cost));
        if (o.bonusWin > 0) lignes.push("Bonus victoire : " + euros(o.bonusWin));

        envoyer({
          role: exp.role, from: exp.from,
          subject: "Offre de " + (o.team || "une écurie"),
          body: (o.team || "Une écurie") + " te fait une proposition pour " + (o.cat || G.cat || "la saison") +
                ".\n\n" + lignes.join("\n") +
                "\n\nRien n'est signé tant que tu n'as pas répondu — et tout se négocie.",
          actions: [
            { label: "Voir l'offre", kind: "reply", effect: { type: "nav", data: { screen: "S-contracts", tab: "offres" } } },
            { label: "Plus tard", kind: "dismiss" }
          ]
        });
      });

      // --- offres de sponsors ---
      (G.sponsorOffers || []).forEach(function (so) {
        if (!so || so._rj62Notified) return;
        so._rj62Notified = true;
        var nom = so.name || so.id || "";
        // nom lisible si le catalogue est accessible
        try {
          if (typeof getSponsorPool === "function") {
            var found = (getSponsorPool() || []).filter(function (x) { return x.id === so.id; })[0];
            if (found && found.name) nom = found.name;
          }
        } catch (e) {}
        if (dejaSignale(nom)) return;

        envoyer({
          role: "sponsor", from: nom || "Partenaire potentiel",
          subject: "Proposition de partenariat",
          body: (nom || "Une marque") + " souhaite s'associer à toi. L'offre reste ouverte " +
                ((so.expire || 5)) + " semaines — au-delà, ils passeront à un autre pilote.",
          actions: [
            { label: "Voir la proposition", kind: "reply", effect: { type: "nav", data: { screen: "S-sponsors" } } },
            { label: "Pas maintenant", kind: "dismiss" }
          ]
        });
      });
    } catch (e) { console.warn("[62-mail-overhaul] offres :", e); }
  }

  /* ------------------------------------------------------------- montage */
  function installer() {
    if (typeof window.pushMail !== "function") return false;

    if (!window.pushMail._rj62) {
      var orig = window.pushMail;
      var fn = function (o) {
        try {
          if (o) {
            stabiliserExpediteur(o);
            varier(o);
            if (tropRecent(o)) return null;   // même sujet trop récent : on n'insiste pas
          }
        } catch (e) {}
        return orig.apply(this, arguments);
      };
      fn._rj62 = true;
      wrapped.pushMail = orig;
      window.pushMail = fn;
    }

    // filet : si une offre est apparue hors du tick (fin de saison…), on la
    // signale au plus tard à l'ouverture de l'écran des contrats.
    if (typeof window.renderOffers === "function" && !window.renderOffers._rj62) {
      var o3 = window.renderOffers;
      var f3 = function () { var r = o3.apply(this, arguments); try { scanOffres(); } catch (e) {} return r; };
      f3._rj62 = true;
      wrapped.renderOffers = o3;
      window.renderOffers = f3;
    }

    if (typeof window.renderMailbox === "function" && !window.renderMailbox._rj62) {
      var o2 = window.renderMailbox;
      var f2 = function () {
        var r = o2.apply(this, arguments);
        try { setTimeout(function () { habillerListe(); habillerFil(); }, 0); } catch (e) {}
        return r;
      };
      f2._rj62 = true;
      wrapped.renderMailbox = o2;
      window.renderMailbox = f2;
    }

    // hook hebdomadaire pour les nouveaux expéditeurs
    try {
      if (typeof WEEKLY_TICK_HOOKS !== "undefined" && WEEKLY_TICK_HOOKS && WEEKLY_TICK_HOOKS.push) {
        var deja = WEEKLY_TICK_HOOKS.some(function (h) { return h && h.id === "rj62Mail"; });
        if (!deja) WEEKLY_TICK_HOOKS.push({ id: "rj62Mail", run: function () { tickCourrier(); } });
      }
    } catch (e) {}

    return true;
  }

  var essais = 0;
  function boot() {
    if (installer()) {
      console.log("[62-mail-overhaul] actif — icônes d'expéditeur, fils regroupés, variantes, 4 nouveaux contacts");
      return;
    }
    if (essais++ < 80) setTimeout(boot, 80);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj62Uninstall = function () {
    Object.keys(wrapped).forEach(function (k) { window[k] = wrapped[k]; });
    try {
      if (typeof WEEKLY_TICK_HOOKS !== "undefined" && WEEKLY_TICK_HOOKS) {
        for (var i = WEEKLY_TICK_HOOKS.length - 1; i >= 0; i--) {
          if (WEEKLY_TICK_HOOKS[i] && WEEKLY_TICK_HOOKS[i].id === "rj62Mail") WEEKLY_TICK_HOOKS.splice(i, 1);
        }
      }
    } catch (e) {}
    console.log("[62-mail-overhaul] désinstallé");
  };
  window._rj62Tick = tickCourrier;
  window._rj62ScanOffres = scanOffres;
})();
