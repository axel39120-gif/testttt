/* =====================================================================
 * 34-progression-depth.js — PROFONDEUR DE PROGRESSION (JOUEUR)
 *
 * Pilier 1 — Potentiel/talent individuel par sous-stat + rendements
 *            décroissants. S'APPUIE sur le cap de catégorie et la
 *            pénalité _overCapPenalty déjà présents dans gainSubStat
 *            (03-data-agent.js) ; ajoute uniquement la pièce manquante :
 *            un plafond de talent propre au pilote, par sous-stat.
 *
 * Pilier 2 — Archétype + courbe d'âge (montée / plateau / déclin).
 *            Le joueur tire un des MÊMES archétypes que les rivaux et
 *            vieillit selon la MÊME logique (formule alignée sur
 *            _rjEvolveSkill de 04o-driver-pool.js). Pas de seconde
 *            courbe d'âge parallèle, pas d'asymétrie joueur/rival.
 *
 * (Pilier 3 — arbre de développement — viendra dans une itération
 *  séparée ; ce module ne livre que le moteur logique.)
 *
 * Option A : wrappe gainSubStat / initSubStats / startNextSeason.
 * Entièrement réversible (window._rjProgUninstall) ; retirer la ligne
 * d'index.html rétablit le comportement d'origine (+1 plat).
 * =================================================================== */
