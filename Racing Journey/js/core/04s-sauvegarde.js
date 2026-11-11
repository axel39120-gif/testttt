/* =====================================================================
 * 04s-sauvegarde.js — LA SAUVEGARDE, EN UN SEUL ENDROIT
 *
 * POURQUOI
 * saveGame était défini dans 04 puis enveloppé par 07 (extras dans une clé
 * à part), 63 (champs d'écurie) et 86 (blocs RJ_SAVE_HOOKS) : trois à
 * quatre écritures par sauvegarde, et en cas de stockage plein des blocs
 * récents greffés sur une ancienne partie, sans que le joueur le sache.
 *
 * CE QUI EST GARANTI
 *   · une sauvegarde s'écrit en UNE fois : tout ou rien ;
 *   · un échec est toujours signalé, sauvegarde automatique comprise ;
 *   · une sauvegarde illisible est mise de côté avant d'être remplacée ;
 *   · le format porte une version (_v) ; l'ancien format est migré.
 *
 * ÉTENDRE LA SAUVEGARDE
 * Jamais en enveloppant saveGame : on inscrit un bloc.
 *   RJ_SAVE_HOOKS.push({ cle, ecrire(G) → valeur | null | undefined,
 *                        lire(bloc, G) })
 * ecrire : undefined = rien à écrire, null = bloc retiré.
 * lire est appelé après le chargement du cœur, avec null si le bloc manque.
 * =================================================================== */

var VERSION_SAUVEGARDE = 2;
if (!Array.isArray(window.RJ_SAVE_HOOKS)) window.RJ_SAVE_HOOKS = [];

function cleExtrasAncienne(slot) { return "rj_extra_slot_" + slot; }

/* Ce que signale un échec : la boîte de sauvegarde et un message d'accueil,
   pour qu'il soit vu même hors de l'écran des sauvegardes. */
function signalerEchecSauvegarde(titre, message) {
  console.warn("[sauvegarde] " + titre + " — " + message);
  try { if (typeof showFb === "function") showFb("save-fb", "err", titre, message); } catch (e) {}
  try { if (typeof pushHomeToast === "function") pushHomeToast(titre, message, "#EF4444"); } catch (e) {}
}

function estLisible(brut) {
  try { var o = JSON.parse(brut); return !!o && typeof o === "object"; } catch (e) { return false; }
}

function getSave(e) {
  try {
    var t = localStorage.getItem(SAVE_KEYS[e]);
    return t ? JSON.parse(t) : null;
  } catch (e) {
    return null;
  }
}

/* ------------------------------------------------------------------
 * Écriture
 * ---------------------------------------------------------------- */
