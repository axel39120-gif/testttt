/* =====================================================================
 * 79-pilote-reserve.js — LE PILOTE DE RÉSERVE COMME VRAI CHEMIN DE CARRIÈRE
 *
 * AVANT : le rôle N°3 (14-team-dynamics) n'était qu'un badge. Le réserviste
 * courait les 20 courses comme un titulaire, marquait des points, jouait des
 * qualifs. Le rôle n'existait pas ludiquement.
 *
 * APRÈS : le réserviste NE COURT PLUS. Son week-end tient en une séance
 * d'essais et une veille de course. Il est jugé non sur des positions mais
 * sur sa CRÉDIBILITÉ (écart au titulaire en essais, remplacements réussis,
 * travail au simulateur), qui ouvre — ou ferme — la porte d'un baquet.
 *
 * CE QUE LE MODULE APPORTE
 * ------------------------
 *   1. Week-end de réserviste court (séance d'essais + veille) à la place du
 *      week-end complet, avec simulation du Grand Prix pour les IA afin que
 *      le championnat continue d'avancer normalement.
 *   2. Contrat de réserve CUMULABLE : titulaire en F2 + réserviste en F1.
 *      Les échéances s'insèrent dans G._scheduledEvents, donc dans la même
 *      chronologie que les courses (getNextMoment les mélange déjà).
 *   3. Remplacement : quand un titulaire est indisponible, le réserviste
 *      prend le volant pour un week-end COMPLET et normal — au besoin dans
 *      une autre catégorie, via bascule de contexte réversible.
 *   4. Baquets qui se libèrent EN COURS DE SAISON (blessure, rupture,
 *      retraite, série de mauvais résultats) — inexistant jusqu'ici. Plus un
 *      pilote est titré et populaire, moins son écurie s'en sépare.
 *   5. Offres de réserve au mercato, y compris hors F1, et signature d'un
 *      baquet titulaire en pleine saison.
 *   6. Trace complète dans le palmarès : saisons de réserviste, séances,
 *      remplacements, issue.
 *
 * OPTION A — aucun fichier cœur modifié. Tout passe par des enveloppes de
 * fonctions globales (goToRaceWeekend, signContract, saveGame, loadSave,
 * saveSeasonToHistory, renderPalmares, openScheduledEvent) et par les hooks
 * existants (WEEKLY_TICK_HOOKS, RACE_POST_HOOKS).
 *
 * PERSISTANCE : saveGame énumère explicitement ses champs, un ajout naïf ne
 * survivrait pas au rechargement. On enveloppe donc saveGame/loadSave pour
 * écrire un bloc « rj79 » à côté, dans le même slot.
 *
 * Réversible : window._rj79Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[79-reserve]";
  var GREEN = "#34D399", AMBER = "#F59E0B", RED = "#EF4444", CYAN = "#00D4FF";

  /* ==================================================================
   * 0. UTILITAIRES
   * ================================================================== */

  function G_() { return typeof window.G !== "undefined" ? window.G : null; }
  function fn(n) { return typeof window[n] === "function"; }
  function has(n) { return typeof window[n] !== "undefined"; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function nomPilote() {
    var G = G_(); if (!G || !G.pilot) return "Le pilote";
    return (G.pilot.prenom ? G.pilot.prenom + " " : "") + (G.pilot.nom || "");
  }
  function saison() { var G = G_(); return G ? (G.saison || 1) : 1; }
  function semaine() { var G = G_(); return G ? (G.semaine || 1) : 1; }
  function nomFamille(n) { return n ? String(n).split(" ").pop() : "le titulaire"; }

  /* Catégories dans lesquelles un baquet de réserve a du sens : celles qui
     ont une vraie structure d'écurie. Le karting en est exclu. */
  var CATS_RESERVE = [
    "Formule 1", "Formule 2", "Formule 3", "Formula Regional",
    "Super Formula", "Endurance WEC", "IndyCar"
  ];
  function catAdmetReserve(c) { return CATS_RESERVE.indexOf(c) >= 0; }

  /* ==================================================================
   * 1. ÉTAT DU CONTRAT DE RÉSERVE
   *
   * G._reserveDeal — contrat courant (un seul à la fois) :
   *   { team, cat, saison, cumul, salary, credibilite,
   *     sessions:[{week,circuit,delta,verdict,gain}],
   *     remplacements:[{week,circuit,pos,cause,cat,team}],
   *     issue, weeksPlanned:[] }
   *
   * cumul=false : le réserviste EST dans sa catégorie principale (G.cat),
   *               il ne court aucune course de la saison.
   * cumul=true  : contrat parallèle dans une autre catégorie ; le joueur
   *               garde son baquet titulaire et ses courses.
   * ================================================================== */

  function RD() { var G = G_(); return G ? (G._reserveDeal || null) : null; }

  function setRD(d) { var G = G_(); if (G) G._reserveDeal = d || null; }

  /* Réserviste « pur » : pas de baquet de course cette saison. */
  function estReservistePur() {
    var G = G_(), d = RD();
    if (!G) return false;
    if (d && !d.cumul) return true;
    /* rôle N°3 hérité du module 14 sans contrat encore matérialisé */
    return G._playerRole === "num3" && !!G.currentTeam && G.currentTeam !== "Indépendant";
  }

  function aContratReserve() { return !!RD(); }

  /* Crédibilité : la monnaie du réserviste (0-100). */
  function credibilite() { var d = RD(); return d ? clamp(d.credibilite || 0, 0, 100) : 0; }

  function changeCredibilite(delta, raison) {
    var d = RD(); if (!d) return 0;
    var avant = d.credibilite || 0;
    d.credibilite = clamp(Math.round(avant + delta), 0, 100);
    d.credLog = d.credLog || [];
    d.credLog.push({ delta: d.credibilite - avant, raison: raison || "", saison: saison(), week: semaine() });
    if (d.credLog.length > 40) d.credLog = d.credLog.slice(-40);
    return d.credibilite - avant;
  }

  function libelleCredibilite(v) {
    if (v >= 80) return "Incontournable";
    if (v >= 65) return "Sérieux candidat";
    if (v >= 45) return "Sur les tablettes";
    if (v >= 25) return "En observation";
    return "Ignoré";
  }

  /* Historique dédié — n'entre pas dans CAREER_HISTORY pour ne fausser
     aucun total (courses, victoires, podiums). */
  function histReserve() {
    var G = G_(); if (!G) return [];
    if (!Array.isArray(G._reserveHistory)) G._reserveHistory = [];
    return G._reserveHistory;
  }

  /* Registre des baquets libérés en cours de saison. */
  function seatsLibres() {
    var G = G_(); if (!G) return [];
    if (!Array.isArray(G._freeSeats)) G._freeSeats = [];
    return G._freeSeats;
  }

  /* ==================================================================
   * 2. PERSISTANCE
   *
   * saveGame sérialise une liste FERMÉE de champs : tout ajout dans G est
   * perdu au rechargement. On enveloppe donc la sauvegarde pour réinjecter
   * notre bloc dans le JSON du slot, et le chargement pour le relire.
   * ================================================================== */

  var _origSave = null, _origLoad = null;

  function cleSlot(slot) {
    try {
      if (has("SAVE_KEYS") && window.SAVE_KEYS && window.SAVE_KEYS[slot] != null) return window.SAVE_KEYS[slot];
    } catch (e) {}
    return "rj_s" + (Number(slot) + 1);
  }

  function blocSauvegarde() {
    var G = G_(); if (!G) return null;
    return {
      v: 1,
      deal: G._reserveDeal || null,
      history: G._reserveHistory || [],
      seats: G._freeSeats || [],
      meta: G._reserveMeta || null
    };
  }

  function installPersistance() {
    if (fn("saveGame") && !window.saveGame._rj79) {
      _origSave = window.saveGame;
      window.saveGame = function (slot) {
        var r = _origSave.apply(this, arguments);
        try {
          var G = G_(); if (!G) return r;
          var s = (typeof slot === "undefined") ? (G._slot || 0) : slot;
          var k = cleSlot(s);
          var brut = localStorage.getItem(k);
          if (brut) {
            var obj = JSON.parse(brut);
            obj.rj79 = blocSauvegarde();
            localStorage.setItem(k, JSON.stringify(obj));
          }
        } catch (e) { console.warn(TAG, "sauvegarde du bloc réserve impossible :", e && e.message); }
        return r;
      };
      window.saveGame._rj79 = true;
    }

    if (fn("loadSave") && !window.loadSave._rj79) {
      _origLoad = window.loadSave;
      window.loadSave = function (slot) {
        var r = _origLoad.apply(this, arguments);
        try {
          var G = G_(); if (!G) return r;
          var brut = localStorage.getItem(cleSlot(slot));
          var obj = brut ? JSON.parse(brut) : null;
          var b = obj && obj.rj79;
          G._reserveDeal = (b && b.deal) || null;
          G._reserveHistory = (b && b.history) || [];
          G._freeSeats = (b && b.seats) || [];
          G._reserveMeta = (b && b.meta) || null;
          rafraichirAccueil();
        } catch (e) {
          console.warn(TAG, "lecture du bloc réserve impossible :", e && e.message);
        }
        return r;
      };
      window.loadSave._rj79 = true;
    }
  }

  /* ==================================================================
   * 3. LECTURE DE LA GRILLE — titulaires, écuries, stature
   * ================================================================== */

  /* Les pilotes de l'écurie donnée, dans la catégorie courante de G.rivals. */
  function titulairesDe(team) {
    var G = G_(); if (!G || !G.rivals) return [];
    return G.rivals.filter(function (r) { return r && r.team === team && !r._rj79Gele; });
  }

  /* Le titulaire de référence pour comparer un chrono d'essais : le plus
     rapide des deux pilotes de l'écurie. */
  function titulaireReference(team) {
    var l = titulairesDe(team);
    if (!l.length) return null;
    return l.slice().sort(function (a, b) { return (b.skill || 0) - (a.skill || 0); })[0];
  }

  /* Stature d'un pilote IA : sert à décider qui l'écurie protège. Combine
     titres, victoires, niveau et ancienneté — un champion populaire ne se
     fait pas remercier pour trois mauvaises courses. */
  function stature(rival) {
    if (!rival) return 0;
    var G = G_();
    var titres = 0, victoires = 0, saisons = 0;
    try {
      var pool = G && G.driverPool;
      var p = null;
      if (pool && rival._poolId) p = pool.find(function (x) { return x.id === rival._poolId; });
      if (!p && pool) p = pool.find(function (x) { return x.name === rival.name; });
      /* Deux sources possibles selon l'âge de la partie : l'historique du
         vivier global (04o) et celui porté par le rival lui-même. On garde
         la plus fournie, sinon un palmarès réel peut passer inaperçu. */
      var hp = (p && p.history) || [];
      var hr = rival.careerHistory || [];
      var hist = (hp.length >= hr.length) ? hp : hr;
      hist.forEach(function (h) {
        if (!h) return;
        saisons++;
        if (h.finalPos === 1 || h.pos === 1) titres++;
        victoires += (h.wins || 0);
      });
    } catch (e) {}
    var sk = rival.skill || 70;
    var s = 0;
    s += titres * 26;                       // un titre pèse très lourd
    s += Math.min(30, victoires * 2.2);     // le palmarès en victoires
    s += Math.max(0, (sk - 70)) * 1.6;      // le niveau brut
    s += Math.min(10, saisons * 1.2);       // l'ancienneté / la notoriété
    if (rival._rj79Vedette) s += 15;
    return clamp(Math.round(s), 0, 100);
  }

  /* Forme récente d'un pilote IA sur ses dernières courses. */
  function formeRecente(rival, n) {
    if (!rival || !rival.raceHistory || !rival.raceHistory.length) return null;
    var h = rival.raceHistory.slice(-(n || 5));
    var somme = 0, dnf = 0;
    h.forEach(function (r) {
      var pos = r && r.pos ? r.pos : 20;
      if (r && r.dnf) { dnf++; pos = 20; }
      somme += pos;
    });
    return { moyenne: somme / h.length, dnf: dnf, n: h.length };
  }

  function ecurieDuDeal() { var d = RD(); return d ? d.team : null; }

  /* Table de points, quelle que soit la catégorie. */
  function tablePoints() {
    if (has("PTS_TABLE") && Array.isArray(window.PTS_TABLE)) return window.PTS_TABLE;
    return [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
  }

  /* ==================================================================
   * 4. SIMULATION DU GRAND PRIX SANS LE JOUEUR
   *
   * Quand le réserviste ne court pas, personne ne fait avancer le
   * championnat : les points des IA sont attribués dans finalizeLiveRace,
   * qui n'est jamais appelée. On simule donc l'épreuve pour les rivaux, en
   * réutilisant leur skill et leur régularité, afin que la saison continue
   * d'exister autour du joueur.
   * ================================================================== */

  function simulerCourseSansJoueur(circuit) {
    var G = G_(); if (!G || !G.rivals || !G.rivals.length) return null;
    var pts = tablePoints();

    var classement = G.rivals.map(function (r, idx) {
      var sk = (r.skill || 70) / 100;
      var reg = (r.consistency || r.co || 70) / 100;
      var forme = (typeof r.formIndex === "number") ? r.formIndex : 0;
      /* variance inversement proportionnelle à la régularité */
      var alea = (Math.random() - 0.5) * (0.34 - 0.18 * reg);
      var abandon = Math.random() < (0.045 + 0.05 * (1 - reg));
      return { idx: idx, r: r, score: sk + forme * 0.02 + alea, dnf: abandon };
    });

    classement.sort(function (a, b) {
      if (a.dnf !== b.dnf) return a.dnf ? 1 : -1;
      return b.score - a.score;
    });

    var resultats = [];
    classement.forEach(function (c, i) {
      var pos = i + 1;
      var gain = c.dnf ? 0 : (pts[pos - 1] || 0);
      c.r.pts = (c.r.pts || 0) + gain;
      c.r.lastPos = pos;
      c.r.raceHistory = c.r.raceHistory || [];
      c.r.raceHistory.push({ pos: pos, pts: gain, dnf: !!c.dnf, simulee: true });
      if (!c.dnf && pos === 1) c.r.wins = (c.r.wins || 0) + 1;
      if (!c.dnf && pos <= 3) c.r.podiums = (c.r.podiums || 0) + 1;
      resultats.push({ nom: c.r.name, team: c.r.team, pos: pos, pts: gain, dnf: !!c.dnf, skill: c.r.skill });
    });

    return { circuit: circuit || "", resultats: resultats };
  }

  /* Ce qu'a fait l'écurie du réserviste ce week-end. */
  function resultatEcurie(sim, team) {
    if (!sim) return [];
    return sim.resultats.filter(function (r) { return r.team === team; });
  }

  /* ==================================================================
   * 5. LA SÉANCE D'ESSAIS — le seul chiffre qui compte : l'écart
   *
   * Pas de setup, pas de gestion de pneus, pas de classement : trois
   * programmes possibles, un écart au titulaire, un verdict du staff.
   * ================================================================== */

  var PROGRAMMES = [
    {
      id: "propre",
      titre: "Programme sage",
      desc: "Tu enchaînes les tours proprement, sans chercher la limite. Peu de risque, peu d'éclat.",
      risque: 0.06, bonus: -0.06, variance: 0.10
    },
    {
      id: "chrono",
      titre: "Chercher le chrono",
      desc: "Tu montes les gommes tendres et tu vises le tour de référence. C'est là qu'on te jugera.",
      risque: 0.20, bonus: 0.14, variance: 0.26
    },
    {
      id: "long",
      titre: "Programme d'endurance",
      desc: "Relais long, pas de gloire au chrono, mais des données que les ingénieurs attendent.",
      risque: 0.09, bonus: 0.02, variance: 0.14, technique: true
    }
  ];

  /* Écart au titulaire, en secondes. Négatif = le réserviste va plus vite. */
  function calculerEcart(prog) {
    var G = G_(), d = RD();
    var ref = titulaireReference(d ? d.team : (G && G.currentTeam));
    var skillRef = ref ? (ref.skill || 80) : 82;

    /* niveau du joueur : on privilégie le score de performance du moteur */
    var perf;
    if (fn("computeRacePerformanceScore")) {
      try { perf = window.computeRacePerformanceScore(); } catch (e) { perf = null; }
    }
    if (typeof perf !== "number" || !isFinite(perf)) {
      var s = (G && G.stats) || {};
      perf = (0.35 * (s.vitesse || 50) + 0.25 * (s.regularite || 50) +
              0.20 * (s.sangfroid || 50) + 0.20 * (s.strategie || 50)) / 100;
    }
    var skillJoueur = clamp(perf * 100, 30, 99);

    /* Le manque de roulage coûte cher : un réserviste découvre la voiture. */
    var d_ = RD();
    var seances = d_ ? (d_.sessions || []).length : 0;
    var rouille = Math.max(0, 0.62 - seances * 0.075);   // s'estompe avec l'expérience

    var base = (skillRef - skillJoueur) * 0.030;          // écart de niveau -> secondes
    var ecart = base + rouille - (prog ? prog.bonus : 0);
    ecart += (Math.random() - 0.42) * (prog ? prog.variance : 0.18) * 3;

    var incident = Math.random() < (prog ? prog.risque : 0.1);
    if (incident) ecart += 0.5 + Math.random() * 1.1;

    return { ecart: Math.round(ecart * 1000) / 1000, incident: incident, ref: ref };
  }

  function verdictSeance(ecart, incident) {
    if (incident && ecart > 1.2) {
      return { cle: "faute", label: "Séance gâchée", couleur: RED,
               texte: "Une sortie de piste, un drapeau rouge, et la séance s'arrête là. Les ingénieurs n'ont presque rien récolté." };
    }
    if (ecart <= 0)   return { cle: "exceptionnel", label: "Plus rapide que le titulaire", couleur: GREEN,
      texte: "Personne ne s'attendait à ça. Le garage a relevé la tête quand le chrono est tombé." };
    if (ecart <= 0.25) return { cle: "excellent", label: "Séance de référence", couleur: GREEN,
      texte: "À un souffle du titulaire, sur une voiture que tu connais à peine. Le message est passé." };
    if (ecart <= 0.55) return { cle: "solide", label: "Séance solide", couleur: CYAN,
      texte: "Propre, régulier, dans le rythme. Exactement ce qu'on attend d'un réserviste." };
    if (ecart <= 0.95) return { cle: "correct", label: "Séance correcte", couleur: AMBER,
      texte: "Rien à jeter, rien à retenir non plus. Tu as fait le travail demandé." };
    return { cle: "decevant", label: "Séance décevante", couleur: RED,
      texte: "L'écart est trop gros pour être mis sur le compte de la découverte. Les ingénieurs ont noté." };
  }

  var GAIN_SEANCE = {
    exceptionnel: { cred: 14, trust: 6,  rep: 3 },
    excellent:    { cred: 10, trust: 4,  rep: 2 },
    solide:       { cred: 6,  trust: 2,  rep: 1 },
    correct:      { cred: 2,  trust: 1,  rep: 0 },
    decevant:     { cred: -5, trust: -2, rep: 0 },
    faute:        { cred: -9, trust: -4, rep: 0 }
  };

  function appliquerEffetsSeance(verdict, prog) {
    var G = G_(), gains = GAIN_SEANCE[verdict.cle] || GAIN_SEANCE.correct;
    var effets = [];

    var dc = changeCredibilite(gains.cred, "Séance d'essais — " + verdict.label);
    if (dc) effets.push({ txt: "Crédibilité " + (dc > 0 ? "+" : "") + dc, ton: dc > 0 ? "pos" : "neg" });

    if (gains.trust && fn("changeTrust")) {
      try { window.changeTrust(gains.trust, "Séance d'essais (réserve)", gains.trust > 0 ? "↑" : "↓"); } catch (e) {}
      effets.push({ txt: "Confiance de l'écurie " + (gains.trust > 0 ? "+" : "−") + Math.abs(gains.trust),
                    ton: gains.trust > 0 ? "pos" : "neg" });
    }

    if (gains.rep && G && G.rep) {
      G.rep.paddock = clamp((G.rep.paddock || 0) + gains.rep, 0, 100);
      if (fn("recomputeGlobalRep")) { try { window.recomputeGlobalRep(); } catch (e) {} }
      effets.push({ txt: "Réputation paddock +" + gains.rep, ton: "pos" });
    }

    /* Le programme d'endurance nourrit les sous-stats techniques. */
    if (prog && prog.technique && G && G.substats) {
      try {
        ["technical", "simu"].forEach(function (k) {
          if (typeof G.substats[k] === "number") G.substats[k] = Math.min(99, G.substats[k] + 1);
        });
        if (fn("computeLegacyStats")) window.computeLegacyStats();
        effets.push({ txt: "Compréhension technique +1", ton: "pos" });
      } catch (e) {}
    }

    return effets;
  }

  /* ==================================================================
   * 6. ÉCRAN S-reserve
   *
   * Un seul écran pour tout le rôle : l'état du contrat, la séance du
   * week-end, la veille de course, l'historique des séances et des
   * remplacements. Créé dynamiquement, comme S-arcs (module 32).
   * ================================================================== */

  var CSS_ID = "rj79-css";

  function injecterCSS() {
    if (document.getElementById(CSS_ID)) return;
    var css = [
      "#S-reserve .rj79-wrap{max-width:560px;margin:0 auto;padding:0 14px 90px}",
      "#S-reserve .rj79-head{padding:16px 2px 8px}",
      "#S-reserve .rj79-eyebrow{font-family:var(--font-display);font-size:10px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:" + CYAN + "}",
      "#S-reserve .rj79-title{font-family:var(--font-display);font-size:23px;font-weight:900;color:var(--white);margin-top:5px;line-height:1.15}",
      "#S-reserve .rj79-sub{font-size:12px;color:var(--muted);margin-top:4px;font-family:var(--font-body)}",
      "#S-reserve .rj79-back{background:none;border:none;color:var(--muted);font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;padding:6px 0}",
      ".rj79-card{background:linear-gradient(160deg,var(--bg2) 0%,var(--bg) 100%);border:1px solid var(--border-hi);border-radius:var(--r);padding:14px;margin-bottom:11px}",
      ".rj79-card.accent{border-top:3px solid " + CYAN + "}",
      ".rj79-card.done{opacity:.75}",
      ".rj79-sec{font-family:var(--font-display);font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin:16px 2px 8px}",
      ".rj79-gauge{margin-bottom:11px}",
      ".rj79-gauge .lab{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px}",
      ".rj79-gauge .lab b{font-family:var(--font-display);font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}",
      ".rj79-gauge .lab i{font-style:normal;font-family:var(--font-display);font-size:12px;font-weight:800}",
      ".rj79-bar{height:4px;background:var(--line);overflow:hidden;border-radius:2px}",
      ".rj79-bar>span{display:block;height:100%;transition:width .35s ease}",
      ".rj79-opt{display:block;width:100%;text-align:left;padding:12px 13px;margin-bottom:8px;background:var(--bg3);border:2px solid var(--line);border-radius:var(--r);cursor:pointer;font-family:inherit;transition:border-color .15s,background .15s}",
      ".rj79-opt:hover{border-color:" + CYAN + "}",
      ".rj79-opt .ot{display:block;font-family:var(--font-display);font-size:13px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;color:var(--text)}",
      ".rj79-opt .od{display:block;font-size:11.5px;color:var(--muted);margin-top:4px;line-height:1.45;font-family:var(--font-body)}",
      ".rj79-btn{width:100%;padding:13px;border:none;border-radius:var(--r);background:" + CYAN + ";color:#08131a;font-family:var(--font-display);font-size:12px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;cursor:pointer}",
      ".rj79-btn.ghost{background:var(--bg4);color:var(--text);border:1px solid var(--border-hi)}",
      ".rj79-btn.red{background:" + RED + ";color:#fff}",
      ".rj79-line{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--line)}",
      ".rj79-line:last-child{border-bottom:none}",
      ".rj79-line .l{font-size:12.5px;color:var(--text);font-family:var(--font-body)}",
      ".rj79-line .l small{display:block;color:var(--muted);font-size:10.5px;margin-top:2px}",
      ".rj79-line .v{font-family:var(--font-display);font-size:13px;font-weight:800;white-space:nowrap}",
      ".rj79-empty{font-size:12px;color:var(--text3);font-style:italic;padding:4px 2px;font-family:var(--font-body)}",
      ".rj79-eff{display:flex;align-items:flex-start;gap:9px;font-size:13px;line-height:1.45;font-family:var(--font-body);margin-bottom:6px}",
      ".rj79-eff span:first-child{font-size:10px;line-height:1.7;flex-shrink:0}",
      ".rj79-tag{display:inline-flex;align-items:center;padding:2px 7px;border-radius:3px;font-family:var(--font-display);font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}",
      ".rj79-homecard{background:linear-gradient(135deg,var(--bg3),var(--bg2));border:1px solid rgba(0,212,255,.4);border-radius:var(--r);padding:13px 15px;margin:0 14px 12px;display:flex;align-items:center;gap:12px;cursor:pointer}",
      ".rj79-homecard .hc-t{font-family:var(--font-display);font-size:13px;font-weight:800;color:var(--white);letter-spacing:.03em;text-transform:uppercase}",
      ".rj79-homecard .hc-s{font-size:11px;color:var(--muted);margin-top:3px;font-family:var(--font-body)}",
      ".rj79-homecard .hc-go{margin-left:auto;color:" + CYAN + ";font-size:18px}"
    ].join("");
    var st = document.createElement("style");
    st.id = CSS_ID; st.textContent = css;
    document.head.appendChild(st);
  }

  function creerEcran() {
    if (document.getElementById("S-reserve")) return true;
    var home = document.getElementById("S-home");
    if (!home || !home.parentNode) return false;
    injecterCSS();
    var scr = document.createElement("div");
    scr.className = "scr";
    scr.id = "S-reserve";
    scr.innerHTML =
      '<div class="scroll" style="flex:1">' +
        '<div class="rj79-wrap">' +
          '<div class="rj79-head">' +
            '<button class="rj79-back" id="rj79-back">\u2190 Retour</button>' +
            '<div class="rj79-eyebrow" id="rj79-eyebrow">Pilote de réserve</div>' +
            '<div class="rj79-title" id="rj79-title">Réserve</div>' +
            '<div class="rj79-sub" id="rj79-sub"></div>' +
          '</div>' +
          '<div id="rj79-body"></div>' +
        '</div>' +
      '</div>';
    home.parentNode.appendChild(scr);

    scr.addEventListener("click", function (ev) {
      var t = ev.target;
      var back = t.closest ? t.closest("#rj79-back") : null;
      if (back) { retourAccueil(); return; }
      var el = t.closest ? t.closest("[data-rj79]") : null;
      if (!el) return;
      var action = el.getAttribute("data-rj79");
      var arg = el.getAttribute("data-arg");
      traiterAction(action, arg);
    });
    return true;
  }

  function retourAccueil() {
    if (fn("navTo")) window.navTo("S-home", "ni-home");
  }

  function ouvrirEcranReserve() {
    if (!creerEcran()) return;
    if (fn("navTo")) window.navTo("S-reserve", null);
    else {
      var all = document.querySelectorAll(".scr");
      for (var i = 0; i < all.length; i++) all[i].classList.remove("on");
      document.getElementById("S-reserve").classList.add("on");
    }
    rendreEcran();
  }

  /* ------------------------------------------------------------------
   * État d'avancement du week-end de réserviste courant.
   * etape : 'seance' -> 'veille' -> 'fini'
   * ---------------------------------------------------------------- */
  var WE = null;

  function renduJauge(label, valeur, couleur, texte) {
    var v = clamp(Math.round(valeur), 0, 100);
    return '<div class="rj79-gauge">' +
      '<div class="lab"><b>' + esc(label) + '</b><i style="color:' + couleur + '">' +
        v + (texte ? ' \u00b7 ' + esc(texte) : '') + '</i></div>' +
      '<div class="rj79-bar"><span style="width:' + v + '%;background:' + couleur + '"></span></div>' +
    '</div>';
  }

  function couleurCred(v) { return v >= 65 ? GREEN : (v >= 40 ? CYAN : (v >= 22 ? AMBER : RED)); }

  /* variante dont le sous-titre échappe à l'arrondi global (écarts) */
  function ligneProtegee(label, sousTitre, valeur, couleur) {
    return '<div class="rj79-line"><div class="l">' + esc(label) +
      (sousTitre ? '<small data-rj-noround="1">' + esc(sousTitre) + '</small>' : '') + '</div>' +
      '<div class="v" style="color:' + (couleur || "var(--text)") + '">' + valeur + '</div></div>';
  }

  function ligne(label, sousTitre, valeur, couleur) {
    return '<div class="rj79-line"><div class="l">' + esc(label) +
      (sousTitre ? '<small>' + esc(sousTitre) + '</small>' : '') + '</div>' +
      '<div class="v" style="color:' + (couleur || "var(--text)") + '">' + valeur + '</div></div>';
  }

  function fmtEcart(e) {
    if (typeof e !== "number") return "—";
    return (e > 0 ? "+" : (e < 0 ? "\u2212" : "")) + Math.abs(e).toFixed(3) + " s";
  }

  /* 04q-polish-rebalance arrondit toutes les décimales du DOM ; il épargne
     ce qui porte data-rj-noround. Un écart d'essais perd tout son sens
     arrondi à la seconde, on protège donc chaque affichage. */
  function fmtEcartHTML(e) {
    return '<span data-rj-noround="1">' + fmtEcart(e) + '</span>';
  }

  /* ------------------------------------------------------------------
   * Rendu principal de l'écran
   * ---------------------------------------------------------------- */
  function rendreEcran() {
    var G = G_(), d = RD();
    var body = document.getElementById("rj79-body");
    if (!body) return;

    var titre = document.getElementById("rj79-title");
    var sub = document.getElementById("rj79-sub");
    var eyebrow = document.getElementById("rj79-eyebrow");

    if (!d) {
      if (titre) titre.textContent = "Aucun engagement";
      if (sub) sub.textContent = "Tu n'as pas de contrat de pilote de réserve en cours.";
      body.innerHTML = '<div class="rj79-card"><div class="rj79-empty">Les baquets de réserve se signent au mercato, ' +
        'dans l\'onglet Contrats.</div></div>';
      return;
    }

    if (eyebrow) eyebrow.textContent = d.cumul ? "Second engagement" : "Pilote de réserve";
    if (titre) titre.textContent = d.team;
    if (sub) {
      sub.textContent = d.cat + " \u00b7 saison " + d.saison +
        (d.cumul && G ? " \u00b7 en parallèle de ton baquet " + G.cat : "");
    }

    var h = "";

    /* --- jauges --- */
    var cred = credibilite();
    h += '<div class="rj79-card accent">';
    h += renduJauge("Crédibilité", cred, couleurCred(cred), libelleCredibilite(cred));
    if (has("TEAM_TRUST") && window.TEAM_TRUST && !d.cumul) {
      var tv = window.TEAM_TRUST.value || 0;
      h += renduJauge("Confiance de l'écurie", tv, tv >= 60 ? GREEN : (tv >= 35 ? AMBER : RED), "");
    }
    h += '<div style="font-size:11.5px;color:var(--muted);line-height:1.5;font-family:var(--font-body);margin-top:2px">' +
      texteCredibilite(cred) + '</div>';
    h += '</div>';

    /* --- le week-end en cours --- */
    h += blocWeekEnd();

    /* --- séances --- */
    h += '<div class="rj79-sec">Séances d\'essais</div><div class="rj79-card">';
    var ses = (d.sessions || []).slice().reverse();
    if (!ses.length) h += '<div class="rj79-empty">Aucune séance disputée pour le moment.</div>';
    else {
      ses.slice(0, 8).forEach(function (s) {
        h += ligne(s.circuit || "Séance", (s.verdict || "") + (s.ref ? " \u00b7 face à " + nomFamille(s.ref) : ""),
          fmtEcartHTML(s.delta), s.delta <= 0.25 ? GREEN : (s.delta <= 0.55 ? CYAN : (s.delta <= 0.95 ? AMBER : RED)));
      });
      var moy = moyenneEcart();
      if (moy !== null) {
        h += '<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line);' +
          'display:flex;justify-content:space-between;align-items:baseline">' +
          '<span style="font-family:var(--font-display);font-size:10px;font-weight:800;letter-spacing:.12em;' +
          'text-transform:uppercase;color:var(--muted)">Écart moyen</span>' +
          '<span style="font-family:var(--font-display);font-size:15px;font-weight:900;color:' +
          (moy <= 0.4 ? GREEN : moy <= 0.8 ? AMBER : RED) + '" data-rj-noround="1">' + fmtEcart(moy) + '</span></div>';
      }
    }
    h += '</div>';

    /* --- remplacements --- */
    h += '<div class="rj79-sec">Remplacements</div><div class="rj79-card">';
    var rem = (d.remplacements || []).slice().reverse();
    if (!rem.length) h += '<div class="rj79-empty">Tu n\'as encore jamais pris le départ pour cette écurie. ' +
      'Reste prêt : ça se décide parfois la veille.</div>';
    else rem.forEach(function (r) {
      var lab = r.pos ? ("P" + r.pos) : "Abandon";
      h += ligne((r.circuit || "Grand Prix") + " \u00b7 " + (r.cat || d.cat),
        r.cause || "", lab, r.pos && r.pos <= 10 ? GREEN : AMBER);
    });
    h += '</div>';

    body.innerHTML = h;
  }

  function texteCredibilite(v) {
    if (v >= 80) return "L'écurie te considère comme le prochain sur la liste. Un baquet se libère, ton nom sort en premier.";
    if (v >= 65) return "Ton nom circule dans le paddock. Il te manque une occasion de le confirmer en course.";
    if (v >= 45) return "On te regarde travailler. Rien n'est joué, mais tu existes.";
    if (v >= 25) return "Tu fais le travail sans marquer les esprits. Il va falloir un coup d'éclat.";
    return "Pour l'instant, tu es une ligne sur un organigramme. Change ça.";
  }

  function moyenneEcart() {
    var d = RD(); if (!d || !d.sessions || !d.sessions.length) return null;
    var s = 0, n = 0;
    d.sessions.forEach(function (x) { if (typeof x.delta === "number") { s += x.delta; n++; } });
    return n ? Math.round((s / n) * 1000) / 1000 : null;
  }

  /* ------------------------------------------------------------------
   * Bloc « ce week-end » — pilote les trois étapes
   * ---------------------------------------------------------------- */
  function blocWeekEnd() {
    var d = RD();
    if (!WE || !d) {
      return '<div class="rj79-card"><div class="rj79-empty">Pas d\'échéance en cours. ' +
        'Avance dans la saison pour rejoindre le prochain week-end.</div></div>';
    }

    var h = '<div class="rj79-sec">' + esc(WE.circuit || "Week-end") + '</div>';

    if (WE.etape === "seance") {
      h += '<div class="rj79-card accent">';
      h += '<div style="font-family:var(--font-display);font-size:14px;font-weight:900;color:var(--white);' +
        'letter-spacing:.02em;margin-bottom:6px">Tu prends le volant en essais libres</div>';
      h += '<div style="font-size:12.5px;color:var(--soft);line-height:1.5;font-family:var(--font-body);margin-bottom:12px">' +
        'Une heure, une voiture que tu ne connais pas, et deux titulaires qui regardent ton chrono. ' +
        'Choisis ton programme.</div>';
      PROGRAMMES.forEach(function (p, i) {
        h += '<button class="rj79-opt" data-rj79="programme" data-arg="' + i + '">' +
          '<span class="ot">' + esc(p.titre) + '</span>' +
          '<span class="od">' + esc(p.desc) + '</span></button>';
      });
      h += '</div>';
      return h;
    }

    if (WE.etape === "resultat") {
      var v = WE.verdict || {};
      h += '<div class="rj79-card" style="border-top:3px solid ' + (v.couleur || CYAN) + '">';
      h += '<div style="font-family:var(--font-display);font-size:10px;font-weight:800;letter-spacing:.2em;' +
        'text-transform:uppercase;color:' + (v.couleur || CYAN) + ';margin-bottom:4px">Séance terminée</div>';
      h += '<div style="font-family:var(--font-display);font-size:18px;font-weight:900;color:var(--white);' +
        'line-height:1.2;margin-bottom:8px">' + esc(v.label || "") + '</div>';
      h += '<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:10px">' +
        '<span data-rj-noround="1" style="font-family:var(--font-display);font-size:26px;font-weight:900;color:' + (v.couleur || CYAN) + '">' +
        fmtEcart(WE.delta) + '</span>' +
        '<span style="font-size:11.5px;color:var(--muted);font-family:var(--font-body)">face à ' +
        esc(WE.refNom || "le titulaire") + '</span></div>';
      h += '<div style="font-size:13px;color:var(--text);line-height:1.5;font-family:var(--font-body)">' +
        esc(v.texte || "") + '</div>';
      h += '<div style="height:1px;background:var(--line);margin:13px 0"></div>';
      (WE.effets || []).forEach(function (e) {
        var c = e.ton === "pos" ? GREEN : (e.ton === "neg" ? RED : "#9CA3AF");
        var puce = e.ton === "pos" ? "\u25B2" : (e.ton === "neg" ? "\u25BC" : "\u2022");
        h += '<div class="rj79-eff" style="color:' + c + '"><span>' + puce + '</span><span>' + esc(e.txt) + '</span></div>';
      });
      h += '<button class="rj79-btn" style="margin-top:14px" data-rj79="vers-veille">Suite du week-end</button>';
      h += '</div>';
      return h;
    }

    if (WE.etape === "veille") {
      h += '<div class="rj79-card">';
      h += '<div style="font-family:var(--font-display);font-size:14px;font-weight:900;color:var(--white);' +
        'margin-bottom:6px">Dimanche — au mur des stands</div>';
      h += '<div style="font-size:12.5px;color:var(--soft);line-height:1.5;font-family:var(--font-body);margin-bottom:12px">' +
        'Casque rangé, tu suis la course depuis le muret. Comment occupes-tu ton dimanche ?</div>';
      OCCUPATIONS.forEach(function (o, i) {
        h += '<button class="rj79-opt" data-rj79="occupation" data-arg="' + i + '">' +
          '<span class="ot">' + esc(o.titre) + '</span>' +
          '<span class="od">' + esc(o.desc) + '</span></button>';
      });
      h += '</div>';
      return h;
    }

    if (WE.etape === "bilan") {
      h += '<div class="rj79-card">';
      h += '<div style="font-family:var(--font-display);font-size:10px;font-weight:800;letter-spacing:.2em;' +
        'text-transform:uppercase;color:var(--muted);margin-bottom:8px">Course terminée</div>';
      (WE.resultatsEcurie || []).forEach(function (r) {
        h += ligne(r.nom, r.dnf ? "Abandon" : (r.pts ? r.pts + " points" : "Hors des points"),
          r.dnf ? "AB" : ("P" + r.pos), r.dnf ? RED : (r.pos <= 3 ? GREEN : "var(--text)"));
      });
      if (WE.messageOccupation) {
        h += '<div style="height:1px;background:var(--line);margin:12px 0"></div>';
        h += '<div style="font-size:13px;color:var(--text);line-height:1.5;font-family:var(--font-body)">' +
          esc(WE.messageOccupation) + '</div>';
      }
      (WE.effetsOccupation || []).forEach(function (e) {
        var c = e.ton === "pos" ? GREEN : (e.ton === "neg" ? RED : "#9CA3AF");
        var puce = e.ton === "pos" ? "\u25B2" : (e.ton === "neg" ? "\u25BC" : "\u2022");
        h += '<div class="rj79-eff" style="color:' + c + ';margin-top:6px"><span>' + puce + '</span><span>' + esc(e.txt) + '</span></div>';
      });
      h += '<button class="rj79-btn" style="margin-top:14px" data-rj79="fin-weekend">Terminer le week-end</button>';
      h += '</div>';
      return h;
    }

    return '<div class="rj79-card"><div class="rj79-empty">Week-end terminé.</div></div>';
  }

  var OCCUPATIONS = [
    {
      id: "simulateur", titre: "Simulateur en direct",
      desc: "Tu doubles la course à l'usine pour valider les options stratégiques en temps réel.",
      effets: function () {
        var G = G_(), out = [];
        var dc = changeCredibilite(4, "Travail au simulateur pendant la course");
        out.push({ txt: "Crédibilité +" + dc, ton: "pos" });
        if (G && G.substats && typeof G.substats.simu === "number") {
          G.substats.simu = Math.min(99, G.substats.simu + 1);
          if (fn("computeLegacyStats")) { try { window.computeLegacyStats(); } catch (e) {} }
          out.push({ txt: "Simulateur +1", ton: "pos" });
        }
        if (fn("changeTrust")) { try { window.changeTrust(2, "Appui simulateur (réserve)", "↑"); } catch (e) {} }
        out.push({ txt: "Confiance de l'écurie +2", ton: "pos" });
        return out;
      },
      message: "Tu as passé deux heures dans le baquet du simulateur pendant que la course se jouait. L'ingénieur stratégie a repris deux de tes fenêtres d'arrêt."
    },
    {
      id: "medias", titre: "Te rendre disponible pour la presse",
      desc: "Interviews, plateau télé, réseaux : tu n'as rien à défendre, autant exister.",
      effets: function () {
        var G = G_(), out = [];
        if (G && G.rep) {
          G.rep.medias = clamp((G.rep.medias || 0) + 3, 0, 100);
          if (fn("recomputeGlobalRep")) { try { window.recomputeGlobalRep(); } catch (e) {} }
          out.push({ txt: "Réputation médias +3", ton: "pos" });
        }
        var dc = changeCredibilite(2, "Présence médiatique");
        out.push({ txt: "Crédibilité +" + dc, ton: "pos" });
        if (G && typeof G.igFollowers === "number") {
          var g = 400 + Math.floor(Math.random() * 900);
          G.igFollowers += g;
          out.push({ txt: "+" + g.toLocaleString("fr-FR") + " abonnés", ton: "pos" });
        }
        return out;
      },
      message: "Tu as enchaîné les plateaux. Un journaliste t'a demandé si tu te sentais prêt à remplacer au pied levé. Tu as souri : « À chaque instant. »"
    },
    {
      id: "ingenieurs", titre: "Débrief avec les ingénieurs",
      desc: "Tu épluches les données du matin avec le staff technique. Ingrat, mais on s'en souvient.",
      effets: function () {
        var G = G_(), out = [];
        if (fn("changeTrust")) { try { window.changeTrust(4, "Travail technique (réserve)", "↑"); } catch (e) {} }
        out.push({ txt: "Confiance de l'écurie +4", ton: "pos" });
        var dc = changeCredibilite(3, "Débrief technique");
        out.push({ txt: "Crédibilité +" + dc, ton: "pos" });
        if (G && G.substats && typeof G.substats.technical === "number") {
          G.substats.technical = Math.min(99, G.substats.technical + 1);
          if (fn("computeLegacyStats")) { try { window.computeLegacyStats(); } catch (e) {} }
          out.push({ txt: "Compréhension technique +1", ton: "pos" });
        }
        return out;
      },
      message: "Personne ne te verra à la télévision pour ça. Mais le directeur technique sait maintenant que tu lis une trace de télémétrie aussi bien que ses titulaires."
    },
    {
      id: "repos", titre: "Couper complètement",
      desc: "Tu rentres à l'hôtel. Une saison de réserviste, c'est long, et l'attente use.",
      effets: function () {
        var G = G_(), out = [];
        if (G && typeof G.happiness === "number") {
          G.happiness = clamp(G.happiness + 5, 0, 100);
          out.push({ txt: "Bonheur +5", ton: "pos" });
        }
        if (fn("changeMental")) { try { window.changeMental(2, "Coupure (réserve)"); } catch (e) {} }
        out.push({ txt: "Moral +2", ton: "pos" });
        out.push({ txt: "Aucun gain de crédibilité", ton: "neutre" });
        return out;
      },
      message: "Tu as regardé la course d'un œil, depuis ta chambre. Ça n'a impressionné personne, mais tu en avais besoin."
    }
  ];

  /* ==================================================================
   * 7. DÉROULÉ DU WEEK-END DE RÉSERVISTE
   * ================================================================== */

  function traiterAction(action, arg) {
    if (action === "programme") {
      var p = PROGRAMMES[parseInt(arg, 10)] || PROGRAMMES[0];
      jouerSeance(p);
      rendreEcran();
      return;
    }
    if (action === "vers-veille") {
      WE.etape = "veille";
      rendreEcran();
      return;
    }
    if (action === "occupation") {
      var o = OCCUPATIONS[parseInt(arg, 10)] || OCCUPATIONS[0];
      terminerVeille(o);
      rendreEcran();
      return;
    }
    if (action === "fin-weekend") {
      cloreWeekEnd();
      return;
    }
  }

  function jouerSeance(prog) {
    var d = RD(); if (!d || !WE) return;
    var res = calculerEcart(prog);
    var v = verdictSeance(res.ecart, res.incident);
    var effets = appliquerEffetsSeance(v, prog);

    WE.delta = res.ecart;
    WE.verdict = v;
    WE.effets = effets;
    WE.refNom = res.ref ? res.ref.name : "le titulaire";
    WE.etape = "resultat";

    d.sessions = d.sessions || [];
    d.sessions.push({
      saison: saison(), week: semaine(), circuit: WE.circuit,
      delta: res.ecart, verdict: v.label, cle: v.cle,
      ref: WE.refNom, programme: prog.id
    });

    if (fn("updateUI")) { try { window.updateUI(); } catch (e) {} }
  }

  function terminerVeille(occ) {
    var d = RD(); if (!d || !WE) return;
    /* La course des IA a déjà été simulée à l'ouverture du week-end. */
    WE.messageOccupation = occ.message;
    try { WE.effetsOccupation = occ.effets() || []; } catch (e) { WE.effetsOccupation = []; }
    WE.etape = "bilan";
    if (fn("updateUI")) { try { window.updateUI(); } catch (e) {} }
  }

  /* Clôture : on marque la course comme disputée (sans résultat joueur) et
     on rend la main au flux normal du jeu. */
  function cloreWeekEnd() {
    var G = G_();
    if (WE && WE.course && !WE.cumul) {
      WE.course.done = true;
      WE.course.result = { reserve: true, pos: null, pts: 0 };
    }
    if (WE && WE.cumul && WE.schedEntry) {
      WE.schedEntry.resolved = true;
    }
    var etaitCumul = WE ? WE.cumul : false;
    WE = null;

    if (G) { G.raceLocked = false; G.racePhase = ""; }
    if (has("RACE_WEEKEND_STATE")) {
      try {
        window.RACE_WEEKEND_STATE.essaisDone = false;
        window.RACE_WEEKEND_STATE.qualifDone = false;
        window.RACE_WEEKEND_STATE.strategyDone = false;
        window.RACE_WEEKEND_STATE.sprintDone = false;
        window.RACE_WEEKEND_STATE.courseDone = false;
      } catch (e) {}
    }

    verifierFinDeSaison();
    if (fn("saveGame")) { try { window.saveGame(); } catch (e) {} }
    if (fn("updateUI")) { try { window.updateUI(); } catch (e) {} }
    if (fn("renderChamp")) { try { window.renderChamp(); } catch (e) {} }
    retourAccueil();
    rafraichirAccueil();
    if (etaitCumul && fn("advanceToNextMoment")) {
      /* rien : on laisse le joueur reprendre la main depuis l'accueil */
    }
  }

  /* Quand le réserviste ne court pas, plus rien ne déclenche la fin de
     saison : on la prononce nous-mêmes une fois le calendrier épuisé. */
  function verifierFinDeSaison() {
    var G = G_(); if (!G || !has("CAL_RACES")) return;
    try {
      var restantes = window.CAL_RACES.filter(function (c) { return !c.done; });
      if (!restantes.length && !G.seasonOver) {
        G.seasonOver = true;
      }
    } catch (e) {}
  }

  /* ------------------------------------------------------------------
   * Ouverture d'un week-end de réserviste (catégorie principale)
   * ---------------------------------------------------------------- */
  function ouvrirWeekEndReserve() {
    var G = G_(), d = RD();
    if (!G || !d) return false;

    var course = fn("getNextRace") ? window.getNextRace() : null;
    var nomCircuit = course ? (course.name || course.circuit || "Grand Prix") : "Grand Prix";

    /* La course a lieu, avec ou sans toi : on la simule pour la grille. */
    var sim = simulerCourseSansJoueur(nomCircuit);

    WE = {
      etape: "seance",
      circuit: nomCircuit,
      course: course,
      cumul: false,
      sim: sim,
      resultatsEcurie: resultatEcurie(sim, d.team)
    };

    ouvrirEcranReserve();
    return true;
  }

  /* ==================================================================
   * 8. INTERCEPTION DU WEEK-END DE COURSE
   *
   * goToRaceWeekend est le point d'entrée unique du week-end (appelé par
   * advanceToNextMoment). On le dévie quand le joueur est réserviste et
   * qu'aucun remplacement n'est prévu pour cette course.
   * ================================================================== */

  var _origGoWeekend = null;

  function installInterceptionWeekEnd() {
    if (!fn("goToRaceWeekend") || window.goToRaceWeekend._rj79) return false;
    _origGoWeekend = window.goToRaceWeekend;
    window.goToRaceWeekend = function () {
      try {
        var G = G_();
        if (G && estReservistePur() && !G._rj79Remplacement) {
          assurerContrat();
          if (ouvrirWeekEndReserve()) return;
        }
        /* Remplacement en cours : on laisse le week-end normal se dérouler. */
      } catch (e) {
        console.warn(TAG, "interception du week-end impossible :", e && e.message);
      }
      return _origGoWeekend.apply(this, arguments);
    };
    window.goToRaceWeekend._rj79 = true;
    return true;
  }

  /* Un joueur peut arriver en N°3 par le module 14 sans passer par nos
     offres : on matérialise alors le contrat à la volée. */
  function assurerContrat() {
    var G = G_(); if (!G) return;
    if (RD()) return;
    if (G._playerRole !== "num3" || !G.currentTeam || G.currentTeam === "Indépendant") return;
    setRD({
      team: G.currentTeam,
      cat: G.cat,
      saison: saison(),
      cumul: false,
      salary: G.revenue || 0,
      credibilite: 35,
      sessions: [],
      remplacements: [],
      issue: null,
      debut: { saison: saison(), week: semaine() }
    });
    console.log(TAG, "contrat de réserve matérialisé chez " + G.currentTeam);
  }

  /* ==================================================================
   * 9. LE REMPLACEMENT
   *
   * Le titulaire est indisponible : le réserviste prend le volant pour un
   * week-end complet et normal. Deux cas :
   *   A. même catégorie que le baquet de réserve principal — rien à
   *      basculer, la course du calendrier se joue simplement.
   *   B. contrat cumulé dans une autre catégorie — il faut basculer tout
   *      le contexte (catégorie, écurie, grille, calendrier, compteurs de
   *      championnat) puis le restaurer à l'identique. C'est le point le
   *      plus sensible du module : tout ce qui est modifié est photographié
   *      avant, et remis après, y compris en cas d'erreur.
   * ================================================================== */

  var _contexteSauvegarde = null;

  function basculerContexte(cat, team, circuit) {
    var G = G_(); if (!G) return false;
    if (_contexteSauvegarde) return false;         // jamais deux bascules imbriquées

    _contexteSauvegarde = {
      cat: G.cat, currentTeam: G.currentTeam, seasonTeam: G._seasonTeam,
      totalLaps: G.totalLaps, role: G._playerRole,
      champPts: G.champPts, races: G.races ? G.races.slice() : [],
      rivals: G.rivals, calRaces: has("CAL_RACES") ? window.CAL_RACES : null,
      raceState: has("RACE_STATE") && window.RACE_STATE ? {
        circuit: window.RACE_STATE.circuit, circuitData: window.RACE_STATE.circuitData,
        weather: window.RACE_STATE.weather
      } : null
    };

    try {
      G.cat = cat;
      G.currentTeam = team;
      G._seasonTeam = team;
      G._playerRole = "num2";                      // le temps du week-end, il EST titulaire
      if (fn("getCatLaps")) { try { G.totalLaps = window.getCatLaps(cat); } catch (e) {} }
      if (fn("initRivals")) { try { window.initRivals(); } catch (e) {} }

      /* Calendrier réduit à la seule épreuve du remplacement. */
      if (has("CAL_RACES")) {
        window.CAL_RACES = [{
          week: semaine(), name: circuit || "Grand Prix", done: false, result: null, _rj79: true
        }];
      }
      G.champPts = 0;
      G.races = [];
      return true;
    } catch (e) {
      console.warn(TAG, "bascule de contexte échouée :", e && e.message);
      restaurerContexte();
      return false;
    }
  }

  function restaurerContexte() {
    var G = G_(), c = _contexteSauvegarde;
    if (!G || !c) return;
    try {
      G.cat = c.cat;
      G.currentTeam = c.currentTeam;
      G._seasonTeam = c.seasonTeam;
      G.totalLaps = c.totalLaps;
      G._playerRole = c.role;
      G.champPts = c.champPts;
      G.races = c.races;
      G.rivals = c.rivals;
      if (c.calRaces && has("CAL_RACES")) window.CAL_RACES = c.calRaces;
      if (c.raceState && has("RACE_STATE") && window.RACE_STATE) {
        window.RACE_STATE.circuit = c.raceState.circuit;
        window.RACE_STATE.circuitData = c.raceState.circuitData;
        window.RACE_STATE.weather = c.raceState.weather;
      }
    } catch (e) {
      console.warn(TAG, "restauration du contexte échouée :", e && e.message);
    }
    _contexteSauvegarde = null;
  }

  var CAUSES_REMPLACEMENT = [
    { id: "maladie",   texte: "est cloué au lit par une infection ; le staff médical l'a déclaré inapte samedi matin" },
    { id: "blessure",  texte: "s'est blessé au dos lors d'un entraînement ; les médecins l'ont interdit de volant" },
    { id: "sanction",  texte: "est suspendu pour cette épreuve après son accrochage de la dernière course" },
    { id: "familial",  texte: "a dû rentrer d'urgence pour raisons familiales" },
    { id: "rupture",   texte: "a claqué la porte cette semaine ; l'écurie se retrouve sans pilote du jour au lendemain" }
  ];

  /* Programme un remplacement pour la prochaine course. */
  function declencherRemplacement(cause, titulaire) {
    var G = G_(), d = RD(); if (!G || !d) return false;
    var c = cause || CAUSES_REMPLACEMENT[Math.floor(Math.random() * CAUSES_REMPLACEMENT.length)];
    var qui = titulaire || titulaireReference(d.team);
    var nom = qui ? qui.name : "Le titulaire";

    G._rj79Remplacement = {
      cause: c.id,
      causeTexte: c.texte,
      titulaire: nom,
      team: d.team,
      cat: d.cat,
      cumul: !!d.cumul,
      semaine: semaine(),
      saison: saison()
    };
    d.meta = d.meta || {};
    d.meta.dernierRemplacement = saison() + ":" + semaine();

    if (qui) qui._rj79Gele = true;                 // il ne prend pas le départ

    if (fn("pushMail")) {
      try {
        window.pushMail({
          from: "Direction sportive — " + d.team,
          role: "team_boss",
          subject: "Tu prends le volant ce week-end",
          body: nom + " " + c.texte + ". Nous n'avons personne d'autre : c'est toi qui pilotes la " +
                d.team + " ce week-end.\n\nOn ne te demande pas de miracle. On te demande de ramener la voiture, " +
                "de rester propre, et de montrer ce que tu vaux quand ça compte. Tout le paddock va regarder ton nom.",
          actions: [{ label: "Je serai prêt", kind: "dismiss", responseBody: "Je ne vais pas laisser passer ça. Merci de la confiance." }]
        });
      } catch (e) {}
    }
    if (fn("_addFeedPost") && has("SOCIAL_PRESS_ACCOUNTS")) {
      try {
        var acc = window.SOCIAL_PRESS_ACCOUNTS[Math.floor(Math.random() * window.SOCIAL_PRESS_ACCOUNTS.length)];
        window._addFeedPost({
          type: "press", author: acc.name, handle: acc.handle, color: acc.color,
          body: "OFFICIEL : " + nom + " forfait. " + d.team + " confirme " + nomPilote() +
                " au volant ce week-end. Premier départ pour le pilote de réserve."
        });
      } catch (e) {}
    }
    return true;
  }

  /* Appelé juste avant le week-end : met en place le contexte si besoin. */
  function preparerRemplacement() {
    var G = G_(), r = G && G._rj79Remplacement;
    if (!r || r.prepare) return;
    r.prepare = true;
    if (r.cumul) {
      var circuit = r.circuit || "Grand Prix";
      basculerContexte(r.cat, r.team, circuit);
    }
  }

  /* Appelé après la course via RACE_POST_HOOKS. */
  function conclureRemplacement(info) {
    var G = G_(), d = RD();
    var r = G && G._rj79Remplacement;
    if (!r || !d) return;

    var pos = info && typeof info.pos === "number" ? info.pos : null;
    var dnf = !!(info && info.isDnf);

    d.remplacements = d.remplacements || [];
    var circuit = r.circuit;
    if (!circuit && has("RACE_STATE") && window.RACE_STATE) circuit = window.RACE_STATE.circuit;
    if (!circuit) circuit = "Grand Prix";

    d.remplacements.push({
      saison: r.saison, week: r.semaine, circuit: circuit,
      cat: r.cat, team: r.team, pos: dnf ? 0 : pos, cause: libelleCause(r.cause)
    });

    /* Un remplacement pèse bien plus lourd qu'une séance d'essais. */
    var gain = 0, msg = "";
    if (dnf)            { gain = -10; msg = "Abandon pour ta première course avec eux."; }
    else if (pos === 1) { gain = 45;  msg = "Une victoire. En remplacement. Le paddock ne parle plus que de toi."; }
    else if (pos <= 3)  { gain = 34;  msg = "Un podium au pied levé : personne ne pourra dire que tu n'étais pas prêt."; }
    else if (pos <= 6)  { gain = 24;  msg = "Dans les points, largement. Le message est passé."; }
    else if (pos <= 10) { gain = 15;  msg = "Des points pour ta première. C'est le minimum attendu, tu l'as fait."; }
    else if (pos <= 14) { gain = 2;   msg = "Course discrète. Ni faute, ni éclat."; }
    else                { gain = -6;  msg = "Un week-end à oublier. Les places de titulaire ne se gagnent pas comme ça."; }

    changeCredibilite(gain, "Remplacement — " + (dnf ? "abandon" : "P" + pos));
    if (fn("changeTrust")) {
      try { window.changeTrust(Math.round(gain / 3), "Remplacement en course", gain > 0 ? "↑" : "↓"); } catch (e) {}
    }
    if (G && G.rep && gain > 15) {
      G.rep.paddock = clamp((G.rep.paddock || 0) + 6, 0, 100);
      G.rep.medias = clamp((G.rep.medias || 0) + 4, 0, 100);
      if (fn("recomputeGlobalRep")) { try { window.recomputeGlobalRep(); } catch (e) {} }
    }

    if (fn("pushMail")) {
      try {
        window.pushMail({
          from: "Direction sportive — " + r.team,
          role: "team_boss",
          subject: "Après ton week-end",
          body: msg + "\n\n" + (gain >= 24
            ? "On va reparler de ton avenir très vite. Ne signe rien ailleurs sans nous en parler."
            : gain >= 0
              ? "Merci pour le travail accompli. On garde ça en tête."
              : "On savait que l'exercice était difficile. Il faudra faire mieux à la prochaine occasion."),
          actions: [{ label: "Compris", kind: "dismiss", responseBody: "Merci pour l'opportunité." }]
        });
      } catch (e) {}
    }

    /* Le titulaire revient. */
    try {
      if (G && G.rivals) G.rivals.forEach(function (x) { if (x && x._rj79Gele) delete x._rj79Gele; });
    } catch (e) {}

    if (r.cumul) restaurerContexte();
    G._rj79Remplacement = null;

    /* Un remplacement réussi peut débloquer une promotion immédiate. */
    if (gain >= 30) evaluerPromotion(true);
  }

  function libelleCause(id) {
    var m = {
      maladie: "Titulaire malade", blessure: "Titulaire blessé",
      sanction: "Titulaire suspendu", familial: "Titulaire absent",
      rupture: "Rupture de contrat du titulaire", baquet: "Baquet vacant"
    };
    return m[id] || "Remplacement";
  }

  /* ==================================================================
   * 10. BAQUETS QUI SE LIBÈRENT EN COURS DE SAISON
   *
   * Rien de tel n'existait : les grilles ne bougeaient qu'entre deux
   * saisons (04o-driver-pool). On ouvre donc des baquets pendant la saison.
   *
   * Règle demandée : plus un pilote est titré et populaire, moins son
   * écurie s'en sépare. La fonction stature() pondère titres, victoires,
   * niveau et ancienneté ; un champion doit s'effondrer très longtemps
   * avant d'être remercié, un pilote sans palmarès saute vite.
   * ================================================================== */

  var CAUSES_LIBERATION = [
    { id: "resultats", poids: 42, sportive: true,
      titre: "écarté pour résultats insuffisants",
      presse: "Fin de l'aventure : {pilote} est écarté par {team}. La série de contre-performances a eu raison de sa place." },
    { id: "blessure", poids: 20,
      titre: "forfait longue durée",
      presse: "{pilote} déclaré forfait pour plusieurs mois. {team} doit trouver une solution rapidement." },
    { id: "rupture", poids: 20,
      titre: "rupture de contrat",
      presse: "Clash chez {team} : {pilote} quitte l'écurie avec effet immédiat." },
    { id: "retraite", poids: 18,
      titre: "retraite anticipée",
      presse: "{pilote} annonce l'arrêt de sa carrière avec effet immédiat. {team} se retrouve sans pilote." }
  ];

  function tirerCause(pilote) {
    var forme = formeRecente(pilote, 5);
    var pool = CAUSES_LIBERATION.filter(function (c) {
      if (c.id === "resultats") return !!(forme && forme.moyenne >= 12);
      if (c.id === "retraite") return (pilote.age || 26) >= 33;
      return true;
    }).map(function (c) {
      /* Plus la série est noire, plus la cause sportive s'impose : une
         écurie qui se sépare d'un pilote en pleine débâcle ne prétexte pas
         une blessure. */
      if (c.id === "resultats" && forme) {
        var p = c.poids;
        if (forme.moyenne >= 15) p = 105;
        else if (forme.moyenne >= 13) p = 72;
        return { id: c.id, poids: p, titre: c.titre, presse: c.presse, sportive: true };
      }
      return c;
    });
    var total = pool.reduce(function (s, c) { return s + c.poids; }, 0);
    var t = Math.random() * total;
    for (var i = 0; i < pool.length; i++) { t -= pool[i].poids; if (t <= 0) return pool[i]; }
    return pool[0] || CAUSES_LIBERATION[1];
  }

  /* Probabilité qu'un pilote donné perde son baquet cette semaine. */
  function risqueDePerdreSonBaquet(pilote) {
    var st = stature(pilote);
    var forme = formeRecente(pilote, 5);
    var base = 0.004;                                   // bruit de fond très faible

    if (forme) {
      /* Une série noire est le premier moteur : moyenne >= 14 = catastrophe */
      if (forme.moyenne >= 15) base += 0.055;
      else if (forme.moyenne >= 12) base += 0.030;
      else if (forme.moyenne >= 10) base += 0.012;
      base += forme.dnf * 0.008;
    }
    if ((pilote.age || 26) >= 35) base += 0.010;

    /* Protection par la stature — un champion populaire est intouchable ou
       presque, même en méforme. */
    var protection = 1 - (st / 100) * 0.92;             // stature 100 -> 8 % du risque
    return clamp(base * protection, 0, 0.10);
  }

  function ouvrirBaquet(pilote, cause) {
    var G = G_(); if (!G || !pilote) return null;
    pilote._rj79Gele = true;
    pilote._rj79Sorti = { cause: cause.id, saison: saison(), week: semaine() };

    var seat = {
      team: pilote.team, cat: G.cat, pilote: pilote.name,
      cause: cause.id, causeTitre: cause.titre,
      saison: saison(), week: semaine(), comble: false
    };
    seatsLibres().push(seat);

    if (fn("_addFeedPost") && has("SOCIAL_PRESS_ACCOUNTS")) {
      try {
        var acc = window.SOCIAL_PRESS_ACCOUNTS[Math.floor(Math.random() * window.SOCIAL_PRESS_ACCOUNTS.length)];
        window._addFeedPost({
          type: "press", author: acc.name, handle: acc.handle, color: acc.color,
          body: cause.presse.replace("{pilote}", pilote.name).replace("{team}", pilote.team || "son écurie")
        });
      } catch (e) {}
    }
    return seat;
  }

  /* Un baquet libre déclenche soit un remplacement ponctuel (si c'est
     l'écurie du réserviste), soit une offre venue d'ailleurs. */
  function traiterBaquetLibre(seat) {
    var G = G_(), d = RD();
    if (!G || !seat || seat.comble) return;

    var cred = credibilite();

    /* Cas 1 — c'est l'écurie du réserviste : il prend le volant. */
    if (d && seat.team === d.team) {
      seat.comble = true;
      declencherRemplacement({ id: "baquet", texte: "ne fait plus partie de l'effectif" },
        { name: seat.pilote });
      /* Baquet vacant durablement : la porte est grande ouverte. */
      if (seat.cause === "rupture" || seat.cause === "retraite" || seat.cause === "resultats") {
        G._rj79SiegeVacant = { team: seat.team, cat: seat.cat, depuis: semaine() };
      }
      return;
    }

    /* Cas 2 — une autre écurie cherche un pilote. Il faut être crédible. */
    var seuil = 45;
    if (!d) seuil = 62;                                 // sans contrat de réserve, il faut plus
    if (cred < seuil && !(G.reputation >= 70)) return;

    seat.comble = true;
    proposerBaquetLibre(seat);
  }

  function proposerBaquetLibre(seat) {
    var G = G_(); if (!G) return;
    var offre = construireOffreBaquet(seat);
    if (!offre) return;

    G.offers = G.offers || [];
    G.offers.push(offre);
    G._rj79OffresEnCours = G._rj79OffresEnCours || [];
    G._rj79OffresEnCours.push({ team: seat.team, cat: seat.cat, immediate: true, week: semaine() });

    if (fn("pushMail")) {
      try {
        window.pushMail({
          from: "Ton agent",
          role: "agent",
          subject: "Un baquet vient de se libérer chez " + seat.team,
          body: seat.pilote + " " + seat.causeTitre + ". " + seat.team +
                " cherche un pilote pour finir la saison, et ton nom est sorti.\n\n" +
                "C'est une place de titulaire, tout de suite, pas la saison prochaine. " +
                "L'offre est dans tes contrats — elle ne restera pas ouverte longtemps.",
          actions: [{ label: "Voir l'offre", kind: "dismiss", responseBody: "J'y vais tout de suite." }]
        });
      } catch (e) {}
    }
    var dot = document.getElementById("ni-more-dot");
    if (dot) dot.style.display = "block";
  }

  function construireOffreBaquet(seat) {
    var G = G_(); if (!G) return null;
    var base = null;
    try {
      if (has("TEAM_OFFERS") && window.TEAM_OFFERS[seat.cat]) {
        base = window.TEAM_OFFERS[seat.cat].find(function (t) { return t.team === seat.team; });
      }
    } catch (e) {}

    var salaire = base && base.salary ? base.salary : 8000;
    var offre = {
      team: seat.team, cat: seat.cat,
      salary: Math.round(salaire * 0.85),               // signature d'urgence, en dessous du marché
      cost: 0,
      bonusWin: base ? base.bonusWin : 0,
      bonusPodium: base ? base.bonusPodium : 0,
      duration: 1, dur: 1,
      role: "num2",
      expire: 4,
      _rj79Immediate: true,
      _rj79Seat: seat
    };
    if (fn("buildOffer")) {
      try {
        var o = window.buildOffer({
          team: seat.team, cat: seat.cat, cost: 0, salary: offre.salary,
          bonusWin: offre.bonusWin, bonusPodium: offre.bonusPodium,
          duration: 1, expire: 4, role: "num2"
        });
        if (o) { o._rj79Immediate = true; o._rj79Seat = seat; return o; }
      } catch (e) {}
    }
    return offre;
  }

  /* Balayage hebdomadaire de la grille. */
  function balayerGrille() {
    var G = G_();
    if (!G || !G.rivals || !G.rivals.length) return;
    if (!catAdmetReserve(G.cat) && !aContratReserve()) return;
    if (G.seasonOver) return;

    /* Deux baquets libérés par saison au maximum : l'événement doit rester
       exceptionnel, sinon la grille devient une passoire. */
    var dejaCetteSaison = seatsLibres().filter(function (s) { return s.saison === saison(); }).length;
    if (dejaCetteSaison >= 2) return;

    for (var i = 0; i < G.rivals.length; i++) {
      var p = G.rivals[i];
      if (!p || p._rj79Gele || p._rj79Sorti || !p.team) continue;
      if (Math.random() < risqueDePerdreSonBaquet(p)) {
        var cause = tirerCause(p);
        var seat = ouvrirBaquet(p, cause);
        if (seat) traiterBaquetLibre(seat);
        return;                                          // un seul par semaine
      }
    }
  }

  /* ==================================================================
   * 11. OFFRES DE RÉSERVE ET SIGNATURES
   *
   * Deux chemins distincts passent par signContract :
   *   - une offre de RÉSERVE (role num3) : si la catégorie diffère de celle
   *     du joueur, on crée un contrat parallèle sans toucher à G.cat ;
   *   - une offre de baquet libéré (_rj79Immediate) : elle prend effet tout
   *     de suite, pas à la saison suivante.
   * ================================================================== */

  var _origSign = null;

  function installSignature() {
    if (!fn("signContract") || window.signContract._rj79) return false;
    _origSign = window.signContract;
    window.signContract = function (idx) {
      var G = G_();
      var offre = G && G.offers ? G.offers[idx] : null;

      if (offre && offre._rj79Immediate) {
        return signerBaquetImmediat(idx, offre);
      }
      if (offre && offre.role === "num3") {
        return signerReserve(idx, offre);
      }
      return _origSign.apply(this, arguments);
    };
    window.signContract._rj79 = true;
    return true;
  }

  function signerReserve(idx, offre) {
    var G = G_(); if (!G) return;
    var cumul = (offre.cat !== G.cat);

    setRD({
      team: offre.team,
      cat: offre.cat,
      saison: saison() + (cumul ? 0 : 1),      // un contrat parallèle démarre tout de suite
      cumul: cumul,
      salary: offre.salary || 0,
      credibilite: 35,
      sessions: [],
      remplacements: [],
      issue: null,
      debut: { saison: saison(), week: semaine() }
    });

    if (cumul) {
      G.revenue = (G.revenue || 0) + (offre.salary || 0);
      planifierSeancesCumul();
      if (fn("showFb")) {
        try {
          window.showFb("cont-fb", "ok", "Engagement de réserve signé",
            "Tu es pilote de réserve " + offre.team + " en " + offre.cat +
            ", en parallèle de ton baquet " + G.cat + ".");
        } catch (e) {}
      }
    } else {
      /* Réserve dans sa propre catégorie : transfert classique, le rôle
         sera posé au changement de saison par le moteur. */
      G.pendingTransfer = {
        team: offre.team, cat: offre.cat, salary: offre.salary || 0,
        bonus: offre.bonusWin || 0, podiumBonus: offre.bonusPodium || 0,
        dur: offre.duration || offre.dur || 1, role: "num3"
      };
      if (fn("showFb")) {
        try {
          window.showFb("cont-fb", "ok", "Baquet de réserve signé",
            "Tu rejoins " + offre.team + " comme pilote de réserve la saison prochaine.");
        } catch (e) {}
      }
    }

    G.offers = G.offers.filter(function (o, i) { return i !== idx; });
    if (fn("recordDecision")) {
      try {
        window.recordDecision("contract", "Engagement de réserve chez " + offre.team,
          offre.cat + " · " + (offre.salary || 0).toLocaleString("fr-FR") + " €/mois", "neutral", [offre.team]);
      } catch (e) {}
    }
    if (fn("updateUI")) { try { window.updateUI(); } catch (e) {} }
    if (fn("renderOffers")) { try { window.renderOffers(); } catch (e) {} }
    if (fn("saveGame")) { try { window.saveGame(); } catch (e) {} }
    rafraichirAccueil();
  }

  /* Signature d'un baquet libéré : effet immédiat, en pleine saison. */
  function signerBaquetImmediat(idx, offre) {
    var G = G_(); if (!G) return;
    var ancienneEcurie = G.currentTeam, ancienneCat = G.cat, ancienRole = G._playerRole;

    /* On solde la saison de réserviste avant de basculer. */
    if (RD()) cloreContratReserve("Baquet titulaire obtenu chez " + offre.team);

    /* Ligne d'historique pour la période écoulée, si le joueur avait couru. */
    archiverSegmentSaison(ancienneEcurie, ancienneCat, ancienRole);

    var changeCat = (offre.cat !== G.cat);
    G.currentTeam = offre.team;
    G._seasonTeam = offre.team;
    G._playerRole = "num2";
    G.contractDur = offre.duration || offre.dur || 1;
    G.contractWeeksLeft = Math.max(0, 48 - semaine()) + 48 * Math.max(0, (offre.duration || 1) - 1);
    G.revenue = offre.salary || G.revenue;
    G._contractExpired = false;
    G._tm_wins_count = 0;
    G._roleUpgradeNotified = false;

    if (changeCat) {
      G.cat = offre.cat;
      if (fn("getCatLaps")) { try { G.totalLaps = window.getCatLaps(offre.cat); } catch (e) {} }
      if (fn("initRivals")) { try { window.initRivals(); } catch (e) {} }
      if (has("CAL_RACES") && fn("buildCalendar")) {
        try {
          window.CAL_RACES = [];
          window.buildCalendar();
          /* Les épreuves déjà passées ne se rejouent pas. */
          window.CAL_RACES.forEach(function (c) { if (c.week < semaine()) c.done = true; });
        } catch (e) {}
      }
      G.champPts = 0;
      G.races = [];
    } else {
      /* Même catégorie : le joueur garde ses points et son historique. */
      var t = G.rivals ? G.rivals.find(function (r) { return r && r.team === offre.team && r._rj79Sorti; }) : null;
      if (t) t._rj79Remplace = true;
    }

    /* Le baquet est pourvu : le pilote sortant ne revient pas. */
    if (offre._rj79Seat) offre._rj79Seat.comble = true;

    G.offers = (G.offers || []).filter(function (o, i) { return i !== idx && !o._rj79Immediate; });

    if (fn("pushMail")) {
      try {
        window.pushMail({
          from: "Direction sportive — " + offre.team,
          role: "team_boss",
          subject: "Bienvenue — tu pilotes dès la prochaine course",
          body: "C'est signé. Tu es notre pilote à partir de la prochaine épreuve, jusqu'à la fin de la saison.\n\n" +
                "Pas de période d'adaptation, pas d'excuses : la voiture est là, l'équipe est là. " +
                "Ce que tu en fais dans les semaines qui viennent décidera de la suite.",
          actions: [{ label: "Prêt", kind: "dismiss", responseBody: "Merci. Je ne vais pas gâcher cette chance." }]
        });
      } catch (e) {}
    }
    if (fn("_addFeedPost") && has("SOCIAL_PRESS_ACCOUNTS")) {
      try {
        var acc = window.SOCIAL_PRESS_ACCOUNTS[Math.floor(Math.random() * window.SOCIAL_PRESS_ACCOUNTS.length)];
        window._addFeedPost({
          type: "press", author: acc.name, handle: acc.handle, color: acc.color,
          body: "OFFICIEL : " + nomPilote() + " rejoint " + offre.team + " avec effet immédiat" +
                (changeCat ? " en " + offre.cat : "") + ". Une promotion en pleine saison, c'est assez rare pour être souligné."
        });
      } catch (e) {}
    }
    if (fn("showFb")) {
      try {
        window.showFb("cont-fb", "ok", "Baquet titulaire signé !",
          "Tu pilotes pour " + offre.team + " dès la prochaine course.");
      } catch (e) {}
    }
    if (has("TEAM_TRUST") && window.TEAM_TRUST) {
      window.TEAM_TRUST.value = 55;
      window.TEAM_TRUST.objectives = [];
      if (fn("generateSeasonObjectives")) { try { window.generateSeasonObjectives(); } catch (e) {} }
    }
    if (fn("updateUI")) { try { window.updateUI(); } catch (e) {} }
    if (fn("renderOffers")) { try { window.renderOffers(); } catch (e) {} }
    if (fn("renderChamp")) { try { window.renderChamp(); } catch (e) {} }
    if (fn("saveGame")) { try { window.saveGame(); } catch (e) {} }
    rafraichirAccueil();
  }

  /* ------------------------------------------------------------------
   * Génération d'offres de réserve au mercato
   * ---------------------------------------------------------------- */
  function genererOffresReserve() {
    var G = G_(); if (!G) return;
    if (aContratReserve()) return;
    if (G.pendingTransfer) return;
    var rep = G.reputation || 0;
    if (rep < 35) return;

    /* Une seule proposition de réserve à la fois. */
    if ((G.offers || []).some(function (o) { return o && o.role === "num3"; })) return;

    var cible = choisirCatReserve();
    if (!cible) return;

    var base = null;
    try {
      var pool = (has("TEAM_OFFERS") && window.TEAM_OFFERS[cible]) ? window.TEAM_OFFERS[cible] : null;
      if (!pool || !pool.length) return;
      /* Les écuries les mieux cotées d'abord : c'est là que la réserve a du sens. */
      var tri = pool.slice().sort(function (a, b) {
        var ra = fn("getEffectiveTeamRating") ? window.getEffectiveTeamRating(a.team) : 70;
        var rb = fn("getEffectiveTeamRating") ? window.getEffectiveTeamRating(b.team) : 70;
        return rb - ra;
      });
      base = tri[Math.floor(Math.random() * Math.min(3, tri.length))];
    } catch (e) {}
    if (!base) return;

    var offre = null;
    if (fn("buildOffer")) {
      try {
        offre = window.buildOffer({
          team: base.team, cat: cible, cost: base.cost, salary: base.salary,
          bonusWin: base.bonusWin, bonusPodium: base.bonusPodium,
          duration: 1, expire: 8, role: "num3"
        });
      } catch (e) {}
    }
    if (!offre) return;
    offre.role = "num3";

    G.offers = G.offers || [];
    G.offers.push(offre);

    if (fn("pushMail")) {
      try {
        var cumul = (cible !== G.cat);
        window.pushMail({
          from: "Ton agent",
          role: "agent",
          subject: base.team + " te veut comme pilote de réserve",
          body: base.team + " cherche un troisième pilote pour " + cible + ".\n\n" +
            (cumul
              ? "Le point important : tu peux garder ton baquet en " + G.cat + ". Tu roules le vendredi pour eux, " +
                "tu restes titulaire chez toi le dimanche. C'est exactement comme ça que les portes s'ouvrent."
              : "Ce n'est pas un baquet de course : tu ne prendras aucun départ, sauf accident de parcours. " +
                "Mais tu seras dans le garage, avec les données, et le premier sur la liste quand une place se libère.") +
            "\n\nÀ toi de voir si tu veux jouer cette carte.",
          actions: [{ label: "Voir l'offre", kind: "dismiss", responseBody: "Je regarde ça." }]
        });
      } catch (e) {}
    }
    var dot = document.getElementById("ni-more-dot");
    if (dot) dot.style.display = "block";
  }

  /* La réserve visée. Ordre de préférence : la catégorie immédiatement
     au-dessus (c'est tout le sens du rôle — mettre un pied dans l'étage
     supérieur), à défaut la catégorie courante. */
  function choisirCatReserve() {
    var G = G_(); if (!G) return null;
    var cats = has("CATEGORIES") ? window.CATEGORIES : null;
    if (cats) {
      var i = cats.indexOf(G.cat);
      if (i >= 0 && i + 1 < cats.length && catAdmetReserve(cats[i + 1])) return cats[i + 1];
    }
    if (catAdmetReserve(G.cat)) return G.cat;
    return null;
  }

  /* ==================================================================
   * 12. SÉANCES DU CONTRAT CUMULÉ
   *
   * Un contrat de réserve dans une autre catégorie n'a pas de calendrier
   * propre : ses échéances s'insèrent comme événements planifiés dans la
   * chronologie du baquet principal (getNextMoment mélange déjà courses et
   * événements). Règle assumée : si une course du baquet principal tombe la
   * même semaine, elle passe avant — comme dans la réalité.
   * ================================================================== */

  var EVT_ID = "rj79_seance";

  function planifierSeancesCumul() {
    var G = G_(), d = RD();
    if (!G || !d || !d.cumul) return;
    G._scheduledEvents = G._scheduledEvents || [];

    /* Semaines occupées par le baquet principal. */
    var occupees = {};
    try {
      (window.CAL_RACES || []).forEach(function (c) { occupees[c.week] = true; });
    } catch (e) {}
    (G._scheduledEvents || []).forEach(function (e) { if (!e.resolved) occupees[e.week] = true; });

    var poses = 0;
    for (var w = semaine() + 2; w <= 46 && poses < 6; w += 6) {
      var cible = w;
      var garde = 0;
      while (occupees[cible] && garde < 5) { cible++; garde++; }
      if (occupees[cible]) continue;
      G._scheduledEvents.push({
        week: cible, eventId: EVT_ID, saison: saison(),
        resolved: false, announced: true, _rj79: true
      });
      occupees[cible] = true;
      poses++;
    }
    d.weeksPlanned = (G._scheduledEvents || [])
      .filter(function (e) { return e.eventId === EVT_ID && !e.resolved; })
      .map(function (e) { return e.week; });
  }

  var _origOpenSched = null;

  function installEvenementsPlanifies() {
    if (!fn("openScheduledEvent") || window.openScheduledEvent._rj79) return false;
    _origOpenSched = window.openScheduledEvent;
    window.openScheduledEvent = function (entry) {
      if (entry && entry.eventId === EVT_ID) {
        ouvrirSeanceCumul(entry);
        return;
      }
      return _origOpenSched.apply(this, arguments);
    };
    window.openScheduledEvent._rj79 = true;
    return true;
  }

  function ouvrirSeanceCumul(entry) {
    var G = G_(), d = RD();
    if (!G || !d) { if (entry) entry.resolved = true; return; }

    var circuit = "Journée d'essais " + d.team;
    try {
      if (has("CIRCUITS") && window.CIRCUITS) {
        var noms = Object.keys(window.CIRCUITS);
        if (noms.length) circuit = noms[Math.floor(Math.random() * noms.length)];
      }
    } catch (e) {}

    WE = {
      etape: "seance",
      circuit: circuit,
      cumul: true,
      schedEntry: entry,
      course: null,
      sim: null,
      resultatsEcurie: []
    };
    ouvrirEcranReserve();
  }

  /* ==================================================================
   * 13. PROMOTION, PROLONGATION, SORTIE
   * ================================================================== */

  function evaluerPromotion(immediate) {
    var G = G_(), d = RD();
    if (!G || !d || d.issue) return false;
    var cred = credibilite();
    var trust = (has("TEAM_TRUST") && window.TEAM_TRUST) ? (window.TEAM_TRUST.value || 0) : 50;
    var vacant = G._rj79SiegeVacant && G._rj79SiegeVacant.team === d.team;

    var seuilCred = immediate ? 68 : 62;
    if (cred < seuilCred && !(vacant && cred >= 50)) return false;
    if (trust < 45 && !vacant) return false;

    promouvoirTitulaire(vacant);
    return true;
  }

  function promouvoirTitulaire(vacant) {
    var G = G_(), d = RD(); if (!G || !d) return;

    if (d.cumul) {
      /* Contrat parallèle : la promotion est un vrai transfert, effectif la
         saison prochaine (ou tout de suite si un baquet est vacant). */
      if (vacant) {
        var seat = { team: d.team, cat: d.cat, pilote: "", cause: "promotion", causeTitre: "promotion interne" };
        var offre = construireOffreBaquet(seat);
        if (offre) {
          offre._rj79Immediate = true;
          G.offers = G.offers || [];
          G.offers.push(offre);
        }
      } else {
        G.pendingTransfer = {
          team: d.team, cat: d.cat, salary: Math.round((d.salary || 4000) * 2.4),
          bonus: 0, podiumBonus: 0, dur: 2, role: "num2"
        };
      }
    } else {
      G._playerRole = "num2";
      G.revenue = Math.round((G.revenue || 3000) * 2.2);
      G.contractDur = Math.max(G.contractDur || 0, 1);
    }

    d.issue = "promu";
    d.issueSaison = saison();

    if (fn("pushMail")) {
      try {
        window.pushMail({
          from: "Direction sportive — " + d.team,
          role: "team_boss",
          subject: "Tu passes titulaire",
          body: "Décision prise ce matin : tu es notre pilote " + (d.cumul ? "" : "titulaire ") +
                "pour la suite.\n\nTu as fait ce qu'on attendait d'un réserviste, et tu l'as fait sans jamais " +
                "avoir la certitude que ça servirait à quelque chose. C'est précisément pour ça qu'on te choisit.",
          actions: [{ label: "Merci", kind: "dismiss", responseBody: "Je ne vous décevrai pas." }]
        });
      } catch (e) {}
    }
    if (fn("_addFeedPost") && has("SOCIAL_PRESS_ACCOUNTS")) {
      try {
        var acc = window.SOCIAL_PRESS_ACCOUNTS[Math.floor(Math.random() * window.SOCIAL_PRESS_ACCOUNTS.length)];
        window._addFeedPost({
          type: "press", author: acc.name, handle: acc.handle, color: acc.color,
          body: "OFFICIEL : " + nomPilote() + " promu pilote titulaire chez " + d.team +
                ". La patience du réserviste a payé."
        });
      } catch (e) {}
    }
    if (fn("updateUI")) { try { window.updateUI(); } catch (e) {} }
    rafraichirAccueil();
  }

  /* Clôture du contrat de réserve : archive puis efface. */
  function cloreContratReserve(issue) {
    var d = RD(); if (!d) return;
    d.issue = d.issue || issue || "terminé";
    histReserve().push({
      saison: d.saison, cat: d.cat, team: d.team, cumul: !!d.cumul,
      seances: (d.sessions || []).length,
      ecartMoyen: moyenneEcart(),
      remplacements: (d.remplacements || []).map(function (r) {
        return { circuit: r.circuit, pos: r.pos, cat: r.cat, cause: r.cause };
      }),
      credibilite: d.credibilite,
      issue: d.issue
    });
    setRD(null);
  }

  /* Fin de saison : promotion, prolongation ou sortie. */
  function bilanFinDeSaison() {
    var G = G_(), d = RD();
    if (!G || !d) return;
    if (d.saison > saison()) return;                     // contrat pas encore commencé

    if (evaluerPromotion(false)) { cloreContratReserve("promu"); return; }

    var cred = credibilite();
    if (cred >= 40) {
      /* Prolongation d'un an, avec avertissement. */
      d.saison = saison() + 1;
      d.sessions = [];
      d.remplacements = [];
      d.prolonge = (d.prolonge || 0) + 1;
      if (fn("pushMail")) {
        try {
          window.pushMail({
            from: "Direction sportive — " + d.team, role: "team_boss",
            subject: "On te garde une saison de plus",
            body: "Tu restes notre pilote de réserve la saison prochaine. C'est une marque de confiance, " +
                  "mais sois lucide : un réserviste qu'on prolonge deux fois devient un réserviste tout court. " +
                  "Il te faut un coup d'éclat.",
            actions: [{ label: "Compris", kind: "dismiss", responseBody: "Je sais ce qu'il me reste à faire." }]
          });
        } catch (e) {}
      }
      if (d.prolonge >= 2 && cred < 55) chercherSortieLaterale();
    } else {
      /* Fin de l'aventure. */
      if (fn("pushMail")) {
        try {
          window.pushMail({
            from: "Direction sportive — " + d.team, role: "team_boss",
            subject: "Fin de collaboration",
            body: "Nous ne prolongeons pas ton engagement de réserviste. Tu n'as pas démérité, " +
                  "mais nous avons besoin d'un profil différent pour la saison à venir.\n\n" +
                  "Ton agent a déjà commencé à prospecter.",
            actions: [{ label: "Compris", kind: "dismiss", responseBody: "Merci pour cette saison." }]
          });
        } catch (e) {}
      }
      cloreContratReserve("non conservé");
      if (fn("generateRecoveryOffers")) { try { window.generateRecoveryOffers(); } catch (e) {} }
    }
  }

  /* Une écurie plus modeste vient chercher le réserviste qui stagne. */
  function chercherSortieLaterale() {
    var G = G_(), d = RD(); if (!G || !d) return;
    try {
      var pool = (has("TEAM_OFFERS") && window.TEAM_OFFERS[d.cat]) ? window.TEAM_OFFERS[d.cat] : null;
      if (!pool || !pool.length) return;
      var tri = pool.slice().sort(function (a, b) {
        var ra = fn("getEffectiveTeamRating") ? window.getEffectiveTeamRating(a.team) : 70;
        var rb = fn("getEffectiveTeamRating") ? window.getEffectiveTeamRating(b.team) : 70;
        return ra - rb;
      });
      var base = tri[0];
      if (!base || base.team === d.team) base = tri[1];
      if (!base) return;
      var offre = fn("buildOffer") ? window.buildOffer({
        team: base.team, cat: d.cat, cost: base.cost, salary: base.salary,
        bonusWin: base.bonusWin, bonusPodium: base.bonusPodium,
        duration: 2, expire: 8, role: "num2"
      }) : null;
      if (!offre) return;
      G.offers = G.offers || [];
      G.offers.push(offre);
      if (fn("pushMail")) {
        window.pushMail({
          from: "Ton agent", role: "agent",
          subject: base.team + " t'offre un vrai baquet",
          body: "Tu peux rester réserviste chez " + d.team + " et espérer, ou aller courir chez " + base.team +
                ".\n\nCe n'est pas la voiture de tes rêves. Mais on gagne rarement un baquet en regardant les autres rouler.",
          actions: [{ label: "Voir l'offre", kind: "dismiss", responseBody: "Je regarde." }]
        });
      }
    } catch (e) {}
  }

  /* ==================================================================
   * 14. HISTORIQUE DE CARRIÈRE ET PALMARÈS
   *
   * CAREER_HISTORY alimente des totaux (courses, victoires, podiums) : on
   * n'y insère aucune ligne fictive, sinon les statistiques de carrière
   * seraient faussées. On se contente de marquer le rôle sur la saison, et
   * on tient un historique de réserve à part, affiché sous le palmarès.
   * ================================================================== */

  var _origSaveSeason = null, _origPalmares = null;

  function installHistorique() {
    if (fn("saveSeasonToHistory") && !window.saveSeasonToHistory._rj79) {
      _origSaveSeason = window.saveSeasonToHistory;
      window.saveSeasonToHistory = function () {
        var etaitReserviste = estReservistePur();
        var d = RD();
        var r = _origSaveSeason.apply(this, arguments);
        try {
          if (has("CAREER_HISTORY") && window.CAREER_HISTORY.length) {
            var last = window.CAREER_HISTORY[window.CAREER_HISTORY.length - 1];
            if (etaitReserviste) {
              last.role = "num3";
              last.reserve = true;
              last.pos = null;                     // pas de classement : il n'a pas couru
              last.seances = d ? (d.sessions || []).length : 0;
              last.remplacements = d ? (d.remplacements || []).length : 0;
            } else if (d && d.cumul) {
              last.reserveSecondaire = { team: d.team, cat: d.cat };
            }
          }
        } catch (e) { console.warn(TAG, "marquage de l'historique :", e && e.message); }
        return r;
      };
      window.saveSeasonToHistory._rj79 = true;
    }

    if (fn("renderPalmares") && !window.renderPalmares._rj79) {
      _origPalmares = window.renderPalmares;
      window.renderPalmares = function () {
        var r = _origPalmares.apply(this, arguments);
        try { injecterPalmaresReserve(); } catch (e) {}
        return r;
      };
      window.renderPalmares._rj79 = true;
    }
  }

  function injecterPalmaresReserve() {
    var host = document.getElementById("palmares-content");
    if (!host) return;
    var anciens = document.getElementById("rj79-palmares");
    if (anciens && anciens.parentNode) anciens.parentNode.removeChild(anciens);

    var lignes = histReserve().slice();
    var d = RD();
    if (d) {
      lignes.push({
        saison: d.saison, cat: d.cat, team: d.team, cumul: !!d.cumul,
        seances: (d.sessions || []).length, ecartMoyen: moyenneEcart(),
        remplacements: (d.remplacements || []).map(function (x) { return { circuit: x.circuit, pos: x.pos }; }),
        credibilite: d.credibilite, issue: null, encours: true
      });
    }
    if (!lignes.length) return;

    injecterCSS();
    var wrap = document.createElement("div");
    wrap.id = "rj79-palmares";

    var h = '<div class="t-sec">Engagements de réserve</div>';
    h += '<div class="rj79-card" style="margin:0 14px 12px">';
    lignes.forEach(function (l) {
      var titre = "Saison " + l.saison + " \u00b7 " + l.team;
      var det = [];
      det.push(l.cat + (l.cumul ? " (en parallèle)" : ""));
      det.push(l.seances + " séance" + (l.seances > 1 ? "s" : ""));
      if (typeof l.ecartMoyen === "number") det.push("écart moyen " + fmtEcart(l.ecartMoyen));
      if (l.remplacements && l.remplacements.length) {
        var best = null;
        l.remplacements.forEach(function (r) { if (r.pos && (!best || r.pos < best)) best = r.pos; });
        det.push(l.remplacements.length + " remplacement" + (l.remplacements.length > 1 ? "s" : "") +
          (best ? " (meilleur : P" + best + ")" : ""));
      }
      var issue = l.encours ? "En cours" : (l.issue || "terminé");
      var coul = l.issue === "promu" ? GREEN : (l.encours ? CYAN : "var(--muted)");
      h += ligneProtegee(titre, det.join(" \u00b7 "),
        '<span class="rj79-tag" style="color:' + coul + ';border:1px solid ' + coul + '55;background:' + coul + '18">' +
        esc(issue) + '</span>', coul);
    });
    h += '</div>';
    wrap.innerHTML = h;
    host.appendChild(wrap);
  }

  /* Archive un segment de saison quand le joueur change d'écurie en cours
     de route : sans ça, la saison n'aurait qu'une seule ligne, celle de la
     dernière écurie. */
  function archiverSegmentSaison(team, cat, role) {
    var G = G_(); if (!G || !team || team === "Indépendant") return;
    if (!G.races || !G.races.length) return;
    G._reserveSegments = G._reserveSegments || [];
    G._reserveSegments.push({
      saison: saison(), team: team, cat: cat, role: role || "num2",
      courses: G.races.length, pts: G.champPts || 0, jusquA: semaine()
    });
  }

  /* ==================================================================
   * 15. OBJECTIFS DE SAISON DU RÉSERVISTE
   *
   * Le module 14 rétrograde déjà les objectifs en secondaires. On les
   * remplace par des objectifs qui ont un sens sans course.
   * ================================================================== */

  var _origGenObj = null;

  function installObjectifs() {
    if (!fn("generateSeasonObjectives") || window.generateSeasonObjectives._rj79) return false;
    _origGenObj = window.generateSeasonObjectives;
    window.generateSeasonObjectives = function () {
      var r = _origGenObj.apply(this, arguments);
      try {
        if (!estReservistePur()) return r;
        if (!has("TEAM_TRUST") || !window.TEAM_TRUST) return r;
        window.TEAM_TRUST.objectives = objectifsReserviste();
      } catch (e) { console.warn(TAG, "objectifs réserviste :", e && e.message); }
      return r;
    };
    window.generateSeasonObjectives._rj79 = true;
    return true;
  }

  function objectifsReserviste() {
    return [
      { id: "rj79_seances", type: "main", label: "Disputer 4 séances d'essais",
        desc: "Être présent et exploitable à chaque fois qu'on te confie la voiture.",
        done: false, failed: false, reward: 6, penalty: 4 },
      { id: "rj79_ecart", type: "main", label: "Écart moyen sous 0,6 s",
        desc: "Rester dans la fenêtre du titulaire sur tes tours de référence.",
        done: false, failed: false, reward: 10, penalty: 6 },
      { id: "rj79_credibilite", type: "secondary", label: "Atteindre 60 de crédibilité",
        desc: "Devenir le premier nom sur la liste quand un baquet se libère.",
        done: false, failed: false, reward: 8, penalty: 2 }
    ];
  }

  function majObjectifs() {
    if (!estReservistePur()) return;
    if (!has("TEAM_TRUST") || !window.TEAM_TRUST || !window.TEAM_TRUST.objectives) return;
    var d = RD(); if (!d) return;
    var nb = (d.sessions || []).length;
    var moy = moyenneEcart();
    var cred = credibilite();
    window.TEAM_TRUST.objectives.forEach(function (o) {
      if (!o) return;
      if (o.id === "rj79_seances") o.done = nb >= 4;
      if (o.id === "rj79_ecart") { if (nb >= 2 && moy !== null) o.done = moy <= 0.6; }
      if (o.id === "rj79_credibilite") o.done = cred >= 60;
    });
  }

  /* ==================================================================
   * 15b. BANDEAU DE CHAMPIONNAT
   *
   * Un réserviste apparaît dernier du championnat avec zéro point, ce qui
   * est exact mais déroutant. On l'explique en une ligne au-dessus du
   * classement plutôt que de masquer la réalité.
   * ================================================================== */

  var _origChamp = null;

  function installBandeauChamp() {
    if (!fn("renderChamp") || window.renderChamp._rj79) return false;
    _origChamp = window.renderChamp;
    window.renderChamp = function () {
      var r = _origChamp.apply(this, arguments);
      try { injecterBandeauChamp(); } catch (e) {}
      return r;
    };
    window.renderChamp._rj79 = true;
    return true;
  }

  function injecterBandeauChamp() {
    var anc = document.getElementById("rj79-champ-note");
    if (anc && anc.parentNode) anc.parentNode.removeChild(anc);
    if (!estReservistePur()) return;
    var scr = document.getElementById("S-champ");
    if (!scr) return;
    injecterCSS();
    var d = RD();
    var note = document.createElement("div");
    note.id = "rj79-champ-note";
    note.style.cssText = "margin:10px 14px;padding:10px 13px;border:1px solid var(--border-hi);" +
      "border-left:2px solid " + CYAN + ";background:var(--bg3);font-size:12px;color:var(--soft);" +
      "line-height:1.5;font-family:var(--font-body)";
    note.innerHTML = "Tu es pilote de réserve" + (d ? " chez " + esc(d.team) : "") +
      " : tu ne prends pas le départ et ne marques donc aucun point cette saison. " +
      "Ta saison se joue en essais, pas au classement.";
    var scroll = scr.querySelector(".scroll") || scr;
    var premier = scroll.firstElementChild;
    if (premier) scroll.insertBefore(note, premier.nextSibling);
    else scroll.appendChild(note);
  }

  /* ==================================================================
   * 16. ACCUEIL — carte d'accès et déclenchement des remplacements
   * ================================================================== */

  function rafraichirAccueil() {
    try {
      var d = RD();
      var anc = document.getElementById("rj79-homecard");
      if (anc && anc.parentNode) anc.parentNode.removeChild(anc);
      if (!d) return;
      var home = document.getElementById("S-home");
      if (!home) return;
      injecterCSS();

      var cred = credibilite();
      var carte = document.createElement("div");
      carte.className = "rj79-homecard";
      carte.id = "rj79-homecard";
      carte.innerHTML =
        '<div style="min-width:0">' +
          '<div class="hc-t">' + (d.cumul ? "Réserve " : "Pilote de réserve \u00b7 ") + esc(d.team) + '</div>' +
          '<div class="hc-s">' + esc(d.cat) + ' \u00b7 crédibilité ' + cred + ' \u00b7 ' + esc(libelleCredibilite(cred)) + '</div>' +
        '</div><div class="hc-go">\u203A</div>';
      carte.addEventListener("click", function () { ouvrirEcranReserve(); });

      var scroll = home.querySelector(".scroll") || home;
      var premier = scroll.firstElementChild;
      if (premier) scroll.insertBefore(carte, premier.nextSibling);
      else scroll.appendChild(carte);
    } catch (e) {}
  }

  /* Décide si un remplacement a lieu à l'approche de la prochaine course. */
  function peutEtreRemplacant() {
    var G = G_(), d = RD();
    if (!G || !d) return false;
    if (G._rj79Remplacement) return false;
    if (G.seasonOver) return false;
    if (d.saison > saison()) return false;
    return true;
  }

  function tenterRemplacement() {
    var G = G_(), d = RD();
    if (!peutEtreRemplacant()) return false;

    var faits = (d.remplacements || []).filter(function (r) { return r.saison === saison(); }).length;
    var seances = (d.sessions || []).length;
    var cred = credibilite();

    /* Probabilité de base : une course sur dix environ, modulée par la
       crédibilité (l'écurie appelle celui en qui elle croit). */
    var p = 0.09 + (cred - 40) * 0.0016;
    if (faits >= 2) p *= 0.35;                        // au-delà de deux, ça devient irréaliste
    p = clamp(p, 0.02, 0.22);

    /* Garantie : au moins une occasion par saison. Passé les trois quarts
       du calendrier sans jamais rouler, la porte s'ouvre. */
    var restantes = 0;
    try { restantes = (window.CAL_RACES || []).filter(function (c) { return !c.done; }).length; } catch (e) {}
    if (faits === 0 && seances >= 2 && restantes <= 4) p = 1;

    if (Math.random() >= p) return false;
    return declencherRemplacement(null, null);
  }

  /* ==================================================================
   * 17. HOOKS ET INSTALLATION
   * ================================================================== */

  function hookHebdo() {
    try {
      var G = G_(); if (!G) return;
      assurerContrat();
      majObjectifs();
      balayerGrille();
      /* Le mercato de réserve s'ouvre en seconde moitié de saison. */
      if (semaine() >= 24 && semaine() % 6 === 0) genererOffresReserve();
      if (G.seasonOver) bilanFinDeSaison();
      rafraichirAccueil();
    } catch (e) { console.warn(TAG, "hook hebdo :", e && e.message); }
  }

  function hookPostCourse(info) {
    try {
      var G = G_();
      if (G && G._rj79Remplacement) conclureRemplacement(info);
      majObjectifs();
      rafraichirAccueil();
    } catch (e) { console.warn(TAG, "hook post-course :", e && e.message); }
  }

  function enregistrerHooks() {
    var ok = true;
    if (has("WEEKLY_TICK_HOOKS") && window.WEEKLY_TICK_HOOKS && window.WEEKLY_TICK_HOOKS.push) {
      if (!window.WEEKLY_TICK_HOOKS.some(function (h) { return h && h.id === "reserveDriver"; })) {
        window.WEEKLY_TICK_HOOKS.push({ id: "reserveDriver", run: hookHebdo });
      }
    } else ok = false;

    if (has("RACE_POST_HOOKS") && window.RACE_POST_HOOKS && window.RACE_POST_HOOKS.push) {
      if (!window.RACE_POST_HOOKS.some(function (h) { return h && h.id === "reserveDriver"; })) {
        window.RACE_POST_HOOKS.push({ id: "reserveDriver", run: hookPostCourse });
      }
    } else ok = false;
    return ok;
  }

  /* On tente un remplacement au moment où le joueur part vers le week-end,
     avant que l'interception ne décide du format. */
  var _origAdvance = null;

  function installAvancementTemps() {
    if (!fn("advanceToNextMoment") || window.advanceToNextMoment._rj79) return false;
    _origAdvance = window.advanceToNextMoment;
    window.advanceToNextMoment = function () {
      try {
        var G = G_();
        if (G && estReservistePur() && !G._rj79Remplacement) {
          assurerContrat();
          tenterRemplacement();
        }
        if (G && G._rj79Remplacement) {
          var course = fn("getNextRace") ? window.getNextRace() : null;
          G._rj79Remplacement.circuit = course ? (course.name || "Grand Prix") : "Grand Prix";
          preparerRemplacement();
        }
      } catch (e) { console.warn(TAG, "avancement :", e && e.message); }
      return _origAdvance.apply(this, arguments);
    };
    window.advanceToNextMoment._rj79 = true;
    return true;
  }

  /* Le badge de rôle et sa description (le module 14 les pose déjà pour
     num3 ; on complète si 14 est absent ou chargé après nous). */
  function installBadge() {
    if (fn("getRoleInfo") && !window.getRoleInfo._rj79) {
      var orig = window.getRoleInfo;
      window.getRoleInfo = function (r) {
        if (r === "num3") {
          return {
            label: "Pilote de réserve", short: "RÉS", color: CYAN,
            bg: "rgba(0,212,255,.10)", border: "rgba(0,212,255,.35)", icon: "🔧"
          };
        }
        return orig.apply(this, arguments);
      };
      window.getRoleInfo._rj79 = true;
    }
    if (fn("_getRoleDesc") && !window._getRoleDesc._rj79) {
      var origD = window._getRoleDesc;
      window._getRoleDesc = function (r) {
        if (r === "num3") {
          return "Pilote de réserve · Essais le vendredi, pas de course · Gagne en crédibilité pour décrocher un baquet";
        }
        return origD.apply(this, arguments);
      };
      window._getRoleDesc._rj79 = true;
    }
  }

  function install() {
    if (window._rj79Installed) return;
    window._rj79Installed = true;

    var essais = 0;
    (function boot() {
      var a = enregistrerHooks();
      var b = installInterceptionWeekEnd();
      var c = installSignature();
      var d = installEvenementsPlanifies();
      var e = installObjectifs();
      var f = installAvancementTemps();
      installPersistance();
      installHistorique();
      installBadge();
      installBandeauChamp();
      if (a && b && c && d && e && f) {
        creerEcran();
        rafraichirAccueil();
        console.log(TAG, "actif — le pilote de réserve est un vrai chemin de carrière");
        return;
      }
      if (essais++ < 60) setTimeout(boot, 150);
      else console.warn(TAG, "installation partielle (dépendances manquantes)");
    })();

    /* API de test / debug. */
    window._rj79 = {
      deal: RD, setDeal: setRD, cred: credibilite, changeCred: changeCredibilite,
      ouvrirEcran: ouvrirEcranReserve, weekEnd: function () { return WE; },
      simuler: simulerCourseSansJoueur, stature: stature,
      risque: risqueDePerdreSonBaquet, balayer: balayerGrille,
      remplacer: declencherRemplacement, tenter: tenterRemplacement,
      promouvoir: evaluerPromotion, bilan: bilanFinDeSaison,
      offres: genererOffresReserve, planifier: planifierSeancesCumul,
      histoire: histReserve, seats: seatsLibres
    };

    window._rj79Uninstall = function () {
      try {
        if (_origGoWeekend) window.goToRaceWeekend = _origGoWeekend;
        if (_origSign) window.signContract = _origSign;
        if (_origOpenSched) window.openScheduledEvent = _origOpenSched;
        if (_origGenObj) window.generateSeasonObjectives = _origGenObj;
        if (_origAdvance) window.advanceToNextMoment = _origAdvance;
        if (_origSave) window.saveGame = _origSave;
        if (_origLoad) window.loadSave = _origLoad;
        if (_origSaveSeason) window.saveSeasonToHistory = _origSaveSeason;
        if (_origPalmares) window.renderPalmares = _origPalmares;
        if (_origChamp) window.renderChamp = _origChamp;
        var bn = document.getElementById("rj79-champ-note"); if (bn && bn.parentNode) bn.parentNode.removeChild(bn);
        ["WEEKLY_TICK_HOOKS", "RACE_POST_HOOKS"].forEach(function (k) {
          if (!window[k]) return;
          for (var i = window[k].length - 1; i >= 0; i--) {
            if (window[k][i] && window[k][i].id === "reserveDriver") window[k].splice(i, 1);
          }
        });
        var s = document.getElementById("S-reserve"); if (s && s.parentNode) s.parentNode.removeChild(s);
        var c = document.getElementById(CSS_ID); if (c && c.parentNode) c.parentNode.removeChild(c);
        var hc = document.getElementById("rj79-homecard"); if (hc && hc.parentNode) hc.parentNode.removeChild(hc);
        window._rj79Installed = false;
        console.log(TAG, "désinstallé");
      } catch (e) { console.warn(TAG, "désinstallation :", e && e.message); }
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
})();
