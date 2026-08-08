/* =====================================================================
 * 101-reseau.js — LE RÉSEAU COMPTE VRAIMENT
 *
 * CE QU'IL Y AVAIT
 * G._network stockait des contacts avec une relation de 0 à 100, un rôle,
 * une écurie, et une érosion dans le temps. Tout cela fonctionnait — mais
 * AUCUNE décision du jeu ne consultait ces données. Les offres se
 * décidaient sur un simple seuil de réputation. Le réseau était un
 * répertoire décoratif.
 *
 * LE PRINCIPE RETENU
 *   Le talent ouvre les portes, le réseau décide laquelle s'ouvre en
 *   premier — et laquelle reste entrouverte quand tout va mal.
 *
 * Un contact ne fera jamais signer un pilote hors de son niveau : l'effet
 * est plafonné à un cran d'écart. Mais à niveau comparable, c'est lui qui
 * tranche. Et quand le baquet est perdu, c'est le réseau qui décide s'il
 * reste une porte de sortie.
 *
 * CE QUE FAIT CE MODULE
 *   1. Une influence propre à chaque rôle : un ingénieur qui vous adore ne
 *      vous trouvera pas de baquet, un team principal tiède le peut.
 *   2. L'inscription au réseau de tous ceux que l'on croise réellement —
 *      journalistes des conférences, staff de l'écurie, sponsors, rivaux.
 *   3. Les relations bougent pour de bonnes raisons : résultats,
 *      déclarations publiques, temps qui passe.
 *   4. Le marché des pilotes consulte le réseau, et le dit.
 *   5. Un filet de sécurité en cas de perte de baquet.
 *
 * Réversible : window._rj101Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[101-reseau]";

  function G_() { return (typeof window.G !== "undefined") ? window.G : null; }
  function borne(v, min, max) { return Math.max(min, Math.min(max, v)); }

  /* ==================================================================
   * 1. L'INFLUENCE PAR RÔLE
   *
   * La relation dit ce qu'un contact pense de vous ; l'influence dit ce
   * qu'il peut faire. Les deux se multiplient : c'est le produit qui
   * compte, jamais l'un des deux seul.
   * ================================================================== */
  var ROLES = {
    tp:           { lbl: "Team Principal",      influence: 1.00, couleur: "#F59E0B",
                    peut: "Décide des pilotes de son écurie" },
    dir_sport:    { lbl: "Directeur Sportif",   influence: 0.70, couleur: "#22D3EE",
                    peut: "Recommande, informe sur le marché" },
    dir_tech:     { lbl: "Directeur Technique", influence: 0.45, couleur: "#A78BFA",
                    peut: "Renseigne sur la voiture à venir" },
    ing_course:   { lbl: "Ingénieur de course", influence: 0.40, couleur: "#34D399",
                    peut: "Affine les réglages, limite les erreurs" },
    agent:        { lbl: "Agent",               influence: 0.75, couleur: "#FB923C",
                    peut: "Ouvre des portes hors de portée" },
    journaliste:  { lbl: "Journaliste",         influence: 0.35, couleur: "#EC4899",
                    peut: "Oriente le ton des articles" },
    sponsor:      { lbl: "Sponsor",             influence: 0.50, couleur: "#4ADE80",
                    peut: "Finance, suit d'une écurie à l'autre" },
    pilote:       { lbl: "Pilote",              influence: 0.25, couleur: "#60A5FA",
                    peut: "Respect en piste, ou vendetta" },
    contact:      { lbl: "Contact",             influence: 0.20, couleur: "#60A5FA",
                    peut: "Connaît du monde" }
  };

  function role(r) { return ROLES[r] || ROLES.contact; }

  /* Poids d'un contact : relation × influence, ramené sur cent. */
  function poids(c) {
    if (!c) return 0;
    return Math.round((c.relation || 0) * role(c.role).influence);
  }

  /* ==================================================================
   * 2. ACCÈS AU RÉSEAU
   * ================================================================== */
  function tous() {
    var G = G_();
    if (!G || !G._network) return [];
    return Object.keys(G._network).map(function (k) { return G._network[k]; });
  }

  function parEquipe(equipe) {
    if (!equipe) return [];
    return tous().filter(function (c) { return c.team === equipe; });
  }

  /* Le décideur d'une écurie : son team principal, à défaut son directeur
     sportif. C'est lui qui pèse sur un recrutement. */
  function decideur(equipe) {
    var gens = parEquipe(equipe);
    var tp = gens.filter(function (c) { return c.role === "tp"; })
                 .sort(function (a, b) { return (b.relation || 0) - (a.relation || 0); })[0];
    if (tp) return tp;
    return gens.filter(function (c) { return c.role === "dir_sport"; })
               .sort(function (a, b) { return (b.relation || 0) - (a.relation || 0); })[0] || null;
  }

  /* Ce que le réseau pense de vous, du côté d'une écurie donnée. Le
     décideur pèse le plus, le reste du staff nuance. */
  function faveur(equipe) {
    var d = decideur(equipe);
    if (!d) return null;
    var staff = parEquipe(equipe).filter(function (c) { return c !== d; });
    var appoint = 0;
    if (staff.length) {
      var somme = 0;
      staff.forEach(function (c) { somme += poids(c); });
      appoint = (somme / staff.length) * 0.25;
    }
    return {
      decideur: d,
      note: borne(Math.round(poids(d) + appoint), 0, 100),
      relation: d.relation || 0
    };
  }

  function meilleursContacts(n) {
    return tous()
      .sort(function (a, b) { return poids(b) - poids(a); })
      .slice(0, n || 5);
  }

  /* ==================================================================
   * 3. INSCRIPTION DES CONTACTS
   *
   * Le réseau ne se remplissait que du staff de l'écurie. Tous ceux que
   * l'on croise vraiment y entrent désormais : les journalistes des
   * conférences de presse, qui existent nommément, les sponsors, et les
   * pilotes de la grille.
   * ================================================================== */
  function inscrire(cle, infos, delta) {
    try {
      if (typeof window.recordNetworkInteraction === "function") {
        return window.recordNetworkInteraction(cle, Object.assign({}, infos, {
          delta: (typeof delta === "number") ? delta : 0
        }));
      }
    } catch (e) { console.warn(TAG, "inscription :", e && e.message); }
    return null;
  }

  function cleDe(nom) {
    return String(nom || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  }

  /* --- journalistes : repris de la salle de presse ------------------- */
  function inscrireJournaliste(j, delta) {
    if (!j) return null;
    var nom = j.prenom + " " + j.nom;
    return inscrire("presse_" + cleDe(nom), {
      name: nom, role: "journaliste", team: j.media,
      color: ROLES.journaliste.couleur, roleLabel: "Journaliste", icon: "mic"
    }, delta);
  }

  /* --- pilotes de la grille ------------------------------------------ */
  function inscrirePilote(p, delta) {
    if (!p || !p.name) return null;
    return inscrire("pilote_" + cleDe(p.name), {
      name: p.name, role: "pilote", team: p.team || null,
      color: ROLES.pilote.couleur, roleLabel: "Pilote", icon: "helmet"
    }, delta);
  }

  /* --- sponsors -------------------------------------------------------- */
  function inscrireSponsor(nom, delta) {
    if (!nom) return null;
    return inscrire("sponsor_" + cleDe(nom), {
      name: nom, role: "sponsor", team: null,
      color: ROLES.sponsor.couleur, roleLabel: "Sponsor", icon: "tag"
    }, delta);
  }

  /* ==================================================================
   * 4. CE QUI FAIT BOUGER LES RELATIONS
   * ================================================================== */

  /* --- résultats : le staff de l'écurie juge sur la piste ------------- */
  function apresCourse(course) {
    var G = G_();
    if (!G || !course) return;
    var equipe = G.currentTeam;
    if (!equipe || equipe === "Indépendant") return;

    var d = 0;
    if (course.dnf || course.pos == null || course.pos === 0) d = -2;
    else if (course.pos === 1) d = 4;
    else if (course.pos <= 3) d = 3;
    else if (course.pos <= 6) d = 1;
    else if (course.pos >= 15) d = -1;

    if (!d) return;
    parEquipe(equipe).forEach(function (c) {
      c.relation = borne((c.relation || 50) + d, 0, 100);
      c.lastSeen = { saison: G.saison || 1, week: G.semaine || 1 };
    });
  }

  /* --- déclarations publiques ----------------------------------------
     Une conférence de presse laisse des traces : le journaliste qui a posé
     la question retient le ton, et une attaque publique se paie auprès de
     l'écurie visée. */
  function apresDeclaration(journaliste, ton, cible) {
    var effets = {
      assure:      { presse: 2,  staff: 0 },
      mesure:      { presse: 2,  staff: 1 },
      humble:      { presse: 1,  staff: 3 },
      provocateur: { presse: 4,  staff: -4 },
      evasif:      { presse: -3, staff: 0 }
    };
    var e = effets[ton] || effets.mesure;

    if (journaliste) inscrireJournaliste(journaliste, e.presse);

    var G = G_();
    if (G && e.staff) {
      var equipe = cible || G.currentTeam;
      parEquipe(equipe).forEach(function (c) {
        c.relation = borne((c.relation || 50) + e.staff, 0, 100);
      });
    }
  }

  /* ==================================================================
   * 5. LE MARCHÉ DES PILOTES
   *
   * Les offres consultaient un seuil de réputation et rien d'autre. Le
   * réseau s'y invite : une bonne relation abaisse l'exigence d'un cran,
   * une relation détestable ferme la porte pour de bon.
   * ================================================================== */
  var SEUIL_APPUI = 65;      // au-delà, le décideur pousse votre dossier
  var SEUIL_SPONTANE = 80;   // au-delà, il vient vous chercher
  var SEUIL_VETO = 25;       // en dessous, son écurie ne vous appellera pas

  /* Remise consentie sur la réputation exigée. Plafonnée pour que le
     réseau déplace d'un cran, jamais de trois. */
  function remise(equipe) {
    var f = faveur(equipe);
    if (!f) return 0;
    if (f.relation < SEUIL_APPUI) return 0;
    var marge = (f.relation - SEUIL_APPUI) / (100 - SEUIL_APPUI);
    return Math.round(marge * 12);          // douze points de réputation au mieux
  }

  function veto(equipe) {
    var f = faveur(equipe);
    return !!(f && f.relation <= SEUIL_VETO);
  }

  function ajusterOffres(liste) {
    if (!Array.isArray(liste)) return liste;
    return liste.filter(function (o) {
      if (!o || !o.team) return true;
      if (o.fromNegotiation || o.pendingTransfer) return true;
      /* Une écurie dont le décideur vous déteste ne recrute pas. */
      if (veto(o.team)) {
        o._rj101Bloquee = true;
        return false;
      }
      return true;
    }).map(function (o) {
      if (!o || !o.team || typeof o.repReq !== "number") return o;
      var r = remise(o.team);
      if (r > 0) {
        o._rj101RepReqOrigine = o.repReq;
        o.repReq = Math.max(0, o.repReq - r);
        var f = faveur(o.team);
        o._rj101Appui = f && f.decideur ? f.decideur.name : null;
      }
      return o;
    });
  }

  /* Offre spontanée : quand le contrat touche à sa fin ou que la
     confiance s'effondre, un décideur très proche vient vous chercher. */
  function offreSpontanee() {
    var G = G_();
    if (!G) return null;

    var semaines = (typeof G.contractWeeksLeft === "number") ? G.contractWeeksLeft : 999;
    var confiance = 50;
    try { if (typeof TEAM_TRUST !== "undefined" && TEAM_TRUST) confiance = TEAM_TRUST.value; } catch (e) {}
    var enDanger = (semaines > 0 && semaines <= 26) || confiance < 30 || G.currentTeam === "Indépendant";
    if (!enDanger) return null;

    /* On cherche le décideur le plus proche, hors écurie actuelle. */
    var candidats = tous().filter(function (c) {
      return (c.role === "tp" || c.role === "dir_sport") &&
             c.team && c.team !== G.currentTeam &&
             (c.relation || 0) >= SEUIL_SPONTANE;
    }).sort(function (a, b) { return poids(b) - poids(a); });

    if (!candidats.length) return null;
    var d = candidats[0];

    /* Une seule sollicitation par écurie et par saison. */
    if (!G._rj101Sollicites) G._rj101Sollicites = {};
    var cle = d.team + "|" + (G.saison || 1);
    if (G._rj101Sollicites[cle]) return null;
    G._rj101Sollicites[cle] = true;

    return { equipe: d.team, contact: d };
  }

  /* ==================================================================
   * 6. LE FILET DE SÉCURITÉ
   *
   * Perdre son baquet ne doit pas signifier la fin brutale : le jeu
   * interroge le réseau avant de laisser le pilote sans rien. C'est là
   * que se paie l'entretien — ou son absence.
   * ================================================================== */
  function porteDeSortie() {
    var G = G_();
    if (!G) return null;

    var appuis = tous().filter(function (c) {
      return (c.role === "tp" || c.role === "dir_sport" || c.role === "agent") &&
             c.team && c.team !== G.currentTeam;
    }).sort(function (a, b) { return poids(b) - poids(a); });

    if (!appuis.length) return { type: "aucune", contact: null };

    var meilleur = appuis[0];
    var p = poids(meilleur);

    if (p >= 70) return { type: "titulaire", contact: meilleur, equipe: meilleur.team };
    if (p >= 45) return { type: "reserve", contact: meilleur, equipe: meilleur.team };
    if (p >= 25) return { type: "categorie_inferieure", contact: meilleur, equipe: meilleur.team };
    return { type: "aucune", contact: meilleur };
  }

  /* ==================================================================
   * 6 bis. UN STAFF QUI NE CHANGE PLUS DE NOM
   *
   * STAFF_BY_TEAM n'était pas sauvegardé : à chaque rechargement de la
   * partie, les directeurs et ingénieurs étaient tirés au sort à nouveau.
   * D'où deux conséquences fâcheuses — le team principal de votre écurie
   * changeait d'identité d'une session à l'autre, et le répertoire
   * accumulait des contacts fantômes, plusieurs « Team Principal » pour
   * une même écurie.
   *
   * Un système de relations n'a aucun sens sur des interlocuteurs qui ne
   * survivent pas à une fermeture d'application : on le persiste.
   * ================================================================== */
  function brancherPersistanceStaff() {
    if (!Array.isArray(window.RJ_SAVE_HOOKS)) return false;
    if (window.RJ_SAVE_HOOKS.some(function (h) { return h && h.cle === "staff"; })) return true;
    window.RJ_SAVE_HOOKS.push({
      cle: "staff",
      ecrire: function () {
        try {
          if (typeof window.STAFF_BY_TEAM === "undefined") return null;
          return { parEquipe: window.STAFF_BY_TEAM };
        } catch (e) { return null; }
      },
      lire: function (bloc) {
        try {
          if (!bloc || !bloc.parEquipe) return;
          if (typeof window.STAFF_BY_TEAM === "undefined") return;
          Object.keys(bloc.parEquipe).forEach(function (cat) {
            window.STAFF_BY_TEAM[cat] = bloc.parEquipe[cat];
          });
        } catch (e) {}
      }
    });
    return true;
  }

  /* La synchronisation d'origine réécrit les rôles depuis d'anciennes
     rencontres : on repasse derrière pour qu'un rôle décisionnel reste
     unique par écurie. */
  function brancherNormalisation() {
    if (typeof window.syncNetworkFromSources !== "function") return false;
    if (window.syncNetworkFromSources._rj101) return true;
    var orig = window.syncNetworkFromSources;
    window.syncNetworkFromSources = function () {
      var r = orig.apply(this, arguments);
      try {
        var G = G_();
        if (G && G.currentTeam) amorcerStaff(G.currentTeam);
      } catch (e) {}
      return r;
    };
    window.syncNetworkFromSources._rj101 = true;
    return true;
  }

  /* ==================================================================
   * 7. INSTALLATION
   * ================================================================== */
  var _orig = {};

  function installer() {
    var pose = 0;

    /* --- marché : on filtre et ajuste la liste produite ------------- */
    if (typeof window.buildTransferOffers === "function" && !window.buildTransferOffers._rj101) {
      _orig.buildTransferOffers = window.buildTransferOffers;
      window.buildTransferOffers = function () {
        var liste = _orig.buildTransferOffers.apply(this, arguments);
        try { return ajusterOffres(liste); } catch (e) {
          console.warn(TAG, "ajustement :", e && e.message);
          return liste;
        }
      };
      window.buildTransferOffers._rj101 = true;
      pose++;
    }

    /* --- résultats : après chaque course --------------------------- */
    if (Array.isArray(window.RACE_POST_HOOKS) &&
        !window.RACE_POST_HOOKS.some(function (h) { return h && h._rj101; })) {
      var hook = function () {
        try {
          var G = G_();
          var c = (G && G.races) ? G.races[G.races.length - 1] : null;
          apresCourse(c);
        } catch (e) {}
      };
      hook._rj101 = true;
      window.RACE_POST_HOOKS.push(hook);
      pose++;
    }

    /* --- déclarations : la salle de presse alimente le réseau ------- */
    if (window._rj100 && !window._rj100._rj101Branché) {
      window._rj100._rj101Branché = true;
      window._rj101SurDeclaration = apresDeclaration;
      pose++;
    }

    return pose > 0;
  }

  /* Le staff de sa propre écurie : un pilote connaît forcément son team
     principal et son ingénieur de course. Le réseau ne se remplissait
     qu'au fil de rencontres fortuites, si bien qu'il pouvait rester vide
     après plusieurs saisons chez la même équipe. */
  var CORRESPONDANCE = {
    tp:        { role: "tp",         label: "Team Principal",      depart: 55 },
    dir_sport: { role: "dir_sport",  label: "Directeur Sportif",   depart: 52 },
    dir_tech:  { role: "dir_tech",   label: "Directeur Technique", depart: 50 },
    race_eng:  { role: "ing_course", label: "Ingénieur de course", depart: 60 }
  };

  function amorcerStaff(equipe) {
    var G = G_();
    if (!G || !equipe || equipe === "Indépendant") return 0;
    if (typeof window.getTeamStaff !== "function") return 0;

    var staff = null;
    try { staff = window.getTeamStaff(equipe, G.cat); } catch (e) {}
    if (!staff) return 0;

    var n = 0;
    var officiels = {};
    Object.keys(CORRESPONDANCE).forEach(function (k) {
      var p = staff[k];
      if (!p || !p.name) return;
      var conf = CORRESPONDANCE[k];
      var cle = "paddock_" + cleDe(p.name);
      officiels[cle] = true;
      if (G._network && G._network[cle]) return;
      var entree = inscrire(cle, {
        name: p.name, role: conf.role, team: equipe,
        color: role(conf.role).couleur, roleLabel: conf.label, icon: "user"
      }, 0);
      /* L'ingénieur de course, qu'on côtoie chaque week-end, démarre plus
         haut qu'un directeur technique aperçu de loin. */
      if (entree) entree.relation = conf.depart;
      n++;
    });

    /* Une écurie n'a qu'un team principal. Le répertoire en accumulait
       plusieurs — le staff officiel et d'anciennes rencontres fortuites se
       superposaient, si bien que Williams affichait deux team principals.
       Le staff renvoyé par le jeu fait autorité : les autres sont
       rétrogradés en simples contacts plutôt que supprimés, car la
       relation nouée avec eux reste acquise. */
    if (G._network) {
      var uniques = { tp: true, dir_sport: true, dir_tech: true, ing_course: true };
      Object.keys(G._network).forEach(function (cle) {
        var c = G._network[cle];
        if (!c || c.team !== equipe) return;
        /* Rôle hérité d'une ancienne nomenclature. */
        if (c.role === "race_eng") {
          c.role = "ing_course";
          c.roleLabel = "Ingénieur de course";
        }
        if (uniques[c.role] && !officiels[cle]) {
          c.role = "contact";
          c.roleLabel = "Ancien contact";
          c.color = role("contact").couleur;
        }
      });
    }
    return n;
  }

  function amorcerContacts() {
    var G = G_();
    if (!G) return;
    try {
      amorcerStaff(G.currentTeam);
      /* Les pilotes de la grille : on connaît forcément ses adversaires. */
      (G.rivals || []).slice(0, 6).forEach(function (r) {
        var cle = "pilote_" + cleDe(r.name);
        if (!G._network || !G._network[cle]) inscrirePilote(r, 0);
      });
    } catch (e) { console.warn(TAG, "amorçage :", e && e.message); }
  }

  /* L'amorçage doit attendre qu'une partie soit chargée : au démarrage du
     module, G existe mais ne contient encore ni écurie ni rivaux. On le
     rejoue donc à chaque retour sur l'accueil, sans doublon possible
     puisque les contacts déjà inscrits sont ignorés. */
  function brancherAmorcage() {
    if (!Array.isArray(window.RJ_SCREEN_HOOKS)) return false;
    if (window.RJ_SCREEN_HOOKS.some(function (h) { return h && h.id === "101-reseau"; })) return true;
    window.RJ_SCREEN_HOOKS.push({
      id: "101-reseau",
      ecran: "S-home",
      apres: function () { setTimeout(amorcerContacts, 120); }
    });
    return true;
  }

  function boot() {
    var essais = 0;
    (function tenter() {
      if (installer()) {
        brancherPersistanceStaff();
        brancherNormalisation();
        brancherAmorcage();
        amorcerContacts();
        console.log(TAG, "réseau actif — " + tous().length + " contact(s)");
        return;
      }
      if (essais++ < 80) setTimeout(tenter, 150);
    })();

    window._rj101 = {
      ROLES: ROLES, role: role, poids: poids,
      tous: tous, parEquipe: parEquipe, decideur: decideur, faveur: faveur,
      meilleurs: meilleursContacts,
      inscrireJournaliste: inscrireJournaliste,
      inscrirePilote: inscrirePilote,
      inscrireSponsor: inscrireSponsor,
      apresCourse: apresCourse, apresDeclaration: apresDeclaration,
      remise: remise, veto: veto, ajusterOffres: ajusterOffres,
      offreSpontanee: offreSpontanee, porteDeSortie: porteDeSortie,
      amorcerStaff: amorcerStaff,
      SEUILS: { appui: SEUIL_APPUI, spontane: SEUIL_SPONTANE, veto: SEUIL_VETO }
    };
    window._rj101Uninstall = function () {
      Object.keys(_orig).forEach(function (k) { window[k] = _orig[k]; });
      if (Array.isArray(window.RACE_POST_HOOKS)) {
        window.RACE_POST_HOOKS = window.RACE_POST_HOOKS.filter(function (h) { return !(h && h._rj101); });
      }
      console.log(TAG, "désinstallé");
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
