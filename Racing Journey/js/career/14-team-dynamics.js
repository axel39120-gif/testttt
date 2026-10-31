/* =============================================================================
 * 14-team-dynamics.js — DYNAMIQUE D'ÉCURIE (enjeux contractuels)
 * =============================================================================
 *
 * OBJECTIF
 * --------
 * Donner du POIDS à la relation pilote / écurie, en s'appuyant sur les systèmes
 * existants (TEAM_TRUST, objectifs de saison, getTeammateRival, rôles pilote)
 * SANS toucher aux fichiers cœur. Trois apports :
 *
 *   1. BENCHMARK COÉQUIPIER — un face-à-face de saison (qualif + course)
 *      contre le coéquipier désigné (getTeammateRival), suivi course par
 *      course, surfacé dans le feed et les courriers de bilan.
 *
 *   2. ÉVICTION — l'écurie peut te mettre dehors :
 *        • EN FIN DE SAISON si la confiance est basse ET les objectifs
 *          principaux ratés (même s'il reste des années de contrat).
 *        • EN COURS DE SAISON, très rarement, en cas d'effondrement total.
 *      Conséquence : contrat résilié, offres de repli (souvent moins bien,
 *      parfois un baquet de réserviste), risque de rétrogradation si tu ne
 *      retrouves pas de volant — le flux d'intersaison existant s'en charge.
 *
 *   3. RÔLE PILOTE N°3 (réserviste / essayeur) — un quatrième rôle sous
 *      num2 : objectifs allégés, salaire réduit, mais une voie de promotion
 *      vers titulaire (num2) si tu impressionnes.
 *
 * ARCHITECTURE (Option A — enrichissement sûr)
 * --------------------------------------------
 *   - Wraps non invasifs : getRoleInfo, _getRoleDesc, buildOffer,
 *     generateSeasonObjectives, evaluateSeasonTrust.
 *   - Hook RACE_POST_HOOKS : suivi H2H + éviction mi-saison.
 *   - Persistance : G._entityMemory.td14 (déjà sérialisé par le save).
 *   - Pattern bootstrap/retry, log d'activation, try/catch partout.
 *
 * ORDRE DE CHARGEMENT
 * -------------------
 *   À charger APRÈS 03/04 (cœur), 11 (neg-patch wrappe signContract) et 13.
 * ===========================================================================*/