(function () {
  "use strict";

  /* Archétypes — VALEURS ALIGNÉES sur ARCHETYPES de 04o-driver-pool.js.
     (Cette table y est enfermée dans une IIFE, donc non partageable ;
     garder ces deux tables synchronisées.) */
  var ARCH = {
    prodige:        { weight: 25, peakAge: 24, plateau: 4, declineRate: 1.2, peakBonus: 6 },
    steady:         { weight: 50, peakAge: 28, plateau: 5, declineRate: 1.0, peakBonus: 4 },
    late_bloomer:   { weight: 15, peakAge: 31, plateau: 4, declineRate: 0.8, peakBonus: 5 },
    wonderkid_fade: { weight: 10, peakAge: 21, plateau: 2, declineRate: 0.6, peakBonus: 8 }
  };

  /* Familles de sous-stats pour le déclin d'âge.
     PHYS : dominante physique — déclinent. EXP : expérience — tiennent
     voire progressent. SEMI : mixtes — déclin atténué.
     (physique vit dans G.stats.physique, traité à part.) */
  var PHYS = ["vitesse_pure", "acceleration", "reactivite"];
  var EXP  = ["decision", "concentration", "gestion_pneus", "pression"];
  var SEMI = ["grip", "freinage"];

  /* Mapping clé legacy -> sous-stat, repris de gainSubStat. */
  var LEGACY = {
    vitesse: "vitesse_pure", regularite: "gestion_pneus", sangfroid: "pression",
    pneus: "gestion_pneus", strategie: "decision", attaque: "reactivite",
    adapt: "decision", physique: "physique"
  };

  function G_() { return window.G; }

  function pickArch() {
    var roll = Math.random() * 100, acc = 0, keys = Object.keys(ARCH);
    for (var i = 0; i < keys.length; i++) {
      acc += ARCH[keys[i]].weight;
      if (roll < acc) return keys[i];
    }
    return "steady";
  }

  function playerAge() {
    if (typeof calcPilotAge === "function") { try { return calcPilotAge(); } catch (e) {} }
    var G = G_();
    return (G && G.age) || 18;
  }

  function archOf() {
    var G = G_();
    return (G && G.training && ARCH[G.training.arch]) || ARCH.steady;
  }

  /* Multiplicateur d'apprentissage selon l'âge : module la VITESSE de
     gain par entraînement (le jeune progresse vite, le vétéran lentement). */
  function ageMult() {
    var a = archOf(), age = playerAge();
    if (age < a.peakAge - a.plateau) {           // phase de montée
      var d = a.peakAge - a.plateau - age;
      return 1 + Math.min(0.35, d * 0.05);       // jusqu'à ~1.35 chez le très jeune
    }
    if (age <= a.peakAge + a.plateau) return 0.85; // plateau
    return 0.45;                                   // après le pic
  }

  /* Rendements décroissants RELATIFS au potentiel individuel
     (en plus du cap de catégorie déjà géré par gainSubStat). */
  function potFalloff(cur, pot) {
    if (!pot || pot <= 0) return 1;
    var r = cur / pot;
    if (r >= 1)    return 0;     // verrouillé au potentiel
    if (r >= 0.88) return 0.25;
    if (r >= 0.70) return 0.55;
    return 1;
  }

  /* Génère archétype + potentiels par sous-stat à partir d'un objet
     substats + profil (style/trait). Le potentiel est un plafond de
     TALENT (haut, indépendant de la catégorie) ; le cap de catégorie
     limite en plus tant qu'on évolue dans une petite catégorie. */
  function genProfile(subs, style, trait) {
    var arch = pickArch();
    var keys = Object.keys(subs), mean = 0;
    keys.forEach(function (k) { mean += subs[k]; });
    mean /= Math.max(1, keys.length);

    var potBase = 76 + Math.round(Math.random() * 16);            // 76–92
    potBase += Math.round(((ARCH[arch] || ARCH.steady).peakBonus || 4) * 0.5);

    var pot = {};
    keys.forEach(function (k) {
      var bias = (subs[k] - mean) * 0.9;                          // forme du profil
      var v = Math.round(potBase + bias + (Math.random() - 0.5) * 4);
      var lo = Math.max(Math.round(subs[k]) + 6, 58);             // toujours un peu de marge
      pot[k] = Math.max(lo, Math.min(96, v));
    });

    var G = G_();
    var phys = (G && G.stats && typeof G.stats.physique === "number") ? G.stats.physique : 52;
    var potPhysique = Math.max(phys + 6, Math.min(96, Math.round(potBase + (Math.random() - 0.5) * 6)));

    return { arch: arch, pot: pot, potPhysique: potPhysique };
  }

  function trainingObj() {
    var G = G_();
    if (!G) return null;
    if (typeof getTraining === "function") { try { return getTraining(); } catch (e) {} }
    return (G.training = G.training || {});
  }

  /* Assure l'existence du profil (création OU migration d'une sauvegarde
     existante : potentiels dérivés des sous-stats actuelles). */
  function ensureProfile() {
    var G = G_();
    if (!G) return;
    var tr = trainingObj();
    if (!tr) return;
    if (tr.pot && Object.keys(tr.pot).length) return;            // déjà fait
    var subs = G.substats;
    if (!subs || !Object.keys(subs).length) return;              // pas encore de sous-stats
    var prof = genProfile(subs, (G.pilot && G.pilot.style) || "complet", (G.pilot && G.pilot.trait) || "leader");
    tr.arch = prof.arch; tr.pot = prof.pot; tr.potPhysique = prof.potPhysique;
  }

  /* Résout une clé gainSubStat vers la clé sous-stat réelle, "physique",
     ou null (clé non gérée par le potentiel). */
  function resolveSub(key) {
    var G = G_();
    if (!G || !G.substats) return null;
    if (typeof G.substats[key] === "number") return key;
    if (key === "physique") return "physique";
    var m = LEGACY[key];
    if (m === "physique") return "physique";
    return (m && typeof G.substats[m] === "number") ? m : null;
  }

  /* ---------------------------- wrappers ---------------------------- */
  var _origGain, _origInit, _origNext;

  function wrapGain() {
    _origGain = window.gainSubStat;
    window.gainSubStat = function (key, val) {
      try {
        var G = G_();
        if (G && G.training && (!G.training.pot || !Object.keys(G.training.pot).length)
            && G.substats && Object.keys(G.substats).length) {
          ensureProfile();                                       // migration paresseuse
        }
        if (typeof val === "number" && val > 0 && G && G.training && G.training.pot) {
          var sub = resolveSub(key);
          if (sub === "physique") {
            var curP = (G.stats && typeof G.stats.physique === "number") ? G.stats.physique : 50;
            var potP = G.training.potPhysique || 96;
            if (curP >= potP) return;
            val = val * potFalloff(curP, potP) * ageMult();
          } else if (sub && typeof G.training.pot[sub] === "number") {
            var cur = (typeof G.substats[sub] === "number") ? G.substats[sub] : 50;
            var pot = G.training.pot[sub];
            if (cur >= pot) return;
            val = val * potFalloff(cur, pot) * ageMult();
          }
        }
      } catch (e) {}

      var r = _origGain.call(this, key, val);

      /* Re-clamp au potentiel individuel (l'original ne plafonne qu'au
         hard cap de catégorie). */
      try {
        var G2 = G_(), s = resolveSub(key);
        if (G2 && G2.training && G2.training.pot) {
          if (s === "physique" && G2.stats && G2.training.potPhysique
              && G2.stats.physique > G2.training.potPhysique) {
            G2.stats.physique = G2.training.potPhysique;
            if (typeof computeLegacyStats === "function") computeLegacyStats();
          } else if (s && s !== "physique" && G2.substats
              && typeof G2.training.pot[s] === "number"
              && G2.substats[s] > G2.training.pot[s]) {
            G2.substats[s] = G2.training.pot[s];
            if (typeof computeLegacyStats === "function") computeLegacyStats();
          }
        }
      } catch (e) {}

      return r;
    };
  }

  function wrapInit() {
    if (typeof window.initSubStats !== "function") return;
    _origInit = window.initSubStats;
    window.initSubStats = function (style, trait) {
      var subs = _origInit.call(this, style, trait);
      try {
        var tr = trainingObj();
        if (tr) {
          var prof = genProfile(subs, style, trait);
          tr.arch = prof.arch; tr.pot = prof.pot; tr.potPhysique = prof.potPhysique;
          tr._declineSeason = undefined;
        }
      } catch (e) {}
      return subs;
    };
  }

  /* Déclin d'intersaison — formule alignée sur _rjEvolveSkill (04o).
     Idempotent : une seule application par saison. */
  function applyAgeDecline() {
    var G = G_();
    if (!G || !G.training) return;
    if (G.training._declineSeason === G.saison) return;
    G.training._declineSeason = G.saison;

    var a = ARCH[G.training.arch] || ARCH.steady, age = playerAge();
    var potOf = function (k) { return (G.training.pot && G.training.pot[k]) || 96; };

    function bumpExp() {
      EXP.forEach(function (k) {
        if (G.substats && typeof G.substats[k] === "number" && Math.random() < 0.45) {
          G.substats[k] = Math.min(potOf(k), G.substats[k] + 1);   // l'expérience progresse
        }
      });
    }

    if (age <= a.peakAge + a.plateau) {                            // pas encore en déclin
      bumpExp();
      if (typeof computeLegacyStats === "function") computeLegacyStats();
      return;
    }

    var yrs = age - a.peakAge - a.plateau;
    var mag = Math.min(3, yrs * 0.5 * a.declineRate);
    function dec(cur, factor) {
      var d = Math.round(mag * factor * (0.5 + Math.random() * 0.5));
      return Math.max(30, cur - d);
    }

    PHYS.forEach(function (k) {
      if (G.substats && typeof G.substats[k] === "number") G.substats[k] = dec(G.substats[k], 1.0);
    });
    SEMI.forEach(function (k) {
      if (G.substats && typeof G.substats[k] === "number") G.substats[k] = dec(G.substats[k], 0.5);
    });
    if (G.stats && typeof G.stats.physique === "number") G.stats.physique = dec(G.stats.physique, 1.0);
    bumpExp();
    if (typeof computeLegacyStats === "function") computeLegacyStats();
  }

  function wrapNext() {
    if (typeof window.startNextSeason !== "function") return;
    _origNext = window.startNextSeason;
    window.startNextSeason = function () {
      var r = _origNext.apply(this, arguments);
      try { applyAgeDecline(); } catch (e) {}
      try { awardDevPoints(2); } catch (e) {}
      return r;
    };
  }

  /* ===================== PILIER 3 — ARBRE DE DÉVELOPPEMENT ========== */
  /* 4 branches × 3 paliers. Les nœuds T1 sont les 5 spécialités
     existantes (débloquées par l'entraînement, intactes). Les paliers
     T2/T3 se débloquent avec des points de développement et amplifient
     les effets via un wrapper de applyTrainingSpecialtiesToRace. */
  var TREE = {
    pilotage:   { label: "Pilotage pur",         color: "#00D4FF", base: "qualifier",
      tiers: ["Spécialiste qualif", "Tour rapide", "Pole position"] },
    course:     { label: "Course / Racecraft",   color: "#FF1801", base: "start_master",
      tiers: ["Maître des départs", "Duelliste", "Gestionnaire pneus"] },
    conditions: { label: "Conditions",           color: "#60A5FA", base: "wet_runner",
      tiers: ["Roi de la pluie", "Adaptabilité", "Funambule"] },
    physique:   { label: "Endurance / Physique", color: "#EC4899", base: "endurance",
      tiers: ["Endurance", "Résistance", "Athlète"] }
  };
  var TREE_DESC = {
    pilotage:   ["+ Performance en qualif", "+ Rythme pur en course", "+ Qualif et rythme renforcés"],
    course:     ["+ Score au 1er tour", "+ En duel / dépassement", "\u2212 Usure pneus"],
    conditions: ["+ Score sous la pluie", "+ Adaptabilité (toutes conditions)", "+ Pluie et extrêmes"],
    physique:   ["\u2212 Fatigue par activité", "+ Tenue en fin de course", "+ Résistance maximale"]
  };
  var TREE_KEYS = ["pilotage", "course", "conditions", "physique"];

  function ensureTree() {
    var tr = trainingObj(); if (!tr) return null;
    if (!tr.tree) { tr.tree = { pilotage: 0, course: 0, conditions: 0, physique: 0 }; if (typeof tr.devPoints !== "number") tr.devPoints = 2; }
    if (typeof tr.devPoints !== "number") tr.devPoints = 0;
    return tr;
  }
  function t1Acquired(branch) {
    var tr = trainingObj();
    return !!(tr && tr.specialties && tr.specialties.indexOf(TREE[branch].base) >= 0);
  }
  function branchLevel(branch) {                 // 0 = rien, 1 = T1, 2 = T2, 3 = T3
    var tr = ensureTree(); if (!tr) return 0;
    if (!t1Acquired(branch)) return 0;
    return 1 + (tr.tree[branch] || 0);
  }
  function canUnlock(branch) {
    var tr = ensureTree(); if (!tr) return false;
    if (!t1Acquired(branch)) return false;        // il faut d'abord la spécialité de base
    if ((tr.tree[branch] || 0) >= 2) return false; // déjà au T3
    return (tr.devPoints || 0) >= 1;
  }
  function unlockTier(branch) {
    if (!canUnlock(branch)) return false;
    var tr = ensureTree();
    tr.devPoints -= 1;
    tr.tree[branch] = (tr.tree[branch] || 0) + 1;
    return true;
  }
  function getTreeState() {
    var tr = ensureTree();
    var out = { devPoints: tr ? tr.devPoints : 0, branches: {} };
    TREE_KEYS.forEach(function (b) {
      out.branches[b] = {
        label: TREE[b].label, color: TREE[b].color, tiers: TREE[b].tiers, desc: TREE_DESC[b],
        level: branchLevel(b), t1: t1Acquired(b), canUnlock: canUnlock(b)
      };
    });
    return out;
  }
  /* Effets des paliers T2/T3 en course (T1 reste géré par le moteur d'origine). */
  function applyTreeBonuses(e, weather, r, isQuali) {
    var tr = trainingObj(); if (!tr || !tr.tree) return e;
    var lvl = tr.tree, wet = weather && (weather.id === "rain" || weather.id === "storm");
    function add(x) { e.scoreBonus = (e.scoreBonus || 0) + x; }
    if (lvl.pilotage >= 1) add(0.012);
    if (lvl.pilotage >= 2) { if (isQuali) add(0.02); add(0.008); }
    if (lvl.course >= 1) add(0.012);
    if (lvl.course >= 2) e.tyreWearMult = 0.90 * (e.tyreWearMult || 1);
    if (lvl.conditions >= 1) add(0.01);
    if (lvl.conditions >= 2) { if (wet) add(0.02); add(0.008); }
    var late = (lvl.physique >= 1 ? 0.008 : 0) + (lvl.physique >= 2 ? 0.008 : 0);
    try { if (late > 0 && window.LIVE_RACE && LIVE_RACE.total && LIVE_RACE.cur > LIVE_RACE.total * 0.7) add(late); } catch (er) {}
    return e;
  }
  var _origApplySpec = null;
  function wrapApplySpecialties() {
    if (typeof window.applyTrainingSpecialtiesToRace !== "function") return false;
    if (window.applyTrainingSpecialtiesToRace._rjTree) return true;
    _origApplySpec = window.applyTrainingSpecialtiesToRace;
    window.applyTrainingSpecialtiesToRace = function (e, t, r, n) {
      e = _origApplySpec.apply(this, arguments);   // applique les spécialités T1
      try { applyTreeBonuses(e, t, r, n); } catch (err) {}
      return e;
    };
    window.applyTrainingSpecialtiesToRace._rjTree = true;
    return true;
  }
  function awardDevPoints(n) {
    var tr = ensureTree(); if (!tr) return;
    var G = G_(), season = G ? G.saison : 0;
    if (tr._devSeason === season) return;          // une attribution par saison
    tr._devSeason = season;
    tr.devPoints = (tr.devPoints || 0) + (n || 2);
  }

  /* ============================== UI =============================== */
  var ARCH_LABEL = { prodige: "Prodige", steady: "Régulier", late_bloomer: "Révélation tardive", wonderkid_fade: "Étoile filante" };
  var UI_SUBKEYS = ["vitesse_pure", "acceleration", "reactivite", "freinage", "grip", "gestion_pneus", "concentration", "decision", "pression"];

  function subLabel(k) {
    try { if (window.SUBSTAT_LABELS && window.SUBSTAT_LABELS[k]) return window.SUBSTAT_LABELS[k]; } catch (e) {}
    return k;
  }
  function agePhase() {
    var G = G_();
    if (!G || !G.training) return null;
    var a = ARCH[G.training.arch] || ARCH.steady, age = playerAge();
    if (age < a.peakAge - a.plateau) return { lbl: "En progression", color: "#00D4FF" };
    if (age <= a.peakAge + a.plateau) return { lbl: "À son pic", color: "#00E676" };
    return { lbl: "En déclin", color: "#FFB300" };
  }
  function statBar(label, val, pot) {
    val = Math.round(val); pot = Math.round(pot);
    var ratio = pot > 0 ? val / pot : 0;
    var col = ratio >= 0.97 ? "#FFC107" : (ratio >= 0.85 ? "#00E676" : "#00D4FF");
    var fillW = Math.max(0, Math.min(100, val / 99 * 100));
    var markL = Math.max(0, Math.min(100, pot / 99 * 100));
    return '<div class="rjdev-stat"><div class="rjdev-stat-head">'
      + '<span class="rjdev-stat-lbl">' + label + '</span>'
      + '<span class="rjdev-stat-val">' + val + '<span class="rjdev-stat-pot"> / ' + pot + '</span></span></div>'
      + '<div class="rjdev-bar"><div class="rjdev-bar-fill" style="width:' + fillW + '%;background:' + col + '"></div>'
      + '<div class="rjdev-bar-mark" style="left:' + markL + '%"></div></div></div>';
  }
  function renderDevSection() {
    var G = G_();
    if (!G || !G.training || !G.training.pot || !G.substats) return '';
    var arch = ARCH_LABEL[G.training.arch] || "—";
    var ph = agePhase(), age = Math.round(playerAge()), rows = "";
    UI_SUBKEYS.forEach(function (k) {
      if (typeof G.substats[k] === "number" && typeof G.training.pot[k] === "number")
        rows += statBar(subLabel(k), G.substats[k], G.training.pot[k]);
    });
    if (G.stats && typeof G.stats.physique === "number" && G.training.potPhysique)
      rows += statBar("Physique", G.stats.physique, G.training.potPhysique);
    return '<div class="rjdev-stripe"></div>'
      + '<div class="rjdev-hdr"><div><div class="rjdev-kicker">Développement</div>'
      + '<div class="rjdev-arch">' + arch + '</div></div>'
      + '<div class="rjdev-age"><div class="rjdev-age-val">' + age + ' ans</div>'
      + (ph ? '<div class="rjdev-phase" style="color:' + ph.color + '">' + ph.lbl + '</div>' : '') + '</div></div>'
      + '<div class="rjdev-note">Chaque jauge montre ta valeur actuelle et ton potentiel (repère clair). Plus tu approches du potentiel, plus la progression ralentit.</div>'
      + '<div class="rjdev-stats">' + rows + '</div>'
      + renderTree();
  }
  function renderTree() {
    var st; try { st = getTreeState(); } catch (e) { return ''; }
    if (!st) return '';
    var branches = TREE_KEYS.map(function (k) {
      var b = st.branches[k];
      var tiers = b.tiers.map(function (name, ti) {
        var tierLevel = ti + 1, acquired = b.level >= tierLevel, isNext = (b.level === tierLevel - 1);
        var state, right;
        if (acquired) { state = "ok"; right = '<span class="rjtree-ok" style="color:' + b.color + '">\u2713</span>'; }
        else if (ti === 0 && !b.t1) { state = "spec"; right = '<span class="rjtree-hint">à l\'entraînement</span>'; }
        else if (isNext && b.canUnlock) { state = "avail"; right = '<button class="rjtree-unlock" data-branch="' + k + '">Débloquer · 1 pt</button>'; }
        else { state = "lock"; right = '<span class="rjtree-lock">\u2014</span>'; }
        var dotStyle = acquired ? 'background:' + b.color + ';color:#08080a;border-color:' + b.color + ';box-shadow:0 0 15px -1px ' + b.color + 'aa' : '';
        var justCls = (_justUnlocked === k + ':' + tierLevel) ? ' just' : '';
        return '<div class="rjtree-tier ' + state + justCls + '" style="--bc:' + b.color + '">'
          + '<div class="rjtree-tdot" style="' + dotStyle + '">T' + tierLevel + '</div>'
          + '<div class="rjtree-tinfo"><div class="rjtree-tname">' + name + '</div><div class="rjtree-tdesc">' + b.desc[ti] + '</div></div>'
          + '<div class="rjtree-tright">' + right + '</div></div>';
      }).join("");
      var fillPct = Math.round((b.level / 3) * 100);
      return '<div class="rjtree-branch" style="--bc:' + b.color + '">'
        + '<div class="rjtree-bstripe" style="background:linear-gradient(180deg,' + b.color + ',transparent 82%);box-shadow:0 0 18px ' + b.color + '66"></div>'
        + '<div class="rjtree-bhead">'
        + '<span class="rjtree-bname" style="color:' + b.color + '">' + b.label + '</span>'
        + '<span class="rjtree-blevel">' + (b.level > 0 ? ("T" + b.level) : "\u2014") + ' / 3</span></div>'
        + '<div class="rjtree-track"><div class="rjtree-track-fill" style="width:' + fillPct + '%;background:' + b.color + '"></div></div>'
        + '<div class="rjtree-tiers">' + tiers + '</div></div>';
    }).join("");
    return '<div class="rjtree"><div class="rjtree-hdr">'
      + '<span class="rjtree-title">Arbre de développement</span>'
      + '<span class="rjtree-pts' + (st.devPoints > 0 ? ' has' : '') + '">' + st.devPoints + ' <span class="rjtree-pts-lbl">point' + (st.devPoints > 1 ? "s" : "") + '</span></span></div>'
      + '<div class="rjtree-branches">' + branches + '</div></div>';
  }
  var _justUnlocked = null;
  function onTreeClick(e) {
    var btn = e.target && e.target.closest && e.target.closest(".rjtree-unlock");
    if (!btn) return;
    var branch = btn.getAttribute("data-branch");
    if (unlockTier(branch)) {
      _justUnlocked = branch + ":" + branchLevel(branch);
      try { if (typeof window.save === "function") window.save(); } catch (_) {}
      injectDevSection();
      _justUnlocked = null;
    }
  }
  function injectDevSection() {
    var host = document.getElementById("train-sessions-content") || document.getElementById("drawer-train");
    if (!host) return;
    var sec = document.getElementById("rj-dev-section");
    if (!sec) {
      sec = document.createElement("div");
      sec.id = "rj-dev-section"; sec.className = "rjdev";
      if (host.id === "train-sessions-content" && host.parentNode) host.parentNode.insertBefore(sec, host.nextSibling);
      else host.appendChild(sec);
    }
    sec.innerHTML = renderDevSection();
    if (!sec._rjTreeBound) { sec.addEventListener("click", onTreeClick); sec._rjTreeBound = true; }
  }
  function injectDevCSS() {
    if (document.getElementById("rj-dev-css")) return;
    var css = [
      '.rjdev{position:relative;margin:14px 0 6px;padding:15px 15px 15px 18px;border-radius:12px;background:var(--surface2);border:1px solid var(--border);overflow:hidden;box-shadow:0 1px 0 rgba(255,255,255,.04) inset,0 8px 24px rgba(0,0,0,.4);font-family:var(--font-display)}',
      '.rjdev-stripe{position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(180deg,#00D4FF,transparent 78%)}',
      '.rjdev-hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:9px}',
      '.rjdev-kicker{font-size:9.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}',
      '.rjdev-arch{font-size:18px;font-weight:900;color:var(--text);margin-top:2px;letter-spacing:-.01em}',
      '.rjdev-age{text-align:right;flex-shrink:0}',
      '.rjdev-age-val{font-size:14px;font-weight:800;color:var(--text2);font-variant-numeric:tabular-nums}',
      '.rjdev-phase{font-size:9.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;margin-top:2px}',
      '.rjdev-note{font-size:10.5px;color:var(--muted);line-height:1.45;margin-bottom:14px}',
      '.rjdev-stats{display:flex;flex-direction:column;gap:10px}',
      '.rjdev-stat-head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:4px}',
      '.rjdev-stat-lbl{font-size:11.5px;font-weight:700;color:var(--text2)}',
      '.rjdev-stat-val{font-size:12.5px;font-weight:900;color:var(--text);font-variant-numeric:tabular-nums}',
      '.rjdev-stat-pot{font-size:10.5px;font-weight:700;color:var(--muted)}',
      '.rjdev-bar{position:relative;height:6px;border-radius:3px;background:rgba(255,255,255,.05)}',
      '.rjdev-bar-fill{position:absolute;left:0;top:0;height:100%;border-radius:3px;transition:width .35s ease}',
      '.rjdev-bar-mark{position:absolute;top:-3px;width:2px;height:12px;background:var(--text);border-radius:1px;opacity:.5;transform:translateX(-1px)}',
      '.rjtree{margin-top:18px;padding-top:15px;border-top:1px solid var(--border)}',
      '.rjtree-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:13px}',
      '.rjtree-title{font-size:9.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}',
      '.rjtree-pts{font-size:13px;font-weight:900;color:var(--amber);font-variant-numeric:tabular-nums;display:flex;align-items:baseline;gap:4px}',
      '.rjtree-pts-lbl{font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}',
      '.rjtree-branches{display:flex;flex-direction:column;gap:13px}',
      '.rjtree-branch{position:relative;border-radius:11px;background:linear-gradient(180deg,var(--bg3),var(--bg2));border:1px solid var(--border);overflow:hidden;padding:11px 12px 12px 15px}',
      '.rjtree-bstripe{position:absolute;left:0;top:0;bottom:0;width:3px}',
      '.rjtree-bhead{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:9px}',
      '.rjtree-bname{font-size:12px;font-weight:900;letter-spacing:.03em;text-transform:uppercase}',
      '.rjtree-blevel{font-size:10px;font-weight:800;letter-spacing:.04em;color:var(--muted);font-variant-numeric:tabular-nums}',
      '.rjtree-tiers{display:flex;flex-direction:column;gap:6px}',
      '.rjtree-tier{display:flex;align-items:center;gap:10px;padding:8px 9px;border-radius:9px;background:var(--surface2);border:1px solid var(--border);transition:border-color .15s}',
      '.rjtree-tier.lock{opacity:.45}',
      '.rjtree-tier.avail{border-color:var(--border-hi)}',
      '.rjtree-tier.ok{background:rgba(255,255,255,.02)}',
      '.rjtree-tdot{flex-shrink:0;width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;color:var(--muted);background:rgba(255,255,255,.04);border:1px solid var(--border-hi);letter-spacing:.02em}',
      '.rjtree-tinfo{flex:1;min-width:0}',
      '.rjtree-tname{font-size:11.5px;font-weight:800;color:var(--text)}',
      '.rjtree-tdesc{font-size:9.5px;font-weight:600;color:var(--muted);margin-top:1px}',
      '.rjtree-tright{flex-shrink:0;display:flex;align-items:center}',
      '.rjtree-ok{font-size:14px;font-weight:900}',
      '.rjtree-hint{font-size:8.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);font-style:italic}',
      '.rjtree-lock{font-size:13px;color:#404048}',
      '.rjtree-track{height:3px;border-radius:2px;background:rgba(255,255,255,.06);margin:-1px 0 11px;overflow:hidden}',
      '.rjtree-track-fill{height:100%;border-radius:2px;transition:width .55s cubic-bezier(.4,0,.2,1);box-shadow:0 0 8px var(--bc)}',
      '.rjtree-unlock{padding:6px 11px;border-radius:7px;background:rgba(255,255,255,.02);border:1px solid var(--bc);color:var(--bc);font-family:inherit;font-size:9px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;cursor:pointer;white-space:nowrap;transition:background .15s,box-shadow .15s;animation:rjavail 2.4s ease-in-out infinite}',
      '.rjtree-unlock:hover{background:rgba(255,255,255,.08);box-shadow:0 0 16px -3px var(--bc)}',
      '@keyframes rjavail{0%,100%{box-shadow:0 0 0 0 transparent}50%{box-shadow:0 0 11px -3px var(--bc)}}',
      '.rjtree-tier.just{animation:rjjustbg .7s ease-out}',
      '.rjtree-tier.just .rjtree-tdot{animation:rjjustdot .7s ease-out}',
      '@keyframes rjjustbg{0%{background:var(--bc)}100%{background:rgba(255,255,255,.02)}}',
      '@keyframes rjjustdot{0%{transform:scale(.7)}45%{transform:scale(1.18);box-shadow:0 0 26px 2px var(--bc)}100%{transform:scale(1)}}',
      '.rjtree-pts.has{animation:rjptspulse 2s ease-in-out infinite}',
      '@keyframes rjptspulse{0%,100%{text-shadow:none}50%{text-shadow:0 0 13px var(--amber)}}'
    ].join("");
    var st = document.createElement("style"); st.id = "rj-dev-css"; st.textContent = css;
    document.head.appendChild(st);
  }
  var _origRTS = null;
  function wrapTrainScreen() {
    if (typeof window.renderTrainScreen !== "function") return false;
    if (window.renderTrainScreen._rjDev) return true;
    _origRTS = window.renderTrainScreen;
    window.renderTrainScreen = function () {
      var r = _origRTS.apply(this, arguments);
      try { injectDevSection(); } catch (e) {}
      return r;
    };
    window.renderTrainScreen._rjDev = true;
    return true;
  }

  /* ----------------------------- install ---------------------------- */
  function install() {
    if (window._rjProgInstalled) return true;
    if (typeof window.gainSubStat !== "function") return false;   // dépendances pas prêtes

    wrapGain();
    wrapInit();
    wrapNext();
    ensureProfile();                                              // partie déjà chargée / migration
    ensureTree();
    wrapApplySpecialties();
    injectDevCSS();
    wrapTrainScreen();

    window._rjProgInstalled = true;
    window._rjProg = {
      ensureProfile: ensureProfile, genProfile: genProfile,
      potFalloff: potFalloff, ageMult: ageMult,
      applyAgeDecline: applyAgeDecline, pickArch: pickArch, ARCH: ARCH,
      renderDevSection: renderDevSection, injectDevSection: injectDevSection,
      getTreeState: getTreeState, unlockTier: unlockTier, canUnlock: canUnlock,
      branchLevel: branchLevel, awardDevPoints: awardDevPoints, TREE: TREE
    };
    window._rjProgUninstall = function () {
      if (_origGain) window.gainSubStat = _origGain;
      if (_origInit) window.initSubStats = _origInit;
      if (_origNext) window.startNextSeason = _origNext;
      if (_origRTS) window.renderTrainScreen = _origRTS;
      if (_origApplySpec) window.applyTrainingSpecialtiesToRace = _origApplySpec;
      var sec = document.getElementById("rj-dev-section"); if (sec && sec.parentNode) sec.parentNode.removeChild(sec);
      window._rjProgInstalled = false;
      console.log("[34-progression-depth] désinstallé");
    };

    var G = G_();
    console.log("[34-progression-depth] actif — potentiel individuel + courbe d'âge (archétype: "
      + ((G && G.training && G.training.arch) || "à générer") + ")");
    return true;
  }

  var tries = 0;
  (function boot() {
    if (install()) return;
    if (tries++ > 60) { console.warn("[34-progression-depth] dépendances absentes, abandon"); return; }
    setTimeout(boot, 150);
  })();

})();
