/* =====================================================================
 * 106-moments-decisifs.js — LES INSTANTS QUI FONT LES LÉGENDES
 *
 * POURQUOI
 * Les événements de course affichent leurs probabilités : « 74 % réussite,
 * 26 % échec ». On choisit alors avec une calculatrice, pas avec les
 * tripes. Utile la plupart du temps — mais il manquait le contraire : le
 * moment où l'on décide sans savoir, où l'on engage la course entière sur
 * une intuition.
 *
 * CE QUE FAIT CE MODULE
 * Des MOMENTS DÉCISIFS : rares — au plus un par course, et pas à toutes
 * les courses —, deux choix seulement, aucun pourcentage affiché, et des
 * conséquences qui pèsent lourd. On gagne gros ou on perd gros.
 *
 * Chacun s'inspire d'un instant réel de l'histoire de la Formule 1. Les
 * situations sont évoquées, jamais les noms : ceux qui connaissent
 * reconnaîtront le déluge de Fuji, la chicane de Suzuka, le pneu d'Adélaïde
 * ou la dernière ligne droite d'Interlagos.
 *
 * Réversible : window._rj106Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[106-moments]";
  var CSS_ID = "rj106-css";

  function G_() { return (typeof window.G !== "undefined") ? window.G : null; }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function auHasard(t) { return t[Math.floor(Math.random() * t.length)]; }

  function pilotes() {
    try { return (window.LIVE_RACE && window.LIVE_RACE.drivers) || []; } catch (e) { return []; }
  }
  function moi() {
    var d = pilotes();
    for (var i = 0; i < d.length; i++) if (d[i].isPlayer) return d[i];
    return null;
  }
  function nomCourt(d) {
    if (!d || !d.name) return "le pilote de devant";
    var b = String(d.name).trim().split(/\s+/);
    return b.length > 1 ? b.slice(1).join(" ") : b[0];
  }
  function devant() {
    var m = moi(); if (!m) return null;
    var r = null;
    pilotes().forEach(function (d) { if (d && d.pos === m.pos - 1) r = d; });
    return r;
  }
  function coequipier() {
    var G = G_(); var r = null;
    pilotes().forEach(function (d) {
      if (d && !d.isPlayer && d.team && G && d.team === G.currentTeam) r = d;
    });
    return r;
  }

  function pluie() {
    try {
      var w = (window.RACE_STATE && window.RACE_STATE.weather) || {};
      return w.id === "wet" || w.id === "storm";
    } catch (e) { return false; }
  }
  /* Une écurie de pointe est une écurie dont la voiture figure parmi les
     meilleures : c'est ce qui rend le résultat inattendu, ou non. */
  function dansUneGrandeEcurie() {
    try {
      var G = G_();
      if (!G || !G.currentTeam) return false;
      if (typeof window.TEAM_RATINGS === "undefined") return false;
      var notes = [];
      var cle = G.currentTeam + "_" + G.saison;
      var moi = window.TEAM_RATINGS[cle];
      if (!moi) return false;
      var valeur = moi[G.cat];
      if (typeof valeur !== "number") return false;
      Object.keys(window.TEAM_RATINGS).forEach(function (k) {
        var v = window.TEAM_RATINGS[k] && window.TEAM_RATINGS[k][G.cat];
        if (typeof v === "number") notes.push(v);
      });
      if (notes.length < 4) return false;
      notes.sort(function (a, b) { return b - a; });
      /* Le tiers supérieur du plateau. */
      return valeur >= notes[Math.floor(notes.length / 3)];
    } catch (e) { return false; }
  }

  function avancement() {
    try {
      var L = window.LIVE_RACE;
      return (L && L.total) ? (L.cur / L.total) : 0;
    } catch (e) { return 0; }
  }

  /* ==================================================================
   * LES DISCIPLINES CONCERNÉES
   *
   * Ces moments n'ont de sens que dans les catégories où le sport se joue
   * à ce niveau d'enjeu. Un pilote de karting junior n'a pas de muret qui
   * lui demande de céder une place, pas de voiture de sécurité, pas de
   * commissaire sportif qui lui inflige dix secondes d'arrêt.
   *
   * Chaque moment déclare les disciplines où il peut survenir. Certains
   * sont universels — un déluge est un déluge partout —, d'autres tiennent
   * à la nature même du championnat : les ovales pour l'IndyCar, la nuit
   * et les relais pour l'endurance, la brutalité des pneus japonais pour
   * la Super Formula.
   * ================================================================== */
  var PHARES = ["Formule 1", "Super Formula", "Endurance WEC", "IndyCar"];

  function categorie() {
    try { return (G_() || {}).cat || ""; } catch (e) { return ""; }
  }
  function dansCategorie(liste) {
    var c = categorie();
    if (!liste || !liste.length) return PHARES.indexOf(c) >= 0;
    return liste.indexOf(c) >= 0;
  }

  /* ==================================================================
   * LE CATALOGUE
   *
   * Chaque moment : une condition, une mise en scène, deux issues.
   * « gain » et « perte » se lisent en places gagnées ou perdues ;
   * « abandon » est la probabilité de casse, jamais affichée.
   * ================================================================== */
  var MOMENTS = [
    {
      id: "deluge",
      cats: ["Formule 1", "Super Formula", "Endurance WEC", "IndyCar"],
      /* Fuji 1976 : la pluie tombe si fort que certains rentrent au stand
         et renoncent au titre plutôt que de risquer leur vie. */
      quand: function () { return pluie() && avancement() > 0.15; },
      titre: "Le déluge",
      recit: "L'eau ne s'évacue plus. Sur la ligne droite, tu roules à l'aveugle, " +
             "guidé par une lueur rouge devant toi. Deux voitures viennent de partir " +
             "en aquaplaning au même endroit. La direction de course hésite à " +
             "neutraliser.",
      question: "Personne ne t'en voudra de rentrer.",
      choix: [
        { label: "Rentrer au stand",
          detail: "Personne ne juge un pilote qui refuse l'impossible.",
          resultat: { gain: -4, perte: 0, abandon: 0, mental: 3,
            texte: "Tu lèves le pied et rentres. Certains diront que c'était sage. " +
                   "Tu es de ceux-là." } },
        { label: "Continuer à l'aveugle",
          detail: "Ceux de devant ne voient pas mieux que toi.",
          resultat: { gain: 6, perte: 5, abandon: 0.30, mental: -2,
            texte: "Tu gardes le pied dedans. Le monde se réduit à une lueur rouge " +
                   "et au bruit de l'eau sous le plancher." } }
      ]
    },
    {
      id: "chicane",
      cats: ["Formule 1", "Super Formula"],
      /* Suzuka 1989 et 1990 : la chicane, la porte qui se ferme, et un
         championnat qui bascule sur une seule trajectoire. */
      quand: function () { var d = devant(); return !!d && avancement() > 0.55; },
      titre: "La porte se referme",
      recit: function () {
        return "Dernier freinage de la chicane. Tu es à l'intérieur, " +
               nomCourt(devant()) + " referme sa trajectoire. Il ne te voit pas. " +
               "Ou il fait comme s'il ne te voyait pas.";
      },
      question: "Il reste un espace. Peut-être.",
      choix: [
        { label: "Lever le pied",
          detail: "Il y aura d'autres tours, d'autres courses.",
          resultat: { gain: 0, perte: 1, abandon: 0, mental: -1,
            texte: "Tu relâches. Il passe, tu restes derrière. La sagesse a un goût amer." } },
        { label: "Ne pas lever",
          detail: "L'espace existe tant que personne ne cède.",
          resultat: { gain: 3, perte: 0, abandon: 0.38, rivalite: 25, mental: 2,
            texte: "Aucun des deux ne lève. Le contact est inévitable." } }
      ]
    },
    {
      id: "pneu",
      cats: ["Formule 1", "Super Formula", "IndyCar"],
      /* Adélaïde 1986 : un pneu explose à pleine vitesse dans la dernière
         course, et le titre s'envole en une seconde. */
      quand: function () { return avancement() > 0.65; },
      titre: "La vibration",
      recit: "Depuis trois tours, le volant vibre dans la ligne droite. Léger, " +
             "d'abord. Maintenant tu le sens dans les avant-bras. Le stand n'a rien " +
             "vu sur les données. Toi, tu sais ce que ça veut dire.",
      question: "La ligne droite fait trois cents à l'heure.",
      choix: [
        { label: "Rentrer immédiatement",
          detail: "Tu perds la position. Tu gardes la voiture.",
          resultat: { gain: -3, perte: 0, abandon: 0, mental: 1,
            texte: "Les mécaniciens regardent le pneu et ne disent rien. " +
                   "Il n'aurait pas tenu deux tours." } },
        { label: "Tenir jusqu'au bout",
          detail: "Il reste peu de tours. Peut-être assez.",
          resultat: { gain: 4, perte: 6, abandon: 0.42, mental: -1,
            texte: "Tu serres le volant et tu comptes les virages." } }
      ]
    },
    {
      id: "trois_roues",
      cats: ["Formule 1", "Super Formula", "IndyCar"],
      /* Zandvoort 1979 : un tour entier sur trois roues, l'arrière traînant
         sur la piste, parce qu'abandonner ne se conçoit pas. */
      quand: function () { return avancement() > 0.35; },
      titre: "Trois roues",
      recit: "Le contact était léger, la conséquence non : la roue arrière gauche " +
             "pend au bout de sa suspension. Les stands sont à un tour complet. " +
             "La voiture tire, la jante mord l'asphalte et lâche des étincelles.",
      question: "Un tour. Un seul.",
      choix: [
        { label: "S'arrêter là",
          detail: "La voiture est finie. Autant la préserver.",
          resultat: { gain: 0, perte: 0, abandon: 1.0, mental: -2,
            texte: "Tu ranges la voiture au bord de la piste et tu retires ton casque." } },
        { label: "Ramener la voiture",
          detail: "Un pilote ne laisse pas sa voiture en piste.",
          resultat: { gain: -6, perte: 0, abandon: 0.55, mental: 4, reputation: 6,
            texte: "Tu boucles le tour sur trois roues, dans un vacarme de métal. " +
                   "Les tribunes sont debout." } }
      ]
    },
    {
      id: "derniere_ligne",
      cats: ["Formule 1", "Super Formula", "IndyCar"],
      /* Interlagos 2008 : un titre gagné dans le dernier virage du dernier
         tour de la dernière course. */
      quand: function () {
        var m = moi(); var d = devant();
        return !!d && avancement() > 0.93 && m && m.pos <= 8;
      },
      titre: "Dernier tour",
      recit: function () {
        return "Dernier tour, dernier secteur. " + nomCourt(devant()) + " est à " +
               "portée d'aspiration. Il défend l'intérieur, comme il l'a fait tout " +
               "le week-end. La ligne d'arrivée est derrière le dernier virage.";
      },
      question: "Il n'y aura pas de tour suivant.",
      choix: [
        { label: "Attendre la sortie",
          detail: "Prendre l'extérieur et compter sur la motricité.",
          resultat: { gain: 1, perte: 0, abandon: 0.05, mental: 1,
            texte: "Tu prends l'extérieur, plus large, plus long. Tout se joue sur " +
                   "les cent derniers mètres." } },
        { label: "Plonger à l'intérieur",
          detail: "Freiner plus tard que lui. Beaucoup plus tard.",
          resultat: { gain: 2, perte: 3, abandon: 0.22, rivalite: 15, mental: 2,
            texte: "Tu retardes le freinage au-delà du raisonnable et tu plonges." } }
      ]
    },
    {
      id: "consigne",
      cats: ["Formule 1", "Super Formula"],
      /* Autriche 2002, Malaisie 2013 : l'écurie demande, le pilote obéit
         ou non, et le paddock en parle pendant des années. */
      quand: function () {
        var c = coequipier(); var m = moi();
        return !!(c && m && c.pos === m.pos - 1 && avancement() > 0.6);
      },
      titre: "Consigne d'équipe",
      recit: function () {
        return "La radio grésille. La voix du muret est plus lente que d'habitude, " +
               "comme si elle pesait chaque mot : maintiens la position derrière " +
               nomCourt(coequipier()) + ". C'est la stratégie de l'équipe. " +
               "Tu es plus rapide que lui depuis dix tours.";
      },
      question: "Le muret attend une réponse.",
      choix: [
        { label: "Respecter la consigne",
          detail: "L'équipe passe avant. C'est le contrat.",
          resultat: { gain: 0, perte: 0, abandon: 0, confiance: 12, mental: -3,
            texte: "Tu restes derrière. Le garage te remercie. Toi, tu ne dis rien." } },
        { label: "Passer quand même",
          detail: "Personne ne se souvient de ceux qui obéissent.",
          resultat: { gain: 1, perte: 0, abandon: 0.08, confiance: -22, reputation: 5,
            mental: 3, texte: "Tu passes à l'extérieur au virage suivant. La radio " +
                   "reste muette jusqu'à l'arrivée." } }
      ]
    },
    {
      id: "safety_final",
      cats: ["Formule 1", "IndyCar"],
      /* Abou Dabi 2021 : une neutralisation tardive, un choix de pneus, et
         un championnat qui change de mains en un tour. */
      quand: function () { return avancement() > 0.82; },
      titre: "Neutralisation tardive",
      recit: "Voiture de sécurité à cinq tours de la fin. Le peloton se regroupe, " +
             "ton avance fond. Le muret te laisse le choix : des gommes fraîches " +
             "et tout à refaire, ou rester dehors sur des pneus finis.",
      question: "La relance décidera de tout.",
      choix: [
        { label: "Rester en piste",
          detail: "Garder la position, tenir sur ce qu'il reste.",
          resultat: { gain: 0, perte: 4, abandon: 0.04, mental: -1,
            texte: "Tu restes dehors. À la relance, tes pneus sont froids et " +
                   "usés, ceux de derrière ne le sont pas." } },
        { label: "Pneus neufs",
          detail: "Tout perdre au stand pour tout reprendre en piste.",
          resultat: { gain: 5, perte: 4, abandon: 0.06, mental: 2,
            texte: "Tu plonges aux stands. Tu ressors loin, avec des gommes " +
                   "qui collent à la piste." } }
      ]
    },
    {
      id: "carambolage",
      cats: ["Formule 1", "Super Formula", "Endurance WEC", "IndyCar"],
      /* Spa 1998 : treize voitures détruites au premier virage, sous la
         pluie, en quelques secondes. */
      quand: function () { return avancement() < 0.12 && (pluie() || Math.random() < 0.5); },
      titre: "Le mur d'eau",
      recit: "Premier virage, premier tour. Devant toi, la gerbe d'eau devient un " +
             "mur opaque. Quelque chose se passe là-dedans — des freins qui " +
             "s'allument, un bruit sourd, des débris qui rebondissent sur la piste.",
      question: "Tu as une demi-seconde.",
      choix: [
        { label: "Freiner et viser l'herbe",
          detail: "Sortir de la trajectoire, quitte à tout perdre.",
          resultat: { gain: -5, perte: 0, abandon: 0.05, mental: 1,
            texte: "Tu pars dans l'herbe, tu contournes le carnage et tu rejoins " +
                   "la piste bon dernier. Intact." } },
        { label: "Traverser",
          detail: "Trouver l'espace entre les voitures. S'il existe.",
          resultat: { gain: 7, perte: 0, abandon: 0.45, mental: 3,
            texte: "Tu vises l'ouverture entrevue et tu maintiens ta trajectoire." } }
      ]
    },
    {
      id: "remontee",
      cats: ["Formule 1", "Super Formula", "Endurance WEC", "IndyCar"],
      /* Nürburgring 1957 : cinquante secondes de retard, dix tours, et le
         record du tour battu neuf fois de suite. */
      quand: function () { var m = moi(); return !!m && m.pos >= 8 && avancement() > 0.4 && avancement() < 0.8; },
      titre: "Le retard",
      recit: "Le muret annonce l'écart : il est énorme. Trop grand pour être comblé " +
             "en roulant normalement. Il reste assez de tours pour tenter quelque " +
             "chose, pas assez pour le faire prudemment.",
      question: "Il faudrait battre le record à chaque tour.",
      choix: [
        { label: "Gérer et rapporter des points",
          detail: "Un résultat correct vaut mieux qu'un abandon.",
          resultat: { gain: 1, perte: 0, abandon: 0.02, mental: 0,
            texte: "Tu roules juste, tu gardes la voiture, tu marques ce qu'il y " +
                   "avait à marquer." } },
        { label: "Tout donner à chaque tour",
          detail: "Attaquer jusqu'à ce que la voiture ou le chrono cède.",
          resultat: { gain: 6, perte: 2, abandon: 0.28, mental: 4, reputation: 5,
            texte: "Tu attaques chaque virage comme si c'était un tour de " +
                   "qualification. Le muret arrête de parler." } }
      ]
    },
    {
      id: "attrition",
      cats: ["Formule 1", "Super Formula", "Endurance WEC", "IndyCar"],
      /* Monaco 1996 : trois voitures à l'arrivée, et un vainqueur parti
         quatorzième. */
      quand: function () {
        var casses = pilotes().filter(function (d) { return d && d.dnf; }).length;
        return casses >= 4 && avancement() > 0.5;
      },
      titre: "L'hécatombe",
      recit: "Un tiers du plateau est déjà à l'arrêt. Les dépanneuses n'arrêtent pas. " +
             "Le muret te répète la même chose depuis dix tours : ramène la voiture. " +
             "Devant, ceux qui restent commettent des erreurs.",
      question: "Finir suffirait peut-être.",
      choix: [
        { label: "Ramener la voiture",
          detail: "À ce rythme, terminer sera déjà un exploit.",
          resultat: { gain: 2, perte: 0, abandon: 0.03, mental: 1,
            texte: "Tu lèves d'un cran et tu comptes les tours. Devant, un autre " +
                   "part à la faute." } },
        { label: "Profiter du chaos",
          detail: "Ceux qui restent sont fatigués. Toi aussi.",
          resultat: { gain: 5, perte: 3, abandon: 0.25, mental: 2,
            texte: "Tu accélères quand tout le monde ralentit." } }
      ]
    },
    {
      id: "aspiration",
      cats: ["Formule 1", "Super Formula", "IndyCar"],
      /* Monza 1971 : quatre voitures séparées par un centième après trois
         cents kilomètres d'aspiration. */
      quand: function () {
        var m = moi(); var d = devant();
        return !!(d && m && m.pos <= 6 && avancement() > 0.75);
      },
      titre: "Le peloton d'aspiration",
      recit: function () {
        return "Vous êtes quatre en file, à quelques dixièmes, depuis vingt tours. " +
               "Chacun sait que celui qui mènera à l'entrée de la dernière ligne " +
               "droite perdra. " + nomCourt(devant()) + " ralentit exprès pour ne " +
               "pas être devant trop tôt.";
      },
      question: "Le timing est tout.",
      choix: [
        { label: "Rester dans l'aspiration",
          detail: "Attendre la dernière ligne droite pour se déboîter.",
          resultat: { gain: 2, perte: 1, abandon: 0.03, mental: 1,
            texte: "Tu restes collé, tu attends, et tu te déboîtes au dernier moment." } },
        { label: "Attaquer maintenant",
          detail: "Prendre la tête et tenir jusqu'au drapeau.",
          resultat: { gain: 3, perte: 3, abandon: 0.05, mental: 1,
            texte: "Tu prends la tête et tu défends. Ils sont trois dans tes " +
                   "rétroviseurs, et ils ont l'aspiration." } }
      ]
    },
    {
      id: "secours",
      cats: ["Formule 1", "Super Formula", "Endurance WEC", "IndyCar"],
      /* Nürburgring 1976 : quatre pilotes s'arrêtent et se jettent dans les
         flammes pour extraire un concurrent de sa voiture. Aucun n'a
         terminé la course. Tous ont sauvé une vie. */
      quand: function () { return avancement() > 0.2 && avancement() < 0.8; },
      titre: "Les flammes",
      recit: "Sortie du virage rapide : une voiture est en travers, contre le rail, " +
             "et elle brûle. Le pilote bouge encore à l'intérieur. Les commissaires " +
             "sont à deux cents mètres, ils courent, mais ils sont loin. " +
             "Tu es le premier sur les lieux.",
      question: "Tu es le seul à pouvoir arriver à temps.",
      choix: [
        { label: "Continuer, les secours arrivent",
          detail: "Ce n'est pas ton rôle. Ils sont formés pour ça.",
          resultat: { gain: 1, perte: 0, abandon: 0, mental: -6,
            texte: "Tu passes. Dans le rétroviseur, la fumée noircit. Tu apprendras " +
                   "après la course qu'il s'en est sorti. Tu y penseras longtemps." } },
        { label: "S'arrêter et le sortir de là",
          detail: "Une course n'a pas ce prix.",
          resultat: { gain: 0, perte: 0, abandon: 1.0, mental: 8, reputation: 25,
            texte: "Tu ranges la voiture, tu cours, et tu le tires hors du cockpit " +
                   "avec les autres. Ta course est finie. Le paddock entier le saura." } }
      ]
    },
    {
      id: "sortie_volontaire",
      cats: ["Formule 1", "Super Formula"],
      /* Jerez 1997 : le leader du championnat braque volontairement sur son
         rival qui le dépasse. La manœuvre échoue, et lui coûte tout. */
      quand: function () {
        var m = moi(); var d = devant();
        return !!(d && m && m.pos <= 4 && avancement() > 0.7);
      },
      titre: "Le virage de trop",
      recit: function () {
        return nomCourt(devant()) + " vient de plonger à l'intérieur. Il a réussi " +
               "son freinage, tu as perdu la position. Vous vous battez pour le " +
               "championnat, et tu sais exactement ce qu'une roue dans son flanc " +
               "produirait maintenant.";
      },
      question: "Le volant est encore entre tes mains.",
      choix: [
        { label: "Le laisser passer",
          detail: "Il y a d'autres tours. Il y a d'autres courses.",
          resultat: { gain: 0, perte: 1, abandon: 0.02, mental: -2,
            texte: "Tu ouvres la trajectoire. Il s'en va. Tu ravales quelque chose " +
                   "et tu continues à rouler." } },
        { label: "Fermer sur lui",
          detail: "S'il ne passe pas, le championnat reste ouvert.",
          resultat: { gain: 0, perte: 2, abandon: 0.50, rivalite: 40, reputation: -12,
            mental: -3,
            texte: "Tu braques. Le contact est violent et personne ne s'y trompera : " +
                   "les caméras ont tout vu." } }
      ]
    },
    {
      id: "avance_confortable",
      cats: ["Formule 1", "Super Formula", "Endurance WEC", "IndyCar"],
      /* Monaco 1988 : une minute d'avance, une seconde d'inattention, et le
         rail. Le pilote rentre chez lui à pied sans parler à personne. */
      quand: function () {
        var m = moi();
        return !!(m && m.pos === 1 && avancement() > 0.6);
      },
      titre: "L'avance",
      recit: "Tu mènes avec une avance considérable. Le muret te demande de lever " +
             "le pied, de ramener la voiture, de ne rien tenter. Mais tu es dans un " +
             "de ces états où chaque virage se présente parfaitement, où tu pourrais " +
             "encore aller plus vite.",
      question: "Personne ne te demande d'aller plus vite.",
      choix: [
        { label: "Lever le pied",
          detail: "La victoire est faite. Il suffit de la ramener.",
          resultat: { gain: 0, perte: 0, abandon: 0.02, mental: 0,
            texte: "Tu ralentis d'une seconde au tour. C'est long, un dernier relais " +
                   "quand on gère." } },
        { label: "Continuer à attaquer",
          detail: "Ces sensations-là ne reviennent pas souvent.",
          resultat: { gain: 0, perte: 0, abandon: 0.34, mental: 4, reputation: 4,
            texte: "Tu continues à tourner au rythme des qualifications, seul en " +
                   "piste, pour personne d'autre que toi." } }
      ]
    },
    {
      id: "pneu_dernier_tour",
      cats: ["Formule 1", "Super Formula", "IndyCar"],
      /* Silverstone 2020 : un pneu avant explose dans le dernier tour et le
         leader termine sur trois roues, à quelques secondes de la meute. */
      quand: function () {
        var m = moi();
        return !!(m && m.pos <= 5 && avancement() > 0.95);
      },
      titre: "Crevaison",
      recit: "Dernier tour. Le pneu avant gauche part en lambeaux dans le virage " +
             "rapide. La voiture tire violemment, le volant se bat contre tes bras. " +
             "L'arrivée est à un tiers de tour. Derrière, ils reviennent à toute allure.",
      question: "Un tiers de tour, sur trois roues.",
      choix: [
        { label: "Ralentir et sécuriser",
          detail: "Perdre des places mais franchir la ligne.",
          resultat: { gain: -4, perte: 0, abandon: 0.06, mental: 0,
            texte: "Tu rampes jusqu'à l'arrivée. Trois voitures te passent dans les " +
                   "derniers mètres." } },
        { label: "Maintenir l'allure",
          detail: "Tenir le rythme et espérer que ça tienne.",
          resultat: { gain: 0, perte: 3, abandon: 0.35, mental: 4, reputation: 6,
            texte: "Tu gardes le pied dedans, la jante frotte, les étincelles " +
                   "éclairent le bas-côté." } }
      ]
    },
    {
      id: "depart_pluie",
      cats: ["Formule 1", "Super Formula"],
      /* Hongrie 2021 : toute la grille rentre aux stands changer de pneus au
         tour de formation, et un pilote se retrouve seul sur la ligne. */
      quand: function () { return avancement() < 0.1 && pluie(); },
      titre: "Seul sur la grille",
      recit: "Tour de formation. La piste sèche à vue d'œil et tout le monde plonge " +
             "aux stands pour chausser des gommes lisses. Tu es le seul à ne pas " +
             "avoir suivi. Dans une minute, tu seras seul sur la ligne de départ, " +
             "avec des pneus pluie sur une piste qui sèche.",
      question: "Il est encore temps de les suivre.",
      choix: [
        { label: "Rentrer comme les autres",
          detail: "Ne pas se singulariser. Suivre le peloton.",
          resultat: { gain: -1, perte: 0, abandon: 0.02, mental: 0,
            texte: "Tu suis le mouvement et reprends ta place dans la file." } },
        { label: "Rester en piste",
          detail: "S'il repleut, tu seras seul devant.",
          resultat: { gain: 6, perte: 5, abandon: 0.10, mental: 3, reputation: 5,
            texte: "Tu t'alignes seul sur la grille, moteur au ralenti, pendant que " +
                   "les autres se pressent dans la voie des stands." } }
      ]
    },
    {
      id: "chaleur",
      cats: ["Formule 1", "IndyCar", "Endurance WEC"],
      /* Dallas 1984 : quarante degrés, la piste se désagrège, les murs se
         rapprochent à chaque tour et la moitié du plateau s'écrase. */
      quand: function () {
        try {
          var w = (window.RACE_STATE && window.RACE_STATE.weather) || {};
          return w.id === "hot" && avancement() > 0.4;
        } catch (e) { return false; }
      },
      titre: "La piste se défait",
      recit: "La chaleur fait éclater le revêtement. À chaque tour, la trajectoire " +
             "se couvre un peu plus de gravillons et les murs semblent se rapprocher. " +
             "Dans le cockpit, tu ne sens plus tes mains à force de corriger.",
      question: "Ceux de devant ralentissent aussi.",
      choix: [
        { label: "Rouler large et propre",
          detail: "Éviter les débris, préserver la voiture et soi-même.",
          resultat: { gain: 1, perte: 0, abandon: 0.05, mental: -1,
            texte: "Tu prends des trajectoires inhabituelles, loin des murs. C'est " +
                   "plus lent, mais tu es encore là." } },
        { label: "Garder la trajectoire",
          detail: "La ligne est la plus rapide. Elle l'est encore.",
          resultat: { gain: 5, perte: 3, abandon: 0.32, mental: 2,
            texte: "Tu restes sur la corde, entre les gravillons et le béton." } }
      ]
    },
    {
      id: "petite_ecurie",
      cats: ["Formule 1", "Super Formula", "Endurance WEC", "IndyCar"],
      /* Hungaroring 1997 : une écurie de fond de grille mène la course à
         trois tours de l'arrivée, avant qu'une pièce ne lâche. */
      quand: function () {
        var m = moi();
        return !!(m && m.pos <= 3 && avancement() > 0.8 && !dansUneGrandeEcurie());
      },
      titre: "Là où personne ne t'attendait",
      recit: "Tu es dans les trois premiers, et personne n'avait prévu ça — ni les " +
             "commentateurs, ni les autres écuries, ni ton propre garage. La radio " +
             "est étrangement silencieuse. Le muret n'ose pas y croire, et la boîte " +
             "commence à accrocher au passage de la troisième.",
      question: "Il reste peu de tours.",
      choix: [
        { label: "Ménager la mécanique",
          detail: "Passer les rapports en douceur et ramener le résultat.",
          resultat: { gain: 0, perte: 1, abandon: 0.08, mental: 1,
            texte: "Tu roules en épargnant la boîte, en priant pour chaque rapport." } },
        { label: "Ne rien changer",
          detail: "Ce résultat ne se représentera peut-être jamais.",
          resultat: { gain: 2, perte: 0, abandon: 0.30, mental: 4, reputation: 8,
            texte: "Tu ne changes rien à ton rythme. La boîte tiendra ou ne tiendra pas." } }
      ]
    },
    {
      id: "defense",
      cats: ["Formule 1", "Super Formula", "IndyCar"],
      /* Imola 2005 et 2006 : douze tours de défense sans la moindre erreur,
         avec une voiture plus rapide collée dans les échappements. */
      quand: function () {
        var m = moi();
        var derriere = null;
        pilotes().forEach(function (d) { if (d && m && d.pos === m.pos + 1) derriere = d; });
        return !!(derriere && m && m.pos <= 6 && avancement() > 0.7);
      },
      titre: "Dans les échappements",
      recit: "Il est là depuis dix tours, à moins d'une seconde, et il est plus " +
             "rapide que toi. Tu connais son point de freinage, il connaît le tien. " +
             "Une seule sortie de virage manquée et c'est réglé.",
      question: "Il reste beaucoup de tours.",
      choix: [
        { label: "Défendre proprement",
          detail: "Tenir la corde, ne jamais bloquer deux fois.",
          resultat: { gain: 0, perte: 1, abandon: 0.03, mental: 2,
            texte: "Tu défends au millimètre, sans jamais sortir du cadre. Chaque " +
                   "tour est un exercice de sang-froid." } },
        { label: "Tout verrouiller",
          detail: "Fermer chaque porte, quitte à user les pneus et la patience.",
          resultat: { gain: 0, perte: 0, abandon: 0.18, rivalite: 20, mental: 1,
            texte: "Tu fermes tout, systématiquement. Derrière, la patience s'épuise." } }
      ]
    },
    {
      id: "remontee_pluie",
      cats: ["Formule 1", "Super Formula", "Endurance WEC"],
      /* Montréal 2011 : quatre heures de course, une pénalité, un tour de
         retard, et une victoire arrachée au dernier virage. */
      quand: function () {
        var m = moi();
        return !!(m && pluie() && m.pos >= 12 && avancement() > 0.3 && avancement() < 0.75);
      },
      titre: "Dernier de la file",
      recit: "Tu es en fond de classement, la course dure depuis une éternité et " +
             "la pluie n'a pas cessé. Ceux de devant se traînent, prudents, sur une " +
             "piste qu'ils ne lisent plus. Toi, tu as trouvé quelque chose : une " +
             "trajectoire hors ligne où l'eau s'évacue mieux.",
      question: "Personne d'autre ne l'a vue.",
      choix: [
        { label: "Rester sur la trajectoire",
          detail: "Ne pas prendre de risque supplémentaire.",
          resultat: { gain: 2, perte: 0, abandon: 0.04, mental: 0,
            texte: "Tu suis la file et grappilles quelques places au fil des erreurs." } },
        { label: "Prendre la ligne mouillée",
          detail: "Là où personne ne roule, la piste est différente.",
          resultat: { gain: 8, perte: 4, abandon: 0.26, mental: 4, reputation: 7,
            texte: "Tu sors de la trajectoire et tu gagnes deux secondes au tour. " +
                   "Personne ne comprend d'où tu viens." } }
      ]
    },
    {
      id: "penalite",
      cats: ["Formule 1", "IndyCar"],
      /* Silverstone 1998 : une pénalité notifiée si tard qu'elle est purgée
         dans la voie des stands, après la ligne d'arrivée. */
      quand: function () { return avancement() > 0.75 && Math.random() < 0.5; },
      titre: "La pénalité",
      recit: "La direction de course t'inflige dix secondes d'arrêt pour un " +
             "dépassement jugé irrégulier. Le règlement dit qu'elle doit être purgée " +
             "avant la fin. Ton ingénieur, lui, relit le règlement à voix haute, et " +
             "il a l'air de trouver quelque chose.",
      question: "Le muret hésite.",
      choix: [
        { label: "Purger immédiatement",
          detail: "Prendre la sanction et repartir la conscience tranquille.",
          resultat: { gain: -3, perte: 0, abandon: 0, mental: 0, confiance: 4,
            texte: "Tu rentres, tu attends dix secondes, tu repars. Le classement " +
                   "est ce qu'il est." } },
        { label: "Suivre l'ingénieur",
          detail: "Il pense qu'on peut la purger au dernier moment.",
          resultat: { gain: 3, perte: 4, abandon: 0.05, confiance: -6, reputation: 3,
            mental: 1,
            texte: "Tu restes en piste. Les commissaires étudieront le cas après " +
                   "la course, et personne ne sait ce qu'ils décideront." } }
      ]
    },
    /* ---------------------------------------------------------------
     * INDYCAR — les ovales, le carburant, les murs
     * ------------------------------------------------------------- */
    {
      id: "ovale_pack",
      cats: ["IndyCar"],
      quand: function () { return avancement() > 0.3 && avancement() < 0.9; },
      titre: "Trois de front",
      recit: "Sur l'ovale, le peloton roule groupé, à quelques centimètres, à plus " +
             "de trois cent cinquante à l'heure. Une file s'est formée à l'extérieur " +
             "et remonte. Pour la suivre, il faut s'engager dans une troisième " +
             "colonne, là où la piste n'est pas faite pour trois voitures.",
      question: "Le mur est à un mètre de ta roue droite.",
      choix: [
        { label: "Rester en file",
          detail: "Garder sa place dans le train, attendre une ouverture.",
          resultat: { gain: 0, perte: 2, abandon: 0.04, mental: 0,
            texte: "Tu restes dans la file basse. La colonne extérieure te dépasse " +
                   "voiture après voiture." } },
        { label: "Prendre la troisième ligne",
          detail: "Là-haut, l'air est propre et la piste est libre.",
          resultat: { gain: 6, perte: 3, abandon: 0.30, mental: 3,
            texte: "Tu montes tout en haut de la piste, roue contre mur, et tu " +
                   "remontes le long du béton." } }
      ]
    },
    {
      id: "carburant_ovale",
      cats: ["IndyCar"],
      quand: function () { return avancement() > 0.78; },
      titre: "La dernière goutte",
      recit: "Le calcul du muret est formel : il manque deux tours de carburant " +
             "pour rallier l'arrivée. Un dernier ravitaillement coûterait la course. " +
             "Rouler en économie signifie lever le pied dans les virages et laisser " +
             "revenir tout le monde.",
      question: "Deux tours. C'est tout ce qui manque.",
      choix: [
        { label: "Ravitailler",
          detail: "Perdre du terrain, mais finir à coup sûr.",
          resultat: { gain: -5, perte: 0, abandon: 0.02, mental: 0,
            texte: "Tu plonges dans la voie des stands. Le plein est fait en huit " +
                   "secondes, et tu ressors loin derrière." } },
        { label: "Tenter l'économie",
          detail: "Lever le pied, rouler à l'ancienne, et prier.",
          resultat: { gain: 4, perte: 4, abandon: 0.28, mental: 3,
            texte: "Tu coupes les gaz avant chaque virage et tu roules à l'oreille " +
                   "du moteur. Le muret ne dit plus rien." } }
      ]
    },
    {
      id: "mur_sortie",
      cats: ["IndyCar"],
      quand: function () {
        var m = moi();
        return !!(m && m.pos <= 6 && avancement() > 0.9);
      },
      titre: "Sortie du dernier virage",
      recit: "Dernier tour, dernier virage relevé. La trajectoire idéale passe à " +
             "quelques centimètres du mur extérieur, et l'aspiration de celui de " +
             "devant rend ta voiture nerveuse à l'arrière.",
      question: "Le mur ne pardonne rien.",
      choix: [
        { label: "Prendre la ligne basse",
          detail: "Plus sûr, plus lent, loin du béton.",
          resultat: { gain: 0, perte: 1, abandon: 0.03, mental: 0,
            texte: "Tu passes bas et propre. La ligne d'arrivée arrive un peu trop tôt." } },
        { label: "Coller au mur",
          detail: "La trajectoire la plus rapide, à la largeur d'une main.",
          resultat: { gain: 3, perte: 0, abandon: 0.32, mental: 3, reputation: 4,
            texte: "Tu vises l'extérieur et tu longes le béton, la roue à quelques " +
                   "centimètres, jusqu'au drapeau." } }
      ]
    },

    /* ---------------------------------------------------------------
     * ENDURANCE — la nuit, le trafic, les relais
     * ------------------------------------------------------------- */
    {
      id: "nuit",
      cats: ["Endurance WEC"],
      quand: function () { return avancement() > 0.35 && avancement() < 0.85; },
      titre: "Quatre heures du matin",
      recit: "La nuit est totale et les phares n'éclairent que quarante mètres. " +
             "Tu roules depuis deux heures d'affilée, les yeux brûlants. Devant, " +
             "des feux rouges se rapprochent : une voiture d'une catégorie plus " +
             "lente, dans une portion où il n'y a pas de place pour deux.",
      question: "Le prochain point de dépassement est loin.",
      choix: [
        { label: "Attendre la ligne droite",
          detail: "Perdre trois secondes, ne rien risquer.",
          resultat: { gain: 0, perte: 1, abandon: 0.02, mental: 0,
            texte: "Tu restes derrière, patient, jusqu'à l'endroit prévu pour ça." } },
        { label: "Passer maintenant",
          detail: "Il t'a vu. Sans doute.",
          resultat: { gain: 4, perte: 2, abandon: 0.26, mental: 2,
            texte: "Tu te déportes et tu passes à l'intérieur, dans le noir, en " +
                   "espérant qu'il tienne sa trajectoire." } }
      ]
    },
    {
      id: "double_relais",
      cats: ["Endurance WEC"],
      quand: function () { return avancement() > 0.3 && avancement() < 0.8; },
      titre: "Doubler le relais",
      recit: "L'ingénieur propose de repartir sur les mêmes pneus pour un second " +
             "relais complet. Tu gagnerais une trentaine de secondes sur la " +
             "concurrence. En fin de relais, la gomme sera à la corde et la voiture " +
             "ne tiendra plus la route dans les virages rapides.",
      question: "Trente secondes, c'est énorme sur une course de cette durée.",
      choix: [
        { label: "Chausser du neuf",
          detail: "Rester en confiance, attaquer sur des gommes fraîches.",
          resultat: { gain: 0, perte: 1, abandon: 0.02, mental: 1,
            texte: "Les mécaniciens changent les quatre pneus. Tu repars avec une " +
                   "voiture qui répond." } },
        { label: "Repartir sur les mêmes",
          detail: "Encaisser la dégradation et prendre l'avantage au chrono.",
          resultat: { gain: 5, perte: 3, abandon: 0.24, mental: -1,
            texte: "Tu repars sans changer. Les vingt premiers tours sont un délice, " +
                   "les vingt derniers seront autre chose." } }
      ]
    },
    {
      id: "panne_finale",
      cats: ["Endurance WEC"],
      /* Le Mans 2016 : une voiture en tête s'arrête dans le tour final, à
         trois minutes de la victoire, sous les yeux du monde entier. */
      quand: function () {
        var m = moi();
        return !!(m && m.pos <= 3 && avancement() > 0.93);
      },
      titre: "Le dernier tour",
      recit: "Tu es en tête après des heures de course. Dans le dernier relais, " +
             "un voyant s'allume sur le volant et la puissance devient irrégulière. " +
             "Le muret te demande de couper le moteur et de le relancer — une " +
             "manœuvre qui peut tout réparer, ou tout arrêter définitivement.",
      question: "Il reste un tour.",
      choix: [
        { label: "Ne rien toucher",
          detail: "Ramener la voiture telle qu'elle est, à l'allure qu'elle accepte.",
          resultat: { gain: 0, perte: 3, abandon: 0.20, mental: -1,
            texte: "Tu ne touches à rien et tu roules doucement, en écoutant chaque " +
                   "hésitation du moteur." } },
        { label: "Couper et relancer",
          detail: "Suivre le muret. Tout ou rien.",
          resultat: { gain: 1, perte: 0, abandon: 0.40, mental: 2,
            texte: "Tu coupes le moteur en roulant. Le silence dure une seconde " +
                   "et demie. C'est très long." } }
      ]
    },
    {
      id: "trafic_gt",
      cats: ["Endurance WEC"],
      quand: function () { return avancement() > 0.2 && avancement() < 0.9; },
      titre: "Le peloton lent",
      recit: "Cinq voitures de catégorie inférieure se battent entre elles dans la " +
             "section rapide. Elles ne se regardent pas, elles ne t'ont pas vu, et " +
             "elles occupent toute la largeur de la piste. Ton relais se joue sur " +
             "les prochaines secondes.",
      question: "Il faudra bien passer.",
      choix: [
        { label: "Lever et attendre",
          detail: "Laisser leur bagarre se dénouer, perdre du temps.",
          resultat: { gain: 0, perte: 2, abandon: 0.02, mental: -1,
            texte: "Tu lèves le pied et tu suis leur bagarre pendant un tour entier." } },
        { label: "Se frayer un passage",
          detail: "Trouver l'espace entre deux d'entre elles.",
          resultat: { gain: 4, perte: 2, abandon: 0.24, mental: 2,
            texte: "Tu vises un espace qui n'existe pas encore et tu comptes sur " +
                   "leur réaction." } }
      ]
    },

    /* ---------------------------------------------------------------
     * SUPER FORMULA — pneus tranchants, circuits japonais, typhons
     * ------------------------------------------------------------- */
    {
      id: "falaise_pneus",
      cats: ["Super Formula"],
      quand: function () { return avancement() > 0.5; },
      titre: "La falaise",
      recit: "Les pneus ne se dégradent pas progressivement ici : ils tiennent, " +
             "tiennent encore, puis lâchent d'un coup en l'espace d'un tour. " +
             "Les tiens en sont à ce point précis où personne ne sait s'il reste " +
             "deux tours ou dix.",
      question: "L'arrêt te ferait ressortir dans le trafic.",
      choix: [
        { label: "Rentrer maintenant",
          detail: "Ne pas jouer avec ce que ces pneus font quand ils lâchent.",
          resultat: { gain: -3, perte: 0, abandon: 0.02, mental: 0,
            texte: "Tu rentres avant la falaise et tu ressors au milieu du peloton." } },
        { label: "Encore trois tours",
          detail: "Sortir juste après ceux qui viennent de s'arrêter.",
          resultat: { gain: 5, perte: 4, abandon: 0.26, mental: 2,
            texte: "Tu continues. Au tour suivant, l'arrière commence à glisser " +
                   "dans les appuis." } }
      ]
    },
    {
      id: "courbe_rapide",
      cats: ["Super Formula"],
      quand: function () {
        var m = moi(); var d = devant();
        return !!(d && m && avancement() > 0.4);
      },
      titre: "La grande courbe",
      recit: function () {
        return "La courbe rapide se prend à fond, en théorie. Avec l'air perturbé " +
               "de " + nomCourt(devant()) + " juste devant, l'appui aérodynamique " +
               "chute et la voiture devient imprévisible au point de corde.";
      },
      question: "À fond, ou presque à fond.",
      choix: [
        { label: "Lever légèrement",
          detail: "Un souffle de moins, et la voiture reste posée.",
          resultat: { gain: 0, perte: 1, abandon: 0.02, mental: 0,
            texte: "Tu lèves imperceptiblement. La voiture tient, l'écart grandit." } },
        { label: "Passer à fond",
          detail: "Garder le pied au plancher dans l'air sale.",
          resultat: { gain: 3, perte: 1, abandon: 0.28, mental: 3,
            texte: "Tu gardes le pied au plancher. L'arrière s'allège au point de " +
                   "corde et tu corriges à l'instinct." } }
      ]
    },
    {
      id: "typhon",
      cats: ["Super Formula"],
      quand: function () { return pluie() && avancement() > 0.25; },
      titre: "L'avis de typhon",
      recit: "Le vent forcit à chaque tour et la direction de course surveille " +
             "l'arrivée du typhon. Si la course est interrompue avant la mi-distance, " +
             "aucun point ne sera attribué. Après, ils compteront les points de moitié.",
      question: "Il manque quelques tours pour valider la course.",
      choix: [
        { label: "Assurer la position",
          detail: "Rouler prudemment jusqu'à ce que la distance soit validée.",
          resultat: { gain: 0, perte: 0, abandon: 0.03, mental: 0,
            texte: "Tu roules pour durer. La course sera validée de justesse." } },
        { label: "Attaquer tout de suite",
          detail: "Gagner des places avant que le drapeau rouge ne fige tout.",
          resultat: { gain: 5, perte: 3, abandon: 0.30, mental: 3,
            texte: "Tu attaques sous les rafales, en sachant que chaque tour peut " +
                   "être le dernier." } }
      ]
    },
    {
      id: "depart_arrete",
      cats: ["Super Formula", "Formule 1"],
      quand: function () { return avancement() < 0.08; },
      titre: "L'embrayage",
      recit: "Feux rouges allumés. Ton point de patinage a bougé de quelques " +
             "millimètres depuis les essais — la chaleur, l'usure. Tu peux " +
             "reproduire exactement ce que tu as répété, ou tenter un départ plus " +
             "agressif en jouant sur le régime.",
      question: "Une seconde de gagnée au départ vaut trois places.",
      choix: [
        { label: "Le départ répété",
          detail: "Faire exactement ce qui a été travaillé.",
          resultat: { gain: 1, perte: 0, abandon: 0.01, mental: 0,
            texte: "Départ propre, sans éclat. Tu gardes ta position." } },
        { label: "Jouer le régime",
          detail: "Monter plus haut, relâcher plus vite, gagner deux longueurs.",
          resultat: { gain: 4, perte: 3, abandon: 0.12, mental: 2,
            texte: "Tu montes le régime et tu lâches l'embrayage plus tôt. " +
                   "Les roues cherchent l'adhérence pendant un instant." } }
      ]
    },

    {
      id: "brouillard",
      cats: ["Formule 1", "Super Formula", "Endurance WEC"],
      /* Monaco 1984 : une course arrêtée sous la pluie alors qu'un pilote
         revenait sur le leader à trois secondes par tour. */
      quand: function () { return pluie() && avancement() > 0.4 && avancement() < 0.75; },
      titre: "Le drapeau rouge menace",
      recit: "La pluie redouble. Le directeur de course est en train de délibérer : " +
             "si la course est arrêtée maintenant, le classement du tour précédent " +
             "fait foi. Tu reviens sur ceux de devant à trois secondes par tour.",
      question: "Chaque tour compte double.",
      choix: [
        { label: "Sécuriser la position",
          detail: "Si ça s'arrête, autant être là où tu es.",
          resultat: { gain: 0, perte: 0, abandon: 0.02, mental: 0,
            texte: "Tu roules pour tenir. La course ne sera pas arrêtée." } },
        { label: "Attaquer tant qu'il est temps",
          detail: "Remonter avant que le drapeau ne tombe.",
          resultat: { gain: 5, perte: 4, abandon: 0.30, mental: 3,
            texte: "Tu attaques sous des trombes d'eau, en sachant que tout peut " +
                   "s'arrêter au prochain tour." } }
      ]
    }
  ];

  /* ==================================================================
   * DÉCLENCHEMENT — rare, et jamais deux fois la même course
   * ================================================================== */
  var PROBA_PAR_COURSE = 0.22;   // un peu plus d'une course sur cinq

  function dejaVu(id) {
    var G = G_();
    try { return !!(G && G._rjMomentsVus && G._rjMomentsVus[id]); } catch (e) { return false; }
  }
  function marquer(id) {
    var G = G_();
    if (!G) return;
    if (!G._rjMomentsVus) G._rjMomentsVus = {};
    G._rjMomentsVus[id] = (G._rjMomentsVus[id] || 0) + 1;
  }

  var etatCourse = { tenteCetteCourse: false, tour: 0 };

  function candidat() {
    var dispo = MOMENTS.filter(function (m) {
      try {
        /* La discipline d'abord : inutile d'évaluer une situation qui ne
           peut pas exister dans ce championnat. */
        if (!dansCategorie(m.cats)) return false;
        if (!m.quand()) return false;
        /* Un moment déjà vécu peut revenir, mais bien plus rarement : ce
           qui fait leur prix, c'est qu'ils ne se répètent pas. */
        if (dejaVu(m.id) && Math.random() > 0.25) return false;
        return true;
      } catch (e) { return false; }
    });
    return dispo.length ? auHasard(dispo) : null;
  }

  function peutDeclencher() {
    var L = window.LIVE_RACE;
    if (!L || !L.drivers || !L.drivers.length) return false;
    if (etatCourse.tenteCetteCourse) return false;
    var m = moi();
    if (!m || m.dnf) return false;
    if (L.paused) return false;
    if (document.getElementById("rj106-modal")) return false;
    /* Pas pendant qu'un autre événement occupe déjà l'écran. */
    try {
      var autre = document.getElementById("live-event-modal");
      if (autre && getComputedStyle(autre).display !== "none") return false;
    } catch (e) {}
    return true;
  }

  /* ==================================================================
   * MISE EN SCÈNE
   * ================================================================== */
  function injecterCSS() {
    if (document.getElementById(CSS_ID)) return;
    var css = [
      "#rj106-modal{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;" +
        "justify-content:center;padding:16px;background:rgba(0,0,0,.86);" +
        "backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:rj106-fond .35s ease both}",
      "@keyframes rj106-fond{from{opacity:0}to{opacity:1}}",
      "@keyframes rj106-entree{from{opacity:0;transform:translateY(22px) scale(.97)}to{opacity:1;transform:none}}",
      "@keyframes rj106-pulse{0%,100%{opacity:.55}50%{opacity:1}}",

      "#rj106-boite{width:100%;max-width:410px;max-height:92vh;overflow-y:auto;border-radius:18px;" +
        "background:linear-gradient(165deg,#1a1015 0%,#0d0d12 55%,#12080a 100%);" +
        "border:1px solid rgba(255,255,255,.14);" +
        "box-shadow:0 0 0 1px rgba(255,24,1,.22),0 24px 70px rgba(0,0,0,.75);" +
        "animation:rj106-entree .45s cubic-bezier(.2,.9,.3,1) both}",

      /* Le bandeau distingue immédiatement ce moment d'un événement ordinaire. */
      "#rj106-boite .rj106-band{position:relative;overflow:hidden;padding:16px 18px 14px;" +
        "border-bottom:1px solid rgba(255,255,255,.10);" +
        "background:linear-gradient(120deg,rgba(255,24,1,.20) 0%,transparent 70%)}",
      "#rj106-boite .rj106-band::after{content:'';position:absolute;inset:0;pointer-events:none;" +
        "background:repeating-linear-gradient(115deg,transparent 0 14px,rgba(255,255,255,.022) 14px 28px)}",
      "#rj106-boite .rj106-eyebrow{display:flex;align-items:center;gap:7px;" +
        "font-family:var(--font-display);font-size:9.5px;font-weight:800;letter-spacing:.22em;" +
        "text-transform:uppercase;color:#FF4D3D}",
      "#rj106-boite .rj106-eyebrow .pt{width:6px;height:6px;border-radius:50%;background:#FF1801;" +
        "animation:rj106-pulse 1.5s ease-in-out infinite}",
      "#rj106-boite .rj106-titre{margin-top:9px;font-family:var(--font-display);font-size:25px;" +
        "font-weight:900;color:#fff;line-height:1.05;letter-spacing:-.01em}",
      "#rj106-boite .rj106-tour{margin-top:5px;font-size:10.5px;letter-spacing:.14em;" +
        "text-transform:uppercase;color:var(--muted,#8b93a7)}",

      "#rj106-boite .rj106-recit{padding:16px 18px 4px;font-size:13.5px;line-height:1.62;" +
        "color:var(--soft,#c3cad8)}",
      "#rj106-boite .rj106-q{padding:12px 18px 16px;font-size:13px;font-style:italic;" +
        "color:#fff;font-weight:600}",

      "#rj106-boite .rj106-choix{padding:0 14px 16px;display:flex;flex-direction:column;gap:9px}",
      "#rj106-boite .rj106-c{width:100%;padding:14px 15px;cursor:pointer;text-align:left;" +
        "border-radius:13px;font-family:inherit;background:rgba(255,255,255,.045);" +
        "border:1px solid rgba(255,255,255,.13);border-left:3px solid #FF1801;" +
        "transition:transform .12s ease,background .15s ease}",
      "#rj106-boite .rj106-c:active{transform:scale(.985);background:rgba(255,24,1,.10)}",
      "#rj106-boite .rj106-c .l{display:block;font-family:var(--font-display);font-size:14px;" +
        "font-weight:800;color:#fff}",
      "#rj106-boite .rj106-c .d{display:block;margin-top:4px;font-size:11.5px;line-height:1.45;" +
        "color:var(--muted,#8b93a7)}",

      /* Aucun pourcentage : le poids de la décision tient à ce qu'on ignore. */
      "#rj106-boite .rj106-note{padding:0 18px 16px;font-size:10.5px;color:var(--text3,#6b7280);" +
        "text-align:center;font-style:italic}",

      "#rj106-boite .rj106-issue{padding:16px 18px;font-size:13.5px;line-height:1.6;color:#fff}",
      "#rj106-boite .rj106-bilan{margin:0 18px 14px;padding:11px 13px;border-radius:11px;" +
        "background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.10);" +
        "display:flex;flex-wrap:wrap;gap:6px}",
      "#rj106-boite .rj106-bilan span{font-family:var(--font-display);font-size:10px;font-weight:800;" +
        "letter-spacing:.06em;padding:4px 8px;border-radius:5px}",
      "#rj106-boite .rj106-bilan .up{color:#34D399;background:rgba(52,211,153,.13);" +
        "border:1px solid rgba(52,211,153,.34)}",
      "#rj106-boite .rj106-bilan .dn{color:#F87171;background:rgba(248,113,113,.13);" +
        "border:1px solid rgba(248,113,113,.34)}",
      "#rj106-boite .rj106-ok{margin:0 14px 16px;width:calc(100% - 28px);padding:13px;border:none;" +
        "border-radius:12px;cursor:pointer;background:#FF1801;color:#fff;" +
        "font-family:var(--font-display);font-size:12px;font-weight:800;letter-spacing:.12em;" +
        "text-transform:uppercase}",
      "@media (prefers-reduced-motion:reduce){#rj106-modal,#rj106-boite{animation:none}}"
    ].join("\n");
    var st = document.createElement("style");
    st.id = CSS_ID; st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  function texteDe(v) { return (typeof v === "function") ? v() : v; }

  function afficher(moment) {
    injecterCSS();
    var L = window.LIVE_RACE;
    var tour = (L && L.cur) || 0, total = (L && L.total) || 0;

    /* La course s'arrête : ce moment mérite qu'on s'y attarde. */
    try { if (L) L.paused = true; } catch (e) {}

    var mod = document.createElement("div");
    mod.id = "rj106-modal";
    mod.innerHTML =
      '<div id="rj106-boite">' +
        '<div class="rj106-band">' +
          '<div class="rj106-eyebrow"><span class="pt"></span>Moment décisif</div>' +
          '<div class="rj106-titre">' + esc(texteDe(moment.titre)) + '</div>' +
          '<div class="rj106-tour">Tour ' + tour + (total ? " / " + total : "") + '</div>' +
        '</div>' +
        '<div class="rj106-recit">' + esc(texteDe(moment.recit)) + '</div>' +
        '<div class="rj106-q">' + esc(texteDe(moment.question)) + '</div>' +
        '<div class="rj106-choix">' +
          moment.choix.map(function (c, i) {
            return '<button class="rj106-c" data-i="' + i + '">' +
                   '<span class="l">' + esc(c.label) + '</span>' +
                   '<span class="d">' + esc(c.detail) + '</span></button>';
          }).join("") +
        '</div>' +
        '<div class="rj106-note">Personne ne peut te dire ce qui va se passer.</div>' +
      '</div>';
    document.body.appendChild(mod);

    mod.addEventListener("click", function (ev) {
      var b = ev.target.closest ? ev.target.closest(".rj106-c") : null;
      if (!b) return;
      resoudre(moment, parseInt(b.getAttribute("data-i"), 10));
    });
  }

  /* ==================================================================
   * CONSÉQUENCES
   * ================================================================== */
  function appliquer(r) {
    var G = G_();
    var m = moi();
    var bilan = [];

    /* L'abandon est tiré en premier : s'il tombe, le reste n'a plus lieu. */
    var casse = (typeof r.abandon === "number") && Math.random() < r.abandon;
    if (casse && m) {
      try {
        m.dnf = true;
        if (window.LIVE_RACE) window.LIVE_RACE._rj106Abandon = true;
      } catch (e) {}
      bilan.push({ t: "Abandon", up: false });
      return { bilan: bilan, casse: true };
    }

    if (m && (r.gain || r.perte)) {
      var delta = (r.gain || 0);
      if (r.perte) delta -= Math.round(Math.random() * r.perte);
      if (delta) {
        var avant = m.pos;
        var cible = Math.max(1, Math.min(pilotes().length, m.pos - delta));
        try {
          /* On déplace les pilotes intercalés pour garder un classement
             cohérent, plutôt que de créer deux pilotes à la même place. */
          pilotes().forEach(function (d) {
            if (!d || d.isPlayer || d.dnf) return;
            if (cible < avant && d.pos >= cible && d.pos < avant) d.pos += 1;
            else if (cible > avant && d.pos <= cible && d.pos > avant) d.pos -= 1;
          });
          m.pos = cible;
          if (typeof m.score === "number") m.score += delta * 0.02;
        } catch (e) {}
        bilan.push({ t: (delta > 0 ? "+" : "") + delta + " place" + (Math.abs(delta) > 1 ? "s" : ""),
                     up: delta > 0 });
      }
    }

    try {
      if (r.mental && typeof PILOT_MENTAL !== "undefined" && PILOT_MENTAL) {
        PILOT_MENTAL.value = Math.max(0, Math.min(100, PILOT_MENTAL.value + r.mental));
        bilan.push({ t: "Moral " + (r.mental > 0 ? "+" : "") + r.mental, up: r.mental > 0 });
      }
      if (r.confiance && typeof TEAM_TRUST !== "undefined" && TEAM_TRUST) {
        TEAM_TRUST.value = Math.max(0, Math.min(100, TEAM_TRUST.value + r.confiance));
        bilan.push({ t: "Écurie " + (r.confiance > 0 ? "+" : "") + r.confiance, up: r.confiance > 0 });
      }
      if (r.reputation && G && G.rep) {
        G.rep.public = Math.max(0, Math.min(100, (G.rep.public || 0) + r.reputation));
        if (typeof recomputeGlobalRep === "function") recomputeGlobalRep();
        bilan.push({ t: "Public +" + r.reputation, up: true });
      }
      if (r.rivalite && G && G._rivalries && G._rivalries[0]) {
        G._rivalries[0].intensity = Math.max(0, Math.min(100,
          (G._rivalries[0].intensity || 50) + r.rivalite));
        bilan.push({ t: "Tension +" + r.rivalite, up: false });
      }
    } catch (e) { console.warn(TAG, e && e.message); }

    return { bilan: bilan, casse: false };
  }

  function resoudre(moment, idx) {
    var choix = moment.choix[idx];
    if (!choix) return;
    var r = choix.resultat || {};
    var issue = appliquer(r);
    marquer(moment.id);

    var boite = document.getElementById("rj106-boite");
    if (!boite) return;

    var texte = issue.casse
      ? "La voiture ne repartira pas. La course s'arrête ici."
      : texteDe(r.texte);

    boite.innerHTML =
      '<div class="rj106-band">' +
        '<div class="rj106-eyebrow"><span class="pt"></span>' +
          (issue.casse ? "Fin de course" : "Ce qui s'est passé") + '</div>' +
        '<div class="rj106-titre">' + esc(texteDe(moment.titre)) + '</div>' +
      '</div>' +
      '<div class="rj106-issue">' + esc(texte) + '</div>' +
      (issue.bilan.length
        ? '<div class="rj106-bilan">' + issue.bilan.map(function (b) {
            return '<span class="' + (b.up ? "up" : "dn") + '">' + esc(b.t) + "</span>";
          }).join("") + '</div>'
        : "") +
      '<button class="rj106-ok" id="rj106-ok">Reprendre</button>';

    var ok = document.getElementById("rj106-ok");
    if (ok) ok.addEventListener("click", fermer);

    /* Le fil de course garde une trace : on doit pouvoir s'en souvenir. */
    try {
      if (typeof window._rj08Direct === "function") {
        window._rj08Direct({
          text: "<strong>" + texteDe(moment.titre) + "</strong> \u00b7 " + choix.label,
          color: "#FF1801",
          _key: "moment_" + moment.id
        });
      }
    } catch (e) {}
  }

  function fermer() {
    var m = document.getElementById("rj106-modal");
    if (m && m.parentNode) m.parentNode.removeChild(m);
    try { if (window.LIVE_RACE) window.LIVE_RACE.paused = false; } catch (e) {}
    try { if (typeof updateUI === "function") updateUI(); } catch (e) {}
  }

  /* ==================================================================
   * SURVEILLANCE
   * ================================================================== */
  var veille = null;

  function surveiller() {
    if (veille) return;
    veille = setInterval(function () {
      try {
        var L = window.LIVE_RACE;
        if (!L || !L.drivers || !L.drivers.length) { etatCourse.tenteCetteCourse = false; return; }
        var cur = L.cur || 0;
        if (cur < etatCourse.tour) etatCourse.tenteCetteCourse = false;  // nouvelle course
        if (cur === etatCourse.tour) return;
        etatCourse.tour = cur;

        if (!peutDeclencher()) return;
        /* Le tirage n'a lieu qu'une fois par course : soit le moment arrive,
           soit la course se déroulera sans. */
        if (cur < 2) return;
        /* PROBA_PAR_COURSE est la chance qu'un moment survienne sur la course
           ENTIÈRE. Il faut donc la répartir sur les tours restants, sans quoi
           elle se cumule à chaque tour : la première version, qui divisait
           grossièrement, aboutissait à six courses sur dix — tout sauf rare. */
        var tours = Math.max(2, (L.total || 40) - 1);
        var parTour = 1 - Math.pow(1 - PROBA_PAR_COURSE, 1 / tours);
        if (Math.random() > parTour) return;

        var m = candidat();
        if (!m) return;
        etatCourse.tenteCetteCourse = true;
        afficher(m);
      } catch (e) {}
    }, 400);
  }

  function boot() {
    surveiller();
    window._rj106 = {
      moments: MOMENTS,
      forcer: function (id) {
        var m = MOMENTS.filter(function (x) { return x.id === id; })[0] || auHasard(MOMENTS);
        if (m) afficher(m);
        return m ? m.id : null;
      },
      eligibles: function () {
        return MOMENTS.filter(function (m) {
          try { return m.quand(); } catch (e) { return false; }
        }).map(function (m) { return m.id; });
      },
      fermer: fermer
    };
    window._rj106Uninstall = function () {
      if (veille) { clearInterval(veille); veille = null; }
      fermer();
      var c = document.getElementById(CSS_ID); if (c) c.remove();
      console.log(TAG, "désinstallé");
    };
    console.log(TAG, MOMENTS.length + " moments décisifs en embuscade");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
