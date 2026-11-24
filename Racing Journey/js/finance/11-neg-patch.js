/// === Racing Journey: F1 Dreams ===
// Module: 11-neg-patch
// Extension du système de négociation :
//   - 8 nouvelles clauses & primes (championnat pilotes/constructeurs,
//     pré-saison garantie, clause de performance, jours médias limités,
//     prime de meilleur tour, bonus dépassements, clause anti-dump)
//   - Affichage dans _negSummaryHTML + _negActionsListHTML
//   - Application des primes en fin de saison (wrap showSeasonEnd)
//   - Calibrage patience/acceptance pour chaque nouvelle action
// ===========================================================================

(function _rjNegPatch() {
  'use strict';

  // =========================================================================
  // A. DÉFINITIONS DES NOUVELLES CLAUSES & PRIMES
  // =========================================================================

  // Chaque entrée : { id, labelSuccess, labelFail, detailSuccess, detailFail,
  //   patienceCost, acceptanceMod, applyFn, summaryLabel, summaryValueFn }

  var NEG_NEW_ACTIONS = {

    // -- PRIMES RÉSULTATS --

    'bonus_champ_driver': {
      section: 'primes',
      label: 'Prime championnat pilotes',
      sub: 'Si tu es champion cette saison',
      iconColor: '#FBBF24',
      patienceCost: 14,
      acceptanceMod: -0.08,
      labelSuccess: 'Prime champion pilotes accordée',
      labelFail: 'Prime champion pilotes refusée',
      apply: function(offer) {
        var base = offer.bonusWin || 1800;
        offer.cBonusChampDriver = Math.round(base * 4 / 500) * 500;
      },
      summaryKey: 'cBonusChampDriver',
      summaryLabel: 'Champion Pilotes',
      summaryColor: '#FBBF24',
      disabledIf: function(offer) { return !!offer.cBonusChampDriver; }
    },

    'bonus_champ_constructor': {
      section: 'primes',
      label: 'Prime championnat constructeurs',
      sub: 'Si ton écurie est championne',
      iconColor: '#F59E0B',
      patienceCost: 10,
      acceptanceMod: -0.04,
      labelSuccess: 'Prime constructeurs accordée',
      labelFail: 'Prime constructeurs refusée',
      apply: function(offer) {
        var base = offer.bonusWin || 1800;
        offer.cBonusChampConstructor = Math.round(base * 2.5 / 500) * 500;
      },
      summaryKey: 'cBonusChampConstructor',
      summaryLabel: 'Champion Constructeurs',
      summaryColor: '#F59E0B',
      disabledIf: function(offer) { return !!offer.cBonusChampConstructor; }
    },

    'bonus_fastest_lap': {
      section: 'primes',
      label: 'Prime meilleur tour en course',
      sub: 'Petit bonus par meilleur tour signé',
      iconColor: '#22D3EE',
      patienceCost: 5,
      acceptanceMod: 0.10,
      labelSuccess: 'Prime meilleur tour accordée',
      labelFail: 'Prime meilleur tour refusée',
      apply: function(offer) {
        var base = offer.bonusPodium || 700;
        offer.cBonusFastestLap = Math.round(base * 0.15 / 100) * 100;
      },
      summaryKey: 'cBonusFastestLap',
      summaryLabel: 'Meilleur tour',
      summaryColor: '#22D3EE',
      disabledIf: function(offer) { return !!offer.cBonusFastestLap; }
    },

    'bonus_top3_season': {
      section: 'primes',
      label: 'Prime Top 3 au championnat',
      sub: 'Si tu finis dans les 3 premiers',
      iconColor: '#34D399',
      patienceCost: 9,
      acceptanceMod: 0.02,
      labelSuccess: 'Prime Top 3 accordée',
      labelFail: 'Prime Top 3 refusée',
      apply: function(offer) {
        var base = offer.bonusWin || 1800;
        offer.cBonusTop3Season = Math.round(base * 1.5 / 500) * 500;
      },
      summaryKey: 'cBonusTop3Season',
      summaryLabel: 'Top 3 Saison',
      summaryColor: '#34D399',
      disabledIf: function(offer) { return !!offer.cBonusTop3Season; }
    },

    'clause_no_dump': {
      section: 'clauses',
      label: 'Clause anti-remplacement',
      sub: 'Ils ne peuvent pas te remplacer en cours de saison',
      iconColor: '#F97316',
      patienceCost: 16,
      acceptanceMod: -0.18,
      labelSuccess: 'Clause anti-remplacement accordée',
      labelFail: 'Clause anti-remplacement refusée',
      apply: function(offer) { offer.cNoDump = true; },
      summaryKey: 'cNoDump',
      summaryLabel: 'Anti-remplacement',
      summaryColor: '#F97316',
      disabledIf: function(offer) { return !!offer.cNoDump; }
    }
  };

  // =========================================================================
  // B à G. LES NOUVELLES ACTIONS DANS LA NÉGOCIATION (06)
  // Coût en patience, chance d'acceptation, résolution, résumé de l'offre,
  // boutons et routage : chaque fonction de la négociation reçoit un hook.
  // =========================================================================

  function _rjNegNouvelle(action) { return !!NEG_NEW_ACTIONS[action]; }

  function _rjNegChance(state, offer, action) {
    var def = NEG_NEW_ACTIONS[action];
    var base = state.patience / 100;
    var mod = def.acceptanceMod || 0;
    var agentBoost = (G.agent && G.agent.type !== 'parent') ? (G.agent.skill || 30) / 800 : 0;
    var repBoost = (G.reputation || 0) / 600;
    var chance = base + mod + agentBoost + repBoost;
    if (state.usedActions[action] && state.usedActions[action] >= 2) chance -= 0.15;
    return Math.max(0.05, Math.min(0.92, chance));
  }

  function _rjNegAppliquer(state, offer, action) {
    var def = NEG_NEW_ACTIONS[action];
    state.usedActions[action] = (state.usedActions[action] || 0) + 1;
    var cost = def.patienceCost;
    state.patience -= cost;
    state.lastActionCost = cost;
    var chance = _negComputeAcceptance(state, offer, action);
    state.lastChance = Math.round(chance * 100);
    var success = Math.random() < chance;
    state.lastSuccess = success;
    if (success) { try { def.apply(offer); } catch (e) {} }
    state.lastMsg = success ? def.labelSuccess : def.labelFail;
    var pat = state.patience;
    if (success) {
      state.lastDetail = pat > 60 ? "L'écurie reste très ouverte. Tu peux continuer à pousser."
        : pat > 30 ? "Ils acceptent, mais leur patience s'amenuise."
        : 'Ils acceptent du bout des lèvres. Attention à ne pas les pousser trop loin.';
    } else {
      state.lastDetail = pat > 50 ? 'Refus poli. Tu peux essayer autre chose.'
        : pat > 20 ? 'Refus ferme. Le ton se tend.' : 'Refus catégorique. Ils sont à bout.';
    }
    state.history.push({ action: action, success: success, patience: pat, msg: state.lastMsg });
    if (state.patience <= 0) {
      state.status = 'expired';
      state.lastDetail += " L'écurie met fin à la discussion.";
    }
    return state;
  }

  function _rjNegResume(html, offer) {
        // Primes négociées
        var primes = [];
        var clauses = [];

        Object.keys(NEG_NEW_ACTIONS).forEach(function(id) {
          var def = NEG_NEW_ACTIONS[id];
          var key = def.summaryKey;
          if (!offer[key]) return;
          var val = offer[key];
          var displayVal;
          if (typeof val === 'boolean') {
            displayVal = '✓';
          } else {
            displayVal = '+' + val.toLocaleString('fr-FR') + ' €';
          }
          var item = { label: def.summaryLabel, value: displayVal, color: def.summaryColor };
          if (def.section === 'primes') primes.push(item);
          else clauses.push(item);
        });

        if (primes.length > 0) {
          html += '<div style="margin-top:10px">';
          html += '<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:#FBBF24;letter-spacing:.12em;text-transform:uppercase;margin-bottom:5px">Primes négociées</div>';
          html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
          primes.forEach(function(p) {
            html += '<div class="neg-stat">';
            html += '<div class="neg-stat-label">' + p.label + '</div>';
            html += '<div class="neg-stat-value" style="color:' + p.color + '">' + p.value + '</div>';
            html += '</div>';
          });
          html += '</div></div>';
        }

        if (clauses.length > 0) {
          html += '<div style="margin-top:8px;padding:8px 10px;background:rgba(167,139,250,0.07);border-left:2px solid #A78BFA;border-radius:6px">';
          html += '<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:#A78BFA;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">Clauses</div>';
          html += '<div style="display:flex;flex-wrap:wrap;gap:5px">';
          clauses.forEach(function(c) {
            html += '<span style="padding:3px 8px;background:' + c.color + '15;border:1px solid ' + c.color + '40;border-radius:5px;font-size:10px;font-weight:700;color:' + c.color + '">' + c.label + '</span>';
          });
          html += '</div></div>';
        }

        return html;
  }

  rjInscrire("_negActionPatienceCost", { id: "11-neg-patch:cout", remplace: function (args, suite) {
    var def = NEG_NEW_ACTIONS[args[0]];
    return def ? def.patienceCost : suite();
  } });
  rjInscrire("_negComputeAcceptance", { id: "11-neg-patch:acceptation", remplace: function (args, suite) {
    return _rjNegNouvelle(args[2]) ? _rjNegChance(args[0], args[1], args[2]) : suite();
  } });
  rjInscrire("_negApplyAction", { id: "11-neg-patch:action", remplace: function (args, suite) {
    return _rjNegNouvelle(args[2]) ? _rjNegAppliquer(args[0], args[1], args[2]) : suite();
  } });
  rjInscrire("_negSummaryHTML", { id: "11-neg-patch:resume", apres: function (html, args) { return _rjNegResume(html, args[0]); } });
  rjInscrire("negDoAction", { id: "11-neg-patch:routage", remplace: function (args, suite) {
    var action = args[0];
    if (!_rjNegNouvelle(action)) return suite();
    var offer = G.offers[NEG_IDX];
    if (!offer || !NEG_STATE || NEG_STATE.status !== 'active') return;
    _negApplyAction(NEG_STATE, offer, action);
    if (typeof renderNegScreen === 'function') renderNegScreen();
  } });

  // =========================================================================
  // H. APPLICATION DES NOUVELLES CLAUSES À LA SIGNATURE (signContract)
  // =========================================================================

  (function _rjPatchSignContract() {
    function doPatch() {
      if (typeof window.signContract !== 'function') {
        setTimeout(doPatch, 400); return;
      }
      if (window.signContract._rjNegPatched) return;
      var orig = window.signContract;
      rjInscrire("signContract", { id: "11-neg-patch:signContract", ordre: -1700, remplace: function (args, suite) {
      var idx = args[0];
        var offer = G.offers && G.offers[idx];
        if (offer) {
          // Copier les nouvelles clauses sur G.pendingTransfer / G directement
          // On les stocke sur G pour les retrouver en fin de saison
          G._negClauses = G._negClauses || {};
          var keys = ['cBonusChampDriver','cBonusChampConstructor','cBonusFastestLap',
                      'cBonusTop3Season','cPreseasonGuaranteed','cMediaCap',
                      'cPerformanceClause','cNoDump'];
          keys.forEach(function(k) {
            if (offer[k] != null) G._negClauses[k] = offer[k];
            else delete G._negClauses[k];
          });
        }
        return suite();
      } });
      window.signContract._rjNegPatched = true;
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', doPatch);
    } else { doPatch(); }
  })();

  // =========================================================================
  // I. APPLICATION DES PRIMES EN FIN DE SAISON (wrap showSeasonEnd)
  // =========================================================================

  (function _rjPatchShowSeasonEnd() {
    function doPatch() {
      if (typeof window.showSeasonEnd !== 'function') {
        setTimeout(doPatch, 400); return;
      }
      if (window.showSeasonEnd._rjNegPatched) return;
      var orig = window.showSeasonEnd;
      rjInscrire("showSeasonEnd", { id: "11-neg-patch:showSeasonEnd", ordre: -1700, remplace: function (args, suite) {
        // Calculer et appliquer les primes avant l'affichage
        var bonusReport = _rjApplySeasonBonuses();
        var result = suite();
        // Injecter le rapport des primes dans le bilan de fin de saison
        if (bonusReport && bonusReport.length > 0) {
          setTimeout(function() {
            _rjInjectBonusReport(bonusReport);
          }, 200);
        }
        return result;
      } });
      window.showSeasonEnd._rjNegPatched = true;
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', doPatch);
    } else { doPatch(); }
  })();

  function _rjApplySeasonBonuses() {
    if (!G || !G._negClauses) return [];
    var clauses = G._negClauses;
    var report = [];

    // Calculer le classement final du pilote
    var standings = [];
    standings.push({ pts: G.champPts, me: true });
    (G.rivals || []).forEach(function(r) { standings.push({ pts: r.pts, me: false }); });
    standings.sort(function(a, b) { return b.pts - a.pts; });
    var pilotPos = standings.findIndex(function(s) { return s.me; }) + 1;

    // Championnat constructeurs
    var isConstructorChamp = false;
    if (typeof getConstructorChampion === 'function') {
      var cc = getConstructorChampion();
      isConstructorChamp = !!(cc && cc.playerTeam && cc.team === cc.playerTeam);
    }

    // Meilleurs tours en course — le champ réel est bestLap.isPlayer (pas fastestLap)
    var fastestLaps = (G.races || []).filter(function(r) {
      return r.bestLap && r.bestLap.isPlayer === true;
    }).length;

    // -- Prime champion pilotes --
    if (clauses.cBonusChampDriver && pilotPos === 1) {
      var amt = clauses.cBonusChampDriver;
      G.budget = (G.budget || 0) + amt;
      report.push({ label: '🏆 Champion Pilotes', amount: amt, color: '#FBBF24' });
    }

    // -- Prime champion constructeurs --
    if (clauses.cBonusChampConstructor && isConstructorChamp) {
      var amt2 = clauses.cBonusChampConstructor;
      G.budget = (G.budget || 0) + amt2;
      report.push({ label: '🏗 Champion Constructeurs', amount: amt2, color: '#F59E0B' });
    }

    // -- Prime meilleur tour --
    if (clauses.cBonusFastestLap && fastestLaps > 0) {
      var amt3 = (clauses.cBonusFastestLap || 0) * fastestLaps;
      G.budget = (G.budget || 0) + amt3;
      report.push({ label: '⚡ Meilleurs tours ×' + fastestLaps, amount: amt3, color: '#22D3EE' });
    }

    // -- Prime Top 3 saison --
    if (clauses.cBonusTop3Season && pilotPos <= 3) {
      var amt4 = clauses.cBonusTop3Season;
      G.budget = (G.budget || 0) + amt4;
      report.push({ label: '🥉 Top 3 Championnat (P' + pilotPos + ')', amount: amt4, color: '#34D399' });
    }

    // -- Clause de performance : libération automatique si top 5 --
    if (clauses.cPerformanceClause && pilotPos <= 5) {
      G._performanceClauseTriggered = true;
      report.push({ label: '🔓 Clause performance déclenchée (P' + pilotPos + ')', amount: null, color: '#EF4444', note: 'Tu es libre de tout contrat pour la prochaine saison.' });
    }

    return report;
  }

  function _rjInjectBonusReport(report) {
    // Chercher le conteneur de fin de saison
    var seEl = document.getElementById('season-end-screen') || document.querySelector('.scr.on');
    if (!seEl) return;

    // Chercher ou créer le bloc primes
    var existing = document.getElementById('rj-neg-bonus-report');
    if (existing) existing.remove();

    var totalCash = report.reduce(function(s, r) { return s + (r.amount || 0); }, 0);
    if (totalCash === 0 && !report.some(function(r) { return r.note; })) return;

    var div = document.createElement('div');
    div.id = 'rj-neg-bonus-report';
    div.style.cssText = 'margin:0 16px 16px;padding:14px;background:rgba(251,191,36,0.07);border:1px solid rgba(251,191,36,0.3);border-radius:var(--r)';

    var html = '<div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:#FBBF24;letter-spacing:.12em;text-transform:uppercase;margin-bottom:10px">Primes contractuelles</div>';

    report.forEach(function(r) {
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05)">';
      html += '<span style="font-size:12px;color:var(--text2)">' + r.label + '</span>';
      if (r.amount != null) {
        html += '<span style="font-family:var(--font-display);font-size:13px;font-weight:900;color:' + r.color + '">+' + r.amount.toLocaleString('fr-FR') + ' €</span>';
      } else if (r.note) {
        html += '<span style="font-size:11px;color:' + r.color + ';font-weight:700">' + r.note + '</span>';
      }
      html += '</div>';
    });

    if (totalCash > 0) {
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0 0">';
      html += '<span style="font-family:var(--font-display);font-size:10px;font-weight:800;color:var(--muted);letter-spacing:.1em;text-transform:uppercase">Total versé</span>';
      html += '<span style="font-family:var(--font-display);font-size:16px;font-weight:900;color:#FBBF24">+' + totalCash.toLocaleString('fr-FR') + ' €</span>';
      html += '</div>';
    }

    div.innerHTML = html;

    // Insérer dans le scroll de S-season-end
    var scroll = seEl.querySelector('.scroll') || seEl;
    var firstChild = scroll.firstChild;
    if (firstChild) scroll.insertBefore(div, firstChild.nextSibling || firstChild);
    else scroll.appendChild(div);
  }

  // =========================================================================
  // J. PERSISTANCE — save/load des clauses négociées
  // =========================================================================

  /* Les clauses étaient posées dans G juste avant la sauvegarde, en
     supposant que le cœur sérialiserait tout l'objet. VÉRIFIÉ : il n'en
     sérialise qu'une liste fermée, et ce champ n'y figurait pas — les
     clauses négociées étaient donc PERDUES à chaque rechargement de partie.
     On passe par le registre de persistance (module 87), qui les écrit
     réellement dans le fichier de sauvegarde. */
  (function _rjPersistNegClauses() {
    if (!Array.isArray(window.RJ_SAVE_HOOKS)) window.RJ_SAVE_HOOKS = [];
    if (window.RJ_SAVE_HOOKS.some(function (h) { return h && h.cle === "negClauses"; })) return;
    window.RJ_SAVE_HOOKS.push({
      cle: "negClauses",
      ecrire: function (G) { return G && G._negClauses ? G._negClauses : null; },
      lire: function (bloc, G) { if (bloc && G) G._negClauses = bloc; }
    });
  })();

  // =========================================================================
  // K. AFFICHAGE DES CLAUSES ACTIVES SUR L'ÉCRAN CONTRATS
  // =========================================================================

  window.renderActiveNegClauses = function() {
    var el = document.getElementById('neg-active-clauses');
    if (!el) return;
    var clauses = G._negClauses || {};
    var keys = Object.keys(clauses);
    if (!keys.length) { el.innerHTML = ''; return; }

    var html = '<div style="margin:0 0 12px;padding:10px 12px;background:rgba(167,139,250,0.07);border:1px solid rgba(167,139,250,0.25);border-radius:var(--r)">';
    html += '<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:#A78BFA;letter-spacing:.12em;text-transform:uppercase;margin-bottom:7px">Clauses & primes en cours</div>';
    html += '<div style="display:flex;flex-direction:column;gap:4px">';

    keys.forEach(function(k) {
      var def = null;
      Object.keys(NEG_NEW_ACTIONS).forEach(function(id) {
        if (NEG_NEW_ACTIONS[id].summaryKey === k) def = NEG_NEW_ACTIONS[id];
      });
      if (!def) return;
      var val = clauses[k];
      var displayVal = typeof val === 'boolean' ? '✓ Actif' : '+' + val.toLocaleString('fr-FR') + ' € si atteint';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--line)">';
      html += '<span style="font-size:11px;color:var(--text2)">' + def.summaryLabel + '</span>';
      html += '<span style="font-size:11px;font-weight:700;color:' + def.summaryColor + '">' + displayVal + '</span>';
      html += '</div>';
    });

    html += '</div></div>';
    el.innerHTML = html;
  };

  // Hook refreshScreen pour S-contracts
  (function _rjHookContractsRefresh() {
    function doHook() {
      if (typeof window.refreshScreen !== 'function') { setTimeout(doHook, 500); return; }
      if (window.refreshScreen._rjNegClausesHooked) return;
      var orig = window.refreshScreen;
    /* Ce module ne complète qu'un écran : il s'inscrit au registre des
       réactions d'écran (module 88) au lieu d'envelopper la navigation. */
    if (!Array.isArray(window.RJ_SCREEN_HOOKS)) window.RJ_SCREEN_HOOKS = [];
    if (!window.RJ_SCREEN_HOOKS.some(function (h) { return h && h.id === "11-neg-patch"; })) {
      window.RJ_SCREEN_HOOKS.push({
        id: "11-neg-patch",
        ecran: "S-contracts",
        apres: function (screenId) {
        
        try {
          if (screenId === 'S-contracts') {
            // Injecter le div si absent
            var offresDiv = document.getElementById('ct-offres');
            if (offresDiv && !document.getElementById('neg-active-clauses')) {
              var d = document.createElement('div');
              d.id = 'neg-active-clauses';
              offresDiv.insertBefore(d, offresDiv.firstChild);
            }
            setTimeout(renderActiveNegClauses, 50);
          }
        } catch(e) {}        }
      });
    }
      window.refreshScreen._rjNegClausesHooked = true;
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', doHook);
    } else { doHook(); }
  })();

  console.log('[11-neg-patch] Patch négociation chargé — 8 nouvelles clauses & primes');

})();