function serialiserCoeur() {
  return {
    pilot: G.pilot,
    substats: G.substats || {},
    stats: G.stats,
    rep: G.rep,
    budget: G.budget,
    revenue: G.revenue,
    reputation: G.reputation,
    saison: G.saison,
    semaine: G.semaine,
    pa: G.pa,
    champPts: G.champPts,
    age: G.age,
    gameYear: G.gameYear || G.pilot.startYear || 2024,
    cat: G.cat,
    races: G.races,
    offers: G.offers,
    totalLaps: G.totalLaps,
    /* Chaque rival est enregistré avec son identité (nom, écurie, talent,
       statut) : au chargement, ses points reviennent à lui, et non au pilote
       qui occupe la même place dans une grille reconstruite. */
    rivals: G.rivals.map(function (e) {
      return { name: e.name, nat: e.nat, team: e.team, skill: e.skill, consistency: e.consistency, poolId: e._poolId,
               sorti: e._rj79Sorti || null, recrue: !!e._rj79Recrue,
               pts: e.pts, qualiHistory: e.qualiHistory || [], raceHistory: e.raceHistory || [], careerHistory: e.careerHistory || [] };
    }),
    /* Chaque manche avec son nom, sa semaine et son format : le calendrier d'une
       saison change d'une année à l'autre (137), il est relu tel qu'il était. */
    calRaces: CAL_RACES.map(function (e) { return { name: e.name, week: e.week, manche: e.manche, isSprint: !!e.isSprint, special: e.special || null, done: e.done, result: e.result }; }),
    owned: G.owned || [],
    happiness: G.happiness || 50,
    igFollowers: G.igFollowers || 0,
    currentTeam: G.currentTeam || "Indépendant",
    seasonTeam: G._seasonTeam || G.currentTeam || "Indépendant",
    careerHistory: CAREER_HISTORY.map(function (e) {
      return {
        saison: e.saison, cat: e.cat, pos: e.pos, pts: e.pts, races: e.races, wins: e.wins, pods: e.pods,
        top5: e.top5 || 0, dnfs: e.dnfs || 0, poles: e.poles || 0, age: e.age, rating: e.rating,
        team: e.team || "Indépendant", constrChamp: e.constrChamp || null, number: e.number || 23,
        raceDetails: (e.raceDetails || []).map(function (r) {
          return {
            nom: r.nom, pos: r.pos, pts: r.pts, detail: r.detail, pole: r.pole, tmPos: r.tmPos,
            qualiPos: r.qualiPos || 0, circuit: r.circuit || "", weather: r.weather || "dry",
            bestLap: r.bestLap || null, playerBestLap: r.playerBestLap || null, saison: r.saison, cat: r.cat
          };
        })
      };
    }),
    rivalCareerRegistry: (typeof RIVAL_CAREER_REGISTRY !== "undefined" ? RIVAL_CAREER_REGISTRY : {}),
    f1Champion: G._f1Champion || false,
    playerAcademy: {
      id: PLAYER_ACADEMY.id, relation: PLAYER_ACADEMY.relation,
      canLeave: PLAYER_ACADEMY.canLeave || false, f1Offer: PLAYER_ACADEMY.f1Offer || false
    },
    teamTrust: TEAM_TRUST.value || 50,
    pilotMental: PILOT_MENTAL || null,
    setupAdv: G.setupAdv || null,
    stratAdv: G.stratAdv || null,
    unseenSponsors: G._unseenSponsors || [],
    sponsorOffers: G.sponsorOffers || [],
    dismissedNotifs: G._dismissedNotifs || [],
    contractDur: G.contractDur || 0,
    contractWeeksLeft: G.contractWeeksLeft || 0,
    paddockPass: !!G.paddockPass,
    rivalries: G._rivalries || [],
    rivPosHistory: G._rivPosHistory || {},
    mailbox: G.mailbox || [],
    decisions: G.decisions || [],
    entityMemory: G._entityMemory || {},
    relations: G.relations || null,
    training: G.training || null,
    wowMoments: G._wowMoments || [],
    mediaState: G.mediaState || null,
    preseason: G.preseason || null,
    majorWins: G._majorWins || [],
    playerRole: G._playerRole || "num2",
    tmWinsCount: G._tm_wins_count || 0,
    roleUpgradeNotified: G._roleUpgradeNotified || false,
    pendingTransfer: G.pendingTransfer || null,
    seasonOver: G.seasonOver || false,
    scheduledEvents: G._scheduledEvents || [],
    agent: G.agent || null,
    agentUpgradeOffered: G._agentUpgradeOffered || false,
    contacts: G._contacts || {},
    firstMilestones: G._firstMilestones || {},
    unlockedAchievements: G._unlockedAchievements || {},
    unlockedCodes: G._unlockedCodes || {},
    houseKeepingUnlocked: !!G._houseKeepingUnlocked,
    adminMode: !!G._adminMode,
    noDnf: !!G._noDnf,
    igMilestones: G._igMilestones || {},
    hadSponsor: !!G._hadSponsor,
    repAxeMilestones: G._repAxeMilestones || {},
    careerRecords: G._careerRecords || {},
    budgetWarned: !!G._budgetWarned,
    contractExpiryWarned: !!G._contractExpiryWarned,
    imageCrisisWarned: !!G._imageCrisisWarned,
    savedAt: Date.now(),
    driverPool: G.driverPool || null
  };
}

