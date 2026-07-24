/* =====================================================================
 * 04n-rival-form.js — FORM FACTOR PAR WEEK-END
 *
 * Donne à chaque rival un état de forme variable d'un GP à l'autre, pour
 * créer la variabilité réaliste qui manque. Sans ça, le top rival gagne
 * 100% des courses parce que skill+voiture est constant. Avec ça, un
 * outsider peut profiter d'un mauvais week-end du favori, comme en F1
 * réelle.
 *
 * 5 ÉTATS DE FORME (tirage par GP):
 *
 *   ⭐ Forme exceptionnelle  +0.07   ~10%
 *   ↗  Bonne forme          +0.035  ~25%
 *   →  Forme normale         0      ~30%
 *   ↘  Forme moyenne        -0.035  ~25%
 *   💀 Mauvais week-end     -0.07   ~10%
 *
 * Avec un score skill+voiture autour de 0.7-0.95 en F1, un swing de ±0.07
 * = environ ±10% de performance. Suffisant pour qu'un P3 finisse P10 ou
 * inversement, sans casser la hiérarchie globale.
 *
 * MÉCANIQUES :
 *
 *   1. WEEKEND FORM — généré au début de chaque GP, persiste qualif+course
 *   2. STREAK MOMENTUM — bonne forme tend à durer 2-3 GP (et inversement)
 *   3. TRACK SPECIALTY — chaque rival a un tracé fétiche (+0.025) et un
 *      tracé difficile (-0.025), tirés au hasard à l'init des rivaux
 *   4. CONSISTENCY MODULÉE — pilotes en mauvaise forme sont plus
 *      irréguliers (consistency réduite ce week-end)
 *
 * CAUSES NARRATIVES :
 *
 *   Chaque forme a une cause affichable :
 *   - "Setup parfait trouvé en essais"
 *   - "Confiance retrouvée après son podium"
 *   - "Problèmes de réglages depuis vendredi"
 *   - "Tracé qui ne lui convient pas"
 *   - etc.
 *
 * EXPOSE :
 *
 *   _rjGetRivalForm(rivalIdx)        → { form: -0.07..+0.07, label, cause, color }
 *   _rjGetTopFormRivals(n)           → top N rivaux en bonne forme ce GP
 *   _rjGetWorstFormRivals(n)         → top N rivaux en difficulté ce GP
 *   rjFormDebug()                    → état complet du form factor
 *   rjFormForceFor(rivalIdx, level)  → force un niveau pour test
 *
 * INTÉGRATION :
 *
 *   - Wrap startQual et runRaceLive pour appliquer/restorer
 *   - Hook sur _activeRivalryInRace pour enrichir les alertes rivalité
 *   - Cohabite avec 04g (radio team) sans modifier
 *   - Cohabite avec 04m (Safety Car) — le form n'affecte pas les SC
 *
 * Le joueur n'a PAS de form factor. Son `PILOT_MENTAL` (confiance,
 * pression, streaks) joue déjà ce rôle.
 * ===================================================================== */

