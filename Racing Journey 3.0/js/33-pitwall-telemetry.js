/* =============================================================================
 * 33-pitwall-telemetry.js — DIRECTION DE COURSE (classement enrichi)
 * =============================================================================
 *
 * OBJECTIF
 * --------
 * Rendre la simulation VISIBLE pendant la course. Le moteur calcule énormément
 * (usure/température pneus, état pilote, momentum, undercut, safety car…) mais
 * presque rien ne remonte. Ce module remplace le rendu du classement par une
 * vue télémétrique : bandeau joueur (Pos/Gap/Pneu/État), cartes Devant/Derrière,
 * meilleur tour, classement à drapeaux + logos d'écurie (10 lignes, scindé si le
 * joueur est hors du top 10), et un fil « Moments clés » qui explique le pourquoi.
 *
 * OPTION A — enrichissement sûr, sans toucher au moteur
 * -----------------------------------------------------
 *   - Wrappe renderLiveLeaderboard (comme 04h). L'original tourne toujours
 *     (en-tête, barres, side-effects) PUIS on remplace #live-leaderboard par la
 *     vue enrichie. Toute erreur → repli : le classement original reste affiché.
 *   - Lit uniquement des données déjà calculées : d.pos, d.gap, d._tyreCompound,
 *     d._tyreLife, d.nat, d.team, d._rjDriverState ; LIVE_RACE.cur/total/bestLap ;
 *     RACE_STATE.eventsLog.
 *   - Réutilise les helpers du jeu : flagSvg(), TEAM_LOGOS, TYRE_COMPOUND_INFO.
 *   - Réversible : retirer ce script d'index.html restaure le rendu d'origine.
 *
 * ORDRE : après 04h (qui wrappe aussi renderLiveLeaderboard) et 03 (helpers).
 * ===========================================================================*/

