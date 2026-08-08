/* =====================================================================
 * 100-media-day-refonte.js — LA CONFÉRENCE DE PRESSE
 *
 * CE QU'IL Y AVAIT
 * Huit questions génériques, trois réponses chacune, posées par un
 * « JOURNALISTE » anonyme sur un fond gris. Aucun lien avec la course de
 * la veille, le championnat en cours ou la rumeur du moment : les mêmes
 * phrases revenaient qu'on vienne de gagner ou d'abandonner.
 *
 * CE QUE CE MODULE APPORTE
 *
 *   1. DES JOURNALISTES qui existent — un nom, un média, un pays, et une
 *      manière de poser les questions. Le correspondant d'un quotidien
 *      sportif ne cherche pas la même chose qu'un tabloïd.
 *
 *   2. DES QUESTIONS QUI SAVENT OÙ L'ON EN EST. Chacune porte une
 *      condition : elle ne se pose que si la situation s'y prête. Victoire
 *      de la veille, abandon, série de contre-performances, lutte pour le
 *      titre, contrat qui expire, coéquipier plus rapide, rival en forme,
 *      promotion espérée, âge, réputation… Les textes se composent avec le
 *      nom réel de l'écurie, du circuit, du rival.
 *
 *   3. CINQ RÉPONSES, CINQ ATTITUDES. Assuré, mesuré, provocateur, humble
 *      ou évasif : le ton compte autant que le fond. Chaque attitude a son
 *      profil d'effets — le provocateur fait vendre du papier mais agace le
 *      paddock, l'humble rassure l'écurie sans faire les gros titres.
 *
 *   4. UNE MISE EN SCÈNE à la charte du jeu : salle de presse, pastille du
 *      média, micro, réactions après coup.
 *
 * Le module remplace l'écran d'origine sans toucher au reste : le
 * déclenchement (module 99), le quota et l'accès depuis l'accueil sont
 * inchangés.
 *
 * Réversible : window._rj100Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[100-media-day]";
  var CSS_ID = "rj100-css";
  var NB_QUESTIONS = 3;

  function G_() { return (typeof window.G !== "undefined") ? window.G : null; }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function au_hasard(t) { return t[Math.floor(Math.random() * t.length)]; }

  /* ==================================================================
   * 1. LA SALLE DE PRESSE
   *
   * Chaque journaliste a un ton, qui colore la formulation des questions
   * et, un peu, la façon dont les réponses sont reçues.
   * ================================================================== */
  var JOURNALISTES = [
    { prenom: "Élise",   nom: "Marchand",  media: "L'Équipe",            pays: "FR", ton: "technique",  couleur: "#00D4FF" },
    { prenom: "Tom",     nom: "Whitfield", media: "Autosport",           pays: "GB", ton: "technique",  couleur: "#00D4FF" },
    { prenom: "Marco",   nom: "Bellini",   media: "Gazzetta Motori",     pays: "IT", ton: "passionne",  couleur: "#F59E0B" },
    { prenom: "Sabine",  nom: "Keller",    media: "Motorsport Aktuell",  pays: "DE", ton: "incisif",    couleur: "#EF4444" },
    { prenom: "Danny",   nom: "Cross",     media: "The Paddock Post",    pays: "GB", ton: "tabloid",    couleur: "#EC4899" },
    { prenom: "Yuki",    nom: "Nakashima", media: "Racing On",           pays: "JP", ton: "bienveillant", couleur: "#34D399" },
    { prenom: "Rafael",  nom: "Duarte",    media: "Globo Esporte",       pays: "BR", ton: "passionne",  couleur: "#F59E0B" },
    { prenom: "Claire",  nom: "Dubreuil",  media: "Auto Hebdo",          pays: "FR", ton: "bienveillant", couleur: "#34D399" },
    { prenom: "Viktor",  nom: "Hansen",    media: "Speedweek",           pays: "DK", ton: "incisif",    couleur: "#EF4444" },
    { prenom: "Nadia",   nom: "Ferrero",   media: "Circuito",            pays: "ES", ton: "tabloid",    couleur: "#EC4899" },
    { prenom: "James",   nom: "O'Connell", media: "Racer Weekly",        pays: "IE", ton: "technique",  couleur: "#00D4FF" },
    { prenom: "Ingrid",  nom: "Svenson",   media: "Motorsport Nordic",   pays: "SE", ton: "bienveillant", couleur: "#34D399" }
  ];

  var TONS_JOURNALISTE = {
    technique:    "Question technique",
    passionne:    "Question passionnée",
    incisif:      "Question piège",
    tabloid:      "Question people",
    bienveillant: "Question ouverte"
  };

  /* ==================================================================
   * 2. LE CONTEXTE
   *
   * Tout ce que les questions peuvent invoquer. Calculé une fois par
   * conférence pour que les trois questions parlent de la même situation.
   * ================================================================== */
  function contexte() {
    var G = G_() || {};
    var c = {
      cat: G.cat || "",
      saison: G.saison || 1,
      semaine: G.semaine || 1,
      age: G.age || 20,
      equipe: G.currentTeam || "Indépendant",
      reputation: G.reputation || 0,
      mental: 60
    };
    try { if (typeof PILOT_MENTAL !== "undefined" && PILOT_MENTAL) c.mental = PILOT_MENTAL.value; } catch (e) {}

    var courses = [];
    try { courses = G.races || []; } catch (e) {}
    c.courses = courses.length;

    var d = courses[courses.length - 1] || null;
    c.derniere = d;
    c.derniereCircuit = d ? (d.circuit || d.name || "la dernière course") : null;
    c.dernierePos = d ? d.pos : null;
    c.abandon = !!(d && (d.dnf || d.pos === 0 || d.pos == null));
    c.victoire = !!(d && d.pos === 1);
    c.podium = !!(d && d.pos >= 1 && d.pos <= 3);
    c.pointsDerniere = d ? (d.pts || 0) : 0;

    /* Forme : les trois dernières courses. */
    var trois = courses.slice(-3);
    c.serieNoire = trois.length === 3 && trois.every(function (x) {
      return x.dnf || x.pos == null || x.pos > 10;
    });
    c.serieBelle = trois.length >= 2 && trois.slice(-2).every(function (x) {
      return x.pos >= 1 && x.pos <= 5 && !x.dnf;
    });
    c.abandonsRecents = trois.filter(function (x) { return x.dnf; }).length;

    /* Championnat. */
    c.points = G.champPts || 0;
    var table = [{ pts: c.points, moi: true, nom: "moi" }];
    var rivaux = [];
    try { rivaux = G.rivals || []; } catch (e) {}
    rivaux.forEach(function (r) {
      table.push({ pts: r.pts || 0, moi: false, nom: r.name, equipe: r.team });
    });
    table.sort(function (a, b) { return b.pts - a.pts; });
    c.place = 1;
    for (var i = 0; i < table.length; i++) if (table[i].moi) { c.place = i + 1; break; }
    c.leader = table[0] && !table[0].moi ? table[0] : null;
    c.ecartLeader = c.leader ? (c.leader.pts - c.points) : 0;
    c.enTete = c.place === 1;
    c.luttePourTitre = c.place <= 3 && c.courses >= 4;

    /* Le rival le plus proche au classement. */
    var moiIdx = c.place - 1;
    c.suivant = table[moiIdx + 1] && !table[moiIdx + 1].moi ? table[moiIdx + 1] : null;
    c.devant = table[moiIdx - 1] && !table[moiIdx - 1].moi ? table[moiIdx - 1] : null;

    /* Coéquipier : même écurie. */
    c.coequipier = null;
    for (var k = 0; k < rivaux.length; k++) {
      if (rivaux[k].team && rivaux[k].team === c.equipe) { c.coequipier = rivaux[k]; break; }
    }
    if (c.coequipier) {
      c.coequipierDevant = (c.coequipier.pts || 0) > c.points;
      c.ecartCoequipier = Math.abs((c.coequipier.pts || 0) - c.points);
    }

    /* Contrat et marché. */
    c.semainesContrat = (typeof G.contractWeeksLeft === "number") ? G.contractWeeksLeft : 999;
    c.finDeContrat = c.semainesContrat > 0 && c.semainesContrat <= 20;
    c.offres = 0;
    try { c.offres = (G.offers || []).length; } catch (e) {}
    c.independant = !c.equipe || c.equipe === "Indépendant";

    /* Confiance de l'écurie. */
    c.confiance = 50;
    try { if (typeof TEAM_TRUST !== "undefined" && TEAM_TRUST) c.confiance = TEAM_TRUST.value; } catch (e) {}

    /* Un rival tiré au sort pour les questions qui en ont besoin. */
    c.rivalAuHasard = rivaux.length ? au_hasard(rivaux.slice(0, Math.min(6, rivaux.length))) : null;

    c.enF1 = c.cat === "Formule 1";
    c.jeune = c.age <= 20;
    c.veteran = c.age >= 32;

    return c;
  }

  /* Nom d'usage : on retire le prénom mais on garde les particules —
     « Luca De Angelis » donne « De Angelis », et non « Angelis ». */
  function nomCourt(x) {
    if (!x) return "un rival";
    var n = String(x.nom || x.name || "").trim();
    var bouts = n.split(/\s+/);
    if (bouts.length < 2) return n;
    return bouts.slice(1).join(" ");
  }

  /* ==================================================================
   * 3. LES ATTITUDES
   *
   * Cinq façons de répondre, cinq profils d'effets. Le ton pèse autant
   * que le contenu : le provocateur fait vendre du papier et agace le
   * paddock, l'humble rassure l'écurie sans faire les gros titres.
   * ================================================================== */
  var ATTITUDES = {
    assure:      { lbl: "Assuré",      couleur: "#F59E0B", ico: "▲" },
    mesure:      { lbl: "Mesuré",      couleur: "#00D4FF", ico: "＝" },
    provocateur: { lbl: "Provocateur", couleur: "#EF4444", ico: "⚡" },
    humble:      { lbl: "Humble",      couleur: "#34D399", ico: "○" },
    evasif:      { lbl: "Évasif",      couleur: "#8b93a7", ico: "…" }
  };

  /* ==================================================================
   * 4. LA BANQUE DE QUESTIONS
   *
   * Chaque entrée porte une condition : elle n'est proposée que si la
   * situation s'y prête. Le poids règle la fréquence quand plusieurs
   * questions sont éligibles.
   *
   * Les effets : rep {med, pub, pad, rec} pour les quatre axes de
   * réputation, mental pour le moral, confiance pour l'écurie, rivalite
   * pour la tension avec un adversaire.
   * ================================================================== */
  var QUESTIONS = [

    /* ---------------------------------------------------------------
     * APRÈS UNE VICTOIRE
     * ------------------------------------------------------------- */
    {
      id: "victoire_ressenti", poids: 5,
      quand: function (c) { return c.victoire; },
      texte: function (c) {
        return "Vous venez de gagner à " + c.derniereCircuit +
               ". Qu'est-ce qui a fait la différence ce week-end ?";
      },
      reponses: [
        { ton: "assure", texte: "La voiture était sous contrôle du premier au dernier tour. Je savais que c'était jouable.",
          effets: { rep: { med: 3, pub: 4, pad: 1, rec: 2 }, mental: 2 },
          retour: "Le ton d'un pilote qui assume son statut. Les images tournent en boucle." },
        { ton: "humble", texte: "L'équipe m'a donné une voiture parfaite. Je n'ai eu qu'à la piloter proprement.",
          effets: { rep: { med: 2, pub: 3, pad: 4, rec: 3 }, confiance: 5, mental: 1 },
          retour: "Le garage apprécie. Ce genre de phrase se retient dans un paddock." },
        { ton: "mesure", texte: "Un bon week-end de bout en bout. Une victoire, ça se construit dès le vendredi.",
          effets: { rep: { med: 2, pub: 2, pad: 3, rec: 3 } },
          retour: "Réponse de professionnel. Les recruteurs notent la lucidité." },
        { ton: "provocateur", texte: "Certains diront que c'est la voiture. Qu'ils viennent la piloter, on en reparlera.",
          effets: { rep: { med: 4, pub: 5, pad: -3, rec: -1 }, rivalite: 10, mental: 1 },
          retour: "La phrase fait le tour des réseaux. Tout le monde n'a pas ri." },
        { ton: "evasif", texte: "C'est une victoire, voilà. On passe à la suivante.",
          effets: { rep: { med: -2, pub: -1, pad: 1, rec: 1 } },
          retour: "Les journalistes referment leurs carnets. Peu de citations exploitables." }
      ]
    },
    {
      id: "victoire_suite", poids: 3,
      quand: function (c) { return c.victoire && c.courses >= 3; },
      texte: function (c) {
        return "Après une victoire, la pression change de camp. Vous vous sentez chassé, maintenant ?";
      },
      reponses: [
        { ton: "assure", texte: "Chassé, oui. Et j'aime bien cette position, elle veut dire qu'on fait quelque chose de bien.",
          effets: { rep: { med: 3, pub: 3, pad: 2, rec: 2 }, mental: 2 },
          retour: "Assurance tranquille. Bon passage." },
        { ton: "mesure", texte: "Une victoire ne change pas le classement d'un coup. Il reste beaucoup de manches.",
          effets: { rep: { med: 1, pub: 1, pad: 3, rec: 3 } },
          retour: "Lucide. Le paddock aime les pilotes qui savent compter." },
        { ton: "provocateur", texte: "Qu'ils me chassent. Ils ont déjà essayé dimanche, ça ne leur a pas réussi.",
          effets: { rep: { med: 4, pub: 4, pad: -2, rec: -1 }, rivalite: 12 },
          retour: "Titre tout trouvé pour demain. Deux ou trois pilotes ont tiqué." },
        { ton: "humble", texte: "Je me sens surtout chanceux d'avoir une équipe capable de me mettre dans cette position.",
          effets: { rep: { med: 1, pub: 2, pad: 4, rec: 2 }, confiance: 4 },
          retour: "Réponse qui fait plaisir dans le garage." },
        { ton: "evasif", texte: "La pression, je ne la ressens pas vraiment. Question suivante ?",
          effets: { rep: { med: -3, pub: -1, pad: 0, rec: 0 } },
          retour: "Sèche. La salle passe à autre chose, un peu refroidie." }
      ]
    },

    /* ---------------------------------------------------------------
     * APRÈS UN PODIUM
     * ------------------------------------------------------------- */
    {
      id: "podium", poids: 4,
      quand: function (c) { return c.podium && !c.victoire; },
      texte: function (c) {
        return "P" + c.dernierePos + " à " + c.derniereCircuit +
               " : satisfait, ou frustré de ne pas avoir gagné ?";
      },
      reponses: [
        { ton: "assure", texte: "Frustré. Je viens pour gagner, un podium c'est une étape, pas un objectif.",
          effets: { rep: { med: 3, pub: 3, pad: 1, rec: 3 }, mental: 1 },
          retour: "L'ambition affichée plaît aux recruteurs." },
        { ton: "mesure", texte: "Satisfait du résultat, lucide sur ce qu'il manque. On sait où travailler.",
          effets: { rep: { med: 1, pub: 1, pad: 3, rec: 3 } },
          retour: "Équilibré. Rien à jeter." },
        { ton: "humble", texte: "Content pour l'équipe. Ils ont bossé tout l'hiver pour des week-ends comme celui-là.",
          effets: { rep: { med: 1, pub: 2, pad: 4, rec: 2 }, confiance: 5 },
          retour: "Le team principal a apprécié le geste." },
        { ton: "provocateur", texte: "Frustré surtout de ce qui s'est passé devant. On en reparlera à la prochaine.",
          effets: { rep: { med: 4, pub: 3, pad: -2, rec: 0 }, rivalite: 10 },
          retour: "Le pilote visé a été interrogé dans la foulée. Ça promet." },
        { ton: "evasif", texte: "C'est un bon point pour le championnat, c'est tout ce que je retiens.",
          effets: { rep: { med: -1, pub: 0, pad: 1, rec: 1 } },
          retour: "Réponse sans relief, vite oubliée." }
      ]
    },

    /* ---------------------------------------------------------------
     * APRÈS UN ABANDON
     * ------------------------------------------------------------- */
    {
      id: "abandon", poids: 5,
      quand: function (c) { return c.abandon; },
      texte: function (c) {
        return "Abandon à " + c.derniereCircuit +
               ". À chaud, dimanche, on vous a senti très remonté. Ça va mieux ?";
      },
      reponses: [
        { ton: "mesure", texte: "À chaud on dit des bêtises. On a analysé, on a compris, on avance.",
          effets: { rep: { med: 2, pub: 2, pad: 3, rec: 3 }, confiance: 3, mental: 2 },
          retour: "Maturité remarquée. Le genre de réponse qui rassure une écurie." },
        { ton: "humble", texte: "Je dois m'excuser auprès des mécaniciens. Ils ne méritaient pas de finir le dimanche comme ça.",
          effets: { rep: { med: 2, pub: 3, pad: 4, rec: 2 }, confiance: 7 },
          retour: "Le garage a lu la déclaration. Ça compte plus qu'on ne croit." },
        { ton: "assure", texte: "Ça arrive. Je sais ce que je vaux, un abandon ne change pas ça.",
          effets: { rep: { med: 1, pub: 2, pad: 0, rec: 1 }, mental: 1 },
          retour: "Solide, mais certains y ont vu de la désinvolture." },
        { ton: "provocateur", texte: "Ce n'était pas de mon fait, et tout le monde dans le garage le sait.",
          effets: { rep: { med: 3, pub: 1, pad: -3, rec: -2 }, confiance: -8 },
          retour: "Le message est passé, mal. L'ingénieur en chef n'a pas apprécié." },
        { ton: "evasif", texte: "Je préfère ne pas revenir dessus.",
          effets: { rep: { med: -3, pub: -2, pad: 1, rec: 0 } },
          retour: "Le silence nourrit les rumeurs plus qu'il ne les éteint." }
      ]
    },

    /* ---------------------------------------------------------------
     * SÉRIE NOIRE
     * ------------------------------------------------------------- */
    {
      id: "serie_noire", poids: 5,
      quand: function (c) { return c.serieNoire; },
      texte: function (c) {
        return "Trois courses sans résultat. Est-ce que c'est le pilote, la voiture, ou l'équipe ?";
      },
      reponses: [
        { ton: "humble", texte: "Une part est pour moi. Je n'ai pas été au niveau et je le sais.",
          effets: { rep: { med: 2, pub: 2, pad: 4, rec: 2 }, confiance: 6, mental: -1 },
          retour: "Assumer publiquement calme beaucoup de monde en interne." },
        { ton: "mesure", texte: "C'est un ensemble. On corrige méthodiquement, sans chercher de coupable.",
          effets: { rep: { med: 1, pub: 1, pad: 3, rec: 3 }, confiance: 3 },
          retour: "Réponse de capitaine. Bien reçue." },
        { ton: "assure", texte: "Je n'ai pas oublié de piloter en trois courses. Ça va revenir.",
          effets: { rep: { med: 2, pub: 3, pad: 0, rec: 1 }, mental: 2 },
          retour: "Le public aime le caractère. Le paddock attend de voir." },
        { ton: "provocateur", texte: "Regardez les données. Vous verrez de quel côté du garage ça coince.",
          effets: { rep: { med: 4, pub: 2, pad: -4, rec: -3 }, confiance: -10 },
          retour: "Déclaration explosive. La direction sportive a demandé un entretien." },
        { ton: "evasif", texte: "On travaille. Je ne vais pas commenter plus que ça.",
          effets: { rep: { med: -2, pub: -2, pad: 1, rec: 0 } },
          retour: "Le mutisme est interprété comme un malaise interne." }
      ]
    },

    /* ---------------------------------------------------------------
     * COURSE AU TITRE
     * ------------------------------------------------------------- */
    {
      id: "titre_leader", poids: 5,
      quand: function (c) { return c.enTete && c.courses >= 5; },
      texte: function (c) {
        return "Vous menez le championnat. À partir de quand commence-t-on à y penser sérieusement ?";
      },
      reponses: [
        { ton: "assure", texte: "J'y pense depuis le premier jour. On n'est pas là pour faire de la figuration.",
          effets: { rep: { med: 3, pub: 4, pad: 1, rec: 3 }, mental: 2 },
          retour: "Déclaration d'intention. Les caméras adorent." },
        { ton: "mesure", texte: "Quand les mathématiques le diront. D'ici là, on prend les points où ils sont.",
          effets: { rep: { med: 1, pub: 1, pad: 4, rec: 3 } },
          retour: "Prudence de vieux briscard. Le paddock approuve." },
        { ton: "humble", texte: "On mène, mais je sais ce que ça coûte à l'équipe. Je ne veux pas les décevoir.",
          effets: { rep: { med: 1, pub: 2, pad: 3, rec: 2 }, confiance: 5 },
          retour: "Sincère. L'écurie s'est sentie associée." },
        { ton: "provocateur", texte: "Les autres y pensent pour moi, à en juger par ce qu'ils racontent.",
          effets: { rep: { med: 4, pub: 4, pad: -2, rec: 0 }, rivalite: 12 },
          retour: "La guerre psychologique est lancée." },
        { ton: "evasif", texte: "Un championnat, c'est long. Je préfère ne pas m'avancer.",
          effets: { rep: { med: -2, pub: -1, pad: 2, rec: 1 } },
          retour: "Trop lisse pour marquer les esprits." }
      ]
    },
    {
      id: "titre_poursuivant", poids: 4,
      quand: function (c) { return c.luttePourTitre && !c.enTete && c.leader; },
      texte: function (c) {
        return "Vous êtes P" + c.place + ", à " + c.ecartLeader + " points de " +
               nomCourt(c.leader) + ". Cet écart, il se comble comment ?";
      },
      reponses: [
        { ton: "assure", texte: "En gagnant des courses. Il n'y a pas d'autre méthode et ça tombe bien, c'est mon métier.",
          effets: { rep: { med: 3, pub: 4, pad: 1, rec: 2 }, mental: 2 },
          retour: "Ambition assumée, bien relayée." },
        { ton: "mesure", texte: "En marquant à chaque manche. Les écarts se comblent sur la durée, pas en un dimanche.",
          effets: { rep: { med: 1, pub: 1, pad: 4, rec: 3 } },
          retour: "Analyse juste. Les techniciens hochent la tête." },
        { ton: "provocateur", texte: "Il suffit qu'il commette une erreur. Il en a déjà fait, il en refera.",
          effets: { rep: { med: 4, pub: 3, pad: -3, rec: -1 }, rivalite: 15 },
          retour: "Le leader a été mis au courant avant même de quitter le circuit." },
        { ton: "humble", texte: "Il est très fort cette saison, il faut le reconnaître. À nous de hausser le niveau.",
          effets: { rep: { med: 2, pub: 2, pad: 4, rec: 2 } },
          retour: "Élégant. Ce genre de reconnaissance se rend, dans ce milieu." },
        { ton: "evasif", texte: "On verra bien. Beaucoup de choses peuvent arriver.",
          effets: { rep: { med: -2, pub: -2, pad: 1, rec: 0 } },
          retour: "Réponse molle pour une question qui appelait du feu." }
      ]
    },

    /* ---------------------------------------------------------------
     * CONTRAT, MARCHÉ, RUMEURS
     * ------------------------------------------------------------- */
    {
      id: "contrat_fin", poids: 5,
      quand: function (c) { return c.finDeContrat && !c.independant; },
      texte: function (c) {
        return "Votre contrat avec " + c.equipe + " arrive à son terme. Où en sont les discussions ?";
      },
      reponses: [
        { ton: "mesure", texte: "Les discussions avancent. Je laisse mon agent faire son travail, moi je pilote.",
          effets: { rep: { med: 1, pub: 1, pad: 3, rec: 3 }, confiance: 2 },
          retour: "Réponse cadrée. Personne ne peut en tirer un titre, et c'est voulu." },
        { ton: "humble", texte: "Je me sens bien ici. Si ça ne tenait qu'à moi, la question ne se poserait pas.",
          effets: { rep: { med: 2, pub: 2, pad: 2, rec: 0 }, confiance: 8 },
          retour: "Déclaration d'attachement. Le team principal l'a lue avec plaisir." },
        { ton: "assure", texte: "J'ai des options. Je choisirai le projet qui me permet de gagner.",
          effets: { rep: { med: 3, pub: 2, pad: 1, rec: 4 }, confiance: -5 },
          retour: "Message reçu ailleurs dans le paddock. Et dans votre garage aussi." },
        { ton: "provocateur", texte: "Disons que tout le monde n'a pas encore compris ce que je vaux sur ce marché.",
          effets: { rep: { med: 4, pub: 3, pad: -2, rec: 3 }, confiance: -10 },
          retour: "Coup de pression public. Risqué, mais votre cote monte." },
        { ton: "evasif", texte: "Je ne commente jamais les contrats. Vous le savez.",
          effets: { rep: { med: -2, pub: -1, pad: 2, rec: 1 } },
          retour: "Les spéculations continueront sans vous." }
      ]
    },
    {
      id: "rumeur_transfert", poids: 4,
      quand: function (c) { return c.offres > 0 || (c.finDeContrat && c.reputation >= 40); },
      texte: function (c) {
        return "Votre nom circule ailleurs dans le paddock. Vous confirmez avoir été approché ?";
      },
      reponses: [
        { ton: "mesure", texte: "On parle à tout le monde dans ce métier. Ça ne veut pas dire qu'on signe.",
          effets: { rep: { med: 2, pub: 1, pad: 3, rec: 2 } },
          retour: "Ni démenti ni confirmation. Exactement ce qu'il fallait dire." },
        { ton: "assure", texte: "Je ne vais pas mentir : oui. Et ça me flatte, ça veut dire que le travail se voit.",
          effets: { rep: { med: 4, pub: 3, pad: 1, rec: 4 }, confiance: -6 },
          retour: "Franchise payante côté marché, moins côté garage." },
        { ton: "humble", texte: "Mon écurie a misé sur moi quand personne ne le faisait. Je ne l'oublie pas.",
          effets: { rep: { med: 2, pub: 3, pad: 3, rec: -1 }, confiance: 10 },
          retour: "Loyauté affichée. Le paddock retient les pilotes qui n'oublient pas." },
        { ton: "provocateur", texte: "Beaucoup de monde m'appelle. Certains devraient s'en inquiéter.",
          effets: { rep: { med: 5, pub: 3, pad: -3, rec: 2 }, confiance: -12 },
          retour: "Déclaration incendiaire. Votre directeur sportif veut vous voir." },
        { ton: "evasif", texte: "Des rumeurs, il y en a toutes les semaines. Je n'y prête pas attention.",
          effets: { rep: { med: -2, pub: 0, pad: 2, rec: 0 } },
          retour: "Botté en touche. Les journalistes insisteront la prochaine fois." }
      ]
    },
    {
      id: "promotion", poids: 3,
      quand: function (c) { return !c.enF1 && c.place <= 3 && c.courses >= 5; },
      texte: function (c) {
        return "Avec vos résultats en " + c.cat + ", la catégorie supérieure vous tend les bras. C'est pour bientôt ?";
      },
      reponses: [
        { ton: "assure", texte: "Je suis prêt. Il ne manque plus que quelqu'un pour m'ouvrir la porte.",
          effets: { rep: { med: 3, pub: 3, pad: 1, rec: 4 }, mental: 1 },
          retour: "Message adressé aux bonnes personnes." },
        { ton: "mesure", texte: "Une étape à la fois. Je finis d'abord ce que j'ai commencé ici.",
          effets: { rep: { med: 1, pub: 1, pad: 4, rec: 3 }, confiance: 4 },
          retour: "Sagesse appréciée par ceux qui recrutent." },
        { ton: "humble", texte: "Ce n'est pas à moi de le dire. Mon travail, c'est de ne pas laisser le choix.",
          effets: { rep: { med: 2, pub: 2, pad: 4, rec: 3 } },
          retour: "Formule reprise par plusieurs médias. Bien vue." },
        { ton: "provocateur", texte: "Si le talent suffisait, j'y serais déjà. Vous savez comme moi que ce n'est pas le seul critère.",
          effets: { rep: { med: 5, pub: 4, pad: -3, rec: -2 } },
          retour: "Vérité crue. Elle a fait grincer quelques dents en haut lieu." },
        { ton: "evasif", texte: "Je ne me projette pas. Ça ne sert à rien.",
          effets: { rep: { med: -2, pub: -1, pad: 1, rec: -1 } },
          retour: "Occasion manquée de se placer." }
      ]
    },

    /* ---------------------------------------------------------------
     * COÉQUIPIER
     * ------------------------------------------------------------- */
    {
      id: "coequipier_devant", poids: 4,
      quand: function (c) { return c.coequipier && c.coequipierDevant && c.courses >= 3; },
      texte: function (c) {
        return "Votre coéquipier " + nomCourt(c.coequipier) + " vous devance de " +
               c.ecartCoequipier + " points. Comment on vit ça, à l'intérieur d'une équipe ?";
      },
      reponses: [
        { ton: "humble", texte: "Il fait une belle saison, c'est un fait. À moi de me hisser à son niveau.",
          effets: { rep: { med: 2, pub: 2, pad: 4, rec: 2 }, confiance: 5 },
          retour: "Honnêteté saluée. L'équipe respire mieux." },
        { ton: "assure", texte: "Un écart se comble. Sur une saison entière, je ne m'inquiète pas.",
          effets: { rep: { med: 2, pub: 3, pad: 1, rec: 2 }, mental: 2 },
          retour: "Confiance affichée. On verra sur la piste." },
        { ton: "mesure", texte: "On a eu des week-ends différents. Les chiffres diront la vérité en fin de saison.",
          effets: { rep: { med: 1, pub: 1, pad: 3, rec: 3 } },
          retour: "Réponse nette, sans polémique." },
        { ton: "provocateur", texte: "Regardez les week-ends où on a eu le même matériel. Vous ferez le calcul vous-mêmes.",
          effets: { rep: { med: 5, pub: 3, pad: -3, rec: 0 }, confiance: -10, rivalite: 12 },
          retour: "L'accusation de traitement de faveur est lancée. L'ambiance sera fraîche lundi." },
        { ton: "evasif", texte: "C'est le classement, il est ce qu'il est.",
          effets: { rep: { med: -2, pub: -1, pad: 1, rec: 0 } },
          retour: "Réponse plate sur un sujet qui intéressait la salle." }
      ]
    },
    {
      id: "coequipier_derriere", poids: 3,
      quand: function (c) { return c.coequipier && !c.coequipierDevant && c.courses >= 3; },
      texte: function (c) {
        return "Vous dominez " + nomCourt(c.coequipier) +
               " au sein de " + c.equipe + ". Ça crée des tensions dans le garage ?";
      },
      reponses: [
        { ton: "mesure", texte: "Aucune tension. On partage nos données, c'est comme ça qu'une équipe avance.",
          effets: { rep: { med: 1, pub: 1, pad: 4, rec: 3 }, confiance: 5 },
          retour: "Le garage a apprécié le message d'unité." },
        { ton: "humble", texte: "Il traverse une période difficile, ça arrive à tout le monde. Il va revenir.",
          effets: { rep: { med: 2, pub: 3, pad: 4, rec: 2 } },
          retour: "Élégance rare. Le coéquipier l'a noté." },
        { ton: "assure", texte: "Je fais mon travail. S'il y a des tensions, ce n'est pas de mon côté du garage.",
          effets: { rep: { med: 3, pub: 2, pad: 0, rec: 2 }, rivalite: 6 },
          retour: "Pique discrète, mais tout le monde l'a entendue." },
        { ton: "provocateur", texte: "Il faudrait déjà qu'il soit dans mes rétroviseurs pour créer une tension.",
          effets: { rep: { med: 5, pub: 4, pad: -4, rec: -1 }, confiance: -8, rivalite: 18 },
          retour: "Phrase assassine. Le vestiaire s'en souviendra longtemps." },
        { ton: "evasif", texte: "Il faudrait lui poser la question, pas à moi.",
          effets: { rep: { med: 0, pub: 0, pad: 0, rec: 0 } },
          retour: "Renvoi de balle. Le journaliste ira effectivement lui demander." }
      ]
    },

    /* ---------------------------------------------------------------
     * RIVAL ET ADVERSAIRES
     * ------------------------------------------------------------- */
    {
      id: "rival_forme", poids: 3,
      quand: function (c) { return !!c.devant && c.courses >= 4; },
      texte: function (c) {
        return nomCourt(c.devant) + " est juste devant vous au championnat. " +
               "C'est l'adversaire que vous surveillez le plus ?";
      },
      reponses: [
        { ton: "mesure", texte: "Je regarde surtout mes propres chronos. Les autres, je les vois le dimanche.",
          effets: { rep: { med: 1, pub: 2, pad: 3, rec: 2 } },
          retour: "Classique et solide." },
        { ton: "assure", texte: "Je le surveille comme il me surveille. C'est ça, un championnat.",
          effets: { rep: { med: 3, pub: 3, pad: 2, rec: 2 }, mental: 1 },
          retour: "Rivalité assumée, sans dérapage. Bonne matière pour la presse." },
        { ton: "provocateur", texte: "Il est devant pour l'instant. Profitez-en pour le photographier là.",
          effets: { rep: { med: 5, pub: 4, pad: -2, rec: 0 }, rivalite: 15 },
          retour: "Le duel est officiellement lancé dans les colonnes." },
        { ton: "humble", texte: "C'est un pilote que je respecte énormément. On apprend en se mesurant à lui.",
          effets: { rep: { med: 2, pub: 2, pad: 4, rec: 2 }, rivalite: -6 },
          retour: "Fair-play remarqué. L'intéressé a répondu par un message amical." },
        { ton: "evasif", texte: "Il y a vingt pilotes sur la grille, je ne vais pas en isoler un.",
          effets: { rep: { med: -1, pub: -1, pad: 2, rec: 1 } },
          retour: "Prudent au point d'être ennuyeux." }
      ]
    },
    {
      id: "rival_resultat", poids: 3,
      quand: function (c) { return !!c.rivalAuHasard && c.courses >= 2; },
      texte: function (c) {
        return "Que pensez-vous de la saison de " + nomCourt(c.rivalAuHasard) + " ?";
      },
      reponses: [
        { ton: "humble", texte: "Il roule très bien. Il n'y a pas grand-chose à redire à ce qu'il fait.",
          effets: { rep: { med: 1, pub: 1, pad: 3, rec: 1 }, rivalite: -5 },
          retour: "Reconnaissance sincère, bien reçue." },
        { ton: "mesure", texte: "Il a du rythme, une bonne voiture, et il en tire ce qu'il peut. Rien d'étonnant.",
          effets: { rep: { med: 2, pub: 1, pad: 2, rec: 2 } },
          retour: "Analyse posée. Le compliment est légèrement dosé." },
        { ton: "assure", texte: "Bonne saison. Mais on ne se juge pas sur des bonnes saisons, on se juge sur des titres.",
          effets: { rep: { med: 3, pub: 3, pad: 1, rec: 2 }, rivalite: 8 },
          retour: "Petite pique dans un compliment. L'exercice est maîtrisé." },
        { ton: "provocateur", texte: "Il profite d'une bonne voiture. Mettez-le dans la mienne, on rira moins.",
          effets: { rep: { med: 5, pub: 3, pad: -4, rec: -2 }, rivalite: 20 },
          retour: "Déclaration cinglante. La réponse ne s'est pas fait attendre." },
        { ton: "evasif", texte: "Je ne commente pas les performances des autres.",
          effets: { rep: { med: -2, pub: -1, pad: 2, rec: 0 } },
          retour: "Refus poli. La salle attendait mieux." }
      ]
    },

    /* ---------------------------------------------------------------
     * VOITURE, TECHNIQUE, ÉCURIE
     * ------------------------------------------------------------- */
    {
      id: "voiture", poids: 3,
      quand: function (c) { return c.courses >= 2 && !c.independant; },
      texte: function (c) {
        return "Où en est le développement de la voiture chez " + c.equipe + " ?";
      },
      reponses: [
        { ton: "mesure", texte: "On avance par petites touches. Il n'y a pas de solution miracle en une manche.",
          effets: { rep: { med: 2, pub: 0, pad: 3, rec: 3 }, confiance: 3 },
          retour: "Réponse technique appréciée par les spécialistes." },
        { ton: "assure", texte: "On a identifié les points faibles. Ce qui arrive va nous faire du bien.",
          effets: { rep: { med: 3, pub: 2, pad: 2, rec: 2 }, confiance: 2 },
          retour: "Optimisme mesuré, bien accueilli." },
        { ton: "humble", texte: "Les ingénieurs travaillent énormément. Mon rôle est de leur donner de bons retours.",
          effets: { rep: { med: 1, pub: 1, pad: 4, rec: 2 }, confiance: 6 },
          retour: "Le bureau d'études a apprécié d'être cité." },
        { ton: "provocateur", texte: "Il faudrait déjà qu'on arrive à faire fonctionner ce qu'on a.",
          effets: { rep: { med: 4, pub: 2, pad: -3, rec: -2 }, confiance: -12 },
          retour: "Critique publique de l'équipe. Ça ne passe jamais bien." },
        { ton: "evasif", texte: "Vous savez bien que je ne peux rien dire là-dessus.",
          effets: { rep: { med: -1, pub: -1, pad: 2, rec: 1 } },
          retour: "Confidentialité respectée. L'écurie n'en demandait pas tant." }
      ]
    },
    {
      id: "confiance_basse", poids: 4,
      quand: function (c) { return c.confiance < 40 && !c.independant; },
      texte: function (c) {
        return "On dit que la relation avec " + c.equipe + " s'est refroidie. Vous confirmez ?";
      },
      reponses: [
        { ton: "humble", texte: "On traverse une période difficile, et j'y ai ma part. On se parle, on avance.",
          effets: { rep: { med: 2, pub: 2, pad: 3, rec: 1 }, confiance: 10 },
          retour: "Main tendue en public. La direction sportive a apprécié le geste." },
        { ton: "mesure", texte: "Une équipe, ce n'est pas un long fleuve tranquille. Ce qui compte, c'est ce qu'on fait le dimanche.",
          effets: { rep: { med: 1, pub: 1, pad: 3, rec: 2 }, confiance: 4 },
          retour: "Sobre et juste. Le sujet retombe." },
        { ton: "assure", texte: "Je fais mon travail, ils font le leur. Le reste, c'est du bruit.",
          effets: { rep: { med: 2, pub: 2, pad: 0, rec: 1 } },
          retour: "Sec. Le bruit ne va pas retomber pour autant." },
        { ton: "provocateur", texte: "Refroidie ? Disons plutôt que certains devraient balayer devant leur porte.",
          effets: { rep: { med: 5, pub: 2, pad: -4, rec: -3 }, confiance: -15 },
          retour: "Le point de non-retour n'est pas loin. Réunion prévue lundi." },
        { ton: "evasif", texte: "Je ne réponds pas aux rumeurs.",
          effets: { rep: { med: -3, pub: -1, pad: 1, rec: 0 } },
          retour: "Ce silence-là ressemble beaucoup à une confirmation." }
      ]
    },

    /* ---------------------------------------------------------------
     * PROFIL, ÂGE, TRAJECTOIRE
     * ------------------------------------------------------------- */
    {
      id: "jeunesse", poids: 3,
      quand: function (c) { return c.jeune && c.courses >= 2; },
      texte: function (c) {
        return "À " + c.age + " ans, vous êtes parmi les plus jeunes du plateau. " +
               "L'expérience, ça vous manque ou ça vous libère ?";
      },
      reponses: [
        { ton: "assure", texte: "Ça me libère. Je n'ai pas de mauvaises habitudes à corriger.",
          effets: { rep: { med: 3, pub: 4, pad: 1, rec: 2 }, mental: 2 },
          retour: "Réponse fraîche, largement reprise." },
        { ton: "humble", texte: "Ça me manque, évidemment. J'apprends à chaque week-end en regardant les anciens.",
          effets: { rep: { med: 2, pub: 2, pad: 4, rec: 3 } },
          retour: "Humilité qui plaît beaucoup aux vétérans du paddock." },
        { ton: "mesure", texte: "Les deux. Il y a des courses où l'audace paie, d'autres où elle coûte cher.",
          effets: { rep: { med: 2, pub: 1, pad: 3, rec: 3 } },
          retour: "Lucidité rare pour son âge, souligne un éditorialiste." },
        { ton: "provocateur", texte: "L'expérience, c'est ce qu'on invoque quand on n'a plus la vitesse.",
          effets: { rep: { med: 5, pub: 4, pad: -4, rec: -1 }, rivalite: 12 },
          retour: "Deux pilotes expérimentés ont réagi. Sèchement." },
        { ton: "evasif", texte: "L'âge n'a jamais fait rouler personne plus vite.",
          effets: { rep: { med: 0, pub: 1, pad: 1, rec: 0 } },
          retour: "Formule courte, à peine citée." }
      ]
    },
    {
      id: "veteran", poids: 3,
      quand: function (c) { return c.veteran; },
      texte: function (c) {
        return "À " + c.age + " ans, combien de saisons vous reste-t-il à ce niveau ?";
      },
      reponses: [
        { ton: "assure", texte: "Autant que je serai rapide. Et je le suis toujours, regardez les chronos.",
          effets: { rep: { med: 3, pub: 3, pad: 2, rec: 2 }, mental: 2 },
          retour: "Réponse de compétiteur. Le message est passé." },
        { ton: "mesure", texte: "Je verrai saison après saison. Le jour où je ne prendrai plus de plaisir, j'arrêterai.",
          effets: { rep: { med: 2, pub: 3, pad: 3, rec: 1 } },
          retour: "Sincère et digne. Beau passage." },
        { ton: "humble", texte: "Ce n'est plus à moi d'en décider. Ce sont les résultats qui parlent.",
          effets: { rep: { med: 1, pub: 2, pad: 3, rec: 2 } },
          retour: "Lucidité touchante." },
        { ton: "provocateur", texte: "Assez pour battre encore quelques gamins qui pensent avoir déjà tout compris.",
          effets: { rep: { med: 5, pub: 4, pad: -2, rec: -1 }, rivalite: 12 },
          retour: "Le paddock s'amuse. Les jeunes pilotes un peu moins." },
        { ton: "evasif", texte: "Je n'y pense pas, et je préfère qu'on n'en parle pas.",
          effets: { rep: { med: -2, pub: -1, pad: 1, rec: 0 } },
          retour: "Sujet clos. Un peu abruptement." }
      ]
    },
    {
      id: "pression", poids: 3,
      quand: function (c) { return c.mental < 50; },
      texte: function (c) {
        return "On vous a trouvé tendu ces dernières semaines. Comment gérez-vous la pression ?";
      },
      reponses: [
        { ton: "humble", texte: "Je ne vais pas mentir, c'est une période exigeante. Je suis bien entouré.",
          effets: { rep: { med: 2, pub: 4, pad: 3, rec: 1 }, mental: 5 },
          retour: "Franchise rare sur ce sujet. Beaucoup de messages de soutien." },
        { ton: "mesure", texte: "La pression fait partie du métier. On apprend à la transformer en concentration.",
          effets: { rep: { med: 1, pub: 1, pad: 3, rec: 3 }, mental: 2 },
          retour: "Réponse maîtrisée, sans exposer de faille." },
        { ton: "assure", texte: "Tendu ? Concentré, plutôt. Ce n'est pas la même chose.",
          effets: { rep: { med: 2, pub: 2, pad: 1, rec: 2 }, mental: 1 },
          retour: "Le journaliste n'a pas insisté." },
        { ton: "provocateur", texte: "Je serais moins tendu si on me posait des questions sur le pilotage.",
          effets: { rep: { med: -3, pub: 1, pad: -2, rec: -1 }, mental: -1 },
          retour: "Le ton a jeté un froid dans la salle." },
        { ton: "evasif", texte: "Ça va très bien, merci.",
          effets: { rep: { med: -2, pub: -2, pad: 0, rec: 0 }, mental: -1 },
          retour: "Personne n'a été convaincu." }
      ]
    },

    /* ---------------------------------------------------------------
     * IMAGE, PUBLIC, GÉNÉRIQUES
     * ------------------------------------------------------------- */
    {
      id: "fans", poids: 2,
      quand: function (c) { return true; },
      texte: function (c) {
        return "Vos supporters seront nombreux ce week-end. Qu'est-ce que vous leur dites ?";
      },
      reponses: [
        { ton: "assure", texte: "Qu'ils viennent nombreux, on va leur donner de quoi crier.",
          effets: { rep: { med: 2, pub: 5, pad: 1, rec: 1 }, mental: 1 },
          retour: "Les tribunes ont relayé. Belle énergie." },
        { ton: "humble", texte: "Merci. Sincèrement. On ne mesure pas ce que ça change d'entendre son nom en piste.",
          effets: { rep: { med: 2, pub: 5, pad: 2, rec: 1 }, mental: 2 },
          retour: "Message très partagé sur les réseaux." },
        { ton: "mesure", texte: "Qu'on va tout donner, comme d'habitude. C'est la seule promesse que je peux tenir.",
          effets: { rep: { med: 1, pub: 2, pad: 2, rec: 2 } },
          retour: "Correct, sans étincelle." },
        { ton: "provocateur", texte: "Qu'ils regardent bien les rétroviseurs des autres, ils vont m'y voir souvent.",
          effets: { rep: { med: 4, pub: 4, pad: -1, rec: 0 }, rivalite: 6 },
          retour: "Formule qui a fait mouche auprès du public." },
        { ton: "evasif", texte: "Je préfère leur parler sur la piste.",
          effets: { rep: { med: -1, pub: 0, pad: 1, rec: 1 } },
          retour: "Réponse courte. On en attendait un peu plus." }
      ]
    },
    {
      id: "objectifs", poids: 2,
      quand: function (c) { return c.courses <= 4; },
      texte: function (c) {
        return "Quel est l'objectif de cette saison en " + c.cat + " ?";
      },
      reponses: [
        { ton: "assure", texte: "Le titre. Je ne vois pas pourquoi on viendrait chercher autre chose.",
          effets: { rep: { med: 3, pub: 4, pad: 0, rec: 3 }, mental: 2 },
          retour: "Objectif planté haut. Il faudra assumer." },
        { ton: "mesure", texte: "Progresser à chaque manche et être là quand les occasions se présentent.",
          effets: { rep: { med: 1, pub: 1, pad: 3, rec: 3 } },
          retour: "Réponse de pro. Aucune prise." },
        { ton: "humble", texte: "Rendre à l'équipe ce qu'elle m'a donné. Le reste suivra.",
          effets: { rep: { med: 1, pub: 2, pad: 4, rec: 2 }, confiance: 5 },
          retour: "Le garage l'a pris pour lui, et c'était le but." },
        { ton: "provocateur", texte: "Faire mieux que ceux qui parlent beaucoup et marquent peu.",
          effets: { rep: { med: 4, pub: 3, pad: -2, rec: 0 }, rivalite: 10 },
          retour: "Personne n'est nommé, mais chacun se demande s'il est visé." },
        { ton: "evasif", texte: "On verra où on en est à mi-saison.",
          effets: { rep: { med: -2, pub: -2, pad: 1, rec: 0 } },
          retour: "Frilosité notée par la presse." }
      ]
    },
    {
      id: "circuit_suivant", poids: 2,
      quand: function (c) { return true; },
      texte: function (c) {
        return "Ce tracé vous a rarement réussi. Comment l'abordez-vous cette fois ?";
      },
      reponses: [
        { ton: "mesure", texte: "En travaillant les secteurs où j'ai perdu du temps les années passées.",
          effets: { rep: { med: 2, pub: 1, pad: 3, rec: 3 } },
          retour: "Réponse préparée, sérieuse." },
        { ton: "assure", texte: "Les statistiques ne pilotent pas. Cette année, ce sera différent.",
          effets: { rep: { med: 2, pub: 3, pad: 1, rec: 1 }, mental: 1 },
          retour: "Confiance affichée." },
        { ton: "humble", texte: "C'est un tracé qui me demande plus d'efforts, je l'admets. J'ai beaucoup travaillé au simulateur.",
          effets: { rep: { med: 2, pub: 2, pad: 3, rec: 2 } },
          retour: "Honnêteté qui passe bien." },
        { ton: "provocateur", texte: "Rarement réussi ? Regardez avec quelle voiture j'y suis passé les autres fois.",
          effets: { rep: { med: 3, pub: 1, pad: -3, rec: -1 }, confiance: -8 },
          retour: "L'écurie n'a pas apprécié d'être mise en cause." },
        { ton: "evasif", texte: "Un circuit comme un autre.",
          effets: { rep: { med: -2, pub: -1, pad: 1, rec: 0 } },
          retour: "La salle attendait autre chose." }
      ]
    },
    {
      id: "media_perso", poids: 2,
      quand: function (c) { return c.reputation >= 45; },
      texte: function (c) {
        return "Votre notoriété a beaucoup grandi. Est-ce que ça change votre quotidien ?";
      },
      reponses: [
        { ton: "humble", texte: "Un peu. Mais je viens d'un milieu où on garde les pieds sur terre, ça aide.",
          effets: { rep: { med: 2, pub: 4, pad: 3, rec: 1 } },
          retour: "Portrait sympathique en préparation." },
        { ton: "mesure", texte: "Ça change l'attention autour, pas le travail. Le chrono ne s'intéresse pas à ma notoriété.",
          effets: { rep: { med: 2, pub: 2, pad: 3, rec: 2 } },
          retour: "Formule reprise en titre par deux médias." },
        { ton: "assure", texte: "C'est le signe qu'on fait les choses bien. Je ne vais pas m'en plaindre.",
          effets: { rep: { med: 3, pub: 3, pad: 1, rec: 2 }, mental: 1 },
          retour: "Décomplexé. Le public suit." },
        { ton: "provocateur", texte: "Ça change surtout le nombre de gens qui prétendent m'avoir toujours soutenu.",
          effets: { rep: { med: 4, pub: 3, pad: -2, rec: 0 } },
          retour: "Pique qui a bien circulé. Quelques susceptibilités froissées." },
        { ton: "evasif", texte: "Je ne fais pas attention à ça.",
          effets: { rep: { med: -2, pub: -2, pad: 1, rec: 0 } },
          retour: "Peu crédible, note un chroniqueur." }
      ]
    },
    {
      id: "independant", poids: 4,
      quand: function (c) { return c.independant; },
      texte: function (c) {
        return "Vous êtes sans écurie pour le moment. Comment traverse-t-on une période pareille ?";
      },
      reponses: [
        { ton: "assure", texte: "En restant prêt. Le jour où le téléphone sonne, il faut pouvoir dire oui.",
          effets: { rep: { med: 3, pub: 3, pad: 2, rec: 4 }, mental: 2 },
          retour: "Message clair adressé au marché." },
        { ton: "humble", texte: "C'est dur, je ne vais pas prétendre le contraire. Mais je n'ai jamais rien eu facilement.",
          effets: { rep: { med: 3, pub: 4, pad: 3, rec: 2 } },
          retour: "Sincérité qui touche. Plusieurs médias reprennent le passage." },
        { ton: "mesure", texte: "On travaille, mon agent démarche, et je garde la forme. C'est tout ce que je contrôle.",
          effets: { rep: { med: 1, pub: 1, pad: 3, rec: 3 } },
          retour: "Sobre et digne." },
        { ton: "provocateur", texte: "Je regarde rouler des pilotes que je battais il y a deux ans. Ça motive.",
          effets: { rep: { med: 5, pub: 3, pad: -3, rec: 1 }, rivalite: 12 },
          retour: "Déclaration remarquée. Certains se sont sentis visés." },
        { ton: "evasif", texte: "Je préfère ne pas m'étendre là-dessus.",
          effets: { rep: { med: -2, pub: -2, pad: 1, rec: -1 } },
          retour: "Occasion manquée de se rappeler au bon souvenir du paddock." }
      ]
    }
  ];

  /* ==================================================================
   * 5. LE MOTEUR
   *
   * On tire trois questions parmi celles dont la condition est remplie,
   * pondérées par leur poids, sans répétition dans la même conférence.
   * ================================================================== */
  var etat = { ctx: null, journaliste: null, questions: [], idx: 0, effets: [], repondu: false };

  function tirerQuestions(c) {
    var eligibles = QUESTIONS.filter(function (q) {
      try { return q.quand(c); } catch (e) { return false; }
    });
    /* Repli : si le contexte est trop pauvre, on garde les questions
       toujours valides plutôt que d'ouvrir un écran vide. */
    if (eligibles.length < NB_QUESTIONS) {
      QUESTIONS.forEach(function (q) {
        if (eligibles.indexOf(q) < 0 && q.poids <= 2) eligibles.push(q);
      });
    }

    var choisies = [];
    var reste = eligibles.slice();
    while (choisies.length < NB_QUESTIONS && reste.length) {
      var total = 0;
      reste.forEach(function (q) { total += (q.poids || 1); });
      var tirage = Math.random() * total;
      var pick = reste[reste.length - 1];
      for (var i = 0; i < reste.length; i++) {
        tirage -= (reste[i].poids || 1);
        if (tirage <= 0) { pick = reste[i]; break; }
      }
      choisies.push(pick);
      reste.splice(reste.indexOf(pick), 1);
    }
    return choisies;
  }

  /* ==================================================================
   * 6. LA MISE EN SCÈNE
   * ================================================================== */
  function injecterCSS() {
    if (document.getElementById(CSS_ID)) return;
    var css = [
      /* --- salle de presse -------------------------------------------- */
      "#rj100{--acc:#FF1801;padding:0 0 26px}",
      ".rj100-salle{position:relative;margin:12px 16px 0;padding:16px 15px 15px;border-radius:16px;overflow:hidden;" +
        "background:linear-gradient(165deg,rgba(255,255,255,.05),rgba(255,255,255,.015));" +
        "border:1px solid var(--border-hi,rgba(255,255,255,.14))}",
      ".rj100-salle::before{content:'';position:absolute;inset:0;pointer-events:none;" +
        "background:radial-gradient(120% 90% at 12% 0%,color-mix(in srgb,var(--acc) 14%,transparent),transparent 62%)}",
      ".rj100-salle > *{position:relative}",

      /* --- bandeau journaliste ---------------------------------------- */
      ".rj100-jrn{display:flex;align-items:center;gap:11px;margin-bottom:13px}",
      ".rj100-ini{width:40px;height:40px;border-radius:11px;flex-shrink:0;display:flex;align-items:center;" +
        "justify-content:center;font-family:var(--font-display);font-size:14px;font-weight:900;color:#0d0d12;" +
        "background:var(--acc);letter-spacing:.02em}",
      ".rj100-qui{flex:1;min-width:0}",
      ".rj100-nom{font-family:var(--font-display);font-size:13.5px;font-weight:800;color:#fff;line-height:1.2}",
      ".rj100-med{display:flex;align-items:center;gap:6px;margin-top:3px}",
      ".rj100-med .m{font-size:11px;color:var(--soft,#aeb6c6)}",
      ".rj100-med .p{font-family:var(--font-display);font-size:8.5px;font-weight:800;letter-spacing:.1em;" +
        "color:var(--muted,#8b93a7);border:1px solid rgba(255,255,255,.16);padding:1px 5px;border-radius:3px}",
      ".rj100-type{flex-shrink:0;font-family:var(--font-display);font-size:8.5px;font-weight:800;" +
        "letter-spacing:.08em;text-transform:uppercase;color:var(--acc);" +
        "background:color-mix(in srgb,var(--acc) 13%,transparent);" +
        "border:1px solid color-mix(in srgb,var(--acc) 40%,transparent);padding:3px 7px;border-radius:4px}",

      /* --- question ---------------------------------------------------- */
      ".rj100-q{position:relative;padding-left:15px;font-size:15.5px;line-height:1.5;color:#fff;font-weight:600}",
      ".rj100-q::before{content:'';position:absolute;left:0;top:3px;bottom:3px;width:3px;border-radius:2px;background:var(--acc)}",
      ".rj100-prog{display:flex;align-items:center;gap:7px;margin:14px 16px 4px}",
      ".rj100-prog .pt{flex:1;height:3px;border-radius:2px;background:rgba(255,255,255,.10)}",
      ".rj100-prog .pt.on{background:var(--acc)}",
      ".rj100-prog .n{font-family:var(--font-display);font-size:9px;font-weight:800;letter-spacing:.1em;" +
        "text-transform:uppercase;color:var(--text3,#6b7280)}",

      /* --- réponses ---------------------------------------------------- */
      ".rj100-lbl{font-family:var(--font-display);font-size:9.5px;font-weight:800;letter-spacing:.16em;" +
        "text-transform:uppercase;color:var(--text3,#6b7280);margin:14px 16px 8px}",
      ".rj100-reps{display:flex;flex-direction:column;gap:8px;padding:0 16px}",
      ".rj100-rep{display:flex;gap:11px;width:100%;padding:12px 13px;cursor:pointer;text-align:left;" +
        "background:var(--bg3,#16161d);border:1px solid rgba(255,255,255,.10);border-left:3px solid var(--t);" +
        "border-radius:11px;font-family:inherit;transition:transform .12s ease,border-color .12s ease}",
      ".rj100-rep:active{transform:scale(.99)}",
      ".rj100-rep .ic{width:20px;flex-shrink:0;text-align:center;color:var(--t);font-size:12px;padding-top:1px}",
      ".rj100-rep .co{flex:1;min-width:0;display:block}",
      ".rj100-rep .at{display:block;font-family:var(--font-display);font-size:9px;font-weight:800;" +
        "letter-spacing:.12em;text-transform:uppercase;color:var(--t);margin-bottom:5px}",
      ".rj100-rep .tx{display:block;font-size:13px;color:var(--text,#e8ebf2);line-height:1.45}",
      ".rj100-jrn .rj100-qui{display:block}",
      ".rj100-nom,.rj100-med{display:flex}",
      ".rj100-rep.off{opacity:.32;pointer-events:none}",
      ".rj100-rep.pick{border-color:var(--t);background:color-mix(in srgb,var(--t) 10%,var(--bg3,#16161d))}",

      /* --- retour après réponse ---------------------------------------- */
      ".rj100-ret{margin:12px 16px 0;padding:13px 14px;border-radius:12px;" +
        "background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.10)}",
      ".rj100-ret .t{font-family:var(--font-display);font-size:9px;font-weight:800;letter-spacing:.14em;" +
        "text-transform:uppercase;color:var(--acc);margin-bottom:6px}",
      ".rj100-ret .p{font-size:12.5px;color:var(--soft,#aeb6c6);line-height:1.5;font-style:italic}",
      ".rj100-eff{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}",
      ".rj100-eff span{font-family:var(--font-display);font-size:9px;font-weight:800;letter-spacing:.05em;" +
        "padding:3px 7px;border-radius:4px}",
      ".rj100-eff .up{color:#34D399;background:rgba(52,211,153,.12);border:1px solid rgba(52,211,153,.32)}",
      ".rj100-eff .dn{color:#F87171;background:rgba(248,113,113,.12);border:1px solid rgba(248,113,113,.32)}",

      ".rj100-act{padding:16px}",
      ".rj100-btn{width:100%;padding:14px;border:none;border-radius:12px;cursor:pointer;" +
        "font-family:var(--font-display);font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}",
      ".rj100-btn.go{background:var(--acc);color:#fff}",
      ".rj100-btn.fin{background:rgba(255,255,255,.07);color:var(--soft,#aeb6c6);border:1px solid rgba(255,255,255,.14)}",

      /* --- bilan -------------------------------------------------------- */
      ".rj100-bilan{margin:12px 16px 0}",
      ".rj100-bl{display:flex;align-items:center;gap:10px;padding:11px 13px;border-radius:11px;margin-bottom:7px;" +
        "background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.09)}",
      ".rj100-bl .q{flex:1;min-width:0;font-size:11.5px;color:var(--muted,#8b93a7);" +
        "overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".rj100-bl .a{font-family:var(--font-display);font-size:9px;font-weight:800;letter-spacing:.1em;" +
        "text-transform:uppercase;flex-shrink:0}",

      "@keyframes rj100-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}",
      "#rj100 .rj100-salle,#rj100 .rj100-reps,#rj100 .rj100-ret{animation:rj100-in .3s ease both}",
      "#rj100 .rj100-reps{animation-delay:.05s}",
      "@media (prefers-reduced-motion:reduce){#rj100 *{animation:none !important}}"
    ].join("\n");
    var st = document.createElement("style");
    st.id = CSS_ID; st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  /* ==================================================================
   * 7. RENDU
   * ================================================================== */
  function initiales(j) { return (j.prenom[0] + j.nom[0]).toUpperCase(); }

  function hote() {
    var scr = document.getElementById("S-mediaday");
    if (!scr) return null;
    var sc = scr.querySelector(".scroll");
    if (!sc) return null;
    var h = document.getElementById("rj100");
    if (!h) {
      /* On masque le contenu d'origine plutôt que de le supprimer : le
         module 06 continue d'exister, il n'est simplement plus affiché. */
      [].slice.call(sc.children).forEach(function (e) {
        if (e.id !== "rj100") e.style.display = "none";
      });
      h = document.createElement("div");
      h.id = "rj100";
      sc.appendChild(h);
    }
    return h;
  }

  function barreProgression() {
    var h = '<div class="rj100-prog">';
    for (var i = 0; i < etat.questions.length; i++) {
      h += '<span class="pt' + (i <= etat.idx ? " on" : "") + '"></span>';
    }
    return h + '<span class="n">' + (etat.idx + 1) + " / " + etat.questions.length + "</span></div>";
  }

  function badgesEffets(e) {
    var out = [];
    var axes = { med: "Médias", pub: "Public", pad: "Paddock", rec: "Recruteurs" };
    if (e.rep) {
      Object.keys(axes).forEach(function (k) {
        var v = e.rep[k];
        if (!v) return;
        out.push('<span class="' + (v > 0 ? "up" : "dn") + '">' + axes[k] + " " +
                 (v > 0 ? "+" : "") + v + "</span>");
      });
    }
    if (e.mental) out.push('<span class="' + (e.mental > 0 ? "up" : "dn") + '">Moral ' +
      (e.mental > 0 ? "+" : "") + e.mental + "</span>");
    if (e.confiance) out.push('<span class="' + (e.confiance > 0 ? "up" : "dn") + '">Écurie ' +
      (e.confiance > 0 ? "+" : "") + e.confiance + "</span>");
    if (e.rivalite) out.push('<span class="' + (e.rivalite > 0 ? "dn" : "up") + '">Tension ' +
      (e.rivalite > 0 ? "+" : "") + e.rivalite + "</span>");
    return out.length ? '<div class="rj100-eff">' + out.join("") + "</div>" : "";
  }

  function afficherQuestion() {
    var h = hote();
    if (!h) return;
    injecterCSS();

    var q = etat.questions[etat.idx];
    var j = etat.journaliste;
    var texte = "";
    try { texte = q.texte(etat.ctx, j); } catch (e) { texte = "…"; }

    h.style.setProperty("--acc", j.couleur);

    var html =
      '<div class="rj100-salle">' +
        '<div class="rj100-jrn">' +
          '<span class="rj100-ini">' + esc(initiales(j)) + '</span>' +
          '<span class="rj100-qui">' +
            '<span class="rj100-nom">' + esc(j.prenom + " " + j.nom) + '</span>' +
            '<span class="rj100-med"><span class="m">' + esc(j.media) + '</span>' +
            '<span class="p">' + esc(j.pays) + '</span></span>' +
          '</span>' +
          '<span class="rj100-type">' + esc(TONS_JOURNALISTE[j.ton] || "Question") + '</span>' +
        '</div>' +
        '<div class="rj100-q">« ' + esc(texte) + ' »</div>' +
      '</div>' +
      barreProgression() +
      '<div class="rj100-lbl">Votre réponse</div>' +
      '<div class="rj100-reps" id="rj100-reps">';

    q.reponses.forEach(function (r, i) {
      var a = ATTITUDES[r.ton] || ATTITUDES.mesure;
      html += '<button class="rj100-rep" data-i="' + i + '" style="--t:' + a.couleur + '">' +
                '<span class="ic">' + a.ico + '</span>' +
                '<span class="co"><span class="at">' + a.lbl + '</span>' +
                '<span class="tx">« ' + esc(r.texte) + ' »</span></span>' +
              '</button>';
    });

    html += '</div><div id="rj100-suite"></div>';
    h.innerHTML = html;

    var reps = document.getElementById("rj100-reps");
    reps.addEventListener("click", function (ev) {
      var b = ev.target.closest ? ev.target.closest(".rj100-rep") : null;
      if (!b || etat.repondu) return;
      choisir(parseInt(b.getAttribute("data-i"), 10), b);
    });
  }

  function choisir(i, bouton) {
    var q = etat.questions[etat.idx];
    var r = q.reponses[i];
    if (!r) return;
    etat.repondu = true;

    [].slice.call(document.querySelectorAll(".rj100-rep")).forEach(function (b) {
      b.classList.add(b === bouton ? "pick" : "off");
    });

    appliquer(r.effets);
    etat.effets.push({ question: q.texte(etat.ctx, etat.journaliste), ton: r.ton });

    var a = ATTITUDES[r.ton] || ATTITUDES.mesure;
    var dernier = etat.idx >= etat.questions.length - 1;
    document.getElementById("rj100-suite").innerHTML =
      '<div class="rj100-ret">' +
        '<div class="t">Réaction de la salle</div>' +
        '<div class="p">' + esc(r.retour) + '</div>' +
        badgesEffets(r.effets) +
      '</div>' +
      '<div class="rj100-act">' +
        '<button class="rj100-btn ' + (dernier ? "fin" : "go") + '" id="rj100-next">' +
          (dernier ? "Terminer la conférence" : "Question suivante") +
        '</button>' +
      '</div>';

    document.getElementById("rj100-next").addEventListener("click", function () {
      if (dernier) terminer(); else suivante();
    });

    try { if (typeof updateUI === "function") updateUI(); } catch (e) {}
  }

  function suivante() {
    etat.idx++;
    etat.repondu = false;
    /* Un journaliste différent par question, comme dans une vraie salle. */
    var autres = JOURNALISTES.filter(function (j) { return j !== etat.journaliste; });
    etat.journaliste = au_hasard(autres);
    afficherQuestion();
    try { document.getElementById("S-mediaday").querySelector(".scroll").scrollTop = 0; } catch (e) {}
  }

  /* ==================================================================
   * 8. EFFETS
   * ================================================================== */
  function appliquer(e) {
    var G = G_();
    if (!G || !e) return;
    try {
      if (e.rep && G.rep) {
        var cap = (typeof getRepCap === "function") ? getRepCap() : 100;
        if (e.rep.med) G.rep.medias = Math.max(0, Math.min(100, G.rep.medias + e.rep.med));
        if (e.rep.pub) G.rep.public = Math.max(0, Math.min(100, G.rep.public + e.rep.pub));
        if (e.rep.pad) G.rep.paddock = Math.max(0, Math.min(100, G.rep.paddock + e.rep.pad));
        if (e.rep.rec) G.rep.recruteurs = Math.max(0, Math.min(100, G.rep.recruteurs + e.rep.rec));
        if (typeof recomputeGlobalRep === "function") recomputeGlobalRep();
        else G.reputation = Math.min(cap, G.reputation);
      }
      if (e.mental && typeof PILOT_MENTAL !== "undefined" && PILOT_MENTAL) {
        PILOT_MENTAL.value = Math.max(0, Math.min(100, PILOT_MENTAL.value + e.mental));
      }
      if (e.confiance && typeof TEAM_TRUST !== "undefined" && TEAM_TRUST) {
        TEAM_TRUST.value = Math.max(0, Math.min(100, TEAM_TRUST.value + e.confiance));
      }
      if (e.rivalite && G._rivalries && G._rivalries[0]) {
        G._rivalries[0].intensity = Math.max(0, Math.min(100,
          (G._rivalries[0].intensity || 50) + e.rivalite));
      }
    } catch (err) { console.warn(TAG, "effets :", err && err.message); }
  }

  /* ==================================================================
   * 9. FIN DE CONFÉRENCE
   * ================================================================== */
  function terminer() {
    var h = hote();
    if (!h) return;

    var lignes = etat.effets.map(function (x) {
      var a = ATTITUDES[x.ton] || ATTITUDES.mesure;
      return '<div class="rj100-bl">' +
        '<span class="q">' + esc(String(x.question).slice(0, 58)) + '…</span>' +
        '<span class="a" style="color:' + a.couleur + '">' + a.lbl + '</span>' +
      '</div>';
    }).join("");

    h.innerHTML =
      '<div class="rj100-salle">' +
        '<div class="rj100-q">Conférence terminée. Les journalistes rangent leurs micros.</div>' +
      '</div>' +
      '<div class="rj100-lbl">Ce que vous avez dit</div>' +
      '<div class="rj100-bilan">' + lignes + '</div>' +
      '<div class="rj100-act"><button class="rj100-btn go" id="rj100-sortir">Retour</button></div>';

    document.getElementById("rj100-sortir").addEventListener("click", function () {
      /* La fonction d'origine compte la convocation mais ne quitte pas
         toujours l'écran : on assure le retour à l'accueil. */
      try { if (typeof window._rj100FinOrigine === "function") window._rj100FinOrigine(); } catch (e) {}
      try {
        var scr = document.getElementById("S-mediaday");
        if (scr && scr.classList.contains("on") && typeof navTo === "function") {
          navTo("S-home", "ni-home");
        }
      } catch (e) {}
      try { if (typeof updateUI === "function") updateUI(); } catch (e) {}
    });
  }

  /* ==================================================================
   * 10. INSTALLATION
   * ================================================================== */
  var _orig = {};

  function ouvrir() {
    injecterCSS();
    etat.ctx = contexte();
    etat.journaliste = au_hasard(JOURNALISTES);
    etat.questions = tirerQuestions(etat.ctx);
    etat.idx = 0;
    etat.effets = [];
    etat.repondu = false;

    try {
      var sub = document.getElementById("md-sub");
      if (sub) sub.textContent = etat.ctx.cat + " · conférence de presse";
    } catch (e) {}

    afficherQuestion();
  }

  function installer() {
    if (typeof window.openMediaDay !== "function") return false;
    if (window.openMediaDay._rj100) return true;

    _orig.openMediaDay = window.openMediaDay;
    window.openMediaDay = function () {
      /* La condition d'accès reste celle du module 99. */
      if (typeof window.mediaDayAvailable === "function" && !window.mediaDayAvailable()) return;
      try { if (typeof navTo === "function") navTo("S-mediaday", null); } catch (e) {}
      try { document.getElementById("main-nav").classList.add("show"); } catch (e) {}
      setTimeout(ouvrir, 40);
    };
    window.openMediaDay._rj100 = true;

    /* La fin de conférence passe toujours par le module d'origine, qui
       compte la convocation et referme proprement. */
    if (typeof window.endMediaDay === "function") window._rj100FinOrigine = window.endMediaDay;

    return true;
  }

  function boot() {
    var essais = 0;
    (function tenter() {
      if (installer()) {
        console.log(TAG, "salle de presse active — " + QUESTIONS.length +
                    " questions, " + JOURNALISTES.length + " journalistes");
        return;
      }
      if (essais++ < 80) setTimeout(tenter, 150);
    })();

    window._rj100 = {
      ouvrir: ouvrir, contexte: contexte, questions: QUESTIONS,
      journalistes: JOURNALISTES,
      eligibles: function () {
        var c = contexte();
        return QUESTIONS.filter(function (q) {
          try { return q.quand(c); } catch (e) { return false; }
        }).map(function (q) { return q.id; });
      }
    };
    window._rj100Uninstall = function () {
      if (_orig.openMediaDay) window.openMediaDay = _orig.openMediaDay;
      var h = document.getElementById("rj100"); if (h) h.remove();
      var c = document.getElementById(CSS_ID); if (c) c.remove();
      console.log(TAG, "désinstallé");
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
