// === Racing Journey: F1 Dreams ===
// Module: 06-screens
// Render screens, paddock, shop, hof
// Taille: 257,215 chars

function showAchievementUnlock(a){try{var info=_achTierInfo(a.tier);var stack=document.getElementById("ach-unlock-stack");if(!stack){stack=document.createElement("div");stack.id="ach-unlock-stack";stack.style.cssText="position:fixed;top:max(20px,calc(env(safe-area-inset-top,0px) + 14px));left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;width:calc(100% - 24px);max-width:380px";document.body.appendChild(stack)}var card=document.createElement("div");var iconHtml="function"==typeof renderAchievementIcon?renderAchievementIcon(a.icon||"trophy",26,info.color):("function"==typeof renderIcon?renderIcon(a.icon||"trophy",26,info.color):"");var isLeg=a.tier==="legendary";card.style.cssText="pointer-events:auto;width:100%;background:linear-gradient(135deg,"+info.bg+" 0%,rgba(8,8,12,0.96) 70%);border:1px solid "+info.border+";border-radius:14px;padding:12px 14px;box-shadow:0 8px 32px rgba(0,0,0,0.7),0 0 0 1px rgba(255,255,255,0.04),0 0 24px "+info.bg+";display:flex;align-items:center;gap:12px;transform:translateY(-120%);opacity:0;transition:transform .45s cubic-bezier(.2,.7,.2,1.2),opacity .3s;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);position:relative;overflow:hidden";var sparkle=isLeg?'<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 30% 50%,'+info.bg+' 0%,transparent 50%),radial-gradient(ellipse at 70% 50%,'+info.bg+' 0%,transparent 50%);pointer-events:none;animation:ach-sparkle 2.4s ease-in-out infinite"></div>':"";card.innerHTML=sparkle+'<span style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:12px;background:'+info.bg+';border:1.5px solid '+info.border+';flex-shrink:0;box-shadow:0 0 16px '+info.bg+';position:relative;z-index:1">'+iconHtml+'</span><div style="flex:1;min-width:0;position:relative;z-index:1"><div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:'+info.color+';letter-spacing:.18em;text-transform:uppercase;margin-bottom:2px;display:flex;align-items:center;gap:6px"><span>'+renderIcon('trophy',14,'#F59E0B')+'</span><span>Trophée débloqué · '+info.label+'</span></div><div style="font-family:var(--font-display);font-size:14px;font-weight:900;color:#fff;letter-spacing:.01em;line-height:1.15;margin-bottom:2px">'+a.name+'</div><div style="font-size:11px;color:rgba(255,255,255,0.65);line-height:1.3">'+a.desc+'</div></div>';stack.appendChild(card);if(isLeg){var cc=document.createElement("div");cc.style.cssText="position:fixed;top:0;left:0;right:0;height:100vh;pointer-events:none;z-index:9998;overflow:hidden";document.body.appendChild(cc);for(var i=0;i<24;i++){var p=document.createElement("div");var col=["#A855F7","#F59E0B","#EC4899","#22D3EE","#fff"][Math.floor(Math.random()*5)];p.style.cssText="position:absolute;top:-10px;left:"+(10+Math.random()*80)+"%;width:"+(4+Math.random()*4)+"px;height:"+(8+Math.random()*6)+"px;background:"+col+";border-radius:1px;opacity:.9;animation:ach-confetti "+(1.4+Math.random()*1.2)+"s "+(Math.random()*0.4)+"s linear forwards";cc.appendChild(p)}setTimeout(function(){if(cc.parentNode)cc.parentNode.removeChild(cc)},3000)}requestAnimationFrame(function(){requestAnimationFrame(function(){card.style.transform="translateY(0)";card.style.opacity="1"})});card.addEventListener("click",function(){_dismissAchCard(card)});setTimeout(function(){_dismissAchCard(card)},isLeg?5500:4200);if(typeof playRadioOpen==="function"){try{playRadioOpen()}catch(e){}}}catch(e){console.warn("showAchievementUnlock:",e)}}
function _dismissAchCard(card){if(!card||!card.parentNode)return;card.style.transform="translateY(-120%)";card.style.opacity="0";setTimeout(function(){if(card.parentNode)card.parentNode.removeChild(card);var stack=document.getElementById("ach-unlock-stack");if(stack&&stack.children.length===0&&stack.parentNode)stack.parentNode.removeChild(stack)},400)}
function checkAchievementUnlocks(){try{var r=getUnlockedAchievements();if(r.newly.length>0){r.newly.forEach(function(a,i){setTimeout(function(){if("function"==typeof showAchievementUnlock)showAchievementUnlock(a);else if("function"==typeof pushHomeToast){var info=_achTierInfo(a.tier);pushHomeToast(" "+a.name,a.desc,info.color)}},i*1100)})}}catch(e){}}
function renderHallOfFame(){var container=document.getElementById("hof-content");if(!container)return;try{var html="";if("function"==typeof _buildAchievementsHTML)html=_buildAchievementsHTML();if(!html||html.length===0){container.innerHTML='<div style="margin:20px 16px;padding:20px;text-align:center;color:var(--text3);font-size:13px;border:1px solid var(--border);border-radius:14px;background:var(--surface2)">Aucun accomplissement débloqué pour le moment.<br><br><span style="color:var(--text2);font-size:12px">Continue ta carrière pour débloquer tes premiers trophées !</span></div>';return}container.innerHTML=html;var subtitle=document.getElementById("hof-subtitle");if(subtitle){try{var r=getUnlockedAchievements();var totalUnlocked=Object.keys(r.unlocked||{}).length;var totalDefs=ACHIEVEMENTS.length;subtitle.textContent=totalUnlocked+" / "+totalDefs+" accomplissements"}catch(e){}}}catch(e){container.innerHTML='<div style="padding:20px;color:var(--text3);font-size:12px">Erreur — '+(e.message||"")+'</div>'}}
var ACH_ICON_VIEWBOX_OVERRIDES={target:"1 1 18 18",kart:"1 4 18 14",podium:"0 2 20 17",fire:"4 1 12 18",bolt:"3 0 14 20",cloudy:"2 3 16 14",chrono_alt:"2 1 16 17",clock:"1 1 18 18",shield:"3 1 14 18",check:"2 2 16 16",home:"1 2 18 17",compass:"1 1 18 18",rocket:"2 1 16 18",trend:"1 3 18 14",sparkles:"1 1 18 18",calendar:"1 1 18 18",map:"1 2 18 16",globe:"1 1 18 18",flag:"2 1 16 18",wet:"2 1 16 18",mountain:"1 2 18 17",data:"2 1 16 18",storm:"3 1 14 18",hot:"3 1 14 18",helmet:"1 4 18 14",medal:"2 0 16 19",crown:"1 2 18 17"};
function renderAchievementIcon(iconKey,size,color){var svg=typeof renderIcon==="function"?renderIcon(iconKey,size,color):"";var override=ACH_ICON_VIEWBOX_OVERRIDES[iconKey];if(override&&svg.indexOf("viewBox=\"0 0 20 20\"")>=0){svg=svg.replace("viewBox=\"0 0 20 20\"","viewBox=\""+override+"\"")}return svg}
function _buildAchievementsHTML(){try{var r=getUnlockedAchievements();var unlocked=r.unlocked||{};var html="";var byTier={bronze:[],silver:[],gold:[],legendary:[]};ACHIEVEMENTS.forEach(function(a){var unl=!!unlocked[a.id];byTier[a.tier]=byTier[a.tier]||[];byTier[a.tier].push({def:a,unlocked:unl,info:unlocked[a.id]||null})});var totalUnlocked=Object.keys(unlocked).length;var totalDefs=ACHIEVEMENTS.length;var pct=Math.round(100*totalUnlocked/totalDefs);var pctDisplay=Math.max(pct,1.5);html+='<div style="margin:14px 16px 12px 16px;border:1px solid var(--border);border-radius:14px;overflow:hidden;background:linear-gradient(180deg,var(--surface2) 0%,var(--bg2) 100%);position:relative;box-shadow:0 4px 16px rgba(0,0,0,0.25),0 0 0 1px rgba(168,85,247,0.06)">';html+='<div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(180deg,#A855F7 0%,#7C3AED 100%);box-shadow:0 0 12px rgba(168,85,247,0.5)"></div>';html+='<div style="padding:14px 14px 14px 20px">';html+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><span style="font-family:var(--font-display);font-size:11px;font-weight:800;color:var(--text2);letter-spacing:.12em;text-transform:uppercase">'+renderIcon('trophy',14,'#F59E0B')+' Trophées débloqués</span><span style="font-family:var(--font-display);font-size:20px;font-weight:900;color:#A855F7;text-shadow:0 0 12px rgba(168,85,247,0.5);letter-spacing:-.01em">'+totalUnlocked+'<span style="font-size:13px;color:var(--text3);font-weight:700;margin-left:2px"> / '+totalDefs+'</span></span></div>';html+='<div style="position:relative;height:10px;background:linear-gradient(90deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.06) 100%);border:1px solid rgba(255,255,255,0.08);border-radius:6px;overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,0.3)">';html+='<div style="position:absolute;inset:0;background-image:linear-gradient(90deg,rgba(255,255,255,0.025) 50%,transparent 50%);background-size:8px 100%;opacity:0.6;pointer-events:none"></div>';html+='<div style="position:relative;width:'+pctDisplay+'%;height:100%;background:linear-gradient(90deg,#CD7F32 0%,#9CA3AF 33%,#F59E0B 66%,#A855F7 100%);border-radius:5px;transition:width .6s cubic-bezier(.4,0,.2,1);box-shadow:0 0 12px rgba(168,85,247,0.5),0 0 6px rgba(245,158,11,0.4);min-width:6px">';html+='<div style="position:absolute;inset:0;background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.35) 50%,transparent 100%);background-size:200% 100%;border-radius:5px;animation:hof-progress-shimmer 2.4s ease-in-out infinite"></div>';html+='</div>';html+='</div>';html+='<div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px"><span style="font-size:10px;color:var(--text3);font-family:var(--font-display);letter-spacing:.08em">'+(totalUnlocked===0?"Démarre ta collection":totalUnlocked===totalDefs?"Collection complète !":"En progression")+'</span><span style="font-family:var(--font-display);font-size:11px;color:var(--text2);font-weight:700">'+pct+'%</span></div>';html+='</div></div>';var tierOrder=["legendary","gold","silver","bronze"];var safeIcon=typeof renderIcon==="function"?renderIcon:function(){return""};var GRAY_LOCKED="#4B5563";tierOrder.forEach(function(tier){var items=byTier[tier]||[];if(items.length===0)return;var info=_achTierInfo(tier);items.sort(function(a,b){if(a.unlocked!==b.unlocked)return a.unlocked?-1:1;return 0});html+='<div style="margin:14px 16px 6px;font-family:var(--font-display);font-size:11px;font-weight:800;color:'+info.color+';letter-spacing:.1em;text-transform:uppercase">'+info.label+'</div>';html+='<div style="margin:0 16px 12px;border:1px solid var(--border);border-radius:14px;overflow:hidden;background:var(--surface2)">';items.forEach(function(it,i){var unl=it.unlocked;var a=it.def;var rowBg=unl?info.bg:"transparent";var iconColor=unl?info.color:GRAY_LOCKED;var iconHtml=renderAchievementIcon(a.icon||"trophy",22,iconColor);var iconBg=unl?info.bg:"rgba(75,85,99,0.10)";var iconBorder=unl?info.border:"rgba(75,85,99,0.30)";var iconShadow=unl?"box-shadow:0 0 12px "+info.bg+";":"";html+='<div style="display:flex;align-items:flex-start;gap:12px;padding:11px 14px 11px 18px;background:'+rowBg+';'+(i<items.length-1?"border-bottom:1px solid var(--border)":"")+'">';html+='<span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;background:'+iconBg+';border:1px solid '+iconBorder+';flex-shrink:0;transition:background .3s,border-color .3s;'+iconShadow+'">'+iconHtml+'</span>';html+='<div style="flex:1;min-width:0">';html+='<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="font-size:13px;font-weight:700;color:'+(unl?"var(--text)":"var(--text2)")+'">'+(unl?"":'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px;opacity:.6"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> ')+a.name+'</span>';if(unl&&it.info&&(it.info.gameYear||it.info.saison)){var _achY=it.info.gameYear||((G.pilot&&G.pilot.startYear?G.pilot.startYear:2024)+(it.info.saison-1));html+='<span style="font-size:9px;color:var(--text3);font-family:var(--font-display);letter-spacing:.04em">'+_achY+'</span>'}html+='</div>';html+='<div style="font-size:11px;color:var(--text3);margin-top:2px">'+a.desc+'</div>';if(!unl){var prog=null;try{prog=typeof _achProgress==="function"?_achProgress(a.id,r.stats||(typeof computeAllTimeStats==="function"?computeAllTimeStats():{})):null}catch(e){}if(prog&&!prog._hidden){var progColor=info.color;if(prog.pct>=80)progColor="#34D399";else if(prog.pct>=50)progColor=info.color;else if(prog.pct===0)progColor="rgba(75,85,99,0.6)";var displayCur=prog._isBoolean?(prog.current?"":""):prog.current;var displayTarget=prog._isBoolean?"":(" / "+prog.target);var displayWidth=Math.max(prog.pct,prog.pct>0?2:0);html+='<div style="margin-top:5px;display:flex;align-items:center;gap:8px"><div style="flex:1;height:4px;background:rgba(255,255,255,0.04);border-radius:2px;overflow:hidden;position:relative"><div style="width:'+displayWidth+'%;height:100%;background:linear-gradient(90deg,'+progColor+'AA 0%,'+progColor+' 100%);border-radius:2px;transition:width .4s ease;'+(prog.pct>=100?"box-shadow:0 0 6px "+progColor+"66":"")+'"></div></div><span style="font-family:var(--font-display);font-size:9.5px;font-weight:800;color:'+(prog.pct>=80?"#34D399":"var(--text2)")+';letter-spacing:.04em;min-width:42px;text-align:right">'+displayCur+displayTarget+(prog.unit||"")+'</span></div>'}}html+='</div>';html+='</div>'});html+='</div>'});return html}catch(e){return ""}}

function getF1Stats(){var e=(CAREER_HISTORY||[]).filter(function(e){return e&&"Formule 1"===e.cat}),t="Formule 1"===G.cat,r=t&&G.races||[],n,a,i,o,s,l,c,d;return{wins:e.reduce(function(e,t){return e+(t.wins||0)},0)+r.filter(function(e){return e&&1===e.pos}).length,pods:e.reduce(function(e,t){return e+(t.pods||0)},0)+r.filter(function(e){return e&&e.pos>=1&&e.pos<=3}).length,top5:e.reduce(function(e,t){return e+(t.top5||0)},0)+r.filter(function(e){return e&&e.pos>=1&&e.pos<=5}).length,dnfs:e.reduce(function(e,t){return e+(t.dnfs||0)},0)+r.filter(function(e){return e&&0===e.pos}).length,pts:e.reduce(function(e,t){return e+(t.pts||0)},0)+(t&&G.champPts||0),races:e.reduce(function(e,t){return e+(t.races||0)},0)+r.length,titles:e.filter(function(e){return e&&1===e.pos}).length,seasons:e.length+(t?1:0),inF1:t}}function calcHofScore(){var e=getF1Stats();if(!e.inF1&&0===e.seasons)return{score:0,titles:0,wins:0,rating:calcPlayerRating(),rep:G.reputation||0,f1:e,notInF1:!0};var t=calcPlayerRating(),r=G.reputation||0,n=Math.min(100,18*e.titles+Math.min(28,.8*e.wins)+Math.min(20,.65*(t-60))+Math.min(12,.22*(r-30))+Math.min(8,.12*e.pods));return{score:Math.round(n),titles:e.titles,wins:e.wins,rating:t,rep:r,f1:e}}function getHofRankLabel(e){return e>=95?{label:"Légende absolue",color:"#E040FB",icon:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2 18l4-10 6 6 6-6 4 10H2z"/><path d="M2 18h20"/></svg>'}:e>=80?{label:"Panthéon officiel",color:"#F59E0B",icon:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M8 21h8m-4-4v4M5 3H2l3 9a4 4 0 008 0l3-9h-3"/><path d="M19 3h3l-3 9"/></svg>'}:e>=65?{label:"Grande carrière",color:"#34D399",icon:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'}:e>=45?{label:"Pilote accompli",color:"#60A5FA",icon:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'}:e>=25?{label:"En progression",color:"var(--text2)",icon:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>'}:{label:"Débutant",color:"var(--text3)",icon:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 15V5l4 4 4-4 4 4 4-4v10"/><line x1="4" y1="19" x2="4" y2="15"/></svg>'}}var MD_CATS=["Formule 4","Formula Regional","Formule 3","Formule 2","Formule 1"],MD_QUESTIONS=[{q:"Comment vous sentez-vous avant ce début de saison ?",answers:[{text:"Je suis confiant, l'équipe a fait un travail incroyable.",rep:{med:2,pub:3,pad:1,rec:0},note:"Les médias adorent l'enthousiasme."},{text:"On prend course par course, les objectifs seront clairs sur la piste.",rep:{med:1,pub:1,pad:2,rec:2},note:"Les recruteurs apprécient le professionnalisme."},{text:"Difficile à dire, on verra bien ce que la voiture a dans le ventre.",rep:{med:0,pub:-1,pad:1,rec:0},note:"Réponse perçue comme trop prudente par le public."}]},{q:"Quelle est votre principale menace cette saison ?",answers:[{text:"Je me concentre sur moi-même, pas sur les autres.",rep:{med:1,pub:2,pad:1,rec:1},note:"Le public aime la mentalité."},{text:"Plusieurs adversaires sont très forts, cela va être serré.",rep:{med:2,pub:1,pad:1,rec:0},note:"Réponse équilibrée et honnête."},{text:"Je serai la principale menace pour tout le monde.",rep:{med:3,pub:4,pad:-2,rec:-1},note:"Le paddock lève les yeux au ciel, mais le public adore l'audace."}]},{q:"Que pensez-vous des nouvelles réglementations techniques ?",answers:[{text:"C'est excellent pour l'équité du championnat.",rep:{med:2,pub:1,pad:1,rec:0},note:"Safe et consensuel."},{text:"Nous avons travaillé dur pour les comprendre, c'est notre avantage.",rep:{med:1,pub:1,pad:2,rec:2},note:"Les recruteurs notent l'intelligence tactique."},{text:"Je préfère ne pas commenter les décisions techniques de la FIA.",rep:{med:-1,pub:0,pad:0,rec:0},note:"Très peu apprécié des médias."}]},{q:"Quel est votre objectif cette saison ?",answers:[{text:"Terminer dans le Top 5 du championnat.",rep:{med:1,pub:1,pad:1,rec:1},note:"Objectif réaliste bien reçu."},{text:"Gagner le titre, rien de moins.",rep:{med:2,pub:3,pad:-1,rec:0},note:"Ambitieux ! Le public est excité, le paddock sceptique."},{text:"Apprendre et progresser race après race.",rep:{med:1,pub:2,pad:2,rec:2},note:"Les recruteurs apprécient la maturité."}]},{q:"Comment décririez-vous votre style de pilotage ?",answers:[{text:"Agressif mais précis — je pousse jusqu'à la limite.",rep:{med:3,pub:3,pad:0,rec:1},note:"Les fans adorent l'image du gladiateur."},{text:"Technique, basé sur les données et la stratégie.",rep:{med:1,pub:0,pad:3,rec:3},note:"Les ingénieurs et recruteurs sont conquis."},{text:"Adaptatif — je change selon les conditions.",rep:{med:1,pub:1,pad:2,rec:1},note:"Réponse intelligente et bien équilibrée."}]},{q:"Que pensez-vous de vos équipiers cette saison ?",answers:[{text:"La concurrence interne rend tout le monde meilleur.",rep:{med:2,pub:2,pad:1,rec:0},note:"Diplomate et professionnel."},{text:"Je serai plus rapide qu'eux, c'est mon objectif.",rep:{med:2,pub:3,pad:-3,rec:-1},note:"Le paddock prend note du manque de fair-play."},{text:"Je ne commente pas les performances de mes collègues.",rep:{med:-1,pub:0,pad:1,rec:0},note:"Réponse fermée mal perçue par la presse."}]},{q:"Quel circuit vous réjouit le plus cette saison ?",answers:[{text:"Monaco — l'atmosphère est unique, c'est le temple du sport automobile.",rep:{med:3,pub:4,pad:1,rec:0},note:"La réponse classique qui fait toujours son effet."},{text:"Spa — les courbes rapides correspondent parfaitement à mon style.",rep:{med:2,pub:2,pad:2,rec:1},note:"Technique et crédible."},{text:"Tous les circuits sont égaux pour moi, je vise la victoire partout.",rep:{med:1,pub:2,pad:1,rec:1},note:"Solide et professionnel."}]},{q:"Comment gérez-vous la pression médiatique ?",answers:[{text:"J'adore les médias, c'est une partie intégrante du sport.",rep:{med:4,pub:2,pad:1,rec:0},note:"La presse adore un pilote accessible."},{text:"Je reste focalisé sur la piste — c'est ma priorité absolue.",rep:{med:0,pub:1,pad:2,rec:2},note:"Professionnel et crédible."},{text:"C'est parfois difficile, mais j'apprends à m'y adapter.",rep:{med:1,pub:3,pad:1,rec:1},note:"L'honnêteté touche le public."}]}],MD_STATE={questions:[],currentIdx:0,effects:[],usedThisSeason:!1};function mediaDayAvailable(){return MD_CATS.indexOf(G.cat)>=0&&!MD_STATE.usedThisSeason&&G.races.length<(CAL_RACES.length||10)}function updateMediaDayRow(){var e=document.getElementById("home-mediaday-row");e&&(e.style.display=mediaDayAvailable()?"flex":"none")}function openMediaDay(){if(mediaDayAvailable()){var e=document.getElementById("md-sub");e&&(e.textContent=G.cat+" · "+gYear());var t=MD_QUESTIONS.slice();MD_STATE.questions=[];for(var r=0;r<Math.min(3,t.length);r++){var n=Math.floor(Math.random()*t.length);MD_STATE.questions.push(t.splice(n,1)[0])}MD_STATE.currentIdx=0,MD_STATE.effects=[],showMediaQuestion(),navTo("S-mediaday",null),document.getElementById("main-nav").classList.add("show")}}function showMediaQuestion(){var e=MD_STATE.questions[MD_STATE.currentIdx];if(e){var t=document.getElementById("md-question"),r=document.getElementById("md-answers"),n=document.getElementById("md-feedback"),a=document.getElementById("md-next-btn"),i=document.getElementById("md-done-btn");t&&(t.textContent="« "+e.q+" »"),r&&(r.innerHTML="",e.answers.forEach(function(e,t){var n=document.createElement("button"),a;n.style.cssText="width:100%;padding:12px 14px;background:linear-gradient(180deg, var(--bg3) 0%, var(--bg2) 100%);border:1px solid var(--border-hi);border-radius:12px;color:var(--text);font-size:13px;cursor:pointer;font-family:inherit;text-align:left;line-height:1.4",n.textContent=t+1+". "+e.text,a=e,n.onclick=function(){selectMediaAnswer(a)},r.appendChild(n)})),n&&(n.style.display="none"),a&&(a.style.display="none"),i&&(i.style.display="none")}}function selectMediaAnswer(e){G.rep.medias=Math.min(100,Math.max(0,G.rep.medias+e.rep.med)),G.rep.public=Math.min(100,Math.max(0,G.rep.public+e.rep.pub)),G.rep.paddock=Math.min(100,Math.max(0,G.rep.paddock+e.rep.pad)),G.rep.recruteurs=Math.min(100,Math.max(0,G.rep.recruteurs+e.rep.rec)),recomputeGlobalRep(),MD_STATE.effects.push({note:e.note,rep:e.rep});var t=document.getElementById("md-answers");t&&Array.from(t.children).forEach(function(t){t.disabled=!0,t.style.opacity="0.5",t.textContent.indexOf(e.text)>=0&&(t.style.background="#0A2620",t.style.borderColor="var(--teal,#34D399)",t.style.opacity="1",t.style.color="#fff")});var r=document.getElementById("md-feedback");if(r){r.style.display="block",r.className="fb ok";var n=e.rep.med+e.rep.pub+e.rep.pad+e.rep.rec;r.innerHTML="<strong>"+(n>0?"+"+n:n)+" rép. globale</strong> — "+e.note}var a=MD_STATE.currentIdx>=MD_STATE.questions.length-1,i=document.getElementById("md-next-btn"),o=document.getElementById("md-done-btn");a?o&&(o.style.display="block"):i&&(i.style.display="block"),updateUI()}function nextMediaQuestion(){MD_STATE.currentIdx++,showMediaQuestion()}function endMediaDay(){MD_STATE.usedThisSeason=!0,updateMediaDayRow();var e=document.getElementById("md-log-title"),t=document.getElementById("md-log");e&&(e.style.display="block"),t&&(t.innerHTML=MD_STATE.effects.map(function(e){var t=e.rep.med+e.rep.pub+e.rep.pad+e.rep.rec,r=t>0?"var(--teal,#34D399)":t<0?"var(--red-light)":"var(--text3)";return'<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:12px;color:var(--text2)">'+e.note+' <span style="font-weight:700;color:'+r+'">'+(t>0?"+":"")+t+"</span></div>"}).join(""));var r=document.getElementById("md-next-btn"),n=document.getElementById("md-done-btn");r&&(r.style.display="none"),n&&(n.textContent="Retour à l'accueil",n.onclick=function(){navTo("S-home","ni-home")},n.style.display="block")}var STAFF_NAMES_BY_NAT={IT:{first:["Alessandro","Marco","Lorenzo","Luca","Davide","Andrea","Matteo","Stefano","Paolo","Roberto","Giovanni","Francesco","Antonio","Riccardo","Federico","Giuseppe","Daniele","Massimo","Emanuele","Simone"],last:["Rossi","Bianchi","Ferrari","Esposito","Romano","Ricci","Marino","Greco","Bruno","Conti","Russo","Colombo","De Luca","Gallo","Costa","Mancini","Lombardi","Moretti","Barbieri","Fontana"]},GB:{first:["James","Oliver","Henry","Thomas","Richard","Edward","Charles","William","Michael","David","George","Andrew","Mark","Daniel","Christopher","Paul","Robert","Stephen","Peter","John"],last:["Smith","Johnson","Williams","Brown","Taylor","Davies","Wilson","Clark","Harris","Walker","Thompson","White","Hall","Wright","Edwards","Roberts","Robinson","Turner","Cooper","Mitchell"]},FR:{first:["Jean","Pierre","Antoine","Nicolas","François","Laurent","Olivier","Matthieu","Philippe","Julien","Hugo","Raphaël","Louis","Gabriel","Arthur","Adrien","Théo","Clément","Quentin","Sébastien"],last:["Dupont","Martin","Bernard","Durand","Moreau","Laurent","Rousseau","Lefebvre","Morel","Roux","Lambert","Fontaine","Chevalier","Gauthier","Mercier","Lemoine","Barbier","Delacroix","Vidal","Renault"]},DE:{first:["Klaus","Jürgen","Thomas","Markus","Stefan","Heinz","Martin","Andreas","Dirk","Helmut","Sebastian","Michael","Lukas","Felix","Jonas","Maximilian","Florian","Tobias","Dominik","Christoph"],last:["Müller","Schmidt","Schneider","Fischer","Weber","Becker","Hoffmann","Schulz","Koch","Bauer","Wagner","Richter","Klein","Wolf","Schröder","Neumann","Schwarz","Zimmermann","Krüger","Hartmann"]},ES:{first:["Fernando","Carlos","Miguel","Diego","Juan","Antonio","Pablo","Manuel","Jorge","Javier","Alejandro","Sergio","Daniel","Álvaro","Rubén","Adrián","Iván","Raúl","David","José"],last:["Garcia","Lopez","Rodriguez","Fernandez","Gonzalez","Sanchez","Perez","Martinez","Diaz","Torres","Ruiz","Hernandez","Jimenez","Moreno","Álvarez","Romero","Alonso","Gutiérrez","Navarro","Domínguez"]},SE:{first:["Niels","Sven","Anders","Lars","Erik","Magnus","Oskar","Viktor","Johan","Arne","Mikael","Henrik","Fredrik","Gustav","Daniel","Mattias","Stefan","Per","Jonas","Andreas"],last:["Andersson","Nilsson","Eriksson","Larsson","Olsson","Persson","Svensson","Gustafsson","Lindberg","Berg","Lindqvist","Lindström","Bergström","Holmberg","Sandberg","Lundgren","Karlsson","Jonsson","Pettersson","Magnusson"]},JP:{first:["Hiroshi","Takashi","Kenji","Yuji","Satoshi","Takeshi","Masato","Ken","Shintaro","Ryo","Akira","Daisuke","Hideki","Kazuki","Naoki","Shinji","Tatsuya","Toshio","Yoshio","Kazuhiro"],last:["Tanaka","Suzuki","Yamamoto","Nakamura","Kobayashi","Sato","Watanabe","Ito","Takahashi","Matsumoto","Inoue","Kimura","Hayashi","Saito","Yamada","Sasaki","Yamaguchi","Mori","Abe","Ikeda"]},PT:{first:["João","Miguel","Pedro","Tiago","Rui","Bruno","Paulo","André","Ricardo","Diogo","Hugo","Nuno","Carlos","Manuel","António","José","Francisco","Luís","Vasco","Filipe"],last:["Silva","Santos","Ferreira","Pereira","Oliveira","Costa","Rodrigues","Martins","Sousa","Carvalho","Almeida","Lopes","Marques","Gomes","Pinto","Ribeiro","Mendes","Cardoso","Teixeira","Moreira"]},NL:{first:["Jan","Pieter","Hendrik","Willem","Joost","Bram","Sven","Maarten","Lars","Tim","Bas","Daan","Lucas","Sjoerd","Roel","Niels","Stijn","Jeroen","Sander","Thijs"],last:["de Jong","Jansen","de Vries","van den Berg","van Dijk","Bakker","Janssen","Visser","Smit","Meijer","de Boer","Mulder","de Groot","Bos","Vos","Peters","Hendriks","van Leeuwen","Dekker","Brouwer"]},CH:{first:["Hans","Peter","Marc","Andreas","Christoph","Stefan","Daniel","Markus","Roland","Urs","Reto","Beat","Werner","Bruno","Patrick","Thomas","Roger","Adrian","Lukas","Sébastien"],last:["Meier","Müller","Schmid","Keller","Weber","Steiner","Frei","Brunner","Huber","Kaufmann","Baumann","Schneider","Fischer","Wenger","Zimmermann","Lehmann","Suter","Bachmann","Furrer","Bühler"]},BR:{first:["Bruno","Rafael","Lucas","Gabriel","Felipe","Rodrigo","Tiago","Diego","Marcelo","André","Pedro","Ricardo","Paulo","Carlos","Eduardo","Fábio","Gustavo","Alexandre","Vinícius","Leonardo"],last:["Silva","Santos","Oliveira","Souza","Lima","Pereira","Costa","Rodrigues","Almeida","Carvalho","Ferreira","Ribeiro","Gomes","Martins","Nascimento","Araújo","Barbosa","Cardoso","Cavalcanti","Castro"]},US:{first:["Michael","Brian","Christopher","Jason","Kevin","Matthew","Ryan","Tyler","Brandon","Justin","Andrew","Joshua","Daniel","Eric","Steven","Anthony","Mark","Aaron","Jeffrey","Patrick"],last:["Anderson","Thompson","Miller","Davis","Garcia","Wilson","Martinez","Robinson","Walker","Hall","Young","King","Wright","Lopez","Hill","Scott","Green","Adams","Baker","Nelson"]},AT:{first:["Hans","Klaus","Stefan","Andreas","Markus","Christian","Thomas","Manuel","Lukas","Felix","Sebastian","Maximilian","Florian","Tobias","Daniel","Michael","Patrick","Christoph","Bernhard","Wolfgang"],last:["Gruber","Huber","Bauer","Wagner","Müller","Pichler","Steiner","Moser","Mayer","Hofer","Leitner","Berger","Fuchs","Eder","Fischer","Schmid","Winkler","Wallner","Aigner","Brunner"]},BE:{first:["Lucas","Noah","Louis","Liam","Arthur","Adam","Hugo","Léon","Maxime","Nicolas","Antoine","Pierre","Thomas","Sébastien","Vincent","Olivier","Julien","Stijn","Wouter","Bram"],last:["Peeters","Janssens","Maes","Jacobs","Mertens","Willems","Claes","Goossens","Wouters","De Smet","Dubois","Lambert","Dupont","Martin","Bernard","Vandenberghe","Hermans","Cools","Van Damme","De Clercq"]}};var STAFF_FIRST_NAMES=[],STAFF_LAST_NAMES=[];Object.keys(STAFF_NAMES_BY_NAT).forEach(function(_n){var _e=STAFF_NAMES_BY_NAT[_n];STAFF_FIRST_NAMES=STAFF_FIRST_NAMES.concat(_e.first);STAFF_LAST_NAMES=STAFF_LAST_NAMES.concat(_e.last)});var STAFF_NATIONALITIES=Object.keys(STAFF_NAMES_BY_NAT),STAFF_ROLES=[{key:"tp",label:"Team Principal",shortLabel:"TP",color:"#F59E0B",icon:"star",iconSvg:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 17l3-9 5 6 2-8 2 8 5-6 3 9z"/><path d="M2 21h20"/></svg>',minAge:45,maxAge:65,description:"Leader global, stratégie écurie et négos"},{key:"dir_sport",label:"Directeur Sportif",shortLabel:"Dir. Sportif",color:"#60A5FA",icon:"target",iconSvg:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="14" r="8"/><path d="M12 10v4l2.5 2.5"/><path d="M9 2h6"/><path d="M12 2v4"/></svg>',minAge:40,maxAge:60,description:"Décisions en course, relations FIA"},{key:"dir_tech",label:"Directeur Technique",shortLabel:"Dir. Tech",color:"#34D399",icon:"cpu",iconSvg:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a5 5 0 00-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 006.4-6.4l-3 3-3-3 3-3z"/></svg>',minAge:40,maxAge:62,description:"Conception voiture, développement"},{key:"race_eng",label:"Ingénieur de course",shortLabel:"Ing. Course",color:"#A78BFA",icon:"mic",iconSvg:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 15v-3a9 9 0 0118 0v3"/><path d="M21 15a2 2 0 01-2 2h-1v-5h1a2 2 0 012 2v1z"/><path d="M3 15a2 2 0 002 2h1v-5H5a2 2 0 00-2 2v1z"/><path d="M12 18v1a2 2 0 002 2h2"/></svg>',minAge:32,maxAge:55,description:"Setup, comm radio pilote"}],STAFF_BY_TEAM={},TEAM_GROUPS={"Prema Powerteam":"prema","Prema Racing":"prema","ART Grand Prix":"art","Hitech GP":"hitech","MP Motorsport":"mp",Trident:"trident","Campos Racing":"campos",DAMS:"dams","Van Amersfoort Racing":"var","PHM Racing":"phm","Jenzer Motorsport":"jenzer","US Racing":"us_racing","Bhaitech Racing":"bhaitech","Cram Motorsport":"cram","EFC Sports":"efc",Carlin:"carlin",Ferrari:"ferrari_group","Ferrari AF Corse":"ferrari_group","AF Corse":"ferrari_group","Toyota Gazoo Racing":"toyota",Alpine:"alpine","Alpine Endurance":"alpine",McLaren:"mclaren","Arrow McLaren":"mclaren","Andretti Global":"andretti","Team Penske":"penske","Porsche Penske Motorsport":"porsche_penske"},TEAM_PRINCIPAL_SEEDS={Ferrari:{name:"Fred Vasseur",nat:"FR",age:57,rating:85},"Red Bull Racing":{name:"Christian Horner",nat:"GB",age:52,rating:88},Mercedes:{name:"Toto Wolff",nat:"AT",age:53,rating:90},McLaren:{name:"Andrea Stella",nat:"IT",age:54,rating:87},"Aston Martin":{name:"Andy Cowell",nat:"GB",age:56,rating:82},Alpine:{name:"Oliver Oakes",nat:"GB",age:37,rating:72},Williams:{name:"James Vowles",nat:"GB",age:47,rating:80},"Racing Bulls":{name:"Laurent Mekies",nat:"FR",age:49,rating:78},"Haas F1 Team":{name:"Ayao Komatsu",nat:"JP",age:51,rating:73},"Kick Sauber":{name:"Jonathan Wheatley",nat:"GB",age:58,rating:78},"Prema Racing":{name:"René Rosin",nat:"IT",age:47,rating:89},"Prema Powerteam":{name:"René Rosin",nat:"IT",age:47,rating:89},"ART Grand Prix":{name:"Sébastien Philippe",nat:"FR",age:50,rating:85},"Hitech GP":{name:"Oliver Oakes",nat:"GB",age:37,rating:75},"MP Motorsport":{name:"Sander Dorsman",nat:"NL",age:52,rating:78},Trident:{name:"Giacomo Ricci",nat:"IT",age:41,rating:76},"Campos Racing":{name:"Adrián Campos Jr.",nat:"ES",age:42,rating:73},DAMS:{name:"Gregory Driot",nat:"FR",age:48,rating:77},"Van Amersfoort Racing":{name:"Rob Niessink",nat:"NL",age:53,rating:74},"Team Penske":{name:"Tim Cindric",nat:"US",age:57,rating:90},"Chip Ganassi Racing":{name:"Mike Hull",nat:"US",age:64,rating:88},"Andretti Global":{name:"Rob Edwards",nat:"GB",age:51,rating:84},"Arrow McLaren":{name:"Tony Kanaan",nat:"BR",age:51,rating:80},"Toyota Gazoo Racing":{name:"Kazuki Nakajima",nat:"JP",age:41,rating:86},"Ferrari AF Corse":{name:"Antonello Coletta",nat:"IT",age:58,rating:83},"Porsche Penske Motorsport":{name:"Urs Kuratle",nat:"CH",age:54,rating:82}},GROUP_TP_STAFF={},_staffIdCounter=0;function _createStaffMember(e,t,r){var n=STAFF_ROLES.find(function(t){return t.key===e});if(!n)return null;if(_staffIdCounter++,r)return{id:"staff_"+_staffIdCounter,name:r.name,nationality:r.nat,role:e,rating:r.rating,age:r.age,tenure:0,seeded:!0};var o=STAFF_NATIONALITIES[Math.floor(Math.random()*STAFF_NATIONALITIES.length)],_pool=STAFF_NAMES_BY_NAT[o]||{first:STAFF_FIRST_NAMES,last:STAFF_LAST_NAMES},a=_pool.first[Math.floor(Math.random()*_pool.first.length)],i=_pool.last[Math.floor(Math.random()*_pool.last.length)],s=n.minAge+Math.floor(Math.random()*(n.maxAge-n.minAge+1)),l=Math.max(55,Math.min(95,Math.round(t+8*(Math.random()-.5))));return{id:"staff_"+_staffIdCounter,name:a+" "+i,nationality:o,role:e,rating:l,age:s,tenure:0}}function _getOrCreateGroupTP(e,t){var r=TEAM_GROUPS[e];if(!r)return null;if(GROUP_TP_STAFF[r])return GROUP_TP_STAFF[r];var n=TEAM_PRINCIPAL_SEEDS[e]||null;n||Object.keys(TEAM_GROUPS).some(function(e){return!(TEAM_GROUPS[e]!==r||!TEAM_PRINCIPAL_SEEDS[e])&&(n=TEAM_PRINCIPAL_SEEDS[e],!0)});var a=_createStaffMember("tp",t,n);return a&&(a.groupId=r,GROUP_TP_STAFF[r]=a),a}function _initTeamStaff(e,t){if(STAFF_BY_TEAM[e]||(STAFF_BY_TEAM[e]={}),!STAFF_BY_TEAM[e][t]){var r=72,n=TEAM_RATINGS[e+"_"+G.saison];n&&n[t]&&(r=n[t]);var a=r-3,i={};STAFF_ROLES.forEach(function(e){if("tp"===e.key){var r=_getOrCreateGroupTP(t,a);if(r)i.tp=r;else{var n=TEAM_PRINCIPAL_SEEDS[t]||null;i.tp=_createStaffMember("tp",a,n)}}else i[e.key]=_createStaffMember(e.key,a)}),STAFF_BY_TEAM[e][t]=i}}function initAllStaff(e){var t=TEAMS_BY_CAT[e];t&&0!==t.length&&(STAFF_BY_TEAM[e]||(STAFF_BY_TEAM[e]={}),t.forEach(function(t){_initTeamStaff(e,t)}))}function getTeamStaff(e,t){return t=t||G.cat,e&&t?(STAFF_BY_TEAM[t]&&STAFF_BY_TEAM[t][e]||_initTeamStaff(t,e),STAFF_BY_TEAM[t]?STAFF_BY_TEAM[t][e]:null):null}function getStaffDelta(e,t){var r=getTeamStaff(e,t);if(!r)return 0;var n=.2*(r.tp?r.tp.rating:72)+.2*(r.dir_sport?r.dir_sport.rating:72)+.4*(r.dir_tech?r.dir_tech.rating:72)+.2*(r.race_eng?r.race_eng.rating:72);return Math.max(-6,Math.min(6,(n-72)/4))}function getPlayerEngineerBonus(){if(!G.currentTeam||"Indépendant"===G.currentTeam)return 0;var e=getTeamStaff(G.currentTeam,G.cat);return e&&e.race_eng?Math.max(-.03,Math.min(.04,.002*(e.race_eng.rating-72))):0}function _evaluateTeamSeason(e,t){var r=TEAM_RATINGS[t+"_"+G.saison];if(!r)return"par";var n=r[e],a=Object.keys(r).slice().sort(function(e,t){return r[t]-r[e]}),i=a.indexOf(e)+1,o=i+Math.round(4*(Math.random()-.5)),s=(o=Math.max(1,Math.min(a.length,o)))-i;return s<=-3?"excellent":s<=-1?"good":s<=1?"par":s<=3?"disappointing":"disaster"}var STAFF_MERCATO_LOG=[],_groupFreePool=[];function _getGroupDivisions(e){var t=[];return Object.keys(STAFF_BY_TEAM).forEach(function(r){Object.keys(STAFF_BY_TEAM[r]||{}).forEach(function(n){TEAM_GROUPS[n]===e&&t.push({cat:r,teamName:n})})}),t}function _removeSharedTpFromGroup(e){var t;_getGroupDivisions(e).forEach(function(e){STAFF_BY_TEAM[e.cat]&&STAFF_BY_TEAM[e.cat][e.teamName]&&(STAFF_BY_TEAM[e.cat][e.teamName].tp=null)}),delete GROUP_TP_STAFF[e]}function _assignSharedTpToGroup(e,t){var r;t&&(t.groupId=e,GROUP_TP_STAFF[e]=t,_getGroupDivisions(e).forEach(function(e){STAFF_BY_TEAM[e.cat]&&STAFF_BY_TEAM[e.cat][e.teamName]&&(STAFF_BY_TEAM[e.cat][e.teamName].tp=t)}))}function runStaffMercato(){if(G.cat){var e=Object.keys(STAFF_BY_TEAM),t={};e.forEach(function(e){var r;Object.keys(STAFF_BY_TEAM[e]||{}).forEach(function(e){var r=TEAM_GROUPS[e];if(r&&!t[r]){t[r]=!0;var n=GROUP_TP_STAFF[r];if(n){n.tenure=(n.tenure||0)+1;var a=_getGroupDivisions(r),i=a.map(function(e){return _evaluateTeamSeason(e.teamName,e.cat)}),o={disaster:5,disappointing:3,par:2,good:1,excellent:0},s=Math.max.apply(null,i.map(function(e){return o[e]||2})),l=s>=5?.35:s>=3?.1:s>=2?.03:.01;if(n.age>=68&&Math.random()<.5)return STAFF_MERCATO_LOG.push({saison:G.saison,team:a[0]?a[0].teamName:"(Groupe)",role:"tp",type:"retirement",name:n.name,groupId:r,text:n.name+" (Team Principal du groupe) prend sa retraite."}),void _removeSharedTpFromGroup(r);if(Math.random()<l){var c=a[0]?a[0].teamName:"(Groupe)";STAFF_MERCATO_LOG.push({saison:G.saison,team:c,role:"tp",type:"fired",name:n.name,groupId:r,text:"Le groupe "+c+" se sépare de son Team Principal "+n.name+". Impact sur toutes les divisions du groupe."}),n.age<66&&_groupFreePool.push({member:n,fromGroup:r}),_removeSharedTpFromGroup(r)}}}})}),e.forEach(function(e){var t=Object.keys(STAFF_BY_TEAM[e]||{}),r=[];t.forEach(function(t){var n=_evaluateTeamSeason(t,e),a=STAFF_BY_TEAM[e][t];if(a){STAFF_ROLES.forEach(function(e){"tp"!==e.key&&a[e.key]&&(a[e.key].tenure=(a[e.key].tenure||0)+1)});var i={disaster:{dir_tech:.4,dir_sport:.25,race_eng:.2},disappointing:{dir_tech:.15,dir_sport:.1,race_eng:.1},par:{dir_tech:.04,dir_sport:.04,race_eng:.04},good:{dir_tech:.02,dir_sport:.02,race_eng:.02},excellent:{dir_tech:0,dir_sport:0,race_eng:0}}[n]||{dir_tech:.05,dir_sport:.05,race_eng:.05};STAFF_ROLES.forEach(function(o){if("tp"!==o.key){var s=a[o.key];if(s)return s.age>=68&&Math.random()<.5?(STAFF_MERCATO_LOG.push({cat:e,saison:G.saison,team:t,role:o.key,type:"retirement",name:s.name,text:s.name+" ("+o.label+" chez "+t+") prend sa retraite."}),void(a[o.key]=null)):void(Math.random()<i[o.key]&&(STAFF_MERCATO_LOG.push({cat:e,saison:G.saison,team:t,role:o.key,type:"fired",name:s.name,text:t+" se sépare de "+s.name+" ("+o.label+"). Saison "+({disaster:"catastrophique",disappointing:"décevante",par:"moyenne"}[n]||"")+"."}),s.age<66&&r.push({member:s,fromTeam:t}),a[o.key]=null))}})}}),t.forEach(function(n){var a=TEAM_RATINGS[e+"_"+G.saison],i;if(a&&a[n]&&!(Object.keys(a).slice().sort(function(e,t){return a[t]-a[e]}).indexOf(n)>2||Math.random()>=.25)){var o=STAFF_ROLES.filter(function(e){return"tp"!==e.key}),s=o[Math.floor(Math.random()*o.length)],l=STAFF_BY_TEAM[e][n];if(l){var c=l[s.key]?l[s.key].rating:60,d=[];if(t.forEach(function(t){if(t!==n){var r=STAFF_BY_TEAM[e][t];r&&r[s.key]&&r[s.key].rating>c+3&&d.push({team:t,member:r[s.key]})}}),d.length>0){var p=d[Math.floor(Math.random()*d.length)];STAFF_MERCATO_LOG.push({cat:e,saison:G.saison,team:n,role:s.key,type:"poached",name:p.member.name,fromTeam:p.team,text:n+" débauche "+p.member.name+" ("+s.label+") à "+p.team+"."}),p.member.tenure=0,l[s.key]&&r.push({member:l[s.key],fromTeam:n}),l[s.key]=p.member,STAFF_BY_TEAM[e][p.team][s.key]=null}}}}),t.forEach(function(t){var n=TEAM_RATINGS[e+"_"+G.saison],a=n&&n[t]?n[t]:72,i=STAFF_BY_TEAM[e][t];i&&STAFF_ROLES.forEach(function(o){if("tp"!==o.key&&!i[o.key]){var s=r.map(function(e,t){return{entry:e,idx:t}}).filter(function(e){return e.entry.member.role===o.key});if(s.length>0){s.sort(function(e,t){return t.entry.member.rating-e.entry.member.rating});var l,c=s[Object.keys(n).slice().sort(function(e,t){return n[t]-n[e]}).indexOf(t)<3?0:Math.floor(Math.random()*s.length)],d=c.entry.member;d.tenure=0,i[o.key]=d,r.splice(c.idx,1),STAFF_MERCATO_LOG.push({cat:e,saison:G.saison,team:t,role:o.key,type:"hired",name:d.name,fromTeam:c.entry.fromTeam,text:t+" recrute "+d.name+" ("+o.label+"), ex-"+c.entry.fromTeam+"."})}else{var p=_createStaffMember(o.key,a-3);i[o.key]=p,STAFF_MERCATO_LOG.push({cat:e,saison:G.saison,team:t,role:o.key,type:"newcomer",name:p.name,text:t+" recrute "+p.name+" ("+o.label+"), nouveau venu dans le milieu."})}}})})});var r={};Object.keys(STAFF_BY_TEAM).forEach(function(e){Object.keys(STAFF_BY_TEAM[e]||{}).forEach(function(e){var t=TEAM_GROUPS[e];if(t&&!r[t]&&(r[t]=!0,!GROUP_TP_STAFF[t])){var n=_getGroupDivisions(t);if(0!==n.length){var a=0,i=0;n.forEach(function(e){var t=TEAM_RATINGS[e.cat+"_"+G.saison];t&&t[e.teamName]&&(a+=t[e.teamName],i++)});var o=i>0?a/i:72,s=null,l=null;if(_groupFreePool.length>0){var c=_groupFreePool.slice().sort(function(e,t){return t.member.rating-e.member.rating}),d=o>=85?0:Math.floor(Math.random()*c.length);s=c[d].member,l=c[d].fromGroup;var p=_groupFreePool.findIndex(function(e){return e.member===s});p>=0&&_groupFreePool.splice(p,1),s.tenure=0,_assignSharedTpToGroup(t,s);var u=n[0]?n[0].teamName:"(Groupe)";STAFF_MERCATO_LOG.push({saison:G.saison,team:u,role:"tp",type:"hired",name:s.name,groupId:t,fromGroup:l,text:u+" nomme "+s.name+" comme nouveau Team Principal, anciennement d'un autre groupe."})}else if(s=_createStaffMember("tp",o-2)){_assignSharedTpToGroup(t,s);var f=n[0]?n[0].teamName:"(Groupe)";STAFF_MERCATO_LOG.push({saison:G.saison,team:f,role:"tp",type:"newcomer",name:s.name,groupId:t,text:f+" promeut "+s.name+" au poste de Team Principal, nouveau venu à la tête du groupe."})}}}})}),Object.keys(STAFF_BY_TEAM).forEach(function(e){Object.keys(STAFF_BY_TEAM[e]||{}).forEach(function(t){var r=STAFF_BY_TEAM[e][t];if(r&&!r.tp&&!TEAM_GROUPS[t]){var n=TEAM_RATINGS[e+"_"+G.saison],a,i=_createStaffMember("tp",(n&&n[t]?n[t]:72)-3);r.tp=i,STAFF_MERCATO_LOG.push({cat:e,saison:G.saison,team:t,role:"tp",type:"newcomer",name:i.name,text:t+" nomme "+i.name+" comme nouveau Team Principal."})}})}),STAFF_MERCATO_LOG.length>200&&(STAFF_MERCATO_LOG=STAFF_MERCATO_LOG.slice(-200))}}function getRecentStaffMoves(e,t,r){r=r||5;var n=TEAM_GROUPS[e];return STAFF_MERCATO_LOG.filter(function(r){return r.cat===t&&r.team===e||!(!n||r.groupId!==n)}).slice(-r).reverse()}var _origGetEffectiveTeamRating=getEffectiveTeamRating;function ensureStaffInitialized(){G.cat&&TEAMS_BY_CAT[G.cat]&&TEAMS_BY_CAT[G.cat].length>0&&(STAFF_BY_TEAM[G.cat]&&0!==Object.keys(STAFF_BY_TEAM[G.cat]).length||initAllStaff(G.cat))}function renderStaffPanel(e,t){t=t||G.cat;var r=getTeamStaff(e,t);if(!r)return'<div style="padding:14px;color:var(--muted);font-size:12px">Pas de staff disponible.</div>';var n='<div style="padding:0">';STAFF_ROLES.forEach(function(t){var a=r[t.key];if(!a)return n+='<div style="padding:10px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">',n+='<div style="width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.04);color:var(--text3)">—</div>',n+='<div style="flex:1">',n+='<div style="font-size:12px;font-weight:700;color:var(--text2)">'+t.label+"</div>",n+='<div style="font-size:11px;color:var(--muted);font-style:italic">Poste vacant</div>',n+="</div>",void(n+="</div>");var i=a.rating>=85?"#34D399":a.rating>=75?"#60A5FA":a.rating>=65?"#F59E0B":"#EF4444",o="";if("tp"===t.key&&a.groupId){var s=_getGroupDivisions(a.groupId).filter(function(t){return t.teamName!==e});if(s.length>0){var l=s.map(function(e){return e.cat.replace("Formule ","F").replace("Formula Regional","FREC").replace("Endurance WEC","WEC").replace("Super Formula","SF")}),c=[];l.forEach(function(e){c.indexOf(e)<0&&c.push(e)}),o=' <span style="font-size:9px;color:#F59E0B;background:rgba(245,158,11,.12);padding:1px 5px;border-radius:3px;font-weight:700;letter-spacing:.04em;margin-left:4px">Groupe · '+c.join(", ")+"</span>"}}n+='<div style="padding:10px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">',n+='<div style="width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,'+t.color+" 14%, transparent);border:1px solid color-mix(in srgb,"+t.color+" 28%, transparent);color:"+t.color+'">'+(t.iconSvg||t.shortLabel.substring(0,3).toUpperCase())+"</div>",n+='<div style="flex:1;min-width:0">',n+='<div style="font-size:13px;font-weight:700;color:var(--white);line-height:1.2">'+a.name+o+"</div>",n+='<div style="font-size:10.5px;color:var(--muted);margin-top:2px;display:flex;align-items:center;gap:5px">'+t.label+" · "+a.age+" ans · "+("function"==typeof flagSvg?flagSvg(a.nationality,13):a.nationality)+(a.tenure>0?" <span>· "+a.tenure+"e an</span>":"")+"</div>",n+="</div>",n+='<div style="text-align:right">',n+='<div style="font-family:var(--font-display);font-size:17px;font-weight:900;color:'+i+';line-height:1">'+a.rating+"</div>",n+='<div style="font-family:var(--font-display);font-size:9px;font-weight:700;color:var(--muted);letter-spacing:.14em;text-transform:uppercase;margin-top:2px">Note</div>',n+="</div>",n+="</div>"});var a=getStaffDelta(e,t),i=a>.5?"+"+a.toFixed(1):a<-.5?a.toFixed(1):"~0",o;return n+='<div style="padding:12px;display:flex;justify-content:space-between;align-items:center;font-size:12px">',n+='<span style="color:var(--text3)">Impact staff sur l\'écurie</span>',n+='<span style="font-family:var(--font-display);font-weight:900;color:'+(a>.5?"#34D399":a<-.5?"#EF4444":"var(--muted)")+'">'+i+" pts</span>",n+="</div>",n+="</div>"}getEffectiveTeamRating=function(e){var t=_origGetEffectiveTeamRating(e),r=getStaffDelta(e,G.cat);return Math.round(Math.max(50,Math.min(99,t+r)))};var TEAM_CHAMPIONSHIPS={},HISTORIC_TITLES={Ferrari:{"Formule 1":{constructors:16,drivers:15}},McLaren:{"Formule 1":{constructors:9,drivers:12}},Mercedes:{"Formule 1":{constructors:8,drivers:9}},Williams:{"Formule 1":{constructors:9,drivers:7}},"Red Bull Racing":{"Formule 1":{constructors:6,drivers:8}},Alpine:{"Formule 1":{constructors:2,drivers:2}},"Aston Martin":{"Formule 1":{constructors:0,drivers:0}},"Racing Bulls":{"Formule 1":{constructors:0,drivers:0}},"Haas F1 Team":{"Formule 1":{constructors:0,drivers:0}},"Kick Sauber":{"Formule 1":{constructors:0,drivers:0}},"Prema Racing":{"Formule 2":{constructors:6,drivers:5},"Formule 3":{constructors:7,drivers:6},"Formula Regional":{constructors:3,drivers:3}},"Prema Powerteam":{"Formule 4":{constructors:7,drivers:9}},"ART Grand Prix":{"Formule 2":{constructors:4,drivers:4},"Formule 3":{constructors:8,drivers:9},"Formula Regional":{constructors:2,drivers:2}},DAMS:{"Formule 2":{constructors:3,drivers:4}},Carlin:{"Formule 2":{constructors:1,drivers:2},"Formule 3":{constructors:2,drivers:3}},"MP Motorsport":{"Formule 2":{constructors:1,drivers:2}},"Hitech GP":{"Formule 3":{constructors:1,drivers:1}},"Campos Racing":{"Formule 2":{constructors:1,drivers:2},"Formule 3":{constructors:1,drivers:2}},Trident:{"Formule 3":{constructors:1,drivers:2}},"Van Amersfoort Racing":{"Formule 4":{constructors:3,drivers:4}},"US Racing":{"Formule 4":{constructors:2,drivers:3}},"Jenzer Motorsport":{"Formule 4":{constructors:1,drivers:1}},"R-ace GP":{"Formula Regional":{constructors:2,drivers:2}},"Team Penske":{IndyCar:{constructors:18,drivers:18}},"Chip Ganassi Racing":{IndyCar:{constructors:14,drivers:14}},"Andretti Global":{IndyCar:{constructors:4,drivers:4}},"Arrow McLaren":{IndyCar:{constructors:0,drivers:0}},"Rahal Letterman Lanigan":{IndyCar:{constructors:1,drivers:1}},"AJ Foyt Enterprises":{IndyCar:{constructors:7,drivers:7}},"Toyota Gazoo Racing":{"Endurance WEC":{constructors:6,drivers:6},"Super Formula":{constructors:8,drivers:6}},"Ferrari AF Corse":{"Endurance WEC":{constructors:2,drivers:2}},"Porsche Penske Motorsport":{"Endurance WEC":{constructors:0,drivers:0}},"Peugeot TotalEnergies":{"Endurance WEC":{constructors:2,drivers:2}},"Alpine Endurance":{"Endurance WEC":{constructors:1,drivers:1}},"Honda Racing":{"Super Formula":{constructors:2,drivers:2}},"Nakajima Racing":{"Super Formula":{constructors:3,drivers:4}},Mugen:{"Super Formula":{constructors:4,drivers:4}},"Itochu Enex Team Impul":{"Super Formula":{constructors:2,drivers:3}},"Tony Kart":{"Karting Senior":{constructors:8,drivers:12}},"Birel ART":{"Karting Senior":{constructors:3,drivers:5}},"CRG Racing":{"Karting Senior":{constructors:4,drivers:7}},"Kosmic Racing":{"Karting Senior":{constructors:2,drivers:4}},"Parolin Motorsport":{"Karting Senior":{constructors:2,drivers:3}},"OTK Kart Group":{"Karting Senior":{constructors:3,drivers:5}}},_HISTORIC_SEEDED=!1;function seedHistoricTitles(){_HISTORIC_SEEDED||(_HISTORIC_SEEDED=!0,Object.keys(HISTORIC_TITLES).forEach(function(e){var t=HISTORIC_TITLES[e];TEAM_CHAMPIONSHIPS[e]||(TEAM_CHAMPIONSHIPS[e]=[]),Object.keys(t).forEach(function(r){for(var n=t[r]||{},a=0;a<(n.constructors||0);a++)TEAM_CHAMPIONSHIPS[e].push({saison:"historique",cat:r,type:"constructors"});for(var i=0;i<(n.drivers||0);i++)TEAM_CHAMPIONSHIPS[e].push({saison:"historique",cat:r,type:"drivers",driverName:"—"})})}))}try{seedHistoricTitles()}catch(e){console.warn("seed historic:",e)}function runSimulatedChampionsForOtherCats(e,t){var r;Object.keys(TEAMS_BY_CAT).forEach(function(r){if(r!==e){var n=TEAMS_BY_CAT[r];if(n&&0!==n.length){var a=n.map(function(e){var t=getTeamPrestige(e);return{team:e,w:Math.max(1,(t-55)*(t-55)/8)}}),i=0;a.forEach(function(e){i+=e.w});for(var o=Math.random()*i,s=a[a.length-1].team,l=0;l<a.length;l++)if((o-=a[l].w)<=0){s=a[l].team;break}TEAM_CHAMPIONSHIPS[s]||(TEAM_CHAMPIONSHIPS[s]=[]),TEAM_CHAMPIONSHIPS[s].push({saison:t,cat:r,type:"constructors"});for(var c=a.slice(),d=Math.random()*i,p=c[c.length-1].team,u=0;u<c.length;u++)if((d-=c[u].w)<=0){p=c[u].team;break}TEAM_CHAMPIONSHIPS[p]||(TEAM_CHAMPIONSHIPS[p]=[]),TEAM_CHAMPIONSHIPS[p].push({saison:t,cat:r,type:"drivers",driverName:"Simulé"}),Object.keys(TEAM_CHAMPIONSHIPS).forEach(function(e){TEAM_CHAMPIONSHIPS[e].length>120&&(TEAM_CHAMPIONSHIPS[e]=TEAM_CHAMPIONSHIPS[e].slice(-120))})}}})}function recordSeasonChampions(e,t){if(e&&TEAMS_BY_CAT[e]&&0!==TEAMS_BY_CAT[e].length){var r=TEAMS_BY_CAT[e],n={};r.forEach(function(e){n[e]=0}),G.currentTeam&&void 0!==n[G.currentTeam]&&(n[G.currentTeam]=(n[G.currentTeam]||0)+(G.champPts||0)),(G.rivals||[]).forEach(function(e){e.team&&void 0!==n[e.team]&&(n[e.team]+=e.pts||0)});var a,i=r.slice().sort(function(e,t){return(n[t]||0)-(n[e]||0)})[0];i&&n[i]>0&&(TEAM_CHAMPIONSHIPS[i]||(TEAM_CHAMPIONSHIPS[i]=[]),TEAM_CHAMPIONSHIPS[i].push({saison:t,cat:e,type:"constructors"}));var o=[];o.push({name:(G.pilot.prenom?G.pilot.prenom+" ":"")+G.pilot.nom,pts:G.champPts||0,team:G.currentTeam,me:!0}),(G.rivals||[]).forEach(function(e){o.push({name:e.name,pts:e.pts||0,team:e.team,me:!1})}),o.sort(function(e,t){return t.pts-e.pts});var s=o[0];s&&s.team&&s.pts>0&&(TEAM_CHAMPIONSHIPS[s.team]||(TEAM_CHAMPIONSHIPS[s.team]=[]),TEAM_CHAMPIONSHIPS[s.team].push({saison:t,cat:e,type:"drivers",driverName:s.name})),Object.keys(TEAM_CHAMPIONSHIPS).forEach(function(e){TEAM_CHAMPIONSHIPS[e].length>60&&(TEAM_CHAMPIONSHIPS[e]=TEAM_CHAMPIONSHIPS[e].slice(-60))})}}function getTeamActiveCategories(e){var t=[],r=TEAM_GROUPS[e];return Object.keys(TEAMS_BY_CAT).forEach(function(n){var a;(TEAMS_BY_CAT[n]||[]).forEach(function(a){a===e?t.indexOf(n)<0&&t.push({cat:n,teamName:a}):r&&TEAM_GROUPS[a]===r&&t.push({cat:n,teamName:a})})}),t}function getTeamAffiliatedAcademies(e){if("object"!=typeof ACADEMIES)return[];var t=TEAM_GROUPS[e],r=[];return Object.keys(ACADEMIES).forEach(function(n){var a=ACADEMIES[n];if(a.f1Team===e)r.push({name:n,data:a,via:"Écurie mère F1"});else if(t&&a.f1Team&&TEAM_GROUPS[a.f1Team]===t)r.push({name:n,data:a,via:"Groupe"});else{var i=null;a.affiliates&&Object.keys(a.affiliates).forEach(function(r){var n=a.affiliates[r]||[];n.indexOf(e)>=0?i=r:t&&n.forEach(function(e){TEAM_GROUPS[e]!==t||i||(i=r)})}),i&&r.push({name:n,data:a,via:"Affiliée "+i})}}),r}function getTeamDrivers(e,t){t=t||G.cat;var r=[];return G.currentTeam===e&&G.cat===t&&r.push({name:(G.pilot.prenom?G.pilot.prenom+" ":"")+G.pilot.nom,pts:G.champPts||0,me:!0,rating:"function"==typeof calcPlayerRating?calcPlayerRating():65,nat:G.pilot.nat||"FR"}),(G.rivals||[]).forEach(function(t){t.team===e&&r.push({name:t.name,pts:t.pts||0,me:!1,rating:"function"==typeof calcRivalRating?calcRivalRating(t):65,nat:t.nat||"FR"})}),r.sort(function(e,t){return t.pts-e.pts})}function _getConstructorsStanding(e){e=e||G.cat;var t=TEAMS_BY_CAT[e]||[];if(0===t.length)return[];var r={};return t.forEach(function(e){r[e]=0}),G.currentTeam&&void 0!==r[G.currentTeam]&&(r[G.currentTeam]=(r[G.currentTeam]||0)+(G.champPts||0)),(G.rivals||[]).forEach(function(e){e.team&&void 0!==r[e.team]&&(r[e.team]+=e.pts||0)}),t.slice().sort(function(e,t){return(r[t]||0)-(r[e]||0)}).map(function(e){return{team:e,pts:r[e]||0}})}function _ensureRivalDetailedStats(rival){if(rival.detailedStats&&typeof rival.detailedStats.vitesse_pure==="number"&&typeof rival.detailedStats.gestion_pneus==="number")return rival.detailedStats;var skill=rival.skill||65;var cons=rival.consistency||0.75;var seed=0;var name=rival.name||"";for(var i=0;i<name.length;i++)seed=(seed*31+name.charCodeAt(i))|0;seed=Math.abs(seed);function pseudoRand(s){return((s*9301+49297)%233280)/233280}var consBonus=Math.round(15*(cons-0.65));var keys=["vitesse_pure","acceleration","reactivite","freinage","grip","gestion_pneus","concentration","decision","pression"];var stats={};keys.forEach(function(k,j){var variation=Math.round(10*(pseudoRand(seed+j*17+11)-0.5));var bonus=0;if(k==="concentration"||k==="pression"||k==="gestion_pneus"||k==="grip"||k==="freinage")bonus=consBonus;stats[k]=Math.max(35,Math.min(99,skill+variation+bonus))});var phyVar=Math.round(8*(pseudoRand(seed+103)-0.5));stats.physique=Math.max(35,Math.min(99,skill+phyVar-3));rival.detailedStats=stats;return stats}
function _rivalSkillFromDetailedStats(stats){if(!stats)return 65;var vitesse_pure=stats.vitesse_pure||65,acceleration=stats.acceleration||65,reactivite=stats.reactivite||65,freinage=stats.freinage||65,grip=stats.grip||65,gestion_pneus=stats.gestion_pneus||65,concentration=stats.concentration||65,decision=stats.decision||65,pression=stats.pression||65,physique=stats.physique||52;var r=0.38*((vitesse_pure+acceleration+reactivite)/3)+0.32*((freinage+grip+gestion_pneus)/3)+0.22*((concentration+decision+pression)/3)+0.08*physique;var bonus=r>=55&&r<75?0.08*(r-55):r>=75&&r<88?1.6+0.08*(r-75):r>=88?2.64+0.05*(r-88):0;return Math.round(Math.max(40,Math.min(99,r+bonus)))}
function _rivalConsistencyFromDetailedStats(stats){if(!stats)return 0.75;var c=stats.concentration||65,p=stats.pression||65,d=stats.decision||65;var avg=(c*0.4+p*0.4+d*0.2-35)/(99-35);return Math.max(0.40,Math.min(0.99,0.50+avg*0.45))}

var CAT_AGE_RANGES={"Karting Junior":{min:8,typical:10,max:12},"Karting Senior":{min:13,typical:14,max:16},"Formule 4":{min:15,typical:16,max:18},"Formula Regional":{min:16,typical:17,max:19},"Formule 3":{min:16,typical:18,max:22},"Formule 2":{min:17,typical:20,max:24},"Formule 1":{min:18,typical:26,max:42},"Super Formula":{min:17,typical:25,max:38},"Endurance WEC":{min:17,typical:32,max:50},IndyCar:{min:18,typical:28,max:45}};
function _categoryForAge(cat){return CAT_AGE_RANGES[cat]||CAT_AGE_RANGES["Formule 1"]}
function _generateRealisticAge(cat,seed){var range=_categoryForAge(cat);var min=range.min,max=range.max,typical=range.typical;var spread=max-min;function pseudoRand(s){return((s*9301+49297)%233280)/233280}var r1=pseudoRand(seed*2+13);var r2=pseudoRand(seed*3+71);var biasFromTypical=(typical-min)/Math.max(1,spread);var weighted=Math.pow(r1,1.4)*spread*(r2<biasFromTypical?-1:1);var age=Math.round(typical+weighted*0.6);return Math.max(min,Math.min(max,age))}
function _ageIsAberrantForCat(age,cat){if(age==null)return!1;var range=_categoryForAge(cat);return age<range.min||age>range.max+2}
function _ensureRivalDob(rival,idx){if(!G.pilot||!G.pilot.startYear)return rival.dob||null;var startYear=G.pilot.startYear;var currentYear=typeof gameYear==="function"?gameYear():startYear;var seed=0;var name=rival.name||"";for(var i=0;i<name.length;i++)seed=(seed*31+name.charCodeAt(i))|0;seed=Math.abs(seed);var cat=G.cat||"Formule 1";if(rival.dob){var currentAge=currentYear-rival.dob.year;if(!_ageIsAberrantForCat(currentAge,cat))return rival.dob}var ageAtCurrentYear=_generateRealisticAge(cat,seed);var birthYear=currentYear-ageAtCurrentYear;var month=1+(seed>>4)%12;var maxDay=[31,28,31,30,31,30,31,31,30,31,30,31][month-1];var day=1+((seed>>8)%maxDay);rival.dob={day:day,month:month,year:birthYear};return rival.dob}
function _ageFromDob(dob,gameYear){if(!dob||!gameYear)return null;var age=gameYear-dob.year;return age}
function _formatDob(dob){if(!dob)return"—";var months=["jan","fév","mar","avr","mai","juin","juil","août","sep","oct","nov","déc"];return dob.day+" "+months[dob.month-1]+". "+dob.year}
function _natFlag(nat){var flags={FR:"",GB:"",IT:"",ES:"",DE:"",NL:"",BE:"",PT:"",CH:"",AT:"",MC:"",FI:"",SE:"",DK:"",NO:"",PL:"",CZ:"",HU:"",RO:"",RU:"",US:"",CA:"",MX:"",BR:"",AR:"",AU:"",NZ:"",JP:"",CN:"",KR:"",IN:"",TH:"",ID:"",MY:"",SG:"",ZA:"",AE:"",SA:"",IL:"",TR:""};return flags[nat]||""}
function _natName(nat){var names={FR:"Français",GB:"Britannique",IT:"Italien",ES:"Espagnol",DE:"Allemand",NL:"Néerlandais",BE:"Belge",PT:"Portugais",CH:"Suisse",AT:"Autrichien",MC:"Monégasque",FI:"Finlandais",SE:"Suédois",DK:"Danois",NO:"Norvégien",PL:"Polonais",CZ:"Tchèque",HU:"Hongrois",RO:"Roumain",RU:"Russe",US:"Américain",CA:"Canadien",MX:"Mexicain",BR:"Brésilien",AR:"Argentin",AU:"Australien",NZ:"Néo-zélandais",JP:"Japonais",CN:"Chinois",KR:"Coréen",IN:"Indien",TH:"Thaïlandais",ID:"Indonésien",MY:"Malaisien",SG:"Singapourien",ZA:"Sud-africain",AE:"Émirati",SA:"Saoudien",IL:"Israélien",TR:"Turc"};return names[nat]||nat||"International"}
function getRivalRaceStats(rivalIdx){var stats={races:0,wins:0,podiums:0,top5:0,top10:0,poles:0,bestQuali:99,bestRace:99};if(!G.rivals||!G.rivals[rivalIdx])return stats;var rival=G.rivals[rivalIdx];if(rival.qualiHistory&&rival.qualiHistory.length){rival.qualiHistory.forEach(function(p){if(p&&p>0&&p<stats.bestQuali)stats.bestQuali=p;if(p===1)stats.poles++})}if(rival.raceHistory&&rival.raceHistory.length){rival.raceHistory.forEach(function(r){stats.races++;var pos=r.pos||r;if(typeof pos==="object")pos=pos.pos;if(typeof pos==="number"&&pos>0){if(pos===1)stats.wins++;if(pos<=3)stats.podiums++;if(pos<=5)stats.top5++;if(pos<=10)stats.top10++;if(pos<stats.bestRace)stats.bestRace=pos}})}if(stats.bestQuali===99)stats.bestQuali=null;if(stats.bestRace===99)stats.bestRace=null;return stats}
function closeDriverProfileModal(){var m=document.getElementById("driver-profile-modal");if(m)m.remove();document.removeEventListener("keydown",_driverProfileEscHandler)}
function _driverProfileEscHandler(e){if(e.key==="Escape")closeDriverProfileModal()}
var GE_CURRENT_TAB="pilot";var GE_SELECTED_RIVAL=null;var GE_SELECTED_TEAM=null;var GE_SELECTED_STAFF=null;
function openGameEditor(initialTab){if(!G.paddockPass){if("function"==typeof showAlertDialog)showAlertDialog({title:"Paddock Pass requis",message:"Active le Paddock Pass pour utiliser l'Éditeur en jeu.",variant:"info"});return}var modal=document.getElementById("game-editor-modal");if(!modal)return;modal.style.display="block";GE_SELECTED_RIVAL=null;GE_SELECTED_TEAM=null;GE_SELECTED_STAFF=null;geSwitchTab(initialTab||"pilot")}
function closeGameEditor(){var modal=document.getElementById("game-editor-modal");if(modal)modal.style.display="none"}
function geSwitchTab(tab){GE_CURRENT_TAB=tab;document.querySelectorAll(".ge-tab").forEach(function(b){var on=b.dataset.getab===tab;b.classList.toggle("on",on);b.style.borderBottomColor=on?"#A78BFA":"transparent";b.style.color=on?"#A78BFA":"var(--text3)"});var content=document.getElementById("ge-content");if(!content)return;if(tab==="pilot")content.innerHTML=geRenderPilotTab();else if(tab==="rivals")content.innerHTML=geRenderRivalsTab();else if(tab==="teams")content.innerHTML=geRenderTeamsTab();else if(tab==="staff")content.innerHTML=geRenderStaffTab();else if(tab==="agents")content.innerHTML=geRenderAgentsTab()}
function _geSafe(s){return typeof _ppEscSafe==="function"?_ppEscSafe(s):String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function _geNatOptions(selected){var nats=["FR","GB","IT","ES","DE","NL","BE","PT","CH","AT","MC","FI","SE","DK","NO","PL","CZ","HU","RO","RU","US","CA","MX","BR","AR","AU","NZ","JP","CN","KR","IN","TH","ID","MY","SG","ZA","AE","SA","IL","TR"];var html="";nats.forEach(function(n){html+='<option value="'+n+'"'+(selected===n?' selected':'')+'>'+(typeof _natFlag==="function"?_natFlag(n)+' ':'')+(typeof _natName==="function"?_natName(n):n)+'</option>'});return html}
function _geFieldRow(label,inputHtml){return '<div style="margin-bottom:10px"><div style="font-size:11px;color:var(--text2);margin-bottom:4px;font-weight:600">'+label+'</div>'+inputHtml+'</div>'}
function _geInputText(id,value){return '<input type="text" id="'+id+'" value="'+_geSafe(value||"")+'" style="width:100%;padding:8px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;box-sizing:border-box">'}
function _geInputNum(id,value,min,max,step){return '<input type="number" id="'+id+'" value="'+(value||0)+'" min="'+(min!=null?min:0)+'" max="'+(max!=null?max:99)+'" step="'+(step||1)+'" style="width:100%;padding:8px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;box-sizing:border-box">'}
function _geSelect(id,opts){return '<select id="'+id+'" style="width:100%;padding:8px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;box-sizing:border-box">'+opts+'</select>'}
function _geButton(label,onclick,variant){var bg=variant==="primary"?"linear-gradient(180deg,var(--red3) 0%,var(--red2) 100%)":"var(--surface2)";var color=variant==="primary"?"#fff":"var(--text)";var border=variant==="primary"?"none":"1px solid var(--border)";return '<button type="button" onclick="'+onclick+'" style="padding:9px 14px;background:'+bg+';color:'+color+';border:'+border+';border-radius:8px;font-family:var(--font-display);font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;cursor:pointer">'+label+'</button>'}
function _gePanel(content){return '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:10px">'+content+'</div>'}
function _geSectionTitle(t){return '<div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:var(--text3);letter-spacing:.14em;text-transform:uppercase;margin:6px 0 8px">'+t+'</div>'}
function geRenderPilotTab(){var p=G.pilot||{};var dob=p.dob||{day:1,month:1,year:(p.startYear||2024)-18};var months=[{v:1,l:"Janvier"},{v:2,l:"Février"},{v:3,l:"Mars"},{v:4,l:"Avril"},{v:5,l:"Mai"},{v:6,l:"Juin"},{v:7,l:"Juillet"},{v:8,l:"Août"},{v:9,l:"Septembre"},{v:10,l:"Octobre"},{v:11,l:"Novembre"},{v:12,l:"Décembre"}];var monthOpts=months.map(function(m){return '<option value="'+m.v+'"'+(dob.month===m.v?' selected':'')+'>'+m.l+'</option>'}).join("");var rating=typeof calcPlayerRating==="function"?calcPlayerRating():65;var ratingTier=typeof getRatingTier==="function"?getRatingTier(rating):{color:"#9CA3AF",tier:"—"};var html='<div style="background:linear-gradient(135deg,rgba(167,139,250,0.10),transparent);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:12px;display:flex;align-items:center;gap:12px"><div style="flex:1;min-width:0"><div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--text3);letter-spacing:.18em;text-transform:uppercase">Note globale</div><div style="font-size:11px;color:var(--text3);margin-top:2px">Calculée à partir des stats détaillées</div></div><div style="text-align:right"><div style="font-family:var(--font-display);font-size:28px;font-weight:900;color:'+ratingTier.color+';line-height:1">'+rating+'</div><div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:'+ratingTier.color+';letter-spacing:.10em;margin-top:2px">'+ratingTier.tier+'</div></div></div>';html+=_geSectionTitle("Identité");html+=_gePanel(_geFieldRow("Prénom",_geInputText("ge-pilot-prenom",p.prenom||""))+_geFieldRow("Nom",_geInputText("ge-pilot-nom",p.nom||""))+_geFieldRow("Nationalité",_geSelect("ge-pilot-nat",_geNatOptions(p.nat||"FR")))+'<div style="display:flex;gap:6px"><div style="flex:1">'+_geFieldRow("Jour",_geInputNum("ge-pilot-day",dob.day,1,31,1))+'</div><div style="flex:2">'+_geFieldRow("Mois",_geSelect("ge-pilot-month",monthOpts))+'</div><div style="flex:1.2">'+_geFieldRow("Année",_geInputNum("ge-pilot-year",dob.year,1960,2025,1))+'</div></div>'+_geFieldRow("Numéro de course",_geInputNum("ge-pilot-num",p.number||23,1,99,1)));html+=_geSectionTitle("Stats détaillées");var sub=G.substats||null;var phy=(G.stats&&G.stats.physique)||52;var statPoles=[{title:"Pôle vitesse",color:"#EF4444",stats:[{key:"vitesse_pure",label:"Vitesse pure",desc:"Vitesse en ligne droite et en virage rapide"},{key:"acceleration",label:"Accélération",desc:"Sortie de virage et relances"},{key:"reactivite",label:"Réactivité",desc:"Départs et réflexes en piste"}]},{title:"Pôle technique",color:"#F59E0B",stats:[{key:"freinage",label:"Freinage",desc:"Points de freinage et entrée de virage"},{key:"grip",label:"Adhérence (grip)",desc:"Maîtrise du grip et passage en courbe"},{key:"gestion_pneus",label:"Gestion pneus",desc:"Préservation et exploitation des gommes"}]},{title:"Pôle mental",color:"#A78BFA",stats:[{key:"concentration",label:"Concentration",desc:"Constance tour après tour"},{key:"decision",label:"Décision",desc:"Choix stratégiques en course"},{key:"pression",label:"Sangfroid (pression)",desc:"Performance dans les moments clés"}]},{title:"Physique",color:"#60A5FA",stats:[{key:"physique",label:"Physique",desc:"Endurance, fitness, longue distance"}]}];var statsHtml="";statPoles.forEach(function(pole,pIdx){statsHtml+='<div style="margin-bottom:'+(pIdx<statPoles.length-1?'14':'4')+'px"><div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:'+pole.color+';letter-spacing:.14em;text-transform:uppercase;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid '+pole.color+'33">'+pole.title+'</div>';pole.stats.forEach(function(s){var v;if(s.key==="physique")v=phy;else v=sub?(sub[s.key]||50):50;var pct=Math.round(100*Math.max(0,(v-35))/(99-35));statsHtml+='<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><div style="flex:1;min-width:0"><div style="font-size:12px;color:var(--text);font-weight:600">'+s.label+'</div><div style="font-size:10px;color:var(--text3);margin-top:1px">'+s.desc+'</div></div><div style="text-align:right;flex-shrink:0;margin-left:8px"><span style="font-family:var(--font-display);font-size:14px;font-weight:900;color:'+pole.color+'" id="ge-pilot-stat-display-'+s.key+'">'+v+'</span><span style="font-size:9px;color:var(--text3);margin-left:2px">/99</span></div></div><div style="height:5px;background:var(--bg3);border-radius:3px;overflow:hidden;margin-bottom:5px"><div id="ge-pilot-stat-bar-'+s.key+'" style="width:'+pct+'%;height:100%;background:'+pole.color+';transition:width .15s"></div></div><input type="range" id="ge-pilot-stat-'+s.key+'" min="35" max="99" step="1" value="'+v+'" oninput="_geUpdatePilotStatPreview(\''+s.key+'\',\''+pole.color+'\')" style="width:100%;cursor:pointer"></div>'});statsHtml+='</div>'});html+=_gePanel(statsHtml);html+=_geSectionTitle("Réputation");html+=_gePanel(_geFieldRow("Réputation globale (0-100)",_geInputNum("ge-pilot-rep",G.reputation||50,0,100,1)));html+='<div style="display:flex;gap:8px;margin-top:14px">'+_geButton("Enregistrer","gePilotSave()","primary")+_geButton("Annuler","closeGameEditor()")+'</div>';return html}
function _geUpdatePilotStatPreview(key,color){var input=document.getElementById("ge-pilot-stat-"+key);if(!input)return;var v=parseInt(input.value)||65;var disp=document.getElementById("ge-pilot-stat-display-"+key);var bar=document.getElementById("ge-pilot-stat-bar-"+key);if(disp)disp.textContent=v;if(bar){var pct=Math.round(100*(v-35)/(99-35));bar.style.width=pct+"%"}}
function gePilotSave(){var p=G.pilot=G.pilot||{};p.prenom=document.getElementById("ge-pilot-prenom").value.trim();p.nom=document.getElementById("ge-pilot-nom").value.trim();p.nat=document.getElementById("ge-pilot-nat").value;p.number=parseInt(document.getElementById("ge-pilot-num").value)||23;var d=parseInt(document.getElementById("ge-pilot-day").value)||1;var m=parseInt(document.getElementById("ge-pilot-month").value)||1;var y=parseInt(document.getElementById("ge-pilot-year").value)||2000;p.dob={day:Math.min(31,Math.max(1,d)),month:Math.min(12,Math.max(1,m)),year:y};if(typeof gameYear==="function")G.age=gameYear()-y;G.substats=G.substats||{};G.stats=G.stats||{};["vitesse_pure","acceleration","reactivite","freinage","grip","gestion_pneus","concentration","decision","pression"].forEach(function(k){var el=document.getElementById("ge-pilot-stat-"+k);if(el)G.substats[k]=Math.min(99,Math.max(35,parseInt(el.value)||50))});var phyEl=document.getElementById("ge-pilot-stat-physique");if(phyEl)G.stats.physique=Math.min(99,Math.max(35,parseInt(phyEl.value)||52));if(typeof computeLegacyStats==="function")try{computeLegacyStats()}catch(e){}G.reputation=Math.min(100,Math.max(0,parseInt(document.getElementById("ge-pilot-rep").value)||0));if("function"==typeof updateUI)try{updateUI()}catch(e){}if("function"==typeof showToast)showToast(" Pilote mis à jour");if("function"==typeof saveGame)try{saveGame()}catch(e){}geSwitchTab("pilot")}
function geRenderRivalsTab(){if(!G.rivals||G.rivals.length===0){return '<div style="padding:30px 16px;text-align:center;color:var(--text3);font-size:13px">Aucun rival pour le moment.</div>'+'<div style="text-align:center">'+_geButton("＋ Créer un rival","geCreateRival()","primary")+'</div>'}if(GE_SELECTED_RIVAL!==null&&GE_SELECTED_RIVAL>=0&&GE_SELECTED_RIVAL<G.rivals.length){return geRenderRivalDetail(GE_SELECTED_RIVAL)}var html=_geSectionTitle("Rivaux ("+G.rivals.length+")");html+='<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">';G.rivals.forEach(function(r,i){var rating=typeof calcRivalRating==="function"?calcRivalRating(r):65;var nat=typeof _natFlag==="function"?_natFlag(r.nat||"FR"):"";html+='<div onclick="geSelectRival('+i+')" style="cursor:pointer;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;display:flex;align-items:center;gap:10px"><span style="font-size:16px">'+nat+'</span><div style="flex:1;min-width:0"><div style="font-size:13px;color:var(--text);font-weight:600">'+_geSafe(r.name)+(r._custom?' <span style="color:var(--red3);font-size:9px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;margin-left:4px">CUSTOM</span>':'')+'</div><div style="font-size:11px;color:var(--text3);margin-top:1px">'+_geSafe(r.team||"Indépendant")+' · skill '+(r.skill||65)+'</div></div><span style="font-family:var(--font-display);font-size:14px;font-weight:800;color:'+(typeof getRatingTier==="function"?getRatingTier(rating).color:"var(--text)")+'">'+rating+'</span><span style="color:var(--text3);font-size:14px">›</span></div>'});html+='</div>';html+='<div style="text-align:center">'+_geButton("＋ Créer un rival","geCreateRival()","primary")+'</div>';return html}
function geSelectRival(i){GE_SELECTED_RIVAL=i;document.getElementById("ge-content").innerHTML=geRenderRivalsTab()}
function geRenderRivalDetail(idx){var r=G.rivals[idx];if(!r)return geRenderRivalsTab();if(typeof _ensureRivalDob==="function")_ensureRivalDob(r,idx);if(typeof _ensureRivalDetailedStats==="function")_ensureRivalDetailedStats(r);var dob=r.dob||{day:1,month:1,year:(G.pilot&&G.pilot.startYear||2024)-22};var months=[{v:1,l:"Jan"},{v:2,l:"Fév"},{v:3,l:"Mar"},{v:4,l:"Avr"},{v:5,l:"Mai"},{v:6,l:"Juin"},{v:7,l:"Juil"},{v:8,l:"Août"},{v:9,l:"Sep"},{v:10,l:"Oct"},{v:11,l:"Nov"},{v:12,l:"Déc"}];var monthOpts=months.map(function(m){return '<option value="'+m.v+'"'+(dob.month===m.v?' selected':'')+'>'+m.l+'</option>'}).join("");var nameParts=(r.name||"").split(" ");var prenom=nameParts.length>1?nameParts[0]:"";var nom=nameParts.length>1?nameParts.slice(1).join(" "):(r.name||"");var teamOpts='<option value="">— Indépendant —</option>';if(typeof TEAM_PRESTIGE!=="undefined"){var teamNames=Object.keys(TEAM_PRESTIGE).sort();teamNames.forEach(function(t){teamOpts+='<option value="'+_geSafe(t)+'"'+(r.team===t?' selected':'')+'>'+_geSafe(t)+'</option>'})}var ds=r.detailedStats||{vitesse:65,pneus:65,constance:65,physique:65,mental:65};var rating=typeof calcRivalRating==="function"?calcRivalRating(r):65;var ratingTier=typeof getRatingTier==="function"?getRatingTier(rating):{color:"#9CA3AF",tier:"—"};var html='<div style="margin-bottom:10px">'+_geButton("‹ Retour","GE_SELECTED_RIVAL=null;geSwitchTab(\'rivals\')")+'</div>';html+='<div style="background:linear-gradient(135deg,rgba(167,139,250,0.10),transparent);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:12px;display:flex;align-items:center;gap:12px"><div style="flex:1;min-width:0"><div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--text3);letter-spacing:.18em;text-transform:uppercase">Note globale</div><div style="font-size:11px;color:var(--text3);margin-top:2px">Calculée à partir des stats détaillées</div></div><div style="text-align:right"><div style="font-family:var(--font-display);font-size:28px;font-weight:900;color:'+ratingTier.color+';line-height:1">'+rating+'</div><div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:'+ratingTier.color+';letter-spacing:.10em;margin-top:2px">'+ratingTier.tier+'</div></div></div>';html+=_geSectionTitle("Identité");html+=_gePanel(_geFieldRow("Prénom",_geInputText("ge-rival-prenom",prenom))+_geFieldRow("Nom",_geInputText("ge-rival-nom",nom))+_geFieldRow("Nationalité",_geSelect("ge-rival-nat",_geNatOptions(r.nat||"FR")))+'<div style="display:flex;gap:6px"><div style="flex:1">'+_geFieldRow("Jour",_geInputNum("ge-rival-day",dob.day,1,31,1))+'</div><div style="flex:2">'+_geFieldRow("Mois",_geSelect("ge-rival-month",monthOpts))+'</div><div style="flex:1.2">'+_geFieldRow("Année",_geInputNum("ge-rival-year",dob.year,1960,2025,1))+'</div></div>'+_geFieldRow("Écurie",_geSelect("ge-rival-team",teamOpts)));html+=_geSectionTitle("Stats détaillées");var statPoles=[{title:"Pôle vitesse",color:"#EF4444",stats:[{key:"vitesse_pure",label:"Vitesse pure",desc:"Vitesse en ligne droite et en virage rapide"},{key:"acceleration",label:"Accélération",desc:"Sortie de virage et relances"},{key:"reactivite",label:"Réactivité",desc:"Départs et réflexes en piste"}]},{title:"Pôle technique",color:"#F59E0B",stats:[{key:"freinage",label:"Freinage",desc:"Points de freinage et entrée de virage"},{key:"grip",label:"Adhérence (grip)",desc:"Maîtrise du grip et passage en courbe"},{key:"gestion_pneus",label:"Gestion pneus",desc:"Préservation et exploitation des gommes"}]},{title:"Pôle mental",color:"#A78BFA",stats:[{key:"concentration",label:"Concentration",desc:"Constance tour après tour"},{key:"decision",label:"Décision",desc:"Choix stratégiques en course"},{key:"pression",label:"Sangfroid (pression)",desc:"Performance dans les moments clés"}]},{title:"Physique",color:"#60A5FA",stats:[{key:"physique",label:"Physique",desc:"Endurance, fitness, longue distance"}]}];var statsHtml="";statPoles.forEach(function(pole,pIdx){statsHtml+='<div style="margin-bottom:'+(pIdx<statPoles.length-1?'14':'4')+'px"><div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:'+pole.color+';letter-spacing:.14em;text-transform:uppercase;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid '+pole.color+'33">'+pole.title+'</div>';pole.stats.forEach(function(s){var v=ds[s.key]||65;var pct=Math.round(100*(v-35)/(99-35));statsHtml+='<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><div style="flex:1;min-width:0"><div style="font-size:12px;color:var(--text);font-weight:600">'+s.label+'</div><div style="font-size:10px;color:var(--text3);margin-top:1px">'+s.desc+'</div></div><div style="text-align:right;flex-shrink:0;margin-left:8px"><span style="font-family:var(--font-display);font-size:14px;font-weight:900;color:'+pole.color+'" id="ge-rival-stat-display-'+s.key+'">'+v+'</span><span style="font-size:9px;color:var(--text3);margin-left:2px">/99</span></div></div><div style="height:5px;background:var(--bg3);border-radius:3px;overflow:hidden;margin-bottom:5px"><div id="ge-rival-stat-bar-'+s.key+'" style="width:'+pct+'%;height:100%;background:'+pole.color+';transition:width .15s"></div></div><input type="range" id="ge-rival-stat-'+s.key+'" min="35" max="99" step="1" value="'+v+'" oninput="_geUpdateRivalStatPreview(\''+s.key+'\',\''+pole.color+'\')" style="width:100%;cursor:pointer"></div>'});statsHtml+='</div>'});html+=_gePanel(statsHtml);html+=_geSectionTitle("Potentiel (caché)");var potVal=r.pot||r.skill||80;var grVal=r.gr||0.8;var peakVal=r.peakAge||27;var ageVal=r.age||25;html+=_gePanel(_geFieldRow("Note potentielle max (pot)",_geInputNum("ge-rival-pot",potVal,50,99,1))+'<div style="font-size:10px;color:var(--text3);margin-top:-2px;margin-bottom:8px">Plafond personnel — son skill ne dépassera jamais ça.</div>'+_geFieldRow("Vitesse de progression (gr)",_geInputNum("ge-rival-gr",Math.round(grVal*100),50,150,5))+'<div style="font-size:10px;color:var(--text3);margin-top:-2px;margin-bottom:8px">% de vitesse — 50 = lent, 100 = normal, 150 = prodige.</div>'+_geFieldRow("Âge du pic (peakAge)",_geInputNum("ge-rival-peak",peakVal,20,35,1))+_geFieldRow("Âge actuel",_geInputNum("ge-rival-age",ageVal,12,42,1)));html+=_geSectionTitle("Saison");html+=_gePanel(_geFieldRow("Points championnat",_geInputNum("ge-rival-pts",r.pts||0,0,9999,1)));html+='<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">'+_geButton("Enregistrer","geRivalSave("+idx+")","primary")+_geButton("Annuler","GE_SELECTED_RIVAL=null;geSwitchTab(\'rivals\')")+(r._custom?_geButton("Supprimer","geRivalDelete("+idx+")"):'')+'</div>';return html}
function _geUpdateRivalStatPreview(key,color){var input=document.getElementById("ge-rival-stat-"+key);if(!input)return;var v=parseInt(input.value)||65;var disp=document.getElementById("ge-rival-stat-display-"+key);var bar=document.getElementById("ge-rival-stat-bar-"+key);if(disp)disp.textContent=v;if(bar){var pct=Math.round(100*(v-35)/(99-35));bar.style.width=pct+"%"}}
function geRivalSave(idx){var r=G.rivals[idx];if(!r)return;var prenom=document.getElementById("ge-rival-prenom").value.trim();var nom=document.getElementById("ge-rival-nom").value.trim();if(!prenom&&!nom){if(typeof showAlertDialog==="function")showAlertDialog({title:"Nom requis",message:"Au moins un nom ou prénom est requis.",variant:"warn"});return}r.name=(prenom+" "+nom).trim();r.nat=document.getElementById("ge-rival-nat").value;r.team=document.getElementById("ge-rival-team").value||null;var d=parseInt(document.getElementById("ge-rival-day").value)||1;var m=parseInt(document.getElementById("ge-rival-month").value)||1;var y=parseInt(document.getElementById("ge-rival-year").value)||2000;r.dob={day:Math.min(31,Math.max(1,d)),month:Math.min(12,Math.max(1,m)),year:y};r.detailedStats=r.detailedStats||{};["vitesse_pure","acceleration","reactivite","freinage","grip","gestion_pneus","concentration","decision","pression","physique"].forEach(function(k){var el=document.getElementById("ge-rival-stat-"+k);if(el)r.detailedStats[k]=Math.min(99,Math.max(35,parseInt(el.value)||65))});if(typeof _rivalSkillFromDetailedStats==="function")r.skill=_rivalSkillFromDetailedStats(r.detailedStats);if(typeof _rivalConsistencyFromDetailedStats==="function")r.consistency=_rivalConsistencyFromDetailedStats(r.detailedStats);var elPot=document.getElementById("ge-rival-pot");if(elPot)r.pot=Math.min(99,Math.max(50,parseInt(elPot.value)||80));var elGr=document.getElementById("ge-rival-gr");if(elGr)r.gr=Math.min(1.5,Math.max(0.5,(parseInt(elGr.value)||100)/100));var elPeak=document.getElementById("ge-rival-peak");if(elPeak)r.peakAge=Math.min(35,Math.max(20,parseInt(elPeak.value)||27));var elAge=document.getElementById("ge-rival-age");if(elAge)r.age=Math.min(42,Math.max(12,parseInt(elAge.value)||25));if(r.id&&G.driverPool&&G.driverPool[r.id]){var pd=G.driverPool[r.id];pd.pot=r.pot;pd.gr=r.gr;pd.peakAge=r.peakAge;pd.age=r.age;pd.skill=r.skill;pd.consistency=r.consistency}r.pts=Math.max(0,parseInt(document.getElementById("ge-rival-pts").value)||0);if("function"==typeof showToast)showToast(" Rival mis à jour");if("function"==typeof saveGame)try{saveGame()}catch(e){}GE_SELECTED_RIVAL=null;geSwitchTab("rivals")}
function geCreateRival(){if(!G.rivals)G.rivals=[];var nrName="Nouveau Rival "+(G.rivals.length+1);var nrId=("custom_"+Date.now().toString(36)+Math.random().toString(36).slice(2,5));var newRival={name:nrName,nat:"FR",pts:0,skill:65,consistency:0.75,lastPos:0,team:null,qualiHistory:[],raceHistory:[],_custom:!0,id:nrId,pot:80,gr:0.9,peakAge:27,age:22};if(G.driverPool)G.driverPool[nrId]={id:nrId,firstName:"Nouveau",lastName:"Rival",name:nrName,nat:"FR",skill:65,consistency:0.75,pot:80,gr:0.9,peakAge:27,age:22,cat:G.cat,team:null,retired:false,seasonsInCat:0,career:{wins:0,podiums:0,titles:0,seasons:0}};G.rivals.push(newRival);GE_SELECTED_RIVAL=G.rivals.length-1;geSwitchTab("rivals")}
function geRivalDelete(idx){if(typeof showConfirmDialog==="function"){showConfirmDialog({title:"Supprimer ce rival ?",message:"Cette action est irréversible.",confirmText:"Supprimer",cancelText:"Annuler",danger:!0,onConfirm:function(){G.rivals.splice(idx,1);GE_SELECTED_RIVAL=null;geSwitchTab("rivals")}})}}
function geRenderTeamsTab(){if(typeof TEAM_PRESTIGE==="undefined")return '<div style="padding:30px;text-align:center;color:var(--text3);font-size:13px">Données écuries indisponibles.</div>';if(GE_SELECTED_TEAM){return geRenderTeamDetail(GE_SELECTED_TEAM)}var teams=Object.keys(TEAM_PRESTIGE).sort(function(a,b){return TEAM_PRESTIGE[b]-TEAM_PRESTIGE[a]});var html=_geSectionTitle("Écuries ("+teams.length+")");html+='<div style="font-size:11px;color:var(--text3);margin-bottom:8px">Clique sur une écurie pour modifier son prestige.</div>';html+='<div style="display:flex;flex-direction:column;gap:4px">';teams.forEach(function(t){var prestige=TEAM_PRESTIGE[t];var color=prestige>=88?"#F59E0B":prestige>=80?"#34D399":prestige>=72?"#60A5FA":"#9CA3AF";var logo=(typeof TEAM_LOGOS!=="undefined"&&TEAM_LOGOS[t])?TEAM_LOGOS[t]:"";html+='<div onclick="geSelectTeam(\''+_geSafe(t).replace(/\047/g,"\\\047")+'\')" style="cursor:pointer;padding:8px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;display:flex;align-items:center;gap:10px">';if(logo)html+='<span style="display:inline-flex;width:20px;height:20px;border-radius:3px;overflow:hidden;flex-shrink:0">'+logo.replace(/width="40" height="40"/g,'width="20" height="20"')+'</span>';html+='<span style="flex:1;min-width:0;font-size:12px;color:var(--text)">'+_geSafe(t)+'</span>';html+='<span style="font-family:var(--font-display);font-size:13px;font-weight:800;color:'+color+'">'+prestige+'</span>';html+='<span style="color:var(--text3);font-size:13px">›</span></div>'});html+='</div>';return html}
function geSelectTeam(name){GE_SELECTED_TEAM=name;document.getElementById("ge-content").innerHTML=geRenderTeamsTab()}
function geRenderTeamDetail(name){var prestige=TEAM_PRESTIGE[name]||72;var html='<div style="margin-bottom:10px">'+_geButton("‹ Retour","GE_SELECTED_TEAM=null;geSwitchTab(\'teams\')")+'</div>';html+=_geSectionTitle(name);var teamCats=[];if(typeof getTeamActiveCategories==="function"){try{teamCats=getTeamActiveCategories(name).map(function(c){return c.cat}).filter(function(c,i,arr){return arr.indexOf(c)===i})}catch(e){}}html+=_gePanel('<div style="font-size:11px;color:var(--text3);margin-bottom:8px">Catégories actives</div><div style="font-size:12px;color:var(--text)">'+(teamCats.length>0?teamCats.join(" · "):"Aucune dans la saison actuelle")+'</div>');html+=_geSectionTitle("Identité");var safeName=(name||"").replace(/"/g,"&quot;");html+=_gePanel(_geFieldRow("Nom de l'écurie",'<input type="text" id="ge-team-name" value="'+safeName+'" maxlength="40" style="background:var(--surface2);border:1px solid var(--border);border-radius:5px;padding:6px 10px;color:var(--text);font-size:13px;font-family:var(--font-display);font-weight:600;width:100%;box-sizing:border-box">')+'<div style="font-size:10px;color:var(--text3);margin-top:6px">Renommer met à jour partout : grille, contrats, staff, sponsors, classement.</div>');html+=_geSectionTitle("Prestige");html+=_gePanel(_geFieldRow("Prestige (0-99)",_geInputNum("ge-team-prestige",prestige,0,99,1))+'<div style="font-size:10px;color:var(--text3);margin-top:6px">Le prestige influence les négociations, salaires et la qualité du recrutement.</div>');html+='<div style="display:flex;gap:8px;margin-top:14px">'+_geButton("Enregistrer","geTeamSave()","primary")+_geButton("Annuler","GE_SELECTED_TEAM=null;geSwitchTab(\'teams\')")+'</div>';return html}
function _geRenameTeam(oldName,newName){if(!oldName||!newName||oldName===newName)return;var renameKeyInDict=function(dict){if(!dict||typeof dict!=="object")return;if(Object.prototype.hasOwnProperty.call(dict,oldName)){dict[newName]=dict[oldName];try{delete dict[oldName]}catch(e){}}};if(typeof TEAM_PRESTIGE!=="undefined")renameKeyInDict(TEAM_PRESTIGE);if(typeof TEAM_LOGOS!=="undefined")renameKeyInDict(TEAM_LOGOS);if(typeof TEAM_RATINGS!=="undefined")renameKeyInDict(TEAM_RATINGS);if(typeof TEAMS_BY_CAT!=="undefined"){Object.keys(TEAMS_BY_CAT).forEach(function(cat){var arr=TEAMS_BY_CAT[cat];if(Array.isArray(arr)){for(var i=0;i<arr.length;i++)if(arr[i]===oldName)arr[i]=newName}})}if(typeof STAFF_BY_TEAM!=="undefined"){Object.keys(STAFF_BY_TEAM).forEach(function(cat){var byTeam=STAFF_BY_TEAM[cat];if(byTeam&&Object.prototype.hasOwnProperty.call(byTeam,oldName)){byTeam[newName]=byTeam[oldName];try{delete byTeam[oldName]}catch(e){}}})}if(window.G){if(G.currentTeam===oldName)G.currentTeam=newName;if(Array.isArray(G.rivals))G.rivals.forEach(function(r){if(r&&r.team===oldName)r.team=newName});if(G.driverPool&&typeof G.driverPool==="object")Object.keys(G.driverPool).forEach(function(id){var d=G.driverPool[id];if(d&&d.team===oldName)d.team=newName});if(Array.isArray(G.offers))G.offers.forEach(function(o){if(o&&o.team===oldName)o.team=newName});if(G.pendingTransfer&&G.pendingTransfer.team===oldName)G.pendingTransfer.team=newName;if(Array.isArray(G.sponsors))G.sponsors.forEach(function(s){if(s&&s.team===oldName)s.team=newName});if(Array.isArray(G.contacts))G.contacts.forEach(function(c){if(c&&c.team===oldName)c.team=newName});if(Array.isArray(G.races))G.races.forEach(function(r){if(r&&r.team===oldName)r.team=newName});if(Array.isArray(CAREER_HISTORY))CAREER_HISTORY.forEach(function(h){if(h&&h.team===oldName)h.team=newName;if(h&&h.constrChamp===oldName)h.constrChamp=newName})}if(window.PLAYER_ACADEMY){if(PLAYER_ACADEMY.f1Team===oldName)PLAYER_ACADEMY.f1Team=newName;if(Array.isArray(PLAYER_ACADEMY.f1Alt))for(var k=0;k<PLAYER_ACADEMY.f1Alt.length;k++)if(PLAYER_ACADEMY.f1Alt[k]===oldName)PLAYER_ACADEMY.f1Alt[k]=newName;if(PLAYER_ACADEMY.affiliates&&typeof PLAYER_ACADEMY.affiliates==="object"){Object.keys(PLAYER_ACADEMY.affiliates).forEach(function(catKey){var arr=PLAYER_ACADEMY.affiliates[catKey];if(Array.isArray(arr))for(var ii=0;ii<arr.length;ii++)if(arr[ii]===oldName)arr[ii]=newName})}}try{if(typeof updateUI==="function")updateUI()}catch(e){}}
function geTeamSave(){if(!GE_SELECTED_TEAM||typeof TEAM_PRESTIGE==="undefined")return;var oldName=GE_SELECTED_TEAM;var v=parseInt(document.getElementById("ge-team-prestige").value)||72;var nameInput=document.getElementById("ge-team-name");var newName=nameInput?String(nameInput.value||"").trim():oldName;if(!newName)newName=oldName;newName=newName.substring(0,40);TEAM_PRESTIGE[oldName]=Math.min(99,Math.max(0,v));var renamed=false;if(newName!==oldName){if(typeof _geRenameTeam==="function"){try{_geRenameTeam(oldName,newName);renamed=true;GE_SELECTED_TEAM=newName}catch(e){console.warn("[GE] _geRenameTeam failed:",e)}}}if("function"==typeof showToast){if(renamed)showToast(" Écurie renommée en « "+newName+" »");else showToast(" Prestige mis à jour")}GE_SELECTED_TEAM=null;geSwitchTab("teams")}
function geRenderStaffTab(){if(typeof STAFF_BY_TEAM==="undefined"||typeof STAFF_ROLES==="undefined")return '<div style="padding:30px;text-align:center;color:var(--text3);font-size:13px">Système staff indisponible.</div>';if(GE_SELECTED_STAFF){return geRenderStaffDetail(GE_SELECTED_STAFF)}var html=_geSectionTitle("Staff par catégorie/écurie");html+='<div style="font-size:11px;color:var(--text3);margin-bottom:10px">Le staff est généré automatiquement quand tu visites une écurie. Visite ou affronte une écurie pour voir son staff ici.</div>';var anyFound=!1;Object.keys(STAFF_BY_TEAM).forEach(function(cat){var teams=STAFF_BY_TEAM[cat];if(!teams)return;Object.keys(teams).forEach(function(teamName){var staff=teams[teamName];if(!staff)return;anyFound=!0;html+='<div style="margin-bottom:10px;border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--surface2)">';html+='<div style="padding:10px 12px;background:var(--bg3);font-size:12px;font-weight:700;color:var(--text);display:flex;justify-content:space-between"><span>'+_geSafe(teamName)+'</span><span style="color:var(--text3);font-size:10px;font-weight:500">'+_geSafe(cat)+'</span></div>';STAFF_ROLES.forEach(function(role){var m=staff[role.key];if(!m)return;html+='<div onclick="geSelectStaff(\''+_geSafe(cat)+'\',\''+_geSafe(teamName).replace(/\047/g,"\\\047")+'\',\''+role.key+'\')" style="cursor:pointer;padding:8px 12px;border-top:1px solid var(--border);display:flex;align-items:center;gap:8px"><span style="font-family:var(--font-display);font-size:9px;font-weight:800;color:'+role.color+';letter-spacing:.06em;text-transform:uppercase;min-width:60px">'+role.shortLabel+'</span><span style="flex:1;font-size:12px;color:var(--text)">'+_geSafe(m.name)+'</span><span style="font-family:var(--font-display);font-size:12px;font-weight:800;color:'+role.color+'">'+(m.rating||72)+'</span><span style="color:var(--text3)">›</span></div>'});html+='</div>'})});if(!anyFound)html+='<div style="padding:30px 16px;text-align:center;color:var(--text3);font-size:12px">Aucun staff initialisé. Visite une écurie pour générer son staff.</div>';return html}
function geSelectStaff(cat,team,roleKey){GE_SELECTED_STAFF={cat:cat,team:team,roleKey:roleKey};document.getElementById("ge-content").innerHTML=geRenderStaffTab()}
function geRenderStaffDetail(sel){var staff=STAFF_BY_TEAM[sel.cat]&&STAFF_BY_TEAM[sel.cat][sel.team]&&STAFF_BY_TEAM[sel.cat][sel.team][sel.roleKey];if(!staff)return geRenderStaffTab();var role=STAFF_ROLES.find(function(r){return r.key===sel.roleKey});var html='<div style="margin-bottom:10px">'+_geButton("‹ Retour","GE_SELECTED_STAFF=null;geSwitchTab(\'staff\')")+'</div>';html+=_geSectionTitle(role.label+" — "+sel.team+" ("+sel.cat+")");html+=_gePanel(_geFieldRow("Nom complet",_geInputText("ge-staff-name",staff.name||""))+_geFieldRow("Nationalité",_geSelect("ge-staff-nat",_geNatOptions(staff.nationality||"FR")))+_geFieldRow("Âge",_geInputNum("ge-staff-age",staff.age||45,18,80,1))+_geFieldRow("Note (rating) /99",_geInputNum("ge-staff-rating",staff.rating||72,40,99,1)));html+='<div style="display:flex;gap:8px;margin-top:14px">'+_geButton("Enregistrer","geStaffSave()","primary")+_geButton("Annuler","GE_SELECTED_STAFF=null;geSwitchTab(\'staff\')")+'</div>';return html}
function geStaffSave(){var sel=GE_SELECTED_STAFF;if(!sel)return;var staff=STAFF_BY_TEAM[sel.cat]&&STAFF_BY_TEAM[sel.cat][sel.team]&&STAFF_BY_TEAM[sel.cat][sel.team][sel.roleKey];if(!staff)return;staff.name=document.getElementById("ge-staff-name").value.trim()||staff.name;staff.nationality=document.getElementById("ge-staff-nat").value;staff.age=Math.min(80,Math.max(18,parseInt(document.getElementById("ge-staff-age").value)||45));staff.rating=Math.min(99,Math.max(40,parseInt(document.getElementById("ge-staff-rating").value)||72));if("function"==typeof showToast)showToast(" Staff mis à jour");GE_SELECTED_STAFF=null;geSwitchTab("staff")}
function geRenderAgentsTab(){var html=_geSectionTitle("Agent actuel");if(G.agent&&G.agent.type!=="parent"){var a=G.agent;html+=_gePanel('<div style="font-size:13px;color:var(--text);font-weight:600;margin-bottom:6px">'+_geSafe(a.name||a.firstName||"Agent")+'</div>'+'<div style="font-size:11px;color:var(--text3);margin-bottom:8px">'+_geSafe(a.archetype||"")+'</div>'+_geFieldRow("Compétence (skill) /99",_geInputNum("ge-agent-skill",a.skill||60,40,99,1))+_geFieldRow("Commission (%)",_geInputNum("ge-agent-comm",Math.round((a.commission||0.10)*100),1,30,1))+'<div style="display:flex;gap:8px;margin-top:8px">'+_geButton("Enregistrer agent","geAgentSave()","primary")+'</div>')}else if(G.agent&&G.agent.type==="parent"){html+=_gePanel('<div style="font-size:13px;color:var(--text);font-weight:600">Parent-agent</div><div style="font-size:11px;color:var(--text3);margin-top:4px">Ton parent gère ta carrière. Pas de skill modifiable.</div>')}else{html+=_gePanel('<div style="font-size:13px;color:var(--text3)">Aucun agent actuellement.</div>')}html+=_geSectionTitle("Pool d\'agents disponibles");if(typeof AGENT_POOL!=="undefined"){html+='<div style="display:flex;flex-direction:column;gap:6px">';AGENT_POOL.forEach(function(p,i){var color=p.color||"#9CA3AF";html+='<div style="padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div style="flex:1;min-width:0"><div style="font-size:13px;color:var(--text);font-weight:600">'+_geSafe(p.name)+'</div><div style="font-size:10px;color:var(--text3);margin-top:1px">'+_geSafe(p.archetype)+'</div></div><div style="text-align:right"><div style="font-family:var(--font-display);font-size:14px;font-weight:800;color:'+color+'">'+p.skill+'</div><div style="font-size:10px;color:var(--text3)">'+Math.round(p.commission*100)+'% commission</div></div></div>'+'<div style="display:flex;gap:6px;margin-top:8px">'+_geFieldRow("Skill",_geInputNum("ge-pool-"+i+"-skill",p.skill,40,99,1))+_geFieldRow("Commission %",_geInputNum("ge-pool-"+i+"-comm",Math.round(p.commission*100),1,30,1))+'</div>'+_geButton("Enregistrer","geAgentPoolSave("+i+")")+'</div>'});html+='</div>'}return html}
function geAgentSave(){if(!G.agent||G.agent.type==="parent")return;var sk=parseInt(document.getElementById("ge-agent-skill").value)||60;var cm=parseInt(document.getElementById("ge-agent-comm").value)||10;G.agent.skill=Math.min(99,Math.max(40,sk));G.agent.commission=Math.min(0.30,Math.max(0.01,cm/100));if("function"==typeof showToast)showToast("✓ Agent mis à jour");geSwitchTab("agents")}
function geAgentPoolSave(idx){if(typeof AGENT_POOL==="undefined"||!AGENT_POOL[idx])return;var sk=parseInt(document.getElementById("ge-pool-"+idx+"-skill").value)||60;var cm=parseInt(document.getElementById("ge-pool-"+idx+"-comm").value)||10;AGENT_POOL[idx].skill=Math.min(99,Math.max(40,sk));AGENT_POOL[idx].commission=Math.min(0.30,Math.max(0.01,cm/100));if("function"==typeof showToast)showToast("✓ Pool agent mis à jour");geSwitchTab("agents")}
function showDriverProfileModal(opts){if(!opts)return;var isPlayer=opts.type==="player";var rival=null,rivalIdx=-1;if(!isPlayer){if(typeof opts.idx==="number"){rivalIdx=opts.idx;rival=G.rivals?G.rivals[rivalIdx]:null}else if(opts.name){rivalIdx=(G.rivals||[]).findIndex(function(r){return r.name===opts.name});rival=rivalIdx>=0?G.rivals[rivalIdx]:null}if(!rival)return}var name,nat,team,dob,age,rating,skill,consistency,pts,lastPos;if(isPlayer){name=(G.pilot.prenom?G.pilot.prenom+" ":"")+(G.pilot.nom||"");nat=G.pilot.nat||"FR";team=G.currentTeam||"Indépendant";dob=G.pilot.dob||null;age=G.age||null;rating=typeof calcPlayerRating==="function"?calcPlayerRating():65;pts=G.champPts||0}else{if(typeof _ensureRivalDetailedStats==="function")_ensureRivalDetailedStats(rival);name=rival.name;nat=rival.nat||"FR";team=rival.team||"Indépendant";dob=_ensureRivalDob(rival,rivalIdx);age=dob?_ageFromDob(dob,gameYear()):null;rating=typeof calcRivalRating==="function"?calcRivalRating(rival):65;skill=rival.skill||65;consistency=rival.consistency||0.75;pts=rival.pts||0;lastPos=rival.lastPos||0}closeDriverProfileModal();var modal=document.createElement("div");modal.id="driver-profile-modal";modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:9991;display:flex;align-items:center;justify-content:center;padding:8px;backdrop-filter:blur(4px)";modal.addEventListener("click",function(e){if(e.target===modal)closeDriverProfileModal()});document.addEventListener("keydown",_driverProfileEscHandler);var safe=typeof _ppEscSafe==="function"?_ppEscSafe:function(s){return String(s||"")};var tier=typeof getRatingTier==="function"?getRatingTier(rating):{color:"#9CA3AF",tier:"—"};var teamLogo=(typeof TEAM_LOGOS!=="undefined"&&TEAM_LOGOS[team])?TEAM_LOGOS[team]:"";var nationName=_natName(nat);var flag=_natFlag(nat);var initials=name.split(" ").map(function(w){return w[0]||""}).join("").substring(0,2).toUpperCase();var standing=null;try{var allDrivers=[{name:(G.pilot.prenom?G.pilot.prenom+" ":"")+G.pilot.nom,pts:G.champPts,me:!0}].concat((G.rivals||[]).map(function(r){return{name:r.name,pts:r.pts,me:!1}}));allDrivers.sort(function(a,b){return b.pts-a.pts});if(isPlayer)standing=allDrivers.findIndex(function(d){return d.me})+1;else standing=allDrivers.findIndex(function(d){return d.name===name})+1}catch(e){}var rivalStats=null;if(!isPlayer&&rivalIdx>=0)rivalStats=getRivalRaceStats(rivalIdx);var ds=null;if(!isPlayer)ds=rival.detailedStats||null;var catShort=(G.cat||"—").replace("Formule ","F").replace("Formula Regional","FR").replace("Karting Junior","KJ").replace("Karting Senior","KS").replace("Super Formula","SF").replace("Endurance WEC","WEC");var ageCat=(typeof CAT_AGE_RANGES!=="undefined"&&G.cat&&CAT_AGE_RANGES[G.cat])?CAT_AGE_RANGES[G.cat]:null;var ageColor=ageCat&&age!=null?(age<ageCat.typical-2?"#60A5FA":age>ageCat.typical+4?"#F59E0B":"var(--text)"):"var(--text)";var html='<div style="background:var(--bg2);border:1px solid var(--red2);border-radius:14px;max-width:440px;width:100%;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,.7);overflow:hidden">';
html+='<div style="padding:12px 14px;background:linear-gradient(135deg,'+(isPlayer?"rgba(232,16,48,.12)":"rgba(96,165,250,.10)")+',transparent);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-shrink:0">';
html+='<div style="width:46px;height:46px;border-radius:12px;background:linear-gradient(135deg,'+(isPlayer?"#E81030":"#60A5FA")+',rgba(255,255,255,0.04));display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-size:17px;font-weight:900;color:#fff;flex-shrink:0;border:1px solid rgba(255,255,255,0.1)">'+initials+'</div>';
html+='<div style="flex:1;min-width:0">';
html+='<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:'+(isPlayer?"#FFD23F":"var(--red3)")+';letter-spacing:.20em;text-transform:uppercase;margin-bottom:1px">'+(isPlayer?"Toi":"Pilote")+'</div>';
html+='<div style="font-family:var(--font-display);font-size:16px;font-weight:900;color:var(--white);line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+safe(name)+'</div>';
html+='<div style="font-size:10.5px;color:var(--muted);margin-top:2px;display:flex;align-items:center;gap:5px;flex-wrap:wrap"><span style="font-size:13px">'+flag+'</span><span>'+nationName+'</span>';
if(age!==null)html+='<span style="opacity:0.5">·</span><span style="color:'+ageColor+';font-weight:600">'+age+' ans</span>';
html+='</div></div>';
html+='<div style="text-align:right;padding-right:6px"><div style="font-family:var(--font-display);font-size:24px;font-weight:900;color:'+tier.color+';line-height:1">'+rating+'</div><div style="font-family:var(--font-display);font-size:8.5px;font-weight:800;color:'+tier.color+';letter-spacing:.10em;text-transform:uppercase;margin-top:1px">'+tier.tier+'</div></div>';
if(G.paddockPass){var editArg=isPlayer?"player":(rivalIdx>=0?String(rivalIdx):'-1');html+='<button onclick="_editFromDriverProfile(\''+editArg+'\')" title="Éditer" style="background:linear-gradient(180deg,rgba(167,139,250,.18),rgba(167,139,250,.10));color:#A78BFA;border:1px solid rgba(167,139,250,.35);border-radius:8px;width:28px;height:28px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;padding:0"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4z"/></svg></button>'}
html+='<button onclick="closeDriverProfileModal()" style="background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:8px;width:28px;height:28px;font-size:16px;cursor:pointer;flex-shrink:0;line-height:1">×</button>';
html+='</div>';
html+='<div style="flex:1;overflow-y:auto;min-height:0">';
html+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;padding:10px 12px;border-bottom:1px solid var(--border)">';
html+='<div style="text-align:center;padding:7px 4px;background:var(--surface2);border-radius:7px"><div style="font-family:var(--font-display);font-size:17px;font-weight:900;color:var(--white)">'+(standing?"P"+standing:"—")+'</div><div style="font-size:8.5px;color:var(--muted);letter-spacing:.08em;text-transform:uppercase;margin-top:2px">Classement</div></div>';
html+='<div style="text-align:center;padding:7px 4px;background:var(--surface2);border-radius:7px"><div style="font-family:var(--font-display);font-size:17px;font-weight:900;color:var(--red3)">'+pts+'</div><div style="font-size:8.5px;color:var(--muted);letter-spacing:.08em;text-transform:uppercase;margin-top:2px">Points</div></div>';
html+='<div style="text-align:center;padding:7px 4px;background:var(--surface2);border-radius:7px"><div style="font-family:var(--font-display);font-size:17px;font-weight:900;color:var(--white)">'+catShort+'</div><div style="font-size:8.5px;color:var(--muted);letter-spacing:.08em;text-transform:uppercase;margin-top:2px">Catégorie</div></div>';
html+='</div>';
var hasSubstats=isPlayer?!!G.substats:(ds&&typeof ds.vitesse_pure==="number");
if(hasSubstats){var poles=[{title:"Vitesse",color:"#EF4444",keys:[["vitesse_pure","Pure"],["acceleration","Accél."],["reactivite","Réact."]]},{title:"Technique",color:"#F59E0B",keys:[["freinage","Freinage"],["grip","Grip"],["gestion_pneus","Pneus"]]},{title:"Mental",color:"#A78BFA",keys:[["concentration","Concent."],["decision","Décision"],["pression","Sangfroid"]]},{title:"Physique",color:"#60A5FA",keys:[["physique","Physique"]]}];
var src=isPlayer?G.substats:ds;var phyVal=isPlayer?(G.stats&&G.stats.physique||52):(ds.physique||52);
html+='<div style="padding:10px 12px;border-bottom:1px solid var(--border)">';
html+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
poles.forEach(function(p){
html+='<div style="background:var(--surface2);border:1px solid var(--border);border-left:2px solid '+p.color+';border-radius:7px;padding:7px 9px">';
html+='<div style="font-family:var(--font-display);font-size:8.5px;font-weight:800;color:'+p.color+';letter-spacing:.10em;text-transform:uppercase;margin-bottom:5px">'+p.title+'</div>';
p.keys.forEach(function(kv){var v;if(kv[0]==="physique")v=phyVal;else v=src[kv[0]]||0;var pct=Math.round(100*Math.max(0,(v-35))/(99-35));html+='<div style="margin-bottom:4px;last-child:margin-bottom:0"><div style="display:flex;justify-content:space-between;font-size:10px;line-height:1.2;margin-bottom:2px"><span style="color:var(--text2)">'+kv[1]+'</span><strong style="color:'+p.color+';font-family:var(--font-display);font-size:11px">'+v+'</strong></div><div style="height:3px;background:var(--bg3);border-radius:2px;overflow:hidden"><div style="width:'+pct+'%;height:100%;background:'+p.color+'"></div></div></div>'});
html+='</div>'});
html+='</div></div>'}
else if(!isPlayer&&typeof skill==="number"){html+='<div style="padding:10px 12px;border-bottom:1px solid var(--border)"><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';var sRows=[{l:"Talent",v:skill,c:skill>=85?"#34D399":skill>=70?"#60A5FA":"var(--text)",max:99},{l:"Régularité",v:Math.round(consistency*100),c:consistency>=0.85?"#34D399":consistency>=0.70?"#60A5FA":"var(--text)",max:100}];sRows.forEach(function(r){var pct=Math.round(100*r.v/r.max);html+='<div style="background:var(--surface2);border-radius:7px;padding:8px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px"><span style="color:var(--text2)">'+r.l+'</span><strong style="color:'+r.c+'">'+r.v+'</strong></div><div style="height:4px;background:var(--bg3);border-radius:2px;overflow:hidden"><div style="width:'+pct+'%;height:100%;background:'+r.c+'"></div></div></div>'});html+='</div></div>'}
html+='<div style="padding:8px 12px;border-bottom:1px solid var(--border);display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px">';
html+='<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0"><span style="color:var(--text3);font-size:10px">Né le</span><strong style="color:var(--text);font-size:11px">'+_formatDob(dob)+'</strong></div>';
html+='<div style="display:flex;align-items:center;gap:5px;justify-content:flex-end;padding:3px 0">';
if(teamLogo)html+='<span style="display:inline-flex;width:14px;height:14px;border-radius:2px;overflow:hidden;flex-shrink:0">'+teamLogo.replace(/width="40" height="40"/g,'width="14" height="14"')+'</span>';
html+='<strong style="color:var(--text);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px" title="'+safe(team)+'">'+safe(team)+'</strong>';
html+='</div></div>';
if(rivalStats&&rivalStats.races>0){html+='<div style="padding:9px 12px;border-bottom:1px solid var(--border)"><div style="font-family:var(--font-display);font-size:8.5px;font-weight:800;color:var(--muted);letter-spacing:.14em;text-transform:uppercase;margin-bottom:6px">Saison en cours</div>';html+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;font-size:10.5px;text-align:center">';var sboxes=[{l:"C",v:rivalStats.races,c:"var(--text)"},{l:"V",v:rivalStats.wins,c:"#FFD23F"},{l:"P",v:rivalStats.podiums,c:"#34D399"},{l:"Pole",v:rivalStats.poles,c:"#A78BFA"}];sboxes.forEach(function(b){html+='<div style="padding:5px 4px;background:var(--surface2);border-radius:6px"><div style="font-family:var(--font-display);font-size:14px;font-weight:900;color:'+b.c+';line-height:1">'+b.v+'</div><div style="font-size:8.5px;color:var(--muted);text-transform:uppercase;margin-top:2px;letter-spacing:.06em">'+b.l+'</div></div>'});html+='</div>';if(rivalStats.bestQuali||rivalStats.bestRace){html+='<div style="display:flex;gap:10px;font-size:10px;color:var(--text2);margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">';if(rivalStats.bestQuali)html+='<span>🏁 Quali <strong style="color:var(--text)">P'+rivalStats.bestQuali+'</strong></span>';if(rivalStats.bestRace)html+='<span>🏆 Course <strong style="color:var(--text)">P'+rivalStats.bestRace+'</strong></span>';html+='</div>'}html+='</div>'}
if(isPlayer&&typeof CAREER_HISTORY!=="undefined"&&CAREER_HISTORY.length>0){var totalRaces=CAREER_HISTORY.reduce(function(a,s){return a+(s.races||0)},0);var totalWins=CAREER_HISTORY.reduce(function(a,s){return a+(s.wins||0)},0);var totalPods=CAREER_HISTORY.reduce(function(a,s){return a+(s.pods||0)},0);var titles=CAREER_HISTORY.filter(function(s){return s.pos===1}).length;if(totalRaces>0){html+='<div style="padding:9px 12px;border-bottom:1px solid var(--border)"><div style="font-family:var(--font-display);font-size:8.5px;font-weight:800;color:var(--muted);letter-spacing:.14em;text-transform:uppercase;margin-bottom:6px">Palmarès</div>';html+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;text-align:center">';var palBoxes=[{l:"Saisons",v:CAREER_HISTORY.length,c:"var(--text)"},{l:"Titres",v:titles,c:"#FFD23F"},{l:"Vict.",v:totalWins,c:"#FFD23F"},{l:"Podiums",v:totalPods,c:"#34D399"}];palBoxes.forEach(function(b){html+='<div style="padding:5px 4px;background:var(--surface2);border-radius:6px"><div style="font-family:var(--font-display);font-size:14px;font-weight:900;color:'+b.c+';line-height:1">'+b.v+'</div><div style="font-size:8.5px;color:var(--muted);text-transform:uppercase;margin-top:2px;letter-spacing:.06em">'+b.l+'</div></div>'});html+='</div></div>'}html+='<div style="padding:9px 12px"><div style="font-family:var(--font-display);font-size:8.5px;font-weight:800;color:var(--muted);letter-spacing:.14em;text-transform:uppercase;margin-bottom:6px">Carrière (3 dernières)</div>';CAREER_HISTORY.slice(-3).reverse().forEach(function(s){var startY=G.pilot.startYear||2024;var year=startY+(s.saison-1);var posColor=s.pos===1?"#FFD23F":s.pos<=3?"#34D399":s.pos<=10?"var(--text)":"var(--muted)";html+='<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 8px;background:var(--surface2);border-radius:6px;margin-bottom:4px;font-size:11px">';html+='<div style="flex:1;min-width:0;overflow:hidden"><div style="color:var(--text);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+year+' · '+safe(s.cat)+'</div><div style="font-size:9.5px;color:var(--muted);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+safe(s.team||"")+'</div></div>';html+='<div style="text-align:right;flex-shrink:0;margin-left:8px"><span style="font-family:var(--font-display);font-weight:800;color:'+posColor+'">P'+(s.pos||"—")+'</span><div style="font-size:9.5px;color:var(--muted);margin-top:1px">'+(s.wins||0)+'V·'+(s.pods||0)+'P</div></div>';html+='</div>'});html+='</div>'}
html+='</div></div>';
modal.innerHTML=html;document.body.appendChild(modal)}
function _openDriverProfileFromChamp(rankIdx){try{var all=[{name:(G.pilot.prenom?G.pilot.prenom+" ":"")+G.pilot.nom,pts:G.champPts,me:!0}].concat((G.rivals||[]).map(function(r){return{name:r.name,pts:r.pts,me:!1}}));all.sort(function(a,b){return b.pts-a.pts});var d=all[rankIdx];if(!d)return;if(d.me)showDriverProfileModal({type:"player"});else showDriverProfileModal({type:"rival",name:d.name})}catch(e){}}
function _buildHouseKeepingSectionHTML(){var html='<div style="margin:0 0 18px;border:1px solid rgba(168,85,247,0.30);border-radius:12px;background:linear-gradient(180deg,rgba(168,85,247,0.06),transparent);overflow:hidden">';html+='<div style="padding:11px 13px;background:linear-gradient(135deg,rgba(168,85,247,0.14),transparent);border-bottom:1px solid rgba(168,85,247,0.20);display:flex;align-items:center;gap:9px">';html+='<div style="width:30px;height:30px;border-radius:8px;background:rgba(168,85,247,0.18);color:#A855F7;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg></div>';html+='<div style="flex:1;min-width:0"><div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:#A855F7;letter-spacing:.20em;text-transform:uppercase;line-height:1.1">HouseKeeping</div></div></div>';html+='<div style="padding:11px 13px"><div style="display:flex;gap:6px"><input type="text" id="hk-code-input" placeholder="ENTRER LE CODE" maxlength="20" style="flex:1;padding:9px 11px;background:var(--bg2);border:1px solid var(--border-hi);border-radius:7px;color:var(--text);font-family:var(--font-display);font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;text-align:center;box-sizing:border-box" onkeydown="if(event.key===\'Enter\')_tryCodeInline()">';html+='<button onclick="_tryCodeInline()" style="padding:9px 14px;background:linear-gradient(180deg,#A855F7 0%,#8b3fd9 100%);color:#fff;border:none;border-radius:7px;font-family:var(--font-display);font-size:10.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;flex-shrink:0">Activer</button></div></div></div>';return html}
function _tryCodeInline(){var input=document.getElementById("hk-code-input");if(!input)return;var code=input.value.trim().toUpperCase();if(!code)return;if(!SECRET_CODES[code]){input.value="";return}var cd=SECRET_CODES[code];G._unlockedCodes=G._unlockedCodes||{};G._unlockedCodes[code]={activated:!0,saison:G.saison||1,week:G.semaine||1};try{cd.apply()}catch(e){}input.value="";if("function"==typeof saveGame)try{saveGame()}catch(e){}if("function"==typeof updateUI)try{updateUI()}catch(e){}}
function _editFromDriverProfile(arg){if(!G.paddockPass)return;closeDriverProfileModal();if(arg==="player")showQuickDriverEditor({type:"player"});else{var idx=parseInt(arg);if(!isNaN(idx)&&idx>=0&&G.rivals&&G.rivals[idx])showQuickDriverEditor({type:"rival",idx:idx})}}
function closeQuickDriverEditor(){var m=document.getElementById("quick-driver-editor");if(m)m.remove();document.removeEventListener("keydown",_quickEditorEscHandler)}
function _quickEditorEscHandler(e){if(e.key==="Escape")closeQuickDriverEditor()}
var SECRET_CODES={MAXSPEED:{name:"Vitesse maximale",icon:"",desc:"Toutes les stats du pilote passent à 99",color:"#EF4444",apply:function(){if(!G.substats)G.substats={};["vitesse_pure","acceleration","reactivite","freinage","grip","gestion_pneus","concentration","decision","pression"].forEach(function(k){G.substats[k]=99});if(G.stats)G.stats.physique=99;if("function"==typeof computeLegacyStats)try{computeLegacyStats()}catch(e){}return"Stats portées à 99"}},MONEYRAIN:{name:"Pluie d'argent",icon:"💰",desc:"+1 000 000 € au budget",color:"#34D399",apply:function(){G.budget=(G.budget||0)+1e6;return"+1 000 000 € ajoutés"}},LEGEND:{name:"Statut de légende",icon:"👑",desc:"Réputation 100 partout",color:"#A855F7",apply:function(){G.reputation=100;if(G.rep)["medias","public","recruteurs","paddock"].forEach(function(k){G.rep[k]=100});return"Réputation maximale"}},GHOST:{name:"Mode admin",icon:"🛡",desc:"Paddock Pass activé + immunité abandons",color:"#60A5FA",apply:function(){G.paddockPass=!0;G._adminMode=!0;G._noDnf=!0;return"Mode admin activé — Paddock Pass + immunité DNF"}},RAINBOW:{name:"Accomplissements",icon:"🏆",desc:"Tous les accomplissements débloqués",color:"#F0B41E",apply:function(){if(typeof ACHIEVEMENTS!=="undefined"&&Array.isArray(ACHIEVEMENTS)){G._unlockedAchievements=G._unlockedAchievements||{};ACHIEVEMENTS.forEach(function(a){G._unlockedAchievements[a.id]={saison:G.saison||1,week:G.semaine||1,gameYear:(typeof gameYear==="function"?gameYear():(G.gameYear||(G.pilot&&G.pilot.startYear?G.pilot.startYear+((G.saison||1)-1):0)))}});return ACHIEVEMENTS.length+" achievements débloqués"}return"Système achievements indisponible"}},STARLIGHT:{name:"Étoiles concurrentes",icon:"🌟",desc:"Tous les rivaux passent à skill 99",color:"#A78BFA",apply:function(){if(!G.rivals||!G.rivals.length)return"Pas de rivaux à booster";G.rivals.forEach(function(r){r.skill=99;r.consistency=0.95;if(r.detailedStats){["vitesse_pure","acceleration","reactivite","freinage","grip","gestion_pneus","concentration","decision","pression","physique"].forEach(function(k){r.detailedStats[k]=99})}});return G.rivals.length+" rivaux dopés au max"}},IRONMAN:{name:"Endurance infinie",icon:"💪",desc:"Énergie & PA au maximum",color:"#F59E0B",apply:function(){G.pa=10;G._maxPa=10;G.energy=100;G.fitness=100;return"Énergie illimitée"}},GOAT:{name:"Le plus grand de tous",icon:"🐐",desc:"Bonus immédiat : 5 victoires + 1 podium ajoutés à la saison",color:"#A855F7",apply:function(){if(!G.races)G.races=[];for(var i=0;i<5;i++)G.races.push({nom:"Bonus GOAT "+(i+1),pos:1,pts:25,qualiPos:1,pole:!0,circuit:"Cheat Track",weather:"dry",saison:G.saison||1,cat:G.cat||"Formule 1"});G.races.push({nom:"Bonus podium GOAT",pos:2,pts:18,qualiPos:1,circuit:"Cheat Track",weather:"dry",saison:G.saison||1,cat:G.cat||"Formule 1"});G.champPts=(G.champPts||0)+5*25+18;return"5 victoires + 1 podium ajoutés"}},KONAMI:{name:"Code Konami",icon:"🎮",desc:"Easter egg — fait pleuvoir des emojis",color:"#EC4899",apply:function(){_konamiRain();return"🎉 Drapeau magique activé"}}};
function _konamiRain(){var emojis=["🏎","🏁","🏆","⚡","🌟","🎉","🇫🇷","🇮🇹","🇬🇧","🇪🇸","🥇"];for(var i=0;i<40;i++){(function(idx){setTimeout(function(){var e=document.createElement("div");e.textContent=emojis[Math.floor(Math.random()*emojis.length)];e.style.cssText="position:fixed;top:-40px;left:"+Math.random()*100+"vw;font-size:"+(20+Math.random()*30)+"px;z-index:99999;pointer-events:none;transition:transform 3.5s linear,opacity 3.5s ease-out;opacity:1";document.body.appendChild(e);requestAnimationFrame(function(){e.style.transform="translateY(110vh) rotate("+(Math.random()*720-360)+"deg)";e.style.opacity="0"});setTimeout(function(){e.remove()},3700)},idx*70)})(i)}}
var SECRET_TAP_COUNT=0;var SECRET_TAP_TIMER=null;
function _registerSecretTap(){SECRET_TAP_COUNT++;if(SECRET_TAP_TIMER)clearTimeout(SECRET_TAP_TIMER);SECRET_TAP_TIMER=setTimeout(function(){SECRET_TAP_COUNT=0},1500);if(SECRET_TAP_COUNT>=10){SECRET_TAP_COUNT=0;clearTimeout(SECRET_TAP_TIMER);if(!G._houseKeepingUnlocked){G._houseKeepingUnlocked=!0;if("function"==typeof saveGame)try{saveGame()}catch(e){}}}}
function showCodesMenu(){var existing=document.getElementById("codes-menu-modal");if(existing)existing.remove();var modal=document.createElement("div");modal.id="codes-menu-modal";modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:99990;display:flex;align-items:center;justify-content:center;padding:8px;backdrop-filter:blur(8px)";modal.addEventListener("click",function(e){if(e.target===modal)closeCodesMenu()});var unlocked=G._unlockedCodes||{};var unlockedCount=Object.keys(unlocked).length;var totalCount=Object.keys(SECRET_CODES).length;var html='<div style="background:linear-gradient(180deg,#0d0410 0%,#080208 100%);border:1px solid #A855F7;border-radius:16px;max-width:440px;width:100%;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 0 80px rgba(168,85,247,0.35),0 10px 40px rgba(0,0,0,0.85);overflow:hidden">';html+='<div style="padding:14px 16px;background:linear-gradient(135deg,rgba(168,85,247,0.20),rgba(232,16,48,0.10),transparent);border-bottom:1px solid rgba(168,85,247,0.30);display:flex;align-items:center;gap:10px;flex-shrink:0">';html+='<div style="width:36px;height:36px;border-radius:10px;background:rgba(168,85,247,0.18);color:#A855F7;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:20px"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg></div>';html+='<div style="flex:1;min-width:0"><div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:#A855F7;letter-spacing:.22em;text-transform:uppercase;margin-bottom:1px">Menu secret</div><div style="font-family:var(--font-display);font-size:15px;font-weight:900;color:var(--white);line-height:1.15">Codes de déverrouillage</div><div style="font-size:10.5px;color:var(--text3);margin-top:2px">'+unlockedCount+' / '+totalCount+' codes activés</div></div>';html+='<button onclick="closeCodesMenu()" style="background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:8px;width:30px;height:30px;font-size:16px;cursor:pointer;flex-shrink:0;line-height:1">×</button></div>';html+='<div style="padding:14px;flex-shrink:0;border-bottom:1px solid var(--border);background:var(--bg3)"><div style="font-size:11px;color:var(--text3);margin-bottom:6px;text-align:center">Saisis un code secret</div>';html+='<div style="display:flex;gap:6px"><input type="text" id="code-input" placeholder="ENTRER LE CODE" maxlength="20" style="flex:1;padding:10px 12px;background:var(--bg2);border:1px solid var(--border-hi);border-radius:8px;color:var(--text);font-family:var(--font-display);font-size:13px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;text-align:center;box-sizing:border-box" onkeydown="if(event.key===\'Enter\')_tryCode()">';html+='<button onclick="_tryCode()" style="padding:10px 16px;background:linear-gradient(180deg,#A855F7 0%,#8b3fd9 100%);color:#fff;border:none;border-radius:8px;font-family:var(--font-display);font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;flex-shrink:0">Activer</button></div>';html+='<div id="code-feedback" style="margin-top:8px;font-size:11px;color:var(--text3);text-align:center;min-height:14px"></div></div>';html+='<div style="flex:1;overflow-y:auto;padding:10px 14px;min-height:0">';html+='<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--text3);letter-spacing:.16em;text-transform:uppercase;margin-bottom:8px">Liste des effets</div>';html+='<div style="display:flex;flex-direction:column;gap:6px">';Object.keys(SECRET_CODES).forEach(function(key){var c=SECRET_CODES[key];var isUnlocked=!!unlocked[key];var displayKey=isUnlocked?key:key.replace(/[A-Z0-9]/g,"·");html+='<div style="background:'+(isUnlocked?"rgba(168,85,247,0.10)":"var(--surface2)")+';border:1px solid '+(isUnlocked?"rgba(168,85,247,0.35)":"var(--border)")+';border-left:3px solid '+(isUnlocked?c.color:"var(--border)")+';border-radius:8px;padding:9px 11px;display:flex;align-items:center;gap:10px;opacity:'+(isUnlocked?"1":"0.7")+'">';html+='<div style="font-size:20px;flex-shrink:0;'+(isUnlocked?"":"filter:grayscale(1)")+'">'+(isUnlocked?c.icon:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>')+'</div>';html+='<div style="flex:1;min-width:0">';html+='<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="font-family:var(--font-display);font-size:11px;font-weight:800;color:'+(isUnlocked?c.color:"var(--text3)")+';letter-spacing:.10em;text-transform:uppercase">'+displayKey+'</span></div>';html+='<div style="font-size:11px;color:var(--text);font-weight:600;margin-top:2px">'+c.name+'</div>';html+='<div style="font-size:10px;color:var(--text3);margin-top:1px">'+(isUnlocked?c.desc:"???")+'</div>';html+='</div></div>'});html+='</div></div></div>';modal.innerHTML=html;document.body.appendChild(modal);setTimeout(function(){var inp=document.getElementById("code-input");if(inp)inp.focus()},100)}
function closeCodesMenu(){var m=document.getElementById("codes-menu-modal");if(m)m.remove()}
function _tryCode(){var input=document.getElementById("code-input");if(!input)return;var code=input.value.trim().toUpperCase();var feedback=document.getElementById("code-feedback");if(!code){if(feedback){feedback.textContent="Saisis un code";feedback.style.color="var(--text3)"}return}if(!SECRET_CODES[code]){if(feedback){feedback.textContent="Code incorrect";feedback.style.color="#EF4444"}input.value="";return}var cd=SECRET_CODES[code];G._unlockedCodes=G._unlockedCodes||{};var alreadyUnlocked=!!G._unlockedCodes[code];G._unlockedCodes[code]={activated:!0,saison:G.saison||1,week:G.semaine||1};var msg="";try{msg=cd.apply()||""}catch(e){msg="Erreur appliquant le code"}if(feedback){feedback.innerHTML='<span style="color:'+cd.color+';font-weight:700">'+cd.icon+' '+cd.name+'</span><br><span style="color:var(--text2);font-size:10px">'+msg+'</span>';feedback.style.color=cd.color}input.value="";if("function"==typeof saveGame)try{saveGame()}catch(e){}setTimeout(function(){var m=document.getElementById("codes-menu-modal");if(m)showCodesMenu()},1200);if("function"==typeof updateUI)try{updateUI()}catch(e){}}
function showQuickDriverEditor(opts){if(!opts)return;var isPlayer=opts.type==="player";var rival=null,rivalIdx=-1;if(!isPlayer){rivalIdx=opts.idx;rival=G.rivals?G.rivals[rivalIdx]:null;if(!rival)return}closeQuickDriverEditor();if(!isPlayer&&typeof _ensureRivalDetailedStats==="function")_ensureRivalDetailedStats(rival);if(!isPlayer&&typeof _ensureRivalDob==="function")_ensureRivalDob(rival,rivalIdx);var modal=document.createElement("div");modal.id="quick-driver-editor";modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9992;display:flex;align-items:center;justify-content:center;padding:8px;backdrop-filter:blur(5px)";modal.addEventListener("click",function(e){if(e.target===modal)closeQuickDriverEditor()});document.addEventListener("keydown",_quickEditorEscHandler);var safe=typeof _ppEscSafe==="function"?_ppEscSafe:function(s){return String(s||"")};var name,nat,team,dob,number,sub,phy;if(isPlayer){name=(G.pilot.prenom?G.pilot.prenom+" ":"")+(G.pilot.nom||"");nat=G.pilot.nat||"FR";team=G.currentTeam||"Indépendant";dob=G.pilot.dob||{day:1,month:1,year:(G.pilot.startYear||2024)-18};number=G.pilot.number||23;sub=G.substats||{};phy=(G.stats&&G.stats.physique)||52}else{name=rival.name||"";nat=rival.nat||"FR";team=rival.team||"";dob=rival.dob||{day:1,month:1,year:(G.pilot&&G.pilot.startYear||2024)-22};number=rival.number||0;sub=rival.detailedStats||{};phy=(rival.detailedStats&&rival.detailedStats.physique)||52}var nameParts=name.split(" ");var prenom=isPlayer?(G.pilot.prenom||""):(nameParts.length>1?nameParts[0]:"");var nom=isPlayer?(G.pilot.nom||""):(nameParts.length>1?nameParts.slice(1).join(" "):name);var months=[{v:1,l:"Jan"},{v:2,l:"Fév"},{v:3,l:"Mar"},{v:4,l:"Avr"},{v:5,l:"Mai"},{v:6,l:"Juin"},{v:7,l:"Juil"},{v:8,l:"Août"},{v:9,l:"Sep"},{v:10,l:"Oct"},{v:11,l:"Nov"},{v:12,l:"Déc"}];var monthOpts=months.map(function(m){return '<option value="'+m.v+'"'+(dob.month===m.v?' selected':'')+'>'+m.l+'</option>'}).join("");var nats=["FR","GB","IT","ES","DE","NL","BE","PT","CH","AT","MC","FI","SE","DK","NO","PL","CZ","HU","RO","RU","US","CA","MX","BR","AR","AU","NZ","JP","CN","KR","IN","TH","ID","MY","SG","ZA","AE","SA","IL","TR"];var natOpts=nats.map(function(n){return '<option value="'+n+'"'+(nat===n?' selected':'')+'>'+(typeof _natFlag==="function"?_natFlag(n)+' ':'')+(typeof _natName==="function"?_natName(n):n)+'</option>'}).join("");var teamOpts='<option value="">— Indépendant —</option>';if(typeof TEAM_PRESTIGE!=="undefined"){var teamNames=Object.keys(TEAM_PRESTIGE).sort();teamNames.forEach(function(t){teamOpts+='<option value="'+safe(t)+'"'+(team===t?' selected':'')+'>'+safe(t)+'</option>'})}var html='<div style="background:var(--bg2);border:1px solid #A78BFA;border-radius:14px;max-width:440px;width:100%;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,.7),0 0 32px rgba(167,139,250,.18);overflow:hidden">';
html+='<div style="padding:12px 14px;background:linear-gradient(135deg,rgba(167,139,250,.16),transparent);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-shrink:0">';
html+='<div style="width:32px;height:32px;border-radius:8px;background:rgba(167,139,250,.18);color:#A78BFA;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4z"/></svg></div>';
html+='<div style="flex:1;min-width:0"><div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:#A78BFA;letter-spacing:.20em;text-transform:uppercase;margin-bottom:1px">Édition rapide</div><div style="font-family:var(--font-display);font-size:14px;font-weight:800;color:var(--white);line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+safe(name||"Nouveau pilote")+'</div></div>';
html+='<button onclick="closeQuickDriverEditor()" style="background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:8px;width:28px;height:28px;font-size:16px;cursor:pointer;flex-shrink:0;line-height:1">×</button>';
html+='</div>';
html+='<div style="flex:1;overflow-y:auto;padding:12px 14px;min-height:0">';
html+='<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--text3);letter-spacing:.16em;text-transform:uppercase;margin-bottom:6px">Identité</div>';
html+='<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:12px">';
html+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">';
html+='<div><label style="font-size:10px;color:var(--text3);font-weight:600;display:block;margin-bottom:3px">Prénom</label><input type="text" id="qe-prenom" value="'+safe(prenom)+'" style="width:100%;padding:6px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:12px;box-sizing:border-box"></div>';
html+='<div><label style="font-size:10px;color:var(--text3);font-weight:600;display:block;margin-bottom:3px">Nom</label><input type="text" id="qe-nom" value="'+safe(nom)+'" style="width:100%;padding:6px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:12px;box-sizing:border-box"></div>';
html+='</div>';
html+='<div style="margin-bottom:6px"><label style="font-size:10px;color:var(--text3);font-weight:600;display:block;margin-bottom:3px">Nationalité</label><select id="qe-nat" style="width:100%;padding:6px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:12px;box-sizing:border-box">'+natOpts+'</select></div>';
html+='<div style="display:grid;grid-template-columns:1fr 1.4fr 1.1fr;gap:6px;margin-bottom:6px">';
html+='<div><label style="font-size:10px;color:var(--text3);font-weight:600;display:block;margin-bottom:3px">Jour</label><input type="number" id="qe-day" value="'+dob.day+'" min="1" max="31" style="width:100%;padding:6px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:12px;box-sizing:border-box"></div>';
html+='<div><label style="font-size:10px;color:var(--text3);font-weight:600;display:block;margin-bottom:3px">Mois</label><select id="qe-month" style="width:100%;padding:6px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:12px;box-sizing:border-box">'+monthOpts+'</select></div>';
html+='<div><label style="font-size:10px;color:var(--text3);font-weight:600;display:block;margin-bottom:3px">Année</label><input type="number" id="qe-year" value="'+dob.year+'" min="1960" max="2025" style="width:100%;padding:6px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:12px;box-sizing:border-box"></div>';
html+='</div>';
if(!isPlayer)html+='<div><label style="font-size:10px;color:var(--text3);font-weight:600;display:block;margin-bottom:3px">Écurie</label><select id="qe-team" style="width:100%;padding:6px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:12px;box-sizing:border-box">'+teamOpts+'</select></div>';
else html+='<div><label style="font-size:10px;color:var(--text3);font-weight:600;display:block;margin-bottom:3px">Numéro</label><input type="number" id="qe-num" value="'+number+'" min="1" max="99" style="width:100%;padding:6px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:12px;box-sizing:border-box"></div>';
html+='</div>';
html+='<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--text3);letter-spacing:.16em;text-transform:uppercase;margin-bottom:6px">Stats détaillées</div>';
var poles=[{title:"Vitesse",color:"#EF4444",keys:[["vitesse_pure","Pure"],["acceleration","Accél."],["reactivite","Réact."]]},{title:"Technique",color:"#F59E0B",keys:[["freinage","Freinage"],["grip","Grip"],["gestion_pneus","Pneus"]]},{title:"Mental",color:"#A78BFA",keys:[["concentration","Concent."],["decision","Décision"],["pression","Sangfroid"]]},{title:"Physique",color:"#60A5FA",keys:[["physique","Physique"]]}];
html+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">';
poles.forEach(function(p){
html+='<div style="background:var(--surface2);border:1px solid var(--border);border-left:2px solid '+p.color+';border-radius:7px;padding:8px 9px">';
html+='<div style="font-family:var(--font-display);font-size:8.5px;font-weight:800;color:'+p.color+';letter-spacing:.10em;text-transform:uppercase;margin-bottom:6px">'+p.title+'</div>';
p.keys.forEach(function(kv){var v;if(kv[0]==="physique")v=phy;else v=sub[kv[0]]||50;var pct=Math.round(100*Math.max(0,(v-35))/(99-35));html+='<div style="margin-bottom:6px"><div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;line-height:1.2;margin-bottom:3px"><span style="color:var(--text2)">'+kv[1]+'</span><strong style="color:'+p.color+';font-family:var(--font-display);font-size:11px" id="qe-disp-'+kv[0]+'">'+v+'</strong></div><div style="height:3px;background:var(--bg3);border-radius:2px;overflow:hidden;margin-bottom:3px"><div id="qe-bar-'+kv[0]+'" style="width:'+pct+'%;height:100%;background:'+p.color+'"></div></div><input type="range" id="qe-stat-'+kv[0]+'" min="35" max="99" step="1" value="'+v+'" oninput="_qeUpdate(\''+kv[0]+'\',\''+p.color+'\')" style="width:100%;cursor:pointer;height:14px"></div>'});
html+='</div>'});
html+='</div>';
html+='</div>';
html+='<div style="flex-shrink:0;padding:10px 14px;border-top:1px solid var(--border);background:var(--bg3);display:flex;gap:8px">';
html+='<button onclick="_qeSave(\''+(isPlayer?"player":String(rivalIdx))+'\')" style="flex:2;padding:10px 14px;background:linear-gradient(180deg,#A78BFA 0%,#8b6ee8 100%);color:#fff;border:none;border-radius:8px;font-family:var(--font-display);font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;cursor:pointer">Enregistrer</button>';
html+='<button onclick="closeQuickDriverEditor()" style="flex:1;padding:10px 14px;background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:8px;font-family:var(--font-display);font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;cursor:pointer">Annuler</button>';
html+='</div>';
html+='</div>';
modal.innerHTML=html;document.body.appendChild(modal)}
function _qeUpdate(key,color){var input=document.getElementById("qe-stat-"+key);if(!input)return;var v=parseInt(input.value)||50;var disp=document.getElementById("qe-disp-"+key);var bar=document.getElementById("qe-bar-"+key);if(disp)disp.textContent=v;if(bar){var pct=Math.round(100*(v-35)/(99-35));bar.style.width=pct+"%"}}
function _qeSave(target){var isPlayer=target==="player";var prenom=document.getElementById("qe-prenom").value.trim();var nom=document.getElementById("qe-nom").value.trim();if(!prenom&&!nom){if(typeof showAlertDialog==="function")showAlertDialog({title:"Nom requis",message:"Au moins un nom ou prénom est requis.",variant:"warn"});return}var nat=document.getElementById("qe-nat").value;var d=parseInt(document.getElementById("qe-day").value)||1;var m=parseInt(document.getElementById("qe-month").value)||1;var y=parseInt(document.getElementById("qe-year").value)||2000;var dob={day:Math.min(31,Math.max(1,d)),month:Math.min(12,Math.max(1,m)),year:y};var keys=["vitesse_pure","acceleration","reactivite","freinage","grip","gestion_pneus","concentration","decision","pression"];var newSub={};keys.forEach(function(k){var el=document.getElementById("qe-stat-"+k);if(el)newSub[k]=Math.min(99,Math.max(35,parseInt(el.value)||50))});var phyEl=document.getElementById("qe-stat-physique");var phyVal=phyEl?Math.min(99,Math.max(35,parseInt(phyEl.value)||52)):52;if(isPlayer){G.pilot=G.pilot||{};G.pilot.prenom=prenom;G.pilot.nom=nom;G.pilot.nat=nat;G.pilot.dob=dob;if(typeof gameYear==="function")G.age=gameYear()-y;var numEl=document.getElementById("qe-num");if(numEl)G.pilot.number=parseInt(numEl.value)||23;G.substats=G.substats||{};Object.assign(G.substats,newSub);G.stats=G.stats||{};G.stats.physique=phyVal;if(typeof computeLegacyStats==="function")try{computeLegacyStats()}catch(e){}if(typeof updateUI==="function")try{updateUI()}catch(e){}}else{var idx=parseInt(target);var r=G.rivals&&G.rivals[idx];if(!r){closeQuickDriverEditor();return}r.name=(prenom+" "+nom).trim();r.nat=nat;r.dob=dob;var teamEl=document.getElementById("qe-team");if(teamEl)r.team=teamEl.value||null;r.detailedStats=r.detailedStats||{};Object.assign(r.detailedStats,newSub);r.detailedStats.physique=phyVal;if(typeof _rivalSkillFromDetailedStats==="function")r.skill=_rivalSkillFromDetailedStats(r.detailedStats);if(typeof _rivalConsistencyFromDetailedStats==="function")r.consistency=_rivalConsistencyFromDetailedStats(r.detailedStats)}if(typeof showToast==="function")showToast(" Modifications enregistrées");if(typeof saveGame==="function")try{saveGame()}catch(e){}closeQuickDriverEditor();if(isPlayer)setTimeout(function(){showDriverProfileModal({type:"player"})},80);else setTimeout(function(){showDriverProfileModal({type:"rival",idx:parseInt(target)})},80)}

function showTeamProfileModal(e){if(e){var t=getTeamActiveCategories(e);t.forEach(function(e){"function"==typeof _initTeamStaff&&_initTeamStaff(e.cat,e.teamName)});var r=document.getElementById("team-profile-modal");r||((r=document.createElement("div")).id="team-profile-modal",r.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:9991;display:flex;align-items:flex-start;justify-content:center;padding:12px;backdrop-filter:blur(4px);overflow-y:auto",document.body.appendChild(r));var n=TEAM_GROUPS[e],a=TEAM_LOGOS[e]||"",i="function"==typeof getTeamPrestige?getTeamPrestige(e):72,o=i>=88?"#F59E0B":i>=80?"#34D399":i>=72?"#60A5FA":"#9CA3AF",s=_getConstructorsStanding(G.cat),l=s.findIndex(function(t){return t.team===e}),c=l>=0?l+1:null,d=l>=0?s[l].pts:0,p=getTeamDrivers(e,G.cat),u=getTeamAffiliatedAcademies(e),f=TEAM_CHAMPIONSHIPS[e]||[];n&&Object.keys(TEAM_CHAMPIONSHIPS).forEach(function(t){t!==e&&TEAM_GROUPS[t]===n&&(f=f.concat(TEAM_CHAMPIONSHIPS[t]))});var m=f.filter(function(e){return"constructors"===e.type}).length,g=f.filter(function(e){return"drivers"===e.type}).length,h="function"==typeof getRecentStaffMoves?getRecentStaffMoves(e,G.cat,4):[],v=[];t.forEach(function(t){var r=t.cat+(t.teamName!==e?" ("+t.teamName+")":"");v.indexOf(r)<0&&v.push(r)});var x='<div style="background:var(--bg2);border:1px solid var(--red2);border-radius:14px;max-width:460px;width:100%;margin:auto;box-shadow:0 10px 40px rgba(0,0,0,.7);overflow:hidden">';if(x+='<div style="padding:16px;border-bottom:1px solid var(--border);background:linear-gradient(135deg,rgba(232,16,48,.08),transparent);display:flex;align-items:center;gap:12px">',a&&(x+='<div style="width:48px;height:48px;border-radius:10px;overflow:hidden;flex-shrink:0;border:1px solid var(--border)">'+a.replace(/width="40" height="40"/g,'width="48" height="48"')+"</div>"),x+='<div style="flex:1;min-width:0">',x+='<div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:var(--red3);letter-spacing:.22em;text-transform:uppercase;margin-bottom:2px">Écurie</div>',x+='<div style="font-family:var(--font-display);font-size:18px;font-weight:900;color:var(--white);line-height:1.1">'+e+"</div>",v.length>0&&(x+='<div style="font-size:10.5px;color:var(--muted);margin-top:3px;line-height:1.3">'+v.slice(0,3).join(" · ")+(v.length>3?" +"+(v.length-3):"")+"</div>"),x+="</div>",x+='<div style="text-align:right">',x+='<div style="font-family:var(--font-display);font-size:24px;font-weight:900;color:'+o+';line-height:1">'+i+"</div>",x+='<div style="font-family:var(--font-display);font-size:9px;font-weight:700;color:var(--muted);letter-spacing:.14em;text-transform:uppercase;margin-top:2px">Prestige</div>',x+="</div>",x+='<button onclick="closeTeamProfileModal()" style="background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:8px;width:30px;height:30px;font-size:16px;cursor:pointer;margin-left:6px">×</button>',x+="</div>",x+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:12px 14px;border-bottom:1px solid var(--border)">',x+='<div style="text-align:center;padding:8px;background:var(--surface2);border-radius:8px">',x+='<div style="font-family:var(--font-display);font-size:19px;font-weight:900;color:var(--white)">'+(c?"P"+c:"—")+"</div>",x+='<div style="font-size:9.5px;color:var(--muted);letter-spacing:.1em;text-transform:uppercase;margin-top:3px">Constructeurs</div>',x+="</div>",x+='<div style="text-align:center;padding:8px;background:var(--surface2);border-radius:8px">',x+='<div style="font-family:var(--font-display);font-size:19px;font-weight:900;color:#F59E0B">'+m+"</div>",x+='<div style="font-size:9.5px;color:var(--muted);letter-spacing:.1em;text-transform:uppercase;margin-top:3px">Titres équipe</div>',x+="</div>",x+='<div style="text-align:center;padding:8px;background:var(--surface2);border-radius:8px">',x+='<div style="font-family:var(--font-display);font-size:19px;font-weight:900;color:#F59E0B">'+g+"</div>",x+='<div style="font-size:9.5px;color:var(--muted);letter-spacing:.1em;text-transform:uppercase;margin-top:3px">Titres pilote</div>',x+="</div>",x+="</div>",x+='<div style="padding:10px 0 0;border-bottom:1px solid var(--border)">',x+='<div style="padding:0 14px 8px;font-family:var(--font-display);font-size:10px;font-weight:800;color:var(--muted);letter-spacing:.14em;text-transform:uppercase">Staff</div>',"function"==typeof renderStaffPanel&&(x+=renderStaffPanel(e,G.cat)),x+="</div>",p.length>0&&(x+='<div style="padding:10px 14px;border-bottom:1px solid var(--border)">',x+='<div style="padding-bottom:8px;font-family:var(--font-display);font-size:10px;font-weight:800;color:var(--muted);letter-spacing:.14em;text-transform:uppercase">Pilotes · '+G.cat+"</div>",p.forEach(function(e){var t=e.rating>=85?"#34D399":e.rating>=75?"#60A5FA":e.rating>=65?"#F59E0B":"#9CA3AF";x+='<div style="padding:8px 0;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border);'+(e.me?"background:rgba(232,16,48,.04)":"")+'">',x+='<div style="font-size:13px;color:var(--text);flex:1;font-weight:'+(e.me?"800":"600")+'">'+e.name+(e.me?' <span style="font-size:9.5px;color:var(--red3);margin-left:4px">▶ toi</span>':"")+"</div>",x+='<div style="font-family:var(--font-display);font-size:13px;font-weight:900;color:'+t+';min-width:26px;text-align:right">'+e.rating+"</div>",x+='<div style="font-size:11px;color:var(--text3);min-width:50px;text-align:right">'+e.pts+" pts</div>",x+="</div>"}),x+="</div>"),u.length>0&&(x+='<div style="padding:10px 14px;border-bottom:1px solid var(--border)">',x+='<div style="padding-bottom:8px;font-family:var(--font-display);font-size:10px;font-weight:800;color:var(--muted);letter-spacing:.14em;text-transform:uppercase">Académies affiliées</div>',u.slice(0,5).forEach(function(e){x+='<div style="padding:7px 0;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border)">',x+='<div style="width:26px;height:26px;border-radius:5px;overflow:hidden;flex-shrink:0;background:var(--surface2);display:flex;align-items:center;justify-content:center">'+(e.data.logo||"").replace(/width="44" height="44"/g,'width="26" height="26"')+"</div>",x+='<div style="flex:1;font-size:12px;color:var(--text);font-weight:600">'+e.name+"</div>",x+='<div style="font-size:10px;color:var(--muted);font-style:italic">'+e.via+"</div>",x+="</div>"}),x+="</div>"),f.length>0){var y=f.filter(function(e){return"historique"===e.saison}),b=f.filter(function(e){return"historique"!==e.saison}),A={};y.forEach(function(e){A[e.cat]||(A[e.cat]={constructors:0,drivers:0}),A[e.cat][e.type]=(A[e.cat][e.type]||0)+1});var w=Object.keys(A);if(x+='<div style="padding:10px 14px;border-bottom:1px solid var(--border)">',x+='<div style="padding-bottom:8px;font-family:var(--font-display);font-size:10px;font-weight:800;color:var(--muted);letter-spacing:.14em;text-transform:uppercase">Palmarès</div>',w.length>0){var M=["Formule 1","Formule 2","Formule 3","Formula Regional","Formule 4","IndyCar","Endurance WEC","Super Formula","Karting Senior","Karting Junior"];w.sort(function(e,t){return M.indexOf(e)-M.indexOf(t)}),w.forEach(function(e){var t=A[e],r=[];t.constructors>0&&r.push(t.constructors+" titre"+(t.constructors>1?"s":"")+" équipe"),t.drivers>0&&r.push(t.drivers+" titre"+(t.drivers>1?"s":"")+" pilote"),0!==r.length&&(x+='<div style="padding:5px 0;font-size:12px;color:var(--text2);line-height:1.4;display:flex;gap:8px;align-items:center"><span style="font-family:var(--font-display);font-size:9px;font-weight:800;color:#F59E0B;background:rgba(245,158,11,.12);padding:2px 6px;border-radius:3px;letter-spacing:.08em;text-transform:uppercase;flex-shrink:0">Hist.</span><span style="color:var(--muted);flex-shrink:0">'+e+" ·</span><span>"+r.join(" · ")+"</span></div>")})}if(b.length>0){var E=b.slice().sort(function(e,t){return(t.saison||0)-(e.saison||0)}).slice(0,6);w.length>0&&(x+='<div style="height:1px;background:var(--border);margin:8px 0"></div>'),E.forEach(function(e){var t="constructors"===e.type?"":"",r="constructors"===e.type?"Titre constructeurs":"Titre pilote"+(e.driverName&&"—"!==e.driverName&&"Simulé"!==e.driverName?" ("+e.driverName+")":"");x+='<div style="padding:5px 0;font-size:12px;color:var(--text2);line-height:1.4">'+t+' <span style="color:var(--muted)">Saison '+e.saison+" · "+e.cat+" ·</span> "+r+"</div>"})}x+="</div>"}h.length>0&&(x+='<div style="padding:10px 14px">',x+='<div style="padding-bottom:8px;font-family:var(--font-display);font-size:10px;font-weight:800;color:var(--muted);letter-spacing:.14em;text-transform:uppercase">Mouvements récents</div>',h.forEach(function(e){var t="fired"===e.type?"":"hired"===e.type?"":"poached"===e.type?"":"retirement"===e.type?"":"";x+='<div style="font-size:12px;color:var(--text2);line-height:1.4;padding:3px 0">'+t+" "+e.text+"</div>"}),x+="</div>"),x+='<div style="height:10px"></div>',x+="</div>",r.innerHTML=x,r.style.display="flex",r.scrollTop=0}}function closeTeamProfileModal(){var e=document.getElementById("team-profile-modal");e&&e.parentNode&&e.parentNode.removeChild(e)}var _origStartNextSeason=startNextSeason;startNextSeason=function(e){MD_STATE.usedThisSeason=!1;try{"function"==typeof recordSeasonChampions&&recordSeasonChampions(G.cat,G.saison)}catch(e){console.warn("record champions:",e)}try{"function"==typeof runSimulatedChampionsForOtherCats&&runSimulatedChampionsForOtherCats(G.cat,G.saison)}catch(e){console.warn("simulated champs:",e)}try{"function"==typeof evolveTeamPrestige&&evolveTeamPrestige(G.saison)}catch(e){console.warn("prestige evolve:",e)}try{"function"==typeof runStaffMercato&&runStaffMercato()}catch(e){console.warn("staff mercato:",e)}_origStartNextSeason(e);try{"function"==typeof ensureStaffInitialized&&ensureStaffInitialized()}catch(e){}};

/* === SYSTÈME D'ÉVÉNEMENTS NARRATIFS SPONSORS === */
var SPONSOR_EVENT_DEFS=[
{id:"factory_visit",title:"Invitation à l'usine",icon:"factory",cooldown:24,minSponsors:1,
 contextFn:function(s){return s.name+" t'invite à visiter leur usine et rencontrer leurs équipes. Une journée entière à serrer des mains et à parler boutique.";},
 choices:[
  {text:"J'y vais à fond — visite complète, dîner avec les dirigeants",effects:{rep:{pad:2,med:1},budget:0,note:"Tu as fait forte impression. Le sponsor est ravi de l'engagement.",sponsorBonus:{months:6,fee:0.10}}},
  {text:"Je passe une heure en mode VIP, photo et je file",effects:{rep:{pub:1,pad:-1},note:"Le sponsor sent que tu as expédié l'affaire. Pas catastrophique, mais pas idéal."}},
  {text:"Je décline poliment — je suis en plein training",effects:{rep:{pad:-3,rec:-1},note:"Mauvaise décision. Le sponsor n'apprécie pas, leur équipe se sent dévalorisée."}}
 ]},
{id:"image_shoot",title:"Shooting publicitaire",icon:"camera",cooldown:20,minSponsors:1,
 contextFn:function(s){return s.name+" planifie une grosse campagne pub pour la nouvelle saison. Le brief : 3 jours de tournage avec un réalisateur reconnu.";},
 choices:[
  {text:"Je joue le jeu à fond — toutes les scènes demandées",effects:{rep:{med:3,pub:2},budget:50000,note:"Campagne réussie, tu as gagné en visibilité grand public.",sponsorBonus:{fee:0.15}}},
  {text:"J'accepte mais refuse certaines scènes (déguisements, gimmicks)",effects:{rep:{med:1,pub:-1,pad:1},note:"Compromis trouvé. Tu protèges ton image, le sponsor s'adapte."}},
  {text:"Je refuse — ce n'est pas dans mes contrats",effects:{rep:{med:-2,pad:1},note:"Tu as gardé ton intégrité, mais le sponsor est mécontent.",sponsorBonus:{fee:-0.10}}}
 ]},
{id:"brand_conflict",title:"Conflit de marque",icon:"warning",cooldown:32,minSponsors:2,
 contextFn:function(s,allSponsors){var other=allSponsors.find(function(x){return x.id!==s.id;});var name2=other?other.name:"un autre sponsor";return s.name+" exige l'exclusivité dans son secteur ("+s.type+"). Problème : ton contrat avec "+name2+" pourrait poser souci. Le manager des partenariats te demande une réunion d'urgence.";},
 choices:[
  {text:"Je négocie un avenant pour cohabiter — discussion à 3",effects:{rep:{pad:3,rec:2},budget:-15000,note:"Tu as géré la crise comme un pro. Les deux sponsors restent."}},
  {text:"Je choisis "+'"$primary"'+" et romps avec l'autre",effects:{rep:{pad:1,rec:1},note:"Décision claire. Le sponsor principal apprécie ta loyauté.",dropOtherSponsor:!0}},
  {text:"J'ignore et je continue comme avant",effects:{rep:{pad:-4,rec:-3},note:"Erreur. "+'"$primary"'+" se sent trahi et menace de partir.",sponsorBonus:{fee:-0.20}}}
 ]},
{id:"charity_request",title:"Demande caritative",icon:"heart",cooldown:30,minSponsors:1,
 contextFn:function(s){return s.name+" lance un programme caritatif et te demande d'en être ambassadeur. Visite d'hôpital pédiatrique, événement caritatif, dons de matériel.";},
 choices:[
  {text:"Je m'engage pleinement — c'est important pour moi",effects:{rep:{pub:4,pad:2,med:2},budget:-5000,note:"Tu as touché les fans. Image très positive, sponsor enchanté.",sponsorBonus:{fee:0.08}}},
  {text:"Je donne 1 jour pour la photo officielle",effects:{rep:{pub:1,med:1},note:"Présence symbolique. Personne ne se plaint, mais c'est fade."}},
  {text:"Je décline — pas le temps",effects:{rep:{pub:-3,med:-2,pad:-1},note:"Très mal vu. Les fans en parlent, ton image en prend un coup."}}
 ]},
{id:"vip_event",title:"Événement VIP",icon:"star",cooldown:20,minSponsors:1,
 contextFn:function(s){return s.name+" t'invite à une soirée privée à "+["Monaco","Londres","Genève","Dubaï","Milan"][Math.floor(Math.random()*5)]+". Clients haut de gamme, dirigeants. Cocktail, dîner, networking.";},
 choices:[
  {text:"J'y vais et je travaille la salle — relations publiques",effects:{rep:{pad:3,rec:3,pub:1},note:"Tu as charmé l'audience. Plusieurs contacts utiles.",networkBonus:!0}},
  {text:"Je viens, mais reste discret en mode pro",effects:{rep:{pad:1,rec:1},note:"Présence honorable, sans plus."}},
  {text:"Je préfère me concentrer sur ma préparation physique",effects:{rep:{pad:-2,rec:-1},note:"Le sponsor comprend mais aurait préféré te voir."}}
 ]},
{id:"social_post_demand",title:"Demande publication réseaux",icon:"phone",cooldown:14,minSponsors:1,
 contextFn:function(s){return s.name+" te demande de publier 5 posts sponsorisés cette semaine sur tes réseaux. Le contrat le permet, mais tes followers vont le sentir.";},
 choices:[
  {text:"OK, je le fais comme demandé",effects:{rep:{med:2,pub:-2},budget:8000,note:"Le sponsor est content, mais tes fans ont moins apprécié."}},
  {text:"Je négocie 2 posts au lieu de 5, plus authentiques",effects:{rep:{med:1,pub:1,pad:1},budget:3000,note:"Compromis intelligent. Tout le monde y trouve son compte."}},
  {text:"Je refuse — je ne veux pas spammer mes followers",effects:{rep:{pub:2,pad:-2,med:-1},note:"Tes fans t'aiment encore plus. Le sponsor moins.",sponsorBonus:{fee:-0.05}}}
 ]},
{id:"contract_renewal",title:"Renouvellement anticipé",icon:"refresh",cooldown:40,minSponsors:1,sponsorMinWeeks:24,
 contextFn:function(s){return s.name+" propose de renouveler ton contrat 6 mois avant la fin. Ils sont contents de la collaboration, mais veulent un meilleur deal.";},
 choices:[
  {text:"J'accepte — sécurité avant tout",effects:{rep:{rec:1},note:"Contrat prolongé, mais aux conditions actuelles.",sponsorBonus:{months:12}}},
  {text:"Je négocie une augmentation",effects:{rep:{pad:2,rec:2},note:"Tu as bien négocié. Ils paient plus pour te garder.",sponsorBonus:{months:12,fee:0.20}}},
  {text:"Je refuse — j'attendrai d'autres offres",effects:{rep:{pad:-1},note:"Risqué. Le sponsor pourrait partir à la fin du contrat actuel."}}
 ]},
{id:"product_launch",title:"Lancement produit",icon:"rocket",cooldown:26,minSponsors:1,
 contextFn:function(s){return s.name+" lance un nouveau produit et veut t'associer à la com. Tu serais le visage de la campagne mondiale.";},
 choices:[
  {text:"Je suis honoré — campagne mondiale, on fonce",effects:{rep:{med:4,pub:3,pad:1},budget:30000,note:"Visibilité internationale. Énorme coup pour ta carrière.",sponsorBonus:{fee:0.25,months:6}}},
  {text:"J'accepte mais limité à mon marché national",effects:{rep:{med:2,pub:2},budget:12000,note:"Bonne campagne ciblée."}},
  {text:"Je décline — produit pas en accord avec mes valeurs",effects:{rep:{pad:-3,med:-2},note:"Le sponsor est très déçu. Risque de rupture du contrat.",sponsorBonus:{fee:-0.15}}}
 ]},
{id:"crisis_management",title:"Crise de communication",icon:"alert",cooldown:36,minSponsors:1,
 contextFn:function(s){return s.name+" est dans la tourmente — un scandale médiatique vise leur dirigeant. Ton équipe te demande comment réagir.";},
 choices:[
  {text:"Je soutiens publiquement — solidarité",effects:{rep:{pad:3,rec:1,pub:-2,med:-2},note:"Risqué : tu protèges le sponsor mais ton image se dégrade un peu."}},
  {text:"Je reste neutre — pas de commentaire",effects:{rep:{pad:0,med:1},note:"Choix prudent. Personne n'est satisfait à 100%, mais rien de cassé."}},
  {text:"Je prends mes distances — déclaration mesurée",effects:{rep:{pad:-3,pub:2,med:1},note:"Tu protèges ton image, mais le sponsor te le fera payer.",sponsorBonus:{fee:-0.30}}}
 ]},
{id:"tech_partnership",title:"Collaboration technique",icon:"settings",cooldown:28,minSponsors:1,sponsorTypes:["tech","auto","equipement"],
 contextFn:function(s){return s.name+" développe un nouveau produit (capteur télémétrie, simulateur, équipement) et veut tester avec toi. C'est exclusif et confidentiel.";},
 choices:[
  {text:"OK, j'apporte mon expertise pilote",effects:{rep:{pad:3,rec:2},stat:{k:"vs_eq",v:1},note:"Le partenariat technique a payé. Tu as gagné en expérience.",sponsorBonus:{months:6,fee:0.10}}},
  {text:"Je teste quelques sessions seulement",effects:{rep:{pad:1},note:"Contribution modeste mais utile."}},
  {text:"Pas le temps pour ça",effects:{rep:{pad:-2,rec:-1},note:"Opportunité ratée. Le sponsor cherche un autre pilote."}}
 ]}
];

function tickSponsorEvents(weeks){
 if(!weeks||weeks<=0)return;
 if(!G.sponsors||G.sponsors.length===0)return;
 if(typeof REP_EVENTS_PENDING==="undefined")return;
 if(REP_EVENTS_PENDING.length>=2)return;
 G._sponsorEvtCooldowns=G._sponsorEvtCooldowns||{};
 // Decay cooldowns
 Object.keys(G._sponsorEvtCooldowns).forEach(function(k){
  G._sponsorEvtCooldowns[k]=Math.max(0,G._sponsorEvtCooldowns[k]-weeks);
 });
 // 18% chance per advance to spawn a sponsor event when sponsors are active
 if(Math.random()>0.18*Math.min(weeks,3))return;
 // Pick a candidate sponsor
 var candidates=G.sponsors.filter(function(s){return s.weeksLeft>4;});
 if(candidates.length===0)return;
 var sponsor=candidates[Math.floor(Math.random()*candidates.length)];
 // Filter eligible events
 var nowWeek=48*((G.saison||1)-1)+(G.semaine||1);
 var eligible=SPONSOR_EVENT_DEFS.filter(function(def){
  if(G._sponsorEvtCooldowns[def.id]&&G._sponsorEvtCooldowns[def.id]>0)return false;
  if(def.minSponsors&&G.sponsors.length<def.minSponsors)return false;
  if(def.sponsorTypes&&def.sponsorTypes.indexOf(sponsor.type)<0)return false;
  if(def.sponsorMinWeeks){
   var sponsorAge=nowWeek-(sponsor.signedWeek||0);
   if(sponsorAge<def.sponsorMinWeeks)return false;
  }
  return true;
 });
 if(eligible.length===0)return;
 var def=eligible[Math.floor(Math.random()*eligible.length)];
 // Apply cooldown
 G._sponsorEvtCooldowns[def.id]=def.cooldown||20;
 // Build event for REP_EVENTS_PENDING with sponsor context
 var ctxText=def.contextFn(sponsor,G.sponsors);
 // Map choices: replace $primary placeholder with sponsor name
 var choices=def.choices.map(function(c){
  var text=c.text.replace(/\$primary/g,sponsor.name);
  return {text:text,effects:c.effects,_sponsorId:sponsor.id};
 });
 var evt={
  id:"spon_"+def.id+"_"+Date.now(),
  title:def.title,
  icon:def.icon||"badge",
  context:ctxText,
  week:G.semaine||1,
  choices:choices,
  _sponsorEvent:true,
  _sponsorId:sponsor.id
 };
 REP_EVENTS_PENDING.push(evt);
 if(typeof renderHomeEvents==="function")renderHomeEvents();
}

// Hook into existing resolveRepEvent to handle sponsor-specific effects
var _origResolveRepEvent=typeof resolveRepEvent==="function"?resolveRepEvent:null;
if(_origResolveRepEvent){
 resolveRepEvent=function(e,t){
  var evt=REP_EVENTS_PENDING[e];
  if(evt&&evt._sponsorEvent&&evt.choices[t]){
   var choice=evt.choices[t];
   var fx=choice.effects||{};
   var sponsorId=evt._sponsorId;
   var sponsor=(G.sponsors||[]).find(function(s){return s.id===sponsorId;});
   if(sponsor){
    if(fx.sponsorBonus){
     if(fx.sponsorBonus.fee){
      var oldFee=sponsor.fee;
      sponsor.fee=Math.max(100,Math.round(sponsor.fee*(1+fx.sponsorBonus.fee)));
      var feeDelta=sponsor.fee-oldFee;
      G.revenue=(G.revenue||0)+feeDelta;
     }
     if(fx.sponsorBonus.months){
      sponsor.weeksLeft=(sponsor.weeksLeft||0)+4*fx.sponsorBonus.months;
     }
    }
    if(fx.dropOtherSponsor){
     // Remove the other sponsor (the one not chosen)
     var others=(G.sponsors||[]).filter(function(s){return s.id!==sponsorId;});
     if(others.length>0){
      var dropMe=others[0];
      G.revenue=Math.max(0,(G.revenue||0)-(dropMe.fee||0));
      G.sponsors=G.sponsors.filter(function(s){return s.id!==dropMe.id;});
     }
    }
    if(fx.networkBonus&&typeof addNetworkContact==="function"){
     try{
      addNetworkContact({name:"Contact "+sponsor.name,role:"other",roleLabel:"Cadre "+sponsor.name,team:sponsor.name,relation:55,color:"#A78BFA"});
     }catch(err){}
    }
   }
  }
  return _origResolveRepEvent(e,t);
 };
}

// Register weekly tick hook
if(typeof WEEKLY_TICK_HOOKS!=="undefined"&&WEEKLY_TICK_HOOKS&&WEEKLY_TICK_HOOKS.push){
 var _hasSponsorEvtHook=WEEKLY_TICK_HOOKS.some(function(h){return h.id==="sponsorEvents";});
 if(!_hasSponsorEvtHook){
  WEEKLY_TICK_HOOKS.push({id:"sponsorEvents",run:function(e){tickSponsorEvents(e);}});
 }
}



/* === NOUVEL ÉCRAN S-sponsors === */
function sponsorTab(name){
 ['dispo','actif','events'].forEach(function(t){
  var el=document.getElementById('sp-tab-'+t);
  if(el)el.style.display=t===name?'block':'none';
 });
 document.querySelectorAll('#S-sponsors .tab').forEach(function(t){
  t.classList.toggle('on',t.getAttribute('data-stab')===name);
 });
 if(name==='dispo')renderSponsorsNew();
 if(name==='actif')renderSponsorsActiveNew();
 if(name==='events')renderSponsorEventsList();
}

function renderSponsorsNew(){
 var list=document.getElementById('sp-list');
 if(!list)return;
 if(typeof getSponsorPool!=='function'){list.innerHTML='';return;}
 var pool=getSponsorPool();
 var signed=(G.sponsors||[]).map(function(s){return s.id;});
 var avail=pool.filter(function(s){return signed.indexOf(s.id)<0;});
 var rep=G.reputation||0;
 var hasTeam=G.currentTeam&&G.currentTeam!=='Indépendant';
 // Group by sponsorKind
 var groups={equipement:[],pilote:[],ecurie:[],ambassadeur:[]};
 avail.forEach(function(s){
  var k=s.sponsorKind||'pilote';
  if(!groups[k])groups[k]=[];
  groups[k].push(s);
 });
 var html='';
 var sectionMeta={
  equipement:{label:'Équipement',sub:'Matériel pilote · cachets modestes',color:'#22D3EE'},
  pilote:{label:'Sponsor pilote',sub:'Te suit personnellement, indépendant de l\'écurie',color:'#34D399'},
  ecurie:{label:'Sponsor écurie',sub:'Lié à ton équipe actuelle — expire au changement',color:'#F59E0B'},
  ambassadeur:{label:'Ambassadeur',sub:'Engagement long terme, prestige élevé',color:'#A855F7'}
 };
 var order=['equipement','pilote','ecurie','ambassadeur'];
 var anyOk=false;
 order.forEach(function(k){
  var entries=groups[k]||[];
  if(entries.length===0)return;
  var ok=entries.filter(function(s){
   if(rep<s.repReq)return false;
   if(k==='ecurie'&&!hasTeam)return false;
   return true;
  });
  var locked=entries.filter(function(s){
   if(rep<s.repReq)return true;
   if(k==='ecurie'&&!hasTeam)return true;
   return false;
  });
  if(ok.length===0&&locked.length===0)return;
  var meta=sectionMeta[k];
  html+='<div style="margin:14px 14px 6px;padding:10px 12px;border-left:3px solid '+meta.color+';background:rgba(255,255,255,.02);border-radius:0 8px 8px 0">';
  html+='<div style="font-family:var(--font-display);font-size:11px;font-weight:800;color:'+meta.color+';letter-spacing:.10em;text-transform:uppercase">'+meta.label+'</div>';
  html+='<div style="font-size:11px;color:var(--text3);margin-top:2px;line-height:1.4">'+meta.sub+'</div>';
  html+='</div>';
  ok.forEach(function(s){html+=_renderSpOfferCard(s,true);anyOk=true;});
  if(locked.length){
   locked.forEach(function(s){html+=_renderSpOfferCard(s,false);});
  }
 });
 if(!anyOk&&Object.keys(groups).every(function(k){return!groups[k]||groups[k].length===0;})){
  html='<div style="margin:14px 16px;padding:18px 14px;border:1px dashed var(--line2);background:var(--bg3);text-align:center;font-size:12px;color:var(--muted)">Aucune offre disponible pour le moment.</div>';
 }
 list.innerHTML=html;
}

function _renderSpOfferCard(s,canSign){
 var sponsorKindMeta={
  equipement:{label:'Équipement',color:'#22D3EE'},
  pilote:{label:'Pilote',color:'#34D399'},
  ecurie:{label:'Écurie',color:'#F59E0B'},
  ambassadeur:{label:'Ambassadeur',color:'#A855F7'}
 }[s.sponsorKind||'pilote']||{label:'Sponsor',color:'var(--red3)'};
 var color=canSign?sponsorKindMeta.color:'var(--muted)';
 var typeLbl={equipement:'Équipement',boisson:'Boisson',tech:'Tech',finance:'Finance',sport:'Sport',media:'Média',energie:'Énergie',industrie:'Industrie',auto:'Auto',mode:'Mode',luxe:'Luxe',voyage:'Voyage'}[s.type]||s.type;
 var btn;
 if(canSign){
  btn='<button onclick="signSponsorNew(\''+s.id+'\')" style="margin-top:8px;width:100%;padding:9px;background:'+sponsorKindMeta.color+';color:#fff;border:none;border-radius:8px;font-family:var(--font-display);font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;cursor:pointer">Signer · '+s.fee.toLocaleString('fr-FR')+' €/mois</button>';
 } else {
  var lockReason='Réputation requise : '+s.repReq;
  if(s.sponsorKind==='ecurie'&&(!G.currentTeam||G.currentTeam==='Indépendant')){lockReason='Réservé aux pilotes en écurie';}
  btn='<div style="margin-top:8px;padding:9px;text-align:center;font-size:11px;color:var(--muted);border:1px dashed var(--line2);border-radius:8px">'+lockReason+'</div>';
 }
 var html='<div class="spon-card" style="border-left:3px solid '+color+'">';
 html+='<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">';
 html+='<div class="spon-name" style="color:'+(canSign?'var(--text)':'var(--muted)')+'">'+s.name+'</div>';
 html+='<div style="display:flex;gap:6px;align-items:center"><span style="font-family:var(--font-display);font-size:9px;font-weight:800;color:'+sponsorKindMeta.color+';letter-spacing:.1em;text-transform:uppercase;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,.04)">'+sponsorKindMeta.label+'</span><span style="font-family:var(--font-display);font-size:9px;font-weight:600;color:var(--text3);letter-spacing:.06em;text-transform:uppercase">'+typeLbl+'</span></div>';
 html+='</div>';
 html+='<div class="spon-desc">'+s.desc+'</div>';
 html+='<div class="spon-tags"><span class="badge b-gray">'+s.dur+' an'+(s.dur>1?'s':'')+'</span><span class="badge b-amber">+'+s.perfBonus.toLocaleString('fr-FR')+' € / podium</span></div>';
 html+=btn+'</div>';
 return html;
}

function signSponsorNew(id){
 if(typeof getSponsorPool!=='function')return;
 var pool=getSponsorPool();
 var s=pool.find(function(x){return x.id===id;});
 if(!s)return;
 if((G.reputation||0)<s.repReq){
  if(typeof showFb==='function')showFb('sp-fb','err','Réputation insuffisante');
  return;
 }
 if(typeof signSponsor==='function')signSponsor(s);
 renderSponsorsNew();
 renderSponsorsActiveNew();
 renderSponsorEventsList();
}

function renderSponsorsActiveNew(){
 var list=document.getElementById('sp-active');
 if(!list)return;
 var sponsors=G.sponsors||[];
 var total=sponsors.reduce(function(a,s){return a+(s.fee||0);},0);
 var totalEl=document.getElementById('sp-total');
 var countEl=document.getElementById('sp-count');
 if(totalEl)totalEl.textContent=total.toLocaleString('fr-FR')+' €/mois';
 if(countEl)countEl.textContent=sponsors.length;
 if(sponsors.length===0){
  list.innerHTML='<div style="margin:14px 16px;padding:18px 14px;border:1px dashed var(--line2);background:var(--bg3);text-align:center;font-size:12px;color:var(--muted)">Aucun contrat actif. Va dans l\'onglet Offres pour signer.</div>';
  return;
 }
 var html='';
 sponsors.forEach(function(s,i){
  var weeks=s.weeksLeft||0;
  var ratio=Math.min(1,weeks/(48*(s.dur||1)));
  var color=ratio>0.4?'var(--green)':ratio>0.15?'var(--amber)':'var(--red3)';
  html+='<div class="spon-card active"><div style="display:flex;justify-content:space-between;margin-bottom:6px"><div class="spon-name">'+s.name+'</div><div style="font-family:var(--font-display);font-size:11px;font-weight:700;color:'+color+'">'+weeks+' sem.</div></div><div class="spon-desc">'+(s.desc||'')+'</div><div style="height:3px;background:var(--line);margin:8px 0;overflow:hidden;border-radius:2px"><div style="height:100%;width:'+(ratio*100)+'%;background:'+color+';transition:width .4s ease"></div></div><div class="spon-tags"><span class="badge b-amber">+'+(s.fee||0).toLocaleString('fr-FR')+' €/mois</span><span class="badge b-teal">+'+(s.perfBonus||0).toLocaleString('fr-FR')+' € / podium</span></div><button onclick="cancelSponsorNew('+i+')" style="margin-top:8px;width:100%;padding:8px;background:transparent;color:var(--red3);border:1px solid rgba(232,16,48,.3);border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit">Résilier (-5 réputation)</button></div>';
 });
 list.innerHTML=html;
}

function cancelSponsorNew(idx){
 if(typeof cancelSponsor==='function')cancelSponsor(idx);
 renderSponsorsActiveNew();
}

function renderSponsorEventsList(){
 var list=document.getElementById('sp-events-list');
 var badge=document.getElementById('sp-evt-badge');
 if(!list)return;
 var sponsorEvents=(typeof REP_EVENTS_PENDING!=='undefined'&&REP_EVENTS_PENDING)?REP_EVENTS_PENDING.filter(function(e){return e&&e._sponsorEvent;}):[];
 if(badge){
  if(sponsorEvents.length>0){
   badge.textContent=sponsorEvents.length;
   badge.style.cssText='display:inline-block;background:var(--red);color:#fff;font-size:9px;font-weight:800;padding:1px 5px;border-radius:8px;margin-left:4px;vertical-align:1px';
  }else{
   badge.textContent='';
   badge.style.cssText='';
  }
 }
 // Show pending events
 var html='';
 if(sponsorEvents.length===0){
  html+='<div style="margin:14px 16px;padding:18px 14px;border:1px dashed var(--line2);background:var(--bg3);text-align:center"><div style="font-size:24px;margin-bottom:6px;opacity:.4">'+renderIcon('messages',14,'#9CA3AF')+'</div><div style="font-size:12px;color:var(--muted);line-height:1.5">Aucun événement en attente.<br>Les événements arrivent quand tu as des sponsors actifs.</div></div>';
 }else{
  sponsorEvents.forEach(function(evt){
   var globalIdx=REP_EVENTS_PENDING.indexOf(evt);
   var sponsorName='';
   if(evt._sponsorId){
    var sp=(G.sponsors||[]).find(function(s){return s.id===evt._sponsorId;});
    if(sp)sponsorName=sp.name;
   }
   html+='<div style="margin:10px 14px;border:1px solid rgba(168,85,247,.4);border-radius:14px;background:rgba(168,85,247,.06);overflow:hidden">';
   html+='<div style="padding:12px 14px;border-bottom:1px solid rgba(168,85,247,.18)"><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">';
   html+='<span style="font-size:9px;font-weight:800;color:#A855F7;background:rgba(168,85,247,.15);padding:2px 7px;border-radius:6px;letter-spacing:.06em">SPONSOR</span>';
   if(sponsorName)html+='<span style="font-size:10px;color:var(--text3)">·  '+sponsorName+'</span>';
   html+='</div><div style="font-size:14px;font-weight:700;color:#A855F7">'+(evt.title||'')+'</div></div>';
   html+='<div style="padding:12px 14px;font-size:13px;color:var(--text2);line-height:1.5">'+(evt.context||'')+'</div>';
   html+='<div style="padding:8px 10px;display:flex;flex-direction:column;gap:6px">';
   evt.choices.forEach(function(c,ci){
    var fx=c.effects||{};
    var chips='';
    if(fx.rep){
     var sum=(fx.rep.med||0)+(fx.rep.pub||0)+(fx.rep.pad||0)+(fx.rep.rec||0);
     if(sum>0)chips+='<span style="font-size:10px;color:#34D399">↑ Réputation</span> ';
     else if(sum<0)chips+='<span style="font-size:10px;color:#EF4444">↓ Réputation</span> ';
    }
    if(fx.budget&&fx.budget>0)chips+='<span style="font-size:10px;color:#F59E0B">+'+fx.budget.toLocaleString('fr-FR')+'€</span> ';
    if(fx.budget&&fx.budget<0)chips+='<span style="font-size:10px;color:#EF4444">'+fx.budget.toLocaleString('fr-FR')+'€</span> ';
    if(fx.sponsorBonus&&fx.sponsorBonus.fee&&fx.sponsorBonus.fee>0)chips+='<span style="font-size:10px;color:#A855F7">↑ Fee sponsor</span> ';
    if(fx.sponsorBonus&&fx.sponsorBonus.fee&&fx.sponsorBonus.fee<0)chips+='<span style="font-size:10px;color:#EF4444">↓ Fee sponsor</span> ';
    if(fx.sponsorBonus&&fx.sponsorBonus.months)chips+='<span style="font-size:10px;color:#22D3EE">+'+fx.sponsorBonus.months+' mois</span> ';
    if(fx.dropOtherSponsor)chips+='<span style="font-size:10px;color:#EF4444">⚠ Rupture autre sponsor</span> ';
    html+='<button onclick="resolveSponsorEvent('+globalIdx+','+ci+')" style="padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface2);color:var(--text);font-size:13px;cursor:pointer;font-family:inherit;text-align:left">'+c.text+(chips?'<div style="margin-top:4px;display:flex;gap:8px;flex-wrap:wrap">'+chips+'</div>':'')+'</button>';
   });
   html+='</div></div>';
  });
 }
 // Show recent history
 var hist=(typeof REP_EVT_HISTORY!=='undefined'&&REP_EVT_HISTORY)?REP_EVT_HISTORY.filter(function(h){return h.id&&String(h.id).indexOf('spon_')===0;}).slice(-5).reverse():[];
 if(hist.length>0){
  html+='<div class="t-sec">Historique récent</div>';
  hist.forEach(function(h){
   var sign=h.delta>0?'+':'';
   var color=h.delta>0?'#34D399':h.delta<0?'#EF4444':'var(--muted)';
   html+='<div style="margin:5px 14px;padding:10px 12px;background:var(--bg3);border:1px solid var(--line);border-left:2px solid '+color+';border-radius:8px"><div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px"><div style="font-family:var(--font-display);font-size:11px;font-weight:800;color:var(--text);letter-spacing:.05em">'+(h.title||'')+'</div><div style="font-size:10px;color:'+color+';font-weight:700">'+sign+h.delta+' rep</div></div><div style="font-size:11px;color:var(--muted);font-style:italic">'+(h.choice||'')+'</div></div>';
  });
 }
 list.innerHTML=html;
}

function resolveSponsorEvent(idx,choice){
 if(typeof resolveRepEvent==='function'){
  resolveRepEvent(idx,choice);
  setTimeout(function(){renderSponsorEventsList();},20);
 }
}



/* === Badge sponsor événements en attente === */
function updateSponsorBadge(){
 var badge=document.getElementById('h-sponsors-badge');
 if(!badge)return;
 var total=0;
 try{
  if(typeof REP_EVENTS_PENDING!=='undefined'&&REP_EVENTS_PENDING){
   total+=REP_EVENTS_PENDING.filter(function(e){return e&&e._sponsorEvent;}).length;
  }
 }catch(_e){}
 try{
  if(G.sponsorOffers&&G.sponsorOffers.length>0&&typeof getSponsorPool==='function'){
   var pool=getSponsorPool();
   var signedIds=(G.sponsors||[]).map(function(s){return s.id;});
   var rep=G.reputation||0;
   var availableOffers=G.sponsorOffers.filter(function(o){
    var p=pool.find(function(pp){return pp.id===o.id;});
    return p&&signedIds.indexOf(o.id)<0&&p.repReq<=rep&&o.expire>0;
   }).length;
   total+=availableOffers;
  }
 }catch(_e){}
 if(total>0){
  badge.textContent=total>99?'99+':total;
  badge.style.display='flex';
 }else{
  badge.style.display='none';
 }
}

// Hook to updateUI
var _origUpdateUI_sponsorBadge=typeof updateUI==='function'?updateUI:null;
if(_origUpdateUI_sponsorBadge){
 updateUI=function(){
  var r=_origUpdateUI_sponsorBadge.apply(this,arguments);
  try{updateSponsorBadge();}catch(e){}
  return r;
 };
}



/* === AJUSTEMENT AUTO HAUTEUR ACCUEIL === */
function adjustHomeCompactness(){
 try{
  var body=document.body;
  if(!body)return;
  // Mesure la hauteur réelle disponible pour la page
  var app=document.getElementById('app');
  var h=app?app.clientHeight:0;
  if(!h||h<100)h=window.innerHeight||0;
  // Reset
  body.classList.remove('home-compact-1','home-compact-2','home-compact-3');
  // Seuils ajustés pour smartphones modernes
  if(h<=620){
   body.classList.add('home-compact-3');
  }else if(h<=730){
   body.classList.add('home-compact-2');
  }else if(h<=850){
   body.classList.add('home-compact-1');
  }
 }catch(e){console.warn('adjustHomeCompactness:',e);}
}

if(typeof window!=='undefined'){
 window.addEventListener('resize',adjustHomeCompactness);
 window.addEventListener('orientationchange',function(){setTimeout(adjustHomeCompactness,150);});
 if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',function(){setTimeout(adjustHomeCompactness,80);});
 }else{
  setTimeout(adjustHomeCompactness,80);
 }
 // Re-check sur navigation home
 setTimeout(function(){
  if(typeof navTo==='function'){
   var _origNavTo=navTo;
   window.navTo=function(){
    var r=_origNavTo.apply(this,arguments);
    if(arguments[0]==='S-home'){setTimeout(adjustHomeCompactness,30);}
    return r;
   };
  }
 },1000);
 // Re-check après 1s pour les cas de chargement tardif
 setTimeout(adjustHomeCompactness,500);
 setTimeout(adjustHomeCompactness,1500);
}



/* === MARGE DYNAMIQUE BAS DE PAGE / BARRE MENU === */
function adjustBottomNavClearance(){
 try{
  var nav=document.querySelector('.bnav');
  var root=document.documentElement;
  if(!root)return;
  // Hauteur réelle de la barre (incluant safe-bot)
  var navH=nav?nav.offsetHeight:0;
  // Si la barre n'est pas visible (display:none), on prend une valeur par défaut
  if(navH<10){navH=64;}
  // Marge supplémentaire pour respiration
  var breathing=24;
  var clearance=navH+breathing;
  root.style.setProperty('--bnav-clearance',clearance+'px');
 }catch(e){console.warn('adjustBottomNavClearance:',e);}
}

if(typeof window!=='undefined'){
 window.addEventListener('resize',adjustBottomNavClearance);
 window.addEventListener('orientationchange',function(){setTimeout(adjustBottomNavClearance,150);});
 if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',function(){setTimeout(adjustBottomNavClearance,80);});
 }else{
  setTimeout(adjustBottomNavClearance,80);
 }
 // Recalculs supplémentaires (chargement progressif, animations, etc.)
 setTimeout(adjustBottomNavClearance,500);
 setTimeout(adjustBottomNavClearance,1500);
 // Recalcul lors du show/hide de la nav (changement de page)
 setTimeout(function(){
  if(typeof navTo==='function'){
   var _origNT=navTo;
   window.navTo=function(){
    var r=_origNT.apply(this,arguments);
    setTimeout(adjustBottomNavClearance,30);
    return r;
   };
  }
 },1200);
}


/* === BOUTIQUE === */
function buyPaddockPass(){
 // In a web demo, no real payment - just confirm and toggle
 if(G.paddockPass){
  if(typeof showCustomConfirm==='function'){
   showCustomConfirm({
    title:'Paddock Pass actif',
    message:'Tu es déjà abonné au Paddock Pass. Veux-tu le désactiver ? (En version réelle, la gestion se ferait dans les réglages de l\'appareil)',
    confirmText:'Désactiver',
    cancelText:'Garder',
    onConfirm:function(){
     G.paddockPass=false;
     if(typeof renderShop==='function')renderShop();
     if(typeof renderPaddockPass==='function')renderPaddockPass();
     if(typeof pushHomeToast==='function')pushHomeToast('Paddock Pass désactivé');
    }
   });
  }else if(confirm('Désactiver le Paddock Pass ?')){
   G.paddockPass=false;
   renderShop();
   if(typeof renderPaddockPass==='function')renderPaddockPass();
  }
  return;
 }
 if(typeof showCustomConfirm==='function'){
  showCustomConfirm({
   title:'Confirmer l\'abonnement',
   message:'Paddock Pass : 7,99 €/mois\n\nDans cette version de démonstration, l\'achat est simulé. Sur l\'app finale, l\'achat passera par l\'App Store ou Google Play.',
   confirmText:'Activer (démo)',
   cancelText:'Annuler',
   onConfirm:function(){
    G.paddockPass=true;
    if(typeof renderShop==='function')renderShop();
    if(typeof renderPaddockPass==='function')renderPaddockPass();
    if(typeof pushHomeToast==='function')pushHomeToast(' Paddock Pass activé');
    if(typeof updateUI==='function')updateUI();
    // Naviguer automatiquement vers la page Paddock Pass pour rendre l'éditeur visible immédiatement
    if(typeof navTo==='function')setTimeout(function(){try{navTo('S-paddockpass');}catch(_e){}},80);
   }
  });
 }else{
  if(confirm('Paddock Pass 7,99€/mois - Activer (démo) ?')){
   G.paddockPass=true;
   renderShop();
   if(typeof renderPaddockPass==='function')renderPaddockPass();
   if(typeof navTo==='function')setTimeout(function(){try{navTo('S-paddockpass');}catch(_e){}},80);
  }
 }
}

function renderShop(){
 var btn=document.getElementById('shop-paddock-btn');
 var card=document.getElementById('shop-paddock-card');
 if(!btn||!card)return;
 if(G.paddockPass){
  btn.textContent=' Actif — Ouvrir le Paddock Pass';
  btn.style.background='linear-gradient(135deg,#34D399,#10B981)';
  btn.style.color='#fff';
  card.style.borderColor='rgba(52,211,153,.45)';
  // Le bouton mène à la page Paddock Pass au lieu de proposer la désactivation
  btn.setAttribute('onclick',"navTo('S-paddockpass')");
 }else{
  btn.textContent="S'abonner · 7,99 €/mois";
  btn.style.background='linear-gradient(135deg,#F0B41E,#E89E08)';
  btn.style.color='#1A1A1F';
  card.style.borderColor='rgba(240,180,30,.40)';
  btn.setAttribute('onclick','buyPaddockPass()');
 }
}

function renderPaddockPass(){
 // Affiche/cache les blocs de la page Paddock Pass selon l'état d'abonnement.
 var banner=document.getElementById('pp-status-banner');
 var titleEl=document.getElementById('pp-status-title');
 var descEl=document.getElementById('pp-status-desc');
 var actionsEl=document.getElementById('pp-actions');
 var toolsEl=document.getElementById('pp-tools');
 var active=!!G.paddockPass;
 // Bannière de statut
 if(banner&&titleEl&&descEl){
  if(active){
   banner.style.background='linear-gradient(135deg,rgba(52,211,153,.14),rgba(52,211,153,.04))';
   banner.style.borderColor='rgba(52,211,153,.45)';
   banner.style.borderLeftColor='#34D399';
   titleEl.textContent='Actif';
   titleEl.style.color='#34D399';
   descEl.textContent='Tu as accès à l\'éditeur en jeu : modifie tes stats, transfère manuellement les rivaux et personnalise les écuries.';
  }else{
   banner.style.background='linear-gradient(135deg,rgba(240,180,30,.12),rgba(240,180,30,.04))';
   banner.style.borderColor='rgba(240,180,30,.45)';
   banner.style.borderLeftColor='#F0B41E';
   titleEl.textContent='Non actif';
   titleEl.style.color='#F0B41E';
   descEl.textContent='Active le Paddock Pass pour débloquer le mode bac à sable et les outils de personnalisation.';
  }
 }
 // Bouton d'abonnement / désabonnement
 if(actionsEl){
  if(active){
   actionsEl.innerHTML='<button onclick="buyPaddockPass()" style="width:100%;padding:11px;background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:10px;font-family:var(--font-display);font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;cursor:pointer">Désactiver l\'abonnement</button>';
  }else{
   actionsEl.innerHTML='<button onclick="buyPaddockPass()" style="width:100%;padding:11px;background:linear-gradient(135deg,#F0B41E,#E89E08);color:#1A1A1F;border:none;border-radius:10px;font-family:var(--font-display);font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;cursor:pointer">S\'abonner · 7,99 €/mois</button>';
  }
 }
 // Outils (éditeur en jeu) — visibles uniquement si actif
 if(toolsEl){
  toolsEl.style.display=active?'block':'none';
 }
}

// Hook into navTo to render shop when navigating to it
if(typeof window!=='undefined'){
 setTimeout(function(){
  if(typeof navTo==='function'){
   var _origNT_shop=navTo;
   window.navTo=function(){
    var r=_origNT_shop.apply(this,arguments);
    if(arguments[0]==='S-shop'){setTimeout(renderShop,30);}
    if(arguments[0]==='S-paddockpass'){setTimeout(renderPaddockPass,30);}
    return r;
   };
  }
 },1200);
}

/* === DASHBOARD CIRCUIT DANS PRÉPARATION === */

function _gatherCircuitStats(circuitName){
 if(!circuitName)return null;
 var allRaces=[];
 if(typeof CAREER_HISTORY!=="undefined"&&CAREER_HISTORY){
  CAREER_HISTORY.forEach(function(s){
   if(s.raceDetails)s.raceDetails.forEach(function(r){
    var rr=Object.assign({},r);
    if(rr.saison==null)rr.saison=s.saison;
    if(rr.cat==null)rr.cat=s.cat;
    allRaces.push(rr);
   });
  });
 }
 var _curInHist4=CAREER_HISTORY.some(function(s){return s.saison===G.saison&&s.cat===G.cat});
 if(!_curInHist4&&G&&G.races&&G.races.length){
  G.races.forEach(function(r){
   var rr=Object.assign({},r);
   if(rr.saison==null)rr.saison=G.saison;
   if(rr.cat==null)rr.cat=G.cat;
   allRaces.push(rr);
  });
 }
 var thisCircuit=allRaces.filter(function(r){return r.circuit===circuitName;});
 if(thisCircuit.length===0)return null;
 var stats={
  name:circuitName,races:thisCircuit.length,wins:0,podiums:0,poles:0,top10:0,top5:0,dnfs:0,
  bestPos:null,avgPos:null,
  bestQualiAvg:0,raceImproveAvg:null,
  bestLap:null,bestLapInfo:null,fastestLaps:0,
  startedFromPole:0,winsFromPole:0,
  bestStreakWins:0,bestStreakPodiums:0,
  byCategory:{},byWeather:{},
  recent:[]
 };
 var qSum=0,qCnt=0,improveSum=0,improveCnt=0,posSum=0,posCnt=0;
 var streakW=0,streakP=0;
 thisCircuit.forEach(function(r){
  var pos=r.pos||0,qPos=r.qualiPos||0;
  if(pos===1)stats.wins++;
  if(pos>=1&&pos<=3)stats.podiums++;
  if(pos>=1&&pos<=5)stats.top5++;
  if(pos>=1&&pos<=10)stats.top10++;
  if(pos===0)stats.dnfs++;
  if(r.pole||qPos===1)stats.poles++;
  if(qPos===1){stats.startedFromPole++;if(pos===1)stats.winsFromPole++;}
  if(qPos>0){qSum+=qPos;qCnt++;}
  if(qPos>0&&pos>0){improveSum+=(qPos-pos);improveCnt++;}
  if(pos>0){posSum+=pos;posCnt++;if(stats.bestPos===null||pos<stats.bestPos)stats.bestPos=pos;}
  if(r.bestLap&&r.bestLap.isPlayer)stats.fastestLaps++;
  if(pos===1){streakW++;if(streakW>stats.bestStreakWins)stats.bestStreakWins=streakW;}else streakW=0;
  if(pos>=1&&pos<=3){streakP++;if(streakP>stats.bestStreakPodiums)stats.bestStreakPodiums=streakP;}else streakP=0;
  var pbl=r.playerBestLap;
  if(pbl&&typeof pbl==="number"&&pbl>0){
   if(stats.bestLap===null||pbl<stats.bestLap){
    stats.bestLap=pbl;
    stats.bestLapInfo={saison:r.saison||0,cat:r.cat||""};
   }
  }
  // by category
  var cat=r.cat||"?";
  if(!stats.byCategory[cat])stats.byCategory[cat]={races:0,wins:0,podiums:0};
  stats.byCategory[cat].races++;
  if(pos===1)stats.byCategory[cat].wins++;
  if(pos>=1&&pos<=3)stats.byCategory[cat].podiums++;
  // by weather
  var w=r.weather;
  if(w){
   if(!stats.byWeather[w])stats.byWeather[w]={races:0,wins:0,posSum:0,posCnt:0};
   stats.byWeather[w].races++;
   if(pos===1)stats.byWeather[w].wins++;
   if(pos>0){stats.byWeather[w].posSum+=pos;stats.byWeather[w].posCnt++;}
  }
 });
 if(qCnt>0)stats.bestQualiAvg=qSum/qCnt;
 if(improveCnt>0)stats.raceImproveAvg=improveSum/improveCnt;
 if(posCnt>0)stats.avgPos=posSum/posCnt;
 // Compute avg pos per weather
 Object.keys(stats.byWeather).forEach(function(w){
  var d=stats.byWeather[w];
  d.avgPos=d.posCnt>0?d.posSum/d.posCnt:0;
 });
 stats.recent=thisCircuit.slice().reverse().slice(0,5);
 return stats;
}

function _formatLapTime2(seconds){
 if(!seconds||seconds<=0)return "—";
 var m=Math.floor(seconds/60);
 var s=seconds-m*60;
 if(m>0)return m+":"+(s<10?"0":"")+s.toFixed(3);
 return s.toFixed(3);
}

function renderCircuitDashboard(circuitName){
 var container=document.getElementById("circuit-dashboard");
 if(!container)return;
 var stats=_gatherCircuitStats(circuitName);
 if(!stats||stats.races===0){
  container.innerHTML='<div style="margin:10px 0 0;padding:14px;text-align:center;color:var(--text3);font-size:11px;border:1px dashed var(--border);border-radius:10px;background:var(--surface2);font-style:italic">Première visite sur ce circuit. Aucune statistique encore.</div>';
  return;
 }
 var rowStyle='display:flex;align-items:center;justify-content:space-between;padding:10px 14px 10px 18px';
 var html='';
 // Header card
 html+='<div style="margin:10px 0 0;padding:12px;border-radius:12px;background:linear-gradient(180deg,var(--surface2) 0%,var(--bg2) 100%);border:1px solid var(--border);position:relative;overflow:hidden">';
 html+='<div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(180deg,#A855F7 0%,#7C3AED 100%);box-shadow:0 0 12px rgba(168,85,247,0.4)"></div>';
 html+='<div style="padding-left:8px"><div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:#A855F7;letter-spacing:.18em;text-transform:uppercase;margin-bottom:4px">Tes performances ici</div>';
 html+='<div style="font-family:var(--font-display);font-size:14px;font-weight:900;color:var(--text);line-height:1.1;margin-bottom:8px">'+stats.races+' course'+(stats.races>1?"s":"")+' couru'+(stats.races>1?"es":"e")+'</div>';
 html+='<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:11.5px;color:var(--text2)">';
 if(stats.wins>0)html+='<span><strong style="color:#F59E0B">'+stats.wins+'</strong> V</span>';
 if(stats.podiums>0)html+='<span><strong style="color:#FBBF24">'+stats.podiums+'</strong> P</span>';
 if(stats.poles>0)html+='<span><strong style="color:#A855F7">'+stats.poles+'</strong> pole'+(stats.poles>1?"s":"")+'</span>';
 if(stats.dnfs>0)html+='<span><strong style="color:#EF4444">'+stats.dnfs+'</strong> DNF</span>';
 html+='</div></div></div>';
 // Stats grid
 html+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin:10px 0 0">';
 html+='<div style="padding:9px 6px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;text-align:center"><div style="font-family:var(--font-display);font-size:9px;color:var(--text3);letter-spacing:.12em">MEILLEURE</div><div style="font-family:var(--font-display);font-size:18px;font-weight:900;color:var(--text);margin-top:2px">'+(stats.bestPos!==null?'P'+stats.bestPos:'—')+'</div></div>';
 html+='<div style="padding:9px 6px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;text-align:center"><div style="font-family:var(--font-display);font-size:9px;color:var(--text3);letter-spacing:.12em">MOYENNE</div><div style="font-family:var(--font-display);font-size:18px;font-weight:900;color:var(--text);margin-top:2px">'+(stats.avgPos!==null?'P'+stats.avgPos.toFixed(1):'—')+'</div></div>';
 html+='<div style="padding:9px 6px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;text-align:center"><div style="font-family:var(--font-display);font-size:9px;color:var(--text3);letter-spacing:.12em">TOP 10</div><div style="font-family:var(--font-display);font-size:18px;font-weight:900;color:var(--text);margin-top:2px">'+stats.top10+'/'+stats.races+'</div></div>';
 html+='</div>';
 // Best lap
 if(stats.bestLap){
  html+='<div style="margin:8px 0 0;padding:10px 14px;border-radius:10px;background:linear-gradient(135deg,rgba(168,85,247,0.12),rgba(168,85,247,0.04));border:1px solid rgba(168,85,247,0.30);position:relative;overflow:hidden">';
  html+='<div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:#A855F7"></div>';
  html+='<div style="padding-left:6px;display:flex;align-items:center;justify-content:space-between">';
  html+='<div><div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:#A855F7;letter-spacing:.18em;text-transform:uppercase;margin-bottom:2px">★ Meilleur tour all-time</div>';
  if(stats.bestLapInfo){
   html+='<div style="font-size:10px;color:var(--text3)">'+(stats.bestLapInfo.cat||"")+(stats.bestLapInfo.saison?" · S"+stats.bestLapInfo.saison:"")+'</div>';
  }
  html+='</div><div style="font-family:var(--font-display);font-size:18px;font-weight:900;color:var(--text);letter-spacing:.02em">'+_formatLapTime2(stats.bestLap)+'</div>';
  html+='</div></div>';
 }
 // Performance détaillée
 var perfRows=[];
 if(stats.bestQualiAvg>0)perfRows.push({l:"Position quali moyenne",v:"P"+stats.bestQualiAvg.toFixed(1),c:"var(--text)"});
 if(stats.raceImproveAvg!==null){
  var improveStr=(stats.raceImproveAvg>=0?"+":"")+stats.raceImproveAvg.toFixed(1)+" places";
  perfRows.push({l:"Gain moyen quali → course",v:improveStr,c:stats.raceImproveAvg>=0?"#34D399":"var(--red-light)"});
 }
 if(stats.startedFromPole>0){
  var conv=Math.round(100*stats.winsFromPole/stats.startedFromPole);
  perfRows.push({l:"Conversion pole → V",v:conv+"%",c:"#F59E0B"});
 }
 if(stats.fastestLaps>0)perfRows.push({l:"Meilleurs tours en course",v:stats.fastestLaps,c:"#A855F7"});
 if(stats.bestStreakWins>=2)perfRows.push({l:"Streak victoires max",v:stats.bestStreakWins,c:"#F59E0B"});
 if(stats.bestStreakPodiums>=3)perfRows.push({l:"Streak podiums max",v:stats.bestStreakPodiums,c:"#34D399"});
 if(perfRows.length>0){
  html+='<div style="margin:12px 0 4px;font-family:var(--font-display);font-size:9px;font-weight:700;color:var(--text3);letter-spacing:.18em;text-transform:uppercase">Performance détaillée</div>';
  html+='<div style="border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--surface2);position:relative">';
  html+='<div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:#60A5FA"></div>';
  perfRows.forEach(function(r,i){
   html+='<div style="'+rowStyle+';'+(i<perfRows.length-1?"border-bottom:1px solid var(--border)":"")+'">';
   html+='<span style="font-size:12px;color:var(--text2)">'+r.l+'</span>';
   html+='<span style="font-family:var(--font-display);font-size:13px;font-weight:800;color:'+r.c+'">'+r.v+'</span>';
   html+='</div>';
  });
  html+='</div>';
 }
 // By weather  
 var weatherKeys=Object.keys(stats.byWeather);
 if(weatherKeys.length>1){
  var wInfo={dry:{lbl:"Sec",col:"#F59E0B"},cloudy:{lbl:"Nuageux",col:"#9CA3AF"},wet:{lbl:"Humide",col:"#60A5FA"},storm:{lbl:"Pluie battante",col:"#3B82F6"},hot:{lbl:"Forte chaleur",col:"#EF4444"}};
  html+='<div style="margin:12px 0 4px;font-family:var(--font-display);font-size:9px;font-weight:700;color:var(--text3);letter-spacing:.18em;text-transform:uppercase">Par météo</div>';
  html+='<div style="border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--surface2);position:relative">';
  html+='<div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:#34D399"></div>';
  weatherKeys.forEach(function(w,i){
   var info=wInfo[w]||{lbl:w,col:"var(--text)"};
   var d=stats.byWeather[w];
   html+='<div style="'+rowStyle+';'+(i<weatherKeys.length-1?"border-bottom:1px solid var(--border)":"")+'">';
   html+='<div style="flex:1"><div style="font-size:12px;color:var(--text);font-weight:600">'+info.lbl+'</div><div style="font-size:10px;color:var(--text3);margin-top:2px">'+d.races+' course'+(d.races>1?"s":"")+(d.wins>0?(" · "+d.wins+" V"):"")+'</div></div>';
   html+='<span style="font-family:var(--font-display);font-size:13px;font-weight:800;color:'+info.col+'">'+(d.avgPos>0?"P"+d.avgPos.toFixed(1):"—")+'</span>';
   html+='</div>';
  });
  html+='</div>';
 }
 // By category
 var catList=Object.keys(stats.byCategory);
 if(catList.length>1){
  var CAT_ORDER=["Karting Junior","Karting Senior","Formule 4","Formula Regional","Formule 3","Formule 2","Formule 1","Super Formula","Endurance WEC","IndyCar"];
  catList.sort(function(a,b){return CAT_ORDER.indexOf(a)-CAT_ORDER.indexOf(b);});
  html+='<div style="margin:12px 0 4px;font-family:var(--font-display);font-size:9px;font-weight:700;color:var(--text3);letter-spacing:.18em;text-transform:uppercase">Par catégorie</div>';
  html+='<div style="border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--surface2);position:relative">';
  html+='<div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--red2,#EF4444)"></div>';
  catList.forEach(function(c,i){
   var d=stats.byCategory[c];
   html+='<div style="padding:10px 14px 10px 18px;'+(i<catList.length-1?"border-bottom:1px solid var(--border)":"")+'">';
   html+='<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;font-weight:700;color:var(--text)">'+c+'</span><span style="font-size:11px;color:var(--text3)">'+d.races+' c.</span></div>';
   if(d.wins>0||d.podiums>0)html+='<div style="display:flex;gap:14px;font-size:11px;color:var(--text2);margin-top:4px"><span><strong style="color:#F59E0B">'+d.wins+'</strong> V</span><span><strong style="color:#34D399">'+d.podiums+'</strong> P</span></div>';
   html+='</div>';
  });
  html+='</div>';
 }
 // Recent results (last 5)
 if(stats.recent.length>0){
  html+='<div style="margin:12px 0 4px;font-family:var(--font-display);font-size:9px;font-weight:700;color:var(--text3);letter-spacing:.18em;text-transform:uppercase">Derniers résultats</div>';
  html+='<div style="display:flex;flex-direction:column;gap:4px">';
  stats.recent.forEach(function(r){
   var posLabel=r.pos===0?"DNF":(r.pos>0?"P"+r.pos:"—");
   var posColor=r.pos===1?"#F59E0B":(r.pos>=2&&r.pos<=3?"#FBBF24":(r.pos>=4&&r.pos<=10?"var(--text)":(r.pos===0?"#EF4444":"var(--text3)")));
   var seasonInfo="S"+(r.saison||"?")+(r.cat?" · "+r.cat:"");
   html+='<div style="display:flex;align-items:center;gap:10px;padding:7px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:8px">';
   html+='<div style="flex-shrink:0;width:38px;text-align:center;font-family:var(--font-display);font-size:13px;font-weight:900;color:'+posColor+'">'+posLabel+'</div>';
   html+='<div style="flex:1;font-size:11px;color:var(--text2);min-width:0">'+seasonInfo+(r.pole?'<span style="margin-left:6px;padding:1px 5px;background:rgba(168,85,247,.15);color:#A855F7;border-radius:4px;font-size:9px;font-weight:800">POLE</span>':'')+'</div>';
   html+='</div>';
  });
  html+='</div>';
 }
 container.innerHTML=html;
}

/* =========================================================================
   NEG SYSTEM v2 — Système de négociation immersif avec patience
   ========================================================================= */
var NEG_STATE = null;

function _negTeamPrestige(teamName){
 if(!teamName) return 60;
 if(typeof TEAM_PRESTIGE !== "undefined" && TEAM_PRESTIGE[teamName]) return TEAM_PRESTIGE[teamName];
 return 60;
}

function _negRecentPerformance(){
 // Returns -10 to +20 based on last 5 races
 if(!G.races || G.races.length === 0) return 0;
 var last5 = G.races.slice(-5);
 var score = 0;
 last5.forEach(function(r){
  if(r.pos === 1) score += 5;
  else if(r.pos >= 2 && r.pos <= 3) score += 3;
  else if(r.pos >= 4 && r.pos <= 6) score += 1;
  else if(r.pos === 0) score -= 2;
  else if(r.pos > 10) score -= 1;
 });
 return Math.max(-10, Math.min(20, score));
}

function _negCareerWeight(){
 // Returns 0-15 based on career length and F1 experience
 var seasons = (typeof CAREER_HISTORY !== "undefined" && CAREER_HISTORY) ? CAREER_HISTORY.length : 0;
 var f1Seasons = 0;
 if(typeof CAREER_HISTORY !== "undefined" && CAREER_HISTORY) {
  CAREER_HISTORY.forEach(function(s){ if(s.cat === "Formule 1") f1Seasons++; });
 }
 return Math.min(15, seasons + f1Seasons * 2);
}

function _negAgentBonus(){
 if(!G.agent || G.agent.type === "parent") return 0;
 var skill = G.agent.skill || 30;
 // skill 30 → +3, skill 60 → +9, skill 90 → +15
 return Math.round(skill / 6);
}

function _negCountOtherOffers(currentIdx){
 if(!G.offers) return 0;
 return G.offers.filter(function(o,i){
  return i !== currentIdx && !o.expired && (o.expire || 0) > 0;
 }).length;
}

function computeInitialPatience(offer, idx){
 var p = 50; // base
 // Reputation : 0-100 → 0-25
 p += Math.round((G.reputation || 0) / 4);
 // Recent perf : -10 to +20
 p += _negRecentPerformance();
 // Career weight : 0-15
 p += _negCareerWeight();
 // Team prestige : if high (90+), they have more options → less patience
 var prestige = _negTeamPrestige(offer.team);
 if(prestige >= 90) p -= 12;
 else if(prestige >= 80) p -= 6;
 else if(prestige < 65) p += 8; // low-prestige teams need YOU more
 // Agent bonus : 0-15
 p += _negAgentBonus();
 // Multiple offers as leverage
 var others = _negCountOtherOffers(idx);
 if(others >= 2) p += 10;
 else if(others === 1) p += 5;
 // Clamp
 return Math.max(20, Math.min(100, p));
}

function _negActionPatienceCost(action, intensity){
 // intensity from 1 (light) to 3 (aggressive)
 var costs = {
  // Financial
  cut_cost_10: 6, cut_cost_25: 14, cut_cost_50: 28,
  up_salary_10: 5, up_salary_25: 12, up_salary_50: 25,
  up_bonus_win: 8, up_bonus_podium: 6,
  // Contractual  
  duration_extend: 7, duration_shorten: 5,
  ask_n1: 22, ask_veto: 18, ask_release: 15,
  // Leverage
  use_other_offer: 8, bring_sponsor: 5, agent_intervene: 10,
  // Pressure
  walk_away_bluff: 30,
  request_24h: 4
 };
 return costs[action] || 10;
}

function _negComputeAcceptance(state, offer, action, params){
 // Base chance from remaining patience
 var pat = state.patience;
 var base = pat / 100; // 0-1
 // Action ambition modifier
 var modifiers = {
  cut_cost_10: 0.10, cut_cost_25: -0.05, cut_cost_50: -0.30,
  up_salary_10: 0.08, up_salary_25: -0.05, up_salary_50: -0.25,
  up_bonus_win: 0.0, up_bonus_podium: 0.05,
  duration_extend: 0.05, duration_shorten: -0.10,
  ask_n1: -0.30, ask_veto: -0.25, ask_release: -0.15
 };
 var mod = modifiers[action] || 0;
 var chance = base + mod;
 
 // Agent skill subtle boost
 var agentBoost = (G.agent && G.agent.type !== "parent") ? (G.agent.skill || 30) / 800 : 0;
 chance += agentBoost;
 
 // Reputation soft boost on chance
 chance += (G.reputation || 0) / 600;
 
 // Already used same action twice → harder
 if(state.usedActions[action] && state.usedActions[action] >= 2) chance -= 0.15;
 
 return Math.max(0.05, Math.min(0.92, chance));
}

function _negApplyAction(state, offer, action, params){
 state.usedActions[action] = (state.usedActions[action] || 0) + 1;
 var cost = _negActionPatienceCost(action);
 state.patience -= cost;
 state.lastActionCost = cost;
 
 var chance = _negComputeAcceptance(state, offer, action, params);
 state.lastChance = Math.round(chance * 100);
 var success = Math.random() < chance;
 state.lastSuccess = success;
 
 if(success){
  // Apply the action's contract changes
  switch(action){
   case "cut_cost_10": offer.cCost = Math.max(0, Math.round((offer.cCost!=null?offer.cCost:offer.cost) * 0.90 / 500) * 500); break;
   case "cut_cost_25": offer.cCost = Math.max(0, Math.round((offer.cCost!=null?offer.cCost:offer.cost) * 0.75 / 500) * 500); break;
   case "cut_cost_50": offer.cCost = Math.max(0, Math.round((offer.cCost!=null?offer.cCost:offer.cost) * 0.50 / 500) * 500); break;
   case "up_salary_10": offer.cSalary = Math.round(((offer.cSalary!=null?offer.cSalary:offer.salary) * 1.10) / 100) * 100; break;
   case "up_salary_25": offer.cSalary = Math.round(((offer.cSalary!=null?offer.cSalary:offer.salary) * 1.25) / 100) * 100; break;
   case "up_salary_50": offer.cSalary = Math.round(((offer.cSalary!=null?offer.cSalary:offer.salary) * 1.50) / 100) * 100; break;
   case "up_bonus_win": offer.cBonus = Math.round(((offer.cBonus!=null?offer.cBonus:offer.bonusWin) * 1.30) / 500) * 500; break;
   case "up_bonus_podium": offer.cBonusPodium = Math.round((offer.cBonusPodium!=null?offer.cBonusPodium:offer.bonusPodium) * 1.30 / 100) * 100; break;
   case "duration_extend": offer.cDuration = Math.min(4, (offer.cDuration!=null?offer.cDuration:offer.duration) + 1); break;
   case "duration_shorten": offer.cDuration = Math.max(1, (offer.cDuration!=null?offer.cDuration:offer.duration) - 1); break;
   case "ask_n1": offer.cRole = "num1"; break;
   case "ask_veto": offer.cVeto = true; break;
   case "ask_release": offer.cReleaseClause = true; break;
  }
 }
 
 // Build feedback message
 var msgs = _negBuildFeedback(action, success, state, offer);
 state.lastMsg = msgs.headline;
 state.lastDetail = msgs.detail;
 state.history.push({action:action, success:success, patience:state.patience, msg:msgs.headline});
 
 // Check end conditions
 if(state.patience <= 0){
  state.status = "expired";
  state.lastDetail += " L'écurie met fin à la discussion.";
 }
 return state;
}

function _negBuildFeedback(action, success, state, offer){
 var actionLabels = {
  cut_cost_10: success ? "Apport réduit de 10%" : "Apport refusé (-10%)",
  cut_cost_25: success ? "Apport réduit de 25%" : "Apport refusé (-25%)",
  cut_cost_50: success ? "Apport réduit de moitié" : "Apport refusé (-50%)",
  up_salary_10: success ? "Salaire +10%" : "Salaire +10% refusé",
  up_salary_25: success ? "Salaire +25%" : "Salaire +25% refusé",
  up_salary_50: success ? "Salaire +50%" : "Salaire +50% refusé",
  up_bonus_win: success ? "Bonus victoire +30%" : "Bonus victoire refusé",
  up_bonus_podium: success ? "Bonus podium +30%" : "Bonus podium refusé",
  duration_extend: success ? "Durée +1 an accordée" : "Allongement refusé",
  duration_shorten: success ? "Contrat raccourci accepté" : "Raccourcissement refusé",
  ask_n1: success ? "Statut N°1 accordé" : "Refus du statut N°1",
  ask_veto: success ? "Veto coéquipier accepté" : "Veto refusé",
  ask_release: success ? "Clause libération acceptée" : "Clause libération refusée"
 };
 var headline = actionLabels[action] || (success ? "Accepté" : "Refusé");
 var detail = "";
 if(success){
  if(state.patience > 60) detail = "L'écurie reste très ouverte. Tu peux continuer à pousser.";
  else if(state.patience > 30) detail = "Ils acceptent, mais leur patience s'amenuise.";
  else detail = "Ils acceptent du bout des lèvres. Attention à ne pas les pousser trop loin.";
 } else {
  if(state.patience > 50) detail = "Refus poli. Tu peux essayer autre chose.";
  else if(state.patience > 20) detail = "Refus ferme. Le ton se tend.";
  else detail = "Refus catégorique. Ils sont à bout.";
 }
 return {headline:headline, detail:detail};
}

function _negResolveLeverage(state, offer, lever){
 var success, headline, detail;
 if(lever === "use_other_offer"){
  var others = _negCountOtherOffers(NEG_IDX);
  state.usedActions.use_other_offer = (state.usedActions.use_other_offer || 0) + 1;
  if(others >= 1){
   // Real leverage : restore some patience and increase chance for next move
   state.patience = Math.min(100, state.patience + 12);
   state.bonusChance = (state.bonusChance || 0) + 0.10;
   headline = "Levier joué : autre offre";
   detail = "Tu mentionnes l'offre concurrente. L'écurie reprend l'écoute. (+12 patience, prochaine demande favorisée)";
   state.lastSuccess = true;
  } else {
   // Bluff : risk
   state.patience -= 22;
   if(Math.random() < 0.40){
    state.bonusChance = (state.bonusChance || 0) + 0.08;
    headline = "Bluff réussi";
    detail = "Ils ont mordu à l'hameçon. (+ chance prochaine demande)";
    state.lastSuccess = true;
   } else {
    state.patience -= 15;
    headline = "Bluff démasqué";
    detail = "Ils savent que tu n'as rien d'autre. -15 patience supplémentaires.";
    state.lastSuccess = false;
   }
  }
 } else if(lever === "bring_sponsor"){
  state.usedActions.bring_sponsor = (state.usedActions.bring_sponsor || 0) + 1;
  var rep = G.reputation || 0;
  var skill = G.agent ? (G.agent.skill || 30) : 30;
  var threshold = 0.30 + rep / 200 + skill / 400;
  if(Math.random() < threshold){
   state.patience = Math.min(100, state.patience + 8);
   offer.cSponsorBonus = (offer.cSponsorBonus || 0) + 8000;
   state.bonusChance = (state.bonusChance || 0) + 0.08;
   headline = "Sponsor apporté";
   detail = "Tu apportes un sponsor à l'équipe. Ils gagnent +8000€ de budget. La discussion se réchauffe.";
   state.lastSuccess = true;
  } else {
   state.patience -= 8;
   headline = "Sponsor refusé";
   detail = "Le sponsor proposé n'aligne pas avec leur image. Léger malus de patience.";
   state.lastSuccess = false;
  }
 } else if(lever === "agent_intervene"){
  state.usedActions.agent_intervene = (state.usedActions.agent_intervene || 0) + 1;
  if(!G.agent || G.agent.type === "parent"){
   state.patience -= 10;
   headline = "Agent indisponible";
   detail = "Ton parent-agent ne peut pas peser auprès de la direction. Tentative ratée.";
   state.lastSuccess = false;
  } else {
   var s = G.agent.skill || 30;
   var threshold2 = 0.20 + s / 150;
   if(Math.random() < threshold2){
    state.patience = Math.min(100, state.patience + Math.round(8 + s / 12));
    state.bonusChance = (state.bonusChance || 0) + 0.12;
    headline = "Agent fait pencher la balance";
    detail = G.agent.firstName + " " + G.agent.name + " contacte la direction. La discussion repart sur de meilleures bases.";
    state.lastSuccess = true;
   } else {
    state.patience -= 6;
    headline = "Intervention sans effet";
    detail = "Ton agent a tenté, mais la direction n'a pas été convaincue.";
    state.lastSuccess = false;
   }
  }
 }
 state.lastMsg = headline;
 state.lastDetail = detail;
 state.history.push({action:lever, msg:headline, patience:state.patience});
 if(state.patience <= 0){
  state.status = "expired";
  state.lastDetail += " L'écurie quitte la table.";
 }
 return state;
}

function _negResolveWalkAway(state, offer){
 state.usedActions.walk_away_bluff = (state.usedActions.walk_away_bluff || 0) + 1;
 var prestige = _negTeamPrestige(offer.team);
 var rep = G.reputation || 0;
 var threshold = 0.20 + rep / 250;
 if(prestige >= 90) threshold -= 0.15;
 if(Math.random() < threshold){
  // Big win : they cave
  offer.cSalary = Math.round(((offer.cSalary!=null?offer.cSalary:offer.salary) * 1.30) / 100) * 100;
  offer.cCost = Math.max(0, Math.round((offer.cCost!=null?offer.cCost:offer.cost) * 0.70 / 500) * 500);
  state.patience = 100;
  state.lastMsg = "Ils cèdent !";
  state.lastDetail = "Ton bluff a fonctionné. Salaire +30%, apport -30%. Tu as remporté la partie.";
  state.lastSuccess = true;
 } else {
  state.patience = 0;
  state.status = "walked_away";
  state.lastMsg = "Walk away échoué";
  state.lastDetail = "Ils ne reviennent pas. L'offre est perdue.";
  state.lastSuccess = false;
 }
 state.history.push({action:"walk_away_bluff", success:state.lastSuccess, patience:state.patience, msg:state.lastMsg});
 return state;
}

function _negSignBaseTerms(state, offer){
 // Sign at current state
 offer.negOk = true;
 state.status = "signed";
 state.lastMsg = "Contrat signé";
 state.lastDetail = "Tu acceptes les conditions actuelles. L'écurie te tend la main.";
}

function _negStart(idx){
 var offer = G.offers[idx];
 if(!offer) return;
 NEG_STATE = {
  status: "active",
  patience: computeInitialPatience(offer, idx),
  initialPatience: 0,
  usedActions: {},
  history: [],
  bonusChance: 0,
  lastMsg: null,
  lastDetail: null,
  lastSuccess: null,
  lastActionCost: 0,
  lastChance: 0
 };
 NEG_STATE.initialPatience = NEG_STATE.patience;
 // Reset offer counter values
 offer.cCost = null;
 offer.cSalary = null;
 offer.cBonus = null;
 offer.cBonusPodium = null;
 offer.cDuration = null;
 offer.cRole = null;
 offer.cVeto = null;
 offer.cReleaseClause = null;
 offer.cSponsorBonus = null;
 offer.negRound = 0;
 offer.negOk = false;
}

function negDoAction(action){
 var offer = G.offers[NEG_IDX];
 if(!offer || !NEG_STATE || NEG_STATE.status !== "active") return;
 if(["use_other_offer","bring_sponsor","agent_intervene"].indexOf(action) >= 0){
  _negResolveLeverage(NEG_STATE, offer, action);
 } else if(action === "walk_away_bluff"){
  _negResolveWalkAway(NEG_STATE, offer);
 } else if(action === "sign_now"){
  _negSignBaseTerms(NEG_STATE, offer);
 } else {
  _negApplyAction(NEG_STATE, offer, action);
 }
 renderNegScreen();
}

function _negSummaryHTML(offer){
 var cost = offer.cCost!=null ? offer.cCost : offer.cost;
 var salary = offer.cSalary!=null ? offer.cSalary : offer.salary;
 var bonusW = offer.cBonus!=null ? offer.cBonus : offer.bonusWin;
 var bonusP = offer.cBonusPodium!=null ? offer.cBonusPodium : offer.bonusPodium;
 var dur = offer.cDuration!=null ? offer.cDuration : offer.duration;
 var role = offer.cRole || offer.role || "num2";
 var roleLabel = role === "num1" ? "N°1" : role === "equal" ? "Égaux" : "N°2";
 var roleColor = role === "num1" ? "#FBBF24" : role === "equal" ? "#34D399" : "var(--text2)";
 
 var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
 html += '<div class="neg-stat"><div class="neg-stat-label">Apport</div><div class="neg-stat-value" style="color:' + (cost === 0 ? '#34D399' : (cost < offer.cost ? '#34D399' : 'var(--text)')) + '">' + (cost === 0 ? "Gratuit" : "−" + cost.toLocaleString("fr-FR") + " €") + '</div></div>';
 html += '<div class="neg-stat"><div class="neg-stat-label">Salaire</div><div class="neg-stat-value" style="color:' + (salary > offer.salary ? '#34D399' : 'var(--text)') + '">+' + salary.toLocaleString("fr-FR") + ' €/mois</div></div>';
 html += '<div class="neg-stat"><div class="neg-stat-label">Bonus V</div><div class="neg-stat-value" style="color:' + (bonusW > offer.bonusWin ? '#34D399' : 'var(--text)') + '">+' + bonusW.toLocaleString("fr-FR") + ' €</div></div>';
 html += '<div class="neg-stat"><div class="neg-stat-label">Bonus P</div><div class="neg-stat-value" style="color:' + (bonusP > offer.bonusPodium ? '#34D399' : 'var(--text)') + '">+' + bonusP.toLocaleString("fr-FR") + ' €</div></div>';
 html += '<div class="neg-stat"><div class="neg-stat-label">Durée</div><div class="neg-stat-value">' + dur + ' an' + (dur > 1 ? 's' : '') + '</div></div>';
 html += '<div class="neg-stat"><div class="neg-stat-label">Statut</div><div class="neg-stat-value" style="color:' + roleColor + '">' + roleLabel + '</div></div>';
 html += '</div>';
 // Special clauses
 var clauses = [];
 if(offer.cVeto) clauses.push(" Veto coéquipier");
 if(offer.cReleaseClause) clauses.push(" Clause libération");
 if(offer.cSponsorBonus) clauses.push(" Sponsor +" + offer.cSponsorBonus.toLocaleString("fr-FR") + " €");
 if(clauses.length > 0){
  html += '<div style="margin-top:10px;padding:8px 10px;background:rgba(168,85,247,0.08);border-left:2px solid #A855F7;border-radius:6px;font-size:11px;color:#C4A8F4">' + clauses.join(" · ") + '</div>';
 }
 return html;
}

function _negPatienceBarHTML(state){
 var pct = Math.max(0, Math.min(100, state.patience));
 var color, label;
 if(pct >= 70){ color = "#34D399"; label = "Très ouverts"; }
 else if(pct >= 45){ color = "#60A5FA"; label = "Réceptifs"; }
 else if(pct >= 25){ color = "#F59E0B"; label = "Tendus"; }
 else if(pct > 0){ color = "#EF4444"; label = "À bout"; }
 else { color = "#EF4444"; label = "Hors de question"; }
 var html = '<div class="neg-patience-card">';
 html += '<div class="neg-patience-header"><span class="neg-patience-title">Patience de l\'écurie</span><span class="neg-patience-pct" style="color:' + color + '">' + Math.round(pct) + '/100</span></div>';
 html += '<div class="neg-patience-bar"><div class="neg-patience-fill" style="width:' + pct + '%;background:linear-gradient(90deg,' + color + 'CC 0%,' + color + ' 100%);box-shadow:0 0 8px ' + color + '88"></div></div>';
 html += '<div class="neg-patience-mood" style="color:' + color + '">' + label + '</div>';
 html += '</div>';
 return html;
}

function _negActionBtn(action, label, sub, opts){
 opts = opts || {};
 var cost = _negActionPatienceCost(action);
 var disabled = opts.disabled || false;
 var color = opts.color || "var(--text2)";
 var iconColor = opts.iconColor || color;
 var html = '<button class="neg-action-btn"' + (disabled ? ' disabled style="opacity:.4;cursor:not-allowed"' : ' onclick="negDoAction(\'' + action + '\')"') + '>';
 html += '<div class="neg-action-stripe" style="background:' + iconColor + '"></div>';
 html += '<div class="neg-action-body">';
 html += '<div class="neg-action-label">' + label + '</div>';
 html += '<div class="neg-action-sub">' + sub + '</div>';
 html += '</div>';
 if(!disabled && cost > 0){
  html += '<div class="neg-action-cost">−' + cost + '</div>';
 }
 html += '</button>';
 return html;
}

function _negActionsListHTML(state, offer){
 var html = '';
 var used = state.usedActions;
 // Section: Finances
 html += '<div class="neg-section-title">'+renderIcon('money',14,'#F59E0B')+' Finances</div>';
 html += '<div class="neg-actions-grid">';
 html += _negActionBtn("cut_cost_10", "Réduire apport −10%", "Demande modeste", {iconColor:"#34D399"});
 html += _negActionBtn("cut_cost_25", "Réduire apport −25%", "Demande standard", {iconColor:"#60A5FA"});
 html += _negActionBtn("cut_cost_50", "Réduire apport de moitié", "Demande agressive", {iconColor:"#F59E0B"});
 html += _negActionBtn("up_salary_10", "Salaire +10%", "Demande modeste", {iconColor:"#34D399"});
 html += _negActionBtn("up_salary_25", "Salaire +25%", "Demande standard", {iconColor:"#60A5FA"});
 html += _negActionBtn("up_salary_50", "Salaire +50%", "Demande agressive", {iconColor:"#F59E0B"});
 html += _negActionBtn("up_bonus_win", "Bonus victoire +30%", "Si tu gagnes", {iconColor:"#FBBF24"});
 html += _negActionBtn("up_bonus_podium", "Bonus podium +30%", "Plus de chances de toucher", {iconColor:"#FBBF24"});
 html += '</div>';
 // Section: Contractuel
 html += '<div class="neg-section-title">'+renderIcon('contrats',14,'#A78BFA')+' Contractuel</div>';
 html += '<div class="neg-actions-grid">';
 var dur = offer.cDuration!=null ? offer.cDuration : offer.duration;
 html += _negActionBtn("duration_extend", "Allonger durée +1 an", "Sécurité long terme", {iconColor:"#A855F7", disabled: dur >= 4});
 html += _negActionBtn("duration_shorten", "Raccourcir −1 an", "Plus de flexibilité", {iconColor:"#A855F7", disabled: dur <= 1});
 html += _negActionBtn("ask_n1", "Demander statut N°1", "Très exigeant", {iconColor:"#FBBF24", disabled: offer.cRole === "num1" || (offer.role === "num1" && !offer.cRole)});
 html += _negActionBtn("ask_veto", "Veto coéquipier", "Imposer ta voix", {iconColor:"#EF4444", disabled: !!offer.cVeto});
 html += _negActionBtn("ask_release", "Clause libération", "Si top 5 → libre", {iconColor:"#22D3EE", disabled: !!offer.cReleaseClause});
 html += '</div>';
 // Section: Leviers
 html += '<div class="neg-section-title">'+renderIcon('paddock_pass',14,'#A78BFA')+' Leviers stratégiques</div>';
 html += '<div class="neg-actions-grid">';
 var others = _negCountOtherOffers(NEG_IDX);
 var leverDescOther = others >= 1 ? "(" + others + " offre" + (others > 1 ? "s" : "") + " concurrente" + (others > 1 ? "s" : "") + ")" : "Bluff possible";
 html += _negActionBtn("use_other_offer", "« J\'ai une autre offre »", leverDescOther, {iconColor:"#22D3EE", disabled: !!used.use_other_offer});
 html += _negActionBtn("bring_sponsor", "« J\'apporte un sponsor »", "Selon ta réputation", {iconColor:"#A855F7", disabled: !!used.bring_sponsor});
 var agentLabel = (G.agent && G.agent.type !== "parent") ? "Faire intervenir l\'agent" : "Agent indisponible";
 html += _negActionBtn("agent_intervene", agentLabel, (G.agent && G.agent.type !== "parent") ? "Skill: " + (G.agent.skill || 30) : "Pas d\'agent pro", {iconColor:"#F472B6", disabled: !!used.agent_intervene || !G.agent || G.agent.type === "parent"});
 html += _negActionBtn("walk_away_bluff", "Walking away (bluff)", "Très risqué — gros gain", {iconColor:"#EF4444", disabled: !!used.walk_away_bluff});
 html += '</div>';
 // Section: Décision finale
 html += '<div class="neg-section-title">'+renderIcon('handshake',14,'#34D399')+' Décision</div>';
 html += '<div class="neg-actions-grid">';
 html += '<button class="neg-action-btn" onclick="negDoAction(\'sign_now\')" style="border-color:#34D399;background:linear-gradient(180deg,rgba(52,211,153,0.10),rgba(52,211,153,0.04))"><div class="neg-action-stripe" style="background:#34D399"></div><div class="neg-action-body"><div class="neg-action-label" style="color:#34D399">Signer aux conditions actuelles</div><div class="neg-action-sub">Termine la négociation</div></div></button>';
 html += '<button class="neg-action-btn" onclick="closeNeg()" style="border-color:var(--border)"><div class="neg-action-stripe" style="background:var(--text3)"></div><div class="neg-action-body"><div class="neg-action-label" style="color:var(--text2)">Quitter sans signer</div><div class="neg-action-sub">L\'offre reste valide</div></div></button>';
 html += '</div>';
 return html;
}

function _negFeedbackHTML(state){
 if(!state.lastMsg) return '';
 var success = state.lastSuccess;
 var color = success ? "#34D399" : (success === false ? "#EF4444" : "#60A5FA");
 var icon = success ? "" : (success === false ? "" : "ⓘ");
 var html = '<div class="neg-feedback" style="border-left-color:' + color + '">';
 html += '<div class="neg-feedback-headline" style="color:' + color + '"><span class="neg-feedback-icon">' + icon + '</span> ' + state.lastMsg + '</div>';
 if(state.lastDetail) html += '<div class="neg-feedback-detail">' + state.lastDetail + '</div>';
 if(state.lastActionCost > 0) html += '<div class="neg-feedback-meta">Patience consommée : −' + state.lastActionCost + ' · Probabilité : ' + (state.lastChance || 0) + '%</div>';
 html += '</div>';
 return html;
}

function renderNegScreen(){
 var offer = G.offers[NEG_IDX];
 if(!offer) return;
 if(!NEG_STATE || NEG_STATE.status === "expired" && !offer.negOk) {
  // Initialize fresh on first render or after expiry
  if(!NEG_STATE) _negStart(NEG_IDX);
 }
 var titleEl = document.getElementById("neg-team");
 if(titleEl) titleEl.textContent = offer.team + " — " + offer.cat;
 var sumEl = document.getElementById("neg-summary");
 if(sumEl){
  sumEl.innerHTML = '<div class="neg-card-title">' + offer.team + '</div>' + _negSummaryHTML(offer);
 }
 var barEl = document.getElementById("neg-round-bar");
 if(barEl) barEl.innerHTML = _negPatienceBarHTML(NEG_STATE);
 var optsEl = document.getElementById("neg-options");
 // Status check
 if(NEG_STATE.status === "signed"){
  if(optsEl){
   optsEl.innerHTML = '<div style="text-align:center;padding:20px"><div style="font-family:var(--font-display);font-size:18px;font-weight:900;color:#34D399;margin-bottom:6px">✓ Contrat conclu</div><div style="font-size:13px;color:var(--text2);margin-bottom:14px">Tu as accepté les conditions. Confirme depuis le prochain écran.</div><button class="btn btn-prim" style="width:100%" onclick="signContract(NEG_IDX);closeNeg();">Signer définitivement →</button><button class="btn btn-sec" style="width:100%;margin-top:8px" onclick="closeNeg()">Retour</button></div>';
  }
 } else if(NEG_STATE.status === "expired" || NEG_STATE.status === "walked_away"){
  if(optsEl){
   var msg = NEG_STATE.status === "walked_away" ? "Tu as quitté la table. L'offre est perdue." : "L'écurie a perdu patience. La discussion est close.";
   optsEl.innerHTML = '<div style="text-align:center;padding:20px"><div style="font-family:var(--font-display);font-size:18px;font-weight:900;color:#EF4444;margin-bottom:6px">Négociation terminée</div><div style="font-size:13px;color:var(--text2);margin-bottom:14px">' + msg + '</div><button class="btn btn-sec" style="width:100%" onclick="closeNeg()">Retour aux offres</button></div>';
  }
 } else {
  if(optsEl){
   optsEl.innerHTML = _negFeedbackHTML(NEG_STATE) + _negActionsListHTML(NEG_STATE, offer);
  }
 }
 // Hide old sliders
 var slEl = document.getElementById("neg-sliders");
 if(slEl) slEl.style.display = "none";
}

function negEnter(idx){
 NEG_IDX = idx;
 _negStart(idx);
 renderNegScreen();
 go("S-neg");
}

// Override the existing functions to redirect through the new system

function updateNegPreview(){ /* deprecated */ }
function submitCounter(){ /* deprecated */ }
function hideSliders(){ var e=document.getElementById("neg-sliders"); if(e) e.style.display="none"; var o=document.getElementById("neg-options"); if(o) o.style.display="block"; }


/* === PANTHÉON v2 — Top 10 par catégorie === */
var HOF_ALLTIME=[
 {name:"Michael Schumacher",nat:"DE",years:"1991–2012",cat:"F1",titles:7,wins:91,score:99,desc:"7 titres, 91 victoires en F1. Le pilote le plus titré de l'histoire moderne."},
 {name:"Lewis Hamilton",nat:"GB",years:"2007–",cat:"F1",titles:7,wins:103,score:99,desc:"Recordman absolu en F1 — 7 titres et 103 victoires."},
 {name:"Juan Manuel Fangio",nat:"AR",years:"1950–1958",cat:"F1",titles:5,wins:24,score:98,desc:"5 titres en 7 saisons. Le pilote ultime des origines."},
 {name:"Ayrton Senna",nat:"BR",years:"1984–1994",cat:"F1",titles:3,wins:41,score:97,desc:"3 titres F1, 65 poles. La vitesse pure incarnée."},
 {name:"Alain Prost",nat:"FR",years:"1980–1993",cat:"F1",titles:4,wins:51,score:95,desc:"Le Professeur. 4 titres, l'art de la stratégie en course."},
 {name:"Tom Kristensen",nat:"DK",years:"1997–2014",cat:"WEC",titles:0,wins:9,score:94,desc:"9 victoires aux 24h du Mans. Le record absolu."},
 {name:"A.J. Foyt",nat:"US",years:"1957–1992",cat:"IndyCar",titles:4,wins:67,score:93,desc:"4 victoires Indy 500, 67 victoires IndyCar. Multi-disciplinaire."},
 {name:"Mario Andretti",nat:"US",years:"1964–1994",cat:"Multi",titles:1,wins:111,score:92,desc:"Champion F1, IndyCar, Indy 500, Daytona. Le plus polyvalent."},
 {name:"Jacky Ickx",nat:"BE",years:"1966–1985",cat:"Multi",titles:0,wins:8,score:91,desc:"6 victoires Le Mans, 8 victoires F1. Roi de l'endurance."},
 {name:"Niki Lauda",nat:"AT",years:"1971–1985",cat:"F1",titles:3,wins:25,score:90,desc:"Revenu de l'enfer du Nürburgring. 3 titres, courage légendaire."}
];

var HOF_F1=[
 {name:"Michael Schumacher",nat:"DE",years:"1991–2012",titles:7,wins:91,poles:68,pods:155,era:"Ferrari / Benetton",score:99,desc:"7 titres, 91 victoires. Le plus grand de tous les temps."},
 {name:"Lewis Hamilton",nat:"GB",years:"2007–",titles:7,wins:103,poles:104,pods:197,era:"Mercedes / McLaren",score:99,desc:"Recordman absolu — 7 titres, 103 victoires, 104 poles."},
 {name:"Juan Manuel Fangio",nat:"AR",years:"1950–1958",titles:5,wins:24,poles:29,pods:35,era:"Multi-écuries",score:97,desc:"5 titres en 7 saisons. Standard absolu de pilotage."},
 {name:"Ayrton Senna",nat:"BR",years:"1984–1994",titles:3,wins:41,poles:65,pods:80,era:"McLaren",score:97,desc:"Le mythe. Vitesse pure et âme de la F1. Disparu trop tôt."},
 {name:"Max Verstappen",nat:"NL",years:"2015–",titles:4,wins:62,poles:40,pods:108,era:"Red Bull",score:96,desc:"4 titres consécutifs. Domination absolue des années 2020."},
 {name:"Alain Prost",nat:"FR",years:"1980–1991, 1993",titles:4,wins:51,poles:33,pods:106,era:"McLaren / Williams",score:95,desc:"Le Professeur. 4 titres, la stratégie érigée en art."},
 {name:"Sebastian Vettel",nat:"DE",years:"2007–2022",titles:4,wins:53,poles:57,pods:122,era:"Red Bull / Ferrari",score:94,desc:"4 titres consécutifs 2010-13. Maestro sous la pluie."},
 {name:"Fernando Alonso",nat:"ES",years:"2001–",titles:2,wins:32,poles:22,pods:106,era:"Renault / Ferrari",score:92,desc:"2 titres en brisant la domination Schumacher."},
 {name:"Niki Lauda",nat:"AT",years:"1971–1985",titles:3,wins:25,poles:24,pods:54,era:"Ferrari / McLaren",score:90,desc:"Revenu de l'enfer. 3 titres, courage infini."},
 {name:"Jim Clark",nat:"GB",years:"1960–1968",titles:2,wins:25,poles:33,pods:32,era:"Lotus",score:89,desc:"Le talent pur. 2 titres, excellence absolue."}
];

var HOF_WEC=[
 {name:"Tom Kristensen",nat:"DK",years:"1997–2014",titles:1,wins:9,poles:0,pods:14,era:"Audi / Bentley",score:99,desc:"\"Mr. Le Mans\" — 9 victoires aux 24h, record absolu."},
 {name:"Jacky Ickx",nat:"BE",years:"1969–1985",titles:0,wins:6,poles:0,pods:11,era:"Ford / Mirage / Porsche",score:97,desc:"6 victoires Le Mans. Pionnier du pilotage moderne."},
 {name:"Derek Bell",nat:"GB",years:"1970–1996",titles:0,wins:5,poles:0,pods:9,era:"Porsche",score:94,desc:"5 victoires Le Mans. La constance personnifiée."},
 {name:"Henri Pescarolo",nat:"FR",years:"1966–1999",titles:0,wins:4,poles:0,pods:7,era:"Matra / Porsche",score:92,desc:"4 victoires Le Mans. 33 participations consécutives."},
 {name:"Yannick Dalmas",nat:"FR",years:"1986–1999",titles:0,wins:4,poles:0,pods:6,era:"Peugeot / McLaren / Porsche",score:91,desc:"4 victoires Le Mans avec 4 marques différentes — unique."},
 {name:"Olivier Gendebien",nat:"BE",years:"1956–1962",titles:0,wins:4,poles:0,pods:6,era:"Ferrari",score:90,desc:"4 victoires Le Mans avec Ferrari. Le pilote endurance des années 60."},
 {name:"Frank Biela",nat:"DE",years:"2000–2007",titles:1,wins:3,poles:0,pods:5,era:"Audi",score:89,desc:"3 victoires Le Mans, champion ALMS. Régularité allemande."},
 {name:"Emanuele Pirro",nat:"IT",years:"1986–2007",titles:1,wins:5,poles:0,pods:7,era:"Audi",score:88,desc:"5 victoires Le Mans. L'ouvrier de l'endurance."},
 {name:"André Lotterer",nat:"DE",years:"2009–",titles:1,wins:3,poles:0,pods:8,era:"Audi / Porsche",score:87,desc:"3 victoires Le Mans, champion WEC 2012. Pilote complet."},
 {name:"Sébastien Buemi",nat:"CH",years:"2014–",titles:3,wins:2,poles:0,pods:11,era:"Toyota",score:86,desc:"3 titres WEC, 2 victoires Le Mans. Roi de l'ère hybride."}
];

var HOF_INDYCAR=[
 {name:"A.J. Foyt",nat:"US",years:"1957–1992",titles:7,wins:67,poles:53,pods:159,era:"Multi-écuries",score:99,desc:"4 victoires Indy 500, 7 titres. La légende absolue de l'IndyCar."},
 {name:"Mario Andretti",nat:"US",years:"1964–1994",titles:4,wins:52,poles:67,pods:144,era:"Multi-écuries",score:98,desc:"Champion IndyCar, F1, Daytona. Le pilote ultime polyvalent."},
 {name:"Rick Mears",nat:"US",years:"1976–1992",titles:3,wins:29,poles:40,pods:75,era:"Penske",score:96,desc:"4 victoires Indy 500. Spécialiste des ovales."},
 {name:"Al Unser Sr.",nat:"US",years:"1965–1994",titles:3,wins:39,poles:27,pods:108,era:"Multi-écuries",score:94,desc:"4 victoires Indy 500. La constance sur 30 ans de carrière."},
 {name:"Bobby Unser",nat:"US",years:"1962–1981",titles:2,wins:35,poles:49,pods:105,era:"Multi-écuries",score:91,desc:"3 victoires Indy 500. Le rival fraternel."},
 {name:"Scott Dixon",nat:"NZ",years:"2003–",titles:6,wins:58,poles:33,pods:147,era:"Chip Ganassi",score:97,desc:"6 titres IndyCar — l'ère moderne. Toujours en activité."},
 {name:"Dario Franchitti",nat:"GB",years:"1997–2013",titles:4,wins:31,poles:29,pods:73,era:"Andretti / Ganassi",score:93,desc:"4 titres, 3 victoires Indy 500. Carrière brisée par blessure."},
 {name:"Sébastien Bourdais",nat:"FR",years:"2003–",titles:4,wins:37,poles:33,pods:94,era:"Newman/Haas",score:90,desc:"4 titres consécutifs Champ Car. Élégance française."},
 {name:"Hélio Castroneves",nat:"BR",years:"2001–",titles:0,wins:31,poles:51,pods:84,era:"Penske / Meyer Shank",score:89,desc:"4 victoires Indy 500. Le showman aux 4 victoires."},
 {name:"Will Power",nat:"AU",years:"2005–",titles:2,wins:45,poles:71,pods:99,era:"Penske",score:88,desc:"71 poles — record IndyCar. 2 titres, vitesse pure."}
];

/* Pour rétrocompatibilité, HOF_LEGENDS pointe maintenant vers HOF_F1 */

/* === PANTHÉON v2 — Render avec onglets === */
var HOF_TAB = "alltime";

function pantheonTab(tab){
 HOF_TAB = tab;
 var tabs = document.querySelectorAll(".pant-tab");
 tabs.forEach(function(b){
  b.classList.toggle("on", b.getAttribute("data-tab") === tab);
 });
 var subEl=document.getElementById("hof-hdr-sub");
 if(subEl){
  var subs={alltime:"Les meilleurs pilotes de l'histoire",f1:"Les légendes de la Formule 1",wec:"Les rois du Mans et de l'endurance",indycar:"Les héros des ovales américains"};
  subEl.textContent=subs[tab]||subs.alltime;
 }
 renderHof();
}

function _hofLegendCard(e, idx){
 var medalColors = ["#F59E0B","#9CA3AF","#CD7F32"];
 var rankColor = medalColors[idx] || "var(--text3)";
 var flag = (typeof flagSvg === "function") ? flagSvg(e.nat, 22) : "";
 var html = "";
 html += '<div class="pant-card">';
 html += '<div class="pant-card-top">';
 html += '<span class="pant-rank" style="color:' + rankColor + '">' + (idx + 1) + '</span>';
 html += flag;
 html += '<div class="pant-name-block">';
 html += '<div class="pant-name">' + e.name + '</div>';
 html += '<div class="pant-era">' + (e.era || (e.cat || "")) + ' · ' + e.years + '</div>';
 html += '</div>';
 html += '<span class="pant-score">' + e.score + '</span>';
 html += '</div>';
 var stats = [];
 if(e.titles !== undefined && e.titles > 0) stats.push('<span class="pant-stat-titles">' + e.titles + ' titre' + (e.titles > 1 ? "s" : "") + '</span>');
 if(e.wins !== undefined && e.wins > 0) stats.push('<span class="pant-stat-wins">' + e.wins + ' V</span>');
 if(e.poles !== undefined && e.poles > 0) stats.push('<span class="pant-stat-poles">' + e.poles + ' poles</span>');
 if(e.pods !== undefined && e.pods > 0) stats.push('<span class="pant-stat-pods">' + e.pods + ' podiums</span>');
 if(stats.length > 0){
  html += '<div class="pant-stats-row">' + stats.join("") + '</div>';
 }
 html += '<div class="pant-desc">' + e.desc + '</div>';
 html += '</div>';
 return html;
}


/* === MULTI-CATEGORY HOF — generalized scoring === */
function getCatStats(cat){
 var hist=(CAREER_HISTORY||[]).filter(function(s){return s&&s.cat===cat;});
 var inCat=G.cat===cat;
 var races=inCat&&G.races?G.races:[];
 return{
  cat:cat,
  inCurrent:inCat,
  wins:hist.reduce(function(t,s){return t+(s.wins||0);},0)+races.filter(function(r){return r&&r.pos===1;}).length,
  pods:hist.reduce(function(t,s){return t+(s.pods||0);},0)+races.filter(function(r){return r&&r.pos>=1&&r.pos<=3;}).length,
  top5:hist.reduce(function(t,s){return t+(s.top5||0);},0)+races.filter(function(r){return r&&r.pos>=1&&r.pos<=5;}).length,
  dnfs:hist.reduce(function(t,s){return t+(s.dnfs||0);},0)+races.filter(function(r){return r&&r.pos===0;}).length,
  pts:hist.reduce(function(t,s){return t+(s.pts||0);},0)+(inCat&&G.champPts||0),
  races:hist.reduce(function(t,s){return t+(s.races||0);},0)+races.length,
  titles:hist.filter(function(s){return s&&s.pos===1;}).length,
  seasons:hist.length+(inCat?1:0)
 };
}

function calcCatHofScore(cat){
 var s=getCatStats(cat);
 var rating=(typeof calcPlayerRating==='function')?calcPlayerRating():70;
 var rep=G.reputation||0;
 // For HOF tabs, less weight on rating (a bigger career counts more than current rating).
 // Same general formula as F1 but applied to the specific category.
 var score=18*s.titles+Math.min(28,.8*s.wins)+Math.min(20,.65*(rating-60))+Math.min(12,.22*(rep-30))+Math.min(8,.12*s.pods);
 return{cat:cat,score:Math.max(0,Math.round(score)),stats:s,rating:rating};
}

/* For "Top 10 toutes catégories" we sum / weight from F1, WEC, IndyCar */
function calcAllTimeHofScore(){
 var f1=calcCatHofScore("Formule 1");
 var wec=calcCatHofScore("Endurance WEC");
 var indy=calcCatHofScore("IndyCar");
 // Weighted: F1 is most prestigious. WEC/Indy add bonus titles.
 var combined=f1.score+(wec.score*0.65)+(indy.score*0.65);
 return{
  score:Math.min(100,Math.round(combined)),
  f1:f1,wec:wec,indy:indy,
  combinedTitles:f1.stats.titles+wec.stats.titles+indy.stats.titles,
  combinedWins:f1.stats.wins+wec.stats.wins+indy.stats.wins
 };
}

/* Helper: returns active player as a "legend card data" for given tab */
function _getPlayerHofEntry(tab){
 var name=(G.pilot&&((G.pilot.prenom||'')+' '+(G.pilot.nom||''))).trim()||"Toi";
 var nat=G.pilot&&G.pilot.nat||'FR';
 var year=G.year||(typeof START_YEAR!=='undefined'?START_YEAR:new Date().getFullYear());
 if(tab==='alltime'){
  var d=calcAllTimeHofScore();
  return{
   name:name,nat:nat,
   years:String(year)+'+',
   cat:'Multi',titles:d.combinedTitles,wins:d.combinedWins,
   score:d.score,
   era:'Carrière en cours',
   desc:'Toi — pilote actuel. Ton score combine tes résultats F1, Endurance et IndyCar.',
   _isPlayer:true
  };
 }
 var catMap={f1:'Formule 1',wec:'Endurance WEC',indycar:'IndyCar'};
 var cat=catMap[tab];
 if(!cat)return null;
 var d=calcCatHofScore(cat);
 var s=d.stats;
 return{
  name:name,nat:nat,
  years:String(year)+'+',
  era:'Carrière en cours',
  titles:s.titles,wins:s.wins,pods:s.pods,
  score:d.score,
  desc:'Toi — pilote actuel. '+s.seasons+' saison'+(s.seasons!==1?'s':'')+' en '+cat+'.',
  _isPlayer:true
 };
}

function _renderHofLegends(){
 var container = document.getElementById("hof-legends");
 if(!container) return;
 var data, tabLabel, tabSubLabel;
 switch(HOF_TAB){
  case "f1":
   data = HOF_F1; tabLabel = "Top 10 F1"; tabSubLabel = "Les plus grands de la Formule 1";
   break;
  case "wec":
   data = HOF_WEC; tabLabel = "Top 10 Endurance"; tabSubLabel = "Les rois du Mans et du WEC";
   break;
  case "indycar":
   data = HOF_INDYCAR; tabLabel = "Top 10 IndyCar"; tabSubLabel = "Les légendes des ovales et des routes US";
   break;
  case "alltime":
  default:
   data = HOF_ALLTIME; tabLabel = "Top 10 toutes catégories"; tabSubLabel = "Les plus grands pilotes de l'histoire";
   break;
 }
 // Try to integrate player into the ranking
 var playerEntry=(typeof _getPlayerHofEntry==='function')?_getPlayerHofEntry(HOF_TAB):null;
 var allEntries=data.slice();
 if(playerEntry&&playerEntry.score>0){allEntries.push(playerEntry);}
 var sorted = allEntries.sort(function(a,b){return b.score - a.score;});
 // Keep top 10 + player if outside top 10
 var top10=sorted.slice(0,10);
 var playerInTop=playerEntry?top10.some(function(e){return e._isPlayer;}):true;
 var displayed=top10.slice();
 var playerRank=null;
 if(playerEntry&&!playerInTop){
  // find player rank in full list
  for(var i=0;i<sorted.length;i++){if(sorted[i]._isPlayer){playerRank=i+1;break;}}
 }
 var html = "";
 html += '<div class="pant-tab-header">';
 html += '<div class="pant-tab-title">' + tabLabel + '</div>';
 html += '<div class="pant-tab-sub">' + tabSubLabel + '</div>';
 html += '</div>';
 html += '<div class="pant-cards-list">';
 displayed.forEach(function(legend, i){
  html += _hofLegendCard(legend, i);
 });
 // If player is outside top 10, show separator + player card with their actual rank
 if(playerEntry&&!playerInTop&&playerRank){
  html += '<div style="text-align:center;font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--text3);letter-spacing:.18em;text-transform:uppercase;margin:10px 0 6px;padding:0 16px">— Ton classement —</div>';
  html += _hofLegendCard(playerEntry, playerRank-1);
 } else if(playerEntry&&playerEntry.score===0){
  html += '<div style="margin:14px 16px 6px;padding:14px 16px;border:1px dashed var(--border);background:var(--bg3);border-radius:10px;text-align:center;font-size:12px;color:var(--text3);line-height:1.5">Aucun résultat pour ce classement.<br>Course '+(HOF_TAB==='f1'?'en F1':HOF_TAB==='wec'?'en Endurance':HOF_TAB==='indycar'?'en IndyCar':'dans plusieurs disciplines')+' pour y entrer.</div>';
 }
 html += '</div>';
 container.innerHTML = html;
}

function renderHof(){
 var e=document.getElementById("hof-player-rank");
 if(e){
  // Compute player's score for the CURRENT TAB instead of forcing F1 only
  var tab=HOF_TAB||'alltime';
  var data, scoreLabel;
  if(tab==='f1'){var d=calcCatHofScore("Formule 1");data={score:d.score,stats:d.stats,rating:d.rating};scoreLabel='Score F1';}
  else if(tab==='wec'){var d=calcCatHofScore("Endurance WEC");data={score:d.score,stats:d.stats,rating:d.rating};scoreLabel='Score Endurance';}
  else if(tab==='indycar'){var d=calcCatHofScore("IndyCar");data={score:d.score,stats:d.stats,rating:d.rating};scoreLabel='Score IndyCar';}
  else {var d=calcAllTimeHofScore();data={score:d.score,combinedTitles:d.combinedTitles,combinedWins:d.combinedWins,rating:(typeof calcPlayerRating==='function'?calcPlayerRating():70)};scoreLabel='Score global';}
  var score=data.score;
  var rank=getHofRankLabel(score);
  var rating=data.rating;
  var rep=G.reputation||0;
  var name=(G.pilot&&G.pilot.nom)||"?";
  // Build stats badges based on tab
  var statsHtml='';
  if(tab==='alltime'){
   statsHtml += '<span>'+(data.combinedTitles||0)+' titre'+(data.combinedTitles!==1?'s':'')+' (toutes disciplines)</span>';
   statsHtml += '<span>'+(data.combinedWins||0)+' V</span>';
   statsHtml += '<span>Note '+rating+'</span>';
  } else {
   var s=data.stats;
   statsHtml += '<span>'+s.titles+' titre'+(s.titles!==1?'s':'')+'</span>';
   statsHtml += '<span>'+s.wins+' V</span>';
   statsHtml += '<span>'+s.pods+' podiums</span>';
   statsHtml += '<span>'+s.races+' courses</span>';
   statsHtml += '<span>Note '+rating+'</span>';
  }
  var pantBadge=score>=80?'<div style="margin-top:10px;padding:8px 12px;background:#1a1100;border-radius:8px;font-size:12px;color:var(--gold)">Félicitations ! Tu entres au Panthéon !</div>':'';
  e.innerHTML='<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px"><span style="font-size:32px">'+rank.icon+'</span><div><div style="font-size:15px;font-weight:700;color:'+rank.color+'">'+rank.label+'</div><div style="font-size:12px;color:var(--text3);margin-top:1px">'+name+' · '+scoreLabel+' : '+score+' / 100</div></div><span style="margin-left:auto;font-size:22px;font-weight:900;color:'+rank.color+'">'+score+'</span></div><div style="background:var(--border);border-radius:4px;height:6px;overflow:hidden"><div style="height:100%;width:'+score+'%;background:'+rank.color+';border-radius:4px;transition:width .6s ease"></div></div><div style="display:flex;flex-wrap:wrap;gap:10px 18px;margin-top:10px;font-size:11px;color:var(--text3)">'+statsHtml+'</div>'+pantBadge;
 }
 _renderHofLegends();
}

/* === JOURNALIST QUESTION BANK v2 — Vraies questions + réponses spécifiques === */
var JOURNALIST_QUESTIONS = {
 // Supportif : journaliste bienveillant, questions ouvertes positives
 supportif: [
  {
   q: "Tu as l'air de bien progresser cette saison. Quel est ton secret ?",
   answers: [
    {label: "Le travail acharné, point", desc: "Réponse classique mais sincère", repDelta: 2, msg: "Le journaliste apprécie l'humilité."},
    {label: "Une équipe en or autour de moi", desc: "Tu mets en avant l'écurie", repDelta: 3, msg: "L'écurie adore ce genre de phrase. Article positif."},
    {label: "L'expérience accumulée année après année", desc: "Tu prends de la hauteur", repDelta: 2, msg: "Réponse mature, bien reçue."},
    {label: "Un peu de chance aussi, soyons honnête", desc: "Tu ironises", repDelta: 1, msg: "Le journaliste sourit, article sympa."}
   ]
  },
  {
   q: "Quel objectif pour la suite de la saison ?",
   answers: [
    {label: "Gagner. Pas autre chose", desc: "Tu vises haut", repDelta: 3, msg: "Phrase choc, le journaliste la met en titre."},
    {label: "Continuer à progresser week-end après week-end", desc: "Tu restes humble", repDelta: 2, msg: "Réponse posée, bien reçue."},
    {label: "Marquer le plus de points possible", desc: "Tu es pragmatique", repDelta: 1, msg: "Pas la phrase la plus inspirée."},
    {label: "Apprendre de chaque erreur", desc: "Tu joues la sagesse", repDelta: 2, msg: "Réponse de pilote mature."}
   ]
  },
  {
   q: "Comment gères-tu la pression médiatique à ton niveau ?",
   answers: [
    {label: "Je ne lis pas la presse, je me concentre sur la piste", desc: "Tu mets de la distance", repDelta: 1, msg: "Un peu froid. Le journaliste le note."},
    {label: "Je l'utilise comme carburant", desc: "Tu transformes en force", repDelta: 3, msg: "Belle punchline, excellente reprise."},
    {label: "C'est plus dur que ce qu'on imagine", desc: "Tu ouvres ton cœur", repDelta: 3, msg: "Le journaliste apprécie la sincérité."},
    {label: "Mon coach mental m'aide beaucoup", desc: "Tu cites ton entourage", repDelta: 2, msg: "Réponse pro, tu valorises ton équipe."}
   ]
  }
 ],
 // Analytique : journaliste technique, questions précises
 analytique: [
  {
   q: "Comment expliques-tu ce déficit de vitesse en ligne droite ce week-end ?",
   answers: [
    {label: "Notre setup privilégiait la maniabilité en virage", desc: "Réponse technique", repDelta: 2, msg: "Réponse claire. Le journaliste comprend."},
    {label: "L'équipe travaille déjà sur des évolutions moteur", desc: "Tu rassures", repDelta: 2, msg: "Tu protèges l'équipe sans noyer le poisson."},
    {label: "C'est notre faiblesse structurelle cette saison", desc: "Tu admets le problème", repDelta: 1, msg: "Honnête mais l'équipe va tiquer."},
    {label: "Pas de déficit, juste une question de batterie", desc: "Tu nies le problème", repDelta: -2, msg: "Le journaliste a les chiffres. Réponse douteuse."}
   ]
  },
  {
   q: "Tu as eu trois sous-virages au virage 8 — problème de pneus ou de châssis ?",
   answers: [
    {label: "Dégradation des pneus avant en fin de relais", desc: "Diagnostic technique", repDelta: 3, msg: "Excellent diagnostic, tu impressionnes."},
    {label: "Setup trop directif, on rectifiera", desc: "Tu pointes le réglage", repDelta: 2, msg: "Réponse précise, l'équipe va apprécier."},
    {label: "Erreur de pilotage de ma part", desc: "Tu prends sur toi", repDelta: 2, msg: "Honnêteté appréciée, mais l'équipe note."},
    {label: "Tu poses trop de questions techniques", desc: "Tu esquives", repDelta: -3, msg: "Réponse sèche, le journaliste l'écrit."}
   ]
  },
  {
   q: "Avec ces nouveaux règlements, où penses-tu que ton écurie peut gagner ?",
   answers: [
    {label: "L'aéro de notre fond plat est en avance", desc: "Tu vantes une force", repDelta: 2, msg: "Bonne lecture technique."},
    {label: "Sur la stratégie pneus, on est forts", desc: "Tu valorises le team", repDelta: 2, msg: "Le team principal va aimer."},
    {label: "Honnêtement, on cherche encore", desc: "Tu admets le retard", repDelta: 1, msg: "Honnête mais ça affaiblit l'image."},
    {label: "Top secret, je peux pas dire", desc: "Tu joues le mystère", repDelta: 2, msg: "Réponse coquette, le journaliste rit."}
   ]
  }
 ],
 // Hostile : journaliste qui cherche le clash
 hostile: [
  {
   q: "Trois courses sans podium. C'est toi le problème ou la voiture ?",
   answers: [
    {label: "C'est l'équipe entière qui doit progresser", desc: "Tu protèges l'équipe", repDelta: 2, msg: "Réponse de capitaine, bien vu."},
    {label: "C'est moi, je dois mieux faire", desc: "Tu prends sur toi", repDelta: 1, msg: "Trop autocritique pour son article."},
    {label: "Question typique de la presse à scandale", desc: "Tu attaques", repDelta: -3, msg: "Le journaliste va t'écharper."},
    {label: "Tu ferais mieux de regarder les chiffres", desc: "Tu rétorques sec", repDelta: -2, msg: "Échange tendu, photo virale."}
   ]
  },
  {
   q: "Beaucoup disent que ton coéquipier te domine. Réponse ?",
   answers: [
    {label: "On verra à la fin de la saison", desc: "Tu joues la patience", repDelta: 2, msg: "Réponse zen, déstabilise le journaliste."},
    {label: "Il a eu plus de chance, je suis plus rapide en quali", desc: "Tu attaques le partner", repDelta: -2, msg: "Article tendu, le partner a vu."},
    {label: "Il fait un super boulot, j'apprends de lui", desc: "Tu joues la classe", repDelta: 3, msg: "Phrase superbe. Article élogieux."},
    {label: "Sans commentaire", desc: "Tu refuses", repDelta: -1, msg: "Le silence est interprété comme un aveu."}
   ]
  },
  {
   q: "Tu es payé combien pour aussi peu de résultats ?",
   answers: [
    {label: "Pas tes affaires", desc: "Tu coupes court", repDelta: -1, msg: "Sec, mais légitime. Le journaliste insiste."},
    {label: "Je suis payé pour bosser, pas pour répondre", desc: "Tu redirige", repDelta: 1, msg: "Réponse de pro, bien tournée."},
    {label: "Demande à mon agent", desc: "Tu botte en touche", repDelta: 0, msg: "Esquive standard, sans surprise."},
    {label: "Suffisamment pour ne pas répondre à ce genre de question", desc: "Tu joues l'arrogance", repDelta: -3, msg: "Mauvaise punchline, le journaliste a son titre."}
   ]
  }
 ],
 // Sarcastique : journaliste qui veut du buzz
 sarcastique: [
  {
   q: "Alors, ton GP, tu le résumerais comment en une phrase ?",
   answers: [
    {label: "Pas mon meilleur, mais on apprend", desc: "Tu joues la sagesse", repDelta: 2, msg: "Le journaliste cherchait mieux."},
    {label: "Une fessée publique en direct", desc: "Tu joues l'autodérision", repDelta: 3, msg: "Excellent ! Le journaliste adore."},
    {label: "Très bon week-end, merci", desc: "Tu botte en touche", repDelta: -1, msg: "Trop plat pour un sarcastique. Article moqueur."},
    {label: "On a perdu mais on a perdu avec style", desc: "Tu joues la classe", repDelta: 2, msg: "Phrase qui fait sourire, bien reprise."}
   ]
  },
  {
   q: "On dit que tu es le pilote le plus surcoté du paddock. Vrai ou faux ?",
   answers: [
    {label: "Faux. Et tu le sais", desc: "Tu réponds direct", repDelta: 1, msg: "Réponse simple, ça passe."},
    {label: "Demande à mes résultats, pas à moi", desc: "Tu joues la confiance", repDelta: 3, msg: "Excellente répartie, qui marque."},
    {label: "Si tu le dis...", desc: "Tu fais le bébête", repDelta: -2, msg: "Le journaliste te démolit dans son article."},
    {label: "Mieux vaut être surcoté que invisible comme certains", desc: "Tu attaques tes rivaux", repDelta: 0, msg: "Punchline qui crée du buzz, mais clivante."}
   ]
  },
  {
   q: "Si tu devais te définir en un meme, lequel ?",
   answers: [
    {label: "Le chien qui regarde le feu : 'this is fine'", desc: "Tu joues l'humour", repDelta: 3, msg: "Phrase culte, partage massif."},
    {label: "Je ne fais pas dans les memes", desc: "Tu refuses", repDelta: -1, msg: "Trop sec, le journaliste te boude."},
    {label: "Le chat qui plane (Astro Cat)", desc: "Référence pop", repDelta: 2, msg: "Bonne référence, fans amusés."},
    {label: "Drake disant non puis oui", desc: "Référence rap", repDelta: 2, msg: "Sympa, ça circule sur les réseaux."}
   ]
  }
 ]
};

function _pickJournalistQuestion(angle){
 var bank = JOURNALIST_QUESTIONS[angle] || JOURNALIST_QUESTIONS.supportif;
 return bank[Math.floor(Math.random() * bank.length)];
}

function _journalistMailActions(question, journalistAngle){
 // Convert question.answers into mail action entries
 var actions = [];
 question.answers.forEach(function(ans){
  actions.push({
   label: ans.label,
   kind: "reply",
   effect: {
    type: "rep",
    data: {delta: ans.repDelta, reason: ans.msg}
   },
   _ansMsg: ans.msg
  });
 });
 // Add a "decline" option for hostile/sarcastic
 if(journalistAngle === "hostile" || journalistAngle === "sarcastique"){
  actions.push({
   label: "Refuser de répondre",
   kind: "dismiss",
   effect: {type: "rep", data: {delta: -2, reason: "Le journaliste a noté ton refus."}}
  });
 }
 return actions;
}

// Override the original maybeSendJournalistMail
function maybeSendJournalistMail(e, t){
 var r = getMediaState();
 if(Math.random() > 0.25) return;
 var n = Object.keys(JOURNALISTS);
 var a = n[Math.floor(Math.random() * n.length)];
 var i = JOURNALISTS[a];
 var o = r.journalists[a];
 if(!o) return;
 // Pick a real question for this angle
 var question = _pickJournalistQuestion(i.angle);
 // Build subject
 var subject;
 if(i.angle === "supportif") subject = "Quelques mots pour notre rubrique";
 else if(i.angle === "hostile") subject = "Question difficile à te poser";
 else if(i.angle === "sarcastique") subject = "Une réaction, sans langue de bois ?";
 else subject = "Question technique";
 // Body : journalist intro + actual question
 var body = "<strong>" + i.name + "</strong> de <strong>" + i.outlet + "</strong> :<br><br>" +
            "« " + question.q + " »";
 if(typeof pushMail === "function"){
  pushMail({
   role: "journalist",
   from: i.name + " (" + i.outlet + ")",
   subject: subject,
   body: body,
   actions: _journalistMailActions(question, i.angle)
  });
  o.interactions++;
 }
}