(function rjRivalFormSystem() {
  if (typeof window === "undefined") return;
  if (window._rjRivalFormInstalled) return;
  window._rjRivalFormInstalled = true;

  /* ====================================================================
   * 1. CONFIGURATION
   * ================================================================= */

  // Distribution des niveaux de forme (poids cumulés = 100)
  var FORM_LEVELS = [
    { name: "exceptional", weight: 10, mod: 0.07,   label: "Forme exceptionnelle", icon: "⭐", color: "#34D399", consistencyDelta: +0.05 },
    { name: "good",        weight: 25, mod: 0.035,  label: "Bonne forme",          icon: "↗",  color: "#60A5FA", consistencyDelta: +0.02 },
    { name: "normal",      weight: 30, mod: 0,      label: "Forme normale",        icon: "→",  color: "#9CA3AF", consistencyDelta: 0     },
    { name: "average",     weight: 25, mod: -0.035, label: "En difficulté",        icon: "↘",  color: "#F59E0B", consistencyDelta: -0.04 },
    { name: "bad",         weight: 10, mod: -0.07,  label: "Week-end raté",        icon: "💀", color: "#EF4444", consistencyDelta: -0.08 }
  ];

  // Causes narratives par niveau
  var FORM_CAUSES = {
    exceptional: [
      "Setup parfait trouvé en essais",
      "Confiance retrouvée après son podium précédent",
      "Maîtrise totale du tracé",
      "Excellente préparation physique cette semaine",
      "Synergie parfaite avec son ingénieur",
      "Briefing du vendredi très convaincant"
    ],
    good: [
      "Bonne sensation dès les essais",
      "Setup proche de l'idéal",
      "Confort sur ce tracé",
      "Bonne récupération après le dernier GP",
      "Évolutions techniques qui lui conviennent"
    ],
    normal: [
      "Week-end standard",
      "Pas de problème particulier",
      "Performance attendue",
      ""
    ],
    average: [
      "Setup difficile à trouver",
      "Quelques soucis en essais libres",
      "Confiance entamée par le dernier GP",
      "Tracé qui ne lui réussit pas vraiment",
      "Légère méforme physique"
    ],
    bad: [
      "Problèmes de réglages depuis vendredi",
      "Petite blessure qui le gêne",
      "Tracé qui ne lui convient pas du tout",
      "Disputes avec son ingénieur de course",
      "Mauvaise nuit, manque de focus",
      "Crash en essais, voiture endommagée"
    ]
  };

  // Probabilité de momentum (rester dans la même forme au prochain GP)
  var STREAK_BONUS = 0.20;  // +20% de chance que la forme se prolonge

  // Bonus tracé fétiche / malus tracé difficile
  var TRACK_SPECIALTY_BONUS = 0.025;
  var TRACK_DIFFICULTY_PENALTY = -0.025;

  /* ====================================================================
   * 2. UTILITAIRES
   * ================================================================= */

  function _rjPickFormLevel(previousLevel) {
    // Tirage pondéré, avec bonus si le rival était dans la même forme avant
    var weights = FORM_LEVELS.map(function(l) {
      var w = l.weight;
      // Si on était dans la même catégorie au GP précédent (ou très proche),
      // on a un peu plus de chance de rester
      if (previousLevel) {
        if (l.name === previousLevel) w *= (1 + STREAK_BONUS);
        // Bonus pour les voisins (good ↔ exceptional, average ↔ bad)
        if (
          (previousLevel === "exceptional" && l.name === "good") ||
          (previousLevel === "good" && l.name === "exceptional") ||
          (previousLevel === "bad" && l.name === "average") ||
          (previousLevel === "average" && l.name === "bad")
        ) w *= (1 + STREAK_BONUS / 2);
      }
      return w;
    });
    
    var total = weights.reduce(function(s, w) { return s + w; }, 0);
    var roll = Math.random() * total;
    var acc = 0;
    for (var i = 0; i < FORM_LEVELS.length; i++) {
      acc += weights[i];
      if (roll < acc) return FORM_LEVELS[i];
    }
    return FORM_LEVELS[2]; // fallback normal
  }

  function _rjPickCause(levelName) {
    var pool = FORM_CAUSES[levelName] || [""];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function _rjGetCircuitName() {
    if (typeof getNextRace === "function") {
      try {
        var race = getNextRace();
        if (race && race.name) return race.name;
      } catch(e) {}
    }
    if (typeof RACE_STATE !== "undefined" && RACE_STATE && RACE_STATE.circuit) {
      return RACE_STATE.circuit;
    }
    return null;
  }

  function _rjGetCurrentRaceKey() {
    // Identifie un GP de manière unique : cat + saison + raceIndex
    if (typeof G === "undefined" || !G) return null;
    var raceIdx = (G.races && G.races.length) || 0;
    return G.cat + "_S" + (G.saison || 1) + "_R" + raceIdx;
  }

  /* ====================================================================
   * 3. INITIALISATION DES SPÉCIALITÉS DE TRACÉS
   *
   * Au premier appel pour un rival, on lui assigne un tracé fétiche et un
   * tracé difficile (depuis le calendrier de la saison). Ces specialities
   * persistent toute la saison.
   * ================================================================= */

  function _rjEnsureTrackSpecialties(rival) {
    if (rival._trackSpecialty && rival._trackDifficulty && rival._trackSpecialtySaison === G.saison) {
      return;  // déjà initialisé pour cette saison
    }
    
    // Récupère la liste des circuits de la saison
    var circuits = [];
    if (typeof CAL_RACES !== "undefined" && CAL_RACES && CAL_RACES.length) {
      CAL_RACES.forEach(function(r) {
        if (r && r.name && circuits.indexOf(r.name) < 0) circuits.push(r.name);
      });
    }
    if (circuits.length < 2) {
      // Pas assez de circuits, on skip
      rival._trackSpecialty = null;
      rival._trackDifficulty = null;
      rival._trackSpecialtySaison = G.saison;
      return;
    }
    
    // Pour assigner de façon stable, on hash le nom du rival + saison
    // pour avoir le même résultat à chaque réouverture
    var seed = (rival.name || "?") + "_" + (G.saison || 1);
    var hash = 0;
    for (var i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash |= 0;
    }
    var pos1 = Math.abs(hash) % circuits.length;
    var pos2 = Math.abs(hash >> 8) % circuits.length;
    while (pos2 === pos1 && circuits.length > 1) {
      pos2 = (pos2 + 1) % circuits.length;
    }
    
    rival._trackSpecialty = circuits[pos1];
    rival._trackDifficulty = circuits[pos2];
    rival._trackSpecialtySaison = G.saison;
  }

  /* ====================================================================
   * 4. GÉNÉRATION DU FORM POUR UN GP
   * ================================================================= */

  function _rjGenerateWeekendForm(rival, raceKey) {
    // Si déjà calculé pour ce GP, on retourne
    if (rival._weekendFormKey === raceKey) {
      return rival._weekendForm;
    }
    
    // Tracé spécialités (assignées si pas déjà fait pour cette saison)
    _rjEnsureTrackSpecialties(rival);
    
    // Tirage du niveau (avec influence du GP précédent)
    var prevLevel = rival._weekendFormLevel;
    var level = _rjPickFormLevel(prevLevel);
    
    // Cause narrative
    var cause = _rjPickCause(level.name);
    
    // Bonus/malus tracé
    var trackMod = 0;
    var trackNote = "";
    var currentCircuit = _rjGetCircuitName();
    if (currentCircuit && rival._trackSpecialty === currentCircuit) {
      trackMod += TRACK_SPECIALTY_BONUS;
      trackNote = "Tracé fétiche";
    } else if (currentCircuit && rival._trackDifficulty === currentCircuit) {
      trackMod += TRACK_DIFFICULTY_PENALTY;
      trackNote = "Tracé difficile pour lui";
    }
    
    // Modulation finale du form (le track mod est SÉPARÉ du form base)
    var totalMod = level.mod + trackMod;
    
    // Stocke l'état complet sur le rival
    rival._weekendFormKey = raceKey;
    rival._weekendForm = totalMod;
    rival._weekendFormLevel = level.name;
    rival._weekendFormLabel = level.label;
    rival._weekendFormIcon = level.icon;
    rival._weekendFormColor = level.color;
    rival._weekendFormCause = cause;
    rival._weekendFormBaseMod = level.mod;
    rival._weekendFormTrackMod = trackMod;
    rival._weekendFormTrackNote = trackNote;
    rival._weekendFormConsistencyDelta = level.consistencyDelta;
    
    return totalMod;
  }

  function _rjGenerateAllRivalsForm() {
    if (typeof G === "undefined" || !G || !G.rivals) return;
    var raceKey = _rjGetCurrentRaceKey();
    if (!raceKey) return;
    
    // Si déjà généré pour ce GP, skip
    if (G._rjFormGenForKey === raceKey) return;
    G._rjFormGenForKey = raceKey;
    
    G.rivals.forEach(function(rival) {
      _rjGenerateWeekendForm(rival, raceKey);
    });
    
    if (window._rjVerbose) {
      console.log("[RJ Form] Form généré pour " + raceKey + " (" + G.rivals.length + " rivaux)");
    }
  }

  /* ====================================================================
   * 5. APPLICATION DU FORM SUR LES SKILLS
   *
   * Stratégie : on patche temporairement skill et consistency au début de
   * la session (qualif ou course), on laisse le moteur faire son boulot,
   * puis on restore en fin de session.
   *
   * Skill : on convertit le form (qui est en unité de score, ~0.07 max) en
   * unité de skill (sur 100). Comme le moteur fait skill/100, un mod de
   * +0.07 sur le score = +7 points de skill équivalent.
   * ================================================================= */

  function _rjApplyFormToRivals() {
    if (typeof G === "undefined" || !G || !G.rivals) return;
    
    G.rivals.forEach(function(rival) {
      if (rival._weekendForm === undefined) return;
      
      // Sauvegarde des valeurs originales si pas déjà fait
      if (rival._origSkill === undefined) rival._origSkill = rival.skill;
      if (rival._origConsistency === undefined) rival._origConsistency = rival.consistency;
      
      // Applique le form au skill
      // mod 0.07 → +7 skill équivalent (pour matcher l'unité du score)
      var skillBonus = Math.round(rival._weekendForm * 100);
      rival.skill = Math.max(40, Math.min(99, rival._origSkill + skillBonus));
      
      // Applique le delta de consistency
      var consDelta = rival._weekendFormConsistencyDelta || 0;
      rival.consistency = Math.max(0.30, Math.min(1.0, rival._origConsistency + consDelta));
    });
    
    G._rjFormApplied = true;
  }

  function _rjRestoreFormFromRivals() {
    if (typeof G === "undefined" || !G || !G.rivals) return;
    if (!G._rjFormApplied) return;
    
    G.rivals.forEach(function(rival) {
      if (rival._origSkill !== undefined) {
        rival.skill = rival._origSkill;
        delete rival._origSkill;
      }
      if (rival._origConsistency !== undefined) {
        rival.consistency = rival._origConsistency;
        delete rival._origConsistency;
      }
    });
    
    G._rjFormApplied = false;
  }

  /* ====================================================================
   * 6. WRAPPERS — startQual et runRaceLive
   * ================================================================= */

  function _rjInstallStartQualWrapper() {
    if (typeof window.startQual !== "function") return false;
    if (window._rjFormStartQualWrapperInstalled) return true;
    window._rjFormStartQualWrapperInstalled = true;
    
    var origStartQual = window.startQual;
    window.startQual = function rjFormWrappedStartQual() {
      try {
        _rjGenerateAllRivalsForm();
        _rjApplyFormToRivals();
      } catch(e) {
        if (window._rjVerbose) console.warn("[RJ Form] Apply qualif :", e && e.message);
      }
      
      var result = origStartQual.apply(this, arguments);
      
      // Restore après que les drivers de QUALI_STATE aient été créés
      // (on a déjà appliqué, le legacy a lu, on peut restorer)
      try {
        _rjRestoreFormFromRivals();
      } catch(e) {
        if (window._rjVerbose) console.warn("[RJ Form] Restore qualif :", e && e.message);
      }
      
      return result;
    };
    return true;
  }

  function _rjInstallRunRaceLiveWrapper() {
    if (typeof window.runRaceLive !== "function") return false;
    if (window._rjFormRunRaceLiveWrapperInstalled) return true;
    window._rjFormRunRaceLiveWrapperInstalled = true;
    
    var origRunRaceLive = window.runRaceLive;
    window.runRaceLive = function rjFormWrappedRunRaceLive() {
      try {
        _rjGenerateAllRivalsForm();
        _rjApplyFormToRivals();
      } catch(e) {
        if (window._rjVerbose) console.warn("[RJ Form] Apply course :", e && e.message);
      }
      
      var result = origRunRaceLive.apply(this, arguments);
      
      // Restore APRÈS que LIVE_RACE.drivers ait été peuplé
      // (le moteur a lu skill et consistency, on peut restaurer les valeurs
      // originales pour ne pas polluer l'état long terme)
      try {
        _rjRestoreFormFromRivals();
      } catch(e) {
        if (window._rjVerbose) console.warn("[RJ Form] Restore course :", e && e.message);
      }
      
      return result;
    };
    return true;
  }

  /* ====================================================================
   * 7. API PUBLIQUE (pour UI / récap)
   * ================================================================= */

  window._rjGetRivalForm = function(rivalIdx) {
    if (typeof G === "undefined" || !G || !G.rivals) return null;
    var rival = G.rivals[rivalIdx];
    if (!rival || rival._weekendForm === undefined) return null;
    return {
      mod: rival._weekendForm,
      level: rival._weekendFormLevel,
      label: rival._weekendFormLabel,
      icon: rival._weekendFormIcon,
      color: rival._weekendFormColor,
      cause: rival._weekendFormCause,
      baseMod: rival._weekendFormBaseMod,
      trackMod: rival._weekendFormTrackMod,
      trackNote: rival._weekendFormTrackNote,
      consistencyDelta: rival._weekendFormConsistencyDelta
    };
  };

  window._rjGetTopFormRivals = function(n) {
    if (typeof G === "undefined" || !G || !G.rivals) return [];
    var ranked = G.rivals
      .map(function(r, idx) {
        return r._weekendForm !== undefined ? { rival: r, idx: idx, form: r._weekendForm } : null;
      })
      .filter(function(x) { return x !== null; })
      .sort(function(a, b) { return b.form - a.form; });
    return ranked.slice(0, n || 3).map(function(x) {
      return Object.assign({}, x, _rjGetRivalForm(x.idx));
    });
  };

  window._rjGetWorstFormRivals = function(n) {
    if (typeof G === "undefined" || !G || !G.rivals) return [];
    var ranked = G.rivals
      .map(function(r, idx) {
        return r._weekendForm !== undefined ? { rival: r, idx: idx, form: r._weekendForm } : null;
      })
      .filter(function(x) { return x !== null; })
      .sort(function(a, b) { return a.form - b.form; });
    return ranked.slice(0, n || 3).map(function(x) {
      return Object.assign({}, x, _rjGetRivalForm(x.idx));
    });
  };

  /* ====================================================================
   * 8. INTÉGRATION ALERTE RIVALITÉ
   *
   * Si une rivalité existante implique un rival en très bonne ou très
   * mauvaise forme, on enrichit l'alerte affichée en pré-course.
   *
   * Cherche `_activeRivalryInRace` dans le legacy pour accrocher.
   * ================================================================= */

  function _rjEnrichRivalryAlert() {
    // Cette fonction est appelée par le legacy via render rivalité.
    // On expose un helper que le legacy peut consommer (ou pas).
    // Pour ne pas casser le legacy, on installe un getter global.
    
    if (typeof window._rjGetRivalryFormHint === "undefined") {
      window._rjGetRivalryFormHint = function(rival) {
        if (!rival || rival._weekendForm === undefined) return null;
        var form = rival._weekendForm;
        if (form >= 0.05) {
          return {
            text: rival.name + " semble en grande forme ce week-end",
            color: rival._weekendFormColor || "#34D399",
            severity: "high"
          };
        } else if (form >= 0.02) {
          return {
            text: rival.name + " est plutôt en confiance ce week-end",
            color: rival._weekendFormColor || "#60A5FA",
            severity: "med"
          };
        } else if (form <= -0.05) {
          return {
            text: rival.name + " a un week-end compliqué",
            color: rival._weekendFormColor || "#EF4444",
            severity: "low"
          };
        } else if (form <= -0.02) {
          return {
            text: rival.name + " peine à trouver le rythme",
            color: rival._weekendFormColor || "#F59E0B",
            severity: "low-med"
          };
        }
        return null;
      };
    }
  }

  /* ====================================================================
   * 9. AUTO-INSTALLATION
   * ================================================================= */

  var attempts = 0, maxAttempts = 80;
  
  function _rjTryInstall() {
    attempts++;
    var sqOK = _rjInstallStartQualWrapper();
    var rrlOK = _rjInstallRunRaceLiveWrapper();
    
    if (sqOK && rrlOK) {
      _rjEnrichRivalryAlert();
      console.log("[RJ Form] Module Rival Form Factor chargé — variabilité week-end activée");
      return;
    }
    
    if (attempts >= maxAttempts) {
      var missing = [];
      if (!sqOK) missing.push("startQual");
      if (!rrlOK) missing.push("runRaceLive");
      console.warn("[RJ Form] Wrappers non posés : " + missing.join(", "));
      return;
    }
    
    if (typeof setTimeout !== "undefined") setTimeout(_rjTryInstall, 100);
  }
  
  _rjTryInstall();

  /* ====================================================================
   * 10. DEBUG
   * ================================================================= */

  window.rjFormDebug = function() {
    console.log("=== Rival Form Factor ===");
    
    if (typeof G === "undefined" || !G || !G.rivals) {
      console.log("Pas de G.rivals disponible");
      return;
    }
    
    var raceKey = _rjGetCurrentRaceKey();
    console.log("GP actuel :", raceKey);
    console.log("Form généré pour ce GP :", G._rjFormGenForKey === raceKey ? "✓" : "⚠ Non");
    console.log("");
    
    if (G._rjFormGenForKey !== raceKey) {
      console.log("Lance _rjGenerateAllRivalsForm() pour générer maintenant");
    }
    
    var withForm = G.rivals.filter(function(r) { return r._weekendForm !== undefined; });
    console.log("Rivaux avec form :", withForm.length + " / " + G.rivals.length);
    
    if (withForm.length === 0) return;
    
    // Distribution
    var dist = {};
    withForm.forEach(function(r) {
      dist[r._weekendFormLevel] = (dist[r._weekendFormLevel] || 0) + 1;
    });
    console.log("\nDistribution des niveaux :");
    FORM_LEVELS.forEach(function(l) {
      var n = dist[l.name] || 0;
      var pct = ((n / withForm.length) * 100).toFixed(0);
      console.log("  " + l.icon + " " + l.label.padEnd(28) + " " + n + " (" + pct + "% — cible " + l.weight + "%)");
    });
    
    // Top forme
    console.log("\nTop 5 en forme :");
    var top = withForm.slice().sort(function(a, b) { return b._weekendForm - a._weekendForm; });
    top.slice(0, 5).forEach(function(r) {
      console.log("  " + r._weekendFormIcon + " " + r.name.padEnd(20) + 
                  " mod=" + (r._weekendForm > 0 ? "+" : "") + r._weekendForm.toFixed(3) + 
                  " — " + r._weekendFormCause);
    });
    
    // Pire forme
    console.log("\n5 pires week-ends :");
    var bot = withForm.slice().sort(function(a, b) { return a._weekendForm - b._weekendForm; });
    bot.slice(0, 5).forEach(function(r) {
      console.log("  " + r._weekendFormIcon + " " + r.name.padEnd(20) + 
                  " mod=" + (r._weekendForm > 0 ? "+" : "") + r._weekendForm.toFixed(3) + 
                  " — " + r._weekendFormCause);
    });
    
    // Track specialties
    var withTrack = withForm.filter(function(r) { return r._trackSpecialty; });
    console.log("\nSpécialités tracé (" + withTrack.length + " rivaux) :");
    withTrack.slice(0, 5).forEach(function(r) {
      console.log("  " + r.name.padEnd(20) + " ★ " + r._trackSpecialty + " · ✗ " + r._trackDifficulty);
    });
    
    var current = _rjGetCircuitName();
    if (current) {
      console.log("\nCircuit actuel : " + current);
      var likes = withForm.filter(function(r) { return r._trackSpecialty === current; });
      var dislikes = withForm.filter(function(r) { return r._trackDifficulty === current; });
      console.log("  Pilotes qui kiffent ce tracé : " + likes.length);
      console.log("  Pilotes en galère sur ce tracé : " + dislikes.length);
    }
  };

  window.rjFormForceFor = function(rivalIdx, levelName) {
    if (typeof G === "undefined" || !G || !G.rivals) {
      console.log("Pas de G.rivals");
      return;
    }
    var rival = G.rivals[rivalIdx];
    if (!rival) {
      console.log("Rival index invalide");
      return;
    }
    var level = FORM_LEVELS.find(function(l) { return l.name === levelName; });
    if (!level) {
      console.log("Niveaux dispo: exceptional, good, normal, average, bad");
      return;
    }
    rival._weekendFormKey = _rjGetCurrentRaceKey();
    rival._weekendForm = level.mod;
    rival._weekendFormLevel = level.name;
    rival._weekendFormLabel = level.label;
    rival._weekendFormIcon = level.icon;
    rival._weekendFormColor = level.color;
    rival._weekendFormCause = _rjPickCause(level.name);
    rival._weekendFormBaseMod = level.mod;
    rival._weekendFormTrackMod = 0;
    rival._weekendFormTrackNote = "";
    rival._weekendFormConsistencyDelta = level.consistencyDelta;
    console.log("[RJ Form] " + rival.name + " forcé en " + level.label);
  };

  // Expose la fonction de génération pour les tests
  window._rjGenerateAllRivalsForm = _rjGenerateAllRivalsForm;
  window._rjApplyFormToRivals = _rjApplyFormToRivals;
  window._rjRestoreFormFromRivals = _rjRestoreFormFromRivals;

})();
