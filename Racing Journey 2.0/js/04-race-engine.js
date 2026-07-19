if(typeof renderIcon!=="function"){renderIcon=function(i,s,c){return "";}}
// === Racing Journey: F1 Dreams ===
// Module: 04-race-engine
// Qualifs, simulation course, rivalités
// Taille: 409,355 chars

var QUALI_STATE={session:0,drivers:[],survived:[],baseRef:0,phase:"idle",nextSurvived:[],spectatorMode:!1,playerElimSes:0,playerFinalPos:void 0,chronoInterval:null,lapInterval:null},QUALI_DURATION={1:12,2:10,3:8};
// #2 + #6 — Format de qualif par catégorie. Toutes les cats non-F1 (et non-IndyCar road) font 1 session unique.
// Durées corrigées par cat. Pour F1 : 18/15/12 min IRL (au lieu de 12/10/8).
function _qualiFormatForCat(cat){
 cat=cat||(typeof G!=="undefined"&&G.cat)||"Karting Junior";
 // Format par cat : maxSessions, duration en minutes par session
 // singleSession = vrai si une seule session de chrono (pas d'élimination cascade)
 var f={
  "Karting Junior":{maxSessions:1,duration:{1:8},singleSession:true},
  "Karting Senior":{maxSessions:1,duration:{1:10},singleSession:true},
  "Formule 4":{maxSessions:1,duration:{1:20},singleSession:true},
  "Formula Regional":{maxSessions:1,duration:{1:20},singleSession:true},
  "Formule 3":{maxSessions:1,duration:{1:30},singleSession:true},
  "Formule 2":{maxSessions:1,duration:{1:45},singleSession:true},
  "Formule 1":{maxSessions:3,duration:{1:18,2:15,3:12},singleSession:false},
  "Super Formula":{maxSessions:1,duration:{1:20},singleSession:true},
  "Endurance WEC":{maxSessions:1,duration:{1:15},singleSession:true},
  "IndyCar":{maxSessions:3,duration:{1:12,2:10,3:6},singleSession:false}
 };
 var result=f[cat]||f["Formule 1"];
 // #9 — IndyCar oval : single-car run (pas de Q1/Q2/Q3, juste un classement par chrono).
 // En IndyCar réel, les qualifs ovales se font pilote par pilote en solo. On modélise par singleSession.
 if(cat==="IndyCar"&&typeof _isIndyOval==="function"){
  var nextRace=(typeof getNextRace==="function")?getNextRace():null;
  var circuitName=nextRace?nextRace.name:(typeof RACE_STATE!=="undefined"&&RACE_STATE&&RACE_STATE.circuit)||"";
  if(_isIndyOval(circuitName)){
   return{maxSessions:1,duration:{1:15},singleSession:true};
  }
 }
 return result;
}
function _qualiMaxSessions(cat){return _qualiFormatForCat(cat).maxSessions}
/* COURSES SPRINT (F1/F2/F3) — Implémentation réaliste pour mobile.
   Approche : sur certaines manches du calendrier (sprint weekend), une mini-course (~33% des tours)
   se dispute avant la course longue. Points sprint réduits, pas de pit (réaliste F1).
   Activé pour F1 (manches 4, 7, 11, 14, 17 ~30%) et F2/F3 (toutes les manches).
   Pas de sprint en karting/F4/FR/SF/WEC/IndyCar (formats incompatibles). */
function _getPtsTable(){var _c=(typeof G!=="undefined"&&G.cat)||"";
var _T={"Karting Junior":[34,30,27,25,23,21,19,17,15,13,11,10,9,8,7,6,5,4,3,2,1],"Karting Senior":[34,30,27,25,23,21,19,17,15,13,11,10,9,8,7,6,5,4,3,2,1],"Formule 4":[25,18,15,12,10,8,6,4,2,1],"Formula Regional":[25,18,15,12,10,8,6,4,2,1],"Formule 3":[25,18,15,12,10,8,6,4,2,1],"Formule 2":[25,18,15,12,10,8,6,4,2,1],"Formule 1":[25,18,15,12,10,8,6,4,2,1],"Super Formula":[20,15,11,8,6,5,4,3,2,1],"Endurance WEC":[25,18,15,12,10,8,6,4,2,1],"IndyCar":[50,40,35,32,30,28,26,24,22,20,19,18,17,16,15,14,13,12,10,8]};
return _T[_c]||_T["Formule 1"];}
function _getSprintPtsTable(){var _c=(typeof G!=="undefined"&&G.cat)||"";
if(_c==="Formule 1")return[8,7,6,5,4,3,2,1];
if(_c==="Formule 2")return[10,8,6,5,4,3,2,1];
if(_c==="Formule 3")return[6,5,4,3,2,1];
return[8,7,6,5,4,3,2,1];}
var SPRINT_PTS_TABLE=[8,7,6,5,4,3,2,1,0,0,0,0,0,0,0,0,0,0,0,0]; // F1 : top 8 marquent
function _isSprintCategory(cat){
 cat=cat||(typeof G!=="undefined"&&G.cat)||"";
 return cat==="Formule 1"||cat==="Formule 2"||cat==="Formule 3";
}
function _isSprintWeekendForRace(race){
 if(!race||typeof race.manche!=="number")return false;
 var cat=(typeof G!=="undefined"&&G.cat)||"";
 if(!_isSprintCategory(cat))return false;
 if(cat==="Formule 1"){
  // F1 : 5 manches sprint tirées aléatoirement par saison via buildCalendar (PRNG seedé par G.saison)
  // → on consulte simplement le flag posé sur l'objet race
  return race.isSprint===true;
 }
 // F2 et F3 : toutes les manches ont une sprint (réaliste)
 return true;
}
function _isCurrentRaceSprintWeekend(){
 var nextRace=(typeof getNextRace==="function")?getNextRace():null;
 return _isSprintWeekendForRace(nextRace);
}
function _shouldRunSprintNow(){
 if(!_isCurrentRaceSprintWeekend())return false;
 if(typeof RACE_WEEKEND_STATE==="undefined")return false;
 // Quali doit être faite mais sprint pas encore
 return RACE_WEEKEND_STATE.qualifDone&&!RACE_WEEKEND_STATE.sprintDone;
}
/* COURSES SPRINT — fin */
function _qualiDurationFor(cat,session){
 var fmt=_qualiFormatForCat(cat);
 return fmt.duration[session]||(fmt.singleSession?fmt.duration[1]:QUALI_DURATION[session]||10);
}
/* #5 — Essais libres (Free Practice). 
   Mini-session optionnelle avant la qualif. Le joueur choisit 1 objectif parmi 4 :
   - "pace" : pace pure (concentration + vitesse_pure) → bonus de quali
   - "setup" : réglages (decision + technique/freinage) → bonus pace en course
   - "long_run" : usure pneus (gestion_pneus) → réduction wear
   - "weather" : conditions piste (adapt) → atténue malus météo
   Selon la stat principale, on tire un résultat brillant/succes/neutre/rateMin/rateMaj qui
   définit l'amplitude du bonus stocké dans RACE_STATE._fpBonus.
   Skippable. Le bonus ne dure que pour ce week-end (reset à initRaceState). */
function _fpComputeOutcome(skill){
 // skill 0..1 → distribution biaisée vers le haut si élevé
 var r=Math.random();
 var s=Math.max(0,Math.min(1,skill));
 // Probas basées sur skill (style _computeChoiceOutcomes)
 var pBrill=0.05+0.20*s;     // 5%..25%
 var pSucc=0.30+0.20*s;       // 30%..50%
 var pNeut=0.25;              // ~25%
 var pRateMin=0.25-0.15*s;    // 25%..10%
 // pRateMaj = reste
 var c=0;
 if(r<(c+=pBrill))return "brillant";
 if(r<(c+=pSucc))return "succes";
 if(r<(c+=pNeut))return "neutre";
 if(r<(c+=pRateMin))return "rateMin";
 return "rateMaj";
}
function _fpObjectives(){
 // Retourne les 6 objectifs avec leur stat dominante et les bonus associés
 var ss=(typeof G!=="undefined"&&G.substats)||{};
 var avg=function(a,b){return ((ss[a]||50)+(ss[b]||50))/200};
 return [
  {id:"pace",label:"Pace pure",icon:"⚡",desc:"Tour rapide en quali",
   stat:"vitesse_pure + concentration",skill:avg("vitesse_pure","concentration"),
   bonusType:"qualiPace"},
  {id:"setup",label:"Réglages",icon:"🔧",desc:"Optimiser le setup pour la course",
   stat:"decision + freinage",skill:avg("decision","freinage"),
   bonusType:"racePace"},
  {id:"long_run",label:"Long run",icon:"🏁",desc:"Gestion des pneus en course",
   stat:"gestion_pneus",skill:(ss.gestion_pneus||50)/100,
   bonusType:"tyreWear"},
  {id:"weather",label:"Conditions",icon:"🌤",desc:"Lire la météo et la piste",
   stat:"adapt + sangfroid",skill:avg("adapt","sangfroid"),
   bonusType:"weather"},
  {id:"setup_adv",label:"Réglage fin",icon:"⚙",desc:"Affiner les paramètres avancés du setup",
   stat:"decision + reactivite",skill:avg("decision","reactivite"),
   bonusType:"setupAdv"},
  {id:"team_trust",label:"Debriefing équipe",icon:"👥",desc:"Analyser les données avec les ingénieurs",
   stat:"decision + concentration",skill:avg("decision","concentration"),
   bonusType:"teamTrust"}
 ];
}
function _fpApplyOutcome(obj,outcome){
 var amp={brillant:1.0,succes:0.65,neutre:0.30,rateMin:-0.15,rateMaj:-0.40}[outcome]||0;
 var bonus={};
 if(obj.bonusType==="qualiPace"){
  bonus.qualiPace=amp*0.04;
 }else if(obj.bonusType==="racePace"){
  bonus.racePace=-amp*0.03;
 }else if(obj.bonusType==="tyreWear"){
  bonus.tyreWearMult=1-amp*0.20;
 }else if(obj.bonusType==="weather"){
  bonus.weatherMul=1-amp*0.30;
 }else if(obj.bonusType==="setupAdv"){
  // Améliore 2 paramètres de setupAdv aléatoires (vers leur valeur optimale 7)
  bonus.setupAdv=true;
  bonus.setupAmp=amp; // amplitude -1 à +1
  if(typeof G!=="undefined"&&G.setupAdv&&amp>0){
   // Identifier les paramètres les plus éloignés de 7 et les corriger
   var keys=Object.keys(G.setupAdv);
   // Classer par distance à 7
   keys.sort(function(a,b){return Math.abs(G.setupAdv[b]-7)-Math.abs(G.setupAdv[a]-7)});
   var n=amp>=0.65?3:amp>=0.30?2:1;
   for(var i=0;i<Math.min(n,keys.length);i++){
    var k=keys[i];
    var cur=G.setupAdv[k];
    var delta=(7-cur)*amp*0.4; // converge vers 7 de 40% si brillant
    G.setupAdv[k]=Math.round(Math.max(1,Math.min(10,cur+delta)));
   }
   bonus.setupAdjusted=keys.slice(0,n);
  }else if(typeof G!=="undefined"&&G.setupAdv&&amp<0){
   // Mauvaise session : dérègle légèrement
   var keys2=Object.keys(G.setupAdv);
   var k2=keys2[Math.floor(Math.random()*keys2.length)];
   G.setupAdv[k2]=Math.max(1,Math.min(10,G.setupAdv[k2]+Math.round(amp*2)));
   bonus.setupDeranged=k2;
  }
 }else if(obj.bonusType==="teamTrust"){
  // Impact sur la confiance équipe
  bonus.teamTrust=true;
  bonus.trustDelta=Math.round(amp*5); // brillant = +5, raté = -2
  if(typeof changeTrust==="function"&&bonus.trustDelta!==0){
   if(bonus.trustDelta>0){
    changeTrust(bonus.trustDelta,"Bon debriefing EL","↑");
   }else{
    changeTrust(bonus.trustDelta,"Mauvaise session EL","↓");
   }
  }
 }
 return bonus;
}
function _showFreePracticePopup(onDone){
 // Affiche la popup FP. Appelle onDone() une fois la session terminée (ou skippée).
 if(typeof document==="undefined"){if(onDone)onDone();return}
 var existing=document.getElementById("fp-popup-overlay");
 if(existing)existing.remove();
 var overlay=document.createElement("div");
 overlay.id="fp-popup-overlay";
 overlay.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:9500;display:flex;align-items:center;justify-content:center;padding:18px";
 var card=document.createElement("div");
 card.style.cssText="background:var(--surface,#16161D);border:1px solid var(--border,#2A2A35);border-radius:14px;padding:18px 16px 14px;max-width:400px;width:100%;box-shadow:0 12px 38px rgba(0,0,0,0.65);max-height:90vh;overflow-y:auto";
 var titleHTML='<div style="font-family:var(--font-display);font-size:11px;font-weight:800;color:#60A5FA;letter-spacing:.14em;text-transform:uppercase;margin-bottom:4px">'+renderIcon('analyse_donnees',14,'#60A5FA')+' Essais libres (optionnel)</div>';
 titleHTML+='<div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:3px">Sur quoi tu te concentres ?</div>';
 titleHTML+='<div style="font-size:11px;color:var(--text3);margin-bottom:14px">Une bonne séance = un bonus pour le week-end. Un mauvais run = un petit malus.</div>';
 var objs=_fpObjectives();
 var choicesHTML="";
 objs.forEach(function(obj){
  var skillPct=Math.round(obj.skill*100);
  var skillColor=obj.skill>0.65?"#34D399":obj.skill>0.45?"#F59E0B":"#EF4444";
  var skillTxt=obj.skill>0.65?"Bon niveau":obj.skill>0.45?"Niveau moyen":"Niveau faible";
  choicesHTML+='<button data-objid="'+obj.id+'" style="display:block;width:100%;text-align:left;padding:10px 12px;margin-bottom:8px;background:var(--surface2,#1F1F2A);border:1px solid var(--border,#2A2A35);border-radius:9px;cursor:pointer;font-family:inherit">';
  choicesHTML+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span style="font-size:18px">'+obj.icon+'</span><span style="font-size:13px;font-weight:700;color:var(--text)">'+obj.label+'</span></div>';
  choicesHTML+='<div style="font-size:10.5px;color:var(--text3);line-height:1.4;margin-bottom:4px">'+obj.desc+'</div>';
  choicesHTML+='<div style="font-size:10px;color:'+skillColor+';font-family:var(--font-display);letter-spacing:.04em;font-weight:700">'+skillTxt+' · '+obj.stat+' '+skillPct+'%</div>';
  choicesHTML+='</button>';
 });
 var skipHTML='<button id="fp-skip-btn" style="display:block;width:100%;padding:8px 12px;margin-top:6px;background:transparent;border:1px solid var(--border,#2A2A35);border-radius:7px;color:var(--text3);font-size:11px;font-weight:600;cursor:pointer;letter-spacing:.04em">⏩ Passer les essais</button>';
 card.innerHTML=titleHTML+choicesHTML+skipHTML;
 overlay.appendChild(card);
 document.body.appendChild(overlay);
 var done=function(result){
  overlay.remove();
  if(result&&result.bonus){
   /* #5 — Stockage sur G pour survivre à l'init RACE_STATE qui suit dans startQual */
   G._fpBonus=result.bonus;
   G._fpResult=result;
  }
  if(onDone)onDone();
 };
 var btns=card.querySelectorAll("button[data-objid]");
 btns.forEach(function(btn){
  btn.addEventListener("click",function(){
   var objId=btn.getAttribute("data-objid");
   var obj=_fpObjectives().find(function(o){return o.id===objId});
   if(!obj){done(null);return}
   var outcome=_fpComputeOutcome(obj.skill);
   var bonus=_fpApplyOutcome(obj,outcome);
   _showFreePracticeResult(obj,outcome,bonus,function(){done({obj:obj,outcome:outcome,bonus:bonus})});
  });
 });
 var skipBtn=card.querySelector("#fp-skip-btn");
 if(skipBtn)skipBtn.addEventListener("click",function(){done(null)});
}
function _showFreePracticeResult(obj,outcome,bonus,onDone){
 // Popup feedback : montre le résultat de la séance
 var labels={brillant:"Séance brillante !",succes:"Bonne séance",neutre:"Séance moyenne",rateMin:"Séance moyenne-",rateMaj:"Séance ratée"};
 var colors={brillant:"#34D399",succes:"#60A5FA",neutre:"#9CA3AF",rateMin:"#F59E0B",rateMaj:"#EF4444"};
 var icons={brillant:"⭐",succes:"",neutre:"~",rateMin:"",rateMaj:""};
 var bonusDesc="";
 if(bonus.qualiPace){var s=bonus.qualiPace>=0?"+":"";bonusDesc="Quali : "+s+(bonus.qualiPace*100).toFixed(1)+"% pace"}
 else if(bonus.racePace){var s2=bonus.racePace<0?"":"+";bonusDesc="Course : "+s2+bonus.racePace.toFixed(2)+"s/T"}
 else if(bonus.tyreWearMult!=null){var pct=Math.round((1-bonus.tyreWearMult)*100);var sgn=pct>=0?"-":"+";bonusDesc="Pneus : "+sgn+Math.abs(pct)+"% usure"}
 else if(bonus.weatherMul!=null){var pct2=Math.round((1-bonus.weatherMul)*100);var sgn2=pct2>=0?"-":"+";bonusDesc="Météo : "+sgn2+Math.abs(pct2)+"% impact"}
 var existing=document.getElementById("fp-result-overlay");
 if(existing)existing.remove();
 var overlay=document.createElement("div");
 overlay.id="fp-result-overlay";
 overlay.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:9500;display:flex;align-items:center;justify-content:center;padding:18px";
 var card=document.createElement("div");
 card.style.cssText="background:var(--surface,#16161D);border:1px solid "+colors[outcome]+";border-top:3px solid "+colors[outcome]+";border-radius:14px;padding:18px 16px 14px;max-width:380px;width:100%;box-shadow:0 12px 38px rgba(0,0,0,0.65)";
 card.innerHTML='<div style="font-family:var(--font-display);font-size:11px;font-weight:800;color:'+colors[outcome]+';letter-spacing:.14em;text-transform:uppercase;margin-bottom:4px">'+icons[outcome]+' '+labels[outcome]+'</div>'+
  '<div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:8px">'+obj.icon+' '+obj.label+'</div>'+
  '<div style="font-size:12px;color:var(--text2);line-height:1.5;margin-bottom:12px">Bonus week-end : <strong style="color:'+colors[outcome]+'">'+bonusDesc+'</strong></div>'+
  '<button id="fp-result-ok" style="display:block;width:100%;padding:10px 14px;background:var(--surface2,#1F1F2A);border:1px solid var(--border,#2A2A35);border-radius:8px;color:var(--text);font-size:12px;font-weight:700;cursor:pointer;letter-spacing:.04em">Continuer →</button>';
 overlay.appendChild(card);
 document.body.appendChild(overlay);
 var okBtn=card.querySelector("#fp-result-ok");
 if(okBtn)okBtn.addEventListener("click",function(){overlay.remove();if(onDone)onDone()});
}
/* #5 — Reset du flag FP au début d'un nouveau week-end. À appeler quand on entre sur la page d'une nouvelle course (pas tous les rounds de quali). */

function startQual(){/* #5 — Intercept FP : si pas encore fait et catégorie compatible, lance d'abord la séance d'essais libres. RACE_WEEKEND_STATE.fpDone est utilisé car il survit à initRaceState (contrairement à RACE_STATE qui est reset). */if(!(typeof RACE_WEEKEND_STATE!=="undefined"&&RACE_WEEKEND_STATE.fpDone)&&!G._fpSkipping&&G.cat!=="Karting Junior"&&G.cat!=="Karting Senior"&&typeof _showFreePracticePopup==="function"&&typeof document!=="undefined"){if(typeof RACE_WEEKEND_STATE!=="undefined")RACE_WEEKEND_STATE.fpDone=true;else G._fpDone=true;_showFreePracticePopup(function(){G._startQualInProgress=false;startQual()});return}if(!(G._startQualInProgress&&Date.now()-G._startQualInProgressAt<1500)){G._startQualInProgress=!0,G._startQualInProgressAt=Date.now();G.raceLocked=!0,G.racePhase="live",applyRaceLockUI(),rtab("qualif",!0),initRaceState();var t=RACE_STATE.weather,r={bal:0,aero:.03,mec:.02,agg:-.01}[G.setup]||0;"wet"!==t.id&&"storm"!==t.id||(r+={bal:.02,aero:-.02,mec:.03,agg:-.03}[G.setup]||0);var n=G.currentTeam||"Indépendant",a,i=teamRatingToBonus("Indépendant"!==n?getEffectiveTeamRating(n):75),o=(.6*G.stats.vitesse+.25*G.stats.sangfroid+.15*G.stats.adapt)/100+r+t.rainMod+i+(G._fpBonus&&G._fpBonus.qualiPace?G._fpBonus.qualiPace:0),s={"Karting Junior":52,"Karting Senior":50,"Formule 4":88,"Formula Regional":86,"Formule 3":98,"Formule 2":102,"Formule 1":84,"Super Formula":92,"Endurance WEC":105,IndyCar:80},l=RACE_STATE&&RACE_STATE.circuit||getNextRace()&&getNextRace().name||"",c=l?getCircuitBaseRef(l,G.cat):0;QUALI_STATE.baseRef=c>0?c:s[G.cat]||90,QUALI_STATE.circuitName=l,QUALI_STATE.drivers=[],QUALI_STATE.drivers.push({name:(G.pilot.prenom?G.pilot.prenom+" ":"")+G.pilot.nom,nat:G.pilot.nat||"FR",isPlayer:!0,skill:o,consistency:.85,bestTime:null,lastTime:null,laps:0,improved:!1,eliminated:!1,team:G.currentTeam||"Indépendant"}),G.rivals.forEach(function(e){var r=e.team||"",n,a=teamRatingToBonus(r?getEffectiveTeamRating(r):72);QUALI_STATE.drivers.push({name:e.name,nat:e.nat||"FR",isPlayer:!1,skill:e.skill/100+a+.5*t.rainMod,consistency:e.consistency,bestTime:null,lastTime:null,laps:0,improved:!1,eliminated:!1,team:e.team||""})}),QUALI_STATE.session=1,QUALI_STATE.phase="idle",QUALI_STATE.survived=QUALI_STATE.drivers.map(function(e,t){return t});var d=document.getElementById("quali-screen");d&&(d.style.display="block");var p=document.getElementById("race-screen");p&&(p.style.display="block"),renderQualiSession()}}// ===========================================================================
// MOTEUR RÉALISTE — Profils circuit & écurie (affinités)
// ---------------------------------------------------------------------------
// Chaque circuit a un profil (vitesse, appuiAero, agilité, freinage)
// Chaque écurie a un profil de force dans ces 4 dimensions
// L'affinité écurie×circuit module le temps au tour de ±0.3-0.6s
// Effet : Ferrari domine Monza, McLaren brille à Monaco, etc.
// ===========================================================================
var _CIRCUIT_PROFILES={
  Bahrain:[0.30,0.25,0.20,0.25],Jeddah:[0.45,0.20,0.20,0.15],
  Melbourne:[0.25,0.30,0.25,0.20],Miami:[0.35,0.20,0.25,0.20],
  Imola:[0.20,0.40,0.20,0.20],Monaco:[0.05,0.25,0.45,0.25],
  Barcelone:[0.20,0.45,0.20,0.15],Barcelona:[0.20,0.45,0.20,0.15],
  Silverstone:[0.30,0.40,0.20,0.10],Spa:[0.45,0.35,0.10,0.10],
  Budapest:[0.10,0.30,0.45,0.15],Hungaroring:[0.10,0.30,0.45,0.15],
  Zandvoort:[0.15,0.40,0.30,0.15],Monza:[0.55,0.10,0.10,0.25],
  Singapore:[0.10,0.30,0.30,0.30],Suzuka:[0.25,0.40,0.25,0.10],
  Austin:[0.25,0.35,0.25,0.15],Mexico:[0.35,0.30,0.20,0.15],
  Baku:[0.50,0.10,0.20,0.20],Portimao:[0.20,0.35,0.30,0.15],
  Mugello:[0.30,0.40,0.20,0.10],Misano:[0.25,0.30,0.25,0.20],
  Vallelunga:[0.30,0.25,0.25,0.20],Spielberg:[0.40,0.20,0.15,0.25],
  Okayama:[0.20,0.30,0.30,0.20],Autopolis:[0.25,0.35,0.25,0.15],
  Sugo:[0.25,0.30,0.25,0.20],Motegi:[0.20,0.25,0.30,0.25],
  Sapporo:[0.30,0.30,0.20,0.20],Texas:[0.35,0.25,0.25,0.15],
  Detroit:[0.15,0.20,0.35,0.30],Iowa:[0.55,0.05,0.20,0.20],
  Nashville:[0.30,0.20,0.30,0.20],Portland:[0.30,0.30,0.20,0.20],
  Gateway:[0.50,0.05,0.25,0.20],Monterey:[0.25,0.35,0.25,0.15]
};
var _DEFAULT_CIRCUIT_PROFILE=[0.25,0.30,0.25,0.20];

// Profils écurie F1 — (vitesse, aéro, agilité, freinage), chacun ∈ [-1,+1]
// Une équipe "équilibrée" = [0,0,0,0], une équipe spécialisée a des forces et faiblesses
var _TEAM_PROFILES_F1={
  "Red Bull Racing":[0.4,0.5,0.3,0.2],
  "Ferrari":[0.6,0.2,-0.1,0.3],
  "McLaren":[0.1,0.5,0.4,0.0],
  "Mercedes":[0.2,0.3,0.0,0.4],
  "Aston Martin":[-0.1,0.3,0.1,0.0],
  "Alpine":[0.0,-0.1,0.1,0.0],
  "Williams":[0.3,-0.3,-0.1,0.0],
  "Racing Bulls":[0.0,0.0,0.0,0.0],
  "Haas F1 Team":[0.1,-0.2,-0.1,0.1],
  "Kick Sauber":[-0.2,-0.1,0.0,-0.1]
};

// Hash déterministe pour générer des profils pour les écuries hors F1
function _profileHash(s){var h=2166136261>>>0;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0}return(h>>>0)/4294967296}

// Retourne le profil d'un circuit. Heuristique fallback si non trouvé.
function _getCircuitProfile(name){
  if(!name)return _DEFAULT_CIRCUIT_PROFILE;
  if(_CIRCUIT_PROFILES[name])return _CIRCUIT_PROFILES[name];
  // Recherche par substring (Barcelone vs Barcelona vs Catalunya, etc.)
  for(var k in _CIRCUIT_PROFILES){
    if(name.indexOf(k)>=0||k.indexOf(name)>=0)return _CIRCUIT_PROFILES[k];
  }
  // Fallback sur le type du circuit
  try{
    if(typeof getCircuitData==='function'){
      var d=getCircuitData(name);
      if(d&&d.type){
        switch(d.type){
          case 'highspeed':return [0.45,0.25,0.15,0.15];
          case 'street':return [0.20,0.20,0.35,0.25];
          case 'technical':return [0.15,0.35,0.30,0.20];
          case 'mixed':default:return [0.25,0.30,0.25,0.20];
        }
      }
    }
  }catch(e){}
  return _DEFAULT_CIRCUIT_PROFILE;
}

// Retourne le profil d'une écurie pour une catégorie donnée.
// F1 : profils explicites ; autres catégories : génération déterministe modérée (±0.2).
function _getTeamProfile(team,cat){
  if(!team||team==='Indépendant')return [0,0,0,0];
  if(cat==='Formule 1'&&_TEAM_PROFILES_F1[team])return _TEAM_PROFILES_F1[team];
  // Génération procédurale stable
  var seed=_profileHash(team+'|'+(cat||''));
  var mag=0.20; // variation max ±0.20 pour les catégories non-F1
  // Karting plus uniforme
  if(cat==='Karting Junior'||cat==='Karting Senior')mag=0.10;
  return [
    Math.round(((seed*7919)%1*2-1)*mag*100)/100,
    Math.round(((seed*6151)%1*2-1)*mag*100)/100,
    Math.round(((seed*4493)%1*2-1)*mag*100)/100,
    Math.round(((seed*3163)%1*2-1)*mag*100)/100
  ];
}

// Calcule l'affinité d'une écurie sur un circuit donné.
// Résultat typique : -0.5 (mauvais) à +0.5 (excellent), parfois plus.
function _getTeamCircuitAffinity(team,cat,circuitName){
  var tp=_getTeamProfile(team,cat);
  var cp=_getCircuitProfile(circuitName);
  if(!tp||!cp)return 0;
  return tp[0]*cp[0]+tp[1]*cp[1]+tp[2]*cp[2]+tp[3]*cp[3];
}

function getQualiCutoff(e){var t=QUALI_STATE.drivers?QUALI_STATE.drivers.length:10,r,n;
// #2 — Pour les catégories à session unique (Karting, F4, FR, F3, F2, SF, WEC), pas d'élimination cascade.
// On retourne r=t, n=t : ainsi getQualiElimCount(e) = t-t = 0 → personne n'est éliminé,
// le tri final par bestTime gère seul le classement complet.
var _fmt=(typeof _qualiFormatForCat==="function")?_qualiFormatForCat(G.cat):null;
if(_fmt&&_fmt.singleSession){return t}

switch(G.cat){case "Formule 1":/* #16 — Seuils Q1/Q2/Q3 robustes : Q1 élimine 5, Q2 élimine 5, Q3 = top 10. Si grille != 20, on adapte proportionnellement avec un minimum sain. */ r=Math.max(8,Math.min(10,t-10));n=Math.max(r+3,Math.min(15,t-5));break;case"Formule 2":case"Formule 3":r=Math.round(.45*t),n=Math.round(.7*t);break;case"Formula Regional":case"Super Formula":r=Math.round(.4*t),n=Math.round(.7*t);break;case"IndyCar":r=6,n=12;break;case"Endurance WEC":default:r=Math.round(.3*t),n=Math.round(.6*t);break;case"Formule 4":case"Karting Senior":case"Karting Junior":r=Math.round(.35*t),n=Math.round(.65*t)}return r=Math.max(3,Math.min(t-1,r)),n=Math.max(r+2,Math.min(t-1,n)),1===e?n:r}function getQualiElimCount(e){var t=QUALI_STATE.survived?QUALI_STATE.survived.length:QUALI_STATE.drivers.length,r=getQualiCutoff(e);return Math.max(0,t-r)}function qualiDriverTime(e,t,r,n,a){
 var baseRef=QUALI_STATE.baseRef;
 // Skill effect: skill in [0.4,1.0]. Mapping centered at 0.75 → 0% delta. Above → faster, below → slower.
 // Slope: each 0.10 above 0.75 = -0.7% lap time. So skill 0.85 → -0.7%, skill 1.0 → -1.75%.
 var skillDelta=-(e.skill-0.75)*0.055;
 // Consistency variation
 var i=0.022*baseRef;
 var consVar=(Math.random()-0.5)*i*(1.0-e.consistency+0.20);
 // Session form factor : chaque pilote a une "forme" du jour (-0.4% à +0.4%)
 // Stockée dans e._sessionForm pour rester cohérente sur tous les tours de la session
 if(typeof e._sessionForm!=='number'){e._sessionForm=(Math.random()-0.5)*0.008}
 var formBonus=e._sessionForm*baseRef;
 // Session bonus: Q3 cars are lighter, fresh tyres → marginally faster
 var sessionBonus=t===3?-0.004:t===2?-0.001:0;
 // Lap-in-stint timing
 var isFinalLap=n&&r===n;
 var lapBonus=0;
 if(r===1)lapBonus=0.005; // out lap (tyres cold)
 else if(isFinalLap)lapBonus=-0.003; // push lap
 else lapBonus=-0.0015; // standard fast lap
 // Time-in-session: pushed harder near end
 var pressureBonus=(typeof a==='number')?(0.005*(1-a)-0.002):0;
 // Combine
 var totalDelta=skillDelta+sessionBonus+lapBonus+pressureBonus;
 // Affinité écurie × circuit : peut réduire ou augmenter le temps au tour de ±0.5s
 var affinityBonus=0;
 try{
  if(e.team&&typeof _getTeamCircuitAffinity==='function'){
   var aff=_getTeamCircuitAffinity(e.team,G.cat,QUALI_STATE.circuitName);
   // Impact : -aff * 0.012 du baseRef → environ -0.5s pour aff=+0.5 sur un ref de 84s
   affinityBonus=-aff*0.012*baseRef;
  }
 }catch(_eAff){}
 var lap=baseRef*(1+totalDelta)+consVar+formBonus+affinityBonus;
 // Final lap risk of mistake
 // #7 — errorRisk augmenté de 0.08 à 0.12 (4-5% → 8-12% selon consistency).
 // Bonus stress : +50% si le pilote est dans la zone d'élimination (3 dernières positions du cutoff).
 if(isFinalLap){
  var errorRisk=0.12*(1-0.5*e.consistency);
  // Détecte si en zone d'élim : on regarde la position actuelle du pilote dans QUALI_STATE
  try{
   if(typeof getQualiCutoff==="function"&&QUALI_STATE&&QUALI_STATE.drivers){
    var _cutoff=getQualiCutoff(t);
    var _myIdx=QUALI_STATE.drivers.indexOf(e);
    if(_myIdx>=0){
     var _sorted=QUALI_STATE.drivers.map(function(d,i){return{i:i,t:d.bestTime||9999}}).sort(function(a,b){return a.t-b.t});
     var _myPos=_sorted.findIndex(function(o){return o.i===_myIdx})+1;
     // En zone d'élim ou juste au-dessus (3 places de marge)
     if(_myPos>_cutoff-2)errorRisk*=1.5;
    }
   }
  }catch(_e){}
  if(Math.random()<errorRisk)lap+=0.018*baseRef; // mistake costs ~1.8%
 }
 // Sanity floor: best case ~96.5% of ref (a god-tier driver)
 return Math.max(0.965*baseRef,lap);
}function formatQualiTime(e){var t=Math.floor(e/60),r=e-60*t,n=Math.floor(r),a=Math.round(1e3*(r-n));return t+":"+(n<10?"0":"")+n+"."+(a<100?a<10?"00":"0":"")+a}
/* === QUALI LIVE PLAYER LAP MODAL === */
function _showQualiPlayerLapModal(driver, session, lap, totalLaps, lapTime, sectors, position, bestTimeBeforeLap){
 // Create or reuse modal element
 var modalId="quali-player-lap-modal";
 var existing=document.getElementById(modalId);
 if(existing&&existing.parentNode)existing.parentNode.removeChild(existing);
 var modal=document.createElement("div");
 modal.id=modalId;
 modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:9998;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px);animation:quali-modal-in .25s ease-out";
 var circuit=QUALI_STATE.circuitName||"Circuit";
 var weather=(RACE_STATE&&RACE_STATE.weather)||{label:"Sec"};
 // Delta computation : compare lapTime to the personal best BEFORE this lap.
 // bestTimeBeforeLap may be null/undefined if it's the very first lap.
 var deltaRef=(typeof bestTimeBeforeLap==="number"&&bestTimeBeforeLap>0)?bestTimeBeforeLap:null;
 var delta=deltaRef!==null?lapTime-deltaRef:null;
 var isPB=delta!==null?delta<0:(deltaRef===null); // first ever timed lap counts as PB
 // Sector velocity computation (for display)
 var baseVmax={"Karting Junior":120,"Karting Senior":135,"Formule 4":230,"Formula Regional":250,"Formule 3":265,"Formule 2":290,"Formule 1":335,"Super Formula":315,"Endurance WEC":325,"IndyCar":355}[G.cat]||280;
 var circType=(RACE_STATE&&RACE_STATE.circuitData&&RACE_STATE.circuitData.type)||"";
 var vmaxMod=circType==="highspeed"?1.05:circType==="street"?0.88:1;
 var vmax1=Math.round(baseVmax*vmaxMod*(0.92+0.05*Math.random()));
 var vmax2=Math.round(baseVmax*vmaxMod*(0.98+0.04*Math.random()));
 var vmax3=Math.round(baseVmax*vmaxMod*(0.94+0.05*Math.random()));
 // Couleurs des secteurs : on lit lastSectorFlags calculé par runQualiSession (même source que le classement).
 // Flag 2 = VIOLET (meilleur global session) · Flag 1 = VERT (amélioration perso) · Flag 0 = JAUNE (pas amélioré).
 // Au 1er tour, bestSectors étant null avant le calcul, le flag est forcément 1 ou 2 → jamais jaune.
 var SEC_COLORS={0:"#FBBF24",1:"#34D399",2:"#7C3AED"};
 function _secColor(secIdx){
  var flags=driver&&driver.lastSectorFlags;
  var f=flags&&typeof flags[secIdx]==="number"?flags[secIdx]:0;
  return{col:SEC_COLORS[f],flag:f};
 }
 var sec1Info=_secColor(0);
 var sec2Info=_secColor(1);
 var sec3Info=_secColor(2);
 // Couleur du chrono final : VIOLET si meilleur global de la session, VERT si PB, JAUNE sinon
 var qBestLap=null;
 if(QUALI_STATE&&QUALI_STATE.drivers){
  for(var _di=0;_di<QUALI_STATE.drivers.length;_di++){
   var _bt=QUALI_STATE.drivers[_di].bestTime;
   if(_bt&&(qBestLap===null||_bt<qBestLap))qBestLap=_bt;
  }
 }
 var lapIsOverallBest=qBestLap!==null&&lapTime<=qBestLap+0.0001;
 var lapColor=lapIsOverallBest?"#7C3AED":(isPB?"#34D399":"#F59E0B");
 // Format helpers
 function _fmt(t){
  var m=Math.floor(t/60),r=t-60*m,n=Math.floor(r),a=Math.round(1e3*(r-n));
  return m+":"+(n<10?"0":"")+n+"."+(a<100?(a<10?"00":"0"):"")+a;
 }
 var lapLabel=lap+"/"+totalLaps;
 var sessLabel="Q"+session;
 var lapTypeLabel=lap===1?"OUT LAP":lap===totalLaps?"PUSH LAP":"FAST LAP";
 // Build modal HTML
 var html='<div style="background:linear-gradient(180deg,#0a0a0a 0%,#0d0d12 100%);border:1px solid #1a1a24;border-left:3px solid #FF1801;border-radius:12px;max-width:430px;width:100%;max-height:90vh;overflow:hidden;box-shadow:0 16px 48px rgba(0,0,0,.7),0 0 0 1px rgba(255,24,1,.12)">';
 // Header
 html+='<div style="padding:10px 14px;background:linear-gradient(135deg,rgba(255,24,1,.10),transparent);border-bottom:1px solid rgba(255,24,1,.18);display:flex;justify-content:space-between;align-items:center">';
 html+='<div style="display:flex;align-items:center;gap:8px">';
 html+='<div style="width:8px;height:8px;background:#FF1801;border-radius:50%;box-shadow:0 0 8px #FF1801;animation:practice-pulse .6s ease-in-out infinite"></div>';
 html+='<span style="font-family:var(--font-display);font-size:11px;font-weight:900;color:#FF1801;letter-spacing:.22em;text-transform:uppercase">EN PISTE · '+sessLabel+'</span>';
 html+='</div>';
 html+='<span style="font-family:var(--font-display);font-size:10px;color:var(--muted);letter-spacing:.1em;text-transform:uppercase">'+circuit+' · Tour '+lapLabel+'</span>';
 html+='</div>';
 // Chrono
 html+='<div style="padding:18px 14px 8px;text-align:center">';
 html+='<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--muted);letter-spacing:.28em;text-transform:uppercase;margin-bottom:6px">'+lapTypeLabel+'</div>';
 html+='<div id="quali-live-chrono" style="font-family:var(--font-display);font-size:38px;font-weight:900;color:var(--white);line-height:1;letter-spacing:.02em">0:00.000</div>';
 html+='<div style="margin:14px 14px 0;height:3px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden;position:relative"><div id="quali-live-progress" style="position:absolute;top:0;left:0;height:100%;width:0%;background:linear-gradient(90deg,#FF1801 0%,#FFB300 100%);transition:width .1s linear;box-shadow:0 0 8px rgba(255,24,1,.4)"></div></div>';
 html+='<div id="quali-live-current-sec" style="margin-top:12px;font-family:var(--font-display);font-size:11px;font-weight:800;color:var(--muted);letter-spacing:.2em;text-transform:uppercase;min-height:14px">—</div>';
 html+='</div>';
 // Sectors row
 var secLabels=["S1","S2","S3"];
 var secData=[
  {n:1,t:sectors[0],vmax:vmax1,info:sec1Info},
  {n:2,t:sectors[1],vmax:vmax2,info:sec2Info},
  {n:3,t:sectors[2],vmax:vmax3,info:sec3Info}
 ];
 html+='<div style="padding:6px 12px 12px;display:flex;gap:7px">';
 for(var si=0;si<3;si++){
  html+='<div class="quali-live-sec" data-sec="'+secData[si].n+'" style="flex:1;padding:10px 6px 9px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06);border-radius:6px;text-align:center;opacity:.25;transition:all .35s ease;position:relative;overflow:hidden">';
  html+='<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--muted);letter-spacing:.22em;text-transform:uppercase;margin-bottom:4px">'+secLabels[si]+'</div>';
  html+='<div class="quali-live-sec-time" style="font-family:var(--font-display);font-size:15px;font-weight:900;color:var(--dim);line-height:1;letter-spacing:.01em">—.———</div>';

  html+='</div>';
 }
 html+='</div>';
 // Footer area for delta + skip button
 html+='<div id="quali-live-footer" style="padding:0 14px 14px"></div>';
 html+='</div>';
 modal.innerHTML=html;
 document.body.appendChild(modal);
 // Animation: chrono + sector reveal (similar to practice)
 var startTs=Date.now();
 var animDuration=2500;
 var chronoEl=document.getElementById("quali-live-chrono");
 var progEl=document.getElementById("quali-live-progress");
 var curSecEl=document.getElementById("quali-live-current-sec");
 var chronoInt=setInterval(function(){
  var elapsed=(Date.now()-startTs)/1000;
  var r=Math.min(1,elapsed/(animDuration/1000));
  var displayedTime=lapTime*r;
  if(chronoEl)chronoEl.textContent=_fmt(displayedTime);
  if(progEl)progEl.style.width=(100*r).toFixed(1)+"%";
  if(curSecEl){
   var cs=r<0.34?"S1 — EN COURS":r<0.7?"S2 — EN COURS":r<1?"S3 — EN COURS":"—";
   curSecEl.textContent=cs;
   curSecEl.style.color=r<1?"#FF1801":"var(--muted)";
  }
 },33);
 // Reveal sectors
 secData.forEach(function(sd,idx){
  setTimeout(function(){
   var el=modal.querySelector('.quali-live-sec[data-sec="'+sd.n+'"]');
   if(!el)return;
   el.style.opacity="1";
   el.style.background=sd.info.col+"22";
   el.style.borderColor=sd.info.col;
   el.style.boxShadow="0 0 14px "+sd.info.col+"40, inset 0 0 0 1px "+sd.info.col+"55";
   var tn=el.querySelector(".quali-live-sec-time");
   var vn=el.querySelector(".quali-live-sec-vmax");
   if(tn){tn.textContent=sd.t.toFixed(3);tn.style.color=sd.info.col;}

  },800+800*idx);
 });
 // After animation: show delta + close button
 setTimeout(function(){
  clearInterval(chronoInt);
  if(chronoEl){chronoEl.textContent=_fmt(lapTime);chronoEl.style.color=lapColor;}
  if(progEl)progEl.style.width="100%";
  if(curSecEl){curSecEl.textContent="TOUR TERMINÉ";curSecEl.style.color="var(--muted)";}
  var footer=document.getElementById("quali-live-footer");
  if(footer){
   var deltaHtml="";
   // Position dans le classement (P1 = pole, P2..Pn sinon). Couleur = or pour P1, ambre top3, normal sinon.
   if(typeof position==="number"&&position>0){
    var posColor=position===1?"#A855F7":(position<=3?"#F59E0B":"var(--text)");
    var posLabel=position===1?"PROVISOIRE — POLE":"PROVISOIRE";
    var posBg=position===1?"rgba(168,85,247,.12)":(position<=3?"rgba(245,158,11,.10)":"rgba(255,255,255,.04)");
    var posBorder=position===1?"rgba(168,85,247,.45)":(position<=3?"rgba(245,158,11,.35)":"rgba(255,255,255,.10)");
    deltaHtml+='<div style="margin-bottom:10px;padding:10px 12px;border:1px solid '+posBorder+';background:'+posBg+';border-radius:6px;display:flex;align-items:center;justify-content:space-between;gap:10px">';
    deltaHtml+='<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--muted);letter-spacing:.18em;text-transform:uppercase">'+posLabel+'</div>';
    deltaHtml+='<div style="font-family:var(--font-display);font-size:20px;font-weight:900;color:'+posColor+';letter-spacing:.02em;line-height:1">P'+position+'</div>';
    deltaHtml+='</div>';
   }
   if(delta!==null){
    deltaHtml+='<div style="margin-bottom:10px;padding:10px 12px;border:1px solid '+(isPB?"#34D399":"#F59E0B")+';background:'+(isPB?"rgba(52,211,153,.10)":"rgba(245,158,11,.08)")+';border-radius:6px;display:flex;align-items:center;justify-content:space-between;gap:10px">';
    deltaHtml+='<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--muted);letter-spacing:.18em;text-transform:uppercase">'+(isPB?"▲ Meilleur tour personnel":"vs ton meilleur")+'</div>';
    deltaHtml+='<div style="font-family:var(--font-display);font-size:18px;font-weight:900;color:'+(isPB?"#34D399":"#F59E0B")+';letter-spacing:.02em;line-height:1">'+(isPB?"":"+")+delta.toFixed(3)+'</div>';
    deltaHtml+='</div>';
   } else if(deltaRef===null){
    // Premier tour chronométré — pas de référence
    deltaHtml+='<div style="margin-bottom:10px;padding:10px 12px;border:1px solid #34D399;background:rgba(52,211,153,.10);border-radius:6px;text-align:center">';
    deltaHtml+='<div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:#34D399;letter-spacing:.14em;text-transform:uppercase">▲ Premier tour chrono</div>';
    deltaHtml+='</div>';
   }
   deltaHtml+='<button onclick="_closeQualiPlayerLapModal()" style="width:100%;padding:11px;background:linear-gradient(135deg,#FF1801 0%,#B00500 100%);border:none;color:#fff;border-radius:8px;font-family:var(--font-display);font-size:11px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;cursor:pointer">Continuer</button>';
   footer.innerHTML=deltaHtml;
  }
 },animDuration);
}

function _closeQualiPlayerLapModal(){
 // Nettoyer aussi la séquence si elle était en cours
 if(window._qualiSeqChoice){delete window._qualiSeqChoice;}
 var _seqModal=document.getElementById('quali-hotlap-seq-modal');
 if(_seqModal&&_seqModal.parentNode)_seqModal.parentNode.removeChild(_seqModal);
 var modal=document.getElementById("quali-player-lap-modal");
 if(modal&&modal.parentNode)modal.parentNode.removeChild(modal);
}
// ============================================================
// SYSTÈME PNEUS QUALIFICATIONS
// Température (°C), Dégradation (%), Sets disponibles
// Choix de timing de sortie, compte à rebours drapeau à damier
// ============================================================

// --- Constantes par catégorie ---
var QUALI_TYRE_CONFIG = {
  "Karting Junior":    { tempMin:45, tempOpt:[55,70],  tempMax:80,  degPerLap:8,  warmupLaps:1, sets:1,  setsF1:false, compound:"Slick" },
  "Karting Senior":    { tempMin:48, tempOpt:[58,72],  tempMax:82,  degPerLap:7,  warmupLaps:1, sets:1,  setsF1:false, compound:"Slick" },
  "Formule 4":         { tempMin:55, tempOpt:[75,95],  tempMax:110, degPerLap:6,  warmupLaps:1, sets:2,  setsF1:false, compound:"Soft" },
  "Formula Regional":  { tempMin:58, tempOpt:[78,98],  tempMax:112, degPerLap:6,  warmupLaps:1, sets:2,  setsF1:false, compound:"Soft" },
  "Formule 3":         { tempMin:60, tempOpt:[85,105], tempMax:118, degPerLap:5,  warmupLaps:1, sets:3,  setsF1:false, compound:"Soft" },
  "Formule 2":         { tempMin:62, tempOpt:[88,108], tempMax:120, degPerLap:5,  warmupLaps:1, sets:3,  setsF1:false, compound:"Soft" },
  "Formule 1":         { tempMin:65, tempOpt:[90,110], tempMax:125, degPerLap:4,  warmupLaps:1, sets:3,  setsF1:true,  compound:"Soft Pirelli" },
  "Super Formula":     { tempMin:62, tempOpt:[88,108], tempMax:120, degPerLap:4,  warmupLaps:1, sets:3,  setsF1:false, compound:"Soft" },
  "Endurance WEC":     { tempMin:60, tempOpt:[80,100], tempMax:115, degPerLap:3,  warmupLaps:1, sets:999,setsF1:false, compound:"Soft" },
  "IndyCar":           { tempMin:60, tempOpt:[82,102], tempMax:116, degPerLap:3,  warmupLaps:1, sets:999,setsF1:false, compound:"Primary" }
};

// --- Choix de timing de sortie ---
var QUALI_TIMING_OPTIONS = [
  { id:"early",  label:"Sortie tôt",    icon:"🟢", desc:"Piste peu gommée, moins de trafic. Temps difficile mais plus de tentatives.",   lapBonus:-0.4, attempts:+1, tyreHeatMult:0.85, riskMeteo:false },
  { id:"mid",    label:"Sortie médiane",icon:"🟡", desc:"Équilibre entre piste gommée et fenêtre disponible. Option sûre.",               lapBonus:0,    attempts:0,  tyreHeatMult:1.0,  riskMeteo:false },
  { id:"late",   label:"Sortie tardive",icon:"🔴", desc:"Piste au maximum (+grip), 1 tentative possible. Risque météo si conditions instables.", lapBonus:0.4,  attempts:-1, tyreHeatMult:1.15, riskMeteo:true }
];

// --- État pneus par session (reset entre segments F1) ---
function _initQualiTyreState(session) {
  var cfg = QUALI_TYRE_CONFIG[G.cat] || QUALI_TYRE_CONFIG["Formule 3"];
  var isF1 = cfg.setsF1;
  // Pour F1 : sets globaux partagés entre sessions, reset temp/deg entre segments
  if (isF1) {
    if (!QUALI_STATE._tyreState) {
      QUALI_STATE._tyreState = { setsUsed: 0, setsTotal: cfg.sets };
    }
    // Reset temp et dégradation pour chaque segment
    QUALI_STATE._tyreState.temp = cfg.tempMin;
    QUALI_STATE._tyreState.deg = 0;
    QUALI_STATE._tyreState.currentSession = session;
  } else {
    // Non-F1 : état continu sur toute la session
    if (!QUALI_STATE._tyreState || QUALI_STATE._tyreState._fresh) {
      QUALI_STATE._tyreState = {
        temp: cfg.tempMin,
        deg: 0,
        setsUsed: 0,
        setsTotal: cfg.sets,
        _fresh: false
      };
    }
  }
  QUALI_STATE._tyreConfig = cfg;
  QUALI_STATE._timingChoice = QUALI_STATE._timingChoice || "mid";
}

function _resetQualiTyreForNewSeason() {
  QUALI_STATE._tyreState = null;
  QUALI_STATE._timingChoice = null;
}

// --- Calcul du tour de chauffe (montée en temp) ---

/* ===== SÉQUENCE TOUR CHAUD QUALIF =============================================
 * Intercale 3 micro-décisions rapides avant l'affichage du résultat de tour.
 * Chaque décision modifie lapTime d'un delta visible en centièmes.
 * S'affiche uniquement pour les tours chauds du joueur (pas de reconnaissance).
 * La résolution est rapide — tap/click, pas de lecture longue.
 * ============================================================================ */
function _qualiHotLapSequence(lapTime, session, lap, totalLaps, onDone) {
 try {
  var circuit = QUALI_STATE.circuitName || "";
  var weather = (RACE_STATE && RACE_STATE.weather) || {id:"dry"};
  var isWet = weather.id === "wet" || weather.id === "storm";
  var cData = RACE_STATE && RACE_STATE.circuitData || {};
  var ctype = cData.type || "default";

  // --- Étapes de la séquence ---
  var steps = [];

  // Étape 1 : SORTIE DES STANDS — timing de sortie
  steps.push({
   id: "outlap",
   title: "Sortie des stands",
   subtitle: "Tour " + lap + " / " + totalLaps,
   icon: "🔧",
   desc: (function(){
    // Identifier quel rival est sur la piste en sortant au même moment
    var rivals = (typeof G !== 'undefined' && G.rivals) || [];
    var inZone = rivals.filter(function() { return Math.random() < 0.55; });
    var names = inZone.slice(0, 2).map(function(r) {
      return r.name ? r.name.split(' ').pop() : 'Un rival';
    });
    if (names.length >= 2) return names[0] + ' et ' + names[1] + ' sont en piste — le trafic va être dense.';
    if (names.length === 1) return names[0] + ' est sur un tour lancé devant toi. Timing délicat.';
    return 'La piste est dégagée — fenêtre idéale pour le tour chaud.';
   })(),
   choices: [
    {text: "Sortir maintenant", note: "Risque de gêner ou d'être gêné",
     delta: function() {
      // Si rivals en piste : plus de risque de trafic
      var r = (typeof G !== 'undefined' && G.rivals) || [];
      var density = r.length / 20;
      return Math.random() < 0.3 + density * 0.2 ? +(0.12 + Math.random()*0.28) : 0;
     },
     deltaLabel: "Trafic possible +0.2s", color: "#F59E0B"},
    {text: "Attendre — laisser les rivaux s'écarter", note: "Pneus refroidissent légèrement",
     delta: function() { return +(0.04 + Math.random()*0.07); },
     deltaLabel: "+0.05s (pneus froids)", color: "#60A5FA"},
    {text: "Timing parfait — analyser le trafic radar", note: "Nécessite bonne concentration",
     delta: function() { return Math.random() < 0.35 ? -(0.04 + Math.random()*0.05) : (Math.random() < 0.2 ? 0.08 : 0); },
     deltaLabel: "Fenêtre propre ±0s", color: "#34D399"}
   ]
  });

  // Étape 2 : SECTEUR 1 — contextualisé selon circuit
  var s1Title = ctype === "street" ? "Chicane d'entrée" : ctype === "highspeed" ? "Première courbe rapide" : "Secteur 1";
  var s1Choices;
  if (isWet) {
   s1Choices = [
    {text: "Ligne prudente — piste extérieure sèche", note: "Trajectoire conservatrice",
     delta: function() { return +(0.08 + Math.random()*0.10); }, deltaLabel: "+0.1s", color: "#60A5FA"},
    {text: "Trajectoire optimale", note: "Risqué sur mouillé",
     delta: function() { return Math.random() < 0.45 ? +(0.2 + Math.random()*0.3) : -(0.05 + Math.random()*0.1); },
     deltaLabel: "Risqué ±0.3s", color: "#F97316"},
   ];
  } else if (ctype === "highspeed") {
   s1Choices = [
    {text: "Appui maximum — plein gaz sur l'apex", note: "Tout ou rien",
     delta: function() { return Math.random() < 0.35 ? +(0.12+Math.random()*0.2) : -(0.06+Math.random()*0.10); },
     deltaLabel: "Risqué — grosse récompense", color: "#EF4444"},
    {text: "Trajectoire propre — équilibre vitesse/appui", note: "Bon compromis",
     delta: function() { return +(0.01 + Math.random()*0.04); }, deltaLabel: "±0s", color: "#34D399"},
    {text: "Réduire la prise de risque", note: "Tu laisses du temps",
     delta: function() { return +(0.06 + Math.random()*0.08); }, deltaLabel: "+0.08s", color: "#9CA3AF"}
   ];
  } else if (ctype === "street") {
   s1Choices = [
    {text: "Raser les murets — trajectoire ultime", note: "Murs des deux côtés",
     delta: function() { return Math.random() < 0.4 ? +(0.15+Math.random()*0.25) : -(0.08+Math.random()*0.12); },
     deltaLabel: "Risqué ±0.2s", color: "#EF4444"},
    {text: "Ligne propre — légèrement conservateur", note: "Fiable",
     delta: function() { return +(0.02 + Math.random()*0.05); }, deltaLabel: "+0.03s", color: "#60A5FA"},
    {text: "Trajectoire standard", note: "Sans risque",
     delta: function() { return +(0.05 + Math.random()*0.07); }, deltaLabel: "+0.06s", color: "#9CA3AF"}
   ];
  } else {
   s1Choices = [
    {text: "Freinage tardif au premier virage", note: "Limite de grip",
     delta: function() { return Math.random() < 0.3 ? +(0.12+Math.random()*0.18) : -(0.04+Math.random()*0.08); },
     deltaLabel: "Risqué ±0.15s", color: "#F97316"},
    {text: "Trajectoire optimale", note: "Bon équilibre",
     delta: function() { return +(0.01 + Math.random()*0.03); }, deltaLabel: "≈ référence", color: "#34D399"},
    {text: "Trajectoire conservatrice", note: "Tu laisses du temps",
     delta: function() { return +(0.05 + Math.random()*0.09); }, deltaLabel: "+0.07s", color: "#9CA3AF"}
   ];
  }
  steps.push({id: "s1", title: s1Title, subtitle: "Secteur 1", icon: "⏱️", desc: "Le secteur 1 est décisif pour la suite du tour.", choices: s1Choices});

  // Étape 3 : SECTEUR 3 — moment de vérité
  steps.push({
   id: "s3",
   title: "Secteur final",
   subtitle: "Dernière chance",
   icon: "🏁",
   desc: "Dernier secteur. Le tour se joue ici — concentration maximale.",
   choices: [
    {text: "Tour parfait — tout donner sur le dernier virage",
     note: "Risque d'erreur mais gain potentiel maximal",
     delta: function() { return Math.random() < 0.25 ? +(0.2+Math.random()*0.3) : -(0.06+Math.random()*0.12); },
     deltaLabel: "Gain max, erreur possible", color: "#EF4444"},
    {text: "Maintenir la concentration — tour propre",
     note: "Pas d'erreur, pas de gain exceptionnel",
     delta: function() { return +(0.01+Math.random()*0.03); }, deltaLabel: "Tour propre", color: "#34D399"},
    {text: "Gérer l'arrivée — sécuriser le chrono",
     note: "On perd un peu mais le temps est sûr",
     delta: function() { return +(0.05+Math.random()*0.08); }, deltaLabel: "+0.06s — chrono sécurisé", color: "#60A5FA"}
   ]
  });

  // --- Moteur de séquence ---
  var totalDelta = 0;
  var stepIdx = 0;
  var modalId = "quali-hotlap-seq-modal";

  function showStep(idx) {
   var existing = document.getElementById(modalId);
   if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

   var step = steps[idx];
   var modal = document.createElement("div");
   modal.id = modalId;
   modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.80);z-index:9997;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)";

   var progress = "";
   for (var pi = 0; pi < steps.length; pi++) {
    progress += '<span style="display:inline-block;width:22px;height:4px;border-radius:2px;margin:0 2px;background:'+(pi<idx?"#34D399":pi===idx?"#FF1801":"rgba(255,255,255,0.2)")+'"></span>';
   }

   var choicesHtml = "";
   step.choices.forEach(function(c, ci) {
    choicesHtml += '<button onclick="_qualiSeqChoice('+ci+')" style="width:100%;padding:12px 14px;margin-bottom:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);border-radius:10px;color:var(--text);font-family:var(--font-body);font-size:13px;font-weight:600;cursor:pointer;text-align:left;display:flex;align-items:center;gap:12px;-webkit-tap-highlight-color:transparent">';
    choicesHtml += '<span style="font-size:11px;padding:3px 7px;background:'+c.color+'22;color:'+c.color+';border:1px solid '+c.color+'55;border-radius:5px;font-family:var(--font-display);font-weight:700;letter-spacing:.04em;white-space:nowrap">'+c.deltaLabel+'</span>';
    choicesHtml += '<div style="flex:1"><div>'+c.text+'</div><div style="font-size:11px;color:var(--text3);margin-top:2px">'+c.note+'</div></div>';
    choicesHtml += '</button>';
   });

   modal.innerHTML = '<div style="max-width:400px;width:100%;background:linear-gradient(180deg,var(--bg3) 0%,var(--bg2) 100%);border:1px solid var(--border-hi);border-top:3px solid #FF1801;border-radius:14px;padding:18px;box-shadow:0 16px 48px rgba(0,0,0,0.7)">'
    + '<div style="text-align:center;margin-bottom:14px">' + progress + '</div>'
    + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'
    + '<span style="font-size:24px">'+step.icon+'</span>'
    + '<div><div style="font-family:var(--font-display);font-size:9px;color:var(--muted);letter-spacing:.18em;text-transform:uppercase">'+step.subtitle+'</div>'
    + '<div style="font-family:var(--font-display);font-size:17px;font-weight:900;color:var(--white)">'+step.title+'</div></div>'
    + '</div>'
    + '<div style="font-size:13px;color:var(--text2);margin-bottom:14px;line-height:1.4">'+step.desc+'</div>'
    + choicesHtml
    + '</div>';

   document.body.appendChild(modal);

   // Exposer le handler de choix globalement
   window._qualiSeqChoice = function(ci) {
    // Sécurité : si session changée entre-temps, abandonner
    if(typeof QUALI_STATE !== 'undefined' && QUALI_STATE.session !== session) {
     delete window._qualiSeqChoice;
     var _sm=document.getElementById('quali-hotlap-seq-modal');
     if(_sm&&_sm.parentNode)_sm.parentNode.removeChild(_sm);
     return;
    }
    var choice = step.choices[ci];
    var d = choice.delta();
    d = Math.round(d * 1000) / 1000; // arrondi à la milliseconde
    totalDelta += d;

    // Retirer le modal
    var m = document.getElementById(modalId);
    if (m && m.parentNode) m.parentNode.removeChild(m);

    stepIdx++;
    if (stepIdx < steps.length) {
     showStep(stepIdx);
    } else {
     // Tout est fait — appliquer le delta total et afficher le résultat
     var finalTime = Math.max(lapTime * 0.92, lapTime + totalDelta);
     finalTime = Math.round(finalTime * 1000) / 1000;
     delete window._qualiSeqChoice;
     onDone(finalTime, totalDelta);
    }
   };
  }

  showStep(0);

 } catch(e) {
  console.warn("_qualiHotLapSequence:", e);
  onDone(lapTime, 0); // fallback : afficher sans séquence
 }
}
function _qualiWarmupTyres() {
  var cfg = QUALI_STATE._tyreConfig;
  if (!cfg || !QUALI_STATE._tyreState) return;
  var ts = QUALI_STATE._tyreState;
  var timing = QUALI_STATE._timingChoice || "mid";
  var heatMult = QUALI_TIMING_OPTIONS.find(function(o){return o.id===timing;}).tyreHeatMult || 1.0;
  // Tour de chauffe : monte à ~80% de la fenêtre optimale
  var targetTemp = cfg.tempOpt[0] + 0.8 * (cfg.tempOpt[1] - cfg.tempOpt[0]);
  targetTemp = Math.round(targetTemp * heatMult);
  targetTemp = Math.max(cfg.tempMin, Math.min(cfg.tempMax, targetTemp));
  ts.temp = targetTemp;
  // Légère dégradation sur le tour de chauffe
  ts.deg = Math.min(100, ts.deg + Math.round(cfg.degPerLap * 0.3));
}

// --- Calcul de l'impact pneus sur le chrono ---
function _qualiTyreLapImpact() {
  var cfg = QUALI_STATE._tyreConfig;
  var ts = QUALI_STATE._tyreState;
  if (!cfg || !ts) return 0;
  var impact = 0;
  var temp = ts.temp;
  var deg = ts.deg;
  var optMin = cfg.tempOpt[0];
  var optMax = cfg.tempOpt[1];
  // Impact température
  var tempPct = (temp - optMin) / (optMax - optMin); // 0-1 dans la fenêtre
  if (temp < optMin) {
    // Trop froids
    var coldRatio = (optMin - temp) / (optMin - cfg.tempMin);
    impact += 0.8 * coldRatio; // jusqu'à +0.8s
  } else if (temp > optMax) {
    // Surchauffe
    var hotRatio = Math.min(1, (temp - optMax) / (cfg.tempMax - optMax));
    impact += 0.5 * hotRatio; // jusqu'à +0.5s
  } else {
    // Dans la fenêtre optimale — bonus
    impact -= 0.3;
  }
  // Impact dégradation
  if (deg >= 80) impact += 1.0;
  else if (deg >= 60) impact += 0.5;
  else if (deg >= 40) impact += 0.2;
  // Impact choix de timing
  var timing = QUALI_STATE._timingChoice || "mid";
  var timingOpt = QUALI_TIMING_OPTIONS.find(function(o){return o.id===timing;});
  if (timingOpt) impact -= timingOpt.lapBonus; // lapBonus positif = temps réduit
  return impact;
}

// --- Mise à jour des pneus après un tour chrono ---
function _qualiTyreAfterLap() {
  var cfg = QUALI_STATE._tyreConfig;
  var ts = QUALI_STATE._tyreState;
  if (!cfg || !ts) return;
  // Montée en temp après le tour lancé
  var tempGain = (cfg.tempOpt[1] - ts.temp) * 0.3;
  if (ts.temp < cfg.tempOpt[0]) tempGain += 8;
  ts.temp = Math.min(cfg.tempMax, Math.round(ts.temp + tempGain));
  // Dégradation
  ts.deg = Math.min(100, ts.deg + cfg.degPerLap);
  ts.setsUsed = (ts.setsUsed || 0);
}

// --- Changement de pneus (stands) ---
function _qualiChangeTyres() {
  var cfg = QUALI_STATE._tyreConfig;
  var ts = QUALI_STATE._tyreState;
  if (!cfg || !ts) return false;
  // F1 : vérifie le stock global
  if (cfg.setsF1) {
    if (ts.setsUsed >= ts.setsTotal) return false; // plus de sets
    ts.setsUsed++;
  } else {
    if (ts.setsTotal !== 999 && ts.setsUsed >= ts.setsTotal - 1) return false;
    ts.setsUsed++;
  }
  // Pneus frais
  ts.temp = cfg.tempMin;
  ts.deg = 0;
  return true;
}

// --- Rendu de l'indicateur pneus ---
function _renderQualiTyreIndicator() {
  var cfg = QUALI_STATE._tyreConfig;
  var ts = QUALI_STATE._tyreState;
  if (!cfg || !ts) return '';
  var temp = ts.temp;
  var deg = ts.deg;
  var optMin = cfg.tempOpt[0];
  var optMax = cfg.tempOpt[1];
  // Couleur température
  var tempColor, tempLabel;
  if (temp < optMin - 10) { tempColor = "#60A5FA"; tempLabel = "Froid"; }
  else if (temp < optMin) { tempColor = "#93C5FD"; tempLabel = "Sous-fenêtre"; }
  else if (temp <= optMax) { tempColor = "#34D399"; tempLabel = "Optimal"; }
  else if (temp <= optMax + 10) { tempColor = "#F59E0B"; tempLabel = "Chaud"; }
  else { tempColor = "#EF4444"; tempLabel = "Surchauffe"; }
  // Couleur dégradation
  var degColor;
  if (deg < 30) degColor = "#34D399";
  else if (deg < 55) degColor = "#F59E0B";
  else if (deg < 75) degColor = "#FB923C";
  else degColor = "#EF4444";
  // Sets restants
  var setsLeft = cfg.setsTotal === 999 ? "∞" : (ts.setsTotal - ts.setsUsed);
  var setsLabel = cfg.setsF1 ? " sets" : " set" + (setsLeft !== 1 && setsLeft !== "∞" ? "s" : "");
  var canChange = cfg.setsTotal === 999 || (cfg.setsF1 ? ts.setsUsed < ts.setsTotal : ts.setsUsed < ts.setsTotal - 1);
  // Barre température (0 = tempMin, 100 = tempMax)
  var tempRange = cfg.tempMax - cfg.tempMin;
  var tempPct = Math.max(0, Math.min(100, (temp - cfg.tempMin) / tempRange * 100));
  var optMinPct = (optMin - cfg.tempMin) / tempRange * 100;
  var optMaxPct = (optMax - cfg.tempMin) / tempRange * 100;
  var html = '<div style="background:linear-gradient(180deg,var(--bg3) 0%,var(--bg2) 100%);border:1px solid var(--border-hi);border-radius:10px;padding:10px 12px;margin-bottom:10px">';
  html += '<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--muted);letter-spacing:.14em;text-transform:uppercase;margin-bottom:8px">Pneus · ' + cfg.compound + '</div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">';
  // Température
  html += '<div>';
  html += '<div style="display:flex;justify-content:space-between;margin-bottom:3px">';
  html += '<span style="font-size:10px;color:var(--text3)">Température</span>';
  html += '<span style="font-family:var(--font-display);font-size:11px;font-weight:800;color:' + tempColor + '">' + temp + '°C <span style="font-size:9px;font-weight:600">' + tempLabel + '</span></span>';
  html += '</div>';
  html += '<div style="position:relative;height:6px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden">';
  html += '<div style="position:absolute;top:0;left:' + optMinPct.toFixed(1) + '%;width:' + (optMaxPct - optMinPct).toFixed(1) + '%;height:100%;background:rgba(52,211,153,.25);border-radius:2px"></div>';
  html += '<div style="position:absolute;top:0;left:0;height:100%;width:' + tempPct.toFixed(1) + '%;background:' + tempColor + ';border-radius:3px;transition:width .3s"></div>';
  html += '</div>';
  html += '<div style="font-size:9px;color:var(--muted);margin-top:2px">Fenêtre : ' + optMin + '–' + optMax + '°C</div>';
  html += '</div>';
  // Dégradation
  html += '<div>';
  html += '<div style="display:flex;justify-content:space-between;margin-bottom:3px">';
  html += '<span style="font-size:10px;color:var(--text3)">Dégradation</span>';
  html += '<span style="font-family:var(--font-display);font-size:11px;font-weight:800;color:' + degColor + '">' + deg + '%</span>';
  html += '</div>';
  html += '<div style="height:6px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden">';
  html += '<div style="height:100%;width:' + deg + '%;background:' + degColor + ';border-radius:3px;transition:width .3s"></div>';
  html += '</div>';
  html += '<div style="font-size:9px;color:var(--muted);margin-top:2px">' + (deg < 40 ? 'Bon état' : deg < 60 ? '−0.2s' : deg < 80 ? '−0.5s' : '−1.0s') + '</div>';
  html += '</div>';
  html += '</div>';
  // Sets + bouton changement
  html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">';
  html += '<span style="font-size:11px;color:var(--text3)">Sets restants : <strong style="color:' + (setsLeft === 0 ? '#EF4444' : 'var(--text)') + '">' + setsLeft + setsLabel + '</strong></span>';
  if (canChange && !QUALI_STATE._sessionRunning) {
    html += '<button onclick="_qualiPlayerChangeTyres()" style="padding:5px 10px;background:rgba(96,165,250,.12);border:1px solid rgba(96,165,250,.4);color:#60A5FA;border-radius:6px;font-family:var(--font-display);font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;cursor:pointer">Changer</button>';
  } else if (!canChange) {
    html += '<span style="font-size:10px;color:#EF4444">Plus de sets</span>';
  }
  html += '</div>';
  html += '</div>';
  return html;
}

function _qualiPlayerChangeTyres() {
  var ok = _qualiChangeTyres();
  if (ok) {
    if (typeof showToast === "function") showToast("Pneus neufs montés — " + (QUALI_STATE._tyreConfig.tempOpt[0]) + "°C");
    _renderQualiTyreWidget();
  } else {
    if (typeof showToast === "function") showToast("Plus de sets disponibles !");
  }
}

function _renderQualiTyreWidget() {
  var el = document.getElementById("quali-tyre-widget");
  if (el) el.innerHTML = _renderQualiTyreIndicator();
}

// --- Rendu du choix de timing ---
function _renderTimingChoice(session) {
  if (QUALI_STATE._timingChosen) return '';
  var weather = RACE_STATE.weather || { id: "dry" };
  var html = '<div style="background:linear-gradient(180deg,var(--bg3) 0%,var(--bg2) 100%);border:1px solid var(--border-hi);border-radius:10px;padding:12px 14px;margin-bottom:12px">';
  html += '<div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:var(--muted);letter-spacing:.14em;text-transform:uppercase;margin-bottom:8px">Stratégie de sortie — Q' + session + '</div>';
  html += '<div style="font-size:11px;color:var(--text3);margin-bottom:10px;line-height:1.4">Quand veux-tu sortir en piste ? Le moment impacte l\'état de la piste, tes pneus et le nombre de tentatives.</div>';
  QUALI_TIMING_OPTIONS.forEach(function(opt) {
    var isRiskyAndWet = opt.riskMeteo && (weather.id === "wet" || weather.id === "storm" || weather.id === "cloudy");
    html += '<button onclick="_qualiPickTiming(\'' + opt.id + '\')" style="display:block;width:100%;text-align:left;padding:10px 12px;margin-bottom:6px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;cursor:pointer;font-family:inherit">';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px"><span style="font-size:16px">' + opt.icon + '</span><span style="font-size:13px;font-weight:700;color:var(--text)">' + opt.label + '</span>';
    if (isRiskyAndWet) html += '<span style="font-size:9px;color:#F59E0B;font-family:var(--font-display);font-weight:800;letter-spacing:.06em;margin-left:auto">⚠ RISQUE MÉTÉO</span>';
    if (opt.lapBonus > 0) html += '<span style="font-size:9px;color:#34D399;font-family:var(--font-display);font-weight:800;letter-spacing:.06em;margin-left:auto">+' + opt.lapBonus.toFixed(1) + 's grip</span>';
    if (opt.lapBonus < 0) html += '<span style="font-size:9px;color:#F59E0B;font-family:var(--font-display);font-weight:800;letter-spacing:.06em;margin-left:auto">' + opt.lapBonus.toFixed(1) + 's grip</span>';
    html += '</div>';
    html += '<div style="font-size:11px;color:var(--text3);line-height:1.4">' + opt.desc + '</div>';
    html += '</button>';
  });
  html += '</div>';
  return html;
}

function _qualiPickTiming(id) {
  QUALI_STATE._timingChoice = id;
  QUALI_STATE._timingChosen = true;
  // Mettre à jour l'affichage
  var zone = document.getElementById("quali-btn-zone");
  if (zone) {
    var chosen = QUALI_TIMING_OPTIONS.find(function(o){return o.id===id;});
    var atemptsExtra = chosen ? chosen.attempts : 0;
    zone.innerHTML = '<div style="margin-bottom:8px;padding:8px 10px;background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.3);border-radius:8px;font-size:11px;color:#34D399">' +
      chosen.icon + ' <strong>' + chosen.label + '</strong> — ' + chosen.desc +
      '</div>' +
      '<button class="btn btn-prim" onclick="runQualiSession()">' + svgPlay(16) + 'Lancer Q' + QUALI_STATE.session + '</button>';
  }
}

// --- Rendu enrichi de la session ---
function renderQualiSession() {
  _rjUpdateBroadcastTitles();
  var e = QUALI_STATE.session;
  var t = QUALI_STATE.survived;
  var r = getQualiCutoff(e);
  var n = QUALI_DURATION[e] || 10;
  t.forEach(function(e) {
    QUALI_STATE.drivers[e].bestTime = null;
    QUALI_STATE.drivers[e].lastTime = null;
    QUALI_STATE.drivers[e].laps = 0;
    QUALI_STATE.drivers[e].improved = false;
    QUALI_STATE.drivers[e]._sessionForm = (Math.random() - 0.5) * 0.008;
  });
  // Init pneus
  _initQualiTyreState(e);
  QUALI_STATE._timingChosen = false;
  QUALI_STATE._sessionRunning = false;
  var a = {1:"var(--blue)", 2:"var(--amber)", 3:"#F59E0B"};
  var i = e < 3 ? getQualiElimCount(e) : 0;
  var o = 3 === e ? "Q3 — Bataille pour la pole (" + t.length + " pilotes)" : "Q" + e + " — Élimination (" + i + " pilote" + (i > 1 ? "s" : "") + " éliminé" + (i > 1 ? "s" : "") + ")";
  document.getElementById("quali-session-header").innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0 6px"><div><div style="font-size:16px;font-weight:800;color:' + a[e] + '">' + o + '</div><div style="font-size:11px;color:var(--text3);margin-top:1px">' + t.length + " pilotes · " + (RACE_STATE.circuit || G.cat) + " · " + n + ' minutes</div></div><span class="badge ' + (3 === e ? "b-gold" : 2 === e ? "b-amber" : "b-blue") + '">Q' + e + "</span></div>";
  var l = document.getElementById("quali-chrono-bar");
  l && (l.style.display = "none");
  renderTimingBoard(e, t, false);
  // Zone bouton : d'abord le choix de timing, puis le bouton
  var btnZone = document.getElementById("quali-btn-zone");
  if (btnZone) {
    if (!QUALI_STATE.spectatorMode) {
      // Widget pneus + choix timing
      btnZone.innerHTML = '<div id="quali-tyre-widget">' + _renderQualiTyreIndicator() + '</div>' + _renderTimingChoice(e);
    } else {
      btnZone.innerHTML = '<button class="btn btn-prim" onclick="runQualiSession()">' + svgPlay(16) + "Lancer Q" + e + " (spectateur)</button>";
    }
  }
  if (QUALI_STATE.spectatorMode) {
    document.getElementById("quali-status").innerHTML = '<span style="color:#9CA3AF">Mode spectateur · Tu es éliminé(e) en Q' + QUALI_STATE.playerElimSes + "</span>";
  } else {
    document.getElementById("quali-status").textContent = "Choisis ta stratégie de sortie.";
  }
}


function renderChronoBar(e,t,r){var n=document.getElementById("quali-chrono-bar");if(n){n.style.display="block";var a=Math.max(0,e/t*100),i,o=e%60,s=Math.floor(e/60)+":"+(o<10?"0":"")+o,l=a>33?"var(--teal,#34D399)":a>15?"var(--amber)":"var(--red)";n.innerHTML='<div style="background:linear-gradient(180deg, var(--bg3) 0%, var(--bg2) 100%);border:1px solid var(--border-hi);border-radius:10px;padding:7px 12px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px"><span style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em">Temps restant — Q'+r+'</span><span style="font-size:16px;font-weight:900;color:'+l+';font-variant-numeric:tabular-nums">'+s+'</span></div><div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden"><div style="height:100%;width:'+a+"%;background:"+l+';border-radius:2px;transition:width .9s linear"></div></div></div>'}}function driverBadge(e,t,r){r=r||16;var n=Math.max(10,Math.round(.82*r)),a=e&&"Indépendant"!==e&&TEAM_LOGOS[e],i=t||"FR",o=void 0!==G&&G&&"Karting Junior"===G.cat,s,l;return a&&!o?'<span style="display:inline-flex;align-items:center;gap:3px;vertical-align:middle;margin-right:5px;flex-shrink:0">'+('<span style="display:inline-flex;width:'+r+"px;height:"+r+'px;border-radius:2px;overflow:hidden;flex-shrink:0">'+TEAM_LOGOS[e].replace(/<svg([^>]*?)width="40" height="40"/,'<svg$1width="'+r+'" height="'+r+'"')+"</span>")+('<span style="display:inline-flex;flex-shrink:0">'+flagSvg(i,n)+"</span>")+"</span>":a?'<span style="display:inline-flex;width:'+r+"px;height:"+r+'px;border-radius:2px;overflow:hidden;vertical-align:middle;margin-right:5px;flex-shrink:0">'+TEAM_LOGOS[e].replace(/<svg([^>]*?)width="40" height="40"/,'<svg$1width="'+r+'" height="'+r+'"')+"</span>":'<span style="display:inline-flex;vertical-align:middle;margin-right:5px;flex-shrink:0">'+flagSvg(i,r)+"</span>"}function renderTimingBoard(e,t,r){var n=QUALI_STATE.drivers,a=getQualiCutoff(e),i=t.slice().sort(function(e,t){var r=n[e].bestTime,a=n[t].bestTime;return null===r&&null===a?0:null===r?1:null===a?-1:r-a}),o=null;i.forEach(function(e){n[e].bestTime&&(!o||n[e].bestTime<o)&&(o=n[e].bestTime)});var sectRec=[null,null,null];n.forEach(function(d){if(d&&d.bestSectors)for(var _s=0;_s<3;_s++){var _v=d.bestSectors[_s];"number"==typeof _v&&(null===sectRec[_s]||_v<sectRec[_s])&&(sectRec[_s]=_v)}});var s=1===e||2===e,l='<div style="display:flex;padding:6px 12px;background:var(--surface);font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid var(--border)"><span style="width:26px">Pos</span><span style="flex:1">Pilote</span><span style="width:24px;text-align:center">T</span><span style="width:72px;text-align:right">Meilleur</span><span style="width:44px;text-align:center;padding-left:10px">S</span><span style="width:48px;text-align:right;padding-left:8px">Écart</span></div>';i.forEach(function(e,t){var i=n[e],c=t+1,d=s&&c>a,p=r&&c>a,u=i.isPlayer,f;f=1===c?"#F59E0B":2===c?"#9CA3AF":3===c?"#CD7F32":p?"var(--red-light)":d?"#EF4444":"var(--text3)";var m="";u?m="background:#1e1515;":p?m="background:#160808;":d&&(m="background:rgba(239,68,68,0.06);");var g=d?"border-left:3px solid #EF4444;padding-left:9px;":"padding-left:12px;",h=i.bestTime?formatQualiTime(i.bestTime):"—:---.---",v=i.bestTime&&o?i.bestTime===o?"POLE":"+"+(i.bestTime-o).toFixed(3):"",x=i.improved?"#4ADE80":i.bestTime?1===c?"#F59E0B":"var(--text)":"var(--text3)",y=i.laps>0?'<span style="font-size:10px;color:var(--text3)">'+i.laps+"</span>":'<span style="font-size:10px;color:var(--border)">—</span>',b=driverBadge(i.team,i.nat,16),A=i.isPlayer?(G.pilot.prenom?G.pilot.prenom+" ":"")+G.pilot.nom:i.name,w="";if(i.lastSectorFlags||i.bestSectors){for(var M={0:"#FBBF24",1:"#34D399",2:"#7C3AED",NA:"#3F3F46"},E=[],T=0;T<3;T++){var k,L;k=i.lastSectorFlags&&typeof i.lastSectorFlags[T]==="number"?i.lastSectorFlags[T]:"NA",2===k&&!(i.bestSectors&&null!==sectRec[T]&&"number"==typeof i.bestSectors[T]&&i.bestSectors[T]<=sectRec[T]+1e-4)&&(k=1),E.push('<span style="display:inline-block;width:8px;height:3px;background:'+M[k]+';border-radius:1px"></span>')}w='<span style="display:inline-flex;gap:3px;align-items:center;justify-content:center">'+E.join("")+"</span>"}l+='<div style="display:flex;align-items:center;padding:8px 12px 8px 0;border-bottom:1px solid var(--border);'+g+m+(p&&r?"opacity:.6":"")+'"><span style="width:26px;font-size:13px;font-weight:800;color:'+f+';text-align:left">'+(p&&r?'<svg viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\" style=\"display:inline-block;vertical-align:-2px\"><line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"/><line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"/></svg>':c)+'</span><span style="flex:1;display:inline-flex;align-items:center;font-size:12px;font-weight:'+(u?"700":"400")+";color:"+(u?"var(--text)":"var(--text2)")+';min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+b+A+'</span><span style="width:24px;text-align:center">'+y+'</span><span style="width:72px;text-align:right;font-size:12px;font-weight:700;color:'+x+'">'+h+'</span><span style="width:44px;text-align:center;padding-left:10px">'+w+'</span><span style="width:48px;text-align:right;font-size:11px;color:var(--text3);padding-left:8px">'+v+"</span></div>"}),document.getElementById("quali-timing-board").innerHTML=l}function runQualiSession(){var e=QUALI_STATE.session,t=QUALI_STATE.survived,r=QUALI_STATE.drivers,n=getQualiCutoff(e),a=60*_qualiDurationFor(G.cat,e),i=Math.round(1e4*getSimSpeedMult());document.getElementById("quali-btn-zone").innerHTML="",document.getElementById("quali-status").textContent="Session en cours...",QUALI_STATE.chronoInterval&&clearInterval(QUALI_STATE.chronoInterval),QUALI_STATE.lapInterval&&clearInterval(QUALI_STATE.lapInterval);var o=a;
// Init pneus session
_initQualiTyreState(e);
QUALI_STATE._sessionRunning=true;
renderChronoBar(o,a,e),QUALI_STATE.chronoInterval=setInterval(function(){renderChronoBar(o=Math.max(0,o-1),a,e),o<=0&&(clearInterval(QUALI_STATE.chronoInterval),QUALI_STATE.chronoInterval=null)},i/a);var s={},l={};if(t.forEach(function(t){var n=r[t],a=1===e?2:1,i=1===e?3:2;if(n.isPlayer)s[t]=i;else{var o=i-a,l=.6*(n.skill-.5),c=.4*-(n.consistency-.5),d=Math.random()+l+c,p=a+Math.round(d*o);p=Math.max(a,Math.min(i,p)),s[t]=p}}),1===e||2===e){var c=1===e?3:2,d;t.slice().sort(function(e,t){return r[t].skill-r[e].skill}).forEach(function(e,t){var a=r[e],i=t+1,o,d=i<=n&&i>=n-2;
/* #13 — Calcul du rescue lap chance pour le joueur, basé sur :
 - stat pression (60% du poids) — modulateur principal, refletant la solidité mentale
 - consistency dérivée (40% du poids) — moyenne (regularite + concentration) / 200
 - plancher 55% (jamais ridicule), plafond 95% (toujours une part d'aléa)
*/
function _playerRescueChance(){
 var pression=(G.substats&&G.substats.pression)||50;
 var regul=(G.substats&&G.substats.regularite)||50;
 var concen=(G.substats&&G.substats.concentration)||50;
 var consistDerived=(regul+concen)/200; // 0..1
 var pressionN=Math.max(0,Math.min(1,pression/100));
 var composite=pressionN*0.6+consistDerived*0.4;
 // 55% (composite=0) à 95% (composite=1)
 return 0.55+0.40*composite;
}
if(i>n){var p=i-n,u=p<=2?.92:p<=4?.8:.65;if(a.isPlayer)u=_playerRescueChance();Math.random()<u&&(l[e]=!0,(s[e]||0)<c&&(s[e]=(s[e]||0)+1))}
else if(d){var f=a.isPlayer?_playerRescueChance()*0.85:.6;/* zone "pré-élim" : un peu moins motivé que zone profonde */ Math.random()<f&&(l[e]=!0,(s[e]||0)<c&&(s[e]=(s[e]||0)+1))}})}QUALI_STATE.driverLaps=s;var p=i/a,u,f=2.5*(QUALI_STATE.baseRef||90)*p,m=120*p,g=[],h;t.forEach(function(e){for(var t=s[e],r=!!l[e],n=r?t-1:t,a=Math.random()*i*.25,o=i*(r?.78:.92),c=o-a,d=n*f+Math.max(0,n-1)*m,p=n>1?Math.max(f,(c-f)/(n-1)):f,u=1;u<=n;u++){var h=a+(u-1)*p;h=Math.min(h,o),g.push({driverIdx:e,lap:u,totalLaps:t,scheduledMs:h})}if(r){var v,x=a+(n-1)*p+f+m,y=Math.max(x,i*(.85+.11*Math.random()));y=Math.min(y,.97*i),g.push({driverIdx:e,lap:t,totalLaps:t,scheduledMs:y,isRescue:!0})}}),g.sort(function(e,t){return e.scheduledMs-t.scheduledMs}),g.forEach(function(a){setTimeout(function(){var o=r[a.driverIdx],s=a.scheduledMs/i,l=qualiDriverTime(o,e,a.lap,a.totalLaps,s);o.laps=a.lap;var _bestBefore=o.bestTime;// Appliquer impact pneus si joueur
if(o.isPlayer&&!QUALI_STATE.spectatorMode){
  _qualiWarmupTyres();
  var _tyreImpact=_qualiTyreLapImpact();
  l=Math.max(l*0.92,l+_tyreImpact);
  _qualiTyreAfterLap();
  _renderQualiTyreWidget();
}
// Pour les tours chauds joueur, la mise à jour est faite dans le callback _qualiHotLapSequence
var _willUseSeq=o.isPlayer&&!QUALI_STATE.spectatorMode&&(a.lap>1||a.totalLaps===1)&&!a.isRescue&&typeof _qualiHotLapSequence==="function";
if(!_willUseSeq){o.improved=null!==o.bestTime&&l<o.bestTime;(null===o.bestTime||l<o.bestTime)&&(o.bestTime=l);o.lastTime=l;}
var c,d=splitLapIntoSectors(l,QUALI_STATE.circuitName||"",.016);o.lastSectors=d,o.bestSectors||(o.bestSectors=[null,null,null]),QUALI_STATE.bestSectors||(QUALI_STATE.bestSectors=[null,null,null]),QUALI_STATE.bestSectorsHolder||(QUALI_STATE.bestSectorsHolder=[null,null,null]);for(var p=[0,0,0],u=0;u<3;u++){var f=d[u];if(null===QUALI_STATE.bestSectors[u]||f<QUALI_STATE.bestSectors[u]){QUALI_STATE.bestSectors[u]=f;var m=QUALI_STATE.bestSectorsHolder[u];if(m&&m!==a.driverIdx){var g=r[m];g&&g.lastSectorFlags&&2===g.lastSectorFlags[u]&&(g.lastSectorFlags[u]=1)}QUALI_STATE.bestSectorsHolder[u]=a.driverIdx,p[u]=2}(null===o.bestSectors[u]||f<o.bestSectors[u])&&(o.bestSectors[u]=f,p[u]<2&&(p[u]=1))}o.lastSectorFlags=p,renderTimingBoard(e,t,!1);var h=document.getElementById("quali-status");if(h){var v,x=t.slice().sort(function(e,t){var n=r[e].bestTime,a=r[t].bestTime;return n||a?n?a?n-a:-1:1:0}).indexOf(a.driverIdx)+1;if(o.isPlayer&&!QUALI_STATE.spectatorMode&&typeof _showQualiPlayerLapModal==="function"){
 // Tour chaud (pas tour de reconnaissance = lap > 1 ou totalLaps=1)
 var _isKartQ=G.cat==="Karting Junior"||G.cat==="Karting Senior";
 var _isHotLap=!_isKartQ&&(a.lap>1||a.totalLaps===1)&&!a.isRescue;
 if(_isHotLap&&typeof _qualiHotLapSequence==="function"){
  // La séquence prend lapTime, demande 3 micro-choix, puis affiche le modal résultat
  (function(_l,_d,_x,_bb){
   _qualiHotLapSequence(_l,e,a.lap,a.totalLaps,function(finalTime,delta){
    // Mettre à jour le temps avec le delta de la séquence
    o.improved=null!==o.bestTime&&finalTime<o.bestTime;
    (null===o.bestTime||finalTime<o.bestTime)&&(o.bestTime=finalTime);
    o.lastTime=finalTime;
    var _dsectors=splitLapIntoSectors(finalTime,QUALI_STATE.circuitName||"",.016);
    o.lastSectors=_dsectors;
    // Mettre à jour bestSectors du joueur
    o.bestSectors=o.bestSectors||[null,null,null];
    QUALI_STATE.bestSectors=QUALI_STATE.bestSectors||[null,null,null];
    QUALI_STATE.bestSectorsHolder=QUALI_STATE.bestSectorsHolder||[null,null,null];
    var _sFlags=[0,0,0];
    for(var _si=0;_si<3;_si++){
     var _sf=_dsectors[_si];
     if(null===QUALI_STATE.bestSectors[_si]||_sf<QUALI_STATE.bestSectors[_si]){
      QUALI_STATE.bestSectors[_si]=_sf;
      QUALI_STATE.bestSectorsHolder[_si]=a.driverIdx;
      _sFlags[_si]=2;
     }
     if(null===o.bestSectors[_si]||_sf<o.bestSectors[_si]){
      o.bestSectors[_si]=_sf;
      if(_sFlags[_si]<2)_sFlags[_si]=1;
     }
    }
    o.lastSectorFlags=_sFlags;
    // Re-calculer la position après modification du temps
    var _xFinal=t.slice().sort(function(e,t){var n=r[e].bestTime,a=r[t].bestTime;return n||a?n?a?n-a:-1:1:0}).indexOf(a.driverIdx)+1;
    try{_showQualiPlayerLapModal(o,e,a.lap,a.totalLaps,finalTime,_dsectors,_xFinal,_bb);}catch(_e){console.warn(_e);}
    renderTimingBoard(e,t,false);
   });
  })(l,d,x,_bestBefore);
 } else {
  try{_showQualiPlayerLapModal(o,e,a.lap,a.totalLaps,l,d,x,_bestBefore);}catch(_e){}
 }
}if(o.isPlayer){var y=x<=n?"#4ADE80":"var(--red-light)",b=o.improved?" ↗ Amélioration !":a.lap>1?" → Pas d'amélioration":"";h.innerHTML='<span style="color:'+y+'">'+G.pilot.nom+" (T"+a.lap+") : P"+x+" — "+formatQualiTime(l)+b+(x<=n?" ":e<3?" ":"")+"<span style='font-size:9px;color:var(--text3);font-style:italic;margin-left:4px'>(provisoire)</span>"+"</span>"}else{var A=o.name;o.improved?h.innerHTML='<span style="color:#4ADE80">'+A+" améliore ! "+formatQualiTime(l)+"</span>":h.textContent=A+" (T"+a.lap+") : "+formatQualiTime(l)}setTimeout(function(){o.improved=!1,renderTimingBoard(e,t,!1)},600)}},a.scheduledMs)}),setTimeout(function(){clearInterval(QUALI_STATE.chronoInterval),QUALI_STATE.chronoInterval=null,renderChronoBar(0,a,e),concludeQualiSession(e,t,n)},i+500)}function concludeQualiSession(e,t,r){var n=QUALI_STATE.drivers;t.forEach(function(t){n[t].bestTime||(n[t].bestTime=qualiDriverTime(n[t],e,1,2,.5),n[t].laps=1)});var a=t.slice().sort(function(e,t){return n[e].bestTime-n[t].bestTime});renderTimingBoard(e,t,!0);var i=a.slice(0,r),o=a.slice(r),s=QUALI_STATE.drivers.findIndex(function(e){return e.isPlayer}),l=o.indexOf(s)>=0,c=a.indexOf(s)+1,d=document.getElementById("quali-status");var _maxSesEarly=(typeof _qualiMaxSessions==="function")?_qualiMaxSessions(G.cat):3;if(e<_maxSesEarly)d.innerHTML=l?'<span style="color:var(--red-light)">'+renderIcon('alert',14,'#EF4444')+' Éliminé en Q'+e+" — P"+c+"</span>":'<span style="color:#4ADE80">Qualifié Q'+(e+1)+" — actuellement P"+c+"</span>";else{var p=1===c?"#F59E0B":"var(--text2)";d.innerHTML='<span style="color:'+p+'">'+(1===c?"POLE POSITION !":"P"+c+" sur la grille")+"</span>"}var u=document.getElementById("quali-btn-zone");/* #2 — _maxSes : nombre max de sessions selon cat. Pour cats à session unique, on saute direct à la grille. */ var _maxSes=_maxSesEarly;if(e<_maxSes&&!l)QUALI_STATE.nextSurvived=i,u.innerHTML='<button class="btn btn-prim" onclick="advanceQuali()">Q'+(e+1)+svgArrowRight(16)+"</button>";else if(e<_maxSes&&l){var f=c,m;f=r+1+o.indexOf(s),f=Math.max(1,Math.min(QUALI_STATE.drivers.length,f)),RACE_STATE.qualiPos=f,G.qualiPos=f,QUALI_STATE.nextSurvived=i,QUALI_STATE.playerFinalPos=f,QUALI_STATE.playerElimSes=e;var g=e+1;u.innerHTML='<div style="display:flex;flex-direction:column;gap:8px"><button class="btn btn-sec" onclick="watchNextQuali('+g+')">'+svgEye()+"Regarder Q"+g+(g<3?" & Q3":"")+' →</button><button class="btn btn-prim" onclick="finishQuali(false,'+f+')">'+svgFlag()+"P"+f+" sur la grille — Départ !</button></div>"}else{var f;if(QUALI_STATE.spectatorMode){if(f=QUALI_STATE.playerFinalPos||Math.ceil(.7*QUALI_STATE.drivers.length),2===e&&1===QUALI_STATE.playerElimSes){QUALI_STATE.nextSurvived=i;var h=f;return u.innerHTML='<div style="display:flex;flex-direction:column;gap:8px"><button class="btn btn-sec" onclick="watchNextQuali(3)">'+svgEye()+'Regarder Q3 →</button><button class="btn btn-prim" onclick="finishQuali(false,'+h+')">'+svgFlag()+"P"+h+" sur la grille — Départ !</button></div>",void(d&&(d.innerHTML='<span style="color:#9CA3AF">Mode spectateur · P'+h+" sur la grille</span>"))}}else f=c;f=Math.max(1,Math.min(QUALI_STATE.drivers.length||20,f)),/* fix : cap au nombre réel de pilotes (le cap à 10 datait de l'époque où seule la F1 existait et où on assumait Q3 top 10) */RACE_STATE.qualiPos=f,G.qualiPos=f;var v=!QUALI_STATE.spectatorMode&&1===f;u.innerHTML='<button class="btn btn-prim" style="background:'+(v?"#b8860b":"var(--red)")+'" onclick="finishQuali('+(v?"true":"false")+","+f+')">'+(v?svgFlag(16)+"Pole position — Départ P1 !":svgFlag(16)+"P"+f+" sur la grille — Départ !")+"</button>",QUALI_STATE.spectatorMode&&d&&(d.innerHTML='<span style="color:#9CA3AF">Qualifications terminées · P'+f+" sur la grille</span>")}}function svgArrowRight(e){return'<svg width="'+(e=e||16)+'" height="'+e+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-left:5px"><polyline points="9 18 15 12 9 6"></polyline></svg>'}function svgPlay(e){return'<svg width="'+(e=e||16)+'" height="'+e+'" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;margin-right:5px"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'}function svgEye(e){return'<svg width="'+(e=e||15)+'" height="'+e+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:5px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>'}function svgFlag(e){return'<svg width="'+(e=e||15)+'" height="'+e+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:5px"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>'}function watchNextQuali(e){QUALI_STATE.session=e,QUALI_STATE.survived=QUALI_STATE.nextSurvived||QUALI_STATE.survived,QUALI_STATE.spectatorMode=!0,renderQualiSession()}function advanceQuali(){QUALI_STATE.session++;QUALI_STATE.survived=QUALI_STATE.nextSurvived||QUALI_STATE.survived;_resetQualiTyreForNewSeason();renderQualiSession()}function finishQuali(e,t){if(RACE_STATE.qualiPos=t,G.qualiPos=t,QUALI_STATE.spectatorMode=!1,QUALI_STATE.playerElimSes=0,QUALI_STATE.playerFinalPos=void 0,(function(){try{var _drv=QUALI_STATE.drivers||[];if(!_drv.length||!G.rivals)return;var _sorted=_drv.map(function(d,i){return{i:i,t:d.bestTime||9999}}).sort(function(a,b){return a.t-b.t});var _posMap={};_sorted.forEach(function(o,p){_posMap[o.i]=p+1});var _rivIdx=0;_drv.forEach(function(d,i){if(d.isPlayer)return;if(G.rivals[_rivIdx]){G.rivals[_rivIdx].qualiHistory=G.rivals[_rivIdx].qualiHistory||[];G.rivals[_rivIdx].qualiHistory.push(_posMap[i]||0);_rivIdx++}})}catch(_e){}})(),void 0!==RACE_WEEKEND_STATE&&(RACE_WEEKEND_STATE.qualifDone=!0,"function"==typeof updateRaceTabsVisibility&&updateRaceTabsVisibility()),e&&"function"==typeof _addFeedPost){var r=(G.pilot.prenom?G.pilot.prenom+" ":"")+(G.pilot.nom||""),n=G.currentTeam||"",a=RACE_STATE.circuitData&&RACE_STATE.circuitData.name||RACE_STATE.circuit||"";if(n&&"Indépendant"!==n&&Math.random()<.8){var i="@"+n.toLowerCase().replace(/\s+/g,"").replace(/[^a-z0-9]/g,"").substr(0,14);_addFeedPost({type:"team",author:n,handle:i,color:"#EF4444",body:" POLE POSITION pour "+r+" à "+a+" ! Excellente session de qualif. Demain tout est à jouer depuis la tête."})}if(void 0!==SOCIAL_PRESS_ACCOUNTS&&Math.random()<.3){var o=SOCIAL_PRESS_ACCOUNTS[Math.floor(Math.random()*SOCIAL_PRESS_ACCOUNTS.length)];_addFeedPost({type:"press",author:o.name,handle:o.handle,color:o.color,body:r+" signe la pole à "+a+". La course s'annonce indécise derrière."})}}"function"==typeof rtab&&rtab("strat",!0),G.evtChoice=null,RACE_STATE.evtMod=0;var s=document.getElementById("race-btn");s&&(s.disabled=!1,s.textContent="Départ !");var l=document.getElementById("live-leaderboard");l&&(l.innerHTML='<div style="padding:14px 16px;font-size:13px;color:var(--text3)">Prêt au départ. Lance la course !</div>');var c=document.getElementById("live-event-zone");c&&(c.style.display="none",c.innerHTML="")}var CURRENT_EVT_IDX=0;function showNextRaceEvent(){try{var _p=(typeof LIVE_RACE!=="undefined"&&LIVE_RACE&&LIVE_RACE.drivers)?LIVE_RACE.drivers.find(function(d){return d.isPlayer}):null;if(_p&&_p.dnf){if(typeof LIVE_RACE!=="undefined"&&LIVE_RACE)LIVE_RACE.paused=!1;if(typeof _hideRaceEventModal==="function")_hideRaceEventModal();return}}catch(_e){}var e=RACE_STATE.events[CURRENT_EVT_IDX];if(e){var t=document.getElementById("race-event-modal");t||((t=document.createElement("div")).id="race-event-modal",t.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px 22px;backdrop-filter:blur(4px)",document.body.appendChild(t)),t.style.display="flex";var r=e.lap?"Tour "+Math.round(e.lap*(LIVE_RACE.total||G.totalLaps||15)):"En course",n,a={depart:"Départ",early:"Début de course",mid:"Mi-course",late:"Fin de course",final:"Sprint final"}[e.phase]||"En course",i="";try{i="function"==typeof e.text?e.text():e.text||""}catch(e){i=""}var o='<div style="background:linear-gradient(180deg, var(--bg3) 0%, var(--bg2) 100%);border:1px solid var(--border-hi);border-top:3px solid var(--amber);border-radius:var(--r);max-width:420px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(240,160,32,0.15)">';o+='<div style="padding:14px 16px;border-bottom:1px solid var(--line);background:linear-gradient(135deg,rgba(240,160,32,0.10),transparent);position:relative">',o+='<div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:var(--amber);letter-spacing:.22em;text-transform:uppercase;margin-bottom:4px;display:flex;align-items:center;gap:8px"><span style="display:inline-block;width:3px;height:11px;background:var(--amber)"></span>'+r+" · "+a+"</div>",o+='<div style="font-family:var(--font-display);font-size:18px;font-weight:900;color:var(--white);line-height:1.2;letter-spacing:.01em">'+(e.title||"Événement course")+"</div>",o+="</div>",o+='<div style="padding:16px">',o+='<div style="font-size:14px;font-weight:500;color:var(--text);line-height:1.5;margin-bottom:14px">'+i+"</div>",o+='<div style="display:flex;flex-direction:column;gap:8px">',e.choices.forEach(function(t,r){var n=[];if("number"==typeof t.difficulty&&t.actionType)try{/* EVENTS V2 — utilise les outcomes figés s'ils existent (cohérence affichage ↔ roll) */ var a=t._frozenOutcomes||_computeChoiceOutcomes(t.difficulty,t.actionType),i=_describeChoiceRisk(a),s=Math.round(100*(a.brillant+a.succes));n.push('<span style="font-size:10px;color:'+i.color+';font-family:var(--font-display);letter-spacing:.04em;font-weight:800">'+i.stars+" "+i.label+" · "+s+"% réussite</span>");/* Ligne contextuelle : décompose pourquoi ce % */ if(a._meta){var _ml=[];_ml.push("Skill "+a._meta.skill);if(a._meta.actionDelta>0)_ml.push("contexte +"+a._meta.actionDelta);else if(a._meta.actionDelta<0)_ml.push("contexte "+a._meta.actionDelta);if(a._meta.ctxDelta<-3)_ml.push("conditions "+a._meta.ctxDelta);if(a._meta.mentalDelta&&a._meta.mentalDelta!==0)_ml.push("mental "+(a._meta.mentalDelta>0?"+":"")+a._meta.mentalDelta);if(_ml.length>1)n.push('<span style="font-size:9.5px;color:var(--text3);font-family:var(--font-body);letter-spacing:.02em">'+_ml.join(" · ")+"</span>")}}catch(e){}else t.mods&&t.mods.player>.012&&n.push('<span style="font-size:10px;color:#34D399;font-family:var(--font-display);letter-spacing:.04em">↑ Bon pour toi</span>'),t.mods&&t.mods.player<-.012&&n.push('<span style="font-size:10px;color:#EF4444;font-family:var(--font-display);letter-spacing:.04em">↓ Risque de pertes</span>'),t.mods&&"number"==typeof t.mods.chance&&t.mods.chance>0&&n.push('<span style="font-size:10px;color:#F59E0B;font-family:var(--font-display);letter-spacing:.04em">⚠ Risqué ('+Math.round(100*t.mods.chance)+"% échec)</span>");if(t.trustDelta){var l=t.trustDelta>0?"#34D399":"#EF4444";n.push('<span style="font-size:10px;color:'+l+';font-family:var(--font-display);letter-spacing:.04em">'+(t.trustDelta>0?"+":"")+t.trustDelta+" confiance écurie</span>")}t.rivalryDelta&&n.push('<span style="font-size:10px;color:#A78BFA;font-family:var(--font-display);letter-spacing:.04em">+'+t.rivalryDelta+" rivalité</span>"),t.mods&&t.mods.rivalIdx&&void 0!==t.mods.rivalIdx.idx&&G.rivals&&G.rivals[t.mods.rivalIdx.idx]&&n.push('<span style="font-size:10px;color:#60A5FA;font-family:var(--font-display);letter-spacing:.04em">Affecte '+G.rivals[t.mods.rivalIdx.idx].name+"</span>"),o+='<button onclick="resolveRaceEvt('+RACE_STATE.events.indexOf(e)+","+r+')" style="padding:12px 14px;border:1px solid var(--border);border-radius:10px;background:var(--surface2);color:var(--text);font-size:13.5px;font-weight:600;cursor:pointer;font-family:inherit;text-align:left;line-height:1.35;-webkit-tap-highlight-color:transparent;transition:background .14s">'+t.text+(n.length?'<div style="margin-top:6px;display:flex;gap:10px;flex-wrap:wrap">'+n.join("")+"</div>":"")+"</button>"}),o+="</div>",o+="</div>",o+="</div>",t.innerHTML=o}else _hideRaceEventModal()}function _hideRaceEventModal(){var e=document.getElementById("race-event-modal");e&&(e.innerHTML="",e.style.display="none",e.parentNode&&e.parentNode.removeChild(e)),void 0!==LIVE_RACE&&LIVE_RACE&&(LIVE_RACE.paused=!1)}function resolveRaceEvt(e,t){var r=RACE_STATE.events[e];if(r){var phaseMul=1;var _phase=r.phase||(r.ctx&&r.ctx.phase)||"mid";if(_phase==="depart")phaseMul=1.1;else if(_phase==="early")phaseMul=1.15;else if(_phase==="mid")phaseMul=1.0;else if(_phase==="late")phaseMul=0.75;else if(_phase==="final")phaseMul=0.6;var n=r.choices[t],a=n.mods||{},i=n.note||"",o=0,s="";if("number"==typeof n.difficulty&&n.actionType){var l,/* EVENTS V2 — utilise outcomes figés si disponibles, sinon recalcule (fallback) */ c=_rollChoiceOutcome(n._frozenOutcomes||_computeChoiceOutcomes(n.difficulty,n.actionType)),d=(void 0!==n.successMod?n.successMod:a.player||0)*phaseMul,p=(void 0!==n.brilliantMod?n.brilliantMod:1.3*(void 0!==n.successMod?n.successMod:a.player||0))*phaseMul,u=(void 0!==n.rateMinMod?n.rateMinMod:.4*-Math.abs(void 0!==n.successMod?n.successMod:a.player||0))*phaseMul,f=(void 0!==n.rateMajMod?n.rateMajMod:1*-Math.abs(void 0!==n.successMod?n.successMod:a.player||0))*phaseMul;"brillant"===c?(o=p,s="Exécution brillante",i="Geste parfait — tu gagnes du terrain."):"succes"===c?(o=d,s="Réussi",i=i||"Bonne décision, ça paye."):"neutre"===c?(o=.3*d,s="Sans effet notable",i="Rien de décisif."):"rateMin"===c?(o=u,s="Raté",i="Tentative maladroite — tu perds un peu de terrain."):(o=f,s="Gros raté",i=n.dnfOnMaj?n.dnfMsg||"Erreur grave — abandon.":"Grosse erreur — tu concèdes du terrain.");
// === Lot 1 — Capture des outcomes explicites par niveau de réussite ===
// Permet aux events de course de spécifier un effet précis (perte de positions, dégradation pneus, etc.)
// selon le résultat du roll, plutôt que de tout dériver d'un seul `mod` générique.
var _lotExplicit=null;
if(c==="brillant"){
 if(typeof n.posGainOnBrillant==="number")_lotExplicit=_lotExplicit||{};_lotExplicit&&(_lotExplicit.posGain=n.posGainOnBrillant);
 if(n.paceModOnBrillant){_lotExplicit=_lotExplicit||{};_lotExplicit.paceMod=n.paceModOnBrillant;}
 if(n.tyreDamageOnBrillant){_lotExplicit=_lotExplicit||{};_lotExplicit.tyreDamage=n.tyreDamageOnBrillant;}
}else if(c==="succes"){
 if(typeof n.posGainOnSucces==="number"){_lotExplicit=_lotExplicit||{};_lotExplicit.posGain=n.posGainOnSucces;}
 if(n.paceModOnSucces){_lotExplicit=_lotExplicit||{};_lotExplicit.paceMod=n.paceModOnSucces;}
 if(n.tyreDamageOnSucces){_lotExplicit=_lotExplicit||{};_lotExplicit.tyreDamage=n.tyreDamageOnSucces;}
}else if(c==="rateMin"){
 if(typeof n.posLossOnRateMin==="number"){_lotExplicit=_lotExplicit||{};_lotExplicit.posLoss=n.posLossOnRateMin;}
 if(n.paceModOnRateMin){_lotExplicit=_lotExplicit||{};_lotExplicit.paceMod=n.paceModOnRateMin;}
 if(n.tyreDamageOnRateMin){_lotExplicit=_lotExplicit||{};_lotExplicit.tyreDamage=n.tyreDamageOnRateMin;}
}else if(c==="rateMaj"){
 if(typeof n.posLossOnRateMaj==="number"){_lotExplicit=_lotExplicit||{};_lotExplicit.posLoss=n.posLossOnRateMaj;}
 if(n.paceModOnRateMaj){_lotExplicit=_lotExplicit||{};_lotExplicit.paceMod=n.paceModOnRateMaj;}
 if(n.tyreDamageOnRateMaj){_lotExplicit=_lotExplicit||{};_lotExplicit.tyreDamage=n.tyreDamageOnRateMaj;}
}
// _lotExplicit sera consommé plus bas dans le bloc applyEventOutcome
}else o=a.player||0,a.chance&&"object"==typeof a.chance&&Math.random()<a.chance.fail&&(o+=a.chance.failMod,i=a.chance.msg||"L'action s'est mal passée."),"number"==typeof a.chance&&Math.random()<a.chance&&(o=-Math.abs(1.3*o),i="Tentative ratée — tu perds du terrain.");if(RACE_STATE.evtMod+=o,LIVE_RACE&&LIVE_RACE.paused&&r.ctx){var m=LIVE_RACE.drivers.find(function(e){return e.isPlayer});m&&!m.dnf&&("number"!=typeof m.eventScoreOffset&&(m.eventScoreOffset=0),m.eventScoreOffset+=.5*o,m.eventScoreOffset=Math.max(-.10,Math.min(.10,m.eventScoreOffset)),m.score=Math.max(.02,Math.min(.99,m.score+.4*o)),(n.dnfOnMaj&&"Gros raté"===s||o<-.28)&&(m.dnf=!0,"function"==typeof addPressure&&addPressure(5)));
// Callback crise si l'event est un crisis event
try{if(r&&r._isCrisis&&n&&typeof n._crisisResolve==="function")n._crisisResolve(c);}catch(_cr){};
// === Persistent effects layer pour resolveRaceEvt ===
if(m&&!m.dnf){
 var _pOut2={reason:r.title||"événement"};
 var _hasExp=false;
 // Priorité 1 : outcomes explicites par niveau (brillant/succes/rateMin/rateMaj) — Lot 1
 if(_lotExplicit){
  if(typeof _lotExplicit.posLoss==="number"&&_lotExplicit.posLoss>0){_pOut2.posLoss=_lotExplicit.posLoss;_hasExp=true;}
  if(typeof _lotExplicit.posGain==="number"&&_lotExplicit.posGain>0){_pOut2.posGain=_lotExplicit.posGain;_hasExp=true;}
  if(_lotExplicit.paceMod){_pOut2.paceMod=_lotExplicit.paceMod;_hasExp=true;}
  if(_lotExplicit.tyreDamage){_pOut2.tyreDamage=_lotExplicit.tyreDamage;_hasExp=true;}
 }
 // Priorité 2 : outcomes globaux du choix (sans dépendre du roll)
 if(typeof n.posLoss==="number"&&n.posLoss>0&&!_pOut2.posLoss){_pOut2.posLoss=n.posLoss;_hasExp=true}
 if(typeof n.posGain==="number"&&n.posGain>0&&!_pOut2.posGain){_pOut2.posGain=n.posGain;_hasExp=true}
 if(n.paceMod&&!_pOut2.paceMod){_pOut2.paceMod=n.paceMod;_hasExp=true}
 if(n.tyreDamage&&!_pOut2.tyreDamage){_pOut2.tyreDamage=n.tyreDamage;_hasExp=true}
 // Fallback : conversion automatique du `mod` legacy
 if(!_hasExp&&Math.abs(o)>=0.012){
  var _conv2=_convertLegacyMod(m,o,r.title||"événement");
  if(_conv2&&_conv2.paceMod)_pOut2.paceMod=_conv2.paceMod;
 }
 if(_pOut2.posLoss||_pOut2.posGain||_pOut2.paceMod||_pOut2.tyreDamage){
  var _sum2=applyEventOutcome(m,_pOut2);
  if(_sum2&&_sum2.summary){i=i?(i+" · "+_sum2.summary):_sum2.summary}
 }
}
var g=n.intent||null,h;if(!g&&"attaque"===n.actionType&&r.ctx.ahead&&(g="attaque"),!g&&"defense"===n.actionType&&r.ctx.behind&&(g="defense"),"attaque"===g&&r.ctx.ahead&&m&&!m.dnf){if((h=LIVE_RACE.drivers.find(function(e){return e.name===r.ctx.ahead.name}))&&!h.dnf)if("Exécution brillante"===s||"Réussi"===s){var v=m.pos,x=h.pos;m.pos=x,h.pos=v,"number"!=typeof m.eventScoreOffset&&(m.eventScoreOffset=0),"number"!=typeof h.eventScoreOffset&&(h.eventScoreOffset=0),m.eventScoreOffset+=.012*phaseMul,h.eventScoreOffset-=.010*phaseMul,h.score=Math.max(.05,h.score-.015*phaseMul);var _next2=LIVE_RACE.drivers.find(function(e){return!e.dnf&&e.pos===x-1&&e.name!==m.name});var _capScore=_next2?Math.min(_next2.score-.005,h.score+.020*phaseMul):(h.score+.020*phaseMul);m.score=Math.min(.99,Math.max(m.score,Math.min(_capScore,h.score+.012*phaseMul)));RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:"Dépassement sur "+h.name,choice:"—",note:"Tu passes P"+m.pos,sign:"+",color:"#34D399"})}else if("Gros raté"===s){"number"!=typeof m.eventScoreOffset&&(m.eventScoreOffset=0),m.eventScoreOffset-=.012*phaseMul,h.score=Math.min(.99,h.score+.015*phaseMul);var y=LIVE_RACE.drivers.find(function(e){return!e.dnf&&!e.isPlayer&&e.pos===m.pos+1});if(y&&y.score-m.score>-.04){var b=m.pos,A=y.pos;m.pos=A,y.pos=b;var _prev2=LIVE_RACE.drivers.find(function(e){return!e.dnf&&e.pos===A+1&&e.name!==m.name});var _capScoreLo=_prev2?Math.max(_prev2.score+.005,y.score-.020*phaseMul):(y.score-.020*phaseMul);m.score=Math.max(.02,Math.max(_capScoreLo,Math.max(m.score,y.score-.012*phaseMul)));y.score=Math.max(y.score,m.score+.008),RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:"Grosse erreur",choice:"—",note:y.name+" te dépasse",sign:"−",color:"#EF4444"})}}}else if("defense"===g&&r.ctx.behind&&m&&!m.dnf){var w=LIVE_RACE.drivers.find(function(e){return e.name===r.ctx.behind.name});if(w&&!w.dnf)if("Exécution brillante"===s||"Réussi"===s){"number"!=typeof m.eventScoreOffset&&(m.eventScoreOffset=0),"number"!=typeof w.eventScoreOffset&&(w.eventScoreOffset=0),m.eventScoreOffset+=.010*phaseMul,w.eventScoreOffset-=.010*phaseMul,w.score=Math.max(.05,w.score-.015*phaseMul);var _aheadD=LIVE_RACE.drivers.find(function(e){return!e.dnf&&e.pos===m.pos-1&&e.name!==m.name});var _capD=_aheadD?Math.min(_aheadD.score-.005,w.score+.020*phaseMul):(w.score+.020*phaseMul);m.score=Math.min(.99,Math.max(m.score,Math.min(_capD,w.score+.012*phaseMul)));RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:"Défense tenue sur "+w.name,choice:"—",note:"Position conservée",sign:"+",color:"#34D399"})}else if("Raté"===s||"Gros raté"===s){"number"!=typeof m.eventScoreOffset&&(m.eventScoreOffset=0),m.eventScoreOffset-=.012*phaseMul;var M=m.pos,E=w.pos;m.pos=E,w.pos=M;var _behindD=LIVE_RACE.drivers.find(function(e){return!e.dnf&&e.pos===E+1&&e.name!==m.name});var _capDLo=_behindD?Math.max(_behindD.score+.005,w.score-.020*phaseMul):(w.score-.020*phaseMul);m.score=Math.max(.02,Math.max(_capDLo,Math.max(m.score-.005,w.score-.012*phaseMul)));w.score=Math.max(w.score,m.score+.008),RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:"Dépassé par "+w.name,choice:"—",note:"Tu chutes P"+m.pos,sign:"−",color:"#EF4444"})}}if(n.trustDelta&&void 0!==TEAM_TRUST&&(TEAM_TRUST.value=Math.max(5,Math.min(100,TEAM_TRUST.value+n.trustDelta))),n.rivalryDelta&&G._rivalries&&G._rivalries.length>0){var T=r.ctx.ahead&&r.ctx.isRival(r.ctx.ahead)?r.ctx.ahead:r.ctx.behind&&r.ctx.isRival(r.ctx.behind)?r.ctx.behind:null;if(T){var k=G._rivalries.find(function(e){return e.name===T.name});k&&(k.intensity=Math.min(100,(k.intensity||50)+n.rivalryDelta))}}}if(a.rivalIdx&&void 0!==a.rivalIdx.mod&&LIVE_RACE&&LIVE_RACE.drivers){var L=r.ctx&&r.ctx.ahead?r.ctx.ahead.name:null,h;if(L)(h=LIVE_RACE.drivers.find(function(e){return e.name===L}))&&(h.score=Math.max(.02,h.score+a.rivalIdx.mod))}else a.rivalIdx&&G.rivals[a.rivalIdx.idx]&&(RACE_STATE.rivalMods[a.rivalIdx.idx]+=a.rivalIdx.val||0);void 0!==a.rivalAll&&(RACE_STATE.rivalMods=RACE_STATE.rivalMods.map(function(e){return e+a.rivalAll}));var S=o>.01?"+":o<-.01?"−":"~",C=o>.01?"var(--teal,#34D399)":o<-.01?"var(--red-light)":"var(--text3)";RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:r.phase,text:"function"==typeof r.text?r.text():r.text,choice:n.text.substring(0,50)+(s?" → "+s:""),note:i||(o>.03?"Bonne décision !":o<-.03?"Coup dur.":"Impact limité."),sign:S,color:C}),G.evtChoice=t,CURRENT_EVT_IDX++,(n._doPit&&typeof _playerPit==="function"&&_pitEnabledForCurrentRace()&&LIVE_RACE.drivers&&function(){var pp=LIVE_RACE.drivers.find(function(d){return d.isPlayer});if(pp&&!pp.dnf&&(pp._pitsDone||0)<_pitConfigForCat().maxStops){_playerPit(true)}}()),LIVE_RACE&&LIVE_RACE.paused?(LIVE_RACE.paused=!1,_hideRaceEventModal()):showNextRaceEvent()}}var LIVE_RACE={drivers:[],cur:0,total:0,phase:0,paused:!1,interval:null,pendingEvent:null,resolvedEvents:[],finished:!1,eventsSchedule:[],_tyreMode:"normal"}
/* Modes de gestion pneus actifs pendant la course.
 * "normal"  : pas de modification — rythme habituel
 * "push"    : pneus poussés — +0.18s/tour wearSec, +0.012 score/tour
 * "manage"  : gestion active — -30% dégradation, -0.008 score/tour (perte de rythme)
 * Le mode est appliqué dans _tickTyreWear et dans tickRace pour le score. */
function _setTyreMode(mode){
 if(!LIVE_RACE||LIVE_RACE.finished)return;
 var prev=LIVE_RACE._tyreMode||"normal";
 if(prev===mode)return;
 LIVE_RACE._tyreMode=mode;
 var labels={normal:"Rythme normal",push:"Mode Attaque",manage:"Mode Gestion"};
 var colors={normal:"#9CA3AF",push:"#EF4444",manage:"#34D399"};
 var descs={
  normal:"Retour au rythme de course standard.",
  push:"Tu pousses fort — pace maximal mais usure accélérée.",
  manage:"Tu préserves les pneus — dégradation réduite, rythme plus lent."
 };
 if(typeof pushRadioMsg==="function")pushRadioMsg(labels[mode],descs[mode],{ttl:4,color:colors[mode]});
 if(typeof renderPitButton==="function")renderPitButton();
 if(typeof renderLiveLeaderboard==="function")renderLiveLeaderboard();
}

/* ===== EVENTS DE CRISE — Moments de bascule narratifs =================
 * Déclenchés sur des conditions précises pendant la course.
 * Contournent le throttling normal (_choiceEventCount) car ils ne
 * doivent apparaître qu'une seule fois par course, au bon moment.
 *
 * 4 scénarios :
 * 1. CONFIANCE CRITIQUE — confiance < 25 à mi-course
 * 2. RIVAL TE DÉPASSE à mi-course alors qu'il était derrière
 * 3. SÉRIE NOIRE — momentum "ice" en début de course
 * 4. CHUTE LIBRE — tu as perdu 6+ places depuis la grille au tour 5
 * ===================================================================== */
function _injectCrisisEvent(evDef) {
 try {
  if (!LIVE_RACE || LIVE_RACE.finished || LIVE_RACE.paused) return;
  var ctx = typeof buildRaceCtx === 'function' ? buildRaceCtx() : null;
  if (!ctx) return;
  RACE_STATE.events = RACE_STATE.events || [];
  // Copier les choix pour ne pas muter l'objet global CRISIS_EVENTS
  var choices = evDef.choices.map(function(ch) { return Object.assign({}, ch); });
  // Freeze des outcomes (même pipeline que tryTriggerChoiceRaceEvent)
  choices.forEach(function(ch) {
   if (typeof ch.difficulty === 'number' && ch.actionType) {
    var targetRival = null; var rivalSkill = null;
    if (ch.actionType === 'attaque' && ctx.ahead) targetRival = ctx.ahead;
    else if (ch.actionType === 'defense' && ctx.behind) targetRival = ctx.behind;
    if (targetRival && typeof targetRival.rivalIdx === 'number' && G.rivals && G.rivals[targetRival.rivalIdx]) {
     rivalSkill = G.rivals[targetRival.rivalIdx].skill;
    }
    var actionCtx = {playerPos: ctx.playerPos, targetRival: targetRival, rivalSkill: rivalSkill};
    if (typeof _computeChoiceOutcomes === 'function') {
     ch._frozenOutcomes = _computeChoiceOutcomes(ch.difficulty, ch.actionType, actionCtx);
    }
   }
  });
  RACE_STATE.events.push({
   id: evDef.id,
   phase: evDef.phase || ctx.phase,
   lap: LIVE_RACE.cur / LIVE_RACE.total,
   title: evDef.title,
   text: evDef.text,
   choices: choices,
   ctx: ctx,
   _isCrisis: true
  });
  LIVE_RACE._lastChoiceEventLap = LIVE_RACE.cur;
  LIVE_RACE._choiceHistory = LIVE_RACE._choiceHistory || {};
  LIVE_RACE._choiceHistory[evDef.id] = LIVE_RACE.cur;
  LIVE_RACE.paused = true;
  if (typeof showNextRaceEvent === 'function') {
   CURRENT_EVT_IDX = RACE_STATE.events.length - 1;
   showNextRaceEvent();
  }
 } catch(e) { console.warn('_injectCrisisEvent:', e); }
}

/* Les 4 events de crise — définis globalement */
var CRISIS_EVENTS = {

 /* 1. CONFIANCE CRITIQUE */
 trust_critical: {
  id: 'crisis_trust',
  title: 'Moment de vérité',
  phase: 'mid',
  text: function(ctx) {
   var trust = typeof TEAM_TRUST !== 'undefined' ? TEAM_TRUST.value : 50;
   var team = G.currentTeam || 'l\'écurie';
   return 'Tu es à <strong>' + trust + '/100</strong> de confiance avec <strong>' + team + '</strong>. '
    + 'La direction sportive te regarde. Ce week-end peut tout changer — dans un sens ou dans l\'autre. '
    + 'Comment tu abondes la deuxième partie de course ?';
  },
  choices: [
   {
    text: 'Tout donner — résultat maximal, quitte à tout risquer',
    note: 'Prise de risque maximum. Brillant ou abandon.',
    difficulty: 0.65, actionType: 'attaque',
    successMod: 0.045, brilliantMod: 0.075, rateMinMod: -0.025, rateMajMod: -0.07,
    dnfOnMaj: true, dnfMsg: 'Tu as tout tenté. Contact en attaquant — abandon.',
    _crisisResolve: function(outcome) {
     if (outcome === 'brillant' || outcome === 'succes') {
      if (typeof changeTrust === 'function') changeTrust(8, 'Réaction en course — engagement total', '↑');
     } else if (outcome === 'rateMaj') {
      if (typeof changeTrust === 'function') changeTrust(-12, 'Abandon en tentant le tout-pour-tout', '↓');
     }
    }
   },
   {
    text: 'Stratégie propre — finir la course, sécuriser les points',
    note: 'Résultat solide, aucun risque. La confiance se reconstruit sur le long terme.',
    difficulty: 0.2, actionType: 'gestion',
    successMod: 0.015, brilliantMod: 0.025, rateMinMod: -0.008, rateMajMod: -0.018,
    _crisisResolve: function(outcome) {
     if (outcome === 'brillant' || outcome === 'succes') {
      if (typeof changeTrust === 'function') changeTrust(3, 'Course solide dans un moment difficile', '↑');
     }
    }
   },
   {
    text: 'Parler à l\'ingénieur — demander un plan de relance',
    note: 'L\'ingénieur propose un undercut agressif si la fenêtre est ouverte.',
    difficulty: 0.35, actionType: 'gestion',
    successMod: 0.025, brilliantMod: 0.05, rateMinMod: -0.01, rateMajMod: -0.02,
    trustDelta: 2,
    _crisisResolve: function(outcome) {}
   }
  ]
 },

 /* 2. RIVAL TE DÉPASSE */
 rival_passes: {
  id: 'crisis_rival',
  title: 'Ton rival vient de passer',
  phase: 'mid',
  text: function(ctx) {
   var rv = G._rivalries && G._rivalries.find(function(r) { return r.active; });
   var rvName = rv ? rv.name.split(' ').pop() : 'ton rival';
   var rvType = rv ? rv.type : 'rapproche';
   var typeMsg = rvType === 'dominance' ? 'Il te domine cette saison.' : rvType === 'contact' ? 'Vous avez de l\'histoire.' : 'La rivalité prend une nouvelle dimension.';
   return '<strong>' + rvName + '</strong> vient de te passer. ' + typeMsg + ' Il y a encore du temps. Tu fais quoi ?';
  },
  choices: [
   {
    text: 'Contre-attaque immédiate — le reprendre dans ce tour',
    note: 'Fenêtre courte. Agressif, risqué.',
    difficulty: 0.6, actionType: 'attaque',
    successMod: 0.04, brilliantMod: 0.07, rateMinMod: -0.02, rateMajMod: -0.055,
    rivalryDelta: 8,
    _crisisResolve: function(outcome) {
     if (outcome === 'brillant' || outcome === 'succes') {
      if (typeof addRivalryEvent === 'function') {
       var p = LIVE_RACE.drivers.find(function(d){ return d.isPlayer; });
       addRivalryEvent(G._rivalries[0] && G._rivalries[0].name || '', '', 'rapproche', p ? p.pos : 5, (p ? p.pos : 5) + 1);
      }
     }
    }
   },
   {
    text: 'Stratégie pit — le passer aux stands',
    note: 'Si la fenêtre est ouverte, c\'est le bon moment.',
    difficulty: 0.3, actionType: 'gestion',
    successMod: 0.03, brilliantMod: 0.05, rateMinMod: -0.01, rateMajMod: -0.02,
    _doPit: true,
    _crisisResolve: function(outcome) {}
   },
   {
    text: 'Gérer — finir devant lui au championnat compte plus',
    note: 'Tu lâches la position mais préserves la voiture et les pneus.',
    difficulty: 0.1, actionType: 'gestion',
    successMod: -0.01, brilliantMod: 0.005, rateMinMod: -0.005, rateMajMod: -0.01,
    _crisisResolve: function(outcome) {}
   }
  ]
 },

 /* 3. SÉRIE NOIRE — momentum "ice" */
 serie_noire: {
  id: 'crisis_serie',
  title: 'Quatrième course difficile',
  phase: 'early',
  text: function(ctx) {
   var races = G.races ? G.races.length : 0;
   return 'Quatre résultats décevants consécutifs. La pression monte dans le paddock. '
    + 'Tu as besoin d\'un résultat aujourd\'hui. Comment tu joues ce week-end ?';
  },
  choices: [
   {
    text: 'Mode attaque — tout ou rien, besoin d\'un résultat fort',
    note: 'Tu acceptes le risque. Un grand résultat ou rien.',
    difficulty: 0.55, actionType: 'attaque',
    successMod: 0.04, brilliantMod: 0.07, rateMinMod: -0.025, rateMajMod: -0.06,
    _crisisResolve: function(outcome) {
     if (outcome === 'brillant') {
      if (typeof changeMental === 'function') changeMental(8, 'Réaction en série noire');
     } else if (outcome === 'rateMaj') {
      if (typeof changeMental === 'function') changeMental(-5, 'Échec en essayant de réagir');
     }
    }
   },
   {
    text: 'Course propre — reconstruire la confiance point par point',
    note: 'Résultat modeste mais solide. La série s\'arrête.',
    difficulty: 0.2, actionType: 'gestion',
    successMod: 0.012, brilliantMod: 0.02, rateMinMod: -0.006, rateMajMod: -0.015,
    _crisisResolve: function(outcome) {
     if (outcome === 'brillant' || outcome === 'succes') {
      if (typeof changeMental === 'function') changeMental(4, 'Course propre en période difficile');
      if (typeof changeTrust === 'function') changeTrust(2, 'Régularité dans la difficulté', '');
     }
    }
   },
   {
    text: 'Changer le setup — prendre un risque technique pour changer la dynamique',
    note: 'Setup non testé. Peut changer la donne ou aggraver les choses.',
    difficulty: 0.45, actionType: 'adaptation',
    successMod: 0.03, brilliantMod: 0.06, rateMinMod: -0.02, rateMajMod: -0.045,
    _crisisResolve: function(outcome) {
     G._lastSetupMismatch = (outcome === 'rateMin' || outcome === 'rateMaj') ?
      {cat: G.cat, circuit: RACE_STATE.circuit || '', saison: G.saison} : null;
    }
   }
  ]
 },

 /* 4. CHUTE LIBRE — perdu 6+ places au tour 5 */
 chute_libre: {
  id: 'crisis_chute',
  title: 'Départ catastrophique',
  phase: 'early',
  text: function(ctx) {
   var gridPos = RACE_STATE.qualiPos || 5;
   var curPos = ctx.playerPos || gridPos + 6;
   return 'Tu es à <strong>P' + curPos + '</strong> alors que tu partais <strong>P' + gridPos + '</strong>. '
    + 'Le départ a tout compromis. Il reste encore beaucoup de tours — mais chaque décision compte maintenant.';
  },
  choices: [
   {
    text: 'Pousser fort maintenant — reprendre les positions perdues',
    note: 'Les pneus sont chauds, le trafic devant est compact. Fenêtre courte.',
    difficulty: 0.5, actionType: 'attaque',
    successMod: 0.035, brilliantMod: 0.065, rateMinMod: -0.02, rateMajMod: -0.05,
    _crisisResolve: function(outcome) {
     if (outcome === 'brillant') {
      if (typeof pushRadioMsg === 'function') pushRadioMsg('Réaction !!', 'Tu reprends des places — beau mental.', {ttl:4, color:'#34D399'});
     }
    }
   },
   {
    text: 'Pit stop anticipé — ressortir avec des pneus neufs dans du trafic dégagé',
    note: 'Stratégie undercut. Risqué si la fenêtre est tôt, payant si le circuit convient.',
    difficulty: 0.35, actionType: 'gestion',
    successMod: 0.03, brilliantMod: 0.055, rateMinMod: -0.015, rateMajMod: -0.03,
    _doPit: true,
    _crisisResolve: function(outcome) {}
   },
   {
    text: 'Gérer les pneus — viser une longue fin de course',
    note: 'Tu laisses les autres s\'user. Stratégie de fin de course.',
    difficulty: 0.15, actionType: 'gestion',
    successMod: 0.01, brilliantMod: 0.025, rateMinMod: -0.005, rateMajMod: -0.012,
    _crisisResolve: function(outcome) {}
   }
  ]
 }
};
var PHASE_LABELS=["Formation lap","Debut de course","Mi-course","Duels","Sprint final","Dernier tour !"];function runRaceLive(){
PTS_TABLE=_getPtsTable();
SPRINT_PTS_TABLE=_getSprintPtsTable();
// Mettre à jour le header course
(function(){
  try{
    var _raceNum = (typeof G!=="undefined"&&G.races)?G.races.length+1:1;
    var _circuit = (typeof RACE_STATE!=="undefined"&&RACE_STATE.circuit)||"";
    if(typeof _updateRaceHeader==="function") _updateRaceHeader(_raceNum, _circuit);
  }catch(_e){console.warn("_updateRaceHeader:",_e);}
})();
var e=document.getElementById("race-btn");e&&(e.disabled=!0,e.textContent="En course...");var t=getNextRace(),r=t?t.name:"";r&&RACE_STATE.circuit!==r&&(RACE_STATE.circuit=r,setTimeout(function(){"function"==typeof renderCircuitDashboard&&renderCircuitDashboard(r);},50),RACE_STATE.circuitData=getCircuitData(r),RACE_STATE.weather||(RACE_STATE.weather=generateWeather(RACE_STATE.circuitData&&RACE_STATE.circuitData.rain||0))),RACE_STATE.circuitData||(RACE_STATE.circuitData=getCircuitData(r)),RACE_STATE.weather||(RACE_STATE.weather=generateWeather(RACE_STATE.circuitData&&RACE_STATE.circuitData.rain||0));var n=RACE_STATE.circuitData,a=RACE_STATE.weather,i=G.totalLaps||20,o=RACE_STATE.qualiPos||5,s,/* #14 — Modulateur de nombre de tours par circuit. Adapte la longueur de course selon le circuit réel. */ _circuitLapsMul=(function(){
 var name=String(RACE_STATE.circuit||"").toLowerCase();
 if(!name)return 1;
 // Formats endurance (priorité haute — doivent passer avant les checks par ville)
 if(name.indexOf("le mans")>=0||name.indexOf("lemans")>=0)return 1.5;
 if(name.indexOf("sebring 12h")>=0)return 1.8;
 if(name.indexOf("bahrain 8h")>=0)return 1.6;
 if(name.indexOf("6h")>=0)return 1.3;
 // Ovales IndyCar = courses très longues
 if(name.indexOf("indianapolis 500")>=0||name.indexOf("indy 500")>=0)return 2.5;
 if(name.indexOf("texas")>=0||name.indexOf("iowa")>=0||name.indexOf("gateway")>=0)return 1.6;
 // Circuits longs (laps réduits car circuit physiquement long)
 if(name.indexOf("spa")>=0)return 0.85; // Spa = 7km, fewer laps
 // Circuits courts (laps augmentés)
 if(name.indexOf("monaco")>=0&&name.indexOf("kart")<0)return 1.4; // Monaco = 3.3km, more laps
 // Circuits techniques courts
 if(name.indexOf("hungaroring")>=0||name.indexOf("budapest")>=0)return 1.15;
 if(name.indexOf("zandvoort")>=0)return 1.1;
 return 1; // défaut
})();
i=Math.max(5,Math.round(i*_circuitLapsMul));
G.totalLaps=i; // synchronise pour les autres systèmes (UI, etc.)
/* SPRINT — Si on est en sprint weekend et que la sprint n'a pas encore été faite,
   on bascule en mode sprint : laps × 0.33, pit désactivé, points sprint au résultat. */
var _isSprintMode=(typeof _shouldRunSprintNow==="function")&&_shouldRunSprintNow();
if(_isSprintMode){
 i=Math.max(5,Math.round(i*0.33));
 G.totalLaps=i;
}
var l=.02*({"Karting Junior":0,"Karting Senior":1,"Formule 4":2,"Formula Regional":3,"Formule 3":4,"Formule 2":5,"Formule 1":6,"Super Formula":4,"Endurance WEC":4,IndyCar:5}[G.cat]||0),c=computeSetupImpact(),d=computeStrategyImpact(0),p=c.scoreBonus,u=d.scoreBonus,f=d.variance,m=G.currentTeam&&"Indépendant"!==G.currentTeam?getEffectiveTeamRating(G.currentTeam):72,g=G.substats?computeRacePerformanceScore():(.3*G.stats.vitesse+.2*G.stats.regularite+.15*G.stats.sangfroid+.15*G.stats.attaque+.1*G.stats.strategie+.1*G.stats.physique)/100+.02,h=0;"num1"===G._playerRole?h=.012:"num2"===G._playerRole&&(h=-.008);var _catLevelBonus=(function(){var _cl={"Karting Junior":.040,"Karting Senior":.100,"Formule 4":.180,"Formula Regional":.260,"Formule 3":.300,"Formule 2":.360,"Formule 1":.420,"Super Formula":.340,"Endurance WEC":.370,"IndyCar":.330};var _styleAdj=(G.pilot&&G.pilot.style==="attaquant")?.030:(G.pilot&&G.pilot.style==="stratege")?.015:0;var _base=(_cl[G.cat]||.20)+_styleAdj;var _exp=Math.min(0.05,(G.races?G.races.length:0)*0.002);return _base-_exp;})();var _catLevelBonus=(function(){var _cl={"Karting Junior":.040,"Karting Senior":.100,"Formule 4":.180,"Formula Regional":.260,"Formule 3":.300,"Formule 2":.360,"Formule 1":.420,"Super Formula":.340,"Endurance WEC":.340,"IndyCar":.300};var _base=_cl[G.cat]||.20;var _exp=Math.min(0.05,(G.races?G.races.length:0)*0.002);return _base-_exp;})();var _momentum=typeof _getMomentum==="function"?_getMomentum():"neutral";var _momentumBonus={"hot":.018,"warm":.009,"neutral":0,"cold":-.008,"ice":-.018}[_momentum]||0;var _gridBonus=(function(){var _qp=RACE_STATE&&RACE_STATE.qualiPos||5;return _qp>=8?.008:_qp>=5?.003:_qp<=3?-.004:0;})();var _mismatchPen=(G._lastSetupMismatch&&G._lastSetupMismatch.cat===G.cat)?-.008:0;var v=Math.min(.97,Math.max(.03,g+u+p+teamRatingToBonus(m)+getHappinessBonus()+h+_momentumBonus+_gridBonus+_mismatchPen+_catLevelBonus+("function"==typeof getPlayerEngineerBonus?getPlayerEngineerBonus():0)+(Math.random()-.5)*f*.5+(function(){try{return(typeof _getTeamCircuitAffinity==='function'?_getTeamCircuitAffinity(m===72?(G.currentTeam||''):G.currentTeam,G.cat,RACE_STATE.circuit):0)*0.012}catch(_eA){return 0}})())),x=[{name:(G.pilot.prenom?G.pilot.prenom+" ":"")+G.pilot.nom,nat:G.pilot.nat||"FR",isPlayer:!0,score:v,baseScore:v,stratV:f,pos:o,startPos:o,team:G.currentTeam||"Indépendant",gap:0,dnf:!1,evtMod:0,prevPos:o}];G.rivals.forEach(function(e,t){var r=Math.min(.96,Math.max(.02,e.skill/100+l+teamRatingToBonus(e.team?getEffectiveTeamRating(e.team):72)+.7*a.rainMod+.2*(Math.random()-.5)*(1-e.consistency+.25)+(function(){try{return(typeof _getTeamCircuitAffinity==='function'?_getTeamCircuitAffinity(e.team,G.cat,RACE_STATE.circuit):0)*0.012}catch(_eA){return 0}})()+(function(){try{var _rh=e.raceHistory||[];var _rec=_rh.slice(-3);if(!_rec.length)return 0;var _fs=0;_rec.forEach(function(r){var p=r.pos||r.p||20;_fs+=p<=1?4:p<=3?2.5:p<=6?1:p<=10?.4:p<=15?-.2:-.5});var _fm=_fs/_rec.length;return _fm>=2.5?.015:_fm>=1.2?.007:_fm>=-.1?0:_fm>=-.6?-.006:-.014}catch(_e){return 0}})()));x.push({name:e.name,nat:e.nat||"FR",isPlayer:!1,score:r,baseScore:r,stratV:.14*(1-e.consistency+.25),pos:0,startPos:0,team:e.team||null,gap:0,dnf:!1,evtMod:0,rivalIdx:t,prevPos:0})});var y=x.filter(function(e){return!e.isPlayer});try{if(typeof QUALI_STATE!=="undefined"&&QUALI_STATE&&QUALI_STATE.drivers&&QUALI_STATE.drivers.length){var _qSorted=QUALI_STATE.drivers.map(function(d,i){return{i:i,t:d.bestTime||9999,isP:!!d.isPlayer}}).sort(function(a,b){return a.t-b.t});var _rivQRank={};var _rk=0;_qSorted.forEach(function(o){if(!o.isP){_rivQRank[o.i]=_rk;_rk++}});var _yWithRank=y.map(function(rv){var qIdx=null;var ri=rv.rivalIdx;if(typeof ri==="number"&&QUALI_STATE.drivers){var cnt=0;for(var qi=0;qi<QUALI_STATE.drivers.length;qi++){if(QUALI_STATE.drivers[qi].isPlayer)continue;if(cnt===ri){qIdx=qi;break}cnt++}}var qrk=qIdx!==null&&_rivQRank[qIdx]!==undefined?_rivQRank[qIdx]:9999;return{d:rv,qrk:qrk}});_yWithRank.sort(function(a,b){return a.qrk-b.qrk});y=_yWithRank.map(function(it){return it.d})}else{y.sort(function(e,t){return t.score-e.score})}}catch(_e){y.sort(function(e,t){return t.score-e.score})}for(var b=[],A=1;A<=x.length;A++)A!==o&&b.push(A);y.forEach(function(e,t){e.startPos=b[t]||t+2,e.pos=e.startPos,e.prevPos=e.startPos});/* #4 — Probabilités de départ contextuelles.
 - reactivite (joueur) ou consistency (rivaux) module les chances
 - Pluie/storm = +50% chance de raté pour tout le monde
 - P1 (pole) a un risque accru d'être attaqué/contact
 - Effet immédiat (n) sur le score, mais limité à 1 tour (n est consommé au tour 1)
*/
var _wxMod=(a&&a.rainMod&&a.rainMod<0)?(1-2*a.rainMod):1; // 1 si dry, ~1.2 si wet, 1.4 si storm
var _playerReact=(G.substats&&G.substats.reactivite)||50;
var _playerSuperChance=Math.min(0.30,Math.max(0.05,0.05+(_playerReact-30)/100*0.40)); // 5%..30% selon réactivité 30..100
var _playerBadChance=Math.min(0.25,Math.max(0.04,0.04+(80-_playerReact)/100*0.30)); // 4%..25% inversé
_playerBadChance*=_wxMod;
var w=Math.random()<_playerSuperChance,M=Math.random()<_playerBadChance;
x.forEach(function(e){var t=e.startPos||e.pos||1,n=0;if(e.isPlayer){if(w&&t>3)n=.025;else if(M)n=-.018;
 // P1 attaqué : si pole et raté de départ, perte aggravée à -0.030
 if(t===1&&M)n=-.030;
}else{
 // Rivaux : leur consistency module leur fiabilité au départ
 var _rIdx=e.rivalIdx;
 var _cons=(typeof _rIdx==="number"&&G.rivals&&G.rivals[_rIdx]&&G.rivals[_rIdx].consistency)||0.7;
 var _rSuperChance=Math.min(0.20,Math.max(0.06,0.06+(_cons-0.5)*0.25)); // 6%..20%
 var _rBadChance=Math.min(0.22,Math.max(0.06,0.06+(0.85-_cons)*0.30))*_wxMod;
 // P1 rival (pole) plus exposé
 if(t===1)_rBadChance*=1.3;
 var a=Math.random();
 if(a<_rSuperChance)n=.018;
 else if(a<_rSuperChance+_rBadChance)n=t===1?-.022:-.014;
}/* #1 — n (effet du départ proprement dit) garde son effet permanent sur score, mais le malus de grille r=.013*-(t-1) est converti en paceMod temporaire (3 tours) appliqué après init de LIVE_RACE plus bas. */e.score=Math.min(.97,Math.max(.03,e.score+n)),e.baseScore=e.score,e.gridPos=t,e.startBonus=n,e.eventScoreOffset=0}),(LIVE_RACE={drivers:x,cur:0,total:i,phase:0,paused:!1,interval:null,pendingEvent:null,resolvedEvents:[],finished:!1,eventsSchedule:buildLiveEventSchedule(i),_setupRadioDone:!1,_setupMidRadioDone:!1,_momentumRadioDone:!1,_gridRadioDone:!1,_posDropRadioDone:!1,_crisisHistory:{},_undercutAlertedFor:null,_overcutAlertedFor:null,_tyreAttackAlertedFor:null,_lastStratCheckLap:-10}).setupImpact=c,LIVE_RACE.stratPrevBonus=u;var E=RACE_STATE.circuit||getNextRace()&&getNextRace().name||"",T=E?getCircuitBaseRef(E,G.cat):85;a&&a.rainMod&&(T*=1-1.5*a.rainMod),LIVE_RACE.baseRef=T,LIVE_RACE.bestLap=null,x.forEach(function(e){e.lastLap=null,e.bestLap=null,e.totalTime=0,e.penaltySec=0,e.penaltyLog=[],e.bestSectors=[null,null,null],e.lastSectors=null,e.lastSectorFlags=[0,0,0];if(typeof e._tyreLife==="undefined"){e._tyreLife=100;e._tyreLifeAlerted40=false;e._tyreLifeAlerted20=false;}}),(function(){
// #1 — Effet de grille temporaire : un pilote parti en arrière est désavantagé pendant 3 tours
// puis revient à son rythme naturel (au lieu de traîner ce malus toute la course).
// Échelle : P1 = 0, chaque position en plus = +0.13s/tour pendant 3 tours.
// Modulé par la cat (kart = effet plus fort car aspiration plus marquée).
try{
 var _isKart=G.cat==="Karting Junior"||G.cat==="Karting Senior";
 var _perPos=_isKart?0.18:0.13;
 var _laps=_isKart?2:3;
 LIVE_RACE.drivers.forEach(function(d){
  var gp=d.gridPos||1;
  if(gp<=1)return;
  var deltaSec=_perPos*(gp-1);
  // Cap dur : pas plus de 1.5s/tour de malus de grille
  if(deltaSec>1.5)deltaSec=1.5;
  if(typeof _evtAddPaceMod==="function")_evtAddPaceMod(d,deltaSec,_laps,"Position de grille P"+gp);
 });
}catch(_e){console.warn("grid paceMod failed:",_e)}
})(),RACE_STATE.eventsLog=[],/* SPRINT — flag posé sur LIVE_RACE pour utilisation côté finalizeLiveRace et autres */ LIVE_RACE._isSprintMode=_isSprintMode,/* #5 — Application des bonus d'essais libres au démarrage de course. racePace = paceMod permanent appliqué dès le tour 1, durée = course entière. */(function(){if(!G._fpBonus||!G._fpBonus.racePace)return;var p=LIVE_RACE.drivers&&LIVE_RACE.drivers.find(function(d){return d.isPlayer});if(!p)return;if(typeof _evtAddPaceMod!=="function")return;_evtAddPaceMod(p,G._fpBonus.racePace,LIVE_RACE.total||100,"Réglages essais libres")})(),renderLiveLeaderboard(),(typeof _scheduleRivalPits==="function"&&_scheduleRivalPits()),(typeof renderPitButton==="function"&&setTimeout(renderPitButton,200)),setTimeout(tickRace,400);
// Inject tyre pulse CSS animation si pas encore présent
(function(){
 if(document.getElementById("rj-tyre-anim"))return;
 var s=document.createElement("style");
 s.id="rj-tyre-anim";
 s.textContent="@keyframes rj-tyre-pulse{0%{opacity:1}100%{opacity:0.35}}";
 document.head.appendChild(s);
})()
}var PASSIVE_EVENTS=[{id:"safety_car",weightFn:function(e){var t=RACE_STATE.circuitData||{},r=RACE_STATE.weather||{},n="wet"===r.id||"storm"===r.id;/* #9 — IndyCar oval : safety car beaucoup plus fréquent (×3) car les ovales ont des incidents fréquents et toute sortie déclenche neutralisation */ if(typeof _isOvalRace==="function"&&_isOvalRace())return 3;return"street"===t.type?3:n?2.5:1},gen:function(e){return{icon:"",title:"Safety Car déployée",desc:"Incident en piste — peloton regroupé",color:"#F59E0B",ttl:6,effects:function(){var e=LIVE_RACE.drivers.filter(function(e){return!e.dnf});if(0!==e.length){var t=e.reduce(function(e,t){return e+t.score},0)/e.length;e.forEach(function(e){e.score=.55*e.score+.45*t;if(e.penaltySec)e.penaltySec=Math.max(0,e.penaltySec*.3)});LIVE_RACE._bypassPositionCap=true;RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:"Safety Car",choice:"—",note:"Peloton regroupé",sign:"~",color:"#F59E0B"})}}}}},/* #8 — Slow zone WEC : neutralisation partielle, écarts compressés mais moins qu'un SC complet. Ne s'applique qu'en Endurance WEC. */{id:"slow_zone_wec",weightFn:function(e){if(typeof _isWECRace!=="function"||!_isWECRace())return 0;return 2.5},gen:function(e){return{icon:"",title:"Slow zone (Code 60)",desc:"Section neutralisée — vitesse limitée 60 km/h temporairement",color:"#34D399",ttl:4,effects:function(){var alive=LIVE_RACE.drivers.filter(function(d){return!d.dnf});if(alive.length<2)return;var avg=alive.reduce(function(s,d){return s+d.score},0)/alive.length;/* Compression 70/30 (vs 55/45 pour SC complet) */alive.forEach(function(d){d.score=0.7*d.score+0.3*avg;if(d.penaltySec)d.penaltySec=Math.max(0,d.penaltySec*0.6)});LIVE_RACE._bypassPositionCap=true;RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:"Slow zone WEC",choice:"—",note:"Écarts partiellement compressés",sign:"~",color:"#34D399"})}}}},{id:"rival_contact",weightFn:function(e){return 2},gen:function(e){var t=LIVE_RACE.drivers.filter(function(e){return!e.dnf&&!e.isPlayer});if(t.length<2)return null;t.sort(function(e,t){return e.pos-t.pos});var r=Math.floor(Math.random()*(t.length-1)),n=t[r],a=t[r+1],i=LIVE_RACE.drivers.find(function(e){return e.isPlayer});if(!i)return null;var o=i.pos;if(n.pos>o+5&&a.pos>o+5)return null;if(n.pos<o-5&&a.pos<o-5)return null;return{icon:"",title:"Contact en piste",desc:n.name+" et "+a.name+" s'accrochent",color:"#EF4444",ttl:5,effects:function(){n.score=Math.max(.05,n.score-.04),a.score=Math.max(.05,a.score-.06),n.penaltySec=(n.penaltySec||0)+1.5,a.penaltySec=Math.round((a.penaltySec||0)+3),RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:"Contact "+n.name+" / "+a.name,choice:"—",note:"Tu profites du chaos",sign:"+",color:"#34D399"})}}}},{id:"player_contact",weightFn:function(e){var t;return"street"===(RACE_STATE.circuitData||{}).type?1.4:1},gen:function(e){var t=LIVE_RACE.drivers.find(function(e){return e.isPlayer});if(!t||t.dnf)return null;var r=t.pos,n=LIVE_RACE.drivers.filter(function(e){return!e.dnf&&!e.isPlayer&&Math.abs((e.pos||99)-r)<=2});if(0===n.length)return null;var a=n[Math.floor(Math.random()*n.length)],i=a.pos<r;return{icon:"",title:i?"Contact — ta faute":"Contact — faute du rival",desc:a.name+(i?" se plaint à la radio":" t'a accroché"),color:"#EF4444",ttl:5,effects:function(){i?(t.score=Math.max(.05,t.score-.025),t.penaltySec=(t.penaltySec||0)+3,a.score=Math.max(.05,a.score-.05)):(t.score=Math.max(.05,t.score-.05),a.score=Math.max(.05,a.score-.025),a.penaltySec=(a.penaltySec||0)+3),"function"==typeof addRivalryEvent&&addRivalryEvent(a.name,a.team,"contact",r,a.pos,null,i?"Contact — ta faute":"Contact — sa faute"),RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:"Contact avec "+a.name,choice:"—",note:i?"Tu l'as accroché":"Il t'a accroché",sign:"-",color:"#EF4444"})}}}},{id:"rival_puncture",weightFn:function(e){var t;return"street"===(RACE_STATE.circuitData||{}).type?1.8:1},gen:function(e){var t=LIVE_RACE.drivers.filter(function(e){return!e.dnf&&!e.isPlayer});if(0===t.length)return null;var r=LIVE_RACE.drivers.find(function(e){return e.isPlayer});if(!r)return null;var n=t.filter(function(e){return Math.abs(e.pos-r.pos)<=4}),a=(n.length?n:t)[Math.floor(Math.random()*(n.length?n.length:t.length))];return{icon:"",title:"Crevaison",desc:a.name+" subit une crevaison",color:"#F59E0B",ttl:4,effects:function(){a.score=Math.max(.05,a.score-.06),a.penaltySec=(a.penaltySec||0)+5,RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:"Crevaison "+a.name,choice:"—",note:"Rival affaibli",sign:"+",color:"#34D399"})}}}},{id:"rival_engine",weightFn:function(e){var t=G.cat||"";return"Formule 1"===t||"Formule 2"===t?1.2:"Karting Junior"===t||"Karting Senior"===t?.3:.7},gen:function(e){if(LIVE_RACE.cur<.3*LIVE_RACE.total)return null;var t=LIVE_RACE.drivers.filter(function(e){return!e.dnf&&!e.isPlayer});if(0===t.length)return null;var p=LIVE_RACE.drivers.find(function(e){return e.isPlayer});var pPos=p?p.pos:99;var nearby=t.filter(function(d){return Math.abs(d.pos-pPos)<=6});var pool=nearby.length>0?nearby:t;var r=pool[Math.floor(Math.random()*pool.length)];return{icon:"",title:"Abandon — moteur",desc:r.name+" s'arrête, moteur cassé",color:"#EF4444",ttl:5,effects:function(){r.dnf=!0,r.score=0,RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:"Abandon "+r.name+" (moteur)",choice:"—",note:"Une place de gagnée",sign:"+",color:"#34D399"})}}}},{id:"yellow_flag",weightFn:function(e){return 2},gen:function(e){return{icon:"",title:"Drapeau jaune",desc:"Secteur neutralisé — pas de dépassement",color:"#F59E0B",ttl:3,effects:function(){var e=LIVE_RACE.drivers.filter(function(e){return!e.dnf});if(0!==e.length){var t=e.reduce(function(e,t){return e+t.score},0)/e.length;e.forEach(function(e){e.score=.85*e.score+.15*t});LIVE_RACE._bypassPositionCap=true;RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:"Drapeau jaune",choice:"—",note:"Écarts resserrés",sign:"~",color:"#F59E0B"})}}}}},{id:"rain_flash",weightFn:function(e){var t=RACE_STATE.weather||{};return"storm"===t.id?0:"wet"===t.id?.5:"cloudy"===t.id?1.5:.3},gen:function(e){return{icon:"️",title:"Averse soudaine",desc:"La piste s'humidifie — adhérence réduite",color:"#60A5FA",ttl:5,effects:function(){LIVE_RACE.drivers.forEach(function(e){if(!e.dnf)if(e.isPlayer){var t,r=.06*((G.substats&&G.substats.adapt?G.substats.adapt/100:.5)-.5);e.score=Math.max(.05,Math.min(.99,e.score+r))}else{var n=e.consistency||.7,r=.1*(Math.random()-.5)*(1-n);e.score=Math.max(.05,Math.min(.99,e.score+r))}}),RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:"Averse",choice:"—",note:"Adhérence perturbée",sign:"~",color:"#60A5FA"})}}}},{id:"rival_fastest",weightFn:function(e){return 1.2},gen:function(e){if(LIVE_RACE.cur<3)return null;var t=LIVE_RACE.drivers.filter(function(e){return!e.dnf&&!e.isPlayer});if(0===t.length)return null;var p=LIVE_RACE.drivers.find(function(e){return e.isPlayer});var pPos=p?p.pos:99;var r=t.filter(function(e){return Math.abs(e.pos-pPos)<=4&&e.pos<=8});if(0===r.length)return null;var n=r[Math.floor(Math.random()*r.length)];return{icon:"⏱",title:"Meilleur tour en piste",desc:n.name+" pousse fort",color:"#A78BFA",ttl:3,effects:function(){n.score=Math.min(.99,n.score+.015),RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:"Meilleur tour "+n.name,choice:"—",note:"Léger rattrapage",sign:"~",color:"#A78BFA"})}}}},{id:"storm_aquaplaning",weightFn:function(e){var w=RACE_STATE.weather||{};return w.id==="storm"?2.5:0},gen:function(e){if(LIVE_RACE.cur<3)return null;var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});if(!p||p.dnf)return null;var adapt=(G.substats&&G.substats.adapt?G.substats.adapt/100:.5);var sf=(G.substats&&G.substats.sangfroid?G.substats.sangfroid/100:.5);var skill=(adapt+sf)/2;var fail=Math.random()<(.45-.5*skill);if(!fail){return{icon:"storm",title:"Aquaplaning évité !",desc:"Tu sens l'arrière partir mais tu rattrapes — sang-froid !",color:"#34D399",ttl:5,effects:function(){p.score=Math.min(.99,p.score+.012);RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:"Aquaplaning maîtrisé",choice:"—",note:"+1.2% — sang-froid récompensé",sign:"+",color:"#34D399"})}}}else{var lostSec=1.5+Math.floor(2.5*Math.random());var dnfRisk=Math.random()<.05;if(dnfRisk){return{icon:"storm",title:"AQUAPLANING — sortie de piste !",desc:"Tu pars en aquaplaning et finis dans le bac — DNF !",color:"#EF4444",ttl:6,effects:function(){p.dnf=!0;p.score=0;RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:"Aquaplaning — DNF",choice:"—",note:"Sortie de piste sous la pluie",sign:"−",color:"#EF4444"});if(typeof addPressure==="function")addPressure(8)}}}return{icon:"storm",title:"Aquaplaning — tu glisses !",desc:"Tu pars en glisse, perds "+lostSec.toFixed(1)+"s avant de récupérer.",color:"#EF4444",ttl:5,effects:function(){p.score=Math.max(.05,p.score-.025);p.penaltySec=(p.penaltySec||0)+lostSec;p.penaltyLog||(p.penaltyLog=[]);p.penaltyLog.push({sec:lostSec,reason:"Aquaplaning",lap:LIVE_RACE.cur});RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:"Aquaplaning",choice:"—",note:"−"+lostSec.toFixed(1)+"s perdus",sign:"−",color:"#EF4444"});if(typeof addPressure==="function")addPressure(4)}}}}}
,{id:"storm_rival_off",weightFn:function(e){var w=RACE_STATE.weather||{};return w.id==="storm"?2.0:0},gen:function(e){if(LIVE_RACE.cur<3)return null;var rivals=LIVE_RACE.drivers.filter(function(d){return!d.isPlayer&&!d.dnf});if(rivals.length===0)return null;var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});var pPos=p?p.pos:99;var nearby=rivals.filter(function(r){return Math.abs(r.pos-pPos)<=3});var target=nearby.length>0?nearby[Math.floor(Math.random()*nearby.length)]:rivals[Math.floor(Math.random()*rivals.length)];var dnf=Math.random()<.30;return{icon:"storm",title:dnf?target.name+" — sortie de piste !":target.name+" part en glissade !",desc:dnf?target.name+" perd l'avant sous la pluie et termine dans le bac à graviers.":target.name+" perd plusieurs secondes après une grosse glissade.",color:dnf?"#EF4444":"#F59E0B",ttl:5,effects:function(){if(dnf){target.dnf=!0;target.score=0;RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:"Abandon "+target.name,choice:"—",note:"Sortie sous la pluie",sign:"+",color:"#34D399"})}else{target.score=Math.max(.05,target.score-.04);target.penaltySec=(target.penaltySec||0)+4;RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:target.name+" en glissade",choice:"—",note:"−4s pour le rival",sign:"+",color:"#34D399"})}}}}}
,{id:"storm_red_flag",weightFn:function(e){var w=RACE_STATE.weather||{};return w.id==="storm"&&LIVE_RACE.cur>=4?.4:0},gen:function(e){var alive=LIVE_RACE.drivers.filter(function(d){return!d.dnf});if(alive.length<3)return null;return{icon:"storm",title:"DRAPEAU ROUGE — course suspendue",desc:"Conditions trop dangereuses. Tous les pilotes regroupés au départ.",color:"#EF4444",ttl:7,effects:function(){var avg=alive.reduce(function(s,d){return s+d.score},0)/alive.length;alive.forEach(function(d){d.score=.55*avg+.45*d.score});alive.forEach(function(d){d.penaltySec=0});LIVE_RACE._bypassPositionCap=true;RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:"Drapeau rouge",choice:"—",note:"Tout est remis à zéro",sign:"~",color:"#EF4444"})}}}}
,{id:"wet_dry_line",weightFn:function(e){var w=RACE_STATE.weather||{};return w.id==="wet"?1.5:0},gen:function(e){var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});if(!p||p.dnf||LIVE_RACE.cur<2)return null;var adapt=(G.substats&&G.substats.adapt?G.substats.adapt/100:.5);var success=Math.random()<(.4+.4*adapt);if(success){return{icon:"wet",title:"Ligne sèche trouvée !",desc:"Tu repères une trajectoire sèche en bord de piste — gain net de rythme.",color:"#34D399",ttl:5,effects:function(){p.score=Math.min(.99,p.score+.022);RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:"Trajectoire sèche",choice:"—",note:"+2.2% — bon œil",sign:"+",color:"#34D399"})}}}return{icon:"wet",title:"Mauvaise trajectoire",desc:"Tu cherches la ligne sèche mais finis dans la flaque — temps perdu.",color:"#F59E0B",ttl:4,effects:function(){p.score=Math.max(.05,p.score-.012);RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:"Trajectoire ratée",choice:"—",note:"−1.2%",sign:"−",color:"#F59E0B"})}}}}
,{id:"wet_rival_spin",weightFn:function(e){var w=RACE_STATE.weather||{};return w.id==="wet"?1.3:0},gen:function(e){if(LIVE_RACE.cur<3)return null;var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});var pPos=p?p.pos:99;var rivals=LIVE_RACE.drivers.filter(function(d){return!d.isPlayer&&!d.dnf&&Math.abs(d.pos-pPos)<=5});if(rivals.length===0)return null;var target=rivals[Math.floor(Math.random()*rivals.length)];return{icon:"wet",title:target.name+" perd l'avant !",desc:target.name+" part en tête-à-queue dans un virage humide.",color:"#F59E0B",ttl:4,effects:function(){target.score=Math.max(.05,target.score-.025);target.penaltySec=(target.penaltySec||0)+2.5;RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:target.name+" en tête-à-queue",choice:"—",note:"−2.5s pour lui",sign:"+",color:"#34D399"})}}}}
,{id:"hot_engine_rival",weightFn:function(e){var w=RACE_STATE.weather||{};return w.id==="hot"&&LIVE_RACE.cur>=5?1.4:0},gen:function(e){var t=LIVE_RACE.drivers.filter(function(d){return!d.isPlayer&&!d.dnf});if(t.length===0)return null;var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});var pPos=p?p.pos:99;var nearby=t.filter(function(d){return Math.abs(d.pos-pPos)<=6&&d.pos<=12});var pool=nearby.length>0?nearby:t.filter(function(d){return d.pos<=10});if(pool.length===0)return null;var target=pool[Math.floor(Math.random()*pool.length)];var dnf=Math.random()<.18;return{icon:"hot",title:target.name+" — moteur en surchauffe",desc:dnf?target.name+" — fumée blanche, abandon !":target.name+" lève le pied à cause de la chaleur moteur.",color:dnf?"#EF4444":"#F59E0B",ttl:5,effects:function(){if(dnf){target.dnf=!0;target.score=0;RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:"Abandon "+target.name,choice:"—",note:"Surchauffe moteur",sign:"+",color:"#34D399"})}else{target.score=Math.max(.05,target.score-.025);RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:target.name+" en gestion",choice:"—",note:"Surchauffe — il ralentit",sign:"+",color:"#34D399"})}}}}}
,{id:"hot_tyre_blistering",weightFn:function(e){var w=RACE_STATE.weather||{};return w.id==="hot"&&LIVE_RACE.cur>=LIVE_RACE.total*.4?1.2:0},gen:function(e){var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});if(!p||p.dnf)return null;var pneus=(G.stats&&G.stats.pneus?G.stats.pneus/100:.5);var bad=Math.random()<(.6-.5*pneus);if(bad){return{icon:"hot",title:"Pneus qui blisterent !",desc:"La chaleur cuit tes pneus — la dégradation explose.",color:"#EF4444",ttl:5,effects:function(){p.score=Math.max(.05,p.score-.025);if(LIVE_RACE.setupImpact)LIVE_RACE.setupImpact.tyreWearMult=(LIVE_RACE.setupImpact.tyreWearMult||1)*1.25;RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:"Pneus surchauffés",choice:"—",note:"−2.5% + dégradation accélérée",sign:"−",color:"#EF4444"})}}}return{icon:"hot",title:"Pneus bien gérés",desc:"Tu gères parfaitement la chaleur dans les pneus.",color:"#34D399",ttl:4,effects:function(){p.score=Math.min(.99,p.score+.01);RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:"Gestion pneus chaud",choice:"—",note:"+1% — gestion exemplaire",sign:"+",color:"#34D399"})}}}}
,{id:"hot_player_fatigue",weightFn:function(e){var w=RACE_STATE.weather||{};return w.id==="hot"&&LIVE_RACE.cur>=LIVE_RACE.total*.55?.9:0},gen:function(e){var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});if(!p||p.dnf)return null;var phys=(G.stats&&G.stats.physique?G.stats.physique/100:.5);var fatigue=Math.random()<(.55-.6*phys);if(fatigue){return{icon:"hot",title:"Tu fatigues — déshydratation",desc:"La chaleur t'écrase, ta concentration baisse.",color:"#EF4444",ttl:5,effects:function(){p.score=Math.max(.05,p.score-.022);if(typeof addPressure==="function")addPressure(3);RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:"Fatigue physique",choice:"—",note:"−2.2% — chaleur intense",sign:"−",color:"#EF4444"})}}}return null}}
,{id:"cloudy_gust",weightFn:function(e){var w=RACE_STATE.weather||{};return w.id==="cloudy"||w.id==="dry"?.7:0},gen:function(e){if(LIVE_RACE.cur<3)return null;var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});if(!p||p.dnf)return null;var sf=(G.substats&&G.substats.sangfroid?G.substats.sangfroid/100:.5);var caught=Math.random()<(.4-.4*sf);return{icon:"cloudy",title:caught?"Rafale en pleine ligne droite !":"Rafale anticipée",desc:caught?"Une bourrasque déstabilise ta voiture — petit écart de trajectoire.":"Tu sens la rafale et corriges proprement la trajectoire.",color:caught?"#F59E0B":"#34D399",ttl:4,effects:function(){if(caught){p.score=Math.max(.05,p.score-.012);RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:"Rafale subie",choice:"—",note:"−1.2%",sign:"−",color:"#F59E0B"})}else{p.score=Math.min(.99,p.score+.006);RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:"Rafale anticipée",choice:"—",note:"+0.6%",sign:"+",color:"#34D399"})}}}}}
,{id:"storm_visibility",weightFn:function(e){var w=RACE_STATE.weather||{};return w.id==="storm"?1.0:0},gen:function(e){if(LIVE_RACE.cur<3)return null;var alive=LIVE_RACE.drivers.filter(function(d){return!d.dnf});if(alive.length<3)return null;return{icon:"storm",title:"Visibilité quasi nulle",desc:"Le brouillard d'eau soulevé par les voitures — tout le monde lève le pied.",color:"#60A5FA",ttl:4,effects:function(){var avg=alive.reduce(function(s,d){return s+d.score},0)/alive.length;alive.forEach(function(d){d.score=.75*d.score+.25*avg});LIVE_RACE._bypassPositionCap=true;RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:"Visibilité réduite",choice:"—",note:"Écarts compressés",sign:"~",color:"#60A5FA"})}}}},{id:"kart_peloton_brawl",weightFn:function(e){var _isKart=G.cat==="Karting Junior"||G.cat==="Karting Senior";if(!_isKart)return 0;if(LIVE_RACE.cur<3)return 0;return 2.5},gen:function(e){var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});if(!p||p.dnf)return null;var rivals=LIVE_RACE.drivers.filter(function(d){if(d.isPlayer||d.dnf)return false;if(Math.abs(d.pos-p.pos)>3)return false;var _gp=45*((d.score||0)-(p.score||0));if(_gp<0)_gp=-_gp;return _gp<=3.5});if(rivals.length<2)return null;return{icon:"",title:"Bagarre dans le peloton",desc:"Plusieurs karts se livrent un combat — les positions s'échangent partout autour de toi !",color:"#FB923C",ttl:5,effects:function(){rivals.forEach(function(r){r.score=Math.min(.95,Math.max(.10,r.score+(Math.random()-.5)*0.06))});p.score=Math.min(.95,Math.max(.10,p.score+(Math.random()-.5)*0.04));RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:"Bagarre dans le peloton",choice:"—",note:"Positions chamboulées",sign:"~",color:"#FB923C"})}}}},{id:"kart_train_slipstream",weightFn:function(e){var _isKart=G.cat==="Karting Junior"||G.cat==="Karting Senior";if(!_isKart)return 0;if(LIVE_RACE.cur<2)return 0;return 1.8},gen:function(e){var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});if(!p||p.dnf)return null;var ahead=LIVE_RACE.drivers.find(function(d){return d.pos===p.pos-1&&!d.dnf});if(!ahead)return null;var _gapAhead=45*((ahead.score||0)-(p.score||0));if(_gapAhead<0)_gapAhead=-_gapAhead;if(_gapAhead>2.5)return null;return{icon:"",title:"Train d'aspiration",desc:"Tu accroches les échappements de "+ahead.name+" — le sillage te tire en avant.",color:"#60A5FA",ttl:4,effects:function(){p.score=Math.min(.99,p.score+0.025);RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:"Aspiration captée",choice:"—",note:"+2.5% — sillage exploité",sign:"+",color:"#60A5FA"})}}}},{id:"kart_corner_battle",weightFn:function(e){var _isKart=G.cat==="Karting Junior"||G.cat==="Karting Senior";if(!_isKart)return 0;if(LIVE_RACE.cur<2)return 0;return 2.2},gen:function(e){var rivals=LIVE_RACE.drivers.filter(function(d){return!d.isPlayer&&!d.dnf});if(rivals.length<2)return null;rivals.sort(function(a,b){return a.pos-b.pos});var idx=Math.floor(Math.random()*(rivals.length-1));var r1=rivals[idx],r2=rivals[idx+1];return{icon:"️",title:"Combat dans un virage",desc:r1.name+" et "+r2.name+" se battent côte-à-côte — l'un d'eux va perdre du temps.",color:"#F59E0B",ttl:4,effects:function(){if(Math.random()<.5){r1.score=Math.max(.10,r1.score-0.025);RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:r1.name+" cède la position",choice:"—",note:r2.name+" passe",sign:"~",color:"#F59E0B"})}else{r2.score=Math.max(.10,r2.score-0.025);RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:r2.name+" cède la position",choice:"—",note:r1.name+" garde sa place",sign:"~",color:"#F59E0B"})}}}}},{id:"vsc_deployed",weightFn:function(e){
  var w=RACE_STATE.weather||{},cd=RACE_STATE.circuitData||{};
  var isF1=G.cat==="Formule 1",isF2=G.cat==="Formule 2",isF3=G.cat==="Formule 3";
  if(!isF1&&!isF2&&!isF3)return 0;
  if(LIVE_RACE.cur<3)return 0;
  return "street"===cd.type?1.5:1.2;
},gen:function(e){
  return{icon:"🟡",title:"Virtual Safety Car",desc:"VSC déployé — tout le monde lève le pied, écarts gelés",color:"#F59E0B",ttl:4,effects:function(){
    var alive=LIVE_RACE.drivers.filter(function(d){return!d.dnf});
    alive.forEach(function(d){d.score=0.82*d.score+0.18*(alive.reduce(function(s,x){return s+x.score},0)/alive.length)});
    LIVE_RACE._bypassPositionCap=true;
    RACE_STATE.eventsLog.push({lap:LIVE_RACE.cur,phase:"Tour "+LIVE_RACE.cur,text:"Virtual Safety Car",choice:"—",note:"Écarts légèrement compressés",sign:"~",color:"#F59E0B"});
  }};
}}
,{id:"player_slow_puncture",weightFn:function(e){
  var cd=RACE_STATE.circuitData||{};
  var p=LIVE_RACE.drivers&&LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  if(!p||p.dnf)return 0;
  if(LIVE_RACE.cur<3||LIVE_RACE.cur>LIVE_RACE.total*0.85)return 0;
  var base="street"===cd.type?1.4:"tech"===cd.type?1.1:0.6;
  return base;
},gen:function(e){
  var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  if(!p||p.dnf)return null;
  return{icon:"⚠",title:"Vibrations suspectes",desc:"Tu sens quelque chose d'anormal à l'avant gauche. Crevaison lente possible.",color:"#F59E0B",ttl:6,effects:function(){
    p.score=Math.max(.05,p.score-.03);
    p.penaltySec=(p.penaltySec||0)+4;
    RACE_STATE.eventsLog.push({lap:LIVE_RACE.cur,phase:"Tour "+LIVE_RACE.cur,text:"Crevaison lente",choice:"—",note:"−3% rythme, +4s",sign:"−",color:"#EF4444"});
  }};
}}
,{id:"player_power_loss",weightFn:function(e){
  var cat=G.cat||"";
  var p=LIVE_RACE.drivers&&LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  if(!p||p.dnf)return 0;
  if(LIVE_RACE.cur<5)return 0;
  var base=["Formule 1","Formule 2","Super Formula","IndyCar"].indexOf(cat)>=0?0.8:
           ["Formule 3","Formula Regional"].indexOf(cat)>=0?0.5:0.2;
  return base*(LIVE_RACE.cur/LIVE_RACE.total>0.6?1.4:1);
},gen:function(e){
  var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  if(!p||p.dnf)return null;
  var severe=Math.random()<0.25;
  return{icon:"⚠",title:severe?"Perte de puissance importante":"Légère perte de puissance",
    desc:severe?"La voiture tire à droite — le moteur souffre. L'ingénieur te demande de lever.":"Tu as quelques chevaux en moins. Rien d'alarmant pour l'instant.",
    color:severe?"#EF4444":"#F59E0B",ttl:5,effects:function(){
    if(severe){p.score=Math.max(.04,p.score-.04);p.penaltySec=(p.penaltySec||0)+6;}
    else{p.score=Math.max(.06,p.score-.018);}
    RACE_STATE.eventsLog.push({lap:LIVE_RACE.cur,phase:"Tour "+LIVE_RACE.cur,text:severe?"Perte de puissance":"Légère perte moteur",choice:"—",note:severe?"−4% rythme, +6s":"−1.8% rythme",sign:"−",color:"#EF4444"});
  }};
}}
,{id:"drs_failure",weightFn:function(e){
  var cat=G.cat||"";
  var isDRS=["Formule 1","Formule 2","Formule 3"].indexOf(cat)>=0;
  if(!isDRS)return 0;
  var p=LIVE_RACE.drivers&&LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  if(!p||p.dnf)return 0;
  if(LIVE_RACE.cur<4)return 0;
  return 0.7;
},gen:function(e){
  var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  if(!p||p.dnf)return null;
  return{icon:"⚠",title:"DRS bloqué",desc:"Ton DRS ne s'ouvre plus. L'ingénieur cherche une solution depuis le stand.",color:"#F59E0B",ttl:5,effects:function(){
    p.score=Math.max(.06,p.score-.022);
    RACE_STATE.eventsLog.push({lap:LIVE_RACE.cur,phase:"Tour "+LIVE_RACE.cur,text:"DRS bloqué",choice:"—",note:"−2.2% rythme en ligne droite",sign:"−",color:"#F59E0B"});
  }};
}}
,{id:"ers_deploy_fail",weightFn:function(e){
  var cat=G.cat||"";
  if(cat!=="Formule 1")return 0;
  var p=LIVE_RACE.drivers&&LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  if(!p||p.dnf)return 0;
  if(LIVE_RACE.cur<3)return 0;
  return 0.6;
},gen:function(e){
  var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  if(!p||p.dnf)return null;
  return{icon:"⚡",title:"ERS en mode récupération forcée",desc:"Ton ingénieur : \"Passe en mode H\" — l'ERS doit se recharger d'urgence. Tu perds de la puissance sur 2-3 tours.",color:"#F59E0B",ttl:6,effects:function(){
    p.score=Math.max(.05,p.score-.025);p.penaltySec=(p.penaltySec||0)+3;
    RACE_STATE.eventsLog.push({lap:LIVE_RACE.cur,phase:"Tour "+LIVE_RACE.cur,text:"ERS — mode récupération",choice:"—",note:"−2.5% rythme, +3s",sign:"−",color:"#F59E0B"});
  }};
}}
,{id:"teammate_battle",weightFn:function(e){
  if(!G.currentTeam||G.currentTeam==="Indépendant")return 0;
  var p=LIVE_RACE.drivers&&LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  if(!p||p.dnf)return 0;
  var tm=LIVE_RACE.drivers&&LIVE_RACE.drivers.find(function(d){return!d.isPlayer&&!d.dnf&&d.team===G.currentTeam});
  if(!tm)return 0;
  var gap=Math.abs(45*((p.score-(p.penaltySec||0)/45)-(tm.score-(tm.penaltySec||0)/45)));
  if(gap>4)return 0;
  if(LIVE_RACE.cur<3)return 0;
  return 1.5;
},gen:function(e){
  var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  var tm=LIVE_RACE.drivers.find(function(d){return!d.isPlayer&&!d.dnf&&d.team===G.currentTeam});
  if(!p||!tm||p.dnf)return null;
  var tmAhead=tm.pos<p.pos;
  return{icon:"🤝",title:"Bataille interne — coéquipier",desc:(tmAhead?tm.name+" est juste devant toi. Même équipe, mais chacun veut le meilleur résultat.":tm.name+" te colle aux roues. La direction sportive observe."),color:"#60A5FA",ttl:5,effects:function(){
    var delta=tmAhead?Math.random()<0.5?0.012:-0.008:Math.random()<0.5?-0.01:0.015;
    if(tmAhead){tm.score=Math.max(.05,tm.score+delta);p.score=Math.max(.05,p.score-delta);}
    else{p.score=Math.min(.99,p.score+Math.abs(delta));tm.score=Math.max(.05,tm.score-Math.abs(delta));}
    RACE_STATE.eventsLog.push({lap:LIVE_RACE.cur,phase:"Tour "+LIVE_RACE.cur,text:"Duel coéquipier "+tm.name,choice:"—",note:delta>0?"Tu prends l'avantage":"Il prend l'avantage",sign:delta>0?"+":"−",color:"#60A5FA"});
  }};
}}
,{id:"track_drying",weightFn:function(e){
  var w=RACE_STATE.weather||{};
  if(w.id!=="wet"&&w.id!=="cloudy")return 0;
  if(LIVE_RACE.cur<4)return 0;
  return 1.0;
},gen:function(e){
  return{icon:"☀",title:"La piste sèche",desc:"La pluie s'est arrêtée. Le bitume commence à sécher — les slicks vont devenir plus performants d'ici 2 tours.",color:"#34D399",ttl:5,effects:function(){
    var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});
    var adapt=(G.substats&&G.substats.adapt?G.substats.adapt/100:0.5);
    if(p&&!p.dnf){p.score=Math.min(.99,p.score+0.02*adapt);}
    RACE_STATE.eventsLog.push({lap:LIVE_RACE.cur,phase:"Tour "+LIVE_RACE.cur,text:"Piste qui sèche",choice:"—",note:"Fenêtre de performance",sign:"+",color:"#34D399"});
  }};
}}
,{id:"wec_night_phase",weightFn:function(e){
  if(typeof _isWECRace!=="function"||!_isWECRace())return 0;
  var nightStart=Math.floor(LIVE_RACE.total*0.35),nightEnd=Math.floor(LIVE_RACE.total*0.65);
  if(LIVE_RACE.cur<nightStart||LIVE_RACE.cur>nightEnd)return 0;
  return 1.8;
},gen:function(e){
  var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  if(!p||p.dnf)return null;
  var phys=(G.stats&&G.stats.physique?G.stats.physique/100:0.5);
  var fatigue=Math.random()<(0.55-0.5*phys);
  return{icon:"🌙",title:fatigue?"Fatigue nocturne":"Phase de nuit — concentration maximale",
    desc:fatigue?"La fatigue te gagne dans la nuit du Mans. Les yeux piquent, les réflexes ralentissent.":"Tu gères bien la nuit. La piste est à toi.",
    color:fatigue?"#EF4444":"#A78BFA",ttl:5,effects:function(){
    if(fatigue){p.score=Math.max(.04,p.score-.02);if(typeof addPressure==="function")addPressure(3);}
    else{p.score=Math.min(.99,p.score+.01);}
    RACE_STATE.eventsLog.push({lap:LIVE_RACE.cur,phase:"Tour "+LIVE_RACE.cur,text:fatigue?"Fatigue nocturne":"Nuit maîtrisée",choice:"—",note:fatigue?"−2% rythme":"+1% concentration",sign:fatigue?"−":"+",color:fatigue?"#EF4444":"#A78BFA"});
  }};
}}
,{id:"indy_oval_draft",weightFn:function(e){
  if(typeof _isOvalRace!=="function"||!_isOvalRace())return 0;
  var p=LIVE_RACE.drivers&&LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  if(!p||p.dnf)return 0;
  var ahead=LIVE_RACE.drivers.find(function(d){return d.pos===p.pos-1&&!d.dnf});
  if(!ahead)return 0;
  return 2.5;
},gen:function(e){
  var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  var ahead=LIVE_RACE.drivers.find(function(d){return d.pos===p.pos-1&&!d.dnf});
  if(!p||!ahead||p.dnf)return null;
  return{icon:"💨",title:"Draft oval",desc:"Tu es dans le sillage de "+ahead.name+" sur l'ovale. L'aspiration est massive — tu peux passer en sortie de virage.",color:"#60A5FA",ttl:4,effects:function(){
    p.score=Math.min(.99,p.score+0.02);
    RACE_STATE.eventsLog.push({lap:LIVE_RACE.cur,phase:"Tour "+LIVE_RACE.cur,text:"Draft exploité — ovale",choice:"—",note:"+2% rythme en aspiration",sign:"+",color:"#60A5FA"});
  }};
}}
,{id:"black_white_flag",weightFn:function(e){
  var p=LIVE_RACE.drivers&&LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  if(!p||p.dnf)return 0;
  if(LIVE_RACE.cur<4)return 0;
  var cat=G.cat||"";
  return ["Formule 1","Formule 2","Formule 3"].indexOf(cat)>=0?0.5:0.3;
},gen:function(e){
  var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  if(!p||p.dnf)return null;
  var rivals=LIVE_RACE.drivers.filter(function(d){return!d.isPlayer&&!d.dnf&&Math.abs(d.pos-p.pos)<=2});
  if(!rivals.length)return null;
  var target=rivals[Math.floor(Math.random()*rivals.length)];
  return{icon:"🏳",title:"Drapeau noir et blanc",desc:"Tu reçois le drapeau noir et blanc — avertissement pour conduite incorrecte sur "+target.name+". Encore un incident et c'est la pénalité.",color:"#9CA3AF",ttl:5,effects:function(){
    p.score=Math.max(.05,p.score-.01);
    RACE_STATE.eventsLog.push({lap:LIVE_RACE.cur,phase:"Tour "+LIVE_RACE.cur,text:"Avertissement — drap. noir/blanc",choice:"—",note:"Léger impact mental",sign:"−",color:"#9CA3AF"});
  }};
}}
,{id:"rival_spin_solo",weightFn:function(e){
  var p=LIVE_RACE.drivers&&LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  if(!p||p.dnf)return 0;
  return 1.2;
},gen:function(e){
  var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  var rivals=LIVE_RACE.drivers.filter(function(d){return!d.isPlayer&&!d.dnf&&Math.abs(d.pos-p.pos)<=3});
  if(!rivals.length)return null;
  var target=rivals[Math.floor(Math.random()*rivals.length)];
  var dnf=Math.random()<0.15;
  return{icon:"🌀",title:dnf?target.name+" — tête à queue fatal !":target.name+" part en tête à queue",desc:dnf?target.name+" finit dans le mur — abandon immédiat.":target.name+" repart mais a perdu plusieurs secondes.",color:dnf?"#EF4444":"#F59E0B",ttl:4,effects:function(){
    if(dnf){target.dnf=true;target.score=0;}
    else{target.score=Math.max(.05,target.score-.04);target.penaltySec=(target.penaltySec||0)+5;}
    RACE_STATE.eventsLog.push({lap:LIVE_RACE.cur,phase:"Tour "+LIVE_RACE.cur,text:dnf?"Abandon "+target.name:"Tête à queue "+target.name,choice:"—",note:dnf?"Une place gagnée":"Rival pénalisé",sign:"+",color:"#34D399"});
  }};
}}
,{id:"depart_incident_t1",weightFn:function(e){
  if(LIVE_RACE.cur!==1)return 0;
  return 3.0;
},gen:function(e){
  var rivals=LIVE_RACE.drivers.filter(function(d){return!d.isPlayer&&!d.dnf});
  if(rivals.length<2)return null;
  var r1=rivals[Math.floor(Math.random()*rivals.length)];
  var r2=rivals.filter(function(d){return d!==r1})[Math.floor(Math.random()*(rivals.length-1))];
  var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  var playerInvolved=p&&Math.random()<0.2;
  return{icon:"💥",title:"Accrochage au virage 1",desc:playerInvolved?"Tu es dans la mêlée au virage 1 — ça pousse de partout !":r1.name+" et "+r2.name+" se touchent dès le premier virage.",color:"#EF4444",ttl:5,effects:function(){
    if(playerInvolved&&p&&!p.dnf){p.score=Math.max(.05,p.score-.025);p.penaltySec=(p.penaltySec||0)+2;}
    r1.score=Math.max(.05,r1.score-.03);r2.score=Math.max(.05,r2.score-.04);
    LIVE_RACE._bypassPositionCap=true;
    RACE_STATE.eventsLog.push({lap:1,phase:"Tour 1",text:playerInvolved?"Accrochage T1 — tu impliqué":"Accrochage T1",choice:"—",note:playerInvolved?"−2.5% + 2s pénalité":"Chaos devant",sign:playerInvolved?"−":"+",color:playerInvolved?"#EF4444":"#34D399"});
  }};
}}
,{id:"rival_push_final",weightFn:function(e){
  var p=LIVE_RACE.drivers&&LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  if(!p||p.dnf)return 0;
  var pct=LIVE_RACE.cur/LIVE_RACE.total;
  if(pct<0.75)return 0;
  var rivals=LIVE_RACE.drivers.filter(function(d){return!d.isPlayer&&!d.dnf&&Math.abs(d.pos-p.pos)<=3});
  if(!rivals.length)return 0;
  return 1.5;
},gen:function(e){
  var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  var rivals=LIVE_RACE.drivers.filter(function(d){return!d.isPlayer&&!d.dnf&&Math.abs(d.pos-p.pos)<=3});
  if(!rivals.length||!p||p.dnf)return null;
  var target=rivals[Math.floor(Math.random()*rivals.length)];
  var isAhead=target.pos<p.pos;
  return{icon:"🔥",title:target.name+" pousse à fond",desc:target.name+(isAhead?" lâche tout pour tenir sa position — il est en mode attaque finale.":" arrive en trombe — il a trouvé du rythme en fin de course."),color:"#F97316",ttl:5,effects:function(){
    target.score=Math.min(.99,target.score+0.02);
    RACE_STATE.eventsLog.push({lap:LIVE_RACE.cur,phase:"Tour "+LIVE_RACE.cur,text:target.name+" — push final",choice:"—",note:isAhead?"Il se détache légèrement":"Il revient sur toi",sign:"−",color:"#F97316"});
  }};
}}
,{id:"kart_mechanical_issue",weightFn:function(e){
  var isKart=G.cat==="Karting Junior"||G.cat==="Karting Senior";
  if(!isKart)return 0;
  var p=LIVE_RACE.drivers&&LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  if(!p||p.dnf)return 0;
  if(LIVE_RACE.cur<3)return 0;
  return 0.8;
},gen:function(e){
  var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  if(!p||p.dnf)return null;
  var types=["La chaîne saute d'un cran","Le carbu calche sur une montée","Tu ressens des à-coups moteur dans les courbes rapides"];
  var desc=types[Math.floor(Math.random()*types.length)];
  return{icon:"🔧",title:"Problème mécanique — kart",desc:desc+". Tu perds du rythme pendant quelques tours.",color:"#F59E0B",ttl:5,effects:function(){
    p.score=Math.max(.05,p.score-.025);p.penaltySec=(p.penaltySec||0)+3;
    RACE_STATE.eventsLog.push({lap:LIVE_RACE.cur,phase:"Tour "+LIVE_RACE.cur,text:"Problème mécanique kart",choice:"—",note:"−2.5% + 3s",sign:"−",color:"#F59E0B"});
  }};
}}
];function buildRaceCtx(){if(!LIVE_RACE||!LIVE_RACE.drivers)return null;var e=LIVE_RACE.drivers.find(function(e){return e.isPlayer});if(!e||e.dnf)return null;var t=LIVE_RACE.drivers.slice().filter(function(e){return!e.dnf}).sort(function(e,t){return(e.pos||99)-(t.pos||99)}),r=t.findIndex(function(e){return e.isPlayer}),n=r>0?t[r-1]:null,a=r<t.length-1?t[r+1]:null,i=t.length>0?t[0]:null,o=LIVE_RACE.total>0?LIVE_RACE.cur/LIVE_RACE.total:0,s;s=LIVE_RACE.cur<=1?"depart":o<.3?"early":o<.65?"mid":o<.88?"late":"final";var l=RACE_STATE.weather||{};var pScore=e.score-(e.penaltySec||0)/45;var gapAhead=n?Math.max(0,parseFloat((45*((n.score-(n.penaltySec||0)/45)-pScore)).toFixed(1))):null;var gapBehind=a?Math.max(0,parseFloat((45*(pScore-(a.score-(a.penaltySec||0)/45))).toFixed(1))):null;var gapLeader=i&&!i.isPlayer?Math.max(0,parseFloat((45*((i.score-(i.penaltySec||0)/45)-pScore)).toFixed(1))):0;return{player:e,playerPos:e.pos,ahead:n,behind:a,leader:i,gapAhead:gapAhead,gapBehind:gapBehind,gapLeader:gapLeader,lap:LIVE_RACE.cur,totalLaps:LIVE_RACE.total,lapPct:o,phase:s,weather:l,isWet:"wet"===l.id||"storm"===l.id,isHot:"hot"===l.id,circuitData:RACE_STATE.circuitData||{},circuitName:RACE_STATE.circuit||"",isRival:function(e){return!(!e||!G._rivalries)&&G._rivalries.some(function(t){return t.name===e.name})}}}function _getEffectiveSkillFor(e){var t=G.substats||{},r=G.pilot&&G.pilot.style?G.pilot.style:"complet",n=50;if("attaque"===e)n=.4*(t.vitesse_pure||50)+.3*(t.reactivite||50)+.3*(t.decision||50),"attaquant"===r&&(n+=6),"regulier"===r&&(n-=4);else if("defense"===e)n=.35*(t.concentration||50)+.3*(t.grip||50)+.35*(t.pression||50),"regulier"===r&&(n+=5),"stratege"===r&&(n+=3),"attaquant"===r&&(n-=3);else if("gestion"===e)n=.5*(t.gestion_pneus||50)+.3*(t.decision||50)+.2*(t.concentration||50),"stratege"===r&&(n+=7),"technicien"===r&&(n+=4),"attaquant"===r&&(n-=4);else if("adaptation"===e)n=.35*(t.reactivite||50)+.35*(t.decision||50)+.3*(t.pression||50),"pluvial"===r&&(n+=6),"polyvalent"===r&&(n+=4),"technicien"===r&&(n+=3);else{var a=0,i=0;Object.keys(t).forEach(function(e){"number"==typeof t[e]&&(a+=t[e],i++)}),n=i>0?a/i:50}return Math.max(20,Math.min(95,n))}function _getContextualRiskDelta(){var e=0;if(LIVE_RACE){var t=LIVE_RACE.total>0?LIVE_RACE.cur/LIVE_RACE.total:0;t>.85?e-=8:t>.65?e-=3:t<.15&&(e-=5)}if(RACE_STATE&&RACE_STATE.weather){var r=RACE_STATE.weather.id;"wet"===r&&(e-=6),"storm"===r&&(e-=12),"damp"===r&&(e-=3),"hot"===r&&(e-=1)}if(RACE_STATE&&RACE_STATE.circuitData){var n=RACE_STATE.circuitData.type;"street"===n&&(e-=5),"flowing"===n&&(e+=2),"tech"===n&&(e-=2)}var pressure=G._pressureLevel||0;if(pressure>50)e-=Math.min(8,(pressure-50)*0.15);var rep=G.reputation||0;if(rep<25)e-=2;else if(rep>80)e+=2;
// Mental du pilote — impact sur la prise de risque
if(typeof PILOT_MENTAL!=="undefined"&&PILOT_MENTAL&&typeof PILOT_MENTAL.value==="number"){
 var _mental=PILOT_MENTAL.value;
 if(_mental>=80)e+=4;       // Conquérant — confiant, prend les risques
 else if(_mental>=65)e+=2;  // Confiant — légèrement favorisé
 else if(_mental>=45){}     // Neutre — aucun effet
 else if(_mental>=30)e-=3;  // Doute — moins précis
 else if(_mental>=15)e-=6;  // Sous pression — erreurs probables
 else e-=10;                // Brisé — très pénalisé
}
return LIVE_RACE&&LIVE_RACE.cur>.7*LIVE_RACE.total&&(e-=3),e}
/* === EVENTS V2 — Difficulté contextuelle (modérée) ===
   Calcule un "delta contextuel" supplémentaire qui s'ajoute au delta général.
   Prend en compte :
   - actionType × météo (attaque sous pluie pénalisée, gestion sous pluie OK, adaptation sous pluie bonifiée)
   - actionType × type de circuit (attaque urbain pénalisée, gestion urbain neutre)
   - placement du joueur (P1 = pression défense ; P-last = rien à perdre en attaque)
   - force du rival concerné (skill élevé = +difficulté en attaque/défense face à lui)
   Toutes les valeurs sont volontairement modérées (±2 à ±5) pour que la lisibilité reste stable.
   Retourne un nombre à ajouter au "delta" interne du calcul d'outcomes. */
function _getActionContextDelta(actionType,actionCtx){
 var d=0;
 if(!actionType)return d;
 var w=(RACE_STATE&&RACE_STATE.weather)||{};
 var ct=(RACE_STATE&&RACE_STATE.circuitData)||{};
 // Météo × action
 if(w.id==="wet"||w.id==="storm"){
  if(actionType==="attaque")d-=4;
  else if(actionType==="defense")d-=2;
  else if(actionType==="adaptation")d+=3; // adapt s'épanouit sous la pluie
  // gestion : neutre
 }else if(w.id==="damp"){
  if(actionType==="attaque")d-=2;
  else if(actionType==="adaptation")d+=2;
 }else if(w.id==="hot"){
  if(actionType==="gestion")d+=2; // gestion thermique aide
 }
 // Circuit × action — enrichi avec nouvelles propriétés
 var _st=ct.streetWalls||2;  // proximité murs
 var _ot=ct.overtakeQ||5;    // qualité dépassement
 var _nl=ct.neckLoad||5;     // charge nuque
 var _bk=ct.braking||5;      // intensité freinage
 var _alt=ct.altitude||0;    // altitude
 if(ct.type==="street"){
  if(actionType==="attaque")d-=(3+Math.round(_st/3));  // plus les murs sont proches, plus c'est risqué
  else if(actionType==="gestion")d+=2;
  else if(actionType==="defense")d+=1;
 }else if(ct.type==="highspeed"){
  if(actionType==="attaque")d+=2;
  else if(actionType==="defense")d-=1;
 }else if(ct.type==="technical"){
  if(actionType==="defense")d+=2;
  if(actionType==="gestion")d+=1;
 }
 // Peu d'opportunités de dépassement → attaque plus difficile
 if(_ot<=2&&actionType==="attaque")d-=3;
 else if(_ot>=8&&actionType==="attaque")d+=2;
 // Freinage intense → attaque exige précision
 if(_bk>=9&&actionType==="attaque")d-=2;
 // Haute altitude → moteur fragile, gestion favorisée
 if(_alt>=15&&actionType==="gestion")d+=3;
 if(_alt>=15&&actionType==="attaque")d-=2;

 // Position du joueur
 if(actionCtx&&typeof actionCtx.playerPos==="number"){
  var pos=actionCtx.playerPos;
  var totalDrivers=(LIVE_RACE&&LIVE_RACE.drivers&&LIVE_RACE.drivers.length)||20;
  if(pos===1){
   // P1 défense = pression mentale forte
   if(actionType==="defense")d-=2;
  }else if(pos>=Math.ceil(totalDrivers*0.7)){
   // queue de peloton = rien à perdre
   if(actionType==="attaque")d+=2;
  }
 }
 // Force du rival concerné (échelle 50-99 brute, depuis G.rivals[i].skill)
 if(actionCtx&&typeof actionCtx.rivalSkill==="number"){
  var rivalSkill=actionCtx.rivalSkill;
  // 50=neutre rookie, 75=solide, 90=élite, 99=Verstappen
  var rivalDelta=(rivalSkill-65)/5; // ~-3 à +7
  if(actionType==="attaque"||actionType==="defense"){
   d-=Math.max(0,Math.min(5,rivalDelta)); // attaquer/défendre vs rival fort = plus dur
  }
 }
 // Cap final pour rester dans le modéré
 return Math.max(-8,Math.min(8,d));
}
function _computeChoiceOutcomes(e,t,actionCtx){
 var skill=_getEffectiveSkillFor(t);
 var ctx=_getContextualRiskDelta();
 // Extraire la contribution mentale pour l'affichage
 var _mentalDelta=0;
 if(typeof PILOT_MENTAL!=="undefined"&&PILOT_MENTAL&&typeof PILOT_MENTAL.value==="number"){
  var _mv=PILOT_MENTAL.value;
  _mentalDelta=_mv>=80?4:_mv>=65?2:_mv>=45?0:_mv>=30?-3:_mv>=15?-6:-10;
 }
 var actionCtxDelta=_getActionContextDelta(t,actionCtx);
 var d=Math.max(-25,Math.min(30,(skill-45)/2+ctx+actionCtxDelta));
 var brillant=Math.max(2,8-6*e+1.5*d);
 var succes=Math.max(8,45-12*e+.4*d);
 var neutre=Math.max(5,18+4*e-.2*d);
 var rateMin=Math.max(3,14+12*e-.6*d);
 var rateMaj=Math.max(.5,6+8*e-.5*d);
 // Plus de bruit aléatoire ici : la valeur affichée doit rester stable.
 // Le réalisme est assuré par le _rollChoiceOutcome (qui tire aléatoirement le résultat).
 var sum=brillant+succes+neutre+rateMin+rateMaj;
 return{
  brillant:brillant/sum,
  succes:succes/sum,
  neutre:neutre/sum,
  rateMin:rateMin/sum,
  rateMaj:rateMaj/sum,
  // Méta pour debug et UI
  _meta:{skill:Math.round(skill),ctxDelta:Math.round(ctx),actionDelta:Math.round(actionCtxDelta),totalDelta:Math.round(d),mentalDelta:Math.round(_mentalDelta)}
 };
}function _rollChoiceOutcome(e){var t=Math.random(),r=0,n=["brillant","succes","neutre","rateMin","rateMaj"],a,result="succes";for(a=0;a<n.length;a++)if(t<=(r+=e[n[a]])){result=n[a];break}if(Math.random()<0.06){var idx=n.indexOf(result),swing=Math.random()<0.5?-1:1,newIdx=idx+swing;if(newIdx>=0&&newIdx<n.length)result=n[newIdx]}return result}function _describeChoiceRisk(e){var t=e.brillant+e.succes,r=e.rateMin+e.rateMaj;return t>.75?{label:"Favorable",color:"#34D399",stars:""}:t>.6?{label:"Plutôt bon",color:"#60A5FA",stars:""}:t>.45?{label:"Incertain",color:"#F59E0B",stars:""}:{label:"Risqué",color:"#EF4444",stars:""}}var CHOICE_RACE_EVENTS=[{id:"overtake_opp",weightFn:function(e){if(!e.ahead)return 0;if("depart"===e.phase)return 0;var gap=e.gapAhead;if(gap===null)return 0;var _isKartCat=G.cat==="Karting Junior"||G.cat==="Karting Senior";var _maxGap=_isKartCat?2.5:1.5;if(gap>_maxGap)return 0;var distMul=gap<.5?1:gap<1?.7:gap<1.5?.4:.25;var phaseW="mid"===e.phase?2.5:"late"===e.phase?3:1;var kartBonus=_isKartCat?1.6:1;return phaseW*distMul*kartBonus},gen:function(e){var t=e.isRival(e.ahead)?" (ton rival)":"";var gapStr=e.gapAhead!==null?" — écart "+e.gapAhead.toFixed(1)+"s":"";return{phase:e.phase,lap:e.lap/e.totalLaps,title:"Opportunité de dépassement",text:function(){return"Tu es dans les échappements de <strong>"+e.ahead.name+"</strong>"+t+gapStr+". Zone de dépassement qui arrive. Qu'est-ce que tu fais ?"},choices:[{text:"Tenter l'attaque à l'intérieur",mods:{player:.04},difficulty:.55,actionType:"attaque",successMod:.04,brilliantMod:.065,rateMinMod:-.02,rateMajMod:-.055,paceModOnRateMaj:{deltaSec:0.6,laps:4,reason:"Sortie large après attaque ratée"},note:"Dépassement tenté"},{text:"Attendre une meilleure occasion",mods:{player:.01},difficulty:.15,actionType:"gestion",successMod:.01,brilliantMod:.02,rateMinMod:-.005,rateMajMod:-.015,note:"Patience stratégique"},{text:"Préserver les pneus pour plus tard",mods:{player:-.005},difficulty:.05,actionType:"gestion",successMod:-.005,brilliantMod:.005,rateMinMod:-.01,rateMajMod:-.02,note:"Tu gardes de la gomme"}]}}},{id:"defend_behind",weightFn:function(e){if(!e.behind)return 0;var gap=e.gapBehind;if(gap===null)return 0;var _isKartCat=G.cat==="Karting Junior"||G.cat==="Karting Senior";var _maxGap=_isKartCat?2.5:1.5;if(gap>_maxGap)return 0;var distMul=gap<.5?1:gap<1?.7:gap<1.5?.4:.25;var phaseW="depart"===e.phase||"early"===e.phase?.5:"mid"===e.phase?2:3;var kartBonus=_isKartCat?1.6:1;return phaseW*distMul*kartBonus},gen:function(e){var t=e.isRival(e.behind)?" (ton rival)":"";var gapStr=e.gapBehind!==null?" — écart "+e.gapBehind.toFixed(1)+"s":"";return{phase:e.phase,lap:e.lap/e.totalLaps,title:"Sous pression",text:function(){return"<strong>"+e.behind.name+"</strong>"+t+" revient fort dans tes rétros"+gapStr+". Il prépare l'attaque."},choices:[{text:"Défendre agressivement la ligne",mods:{player:.025},difficulty:.45,actionType:"defense",successMod:.025,brilliantMod:.045,rateMinMod:-.015,rateMajMod:-.04,posLossOnRateMaj:1,paceModOnRateMaj:{deltaSec:0.5,laps:3,reason:"Défense ratée — tu perds le rythme"},note:"Défense active"},{text:"Défense propre et calme",mods:{player:.01},difficulty:.2,actionType:"defense",successMod:.01,brilliantMod:.025,rateMinMod:-.005,rateMajMod:-.015,note:"Tu tiens ta position proprement"},{text:"Laisser passer pour préserver la voiture",mods:{player:-.03},difficulty:.05,actionType:"gestion",successMod:-.03,brilliantMod:-.02,rateMinMod:-.035,rateMajMod:-.04,posLoss:1,note:"Perte de position mais économie"}]}}},{id:"duel_leader",weightFn:function(e){if(2!==e.playerPos)return 0;if("depart"===e.phase||"early"===e.phase)return 0;var gap=e.gapAhead;if(gap===null||gap>2)return 0;var distMul=gap<.6?1:gap<1.2?.7:.4;return 3*distMul},gen:function(e){var gapStr=e.gapAhead!==null?" ("+e.gapAhead.toFixed(1)+"s)":"";return{phase:e.phase,lap:e.lap/e.totalLaps,title:"Duel pour la victoire",text:function(){return"Tu es à quelques dixièmes de <strong>"+e.leader.name+"</strong>"+gapStr+". La victoire se joue maintenant. Quelle stratégie ?"},choices:[{text:"Attaquer à fond, prendre tous les risques",mods:{player:.06},difficulty:.7,actionType:"attaque",successMod:.06,brilliantMod:.09,rateMinMod:-.03,rateMajMod:-.08,posGainOnBrillant:1,posLossOnRateMaj:2,paceModOnRateMaj:{deltaSec:0.8,laps:5,reason:"Sortie de piste — attaque va-tout ratée"},note:"Stratégie va-tout"},{text:"Mettre la pression et attendre une erreur",mods:{player:.025},difficulty:.35,actionType:"attaque",successMod:.025,brilliantMod:.045,rateMinMod:-.015,rateMajMod:-.03,note:"Pression patiente"},{text:"Sécuriser la P2",mods:{player:-.01},difficulty:.1,actionType:"gestion",successMod:-.01,brilliantMod:0,rateMinMod:-.02,rateMajMod:-.025,note:"Tu assures le podium"}]}}},{id:"team_orders",weightFn:function(e){var aheadTeammate=e.ahead&&e.ahead.team===G.currentTeam&&"Indépendant"!==G.currentTeam;var behindTeammate=e.behind&&e.behind.team===G.currentTeam&&"Indépendant"!==G.currentTeam;if(!aheadTeammate&&!behindTeammate)return 0;if(aheadTeammate&&e.gapAhead!==null&&e.gapAhead>2)return 0;if(behindTeammate&&e.gapBehind!==null&&e.gapBehind>2)return 0;return"late"===e.phase||"final"===e.phase?2.5:.8},gen:function(e){var t=e.ahead&&e.ahead.team===G.currentTeam?e.ahead:e.behind,r=t===e.ahead;var gapStr=r&&e.gapAhead!==null?" ("+e.gapAhead.toFixed(1)+"s)":!r&&e.gapBehind!==null?" ("+e.gapBehind.toFixed(1)+"s)":"";return{phase:e.phase,lap:e.lap/e.totalLaps,title:"Consigne écurie",text:function(){return r?"Ton ingénieur te dit à la radio : <strong>"+t.name+"</strong>"+gapStr+" est ton coéquipier. L'écurie te demande de ne pas l'attaquer.":"Ton ingénieur te dit à la radio : <strong>"+t.name+"</strong>"+gapStr+" est ton coéquipier. L'écurie te demande de le laisser passer."},choices:[{text:"Respecter la consigne",mods:{player:r?-.01:-.03},note:"Loyauté écurie",trustDelta:5},{text:"Ignorer — chacun pour soi",mods:{player:r?.02:.015},note:"Tu fais ta course",trustDelta:-8}]}}},{id:"yellow_flag_restart",weightFn:function(e){if(!LIVE_RACE._passiveHistory)return 0;var t=LIVE_RACE._passiveHistory.safety_car;return"number"!=typeof t||LIVE_RACE.cur-t>3?0:3},gen:function(e){return{phase:e.phase,lap:e.lap/e.totalLaps,title:"Relance après Safety Car",text:function(){return"La SC rentre au stand. La course reprend. "+(e.ahead?"Tu es derrière <strong>"+e.ahead.name+"</strong>.":"Tu es en tête.")+" Comment tu joues le restart ?"},choices:[{text:"Attaquer dès l'extinction des lumières",mods:{player:.04},difficulty:.5,actionType:"attaque",successMod:.04,brilliantMod:.065,rateMinMod:-.02,rateMajMod:-.055,note:"Départ canon"},{text:"Relance propre et contrôlée",mods:{player:.01},difficulty:.2,actionType:"adaptation",successMod:.01,brilliantMod:.02,rateMinMod:-.005,rateMajMod:-.015,note:"Conservateur"},{text:"Temporiser pour laisser les voitures devant se battre",mods:{player:.005},difficulty:.15,actionType:"gestion",successMod:.005,brilliantMod:.015,rateMinMod:-.005,rateMajMod:-.01,note:"Tu observes"}]}}},{id:"tyre_dilemma",weightFn:function(e){return"late"===e.phase?2:"final"===e.phase?2.5:0},gen:function(e){return{phase:e.phase,lap:e.lap/e.totalLaps,title:"Pneus en fin de vie",text:function(){var t;return(e.ahead?"Tu as <strong>"+e.ahead.name+"</strong> en vue devant":"Tu es devant")+". Tes pneus commencent à sérieusement lâcher."},choices:[{text:"Serrer les dents et pousser",mods:{player:.02},difficulty:.65,actionType:"gestion",successMod:.02,brilliantMod:.04,rateMinMod:-.015,rateMajMod:-.05,paceModOnBrillant:{deltaSec:-0.3,laps:3,reason:"Tu trouves un rythme malgré l'usure"},paceModOnRateMaj:{deltaSec:1.0,laps:6,reason:"Pneus morts — tu n'as plus de grip"},tyreDamageOnRateMaj:{laps:5,severity:"major"},note:"Risque sur pneus usés"},{text:"Gérer et rouler au rythme",mods:{player:.005},difficulty:.15,actionType:"gestion",successMod:.005,brilliantMod:.015,rateMinMod:-.005,rateMajMod:-.01,paceModOnBrillant:{deltaSec:-0.25,laps:4,reason:"Gestion impeccable — pneus encore vivants"},note:"Pneus préservés"}]}}},{id:"rain_drops",weightFn:function(e){return e.isWet||((e.circuitData||{}).rain||0)<.25?0:"mid"===e.phase||"late"===e.phase?1.5:0;var t,r},gen:function(e){return{phase:e.phase,lap:e.lap/e.totalLaps,title:"Gouttes sur le pare-brise",text:function(){return"Quelques gouttes sur le pare-brise. La pluie peut arriver d'ici 2-3 tours. Le peloton hésite. Tu fais quoi ?"},choices:[{text:"Rentrer au stand tout de suite pour les pneus pluie",mods:{player:-.02},difficulty:.55,actionType:"adaptation",successMod:.05,brilliantMod:.09,rateMinMod:-.04,rateMajMod:-.08,paceModOnBrillant:{deltaSec:-0.5,laps:8,reason:"Pneus pluie parfaits — tu domines"},paceModOnRateMaj:{deltaSec:0.6,laps:5,reason:"Pneus pluie sur sec — abrasion et perte de pace"},note:"Pari tôt — gros gain si la pluie vient",_doPit:true},{text:"Attendre 1-2 tours pour confirmer",mods:{player:.005},difficulty:.25,actionType:"adaptation",successMod:.005,brilliantMod:.025,rateMinMod:-.005,rateMajMod:-.015,note:"Attentiste raisonnable"},{text:"Rester en slicks — ça peut passer",mods:{player:.015},difficulty:.6,actionType:"gestion",successMod:.015,brilliantMod:.045,rateMinMod:-.02,rateMajMod:-.06,paceModOnBrillant:{deltaSec:-0.4,laps:5,reason:"Pari gagnant — piste reste sèche"},paceModOnRateMaj:{deltaSec:1.5,laps:4,reason:"Slicks sur piste mouillée — adhérence catastrophique"},posLossOnRateMaj:1,note:"Risqué mais potentiellement payant"}]}}},{id:"rival_aggressive",weightFn:function(e){if(!G._rivalries||0===G._rivalries.length)return 0;var aheadIsRival=e.ahead&&e.isRival(e.ahead);var behindIsRival=e.behind&&e.isRival(e.behind);if(!aheadIsRival&&!behindIsRival)return 0;if(aheadIsRival&&e.gapAhead!==null&&e.gapAhead>1.8)aheadIsRival=false;if(behindIsRival&&e.gapBehind!==null&&e.gapBehind>1.8)behindIsRival=false;if(!aheadIsRival&&!behindIsRival)return 0;return 2.5},gen:function(e){var aheadIsRival=e.ahead&&e.isRival(e.ahead)&&(e.gapAhead===null||e.gapAhead<=1.8);var t=aheadIsRival?e.ahead:e.behind,r=t===e.ahead;var gapStr=r&&e.gapAhead!==null?" ("+e.gapAhead.toFixed(1)+"s)":!r&&e.gapBehind!==null?" ("+e.gapBehind.toFixed(1)+"s)":"";return{phase:e.phase,lap:e.lap/e.totalLaps,title:"Ton rival te défie",text:function(){return r?"<strong>"+t.name+"</strong>"+gapStr+", ton rival, ferme les portes agressivement. Il veut te mettre la pression.":"<strong>"+t.name+"</strong>"+gapStr+", ton rival, te colle au pare-chocs. Ce duel a une histoire."},choices:[{text:"Lui rendre la monnaie, duel sans pitié",mods:{player:.03},difficulty:.6,actionType:r?"attaque":"defense",successMod:.03,brilliantMod:.055,rateMinMod:-.02,rateMajMod:-.05,paceModOnRateMaj:{deltaSec:0.9,laps:5,reason:"Contact avec le rival — ailerons abîmés"},note:"Rivalité intensifiée",rivalryDelta:12},{text:"Rester propre, ne pas tomber dans le piège",mods:{player:.01},difficulty:.2,actionType:r?"gestion":"defense",successMod:.01,brilliantMod:.025,rateMinMod:-.005,rateMajMod:-.015,note:"Maturité"}]}}},{id:"kart_slipstream",weightFn:function(e){var _isKart=G.cat==="Karting Junior"||G.cat==="Karting Senior";if(!_isKart)return 0;if(!e.ahead)return 0;var gap=e.gapAhead;if(gap===null||gap>3)return 0;return e.phase==="early"||e.phase==="mid"?2.5:1.5},gen:function(e){var t=e.gapAhead!==null?" ("+e.gapAhead.toFixed(1)+"s)":"";return{phase:e.phase,lap:e.lap/e.totalLaps,title:"Aspiration en ligne droite",text:function(){return"Tu colles à <strong>"+e.ahead.name+"</strong>"+t+" dans la ligne droite. L'aspiration est énorme — moment idéal pour sortir du sillage."},choices:[{text:"Sortir au dernier moment et plonger à l'intérieur",mods:{player:.05},difficulty:.5,actionType:"attaque",successMod:.05,brilliantMod:.08,rateMinMod:-.025,rateMajMod:-.05,posGainOnBrillant:1,note:"Aspiration parfaitement exploitée"},{text:"Rester dans l'aspiration, attendre la prochaine ligne droite",mods:{player:.015},difficulty:.15,actionType:"gestion",successMod:.015,brilliantMod:.03,rateMinMod:-.005,rateMajMod:-.015,note:"Tu mémorises sa trajectoire"},{text:"Tenter un passage sur l'extérieur",mods:{player:.025},difficulty:.65,actionType:"attaque",successMod:.025,brilliantMod:.07,rateMinMod:-.04,rateMajMod:-.07,posLossOnRateMaj:1,note:"Ligne audacieuse"}]}}},{id:"kart_braking_duel",weightFn:function(e){var _isKart=G.cat==="Karting Junior"||G.cat==="Karting Senior";if(!_isKart)return 0;if(!e.ahead)return 0;var gap=e.gapAhead;if(gap===null||gap>2)return 0;if(e.phase==="depart")return 0;return 2},gen:function(e){var t=e.gapAhead!==null?" — "+e.gapAhead.toFixed(1)+"s":"";return{phase:e.phase,lap:e.lap/e.totalLaps,title:"Duel au freinage",text:function(){return"<strong>"+e.ahead.name+"</strong>"+t+". Tu arrives sur sa boîte au freinage. En karting, c'est zone de combat — c'est maintenant ou jamais."},choices:[{text:"Freinage tardif à l'intérieur",mods:{player:.045},difficulty:.55,actionType:"attaque",successMod:.045,brilliantMod:.07,rateMinMod:-.03,rateMajMod:-.06,posGainOnBrillant:1,posLossOnRateMaj:1,paceModOnRateMaj:{deltaSec:0.5,laps:3,reason:"Long freinage — sortie large"},note:"Tu plonges à la corde"},{text:"Le bluffer en feignant l'attaque",mods:{player:.02},difficulty:.35,actionType:"attaque",successMod:.02,brilliantMod:.045,rateMinMod:-.015,rateMajMod:-.04,note:"Il s'est fait piéger"},{text:"Garder le rythme — attendre la sortie",mods:{player:.005},difficulty:.1,actionType:"gestion",successMod:.005,brilliantMod:.015,rateMinMod:-.005,rateMajMod:-.01,note:"Patience"}]}}},{id:"kart_chicane_attack",weightFn:function(e){var _isKart=G.cat==="Karting Junior"||G.cat==="Karting Senior";if(!_isKart)return 0;if(!e.ahead&&!e.behind)return 0;var pAhead=e.ahead&&e.gapAhead!==null&&e.gapAhead<2;var pBehind=e.behind&&e.gapBehind!==null&&e.gapBehind<1.5;if(!pAhead&&!pBehind)return 0;return 2},gen:function(e){var attacker=e.ahead&&e.gapAhead!==null&&e.gapAhead<2;var t=attacker?e.ahead:e.behind;var role=attacker?"attaque":"défense";var gapStr=attacker?(e.gapAhead!==null?" ("+e.gapAhead.toFixed(1)+"s devant)":""):(e.gapBehind!==null?" ("+e.gapBehind.toFixed(1)+"s derrière)":"");return{phase:e.phase,lap:e.lap/e.totalLaps,title:attacker?"Attaque dans la chicane":"Sous attaque en chicane",text:function(){return attacker?"La chicane arrive. <strong>"+t.name+"</strong>"+gapStr+" prend une trajectoire conservatrice — tu peux passer par l'extérieur si tu oses.":"<strong>"+t.name+"</strong>"+gapStr+" cherche le contact en chicane. Karting style — il essaie de te faire faute."},choices:attacker?[{text:"Trajectoire extérieur — sortie ouverte",mods:{player:.04},difficulty:.5,actionType:"attaque",successMod:.04,brilliantMod:.075,rateMinMod:-.025,rateMajMod:-.05,note:"Belle audace"},{text:"Le forcer à élargir — bumper-to-bumper",mods:{player:.025},difficulty:.6,actionType:"attaque",successMod:.025,brilliantMod:.05,rateMinMod:-.04,rateMajMod:-.07,note:"Style karting agressif"},{text:"Trajectoire prudente — le suivre",mods:{player:.005},difficulty:.1,actionType:"gestion",successMod:.005,brilliantMod:.015,rateMinMod:-.005,rateMajMod:-.012,note:"Sécurité"}]:[{text:"Fermer la porte fort à l'entrée",mods:{player:.025},difficulty:.5,actionType:"defense",successMod:.025,brilliantMod:.045,rateMinMod:-.02,rateMajMod:-.045,note:"Défense karting classique"},{text:"Trajectoire idéale — il ne passera pas",mods:{player:.015},difficulty:.3,actionType:"defense",successMod:.015,brilliantMod:.03,rateMinMod:-.012,rateMajMod:-.03,note:"Précision en chicane"},{text:"Le laisser passer — éviter le contact",mods:{player:-.02},difficulty:.05,actionType:"gestion",successMod:-.02,brilliantMod:-.01,rateMinMod:-.025,rateMajMod:-.03,note:"Tu cèdes proprement"}]}}},{id:"undercut_window",weightFn:function(e){
  if(typeof _pitEnabledForCurrentRace!=="function"||!_pitEnabledForCurrentRace())return 0;
  var cfg=typeof _pitConfigForCat==="function"?_pitConfigForCat():null;
  if(!cfg||!cfg.enabled)return 0;
  var p=LIVE_RACE.drivers&&LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  if(!p||p.dnf)return 0;
  var pct=LIVE_RACE.cur/LIVE_RACE.total;
  if(pct<0.25||pct>0.65)return 0;
  if((p._pitsDone||0)>=(cfg.maxStops||1))return 0;
  if(!e.ahead)return 0;
  var gap=e.gapAhead;
  if(gap===null||gap>5)return 0;
  return "mid"===e.phase?2.5:"late"===e.phase?2:1;
},gen:function(e){
  var ahead=e.ahead;
  var gapStr=e.gapAhead!==null?" ("+e.gapAhead.toFixed(1)+"s)":"";
  return{phase:e.phase,lap:e.lap/e.totalLaps,title:"Fenêtre d'undercut",text:function(){var _stratD=(typeof _getRivalStratData==="function")?_getRivalStratData():[];var _rd=_stratD.find(function(r){return r.ahead&&r.pitRecent});var _lifeStr=_rd&&_rd.life!==null?" ("+Math.round(_rd.life)+"% vie restante avant pit)":"";return"<strong>"+ahead.name+"</strong>"+gapStr+" vient de rentrer au stand. Il ressort avec des pneus neufs. Si tu restes en piste encore 2 tours, tu peux l'undercutter — mais sa pace va exploser sur ses pneus frais"+_lifeStr+". Décision ?"},
  choices:[
    {text:"Rentrer maintenant — undercut immédiat",mods:{player:.04},difficulty:.5,actionType:"gestion",successMod:.04,brilliantMod:.065,rateMinMod:-.02,rateMajMod:-.045,note:"Undercut tenté",_doPit:true},
    {text:"Attendre 2 tours pour rester en piste",mods:{player:.015},difficulty:.3,actionType:"gestion",successMod:.015,brilliantMod:.03,rateMinMod:-.01,rateMajMod:-.025,note:"Tu gardes le track position"},
    {text:"Ignorer — rester le plus longtemps possible",mods:{player:-.005},difficulty:.1,actionType:"gestion",successMod:-.005,brilliantMod:.01,rateMinMod:-.015,rateMajMod:-.03,note:"Stratégie longue stint"}
  ]};
}}
,{id:"fuel_management",weightFn:function(e){
  var cat=G.cat||"";
  var highFuelCats=["Formule 1","Formule 2","Super Formula","IndyCar","Endurance WEC"];
  if(highFuelCats.indexOf(cat)<0)return 0;
  var pct=LIVE_RACE.cur/LIVE_RACE.total;
  if(pct<0.6)return 0;
  var p=LIVE_RACE.drivers&&LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  if(!p||p.dnf)return 0;
  return 1.5;
},gen:function(e){
  var lapsLeft=e.totalLaps-e.lap;
  return{phase:e.phase,lap:e.lap/e.totalLaps,title:"Gestion carburant critique",text:function(){return"Ton ingénieur à la radio : \"Carburant juste pour finir. "+lapsLeft+" tours à tenir — il faut lever le pied ou on risque de tomber en panne d'ici l'arrivée.\""},
  choices:[
    {text:"Obéir — passer en mode économique",mods:{player:-.02},difficulty:.2,actionType:"gestion",successMod:-.02,brilliantMod:-.01,rateMinMod:-.025,rateMajMod:-.04,note:"Tu perds du rythme mais tu finis"},
    {text:"Lever légèrement — gérer au chrono",mods:{player:.005},difficulty:.45,actionType:"gestion",successMod:.005,brilliantMod:.025,rateMinMod:-.02,rateMajMod:-.06,paceModOnRateMaj:{deltaSec:1.5,laps:5,reason:"Panne sèche — tu perds de nombreuses positions"},note:"Compromis risqué"},
    {text:"Ignorer et pousser à fond",mods:{player:.03},difficulty:.75,actionType:"gestion",successMod:.03,brilliantMod:.055,rateMinMod:-.03,rateMajMod:-.1,paceModOnRateMaj:{deltaSec:2.5,laps:8,reason:"Panne sèche — arrêt d'urgence"},note:"Va-tout — risque DNF"}
  ]};
}}
,{id:"last_lap_duel",weightFn:function(e){
  if(e.totalLaps-e.lap>2)return 0;
  if(!e.ahead&&!e.behind)return 0;
  var hasClose=false;
  if(e.ahead&&e.gapAhead!==null&&e.gapAhead<2)hasClose=true;
  if(e.behind&&e.gapBehind!==null&&e.gapBehind<1.5)hasClose=true;
  if(!hasClose)return 0;
  return 4.0;
},gen:function(e){
  var isAttack=e.ahead&&e.gapAhead!==null&&e.gapAhead<2;
  var target=isAttack?e.ahead:e.behind;
  var gapStr=isAttack?(e.gapAhead!==null?e.gapAhead.toFixed(1)+"s devant":""): (e.gapBehind!==null?e.gapBehind.toFixed(1)+"s derrière":"");
  return{phase:e.phase,lap:e.lap/e.totalLaps,title:"Dernier tour — tout se joue",text:function(){return isAttack?"Dernier tour ! <strong>"+target.name+"</strong> est à "+gapStr+". C'est maintenant ou jamais — tout est à jouer sur ces quelques kilomètres.":"Dernier tour ! <strong>"+target.name+"</strong> est à "+gapStr+". Il va tout tenter. Tu dois tenir."},
  choices:isAttack?[
    {text:"Attaque totale — sans retenue",mods:{player:.07},difficulty:.7,actionType:"attaque",successMod:.07,brilliantMod:.1,rateMinMod:-.035,rateMajMod:-.09,posGainOnBrillant:1,posLossOnRateMaj:1,note:"Tout ou rien"},
    {text:"Zone de freinage parfaite — propre mais décisif",mods:{player:.04},difficulty:.5,actionType:"attaque",successMod:.04,brilliantMod:.065,rateMinMod:-.02,rateMajMod:-.055,note:"Dépassement technique"},
    {text:"Garder la position actuelle",mods:{player:-.01},difficulty:.1,actionType:"gestion",successMod:-.01,brilliantMod:0,rateMinMod:-.015,rateMajMod:-.025,note:"Tu sécurises"}
  ]:[
    {text:"Fermer chaque porte — défense totale",mods:{player:.04},difficulty:.6,actionType:"defense",successMod:.04,brilliantMod:.065,rateMinMod:-.02,rateMajMod:-.055,posLossOnRateMaj:1,note:"Défense à mort"},
    {text:"Gérer proprement — pas de risque inutile",mods:{player:.02},difficulty:.3,actionType:"defense",successMod:.02,brilliantMod:.035,rateMinMod:-.012,rateMajMod:-.03,note:"Défense maîtrisée"},
    {text:"Céder la position — assurer l'arrivée",mods:{player:-.025},difficulty:.05,actionType:"gestion",successMod:-.025,brilliantMod:-.015,rateMinMod:-.03,rateMajMod:-.04,posLoss:1,note:"Tu cèdes mais tu finis"}
  ]};
}}
,{id:"pit_window_oval",weightFn:function(e){
  if(typeof _isOvalRace!=="function"||!_isOvalRace())return 0;
  if(typeof _pitEnabledForCurrentRace!=="function"||!_pitEnabledForCurrentRace())return 0;
  var p=LIVE_RACE.drivers&&LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  if(!p||p.dnf)return 0;
  var pct=LIVE_RACE.cur/LIVE_RACE.total;
  if(pct<0.3||pct>0.7)return 0;
  var cfg=typeof _pitConfigForCat==="function"?_pitConfigForCat():null;
  if(!cfg||!cfg.enabled||(p._pitsDone||0)>=(cfg.maxStops||1))return 0;
  return 2.0;
},gen:function(e){
  return{phase:e.phase,lap:e.lap/e.totalLaps,title:"Fenêtre pit — oval strategy",text:function(){return"La SC vient de sortir sur l'ovale — c'est le moment idéal pour rentrer aux stands sans perdre de position. Toutes les équipes vont se battre pour cette fenêtre."},
  choices:[
    {text:"Rentrer maintenant — profiter de la SC",mods:{player:.045},difficulty:.45,actionType:"gestion",successMod:.045,brilliantMod:.07,rateMinMod:-.02,rateMajMod:-.05,note:"Pit opportuniste",_doPit:true},
    {text:"Rester en piste — pneus encore bons",mods:{player:.01},difficulty:.25,actionType:"gestion",successMod:.01,brilliantMod:.025,rateMinMod:-.01,rateMajMod:-.025,note:"Track position conservé"},
    {text:"Attendre la prochaine SC",mods:{player:-.01},difficulty:.15,actionType:"gestion",successMod:-.01,brilliantMod:.005,rateMinMod:-.02,rateMajMod:-.04,note:"Pari risqué sur la prochaine neutralisation"}
  ]};
}}
,{id:"weather_window_push",weightFn:function(e){
  var w=RACE_STATE.weather||{};
  if(w.id!=="cloudy"&&w.id!=="dry")return 0;
  var cd=RACE_STATE.circuitData||{};
  if((cd.rain||0)<0.25)return 0;
  var pct=LIVE_RACE.cur/LIVE_RACE.total;
  if(pct<0.35||pct>0.75)return 0;
  return 1.8;
},gen:function(e){
  return{phase:e.phase,lap:e.lap/e.totalLaps,title:"Fenêtre météo — pousser maintenant",text:function(){return"Ton ingénieur : \"Les nuages arrivent vite. On a peut-être 4-5 tours avant la pluie. C'est maintenant qu'on fait la différence — après ce sera beaucoup plus compliqué.\""},
  choices:[
    {text:"Pousser à 100% maintenant",mods:{player:.04},difficulty:.55,actionType:"attaque",successMod:.04,brilliantMod:.065,rateMinMod:-.025,rateMajMod:-.055,paceModOnBrillant:{deltaSec:-0.4,laps:5,reason:"Tu exploites parfaitement la fenêtre sèche"},note:"Tu exploites la fenêtre"},
    {text:"Rythme normal — gérer les pneus pour après",mods:{player:.005},difficulty:.15,actionType:"gestion",successMod:.005,brilliantMod:.02,rateMinMod:-.005,rateMajMod:-.015,note:"Pneus préservés"},
    {text:"Rentrer aux stands pour anticiper la pluie",mods:{player:.02},difficulty:.5,actionType:"adaptation",successMod:.04,brilliantMod:.07,rateMinMod:-.03,rateMajMod:-.065,paceModOnRateMaj:{deltaSec:0.8,laps:4,reason:"Pneus pluie sur sec — mauvais timing"},note:"Pari météo anticipé",_doPit:true}
  ]};
}}
,{id:"drs_train_escape",weightFn:function(e){
  var cat=G.cat||"";
  if(["Formule 1","Formule 2","Formule 3"].indexOf(cat)<0)return 0;
  if(!e.ahead||!e.behind)return 0;
  if(e.gapAhead===null||e.gapBehind===null)return 0;
  if(e.gapAhead>1.5||e.gapBehind>1.5)return 0;
  if("early"===e.phase||"depart"===e.phase)return 0;
  return 2.0;
},gen:function(e){
  return{phase:e.phase,lap:e.lap/e.totalLaps,title:"Train DRS — tu es pris en sandwich",text:function(){return"Tu es dans le train DRS : <strong>"+e.ahead.name+"</strong> devant ("+e.gapAhead.toFixed(1)+"s), <strong>"+e.behind.name+"</strong> derrière ("+e.gapBehind.toFixed(1)+"s). Tout le monde a le DRS et personne ne peut vraiment attaquer. Il faut sortir du train."},
  choices:[
    {text:"Attaquer devant — casser le train par l'avant",mods:{player:.035},difficulty:.55,actionType:"attaque",successMod:.035,brilliantMod:.06,rateMinMod:-.02,rateMajMod:-.05,posGainOnBrillant:1,note:"Tu prends l'initiative"},
    {text:"Laisser passer derrière — te mettre en chasseur",mods:{player:-.015},difficulty:.2,actionType:"gestion",successMod:-.015,brilliantMod:-.005,rateMinMod:-.02,rateMajMod:-.035,posLoss:1,note:"Tu sacrifies une place pour mieux attaquer"},
    {text:"Gérer le rythme — tenir la position dans le train",mods:{player:.005},difficulty:.2,actionType:"defense",successMod:.005,brilliantMod:.02,rateMinMod:-.01,rateMajMod:-.025,note:"Tu restes en position"}
  ]};
}}
,{id:"teammate_swap_request",weightFn:function(e){
  if(!G.currentTeam||G.currentTeam==="Indépendant")return 0;
  var p=LIVE_RACE.drivers&&LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  var tm=LIVE_RACE.drivers&&LIVE_RACE.drivers.find(function(d){return!d.isPlayer&&!d.dnf&&d.team===G.currentTeam&&d.pos>p.pos});
  if(!p||p.dnf||!tm)return 0;
  var pct=LIVE_RACE.cur/LIVE_RACE.total;
  if(pct<0.55)return 0;
  var gap=Math.abs(45*((p.score-(p.penaltySec||0)/45)-(tm.score-(tm.penaltySec||0)/45)));
  if(gap>5)return 0;
  return 1.2;
},gen:function(e){
  var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  var tm=LIVE_RACE.drivers.find(function(d){return!d.isPlayer&&!d.dnf&&d.team===G.currentTeam&&d.pos>p.pos});
  if(!p||!tm||p.dnf)return null;
  return{phase:e.phase,lap:e.lap/e.totalLaps,title:"Consigne équipe — laisse passer",text:function(){return"Ingénieur à la radio : \"<strong>"+tm.name+"</strong> est mieux placé au championnat — on a besoin que tu le laisses passer. C'est une consigne d'équipe.\""},
  choices:[
    {text:"Obéir — respecter la consigne",mods:{player:-.025},difficulty:.1,actionType:"gestion",successMod:-.025,brilliantMod:-.01,rateMinMod:-.03,rateMajMod:-.04,posLoss:1,note:"Loyauté à l'équipe",trustDelta:6},
    {text:"Résister poliment — demander confirmation",mods:{player:.005},difficulty:.3,actionType:"defense",successMod:.005,brilliantMod:.02,rateMinMod:-.01,rateMajMod:-.025,note:"Tu négocies",trustDelta:-2},
    {text:"Ignorer — ta course, tes règles",mods:{player:.025},difficulty:.4,actionType:"defense",successMod:.025,brilliantMod:.04,rateMinMod:-.015,rateMajMod:-.035,note:"Tu refuses la consigne",trustDelta:-10}
  ]};
}}
,{id:"penalty_serve_timing",weightFn:function(e){
  if(typeof _pitEnabledForCurrentRace!=="function"||!_pitEnabledForCurrentRace())return 0;
  var p=LIVE_RACE.drivers&&LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  if(!p||p.dnf||!(p.penaltySec>0))return 0;
  var pct=LIVE_RACE.cur/LIVE_RACE.total;
  if(pct<0.2||pct>0.7)return 0;
  var cfg=typeof _pitConfigForCat==="function"?_pitConfigForCat():null;
  if(!cfg||!cfg.enabled||(p._pitsDone||0)>=(cfg.maxStops||1))return 0;
  return 1.5;
},gen:function(e){
  var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  if(!p||p.dnf)return null;
  var penSec=Math.round(p.penaltySec||0);
  return{phase:e.phase,lap:e.lap/e.totalLaps,title:"Purger la pénalité — quel timing ?",text:function(){return"Tu as "+penSec+"s de pénalité à purger aux stands. Tu peux rentrer maintenant et combiner avec un pit stop, ou attendre un meilleur moment stratégique."},
  choices:[
    {text:"Rentrer immédiatement — purger maintenant",mods:{player:.02},difficulty:.4,actionType:"gestion",successMod:.02,brilliantMod:.04,rateMinMod:-.01,rateMajMod:-.025,note:"Pénalité purgée + pit combiné",_doPit:true},
    {text:"Attendre encore 3 tours pour choisir le bon moment",mods:{player:.01},difficulty:.25,actionType:"gestion",successMod:.01,brilliantMod:.025,rateMinMod:-.01,rateMajMod:-.025,note:"Tu optimises le timing"},
    {text:"Pousser fort pour creuser l'écart avant de rentrer",mods:{player:.035},difficulty:.6,actionType:"attaque",successMod:.035,brilliantMod:.06,rateMinMod:-.02,rateMajMod:-.05,paceModOnBrillant:{deltaSec:-0.3,laps:3,reason:"Tu creuses l'écart — la pénalité coûte moins"},note:"Attaque avant pit"}
  ]};
}}
,{id:"start_launch",weightFn:function(e){
  if(LIVE_RACE.cur!==1)return 0;
  var cat=G.cat||"";
  return ["Formule 1","Formule 2","Formule 3","Formula Regional","Formule 4","Super Formula","IndyCar"].indexOf(cat)>=0?3.0:0;
},gen:function(e){
  var startPos=RACE_STATE.qualiPos||e.playerPos||5;
  return{phase:"depart",lap:0,title:"Départ — lumières éteintes",text:function(){return"Les feux s'éteignent ! Tu pars P"+startPos+". Les 200 premiers mètres vont tout décider. Comment tu joues le départ ?"},
  choices:[
    {text:"Départ explosif — antipatinage à fond",mods:{player:.05},difficulty:.6,actionType:"attaque",successMod:.05,brilliantMod:.08,rateMinMod:-.03,rateMajMod:-.07,paceModOnRateMaj:{deltaSec:1.0,laps:3,reason:"Patinage excessif — tu perds plusieurs places"},note:"Départ agressif"},
    {text:"Départ propre et maîtrisé",mods:{player:.015},difficulty:.25,actionType:"gestion",successMod:.015,brilliantMod:.03,rateMinMod:-.008,rateMajMod:-.02,note:"Départ solide"},
    {text:"Départ prudent — éviter tout incident T1",mods:{player:-.01},difficulty:.1,actionType:"gestion",successMod:-.01,brilliantMod:.005,rateMinMod:-.015,rateMajMod:-.025,note:"Tu perds peu mais tu restes propre"}
  ]};
}}
,{id:"wec_driver_change",weightFn:function(e){
  if(typeof _isWECRace!=="function"||!_isWECRace())return 0;
  if(typeof _pitEnabledForCurrentRace!=="function"||!_pitEnabledForCurrentRace())return 0;
  var pct=LIVE_RACE.cur/LIVE_RACE.total;
  if(pct<0.2||pct>0.8)return 0;
  var p=LIVE_RACE.drivers&&LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  if(!p||p.dnf)return 0;
  return 1.5;
},gen:function(e){
  return{phase:e.phase,lap:e.lap/e.totalLaps,title:"Relais WEC — stratégie d'arrêt",text:function(){return"Ton équipe te contacte : relais obligatoire dans 5 tours. Le leader vient de rentrer. Tu peux anticiper ou attendre pour optimiser le stint suivant."},
  choices:[
    {text:"Rentrer maintenant — relais immédiat",mods:{player:.03},difficulty:.4,actionType:"gestion",successMod:.03,brilliantMod:.05,rateMinMod:-.015,rateMajMod:-.035,note:"Relais tôt — avantage stratégique",_doPit:true},
    {text:"Pousser 3 tours puis rentrer",mods:{player:.02},difficulty:.35,actionType:"attaque",successMod:.02,brilliantMod:.04,rateMinMod:-.01,rateMajMod:-.03,note:"Tu creuses l'écart avant le relais"},
    {text:"Attendre le timing optimal selon les rivaux",mods:{player:.01},difficulty:.25,actionType:"gestion",successMod:.01,brilliantMod:.025,rateMinMod:-.01,rateMajMod:-.025,note:"Attentiste — tu surveilles le traffic"}
  ]};
}}
,{id:"kart_rain_slick_dilemma",weightFn:function(e){
  var isKart=G.cat==="Karting Junior"||G.cat==="Karting Senior";
  if(!isKart)return 0;
  var w=RACE_STATE.weather||{};
  if(w.id!=="cloudy"&&w.id!=="wet")return 0;
  return 1.5;
},gen:function(e){
  var w=RACE_STATE.weather||{};
  var isWet=w.id==="wet";
  return{phase:e.phase,lap:e.lap/e.totalLaps,title:isWet?"Piste mouillée — slick ou pluie ?":"Piste qui mouille — tu gardes les slicks ?",text:function(){return isWet?"La piste est mouillée mais certains pilotes restent en slick en jouant la ligne sèche. Haut risque, haute récompense. Qu'est-ce que tu fais ?":"Quelques gouttes. Certains passent en pneus pluie, d'autres restent en slick. La décision peut tout changer."},
  choices:[
    {text:"Rester en slick — jouer la ligne sèche",mods:{player:.04},difficulty:.65,actionType:"adaptation",successMod:.04,brilliantMod:.07,rateMinMod:-.03,rateMajMod:-.07,paceModOnRateMaj:{deltaSec:1.5,laps:5,reason:"Slick sur mouillé — tu glisses partout"},note:"Pari slick"},
    {text:isWet?"Passer en pneus pluie":"Anticiper les pneus pluie",mods:{player:.015},difficulty:.3,actionType:"adaptation",successMod:.015,brilliantMod:.04,rateMinMod:-.01,rateMajMod:-.025,note:"Décision raisonnable"},
    {text:"Suivre ce que fait ton référencier d'équipe",mods:{player:.005},difficulty:.15,actionType:"gestion",successMod:.005,brilliantMod:.02,rateMinMod:-.005,rateMajMod:-.015,note:"Tu joues la sécurité"}
  ]};
}}
];function tryTriggerChoiceRaceEvent(){if(LIVE_RACE&&!LIVE_RACE.finished&&!LIVE_RACE.paused&&(// ===== DÉCLENCHEURS EVENTS DE CRISE =====
(function(){
 try{
  if(!LIVE_RACE||LIVE_RACE.finished||LIVE_RACE.paused)return;
  if(typeof _injectCrisisEvent!=="function"||typeof CRISIS_EVENTS==="undefined")return;
  LIVE_RACE._crisisHistory=LIVE_RACE._crisisHistory||{};
  var _p=LIVE_RACE.drivers&&LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  if(!_p||_p.dnf)return;
  var _lap=LIVE_RACE.cur, _total=LIVE_RACE.total||20;
  var _pct=_lap/_total;
  var _trust=typeof TEAM_TRUST!=="undefined"?TEAM_TRUST.value:100;
  var _mm=typeof _getMomentum==="function"?_getMomentum():"neutral";
  var _hasTeam=G.currentTeam&&G.currentTeam!=="Indépendant";
  var _gridP=RACE_STATE&&RACE_STATE.qualiPos||5;

  // 1. CONFIANCE CRITIQUE — entre 35% et 50% de course, confiance < 25
  if(!LIVE_RACE._crisisHistory.trust&&_pct>=.35&&_pct<=.52&&_trust<25&&_hasTeam){
   LIVE_RACE._crisisHistory.trust=_lap;
   _injectCrisisEvent(CRISIS_EVENTS.trust_critical);
   return;
  }

  // 2. RIVAL TE DÉPASSE — entre 30% et 70%, rival actif qui vient de passer
  if(!LIVE_RACE._crisisHistory.rival&&_pct>=.30&&_pct<=.70&&G._rivalries&&G._rivalries.length>0){
   var _rv=G._rivalries.find(function(rv){return rv.active});
   if(_rv){
    var _rvDriver=LIVE_RACE.drivers&&LIVE_RACE.drivers.find(function(d){return !d.isPlayer&&d.name===_rv.name});
    if(_rvDriver&&!_rvDriver.dnf){
     // Le rival vient juste de passer (il était derrière, il est maintenant devant)
     var _rvJustPassed=_rvDriver.pos===_p.pos-1&&(_p.prevPos||_p.pos)<=(_rvDriver.prevPos||_rvDriver.pos);
     if(_rvJustPassed){
      LIVE_RACE._crisisHistory.rival=_lap;
      _injectCrisisEvent(CRISIS_EVENTS.rival_passes);
      return;
     }
    }
   }
  }

  // 3. SÉRIE NOIRE — tour 2-3, momentum "ice"
  if(!LIVE_RACE._crisisHistory.serie&&_lap<=3&&_mm==="ice"){
   LIVE_RACE._crisisHistory.serie=_lap;
   _injectCrisisEvent(CRISIS_EVENTS.serie_noire);
   return;
  }

  // 4. CHUTE LIBRE — tour 5-6, perdu 6+ places depuis la grille
  if(!LIVE_RACE._crisisHistory.chute&&_lap>=5&&_lap<=7){
   var _drop=_p.pos-_gridP;
   if(_drop>=6){
    LIVE_RACE._crisisHistory.chute=_lap;
    _injectCrisisEvent(CRISIS_EVENTS.chute_libre);
    return;
   }
  }
 }catch(_e){console.warn("crisis triggers:",_e);}
})()
,LIVE_RACE._lastChoiceEventLap||(LIVE_RACE._lastChoiceEventLap=-10),(function(){var _isKartCat=G.cat==="Karting Junior"||G.cat==="Karting Senior";var _minGap=_isKartCat?4:6;var _maxEvts=_isKartCat?3:2;return!(LIVE_RACE.cur-LIVE_RACE._lastChoiceEventLap<_minGap||(LIVE_RACE._choiceEventCount||(LIVE_RACE._choiceEventCount=0),LIVE_RACE._choiceEventCount>=_maxEvts))})())){var e=buildRaceCtx();if(e){var t=CHOICE_RACE_EVENTS.map(function(t){var r=0;try{r="function"==typeof t.weightFn?t.weightFn(e):1}catch(e){r=0}return{def:t,weight:r}}).filter(function(e){return e.weight>0});if(0!==t.length&&(LIVE_RACE._choiceHistory||(LIVE_RACE._choiceHistory={}),0!==(t=t.filter(function(e){var t=LIVE_RACE._choiceHistory[e.def.id];return"number"!=typeof t||LIVE_RACE.cur-t>6})).length)){for(var r=t.reduce(function(e,t){return e+t.weight},0),n=Math.random()*r,a=0,i=null,o=0;o<t.length;o++)if(n<=(a+=t[o].weight)){i=t[o].def;break}if(i){var s;try{s=i.gen(e)}catch(e){return}/* === EVENTS V2 — Figer les outcomes au moment de la génération.
   Pour chaque choix qui a une difficulty + actionType, on calcule UNE FOIS les outcomes
   (en prenant en compte le rival ciblé selon l'actionType) et on les stocke sur le choix.
   Cela garantit que l'UI et resolveRaceEvt voient EXACTEMENT les mêmes pourcentages,
   et que ces pourcentages ne changent pas si la modale est re-rendue. */
if(s&&s.choices){
 s.choices.forEach(function(ch){
  if(typeof ch.difficulty==="number"&&ch.actionType){
   // Détermine le rival concerné par l'action et récupère sa skill brute (50-99)
   var targetRival=null;var rivalSkill=null;
   if(ch.actionType==="attaque"&&e.ahead)targetRival=e.ahead;
   else if(ch.actionType==="defense"&&e.behind)targetRival=e.behind;
   if(targetRival&&typeof targetRival.rivalIdx==="number"&&G.rivals&&G.rivals[targetRival.rivalIdx]){
    rivalSkill=G.rivals[targetRival.rivalIdx].skill; // 50-99
   }
   var actionCtx={playerPos:e.playerPos,targetRival:targetRival,rivalSkill:rivalSkill};
   ch._frozenOutcomes=_computeChoiceOutcomes(ch.difficulty,ch.actionType,actionCtx);
   ch._actionCtx=actionCtx; // pour debug et logs
  }
 });
}
s&&(RACE_STATE.events||(RACE_STATE.events=[]),RACE_STATE.events.push({id:i.id,phase:s.phase,lap:s.lap||e.lap/e.totalLaps,title:s.title||"Événement course",text:s.text,choices:s.choices||[],ctx:e}),LIVE_RACE._lastChoiceEventLap=LIVE_RACE.cur,LIVE_RACE._choiceEventCount++,LIVE_RACE._choiceHistory[i.id]=LIVE_RACE.cur,LIVE_RACE.paused=!0,"function"==typeof showNextRaceEvent&&(CURRENT_EVT_IDX=RACE_STATE.events.length-1,showNextRaceEvent()))}}}}}function _isNegativeForPlayer(eventDef){var negativeIds=["player_contact","rival_fastest","storm_aquaplaning","rain_flash","wet_dry_line","cloudy_gust","hot_tyre_blistering","hot_player_fatigue"];return negativeIds.indexOf(eventDef.id)>=0}
function _playerPenaltyOverWindow(){if(!LIVE_RACE||!LIVE_RACE.drivers)return 0;var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});if(!p||!p.penaltyLog)return 0;var cur=LIVE_RACE.cur;return p.penaltyLog.filter(function(pe){return cur-pe.lap<=10}).reduce(function(s,pe){return s+pe.sec},0)}
function triggerPassiveEvent(){if(LIVE_RACE&&!LIVE_RACE.finished&&!LIVE_RACE.paused){var e={},t=PASSIVE_EVENTS.map(function(t){return{def:t,weight:"function"==typeof t.weightFn?t.weightFn(e):1}}).filter(function(e){return e.weight>0});if(0!==t.length){var lastNegLap=LIVE_RACE._lastNegEventLap||-99;var penWindow=_playerPenaltyOverWindow();var negCooldown=LIVE_RACE.cur-lastNegLap<3;t=t.filter(function(item){var isNeg=_isNegativeForPlayer(item.def);if(isNeg&&negCooldown)return false;if(isNeg&&penWindow>=8)return false;return true});if(0===t.length)return;for(var r=t.reduce(function(e,t){return e+t.weight},0),n=Math.random()*r,a=0,i=null,o=0;o<t.length;o++)if(n<=(a+=t[o].weight)){i=t[o].def;break}if(i){LIVE_RACE._passiveHistory||(LIVE_RACE._passiveHistory={});var s=LIVE_RACE._passiveHistory[i.id];if(!("number"==typeof s&&LIVE_RACE.cur-s<5)){var l=i.gen?i.gen(e):null;l&&(LIVE_RACE._passiveHistory[i.id]=LIVE_RACE.cur,"function"==typeof l.effects&&l.effects(),_isNegativeForPlayer(i)&&(LIVE_RACE._lastNegEventLap=LIVE_RACE.cur),LIVE_RACE.newsFeed||(LIVE_RACE.newsFeed=[]),LIVE_RACE.newsFeed.unshift({icon:l.icon,title:l.title,desc:l.desc,color:l.color||"#F59E0B",ttl:l.ttl||4,lap:LIVE_RACE.cur}),(typeof _isRadioMessage==="function"&&_isRadioMessage(l)&&typeof playRadioOpen==="function"&&(function(){try{playRadioOpen()}catch(_e){}})()),LIVE_RACE.newsFeed.length>3&&(LIVE_RACE.newsFeed=LIVE_RACE.newsFeed.slice(0,3)))}}}}}function pushRadioMsg(title,desc,opts){opts=opts||{};try{if(!LIVE_RACE)return;LIVE_RACE.newsFeed=LIVE_RACE.newsFeed||[];LIVE_RACE.newsFeed.unshift({icon:"",title:" "+title,desc:desc?" "+desc:null,color:opts.color||"#22D3EE",ttl:opts.ttl||4,lap:LIVE_RACE.cur});if(LIVE_RACE.newsFeed.length>3)LIVE_RACE.newsFeed=LIVE_RACE.newsFeed.slice(0,3);if(typeof playRadioOpen==="function")try{playRadioOpen()}catch(e){}if(typeof renderLiveNewsFeed==="function")try{renderLiveNewsFeed()}catch(e){}}catch(e){console.warn("pushRadioMsg:",e)}}
var TEAM_RADIO_PERSONALITY={Ferrari:{tone:"passionate",lang:["Forza","Bravo","Avanti","Dai dai dai"],engineer:"Riccardo"},Mercedes:{tone:"calm",lang:["Outstanding mate","Brilliant","Mate","Hammer time"],engineer:"Bono"},McLaren:{tone:"upbeat",lang:["Get in there","Lovely","Mega"],engineer:"Tom"},"Red Bull":{tone:"direct",lang:["Easy","Big push now","Maximum attack"],engineer:"GP"},RedBull:{tone:"direct",lang:["Easy","Big push now","Maximum attack"],engineer:"GP"},Williams:{tone:"professional",lang:["Good work","Push now","Stay focused"],engineer:"James"},Alpine:{tone:"french",lang:["Allez","Bien joué","Vas-y","Pousse fort"],engineer:"Karel"},"Aston Martin":{tone:"calm",lang:["Good work","Steady now","Push when you can"],engineer:"Ben"},Williams:{tone:"professional",lang:["Push","Stay smooth","Keep it up"],engineer:"James"},Sauber:{tone:"swiss",lang:["Strong","Steady","Hold it"],engineer:"Xavi"},Haas:{tone:"american",lang:["Let's go","Send it","Full send"],engineer:"Gary"},Toyota:{tone:"japanese",lang:["Hai","Yoshi","Ganbatte"],engineer:"Hiro"},Honda:{tone:"japanese",lang:["Hai","Yoshi","Ganbatte"],engineer:"Hiro"},BMW:{tone:"german",lang:["Sehr gut","Achtung","Vorsicht"],engineer:"Klaus"}};
function _getTeamPersonality(){var team=G&&G.currentTeam||"";var p=TEAM_RADIO_PERSONALITY[team];if(p)return p;if(team.toLowerCase().includes("red bull"))return TEAM_RADIO_PERSONALITY["Red Bull"];if(team.toLowerCase().includes("aston"))return TEAM_RADIO_PERSONALITY["Aston Martin"];return{tone:"neutral",lang:["Good","Push","Keep going"],engineer:"Engineer"}}
function _radioFlavor(p){if(!p||!p.lang||p.lang.length===0)return"";return p.lang[Math.floor(Math.random()*p.lang.length)]}
function tryContextualRadio(){try{if(!LIVE_RACE||LIVE_RACE.finished||LIVE_RACE.paused)return;LIVE_RACE._lastRadioLap=LIVE_RACE._lastRadioLap||-99;if(LIVE_RACE.cur-LIVE_RACE._lastRadioLap<3)return;var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});if(!p||p.dnf)return;var lap=LIVE_RACE.cur,total=LIVE_RACE.total,phase=lap/total;var team=_getTeamPersonality();var roll=Math.random();if(roll<.32)return;var msgs=[];var pos=p.pos||99;var ahead=LIVE_RACE.drivers.find(function(d){return d.pos===pos-1&&!d.dnf});var behind=LIVE_RACE.drivers.find(function(d){return d.pos===pos+1&&!d.dnf});var gapAhead=ahead?Math.abs(((p.score-(p.penaltySec||0)/45)-(ahead.score-(ahead.penaltySec||0)/45))*45):null;var gapBehind=behind?Math.abs(((p.score-(p.penaltySec||0)/45)-(behind.score-(behind.penaltySec||0)/45))*45):null;var weather=RACE_STATE&&RACE_STATE.weather||{};var w=weather.id||"dry";var tyreFresh=p._tyreFreshLaps&&p._tyreFreshLaps>0;var tyreLapsOld=p._lastPitLap?(lap-p._lastPitLap):lap;if(phase<.15&&pos<=3&&LIVE_RACE.cur>=1){msgs.push({title:"Bon envol au départ",desc:_radioFlavor(team)+", tu pars P"+pos+" — la course commence, garde la tête froide"})}if(phase<.15&&pos>5&&p.gridPos<pos){msgs.push({title:"Reste calme, on a tout le temps",desc:"Pas de panique au départ, "+(p.gridPos-pos)+" places perdues mais long week-end devant."})}if(gapAhead!==null&&gapAhead<1.0&&phase>.15&&phase<.85&&pos<=10){msgs.push({title:"Tu es dans ses échappements",desc:_radioFlavor(team)+" ! "+ahead.name+" à "+gapAhead.toFixed(1)+"s — c'est le moment de pousser !"})}if(gapBehind!==null&&gapBehind<0.8&&phase>.4&&pos<=10){msgs.push({title:"Pression derrière",desc:behind.name+" à "+gapBehind.toFixed(1)+"s, garde tes lignes propres."})}var _tLife=typeof p._tyreLife==="number"?p._tyreLife:100;
if(tyreFresh||_tLife>85){msgs.push({title:"Pneus frais, tu as l'avantage",desc:_radioFlavor(team)+" ! Profite du grip max maintenant !"})}
else if(_tLife<=20&&!p._tyreLifeAlerted20){p._tyreLifeAlerted20=true;msgs=[];msgs.push({title:"PNEUS CRITIQUES — rentre en urgence !",desc:"Moins de 20% de gomme, "+(team.tone==="french"?"tu vas perdre le train — box maintenant !":"box box box, tyres are gone !")})}
else if(_tLife<=40&&!p._tyreLifeAlerted40){p._tyreLifeAlerted40=true;msgs=[];msgs.push({title:"Gommes à la limite",desc:"Tes pneus arrivent en bout de vie — "+Math.round(_tLife)+"% restant. Rentre ou passe en gestion totale."})}
else if(_tLife<=55&&phase>.4&&phase<.85){msgs.push({title:"Surveille tes gommes",desc:"Les pneus approchent de la limite, "+(team.tone==="french"?"sois subtil dans les virages":"smooth on the throttle")+"."})}if(phase>.85&&pos<=3){msgs.push({title:"Derniers tours, c'est crucial",desc:_radioFlavor(team)+" ! "+(pos===1?"Hammer time !":"Pousse pour le podium !")})}if(phase>.95&&pos===1){msgs.push({title:"Ramène-la à la maison !",desc:_radioFlavor(team)+" ! Tu es presque là, gère ton avance !"})}if(w==="rain"||w==="storm"||w==="wet"){if(Math.random()<.3)msgs.push({title:"Attention sur l'humidité",desc:"Piste piégeuse, garde de la marge en virage."})}else if(w==="hot"){if(Math.random()<.2)msgs.push({title:"Très chaud sur la piste",desc:"Surveille la température moteur, soigne tes ouvertures de gaz."})}if(phase>.4&&phase<.7&&pos>=4&&pos<=10){msgs.push({title:"On est dans les points, tiens bon",desc:"Le rythme est bon. Continue à scorer."})}if(msgs.length>0){var m=msgs[Math.floor(Math.random()*msgs.length)];pushRadioMsg(m.title,m.desc,{ttl:5,color:"#22D3EE"});LIVE_RACE._lastRadioLap=lap}}catch(e){console.warn("tryContextualRadio:",e)}}
function tickNewsFeed(){LIVE_RACE.newsFeed&&LIVE_RACE.newsFeed.length&&(LIVE_RACE.newsFeed.forEach(function(e){e.ttl-=1}),LIVE_RACE.newsFeed=LIVE_RACE.newsFeed.filter(function(e){return e.ttl>0}))}function renderLiveNewsFeed(){var e=document.getElementById("live-news-feed");if(e){if(!LIVE_RACE.newsFeed||0===LIVE_RACE.newsFeed.length)return e.style.display="none",void(e.innerHTML="");e.style.display="block";var t="";LIVE_RACE.newsFeed.forEach(function(e,r){var n=Math.max(.4,Math.min(1,e.ttl/5));var isRadio=typeof _isRadioMessage==="function"&&_isRadioMessage(e);if(isRadio){var bg="linear-gradient(135deg,rgba(8,15,25,0.95) 0%,rgba(15,30,50,0.92) 100%)";var bdr="rgba(34,211,238,0.4)";var titleColor="#22D3EE";t+='<div class="radio-msg" style="margin-bottom:6px;padding:8px 11px 9px;background:'+bg+';border:1px solid '+bdr+';border-left:3px solid #22D3EE;border-radius:8px;display:flex;align-items:center;gap:10px;opacity:'+n+';transition:opacity .25s;overflow:hidden">';t+='<span class="radio-tx-led" style="flex-shrink:0"></span>';t+='<div style="flex:1;min-width:0">';t+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px"><span style="font-family:var(--font-display);font-size:9px;font-weight:800;color:'+titleColor+';letter-spacing:.12em;text-transform:uppercase;line-height:1">'+renderIcon('radio',14,'#60A5FA')+' RADIO TEAM</span><span class="radio-waveform"><span></span><span></span><span></span><span></span><span></span></span></div>';t+='<div style="font-family:var(--font-display);font-size:10px;font-weight:700;color:'+titleColor+';letter-spacing:.04em;line-height:1.2">'+e.title.replace(/^📻\s*/,"")+"</div>";if(e.desc)t+='<div style="font-size:11px;color:var(--text2);margin-top:2px;line-height:1.3;font-style:italic;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">« '+e.desc.replace(/^📻\s*/,"")+' »</div>';t+='</div>';t+='<span style="font-family:var(--font-display);font-size:9px;color:var(--muted);letter-spacing:.06em;flex-shrink:0">T'+e.lap+"</span>";t+='</div>'}else{t+='<div style="margin-bottom:6px;padding:9px 12px;background:rgba(20,20,28,0.85);border:1px solid '+e.color+"55;border-left:3px solid "+e.color+";border-radius:8px;display:flex;align-items:center;gap:10px;opacity:"+n+';transition:opacity .25s"><span style="font-size:16px;flex-shrink:0;line-height:1">'+e.icon+'</span><div style="flex:1;min-width:0"><div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:'+e.color+';letter-spacing:.08em;text-transform:uppercase;line-height:1.1">'+e.title+"</div>"+(e.desc?'<div style="font-size:11px;color:var(--text2);margin-top:2px;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+e.desc+"</div>":"")+'</div><span style="font-family:var(--font-display);font-size:9px;color:var(--muted);letter-spacing:.06em;flex-shrink:0">T'+e.lap+"</span></div>"}}),e.innerHTML=t}}function buildLiveEventSchedule(e){var t=RACE_STATE.circuitData||{},r=RACE_STATE.weather||{id:"dry"},n="wet"===r.id||"storm"===r.id,a="street"===t.type,i=G.cat||"Karting Junior",o="Karting Junior"===i||"Karting Senior"===i,s="Formule 4"===i||"Formula Regional"===i,l="Formule 3"===i||"Formule 2"===i,c="Formule 1"===i,d="Super Formula"===i,p="Endurance WEC"===i,u="IndyCar"===i,f=!o,m=l||c||d||u,g=[];g.push({pct:.4,phase:"Météo",always:!1,gen:function(){var w=RACE_STATE.weather||{id:"dry"};var _mcW=(typeof RACE_STATE!=="undefined"&&RACE_STATE.circuitData&&RACE_STATE.circuitData.microClimate)||false;
// Micro-climat : permettre un 2ème changement météo après mi-course
if(LIVE_RACE._weatherChanged&&!(_mcW&&LIVE_RACE.cur/LIVE_RACE.total>0.5&&!LIVE_RACE._weatherChanged2))return null;
var direction;var current=w.id;
if(current==="storm"){if(Math.random()<.6)direction={from:"storm",to:"wet",label:"Pluie battante",toLabel:"Piste humide",worsening:!1};else direction={from:"storm",to:"cloudy",label:"Pluie battante",toLabel:"Nuageux",worsening:!1}}else if(current==="wet"){if(Math.random()<.5)direction={from:"wet",to:"cloudy",label:"Piste humide",toLabel:"Nuageux",worsening:!1};else direction={from:"wet",to:"storm",label:"Piste humide",toLabel:"Pluie battante",worsening:!0}}else if(current==="cloudy"){if(Math.random()<.55)direction={from:"cloudy",to:"wet",label:"Nuageux",toLabel:"Piste humide",worsening:!0};else direction={from:"cloudy",to:"dry",label:"Nuageux",toLabel:"Temps sec",worsening:!1}}else if(current==="dry"||current==="hot"){direction={from:current,to:"wet",label:current==="hot"?"Forte chaleur":"Temps sec",toLabel:"Piste humide",worsening:!0}}else{return null}LIVE_RACE._pendingWeatherChange=direction;
if(LIVE_RACE._weatherChanged)LIVE_RACE._weatherChanged2=true;
var radioMsg,desc,worse=direction.worsening;if(worse&&direction.to==="storm"){radioMsg=" Box-box ! Gros front orageux à 2 minutes — il va flotter sévère !";desc="L'ingénieur t'avertit : averse violente imminente. Les conditions vont se dégrader fortement. Décide vite — tes options se referment."}else if(worse&&direction.to==="wet"){radioMsg=" Attention pilote, on voit la pluie arriver dans 2 tours.";desc="L'ingénieur signale des gouttes au radar. La piste va s'humidifier. Plus d'adhérence sur les slicks."}else if(!worse&&direction.from==="storm"){radioMsg=" La pluie faiblit, on a une fenêtre — les nuages partent !";desc="L'ingénieur l'a vu : l'orage se dissipe. La piste va sécher. Tes inters vont devenir handicapants."}else if(!worse&&direction.from==="wet"){radioMsg=" La piste sèche par endroits, on voit des lignes de course apparaître.";desc="L'ingénieur observe une ligne sèche. Les slicks vont devenir intéressants."}else{radioMsg=" Conditions qui changent, garde un œil dehors.";desc="L'ingénieur signale un changement de conditions à venir."}return{icon:worse?"storm":"cloudy",title:"Radio ingénieur — météo",desc:radioMsg+" — "+desc,choices:[{text:worse?"Pit stop — passer aux pneus pluie":"Pit stop — passer aux slicks",mod:worse?-.012:-.010,_weatherStrategy:"pit",chance:{fail:.18,failMod:-.012,msg:"Pit stop chaotique — tu perds plus de places que prévu."}},{text:"Rester en piste — tenir avec les pneus actuels",mod:worse?-.025:-.018,_weatherStrategy:"stay",chance:{fail:.32,failMod:-.025,msg:worse?"Tu perds le grip dans les premiers virages mouillés.":"Tes pneus pluie surchauffent sur le sec, gros écarts."}},{text:"Pousser fort avant le changement — gagner du temps",mod:.020,_weatherStrategy:"push",chance:{fail:.28,failMod:-.018,msg:"Pneus dégradés — tu glisses au moment crucial."}}],_isWeatherEvent:!0}}});g.push({pct:.35,phase:"Pluie",always:!1,gen:function(){var w=RACE_STATE.weather||{};if(w.id!=="storm"&&w.id!=="wet")return null;var rivAhead=_riAhead(1);var rivName=rivAhead!==null?_rn(rivAhead):"le pilote devant";return{icon:"storm",title:"Flaque traîtresse en sortie de virage !",desc:"Une grosse flaque s'est formée à l'apex. "+rivName+" passe juste devant — tu vois sa voiture aquaplaner légèrement.",choices:[{text:"Ralentir et passer par l'extérieur sec",mod:-.005,_safe:!0},{text:"Foncer dans la flaque comme lui — risqué",mod:.018,chance:{fail:.32,failMod:-.025,msg:"Aquaplaning — tu pars en glisse, perds 3 places !",penalty:4},rival:{idx:rivAhead!==null?rivAhead:_ri(),val:-.005}},{text:"Tenter de plonger à la corde — à l'intérieur",mod:.012,chance:{fail:.22,failMod:-.018,msg:"Tu touches le vibreur mouillé et perds le grip — coup d'arrêt."},rival:{idx:rivAhead!==null?rivAhead:_ri(),val:-.008}}]}}});g.push({pct:.55,phase:"Pluie",always:!1,gen:function(){var w=RACE_STATE.weather||{};if(w.id!=="wet")return null;return{icon:"storm",title:" Orage localisé sur le secteur 2 !",desc:"L'ingénieur t'avertit : pluie dense sur 3 virages seulement. Le reste du circuit est juste humide.",choices:[{text:"Pit stop pour pneus full wet — sécurité totale",mod:-.014,_safe:!0,chance:{fail:.10,failMod:-.012,msg:"Pit stop lent — tu perds une place de plus."}},{text:"Continuer en inters et lever le pied dans la zone",mod:-.002},{text:"Pousser fort dans les zones sèches pour compenser",mod:.025,chance:{fail:.30,failMod:-.022,msg:"Tu pars en glisse à la sortie de la zone humide.",penalty:3}}]}}});g.push({pct:.45,phase:"Pneus",always:!1,gen:function(){var w=RACE_STATE.weather||{};if(w.id!=="hot")return null;var pneus=(G.stats&&G.stats.pneus?G.stats.pneus:50);return{icon:"hot",title:" Températures pneus critiques !",desc:"L'ingénieur radio : « Tes pneus sont à 110°C, ils vont blistérer. Décide vite. »",choices:[{text:"Lever le pied 2 tours pour les refroidir",mod:-.012,_safe:!0,chance:{fail:.10,failMod:-.008,msg:"Tes rivaux en profitent pour se rapprocher."}},{text:"Tenir le rythme et espérer qu'ils tiennent",mod:.005,chance:{fail:pneus<55?.42:.25,failMod:-.028,msg:"Pneus blisterés — tu perds gros !"}},{text:"Pousser fort maintenant avant qu'ils ne lâchent",mod:.022,chance:{fail:.38,failMod:-.030,msg:"Pneus partis — tu glisses dans tous les virages."}}]}}});g.push({pct:.6,phase:"Vent",always:!1,gen:function(){var w=RACE_STATE.weather||{};if(w.id!=="cloudy"&&w.id!=="dry"&&w.id!=="hot")return null;if(Math.random()>.5)return null;var rivBehind=_riBehind(1);var rivName=rivBehind!==null?_rn(rivBehind):null;return{icon:"cloudy",title:"Rafale latérale au virage rapide !",desc:rivName?"Un vent latéral violent attaque le virage 7. "+rivName+" est juste derrière toi.":"Un vent latéral violent attaque le virage rapide. Choix de trajectoire crucial.",choices:[{text:"Trajectoire défensive — large et sûre",mod:-.003,_safe:!0},{text:"Trajectoire idéale — apex serré",mod:.014,chance:{fail:.28,failMod:-.018,msg:"Le vent te déporte — tu touches le vibreur, écart de trajectoire."}},{text:"Plonger à la corde tôt — agressif",mod:.020,chance:{fail:.32,failMod:-.020,msg:"Tu sous-vires sous l'effet du vent — sortie large."},rival:rivBehind!==null?{idx:rivBehind,val:-.010}:null}]}}});g.push({pct:.25,phase:"Rivalité",always:!1,gen:function(){var match=_activeRivalryNearby(2);if(!match)return null;var r=match.rivalry,d=match.driver,idx=match.rivalIdx,dist=match.distance;var lastName=d.name.split(" ").pop();var isContact=r.type==="contact";var isDominance=r.type==="dominance";var ahead=dist<0;var title,desc;if(isContact){title=ahead?lastName+" — souvenir d'accrochage":lastName+" te talonne — il veut sa revanche";desc=ahead?"Tu retrouves "+lastName+", celui qui t'a accroché par le passé. Il est juste devant toi.":lastName+", avec qui tu as eu un contact, te colle aux échappements."}else if(isDominance){title=ahead?lastName+" devant toi — bête noire":lastName+" derrière — il veut t'humilier encore";desc=ahead?lastName+" te domine cette saison ("+(r.headToHead.losses||0)+" défaites). Il est à portée.":lastName+" qui te domine est dans tes échappements. La pression est forte."}else{title=ahead?"Duel attendu avec "+lastName:lastName+" te défie";desc="Une rivalité s'est créée entre vous. "+(ahead?lastName+" est juste devant.":"Il te talonne dans cette course.")}return{icon:"target",title:title,desc:desc,choices:[{text:ahead?"Attaque déterminée — montrer qui est le boss":"Défense intelligente — pas de panique",mod:.020,chance:{fail:.20,failMod:-.012,msg:ahead?"Tu te jettes trop tôt — "+lastName+" ferme la porte.":"Tu serres trop tôt — "+lastName+" en profite par l'extérieur."},rival:{idx:idx,val:-.012}},{text:"Course propre — laisser parler le talent",mod:.008,_safe:!0},{text:ahead?"Manœuvre agressive — coude à coude":"Bloquer agressivement — fermer la porte",mod:.025,chance:{fail:.35,failMod:-.020,msg:isContact?"Re-contact ! Vous vous accrochez encore — pénalité.":lastName+" ne se laisse pas faire — touchette aux roues.",penalty:isContact?5:3,dnf:!1},rival:{idx:idx,val:-.018}}],_rivalryRef:{name:r.name,team:d.team||"",type:r.type}}}});g.push({pct:.5,phase:"Rivalité",always:!1,gen:function(){var match=_activeRivalryInRace();if(!match)return null;var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});if(!p||p.dnf)return null;var d=match.driver;if(Math.abs(d.pos-p.pos)>4)return null;var r=match.rivalry,idx=match.rivalIdx;var lastName=d.name.split(" ").pop();var team=G.currentTeam||"Indépendant";var teamShort=team!=="Indépendant"?team:"l'équipe";return{icon:"phone",title:" Radio team principal",desc:"« "+(G.pilot&&G.pilot.prenom?G.pilot.prenom:"Pilote")+", "+lastName+" est dans le coin. C'est ton dossier — fais-le payer. "+teamShort+" compte sur toi pour le battre. »",choices:[{text:"« Compris, je m'en occupe »",mod:.015,chance:{fail:.18,failMod:-.010,msg:"Tu pousses trop, "+lastName+" garde son rythme."},rival:{idx:idx,val:-.008}},{text:"« Je gère, ne mets pas la pression »",mod:.005,_safe:!0},{text:"« Pas le bon moment, je gère ma course »",mod:-.002,_safe:!0,_lowTeamTrust:!0}],_rivalryRef:{name:r.name,team:d.team||"",type:r.type}}}});g.push({pct:.7,phase:"Rivalité",always:!1,gen:function(){var match=_activeRivalryNearby(1);if(!match||match.rivalry.type==="presse")return null;var r=match.rivalry,d=match.driver,idx=match.rivalIdx;var lastName=d.name.split(" ").pop();var ahead=match.distance<0;return{icon:"flag",title:ahead?"Roue contre roue — "+lastName:"Bataille décisive — "+lastName+" te suit",desc:ahead?"Tu sors d'un virage à la corde de "+lastName+", roues quasi en contact. Tu peux passer ou tout perdre.":"Bataille de fin de course avec "+lastName+". Une seule passe en double : la tienne ou la sienne.",choices:[{text:ahead?"Plonger à l'intérieur — engagement total":"Attaque le freinage — coup de poker",mod:.030,chance:{fail:.40,failMod:-.025,msg:ahead?"Touchette ! Vous partez tous les deux dans l'herbe.":"Tu bloques les roues — "+lastName+" passe.",penalty:2},rival:{idx:idx,val:-.022}},{text:ahead?"Forcer la porte au virage suivant — fermer":"Tenir la trajectoire idéale — propre",mod:.014,chance:{fail:.22,failMod:-.012,msg:lastName+" anticipe — il prend l'extérieur."},rival:{idx:idx,val:-.010}},{text:"Lever le pied — éviter le contact",mod:-.005,_safe:!0}],_rivalryRef:{name:r.name,team:d.team||"",type:r.type}}}});g.push({pct:.85,phase:"Rivalité",always:!1,gen:function(){var match=_activeRivalryNearby(2);if(!match)return null;var r=match.rivalry,d=match.driver,idx=match.rivalIdx;var lastName=d.name.split(" ").pop();if(LIVE_RACE.cur<LIVE_RACE.total*.75)return null;var ahead=match.distance<0;return{icon:"start",title:"Sprint final contre "+lastName,desc:ahead?"Derniers tours — "+lastName+" est encore devant toi. Tu peux finir devant lui pour la première fois cette saison.":lastName+" est juste derrière. Ne le laisse pas te dépasser dans les derniers tours.",choices:[{text:ahead?"All-in — tout pour le passer":"Défendre comme un lion — tout sacrifier",mod:.028,chance:{fail:.32,failMod:-.022,msg:ahead?"Tu pars en faute en attaquant — "+lastName+" t'échappe.":"Tu défends trop — "+lastName+" trouve l'ouverture.",penalty:2},rival:{idx:idx,val:-.015}},{text:ahead?"Pression progressive — l'user":"Course propre, garder l'avantage",mod:.012,chance:{fail:.18,failMod:-.008,msg:ahead?lastName+" tient son rythme — pas d'ouverture.":lastName+" reste collé."}},{text:"Course de gestion — éviter les risques",mod:.003,_safe:!0}],_rivalryRef:{name:r.name,team:d.team||"",type:r.type}}}});g.push({pct:.05,phase:"Départ",always:!0,gen:function(){var e=_ctx(),t;null===(t=1===e.pos?_riBehind(1):_riAhead(1)||_riBehind(1))&&(t=_ri());var r=_rn(t),n,a=(n=1===e.pos?o?["Bon départ ! "+r+" colle ton échappement.","Tu protèges la pole — "+r+" à droite."]:["Bon envol — "+r+" juste derrière.","Pole conservée, "+r+" tente le côté intérieur."]:e.pos<=3?o?[r+" t'écrase au virage 1 !","Embouteillage dans le premier virage."]:[r+" jaillit de la grille à ta droite.","Chaos dans les premiers virages — "+r+" est agressif."]:o?[r+" devant toi tangue au départ — une fenêtre s'ouvre !","Bon départ — tu remontes vers "+r+"."]:["Tu sors bien de la grille — "+r+" devant hésite.",r+" est lent au départ, profite-en."])[Math.floor(Math.random()*n.length)];return 1===e.pos?{icon:"[START]",title:"Départ — pole à défendre !",desc:a,choices:[{text:"Défendre la trajectoire idéale",mod:.012,rival:{idx:t,val:-.008}},{text:"Couper sur la gauche — fermer la porte",mod:.009,chance:{fail:.21,failMod:-.006,msg:"Trop tôt — "+r+" passe par l'intérieur !"}},{text:"Accélérer pur — espérer creuser l'écart",mod:.014,chance:{fail:.2,failMod:-.005,msg:"Patinage — "+r+" se rapproche."}}]}:{icon:"[START]",title:"Départ !",desc:a,choices:[{text:"Garder la ligne — protège ta position",mod:.008},{text:"Freinage tardif au virage 1 — risqué",mod:.022,chance:{fail:.26,failMod:-.008,msg:"Contact avec "+r+" ! Tu perds 3 places."},rival:{idx:t,val:-.01}},{text:"Attendre et contre-attaquer T2",mod:.005}]}}}),g.push({pct:.15,phase:"Incident",gen:function(){var e;if(_ctx().isLeader){var t=_riBehind(2)||_ri(),r=_rn(t),n=o?[r+" part en tête-à-queue loin derrière — tu gagnes une marge confortable.",r+" accroche un rail derrière — course neutralisée possible."]:[r+" part en toupie derrière — tu gagnes du temps sur tes poursuivants.",r+" sort violemment — drapeaux jaunes en secteur 2."];return{icon:"[INC]",title:"Incident derrière toi !",desc:n[Math.floor(Math.random()*n.length)],choices:[{text:"Pousser fort pendant la neutralisation possible",mod:.014,rival:{idx:t,val:-.026}},{text:"Lever le pied — respecter les drapeaux jaunes",mod:.004,rival:{idx:t,val:-.022}},{text:"Reste ton rythme — ne rien changer",mod:.008,rival:{idx:t,val:-.02}}]}}var a=_riAhead(1)||_ri(),i=_rn(a),s=o?[i+" glisse et part dans les glissières !",i+" accroche un rail — la piste est partiellement bloquée."]:[i+" part en tête-à-queue et bloque la trajectoire.",i+" sort à plat dans l'échappatoire — voiture immobile."];return{icon:"[INC]",title:"Incident devant !",desc:s[Math.floor(Math.random()*s.length)],choices:[{text:"Accélérer dans l'espace libéré",mod:.016,rival:{idx:a,val:-.028}},{text:"Prudence — rester sur la trajectoire propre",mod:.004,rival:{idx:a,val:-.02}},{text:"Couper court par l'intérieur",mod:.012,chance:{fail:.2,failMod:-.004,msg:"Pénalité pour raccourci !"}}]}}}),g.push({pct:.35,phase:"Duel",gen:function(){var e=_ctx(),t,r;e.hasBehind&&(e.isLeader||Math.random()<.6)?(t=_riBehind(1),r=!1):e.hasAhead?(t=_riAhead(1),r=!0):(t=_riBehind(1),r=!1),null===t&&(t=_ri());var n=_rn(t),a=_rnFull(t);return o?r?{icon:"[DUEL]",title:"Attaque sur "+n+" !",desc:"Tu colles "+a+" depuis 2 tours. Tu es plus rapide dans ce secteur.",choices:[{text:"Dépasser à l'épingle — plonger à l'intérieur",mod:.014,chance:{fail:.21,failMod:-.004,msg:"Contact roue à roue ! Tu perds la ligne."},rival:{idx:t,val:-.012}},{text:"Tenter l'aspiration sur la ligne droite",mod:.012,rival:{idx:t,val:-.008}},{text:"Attendre une erreur de sa part",mod:.004}]}:{icon:"[DUEL]",title:n+" dans ton dos !",desc:n+" colle ta roue arrière depuis 2 tours. Son kart semble plus rapide sur la ligne droite.",choices:[{text:"Défense à l'intérieur — fermer la porte",mod:.01,chance:{fail:.22,failMod:-.003,msg:"Contact roue à roue ! Tu perds du temps."},rival:{idx:t,val:-.012}},{text:"Couper court au freinage",mod:.014,chance:{fail:.21,failMod:-.004,msg:n+" repousse le dépassement."}},{text:"Accélérer fort sur la prochaine ligne droite",mod:.008,rival:{idx:t,val:-.006}}]}:r?{icon:"[DUEL]",title:"Tu attaques "+n+" !",desc:a+" est 0.4s devant. Tu es plus rapide sur ce secteur.",choices:[{text:"Attaque au freinage — quitte ou double",mod:.014,chance:{fail:.22,failMod:-.006,msg:"Tu passes large — "+n+" garde sa position."},rival:{idx:t,val:-.014}},{text:"Rester collé et attendre la zone DRS",mod:.01,rival:{idx:t,val:-.008}},{text:"Gérer l'aspiration pour attaquer au tour suivant",mod:.005}]}:{icon:"[DUEL]",title:n+" attaque !",desc:n+" est à 0.4s dans ton dos depuis le dernier secteur. Il est plus rapide sur ce train de pneus.",choices:[{text:"Défense agressive — changer de ligne",mod:.012,chance:{fail:.21,failMod:-.006,msg:"Pénalité 5s — changement de trajectoire irrégulier !"},rival:{idx:t,val:-.014}},{text:"Garder la ligne et pousser fort",mod:.01,rival:{idx:t,val:-.008}},{text:"Le laisser passer et sous-cuter",mod:-.005,rival:{idx:t,val:.008}}]}}}),g.push({pct:.55,phase:"Bagarre",gen:function(){var e=_ctx(),t=_riAhead2();if(!t){if(e.isLeader&&e.grid>=3){var r=[_rivalIdxAtPos(2),_rivalIdxAtPos(3)],n,a;if(null!==r[0]&&null!==r[1])return{icon:"[DUEL]",title:"Bagarre derrière toi !",desc:_rn(r[0])+" et "+_rn(r[1])+" se battent pour la P2. Tu peux te concentrer sur ton rythme.",choices:[{text:"Pousser pour creuser l'écart pendant qu'ils se gênent",mod:.015,rival:{idx:r[0],val:-.01}},{text:"Gérer les pneus — sécuriser la victoire",mod:.006},{text:"Laisser le duel se résoudre naturellement",mod:.003}]}}var i,o;return null===(i=_riAhead(1))&&(i=_riBehind(1)),null===i&&(i=_ri()),{icon:"[DUEL]",title:(o=_rn(i))+" à attaquer !",desc:"Tu as une fenêtre pour passer. Le secteur suivant se prête aux dépassements.",choices:[{text:"Attaquer immédiatement",mod:.014,chance:{fail:.21,failMod:-.005,msg:o+" repousse l'attaque."},rival:{idx:i,val:-.012}},{text:"Préparer le dépassement au tour suivant",mod:.008,rival:{idx:i,val:-.006}},{text:"Rester patient",mod:.003}]}}var i=t[0],s=t[1],o,l;return{icon:"[DUEL]",title:"Bagarre à 3 !",desc:(o=_rn(i))+" et "+_rn(s)+" se battent juste devant toi. Il y a une fenêtre.",choices:[{text:"Profiter du duel pour passer les deux",mod:.02,chance:{fail:.23,failMod:-.005,msg:"Sandwich entre les deux — tu perds du temps."},rival:{idx:i,val:-.008}},{text:"Attendre que l'un des deux sorte",mod:.006},{text:"Attaquer seulement "+o+" — l'autre est trop risqué",mod:.013,rival:{idx:i,val:-.014}}]}}}),g.push({pct:.91,phase:"Sprint final",always:!0,gen:function(){var e=_ctx();if(e.isLeader&&e.hasBehind){var t=_riBehind(1)||_ri(),r=_rn(t);return o?{icon:"[FINAL]",title:"Dernier tour — "+r+" dans ta roue !",desc:"Tu es en tête mais "+r+" ne lâche rien. Ligne droite finale.",choices:[{text:"Défense à l'intérieur — protéger les trajectoires",mod:.012,rival:{idx:t,val:-.014}},{text:"Tout donner pour creuser l'écart",mod:.014,chance:{fail:.22,failMod:-.005,msg:"Tu glisses large — "+r+" passe !"},rival:{idx:t,val:-.008}},{text:"Gérer et sécuriser la victoire",mod:.008}]}:{icon:"[FINAL]",title:"Dernier tour — victoire à portée !",desc:r+" est à 0.6s dans ton rétro. Il a le DRS. Ligne droite en approche.",choices:[{text:"Défense totale — zig-zag toléré",mod:.014,rival:{idx:t,val:-.014}},{text:"Attaquer le chrono — lui faire perdre l'aspiration",mod:.017,chance:{fail:.2,failMod:-.006,msg:"Tu bloques une roue et perds du temps — "+r+" attaque !"}},{text:"Sécuriser — gérer les pneus",mod:.008}]}}if(e.isLeader)return{icon:"[FINAL]",title:"Dernier tour — victoire en approche !",desc:"Tu es en tête et l'écart est confortable. Garde ton sang-froid.",choices:[{text:"Finir proprement — aucune prise de risque",mod:.01},{text:"Pousser pour le meilleur tour",mod:.014,chance:{fail:.2,failMod:-.008,msg:"Sortie large — tu perds quelques secondes précieuses."}},{text:"Gérer les pneus — anticiper le tour d'honneur",mod:.006}]};var n=_riAhead(1);if(null!==n){var a=_rn(n);return o?{icon:"[FINAL]",title:"Dernier tour — attaque sur "+a+" !",desc:a+" est à moins d'une longueur devant. La ligne droite des stands approche.",choices:[{text:"Plongée à l'intérieur — tout ou rien",mod:.018,chance:{fail:.21,failMod:-.004,msg:"Contact final — "+a+" garde la position !"},rival:{idx:n,val:-.014}},{text:"Tenter l'aspiration en ligne droite",mod:.012,rival:{idx:n,val:-.008}},{text:"Sécuriser ta position actuelle",mod:.005}]}:{icon:"[FINAL]",title:"Dernier tour — "+a+" à portée !",desc:a+" est à 0.6s. DRS activé. C'est maintenant ou jamais.",choices:[{text:"Attaquer "+a+" dans la ligne droite",mod:.022,chance:{fail:.21,failMod:-.006,msg:"Contact au freinage — tu glisses large !"},rival:{idx:n,val:-.016}},{text:"Forcer le passage à l'entrée du virage",mod:.018,chance:{fail:.24,failMod:-.008,msg:"Sortie large — tu perds 1 place."},rival:{idx:n,val:-.01}},{text:"Sécuriser la position actuelle",mod:.007}]}}return{icon:"[FINAL]",title:"Dernier tour",desc:"Aucun rival à portée immédiate. Tu dois juste ramener la voiture.",choices:[{text:"Pousser pour le meilleur tour",mod:.012,chance:{fail:.22,failMod:-.006,msg:"Sortie de piste — tu perds du temps pour rien."}},{text:"Gérer les pneus jusqu'au drapeau",mod:.005},{text:"Maintenir le rythme — tour propre",mod:.008}]}}}),f&&(g.push({pct:n?.18:.25,phase:"Safety Car",gen:function(){var e=_ri(),t;return{icon:"[SC]",title:"Safety Car !",desc:_rn(e)+" est immobilisé dans les graviers. La SC entre en piste.",choices:[{text:"Pit stop maintenant — pneus neufs gratuits",mod:.022,rival:{idx:e,val:-.014}},{text:"Rester en piste — garder la position",mod:.008},{text:"Attendre un tour pour les stats",mod:.014,chance:{fail:.22,failMod:-.005,msg:"La voie des stands se ferme !"}}]}}}),g.push({pct:.6,phase:"VSC",gen:function(){var e,t;return{icon:"[VSC]",title:"Virtual Safety Car",desc:_rn(_ri())+" a un problème — VSC déclenché. Fenêtre pit stop à -2s de pénalité.",choices:[{text:"Pit stop VSC — fenêtre gratuite",mod:.018},{text:"Rester en piste — tenter l'overcut",mod:.007,chance:{fail:.21,failMod:-.004,msg:"Tes pneus tombent avant la fin."}},{text:"Ne pas s'arrêter — économiser les gommes",mod:.003}]}}}),(m||s)&&(g.push({pct:.5,phase:"Pneus",gen:function(){return{icon:"[TYRE]",title:"Pneus en fin de vie",desc:'La dégradation s\'accélère. Ton mécanicien te dit : "On a 7 tours max."',choices:[{text:"Pit stop — pneus neufs maintenant",mod:.016,_doPit:true},{text:"Pousser encore 4-5 tours — risque falaise",mod:.009,chance:{fail:.3,failMod:-.009,msg:"Falaise ! Tu perds 3s au tour pendant 2 tours."}},{text:"Mode gestion — ralentir pour préserver",mod:-.005}]}}}),g.push({pct:.45,phase:"Undercut",gen:function(){var e=_ctx(),t=_riAhead(2);if(null===t){var r=_riBehind(2)||_ri(),n=_rn(r);return{icon:"[STRAT]",title:"Mur des stands — couvrir "+n+" ?",desc:n+" peut tenter un undercut derrière toi. Stratégie défensive ?",choices:[{text:"Pit stop défensif — couvrir l'undercut",mod:.014,rival:{idx:r,val:-.01}},{text:"Rester en piste — pousser pour creuser",mod:.01,chance:{fail:.21,failMod:-.005,msg:n+" ressort devant toi !"}},{text:"Suivre la stratégie initiale",mod:.003}]}}var a=_rn(t),i;return{icon:"[STRAT]",title:"Fenêtre undercut sur "+a,desc:_rnFull(t)+" va rentrer au tour prochain selon le mur des stands. Tu peux l'anticiper.",choices:[{text:"Undercut — rentrer maintenant et ressortir devant",mod:.02,rival:{idx:t,val:-.016}},{text:"Overcut — rester en piste et pousser fort",mod:.01,chance:{fail:.25,failMod:-.005,msg:a+" ressort devant toi avec des pneus neufs !"},rival:{idx:t,val:.004}},{text:"Ignorer — respecter la stratégie initiale",mod:.002}]}}})),g.push({pct:a?.25:.18,phase:"Drapeau rouge",gen:function(){var e,t=_rn(_ri()),r=a?[t+" percute les glissières de sécurité — voiture détruite. Red flag.","Gros accident dans le tunnel — drapeau rouge immédiat."]:[t+" déclenche un gros accident au virage 1. Course neutralisée.","Accrochage multiple — la piste est bloquée."];return{icon:"[RED]",title:"Drapeau rouge !",desc:r[Math.floor(Math.random()*r.length)],choices:[{text:"Changer le setup au restart",mod:.014},{text:"Analyser les données télémétriques",mod:.01},{text:"Pit stop pneus pendant l'interruption",mod:.018,chance:{fail:.2,failMod:0,msg:"Bonne décision — pneus neufs pour le restart."}}]}}}),(m||u)&&g.push({pct:.68,phase:"Carburant",gen:function(){return{icon:"[FUEL]",title:"Alerte carburant",desc:'Radio : "On est limites — si tu continues ce rythme on finit à sec." Il reste 15 tours.',choices:[{text:"Fuel save mode — lever le pied dans les lignes droites",mod:-.01},{text:"Maintenir le rythme et espérer",mod:.01,chance:{fail:.28,failMod:-.35,msg:"Panne sèche à 3 tours du but — abandon !",dnf:!0}},{text:"Pit stop pour éviter l'abandon",mod:-.006}]}}})),n&&(g.push({pct:.22,phase:"Pluie",gen:function(){return{icon:"[WET]",title:"La pluie s'intensifie !",desc:"La piste est de plus en plus glissante. Pneus pluie ou inters ?",choices:[{text:"Pneus pluie extrêmes — sécurité maximale",mod:o?.014:.02},{text:"Garder les inters et pousser",mod:.01,chance:{fail:.28,failMod:-.01,msg:"Tu aquaplanes et sors large !"}},{text:"Suivre la stratégie de l'équipe",mod:.006}]}}}),g.push({pct:.5,phase:"Séchage",gen:function(){return{icon:"[DRY]",title:"La piste sèche !",desc:"Une ligne sèche apparaît. Les slicks vont être plus rapides.",choices:[{text:"Pit stop pour les slicks immédiatement",mod:.022},{text:"Attendre que la piste soit plus sèche",mod:.008,chance:{fail:.25,failMod:-.004,msg:"Tu perds 4 secondes au tour face aux slicks !"}},{text:"Suivre le reste du peloton",mod:.005}]}}})),o&&(g.push({pct:.28,phase:"Kart adverse",gen:function(){var e=_riBehind(1),t,r;if(null===e){var n=_riAhead(1)||_ri(),a=_rn(n),i;return{icon:"[KART]",title:"Tu poursuis "+a+" !",desc:_rnFull(n)+" est juste devant. Il faut trouver la brèche.",choices:[{text:"Attaque au freinage de l'épingle",mod:.016,chance:{fail:.22,failMod:-.004,msg:a+" ferme la porte — tu perds la ligne."},rival:{idx:n,val:-.012}},{text:"Aspiration dans la ligne droite",mod:.012,rival:{idx:n,val:-.008}},{text:"Patienter — une erreur viendra",mod:.004}]}}return{icon:"[KART]",title:_rn(e)+" te colle !",desc:_rnFull(e)+" est dans ta roue depuis le début. Il teste ta défense à chaque épingle.",choices:[{text:"Défense à l'intérieur — fermer la porte",mod:.012,chance:{fail:.22,failMod:-.003,msg:"Contact roue à roue ! Tu perds du temps."},rival:{idx:e,val:-.012}},{text:"Changer de trajectoire pour couper l'aspiration",mod:.01,rival:{idx:e,val:-.006}},{text:"Pousser fort dans les chicanes — couper l'herbe",mod:.008,chance:{fail:.18,failMod:-.003,msg:"Le kart saute — tu perds du grip."}}]}}}),g.push({pct:.42,phase:"Aspiration",gen:function(){var e=_riAhead(1);if(null===e){var t=_riBehind(1)||_ri(),r=_rn(t);return{icon:"[KART]",title:r+" dans ton aspiration !",desc:r+" est à 0.2s dans ton sillage. Il va te passer dans la grande ligne droite.",choices:[{text:"Zig-zag léger pour casser l'aspiration",mod:.012,rival:{idx:t,val:-.01}},{text:"Accélérer fort dès la sortie du virage",mod:.014,chance:{fail:.21,failMod:-.004,msg:r+" a encore plus d'élan — il te passe !"}},{text:"Laisser passer pour reprendre l'aspiration",mod:-.003,rival:{idx:t,val:.008}}]}}var n=_rn(e),a;return{icon:"[KART]",title:"Aspiration sur "+n+" !",desc:_rnFull(e)+" est 0.2s devant dans la grande ligne droite. Tu prends l'aspiration.",choices:[{text:"Sortir de l'aspiration et attaquer T1",mod:.018,chance:{fail:.23,failMod:-.003,msg:n+" reprend l'aspiration sur toi."},rival:{idx:e,val:-.012}},{text:"Rester dans la bulle et attaquer au freinage",mod:.012,rival:{idx:e,val:-.008}},{text:"Conserver le rythme — attendre une meilleure occasion",mod:.003}]}}})),s&&(g.push({pct:.38,phase:"Peloton",gen:function(){var e=_ctx(),t=_riAhead(1),r,n;if(null===t)return{icon:"[DRS]",title:"Peloton dans ton rétro",desc:_rn(_riBehind(1)||_ri())+" mène un peloton à 0.8s. La course va se jouer dans les derniers tours.",choices:[{text:"Attaquer le chrono — creuser maintenant",mod:.014,chance:{fail:.22,failMod:-.005,msg:"Erreur en secteur 3 — ils reviennent !"}},{text:"Gérer ton rythme — pneus à préserver",mod:.005},{text:"Changer de trajectoire pour surprendre",mod:.009}]};var a=_rn(t);return{icon:"[DRS]",title:"Train de course — tu es coincé !",desc:"Tu es derrière "+a+" dans un train de 3 voitures. Le DRS s'ouvre mais l'écart reste tenace.",choices:[{text:"Forcer le passage par l'extérieur",mod:.016,chance:{fail:.22,failMod:-.005,msg:"Contact avec "+a+" — aile avant légèrement touchée."}},{text:"Rester patient — attendre une erreur",mod:.004},{text:"Undercut au prochain pit stop",mod:.01}]}}}),g.push({pct:.6,phase:"Mécanique",gen:function(){return{icon:"[ENG]",title:"Vibrations suspectes",desc:"Tu ressens une vibration dans le volant. Crevaison lente ou suspension ?",choices:[{text:"Pit stop immédiat — ne pas risquer",mod:-.008,_doPit:true},{text:"Tester encore 2 tours avec prudence",mod:.004,chance:{fail:.25,failMod:-.018,msg:"Crevaison ! Tu t'arrêtes en piste."}},{text:"Signaler à l'ingénieur et continuer normalement",mod:.009,chance:{fail:.2,failMod:-.012,msg:"La suspension lâche au freinage !"}}]}}})),l&&(g.push({pct:.38,phase:"DRS Train",gen:function(){var e=_ctx(),t=_riAhead(1);if(null===t){var r=_riBehind(1)||_ri(),n;return{icon:"[DRS]",title:"Train DRS derrière toi",desc:_rn(r)+" mène un train de 3 voitures à 1 seconde. Il faut créer l'écart.",choices:[{text:"Tour rapide pour décramponner",mod:.016,chance:{fail:.2,failMod:-.005,msg:"Tu fais une erreur — ils reviennent."}},{text:"Gérer les pneus — ne pas paniquer",mod:.004},{text:"Changer de mode moteur — puissance max",mod:.012,rival:{idx:r,val:-.006}}]}}var a=_rn(t);return{icon:"[DRS]",title:"Train DRS — tu es coincé !",desc:"Tu es derrière "+a+" dans un train de 4 voitures. Le DRS s'ouvre mais l'écart reste tenace.",choices:[{text:"Forcer le passage — manœuvre risquée",mod:.018,chance:{fail:.24,failMod:-.005,msg:"Contact ! Aile avant endommagée — tu rentres."}},{text:"Rester patient et espérer un VSC",mod:.001},{text:"Tenter le bord extérieur sur l'ultra-rapide",mod:.012,chance:{fail:.22,failMod:-.002,msg:a+" ferme la porte au dernier moment."}}]}}}),g.push({pct:.55,phase:"Mécanique",gen:function(){return{icon:"[ENG]",title:"Alerte moteur — Mode fiabilité",desc:'Radio ingénieur : "Température en hausse. On passe en mode 5." Perte de puissance.',choices:[{text:"Accepter le mode — finir la course",mod:-.014},{text:"Ignorer et pousser — quitte ou double",mod:.012,chance:{fail:.38,failMod:-.35,msg:"Le moteur fond. Abandon assuré.",dnf:!0}},{text:"Mode intermédiaire — compromis",mod:-.005}]}}}),g.push({pct:.28,phase:"Sprint points",gen:function(){var e=_ctx(),t,r;if(e.justOut){var n=_riAhead(1)||_ri(),a=_rn(n),i;return{icon:"[PTS]",title:"Points en jeu — "+a+" devant toi !",desc:_rnFull(n)+" est dans les points à la dernière place. Tu dois lui prendre sa position.",choices:[{text:"Attaque immédiate — DRS ouvert",mod:.018,rival:{idx:n,val:-.014}},{text:"Attendre la fin de course — il peut craquer",mod:.005},{text:"Forcer au freinage — quitte ou double",mod:.022,chance:{fail:.23,failMod:-.006,msg:"Trop large ! "+a+" garde sa position."},rival:{idx:n,val:-.008}}]}}if(e.inPoints){var o=_riBehind(1);if(null!==o){var s=_rn(o);return{icon:"[PTS]",title:"Défendre tes points — "+s+" derrière",desc:s+" menace ta place dans les points. Il faut tenir.",choices:[{text:"Défense totale — position prioritaire",mod:.012,rival:{idx:o,val:-.01}},{text:"Pousser pour creuser l'écart",mod:.014,chance:{fail:.2,failMod:-.006,msg:"Erreur — "+s+" attaque !"}},{text:"Gérer les pneus — finir proprement",mod:.007}]}}}return{icon:"[PTS]",title:"Remontée vers les points",desc:"Tu es hors des points. "+_rn(_riAhead(3)||_ri())+" et d'autres sont devant. Il faut remonter.",choices:[{text:"Attaquer chaque tour — prendre des risques",mod:.016,chance:{fail:.22,failMod:-.008,msg:"Erreur en attaquant — tu perds du temps."}},{text:"Rythme constant — espérer un abandon devant",mod:.006},{text:"Préserver la voiture pour la fin",mod:.008}]}}})),c&&(g.push({pct:.35,phase:"DRS",gen:function(){var e=_ctx(),t=_riAhead(1);if(null!==t){var r=_rn(t),n;return{icon:"[DRS]",title:"DRS activé sur "+r+" !",desc:"Zone DRS. "+_rnFull(t)+" est à 0.8s — dans le seuil. Tu te rapproches à grande vitesse.",choices:[{text:"Attaque au freinage — tout ou rien",mod:.02,chance:{fail:.21,failMod:-.005,msg:r+" fait un blocage de roue mais garde sa position."},rival:{idx:t,val:-.016}},{text:"Rester dans l'aspiration et attaquer au T2",mod:.012,rival:{idx:t,val:-.009}},{text:"Conserver le DRS pour plus tard",mod:.005}]}}var a=_riBehind(1);if(null!==a){var i=_rn(a);return{icon:"[DRS]",title:i+" a le DRS sur toi !",desc:"Zone DRS. "+i+" te suit à 0.8s. Il va te mettre la pression.",choices:[{text:"Défense agressive — casser l'aspiration",mod:.014,rival:{idx:a,val:-.012}},{text:"Tour rapide — créer l'écart dans la chicane",mod:.016,chance:{fail:.2,failMod:-.005,msg:"Blocage de roue — "+i+" revient !"}},{text:"Laisser passer et sous-cuter",mod:-.004,rival:{idx:a,val:.01}}]}}return{icon:"[DRS]",title:"Zone DRS — tour rapide",desc:"Piste dégagée. Aucun rival à portée immédiate, l'occasion d'attaquer le chrono.",choices:[{text:"Pousser à fond — viser le meilleur tour",mod:.016,chance:{fail:.22,failMod:-.006,msg:"Large à l'entrée — tu perds quelques dixièmes."}},{text:"Rythme propre — gérer les pneus",mod:.008},{text:"Tour de reconnaissance — analyser",mod:.004}]}}}),g.push({pct:.5,phase:"Stratégie",gen:function(){var e=_ri(),t=_rn(e);return{icon:"[STRAT]",title:"Stratégie 2 arrêts vs 1 arrêt",desc:"Ton ingénieur te propose de passer à 2 arrêts. "+t+" reste sur 1 arrêt. C'est un pari.",choices:[{text:"2 arrêts — attaquer fort sur chaque relais",mod:.016},{text:"1 arrêt — gérer les pneus jusqu'au bout",mod:.009,chance:{fail:.23,failMod:-.008,msg:"La falaise frappe trop tôt — les pneus s'effondrent."}},{text:"Undercut "+t+" maintenant — créer l'écart",mod:.018,rival:{idx:e,val:-.014}}]}}}),g.push({pct:.72,phase:"Équipier",gen:function(){return{icon:"[TEAM]",title:"Ordre d'équipe ambigu",desc:'Le mur te demande de "tenir ta position". Mais ton équipier est plus rapide derrière toi.',choices:[{text:"Obéir — rester en position",mod:.01},{text:"Désobéir et accélérer pour creuser l'écart",mod:.016,chance:{fail:.21,failMod:-.004,msg:"L'équipe est furieuse — ambiance glaciale au stand."}},{text:"Demander une clarification — perdre du temps",mod:.002}]}}}),g.push({pct:.42,phase:"Pneus Option",gen:function(){var e=_ri(),t=_rn(e);return{icon:"[TYRE]",title:"Pneus tendres vs durs",desc:t+" repasse en piste avec des tendres neufs. Il sera ultra-rapide sur 8 tours.",choices:[{text:"Pit stop pour les tendres aussi",mod:.018,rival:{idx:e,val:-.008}},{text:"Gérer les durs — tenir l'écart",mod:.008,chance:{fail:.26,failMod:-.01,msg:t+" te reprend 1.5s/tour — il passe comme un boulet."}},{text:"Passer aux médiums — compromis vitesse/longévité",mod:.012}]}}}),g.push({pct:.85,phase:"Championnat",gen:function(){var e=_ctx(),t=_riAhead(1)||_riBehind(1)||_ri(),r=_rn(t),n=_rnFull(t),a=LIVE_RACE&&LIVE_RACE.drivers?LIVE_RACE.drivers.find(function(e){return e.rivalIdx===t}):null,i;return a&&a.pos<e.pos?{icon:"[CHAMP]",title:"Points championnat — "+r+" devant toi !",desc:n+" est ton rival direct au championnat. Il est P"+a.pos+" — tu dois finir devant.",choices:[{text:"Tout donner pour le dépasser",mod:.022,chance:{fail:.21,failMod:-.006,msg:"Contact ! Enquête des commissaires."},rival:{idx:t,val:-.018}},{text:"Marquer les points sûrs derrière lui",mod:.008},{text:"Couper sa stratégie — rentrer en même temps",mod:.013,rival:{idx:t,val:-.01}}]}:{icon:"[CHAMP]",title:"Défendre le championnat — "+r+" te menace",desc:n+" est ton rival direct au championnat. Il te poursuit — tu dois rester devant.",choices:[{text:"Pousser pour creuser l'écart",mod:.018,chance:{fail:.22,failMod:-.005,msg:"Blocage de roue — "+r+" se rapproche !"}},{text:"Défense sans risque — gérer les pneus",mod:.01,rival:{idx:t,val:-.01}},{text:"Marquer le maximum — pousser prudemment",mod:.014,rival:{idx:t,val:-.008}}]}}})),u&&(g.push({pct:.35,phase:"Ovale",gen:function(){var e=_riAhead(1);if(null===e){var t=_riBehind(1)||_ri(),r=_rn(t);return{icon:"[OVAL]",title:"Drafting derrière toi !",desc:r+" te suit de très près — il va tenter le drafting. Ligne haute ou ligne basse ?",choices:[{text:"Ligne basse — couper l'aspiration",mod:.014,rival:{idx:t,val:-.01}},{text:"Ligne haute — prendre l'aspiration du suivant",mod:.012,chance:{fail:.22,failMod:-.005,msg:"Tu laisses la porte ouverte — "+r+" passe !"}},{text:"Push to pass défensif",mod:.016,chance:{fail:.2,failMod:-.006,msg:"Contact haut — le mur est proche !"}}]}}var n=_rn(e),a;return{icon:"[OVAL]",title:"Aspiration sur ovale — Drafting !",desc:_rnFull(e)+" est devant. Sur ovale, l'aspiration est déterminante.",choices:[{text:"Push to pass — booster et dépasser dans la haute",mod:.024,chance:{fail:.2,failMod:-.004,msg:"Il bloque — le mur de béton est proche !"},rival:{idx:e,val:-.016}},{text:"Rester en aspiration — attendre le virage 4",mod:.008},{text:"Tirer un pit stop décalé pour ressortir devant",mod:.014}]}}}),g.push({pct:.55,phase:"Yellow Flag",gen:function(){return{icon:"[YEL]",title:"Full Course Yellow",desc:"Accident sur l'ovale. FCY — fenêtre pit stop gratuite.",choices:[{text:"Pit stop FCY — stratégie agressive",mod:.02},{text:"Wave-around — rester en piste",mod:.008},{text:"Attendre et voir ce que font les leaders",mod:.005}]}}})),p&&(g.push({pct:.3,phase:"Trafic",gen:function(){var e,t=_rn(_ri());return{icon:"[TRAF]",title:"Trafic GTE Pro !",desc:"Une GTE Pro te bloque dans le secteur 2. Le pilote ne veut pas se déporter.",choices:[{text:"Prendre le risque — passer par l'extérieur",mod:.014,chance:{fail:.21,failMod:-.005,msg:"Contact avec la GTE ! Enquête en cours."}},{text:"Attendre la zone de dépassement officielle",mod:.002},{text:"Signaler au mur — faire appliquer le Blue Flag",mod:.009}]}}}),g.push({pct:.5,phase:"Relais pilote",gen:function(){return{icon:"[RELAI]",title:"Changement de pilote",desc:"Le mur te rappelle. Heure de relais. Tu peux allonger pour pousser plus fort.",choices:[{text:"Pousser fort avant le relais — attaquer les 5 derniers tours",mod:.018},{text:"Rentrer maintenant — temps de relais parfait",mod:.012},{text:"Allonger encore 3 tours — pneus à la limite",mod:.009,chance:{fail:.23,failMod:-.008,msg:"Crevaison lente — le relais coûte cher."}}]}}}),g.push({pct:.68,phase:"Sécurité",gen:function(){return{icon:"[SC]",title:"Safety Car Lemans !",desc:"Voiture en feu dans les Porsche Curves. SC — le peloton se reformattte.",choices:[{text:"Double pit stop — pneus ET carburant",mod:.02},{text:"Carburant seulement — garder les pneus",mod:.01,chance:{fail:.21,failMod:-.006,msg:"Les pneus tombent à 30 tours de la fin."}},{text:"Rester en piste — ne pas s'arrêter",mod:.005}]}}})),d&&(g.push({pct:.38,phase:"OTS SF",gen:function(){var e=_riAhead(1);if(null===e){var t=_riBehind(1)||_ri(),r=_rn(t);return{icon:"[DRS]",title:r+" active son OTS sur toi !",desc:r+" ferme l'écart à 0.5s avec l'overtake system. Il faut réagir.",choices:[{text:"Activer OTS en défense — tour rapide",mod:.016,rival:{idx:t,val:-.01}},{text:"Conserver l'OTS pour la fin — défendre sans",mod:.008,chance:{fail:.22,failMod:-.006,msg:r+" te passe dans la chicane !"}},{text:"Gérer les pneus — accepter la pression",mod:.004}]}}var n=_rn(e),a;return{icon:"[DRS]",title:"Overtake System sur "+n+" !",desc:_rnFull(e)+" est à 0.5s. Tu peux activer l'OTS (overtake system) dans la ligne droite.",choices:[{text:"Activer OTS — dépasser en ligne droite",mod:.022,chance:{fail:.22,failMod:-.003,msg:n+" active aussi son OTS — égalité !"},rival:{idx:e,val:-.014}},{text:"Conserver l'OTS pour plus tard dans la course",mod:.004},{text:"Freinage tardif — sans OTS",mod:.012,chance:{fail:.21,failMod:-.005,msg:"Trop optimiste — tu passes large."}}]}}}),g.push({pct:.55,phase:"Pneus SF",gen:function(){return{icon:"[TYRE]",title:"Pneus Yokohama en fin de vie",desc:"Les Yokohama perdent du grip. Sur ce circuit permanent japonais, c'est critique.",choices:[{text:"Pit stop — pneus neufs, attaque finale",mod:.018,_doPit:true},{text:"Gérer encore 5 tours",mod:.008,chance:{fail:.26,failMod:-.009,msg:"La falaise ! Tu perds 2 positions en 3 tours."}},{text:"Mode protection — finir proprement",mod:-.004}]}}})),g.push({pct:.62,phase:"Mécanique",gen:function(){return o?{icon:"[MECA]",title:"Problème kart !",desc:"Ton kart vibre. La chaîne semble lâche ou le carburateur dérègle.",choices:[{text:"Pousser fort — tout finir maintenant",mod:.01,chance:{fail:.3,failMod:-.35,msg:"La chaîne lâche ! Abandon.",dnf:!0}},{text:"Adapter le pilotage — ménager le matériel",mod:-.007},{text:"Pousser prudemment sur les zones propres",mod:.002}]}:{icon:"[ENG]",title:"Problème moteur",desc:"Radio : \"Alerte température huile. Qu'est-ce qu'on fait ?\"",choices:[{text:"Mode fiabilité — réduire la puissance",mod:-.012},{text:"Ignorer et pousser à fond",mod:.016,chance:{fail:.38,failMod:-.35,msg:"Le moteur explose. Abandon immédiat !",dnf:!0}},{text:"Mode intermédiaire — surveiller la température",mod:-.004}]}}}),g.push({pct:.2,phase:"Accrochage",gen:function(){var e=_ctx(),t=_riBehind(1)||_riAhead(1)||_ri(),r,n;return{icon:"[CONTACT]",title:"Contact avec "+_rn(t)+" !",desc:_rnFull(t)+" t'accroche en entrant dans le virage. Son aileron touche ta roue arrière.",choices:[{text:"Continuer et ignorer — vérifier les dommages plus tard",mod:.008,chance:{fail:.21,failMod:-.01,msg:"Crevaison lente — tu perds du temps au stand."}},{text:"Rentrer immédiatement vérifier la voiture",mod:-.01},{text:"Pousser fort — si ça résiste, tu gardes ta position",mod:.012,chance:{fail:.23,failMod:-.014,msg:"L'aile avant s'envole au prochain freinage."}}]}}}),g.push({pct:.72,phase:"Mental",gen:function(){var e=_ctx(),t=_riBehind(1),r=_riAhead(1),n;if(null!==t)return{icon:"[FOCUS]",title:"Pression croissante — concentration !",desc:"Mi-course. "+_rn(t)+" te rattrape de 0.2s/tour depuis 3 tours. Ton rythme s'essouffle.",choices:[{text:"Recaler le rythme — changer de mode moteur",mod:.014,rival:{idx:t,val:-.008}},{text:"Analyser le problème avec l'ingénieur",mod:.008},{text:"Accepter l'écart et gérer les pneus",mod:.002}]};if(null!==r){var a=_rn(r);return{icon:"[FOCUS]",title:a+" t'échappe !",desc:"Mi-course. "+a+" prend 0.2s/tour sur toi dans le secteur 2. Il faut réagir.",choices:[{text:"Monter en régime — mode attaque",mod:.014,rival:{idx:r,val:-.006}},{text:"Analyser la télémétrie — adapter la trajectoire",mod:.008},{text:"Gérer les pneus pour la fin",mod:.002}]}}return{icon:"[FOCUS]",title:"Baisse de régime",desc:"Mi-course. Ton rythme se dégrade sans cible évidente. Que fais-tu ?",choices:[{text:"Recaler — changer de mode moteur",mod:.012},{text:"Concentration pure — tour propre",mod:.008},{text:"Gérer les pneus",mod:.003}]}}}),g.push({pct:.48,phase:"Track Limits",gen:function(){return{icon:"[TL]",title:"Avertissement track limits !",desc:'Radio : "Track limits à surveiller. Encore 2 avertissements et c\'est la pénalité."',choices:[{text:"Réduire légèrement — rester dans les limites",mod:-.005},{text:"Continuer à la limite — risque pénalité",mod:.012,chance:{fail:.25,failMod:-.003,penalty:5,msg:"3e avertissement — 5 secondes de pénalité !"}},{text:"Modifier la trajectoire pour ce secteur",mod:.003}]}}}),g.push({pct:.65,phase:"Défense de tête",gen:function(){var e=_ctx();if(!e.isLeader||!e.hasBehind)return null;var t=_riBehind(1);if(null===t)return null;var r=_rn(t),n;return{icon:"[LEAD]",title:"La tête à défendre",desc:_rnFull(t)+" te reprend 0.3s au tour depuis 5 tours. L'écart fond à vue d'œil.",choices:[{text:"Tour ultra-rapide pour stabiliser l'écart",mod:.016,chance:{fail:.2,failMod:-.006,msg:"Blocage de roue — "+r+" est à 0.5s !"}},{text:"Gérer les pneus — compter sur la dégradation",mod:.008,rival:{idx:t,val:-.005}},{text:"Changer de rythme — briser sa concentration",mod:.012,rival:{idx:t,val:-.008}}]}}}),g.push({pct:.58,phase:"Isolement",gen:function(){var e=_ctx(),t=_riAhead(1),r=_riBehind(1);return null!==t||null!==r?null:{icon:"[SOLO]",title:"Course en solitaire",desc:"Personne à portée immédiate. L'ingénieur te demande si tu veux attaquer le rythme ou gérer la voiture.",choices:[{text:"Mode attaque — remonter sur le groupe devant",mod:.014,chance:{fail:.22,failMod:-.006,msg:"Blocage de roue — tu perds du temps pour rien."}},{text:"Gérer la voiture — préserver pneus et moteur",mod:.005},{text:"Tour de référence — viser le meilleur chrono personnel",mod:.01}]}}}),g.push({pct:.4,phase:"Remontée",gen:function(){var e=_ctx();if(!e.nearBottom||e.grid<6)return null;var t=_riAhead(3);if(null===t)return null;var r=_rn(t);return{icon:"[REMT]",title:"Remontée à faire",desc:"Tu es P"+e.pos+". "+r+" et d'autres sont à ta portée. La course est encore longue.",choices:[{text:"Attaque systématique — remonter tour par tour",mod:.018,chance:{fail:.23,failMod:-.008,msg:"Attaque trop optimiste — tu pars à la faute."}},{text:"Dépassements propres — patience",mod:.01,rival:{idx:t,val:-.008}},{text:"Préserver la voiture — espérer des abandons",mod:.004}]}}}),g.push({pct:.82,phase:"Dernière chance",gen:function(){var e;if(!_ctx().justOut)return null;var t=_riAhead(1);if(null===t)return null;var r=_rn(t),n;return{icon:"[PTS]",title:"Dernière chance — "+r+" devant !",desc:_rnFull(t)+" occupe la dernière place qui marque des points. Il te reste peu de tours pour lui prendre sa place.",choices:[{text:"Tout risquer — attaque au freinage",mod:.022,chance:{fail:.26,failMod:-.01,msg:"Contact ! Enquête des commissaires — pénalité probable."},rival:{idx:t,val:-.018}},{text:"Undercut déguisé — un tour ultra-rapide",mod:.014,chance:{fail:.21,failMod:-.005,msg:"Erreur en secteur 2 — "+r+" s'échappe."}},{text:"Accepter — points suivants en ligne de mire",mod:.004}]}}}),g.push({pct:.5,phase:"Radio équipe",gen:function(){var e=_ctx();if(e.isLeader)return{icon:"[RADIO]",title:"Message du mur",desc:'"Tu es en tête. Gère tes pneus, l\'écart sur le P2 est suffisant. Pas de prise de risque."',choices:[{text:"Obéir — gestion pure",mod:.006},{text:"Pousser quand même pour le meilleur tour",mod:.014,chance:{fail:.22,failMod:-.008,msg:"Blocage de roue — tu abimes les pneus pour rien."}},{text:'Négocier — "Je gère mais je veux le bonus meilleur tour"',mod:.01}]};if(e.inTop3){var t=_riAhead(1);if(null===t)return null;var r=_rn(t);return{icon:"[RADIO]",title:"Message du mur",desc:'"'+r+" devant toi est en difficulté pneus. Si tu peux pousser 3 tours, c'est dans la poche.\"",choices:[{text:"Mode attaque — 3 tours à 110%",mod:.018,chance:{fail:.2,failMod:-.007,msg:"Tu fais la faute — "+r+" respire."},rival:{idx:t,val:-.012}},{text:"Pression progressive — gérer la distance",mod:.012,rival:{idx:t,val:-.008}},{text:"Rester sage — le podium est sûr",mod:.006}]}}return e.inPoints?{icon:"[RADIO]",title:"Message du mur",desc:'"Bon rythme. On est sur une bonne trajectoire points. Continue comme ça."',choices:[{text:"Confirmer et maintenir le rythme",mod:.008},{text:"Demander si on peut pousser plus",mod:.012,chance:{fail:.2,failMod:-.006,msg:"Tu montes le régime et casses les pneus trop tôt."}},{text:"Signaler une sensation — adapter le setup",mod:.005}]}:{icon:"[RADIO]",title:"Message du mur",desc:'"On doit remonter. Pousse autant que possible sans casser la voiture."',choices:[{text:"Mode attaque total",mod:.016,chance:{fail:.21,failMod:-.008,msg:"Tu tires trop sur la mécanique — alerte."}},{text:"Rythme soutenu et propre",mod:.008},{text:"Gérer la voiture — la course est longue",mod:.004}]}}}),g.push({pct:.75,phase:"Menace",gen:function(){var e=_ctx();if(!e.isLeader||!e.hasBehind)return null;var t=_riBehind(1);if(null===t)return null;var r=_rn(t);return{icon:"[ALERT]",title:"La pression monte",desc:r+" est 0.4s plus rapide au tour. Si rien ne change, il te passera avant l'arrivée.",choices:[{text:"Pit stop agressif pour pneus tendres",mod:.018,_doPit:true,chance:{fail:.21,failMod:-.008,msg:r+" reste en piste et tu perds la tête."}},{text:"Défense aérodynamique — ralentir dans les zones DRS",mod:.012,rival:{idx:t,val:-.01}},{text:"Accepter et sécuriser la P2",mod:-.002,rival:{idx:t,val:.008}}]}}}),g.push({pct:.55,phase:"Dynamique",gen:function(){var e=_ctx(),t=LIVE_RACE&&LIVE_RACE.drivers?LIVE_RACE.drivers.find(function(e){return e.isPlayer}):null;if(!t||!t.gridPos)return null;var r=t.gridPos-e.pos;return r<3?null:{icon:"[UP]",title:"Remontée spectaculaire !",desc:"Tu as déjà gagné "+r+" places depuis la grille. Le mur te demande : continuer ou sécuriser ?",choices:[{text:"Continuer l'attaque — viser plus haut",mod:.014,chance:{fail:.22,failMod:-.006,msg:"Erreur en voulant passer trop — tu recules."}},{text:"Sécuriser la position actuelle",mod:.007},{text:"Gérer les pneus — finir proprement",mod:.005}]}}}),g.push({pct:.55,phase:"Chute",gen:function(){var e=_ctx(),t=LIVE_RACE&&LIVE_RACE.drivers?LIVE_RACE.drivers.find(function(e){return e.isPlayer}):null;if(!t||!t.gridPos)return null;var r=e.pos-t.gridPos;return r<3?null:{icon:"[DOWN]",title:"Chute au classement",desc:"Tu as perdu "+r+" places depuis la grille. Pneus, mécanique, mauvaise stratégie ? Il faut réagir.",choices:[{text:"Mode survie — finir la course",mod:-.005},{text:"Pit stop immédiat — tout changer",mod:.012,_doPit:true,chance:{fail:.21,failMod:-.008,msg:"Mauvaise décision — tu perds encore 2 places."}},{text:"Radio ingénieur — analyser la voiture",mod:.008}]}}}),g.push({pct:.7,phase:"Podium",gen:function(){var e=_ctx();if(e.pos<4||e.pos>5)return null;var t=_riAhead(1);if(null===t)return null;var r=_rn(t),n;return{icon:"[POD]",title:"Podium à portée",desc:_rnFull(t)+" est P3 à 0.7s. Tu peux le chasser. Le podium est jouable.",choices:[{text:"Attaquer sans retenue",mod:.02,chance:{fail:.21,failMod:-.008,msg:"Contact au freinage — "+r+" garde sa position."},rival:{idx:t,val:-.016}},{text:"Construire l'attaque — 2 tours de préparation",mod:.013,rival:{idx:t,val:-.008}},{text:"Assurer la P4/P5 — points solides",mod:.006}]}}}),g.push({pct:.62,phase:"Coéquipier",gen:function(){var e=_ctx();if("Indépendant"===e.playerTeam||!e.playerTeam)return null;if(!LIVE_RACE||!LIVE_RACE.drivers)return null;var t=LIVE_RACE.drivers.find(function(t){return!t.isPlayer&&!t.dnf&&t.team===e.playerTeam});if(!t)return null;var r=t.pos-e.pos;if(Math.abs(r)>2)return null;var n=t.name.split(" ").pop();return r<0?{icon:"[TEAM]",title:"Ton coéquipier "+n+" devant",desc:n+" est "+Math.abs(r)+" place(s) devant toi. Ordre d'équipe ou lutte ouverte ?",choices:[{text:"Respecter l'équipe — rester derrière",mod:.008},{text:"Attaquer — la lutte est équitable",mod:.014,chance:{fail:.22,failMod:-.007,msg:"Contact avec ton propre coéquipier — l'équipe est furieuse !"},rival:{idx:t.rivalIdx,val:-.012}},{text:"Demander un swap au mur",mod:.01,chance:{fail:.28,failMod:0,msg:"Le mur refuse — tu restes derrière."}}]}:{icon:"[TEAM]",title:n+" te rattrape",desc:"Ton coéquipier "+n+" est à "+Math.abs(r)+" place(s) derrière et plus rapide. Comportement ?",choices:[{text:"Le laisser passer — stratégie équipe",mod:-.002,rival:{idx:t.rivalIdx,val:.008}},{text:"Défendre — gagner sa place mérite de se battre",mod:.012,rival:{idx:t.rivalIdx,val:-.008}},{text:"Demander des ordres au mur",mod:.005}]}}}),g.push({pct:.42,phase:"Mécanique",gen:function(){if(o&&"Karting Junior"===i)return null;var e=_ctx(),t=["Voyant moteur","Température en hausse","Vibration anormale"],r=["Une alerte rouge s'allume sur ton tableau. Le mur te demande de gérer.","Les températures grimpent, ton ingé est inquiet. Il faut lever le pied.","Tu sens une vibration inhabituelle à l'accélération. Ça peut empirer."],n=Math.floor(Math.random()*t.length);return{icon:"[ENG]",title:t[n],desc:r[n],choices:[{text:"Lever le pied — préserver le moteur",mod:-.008},{text:"Continuer prudemment — surveiller",mod:-.003,chance:{fail:.18,failMod:-.015,msg:"Le problème s'aggrave — perte de puissance."}},{text:"Ignorer et pousser — la course d'abord",mod:.006,chance:{fail:.22,failMod:-.3,msg:"Casse moteur ! Tu abandonnes.",dnf:!0}}]}}}),g.push({pct:.35,phase:"Conditions",gen:function(){if(!n)return null;var e=_ctx();return{icon:"[RAIN]",title:"Piste traîtresse",desc:"Une zone d'aquaplaning dans la courbe rapide. Plusieurs pilotes sont déjà partis.",choices:[{text:"Ralentir nettement dans la zone",mod:-.006},{text:"Passer en visant le sec — risqué",mod:.01,chance:{fail:.21,failMod:-.012,msg:"Tu touches une flaque — gros moment, tu perds du temps."}},{text:"Garder le rythme — tu connais la trajectoire",mod:.014,chance:{fail:.14,failMod:-.3,msg:"Aquaplaning total ! Tu pars dans le rail.",dnf:!0}}]}}}),g.push({pct:.55,phase:"Freinage",gen:function(){if(o)return null;var e;if(_ctx().pos>12)return null;var t=_riAhead(1),r=_riBehind(1),n=null!==t?t:r;if(null===n)return null;var a=_rn(n),i;return{icon:"[INC]",title:"Freinage limite",desc:null!==t?"Tu arrives sur "+a+" à pleine vitesse dans la zone de freinage.":a+" te pousse à freiner de plus en plus tard. Tu flirtes avec tes limites.",choices:[{text:"Freiner classique — aucun risque",mod:.002},{text:"Freiner tardivement — gagner du temps",mod:.012,chance:{fail:.22,failMod:-.015,msg:"Tu bloques les roues — tu perds la place."}},{text:"Freinage ultra-tardif — tout ou rien",mod:.02,chance:{fail:.18,failMod:-.3,msg:"Tu pars tout droit dans le bac à graviers ! Course terminée.",dnf:!0}}]}}}),g.push({pct:.68,phase:"Accrochage",gen:function(){var e=_ctx(),t=_riAhead(1)||_riBehind(1),r;return null===t?null:{icon:"[INC]",title:"Duel très serré",desc:"Tu es roue dans roue avec "+_rn(t)+" depuis trois tours. L'un des deux va devoir céder.",choices:[{text:"Céder pour éviter le contact",mod:-.004,rival:{idx:t,val:.008}},{text:"Tenir bon, côte-à-côte",mod:.008,chance:{fail:.23,failMod:-.014,msg:"Contact léger — tu perds ton aileron avant."}},{text:"Forcer le passage — il va bien céder",mod:.015,chance:{fail:.2,failMod:-.3,msg:"Collision violente ! Suspension cassée, tu abandonnes.",dnf:!0},rival:{idx:t,val:-.02}}]}}}),g.push({pct:.58,phase:"Pneus",gen:function(){if(!m)return null;var e=_ctx();return{icon:"[TYRE]",title:"Pneus à la limite",desc:"Tes pneus arrière tirent la langue. Le graining est visible. Décision critique.",choices:[{text:"Gérer doucement — finir la course",mod:-.006},{text:"Continuer à attaquer — ils tiendront",mod:.01,chance:{fail:.21,failMod:-.02,msg:"Chute brutale du grip — tu perds plusieurs positions."}},{text:"Tout donner sur 5 tours",mod:.018,chance:{fail:.15,failMod:-.3,msg:"Crevaison lente puis éclatement — abandon.",dnf:!0}}]}}}),g.push({pct:.04,phase:"Départ",gen:function(){return o||_ctx().pos>8?null:{icon:"[START]",title:"Feux rouges qui s'éteignent",desc:"Ton pied sur l'accélérateur frémit. Tu peux anticiper légèrement pour gagner quelques mètres.",choices:[{text:"Attendre l'extinction — départ propre",mod:.002},{text:"Anticiper légèrement — risque jump start",mod:.014,chance:{fail:.23,failMod:-.005,penalty:5,msg:"Jump start détecté par le capteur — 5s de pénalité !"}}]};var e}}),g.push({pct:.5,phase:"Stands",gen:function(){if(o)return null;if(!f)return null;var e=_ctx();return{icon:"[PIT]",title:"Entrée aux stands",desc:"Tu approches de la voie des stands. Le limiteur de vitesse est activable, mais chaque dixième compte.",choices:[{text:"Respecter la limite — aucun risque",mod:.001},{text:"Entrer un peu vite — gagner 0.5s",mod:.008,chance:{fail:.21,failMod:-.003,penalty:5,msg:"Vitesse dans la pit lane dépassée — 5s de pénalité !"}},{text:"Freinage agressif à la dernière seconde",mod:.012,chance:{fail:.28,failMod:-.004,penalty:10,msg:"Vitesse largement dépassée — 10s de pénalité !"}}]}}}),g.push({pct:.72,phase:"Accrochage",gen:function(){if(o)return null;var e=_ctx(),t=_riAhead(1),r=_riBehind(1),n=null!==t?t:r;if(null===n)return null;var a=_rn(n),i=null!==t;return{icon:"[INC]",title:i?"Dépassement sous DRS":"Défense agressive",desc:i?a+" défend fort à l'intérieur. La trajectoire est serrée, mais tu es plus rapide.":a+" te talonne. Tu peux changer de trajectoire plusieurs fois pour compliquer son dépassement.",choices:[{text:"Jouer propre — pas de risque",mod:.002},{text:"Forcer le passage — la porte est ouverte",mod:.015,chance:{fail:.23,failMod:-.006,penalty:5,msg:"Les commissaires te reprochent un dépassement hors piste — 5s !"},rival:{idx:n,val:-.01}},{text:"Pousser le rival hors trajectoire",mod:.018,chance:{fail:.33,failMod:-.008,penalty:10,msg:"Manœuvre jugée dangereuse — 10s de pénalité !"},rival:{idx:n,val:-.015}}]}}});// ── Variables circuit enrichies ─────────────────────
var _cd=t,_isNight=_cd.nightRace===true,_specialTrait=_cd.specialTrait||"",_streetWalls=_cd.streetWalls||2,_overtakeQ=_cd.overtakeQ||5,_downforce=_cd.downforce||5,_altitude=_cd.altitude||0,_bumps=_cd.bumpsFactor||4,_microClimate=!!_cd.microClimate,_neckLoad=_cd.neckLoad||5,_prestige=_cd.prestige||5,_tyreDeg=_cd.tyreDeg||5;
// ══ Events spécifiques circuits ══════════════════════════════════════════
// nuit
if(_isNight){g.push({pct:.52,phase:"Nuit",gen:function(){
  var rv=LIVE_RACE.drivers.filter(function(d){return!d.isPlayer&&!d.dnf&&d.pos!=null})[0];
  var rn=rv?(rv.name||"").split(" ").pop():"ton rival";
  return{icon:"🌙",title:"Visibilité réduite",
    desc:"Les projecteurs changent les références visuelles au freinage. "+rn+" te surprend.",
    choices:[
      {label:"Adapter le point de freinage",score:60,action:"gestion",
       outcomes:{brillant:"Adaptation parfaite.",succes:"Légère perte mais tu restes devant.",echec:rn+" passe profitant de ton hésitation."}},
      {label:"Maintenir le freinage habituel",score:45,action:"attaque",
       outcomes:{brillant:"Ton expérience nocturne paie.",succes:"Ça passe, serré.",echec:"Blocage des roues. "+rn+" passe."}}
    ]};}})}
// micro-climat
if(_microClimate&&!n){g.push({pct:.42,phase:"Micro-climat",gen:function(){
  if(LIVE_RACE._weatherChanged)return null;
  return{icon:"⛈",title:"Changement météo imprévisible",
    desc:"Un nuage noir apparaît soudainement. La pluie frappe le secteur 2 dans 2 tours. Decision rapide.",
    choices:[
      {label:"Rentrer immédiatement (intermédiaires)",score:55,action:"gestion",
       outcomes:{brillant:"Timing parfait. +3 positions.",succes:"Bonne décision. Légère perte au sortir.",echec:"La pluie reste localisée. Perte inutile."}},
      {label:"Rester et observer",score:50,action:"adaptation",
       outcomes:{brillant:"La pluie ne vient pas. Tu gardes l'avantage.",succes:"Tu navigues entre le sec et l'humide.",echec:"La pluie s'étend. Tu rentres trop tard."}}
    ]};}})}
// altitude
if(_altitude>=15){g.push({pct:.62,phase:"Altitude",gen:function(){
  return{icon:"⛰",title:"Moteur en altitude",
    desc:"À "+Math.round(_altitude*100)+"m, la densité d'air chute. Le moteur surchauffe. Lever le pied ou prendre le risque?",
    choices:[
      {label:"Mode moteur économique",score:65,action:"gestion",
       outcomes:{brillant:"Sage. Le moteur se stabilise.",succes:"Légère perte. Aucun problème.",echec:"Les rivaux comblent leur retard."}},
      {label:"Ignorer et maintenir le rythme",score:40,action:"attaque",
       outcomes:{brillant:"Le moteur tient. Caractère.",succes:"De justesse.",echec:"DNF moteur."}}
    ]};}})}
// bumps
if(_bumps>=8){g.push({pct:.55,phase:"Bosses",gen:function(){
  return{icon:"💥",title:"Fond plat endommagé",
    desc:"Une bosse sévère — tu as touché le sol violemment. Bruit suspect sous la voiture.",
    choices:[
      {label:"Rentrer vérifier",score:60,action:"gestion",
       outcomes:{brillant:"Sage. Pièce sur le point de lâcher.",succes:"Rien de grave. Temps perdu.",echec:"Perte de 3 positions à l'arrêt."}},
      {label:"Continuer et surveiller",score:50,action:"attaque",
       outcomes:{brillant:"Le bruit disparaît.",succes:"Vibrations légères.",echec:"La pièce lâche. Arrêt urgent."}}
    ]};}})}
// neckLoad
if(_neckLoad>=8){g.push({pct:.70,phase:"Fatigue nuque",gen:function(){
  if(LIVE_RACE.cur/LIVE_RACE.total<0.5)return null;
  return{icon:"💪",title:"Douleur cervicale",
    desc:"Les G-forces accumulées se font sentir. Précision de pilotage en baisse.",
    choices:[
      {label:"Gérer la douleur",score:55,action:"gestion",
       outcomes:{brillant:"Tu puises dans tes ressources.",succes:"Quelques dixièmes perdus.",echec:"2 positions perdues en fin de course."}},
      {label:"Attaquer malgré la fatigue",score:45,action:"attaque",
       outcomes:{brillant:"Exploit mental.",succes:"Tu tiens.",echec:"Erreur liée à la fatigue. Contact."}}
    ]};}})}
// streetWalls
if(_streetWalls>=9){g.push({pct:.38,phase:"Duel urbain",gen:function(){
  var rv=LIVE_RACE.drivers.filter(function(d){return!d.isPlayer&&!d.dnf&&d.pos!=null}).find(function(d){
    var pp=LIVE_RACE.drivers.find(function(x){return x.isPlayer});
    return pp&&Math.abs((d.pos||99)-(pp.pos||1))===1;
  });
  var rn=rv?(rv.name||"").split(" ").pop():"ton rival";
  return{icon:"🏗",title:"Murs à portée de main",
    desc:rn+" tente une manœuvre dans un virage ultra-serré. Les murs sont partout.",
    choices:[
      {label:"Laisser l'espace, défendre à la sortie",score:65,action:"defense",
       outcomes:{brillant:"Parfait. Tu reprends la position à la sortie.",succes:""+rn+" passe mais tu restes en piste.",echec:""+rn+" creuse l'écart."}},
      {label:"Tenir la trajectoire coûte que coûte",score:40,action:"attaque",
       outcomes:{brillant:"Tu forces le passage.",succes:"Contact léger, les deux continuent.",echec:"Contact violent. Dommage + pénalité possible."}}
    ]};}})}
// prestige
if(_prestige>=9&&!c){g.push({pct:.22,phase:"Grand moment",gen:function(){
  if((LIVE_RACE.cur||1)>3)return null;
  return{icon:"📺",title:"Tous les yeux sont sur toi",
    desc:"Ce circuit est légendaire. Les directeurs sportifs regardent. Cette course peut transformer ta carrière.",
    choices:[
      {label:"Rester concentré — ignorer la pression",score:60,action:"gestion",
       outcomes:{brillant:"Parfait équilibre. La pression devient du carburant.",succes:"Tu gères bien.",echec:"Légère faute de concentration."}},
      {label:"Attaquer — montrer ce dont tu es capable",score:55,action:"attaque",
       outcomes:{brillant:"Spectaculaire. Les scouts sont séduits.",succes:"Tu gères le risque.",echec:"Trop envie de briller. Erreur visible."}}
    ]};}})}

// ── Traits spéciaux ──────────────────────────────────────────────────────
if(_specialTrait==="temple_of_speed"){g.push({pct:.38,phase:"Slipstream Monza",gen:function(){
  var rv=LIVE_RACE.drivers.filter(function(d){return!d.isPlayer&&!d.dnf&&(d.pos||99)<((LIVE_RACE.drivers.find(function(x){return x.isPlayer})||{}).pos||1)&&(d.pos||99)>=((LIVE_RACE.drivers.find(function(x){return x.isPlayer})||{}).pos||1)-2})[0];
  var rn=rv?(rv.name||"").split(" ").pop():"le pilote devant";
  return{icon:"💨",title:"Sillage extrême",
    desc:"À Monza, l'aspiration est dévastatrice. +25 km/h sur la longue droite. Fenêtre au T1 : 360→80km/h.",
    choices:[
      {label:"Sortir du sillage et freiner fort",score:65,action:"attaque",
       outcomes:{brillant:"Freinage parfait. Tu prends "+rn+"!",succes:"Tu passes, c'était juste.",echec:"Frein bloqué. Tu coupes la chicane — pénalité possible."}},
      {label:"Garder le sillage pour la prochaine ligne droite",score:55,action:"gestion",
       outcomes:{brillant:"Patience. Tu survoltes à la sortie de Lesmo 2.",succes:"Tu gardes l'aspiration.",echec:""+rn+" couvre la trajectoire."}}
    ]};}})}
if(_specialTrait==="qualifying_everything"){g.push({pct:.35,phase:"Monaco serré",gen:function(){
  if((LIVE_RACE.cur||1)>5)return null;
  return{icon:"🏰",title:"La seule fenêtre",
    desc:"Une petite erreur adverse au Casino. La porte s'ouvre pour 2 secondes.",
    choices:[
      {label:"Plonger au Casino",score:50,action:"attaque",
       outcomes:{brillant:"Tu saisis l'occasion. Position gagnée!",succes:"Tu passes en frôlant le mur.",echec:"Trop agressif. Contact avec la glissière."}},
      {label:"Attendre — trop risqué",score:65,action:"gestion",
       outcomes:{brillant:"Un SC plus tard te donne une vraie chance.",succes:"Pas de risque. Tu maintiens.",echec:"L'erreur adverse ne se reproduit pas. Fin de la course en ordre."}}
    ]};}})}
if(_specialTrait==="altitude_king"){g.push({pct:.45,phase:"Mexico altitude",gen:function(){
  return{icon:"🏔",title:"L'air de Mexico",
    desc:"2285m. -20% de densité d'air. Le moteur est à la limite. Mode haute altitude?",
    choices:[
      {label:"Activer le mode haute altitude",score:65,action:"gestion",
       outcomes:{brillant:"Optimisé. Tes adversaires surchauffent.",succes:"Légère perte de performance, zéro problème.",echec:"Le mode est trop conservateur."}},
      {label:"Puissance brute",score:45,action:"attaque",
       outcomes:{brillant:"Le moteur encaisse. Avantage.",succes:"De justesse.",echec:"Alerte moteur. Tu dois lever le pied."}}
    ]};}})}
if(_specialTrait==="mental_ultimate"){g.push({pct:.68,phase:"Singapour épuisement",gen:function(){
  if(LIVE_RACE.cur/LIVE_RACE.total<0.6)return null;
  return{icon:"🥵",title:"Mur de la chaleur",
    desc:"35°C + 90% humidité. Crampes qui commencent. 23 virages. Encore " + Math.round((1-LIVE_RACE.cur/LIVE_RACE.total)*LIVE_RACE.total) + " tours.",
    choices:[
      {label:"Lever le pied 2% et récupérer",score:65,action:"gestion",
       outcomes:{brillant:"Bonne gestion. Tu termines plus fort que tes rivaux épuisés.",succes:"Légère perte. Tu tiens.",echec:"Rivaux qui en profitent."}},
      {label:"Tenir le rythme coûte que coûte",score:45,action:"attaque",
       outcomes:{brillant:"Exploit physique historique.",succes:"Tu passes le mur.",echec:"Crampe. Erreur dans un mur."}}
    ]};}})}
if(_specialTrait==="eau_rouge"){g.push({pct:.35,phase:"Raidillon",gen:function(){
  var wet=n||(RACE_STATE.weather||{}).id==="damp";
  if(!wet&&Math.random()<0.5)return null;
  return{icon:"⛈",title:"Raidillon "+(wet?"sous la pluie":"bords humides"),
    desc:"Eau Rouge en aveugle. Au sommet: mur ou glisse. L'adversaire devant lève.",
    choices:[
      {label:"Lever le pied — ne pas prendre de risque",score:70,action:"gestion",
       outcomes:{brillant:"Sage. La zone est glissante.",succes:"Infime perte de temps.",echec:"Trop timide — 0.3s perdus."}},
      {label:"Plein gaz — confiance totale",score:45,action:"attaque",
       outcomes:{brillant:"Photo de la saison. Magnifique.",succes:"Frissons. Légère glisse, tu passes.",echec:"Tête-à-queue au sommet."}}
    ]};}})}
if(_specialTrait==="most_dangerous"){g.push({pct:.30,phase:"Macao danger",gen:function(){
  return{icon:"⚠",title:"Mandarin Bend",
    desc:"Les murs sont à 30cm. Un rival presse depuis le départ. Les marques de crash sont visibles.",
    choices:[
      {label:"Défendre l'intérieur",score:60,action:"defense",
       outcomes:{brillant:"Défense parfaite dans les murs.",succes:"Tu tiens l'intérieur.",echec:"Contact léger avec le mur."}},
      {label:"Forcer l'extérieur",score:40,action:"attaque",
       outcomes:{brillant:"Tu ouvres et refermes la porte.",succes:"Passage risqué mais devant.",echec:"Contact violent. DNF probable."}}
    ]};}})}
if(_specialTrait==="greatest_race"){g.push({pct:.40,phase:"Draft Indy",gen:function(){
  var rv=LIVE_RACE.drivers.filter(function(d){return!d.isPlayer&&!d.dnf&&(d.pos||99)<=3})[0];
  var rn=rv?(rv.name||"").split(" ").pop():"le leader";
  return{icon:"🏎",title:"Draft à Indianapolis",
    desc:"370 km/h. Tu es dans le sillage de "+rn+". 4 voitures derrière toi. C'est maintenant.",
    choices:[
      {label:"Sortir du draft et attaquer",score:50,action:"attaque",
       outcomes:{brillant:"Parfaitement chronométré. Tu prends "+rn+"!",succes:"Tu passes mais le groupe de derrière contre.",echec:"Sans draft tu perds 15 km/h."}},
      {label:"Rester dans le train et attendre",score:65,action:"gestion",
       outcomes:{brillant:"Patience. Tu attaques au bon moment: +2 positions.",succes:"Tu économises les pneus.",echec:"Le train se désorganise."}}
    ]};}})}
if(_specialTrait==="greatest_endurance"&&_isNight){g.push({pct:.50,phase:"Nuit Le Mans",gen:function(){
  return{icon:"🌙",title:"3h du matin sur la Hunaudières",
    desc:"Phares. 150m devant soi. Un LMP2 te double à 330 km/h dans l'obscurité totale.",
    choices:[
      {label:"Gérer l'aveuglage et tenir le rythme",score:60,action:"gestion",
       outcomes:{brillant:"Parfait. Tu gardes le rythme nocturne.",succes:"Légère perte de repères.",echec:"Mauvais freinage dans le noir."}},
      {label:"Ralentir légèrement — fiabilité d'abord",score:65,action:"gestion",
       outcomes:{brillant:"Sage. Ton équipe t'approuve.",succes:"2-3s perdues mais gestion impeccable.",echec:"Un rival GTE te passe."}}
    ]};}})}
if(_specialTrait==="roughest_track"){g.push({pct:.40,phase:"Vibrations Sebring",gen:function(){
  return{icon:"💢",title:"L'asphalte de Sebring",
    desc:"Le plus bosselé du monde (tarmac d'aéroport WWII). Anomalie sur les jauges suspension.",
    choices:[
      {label:"Ralentir dans les zones bosselées",score:65,action:"gestion",
       outcomes:{brillant:"Pièces intactes.",succes:"Légère perte. Rien de cassé.",echec:"Un rival reprend 4s."}},
      {label:"Passer en force",score:45,action:"attaque",
       outcomes:{brillant:"Réglages au top.",succes:"La voiture résiste.",echec:"Suspension cassée. Arrêt urgent."}}
    ]};}})}
if(_specialTrait==="chaos_circuit"){g.push({pct:.42,phase:"Vieille ville Baku",gen:function(){
  return{icon:"🏛",title:"Secteur de la vieille ville",
    desc:"5 virages à 90° après 340 km/h. Un adversaire arrive avec le mauvais freinage.",
    choices:[
      {label:"Garder l'espace, défendre proprement",score:65,action:"defense",
       outcomes:{brillant:"Défense parfaite.",succes:"Il tente mais tu refermes.",echec:"Il passe par l'intérieur."}},
      {label:"Attaque au freinage tardif",score:45,action:"attaque",
       outcomes:{brillant:"Monstre de courage.",succes:"Tu passes, contact léger avec le mur.",echec:"Le mur de la vieille ville. Dommage grave."}}
    ]};}})}
if(_specialTrait==="drama_capital"&&!n){g.push({pct:.48,phase:"Averse Interlagos",gen:function(){
  return{icon:"⛈",title:"Averse tropicale",
    desc:"Ciel couvert en 5 min. Pluie sur 3 secteurs, reste sec ailleurs. Chaos stratégique.",
    choices:[
      {label:"Aux stands maintenant (inter)",score:55,action:"gestion",
       outcomes:{brillant:"Timing parfait. +4 positions.",succes:"Bonne décision.",echec:"Pluie moins forte. -3 positions."}},
      {label:"Rester et observer",score:50,action:"adaptation",
       outcomes:{brillant:"La pluie s'arrête. Avantage.",succes:"2 tours en sec sous la pluie.",echec:"L'averse s'intensifie. Trop tard."}}
    ]};}})}
if(_specialTrait==="cold_night_glitter"){g.push({pct:.20,phase:"Pneus froids Vegas",gen:function(){
  if((LIVE_RACE.cur||1)>4)return null;
  return{icon:"🥶",title:"Pneus froids à Las Vegas",
    desc:"15°C de piste. Les pneus ne chauffent pas. Fenêtre de fonctionnement très difficile.",
    choices:[
      {label:"Faire chauffer les pneus doucement",score:65,action:"gestion",
       outcomes:{brillant:"Dès le tour 2, tes pneus sont à la fenêtre. Les autres non.",succes:"Légère perte au départ mais pneus efficaces.",echec:"Rivaux qui n'attendent pas. -2 positions."}},
      {label:"Attaquer fort dès le départ",score:40,action:"attaque",
       outcomes:{brillant:"Chance. Les pneus tiennent malgré le froid.",succes:"Quelques glissades.",echec:"Glissade + contact avec le mur du Strip."}}
    ]};}})}
if(_specialTrait==="corkscrew"){g.push({pct:.45,phase:"Le Tire-Bouchon",gen:function(){
  return{icon:"🌀",title:"La chute de 18 mètres",
    desc:"T8-T8A : chute aveugle de 18m en deux virages enchaînés. L'adversaire lève le pied à l'entrée.",
    choices:[
      {label:"Attaquer à l'intérieur en aveugle",score:50,action:"attaque",
       outcomes:{brillant:"Vision extraordinaire dans l'aveugle.",succes:"Tu prends la position en frôlant l'herbe.",echec:"Grip perdu dans le néant. Sortie de piste."}},
      {label:"Attendre la sortie du Corkscrew",score:60,action:"gestion",
       outcomes:{brillant:"Parfait. Tu attaques au freinage suivant.",succes:"L'adversaire est vulnérable à la sortie.",echec:"Il se referme à la sortie."}}
    ]};}})}
if(_specialTrait==="figure_eight"){g.push({pct:.40,phase:"Suzuka S-curves",gen:function(){
  return{icon:"∞",title:"S-curves + 130R",
    desc:"Six virages rapides enchaînés à 200+ km/h. Ton carrossage avant commence à mordre dans la 130R.",
    choices:[
      {label:"Corriger la trajectoire",score:65,action:"gestion",
       outcomes:{brillant:"Impeccable. Sans perdre d'élan.",succes:"Légère perte en bout de droite.",echec:"Adversaire gagne 0.3s."}},
      {label:"Tenir — confiance totale",score:50,action:"attaque",
       outcomes:{brillant:"G-forces extrêmes mais ton cou tient.",succes:"Instable à la sortie.",echec:"Glisse en S4. Perte de contrôle."}}
    ]};}})}
if(_specialTrait==="banked_corners"){g.push({pct:.38,phase:"Dévers Zandvoort",gen:function(){
  return{icon:"🏖",title:"Virage en dévers T3",
    desc:"Inclinaison 18°. Adhérence différente. L'adversaire arrive plus vite que prévu à l'extérieur.",
    choices:[
      {label:"Prendre l'intérieur sur le dévers",score:60,action:"attaque",
       outcomes:{brillant:"Tu exploites parfaitement l'inclinaison.",succes:"Position gagnée proprement.",echec:"Sous-virage à l'intérieur. L'adversaire passe quand même."}},
      {label:"Tenir l'extérieur — meilleure trajectoire",score:65,action:"gestion",
       outcomes:{brillant:"Vitesse de sortie supérieure. Tu gardes.",succes:"L'adversaire résiste mais tu tiens.",echec:"Il prend l'intérieur sur le dévers."}}
    ]};}})}
if(_specialTrait==="tyre_destroyer"){g.push({pct:.55,phase:"Falaise Barcelone",gen:function(){
  var pl=LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  if(pl&&pl._tyreLife!=null&&pl._tyreLife>50)return null;
  return{icon:"🔥",title:"La falaise à Barcelone",
    desc:"L'asphalte abrasif a usé tes pneus. La 'falaise' : performance qui chute drastiquement.",
    choices:[
      {label:"Rentrer maintenant",score:65,action:"gestion",
       outcomes:{brillant:"Timing parfait avant la chute.",succes:"Bonne décision.",echec:"Perte de 2 positions à l'arrêt mais pneus neufs compensent."}},
      {label:"Un tour de plus pour mieux positionner l'arrêt",score:40,action:"gestion",
       outcomes:{brillant:"Le tour extra permet un undercut parfait.",succes:"Les pneus tiennent encore un tour.",echec:"La falaise. -2.5s/tour. Tout le peloton passe."}}
    ]};}})}
if(_specialTrait==="neck_destroyer"){g.push({pct:.45,phase:"Maggotts Becketts",gen:function(){
  if(LIVE_RACE.cur/LIVE_RACE.total<0.5)return null;
  return{icon:"💪",title:"G-forces de Silverstone",
    desc:"Maggotts-Becketts-Chapel — 12s de G-forces constantes. Ton cou souffre. -0.1s dans chaque passage.",
    choices:[
      {label:"Ajuster le grip pour compenser",score:60,action:"adaptation",
       outcomes:{brillant:"Bonne adaptation. Tu retrouves ta fluidité.",succes:"La douleur reste mais c'est gérable.",echec:"Difficile de s'adapter en course."}},
      {label:"Attaquer pour construire un matelas",score:50,action:"attaque",
       outcomes:{brillant:"Tu construis de l'avance avant que ça empire.",succes:"Tu gères la douleur dans le feu de l'action.",echec:"Trop agressif fatigue encore plus le cou."}}
    ]};}})}
if(_specialTrait==="rubber_buildup"){g.push({pct:.30,phase:"Caoutchouc Budapest",gen:function(){
  if((LIVE_RACE.cur||1)>3)return null;
  return{icon:"🟡",title:"Piste qui caoutchoute",
    desc:"Budapest absorbe le caoutchouc. Sur la trajectoire: du grip. Au-dehors: du savon.",
    choices:[
      {label:"Rester strictement sur la ligne",score:65,action:"gestion",
       outcomes:{brillant:"Tu exploites le grip de la trajectoire.",succes:"Bonne décision.",echec:"L'adversaire te sort de la trajectoire au freinage."}},
      {label:"Surprendre par le hors-ligne",score:45,action:"attaque",
       outcomes:{brillant:"Tu surprends tout le monde.",succes:"Ça passe, c'est glissant.",echec:"Hors-ligne = glace. Sous-virage sévère."}}
    ]};}})}
if(_specialTrait==="mountain_wind"){g.push({pct:.38,phase:"Vent alpin",gen:function(){
  return{icon:"💨",title:"Bourrasque en montagne",
    desc:"À 700m dans les Alpes. Bourrasque latérale inattendue. L'adversaire devant glisse.",
    choices:[
      {label:"Attaquer dans la bourrasque",score:55,action:"attaque",
       outcomes:{brillant:"Tu saisis l'instant parfaitement.",succes:"Tu prends la position malgré le vent.",echec:"Le vent te frappe aussi. Tu glisses."}}
      ,{label:"Attendre que le vent se calme",score:65,action:"gestion",
       outcomes:{brillant:"Au prochain tour, le vent t'aide.",succes:"Tu maintiens sans risque.",echec:"L'adversaire récupère vite."}}
    ]};}})}
if(_specialTrait==="oval_banking"||_specialTrait==="short_oval"||_specialTrait==="oval_short"){g.push({pct:.55,phase:"Contact ovale",gen:function(){
  var rv=LIVE_RACE.drivers.filter(function(d){return!d.isPlayer&&!d.dnf&&(d.pos||99)<=3})[0];
  var rn=rv?(rv.name||"").split(" ").pop():"le leader";
  return{icon:"🔄",title:"Contact dans le virage banké",
    desc:""+rn+" perd le contrôle à 350 km/h. Contact. Tout peut partir.",
    choices:[
      {label:"Lever le pied — évaluer les dégâts",score:65,action:"gestion",
       outcomes:{brillant:"Voiture intacte.",succes:"Léger dommage aéro.",echec:""+rn+" récupère et repasse."}},
      {label:"Plein gaz — tenir la trajectoire",score:45,action:"attaque",
       outcomes:{brillant:"Tu absorbes et continues.",succes:"Adrénaline. Les deux s'en sortent.",echec:"Le contact aggrave tout. Mur SAFER."}}
    ]};}})}
if(_specialTrait==="desert_night"||_specialTrait==="desert_kart_night"){g.push({pct:.25,phase:"Sable Bahrain",gen:function(){
  if((LIVE_RACE.cur||1)>2)return null;
  return{icon:"🏜",title:"Sable sur la piste",
    desc:"Vent du désert. Sable dans le secteur 3. La piste est légèrement granuleuse.",
    choices:[
      {label:"Lever le pied dans la zone sableuse",score:65,action:"gestion",
       outcomes:{brillant:"Tu identifies la zone exacte.",succes:"Légère perte. Sans incident.",echec:"Tes rivaux passent dans le sable aussi."}},
      {label:"Maintenir le rythme — sable dilué",score:50,action:"attaque",
       outcomes:{brillant:"En fait peu dense. Avantage conservé.",succes:"Légère glisse.",echec:"Le sable bouche l'aéro avant."}}
    ]};}})}
if(_specialTrait==="high_speed_walls"){g.push({pct:.42,phase:"Murs Jeddah",gen:function(){
  return{icon:"🚧",title:"Murs à 300 km/h",
    desc:"310 km/h en ligne droite + murs à 50cm. Un adversaire te presse dans la section rapide.",
    choices:[
      {label:"Bloquer l'intérieur",score:60,action:"defense",
       outcomes:{brillant:"Défense parfaite dans les murs.",succes:"Tu le tiens.",echec:"Il prend l'extérieur."}},
      {label:"Accélérer pour creuser l'écart",score:55,action:"attaque",
       outcomes:{brillant:"+0.5s en une section.",succes:"Petit écart créé.",echec:"Il a l'aspiration jusqu'à la prochaine courbe."}}
    ]};}})}
if(_specialTrait==="season_opener"){g.push({pct:.20,phase:"Piste froide Melbourne",gen:function(){
  if((LIVE_RACE.cur||1)>3)return null;
  return{icon:"🌡",title:"Grip zéro au départ",
    desc:"Premier GP de la saison à Melbourne. Piste non caoutchoutée. Grip = quasi rien. Tout le monde cherche ses marques.",
    choices:[
      {label:"Rester à l'écart — laisser les autres se tester",score:65,action:"gestion",
       outcomes:{brillant:"Sage. Un rival glisse, tu évites l'incident.",succes:"Tu maintiens ta position proprement.",echec:"Trop conservateur. -1 position."}},
      {label:"Attaquer immédiatement les opportunités",score:50,action:"attaque",
       outcomes:{brillant:"Tu profites du chaos de début de saison.",succes:"Tu prends une position malgré le risque.",echec:"Glissade sur piste froide. Contact."}}
    ]};}})}
if(_specialTrait==="tropical_heat"){g.push({pct:.30,phase:"Chaleur Miami",gen:function(){
  if((LIVE_RACE.cur||1)>4)return null;
  return{icon:"☀",title:"Asphalte de parking",
    desc:"Miami : l'asphalte de parking ne permet pas de caoutchouter normalement. Grip très bas en début de course.",
    choices:[
      {label:"Gestion thermique — rouler propre",score:65,action:"gestion",
       outcomes:{brillant:"En fin de tour 3, tes pneus sont à la fenêtre.",succes:"Bon résultat.",echec:"Un rival sur la trajectoire plus caoutchoutée te devance."}},
      {label:"Pousser fort pour créer une avance",score:45,action:"attaque",
       outcomes:{brillant:"Tu impostes ton rythme avant que les pneus chauds arrivent.",succes:"Légères glissades mais tu tiens.",echec:"Pneus froids + asphalte froid = sortie de piste."}}
    ]};}})}
// ── Fin events circuit ──────────────────────────────
var h=[],v=[],x=.11,y=g.filter(function(e){return e.always}),b=g.filter(function(e){return!e.always});y.forEach(function(t){var r=t.pct+.04*(Math.random()-.5);r=Math.min(.97,Math.max(.02,r)),v.push(r),h.push({lap:Math.round(r*e),gen:t.gen,phase:t.phase})}),b.sort(function(){return Math.random()-.5});var A=Math.min(b.length,4+Math.floor(4*Math.random()));return b.forEach(function(t){if(!(h.length-y.length>=A||Math.random()>.78)){var r=t.pct+.1*(Math.random()-.5),n;r=Math.min(.95,Math.max(.06,r)),v.some(function(e){return Math.abs(e-r)<x})||(v.push(r),h.push({lap:Math.round(r*e),gen:t.gen,phase:t.phase}))}}),h.sort(function(e,t){return e.lap-t.lap}),h}function _rn(e){if(!G.rivals.length)return"Un rival";var t=void 0!==e?e:Math.floor(Math.random()*G.rivals.length),r=G.rivals[t];if(!r)return"Un rival";var n=r.name.split(" ");return n[n.length-1]}function _rnFull(e){if(!G.rivals.length)return"Un rival";var t=void 0!==e?e:Math.floor(Math.random()*G.rivals.length),r=G.rivals[t];return r?r.name:"Un rival"}function _ri(e){var t=Math.max(1,G.rivals.length),r=Math.floor(Math.random()*t);if(void 0!==e&&t>1)for(;r===e;)r=Math.floor(Math.random()*t);return r}function _playerPos(){if(!LIVE_RACE||!LIVE_RACE.drivers||!LIVE_RACE.drivers.length)return 1;var e=LIVE_RACE.drivers.find(function(e){return e.isPlayer});return e?e.pos:1}function _gridSize(){return LIVE_RACE&&LIVE_RACE.drivers&&LIVE_RACE.drivers.length||G.rivals.length+1}function _pointsThreshold(){var e=G.cat;return"Formule 1"===e||"Formule 2"===e||"Formule 3"===e?10:"IndyCar"===e?12:"Formula Regional"===e||"Formule 4"===e?10:"Super Formula"===e?8:"Endurance WEC"===e?10:8}function _rivalIdxAtPos(e){if(!LIVE_RACE||!LIVE_RACE.drivers)return null;var t=LIVE_RACE.drivers.find(function(t){return t.pos===e&&!t.isPlayer&&!t.dnf});return t?t.rivalIdx:null}function _riAhead(e){var t=_playerPos();if(t<=1)return null;for(var r=e||1,n=[],a=Math.max(1,t-r);a<t;a++){var i=_rivalIdxAtPos(a);null!==i&&n.push(i)}return n.length?n[Math.floor(Math.random()*n.length)]:null}function _riBehind(e){var t=_playerPos(),r=_gridSize();if(t>=r)return null;for(var n=e||1,a=[],i=t+1;i<=Math.min(r,t+n);i++){var o=_rivalIdxAtPos(i);null!==o&&a.push(o)}return a.length?a[Math.floor(Math.random()*a.length)]:null}function _riAhead2(){var e=_playerPos();if(e<=2)return null;var t=_rivalIdxAtPos(e-1),r=_rivalIdxAtPos(e-2);return null===t||null===r?null:[t,r]}function _ctx(){var e=_playerPos(),t=_gridSize(),r=_pointsThreshold();return{pos:e,grid:t,isLeader:1===e,inTop3:e<=3,inPoints:e<=r,justOut:e===r+1||e===r+2,nearBottom:e>=t-3,isLast:e===t,hasAhead:e>1,hasBehind:e<t,playerTeam:G.currentTeam||"Indépendant"}}function _activeRivalryInRace(){if(!G.rivals||!LIVE_RACE||!LIVE_RACE.drivers)return null;var rivalries=getActiveRivalries?getActiveRivalries():[];if(!rivalries.length)return null;for(var i=0;i<rivalries.length;i++){var r=rivalries[i];var rivalIdx=G.rivals.findIndex(function(rv){return rv.name===r.name});if(rivalIdx<0)continue;var driver=LIVE_RACE.drivers.find(function(d){return!d.isPlayer&&!d.dnf&&d.rivalIdx===rivalIdx});if(driver)return{rivalry:r,driver:driver,rivalIdx:rivalIdx}}return null}
function _activeRivalryNearby(maxDist){if(!G.rivals||!LIVE_RACE||!LIVE_RACE.drivers)return null;var rivalries=getActiveRivalries?getActiveRivalries():[];if(!rivalries.length)return null;var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});if(!p||p.dnf)return null;var dist=maxDist||3;for(var i=0;i<rivalries.length;i++){var r=rivalries[i];var rivalIdx=G.rivals.findIndex(function(rv){return rv.name===r.name});if(rivalIdx<0)continue;var driver=LIVE_RACE.drivers.find(function(d){return!d.isPlayer&&!d.dnf&&d.rivalIdx===rivalIdx});if(!driver)continue;if(Math.abs(driver.pos-p.pos)<=dist)return{rivalry:r,driver:driver,rivalIdx:rivalIdx,distance:driver.pos-p.pos}}return null}
var TEAM_TRUST={value:50,objectives:[],history:[],weeklyChecked:{},contextual:null},PILOT_MENTAL={value:60,confidence:60,pressure:30,streakGood:0,streakBad:0,lastWinRace:-99,history:[]};function getMentalSensitivity(){var e=G.pilot&&G.pilot.trait,t=G.pilot&&G.pilot.style,r={posMult:1,negMult:1,pressureResist:1,recoveryRate:1};return"sangfroid"===e?(r.negMult=.55,r.posMult=.85,r.pressureResist=.5,r.recoveryRate=1.4):"competiteur"===e?(r.posMult=1.25,r.negMult=1.15,r.recoveryRate=1.3,r.pressureResist=1.15):"perfectionniste"===e?(r.negMult=1.35,r.posMult=.85,r.pressureResist=1.25):"intuitif"===e?(r.posMult=1.05,r.pressureResist=.9,r.recoveryRate=1.15):"instinctif"===e?(r.negMult=.85,r.posMult=1.1,r.recoveryRate=1.25):"leader"===e?(r.pressureResist=.75,r.posMult=1.05):"analyste"===e?(r.negMult=.85,r.recoveryRate=1.1):"medias"===e&&(r.posMult=1.15,r.negMult=1.1),"stratege"===t&&(r.pressureResist*=.9),"attaquant"===t&&(r.negMult*=1.05,r.posMult*=1.05),r}function changeMental(e,t){var r=getMentalSensitivity(),n=e;n*=e>0?r.posMult:r.negMult,n=Math.round(10*n)/10;var a=PILOT_MENTAL.value;if(PILOT_MENTAL.value=Math.max(5,Math.min(100,PILOT_MENTAL.value+n)),PILOT_MENTAL.confidence=Math.max(0,Math.min(100,PILOT_MENTAL.confidence+.55*n)),PILOT_MENTAL.value!==a){if(PILOT_MENTAL.history||(PILOT_MENTAL.history=[]),PILOT_MENTAL.history.push({delta:n,reason:t,value:PILOT_MENTAL.value,saison:G.saison||0,course:G.races&&G.races.length||0}),PILOT_MENTAL.history.length>50&&PILOT_MENTAL.history.shift(),a>=20&&PILOT_MENTAL.value<20&&!PILOT_MENTAL._lowWarned&&"function"==typeof pushMail){PILOT_MENTAL._lowWarned=!0;var i="function"==typeof getRelations?getRelations():null;if(i&&i.coach&&i.coach.name&&"mental"===i.coach.specialty)pushMail({from:i.coach.name,role:"team_boss",subject:"On doit se parler",body:"Je vois que ton mental est très bas en ce moment ("+Math.round(PILOT_MENTAL.value)+"/100). Appelle-moi dès que tu peux, on va travailler là-dessus. La performance vient aussi de la tête.",actions:[{label:"D'accord, je t'appelle",kind:"dismiss",responseBody:"OK, je te rappelle ce soir. Merci de veiller."}]});else if(G.agent){var o="parent"===G.agent.type,_fp=o?getFamilyParentSender():null,s;pushMail({from:o?_fp.from:G.agent.name||"Ton agent",role:o?"family":"agent",subject:"Tu ne vas pas bien",body:o?"Mon grand, je vois bien que tu n'es pas au mieux. Tu veux qu'on passe quelques jours ensemble ? Parfois il faut juste prendre l'air. Appelle-moi.":"Ton état mental m'inquiète. Un pilote qui ne va pas bien en tête ne gagne pas. Je peux t'orienter vers un préparateur mental si tu veux. Dis-moi.",actions:[{label:"Merci de ton soutien",kind:"dismiss",responseBody:"Merci. Je vais prendre du temps pour moi."}]})}}PILOT_MENTAL.value>=40&&(PILOT_MENTAL._lowWarned=!1)}}function addPressure(e){var t,r=e*getMentalSensitivity().pressureResist;PILOT_MENTAL.pressure=Math.max(0,Math.min(100,PILOT_MENTAL.pressure+r)),changeMental(.3*-r,"Pression accumulée")}function decayPressure(){var e=getMentalSensitivity(),t=4*e.recoveryRate;PILOT_MENTAL.pressure=Math.max(0,PILOT_MENTAL.pressure-t);var r,n=60-PILOT_MENTAL.value;Math.abs(n)>5&&(PILOT_MENTAL.value+=.8*Math.sign(n)*e.recoveryRate,PILOT_MENTAL.value=Math.max(0,Math.min(100,PILOT_MENTAL.value)))}function updateMentalAfterRace(e,t,r,n){var a=G.currentTeam||"Indépendant",i=!1,o,s;"Indépendant"!==a&&"function"==typeof getEffectiveTeamRating&&(i=getEffectiveTeamRating(a)>80),t?(changeMental(-8,"Abandon (DNF)"),PILOT_MENTAL.streakBad=(PILOT_MENTAL.streakBad||0)+1,PILOT_MENTAL.streakGood=0,addPressure(6)):(1===e?(changeMental(6,"Victoire"),PILOT_MENTAL.lastWinRace=G.races?G.races.length:0,PILOT_MENTAL.streakGood=(PILOT_MENTAL.streakGood||0)+1,PILOT_MENTAL.streakBad=0,PILOT_MENTAL.pressure=Math.max(0,PILOT_MENTAL.pressure-20)):e<=3?(changeMental(3,"Podium"),PILOT_MENTAL.streakGood=(PILOT_MENTAL.streakGood||0)+1,PILOT_MENTAL.streakBad=0,PILOT_MENTAL.pressure=Math.max(0,PILOT_MENTAL.pressure-8)):e<=6?(changeMental(i?0:1,"Points solides"),PILOT_MENTAL.streakBad=0):e<=10?changeMental(i?-2:0,"Dans les points"):i?(changeMental(-5,"Contre-performance"),PILOT_MENTAL.streakBad=(PILOT_MENTAL.streakBad||0)+1):changeMental(-1,"Résultat moyen"),r&&changeMental(2,"Pole position")),PILOT_MENTAL.streakGood>=3&&changeMental(1,"Série positive ("+PILOT_MENTAL.streakGood+" bons résultats)"),PILOT_MENTAL.streakBad>=3&&(changeMental(-3,"Série négative ("+PILOT_MENTAL.streakBad+" contre-perfs)"),addPressure(4)),(G.races&&G.races.length||0)-(PILOT_MENTAL.lastWinRace||-99)>8&&"Karting Junior"!==G.cat&&addPressure(2),null!=n&&(n<-20?addPressure(3):n>15&&changeMental(1,"En avance sur les objectifs"))}function getMentalRaceImpact(){var e=PILOT_MENTAL.value||60,t={scoreBonus:0,errorRiskAdd:0};return e>=85?(t.scoreBonus=.015,t.errorRiskAdd=-.01):e>=70?(t.scoreBonus=.008,t.errorRiskAdd=-.005):e>=50||(e>=30?(t.scoreBonus=-.008,t.errorRiskAdd=.008):e>=15?(t.scoreBonus=-.02,t.errorRiskAdd=.018):(t.scoreBonus=-.035,t.errorRiskAdd=.03)),PILOT_MENTAL.pressure>75&&(t.errorRiskAdd+=.008),t}function getMentalLabel(e){return e>=85?"Conquérant":e>=70?"Confiant":e>=55?"Serein":e>=40?"Neutre":e>=25?"Doute":e>=10?"Sous pression":"Brisé"}function getMentalColor(e){return e>=80?"#2DD4BF":e>=65?"#34D399":e>=45?"#F59E0B":e>=25?"#FB923C":"#EF4444"}var RIVALRY_TYPES={dominance:{label:"Dominance",desc:"Ce pilote t'a dominé plusieurs fois",color:"#EF4444",icon:"▼"},contact:{label:"Contact",desc:"Il y a eu de l'accroc entre vous",color:"#F59E0B",icon:""},rapproche:{label:"Rapprochée",desc:"Des duels serrés course après course",color:"#34D399",icon:"◉"},presse:{label:"Presse",desc:"La presse monte la rivalité en épingle",color:"#A78BFA",icon:""}};function getRivalries(){return G._rivalries||(G._rivalries=[]),G._rivalries}function findRivalry(e,t){var r;return getRivalries().find(function(r){return r.name===e&&(!t||r.active)})}function addRivalryEvent(e,t,r,n,a,i,o){var s=getRivalries(),l=findRivalry(e,!1),c={saison:G.saison,manche:i||G.races.length,myPos:n,rivalPos:a,type:r,delta:n&&a?a-n:0,note:o||""};if(l)return l.history.push(c),l.history.length>20&&(l.history=l.history.slice(-20)),l.lastSeen=G.races.length,l.active=!0,l.intensity=Math.min(5,(l.intensity||1)+1),"contact"===r&&"contact"!==l.type&&(l.type="contact"),"rapproche"!==r&&"dominance"!==r||(n<a?l.headToHead.wins=(l.headToHead.wins||0)+1:a<n&&(l.headToHead.losses=(l.headToHead.losses||0)+1)),"contact"===r&&(l.headToHead.contacts=(l.headToHead.contacts||0)+1),l;var d={id:e,name:e,team:t,type:r,intensity:1,history:[c],headToHead:{wins:"contact"!==r&&n<a?1:0,losses:"contact"!==r&&a<n?1:0,contacts:"contact"===r?1:0},active:!0,createdAt:{saison:G.saison,manche:G.races.length},lastSeen:G.races.length,cat:G.cat};if(s.push(d),"function"==typeof pushHomeToast&&pushHomeToast("Nouvelle rivalité",e+" · "+(RIVALRY_TYPES[r]?RIVALRY_TYPES[r].label:r),RIVALRY_TYPES[r]?RIVALRY_TYPES[r].color:"#F59E0B"),"function"==typeof _addFeedPost&&"function"==typeof _socialFanHandle&&Math.random()<.5){var p=(G.pilot.prenom?G.pilot.prenom+" ":"")+(G.pilot.nom||""),u=_socialFanHandle(),f;f="contact"===r?"Entre "+p+" et "+e+", ça commence à sentir le roussi. Ça va être bouillant sur les prochaines courses ":"dominance"===r?e+" domine "+p+" depuis plusieurs courses... La revanche arrive quand ?":p+" vs "+e+" ça va devenir le duel à suivre cette saison ",_addFeedPost({type:"fan",author:u.name,handle:u.handle,color:u.color,body:f})}return d}function updateRivalriesAfterRace(e,t){if(t&&Array.isArray(t)){var r=t.find(function(e){return e.isPlayer});if(r){var n=r.dnf?99:r.pos||99,a=t.filter(function(e){return!e.isPlayer}),i;a.sort(function(e,t){return(e.pos||99)-(t.pos||99)}),a.filter(function(e){return!e.dnf&&(e.pos||99)<n}).slice(-3).forEach(function(e){var t=_rivStreakAgainst(e.name,n);t>=3&&addRivalryEvent(e.name,e.team,"dominance",n,e.pos,null,"Dominance après "+t+" courses")}),G.races&&G.races.length>=2&&a.forEach(function(e){if(!e.dnf){var t=e.pos||99;if(!(Math.abs(t-n)>1)){var r,a=(G._rivPosHistory||{})[e.name]||[],i=1;a.slice(-2).forEach(function(e){Math.abs(e.rivalPos-e.myPos)<=1&&i++}),i>=2&&addRivalryEvent(e.name,e.team,"rapproche",n,t,null,t<n?"Duel serré, battu":"Duel serré, dépassé")}}}),G._rivPosHistory||(G._rivPosHistory={}),a.forEach(function(e){if(!e.dnf){var t=G._rivPosHistory;t[e.name]||(t[e.name]=[]),t[e.name].push({saison:G.saison,manche:G.races.length,myPos:n,rivalPos:e.pos||99}),t[e.name].length>10&&(t[e.name]=t[e.name].slice(-10))}}),_cooldownRivalries()}}}function _rivStreakAgainst(e,t){var r=G._rivPosHistory&&G._rivPosHistory[e];if(!r||r.length<2)return r&&r.length>=2?2:0;for(var n=0,a=r.length-1;a>=0&&r[a].rivalPos<r[a].myPos;a--)n++;return t&&r[r.length-1]&&r[r.length-1].rivalPos<t&&(n=Math.max(n,1)),n}function _cooldownRivalries(){var e=getRivalries(),t=G.races.length;e.forEach(function(e){if(e.active){if(t-e.lastSeen>=8&&(e.active=!1,e.cooldownAt=t,"function"==typeof _addFeedPost&&void 0!==SOCIAL_PRESS_ACCOUNTS&&(e.intensity||0)>=50&&Math.random()<.35)){var r=(G.pilot.prenom?G.pilot.prenom+" ":"")+(G.pilot.nom||""),n=SOCIAL_PRESS_ACCOUNTS[Math.floor(Math.random()*SOCIAL_PRESS_ACCOUNTS.length)];_addFeedPost({type:"press",author:n.name,handle:n.handle,color:n.color,body:r+" et "+e.name+" semblent avoir enterré la hache de guerre. Le duel qui a animé les derniers mois s'apaise."})}e.active&&(e.intensity||0)>90&&!e._toxicWarned&&(e._toxicWarned=!0,"function"==typeof pushMail&&G.currentTeam&&"Indépendant"!==G.currentTeam&&_hasTeamStructure()&&pushMail({from:G.currentTeam+" — Direction sportive",role:"team_boss",subject:"Ta rivalité avec "+e.name+" nous inquiète",body:"Ta rivalité avec <strong>"+e.name+"</strong> prend une tournure qui nous gêne. On voit les signaux — ça déborde hors de la piste. On en parle ensemble ? On ne veut pas que ça finisse par coûter cher sportivement ou médiatiquement.",actions:[{label:"OK, je vais me calmer",kind:"dismiss",responseBody:"Compris, je vais ramener ça sur la piste uniquement. Merci de veiller."}]}))}})}function getActiveRivalries(){return getRivalries().filter(function(e){return e.active}).sort(function(e,t){return(t.intensity||0)-(e.intensity||0)})}function getRivalryRaceImpact(e){if(!e)return{scoreBonus:0,errorRiskAdd:0};var t=findRivalry(e,!0);if(!t)return{scoreBonus:0,errorRiskAdd:0};var r,n=(PILOT_MENTAL&&PILOT_MENTAL.value||60)>=65?1:-1,a=t.intensity||1;return{scoreBonus:n*a*.003,errorRiskAdd:(n<0?1:0)*a*.002}}function renderRivalriesPage(){var e=document.getElementById("rivalries-content");if(e){var t=getRivalries(),r=t.filter(function(e){return e.active}),n=t.filter(function(e){return!e.active}),a="";a+='<div style="margin:12px 14px 0;padding:14px;background:linear-gradient(180deg, var(--bg3) 0%, var(--bg2) 100%);border:1px solid var(--border-hi);border-radius:12px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9"/></svg><div style="font-family:var(--font-display);font-size:12px;font-weight:800;color:var(--text);letter-spacing:.08em;text-transform:uppercase">Rivalités</div></div><div style="font-size:12px;color:var(--text2);line-height:1.5">Les rivalités naissent de l\'histoire. Un pilote qui te bat souvent, un accrochage, des duels serrés — chaque rivalité colore la saison et influence tes courses.</div></div>',0===r.length?a+='<div class="t-sec">Aucune rivalité active</div><div style="margin:0 14px 12px;padding:18px 16px;background:var(--surface2);border:1px dashed var(--border);border-radius:12px;text-align:center;color:var(--text3);font-size:13px">Les rivalités émergeront avec tes premières courses.</div>':(a+='<div class="t-sec">Rivalités actives · '+r.length+"</div>",a+='<div style="margin:0 14px 12px;display:flex;flex-direction:column;gap:10px">',r.forEach(function(e){a+=_renderRivalryCard(e,!0)}),a+="</div>"),n.length>0&&(a+='<div class="t-sec">Apaisées · '+n.length+"</div>",a+='<div style="margin:0 14px 12px;display:flex;flex-direction:column;gap:8px;opacity:.7">',n.slice(0,5).forEach(function(e){a+=_renderRivalryCard(e,!1)}),n.length>5&&(a+='<div style="text-align:center;font-size:11px;color:var(--text3);padding:6px">+ '+(n.length-5)+" plus anciennes</div>"),a+="</div>"),e.innerHTML=a}}function _renderRivalryCard(e,t){for(var r=RIVALRY_TYPES[e.type]||{label:e.type,desc:"",color:"#888",icon:"◆"},n=e.headToHead||{wins:0,losses:0,contacts:0},a="",i=1;i<=5;i++)a+='<span style="display:inline-block;width:5px;height:5px;border-radius:50%;margin-right:3px;background:'+(i<=(e.intensity||1)?r.color:"var(--border)")+'"></span>';var o=(e.history||[]).length,s=o>0?e.history[o-1]:null,l="";s&&(l="Saison "+s.saison+" · Manche "+s.manche,s.note&&(l+=" — "+s.note));var c=e.cat&&e.cat!==G.cat?'<span style="margin-left:6px;padding:1px 5px;background:rgba(255,255,255,0.06);border-radius:3px;font-size:9px;color:var(--text3);letter-spacing:.05em;text-transform:uppercase">'+e.cat+"</span>":"";return'<div style="padding:14px 16px;background:var(--surface2);border:1px solid '+r.color+"33;border-left:3px solid "+r.color+';border-radius:12px"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;gap:10px"><div style="min-width:0;flex:1"><div style="font-size:14px;font-weight:700;color:var(--text);display:flex;align-items:center;flex-wrap:wrap;gap:6px">'+_ppEscSafe(e.name)+c+"</div>"+(e.team?'<div style="font-size:11px;color:var(--text3);margin-top:2px">'+_ppEscSafe(e.team)+"</div>":"")+'</div><div style="flex-shrink:0;text-align:right"><span style="display:inline-flex;align-items:center;gap:4px;padding:2px 7px;background:'+r.color+"22;border:1px solid "+r.color+"55;border-radius:4px;font-family:var(--font-display);font-size:10px;font-weight:800;color:"+r.color+';letter-spacing:.06em;text-transform:uppercase"><span style="font-size:12px">'+r.icon+"</span>"+r.label+'</span><div style="margin-top:4px">'+a+'</div></div></div><div style="display:flex;gap:12px;padding:8px 0 0;border-top:1px solid var(--border);font-size:11px;color:var(--text2)"><div><strong style="color:var(--text)">'+(n.wins||0)+'</strong><span style="color:var(--text3)">devant</span></div><div><strong style="color:var(--text)">'+(n.losses||0)+'</strong><span style="color:var(--text3)">derrière</span></div>'+(n.contacts>0?'<div><strong style="color:#EF4444">'+n.contacts+'</strong><span style="color:var(--text3)">contact'+(n.contacts>1?"s":"")+"</span></div>":"")+'<div style="margin-left:auto;color:var(--text3)">'+o+" évt.</div></div>"+(l?'<div style="margin-top:6px;font-size:11px;color:var(--text3);font-style:italic">Dernier : '+_ppEscSafe(l)+"</div>":"")+"</div>"}function _ppEscSafe(e){return String(e||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function _ppEscMailBody(e){var t,r=String(e||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");return r=r.replace(/&lt;(\/?(?:strong|b|em|i|br))(\s*\/?)&gt;/gi,"<$1$2>")}function getTrustThresholds(){var e=G.cat||"Karting Junior",t=G.currentTeam||"Indépendant";if("Indépendant"===t)return null;var r=getEffectiveTeamRating?getEffectiveTeamRating(t):72,n,a={"Karting Junior":{top:{p:5,q:.55,cq:null,wins:0},mid:{p:8,q:.5,cq:null,wins:0},small:{p:12,q:.45,cq:null,wins:0}},"Karting Senior":{top:{p:4,q:.5,cq:null,wins:1},mid:{p:7,q:.45,cq:null,wins:0},small:{p:10,q:.4,cq:null,wins:0}},"Formule 4":{top:{p:4,q:.45,cq:null,wins:1},mid:{p:7,q:.42,cq:null,wins:0},small:{p:10,q:.38,cq:null,wins:0}},"Formula Regional":{top:{p:4,q:.42,cq:null,wins:2},mid:{p:6,q:.4,cq:null,wins:1},small:{p:9,q:.36,cq:null,wins:0}},"Formule 3":{top:{p:3,q:.4,cq:3,wins:2},mid:{p:5,q:.38,cq:5,wins:1},small:{p:8,q:.34,cq:null,wins:0}},"Formule 2":{top:{p:3,q:.38,cq:3,wins:3},mid:{p:5,q:.36,cq:5,wins:2},small:{p:7,q:.32,cq:3,wins:1}},"Formule 1":{top:{p:4,q:.35,cq:2,wins:4},mid:{p:7,q:.4,cq:4,wins:2},small:{p:11,q:.45,cq:6,wins:1}},"Super Formula":{top:{p:4,q:.38,cq:3,wins:2},mid:{p:6,q:.4,cq:5,wins:1},small:{p:8,q:.42,cq:null,wins:1}},"Endurance WEC":{top:{p:3,q:.38,cq:null,wins:2},mid:{p:5,q:.42,cq:null,wins:1},small:{p:8,q:.45,cq:null,wins:0}},IndyCar:{top:{p:5,q:.4,cq:4,wins:2},mid:{p:8,q:.44,cq:null,wins:1},small:{p:12,q:.48,cq:null,wins:0}}},i=a[e]||a["Karting Junior"];return i[r>80?"top":r>65?"mid":"small"]||i["mid"]}function generateSeasonObjectives(){if(!G.currentTeam||"Indépendant"===G.currentTeam)return TEAM_TRUST.objectives=[],void(TEAM_TRUST.value=50);var e=getTrustThresholds();if(e){var t=CAL_RACES&&CAL_RACES.length>0?CAL_RACES.length:10,r=[];r.push({id:"champ_pos",type:"main",done:!1,failed:!1,title:"Classement championnat",desc:"Terminer P"+e.p+" ou mieux au championnat.",target:e.p,reward:12,penalty:-18,check:function(e){return e.champPos?e.champPos<=this.target:null}});var n=Math.round(e.q*t*10);if(r.push({id:"pts_total",type:"main",done:!1,failed:!1,title:"Points au championnat",desc:"Marquer au moins "+n+" pts sur la saison.",target:n,reward:8,penalty:-10,check:function(e){return e.champPts?e.champPts>=this.target:null}}),null!==e.cq){var a=getTeammateRival(),i=a?a.name.split(" ").pop():"ton coéquipier";r.push({id:"teammate",type:"main",done:!1,failed:!1,title:"Face au coéquipier",desc:"Battre "+i+" (au moins "+e.cq+" pts d'écart).",target:e.cq,teammate:i,reward:10,penalty:-14,check:function(e){return e.teammateGap||0===e.teammateGap?e.teammateGap>=this.target:null}})}e.wins>0&&r.push({id:"wins",type:"secondary",done:!1,failed:!1,title:"Décrocher une victoire",desc:"Gagner au moins "+e.wins+" manche"+(e.wins>1?"s":"")+" dans la saison.",target:e.wins,reward:15,penalty:0,check:function(e){return e.wins?e.wins>=this.target:null}});var o=Math.max(1,Math.round(.25*t));r.push({id:"podiums",type:"secondary",done:!1,failed:!1,title:"Régularité podiums",desc:"Monter au moins "+o+" fois sur le podium.",target:o,reward:8,penalty:0,check:function(e){return e.pods?e.pods>=this.target:null}});var s="Formule 1"===G.cat||"Formule 2"===G.cat?2:3;r.push({id:"dnf_limit",type:"secondary",done:!1,failed:!1,title:"Fiabilité & concentration",desc:"Pas plus de "+s+" abandons sur la saison.",target:s,reward:6,penalty:-8,check:function(e){return void 0===e.dnfs?null:e.dnfs<=this.target}}),TEAM_TRUST.objectives=r,TEAM_TRUST.history=[],TEAM_TRUST.weeklyChecked={},TEAM_TRUST.contextual=null}else TEAM_TRUST.objectives=[]}function getRaceObjective(){try{if(!G.currentTeam||G.currentTeam==="Indépendant")return null;var racesDone=G.races?G.races.length:0;var totalRaces=CAL_RACES?CAL_RACES.length:10;var racesLeft=totalRaces-racesDone;if(racesLeft<=0)return null;var champObj=null,wins=0,podiums=0,dnfs=0;if(typeof TEAM_TRUST!=="undefined"&&TEAM_TRUST&&TEAM_TRUST.objectives){TEAM_TRUST.objectives.forEach(function(o){if(o.id==="champ_pos"){var champPosCurrent=G.champPos||99;var target=o.target;var ptsForTarget=null;if(o.failed)return;champObj={target:target,current:champPosCurrent}}else if(o.id==="wins"&&!o.failed){var current=(G.races||[]).filter(function(r){return r.pos===1}).length;wins={current:current,target:o.target}}else if(o.id==="podiums"&&!o.failed){var current=(G.races||[]).filter(function(r){return r.pos>=1&&r.pos<=3}).length;podiums={current:current,target:o.target}}else if(o.id==="dnf_limit"){var currentDnf=(G.races||[]).filter(function(r){return r.pos===0}).length;dnfs={current:currentDnf,limit:o.target}}});}var nextRace=typeof getNextRace==="function"?getNextRace():null;var raceTip="";var pressureLvl="normal";if(podiums&&podiums.current<podiums.target){var podsNeeded=podiums.target-podiums.current;if(podsNeeded>=racesLeft){raceTip="Tu DOIS faire podium aujourd'hui pour rester dans les objectifs.";pressureLvl="critical"}else if(podsNeeded>racesLeft*.5){raceTip="Un podium serait précieux pour atteindre l'objectif podiums.";pressureLvl="high"}}if(wins&&wins.current<wins.target){var winsNeeded=wins.target-wins.current;if(winsNeeded>=racesLeft){if(!raceTip)raceTip="Une victoire est cruciale aujourd'hui — il faut tout donner.";pressureLvl="critical"}else if(winsNeeded>racesLeft*.5&&pressureLvl!=="critical"){if(!raceTip)raceTip="Une victoire ferait avancer ton objectif saison.";pressureLvl="high"}}if(dnfs&&dnfs.current>=dnfs.limit&&pressureLvl!=="critical"){raceTip="Plus aucun abandon possible : sois prudent !";pressureLvl="critical"}var suggestedPos=null;if(champObj){if(champObj.current<=champObj.target){suggestedPos=Math.min(8,champObj.target+2)}else{suggestedPos=champObj.target}}else{suggestedPos=10}return{suggestedPos:suggestedPos,wins:wins,podiums:podiums,dnfs:dnfs,champObj:champObj,raceTip:raceTip,pressureLvl:pressureLvl,racesLeft:racesLeft,racesDone:racesDone,totalRaces:totalRaces}}catch(e){return null}}
function renderRaceObjective(){try{var c=document.getElementById("race-objective-banner");if(!c)return;var obj=getRaceObjective();if(!obj){c.style.display="none";return}c.style.display="block";var pressColors={normal:"#60A5FA",high:"#F59E0B",critical:"#EF4444"};var pressLabels={normal:"Course standard",high:"Pression élevée",critical:"Pression critique"};var col=pressColors[obj.pressureLvl];var lbl=pressLabels[obj.pressureLvl];var html='<div style="background:linear-gradient(135deg,'+col+'14 0%,'+col+'06 100%);border:1px solid '+col+'40;border-left:3px solid '+col+';border-radius:0 10px 10px 0;padding:12px 14px">';html+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:6px">';html+='<div style="display:flex;align-items:center;gap:8px"><span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;background:'+col+'24;color:'+col+';flex-shrink:0"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></span><span style="font-family:var(--font-display);font-size:11px;font-weight:800;color:'+col+';letter-spacing:.14em;text-transform:uppercase">Objectif course</span></div>';html+='<span style="font-family:var(--font-display);font-size:9.5px;font-weight:700;color:'+col+';background:'+col+'14;border:1px solid '+col+'40;padding:2px 8px;border-radius:4px;letter-spacing:.08em;text-transform:uppercase">'+lbl+'</span>';html+='</div>';html+='<div style="font-family:var(--font-display);font-size:14px;font-weight:800;color:var(--text);margin-bottom:4px">Vise <span style="color:'+col+'">P'+obj.suggestedPos+'</span> ou mieux</div>';html+='<div style="font-size:11.5px;color:var(--text2);line-height:1.45;margin-bottom:8px">';if(obj.raceTip){html+="<strong>"+obj.raceTip+"</strong>"}else{html+="Course "+(obj.racesDone+1)+"/"+obj.totalRaces+" — "+(obj.totalRaces-obj.racesDone-1)+" autres après celle-ci."}html+='</div>';var stats=[];if(obj.wins)stats.push({l:"Victoires",c:obj.wins.current,t:obj.wins.target,col:"#F59E0B"});if(obj.podiums)stats.push({l:"Podiums",c:obj.podiums.current,t:obj.podiums.target,col:"#FBBF24"});if(obj.dnfs)stats.push({l:"DNF",c:obj.dnfs.current,t:obj.dnfs.limit,col:obj.dnfs.current>=obj.dnfs.limit?"#EF4444":"#9CA3AF",inverted:true});if(stats.length>0){html+='<div style="display:grid;grid-template-columns:repeat('+stats.length+',1fr);gap:6px">';stats.forEach(function(s){var pctVal=s.inverted?Math.min(100,(s.c/s.t)*100):Math.min(100,(s.c/s.t)*100);html+='<div style="padding:6px 8px;background:rgba(0,0,0,0.2);border:1px solid var(--border);border-radius:6px"><div style="font-family:var(--font-display);font-size:8px;color:var(--text3);letter-spacing:.12em;margin-bottom:2px">'+s.l.toUpperCase()+'</div><div style="display:flex;align-items:baseline;gap:3px"><span style="font-family:var(--font-display);font-size:14px;font-weight:900;color:'+s.col+'">'+s.c+'</span><span style="font-size:10px;color:var(--text3)">/'+s.t+'</span></div></div>'});html+='</div>'}html+='</div>';c.innerHTML=html}catch(e){console.warn("renderRaceObjective:",e)}}
function getTeammateRival(){return G.currentTeam&&"Indépendant"!==G.currentTeam&&G.rivals.find(function(e){return e.team===G.currentTeam})||null}function _getRoleDesc(e,t){var r=getTeammateRival(),n=r&&r.name?r.name.split(" ").pop():"ton coéquipier";return"num1"===e?"Pilote de référence de l'équipe · Priorité stratégie & développement":"equal"===e?"Pas de consignes d'équipe · Rivalité ouverte avec "+n:"Apprentissage & soutien · Coéquipier : "+n}function getRivalryStatus(){var e=getTeammateRival();if(!e)return null;var t=0,r=0,n=0;G.races.forEach(function(a){e.lastPos&&void 0!==a.tmPos&&(a.pos<(a.tmPos||99)?t++:a.pos>(a.tmPos||99)?r++:n++)});var a=e.pts||0,i=G.champPts||0,o=i-a,s=G.races.length,l,c=Math.abs(o),d=s>0?c/Math.max(i,a,1):0,p={domine:{label:"Tu domines",color:"var(--green)",bg:"var(--green-bg)",icon:"▲▲"},avantage:{label:"Avantage",color:"var(--teal)",bg:"var(--teal-bg)",icon:"▲"},serree:{label:"Rivalité",color:"var(--amber)",bg:"var(--amber-bg)",icon:""},neutre:{label:"Neutre",color:"var(--muted)",bg:"rgba(255,255,255,.04)",icon:"—"},"dominé":{label:"En retrait",color:"var(--red3)",bg:"var(--red-bg)",icon:"▼"}},u=p[l=0===s?"neutre":o>0&&c>40?"domine":o>0&&c>15?"avantage":c<=15?"serree":o<0&&c>15?"dominé":"neutre"]||p.neutre;return{teammate:e,level:l,label:u.label,color:u.color,bg:u.bg,icon:u.icon,delta:o,myPts:i,tmPts:a,wins:t,losses:r,ties:n,racesDone:s}}function changeTrust(e,t,r){if(G.currentTeam&&"Indépendant"!==G.currentTeam){var n=TEAM_TRUST.value;(function(){var _racesN=(G.races?G.races.length:0);var _trustFloor=_racesN<5?5:_racesN<11?10:12;TEAM_TRUST.value=Math.max(_trustFloor,Math.min(100,TEAM_TRUST.value+e));})(),TEAM_TRUST.history||(TEAM_TRUST.history=[]),TEAM_TRUST.value!==n&&TEAM_TRUST.history.push({delta:e,reason:t||"",icon:r||(e>=0?"↑":"↓"),total:TEAM_TRUST.value,saison:G.saison,week:G.semaine})}}function checkTrustAfterRace(e,t,r){if(G.currentTeam&&"Indépendant"!==G.currentTeam){var n=getTrustThresholds();if(n){var a="num1"===G._playerRole?1.2:"equal"===G._playerRole?1:.85;var _mmTrust=typeof _getMomentum==="function"?_getMomentum():"neutral";var _mmAmp=_mmTrust==="ice"?1.5:_mmTrust==="cold"?1.25:_mmTrust==="hot"?.8:1;r?changeTrust(Math.round(-8*a*_mmAmp),"Abandon en course",""):1===e?changeTrust(Math.round(7*a),"Victoire !",""):e<=3?changeTrust(Math.round(4*a),"Podium (P"+e+")",""):e<=n.p?changeTrust(2,"Dans les objectifs (P"+e+")",""):e>n.p+5&&changeTrust(-4,"Résultat décevant (P"+e+")","↓");var i=getTeammateRival();if(i&&i.lastPos){var o=G._playerRole||"num2",s="num2"===o?5:"num1"===o?2:3,l="num1"===o?4:"equal"===o?3:2,c=i.name?i.name.split(" ").pop():"le coéquipier";if(e<i.lastPos){if(changeTrust(+s,"Devant "+c+" (P"+e+" vs P"+i.lastPos+")","↑"),"num2"===o&&(G._tm_wins_count=(G._tm_wins_count||0)+1,G._tm_wins_count>=3&&!G._roleUpgradeNotified)){var d;if(G._roleUpgradeNotified=!0,G._playerRole="equal","function"==typeof pushMail&&_hasTeamStructure())pushMail({from:(G.currentTeam||"L'écurie")+" — Direction sportive",role:"team_boss",subject:" Statut revu — rôles égaux",body:"Tes 3 derniers week-ends face à ton coéquipier nous ont convaincus. À partir de maintenant, l'écurie te traite à <strong>statut égal</strong> : mêmes ressources, même matériel, aucune consigne de priorité. À toi de jouer.",actions:[{label:"Merci pour cette confiance",kind:"dismiss",responseBody:"Merci, je ne vais pas vous décevoir. On continue de pousser."}]});if("function"==typeof _addFeedPost&&G.currentTeam&&"Indépendant"!==G.currentTeam){var p=(G.pilot.prenom?G.pilot.prenom+" ":"")+(G.pilot.nom||""),u="@"+G.currentTeam.toLowerCase().replace(/\s+/g,"").replace(/[^a-z0-9]/g,"").substr(0,14);_addFeedPost({type:"team",author:G.currentTeam,handle:u,color:"#EF4444",body:" Passage à un statut égal pour "+p+" dans notre équipe. Les performances parlent. ️"})}}}else!r&&e>i.lastPos+3&&(changeTrust(-l,"Derrière "+c+" (P"+e+" vs P"+i.lastPos+")","↓"),"num2"===o&&(G._tm_wins_count=0))}checkMilestones(),checkContextualObjective(e,r),maybeGenerateContextualObjective(),"function"==typeof checkAchievementUnlocks&&checkAchievementUnlocks()}}}function checkMilestones(){var e=G.races.length,t=CAL_RACES&&CAL_RACES.length?CAL_RACES.length:10,r;[{key:"m1",pct:.35,label:"Bilan 35%"},{key:"m2",pct:.6,label:"Bilan 60%"},{key:"m3",pct:.85,label:"Bilan 85%"}].forEach(function(r){if(!(TEAM_TRUST.weeklyChecked[r.key]||e<Math.floor(t*r.pct))){TEAM_TRUST.weeklyChecked[r.key]=!0;var n=getTrustThresholds();if(n){var a=[{pts:G.champPts,me:!0}];G.rivals.forEach(function(e){a.push({pts:e.pts,me:!1})}),a.sort(function(e,t){return t.pts-e.pts});var i=a.findIndex(function(e){return e.me})+1;if(i<=Math.ceil(.7*n.p)?changeTrust(3,r.label+" — en avance sur les objectifs",""):i<=n.p?changeTrust(1,r.label+" — dans les objectifs",""):i<=n.p+3?changeTrust(-3,r.label+" — légèrement en retard",""):changeTrust(-7,r.label+" — très en retard sur les objectifs",""),"m2"===r.key&&"function"==typeof _addFeedPost&&void 0!==SOCIAL_PRESS_ACCOUNTS&&Math.random()<.6){var o=(G.pilot.prenom?G.pilot.prenom+" ":"")+(G.pilot.nom||""),s=SOCIAL_PRESS_ACCOUNTS[Math.floor(Math.random()*SOCIAL_PRESS_ACCOUNTS.length)],l=1===i?"À mi-saison, "+o+" est en tête du championnat. Peut-il tenir la distance ?":i<=3?"Mi-saison : "+o+" solide sur le podium (P"+i+"). La bataille pour le titre reste ouverte.":i<=n.p?"À mi-chemin, "+o+" tient son rang (P"+i+"). Pas d'éclat mais pas de faux pas.":"Mi-saison compliquée pour "+o+" (P"+i+"). Une seconde moitié cruciale.";_addFeedPost({type:"press",author:s.name,handle:s.handle,color:s.color,body:l})}}}})}function maybeGenerateContextualObjective(){var e;if(G.currentTeam&&"Indépendant"!==G.currentTeam&&((!TEAM_TRUST.contextual||TEAM_TRUST.contextual.done||TEAM_TRUST.contextual.expired)&&!(Math.random()>.45||(CAL_RACES?CAL_RACES.length:10)-G.races.length<=1))){var t=[],r=getTrustThresholds();if(r){var n=getTeammateRival(),a;if(n&&t.push({id:"ctx_beat_tm",type:"contextual",title:"Défi : battre "+n.name.split(" ").pop()+" ce week-end",desc:"L'écurie te demande de finir devant ton coéquipier lors de la prochaine course.",reward:8,penalty:-5,duration:1,check:function(e,t,r){return!t&&r&&e<r}}),(getNextRace?getNextRace():null)&&(t.push({id:"ctx_top_race",type:"contextual",title:"Objectif course : Top "+(r.p-2)+" minimum",desc:"L'écurie a besoin de points ce week-end. Top "+(r.p-2)+" obligatoire.",target:r.p-2,reward:7,penalty:-6,duration:1,check:function(e,t){return!t&&e<=this.target}}),t.push({id:"ctx_no_dnf",type:"contextual",title:"Objectif fiabilité : finir la course",desc:"Après les incidents récents, l'écurie veut avant tout une course propre.",reward:5,penalty:-9,duration:1,check:function(e,t){return!t}})),t.length){var i=t[Math.floor(Math.random()*t.length)];i.done=!1,i.expired=!1,i.assignedSaison=G.saison,i.assignedRaceIdx=G.races.length,TEAM_TRUST.contextual=i}}}}function checkContextualObjective(e,t){var r=TEAM_TRUST.contextual;if(r&&!r.done&&!r.expired){var n=r.assignedRaceIdx+1;if(G.races.length===n){var a=getTeammateRival(),i=a&&a.lastPos||99,o=r.check(e,t,i);!0===o?(r.done=!0,changeTrust(r.reward,"Objectif contextuel réussi : "+r.title,""),"function"==typeof pushMail&&G.currentTeam&&"Indépendant"!==G.currentTeam&&_hasTeamStructure()&&pushMail({from:G.currentTeam+" — Direction sportive",role:"team_boss",subject:" Objectif rempli : "+r.title,body:'Tu as tenu parole sur "'+r.title+"\". C'est précisément le genre de fiabilité qu'on attend d'un pilote titulaire. +"+r.reward+" sur la confiance équipe. Bravo.",actions:[{label:"Merci",kind:"dismiss",responseBody:"Merci, je continue à bosser pour tenir mes engagements."}]})):!1===o&&(r.expired=!0,r.penalty&&changeTrust(r.penalty,"Objectif contextuel manqué : "+r.title,""))}else G.races.length>n+1&&(r.expired=!0)}}function _sanitizeMentalAndTrust(){var _s=[{pts:G.champPts,isPlayer:true}];(G.rivals||[]).forEach(function(rv){_s.push({pts:rv.pts||0});});_s.sort(function(a,b){return b.pts-a.pts;});var _pos=_s.findIndex(function(s){return s.isPlayer;})+1;var _n=_s.length;var _rel=_n>1?_pos/_n:1;var _mentalRecov=_rel<0.35?15:_rel<0.60?8:3;PILOT_MENTAL.value=Math.max(Math.round(30+(1-_rel)*20),Math.min(100,PILOT_MENTAL.value+_mentalRecov));var _trustMin=_rel<0.25?55:_rel<0.55?30:15;if(TEAM_TRUST.value<_trustMin)TEAM_TRUST.value=_trustMin;PILOT_MENTAL.streakGood=0;PILOT_MENTAL.streakBad=0;}
function evaluateSeasonTrust(){if(!G.currentTeam||"Indépendant"===G.currentTeam)return{delta:0,summary:[]};var e=[{pts:G.champPts,me:!0}];G.rivals.forEach(function(t){e.push({pts:t.pts,me:!1})}),e.sort(function(e,t){return t.pts-e.pts});var t=e.findIndex(function(e){return e.me})+1,r=G.races.filter(function(e){return 1===e.pos}).length,n=G.races.filter(function(e){return e.pos>=1&&e.pos<=3}).length,a=G.races.filter(function(e){return 0===e.pos}).length,i=getTeammateRival(),o=i?i.pts:0,s=G.champPts-o,l={champPos:t,champPts:G.champPts,wins:r,pods:n,dnfs:a,teammateGap:s},c=[],d=0;return(TEAM_TRUST.objectives||[]).forEach(function(e){var t=e.check(l);null!==t&&(!0!==t||e.done?!1!==t||e.failed||(e.failed=!0,e.penalty&&(d+=e.penalty,c.push({text:" "+e.title,delta:e.penalty,success:!1}))):(e.done=!0,d+=e.reward,c.push({text:" "+e.title,delta:e.reward,success:!0})))}),changeTrust(d,"Bilan fin de saison");_sanitizeMentalAndTrust();return {delta:d,summary:c,finalTrust:TEAM_TRUST.value}}function getTrustConsequences(){var e=TEAM_TRUST.value;return e>=80?{label:"Confiance maximale",color:"#4ADE80",tier:"excellent",msg:"L'écurie est ravie. Renouvellement garanti, bonus probable."}:e>=60?{label:"Bonne confiance",color:"#34D399",tier:"good",msg:"Tu es dans les petits papiers. Renouvellement probable."}:e>=40?{label:"Confiance neutre",color:"#F59E0B",tier:"neutral",msg:"Résultats mitigés. L'écurie attend de voir la suite."}:e>=25?{label:"Confiance fragile",color:"#F97316",tier:"low",msg:"L'écurie commence à douter. Améliore-toi vite."}:{label:"Confiance critique",color:"#EF4444",tier:"critical",msg:"L'écurie perd confiance. Le contrat est en danger."}}function renderMentalMini(){var e=document.getElementById("h-mental-bar"),t=document.getElementById("h-mental-label"),r=document.getElementById("h-mental-val"),n=document.getElementById("h-mental-row");if(e&&t&&r)if(PILOT_MENTAL&&"number"==typeof PILOT_MENTAL.value){n&&(n.style.display="flex");var a=Math.round(PILOT_MENTAL.value),i=getMentalLabel(a),o=getMentalColor(a);e.style.width=a+"%",e.style.background=o,t.textContent=i,t.style.color=o,r.textContent=a,r.style.color=o}else n&&(n.style.display="none")}function renderTrustObjectives(e){var t=document.getElementById(e);if(t)if(G.currentTeam&&"Indépendant"!==G.currentTeam){var r=getTrustConsequences(),n=TEAM_TRUST.value,a="",i=G._playerRole||"num2",o=getRoleInfo(i),s=getRivalryStatus(),l=getTeammateRival(),c=l?l.name||"Coéquipier":null,d=c?c.split(" ").pop():"Coéquipier";if(a+='<div style="padding:12px 14px 0">',a+='<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:'+o.bg+";border:1px solid "+o.border+';border-radius:var(--r);margin-bottom:8px">',a+='<div style="flex:1">',a+='<div style="display:flex;align-items:center;gap:6px">',a+='<span style="font-family:var(--font-display);font-size:13px;font-weight:800;color:'+o.color+'">'+(o.icon?o.icon+" ":"")+o.label+"</span>",a+="</div>",a+='<div style="font-size:11px;color:var(--muted);margin-top:2px">'+_getRoleDesc(i,G.currentTeam)+"</div>",a+="</div>",a+='<div style="width:36px;height:36px;border-radius:50%;border:2px solid '+o.border+";display:flex;align-items:center;justify-content:center;background:"+o.bg+';flex-shrink:0">',a+='<span style="font-family:var(--font-display);font-size:14px;font-weight:900;color:'+o.color+'">'+("num1"===i?"#1":"equal"===i?"=":"#2")+"</span>",a+="</div>",a+="</div>",c){var p,u=flagSvg(l.nat||"",12);if(a+='<div style="padding:10px 12px;background:var(--bg3);border:1px solid var(--border-hi);border-radius:var(--r);margin-bottom:8px">',a+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">',a+='<span style="font-family:var(--font-display);font-size:9px;font-weight:700;color:var(--dim);letter-spacing:.14em;text-transform:uppercase">Coéquipier & rivalité</span>',s&&s.racesDone>0&&(a+='<span style="font-family:var(--font-display);font-size:10px;font-weight:700;color:'+s.color+'">'+s.icon+" "+s.label+"</span>"),a+="</div>",a+='<div style="display:flex;align-items:center;gap:10px">',a+='<div style="width:34px;height:34px;border-radius:50%;background:var(--bg4);border:1px solid var(--line2);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-size:12px;font-weight:700;color:var(--text3);flex-shrink:0">'+(d[0]||"?")+"</div>",a+='<div style="flex:1">',a+='<div style="font-size:12px;font-weight:600;color:var(--text)">'+u+" "+c+"</div>",s&&s.racesDone>0?a+='<div style="font-size:11px;color:var(--muted);margin-top:2px">'+s.wins+"V / "+s.losses+"D"+(s.ties>0?" / "+s.ties+"N":"")+" · "+(s.delta>=0?'<span style="color:var(--green)">+'+s.delta+" pts</span>":'<span style="color:var(--red3)">'+s.delta+" pts</span>")+"</div>":a+='<div style="font-size:11px;color:var(--muted);margin-top:2px">Saison à venir</div>',a+="</div>",s&&s.racesDone>0&&(a+='<div style="text-align:right;flex-shrink:0">',a+='<div style="font-family:var(--font-display);font-size:18px;font-weight:900;color:var(--white);line-height:1">'+s.myPts+"</div>",a+='<div style="font-size:9px;color:var(--muted);letter-spacing:.04em">vs '+s.tmPts+"</div>",a+="</div>"),a+="</div>",s&&s.racesDone>0&&s.myPts+s.tmPts>0){var f=s.myPts+s.tmPts,m=Math.round(s.myPts/f*100);a+='<div style="margin-top:10px"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:10px;color:var(--red3);font-weight:600">Toi</span><span style="font-size:10px;color:var(--muted);font-weight:600">'+d+"</span></div>",a+='<div style="height:5px;border-radius:3px;background:var(--bg4);overflow:hidden;display:flex">',a+='<div style="height:100%;width:'+m+'%;background:var(--red2);border-radius:3px 0 0 3px;transition:width .5s"></div>',a+='<div style="height:100%;flex:1;background:var(--muted);opacity:.35"></div>',a+="</div></div>"}a+="</div>"}a+="</div>";var g=G.currentTeam&&TEAM_LOGOS[G.currentTeam]?'<span style="display:inline-flex;width:26px;height:26px;border-radius:4px;overflow:hidden;flex-shrink:0;background:#0a0a12">'+TEAM_LOGOS[G.currentTeam].replace('width="40" height="40"','width="26" height="26"')+"</span>":"";if(a+='<div style="margin:0 14px 12px;border:1px solid var(--border);border-radius:14px;overflow:hidden;background:var(--surface2);position:relative"><div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:'+r.color+'"></div><div style="padding:14px 16px 12px 18px;background:linear-gradient(180deg,'+r.color+'15 0%,transparent 100%)"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--muted);letter-spacing:.14em;text-transform:uppercase">Confiance</span><span style="font-family:var(--font-display);font-size:10px;font-weight:800;color:#fff;background:'+r.color+';padding:3px 8px;border-radius:5px;letter-spacing:.08em;text-transform:uppercase">'+r.label+'</span></div><div style="display:flex;align-items:center;gap:8px;margin-top:8px">'+g+'<div style="font-family:var(--font-display);font-size:16px;font-weight:900;color:var(--white);line-height:1.1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+G.currentTeam+'</div></div><div style="font-size:12px;color:var(--text3);margin-top:6px;line-height:1.4">'+r.msg+'</div></div><div style="text-align:center;flex-shrink:0;position:relative;min-width:56px"><div style="position:absolute;inset:-4px -6px;background:radial-gradient(circle,'+r.color+'26 0%,transparent 70%);pointer-events:none"></div><div style="font-family:var(--font-display);font-size:28px;font-weight:900;color:'+r.color+';line-height:1;letter-spacing:-.01em;position:relative">'+n+'</div><div style="font-family:var(--font-display);font-size:9px;font-weight:700;color:var(--text3);letter-spacing:.12em;text-transform:uppercase;margin-top:3px;position:relative">/ 100</div></div></div><div style="margin-top:10px;background:#1e293b;border-radius:3px;height:4px;overflow:hidden"><div style="height:100%;width:'+n+"%;background:"+r.color+';border-radius:3px;transition:width .4s"></div></div></div></div>',a+='<div class="t-sec">Objectifs de saison</div>',TEAM_TRUST.objectives.length){var h=(TEAM_TRUST.objectives||[]).filter(function(e){return"main"===e.type}),v=(TEAM_TRUST.objectives||[]).filter(function(e){return"secondary"===e.type});h.length&&(a+='<div style="padding:0 16px 4px"><div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">Obligatoires</div>',h.forEach(function(e){var t=e.done?"#4ADE80":e.failed?"#EF4444":"var(--text2)",r=e.done?"":e.failed?"":"○";a+='<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:linear-gradient(180deg, var(--bg3) 0%, var(--bg2) 100%);border:1px solid var(--border-hi);border-radius:10px;margin-bottom:6px"><span style="font-size:16px;color:'+t+';flex-shrink:0;line-height:1.2">'+r+'</span><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;color:'+t+'">'+e.title+'</div><div style="font-size:12px;color:var(--text3);margin-top:2px">'+e.desc+'</div></div><div style="text-align:right;flex-shrink:0"><div style="font-size:11px;color:#4ADE80">+'+e.reward+" conf.</div>"+(e.penalty?'<div style="font-size:11px;color:#EF4444">'+e.penalty+" conf.</div>":"")+"</div></div>"}),a+="</div>"),v.length&&(a+='<div class="t-sec">Bonus de performance</div><div style="padding:0 16px 4px">',v.forEach(function(e){var t=e.done?"#4ADE80":e.failed?"#EF4444":"var(--amber)",r=e.done?"":e.failed?"":"";a+='<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:linear-gradient(180deg, var(--bg3) 0%, var(--bg2) 100%);border:1px solid var(--border-hi);border-radius:10px;margin-bottom:6px"><span style="font-size:16px;color:'+t+';flex-shrink:0;line-height:1.2">'+r+'</span><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:'+t+'">'+e.title+'</div><div style="font-size:12px;color:var(--text3);margin-top:2px">'+e.desc+'</div></div><div style="text-align:right;flex-shrink:0"><div style="font-size:11px;color:#4ADE80">+'+e.reward+" conf.</div></div></div>"}),a+="</div>")}else a+='<div style="padding:14px 16px;font-size:13px;color:var(--text3)">Aucun objectif fixé pour cette saison.</div>';var x=TEAM_TRUST.contextual;if(x&&!x.expired){a+='<div class="t-sec">Défi en cours</div><div style="padding:0 16px 16px">';var y=x.done?"#4ADE80":"#818cf8";a+='<div style="padding:12px 14px;background:var(--surface2);border:1px solid '+y+';border-radius:10px"><div style="font-size:13px;font-weight:700;color:'+y+';margin-bottom:4px"> '+x.title+(x.done?" — Réussi !":"")+' </div><div style="font-size:12px;color:var(--text3)">'+x.desc+'</div><div style="margin-top:6px;font-size:11px"><span style="color:#4ADE80">Réussite : +'+x.reward+" conf.</span>"+(x.penalty?'  <span style="color:#EF4444">Echec : '+x.penalty+" conf.</span>":"")+"</div></div>",a+="</div>"}var b=TEAM_TRUST.history.slice(-6).reverse();b.length&&(a+='<div class="t-sec">Historique récent</div><div style="padding:0 16px 20px">',b.forEach(function(e){var t=e.delta>=0?"#4ADE80":"#EF4444";a+='<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)"><span style="font-size:12px;color:var(--text2)">'+e.reason+'</span><span style="font-size:12px;font-weight:700;color:'+t+'">'+(e.delta>=0?"+":"")+e.delta+"</span></div>"}),a+="</div>"),t.innerHTML=a}else t.innerHTML="<div style=\"padding:16px;color:var(--text3);font-size:13px\">Tu es pilote indépendant — pas d'objectifs d'écurie.</div>"}var PIT_CONFIG={"Karting Junior":{enabled:!1},"Karting Senior":{enabled:!1},"Formule 4":{enabled:!0,minStops:1,maxStops:1,stopTimeMin:18,stopTimeMax:24,windowStart:.20,windowEnd:.80,degradeTyres:!0},"Formula Regional":{enabled:!0,minStops:1,maxStops:1,stopTimeMin:18,stopTimeMax:24,windowStart:.20,windowEnd:.80,degradeTyres:!0},"Formule 3":{enabled:!0,minStops:0,maxStops:1,stopTimeMin:20,stopTimeMax:26,windowStart:.25,windowEnd:.75,degradeTyres:!0},"Formule 2":{enabled:!0,minStops:1,maxStops:2,stopTimeMin:18,stopTimeMax:24,windowStart:.20,windowEnd:.80,degradeTyres:!0,twoCompoundsRule:!0},"Formule 1":{enabled:!0,minStops:1,maxStops:3,stopTimeMin:21,stopTimeMax:26,windowStart:.15,windowEnd:.85,degradeTyres:!0,twoCompoundsRule:!0},"Super Formula":{enabled:!0,minStops:1,maxStops:1,stopTimeMin:20,stopTimeMax:26,windowStart:.30,windowEnd:.70,degradeTyres:!0},"Endurance WEC":{enabled:!0,minStops:4,maxStops:7,stopTimeMin:50,stopTimeMax:75,windowStart:.10,windowEnd:.98,degradeTyres:!0,fuelStops:!0},IndyCar:{enabled:!0,minStops:2,maxStops:5,stopTimeMin:7,stopTimeMax:12,windowStart:.15,windowEnd:.90,degradeTyres:!0,fuelStops:!0}};
function _pitConfigForCat(cat){return PIT_CONFIG[cat||G.cat]||PIT_CONFIG["Formule 1"]}

/* ======================== STRATEGIE DE COURSE ========================
   Ecran dedie entre la qualif et la course. Pneus en carres colores
   (bleu wet, vert inter, blanc hard, jaune medium, rouge soft) et 
   strategies en paliers carres. Bouton "Demander à l'ingénieur" pour
   pre-remplir intelligemment selon le circuit et la meteo.
   ===================================================================== */
var TYRE_COMPOUND_INFO={
 soft:{label:"Tendre",short:"S",color:"#EF4444",bg:"rgba(239,68,68,0.15)",border:"#EF4444",text:"#fff",pace:"Très rapide",wear:"Élevée",desc:"Rapide mais s'use vite"},
 medium:{label:"Medium",short:"M",color:"#FBBF24",bg:"rgba(251,191,36,0.18)",border:"#FBBF24",text:"#000",pace:"Équilibré",wear:"Modérée",desc:"Compromis pace/durée"},
 hard:{label:"Dur",short:"H",color:"#FFFFFF",bg:"rgba(255,255,255,0.10)",border:"#FFFFFF",text:"#000",pace:"Plus lent",wear:"Faible",desc:"Long en endurance"},
 inter:{label:"Inter",short:"I",color:"#22C55E",bg:"rgba(34,197,94,0.18)",border:"#22C55E",text:"#fff",pace:"Pluie légère",wear:"Variable",desc:"Piste humide"},
 wet:{label:"Wet",short:"W",color:"#3B82F6",bg:"rgba(59,130,246,0.18)",border:"#3B82F6",text:"#fff",pace:"Pluie battante",wear:"Variable",desc:"Forte pluie"}
};
var STRAT_LEVELS={
 attack:{label:"Attaque",color:"#EF4444",bg:"rgba(239,68,68,0.12)",icon:"",desc:"Pousser fort dès le départ. Maxi vitesse, usure pneus accrue."},
 manage:{label:"Gestion",color:"#22C55E",bg:"rgba(34,197,94,0.12)",icon:"",desc:"Rythme constant, pneus préservés. Plus fort en fin de course."},
 defend:{label:"Défensif",color:"#60A5FA",bg:"rgba(96,165,250,0.12)",icon:"",desc:"Stable et prudent. Peu d'erreurs mais moins de pointe."},
 gamble:{label:"Tout ou rien",color:"#A855F7",bg:"rgba(168,85,247,0.12)",icon:"",desc:"Stratégie alternative, fort écart possible — succès ou échec."}
};
function _strategyEnsureInit(){if(!G.raceStrategy||typeof G.raceStrategy!=="object"){if(typeof _resetRaceStrategyDefaults==="function")_resetRaceStrategyDefaults();else{var w=(typeof RACE_STATE!=="undefined"&&RACE_STATE&&RACE_STATE.weather&&RACE_STATE.weather.id)||"dry";var startCompound=(w==="wet"||w==="storm")?"wet":"medium";G.raceStrategy={tyreCompound:startCompound,plannedStops:1,aggressionStart:5,aggressionEnd:5,tyreManagement:5,weatherStance:"ignore",confirmed:!1}}}}
function _strategyHasCompoundChoice(){var cat=(typeof G!=="undefined"&&G.cat)||"";if(cat==="Karting Junior"||cat==="Karting Senior"||cat==="Formule 4")return!1;var cfg=(typeof _pitConfigForCat==="function")?_pitConfigForCat():null;return!(cfg&&!cfg.enabled)}
function _strategyAvailableCompounds(){
 var w=(typeof RACE_STATE!=="undefined"&&RACE_STATE&&RACE_STATE.weather&&RACE_STATE.weather.id)||"dry";
 var cat=(typeof G!=="undefined"&&G.cat)||"";
 var isWEC=cat==="Endurance WEC";
 var isKart=cat==="Karting Junior"||cat==="Karting Senior";
 if(isKart)return[]; // karting : pneu unique
 if(cat==="Formule 4")return["medium"]; // F4 : compound unique Pirelli
 // Conditions mouillées
 if(w==="storm")return isWEC?["wet"]:["wet","inter"];
 if(w==="wet")return isWEC?["wet","medium"]:["inter","wet","medium"];
 // Conditions sèches
 if(isWEC)return["soft","medium","hard"]; // WEC : les 3 compounds
 return["soft","medium","hard"];
}
function setStrategyCompound(c){_strategyEnsureInit();G.raceStrategy.tyreCompound=c;renderStrategyScreen()}
function setStrategyStops(n){_strategyEnsureInit();var cfg=(typeof _pitConfigForCat==="function")?_pitConfigForCat():null;var min=cfg&&cfg.enabled?(cfg.minStops||0):0;var max=cfg&&cfg.enabled?(cfg.maxStops||0):0;n=parseInt(n)||0;G.raceStrategy.plannedStops=Math.max(min,Math.min(max,n));renderStrategyScreen()}
function applyStrategyPreset(p){_strategyEnsureInit();var cfg={attack:{aggressionStart:9,aggressionEnd:5,tyreManagement:2},manage:{aggressionStart:5,aggressionEnd:7,tyreManagement:7},defend:{aggressionStart:3,aggressionEnd:4,tyreManagement:6},gamble:{aggressionStart:10,aggressionEnd:10,tyreManagement:1}}[p]||{aggressionStart:5,aggressionEnd:5,tyreManagement:5};G.raceStrategy.aggressionStart=cfg.aggressionStart;G.raceStrategy.aggressionEnd=cfg.aggressionEnd;G.raceStrategy.tyreManagement=cfg.tyreManagement;G.raceStrategy.preset=p;if(!G.stratAdv)G.stratAdv={};G.stratAdv.agress_debut=cfg.aggressionStart;G.stratAdv.agress_fin=cfg.aggressionEnd;G.stratAdv.gestion_pneus=cfg.tyreManagement;G.strat=p;renderStrategyScreen()}
function setStrategyWeatherStance(s){_strategyEnsureInit();G.raceStrategy.weatherStance=s;renderStrategyScreen()}
function askEngineerStrat(){try{_strategyEnsureInit();var team=typeof _getTeamPersonality==="function"?_getTeamPersonality():null;var engineer=team&&team.engineer?team.engineer:"L'ingénieur";var teamTone=team?team.tone:"neutral";var weather=(typeof RACE_STATE!=="undefined"&&RACE_STATE&&RACE_STATE.weather)||{};var circuit=(typeof RACE_STATE!=="undefined"&&RACE_STATE&&RACE_STATE.circuitData)||{};var ctype=circuit.type||"";var qPos=(typeof RACE_STATE!=="undefined"&&RACE_STATE&&RACE_STATE.qualiPos)||10;var precision=typeof calcEngineerPrecision==="function"?calcEngineerPrecision():.6;var compound,stops,preset;if(weather.id==="storm"){compound="wet"}else if(weather.id==="wet"){compound="inter"}else if(_strategyHasCompoundChoice()){if(qPos<=3)compound="medium";else if(ctype==="street")compound="hard";else if(ctype==="highspeed")compound="medium";else compound="medium"}else compound=null;var cfg=(typeof _pitConfigForCat==="function")?_pitConfigForCat():null;if(cfg&&cfg.enabled){if(weather.id==="wet"||weather.id==="storm")stops=cfg.maxStops;else if(ctype==="street"||ctype==="technical")stops=cfg.minStops;else stops=Math.round((cfg.minStops+cfg.maxStops)/2)}else stops=0;if(qPos<=3)preset="manage";else if(qPos>=10)preset="attack";else if(weather.id==="wet"||weather.id==="storm")preset="defend";else if(ctype==="highspeed")preset="attack";else preset="manage";if(compound)G.raceStrategy.tyreCompound=compound;if(stops!==undefined&&stops!==null)G.raceStrategy.plannedStops=stops;applyStrategyPreset(preset);if(weather.id==="cloudy"||weather.id==="dry"){G.raceStrategy.weatherStance="anticipate"}var stanceLabel=({attack:"d'attaquer",manage:"de gérer les pneus",defend:"de défendre",gamble:"de tenter le tout-ou-rien"})[preset]||"de jouer placé";var compLabel=compound?(TYRE_COMPOUND_INFO[compound]?TYRE_COMPOUND_INFO[compound].label.toLowerCase():compound):null;var msg=[];if(qPos<=3)msg.push("Pole ou top 3, à toi de la défendre.");else if(qPos>=10)msg.push("Tu pars loin, il faut de l'audace.");else msg.push("Position de course honorable, on joue placé.");if(compLabel)msg.push("On part en pneus "+compLabel+(stops!==undefined&&cfg&&cfg.enabled?", "+stops+" arrêt"+(stops>1?"s":"")+" prévu"+(stops>1?"s":""):"")+".");if(weather.id==="wet"||weather.id==="storm")msg.push("Pluie : prudence en début de relais, attente possible d'un assèchement.");else if(weather.id==="hot")msg.push("Forte chaleur, attention à la dégradation thermique.");msg.push("Stratégie : "+(STRAT_LEVELS[preset]?STRAT_LEVELS[preset].label.toLowerCase():preset)+" — il s'agit "+stanceLabel+".");var precPct=Math.round(precision*100);msg.push("Confiance dans le plan : "+precPct+"%.");var prefix=teamTone==="passionate"?"Capo, ":teamTone==="french"?"Allez, ":teamTone==="american"?"Hey buddy, ":teamTone==="japanese"?"Hai, ":"";var fullMsg=prefix+msg.join(" ");if(typeof showAlertDialog==="function")showAlertDialog({title:" "+engineer+" — Plan stratégique",message:fullMsg,variant:"info"});else if(typeof showToast==="function")showToast(" "+fullMsg)}catch(e){console.warn("askEngineerStrat:",e);if(typeof showToast==="function")showToast("Conseil ingénieur indisponible")}}
function confirmStrategy(){_strategyEnsureInit();G.raceStrategy.confirmed=!0;if(typeof RACE_WEEKEND_STATE!=="undefined")RACE_WEEKEND_STATE.strategyDone=!0;if(typeof updateRaceTabsVisibility==="function")updateRaceTabsVisibility();var nextTab="course";if(typeof RACE_WEEKEND_STATE!=="undefined"&&RACE_WEEKEND_STATE.sprintAvailable&&!RACE_WEEKEND_STATE.sprintDone)nextTab="sprint";if(typeof rtab==="function")rtab(nextTab,!0);if(typeof showToast==="function")showToast("Stratégie confirmée — bonne course !")}
function _renderTyreSquare(key,selected,onclick){var info=TYRE_COMPOUND_INFO[key];if(!info)return"";var sel=selected?'border:3px solid '+info.border+';box-shadow:0 0 0 2px rgba(255,255,255,0.15), 0 4px 12px '+info.border+'66':'border:2px solid '+info.border+'77';return'<div onclick="'+onclick+'" style="cursor:pointer;background:'+info.bg+';'+sel+';border-radius:14px;padding:12px 8px;text-align:center;transition:all .15s;-webkit-tap-highlight-color:transparent">'+'<div style="width:50px;height:50px;margin:0 auto;background:'+info.color+';border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid #00000033;box-shadow:inset 0 -4px 8px rgba(0,0,0,0.25)"><span style="font-family:var(--font-display);font-size:22px;font-weight:900;color:'+info.text+';letter-spacing:0;line-height:1">'+info.short+'</span></div>'+'<div style="font-family:var(--font-display);font-size:11px;font-weight:800;color:var(--text);letter-spacing:.06em;text-transform:uppercase;margin-top:8px">'+info.label+'</div>'+'<div style="font-size:9px;color:var(--text3);margin-top:2px">'+info.pace+'</div>'+'</div>'}
function _renderStratLevelSquare(key,selected,onclick){var info=STRAT_LEVELS[key];if(!info)return"";var sel=selected?'border:3px solid '+info.color+';box-shadow:0 0 0 2px rgba(255,255,255,0.15), 0 4px 14px '+info.color+'55':'border:2px solid '+info.color+'55';return'<div onclick="'+onclick+'" style="cursor:pointer;background:'+info.bg+';'+sel+';border-radius:14px;padding:12px 10px;text-align:center;transition:all .15s;-webkit-tap-highlight-color:transparent">'+'<div style="font-size:24px;line-height:1;margin-bottom:4px">'+info.icon+'</div>'+'<div style="font-family:var(--font-display);font-size:11px;font-weight:800;color:'+info.color+';letter-spacing:.08em;text-transform:uppercase">'+info.label+'</div>'+'<div style="font-size:10px;color:var(--text3);margin-top:5px;line-height:1.35;min-height:28px">'+info.desc+'</div>'+'</div>'}
function _renderStopSquare(n,selected,onclick){var sel=selected?'border:3px solid #F59E0B;background:rgba(245,158,11,0.18);box-shadow:0 0 0 2px rgba(255,255,255,0.15)':'border:2px solid var(--border-hi);background:var(--surface2)';return'<div onclick="'+onclick+'" style="cursor:pointer;'+sel+';border-radius:12px;padding:14px 6px;text-align:center;transition:all .15s;-webkit-tap-highlight-color:transparent">'+'<div style="font-family:var(--font-display);font-size:24px;font-weight:900;color:'+(selected?"#F59E0B":"var(--text)")+';line-height:1">'+n+'</div>'+'<div style="font-family:var(--font-display);font-size:9px;font-weight:700;color:var(--text3);letter-spacing:.1em;text-transform:uppercase;margin-top:4px">'+(n===0?"Aucun":(n+" arrêt"+(n>1?"s":"")))+'</div>'+'</div>'}
function renderStrategyScreen(){var container=document.getElementById("strategy-screen-content");if(!container)return;_strategyEnsureInit();
// Rappel mismatch setup
if(G._lastSetupMismatch&&G._lastSetupMismatch.cat===G.cat){var _mm2=document.getElementById("strat-mismatch-warn");if(!_mm2){_mm2=document.createElement("div");_mm2.id="strat-mismatch-warn";_mm2.style.cssText="margin:8px 14px 0;padding:8px 12px;background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.30);border-left:3px solid #F97316;border-radius:8px;display:flex;align-items:center;gap:8px";_mm2.innerHTML='<span style="font-family:var(--font-display);font-size:10px;font-weight:800;color:#F97316;letter-spacing:.08em"> RAPPEL</span><span style="font-size:11px;color:var(--text2)">Setup mal adapté la dernière fois sur ce circuit. Revérifie l\'alignement.</span>';if(container.parentNode)container.parentNode.insertBefore(_mm2,container)}}else{var _mme2=document.getElementById("strat-mismatch-warn");if(_mme2&&_mme2.parentNode)_mme2.parentNode.removeChild(_mme2);}(function(){var _qp=RACE_STATE&&RACE_STATE.qualiPos||0;if(!_qp||RACE_WEEKEND_STATE&&RACE_WEEKEND_STATE.courseDone)return;var _existing2=document.getElementById("strat-grid-badge");if(_existing2&&_existing2.parentNode)_existing2.parentNode.removeChild(_existing2);var _badge=document.createElement("div");_badge.id="strat-grid-badge";var _bc,_bt,_bd;if(_qp===1){_bc="rgba(245,158,11,0.10)";_bt="#F59E0B";_bd="Pole P1 — Tiens la tête au départ, couvre l'intérieur. Ta stratégie : gérer."}else if(_qp<=3){_bc="rgba(52,211,153,0.08)";_bt="#34D399";_bd="P"+_qp+" — Front row. Priorité : défense propre et pneus préservés."}else if(_qp>=8){_bc="rgba(96,165,250,0.08)";_bt="#60A5FA";_bd="P"+_qp+" — Remontée. Sois opportuniste dans les premiers tours, tout le monde sera prudent."}else{_bc="rgba(255,255,255,0.04)";_bt="var(--text3)";_bd="P"+_qp+" — Position de course. Stratégie équilibrée."}_badge.style.cssText="margin:6px 14px 0;padding:8px 12px;background:"+_bc+";border:1px solid "+_bt+"44;border-left:3px solid "+_bt+";border-radius:8px;display:flex;align-items:center;gap:8px";_badge.innerHTML='<span style="font-family:var(--font-display);font-size:10px;font-weight:800;color:'+_bt+';letter-spacing:.08em"> GRILLE</span><span style="font-size:11px;color:var(--text2)">'+_bd+'</span>';if(container&&container.parentNode)container.parentNode.insertBefore(_badge,container);})();var s=G.raceStrategy;var weather=(typeof RACE_STATE!=="undefined"&&RACE_STATE&&RACE_STATE.weather)||{id:"dry",label:"Sec"};var circuit=(typeof RACE_STATE!=="undefined"&&RACE_STATE&&RACE_STATE.circuit)||"";var qPos=(typeof RACE_STATE!=="undefined"&&RACE_STATE&&RACE_STATE.qualiPos)||0;var cfg=(typeof _pitConfigForCat==="function")?_pitConfigForCat():null;var hasCompound=_strategyHasCompoundChoice();var availCompounds=_strategyAvailableCompounds();var html='';
 html+='<div style="padding:0 16px 16px">';
 html+='<div style="margin:12px 0 14px;padding:14px 16px;background:linear-gradient(135deg,rgba(232,16,48,0.10),transparent);border:1px solid var(--border-hi);border-left:3px solid var(--red2);border-radius:14px">';
 html+='<div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:var(--red3);letter-spacing:.18em;text-transform:uppercase;margin-bottom:6px">Stratégie de course</div>';
 html+='<div style="font-family:var(--font-display);font-size:18px;font-weight:900;color:var(--white);line-height:1.2;margin-bottom:6px">'+(circuit||"Grand Prix").toUpperCase()+'</div>';
 html+='<div style="display:flex;flex-wrap:wrap;gap:8px;font-size:11px;color:var(--text2)">';
 html+='<span style="padding:3px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:5px">'+weather.label+'</span>';
 if(qPos>0)html+='<span style="padding:3px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:5px">Grille : P'+qPos+'</span>';
 html+='<span style="padding:3px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:5px">'+(G.cat||"")+'</span>';
 html+='</div></div>';
 html+='<button onclick="askEngineerStrat()" style="width:100%;display:flex;align-items:center;gap:10px;padding:11px 14px;background:linear-gradient(135deg,rgba(96,165,250,0.10) 0%,rgba(167,139,250,0.08) 100%);border:1px solid rgba(96,165,250,0.30);border-radius:10px;color:#60A5FA;font-family:var(--font-display);font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;margin-bottom:14px">';
 html+='<span style="font-size:16px">'+renderIcon('moteur',14,'#9CA3AF')+'</span><span>Demander à l\'ingénieur</span><span style="margin-left:auto;font-size:9px;color:var(--text3);font-weight:600">Plan complet</span>';
 html+='</button>';
 if(hasCompound){
  html+='<div style="background:linear-gradient(180deg, var(--bg3) 0%, var(--bg2) 100%);border:1px solid var(--border-hi);border-radius:12px;overflow:hidden;margin-bottom:12px">';
  html+='<div style="padding:11px 14px;border-bottom:1px solid var(--border)"><div style="font-family:var(--font-display);font-size:12px;font-weight:800;color:var(--text);letter-spacing:.08em;text-transform:uppercase">Composé de départ</div><div style="font-size:11px;color:var(--text3);margin-top:2px">Choisis ton pneu pour le premier relais</div></div>';
  html+='<div style="display:grid;grid-template-columns:repeat('+(availCompounds.length<=3?availCompounds.length:3)+',1fr);gap:8px;padding:14px">';
  availCompounds.forEach(function(c){html+=_renderTyreSquare(c,s.tyreCompound===c,"setStrategyCompound('"+c+"')")});
  html+='</div></div>';
 }
 if(cfg&&cfg.enabled&&cfg.maxStops>0){
  var minS=cfg.minStops||0,maxS=cfg.maxStops||1;
  var stopOpts=[];for(var k=minS;k<=maxS;k++)stopOpts.push(k);
  if(stopOpts.length>1){
   html+='<div style="background:linear-gradient(180deg, var(--bg3) 0%, var(--bg2) 100%);border:1px solid var(--border-hi);border-radius:12px;overflow:hidden;margin-bottom:12px">';
   html+='<div style="padding:11px 14px;border-bottom:1px solid var(--border)"><div style="font-family:var(--font-display);font-size:12px;font-weight:800;color:var(--text);letter-spacing:.08em;text-transform:uppercase">Plan de relais</div><div style="font-size:11px;color:var(--text3);margin-top:2px">Nombre d\'arrêts au stand prévus</div></div>';
   html+='<div style="display:grid;grid-template-columns:repeat('+Math.min(stopOpts.length,4)+',1fr);gap:8px;padding:14px">';
   stopOpts.forEach(function(n){html+=_renderStopSquare(n,s.plannedStops===n,"setStrategyStops("+n+")")});
   html+='</div></div>';
  }
 }
 html+='<div style="background:linear-gradient(180deg, var(--bg3) 0%, var(--bg2) 100%);border:1px solid var(--border-hi);border-radius:12px;overflow:hidden;margin-bottom:12px">';
 html+='<div style="padding:11px 14px;border-bottom:1px solid var(--border)"><div style="font-family:var(--font-display);font-size:12px;font-weight:800;color:var(--text);letter-spacing:.08em;text-transform:uppercase">Approche course</div><div style="font-size:11px;color:var(--text3);margin-top:2px">Mentalité globale pour cette course</div></div>';
 html+='<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;padding:14px">';
 ["attack","manage","defend","gamble"].forEach(function(p){html+=_renderStratLevelSquare(p,s.preset===p||(G.strat===p&&!s.preset),"applyStrategyPreset('"+p+"')")});
 html+='</div></div>';
 if(weather.id==="cloudy"||weather.id==="dry"||weather.id==="hot"){
  var ws=s.weatherStance||"ignore";
  html+='<div style="background:linear-gradient(180deg, var(--bg3) 0%, var(--bg2) 100%);border:1px solid var(--border-hi);border-radius:12px;overflow:hidden;margin-bottom:12px">';
  html+='<div style="padding:11px 14px;border-bottom:1px solid var(--border)"><div style="font-family:var(--font-display);font-size:12px;font-weight:800;color:var(--text);letter-spacing:.08em;text-transform:uppercase">Stratégie météo</div><div style="font-size:11px;color:var(--text3);margin-top:2px">Anticiper un changement de temps ?</div></div>';
  html+='<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;padding:14px">';
  var weatherOpts=[{key:"ignore",label:"Pas d\'anticipation",icon:"",color:"#94A3B8",desc:"Plan basé sur la météo actuelle"},{key:"anticipate",label:"Anticiper la pluie",icon:"",color:"#3B82F6",desc:"Choix défensif, prêt à pluie"}];
  weatherOpts.forEach(function(w){var sel=ws===w.key;var s2=sel?'border:3px solid '+w.color+';background:'+w.color+'18':'border:2px solid '+w.color+'55;background:var(--surface2)';html+='<div onclick="setStrategyWeatherStance(\''+w.key+'\')" style="cursor:pointer;'+s2+';border-radius:12px;padding:12px 10px;text-align:center;-webkit-tap-highlight-color:transparent"><div style="font-size:22px;line-height:1;margin-bottom:4px">'+w.icon+'</div><div style="font-family:var(--font-display);font-size:11px;font-weight:800;color:'+w.color+';letter-spacing:.06em;text-transform:uppercase">'+w.label+'</div><div style="font-size:9.5px;color:var(--text3);margin-top:4px;line-height:1.3">'+w.desc+'</div></div>'});
  html+='</div></div>';
 }
 html+='<button onclick="confirmStrategy()" style="width:100%;padding:14px;background:linear-gradient(135deg,#FF1801 0%,#C8102E 100%);color:#fff;border:none;border-radius:12px;font-family:var(--font-display);font-size:13px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;box-shadow:0 4px 14px rgba(232,16,48,0.30)">Confirmer la stratégie · Aller en course</button>';
 html+='</div>';
 container.innerHTML=html;
}
function _pitEnabledForCurrentRace(){/* SPRINT — pas de pit obligatoire en course sprint (réaliste F1/F2/F3) */ if(typeof LIVE_RACE!=="undefined"&&LIVE_RACE&&LIVE_RACE._isSprintMode)return false;var c=_pitConfigForCat();return c&&c.enabled}
function _scheduleRivalPits(){if(!LIVE_RACE||!LIVE_RACE.drivers)return;var cfg=_pitConfigForCat();if(!cfg||!cfg.enabled)return;/* #12 — Compound initial pour tous : medium en sec/cloudy/hot, wet en pluie. */ var _initW=(RACE_STATE.weather&&RACE_STATE.weather.id)||"dry";var _initCompound=(_initW==="wet"||_initW==="storm")?"wet":"medium";LIVE_RACE.drivers.forEach(function(d){if(typeof d._tyreCompound==="undefined")d._tyreCompound=_initCompound;if(typeof d._tyreLife==="undefined"){d._tyreLife=100;d._tyreLifeAlerted40=false;d._tyreLifeAlerted20=false;}if(!d._usedCompounds)d._usedCompounds=[d._tyreCompound||"medium"];});LIVE_RACE.drivers.forEach(function(d){if(d.isPlayer)return;d._pitsScheduled=[];var nStops=cfg.minStops+Math.floor(Math.random()*(cfg.maxStops-cfg.minStops+1));if(nStops<=0)return;var winStart=cfg.windowStart,winEnd=cfg.windowEnd,winSize=winEnd-winStart;for(var i=0;i<nStops;i++){var lapPct;if(nStops===1)lapPct=winStart+winSize*(0.35+Math.random()*0.4);else lapPct=winStart+winSize*((i+0.5+Math.random()*0.4-0.2)/nStops);var lap=Math.max(2,Math.min(LIVE_RACE.total-2,Math.round(lapPct*LIVE_RACE.total)));d._pitsScheduled.push({lap:lap,duration:cfg.stopTimeMin+Math.random()*(cfg.stopTimeMax-cfg.stopTimeMin)})}d._pitsDone=0})}
function _applyRivalPitsForLap(){if(!LIVE_RACE||!LIVE_RACE.drivers)return;LIVE_RACE.drivers.forEach(function(d){if(d.isPlayer||d.dnf||!d._pitsScheduled)return;d._pitsScheduled.forEach(function(p){if(!p._done&&LIVE_RACE.cur===p.lap){var placesLost=_computePlacesLostByPit(d,p.duration);_applyPitPenaltyForTargetDrop(d,placesLost,p.duration);d._pitsDone=(d._pitsDone||0)+1;d._tyreFresh=!0;d._tyreLapsOnSet=0;d._tyreLife=100;p._done=!0;d._lastPitLap=LIVE_RACE.cur;/* #12 — Compound auto pour les rivaux : pluie si météo wet/storm, sinon medium/soft selon phase */ var _rivalCompound;var _w=(RACE_STATE.weather&&RACE_STATE.weather.id)||"dry";if(_w==="wet"||_w==="storm")_rivalCompound="wet";else{var _pct=LIVE_RACE.total>0?LIVE_RACE.cur/LIVE_RACE.total:0;_rivalCompound=_pct>0.7?"soft":(_pct>0.4?"medium":"hard")}d._tyreCompound=_rivalCompound;RACE_STATE.eventsLog&&RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:d.name+" entre aux stands",choice:"—",note:"Arrêt "+p.duration.toFixed(1)+"s · -"+placesLost+" pl",sign:"~",color:"#60A5FA"})}})})}
/* #12 — Choix pneus au pit : système de compounds.
 4 compounds : soft (rapide+usure forte), medium (équilibré, défaut), hard (lent+durable), wet (pluie).
 Chaque compound module à la fois la pace (paceBonus) et la dégradation (wearMult).
 Mauvais choix (slick sur pluie ou wet sur sec) = malus très important.
 La fonction retourne {paceBonus, wearMult, label, color, icon}. */
function _compoundEffects(compound,weatherId){
 var c={
  "soft":{paceBonus:-0.10,wearMult:1.5,label:"Tendres",color:"#EF4444",icon:""},
  "medium":{paceBonus:0,wearMult:1.0,label:"Mediums",color:"#F59E0B",icon:""},
  "hard":{paceBonus:0.05,wearMult:0.7,label:"Durs",color:"#E5E7EB",icon:""},
  "wet":{paceBonus:0,wearMult:1.0,label:"Pluie",color:"#3B82F6",icon:""}
 };
 var eff=c[compound]||c["medium"];
 // Pénalités contextuelles : mauvais choix selon météo
 var w=weatherId||(typeof RACE_STATE!=="undefined"&&RACE_STATE&&RACE_STATE.weather&&RACE_STATE.weather.id)||"dry";
 var isWet=w==="wet"||w==="storm";
 if(isWet&&compound!=="wet"){
  // Slick sur pluie : très lent et grosse usure (aquaplaning)
  eff={paceBonus:eff.paceBonus+0.40,wearMult:eff.wearMult*1.8,label:eff.label+" (mauvais)",color:eff.color,icon:eff.icon};
 }else if(!isWet&&compound==="wet"){
  // Pluie sur sec : très lent et usure énorme (gomme tendre cuit)
  eff={paceBonus:0.50,wearMult:2.5,label:"Pluie (mauvais choix)",color:"#3B82F6",icon:""};
 }
 return eff;
}
function _suggestedCompound(){
 var w=(typeof RACE_STATE!=="undefined"&&RACE_STATE&&RACE_STATE.weather&&RACE_STATE.weather.id)||"dry";
 if(w==="wet"||w==="storm")return "wet";
 // Règle 2 compounds : si F1/F2 et déjà utilisé un compound, imposer l'autre
 var cfg=typeof _pitConfigForCat==="function"?_pitConfigForCat():null;
 if(cfg&&cfg.twoCompoundsRule&&typeof LIVE_RACE!=="undefined"&&LIVE_RACE&&LIVE_RACE.drivers){
  var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer;});
  if(p&&p._usedCompounds&&p._usedCompounds.length===1){
   // Déjà utilisé 1 compound → imposer le 2ème
   var used=p._usedCompounds[0];
   if(used==="soft")return "medium";
   if(used==="hard")return "medium";
   if(used==="medium"){// Choisir selon la phase de course
    var pct2=LIVE_RACE.total>0?LIVE_RACE.cur/LIVE_RACE.total:0;
    return pct2>0.55?"soft":"hard";
   }
  }
 }
 // Sec : medium par défaut, soft en fin de course
 if(typeof LIVE_RACE!=="undefined"&&LIVE_RACE&&LIVE_RACE.total){
  var pct=LIVE_RACE.cur/LIVE_RACE.total;
  if(pct>0.65)return "soft";
 }
 return "medium";
}
function _refreshTyreOnPit(d,compound){d._tyreFreshLaps=8;d._tyreFresh=!0;d._lapsSincePit=0;d._tyreLife=100;d._tyreLifeAlerted40=false;d._tyreLifeAlerted20=false;var c=compound||"medium";d._tyreCompound=c;/* Tracking règle 2 compounds (F1/F2) */if(!d._usedCompounds)d._usedCompounds=[];if(d._usedCompounds.indexOf(c)<0)d._usedCompounds.push(c);}
function _computePlacesLostByPit(driver,dur){if(!LIVE_RACE||!LIVE_RACE.drivers)return 0;var dScore=driver.score-(driver.penaltySec||0)/45;var driversBehind=LIVE_RACE.drivers.filter(function(d){if(d.dnf||d.name===driver.name)return false;var theirEffectiveScore=d.score-(d.penaltySec||0)/45;return theirEffectiveScore<dScore});var placesLost=0;driversBehind.forEach(function(d){var theirEffectiveScore=d.score-(d.penaltySec||0)/45;var gapBehindSec=45*(dScore-theirEffectiveScore);if(gapBehindSec<dur)placesLost++});return placesLost}
function _applyPitPenaltyForTargetDrop(driver,placesLost,dur){var dScore=driver.score-(driver.penaltySec||0)/45;var sortedActive=LIVE_RACE.drivers.filter(function(d){return!d.dnf}).slice().sort(function(a,b){return(b.score-(b.penaltySec||0)/45)-(a.score-(a.penaltySec||0)/45)});var curIdx=sortedActive.findIndex(function(d){return d.name===driver.name});if(curIdx<0)return;var targetIdx=Math.min(sortedActive.length-1,curIdx+placesLost);var targetDriver=sortedActive[targetIdx];if(!targetDriver||targetDriver.name===driver.name){driver.penaltySec=(driver.penaltySec||0)+dur;return}var targetEffective=targetDriver.score-(targetDriver.penaltySec||0)/45;var neededPenalty=Math.max(0,(driver.score-targetEffective)*45+0.3);driver.penaltySec=(driver.penaltySec||0)+neededPenalty}
function _playerPit(forceFromEvent,chosenCompound){if(!LIVE_RACE||!LIVE_RACE.drivers)return;if(LIVE_RACE.paused&&!forceFromEvent){if("function"==typeof showToast)showToast("⏸ Termine d'abord l'événement");return}if(LIVE_RACE.finished)return;var cfg=_pitConfigForCat();if(!cfg||!cfg.enabled){if(!forceFromEvent&&"function"==typeof showAlertDialog)showAlertDialog({title:"Indisponible",message:"Pas d'arrêt au stand dans cette catégorie.",variant:"info"});return}var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});if(!p||p.dnf)return;p._pitsDone=p._pitsDone||0;if(p._pitsDone>=cfg.maxStops){if(!forceFromEvent&&"function"==typeof showToast)showToast(" Limite d'arrêts atteinte");return}/* #12 — Pas en karting (cat sans degradation pneus avancée) et pas forceFromEvent : afficher popup choix de compound */ if(!forceFromEvent&&!chosenCompound&&G.cat!=="Karting Junior"&&G.cat!=="Karting Senior"&&typeof _showCompoundPopup==="function"){_showCompoundPopup();return}var compound=chosenCompound||(forceFromEvent?(typeof _suggestedCompound==="function"?_suggestedCompound():"medium"):"medium");
/* Règle 2 compounds F1/F2 : si twoCompoundsRule, suggérer automatiquement le compound manquant */
var cfg2=_pitConfigForCat();
if(cfg2&&cfg2.twoCompoundsRule&&!forceFromEvent){
  var _used=p._usedCompounds||[];
  var _dryComps=["soft","medium","hard"];
  var _unused=_dryComps.filter(function(c){return _used.indexOf(c)<0;});
  // Si dernier arrêt et toujours un seul compound utilisé, imposer l'autre
  var _isLastPit=(p._pitsDone||0)+1>=cfg2.maxStops;
  if(_isLastPit&&_used.length<2&&_unused.length>0&&_unused.indexOf(compound)>=0){
    compound=_unused[0];
    if(typeof showToast==="function")showToast("⚠ Règlement — 2 compounds obligatoires · "+compound.toUpperCase()+" imposé");
  }
}
var dur=cfg.stopTimeMin+Math.random()*(cfg.stopTimeMax-cfg.stopTimeMin);if(G.stratAdv){var gp=((G.stratAdv.gestion_pneus||5)-5)/5;dur+=-1.5*gp}var perf=(G._crewPitSkill||0.5);dur=Math.max(cfg.stopTimeMin*.85,dur-(perf-.5)*4);var placesLost=_computePlacesLostByPit(p,dur);_applyPitPenaltyForTargetDrop(p,placesLost,dur);p._pitsDone++;_refreshTyreOnPit(p,compound);p._tyreLapsOnSet=0;p._lastPitLap=LIVE_RACE.cur;p._tyreWearAccum=0;if(LIVE_RACE._tyreMode==="push")_setTyreMode("normal");
 // Reset alertes strat pour le prochain stint
 LIVE_RACE._undercutAlertedFor=null;
 LIVE_RACE._overcutAlertedFor=null;
 LIVE_RACE._tyreAttackAlertedFor=null;/* #12 — note inclut le compound choisi */ var compoundLabel=(typeof _compoundEffects==="function")?(_compoundEffects(compound).icon+" "+_compoundEffects(compound).label):compound;var noteText="Arrêt "+dur.toFixed(1)+"s · -"+placesLost+" pl. · "+compoundLabel;RACE_STATE.eventsLog&&RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:"Tu rentres aux stands",choice:compoundLabel,note:noteText,sign:"~",color:"#60A5FA"});if("function"==typeof showToast)showToast(" Arrêt aux stands ("+dur.toFixed(1)+"s · -"+placesLost+" pl · "+compoundLabel+")");if("function"==typeof updateLivePositions)updateLivePositions();if("function"==typeof renderLiveLeaderboard)renderLiveLeaderboard();if("function"==typeof renderPitButton)renderPitButton()}
function _decayPitPenalty(){if(!LIVE_RACE||!LIVE_RACE.drivers)return;LIVE_RACE.drivers.forEach(function(d){if(d.dnf||!d.penaltySec)return;if(d._lastPitLap&&LIVE_RACE.cur-d._lastPitLap>=15)d.penaltySec=Math.max(0,d.penaltySec*.95)})}
/* #12 — Popup de choix de compound. Pause la course, affiche les 4 choix avec descriptions,
   met en avant le compound suggéré contextuellement, et appelle _playerPit(false, compound) à la sélection.
   Annulation possible (= pas de pit, on referme la popup). */
function _showCompoundPopup(){
 if(!LIVE_RACE||LIVE_RACE.finished)return;
 // Pause la course pendant le choix (comportement comme un event modal)
 var wasPaused=LIVE_RACE.paused;
 LIVE_RACE.paused=true;
 var existing=document.getElementById("compound-popup-overlay");
 if(existing)existing.remove();
 var overlay=document.createElement("div");
 overlay.id="compound-popup-overlay";
 overlay.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.78);z-index:9500;display:flex;align-items:center;justify-content:center;padding:18px";
 var weather=(RACE_STATE&&RACE_STATE.weather&&RACE_STATE.weather.id)||"dry";
 var suggested=(typeof _suggestedCompound==="function")?_suggestedCompound():"medium";
 var compounds=["soft","medium","hard","wet"];
 var card=document.createElement("div");
 card.style.cssText="background:var(--surface,#16161D);border:1px solid var(--border,#2A2A35);border-radius:14px;padding:18px 16px 14px;max-width:380px;width:100%;box-shadow:0 12px 38px rgba(0,0,0,0.65)";
 var titleHTML='<div style="font-family:var(--font-display);font-size:11px;font-weight:800;color:#F59E0B;letter-spacing:.14em;text-transform:uppercase;margin-bottom:4px">'+renderIcon('moteur',14,'#9CA3AF')+' Arrêt au stand</div>';
 titleHTML+='<div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:3px">Choisis tes pneus</div>';
 titleHTML+='<div style="font-size:11px;color:var(--text3);margin-bottom:14px">Météo : '+(weather==="wet"||weather==="storm"?" pluie":weather==="hot"?" chaud":" sec")+' · Tour '+LIVE_RACE.cur+'/'+LIVE_RACE.total+'</div>';
 var choicesHTML="";
 compounds.forEach(function(comp){
  var eff=_compoundEffects(comp,weather);
  var isSuggested=(comp===suggested);
  var paceTxt=eff.paceBonus<0?(eff.paceBonus.toFixed(2)+"s/T (rapide)"):eff.paceBonus>0?("+"+eff.paceBonus.toFixed(2)+"s/T (lent)"):"≈ pace neutre";
  var wearTxt=eff.wearMult>1.3?"usure ↑↑":eff.wearMult>1.05?"usure ↑":eff.wearMult<0.85?"usure ↓":"usure normale";
  var bgGrad=isSuggested?"linear-gradient(180deg,rgba(52,211,153,0.15) 0%,rgba(52,211,153,0.06) 100%)":"var(--surface2,#1F1F2A)";
  var border=isSuggested?"1.5px solid #34D399":"1px solid var(--border,#2A2A35)";
  var sugBadge=isSuggested?'<span style="display:inline-block;margin-left:6px;padding:1px 5px;background:#34D399;color:#0a0510;border-radius:3px;font-size:8.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase">Conseillé</span>':"";
  choicesHTML+='<button data-compound="'+comp+'" style="display:block;width:100%;text-align:left;padding:10px 12px;margin-bottom:8px;background:'+bgGrad+';border:'+border+';border-radius:9px;cursor:pointer;font-family:inherit">';
  choicesHTML+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span style="font-size:18px">'+eff.icon+'</span><span style="font-size:13px;font-weight:700;color:var(--text)">'+eff.label.replace(/ \(mauvais\).*$/,"")+'</span>'+sugBadge+'</div>';
  choicesHTML+='<div style="font-size:10.5px;color:var(--text3);line-height:1.4">'+paceTxt+' · '+wearTxt+'</div>';
  choicesHTML+='</button>';
 });
 var cancelHTML='<button id="compound-cancel-btn" style="display:block;width:100%;padding:8px 12px;margin-top:6px;background:transparent;border:1px solid var(--border,#2A2A35);border-radius:7px;color:var(--text3);font-size:11px;font-weight:600;cursor:pointer;letter-spacing:.04em">Annuler</button>';
 card.innerHTML=titleHTML+choicesHTML+cancelHTML;
 overlay.appendChild(card);
 document.body.appendChild(overlay);
 // Bind clicks
 var btns=card.querySelectorAll("button[data-compound]");
 btns.forEach(function(btn){
  btn.addEventListener("click",function(){
   var comp=btn.getAttribute("data-compound");
   overlay.remove();
   LIVE_RACE.paused=wasPaused;
   _playerPit(false,comp);
  });
 });
 var cancelBtn=card.querySelector("#compound-cancel-btn");
 if(cancelBtn)cancelBtn.addEventListener("click",function(){
  overlay.remove();
  LIVE_RACE.paused=wasPaused;
 });
}
function getPlayerPitStatus(){var p=LIVE_RACE&&LIVE_RACE.drivers&&LIVE_RACE.drivers.find(function(d){return d.isPlayer});var cfg=_pitConfigForCat();if(!p||!cfg||!cfg.enabled)return null;var lapPct=LIVE_RACE.total>0?LIVE_RACE.cur/LIVE_RACE.total:0;var inWindow=lapPct>=cfg.windowStart-.05&&lapPct<=cfg.windowEnd+.02;var stopsDone=p._pitsDone||0;var stopsRemaining=Math.max(0,cfg.minStops-stopsDone);var canPit=stopsDone<cfg.maxStops;var avgDur=(cfg.stopTimeMin+cfg.stopTimeMax)/2;var estimatedPlacesLost=canPit&&!p.dnf?_computePlacesLostByPit(p,avgDur):0;return{inWindow:inWindow,stopsDone:stopsDone,stopsRemaining:stopsRemaining,canPit:canPit,minStops:cfg.minStops,maxStops:cfg.maxStops,windowStart:Math.round(cfg.windowStart*LIVE_RACE.total),windowEnd:Math.round(cfg.windowEnd*LIVE_RACE.total),lap:LIVE_RACE.cur,total:LIVE_RACE.total,estimatedPlacesLost:estimatedPlacesLost,estimatedDur:avgDur}}

/* === SETUP FEEL : effets ressentis en course ===
 * Calcule les implications concrètes du setup G.setup ("bal","aero","mec","agg")
 * croisé avec le type de circuit (highspeed, technical, street, default).
 * Retourne :
 *   label      — nom court affiché (ex: "Aileron haut")
 *   desc       — phrase radio ingénieur tour 1
 *   attackMod  — modificateur de difficulté pour events attaque (+= baisse la diff = plus facile)
 *   defenseMod — idem pour events défense
 *   wearNote   — note radio si usure accrue
 *   match      — "good" | "neutral" | "bad" selon adéquation circuit
 *   midRadio   — alerte optionnelle mid-course si mauvaise adéquation
 */
function _getSetupFeel(){
 // Karting n'a pas de setup screen → pas de feel
 if(G.cat==="Karting Junior"||G.cat==="Karting Senior")return null;
 var setup=G.setup||"bal";
 var cData=(typeof RACE_STATE!=="undefined"&&RACE_STATE&&RACE_STATE.circuitData)||{};
 var ctype=cData.type||"default";
 var w=(typeof RACE_STATE!=="undefined"&&RACE_STATE&&RACE_STATE.weather)||{id:"dry"};
 var isWet=w.id==="wet"||w.id==="storm";

 // Tableau : setup → comportement par circuit
 var matrix={
  bal:{
   label:"Équilibré",
   highspeed:{match:"neutral",desc:"Setup équilibré — pas d'avantage particulier sur ce circuit rapide, mais aucun défaut non plus.",attackMod:0,defenseMod:0,wearNote:null,midRadio:null},
   technical:{match:"good",desc:"Setup équilibré sur circuit technique — bonne base en virage, tu devrais bien t'en sortir.",attackMod:0.02,defenseMod:0.02,wearNote:null,midRadio:null},
   street:{match:"neutral",desc:"Setup équilibré sur circuit urbain — raisonnable, mais un setup mécanique aurait pu t'aider davantage.",attackMod:0,defenseMod:0,wearNote:null,midRadio:"Setup neutre ici — les virages lents limitent un peu ta sortie de virage."},
   default:{match:"neutral",desc:"Setup équilibré — bon compromis général, aucun point faible notable.",attackMod:0,defenseMod:0,wearNote:null,midRadio:null}
  },
  aero:{
   label:"Aileron haut",
   highspeed:{match:"bad",desc:"Aileron élevé sur piste rapide — bonne tenue en courbe mais tu vas perdre dans les lignes droites. Les adversaires vont te passer au DRS.",attackMod:-0.04,defenseMod:0.04,wearNote:null,midRadio:"Comme prévu, l'aileron élevé te coûte cher dans les lignes droites — difficile à défendre."},
   technical:{match:"good",desc:"Aileron élevé sur circuit technique — excellente appui en virage, tu vas dominer dans les sections lentes.",attackMod:0.06,defenseMod:0.03,wearNote:null,midRadio:null},
   street:{match:"good",desc:"Aileron élevé sur circuit urbain — parfait pour les virages serrés, bonne traction en sortie.",attackMod:0.05,defenseMod:0.02,wearNote:null,midRadio:null},
   default:{match:"neutral",desc:"Aileron élevé — bon appui mais vitesse de pointe réduite. Efficace sur circuit avec des virages.",attackMod:0.02,defenseMod:0.01,wearNote:null,midRadio:null}
  },
  mec:{
   label:"Setup mécanique",
   highspeed:{match:"neutral",desc:"Setup mécanique sur circuit rapide — l'équilibre mécanique aide en courbe rapide, neutre dans les lignes.",attackMod:0.01,defenseMod:0.02,wearNote:null,midRadio:null},
   technical:{match:"good",desc:"Setup mécanique sur circuit technique — excellent grip mécanique, les pneus vont durer plus longtemps.",attackMod:0.03,defenseMod:0.03,wearNote:"low",midRadio:null},
   street:{match:"good",desc:"Setup mécanique sur circuit urbain — le grip mécanique fait la différence sur cette piste bosselée.",attackMod:0.04,defenseMod:0.03,wearNote:"low",midRadio:null},
   default:{match:"neutral",desc:"Setup mécanique — pneus bien chargés, dégradation réduite sur ce circuit.",attackMod:0.02,defenseMod:0.02,wearNote:"low",midRadio:null}
  },
  agg:{
   label:"Agressif",
   highspeed:{match:"bad",desc:"Setup agressif sur piste rapide — tu vas attaquer fort mais la voiture est instable en appui. Risque de glisse.",attackMod:0.07,defenseMod:-0.05,wearNote:"high",midRadio:"La voiture est limite en appui — chaque freinage est une prise de risque."},
   technical:{match:"neutral",desc:"Setup agressif sur circuit technique — puissance à la sortie mais sous-virage possible. Sois précis.",attackMod:0.04,defenseMod:-0.02,wearNote:"high",midRadio:"Attention aux sorties larges avec ce setup agressif — le sous-virage guette."},
   street:{match:"bad",desc:"Setup agressif sur circuit urbain — dangereux ici, les murs sont partout. Tu vas attaquer mais une erreur peut tout gâcher.",attackMod:0.03,defenseMod:-0.06,wearNote:"high",midRadio:"Les murs pardonnent pas avec ce setup — reste propre."},
   default:{match:"neutral",desc:"Setup agressif — voiture pointue, attaque facilitée mais défense difficile et usure accrue.",attackMod:0.05,defenseMod:-0.03,wearNote:"high",midRadio:null}
  }
 };

 var s=matrix[setup]||matrix["bal"];
 var c=s[ctype]||s["default"];

 // Correction pluie : aero devient neutre/bon, agg devient très mauvais
 if(isWet){
  if(setup==="agg"){c=Object.assign({},c,{match:"bad",attackMod:c.attackMod-0.04,wearNote:"high",midRadio:"Setup agressif sous la pluie — très instable. Lève le pied dans les virages mouillés."})}
  if(setup==="aero"){c=Object.assign({},c,{match:"good",attackMod:c.attackMod+0.02})}
 }

 return{
  setup:setup,
  label:s.label,
  match:c.match,
  desc:c.desc,
  attackMod:c.attackMod||0,
  defenseMod:c.defenseMod||0,
  wearNote:c.wearNote||null,
  midRadio:c.midRadio||null
 };
}

/* ===== MUR DES STANDS — Vue stratégique complète ========================
 * Modal affichant le classement complet en cours de course avec :
 *  - Position, nom, gap, pneus (compound + barre vie), tour de pit estimé
 *  - Mise en évidence des opportunités undercut/overcut
 *  - Bouton PIT depuis la vue
 * ======================================================================= */
function renderPitWall() {
 try {
  if (!LIVE_RACE || !LIVE_RACE.drivers || LIVE_RACE.finished) return;
  if (LIVE_RACE.paused) {
   var _ex = document.getElementById('pitwall-modal');
   if (_ex && _ex.parentNode) _ex.parentNode.removeChild(_ex);
   return;
  }
  var existing = document.getElementById('pitwall-modal');
  if (existing && existing.parentNode) { existing.parentNode.removeChild(existing); return; }

  var modal = document.createElement('div');
  modal.id = 'pitwall-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:8500;display:flex;align-items:flex-end;justify-content:center;padding:0;backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)';

  var p = LIVE_RACE.drivers.find(function(d) { return d.isPlayer; });
  var lap = LIVE_RACE.cur, total = LIVE_RACE.total;
  var cfg = typeof _pitConfigForCat === 'function' ? _pitConfigForCat() : null;
  var hasPits = cfg && cfg.enabled && cfg.degradeTyres;
  var weather = (typeof RACE_STATE !== 'undefined' && RACE_STATE.weather) || { id: 'dry' };
  var circuitData = (typeof RACE_STATE !== 'undefined' && RACE_STATE.circuitData) || {};
  var isSprintM = !!(LIVE_RACE._isSprintMode);
  var pct = total > 0 ? lap / total : 0;
  var wStart = (cfg && cfg.windowStart) || 0.3;
  var wEnd = (cfg && cfg.windowEnd) || 0.7;
  var inWindow = pct >= wStart && pct <= wEnd && !isSprintM;
  var toClose = inWindow ? Math.max(0, Math.ceil((wEnd - pct) * total)) : 0;
  var toOpen = pct < wStart ? Math.max(0, Math.ceil((wStart - pct) * total)) : 0;
  var playerPitsDone = (p && p._pitsDone) || 0;
  var maxStops = (cfg && cfg.maxStops) || 1;
  var minStops = (cfg && cfg.minStops) || 0;
  var canPit = hasPits && p && !p.dnf && playerPitsDone < maxStops && !isSprintM;

  // ── Compounds disponibles ─────────────────────────────────────────────────
  var suggested = typeof _suggestedCompound === 'function' ? _suggestedCompound() : 'medium';
  var compounds = ['soft', 'medium', 'hard'];
  if (weather.id === 'wet' || weather.id === 'storm') {
   compounds = ['wet', 'inter', 'medium'];
   suggested = 'wet';
  } else if (weather.id === 'damp') {
   compounds = ['inter', 'medium', 'soft'];
   suggested = 'inter';
  }

  // ── Simulation de position post-pit ──────────────────────────────────────
  function _simPitNow() {
   if (!p || !hasPits) return null;
   var dur = ((cfg.stopTimeMin || 22) + (cfg.stopTimeMax || 28)) / 2;
   var places = typeof _computePlacesLostByPit === 'function' ? _computePlacesLostByPit(p, dur) : 2;
   return { pos: Math.min((LIVE_RACE.drivers.length), p.pos + places), places: places, lap: lap + 1, dur: Math.round(dur) };
  }
  function _simPitIn(n) {
   if (!p || !hasPits) return null;
   // En attendant n tours, les rivaux se rapprochent mais on perd moins de places
   // car certains auront pité entre-temps
   var dur = ((cfg.stopTimeMin || 22) + (cfg.stopTimeMax || 28)) / 2;
   var stratD = typeof _getRivalStratData === 'function' ? _getRivalStratData() : [];
   var rivalsPitBefore = stratD.filter(function(r) {
    return r.lapsToEstPit !== null && r.lapsToEstPit <= n && r.pos < p.pos;
   }).length;
   var places = typeof _computePlacesLostByPit === 'function' ? _computePlacesLostByPit(p, dur) : 2;
   var adjustedPlaces = Math.max(0, places - rivalsPitBefore);
   return { pos: Math.min(LIVE_RACE.drivers.length, p.pos + adjustedPlaces), places: adjustedPlaces, lap: lap + n, rivalsPit: rivalsPitBefore };
  }
  function _simStay() {
   // Rester : dégradation accélérée mais pas de places perdues au pit
   if (!p || !hasPits) return null;
   var life = typeof p._tyreLife === 'number' ? p._tyreLife : 60;
   var cmp = p._tyreCompound || 'medium';
   var deg = typeof _tyreLifeDegPerLap === 'function' ? _tyreLifeDegPerLap(cmp, weather.id, circuitData.type) : 2.5;
   var lapsToCritical = life > 20 ? Math.round((life - 15) / deg) : 0;
   var paceImpact = typeof _tyreLifePaceImpact === 'function' ? _tyreLifePaceImpact(Math.max(0, (life - deg * lapsToCritical) / 100)) : 1.2;
   return { lapsToCritical: lapsToCritical, paceImpact: paceImpact.toFixed(1) };
  }

  var simNow = _simPitNow();
  var simIn3 = _simPitIn(3);
  var simStay = _simStay();

  // ── Données rivaux ────────────────────────────────────────────────────────
  var stratData = typeof _getRivalStratData === 'function' ? _getRivalStratData() : [];

  // ── Message radio ingénieur ───────────────────────────────────────────────
  function _buildRadioMsg() {
   if (!hasPits) return null;
   var pitSoon = stratData.filter(function(r) { return r.lapsToEstPit !== null && r.lapsToEstPit <= 3 && r.pos < p.pos; });
   var recentPit = stratData.filter(function(r) { return r.pitRecent && r.pos < p.pos; });
   var lowTyre = typeof p._tyreLife === 'number' && p._tyreLife < 35;
   var veryLowTyre = typeof p._tyreLife === 'number' && p._tyreLife < 18;

   if (veryLowTyre)
    return 'Pneus critiques — rentre MAINTENANT, tu perds plus de 1s au tour.';
   if (recentPit.length > 0 && inWindow)
    return recentPit[0].name.split(' ').pop() + ' vient de pitter. Si tu rentres maintenant, tu ressors juste devant lui — undercut !';
   if (pitSoon.length >= 2 && !lowTyre)
    return pitSoon.map(function(r) { return r.name.split(' ').pop(); }).slice(0,2).join(' et ') + ' rentrent dans ' + pitSoon[0].lapsToEstPit + ' tours. Tiens encore — overcut possible.';
   if (pitSoon.length === 1 && !lowTyre)
    return pitSoon[0].name.split(' ').pop() + ' rentre dans ' + pitSoon[0].lapsToEstPit + ' tour' + (pitSoon[0].lapsToEstPit > 1 ? 's' : '') + '. Reste en piste pour l\'overcut.';
   if (lowTyre && inWindow)
    return 'Pneus à ' + Math.round(p._tyreLife) + '% — bon moment pour rentrer, la fenêtre est ouverte.';
   if (!inWindow && toOpen > 0)
    return 'Fenêtre dans ' + toOpen + ' tours. Préserve tes pneus jusqu\'à T' + Math.ceil(wStart * total) + '.';
   if (inWindow && toClose <= 5)
    return 'Fenêtre se ferme dans ' + toClose + ' tour' + (toClose > 1 ? 's' : '') + '. C\'est maintenant ou jamais.';
   return 'Situation stable. Surveille la dégradation et les arrêts adverses.';
  }
  var radioMsg = _buildRadioMsg();

  // ── Fenêtre pit — bandeau coloré ──────────────────────────────────────────
  var windowColor, windowLabel, windowDetail;
  if (isSprintM) {
   windowColor = '#6B7280'; windowLabel = 'SPRINT — pas de pit'; windowDetail = '';
  } else if (inWindow) {
   var urg = toClose <= 3 ? 'var(--red,#EF4444)' : toClose <= 8 ? 'var(--amber,#F59E0B)' : 'var(--green,#34D399)';
   windowColor = urg; windowLabel = 'FENÊTRE OUVERTE'; windowDetail = toClose + ' tour' + (toClose > 1 ? 's' : '');
  } else if (toOpen > 0) {
   windowColor = 'var(--blue,#60A5FA)'; windowLabel = 'DANS ' + toOpen + ' TOURS';
   windowDetail = 'T' + Math.ceil(wStart * total) + ' → T' + Math.ceil(wEnd * total);
  } else if (playerPitsDone < minStops) {
   windowColor = 'var(--red,#EF4444)'; windowLabel = 'FERMÉE — ARRÊT REQUIS'; windowDetail = '';
  } else {
   windowColor = 'var(--dim,#6B7280)'; windowLabel = 'FERMÉE'; windowDetail = '';
  }

  // ── BUILD HTML ─────────────────────────────────────────────────────────────
  var lapStr = 'Tour ' + lap + ' / ' + total;

  // Header
  var html = '<div style="width:100%;max-width:480px;max-height:88vh;background:linear-gradient(180deg,var(--bg3,#151520) 0%,var(--bg2,#111118) 100%);border:1px solid var(--border-hi,rgba(255,255,255,0.12));border-radius:16px 16px 0 0;overflow:hidden;display:flex;flex-direction:column">';

  // Header row
  html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px 10px;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0">';
  html += '<div><div style="font-family:var(--font-display);font-size:9px;color:var(--muted);letter-spacing:.16em;text-transform:uppercase">Mur des stands</div>';
  html += '<div style="font-family:var(--font-display);font-size:15px;font-weight:800;color:var(--text)">' + lapStr + '</div></div>';
  // Fenêtre pill dans le header
  html += '<div style="display:flex;align-items:center;gap:8px">';
  if (hasPits && !isSprintM) {
   html += '<span style="font-family:var(--font-display);font-size:9px;font-weight:800;color:' + windowColor + ';background:rgba(255,255,255,0.04);border:1px solid currentColor;padding:3px 8px;border-radius:20px;letter-spacing:.06em">'
         + windowLabel + (windowDetail ? ' · ' + windowDetail : '') + '</span>';
  }
  html += '<button onclick="renderPitWall()" style="background:none;border:none;color:var(--text3);font-size:22px;cursor:pointer;padding:0;line-height:1">×</button>';
  html += '</div></div>';

  // Scrollable body
  html += '<div style="overflow-y:auto;flex:1">';

  // ── SECTION 1 : DÉCISION PIT ───────────────────────────────────────────────
  if (hasPits && !isSprintM) {
   html += '<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--muted);letter-spacing:.16em;text-transform:uppercase;padding:10px 14px 6px;border-bottom:1px solid rgba(255,255,255,0.06)">Décision Pit Stop</div>';

   // Compounds grid
   html += '<div style="display:flex;gap:6px;padding:10px 14px 8px">';
   compounds.forEach(function(comp) {
    var eff = typeof _compoundEffects === 'function' ? _compoundEffects(comp, weather.id) : { paceBonus: 0, wearMult: 1, label: comp, icon: '' };
    var ci = (typeof TYRE_COMPOUND_INFO !== 'undefined' && TYRE_COMPOUND_INFO[comp]) || { color: '#9CA3AF', short: 'M', label: comp };
    var isSugg = comp === suggested;
    var deg = typeof _tyreLifeDegPerLap === 'function' ? _tyreLifeDegPerLap(comp, weather.id, circuitData.type) : 2.5;
    var lapsEst = deg > 0 ? Math.round((100 - 20) / deg) : 0;
    var paceTxt = eff.paceBonus < -0.001 ? (eff.paceBonus.toFixed(2) + 's/t') : eff.paceBonus > 0.001 ? ('+' + eff.paceBonus.toFixed(2) + 's/t') : 'neutre';
    var wearTxt = eff.wearMult >= 1.4 ? 'Usure ↑↑' : eff.wearMult >= 1.1 ? 'Usure ↑' : eff.wearMult <= 0.8 ? 'Usure ↓' : 'Usure normale';
    var bg = isSugg ? 'rgba(52,211,153,0.09)' : 'rgba(255,255,255,0.03)';
    var border = isSugg ? '1.5px solid var(--green,#34D399)' : '1px solid var(--border,rgba(255,255,255,0.10))';
    var textC = ci.text || (comp === 'hard' ? '#111' : '#fff');

    html += '<div onclick="_pwSelectCompound(this,\'' + comp + '\')" data-compound="' + comp + '" style="flex:1;padding:8px 6px 7px;border-radius:9px;border:' + border + ';background:' + bg + ';cursor:pointer;text-align:center;position:relative">';
    if (isSugg) html += '<div style="position:absolute;top:-7px;left:50%;transform:translateX(-50%);background:var(--green,#34D399);color:#0a0510;font-size:7px;font-weight:800;padding:1px 6px;border-radius:3px;letter-spacing:.04em;white-space:nowrap">Conseillé</div>';
    html += '<div style="width:16px;height:16px;border-radius:50%;background:' + ci.color + ';margin:4px auto 5px;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:900;color:' + textC + ';border:1px solid rgba(255,255,255,0.15)">' + (ci.short || 'M') + '</div>';
    html += '<div style="font-size:11px;font-weight:700;color:var(--text);line-height:1.2">' + (ci.label || comp) + '</div>';
    html += '<div style="font-family:var(--font-display);font-size:9px;color:' + (eff.paceBonus < 0 ? 'var(--green,#34D399)' : eff.paceBonus > 0 ? 'var(--text3)' : 'var(--text2)') + ';margin-top:2px">' + paceTxt + '</div>';
    html += '<div style="font-size:8px;color:var(--text3);margin-top:1px">~' + lapsEst + 't · ' + wearTxt + '</div>';
    html += '</div>';
   });
   html += '</div>';

   // Simulation de position
   if (simNow || simIn3 || simStay) {
    html += '<div style="margin:0 14px 10px;background:var(--surface2,rgba(255,255,255,0.03));border:1px solid var(--border,rgba(255,255,255,0.08));border-radius:9px;overflow:hidden">';
    html += '<div style="font-family:var(--font-display);font-size:8px;font-weight:800;color:var(--muted);letter-spacing:.12em;text-transform:uppercase;padding:7px 12px 5px;border-bottom:1px solid rgba(255,255,255,0.05)">Simulation de position</div>';
    if (simNow) {
     var posColor0 = simNow.places > 2 ? 'var(--red,#EF4444)' : simNow.places > 0 ? 'var(--amber,#F59E0B)' : 'var(--green,#34D399)';
     html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 12px;border-bottom:1px solid rgba(255,255,255,0.04)">';
     html += '<span style="font-size:10px;color:var(--text2)">Maintenant</span>';
     html += '<span style="display:flex;align-items:center;gap:8px">';
     html += '<span style="font-family:var(--font-display);font-size:13px;font-weight:800;color:' + posColor0 + '">P' + simNow.pos + '</span>';
     html += '<span style="font-size:9px;color:var(--text3)">–' + simNow.places + ' pl. · ressort T' + simNow.lap + ' (' + simNow.dur + 's)</span>';
     html += '</span></div>';
    }
    if (simIn3) {
     var posColor1 = simIn3.places > 2 ? 'var(--red,#EF4444)' : simIn3.places > 0 ? 'var(--amber,#F59E0B)' : 'var(--green,#34D399)';
     var overcutNote = simIn3.rivalsPit > 0 ? ' · ' + simIn3.rivalsPit + ' rival' + (simIn3.rivalsPit > 1 ? 's pitté' : ' pitté') : '';
     html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 12px;border-bottom:1px solid rgba(255,255,255,0.04)">';
     html += '<span style="font-size:10px;color:var(--text2)">Attendre 3 tours</span>';
     html += '<span style="display:flex;align-items:center;gap:8px">';
     html += '<span style="font-family:var(--font-display);font-size:13px;font-weight:800;color:' + posColor1 + '">P' + simIn3.pos + '</span>';
     html += '<span style="font-size:9px;color:var(--text3)">–' + simIn3.places + ' pl.' + overcutNote + '</span>';
     html += '</span></div>';
    }
    if (simStay) {
     var stayColor = simStay.lapsToCritical <= 3 ? 'var(--red,#EF4444)' : simStay.lapsToCritical <= 7 ? 'var(--amber,#F59E0B)' : 'var(--text3)';
     html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 12px">';
     html += '<span style="font-size:10px;color:var(--text2)">Rester en piste</span>';
     html += '<span style="font-size:9px;color:' + stayColor + '">';
     if (simStay.lapsToCritical > 0) {
      html += 'Falaise dans ~' + simStay.lapsToCritical + 't · –' + simStay.paceImpact + 's/t';
     } else {
      html += 'Pneus critiques — dégradation sévère';
     }
     html += '</span></div>';
    }
    html += '</div>';
   }

   // Bouton pit
   var pitInWindow = inWindow && canPit;
   var pitBg = pitInWindow ? '#E0A800' : 'rgba(255,255,255,0.06)';
   var pitColor = pitInWindow ? '#0a0510' : 'var(--text3)';
   var pitBorder = pitInWindow ? 'none' : '1px solid var(--border)';
   if (canPit) {
    html += '<div style="padding:0 14px 12px">';
    html += '<button id="pw-pit-btn" style="width:100%;padding:11px;background:' + pitBg + ';color:' + pitColor + ';border:' + pitBorder + ';border-radius:9px;font-family:var(--font-display);font-size:11px;font-weight:800;letter-spacing:.10em;text-transform:uppercase;cursor:pointer"> Rentrer aux stands — Pit stop</button>';
    html += '</div>';
   }
  }

  // ── SECTION 2 : INGÉNIEUR ─────────────────────────────────────────────────
  html += '<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--muted);letter-spacing:.16em;text-transform:uppercase;padding:10px 14px 6px;border-top:1px solid rgba(255,255,255,0.07);border-bottom:1px solid rgba(255,255,255,0.06)">Ingénieur</div>';

  // Radio
  if (radioMsg) {
   html += '<div style="margin:8px 14px;background:rgba(52,211,153,0.06);border:1px solid rgba(52,211,153,0.18);border-left:3px solid var(--green,#34D399);border-radius:8px;padding:8px 10px 8px 10px">';
   html += '<div style="font-family:var(--font-display);font-size:8px;font-weight:800;color:var(--green,#34D399);letter-spacing:.10em;text-transform:uppercase;margin-bottom:4px">Radio ingénieur</div>';
   html += '<div style="font-size:12px;color:var(--text);line-height:1.5">"' + radioMsg + '"</div>';
   html += '</div>';
  }

  // Tableau rivaux proches
  if (stratData.length > 0) {
   html += '<div style="font-size:9px;font-weight:700;color:var(--text3);padding:4px 14px 4px;letter-spacing:.04em">Pneus rivaux proches</div>';
   html += '<div style="margin:0 0 4px">';
   stratData.forEach(function(d) {
    var ci = (typeof TYRE_COMPOUND_INFO !== 'undefined' && TYRE_COMPOUND_INFO[d.compound]) || { color: '#9CA3AF', short: 'M', text: '#fff' };
    var life = d.life !== null ? d.life : null;
    var lifeColor = life === null ? 'var(--text3)' : life > 60 ? 'var(--green,#34D399)' : life > 30 ? 'var(--amber,#F59E0B)' : 'var(--red,#EF4444)';
    var lifeW = life !== null ? Math.max(0, Math.min(100, Math.round(life))) : 0;

    var pitTxt = '', pitColor2 = 'var(--text3)';
    if (d.pitRecent) { pitTxt = 'Box'; pitColor2 = 'var(--amber,#F59E0B)'; }
    else if (d.lapsToEstPit !== null && d.lapsToEstPit <= 3) { pitTxt = '~T' + d.pitLapEst + ' (' + d.lapsToEstPit + 't)'; pitColor2 = 'var(--blue,#60A5FA)'; }
    else if (d.pitLapEst) { pitTxt = 'T' + d.pitLapEst + '?'; pitColor2 = 'var(--text3)'; }
    else if (d.pitDone > 0) { pitTxt = 'Arrêt fait'; pitColor2 = '#A78BFA'; }

    var oppBadge = '';
    // Vérif undercut : rival devant vient de pitter, gap < 8s
    if (d.ahead && d.pitRecent && d.gapSec < 8)
     oppBadge = '<span style="font-size:8px;padding:1px 4px;background:rgba(245,158,11,0.18);color:var(--amber,#F59E0B);border-radius:3px;font-weight:800;margin-left:4px">UC</span>';
    // Vérif overcut : rival devant va pitter dans ≤2 tours, gap < 5s
    else if (d.ahead && d.lapsToEstPit !== null && d.lapsToEstPit <= 2 && d.gapSec < 5)
     oppBadge = '<span style="font-size:8px;padding:1px 4px;background:rgba(96,165,250,0.18);color:var(--blue,#60A5FA);border-radius:3px;font-weight:800;margin-left:4px">OC</span>';

    var posColor2 = d.pos <= 3 ? 'var(--green,#34D399)' : 'var(--text3)';
    var textC2 = ci.text || '#fff';
    var dName = (typeof formatPilotName === 'function') ? formatPilotName(d.name, false, '') : d.name.split(' ').pop();

    html += '<div style="display:flex;align-items:center;gap:6px;padding:5px 14px;border-bottom:1px solid rgba(255,255,255,0.04)">';
    html += '<span style="font-family:var(--font-display);font-size:11px;font-weight:800;color:' + posColor2 + ';width:22px;flex-shrink:0">P' + d.pos + '</span>';
    html += '<span style="font-size:11px;color:var(--text2);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + dName + oppBadge + '</span>';
    html += '<span style="display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:50%;background:' + ci.color + ';font-size:7px;font-weight:900;color:' + textC2 + ';flex-shrink:0;border:1px solid rgba(255,255,255,0.12)">' + (ci.short || 'M') + '</span>';
    if (life !== null) {
     html += '<div style="width:40px;height:3px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden;flex-shrink:0"><div style="width:' + lifeW + '%;height:100%;background:' + lifeColor + ';border-radius:2px"></div></div>';
     html += '<span style="font-family:var(--font-display);font-size:9px;font-weight:700;color:' + lifeColor + ';width:26px;text-align:right;flex-shrink:0">' + lifeW + '%</span>';
    } else {
     html += '<span style="width:70px;flex-shrink:0"></span>';
    }
    html += '<span style="font-family:var(--font-display);font-size:9px;color:' + pitColor2 + ';width:60px;text-align:right;flex-shrink:0">' + pitTxt + '</span>';
    html += '</div>';
   });
   html += '</div>';
  }


  // ── CHAMPIONNAT EN DIRECT ────────────────────────────────────────
  var _hasChampData = typeof G !== 'undefined' && G.rivals && G.rivals.length > 0 && typeof G.champPts !== 'undefined';
  if (_hasChampData) {
    // Construire le classement complet avec joueur + rivaux
    var _allStandings = [];
    _allStandings.push({ name: (G.pilot ? (G.pilot.prenom ? G.pilot.prenom[0]+'. '+G.pilot.nom : G.pilot.nom) : 'Moi'), pts: G.champPts || 0, isPlayer: true });
    G.rivals.forEach(function(rv) {
      _allStandings.push({ name: rv.name ? rv.name.split(' ').pop() : 'Rival', pts: rv.pts || 0, isPlayer: false });
    });
    _allStandings.sort(function(a,b) { return b.pts - a.pts; });

    var _playerChampPos = _allStandings.findIndex(function(s) { return s.isPlayer; }) + 1;

    // Prendre les 2 devant et 2 derrière le joueur
    var _playerIdx = _allStandings.findIndex(function(s) { return s.isPlayer; });
    var _nearStandings = _allStandings.slice(Math.max(0, _playerIdx-2), Math.min(_allStandings.length, _playerIdx+3));

    html += '<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--muted);letter-spacing:.16em;text-transform:uppercase;padding:10px 14px 5px;border-top:1px solid rgba(255,255,255,0.07)">Championnat</div>';
    html += '<div style="padding:0 0 4px">';
    _nearStandings.forEach(function(s, i) {
      var _sRank = _allStandings.findIndex(function(x) { return x.name === s.name && x.isPlayer === s.isPlayer; }) + 1;
      var _isP = s.isPlayer;
      var _bg = _isP ? 'background:var(--red-bg,rgba(200,16,46,0.07));' : '';
      var _nameColor = _isP ? 'var(--text)' : 'var(--text2)';
      var _rankColor = _sRank === 1 ? 'var(--gold,#F59E0B)' : _sRank <= 3 ? 'var(--green,#34D399)' : _isP ? 'var(--red2,#C8102E)' : 'var(--text3)';
      // Delta par rapport au joueur
      var _playerPts = G.champPts || 0;
      var _delta = s.pts - _playerPts;
      var _deltaStr = _isP ? '' : (_delta > 0 ? '+'+_delta : String(_delta));
      var _deltaColor = _delta > 0 ? 'var(--red,#EF4444)' : _delta < 0 ? 'var(--green,#34D399)' : 'var(--text3)';

      html += '<div style="display:flex;align-items:center;gap:6px;padding:5px 14px;border-bottom:1px solid rgba(255,255,255,0.04);'+_bg+'">';
      html += '<span style="font-family:var(--font-display);font-size:11px;font-weight:800;color:'+_rankColor+';width:22px;flex-shrink:0">P'+_sRank+'</span>';
      html += '<span style="font-size:11px;color:'+_nameColor+';flex:1;font-weight:'+(_isP?'700':'400')+'">'+(_isP?'▶ ':'')+s.name+'</span>';
      html += '<span style="font-family:var(--font-display);font-size:11px;font-weight:700;color:var(--text2);width:40px;text-align:right">'+s.pts+'</span>';
      if (_deltaStr) html += '<span style="font-family:var(--font-display);font-size:9px;color:'+_deltaColor+';width:32px;text-align:right">'+_deltaStr+'</span>';
      else html += '<span style="width:32px"></span>';
      html += '</div>';
    });
    // Si > 5 pilotes au total, afficher "..." 
    if (_allStandings.length > 5) {
      html += '<div style="font-size:9px;color:var(--dim);text-align:center;padding:4px 14px">'+_allStandings.length+' pilotes au total — P'+_playerChampPos+'</div>';
    }
    html += '</div>';
  }

  // Légende UC/OC
  html += '<div style="display:flex;gap:12px;padding:6px 14px 10px;border-top:1px solid rgba(255,255,255,0.05)">';
  html += '<span style="font-size:9px;color:var(--amber,#F59E0B)"><b>UC</b> = Undercut</span>';
  html += '<span style="font-size:9px;color:var(--blue,#60A5FA)"><b>OC</b> = Overcut</span>';
  html += '</div>';

  html += '</div>'; // fin scrollable
  html += '</div>'; // fin container

  modal.innerHTML = html;
  modal.addEventListener('click', function(ev) { if (ev.target === modal) renderPitWall(); });

  // Bind bouton pit
  var pitBtn = modal.querySelector('#pw-pit-btn');
  if (pitBtn) {
   pitBtn.addEventListener('click', function() {
    var selected = modal.querySelector('[data-compound].pw-selected');
    var comp = selected ? selected.getAttribute('data-compound') : suggested;
    renderPitWall();
    _showCompoundPopup ? _showCompoundPopup() : _playerPit(false, comp);
   });
  }

  document.body.appendChild(modal);
 } catch(e) { console.warn('renderPitWall:', e); }
}

// Helper sélection compound dans la modale
function _pwSelectCompound(el, comp) {
 var parent = el.parentNode;
 if (!parent) return;
 parent.querySelectorAll('[data-compound]').forEach(function(b) {
  b.classList.remove('pw-selected');
  b.style.border = '1px solid var(--border,rgba(255,255,255,0.10))';
  b.style.background = 'rgba(255,255,255,0.03)';
 });
 el.classList.add('pw-selected');
 var ci = (typeof TYRE_COMPOUND_INFO !== 'undefined' && TYRE_COMPOUND_INFO[comp]) || { color: '#9CA3AF' };
 el.style.border = '1.5px solid ' + ci.color;
 el.style.background = ci.color + '14';
}


/* === FENÊTRE STRATÉGIQUE UNDERCUT / OVERCUT ===
 * Analyse en temps réel les rivaux proches pour détecter :
 *   - undercut possible : rival devant vient de pitter → pitter maintenant pour ressortir devant
 *   - overcut possible  : rival derrière va pitter → rester en piste pour conserver/prendre de l'écart
 *   - suggestion proactive : rival devant a des pneus dégradés → tu peux pousser fort
 */
function _getRivalStratData(){
 if(!LIVE_RACE||!LIVE_RACE.drivers)return[];
 var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});
 if(!p||p.dnf)return[];
 var cfg=_pitConfigForCat();
 var lap=LIVE_RACE.cur,total=LIVE_RACE.total;
 var rivals=LIVE_RACE.drivers.filter(function(d){return!d.isPlayer&&!d.dnf&&Math.abs((d.pos||99)-p.pos)<=4});
 return rivals.map(function(d){
  var pitLapEst=null;
  var pitDone=d._pitsDone||0;
  // Chercher le prochain pit stop planifié non fait
  if(d._pitsScheduled&&d._pitsScheduled.length){
   var next=d._pitsScheduled.find(function(pp){return!pp._done&&pp.lap>lap});
   if(next)pitLapEst=next.lap;
  }
  // Si pas de pit planifié mais cat avec dégradation, estimer depuis _tyreLife
  if(pitLapEst===null&&cfg&&cfg.degradeTyres&&typeof d._tyreLife==="number"){
   // Estimation grossière : combien de tours avant que la vie tombe sous 20%
   var life=d._tyreLife;
   var compound=d._tyreCompound||"medium";
   var w=RACE_STATE&&RACE_STATE.weather||{};
   var circ=RACE_STATE&&RACE_STATE.circuitData||{};
   var degPerLap=(typeof _tyreLifeDegPerLap==="function")?_tyreLifeDegPerLap(compound,w.id,circ.type):2.5;
   if(degPerLap>0&&life>20){
    var lapsLeft=Math.round((life-20)/degPerLap);
    pitLapEst=Math.min(total-1,lap+lapsLeft);
   }
  }
  var pitRecent=d._lastPitLap&&(lap-d._lastPitLap)<=2;
  var ahead=d.pos<p.pos;
  var gapSec=Math.abs(((d.score-(d.penaltySec||0)/45)-(p.score-(p.penaltySec||0)/45))*45);
  return{
   name:d.name,pos:d.pos,ahead:ahead,
   life:typeof d._tyreLife==="number"?d._tyreLife:null,
   compound:d._tyreCompound||"medium",
   pitLapEst:pitLapEst,
   pitDone:pitDone,
   pitRecent:pitRecent,
   gapSec:parseFloat(gapSec.toFixed(1)),
   lapsToEstPit:pitLapEst?Math.max(0,pitLapEst-lap):null
  };
 }).sort(function(a,b){return a.pos-b.pos});
}

function _checkStratOpportunity(){
 try{
  if(!LIVE_RACE||LIVE_RACE.finished||LIVE_RACE.paused)return;
  if(!LIVE_RACE._lastStratCheckLap)LIVE_RACE._lastStratCheckLap=-10;
  if(LIVE_RACE.cur-LIVE_RACE._lastStratCheckLap<3)return;
  var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});
  if(!p||p.dnf)return;
  var cfg=_pitConfigForCat();
  if(!cfg||!cfg.enabled||!cfg.degradeTyres)return;
  if(LIVE_RACE._isSprintMode)return; // pas de stratégie pit en sprint
  var pitsDone=p._pitsDone||0;
  if(pitsDone>=cfg.maxStops)return;
  var lap=LIVE_RACE.cur,total=LIVE_RACE.total;
  var phase=lap/total;
  if(phase<0.2||phase>0.88)return;
  var rivals=_getRivalStratData();
  var team=_getTeamPersonality&&_getTeamPersonality()||{tone:"neutral"};
  var msg=null;
  // --- UNDERCUT : rival devant vient de pitter, pneus neufs → pitter maintenant ---
  var justPitted=rivals.find(function(r){return r.ahead&&r.pitRecent&&r.gapSec<6});
  if(justPitted&&!LIVE_RACE._undercutAlertedFor){
   LIVE_RACE._undercutAlertedFor=justPitted.name;
   LIVE_RACE._lastStratCheckLap=lap;
   msg={
    title:"Undercut sur "+justPitted.name+" !",
    desc:justPitted.name+" vient de rentrer (P"+justPitted.pos+", "+justPitted.gapSec.toFixed(1)+"s). Si tu pitters maintenant, tu pourrais ressortir devant avec des pneus neufs.",
    color:"#F59E0B"
   };
  }
  // --- OVERCUT : rival derrière va bientôt pitter → rester en piste et creuser ---
  if(!msg){
   var aboutToPit=rivals.find(function(r){return!r.ahead&&r.lapsToEstPit!==null&&r.lapsToEstPit>=0&&r.lapsToEstPit<=2&&r.gapSec<4});
   if(aboutToPit&&!LIVE_RACE._overcutAlertedFor){
    LIVE_RACE._overcutAlertedFor=aboutToPit.name;
    LIVE_RACE._lastStratCheckLap=lap;
    msg={
     title:"Overcut — "+aboutToPit.name+" va rentrer",
     desc:aboutToPit.name+" (P"+aboutToPit.pos+") rentre dans ~"+aboutToPit.lapsToEstPit+" tour"+(aboutToPit.lapsToEstPit!==1?"s":"")+". Reste en piste et pousse fort — tu pourras le couvrir ou rester devant.",
     color:"#60A5FA"
    };
   }
  }
  // --- RIVAL DEVANT EN DIFFICULTÉ PNEUS : opportunité d'attaque ---
  if(!msg){
   var tyreStruggling=rivals.find(function(r){return r.ahead&&typeof r.life==="number"&&r.life<25&&r.gapSec<3});
   if(tyreStruggling&&!LIVE_RACE._tyreAttackAlertedFor){
    LIVE_RACE._tyreAttackAlertedFor=tyreStruggling.name;
    LIVE_RACE._lastStratCheckLap=lap;
    msg={
     title:tyreStruggling.name+" en limite de pneus",
     desc:""+tyreStruggling.name+" (P"+tyreStruggling.pos+", "+Math.round(tyreStruggling.life)+"% de vie) perd du rythme. C'est le moment d'attaquer.",
     color:"#34D399"
    };
   }
  }
  if(msg&&typeof pushRadioMsg==="function"){
   pushRadioMsg(msg.title,msg.desc,{ttl:5,color:msg.color});
   LIVE_RACE._lastStratCheckLap=lap;
  }
 }catch(e){console.warn("_checkStratOpportunity:",e)}
}

function renderPitButton(){var existing=document.getElementById("pit-button-container");if(existing)existing.remove();if(!LIVE_RACE||LIVE_RACE.finished)return;if(LIVE_RACE.paused)return;var status=getPlayerPitStatus();if(!status)return;var leaderboard=document.getElementById("live-leaderboard")||document.querySelector(".scr.is-active");if(!leaderboard)return;// Bouton Mur des stands (si pas déjà présent)
(function(){
 if(!document.getElementById('pitwall-btn')&&!LIVE_RACE.finished&&!LIVE_RACE._isSprintMode){
  var _lb=document.getElementById('live-leaderboard')||document.querySelector('.scr.is-active');
  if(_lb){
   var _mds=document.createElement('button');
   _mds.id='pitwall-btn';
   _mds.onclick=function(){if(typeof renderPitWall==='function')renderPitWall();};
   _mds.style.cssText='position:fixed;bottom:148px;left:14px;z-index:8000;padding:8px 10px;background:linear-gradient(180deg,rgba(15,25,45,0.95),rgba(8,15,30,0.95));color:#60A5FA;border:1px solid rgba(96,165,250,0.4);border-radius:9px;font-family:var(--font-display);font-size:9px;font-weight:800;letter-spacing:.10em;text-transform:uppercase;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.4)';
   _mds.innerHTML=' Mur';
   _lb.appendChild(_mds);
  }
 }
})();
var btnContainer=document.createElement("div");btnContainer.id="pit-button-container";btnContainer.style.cssText="position:fixed;bottom:90px;right:14px;z-index:8000;display:flex;flex-direction:column;align-items:flex-end;gap:6px";var bgColor=status.inWindow&&status.stopsRemaining>0?"linear-gradient(180deg,#FFD23F 0%,#E0A800 100%)":status.inWindow?"linear-gradient(180deg,#60A5FA 0%,#3B82F6 100%)":"linear-gradient(180deg,#6B7280 0%,#4B5563 100%)";var textColor=status.inWindow?"#0a0510":"#fff";var label=status.canPit?(status.stopsRemaining>0?" PIT obligatoire":" Box ?"):"Box terminé";// Contexte stratégique pour le sous-label
var _stratCtx="";
var _rivals=_getRivalStratData();
var _undercutTarget=_rivals.find(function(r){return r.ahead&&r.pitRecent&&r.gapSec<8;});
var _overcutTarget=_rivals.find(function(r){return!r.ahead&&r.lapsToEstPit!==null&&r.lapsToEstPit<=2&&r.gapSec<5;});
if(_undercutTarget)_stratCtx=" · 🎯 Undercut "+_undercutTarget.name.split(" ").pop();
else if(_overcutTarget)_stratCtx=" · 🔄 Overcut possible";
var subLabel=status.stopsDone+"/"+status.maxStops+" arrêts · F"+status.windowStart+"-"+status.windowEnd+_stratCtx;if(status.canPit){var dropTxt=status.estimatedPlacesLost===0?"reste P"+(LIVE_RACE.drivers.find(function(d){return d.isPlayer})||{}).pos:"-"+status.estimatedPlacesLost+" pl. estimées";subLabel+=" · "+dropTxt}var btn='<button onclick="_playerPit()" '+(status.canPit?"":'disabled')+' style="padding:11px 16px;background:'+bgColor+';color:'+textColor+';border:1px solid rgba(255,255,255,0.25);border-radius:10px;font-family:var(--font-display);font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;cursor:'+(status.canPit?"pointer":"not-allowed")+';box-shadow:0 4px 12px rgba(0,0,0,0.4);'+(status.canPit?"":"opacity:0.5")+'">'+label+'</button>';btn+='<div style="font-size:9.5px;color:var(--text3);background:var(--surface2);padding:3px 7px;border-radius:5px;border:1px solid var(--border);text-align:right">'+subLabel+'</div>';btnContainer.innerHTML=btn;
// Bouton mode pneus — gauche de l'écran, symétrique au bouton pit
var _existingTyreMode=document.getElementById("tyre-mode-container");
if(_existingTyreMode)_existingTyreMode.remove();
var _tmContainer=document.createElement("div");
_tmContainer.id="tyre-mode-container";
_tmContainer.style.cssText="position:fixed;bottom:90px;left:14px;z-index:8000;display:flex;flex-direction:column;align-items:flex-start;gap:5px";
var _curMode=(typeof LIVE_RACE!=="undefined"&&LIVE_RACE&&LIVE_RACE._tyreMode)||"normal";
var _isKartCatTM=(typeof G!=="undefined")&&(G.cat==="Karting Junior"||G.cat==="Karting Senior");
var _hasDegradeTM=(function(){var _c=(typeof _pitConfigForCat==="function")?_pitConfigForCat():null;return _c&&_c.degradeTyres;})();
if(!_isKartCatTM&&_hasDegradeTM){
 var _modes=[
  {id:"manage",label:"Gestion",icon:"🔋",color:"#34D399",bg:"linear-gradient(180deg,rgba(52,211,153,0.18) 0%,rgba(52,211,153,0.06) 100%)",border:"rgba(52,211,153,0.5)"},
  {id:"normal",label:"Normal",icon:"⚡",color:"#9CA3AF",bg:"linear-gradient(180deg,rgba(156,163,175,0.12) 0%,rgba(156,163,175,0.04) 100%)",border:"rgba(156,163,175,0.3)"},
  {id:"push",label:"Attaque",icon:"🔥",color:"#EF4444",bg:"linear-gradient(180deg,rgba(239,68,68,0.18) 0%,rgba(239,68,68,0.06) 100%)",border:"rgba(239,68,68,0.5)"}
 ];
 var _lifeNow=(function(){if(!LIVE_RACE||!LIVE_RACE.drivers)return 100;var _p=LIVE_RACE.drivers.find(function(d){return d.isPlayer;});return _p&&typeof _p._tyreLife==="number"?_p._tyreLife:100;})();
 // Rangée de 3 boutons compacts
 var _tmRow='<div style="display:flex;gap:4px;align-items:center">';
 _modes.forEach(function(m){
  var _active=_curMode===m.id;
  var _activeStyle=_active?';box-shadow:0 0 0 1.5px '+m.color+',0 2px 8px rgba(0,0,0,0.4)':'';
  _tmRow+='<button onclick="_setTyreMode(&quot;"+m.id+"&quot;)" style="padding:8px 10px;background:'+(_active?m.bg:'rgba(20,20,28,0.85)')+';color:'+(_active?m.color:'#6B7280')+';border:1px solid '+(_active?m.border:'rgba(255,255,255,0.08)')+';border-radius:9px;font-family:var(--font-display);font-size:10px;font-weight:800;letter-spacing:.04em;cursor:pointer;transition:all .15s;-webkit-tap-highlight-color:transparent'+_activeStyle+'">'+m.icon+' '+m.label+'</button>';
 });
 _tmRow+='</div>';
 // Sous-label contextuel
 var _subTxt={
  "manage":"Usure −30% · rythme −",
  "normal":"Mode standard",
  "push":"Pace + · usure ↑↑"
 }[_curMode]||"";
 var _subColor={manage:"#34D399",normal:"#6B7280",push:"#EF4444"}[_curMode]||"#6B7280";
 if(_lifeNow<30&&_curMode==="push"){_subTxt="⚠ Pneus critiques !";}
 var _subLabel='<div style="font-size:9px;color:'+_subColor+';background:rgba(10,5,16,0.8);padding:2px 7px;border-radius:4px;border:1px solid rgba(255,255,255,0.06);text-align:left">'+_subTxt+'</div>';
 _tmContainer.innerHTML=_tmRow+_subLabel;
}
document.body.appendChild(btnContainer);
if(_tmContainer.innerHTML)document.body.appendChild(_tmContainer);}
/* === EVENT EFFECTS ENGINE — Persistent paceMods, forced position swaps, tyre state ===
   Tous les événements passent par applyEventOutcome(driver, outcome) pour appliquer leurs
   conséquences de façon cohérente avec le classement. Effets cibles (réaliste F1) :
   un mauvais choix coûte 1-3 secondes ou peut forcer une perte de positions visible. */
function _evtInit(d){if(!d)return;if(!d._evtFx)d._evtFx={paceMods:[],forcedSwapsThisTurn:0};return d._evtFx}
function _evtPaceSecThisLap(d){
 // Somme les deltaSec actifs des paceMods, avec une atténuation en début/fin de durée pour un ressenti plus naturel.
 if(!d||!d._evtFx||!d._evtFx.paceMods||!d._evtFx.paceMods.length)return 0;
 var total=0,now=LIVE_RACE.cur;
 for(var i=0;i<d._evtFx.paceMods.length;i++){
  var pm=d._evtFx.paceMods[i];
  if(pm.lapsLeft<=0)continue;
  // Légère atténuation : effet à 70% au tout dernier tour de l'effet pour un fade-out doux
  var att=pm.lapsLeft===1?0.7:1.0;
  total+=pm.deltaSec*att;
 }
 return total;
}
function _evtTickPaceMods(d){
 if(!d||!d._evtFx||!d._evtFx.paceMods)return;
 // Décrémente la durée et nettoie les expirés
 var kept=[];
 for(var i=0;i<d._evtFx.paceMods.length;i++){
  var pm=d._evtFx.paceMods[i];
  pm.lapsLeft=(pm.lapsLeft||0)-1;
  if(pm.lapsLeft>0)kept.push(pm);
 }
 d._evtFx.paceMods=kept;
 d._evtFx.forcedSwapsThisTurn=0;
}
function _evtAddPaceMod(d,deltaSec,laps,reason){
 // Ajoute un malus/bonus de pace en secondes/tour pendant N tours.
 // Cap dur pour éviter les valeurs extrêmes : -2.0s à +1.0s par mod.
 if(!d||!laps||laps<=0)return;
 deltaSec=Math.max(-2.0,Math.min(1.0,deltaSec||0));
 _evtInit(d);
 d._evtFx.paceMods.push({deltaSec:deltaSec,lapsLeft:laps,reason:reason||"event",addedLap:LIVE_RACE.cur});
 // Soft cap : si plus de 4 paceMods négatifs actifs simultanément, on garde les 4 plus récents
 var negs=d._evtFx.paceMods.filter(function(pm){return pm.deltaSec<0});
 if(negs.length>4){
  // Trier par addedLap desc, garder les 4 plus récents
  negs.sort(function(a,b){return b.addedLap-a.addedLap});
  var keepNegs=negs.slice(0,4);
  var pos=d._evtFx.paceMods.filter(function(pm){return pm.deltaSec>=0});
  d._evtFx.paceMods=pos.concat(keepNegs);
 }
}

function _evtForceSwap(d,deltaPos){
 // Force un échange de positions : deltaPos > 0 = perte de places, < 0 = gain de places.
 // Effectue les swaps un par un avec les voisins immédiats vivants. Respecte les contraintes physiques :
 // - On ne fait pas swapper un pilote en train de pit (pit lap récent, écart abusif)
 // - On garantit que les positions restent plausibles via score
 if(!d||d.dnf||!deltaPos)return 0;
 _evtInit(d);
 var alive=LIVE_RACE.drivers.filter(function(x){return!x.dnf});
 var n=alive.length;
 if(n<2)return 0;
 var dir=deltaPos>0?1:-1; // +1 = on recule (pos augmente), -1 = on avance (pos diminue)
 var nbAttempts=Math.abs(deltaPos);
 var done=0;
 for(var k=0;k<nbAttempts;k++){
  // Cible = pilote à pos = d.pos + dir, alive
  var target=alive.find(function(x){return x.pos===d.pos+dir});
  if(!target)break;
  // Refuse de swapper avec un pilote en pit récent (sortie de pit, mécanique diff)
  if(target._lastPitLap&&LIVE_RACE.cur-target._lastPitLap<=1)break;
  // Swap pos
  var tmpPos=d.pos;d.pos=target.pos;target.pos=tmpPos;
  // Petit ajustement de score pour cohérence avec le classement (le classement est trié par score).
  // On les rapproche pour qu'ils restent dans le bon ordre selon score-(penalty/45).
  var dEff=d.score-(d.penaltySec||0)/45;
  var tEff=target.score-(target.penaltySec||0)/45;
  if(dir>0){
   // d a perdu une place : il doit avoir un score effectif <= target
   if(dEff>=tEff){
    var diff=dEff-tEff+0.002;
    d.score=Math.max(.02,d.score-diff);
   }
  }else{
   // d a gagné une place : il doit avoir un score effectif >= target
   if(dEff<=tEff){
    var diff2=tEff-dEff+0.002;
    d.score=Math.min(.99,d.score+diff2);
   }
  }
  done++;
 }
 // On bypasse le position cap pour cette mise à jour, sinon updateLivePositions risque de réannuler le swap
 LIVE_RACE._bypassPositionCap=true;
 d._evtFx.forcedSwapsThisTurn=(d._evtFx.forcedSwapsThisTurn||0)+done*dir;
 return done*dir;
}
function _evtSetTyreState(d,laps,severity){
 // severity: "minor" | "major" — affecte la dégradation pneus pour N tours
 if(!d||!laps)return;
 _evtInit(d);
 d._evtFx.tyreDamage={lapsLeft:laps,severity:severity||"minor",addedLap:LIVE_RACE.cur};
}
function _evtTickTyre(d){
 if(!d||!d._evtFx||!d._evtFx.tyreDamage)return 0;
 var t=d._evtFx.tyreDamage;
 t.lapsLeft=(t.lapsLeft||0)-1;
 if(t.lapsLeft<=0){d._evtFx.tyreDamage=null;return 0}
 // Conversion en perte de pace : minor = +0.3s/lap, major = +0.7s/lap
 return t.severity==="major"?0.7:0.3;
}
/* applyEventOutcome — point d'entrée unique pour appliquer un résultat d'événement.
   outcome = {
     posLoss: int (perte de N positions, swap immédiat),
     posGain: int (gain de N positions, swap immédiat),
     paceMod: { deltaSec: float, laps: int, reason: string } | array,
     tyreDamage: { laps: int, severity: "minor"|"major" },
     penaltySec: float (pénalité dure en secondes),
     scoreShift: float (legacy : modification du baseScore lissée, ±0.04 max),
     dnf: bool,
     reason: string
   }
   Retourne un descriptif de ce qui a été appliqué pour le log. */
function applyEventOutcome(d,outcome){
 if(!d||d.dnf||!outcome)return{summary:""};
 _evtInit(d);
 var applied=[];
 // 1. DNF prend priorité absolue
 if(outcome.dnf){
  d.dnf=true;d.score=0;
  applied.push("DNF");
  return{summary:applied.join(" · "),lostSec:99,lostPos:99}
 }
 // 2. Pénalité dure (secondes)
 if(typeof outcome.penaltySec==="number"&&outcome.penaltySec>0){
  d.penaltySec=Math.round((d.penaltySec||0)+outcome.penaltySec);
  d.penaltyLog||(d.penaltyLog=[]);
  d.penaltyLog.push({sec:outcome.penaltySec,reason:outcome.reason||"événement",lap:LIVE_RACE.cur});
  applied.push("+"+Math.round(outcome.penaltySec)+"s");
 }
 // 3. paceMod(s) — un objet ou un array
 if(outcome.paceMod){
  var pms=Array.isArray(outcome.paceMod)?outcome.paceMod:[outcome.paceMod];
  for(var i=0;i<pms.length;i++){
   var pm=pms[i];
   if(pm&&typeof pm.deltaSec==="number"&&pm.laps>0){
    _evtAddPaceMod(d,pm.deltaSec,pm.laps,pm.reason||outcome.reason);
    var totalEff=(pm.deltaSec*pm.laps);
    applied.push((pm.deltaSec>0?"+":"")+totalEff.toFixed(1)+"s sur "+pm.laps+"T");
   }
  }
 }
 // 4. État pneus persistant
 if(outcome.tyreDamage&&outcome.tyreDamage.laps>0){
  _evtSetTyreState(d,outcome.tyreDamage.laps,outcome.tyreDamage.severity);
  applied.push("pneus dégradés "+outcome.tyreDamage.laps+"T");
 }
 // 5. Score shift legacy (compat avec ancien système, clampé)
 if(typeof outcome.scoreShift==="number"&&outcome.scoreShift!==0){
  var ss=Math.max(-0.04,Math.min(0.04,outcome.scoreShift));
  if(typeof d.eventScoreOffset!=="number")d.eventScoreOffset=0;
  d.eventScoreOffset=Math.max(-.10,Math.min(.10,d.eventScoreOffset+0.5*ss));
  d.score=Math.min(.99,Math.max(.02,d.score+0.4*ss));
 }
 // 6. Position swap (forcé) — fait après les ajustements de score pour ne pas être annulé
 var posChange=0;
 if(outcome.posLoss&&outcome.posLoss>0){posChange=_evtForceSwap(d,outcome.posLoss)}
 else if(outcome.posGain&&outcome.posGain>0){posChange=_evtForceSwap(d,-outcome.posGain)}
 if(posChange!==0){applied.push((posChange>0?"-":"+")+Math.abs(posChange)+" pos")}
 return{summary:applied.join(" · "),posChange:posChange};
}
/* _convertLegacyMod — convertit un ancien `mod` (échelle ~±0.05) en outcome concret.
   La règle de conversion (calibrée pour "réaliste F1, 1-3s par mauvais choix") :
   - mod > 0 : bonus de pace léger (mod*30 secondes total, sur 3 tours)
   - mod < -0.05 : malus dur — paceMod sur 5 tours + scoreShift léger
   - mod entre -0.05 et 0 : malus modéré — paceMod sur 3 tours uniquement
   Cette fonction est appelée par les chemins legacy pour que les anciens events
   sans `outputs` explicites bénéficient du nouveau système. */
function _convertLegacyMod(d,mod,reason){
 if(!d||typeof mod!=="number"||mod===0)return null;
 var phase=LIVE_RACE&&LIVE_RACE.total>0?LIVE_RACE.cur/LIVE_RACE.total:0.5;
 var phaseMul=phase<0.15?1.1:phase<0.3?1.05:phase<0.65?1.0:phase<0.88?0.85:0.7;
 var amod=Math.abs(mod);
 var deltaSec,laps;
 if(amod<=0.015){
  // Très petit effet : 1 tour léger
  deltaSec=(mod>0?-1:1)*0.4*phaseMul;
  laps=2;
 }else if(amod<=0.04){
  // Effet modéré : 3 tours
  deltaSec=(mod>0?-1:1)*0.5*phaseMul;
  laps=3;
 }else if(amod<=0.08){
  // Gros effet : 5 tours
  deltaSec=(mod>0?-1:1)*0.6*phaseMul;
  laps=5;
 }else{
  // Effet majeur : 6 tours
  deltaSec=(mod>0?-1:1)*0.7*phaseMul;
  laps=6;
 }
 return{paceMod:{deltaSec:deltaSec,laps:laps,reason:reason||"événement"},reason:reason};
}
// #3 — Usure progressive des pneus par tour de stint.
// Reset au pit (champ _tyreLapsOnSet remis à 0 par _playerPit / _applyRivalPitsForLap).
// Si non initialisé, on initialise à partir du tour courant.
/* #9 — IndyCar : détection oval vs road/street.
 - Ovales dans le calendrier : Texas, Indianapolis 500, Iowa, Gateway
 - Nashville était un street puis a déménagé sur oval — on le classe oval
 - Tous les autres = road/street
 Helper utilisé par : pondération events (freinage/duels désactivés sur oval),
 pondération safety_car (×3 sur oval), aspiration renforcée sur oval. */
function _isIndyOval(circuitName){
 if(!circuitName||(typeof G==="undefined")||G.cat!=="IndyCar")return false;
 var n=String(circuitName).toLowerCase();
 return n.indexOf("texas")>=0||n.indexOf("indianapolis 500")>=0||n.indexOf("indy 500")>=0||
        n.indexOf("iowa")>=0||n.indexOf("gateway")>=0||n.indexOf("nashville")>=0;
}
function _isOvalRace(){
 var c=(typeof RACE_STATE!=="undefined"&&RACE_STATE&&RACE_STATE.circuit)||"";
 return _isIndyOval(c);
}
/* #8 — WEC Endurance : helpers de détection.
 - _isWECRace : la cat est Endurance WEC
 - _isLongEnduranceRace : course 6h+ ou Le Mans (où relais et nuit sont pertinents)
 - _isLeMansRace : la course est le 24h Le Mans (effets nuit spécifiques)
 - _wecPhase : retourne "stint1", "stint2", "stint3", "night" ou null selon la progression */
function _isWECRace(){
 return typeof G!=="undefined"&&G.cat==="Endurance WEC";
}
function _isLongEnduranceRace(){
 if(!_isWECRace())return false;
 var c=(typeof RACE_STATE!=="undefined"&&RACE_STATE&&RACE_STATE.circuit)||"";
 var n=String(c).toLowerCase();
 return n.indexOf("6h")>=0||n.indexOf("8h")>=0||n.indexOf("12h")>=0||n.indexOf("le mans")>=0||n.indexOf("lemans")>=0;
}
function _isLeMansRace(){
 var c=(typeof RACE_STATE!=="undefined"&&RACE_STATE&&RACE_STATE.circuit)||"";
 var n=String(c).toLowerCase();
 return _isWECRace()&&(n.indexOf("le mans")>=0||n.indexOf("lemans")>=0);
}
function _wecPhase(){
 // Retourne la phase de relais en cours selon la progression de la course.
 // Pour Le Mans : nuit entre 40% et 65%.
 if(!_isLongEnduranceRace())return null;
 if(typeof LIVE_RACE==="undefined"||!LIVE_RACE||!LIVE_RACE.total)return null;
 var pct=LIVE_RACE.cur/LIVE_RACE.total;
 if(_isLeMansRace()&&pct>=0.40&&pct<=0.65)return "night";
 if(pct<0.30)return "stint1";
 if(pct<0.65)return "stint2";
 return "stint3";
}
function _tyreLifeDegPerLap(compound,weatherId,circuitType){
 var base={soft:4.5,medium:2.8,hard:1.6,inter:2.2,wet:1.8};
 var deg=base[compound]||base.medium;
 // Données circuit enrichies
 var cd=(typeof RACE_STATE!=="undefined"&&RACE_STATE.circuitData)||{};
 var tyreDegIdx=cd.tyreDeg||5;       // 1=Monza (doux), 10=Barcelone (abrasif)
 var bumps=cd.bumpsFactor||4;        // 1=lisse, 10=Sebring
 var trackT=cd.trackTemp||5;         // 1=Las Vegas nuit, 10=Bahrain jour
 // Facteur multiplicateur circuits spécifiques (normalisé autour de 1.0)
 var circMult=0.7 + (tyreDegIdx-1)*0.067;    // 1→0.70, 5→0.97, 10→1.30
 var bumpsMult=1.0 + (bumps-4)*0.025;        // 4→1.00, 8→1.10, 10→1.15
 var tempMult=1.0 + (trackT-5)*0.04;         // 5→1.00, 9→1.16, 2→0.88
 deg *= circMult * bumpsMult * tempMult;
 // Modificateurs météo
 if(weatherId==="hot")deg*=1.20;   // réduit car trackTemp couvre déjà
 if(circuitType==="street")deg*=1.25;  // réduit (tyreDeg du circuit couvre une partie)
 if(weatherId==="wet"||weatherId==="storm"){
  if(compound==="soft"||compound==="medium"||compound==="hard")deg*=1.6;
 }
 return Math.max(0.5, deg);
}
function _tyreLifePaceImpact(lifeRatio){
 // Retourne des secondes de pénalité par tour selon le % de vie restant
 // lifeRatio = 0..1 (1 = neuf, 0 = mort)
 if(lifeRatio>0.70)return 0;             // 100-70% : pace nominal
 if(lifeRatio>0.40)return 0.35*(0.70-lifeRatio)/0.30; // 70-40% : -0..0.35s progressif
 if(lifeRatio>0.15)return 0.35+1.0*(0.40-lifeRatio)/0.25; // 40-15% : -0.35..1.35s
 return 1.35+3.0*(0.15-lifeRatio)/0.15;  // <15% : falaise (jusqu'à -4.35s)
}
function _tickTyreWear(d){
 if(!d||d.dnf)return 0;
 // Init au premier appel
 if(typeof d._tyreLapsOnSet!=="number")d._tyreLapsOnSet=LIVE_RACE.cur||1;
 var lapsOnSet=d._tyreLapsOnSet||0;
 // Cat & config
 var cfg=(typeof _pitConfigForCat==="function")?_pitConfigForCat():null;
 var cat=(typeof G!=="undefined"&&G.cat)||"";
 var isKart=cat==="Karting Junior"||cat==="Karting Senior";
 if(isKart){d._tyreLapsOnSet++;/* Karting : pas d'arret au stand (fidele au karting reel), mais usure pneus REELLE et visible. Indicateurs existants : gestion_pneus du joueur / consistance du rival. Degradation douce, courses courtes, pneus non remplacables -> on gere l'usure en pilotant. */if(typeof d._tyreLife!=="number")d._tyreLife=100;var _kSkill=d.isPlayer?(((typeof G!=="undefined"&&G.substats&&G.substats.gestion_pneus)||50)/100):((typeof d.rivalIdx==="number"&&G.rivals&&G.rivals[d.rivalIdx]&&G.rivals[d.rivalIdx].consistency)||0.7);var _kWearMult=1.3-0.6*Math.max(0,Math.min(1,(_kSkill-0.4)/0.55));d._tyreLife=Math.max(0,d._tyreLife-1.5*_kWearMult);return d._tyreLife<80?(80-d._tyreLife)*0.005:0;}
 var degradeOn=cfg&&cfg.degradeTyres;
 // Circuit de nuit froid : fenêtre de fonctionnement pneus difficile
 var _nightCold=(typeof RACE_STATE!=="undefined"&&RACE_STATE.circuitData&&RACE_STATE.circuitData.nightRace&&(RACE_STATE.circuitData.trackTemp||5)<=3)||false;
 // Skill pilote
 var skill;
 if(d.isPlayer){
  var gp=(typeof G!=="undefined"&&G.substats&&G.substats.gestion_pneus)||50;
  skill=gp/100;
 }else{
  var rIdx=d.rivalIdx;
  var cons=(typeof rIdx==="number"&&G.rivals&&G.rivals[rIdx]&&G.rivals[rIdx].consistency)||0.7;
  skill=cons;
 }
 var wearMult=1.3-0.6*Math.max(0,Math.min(1,(skill-0.4)/0.55));
 // ---- TYRE LIFE ---- 
 // Init _tyreLife à 100 si pas encore défini (pneus neufs)
 if(typeof d._tyreLife!=="number")d._tyreLife=100;
 var weather=(typeof RACE_STATE!=="undefined"&&RACE_STATE.weather)||{};
 var circuit=(typeof RACE_STATE!=="undefined"&&RACE_STATE.circuitData)||{};
 var compound=d._tyreCompound||"medium";
 // Dégradation % par tour
 var degPct=_tyreLifeDegPerLap(compound,weather.id,circuit.type);
 // Modulée par le skill (bon pilote use moins)
 degPct*=wearMult;
 // Bonus FP long run
 if(d.isPlayer&&typeof G!=="undefined"&&G._fpBonus&&G._fpBonus.tyreWearMult)degPct*=G._fpBonus.tyreWearMult;
 // Bonus setup — aileron élevé = plus d'usure (si données setup disponibles)
 if(d.isPlayer&&typeof LIVE_RACE!=="undefined"&&LIVE_RACE.setupImpact&&LIVE_RACE.setupImpact.tyreWearMult)degPct*=LIVE_RACE.setupImpact.tyreWearMult;
 // Cat sans degradeTyres : réduire
 if(!degradeOn)degPct*=0.5;
 // Appliquer
 d._tyreLife=Math.max(0,d._tyreLife-degPct);
 // ---- WEARSC (impact lap time = système existant) ----
 // On garde l'ancien système PLUS on ajoute l'impact pace basé sur _tyreLife
 var wearSec=0;
 if(lapsOnSet<5){
  wearSec=0.04*(5-lapsOnSet);
 }else if(lapsOnSet<15){
  wearSec=-0.03;
 }else if(lapsOnSet<25){
  wearSec=0.10*(lapsOnSet-15)/10;
 }else{
  wearSec=0.10+0.04*(lapsOnSet-25);
  if(wearSec>1.5)wearSec=1.5;
 }
 if(!degradeOn)wearSec*=0.5;
 if(wearSec>0)wearSec*=wearMult;
 if(wearSec>0&&weather.id==="hot")wearSec*=1.4;
if(_nightCold&&lapsOnSet<8)wearSec*=1.15;  // pneus pas encore à température
 if(d._tyreCompound&&typeof _compoundEffects==="function"){
  var _cfx=_compoundEffects(d._tyreCompound);
  if(wearSec>0)wearSec*=_cfx.wearMult;
  if(lapsOnSet>=5)wearSec+=_cfx.paceBonus;
 }
 if(d.isPlayer&&typeof G!=="undefined"&&G._fpBonus&&G._fpBonus.tyreWearMult&&wearSec>0)wearSec*=G._fpBonus.tyreWearMult;
 // Impact _tyreLife sur le chrono (s'ajoute au wearSec existant)
 var lifeImpact=_tyreLifePaceImpact(d._tyreLife/100);
 wearSec+=lifeImpact;
 // Mode pneus actif
 var _tMode=(typeof LIVE_RACE!=="undefined"&&LIVE_RACE&&LIVE_RACE._tyreMode)||"normal";
 if(d.isPlayer){
  if(_tMode==="push"){
   wearSec+=0.18; // pace gain +0.18s mais usure pneus accélérée
   if(typeof d._tyreLife==="number")d._tyreLife=Math.max(0,d._tyreLife-1.2); // -1.2% vie supplémentaire/tour
  }else if(_tMode==="manage"){
   wearSec=Math.max(-0.05,wearSec-0.12); // rythme réduit (-0.12s récupérés)
   if(typeof d._tyreLife==="number")d._tyreLife=Math.min(100,d._tyreLife+degPct*0.30); // restitue 30% dégradation
  }
 }
 d._tyreLapsOnSet++;
 return wearSec;
}
/* ================================================================
 * DNF MÉCANIQUE JOUEUR — probabilité par catégorie + type de panne
 * Appelée chaque tour dans tickRace
 * ================================================================ */
function _tryPlayerMechDNF() {
  if (!LIVE_RACE || !LIVE_RACE.drivers || LIVE_RACE.finished || LIVE_RACE.paused) return;
  var p = LIVE_RACE.drivers.find(function(d) { return d.isPlayer; });
  if (!p || p.dnf) return;

  var cat = (typeof G !== 'undefined' && G.cat) || '';
  var lap = LIVE_RACE.cur || 0;
  var total = LIVE_RACE.total || 20;
  var pct = total > 0 ? lap / total : 0;

  // Probabilité de DNF PAR TOUR selon la catégorie
  // (chances cumulatives sur toute la course ~2-8%)
  var BASE_PROB = {
    'Karting Junior':   0.000, // pas de problèmes mécaniques en kart
    'Karting Senior':   0.000,
    'Formule 4':        0.0006,
    'Formula Regional': 0.0008,
    'Formule 3':        0.0010,
    'Formule 2':        0.0012,
    'Formule 1':        0.0010, // F1 très fiable
    'Super Formula':    0.0015,
    'Endurance WEC':    0.0020, // endurance = plus de risques
    'IndyCar':          0.0018,
  };
  var prob = BASE_PROB[cat] || 0.0008;

  // Le risque augmente si le joueur a choisi d'ignorer des alertes moteur
  if (LIVE_RACE._mechStress) prob *= (1 + LIVE_RACE._mechStress * 0.5);

  // Le risque est plus élevé en fin de course (usure)
  prob *= (1 + pct * 0.3);

  if (Math.random() > prob) return; // pas de panne ce tour

  // Type de panne aléatoire selon catégorie
  var pannes = cat === 'Endurance WEC'
    ? ['Crevaison en course','Problème de boîte de vitesses','Bris de suspension','Fuite hydraulique']
    : cat === 'IndyCar'
    ? ['Contact avec le mur','Problème moteur','Pneu éclaté à haute vitesse','Casse de suspension']
    : ['Problème moteur','Fuite hydraulique','Casse de suspension','Problème de freinage'];

  // Éviter DNF sur les 10 premiers % de course (unrealistic)
  if (pct < 0.10) return;

  var panne = pannes[Math.floor(Math.random() * pannes.length)];

  // Appliquer le DNF
  p.dnf = true;
  p.score = 0;
  LIVE_RACE._mechDNF = { lap: lap, cause: panne };

  // Log dans eventsLog
  if (typeof RACE_STATE !== 'undefined' && RACE_STATE.eventsLog) {
    RACE_STATE.eventsLog.push({ lap: lap, type: 'player_dnf', cause: panne });
  }

  // Radio message
  if (LIVE_RACE.newsFeed) {
    LIVE_RACE.newsFeed.unshift({
      lap: lap,
      icon: '🔴',
      title: panne + ' — Abandon',
      desc: '"' + (typeof G !== 'undefined' && G.pilot && G.pilot.prenom ? G.pilot.prenom : 'Pilote') + ', rentre au garage. On est désolés."',
      color: '#EF4444',
      ttl: 10
    });
  }

  // Impact mental
  if (typeof changeMental === 'function') {
    changeMental(-12, 'Abandon mécanique');
  }
  // Impact confiance équipe
  if (typeof changeTrust === 'function') {
    changeTrust(-3, 'Abandon en course', '↓');
  }

  // Déclencher finalizeLiveRace après un court délai (pour afficher la news)
  if (typeof finalizeLiveRace === 'function') {
    setTimeout(function() {
      if (LIVE_RACE && !LIVE_RACE.finished) finalizeLiveRace();
    }, 1200);
  }
}


// getSimSpeedMult : stub sécuritaire si non définie par l'environnement hôte
if(typeof getSimSpeedMult!=="function"){
  window.getSimSpeedMult=function(){return 1;};
}
function tickRace(){if(!LIVE_RACE.finished){_tryPlayerMechDNF();if(LIVE_RACE._mechStress>0)LIVE_RACE._mechStress=Math.max(0,LIVE_RACE._mechStress-0.1);var e=280,t=Math.max(20,Math.round(e*getSimSpeedMult()));LIVE_RACE.interval=setInterval(function(){try{if(LIVE_RACE.paused)return;LIVE_RACE.cur=Math.min(LIVE_RACE.cur+1,LIVE_RACE.total);var e=LIVE_RACE.cur/LIVE_RACE.total;LIVE_RACE.phase=Math.min(5,Math.floor(6*e));var t=LIVE_RACE.total>0?LIVE_RACE.cur/LIVE_RACE.total:0,r=computeStrategyImpact(t),n=r.scoreBonus-(LIVE_RACE.stratPrevBonus||0);LIVE_RACE.stratPrevBonus=r.scoreBonus;var a=LIVE_RACE.setupImpact||{tyreWearMult:1,stabilityMod:0};
/* #8 — WEC Endurance : relais pilote simulé. À 33% et 66% de la course (et 50% Le Mans),
   on simule un changement de pilote sur la voiture du joueur :
   - Reset _tyreLapsOnSet à 0 (pneus frais)
   - Léger boost score (pilote frais reprend mieux)
   - Annonce news feed
   Pour les rivaux, même reset mais sans annonce (silencieux pour ne pas spammer le feed). */
(function(){
 try{
  if(typeof _isLongEnduranceRace!=="function"||!_isLongEnduranceRace())return;
  if(!LIVE_RACE||!LIVE_RACE.total)return;
  var pct=LIVE_RACE.cur/LIVE_RACE.total;
  // Points de relais selon le format
  var relayPoints=[0.33,0.66];
  if(typeof _isLeMansRace==="function"&&_isLeMansRace())relayPoints=[0.25,0.50,0.75];
  // Tolerance : déclencher si on entre dans une fenêtre étroite autour du point
  var tol=0.02;
  relayPoints.forEach(function(rp,idx){
   var marker="_relayDone_"+idx;
   if(LIVE_RACE[marker])return;
   if(pct>=rp&&pct<rp+tol*3){
    LIVE_RACE[marker]=true;
    LIVE_RACE.drivers.forEach(function(d){
     if(d.dnf)return;
     // Reset usure pneus (pilote frais avec pneus neufs)
     d._tyreLapsOnSet=0;
     // Léger boost score (pilote frais)
     d.score=Math.min(0.99,d.score+0.005);
    });
    // Annonce news feed pour le joueur
    LIVE_RACE.newsFeed=LIVE_RACE.newsFeed||[];
    LIVE_RACE.newsFeed.unshift({
     icon:"",
     title:"Relais pilote — Tour "+LIVE_RACE.cur,
     desc:"Changement de pilote dans le stand. Pneus frais, vue rafraîchie.",
     color:"#34D399",
     ttl:5,
     lap:LIVE_RACE.cur
    });
    if(LIVE_RACE.newsFeed.length>3)LIVE_RACE.newsFeed=LIVE_RACE.newsFeed.slice(0,3);
   }
  });
  // Annonce d'entrée/sortie de phase nuit (Le Mans)
  if(typeof _isLeMansRace==="function"&&_isLeMansRace()){
   var inNight=pct>=0.40&&pct<=0.65;
   if(inNight&&!LIVE_RACE._nightAnnounced){
    LIVE_RACE._nightAnnounced=true;
    LIVE_RACE.newsFeed=LIVE_RACE.newsFeed||[];
    LIVE_RACE.newsFeed.unshift({
     icon:"",
     title:"Tombée de la nuit",
     desc:"Visibilité réduite. La concentration est essentielle. Risque accru.",
     color:"#60A5FA",
     ttl:8,
     lap:LIVE_RACE.cur
    });
    if(LIVE_RACE.newsFeed.length>3)LIVE_RACE.newsFeed=LIVE_RACE.newsFeed.slice(0,3);
   }else if(!inNight&&LIVE_RACE._nightAnnounced&&!LIVE_RACE._dawnAnnounced&&pct>0.65){
    LIVE_RACE._dawnAnnounced=true;
    LIVE_RACE.newsFeed=LIVE_RACE.newsFeed||[];
    LIVE_RACE.newsFeed.unshift({
     icon:"️",
     title:"Levée du jour",
     desc:"Le soleil se lève sur la Sarthe. Plus que quelques heures.",
     color:"#FBBF24",
     ttl:6,
     lap:LIVE_RACE.cur
    });
    if(LIVE_RACE.newsFeed.length>3)LIVE_RACE.newsFeed=LIVE_RACE.newsFeed.slice(0,3);
   }
  }
 }catch(_e){}
})();
/* #15 — Tag du tour de DNF pour pouvoir trier le classement final par tours parcourus. Détection passive : si dnf=true mais pas de _dnfAtLap, on pose le tour courant. */ LIVE_RACE.drivers.forEach(function(_d){if(_d.dnf&&typeof _d._dnfAtLap!=="number")_d._dnfAtLap=LIVE_RACE.cur||1});LIVE_RACE.drivers.forEach(function(e){if(!e.dnf){"number"!=typeof e.eventScoreOffset&&(e.eventScoreOffset=0);var i=.65;var _isKartCat=G.cat==="Karting Junior"||G.cat==="Karting Senior";var _stratMul=_isKartCat?.18:.09;if(void 0!==e.gridPos&&t<i){var l=t<.2?.04:t<.4?.07:.1;if(_isKartCat)l=t<.2?.07:t<.4?.11:.16;e.score=Math.min(.97,Math.max(.03,e.baseScore+e.eventScoreOffset+(Math.random()-.5)*e.stratV*l))}else e.score=Math.min(.99,Math.max(.01,e.score+(Math.random()-.5)*e.stratV*_stratMul));if(e._tyreFreshLaps&&e._tyreFreshLaps>0)e.score=Math.min(.99,e.score+.004);// Mode pneus : impact pace sur le score
var _tModeNow=(typeof LIVE_RACE!=="undefined"&&LIVE_RACE&&LIVE_RACE._tyreMode)||"normal";
if(e.isPlayer&&_tModeNow==="push")e.score=Math.min(.99,e.score+0.0035);
else if(e.isPlayer&&_tModeNow==="manage")e.score=Math.max(.01,e.score-0.0025);
if(e.isPlayer&&(e.score=Math.min(.99,Math.max(.01,e.score+n)),Math.random()<r.errorRisk)){var c=.006+.01*Math.random();e.score=Math.max(.01,e.score-c),e.mistakeLog||(e.mistakeLog=[]),e.mistakeLog.push({lap:LIVE_RACE.cur,loss:c})}if(LIVE_RACE.baseRef){var d=.045*(.97-e.score),p=t>.5?.03*(t-.5):0,u,f;if(e.isPlayer)u=p*((a.tyreWearMult||1)*(r.tyreWearMult||1));else u=p;if(e._tyreFreshLaps&&e._tyreFreshLaps>0){u=u*0.4;e._tyreFreshLaps--;if(e._tyreFreshLaps<=0)e._tyreFresh=!1}var m=.008*(Math.random()-.5),g=1===LIVE_RACE.cur?.012:0,h=LIVE_RACE.baseRef*(1+d+u+m+g);
// === Application des effets persistants d'événements ===
// paceMod : delta en secondes ajouté directement au temps au tour
// tyreDamage : malus de dégradation supplémentaire sur les pneus
// Le score est aussi ajusté en parallèle pour que le classement reflète l'écart (45*scoreDiff = secondsGap)
var _evtPaceSec=_evtPaceSecThisLap(e);
var _tyreDmgSec=_evtTickTyre(e);
// #3 — Usure progressive des pneus par tour de stint.
// Le code est piloté par le helper _tickTyreWear (défini juste après _evtTickTyre).
// Effet : pace neutre les 5 premiers tours, optimale 5-15, drop-off léger 15-25, marqué 25+.
// Modulé par stat gestion_pneus du pilote (joueur uniquement) et par cat (degradeTyres dans PIT_CONFIG).
var _tyreWearSec=(typeof _tickTyreWear==="function")?_tickTyreWear(e):0;
if(_tyreWearSec!==0){h+=_tyreWearSec;e.score=Math.min(.99,Math.max(.02,e.score-_tyreWearSec/45));}
/* #10 — Fatigue pilote en fin de course chaude. Joueur seulement, physique<70, derniers 30% de course.
   Effet progressif : 0 à -0.020 selon (70-physique) et progression dans la fin de course. */
if(e.isPlayer&&typeof RACE_STATE!=="undefined"&&RACE_STATE.weather&&RACE_STATE.weather.id==="hot"){
 var _physique=(G.substats&&G.substats.physique)||(G.stats&&G.stats.physique)||50;
 if(_physique<70){
  var _lapPct=LIVE_RACE.total>0?LIVE_RACE.cur/LIVE_RACE.total:0;
  if(_lapPct>0.7){
   var _fatigueGap=(70-_physique)/70; // 0..1 selon manque physique
   var _phaseFactor=(_lapPct-0.7)/0.3; // 0..1 sur les 30% finaux
   var _fatiguePenalty=0.020*_fatigueGap*_phaseFactor; // max -0.020 score
   /* #5 — Bonus FP weather : atténue la fatigue hot */
   if(G._fpBonus&&G._fpBonus.weatherMul!=null)_fatiguePenalty*=G._fpBonus.weatherMul;
   e.score=Math.max(.02,e.score-_fatiguePenalty);
   // Pas de log événementiel pour ne pas spammer le feed (effet continu silencieux)
  }
 }
}
/* #8 — Phase nuit Le Mans : pénalité continue pour pilotes faibles en concentration.
   Si concentration < 60, pénalité progressive de score. Joueur seulement (rivaux non affectés
   pour ne pas créer un avantage déséquilibré côté joueur). */
if(e.isPlayer&&typeof _wecPhase==="function"&&_wecPhase()==="night"){
 var _concen=(G.substats&&G.substats.concentration)||50;
 if(_concen<60){
  var _concenGap=(60-_concen)/60; // 0..1 selon manque concentration
  var _nightPenalty=0.012*_concenGap; // max -0.012 score
  /* #5 — Bonus FP weather : atténue aussi la pénalité concentration nuit (sang-froid amélioré par la séance) */
  if(G._fpBonus&&G._fpBonus.weatherMul!=null)_nightPenalty*=G._fpBonus.weatherMul;
  e.score=Math.max(.02,e.score-_nightPenalty);
 }
}
if(_evtPaceSec!==0){h+=_evtPaceSec;e.score=Math.min(.99,Math.max(.02,e.score-_evtPaceSec/45));}
if(_tyreDmgSec>0){h+=_tyreDmgSec;e.score=Math.min(.99,Math.max(.02,e.score-_tyreDmgSec/45));}
// Décrémente la durée des paceMods une fois leur effet appliqué pour ce tour
_evtTickPaceMods(e);
e.lastLap=h,(null===e.bestLap||h<e.bestLap)&&(e.bestLap=h),(!LIVE_RACE.bestLap||h<LIVE_RACE.bestLap.time)&&(LIVE_RACE.bestLap={time:h,driverName:e.name,isPlayer:!!e.isPlayer,lap:LIVE_RACE.cur}),e.totalTime=(e.totalTime||0)+h;var v,x=splitLapIntoSectors(h,RACE_STATE.circuit||"",.014);e.lastSectors=x,e.bestSectors||(e.bestSectors=[null,null,null]);var y=[0,0,0];LIVE_RACE.bestSectors||(LIVE_RACE.bestSectors=[null,null,null]),LIVE_RACE.bestSectorsHolder||(LIVE_RACE.bestSectorsHolder=[null,null,null]);for(var b=0;b<3;b++){var A=x[b],w=e.bestSectors[b],M=LIVE_RACE.bestSectors[b];if(null===M||A<M){LIVE_RACE.bestSectors[b]=A;var E=LIVE_RACE.bestSectorsHolder[b];if(E&&E!==e.name){var T=LIVE_RACE.drivers.find(function(e){return e.name===E});T&&T.lastSectorFlags&&2===T.lastSectorFlags[b]&&(T.lastSectorFlags[b]=1)}LIVE_RACE.bestSectorsHolder[b]=e.name,y[b]=2}(null===w||A<w)&&(e.bestSectors[b]=A,y[b]<2&&(y[b]=1))}e.lastSectorFlags=y}}}),updateLivePositions();
/* #11 — Aspiration / DRS-like : si un pilote est dans le sillage proche du pilote devant
   (gap < 1.0s) pendant 2 tours consécutifs, on applique un paceMod silencieux de -0.05s/T
   pendant 3 tours pour simuler le bénéfice de l'aspiration.
   Ne s'applique pas en karting (déjà couvert par events kart_slipstream) ni au tour 1
   (positions pas stables au départ).
   #9 — Sur ovale IndyCar : seuil de gap relevé à 1.5s (sillage plus large) et paceMod doublé
   à -0.10s/T (effet aero plus marqué). */
(function(){
 try{
  var _isKart=G.cat==="Karting Junior"||G.cat==="Karting Senior";
  if(_isKart||LIVE_RACE.cur<=1)return;
  var _isOval=typeof _isOvalRace==="function"&&_isOvalRace();
  var _gapThreshold=_isOval?1.5:1.0;
  var _paceModSec=_isOval?-0.10:-0.05;
  var alive=LIVE_RACE.drivers.filter(function(d){return!d.dnf});
  if(alive.length<2)return;
  alive.forEach(function(d){
   if(d.pos<=1){d._drsCounter=0;return;} // leader pas concerné
   var ahead=alive.find(function(o){return o.pos===d.pos-1});
   if(!ahead){d._drsCounter=0;return;}
   // Calcul du gap réel à partir des scores corrigés (cohérent avec le reste du moteur)
   var dScore=d.score-(d.penaltySec||0)/45;
   var aScore=ahead.score-(ahead.penaltySec||0)/45;
   var gap=Math.abs(45*(aScore-dScore));
   if(gap<_gapThreshold){
    d._drsCounter=(d._drsCounter||0)+1;
    // Au 2ème tour consécutif dans le sillage, on déclenche
    if(d._drsCounter===2&&typeof _evtAddPaceMod==="function"){
     _evtAddPaceMod(d,_paceModSec,3,_isOval?"Aspiration ovale":"Aspiration");
    }
   }else{
    d._drsCounter=0;
   }
  });
 }catch(_e){}
})();
(function(){try{if(!LIVE_RACE._lapHistory)LIVE_RACE._lapHistory=[];var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});if(p){var leader=LIVE_RACE.drivers.filter(function(d){return!d.dnf}).sort(function(a,b){return(a.pos||99)-(b.pos||99)})[0];var gapToLeader=p.dnf?null:(leader&&leader!==p?(((p.score-(p.penaltySec||0)/45)-(leader.score-(leader.penaltySec||0)/45))*-45):0);var teammate=null;if(typeof getTeammateRival==="function"){try{var tmInfo=getTeammateRival();if(tmInfo){var tmDriver=LIVE_RACE.drivers.find(function(d){return!d.isPlayer&&d.team===p.team});if(tmDriver)teammate={pos:tmDriver.dnf?null:(tmDriver.pos||99),dnf:!!tmDriver.dnf}}}catch(e){}}var pitOnLap=null;if(p._lastPitLap===LIVE_RACE.cur)pitOnLap="player";var prevLap=LIVE_RACE._lapHistory[LIVE_RACE._lapHistory.length-1];var posChange=null;if(prevLap&&prevLap.pos!=null&&!p.dnf&&p.pos!=null){posChange=prevLap.pos-(p.pos||99)}LIVE_RACE._lapHistory.push({lap:LIVE_RACE.cur,pos:p.dnf?null:(p.pos||99),total:LIVE_RACE.drivers.length,gapToLeader:gapToLeader!==null?Math.abs(gapToLeader):null,phase:LIVE_RACE.phase,dnf:!!p.dnf,tmPos:teammate?teammate.pos:null,tmDnf:teammate?teammate.dnf:false,pit:pitOnLap,posChange:posChange})}}catch(e){console.warn("lap history:",e)}})();(typeof _applyRivalPitsForLap==="function"&&_applyRivalPitsForLap());(typeof _decayPitPenalty==="function"&&_decayPitPenalty());(typeof renderPitButton==="function"&&renderPitButton());(function(){if(G._noDnf)return;var dnfChance=.0008;LIVE_RACE.drivers.forEach(function(d){if(d.dnf)return;var localChance=dnfChance;if(d.isPlayer){if(G._adminMode)return;localChance=dnfChance*.6}if(LIVE_RACE.cur===1)localChance*=2.5;if(LIVE_RACE.cur>=LIVE_RACE.total*.9)localChance*=1.4;if(RACE_STATE.weather&&(RACE_STATE.weather.id==="wet"||RACE_STATE.weather.id==="storm"))localChance*=1.6;/* #10 — Météo hot : +30% chance DNF moteur (chaleur excessive sur les composants) */ if(RACE_STATE.weather&&RACE_STATE.weather.id==="hot")localChance*=1.3;/* #8 — Phase nuit Le Mans : +50% DNF (visibilité réduite, fatigue) */ if(typeof _wecPhase==="function"&&_wecPhase()==="night")localChance*=1.5;if(Math.random()<localChance){d.dnf=!0;if(d.isPlayer&&typeof addPressure==="function")addPressure(8);RACE_STATE.eventsLog&&RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Tour "+LIVE_RACE.cur,text:d.name+" abandonne",choice:"—",note:"Problème mécanique",sign:"−",color:"#EF4444"})}})})();var i=LIVE_RACE.eventsSchedule[0];if(i&&LIVE_RACE.cur>=i.lap){LIVE_RACE.eventsSchedule.shift();var _plDnf=LIVE_RACE.drivers&&LIVE_RACE.drivers.find(function(d){return d.isPlayer});var _plIsDnf=!!(_plDnf&&_plDnf.dnf);if(!_plIsDnf){var o=i.gen();if(o)return LIVE_RACE.pendingEvent=o,LIVE_RACE.paused=!0,renderLiveLeaderboard(),renderLiveNewsFeed(),void showLiveEvent(LIVE_RACE.pendingEvent)}}tickNewsFeed(),LIVE_RACE.cur<LIVE_RACE.total&&!LIVE_RACE.paused&&((function(){var _isKartCat=G.cat==="Karting Junior"||G.cat==="Karting Senior";var _passiveR=_isKartCat?.08:.05;var _choiceR=_isKartCat?.06:.04;Math.random()<_passiveR&&triggerPassiveEvent();Math.random()<_choiceR&&tryTriggerChoiceRaceEvent();if(typeof tryContextualRadio==="function")tryContextualRadio();if(typeof _checkStratOpportunity==="function")_checkStratOpportunity();
// --- Radio setup contextuelle ---
(function(){
 try{
  if(!LIVE_RACE||LIVE_RACE.finished)return;
  var _lap=LIVE_RACE.cur,_tot=LIVE_RACE.total;
  var _feel=(typeof _getSetupFeel==="function")?_getSetupFeel():null;
  if(!_feel)return;
  var _team=typeof _getTeamPersonality==="function"?_getTeamPersonality():null;
  var _eng=_team&&_team.engineer?_team.engineer:"L'ingénieur";
  // Tour 1 : radio momentum si élan fort (indépendant du setup)
  if(_lap===1&&!LIVE_RACE._momentumRadioDone){
   LIVE_RACE._momentumRadioDone=true;
   var _mm=typeof _getMomentum==="function"?_getMomentum():"neutral";
   if((_mm==="hot"||_mm==="ice")&&typeof pushRadioMsg==="function"){
    if(_mm==="hot")pushRadioMsg("⚡ Série en cours","Tu arrives en pleine confiance — 3 derniers résultats solides. Pression de confirmer.",{ttl:5,color:"#F59E0B"});
    else pushRadioMsg("❄ Série difficile","Bougeons bien aujourd'hui. Un bon résultat change tout.",{ttl:5,color:"#F97316"});
   }
  }
  // Tour 1 : radio position de grille
  if(_lap===1&&!LIVE_RACE._gridRadioDone){
   LIVE_RACE._gridRadioDone=true;
   var _qPos=RACE_STATE.qualiPos||5;
   var _team=typeof _getTeamPersonality==="function"?_getTeamPersonality():null;
   var _eng=_team&&_team.engineer?_team.engineer:"L'ingénieur";
   if(_qPos===1&&typeof pushRadioMsg==="function")pushRadioMsg(
    "P1 — Tiens la tête",
    _eng+" : Pole position. Garde ta ligne au virage 1, couvre l'intérieur. Une erreur ici et tout s'effondre.",
    {ttl:6,color:"#F59E0B"});
   else if(_qPos<=3&&typeof pushRadioMsg==="function")pushRadioMsg(
    "Front row — protège le départ",
    _eng+" : Top 3 sur la grille. Concentration maximale dans le premier secteur.",
    {ttl:5,color:"#34D399"});
   else if(_qPos>=9&&typeof pushRadioMsg==="function")pushRadioMsg(
    "Remontée — sois opportuniste",
    _eng+" : P"+_qPos+" sur la grille. Sois agressif dans les premiers tours — tout le monde sera prudent.",
    {ttl:5,color:"#60A5FA"});
  }
  // Tour 1 : brief setup (pas en karting - pas de setup screen)
  var _isKartCatSetup=G.cat==="Karting Junior"||G.cat==="Karting Senior";
  if(_lap===1&&!LIVE_RACE._setupRadioDone&&!_isKartCatSetup&&G.setup&&G.setup!=="bal"){
   LIVE_RACE._setupRadioDone=true;
   var _matchEmoji=_feel.match==="good"?"✅":_feel.match==="bad"?"⚠️":"ℹ️";
   if(typeof pushRadioMsg==="function")pushRadioMsg(
    _matchEmoji+" Setup : "+_feel.label,
    _feel.desc,
    {ttl:6,color:_feel.match==="good"?"#34D399":_feel.match==="bad"?"#F97316":"#60A5FA"}
   );
   // Alerte usure si setup agressif (seulement cats avec dégradation pneus)
   var _catHasDeg=(typeof _pitConfigForCat==="function")&&(_pitConfigForCat()||{}).degradeTyres;
   if(_catHasDeg&&_feel.wearNote==="high"&&typeof pushRadioMsg==="function")setTimeout(function(){
    pushRadioMsg("⚠️ Usure accrue",
     "Setup agressif — surveille tes pneus, la dégradation sera plus forte que prévu.",
     {ttl:5,color:"#F59E0B"});
   },3000);
  }
  // Tour ~40% : radio pression si grande chute de position
  if(_lap===Math.round(_tot*0.42)&&!LIVE_RACE._posDropRadioDone){
   var _pp2=LIVE_RACE.drivers&&LIVE_RACE.drivers.find(function(d){return d.isPlayer});
   var _gridP=RACE_STATE.qualiPos||5;
   if(_pp2&&!_pp2.dnf&&(_pp2.pos-_gridP)>=5){
    LIVE_RACE._posDropRadioDone=true;
    var _trust=typeof TEAM_TRUST!=="undefined"?TEAM_TRUST.value:50;
    var _toneMsg=_trust<35?"L'équipe commence à s'inquiéter sérieusement.":"L'écurie s'interroge.";
    if(typeof pushRadioMsg==="function")pushRadioMsg(
     "Position P"+_pp2.pos+" — Chute de "+(_pp2.pos-_gridP)+" places",
     _toneMsg+" Tu partais P"+_gridP+". Il reste encore du temps pour remonter.",
     {ttl:7,color:"#EF4444"});
   }
  }
  // Tour ~40% : alerte mid-course si setup mal adapté
  var _midLap=Math.round(_tot*0.40);
  if(_lap===_midLap&&_feel&&_feel.midRadio&&_feel.match==="bad"&&!LIVE_RACE._setupMidRadioDone){
   LIVE_RACE._setupMidRadioDone=true;
   if(typeof pushRadioMsg==="function")pushRadioMsg(
    "⚠️ "+_eng+" — Setup",
    _feel.midRadio,
    {ttl:5,color:"#F97316"}
   );
  }
 }catch(_e){console.warn("setup radio:",_e)}
})()})()),renderLiveLeaderboard(),renderLiveNewsFeed(),LIVE_RACE.cur>=LIVE_RACE.total&&(clearInterval(LIVE_RACE.interval),LIVE_RACE.finished=!0,setTimeout(finalizeLiveRace,600))}catch(e){console.error("Erreur tickRace:",e&&e.message,e&&e.stack),clearInterval(LIVE_RACE.interval),LIVE_RACE.finished=!0,LIVE_RACE.paused=!1,"function"==typeof _hideRaceEventModal&&_hideRaceEventModal(),setTimeout(finalizeLiveRace,300)}},t)}}function updateLivePositions(){var e=LIVE_RACE.drivers.filter(function(e){return!e.dnf});if(LIVE_RACE.cur<=1){e.sort(function(a,b){return(a.gridPos||a.pos||99)-(b.gridPos||b.pos||99)});e.forEach(function(t,r){t.pos=r+1;if(r===0)t.gap=0;else{var n=e[0].score-(e[0].penaltySec||0)/45,a=t.score-(t.penaltySec||0)/45;t.gap=parseFloat(Math.max(0,(45*(n-a))).toFixed(1))}});var t1=e.length+1;LIVE_RACE.drivers.filter(function(e){return e.dnf}).forEach(function(e){e.pos=t1++});return}e.sort(function(e,t){var r=e.score-(e.penaltySec||0)/45,n;return t.score-(t.penaltySec||0)/45-r});var bypassCap=LIVE_RACE._bypassPositionCap;if(bypassCap)LIVE_RACE._bypassPositionCap=false;var _isKart=G.cat==="Karting Junior"||G.cat==="Karting Senior";var _baseMaxJump=_isKart?4:2;e.forEach(function(t,r){var newPos=r+1;var prevPos=t.pos||newPos;var driverMaxJump=_baseMaxJump;if(t._lastPitLap&&LIVE_RACE.cur-t._lastPitLap<=2)driverMaxJump=5;if(bypassCap)driverMaxJump=20;if(Math.abs(newPos-prevPos)>driverMaxJump){var clampedPos;if(newPos<prevPos)clampedPos=prevPos-driverMaxJump;else clampedPos=prevPos+driverMaxJump;t._cappedPos=Math.min(e.length,Math.max(1,clampedPos))}else t._cappedPos=newPos});var positionsTaken={};var _maxValidPos=e.length;e.slice().sort(function(a,b){return(a._cappedPos||a.pos)-(b._cappedPos||b.pos)}).forEach(function(t){var desiredPos=Math.min(_maxValidPos,t._cappedPos||t.pos);while(positionsTaken[desiredPos]&&desiredPos<_maxValidPos)desiredPos++;if(positionsTaken[desiredPos]){for(var _bp=1;_bp<=_maxValidPos;_bp++)if(!positionsTaken[_bp]){desiredPos=_bp;break}}t.pos=desiredPos;positionsTaken[desiredPos]=true});e.forEach(function(t){if(t.pos===1)t.gap=0;else{var leader=e.find(function(d){return d.pos===1});if(leader){var n=leader.score-(leader.penaltySec||0)/45,a=t.score-(t.penaltySec||0)/45;t.gap=parseFloat(Math.max(0,(45*(n-a))).toFixed(1))}else t.gap=0}delete t._cappedPos});var t=e.length+1;LIVE_RACE.drivers.filter(function(e){return e.dnf}).forEach(function(e){e.pos=t++})}// ── Nouvelle renderLiveLeaderboard ────────────────────────────────────────────
// Remplace : function renderLiveLeaderboard(){ ... }}
// ET le bloc // Injection widget tyre life ...})();
// Les deux sont fusionnés en une seule fonction propre.
function renderLiveLeaderboard(){
var e=document.getElementById("live-leaderboard"),t=document.getElementById("race-bar"),r=document.getElementById("live-race-label"),n=document.getElementById("live-race-lap");
if(!e)return;
var a=LIVE_RACE.total>0?LIVE_RACE.cur/LIVE_RACE.total:0;
t&&(t.style.width=Math.round(100*a)+"%");
var _pauseIcon='<svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" style="vertical-align:-1px;margin-right:4px"><rect x="1.5" y="1.5" width="2.2" height="7" rx="0.6"/><rect x="6.3" y="1.5" width="2.2" height="7" rx="0.6"/></svg>';
r&&(r.innerHTML=(LIVE_RACE.paused?_pauseIcon+"Évènement — ":"")+(LIVE_RACE._isSprintMode?'<span style="display:inline-block;padding:1px 5px;margin-right:6px;background:#F59E0B;color:#0a0510;border-radius:3px;font-size:9px;font-weight:800;letter-spacing:.06em">'+renderIcon('zap',14,'#F59E0B')+' SPRINT</span>':"")+(PHASE_LABELS[LIVE_RACE.phase]||""));
n&&(n.textContent="Tour "+LIVE_RACE.cur+" / "+LIVE_RACE.total);

var o=LIVE_RACE.drivers.slice().sort(function(a,b){return a.pos-b.pos});
var _p=o.find(function(d){return d.isPlayer;});
if(!_p){e.innerHTML="";return;}

// ── Utilitaires ──────────────────────────────────────────────────────────────
var s=function(t){if(!t)return"—";if(t>=60){var m=Math.floor(t/60),r=t-60*m;return m+":"+(r<10?"0":"")+r.toFixed(3)}return t.toFixed(3)};

// Compound : couleurs et labels F1 depuis TYRE_COMPOUND_INFO
function _cmpInfo(c){
  var i=(typeof TYRE_COMPOUND_INFO!=="undefined"&&TYRE_COMPOUND_INFO&&TYRE_COMPOUND_INFO[c]);
  if(i)return i;
  return {color:c==="soft"?"#EF4444":c==="hard"?"#E5E7EB":c==="wet"?"#3B82F6":c==="inter"?"#22C55E":"#FBBF24",short:c==="soft"?"S":c==="hard"?"H":c==="wet"?"W":c==="inter"?"I":"M",text:"#000"};
}

// ── Rival actif ──────────────────────────────────────────────────────────────
var _activeRival=null,_rivalColor="#EF4444",_rivalIcon="⚡";
if(typeof G._rivalries!=="undefined"&&G._rivalries&&G._rivalries.length>0){
  var _rv0=G._rivalries.find(function(rv){return rv.active;});
  if(_rv0){
    _activeRival=o.find(function(d){return!d.isPlayer&&d.name===_rv0.name&&!d.dnf;})||null;
    var _rvType=(typeof RIVALRY_TYPES!=="undefined"&&RIVALRY_TYPES&&RIVALRY_TYPES[_rv0.type]);
    if(_rvType){_rivalColor=_rvType.color||"#EF4444";_rivalIcon=_rvType.icon||"⚡";}
  }
}

// ── Pilote devant ─────────────────────────────────────────────────────────────
var _ahead=o.find(function(d){return d.pos===_p.pos-1&&!d.dnf;})||null;

// ── Fenêtre pit ──────────────────────────────────────────────────────────────
var _hasPit=typeof _pitEnabledForCurrentRace==="function"&&_pitEnabledForCurrentRace();
var _cfg2=typeof _pitConfigForCat==="function"?_pitConfigForCat():null;
var _isSprintM=!!LIVE_RACE._isSprintMode;
var _pitHtml="",_pitColor="var(--blue)";
if(_hasPit&&_cfg2&&!_isSprintM){
  var _pct2=LIVE_RACE.total>0?LIVE_RACE.cur/LIVE_RACE.total:0;
  var _ws=_cfg2.windowStart||0.3,_we=_cfg2.windowEnd||0.7;
  if(_pct2>=_ws&&_pct2<=_we){
    var _toClose=Math.max(0,Math.ceil((_we-_pct2)*LIVE_RACE.total));
    _pitColor=_toClose<=3?"var(--red)":_toClose<=7?"var(--amber)":"var(--green)";
    _pitHtml='<div style="font-size:8px;color:'+_pitColor+';font-weight:800;letter-spacing:.05em;text-transform:uppercase;margin-bottom:1px">OUVERTE</div>'
             +'<div style="font-family:var(--font-display);font-size:13px;font-weight:800;color:'+_pitColor+'">'+_toClose+'t</div>';
  } else if(_pct2<_ws){
    var _toOpen=Math.max(0,Math.ceil((_ws-_pct2)*LIVE_RACE.total));
    _pitHtml='<div style="font-size:8px;color:var(--blue);font-weight:800;letter-spacing:.05em;text-transform:uppercase;margin-bottom:1px">DANS</div>'
             +'<div style="font-family:var(--font-display);font-size:13px;font-weight:800;color:var(--blue)">'+_toOpen+'t</div>';
  } else if((_p._pitsDone||0)<(_cfg2.minStops||0)){
    _pitColor="var(--red)";
    _pitHtml='<div style="font-size:8px;color:var(--red);font-weight:800;letter-spacing:.05em;text-transform:uppercase;margin-bottom:1px">REQUIS</div>'
             +'<div style="font-family:var(--font-display);font-size:11px;font-weight:800;color:var(--red)">STOP!</div>';
  }
}

// ── Pneus joueur ─────────────────────────────────────────────────────────────
var _cmp=_p._tyreCompound||"med";
var _ci=_cmpInfo(_cmp);
var _tyreHtml;
if(typeof _p._tyreLife==="number"){
  var _tl=Math.max(0,Math.round(_p._tyreLife));
  var _tlC=_tl>60?"var(--green)":_tl>30?"var(--amber)":"var(--red)";
  _tyreHtml='<div style="display:flex;align-items:center;justify-content:center;gap:3px">'
           +'<span style="width:17px;height:17px;border-radius:50%;background:'+_ci.color+';color:'+(_ci.text||"#000")+';flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;font-family:var(--font-display);font-size:9px;font-weight:900;line-height:1;border:1px solid rgba(255,255,255,0.25)">'+(_ci.short||"?")+'</span>'
           +'<span style="font-family:var(--font-display);font-size:14px;font-weight:800;color:'+_tlC+'">'+_tl+'%</span>'
           +'</div>'
           +'<div style="font-size:8px;color:var(--dim);margin-top:1px">'+(_ci.label||_ci.short||_cmp)+'</div>';
} else {
  _tyreHtml='<div style="display:flex;align-items:center;justify-content:center;gap:3px">'
           +'<span style="width:10px;height:10px;border-radius:50%;background:'+_ci.color+';flex-shrink:0;display:inline-block"></span>'
           +'<span style="font-family:var(--font-display);font-size:13px;font-weight:700;color:var(--text)">'+(_ci.short||"M")+'</span>'
           +'</div>';
}

// ── Momentum + Mental ─────────────────────────────────────────────────────────
var _mm=typeof _getMomentum==="function"?_getMomentum():"neutral";
var _mmMap={"hot":["var(--amber)","⚡ En feu"],"warm":["var(--green)","↑ En forme"],"neutral":["var(--dim)","–"],"cold":["#F97316","↓ Difficile"],"ice":["var(--red)","❄ Série noire"],"start":["var(--dim)","–"]};
var _mmC=(_mmMap[_mm]||_mmMap.neutral);

// Mental : couleur + label compact
var _mental=(typeof PILOT_MENTAL!=="undefined"&&PILOT_MENTAL)?PILOT_MENTAL.value:60;
var _mentalColor=_mental>=75?"var(--green)":_mental>=50?"var(--amber)":_mental>=30?"#F97316":"var(--red)";
var _mentalIcon=_mental>=75?"●●●":_mental>=50?"●●○":_mental>=30?"●○○":"○○○";

// ── Météo ─────────────────────────────────────────────────────────────────────
var _wId=(typeof RACE_STATE!=="undefined"&&RACE_STATE.weather&&RACE_STATE.weather.id)||"dry";
var _wIcons={"dry":"☀","cloudy":"🌤","cloud":"🌤","wet":"🌧","storm":"⛈","hot":"🌡","damp":"🌦"};
var _wLabels={"dry":"Sec","cloudy":"Nuageux","cloud":"Nuageux","wet":"Pluie","storm":"Orage","hot":"Chaud","damp":"Humide"};
var _wIcon=_wIcons[_wId]||"☀",_wLabel=_wLabels[_wId]||"Sec";

// ── Meilleur tour ─────────────────────────────────────────────────────────────
var _blHtml="";
if(LIVE_RACE.bestLap){
  var _bl=LIVE_RACE.bestLap;
  var _blName=_bl.isPlayer?((typeof G!=="undefined"&&G.pilot?((G.pilot.prenom?G.pilot.prenom+" ":"")+G.pilot.nom):"Toi")):formatPilotName(_bl.driverName,true,"FR");
  _blHtml='<div style="display:flex;align-items:center;gap:8px;padding:4px 12px;background:rgba(167,139,250,0.07);border-top:1px solid rgba(167,139,250,0.15)">'
         +'<span style="font-size:8px;font-weight:800;color:#A78BFA;letter-spacing:.1em;flex-shrink:0">⚑ BEST</span>'
         +'<span style="font-size:10px;color:var(--text2);flex:1;text-align:center;padding:0 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+_blName+'</span>'
         +'<span style="font-family:var(--font-display);font-size:11px;font-weight:800;color:#A78BFA;flex-shrink:0">'+s(_bl.time)+'</span>'
         +'</div>';
}

// ══════════════════════════════════════════════════════════════════
// BUILD HTML
// ══════════════════════════════════════════════════════════════════
var _posColor=_p.pos===1?"var(--gold)":_p.pos<=3?"var(--green)":_p.pos<=5?"var(--blue)":"var(--text)";
var m="";

// ── BANDEAU NEUTRALISATION (SC / VSC / RED FLAG) ─────────────────────────
var _scBanner="";
if(LIVE_RACE._rjNeutral&&LIVE_RACE._rjNeutral.active){
  var _scN=LIVE_RACE._rjNeutral;
  var _scType=_scN.type||"sc";
  var _scLapsLeft=Math.max(0,(_scN.endLap||0)-(LIVE_RACE.cur||0));
  var _scCfg={
    vsc:{
      bg:"rgba(245,158,11,0.13)",border:"rgba(245,158,11,0.40)",
      accent:"#F59E0B",
      icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      label:"VIRTUAL SAFETY CAR",
      desc:"Tous ralentissent · Pit avantageux"
    },
    sc:{
      bg:"rgba(245,158,11,0.18)",border:"rgba(245,158,11,0.55)",
      accent:"#F59E0B",
      icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
      label:"SAFETY CAR",
      desc:"Regroupement · Pit quasi gratuit"
    },
    rf:{
      bg:"rgba(239,68,68,0.16)",border:"rgba(239,68,68,0.55)",
      accent:"#EF4444",
      icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="#EF4444"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
      label:"DRAPEAU ROUGE",
      desc:"Course suspendue · Pit gratuit"
    }
  };
  var _sc=_scCfg[_scType]||_scCfg.sc;
  // Animation pulse pour RF
  var _scAnim=_scType==="rf"?";animation:rj-sc-pulse 0.9s ease-in-out infinite alternate":"";
  _scBanner='<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 12px 7px;background:'+_sc.bg+';border-bottom:2px solid '+_sc.border+_scAnim+'">'
    // Gauche : icône + label + desc
    +'<div style="display:flex;align-items:center;gap:7px;min-width:0">'
    +'<span style="flex-shrink:0;display:inline-flex;align-items:center">'+_sc.icon+'</span>'
    +'<div style="min-width:0">'
    +'<div style="font-family:var(--font-display);font-size:11px;font-weight:800;color:'+_sc.accent+';letter-spacing:.08em;line-height:1.1">'+_sc.label+'</div>'
    +'<div style="font-size:9px;color:'+_sc.accent+';opacity:.75;margin-top:1px">'+_sc.desc+'</div>'
    +'</div>'
    +'</div>'
    // Droite : tours restants
    +(_scLapsLeft>0?'<div style="text-align:right;flex-shrink:0">'
      +'<div style="font-family:var(--font-display);font-size:16px;font-weight:900;color:'+_sc.accent+';line-height:1">'+_scLapsLeft+'</div>'
      +'<div style="font-size:8px;color:'+_sc.accent+';opacity:.65;letter-spacing:.04em">'+(_scLapsLeft===1?"TOUR":"TOURS")+'</div>'
      +'</div>'
    :"")
    +'</div>';
  // Injecter le keyframe si pas encore présent
  if(!document.getElementById("rj-sc-style")){
    var _sEl=document.createElement("style");
    _sEl.id="rj-sc-style";
    _sEl.textContent="@keyframes rj-sc-pulse{from{border-bottom-color:rgba(239,68,68,0.55)}to{border-bottom-color:rgba(239,68,68,0.15)}}";
    document.head&&document.head.appendChild(_sEl);
  }
}
m+=_scBanner;
var _wxBanner="";
if(LIVE_RACE._pendingWeatherChange&&!LIVE_RACE._weatherChanged){
 var _pwc=LIVE_RACE._pendingWeatherChange;
 var _wx_worse=_pwc.worsening;
 var _wx_color=_wx_worse?"var(--blue,#3B82F6)":"var(--amber,#F59E0B)";
 var _wx_bg=_wx_worse?"rgba(59,130,246,0.14)":"rgba(245,158,11,0.13)";
 var _wx_border=_wx_worse?"rgba(59,130,246,0.45)":"rgba(245,158,11,0.40)";
 var _wx_icon=_wx_worse  ?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><line x1="8" y1="19" x2="8" y2="21"/><line x1="8" y1="13" x2="8" y2="15"/><line x1="16" y1="19" x2="16" y2="21"/><line x1="16" y1="13" x2="16" y2="15"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="12" y1="15" x2="12" y2="17"/></svg>'  :'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/></svg>';
 _wxBanner='<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 12px;background:'+_wx_bg+';border-bottom:1.5px solid '+_wx_border+'">'  +'<div style="display:flex;align-items:center;gap:7px">'  +'<span style="color:'+_wx_color+';display:inline-flex;align-items:center">'+_wx_icon+'</span>'  +'<div><div style="font-family:var(--font-display);font-size:11px;font-weight:800;color:'+_wx_color+';letter-spacing:.06em">'+(_wx_worse?"CHANGEMENT MÉTÉO — PLUIE":"CHANGEMENT MÉTÉO — SÉCHAGE")+'</div>'  +'<div style="font-size:9px;color:'+_wx_color+';opacity:.75;margin-top:1px">'+_pwc.toLabel+' imminent'+'</div></div></div>'  +'<div style="font-size:10px;font-weight:700;color:'+_wx_color+'">Décision ?</div>'  +'</div>';
}else if(LIVE_RACE._weatherChanged&&(LIVE_RACE._weatherChangeTour||0)===0){
 LIVE_RACE._weatherChangeTour=LIVE_RACE.cur;
}
if(LIVE_RACE._weatherChangeTour&&(LIVE_RACE.cur-LIVE_RACE._weatherChangeTour)<=3){
 var _newWId=(typeof RACE_STATE!=="undefined"&&RACE_STATE.weather&&RACE_STATE.weather.id)||"wet";
 var _newWLabel={wet:"Piste humide",storm:"Pluie battante",cloudy:"Nuageux",dry:"Temps sec"}[_newWId]||"Conditions changées";
 var _newWColor=(_newWId==="wet"||_newWId==="storm")?"var(--blue,#3B82F6)":"var(--amber,#F59E0B)";
 _wxBanner='<div style="display:flex;align-items:center;gap:8px;padding:5px 12px;background:rgba(59,130,246,0.10);border-bottom:1px solid rgba(59,130,246,0.30)">'  +'<span style="font-size:13px;line-height:1">'+(_newWId==="wet"||_newWId==="storm"?"🌧":"☀")+'</span>'  +'<span style="font-family:var(--font-display);font-size:10px;font-weight:800;color:'+_newWColor+';letter-spacing:.06em">MÉTÉO CHANGÉE — '+_newWLabel.toUpperCase()+'</span>'  +'<span style="font-size:9px;color:'+_newWColor+';opacity:.7;margin-left:auto">T'+LIVE_RACE._weatherChangeTour+'</span>'  +'</div>';
}
m+=_wxBanner;

// 1. INSTRUMENTS JOUEUR ───────────────────────────────────────────────────────
m+='<div style="display:grid;grid-template-columns:1fr 1px 1fr 1px 1fr 1px 1fr;align-items:center;padding:8px 12px 7px;border-bottom:1px solid var(--border)">';

// Pos
m+='<div style="text-align:center;padding:0 4px">'
  +'<div style="font-size:8px;color:var(--dim);text-transform:uppercase;letter-spacing:.07em;margin-bottom:1px">Pos</div>'
  +'<div style="font-family:var(--font-display);font-size:28px;font-weight:900;color:'+_posColor+';line-height:1;letter-spacing:-.02em">P'+_p.pos+'</div>'
  +'</div>';
m+='<div style="height:30px;background:var(--border);width:1px"></div>';

// Gap leader
var _gapTxt=_p.pos===1?'<span style="font-size:8px;color:var(--gold);font-weight:800">LEADER</span>':('+'+_p.gap+'s');
m+='<div style="text-align:center;padding:0 4px">'
  +'<div style="font-size:8px;color:var(--dim);text-transform:uppercase;letter-spacing:.07em;margin-bottom:1px">Gap</div>'
  +'<div style="font-family:var(--font-display);font-size:12px;font-weight:700;color:var(--text);line-height:1.1">'+_gapTxt+'</div>'
  +'<div style="font-size:7px;color:var(--muted);margin-top:2px">leader</div>'
  +'</div>';
m+='<div style="height:30px;background:var(--border);width:1px"></div>';

// Dernier tour
m+='<div style="text-align:center;padding:0 4px">'
  +'<div style="font-size:8px;color:var(--dim);text-transform:uppercase;letter-spacing:.07em;margin-bottom:1px">Tour</div>'
  +'<div style="font-family:var(--font-display);font-size:12px;font-weight:700;color:#A78BFA;line-height:1.1">'+s(_p.lastLap)+'</div>'
  +'<div style="font-size:7px;color:var(--muted);margin-top:2px">dernier</div>'
  +'</div>';
m+='<div style="height:30px;background:var(--border);width:1px"></div>';

// Pneus
m+='<div style="text-align:center;padding:0 4px">'+_tyreHtml+'</div>';
m+='</div>';

// 2. TRIO VOISINAGE ────────────────────────────────────────────────────────────
var _hasNeighbour=_ahead||_activeRival||(_hasPit&&_pitHtml);
if(_hasNeighbour){
  m+='<div style="display:flex;gap:5px;padding:6px 10px;border-bottom:1px solid var(--border)">';
  if(_ahead){
    var _aGap=(_p.gap!=null&&_ahead.gap!=null)?Math.abs(_p.gap-_ahead.gap).toFixed(1)+"s":"—";
    m+='<div style="flex:1;background:var(--teal-bg,rgba(52,211,153,0.07));border:1px solid rgba(52,211,153,0.2);border-radius:8px;padding:5px 8px;min-width:0">'
      +'<div style="font-size:8px;color:var(--green);font-weight:800;letter-spacing:.05em;text-transform:uppercase;margin-bottom:2px">▲ Devant</div>'
      +'<div style="font-size:11px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(_ahead.name||"").split(" ").pop()+'</div>'
      +'<div style="font-family:var(--font-display);font-size:12px;font-weight:700;color:var(--green)">–'+_aGap+'</div>'
      +'</div>';
  }
  if(_activeRival){
    var _rvDiff=(_activeRival.gap!=null&&_p.gap!=null)?(_activeRival.gap-_p.gap):null;
    var _rvRelGap=_rvDiff!==null?((_rvDiff>0?"+":"")+_rvDiff.toFixed(1)+"s"):"P"+_activeRival.pos;
    m+='<div style="flex:1;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-left:3px solid '+_rivalColor+';border-radius:8px;padding:5px 7px;min-width:0">'
      +'<div style="font-size:8px;color:'+_rivalColor+';font-weight:800;letter-spacing:.05em;text-transform:uppercase;margin-bottom:2px">'+_rivalIcon+' Rival</div>'
      +'<div style="font-size:11px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(_activeRival.name||"").split(" ").pop()+'</div>'
      +'<div style="font-family:var(--font-display);font-size:12px;font-weight:700;color:'+_rivalColor+'">'+_rvRelGap+'</div>'
      +'</div>';
  }
  if(_hasPit&&_pitHtml&&!_isSprintM){
    m+='<div style="flex:1;background:rgba(96,165,250,0.06);border:1px solid rgba(96,165,250,0.18);border-radius:8px;padding:5px 8px;min-width:0;text-align:center">'
      +'<div style="font-size:8px;color:'+_pitColor+';font-weight:800;letter-spacing:.05em;text-transform:uppercase;margin-bottom:2px">Pit</div>'
      +_pitHtml
      +'</div>';
  }
  m+='</div>';
}

// 3. MEILLEUR TOUR ─────────────────────────────────────────────────────────────
m+=_blHtml;

// 4. EN-TÊTE CLASSEMENT ────────────────────────────────────────────────────────
m+='<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 12px 3px;border-bottom:1px solid var(--line)">'
  +'<span style="font-size:8px;font-weight:800;color:var(--dim);text-transform:uppercase;letter-spacing:.1em">Pilote</span>'
  +'<span style="font-size:8px;font-weight:800;color:var(--dim);text-transform:uppercase;letter-spacing:.1em">Tour · Gap</span>'
  +'</div>';

// 5. CLASSEMENT COMPACT ────────────────────────────────────────────────────────
o.forEach(function(d){
  // Rivalité active
  var _rvMatch=null;
  if(!d.isPlayer&&typeof G._rivalries!=="undefined"&&G._rivalries&&G._rivalries.length>0){
    var _rvF=G._rivalries.find(function(rv){return rv.active&&rv.name===d.name;});
    if(_rvF&&typeof RIVALRY_TYPES!=="undefined"&&RIVALRY_TYPES[_rvF.type]){
      _rvMatch=RIVALRY_TYPES[_rvF.type];
    }
  }

  // Couleurs position
  var _pc=d.pos===1?"var(--gold)":d.pos<=3?"var(--green)":d.isPlayer?"var(--red2,#EF4444)":"var(--text3)";
  var _bg=d.isPlayer?"background:var(--red-bg,rgba(200,16,46,0.07));":"";
  var _bl2=_rvMatch?"border-left:3px solid "+_rvMatch.color+";padding-left:8px;":"";

  // Couleur chrono : best global = violet, best perso = vert, sinon muted
  var _lapC=(LIVE_RACE.bestLap&&d.lastLap&&d.lastLap===LIVE_RACE.bestLap.time&&d.lastLap===d.bestLap)?"#A78BFA":(d.bestLap&&d.lastLap&&d.lastLap===d.bestLap?"var(--green)":"var(--text3)");

  // driverBadge (logo équipe + drapeau national) — comme dans le timing qualif
  var _badge=typeof driverBadge==="function"?driverBadge(d.isPlayer?G.currentTeam:(d.team||null),d.isPlayer?(G.pilot.nat||"FR"):(d.nat||"FR"),16):"";

  // Compound dot couleur F1
  var _cmpDot="";
  if(d._tyreCompound){
    var _dci=_cmpInfo(d._tyreCompound);
    _cmpDot='<span style="display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:50%;background:'+_dci.color+';font-size:7px;font-weight:900;color:'+(_dci.text||"#000")+';flex-shrink:0;border:1px solid rgba(255,255,255,0.15)">'+(_dci.short||"M")+'</span>';
  }

  // Flèche mouvement
  var _arrowHtml="";
  if(typeof d._prevRenderPos!=="undefined"&&d._prevRenderPos!==d.pos){
    _arrowHtml=d._prevRenderPos>d.pos
      ?'<svg width="8" height="8" viewBox="0 0 9 9" fill="var(--green)"><path d="M4.5 1L8 7H1L4.5 1z"/></svg>'
      :'<svg width="8" height="8" viewBox="0 0 9 9" fill="var(--red)"><path d="M4.5 8L1 2h7L4.5 8z"/></svg>';
  }
  d._prevRenderPos=d.pos;

  // Pénalité
  var _penHtml="";
  if(d.penaltySec&&d.penaltySec>0){
    _penHtml='<span style="font-size:8px;color:var(--amber);font-family:var(--font-display);font-weight:800;margin-left:2px">+'+Math.round(d.penaltySec)+'s</span>';
  }

  // Nom
  var _nameShort=d.isPlayer?((typeof G!=="undefined"&&G.pilot?((G.pilot.prenom?G.pilot.prenom[0]+". ":"")+G.pilot.nom):"Toi")):((d.name||"").split(" ").pop());
  var _nameColor=d.isPlayer?"var(--text)":(_rvMatch?_rvMatch.color:"var(--text2)");
  var _nameW=d.isPlayer?"700":"400";
  var _prefix=d.isPlayer?'<span style="color:var(--red2,#C8102E);font-size:9px;margin-right:3px">▶</span>':"";
  var _rvSfx=_rvMatch?'<span style="font-size:8px;color:'+_rvMatch.color+';margin-left:3px">'+(_rvMatch.icon||"⚡")+'</span>':"";

  // Gap texte
  var _gT2=d.dnf?'<span style="color:var(--red);font-size:9px;font-weight:700">DNF</span>':(d.pos===1?'<span style="color:var(--gold);font-size:8px">Ldr</span>':'+'+d.gap+'s');

  m+='<div style="display:flex;align-items:center;gap:5px;padding:4px 12px;border-top:1px solid var(--line);min-height:30px;'+_bg+_bl2+'">'
    +'<span style="font-family:var(--font-display);font-size:11px;font-weight:800;color:'+_pc+';width:22px;flex-shrink:0">P'+d.pos+'</span>'
    +_badge
    +'<span style="flex:1;min-width:0;display:flex;align-items:center">'+_prefix+'<span style="font-size:11px;font-weight:'+_nameW+';color:'+_nameColor+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+_nameShort+'</span>'+_rvSfx+'</span>'
    +_cmpDot
    +'<span style="font-family:var(--font-display);font-size:9px;color:'+_lapC+';width:44px;text-align:right;flex-shrink:0">'+s(d.lastLap)+'</span>'
    +'<span style="font-family:var(--font-display);font-size:9px;color:var(--text3);width:36px;text-align:right;flex-shrink:0">'+_gT2+'</span>'
    +'<span style="width:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;margin-left:1px">'+_arrowHtml+'</span>'
    +_penHtml
    +'</div>';
});

// 6. BARRE STATUT : momentum + mental + météo ─────────────────────────────────
m+='<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 12px;border-top:1px solid var(--border);background:var(--bg2)">'
  // Momentum
  +'<span style="font-size:9px;font-weight:700;color:'+_mmC[0]+'">'+_mmC[1]+'</span>'
  // Mental — 3 dots colorés + valeur
  +'<span style="display:flex;align-items:center;gap:4px">'
  +'<span style="font-size:9px;color:'+_mentalColor+';font-family:var(--font-display);letter-spacing:.08em">'+_mentalIcon+'</span>'
  +'<span style="font-size:9px;color:'+_mentalColor+';font-weight:700">'+Math.round(_mental)+'</span>'
  +'</span>'
  // Météo
  +'<span style="display:flex;align-items:center;gap:3px"><span style="font-size:11px;line-height:1">'+_wIcon+'</span><span style="font-size:9px;color:var(--text3)">'+_wLabel+'</span></span>'
  // % course
  +'<span style="font-size:9px;color:var(--dim)">'+Math.round(a*100)+'%</span>'
  +'</div>';

e.innerHTML=m;

// Nettoyage anciens widgets standalone
var _oldBadge=document.getElementById("lbd-momentum-badge");
if(_oldBadge&&_oldBadge.parentNode)_oldBadge.parentNode.removeChild(_oldBadge);
var _oldTyre=document.getElementById("live-tyre-life-widget");
if(_oldTyre&&_oldTyre.parentNode)_oldTyre.parentNode.removeChild(_oldTyre);
}

function showLiveEvent(e){
 // Fermer le mur des stands si ouvert
 var _pwm=document.getElementById('pitwall-modal');
 if(_pwm&&_pwm.parentNode)_pwm.parentNode.removeChild(_pwm);
  try{
    var _p=(typeof LIVE_RACE!=="undefined"&&LIVE_RACE&&LIVE_RACE.drivers)?LIVE_RACE.drivers.find(function(d){return d.isPlayer}):null;
    if(_p&&_p.dnf){if(typeof LIVE_RACE!=="undefined"&&LIVE_RACE)LIVE_RACE.paused=false;return;}
  }catch(_e){}
  var t=document.getElementById("live-event-modal");
  if(!t)return;

  var isRadio=typeof _isRadioMessage==="function"&&_isRadioMessage(e);
  var lap=LIVE_RACE?LIVE_RACE.cur:0;
  var totalLaps=LIVE_RACE?LIVE_RACE.total:0;
  var lapPct=totalLaps>0?lap/totalLaps:0;
  var phase=lapPct<0.25?"Début":lapPct<0.55?"Mi-course":lapPct<0.82?"Fin de course":"Sprint final";

  // Couleur accent selon type d'événement
  var accentColor="#F59E0B";
  var accentBg="rgba(245,158,11,0.08)";
  var accentBorder="rgba(245,158,11,0.25)";
  if(isRadio){accentColor="#22D3EE";accentBg="rgba(34,211,238,0.08)";accentBorder="rgba(34,211,238,0.3)";}
  else if(e.color){
    accentColor=e.color;
    if(e.color==="#EF4444"){accentBg="rgba(239,68,68,0.08)";accentBorder="rgba(239,68,68,0.25)";}
    else if(e.color==="#34D399"){accentBg="rgba(52,211,153,0.08)";accentBorder="rgba(52,211,153,0.25)";}
    else if(e.color==="#60A5FA"){accentBg="rgba(96,165,250,0.08)";accentBorder="rgba(96,165,250,0.25)";}
    else if(e.color==="#A78BFA"){accentBg="rgba(167,139,250,0.08)";accentBorder="rgba(167,139,250,0.25)";}
  }

  // Construire le HTML de la card
  var html='';

  // === CARD PRINCIPALE ===
  html+='<div style="background:linear-gradient(180deg,#0e0e14 0%,#080810 100%);border-top:2px solid '+accentColor+';border-left:1px solid rgba(255,255,255,0.06);border-right:1px solid rgba(255,255,255,0.06);border-radius:16px 16px 0 0;max-width:460px;width:100%;overflow:hidden;box-shadow:0 -8px 40px rgba(0,0,0,0.7),0 0 0 1px rgba(255,255,255,0.03);padding-bottom:env(safe-area-inset-bottom,0px)">';

  // === BARRE BROADCAST ===
  html+='<div style="display:flex;align-items:center;gap:8px;padding:8px 14px;background:'+accentBg+';border-bottom:1px solid '+accentBorder+'">';
  // LED pulsante
  html+='<span style="display:inline-flex;width:6px;height:6px;border-radius:50%;background:'+accentColor+';box-shadow:0 0 8px '+accentColor+';flex-shrink:0;animation:lec-pulse 1s ease-in-out infinite"></span>';
  html+='<span style="font-family:var(--font-display);font-size:9px;font-weight:900;color:'+accentColor+';letter-spacing:.22em;text-transform:uppercase;flex:1">'+(isRadio?"📻 RADIO TEAM":"EN COURSE")+'</span>';
  html+='<span style="font-family:var(--font-display);font-size:9px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:.1em">T'+lap+' / '+totalLaps+'</span>';
  html+='<span style="width:1px;height:12px;background:rgba(255,255,255,0.12);margin:0 4px"></span>';
  html+='<span style="font-family:var(--font-display);font-size:9px;font-weight:700;color:rgba(255,255,255,0.3);letter-spacing:.08em;text-transform:uppercase">'+phase+'</span>';
  html+='</div>';

  // === HEADER ÉVÉNEMENT ===
  html+='<div style="padding:14px 16px 10px;border-bottom:1px solid rgba(255,255,255,0.05)">';
  // Tag type
  html+='<div style="display:inline-flex;align-items:center;gap:5px;background:'+accentBg+';border:1px solid '+accentBorder+';border-radius:4px;padding:2px 8px;margin-bottom:8px">';
  html+='<span style="font-family:var(--font-display);font-size:9px;font-weight:800;color:'+accentColor+';letter-spacing:.14em;text-transform:uppercase">'+(isRadio?"Transmission radio":"Événement course")+'</span>';
  html+='</div>';
  // Titre
  html+='<div style="font-family:var(--font-display);font-size:18px;font-weight:900;color:#fff;line-height:1.15;letter-spacing:-.01em;margin-bottom:8px">'+e.title+'</div>';
  // Description
  html+='<div id="lec-desc-new" style="font-size:13.5px;font-weight:500;color:rgba(255,255,255,0.72);line-height:1.55;font-family:var(--font-body)">'+e.desc+'</div>';
  html+='</div>';

  // === CHOICES ===
  html+='<div id="lec-choices-new" style="padding:10px 14px;display:flex;flex-direction:column;gap:7px">';

  e.choices.forEach(function(choice,idx){
    var mod=choice.mod||0;
    var isAdv=mod>0.04;
    var isRisk=mod<-0.02;
    var hasDnf=choice.chance&&choice.chance.dnf;
    var hasPen=choice.chance&&choice.chance.penalty;
    var hasUncertain=choice.chance&&!hasPen&&!hasDnf;

    // Couleur du bouton
    var btnBg="rgba(255,255,255,0.04)";
    var btnBorder="rgba(255,255,255,0.1)";
    var btnBorderAccent="rgba(255,255,255,0.18)";
    var indicatorColor="";
    var indicatorLabel="";
    if(hasDnf){btnBg="rgba(239,68,68,0.06)";btnBorder="rgba(239,68,68,0.25)";btnBorderAccent="#EF4444";indicatorColor="#EF4444";indicatorLabel="⊘ Risque abandon";}
    else if(isAdv){btnBg="rgba(52,211,153,0.06)";btnBorder="rgba(52,211,153,0.2)";btnBorderAccent="#34D399";indicatorColor="#34D399";indicatorLabel="↑ Avantage";}
    else if(isRisk||hasPen){btnBg="rgba(245,158,11,0.05)";btnBorder="rgba(245,158,11,0.2)";btnBorderAccent="#F59E0B";indicatorColor="#F59E0B";indicatorLabel=hasPen?"⚠ Risque pénalité":"↓ Risqué";}
    else if(hasUncertain){indicatorColor="rgba(255,255,255,0.3)";indicatorLabel="~ Incertain";}

    html+='<button onclick="resolveLiveEvent('+idx+')" style="width:100%;text-align:left;padding:11px 13px;background:'+btnBg+';border:1px solid '+btnBorder+';border-radius:10px;cursor:pointer;font-family:inherit;-webkit-tap-highlight-color:transparent;transition:border-color .12s;position:relative;overflow:hidden">';
    // Accent gauche
    if(btnBorderAccent!==btnBorder){
      html+='<div style="position:absolute;top:0;left:0;width:3px;height:100%;background:'+btnBorderAccent+';border-radius:10px 0 0 10px"></div>';
    }
    // Texte
    html+='<div style="font-size:13px;font-weight:600;color:rgba(255,255,255,0.92);line-height:1.4;padding-left:'+(btnBorderAccent!==btnBorder?'10px':'0')+'">'+(choice.text||choice.label||"")+'</div>';
    // Badge indicateur
    if(indicatorLabel){
      html+='<div style="margin-top:5px;padding-left:'+(btnBorderAccent!==btnBorder?'10px':'0')+'">';
      html+='<span style="font-family:var(--font-display);font-size:9px;font-weight:800;color:'+indicatorColor+';letter-spacing:.1em;text-transform:uppercase">'+indicatorLabel+'</span>';
      html+='</div>';
    }
    html+='</button>';
  });

  html+='</div>';

  // === FEEDBACK ZONE ===
  html+='<div id="lec-feedback-new" style="display:none;padding:10px 14px 14px"></div>';

  html+='</div>';

  // Styles animation
  html+='<style>@keyframes lec-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(0.85)}}</style>';

  t.innerHTML=html;
  t.style.display="flex";

  // Mise à jour du feedback pour la résolution
  // Patch resolveLiveEvent pour pointer vers les nouveaux IDs
  LIVE_RACE._lecNewDesign=true;

  // Radio mode
  if(isRadio){
    if(typeof playRadioOpen==="function")try{playRadioOpen();}catch(_e){}
  }
}function resolveLiveEvent(e){var t=LIVE_RACE.pendingEvent;if(t){if(typeof _isRadioMessage==="function"&&_isRadioMessage(t)&&typeof playRadioClose==="function")try{playRadioClose()}catch(_e){}var r=t.choices[e];
// Compatibilité format score/action/outcomes vs mod/chance
if(r&&typeof r.score==="number"&&typeof r.mod==="undefined"){
 r=Object.assign({},r,{
  text:r.text||r.label||"",
  mod:(r.score-50)/1000,  // score 50=neutre, 65→+0.015, 40→-0.01
  actionType:r.action||""
 });
}
// Appliquer le bonus/malus setup sur la difficulté du choix
(function(){
 try{
  var _feel=(typeof _getSetupFeel==="function")?_getSetupFeel():null;
  if(!_feel||!r.actionType)return;
  var _diff=r.difficulty;if(typeof _diff!=="number")return;
  var _mod=0;
  if(r.actionType==="attaque"||r.actionType==="defense"&&false)_mod=_feel.attackMod||0;
  if(r.actionType==="defense")_mod=_feel.defenseMod||0;
  // Baisser la difficulté = plus facile (attackMod positif = attaque facilitée)
  if(_mod!==0)r=Object.assign({},r,{
   difficulty:Math.max(0.05,Math.min(0.95,_diff-_mod*0.5)),
   brilliantMod:(r.brilliantMod||0)+_mod*0.015,
   rateMajMod:(r.rateMajMod||0)-_mod*0.015
  });
 }catch(_e){}
})();
var n=r.mod||0,a="",i=!1,o=0;if(t._isWeatherEvent&&LIVE_RACE._pendingWeatherChange){var _wc=LIVE_RACE._pendingWeatherChange;var _newWeather;if(_wc.to==="storm")_newWeather={id:"storm",label:"Pluie battante",badge:"b-blue",icon:"storm",rainMod:-.12,visibilityMod:-.06,tyreMod:-.1,safetyMod:.15};else if(_wc.to==="wet")_newWeather={id:"wet",label:"Piste humide",badge:"b-blue",icon:"wet",rainMod:-.06,visibilityMod:-.02,tyreMod:-.05,safetyMod:.08};else if(_wc.to==="cloudy")_newWeather={id:"cloudy",label:"Nuageux",badge:"b-gray",icon:"cloudy",rainMod:0,visibilityMod:0,tyreMod:0,safetyMod:0};else if(_wc.to==="dry")_newWeather={id:"dry",label:"Temps sec",badge:"b-gray",icon:"dry",rainMod:.02,visibilityMod:.01,tyreMod:.01,safetyMod:-.03};if(_newWeather){RACE_STATE.weather=_newWeather;var _circ=RACE_STATE.circuit||(typeof getNextRace==="function"&&getNextRace()&&getNextRace().name)||"";var _newRef=_circ?getCircuitBaseRef(_circ,G.cat):85;_newRef*=1-1.5*(_newWeather.rainMod||0);LIVE_RACE.baseRef=_newRef;LIVE_RACE._weatherChanged=!0;var _strat=r._weatherStrategy||"";var _radioOk;if(_strat==="pit"){_radioOk=" Bonne décision — pit dans le tour, pneus prêts.";if(typeof _playerPit==="function"&&_pitEnabledForCurrentRace()){var pitPlayer=LIVE_RACE.drivers.find(function(d){return d.isPlayer});if(pitPlayer&&!pitPlayer.dnf&&(pitPlayer._pitsDone||0)<_pitConfigForCat().maxStops){_playerPit(true)}}}else if(_strat==="stay")_radioOk=" Compris, on tient avec ces pneus. Sois prudent.";else if(_strat==="push")_radioOk=" Push push push ! Profite avant le changement !";LIVE_RACE.newsFeed||(LIVE_RACE.newsFeed=[]);LIVE_RACE.newsFeed.unshift({icon:_newWeather.icon||"cloudy",title:"Météo — "+_wc.label+" → "+_wc.toLabel,desc:_radioOk||("Conditions changées : "+_wc.toLabel),color:_wc.worsening?"#60A5FA":"#34D399",ttl:6,lap:LIVE_RACE.cur});if(LIVE_RACE.newsFeed.length>3)LIVE_RACE.newsFeed=LIVE_RACE.newsFeed.slice(0,3);LIVE_RACE._pendingWeatherChange=null}}if(r.chance&&Math.random()<r.chance.fail){var s;if(n+=r.chance.failMod||0,a=r.chance.msg||"",r.chance.dnf&&(i=!0),!i&&a)/abandon|abandonne|abandonnes|dnf|explose|tu pars dans le rail|course terminée|suspension cassée|crevaison.*éclat|chaîne lâche|casse moteur|panne sèche|moteur fond/i.test(a)&&(i=!0);r.chance.penalty&&(o=r.chance.penalty)}r.penalty&&(o=r.penalty);var l=LIVE_RACE.drivers.find(function(e){return e.isPlayer});if(l&&!l.dnf&&(l.evtMod+=n,"number"!=typeof l.eventScoreOffset&&(l.eventScoreOffset=0),l.eventScoreOffset+=.5*n,l.eventScoreOffset=Math.max(-.10,Math.min(.10,l.eventScoreOffset)),l.score=Math.min(.99,Math.max(.01,l.score+.4*n)),(i||n<-.28)&&(l.dnf=!0,"function"==typeof addPressure&&addPressure(5)),o>0&&(l.penaltySec=Math.round((l.penaltySec||0)+o),l.penaltyLog||(l.penaltyLog=[]),l.penaltyLog.push({sec:o,reason:t.title,lap:LIVE_RACE.cur}),a?a+=" · +"+o+"s de pénalité":a="+"+o+"s de pénalité","function"==typeof addPressure&&addPressure(3))),(function(){
 // === Persistent effects layer ===
 // Si l'event a des outputs explicites (posLoss, paceMod, tyreDamage) → on les applique tels quels.
 // Sinon, on convertit automatiquement le `mod` legacy en paceMod pour qu'il ait un vrai impact dans le temps.
 if(!l||l.dnf)return;
 var pOut={reason:t.title};
 var hasExplicit=false;
 if(typeof r.posLoss==="number"&&r.posLoss>0){pOut.posLoss=r.posLoss;hasExplicit=true}
 if(typeof r.posGain==="number"&&r.posGain>0){pOut.posGain=r.posGain;hasExplicit=true}
 if(r.paceMod){pOut.paceMod=r.paceMod;hasExplicit=true}
 if(r.tyreDamage){pOut.tyreDamage=r.tyreDamage;hasExplicit=true}
 // Si pas d'output explicite et un mod non-trivial, on convertit
 if(!hasExplicit&&Math.abs(n)>=0.012){
  var _conv=_convertLegacyMod(l,n,t.title);
  if(_conv&&_conv.paceMod)pOut.paceMod=_conv.paceMod;
 }
 // Skip si rien à appliquer
 if(!pOut.posLoss&&!pOut.posGain&&!pOut.paceMod&&!pOut.tyreDamage)return;
 var _summary=applyEventOutcome(l,pOut);
 if(_summary&&_summary.summary){
  a=a?(a+" · "+_summary.summary):_summary.summary;
 }
})(),r._doPit&&"function"==typeof _playerPit&&"function"==typeof _pitEnabledForCurrentRace&&_pitEnabledForCurrentRace()&&l&&!l.dnf&&(l._pitsDone||0)<_pitConfigForCat().maxStops&&_playerPit(true),r.rival&&G.rivals[r.rival.idx]){var c=LIVE_RACE.drivers.find(function(e){return!e.isPlayer&&e.rivalIdx===r.rival.idx});c&&(c.evtMod+=r.rival.val,c.score=Math.min(.99,Math.max(.01,c.score+r.rival.val)),c.score<.05&&(c.dnf=!0)),RACE_STATE.rivalMods[r.rival.idx]=(RACE_STATE.rivalMods[r.rival.idx]||0)+r.rival.val}LIVE_RACE.resolvedEvents.push({icon:t.icon,title:t.title,choice:r.text.substring(0,55),mod:n,note:a}),RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:t.phase,text:t.title,choice:r.text.substring(0,50),note:a||(n>.03?"Bonne décision !":n<-.03?"Coup dur.":"Impact limité."),sign:n>.01?"+":n<-.01?"−":"~",color:n>.01?"#34D399":n<-.01?"var(--red-light)":"var(--text3)"}),RACE_STATE.evtMod+=n;var d=document.getElementById("live-event-modal"),p=document.getElementById("lec-feedback-new")||document.getElementById("lec-feedback"),u=document.getElementById("lec-choices-new")||document.getElementById("lec-choices");if(u&&(u.style.display="none"),p){var _oc2=(t.choices[e]&&t.choices[e].outcomes)||null;var _otxt2=_oc2?(n>.025?(_oc2.brillant||_oc2.succes||""):n>-.01?(_oc2.succes||""):(_oc2.echec||"")):"";
var f=_otxt2||((a?a+" — ":"")+(n>.02?"Bonne décision !":n<-.02?"Coup dur.":"Impact limité.")),m=n>.01?"#34D399":n<-.01?"#EF4444":"var(--text3)",g=n>.01?renderIcon("trend",16,"#34D399"):n<-.01?renderIcon("downtrend",16,"#EF4444"):"";p.style.display="block",p.innerHTML='<div style="display:flex;align-items:center;gap:8px"><span>'+g+'</span><span style="font-size:13px;font-weight:700;color:'+m+'">'+f+"</span></div>",setTimeout(function(){d&&(d.style.display="none"),u&&(u.style.display="flex"),p&&(p.style.display="none",p.innerHTML=""),LIVE_RACE.paused=!1,updateLivePositions(),renderLiveLeaderboard()},1200)}else d&&(d.style.display="none"),LIVE_RACE.paused=!1;LIVE_RACE.pendingEvent=null}}function finalizeLiveRace(){try{if("function"==typeof _hideRaceEventModal&&_hideRaceEventModal(),void 0!==RACE_STATE&&RACE_STATE&&(RACE_STATE.events=[]),CURRENT_EVT_IDX=0,LIVE_RACE&&(LIVE_RACE.paused=!1,LIVE_RACE._tyreMode="normal"),(function(){var btn=document.getElementById("pit-button-container");if(btn)btn.remove();var tmb=document.getElementById("tyre-mode-container");if(tmb)tmb.remove();var mdsb=document.getElementById("pitwall-btn");if(mdsb&&mdsb.parentNode)mdsb.parentNode.removeChild(mdsb);var mdsm=document.getElementById("pitwall-modal");if(mdsm&&mdsm.parentNode)mdsm.parentNode.removeChild(mdsm)})(),!LIVE_RACE||!Array.isArray(LIVE_RACE.drivers)||0===LIVE_RACE.drivers.length)return LIVE_RACE_FINAL_POS=G.rivals&&G.rivals.length?Math.ceil(G.rivals.length/2):1,void showResult();(function(){try{/* SPRINT — pas de pit obligatoire en sprint, donc pas de pénalité pour minStops */ if(LIVE_RACE._isSprintMode)return;var cfg=_pitConfigForCat();if(!cfg||!cfg.enabled||!cfg.minStops)return;LIVE_RACE.drivers.forEach(function(d){if(d.dnf)return;var done=d._pitsDone||0;if(done<cfg.minStops){var missed=cfg.minStops-done;var pen=cfg.stopTimeMax*missed*1.2;d.penaltySec=(d.penaltySec||0)+pen;d._missedPits=missed;if(d.isPlayer){RACE_STATE.eventsLog&&RACE_STATE.eventsLog.push({lap:(typeof LIVE_RACE!=="undefined"&&LIVE_RACE?LIVE_RACE.cur:0),phase:"Fin",text:"Arrêt obligatoire manqué !",choice:"—",note:"Pénalité de "+pen.toFixed(0)+"s",sign:"−",color:"#EF4444"})}}})}catch(e){console.warn("pit compliance check:",e)}})();try{
// === Tri final officiel : on conserve l'ORDRE DE COURSE (positions affichées au dernier tour) ===
// Le tri en course utilise score-penaltySec/45 (proxy lisse) et applique un cap de mouvement.
// Si on triait à la fin par totalTime cumulatif, on aurait des incohérences :
// un pilote affiché 3e au dernier tour pourrait finir 1er à cause d'un cumul plus rapide
// au début de course. C'est faux : la position physique sur la piste = position affichée.
// Ici on RESPECTE l'ordre du dernier tour, puis on applique uniquement les PÉNALITÉS
// (qui s'ajoutent au temps et peuvent vraiment déclasser).
(function _finalizeOfficialOrder(){
 if(!LIVE_RACE||!LIVE_RACE.drivers)return;
 var alive=LIVE_RACE.drivers.filter(function(d){return!d.dnf});
 if(alive.length===0)return;
 // Méthode : on utilise totalTime + penaltySec comme temps officiel SI les totalTime
 // sont cohérents avec l'ordre des positions courantes. Sinon on bascule sur un modèle
 // "1s par position" pour préserver l'ordre du dernier tour.
 //
 // 1) On trie les pilotes vivants par position courante (l'ordre affiché au dernier tour)
 var byPos=alive.slice().sort(function(a,b){return (a.pos||99)-(b.pos||99)});
 // 2) On calcule pour chacun un "temps de référence" basé sur leur position courante :
 //    leader = 0, P2 = +écart_typique, etc. L'écart typique varie par catégorie.
 var _isKart=G.cat==="Karting Junior"||G.cat==="Karting Senior";
 // Écart typique par position (en secondes) :
 //  - Karting : ~0.5s par position
 //  - F4/F3 : ~0.8s par position
 //  - F1/F2 : ~1.2s par position
 var gapPerPos=_isKart?0.5:(G.cat==="Formule 1"||G.cat==="Formule 2"?1.2:0.8);
 byPos.forEach(function(d,idx){
  d._refTime=idx*gapPerPos+(d.penaltySec||0);
 });
 // 3) Tri par _refTime — sans pénalité c'est identique à l'ordre courant
 alive.sort(function(a,b){
  if(a._refTime!==b._refTime)return a._refTime-b._refTime;
  // Tie-break par totalTime cumulé si disponible
  var ta=typeof a.totalTime==="number"?a.totalTime:0;
  var tb=typeof b.totalTime==="number"?b.totalTime:0;
  return ta-tb;
 });
 // 4) Réassigner les positions sans cap
 alive.forEach(function(d,idx){d.pos=idx+1;});
 // 5) Calculer les écarts vs leader.
 // L'approche : on utilise _refTime comme base d'écart car c'est ce qui détermine l'ordre.
 // Le leader a _refTime = 0 (ou +pénalité s'il en a une). On affiche le delta de _refTime.
 // Cela garantit que les écarts sont cohérents avec l'ordre affiché.
 var newLeader=alive[0];
 var newLeaderRef=newLeader?(newLeader._refTime||0):0;
 alive.forEach(function(d){
  if(d.pos===1)d.gap=0;
  else{
   // Gap = différence de _refTime (cohérent avec l'ordre)
   var refGap=Math.max(0,(d._refTime||0)-newLeaderRef);
   d.gap=parseFloat(refGap.toFixed(1));
  }
 });
 // 6) Les DNF en queue de classement, triés par tour de DNF (DNF tardif > DNF précoce)
 var nextPos=alive.length+1;
 var dnfList=LIVE_RACE.drivers.filter(function(d){return d.dnf});
 dnfList.sort(function(a,b){
  var la=typeof a._dnfAtLap==="number"?a._dnfAtLap:0;
  var lb=typeof b._dnfAtLap==="number"?b._dnfAtLap:0;
  return lb-la;
 });
 dnfList.forEach(function(d){d.pos=nextPos++;});
 // Nettoyage
 LIVE_RACE.drivers.forEach(function(d){delete d._refTime;});
})();}catch(e){console.warn("_finalizeOfficialOrder failed:",e);try{updateLivePositions()}catch(e2){console.warn("updateLivePositions fallback failed:",e2)}}if(LIVE_RACE.newsFeed=[],"function"==typeof renderLiveNewsFeed)try{renderLiveNewsFeed()}catch(e){}var e=LIVE_RACE.drivers.find(function(e){return e.isPlayer}),t=e?e.dnf?LIVE_RACE.drivers.length:e.pos||LIVE_RACE.drivers.length:G.rivals.length+1;LIVE_RACE.drivers.forEach(function(e){if(!e.isPlayer){var t=(LIVE_RACE._isSprintMode&&typeof SPRINT_PTS_TABLE!=="undefined"?SPRINT_PTS_TABLE:PTS_TABLE)[(e.pos||99)-1]||0;void 0!==e.rivalIdx&&G.rivals[e.rivalIdx]&&(G.rivals[e.rivalIdx].pts+=t,G.rivals[e.rivalIdx].lastPos=e.pos,G.rivals[e.rivalIdx].raceHistory=G.rivals[e.rivalIdx].raceHistory||[],G.rivals[e.rivalIdx].raceHistory.push({pos:e.pos,pts:t,dnf:!!e.dnf,sprint:!!LIVE_RACE._isSprintMode}))}}),LIVE_RACE_FINAL_POS=t,showResult()}catch(finErr){console.error("[RJ] finalizeLiveRace failed:", finErr&&finErr.message, finErr&&finErr.stack);try{var _btn=document.getElementById("race-btn");if(_btn){_btn.disabled=false;_btn.textContent="Voir résultat";_btn.onclick=function(){try{showResult()}catch(e){console.error(e)}}}}catch(_){}try{if(typeof showResult==="function")showResult()}catch(rErr){console.error("[RJ] showResult also failed:", rErr&&rErr.message)}try{if(typeof pushHomeToast==="function")pushHomeToast("Erreur","Problème en fin de course (voir console). Cliquez le bouton pour continuer.","#EF4444");}catch(_){}}}var LIVE_RACE_FINAL_POS=0;
function showWeekendRecap(){try{var hist=(LIVE_RACE&&LIVE_RACE._lapHistory)||[];if(hist.length<2){if(typeof showAlertDialog==="function")showAlertDialog({title:"Récap indisponible",message:"Pas assez de données pour ce week-end."});return}var existing=document.getElementById("rj-recap-overlay");if(existing)existing.remove();var ov=document.createElement("div");ov.id="rj-recap-overlay";ov.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:9996;display:flex;align-items:center;justify-content:center;padding:14px;animation:apex-fade-in .2s ease;overflow-y:auto";var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});var totalDrivers=hist[0]?hist[0].total:20;var quali=p?(p.gridPos||totalDrivers):totalDrivers;var finalPos=p&&!p.dnf?(p.pos||totalDrivers):"DNF";var deltaQR=p&&!p.dnf?(quali-(p.pos||totalDrivers)):null;var deltaStr=deltaQR===null?"DNF":(deltaQR>0?"+"+deltaQR:deltaQR===0?"=":""+deltaQR);var deltaColor=deltaQR===null?"#EF4444":(deltaQR>0?"#34D399":(deltaQR<0?"#EF4444":"#9CA3AF"));var bestPos=null,worstPos=null,timeInP1=0;var overtakesMade=0,overtakesLost=0;hist.forEach(function(h){if(h.pos!=null){if(bestPos===null||h.pos<bestPos)bestPos=h.pos;if(worstPos===null||h.pos>worstPos)worstPos=h.pos;if(h.pos===1)timeInP1++;if(h.posChange){if(h.posChange>0)overtakesMade+=h.posChange;else overtakesLost+=Math.abs(h.posChange)}}});var hasTeammate=hist.some(function(h){return h.tmPos!=null});var pitLaps=hist.filter(function(h){return h.pit==="player"}).map(function(h){return h.lap});var totalLaps=Math.max.apply(null,hist.map(function(h){return h.lap}));var w=320,svgH=170,padL=24,padR=12,padT=10,padB=22;var maxPos=Math.max(totalDrivers,worstPos||1);var xStep=(w-padL-padR)/Math.max(1,totalLaps-1);var yScale=(svgH-padT-padB)/Math.max(1,maxPos-1);var pts=hist.filter(function(p){return p.pos!=null}).map(function(p){return{x:padL+(p.lap-1)*xStep,y:padT+(p.pos-1)*yScale,lap:p.lap,pos:p.pos}});var tmPts=hasTeammate?hist.filter(function(p){return p.tmPos!=null}).map(function(p){return{x:padL+(p.lap-1)*xStep,y:padT+(p.tmPos-1)*yScale,lap:p.lap,pos:p.tmPos}}):[];var pathD="";pts.forEach(function(pt,i){pathD+=(i===0?"M":"L")+pt.x.toFixed(1)+" "+pt.y.toFixed(1)});var tmPathD="";tmPts.forEach(function(pt,i){tmPathD+=(i===0?"M":"L")+pt.x.toFixed(1)+" "+pt.y.toFixed(1)});var lines="";for(var i=0;i<=4;i++){var posVal=1+Math.round((maxPos-1)*i/4);var yVal=padT+(posVal-1)*yScale;lines+='<line x1="'+padL+'" y1="'+yVal+'" x2="'+(w-padR)+'" y2="'+yVal+'" stroke="rgba(255,255,255,0.06)" stroke-width="0.5"/>';lines+='<text x="'+(padL-4)+'" y="'+(yVal+3)+'" text-anchor="end" fill="rgba(255,255,255,0.4)" font-size="8" font-family="monospace">P'+posVal+'</text>'}var phaseColors={0:"#9CA3AF",1:"#60A5FA",2:"#34D399",3:"#FBBF24",4:"#F87171",5:"#EF4444"};var phaseSegs="";var prevPhase=hist[0]&&hist[0].phase!=null?hist[0].phase:0;var phaseStart=0;hist.forEach(function(h,idx){if(h.phase!==prevPhase||idx===hist.length-1){var startLap=hist[phaseStart].lap;var endLap=h.lap;var x1=padL+(startLap-1)*xStep;var x2=padL+(endLap-1)*xStep;phaseSegs+='<rect x="'+x1+'" y="'+(svgH-padB+1)+'" width="'+(x2-x1)+'" height="3" fill="'+(phaseColors[prevPhase]||"#9CA3AF")+'" opacity="0.5"/>';prevPhase=h.phase;phaseStart=idx}});var pitMarkers="";pitLaps.forEach(function(pitLap){var x=padL+(pitLap-1)*xStep;pitMarkers+='<line x1="'+x.toFixed(1)+'" y1="'+padT+'" x2="'+x.toFixed(1)+'" y2="'+(svgH-padB)+'" stroke="#FBBF24" stroke-width="1" stroke-dasharray="2,2" opacity="0.6"/>';pitMarkers+='<circle cx="'+x.toFixed(1)+'" cy="'+(svgH-padB-2)+'" r="2.5" fill="#FBBF24" stroke="#000" stroke-width="0.5"/>'});var posMarker=pts.length>0?'<circle cx="'+pts[pts.length-1].x.toFixed(1)+'" cy="'+pts[pts.length-1].y.toFixed(1)+'" r="3.8" fill="#FF1801" stroke="#fff" stroke-width="1.2"/>':"";var startMarker=pts.length>0?'<circle cx="'+pts[0].x.toFixed(1)+'" cy="'+pts[0].y.toFixed(1)+'" r="2.5" fill="rgba(255,255,255,0.7)"/>':"";var tmEndMarker=tmPts.length>0?'<circle cx="'+tmPts[tmPts.length-1].x.toFixed(1)+'" cy="'+tmPts[tmPts.length-1].y.toFixed(1)+'" r="2.5" fill="#22D3EE" opacity="0.85"/>':"";var tmPathSvg=tmPathD?'<path d="'+tmPathD+'" stroke="#22D3EE" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3,2" opacity="0.7"/>':"";var pathLength=pts.length*60;var svg='<svg id="rj-recap-svg" viewBox="0 0 '+w+' '+svgH+'" width="100%" style="display:block;background:rgba(0,0,0,0.4);border-radius:10px">'+lines+phaseSegs+pitMarkers+tmPathSvg+'<path d="'+pathD+'" stroke="#FF1801" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="'+pathLength+'" stroke-dashoffset="'+pathLength+'" style="animation:rj-recap-draw 1.6s cubic-bezier(.4,0,.2,1) forwards"/>'+startMarker+tmEndMarker+posMarker+'</svg>';var legendHtml=hasTeammate?'<div style="display:flex;align-items:center;gap:14px;justify-content:center;margin-top:8px;font-size:10px;color:var(--text2)"><span style="display:inline-flex;align-items:center;gap:5px"><span style="width:14px;height:2px;background:#FF1801;border-radius:1px"></span>Toi</span><span style="display:inline-flex;align-items:center;gap:5px"><span style="width:14px;height:2px;background:#22D3EE;border-image:repeating-linear-gradient(90deg,#22D3EE 0 3px,transparent 3px 5px) 1"></span>Coéquipier</span>'+(pitLaps.length>0?'<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:6px;height:6px;background:#FBBF24;border-radius:50%"></span>Pit stop</span>':"")+'</div>':(pitLaps.length>0?'<div style="display:flex;align-items:center;gap:14px;justify-content:center;margin-top:8px;font-size:10px;color:var(--text2)"><span style="display:inline-flex;align-items:center;gap:5px"><span style="width:6px;height:6px;background:#FBBF24;border-radius:50%"></span>Pit stop</span></div>':"");var bestSecs=p&&p.bestSectors?p.bestSectors:[];var bestSecsHtml="";if(bestSecs.length>0){bestSecsHtml='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:6px">';bestSecs.forEach(function(s,i){var t=s!=null?s.toFixed(2)+"s":"—";bestSecsHtml+='<div style="text-align:center;padding:7px 4px;background:var(--surface2);border:1px solid var(--border);border-radius:6px"><div style="font-family:var(--font-display);font-size:8px;color:var(--text3);letter-spacing:.1em">S'+(i+1)+'</div><div style="font-family:var(--font-display);font-size:11px;color:var(--text);font-weight:800;margin-top:2px">'+t+'</div></div>'});bestSecsHtml+='</div>'}var advancedStatsHtml='<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px">'+'<div style="padding:9px 10px;background:rgba(52,211,153,0.06);border:1px solid rgba(52,211,153,0.20);border-radius:8px;text-align:center"><div style="font-family:var(--font-display);font-size:8.5px;color:#34D399;letter-spacing:.14em">DÉPASS. ↑</div><div style="font-family:var(--font-display);font-size:15px;font-weight:800;color:#34D399;margin-top:2px">+'+overtakesMade+'</div></div>'+'<div style="padding:9px 10px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.20);border-radius:8px;text-align:center"><div style="font-family:var(--font-display);font-size:8.5px;color:#EF4444;letter-spacing:.14em">PERDUES ↓</div><div style="font-family:var(--font-display);font-size:15px;font-weight:800;color:#EF4444;margin-top:2px">−'+overtakesLost+'</div></div>'+(timeInP1>0?'<div style="padding:9px 10px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.20);border-radius:8px;text-align:center;grid-column:span 2"><div style="font-family:var(--font-display);font-size:8.5px;color:#F59E0B;letter-spacing:.14em">TEMPS EN TÊTE</div><div style="font-family:var(--font-display);font-size:15px;font-weight:800;color:#F59E0B;margin-top:2px">'+timeInP1+' tour'+(timeInP1>1?"s":"")+'</div></div>':"")+(pitLaps.length>0?'<div style="padding:9px 10px;background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.20);border-radius:8px;text-align:center;grid-column:span 2"><div style="font-family:var(--font-display);font-size:8.5px;color:#FBBF24;letter-spacing:.14em">PIT STOPS</div><div style="font-family:var(--font-display);font-size:13px;font-weight:800;color:#FBBF24;margin-top:2px">'+pitLaps.length+' arrêt'+(pitLaps.length>1?"s":"")+' (T'+pitLaps.join(", T")+')</div></div>':"")+'</div>';var keyEvents="";try{var log=(typeof RACE_STATE!=="undefined"&&RACE_STATE.eventsLog)||[];var keyL=log.filter(function(e){return e.text&&!e.text.includes("Tour ")}).slice(-4);if(keyL.length>0){keyEvents='<div style="margin-top:10px"><div style="font-family:var(--font-display);font-size:9px;color:var(--text3);letter-spacing:.18em;text-transform:uppercase;margin-bottom:6px">Moments-clés</div>';keyL.forEach(function(e){keyEvents+='<div style="display:flex;align-items:center;gap:8px;padding:6px 9px;background:var(--surface2);border-left:2px solid '+(e.color||"#9CA3AF")+';border-radius:0 6px 6px 0;margin-bottom:4px"><span style="font-family:var(--font-display);font-size:9px;color:var(--text3);min-width:54px">'+(e.lap?("Tour "+e.lap):(e.phase&&String(e.phase).indexOf("Tour ")===0?e.phase:"Course"))+'</span><span style="font-size:11.5px;color:var(--text2);flex:1">'+e.text+'</span></div>'});keyEvents+='</div>'}}catch(e){}var pCol=p&&!p.dnf?(p.pos===1?"#F59E0B":p.pos<=3?"#FBBF24":p.pos<=10?"#34D399":"#9CA3AF"):"#EF4444";var card=document.createElement("div");card.id="rj-recap-card";card.style.cssText="max-width:380px;width:100%;background:linear-gradient(180deg,var(--bg3) 0%,var(--bg2) 100%);border:1px solid var(--border-hi);border-radius:18px;padding:18px;box-shadow:0 16px 48px rgba(0,0,0,0.7);max-height:90vh;overflow-y:auto;animation:apex-modal-slide-in .3s cubic-bezier(.2,.7,.3,1)";card.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px"><div><div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--red3);letter-spacing:.18em;text-transform:uppercase">Récap week-end</div><div style="font-family:var(--font-display);font-size:18px;font-weight:900;color:var(--text);margin-top:2px;line-height:1.1">'+(G.cat||"Course")+'</div></div><div style="display:flex;gap:6px"><button onclick="exportRecapAsImage(event)" title="Partager / Exporter" style="background:rgba(34,211,238,0.12);border:1px solid rgba(34,211,238,0.30);color:#22D3EE;font-size:14px;cursor:pointer;width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg></button><button onclick="closeWeekendRecap()" style="background:none;border:none;color:var(--text3);font-size:24px;cursor:pointer;padding:0;width:32px;height:32px">×</button></div></div>'+'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:12px"><div style="padding:9px 6px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;text-align:center"><div style="font-family:var(--font-display);font-size:9px;color:var(--text3);letter-spacing:.12em">QUALI</div><div style="font-family:var(--font-display);font-size:18px;font-weight:900;color:var(--text);margin-top:2px">P'+quali+'</div></div><div style="padding:9px 6px;background:var(--surface2);border:1px solid '+pCol+'40;border-radius:8px;text-align:center"><div style="font-family:var(--font-display);font-size:9px;color:'+pCol+';letter-spacing:.12em">FINAL</div><div style="font-family:var(--font-display);font-size:18px;font-weight:900;color:'+pCol+';margin-top:2px">'+(typeof finalPos==="number"?"P"+finalPos:finalPos)+'</div></div><div style="padding:9px 6px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;text-align:center"><div style="font-family:var(--font-display);font-size:9px;color:var(--text3);letter-spacing:.12em">DELTA</div><div style="font-family:var(--font-display);font-size:18px;font-weight:900;color:'+deltaColor+';margin-top:2px">'+deltaStr+'</div></div></div>'+'<div style="font-family:var(--font-display);font-size:9px;font-weight:700;color:var(--text3);letter-spacing:.18em;text-transform:uppercase;margin-bottom:6px">Évolution position par tour</div>'+svg+'<div style="display:flex;justify-content:space-between;font-size:9px;color:var(--text3);margin-top:6px;font-family:monospace"><span>Tour 1</span><span>Tour '+totalLaps+'</span></div>'+legendHtml+(bestPos!==null?'<div style="display:flex;gap:10px;margin-top:10px"><div style="flex:1;padding:8px;background:rgba(52,211,153,0.08);border:1px solid rgba(52,211,153,0.25);border-radius:8px;text-align:center"><div style="font-family:var(--font-display);font-size:9px;color:#34D399;letter-spacing:.12em">MEILLEURE</div><div style="font-family:var(--font-display);font-size:14px;font-weight:800;color:#34D399;margin-top:2px">P'+bestPos+'</div></div><div style="flex:1;padding:8px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.20);border-radius:8px;text-align:center"><div style="font-family:var(--font-display);font-size:9px;color:#EF4444;letter-spacing:.12em">PIRE</div><div style="font-family:var(--font-display);font-size:14px;font-weight:800;color:#EF4444;margin-top:2px">P'+worstPos+'</div></div></div>':"")+advancedStatsHtml+(bestSecsHtml?'<div style="margin-top:12px"><div style="font-family:var(--font-display);font-size:9px;color:var(--text3);letter-spacing:.18em;text-transform:uppercase;margin-bottom:4px">Meilleurs secteurs</div>'+bestSecsHtml+'</div>':"")+keyEvents+'<button onclick="closeWeekendRecap()" style="display:block;width:100%;margin-top:14px;padding:12px;background:var(--red2);border:none;border-radius:10px;color:#fff;font-family:var(--font-display);font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;cursor:pointer">Fermer</button>';ov.appendChild(card);ov.addEventListener("click",function(e){if(e.target===ov)closeWeekendRecap()});document.body.appendChild(ov)}catch(e){console.warn("showWeekendRecap:",e);if(typeof showAlertDialog==="function")showAlertDialog({title:"Erreur",message:"Impossible d'afficher le récap: "+(e.message||"")})}}
function exportRecapAsImage(ev){var btn=ev&&ev.currentTarget||(typeof event!=="undefined"&&event&&event.currentTarget)||null;var origHtml=btn?btn.innerHTML:null;function setBtnLoading(){if(!btn)return;btn.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation:rj-spin 1s linear infinite"><circle cx="12" cy="12" r="9" opacity="0.25"/><path d="M21 12a9 9 0 0 0-9-9"/></svg>';btn.style.borderColor="rgba(34,211,238,0.45)";if(!document.getElementById("rj-spin-style")){var st=document.createElement("style");st.id="rj-spin-style";st.textContent="@keyframes rj-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}";document.head.appendChild(st)}}
function setBtnSuccess(){if(!btn)return;btn.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#34D399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';btn.style.borderColor="rgba(52,211,153,0.4)";setTimeout(function(){if(btn){btn.innerHTML=origHtml;btn.style.borderColor="rgba(34,211,238,0.30)"}},1800)}
function setBtnError(){if(!btn)return;btn.innerHTML='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';btn.style.borderColor="rgba(239,68,68,0.4)";setTimeout(function(){if(btn){btn.innerHTML=origHtml;btn.style.borderColor="rgba(34,211,238,0.30)"}},1800)}
try{
var card=document.getElementById("rj-recap-card");if(!card){if(typeof showToast==="function")showToast("Récap introuvable");return}
var hist=(typeof LIVE_RACE!=="undefined"&&LIVE_RACE&&LIVE_RACE._lapHistory)||[];if(hist.length<2){if(typeof showToast==="function")showToast("Pas assez de données");return}
setBtnLoading();
var p=LIVE_RACE.drivers.find(function(d){return d.isPlayer});
var totalDrivers=hist[0]?hist[0].total:20;
var quali=p?(p.gridPos||totalDrivers):totalDrivers;
var finalPos=p&&!p.dnf?(p.pos||totalDrivers):"DNF";
var deltaQR=p&&!p.dnf?(quali-(p.pos||totalDrivers)):null;
var deltaStr=deltaQR===null?"DNF":(deltaQR>0?"+"+deltaQR:deltaQR===0?"=":""+deltaQR);
var deltaColor=deltaQR===null?"#EF4444":(deltaQR>0?"#34D399":(deltaQR<0?"#EF4444":"#9CA3AF"));
var bestPos=null,worstPos=null,timeInP1=0,overtakesMade=0,overtakesLost=0;
hist.forEach(function(h){if(h.pos!=null){if(bestPos===null||h.pos<bestPos)bestPos=h.pos;if(worstPos===null||h.pos>worstPos)worstPos=h.pos;if(h.pos===1)timeInP1++;if(h.posChange){if(h.posChange>0)overtakesMade+=h.posChange;else overtakesLost+=Math.abs(h.posChange)}}});
var hasTeammate=hist.some(function(h){return h.tmPos!=null});
var pitLaps=hist.filter(function(h){return h.pit==="player"}).map(function(h){return h.lap});
var totalLaps=Math.max.apply(null,hist.map(function(h){return h.lap}));
var pCol=p&&!p.dnf?(p.pos===1?"#F59E0B":p.pos<=3?"#FBBF24":p.pos<=10?"#34D399":"#9CA3AF"):"#EF4444";
var bestSecs=p&&p.bestSectors?p.bestSectors:[];
var weather=(typeof RACE_STATE!=="undefined"&&RACE_STATE&&RACE_STATE.weather)||null;
var bestLap=LIVE_RACE.bestLap||null;
function fmtLapTime(t){if(t==null||isNaN(t))return "—";if(t>=60){var m=Math.floor(t/60);var r=t-60*m;return m+":"+(r<10?"0":"")+r.toFixed(3)}return t.toFixed(3)}
var currentRace=null;try{if(typeof CAL_RACES!=="undefined"&&CAL_RACES&&CAL_RACES.length){for(var i=CAL_RACES.length-1;i>=0;i--){if(CAL_RACES[i]&&CAL_RACES[i].done){currentRace=CAL_RACES[i];break}}if(!currentRace)currentRace=CAL_RACES[0]}}catch(e){}
var raceName=currentRace?(currentRace.name||currentRace.gp||currentRace.circuit||""):"";
var raceCountry=currentRace?(currentRace.country||currentRace.pays||""):"";
var manche=currentRace?(currentRace.manche||currentRace.round||currentRace.num||""):"";
var saison=(typeof G!=="undefined"&&G.saison)||1;
var pilotPrenom=(typeof G!=="undefined"&&G.pilot&&G.pilot.prenom)||"";
var pilotNom=(typeof G!=="undefined"&&G.pilot&&G.pilot.nom)||"";
var pilotNum=(typeof G!=="undefined"&&G.pilot&&G.pilot.number)||"";
var pilotNat=(typeof G!=="undefined"&&G.pilot&&G.pilot.nat)||"";
var teamName=(typeof G!=="undefined"&&G.currentTeam)||"";
var category=(typeof G!=="undefined"&&G.cat)||"Course";
var keyEvts=[];try{var log=(typeof RACE_STATE!=="undefined"&&RACE_STATE.eventsLog)||[];keyEvts=log.filter(function(e){return e.text&&!e.text.includes("Tour ")}).slice(-3)}catch(e){}
var W=1080,H=1350;
var canvas=document.createElement("canvas");canvas.width=W;canvas.height=H;
var ctx=canvas.getContext("2d");
var grad=ctx.createLinearGradient(0,0,0,H);grad.addColorStop(0,"#15151C");grad.addColorStop(0.5,"#0F0F14");grad.addColorStop(1,"#08080C");ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
var rg=ctx.createRadialGradient(W/2,180,50,W/2,180,800);rg.addColorStop(0,"rgba(255,24,1,0.18)");rg.addColorStop(0.4,"rgba(220,42,60,0.06)");rg.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=rg;ctx.fillRect(0,0,W,H);
ctx.strokeStyle="rgba(255,255,255,0.04)";ctx.lineWidth=1;
for(var gx=0;gx<W;gx+=60){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,H);ctx.stroke()}
for(var gy=0;gy<H;gy+=60){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(W,gy);ctx.stroke()}
function roundRect(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath()}
function fillRoundRect(c,x,y,w,h,r,fill){roundRect(c,x,y,w,h,r);c.fillStyle=fill;c.fill()}
function strokeRoundRect(c,x,y,w,h,r,stroke,lw){roundRect(c,x,y,w,h,r);c.strokeStyle=stroke;c.lineWidth=lw||1;c.stroke()}
function drawText(t,x,y,size,col,weight,align,family){ctx.font=(weight||"700")+" "+size+"px "+(family||"system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif");ctx.fillStyle=col;ctx.textAlign=align||"left";ctx.textBaseline="alphabetic";ctx.fillText(t,x,y)}
function truncate(t,maxW,size,weight,family){ctx.font=(weight||"700")+" "+size+"px "+(family||"system-ui, sans-serif");if(ctx.measureText(t).width<=maxW)return t;var s=t;while(s.length>1&&ctx.measureText(s+"…").width>maxW)s=s.slice(0,-1);return s+"…"}
ctx.fillStyle="#FF1801";ctx.fillRect(0,0,W,6);
var headerY=70;
var logoImg=document.querySelector(".apex-splash-logo");
function loadFlagImage(natCode,cb){if(!natCode||typeof flagSvg!=="function"){cb(null);return}try{var svgHtml=flagSvg(natCode,80);if(!svgHtml){cb(null);return}var match=svgHtml.match(/<svg[\s\S]*?<\/svg>/);if(!match){cb(null);return}var rawSvg=match[0].replace(/width="[^"]*"/,'width="80"').replace(/height="[^"]*"/,'height="80"');if(rawSvg.indexOf("xmlns=")===-1)rawSvg=rawSvg.replace("<svg","<svg xmlns=\"http://www.w3.org/2000/svg\"");var b64=btoa(unescape(encodeURIComponent(rawSvg)));var img=new Image();img.onload=function(){cb(img)};img.onerror=function(){cb(null)};img.src="data:image/svg+xml;base64,"+b64}catch(e){cb(null)}}
function continueRender(flagImg){
var rightX=W-60;
ctx.fillStyle="rgba(255,255,255,0.5)";ctx.font="700 18px system-ui, sans-serif";ctx.textAlign="right";ctx.fillText("RACING JOURNEY · F1 DREAMS",rightX,headerY-22);
ctx.fillStyle="#FF1801";ctx.font="900 28px system-ui, sans-serif";ctx.fillText("RÉCAP COURSE",rightX,headerY+12);
ctx.textAlign="left";
var blockY=180;
fillRoundRect(ctx,60,blockY,W-120,100,14,"rgba(255,255,255,0.03)");
strokeRoundRect(ctx,60,blockY,W-120,100,14,"rgba(255,255,255,0.08)",1);
drawText((category||"COURSE").toUpperCase(),85,blockY+38,18,"#FF1801","800","left");
var raceTitle=raceName||"Grand Prix";
if(raceCountry&&raceTitle.toLowerCase().indexOf(raceCountry.toLowerCase())===-1)raceTitle=raceTitle+" · "+raceCountry;
raceTitle=truncate(raceTitle,W-170,32,"900");
drawText(raceTitle,85,blockY+74,32,"#FFFFFF","900","left");
var subParts=[];if(saison)subParts.push("Saison "+saison);if(manche)subParts.push("Manche "+manche);if(weather&&weather.label)subParts.push(weather.label);
drawText(subParts.join(" · "),W-85,blockY+74,16,"rgba(255,255,255,0.55)","600","right");
var pilotY=320;
fillRoundRect(ctx,60,pilotY,W-120,140,14,"rgba(255,24,1,0.06)");
strokeRoundRect(ctx,60,pilotY,W-120,140,14,"rgba(255,24,1,0.25)",1);
if(pilotNum){var nbW=110;fillRoundRect(ctx,85,pilotY+25,nbW,90,12,"#FF1801");drawText("#"+pilotNum,85+nbW/2,pilotY+90,52,"#FFFFFF","900","center")}
var nameX=pilotNum?225:85;
drawText((pilotPrenom||"").toUpperCase(),nameX,pilotY+58,22,"rgba(255,255,255,0.65)","600","left");
var flagW=0;
if(flagImg){var fSize=44;var fY=pilotY+72;ctx.save();ctx.beginPath();ctx.arc(nameX+fSize/2,fY+fSize/2,fSize/2,0,Math.PI*2);ctx.closePath();ctx.clip();ctx.drawImage(flagImg,nameX,fY,fSize,fSize);ctx.restore();ctx.beginPath();ctx.arc(nameX+fSize/2,fY+fSize/2,fSize/2,0,Math.PI*2);ctx.strokeStyle="rgba(255,255,255,0.25)";ctx.lineWidth=2;ctx.stroke();flagW=fSize+14}
var lastName=truncate((pilotNom||"").toUpperCase(),W-nameX-90-flagW,42,"900");
drawText(lastName,nameX+flagW,pilotY+102,42,"#FFFFFF","900","left");
if(teamName){var tn=truncate(teamName,W-nameX-90,16,"700");drawText(tn,nameX,pilotY+128,16,"#22D3EE","700","left")}
var resY=500;
var qX=85,fX=400,dX=720,bW=275,bH=210;
fillRoundRect(ctx,qX,resY,bW,bH,16,"rgba(255,255,255,0.04)");
strokeRoundRect(ctx,qX,resY,bW,bH,16,"rgba(255,255,255,0.10)",1);
drawText("QUALIFICATIONS",qX+bW/2,resY+38,15,"rgba(255,255,255,0.5)","700","center");
drawText("P"+quali,qX+bW/2,resY+135,82,"#FFFFFF","900","center");
drawText("DÉPART",qX+bW/2,resY+175,14,"rgba(255,255,255,0.4)","600","center");
fillRoundRect(ctx,fX,resY,bW,bH,16,pCol+"15");
strokeRoundRect(ctx,fX,resY,bW,bH,16,pCol+"66",2);
drawText("ARRIVÉE",fX+bW/2,resY+38,15,pCol,"800","center");
var finalDisplay=typeof finalPos==="number"?"P"+finalPos:finalPos;
drawText(finalDisplay,fX+bW/2,resY+135,82,pCol,"900","center");
drawText("RÉSULTAT",fX+bW/2,resY+175,14,"rgba(255,255,255,0.4)","600","center");
fillRoundRect(ctx,dX,resY,bW,bH,16,deltaColor+"12");
strokeRoundRect(ctx,dX,resY,bW,bH,16,deltaColor+"55",1);
drawText("DELTA",dX+bW/2,resY+38,15,deltaColor,"800","center");
drawText(deltaStr,dX+bW/2,resY+135,72,deltaColor,"900","center");
drawText("ÉVOLUTION",dX+bW/2,resY+175,14,"rgba(255,255,255,0.4)","600","center");
var graphY=740,graphX=85,graphW=W-170,graphH=200;
fillRoundRect(ctx,graphX,graphY,graphW,graphH,14,"rgba(0,0,0,0.4)");
strokeRoundRect(ctx,graphX,graphY,graphW,graphH,14,"rgba(255,255,255,0.08)",1);
drawText("ÉVOLUTION POSITION PAR TOUR",graphX+20,graphY-12,14,"rgba(255,255,255,0.5)","700","left");
var gPadL=50,gPadR=20,gPadT=20,gPadB=30;
var maxPosG=Math.max(totalDrivers,worstPos||1);
var xStepG=(graphW-gPadL-gPadR)/Math.max(1,totalLaps-1);
var yScaleG=(graphH-gPadT-gPadB)/Math.max(1,maxPosG-1);
ctx.strokeStyle="rgba(255,255,255,0.08)";ctx.lineWidth=1;ctx.font="600 11px monospace";ctx.fillStyle="rgba(255,255,255,0.4)";ctx.textAlign="right";
for(var gli=0;gli<=4;gli++){var posVal=1+Math.round((maxPosG-1)*gli/4);var yV=graphY+gPadT+(posVal-1)*yScaleG;ctx.beginPath();ctx.moveTo(graphX+gPadL,yV);ctx.lineTo(graphX+graphW-gPadR,yV);ctx.stroke();ctx.fillText("P"+posVal,graphX+gPadL-6,yV+4)}
ctx.textAlign="left";
pitLaps.forEach(function(pl){var pX=graphX+gPadL+(pl-1)*xStepG;ctx.strokeStyle="rgba(251,191,36,0.5)";ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(pX,graphY+gPadT);ctx.lineTo(pX,graphY+graphH-gPadB);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle="#FBBF24";ctx.beginPath();ctx.arc(pX,graphY+graphH-gPadB-3,5,0,Math.PI*2);ctx.fill()});
if(hasTeammate){var tmPts=hist.filter(function(h){return h.tmPos!=null}).map(function(h){return{x:graphX+gPadL+(h.lap-1)*xStepG,y:graphY+gPadT+(h.tmPos-1)*yScaleG}});if(tmPts.length>1){ctx.strokeStyle="#22D3EE";ctx.lineWidth=2.5;ctx.setLineDash([6,4]);ctx.globalAlpha=0.7;ctx.beginPath();tmPts.forEach(function(pt,idx){if(idx===0)ctx.moveTo(pt.x,pt.y);else ctx.lineTo(pt.x,pt.y)});ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1}}
var ptsG=hist.filter(function(h){return h.pos!=null}).map(function(h){return{x:graphX+gPadL+(h.lap-1)*xStepG,y:graphY+gPadT+(h.pos-1)*yScaleG}});
if(ptsG.length>1){ctx.strokeStyle="#FF1801";ctx.lineWidth=3.5;ctx.lineCap="round";ctx.lineJoin="round";ctx.shadowColor="rgba(255,24,1,0.5)";ctx.shadowBlur=10;ctx.beginPath();ptsG.forEach(function(pt,idx){if(idx===0)ctx.moveTo(pt.x,pt.y);else ctx.lineTo(pt.x,pt.y)});ctx.stroke();ctx.shadowBlur=0;
var lastPt=ptsG[ptsG.length-1];ctx.fillStyle="#FF1801";ctx.beginPath();ctx.arc(lastPt.x,lastPt.y,8,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#FFFFFF";ctx.lineWidth=2.5;ctx.stroke();
ctx.fillStyle="rgba(255,255,255,0.7)";ctx.beginPath();ctx.arc(ptsG[0].x,ptsG[0].y,5,0,Math.PI*2);ctx.fill()}
ctx.fillStyle="rgba(255,255,255,0.45)";ctx.font="600 11px monospace";ctx.textAlign="left";ctx.fillText("Tour 1",graphX+gPadL,graphY+graphH-8);ctx.textAlign="right";ctx.fillText("Tour "+totalLaps,graphX+graphW-gPadR,graphY+graphH-8);ctx.textAlign="left";
var statsY=990;
var sBoxW=(W-120-30)/4,sBoxH=110;
function statBox(idx,label,value,color){var sx=60+idx*(sBoxW+10);fillRoundRect(ctx,sx,statsY,sBoxW,sBoxH,12,color+"12");strokeRoundRect(ctx,sx,statsY,sBoxW,sBoxH,12,color+"40",1);drawText(label,sx+sBoxW/2,statsY+30,12,color,"800","center");
var fontSize=value.length>=8?22:value.length>=6?28:38;
drawText(value,sx+sBoxW/2,statsY+82,fontSize,color,"900","center")}
statBox(0,"DÉPASS. ↑","+"+overtakesMade,"#34D399");
statBox(1,"PERDUES ↓","−"+overtakesLost,"#EF4444");
var bestLapStr=bestLap?fmtLapTime(bestLap.time):"—";
statBox(2,"MEILLEUR TOUR",bestLapStr,"#22D3EE");
statBox(3,"PIT STOPS",String(pitLaps.length),"#FBBF24");
var hasSecs=bestSecs&&bestSecs.some(function(s){return s!=null});
var bottomBlockY=1120;
if(hasSecs){drawText("MEILLEURS SECTEURS",60,bottomBlockY-10,14,"rgba(255,255,255,0.5)","700","left");var secBoxW=(W-120-20)/3,secBoxH=80;for(var si=0;si<3;si++){var sxx=60+si*(secBoxW+10);var st=bestSecs[si]!=null?bestSecs[si].toFixed(2)+"s":"—";fillRoundRect(ctx,sxx,bottomBlockY,secBoxW,secBoxH,10,"rgba(255,255,255,0.04)");strokeRoundRect(ctx,sxx,bottomBlockY,secBoxW,secBoxH,10,"rgba(255,255,255,0.10)",1);drawText("S"+(si+1),sxx+secBoxW/2,bottomBlockY+26,13,"rgba(255,255,255,0.5)","700","center");drawText(st,sxx+secBoxW/2,bottomBlockY+62,26,"#FFFFFF","900","center")}bottomBlockY+=100}
if(keyEvts.length>0&&bottomBlockY<H-180){drawText("MOMENTS-CLÉS",60,bottomBlockY-10,14,"rgba(255,255,255,0.5)","700","left");var evtH=34;keyEvts.forEach(function(evt,idx){var ey=bottomBlockY+idx*(evtH+5);if(ey+evtH>H-110)return;var col=evt.color||"#9CA3AF";fillRoundRect(ctx,60,ey,W-120,evtH,8,"rgba(255,255,255,0.03)");ctx.fillStyle=col;ctx.fillRect(60,ey,3,evtH);var lapTxt=evt.lap?"T"+evt.lap:"·";drawText(lapTxt,80,ey+22,12,"rgba(255,255,255,0.5)","700","left");var txt=truncate(evt.text||"",W-180,14,"600");drawText(txt,130,ey+22,14,"rgba(255,255,255,0.85)","600","left")})}
var footY=H-80;
ctx.fillStyle="rgba(255,255,255,0.04)";ctx.fillRect(0,footY-20,W,1);
drawText("RACING JOURNEY: F1 DREAMS",60,footY+10,18,"#FF1801","900","left");
drawText("PAR SPECIMEN · BETA 1.6",60,footY+34,13,"rgba(255,255,255,0.4)","600","left");
drawText("#RacingJourney",W-60,footY+10,16,"rgba(255,255,255,0.5)","700","right");
drawText("#F1Dreams",W-60,footY+34,13,"rgba(255,255,255,0.35)","600","right");
canvas.toBlob(function(blob){
if(!blob){setBtnError();if(typeof showToast==="function")showToast("Erreur de génération");return}
var fileName="racing-journey-S"+saison+(manche?"-M"+manche:"")+".png";
var file=null;try{file=new File([blob],fileName,{type:"image/png"})}catch(e){}
var shareText=" "+(typeof finalPos==="number"?"P"+finalPos:finalPos)+" "+(raceName||"Grand Prix")+" · Saison "+saison+" — Racing Journey: F1 Dreams";
try{if(typeof LIVE_RACE!=="undefined"&&LIVE_RACE){LIVE_RACE._lastShareImage={blob:blob,fileName:fileName,timestamp:Date.now()}}}catch(e){}
if(file&&navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
navigator.share({files:[file],title:"Mon récap course",text:shareText}).then(function(){setBtnSuccess();if(typeof showToast==="function")showToast(" Partagé !")}).catch(function(err){if(err&&err.name==="AbortError"){if(btn){btn.innerHTML=origHtml;btn.style.borderColor="rgba(34,211,238,0.30)"}return}downloadFallback()})
}else{downloadFallback()}
function downloadFallback(){try{var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download=fileName;document.body.appendChild(a);a.click();setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(url)},100);setBtnSuccess();if(typeof showToast==="function")showToast(" Image téléchargée !")}catch(e){console.warn("download fail:",e);setBtnError();if(typeof showToast==="function")showToast("Erreur de téléchargement")}}
},"image/png",0.95)
}
loadFlagImage(pilotNat,function(flagImg){
if(logoImg&&logoImg.complete&&logoImg.naturalWidth>0){
var lh=80;var ratio=logoImg.naturalWidth/logoImg.naturalHeight;var lw=Math.min(420,lh*ratio);
ctx.drawImage(logoImg,60,headerY-50,lw,lh);
continueRender(flagImg)
}else if(logoImg){
var imgClone=new Image();imgClone.crossOrigin="anonymous";imgClone.onload=function(){var lh=80;var ratio=imgClone.naturalWidth/imgClone.naturalHeight;var lw=Math.min(420,lh*ratio);ctx.drawImage(imgClone,60,headerY-50,lw,lh);continueRender(flagImg)};imgClone.onerror=function(){drawText("RACING JOURNEY",60,headerY+8,42,"#FF1801","900","left");drawText("F1 DREAMS",60,headerY+38,22,"rgba(255,255,255,0.7)","700","left");continueRender(flagImg)};imgClone.src=logoImg.src
}else{
drawText("RACING JOURNEY",60,headerY+8,42,"#FF1801","900","left");drawText("F1 DREAMS",60,headerY+38,22,"rgba(255,255,255,0.7)","700","left");continueRender(flagImg)
}
})
}catch(e){console.warn("exportRecapAsImage:",e);setBtnError();if(typeof showToast==="function")showToast("Erreur : "+(e.message||"export impossible"))}}
function closeWeekendRecap(){var ov=document.getElementById("rj-recap-overlay");if(ov)ov.remove()}
/* SPRINT — Écran de résultat dédié à la course sprint.
   Affiche un mini-récap (position, points sprint), pousse l'event social,
   marque sprintDone=true, et propose un bouton "Course principale →" qui relance le moteur. */
function _showSprintResult(){
 var n=LIVE_RACE_FINAL_POS>0?LIVE_RACE_FINAL_POS:G.rivals.length>0?Math.ceil(G.rivals.length/2):1;
 var pts=_getSprintPtsTable()[n-1]||0;
 // Allouer les points (séparés des points de course longue dans G.champPts mais on les ajoute quand même au championnat)
 G.champPts+=pts;
 G._sprintPts=(G._sprintPts||0)+pts;
 // Marquer comme fait
 if(typeof RACE_WEEKEND_STATE!=="undefined"){
  RACE_WEEKEND_STATE.sprintDone=true;
  // IMPORTANT : on remet courseDone à false car la course principale n'a pas eu lieu
  RACE_WEEKEND_STATE.courseDone=false;
 }
 // Push social/feed
 if(typeof _addFeedPost==="function"){
  var pName=(G.pilot.prenom?G.pilot.prenom+" ":"")+(G.pilot.nom||"");
  var team=G.currentTeam||"";
  var circuit=(RACE_STATE&&RACE_STATE.circuitData&&RACE_STATE.circuitData.name)||(RACE_STATE&&RACE_STATE.circuit)||"";
  if(n===1&&team&&team!=="Indépendant"){
   var handle="@"+team.toLowerCase().replace(/\s+/g,"").replace(/[^a-z0-9]/g,"").substr(0,14);
   _addFeedPost({type:"team",author:team,handle:handle,color:"#F59E0B",body:" VICTOIRE EN SPRINT ! "+pName+" s'impose dans la course sprint à "+circuit+". On remet ça demain pour la course principale !"});
  }else if(n<=3&&team&&team!=="Indépendant"){
   var handle2="@"+team.toLowerCase().replace(/\s+/g,"").replace(/[^a-z0-9]/g,"");
   _addFeedPost({type:"team",author:team,handle:handle2,color:"#34D399",body:"Podium en sprint pour "+pName+" (P"+n+") à "+circuit+". On garde ce rythme pour la course principale demain."});
  }
 }
 // Reset le LIVE_RACE pour la course principale (mais on garde la grille basée sur la quali)
 var sprintFinal=n;
 // Render screen simple
 try{if(typeof _hideRaceEventModal==="function")_hideRaceEventModal();}catch(_e){}
 (function(){var btn=document.getElementById("pit-button-container");if(btn)btn.remove()})();
 // Affichage
 var i=document.getElementById("res-content");
 if(i){
  i.innerHTML="";
  var l={1:"#d4a842",2:"#9098b0",3:"#c07840"}[n]||"var(--text)";
  var c={1:"rgba(212,168,66,.25)",2:"rgba(144,152,176,.15)",3:"rgba(192,120,64,.2)"}[n]||"transparent";
  var d=document.createElement("div");
  d.style.cssText="margin:10px 14px 10px;padding:16px;background:linear-gradient(160deg,var(--bg2) 0%,var(--bg) 100%);border:1px solid var(--border-hi);border-top:3px solid "+l+";position:relative;overflow:hidden;border-radius:var(--r)";
  var resText=n===1?"VICTOIRE en sprint !":n<=3?"Podium en sprint":"Sprint terminée";
  d.innerHTML='<div style="position:absolute;top:-10px;right:-10px;width:80px;height:80px;background:radial-gradient(circle,'+c+' 0%,transparent 70%);pointer-events:none"></div>'+
   '<div style="font-family:var(--font-display);font-size:11px;font-weight:800;color:#F59E0B;letter-spacing:.18em;text-transform:uppercase;margin-bottom:6px">'+renderIcon('zap',14,'#F59E0B')+' Course Sprint</div>'+
   '<div style="font-family:var(--font-display);font-size:52px;font-weight:900;color:'+l+';line-height:1;letter-spacing:-.02em">P'+n+'</div>'+
   '<div style="font-size:14px;color:var(--text);margin-top:6px;font-weight:600">'+resText+'</div>'+
   '<div style="font-size:12px;color:var(--text2);margin-top:4px">'+(pts>0?"+"+pts+" pts au championnat":"Pas de points marqués")+'</div>'+
   '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">'+
   (n===1?'<span class="badge b-gold">Victoire sprint</span>':"")+
   (n<=3?'<span class="badge b-teal">Podium</span>':"")+
   (pts>0?'<span class="badge b-blue">+'+pts+" pts</span>":"")+
   '</div>';
  i.appendChild(d);
  // Classement final sprint
  var v=document.createElement("div");
  v.style.cssText="margin:0 14px 10px;border:1px solid var(--border-hi);border-radius:var(--r3);overflow:hidden;background:var(--bg3)";
  var x=document.createElement("div");
  x.style.cssText="padding:10px 14px;border-bottom:1px solid var(--border);font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.07em";
  x.textContent="Classement sprint";
  v.appendChild(x);
  var sortedDrivers=LIVE_RACE.drivers.slice().sort(function(e,t){return e.pos-t.pos});
  sortedDrivers.forEach(function(e){
   var t=document.createElement("div");
   var posColor=({1:"#d4a842",2:"#9098b0",3:"#c07840"})[e.pos]||(e.isPlayer?"var(--text)":"var(--text2)");
   var sprintPts=SPRINT_PTS_TABLE[(e.pos||99)-1]||0;
   t.style.cssText="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--line);"+(e.isPlayer?"background:rgba(232,16,48,.06);":"");
   t.innerHTML='<span style="font-size:15px;font-weight:700;width:24px;color:'+posColor+'">'+e.pos+'</span>'+
    '<span style="flex:1;font-size:13px;'+(e.isPlayer?"font-weight:700;color:var(--text)":"color:var(--text2)")+'">'+(e.isPlayer?"▶ ":"")+e.name+(e.dnf?' <span style="font-size:10px;color:#EF4444">DNF</span>':"")+'</span>'+
    '<span style="font-size:12px;font-weight:600;'+(sprintPts>0?"color:var(--teal,#34D399)":"color:var(--text3)")+'">'+(sprintPts>0?"+"+sprintPts+" pts":"—")+'</span>';
   v.appendChild(t);
  });
  i.appendChild(v);
  // Bouton course principale
  var mainBtn=document.createElement("button");
  mainBtn.className="btn btn-prim";
  mainBtn.style.cssText="margin-bottom:8px;background:#C8102E";
  mainBtn.textContent=" Course principale →";
  mainBtn.onclick=function(){
   // Nettoyer LIVE_RACE pour relancer
   if(LIVE_RACE.interval){clearInterval(LIVE_RACE.interval);LIVE_RACE.interval=null}
   LIVE_RACE.finished=false;
   LIVE_RACE._isSprintMode=false;
   LIVE_RACE.cur=0;
   LIVE_RACE.drivers=[];
   LIVE_RACE.eventsSchedule=[];
   LIVE_RACE.resolvedEvents=[];
   LIVE_RACE.newsFeed=[];
   LIVE_RACE.bestLap=null;
   LIVE_RACE._lapHistory=[];
   LIVE_RACE._weatherChanged=false;
   LIVE_RACE._pendingWeatherChange=null;
   LIVE_RACE._nightAnnounced=false;
   LIVE_RACE._dawnAnnounced=false;
   delete LIVE_RACE._relayDone_0;delete LIVE_RACE._relayDone_1;delete LIVE_RACE._relayDone_2;
   LIVE_RACE_FINAL_POS=0;
   // Repasser sur l'écran de course
   if(typeof rtab==="function")rtab("course",true);
   // Relancer la course
   if(typeof runRaceLive==="function")setTimeout(runRaceLive,200);
  };
  i.appendChild(mainBtn);
  // Bouton récap visuel si dispo
  (function(){
   var lapHist=(LIVE_RACE&&LIVE_RACE._lapHistory)||[];
   if(lapHist.length>=2&&typeof showWeekendRecap==="function"){
    var btn=document.createElement("button");
    btn.className="btn btn-sec";
    btn.style.marginBottom="8px";
    btn.textContent="Voir le récap visuel";
    btn.onclick=function(){showWeekendRecap()};
    i.appendChild(btn);
   }
  })();
 }
 // Switch onglet résultat
 if(typeof rtab==="function")rtab("res",true);
 G.raceLocked=false;
 G.racePhase="sprint_done";
 if(typeof applyRaceLockUI==="function")applyRaceLockUI();
 // Mettre à jour UI
 if(typeof updateUI==="function")updateUI();
 if(typeof renderChamp==="function")renderChamp();
}
function _buildMoralWidget(){
  try {
    var mental=(typeof PILOT_MENTAL!=="undefined")?PILOT_MENTAL.value:50;
    var trust=(typeof TEAM_TRUST!=="undefined")?TEAM_TRUST.value:50;
    var hasTeam=!!(G.currentTeam&&G.currentTeam!=="Indépendant");
    var mHist=((typeof PILOT_MENTAL!=="undefined"&&PILOT_MENTAL.history)||[]).slice(-3);
    var tHist=((typeof TEAM_TRUST!=="undefined"&&TEAM_TRUST.history)||[]).slice(-3);
    var mColor=mental>=75?"#34D399":mental>=50?"#60A5FA":mental>=30?"#F59E0B":"#EF4444";
    var mLabel=mental>=75?"En feu":mental>=50?"Confiant":mental>=30?"Sous pression":"En difficulté";
    var tColor=trust>=70?"#34D399":trust>=45?"#60A5FA":trust>=25?"#F59E0B":"#EF4444";
    var tLabel=trust>=70?"Solide":trust>=45?"Neutre":trust>=25?"Fragile":"Critique";
    var mm=typeof _getMomentum==="function"?_getMomentum():"neutral";
    var mmMap={hot:{icon:"🔥",color:"#F59E0B",label:"En feu",impact:"+1.8% score"},warm:{icon:"⬆",color:"#34D399",label:"Bonne dynamique",impact:"+0.9% score"},neutral:{icon:"→",color:"#9CA3AF",label:"Équilibré",impact:"neutre"},cold:{icon:"⬇",color:"#60A5FA",label:"Froid",impact:"-0.8% score"},ice:{icon:"❄",color:"#A78BFA",label:"En difficulté",impact:"-1.8% score"},start:{icon:"◦",color:"#9CA3AF",label:"Début de saison",impact:"neutre"}};
    var mmD=mmMap[mm]||mmMap.neutral;
    function hl(h){
      if(!h||!h.reason)return "";
      var col=h.delta>0?"#34D399":"#EF4444";
      var val=(h.delta>0?"+":"")+Math.round(h.delta);
      return "<div style='display:flex;align-items:center;gap:5px;padding:2px 0'><span style='font-family:var(--font-display);font-size:10px;font-weight:700;color:"+col+";width:26px;flex-shrink:0'>"+val+"</span><span style='font-size:10px;color:var(--text3);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'>"+h.reason+"</span></div>";
    }
    function buildBar(color,pct){
      return "<div style='height:3px;background:rgba(255,255,255,0.08);border-radius:2px;margin-bottom:7px'><div style='height:3px;border-radius:2px;background:"+color+";width:"+Math.round(pct)+"%'></div></div>";
    }
    function buildBlock(title,value,color,label,hist){
      var h="<div style='padding:10px 12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px'>";
      h+="<div style='display:flex;align-items:center;justify-content:space-between;margin-bottom:6px'>";
      h+="<div style='font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--text3);letter-spacing:.15em;text-transform:uppercase'>"+title+"</div>";
      h+="<div style='display:flex;align-items:baseline;gap:3px'>";
      h+="<span style='font-family:var(--font-display);font-size:18px;font-weight:900;color:"+color+"'>"+Math.round(value)+"</span>";
      h+="<span style='font-size:9px;color:"+color+"'>"+label+"</span></div></div>";
      h+=buildBar(color,value);
      if(hist.length>0){h+=hist.slice().reverse().map(hl).join("");}
      else{h+="<div style='font-size:10px;color:var(--text3);font-style:italic'>Pas encore de données</div>";}
      h+="</div>";
      return h;
    }
    var cols="<div style='margin:0 14px 8px;display:grid;grid-template-columns:1fr"+(hasTeam?" 1fr":"")+";gap:8px'>";
    cols+=buildBlock("Mental",mental,mColor,mLabel,mHist);
    if(hasTeam)cols+=buildBlock("Confiance",trust,tColor,tLabel,tHist);
    cols+="</div>";
    var mmLine="<div style='margin:0 14px 4px;display:flex;align-items:center;gap:8px;padding:7px 12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:8px'>";
    mmLine+="<span style='font-size:14px'>"+mmD.icon+"</span>";
    mmLine+="<div style='flex:1'><div style='font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--text3);letter-spacing:.15em;text-transform:uppercase'>Momentum</div>";
    mmLine+="<div style='font-size:11px;font-weight:600;color:"+mmD.color+"'>"+mmD.label+"</div></div>";
    if(mmD.impact)mmLine+="<span style='font-family:var(--font-display);font-size:9px;color:"+mmD.color+";opacity:.7'>"+mmD.impact+"</span>";
    mmLine+="</div>";
    var wrap=document.createElement("div");
    wrap.innerHTML=cols+mmLine;
    var frag=document.createDocumentFragment();
    while(wrap.firstChild)frag.appendChild(wrap.firstChild);
    return frag;
  } catch(e){console.warn("_buildMoralWidget:",e);return null;}
}


function showResult(){try{/* SPRINT — Si on sort d'une course sprint, utiliser un écran dédié au lieu du résultat complet */ if(typeof LIVE_RACE!=="undefined"&&LIVE_RACE&&LIVE_RACE._isSprintMode){return _showSprintResult()}"function"==typeof _hideRaceEventModal&&_hideRaceEventModal(),"function"==typeof _dismissHomeToast&&_dismissHomeToast(),(function(){var btn=document.getElementById("pit-button-container");if(btn)btn.remove();var tmb=document.getElementById("tyre-mode-container");if(tmb)tmb.remove();var mdsb=document.getElementById("pitwall-btn");if(mdsb&&mdsb.parentNode)mdsb.parentNode.removeChild(mdsb);var mdsm=document.getElementById("pitwall-modal");if(mdsm&&mdsm.parentNode)mdsm.parentNode.removeChild(mdsm)})(),void 0!==RACE_WEEKEND_STATE&&(RACE_WEEKEND_STATE.courseDone=!0,/* #5 — Reset du flag fpDone et du bonus pour préparer le prochain week-end */RACE_WEEKEND_STATE.fpDone=false,G._fpBonus=null,G._fpResult=null,/* SPRINT — Reset des flags sprint pour le prochain week-end */RACE_WEEKEND_STATE.sprintDone=false,G._sprintPts=0,"function"==typeof updateRaceTabsVisibility&&updateRaceTabsVisibility());var e=RACE_STATE.weather,t=RACE_STATE.circuitData,r=e.rainMod,n=LIVE_RACE_FINAL_POS>0?LIVE_RACE_FINAL_POS:G.rivals.length>0?Math.ceil(G.rivals.length/2):1,a=[],i=_getPtsTable()[n-1]||0,o=buildRaceStory(n,e,t);G.champPts+=i;var s=getRacePrizeMoney(n);s>0&&(G.budget+=s,PRIZE_HISTORY.push({race:"Manche "+(G.races.length+1),pos:n,amount:s})),applySponsorBonuses(n);
// Stocker l'effet setup pour la prochaine course
try{
 var _feelEnd=typeof _getSetupFeel==="function"?_getSetupFeel():null;
 if(_feelEnd){
  if(_feelEnd.match==="bad"){
   G._lastSetupMismatch={cat:G.cat,circuit:RACE_STATE.circuit||"",saison:G.saison};
  } else {
   G._lastSetupMismatch=null; // bon setup = aucun carryover négatif
  }
 }
}catch(_e){}var l=1===RACE_STATE.qualiPos,c=getTeammateRival(),d=c?c.lastPos||99:null;G.races.push({nom:"Manche "+(G.races.length+1),pos:n,pts:i,detail:o.short,pole:l,tmPos:d,qualiPos:G.qualiPos||0,circuit:RACE_STATE&&RACE_STATE.circuit||"",weather:RACE_STATE&&RACE_STATE.weather&&RACE_STATE.weather.id||"dry",bestLap:LIVE_RACE&&LIVE_RACE.bestLap?{time:LIVE_RACE.bestLap.time,driver:LIVE_RACE.bestLap.driverName||"",isPlayer:!!LIVE_RACE.bestLap.isPlayer,lap:LIVE_RACE.bestLap.lap||0}:null,playerBestLap:LIVE_RACE&&LIVE_RACE.drivers?(function(){var pp=LIVE_RACE.drivers.find(function(d){return d.isPlayer});return pp&&pp.bestLap?pp.bestLap:null})():null,saison:G.saison,cat:G.cat});var p=null,u,f;if(TEAM_TRUST&&TEAM_TRUST.objectives){var m=G.races.length>0?G.champPts/G.races.length:0,g={"Karting Junior":4,"Karting Senior":6,"Formule 4":8,"Formula Regional":10,"Formule 3":10,"Formule 2":12,"Formule 1":10,"Super Formula":10,"Endurance WEC":10,IndyCar:10}[G.cat]||8;p=Math.round(5*(m-g))}(function(){try{var _mmEnd=typeof _getMomentum==="function"?_getMomentum():"neutral";var _trustNow=typeof TEAM_TRUST!=="undefined"?TEAM_TRUST.value:50;if(_mmEnd==="ice"&&_trustNow<30&&G.currentTeam&&G.currentTeam!=="Indépendant"&&typeof pushMail==="function"&&typeof _hasTeamStructure==="function"&&_hasTeamStructure()){var _iceMail="Quatre courses difficiles. Ce n'est pas une remise en question de ton talent, mais on doit en parler ensemble. Viens me voir en début de semaine prochaine.";pushMail({from:G.currentTeam+" — Direction sportive",role:"team_boss",subject:"On a besoin de parler",body:_iceMail,actions:[{label:"Compris, à lundi",kind:"dismiss",responseBody:"Je serai là. Je sais que ça ne va pas."}]})}}catch(_e){}})();runRacePostHooks({pos:n,pts:i,isDnf:0===n,isPole:l,mentalEcart:p,drivers:LIVE_RACE.drivers}),"function"==typeof _autoSaveOnRaceEnd&&_autoSaveOnRaceEnd();var h={"Karting Junior":1,"Karting Senior":1,"Formule 4":2,"Formula Regional":2,"Formule 3":3,"Formule 2":3,"Formule 1":3,"Super Formula":3,"Endurance WEC":3,IndyCar:3}[G.cat]||1;if(G.substats){var v=RACE_STATE.circuitData||{};1===n&&gainSubStat("pression",1),n<=3&&gainSubStat("gestion_pneus",1),"attack"===G.strat&&n<=5&&gainSubStat("vitesse_pure",1),RACE_STATE.eventsLog&&RACE_STATE.eventsLog.length>2&&gainSubStat("decision",1),n>0&&n<=8&&("highspeed"===v.type&&gainSubStat("acceleration",1),"technical"===v.type&&gainSubStat("freinage",1),"street"===v.type&&gainSubStat("concentration",1),v.neckLoad>=8&&gainSubStat("physique",1),v.bumpsFactor>=8&&gainSubStat("physique",1),v.altitude>=15&&gainSubStat("decision",1),v.streetWalls>=9&&gainSubStat("concentration",1)),G.races.length%3==0&&gainSubStat("physique",1),computeLegacyStats()}else gainSubStat("vitesse",("attack"===G.strat?2:1)*h),gainSubStat("sangfroid",n<=3?3:n<=8?2:1),gainSubStat("strategie",RACE_STATE.eventsLog.length>1?2:1),gainSubStat("regularite",n<=5?2:1),gainSubStat("pneus","manage"===G.strat?2:1),gainSubStat("attaque","attack"===G.strat||n<=3?1:0);(typeof applyRaceRepGain==="function"&&applyRaceRepGain(n)),(typeof applyIgRaceGain==="function"&&applyIgRaceGain(n));for(var x=0,y=CAL_RACES.length-1;y>=0;y--)if(CAL_RACES[y].done){x=CAL_RACES[y].week;break}var b=G.semaine,A;if(x>0&&x>=G.semaine?G.semaine=x+1:G.semaine++,runWeeklyTicks(Math.max(1,G.semaine-b)),"function"==typeof generateWeeklySocialFeed)try{generateWeeklySocialFeed()}catch(e){console.warn("social feed:",e)}G.pa=3;var w=[],M;LIVE_RACE.drivers&&LIVE_RACE.drivers.length>0?LIVE_RACE.drivers.slice().sort(function(e,t){return e.pos-t.pos}).forEach(function(e){w.push({name:e.name,nat:e.nat||"FR",pos:e.pos,pts:_getPtsTable()[e.pos-1]||0,me:e.isPlayer,team:e.team,dnf:e.dnf})}):(w.push({name:(G.pilot.prenom?G.pilot.prenom+" ":"")+G.pilot.nom,nat:G.pilot.nat||"FR",pos:n,pts:i,me:!0,team:G.currentTeam||""}),G.rivals.forEach(function(e,t){var r=t+2;w.push({name:e.name,nat:e.nat||"FR",pos:r,pts:_getPtsTable()[r-1]||0,me:!1,team:e.team||""})}),w.sort(function(e,t){return e.pos-t.pos}));if(G.offers&&G.offers.length&&(G.offers.forEach(function(e){"number"==typeof e.expire&&(e.expire-=1)}),G.offers=G.offers.filter(function(e){return e.signed||"number"!=typeof e.expire||e.expire>0})),G.sponsorOffers&&G.sponsorOffers.length&&(G.sponsorOffers.forEach(function(e){e.expire-=1}),G.sponsorOffers=G.sponsorOffers.filter(function(e){return e.expire>0})),generateTeamOffers(n),"function"==typeof maybeTriggerTPApproach)try{maybeTriggerTPApproach()}catch(e){console.warn("TP approach:",e)}if("function"==typeof applyRaceResultsToRelations)try{applyRaceResultsToRelations(n,0===n)}catch(e){console.warn("race->relations:",e)}var E=G.races.length>=CAL_RACES.length&&CAL_RACES.length>0;E&&(G.seasonOver=!0);var T=G.races.length;updateUI(),renderChamp(),renderOffers();var k=document.getElementById("race-title");k&&(k.textContent="Manche "+T),CURRENT_EVT_IDX=0,buildResultScreen(n,i,o,w,E);(function(){try{var _i2=document.getElementById("res-content");if(_i2&&typeof _buildMoralWidget==="function"){var _mw=_buildMoralWidget();if(_mw){var _first=_i2.firstChild;if(_first&&_first.nextSibling){_i2.insertBefore(_mw,_first.nextSibling);}else{_i2.appendChild(_mw);}}}}catch(_e){console.warn("moral widget:",_e);}})();rtab("res",!0),G.raceLocked=!1,G.racePhase="result",applyRaceLockUI();if(typeof showPostRaceRadio==="function")try{setTimeout(function(){showPostRaceRadio(n,i,!!l,!!E)},500)}catch(e){console.warn("showPostRaceRadio:",e)}}catch(srErr){console.error("[RJ] showResult failed:", srErr&&srErr.message, srErr&&srErr.stack);try{var _btn=document.getElementById("race-btn");if(_btn){_btn.disabled=false;_btn.textContent="Continuer";_btn.onclick=function(){try{if(typeof navTo==="function")navTo("S-home","ni-home")}catch(e){console.error(e)}}}}catch(_){}try{if(typeof pushHomeToast==="function")pushHomeToast("Erreur","Affichage du résultat en échec. Le score est sauvegardé.","#EF4444");}catch(_){}try{G.raceLocked=false;G.racePhase="result";if(typeof applyRaceLockUI==="function")applyRaceLockUI();}catch(_){}}}
function showPostRaceRadio(pos,pts,wasPole,seasonEnd){try{if(!G||!G.currentTeam||G.currentTeam==="Indépendant")return;var team=_getTeamPersonality();var msgs=[];if(pos===1){msgs.push({t:"Victoire ! Quelle course magnifique !",d:_radioFlavor(team)+" ! Toute l'équipe est avec toi, c'est un moment historique !"});msgs.push({t:"P1 ! Tu nous fais rêver !",d:"Performance exceptionnelle aujourd'hui. Le team principal est radieux."});msgs.push({t:"On a gagné, tu entends ?!",d:_radioFlavor(team)+" ! Champagne ce soir au paddock !"})}else if(pos>=2&&pos<=3){msgs.push({t:"Podium ! Excellent travail !",d:_radioFlavor(team)+" ! Performance solide, la stratégie a payé."});msgs.push({t:"Bravo, beau podium",d:"Le team est très satisfait, points précieux pour le championnat."})}else if(pos>=4&&pos<=6){msgs.push({t:"Bons points, beau combat",d:"Course solide. On prend les points et on enchaîne."});msgs.push({t:"Top 6 honorable",d:"Pas notre meilleure quali mais belle remontée. On continue à bosser."})}else if(pos>=7&&pos<=10){msgs.push({t:"Dans les points, c'est l'essentiel",d:"Pas la course rêvée mais on score. Debrief demain pour analyser."})}else if(pos===0){if(team.tone==="passionate")msgs.push({t:"Ah... che peccato",d:"On va analyser tout ça calmement. La voiture, la stratégie, tout sera passé au crible."});else if(team.tone==="direct")msgs.push({t:"Bon... DNF",d:"On rentre, on debrief, on bosse. Prochaine fois."});else msgs.push({t:"Abandon, dommage",d:"On va comprendre ce qui s'est passé. Garde la tête haute, prochaine course."})}else{if(team.tone==="passionate")msgs.push({t:"Course difficile aujourd'hui",d:"On va analyser, le rythme n'était pas là. Coraggio pour la prochaine."});else msgs.push({t:"Pas la course espérée",d:"On debrief en équipe, on identifie les axes de progression. On revient plus fort."})}if(wasPole&&pos===1){msgs.push({t:"Pole + victoire = grand chelem !",d:_radioFlavor(team)+" ! Performance complète, week-end parfait !"})}if(msgs.length===0)return;var m=msgs[Math.floor(Math.random()*msgs.length)];pushRadioMsg(m.t,m.d,{ttl:8,color:pos===1?"#F59E0B":pos<=3?"#FBBF24":pos===0?"#EF4444":"#22D3EE"})}catch(e){console.warn("showPostRaceRadio:",e)}}
function buildRaceStory(e,t,r){var n,a,i="storm"===t.id?"sous la pluie battante":"wet"===t.id?"sur piste humide":"hot"===t.id?"par forte chaleur":"",o=RACE_STATE.eventsLog.length,s=RACE_STATE.eventsLog.filter(function(e){return"+"===e.sign}).length,l=o>0?s>=o/2?" — bonne gestion des incidents":" — course compliquee":"";return 1===e?(n="Victoire"+(i?" "+i:"")+" !",a="Course maitrisee de bout en bout"+l+"."):e<=3?(n="Podium — P"+e+(i?" "+i:""),a="Beau resultat"+l+"."):e<=5?(n="P"+e+(i?" "+i:""),a="Course correcte"+l+". Des points utiles."):(n="P"+e+(i?" "+i:" — journee difficile"),a="Course compliquee"+l+"."),{short:n,long:a}}function buildResultScreen(e,t,r,n,a){var i=document.getElementById("res-content");if(i){i.innerHTML="";var o={1:"#d4a842",2:"#9098b0",3:"#c07840"},s,l=o[e]||"var(--text)",c={1:"rgba(212,168,66,.25)",2:"rgba(144,152,176,.15)",3:"rgba(192,120,64,.2)"}[e]||"transparent",d=document.createElement("div");if(d.style.cssText="margin:10px 14px 10px;padding:16px;background:linear-gradient(160deg,var(--bg2) 0%,var(--bg) 100%);border:1px solid var(--border-hi);border-top:3px solid "+l+";position:relative;overflow:hidden;border-radius:var(--r)",d.innerHTML='<div style="position:absolute;top:-10px;right:-10px;width:80px;height:80px;background:radial-gradient(circle,'+c+' 0%,transparent 70%);pointer-events:none"></div><div style="font-family:var(--font-display);font-size:52px;font-weight:900;color:'+l+';line-height:1;letter-spacing:-.02em">P'+e+'</div><div style="font-size:12px;color:var(--text2);margin-top:5px;line-height:1.5">'+r.long+'</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">'+(1===e?'<span class="badge b-gold">Victoire</span>':"")+(e<=3?'<span class="badge b-teal">Podium</span>':"")+(t>0?'<span class="badge b-blue">+'+t+" pts</span>":"")+(RACE_STATE.weather?'<span class="badge '+RACE_STATE.weather.badge+'">'+renderIcon(RACE_STATE.weather.id,14,"currentColor")+" "+RACE_STATE.weather.label+"</span>":"")+"</div>",i.appendChild(d),(function(){try{var lapHist=(LIVE_RACE&&LIVE_RACE._lapHistory)||[];if(lapHist.length>=2){var btn=document.createElement("button");btn.style.cssText="display:flex;align-items:center;gap:10px;width:calc(100% - 28px);margin:0 14px 10px;padding:10px 12px;background:linear-gradient(135deg,rgba(96,165,250,0.12) 0%,rgba(168,85,247,0.10) 100%);border:1px solid rgba(96,165,250,0.30);border-radius:10px;color:var(--text);font-family:var(--font-body);font-size:13px;font-weight:600;cursor:pointer;text-align:left;transition:transform .12s,border-color .15s";btn.innerHTML='<span style="display:inline-flex;width:34px;height:34px;border-radius:8px;background:rgba(96,165,250,0.18);border:1px solid rgba(96,165,250,0.35);color:#60A5FA;align-items:center;justify-content:center;flex-shrink:0"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg></span><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;color:var(--text);line-height:1.2"><span style="display:inline-flex;vertical-align:-2px;margin-right:6px;color:#60A5FA"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></span>Voir le récap visuel</div><div style="font-size:11px;color:var(--text3);margin-top:2px">Évolution position, secteurs, moments-clés</div></div><span style="color:var(--text3);font-size:18px;flex-shrink:0">›</span>';btn.addEventListener("click",function(){if(typeof showWeekendRecap==="function")showWeekendRecap()});i.appendChild(btn)}}catch(e){console.warn("recap button:",e)}})(),LIVE_RACE&&LIVE_RACE.bestLap){var p=LIVE_RACE.bestLap,u=function(e){if(e>=60){var t=Math.floor(e/60),r=e-60*t;return t+":"+(r<10?"0":"")+r.toFixed(3)}return e.toFixed(3)},f=p.isPlayer?(G.pilot.prenom?G.pilot.prenom+" ":"")+G.pilot.nom:formatPilotName(p.driverName,!0,"FR"),m=document.createElement("div");m.style.cssText="margin:0 14px 10px;padding:12px 14px;border:1px solid rgba(167,139,250,0.35);border-radius:var(--r3);background:rgba(167,139,250,0.06);display:flex;align-items:center;justify-content:space-between;gap:8px",m.innerHTML='<div><div style="font-family:var(--font-display);font-size:10px;font-weight:700;color:#A78BFA;letter-spacing:.14em;text-transform:uppercase;margin-bottom:2px">Meilleur tour</div><div style="font-size:13px;color:var(--text)">'+f+'<span style="color:var(--text3);font-size:11px;margin-left:6px">· Tour '+p.lap+'</span></div></div><span style="font-family:var(--font-display);font-size:18px;font-weight:900;color:#A78BFA">'+u(p.time)+"</span>",i.appendChild(m)}if(RACE_STATE.eventsLog.length){var g=document.createElement("div");g.style.cssText="margin:0 14px 10px;border:1px solid var(--border-hi);border-radius:var(--r3);overflow:hidden;background:var(--bg3)";var h=document.createElement("div");h.style.cssText="padding:10px 14px;border-bottom:1px solid var(--border);font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.07em",h.textContent="Incidents de course ("+RACE_STATE.eventsLog.length+")",g.appendChild(h),RACE_STATE.eventsLog.forEach(function(e){var t=document.createElement("div");t.style.cssText="padding:9px 14px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:8px",t.innerHTML='<span style="font-size:13px;font-weight:700;color:'+e.color+';flex-shrink:0;width:12px">'+e.sign+'</span><div><div style="font-size:12px;color:var(--text2)">'+e.choice.substring(0,45)+'…</div><div style="font-size:11px;color:var(--text3);margin-top:2px">'+e.note+"</div></div>",g.appendChild(t)}),i.appendChild(g)}var v=document.createElement("div");v.style.cssText="margin:0 14px 10px;border:1px solid var(--border-hi);border-radius:var(--r3);overflow:hidden;background:var(--bg3)";var x=document.createElement("div"),y;x.style.cssText="padding:10px 14px;border-bottom:1px solid var(--border);font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.07em",x.textContent="Classement final",v.appendChild(x),(LIVE_RACE.drivers&&LIVE_RACE.drivers.length?LIVE_RACE.drivers.slice().sort(function(e,t){return e.pos-t.pos}):n).forEach(function(e){var t=document.createElement("div"),r=e.pos,n=void 0!==e.isPlayer?e.isPlayer:!!e.me,a=e.name||"",i=PTS_TABLE[r-1]||0,s=e.dnf||!1,l=e.team||null,c=o[r]||(n?"var(--text)":"var(--text2)");t.style.cssText="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--line);"+(n?"background:rgba(232,16,48,.06);":"");var d=driverBadge(l,e.nat||e.natCode||"FR",14);t.innerHTML='<span style="font-size:15px;font-weight:700;width:24px;color:'+c+'">'+r+'</span><span style="flex:1;font-size:13px;'+(n?"font-weight:700;color:var(--text)":"color:var(--text2)")+'">'+d+(n?"▶ ":"")+a+(s?' <span style="font-size:10px;color:#EF4444">DNF</span>':"")+'</span><span style="font-size:12px;font-weight:600;'+(i>0?"color:var(--teal,#34D399)":"color:var(--text3)")+'">'+(i>0?"+"+i+" pts":"—")+"</span>",v.appendChild(t)}),i.appendChild(v);var b=getPlayerCarDevNews();if(b){var A=b.delta>0,w=document.createElement("div");w.style.cssText="margin:0 16px 12px;padding:12px 14px;border:1px solid "+(A?"var(--teal,#34D399)":"var(--red-light)")+";border-radius:12px;background:"+(A?"#0a2620":"#1a0808");var M=A?"▲":"▼",E=Math.abs(b.delta),T=A?E>=3?"Gros paquet aéro":E>=2?"Mise à jour voiture":"Évolution technique":E>=3?"Régression fiabilité":"Légère perte de performance",k=getEffectiveTeamRating(b.team);w.innerHTML='<div style="display:flex;align-items:center;gap:8px"><span style="font-size:18px">'+M+'</span><div style="flex:1"><div style="font-size:12px;font-weight:700;color:'+(A?"var(--teal,#34D399)":"var(--red-light)")+'">'+T+" — "+b.team+'</div><div style="font-size:11px;color:var(--text3);margin-top:2px">'+(A?"+":"")+b.delta+' pts de perf · Voiture : <strong style="color:var(--text)">'+k+"</strong>/100</div></div></div>",i.appendChild(w)}if(G.currentTeam&&"Indépendant"!==G.currentTeam){var L=getEffectiveTeamRating(G.currentTeam),S=getTeamRatings(),C=S&&S[G.currentTeam]||75,R=getTeamSeasonDelta(G.currentTeam);if(Math.abs(R)>=2&&!b){var P=document.createElement("div");P.style.cssText="margin:0 16px 12px;padding:10px 14px;border:1px solid var(--border);border-radius:12px;background:var(--surface2);display:flex;align-items:center;gap:8px";var F=R>0?"▲":"▼",B=R>0?"var(--teal,#34D399)":"var(--red-light)";P.innerHTML='<span style="color:'+B+';font-weight:700">'+F+'</span><span style="font-size:12px;color:var(--text3)">Voiture '+G.currentTeam+" : "+L+'/100 <span style="color:'+B+'">('+(R>0?"+":"")+R+" depuis le début de saison)</span></span>",i.appendChild(P)}}(function(){try{var _cb=typeof _buildChampImpactBlock==="function"?_buildChampImpactBlock(e,t):null;if(_cb)i.appendChild(_cb);}catch(_e){}})();if(a){var I=document.createElement("button");I.className="btn btn-prim",I.style.marginBottom="8px",I.textContent="Bilan de saison →",I.onclick=showSeasonEnd,i.appendChild(I)}else{var O=document.createElement("button");O.className="btn btn-prim",O.style.marginBottom="8px",O.textContent="Retour au calendrier",O.onclick=function(){navTo("S-cal","ni-cal"),renderCal()},i.appendChild(O)}var j=document.createElement("button");j.className="btn btn-sec",j.textContent="Tableau de bord",j.onclick=function(){navTo("S-home","ni-home")},i.appendChild(j)}}function showFb(e,t,r,n){var a=document.getElementById(e);a&&(a.className="fb "+t+" on",a.innerHTML="<div>"+r+"</div>"+(n?'<div class="fb-s">'+n+"</div>":""),"train-fb"!==e&&setTimeout(function(){try{a.scrollIntoView({behavior:"smooth",block:"nearest"})}catch(e){}},100))}var CAT_ORDER_FOR_TRAIN={"Karting Junior":0,"Karting Senior":1,"Formule 4":2,"Formula Regional":3,"Formule 3":4,"Formule 2":5,"Formule 1":6,"Super Formula":5,"Endurance WEC":5,IndyCar:5};function _playerCatIdxForTrain(){return CAT_ORDER_FOR_TRAIN[G.cat]||0}function _sessionAvailableInCat(e){return void 0===e.minCatIdx||null===e.minCatIdx||_playerCatIdxForTrain()>=e.minCatIdx}var TRAIN_CATALOG=[{id:"karting_test",label:"Session karting libre",icon:"kart",color:"#FB923C",cost:200,pa:1,minCatIdx:0,desc:"Retour aux fondamentaux en karting. Sensation et réflexes.",gains:[{k:"reactivite",v:1},{k:"vitesse_pure",v:1}]},{id:"fitness",label:"Entraînement physique",icon:"gym",color:"#2DD4BF",cost:0,pa:1,minCatIdx:0,desc:"Cardio, musculation, résistance aux G.",gains:[{k:"physique",v:1},{k:"grip",v:1}]},{id:"repos",label:"Repos complet",icon:"rest",color:"var(--text3)",cost:0,pa:0,minCatIdx:0,desc:"Récupération physique et mentale. Indispensable sur le long terme.",gains:[]},{id:"tyre_mgmt",label:"Programme gestion pneus",icon:"tyre",color:"#F59E0B",cost:350,pa:1,minCatIdx:1,desc:"Exercices de dégradation et fenêtres de température.",gains:[{k:"gestion_pneus",v:1},{k:"freinage",v:1}]},{id:"duel_training",label:"Exercices de dépassement",icon:"zap",color:"#F97316",cost:400,pa:1,minCatIdx:1,desc:"Simulations de duels roue à roue, choix de trajectoires.",gains:[{k:"reactivite",v:1},{k:"acceleration",v:1}]},{id:"quali_sim",label:"Simulation qualifications",icon:"chrono",color:"#EF4444",cost:700,pa:1,minCatIdx:2,desc:"Tour lancé, maximum de concentration sur le chrono pur.",gains:[{k:"vitesse_pure",v:1},{k:"acceleration",v:1}]},{id:"race_debrief",label:"Débrief vidéo dernière course",icon:"film",color:"#818CF8",cost:0,pa:1,minCatIdx:2,desc:"Analyser les erreurs et les bons choix de la course précédente.",gains:[{k:"decision",v:1},{k:"concentration",v:1}],cond:function(){return G.races.length>0},condMsg:"Dispute au moins une course."},{id:"long_run",label:"Simulation de course longue",icon:"run",color:"#34D399",cost:500,pa:1,minCatIdx:2,desc:"20 tours de simulation — gestion des pneus et du rythme.",gains:[{k:"gestion_pneus",v:1},{k:"grip",v:1}]},{id:"data_analysis",label:"Analyse data & setup",icon:"data",color:"#60A5FA",cost:600,pa:1,minCatIdx:3,desc:"Travailler avec les ingénieurs sur les données télémétrie.",gains:[{k:"decision",v:1},{k:"freinage",v:1}]},{id:"mental_coach",label:"Coach mental — pression",icon:"brain",color:"#A78BFA",cost:800,pa:1,minCatIdx:3,desc:"Séances avec un psychologue du sport. Visualisation, focus.",gains:[{k:"pression",v:1},{k:"concentration",v:1}]},{id:"sim_driving",label:"Simulateur haute fidélité",icon:"sim",color:"#C084FC",cost:1400,pa:1,minCatIdx:4,desc:"Simulateur professionnel avec retour de force. Très réaliste.",gains:[{k:"freinage",v:1},{k:"vitesse_pure",v:1}]},{id:"engineer_1on1",label:"Debrief 1-à-1 avec ingénieur",icon:"data",color:"#38BDF8",cost:1e3,pa:1,minCatIdx:5,desc:"Session individuelle avec ton ingénieur de course.",gains:[{k:"decision",v:1},{k:"grip",v:1}]},{id:"elite_prep",label:"Préparation grand prix",icon:"rocket",color:"#FACC15",cost:2500,pa:1,minCatIdx:6,desc:"Programme intensif avant une manche F1 : simulateur, ingénierie, mental.",gains:[{k:"vitesse_pure",v:1},{k:"decision",v:1},{k:"concentration",v:1}]}];function getTrainGain(e){return e.gains.map(function(e){return{k:e.k,v:e.v}})}function renderTrainScreen(){try{var e=document.getElementById("train-rating-bar");if(e){for(var t=calcPlayerRating(),r=getRatingTier(t),n=[{lbl:"D",min:0},{lbl:"C",min:40},{lbl:"C+",min:50},{lbl:"B",min:58},{lbl:"B+",min:64},{lbl:"A",min:70},{lbl:"A+",min:78},{lbl:"S",min:85},{lbl:"S+",min:90}],a=null,i=0,o=0,s,l,c;o<n.length;o++){if(n[o].min>t){a=n[o];break}i=n[o].min}a?(s=Math.round((t-i)/(a.min-i)*100),l=a.lbl,c=a.min):(s=100,l="MAX",c=99);for(var d=3,p="",u=0;u<3;u++)p+='<div class="train-hero-pa-dot '+(u<G.pa?"on":"off")+'"></div>';e.style.cssText="",e.className="train-hero",e.innerHTML='<div class="train-hero-stripe" style="background:linear-gradient(180deg,'+r.color+',transparent 80%)"></div><div class="train-hero-top"><div class="train-hero-val-col"><div class="train-hero-kicker">Note</div><div class="train-hero-val" style="color:'+r.color+'">'+t+'<span class="train-hero-tier" style="color:'+r.color+'">'+r.tier+'</span></div></div><div class="train-hero-progress-col"><div class="train-hero-next-lbl">Prochain palier</div><div class="train-hero-next-tier"><span style="color:'+r.color+'">'+l+'</span><span style="color:var(--muted);font-size:11px;font-weight:700">· '+c+'</span></div><div class="train-hero-progress-bg"><div class="train-hero-progress-fill" style="width:'+s+"%;background:"+r.color+'"></div></div></div></div><div class="train-hero-pa-row"><div class="train-hero-pa-lbl" onclick="showConceptTooltip(\'PA\')" style="cursor:pointer">Sessions · '+G.pa+' / 3 <span style="font-size:9px;color:var(--text3);margin-left:4px">ⓘ</span></div><div class="train-hero-pa-dots">'+p+"</div></div>"}try{if(typeof getCategoryStatCap==="function"&&G.substats){var _cap=getCategoryStatCap();var _hardCap=typeof _hardCapForCategory==="function"?_hardCapForCategory():(_cap+12);var _atCap=[],_overCap=[];Object.keys(G.substats).forEach(function(k){var v=G.substats[k];if(typeof v!=="number")return;var _lbl=(typeof SUBSTAT_LABELS!=="undefined"&&SUBSTAT_LABELS[k])?SUBSTAT_LABELS[k]:k;var _vDisplay=Math.round(v);if(v>=_cap+5)_overCap.push({k:k,v:_vDisplay,lbl:_lbl});else if(v>=_cap)_atCap.push({k:k,v:_vDisplay,lbl:_lbl});});if(_atCap.length>0||_overCap.length>0){var _txt="";if(_overCap.length>0){_txt+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><span style="font-family:var(--font-display);font-size:10px;font-weight:800;color:#EF4444;letter-spacing:.12em;text-transform:uppercase">Plafond de catégorie atteint</span></div>';_txt+='<div style="font-size:11.5px;color:var(--text2);line-height:1.45;margin-bottom:6px">Ces stats dépassent le seuil de '+_cap+' de '+(G.cat||"ta catégorie")+'. Les gains d\u0027entraînement sont fortement réduits — passe à la catégorie supérieure pour continuer à progresser :</div>';_txt+='<div style="display:flex;flex-wrap:wrap;gap:4px">';_overCap.forEach(function(s){_txt+='<span style="padding:2px 7px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);border-radius:4px;font-family:var(--font-display);font-size:10px;font-weight:700;color:#EF4444;letter-spacing:.04em">'+s.lbl+' '+s.v+'/'+_cap+'</span>'});_txt+='</div>';}else{_txt+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><span style="font-family:var(--font-display);font-size:10px;font-weight:800;color:#F59E0B;letter-spacing:.12em;text-transform:uppercase">Approche du plafond</span></div>';_txt+='<div style="font-size:11.5px;color:var(--text2);line-height:1.45;margin-bottom:6px">Ces stats sont au plafond de '+_cap+' pour '+(G.cat||"ta catégorie")+'. Continuer à les entraîner ne sera vraiment efficace qu\u0027en catégorie supérieure :</div>';_txt+='<div style="display:flex;flex-wrap:wrap;gap:4px">';_atCap.forEach(function(s){_txt+='<span style="padding:2px 7px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.35);border-radius:4px;font-family:var(--font-display);font-size:10px;font-weight:700;color:#F59E0B;letter-spacing:.04em">'+s.lbl+' '+s.v+'/'+_cap+'</span>'});_txt+='</div>';}var _color=_overCap.length>0?"#EF4444":"#F59E0B";var _bg=_overCap.length>0?"rgba(239,68,68,0.06)":"rgba(245,158,11,0.06)";e.innerHTML+='<div style="margin:10px 12px 4px;padding:11px 13px;background:'+_bg+';border:1px solid '+_color+'44;border-left:3px solid '+_color+';border-radius:8px">'+_txt+'</div>';}}}catch(_capErr){console.warn("cap warning:",_capErr)}var f=document.getElementById("train-sessions-content");if(!f)return;var m=[{label:"Vitesse & Technique",icon:"zap",color:"#EF4444",ids:["quali_sim","data_analysis","sim_driving","engineer_1on1"]},{label:"Régularité & Endurance",icon:"tyre",color:"#F59E0B",ids:["long_run","tyre_mgmt"]},{label:"Mental & Stratégie",icon:"brain",color:"#A78BFA",ids:["mental_coach","race_debrief"]},{label:"Physique & Combat",icon:"gym",color:"#2DD4BF",ids:["fitness","karting_test","duel_training"]},{label:"Élite F1",icon:"rocket",color:"#FACC15",ids:["elite_prep"]},{label:"Récupération",icon:"rest",color:"#6B7280",ids:["repos"]}],g=Object.assign({vitesse:"Vitesse",regularite:"Régularité",sangfroid:"Sang-froid",attaque:"Attaque",pneus:"Pneus",strategie:"Stratégie",physique:"Physique",adapt:"Adapt"},SUBSTAT_LABELS||{}),h="";m.forEach(function(e){var t=e.ids.filter(function(e){var t=TRAIN_CATALOG.find(function(t){return t.id===e});return t&&_sessionAvailableInCat(t)});0!==t.length&&(h+='<div class="train-group-lbl" style="color:'+e.color+'">',h+='<div class="train-group-lbl-ico" style="color:'+e.color+'">'+renderIcon(e.icon,12,e.color)+"</div>",h+='<span style="color:var(--soft)">'+e.label+"</span>",h+="</div>",t.forEach(function(e){var t=TRAIN_CATALOG.find(function(t){return t.id===e});if(t){var r=G.pa<=0&&t.pa>0,n=G.budget<t.cost,a=t.cond&&!t.cond(),i=getTrainGain(t),o=i.length?i.map(function(e){var t=void 0!==SUBSTAT_LABELS&&SUBSTAT_LABELS[e.k]||g[e.k]||e.k;return"+"+e.v+" "+t}).join(" · "):"Récupération",s=t.cost>0?t.cost.toLocaleString("fr-FR")+" €":"Gratuit",l=t.pa>0?"1 PA":"Repos",c,d;h+='<div class="train-session" style="'+(r||n||a?"opacity:0.45;pointer-events:none;":"")+'" onclick="doTrain(\''+t.id+"')\">",h+='<div class="train-session-ico" style="color:'+t.color+'">'+renderIcon(t.icon,18,t.color)+"</div>",h+='<div class="train-session-body">',h+='<div class="train-session-t">'+t.label+"</div>",h+='<div class="train-session-gains">'+o+"</div>",h+='<div class="train-session-meta">',h+='<span class="train-session-meta-chip">'+s+"</span>",h+='<span class="train-session-meta-chip">'+l+"</span>",a?h+='<span class="train-session-meta-chip danger">'+t.condMsg+"</span>":n&&(h+='<span class="train-session-meta-chip danger">Budget insuffisant</span>'),h+="</div>",h+="</div>",h+='<span class="train-session-arr">›</span>',h+="</div>"}}))}),f.innerHTML=h}catch(e){console.error("renderTrainScreen:",e.message,e.stack?e.stack.split("\\n")[1]:"")}}function doTrain(e){var t=TRAIN_CATALOG.find(function(t){return t.id===e});if(t)if(_sessionAvailableInCat(t))if(t.pa>0&&G.pa<=0)showFb("train-fb","err","Plus de PA disponibles","Tu as utilisé toutes tes sessions cette semaine.");else if(G.budget<t.cost)showFb("train-fb","err","Budget insuffisant","Il te manque "+(t.cost-G.budget).toLocaleString("fr-FR")+" €.");else if(!t.cond||t.cond()){G.budget-=t.cost,G.pa-=t.pa;var r=getTrainGain(t),n=[],a=Object.assign({vitesse:"Vitesse",regularite:"Régularité",sangfroid:"Sang-froid",attaque:"Attaque",pneus:"Pneus",strategie:"Stratégie",physique:"Physique",adapt:"Adapt"},SUBSTAT_LABELS||{});r.forEach(function(e){gainSubStat(e.k,e.v);var t=SUBSTAT_LABELS[e.k]||a[e.k]||e.k;n.push("+"+e.v+" "+t)}),computeLegacyStats(),updateUI(),renderTrainScreen();var i=document.getElementById("train-pa-hdr");i&&(i.textContent=G.pa>0?"Sessions disponibles ("+G.pa+")":"Sessions indisponibles");var o=0===t.pa?"Repos — récupération en cours":n.join(" · "),s=t.cost>0?" · −"+t.cost.toLocaleString("fr-FR")+"€":"";showFb("train-fb","ok",t.label+" terminé",o+s+" · PA restants : "+G.pa)}else showFb("train-fb","err","Condition non remplie",t.condMsg||"");else showFb("train-fb","err","Session verrouillée","Cette session n'est pas encore accessible dans ta catégorie.")}function injectNatFlags(){buildContinentGrid();var e=document.getElementById("nat-grid");_selectedContinent?renderNatGrid(_selectedContinent):e&&(e.innerHTML="")}function buildCalendar(){CAL_RACES=[];for(var e={"Karting Junior":["GP Lorraine","GP Alsace","GP Normandie","GP Bretagne","GP Bourgogne","GP Auvergne","GP Picardie","GP Provence","GP Languedoc","GP Cote Azur"],"Karting Senior":["GP Monaco Kart","GP Lyon","GP Valencia","GP Spa Kart","GP Monza Kart","GP Portimao","GP Zandvoort Kart","GP Abu Dhabi Kart","GP Bahrain Kart","GP Silverstone Kart"],"Formule 4":["Monza","Misano","Mugello","Imola","Vallelunga","Red Bull Ring","Hungaroring","Spielberg","Spa","Paul Ricard"],"Formula Regional":["Paul Ricard","Spa","Zandvoort","Red Bull Ring","Hungaroring","Mugello","Monza","Barcelona","Portimao","Silverstone"],"Formule 3":["Bahrain","Imola","Monaco","Barcelona","Red Bull Ring","Silverstone","Budapest","Spa","Zandvoort","Monza","Macao GP"],"Formule 2":["Bahrain","Jeddah","Melbourne","Baku","Monaco","Silverstone","Budapest","Spa","Monza","Abu Dhabi"],"Formule 1":["Bahrain","Jeddah","Miami","Imola","Monaco","Barcelone","Silverstone","Budapest","Spa","Zandvoort","Monza","Singapore","Suzuka","Austin","Mexico","Sao Paulo","Las Vegas","Abu Dhabi"],"Super Formula":["Suzuka","Okayama","Autopolis","Sugo","Fuji Speedway","Motegi","Sapporo","Okayama Round 2","Fuji Round 2","Suzuka Final"],"Endurance WEC":["Sebring 12h","Portimao 6h","Spa 6h","24h Le Mans","Monza 6h","Fuji 6h","Bahrain 8h","Bahrain Final"],IndyCar:["St. Petersburg","Texas","Long Beach","Indianapolis 500","Detroit","Road America","Iowa","Nashville","Portland","Laguna Seca","Gateway","Monterey"]},t=e[G.cat]||e["Karting Junior"],r=Math.floor(46/t.length),n=0;n<t.length;n++){var a={name:t[n],week:2+n*r+(n%3==0?1:0),manche:n+1,done:!1,result:null},i=getSpecialRaceTag(t[n]);i&&(a.special=i),CAL_RACES.push(a)}/* SPRINT — Randomisation des manches sprint F1 par saison.
   PRNG seedé par G.saison + cat → déterministe pour une saison donnée mais varie d'une saison à l'autre.
   Le seed inclut 'F1' pour ne pas affecter les autres cats (au cas où on ajouterait du randomisé ailleurs).
   F2/F3 : toutes les manches restent sprint (géré dans _isSprintWeekendForRace, pas marqué ici). */
if(G.cat==="Formule 1"&&CAL_RACES.length>=5){
 // Mulberry32 — PRNG simple, déterministe à partir d'un seed
 var _seed=((G.saison||1)*2654435761)>>>0;
 _seed=(_seed^0xF1F1F1F1)>>>0; // marqueur F1
 var _rand=function(){_seed=(_seed+0x6D2B79F5)>>>0;var t=_seed;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296};
 // Fisher-Yates partiel : tirer 5 indices distincts
 var _indices=[];
 for(var _ii=0;_ii<CAL_RACES.length;_ii++)_indices.push(_ii);
 // Mélange
 for(var _jj=_indices.length-1;_jj>0;_jj--){
  var _kk=Math.floor(_rand()*(_jj+1));
  var _tmp=_indices[_jj];_indices[_jj]=_indices[_kk];_indices[_kk]=_tmp;
 }
 // Prendre les 5 premiers et marquer comme sprint
 var _sprintCount=Math.min(5,CAL_RACES.length);
 for(var _ll=0;_ll<_sprintCount;_ll++){
  CAL_RACES[_indices[_ll]].isSprint=true;
 }
}
try{scheduleSeasonEvents()}catch(e){console.warn("scheduleSeasonEvents failed:",e)}try{announceNextEvents()}catch(e){console.warn("announceNextEvents failed:",e)}}var SPECIAL_RACE_TAGS={monaco:{label:"Monaco",desc:"Urbain — pole quasi obligatoire",color:"#DC2A3C",icon:"",errorRiskAdd:.015,poleBonus:.015,prestigeMult:1.8},lemans:{label:"24h Le Mans",desc:"Endurance — physique et régularité clés",color:"#1E88E5",icon:"",fatigueAdd:20,physiqueWeight:1.5,prestigeMult:2.5},indy500:{label:"Indy 500",desc:"Prestige absolu IndyCar",color:"#FFD60A",icon:"",prestigeMult:2.5,moneyBonus:25e3},macao:{label:"Macao GP",desc:"Hors championnat, prestige F3",color:"#A78BFA",icon:"",prestigeMult:1.8,moneyBonus:8e3,nonChamp:!0},silverstone_jub:{label:"Silverstone (historique)",desc:"Course emblématique",color:"#34D399",icon:"",prestigeMult:1.3}};function getSpecialRaceTag(e){if(!e)return null;var t=e.toLowerCase();return t.indexOf("monaco")>=0&&t.indexOf("kart")<0?"monaco":t.indexOf("le mans")>=0?"lemans":t.indexOf("indianapolis 500")>=0||t.indexOf("indy 500")>=0?"indy500":t.indexOf("macao")>=0?"macao":"silverstone"===t&&Math.random()<.15?"silverstone_jub":null}function applySpecialRaceToModifiers(e){var t="function"==typeof getNextRace?getNextRace():null,r=null;if(CAL_RACES&&CAL_RACES.length){for(var n=0;n<CAL_RACES.length;n++)if(!CAL_RACES[n].done&&CAL_RACES[n].week<=(G.semaine||1)){r=CAL_RACES[n];break}if(!r)for(var a=CAL_RACES.length-1;a>=0;a--)CAL_RACES[a].done}if(!r||!r.special)return e;var i=SPECIAL_RACE_TAGS[r.special];return i?(i.errorRiskAdd&&(e.errorRisk=(e.errorRisk||0)+i.errorRiskAdd),i.poleBonus&&RACE_STATE&&1===RACE_STATE.qualiPos&&(e.scoreBonus=(e.scoreBonus||0)+i.poleBonus),i.physiqueWeight&&G.stats&&G.stats.physique&&(e.scoreBonus=(e.scoreBonus||0)+Math.max(0,G.stats.physique-70)/100*.02),e):e}function applySpecialRaceRewards(e,t){var r=null;if(CAL_RACES&&CAL_RACES.length)for(var n=CAL_RACES.length-1;n>=0;n--)if(CAL_RACES[n].done){r=CAL_RACES[n];break}if(r&&r.special){var a=SPECIAL_RACE_TAGS[r.special];if(!(!a||t||e>3)){var i=Math.round(3*(a.prestigeMult||1)),o;if(G.reputation=Math.min(100,(G.reputation||0)+i),a.moneyBonus){var s=a.moneyBonus*(1===e?1:2===e?.5:.25);G.budget+=Math.round(s)}if("function"==typeof pushHomeToast&&a.prestigeMult>=1.8)pushHomeToast((o=1===e?"Victoire":2===e?"Podium P2":"Podium P3")+" · "+a.label,"+"+i+" réputation"+(a.moneyBonus?" · +"+Math.round(a.moneyBonus*(1===e?1:2===e?.5:.25)).toLocaleString("fr-FR")+" €":""),a.color);if("function"==typeof recordDecision&&a.prestigeMult>=1.8&&recordDecision("career",(1===e?"Vainqueur ":"Podium ")+a.label,(1===e?"Victoire prestigieuse — ":"Podium prestigieux — ")+a.label+" · Saison "+G.saison,"positive",[]),1!==e||"indy500"!==r.special&&"lemans"!==r.special||(G._majorWins||(G._majorWins=[]),G._majorWins.push({race:a.label,saison:G.saison,gameYear:G.gameYear,cat:G.cat})),a.prestigeMult>=1.8&&"function"==typeof _addFeedPost){var l=(G.pilot.prenom?G.pilot.prenom+" ":"")+(G.pilot.nom||""),c=G.currentTeam||"",o=1===e?"VICTOIRE":2===e?"P2":"P3";if(void 0!==SOCIAL_PRESS_ACCOUNTS){var d=1===e?3:2;SOCIAL_PRESS_ACCOUNTS.slice(0,d).forEach(function(t,r){var n=1===e?[" HISTORIQUE ! "+l+" s'impose à "+a.label+" — une ligne dorée ajoutée à son palmarès.","ANALYSE — "+a.label+" : comment "+l+" a dompté l'une des épreuves les plus dures du calendrier.",l+" inscrit son nom dans l'histoire de "+a.label+". Notre rétro en détail."]:["Beau podium ("+o+") pour "+l+" à "+a.label+". Un résultat qui pèse dans une carrière.","À "+a.label+", "+l+" signe une performance qui marquera les observateurs."];_addFeedPost({type:"press",author:t.name,handle:t.handle,color:t.color,body:n[r]||n[0]})})}if(c&&"Indépendant"!==c&&1===e){var p="@"+c.toLowerCase().replace(/\s+/g,"").replace(/[^a-z0-9]/g,"").substr(0,14);_addFeedPost({type:"team",author:c,handle:p,color:"#EF4444",body:"VICTOIRE À "+a.label.toUpperCase()+" ! "+l+" a écrit une page d'histoire aujourd'hui.  Merci à tous, c'est un moment qu'on n'oubliera jamais.",isWinner:!0})}if(1===e&&"function"==typeof pushMail&&G.agent){var u="parent"===G.agent.type,f;pushMail({from:u?G.agent.firstName||("mother"===G.agent.parentRole?"Maman":"Papa"):G.agent.name||"Ton agent",role:"agent",subject:"Tu viens de marquer l'histoire",body:u?"Mon grand, "+a.label+"... J'ai pleuré. Sérieusement. Ce que tu as fait aujourd'hui, personne ne pourra te le prendre. Je suis tellement fier de toi.":"Chapeau. "+a.label+" en victoire, c'est un palier de carrière majeur. Les sponsors vont se bousculer dans les prochaines semaines. Je reprends contact avec tous les gros dossiers."})}}}}}function getNextRace(){var e=CAL_RACES.filter(function(e){return!e.done&&e.week>=G.semaine});return e.length?e[0]:null}function markRaceDone(e,t){if(CAL_RACES.length){for(var r=0;r<CAL_RACES.length;r++)if(!CAL_RACES[r].done&&CAL_RACES[r].week<=G.semaine)return CAL_RACES[r].done=!0,void(CAL_RACES[r].result={pos:e,pts:t,pole:G._lastPole||!1});for(var n=0;n<CAL_RACES.length;n++)if(!CAL_RACES[n].done)return CAL_RACES[n].done=!0,void(CAL_RACES[n].result={pos:e,pts:t,pole:G._lastPole||!1})}}function renderCal(){try{CAL_RACES.length||buildCalendar(),G._scheduledEvents||scheduleSeasonEvents();var e=document.getElementById("cal-sub");e&&(e.textContent=G.cat+" — "+gYear());var s=["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"],l=["Jan","Fév","Mar","Avr","Mai","Juin","Juil","Août","Sep","Oct","Nov","Déc"],c={media:"#60A5FA",sponsors:"#F0A020",relations:"#F472B6",team:"#34D399",rivalry:"#EF4444",commerce:"#A78BFA",crisis:"#F59E0B",training:"#22D3EE"},d={media:"Médias",sponsors:"Sponsor",relations:"Perso",team:"Écurie",rivalry:"Rival",commerce:"Commerce",crisis:"Crise",training:"Entraîn."},p=[31,28,31,30,31,30,31,31,30,31,30,31],u=3;function f(e){for(var t=0;t<11&&e>p[t];)e-=p[t],t++;return{m:t,d:e}}function m(e,t){var r,n;if("race"===t)r=0;else{var a=[5,3,1];r=a[e%a.length]}return f(Math.min(365,Math.max(1,7*e-r)))}function g(e){return m(e,"race")}for(var h={},v=0;v<12;v++)h[v]=[];for(var x in CAL_RACES.forEach(function(e){var t=m(e.week,"race");h[t.m].push({week:e.week,day:t.d,type:"race",data:e,label:e.name,color:"var(--red2)",done:e.done})}),(G._scheduledEvents||[]).forEach(function(e){if(e.saison===G.saison&&e.announced){var t=SCHEDULED_EVENTS.find(function(t){return t.id===e.eventId});if(t){var r=m(e.week,"event"),n=t.cat||"media",a=d[n]||"Événement";try{if("function"==typeof t.gen){var i={rep:G.reputation||0,cat:G.cat,budget:G.budget,saison:G.saison,semaine:G.semaine,age:G.age},o=t.gen(i);o&&o.title&&(a=o.title)}}catch(e){}h[r.m].push({week:e.week,day:r.d,type:"event",data:e,label:a,color:c[n]||"#60A5FA",cat:n,catLabel:d[n]||"Événement",done:e.resolved})}}}),h)h[x].sort(function(e,t){return e.week-t.week||e.day-t.day});var y=m(G.semaine,"race").m,b=document.getElementById("cal-main-container");if(!b)return;var A="",w=h[y]||[],M=p[y];A+='<div class="cal-current-month">',A+='<div class="cal-current-head">',A+='<div class="cal-current-title">'+s[y]+"</div>",A+='<div class="cal-current-year">'+gYear()+"</div>",A+="</div>",A+='<div class="cal-current-grid-wrap">',A+='<div class="cal-weekdays">',["L","M","M","J","V","S","D"].forEach(function(e){A+='<div class="cal-weekday">'+e+"</div>"}),A+="</div>";for(var E=1,T=0;T<y;T++)E+=p[T];var k=(E-1+3)%7;A+='<div class="cal-grid">';for(var L=0;L<k;L++)A+='<div class="cal-cell empty"></div>';var S={};w.forEach(function(e){S[e.day]||(S[e.day]=e)});for(var C=m(G.semaine,"race").d,R=m(G.semaine,"race").m===y?G.semaine:-1,P=1;P<=M;P++){var F=S[P],B=["cal-cell"];R>0&&P===C&&B.push("current-day");var I="";if(F&&(B.push("has-moment"),B.push("race"===F.type?"has-race":"has-event"),"event"===F.type&&(I='style="--moment-color:'+F.color+'"')),A+='<div class="'+B.join(" ")+'" '+I+">",A+='<span class="cal-cell-day">'+P+"</span>",F){var O="race"===F.type?"var(--red2)":F.color;A+='<div class="cal-cell-band" style="background:'+O+'"></div>'}A+="</div>"}A+="</div>",A+="</div>",w.length>0?(A+='<div class="cal-current-events">',w.forEach(function(e){var t=l[y]+" "+e.day,r="race"===e.type?"Course":e.catLabel||"Événement",n="";"race"===e.type&&(n="M"+e.data.manche+" · ");var a=e.done?"opacity:.45":"";A+='<div class="cal-event-tag" style="color:'+e.color+";"+a+'">',A+='<div class="cal-event-tag-date">'+t+"</div>",A+='<div class="cal-event-tag-type">'+r+"</div>",A+='<div class="cal-event-tag-title" style="color:var(--text)">'+n+e.label+"</div>",A+="</div>"}),A+="</div>"):A+='<div style="padding:12px 14px 14px;text-align:center;font-size:12px;color:var(--muted);font-style:italic">Aucun moment programmé ce mois-ci.</div>',A+="</div>",A+='<div class="cal-other-months-title">Saison complète</div>';for(var j=0;j<12;j++)if(j!==y){var q=h[j];if(q&&0!==q.length){var D=q.filter(function(e){return"race"===e.type}).length,N=q.filter(function(e){return"event"===e.type}).length;A+='<div class="cal-other-month">',A+='<div class="cal-other-month-head">',A+='<div class="cal-other-month-name">'+s[j]+"</div>",A+='<div class="cal-other-month-counts">'+(D>0?D+" course"+(D>1?"s":""):"")+(D>0&&N>0?" · ":"")+(N>0?N+" évén.":"")+"</div>",A+="</div>",A+='<div class="cal-other-events">',q.forEach(function(e){A+='<div class="cal-mini-event">',A+='<div class="cal-mini-event-dot" style="background:'+e.color+'"></div>',A+='<div class="cal-mini-event-date">'+e.day+" "+l[j]+"</div>",A+='<div class="cal-mini-event-title">'+("race"===e.type?" ":"")+e.label+"</div>",A+="</div>"}),A+="</div>",A+="</div>"}}b.innerHTML=A}catch(H){console.error("renderCal:",H.message,H.stack?H.stack.split("\n")[1]:"")}}function resetRaceScreen(){G.evtChoice=null,G.qualiPos=0,G.raceLocked=!1,G.racePhase="prep",applyRaceLockUI(),"function"==typeof resetRaceWeekend&&resetRaceWeekend(),QUALI_STATE.chronoInterval&&(clearInterval(QUALI_STATE.chronoInterval),QUALI_STATE.chronoInterval=null),QUALI_STATE.lapInterval&&(clearInterval(QUALI_STATE.lapInterval),QUALI_STATE.lapInterval=null),QUALI_STATE.session=0,QUALI_STATE.phase="idle",rtab("prep",!0);var e=document.getElementById("race-btn");e&&(e.disabled=!1,e.textContent="Départ !");var t=document.getElementById("quali-screen");t&&(t.style.display="block");var r=document.getElementById("race-screen");r&&(r.style.display="block");var n=document.getElementById("evt-zone");n&&(n.innerHTML="");var a=document.getElementById("live-event-modal");a&&(a.style.display="none");var _ec=document.getElementById("live-event-card");if(_ec){_ec.classList.remove("radio-msg");var _hdr=_ec.querySelector("#lec-header");if(_hdr){var _badges=_hdr.querySelectorAll(".radio-tx-led");_badges.forEach(function(b){var p=b.parentNode;if(p&&p!==_hdr&&p.parentNode===_hdr)p.parentNode.removeChild(p)})}}var i=document.getElementById("race-zone");i&&(i.style.display="block");var o=document.getElementById("quali-chrono-bar");o&&(o.style.display="none");var s=document.getElementById("race-bar");s&&(s.style.width="0%");var l=document.getElementById("race-laps");l&&(l.textContent="Tour 0 / "+G.totalLaps);var c=document.getElementById("live-leaderboard");c&&(c.innerHTML='<div style="padding:14px 16px;font-size:13px;color:var(--text3)">Prêt au départ.</div>');var d=document.getElementById("live-event-modal");d&&(d.style.display="none");var p=document.getElementById("live-race-label");p&&(p.textContent="Prêt au départ");var u=document.getElementById("live-race-lap");u&&(u.textContent="Tour 0 / "+G.totalLaps),LIVE_RACE&&LIVE_RACE.interval&&(clearInterval(LIVE_RACE.interval),LIVE_RACE.interval=null),LIVE_RACE_FINAL_POS=0;
// Nettoyer les éléments flottants de course
(function(){
 ['pitwall-btn','pitwall-modal','pit-button-container','tyre-mode-container','lbd-momentum-badge'].forEach(function(id){
  var el=document.getElementById(id);
  if(el&&el.parentNode)el.parentNode.removeChild(el);
 });
})();
["aero","bal","mec","agg"].forEach(function(e){var t=document.getElementById("so-"+e);t&&t.classList.toggle("on","bal"===e)}),G.setup="bal",["d-at","d-mg","d-df","d-gb"].forEach(function(e){var t=document.getElementById(e);t&&t.classList.toggle("on","d-mg"===e)}),G.strat="manage",updateUI()}function getConstructorChampion(){var e=TEAMS_BY_CAT[G.cat];if(!e||!e.length)return null;var t={};e.forEach(function(e){t[e]=0});var r=G.currentTeam&&e.indexOf(G.currentTeam)>=0?G.currentTeam:null;r&&(t[r]=(t[r]||0)+G.champPts),G.rivals.forEach(function(r){var n=r.team&&e.indexOf(r.team)>=0?r.team:null;n&&(t[n]=(t[n]||0)+(r.pts||0))});var n=e.slice().sort(function(e,r){return(t[r]||0)-(t[e]||0)});return{team:n[0],pts:t[n[0]]||0,playerTeam:r}}function showSeasonEnd(){G.seasonOver=!0,"function"==typeof applyPreseasonObjectiveReward&&applyPreseasonObjectiveReward();var e=[{name:(G.pilot.prenom?G.pilot.prenom+" ":"")+G.pilot.nom,pts:G.champPts,me:!0}];G.rivals.forEach(function(t){e.push({name:t.name,pts:t.pts,me:!1})}),e.sort(function(e,t){return t.pts-e.pts});var t=e.findIndex(function(e){return e.me})+1,r=getConstructorChampion(),n=!(!r||!r.playerTeam||r.team!==r.playerTeam);if(!G._seasonEndBroadcast||G._seasonEndBroadcast.saison!==G.saison){G._seasonEndBroadcast={saison:G.saison};if("function"==typeof checkAchievementUnlocks)try{checkAchievementUnlocks()}catch(_e){}if(1===t&&"function"==typeof triggerAltPathChampion)try{triggerAltPathChampion()}catch(_e){}if("function"==typeof triggerForkSuggestionIfStuck)try{triggerForkSuggestionIfStuck()}catch(_e){}var a=(G.pilot.prenom?G.pilot.prenom+" ":"")+(G.pilot.nom||""),i=G.cat||"",o=G.currentTeam||"";if(1===t){try{var _titleMult=("undefined"!=typeof IG_CAT_MULT&&IG_CAT_MULT[G.cat])||.003,_titleBase=2e4,_titleRepBoost=.6+(G.reputation||20)/100*1.4,_titleRand=.85+.3*Math.random(),_titleGain=Math.max(50,Math.round(_titleBase*_titleMult*_titleRepBoost*_titleRand)),_titleBefore="function"==typeof getIgFollowers?getIgFollowers():(G.igFollowers||0);if("function"==typeof setIgFollowers)setIgFollowers(_titleBefore+_titleGain);else G.igFollowers=(G.igFollowers||0)+_titleGain;var _titleAfter="function"==typeof getIgFollowers?getIgFollowers():(G.igFollowers||0);if("undefined"!=typeof SOCIAL_LOG&&SOCIAL_LOG&&SOCIAL_LOG.unshift){SOCIAL_LOG.unshift({saison:G.saison,week:G.semaine,tone:"course_P1",note:"Titre "+i+" — vague de nouveaux abonnés.",igGain:_titleGain,net:0});SOCIAL_LOG.length>30&&SOCIAL_LOG.pop()}if("function"==typeof _handleIgMilestone)try{for(var _milestones=[1e4,5e4,1e5,5e5,1e6],_mi=0;_mi<_milestones.length;_mi++){var _mc=_milestones[_mi];if(_titleBefore<_mc&&_titleAfter>=_mc)_handleIgMilestone(_mc)}}catch(_e){}if("function"==typeof pushHomeToast)try{pushHomeToast("Titre "+i,"+"+("function"==typeof fmtFollowers?fmtFollowers(_titleGain):_titleGain)+" abonnés","#A855F7")}catch(_e){}}catch(_e){}}if(1===t&&"function"==typeof _addFeedPost){if(void 0!==SOCIAL_PRESS_ACCOUNTS&&SOCIAL_PRESS_ACCOUNTS.slice(0,3).forEach(function(e,t){setTimeout(function(){_addFeedPost({type:"press",author:e.name,handle:e.handle,color:e.color,body:0===t?" CHAMPION ! "+a+" s'adjuge le titre "+i+". Une saison maîtrisée de bout en bout.":1===t?"ANALYSE — Comment "+a+" a dominé "+i+" cette saison. Notre décryptage complet.":"Le titre pour "+a+". Que retenir de cette campagne "+i+" ? Retour en chiffres."})},50*t)}),o&&"Indépendant"!==o){var s="@"+o.toLowerCase().replace(/\s+/g,"").replace(/[^a-z0-9]/g,"").substr(0,14);_addFeedPost({type:"team",author:o,handle:s,color:"#EF4444",body:" CHAMPIONS !! Quelle saison, quel pilote ! "+a+" champion "+i+" avec nous. Merci à tous. Une année qu'on n'oubliera jamais.",isWinner:!0})}if(void 0!==PLAYER_ACADEMY&&PLAYER_ACADEMY.id&&"function"==typeof getAcademy){var l=getAcademy(PLAYER_ACADEMY.id);if(l){var c="@"+l.toLowerCase().replace(/\s+/g,"").replace(/[^a-z0-9]/g,"").substr(0,14);_addFeedPost({type:"team",author:l,handle:c,color:"#60A5FA",body:"Notre pépite "+a+" décroche le titre "+i+" ! Un pur produit du programme. Quelle fierté. "})}}if("function"==typeof _socialFanHandle)for(var d=0;d<3;d++)(function(){var e=_socialFanHandle(),t=[a+" CHAMPION !!! On le savait depuis le début ","Quelle saison de dingue, "+a+" mérite mille fois ce titre",a+" passe à l'étape suivante maintenant, qui l'arrête ?"];_addFeedPost({type:"fan",author:e.name,handle:e.handle,color:e.color,body:t[Math.floor(Math.random()*t.length)]})})();if("function"==typeof pushMail&&G.agent){var p="parent"===G.agent.type,u;pushMail({from:p?G.agent.firstName||("mother"===G.agent.parentRole?"Maman":"Papa"):G.agent.name||"Ton agent",role:"agent",subject:"CHAMPION "+i+" !",body:p?"Mon grand... Je n'ai pas de mots. CHAMPION ! Ta mère et moi on en pleure. Tout ce travail, tous ces sacrifices, ça paie. Savoure chaque seconde, tu l'as mérité.":"CHAMPION ! Félicitations, ce titre c'est le tien. Prépare-toi, on va avoir des appels de partout dans les prochaines semaines. Les portes s'ouvrent maintenant."})}}else if(t<=3&&t>1&&"function"==typeof _addFeedPost&&o&&"Indépendant"!==o){var f="@"+o.toLowerCase().replace(/\s+/g,"").replace(/[^a-z0-9]/g,"").substr(0,14);_addFeedPost({type:"team",author:o,handle:f,color:"#EF4444",body:"P"+t+" au championnat pour "+a+" ! Belle saison, bel esprit d'équipe. On remet ça l'an prochain !"})}if(n&&"function"==typeof _addFeedPost&&o&&"Indépendant"!==o){var m="@"+o.toLowerCase().replace(/\s+/g,"").replace(/[^a-z0-9]/g,"").substr(0,14);_addFeedPost({type:"team",author:o,handle:m,color:"#F59E0B",body:" CHAMPIONS CONSTRUCTEURS ! L'effort collectif de toute une saison récompensé. Bravo à chaque membre de l'équipe, et merci à nos pilotes.",isWinner:!0}),1!==t&&"function"==typeof pushMail&&_hasTeamStructure()&&pushMail({from:(typeof _getTPSender==="function"?_getTPSender(o).from:o+" — Team Principal"),role:"team_boss",subject:" Titre constructeurs — ensemble",body:"On l'a fait. Titre constructeurs, c'est collectif et c'est ce qui rend ça si fort. Ton apport compte, même si le trophée individuel t'a échappé. Tête haute, on remet ça.",actions:[{label:"On a fait un truc énorme",kind:"dismiss",responseBody:"Fier d'avoir contribué. Merci à toute l'équipe."}]})}var g=G.races.filter(function(e){return 0===e.pos}).length;if(G.races.length>=5&&0===g&&"function"==typeof _addFeedPost&&void 0!==SOCIAL_PRESS_ACCOUNTS){var h=SOCIAL_PRESS_ACCOUNTS[Math.floor(Math.random()*SOCIAL_PRESS_ACCOUNTS.length)];_addFeedPost({type:"press",author:h.name,handle:h.handle,color:h.color,body:" Saison exemplaire de régularité pour "+a+" : zéro abandon sur "+G.races.length+" courses. Une constance rare à souligner."})}"function"==typeof _autoSaveOnSeasonEnd&&setTimeout(function(){_autoSaveOnSeasonEnd()},800)}var v=document.getElementById("S-season-end");if(v){var x=document.getElementById("se-hero");if(x){var y,b='<div style="font-size:56px">'+(y=1===t?'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M8 21h8m-4-4v4M5 3H2l3 9a4 4 0 008 0l3-9h-3"/><path d="M19 3h3l-3 9"/></svg>':t<=3?'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="10" r="6"/><path d="M9 17l-3 4h12l-3-4"/></svg>':'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 15V5l4 4 4-4 4 4 4-4v10"/><line x1="4" y1="19" x2="4" y2="15"/></svg>')+"</div>";b+='<div style="font-size:22px;font-weight:800;color:var(--text);margin:8px 0 4px">'+(1===t?"Champion !":t<=3?"Podium au championnat":"Saison terminée")+"</div>",b+='<div style="font-size:14px;color:var(--text3)">P'+t+" — "+G.champPts+" pts</div>",n&&(b+='<div style="display:inline-flex;align-items:center;gap:5px;background:#1a1100;border:1px solid #F59E0B;border-radius:20px;padding:4px 10px;font-size:11px;font-weight:700;color:#F59E0B;margin-top:6px">Champion Constructeur · '+(r?r.team:"")+"</div>"),x.innerHTML=b}var A=document.getElementById("se-stats");if(A){var w=G.races.filter(function(e){return 1===e.pos}).length,M=G.races.filter(function(e){return e.pos>=1&&e.pos<=3}).length;A.innerHTML=[{v:G.races.length,l:"Courses"},{v:w,l:"Victoires"},{v:M,l:"Podiums"},{v:G.champPts,l:"Points"}].map(function(e){return'<div class="se-stat"><div class="se-stat-v">'+e.v+'</div><div class="se-stat-l">'+e.l+"</div></div>"}).join("")}var E=document.getElementById("se-champ-table");if(E){var T={1:"#d4a842",2:"#9098b0",3:"#c07840"};E.innerHTML=e.slice(0,8).map(function(e,t){return'<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--line);'+(e.me?"background:rgba(232,16,48,.06);":"")+'"><span style="font-family:var(--font-display);font-size:15px;font-weight:800;width:22px;color:'+(T[t+1]||"var(--text2)")+'">'+(t+1)+'</span><span style="flex:1;font-size:13px;'+(e.me?"font-weight:700;color:var(--text)":"color:var(--text2)")+'">'+formatPilotName(e.name,!0,e.nat)+'</span><span style="font-size:13px;font-weight:600;color:var(--teal,#34D399)">'+e.pts+" pts</span></div>"}).join("")}var k=CATEGORIES.indexOf(G.cat),L=document.getElementById("se-unlock"),S;if(L)if(G.pendingTransfer&&G.pendingTransfer.cat&&getCatNextOptions(G.cat).indexOf(G.pendingTransfer.cat)>=0)L.innerHTML='<div style="padding:14px;border:1px solid rgba(232,16,48,.3);border-radius:12px;background:#0A2620"><div style="font-size:13px;font-weight:700;color:var(--teal,#34D399);margin-bottom:4px">Promotion confirmée !</div><div style="font-size:12px;color:var(--text2)">Tu rejoins <strong>'+G.pendingTransfer.team+"</strong> en <strong>"+G.pendingTransfer.cat+"</strong> la saison prochaine.</div></div>";else if(t<=3&&getCatNextOptions(G.cat).length>0){var C=getCatNextOptions(G.cat),R=G.currentTeam&&"Indépendant"!==G.currentTeam;L.innerHTML=R?'<div style="padding:14px;border:1px solid rgba(232,16,48,.3);border-radius:12px;background:#0A2620"><div style="font-size:13px;font-weight:700;color:var(--teal,#34D399);margin-bottom:4px">Promotion disponible</div><div style="font-size:12px;color:var(--text2)">Tu peux monter. Confirme via la période des transferts.</div></div>':'<div style="padding:14px;border:1px solid var(--amber);border-radius:12px;background:#1a1000"><div style="font-size:13px;font-weight:700;color:var(--amber);margin-bottom:4px">Résultat suffisant pour monter</div><div style="font-size:12px;color:var(--text2)">Signe un contrat en '+(C[0]||G.cat)+" dans la fenêtre de transferts.</div></div>"}else L.innerHTML="";var P=evaluateSeasonTrust(),F=document.getElementById("se-trust-summary");if(F)if(G.currentTeam&&"Indépendant"!==G.currentTeam){var B=getTrustConsequences(),I='<div style="padding:0 16px 4px">';I+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">',I+='<span style="font-size:12px;color:var(--text3)">'+G.currentTeam+"</span>",I+='<span style="font-size:13px;font-weight:700;color:'+B.color+'">'+TEAM_TRUST.value+"/100</span></div>",I+='<div style="background:#1e293b;border-radius:4px;height:8px;overflow:hidden;margin-bottom:8px">',I+='<div style="height:100%;width:'+TEAM_TRUST.value+"%;background:"+B.color+';border-radius:4px"></div></div>',I+='<div style="font-size:12px;padding:8px 10px;border:1px solid '+B.color+"44;border-radius:8px;background:"+B.color+"11;color:"+B.color+';margin-bottom:8px">'+B.msg+"</div>",P.summary&&P.summary.length&&P.summary.forEach(function(e){var t=e.success?"#4ADE80":"#EF4444";I+='<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">',I+='<span style="font-size:12px;color:'+t+'">'+e.text+"</span>",I+='<span style="font-size:12px;font-weight:700;color:'+t+'">'+(e.delta>=0?"+":"")+e.delta+"</span></div>"}),TEAM_TRUST.value<25?I+='<div style="margin-top:8px;padding:10px;background:#1a0000;border:1px solid #EF4444;border-radius:8px;font-size:12px;color:#EF4444">⚠ Confiance critique — le renouvellement de contrat est sérieusement compromis.</div>':TEAM_TRUST.value>=75&&(I+='<div style="margin-top:8px;padding:10px;background:#001a0a;border:1px solid #4ADE80;border-radius:8px;font-size:12px;color:#4ADE80">✓ Excellente saison — l\'écurie te proposera un renouvellement avantageux.</div>'),I+="</div>",F.innerHTML=I}else F.innerHTML="<div style=\"padding:12px 16px;font-size:13px;color:var(--text3)\">Pilote indépendant — pas d'objectifs d'écurie.</div>";var O=document.getElementById("se-sub");O&&(O.textContent=G.cat+" — "+gYear()+" terminée"),document.querySelectorAll(".scr").forEach(function(e){e.classList.remove("on")}),v.classList.add("on"),document.getElementById("main-nav").classList.remove("show")}}function goTransferWindow(){G.seasonOver=!1,buildTransferOffers();var e=document.getElementById("tr-sub");e&&(e.textContent=gameYear()+1+" — Mercato"),trTab("equipes"),document.querySelectorAll(".scr").forEach(function(e){e.classList.remove("on")});var t=document.getElementById("S-transfer");t&&t.classList.add("on"),document.getElementById("main-nav").classList.remove("show")}function renderPathsVisual(){var e=document.getElementById("tr-paths-visual");if(e){var t=CAT_PATHS[G.cat]||[];if(t&&0!==t.length){var r;e.style.display="block",r=G.pilot&&G.pilot.dob&&G.pilot.dob.year&&G.gameYear?G.gameYear+1-G.pilot.dob.year:(G.age||10)+1;var n=[],a=[];t.forEach(function(e){var t=CAT_MIN_AGE[e];void 0!==t&&r<t?a.push({cat:e,minAge:t}):n.push(e)});var i=n.filter(function(e){return isMainPath(e)}),o=n.filter(function(e){return isAltPath(e)}),s='<div style="padding:10px 14px 6px;font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.07em">Voies disponibles depuis '+G.cat+"</div>";i.forEach(function(e){s+='<div style="display:flex;align-items:center;gap:10px;padding:8px 14px;border-top:1px solid var(--border)"><span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:rgba(52,211,153,0.12)">'+renderIcon("[FINAL]",18,"#34D399")+'</span><div><div style="font-size:13px;font-weight:600;color:var(--text)">'+e+'</div><div style="font-size:11px;color:var(--text3)">Voie principale</div></div><span class="badge b-teal" style="margin-left:auto;font-size:10px">Main</span></div>'}),o.forEach(function(e){var t=ALT_PATH_INFO[e]||{label:e,desc:e,icon:""};s+='<div style="display:flex;align-items:center;gap:10px;padding:8px 14px;border-top:1px solid var(--border)"><span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:rgba(245,158,11,0.12)">'+("JP"===t.icon||"US"===t.icon?flagSvg(t.icon,22):renderIcon("chrono",18,"#F59E0B"))+'</span><div><div style="font-size:13px;font-weight:600;color:var(--text)">'+e+'</div><div style="font-size:11px;color:var(--text3)">'+t.desc+'</div></div><span class="badge b-gold" style="margin-left:auto;font-size:10px">Alt</span></div>'}),a.forEach(function(e){var t=e.minAge-r;s+='<div style="display:flex;align-items:center;gap:10px;padding:8px 14px;border-top:1px solid var(--border);opacity:.55"><span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:rgba(156,163,175,0.10)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span><div><div style="font-size:13px;font-weight:600;color:var(--text2)">'+e.cat+'</div><div style="font-size:11px;color:#EF4444">Âge requis : '+e.minAge+" ans (dans "+t+" saison"+(t>1?"s":"")+')</div></div><span class="badge b-red" style="margin-left:auto;font-size:10px">Trop jeune</span></div>'}),e.innerHTML=s}else e.style.display="none"}}function buildTransferOffers(){var e=CATEGORIES.indexOf(G.cat),t=getCatNextOptions(G.cat),r=[];var _f2champ=false;try{if(typeof CAREER_HISTORY!=="undefined"&&CAREER_HISTORY)_f2champ=CAREER_HISTORY.some(function(h){return h&&h.cat==="Formule 2"&&h.pos===1});if(!_f2champ&&G.cat==="Formule 2"){var _st=[{p:G.champPts,me:true}];(G.rivals||[]).forEach(function(rv){_st.push({p:rv.pts,me:false})});_st.sort(function(x,y){return y.p-x.p});if(_st.length&&_st[0].me)_f2champ=true}}catch(_eF2){}if(G.pendingTransfer){var n=G.pendingTransfer,a=n.cat===G.cat,i=TEAM_LOGOS[n.team]?'<span style="display:inline-flex;width:18px;height:18px;border-radius:3px;overflow:hidden;vertical-align:middle;margin-right:5px">'+TEAM_LOGOS[n.team].replace('width="40" height="40"','width="18" height="18"')+"</span>":"";r.push({name:i+(a?n.team:n.team+" — "+n.cat+" (Promotion)"),budget:n.salary,repReq:0,desc:a?"Contrat signé. Tu rejoins "+n.team+" en "+n.cat+".":"Contrat signé. Tu es promu en "+n.cat+" avec "+n.team+" !",boost:n.salary>0?"+"+n.salary.toLocaleString("fr-FR")+" e/mois":"Nouveau départ",promotion:!a,nextCat:a?null:n.cat,isPendingTransfer:!0,team:n.team})}else{var o;o=G.pilot&&G.pilot.dob&&G.pilot.dob.year&&G.gameYear?G.gameYear+1-G.pilot.dob.year:(G.age||10)+1,G.offers.forEach(function(e){if(_f2champ&&e.cat==="Formule 2")return;var t=CAT_MIN_AGE[e.cat];if(!(void 0!==t&&o<t)){var n=e.cat===G.cat,a=!n&&getCatNextOptions(G.cat).indexOf(e.cat)>=0,i=n&&e.team===G.currentTeam,s=null!==e.cSalary&&void 0!==e.cSalary?e.cSalary:e.salary||0;s=Number(s)||0;var l=TEAM_LOGOS[e.team]?'<span style="display:inline-flex;width:18px;height:18px;border-radius:3px;overflow:hidden;vertical-align:middle;margin-right:5px">'+TEAM_LOGOS[e.team].replace('width="40" height="40"','width="18" height="18"')+"</span>":"",c=a?e.team+" — "+e.cat+" ↑":i?"Prolonger — "+e.team:e.team;r.push({name:l+c,team:e.team,budget:s,dur:e.duration||1,repReq:0,desc:a?"Promotion en "+e.cat+" avec "+e.team+".":i?"Renouveler ton contrat avec "+e.team+" pour "+(e.duration||1)+" saison(s).":"Rejoindre "+e.team+" en "+e.cat+".",boost:s>0?"+"+s.toLocaleString("fr-FR")+" e/mois":"Nouveau départ",promotion:a,nextCat:a?e.cat:null,isRenewal:i})}}),"Karting Junior"===G.cat&&0===r.length&&r.push({name:"Continuer en Karting Junior",budget:0,repReq:0,desc:"Reste en Karting Junior et vise le titre.",boost:"Expérience +",promotion:!1,nextCat:null})}var s=document.getElementById("tr-offers-list");if(s){s.innerHTML="";var l=document.getElementById("tr-independant-block");l&&(l.style.display="Karting Junior"===G.cat?"block":"none"),renderPathsVisual(),0===r.length&&e>0&&r.push({name:"Saison blanche",budget:0,repReq:0,desc:"Aucune offre disponible. Tu resteras en "+G.cat+" sans concourir cette saison. Tes stats progressent et une nouvelle fenêtre de transferts s'ouvrira.",boost:"Repos · Stats +1",promotion:!1,nextCat:null,isSaisonBlanche:!0}),r.forEach(function(e){var t=G.reputation>=(e.repReq||0),r=document.createElement("div");r.style.cssText="margin:6px 16px;padding:14px;border:1px solid "+(e.promotion?"var(--teal,#34D399)":"var(--border)")+";border-radius:12px;background:var(--surface2)";var n=Number(e.budget)||0,a=n>=0?"+"+n.toLocaleString("fr-FR")+" e/mois":Math.abs(n).toLocaleString("fr-FR")+" e a payer",i=e.dur&&e.dur>1?" — "+e.dur+" saisons":"",o;if(r.innerHTML='<div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:4px">'+(e.promotion?'<span style="display:inline-flex;vertical-align:middle;margin-right:4px;">'+renderIcon("rocket",14,"#34D399")+"</span>":"")+e.name+'</div><div style="font-size:12px;color:var(--text3);margin-bottom:8px">'+e.desc+'</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px"><span class="badge '+(e.budget>=0?"b-teal":"b-red")+'">'+a+'</span><span class="badge b-blue">'+e.boost+"</span>"+(e.repReq>0?'<span class="badge '+(t?"b-gray":"b-red")+'">Rep. '+e.repReq+(t?" ok":" requis")+"</span>":"")+"</div>",t){var l=document.createElement("button");l.className="btn btn-prim",l.style.cssText="margin:0;width:100%",l.textContent=e.isPendingTransfer&&e.promotion?"Confirmer la promotion":"Confirmer",o=e,l.onclick=function(){startNextSeason(o)},r.appendChild(l)}s.appendChild(r)});var c=document.getElementById("tr-grid-list");c&&(c.innerHTML=G.rivals.map(function(e,t){var r=["Reconduit","Transfert","Nouveau contrat","En nego","Libre"][t%5],n=["b-gray","b-blue","b-teal","b-amber","b-red"][t%5],a=calcRivalRating(e),i=getRatingTier(a);return'<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border)"><span style="font-size:18px;font-weight:900;color:'+i.color+';width:26px;flex-shrink:0">'+a+'</span><span style="font-size:10px;font-weight:700;color:'+i.color+';width:18px;flex-shrink:0">'+i.tier+'</span><span style="flex:1;font-size:13px;color:var(--text2)">'+formatPilotName(e.name,!0,e.nat)+'</span><span class="badge '+n+'">'+r+"</span></div>"}).join(""))}}function trTab(e){["equipes","contrats","pilotes"].forEach(function(t){var r=document.getElementById("tr-"+t);r&&(r.style.display=t===e?"block":"none")}),document.querySelectorAll("#S-transfer .tab").forEach(function(t){t.classList.toggle("on",t.getAttribute("data-tab")===e)})}function calcPilotAge(){if(!G.pilot||!G.pilot.dob||!G.pilot.startYear)return G.age||10;var e,t=(G.gameYear||G.pilot.startYear)-G.pilot.dob.year;return G.pilot.dob.month>6&&t--,Math.max(8,t)}function startNextSeason(e){var t=CATEGORIES.indexOf(G.cat),r=G.currentTeam,n=G.cat;if(G.pendingTransfer||e)(!G.pendingTransfer&&e&&e.isRenewal||!G.pendingTransfer&&e)&&(G._contractExpired=!1);else{if(G.contractDur>0&&G.contractDur--,G.contractDur<=0&&G.currentTeam&&"Indépendant"!==G.currentTeam){var a=G.currentTeam,i,o;if(G.currentTeam="Indépendant",G.contractDur=0,G._contractExpired=!0,"function"==typeof pushMail&&G.agent)pushMail({from:o=(i="parent"===G.agent.type)?G.agent.firstName||("mother"===G.agent.parentRole?"Maman":"Papa"):G.agent.name||"Ton agent",role:"agent",subject:"Fin de contrat avec "+a,body:i?"Mon grand, c'est un coup dur : personne n'a signé à temps et ton contrat avec "+a+" est expiré. On doit repartir de la base. Je sais que c'est difficile mais on va rebondir.":"Ton contrat avec "+a+" est expiré et aucune offre n'a été finalisée. Tu repars indépendant. Ça va être dur mais je continue à prospecter — tout n'est pas perdu.",actions:[{label:"OK, on rebondit",kind:"dismiss",responseBody:"Ça fait mal mais on va bosser pour remonter. Merci de ton soutien."}]});if("function"==typeof _addFeedPost&&void 0!==SOCIAL_PRESS_ACCOUNTS&&Math.random()<.4){var s=(G.pilot.prenom?G.pilot.prenom+" ":"")+(G.pilot.nom||""),l=SOCIAL_PRESS_ACCOUNTS[Math.floor(Math.random()*SOCIAL_PRESS_ACCOUNTS.length)];_addFeedPost({type:"press",author:l.name,handle:l.handle,color:l.color,body:s+" sans volant pour la saison prochaine : fin du contrat avec "+a+". Le temps presse."})};_expireEcurieSponsors("Tu n'es plus rattaché(e) à une écurie.")}var c;if(CATEGORIES.indexOf(G.cat)>=1&&(!G.currentTeam||"Indépendant"===G.currentTeam)){var d=G.cat;if(G.cat="Karting Junior",G.totalLaps=getCatLaps("Karting Junior"),G._demoted=!0,"function"==typeof pushMail&&pushMail({from:"Tes parents",role:"family",subject:"On est là pour toi",body:"Retour en Karting Junior après "+d+", on sait que c'est un coup dur. Mais écoute-nous : c'est un revers, pas la fin. Beaucoup de grands pilotes ont connu ce genre de passage. Tu vas rebondir.",actions:[{label:"Merci, ça me remotive",kind:"dismiss",responseBody:"Merci, j'avais besoin de l'entendre. Je repars à zéro et je vais tout donner.",effect:{type:"happiness",data:{delta:6}}}]}),"function"==typeof _addFeedPost&&"function"==typeof _socialFanHandle){var p=_socialFanHandle(),u=(G.pilot.prenom?G.pilot.prenom+" ":"")+(G.pilot.nom||"");_addFeedPost({type:"fan",author:p.name,handle:p.handle,color:p.color,body:"Quel coup dur pour "+u+"... retour en karting. On y croit encore, remontada possible "})}}}if(G.pendingTransfer){var f=G.pendingTransfer;var _prevCat=G.cat;G.cat=f.cat,G.currentTeam=f.team,(_prevCat!==f.cat&&"function"==typeof triggerAltPathArrival&&(function(){try{triggerAltPathArrival(_prevCat,f.cat)}catch(_e){}})()),G.contractDur=f.dur||1,G._playerRole=f.role||"num2",G._tm_wins_count=0,G._roleUpgradeNotified=!1;var m=CATEGORIES.indexOf(f.cat);G.totalLaps=getCatLaps(f.cat),G.revenue+=f.salary,G.pendingTransfer=null;_expireEcurieSponsors("Tu peux signer de nouveaux sponsors écurie chez "+f.team+".")}else if(e&&e.isRenewal)G.contractDur=e.dur||1,G.currentTeam=e.team||G.currentTeam,G._contractExpired=!1,G.revenue+=e.budget||0;else if(e&&e.isPendingTransfer)G.contractDur=e.dur||1,G.currentTeam=e.team||G.currentTeam;else if(e&&e.promotion&&e.nextCat){var _prevCatPromo=G.cat;G.cat=e.nextCat;if(_prevCatPromo!==e.nextCat&&"function"==typeof triggerAltPathArrival)try{triggerAltPathArrival(_prevCatPromo,e.nextCat)}catch(_e){};var g=CATEGORIES.indexOf(G.cat);G.totalLaps=getCatLaps(G.cat),e.budget<0&&(G.budget+=e.budget),e.team&&(G.currentTeam=e.team),G.contractDur=e.dur||1}else if(e&&e.isSaisonBlanche){if(G.currentTeam="Indépendant",G.contractDur=0,G._saisonBlanche=!0,gainSubStat("physique",1),gainSubStat("regularite",1),"function"==typeof pushMail&&G.agent){var h="parent"===G.agent.type,v;pushMail({from:h?G.agent.firstName||("mother"===G.agent.parentRole?"Maman":"Papa"):G.agent.name||"Ton agent",role:"agent",subject:"Saison blanche — on se reconcentre",body:h?"Mon grand, ça va être une année difficile sans volant. Mais on va en faire quelque chose : tu vas bosser ta condition physique, ta concentration, ta communication. Tu reviendras plus fort.":"Aucune offre convenable disponible. Saison blanche, c'est la dure réalité du marché. Profite pour te former physiquement et rester visible. Je continue à démarcher pour la saison d'après.",actions:[{label:"Compris, on se bouge",kind:"dismiss",responseBody:"OK, je vais utiliser ce temps à fond pour revenir plus fort."}]})}if("function"==typeof _addFeedPost&&"function"==typeof _socialFanHandle&&Math.random()<.5){var x=_socialFanHandle(),y=(G.pilot.prenom?G.pilot.prenom+" ":"")+(G.pilot.nom||"");_addFeedPost({type:"fan",author:x.name,handle:x.handle,color:x.color,body:"Saison blanche pour "+y+"... c'est rageant, on l'attendait en piste. Vivement la suivante."})}}else e&&(G.revenue+=Number(e.budget)||0,e.team&&(G.currentTeam=e.team,G.contractDur=e.dur||1));G.seasonOver=!1,G.saison++,G.gameYear=(G.gameYear||(G.pilot&&G.pilot.startYear?G.pilot.startYear+(G.saison-2):2024))+1;var b=G.age||10;if(G.age=calcPilotAge(),G.age>b){if("function"==typeof _addFeedPost&&"function"==typeof _socialFanHandle&&Math.random()<.6){var A=(G.pilot.prenom?G.pilot.prenom+" ":"")+(G.pilot.nom||""),w=_socialFanHandle();_addFeedPost({type:"fan",author:w.name,handle:w.handle,color:w.color,body:"Joyeux anniversaire à "+A+" ! "+G.age+" ans, quelle belle carrière devant toi "})}"function"!=typeof pushMail||G.agent&&"parent"===G.agent.type||pushMail({from:"Tes parents",role:"family",subject:"Joyeux anniversaire !",body:G.age+" ans déjà... On est fiers de toi, de ton parcours, de ton courage. Profite bien de ta journée et n'oublie pas de souffler. On pense fort à toi.",actions:[{label:"Merci beaucoup",kind:"dismiss",responseBody:"Merci à vous, je vous aime. On s'appelle ce soir.",effect:{type:"happiness",data:{delta:4}}}]})}if(G.semaine=1,G._scheduledEvents=[],G.preseason=null,G._lastSetupMismatch=null,TEAM_TRUST.value=Math.max(30,Math.min(70,TEAM_TRUST.value)),PILOT_MENTAL){PILOT_MENTAL.streakGood=0,PILOT_MENTAL.streakBad=0,PILOT_MENTAL.lastWinRace=-99,PILOT_MENTAL.pressure=Math.max(20,Math.min(60,.7*(PILOT_MENTAL.pressure||30)));var M=G.pilot&&G.pilot.trait,E=60;"competiteur"===M?E=65:"sangfroid"===M?E=62:"leader"===M?E=63:"perfectionniste"===M&&(E=55);var T=.3;"sangfroid"===M?T=.25:"competiteur"===M?T=.4:"perfectionniste"===M&&(T=.35);var k="number"==typeof PILOT_MENTAL.value?PILOT_MENTAL.value:E,L=k+(E-k)*T;L+=4*(Math.random()-.5),PILOT_MENTAL.value=Math.max(0,Math.min(100,Math.round(L)));var S="number"==typeof PILOT_MENTAL.confidence?PILOT_MENTAL.confidence:E,C=S+.7*T*(E-S);PILOT_MENTAL.confidence=Math.max(0,Math.min(100,Math.round(C))),PILOT_MENTAL.history||(PILOT_MENTAL.history=[]);var R=PILOT_MENTAL.value-k;Math.abs(R)>=2&&(PILOT_MENTAL.history.push({delta:Math.round(R),reason:"Intersaison — retour vers l'équilibre",value:PILOT_MENTAL.value,saison:G.saison,course:0}),PILOT_MENTAL.history.length>50&&(PILOT_MENTAL.history=PILOT_MENTAL.history.slice(-50)))}if(PLAYER_ACADEMY.id&&r&&"Indépendant"!==r&&r!==G.currentTeam){var P=getPlayerAcademy();if(P){var F=!1,B=P.affiliates||{};for(var I in B)if(B[I]&&B[I].indexOf(r)>=0){F=!0;break}F||(P.f1Team===r||P.f1Alt&&P.f1Alt.indexOf(r)>=0)&&(F=!0),F&&(PLAYER_ACADEMY.canLeave=!0,PLAYER_ACADEMY.history||(PLAYER_ACADEMY.history=[]),PLAYER_ACADEMY.history.push({delta:0,reason:"Départ de "+r+" : tu peux désormais quitter l'académie",relation:PLAYER_ACADEMY.relation,saison:G.saison}))}}if(PLAYER_ACADEMY.id&&(PLAYER_ACADEMY._pendingF1Offer=!1),generateSeasonObjectives(),TEAM_TRUST.history=[],TEAM_TRUST.weeklyChecked={},TEAM_TRUST.contextual=null,maybeGenerateContextualObjective(),G.pa=3,G.races=[],G.champPts=0,G.champPos=0,G.offers=[],G._contractExpired=!1,G._saisonBlanche=!1,G._demoted=!1,recomputeGlobalRep(),"Formule 1"===G.cat){var O=[{pts:0,me:!0}];CAREER_HISTORY.forEach(function(e){(e.current||e.saison===G.saison-1)&&(O[0].pts=e.pts)});var j=CAREER_HISTORY.filter(function(e){return!e.current}).pop();j&&1===j.pos&&(G._f1Champion=!0,G._numberChosenByPlayer||(G.pilot.number=1))}G._seasonTeam=G.currentTeam||"Indépendant","Karting Junior"===G.cat||G.currentTeam&&"Indépendant"!==G.currentTeam?(G._demoted=!1,G._saisonBlanche=!1):G._saisonBlanche?G._demoted=!1:1===newCatIdx?(G.cat="Karting Junior",G.totalLaps=getCatLaps("Karting Junior"),G._demoted=!0,G._saisonBlanche=!1):(G._saisonBlanche=!0,G._demoted=!1),Object.keys(G).filter(function(e){return e.startsWith("offer_gen_")||e.startsWith("w1_")||e.startsWith("w2_")||e.startsWith("w3_")}).forEach(function(e){delete G[e]}),PRIZE_HISTORY=[],REP_EVENTS_PENDING=[],SOCIAL_LAST_WEEK=-99,LS_ACTIVITY_USED={},G.sponsors&&(G.sponsors.forEach(function(e){"number"==typeof e.weeksLeft&&(e.dur=Math.max(1,Math.ceil(e.weeksLeft/48)))}),G.revenue=G.sponsors.reduce(function(e,t){return e+(t.fee||0)},0)),G.currentTeam&&"Indépendant"!==G.currentTeam&&G.contractDur>0?G.contractWeeksLeft=48*G.contractDur:G.contractWeeksLeft=0;if(typeof _progressDriverPool==="function")try{_progressDriverPool()}catch(_eP){console.warn("[RJ] _progressDriverPool failed:",_eP)}if(typeof _handleDriverMovements==="function")try{_handleDriverMovements()}catch(_eM){console.warn("[RJ] _handleDriverMovements failed:",_eM)}initRivals();G.rivals.forEach(function(e){e.pts=0;e.qualiHistory=[];e.raceHistory=[]}),gainSubStat("physique",2),gainSubStat("regularite",1),CAL_RACES=[],buildCalendar(),initTeamRatings(G.cat,G.saison);try{"function"==typeof initAllStaff&&initAllStaff(G.cat)}catch(e){}if(updateUI(),renderChamp(),renderOffers(),n&&n!==G.cat&&CATEGORIES.indexOf(G.cat)>CATEGORIES.indexOf(n)){var D=(G.pilot.prenom?G.pilot.prenom+" ":"")+(G.pilot.nom||""),N="Formule 1"===G.cat;if("function"==typeof _addFeedPost&&void 0!==SOCIAL_PRESS_ACCOUNTS){var H=N?3:2;SOCIAL_PRESS_ACCOUNTS.slice(0,H).forEach(function(e,t){var r;r=N?0===t?"️ F1 — "+D+" rejoint l'élite mondiale ! Un rêve qui se concrétise.":1===t?"De "+n+" à la Formule 1 : le parcours de "+D+" décrypté.":D+" face au Graal : premiers GP en F1. Va-t-il tenir la pression ?":0===t?"️ "+D+" découvre la "+G.cat+" cette saison. Un cap important dans son parcours.":"De "+n+" à "+G.cat+" : "+D+" passe à la vitesse supérieure. Analyse de ses chances.",_addFeedPost({type:"press",author:e.name,handle:e.handle,color:e.color,body:r})})}if(N&&"function"==typeof _addFeedPost){var z=G.pilot.igHandle||(G.pilot.prenom||"pilote").toLowerCase().replace(/[^a-z0-9]/g,"");_addFeedPost({type:"player",author:D,handle:"@"+z,color:"#E81030",body:"JE SUIS EN FORMULE 1 ️ Petit gamin à moi-même : on y est. Merci à tous ceux qui m'ont accompagné jusqu'ici. La vraie aventure commence.",isPlayer:!0})}if("function"==typeof pushMail&&G.agent){var i,o=(i="parent"===G.agent.type)?G.agent.firstName||("mother"===G.agent.parentRole?"Maman":"Papa"):G.agent.name||"Ton agent",V=N?i?"Mon grand, la F1... je réalise pas. Ce qu'on a construit ensemble depuis le karting t'a mené ici. Reste humble, reste toi-même. Je suis derrière toi à chaque virage.":"Formule 1. Le niveau absolu. Ton image, tes sponsors, ta pression — tout change d'un coup. On va caler des interviews, on va revoir les termes avec plusieurs marques. C'est maintenant que ton capital carrière se construit. Reste focus pilotage.":i?"Mon grand, "+G.cat+" ! Tu réalises ? Étape cruciale, ne te mets pas la pression inutile. On y va tranquillement, un week-end à la fois.":"Étape majeure : "+G.cat+". Le niveau de bruit médiatique va augmenter, ton image aussi. Reste focus. Les sponsors vont monter en gamme en conséquence.";pushMail({from:o,role:"agent",subject:N?"️ La Formule 1 !":"Direction "+G.cat+" !",body:V,actions:[{label:"Merci, j'ai hâte",kind:"dismiss",responseBody:N?"Merci. C'est le moment que j'attendais depuis que j'ai 8 ans.":"Merci. Ça va être intense mais je suis prêt."}]})}}"Formule 4"!==G.cat||!G.agent||"parent"!==G.agent.type||G._agentUpgradeOffered?navTo("S-preseason","ni-more"):triggerAgentUpgradePrompt()}var SAVE_KEYS=["rj_s1","rj_s2","rj_s3"];
function exportSaveData(){try{var allSlots={};SAVE_KEYS.forEach(function(k,i){var data=localStorage.getItem(k);if(data){try{allSlots["slot_"+i]=JSON.parse(data)}catch(e){}}});var slotCount=Object.keys(allSlots).length;if(slotCount===0){if(typeof showAlertDialog==="function")showAlertDialog({title:"Aucune sauvegarde",message:"Tu n'as pas encore de sauvegarde à exporter.",variant:"info"});return false}var settings=null;try{var s=localStorage.getItem("rj_settings");if(s)settings=JSON.parse(s)}catch(e){}var bundle={_meta:{exported:new Date().toISOString(),app:"Racing Journey: F1 Dreams",version:"1.0",slots:slotCount},slots:allSlots,settings:settings};var json=JSON.stringify(bundle,null,2);var blob=new Blob([json],{type:"application/json"});var url=URL.createObjectURL(blob);var pilotName="export";try{if(G&&G.pilot){pilotName=((G.pilot.prenom||"")+"_"+(G.pilot.nom||"")).replace(/[^a-zA-Z0-9_]/g,"").substring(0,30)||"pilot"}}catch(e){}var stamp=new Date().toISOString().slice(0,10);var filename="racing_journey_"+pilotName+"_"+stamp+".json";var a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();setTimeout(function(){if(a.parentNode)a.parentNode.removeChild(a);URL.revokeObjectURL(url)},150);if(typeof pushHomeToast==="function")pushHomeToast(" Sauvegarde exportée",filename,"#34D399");else if(typeof showToast==="function")showToast(" Sauvegarde exportée");return true}catch(e){console.error("exportSaveData:",e);if(typeof showAlertDialog==="function")showAlertDialog({title:"Erreur d'export",message:"Impossible d'exporter: "+(e.message||"erreur inconnue"),variant:"error"});return false}}
function importSaveData(){try{var input=document.createElement("input");input.type="file";input.accept=".json,application/json";input.style.display="none";input.addEventListener("change",function(ev){var file=ev.target.files&&ev.target.files[0];if(!file){if(input.parentNode)document.body.removeChild(input);return}var reader=new FileReader();reader.onload=function(e){try{var bundle=JSON.parse(e.target.result);if(!bundle||!bundle.slots){throw new Error("Format de fichier invalide")}var slotsAvail=Object.keys(bundle.slots).filter(function(k){return bundle.slots[k]});if(slotsAvail.length===0){throw new Error("Aucune sauvegarde dans le fichier")}var msg="Cette opération va remplacer tes sauvegardes actuelles.<br><br><strong>Fichier détecté :</strong><br>";if(bundle._meta&&bundle._meta.exported){msg+="• Exporté le : "+new Date(bundle._meta.exported).toLocaleDateString("fr-FR")+"<br>"}msg+="• "+slotsAvail.length+" sauvegarde(s) :<br>";slotsAvail.forEach(function(k){var s=bundle.slots[k];var name="?";if(s&&s.pilot){name=((s.pilot.prenom||"")+" "+(s.pilot.nom||"")).trim()||"?"}msg+="&nbsp;&nbsp;◦ "+name+" ("+(s&&s.cat||"?")+", S"+(s&&s.saison||"?")+")<br>"});msg+="<br>Continuer ?";if(typeof showConfirmDialog==="function"){showConfirmDialog({title:"Importer la sauvegarde ?",message:msg,confirmLabel:"Importer",cancelLabel:"Annuler",variant:"warning",onConfirm:function(){_applyImportedBundle(bundle)}})}else{var plain=msg.replace(/<[^>]+>/g,"\n");if(confirm(plain))_applyImportedBundle(bundle)}}catch(err){console.error("import parse:",err);if(typeof showAlertDialog==="function")showAlertDialog({title:"Fichier invalide",message:"Impossible de lire ce fichier : "+(err.message||"format inconnu"),variant:"error"});else alert("Fichier invalide")}};reader.readAsText(file);if(input.parentNode)document.body.removeChild(input)});document.body.appendChild(input);input.click();return true}catch(e){console.error("importSaveData:",e);return false}}
function _applyImportedBundle(bundle){try{var imported=0;Object.keys(bundle.slots).forEach(function(k){var match=k.match(/^slot_(\d+)$/);if(match){var idx=parseInt(match[1],10);if(idx>=0&&idx<SAVE_KEYS.length&&bundle.slots[k]){localStorage.setItem(SAVE_KEYS[idx],JSON.stringify(bundle.slots[k]));imported++}}});if(bundle.settings){try{localStorage.setItem("rj_settings",JSON.stringify(bundle.settings))}catch(e){}}var doReload=function(){if(typeof location!=="undefined"&&location.reload){try{location.reload()}catch(e){}}};if(typeof showAlertDialog==="function"){showAlertDialog({title:" Import réussi",message:imported+" sauvegarde(s) importée(s). Le jeu va recharger.",variant:"success",onClose:doReload});setTimeout(doReload,4000);}else{alert(imported+" sauvegarde(s) importée(s). Le jeu va recharger.");setTimeout(doReload,400);}}catch(e){console.error("_applyImportedBundle:",e);if(typeof showAlertDialog==="function")showAlertDialog({title:"Erreur d'import",message:"Impossible d'appliquer l'import : "+(e.message||"erreur inconnue"),variant:"error"});}}
function getSave(e){try{var t=localStorage.getItem(SAVE_KEYS[e]);return t?JSON.parse(t):null}catch(e){return null}}function saveGame(e){void 0===e&&(e=G._slot||0);try{localStorage.setItem(SAVE_KEYS[e],JSON.stringify({pilot:G.pilot,substats:G.substats||{},stats:G.stats,rep:G.rep,budget:G.budget,revenue:G.revenue,reputation:G.reputation,saison:G.saison,semaine:G.semaine,pa:G.pa,champPts:G.champPts,age:G.age,gameYear:G.gameYear||G.pilot.startYear||2024,cat:G.cat,races:G.races,offers:G.offers,totalLaps:G.totalLaps,rivals:G.rivals.map(function(e){return{pts:e.pts,qualiHistory:e.qualiHistory||[],raceHistory:e.raceHistory||[],careerHistory:e.careerHistory||[]}}),calRaces:CAL_RACES.map(function(e){return{done:e.done,result:e.result}}),owned:G.owned||[],happiness:G.happiness||50,igFollowers:G.igFollowers||0,currentTeam:G.currentTeam||"Indépendant",seasonTeam:G._seasonTeam||G.currentTeam||"Indépendant",careerHistory:CAREER_HISTORY.map(function(e){return{saison:e.saison,cat:e.cat,pos:e.pos,pts:e.pts,races:e.races,wins:e.wins,pods:e.pods,top5:e.top5||0,dnfs:e.dnfs||0,poles:e.poles||0,age:e.age,rating:e.rating,team:e.team||"Indépendant",constrChamp:e.constrChamp||null,number:e.number||23,raceDetails:(e.raceDetails||[]).map(function(r){return{nom:r.nom,pos:r.pos,pts:r.pts,detail:r.detail,pole:r.pole,tmPos:r.tmPos,qualiPos:r.qualiPos||0,circuit:r.circuit||"",weather:r.weather||"dry",bestLap:r.bestLap||null,playerBestLap:r.playerBestLap||null,saison:r.saison,cat:r.cat}})}}),rivalCareerRegistry:(typeof RIVAL_CAREER_REGISTRY!=="undefined"?RIVAL_CAREER_REGISTRY:{}),f1Champion:G._f1Champion||!1,playerAcademy:{id:PLAYER_ACADEMY.id,relation:PLAYER_ACADEMY.relation,canLeave:PLAYER_ACADEMY.canLeave||!1,f1Offer:PLAYER_ACADEMY.f1Offer||!1},teamTrust:TEAM_TRUST.value||50,pilotMental:PILOT_MENTAL||null,setupAdv:G.setupAdv||null,stratAdv:G.stratAdv||null,unseenSponsors:G._unseenSponsors||[],sponsorOffers:G.sponsorOffers||[],dismissedNotifs:G._dismissedNotifs||[],contractDur:G.contractDur||0,contractWeeksLeft:G.contractWeeksLeft||0,paddockPass:!!G.paddockPass,rivalries:G._rivalries||[],rivPosHistory:G._rivPosHistory||{},mailbox:G.mailbox||[],decisions:G.decisions||[],entityMemory:G._entityMemory||{},relations:G.relations||null,training:G.training||null,wowMoments:G._wowMoments||[],mediaState:G.mediaState||null,preseason:G.preseason||null,majorWins:G._majorWins||[],playerRole:G._playerRole||"num2",tmWinsCount:G._tm_wins_count||0,roleUpgradeNotified:G._roleUpgradeNotified||!1,pendingTransfer:G.pendingTransfer||null,seasonOver:G.seasonOver||!1,scheduledEvents:G._scheduledEvents||[],agent:G.agent||null,agentUpgradeOffered:G._agentUpgradeOffered||!1,contacts:G._contacts||{},firstMilestones:G._firstMilestones||{},unlockedAchievements:G._unlockedAchievements||{},unlockedCodes:G._unlockedCodes||{},houseKeepingUnlocked:!!G._houseKeepingUnlocked,adminMode:!!G._adminMode,noDnf:!!G._noDnf,igMilestones:G._igMilestones||{},hadSponsor:!!G._hadSponsor,repAxeMilestones:G._repAxeMilestones||{},careerRecords:G._careerRecords||{},budgetWarned:!!G._budgetWarned,contractExpiryWarned:!!G._contractExpiryWarned,imageCrisisWarned:!!G._imageCrisisWarned,savedAt:Date.now(),driverPool:G.driverPool||null})),G._slot=e,showFb("save-fb","ok","Sauvegarde OK","Emplacement "+(e+1)+" mis a jour.")}catch(e){showFb("save-fb","err","Erreur","Impossible de sauvegarder.")}}function _autoSaveOnRaceEnd(){try{if(!SETTINGS||!SETTINGS.autoSaveAfterRace)return;if(void 0===G._slot||null===G._slot)return;var e=G._slot,t="function"==typeof showFb?showFb:null;if(t){window.showFb=function(){};try{saveGame(e)}finally{window.showFb=t}}else saveGame(e);console.log("[autosave] saved to slot "+(e+1))}catch(e){console.warn("_autoSaveOnRaceEnd failed:",e)}}function _autoSaveOnSeasonEnd(){try{if(!SETTINGS||!SETTINGS.autoSaveAfterSeason)return;if(void 0===G._slot||null===G._slot)return;var e=G._slot,t="function"==typeof showFb?showFb:null;if(t){window.showFb=function(){};try{saveGame(e)}finally{window.showFb=t}}else saveGame(e);console.log("[autosave] season end → saved to slot "+(e+1)),"function"==typeof showToast&&showToast("Saison sauvegardée automatiquement","success")}catch(e){console.warn("_autoSaveOnSeasonEnd failed:",e)}}function loadSave(e){try{var t=getSave(e);if(t){if(Object.assign(G,{pilot:t.pilot,stats:t.stats,rep:t.rep,budget:t.budget,revenue:t.revenue,reputation:t.reputation,saison:t.saison,semaine:t.semaine,pa:t.pa,champPts:t.champPts,age:t.age,cat:t.cat,races:t.races,offers:t.offers||[],totalLaps:t.totalLaps,_slot:e}),t.f1Champion&&(G._f1Champion=!0),G.pilot.number||(G.pilot.number=23),G.gameYear=t.gameYear||(G.pilot&&G.pilot.startYear?G.pilot.startYear+(t.saison-1):2024),t.playerAcademy&&t.playerAcademy.id?(PLAYER_ACADEMY.id=t.playerAcademy.id,PLAYER_ACADEMY.relation=t.playerAcademy.relation||30,PLAYER_ACADEMY.canLeave=!!t.playerAcademy.canLeave,PLAYER_ACADEMY.f1Offer=!!t.playerAcademy.f1Offer):(PLAYER_ACADEMY.id=null,PLAYER_ACADEMY.relation=0,PLAYER_ACADEMY.canLeave=!1,PLAYER_ACADEMY.f1Offer=!1),void 0!==t.teamTrust?TEAM_TRUST.value=t.teamTrust:TEAM_TRUST.value=50,t.pilotMental)PILOT_MENTAL={value:t.pilotMental.value||60,confidence:t.pilotMental.confidence||60,pressure:t.pilotMental.pressure||30,streakGood:t.pilotMental.streakGood||0,streakBad:t.pilotMental.streakBad||0,lastWinRace:void 0!==t.pilotMental.lastWinRace?t.pilotMental.lastWinRace:-99,history:t.pilotMental.history||[]};else{var r=60,n=t.pilot&&t.pilot.trait;"competiteur"===n?r=65:"sangfroid"===n?r=62:"perfectionniste"===n?r=55:"leader"===n&&(r=63),PILOT_MENTAL={value:r,confidence:r,pressure:30,streakGood:0,streakBad:0,lastWinRace:-99,history:[]}}var a={aileron_av:5,aileron_ar:5,antiroulis_av:5,antiroulis_ar:5,carrossage:5,suspension:5,pression_pneus:5,differentiel:5,repartition_frein:5};t.setupAdv?G.setupAdv=Object.assign({},a,t.setupAdv):G.setupAdv=a,t.stratAdv?G.stratAdv=Object.assign({agress_debut:5,agress_fin:5,gestion_pneus:5,depassement:5},t.stratAdv):G.stratAdv={agress_debut:5,agress_fin:5,gestion_pneus:5,depassement:5},G._unseenSponsors=t.unseenSponsors||[],G.sponsorOffers=t.sponsorOffers||[],G._dismissedNotifs=t.dismissedNotifs||[],"function"==typeof ensureContractWeeks&&ensureContractWeeks(),generateSeasonObjectives(),G.rivals=[],G.owned=t.owned||[],G.happiness=t.happiness||50,G.igFollowers=t.igFollowers||0,G.contractDur=t.contractDur||0,G.contractWeeksLeft=t.contractWeeksLeft||0,G.paddockPass=!!t.paddockPass,G._rivalries=t.rivalries||[],G._rivPosHistory=t.rivPosHistory||{},G.mailbox=t.mailbox||[],G.decisions=t.decisions||[],G._entityMemory=t.entityMemory||{},G.relations=t.relations||null,G.training=t.training||null,G._wowMoments=t.wowMoments||[],G.mediaState=t.mediaState||null,G.preseason=t.preseason||null,G._majorWins=t.majorWins||[],G.currentTeam=t.currentTeam||"Indépendant",G.pendingTransfer=t.pendingTransfer||null,G._playerRole=t.playerRole||"num2",G._tm_wins_count=t.tmWinsCount||0,G._roleUpgradeNotified=t.roleUpgradeNotified||!1,G.seasonOver=t.seasonOver||!1,G._scheduledEvents=t.scheduledEvents||[],G.agent=t.agent||null,G._agentUpgradeOffered=t.agentUpgradeOffered||!1,G._contacts=t.contacts||{},G._firstMilestones=t.firstMilestones||{},G._unlockedAchievements=t.unlockedAchievements||{},G._unlockedCodes=t.unlockedCodes||{},G._houseKeepingUnlocked=!!t.houseKeepingUnlocked,G._adminMode=!!t.adminMode,G._noDnf=!!t.noDnf,G._igMilestones=t.igMilestones||{},G._hadSponsor=!!t.hadSponsor,G._repAxeMilestones=t.repAxeMilestones||{},G._careerRecords=t.careerRecords||{},G._budgetWarned=!!t.budgetWarned,G._contractExpiryWarned=!!t.contractExpiryWarned,G._imageCrisisWarned=!!t.imageCrisisWarned,t.substats?G.substats=t.substats:(G.substats=initSubStats(G.pilot.style||"complet",G.pilot.trait||"analyste"),computeLegacyStats()),CAREER_HISTORY=(t.careerHistory||[]).map(function(e){return Object.assign({raceDetails:[]},e)}),RIVAL_CAREER_REGISTRY=t.rivalCareerRegistry||{},G._seasonTeam=t.seasonTeam||t.currentTeam||"Indépendant",initRivals(),t.rivals&&t.rivals.forEach(function(e,t){G.rivals[t]&&(G.rivals[t].pts=e.pts||0,G.rivals[t].qualiHistory=e.qualiHistory||[],G.rivals[t].raceHistory=e.raceHistory||[],G.rivals[t].careerHistory=e.careerHistory||[])}),CAL_RACES=[],buildCalendar(),t.calRaces&&t.calRaces.forEach(function(e,t){CAL_RACES[t]&&(CAL_RACES[t].done=e.done,CAL_RACES[t].result=e.result)}),G.seasonOver=!1,G.raceLocked=false,G.racePhase="",updateUI(),renderChamp(),renderOffers(),renderHomeEvents(),(G.driverPool=t.driverPool||G.driverPool||null,((!G.driverPool||!Object.keys(G.driverPool).length)&&typeof _initDriverPool==="function"&&_initDriverPool()));if(typeof applyRaceLockUI==="function")applyRaceLockUI();navTo("S-home","ni-home")}}catch(loadErr){console.error("[RJ] loadSave failed for slot",e,":",loadErr);try{if(typeof pushHomeToast==="function"){pushHomeToast("Erreur","Impossible de charger cette sauvegarde. Détail dans la console.","#EF4444");}else{alert("Erreur lors du chargement de la sauvegarde\n\n"+(loadErr&&loadErr.message?loadErr.message:loadErr));}}catch(_){}try{G._slot=null;G._loadFailedAt=Date.now();}catch(_){}}}function renderSaveSlots(){var e=document.getElementById("save-slots");e&&(e.innerHTML="",SAVE_KEYS.forEach(function(t,r){var n=getSave(r),a=document.createElement("div"),i,o,s;if(n){var l=n.pilot&&n.pilot.nom||"Pilote",c=n.savedAt?new Date(n.savedAt).toLocaleDateString("fr-FR",{day:"2-digit",month:"short"}):"";a.style.cssText="border:1px solid var(--border);border-radius:12px;margin-bottom:8px;background:var(--surface2);overflow:hidden";var d=document.createElement("div");d.style.cssText="display:flex;align-items:center;gap:10px;padding:11px 14px",d.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" style="flex-shrink:0;color:var(--text3)"><path d="M4 15V5l4 4 4-4 4 4 4-4v10"/><line x1="4" y1="19" x2="4" y2="15"/></svg><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+l+'</div><div style="font-size:11px;color:var(--text3)">S'+(n.saison||1)+" · "+(n.cat||"Karting")+(c?" · "+c:"")+"</div></div>";var p=document.createElement("button");p.textContent="Jouer",p.style.cssText="padding:6px 10px;background:var(--red);color:#fff;border:none;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;flex-shrink:0";var u=document.createElement("button");u.textContent="×",u.style.cssText="padding:6px 8px;background:none;border:1px solid var(--border);border-radius:7px;font-size:12px;cursor:pointer;color:var(--text3);font-family:inherit;flex-shrink:0;margin-left:4px",d.appendChild(p),d.appendChild(u),a.appendChild(d);var f=document.createElement("div");f.style.cssText="display:none;align-items:center;gap:8px;padding:8px 14px;background:#1a0000;border-top:1px solid #DC2626",f.innerHTML='<span style="flex:1;font-size:12px;color:#FCA5A5">Supprimer cette sauvegarde ?</span>';var m=document.createElement("button");m.textContent="Supprimer",m.style.cssText="padding:5px 10px;background:#DC2626;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit";var g=document.createElement("button");g.textContent="Annuler",g.style.cssText="padding:5px 8px;background:none;border:1px solid #555;color:#aaa;border-radius:6px;font-size:11px;cursor:pointer;font-family:inherit",f.appendChild(m),f.appendChild(g),a.appendChild(f),i=r,o=f,s=d,p.addEventListener("click",function(){loadSave(i)}),u.addEventListener("click",function(e){e.stopPropagation(),o.style.display="flex",s.style.opacity="0.5"}),g.addEventListener("click",function(e){e.stopPropagation(),o.style.display="none",s.style.opacity="1"}),m.addEventListener("click",function(e){e.stopPropagation();try{localStorage.removeItem(SAVE_KEYS[i])}catch(e){}renderSaveSlots()})}else a.style.cssText="display:flex;align-items:center;gap:10px;padding:11px 14px;border:1px dashed var(--border);border-radius:12px;margin-bottom:8px;opacity:.6",a.innerHTML='<div style="font-size:20px;color:var(--text3)">+</div><div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--text3)">Emplacement '+(r+1)+'</div><div style="font-size:11px;color:var(--text3)">Vide</div></div>';e.appendChild(a)}))}function showSaveMenu(){var e=document.getElementById("save-menu-slots");if(e){e.innerHTML="",SAVE_KEYS.forEach(function(t,r){var n=getSave(r),a=document.createElement("button");a.className="btn btn-sec",a.style.cssText="margin-bottom:8px;text-align:left;padding:11px 14px;width:100%";var i=n?n.pilot.nom+" — S"+(n.saison||1)+" "+n.cat:"Emplacement "+(r+1)+" (vide)",o;a.textContent=""+i,o=r,a.onclick=function(){saveGame(o),closeSaveMenu()},e.appendChild(a)}),document.querySelectorAll(".scr").forEach(function(e){e.classList.remove("on")});var t=document.getElementById("S-save");t&&t.classList.add("on"),document.getElementById("main-nav").classList.remove("show")}}function closeSaveMenu(){navTo("S-home","ni-home")}function _expireEcurieSponsors(reason){
 if(!G.sponsors||G.sponsors.length===0)return 0;
 var pool=(typeof getSponsorPool==='function')?getSponsorPool():[];
 var poolMap={};pool.forEach(function(s){poolMap[s.id]=s;});
 var expired=[];
 G.sponsors=G.sponsors.filter(function(s){
  var def=poolMap[s.id];
  if(def&&def.sponsorKind==='ecurie'){
   expired.push(s);
   return false;
  }
  return true;
 });
 if(expired.length>0){
  if(typeof pushMail==='function'){
   var names=expired.map(function(s){return s.name;}).join(', ');
   pushMail({
    role:'sponsor',
    from:'Sponsors écurie',
    subject:'Fin du partenariat',
    body:'Suite à ton changement d\'écurie, tes sponsors liés à ton ancienne équipe ont mis fin à leurs contrats : <strong>'+names+'</strong>.<br><br>'+(reason||'Tu peux signer de nouveaux sponsors écurie une fois installé(e).')
   });
  }
  if(typeof showToast==='function'){
   showToast(expired.length+' sponsor'+(expired.length>1?'s':'')+' écurie résiliés');
  }
  // Reduce revenue
  G.revenue=(G.revenue||0)-expired.reduce(function(t,s){return t+(s.fee||0);},0);
 }
 return expired.length;
}
function getSponsorPool(){
 var catTier={"Karting Junior":0,"Karting Senior":1,"Formule 4":2,"Formula Regional":3,"Formule 3":4,"Formule 2":5,"Formule 1":6,"Super Formula":5,"Endurance WEC":5,IndyCar:6};
 var t=Math.pow(1.7,catTier[G.cat]||0);
 var raw=[
  // === EQUIPEMENT (low rep, accessible early) ===
  {id:"lokki",name:"Lokki Casques",sponsorKind:"equipement",type:"equipement",repReq:0,baseFee:200,perf:50,dur:1,desc:"Équipementier casque junior. Petit budget mais accessible."},
  {id:"alpinegear",name:"AlpinGear Combi",sponsorKind:"equipement",type:"equipement",repReq:5,baseFee:280,perf:60,dur:1,desc:"Combinaisons et gants. Idéal pour un jeune pilote."},
  {id:"footstep",name:"Footstep Bottes",sponsorKind:"equipement",type:"equipement",repReq:10,baseFee:220,perf:50,dur:1,desc:"Bottes de pilotage. Petit cachet, équipement gratuit."},
  {id:"hxgrip",name:"HX Grip Gants",sponsorKind:"equipement",type:"equipement",repReq:15,baseFee:350,perf:70,dur:1,desc:"Marque de gants haute performance."},
  {id:"shieldhelm",name:"Shield Helmets Pro",sponsorKind:"equipement",type:"equipement",repReq:30,baseFee:1200,perf:300,dur:2,desc:"Casques pro carbone. Visibilité internationale."},
  
  // === PILOTE (personal sponsors, mid-tier rep) ===
  {id:"velox",name:"Velox Energy",sponsorKind:"pilote",type:"boisson",repReq:20,baseFee:400,perf:100,dur:1,desc:"Marque énergie. Bonus si podiums réguliers."},
  {id:"tracksync",name:"TrackSync App",sponsorKind:"pilote",type:"tech",repReq:25,baseFee:300,perf:80,dur:2,desc:"App de data. Visibilité sur les réseaux sociaux."},
  {id:"alphafit",name:"AlphaFit Sportswear",sponsorKind:"pilote",type:"sport",repReq:30,baseFee:600,perf:150,dur:2,desc:"Marque sportswear. Exposition réseaux sociaux."},
  {id:"motovest",name:"MotoVest Capital",sponsorKind:"pilote",type:"finance",repReq:35,baseFee:800,perf:200,dur:1,desc:"Fond d\'investissement motorsport. Exige bons résultats."},
  {id:"bluepeak",name:"BluePeak Watches",sponsorKind:"pilote",type:"luxe",repReq:40,baseFee:900,perf:220,dur:1,desc:"Horlogerie suisse. Apparition obligatoire en interview."},
  {id:"voltride",name:"VoltRide Bikes",sponsorKind:"pilote",type:"sport",repReq:42,baseFee:700,perf:180,dur:2,desc:"Vélos électriques. Image sportif urbain."},
  {id:"precisiontech",name:"PrecisionTech Pro",sponsorKind:"pilote",type:"tech",repReq:50,baseFee:1500,perf:400,dur:1,desc:"Fabricant électronique. Catégorie F4+."},
  {id:"mediasport",name:"MediaSport TV",sponsorKind:"pilote",type:"media",repReq:55,baseFee:2000,perf:500,dur:2,desc:"Chaîne sport. Visibilité nationale, obligations média."},
  {id:"helitalia",name:"Helitalia Lunettes",sponsorKind:"pilote",type:"mode",repReq:48,baseFee:1100,perf:280,dur:2,desc:"Lunettes de soleil de marque. Style et image."},
  {id:"airwave",name:"AirWave Audio",sponsorKind:"pilote",type:"tech",repReq:52,baseFee:1300,perf:320,dur:2,desc:"Casques audio. Sponsor jeunes générations."},
  
  // === ECURIE (tied to current team — auto-expires if you switch) ===
  {id:"techfront",name:"TechFront Performance",sponsorKind:"ecurie",type:"tech",repReq:40,baseFee:2200,perf:600,dur:1,desc:"Partenaire tech de ton écurie. Cesse si tu changes d\'équipe."},
  {id:"globalfuel",name:"Global Fuel",sponsorKind:"ecurie",type:"energie",repReq:45,baseFee:3000,perf:800,dur:1,desc:"Pétrolier international. Lié à ton écurie actuelle."},
  {id:"steelcorp",name:"SteelCorp Industries",sponsorKind:"ecurie",type:"industrie",repReq:50,baseFee:3500,perf:900,dur:2,desc:"Sidérurgiste. Partenaire technique de ton équipe."},
  {id:"voltris",name:"Voltris Énergie",sponsorKind:"ecurie",type:"energie",repReq:55,baseFee:4000,perf:1100,dur:2,desc:"Fournisseur électricité. Lié à l\'écurie, image éco."},
  {id:"aerospan",name:"AeroSpan Aviation",sponsorKind:"ecurie",type:"industrie",repReq:60,baseFee:5500,perf:1500,dur:2,desc:"Aéronautique. Partenariat stratégique de ton équipe."},
  {id:"nexgen",name:"NexGen Motors",sponsorKind:"ecurie",type:"auto",repReq:60,baseFee:5000,perf:1500,dur:2,desc:"Constructeur auto. Réservé aux pilotes établis dans une écurie."},
  {id:"hyperion",name:"Hyperion Racing",sponsorKind:"ecurie",type:"auto",repReq:75,baseFee:12000,perf:4000,dur:2,desc:"Écurie constructeur. Partenariat lié à ton team."},
  
  // === AMBASSADEUR (high-stakes, long-term, prestige) ===
  {id:"titanium",name:"Titanium Finance",sponsorKind:"ambassadeur",type:"finance",repReq:70,baseFee:8000,perf:2500,dur:3,desc:"Hedge fund. Ambassadeur longue durée, exigences élevées."},
  {id:"omegaroyal",name:"Omega Royal",sponsorKind:"ambassadeur",type:"luxe",repReq:78,baseFee:15000,perf:5000,dur:3,desc:"Horlogerie de luxe. Ambassadeur officiel, événements obligatoires."},
  {id:"f1style",name:"F1 Style Brand",sponsorKind:"ambassadeur",type:"mode",repReq:85,baseFee:20000,perf:8000,dur:3,desc:"Marque de luxe liée à la F1. Réservé aux stars."},
  {id:"orientline",name:"Orient Line Airlines",sponsorKind:"ambassadeur",type:"voyage",repReq:80,baseFee:18000,perf:6000,dur:3,desc:"Compagnie aérienne premium. Ambassadeur monde entier."},
  {id:"elysiumcars",name:"Elysium Hypercars",sponsorKind:"ambassadeur",type:"auto",repReq:88,baseFee:25000,perf:10000,dur:3,desc:"Hypercars d\'exception. Ambassadeur élite."},
  {id:"crystalmoet",name:"Crystal Moët",sponsorKind:"ambassadeur",type:"luxe",repReq:82,baseFee:17000,perf:5500,dur:3,desc:"Champagne de prestige. Présence obligatoire podiums et galas."},
  {id:"summitparis",name:"Summit Paris Couture",sponsorKind:"ambassadeur",type:"mode",repReq:90,baseFee:28000,perf:11000,dur:2,desc:"Haute couture. Réservé aux icônes mondiales."},
  {id:"galaxywatch",name:"Galaxy Watch Geneva",sponsorKind:"ambassadeur",type:"luxe",repReq:92,baseFee:32000,perf:12000,dur:3,desc:"Horlogerie genevoise sur-mesure. Status absolu."}
 ];
 return raw.map(function(e){
  return{
   id:e.id,
   name:e.name,
   sponsorKind:e.sponsorKind,
   type:e.type,
   repReq:e.repReq,
   fee:100*Math.round(e.baseFee*t/100),
   perfBonus:100*Math.round(e.perf*t/100),
   dur:e.dur,
   desc:e.desc
  };
 });
}function ctab(e){if(["offres","primes","reseau"].forEach(function(t){var r=document.getElementById("ct-"+t);r&&(r.style.display=t===e?"block":"none")}),document.querySelectorAll("#S-contracts .tab").forEach(function(t){t.classList.toggle("on",t.getAttribute("data-tab")===e)}),"primes"===e&&renderPrimes(),"reseau"===e&&renderReseau(),"offres"===e){renderOffers();var t=document.getElementById("ct-budget"),r=document.getElementById("ct-revenue");t&&(t.textContent=G.budget.toLocaleString("fr-FR")+" e"),r&&(r.textContent=(G.revenue>0?"+":"")+G.revenue.toLocaleString("fr-FR")+" e/mois")}}function renderReseau(){var e=document.getElementById("reseau-content");if(e){var t="function"==typeof getNetworkList?getNetworkList():[],r="";if(r+='<div style="margin:12px 14px 0;padding:11px 13px;border:1px solid var(--line);border-left:2px solid var(--red2);background:var(--bg3);font-size:12.5px;color:var(--soft);line-height:1.5;font-family:var(--font-body)">Toutes les personnes du métier que tu as rencontrées. Plus ta relation est forte, plus ils peuvent t\'ouvrir des portes.</div>',0===t.length)return r+='<div style="margin:20px 14px;padding:24px 16px;border:1px dashed var(--line2);background:var(--bg3);text-align:center">',r+='<div style="display:flex;justify-content:center;margin-bottom:8px;opacity:.35">'+renderIcon("handshake",36,"var(--soft)")+'</div>',r+='<div style="font-family:var(--font-display);font-size:11px;font-weight:800;color:var(--soft);letter-spacing:.14em;text-transform:uppercase;margin-bottom:6px">Ton réseau est vide</div>',r+='<div style="font-size:12px;color:var(--muted);line-height:1.5;font-family:var(--font-body)">Participe à des événements, rencontre des gens via ton agent, travaille avec un staff d\'écurie. Chaque interaction enrichit ton réseau.</div>',r+="</div>",void(e.innerHTML=r);var n=t.filter(function(e){return e.relation>=70}).length,a=t.filter(function(e){return e.relation<40}).length;r+='<div class="mg" style="margin-top:10px">',r+='<div class="mc"><div class="mc-l">Contacts</div><div class="mc-v">'+t.length+"</div></div>",r+='<div class="mc"><div class="mc-l">Alliés solides</div><div class="mc-v" style="color:var(--green)">'+n+"</div></div>",r+="</div>";var i={tp:{label:"Team Principals",entries:[]},dir_tech:{label:"Directeurs Techniques",entries:[]},dir_sport:{label:"Directeurs Sportifs",entries:[]},ing_course:{label:"Ingénieurs de course",entries:[]},other:{label:"Autres contacts",entries:[]}};t.forEach(function(e){i[e.role]?i[e.role].entries.push(e):i.other.entries.push(e)}),Object.keys(i).forEach(function(e){var t=i[e];t.entries.length&&(r+='<div class="t-sec">'+t.label+" · "+t.entries.length+"</div>",t.entries.forEach(function(e){r+=_renderReseauEntry(e)}))}),e.innerHTML=r}}function _renderReseauEntry(e){var t=e.relation>=75?"var(--green)":e.relation>=55?"#22D3EE":e.relation>=35?"var(--amber)":"var(--red3)",r=e.relation>=80?"Très proche":e.relation>=65?"Solide":e.relation>=50?"Cordial":e.relation>=35?"Distant":"Froid",n=e.lastSeen||{saison:1,week:1},a=50*((G.saison||1)-n.saison)+((G.semaine||1)-n.week),i=0===a?"Cette semaine":a<=3?"Il y a "+a+" sem.":a<=8?"Récemment":a<=20?"Il y a longtemps":"Perdu de vue",o="color-mix(in srgb,"+(e.color||"#60A5FA")+" 18%, transparent)",s="color-mix(in srgb,"+(e.color||"#60A5FA")+" 45%, transparent)",l=(e.name||"?").charAt(0).toUpperCase(),c='<div style="margin:6px 14px;padding:11px 13px;background:var(--bg3);border:1px solid var(--line);display:flex;gap:11px;align-items:center">';c+='<div style="width:40px;height:40px;background:'+o+";border:1px solid "+s+";display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-size:15px;font-weight:900;color:"+(e.color||"#60A5FA")+';flex-shrink:0">'+_ppEscSafe(l)+"</div>",c+='<div style="flex:1;min-width:0">',c+='<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:3px">',c+='<div style="font-family:var(--font-display);font-size:13px;font-weight:800;color:var(--white);letter-spacing:.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+_ppEscSafe(e.name)+"</div>",c+='<div style="font-family:var(--font-display);font-size:9px;font-weight:700;color:'+t+';letter-spacing:.12em;text-transform:uppercase;flex-shrink:0">'+r+"</div>",c+="</div>";var d=[];return e.roleLabel&&d.push(_ppEscSafe(e.roleLabel)),e.team&&d.push(_ppEscSafe(e.team)),d.length&&(c+='<div style="font-size:11px;color:var(--muted);margin-bottom:7px;font-family:var(--font-body);line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+d.join(" · ")+"</div>"),c+='<div style="display:flex;align-items:center;gap:8px">',c+='<div style="flex:1;height:3px;background:var(--line);overflow:hidden"><div style="height:100%;width:'+e.relation+"%;background:"+t+';transition:width .4s ease"></div></div>',c+='<div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:'+t+';min-width:24px;text-align:right">'+Math.round(e.relation)+"</div>",c+="</div>",c+='<div style="font-size:10px;color:var(--dim);margin-top:5px;font-family:var(--font-body);letter-spacing:.02em">Dernière interaction : '+i+"</div>",c+="</div>",c+="</div>"}function sponsorSubTab(e){var t=document.getElementById("spon-panel-dispo"),r=document.getElementById("spon-panel-actif"),n=document.getElementById("spon-sub-dispo"),a=document.getElementById("spon-sub-actif");t&&(t.style.display="dispo"===e?"block":"none"),r&&(r.style.display="actif"===e?"block":"none"),n&&(n.style.background="dispo"===e?"var(--red)":"transparent",n.style.color="dispo"===e?"#fff":"var(--text2)"),a&&(a.style.background="actif"===e?"var(--red)":"transparent",a.style.color="actif"===e?"#fff":"var(--text2)");var i=document.getElementById("spon-actif-badge");if(i){var o=(G.sponsors||[]).length;i.innerHTML=o>0?'<span style="background:#dc2626;color:#fff;border-radius:10px;padding:1px 5px;font-size:10px;margin-left:4px">'+o+"</span>":""}}function renderSponsors(){var __racesDone=(G.races||[]).length;if(__racesDone<2){var __sl=document.getElementById("spon-list");if(__sl){__sl.innerHTML='<div style="margin:10px 16px;padding:18px 14px;background:linear-gradient(180deg,var(--bg3) 0%,var(--bg2) 100%);border:1px solid var(--border-hi);border-radius:12px;text-align:center"><div style="font-family:var(--font-display);font-size:12px;font-weight:800;color:var(--text);letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px">Sponsors verrouillés</div><div style="font-size:12px;color:var(--text3);line-height:1.5">Tes premiers sponsors te contacteront <strong style="color:#F0B41E">après ta 2e course</strong>. ('+__racesDone+'/2 course'+(__racesDone>1?'s':'')+' disputée'+(__racesDone>1?'s':'')+')</div></div>';}var __so=document.getElementById("spon-active");if(__so){__so.innerHTML='<div style="padding:10px 16px;font-size:13px;color:var(--text3)">Aucun contrat sponsor actif.</div>';}var __sa=document.getElementById("spon-total"),__sc=document.getElementById("spon-count");if(__sa)__sa.textContent="+0 e/mois";if(__sc)__sc.textContent="0";return;}var e=getSponsorPool(),t=G.sponsors||[],r=t.map(function(e){return e.id}),n=t.reduce(function(e,t){return e+t.fee},0),a=document.getElementById("spon-total"),i=document.getElementById("spon-count");a&&(a.textContent="+"+n.toLocaleString("fr-FR")+" e/mois"),i&&(i.textContent=t.length);var o=document.getElementById("spon-active");o&&(t.length?(o.innerHTML="",t.forEach(function(e,t){var r=document.createElement("div");r.className="spon-card active";var n="number"==typeof e.weeksLeft?e.weeksLeft:48*(e.dur||1),a=n>=20?Math.round(n/4)+" mois":n+" sem.",i=n<=12?"b-red":n<=24?"b-amber":"b-gray";r.innerHTML='<div class="spon-name">'+e.name+'</div><div class="spon-desc">'+e.desc+'</div><div class="spon-tags"><span class="badge b-teal">+'+e.fee.toLocaleString("fr-FR")+' e/mois</span><span class="badge b-gold">+'+e.perfBonus.toLocaleString("fr-FR")+' e/victoire</span><span class="badge '+i+'">'+a+" restant"+(n>1?"s":"")+"</span></div>";var s=document.createElement("button"),l;s.className="btn btn-sec",s.style.cssText="margin:0;width:100%;font-size:12px;padding:8px",s.textContent="Resiler le contrat (perd 5 rep.)",l=t,s.onclick=function(){cancelSponsor(l)},r.appendChild(s),o.appendChild(r)})):o.innerHTML='<div style="padding:10px 16px;font-size:13px;color:var(--text3)">Aucun contrat sponsor actif.</div>');var s=document.getElementById("spon-list");if(s){s.innerHTML="";var l=e.filter(function(e){return r.indexOf(e.id)<0}),c={};(G.sponsorOffers||[]).forEach(function(e){c[e.id]=e}),l.sort(function(e,t){var r=c[e.id],n=c[t.id];return r&&!n?-1:n&&!r?1:r&&n?r.expire-n.expire:0}),l.length?l.forEach(function(e){var t=G.reputation>=e.repReq,r=c[e.id],n=document.createElement("div");n.className="spon-card",n.style.opacity=t?"1":"0.55",r&&(n.style.border="1px solid rgba(45,212,191,0.4)",n.style.background="linear-gradient(180deg,rgba(45,212,191,0.06) 0%,transparent 60%)");var a=r?'<span class="badge" style="background:rgba(45,212,191,0.18);border:1px solid rgba(45,212,191,0.45);color:#2DD4BF;font-weight:800;letter-spacing:.04em">Offre · '+r.expire+(r.expire>1?" courses":" course")+"</span>":"",i;if(n.innerHTML='<div class="spon-name">'+e.name+(r?' <span style="font-family:var(--font-display);font-size:9px;font-weight:800;color:#2DD4BF;letter-spacing:.12em;text-transform:uppercase;margin-left:6px">· À décider</span>':"")+'</div><div class="spon-desc">'+e.desc+'</div><div class="spon-tags">'+a+'<span class="badge b-teal">+'+e.fee.toLocaleString("fr-FR")+' e/mois</span><span class="badge b-gold">+'+e.perfBonus.toLocaleString("fr-FR")+' e/victoire</span><span class="badge b-gray">'+12*e.dur+" mois</span>"+(e.repReq>0?'<span class="badge '+(t?"b-gray":"b-red")+'">Rep. '+e.repReq+(t?" ok":" requis")+"</span>":"")+"</div>",t){var o=document.createElement("button");o.className="btn btn-prim",o.style.cssText="margin:0;width:100%",o.textContent=r?"Accepter l'offre":"Signer le contrat",i=e,o.onclick=function(){signSponsor(i)},n.appendChild(o)}s.appendChild(n)}):s.innerHTML='<div style="padding:10px 16px;font-size:13px;color:var(--text3)">Tous les sponsors disponibles sont deja actifs.</div>'}}function signSponsor(e){G.sponsors||(G.sponsors=[]);var t=0===G.sponsors.length&&!G._hadSponsor;G._hadSponsor=!0;var r={};Object.keys(e).forEach(function(t){r[t]=e[t]}),r.dur=e.dur||1,r.weeksLeft=48*(e.dur||1),r.signedWeek=48*(G.saison-1)+(G.semaine||1),G.sponsors.push(r),G.revenue+=r.fee,G.sponsorOffers&&G.sponsorOffers.length&&(G.sponsorOffers=G.sponsorOffers.filter(function(t){return t.id!==e.id})),updateUI(),renderSponsors(),sponsorSubTab("dispo");var n=document.getElementById("spon-panel-dispo");n&&(n.scrollTop=0);var a=document.querySelector("#S-contracts .scroll");if(a&&(a.scrollTop=0),showFb("spon-fb","ok",e.name+" signe !","+"+e.fee.toLocaleString("fr-FR")+" e/mois · Bonus victoire : +"+e.perfBonus.toLocaleString("fr-FR")+" e"),"function"==typeof _addFeedPost){var i=(G.pilot.prenom?G.pilot.prenom+" ":"")+(G.pilot.nom||""),o="@"+e.name.toLowerCase().replace(/\s+/g,"").replace(/[^a-z0-9]/g,"").substr(0,14),s;if(_addFeedPost({type:"team",author:e.name,handle:o,color:"#A855F7",body:"Partenariat officialisé avec <strong>"+i+"</strong> en "+(G.cat||"")+" ! Nous sommes fiers de soutenir ce talent sur sa saison. "}),t)_addFeedPost({type:"driver",author:i,handle:"@"+(G.pilot.igHandle||(G.pilot.prenom||"pilote").toLowerCase().replace(/[^a-z0-9]/g,"")),color:"#EC4899",body:"Officiellement sponsorisé "+renderIcon("target",14,"#EF4444")+" Merci <strong>"+e.name+"</strong> pour la confiance. C'est le premier d'une longue liste j'espère !",isPlayer:!0}),"function"!=typeof pushMail||G.agent&&"parent"===G.agent.type||pushMail({from:"Tes parents",role:"family",subject:"Ton premier sponsor !!!",body:"Fiston/ma chérie, on vient de voir ! Ton premier vrai sponsor. On est tellement fiers de toi. Profite bien de ce moment, tu l'as mérité.",actions:[{label:"Merci, je vous aime",kind:"dismiss",responseBody:"Merci papa, merci maman. C'est aussi grâce à vous.",effect:{type:"happiness",data:{delta:5}}}]})}}function cancelSponsor(e){if(G.sponsors){var t=G.sponsors[e];G.revenue=Math.max(0,G.revenue-t.fee),G.reputation=Math.max(0,G.reputation-5),G.sponsors.splice(e,1),updateUI(),renderSponsors(),sponsorSubTab("actif");var r=document.querySelector("#S-contracts .scroll");if(r&&(r.scrollTop=0),showFb("spon-fb","warn","Contrat resilie","Reputation -5. Revenus reduits."),"function"==typeof pushMail&&t&&t.name&&pushMail({from:t.name,role:"sponsor",subject:"Résiliation — notre partenariat",body:"Nous prenons acte de ta décision de mettre fin à notre partenariat. C'est décevant pour nous. Sache que notre porte est désormais fermée et que le milieu est petit — les autres sponsors en sont informés.",actions:[{label:"Prendre note",kind:"dismiss",responseBody:"Compris, merci pour cette saison."}]}),"function"==typeof _addFeedPost&&t&&t.name&&Math.random()<.2){var n="@"+t.name.toLowerCase().replace(/\s+/g,"").replace(/[^a-z0-9]/g,"").substr(0,14);_addFeedPost({type:"team",author:t.name,handle:n,color:"#A855F7",body:"Notre collaboration avec ce pilote s'arrête ici. Nous souhaitons le meilleur à "+t.name.toUpperCase()+" pour la suite, et remercions nos fans pour leur fidélité pendant cette période."})}}}function applySponsorBonuses(e){if(G.sponsors&&G.sponsors.length){var t=0;G.sponsors.forEach(function(r){1===e?t+=r.perfBonus:e<=3?t+=Math.round(.5*r.perfBonus):e<=5&&(t+=Math.round(.2*r.perfBonus))}),t>0&&("function"==typeof applyAgentCommission&&(t=applyAgentCommission(t)),G.budget+=t,showFb("cont-fb","ok","Primes sponsors","+"+t.toLocaleString("fr-FR")+" e verses par tes sponsors !"))}}function getRacePrizeMoney(e){var t=CATEGORIES.indexOf(G.cat),r,n,a=[500,3e3,8e3,15e3,3e4,8e4,2e5][{"Karting Junior":0,"Karting Senior":1,"Formule 4":2,"Formula Regional":3,"Formule 3":4,"Formule 2":5,"Formule 1":6,"Super Formula":4,"Endurance WEC":4,IndyCar:5}[G.cat]||0]||500,i,o=[1,.7,.5,.35,.25,.18,.12,.08][e-1]||0;return 100*Math.round(a*o/100)}window.addEventListener("load",function(){if("function"==typeof showDisplaySetupIfNeeded&&showDisplaySetupIfNeeded())return;renderSaveSlots(),!CAL_RACES.length&&G.cat&&buildCalendar()});var PRIZE_HISTORY=[];function renderPrimes(){var e=document.getElementById("primes-list");if(e){var t=CATEGORIES.indexOf(G.cat),r,n,a=[500,3e3,8e3,15e3,3e4,8e4,2e5][{"Karting Junior":0,"Karting Senior":1,"Formule 4":2,"Formula Regional":3,"Formule 3":4,"Formule 2":5,"Formule 1":6,"Super Formula":4,"Endurance WEC":4,IndyCar:5}[G.cat]||0]||500,i=[{pos:1,label:"Victoire",mult:1},{pos:2,label:"2e place",mult:.7},{pos:3,label:"3e place",mult:.5},{pos:4,label:"4e place",mult:.35},{pos:5,label:"5e place",mult:.25},{pos:6,label:"Top 6",mult:.18},{pos:7,label:"Top 8",mult:.12},{pos:8,label:"Top 10",mult:.08}];e.innerHTML=i.map(function(e){var t=100*Math.round(a*e.mult/100),r;return'<div style="display:flex;align-items:center;justify-content:space-between;padding:11px 16px;border-bottom:1px solid var(--border)"><div style="display:flex;align-items:center;gap:10px"><span class="badge '+(1===e.pos?"b-gold":e.pos<=3?"b-teal":"b-gray")+'">P'+e.pos+'</span><span style="font-size:13px;color:var(--text2)">'+e.label+'</span></div><span style="font-size:13px;font-weight:700;color:var(--teal,#34D399)">+'+t.toLocaleString("fr-FR")+" e</span></div>"}).join("")}var o=document.getElementById("primes-history");o&&(PRIZE_HISTORY.length?o.innerHTML=PRIZE_HISTORY.slice(-8).reverse().map(function(e){return'<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--border)"><div><div style="font-size:13px;color:var(--text2)">'+e.race+'</div><div style="font-size:11px;color:var(--text3);margin-top:2px">P'+e.pos+'</div></div><span style="font-size:13px;font-weight:700;color:var(--teal,#34D399)">+'+e.amount.toLocaleString("fr-FR")+" e</span></div>"}).join(""):o.innerHTML='<div style="padding:10px 16px;font-size:13px;color:var(--text3)">Aucune prime versee pour l instant.</div>')}function applyWeeklyIncome(e){if(e||(e=1),G.revenue>0){var t=Math.round(G.revenue*e/4),r="function"==typeof getPreseasonBudgetBonus?getPreseasonBudgetBonus():null;r&&r.revenueMult&&r.revenueMult>1&&(t=Math.round(t*r.revenueMult)),"function"==typeof applyAgentCommission&&(t=applyAgentCommission(t)),G.budget+=t}if(applyMaintenanceCosts(e),tickContractTime(e),G.budget<2e3&&!G._budgetWarned&&"function"==typeof pushMail&&G.agent){G._budgetWarned=!0;var n="parent"===G.agent.type,a;pushMail({from:n?G.agent.firstName||("mother"===G.agent.parentRole?"Maman":"Papa"):G.agent.name||"Ton agent",role:"agent",subject:"️ Budget critique",body:n?"Mon grand, j'ai regardé les comptes — <strong>il reste moins de 2000 €</strong>. Il va falloir faire attention. Plus de dépenses lifestyle pour un moment, et peut-être chercher des petits sponsors en plus. On en parle ?":"<strong>Alerte budget</strong> — Le solde est tombé sous 2000 €. À ce rythme, tu ne vas pas pouvoir assumer les frais du prochain week-end. Il faut vite signer des sponsors ou réduire les dépenses. Passe me voir.",actions:[{label:"OK, je fais attention",kind:"dismiss",responseBody:"Bien noté, je vais couper les dépenses inutiles et regarder les sponsors."}]})}if(G.budget>=5e3&&(G._budgetWarned=!1),(G.reputation||0)<25&&(G.happiness||50)<30&&!G._imageCrisisWarned&&"function"==typeof pushMail&&G.agent){G._imageCrisisWarned=!0;var i="parent"===G.agent.type,o;pushMail({from:i?G.agent.firstName||("mother"===G.agent.parentRole?"Maman":"Papa"):G.agent.name||"Ton agent",role:"agent",subject:"Ton image se dégrade sérieusement",body:i?"Mon grand, je te parle cash : ta réputation est basse et tu n'as pas l'air bien. On doit réagir ensemble. Prends du repos, remettons de l'ordre, on communique autrement.":"Situation préoccupante : <strong>réputation</strong> et <strong>état moral</strong> sont tous deux dans le rouge. Il faut reprendre la main : poser quelques actions médiatiques cadrées, restaurer la confiance avec ton entourage pro, couper avec ce qui te tire vers le bas. On doit se voir cette semaine.",actions:[{label:"OK, on fait le point",kind:"dismiss",responseBody:"Bien noté. Je prends rendez-vous dès que possible."}]})}(G.reputation||0)>=40&&(G.happiness||50)>=45&&(G._imageCrisisWarned=!1)}function tickContractTime(e){if(e&&!(e<=0)){if(ensureContractWeeks(),"number"==typeof G.contractWeeksLeft&&G.currentTeam&&"Indépendant"!==G.currentTeam){var t=G.contractWeeksLeft;if(G.contractWeeksLeft=Math.max(0,G.contractWeeksLeft-e),t>24&&G.contractWeeksLeft<=24&&G.contractWeeksLeft>0&&!G._contractExpiryWarned&&"function"==typeof pushMail&&G.agent){G._contractExpiryWarned=!0;var r="parent"===G.agent.type,n;pushMail({from:r?G.agent.firstName||("mother"===G.agent.parentRole?"Maman":"Papa"):G.agent.name||"Ton agent",role:"agent",subject:"Ton contrat expire bientôt",body:r?"Mon grand, ton contrat avec <strong>"+G.currentTeam+"</strong> arrive à expiration dans environ <strong>6 mois</strong>. Il faut commencer à penser à la suite. Des offres vont arriver, reste concentré sur la piste.":"Rappel : ton contrat avec <strong>"+G.currentTeam+"</strong> expire dans environ 6 mois. Je commence à tâter le terrain discrètement auprès d'autres équipes. Tu performances bien, on devrait avoir des options.",actions:[{label:"OK, bien noté",kind:"dismiss",responseBody:"Compris, je laisse faire et je reste focus course."}]})}}if(G.sponsors&&G.sponsors.length){var a=[],i=[];G.sponsors=G.sponsors.filter(function(t){"number"!=typeof t.weeksLeft&&(t.weeksLeft=48*(t.dur||1));var r=t.weeksLeft;return t.weeksLeft-=e,r>8&&t.weeksLeft<=8&&t.weeksLeft>0&&!t._expiryWarned&&(t._expiryWarned=!0,i.push(t)),!(t.weeksLeft<=0)||(a.push(t),!1)}),i.length&&"function"==typeof pushMail&&i.forEach(function(e){pushMail({from:e.name,role:"sponsor",subject:"Fin de contrat proche",body:"Notre accord avec toi arrive bientôt à son terme (<strong>"+e.weeksLeft+" semaines</strong> restantes). Nous sommes très satisfaits de cette collaboration et serions ouverts à renouveler — contacte-nous quand tu veux pour en discuter.",actions:[{label:"Je vous reviens bientôt",kind:"dismiss",responseBody:"Merci pour le signal, je regarde ça et on se parle vite."}]})}),a.length>0&&(G.revenue=G.sponsors.reduce(function(e,t){return e+(t.fee||0)},0),G._lastSponsorsExpired=a.map(function(e){return e.name||e.id}),"function"==typeof pushMail&&a.forEach(function(e){pushMail({from:e.name,role:"sponsor",subject:"Fin de notre partenariat",body:"Notre accord arrive à échéance. Merci pour cette collaboration ! Nous sommes ouverts à remettre le couvert plus tard si les circonstances le permettent. Bonne continuation sur la saison.",actions:[{label:"Merci à vous",kind:"dismiss",responseBody:"Merci pour cette période de soutien. À bientôt peut-être."}]})}))}}}function ensureContractWeeks(){if(G.currentTeam&&"Indépendant"!==G.currentTeam&&G.contractDur>0&&("number"!=typeof G.contractWeeksLeft||G.contractWeeksLeft<=0)){var e=Math.max(0,48-(G.semaine||1));G.contractWeeksLeft=e+48*Math.max(0,G.contractDur-1)}G.sponsors&&G.sponsors.length&&G.sponsors.forEach(function(e){"number"!=typeof e.weeksLeft&&(e.weeksLeft=48*(e.dur||1))})}var CAREER_HISTORY=[];function gameYear(){return G.gameYear||(G.pilot&&G.pilot.startYear?G.pilot.startYear+(G.saison-1):2024)}function gYear(){return String(gameYear())}function saveSeasonToHistory(){var e=[{pts:G.champPts,me:!0}];G.rivals.forEach(function(t){e.push({pts:t.pts,me:!1})}),e.sort(function(e,t){return t.pts-e.pts});var t=e.findIndex(function(e){return e.me})+1,r=G.races.filter(function(e){return 1===e.pos}).length,n=G.races.filter(function(e){return e.pos>=1&&e.pos<=3}).length,a=G.races.filter(function(e){return e.pos>=1&&e.pos<=5}).length,i=G.races.filter(function(e){return 0===e.pos}).length,o=G.races.filter(function(e){return!0===e.pole||1===e.startPos}).length,s=getConstructorChampion(),l=!(!s||!s.playerTeam||s.team!==s.playerTeam);CAREER_HISTORY.push({saison:G.saison,cat:G.cat,pos:t,pts:G.champPts,races:G.races.length,wins:r,pods:n,top5:a,dnfs:i,poles:o,age:G.age,rating:calcPlayerRating(),team:G._seasonTeam||G.currentTeam||"Indépendant",constrChamp:l?s?s.team:"":null,number:G.pilot.number||23,raceDetails:G.races.slice()});try{var __totalRaces=G.races.length;G.rivals.forEach(function(rv){if(!rv)return;if(!rv.careerHistory)rv.careerHistory=[];var rvWins=rv.wins||0;var rvPods=rv.podiums||0;var rvPoles=rv.poles||0;var rvPos=e.findIndex(function(x){return!x.me&&x.pts===rv.pts})+1;if(rvPos<=0){var sorted=e.slice();var rvIndex=-1;for(var ii=0;ii<sorted.length;ii++){if(!sorted[ii].me&&Math.abs(sorted[ii].pts-rv.pts)<0.01){rvIndex=ii;break}}rvPos=rvIndex>=0?rvIndex+1:0}rv.careerHistory.push({saison:G.saison,cat:G.cat,team:rv.team||"Indépendant",pos:rvPos,pts:rv.pts||0,races:__totalRaces,wins:rvWins,pods:rvPods,poles:rvPoles})})}catch(e){console.warn("rival careerHistory:",e)}if(typeof _persistRivalsCareerToRegistry==="function")_persistRivalsCareerToRegistry()}function renderCareerHistory(){renderPalmares();if(typeof renderCareerGraph==="function")try{renderCareerGraph()}catch(e){console.warn("renderCareerGraph:",e)}if(typeof renderCircuitStats==="function")try{renderCircuitStats()}catch(e){console.warn("renderCircuitStats:",e)}}function renderPalmares(){var e=document.getElementById("palmares-content");if(e){var t=CAREER_HISTORY.slice(),r;if(!CAREER_HISTORY.some(function(e){return e.saison===G.saison&&e.cat===G.cat})&&G.races.length>0){var n=[{pts:G.champPts,me:!0}];G.rivals.forEach(function(e){n.push({pts:e.pts,me:!1})}),n.sort(function(e,t){return t.pts-e.pts}),t.push({saison:G.saison,cat:G.cat,pos:n.findIndex(function(e){return e.me})+1,pts:G.champPts,races:G.races.length,wins:G.races.filter(function(e){return 1===e.pos}).length,pods:G.races.filter(function(e){return e.pos>=1&&e.pos<=3}).length,poles:G.races.filter(function(e){return!0===e.pole||1===e.startPos}).length,top5:G.races.filter(function(e){return e.pos>=1&&e.pos<=5}).length,dnfs:G.races.filter(function(e){return 0===e.pos}).length,age:G.age,rating:calcPlayerRating(),team:G._seasonTeam||G.currentTeam||"Indépendant",constrChamp:null,current:!0})}var a=t.reduce(function(e,t){return e+(t.races||0)},0),i=t.reduce(function(e,t){return e+(t.wins||0)},0),o=t.reduce(function(e,t){return e+(t.pods||0)},0),s=t.reduce(function(e,t){return e+(t.poles||0)},0),l=t.reduce(function(e,t){return e+(t.dnfs||0)},0),c=t.reduce(function(e,t){return e+(t.pts||0)},0),d=t.reduce(function(e,t){return e+(t.top5||0)},0),p=t.filter(function(e){return 1===e.pos&&!e.current}),u=t.filter(function(e){return e.constrChamp&&!e.current}),f=a>0?Math.round(i/a*100):0,m=a>0?Math.round(o/a*100):0,g=a>0?Math.round(s/a*100):0,h="";h+='<div class="t-sec">Trophées</div>',p.length>0&&(h+='<div style="margin:0 16px 12px;border:1px solid var(--border);border-radius:14px;overflow:hidden;background:var(--surface2);position:relative">',h+='<div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:#F59E0B"></div>',h+='<div style="padding:12px 14px 10px 18px;background:linear-gradient(180deg,rgba(245,158,11,0.10) 0%,transparent 100%)">',h+='<div style="display:flex;align-items:center;gap:10px">',h+='<span style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;flex-shrink:0">'+renderIcon("trophy",22,"#F59E0B")+"</span>",h+='<div style="flex:1;min-width:0">',h+='<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">',h+='<span style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--muted);letter-spacing:.14em;text-transform:uppercase">Champion pilote</span>',h+='<span style="font-family:var(--font-display);font-size:10px;font-weight:800;color:#fff;background:#F59E0B;padding:3px 8px;border-radius:5px;letter-spacing:.08em;text-transform:uppercase">'+p.length+" titre"+(p.length>1?"s":"")+"</span>",h+="</div>",h+='<div style="font-size:11px;color:var(--text3);margin-top:4px">Meilleure performance en course</div>',h+="</div></div></div>",p.forEach(function(e,t){var r=e.team||"Indépendant",n=TEAM_LOGOS[r]?'<span style="display:inline-flex;width:14px;height:14px;border-radius:2px;overflow:hidden;vertical-align:middle;margin-right:4px">'+TEAM_LOGOS[r].replace('width="40" height="40"','width="14" height="14"')+"</span>":"";h+='<div style="padding:10px 14px 10px 18px;'+(p.length,'border-top:1px solid var(--border)">'),h+='<div style="display:flex;align-items:center;justify-content:space-between">';var a=G.pilot&&G.pilot.startYear?G.pilot.startYear+(e.saison-1):e.saison;h+='<div><div style="font-size:13px;font-weight:700;color:var(--text)">'+a+" — "+e.cat+"</div>",h+='<div style="display:flex;align-items:center;margin-top:3px">'+n+'<span style="font-size:11px;color:var(--text3)">'+r+"</span></div></div>",h+='<div style="text-align:right"><div style="font-family:var(--font-display);font-size:11px;font-weight:700;color:#F59E0B;letter-spacing:.04em">'+e.wins+"V · "+e.pods+"P · "+e.pts+" pts</div>",h+='<div style="font-size:11px;color:var(--text3);margin-top:2px">Âge '+e.age+" ans</div></div>",h+="</div></div>"}),h+="</div>"),u.length>0&&(h+='<div style="margin:0 16px 12px;border:1px solid var(--border);border-radius:14px;overflow:hidden;background:var(--surface2);position:relative">',h+='<div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:#F59E0B"></div>',h+='<div style="padding:12px 14px 10px 18px;background:linear-gradient(180deg,rgba(245,158,11,0.08) 0%,transparent 100%)">',h+='<div style="display:flex;align-items:center;gap:10px">',h+='<span style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;flex-shrink:0">'+renderIcon("trophy",22,"#F59E0B")+"</span>",h+='<div style="flex:1;min-width:0">',h+='<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">',h+='<span style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--muted);letter-spacing:.14em;text-transform:uppercase">Champion constructeur</span>',h+='<span style="font-family:var(--font-display);font-size:10px;font-weight:800;color:#fff;background:#F59E0B;padding:3px 8px;border-radius:5px;letter-spacing:.08em;text-transform:uppercase">'+u.length+" titre"+(u.length>1?"s":"")+"</span>",h+="</div>",h+='<div style="font-size:11px;color:var(--text3);margin-top:4px">Meilleure écurie de la saison</div>',h+="</div></div></div>",u.forEach(function(e,t){var r=e.constrChamp||e.team||"",n=TEAM_LOGOS[r]?'<span style="display:inline-flex;width:14px;height:14px;border-radius:2px;overflow:hidden;vertical-align:middle;margin-right:4px">'+TEAM_LOGOS[r].replace('width="40" height="40"','width="14" height="14"')+"</span>":"";h+='<div style="padding:10px 14px 10px 18px;border-top:1px solid var(--border)">',h+='<div style="font-size:13px;font-weight:700;color:var(--text)">Saison '+e.saison+" — "+e.cat+"</div>",h+='<div style="display:flex;align-items:center;margin-top:3px">'+n+'<span style="font-size:11px;color:var(--text3)">'+r+"</span></div>",h+="</div>"}),h+="</div>"),0===p.length&&0===u.length&&(h+='<div style="margin:0 16px 12px;border:1px solid var(--border);border-radius:14px;background:var(--surface2);position:relative;overflow:hidden">',h+='<div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--border-hi)"></div>',h+='<div style="padding:16px 16px 16px 18px;text-align:center;color:var(--text3);font-size:13px">Aucun titre pour le moment — continue à te battre !</div>',h+="</div>"),h+='<div class="t-sec">Statistiques de carrière</div>',h+='<div style="margin:0 16px 12px;border:1px solid var(--border);border-radius:14px;overflow:hidden;background:var(--surface2);position:relative">',h+='<div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--red2)"></div>';var v=[{l:"Saisons disputées",v:t.length,c:"var(--text)",s:null},{l:"Courses disputées",v:a,c:"var(--text)",s:null},{l:"Victoires",v:i,c:"#F59E0B",s:f+"%"},{l:"Podiums",v:o,c:"var(--teal,#34D399)",s:m+"%"},{l:"Poles positions",v:s,c:"#A78BFA",s:g+"%"},{l:"Top 5",v:d,c:"var(--blue)",s:a>0?Math.round(d/a*100)+"%":null},{l:"Points totaux",v:c,c:"var(--text)",s:null},{l:"Abandons (DNF)",v:l,c:"var(--red-light)",s:a>0?Math.round(l/a*100)+"%":null},{l:"Note actuelle",v:calcPlayerRating(),c:getRatingTier(calcPlayerRating()).color,s:getRatingTier(calcPlayerRating()).tier}];v.forEach(function(e,t){h+='<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px 10px 18px;'+(t<v.length-1?"border-bottom:1px solid var(--border)":"")+'">',h+='<span style="font-size:13px;color:var(--text2)">'+e.l+"</span>",h+='<div style="display:flex;align-items:center;gap:10px">',e.s&&(h+='<span style="font-family:var(--font-display);font-size:10px;font-weight:700;color:var(--text3);letter-spacing:.04em">'+e.s+"</span>"),h+='<span style="font-family:var(--font-display);font-size:15px;font-weight:900;color:'+e.c+'">'+e.v+"</span>",h+="</div></div>"}),h+="</div>";h+='<div class="t-sec">Accomplissements</div>';var x=[];
// === TITRES (palmarès) ===
p.length>0&&x.push({icon:"[P1]",label:"Champion "+(p.length>1?p.length+"x ":"")+"pilote",sub:p.map(function(e){return e.cat+" S"+e.saison}).join(" · "),c:"#F59E0B"});
u.length>0&&x.push({icon:"trophy",label:"Champion constructeur",sub:u.map(function(e){return e.cat+" S"+e.saison}).join(" · "),c:"#F59E0B"});
var f1Titles=p.filter(function(e){return e.cat==="Formule 1"}).length,f2Titles=p.filter(function(e){return e.cat==="Formule 2"}).length,f3Titles=p.filter(function(e){return e.cat==="Formule 3"}).length,kartTitles=p.filter(function(e){return e.cat==="Karting Junior"||e.cat==="Karting Senior"}).length,sfTitles=p.filter(function(e){return e.cat==="Super Formula"}).length,wecTitles=p.filter(function(e){return e.cat==="Endurance WEC"}).length,indyTitles=p.filter(function(e){return e.cat==="IndyCar"}).length;
i>=100&&p.length>=5&&x.push({icon:"[P1]",label:"GOAT — légende absolue",sub:i+" victoires · "+p.length+" titres",c:"#A855F7"});
f1Titles>=5&&x.push({icon:"[P1]",label:"Quintuple champion F1",sub:f1Titles+" titres mondiaux",c:"#A855F7"});
f1Titles>=3&&f1Titles<5&&x.push({icon:"trophy",label:f1Titles+"× champion F1",sub:"Triple champion ou plus",c:"#F59E0B"});
indyTitles>=1&&wecTitles>=1&&f1Titles>=1&&x.push({icon:"star",label:"Triple Crown",sub:"Champion F1 + IndyCar + WEC",c:"#A855F7"});
kartTitles>=2&&x.push({icon:"kart",label:"Champion karting double",sub:"Junior ET Senior",c:"#34D399"});
f3Titles>=1&&f2Titles>=1&&f1Titles>=1&&x.push({icon:"trend",label:"Triplé F3 → F2 → F1",sub:"Champion à chaque échelon",c:"#A855F7"});
(function(){if(p.length>=2){var consec=0,maxConsec=0;var sortedTitles=p.filter(function(e){return e.cat==="Formule 1"}).sort(function(a,b){return a.saison-b.saison});for(var k=1;k<sortedTitles.length;k++){if(sortedTitles[k].saison===sortedTitles[k-1].saison+1){consec++;if(consec+1>maxConsec)maxConsec=consec+1}else consec=0}if(maxConsec>=3)x.push({icon:"trophy",label:maxConsec+"× champion F1 consécutif",sub:"Domination écrasante",c:"#A855F7"});else if(maxConsec===2)x.push({icon:"trophy",label:"Doublé F1 consécutif",sub:"Back-to-back",c:"#F59E0B"})}})();
(function(){var perfectSeason=t.find(function(s){return s.races>=8&&s.wins===s.races&&!s.current});if(perfectSeason)x.push({icon:"[P1]",label:"Saison parfaite",sub:perfectSeason.cat+" S"+perfectSeason.saison+" — toutes les courses gagnées",c:"#A855F7"})})();
// === COURSES MYTHIQUES GAGNÉES ===
(function(){var hasMC=t.some(function(s){return(s.raceDetails||[]).some(function(r){return r.pos===1&&r.circuit&&(r.circuit==="Monaco"||r.circuit==="Monte Carlo")})});var hasIndy500=t.some(function(s){return s.cat==="IndyCar"&&(s.raceDetails||[]).some(function(r){return r.pos===1&&(r.circuit==="Indianapolis"||r.circuit==="Indy 500"||(r.nom||"").indexOf("Indy")>=0)})});var hasLeMans=t.some(function(s){return s.cat==="Endurance WEC"&&(s.raceDetails||[]).some(function(r){return r.pos===1&&((r.circuit||"").indexOf("Le Mans")>=0||(r.nom||"").indexOf("Le Mans")>=0||(r.nom||"").indexOf("24")>=0)})});if(hasMC&&hasIndy500&&hasLeMans){x.push({icon:"[P1]",label:"Triple Couronne du Sport Auto",sub:"Monaco · Indy 500 · Le Mans",c:"#A855F7"})}else{if(hasMC)x.push({icon:"trophy",label:"Vainqueur à Monaco",sub:"La perle de la F1",c:"#F59E0B"});if(hasIndy500)x.push({icon:"trophy",label:"Vainqueur des 500 Miles d'Indianapolis",sub:"L'épreuve mythique américaine",c:"#F59E0B"});if(hasLeMans)x.push({icon:"trophy",label:"Vainqueur des 24 Heures du Mans",sub:"L'endurance ultime",c:"#F59E0B"})}})();
(function(){var hasMacao=t.some(function(s){return(s.raceDetails||[]).some(function(r){return r.pos===1&&((r.circuit||"").indexOf("Macao")>=0||(r.nom||"").indexOf("Macao")>=0)})});if(hasMacao)x.push({icon:"trophy",label:"Vainqueur du GP de Macao",sub:"L'épreuve mythique de F3",c:"#F59E0B"})})();
x.length||x.push({icon:"rocket",label:"Carrière en construction",sub:"Les trophées arrivent !",c:"var(--text3)"}),h+='<div style="margin:0 16px 12px;border:1px solid var(--border);border-radius:14px;overflow:hidden;background:var(--surface2);position:relative">',h+='<div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--red2)"></div>',x.forEach(function(e,t){h+='<div style="display:flex;align-items:flex-start;gap:12px;padding:11px 14px 11px 18px;'+(t<x.length-1?"border-bottom:1px solid var(--border)":"")+'">';var r=e.icon?renderIcon(e.icon,22,e.c):"";h+='<span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;background:'+e.c+'18;flex-shrink:0">'+r+"</span>",h+='<div><div style="font-size:13px;font-weight:700;color:'+e.c+'">'+e.label+"</div>",e.sub&&(h+='<div style="font-size:11px;color:var(--text3);margin-top:2px">'+e.sub+"</div>"),h+="</div></div>"}),h+="</div>",e.innerHTML=h}}function renderCareerGraph(){try{var container=document.getElementById("career-graph-content");if(!container)return;var hist=(typeof CAREER_HISTORY!=="undefined"&&CAREER_HISTORY||[]).slice();if(G&&G.races&&G.races.length>0&&G.saison){var racesPlayed=G.races.length;var wins=G.races.filter(function(r){return r.pos===1}).length;var pods=G.races.filter(function(r){return r.pos>=1&&r.pos<=3}).length;var poles=G.races.filter(function(r){return!0===r.pole||1===r.startPos}).length;var dnfs=G.races.filter(function(r){return r.pos===0}).length;var n=[{pts:G.champPts,me:!0}];(G.rivals||[]).forEach(function(e){n.push({pts:e.pts,me:!1})});n.sort(function(a,b){return b.pts-a.pts});var pos=n.findIndex(function(e){return e.me})+1;var alreadyAdded=hist.some(function(e){return e.saison===G.saison&&e.cat===G.cat});if(!alreadyAdded){hist.push({saison:G.saison,cat:G.cat,pos:pos,pts:G.champPts,races:racesPlayed,wins:wins,pods:pods,poles:poles,dnfs:dnfs,current:true})}}if(hist.length===0){container.innerHTML="";return}hist.sort(function(a,b){if(a.saison!==b.saison)return a.saison-b.saison;return 0});var allRatings=[];hist.forEach(function(s){if(s.rating)allRatings.push(s.rating)});var w=320,h=140,padL=24,padR=12,padT=10,padB=22;var nSeasons=hist.length;var xStep=nSeasons>1?(w-padL-padR)/(nSeasons-1):0;var maxPos=20;hist.forEach(function(s){if(s.pos&&s.pos>maxPos)maxPos=s.pos});maxPos=Math.max(maxPos,5);var yScale=(h-padT-padB)/Math.max(1,maxPos-1);var posPath="";var winsPath="";var maxWins=Math.max(1,Math.max.apply(null,hist.map(function(s){return s.wins||0})));var winsYScale=(h-padT-padB)/Math.max(1,maxWins);hist.forEach(function(s,i){var x=padL+i*xStep;if(s.pos&&s.pos>0){var y=padT+(s.pos-1)*yScale;posPath+=(i===0?"M":"L")+x.toFixed(1)+" "+y.toFixed(1)}});var winsPathPts="";hist.forEach(function(s,i){var x=padL+i*xStep;var y=h-padB-(s.wins||0)*winsYScale;winsPathPts+=(i===0?"M":"L")+x.toFixed(1)+" "+y.toFixed(1)});var lines="";for(var i=0;i<=4;i++){var posVal=1+Math.round((maxPos-1)*i/4);var yVal=padT+(posVal-1)*yScale;lines+='<line x1="'+padL+'" y1="'+yVal+'" x2="'+(w-padR)+'" y2="'+yVal+'" stroke="rgba(255,255,255,0.05)" stroke-width="0.5"/>';lines+='<text x="'+(padL-4)+'" y="'+(yVal+3)+'" text-anchor="end" fill="rgba(255,255,255,0.4)" font-size="8" font-family="monospace">P'+posVal+'</text>'}var seasonLabels="";hist.forEach(function(s,i){var x=padL+i*xStep;seasonLabels+='<text x="'+x.toFixed(1)+'" y="'+(h-4)+'" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="8" font-family="monospace">S'+s.saison+'</text>'});var posMarkers="";hist.forEach(function(s,i){if(s.pos&&s.pos>0){var x=padL+i*xStep;var y=padT+(s.pos-1)*yScale;var col=s.pos===1?"#F59E0B":(s.pos<=3?"#FBBF24":"#FF1801");posMarkers+='<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="3.2" fill="'+col+'" stroke="#000" stroke-width="0.8"/>';if(s.pos===1)posMarkers+='<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="6" fill="none" stroke="#F59E0B" stroke-width="1" opacity="0.5"/>'}});var winMarkers="";hist.forEach(function(s,i){if(s.wins&&s.wins>0){var x=padL+i*xStep;var y=h-padB-(s.wins||0)*winsYScale;winMarkers+='<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="2.2" fill="#34D399" opacity="0.85"/>'}});var winsLine=winsPathPts?'<path d="'+winsPathPts+'" stroke="#34D399" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3,2" opacity="0.7"/>':"";var posLine=posPath?'<path d="'+posPath+'" stroke="#FF1801" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>':"";var svg='<svg viewBox="0 0 '+w+' '+h+'" width="100%" style="display:block;background:rgba(0,0,0,0.4);border-radius:10px">'+lines+winsLine+posLine+winMarkers+posMarkers+seasonLabels+'</svg>';var totalWins=hist.reduce(function(s,e){return s+(e.wins||0)},0);var totalPodiums=hist.reduce(function(s,e){return s+(e.pods||0)},0);var totalRaces=hist.reduce(function(s,e){return s+(e.races||0)},0);var titles=hist.filter(function(e){return e.pos===1&&!e.current}).length;var bestSeason=hist.reduce(function(best,s){if(!best)return s;return((s.wins||0)>(best.wins||0))?s:best},null);var html='<div style="margin:10px 14px 12px;padding:14px;background:linear-gradient(180deg,var(--surface2) 0%,var(--bg2) 100%);border:1px solid var(--border-hi);border-radius:14px;box-shadow:0 4px 16px rgba(0,0,0,0.25)">'+'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><div><div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:#FF1801;letter-spacing:.18em;text-transform:uppercase;margin-bottom:8px">Évolution carrière</div><div style="font-family:var(--font-display);font-size:14px;font-weight:900;color:var(--text);line-height:1.1">'+nSeasons+' saison'+(nSeasons>1?"s":"")+' · '+titles+' titre'+(titles>1?"s":"")+'</div></div></div>'+svg+'<div style="display:flex;align-items:center;gap:14px;justify-content:center;margin-top:8px;font-size:10px;color:var(--text2)"><span style="display:inline-flex;align-items:center;gap:5px"><span style="width:14px;height:2px;background:#FF1801;border-radius:1px"></span>Position</span><span style="display:inline-flex;align-items:center;gap:5px"><span style="width:14px;height:2px;background:#34D399;border-image:repeating-linear-gradient(90deg,#34D399 0 3px,transparent 3px 5px) 1"></span>Victoires</span></div>'+'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:12px">'+'<div style="padding:7px 4px;background:var(--bg3);border-radius:6px;text-align:center"><div style="font-family:var(--font-display);font-size:8.5px;color:var(--text3);letter-spacing:.1em">SAISONS</div><div style="font-family:var(--font-display);font-size:14px;font-weight:900;color:var(--text);margin-top:2px">'+nSeasons+'</div></div>'+'<div style="padding:7px 4px;background:var(--bg3);border-radius:6px;text-align:center"><div style="font-family:var(--font-display);font-size:8.5px;color:#F59E0B;letter-spacing:.1em">TITRES</div><div style="font-family:var(--font-display);font-size:14px;font-weight:900;color:#F59E0B;margin-top:2px">'+titles+'</div></div>'+'<div style="padding:7px 4px;background:var(--bg3);border-radius:6px;text-align:center"><div style="font-family:var(--font-display);font-size:8.5px;color:#34D399;letter-spacing:.1em">VICTOIRES</div><div style="font-family:var(--font-display);font-size:14px;font-weight:900;color:#34D399;margin-top:2px">'+totalWins+'</div></div>'+'<div style="padding:7px 4px;background:var(--bg3);border-radius:6px;text-align:center"><div style="font-family:var(--font-display);font-size:8.5px;color:#FBBF24;letter-spacing:.1em">PODIUMS</div><div style="font-family:var(--font-display);font-size:14px;font-weight:900;color:#FBBF24;margin-top:2px">'+totalPodiums+'</div></div>'+'</div>'+'</div>';container.innerHTML=html}catch(e){console.warn("renderCareerGraph:",e)}}
function renderCircuitStats(){var container=document.getElementById("circuits-stats-content");if(!container)return;try{var allRaces=[];if(typeof CAREER_HISTORY!=="undefined"&&CAREER_HISTORY)CAREER_HISTORY.forEach(function(s){if(s.raceDetails)s.raceDetails.forEach(function(r){var rr=Object.assign({},r);if(rr.saison==null)rr.saison=s.saison;if(rr.cat==null)rr.cat=s.cat;allRaces.push(rr)})});var _curInHist3=CAREER_HISTORY.some(function(s){return s.saison===G.saison&&s.cat===G.cat});if(!_curInHist3&&G&&G.races&&G.races.length)G.races.forEach(function(r){var rr=Object.assign({},r);if(rr.saison==null)rr.saison=G.saison;if(rr.cat==null)rr.cat=G.cat;allRaces.push(rr)});var byCircuit={};allRaces.forEach(function(r){if(!r.circuit)return;var key=r.circuit;byCircuit[key]=byCircuit[key]||{name:r.circuit,races:0,wins:0,podiums:0,poles:0,top10:0,dnfs:0,bestPos:null,results:[],totalPos:0,countedRaces:0};var c=byCircuit[key];c.races++;if(r.dns)return;c.results.push({pos:r.pos,saison:r.saison,cat:r.cat,pole:r.pole});if(r.pos>0){c.totalPos+=r.pos;c.countedRaces++;if(c.bestPos===null||r.pos<c.bestPos)c.bestPos=r.pos}if(r.pos===1)c.wins++;if(r.pos>=1&&r.pos<=3)c.podiums++;if(r.pos>=1&&r.pos<=10)c.top10++;if(r.pole)c.poles++;if(r.pos===0)c.dnfs++});var circuits=Object.keys(byCircuit).map(function(k){return byCircuit[k]});if(circuits.length===0){container.innerHTML='<div style="margin:10px 14px;padding:18px;text-align:center;color:var(--text3);font-size:12px;border:1px solid var(--border);border-radius:12px;background:var(--surface2);font-style:italic">Aucune statistique de circuit pour le moment.<br><br>Cours quelques épreuves pour voir tes performances par circuit.</div>';return}circuits.forEach(function(c){c.avgPos=c.countedRaces>0?c.totalPos/c.countedRaces:99;c.score=(c.wins*10)+(c.podiums*4)+(c.top10*1)-(c.dnfs*2)+(c.poles*2)});circuits.sort(function(a,b){return b.score-a.score});var html="";var bestCircuit=circuits[0];var totalRaces=allRaces.length;var totalCircuits=circuits.length;html+='<div style="margin:0 14px 12px;padding:14px;border-radius:12px;background:linear-gradient(180deg,var(--surface2) 0%,var(--bg2) 100%);border:1px solid var(--border);position:relative;overflow:hidden">';html+='<div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(180deg,#34D399 0%,#059669 100%);box-shadow:0 0 12px rgba(52,211,153,0.4)"></div>';html+='<div style="padding-left:6px"><div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:#34D399;letter-spacing:.18em;text-transform:uppercase;margin-bottom:4px">'+renderIcon('trophy',14,'#F59E0B')+' Circuit fétiche</div><div style="font-family:var(--font-display);font-size:18px;font-weight:900;color:var(--text);line-height:1.1;margin-bottom:6px">'+bestCircuit.name+'</div>';html+='<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:11.5px;color:var(--text2)">';if(bestCircuit.wins>0)html+='<span><strong style="color:#F59E0B">'+bestCircuit.wins+'</strong> victoire'+(bestCircuit.wins>1?"s":"")+'</span>';if(bestCircuit.podiums>0)html+='<span><strong style="color:#FBBF24">'+bestCircuit.podiums+'</strong> podium'+(bestCircuit.podiums>1?"s":"")+'</span>';if(bestCircuit.poles>0)html+='<span><strong style="color:#A855F7">'+bestCircuit.poles+'</strong> pole'+(bestCircuit.poles>1?"s":"")+'</span>';html+='<span><strong style="color:var(--text)">'+bestCircuit.races+'</strong> course'+(bestCircuit.races>1?"s":"")+'</span></div></div></div>';html+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin:0 14px 14px">'+'<div style="padding:9px 6px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;text-align:center"><div style="font-family:var(--font-display);font-size:9px;color:var(--text3);letter-spacing:.12em">CIRCUITS</div><div style="font-family:var(--font-display);font-size:18px;font-weight:900;color:var(--text);margin-top:2px">'+totalCircuits+'</div></div>'+'<div style="padding:9px 6px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;text-align:center"><div style="font-family:var(--font-display);font-size:9px;color:var(--text3);letter-spacing:.12em">COURSES</div><div style="font-family:var(--font-display);font-size:18px;font-weight:900;color:var(--text);margin-top:2px">'+totalRaces+'</div></div>'+'<div style="padding:9px 6px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;text-align:center"><div style="font-family:var(--font-display);font-size:9px;color:var(--text3);letter-spacing:.12em">/ CIRCUIT</div><div style="font-family:var(--font-display);font-size:18px;font-weight:900;color:var(--text);margin-top:2px">'+(totalCircuits>0?(totalRaces/totalCircuits).toFixed(1):"0")+'</div></div>'+'</div>';html+='<div style="margin:0 14px 6px;font-family:var(--font-display);font-size:10px;font-weight:700;color:var(--text3);letter-spacing:.18em;text-transform:uppercase">Détails par circuit</div>';html+='<div style="margin:0 14px;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--surface2)">';circuits.forEach(function(c,i){var heatScore=c.score;var maxScore=circuits[0].score||1;var heatPct=Math.max(0,Math.min(100,(heatScore/maxScore)*100));var heatColor;if(heatPct>=75)heatColor="#F59E0B";else if(heatPct>=50)heatColor="#FBBF24";else if(heatPct>=25)heatColor="#9CA3AF";else heatColor="#6B7280";var perfBadge="";if(c.wins>=3)perfBadge='<span style="display:inline-flex;align-items:center;font-family:var(--font-display);font-size:8.5px;font-weight:800;color:#F59E0B;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.30);padding:1px 6px;border-radius:3px;letter-spacing:.08em">DOMINATION</span>';else if(c.wins>0)perfBadge='<span style="display:inline-flex;align-items:center;font-family:var(--font-display);font-size:8.5px;font-weight:800;color:#34D399;background:rgba(52,211,153,0.12);border:1px solid rgba(52,211,153,0.30);padding:1px 6px;border-radius:3px;letter-spacing:.08em">VAINQUEUR</span>';else if(c.podiums>0)perfBadge='<span style="display:inline-flex;align-items:center;font-family:var(--font-display);font-size:8.5px;font-weight:800;color:#FBBF24;background:rgba(251,191,36,0.12);border:1px solid rgba(251,191,36,0.30);padding:1px 6px;border-radius:3px;letter-spacing:.08em">PODIUM</span>';else if(c.dnfs>=2)perfBadge='<span style="display:inline-flex;align-items:center;font-family:var(--font-display);font-size:8.5px;font-weight:800;color:#EF4444;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.30);padding:1px 6px;border-radius:3px;letter-spacing:.08em">MAUDIT</span>';html+='<div style="display:flex;align-items:center;gap:11px;padding:11px 14px;'+(i<circuits.length-1?"border-bottom:1px solid var(--border)":"")+'">';html+='<div style="position:relative;width:6px;height:38px;flex-shrink:0;border-radius:3px;background:rgba(255,255,255,0.04);overflow:hidden"><div style="position:absolute;left:0;right:0;bottom:0;height:'+heatPct+'%;background:linear-gradient(180deg,'+heatColor+' 0%,'+heatColor+'88 100%);border-radius:3px;transition:height .4s"></div></div>';html+='<div style="flex:1;min-width:0">';html+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap"><span style="font-family:var(--font-display);font-size:13px;font-weight:800;color:var(--text);letter-spacing:.01em;line-height:1.1">'+c.name+'</span>'+perfBadge+'</div>';html+='<div style="font-size:10.5px;color:var(--text3);display:flex;gap:10px;flex-wrap:wrap">';html+='<span>'+c.races+' course'+(c.races>1?"s":"")+'</span>';if(c.bestPos!==null)html+='<span>Best: <strong style="color:'+(c.bestPos===1?"#F59E0B":c.bestPos<=3?"#FBBF24":"var(--text2)")+'">P'+c.bestPos+'</strong></span>';if(c.countedRaces>0)html+='<span>Moy: <strong style="color:var(--text2)">P'+c.avgPos.toFixed(1)+'</strong></span>';if(c.wins>0)html+='<span style="color:#F59E0B">'+renderIcon('trophy',14,'#F59E0B')+' '+c.wins+'</span>';if(c.podiums>c.wins)html+='<span style="color:#FBBF24">'+renderIcon('medal',14,'#C07840')+' '+(c.podiums-c.wins)+'</span>';if(c.dnfs>0)html+='<span style="color:#EF4444">DNF '+c.dnfs+'</span>';html+='</div>';html+='</div>';html+='</div>'});html+='</div>';container.innerHTML=html}catch(e){console.warn("renderCircuitStats:",e);container.innerHTML='<div style="margin:10px 14px;padding:14px;color:var(--text3);font-size:12px">Erreur — '+(e.message||"")+'</div>'}}
function renderF1Stats(){var e=getF1Stats(),t=(window.CAREER_HISTORY||[]).filter(function(e){return"Formule 1"===e.cat}),r="F1"===G.cat,n;if(!e.inF1&&0===e.seasons)return(n=document.getElementById("f1s-summary"))&&(n.innerHTML='<div style="padding:14px 16px;font-size:13px;color:var(--text3);grid-column:1/-1">Tu n\'as pas encore atteint la F1. Continue ta progression !</div>'),void["f1s-grid","f1s-seasons","f1s-wins"].forEach(function(e){var t=document.getElementById(e);t&&(t.innerHTML='<div style="padding:10px 16px;font-size:13px;color:var(--text3)">—</div>')});var a=e.races>0?Math.round(e.wins/e.races*100):0,i=e.races>0?Math.round(e.pods/e.races*100):0,n;(n=document.getElementById("f1s-summary"))&&(n.innerHTML=[{v:e.seasons,l:"Saisons F1"},{v:e.races,l:"Courses"},{v:e.wins,l:"Victoires"},{v:e.pods,l:"Podiums"},{v:e.titles,l:"Titres F1"},{v:e.pts,l:"Pts totaux"}].map(function(e){return'<div class="mc"><div class="mc-l">'+e.l+'</div><div class="mc-v">'+e.v+"</div></div>"}).join(""));var o=document.getElementById("f1s-grid");if(o){var s=[["Courses F1",e.races,null],["Victoires",e.wins,a+"%"],["Podiums",e.pods,i+"%"],["Top 5",e.top5,e.races>0?Math.round(e.top5/e.races*100)+"%":null],["Titres F1",e.titles,null],["Points totaux F1",e.pts,null],["Abandons (DNF)",e.dnfs,e.races>0?Math.round(e.dnfs/e.races*100)+"%":null],["Score Panthéon",calcHofScore().score+" / 100",null]];o.innerHTML='<div style="margin:0 16px 4px;border:1px solid var(--border);border-radius:14px;overflow:hidden;background:var(--surface2);position:relative"><div style="position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--red2)"></div>'+s.map(function(e,t){var r=t===s.length-1,n=e[0].includes("Victoires")?"var(--gold)":e[0].includes("Podiums")?"var(--teal,#34D399)":e[0].includes("Titres")?"#F59E0B":e[0].includes("Abandons")?"var(--red-light)":e[0].includes("Panthéon")?"#E040FB":"var(--text)";return'<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px 10px 18px;'+(r?"":"border-bottom:1px solid var(--border)")+'"><span style="font-size:13px;color:var(--text2)">'+e[0]+'</span><div style="display:flex;align-items:center;gap:10px">'+(e[2]?'<span style="font-family:var(--font-display);font-size:10px;font-weight:700;color:var(--text3);letter-spacing:.04em">'+e[2]+"</span>":"")+'<span style="font-family:var(--font-display);font-size:15px;font-weight:900;color:'+n+'">'+e[1]+"</span></div></div>"}).join("")+"</div>"}var l=document.getElementById("f1s-seasons");if(l){var c=t.slice();if(r&&G.races.length>0){var d=[{pts:G.champPts,me:!0}];G.rivals.forEach(function(e){d.push({pts:e.pts,me:!1})}),d.sort(function(e,t){return t.pts-e.pts}),c.push({saison:G.saison,cat:"Formule 1",pos:d.findIndex(function(e){return e.me})+1,pts:G.champPts,races:G.races.length,wins:G.races.filter(function(e){return 1===e.pos}).length,pods:G.races.filter(function(e){return e.pos<=3&&e.pos>=1}).length,top5:G.races.filter(function(e){return e.pos>=1&&e.pos<=5}).length,dnfs:G.races.filter(function(e){return 0===e.pos}).length,age:G.age,rating:calcPlayerRating(),current:!0})}c.length?l.innerHTML='<div style="margin:0 16px;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--surface2)">'+c.slice().reverse().map(function(e,t){var r=1===e.pos?"b-gold":e.pos<=3?"b-teal":"b-gray",n=1===e.pos?"":"",a=t===c.length-1,i=e.rating?getRatingTier(e.rating):null;return'<div style="padding:12px 14px;'+(a?"":"border-bottom:1px solid var(--border)")+(e.current?";background:#0D1A2A":"")+'"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px"><span style="font-size:13px;font-weight:700;color:var(--text)">F1 S'+e.saison+n+(e.current?' <span style="font-size:9px;color:var(--red);background:var(--red-bg);padding:1px 5px;border-radius:3px">EN COURS</span>':"")+'</span><div style="display:flex;align-items:center;gap:8px">'+(i?'<span style="font-size:13px;font-weight:900;color:'+i.color+'">'+e.rating+'<small style="font-size:9px;margin-left:1px">'+i.tier+"</small></span>":"")+'<span class="badge '+r+'">P'+e.pos+'</span></div></div><div style="display:flex;flex-wrap:wrap;gap:10px;font-size:11px;color:var(--text3)"><span>'+e.races+' courses</span><span style="color:var(--gold)">'+e.wins+" victoire"+(1!==e.wins?"s":"")+'</span><span style="color:var(--teal,#34D399)">'+e.pods+" podium"+(1!==e.pods?"s":"")+'</span><span style="color:var(--text3)">'+(e.top5||0)+' top5</span><span style="font-weight:700;color:'+(1===e.pos?"#F59E0B":"var(--text2)")+'">'+e.pts+' pts</span><span style="color:var(--text3)">Âge '+e.age+" ans</span></div></div>"}).join("")+"</div>":l.innerHTML='<div style="padding:12px 16px;font-size:13px;color:var(--text3)">Aucune saison F1 terminée.</div>'}var p=document.getElementById("f1s-wins");if(p){var u=[];t.forEach(function(e){e.raceDetails&&e.raceDetails.forEach(function(t){u.push(Object.assign({},t,{saison:e.saison}))})}),r&&G.races.forEach(function(e){u.push(Object.assign({},e,{saison:G.saison}))});var f=u.filter(function(e){return 1===e.pos}).slice(0,8);f.length?p.innerHTML='<div style="margin:0 16px;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--surface2)"><div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.07em">'+f.length+" victoire"+(f.length>1?"s":"")+" en F1</div>"+f.map(function(e,t){return'<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;'+(t<f.length-1?"border-bottom:1px solid var(--border)":"")+'"><span style="font-size:20px"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M8 21h8m-4-4v4M5 3H2l3 9a4 4 0 008 0l3-9h-3"/><path d="M19 3h3l-3 9"/></svg></span><div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--text)">'+e.nom+'</div><div style="font-size:11px;color:var(--text3);margin-top:1px">F1 · Saison '+e.saison+"</div></div>"+(e.team&&TEAM_LOGOS[e.team]?'<span style="display:inline-block;width:16px;height:16px;border-radius:2px;overflow:hidden;vertical-align:middle;margin-left:4px">'+TEAM_LOGOS[e.team].replace('width="40" height="40"','width="16" height="16"')+"</span>":"")+'<span class="badge b-gold">P1</span></div>'}).join("")+"</div>":p.innerHTML='<div style="padding:12px 16px;font-size:13px;color:var(--text3)">Aucune victoire en F1 encore.</div>'}}var _origShowSeasonEnd=showSeasonEnd;showSeasonEnd=function(){saveSeasonToHistory(),_origShowSeasonEnd()};var TEAM_RATINGS={},REGULATION_YEAR=1,TEAM_SEASON_DEV={};function getTeamSeasonDelta(e){return TEAM_SEASON_DEV[e]||(TEAM_SEASON_DEV[e]=0),TEAM_SEASON_DEV[e]}var TEAM_DEV_LOG=[];function getPlayerCarDevNews(){if(!G.currentTeam||"Indépendant"===G.currentTeam)return null;for(var e=G.races.length,t=null,r=TEAM_DEV_LOG.length-1;r>=0;r--){var n=TEAM_DEV_LOG[r];if(n.team===G.currentTeam&&n.saison===G.saison&&n.race===e){t=n;break}}return t}function getEffectiveTeamRating(e){var t=getTeamRatings();return t&&t[e]?Math.max(50,Math.min(99,t[e]+getTeamSeasonDelta(e))):72}function teamRatingToBonus(e){var t,r=(e-75)/100,n;return(.85*r+(r>=0?r*r*.4:-r*r*.4))*_getCarPerformanceWeight(G.cat)}function _getCarPerformanceWeight(e){switch(e){case"Karting Junior":return.4;case"Karting Senior":return.55;case"Formule 4":return.85;case"Formula Regional":return.95;case"Formule 3":case"IndyCar":return 1.05;case"Formule 2":return 1.25;case"Formule 1":return 1.6;case"Super Formula":return 1.2;case"Endurance WEC":return 1.4;default:return 1}}var TEAM_PRESTIGE={Ferrari:98,McLaren:96,Mercedes:95,"Red Bull Racing":94,Williams:92,Alpine:89,"Aston Martin":88,"Kick Sauber":87,"Racing Bulls":86,"Haas F1 Team":86,"Prema Racing":85,"ART Grand Prix":82,DAMS:76,Carlin:76,"MP Motorsport":72,"Hitech GP":72,"R-ace GP":72,"Campos Racing":70,Trident:68,"Virtuosi Racing":68,"Van Amersfoort Racing":68,"US Racing":66,"Jenzer Motorsport":64,"Iron Lynx":64,"Antonelli Motorsport":62,"Cram Motorsport":60,"Rodin Motorsport":60,"PHM Racing":60,"Bhaitech Racing":58,"BWR Motorsport":57,"Mugen F4":58,"G4 Racing":56,"EFC Sports":55,"Charouz Racing":58,"Xcel Racing":54,"AIX Racing":55,"Monolite Racing":52,"AKM Motorsport":52,"Tony Kart":72,"Birel ART":68,"OTK Kart Group":68,"CRG Racing":66,"Parolin Motorsport":66,"Kosmic Racing":62,"Sodi Kart":62,"KR Sport":64,"Ricciardo Kart":58,"DR Kart":58,"Exprit Racing":58,"Praga Kart":54,"Zanardi Kart":52,"Energy Corse":52,"Formula K":48,"LN Racing Kart":48,"Alpha Kart":46,"Lenze Kart":44,"Toyota Gazoo Racing":85,"Honda Racing":82,Mugen:78,"Nakajima Racing":74,"Itochu Enex Team Impul":72,"Cerumo Inging":68,"Kondoh Racing":66,"Real Racing":62,"Kygnus Sunoco Team":62,"TGM Grand Prix":58,"Ferrari AF Corse":85,"Porsche Penske Motorsport":84,"AF Corse":78,"BMW M Team":76,"Cadillac Racing":74,"Alpine Endurance":74,"Peugeot TotalEnergies":70,"United Autosports":68,"Proton Competition":62,"Richard Mille Racing":60,"Glickenhaus Racing":58,"Cool Racing":58,"Inter Europol Competition":56,"Inception Racing":54,"Team Penske":85,"Chip Ganassi Racing":84,"Andretti Global":80,"Arrow McLaren":78,"Rahal Letterman Lanigan":74,"AJ Foyt Enterprises":70,"Meyer Shank Racing":66,"Ed Carpenter Racing":64,"Dale Coyne Racing":60,"Juncos Hollinger Racing":58,"Dreyer Reinbold Racing":56,"ECR / Foyt":62};function getTeamPrestige(e){return e&&TEAM_PRESTIGE[e]||70}var TEAM_PRESTIGE_HISTORY={};function _getTeamAverageStaffRating(e,t){if(void 0===STAFF_BY_TEAM||!STAFF_BY_TEAM[t]||!STAFF_BY_TEAM[t][e])return 70;var r=STAFF_BY_TEAM[t][e],n=0,a=0;return["tp","dir_sport","dir_tech","race_eng"].forEach(function(e){r[e]&&r[e].rating&&(n+=r[e].rating,a++)}),a>0?n/a:70}function evolveTeamPrestige(e){var t;Object.keys(TEAMS_BY_CAT).forEach(function(t){var r=TEAMS_BY_CAT[t]||[];if(0!==r.length){var n=TEAM_RATINGS[t+"_"+e]||{},a=r.slice().sort(function(e,t){return(n[t]||70)-(n[e]||70)});r.forEach(function(i){var o=TEAM_PRESTIGE[i];if(void 0!==o){var s=a.indexOf(i),l=r.length,c=(l/2-s)/(l/2)*3,d,p,u=((n[i]||70)-Object.values(n).reduce(function(e,t){return e+t},0)/(Object.keys(n).length||1))/10,f=0,m;if(t===G.cat)f=(_getTeamAverageStaffRating(i,t)-72)/10;var g=.5*c+.3*u+.3*f;o>=92?g*=.5:o>=85&&(g*=.7),o<=55&&(g*=.7);var h,v=o+Math.max(-3,Math.min(3,g)),x;v=(TEAMS_BY_CAT["Formule 1"]||[]).indexOf(i)>=0?Math.max(86,Math.min(98,v)):Math.max(40,Math.min(85,v)),v=Math.round(v),TEAM_PRESTIGE_HISTORY[i]||(TEAM_PRESTIGE_HISTORY[i]=[]),TEAM_PRESTIGE_HISTORY[i].push({saison:e,from:o,to:v,delta:v-o}),TEAM_PRESTIGE_HISTORY[i].length>10&&TEAM_PRESTIGE_HISTORY[i].shift(),TEAM_PRESTIGE[i]=v}})}})}var TEAMS_BY_CAT={"Karting Junior":[],"Karting Senior":["Tony Kart","Exprit Racing","KR Sport","Parolin Motorsport","Birel ART","CRG Racing","Zanardi Kart","Kosmic Racing","LN Racing Kart","Ricciardo Kart","OTK Kart Group","Formula K","Sodi Kart","Praga Kart","Alpha Kart","DR Kart","Energy Corse","Lenze Kart"],"Formule 4":["Prema Racing","Van Amersfoort Racing","PHM Racing","US Racing","Jenzer Motorsport","Campos Racing","BWR Motorsport","Iron Lynx","Cram Motorsport","Bhaitech Racing","Xcel Racing","Antonelli Motorsport","Mugen F4","AKM Motorsport","EFC Sports"],"Formula Regional":["ART Grand Prix","Prema Racing","R-ace GP","MP Motorsport","Trident","Hitech GP","Bhaitech Racing","Jenzer Motorsport","US Racing","Cram Motorsport","G4 Racing","EFC Sports","Campos Racing","Van Amersfoort Racing"],"Formule 3":["Prema Racing","ART Grand Prix","Hitech GP","DAMS","Trident","MP Motorsport","Campos Racing","Jenzer Motorsport","PHM Racing","Van Amersfoort Racing","Carlin","Rodin Motorsport","AIX Racing","Charouz Racing","Monolite Racing"],"Formule 2":["Prema Racing","ART Grand Prix","Virtuosi Racing","MP Motorsport","Hitech GP","DAMS","Trident","Campos Racing","Carlin","Van Amersfoort Racing","PHM Racing"],"Formule 1":["Red Bull Racing","Ferrari","McLaren","Mercedes","Aston Martin","Alpine","Williams","Racing Bulls","Haas F1 Team","Kick Sauber"],"Super Formula":["Toyota Gazoo Racing","Honda Racing","Nakajima Racing","Kondoh Racing","Cerumo Inging","Mugen","TGM Grand Prix","Itochu Enex Team Impul","Kygnus Sunoco Team","Real Racing"],"Endurance WEC":["Toyota Gazoo Racing","Ferrari AF Corse","Porsche Penske Motorsport","Cadillac Racing","BMW M Team","Peugeot TotalEnergies","Alpine Endurance","Glickenhaus Racing","United Autosports","AF Corse","Proton Competition","Cool Racing","Inter Europol Competition","Richard Mille Racing","Inception Racing"],IndyCar:["Team Penske","Chip Ganassi Racing","Andretti Global","Arrow McLaren","Rahal Letterman Lanigan","Ed Carpenter Racing","Dale Coyne Racing","AJ Foyt Enterprises","Dreyer Reinbold Racing","Juncos Hollinger Racing","ECR / Foyt","Meyer Shank Racing"]};function hasTeamPerf(){var e=TEAMS_BY_CAT[G.cat];return void 0!==e&&e.length>0}function initTeamRatings(e,t){var r=TEAMS_BY_CAT[e];if(r){var n=e+"_"+t;if(!TEAM_RATINGS[n]){var a,i=TEAM_RATINGS[e+"_"+(t-1)],o,s=t-REGULATION_YEAR>=5&&Math.random()<.25;s&&(REGULATION_YEAR=t,TEAM_RATINGS[n+"_reset"]=!0);var l={},c;r.forEach(function(e,t){if(s){var r=i&&i[e]>=85;l[e]=Math.round(Math.min(98,Math.max(60,60+38*Math.random()+(r?4:0))))}else if(i){var n=i[e]||70,a=n>85?-1:n<70?1:0,o=14*(Math.random()-.5)+a;o=Math.max(-8,Math.min(8,o)),l[e]=Math.round(Math.min(98,Math.max(58,n+o)))}else{var c=[92,90,89,87,82,77,72,68,65,62],d=10*(Math.random()-.5);l[e]=Math.round(Math.min(98,Math.max(58,(c[t]||62)+d)))}}),r.slice().sort(function(e,t){return l[t]-l[e]}).forEach(function(e,t){l[e]=Math.max(58,Math.min(98,l[e]+(0===t?0:.5*-t)))}),TEAM_RATINGS[n]=l}}}function getTeamRatings(){var e=G.cat+"_"+G.saison;return TEAM_RATINGS[e]||initTeamRatings(G.cat,G.saison),TEAM_RATINGS[e]}function renderConstructeurs(){var e=document.getElementById("constructeurs-table");if(e){var t=TEAMS_BY_CAT[G.cat];if(t&&t.length){var r={},n={};t.forEach(function(e){r[e]=0,n[e]=[]});var a=G.currentTeam&&t.indexOf(G.currentTeam)>=0?G.currentTeam:t[0];r[a]=(r[a]||0)+G.champPts,n[a].push({name:(G.pilot.prenom?G.pilot.prenom+" ":"")+G.pilot.nom,pts:G.champPts,me:!0}),G.rivals.forEach(function(e){var a=e.team||t[Math.floor(Math.random()*t.length)];r[a]||(r[a]=0),n[a]||(n[a]=[]),r[a]+=e.pts||0,n[a].push({name:e.name,pts:e.pts||0,me:!1})});var i=t.slice().sort(function(e,t){return(r[t]||0)-(r[e]||0)}),o=Math.max(1,r[i[0]]||1),s='<div class="t-sec">Constructeurs — '+G.cat+" "+gYear()+"</div>";s+='<div style="margin:0 14px 10px;border:1px solid var(--line);background:var(--bg3);overflow:hidden">',i.forEach(function(e,t){var a=r[e]||0,i=(n[e]||[]).sort(function(e,t){return t.pts-e.pts}),l=i.some(function(e){return e.me}),c=Math.round(a/o*100),d=t+1,p=1===d?"var(--gold)":2===d?"#9098b0":3===d?"#c07840":"var(--muted)",u=l?"var(--red2)":1===d?"var(--gold)":2===d?"#9098b0":3===d?"#c07840":"var(--line2)",f=e.replace(/'/g,"\'"),m=TEAM_LOGOS[e]?TEAM_LOGOS[e].replace('width="40" height="40"','width="22" height="22"'):"";s+='<div style="position:relative;padding:11px 14px 12px;border-bottom:1px solid var(--line);'+(l?"background:var(--red-lo)":"")+';cursor:pointer;-webkit-tap-highlight-color:transparent" onclick="showTeamProfileModal(\''+f+"')\">",l&&(s+='<div style="position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--red2)"></div>'),s+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">',s+='<span style="font-family:var(--font-display);font-size:20px;font-weight:900;color:'+p+';min-width:26px;line-height:1">'+d+"</span>",m&&(s+='<span style="display:inline-flex;width:22px;height:22px;overflow:hidden;flex-shrink:0">'+m+"</span>"),s+='<span style="flex:1;font-family:var(--font-display);font-size:14px;font-weight:700;color:'+(l?"var(--white)":"var(--text)")+';letter-spacing:.02em;text-transform:uppercase;line-height:1.1">'+e+"</span>",s+='<span style="font-family:var(--font-display);font-size:22px;font-weight:900;color:'+(l?"var(--red3)":"var(--white)")+';letter-spacing:-.01em;line-height:1">'+a+"</span>",s+='<span style="font-family:var(--font-display);font-size:9px;font-weight:700;color:var(--dim);letter-spacing:.14em;text-transform:uppercase;margin-left:-4px">PTS</span>',s+="</div>",s+='<div style="height:3px;background:var(--line);overflow:hidden">',s+='<div style="height:100%;width:'+c+"%;background:"+u+';transition:width .5s ease"></div>',s+="</div>",i.length>0&&(s+='<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:8px;font-family:var(--font-body)">',i.forEach(function(e){var t=e.me?"var(--red3)":"var(--soft)";s+='<span style="font-size:11.5px;color:'+t+";font-weight:"+(e.me?"700":"500")+';letter-spacing:.02em">'+e.name+' <span style="color:var(--muted);font-weight:500">'+e.pts+"</span></span>"}),s+="</div>"),s+="</div>"}),s+="</div>",e.innerHTML=s}else e.innerHTML='<div style="margin:14px 16px;padding:14px 16px;border:1px solid var(--line);background:var(--bg3);font-size:13px;color:var(--muted);font-family:var(--font-body);line-height:1.5">Classement constructeurs disponible à partir de la F4.</div>'}}function renderTeamPerf(){var e=document.getElementById("team-perf-content");if(e)if(hasTeamPerf()){var t=getTeamRatings();if(t){var r,n=(TEAMS_BY_CAT[G.cat]||[]).slice().sort(function(e,r){return t[r]-t[e]}),a=TEAM_RATINGS[G.cat+"_"+G.saison+"_reset"],i=G.cat+"_"+(G.saison-1),o=TEAM_RATINGS[i],s="";a&&(s+='<div style="margin:12px 14px 0;padding:12px 14px;border:1px solid var(--red2);border-left:3px solid var(--red2);background:var(--red-bg)"><div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:var(--red3);letter-spacing:.18em;text-transform:uppercase;margin-bottom:4px">Nouvelle réglementation</div><div style="font-size:12.5px;color:var(--text2);font-family:var(--font-body);line-height:1.5">Les cartes ont été redistribuées. Toutes les écuries repartent sur de nouveaux concepts.</div></div>'),s+='<div class="t-sec">Performances '+gYear()+" — "+G.cat+"</div>",s+='<div style="margin:0 14px 10px;border:1px solid var(--line);background:var(--bg3);overflow:hidden">',n.forEach(function(e,r){var n=t[e]||65,a=Math.max(1,Math.round((n-55)/43*100)),i=r+1,l=G.currentTeam===e,c=e.replace(/'/g,"\'"),d=n>=88?"S":n>=80?"A":n>=72?"B":"C",p=n>=88?"var(--gold)":n>=80?"var(--amber)":n>=72?"var(--soft)":"var(--muted)",u=n>=88?"var(--gold-bg)":n>=80?"var(--amber-bg)":n>=72?"rgba(152,152,184,.08)":"rgba(96,96,122,.08)",f=l?"var(--red2)":p,m="";if(o&&o[e]){var g=n-o[e];g>=3?m='<span style="font-family:var(--font-display);font-size:11px;font-weight:700;color:var(--green);letter-spacing:.04em">▲'+g+"</span>":g<=-3&&(m='<span style="font-family:var(--font-display);font-size:11px;font-weight:700;color:var(--red3);letter-spacing:.04em">▼'+Math.abs(g)+"</span>")}var h=getTeamSeasonDelta(e),v=getEffectiveTeamRating(e),x="";if(0!==h&&G.races.length>0){var y=h>0?"+":"",b=Math.round(h),A;if(0!==b)x='<span style="font-family:var(--font-display);font-size:10px;font-weight:700;color:'+(b>0?"var(--green)":"var(--red3)")+';letter-spacing:.08em">'+y+b+"</span>"}var w=TEAM_LOGOS[e]?'<span style="display:inline-flex;width:22px;height:22px;overflow:hidden;flex-shrink:0">'+TEAM_LOGOS[e].replace('width="40" height="40"','width="22" height="22"')+"</span>":"";s+='<div style="position:relative;padding:11px 14px 12px;border-bottom:1px solid var(--line);'+(l?"background:var(--red-lo)":"")+';cursor:pointer;-webkit-tap-highlight-color:transparent" onclick="showTeamProfileModal(\''+c+"')\">",l&&(s+='<div style="position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--red2)"></div>'),s+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">',s+='<span style="font-family:var(--font-display);font-size:18px;font-weight:900;color:'+(l?"var(--red3)":"var(--muted)")+';min-width:22px;line-height:1">'+i+"</span>",w&&(s+=w),s+='<span style="flex:1;font-family:var(--font-display);font-size:14px;font-weight:700;color:'+(l?"var(--white)":"var(--text)")+';letter-spacing:.02em;text-transform:uppercase;line-height:1.1">'+e+"</span>",m&&(s+=m),x&&(s+=x),s+='<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:'+u+";border:1px solid "+p+"55;font-family:var(--font-display);font-size:11px;font-weight:900;color:"+p+';line-height:1">'+d+"</span>",s+='<span style="font-family:var(--font-display);font-size:20px;font-weight:900;color:'+(l?"var(--white)":"var(--text)")+';min-width:30px;text-align:right;line-height:1">'+v+"</span>",s+="</div>",s+='<div style="height:3px;background:var(--line);overflow:hidden">',s+='<div style="height:100%;width:'+a+"%;background:"+f+';transition:width .5s ease"></div>',s+="</div>",s+="</div>"}),s+="</div>";var l=n[0],c=n[1],d=n[2],p=t[l],u=p-t[c],f=p-t[n[n.length-1]],m=G.currentTeam&&"Indépendant"!==G.currentTeam?G.currentTeam:null,g=m?n.indexOf(m)+1:0,h=m?t[m]||70:0,v=m?p-h:0,x=[],y="";y=u>=6?"<strong>"+l+"</strong> est <strong>l'écurie à battre</strong> cette saison, avec un net avantage sur "+c+".":u>=3?"<strong>"+l+"</strong> mène la grille, mais <strong>"+c+"</strong> peut la bousculer.":"<strong>"+l+"</strong> et <strong>"+c+"</strong> sont au coude-à-coude en tête. Le titre constructeurs se jouera à rien.",d&&t[d]>=p-4&&(y+=" <strong>"+d+"</strong> peut s'inviter dans la bataille."),x.push(y);var b="";if(b=f<8?"Grille <strong>exceptionnellement serrée</strong> — chaque course peut produire un résultat surprenant.":f<15?"Écarts modérés sur la grille, les <strong>outsiders ont leur chance</strong> sur les bons weekends.":f<25?"Hiérarchie <strong>nettement établie</strong>, les top teams domineront sauf accident.":"Écarts énormes sur la grille. Pour les petites équipes, rentrer dans les points sera l'objectif.",x.push(b),m&&g>0){var A="",w=n.length,M=Math.max(2,Math.floor(.25*w)),E=Math.floor(.66*w),T;A=1===g?"Tu es chez <strong>"+m+"</strong>, l'écurie de référence. L'objectif affiché : <strong>titre pilote et constructeurs</strong>. Une saison sans victoire serait un échec retentissant.":g<=M?"Tu es chez <strong>"+m+"</strong>, l'une des écuries de pointe. Ambition réaliste : <strong>viser le titre</strong>, finir dans le top 3 constructeurs au minimum.":g<=E?"Tu es chez <strong>"+m+"</strong>, bien installé dans le milieu de grille. Objectif : <strong>accrocher des podiums</strong> quand la course l'autorise, et battre systématiquement les écuries autour de la vôtre.":"Tu es chez <strong>"+m+"</strong>, une écurie qui joue plus loin sur la grille. Chaque entrée dans les <strong>points sera une petite victoire</strong>. Un podium opportuniste peut transformer ta saison.",x.push(A)}var k=x.join(" ");s+='<div class="t-sec">Analyse de la saison</div>',s+='<div style="margin:0 14px 14px;padding:13px 15px;border:1px solid var(--line);border-left:2px solid var(--red2);background:var(--bg3)"><div style="font-family:var(--font-body);font-size:13px;color:var(--text2);line-height:1.6">'+k+"</div></div>",s+='<div style="height:12px"></div>',e.innerHTML=s}}else e.innerHTML='<div style="margin:14px 16px;padding:14px 16px;border:1px solid var(--line);background:var(--bg3);font-size:13px;color:var(--muted);font-family:var(--font-body);line-height:1.5">Les performances des écuries ne s\'appliquent pas en karting.</div>'}
/* =====================================================================
   PATCH SYSTÈME D'ÉVÉNEMENTS DE COURSE — v2 RÉALISTE
   =====================================================================
   1. Tous les événements legacy prennent en compte position réelle, écart
      en secondes et nom des rivaux.
   2. Les choix qui mentionnent un pit stop déclenchent automatiquement
      _playerPit (auto-détection par texte).
   3. Filtre les événements pour ne mentionner que les rivaux à portée
      crédible (≤ 6s).
   4. Ligne de contexte (P, écart devant/derrière) injectée dans chaque
      modal d'événement.
   ===================================================================== */
;(function(){
  if (typeof window === 'undefined') return;
  var GR = window;

  /* === 1. CONTEXTE & UTILITAIRES === */

  function _gapBetween(a, b) {
    if (!a || !b) return null;
    var sa = (a.score || 0) - ((a.penaltySec || 0) / 45);
    var sb = (b.score || 0) - ((b.penaltySec || 0) / 45);
    return Math.abs(sa - sb) * 45;
  }

  function _aliveSorted() {
    if (typeof GR.LIVE_RACE === 'undefined' || !GR.LIVE_RACE || !GR.LIVE_RACE.drivers) return [];
    return GR.LIVE_RACE.drivers.filter(function(d){ return !d.dnf; })
      .slice().sort(function(a, b){ return (a.pos || 99) - (b.pos || 99); });
  }

  function _getPlayer() {
    if (typeof GR.LIVE_RACE === 'undefined' || !GR.LIVE_RACE || !GR.LIVE_RACE.drivers) return null;
    return GR.LIVE_RACE.drivers.find(function(d){ return d.isPlayer; }) || null;
  }

  function _driverAhead() {
    var p = _getPlayer(); if (!p || p.dnf) return null;
    var sorted = _aliveSorted();
    var idx = sorted.findIndex(function(d){ return d.isPlayer; });
    return idx > 0 ? sorted[idx - 1] : null;
  }

  function _driverBehind() {
    var p = _getPlayer(); if (!p || p.dnf) return null;
    var sorted = _aliveSorted();
    var idx = sorted.findIndex(function(d){ return d.isPlayer; });
    return (idx >= 0 && idx < sorted.length - 1) ? sorted[idx + 1] : null;
  }

  function _shortName(d) {
    if (!d) return 'le pilote';
    if (d.isPlayer) {
      var pp = (typeof GR.G !== 'undefined' && GR.G && GR.G.pilot) ? GR.G.pilot : null;
      return pp ? (pp.nom || 'toi') : 'toi';
    }
    var n = (d.name || '').split(' ');
    return n[n.length - 1] || (d.name || 'rival');
  }

  function _fullName(d) {
    if (!d) return 'un rival';
    if (d.isPlayer) {
      var pp = (typeof GR.G !== 'undefined' && GR.G && GR.G.pilot) ? GR.G.pilot : null;
      return pp ? ((pp.prenom ? pp.prenom + ' ' : '') + (pp.nom || '')) : 'toi';
    }
    return d.name || 'un rival';
  }

  function _fmtGap(g) {
    if (g === null || g === undefined || isNaN(g)) return '';
    if (g < 0.1) return '0.1s';
    if (g < 10) return g.toFixed(1) + 's';
    return Math.round(g) + 's';
  }

  

  function _evtBuildContext() {
    var p = _getPlayer();
    if (!p) return null;
    var ahead = _driverAhead();
    var behind = _driverBehind();
    var leader = _aliveSorted()[0] || null;
    return {
      player: p,
      pos: p.pos || 99,
      total: (typeof GR.LIVE_RACE !== 'undefined' && GR.LIVE_RACE) ? GR.LIVE_RACE.drivers.length : 20,
      isLeader: (p.pos || 99) === 1,
      ahead: ahead,
      behind: behind,
      leader: leader,
      gapAhead: ahead ? _gapBetween(p, ahead) : null,
      gapBehind: behind ? _gapBetween(p, behind) : null,
      gapLeader: (leader && !leader.isPlayer) ? _gapBetween(p, leader) : 0,
      aheadName: ahead ? _shortName(ahead) : null,
      behindName: behind ? _shortName(behind) : null,
      leaderName: leader ? _shortName(leader) : null,
      aheadFull: ahead ? _fullName(ahead) : null,
      behindFull: behind ? _fullName(behind) : null,
      lap: (typeof GR.LIVE_RACE !== 'undefined' && GR.LIVE_RACE) ? GR.LIVE_RACE.cur : 0,
      totalLaps: (typeof GR.LIVE_RACE !== 'undefined' && GR.LIVE_RACE) ? GR.LIVE_RACE.total : 0
    };
  }

  GR._evtBuildContext = _evtBuildContext;
  GR._evtCtxHelpers = {
    gapBetween: _gapBetween, aliveSorted: _aliveSorted, getPlayer: _getPlayer,
    driverAhead: _driverAhead, driverBehind: _driverBehind,
    shortName: _shortName, fullName: _fullName, fmtGap: _fmtGap
  };

  /* === 2. AUTO-DÉTECTION PIT STOP DANS UN CHOIX === */

  function _choiceImpliesPitStop(choiceText) {
    if (!choiceText) return false;
    var t = String(choiceText).toLowerCase();

    // Patterns négatifs (le joueur ne rentre PAS aux stands)
    var neg = [
      /rester\s+en\s+piste/i, /ne\s+pas\s+s'arrêter/i, /ne\s+pas\s+rentrer/i,
      /sans\s+pit/i, /pas\s+s'arrêter/i, /lever\s+le\s+pied/i,
      /attendre\s+(que|1-2|un\s+tour|et\s+voir|une\s+meilleure|la\s+fin)/i,
      /économiser\s+les\s+gommes/i,
      /suivre\s+la\s+stratégie\s+initiale/i, /respecter\s+la\s+stratégie\s+initiale/i,
      /ignorer.*stratégie/i, /wave-around/i,
      /accepter\s+et\s+sécuriser/i, /défense\s+aérodynamique/i,
      /tenir\s+avec\s+les\s+pneus/i, /push\s+to\s+pass/i, /tour\s+rapide/i,
      /rythme\s+constant/i, /tenir\s+l'écart/i, /finir\s+proprement/i,
      /finir\s+la\s+course/i, /mode\s+(survie|gestion|protection|fiabilité|attaque|intermédiaire)/i,
      /serrer\s+les\s+dents/i, /pousser\s+encore\s+\d+/i, /allonger\s+encore/i,
      /rester\s+en\s+slicks/i, /garder\s+les\s+inters/i,
      /continuer.*ignorer/i, /continuer\s+à\s+attaquer/i, /continuer\s+et\s+ignorer/i,
      /signaler\s+(à|au)/i, /tester\s+encore/i,
      /pousser\s+fort\s+avant\s+le\s+(changement|relais)/i,
      /préserver\s+la\s+voiture/i,
      /gérer\s+(les|et|jusqu|doucement|le|la|ta|ton)/i,
      /sécuriser\s+(la|ta|ton|sa)/i,
      /maintenir\s+le\s+rythme/i, /confirmer\s+et\s+maintenir/i,
      /demander\s+(une|un|si|des)/i, /attaque\s+totale/i,
      /pression\s+progressive/i, /défense\s+(totale|propre|active|agressive|à|sans|intelligente)/i,
      /attaquer\s+(à|le|chaque|sans|maintenant|seulement)/i,
      /défendre\s+(comme|sans|tes|le)/i,
      /forcer\s+(le|la|au)/i, /tenter\s+(l|le|la)/i, /freiner\s+(classique|tardivement|ultra)/i,
      /freinage\s+(tardif|ultra)/i, /accélérer\s+(pur|fort)/i,
      /couper\s+(sur|court|l)/i, /jouer\s+propre/i,
      /pousser\s+(le|fort|à)/i, /trajectoire\s+(défensive|idéale|prudente|extérieur|conservative)/i,
      /plonger\s+à\s+l'intérieur/i, /\bsortir\s+(de\s|au\s)/i, /forcer\s+la\s+porte/i,
      /lui\s+rendre/i, /rester\s+(propre|patient|collé|sage|dans|derrière)/i
    ];
    for (var i = 0; i < neg.length; i++) {
      if (neg[i].test(t)) return false;
    }

    // Patterns positifs (le joueur RENTRE aux stands)
    var pos = [
      /pit\s*stop/i,
      /\bpit\s+(maintenant|défensif|immédiat|agressif|d'urgence|fcy|vsc|—)/i,
      /rentrer\s+(maintenant|au\s*stand|aux\s*stands|immédiat|tout\s*de\s*suite|vérifier)/i,
      /aux?\s+stands?\s+(maintenant|immédiat|tout\s*de\s*suite|—|gratuits|—\s+pneus)/i,
      /au\s+stand\s+(tout|maintenant|immédiat)/i,
      /passer\s+aux?\s+(slicks|pneus\s*pluie|inters|tendres|durs|mediums?|médiums?|pneus\s*neufs|pneus\s*tendres|pneus\s*durs|wets?|full\s*wet)/i,
      /pour\s+(les?\s+)?(slicks|tendres|pneus\s*pluie|pneus\s*neufs|inters|wets?|full\s*wet)/i,
      /undercut/i, /double\s+pit/i,
      /pit.*pour\s+(les?|des?)\s+(slicks|tendres|inters|wets?|pneus)/i,
      /carburant\s+(seulement|et\s+pneus)/i,
      /pneus\s+pluie\s+extrêmes/i, /full\s+wet/i,
      /tout\s+changer/i, /\bbox-?box\b/i,
      /pneus\s+neufs.*maintenant/i, /relais.*parfait/i
    ];
    for (var j = 0; j < pos.length; j++) {
      if (pos[j].test(t)) return true;
    }
    return false;
  }

  function _forcePlayerPit() {
    try {
      if (typeof GR._playerPit !== 'function') return false;
      if (typeof GR._pitEnabledForCurrentRace === 'function' && !GR._pitEnabledForCurrentRace()) return false;
      if (typeof GR.LIVE_RACE === 'undefined' || !GR.LIVE_RACE || !GR.LIVE_RACE.drivers) return false;
      var p = GR.LIVE_RACE.drivers.find(function(d){ return d.isPlayer; });
      if (!p || p.dnf) return false;
      var cfg = (typeof GR._pitConfigForCat === 'function') ? GR._pitConfigForCat() : null;
      if (!cfg || !cfg.enabled) return false;
      if ((p._pitsDone || 0) >= cfg.maxStops) return false;
      GR._playerPit(true);
      return true;
    } catch (e) {
      console.warn('_forcePlayerPit error:', e);
      return false;
    }
  }

  GR._evtForcePit = _forcePlayerPit;
  GR._evtChoiceImpliesPit = _choiceImpliesPitStop;

  /* === 3. WRAP resolveLiveEvent === */
  if (typeof GR.resolveLiveEvent === 'function') {
    var _origResolveLive = GR.resolveLiveEvent;
    GR.resolveLiveEvent = function(choiceIdx) {
      var willPit = false;
      try {
        var pendingEvt = (typeof GR.LIVE_RACE !== 'undefined' && GR.LIVE_RACE) ? GR.LIVE_RACE.pendingEvent : null;
        var chosen = pendingEvt && pendingEvt.choices ? pendingEvt.choices[choiceIdx] : null;
        if (chosen && !chosen._doPit && !chosen._weatherStrategy) {
          if (_choiceImpliesPitStop(chosen.text)) {
            chosen._doPit = true;
            willPit = true;
          }
        }
      } catch (e) { console.warn('resolveLiveEvent wrap:', e); }
      var ret = _origResolveLive.apply(this, arguments);
      if (willPit) setTimeout(function(){ _forcePlayerPit(); }, 150);
      return ret;
    };
  }

  /* === 4. WRAP resolveRaceEvt === */
  if (typeof GR.resolveRaceEvt === 'function') {
    var _origResolveRaceEvt = GR.resolveRaceEvt;
    GR.resolveRaceEvt = function(eIdx, choiceIdx) {
      try {
        var evt = (typeof GR.RACE_STATE !== 'undefined' && GR.RACE_STATE && GR.RACE_STATE.events) ? GR.RACE_STATE.events[eIdx] : null;
        var chosen = evt && evt.choices ? evt.choices[choiceIdx] : null;
        if (chosen && !chosen._doPit) {
          if (_choiceImpliesPitStop(chosen.text)) chosen._doPit = true;
        }
      } catch (e) { console.warn('resolveRaceEvt wrap:', e); }
      return _origResolveRaceEvt.apply(this, arguments);
    };
  }

  /* === 5. WRAP _riAhead / _riBehind — exclusion gap > 6s === */
  if (typeof GR._riAhead === 'function') {
    var _origRiAhead = GR._riAhead;
    GR._riAhead = function(n) {
      try {
        var sorted = _aliveSorted();
        var p = _getPlayer();
        if (!p || p.dnf) return _origRiAhead.apply(this, arguments);
        var idx = sorted.findIndex(function(d){ return d.isPlayer; });
        if (idx <= 0) return null;
        var maxN = n || 1;
        var candidates = [];
        for (var i = Math.max(0, idx - maxN); i < idx; i++) {
          var d = sorted[i];
          if (!d || d.isPlayer) continue;
          var gap = _gapBetween(p, d);
          if (gap === null || gap > 6) continue;
          if (typeof d.rivalIdx === 'number') candidates.push(d.rivalIdx);
        }
        return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
      } catch (e) {
        return _origRiAhead.apply(this, arguments);
      }
    };
  }

  if (typeof GR._riBehind === 'function') {
    var _origRiBehind = GR._riBehind;
    GR._riBehind = function(n) {
      try {
        var sorted = _aliveSorted();
        var p = _getPlayer();
        if (!p || p.dnf) return _origRiBehind.apply(this, arguments);
        var idx = sorted.findIndex(function(d){ return d.isPlayer; });
        if (idx < 0 || idx >= sorted.length - 1) return null;
        var maxN = n || 1;
        var candidates = [];
        for (var i = idx + 1; i <= Math.min(sorted.length - 1, idx + maxN); i++) {
          var d = sorted[i];
          if (!d || d.isPlayer) continue;
          var gap = _gapBetween(p, d);
          if (gap === null || gap > 6) continue;
          if (typeof d.rivalIdx === 'number') candidates.push(d.rivalIdx);
        }
        return candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : null;
      } catch (e) {
        return _origRiBehind.apply(this, arguments);
      }
    };
  }

  /* === 6. NORMALISATION DESC : remplacer gap fictif par gap réel === */
  function _normalizeLegacyEvent(evt) {
    if (!evt || !evt.desc) return evt;
    var p = _getPlayer();
    if (!p || p.dnf) return evt;
    var ahead = _driverAhead();
    var behind = _driverBehind();
    var gapAhead = ahead ? _gapBetween(p, ahead) : null;
    var gapBehind = behind ? _gapBetween(p, behind) : null;

    var desc = evt.desc;
    var fakeGapMatch = desc.match(/(\d+[,\.]\d+)s/);
    if (fakeGapMatch) {
      var refGap = null;
      if (/derrière|talonne|dans (ton|tes) (rétro|dos|roue)|colle ta roue|te suit|dans ton dos/i.test(desc) && gapBehind !== null) {
        refGap = gapBehind;
      } else if (/devant|sortir|tu colles|aspiration|à portée|est .*devant|dans (ton|les) échappements/i.test(desc) && gapAhead !== null) {
        refGap = gapAhead;
      }
      if (refGap !== null) {
        var fake = parseFloat(fakeGapMatch[1].replace(',', '.'));
        if (Math.abs(refGap - fake) / Math.max(fake, 0.5) > 0.3) {
          desc = desc.replace(/\d+[,\.]\d+s/, _fmtGap(refGap));
          evt.desc = desc;
        }
      }
    }
    return evt;
  }

  /* === 7. WRAP showLiveEvent — normalisation + ligne contexte === */
  if (typeof GR.showLiveEvent === 'function') {
    var _origShowLive = GR.showLiveEvent;
    GR.showLiveEvent = function(evt) {
      try { evt = _normalizeLegacyEvent(evt); } catch (e) { console.warn('normalize:', e); }
      var ret = _origShowLive.call(this, evt);
      try {
        var ctx = _evtBuildContext();
        if (!ctx) return ret;
        var card = document.getElementById('live-event-card');
        if (!card) return ret;
        var oldCtx = card.querySelector('.lec-position-context');
        if (oldCtx) oldCtx.remove();

        var bits = [];
        bits.push('<span style="font-family:var(--font-display);font-size:11px;font-weight:800;color:#FFD23F;letter-spacing:.05em">P' + ctx.pos + '</span>');
        if (ctx.ahead && ctx.gapAhead !== null && ctx.gapAhead < 8) {
          bits.push('<span style="font-size:10px;color:var(--text3)">+' + _fmtGap(ctx.gapAhead) + ' devant <strong style="color:var(--text2)">' + _ppEsc(ctx.aheadName) + '</strong></span>');
        }
        if (ctx.behind && ctx.gapBehind !== null && ctx.gapBehind < 8) {
          bits.push('<span style="font-size:10px;color:var(--text3)">−' + _fmtGap(ctx.gapBehind) + ' derrière <strong style="color:var(--text2)">' + _ppEsc(ctx.behindName) + '</strong></span>');
        }
        if (ctx.gapLeader > 0 && ctx.pos > 1 && ctx.gapLeader < 60) {
          bits.push('<span style="font-size:10px;color:var(--muted)">Leader ' + _ppEsc(ctx.leaderName) + ' à +' + _fmtGap(ctx.gapLeader) + '</span>');
        }
        if (bits.length <= 1) return ret;

        var ctxLine = document.createElement('div');
        ctxLine.className = 'lec-position-context';
        ctxLine.style.cssText = 'display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:7px 14px;background:rgba(255,210,63,0.06);border-bottom:1px solid rgba(255,210,63,0.18)';
        ctxLine.innerHTML = bits.join('');

        var broadcast = card.querySelector('#lec-broadcast-bar');
        if (broadcast && broadcast.nextSibling) {
          card.insertBefore(ctxLine, broadcast.nextSibling);
        } else {
          card.insertBefore(ctxLine, card.firstChild);
        }
      } catch (e) { console.warn('context line v1:', e); }
      return ret;
    };
  }

  /* === 8. WRAP showNextRaceEvent — ligne contexte V2 === */
  if (typeof GR.showNextRaceEvent === 'function') {
    var _origShowNextRE = GR.showNextRaceEvent;
    GR.showNextRaceEvent = function() {
      var ret = _origShowNextRE.apply(this, arguments);
      try {
        var ctx = _evtBuildContext();
        if (!ctx) return ret;
        var modal = document.getElementById('race-event-modal');
        if (!modal) return ret;
        var oldCtx = modal.querySelector('.race-evt-position-context');
        if (oldCtx) oldCtx.remove();

        var bits = [];
        bits.push('<span style="font-family:var(--font-display);font-size:11px;font-weight:800;color:#FFD23F;letter-spacing:.05em">P' + ctx.pos + '</span>');
        if (ctx.ahead && ctx.gapAhead !== null && ctx.gapAhead < 8) {
          bits.push('<span style="font-size:10px;color:var(--text3)">+' + _fmtGap(ctx.gapAhead) + ' devant <strong style="color:var(--text2)">' + _ppEsc(ctx.aheadName) + '</strong></span>');
        }
        if (ctx.behind && ctx.gapBehind !== null && ctx.gapBehind < 8) {
          bits.push('<span style="font-size:10px;color:var(--text3)">−' + _fmtGap(ctx.gapBehind) + ' derrière <strong style="color:var(--text2)">' + _ppEsc(ctx.behindName) + '</strong></span>');
        }
        if (bits.length <= 1) return ret;

        var ctxLine = document.createElement('div');
        ctxLine.className = 'race-evt-position-context';
        ctxLine.style.cssText = 'display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:7px 14px;background:rgba(255,210,63,0.06);border-bottom:1px solid rgba(255,210,63,0.18)';
        ctxLine.innerHTML = bits.join('');

        var card = modal.firstChild;
        if (card) {
          var firstHeader = card.firstChild;
          if (firstHeader && firstHeader.nextSibling) {
            card.insertBefore(ctxLine, firstHeader.nextSibling);
          } else if (firstHeader) {
            card.appendChild(ctxLine);
          }
        }
      } catch (e) { console.warn('context line v2:', e); }
      return ret;
    };
  }

  console.log('[event-system-patch] v2 loaded — pit auto-detect + gap-aware events + position context');
})();function _getCircuitCountry(n){var _M={"Bahrain":{name:"Bahreïn",flag:"🇧🇭"},"Jeddah":{name:"Arabie Saoudite",flag:"🇸🇦"},"Melbourne":{name:"Australie",flag:"🇦🇺"},"Miami":{name:"États-Unis",flag:"🇺🇸"},"Imola":{name:"Italie",flag:"🇮🇹"},"Monaco":{name:"Monaco",flag:"🇲🇨"},"Barcelone":{name:"Espagne",flag:"🇪🇸"},"Barcelona":{name:"Espagne",flag:"🇪🇸"},"Silverstone":{name:"Royaume-Uni",flag:"🇬🇧"},"Budapest":{name:"Hongrie",flag:"🇭🇺"},"Hungaroring":{name:"Hongrie",flag:"🇭🇺"},"Spa":{name:"Belgique",flag:"🇧🇪"},"Zandvoort":{name:"Pays-Bas",flag:"🇳🇱"},"Monza":{name:"Italie",flag:"🇮🇹"},"Singapore":{name:"Singapour",flag:"🇸🇬"},"Suzuka":{name:"Japon",flag:"🇯🇵"},"Austin":{name:"États-Unis",flag:"🇺🇸"},"Mexico":{name:"Mexique",flag:"🇲🇽"},"Sao Paulo":{name:"Brésil",flag:"🇧🇷"},"Las Vegas":{name:"États-Unis",flag:"🇺🇸"},"Abu Dhabi":{name:"Émirats",flag:"🇦🇪"},"Baku":{name:"Azerbaïdjan",flag:"🇦🇿"},"Portimao":{name:"Portugal",flag:"🇵🇹"},"Mugello":{name:"Italie",flag:"🇮🇹"},"Misano":{name:"Italie",flag:"🇮🇹"},"Vallelunga":{name:"Italie",flag:"🇮🇹"},"Red Bull Ring":{name:"Autriche",flag:"🇦🇹"},"Spielberg":{name:"Autriche",flag:"🇦🇹"},"Paul Ricard":{name:"France",flag:"🇫🇷"},"Okayama":{name:"Japon",flag:"🇯🇵"},"Autopolis":{name:"Japon",flag:"🇯🇵"},"Sugo":{name:"Japon",flag:"🇯🇵"},"Fuji Speedway":{name:"Japon",flag:"🇯🇵"},"Motegi":{name:"Japon",flag:"🇯🇵"},"Sapporo":{name:"Japon",flag:"🇯🇵"},"Sebring 12h":{name:"États-Unis",flag:"🇺🇸"},"Portimao 6h":{name:"Portugal",flag:"🇵🇹"},"Spa 6h":{name:"Belgique",flag:"🇧🇪"},"24h Le Mans":{name:"France",flag:"🇫🇷"},"Monza 6h":{name:"Italie",flag:"🇮🇹"},"Fuji 6h":{name:"Japon",flag:"🇯🇵"},"Bahrain 8h":{name:"Bahreïn",flag:"🇧🇭"},"Bahrain Final":{name:"Bahreïn",flag:"🇧🇭"},"St. Petersburg":{name:"États-Unis",flag:"🇺🇸"},"Texas":{name:"États-Unis",flag:"🇺🇸"},"Long Beach":{name:"États-Unis",flag:"🇺🇸"},"Indianapolis 500":{name:"États-Unis",flag:"🇺🇸"},"Detroit":{name:"États-Unis",flag:"🇺🇸"},"Road America":{name:"États-Unis",flag:"🇺🇸"},"Iowa":{name:"États-Unis",flag:"🇺🇸"},"Nashville":{name:"États-Unis",flag:"🇺🇸"},"Portland":{name:"États-Unis",flag:"🇺🇸"},"Laguna Seca":{name:"États-Unis",flag:"🇺🇸"},"Gateway":{name:"États-Unis",flag:"🇺🇸"},"Monterey":{name:"États-Unis",flag:"🇺🇸"},"GP Monaco Kart":{name:"Monaco",flag:"🇲🇨"},"GP Lyon":{name:"France",flag:"🇫🇷"},"GP Valencia":{name:"Espagne",flag:"🇪🇸"},"GP Spa Kart":{name:"Belgique",flag:"🇧🇪"},"GP Monza Kart":{name:"Italie",flag:"🇮🇹"},"GP Portimao":{name:"Portugal",flag:"🇵🇹"},"GP Zandvoort Kart":{name:"Pays-Bas",flag:"🇳🇱"},"GP Abu Dhabi Kart":{name:"Émirats",flag:"🇦🇪"},"GP Bahrain Kart":{name:"Bahreïn",flag:"🇧🇭"},"GP Silverstone Kart":{name:"Royaume-Uni",flag:"🇬🇧"},"GP Lorraine":{name:"France",flag:"🇫🇷"},"GP Alsace":{name:"France",flag:"🇫🇷"},"GP Normandie":{name:"France",flag:"🇫🇷"},"GP Bretagne":{name:"France",flag:"🇫🇷"},"GP Bourgogne":{name:"France",flag:"🇫🇷"},"GP Auvergne":{name:"France",flag:"🇫🇷"},"GP Picardie":{name:"France",flag:"🇫🇷"},"GP Provence":{name:"France",flag:"🇫🇷"},"GP Languedoc":{name:"France",flag:"🇫🇷"},"GP Cote Azur":{name:"France",flag:"🇫🇷"},"Macao GP":{name:"Macao",flag:"🇲🇴"},"Okayama Round 2":{name:"Japon",flag:"🇯🇵"},"Fuji Round 2":{name:"Japon",flag:"🇯🇵"},"Suzuka Final":{name:"Japon",flag:"🇯🇵"}};if(!n)return null;if(_M[n])return _M[n];for(var k in _M){if(n.indexOf(k)>=0||k.indexOf(n)>=0)return _M[k];}return null;}
function _updateRaceHeader(mancheNum, circuitName) {
  var titleEl    = document.getElementById("live-race-title");
  var subEl      = document.getElementById("live-race-sub");
  var flagEl     = document.getElementById("live-race-flag");
  var legacyTitle= document.getElementById("race-title");
  var legacySub  = document.getElementById("race-sub");
  var legacyFlag = document.getElementById("race-hdr-flag");
  var country = circuitName ? _getCircuitCountry(circuitName) : null;
  // Titre : "MANCHE N" sur une seule ligne
  var titleText = "MANCHE " + (mancheNum || 1);
  if (titleEl)     titleEl.textContent = titleText;
  if (legacyTitle) legacyTitle.textContent = titleText;
  // Sous-titre : Pays · Circuit
  var subText = country && circuitName ? country.name + " · " + circuitName
              : circuitName ? circuitName
              : (typeof G !== "undefined" && G.cat) ? G.cat : "";
  if (subEl)    subEl.textContent = subText;
  if (legacySub) legacySub.textContent = subText;
  // Drapeau : SVG via flagSvg() si disponible, sinon emoji, sinon vide
  if (flagEl) {
    flagEl.innerHTML = "";
    var natCode = country ? (country.natCode || _countryToNat(country.name)) : null;
    if (natCode && typeof flagSvg === "function") {
      try {
        var svgHtml = flagSvg(natCode, 32);
        if (svgHtml) { flagEl.innerHTML = svgHtml; flagEl.style.display = "flex"; }
        else { flagEl.textContent = country && country.flag ? country.flag : ""; }
      } catch(e) {
        flagEl.textContent = country && country.flag ? country.flag : "";
      }
    } else if (country && country.flag) {
      // Emoji drapeau dans un span sans fond ni carré
      flagEl.innerHTML = '<span style="font-size:20px;line-height:1">' + country.flag + '</span>';
    }
  }
  if (legacyFlag) legacyFlag.textContent = (country && country.flag) ? country.flag : "";
}

// Convertit un nom de pays FR vers un code nationalité
function _countryToNat(name) {
  var _M = {"Bahreïn":"BH","Arabie Saoudite":"SA","Australie":"AU","États-Unis":"US",
    "Italie":"IT","Monaco":"MC","Espagne":"ES","Royaume-Uni":"GB","Hongrie":"HU",
    "Belgique":"BE","Pays-Bas":"NL","Singapour":"SG","Japon":"JP","Mexique":"MX",
    "Brésil":"BR","Azerbaïdjan":"AZ","Portugal":"PT","Autriche":"AT","France":"FR",
    "Émirats":"AE","Macao":"MO"};
  return _M[name] || null;
}


/* ================================================================
 * _renderSeasonBanner — bandeau saison en cours sur l'écran HOME
 * Appelé par updateUI() — se place dans #rj-season-banner
 * ================================================================ */
function _renderSeasonBanner() {
  var el = document.getElementById('rj-season-banner');
  if (!el) return;
  try {
    var races = G.races || [];
    var cal = (typeof CAL_RACES !== 'undefined' && CAL_RACES) || [];
    var total = cal.length || 0;
    var done = races.length;
    var cat = G.cat || '';
    var champPts = G.champPts || 0;

    // Standings
    var standings = [{ pts: champPts, isPlayer: true }];
    (G.rivals || []).forEach(function(rv) {
      standings.push({ pts: rv.pts || 0, isPlayer: false, name: rv.name ? rv.name.split(' ').pop() : '' });
    });
    standings.sort(function(a, b) { return b.pts - a.pts; });
    var playerPos = standings.findIndex(function(s) { return s.isPlayer; }) + 1;
    var totalDrv = standings.length;

    // Momentum
    var mm = typeof _getMomentum === 'function' ? _getMomentum() : 'neutral';
    var mmData = {
      hot:     { icon: '🔥', color: '#F59E0B', label: 'En feu' },
      warm:    { icon: '⬆',  color: '#34D399', label: 'Bonne forme' },
      neutral: { icon: '→',  color: '#9CA3AF', label: 'Neutre' },
      cold:    { icon: '⬇',  color: '#60A5FA', label: 'Froid' },
      ice:     { icon: '❄',  color: '#A78BFA', label: 'En difficulté' },
      start:   { icon: '◦',  color: '#9CA3AF', label: 'Début' }
    };
    var mmD = mmData[mm] || mmData.neutral;

    // Trust
    var trust = (typeof TEAM_TRUST !== 'undefined') ? TEAM_TRUST.value : null;
    var hasTeam = !!(G.currentTeam && G.currentTeam !== 'Indépendant');
    var tColor = trust >= 70 ? '#34D399' : trust >= 45 ? '#60A5FA' : trust >= 25 ? '#F59E0B' : '#EF4444';

    // Objectifs saison en cours
    var objectives = (typeof TEAM_TRUST !== 'undefined' && TEAM_TRUST.objectives) || [];
    var objDone = objectives.filter(function(o) { return o.done; }).length;
    var objTotal = objectives.length;

    // Prochain circuit
    var nextRace = null;
    for (var ci = 0; ci < cal.length; ci++) {
      if (!cal[ci].done) { nextRace = cal[ci]; break; }
    }

    // Progress bar %
    var pct = total > 0 ? Math.round(done / total * 100) : 0;
    var champColor = playerPos === 1 ? '#F59E0B' : playerPos <= 3 ? '#34D399' : playerPos <= Math.ceil(totalDrv / 2) ? '#60A5FA' : '#9CA3AF';

    var html = '';

    // Ligne 1 : progression saison + rang champ
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';

    // Gauche : manche N/X + barre
    html += '<div style="flex:1;min-width:0;margin-right:12px">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">';
    html += '<span style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--text3);letter-spacing:.15em;text-transform:uppercase">';
    html += (done > 0 ? 'Manche ' + done + '/' + total : 'Saison ' + (G.saison || 1) + ' · ' + cat);
    html += '</span>';
    html += '<span style="font-family:var(--font-display);font-size:9px;color:var(--text3)">' + pct + '%</span>';
    html += '</div>';
    html += '<div style="height:4px;background:rgba(255,255,255,0.07);border-radius:2px;overflow:hidden">';
    html += '<div style="height:4px;background:var(--red2,#C8102E);border-radius:2px;width:' + pct + '%;transition:width .5s"></div>';
    html += '</div></div>';

    // Droite : position champ
    html += '<div style="text-align:center;flex-shrink:0">';
    html += '<div style="font-family:var(--font-display);font-size:22px;font-weight:900;color:' + champColor + ';line-height:1">P' + playerPos + '</div>';
    html += '<div style="font-family:var(--font-display);font-size:9px;color:var(--text3);margin-top:1px">' + champPts + ' pts</div>';
    html += '</div></div>';

    // Ligne 2 : momentum + trust (+ objectifs si dispo)
    html += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">';

    // Momentum pill
    html += '<div style="display:flex;align-items:center;gap:4px;padding:3px 8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:20px">';
    html += '<span style="font-size:11px">' + mmD.icon + '</span>';
    html += '<span style="font-family:var(--font-display);font-size:9px;font-weight:700;color:' + mmD.color + '">' + mmD.label + '</span>';
    html += '</div>';

    // Trust pill (si équipe)
    if (hasTeam && trust !== null) {
      var tLabel = trust >= 70 ? 'Confiance solide' : trust >= 45 ? 'Confiance neutre' : trust >= 25 ? 'Confiance fragile' : 'Confiance critique';
      html += '<div style="display:flex;align-items:center;gap:4px;padding:3px 8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:20px">';
      html += '<div style="width:5px;height:5px;border-radius:50%;background:' + tColor + ';flex-shrink:0"></div>';
      html += '<span style="font-family:var(--font-display);font-size:9px;font-weight:700;color:' + tColor + '">' + Math.round(trust) + '</span>';
      html += '<span style="font-size:9px;color:var(--text3)">' + (trust >= 70 ? '✓' : trust < 30 ? '!' : '') + '</span>';
      html += '</div>';
    }

    // Objectifs pill (si objectifs définis)
    if (objTotal > 0) {
      var objColor = objDone === objTotal ? '#34D399' : objDone > 0 ? '#F59E0B' : 'var(--text3)';
      html += '<div style="display:flex;align-items:center;gap:4px;padding:3px 8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:20px">';
      html += '<span style="font-family:var(--font-display);font-size:9px;font-weight:700;color:' + objColor + '">' + objDone + '/' + objTotal + '</span>';
      html += '<span style="font-size:9px;color:var(--text3)">objectifs</span>';
      html += '</div>';
    }

    // Rival direct
    var ahead = standings[Math.max(0, playerPos - 2)];
    if (ahead && !ahead.isPlayer && ahead.name) {
      var gap = ahead.pts - champPts;
      if (gap > 0 && gap < 100) {
        html += '<div style="display:flex;align-items:center;gap:4px;padding:3px 8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:20px">';
        html += '<span style="font-size:9px;color:#FBBF24;font-weight:700">-' + gap + 'pts</span>';
        html += '<span style="font-size:9px;color:var(--text3)">' + ahead.name + '</span>';
        html += '</div>';
      }
    }

    html += '</div>';

    el.innerHTML = html;
    el.style.display = '';
  } catch(e) {
    console.warn('_renderSeasonBanner:', e);
    el.style.display = 'none';
  }
}
function _buildChampImpactBlock(pos,pts){
  try {
    var standings=[{name:(G.pilot?(G.pilot.prenom?G.pilot.prenom[0]+". "+G.pilot.nom:G.pilot.nom):"Moi"),pts:G.champPts||0,isPlayer:true}];
    (G.rivals||[]).forEach(function(rv){standings.push({name:rv.name?rv.name.split(" ").pop():"Rival",pts:rv.pts||0,isPlayer:false});});
    standings.sort(function(a,b){return b.pts-a.pts;});
    var playerIdx=standings.findIndex(function(s){return s.isPlayer;});
    var playerPos=playerIdx+1;var total=standings.length;
    var near=standings.slice(Math.max(0,playerIdx-2),Math.min(total,playerIdx+3));
    var ptsBeforeRace=(G.champPts||0)-(pts||0);
    var standBefore=[{pts:ptsBeforeRace,isPlayer:true}];
    (G.rivals||[]).forEach(function(rv){standBefore.push({pts:rv.pts||0});});
    standBefore.sort(function(a,b){return b.pts-a.pts;});
    var posBefore=standBefore.findIndex(function(s){return s.isPlayer;})+1;
    var posChange=posBefore-playerPos;
    var champColor=playerPos===1?"#F59E0B":playerPos<=3?"#34D399":playerPos<=Math.ceil(total/2)?"#60A5FA":"#9CA3AF";
    var changeIcon=posChange>0?"▲":posChange<0?"▼":"—";
    var changeColor=posChange>0?"#34D399":posChange<0?"#EF4444":"#9CA3AF";
    var changeTxt=posChange>0?"+"+posChange+" place"+(posChange>1?"s":""):posChange<0?posChange+" place"+(posChange<-1?"s":""):"stable";
    var S="style";
    var div=document.createElement("div");
    div.setAttribute(S,"margin:8px 14px 0;padding:12px 14px;background:linear-gradient(135deg,rgba(34,211,238,0.07),rgba(168,85,247,0.06));border:1px solid rgba(34,211,238,0.20);border-radius:12px");
    var html="";
    html+="<div style='display:flex;align-items:center;justify-content:space-between;margin-bottom:10px'>";
    html+="<div style='font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--text3);letter-spacing:.18em;text-transform:uppercase'>Championnat</div>";
    html+="<div style='display:flex;align-items:center;gap:5px'>";
    html+="<span style='font-family:var(--font-display);font-size:11px;font-weight:800;color:"+changeColor+"'>"+changeIcon+"</span>";
    html+="<span style='font-size:10px;color:"+changeColor+"'>"+changeTxt+"</span></div></div>";
    html+="<div style='display:flex;align-items:baseline;gap:8px;margin-bottom:10px'>";
    html+="<span style='font-family:var(--font-display);font-size:36px;font-weight:900;color:"+champColor+";line-height:1'>P"+playerPos+"</span>";
    html+="<span style='font-size:12px;color:var(--text3)'>/"+total+"</span>";
    html+="<span style='font-family:var(--font-display);font-size:14px;font-weight:700;color:var(--text2);margin-left:4px'>"+(G.champPts||0)+" pts</span>";
    if(pts>0)html+="<span style='font-family:var(--font-display);font-size:11px;color:#34D399;margin-left:2px'>+"+pts+"</span>";
    html+="</div>";
    html+="<div style='display:flex;flex-direction:column;gap:3px'>";
    near.forEach(function(s){
      var sRank=standings.findIndex(function(x){return x.name===s.name&&x.isPlayer===s.isPlayer;})+1;
      var isP=s.isPlayer;
      var bg=isP?"background:rgba(200,16,46,0.08);border:1px solid rgba(200,16,46,0.20);":"background:rgba(255,255,255,0.03);border:1px solid transparent;";
      var rColor=sRank===1?"#F59E0B":sRank<=3?"#34D399":isP?champColor:"var(--text3)";
      var delta=s.pts-(G.champPts||0);
      var deltaStr=isP?"":(delta>0?"+"+delta:String(delta));
      var deltaCol=delta>0?"#EF4444":"#34D399";
      html+="<div style='display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:7px;"+bg+"'>";
      html+="<span style='font-family:var(--font-display);font-size:10px;font-weight:800;color:"+rColor+";width:22px;flex-shrink:0'>P"+sRank+"</span>";
      html+="<span style='font-size:11px;color:"+(isP?"var(--text)":"var(--text2)")+";flex:1;font-weight:"+(isP?700:400)+"'>"+(isP?"▶ ":"")+s.name+"</span>";
      html+="<span style='font-family:var(--font-display);font-size:11px;font-weight:700;color:var(--text2);width:36px;text-align:right'>"+s.pts+"</span>";
      if(deltaStr)html+="<span style='font-family:var(--font-display);font-size:9px;color:"+deltaCol+";width:30px;text-align:right'>"+deltaStr+"</span>";
      html+="</div>";
    });
    html+="</div>";
    var ahead=standings[Math.max(0,playerIdx-1)];
    if(ahead&&!ahead.isPlayer){
      var gap=ahead.pts-(G.champPts||0);
      html+="<div style='margin-top:8px;padding:6px 8px;background:rgba(251,191,36,0.06);border-radius:7px;font-size:10px;color:var(--text3)'>🎯 <span style='color:#FBBF24;font-weight:700'>"+gap+" pts</span> de retard sur "+ahead.name+"</div>";
    }
    div.innerHTML=html;
    return div;
  } catch(e){console.warn("_buildChampImpactBlock:",e);return null;}
}