(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  // ---- Accès défensif aux helpers du jeu ----
  function cmpInfo(c){
    if (typeof TYRE_COMPOUND_INFO !== 'undefined' && TYRE_COMPOUND_INFO && TYRE_COMPOUND_INFO[c]) return TYRE_COMPOUND_INFO[c];
    var f={ soft:{color:'#EF4444',short:'S',text:'#fff'}, medium:{color:'#FBBF24',short:'M',text:'#000'},
            hard:{color:'#E5E7EB',short:'H',text:'#000'}, inter:{color:'#22C55E',short:'I',text:'#000'},
            wet:{color:'#3B82F6',short:'W',text:'#fff'} };
    return f[c] || { color:'#FBBF24', short:'M', text:'#000' };
  }
  function teamLogoHtml(team){
    if (typeof TEAM_LOGOS !== 'undefined' && TEAM_LOGOS && team && TEAM_LOGOS[team])
      return '<span class="rjdc-tlogo">'+TEAM_LOGOS[team]+'</span>';
    return '';
  }
  function flagHtml(nat){
    try { if (typeof flagSvg === 'function' && nat) return '<span class="rjdc-flag">'+flagSvg(nat,16)+'</span>'; } catch(e){}
    return '';
  }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // ---- État du module ----
  var expanded = null;          // nom du pilote déplié
  var prevPos = {};             // pos au tour précédent (tendance)
  var lastLapSeen = -1;

  function lifeColor(l){ return l>50?'var(--green)':l>25?'var(--amber)':'var(--red)'; }
  function stLabel(s){ return {push:'PUSH',manage:'GÈRE',struggle:'LUTTE',stable:'STABLE'}[s]||'STABLE'; }
function stIcon(s){
  var I={
    push:'<path d="M13 2 3 14h9l-1 8 10-12h-9z" fill="currentColor" stroke="none"/>',
    manage:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    struggle:'<path d="M8 20V5M5 8l3-3 3 3M16 4v15M13 16l3 3 3-3"/>',
    stable:'<path d="M5 12h14"/>'
  };
  return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'+(I[s]||I.stable)+'</svg>';
}

  function driverState(d){
    var ds = d._rjDriverState || {};
    var push = (typeof d._rjCurrentPushLevel === 'number') ? d._rjCurrentPushLevel
             : (typeof ds.pushLevel === 'number' ? ds.pushLevel : null);
    var life = (typeof d._tyreLife === 'number') ? d._tyreLife : 100;
    if (life < 22) return 'struggle';
    if (typeof push === 'number'){ if (push > 0.7) return 'push'; if (push < 0.35) return 'manage'; }
    var mom = (typeof ds.momentum === 'number') ? ds.momentum : null;
    if (mom != null){ var m = mom>1?mom:mom*100; if (m>=65) return 'push'; if (m<=38) return 'struggle'; }
    return 'stable';
  }
  function norm100(v){ if (typeof v !== 'number') return null; return Math.max(0,Math.min(100, v>1?Math.round(v):Math.round(v*100))); }

  function fmtGap(d, leaderGap){
    if (d.pos === 1) return 'Leader';
    var g = (typeof d.gap === 'number') ? d.gap : null;
    if (g == null) return '—';
    return '+'+g.toFixed(1);
  }
  function fmtLap(t){
    if (typeof t !== 'number' || t<=0) return '—';
    if (t>=60){ var m=Math.floor(t/60), r=t-60*m; return m+':'+(r<10?'0':'')+r.toFixed(3); }
    return t.toFixed(3);
  }

  function compoundDot(comp, big){
    var ci = cmpInfo(comp||'medium');
    return '<span class="rjdc-tdot'+(big?' big':'')+'" style="background:'+ci.color+';color:'+(ci.text||'#000')+'">'+(ci.short||'M')+'</span>';
  }

  // ---- Tendance (une fois par tour) ----
  function updateTrends(drivers, lap){
    if (lap === lastLapSeen) return;
    drivers.forEach(function(d){
      var pp = prevPos[d.name];
      d._rjdcTrend = (pp==null || d.pos==null || d.dnf) ? 'flat' : (d.pos<pp?'up':d.pos>pp?'down':'flat');
    });
    // moments : changements de position notables (top 6 ou joueur)
    drivers.forEach(function(d){
      var pp = prevPos[d.name];
      if (pp==null || d.pos==null || d.dnf) return;
      var gained = pp - d.pos;
      var involvesTop = d.pos<=6 || pp<=6 || d.isPlayer;
      if (gained >= 1 && involvesTop){
        var pitted = (typeof d._lastPitLap==='number') && (lap - d._lastPitLap) <= 2;
        var tag = pitted ? 'UNDERCUT' : 'DÉPASS.';
        var type = pitted ? 'undercut' : 'drs';
        pushMoment(type, tag, '<b>'+esc(d.name)+'</b> gagne '+gained+(gained>1?' places':' place'), lap);
      } else if (gained <= -1 && involvesTop){
        var lifeLow = (typeof d._tyreLife==='number') && d._tyreLife < 25;
        if (lifeLow) pushMoment('cliff','FALAISE','<b>'+esc(d.name)+'</b> recule — pneus finis', lap);
      }
    });
    drivers.forEach(function(d){ prevPos[d.name] = d.pos; });
    lastLapSeen = lap;
    harvestEventsLog(lap);
  }

  // ---- Moments : stockés sur LIVE_RACE (réinitialisés à chaque course) ----
  function moments(){ if (!LIVE_RACE._rjdcMoments) LIVE_RACE._rjdcMoments=[]; return LIVE_RACE._rjdcMoments; }
  function pushMoment(type, tag, text, lap){
    var m = moments();
    // anti-doublon immédiat
    if (m.length && m[0].text===text && m[0].lap===lap) return;
    m.unshift({ type:type, tag:tag, text:text, lap:lap });
    if (m.length>10) m.length=10;
  }
  function harvestEventsLog(lap){
    if (typeof RACE_STATE==='undefined' || !RACE_STATE || !RACE_STATE.eventsLog) return;
    var n = RACE_STATE._rjdcSeen || 0;
    var log = RACE_STATE.eventsLog;
    for (var i=n;i<log.length;i++){
      var e=log[i]; if (!e) continue;
      var txt=(e.text||'')+' '+(e.note||'');
      var type='manage', tag='INFO';
      if (/stand|arrêt|pit/i.test(txt)){ type='undercut'; tag='STANDS'; }
      else if (/abandon|dnf|mécan/i.test(txt)){ type='error'; tag='ABANDON'; }
      else if (/safety|sc\b|neutralis/i.test(txt)){ type='sc'; tag='SC'; }
      else if (/pénalit|manqué/i.test(txt)){ type='error'; tag='PÉNALITÉ'; }
      else if (/pneu|tendre|falaise|usure/i.test(txt)){ type='cliff'; tag='PNEUS'; }
      pushMoment(type, tag, esc(e.text||'Événement'), (e.lap!=null?e.lap:lap));
    }
    RACE_STATE._rjdcSeen = log.length;
  }

  // ---- CSS (injecté une fois, scopé .rjdc) ----
  function injectCSS(){
    if (document.getElementById('rjdc-css')) return;
    var css = [
      '.rjdc{--green:#00E676;--amber:#FFB300;--red:#FF1801;--gold:#FFC107;--teal:#00D4FF;--purple:#B47BFF;font-variant-numeric:tabular-nums}',
      '.rjdc .pstrip{display:grid;grid-template-columns:1fr 1px 1fr 1px 1fr 1px 1.1fr;align-items:center;padding:9px 10px 8px;border-bottom:1px solid var(--border,rgba(255,255,255,.06))}',
      '.rjdc .vdiv{height:32px;width:1px;background:rgba(255,255,255,.06)}',
      '.rjdc .pcell{text-align:center;padding:0 3px}',
      '.rjdc .pcell .lbl{font-size:8px;color:#404048;text-transform:uppercase;letter-spacing:.07em;margin-bottom:2px}',
      '.rjdc .pcell .big{font-size:26px;font-weight:900;line-height:1;letter-spacing:-.02em}',
      '.rjdc .pcell .mid{font-size:12px;font-weight:700;color:#e8e8ec;line-height:1.1}',
      '.rjdc .pcell .sub{font-size:7px;color:#6b6b78;margin-top:2px}',
      '.rjdc .tyrecell{display:flex;align-items:center;justify-content:center;gap:4px}',
      '.rjdc .rjdc-tdot{width:16px;height:16px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:8px;font-weight:900;line-height:1;border:1px solid rgba(255,255,255,.25);flex-shrink:0}',
      '.rjdc .rjdc-tdot.big{width:18px;height:18px;font-size:9px}',
      '.rjdc .stag{display:inline-flex;align-items:center;justify-content:center;padding:4px;border-radius:6px;line-height:0}',
      '.rjdc .stag.push{color:var(--green);background:rgba(0,230,118,.12)}',
      '.rjdc .stag.manage{color:var(--teal);background:rgba(0,212,255,.10)}',
      '.rjdc .stag.struggle{color:var(--amber);background:rgba(255,179,0,.13)}',
      '.rjdc .stag.stable{color:#6b6b78;background:rgba(255,255,255,.05)}',
      '.rjdc .rjdc-modes{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.06)}',
      '.rjdc .rjdc-mode{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:7px 4px;border-radius:8px;background:#0e0e12;border:1px solid rgba(255,255,255,.07);color:#6b6b78;font-family:inherit;font-size:10.5px;font-weight:800;letter-spacing:.02em;cursor:pointer;min-width:0;overflow:hidden;transition:border-color .12s,color .12s}',
      '.rjdc .rjdc-mode .mi{font-size:14px;line-height:1}',
      '.rjdc .rjdc-mode .ml{white-space:nowrap}',
      '.rjdc .rjdc-mode:hover{border-color:rgba(255,255,255,.18)}',
      '.rjdc .rjdc-mode.active{font-weight:800}',
      '.rjdc .rjdc-cls{font-size:8.5px;font-weight:900;letter-spacing:.04em;text-transform:uppercase;padding:1px 5px;border-radius:5px;border:1px solid;margin-left:5px;flex-shrink:0;line-height:1.5}',
      '.rjdc .rjdc-relaybar{display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid rgba(255,255,255,.06)}',
      '.rjdc .rb-wheel{display:flex;flex-direction:column;gap:1px;flex-shrink:0}',
      '.rjdc .rb-lbl{font-size:8.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#6b6b78}',
      '.rjdc .rb-who{font-size:12.5px;font-weight:800;color:#22D3EE}',
      '.rjdc .rjdc-relay-sel{display:flex;gap:5px;margin-left:auto}',
      '.rjdc .rjdc-relay{padding:5px 9px;border-radius:7px;background:#0e0e12;border:1px solid rgba(255,255,255,.07);color:#6b6b78;font-family:inherit;font-size:10px;font-weight:800;cursor:pointer;white-space:nowrap;transition:border-color .12s,color .12s}',
      '.rjdc .rjdc-relay:hover{border-color:rgba(255,255,255,.18)}',
      '.rjdc .rjdc-p2pwrap{padding:7px 10px;border-bottom:1px solid rgba(255,255,255,.06)}',
      '.rjdc .rjdc-p2p{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 12px;border-radius:9px;background:#FF18011a;border:1px solid #FF180166;color:#FF1801;font-family:inherit;font-size:12px;font-weight:900;letter-spacing:.06em;cursor:pointer;transition:background .12s,border-color .12s,color .12s}',
      '.rjdc .rjdc-p2p:hover:not(:disabled){background:#FF18012e;border-color:#FF1801}',
      '.rjdc .rjdc-p2p.active{background:#00E6761f;border-color:#00E676;color:#00E676;animation:rjp2p 1s ease-in-out infinite}',
      '.rjdc .rjdc-p2p.empty,.rjdc .rjdc-p2p:disabled{opacity:.45;cursor:default;color:#6b6b78;border-color:rgba(255,255,255,.1);background:#0e0e12}',
      '.rjdc .p2p-r{font-variant-numeric:tabular-nums}',
      '@keyframes rjp2p{0%,100%{opacity:1}50%{opacity:.55}}',
      '.rjdc .rjdc-draft{display:flex;align-items:center;gap:7px;padding:6px 10px;border-bottom:1px solid rgba(255,255,255,.06);font-size:11px;font-weight:800;letter-spacing:.03em;border-left:2px solid}',
      '.rjdc .dft-i{font-size:13px;line-height:1}',
      '.rjdc .rjdc-fuelwrap{padding:7px 10px;border-bottom:1px solid rgba(255,255,255,.06)}',
      '.rjdc .rjdc-fuel{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-radius:9px;background:#0e0e12;border:1px solid rgba(255,255,255,.08);color:#a8a8b4;font-family:inherit;font-size:11.5px;font-weight:800;letter-spacing:.04em;cursor:pointer;transition:background .12s,border-color .12s,color .12s}',
      '.rjdc .rjdc-fuel:hover{border-color:rgba(255,255,255,.18)}',
      '.rjdc .rjdc-fuel.active{background:#FFB3001f;border-color:#FFB30088;color:#FFB300}',
      '.rjdc .rjdc-fuel.cashed{cursor:default;background:#00E6761a;border-color:#00E67655;color:#00E676}',
      '.rjdc .fl-r{font-variant-numeric:tabular-nums;font-size:10px;color:#6b6b78}',
      '.rjdc .rjdc-fuel.active .fl-r,.rjdc .rjdc-fuel.cashed .fl-r{color:inherit;opacity:.85}',
      '.rjdc .rjdc-otswrap{padding:7px 10px;border-bottom:1px solid rgba(255,255,255,.06)}',
      '.rjdc .rjdc-ots{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 12px;border-radius:9px;background:#B47BFF1a;border:1px solid #B47BFF66;color:#B47BFF;font-family:inherit;font-size:12px;font-weight:900;letter-spacing:.05em;cursor:pointer;transition:background .12s,border-color .12s,color .12s}',
      '.rjdc .rjdc-ots:hover:not(:disabled){background:#B47BFF2e;border-color:#B47BFF}',
      '.rjdc .rjdc-ots.active{background:#00E6761f;border-color:#00E676;color:#00E676;animation:rjp2p 1s ease-in-out infinite}',
      '.rjdc .rjdc-ots.cooldown{opacity:.7;color:#FFB300;border-color:#FFB30055;background:#FFB30012}',
      '.rjdc .rjdc-ots.empty,.rjdc .rjdc-ots:disabled{opacity:.4;cursor:default;color:#6b6b78;border-color:rgba(255,255,255,.1);background:#0e0e12}',
      '.rjdc .ots-r{font-variant-numeric:tabular-nums}',
      '.rjdc .battle{display:flex;gap:5px;padding:7px 10px;border-bottom:1px solid rgba(255,255,255,.06)}',
      '.rjdc .bcard{flex:1;border-radius:8px;padding:6px 9px;min-width:0;border:1px solid}',
      '.rjdc .bcard.up{background:rgba(0,212,255,.06);border-color:rgba(0,212,255,.22)}',
      '.rjdc .bcard.dn{background:rgba(255,24,1,.06);border-color:rgba(255,24,1,.20)}',
      '.rjdc .bcard .h{font-size:8px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;margin-bottom:2px}',
      '.rjdc .bcard.up .h{color:var(--teal)} .rjdc .bcard.dn .h{color:#ff6a52}',
      '.rjdc .bcard .nm{font-size:11px;font-weight:600;color:#e8e8ec;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.rjdc .bcard .gp{font-size:12px;font-weight:800}',
      '.rjdc .bcard.up .gp{color:var(--teal)} .rjdc .bcard.dn .gp{color:#ff6a52}',
      '.rjdc .bcard .why{font-size:9px;color:#6b6b78;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.rjdc .bestbar{display:flex;align-items:center;gap:8px;padding:5px 12px;background:rgba(180,123,255,.06);border-bottom:1px solid rgba(255,255,255,.06);border-top:1px solid rgba(180,123,255,.14)}',
      '.rjdc .bestbar .lab{font-size:8px;font-weight:800;color:var(--purple);letter-spacing:.1em}',
      '.rjdc .bestbar .who{font-size:10px;color:#a8a8b4;flex:1;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.rjdc .bestbar .tm{font-size:11px;font-weight:800;color:var(--purple)}',
      '.rjdc .lbhead{display:flex;justify-content:space-between;padding:5px 12px 4px;border-bottom:1px solid rgba(255,255,255,.04)}',
      '.rjdc .lbhead span{font-size:8px;font-weight:800;color:#404048;text-transform:uppercase;letter-spacing:.1em}',
      '.rjdc .lbrow{display:block;width:100%;text-align:left;background:transparent;border:none;border-top:1px solid rgba(255,255,255,.04);padding:0;cursor:pointer;font-family:inherit;position:relative}',
      '.rjdc .lbrow:hover .r1{background:rgba(255,255,255,.02)}',
      '.rjdc .lbrow.player .r1{background:rgba(0,230,118,.05)}',
      '.rjdc .lbrow.player::before{content:"";position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--green);z-index:2}',
      '.rjdc .r1{display:flex;align-items:center;gap:6px;padding:6px 12px 5px;min-height:33px}',
      '.rjdc .pos{font-size:12px;font-weight:800;width:22px;flex:0 0 22px}',
      '.rjdc .pos.p1{color:var(--gold)} .rjdc .pos.p2{color:#D4D7DC} .rjdc .pos.p3{color:#CD8E5B} .rjdc .pos.pl{color:var(--green)} .rjdc .pos.def{color:#6b6b78}',
      '.rjdc .rjdc-flag,.rjdc .rjdc-flag>span{width:16px;height:16px;border-radius:50%;overflow:hidden;flex-shrink:0;box-shadow:0 0 0 1px rgba(255,255,255,.12);display:inline-flex}',
      '.rjdc .rjdc-flag svg{width:100%;height:100%;display:block}',
      '.rjdc .rjdc-tlogo{width:17px;height:17px;border-radius:4px;overflow:hidden;flex-shrink:0;box-shadow:0 0 0 1px rgba(255,255,255,.10);display:inline-flex}',
      '.rjdc .rjdc-tlogo svg{width:100%;height:100%;display:block}',
      '.rjdc .nm{flex:1;min-width:0;font-size:12px;font-weight:500;color:#e8e8ec;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.rjdc .trend{font-size:11px;font-weight:800;width:13px;text-align:center;flex:0 0 13px}',
      '.rjdc .trend.up{color:var(--green)} .rjdc .trend.down{color:var(--red)} .rjdc .trend.flat{color:#404048}',
      '.rjdc .rtyre{display:inline-flex;align-items:center;gap:3px;flex:0 0 auto}',
      '.rjdc .rtyre .life{font-size:11px;font-weight:800;width:30px;text-align:right}',
      '.rjdc .rgap{font-size:11.5px;font-weight:700;color:#e8e8ec;width:50px;flex:0 0 50px;text-align:right}',
      '.rjdc .rgap.lead{color:var(--green);font-weight:800}',
      '.rjdc .lbsplit{display:flex;align-items:center;gap:9px;padding:7px 14px;border-top:1px solid rgba(255,255,255,.04);background:rgba(255,255,255,.012)}',
      '.rjdc .lbsplit .ln{flex:1;height:1px;background:repeating-linear-gradient(90deg,rgba(255,255,255,.14) 0 4px,transparent 4px 8px)}',
      '.rjdc .lbsplit .tx{font-size:8.5px;font-weight:800;color:#404048;letter-spacing:.12em;text-transform:uppercase}',
      '.rjdc .det{background:#08080a;border-top:1px solid rgba(255,255,255,.04)}',
      '.rjdc .det-in{padding:10px 12px 12px}',
      '.rjdc .det-g{display:flex;gap:6px}',
      '.rjdc .gg{flex:1;min-width:80px;background:#0e0e12;border:1px solid rgba(255,255,255,.04);border-radius:8px;padding:6px 8px}',
      '.rjdc .gg .gl{font-size:8px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#404048}',
      '.rjdc .gg .gb{height:4px;border-radius:2px;background:rgba(255,255,255,.07);margin-top:5px;overflow:hidden}',
      '.rjdc .gg .gb i{display:block;height:100%;border-radius:2px}',
      '.rjdc .det-why{margin-top:9px;font-size:10.5px;color:#6b6b78}',
      '.rjdc .mhead{display:flex;align-items:center;gap:7px;padding:9px 12px 7px;border-top:1px solid rgba(255,255,255,.06)}',
      '.rjdc .mhead .led{width:6px;height:6px;border-radius:50%;background:var(--teal);box-shadow:0 0 6px var(--teal)}',
      '.rjdc .mhead h2{font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#e8e8ec}',
      '.rjdc .mrow{display:flex;align-items:flex-start;gap:9px;padding:7px 12px;border-top:1px solid rgba(255,255,255,.04)}',
      '.rjdc .mtag{font-size:8px;font-weight:900;letter-spacing:.06em;padding:3px 6px;border-radius:5px;flex:0 0 auto;margin-top:1px;min-width:60px;text-align:center}',
      '.rjdc .t-undercut{color:var(--teal);background:rgba(0,212,255,.10)} .rjdc .t-cliff{color:var(--red);background:rgba(255,24,1,.12)}',
      '.rjdc .t-error{color:#ff7a63;background:rgba(255,24,1,.10)} .rjdc .t-drs{color:var(--green);background:rgba(0,230,118,.12)}',
      '.rjdc .t-manage{color:var(--teal);background:rgba(0,212,255,.08)} .rjdc .t-sc{color:var(--amber);background:rgba(255,179,0,.13)} .rjdc .t-push{color:var(--green);background:rgba(0,230,118,.12)}',
      '.rjdc .mbody .mt{font-size:11.5px;color:#a8a8b4;font-weight:500;line-height:1.4}',
      '.rjdc .mbody .mt b{color:#e8e8ec;font-weight:800}',
      '.rjdc .mlap{margin-left:auto;font-size:10px;font-weight:800;color:#404048;flex:0 0 auto;padding-top:2px}',
      '.rjdc .mempty{color:#404048;font-size:11px;font-style:italic;padding:10px 12px}'
    ].join('');
    var st=document.createElement('style'); st.id='rjdc-css'; st.textContent=css; document.head.appendChild(st);
  }

  // ---- Rendu d'une ligne ----
  // ---- WEC : multi-classes + relais ----
  function wecMulti(){ try { return !!(typeof LIVE_RACE!=='undefined' && LIVE_RACE && LIVE_RACE._mcInjected); } catch(e){ return false; } }
  function wecEndurance(){ try { return !!(window._rjWec && window._rjWec.isWecEndurance && window._rjWec.isWecEndurance()); } catch(e){ return false; } }
  var CLS_COLOR = { Hypercar:'#FF1801', LMP2:'#4488ff', GT3:'#00E676' };
  function classBadge(cls){
    if (!cls) return '';
    var c = CLS_COLOR[cls] || '#6b6b78';
    return '<span class="rjdc-cls" style="color:'+c+';border-color:'+c+'66;background:'+c+'1a">'+esc(cls)+'</span>';
  }
  function driverAtWheel(){
    try { return (LIVE_RACE && LIVE_RACE._relayMateName) ? LIVE_RACE._relayMateName : 'Toi'; } catch(e){ return 'Toi'; }
  }
  var RELAY_OPTS = [ {label:'Toi +', share:0.70}, {label:'Équilibré', share:0.55}, {label:'Coéq. +', share:0.40} ];
  function relayBar(){
    var who = driverAtWheel();
    var cur = (typeof G!=='undefined' && G && G._wecRelayShare) || 0.55;
    var sel = RELAY_OPTS.map(function(o){
      var active = Math.abs(cur-o.share) < 0.06;
      var style = active ? 'color:#22D3EE;border-color:#22D3EE;background:#22D3EE1f' : '';
      return '<button class="rjdc-relay'+(active?' active':'')+'" data-share="'+o.share+'" style="'+style+'">'+o.label+'</button>';
    }).join('');
    return '<div class="rjdc-relaybar">'
      + '<div class="rb-wheel"><span class="rb-lbl">Au volant</span><span class="rb-who">'+esc(who)+'</span></div>'
      + '<div class="rjdc-relay-sel">'+sel+'</div></div>';
  }

  // ---- IndyCar : push-to-pass ----
  function indyActive(){ try { return !!(window._rjIndy && window._rjIndy.isIndy && window._rjIndy.isIndy()); } catch(e){ return false; } }
  function p2pRow(player){
    if (!indyActive() || (player && player.dnf)) return '';
    var s = null; try { s = window._rjIndy.getP2P(); } catch(e){}
    var cost = (window._rjIndy && window._rjIndy.P2P_COST) || 18;
    var reserve = s ? Math.max(0, Math.round(s.reserve)) : 180;
    var active = !!(s && s.active);
    var empty = reserve < cost;
    var cls = active ? ' active' : (empty ? ' empty' : '');
    var label = active ? 'PUSH-TO-PASS ACTIF' : 'PUSH TO PASS';
    return '<div class="rjdc-p2pwrap"><button class="rjdc-p2p'+cls+'"'+((empty && !active) ? ' disabled' : '')+'>'
      + '<span class="p2p-l">'+label+'</span><span class="p2p-r">'+reserve+'s</span></button></div>';
  }
  function draftRow(){
    if (!indyActive()) return '';
    var d = null; try { d = window._rjIndy.getDraft(); } catch(e){}
    if (!d || !d.active) return '';
    var draft = d.mode === 'draft';
    var color = draft ? '#00E676' : '#FFB300';
    var icon = draft ? '🌀' : '⚠';
    var txt = draft ? 'ASPIRATION — dans le sillage' : 'EN TÊTE — exposé à l\'aspiration';
    return '<div class="rjdc-draft" style="color:'+color+';border-color:'+color+'55;background:'+color+'14">'
      + '<span class="dft-i">'+icon+'</span><span>'+txt+'</span></div>';
  }
  function fuelRow(player){
    if (!indyActive() || (player && player.dnf)) return '';
    var f = null; try { f = window._rjIndy.getFuel(); } catch(e){}
    var saving = !!(f && f.saving), cashed = !!(f && f.cashed);
    var margin = f ? Math.round(f.margin) : 0;
    if (cashed){
      return '<div class="rjdc-fuelwrap"><div class="rjdc-fuel cashed"><span class="fl-l">\u26FD Marge carburant</span>'
        + '<span class="fl-r">'+((f && f.boostOffset > 0) ? 'PUSH FINAL' : '\u2014')+'</span></div></div>';
    }
    var cls = saving ? ' active' : '';
    var label = saving ? '\u26FD \u00C9CO ACTIVE' : '\u26FD \u00C9CO CARBURANT';
    return '<div class="rjdc-fuelwrap"><button class="rjdc-fuel'+cls+'"><span class="fl-l">'+label+'</span>'
      + '<span class="fl-r">marge '+margin+'</span></button></div>';
  }
  // ---- Super Formula : Overtake System ----
  function sfActive(){ try { return !!(window._rjSF && window._rjSF.isSF && window._rjSF.isSF()); } catch(e){ return false; } }
  function otsRow(player){
    if (!sfActive() || (player && player.dnf)) return '';
    var s = null, cur = 0;
    try { s = window._rjSF.getOTS(); cur = (window.LIVE_RACE && window.LIVE_RACE.cur) || 0; } catch(e){}
    var uses = s ? s.uses : 5;
    var active = !!(s && s.active);
    var cooldown = !!(s && !active && cur < s.readyLap);
    var empty = uses <= 0;
    var cls = active ? ' active' : (empty ? ' empty' : (cooldown ? ' cooldown' : ''));
    var label = active ? 'OTS ACTIF' : (empty ? 'OTS \u00C9PUIS\u00C9' : (cooldown ? 'OTS \u2014 R\u00C9CUP' : 'OVERTAKE SYSTEM'));
    var disabled = (empty || cooldown) && !active;
    return '<div class="rjdc-otswrap"><button class="rjdc-ots'+cls+'"'+(disabled ? ' disabled' : '')+'>'
      + '<span class="ots-l">'+label+'</span><span class="ots-r">\u00D7'+uses+'</span></button></div>';
  }

  function rowHTML(d, pos, leaderGap){
    var posCls = d.player||d.isPlayer ? 'pl' : (pos===1?'p1':pos===2?'p2':pos===3?'p3':'def');
    var tr = d._rjdcTrend==='up'?'<span class="trend up">▲</span>':d._rjdcTrend==='down'?'<span class="trend down">▼</span>':'<span class="trend flat">·</span>';
    var life = (typeof d._tyreLife==='number')?Math.round(d._tyreLife):100;
    var ds = d._rjDriverState||{};
    var mom = norm100(ds.momentum), conf = norm100(ds.confidence);
    var isOpen = (expanded===d.name);
    var h = ''
    +'<button class="lbrow'+((d.isPlayer)?' player':'')+'" data-name="'+esc(d.name)+'" aria-expanded="'+(isOpen?'true':'false')+'">'
    +  '<div class="r1">'
    +    '<span class="pos '+posCls+'">P'+pos+'</span>'
    +    flagHtml(d.nat) + teamLogoHtml(d.team)
    +    '<span class="nm">'+esc(d.name)+'</span>'
    +    (wecMulti() && d.cls ? classBadge(d.cls) : '')
    +    tr
    +    '<span class="rtyre">'+compoundDot(d._tyreCompound)+'<span class="life" style="color:'+lifeColor(life)+'">'+(d.dnf?'—':life+'%')+'</span></span>'
    +    '<span class="rgap'+(pos===1?' lead':'')+'">'+(d.dnf?'ABD':fmtGap(d,leaderGap))+'</span>'
    +  '</div>'
    +'</button>';
    if (isOpen){
      h += '<div class="det"><div class="det-in"><div class="det-g">'
        + '<div class="gg"><div class="gl">Momentum</div><div class="gb"><i style="width:'+(mom!=null?mom:0)+'%;background:var(--green)"></i></div></div>'
        + '<div class="gg"><div class="gl">Confiance</div><div class="gb"><i style="width:'+(conf!=null?conf:0)+'%;background:var(--teal)"></i></div></div>'
        + '<div class="gg"><div class="gl">État</div><div style="margin-top:4px"><span class="stag '+driverState(d)+'" title="'+stLabel(driverState(d))+'">'+stIcon(driverState(d))+'</span></div></div>'
        + '</div><div class="det-why">'+esc(whyLine(d))+'</div></div></div>';
    }
    return h;
  }
  function whyLine(d){
    var life = (typeof d._tyreLife==='number')?d._tyreLife:100;
    if (d.dnf) return 'Abandon.';
    if (life<22) return 'Pneus en fin de vie — chute de performance.';
    var s=driverState(d);
    if (s==='push') return 'En attaque, rythme soutenu.';
    if (s==='manage') return 'Gère ses pneus, lève le pied.';
    return 'Rythme stable, dans sa fenêtre.';
  }
  function splitHTML(a,b){ return '<div class="lbsplit"><span class="ln"></span><span class="tx">P'+a+' – P'+b+'</span><span class="ln"></span></div>'; }

  // ---- Sélecteur de mode de pilotage (réutilise _setTyreMode du moteur) ----
  var MODES = [
    { id:'manage', label:'Gestion', icon:'🔋', color:'#00E676' },
    { id:'normal', label:'Normal',  icon:'⚡', color:'#9CA3AF' },
    { id:'push',   label:'Attaque', icon:'🔴', color:'#FF1801' }
  ];
  function modesRelevant(){
    // Mêmes conditions que le moteur : hors karting + catégorie qui dégrade les pneus.
    try {
      if (typeof G !== 'undefined' && G && (G.cat==='Karting Junior'||G.cat==='Karting Senior')) return false;
      if (typeof _pitConfigForCat === 'function'){ var c=_pitConfigForCat(); return !!(c && c.degradeTyres); }
      return true;
    } catch(e){ return true; }
  }
  function modesRow(player){
    if (!modesRelevant() || (player && player.dnf)) return '';
    var cur = (LIVE_RACE && LIVE_RACE._tyreMode) || 'normal';
    return '<div class="rjdc-modes">' + MODES.map(function(m){
      var active = (cur===m.id);
      var style = active ? ('color:'+m.color+';border-color:'+m.color+';background:'+m.color+'1f') : '';
      return '<button class="rjdc-mode'+(active?' active':'')+'" data-mode="'+m.id+'" style="'+style+'">'
        + '<span class="mi">'+m.icon+'</span><span class="ml">'+m.label+'</span></button>';
    }).join('') + '</div>';
  }

  // ---- Rendu complet ----
  function renderEnriched(){
    var el = document.getElementById('live-leaderboard');
    if (!el || typeof LIVE_RACE==='undefined' || !LIVE_RACE || !LIVE_RACE.drivers || !LIVE_RACE.drivers.length) return false;
    var drivers = LIVE_RACE.drivers.slice().sort(function(a,b){ return (a.pos||99)-(b.pos||99); });
    var p = drivers.find(function(d){return d.isPlayer;});
    if (!p) return false;
    injectCSS();
    updateTrends(LIVE_RACE.drivers, LIVE_RACE.cur);

    var pi = drivers.indexOf(p), pos = pi+1, t = cmpInfo(p._tyreCompound||'medium');
    var pLife = (typeof p._tyreLife==='number')?Math.round(p._tyreLife):100;
    var pState = driverState(p);
    var leaderGap = 0;

    // bandeau joueur
    var html = '<div class="rjdc">';
    html += '<div class="pstrip">'
      + '<div class="pcell"><div class="lbl">Pos'+(wecMulti() && p.cls ? ' · '+esc(p.cls) : '')+'</div><div class="big" style="color:'+(pos===1?'var(--gold)':'var(--green)')+'">P'+pos+'</div></div>'
      + '<div class="vdiv"></div>'
      + '<div class="pcell"><div class="lbl">Gap</div><div class="mid">'+(pos===1?'Leader':fmtGap(p)+'s')+'</div><div class="sub">'+(pos===1?'en tête':'au leader')+'</div></div>'
      + '<div class="vdiv"></div>'
      + '<div class="pcell"><div class="lbl">Pneu</div><div class="tyrecell">'+compoundDot(p._tyreCompound,true)+'<span class="mid" style="color:'+lifeColor(pLife)+'">'+pLife+'%</span></div><div class="sub">'+(t.label||t.short||'')+'</div></div>'
      + '<div class="vdiv"></div>'
      + '<div class="pcell"><div class="lbl">État</div><div style="margin-top:2px"><span class="stag '+pState+'" title="'+stLabel(pState)+'">'+stIcon(pState)+'</span></div></div>'
      + '</div>';

    // bandeau relais WEC (au volant + répartition)
    if (wecEndurance()) html += relayBar();

    // sélecteur de mode de pilotage (Gestion / Normal / Attaque)
    html += modesRow(p);

    // bouton push-to-pass (IndyCar)
    html += p2pRow(p);
    // indicateur d'aspiration (IndyCar ovale)
    html += draftRow();
    // toggle économie carburant (IndyCar)
    html += fuelRow(p);
    // Overtake System (Super Formula)
    html += otsRow(p);

    // cartes Devant / Derrière
    var ahead = drivers[pi-1], behind = drivers[pi+1], bh='';
    if (ahead && !ahead.dnf){
      var dA = (typeof ahead.gap==='number'&&typeof p.gap==='number') ? (p.gap-ahead.gap) : null;
      bh += '<div class="bcard up"><div class="h">▲ Devant</div><div class="nm">'+esc(ahead.name)+'</div>'
         + '<div class="gp">'+(dA!=null?'−'+dA.toFixed(1)+'s':'—')+'</div>'
         + '<div class="why">'+(driverState(ahead)==='struggle'?'pneus en perdition':'à reprendre')+'</div></div>';
    }
    if (behind && !behind.dnf){
      var dB = (typeof behind.gap==='number'&&typeof p.gap==='number') ? (behind.gap-p.gap) : null;
      bh += '<div class="bcard dn"><div class="h">▼ Derrière</div><div class="nm">'+esc(behind.name)+'</div>'
         + '<div class="gp">'+(dB!=null?'+'+dB.toFixed(1)+'s':'—')+'</div>'
         + '<div class="why">'+(driverState(behind)==='push'?'pousse fort, te menace':'à distance')+'</div></div>';
    }
    if (bh) html += '<div class="battle">'+bh+'</div>';

    // meilleur tour
    var bl = LIVE_RACE.bestLap;
    if (bl && (bl.name || bl.time)){
      html += '<div class="bestbar"><span class="lab">⚑ BEST</span><span class="who">'+esc(bl.name||'')+'</span><span class="tm">'+fmtLap(bl.time)+'</span></div>';
    }

    // classement (10 lignes, scindé si joueur hors top 10)
    html += '<div class="lbhead"><span>Pilote</span><span>Pneu · Gap</span></div>';
    if (pi < 10){
      for (var i=0;i<10 && i<drivers.length;i++) html += rowHTML(drivers[i], i+1, leaderGap);
    } else {
      for (var i=0;i<3;i++) html += rowHTML(drivers[i], i+1, leaderGap);
      var start=Math.max(3, pi-3), end=start+7;
      if (end>drivers.length){ end=drivers.length; start=Math.max(3,end-7); }
      html += splitHTML(4, start);
      for (var i=start;i<end;i++) html += rowHTML(drivers[i], i+1, leaderGap);
    }

    // Moments clés
    html += '<div class="mhead"><span class="led"></span><h2>Moments clés</h2></div>';
    var ms = moments();
    if (ms.length){
      html += ms.slice(0,5).map(function(m){
        return '<div class="mrow"><span class="mtag t-'+m.type+'">'+m.tag+'</span>'
          + '<div class="mbody"><div class="mt">'+m.text+'</div></div><span class="mlap">T'+m.lap+'</span></div>';
      }).join('');
    } else {
      html += '<div class="mempty">Les faits marquants apparaîtront ici, avec leur cause.</div>';
    }

    html += '</div>';
    el.innerHTML = html;
    return true;
  }

  // ---- Délégation du tap (déplier une ligne) ----
  function onClick(e){
    if (!e.target.closest) return;
    // push-to-pass (IndyCar)
    var p2pBtn = e.target.closest('.rjdc .rjdc-p2p');
    if (p2pBtn){
      try { if (window._rjIndy && window._rjIndy.activateP2P) window._rjIndy.activateP2P(); }
      catch(err){ console.warn('[33] push-to-pass:', err); }
      try { renderEnriched(); } catch(err){}
      return;
    }
    // économie carburant (IndyCar)
    var fuelBtn = e.target.closest('.rjdc .rjdc-fuel');
    if (fuelBtn && !fuelBtn.classList.contains('cashed')){
      try { if (window._rjIndy && window._rjIndy.toggleFuelSave) window._rjIndy.toggleFuelSave(); }
      catch(err){ console.warn('[33] fuel-save:', err); }
      try { renderEnriched(); } catch(err){}
      return;
    }
    // Overtake System (Super Formula)
    var otsBtn = e.target.closest('.rjdc .rjdc-ots');
    if (otsBtn && !otsBtn.disabled){
      try { if (window._rjSF && window._rjSF.activateOTS) window._rjSF.activateOTS(); }
      catch(err){ console.warn('[33] OTS:', err); }
      try { renderEnriched(); } catch(err){}
      return;
    }
    // sélecteur de répartition des relais (WEC)
    var relayBtn = e.target.closest('.rjdc .rjdc-relay');
    if (relayBtn){
      var share = parseFloat(relayBtn.getAttribute('data-share'));
      try {
        if (window._rjWec){
          if (window._rjWec.setRelayShare) window._rjWec.setRelayShare(share);
          if (window._rjWec.replanRelay) window._rjWec.replanRelay();
        }
      } catch(err){ console.warn('[33] relais:', err); }
      try { renderEnriched(); } catch(err){}
      return;
    }
    // sélecteur de mode de pilotage
    var modeBtn = e.target.closest('.rjdc .rjdc-mode');
    if (modeBtn){
      var mode = modeBtn.getAttribute('data-mode');
      try {
        if (typeof _setTyreMode === 'function') _setTyreMode(mode);
        else if (typeof window._setTyreMode === 'function') window._setTyreMode(mode);
        else { if (LIVE_RACE) LIVE_RACE._tyreMode = mode; renderEnriched(); }
      } catch(err){ console.warn('[33] mode de pilotage:', err); }
      return;   // _setTyreMode rappelle renderLiveLeaderboard → la vue se met à jour
    }
    var row = e.target.closest('.rjdc .lbrow');
    if (!row) return;
    var name = row.getAttribute('data-name');
    expanded = (expanded===name) ? null : name;
    try { renderEnriched(); } catch(err){}
  }

  // ---- Wrap de renderLiveLeaderboard ----
  function install(){
    if (typeof window.renderLiveLeaderboard !== 'function') return false;
    if (window.renderLiveLeaderboard._rjdc) return true;
    var orig = window.renderLiveLeaderboard;
    window.renderLiveLeaderboard = function(){
      var r;
      try { r = orig.apply(this, arguments); } catch(e){ /* l'original gère l'en-tête/barres */ }
      try { renderEnriched(); } catch(e){ console.warn('[33] rendu enrichi — repli sur l\'original:', e); }
      return r;
    };
    window.renderLiveLeaderboard._rjdc = true;
    window._rjdcRender = renderEnriched;
    // un seul écouteur délégué sur le conteneur
    var lb = document.getElementById('live-leaderboard');
    if (lb && !lb._rjdcClick){ lb.addEventListener('click', onClick); lb._rjdcClick = true; }
    return true;
  }

  function boot(retries){
    if (install()){ console.log('[33-pitwall-telemetry] actif — classement enrichi (Direction de course).'); return; }
    if (retries>0) setTimeout(function(){ boot(retries-1); }, 250);
    else console.warn('[33-pitwall-telemetry] renderLiveLeaderboard introuvable.');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ boot(40); });
  else boot(40);

})();
