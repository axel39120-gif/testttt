/// === Racing Journey: F1 Dreams ===
// Module: 10-finance
// Système financier complet :
//   - Page Finances dédiée (onglet dans S-contracts)
//   - Popup bilan hebdomadaire à chaque avancement
//   - Économie réaliste par catégorie (coûts matériel, licences, déplacements)
//   - Dépenses utiles au gameplay (formations, coaching, matériel kart/monoplace)
// ===========================================================================

(function _rjFinanceModule() {
  'use strict';

  // =========================================================================
  // A. DONNÉES — Coûts réalistes par catégorie
  // =========================================================================

  // Coûts calibrés sur l'économie interne du jeu.
  // Règle : coûts ≈ 20-30% du revenu hebdo typique dans la catégorie.
  // Budget départ = 8 000€, salaire KJ = 100€/sem → coûts KJ max ~37€/sem.
  var RJ_CAT_COSTS = {
    'Karting Junior': {
      weekly_material: 25,   // entretien pneus, carbu, petites pièces
      race_entry: 30,        // droits de départ par manche
      travel_per_race: 20,   // transport
      label: 'Karting Junior'
    },
    'Karting Senior': {
      weekly_material: 40,
      race_entry: 50,
      travel_per_race: 30,
      label: 'Karting Senior'
    },
    'Formule 4': {
      weekly_material: 65,
      race_entry: 75,
      travel_per_race: 50,
      label: 'Formule 4'
    },
    'Formula Regional': {
      weekly_material: 100,
      race_entry: 125,
      travel_per_race: 80,
      label: 'Formula Regional'
    },
    'Formule 3': {
      weekly_material: 165,
      race_entry: 195,
      travel_per_race: 130,
      label: 'Formule 3'
    },
    'Formule 2': {
      weekly_material: 260,
      race_entry: 315,
      travel_per_race: 210,
      label: 'Formule 2'
    },
    'Formule 1': {
      weekly_material: 0,    // pris en charge par l'écurie
      race_entry: 0,
      travel_per_race: 0,
      label: 'Formule 1'
    },
    'Super Formula': {
      weekly_material: 210,
      race_entry: 250,
      travel_per_race: 180,
      label: 'Super Formula'
    },
    'Endurance WEC': {
      weekly_material: 175,
      race_entry: 200,
      travel_per_race: 150,
      label: 'Endurance WEC'
    },
    'IndyCar': {
      weekly_material: 230,
      race_entry: 280,
      travel_per_race: 200,
      label: 'IndyCar'
    }
  };

  // =========================================================================
  // B. INVESTISSEMENTS UTILES AU GAMEPLAY
  // =========================================================================

  window.RJ_INVESTMENTS = [
    // --- MATÉRIEL ---
    {
      id: 'kart_chassis_new',
      name: 'Nouveau châssis kart',
      cat: ['Karting Junior', 'Karting Senior'],
      icon: 'kart',
      color: '#F59E0B',
      cost: 1200,
      desc: 'Châssis compétitif neuf. Réduit la dégradation pneus et améliore la réactivité.',
      effect: { type: 'substat', key: 'reactivite', value: 3, duration: 52 },
      effect2: { type: 'weekly_cost_reduction', key: 'material', pct: 0.15 },
      category: 'materiel',
      once: true
    },
    {
      id: 'kart_engine_rebuild',
      name: 'Révision moteur kart',
      cat: ['Karting Junior', 'Karting Senior'],
      icon: 'engine',
      color: '#EF4444',
      cost: 300,
      desc: 'Remise à neuf complète. Gain de puissance brute pour les prochaines manches.',
      effect: { type: 'substat', key: 'acceleration', value: 2, duration: 8 },
      category: 'materiel',
      once: false,
      cooldown_weeks: 6
    },
    {
      id: 'f4_data_system',
      name: 'Système data embarqué',
      cat: ['Formule 4', 'Formula Regional'],
      icon: 'data',
      color: '#22D3EE',
      cost: 1700,
      desc: 'Télémétrie avancée. Améliore l\'analyse et les réglages de setup.',
      effect: { type: 'substat', key: 'decision', value: 3, duration: 52 },
      effect2: { type: 'setup_bonus', value: 2 },
      category: 'materiel',
      once: true
    },
    {
      id: 'spare_parts_stock',
      name: 'Stock pièces de rechange',
      cat: ['Formule 4', 'Formula Regional', 'Formule 3', 'Formule 2'],
      icon: 'tools',
      color: '#94A3B8',
      cost: 2400,
      desc: 'Avoir des pièces en avance réduit les coûts de réparation après incident.',
      effect: { type: 'weekly_cost_reduction', key: 'material', pct: 0.20 },
      effect2: { type: 'dnf_cost_reduction', pct: 0.30 },
      category: 'materiel',
      once: true
    },

    // --- COACHING TECHNIQUE ---
    {
      id: 'coach_karting',
      name: 'Coach karting senior',
      cat: ['Karting Junior', 'Karting Senior'],
      icon: 'coaching',
      color: '#34D399',
      cost: 200,
      desc: 'Séances hebdomadaires avec un ancien pilote. Vitesse brute et lignes de trajectoire.',
      effect: { type: 'train_bonus', stat: 'vitesse_pure', pct: 0.25 },
      category: 'coaching',
      once: false,
      cooldown_weeks: 1
    },
    {
      id: 'coach_data',
      name: 'Ingénieur data freelance',
      cat: ['Formule 4', 'Formula Regional', 'Formule 3'],
      icon: 'analyse',
      color: '#60A5FA',
      cost: 1100,
      desc: 'Analyse de télémétrie poussée. Améliore décision et réglages setup.',
      effect: { type: 'train_bonus', stat: 'decision', pct: 0.30 },
      effect2: { type: 'substat', key: 'gestion_pneus', value: 1, duration: 8 },
      category: 'coaching',
      once: false,
      cooldown_weeks: 2
    },
    {
      id: 'coach_fitness',
      name: 'Préparateur physique F1',
      cat: ['Formule 2', 'Formule 1', 'Super Formula', 'IndyCar'],
      icon: 'physique',
      color: '#F472B6',
      cost: 2250,
      desc: 'Programme d\'entraînement sur mesure pour le niveau F1. Physique et concentration +.',
      effect: { type: 'train_bonus', stat: 'physique', pct: 0.40 },
      effect2: { type: 'substat', key: 'concentration', value: 2, duration: 12 },
      category: 'coaching',
      once: false,
      cooldown_weeks: 1
    },
    {
      id: 'sim_session_pro',
      name: 'Session sim F1 officielle',
      cat: ['Formule 3', 'Formule 2', 'Formule 1'],
      icon: 'sim',
      color: '#A78BFA',
      cost: 2600,
      desc: 'Accès à un simulateur d\'équipe F1. Adaption aux circuits inédits.',
      effect: { type: 'substat', key: 'adapt', value: 4, duration: 6 },
      effect2: { type: 'next_race_bonus', value: 0.01 },
      category: 'coaching',
      once: false,
      cooldown_weeks: 3
    },

    // --- MÉDICAL & MENTAL ---
    {
      id: 'psychologist',
      name: 'Psychologue sportif',
      cat: ['Karting Junior', 'Karting Senior', 'Formule 4', 'Formula Regional', 'Formule 3', 'Formule 2', 'Formule 1', 'Super Formula', 'Endurance WEC', 'IndyCar'],
      icon: 'mental',
      color: '#C084FC',
      cost: 300,
      desc: 'Gestion du stress et confiance en soi. Réduit la pression mentale.',
      effect: { type: 'mental', key: 'pressure', delta: -8 },
      effect2: { type: 'mental', key: 'confidence', delta: 5 },
      category: 'mental',
      once: false,
      cooldown_weeks: 2
    },
    {
      id: 'medical_checkup',
      name: 'Bilan médical complet',
      cat: ['Karting Junior', 'Karting Senior', 'Formule 4', 'Formula Regional', 'Formule 3', 'Formule 2', 'Formule 1', 'Super Formula', 'Endurance WEC', 'IndyCar'],
      icon: 'sante',
      color: '#4ADE80',
      cost: 150,
      desc: 'Suivi médical préventif. Réduit la fatigue accumulée.',
      effect: { type: 'fatigue_reduction', value: 15 },
      category: 'mental',
      once: false,
      cooldown_weeks: 4
    },

    // --- LICENCE & ADMINISTRATIF ---
    {
      id: 'fia_licence_upgrade',
      name: 'Upgrade Licence FIA',
      cat: ['Formule 4', 'Formula Regional', 'Formule 3', 'Formule 2'],
      icon: 'diplome',
      color: '#FBBF24',
      cost: 700,
      desc: 'Licence de grade supérieur. Ouvre l\'accès à plus d\'offres d\'équipes.',
      effect: { type: 'rep', key: 'recruteurs', delta: 5 },
      effect2: { type: 'offer_unlock' },
      category: 'administratif',
      once: true
    },

    // --- MÉDIATIQUE ---
    {
      id: 'media_training',
      name: 'Formation prise de parole',
      cat: ['Formule 4', 'Formula Regional', 'Formule 3', 'Formule 2', 'Formule 1', 'Super Formula', 'Endurance WEC', 'IndyCar'],
      icon: 'microphone',
      color: '#F97316',
      cost: 900,
      desc: 'Apprendre à gérer les médias, les interviews difficiles. Réputation médias +.',
      effect: { type: 'rep', key: 'medias', delta: 8 },
      effect2: { type: 'substat', key: 'decision', value: 1, duration: 20 },
      category: 'mediatique',
      once: false,
      cooldown_weeks: 8
    },
    {
      id: 'photographer_shoot',
      name: 'Shooting photographe pro',
      cat: ['Formule 3', 'Formule 2', 'Formule 1', 'Super Formula', 'Endurance WEC', 'IndyCar'],
      icon: 'camera',
      color: '#EC4899',
      cost: 700,
      desc: 'Contenu visuel professionnel pour les réseaux. Followers Instagram +.',
      effect: { type: 'ig_followers', value: 5000 },
      effect2: { type: 'rep', key: 'public', delta: 3 },
      category: 'mediatique',
      once: false,
      cooldown_weeks: 6
    }
  ];

  // =========================================================================
  // C. TRACKER FINANCIER HEBDOMADAIRE
  // Capture les mouvements de la semaine pour le bilan popup
  // =========================================================================

  // Snapshot avant avancement
  function _rjSnapFinance() {
    _rjSyncContractSalary();
    return {
      budget: G.budget || 0,
      revenue: G.revenue || 0,
      sponsors: (G.sponsors || []).map(function(s) {
        return { name: s.name || 'Sponsor', fee: s.fee || 0 };
      }),
      // Salaire seul, sponsors exclus (évite le double comptage dans le bilan)
      salary: (G.currentTeam && G.currentTeam !== 'Indépendant')
        ? (G._contractSalary || 0)
        : 0,
      maintenance: _rjCalcMaintenance(),
      commission: _rjCalcCommission(),
      material: _rjCalcWeeklyMaterial(),
      owned: (G.owned || []).map(function(o) {
        return { name: o.name, maintenance: Math.round((o.maintenance || 0) / 4) };
      })
    };
  }

  function _rjCalcMaintenance() {
    if (!G.owned || !G.owned.length) return 0;
    return Math.round(G.owned.reduce(function(t, o) { return t + (o.maintenance || 0); }, 0) / 4);
  }

  function _rjCalcCommission() {
    if (!G.agent || !G.agent.commission) return 0;
    var gross = Math.round((G.revenue || 0) / 4);
    return Math.round(gross * G.agent.commission);
  }

  function _rjCalcWeeklyMaterial() {
    if (G.currentTeam && G.currentTeam !== 'Indépendant') return 0;
    var costs = RJ_CAT_COSTS[G.cat] || {};
    var base = costs.weekly_material || 0;
    // Réduction si investissements matériel actifs
    var reduction = G._rjMaterialReduction || 0;
    return Math.round(base * (1 - reduction));
  }

  // =========================================================================
  // D. BILAN HEBDOMADAIRE — Popup après advanceToNextMoment
  // =========================================================================

  function _rjShowWeeklyBilan(before, weeksAdvanced, afterBudgetOverride) {
    var after = {
      budget: (typeof afterBudgetOverride === 'number') ? afterBudgetOverride : (G.budget || 0)
    };
    var weeks = weeksAdvanced || 1;

    // Calculs des mouvements
    // before.salary = G._contractSalary (annuel), on divise par 4 pour obtenir le mensuel
    var salaryEarned = Math.round(before.salary / 4) * weeks;
    var sponsorEarned = (G.sponsors || []).reduce(function(t, s) {
      return t + Math.round((s.fee || 0) * weeks / 4);
    }, 0);
    var maintenancePaid = before.maintenance * weeks;
    var commissionPaid = before.commission * weeks;
    var materialPaid = before.material * weeks;
    var raceEntryPaid = 0; // calculé après si course
    var totalIn = salaryEarned + sponsorEarned;
    var totalOut = maintenancePaid + commissionPaid + materialPaid + raceEntryPaid;
    var net = after.budget - before.budget;
    var netColor = net >= 0 ? '#4ADE80' : '#EF4444';

    // Ne pas afficher si rien ne s'est passé (0 revenus et 0 dépenses)
    if (totalIn === 0 && totalOut === 0 && Math.abs(net) < 10) return;

    // Créer le popup
    var overlay = document.createElement('div');
    overlay.id = 'rj-bilan-overlay';
    overlay.style.cssText = [
      'position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;justify-content:center',
      'background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)',
      'animation:rjFadeIn .18s ease'
    ].join(';');

    var card = document.createElement('div');
    card.style.cssText = [
      'width:100%;max-width:420px;background:var(--bg2)',
      'border-top:1px solid var(--border);border-radius:24px 24px 0 0',
      'padding:0 0 env(safe-area-inset-bottom,0)',
      'animation:rjSlideUp .22s cubic-bezier(.32,.72,0,1)',
      'max-height:80vh;overflow-y:auto'
    ].join(';');

    var weekLabel = weeks > 1 ? ('Semaines ' + (G.semaine - weeks + 1) + '–' + G.semaine) : ('Semaine ' + G.semaine);
    var budgetColor = after.budget >= 5000 ? '#4ADE80' : after.budget >= 2000 ? '#F59E0B' : '#EF4444';

    var html = '';

    // Header
    html += '<div style="padding:20px 20px 0;display:flex;align-items:center;justify-content:space-between">';
    html += '<div>';
    html += '<div style="font-family:var(--font-display);font-size:16px;font-weight:900;color:var(--white)">Bilan financier</div>';
    html += '<div style="font-size:11px;color:var(--muted);margin-top:2px">' + weekLabel + ' · ' + G.cat + '</div>';
    html += '</div>';
    html += '<button onclick="document.getElementById(\'rj-bilan-overlay\').remove()" style="width:32px;height:32px;border-radius:50%;background:var(--surface2);border:1px solid var(--border);color:var(--muted);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">×</button>';
    html += '</div>';

    // Solde actuel
    html += '<div style="margin:14px 20px 0;padding:14px 16px;background:var(--surface2);border:1px solid var(--border);border-radius:14px;display:flex;align-items:center;justify-content:space-between">';
    html += '<div>';
    html += '<div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:var(--muted);letter-spacing:.12em;text-transform:uppercase">Solde actuel</div>';
    html += '<div style="font-family:var(--font-display);font-size:26px;font-weight:900;color:' + budgetColor + ';line-height:1;margin-top:3px">' + after.budget.toLocaleString('fr-FR') + ' €</div>';
    html += '</div>';
    html += '<div style="text-align:right">';
    html += '<div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:var(--muted);letter-spacing:.12em;text-transform:uppercase;margin-bottom:3px">Cette période</div>';
    html += '<div style="font-family:var(--font-display);font-size:18px;font-weight:900;color:' + netColor + '">' + (net >= 0 ? '+' : '') + net.toLocaleString('fr-FR') + ' €</div>';
    html += '</div>';
    html += '</div>';

    // Revenus
    if (totalIn > 0) {
      html += '<div style="margin:12px 20px 0">';
      html += '<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:#4ADE80;letter-spacing:.14em;text-transform:uppercase;margin-bottom:6px">↑ Revenus</div>';
      if (salaryEarned > 0) {
        html += _rjBilanRow(G.currentTeam || 'Salaire', '+' + salaryEarned.toLocaleString('fr-FR') + ' €', '#4ADE80');
      }
      (G.sponsors || []).forEach(function(s) {
        var fee = Math.round((s.fee || 0) * weeks / 4);
        if (fee > 0) {
          html += _rjBilanRow(s.name || 'Sponsor', '+' + fee.toLocaleString('fr-FR') + ' €', '#4ADE80');
        }
      });
      html += '</div>';
    }

    // Dépenses
    if (totalOut > 0 || materialPaid > 0) {
      html += '<div style="margin:10px 20px 0">';
      html += '<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:#EF4444;letter-spacing:.14em;text-transform:uppercase;margin-bottom:6px">↓ Dépenses</div>';

      if (materialPaid > 0) {
        var matLabel = ['Karting Junior','Karting Senior'].indexOf(G.cat) >= 0
          ? 'Entretien kart'
          : 'Matériel / prépa';
        html += _rjBilanRow(matLabel, '−' + materialPaid.toLocaleString('fr-FR') + ' €', '#EF4444');
      }
      if (maintenancePaid > 0) {
        html += _rjBilanRow('Maintenance biens', '−' + maintenancePaid.toLocaleString('fr-FR') + ' €', '#EF4444');
        // Détail par bien
        (before.owned || []).forEach(function(o) {
          if (o.maintenance > 0) {
            var paid = o.maintenance * weeks;
            html += _rjBilanRow('  ' + o.name, '−' + paid.toLocaleString('fr-FR') + ' €', '#94A3B8', true);
          }
        });
      }
      if (commissionPaid > 0) {
        html += _rjBilanRow('Commission agent (' + Math.round((G.agent.commission || 0) * 100) + '%)', '−' + commissionPaid.toLocaleString('fr-FR') + ' €', '#EF4444');
      }
      html += '</div>';
    }

    // Aucun revenu — alerte
    if (totalIn === 0 && G.currentTeam === 'Indépendant') {
      html += '<div style="margin:10px 20px 0;padding:10px 14px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);border-radius:10px">';
      html += '<div style="font-size:12px;color:#F87171;line-height:1.5">Sans contrat d\'équipe, tu n\'as pas de salaire. Signe un contrat ou multiplie les sponsors pour couvrir tes dépenses.</div>';
      html += '</div>';
    }

    // Conseil si budget faible
    if (after.budget < 3000) {
      html += '<div style="margin:10px 20px 0;padding:10px 14px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);border-radius:10px">';
      html += '<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:#F59E0B;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">⚠ Budget faible</div>';
      html += '<div style="font-size:12px;color:var(--text2)">Il reste moins de 3 000 €. Évite les dépenses non essentielles et concentre-toi sur les sponsors.</div>';
      html += '</div>';
    }

    // Bouton fermer
    html += '<div style="padding:16px 20px">';
    html += '<button onclick="document.getElementById(\'rj-bilan-overlay\').remove()" style="width:100%;padding:13px;background:var(--red);color:#fff;border:none;border-radius:12px;font-family:var(--font-display);font-size:13px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;cursor:pointer">Continuer</button>';
    html += '</div>';

    card.innerHTML = html;
    overlay.appendChild(card);

    // Fermer sur clic overlay
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.remove();
    });

    // Injecter les keyframes si absent
    if (!document.getElementById('rj-bilan-keyframes')) {
      var style = document.createElement('style');
      style.id = 'rj-bilan-keyframes';
      style.textContent = '@keyframes rjFadeIn{from{opacity:0}to{opacity:1}}@keyframes rjSlideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}';
      document.head.appendChild(style);
    }

    document.body.appendChild(overlay);
  }

  function _rjBilanRow(label, value, color, small) {
    var sz = small ? '11px' : '12px';
    var fw = small ? '500' : '700';
    var lcolor = small ? 'var(--muted)' : 'var(--text2)';
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--line)">'
      + '<span style="font-size:' + sz + ';color:' + lcolor + '">' + label + '</span>'
      + '<span style="font-size:' + sz + ';font-weight:' + fw + ';color:' + color + '">' + value + '</span>'
      + '</div>';
  }

  // =========================================================================
  // E. WRAPPER advanceToNextMoment — injecte le snapshot + popup bilan
  // =========================================================================

  (function _rjWrapAdvance() {
    // Bilan mis en attente quand on ENTRE en week-end de course.
    // Il sera affiché à la FIN du week-end, au retour vers l'accueil.
    var _rjPending = null;

    function doWrap() {
      if (typeof window.advanceToNextMoment !== 'function') {
        setTimeout(doWrap, 500); return;
      }
      if (window.advanceToNextMoment._rjFinanceWrapped) return;

      var orig = window.advanceToNextMoment;
      window.advanceToNextMoment = function() {
        // Écran courant AVANT avancement
        var scrBefore = '';
        try { var _sb = document.querySelector('.scr.on'); scrBefore = _sb ? _sb.id : ''; } catch(e) {}

        // Snapshot avant
        var weekBefore = G.semaine;
        var snapshot = null;
        try { snapshot = _rjSnapFinance(); } catch(e) {}

        var result = orig.apply(this, arguments);

        // Écran courant APRÈS avancement
        var scrAfter = '';
        try { var _sa = document.querySelector('.scr.on'); scrAfter = _sa ? _sa.id : ''; } catch(e) {}

        try {
          var weeksAdvanced = Math.max(0, (G.semaine || 0) - (weekBefore || 0));

          // CAS 1 : on avance le temps et on ENTRE en week-end de course (S-race).
          // On ne montre PAS le bilan tout de suite : on le met en attente pour
          // l'afficher au RETOUR à l'accueil, à la fin du week-end.
          if (snapshot && weeksAdvanced > 0 && scrAfter === 'S-race') {
            _rjApplyMaterialCosts(weeksAdvanced);
            _rjPending = {
              before: snapshot,
              weeks: weeksAdvanced,
              afterBudget: (G.budget || 0)
            };
          }
          // CAS 2 : avancement de temps SANS entrer en week-end (événement…) → bilan immédiat.
          else if (snapshot && weeksAdvanced > 0) {
            _rjApplyMaterialCosts(weeksAdvanced);
            setTimeout(function() {
              try { _rjShowWeeklyBilan(snapshot, weeksAdvanced); } catch(e) {
                console.warn('[10-finance] bilan popup:', e);
              }
            }, 350);
          }

          // FLUSH : on QUITTE le week-end (S-race → autre écran) avec un bilan en
          // attente → on l'affiche maintenant, à la fin du week-end.
          if (scrBefore === 'S-race' && scrAfter !== 'S-race' && _rjPending) {
            var pend = _rjPending;
            _rjPending = null;
            setTimeout(function() {
              try { _rjShowWeeklyBilan(pend.before, pend.weeks, pend.afterBudget); } catch(e) {
                console.warn('[10-finance] bilan popup (fin week-end):', e);
              }
            }, 450);
          }
        } catch(e) { console.warn('[10-finance] wrap advance:', e); }

        return result;
      };
      window.advanceToNextMoment._rjFinanceWrapped = true;
      console.log('[10-finance] advanceToNextMoment wrappé pour bilan financier (bilan en fin de week-end)');
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', doWrap);
    } else { doWrap(); }
  })();

  // =========================================================================
  // F. COÛTS DE MATÉRIEL / DÉPLACEMENTS
  // Appliqués chaque semaine pour les pilotes sans contrat ou en indépendant
  // =========================================================================

  function _rjApplyMaterialCosts(weeks) {
    if (!G || !G.cat) return;
    weeks = weeks || 1;
    var costs = RJ_CAT_COSTS[G.cat];
    if (!costs) return;

    var weeklyMat = _rjCalcWeeklyMaterial();
    if (weeklyMat <= 0) return;

    // Seule la F1 est entièrement prise en charge par l'écurie
    // En KJ/KS/F4+ sous contrat, les frais de matériel restent à charge du pilote
    if (G.cat === 'Formule 1') return;

    var totalCost = weeklyMat * weeks;
    if (totalCost > 0) {
      G.budget = Math.max(0, (G.budget || 0) - totalCost);
      G._rjLastMaterialCost = (G._rjLastMaterialCost || 0) + totalCost;
    }
  }

  // =========================================================================
  // G. PAGE FINANCES — renderFinancePage()
  // Injectée dans l'onglet "Réseau" de S-contracts (renommé "Finances")
  // =========================================================================

  window.renderFinancePage = function() {
    var el = document.getElementById('ct-reseau') || document.getElementById('reseau-content');
    if (!el) return;

    var html = '<div style="padding:14px 16px">';

    // ---- 1. Vue d'ensemble ----
    var budgetColor = (G.budget || 0) >= 5000 ? '#4ADE80' : (G.budget || 0) >= 2000 ? '#F59E0B' : '#EF4444';
    var weeklyNet = _rjCalcWeeklyNet();
    var netColor = weeklyNet >= 0 ? '#4ADE80' : '#EF4444';

    html += '<div style="display:flex;gap:8px;margin-bottom:14px">';

    // Budget
    html += '<div style="flex:1;padding:14px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:12px;text-align:center">';
    html += '<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--muted);letter-spacing:.12em;text-transform:uppercase;margin-bottom:5px">Solde</div>';
    html += '<div style="font-family:var(--font-display);font-size:20px;font-weight:900;color:' + budgetColor + ';line-height:1">' + _rjFmtMoney(G.budget || 0) + '</div>';
    html += '</div>';

    // Net / semaine
    html += '<div style="flex:1;padding:14px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:12px;text-align:center">';
    html += '<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--muted);letter-spacing:.12em;text-transform:uppercase;margin-bottom:5px">Net / semaine</div>';
    html += '<div style="font-family:var(--font-display);font-size:20px;font-weight:900;color:' + netColor + ';line-height:1">' + (weeklyNet >= 0 ? '+' : '') + _rjFmtMoney(weeklyNet) + '</div>';
    html += '</div>';

    // Projection fin de saison (semaines restantes × net)
    var weeksLeft = Math.max(0, 48 - (G.semaine || 1));
    var projected = (G.budget || 0) + weeklyNet * weeksLeft;
    var projColor = projected >= 5000 ? '#4ADE80' : projected >= 0 ? '#F59E0B' : '#EF4444';
    html += '<div style="flex:1;padding:14px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:12px;text-align:center">';
    html += '<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--muted);letter-spacing:.12em;text-transform:uppercase;margin-bottom:5px">Fin de saison</div>';
    html += '<div style="font-family:var(--font-display);font-size:20px;font-weight:900;color:' + projColor + ';line-height:1">' + _rjFmtMoney(projected) + '</div>';
    html += '</div>';

    html += '</div>'; // fin stats

    // ---- 2. Revenus détaillés ----
    html += '<div style="margin-bottom:12px">';
    html += '<div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:#4ADE80;letter-spacing:.14em;text-transform:uppercase;margin-bottom:8px">↑ Revenus par semaine</div>';

    var salary = _rjCalcSalaryWeekly();
    if (salary > 0) {
      html += _rjFinanceRow(G.currentTeam || 'Salaire contrat', salary, '#4ADE80', 'contrat');
    } else if (G.currentTeam && G.currentTeam !== 'Indépendant') {
      html += _rjFinanceRow(G.currentTeam, 0, '#94A3B8', 'contrat');
    }

    if (G.sponsors && G.sponsors.length) {
      G.sponsors.forEach(function(s) {
        var fee = Math.round((s.fee || 0) / 4);
        if (fee > 0) {
          html += _rjFinanceRow(s.name || 'Sponsor', fee, '#4ADE80',
            (s.sponsorKind || 'sponsor') + (s.ecurieOnly ? ' · Écurie' : ''));
        }
      });
    } else {
      html += '<div style="padding:8px 0;font-size:12px;color:var(--muted);font-style:italic">Aucun sponsor actif.</div>';
    }

    if (salary === 0 && (!G.sponsors || !G.sponsors.length)) {
      html += '<div style="padding:10px 12px;background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.2);border-radius:8px;font-size:12px;color:#F87171;margin-top:6px">Aucun revenu. Signe un contrat ou des sponsors pour financer ta saison.</div>';
    }
    html += '</div>';

    // ---- 3. Dépenses détaillées ----
    html += '<div style="margin-bottom:12px">';
    html += '<div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:#EF4444;letter-spacing:.14em;text-transform:uppercase;margin-bottom:8px">↓ Dépenses par semaine</div>';

    var material = _rjCalcWeeklyMaterial();
    if (material > 0) {
      var matLabel = ['Karting Junior','Karting Senior'].indexOf(G.cat) >= 0 ? 'Entretien kart' : 'Matériel / préparation';
      html += _rjFinanceRowCost(matLabel, material, '#EF4444', 'Variable selon la catégorie');
    }

    if (G.owned && G.owned.length) {
      G.owned.forEach(function(o) {
        var m = Math.round((o.maintenance || 0) / 4);
        if (m > 0) html += _rjFinanceRowCost(o.name || 'Bien', m, '#EF4444', 'Maintenance hebdomadaire');
      });
    }

    var commission = _rjCalcCommission();
    if (commission > 0 && G.agent) {
      html += _rjFinanceRowCost(
        (G.agent.name || 'Agent') + ' (' + Math.round((G.agent.commission || 0) * 100) + '%)',
        commission, '#FB923C', 'Commission sur revenus bruts'
      );
    }

    var raceCost = _rjCalcRaceEntryCost();
    if (raceCost > 0) {
      html += _rjFinanceRowCost('Frais d\'engagement (course)', raceCost, '#EF4444', 'Par manche, si indépendant');
    }

    if (material === 0 && (!G.owned || !G.owned.length) && commission === 0) {
      html += '<div style="padding:8px 0;font-size:12px;color:var(--muted);font-style:italic">Aucune dépense récurrente.</div>';
    }
    html += '</div>';

    // ---- 4. Investissements disponibles ----
    html += '<div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:var(--text3);letter-spacing:.14em;text-transform:uppercase;margin-bottom:8px">Investissements gameplay</div>';

    var available = (window.RJ_INVESTMENTS || []).filter(function(inv) {
      if (inv.cat && inv.cat.indexOf(G.cat) < 0) return false;
      if (inv.once && G._rjPurchased && G._rjPurchased[inv.id]) return false;
      if (inv.cooldown_weeks && G._rjCooldowns && G._rjCooldowns[inv.id]) {
        var remaining = (G._rjCooldowns[inv.id] || 0) - (G.semaine || 0);
        if (remaining > 0) return false;
      }
      return true;
    });

    if (!available.length) {
      html += '<div style="padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;font-size:12px;color:var(--muted)">Aucun investissement disponible pour ta catégorie en ce moment.</div>';
    } else {
      // Grouper par catégorie
      var cats = ['materiel', 'coaching', 'mental', 'mediatique', 'administratif'];
      var catLabels = { materiel: 'Matériel', coaching: 'Coaching', mental: 'Mental & Médical', mediatique: 'Médiatique', administratif: 'Administratif' };

      cats.forEach(function(cat) {
        var items = available.filter(function(i) { return i.category === cat; });
        if (!items.length) return;

        html += '<div style="font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px;margin-top:10px">' + (catLabels[cat] || cat) + '</div>';

        items.forEach(function(inv) {
          var canAfford = (G.budget || 0) >= inv.cost;
          var borderColor = canAfford ? inv.color + '44' : 'var(--border)';
          var opacity = canAfford ? '1' : '0.55';

          html += '<div style="padding:12px 14px;background:' + inv.color + '10;border:1px solid ' + borderColor + ';border-radius:10px;margin-bottom:6px;opacity:' + opacity + '">';
          html += '<div style="display:flex;align-items:flex-start;gap:10px">';

          // Icône
          html += '<div style="width:36px;height:36px;border-radius:9px;background:' + inv.color + '22;border:1px solid ' + inv.color + '44;display:flex;align-items:center;justify-content:center;flex-shrink:0">';
          html += (typeof renderIcon === 'function') ? renderIcon(inv.icon || 'star', 16, inv.color) : '●';
          html += '</div>';

          html += '<div style="flex:1;min-width:0">';
          html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px">';
          html += '<span style="font-size:13px;font-weight:700;color:var(--text)">' + inv.name + '</span>';
          html += '<span style="font-family:var(--font-display);font-size:12px;font-weight:900;color:' + (canAfford ? inv.color : 'var(--muted)') + ';flex-shrink:0">' + inv.cost.toLocaleString('fr-FR') + ' €</span>';
          html += '</div>';
          html += '<div style="font-size:11px;color:var(--text3);margin-top:3px;line-height:1.4">' + inv.desc + '</div>';

          // Effets
          var effectLabel = _rjInvEffectLabel(inv);
          if (effectLabel) {
            html += '<div style="font-size:10px;color:' + inv.color + ';font-weight:600;margin-top:4px">→ ' + effectLabel + '</div>';
          }

          html += '</div>';
          html += '</div>';

          // Bouton acheter
          if (canAfford) {
            html += '<button onclick="rjBuyInvestment(\'' + inv.id + '\')" style="margin-top:9px;width:100%;padding:9px;background:' + inv.color + ';color:#fff;border:none;border-radius:8px;font-family:var(--font-display);font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;cursor:pointer">Investir ' + inv.cost.toLocaleString('fr-FR') + ' €</button>';
          } else {
            html += '<div style="margin-top:7px;font-size:11px;color:var(--muted);text-align:center">Manque ' + ((inv.cost - (G.budget || 0)).toLocaleString('fr-FR')) + ' €</div>';
          }

          html += '</div>';
        });
      });
    }

    html += '</div>'; // fin padding
    el.innerHTML = html;
  };

  function _rjInvEffectLabel(inv) {
    var parts = [];
    if (inv.effect) {
      if (inv.effect.type === 'substat') parts.push(inv.effect.key.replace(/_/g,' ') + ' +' + inv.effect.value + (inv.effect.duration ? ' (' + inv.effect.duration + ' sem.)' : ''));
      else if (inv.effect.type === 'train_bonus') parts.push('Entraîn. ' + inv.effect.stat + ' +' + Math.round((inv.effect.pct || 0) * 100) + '%');
      else if (inv.effect.type === 'mental') parts.push(inv.effect.key + ' ' + (inv.effect.delta > 0 ? '+' : '') + inv.effect.delta);
      else if (inv.effect.type === 'fatigue_reduction') parts.push('Fatigue −' + inv.effect.value);
      else if (inv.effect.type === 'ig_followers') parts.push('+' + (inv.effect.value || 0).toLocaleString('fr-FR') + ' abonnés IG');
      else if (inv.effect.type === 'rep') parts.push('Rép. ' + inv.effect.key + ' +' + inv.effect.delta);
      else if (inv.effect.type === 'weekly_cost_reduction') parts.push('Coûts −' + Math.round((inv.effect.pct||0)*100) + '%');
    }
    if (inv.effect2) {
      if (inv.effect2.type === 'substat') parts.push(inv.effect2.key.replace(/_/g,' ') + ' +' + inv.effect2.value);
      else if (inv.effect2.type === 'setup_bonus') parts.push('Bonus setup +' + inv.effect2.value);
      else if (inv.effect2.type === 'next_race_bonus') parts.push('Prochaine course +' + (inv.effect2.value * 100).toFixed(1) + '%');
    }
    return parts.join(' · ');
  }

  // =========================================================================
  // H. ACHETER UN INVESTISSEMENT
  // =========================================================================

  window.rjBuyInvestment = function(id) {
    var inv = (window.RJ_INVESTMENTS || []).find(function(i) { return i.id === id; });
    if (!inv) return;

    if ((G.budget || 0) < inv.cost) {
      if (typeof showToast === 'function') showToast('Budget insuffisant.');
      return;
    }

    // Déduire le coût
    G.budget -= inv.cost;

    // Tracker achat
    G._rjPurchased = G._rjPurchased || {};
    G._rjInvestmentEffects = G._rjInvestmentEffects || [];

    if (inv.once) G._rjPurchased[inv.id] = true;

    // Cooldown
    if (inv.cooldown_weeks) {
      G._rjCooldowns = G._rjCooldowns || {};
      G._rjCooldowns[inv.id] = (G.semaine || 1) + (inv.cooldown_weeks || 1);
    }

    // Appliquer les effets
    _rjApplyInvestmentEffect(inv.effect, inv);
    if (inv.effect2) _rjApplyInvestmentEffect(inv.effect2, inv);

    // Réduction matériel permanente
    if (inv.effect && inv.effect.type === 'weekly_cost_reduction' && inv.effect.key === 'material') {
      G._rjMaterialReduction = Math.min(0.5, (G._rjMaterialReduction || 0) + (inv.effect.pct || 0));
    }
    if (inv.effect2 && inv.effect2.type === 'weekly_cost_reduction' && inv.effect2.key === 'material') {
      G._rjMaterialReduction = Math.min(0.5, (G._rjMaterialReduction || 0) + (inv.effect2.pct || 0));
    }

    if (typeof showToast === 'function') showToast(inv.name + ' — acheté !');
    if (typeof updateUI === 'function') updateUI();
    renderFinancePage();
  };

  function _rjApplyInvestmentEffect(eff, inv) {
    if (!eff) return;
    try {
      if (eff.type === 'substat' && G.substats) {
        var key = eff.key;
        if (typeof G.substats[key] === 'number') {
          G.substats[key] = Math.min(100, G.substats[key] + (eff.value || 0));
          // Enregistrer pour expiration
          G._rjInvestmentEffects.push({
            key: key, delta: eff.value || 0,
            expires: (G.semaine || 1) + (eff.duration || 99)
          });
          // Recalcul stats legacy
          if (typeof computeLegacyStats === 'function') computeLegacyStats();
        }
      }
      else if (eff.type === 'mental' && typeof PILOT_MENTAL !== 'undefined') {
        if (eff.key === 'pressure') PILOT_MENTAL.pressure = Math.max(0, Math.min(100, (PILOT_MENTAL.pressure||50) + (eff.delta||0)));
        if (eff.key === 'confidence') PILOT_MENTAL.confidence = Math.max(0, Math.min(100, (PILOT_MENTAL.confidence||60) + (eff.delta||0)));
        if (eff.key === 'value') PILOT_MENTAL.value = Math.max(0, Math.min(100, (PILOT_MENTAL.value||60) + (eff.delta||0)));
      }
      else if (eff.type === 'fatigue_reduction') {
        var training = typeof getTraining === 'function' ? getTraining() : null;
        if (training) training.fatigue = Math.max(0, (training.fatigue||0) - (eff.value||0));
      }
      else if (eff.type === 'ig_followers') {
        G.igFollowers = (G.igFollowers || 0) + (eff.value || 0);
      }
      else if (eff.type === 'rep') {
        if (G.rep && eff.key) {
          G.rep[eff.key] = Math.min(100, Math.max(0, (G.rep[eff.key]||0) + (eff.delta||0)));
          if (typeof recomputeGlobalRep === 'function') recomputeGlobalRep();
        }
      }
      else if (eff.type === 'next_race_bonus') {
        G._rjNextRaceBonus = (G._rjNextRaceBonus || 0) + (eff.value || 0);
      }
    } catch(e) { console.warn('[10-finance] apply effect:', e); }
  }

  // =========================================================================
  // I. EXPIRATION DES EFFETS TEMPORAIRES — Hook weekly
  // =========================================================================

  if (typeof WEEKLY_TICK_HOOKS !== 'undefined') {
    var alreadyHas = WEEKLY_TICK_HOOKS.some(function(h) { return h.id === 'financeEffects'; });
    if (!alreadyHas) {
      WEEKLY_TICK_HOOKS.push({
        id: 'financeEffects',
        run: function() {
          _rjExpireEffects();
        }
      });
    }
  }

  function _rjExpireEffects() {
    if (!G._rjInvestmentEffects || !G._rjInvestmentEffects.length) return;
    var current = G.semaine || 1;
    var expired = [];
    var remaining = [];

    G._rjInvestmentEffects.forEach(function(eff) {
      if ((eff.expires || 999) <= current) {
        expired.push(eff);
      } else {
        remaining.push(eff);
      }
    });

    expired.forEach(function(eff) {
      if (eff.key && G.substats && typeof G.substats[eff.key] === 'number') {
        G.substats[eff.key] = Math.max(0, G.substats[eff.key] - (eff.delta || 0));
      }
    });

    if (expired.length && typeof computeLegacyStats === 'function') computeLegacyStats();
    G._rjInvestmentEffects = remaining;
  }

  // =========================================================================
  // J. HELPER — Calculs financiers
  // =========================================================================

  function _rjCalcSalaryWeekly() {
    if (!G.currentTeam || G.currentTeam === 'Indépendant') return 0;
    // G.revenue = salaire_contrat + somme(sponsors)
    // On isole le salaire seul via G._contractSalary (maintenu par _rjSyncContractSalary)
    if (G._contractSalary !== undefined) return Math.round(G._contractSalary / 4);
    // Fallback : déduire les sponsors de G.revenue
    var sponsorTotal = (G.sponsors || []).reduce(function(t, s) { return t + (s.fee || 0); }, 0);
    return Math.round(Math.max(0, (G.revenue || 0) - sponsorTotal) / 4);
  }

  // Maintenir G._contractSalary à jour à chaque changement de revenue/sponsors
  function _rjSyncContractSalary() {
    var sponsorTotal = (G.sponsors || []).reduce(function(t, s) { return t + (s.fee || 0); }, 0);
    G._contractSalary = Math.max(0, (G.revenue || 0) - sponsorTotal);
  }

  function _rjCalcWeeklyNet() {
    var salary = _rjCalcSalaryWeekly();
    var sponsors = (G.sponsors || []).reduce(function(t, s) {
      return t + Math.round((s.fee || 0) / 4);
    }, 0);
    var totalIn = salary + sponsors;
    var totalOut = _rjCalcMaintenance() + _rjCalcCommission() + _rjCalcWeeklyMaterial();
    return totalIn - totalOut;
  }

  function _rjCalcRaceEntryCost() {
    if (G.currentTeam && G.currentTeam !== 'Indépendant') return 0;
    var costs = RJ_CAT_COSTS[G.cat] || {};
    return costs.race_entry || 0;
  }

  function _rjFmtMoney(n) {
    var abs = Math.abs(Math.round(n));
    if (abs >= 1000000) return (abs / 1000000).toFixed(1).replace('.0','') + 'M €';
    if (abs >= 1000) return (abs / 1000).toFixed(0) + 'k €';
    return abs + ' €';
  }

  function _rjFinanceRow(label, weeklyAmount, color, sublabel) {
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--line)">'
      + '<div><div style="font-size:12px;color:var(--text)">' + label + '</div>'
      + (sublabel ? '<div style="font-size:10px;color:var(--muted);margin-top:1px">' + sublabel + '</div>' : '')
      + '</div>'
      + '<div style="text-align:right">'
      + '<div style="font-size:13px;font-weight:700;color:' + color + '">+' + weeklyAmount.toLocaleString('fr-FR') + ' €</div>'
      + '<div style="font-size:10px;color:var(--muted)">/ semaine</div>'
      + '</div>'
      + '</div>';
  }

  function _rjFinanceRowCost(label, weeklyAmount, color, sublabel) {
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--line)">'
      + '<div><div style="font-size:12px;color:var(--text)">' + label + '</div>'
      + (sublabel ? '<div style="font-size:10px;color:var(--muted);margin-top:1px">' + sublabel + '</div>' : '')
      + '</div>'
      + '<div style="text-align:right">'
      + '<div style="font-size:13px;font-weight:700;color:' + color + '">−' + weeklyAmount.toLocaleString('fr-FR') + ' €</div>'
      + '<div style="font-size:10px;color:var(--muted)">/ semaine</div>'
      + '</div>'
      + '</div>';
  }

  // =========================================================================
  // K. WRAPPER ctab — injecter l'onglet Finances dans S-contracts
  // =========================================================================

  (function _rjInjectFinanceTab() {
    function doInject() {
      var contractsEl = document.getElementById('S-contracts');
      if (!contractsEl) return;

      // Ajouter l'onglet "Finances" si absent
      var tabsEl = contractsEl.querySelector('.tabs');
      if (tabsEl && !tabsEl.querySelector('[data-tab="finances"]')) {
        var btn = document.createElement('button');
        btn.className = 'tab';
        btn.setAttribute('data-tab', 'finances');
        btn.onclick = function() {
          if (typeof ctab === 'function') ctab('finances');
        };
        btn.textContent = 'Finances';
        tabsEl.appendChild(btn);
      }

      // Ajouter le div ct-finances si absent
      var scroll = contractsEl.querySelector('.scroll');
      if (scroll && !document.getElementById('ct-finances')) {
        var div = document.createElement('div');
        div.id = 'ct-finances';
        div.style.display = 'none';
        scroll.appendChild(div);
      }

      console.log('[10-finance] Onglet Finances injecté dans S-contracts');
    }

    // Wrapper ctab pour gérer l'onglet finances
    function wrapCtab() {
      if (typeof window.ctab !== 'function') { setTimeout(wrapCtab, 500); return; }
      if (window.ctab._rjFinanceWrapped) return;
      var orig = window.ctab;
      window.ctab = function(tab) {
        // Gérer l'onglet finances manuellement
        if (tab === 'finances') {
          ['offres','primes','reseau','finances'].forEach(function(t) {
            var el = document.getElementById('ct-' + t);
            if (el) el.style.display = t === 'finances' ? 'block' : 'none';
          });
          document.querySelectorAll('#S-contracts .tab').forEach(function(b) {
            b.classList.toggle('on', b.getAttribute('data-tab') === 'finances');
          });
          renderFinancePage();
          return;
        }
        var r = orig.apply(this, arguments);
        return r;
      };
      window.ctab._rjFinanceWrapped = true;
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(doInject, 200);
        setTimeout(wrapCtab, 300);
      });
    } else {
      setTimeout(doInject, 200);
      setTimeout(wrapCtab, 300);
    }
  })();

  // =========================================================================
  // L. INTÉGRATION SAVE/LOAD — Persister les données finance
  // =========================================================================

  (function _rjPersistFinance() {
    function wrapSave() {
      if (typeof window.saveGame !== 'function') { setTimeout(wrapSave, 500); return; }
      if (window.saveGame._rjFinancePatched) return;
      var orig = window.saveGame;
      window.saveGame = function(slot) {
        try {
          if (G) {
            G._rjFinanceSave = {
              purchased: G._rjPurchased || {},
              cooldowns: G._rjCooldowns || {},
              effects: G._rjInvestmentEffects || [],
              materialReduction: G._rjMaterialReduction || 0,
              nextRaceBonus: G._rjNextRaceBonus || 0
            };
          }
        } catch(e) {}
        return orig.apply(this, arguments);
      };
      window.saveGame._rjFinancePatched = true;
    }

    function wrapLoad() {
      if (typeof window.loadSave !== 'function') { setTimeout(wrapLoad, 500); return; }
      if (window.loadSave._rjFinancePatched) return;
      var orig = window.loadSave;
      window.loadSave = function(slot) {
        var r = orig.apply(this, arguments);
        try {
          if (G && G._rjFinanceSave) {
            var fs = G._rjFinanceSave;
            G._rjPurchased = fs.purchased || {};
            G._rjCooldowns = fs.cooldowns || {};
            G._rjInvestmentEffects = fs.effects || [];
            G._rjMaterialReduction = fs.materialReduction || 0;
            G._rjNextRaceBonus = fs.nextRaceBonus || 0;
          }
        } catch(e) {}
        return r;
      };
      window.loadSave._rjFinancePatched = true;
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(wrapSave, 400);
        setTimeout(wrapLoad, 400);
      });
    } else {
      setTimeout(wrapSave, 400);
      setTimeout(wrapLoad, 400);
    }
  })();

  console.log('[10-finance] Module financier chargé');

})();