// ===========================================================================
// [N1] CORRECTIF : openNeg — supprimer le check negRound>=3 obsolète
// ---------------------------------------------------------------------------
// negRound n'est plus le mécanisme de limite. C'est la patience de NEG_STATE.
// Le check bloquait l'accès après 3 ouvertures d'une même offre.
// ===========================================================================
(function _rjFixOpenNeg() {
  function doFix() {
    if (window.openNeg && window.openNeg._rjNegFixed) return;
    window.openNeg = function(idx) {
      var offer = G.offers && G.offers[idx];
      if (!offer) return;
      // Négociation précédente terminée sur cette même offre
      if (offer._neg && (offer._neg.status === 'expired' || offer._neg.status === 'walked_away')) {
        if (typeof showFb === 'function')
          showFb('cont-fb', 'err', 'Négociation terminée', "L'écurie ne souhaite plus discuter des conditions.");
        return;
      }
      // S'assurer que NEG_IDX est accessible globalement
      window.NEG_IDX = idx;
      // Mettre à jour le titre
      var titleEl = document.getElementById('neg-title');
      if (titleEl) titleEl.textContent = 'Négociation';
      // Lancer
      if (typeof negEnter === 'function') {
        negEnter(idx);
      } else if (typeof _negStart === 'function' && typeof renderNegScreen === 'function') {
        _negStart(idx);
        renderNegScreen();
        if (typeof go === 'function') go('S-neg');
      }
    };
    window.openNeg._rjNegFixed = true;
    console.log('[11-neg-patch] openNeg corrigé — check negRound supprimé');
  }
  // Déclaration globale sécurisée de NEG_IDX
  if (typeof NEG_IDX === 'undefined') window.NEG_IDX = -1;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', doFix);
  } else { doFix(); }
})();