(function () {
  'use strict';
  var TAG = '[14-team-dynamics]';

  /* ----------------------------------------------------------------------- *
   *  Helpers généraux
   * ----------------------------------------------------------------------- */
  function G_() { return (typeof window !== 'undefined' && window.G) ? window.G : null; }
  function has(name) { return typeof window[name] !== 'undefined'; }
  function fn(name) { return typeof window[name] === 'function'; }

  // État persistant rangé dans _entityMemory (sérialisé par le save cœur).
  function mem() {
    var G = G_(); if (!G) return {};
    if (!G._entityMemory) G._entityMemory = {};
    if (!G._entityMemory.td14) G._entityMemory.td14 = {};
    return G._entityMemory.td14;
  }

  function isRealTeam() {
    var G = G_();
    return !!(G && G.currentTeam && G.currentTeam !== 'Indépendant');
  }
  // Catégories « professionnelles » où une éviction par l'écurie a du sens.
  // (On épargne le karting, géré par les parents.)
  function isProCategory() {
    var G = G_();
    if (!G || !has('CATEGORIES')) return false;
    var idx = window.CATEGORIES.indexOf(G.cat);
    return idx >= 2; // Formule 4 et au-dessus
  }
  function seasonNum() { var G = G_(); return G ? (G.saison || 1) : 1; }
  function calRaces() {
    if (has('CAL_RACES') && window.CAL_RACES && window.CAL_RACES.length) return window.CAL_RACES.length;
    return 10;
  }
  function lastName(full) {
    if (!full) return 'ton coéquipier';
    var p = String(full).trim().split(/\s+/);
    return p[p.length - 1] || full;
  }

  /* ======================================================================= *
   *  (3) RÔLE PILOTE N°3
   * ======================================================================= */
  function installRoleNum3() {
    // --- getRoleInfo : badge / libellé du rôle ---
    if (fn('getRoleInfo') && !window.getRoleInfo._td14) {
      var origInfo = window.getRoleInfo;
      window.getRoleInfo = function (e) {
        if (e === 'num3') {
          return {
            label: 'Pilote N°3',
            short: 'N°3',
            color: 'var(--soft)',
            bg: 'rgba(148,163,184,.10)',
            border: 'var(--border-hi)',
            icon: '🔧'
          };
        }
        return origInfo.apply(this, arguments);
      };
      window.getRoleInfo._td14 = true;
    }

    // --- _getRoleDesc : description longue du rôle ---
    if (fn('_getRoleDesc') && !window._getRoleDesc._td14) {
      var origDesc = window._getRoleDesc;
      window._getRoleDesc = function (e, t) {
        if (e === 'num3') {
          return 'Pilote de réserve / essais · Objectifs allégés · Impressionne pour décrocher un baquet titulaire';
        }
        return origDesc.apply(this, arguments);
      };
      window._getRoleDesc._td14 = true;
    }

    // --- buildOffer : salaire/coût d'une offre N°3 ---
    // buildOffer applique 1.15 (num1) / 1.05 (equal) / 1 (num2). On ajoute un
    // facteur < 1 pour N°3 en post-traitement (sans toucher au cœur).
    if (fn('buildOffer') && !window.buildOffer._td14) {
      var origBuild = window.buildOffer;
      window.buildOffer = function (e) {
        var offer = origBuild.apply(this, arguments);
        try {
          if (offer && e && e.role === 'num3') {
            offer.role = 'num3';
            offer.salary = 100 * Math.round((offer.salary || 0) * 0.55 / 100);
            offer.cost = Math.round((offer.cost || 0) * 0.4); // baquet de réserve : peu/pas payant
          }
        } catch (err) { /* no-op */ }
        return offer;
      };
      window.buildOffer._td14 = true;
    }
  }

  /* ======================================================================= *
   *  (1) BENCHMARK COÉQUIPIER — face-à-face de saison
   * ======================================================================= */
  function h2h() {
    var m = mem();
    if (!m.h2h || m.h2h.season !== seasonNum()) {
      var mate = (fn('getTeammateRival') && window.getTeammateRival()) || null;
      m.h2h = {
        season: seasonNum(),
        mateName: mate && mate.name ? mate.name : '',
        qW: 0, qL: 0,   // qualifs gagnées / perdues vs coéquipier
        rW: 0, rL: 0,   // courses gagnées / perdues
        races: 0,
        midPosted: false
      };
    }
    return m.h2h;
  }

  // Retrouve le coéquipier dans le plateau de course (LIVE_RACE.drivers).
  function findMateDriver(drivers) {
    var G = G_();
    if (!drivers || !drivers.length || !G) return null;
    var mateRival = (fn('getTeammateRival') && window.getTeammateRival()) || null;
    var targetName = mateRival && mateRival.name ? mateRival.name : null;
    var byName = null, byTeam = null;
    for (var i = 0; i < drivers.length; i++) {
      var d = drivers[i];
      if (!d || d.isPlayer) continue;
      if (targetName && d.name === targetName) { byName = d; break; }
      if (!byTeam && d.team && d.team === G.currentTeam) byTeam = d;
    }
    return byName || byTeam;
  }

  // pos « DNF » : le moteur utilise 0 (isDnf:0===pos). On considère 0/null/falsy = DNF.
  function isDnfPos(p) { return !p || p === 0; }

  function updateH2H(ev) {
    var G = G_();
    if (!G || !isRealTeam() || !isProCategory()) return;
    var rec = h2h();
    var mate = findMateDriver(ev && ev.drivers);
    if (!mate) return;
    if (!rec.mateName && mate.name) rec.mateName = mate.name;

    var playerRacePos = (ev && typeof ev.pos === 'number') ? ev.pos : (G.lastRacePos || null);
    var mateRacePos = (typeof mate.pos === 'number') ? mate.pos : null;

    // --- Face-à-face COURSE ---
    if (mateRacePos !== null) {
      var pDnf = isDnfPos(playerRacePos), mDnf = isDnfPos(mateRacePos);
      if (!(pDnf && mDnf)) {
        if (pDnf && !mDnf) { rec.rL++; }
        else if (!pDnf && mDnf) { rec.rW++; }
        else if (playerRacePos < mateRacePos) { rec.rW++; }
        else if (playerRacePos > mateRacePos) { rec.rL++; }
      }
    }

    // --- Face-à-face QUALIF (si grille connue : startPos = position de départ) ---
    var pQ = (typeof G.qualiPos === 'number') ? G.qualiPos : null;
    var mQ = (typeof mate.startPos === 'number') ? mate.startPos : null;
    if (pQ !== null && mQ !== null) {
      if (pQ < mQ) rec.qW++;
      else if (pQ > mQ) rec.qL++;
    }

    rec.races++;

    // --- Surfaçage léger : un post de feed à mi-saison ---
    var half = Math.max(2, Math.floor(calRaces() / 2));
    if (!rec.midPosted && rec.races >= half && (rec.rW + rec.rL) >= 2) {
      rec.midPosted = true;
      postH2HFeed(rec, false);
    }
  }

  function h2hSummaryText(rec) {
    var name = lastName(rec.mateName);
    var parts = [];
    if ((rec.rW + rec.rL) > 0) parts.push('Courses ' + rec.rW + '\u2013' + rec.rL);
    if ((rec.qW + rec.qL) > 0) parts.push('Qualifs ' + rec.qW + '\u2013' + rec.qL);
    var detail = parts.length ? ' (' + parts.join(' \u00b7 ') + ')' : '';
    var lead;
    if (rec.rW > rec.rL) lead = 'devant ' + name;
    else if (rec.rW < rec.rL) lead = 'derrière ' + name;
    else lead = 'à égalité avec ' + name;
    return 'Duel interne : ' + lead + detail + '.';
  }

  function postH2HFeed(rec, seasonEnd) {
    var G = G_();
    if (!fn('_addFeedPost') || !rec || (rec.rW + rec.rL) === 0) return;
    try {
      var who = (G.pilot && G.pilot.prenom ? G.pilot.prenom + ' ' : '') + (G.pilot && G.pilot.nom ? G.pilot.nom : '');
      var name = lastName(rec.mateName);
      var body;
      if (seasonEnd) {
        if (rec.rW > rec.rL) body = who + ' boucle la saison devant son coéquipier ' + name + ' : ' + rec.rW + '\u2013' + rec.rL + ' en course. Argument de poids pour la suite.';
        else if (rec.rW < rec.rL) body = name + ' a dominé le duel interne face à ' + who + ' cette saison (' + rec.rL + '\u2013' + rec.rW + '). Du travail en perspective.';
        else body = 'Duel interne 100 % serré entre ' + who + ' et ' + name + ' : ' + rec.rW + '\u2013' + rec.rL + ' à l\u2019arrivée.';
      } else {
        if (rec.rW > rec.rL) body = 'Mi-saison : ' + who + ' mène le duel maison face à ' + name + ' (' + rec.rW + '\u2013' + rec.rL + ').';
        else if (rec.rW < rec.rL) body = 'Mi-saison : ' + name + ' prend le dessus sur son coéquipier ' + who + ' (' + rec.rL + '\u2013' + rec.rW + ').';
        else body = 'Mi-saison : rien ne sépare ' + who + ' et ' + name + ' dans le clan ' + (G.currentTeam || '') + '.';
      }
      var acc = (has('SOCIAL_PRESS_ACCOUNTS') && window.SOCIAL_PRESS_ACCOUNTS && window.SOCIAL_PRESS_ACCOUNTS.length)
        ? window.SOCIAL_PRESS_ACCOUNTS[Math.floor(Math.random() * window.SOCIAL_PRESS_ACCOUNTS.length)]
        : { name: 'Paddock Insider', handle: '@paddock', color: '#38BDF8' };
      window._addFeedPost({ type: 'press', author: acc.name, handle: acc.handle, color: acc.color, body: body });
    } catch (err) { /* no-op */ }
  }

  /* ======================================================================= *
   *  Objectifs : allègement N°3 + voie de promotion
   * ======================================================================= */
  function installObjectivesWrap() {
    if (!fn('generateSeasonObjectives') || window.generateSeasonObjectives._td14) return;
    var orig = window.generateSeasonObjectives;
    window.generateSeasonObjectives = function () {
      var r = orig.apply(this, arguments);
      try {
        var G = G_();
        if (G && G._playerRole === 'num3' && has('TEAM_TRUST') && window.TEAM_TRUST && window.TEAM_TRUST.objectives) {
          var objs = window.TEAM_TRUST.objectives;
          objs.forEach(function (o) {
            // Réserviste : pression allégée — pénalités fortement réduites,
            // objectifs « principaux » rétrogradés en secondaires.
            if (o.type === 'main') o.type = 'secondary';
            if (typeof o.penalty === 'number') o.penalty = Math.round(o.penalty * 0.4);
            if (typeof o.reward === 'number') o.reward = Math.round(o.reward * 0.8);
          });
          // Objectif de promotion : se montrer pour gagner un baquet titulaire.
          if (!objs.some(function (o) { return o.id === 'td14_promo'; })) {
            objs.push({
              id: 'td14_promo',
              type: 'main',
              done: false,
              failed: false,
              title: 'Décrocher un baquet titulaire',
              desc: 'Impressionne l\u2019écurie (confiance \u2265 60) pour passer titulaire.',
              target: 60,
              reward: 10,
              penalty: -4,
              check: function () {
                return (has('TEAM_TRUST') && window.TEAM_TRUST) ? (window.TEAM_TRUST.value >= this.target) : null;
              }
            });
          }
        }
      } catch (err) { console.warn(TAG, 'objectives wrap:', err); }
      return r;
    };
    window.generateSeasonObjectives._td14 = true;
  }

  /* ======================================================================= *
   *  (2) ÉVICTION — fin de saison & mi-saison
   * ======================================================================= */

  // Construit et empile des offres de repli dans G.offers après une éviction.
  function generateRecoveryOffers(opts) {
    var G = G_();
    if (!G || !fn('buildOffer')) return;
    opts = opts || {};
    var firedTeam = opts.firedTeam || G.currentTeam;
    var cat = G.cat;
    var pool = (has('TEAM_OFFERS') && window.TEAM_OFFERS && window.TEAM_OFFERS[cat]) ? window.TEAM_OFFERS[cat] : [];
    if (!G.offers) G.offers = [];

    function teamRating(team) {
      return (fn('getEffectiveTeamRating') ? window.getEffectiveTeamRating(team) : 72);
    }
    function alreadyOffered(team) {
      return G.offers.some(function (o) { return o.team === team && o.cat === cat; });
    }
    function pushOffer(tmpl, role) {
      if (!tmpl || tmpl.team === firedTeam || alreadyOffered(tmpl.team)) return false;
      try {
        var off = window.buildOffer({
          team: tmpl.team, cat: cat, role: role,
          cost: tmpl.cost, salary: tmpl.salary,
          bonusWin: tmpl.bonusWin, bonusPodium: tmpl.bonusPodium,
          duration: tmpl.dur || 1, extra: tmpl.extra || ''
        });
        if (!off) return false;
        off.name = tmpl.team + ' — ' + cat;
        off.repReq = 0;
        off.td14Recovery = true;
        G.offers.push(off);
        return true;
      } catch (err) { return false; }
    }

    // Offres triées par niveau d'écurie croissant (les plus faibles d'abord :
    // c'est le repli réaliste d'un pilote évincé).
    var sorted = pool.slice().sort(function (a, b) { return teamRating(a.team) - teamRating(b.team); });
    var added = 0;

    // 1 à 2 baquets titulaires (N°2) dans des écuries plus modestes.
    for (var i = 0; i < sorted.length && added < 2; i++) {
      if (pushOffer(sorted[i], 'num2')) added++;
    }
    // Éventuellement un baquet de réserviste (N°3) dans une écurie plus forte,
    // si la réputation le permet — porte d'entrée vers un retour au sommet.
    var rep = G.reputation || G.rep || 0;
    if (rep >= 45) {
      var strong = sorted[sorted.length - 1];
      pushOffer(strong, 'num3');
    }

    // Notifier la disponibilité d'offres.
    var dot = (typeof document !== 'undefined') && document.getElementById('ni-more-dot');
    if (dot) dot.style.display = 'block';
  }

  function removeRenewalOffer(team) {
    var G = G_();
    if (!G || !G.offers) return;
    var cat = G.cat;
    G.offers = G.offers.filter(function (o) { return !(o.team === team && o.cat === cat); });
  }

  function pressFiredPost(team) {
    var G = G_();
    if (!fn('_addFeedPost') || !has('SOCIAL_PRESS_ACCOUNTS')) return;
    try {
      var who = (G.pilot && G.pilot.prenom ? G.pilot.prenom + ' ' : '') + (G.pilot && G.pilot.nom ? G.pilot.nom : '');
      var acc = window.SOCIAL_PRESS_ACCOUNTS[Math.floor(Math.random() * window.SOCIAL_PRESS_ACCOUNTS.length)];
      window._addFeedPost({
        type: 'press', author: acc.name, handle: acc.handle, color: acc.color,
        body: 'OFFICIEL : ' + team + ' se sépare de ' + who + '. L\u2019écurie évoque des résultats en deçà des attentes. Le marché des transferts s\u2019emballe.'
      });
    } catch (err) { /* no-op */ }
  }

  // --- Éviction de FIN DE SAISON (après evaluateSeasonTrust) ---
  function evalEndSeasonFiring() {
    var G = G_();
    if (!G || !isRealTeam() || !isProCategory()) return;
    if (G.pendingTransfer) return;                 // le pilote part déjà ailleurs
    var m = mem();
    if (m.endEvalSeason === seasonNum()) return;    // déjà traité cette saison
    m.endEvalSeason = seasonNum();

    var TT = has('TEAM_TRUST') ? window.TEAM_TRUST : null;
    if (!TT) return;
    var trust = TT.value;
    var role = G._playerRole || 'num2';
    var mains = (TT.objectives || []).filter(function (o) { return o.type === 'main'; });
    var failedMains = mains.filter(function (o) { return o.failed; }).length;
    var doneMains = mains.filter(function (o) { return o.done; }).length;

    // --- Voie de PROMOTION du réserviste (N°3 -> N°2) ---
    if (role === 'num3') {
      if (trust >= 58 && (doneMains >= 1 || trust >= 70)) {
        promoteReserve();
        return;
      }
      // Réserviste très peu menacé : éviction seulement si effondrement net.
      if (trust < 18 && failedMains >= 1 && Math.random() < 0.30) {
        fireEndSeason(trust, failedMains, true);
      }
      return;
    }

    // --- Décision d'éviction (titulaires) ---
    var fire = false;
    if (trust < 22 && failedMains >= 2) fire = Math.random() < 0.90;
    else if (trust < 28 && failedMains >= 2) fire = Math.random() < 0.60;
    else if (trust < 35 && mains.length > 0 && failedMains >= mains.length) fire = Math.random() < 0.45;

    if (fire) fireEndSeason(trust, failedMains, false);
    else if (trust < 28 && failedMains >= 1) sendWarningMail(trust); // sursis
  }

  function promoteReserve() {
    var G = G_();
    G._playerRole = 'num2';
    mem().promotedSeason = seasonNum();
    if (fn('pushMail')) {
      window.pushMail({
        from: 'Direction sportive — ' + (G.currentTeam || 'l\u2019\u00e9curie'),
        role: 'team_boss',
        subject: 'Promotion : tu passes titulaire',
        body: 'On a vu ce que tu as fait en tant que réserviste, et ça nous a convaincus. À partir de la saison prochaine, tu es pilote titulaire (N°2) de l\u2019écurie. Félicitations — maintenant, prouve-nous qu\u2019on a eu raison.',
        actions: [{ label: 'Je suis prêt', kind: 'dismiss', responseBody: 'Merci pour votre confiance. Je ne vais pas vous décevoir.' }]
      });
    }
  }

  function sendWarningMail(trust) {
    var G = G_();
    if (!fn('pushMail')) return;
    var rec = h2h();
    var h2hLine = (rec && (rec.rW + rec.rL) > 0) ? (' ' + h2hSummaryText(rec)) : '';
    window.pushMail({
      from: 'Direction sportive — ' + (G.currentTeam || 'l\u2019\u00e9curie'),
      role: 'team_boss',
      subject: 'Mise au point avant la saison prochaine',
      body: 'On va être direct : cette saison n\u2019est pas à la hauteur de nos attentes. On te garde, mais c\u2019est un sursis. Il faut un net redressement, sinon on devra envisager autre chose.' + h2hLine,
      actions: [{ label: 'Compris, je hausse le niveau', kind: 'dismiss', responseBody: 'Message reçu. Je vais tout donner pour inverser la tendance.' }]
    });
  }

  function fireEndSeason(trust, failedMains, wasReserve) {
    var G = G_();
    var team = G.currentTeam;
    var m = mem();
    m.lastFired = { team: team, season: seasonNum(), mode: 'season-end' };

    // Résilier : on force la fin de contrat même s'il restait des années.
    G.contractDur = 0;
    G._contractExpired = true;
    G._firedByTeam = true; // (info transitoire ; persistée via lastFired)

    removeRenewalOffer(team);

    var rec = h2h();
    var h2hLine = (rec && (rec.rW + rec.rL) > 0) ? (' ' + h2hSummaryText(rec)) : '';
    var roleWord = wasReserve ? 'de réserviste' : 'titulaire';

    if (fn('pushMail')) {
      window.pushMail({
        from: 'Direction sportive — ' + (team || 'l\u2019\u00e9curie'),
        role: 'team_boss',
        subject: 'Fin de collaboration avec ' + (team || 'l\u2019\u00e9curie'),
        body: 'C\u2019est une décision difficile mais elle est prise : nous mettons fin à ton contrat ' + roleWord + '. Les objectifs n\u2019ont pas été atteints (' + failedMains + ' objectif(s) principal(aux) manqué(s)) et la confiance n\u2019y est plus. Nous te remercions pour ton travail et te souhaitons bonne continuation.' + h2hLine,
        actions: [{ label: 'Encaisser le coup', kind: 'dismiss', responseBody: 'Je comprends. Je rebondirai ailleurs.' }]
      });
    }
    if (fn('pushMail') && G.agent) {
      var isParent = (G.agent.type === 'parent');
      window.pushMail({
        from: isParent ? (G.agent.firstName || (G.agent.parentRole === 'mother' ? 'Maman' : 'Papa')) : (G.agent.name || 'Ton agent'),
        role: 'agent',
        subject: 'On rebondit',
        body: isParent
          ? 'Je sais que ça fait mal d\u2019\u00eatre remercié par ' + team + '. Mais ce n\u2019est pas la fin. Regarde les offres qui arrivent, même si elles sont en dessous — l\u2019important c\u2019est de garder un volant et de te relancer.'
          : 'Pas le temps de s\u2019apitoyer. ' + team + ' t\u2019a lâché, on prospecte déjà. J\u2019ai fait remonter quelques pistes — certaines sont des paliers en dessous, voire un baquet de réserve, mais c\u2019est une porte pour revenir. À toi de jouer.',
        actions: [{ label: 'Voir les offres', kind: 'dismiss', responseBody: 'OK, je regarde ça tout de suite.' }]
      });
    }

    generateRecoveryOffers({ firedTeam: team });
    pressFiredPost(team);
    postH2HFeed(rec, true);
  }

  // --- Éviction de MI-SAISON (très rare) ---
  function evalMidSeasonFiring(ev) {
    var G = G_();
    if (!G || !isRealTeam() || !isProCategory()) return;
    var role = G._playerRole || 'num2';
    if (role === 'num3') return;                    // un réserviste n'est pas viré en course
    var m = mem();
    if (m.midFiredSeason === seasonNum()) return;    // une seule fois par saison
    if (m.endEvalSeason === seasonNum()) return;     // saison déjà soldée

    var total = calRaces();
    var raced = (G.races ? G.races.length : 0);
    if (raced < Math.ceil(0.60 * total)) return;     // pas avant ~60 % de saison
    if (raced > total - 2) return;                    // laisser la fin de saison gérer

    var TT = has('TEAM_TRUST') ? window.TEAM_TRUST : null;
    if (!TT || TT.value > 14) return;                 // confiance au plancher uniquement

    // Effondrement récent : série noire mentale ou 3 dernières courses désastreuses.
    var streakBad = (has('PILOT_MENTAL') && window.PILOT_MENTAL) ? (window.PILOT_MENTAL.streakBad || 0) : 0;
    var last3Bad = false;
    if (G.races && G.races.length >= 3) {
      var l3 = G.races.slice(-3);
      last3Bad = l3.every(function (r) { return !r.pos || r.pos === 0 || r.pos > 12; });
    }
    if (streakBad < 4 && !last3Bad) return;

    // Objectif championnat hors d'atteinte (s'il existe).
    var champObjLost = (TT.objectives || []).some(function (o) {
      return o.id === 'champ_pos' && o.type === 'main' && (G.champPos || 99) > (o.target + 4);
    });
    if (!champObjLost && streakBad < 5) return;

    // Tirage final : très rare.
    if (Math.random() >= 0.12) return;

    fireMidSeason();
  }

  function fireMidSeason() {
    var G = G_();
    var team = G.currentTeam;
    var m = mem();
    m.midFiredSeason = seasonNum();
    m.lastFired = { team: team, season: seasonNum(), mode: 'mid-season' };

    G.currentTeam = 'Indépendant';
    G.contractDur = 0;
    G._contractExpired = true;
    G._firedByTeam = true;

    if (fn('_expireEcurieSponsors')) {
      try { window._expireEcurieSponsors('Tu n\u2019es plus rattaché(e) à une écurie.'); } catch (e) { /* no-op */ }
    }

    if (fn('pushMail')) {
      window.pushMail({
        from: 'Direction sportive — ' + (team || 'l\u2019\u00e9curie'),
        role: 'team_boss',
        subject: 'Rupture de contrat immédiate',
        body: 'Nous ne pouvons pas attendre la fin de saison. Au vu des résultats, nous mettons fin à ton contrat avec effet immédiat. C\u2019est exceptionnel et radical, nous en avons conscience. Tu termines la saison sans notre écurie.',
        actions: [{ label: 'C\u2019est brutal', kind: 'dismiss', responseBody: 'Je n\u2019ai rien à ajouter.' }]
      });
    }
    if (fn('pushMail') && G.agent) {
      var isParent = (G.agent.type === 'parent');
      window.pushMail({
        from: isParent ? (G.agent.firstName || (G.agent.parentRole === 'mother' ? 'Maman' : 'Papa')) : (G.agent.name || 'Ton agent'),
        role: 'agent',
        subject: 'Du sang-froid',
        body: isParent
          ? 'C\u2019est violent d\u2019\u00eatre viré en pleine saison, je suis de tout c\u0153ur avec toi. On garde la tête haute, on finit la saison, et on prépare le rebond pour l\u2019an prochain.'
          : 'Un licenciement en cours de saison, c\u2019est rare et ça fait du bruit. On va transformer ça en histoire de revanche. Je travaille déjà les offres pour la saison prochaine.',
        actions: [{ label: 'On rebondit', kind: 'dismiss', responseBody: 'OK. On encaisse et on repart.' }]
      });
    }

    generateRecoveryOffers({ firedTeam: team });
    pressFiredPost(team);
  }

  function installTrustWrap() {
    if (!fn('evaluateSeasonTrust') || window.evaluateSeasonTrust._td14) return;
    var orig = window.evaluateSeasonTrust;
    window.evaluateSeasonTrust = function () {
      var res = orig.apply(this, arguments); // fixe done/failed + confiance finale
      try { evalEndSeasonFiring(); } catch (err) { console.warn(TAG, 'end-season firing:', err); }
      return res;
    };
    window.evaluateSeasonTrust._td14 = true;
  }

  /* ======================================================================= *
   *  Bootstrap
   * ======================================================================= */
  function installAll() {
    installRoleNum3();
    installObjectivesWrap();
    installTrustWrap();
  }

  function boot(retries) {
    var ready = (typeof window !== 'undefined') && window.G &&
                Array.isArray(window.RACE_POST_HOOKS) &&
                fn('evaluateSeasonTrust') && fn('getRoleInfo');
    if (!ready) {
      if (retries > 0) { setTimeout(function () { boot(retries - 1); }, 400); return; }
      console.warn(TAG, 'abandon — dépendances cœur introuvables (G / hooks / fonctions saison).');
      return;
    }

    installAll();

    // Réinstalle après coup au cas où le cœur (re)définit ces fonctions tard,
    // et pour passer par-dessus d'éventuels wraps d'autres modules.
    setTimeout(installAll, 1200);

    window.RACE_POST_HOOKS.push({
      id: 'td14_team_dynamics',
      run: function (ev) {
        try { updateH2H(ev); } catch (err) { console.warn(TAG, 'h2h:', err); }
        try { evalMidSeasonFiring(ev); } catch (err) { console.warn(TAG, 'mid-firing:', err); }
      }
    });

    // Diagnostic console.
    window.rjDebugTeamDynamics = function () {
      var G = G_();
      console.log(TAG, 'role =', G && G._playerRole, '| trust =', (has('TEAM_TRUST') ? window.TEAM_TRUST.value : '?'), '| H2H =', mem().h2h, '| lastFired =', mem().lastFired);
    };

    console.log(TAG, 'activé — face-à-face coéquipier + éviction (fin/mi-saison) + rôle Pilote N°3. Debug: rjDebugTeamDynamics()');
  }

  boot(50);
})();
