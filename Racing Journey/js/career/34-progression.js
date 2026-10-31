/* =====================================================================
 * 34-progression.js — PROGRESSION DU PILOTE ET DU PLATEAU
 *
 * Regroupe trois modules qui décrivent comment les choses évoluent d'une
 * saison à l'autre : la progression du pilote et ses spécialités, le
 * travail d'entraînement, et l'équilibrage du vivier de pilotes.
 *
 * L'ordre de chargement d'origine est conservé — les trois interviennent
 * au changement de saison, et deux d'entre eux s'inscrivent au même
 * registre.
 * =================================================================== */

/* ==================================================================== *
 * Progression du pilote — spécialités, points de développement
 * (anciennement 34-progression-depth.js)
 * ==================================================================== */

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
    /* Réactions au changement de saison : inscription au registre
       (module 89) plutôt qu'une enveloppe de plus. */
    if (!Array.isArray(window.RJ_SEASON_HOOKS)) window.RJ_SEASON_HOOKS = [];
    if (!window.RJ_SEASON_HOOKS.some(function (h) { return h && h.id === "34-progression-depth"; })) {
      window.RJ_SEASON_HOOKS.push({
        id: "34-progression-depth",
        apres: function () {
          try { applyAgeDecline(); } catch (e) {}
          try { awardDevPoints(2); } catch (e) {}
        }
      });
    }
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
      /* La marge latérale était à zéro : la carte touchait les bords de l'écran quand tout le reste de l'entraînement respecte une gouttière. On reprend la valeur du jeu, réglable comme partout ailleurs. */
      '.rjdev{position:relative;margin:14px var(--rj-gouttiere,14px) 6px;padding:15px 15px 15px 18px;border-radius:12px;background:var(--surface2);border:1px solid var(--border);overflow:hidden;box-shadow:0 1px 0 rgba(255,255,255,.04) inset,0 8px 24px rgba(0,0,0,.4);font-family:var(--font-display)}',
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


/* ==================================================================== *
 * Entraînement — séances et récupération
 * (anciennement 38-training-rework.js)
 * ==================================================================== */