/* Retourne true si la partie est écrite, false sinon (le joueur est prévenu).
   options.silencieux : pas de message de réussite (sauvegardes automatiques). */
function saveGame(e, options) {
  void 0 === e && (e = G._slot || 0);
  options = options || {};
  var cle = SAVE_KEYS[e];
  var obj;
  try {
    obj = serialiserCoeur();
    obj._v = VERSION_SAUVEGARDE;
    var nonEcrits = [];
    window.RJ_SAVE_HOOKS.forEach(function (h) {
      if (!h || !h.cle || typeof h.ecrire !== "function") return;
      try {
        var bloc = h.ecrire(G);
        if (bloc !== undefined && bloc !== null) obj[h.cle] = bloc;
      } catch (err) {
        console.warn("[sauvegarde] bloc « " + h.cle + " » non écrit :", err && err.message);
        nonEcrits.push(h.cle);
      }
    });
  } catch (err) {
    signalerEchecSauvegarde("Sauvegarde impossible", "La partie n'a pas pu être préparée (" + (err && err.message || err) + ").");
    return false;
  }

  try {
    /* Une sauvegarde illisible n'est jamais écrasée sans copie. Si la copie
       elle-même ne tient pas (stockage plein), on n'écrase pas : le joueur
       est prévenu et garde ce qu'il a. Une seule copie par emplacement. */
    var precedente = localStorage.getItem(cle);
    if (precedente && !estLisible(precedente)) {
      Object.keys(localStorage).forEach(function (k) {
        if (k.indexOf(cle + "_illisible_") === 0) localStorage.removeItem(k);
      });
      localStorage.setItem(cle + "_illisible_" + Date.now(), precedente);
    }
    localStorage.setItem(cle, JSON.stringify(obj));
  } catch (err) {
    signalerEchecSauvegarde("Sauvegarde impossible",
      (err && err.name === "QuotaExceededError")
        ? "Le stockage de l'appareil est plein : la partie précédente est conservée telle quelle."
        : "L'écriture a échoué : la partie précédente est conservée telle quelle.");
    return false;
  }

  /* L'ancien format rangeait les extras à part : la clé n'a plus d'usage. */
  try { localStorage.removeItem(cleExtrasAncienne(e)); } catch (err) {}
  G._slot = e;
  if (nonEcrits.length) {
    signalerEchecSauvegarde("Sauvegarde incomplète", "Partie enregistrée, sauf : " + nonEcrits.join(", ") + ".");
    return true;
  }
  if (!options.silencieux && typeof showFb === "function") {
    showFb("save-fb", "ok", "Sauvegarde OK", "Emplacement " + (e + 1) + " mis à jour.");
  }
  return true;
}

/* ------------------------------------------------------------------
 * Lecture
 * ---------------------------------------------------------------- */

/* Format 1 (sans _v) : extras dans rj_extra_slot_N, champs d'écurie à la
   racine. On les range là où le format 2 les attend. */
function migrerSauvegarde(t, e) {
  if (t._v >= VERSION_SAUVEGARDE) return t;
  if (t.extras === undefined) {
    try {
      var brut = localStorage.getItem(cleExtrasAncienne(e));
      if (brut) t.extras = JSON.parse(brut);
    } catch (err) { console.warn("[sauvegarde] extras de l'ancien format illisibles :", err && err.message); }
  }
  if (t.champs === undefined && typeof window._rj64Champs === "function") {
    var champs = {};
    window._rj64Champs().forEach(function (c) { if (t[c] !== undefined) champs[c] = t[c]; });
    if (Object.keys(champs).length) t.champs = champs;
  }
  t._v = VERSION_SAUVEGARDE;
  return t;
}