// ===========================================================================
// [N4] CORRECTIF : _negBuildFeedback — couvrir les nouvelles actions
// ---------------------------------------------------------------------------
// L'original ne connaît pas les 8 actions ajoutées par ce module →
// feedback générique. Un hook donne leurs libellés.
// ===========================================================================
(function _rjFixNegBuildFeedback() {
  var NEW_LABELS = {
    'bonus_champ_driver':     { ok: 'Prime champion pilotes accordée ✓',     ko: 'Prime champion pilotes refusée' },
    'bonus_champ_constructor':{ ok: 'Prime constructeurs accordée ✓',         ko: 'Prime constructeurs refusée' },
    'bonus_fastest_lap':      { ok: 'Prime meilleur tour accordée ✓',         ko: 'Prime meilleur tour refusée' },
    'bonus_top3_season':      { ok: 'Prime Top 3 saison accordée ✓',          ko: 'Prime Top 3 saison refusée' },
    'clause_preseason':       { ok: 'Pré-saison garantie ✓',                  ko: 'Clause pré-saison refusée' },
    'clause_media_cap':       { ok: 'Plafond médias accordé ✓',               ko: 'Plafond médias refusé' },
    'clause_performance':     { ok: 'Clause de performance accordée ✓',       ko: 'Clause de performance refusée' },
    'clause_no_dump':         { ok: 'Clause anti-remplacement accordée ✓',    ko: 'Clause anti-remplacement refusée' }
  };

  rjInscrire("_negBuildFeedback", { id: "11-neg-patch:retour", remplace: function (args, suite) {
    var action = args[0], success = args[1], state = args[2];
    var lbl = NEW_LABELS[action];
    if (!lbl) return suite();
    var pat = state.patience;
    var detail = success
      ? (pat > 60 ? "L'écurie reste très ouverte. Tu peux continuer à pousser."
          : pat > 30 ? "Ils acceptent, mais leur patience s'amenuise."
          : "Ils acceptent du bout des lèvres. Attention.")
      : (pat > 50 ? "Refus poli. Tu peux essayer autre chose."
          : pat > 20 ? "Refus ferme. Le ton se tend." : "Refus catégorique. Ils sont à bout.");
    return { headline: success ? lbl.ok : lbl.ko, detail: detail };
  } });
})();

