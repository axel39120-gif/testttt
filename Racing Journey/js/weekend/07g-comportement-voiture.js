/* =====================================================================
 * 07g-comportement-voiture.js — JAUGES DE COMPORTEMENT DE LA VOITURE
 *
 * Issu de l'ancien legacy/07-user-fixes.js (« corrections demandées par
 * l'utilisateur »), rangé par domaine lors de la restructuration (T8).
 * =================================================================== */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  // (copie de la petite fonction d'échappement de la fiche pilote)
  function _safeEsc(s) {
    if (typeof window._ppEscSafe === 'function') return window._ppEscSafe(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }


  // ========================================================================
  // FIX 11 — RÉGLAGES VOITURE : JAUGES DE COMPORTEMENT EN TEMPS RÉEL
  // ========================================================================
  // Demande utilisateur : retravailler les réglages dans l'esprit du brief
  // "philosophie des compromis" — chaque slider doit avoir des conséquences
  // visibles, le joueur doit ressentir "j'améliore X, je perds Y".
  //
  // CONSTAT :
  //   - Le système SETUP_COUPLINGS existe DÉJÀ (couplages auto entre curseurs)
  //   - computeAdvancedSetupScore évalue la qualité par rapport au sweet spot
  //   - MAIS : le joueur ne voit pas les compromis, c'est invisible
  //
  // STRATÉGIE :
  //   1. Calculer 6 stats internes "ressenties" depuis les 9 curseurs :
  //      rotation, stabilité, traction, agressivité, gestion pneus, vitesse
  //   2. Afficher ces stats sous forme de jauges colorées en temps réel
  //   3. Détecter les setups extrêmes/déséquilibrés → message ingénieur
  //   4. Animer chaque jauge à chaque mouvement de slider
  //   5. Garder TOUS les couplages SETUP_COUPLINGS existants (logique intacte)
  //
  // Le rendu est INJECTÉ dans le card "Équilibre voiture" existant via
  // un MutationObserver (sans casser la struct DOM originale).
  // ========================================================================

  /**
   * Calcule 6 stats internes à partir des 9 curseurs setup (échelle 0-10).
   * Renvoie chaque stat sur 0-100 avec une zone "neutre" autour de 50.
   * Modèle : équilibre des compromis F1 (aero, mécanique, pneus).
   */
  function _rjComputeBehaviorStats(setup) {
    var s = setup || {};
    function v(k, def) {
      var x = s[k];
      return (typeof x === 'number') ? x : (def == null ? 5 : def);
    }
    var avA = v('aileron_av', 5);     // Aileron avant : rotation+, stabilité-
    var avR = v('aileron_ar', 5);     // Aileron arrière : traction+, vitesse-
    var arA = v('antiroulis_av', 5);  // Antiroulis av : rotation+, traction-
    var arR = v('antiroulis_ar', 5);  // Antiroulis ar : stabilité+, agilité-
    var car = v('carrossage', 5);     // Carrossage : grip+, usure+
    var sus = v('suspension', 5);     // Suspension dure : réactivité+, traction-
    var prP = v('pression_pneus', 5); // Pression : vitesse+, grip-
    var dif = v('differentiel', 5);   // Diff fermé : traction+, rotation-
    var fre = v('repartition_frein', 5); // Frein avant : freinage+, instabilité+

    // ROTATION (capacité à tourner / agilité avant)
    // Aile avant ↑, antiroulis avant ↑, suspension dure ↑, diff ouvert ↑
    var rot = 50
      + (avA - 5) * 4.5
      + (arA - 5) * 3.5
      + (sus - 5) * 2.0
      + (5 - dif) * 2.0
      - (avR - 5) * 1.8
      - (arR - 5) * 1.5;

    // STABILITÉ (sécurité, prévisibilité)
    // Aile arrière ↑, antiroulis arrière ↑, suspension souple ↑, frein arrière ↑
    var sta = 50
      + (avR - 5) * 4.5
      + (arR - 5) * 3.0
      + (5 - sus) * 2.5
      + (5 - fre) * 2.0
      - (avA - 5) * 2.5
      - (arA - 5) * 2.0
      - (prP - 5) * 1.5;

    // TRACTION (motricité en sortie de virage)
    // Aile arrière ↑, suspension souple ↑, antiroulis arrière souple ↑, diff fermé ↑
    var tra = 50
      + (avR - 5) * 3.5
      + (5 - sus) * 2.5
      + (5 - arR) * 2.0
      + (dif - 5) * 3.0
      - (arA - 5) * 1.5
      - (prP - 5) * 1.0;

    // AGRESSIVITÉ (caractère pointu, comportement nerveux)
    // Antiroulis durs ↑, aile avant ↑, suspension dure ↑, frein avant ↑
    var agg = 50
      + (arA - 5) * 3.0
      + (arR - 5) * 1.5
      + (avA - 5) * 3.0
      + (sus - 5) * 2.0
      + (fre - 5) * 2.5
      - (avR - 5) * 1.5;

    // GESTION PNEUS (durée de vie / dégradation faible)
    // Carrossage faible ↑, pression équilibrée ↑, antiroulis souples ↑
    var pne = 50
      + (5 - car) * 4.0
      - Math.abs(prP - 5) * 2.5
      + (5 - arA) * 1.2
      + (5 - arR) * 1.2
      + (5 - sus) * 1.0
      - (avA - 5) * 0.8;

    // VITESSE DE POINTE (top speed sur ligne droite)
    // Ailerons faibles ↑, pression élevée ↑, carrossage faible ↑
    var vit = 50
      + (5 - avA) * 3.5
      + (5 - avR) * 4.0
      + (prP - 5) * 2.5
      + (5 - car) * 1.5;

    function clamp(x) { return Math.max(0, Math.min(100, Math.round(x))); }
    return {
      rotation:    clamp(rot),
      stabilite:   clamp(sta),
      traction:    clamp(tra),
      agressivite: clamp(agg),
      pneus:       clamp(pne),
      vitesse:     clamp(vit)
    };
  }

  /**
   * Détecte les setups extrêmes pour un commentaire ingénieur.
   * Renvoie une chaîne courte ou null.
   */
  function _rjDiagnoseSetup(stats) {
    if (!stats) return null;
    if (stats.rotation > 78 && stats.stabilite < 35)
      return { tone: 'warn', txt: 'Avant très pointu — risque de survirage à haute vitesse.' };
    if (stats.stabilite > 80 && stats.rotation < 35)
      return { tone: 'info', txt: 'Voiture saine mais paresseuse en entrée de virage.' };
    if (stats.agressivite > 80)
      return { tone: 'warn', txt: 'Setup nerveux. Marges très fines, fatigue pilote élevée.' };
    if (stats.traction < 30)
      return { tone: 'warn', txt: 'Motricité fragile en sortie de virage.' };
    if (stats.vitesse > 80 && stats.stabilite < 40)
      return { tone: 'warn', txt: 'Dragster instable — bon en ligne droite, périlleux en courbe.' };
    if (stats.pneus < 30)
      return { tone: 'warn', txt: 'Pneus à risque — dégradation thermique probable.' };
    if (stats.rotation >= 55 && stats.stabilite >= 55 && stats.traction >= 55)
      return { tone: 'good', txt: 'Bel équilibre — la voiture devrait répondre proprement.' };
    return null;
  }

  var _RJ_BEHAVIOR_DEFS = [
    { k: 'rotation',    label: 'Rotation',    color: '#FF1801', desc: 'Agilité avant' },
    { k: 'stabilite',   label: 'Stabilité',   color: '#60A5FA', desc: 'Prévisibilité' },
    { k: 'traction',    label: 'Traction',    color: '#34D399', desc: 'Motricité' },
    { k: 'agressivite', label: 'Agressivité', color: '#F59E0B', desc: 'Caractère' },
    { k: 'pneus',       label: 'Pneus',       color: '#A78BFA', desc: 'Gestion gomme' },
    { k: 'vitesse',     label: 'Vitesse',     color: '#22D3EE', desc: 'Top speed' }
  ];

  function _rjGaugeColor(v, color) {
    if (v < 25) return '#EF4444';
    if (v < 40) return '#F59E0B';
    return color;
  }

  function _rjBuildBehaviorPanel() {
    if (typeof window.G === 'undefined' || !window.G || !window.G.setupAdv) return '';
    var stats = _rjComputeBehaviorStats(window.G.setupAdv);
    var diag = _rjDiagnoseSetup(stats);

    var html = '<div class="rj-bp" id="rj-behavior-panel">';
    html += '  <div class="rj-bp-head">';
    html += '    <div class="rj-bp-kicker">Comportement voiture</div>';
    html += '    <div class="rj-bp-hint">Chaque réglage modifie ces équilibres en temps réel.</div>';
    html += '  </div>';
    html += '  <div class="rj-bp-grid">';
    _RJ_BEHAVIOR_DEFS.forEach(function(def) {
      var v = stats[def.k];
      var c = _rjGaugeColor(v, def.color);
      html += '<div class="rj-bp-cell" style="--c:' + c + '" data-stat="' + def.k + '">';
      html += '  <div class="rj-bp-row">';
      html += '    <span class="rj-bp-label">' + def.label + '</span>';
      html += '    <span class="rj-bp-val" id="rj-bp-val-' + def.k + '">' + v + '</span>';
      html += '  </div>';
      html += '  <div class="rj-bp-bar"><div class="rj-bp-fill" id="rj-bp-fill-' + def.k +
              '" style="width:' + v + '%;background:' + c + '"></div></div>';
      html += '</div>';
    });
    html += '  </div>';
    if (diag) {
      var dCls = 'rj-bp-diag rj-bp-diag-' + diag.tone;
      html += '<div class="' + dCls + '" id="rj-bp-diag">';
      html += '  <span class="rj-bp-diag-dot"></span>';
      html += '  <span>' + _safeEsc(diag.txt) + '</span>';
      html += '</div>';
    } else {
      html += '<div class="rj-bp-diag rj-bp-diag-empty" id="rj-bp-diag" style="display:none"></div>';
    }
    html += '</div>';
    return html;
  }

  function _rjUpdateBehaviorPanel() {
    try {
      var panel = document.getElementById('rj-behavior-panel');
      if (!panel) return;
      if (!window.G || !window.G.setupAdv) return;
      var stats = _rjComputeBehaviorStats(window.G.setupAdv);
      _RJ_BEHAVIOR_DEFS.forEach(function(def) {
        var v = stats[def.k];
        var c = _rjGaugeColor(v, def.color);
        var valEl = document.getElementById('rj-bp-val-' + def.k);
        var fillEl = document.getElementById('rj-bp-fill-' + def.k);
        var cellEl = panel.querySelector('[data-stat="' + def.k + '"]');
        if (valEl) {
          // Effet "pulse" si changement significatif
          var prev = parseInt(valEl.textContent, 10);
          if (!isNaN(prev) && Math.abs(prev - v) >= 3) {
            valEl.classList.add('rj-bp-pulse');
            setTimeout(function() { valEl.classList.remove('rj-bp-pulse'); }, 380);
          }
          valEl.textContent = v;
        }
        if (fillEl) {
          fillEl.style.width = v + '%';
          fillEl.style.background = c;
        }
        if (cellEl) cellEl.style.setProperty('--c', c);
      });
      // Diagnostic
      var diag = _rjDiagnoseSetup(stats);
      var diagEl = document.getElementById('rj-bp-diag');
      if (diagEl) {
        if (diag) {
          diagEl.className = 'rj-bp-diag rj-bp-diag-' + diag.tone;
          diagEl.style.display = '';
          diagEl.innerHTML = '<span class="rj-bp-diag-dot"></span><span>' +
            _safeEsc(diag.txt) + '</span>';
        } else {
          diagEl.style.display = 'none';
          diagEl.innerHTML = '';
        }
      }
    } catch (e) { console.warn('[07] _rjUpdateBehaviorPanel err:', e); }
  }

  function _injectBehaviorPanelCSS() {
    if (document.getElementById('rj-bp-css')) return;
    var css = '' +
    '.rj-bp{margin:0 0 10px;padding:12px 14px 10px;border-radius:var(--r);' +
    'background:linear-gradient(180deg,var(--bg3) 0%,var(--bg2) 100%);' +
    'border:1px solid var(--border-hi);overflow:hidden;position:relative}' +
    '.rj-bp::before{content:"";position:absolute;top:0;left:0;right:0;height:1px;' +
    'background:linear-gradient(90deg,transparent 0%,var(--red2) 30%,var(--red3) 50%,var(--red2) 70%,transparent 100%);opacity:.6}' +
    '.rj-bp-head{margin-bottom:10px}' +
    '.rj-bp-kicker{font-family:var(--font-display);font-size:11px;font-weight:800;' +
    'color:var(--text);letter-spacing:.10em;text-transform:uppercase}' +
    '.rj-bp-hint{font-size:10.5px;color:var(--text3);line-height:1.35;margin-top:2px}' +
    '.rj-bp-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 14px}' +
    '.rj-bp-cell{display:flex;flex-direction:column;gap:4px}' +
    '.rj-bp-row{display:flex;justify-content:space-between;align-items:baseline}' +
    '.rj-bp-label{font-family:var(--font-display);font-size:10px;font-weight:800;' +
    'color:var(--muted);letter-spacing:.08em;text-transform:uppercase}' +
    '.rj-bp-val{font-family:var(--font-display);font-size:13px;font-weight:900;' +
    'color:var(--c);line-height:1;letter-spacing:.01em;transition:color .2s ease,transform .15s ease}' +
    '.rj-bp-val.rj-bp-pulse{transform:scale(1.18)}' +
    '.rj-bp-bar{height:4px;background:rgba(255,255,255,0.05);border-radius:2px;overflow:hidden;' +
    'position:relative}' +
    '.rj-bp-fill{height:100%;border-radius:2px;' +
    'transition:width .35s cubic-bezier(.4,0,.2,1),background .25s ease;' +
    'box-shadow:0 0 8px color-mix(in srgb,var(--c) 35%,transparent)}' +
    '.rj-bp-diag{margin-top:10px;padding:8px 10px;border-radius:7px;' +
    'display:flex;align-items:center;gap:8px;font-size:11.5px;line-height:1.35}' +
    '.rj-bp-diag-dot{flex-shrink:0;width:6px;height:6px;border-radius:50%;background:currentColor;' +
    'box-shadow:0 0 6px currentColor}' +
    '.rj-bp-diag-good{color:#34D399;background:rgba(52,211,153,0.08);' +
    'border:1px solid rgba(52,211,153,0.25)}' +
    '.rj-bp-diag-warn{color:#F59E0B;background:rgba(245,158,11,0.08);' +
    'border:1px solid rgba(245,158,11,0.25)}' +
    '.rj-bp-diag-info{color:#60A5FA;background:rgba(96,165,250,0.08);' +
    'border:1px solid rgba(96,165,250,0.25)}' +
    '';
    var s = document.createElement('style');
    s.id = 'rj-bp-css';
    s.textContent = css;
    document.head.appendChild(s);
  }

  /**
   * Injecte le panneau dans le card Équilibre voiture après chaque rendu.
   * Le panneau est ajouté en HAUT du container #advanced-setup-container,
   * juste avant le card "Équilibre voiture" original.
   */
  function _rjInjectBehaviorPanel() {
    try {
      var container = document.getElementById('advanced-setup-container');
      if (!container) return;
      // Vérifier qu'on a bien G.setupAdv (sinon le panneau n'a pas de sens)
      if (!window.G || !window.G.setupAdv) return;
      // Si déjà présent ET pas dépassé, on update juste les valeurs
      var existing = document.getElementById('rj-behavior-panel');
      if (existing && existing.parentElement === container) {
        // Si c'est le 1er enfant, on le laisse et on update
        if (container.firstElementChild === existing) {
          _rjUpdateBehaviorPanel();
          return;
        }
        // Sinon on le retire (le DOM a été reconstruit autour)
        existing.remove();
      } else if (existing) {
        existing.remove();
      }
      // Injecter en première position
      var html = _rjBuildBehaviorPanel();
      if (!html) return;
      var wrapper = document.createElement('div');
      wrapper.innerHTML = html;
      var node = wrapper.firstElementChild;
      if (node) {
        container.insertBefore(node, container.firstChild);
      }
    } catch (e) { console.warn('[07] _rjInjectBehaviorPanel err:', e); }
  }

  function wrapRenderAdvancedSetupUI() {
    if (typeof window.renderAdvancedSetupUI !== 'function') return false;
    if (window.renderAdvancedSetupUI._rjUserFixBehavior) return true;
    var orig = window.renderAdvancedSetupUI;
    rjInscrire("renderAdvancedSetupUI", { id: "07g-comportement-voiture:renderAdvancedSetupUI", ordre: -2600, remplace: function (args, suite) {
      var r;
      try { r = suite(); }
      catch (e) { console.warn('[07] renderAdvancedSetupUI orig:', e); }
      // Après le rendu original, on injecte/update le panneau
      try { _rjInjectBehaviorPanel(); } catch (e) {}
      return r;
    } });
    window.renderAdvancedSetupUI._rjUserFixBehavior = true;
    console.log('[07] renderAdvancedSetupUI wrapped (behavior gauges)');
    return true;
  }

  /**
   * Wrap setAdvParam pour mettre à jour les jauges en temps réel
   * SANS toucher à la logique de couplage existante.
   */
  function wrapSetAdvParam() {
    if (typeof window.setAdvParam !== 'function') return false;
    if (window.setAdvParam._rjUserFixBehavior) return true;
    var orig = window.setAdvParam;
    rjInscrire("setAdvParam", { id: "07g-comportement-voiture:setAdvParam", ordre: -2600, remplace: function (args, suite) {
      var r;
      try { r = suite(); }
      catch (e) { console.warn('[07] setAdvParam orig:', e); }
      // Update jauges (le re-render complet est déjà fait par l'orig,
      // mais notre wrap renderAdvancedSetupUI ré-injectera le panneau si besoin)
      try { _rjUpdateBehaviorPanel(); } catch (e) {}
      return r;
    } });
    window.setAdvParam._rjUserFixBehavior = true;
    return true;
  }

  /**
   * Watchdog : si l'écran "Équilibre voiture" est ouvert et que le panneau
   * disparaît (ré-render externe), on le ré-injecte.
   */
  function _rjStartBehaviorWatchdog() {
    setInterval(function() {
      try {
        var container = document.getElementById('advanced-setup-container');
        if (!container) return;
        // L'écran de course doit être actif et l'onglet rt-prep visible
        var sRace = document.getElementById('S-race');
        if (!sRace || !sRace.classList.contains('on')) return;
        var rtPrep = document.getElementById('rt-prep');
        if (!rtPrep || rtPrep.style.display === 'none') return;
        // Le card original doit être présent
        if (!container.children.length) return;
        // Inject si pas déjà là
        if (!document.getElementById('rj-behavior-panel')) {
          _rjInjectBehaviorPanel();
        }
      } catch (e) {}
    }, 1500);
  }

  _rjStartBehaviorWatchdog();

  function appliquer() {
    try { _injectBehaviorPanelCSS(); } catch (e) { console.warn('[07] _injectBehaviorPanelCSS();', e); }
    try { wrapRenderAdvancedSetupUI(); } catch (e) { console.warn('[07] wrapRenderAdvancedSetupUI();', e); }
    try { wrapSetAdvParam(); } catch (e) { console.warn('[07] wrapSetAdvParam();', e); }
  }
  // Comme l'ancien installateur commun : au chargement, puis trois reprises
  // (des modules chargés après peuvent redéfinir les fonctions visées).
  function planifier() {
    appliquer();
    setTimeout(appliquer, 300);
    setTimeout(appliquer, 1200);
    setTimeout(appliquer, 3000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', planifier);
  else planifier();
})();