function appliquerCoeur(t, e) {
  Object.assign(G, {
    pilot: t.pilot, stats: t.stats, rep: t.rep, budget: t.budget, revenue: t.revenue,
    reputation: t.reputation, saison: t.saison, semaine: t.semaine, pa: t.pa, champPts: t.champPts,
    age: t.age, cat: t.cat, races: t.races, offers: t.offers || [], totalLaps: t.totalLaps, _slot: e
  });
  if (t.f1Champion) G._f1Champion = true;
  G.pilot.number || (G.pilot.number = 23);
  G.gameYear = t.gameYear || (G.pilot && G.pilot.startYear ? G.pilot.startYear + (t.saison - 1) : 2024);
  if (t.playerAcademy && t.playerAcademy.id) {
    PLAYER_ACADEMY.id = t.playerAcademy.id;
    PLAYER_ACADEMY.relation = t.playerAcademy.relation || 30;
    PLAYER_ACADEMY.canLeave = !!t.playerAcademy.canLeave;
    PLAYER_ACADEMY.f1Offer = !!t.playerAcademy.f1Offer;
  } else {
    PLAYER_ACADEMY.id = null; PLAYER_ACADEMY.relation = 0;
    PLAYER_ACADEMY.canLeave = false; PLAYER_ACADEMY.f1Offer = false;
  }
  TEAM_TRUST.value = (t.teamTrust !== undefined) ? t.teamTrust : 50;
  if (t.pilotMental) {
    PILOT_MENTAL = {
      value: t.pilotMental.value || 60, confidence: t.pilotMental.confidence || 60,
      pressure: t.pilotMental.pressure || 30, streakGood: t.pilotMental.streakGood || 0,
      streakBad: t.pilotMental.streakBad || 0,
      lastWinRace: t.pilotMental.lastWinRace !== undefined ? t.pilotMental.lastWinRace : -99,
      history: t.pilotMental.history || []
    };
  } else {
    var trait = t.pilot && t.pilot.trait;
    var m = trait === "competiteur" ? 65 : trait === "sangfroid" ? 62 : trait === "perfectionniste" ? 55 : trait === "leader" ? 63 : 60;
    PILOT_MENTAL = { value: m, confidence: m, pressure: 30, streakGood: 0, streakBad: 0, lastWinRace: -99, history: [] };
  }
  var reglages = { aileron_av: 5, aileron_ar: 5, antiroulis_av: 5, antiroulis_ar: 5, carrossage: 5,
                   suspension: 5, pression_pneus: 5, differentiel: 5, repartition_frein: 5 };
  G.setupAdv = t.setupAdv ? Object.assign({}, reglages, t.setupAdv) : reglages;
  var strat = { agress_debut: 5, agress_fin: 5, gestion_pneus: 5, depassement: 5 };
  G.stratAdv = t.stratAdv ? Object.assign(strat, t.stratAdv) : strat;
  G._unseenSponsors = t.unseenSponsors || [];
  G.sponsorOffers = t.sponsorOffers || [];
  G._dismissedNotifs = t.dismissedNotifs || [];
  if (typeof ensureContractWeeks === "function") ensureContractWeeks();
  generateSeasonObjectives();
  G.rivals = [];
  G.owned = t.owned || [];
  G.happiness = t.happiness || 50;
  G.igFollowers = t.igFollowers || 0;
  G.contractDur = t.contractDur || 0;
  G.contractWeeksLeft = t.contractWeeksLeft || 0;
  G.paddockPass = !!t.paddockPass;
  G._rivalries = t.rivalries || [];
  G._rivPosHistory = t.rivPosHistory || {};
  G.mailbox = t.mailbox || [];
  G.decisions = t.decisions || [];
  G._entityMemory = t.entityMemory || {};
  G.relations = t.relations || null;
  G.training = t.training || null;
  G._wowMoments = t.wowMoments || [];
  G.mediaState = t.mediaState || null;
  G.preseason = t.preseason || null;
  G._majorWins = t.majorWins || [];
  G.currentTeam = t.currentTeam || "Indépendant";
  G.pendingTransfer = t.pendingTransfer || null;
  G._playerRole = t.playerRole || "num2";
  G._tm_wins_count = t.tmWinsCount || 0;
  G._roleUpgradeNotified = t.roleUpgradeNotified || false;
  G.seasonOver = t.seasonOver || false;
  G._scheduledEvents = t.scheduledEvents || [];
  G.agent = t.agent || null;
  G._agentUpgradeOffered = t.agentUpgradeOffered || false;
  G._contacts = t.contacts || {};
  G._firstMilestones = t.firstMilestones || {};
  G._unlockedAchievements = t.unlockedAchievements || {};
  G._unlockedCodes = t.unlockedCodes || {};
  G._houseKeepingUnlocked = !!t.houseKeepingUnlocked;
  G._adminMode = !!t.adminMode;
  G._noDnf = !!t.noDnf;
  G._igMilestones = t.igMilestones || {};
  G._hadSponsor = !!t.hadSponsor;
  G._repAxeMilestones = t.repAxeMilestones || {};
  G._careerRecords = t.careerRecords || {};
  G._budgetWarned = !!t.budgetWarned;
  G._contractExpiryWarned = !!t.contractExpiryWarned;
  G._imageCrisisWarned = !!t.imageCrisisWarned;
  if (t.substats) G.substats = t.substats;
  else { G.substats = initSubStats(G.pilot.style || "complet", G.pilot.trait || "analyste"); computeLegacyStats(); }
  CAREER_HISTORY = (t.careerHistory || []).map(function (h) { return Object.assign({ raceDetails: [] }, h); });
  RIVAL_CAREER_REGISTRY = t.rivalCareerRegistry || {};
  G._seasonTeam = t.seasonTeam || t.currentTeam || "Indépendant";
  /* Le vivier de la partie d'abord : la grille se reconstruit à partir de lui,
     pas de celui de la partie ouverte avant le chargement. */
  if (Array.isArray(t.driverPool) && t.driverPool.length) { G.driverPool = t.driverPool; G._rjPoolInitialized = true; }
  initRivals();
  restaurerRivaux(t.rivals);
  /* Calendrier évolutif (137) : la graine et la saison de départ de la partie
     chargée, et non celles d'une partie ouverte avant. Une sauvegarde antérieure
     garde le calendrier de sa saison en cours ; l'évolution part de la suivante. */
  var _cal = t.rj137 || null;
  G._calGraine = (_cal && _cal.graine) || G._calGraine;
  G._calDepart = (_cal && typeof _cal.depart === "number") ? _cal.depart : undefined;
  CAL_RACES = [];
  if (t.calRaces && t.calRaces.length && t.calRaces.every(function (c) { return c && c.name; })) {
    CAL_RACES = t.calRaces.map(function (c, i) {
      var r = { name: c.name, week: c.week, manche: c.manche || i + 1, done: !!c.done, result: c.result || null };
      if (c.isSprint) r.isSprint = true;
      if (c.special) r.special = c.special;
      return r;
    });
  } else {
    buildCalendar();
    if (t.calRaces) t.calRaces.forEach(function (c, i) {
      if (CAL_RACES[i]) { CAL_RACES[i].done = c.done; CAL_RACES[i].result = c.result; }
    });
  }
  G.seasonOver = false;
  G.raceLocked = false;
  G.racePhase = "";
  updateUI();
  renderChamp();
  renderOffers();
  renderHomeEvents();
  if (!Array.isArray(G.driverPool) || !G.driverPool.length) G.driverPool = t.driverPool || G.driverPool || null;
  if ((!G.driverPool || !Object.keys(G.driverPool).length) && typeof _initDriverPool === "function") _initDriverPool();
  /* Réparation : des carrières créées avec un vivier vide (bug de 04o)
     n'avaient aucun rival, et le classement ne montrait que le joueur. */
  if ((!G.rivals || !G.rivals.length) && G.cat && typeof initRivals === "function") {
    try { initRivals(); renderChamp(); } catch (err) { console.warn("[sauvegarde] rivaux :", err && err.message); }
  }
  if (typeof applyRaceLockUI === "function") applyRaceLockUI();
  navTo("S-home", "ni-home");
}