/* ===========================================================================
 * SECTION D — REFONTE VISUELLE : CONTRATS & NÉGOCIATION
 * ---------------------------------------------------------------------------
 * Ajouts (présentation uniquement, la logique de négociation est inchangée) :
 *
 *  1. Bouton « Signer » écrasé à 32 px : la classe .btn impose width:100%, si
 *     bien que le bouton « x » (flex:0 1 auto) réclamait toute la largeur.
 *     On force des bases de flex explicites.
 *  2. Bloc « Contrat en cours » redessiné, avec le logo de l'écurie.
 *  3. « e » remplacé par « € » partout, « /mois » retiré, et plus de « + »
 *     devant les montants.
 *  4. Chaque offre prend la couleur de son écurie (extraite de son logo) :
 *     liseré, en-tête et valeurs des conditions.
 *  5. Écran de négociation : la patience n'est plus un « 64/100 » mais deux
 *     mains qui se rapprochent à mesure que les concessions sont obtenues,
 *     et se rejoignent quand l'accord est à portée. La tension de l'écurie
 *     est portée par la couleur.
 *  6. Les 24 options sont regroupées en 5 rubriques dépliables (une seule
 *     ouverte à la fois) au lieu d'une liste de 1700 px.
 *  7. Les boutons de décision ne passent plus sous la barre de navigation.
 *
 * Réversible : window._rjContractsUIUninstall().
 * =========================================================================== */
