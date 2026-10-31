/* =====================================================================
 * 07f-pre-saison.js — PLANIFICATION DE PRÉ-SAISON
 *
 * Issu de l'ancien legacy/07-user-fixes.js (« corrections demandées par
 * l'utilisateur »), rangé par domaine lors de la restructuration (T8).
 * =================================================================== */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;



  // ========================================================================
  // FIX 10 — REFONTE ESTHÉTIQUE PAGE PRÉ-SAISON
  // ========================================================================
  // Demande utilisateur : retravailler totalement l'esthétique de la page
  // pré-saison pour coller à la DA F1 du jeu.
  //
  // DA cible (cf. styles.css) :
  //   - Couleurs : noir profond (#000/--bg), accent rouge --red2 (#FF1801),
  //     or --gold (#FFC107), cyan --teal (#00D4FF), font Rubik display
  //   - Système card : .f1-card, .f1-section, .f1-tag, .f1-metric, .f1-pos
  //   - Pattern visuel : barre rouge décorative gauche, gradient sombre,
  //     glow rouge radial, headers uppercase letter-spacing display
  //
  // Stratégie : remplacement complet de renderPreseasonPlanning par un
  // nouveau rendu, en gardant les IDs et helpers (_psPickObj, _psAdjustBudget,
  // _psPickAngle, _psValidate, _psUpdateTotal). Helpers wrappés pour
  // s'adapter à la nouvelle structure DOM.
  // ========================================================================

  var _PS_OBJ_ICONS = {
    titre: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 010-5H6M18 9h1.5a2.5 2.5 0 000-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21-1.15.53-2.03 1.55-2.03 2.79h10c0-1.24-.88-2.26-2.03-2.79-.5-.23-.97-.66-.97-1.21V14.66M18 2v6.36C18 11.32 15.31 14 12 14s-6-2.68-6-5.64V2"/></svg>',
    victoires: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 21 6 12 16 3 6"/><line x1="3" y1="6" x2="3" y2="20"/><line x1="21" y1="6" x2="21" y2="20"/><line x1="12" y1="16" x2="12" y2="20"/></svg>',
    podium: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="6" width="6" height="14"/><rect x="2" y="11" width="7" height="9"/><rect x="15" y="9" width="7" height="11"/></svg>',
    constance: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>'
  };

  var _PS_BUDGET_ICONS = {
    sim: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    coach: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5h11l-1.5 7h-8z"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>',
    lifestyle: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>',
    savings: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>'
  };

  var _PS_ANGLE_ICONS = {
    humble: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    provocateur: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    technique: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    mysterieux: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>'
  };

  function _psBudgetMeta() {
    return [
      { k: 'sim',       label: 'Simulateur', desc: 'Performance en course, fatigue réduite', color: '#00D4FF', icon: _PS_BUDGET_ICONS.sim },
      { k: 'coach',     label: 'Entraîneur', desc: 'Progression accélérée des sub-stats',    color: '#FFB300', icon: _PS_BUDGET_ICONS.coach },
      { k: 'lifestyle', label: 'Lifestyle',  desc: 'Bonheur passif toute la saison',         color: '#EC4899', icon: _PS_BUDGET_ICONS.lifestyle },
      { k: 'savings',   label: 'Épargne',    desc: '+5 % de revenus sur la saison',          color: '#00E676', icon: _PS_BUDGET_ICONS.savings }
    ];
  }

  function _psSafe(s) {
    if (typeof window._ppEscSafe === 'function') return window._ppEscSafe(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _renderPreseasonNew() {
    var container = document.getElementById('preseason-content');
    if (!container) return;
    if (typeof window.PRESEASON_OBJECTIVES === 'undefined' ||
        typeof window.PRESEASON_ANGLES === 'undefined' ||
        typeof window.getPreseason !== 'function') return;

    var t = window.getPreseason();
    var curObj = (t && t.configured) ? t.objective : 'podium';
    var curBudget = (t && t.configured) ? t.budget : { sim: 25, coach: 25, lifestyle: 25, savings: 25 };
    var curAngle = (t && t.configured) ? t.angle : 'humble';
    window._presObjective = curObj;
    window._presBudget = Object.assign({}, curBudget);
    window._presAngle = curAngle;

    var saison = (window.G && window.G.saison) || 1;
    var startY = (window.G && window.G.pilot && window.G.pilot.startYear) || 2024;
    var year = startY + (saison - 1);
    var cat = (window.G && window.G.cat) || '';
    var team = (window.G && window.G.currentTeam) || 'Indépendant';

    var html = '';

    // ========== HERO ==========
    html += '<div class="rj-ps-hero">';
    html += '  <div class="rj-ps-hero-bg"></div>';
    html += '  <div class="rj-ps-hero-strip"></div>';
    html += '  <div class="rj-ps-hero-grid">';
    html += '    <div class="rj-ps-hero-icon">';
    html += '      <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>';
    html += '    </div>';
    html += '    <div class="rj-ps-hero-stack">';
    html += '      <div class="rj-ps-hero-kicker">Saison ' + saison + ' · ' + year + '</div>';
    html += '      <div class="rj-ps-hero-title">Plan de saison</div>';
    html += '      <div class="rj-ps-hero-sub">' + _psSafe(cat) + (team !== 'Indépendant' ? ' · ' + _psSafe(team) : '') + '</div>';
    html += '    </div>';
    html += '  </div>';
    html += '  <div class="rj-ps-hero-tagline">Définis ton approche. Tes choix colorent toute l\'année et débloquent un bonus si tu tiens ton objectif.</div>';
    html += '</div>';

    // ========== OBJECTIF ==========
    html += '<div class="rj-ps-section"><span>Objectif personnel</span></div>';
    html += '<div class="rj-ps-obj-grid">';
    Object.keys(window.PRESEASON_OBJECTIVES).forEach(function(k) {
      var o = window.PRESEASON_OBJECTIVES[k];
      var sel = curObj === k;
      var icon = _PS_OBJ_ICONS[k] || _PS_OBJ_ICONS.podium;
      html += '<div id="ps-obj-' + k + '" class="rj-ps-obj-card' + (sel ? ' on' : '') +
              '" onclick="_psPickObj(\'' + k + '\')" style="--c:' + o.color + '">';
      html += '  <div class="rj-ps-obj-ico">' + icon + '</div>';
      html += '  <div class="rj-ps-obj-body">';
      html += '    <div class="rj-ps-obj-label">' + _psSafe(o.label) + '</div>';
      html += '    <div class="rj-ps-obj-desc">' + _psSafe(o.desc) + '</div>';
      html += '  </div>';
      html += '  <div class="rj-ps-obj-check">';
      html += '    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      html += '  </div>';
      html += '</div>';
    });
    html += '</div>';

    // ========== BUDGET ==========
    html += '<div class="rj-ps-section"><span>Allocation des ressources</span></div>';
    html += '<div class="rj-ps-budget-card">';
    html += '  <div class="rj-ps-budget-hint">Atteins 40 %+ sur un poste pour débloquer un bonus passif toute la saison.</div>';
    html += '  <div class="rj-ps-sliders">';
    _psBudgetMeta().forEach(function(b) {
      var v = curBudget[b.k] || 0;
      html += '<div class="rj-ps-slider-row" style="--c:' + b.color + '">';
      html += '  <div class="rj-ps-slider-head">';
      html += '    <div class="rj-ps-slider-ico">' + b.icon + '</div>';
      html += '    <div class="rj-ps-slider-info">';
      html += '      <div class="rj-ps-slider-label">' + b.label + '</div>';
      html += '      <div class="rj-ps-slider-desc">' + b.desc + '</div>';
      html += '    </div>';
      html += '    <div class="rj-ps-slider-val" id="ps-val-' + b.k + '">' + v + '<span>%</span></div>';
      html += '  </div>';
      html += '  <input type="range" id="ps-range-' + b.k + '" min="0" max="100" step="5" value="' + v +
              '" oninput="_psAdjustBudget(\'' + b.k + '\',this.value)" class="rj-ps-range">';
      html += '</div>';
    });
    html += '  </div>';
    html += '  <div class="rj-ps-total-bar">';
    html += '    <div class="rj-ps-total-lbl">Total alloué</div>';
    html += '    <div class="rj-ps-total-val" id="ps-total">100<span>%</span></div>';
    html += '  </div>';
    html += '</div>';

    // ========== ANGLE MÉDIA ==========
    html += '<div class="rj-ps-section"><span>Angle média</span></div>';
    html += '<div class="rj-ps-angle-grid">';
    Object.keys(window.PRESEASON_ANGLES).forEach(function(k) {
      var a = window.PRESEASON_ANGLES[k];
      var sel = curAngle === k;
      var icon = _PS_ANGLE_ICONS[k] || _PS_ANGLE_ICONS.humble;
      var repTags = '';
      Object.keys(a.rep || {}).forEach(function(rk) {
        var v = a.rep[rk];
        var tagCls = v > 0 ? 'pos' : 'neg';
        var sign = v > 0 ? '+' : '';
        repTags += '<span class="rj-ps-angle-tag ' + tagCls + '">' + sign + v + ' ' + rk + '</span>';
      });
      html += '<div id="ps-ang-' + k + '" class="rj-ps-angle-card' + (sel ? ' on' : '') +
              '" onclick="_psPickAngle(\'' + k + '\')" style="--c:' + a.color + '">';
      html += '  <div class="rj-ps-angle-head">';
      html += '    <div class="rj-ps-angle-ico">' + icon + '</div>';
      html += '    <div class="rj-ps-angle-label">' + _psSafe(a.label) + '</div>';
      html += '  </div>';
      html += '  <div class="rj-ps-angle-desc">' + _psSafe(a.desc) + '</div>';
      html += '  <div class="rj-ps-angle-tags">' + repTags + '</div>';
      html += '</div>';
    });
    html += '</div>';

    // ========== CTA ==========
    html += '<div class="rj-ps-cta-wrap">';
    html += '  <button id="ps-validate-btn" class="rj-ps-cta" onclick="_psValidate()">';
    html += '    <span class="rj-ps-cta-label">Valider mon plan</span>';
    html += '    <span class="rj-ps-cta-arrow">';
    html += '      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
    html += '    </span>';
    html += '  </button>';
    html += '</div>';

    container.innerHTML = html;

    if (typeof window._psUpdateTotal === 'function') window._psUpdateTotal();
  }

  function _injectPreseasonCSS() {
    if (document.getElementById('rj-ps-redesign-css')) return;
    var css = '' +
    '.rj-ps-hero{position:relative;margin:14px 14px 4px;padding:18px 16px 16px;border-radius:14px;' +
    'background:linear-gradient(180deg,rgba(255,24,1,0.10) 0%,var(--bg3) 60%,var(--bg2) 100%);' +
    'border:1px solid var(--border-hi);overflow:hidden}' +
    '.rj-ps-hero-bg{position:absolute;top:0;left:0;right:0;height:160px;' +
    'background:radial-gradient(ellipse at 50% -20%,rgba(255,24,1,0.30) 0%,transparent 60%),' +
    'radial-gradient(ellipse at 100% 50%,rgba(0,212,255,0.06) 0%,transparent 50%);' +
    'pointer-events:none;z-index:0}' +
    '.rj-ps-hero-strip{position:absolute;top:0;left:0;right:0;height:2px;' +
    'background:linear-gradient(90deg,transparent 0%,var(--red2) 25%,var(--red3) 50%,var(--red2) 75%,transparent 100%);' +
    'opacity:.85}' +
    '.rj-ps-hero-grid{position:relative;z-index:1;display:flex;align-items:center;gap:14px;margin-bottom:12px}' +
    '.rj-ps-hero-icon{flex-shrink:0;width:52px;height:52px;border-radius:12px;' +
    'background:linear-gradient(135deg,rgba(255,24,1,0.20) 0%,rgba(255,24,1,0.05) 100%);' +
    'border:1px solid rgba(255,24,1,0.40);' +
    'display:flex;align-items:center;justify-content:center;color:var(--red3);' +
    'box-shadow:0 4px 14px rgba(255,24,1,0.18)}' +
    '.rj-ps-hero-stack{flex:1;min-width:0}' +
    '.rj-ps-hero-kicker{font-family:var(--font-display);font-size:10px;font-weight:800;' +
    'color:var(--red3);letter-spacing:.20em;text-transform:uppercase;margin-bottom:2px}' +
    '.rj-ps-hero-title{font-family:var(--font-display);font-size:24px;font-weight:900;' +
    'color:var(--white);letter-spacing:.02em;text-transform:uppercase;line-height:1;margin-bottom:4px}' +
    '.rj-ps-hero-sub{font-size:12px;color:var(--soft);font-weight:600}' +
    '.rj-ps-hero-tagline{position:relative;z-index:1;font-size:12.5px;color:var(--text2);' +
    'line-height:1.5;padding-top:10px;border-top:1px solid var(--border)}' +

    '.rj-ps-section{font-family:var(--font-display);font-size:10px;font-weight:800;' +
    'color:var(--red3);letter-spacing:.20em;text-transform:uppercase;' +
    'padding:18px 16px 8px;display:flex;align-items:center;gap:10px}' +
    '.rj-ps-section::before{content:"";width:3px;height:14px;background:var(--red2);flex-shrink:0;border-radius:1px}' +
    '.rj-ps-section span{flex-shrink:0}' +
    '.rj-ps-section::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,var(--line2),transparent)}' +

    '.rj-ps-obj-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 14px}' +
    '.rj-ps-obj-card{position:relative;display:flex;flex-direction:column;gap:8px;' +
    'padding:14px 12px 12px;border-radius:12px;cursor:pointer;-webkit-tap-highlight-color:transparent;' +
    'background:linear-gradient(180deg,var(--bg3) 0%,var(--bg2) 100%);' +
    'border:1px solid var(--border-hi);border-left:3px solid rgba(255,255,255,0.06);' +
    'transition:border-color .15s ease,transform .12s ease,background .15s ease;overflow:hidden}' +
    '.rj-ps-obj-card::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;' +
    'background:radial-gradient(ellipse at top right,color-mix(in srgb,var(--c) 12%,transparent) 0%,transparent 60%);' +
    'opacity:0;transition:opacity .2s ease}' +
    '.rj-ps-obj-card.on{border-color:var(--c);border-left-color:var(--c);' +
    'box-shadow:0 0 0 1px var(--c) inset,0 6px 18px color-mix(in srgb,var(--c) 22%,transparent)}' +
    '.rj-ps-obj-card.on::before{opacity:1}' +
    '.rj-ps-obj-card:active{transform:scale(.98)}' +
    '.rj-ps-obj-ico{position:relative;z-index:1;width:36px;height:36px;border-radius:8px;' +
    'background:color-mix(in srgb,var(--c) 14%,transparent);border:1px solid color-mix(in srgb,var(--c) 32%,transparent);' +
    'color:var(--c);display:flex;align-items:center;justify-content:center}' +
    '.rj-ps-obj-card.on .rj-ps-obj-ico{background:color-mix(in srgb,var(--c) 24%,transparent);' +
    'border-color:var(--c)}' +
    '.rj-ps-obj-body{position:relative;z-index:1}' +
    '.rj-ps-obj-label{font-family:var(--font-display);font-size:13px;font-weight:800;' +
    'color:var(--text);letter-spacing:.02em;line-height:1.15;margin-bottom:3px}' +
    '.rj-ps-obj-card.on .rj-ps-obj-label{color:var(--c)}' +
    '.rj-ps-obj-desc{font-size:11px;color:var(--text3);line-height:1.35}' +
    '.rj-ps-obj-check{position:absolute;top:10px;right:10px;z-index:1;' +
    'width:20px;height:20px;border-radius:50%;background:var(--c);color:#000;' +
    'display:flex;align-items:center;justify-content:center;' +
    'opacity:0;transform:scale(.6);transition:opacity .18s ease,transform .18s ease}' +
    '.rj-ps-obj-card.on .rj-ps-obj-check{opacity:1;transform:scale(1)}' +

    '.rj-ps-budget-card{margin:0 14px;padding:14px 14px 12px;border-radius:12px;' +
    'background:linear-gradient(180deg,var(--bg3) 0%,var(--bg2) 100%);' +
    'border:1px solid var(--border-hi)}' +
    '.rj-ps-budget-hint{font-size:11px;color:var(--text3);line-height:1.45;' +
    'padding:8px 10px;margin-bottom:14px;border-radius:8px;' +
    'background:rgba(255,179,0,0.06);border-left:2px solid var(--amber)}' +
    '.rj-ps-sliders{display:flex;flex-direction:column;gap:14px}' +
    '.rj-ps-slider-head{display:flex;align-items:center;gap:10px;margin-bottom:8px}' +
    '.rj-ps-slider-ico{flex-shrink:0;width:28px;height:28px;border-radius:6px;' +
    'background:color-mix(in srgb,var(--c) 14%,transparent);border:1px solid color-mix(in srgb,var(--c) 30%,transparent);' +
    'color:var(--c);display:flex;align-items:center;justify-content:center}' +
    '.rj-ps-slider-info{flex:1;min-width:0}' +
    '.rj-ps-slider-label{font-family:var(--font-display);font-size:12px;font-weight:800;' +
    'color:var(--text);letter-spacing:.02em;line-height:1.1}' +
    '.rj-ps-slider-desc{font-size:10.5px;color:var(--text3);line-height:1.3;margin-top:2px}' +
    '.rj-ps-slider-val{font-family:var(--font-display);font-size:18px;font-weight:900;' +
    'color:var(--c);line-height:1;letter-spacing:.01em;min-width:42px;text-align:right}' +
    '.rj-ps-slider-val span{font-size:11px;color:var(--c);opacity:.7;margin-left:1px;font-weight:700}' +
    '.rj-ps-range{width:100%;height:4px;background:rgba(255,255,255,0.06);border-radius:2px;' +
    'appearance:none;-webkit-appearance:none;outline:none;cursor:pointer;accent-color:var(--c)}' +
    '.rj-ps-range::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;' +
    'width:18px;height:18px;border-radius:50%;background:var(--c);cursor:pointer;' +
    'border:2px solid var(--bg);box-shadow:0 2px 6px color-mix(in srgb,var(--c) 35%,transparent)}' +
    '.rj-ps-range::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:var(--c);' +
    'cursor:pointer;border:2px solid var(--bg);box-shadow:0 2px 6px color-mix(in srgb,var(--c) 35%,transparent)}' +
    '.rj-ps-total-bar{margin-top:14px;padding-top:12px;border-top:1px solid var(--border);' +
    'display:flex;justify-content:space-between;align-items:center}' +
    '.rj-ps-total-lbl{font-family:var(--font-display);font-size:10px;font-weight:800;' +
    'color:var(--muted);letter-spacing:.16em;text-transform:uppercase}' +
    '.rj-ps-total-val{font-family:var(--font-display);font-size:20px;font-weight:900;' +
    'color:var(--green);line-height:1;letter-spacing:.01em;transition:color .2s ease}' +
    '.rj-ps-total-val span{font-size:13px;opacity:.6;margin-left:1px}' +
    '.rj-ps-total-val.rj-ps-invalid{color:var(--red3)}' +

    '.rj-ps-angle-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:0 14px}' +
    '.rj-ps-angle-card{position:relative;padding:13px 12px 11px;border-radius:12px;cursor:pointer;' +
    '-webkit-tap-highlight-color:transparent;' +
    'background:linear-gradient(180deg,var(--bg3) 0%,var(--bg2) 100%);' +
    'border:1px solid var(--border-hi);border-left:3px solid rgba(255,255,255,0.06);' +
    'transition:border-color .15s ease,transform .12s ease;overflow:hidden}' +
    '.rj-ps-angle-card.on{border-color:var(--c);border-left-color:var(--c);' +
    'box-shadow:0 0 0 1px var(--c) inset,0 6px 18px color-mix(in srgb,var(--c) 22%,transparent)}' +
    '.rj-ps-angle-card:active{transform:scale(.985)}' +
    '.rj-ps-angle-head{display:flex;align-items:center;gap:8px;margin-bottom:5px}' +
    '.rj-ps-angle-ico{flex-shrink:0;width:30px;height:30px;border-radius:7px;' +
    'background:color-mix(in srgb,var(--c) 14%,transparent);' +
    'border:1px solid color-mix(in srgb,var(--c) 30%,transparent);' +
    'color:var(--c);display:flex;align-items:center;justify-content:center}' +
    '.rj-ps-angle-card.on .rj-ps-angle-ico{background:color-mix(in srgb,var(--c) 22%,transparent);' +
    'border-color:var(--c)}' +
    '.rj-ps-angle-label{font-family:var(--font-display);font-size:13px;font-weight:800;' +
    'color:var(--text);letter-spacing:.02em;line-height:1.1}' +
    '.rj-ps-angle-card.on .rj-ps-angle-label{color:var(--c)}' +
    '.rj-ps-angle-desc{font-size:11px;color:var(--text3);line-height:1.4;margin-bottom:8px;min-height:30px}' +
    '.rj-ps-angle-tags{display:flex;flex-wrap:wrap;gap:4px}' +
    '.rj-ps-angle-tag{font-family:var(--font-display);font-size:9.5px;font-weight:700;' +
    'padding:2px 6px;border-radius:3px;letter-spacing:.04em;' +
    'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);color:var(--text2)}' +
    '.rj-ps-angle-tag.pos{color:#34D399;background:rgba(52,211,153,0.10);border-color:rgba(52,211,153,0.25)}' +
    '.rj-ps-angle-tag.neg{color:#EF4444;background:rgba(239,68,68,0.10);border-color:rgba(239,68,68,0.25)}' +

    '.rj-ps-cta-wrap{margin:18px 14px 24px;padding:0}' +
    '.rj-ps-cta{width:100%;display:flex;align-items:center;justify-content:center;gap:10px;' +
    'padding:15px 18px;border-radius:12px;border:none;cursor:pointer;' +
    'background:linear-gradient(135deg,#FF1801 0%,#C8102E 100%);' +
    'color:#fff;font-family:var(--font-display);font-size:14px;font-weight:900;' +
    'letter-spacing:.10em;text-transform:uppercase;' +
    'box-shadow:0 6px 22px rgba(255,24,1,0.35),0 0 0 1px rgba(255,255,255,0.08) inset;' +
    'transition:transform .12s ease,box-shadow .15s ease,opacity .15s ease}' +
    '.rj-ps-cta:active:not(:disabled){transform:scale(.98)}' +
    '.rj-ps-cta:disabled{opacity:.45;cursor:not-allowed;background:linear-gradient(135deg,#444 0%,#333 100%);' +
    'box-shadow:none}' +
    '.rj-ps-cta-arrow{display:flex;align-items:center;justify-content:center;line-height:0}' +
    '';
    var s = document.createElement('style');
    s.id = 'rj-ps-redesign-css';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function wrapPsUpdateTotal() {
    if (typeof window._psUpdateTotal !== 'function') return false;
    if (window._psUpdateTotal._rjUserFixPS) return true;
    var orig = window._psUpdateTotal;
    rjInscrire("_psUpdateTotal", { id: "07f-pre-saison:_psUpdateTotal", ordre: -2500, remplace: function (args, suite) {
      var r;
      try { r = suite(); } catch (e) {}
      try {
        var b = window._presBudget || {};
        var total = (b.sim || 0) + (b.coach || 0) + (b.lifestyle || 0) + (b.savings || 0);
        var el = document.getElementById('ps-total');
        if (el) {
          el.innerHTML = total + '<span>%</span>';
          if (total === 100) el.classList.remove('rj-ps-invalid');
          else el.classList.add('rj-ps-invalid');
        }
        var btn = document.getElementById('ps-validate-btn');
        if (btn) {
          btn.disabled = total !== 100;
        }
      } catch (e) {}
      return r;
    } });
    window._psUpdateTotal._rjUserFixPS = true;
    return true;
  }

  function wrapPsPickObj() {
    if (window._psPickObj && window._psPickObj._rjUserFixPS) return true;
    window._psPickObj = function rjPsPickObjNew(k) {
      try {
        window._presObjective = k;
        if (typeof window.PRESEASON_OBJECTIVES !== 'object') return;
        Object.keys(window.PRESEASON_OBJECTIVES).forEach(function(key) {
          var el = document.getElementById('ps-obj-' + key);
          if (!el) return;
          if (key === k) el.classList.add('on');
          else el.classList.remove('on');
        });
      } catch (e) { console.warn('[07] _psPickObj err:', e); }
    };
    window._psPickObj._rjUserFixPS = true;
    return true;
  }

  function wrapPsPickAngle() {
    if (window._psPickAngle && window._psPickAngle._rjUserFixPS) return true;
    window._psPickAngle = function rjPsPickAngleNew(k) {
      try {
        window._presAngle = k;
        if (typeof window.PRESEASON_ANGLES !== 'object') return;
        Object.keys(window.PRESEASON_ANGLES).forEach(function(key) {
          var el = document.getElementById('ps-ang-' + key);
          if (!el) return;
          if (key === k) el.classList.add('on');
          else el.classList.remove('on');
        });
      } catch (e) { console.warn('[07] _psPickAngle err:', e); }
    };
    window._psPickAngle._rjUserFixPS = true;
    return true;
  }

  function wrapPsAdjustBudget() {
    if (window._psAdjustBudget && window._psAdjustBudget._rjUserFixPS) return true;
    window._psAdjustBudget = function rjPsAdjustBudgetNew(k, t) {
      try {
        t = parseInt(t) || 0;
        if (!window._presBudget) {
          window._presBudget = { sim: 25, coach: 25, lifestyle: 25, savings: 25 };
        }
        window._presBudget[k] = t;
        var el = document.getElementById('ps-val-' + k);
        if (el) el.innerHTML = t + '<span>%</span>';
        if (typeof window._psUpdateTotal === 'function') window._psUpdateTotal();
      } catch (e) { console.warn('[07] _psAdjustBudget err:', e); }
    };
    window._psAdjustBudget._rjUserFixPS = true;
    return true;
  }

  function wrapRenderPreseasonPlanning() {
    if (typeof window.renderPreseasonPlanning !== 'function') return false;
    if (window.renderPreseasonPlanning._rjUserFixRedesign) return true;
    var orig = window.renderPreseasonPlanning;
    rjInscrire("renderPreseasonPlanning", { id: "07f-pre-saison:renderPreseasonPlanning", ordre: -2500, remplace: function (args, suite) {
      try {
        _injectPreseasonCSS();
        _renderPreseasonNew();
      } catch (e) {
        console.warn('[07] renderPreseasonPlanning new render err, fallback:', e);
        try { return suite(); } catch (e2) {}
      }
    } });
    window.renderPreseasonPlanning._rjUserFixRedesign = true;
    console.log('[07] renderPreseasonPlanning redesigned (F1 DA)');
    return true;
  }

  function appliquer() {
    try { _injectPreseasonCSS(); } catch (e) { console.warn('[07] _injectPreseasonCSS();', e); }
    try { wrapRenderPreseasonPlanning(); } catch (e) { console.warn('[07] wrapRenderPreseasonPlanning();', e); }
    try { wrapPsPickObj(); } catch (e) { console.warn('[07] wrapPsPickObj();', e); }
    try { wrapPsPickAngle(); } catch (e) { console.warn('[07] wrapPsPickAngle();', e); }
    try { wrapPsAdjustBudget(); } catch (e) { console.warn('[07] wrapPsAdjustBudget();', e); }
    try { wrapPsUpdateTotal(); } catch (e) { console.warn('[07] wrapPsUpdateTotal();', e); }
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