/* Remet chaque rival sauvegardé à sa place, par son nom. Les sauvegardes
   antérieures (sans nom) gardent l'ancienne correspondance par position. */
function restaurerRivaux(sauves) {
  if (!Array.isArray(sauves) || !sauves.length) return;
  function histos(dst, r) {
    dst.pts = r.pts || 0;
    dst.qualiHistory = r.qualiHistory || [];
    dst.raceHistory = r.raceHistory || [];
    dst.careerHistory = r.careerHistory || [];
  }
  if (!sauves.every(function (r) { return r && r.name; })) {
    sauves.forEach(function (r, i) { if (G.rivals[i]) histos(G.rivals[i], r); });
    return;
  }
  var parNom = {};
  (G.rivals || []).forEach(function (x) { if (x && x.name) parNom[x.name] = x; });
  G.rivals = sauves.map(function (r) {
    var x = parNom[r.name] || { name: r.name, nat: r.nat, lastPos: 0 };
    x.team = r.team != null ? r.team : x.team;
    if (typeof r.skill === "number") x.skill = r.skill;
    if (typeof r.consistency === "number") x.consistency = r.consistency;
    if (r.poolId) x._poolId = r.poolId;
    if (r.sorti) x._rj79Sorti = r.sorti; else delete x._rj79Sorti;
    if (r.recrue) x._rj79Recrue = true;
    histos(x, r);
    return x;
  });
}