(function () {
  "use strict";

  function G_() { return window.G; }
  function tr_() {
    if (typeof window.getTraining === "function") { try { return window.getTraining(); } catch (e) {} }
    var G = G_(); return G ? (G.training = G.training || {}) : null;
  }

  var FOCUS = {
    pilotage:   { label: "Pilotage pur",          color: "#00D4FF", sessionKey: "simu",
      stats: ["vitesse_pure", "acceleration", "freinage"], desc: "Vitesse brute, tour lancé, freinage tardif." },
    course:     { label: "Racecraft",             color: "#FF1801", sessionKey: "simu",
      stats: ["reactivite", "decision", "gestion_pneus"], desc: "Duels, départs, lecture de course." },
    conditions: { label: "Conditions",            color: "#60A5FA", sessionKey: "technical",
      stats: ["grip", "concentration", "pression"], desc: "Pluie, adaptation, sang-froid." },
    physique:   { label: "Préparation physique",  color: "#EC4899", sessionKey: "physical",
      stats: ["physique"], desc: "Cardio, résistance aux G, endurance." }
  };
  var FOCUS_KEYS = ["pilotage", "course", "conditions", "physique"];

  var PREMIUM = [
    { id: "sim_stage", label: "Stage simulateur",        cost: 8000,  desc: "Une séance de focus garantie, sans mauvaise pioche, avec un gain renforcé." },
    { id: "coach",     label: "Coach personnel (saison)", cost: 25000, desc: "Efficacité des focus +20 % jusqu'à la fin de la saison." },
    { id: "intensive", label: "Semaine intensive",        cost: 5000,  desc: "+2 PA cette semaine, mais fatigue accrue." }
  ];

  function ageMult() {
    try { if (window._rjProg && typeof window._rjProg.ageMult === "function") return window._rjProg.ageMult(); } catch (e) {}
    return 1;
  }
  function coachActive() {
    var tr = tr_(), G = G_();
    return !!(tr && G && tr._coachSeason === G.saison);
  }

  /* Issue d'un focus : budget de gain modulé, réparti aléatoirement. */
  function computeFocusOutcome(focusKey, opts) {
    opts = opts || {};
    var focus = FOCUS[focusKey];
    if (!focus) return null;
    var tr = tr_(), fatigue = (tr && tr.fatigue) || 0;
    var fatigueMult = Math.max(0.4, 1 - fatigue / 160);
    var mult = fatigueMult * ageMult() * (coachActive() ? 1.2 : 1);

    var event = "normal", eventMult = 1;
    if (!opts.guaranteed) {
      var roll = Math.random();
      if (roll < 0.12) { event = "declic"; eventMult = 2; }
      else if (roll < 0.30) { event = "plateau"; eventMult = 0.5; }
      else if (roll > 0.97) { event = "off"; eventMult = 0; }
    } else { event = "stage"; eventMult = 1.6; }      // programme premium : gain renforcé, pas d'aléa négatif

    var budget = Math.max(opts.guaranteed ? 2 : 0, Math.round(2 * mult * eventMult));
    var gains = {};
    focus.stats.forEach(function (s) { gains[s] = 0; });
    for (var i = 0; i < budget; i++) {
      var s = focus.stats[Math.floor(Math.random() * focus.stats.length)];
      gains[s] += 1;
    }
    return { focus: focusKey, event: event, gains: gains, budget: budget };
  }

  /* Applique les gains via gainSubStat (rendements décroissants du pilier 1). */
  function applyGains(gains) {
    var applied = [];
    Object.keys(gains).forEach(function (k) {
      if (gains[k] > 0 && typeof window.gainSubStat === "function") {
        try { window.gainSubStat(k, gains[k]); applied.push({ k: k, v: gains[k] }); } catch (e) {}
      }
    });
    try { if (typeof window.computeLegacyStats === "function") window.computeLegacyStats(); } catch (e) {}
    return applied;
  }

  /* Lancer un focus : coûte 1 PA + fatigue, débloque les specs (core), gains variables. */
  function runFocus(focusKey, opts) {
    opts = opts || {};
    var G = G_(), focus = FOCUS[focusKey];
    if (!G || !focus) return { ok: false, reason: "invalid" };
    if (!opts.free && (G.pa || 0) <= 0) return { ok: false, reason: "no_pa" };
    if (!opts.free) G.pa -= 1;
    // fatigue + déblocage des spécialités T1 (mécanisme d'origine)
    try { if (typeof window.recordTrainingSession === "function") window.recordTrainingSession(focus.sessionKey); } catch (e) {}
    var outcome = computeFocusOutcome(focusKey, opts);
    var applied = applyGains(outcome.gains);
    return { ok: true, event: outcome.event, gains: applied, focus: focusKey };
  }

  function premiumUsedThisWeek(id) {
    var G = G_(), tr = tr_();
    return !!(G && tr && tr._premWeek && tr._premWeek[id] === G.semaine);
  }
  function markPremium(id) {
    var G = G_(), tr = tr_();
    if (G && tr) { tr._premWeek = tr._premWeek || {}; tr._premWeek[id] = G.semaine; }
  }
  function runPremium(id, focusKey) {
    var G = G_(), tr = tr_();
    var prog = PREMIUM.filter(function (p) { return p.id === id; })[0];
    if (!G || !prog) return { ok: false, reason: "invalid" };
    if ((id === "sim_stage" || id === "intensive") && premiumUsedThisWeek(id)) return { ok: false, reason: "weekly_cap" };
    if ((G.budget || 0) < prog.cost) return { ok: false, reason: "no_budget" };
    G.budget -= prog.cost;
    if (id === "sim_stage") {
      markPremium(id);
      var fk = focusKey || lowestFocus();
      var r = runFocus(fk, { free: true, guaranteed: true });
      return { ok: true, id: id, focus: fk, result: r };
    }
    if (id === "coach") { if (tr) tr._coachSeason = G.saison; return { ok: true, id: id }; }
    if (id === "intensive") {
      markPremium(id);
      G.pa = (G.pa || 0) + 2;
      if (tr) tr.fatigue = Math.min(100, (tr.fatigue || 0) + 20);
      return { ok: true, id: id };
    }
    return { ok: false, reason: "unknown" };
  }

  /* Réinitialise fatigue et moral au début d'une nouvelle saison (repos d'intersaison). */
  function resetSeasonState() {
    var G = G_(), tr = tr_();
    if (!G) return;
    var season = G.saison || 0;
    if (tr && tr._resetSeason === season) return;   // idempotent
    if (tr) { tr._resetSeason = season; tr.fatigue = 0; }
    try { if (window.PILOT_MENTAL && typeof window.PILOT_MENTAL.value === "number") window.PILOT_MENTAL.value = 60; } catch (e) {}
  }
  var _origNextSeason = null;
  function wrapNextSeason() {
    if (typeof window.startNextSeason !== "function") return false;
    if (window.startNextSeason._rjTrainReset) return true;
    _origNextSeason = window.startNextSeason;
    if (!Array.isArray(window.RJ_SEASON_HOOKS)) window.RJ_SEASON_HOOKS = [];
    if (!window.RJ_SEASON_HOOKS.some(function (h) { return h && h.id === "38-training-rework"; })) {
      window.RJ_SEASON_HOOKS.push({
        id: "38-training-rework",
        apres: function () { try { resetSeasonState(); } catch (e) {} }
      });
    }
    return true;
  }

  /* Récupération : réduit la fatigue, coûte 1 PA (ton temps). */
  function doRest() {
    var G = G_(), tr = tr_();
    if (!G || !tr) return { ok: false };
    if ((G.pa || 0) <= 0) return { ok: false, reason: "no_pa" };
    G.pa -= 1;
    tr.fatigue = Math.max(0, (tr.fatigue || 0) - 35);
    try { if (typeof window.updateUI === "function") window.updateUI(); } catch (e) {}
    return { ok: true, fatigue: tr.fatigue };
  }

  /* Focus dont les sous-stats sont en moyenne les plus basses (marge de progression). */
  function lowestFocus() {
    var G = G_(); if (!G || !G.substats) return "pilotage";
    var best = "pilotage", bestAvg = Infinity;
    FOCUS_KEYS.forEach(function (k) {
      var stats = FOCUS[k].stats, sum = 0, n = 0;
      stats.forEach(function (s) {
        var v = s === "physique" ? (G.stats && G.stats.physique) : G.substats[s];
        if (typeof v === "number") { sum += v; n++; }
      });
      var avg = n ? sum / n : 70;
      if (avg < bestAvg) { bestAvg = avg; best = k; }
    });
    return best;
  }

  /* ============================== UI =============================== */
  var _lastOutcome = null;

  function subLabel(k) {
    if (k === "physique") return "Physique";
    var L = window.SUBSTAT_LABELS || {};
    return L[k] || k;
  }
  function efficiencyPct() {
    var tr = tr_(), fatigue = (tr && tr.fatigue) || 0;
    var fm = Math.max(0.4, 1 - fatigue / 160);
    return Math.round(fm * ageMult() * (coachActive() ? 1.2 : 1) * 100);
  }
  function renderOutcome(o) {
    var EV = {
      declic: { lbl: "Déclic !", col: "var(--green)" }, plateau: { lbl: "Plateau", col: "var(--amber)" },
      off: { lbl: "Séance ratée", col: "var(--red3)" }, normal: { lbl: "Séance bouclée", col: "var(--text2)" },
      stage: { lbl: "Stage simulateur", col: "#00D4FF" }
    };
    var ev = EV[o.event] || EV.normal;
    var gains = (o.gains && o.gains.length) ? o.gains.map(function (g) { return "+" + g.v + " " + subLabel(g.k); }).join(" · ") : "Aucun gain cette fois";
    return '<div class="rjf-fb" style="border-color:' + ev.col + '55"><span class="rjf-fb-ev" style="color:' + ev.col + '">' + ev.lbl + '</span><span class="rjf-fb-g">' + gains + '</span></div>';
  }
  function renderFocusUI() {
    var host = document.getElementById("train-sessions-content");
    if (!host) return;
    var G = G_(); if (!G) return;
    var tr = tr_(), fatigue = (tr && tr.fatigue) || 0, pa = G.pa || 0, budget = G.budget || 0, eff = efficiencyPct();
    var cards = FOCUS_KEYS.map(function (k) {
      var f = FOCUS[k];
      var chips = f.stats.map(function (s) { return '<span class="rjf-chip">' + subLabel(s) + "</span>"; }).join("");
      return '<div class="rjf-card" style="--bc:' + f.color + '"><div class="rjf-stripe"></div>'
        + '<div class="rjf-name" style="color:' + f.color + '">' + f.label + "</div>"
        + '<div class="rjf-desc">' + f.desc + "</div>"
        + '<div class="rjf-chips">' + chips + "</div>"
        + '<button class="rjf-go" data-focus="' + k + '"' + (pa > 0 ? "" : " disabled") + ">Lancer · 1 PA</button></div>";
    }).join("");
    var prem = PREMIUM.map(function (p) {
      var active = (p.id === "coach" && coachActive());
      var capped = (p.id === "sim_stage" || p.id === "intensive") && premiumUsedThisWeek(p.id);
      var afford = budget >= p.cost, dis = active || capped || !afford;
      var badge = active ? ' <span class="rjp-badge">actif</span>' : capped ? ' <span class="rjp-badge" style="color:var(--muted)">cette semaine</span>' : "";
      var lbl = capped ? "Fait" : p.cost.toLocaleString("fr-FR") + " €";
      return '<div class="rjp-card' + (active ? " on" : "") + '"><div class="rjp-info">'
        + '<div class="rjp-name">' + p.label + badge + "</div>"
        + '<div class="rjp-desc">' + p.desc + "</div></div>"
        + '<button class="rjp-buy" data-prem="' + p.id + '"' + (dis ? " disabled" : "") + ">" + lbl + "</button></div>";
    }).join("");
    var fatCol = fatigue < 40 ? "var(--green)" : fatigue < 75 ? "var(--amber)" : "var(--red3)";
    var effCol = eff >= 85 ? "var(--green)" : eff >= 65 ? "var(--amber)" : "var(--red3)";
    host.innerHTML = '<div class="rjf">'
      + (_lastOutcome ? renderOutcome(_lastOutcome) : "")
      + '<div class="rjf-state"><div class="rjf-state-item"><div class="rjf-state-lbl">Énergie</div>'
      + '<div class="rjf-state-bar"><div class="rjf-state-fill" style="width:' + (100 - fatigue) + "%;background:" + fatCol + '"></div></div></div>'
      + '<div class="rjf-state-eff"><div class="rjf-state-lbl">Efficacité</div><div class="rjf-state-val" style="color:' + effCol + '">' + eff + "%</div></div></div>"
      + '<div class="rjf-kicker">Focus d\'entraînement <span class="rjf-pa">' + pa + " PA</span></div>"
      + '<div class="rjf-grid">' + cards + "</div>"
      + '<button class="rjf-rest" data-rest="1"' + (pa > 0 ? "" : " disabled") + ">Récupérer · 1 PA · \u221235 énergie</button>"
      + '<div class="rjf-kicker rjf-kicker-prem">Programmes premium</div>'
      + '<div class="rjf-prem">' + prem + "</div></div>";
    if (!host._rjFocusBound) { host.addEventListener("click", onFocusClick); host._rjFocusBound = true; }
  }
  function afterAction() {
    try { if (typeof window.save === "function") window.save(); } catch (e) {}
    try { if (typeof window.updateUI === "function") window.updateUI(); } catch (e) {}
    renderFocusUI();
  }
  function onFocusClick(e) {
    var t = e.target; if (!t || !t.closest) return;
    var fb = t.closest(".rjf-go");
    if (fb) { var k = fb.getAttribute("data-focus"); var r = runFocus(k); if (r.ok) _lastOutcome = { event: r.event, gains: r.gains }; afterAction(); return; }
    var rb = t.closest(".rjf-rest");
    if (rb) { doRest(); _lastOutcome = null; afterAction(); return; }
    var pb = t.closest(".rjp-buy");
    if (pb) { var id = pb.getAttribute("data-prem"); var pr = runPremium(id); if (pr.ok && pr.result) _lastOutcome = { event: pr.result.event, gains: pr.result.gains }; afterAction(); return; }
  }
  function injectFocusCSS() {
    if (document.getElementById("rj-focus-css")) return;
    var css = [
      '.rjf{padding:0 14px;font-family:var(--font-display)}',
      '.rjf-fb{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:9px;background:var(--surface2);border:1px solid;margin-bottom:12px}',
      '.rjf-fb-ev{font-size:11px;font-weight:900;letter-spacing:.03em;white-space:nowrap}',
      '.rjf-fb-g{font-size:11px;font-weight:700;color:var(--text2)}',
      '.rjf-state{display:flex;align-items:flex-end;gap:14px;margin-bottom:14px}',
      '.rjf-state-item{flex:1}',
      '.rjf-state-lbl{font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin-bottom:5px}',
      '.rjf-state-bar{height:6px;border-radius:3px;background:rgba(255,255,255,.06);overflow:hidden}',
      '.rjf-state-fill{height:100%;border-radius:3px;transition:width .4s ease}',
      '.rjf-state-eff{text-align:right;flex-shrink:0}',
      '.rjf-state-val{font-size:16px;font-weight:900;font-variant-numeric:tabular-nums}',
      '.rjf-kicker{font-size:9.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin:0 0 11px;display:flex;align-items:center;justify-content:space-between}',
      '.rjf-kicker-prem{margin-top:20px}',
      '.rjf-pa{font-size:9.5px;font-weight:800;color:var(--text2);letter-spacing:.06em}',
      '.rjf-grid{display:flex;flex-direction:column;gap:11px}',
      '.rjf-card{position:relative;border-radius:11px;background:linear-gradient(180deg,var(--bg3),var(--bg2));border:1px solid var(--border);overflow:hidden;padding:12px 13px 13px 16px}',
      '.rjf-stripe{position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--bc);box-shadow:0 0 16px var(--bc)}',
      '.rjf-name{font-size:13px;font-weight:900;letter-spacing:.02em;text-transform:uppercase;margin-bottom:3px}',
      '.rjf-desc{font-size:10.5px;font-weight:600;color:var(--muted);line-height:1.4;margin-bottom:9px}',
      '.rjf-chips{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px}',
      '.rjf-chip{font-size:9.5px;font-weight:700;color:var(--text2);padding:3px 8px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid var(--border)}',
      '.rjf-go{width:100%;padding:10px;border-radius:8px;background:var(--bc);color:#08080a;border:none;font-family:inherit;font-size:11px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;cursor:pointer;transition:filter .15s,box-shadow .15s;box-shadow:0 0 14px -4px var(--bc)}',
      '.rjf-go:hover{filter:brightness(1.1);box-shadow:0 0 18px -2px var(--bc)}',
      '.rjf-go:disabled{opacity:.35;cursor:not-allowed;box-shadow:none}',
      '.rjf-rest{width:100%;margin-top:11px;padding:10px;border-radius:8px;background:rgba(255,255,255,.03);color:var(--text2);border:1px solid var(--border-hi);font-family:inherit;font-size:10.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;transition:background .15s}',
      '.rjf-rest:hover{background:rgba(255,255,255,.07)}',
      '.rjf-rest:disabled{opacity:.35;cursor:not-allowed}',
      '.rjf-prem{display:flex;flex-direction:column;gap:9px}',
      '.rjp-card{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:10px;background:var(--surface2);border:1px solid var(--border)}',
      '.rjp-card.on{border-color:var(--green);background:rgba(0,230,118,.05)}',
      '.rjp-info{flex:1;min-width:0}',
      '.rjp-name{font-size:11.5px;font-weight:800;color:var(--text);margin-bottom:2px}',
      '.rjp-badge{font-size:8px;font-weight:900;color:var(--green);letter-spacing:.08em;text-transform:uppercase;vertical-align:middle}',
      '.rjp-desc{font-size:9.5px;font-weight:600;color:var(--muted);line-height:1.35}',
      '.rjp-buy{flex-shrink:0;padding:8px 12px;border-radius:8px;background:rgba(255,179,0,.10);color:var(--amber);border:1px solid rgba(255,179,0,.30);font-family:inherit;font-size:10.5px;font-weight:900;font-variant-numeric:tabular-nums;cursor:pointer;white-space:nowrap;transition:background .15s}',
      '.rjp-buy:hover{background:rgba(255,179,0,.18)}',
      '.rjp-buy:disabled{opacity:.3;cursor:not-allowed}'
    ].join("");
    var st = document.createElement("style"); st.id = "rj-focus-css"; st.textContent = css;
    document.head.appendChild(st);
  }
  var _origRTS = null;
  function wrapTrainScreen() {
    if (typeof window.renderTrainScreen !== "function") return false;
    if (window.renderTrainScreen._rjFocus) return true;
    _origRTS = window.renderTrainScreen;
    window.renderTrainScreen = function () {
      var r = _origRTS.apply(this, arguments);
      try { renderFocusUI(); } catch (e) {}
      return r;
    };
    window.renderTrainScreen._rjFocus = true;
    return true;
  }

  function install() {
    if (window._rjTrainInstalled) return;
    window._rjTrainInstalled = true;
    try { injectFocusCSS(); } catch (e) {}
    try {
      var tries = 0;
      (function tryWrap() {
        var a = false, b = false;
        try { a = wrapTrainScreen(); if (a) { try { renderFocusUI(); } catch (e) {} } } catch (e) {}
        try { b = wrapNextSeason(); } catch (e) {}
        if (a && b) return;
        if (tries++ < 40 && typeof setTimeout === "function") setTimeout(tryWrap, 150);
      })();
    } catch (e) {}
    window._rjTrain = {
      FOCUS: FOCUS, FOCUS_KEYS: FOCUS_KEYS, PREMIUM: PREMIUM,
      runFocus: runFocus, computeFocusOutcome: computeFocusOutcome, runPremium: runPremium,
      doRest: doRest, lowestFocus: lowestFocus, renderFocusUI: renderFocusUI,
      premiumUsedThisWeek: premiumUsedThisWeek, resetSeasonState: resetSeasonState,
      ageMult: ageMult, coachActive: coachActive
    };
    window._rjTrainUninstall = function () {
      if (_origRTS) window.renderTrainScreen = _origRTS;
      if (_origNextSeason) window.startNextSeason = _origNextSeason;
      var s = document.getElementById("rj-focus-css"); if (s && s.parentNode) s.parentNode.removeChild(s);
      window._rjTrainInstalled = false;
      console.log("[38-training-rework] désinstallé");
    };
    console.log("[38-training-rework] actif — focus + premium + UI");
  }

  install();
})();