(function _rjContractsUI() {
  'use strict';

  var wrapped = {};
  var colorCache = {};
  var negSnapshot = null;

  /* ---------------------------------------------------- couleur d'écurie */
  function teamColor(team) {
    if (!team) return null;
    if (colorCache[team] !== undefined) return colorCache[team];
    var best = null, bestScore = -1;
    try {
      var svg = (typeof getTeamLogo === 'function') ? String(getTeamLogo(team) || '') : '';
      (svg.match(/#[0-9A-Fa-f]{6}/g) || []).forEach(function (h) {
        var r = parseInt(h.substr(1, 2), 16), g = parseInt(h.substr(3, 2), 16), b = parseInt(h.substr(5, 2), 16);
        var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        var lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        if (lum < 0.20) return;                    // fond sombre du logo
        var sat = mx === 0 ? 0 : (mx - mn) / mx;
        var score = sat * 0.7 + lum * 0.3;
        if (score > bestScore) { bestScore = score; best = h; }
      });
    } catch (e) {}
    colorCache[team] = best;
    return best;
  }
  window.couleurEcurie = teamColor;   // aussi pour la vue du circuit (111)

  function rgba(hex, a) {
    if (!hex) return 'rgba(255,255,255,' + a + ')';
    var r = parseInt(hex.substr(1, 2), 16), g = parseInt(hex.substr(3, 2), 16), b = parseInt(hex.substr(5, 2), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  /* ------------------------------------------------- montants et euros */
  function cleanMoney(root) {
    if (!root) return;
    var w;
    try { w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null); } catch (e) { return; }
    var nodes = [], n;
    while ((n = w.nextNode())) nodes.push(n);
    nodes.forEach(function (t) {
      var v = t.nodeValue;
      if (!v || !/\d/.test(v)) return;
      // CORRECTIF — l'espace était facultatif (\s*) : « 3e » (position au
      // championnat, case #h-pts du header) devenait « 3 € ». Le module 78
      // réécrivait alors « 3 € » en « 3e » via son propre MutationObserver,
      // ce qui relançait ce balayage : ping-pong infini en microtâches, le
      // thread principal bloqué à 100 % dès l'entrée en jeu (chargement de
      // sauvegarde ou création de carrière). L'espace est désormais exigé :
      // les montants (« 180 000 e ») restent traités, les ordinaux non.
      var out = v.replace(/(\d(?:[\s\u00A0]?\d{3})*)[\s\u00A0]+e\b/g, '$1 €');   // 180 000 e -> 180 000 €
      out = out.replace(/€\s*\/\s*mois/g, '€');                          // €/mois -> €
      if (/€/.test(out)) out = out.replace(/\+\s*(?=\d)/g, '');          // + devant un montant
      if (out !== v) t.nodeValue = out;
    });
  }

  /* ================================================== A. ÉCRAN CONTRATS */
  function enhanceOffers() {
    var list = document.getElementById('offers-list');
    if (!list) return;

    // 1. bloc « contrat en cours » : logo + couleur de l'écurie
    var head = list.firstElementChild;
    if (head && /Contrat en cours/i.test(head.textContent || '') && !head.getAttribute('data-rjui')) {
      head.setAttribute('data-rjui', '1');
      var team = (typeof G !== 'undefined' && G.currentTeam) || '';
      var col = teamColor(team) || 'var(--teal,#00D4FF)';
      var weeks = (typeof G !== 'undefined' && typeof G.contractWeeksLeft === 'number') ? G.contractWeeksLeft : null;
      var logo = '';
      try { if (typeof getTeamLogo === 'function') logo = getTeamLogo(team) || ''; } catch (e) {}
      var urgence = (weeks !== null && weeks <= 12) ? '#EF4444' : (weeks !== null && weeks <= 32) ? '#F59E0B' : col;
      var reste = (weeks === null) ? '—' :
        (weeks >= 48 ? Math.floor(weeks / 48) + ' saison' + (weeks >= 96 ? 's' : '') :
         weeks >= 20 ? Math.round(weeks / 4) + ' mois' : weeks + ' sem.');

      head.setAttribute('style',
        'position:relative;margin:5px 14px 14px;padding:14px;border-radius:var(--r,10px);overflow:hidden;' +
        // mêmes marges latérales que les cartes d'offre (14px) pour un bord aligné
        '' +
        'background:linear-gradient(135deg,' + rgba(teamColor(team), .16) + ' 0%,var(--bg2) 55%,var(--bg) 100%);' +
        'border:1px solid ' + rgba(teamColor(team), .45) + ';border-left:3px solid ' + col + ';');
      head.innerHTML =
        '<div style="display:flex;align-items:center;gap:12px">' +
          '<div style="flex-shrink:0;width:46px;height:46px;border-radius:var(--r);overflow:hidden;background:var(--bg3);' +
          'display:flex;align-items:center;justify-content:center">' + (logo || '') + '</div>' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--dim,#6b6b78);' +
            'letter-spacing:.14em;text-transform:uppercase">Contrat en cours</div>' +
            '<div style="font-size:15px;font-weight:800;color:var(--white,#fff);margin-top:2px;' +
            'white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + team + '</div>' +
            '<div style="font-size:11px;color:var(--text2);margin-top:1px">' + ((typeof G !== 'undefined' && G.cat) || '') + '</div>' +
          '</div>' +
          '<div style="text-align:right;flex-shrink:0">' +
            '<div style="font-family:var(--font-display);font-size:20px;font-weight:900;color:' + urgence + ';line-height:1">' + reste + '</div>' +
            '<div style="font-size:9px;color:var(--dim,#6b6b78);letter-spacing:.10em;text-transform:uppercase;margin-top:3px">restants</div>' +
          '</div>' +
        '</div>';
    }

    // 2. cartes d'offre : couleur d'écurie + boutons
    var cards = list.querySelectorAll('.offer-card');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      if (card.getAttribute('data-rjui')) { cleanMoney(card); continue; }
      card.setAttribute('data-rjui', '1');

      var t = '';
      var prof = card.querySelector('[onclick*="showTeamProfileModal"]');
      if (prof) {
        var m = (prof.getAttribute('onclick') || '').match(/showTeamProfileModal\('([^']+)'/);
        if (m) t = m[1];
      }
      var c = teamColor(t);
      if (c) {
        card.style.borderColor = rgba(c, .45);
        card.style.borderLeft = '3px solid ' + c;
        card.style.background = 'linear-gradient(135deg,' + rgba(c, .10) + ' 0%,var(--bg2) 60%,var(--bg) 100%)';
        // valeurs des conditions à la couleur de l'écurie
        card.querySelectorAll('div').forEach(function (d) {
          if (d.children.length) return;
          var txt = (d.textContent || '').trim();
          if (/€|Gratuit/.test(txt)) { d.style.color = c; d.style.fontWeight = '800'; }
        });
      }

      // boutons : bases de flex explicites (la classe .btn impose width:100%)
      var sign = card.querySelector('[onclick^="signContract"]');
      var neg = card.querySelector('[onclick^="openNeg"]');
      var ref = card.querySelector('[onclick^="refuseOffer"]');
      if (sign) { sign.style.flex = '1 1 auto'; sign.style.width = 'auto'; sign.style.minWidth = '104px'; }
      if (neg) { neg.style.flex = '1 1 auto'; neg.style.width = 'auto'; neg.style.minWidth = '104px'; }
      if (ref) { ref.style.flex = '0 0 46px'; ref.style.width = '46px'; ref.style.minWidth = '46px'; ref.style.padding = '0'; }
      if (sign && c) { sign.style.background = c; sign.style.borderColor = c; sign.style.color = '#fff'; }

      cleanMoney(card);
    }
    cleanMoney(list);
  }

  /* ============================================================ SECTION E
   * Négociation : projection de performance (affichée par 164).
   * ================================================================== */

  /* --- 1. Projection : où l'écurie devrait se situer la saison prochaine ---
   * On rejoue la formule d'évolution du moteur (pression à la baisse au-dessus
   * de 85, coup de pouce sous 70, aléa de ±8, plus le risque de changement de
   * règlement) sur 400 tirages, et on en tire une fourchette de classement.
   * Volontairement imprécis : c'est un ordre d'idée, pas une prédiction. */
  function projectionEcurie(team) {
    try {
      if (!team || typeof TEAMS_BY_CAT === "undefined") return null;
      var cat = (typeof G !== "undefined" && G.cat) || "";
      var liste = TEAMS_BY_CAT[cat];
      if (!liste || liste.indexOf(team) < 0) return null;
      var saison = (G.saison || 1);
      // Les notes de la saison sont créées à la demande : on passe par
      // getTeamRatings() plutôt que de lire la table directement.
      var notes = null;
      try {
        if (typeof TEAM_RATINGS !== "undefined") notes = TEAM_RATINGS[cat + "_" + saison];
        if (!notes && typeof getTeamRatings === "function") notes = getTeamRatings();
        if (!notes && typeof initTeamRatings === "function") {
          initTeamRatings(cat, saison);
          notes = TEAM_RATINGS[cat + "_" + saison];
        }
      } catch (e) {}
      if (!notes) return null;

      // classement actuel
      var actuel = liste.slice().sort(function (a, b) { return (notes[b] || 0) - (notes[a] || 0); });
      var rangActuel = actuel.indexOf(team) + 1;

      // risque de changement de règlement pour la saison suivante
      var risqueReglement = 0;
      try {
        if (typeof REGULATION_YEAR !== "undefined" && (saison + 1) - REGULATION_YEAR >= 5) risqueReglement = 0.25;
      } catch (e) {}

      var TIRAGES = 400, rangs = [];
      for (var k = 0; k < TIRAGES; k++) {
        var reset = Math.random() < risqueReglement;
        var futur = {};
        liste.forEach(function (t) {
          var n = notes[t] || 70;
          if (reset) {
            futur[t] = Math.min(98, Math.max(60, 60 + 38 * Math.random() + (n >= 85 ? 4 : 0)));
          } else {
            var a = n > 85 ? -1 : n < 70 ? 1 : 0;
            var o = 14 * (Math.random() - 0.5) + a;
            o = Math.max(-8, Math.min(8, o));
            futur[t] = Math.min(98, Math.max(58, n + o));
          }
        });
        var ordre = liste.slice().sort(function (a, b) { return futur[b] - futur[a]; });
        rangs.push(ordre.indexOf(team) + 1);
      }
      rangs.sort(function (a, b) { return a - b; });
      var q = function (p) { return rangs[Math.min(rangs.length - 1, Math.floor(rangs.length * p))]; };
      return {
        rangActuel: rangActuel, total: liste.length, note: Math.round(notes[team] || 0),
        bas: q(0.2), haut: q(0.8), median: q(0.5), reglement: risqueReglement > 0
      };
    } catch (e) { return null; }
  }

  function blocProjection(team) {
    var p = projectionEcurie(team);
    if (!p) return "";
    var col = p.median <= Math.ceil(p.total * 0.3) ? "#34D399"
            : p.median <= Math.ceil(p.total * 0.6) ? "#F59E0B" : "#EF4444";
    var fourchette = (p.bas === p.haut) ? (p.bas + "ᵉ") : (p.bas + "ᵉ à " + p.haut + "ᵉ");
    // Présentation alignée sur les lignes du contrat (apport, salaire, durée…),
    // en bas du bloc et séparée par un filet.
    function ligne(libelle, valeur, couleur) {
      return '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:3px 0">' +
        '<span style="font-size:11px;color:var(--text3)">' + libelle + '</span>' +
        '<span style="font-family:var(--font-display);font-size:12.5px;font-weight:800;color:' +
        (couleur || "var(--text)") + '">' + valeur + '</span></div>';
    }
    return '<div id="rj-neg-projection" style="margin-top:10px;padding-top:9px;border-top:1px solid var(--border-hi)">' +
      '<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--dim,#6b6b78);' +
      'letter-spacing:.14em;text-transform:uppercase;margin-bottom:5px">Niveau de l\'écurie</div>' +
      ligne("Classement cette saison", p.rangActuel + "ᵉ sur " + p.total + " · note " + p.note) +
      ligne("Estimation saison prochaine", fourchette, col) +
      (p.reglement
        ? '<div style="font-size:10.5px;color:#F59E0B;line-height:1.4;margin-top:5px">' +
          'Changement de réglementation possible : la hiérarchie peut être rebattue.</div>'
        : '') +
      '</div>';
  }

  /* ------------------------------------------------------------- montage */
  function wrap(name, after) {
    if (typeof window[name] !== 'function' || window[name]._rjui) return false;
    rjInscrire(name, { id: "11-ui-" + name, ordre: -3650, apres: function () {
      // Nettoyage monétaire immédiat, avant tout rendu : l'embellissement
      // plus lourd (logos, couleurs) peut rester différé, il ne provoque
      // pas de scintillement de texte.
      try {
        var scr = document.querySelector('.scr.on');
        if (scr) cleanMoney(scr);
      } catch (e) {}
      setTimeout(after, 0);
    } });
    window[name]._rjui = true;
    return true;
  }

  /* Le « e » monétaire traîne dans toute l'application : on balaie l'écran
   * actif à chaque changement de contenu. La substitution ne touche que les
   * suites « chiffres + e », jamais un mot. */
  // CORRECTIF D'AFFICHAGE — le balayage était différé de 120 ms. Le
  // navigateur peignait donc d'abord « 180 000 e /mois », puis la
  // correction arrivait : d'où le « e » qui devenait « € » et le « /mois »
  // qui disparaissait sous les yeux du joueur, à chaque changement d'écran.
  //
  // La callback d'un MutationObserver s'exécute en microtâche, c'est-à-dire
  // APRÈS la mutation mais AVANT le rendu suivant. En balayant de façon
  // synchrone à cet instant, la correction est appliquée avant que quoi que
  // ce soit ne soit affiché : plus aucun scintillement.
  //
  // Le verrou de réentrance évite que nos propres écritures ne relancent le
  // balayage en boucle — la deuxième passe ne trouverait rien à corriger,
  // mais autant ne pas la déclencher.
  //
  // DURCISSEMENT — le verrou synchrone ne protégeait que de la réentrance
  // directe : une autre extension qui réécrit ce que nous venons d'écrire
  // relançait le balayage indéfiniment (cf. module 78, bloc 13). Deux
  // garde-fous s'ajoutent donc :
  //   1. takeRecords() vide la file de l'observateur avant de relâcher le
  //      verrou : nos propres écritures ne se rappellent plus elles-mêmes.
  //   2. un disjoncteur : au-delà de SWEEP_MAX balayages dans une fenêtre
  //      d'une seconde, l'observateur se met en veille 2 s et le signale en
  //      console. Le jeu reste jouable au lieu de figer le navigateur.
  var sweepEnCours = false;
  var sweepCompteur = 0, sweepFenetre = 0, sweepEnVeille = false;
  var SWEEP_MAX = 400;
  function sweepAll() {
    if (sweepEnCours || sweepEnVeille) return;

    var now = Date.now();
    if (now - sweepFenetre > 1000) { sweepFenetre = now; sweepCompteur = 0; }
    if (++sweepCompteur > SWEEP_MAX) {
      sweepEnVeille = true;
      console.warn('[11-neg-patch/UI] balayage monétaire suspendu 2 s ' +
                   '(cadence anormale : ' + sweepCompteur + ' passes/s, ' +
                   'boucle de mutations probable).');
      setTimeout(function () {
        sweepEnVeille = false; sweepCompteur = 0; sweepFenetre = Date.now();
        try { sweepObs.takeRecords(); } catch (e) {}
      }, 2000);
      return;
    }

    sweepEnCours = true;
    try {
      var scr = document.querySelector('.scr.on');
      if (scr) cleanMoney(scr);
    } catch (e) {
    } finally {
      try { sweepObs.takeRecords(); } catch (e) {}
      sweepEnCours = false;
    }
  }
  var sweepObs = new MutationObserver(sweepAll);

  var tries = 0;
  function boot() {
    var a = wrap('renderOffers', enhanceOffers);
    window.RJProjection = blocProjection;
    if (a) {
      if (document.body) {
        sweepAll();
        sweepObs.observe(document.body, { childList: true, subtree: true, characterData: true });
      }
      console.log('[11-neg-patch/UI] refonte contrats & négociation active (euros harmonisés)');
      return;
    }
    if (tries++ < 80) setTimeout(boot, 80);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window._rjContractsUIUninstall = function () {
    sweepObs.disconnect();
    Object.keys(wrapped).forEach(function (k) { rjDesinscrire(["11-neg-patch:"], k); });
    console.log('[11-neg-patch/UI] désinstallé (rechargez la page)');
  };
})();
