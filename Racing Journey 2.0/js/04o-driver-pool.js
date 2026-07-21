/* =====================================================================
 * 04o-driver-pool.js — CONTINUITÉ DES PILOTES MULTI-CATÉGORIES
 *
 * Transforme l'écosystème pilote d'un système "rosters figés par cat" en
 * "pool global de pilotes qui évoluent". Marco Rossi (KJ) peut maintenant
 * te suivre toute ta carrière : KJ → KS → F4 → ... → F1, avec sa propre
 * trajectoire, ses victoires, ses transferts d'équipe, et ses retraites
 * éventuelles.
 *
 * C'est ce qui rend possible :
 *   • De vraies rivalités multi-saisons (« ce mec me bat depuis le karting »)
 *   • Story moments (« mon ancien rival vient de signer chez Mercedes »)
 *   • Le réalisme F1 (Hamilton, Verstappen, Norris ont tous une trajectoire)
 *
 * ARCHITECTURE :
 *
 *   1. POOL GLOBAL — G.driverPool contient TOUS les pilotes existants
 *      avec leur cat actuelle, âge, stats, historique, équipe.
 *
 *   2. WRAP initRivals — au lieu d'écraser G.rivals avec un roster figé,
 *      on filtre G.driverPool par catégorie et on remplit G.rivals.
 *
 *   3. WRAP startNextSeason — fait évoluer le pool entier :
 *        • Promotions (les top montent en cat supérieure)
 *        • Descentes (les flop d'F1 perdent leur baquet)
 *        • Évolution skills (selon archétype de courbe)
 *        • Mouvements d'équipe dans chaque cat
 *        • Retraites (âge ou perte totale de baquet)
 *        • Apparition de rookies (renouvellement KJ)
 *
 *   4. ARCHÉTYPES DE PROGRESSION :
 *        • prodige         (peak 22-26)
 *        • steady          (peak 26-30)
 *        • late_bloomer    (peak 28-32)
 *        • wonderkid_fade  (explosion jeune puis stagne)
 *
 *   5. PILOTES "GHOST" — les rivaux pas dans ta cat continuent de courir
 *      en arrière-plan. Leurs résultats sont simulés rapidement, points
 *      cumulés, possible promotion/descente en fin de saison.
 *
 *   6. TRANSFERTS NOTABLES PUSHÉS EN PRESSE — quand un ancien rival
 *      signe en F1 ou monte de F4 à F3, ça peut apparaître dans la presse.
 *
 * COMPATIBILITÉ :
 *
 *   • G.rivals reste à 19-20 pilotes (la cat actuelle uniquement)
 *   • Format de chaque rival inchangé (name, nat, skill, consistency, team, etc.)
 *   • G._rivalries persistent (cherchent par nom, donc continuent à matcher)
 *   • Le module rétrograde proprement si carrière déjà en cours sans pool
 *   • Cohabite avec 04n (track specialties) — recalculées par saison
 *
 * ⚠️  ORDRE DE CHARGEMENT :
 *
 *   Ce module DOIT être chargé AVANT 04k (realism-overhaul) car il extrait
 *   les rosters legacy depuis `initRivals.toString()`. Si 04k a déjà wrappé
 *   `initRivals`, l'extraction échoue (le toString retourne le code du
 *   wrapper, pas du legacy).
 *
 *   Ordre correct : ... → 04j → 04o → 04k → ...
 *
 * EXPOSE :
 *
 *   _rjGetDriverHistory(name)        → trajectoire complète d'un pilote
 *   _rjGetAlumniInCurrentCat()       → anciens rivaux dans ma cat actuelle
 *   _rjGetDriverInPool(name)         → l'objet pool d'un pilote
 *   _rjGetTransfersThisSeason()      → mouvements notables récents
 *   rjPoolDebug()                    → état du pool
 *   rjSimSeasonForGhosts()           → force la simulation des ghosts
 * ===================================================================== */

