/* =============================================================================
 * 32-story-arcs.js — ARCS NARRATIFS MID-SEASON (la vie entre les courses)
 * =============================================================================
 *
 * OBJECTIF
 * --------
 * Ajouter des SITUATIONS QUI DURENT entre deux courses : des arcs multi-étapes
 * à état, avec décisions récurrentes et conséquences, surfacés dans un écran
 * dédié (S-arcs) + une notification dans la mailbox.
 *
 * NON-DUPLICATION (vérifié)
 * -------------------------
 * Ce module n'écrase rien. Il s'ajoute à côté de RANDOM_EVENTS (one-shot), qui
 * continuent. Les thèmes déjà gérés ailleurs ne sont PAS recréés :
 *   - rivalités  -> système existant (getActiveRivalries)
 *   - mercato    -> tpApproach / négociation
 *   - coéquipier / objectifs de saison / confiance -> module 14 + TEAM_TRUST
 * Les arcs visent des zones libres (personnel technique, presse, dilemmes, vie
 * perso) et, quand ils croisent un système existant, ils en utilisent les
 * LEVIERS via applyMailEffect (aucune variable parallèle créée).
 *
 * ARCHITECTURE (Option A — enrichissement sûr, sans toucher au cœur)
 * -----------------------------------------------------------------
 *   - WEEKLY_TICK_HOOKS : un hook "storyArcs" fait mûrir/démarrer les arcs.
 *   - Effets : applyMailEffect({type, data:{delta, reason}}) — rep, money,
 *     happiness, mental, trust.
 *   - Écran : <div class="scr" id="S-arcs"> créé dynamiquement + wrap de
 *     refreshScreen. Accès via une notif mailbox (action nav) et une carte
 *     injectée sur l'accueil quand une décision est en attente.
 *   - Persistance : G._entityMemory.storyArcs (déjà sérialisé par le save).
 *   - Réversible : retirer ce script d'index.html supprime le hook et l'écran.
 *
 * ORDRE DE CHARGEMENT : après 03 (cœur). Aucune dépendance à 04+.
 * ===========================================================================*/

