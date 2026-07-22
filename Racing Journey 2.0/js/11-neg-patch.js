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

    // -- CLAUSES CONTRACTUELLES --

    'clause_preseason': {
      section: 'clauses',
      label: 'Présence pré-saison garantie',
      sub: 'Tests hiver assurés — pas de mise à l\'écart',
      iconColor: '#A78BFA',
      patienceCost: 8,
      acceptanceMod: 0.05,
      labelSuccess: 'Présence pré-saison garantie',
      labelFail: 'Clause pré-saison refusée',
      apply: function(offer) { offer.cPreseasonGuaranteed = true; },
      summaryKey: 'cPreseasonGuaranteed',
      summaryLabel: 'Pré-saison garantie',
      summaryColor: '#A78BFA',
      disabledIf: function(offer) { return !!offer.cPreseasonGuaranteed; }
    },

    'clause_media_cap': {
      section: 'clauses',
      label: 'Plafond jours médias',
      sub: 'Max 8 obligations médias/an',
      iconColor: '#60A5FA',
      patienceCost: 7,
      acceptanceMod: 0.03,
      labelSuccess: 'Plafond médias accordé',
      labelFail: 'Plafond médias refusé',
      apply: function(offer) { offer.cMediaCap = true; },
      summaryKey: 'cMediaCap',
      summaryLabel: 'Médias plafonnés',
      summaryColor: '#60A5FA',
      disabledIf: function(offer) { return !!offer.cMediaCap; }
    },

    'clause_performance': {
      section: 'clauses',
      label: 'Clause de performance',
      sub: 'Si top 5 champ → automatiquement libre',
      iconColor: '#EF4444',
      patienceCost: 20,
      acceptanceMod: -0.25,
      labelSuccess: 'Clause de performance accordée',
      labelFail: 'Clause de performance refusée',
      apply: function(offer) { offer.cPerformanceClause = true; },
      summaryKey: 'cPerformanceClause',
      summaryLabel: 'Clause performance (Top 5)',
      summaryColor: '#EF4444',
      disabledIf: function(offer) { return !!offer.cPerformanceClause || !!offer.cReleaseClause; }
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
  // B. PATCH _negActionPatienceCost — ajouter les coûts des nouvelles actions
  // =========================================================================

  (function _rjPatchPatienceCost() {
    function doPatch() {
      if (typeof window._negActionPatienceCost !== 'function') {
        setTimeout(doPatch, 400); return;
      }
      if (window._negActionPatienceCost._rjNegPatched) return;
      var orig = window._negActionPatienceCost;
      window._negActionPatienceCost = function(action) {
        var def = NEG_NEW_ACTIONS[action];
        if (def) return def.patienceCost;
        return orig.apply(this, arguments);
      };
      window._negActionPatienceCost._rjNegPatched = true;
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', doPatch);
    } else { doPatch(); }
  })();

  // =========================================================================
  // C. PATCH _negComputeAcceptance — ajouter les modificateurs
  // =========================================================================

  (function _rjPatchAcceptance() {
    function doPatch() {
      if (typeof window._negComputeAcceptance !== 'function') {
        setTimeout(doPatch, 400); return;
      }
      if (window._negComputeAcceptance._rjNegPatched) return;
      var orig = window._negComputeAcceptance;
      window._negComputeAcceptance = function(state, offer, action, params) {
        var def = NEG_NEW_ACTIONS[action];
        if (def) {
          var pat = state.patience;
          var base = pat / 100;
          var mod = def.acceptanceMod || 0;
          var agentBoost = (typeof G !== 'undefined' && G.agent && G.agent.type !== 'parent')
            ? (G.agent.skill || 30) / 800 : 0;
          var repBoost = (typeof G !== 'undefined') ? (G.reputation || 0) / 600 : 0;
          var chance = base + mod + agentBoost + repBoost;
          if (state.usedActions[action] && state.usedActions[action] >= 2) chance -= 0.15;
          return Math.max(0.05, Math.min(0.92, chance));
        }
        return orig.apply(this, arguments);
      };
      window._negComputeAcceptance._rjNegPatched = true;
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', doPatch);
    } else { doPatch(); }
  })();

  // =========================================================================
  // D. PATCH _negApplyAction — traiter les nouvelles actions
  // =========================================================================

  (function _rjPatchApplyAction() {
    function doPatch() {
      if (typeof window._negApplyAction !== 'function') {
        setTimeout(doPatch, 400); return;
      }
      if (window._negApplyAction._rjNegPatched) return;
      var orig = window._negApplyAction;
      window._negApplyAction = function(state, offer, action, params) {
        var def = NEG_NEW_ACTIONS[action];
        if (def) {
          state.usedActions[action] = (state.usedActions[action] || 0) + 1;
          var cost = def.patienceCost;
          state.patience -= cost;
          state.lastActionCost = cost;
          var chance = window._negComputeAcceptance(state, offer, action, params);
          state.lastChance = Math.round(chance * 100);
          var success = Math.random() < chance;
          state.lastSuccess = success;
          if (success) {
            try { def.apply(offer); } catch(e) {}
          }
          state.lastMsg = success ? def.labelSuccess : def.labelFail;
          var pat = state.patience;
          if (success) {
            state.lastDetail = pat > 60
              ? 'L\'écurie reste très ouverte. Tu peux continuer à pousser.'
              : pat > 30
                ? 'Ils acceptent, mais leur patience s\'amenuise.'
                : 'Ils acceptent du bout des lèvres. Attention à ne pas les pousser trop loin.';
          } else {
            state.lastDetail = pat > 50
              ? 'Refus poli. Tu peux essayer autre chose.'
              : pat > 20 ? 'Refus ferme. Le ton se tend.' : 'Refus catégorique. Ils sont à bout.';
          }
          state.history.push({ action: action, success: success, patience: pat, msg: state.lastMsg });
          if (state.patience <= 0) {
            state.status = 'expired';
            state.lastDetail += ' L\'écurie met fin à la discussion.';
          }
          return state;
        }
        return orig.apply(this, arguments);
      };
      window._negApplyAction._rjNegPatched = true;
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', doPatch);
    } else { doPatch(); }
  })();

  // =========================================================================
  // E. PATCH _negSummaryHTML — afficher les nouvelles clauses & primes
  // =========================================================================

  (function _rjPatchSummaryHTML() {
    function doPatch() {
      if (typeof window._negSummaryHTML !== 'function') {
        setTimeout(doPatch, 400); return;
      }
      if (window._negSummaryHTML._rjNegPatched) return;
      var orig = window._negSummaryHTML;
      window._negSummaryHTML = function(offer) {
        var html = orig.apply(this, arguments);

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
      };
      window._negSummaryHTML._rjNegPatched = true;
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', doPatch);
    } else { doPatch(); }
  })();

  // =========================================================================
  // F. PATCH _negActionsListHTML — injecter 2 nouvelles sections
  // =========================================================================

  (function _rjPatchActionsListHTML() {
    function doPatch() {
      if (typeof window._negActionsListHTML !== 'function') {
        setTimeout(doPatch, 400); return;
      }
      if (window._negActionsListHTML._rjNegPatched) return;
      var orig = window._negActionsListHTML;
      window._negActionsListHTML = function(state, offer) {
        var html = orig.apply(this, arguments);

        // Injecter avant la section "Décision finale" (qui est à la fin)
        var decisionIdx = html.lastIndexOf('<div class="neg-section-title">');
        if (decisionIdx < 0) decisionIdx = html.length;

        var newHtml = '';

        // Section : Primes bonus
        newHtml += '<div class="neg-section-title">';
        newHtml += (typeof renderIcon === 'function' ? renderIcon('trophy', 14, '#FBBF24') : '🏆');
        newHtml += ' Primes & Bonus</div>';
        newHtml += '<div class="neg-actions-grid">';
        ['bonus_champ_driver','bonus_champ_constructor','bonus_fastest_lap','bonus_top3_season'].forEach(function(id) {
          var def = NEG_NEW_ACTIONS[id];
          var disabled = def.disabledIf(offer);
          newHtml += _rjNegActionBtn(id, def.label, def.sub, {
            iconColor: def.iconColor,
            disabled: disabled,
            patienceCost: def.patienceCost
          });
        });
        newHtml += '</div>';

        // Section : Clauses contractuelles avancées
        newHtml += '<div class="neg-section-title">';
        newHtml += (typeof renderIcon === 'function' ? renderIcon('diplome', 14, '#A78BFA') : '📋');
        newHtml += ' Clauses avancées</div>';
        newHtml += '<div class="neg-actions-grid">';
        ['clause_preseason','clause_media_cap','clause_performance','clause_no_dump'].forEach(function(id) {
          var def = NEG_NEW_ACTIONS[id];
          var disabled = def.disabledIf(offer);
          newHtml += _rjNegActionBtn(id, def.label, def.sub, {
            iconColor: def.iconColor,
            disabled: disabled,
            patienceCost: def.patienceCost
          });
        });
        newHtml += '</div>';

        return html.slice(0, decisionIdx) + newHtml + html.slice(decisionIdx);
      };
      window._negActionsListHTML._rjNegPatched = true;
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', doPatch);
    } else { doPatch(); }
  })();

  // Helper : bouton d'action compatible avec le style existant
  function _rjNegActionBtn(action, label, sub, opts) {
    opts = opts || {};
    var disabled = opts.disabled || false;
    var iconColor = opts.iconColor || 'var(--text2)';
    var cost = opts.patienceCost || 10;
    var html = '<button class="neg-action-btn"'
      + (disabled
        ? ' disabled style="opacity:.4;cursor:not-allowed"'
        : ' onclick="negDoAction(\'' + action + '\')"')
      + '>';
    html += '<div class="neg-action-stripe" style="background:' + iconColor + '"></div>';
    html += '<div class="neg-action-body">';
    html += '<div class="neg-action-label">' + label + '</div>';
    html += '<div class="neg-action-sub">' + sub + '</div>';
    html += '</div>';
    html += '<div class="neg-action-cost" style="color:' + iconColor + '">−' + cost + '</div>';
    html += '</button>';
    return html;
  }

  // =========================================================================
  // G. PATCH negDoAction — router les nouvelles actions
  // =========================================================================

  (function _rjPatchNegDoAction() {
    function doPatch() {
      if (typeof window.negDoAction !== 'function') {
        setTimeout(doPatch, 400); return;
      }
      if (window.negDoAction._rjNegPatched) return;
      var orig = window.negDoAction;
      window.negDoAction = function(action) {
        // Si c'est une nouvelle action, on la traite via _negApplyAction
        if (NEG_NEW_ACTIONS[action]) {
          var offer = G.offers[NEG_IDX];
          if (!offer || !NEG_STATE || NEG_STATE.status !== 'active') return;
          window._negApplyAction(NEG_STATE, offer, action);
          if (typeof renderNegScreen === 'function') renderNegScreen();
          return;
        }
        return orig.apply(this, arguments);
      };
      window.negDoAction._rjNegPatched = true;
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', doPatch);
    } else { doPatch(); }
  })();

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
      window.signContract = function(idx) {
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
        return orig.apply(this, arguments);
      };
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
      window.showSeasonEnd = function() {
        // Calculer et appliquer les primes avant l'affichage
        var bonusReport = _rjApplySeasonBonuses();
        var result = orig.apply(this, arguments);
        // Injecter le rapport des primes dans le bilan de fin de saison
        if (bonusReport && bonusReport.length > 0) {
          setTimeout(function() {
            _rjInjectBonusReport(bonusReport);
          }, 200);
        }
        return result;
      };
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
    div.style.cssText = 'margin:0 16px 16px;padding:14px;background:rgba(251,191,36,0.07);border:1px solid rgba(251,191,36,0.3);border-radius:14px';

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

  (function _rjPersistNegClauses() {
    function wrapSave() {
      if (typeof window.saveGame !== 'function') { setTimeout(wrapSave, 500); return; }
      if (window.saveGame._rjNegClausesPatched) return;
      var orig = window.saveGame;
      window.saveGame = function(slot) {
        try {
          if (G) G._negClausesSave = G._negClauses || {};
        } catch(e) {}
        return orig.apply(this, arguments);
      };
      window.saveGame._rjNegClausesPatched = true;
    }
    function wrapLoad() {
      if (typeof window.loadSave !== 'function') { setTimeout(wrapLoad, 500); return; }
      if (window.loadSave._rjNegClausesPatched) return;
      var orig = window.loadSave;
      window.loadSave = function(slot) {
        var r = orig.apply(this, arguments);
        try {
          if (G && G._negClausesSave) G._negClauses = G._negClausesSave;
        } catch(e) {}
        return r;
      };
      window.loadSave._rjNegClausesPatched = true;
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(wrapSave, 400); setTimeout(wrapLoad, 400);
      });
    } else {
      setTimeout(wrapSave, 400); setTimeout(wrapLoad, 400);
    }
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

    var html = '<div style="margin:0 0 12px;padding:10px 12px;background:rgba(167,139,250,0.07);border:1px solid rgba(167,139,250,0.25);border-radius:10px">';
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
      window.refreshScreen = function(screenId) {
        var r = orig.apply(this, arguments);
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
        } catch(e) {}
        return r;
      };
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
    if (typeof window.openNeg !== 'function') { setTimeout(doFix, 400); return; }
    if (window.openNeg._rjNegFixed) return;
    window.openNeg = function(idx) {
      var offer = G.offers && G.offers[idx];
      if (!offer) return;
      // Offre déjà signée via négociation
      if (offer.negOk) {
        if (typeof showFb === 'function')
          showFb('cont-fb', 'ok', 'Offre déjà négociée', 'Tu peux signer cette offre directement.');
        return;
      }
      // Négociation précédente terminée sur cette même offre
      if (typeof NEG_STATE !== 'undefined' && NEG_STATE &&
          NEG_STATE.status === 'expired' && NEG_IDX === idx) {
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
// feedback générique. On wrappe pour injecter les labels spécifiques.
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

  function doFix() {
    if (typeof window._negBuildFeedback !== 'function') { setTimeout(doFix, 400); return; }
    if (window._negBuildFeedback._rjNegFixed) return;
    var orig = window._negBuildFeedback;
    window._negBuildFeedback = function(action, success, state, offer) {
      var lbl = NEW_LABELS[action];
      if (lbl) {
        var headline = success ? lbl.ok : lbl.ko;
        var pat = state.patience;
        var detail = success
          ? (pat > 60 ? "L'écurie reste très ouverte. Tu peux continuer à pousser."
              : pat > 30 ? "Ils acceptent, mais leur patience s'amenuise."
              : "Ils acceptent du bout des lèvres. Attention.")
          : (pat > 50 ? "Refus poli. Tu peux essayer autre chose."
              : pat > 20 ? "Refus ferme. Le ton se tend." : "Refus catégorique. Ils sont à bout.");
        return { headline: headline, detail: detail };
      }
      return orig.apply(this, arguments);
    };
    window._negBuildFeedback._rjNegFixed = true;
    console.log('[11-neg-patch] _negBuildFeedback étendu aux nouvelles actions');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', doFix);
  } else { doFix(); }
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
      var out = v.replace(/(\d(?:[\s\u00A0]?\d{3})*)\s*e\b/g, '$1 €');   // 180 000 e -> 180 000 €
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
          '<div style="flex-shrink:0;width:46px;height:46px;border-radius:10px;overflow:hidden;background:var(--bg3);' +
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

  /* ============================================== B. ÉCRAN NÉGOCIATION */

  // Rubriques : on regroupe les 24 options par intention.
  var GROUPES = [
    { id: 'fin', titre: 'Finances', ids: ['cut_cost_10', 'cut_cost_25', 'cut_cost_50', 'up_salary_10', 'up_salary_25', 'up_salary_50'] },
    { id: 'pri', titre: 'Primes', ids: ['up_bonus_win', 'up_bonus_podium', 'bonus_champ_driver', 'bonus_champ_constructor', 'bonus_fastest_lap', 'bonus_top3_season'] },
    { id: 'dur', titre: 'Durée et sécurité', ids: ['duration_extend', 'duration_shorten', 'clause_preseason', 'clause_performance', 'clause_no_dump', 'ask_release'] },
    { id: 'sta', titre: 'Statut dans l\'équipe', ids: ['ask_veto', 'clause_media_cap'] },
    { id: 'pre', titre: 'Coups de pression', ids: ['use_other_offer', 'bring_sponsor', 'walk_away_bluff'] }
  ];

  function actionId(el) {
    var m = (el.getAttribute('onclick') || '').match(/negDoAction\('([^']+)'\)/);
    return m ? m[1] : null;
  }

  function offerNow() {
    try {
      var idx = (typeof NEG_IDX !== 'undefined') ? NEG_IDX : -1;
      if (idx < 0 || !G.offers || !G.offers[idx]) return null;
      var o = G.offers[idx];
      return { salary: o.salary || 0, bonusWin: o.bonusWin || 0, bonusPodium: o.bonusPodium || 0,
               duration: o.duration || o.dur || 1, cost: o.cost || 0 };
    } catch (e) { return null; }
  }

  // Progression = concessions RÉELLEMENT obtenues (actions réussies).
  // NEG_STATE.history journalise chaque tentative avec son succès : c'est la
  // mesure fiable de « la négociation avance dans le bon sens ».
  var CONCESSIONS_ACCORD = 5;   // nb de succès pour que les mains se rejoignent
  function progres() {
    if (typeof accordForce === "number") return accordForce;
    try {
      if (typeof NEG_STATE === 'undefined' || !NEG_STATE || !NEG_STATE.history) return 0;
      var ok = 0;
      NEG_STATE.history.forEach(function (h) { if (h && h.success) ok++; });
      return Math.max(0, Math.min(1, ok / CONCESSIONS_ACCORD));
    } catch (e) { return 0; }
  }

  function patience() {
    try {
      if (typeof NEG_STATE !== 'undefined' && NEG_STATE && typeof NEG_STATE.patience === 'number') {
        var init = (typeof NEG_STATE.initialPatience === 'number' && NEG_STATE.initialPatience > 0) ? NEG_STATE.initialPatience : 100;
        return Math.max(0, Math.min(1, NEG_STATE.patience / init));
      }
    } catch (e) {}
    return 1;
  }

  /* ---------------------------------------------------------------------
   * Deux mains qui se rapprochent : l'écart traduit les concessions
   * obtenues, la couleur la marge de patience de l'écurie.
   *
   * QUATRE STYLES sont fournis : je ne peux pas juger correctement le rendu
   * de mes propres dessins, donc le choix te revient — un appui sur le bloc
   * fait défiler les styles, et le choix est mémorisé.
   * ------------------------------------------------------------------- */
  var STYLES = ['A', 'B', 'C', 'D'];
  var STYLE_NOMS = { A: 'Poignée de profil', B: 'Paumes ouvertes', C: 'Chevrons', D: 'Mitaines' };

  function styleActuel() {
    try { return localStorage.getItem('rj_neg_hands') || 'B'; } catch (e) { return 'B'; }
  }
  function styleSuivant() {
    var i = STYLES.indexOf(styleActuel());
    var next = STYLES[(i + 1) % STYLES.length];
    try { localStorage.setItem('rj_neg_hands', next); } catch (e) {}
    return next;
  }

  // Recentrage du style B après rotation (valeurs ajustées par mesure).
  var BR_DX = 2.2, BR_DY = 0.9;

  function dessinMain(style, dirn, gap, col) {
    var x = dirn < 0 ? -gap / 2 : gap / 2;
    var sc = dirn < 0 ? 1 : -1;
    var open = '<g transform="translate(' + x + ',0) scale(' + sc + ',1)" fill="none" stroke="' + col +
               '" stroke-linecap="round" stroke-linejoin="round">';
    var d = '';
    if (style === 'B') {
      // Paumes ouvertes, orientées à l'HORIZONTALE : on fait pivoter de 90°
      // le dessin vertical (rotate(90) envoie les doigts vers la droite),
      // puis on recentre le tout dans la bande via BR_DX / BR_DY.
      d = '<g stroke-width="1.5" transform="translate(' + BR_DX + ',' + BR_DY + ') rotate(90 -23 14.5)">' +
          '<path d="M-30 26 v-9 a3 3 0 0 1 3 -3 h8"/>' +
          '<path d="M-27 14 v-9 a2 2 0 0 1 4 0 v9"/>' +
          '<path d="M-23 14 v-11 a2 2 0 0 1 4 0 v11"/>' +
          '<path d="M-19 14 v-10 a2 2 0 0 1 4 0 v10"/>' +
          '<path d="M-15 14 v-7 a2 2 0 0 1 4 0 v9"/>' +
          '<path d="M-30 20 h-5 a3 3 0 0 0 0 6 h5"/></g>';
    } else if (style === 'C') {
      d = '<g stroke-width="2">' +
          '<path d="M-34 4 l10 10 l-10 10" opacity=".35"/>' +
          '<path d="M-26 4 l10 10 l-10 10" opacity=".7"/>' +
          '<path d="M-18 6 l8 8 l-8 8"/></g>';
    } else if (style === 'D') {
      d = '<g stroke-width="1.6">' +
          '<path d="M-44 10 h10 v8 h-10 z" opacity=".45"/>' +
          '<path d="M-34 8 h8 c7 0 11 3 11 6 c0 3 -4 6 -11 6 h-8 a2 2 0 0 1 -2 -2 v-8 a2 2 0 0 1 2 -2 z"/>' +
          '<path d="M-26 8 v-3 a3 3 0 0 1 6 1 v2"/>' +
          '<path d="M-15 12 h4 M-15 16 h4" opacity=".5"/></g>';
    } else {
      d = '<g stroke-width="1.6">' +
          '<path d="M-46 9 h14"/><path d="M-46 19 h14"/>' +
          '<path d="M-32 6 h6 a4 4 0 0 1 4 4 v2"/>' +
          '<path d="M-22 12 c6 0 9 2 9 6 c0 4 -3 6 -9 6 h-10 v-12 z"/>' +
          '<path d="M-24 12 v-3 a3 3 0 0 1 6 0 v3"/></g>';
    }
    return open + d + '</g>';
  }

  function handshakeSVG(prog, pat) {
    var col = pat > 0.6 ? '#34D399' : pat > 0.3 ? '#F59E0B' : '#EF4444';
    // 46 d'écart au départ ; on retire en plus la largeur propre des mains à
    // mesure qu'on progresse, pour qu'elles se TOUCHENT à l'accord (mesuré :
    // 11 unités de séparation résiduelle à écart nul).
    var gap = Math.round((1 - prog) * 46 - prog * 11);
    var joint = prog >= 0.92;
    var st = styleActuel();
    var etat = joint ? 'Accord à portée' : prog > 0.55 ? 'Ça se rapproche' : prog > 0.2 ? 'Discussions engagées' : 'Premiers échanges';
    var tension = pat > 0.6 ? 'Écurie sereine' : pat > 0.3 ? 'Écurie qui se crispe' : 'Écurie à bout';

    return '' +
      '<div id="rj-handshake" style="padding:14px 12px 10px;border-radius:var(--r,10px);' +
      'border:1px solid ' + rgba(col, .35) + ';' +
      'background:linear-gradient(160deg,' + rgba(col, .10) + ' 0%,var(--bg2) 60%,var(--bg) 100%)">' +
        '<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--dim,#6b6b78);' +
        'letter-spacing:.14em;text-transform:uppercase;text-align:center">Où en est la négociation</div>' +
        '<svg viewBox="-60 -4 120 36" width="100%" height="76" style="display:block;margin:6px 0 2px">' +
          dessinMain(st, -1, gap, col) + dessinMain(st, 1, gap, col) +
          (joint ? '<circle cx="0" cy="14" r="15" fill="none" stroke="' + col + '" stroke-width="1.2" opacity=".5"/>' : '') +
        '</svg>' +
        '<div style="text-align:center;font-family:var(--font-display);font-size:13px;font-weight:900;color:' + col + ';' +
        'letter-spacing:.04em">' + etat + '</div>' +
        '<div style="text-align:center;font-size:11px;color:var(--text2);margin-top:3px">' + tension + '</div>' +
      '</div>';
  }

  function enhanceNeg() {
    var scr = document.getElementById('S-neg');
    if (!scr) return;

    // 7. les boutons de décision ne doivent plus passer sous la barre du bas
    var sc = scr.querySelector('.scroll');
    if (sc) sc.style.paddingBottom = '110px';

    // Niveau de l'écurie : rangé avec les conditions du contrat, en bas du bloc.
    try {
      var idxOffre = (typeof NEG_IDX !== 'undefined') ? NEG_IDX : -1;
      var equipe = (idxOffre >= 0 && G.offers && G.offers[idxOffre]) ? G.offers[idxOffre].team : null;
      var hote = document.getElementById('neg-summary');
      if (equipe && hote && !hote.querySelector('#rj-neg-projection')) {
        var html = blocProjection(equipe);
        if (html) {
          var tmp = document.createElement('div');
          tmp.innerHTML = html;
          // on vise la carte des conditions plutôt que le conteneur nu
          var carte = hote.lastElementChild && hote.lastElementChild.children.length
            ? hote.lastElementChild : hote;
          carte.appendChild(tmp.firstChild);
        }
      }
    } catch (e) {}

    try { masquerCouts(scr); } catch (e) {}

    // 5. patience → poignée de main
    var sum = document.getElementById('neg-summary');
    var bar = document.getElementById('neg-round-bar');
    if (bar) {
      var prog = progres(), pat = patience();
      bar.innerHTML = handshakeSVG(prog, pat);
      // on retire l'ancien affichage « Patience de l'écurie xx/100 »
      if (sum) {
        sum.querySelectorAll('div').forEach(function (d) {
          if (d.children.length) return;
          if (/Patience de l'?équipe|Patience de l'?écurie|\/\s*100/i.test(d.textContent || '')) {
            var p = d.parentElement;
            if (p && p !== sum && p.children.length <= 3) p.style.display = 'none';
            else d.style.display = 'none';
          }
        });
      }
    }

    // 6. regroupement des options en rubriques dépliables
    var opts = document.getElementById('neg-options');
    if (opts && !opts.getAttribute('data-rjui')) {
      var items = Array.prototype.slice.call(opts.querySelectorAll('[onclick*="negDoAction"]'));
      if (items.length > 6) {
        opts.setAttribute('data-rjui', '1');
        var reste = [], parGroupe = {};
        items.forEach(function (el) {
          var id = actionId(el);
          var trouve = null;
          GROUPES.forEach(function (g) { if (g.ids.indexOf(id) >= 0) trouve = g.id; });
          if (id === 'sign_now') { reste.push(el); return; }
          if (!trouve) { reste.push(el); return; }
          (parGroupe[trouve] = parGroupe[trouve] || []).push(el);
        });

        // On conserve TOUT élément interactif qui n'est PAS une option
        // (« Quitter sans signer », aide…), où qu'il soit dans l'arbre :
        // il sera réinséré sous les rubriques.
        var autres = Array.prototype.slice.call(opts.querySelectorAll('[onclick]'))
          .filter(function (n) { return !/negDoAction/.test(n.getAttribute('onclick') || ''); });

        var host = document.createElement('div');
        GROUPES.forEach(function (g) {
          var lot = parGroupe[g.id];
          if (!lot || !lot.length) return;
          var sec = document.createElement('div');
          sec.style.cssText = 'margin-bottom:8px;border:1px solid var(--border-hi);border-radius:10px;overflow:hidden;background:var(--bg2)';
          var head = document.createElement('button');
          head.type = 'button';
          head.style.cssText = 'width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;' +
            'padding:12px 13px;background:transparent;border:0;cursor:pointer;touch-action:manipulation;' +
            'font-family:var(--font-display);font-size:11px;font-weight:800;letter-spacing:.08em;' +
            'text-transform:uppercase;color:var(--text);text-align:left';
          head.innerHTML = '<span>' + g.titre + '</span><span style="display:flex;align-items:center;gap:8px">' +
            '<span style="font-size:10px;color:var(--dim,#6b6b78)">' + lot.length + '</span>' +
            '<span data-caret style="font-size:13px;color:var(--text3);transition:transform .15s">▾</span></span>';
          var body = document.createElement('div');
          body.style.cssText = 'display:none;padding:0 10px 10px';
          lot.forEach(function (el) { body.appendChild(el); });
          head.addEventListener('click', function () {
            var ouvert = body.style.display !== 'none';
            // une seule rubrique ouverte à la fois
            host.querySelectorAll('[data-body]').forEach(function (b) { b.style.display = 'none'; });
            host.querySelectorAll('[data-caret]').forEach(function (c) { c.style.transform = ''; });
            if (!ouvert) {
              body.style.display = 'block';
              var car = head.querySelector('[data-caret]');
              if (car) car.style.transform = 'rotate(180deg)';
            }
          });
          body.setAttribute('data-body', '1');
          sec.appendChild(head); sec.appendChild(body);
          host.appendChild(sec);
        });
        reste.forEach(function (el) { host.appendChild(el); });
        opts.innerHTML = '';
        opts.appendChild(host);
        autres.forEach(function (n) { opts.appendChild(n); });
      }
    }

    cleanMoney(scr);
  }


  /* ============================================================ SECTION E
   * Négociation : projection de performance, badges de coût retirés,
   * poignée de main conclue à la signature.
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

  /* --- 2. Retrait des badges de coût sur les options --------------------- */
  function masquerCouts(scr) {
    var opts = scr.querySelector("#neg-options");
    if (!opts) return;
    var boutons = opts.querySelectorAll('[onclick*="negDoAction"]');
    for (var i = 0; i < boutons.length; i++) {
      var b = boutons[i];
      if (b.getAttribute("data-rj-cout")) continue;
      b.setAttribute("data-rj-cout", "1");
      var els = b.querySelectorAll("div,span");
      for (var j = 0; j < els.length; j++) {
        var t = (els[j].textContent || "").trim();
        // badge de coût : uniquement un nombre, éventuellement signé
        if (els[j].children.length === 0 && /^[−+-]?\d{1,3}$/.test(t)) {
          els[j].style.display = "none";
        }
        // la bande de couleur annonçait elle aussi la difficulté : on la
        // rend neutre pour ne plus dévoiler l'effet à l'avance
        if (els[j].className && String(els[j].className).indexOf("neg-action-stripe") >= 0) {
          els[j].style.background = "var(--border-hi)";
        }
      }
    }
  }

  /* --- 3. Poignée de main conclue à la signature ------------------------- */
  var accordForce = null;   // null = progression normale, sinon valeur 0..1

  function animerAccord(fin) {
    var debut = progres();
    var t0 = (window.performance && performance.now) ? performance.now() : Date.now();
    var duree = 620;
    function frame() {
      var t = ((window.performance && performance.now) ? performance.now() : Date.now()) - t0;
      var k = Math.max(0, Math.min(1, t / duree));
      // départ rapide puis ralentissement, comme une main qui se pose
      var e = 1 - Math.pow(1 - k, 3);
      accordForce = debut + (1 - debut) * e;
      try { enhanceNeg(); } catch (err) {}
      if (k < 1) requestAnimationFrame(frame);
      else if (typeof fin === "function") fin();
    }
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------- montage */
  // La signature déclenche d'abord la poignée de main, puis l'action réelle.
  function wrapSignature() {
    if (typeof window.negDoAction !== 'function' || window.negDoAction._rjSign) return false;
    var orig = window.negDoAction;
    var fn = function (action) {
      if (action === 'sign_now' && accordForce === null) {
        var args = arguments, self = this;
        animerAccord(function () {
          // on laisse les mains jointes : accordForce n'est PAS remis à zéro
          // ici, il le sera à la prochaine ouverture d'une négociation.
          setTimeout(function () { orig.apply(self, args); }, 300);
        });
        return;
      }
      return orig.apply(this, arguments);
    };
    fn._rjSign = true;
    wrapped.negDoAction = orig;
    window.negDoAction = fn;
    return true;
  }

  function wrap(name, after) {
    if (typeof window[name] !== 'function' || window[name]._rjui) return false;
    var orig = window[name];
    var fn = function () {
      var r = orig.apply(this, arguments);
      // Nettoyage monétaire immédiat, avant tout rendu : l'embellissement
      // plus lourd (logos, couleurs) peut rester différé, il ne provoque
      // pas de scintillement de texte.
      try {
        var scr = document.querySelector('.scr.on');
        if (scr) cleanMoney(scr);
      } catch (e) {}
      try { setTimeout(after, 0); } catch (e) {}
      return r;
    };
    fn._rjui = true;
    wrapped[name] = orig;
    window[name] = fn;
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
  var sweepEnCours = false;
  function sweepAll() {
    if (sweepEnCours) return;
    sweepEnCours = true;
    try {
      var scr = document.querySelector('.scr.on');
      if (scr) cleanMoney(scr);
    } catch (e) {
    } finally {
      sweepEnCours = false;
    }
  }
  var sweepObs = new MutationObserver(sweepAll);

  var tries = 0;
  function boot() {
    var a = wrap('renderOffers', enhanceOffers);
    var b = wrap('renderNegScreen', enhanceNeg);
    wrapSignature();
    // instantané de l'offre à l'entrée en négociation (base des concessions)
    if (typeof window.negEnter === 'function' && !window.negEnter._rjui) {
      var orig = window.negEnter;
      var fn = function () {
        accordForce = null;                     // nouvelle négociation : on repart à zéro
        var r = orig.apply(this, arguments);
        try { negSnapshot = offerNow(); setTimeout(enhanceNeg, 0); } catch (e) {}
        return r;
      };
      fn._rjui = true;
      wrapped.negEnter = orig;
      window.negEnter = fn;
    }
    if (a && b) {
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

  // Changement de style possible si besoin : _rjNegHands('A'|'B'|'C'|'D')
  window._rjNegHands = function (st) {
    if (STYLES.indexOf(st) < 0) return STYLES.join(', ');
    try { localStorage.setItem('rj_neg_hands', st); } catch (e) {}
    try { enhanceNeg(); } catch (e) {}
    return 'style ' + st + ' — ' + (STYLE_NOMS[st] || '');
  };

  window._rjContractsUIUninstall = function () {
    sweepObs.disconnect();
    Object.keys(wrapped).forEach(function (k) { window[k] = wrapped[k]; });
    console.log('[11-neg-patch/UI] désinstallé (rechargez la page)');
  };
})();