(function rjDriverPoolSystem() {
  if (typeof window === "undefined") return;
  if (window._rjDriverPoolInstalled) return;
  window._rjDriverPoolInstalled = true;

  /* ====================================================================
   * 1. CONFIGURATION
   * ================================================================= */

  // Ordre des catégories pour les promotions
  var PROMOTION_LADDER = [
    "Karting Junior",
    "Karting Senior",
    "Formule 4",
    "Formula Regional",
    "Formule 3",
    "Formule 2",
    "Formule 1"
  ];

  // Catégories alternatives (sortie de la ladder principale)
  var ALT_CATEGORIES = ["Super Formula", "Endurance WEC", "IndyCar"];

  // Caps de skill par catégorie (réutilisés du module 04k)
  var CAT_SKILL_CAP = {
    "Karting Junior":   78,
    "Karting Senior":   82,
    "Formule 4":        84,
    "Formula Regional": 86,
    "Formule 3":        88,
    "Formule 2":        90,
    "Formule 1":        94,
    "Super Formula":    92,
    "Endurance WEC":    91,
    "IndyCar":          93
  };

  // Âges typiques par cat (min, max raisonnables)
  var CAT_AGE_RANGES = {
    "Karting Junior":   [11, 15],
    "Karting Senior":   [14, 17],
    "Formule 4":        [15, 19],
    "Formula Regional": [16, 21],
    "Formule 3":        [17, 23],
    "Formule 2":        [19, 25],
    "Formule 1":        [19, 38],
    "Super Formula":    [22, 35],
    "Endurance WEC":    [23, 45],
    "IndyCar":          [21, 40]
  };

  // Archétypes de progression (peak age, durée plateau, déclin rate)
  var ARCHETYPES = {
    prodige:        { weight: 25, peakAge: 24, plateau: 4, declineRate: 1.2, peakBonus: 6 },
    steady:         { weight: 50, peakAge: 28, plateau: 5, declineRate: 1.0, peakBonus: 4 },
    late_bloomer:   { weight: 15, peakAge: 31, plateau: 4, declineRate: 0.8, peakBonus: 5 },
    wonderkid_fade: { weight: 10, peakAge: 21, plateau: 2, declineRate: 0.6, peakBonus: 8 }
  };

  // Quotas par catégorie (= nb de pilotes en course, en plus du joueur)
  // Valeurs basées sur CAT_PILOTS du jeu réel
  var CAT_QUOTAS = {
    "Karting Junior":   19,
    "Karting Senior":   19,
    "Formule 4":        23,
    "Formula Regional": 23,
    "Formule 3":        29,
    "Formule 2":        21,
    "Formule 1":        19,
    "Super Formula":    19,
    "Endurance WEC":    19,
    "IndyCar":          26
  };

  // Probabilités de mouvement en fin de saison
  var MOVEMENT_PROBS = {
    // Top 10% d'une cat → promotion presque sûre (sauf F1)
    topPromote:    0.85,
    // Mid-top (10-25%) → promotion possible
    midPromote:    0.40,
    // Mid-bottom (25-75%) → reste
    stayProb:      0.85,
    // Bas de classement (75-90%) → reste ou descente possible
    botStayProb:   0.55,
    // Lanterne (>90%) → descente quasi sûre
    lastDescent:   0.65,
    // Probabilité retraite (modulée par âge)
    retireBase:    0.05
  };

  /* ====================================================================
   * 2. UTILITAIRES POOL
   * ================================================================= */

  function _rjEnsurePool() {
    if (typeof G === "undefined" || !G) return;
    if (G.driverPool && Array.isArray(G.driverPool)) return;
    
    G.driverPool = [];
    G._rjPoolInitialized = false;
  }

  function _rjPoolPickArchetype() {
    var roll = Math.random() * 100;
    var acc = 0;
    var keys = Object.keys(ARCHETYPES);
    for (var i = 0; i < keys.length; i++) {
      acc += ARCHETYPES[keys[i]].weight;
      if (roll < acc) return keys[i];
    }
    return "steady";
  }

  function _rjPickAgeForCat(cat) {
    var range = CAT_AGE_RANGES[cat] || [18, 30];
    return range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1));
  }

  function _rjGenerateUniqueId(name) {
    // ID unique pour un pilote (utilisé pour persistence)
    var seed = (name || "?") + "_" + Date.now() + "_" + Math.random();
    var hash = 0;
    for (var i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    return "drv_" + Math.abs(hash).toString(36);
  }

  /* ====================================================================
   * 3. INITIALISATION DU POOL
   *
   * Appelé une seule fois au début (S1). Crée le pool depuis les rosters
   * prédéfinis du legacy initRivals (qu'on doit lire sans appeler la
   * fonction).
   * ================================================================= */

  // Le legacy initRivals contient les rosters en variable locale `e` non
  // exposée. On extrait ces données au runtime en parsant le source de
  // initRivals (1x au démarrage), puis on stocke en cache.
  var _rjCachedRosters = null;
  var _rjOrigInitRivalsRef = null;  // Référence à la fonction LEGACY (avant wrap)

  function _rjExtractLegacyRosters() {
    if (_rjCachedRosters) return _rjCachedRosters;
    
    // On utilise PRIORITAIREMENT la référence sauvegardée à la fonction
    // legacy. Sinon on tombe sur la version wrappée qui ne contient pas
    // les rosters.
    var srcFn = _rjOrigInitRivalsRef || (typeof window !== "undefined" ? window.initRivals : null);
    if (typeof srcFn !== "function") return null;
    
    var src = srcFn.toString();
    
    // Parse approximatif : pour chaque catégorie connue, extrait son tableau
    // Format : "Karting Junior":[{p:"...",n:"...",f:"..",sk:..,co:..},...]
    var rosters = {};
    var allCats = PROMOTION_LADDER.concat(ALT_CATEGORIES);
    
    allCats.forEach(function(cat) {
      var pos = -1;
      // Essaye plusieurs formats : "Cat":[, "Cat": [, Cat:[ (sans guillemets, ex IndyCar)
      var keysToTry = [
        '"' + cat + '":[',
        '"' + cat + '": [',
        cat.replace(/\s/g, "") + ':[',
        cat.replace(/\s/g, "") + ': ['
      ];
      var keyUsed = null;
      for (var ki = 0; ki < keysToTry.length; ki++) {
        var p = src.indexOf(keysToTry[ki]);
        if (p >= 0) { pos = p; keyUsed = keysToTry[ki]; break; }
      }
      if (pos < 0) return;
      
      // Trouve la fin du tableau
      var bracketDepth = 1;
      var i = pos + keyUsed.length;
      while (i < src.length && bracketDepth > 0) {
        if (src[i] === '[') bracketDepth++;
        else if (src[i] === ']') bracketDepth--;
        i++;
      }
      
      var arrText = src.substring(pos + keyUsed.length, i - 1);
      // Parse les entries {p:"...",n:"...",f:"...",sk:NN,co:N.NN}
      // Tolère espaces autour des virgules
      var entries = [];
      var entryRegex = /\{\s*p\s*:\s*"([^"]*)"\s*,\s*n\s*:\s*"([^"]*)"\s*,\s*f\s*:\s*"([^"]*)"\s*,\s*sk\s*:\s*(\d+(?:\.\d+)?)\s*,\s*co\s*:\s*(\.?\d+(?:\.\d+)?)\s*\}/g;
      var m;
      while ((m = entryRegex.exec(arrText)) !== null) {
        entries.push({
          p: m[1], n: m[2], f: m[3],
          sk: parseFloat(m[4]),
          co: parseFloat(m[5])
        });
      }
      
      if (entries.length > 0) rosters[cat] = entries;
    });
    
    _rjCachedRosters = rosters;
    return rosters;
  }

  function _rjInitializePoolFromRosters() {
    if (typeof G === "undefined" || !G) return;
    _rjEnsurePool();
    if (G._rjPoolInitialized) return;
    
    var rosters = _rjExtractLegacyRosters();
    if (!rosters) {
      console.warn("[RJ Pool] Impossible d'extraire les rosters legacy");
      return;
    }
    
    var pool = [];
    var allCats = PROMOTION_LADDER.concat(ALT_CATEGORIES);
    
    allCats.forEach(function(cat) {
      var roster = rosters[cat] || [];
      roster.forEach(function(e) {
        var fullName = (e.p ? e.p + " " : "") + (e.n || e.p || "?");
        // Évite les doublons (un pilote ne peut être que dans une cat à la fois)
        if (pool.some(function(p) { return p.name === fullName; })) return;
        
        // Le boostedSkill du legacy ajoute un bonus par cat
        var boostedSk = e.sk;
        if (typeof window._boostedSkill === "function") {
          try { boostedSk = window._boostedSkill(e.sk, cat); } catch(err) { boostedSk = e.sk; }
        }
        
        pool.push({
          id:           _rjGenerateUniqueId(fullName),
          name:         fullName,
          firstName:    e.p,
          lastName:     e.n,
          nat:          e.f || "FR",
          // Stats actuelles
          skill:        boostedSk,
          consistency:  e.co,
          // Cat actuelle
          cat:          cat,
          team:         null,
          // Archétype et potentiel
          archetype:    _rjPoolPickArchetype(),
          potential:    Math.min(99, e.sk + 15 + Math.floor(Math.random() * 10)),
          // Âge initial (cohérent avec la cat)
          age:          _rjPickAgeForCat(cat),
          // Stats permanentes
          baseSkill:    e.sk,  // skill brut original
          baseConsistency: e.co,
          // Historique
          history:      [],  // [{ saison, cat, team, finalPos, points, wins, podiums }]
          // Méta
          createdSaison: G.saison || 1,
          retired:      false
        });
      });
    });
    
    G.driverPool = pool;
    G._rjPoolInitialized = true;
    G._rjPoolVersion = 1;
    
    if (window._rjVerbose) {
      console.log("[RJ Pool] Pool initialisé : " + pool.length + " pilotes");
      var byCat = {};
      pool.forEach(function(p) { byCat[p.cat] = (byCat[p.cat] || 0) + 1; });
      console.log("[RJ Pool] Distribution :", byCat);
    }
  }

  /* ====================================================================
   * 4. SYNC G.rivals ← POOL
   *
   * Construit G.rivals à partir du pool filtré par G.cat.
   * ================================================================= */

  function _rjSyncRivalsFromPool() {
    if (typeof G === "undefined" || !G || !G.driverPool) return false;
    
    var quota = CAT_QUOTAS[G.cat] || 19;
    var teams = (typeof TEAMS_BY_CAT !== "undefined" && TEAMS_BY_CAT && TEAMS_BY_CAT[G.cat]) || [];
    var hasTeams = teams.length > 0;
    
    // Filtre les pilotes de la cat actuelle, non retraités
    var poolDrivers = G.driverPool.filter(function(p) {
      return p.cat === G.cat && !p.retired;
    });
    
    // Si pas assez, on génère des "rookies" pour combler
    while (poolDrivers.length < quota) {
      var rookie = _rjGenerateRookie(G.cat);
      G.driverPool.push(rookie);
      poolDrivers.push(rookie);
    }
    
    // Tri par skill décroissant pour assignation aux teams (top → top team)
    // MAIS avec un boost pour les "alumni" : pilotes qui ont déjà couru avec
    // le joueur (history non vide) — ils ont priorité même si skill légèrement
    // inférieur, car la continuité narrative compte.
    poolDrivers.sort(function(a, b) {
      // Calcul du skill effectif pour le tri
      var skillA = a.skill;
      var skillB = b.skill;
      // Boost alumni : +3 skill au tri si le pilote a déjà eu une saison
      if (a.history && a.history.length > 0) skillA += 3;
      if (b.history && b.history.length > 0) skillB += 3;
      return skillB - skillA;
    });
    
    // Assignment teams (1 ou 2 par team selon CAT_QUOTAS)
    var teamSlots = [];
    if (hasTeams) {
      teams.forEach(function(t) {
        teamSlots.push({ team: t, filled: 0 });
        teamSlots.push({ team: t, filled: 0 });  // 2 slots par team par défaut
      });
      
      // Si la team du joueur est dans cette cat, on réserve 1 slot pour le joueur
      var playerTeam = G.currentTeam;
      if (playerTeam && playerTeam !== "Indépendant" && playerTeam !== "Independant") {
        var slot = teamSlots.find(function(s) { return s.team === playerTeam; });
        if (slot) slot.filled = 1;  // marqué comme occupé par le joueur
      }
    }
    
    // Construit G.rivals
    G.rivals = [];
    var teamIdx = 0;
    
    for (var i = 0; i < poolDrivers.length && i < quota; i++) {
      var d = poolDrivers[i];
      
      // Trouver une team libre
      var assignedTeam = null;
      if (hasTeams) {
        // Cherche le prochain slot libre
        for (var ti = 0; ti < teamSlots.length; ti++) {
          var s = teamSlots[(teamIdx + ti) % teamSlots.length];
          if (s.filled === 0) {
            assignedTeam = s.team;
            s.filled = 2;  // 2 = occupé par un rival
            teamIdx = (teamIdx + ti + 1) % teamSlots.length;
            break;
          }
        }
      }
      
      // Met à jour la team du pool
      d.team = assignedTeam;
      
      G.rivals.push({
        name:         d.name,
        nat:          d.nat,
        pts:          0,
        skill:        d.skill,
        consistency:  d.consistency,
        lastPos:      0,
        team:         assignedTeam,
        qualiHistory: [],
        raceHistory: [],
        // Référence vers le pool (pour les modules qui veulent y accéder)
        _poolId:      d.id,
        _poolRef:     d  // pas sérialisé (cycle), retiré au save si besoin
      });
    }
    
    return true;
  }

  /* ====================================================================
   * 5. GÉNÉRATION DE ROOKIES
   *
   * Pour combler le pool quand des pilotes sont retraités/manquants.
   * ================================================================= */

  // Pools de noms réalistes (mix de nationalités F1)
  var ROOKIE_FIRST_NAMES = [
    "Lucas","Mateo","Hugo","Tom","Léo","Liam","Noah","Ethan","Antoine","Maxime",
    "Theo","Marco","Luca","Andrea","Pietro","Niccolò","Gabriele",
    "Felix","Tobias","Lukas","Erik","Max","Sebastian",
    "Carlos","Pablo","Diego","Javier","Mario",
    "Pedro","Bruno","Lucas","Felipe","Rafael",
    "Ryo","Yuki","Kenta","Hayato","Shun",
    "Oliver","James","Harry","Charlie","Lewis",
    "Aleksandr","Dmitri","Nikita",
    "Kim","Min-jun","Joon","Hyun"
  ];
  var ROOKIE_LAST_NAMES = [
    "Martinez","Gonzalez","Garcia","Lopez","Sanchez","Ferrari","Rossi","Bianchi","Conti","Russo",
    "Schmidt","Müller","Weber","Schulz","Becker",
    "Silva","Santos","Costa","Pereira",
    "Tanaka","Sato","Suzuki","Yamamoto","Kobayashi",
    "Smith","Jones","Brown","Wilson","Taylor",
    "Petrov","Volkov","Sokolov",
    "Park","Kim","Lee","Choi"
  ];
  var ROOKIE_NATS = ["IT","DE","ES","BR","JP","GB","FR","NL","BE","FI","DK","PL","RU","KR","US","AU","MX"];

  function _rjGenerateRookie(cat) {
    var range = CAT_AGE_RANGES[cat] || [18, 25];
    var firstName = ROOKIE_FIRST_NAMES[Math.floor(Math.random() * ROOKIE_FIRST_NAMES.length)];
    var lastName = ROOKIE_LAST_NAMES[Math.floor(Math.random() * ROOKIE_LAST_NAMES.length)];
    var fullName = firstName + " " + lastName;
    
    // Évite de doublonner
    if (typeof G !== "undefined" && G && G.driverPool) {
      var attempts = 0;
      while (G.driverPool.some(function(p) { return p.name === fullName; }) && attempts < 20) {
        firstName = ROOKIE_FIRST_NAMES[Math.floor(Math.random() * ROOKIE_FIRST_NAMES.length)];
        lastName = ROOKIE_LAST_NAMES[Math.floor(Math.random() * ROOKIE_LAST_NAMES.length)];
        fullName = firstName + " " + lastName;
        attempts++;
      }
      // Si encore doublon, ajoute un suffixe
      if (G.driverPool.some(function(p) { return p.name === fullName; })) {
        fullName += " Jr";
      }
    }
    
    // Skill : un peu en-dessous de la moyenne de la cat (rookie)
    var cap = CAT_SKILL_CAP[cat] || 90;
    var baseSkill = Math.max(40, cap - 18 - Math.floor(Math.random() * 8));
    
    return {
      id:              _rjGenerateUniqueId(fullName),
      name:            fullName,
      firstName:       firstName,
      lastName:        lastName,
      nat:             ROOKIE_NATS[Math.floor(Math.random() * ROOKIE_NATS.length)],
      skill:           baseSkill,
      consistency:     0.65 + Math.random() * 0.20,
      cat:             cat,
      team:            null,
      archetype:       _rjPoolPickArchetype(),
      potential:       Math.min(99, baseSkill + 15 + Math.floor(Math.random() * 10)),
      age:             range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1)),
      baseSkill:       baseSkill,
      baseConsistency: 0.65 + Math.random() * 0.20,
      history:         [],
      createdSaison:   (G && G.saison) || 1,
      retired:         false,
      _isRookie:       true
    };
  }

  /* ====================================================================
   * 6. ÉVOLUTION DES SKILLS (selon archétype)
   * ================================================================= */

  function _rjEvolveSkill(driver) {
    var arch = ARCHETYPES[driver.archetype] || ARCHETYPES.steady;
    var age = driver.age;
    var peakAge = arch.peakAge;
    var plateau = arch.plateau;
    var declineRate = arch.declineRate;
    
    var delta = 0;
    
    if (age < peakAge - plateau) {
      // Phase montée — progression rapide
      var distToPeak = peakAge - plateau - age;
      // Plus on est loin du peak, plus on progresse vite
      var progress = 1 + Math.min(3, distToPeak * 0.3);
      delta = Math.round(progress + (Math.random() - 0.3) * 1.5);
    } else if (age <= peakAge + plateau) {
      // Plateau — légère progression possible
      delta = Math.random() < 0.4 ? 1 : 0;
      if (Math.random() < 0.10) delta += 1;  // saison breakout
      if (Math.random() < 0.05) delta -= 1;  // saison déçue
    } else {
      // Déclin — perd des points progressivement
      var yearsAfterPlateau = age - peakAge - plateau;
      var declineMagnitude = Math.min(3, yearsAfterPlateau * 0.5 * declineRate);
      delta = -Math.round(declineMagnitude * (0.5 + Math.random() * 0.5));
    }
    
    // Cap au potentiel max et au cap de catégorie
    var capCat = CAT_SKILL_CAP[driver.cat] || 99;
    var newSkill = Math.max(40, Math.min(driver.potential, capCat, driver.skill + delta));
    
    driver.skill = newSkill;
    return delta;
  }

  function _rjEvolveConsistency(driver) {
    // La consistency évolue moins vite, plus tôt vers la stabilisation
    var age = driver.age;
    var current = driver.consistency || 0.75;
    
    if (age < 20) {
      // Jeune : consistency monte avec l'expérience
      driver.consistency = Math.min(0.95, current + (Math.random() < 0.5 ? 0.02 : 0));
    } else if (age < 30) {
      // Pic d'expérience : peu de changement
      driver.consistency = Math.min(0.95, Math.max(0.55, current + (Math.random() - 0.5) * 0.02));
    } else {
      // Vieux : peut perdre de la concentration
      driver.consistency = Math.min(0.95, Math.max(0.55, current + (Math.random() < 0.3 ? -0.02 : 0)));
    }
  }

  /* ====================================================================
   * 7. SIMULATION GHOST DRIVERS (rivaux pas dans ta cat)
   *
   * Pour les pilotes qui ne sont pas dans la cat du joueur, on simule
   * leur saison rapidement (sans tour par tour) pour calculer points,
   * position finale, et déterminer s'ils montent/descendent.
   * ================================================================= */

  function _rjSimulateGhostSeason(driver) {
    // Simule N courses pour ce pilote dans sa cat
    var cat = driver.cat;
    var raceCount = 10;  // approximation
    
    // Score moyen attendu (skill + consistency + un peu de noise)
    var baseScore = driver.skill / 100;
    
    // Position attendue : on compare au reste du pool dans cette cat
    var sameCategoryDrivers = G.driverPool.filter(function(p) {
      return p.cat === cat && !p.retired && p.id !== driver.id;
    });
    
    if (sameCategoryDrivers.length === 0) {
      driver._ghostSimResult = { pos: 1, points: 250, wins: raceCount, podiums: raceCount };
      return;
    }
    
    // Calcule un classement moyen basé sur skill+consistency
    var allScores = sameCategoryDrivers.map(function(p) {
      return p.skill / 100 + (Math.random() - 0.5) * 0.05;
    });
    allScores.push(baseScore + (Math.random() - 0.5) * 0.05);
    allScores.sort(function(a, b) { return b - a; });
    
    var myAvgPos = allScores.indexOf(baseScore + (allScores[allScores.length - 1] - baseScore)) + 1;
    // Approximation simple : le rang basé sur le skill
    sameCategoryDrivers.push(driver);
    sameCategoryDrivers.sort(function(a, b) { return b.skill - a.skill; });
    var myRank = sameCategoryDrivers.findIndex(function(p) { return p.id === driver.id; }) + 1;
    
    // Mais avec variabilité (les rivaux ne finissent pas tous strictement par skill)
    // On ajoute un offset aléatoire
    var posVariance = Math.floor((Math.random() - 0.5) * 4);
    var avgPos = Math.max(1, Math.min(sameCategoryDrivers.length, myRank + posVariance));
    
    // Points selon position moyenne
    var PTS_TABLE = [25,18,15,12,10,8,6,4,2,1,0,0,0,0,0,0,0,0,0,0];
    var avgPoints = PTS_TABLE[avgPos - 1] || 0;
    var totalPoints = avgPoints * raceCount;
    
    // Variabilité : parfois mieux, parfois pire
    totalPoints = Math.round(totalPoints * (0.85 + Math.random() * 0.30));
    
    var wins = avgPos === 1 ? Math.floor(raceCount * 0.4 + Math.random() * raceCount * 0.4) : 0;
    var podiums = avgPos <= 3 ? Math.floor(raceCount * 0.5) + wins : 0;
    
    driver._ghostSimResult = {
      pos: avgPos,
      points: totalPoints,
      wins: wins,
      podiums: podiums
    };
  }

  /* ====================================================================
   * 8. ÉVOLUTION DU POOL (fin de saison)
   *
   * Hook sur startNextSeason. Pour chaque pilote du pool :
   *   • Simule sa saison ghost (sauf joueur et rivaux actuels qui ont
   *     leurs vrais résultats dans G.rivals[i].pts)
   *   • Évolue ses skills selon archétype + âge
   *   • Décide promotion/descente/retraite
   *   • Récupère sa position en historique
   * ================================================================= */

  function _rjEvolvePoolAtSeasonEnd() {
    if (typeof G === "undefined" || !G || !G.driverPool) return;
    
    var prevSaison = G.saison || 1;
    var newSaison = prevSaison + 1;
    var transferLog = [];
    
    // 1. Récupère les résultats réels des rivaux du joueur (cat actuelle)
    if (G.rivals && G.rivals.length) {
      G.rivals.forEach(function(r) {
        if (!r._poolId) return;
        var poolDriver = G.driverPool.find(function(p) { return p.id === r._poolId; });
        if (poolDriver) {
          poolDriver._lastSeasonResult = {
            pos: r.lastPos || 99,
            points: r.pts || 0,
            wins: (r.raceHistory || []).filter(function(rh) { return rh.pos === 1; }).length,
            podiums: (r.raceHistory || []).filter(function(rh) { return rh.pos <= 3; }).length
          };
        }
      });
    }
    
    // 2. Simule les ghosts (pilotes dans d'autres cats)
    G.driverPool.forEach(function(d) {
      if (d.retired) return;
      if (d.cat === G.cat && d._lastSeasonResult) return;  // déjà eu son résultat réel
      _rjSimulateGhostSeason(d);
      d._lastSeasonResult = d._ghostSimResult;
    });
    
    // 3. Pour chaque cat, classe les pilotes par perf et décide promotions/descentes
    var allCats = PROMOTION_LADDER.slice();
    
    // On traite de F1 vers KJ pour libérer les baquets en haut d'abord
    for (var ci = allCats.length - 1; ci >= 0; ci--) {
      var cat = allCats[ci];
      var driversInCat = G.driverPool.filter(function(d) { return d.cat === cat && !d.retired; });
      if (driversInCat.length === 0) continue;
      
      // Tri par points décroissants (= classement final saison)
      driversInCat.sort(function(a, b) {
        var pa = (a._lastSeasonResult && a._lastSeasonResult.points) || 0;
        var pb = (b._lastSeasonResult && b._lastSeasonResult.points) || 0;
        return pb - pa;
      });
      
      var n = driversInCat.length;
      
      driversInCat.forEach(function(d, rank) {
        // Enregistre le résultat dans l'historique
        d.history.push({
          saison: prevSaison,
          cat: cat,
          team: d.team,
          finalPos: rank + 1,
          points: (d._lastSeasonResult && d._lastSeasonResult.points) || 0,
          wins: (d._lastSeasonResult && d._lastSeasonResult.wins) || 0,
          podiums: (d._lastSeasonResult && d._lastSeasonResult.podiums) || 0,
          age: d.age
        });
        
        // Évolution skill et âge
        var skillDelta = _rjEvolveSkill(d);
        _rjEvolveConsistency(d);
        d.age++;
        
        // Décision de promotion/descente
        var topPct = (rank + 1) / n;  // 0.05 = top 5%
        
        var shouldPromote = false;
        var shouldDescent = false;
        var shouldRetire = false;
        
        // Retraite : modulée par âge et résultats (sauf KJ/KS)
        if (cat !== "Karting Junior" && cat !== "Karting Senior") {
          // CORRECTIF — retireBase (5 %) s'appliquait à TOUT pilote de toute
          // catégorie non-karting, quel que soit son âge : un pilote de F4 de
          // 16 ans avait 5 % de raccrocher chaque saison. Sur quinze saisons
          // mesurées, le vivier passait de 205 pilotes actifs à 23 et la
          // grille de F1 tombait à zéro dès la saison 11. On ne prend pas sa
          // retraite à 16 ans : on descend d'un cran, ce que gère la logique
          // de descente juste en dessous. La base ne s'applique donc qu'à
          // partir d'un âge où raccrocher a un sens, et monte avec l'âge.
          var retireChance = (d.age >= 26) ? MOVEMENT_PROBS.retireBase : 0;
          if (d.age > 30) retireChance += (d.age - 30) * 0.02;
          if (d.age > 35) retireChance += (d.age - 35) * 0.05;  // +5% par an au-delà de 35
          if (d.age > 38) retireChance += 0.15;
          if (rank === n - 1 && d.age > 28) retireChance += 0.10;  // lanterne âgée
          if (Math.random() < retireChance) {
            shouldRetire = true;
          }
        }
        
        // Promotion / descente
        if (!shouldRetire) {
          var catIdx = allCats.indexOf(cat);
          
          if (catIdx < allCats.length - 1) {
            // Cat non-F1, peut monter
            if (topPct <= 0.10 && Math.random() < MOVEMENT_PROBS.topPromote) {
              shouldPromote = true;
            } else if (topPct <= 0.25 && Math.random() < MOVEMENT_PROBS.midPromote) {
              shouldPromote = true;
            }
          }
          
          // Descente possible (sauf KJ déjà en bas)
          if (catIdx > 0 && !shouldPromote) {
            if (topPct >= 0.90 && Math.random() < MOVEMENT_PROBS.lastDescent) {
              shouldDescent = true;
            } else if (topPct >= 0.75 && Math.random() < (1 - MOVEMENT_PROBS.botStayProb)) {
              shouldDescent = true;
            }
          }
        }
        
        // Applique la décision
        var oldCat = d.cat;
        if (shouldRetire) {
          d.retired = true;
          d.retirementSaison = newSaison;
        } else if (shouldPromote) {
          var newCatIdx = allCats.indexOf(cat) + 1;
          var newCat = allCats[newCatIdx];
          d.cat = newCat;
          
          transferLog.push({
            type: "promotion",
            driver: d,
            fromCat: oldCat,
            toCat: newCat,
            saison: newSaison,
            notable: newCat === "Formule 1" || newCat === "Formule 2"
          });
        } else if (shouldDescent) {
          var descCatIdx = allCats.indexOf(cat) - 1;
          if (descCatIdx >= 0) {
            var descCat = allCats[descCatIdx];
            d.cat = descCat;
            
            transferLog.push({
              type: "descent",
              driver: d,
              fromCat: oldCat,
              toCat: descCat,
              saison: newSaison,
              notable: oldCat === "Formule 1"
            });
          }
        }
        
        // Cleanup
        delete d._lastSeasonResult;
        delete d._ghostSimResult;
      });
    }
    
    // 4. Stocke le log de transferts pour la saison entrante
    G._rjTransferLog = G._rjTransferLog || [];
    G._rjTransferLog.push({ saison: newSaison, transfers: transferLog });
    if (G._rjTransferLog.length > 5) G._rjTransferLog.shift();  // garde 5 saisons
    
    // 5. Push notifications presse pour les transferts notables
    _rjPushNotableTransfers(transferLog);
    
    if (window._rjVerbose) {
      console.log("[RJ Pool] Évolution saison " + prevSaison + " → " + newSaison);
      console.log("  Transferts :", transferLog.length, "(notables :", transferLog.filter(function(t) { return t.notable; }).length + ")");
    }
  }

  /* ====================================================================
   * 9. NOTIFICATIONS PRESSE POUR TRANSFERTS NOTABLES
   * ================================================================= */

  function _rjPushNotableTransfers(transferLog) {
    if (!transferLog || transferLog.length === 0) return;
    if (typeof pushMail !== "function") return;
    
    var notable = transferLog.filter(function(t) { return t.notable; });
    if (notable.length === 0) return;
    
    notable.slice(0, 3).forEach(function(t) {  // limite à 3 messages par saison
      var subject, body;
      var driverName = t.driver.name;
      
      if (t.type === "promotion") {
        if (t.toCat === "Formule 1") {
          subject = "📰 " + driverName + " accède à la F1 !";
          body = driverName + " a décroché un baquet en F1 pour la saison " + t.saison + 
                 ". Une promotion attendue après ses performances en " + t.fromCat + ".";
        } else if (t.toCat === "Formule 2") {
          subject = "📰 " + driverName + " monte en F2";
          body = driverName + " a été promu en F2 pour " + t.saison + ". L'antichambre de la F1 lui ouvre les portes.";
        }
      } else if (t.type === "descent") {
        subject = "📰 " + driverName + " perd son baquet F1";
        body = driverName + " ne fera pas la saison " + t.saison + " en F1. Une saison difficile qui le pousse vers la F2.";
      }
      
      if (subject) {
        try {
          pushMail({
            from: "Presse — Paddock Insider",
            subject: subject,
            body: body,
            isPress: true
          });
        } catch(e) {
          // Silencieux : pushMail peut avoir une signature différente
        }
      }
    });
  }

  /* ====================================================================
   * 10. RÉTRO-CONSTRUCTION (carrière déjà commencée sans pool)
   *
   * Si l'utilisateur charge une sauvegarde S5+ qui n'a pas de driverPool,
   * on en construit un plausible à partir des G.rivals actuels et des
   * rosters legacy.
   * ================================================================= */

  function _rjRetroBuildPool() {
    if (typeof G === "undefined" || !G) return false;
    if (G.driverPool && G._rjPoolInitialized) return false;  // déjà fait
    
    _rjEnsurePool();
    
    // 1. Initialise depuis les rosters
    _rjInitializePoolFromRosters();
    
    // 2. Si saison > 1, on simule l'évolution du pool jusqu'à la saison actuelle
    var currentSaison = G.saison || 1;
    
    if (currentSaison > 1 && G._rjPoolInitialized) {
      // Sauve la cat actuelle
      var realSaison = G.saison;
      var realCat = G.cat;
      
      // Simule l'évolution depuis S1 à saison-1
      G.saison = 1;
      for (var s = 1; s < realSaison; s++) {
        try {
          _rjEvolvePoolAtSeasonEnd();
          G.saison = s + 1;
        } catch(e) {
          if (window._rjVerbose) console.warn("[RJ Pool] Rétro-build erreur saison " + s + " :", e.message);
        }
      }
      
      // Restaure
      G.saison = realSaison;
      G.cat = realCat;
    }
    
    // 3. Synchronise les rivaux actuels avec le pool (matche par nom)
    if (G.rivals && G.rivals.length) {
      G.rivals.forEach(function(r) {
        var poolDriver = G.driverPool.find(function(p) { return p.name === r.name; });
        if (poolDriver) {
          // Sync les valeurs actuelles du rival vers le pool
          poolDriver.cat = G.cat;
          poolDriver.skill = r.skill;
          poolDriver.consistency = r.consistency;
          poolDriver.team = r.team;
          r._poolId = poolDriver.id;
          r._poolRef = poolDriver;
        }
      });
    }
    
    if (window._rjVerbose) {
      console.log("[RJ Pool] Rétro-construction terminée pour S" + currentSaison);
    }
    return true;
  }

  /* ====================================================================
   * 11. WRAPPERS
   * ================================================================= */

  function _rjInstallInitRivalsWrapper() {
    if (typeof window.initRivals !== "function") return false;
    if (window._rjPoolInitRivalsWrapperInstalled) return true;
    window._rjPoolInitRivalsWrapperInstalled = true;
    
    var origInitRivals = window.initRivals;
    _rjOrigInitRivalsRef = origInitRivals;  // Sauvegarde pour _rjExtractLegacyRosters
    
    window.initRivals = function rjPoolWrappedInitRivals() {
      // Si pool pas initialisé, on initialise (1ère fois)
      if (typeof G === "undefined" || !G) {
        return origInitRivals.apply(this, arguments);
      }
      
      _rjEnsurePool();
      
      if (!G._rjPoolInitialized) {
        // Premier appel : initialise le pool
        _rjInitializePoolFromRosters();
      }
      
      // Si après init le pool est toujours vide, fallback legacy
      if (!G.driverPool || G.driverPool.length === 0) {
        return origInitRivals.apply(this, arguments);
      }
      
      // Sync G.rivals depuis le pool
      var ok = _rjSyncRivalsFromPool();
      if (!ok) {
        // Fallback legacy en cas d'échec
        return origInitRivals.apply(this, arguments);
      }
      
      // Pas de retour value
    };
    return true;
  }

  function _rjInstallStartNextSeasonWrapper() {
    if (typeof window.startNextSeason !== "function") return false;
    if (window._rjPoolStartNextSeasonWrapperInstalled) return true;
    window._rjPoolStartNextSeasonWrapperInstalled = true;
    
    var origStartNextSeason = window.startNextSeason;
    window.startNextSeason = function rjPoolWrappedStartNextSeason() {
      // Avant le startNextSeason legacy : évolue le pool
      if (typeof G !== "undefined" && G && G.driverPool && G._rjPoolInitialized) {
        try {
          _rjEvolvePoolAtSeasonEnd();
        } catch(e) {
          if (window._rjVerbose) console.warn("[RJ Pool] Évolution :", e.message);
        }
      }
      
      // Appelle legacy (qui appellera initRivals via notre wrapper)
      return origStartNextSeason.apply(this, arguments);
    };
    return true;
  }

  /* ====================================================================
   * 12. API PUBLIQUE
   * ================================================================= */

  window._rjGetDriverHistory = function(name) {
    if (typeof G === "undefined" || !G || !G.driverPool) return null;
    var d = G.driverPool.find(function(p) { return p.name === name; });
    if (!d) return null;
    return {
      name: d.name,
      nat: d.nat,
      currentCat: d.cat,
      currentTeam: d.team,
      age: d.age,
      skill: d.skill,
      archetype: d.archetype,
      retired: d.retired,
      history: d.history.slice()
    };
  };

  window._rjGetAlumniInCurrentCat = function() {
    // Pilotes dans la cat actuelle qui étaient déjà dans une cat précédente avec le joueur
    if (typeof G === "undefined" || !G || !G.driverPool || !G.cat) return [];
    var alumni = G.driverPool.filter(function(p) {
      if (p.cat !== G.cat || p.retired) return false;
      // Au moins une saison où il était dans la même cat que le joueur
      // On approxime : si son history contient une cat qui était la nôtre
      // (hypothèse : le joueur monte par PROMOTION_LADDER)
      return p.history.length >= 1;
    });
    return alumni;
  };

  window._rjGetDriverInPool = function(name) {
    if (typeof G === "undefined" || !G || !G.driverPool) return null;
    return G.driverPool.find(function(p) { return p.name === name; }) || null;
  };

  window._rjGetTransfersThisSeason = function() {
    if (typeof G === "undefined" || !G || !G._rjTransferLog) return [];
    var current = G._rjTransferLog[G._rjTransferLog.length - 1];
    return current ? current.transfers : [];
  };

  window.rjSimSeasonForGhosts = function() {
    if (typeof G === "undefined" || !G || !G.driverPool) {
      console.log("Pas de driverPool");
      return;
    }
    G.driverPool.forEach(function(d) {
      if (!d.retired && d.cat !== G.cat) _rjSimulateGhostSeason(d);
    });
    console.log("[RJ Pool] Ghost simulation done");
  };

  /* ====================================================================
   * 13. AUTO-INSTALLATION
   * ================================================================= */

  var attempts = 0, maxAttempts = 80;
  
  function _rjTryInstall() {
    attempts++;
    var irOK = _rjInstallInitRivalsWrapper();
    var snsOK = _rjInstallStartNextSeasonWrapper();
    
    if (irOK && snsOK) {
      // Si carrière déjà chargée sans pool, rétro-construit
      if (typeof G !== "undefined" && G && G.rivals && G.rivals.length && (!G.driverPool || G.driverPool.length === 0)) {
        try {
          _rjRetroBuildPool();
        } catch(e) {
          console.warn("[RJ Pool] Rétro-build a échoué :", e.message);
        }
      }
      
      console.log("[RJ Pool] Module Driver Pool chargé — continuité multi-saisons activée");
      return;
    }
    
    if (attempts >= maxAttempts) {
      var missing = [];
      if (!irOK) missing.push("initRivals");
      if (!snsOK) missing.push("startNextSeason");
      console.warn("[RJ Pool] Wrappers non posés : " + missing.join(", "));
      return;
    }
    
    if (typeof setTimeout !== "undefined") setTimeout(_rjTryInstall, 100);
  }
  
  _rjTryInstall();

  /* ====================================================================
   * 14. DEBUG
   * ================================================================= */

  window.rjPoolDebug = function() {
    console.log("=== Driver Pool ===");
    
    if (typeof G === "undefined" || !G) {
      console.log("Pas de G");
      return;
    }
    
    if (!G.driverPool) {
      console.log("Pas de driverPool — non initialisé");
      return;
    }
    
    var active = G.driverPool.filter(function(p) { return !p.retired; });
    var retired = G.driverPool.filter(function(p) { return p.retired; });
    
    console.log("Pool :", G.driverPool.length, "pilotes total");
    console.log("  Actifs :", active.length);
    console.log("  Retraités :", retired.length);
    console.log("  Pool initialisé :", G._rjPoolInitialized);
    
    var byCat = {};
    active.forEach(function(p) { byCat[p.cat] = (byCat[p.cat] || 0) + 1; });
    console.log("\nDistribution par catégorie :");
    PROMOTION_LADDER.concat(ALT_CATEGORIES).forEach(function(cat) {
      var n = byCat[cat] || 0;
      var quota = CAT_QUOTAS[cat] || 0;
      console.log("  " + cat.padEnd(20) + " : " + n + " / " + quota);
    });
    
    var byArch = {};
    active.forEach(function(p) { byArch[p.archetype] = (byArch[p.archetype] || 0) + 1; });
    console.log("\nDistribution archétypes :");
    Object.keys(byArch).forEach(function(a) {
      console.log("  " + a.padEnd(18) + " : " + byArch[a]);
    });
    
    // Top skills par cat
    if (G.cat) {
      console.log("\nTop 5 dans " + G.cat + " :");
      var inCat = active.filter(function(p) { return p.cat === G.cat; }).sort(function(a, b) { return b.skill - a.skill; });
      inCat.slice(0, 5).forEach(function(p) {
        var hist = p.history.length > 0 ? " · " + p.history.length + " saisons d'historique" : " · rookie";
        console.log("  " + p.name.padEnd(22) + " skill=" + p.skill + " age=" + p.age + " " + p.archetype + hist);
      });
    }
    
    // Transferts récents
    if (G._rjTransferLog && G._rjTransferLog.length > 0) {
      var last = G._rjTransferLog[G._rjTransferLog.length - 1];
      console.log("\nTransferts saison " + last.saison + " :", last.transfers.length);
      last.transfers.filter(function(t) { return t.notable; }).slice(0, 5).forEach(function(t) {
        console.log("  ★ " + t.driver.name + " : " + t.fromCat + " → " + t.toCat + " (" + t.type + ")");
      });
    }
    
    // Alumni
    var alumni = window._rjGetAlumniInCurrentCat();
    if (alumni.length > 0) {
      console.log("\n" + alumni.length + " pilotes avec historique dans " + G.cat);
    }
  };

  // Expose les fonctions internes pour test
  window._rjEvolvePoolAtSeasonEnd = _rjEvolvePoolAtSeasonEnd;
  window._rjInitializePoolFromRosters = _rjInitializePoolFromRosters;
  window._rjSyncRivalsFromPool = _rjSyncRivalsFromPool;
  window._rjRetroBuildPool = _rjRetroBuildPool;

})();