(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  var MAX_ACTIVE = 2;       // arcs simultanés max
  var START_COOLDOWN = 2;   // semaines mini entre deux démarrages
  var START_CHANCE = 0.45;  // proba de démarrage par semaine simulée

  // ==========================================================================
  // CATALOGUE — effets : {type:'rep'|'happiness'|'mental'|'trust', delta:n}
  //             budget : {type:'money', pct:n}  (n % du budget courant)
  // ==========================================================================
  var ARCS = [
    { id:'mechanic', tag:'team', title:'Le mécano de confiance', who:'Diego, ton mécanicien n°1',
      weight:function(){ return 1.1; },
      steps:[
        { id:'s1', delay:0,
          body:"Diego t'arrête après les essais. « Une autre équipe me fait les yeux doux. Plus de moyens, plus de stabilité. Mais bosser sur ta voiture, ça compte pour moi. Je suis partagé. »",
          prompt:"Diego hésite à partir. Qu'est-ce que tu lui dis ?",
          choices:[
            { label:"« Reste, je te tire vers le haut »", desc:"Tu t'engages personnellement.", primary:true,
              effects:[{type:'trust',delta:+6},{type:'happiness',delta:+2}], next:'stay' },
            { label:"« Fais ce qui est bon pour toi »", desc:"Honnête, mais tu ne le retiens pas.",
              effects:[{type:'trust',delta:+1}], next:'leave' },
            { label:"« On n'est pas indispensables »", desc:"Tu joues la distance. Ça peut piquer.",
              effects:[{type:'trust',delta:-4},{type:'happiness',delta:-1}], next:'leave' } ] },
        { id:'stay', delay:2,
          body:"Trois semaines plus tard, Diego a refusé l'offre. Il a repris ton coin de garage en main : moins d'erreurs aux arrêts, une voiture mieux préparée.",
          prompt:"Comment tu marques le coup ?",
          choices:[
            { label:"Le mettre en avant publiquement", desc:"Un mot pour lui en conférence.", primary:true,
              effects:[{type:'trust',delta:+4},{type:'rep',delta:+2}], next:null,
              outcome:"Diego reste, soudé à ton stand. Préparation plus fiable et moral en hausse." },
            { label:"Rester discret", desc:"Ça reste entre vous.",
              effects:[{type:'trust',delta:+2}], next:null,
              outcome:"Diego reste. Une relation solide, sans tapage." } ] },
        { id:'leave', delay:2,
          body:"Diego est parti chez le concurrent. Son remplaçant apprend encore ta voiture — quelques détails passent à la trappe.",
          prompt:"Tu réagis comment en interne ?",
          choices:[
            { label:"Encadrer le nouveau toi-même", desc:"Tu investes du temps pour recoller.", primary:true,
              effects:[{type:'trust',delta:+3},{type:'happiness',delta:-1}], next:null,
              outcome:"Le nouveau monte en puissance. Tu as limité la casse." },
            { label:"Laisser l'équipe gérer", desc:"Tu te concentres sur le pilotage.",
              effects:[{type:'trust',delta:-2}], next:null,
              outcome:"Transition laborieuse. Quelques week-ends brouillons à venir." } ] } ] },

    { id:'engineer', tag:'team', title:"L'ingénieur et toi", who:'Sasha, ton ingénieur de course',
      weight:function(){ return 1.0; },
      steps:[
        { id:'s1', delay:0,
          body:"En débrief, Sasha défend un set-up prudent, sûr. Toi, tu sens qu'il y a plus à aller chercher, quitte à prendre un risque sur l'équilibre.",
          prompt:"Vous n'êtes pas d'accord sur la direction.",
          choices:[
            { label:"Imposer ton ressenti", desc:"Tu pilotes, tu tranches.", primary:true,
              effects:[{type:'mental',delta:+2},{type:'trust',delta:-3}], next:'mine' },
            { label:"Suivre Sasha", desc:"Tu fais confiance à ses données.",
              effects:[{type:'trust',delta:+4},{type:'mental',delta:-1}], next:'theirs' },
            { label:"Chercher un compromis", desc:"Vous coupez la poire en deux.",
              effects:[{type:'trust',delta:+1}], next:'mid' } ] },
        { id:'mine', delay:2,
          body:"Ton set-up a payé : la voiture est vive là où il faut. Sasha l'a noté — et a un peu serré les dents.",
          prompt:"Tu en fais quoi avec lui ?",
          choices:[
            { label:"Reconnaître son rôle", desc:"Tu lui rends la main sur l'analyse.", primary:true,
              effects:[{type:'trust',delta:+5},{type:'rep',delta:+1}], next:null,
              outcome:"Confiance restaurée et renforcée : vous savez désormais quand chacun a le dernier mot." },
            { label:"Savourer d'avoir eu raison", desc:"Tu le laisses digérer.",
              effects:[{type:'mental',delta:+1},{type:'trust',delta:-2}], next:null,
              outcome:"Tu avais raison, mais la relation s'est un peu tendue." } ] },
        { id:'theirs', delay:2,
          body:"Le set-up de Sasha tient la distance, sans éclat mais sans faute. Il t'a senti à l'écoute.",
          prompt:"La suite de votre collaboration ?",
          choices:[
            { label:"Bâtir une méthode commune", desc:"Vous formalisez vos débriefs.", primary:true,
              effects:[{type:'trust',delta:+4}], next:null,
              outcome:"Un binôme qui tourne rond. Tes week-ends gagnent en régularité." },
            { label:"Garder ta marge de manœuvre", desc:"Tu restes maître de tes choix.",
              effects:[{type:'mental',delta:+1}], next:null,
              outcome:"Collaboration correcte, sans fusion totale." } ] },
        { id:'mid', delay:2,
          body:"Le compromis n'a pas tranché : ni vraiment ton idée, ni vraiment la sienne. Un week-end en demi-teinte.",
          prompt:"Tu corriges le tir comment ?",
          choices:[
            { label:"Clarifier qui décide quoi", desc:"Tu poses un cadre net.", primary:true,
              effects:[{type:'trust',delta:+3},{type:'mental',delta:+1}], next:null,
              outcome:"Les rôles sont clairs. Fini les set-ups bâtards." },
            { label:"Laisser filer", desc:"On verra à la prochaine.",
              effects:[{type:'trust',delta:-1}], next:null,
              outcome:"Le flou s'installe. À recadrer un jour." } ] } ] },

    { id:'order', tag:'team', title:'La consigne', who:'Direction de course de ton écurie',
      weight:function(){ return 0.9; },
      steps:[
        { id:'s1', delay:0,
          body:"Radio, à dix tours de la fin : « Laisse passer ton coéquipier, c'est l'intérêt de l'équipe. » Tu étais devant, et tu avais le rythme.",
          prompt:"En débrief, l'équipe revient sur ta réaction.",
          choices:[
            { label:"Tu as obéi sans broncher", desc:"L'équipe d'abord. Tu encaisses.", primary:true,
              effects:[{type:'trust',delta:+6},{type:'happiness',delta:-3}], next:'obey' },
            { label:"Tu as refusé et gardé ta place", desc:"Ta course, ton résultat.",
              effects:[{type:'trust',delta:-7},{type:'rep',delta:+3},{type:'mental',delta:+2}], next:'defy' },
            { label:"Tu as négocié une contrepartie", desc:"« D'accord, mais on en reparle. »",
              effects:[{type:'trust',delta:+2}], next:'deal' } ] },
        { id:'obey', delay:2,
          body:"Ton geste a été remarqué en interne. La direction t'en sait gré — et te le fait comprendre.",
          prompt:"Tu en tires quoi ?",
          choices:[
            { label:"Capitaliser sur ce crédit", desc:"Tu demandes des garanties pour la suite.", primary:true,
              effects:[{type:'trust',delta:+3},{type:'rep',delta:+1}], next:null,
              outcome:"Tu as gagné la confiance de l'écurie." },
            { label:"Ne rien réclamer", desc:"Tu joues collectif, point.",
              effects:[{type:'trust',delta:+2},{type:'happiness',delta:+1}], next:null,
              outcome:"Réputation d'équipier exemplaire. L'écurie s'en souviendra." } ] },
        { id:'defy', delay:2,
          body:"Le public a adoré ; la direction beaucoup moins. La semaine a été tendue dans le garage.",
          prompt:"Tu désamorces, ou tu assumes ?",
          choices:[
            { label:"T'expliquer franchement", desc:"Tu poses tes raisons, sans t'excuser.", primary:true,
              effects:[{type:'trust',delta:+2},{type:'rep',delta:+1}], next:null,
              outcome:"Tension digérée. Tu as marqué ton territoire." },
            { label:"Assumer crânement", desc:"« Je cours pour gagner. »",
              effects:[{type:'rep',delta:+2},{type:'trust',delta:-3}], next:null,
              outcome:"Image de battant, relation écurie refroidie. À surveiller côté contrat." } ] },
        { id:'deal', delay:2,
          body:"L'équipe a accepté le principe d'un retour d'ascenseur. Reste à voir s'ils tiennent parole.",
          prompt:"Comment tu sécurises ça ?",
          choices:[
            { label:"Acter par écrit avec ton agent", desc:"Pas de promesse en l'air.", primary:true,
              effects:[{type:'trust',delta:+2},{type:'mental',delta:+1}], next:null,
              outcome:"Donnant-donnant formalisé. Tu as joué fin." },
            { label:"Faire confiance à la parole", desc:"Tu mises sur l'honnêteté.",
              effects:[{type:'happiness',delta:+1}], next:null,
              outcome:"Pari sur la confiance. À eux de la mériter." } ] } ] },

    { id:'leak', tag:'media', title:'La fuite', who:'Un tabloïd du paddock',
      weight:function(){ return (typeof G!=='undefined'&&G&&(G.reputation||0)>30) ? 1.0 : 0.5; },
      steps:[
        { id:'s1', delay:0,
          body:"Un détail de ta vie privée se retrouve en une d'un tabloïd, sorti de son contexte. Ça tourne déjà sur les réseaux.",
          prompt:"Comment tu réponds ?",
          choices:[
            { label:"Démentir fermement", desc:"Communiqué carré, sans trembler.", primary:true,
              effects:[{type:'rep',delta:+2},{type:'mental',delta:-1}], next:'deny' },
            { label:"Assumer avec humour", desc:"Tu désamorces, tu en ris.",
              effects:[{type:'rep',delta:+1},{type:'happiness',delta:+2}], next:'own' },
            { label:"Ne rien dire", desc:"Tu laisses passer l'orage.",
              effects:[{type:'mental',delta:-2}], next:'silent' } ] },
        { id:'deny', delay:3,
          body:"Ton démenti a tenu, mais le tabloïd cherche un angle pour rebondir. Ton agent flaire une source interne.",
          prompt:"Tu creuses la fuite ?",
          choices:[
            { label:"Identifier la source", desc:"Tu veux couper le robinet.", primary:true,
              effects:[{type:'rep',delta:+2},{type:'trust',delta:-1}], next:null,
              outcome:"Fuite colmatée. Tu sais désormais à qui te fier." },
            { label:"Tourner la page", desc:"Tu refuses d'alimenter l'histoire.",
              effects:[{type:'mental',delta:+2}], next:null,
              outcome:"L'affaire s'éteint d'elle-même. Tu as gardé ton calme." } ] },
        { id:'own', delay:3,
          body:"Ton autodérision a renversé l'opinion : les fans ont apprécié. Une marque te contacte même pour surfer dessus.",
          prompt:"Tu exploites le moment ?",
          choices:[
            { label:"Capitaliser côté image", desc:"Tu transformes l'essai.", primary:true,
              effects:[{type:'rep',delta:+3},{type:'money',pct:+2}], next:null,
              outcome:"Un bad buzz retourné en atout. Joliment joué." },
            { label:"En rester là", desc:"Tu ne veux pas en faire trop.",
              effects:[{type:'happiness',delta:+1}], next:null,
              outcome:"Tu as géré avec classe, sans surjouer." } ] },
        { id:'silent', delay:3,
          body:"Le silence a laissé l'histoire enfler quelques jours avant de retomber. Ça t'a coûté nerveusement.",
          prompt:"Tu fais quoi maintenant ?",
          choices:[
            { label:"Reprendre la parole posément", desc:"Une mise au point tardive mais nette.", primary:true,
              effects:[{type:'rep',delta:+1},{type:'mental',delta:+1}], next:null,
              outcome:"L'épisode est clos. Le silence n'était pas la meilleure arme." },
            { label:"Te recentrer sur la piste", desc:"Tu réponds par les résultats.",
              effects:[{type:'mental',delta:+2}], next:null,
              outcome:"Tu as encaissé et tu avances. La piste parlera." } ] } ] },

    { id:'mentor', tag:'perso', title:'Le mentor', who:'Un ancien pilote, devenu consultant',
      weight:function(){ return 0.9; },
      steps:[
        { id:'s1', delay:0,
          body:"Une figure respectée du paddock t'aborde : il voit en toi quelque chose, et propose de t'ouvrir son carnet d'expérience. Sans rien demander. Pour l'instant.",
          prompt:"Tu acceptes son aile ?",
          choices:[
            { label:"Accepter avec gratitude", desc:"Tu absorbes tout ce qu'il offre.", primary:true,
              effects:[{type:'mental',delta:+4},{type:'happiness',delta:+1}], next:'accept' },
            { label:"Rester indépendant", desc:"Tu te construis seul.",
              effects:[{type:'mental',delta:+1}], next:'solo' } ] },
        { id:'accept', delay:3,
          body:"Ses conseils portent : tu lis mieux les courses, tu gères ta pression. Puis un jour, il te demande un service — pousser un de ses protégés auprès de ton écurie.",
          prompt:"Tu lui renvoies l'ascenseur ?",
          choices:[
            { label:"Honorer ta dette", desc:"Il a investi en toi, tu le soutiens.", primary:true,
              effects:[{type:'mental',delta:+2},{type:'trust',delta:-1}], next:null,
              outcome:"Lien solide avec un parrain influent. Un appui pour la suite de ta carrière." },
            { label:"Décliner poliment", desc:"Tu ne veux pas mélanger les genres.",
              effects:[{type:'rep',delta:+1},{type:'mental',delta:-1}], next:null,
              outcome:"Tu gardes ton indépendance, au prix d'un peu de froid entre vous." } ] },
        { id:'solo', delay:3,
          body:"Tu as décliné. Il a respecté ça — et continue de te saluer de loin. Tu avances à ta main, sans filet.",
          prompt:"Tu confirmes ce cap ?",
          choices:[
            { label:"Assumer ta voie solitaire", desc:"Tu te fies à ton instinct.", primary:true,
              effects:[{type:'mental',delta:+2},{type:'rep',delta:+1}], next:null,
              outcome:"Self-made. Plus dur, mais c'est ta signature." },
            { label:"Rouvrir la porte", desc:"Tu reviens vers lui, finalement.",
              effects:[{type:'mental',delta:+2}], next:null,
              outcome:"Tu acceptes un peu d'aide. L'orgueil n'est pas une stratégie." } ] } ] },

    { id:'sponsor_promise', tag:'sponsor', title:'La promesse au sponsor', who:'Ton sponsor-titre',
      weight:function(){ return 0.9; },
      steps:[
        { id:'s1', delay:0,
          body:"Ton sponsor-titre veut t'avoir trois jours sur un tournage et des événements VIP — pile sur ta semaine de préparation avant un Grand Prix clé.",
          prompt:"Tu réponds quoi ?",
          choices:[
            { label:"Honorer l'engagement", desc:"Le contrat passe avant. Bon pour le budget.", primary:true,
              effects:[{type:'money',pct:+3},{type:'rep',delta:+2},{type:'mental',delta:-2}], next:'honor' },
            { label:"Décaler à plus tard", desc:"Tu négocies une autre date.",
              effects:[{type:'money',pct:-1},{type:'mental',delta:+1}], next:'delay' },
            { label:"Décliner cette fois", desc:"La piste d'abord. Risqué côté relation.",
              effects:[{type:'money',pct:-2},{type:'mental',delta:+2}], next:'refuse' } ] },
        { id:'honor', delay:2,
          body:"Tu as joué le jeu à fond. Le sponsor est ravi — mais tu arrives au Grand Prix en déficit de préparation.",
          prompt:"Comment tu compenses ?",
          choices:[
            { label:"Bûcher en simu le reste du temps", desc:"Tu grappilles chaque heure libre.", primary:true,
              effects:[{type:'mental',delta:+1},{type:'happiness',delta:-1}], next:null,
              outcome:"Sponsor comblé, prépa rattrapée de justesse. Épuisant mais payant." },
            { label:"Assumer le week-end en l'état", desc:"Tu fais avec.",
              effects:[{type:'money',pct:+1}], next:null,
              outcome:"Le budget sourit, la prépa moins. Un week-end à l'arrache." } ] },
        { id:'delay', delay:2,
          body:"Le sponsor a accepté de décaler, un peu déçu. Tu as préservé ta semaine.",
          prompt:"Tu entretiens la relation ?",
          choices:[
            { label:"Offrir un geste en échange", desc:"Une story, un contenu bonus.", primary:true,
              effects:[{type:'rep',delta:+1},{type:'money',pct:+2}], next:null,
              outcome:"Équilibre trouvé entre image et performance. Diplomate." },
            { label:"En rester aux termes du contrat", desc:"Rien de plus, rien de moins.",
              effects:[{type:'mental',delta:+1}], next:null,
              outcome:"Tu as tenu ta ligne. Relation correcte, sans excès de zèle." } ] },
        { id:'refuse', delay:2,
          body:"Ton refus a refroidi le sponsor. Ta semaine de prépa, elle, a été parfaite.",
          prompt:"Tu rattrapes le coup ?",
          choices:[
            { label:"Te rattraper par un résultat", desc:"Tu leur offres la meilleure pub : la piste.", primary:true,
              effects:[{type:'rep',delta:+2},{type:'mental',delta:+1}], next:null,
              outcome:"Pari assumé sur la performance. À toi de livrer en piste." },
            { label:"Lisser par un mot personnel", desc:"Tu les rassures en coulisses.",
              effects:[{type:'money',pct:+1}], next:null,
              outcome:"Relation recollée à la main. La prochaine fois sera plus simple." } ] } ] },

    { id:'slump', tag:'perso', title:'Le coup de mou', who:'Toi-même',
      weight:function(){ return (typeof G!=='undefined'&&G&&((G.happiness==null?60:G.happiness)<55)) ? 1.4 : 0.5; },
      steps:[
        { id:'s1', delay:0,
          body:"Depuis quelques semaines, l'envie n'y est plus tout à fait. Les séances te pèsent, le sommeil est court. Rien de grave — mais ça traîne.",
          prompt:"Tu fais quoi de ce passage à vide ?",
          choices:[
            { label:"En parler à ton préparateur", desc:"Tu mets des mots dessus.", primary:true,
              effects:[{type:'mental',delta:+3},{type:'happiness',delta:+2}], next:'talk' },
            { label:"Serrer les dents", desc:"Ça va passer tout seul.",
              effects:[{type:'mental',delta:-2}], next:'grind' },
            { label:"Couper deux ou trois jours", desc:"Tu débranches vraiment.",
              effects:[{type:'happiness',delta:+4},{type:'mental',delta:+1}], next:'rest' } ] },
        { id:'talk', delay:2,
          body:"En parler a fait du bien. Ton préparateur ajuste la charge, replace du sens. L'envie revient, doucement.",
          prompt:"Tu installes ça dans la durée ?",
          choices:[
            { label:"Mettre en place un suivi", desc:"Tu en fais une habitude.", primary:true,
              effects:[{type:'mental',delta:+3},{type:'happiness',delta:+1}], next:null,
              outcome:"Tu as appris à te gérer sur le long terme. Une force pour la suite." },
            { label:"Garder ça en réserve", desc:"Tu sais vers qui te tourner au besoin.",
              effects:[{type:'mental',delta:+1}], next:null,
              outcome:"Le moral est remonté. Tu sais quoi faire si ça revient." } ] },
        { id:'grind', delay:2,
          body:"Tu as encaissé en silence. Ça a fini par remonter, mais quelques week-ends ont été ternes au passage.",
          prompt:"Tu débriefes avec toi-même ?",
          choices:[
            { label:"Reconnaître tes limites", desc:"La prochaine fois, tu parleras plus tôt.", primary:true,
              effects:[{type:'mental',delta:+2},{type:'happiness',delta:+1}], next:null,
              outcome:"Leçon retenue : tout ne se règle pas en serrant les dents." },
            { label:"Te durcir encore", desc:"Tu en fais une fierté.",
              effects:[{type:'mental',delta:+1},{type:'happiness',delta:-1}], next:null,
              outcome:"Plus dur, mais pas plus heureux. À double tranchant." } ] },
        { id:'rest', delay:2,
          body:"Trois jours déconnecté ont suffi à recharger les batteries. Tu reviens plus frais, plus clair.",
          prompt:"Tu prolonges l'effet ?",
          choices:[
            { label:"Aménager des vraies coupures", desc:"Tu protèges ces fenêtres de repos.", primary:true,
              effects:[{type:'happiness',delta:+2},{type:'mental',delta:+1}], next:null,
              outcome:"Tu pilotes ton énergie comme ta course. Durable." },
            { label:"Repartir à fond direct", desc:"Tu enchaînes sans transition.",
              effects:[{type:'mental',delta:+1}], next:null,
              outcome:"Reboost ponctuel. À voir si ça tient." } ] } ] }
  ];

  function arcDef(id){ for (var i=0;i<ARCS.length;i++) if (ARCS[i].id===id) return ARCS[i]; return null; }
  function stepDef(arcId, stepId){ var a=arcDef(arcId); if(!a) return null; for (var i=0;i<a.steps.length;i++) if (a.steps[i].id===stepId) return a.steps[i]; return null; }

  // ==========================================================================
  // ÉTAT PERSISTANT (G._entityMemory.storyArcs — sérialisé par le save)
  // ==========================================================================
  function mem(){
    if (typeof G === 'undefined' || !G) return null;
    if (!G._entityMemory) G._entityMemory = {};
    var m = G._entityMemory.storyArcs;
    if (!m) { m = G._entityMemory.storyArcs = { active:[], completed:[], started:{}, cooldownUntil:0 }; }
    if (!m.active) m.active = [];
    if (!m.completed) m.completed = [];
    if (!m.started) m.started = {};
    if (m.cooldownUntil == null) m.cooldownUntil = 0;
    return m;
  }
  function curWeek(){ return (typeof G!=='undefined'&&G) ? ((G.saison||1)*100 + (G.semaine||1)) : 0; }

  // ==========================================================================
  // MOTEUR
  // ==========================================================================
  function applyArcEffects(effects, arcTitle){
    if (typeof applyMailEffect !== 'function') return;
    (effects||[]).forEach(function(e){
      try {
        if (e.type === 'money') {
          var base = (typeof G!=='undefined'&&G&&typeof G.budget==='number') ? G.budget : 0;
          var delta = Math.round(base * ((e.pct||0)/100));
          if (delta !== 0) applyMailEffect({ type:'money', data:{ delta:delta } });
        } else {
          applyMailEffect({ type:e.type, data:{ delta:e.delta, reason:'Paddock : '+arcTitle } });
        }
      } catch (err) { console.warn('[32] effet arc:', err); }
    });
  }

  function notifyDecision(a){
    if (typeof pushMail !== 'function') return;
    try {
      pushMail({
        from:'Vie de paddock', role:'agent',
        subject:'Une décision t\u2019attend : ' + a.title,
        body:'Une situation évolue et demande ton arbitrage. Ouvre l\u2019espace « Vie de paddock » pour la traiter.',
        actions:[{ label:'Ouvrir la vie de paddock', kind:'nav', effect:{ type:'nav', data:{ screen:'S-arcs' } } }]
      });
    } catch (e) { console.warn('[32] notif:', e); }
  }

  function startArc(arcId){
    var m = mem(), a = arcDef(arcId); if (!m || !a) return;
    for (var i=0;i<m.active.length;i++) if (m.active[i].arcId===arcId) return; // déjà actif : pas de doublon
    m.active.push({ arcId:arcId, stepId:a.steps[0].id, awaiting:true, advanceAtWeek:curWeek(), history:[] });
    m.started[arcId] = true;
    m.cooldownUntil = curWeek() + START_COOLDOWN;
    notifyDecision(a);
  }

  function maybeStartArc(){
    var m = mem(); if (!m) return;
    if (m.active.length >= MAX_ACTIVE) return;
    if (curWeek() < m.cooldownUntil) return;
    var pool = ARCS.filter(function(a){
      if (m.started[a.id]) return false;
      for (var i=0;i<m.active.length;i++) if (m.active[i].arcId===a.id) return false;
      return true;
    });
    if (!pool.length) return;
    if (Math.random() > START_CHANCE) return;
    var weighted = pool.map(function(a){ var w; try { w=a.weight(); } catch(e){ w=1; } return { a:a, w:Math.max(0.01, w||0.01) }; });
    var total = weighted.reduce(function(s,x){ return s+x.w; }, 0);
    var r = Math.random()*total, pick=null;
    for (var i=0;i<weighted.length;i++){ r-=weighted[i].w; if (r<=0){ pick=weighted[i].a; break; } }
    if (pick) startArc(pick.id);
  }

  function tickOneWeek(){
    var m = mem(); if (!m) return;
    var w = curWeek();
    m.active.forEach(function(inst){
      if (!inst.awaiting && w >= inst.advanceAtWeek){
        inst.awaiting = true;
        var a = arcDef(inst.arcId); if (a) notifyDecision(a);
      }
    });
    maybeStartArc();
  }

  function tickWeeks(weeks){
    var n = Math.max(1, Math.min(8, weeks|0));   // borne de sécurité
    for (var i=0;i<n;i++) tickOneWeek();
    refreshIfOnScreen();
    onHomeShown();
  }

  function choose(arcId, choiceIdx){
    var m = mem(); if (!m) return;
    var inst = null; for (var i=0;i<m.active.length;i++) if (m.active[i].arcId===arcId) inst=m.active[i];
    if (!inst || !inst.awaiting) return;
    var step = stepDef(arcId, inst.stepId); if (!step) return;
    var choice = step.choices[choiceIdx]; if (!choice) return;
    var a = arcDef(arcId);
    applyArcEffects(choice.effects, a ? a.title : '');
    inst.history.push({ stepId:inst.stepId, label:choice.label });
    if (choice.next){
      inst.stepId = choice.next; inst.awaiting = false;
      var ns = stepDef(arcId, choice.next);
      inst.advanceAtWeek = curWeek() + ((ns && ns.delay) || 2);
    } else {
      m.completed.unshift({ arcId:arcId, title:a?a.title:'', tag:a?a.tag:'team', outcome:choice.outcome||'', week:(typeof G!=='undefined'&&G?G.semaine:0), saison:(typeof G!=='undefined'&&G?G.saison:0) });
      if (m.completed.length > 12) m.completed.length = 12;
      m.active = m.active.filter(function(x){ return x!==inst; });
    }
    renderArcsScreen();
    injectHomeCard();
  }

  function pendingCount(){ var m = mem(); if (!m) return 0; return m.active.filter(function(x){ return x.awaiting; }).length; }

  // ==========================================================================
  // ÉCRAN S-arcs
  // ==========================================================================
  function injectCSS(){
    if (document.getElementById('rjsa-css')) return;
    var css = [
      '#S-arcs .rjsa-wrap{max-width:560px;margin:0 auto;padding:0 14px 40px}',
      '#S-arcs .rjsa-head{padding:18px 4px 6px}',
      '#S-arcs .rjsa-eyebrow{font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#FF1801}',
      '#S-arcs .rjsa-title{font-size:24px;font-weight:800;letter-spacing:-.01em;margin-top:6px;color:#f3f5f9}',
      '#S-arcs .rjsa-gauges{display:grid;grid-template-columns:repeat(auto-fit,minmax(60px,1fr));gap:7px;margin:14px 0 4px}',
      '#S-arcs .rjsa-g{background:#161a24;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:8px 6px;text-align:center}',
      '#S-arcs .rjsa-g .v{font-size:15px;font-weight:800;color:#f3f5f9}',
      '#S-arcs .rjsa-g .l{font-size:8px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#6b7385;margin-top:4px}',
      '#S-arcs .rjsa-sec{margin-top:20px}',
      '#S-arcs .rjsa-sech{display:flex;align-items:center;gap:8px;margin-bottom:10px}',
      '#S-arcs .rjsa-sech .led{width:7px;height:7px;border-radius:50%;background:#00D4FF;box-shadow:0 0 7px #00D4FF}',
      '#S-arcs .rjsa-sech.idle .led{background:#6b7385;box-shadow:none}',
      '#S-arcs .rjsa-sech h2{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#f3f5f9}',
      '#S-arcs .rjsa-arc{background:linear-gradient(180deg,#161a24,#1b202b);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:14px;margin-bottom:11px}',
      '#S-arcs .rjsa-arc.decide{border-color:rgba(0,212,255,.45);box-shadow:0 0 0 1px rgba(0,212,255,.12)}',
      '#S-arcs .rjsa-top{display:flex;align-items:center;gap:9px;margin-bottom:9px}',
      '#S-arcs .rjsa-tag{font-size:9px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;padding:3px 8px;border-radius:6px}',
      '#S-arcs .rjsa-tag.team{color:#00D4FF;background:rgba(0,212,255,.10);border:1px solid rgba(0,212,255,.25)}',
      '#S-arcs .rjsa-tag.media{color:#FBBF24;background:rgba(251,191,36,.10);border:1px solid rgba(251,191,36,.28)}',
      '#S-arcs .rjsa-tag.perso{color:#34D399;background:rgba(52,211,153,.10);border:1px solid rgba(52,211,153,.28)}',
      '#S-arcs .rjsa-tag.sponsor{color:#A78BFA;background:rgba(167,139,250,.10);border:1px solid rgba(167,139,250,.28)}',
      '#S-arcs .rjsa-prog{margin-left:auto;font-size:10px;font-weight:700;color:#6b7385}',
      '#S-arcs .rjsa-arc h3{font-size:15px;font-weight:700;color:#f3f5f9}',
      '#S-arcs .rjsa-who{font-size:11px;color:#6b7385;margin-top:1px}',
      '#S-arcs .rjsa-body{font-size:13px;color:#aeb6c6;line-height:1.5;margin-top:9px}',
      '#S-arcs .rjsa-prompt{font-size:13px;color:#f3f5f9;line-height:1.5;margin-top:11px;font-weight:500;border-left:2px solid #00D4FF;padding-left:11px}',
      '#S-arcs .rjsa-choices{margin-top:12px;display:flex;flex-direction:column;gap:8px}',
      '#S-arcs .rjsa-choice{display:block;width:100%;text-align:left;background:#1b202b;border:1px solid rgba(255,255,255,.14);border-radius:11px;padding:11px 13px;cursor:pointer;font-family:inherit}',
      '#S-arcs .rjsa-choice:hover{border-color:#00D4FF}',
      '#S-arcs .rjsa-choice .cl{display:block;font-size:13px;font-weight:700;color:#f3f5f9}',
      '#S-arcs .rjsa-choice .cd{display:block;font-size:11px;color:#6b7385;margin-top:3px;line-height:1.4}',
      '#S-arcs .rjsa-choice.primary{background:linear-gradient(180deg,#ff3b27,#FF1801);border-color:transparent}',
      '#S-arcs .rjsa-choice.primary .cl,#S-arcs .rjsa-choice.primary .cd{color:#fff}',
      '#S-arcs .rjsa-mini{background:#161a24;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:11px 13px;margin-bottom:9px;display:flex;align-items:center;gap:11px}',
      '#S-arcs .rjsa-mini .dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}',
      '#S-arcs .rjsa-mini .mt{font-size:12.5px;font-weight:600;color:#f3f5f9}',
      '#S-arcs .rjsa-mini .ms{font-size:10.5px;color:#6b7385;margin-top:2px}',
      '#S-arcs .rjsa-mini .when{margin-left:auto;font-size:10px;color:#6b7385;font-weight:700;white-space:nowrap}',
      '#S-arcs .rjsa-empty{color:#6b7385;font-size:12px;font-style:italic;padding:6px 2px}',
      '.rjsa-homecard{background:linear-gradient(135deg,#1b2230,#161a24);border:1px solid rgba(0,212,255,.4);border-radius:14px;padding:13px 15px;margin:0 0 12px;display:flex;align-items:center;gap:12px;cursor:pointer}',
      '.rjsa-homecard .hc-t{font-size:14px;font-weight:700;color:#f3f5f9}',
      '.rjsa-homecard .hc-s{font-size:11px;color:#aeb6c6;margin-top:2px}',
      '.rjsa-homecard .hc-badge{margin-left:auto;background:#FF1801;color:#fff;font-size:12px;font-weight:800;min-width:24px;height:24px;border-radius:12px;display:flex;align-items:center;justify-content:center;padding:0 7px}',
      '.rjsa-modal-ov{position:fixed;inset:0;background:rgba(6,8,12,.72);backdrop-filter:blur(4px);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;animation:rjsaFade .2s ease-out}',
      '@keyframes rjsaFade{from{opacity:0}to{opacity:1}}',
      '.rjsa-modal{width:100%;max-width:380px;background:linear-gradient(180deg,#1b202b,#11141c);border:1px solid rgba(0,212,255,.35);border-radius:18px;padding:20px;box-shadow:0 24px 60px -20px rgba(0,0,0,.8);animation:rjsaPop .26s cubic-bezier(.2,.8,.3,1)}',
      '@keyframes rjsaPop{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}',
      '.rjsa-modal .pm-top{display:flex;align-items:center;gap:9px;margin-bottom:10px}',
      '.rjsa-modal .pm-eyebrow{font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#FF1801}',
      '.rjsa-modal h3{font-size:19px;font-weight:800;color:#f3f5f9;letter-spacing:-.01em;margin-top:3px}',
      '.rjsa-modal .pm-who{font-size:11px;color:#6b7385;margin-top:2px;font-weight:500}',
      '.rjsa-modal .pm-body{font-size:13px;color:#aeb6c6;line-height:1.5;margin-top:12px}',
      '.rjsa-modal .pm-actions{display:flex;gap:9px;margin-top:18px}',
      '.rjsa-modal .pm-btn{flex:1;border:none;border-radius:11px;padding:12px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer}',
      '.rjsa-modal .pm-later{background:#222836;color:#aeb6c6;border:1px solid rgba(255,255,255,.12)}',
      '.rjsa-modal .pm-go{background:linear-gradient(180deg,#ff3b27,#FF1801);color:#fff}'
    ].join('');
    var st = document.createElement('style'); st.id='rjsa-css'; st.textContent=css;
    document.head.appendChild(st);
  }

  function ensureScreen(){
    if (document.getElementById('S-arcs')) return true;
    var home = document.getElementById('S-home');
    if (!home || !home.parentNode) return false;
    injectCSS();
    var scr = document.createElement('div');
    scr.className = 'scr'; scr.id = 'S-arcs';
    scr.innerHTML =
      '<div class="rjsa-wrap">' +
        '<div class="rjsa-head">' +
          '<button class="rjsa-back" id="rjsa-back" style="background:none;border:none;color:#aeb6c6;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;padding:6px 0">\u2190 Retour</button>' +
          '<div class="rjsa-eyebrow">Entre les courses</div>' +
          '<h1 class="rjsa-title">Vie de paddock</h1>' +
        '</div>' +
        '<div class="rjsa-gauges" id="rjsa-gauges"></div>' +
        '<div class="rjsa-sec"><div class="rjsa-sech"><span class="led"></span><h2>Décisions en attente</h2></div><div id="rjsa-decide"></div></div>' +
        '<div class="rjsa-sec"><div class="rjsa-sech idle"><span class="led"></span><h2>En cours</h2></div><div id="rjsa-active"></div></div>' +
        '<div class="rjsa-sec"><div class="rjsa-sech idle"><span class="led"></span><h2>Dénouements récents</h2></div><div id="rjsa-done"></div></div>' +
      '</div>';
    home.parentNode.appendChild(scr);

    scr.addEventListener('click', function(e){
      var back = e.target.closest('#rjsa-back');
      if (back){ if (typeof navTo==='function') navTo('S-home'); return; }
      var btn = e.target.closest('.rjsa-choice');
      if (btn){ choose(btn.getAttribute('data-arc'), parseInt(btn.getAttribute('data-idx'),10)); }
    });
    return true;
  }

  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function tagLabel(t){ return t==='team'?'Équipe':t==='media'?'Presse':t==='sponsor'?'Sponsor':'Perso'; }
  function tagColor(t){ return t==='team'?'#00D4FF':t==='media'?'#FBBF24':t==='sponsor'?'#A78BFA':'#34D399'; }

  function renderGauges(){
    var el = document.getElementById('rjsa-gauges'); if (!el || typeof G==='undefined' || !G) return;
    var rows = [];
    if (typeof G.reputation==='number') rows.push(['Réput.', Math.round(G.reputation)]);
    if (typeof G.budget==='number')     rows.push(['Budget', _fmtMoney(G.budget)]);
    if (typeof G.happiness==='number')  rows.push(['Moral', Math.round(G.happiness)]);
    var tt = (typeof TEAM_TRUST!=='undefined') ? TEAM_TRUST : (typeof window.TEAM_TRUST!=='undefined'?window.TEAM_TRUST:null);
    if (typeof tt==='number') rows.push(['Équipe', Math.round(tt)]);
    el.innerHTML = rows.map(function(r){ return '<div class="rjsa-g"><div class="v">'+r[1]+'</div><div class="l">'+r[0]+'</div></div>'; }).join('');
  }
  function _fmtMoney(v){ if (Math.abs(v)>=1e6) return (v/1e6).toFixed(1)+'M'; if (Math.abs(v)>=1e3) return Math.round(v/1e3)+'k'; return ''+Math.round(v); }

  function arcCardHTML(inst){
    var a = arcDef(inst.arcId), step = stepDef(inst.arcId, inst.stepId); if (!a||!step) return '';
    var no = 0; for (var i=0;i<a.steps.length;i++) if (a.steps[i].id===inst.stepId){ no=i+1; break; }
    var h = '<div class="rjsa-arc decide"><div class="rjsa-top"><span class="rjsa-tag '+a.tag+'">'+tagLabel(a.tag)+'</span>'
      + '<span class="rjsa-prog">Chapitre '+no+'</span></div>'
      + '<h3>'+esc(a.title)+'</h3><div class="rjsa-who">'+esc(a.who)+'</div>'
      + '<div class="rjsa-body">'+esc(step.body)+'</div><div class="rjsa-prompt">'+esc(step.prompt)+'</div><div class="rjsa-choices">';
    step.choices.forEach(function(c,idx){
      h += '<button class="rjsa-choice'+(c.primary?' primary':'')+'" data-arc="'+a.id+'" data-idx="'+idx+'">'
        + '<span class="cl">'+esc(c.label)+'</span><span class="cd">'+esc(c.desc)+'</span></button>';
    });
    return h + '</div></div>';
  }

  function renderArcsScreen(){
    if (!document.getElementById('S-arcs')) return;
    var m = mem(); if (!m) return;
    renderGauges();
    var deciding = m.active.filter(function(x){ return x.awaiting; });
    var waiting  = m.active.filter(function(x){ return !x.awaiting; });

    var d = document.getElementById('rjsa-decide');
    if (d) d.innerHTML = deciding.length ? deciding.map(arcCardHTML).join('')
      : '<div class="rjsa-empty">Rien à trancher pour l\u2019instant. Les situations se présentent au fil des semaines.</div>';

    var ac = document.getElementById('rjsa-active');
    if (ac) ac.innerHTML = waiting.length ? waiting.map(function(inst){
      var a = arcDef(inst.arcId); if (!a) return '';
      return '<div class="rjsa-mini"><span class="dot" style="background:'+tagColor(a.tag)+'"></span>'
        + '<div><div class="mt">'+esc(a.title)+'</div><div class="ms">'+esc(a.who)+' · la suite se dessine…</div></div>'
        + '<span class="when">à suivre</span></div>';
    }).join('') : '<div class="rjsa-empty">Aucune intrigue en sommeil.</div>';

    var dn = document.getElementById('rjsa-done');
    if (dn) dn.innerHTML = m.completed.length ? m.completed.slice(0,6).map(function(c){
      return '<div class="rjsa-mini"><span class="dot" style="background:'+tagColor(c.tag)+'"></span>'
        + '<div><div class="mt">'+esc(c.title)+'</div><div class="ms">'+esc(c.outcome)+'</div></div>'
        + '<span class="when">S'+(c.saison||'')+'·s'+(c.week||'')+'</span></div>';
    }).join('') : '<div class="rjsa-empty">Tes choix laisseront ici leur trace.</div>';
  }

  function refreshIfOnScreen(){
    var scr = document.getElementById('S-arcs');
    if (scr && scr.classList.contains('on')) renderArcsScreen();
  }

  // Filet robuste : un autre module peut réécrire refreshScreen après nous.
  // On observe l'apparition de la classe .on sur les écrans pour rendre S-arcs
  // et rafraîchir la carte d'accueil, indépendamment de tout wrap.
  function installObserver(){
    if (window._rjArcsObserver) return;
    var home = document.getElementById('S-home');
    var root = (home && home.parentNode) ? home.parentNode : document.body;
    try {
      var obs = new MutationObserver(function(muts){
        for (var i=0;i<muts.length;i++){
          var t = muts[i].target;
          if (!t || !t.id) continue;
          if (t.id === 'S-arcs' && t.classList && t.classList.contains('on')) renderArcsScreen();
          else if (t.id === 'S-home' && t.classList && t.classList.contains('on')) onHomeShown();
        }
      });
      obs.observe(root, { attributes:true, subtree:true, attributeFilter:['class'] });
      window._rjArcsObserver = obs;
    } catch (e) { console.warn('[32] observer:', e); }
  }

  // Carte d'accès injectée en tête de l'accueil quand une décision attend.
  function injectHomeCard(){
    var home = document.getElementById('S-home'); if (!home) return;
    var existing = document.getElementById('rjsa-homecard');
    var n = pendingCount();
    if (n <= 0){ if (existing) existing.remove(); return; }
    if (!existing){
      existing = document.createElement('div');
      existing.id = 'rjsa-homecard'; existing.className = 'rjsa-homecard';
      existing.addEventListener('click', function(){ if (typeof navTo==='function') navTo('S-arcs'); });
      // insérer en tête du contenu de l'accueil
      var anchor = home.querySelector('.scr-body') || home;
      anchor.insertBefore(existing, anchor.firstChild);
    }
    existing.innerHTML = '<div><div class="hc-t">Vie de paddock</div><div class="hc-s">'
      + (n>1 ? (n+' décisions t\u2019attendent') : 'Une décision t\u2019attend') + '</div></div>'
      + '<div class="hc-badge">'+n+'</div>';
  }

  // Pop-up d'accueil : s'affiche quand une décision se déclenche, UNE fois par
  // décision (suivi via inst.lastPopupStep). Non bloquant, fermable.
  function closePopup(){
    var ov = document.getElementById('rjsa-modal-ov');
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
  }
  function showPopup(inst){
    var a = arcDef(inst.arcId), step = stepDef(inst.arcId, inst.stepId);
    if (!a || !step) return;
    closePopup();
    var ov = document.createElement('div'); ov.id='rjsa-modal-ov'; ov.className='rjsa-modal-ov';
    ov.innerHTML =
      '<div class="rjsa-modal" role="dialog" aria-modal="true">' +
        '<div class="pm-top"><span class="rjsa-tag '+a.tag+'">'+tagLabel(a.tag)+'</span></div>' +
        '<div class="pm-eyebrow">Vie de paddock</div>' +
        '<h3>'+esc(a.title)+'</h3><div class="pm-who">'+esc(a.who)+'</div>' +
        '<div class="pm-body">'+esc(step.body)+'</div>' +
        '<div class="pm-actions">' +
          '<button class="pm-btn pm-later" id="rjsa-pm-later">Plus tard</button>' +
          '<button class="pm-btn pm-go" id="rjsa-pm-go">Traiter maintenant</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e){
      if (e.target === ov || e.target.closest('#rjsa-pm-later')){ closePopup(); return; }
      if (e.target.closest('#rjsa-pm-go')){ closePopup(); if (typeof navTo==='function') navTo('S-arcs'); }
    });
  }
  // Affiche le pop-up de la 1re décision non encore présentée, seulement sur l'accueil.
  function maybeShowPopup(){
    if (document.getElementById('rjsa-modal-ov')) return;        // déjà ouvert
    var home = document.getElementById('S-home');
    if (!home || !home.classList.contains('on')) return;          // seulement sur l'accueil
    var m = mem(); if (!m) return;
    for (var i=0;i<m.active.length;i++){
      var inst = m.active[i];
      if (inst.awaiting && inst.lastPopupStep !== inst.stepId){
        inst.lastPopupStep = inst.stepId;   // marqué : ne se ré-affichera pas pour cette décision
        showPopup(inst);
        return;
      }
    }
  }
  // Appelé à chaque fois que l'accueil (re)devient visible.
  function onHomeShown(){ injectHomeCard(); maybeShowPopup(); }

  // ==========================================================================
  // BRANCHEMENTS
  // ==========================================================================
  function installTickHook(){
    if (typeof WEEKLY_TICK_HOOKS === 'undefined' || !WEEKLY_TICK_HOOKS) return false;
    if (WEEKLY_TICK_HOOKS.some(function(h){ return h && h.id==='storyArcs'; })) return true;
    WEEKLY_TICK_HOOKS.push({ id:'storyArcs', run:function(weeks){ try { tickWeeks(weeks); } catch(e){ console.warn('[32] tick:', e); } } });
    return true;
  }

  function wrapRefreshScreen(){
    if (typeof window.refreshScreen !== 'function') return false;
    if (window.refreshScreen._rjStoryArcs) return true;
    var orig = window.refreshScreen;
    window.refreshScreen = function(id){
      if (id === 'S-arcs'){ ensureScreen(); renderArcsScreen(); return; }
      var ret = orig.apply(this, arguments);
      if (id === 'S-home'){ try { onHomeShown(); } catch(e){} }
      return ret;
    };
    window.refreshScreen._rjStoryArcs = true;
    return true;
  }

  function bootstrap(retries){
    var ok = installTickHook() & wrapRefreshScreen();
    ensureScreen();
    installObserver();
    if (!ok){
      if (retries > 0){ setTimeout(function(){ bootstrap(retries-1); }, 250); return; }
      console.warn('[32-story-arcs] dépendances manquantes (WEEKLY_TICK_HOOKS / refreshScreen).');
      return;
    }
    console.log('[32-story-arcs] actif — arcs mid-season (écran S-arcs, hook hebdo). Debug: rjArcsDebug()');
  }

  window.rjArcsDebug = function(){
    var m = mem();
    console.log('=== 32 story-arcs ===');
    console.log('actifs   :', m ? m.active.map(function(x){return x.arcId+(x.awaiting?'*':'');}) : '(pas de partie)');
    console.log('résolus  :', m ? m.completed.length : 0);
    console.log('en attente de décision :', pendingCount());
  };
  // Helpers de test/QA (sans effet de bord nuisible)
  window.rjArcsForceStart = function(id){ try { startArc(id); refreshIfOnScreen(); injectHomeCard(); } catch(e){ console.warn(e); } };
  window.rjArcsTick = function(w){ try { tickWeeks(w||1); } catch(e){ console.warn(e); } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ bootstrap(40); });
  else bootstrap(40);

})();