/* ==================================================================== *
 * Vivier de pilotes — équilibrage des effectifs
 * (anciennement 71-vivier-equilibre.js)
 * ==================================================================== */

(function () {
  "use strict";

  var TAG = "[71-vivier-equilibre]";
  var wrapped = {};
  var etat = { installe: false, passes: 0, dernier: null, cumul: null, erreur: null };
  window._rj71Status = function () { return etat; };

  var CATS = ["Karting Junior", "Karting Senior", "Formule 4", "Formula Regional",
              "Formule 3", "Formule 2", "Formule 1", "Super Formula",
              "Endurance WEC", "IndyCar"];

  // Effectifs cibles, calqués sur les grilles réelles de chaque série.
  var CIBLE = {
    "Karting Junior": 20, "Karting Senior": 20, "Formule 4": 22,
    "Formula Regional": 20, "Formule 3": 22, "Formule 2": 20,
    "Formule 1": 20, "Super Formula": 18, "Endurance WEC": 18, "IndyCar": 22
  };
  var TOLERANCE = 3;        // au-delà de cible + tolérance, on fait descendre
  var PLANCHER = 0.7;       // une catégorie ne descend pas sous 70 % de sa cible

  var AGES = {
    "Karting Junior":   { min: 8,  max: 15, entree: [9, 12] },
    "Karting Senior":   { min: 12, max: 18, entree: [13, 16] },
    "Formule 4":        { min: 14, max: 20, entree: [15, 17] },
    "Formula Regional": { min: 15, max: 22, entree: [16, 19] },
    "Formule 3":        { min: 16, max: 24, entree: [17, 21] },
    "Formule 2":        { min: 17, max: 27, entree: [18, 23] },
    "Formule 1":        { min: 17, max: 42, entree: [19, 30] },
    "Super Formula":    { min: 17, max: 40, entree: [19, 30] },
    "Endurance WEC":    { min: 17, max: 46, entree: [21, 36] },
    "IndyCar":          { min: 17, max: 42, entree: [20, 32] }
  };

  // Niveau attendu à l'entrée de chaque catégorie.
  var NIVEAU = {
    "Karting Junior": 42, "Karting Senior": 48, "Formule 4": 54,
    "Formula Regional": 59, "Formule 3": 64, "Formule 2": 70,
    "Formule 1": 78, "Super Formula": 72, "Endurance WEC": 70, "IndyCar": 72
  };

  var RETRAITE_AGE_MIN = 24;   // en dessous, on descend, on ne raccroche pas

  /* ------------------------------------------------------------ outils --- */
  function pool() { try { return G.driverPool || []; } catch (e) { return []; } }
  function actifs() { return pool().filter(function (d) { return d && !d.retired; }); }
  function dansCat(cat) { return actifs().filter(function (d) { return d.cat === cat; }); }
  function estJoueur(d) { return !!(d && (d.isPlayer || d.id === "__joueur")); }

  function catDessous(cat) {
    var i = CATS.indexOf(cat);
    return (i > 0 && i <= 6) ? CATS[i - 1] : (i > 6 ? "Formule 2" : null);
  }
  function catDessus(cat) {
    try {
      if (typeof CAT_PATHS !== "undefined" && CAT_PATHS && CAT_PATHS[cat] && CAT_PATHS[cat].length) {
        return CAT_PATHS[cat][0];
      }
    } catch (e) {}
    var i = CATS.indexOf(cat);
    return (i >= 0 && i < 6) ? CATS[i + 1] : null;
  }

  function ageOk(cat, age) {
    var a = AGES[cat];
    return !a || (age >= a.min && age <= a.max);
  }

  function equipesDe(cat) {
    var t = {}, out = [];
    dansCat(cat).forEach(function (d) { if (d.team && !t[d.team]) { t[d.team] = 1; out.push(d.team); } });
    return out;
  }

  function nouveauPilote(cat) {
    var a = AGES[cat] || { entree: [18, 24] };
    var age = a.entree[0] + Math.floor(Math.random() * (a.entree[1] - a.entree[0] + 1));
    var niveau = (NIVEAU[cat] || 60) + Math.floor(Math.random() * 9) - 4;

    var d = null;
    try {
      if (typeof _generateNewKartingRookie === "function") d = _generateNewKartingRookie(cat);
    } catch (e) {}
    if (!d) {
      d = {
        id: "rj71_" + Date.now().toString(36) + "_" + Math.floor(Math.random() * 99999),
        name: "Pilote " + Math.floor(Math.random() * 9000 + 1000),
        consistency: 0.62 + Math.random() * 0.22
      };
    }
    d.cat = cat;
    d.age = age;
    d.skill = Math.max(30, Math.min(95, niveau));
    d.retired = false;
    if (typeof d.consistency !== "number") d.consistency = 0.62 + Math.random() * 0.22;
    var eq = equipesDe(cat);
    if (!d.team || eq.indexOf(d.team) < 0) d.team = eq.length ? eq[Math.floor(Math.random() * eq.length)] : "Indépendant";
    d._rj71Arrivee = true;
    return d;
  }

  /* ------------------------------------------------------- rééquilibrage --- */
  function equilibrer() {
    var p = pool();
    if (!p.length) return null;

    var bilan = { retraitesAnnulees: 0, descentes: 0, promotions: 0, arrivees: 0, retraitesAgees: 0 };

    // a. Retraites précoces annulées : à moins de 24 ans on descend d'un cran.
    p.forEach(function (d) {
      if (!d || estJoueur(d) || !d.retired) return;
      var age = (typeof d.age === "number") ? d.age : 99;
      if (age >= RETRAITE_AGE_MIN) return;
      // Un jeune trop âgé pour sa catégorie doit MONTER, pas rester : c'est
      // le cas du karting, qu'on quitte par le haut. Ne tenter la descente
      // que si la promotion n'est pas envisageable. Sans ça, un pilote de 18
      // ans en Karting Junior était dé-retraité par cette règle puis remis à
      // la retraite par la suivante, à chaque saison.
      var dest = d.cat;
      if (!ageOk(dest, age)) {
        var haut = catDessus(d.cat);
        var bas = catDessous(d.cat);
        if (haut && ageOk(haut, age)) dest = haut;
        else if (bas && ageOk(bas, age)) dest = bas;
        else if (haut) dest = haut;
      }
      // un champion banni ne redescend jamais dans sa catégorie interdite
      if (d._rjBanni && d._rjBanni.indexOf(dest) >= 0) {
        var alt = catDessus(dest);
        if (alt) dest = alt;
      }
      d.retired = false;
      d.cat = dest;
      bilan.retraitesAnnulees++;
    });

    // a bis. À l'inverse, les trop âgés pour leur catégorie sortent vraiment.
    actifs().forEach(function (d) {
      if (estJoueur(d)) return;
      var a = AGES[d.cat];
      if (a && typeof d.age === "number" && d.age > a.max + 2) {
        d.retired = true;
        bilan.retraitesAgees++;
      }
    });

    // b. Excédents : les plus faibles et les plus âgés redescendent.
    CATS.forEach(function (cat) {
      var liste = dansCat(cat).filter(function (d) { return !estJoueur(d); });
      var surplus = liste.length - (CIBLE[cat] + TOLERANCE);
      if (surplus <= 0) return;
      liste.sort(function (x, y) {
        var dx = (x.skill || 0) - (y.skill || 0);
        if (dx !== 0) return dx;
        return (y.age || 0) - (x.age || 0);
      });
      var bas = catDessous(cat);
      for (var i = 0; i < surplus && i < liste.length; i++) {
        var d = liste[i];
        if (bas && ageOk(bas, d.age || 20) && !(d._rjBanni && d._rjBanni.indexOf(bas) >= 0)) {
          d.cat = bas;
          bilan.descentes++;
        } else {
          d.retired = true;
          bilan.retraitesAgees++;
        }
      }
    });

    // c. Promotions depuis la catégorie inférieure, du haut vers le bas pour
    //    que la vague remonte toute la filière en une passe.
    for (var k = CATS.length - 1; k >= 1; k--) {
      var cat = CATS[k];
      var manque = CIBLE[cat] - dansCat(cat).length;
      if (manque <= 0) continue;
      var source = catDessous(cat);
      if (!source) continue;
      var dispo = dansCat(source).filter(function (d) {
        return !estJoueur(d) && ageOk(cat, d.age || 20);
      });
      var minSource = Math.floor(CIBLE[source] * PLANCHER);
      var cedables = Math.max(0, dansCat(source).length - minSource);
      var n = Math.min(manque, cedables, dispo.length);
      if (n <= 0) continue;
      dispo.sort(function (x, y) { return (y.skill || 0) - (x.skill || 0); });
      for (var i = 0; i < n; i++) { dispo[i].cat = cat; bilan.promotions++; }
    }

    // d. Ce qui manque encore vient de l'extérieur : autres championnats,
    //    reconversions, pilotes venus d'ailleurs. C'est la porte d'entrée
    //    qui manquait à toutes les catégories sauf le Karting Junior.
    CATS.forEach(function (cat) {
      var manque = CIBLE[cat] - dansCat(cat).length;
      for (var i = 0; i < manque; i++) {
        var d = nouveauPilote(cat);
        if (d) { pool().push(d); bilan.arrivees++; }
      }
    });

    etat.passes++;
    etat.dernier = bilan;
    if (!etat.cumul) etat.cumul = { retraitesAnnulees: 0, descentes: 0, promotions: 0, arrivees: 0, retraitesAgees: 0 };
    Object.keys(bilan).forEach(function (k) { etat.cumul[k] += bilan[k]; });

    console.log(TAG + " saison rééquilibrée — " + bilan.promotions + " promotions, " +
                bilan.descentes + " descentes, " + bilan.arrivees + " arrivées, " +
                bilan.retraitesAnnulees + " retraites précoces annulées, " +
                bilan.retraitesAgees + " fins de carrière");
    return bilan;
  }

  /* -------------------------------- abandon silencieux du départ ------- */
  function installerJournalDepart() {
    if (typeof window.runRaceLive !== "function" || window.runRaceLive._rj71) return false;
    var orig = window.runRaceLive;
    var fn = function () {
      var avant = 0;
      try { avant = (G.races || []).length; } catch (e) {}
      var r = orig.apply(this, arguments);
      try {
        setTimeout(function () {
          var demarre = false;
          try {
            demarre = (typeof LIVE_RACE !== "undefined" && LIVE_RACE && (LIVE_RACE.total > 0 || LIVE_RACE.cur > 0)) ||
                      ((G.races || []).length > avant);
          } catch (e) {}
          if (!demarre) {
            var ctx = {};
            try { ctx.weekend = (typeof RACE_WEEKEND_STATE !== "undefined") ? RACE_WEEKEND_STATE : "absent"; } catch (e) {}
            try { ctx.qualiPhase = (typeof QUALI_STATE !== "undefined" && QUALI_STATE) ? QUALI_STATE.phase : "absent"; } catch (e) {}
            try { ctx.circuit = (typeof RACE_STATE !== "undefined") ? RACE_STATE.circuit : "absent"; } catch (e) {}
            try { ctx.qualiPos = (typeof RACE_STATE !== "undefined") ? RACE_STATE.qualiPos : null; } catch (e) {}
            try { ctx.rivaux = (G.rivals || []).length; } catch (e) {}
            try { ctx.cat = G.cat; } catch (e) {}
            console.warn(TAG + " départ sans effet — la course n'a pas démarré. État : " +
                         JSON.stringify(ctx));
          }
        }, 900);
      } catch (e) {}
      return r;
    };
    fn._rj71 = true;
    wrapped.runRaceLive = orig;
    window.runRaceLive = fn;
    return true;
  }

  /* ---------------------------------------------------------- montage --- */
  function installer() {
    var ok = false;
    if (typeof window.startNextSeason === "function" && !window.startNextSeason._rj71) {
      var orig = window.startNextSeason;
      var fn = function () {
        var r = orig.apply(this, arguments);
        try { equilibrer(); } catch (e) { etat.erreur = String(e && e.message || e); console.warn(TAG, e); }
        try { if (typeof saveGame === "function") saveGame((G && G._slot) || 0); } catch (e) {}
        return r;
      };
      fn._rj71 = true;
      wrapped.startNextSeason = orig;
      window.startNextSeason = fn;
      ok = true;
    }
    installerJournalDepart();
    return ok;
  }

  var essais = 0;
  function boot() {
    var ok = false;
    try { ok = installer(); } catch (e) { etat.erreur = String(e && e.message || e); }
    if (!ok && essais++ < 120) { setTimeout(boot, 100); return; }
    etat.installe = true;
    console.log(TAG + " actif — effectifs cibles par catégorie, descentes réactivées, " +
                "retraites calibrées sur l'âge");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj71Equilibrer = function () { return equilibrer(); };
  window._rj71Effectifs = function () {
    var out = {};
    CATS.forEach(function (c) { out[c] = dansCat(c).length + "/" + CIBLE[c]; });
    out._actifs = actifs().length;
    console.log(JSON.stringify(out, null, 1));
    return out;
  };
  window._rj71Uninstall = function () {
    Object.keys(wrapped).forEach(function (k) { window[k] = wrapped[k]; });
    etat.installe = false;
    console.log(TAG + " désinstallé");
  };
})();