// ===========================================================================
// M. SYNC G._contractSalary — maintenir le salaire seul séparé des sponsors
// ---------------------------------------------------------------------------
// G.revenue mélange salaire contrat + sponsors. On isole le salaire via
// G._contractSalary, mis à jour à chaque changement de revenue ou sponsors.
// ===========================================================================
(function _rjInstallSalarySync() {
  var _installed = false;

  function syncNow() {
    try {
      if (typeof G === 'undefined' || !G) return;
      var st = (G.sponsors || []).reduce(function(t, s) { return t + (s.fee || 0); }, 0);
      G._contractSalary = Math.max(0, (G.revenue || 0) - st);
    } catch(e) {}
  }

  function wrapFn(fnName) {
    if (typeof window[fnName] !== 'function') return;
    if (window[fnName]._rjSalarySync) return;
    var orig = window[fnName];
    window[fnName] = function() {
      var r = orig.apply(this, arguments);
      try { syncNow(); } catch(e) {}
      return r;
    };
    window[fnName]._rjSalarySync = true;
  }

  function install() {
    if (_installed) return;
    _installed = true;
    ['startNextSeason', 'signSponsorNew', 'cancelSponsorNew',
     'signSponsorContract', 'loadSave'].forEach(wrapFn);
    syncNow();
    console.log('[10-finance] G._contractSalary sync installé');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(install, 400); });
  } else { setTimeout(install, 400); }
})();