function loadSave(e) {
  var brut = null;
  try { brut = localStorage.getItem(SAVE_KEYS[e]); } catch (err) {}
  if (!brut) {
    signalerEchecSauvegarde("Chargement impossible", "Aucune sauvegarde dans cet emplacement.");
    return;
  }
  var t = estLisible(brut) ? JSON.parse(brut) : null;
  if (!t) {
    /* Rien n'est touché : la partie en cours reste intacte, la sauvegarde aussi. */
    signalerEchecSauvegarde("Sauvegarde illisible",
      "L'emplacement " + (e + 1) + " est endommagé. Il sera conservé à part si tu sauvegardes dessus.");
    return;
  }
  try {
    migrerSauvegarde(t, e);
    appliquerCoeur(t, e);
  } catch (loadErr) {
    console.error("[sauvegarde] chargement de l'emplacement", e, "échoué :", loadErr);
    signalerEchecSauvegarde("Erreur", "Impossible de charger cette sauvegarde. Détail dans la console.");
    try { G._slot = null; G._loadFailedAt = Date.now(); } catch (_) {}
    return;
  }
  window.RJ_SAVE_HOOKS.forEach(function (h) {
    if (!h || !h.cle || typeof h.lire !== "function") return;
    try { h.lire(t[h.cle] !== undefined ? t[h.cle] : null, G); }
    catch (err) { console.warn("[sauvegarde] bloc « " + h.cle + " » non relu :", err && err.message); }
  });
}

/* ------------------------------------------------------------------
 * Sauvegardes automatiques : silencieuses quand elles réussissent,
 * jamais quand elles échouent.
 * ---------------------------------------------------------------- */
function _autoSaveOnRaceEnd() {
  if (!SETTINGS || !SETTINGS.autoSaveAfterRace) return;
  if (G._slot === undefined || G._slot === null) return;
  if (saveGame(G._slot, { silencieux: true })) console.log("[autosave] emplacement " + (G._slot + 1) + " sauvegardé");
}

function _autoSaveOnSeasonEnd() {
  if (!SETTINGS || !SETTINGS.autoSaveAfterSeason) return;
  if (G._slot === undefined || G._slot === null) return;
  if (saveGame(G._slot, { silencieux: true }) && typeof showToast === "function") {
    showToast("Saison sauvegardée automatiquement", "success");
  }
}
