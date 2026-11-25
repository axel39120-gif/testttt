/* =====================================================================
 * 171-questions-presse.js — DES QUESTIONS QUI CHANGENT
 *
 * POURQUOI
 * La salle de presse (100) n'avait que trente questions, dont cinq ou six
 * possibles à un moment donné : elles revenaient d'une conférence à l'autre,
 * et deux questions d'une même conférence portaient sur le même sujet.
 *
 * CE QUE FAIT LE MODULE
 * Il complète la banque de 100 : saison en cours, résultats, qualifs, écurie
 * et voiture, coéquipier, marché, catégorie, circuit, vie de pilote. Chaque
 * question a un thème ; 100 n'en pose jamais deux du même thème dans une
 * conférence, et écarte celles des dernières conférences (G._rjPresseVues).
 * =================================================================== */
(function () {
  "use strict";

  var EFFETS = {
    assure:      { rep: { med: 3, pub: 3, pad: 1, rec: 2 }, mental: 1 },
    mesure:      { rep: { med: 1, pub: 1, pad: 3, rec: 2 } },
    humble:      { rep: { med: 2, pub: 2, pad: 3, rec: 1 }, confiance: 3 },
    provocateur: { rep: { med: 4, pub: 4, pad: -3, rec: -1 }, rivalite: 8 },
    evasif:      { rep: { med: -2, pub: -1, pad: 1, rec: 0 } }
  };
  var RETOURS = {
    assure: ["Les stylos courent. Le ton plaît.", "La citation part aussitôt sur les réseaux.", "Une assurance qui fait son effet dans la salle."],
    mesure: ["Réponse propre, rien à redire.", "Le paddock apprécie la retenue.", "Les spécialistes hochent la tête."],
    humble: ["Le garage appréciera.", "Un sourire dans la salle : la réponse touche juste.", "L'attaché de presse respire."],
    provocateur: ["Le titre de demain est trouvé.", "Un murmure parcourt la salle.", "Les téléphones se lèvent : ça va faire du bruit."],
    evasif: ["Les carnets se referment.", "La salle reste sur sa faim.", "Question suivante, un peu fraîche."]
  };
  function sur(L) { return L[Math.floor(Math.random() * L.length)]; }
  function nom(x) { var b = String((x && (x.nom || x.name)) || "").trim().split(/\s+/); return b.length < 2 ? b[0] || "" : b.slice(1).join(" "); }

  /* Ce que 100 ne calcule pas, une fois par conférence. */
  function X(c) {
    if (c._x) return c._x;
    var G = window.G, R = G.races || [], d = R[R.length - 1], av = R[R.length - 2], cal = window.CAL_RACES || [], x = c._x = {};
    x.total = cal.length || 10;
    x.part = R.length / x.total;
    x.reste = Math.max(0, x.total - R.length);
    x.victoires = R.filter(function (r) { return r.pos === 1; }).length;
    x.podiums = R.filter(function (r) { return r.pos >= 1 && r.pos <= 3; }).length;
    x.poles = R.filter(function (r) { return r.pole || r.qualiPos === 1; }).length;
    x.gain = d && d.qualiPos && d.pos ? d.qualiPos - d.pos : 0;
    x.quali = d ? d.qualiPos || 0 : 0;
    x.progres = d && av && d.pos && av.pos ? av.pos - d.pos : 0;
    x.avant = av || null;
    x.pluie = !!(d && (d.weather === "wet" || d.weather === "storm"));
    x.record = !!(d && d.bestLap && d.bestLap.isPlayer);
    x.moyQuali = R.length >= 3 ? R.slice(-3).reduce(function (s, r) { return s + (r.qualiPos || 15); }, 0) / 3 : 0;
    x.moyCourse = R.length >= 3 ? R.slice(-3).reduce(function (s, r) { return s + (r.pos || 15); }, 0) / 3 : 0;
    x.duelsGagnes = R.filter(function (r) { return r.tmPos && r.pos && r.pos < r.tmPos; }).length;
    x.duels = R.filter(function (r) { return r.tmPos && r.pos; }).length;
    var n = null; try { n = typeof getNextRace === "function" ? getNextRace() : null; } catch (e) {}
    x.suivant = n ? n.name : null;
    try { x.type = n ? getCircuitData(n.name).type : null; x.depasse = n ? getCircuitData(n.name).overtake : null; } catch (e) {}
    x.ici = n ? R.filter(function (r) { return r.circuit === n.name; })[0] : null;
    /* Écurie : rang de la voiture et rang au championnat des équipes. */
    try {
      var notes = getTeamRatings(), L = (TEAMS_BY_CAT[G.cat] || []).slice().sort(function (a, b) { return notes[b] - notes[a]; });
      x.rangVoiture = L.indexOf(G.currentTeam) + 1; x.nbEquipes = L.length; x.meilleure = L[0];
    } catch (e) { x.rangVoiture = 0; }
    var pts = {}; (G.rivals || []).forEach(function (r) { if (r.team) pts[r.team] = (pts[r.team] || 0) + (r.pts || 0); });
    if (G.currentTeam) pts[G.currentTeam] = (pts[G.currentTeam] || 0) + (G.champPts || 0);
    var E = Object.keys(pts).sort(function (a, b) { return pts[b] - pts[a]; });
    x.rangEquipe = R.length ? E.indexOf(G.currentTeam) + 1 : 0; x.equipeTete = E[0];
    x.partPoints = pts[G.currentTeam] ? Math.round(100 * (G.champPts || 0) / pts[G.currentTeam]) : 0;
    try { x.acad = window.PLAYER_ACADEMY && PLAYER_ACADEMY.id ? getAcademy(PLAYER_ACADEMY.id) : null; } catch (e) {}
    x.transfert = G.pendingTransfer || null;
    x.budgetCourt = (G.budget || 0) < 20000;
    x.sponsors = (G.sponsors || []).length;
    x.serie = 0; for (var i = R.length - 1; i >= 0 && R[i].pos >= 1 && R[i].pos <= 10; i--) x.serie++;
    return x;
  }

  var T = [];
  /* id, thème, poids, condition, texte, réponses par ton. */
  function q(id, theme, poids, quand, texte, rep) {
    T.push({ id: id, theme: theme, poids: poids,
      quand: function (c) { return !!quand(c, X(c)); },
      texte: function (c) { return texte(c, X(c)); },
      reponses: Object.keys(rep).map(function (ton) { return { ton: ton, texte: rep[ton], effets: EFFETS[ton], get retour() { return sur(RETOURS[ton]); } }; }) });
  }

  /* --- Résultats ---------------------------------------------------------- */
  q("remontee", "resultat", 4, function (c, x) { return x.gain >= 4; }, function (c, x) { return "Parti " + x.quali + "e à " + c.derniereCircuit + ", arrivé " + c.dernierePos + "e : comment construit-on une remontée pareille ?"; },
    { assure: "En attaquant dès le premier virage. Je savais que j'avais le rythme.", mesure: "Un bon départ, deux bons choix, et pas d'erreur. C'est aussi simple que ça.", humble: "La voiture était bien meilleure en course. Merci aux ingénieurs.", provocateur: "Beaucoup de pilotes freinent trop tôt. J'en ai profité." });
  q("chute", "resultat", 4, function (c, x) { return x.gain <= -4; }, function (c, x) { return "Vous partiez " + x.quali + "e à " + c.derniereCircuit + " et vous finissez " + c.dernierePos + "e. Où la course vous a-t-elle échappé ?"; },
    { mesure: "On analysera les données. La réponse est dans les premiers tours.", humble: "J'ai ma part. Je n'ai pas su défendre quand il le fallait.", assure: "Ça ne se reproduira pas. Le rythme de qualif, lui, est bien là.", evasif: "C'est la course, il n'y a pas grand-chose à ajouter." });
  q("serie_points", "resultat", 3, function (c, x) { return x.serie >= 4; }, function (c, x) { return x.serie + " courses d'affilée dans les dix premiers : la régularité, c'est votre marque de fabrique ?"; },
    { assure: "Oui, et un titre se gagne comme ça.", mesure: "C'est une base. Il faut maintenant transformer ça en podiums.", humble: "C'est surtout celle de l'équipe : la voiture ne casse jamais.", provocateur: "Les autres brillent un dimanche sur quatre. Moi, j'encaisse tous les dimanches." });
  q("mieux", "resultat", 3, function (c, x) { return x.progres >= 5; }, function (c, x) { return "Quel écart entre " + (x.avant && x.avant.circuit || "la course précédente") + " et " + c.derniereCircuit + " : " + x.progres + " places de mieux. Que s'est-il passé ?"; },
    { mesure: "On a compris un problème de réglage. Rien de magique.", assure: "On a retrouvé notre vrai niveau, voilà tout.", humble: "L'équipe a travaillé jour et nuit, c'est pour elle.", evasif: "Un week-end ne ressemble jamais au précédent." });
  q("moins_bien", "resultat", 3, function (c, x) { return x.progres <= -5; }, function (c, x) { return "Vous étiez bien mieux à " + (x.avant && x.avant.circuit || "la manche précédente") + ". Pourquoi ce coup d'arrêt à " + c.derniereCircuit + " ?"; },
    { mesure: "Ce circuit ne convenait pas à la voiture, on le savait.", humble: "Je n'ai pas trouvé mes repères du week-end.", provocateur: "Demandez à ceux qui ont choisi les réglages.", assure: "Un accident de parcours. Rendez-vous à la prochaine." });
  q("pluie", "resultat", 4, function (c, x) { return x.pluie; }, function (c) { return "Sous la pluie de " + c.derniereCircuit + ", " + (c.dernierePos <= 5 ? "vous étiez à l'aise" : "c'était plus compliqué") + ". Quel rapport avez-vous avec la piste mouillée ?"; },
    { assure: "J'adore. La pluie remet tout le monde à égalité.", mesure: "Il faut sentir la piste changer. C'est un autre métier.", humble: "J'apprends encore, chaque course sous la pluie m'en apprend dix.", provocateur: "Certains devraient rester au garage quand il pleut." });
  q("meilleur_tour", "resultat", 3, function (c, x) { return x.record; }, function (c) { return "Le meilleur tour à " + c.derniereCircuit + " est pour vous. Symbolique, ou un message à la concurrence ?"; },
    { assure: "Un message. On a la vitesse.", humble: "Un joli cadeau pour les mécanos.", mesure: "Un tour ne fait pas une course, mais c'est bon signe.", provocateur: "Qu'ils regardent le chrono, ils comprendront." });
  q("premier_podium", "resultat", 5, function (c, x) { return c.podium && x.podiums === 1; }, function (c) { return "Votre premier podium de la saison, à " + c.derniereCircuit + ". Qu'est-ce que ça débloque ?"; },
    { assure: "La suite. On ne va pas s'arrêter à un.", humble: "De la joie, surtout pour ceux qui m'ont soutenu cet hiver.", mesure: "De la confiance, mais le travail reste le même." });
  q("victoires_saison", "resultat", 3, function (c, x) { return x.victoires >= 2; }, function (c, x) { return x.victoires + " victoires déjà cette saison. Vous en aviez rêvé, ou vous l'aviez prévu ?"; },
    { assure: "Prévu. On s'est préparés pour ça.", humble: "Rêvé ! Je me pince encore.", mesure: "On prend les courses une par une.", provocateur: "J'en avais prévu plus, pour tout vous dire." });
  q("sans_podium", "resultat", 3, function (c, x) { return x.podiums === 0 && c.courses >= 5; }, function (c) { return c.courses + " courses et toujours pas de podium. Est-ce que ça commence à peser ?"; },
    { mesure: "On se rapproche. Les chronos le montrent mieux que les classements.", humble: "Oui, je ne vais pas mentir. Mais je dors bien la nuit.", assure: "Il arrive. Gardez cette question pour la prochaine fois.", evasif: "Je ne compte pas." });

  /* --- Qualifs ------------------------------------------------------------- */
  q("qualif_faible", "qualif", 3, function (c, x) { return x.moyQuali && x.moyQuali - x.moyCourse >= 3; }, function () { return "Vous êtes meilleur le dimanche que le samedi. Qu'est-ce qui manque sur un tour ?"; },
    { mesure: "La mise en température. On y travaille au simulateur.", humble: "C'est moi : je dois oser davantage sur un tour.", assure: "Les points se marquent le dimanche, non ?", evasif: "On verra samedi prochain." });
  q("qualif_forte", "qualif", 3, function (c, x) { return x.moyQuali && x.moyCourse - x.moyQuali >= 3; }, function () { return "Brillant en qualification, moins en course : pourquoi reculez-vous le dimanche ?"; },
    { mesure: "On use trop tôt. La solution passe par les réglages.", humble: "Je dois mieux gérer mes relais.", provocateur: "Parce que devant, certains défendent à la limite du règlement.", assure: "Le jour où on règle ça, on gagne." });
  q("pole", "qualif", 4, function (c, x) { return x.quali === 1; }, function (c) { return "Cette pole à " + c.derniereCircuit + ", c'est le tour parfait ?"; },
    { assure: "Presque. Il restait un dixième, je sais où.", humble: "La voiture collait à la route, j'ai suivi.", mesure: "Un très bon tour au bon moment.", provocateur: "Parfait, oui. Les autres peuvent le regarder en boucle." });
  q("poles_saison", "qualif", 2, function (c, x) { return x.poles >= 2; }, function (c, x) { return x.poles + " poles cette saison. Le samedi est devenu votre terrain de jeu ?"; },
    { assure: "J'aime quand il n'y a plus que le chrono.", mesure: "C'est utile, surtout là où on ne double pas.", humble: "Mon ingénieur y est pour beaucoup." });

  /* --- Championnat et saison ------------------------------------------------ */
  q("mi_saison", "saison", 3, function (c, x) { return x.part >= .45 && x.part <= .6; }, function (c) { return "Nous sommes à mi-saison et vous êtes " + c.place + (c.place === 1 ? "er" : "e") + ". Quelle note vous donnez-vous ?"; },
    { assure: "Huit sur dix. Les deux points qui manquent arrivent.", mesure: "Sept. Du bon, et des erreurs que je connais.", humble: "Je laisse l'équipe noter.", evasif: "Je n'aime pas les notes." });
  q("derniere_ligne", "saison", 4, function (c, x) { return x.reste > 0 && x.reste <= 3 && c.courses >= 4; }, function (c, x) { return "Il reste " + x.reste + " manche" + (x.reste > 1 ? "s" : "") + ". Comment aborde-t-on une fin de saison quand on est P" + c.place + " ?"; },
    { assure: "À fond. On ne garde rien pour l'hiver.", mesure: "Chaque point compte, on ne fera pas n'importe quoi.", humble: "En pensant à finir proprement pour l'équipe.", provocateur: "Certains vont trembler. Pas moi." });
  q("titre_calcul", "titre", 4, function (c, x) { return c.ecartLeader > 0 && c.place <= 5 && x.part > .5; }, function (c, x) { return c.ecartLeader + " points de retard sur " + nom(c.leader) + " avec " + x.reste + " manches à courir : vous faites les comptes ?"; },
    { assure: "Oui, et ils sont bons pour nous.", mesure: "Mon ingénieur compte. Moi, je conduis.", provocateur: "Qu'il les fasse, lui. C'est lui qui a quelque chose à perdre.", evasif: "Non, jamais." });
  q("avance", "titre", 4, function (c, x) { return c.enTete && c.courses >= 4 && !!c.suivant; }, function (c) { return "Vous menez devant " + nom(c.suivant) + ". On gère, ou on continue d'attaquer ?"; },
    { assure: "On attaque. Gérer, c'est commencer à perdre.", mesure: "On choisit nos batailles, c'est tout.", humble: "On remercie la voiture, et on recommence.", provocateur: "Derrière, ils ont déjà l'air fatigués." });
  q("milieu", "saison", 2, function (c) { return c.place >= 6 && c.place <= 12 && c.courses >= 4; }, function (c) { return "P" + c.place + " au championnat : l'objectif de départ est-il encore atteignable ?"; },
    { mesure: "Oui, si on marque à chaque course.", assure: "Évidemment. On est à deux bons week-ends du top 5.", humble: "On verra. J'essaie de progresser à chaque manche.", evasif: "On n'en avait pas parlé publiquement." });
  q("fond", "saison", 3, function (c) { return c.place > 12 && c.courses >= 4; }, function (c) { return "P" + c.place + " au classement. Est-ce la saison que vous imaginiez cet hiver ?"; },
    { humble: "Non. Et je ne cherche pas d'excuse.", mesure: "Non, mais on sait pourquoi, et on corrige.", assure: "Attendez la fin. Je termine toujours fort.", provocateur: "Avec ce que j'ai entre les mains, je fais mieux que prévu." });
  q("coude", "titre", 3, function (c) { return !!c.devant && c.courses >= 3; }, function (c) { return nom(c.devant) + " est juste devant vous au championnat. Vous le regardez de près ?"; },
    { assure: "Je le regarde surtout dans mon viseur.", mesure: "Comme tous les autres. Il est rapide, c'est vrai.", humble: "J'apprends en le suivant, honnêtement.", provocateur: "Il peut profiter de la vue pendant qu'il est devant." });
  q("menace", "titre", 2, function (c) { return !!c.suivant && c.courses >= 3 && !c.enTete; }, function (c) { return nom(c.suivant) + " revient derrière vous. Ça vous inquiète ?"; },
    { assure: "Non. Il devra d'abord me doubler.", mesure: "Ça me garde éveillé.", humble: "C'est un excellent pilote, il faudra être bon.", evasif: "Je ne regarde pas derrière." });

  /* --- Écurie et voiture ------------------------------------------------------ */
  q("voiture_top", "voiture", 3, function (c, x) { return x.rangVoiture === 1 && x.nbEquipes > 3; }, function (c) { return c.equipe + " a la meilleure voiture du plateau. Avez-vous encore une excuse ?"; },
    { assure: "Je n'en ai jamais cherché.", humble: "Aucune. À moi d'être à la hauteur de leur travail.", provocateur: "La voiture ne passe pas les vitesses toute seule.", mesure: "Les écarts sont plus faibles qu'on ne croit." });
  q("voiture_milieu", "voiture", 3, function (c, x) { return x.rangVoiture > 2 && x.rangVoiture <= x.nbEquipes * .65; }, function (c, x) { return "Sur le papier, " + c.equipe + " a la " + x.rangVoiture + "e voiture sur " + x.nbEquipes + ". Peut-on rêver plus haut ?"; },
    { assure: "Un pilote peut gagner deux ou trois rangs. C'est mon travail.", mesure: "Sur certains circuits, oui. Il faudra les choisir.", humble: "Si on rêve plus haut, ce sera grâce à l'usine." });
  q("voiture_lente", "voiture", 4, function (c, x) { return x.nbEquipes > 4 && x.rangVoiture > x.nbEquipes * .65; }, function (c, x) { return c.equipe + " est " + x.rangVoiture + "e sur " + x.nbEquipes + " en performance pure. Comment rester motivé ?"; },
    { humble: "En me rappelant d'où je viens. Beaucoup prendraient ma place.", assure: "En battant des voitures plus rapides. C'est le plus beau des plaisirs.", mesure: "En jugeant ma course, pas mon classement.", provocateur: "Donnez-moi la voiture de devant et on en reparle." });
  q("ecurie_tete", "ecurie", 3, function (c, x) { return x.rangEquipe === 1 && c.courses >= 3 && !c.independant; }, function (c) { return c.equipe + " mène le championnat des équipes. L'ambiance à l'usine ?"; },
    { humble: "Incroyable. Ils méritent chaque point.", assure: "Celle d'une équipe qui compte bien finir le travail.", mesure: "Studieuse. Personne ne fête quoi que ce soit avant la fin." });
  q("ecurie_rang", "ecurie", 2, function (c, x) { return x.rangEquipe >= 2 && c.courses >= 3 && !c.independant; }, function (c, x) { return c.equipe + " est " + x.rangEquipe + "e, derrière " + x.equipeTete + " notamment. Que manque-t-il à l'équipe ?"; },
    { mesure: "De la régularité sur les deux voitures.", humble: "Rien. C'est à nous, pilotes, de ramener plus de points.", provocateur: "Un deuxième pilote au niveau, peut-être.", assure: "Du temps. On va les rattraper." });
  q("porteur", "ecurie", 3, function (c, x) { return x.partPoints >= 65 && c.courses >= 4 && !!c.coequipier; }, function (c, x) { return "Vous avez marqué " + x.partPoints + " % des points de " + c.equipe + ". Vous portez l'équipe ?"; },
    { humble: "Personne ne porte une équipe seul.", assure: "Je fais ce pour quoi on m'a engagé.", provocateur: "Les chiffres parlent, non ?", mesure: "Il y a des saisons comme ça, l'an prochain ce sera peut-être l'inverse." });
  q("porte", "ecurie", 3, function (c, x) { return x.partPoints > 0 && x.partPoints <= 35 && c.courses >= 4 && !!c.coequipier; }, function (c, x) { return "Seulement " + x.partPoints + " % des points de " + c.equipe + " viennent de vous. Comprenez-vous les critiques ?"; },
    { humble: "Oui, et elles sont justes pour l'instant.", mesure: "Elles font partie du métier. Je préfère y répondre en piste.", assure: "La seconde moitié de saison sera la mienne.", evasif: "Je ne lis pas la presse." });
  q("equipe_confiance", "ecurie", 3, function (c) { return c.confiance >= 75 && !c.independant; }, function (c) { return "On sent une vraie complicité entre vous et " + c.equipe + ". D'où vient-elle ?"; },
    { humble: "Du temps passé au garage, pas devant les caméras.", mesure: "De la franchise. On se dit tout.", assure: "Des résultats. Ils arrangent beaucoup de choses." });
  q("evolutions", "voiture", 2, function (c) { return c.courses >= 3 && !c.independant; }, function (c) { return "Quelles évolutions attendez-vous de " + c.equipe + " pour les prochaines manches ?"; },
    { mesure: "Du travail sur les appuis. On sait où on perd.", humble: "Je fais confiance au bureau d'études.", provocateur: "Celles qu'on m'avait promises il y a deux mois.", evasif: "Vous verrez bien." });
  q("consignes", "ecurie", 2, function (c) { return !!c.coequipier; }, function (c) { return "Si l'équipe vous demandait de laisser passer " + nom(c.coequipier) + ", vous obéiriez ?"; },
    { humble: "Oui. L'équipe passe avant.", mesure: "Ça dépend de la raison et du moment.", provocateur: "Qu'il vienne me chercher d'abord.", assure: "On ne me le demandera pas." });

  /* --- Coéquipier --------------------------------------------------------------- */
  q("duel_bilan", "coequipier", 3, function (c, x) { return x.duels >= 3 && !!c.coequipier; }, function (c, x) { return "Le bilan face à " + nom(c.coequipier) + " est de " + x.duelsGagnes + " à " + (x.duels - x.duelsGagnes) + ". Que dit-il de vous ?"; },
    { mesure: "Que nous nous poussons l'un l'autre.", assure: "Que je progresse, course après course.", humble: "Qu'il est très fort, et que j'apprends.", provocateur: "Le seul score qui compte, c'est celui de la fin." });
  q("ambiance_garage", "coequipier", 2, function (c) { return !!c.coequipier; }, function (c) { return "Avec " + nom(c.coequipier) + ", vous partagez vraiment vos données ?"; },
    { humble: "Tout. C'est comme ça qu'on avance.", mesure: "L'essentiel. Chacun garde un ou deux secrets.", provocateur: "Je partage. Je ne suis pas sûr que ce soit réciproque.", evasif: "C'est interne." });

  /* --- Marché et avenir ----------------------------------------------------------- */
  q("transfert_signe", "marche", 6, function (c, x) { return !!x.transfert; }, function (c, x) { return "Vous roulerez pour " + x.transfert.team + " en " + x.transfert.cat + " l'an prochain. Comment finit-on sa saison chez " + c.equipe + " ?"; },
    { humble: "En donnant tout à ceux qui m'ont fait grandir.", mesure: "Professionnellement, jusqu'au dernier tour.", assure: "En gagnant. Ce serait la plus belle façon de dire au revoir.", provocateur: "Ma tête est déjà un peu ailleurs, pour être honnête." });
  q("academie", "marche", 3, function (c, x) { return !!x.acad; }, function (c, x) { return "Vous êtes pilote de " + x.acad + ". La pression d'une académie, ça aide ou ça freine ?"; },
    { assure: "Ça aide. J'ai besoin qu'on attende beaucoup de moi.", humble: "Ils me donnent des moyens que je n'aurais jamais eus.", mesure: "Les deux, selon les week-ends.", evasif: "Je n'ai pas le droit d'en dire trop." });
  q("sans_academie", "marche", 2, function (c, x) { return !x.acad && /Formule [234]|Regional/.test(c.cat); }, function () { return "Vous n'êtes soutenu par aucune académie de F1. Est-ce un handicap ?"; },
    { assure: "C'est ma liberté. Je choisirai.", humble: "C'est plus dur, mais ça apprend à se battre.", mesure: "Les résultats ouvrent les mêmes portes.", provocateur: "Elles se sont trompées, elles s'en rendront compte." });
  q("budget", "marche", 2, function (c, x) { return x.budgetCourt && !c.enF1; }, function () { return "On dit que votre budget est serré. Le talent suffit-il dans ce sport ?"; },
    { humble: "Non, et je remercie chaque partenaire qui m'aide à rouler.", provocateur: "Regardez la grille, vous avez la réponse.", mesure: "Il faut les deux. Je m'occupe du talent.", assure: "Le mien, oui." });
  q("sponsors", "marche", 2, function (c, x) { return x.sponsors >= 2; }, function (c, x) { return "Vous avez " + x.sponsors + " partenaires aujourd'hui. Est-ce que cela change votre façon d'être pilote ?"; },
    { mesure: "Ça demande du temps, mais ils font partie de l'aventure.", humble: "Sans eux, je ne serais pas là.", assure: "Non. En piste, il n'y a que le chrono.", evasif: "Pas vraiment." });
  q("etape_suivante", "marche", 2, function (c) { return /Formule [34]|Regional/.test(c.cat) && c.place <= 5 && c.courses >= 3; }, function (c) { return "Avec une " + c.place + "e place en " + c.cat + ", vous sentez-vous prêt pour l'échelon supérieur ?"; },
    { assure: "Prêt, oui. Demain s'il le faut.", mesure: "Je veux d'abord finir ce que j'ai commencé ici.", humble: "Ce n'est pas à moi d'en juger.", provocateur: "Je l'étais déjà l'an dernier." });

  /* --- Catégories -------------------------------------------------------------------- */
  q("f4_monoplace", "categorie", 3, function (c) { return c.cat === "Formule 4"; }, function () { return "Passer du karting à la monoplace : quelle a été la plus grosse surprise ?"; },
    { mesure: "Le freinage. Tout est plus long, plus technique.", humble: "Le travail d'équipe. En karting, on est presque seul.", assure: "Que j'y sois à l'aise aussi vite.", evasif: "Rien de spécial." });
  q("f4_jeunes", "categorie", 2, function (c) { return c.cat === "Formule 4"; }, function () { return "La Formule 4 voit passer des dizaines d'espoirs. Comment sortir du lot ?"; },
    { assure: "En gagnant. On ne retient que ça.", mesure: "En faisant peu d'erreurs, très longtemps.", provocateur: "Regardez bien, la plupart auront disparu dans deux ans.", humble: "En écoutant ceux qui savent." });
  q("fr_aero", "categorie", 3, function (c) { return c.cat === "Formula Regional"; }, function () { return "En Formula Regional, l'appui change tout. Avez-vous dû réapprendre à piloter ?"; },
    { mesure: "Un peu : il faut faire confiance à la voiture à haute vitesse.", humble: "Oui, et j'apprends encore.", assure: "Deux séances ont suffi.", evasif: "Une voiture reste une voiture." });
  q("fr_depasser", "categorie", 2, function (c) { return c.cat === "Formula Regional"; }, function () { return "On double peu dans cette catégorie. Faut-il revoir les règles ?"; },
    { mesure: "Non, ça récompense les qualifs.", provocateur: "Oui. On s'ennuie, même nous.", assure: "Ceux qui savent doubler doublent." });
  q("f3_grille", "categorie", 3, function (c) { return c.cat === "Formule 3"; }, function () { return "Un sprint et une course principale, un peloton immense : comment survit-on à un week-end de Formule 3 ?"; },
    { mesure: "En restant hors des ennuis au premier virage.", assure: "En étant devant, c'est plus calme.", humble: "Avec une équipe qui répare vite.", provocateur: "En espérant que les fous s'éliminent entre eux." });
  q("f3_vitrine", "categorie", 2, function (c) { return c.cat === "Formule 3"; }, function () { return "Vous courez devant les patrons de la F1. Y pensez-vous au volant ?"; },
    { assure: "Oui, et ça me pousse.", humble: "J'essaie de ne pas lever les yeux vers les loges.", mesure: "Jamais en piste, toujours le soir.", evasif: "Non." });
  q("f2_antichambre", "categorie", 3, function (c) { return c.cat === "Formule 2"; }, function () { return "La Formule 2 est l'antichambre de la F1. Combien d'années peut-on y rester sans se perdre ?"; },
    { assure: "Une. Deux au maximum.", mesure: "Le temps qu'il faut pour être prêt.", humble: "Tant qu'on y apprend quelque chose.", provocateur: "Demandez à ceux qui y sont depuis quatre ans." });
  q("f2_licence", "categorie", 2, function (c) { return c.cat === "Formule 2"; }, function () { return "Les points de Super Licence, vous y pensez à chaque arrivée ?"; },
    { mesure: "Bien sûr, c'est la clé de la porte.", assure: "Si on gagne, ils viennent tout seuls.", evasif: "C'est l'affaire de mon agent." });
  q("f1_regard", "categorie", 3, function (c) { return c.enF1; }, function () { return "Vingt pilotes au monde font votre métier. Vous arrive-t-il d'oublier la chance que c'est ?"; },
    { humble: "Jamais. Chaque matin de Grand Prix, j'y pense.", assure: "Ce n'est pas de la chance, c'est quinze ans de travail.", mesure: "Le dimanche soir, parfois, quand ça s'est mal passé." });
  q("f1_budget", "categorie", 2, function (c) { return c.enF1; }, function () { return "Le plafond budgétaire a-t-il vraiment resserré la Formule 1 ?"; },
    { mesure: "Un peu. Les habitudes des grandes équipes restent.", provocateur: "Demandez à ceux qui gagnent depuis dix ans.", assure: "Oui, et c'est notre chance.", evasif: "Je laisse ça aux directeurs." });
  q("f1_calendrier", "categorie", 2, function (c) { return c.enF1; }, function (c, x) { return x.total + " Grands Prix dans l'année : est-ce trop ?"; },
    { mesure: "Pour les mécaniciens, sûrement. Il faut penser à eux.", humble: "Je ne me plaindrai jamais de rouler.", provocateur: "Oui, mais personne n'osera le dire aux promoteurs.", assure: "Donnez-m'en trente." });
  q("debut_f1", "categorie", 5, function (c) { return c.enF1 && c.nouvelleCategorie; }, function (c) { return "Vos premiers Grands Prix en Formule 1 : la marche est-elle plus haute que prévu depuis la " + (c.categoriePrecedente || "formule de promotion") + " ?"; },
    { humble: "Plus haute, oui. Tout va plus vite, partout.", assure: "Je suis à ma place.", mesure: "Elle est haute, mais elle se monte." });

  /* --- Titres, en F1 : les majeurs souvent, les autres presque jamais ---------------------- */
  q("f1_junior", "titre", .35, function (c) { return c.enF1 && c.titresJuniors && c.titresJuniors.length > 0; }, function (c) { return "On l'oublie souvent : vous aviez gagné en " + c.titresJuniors[c.titresJuniors.length - 1].cat + ". Ça compte encore, en Formule 1 ?"; },
    { humble: "Ça m'a appris à gagner, rien de plus.", mesure: "Ici, les compteurs repartent à zéro.", assure: "Gagner, ça ne s'oublie pas." });
  q("f1_champion", "titre", 5, function (c) { return c.enF1 && c.titresF1 >= 1; }, function (c) { return c.titresF1 > 1 ? c.titresF1 + " titres mondiaux. À partir de combien parle-t-on de légende ?" : "Champion du monde de Formule 1 : est-ce que votre vie a vraiment changé ?"; },
    { humble: "Je reste le même, c'est le regard des autres qui change.", assure: "J'en veux d'autres. Beaucoup.", mesure: "On m'attend partout désormais, il faut l'accepter.", provocateur: "Demandez à ceux que j'ai battus." });
  q("f1_doublet", "titre", 4, function (c) { return c.enF1 && c.titresF1 >= 1; }, function () { return "Conserver une couronne mondiale, est-ce plus dur que la conquérir ?"; },
    { mesure: "Oui. On ne surprend plus personne.", assure: "Pour les autres, peut-être.", humble: "On verra si j'en suis capable.", evasif: "Je n'ai pas de comparaison." });
  q("f1_sans_titre", "titre", 3, function (c) { return c.enF1 && !c.titresMajeurs && c.age >= 24; }, function () { return "Il vous manque un titre majeur. Y pensez-vous chaque hiver ?"; },
    { assure: "Chaque jour, pas seulement l'hiver.", mesure: "J'y pense, sans m'y perdre.", humble: "Beaucoup de grands pilotes n'en ont jamais eu.", provocateur: "Donnez-moi la voiture, on en reparle." });
  q("f1_endurance", "titre", 3, function (c) { return c.enF1 && c.titresMajeurs > c.titresF1; }, function () { return "Vous avez déjà gagné un titre majeur hors de la Formule 1. La triple couronne, c'est un objectif ?"; },
    { assure: "Oui. Je veux tout gagner.", mesure: "Un rêve plutôt qu'un objectif.", humble: "Il reste tant à faire ici d'abord." });

  /* --- Circuits ------------------------------------------------------------------------- */
  q("urbain", "circuit", 3, function (c, x) { return x.type === "street" && !!x.suivant; }, function (c, x) { return x.suivant + ", ses murs et aucune marge : un circuit qui vous excite ou qui vous fait peur ?"; },
    { assure: "Il m'excite. C'est là qu'on voit les pilotes.", humble: "Les deux. Et c'est sain.", mesure: "Il faut monter en rythme doucement, toute la semaine." });
  q("rapide", "circuit", 3, function (c, x) { return x.type === "highspeed" && !!x.suivant; }, function (c, x) { return "À " + x.suivant + ", tout se joue en vitesse de pointe. Votre voiture est-elle armée pour ça ?"; },
    { assure: "Oui, vous verrez samedi.", mesure: "On aura moins d'appui que d'habitude, il faudra s'adapter.", provocateur: "Avec ce moteur ? Posez la question au fournisseur.", humble: "L'équipe a préparé quelque chose, je leur fais confiance." });
  q("technique", "circuit", 3, function (c, x) { return x.type === "technical" && !!x.suivant; }, function (c, x) { return x.suivant + " récompense les pilotes fins. C'est votre type de circuit ?"; },
    { assure: "Complètement.", mesure: "J'y prends du plaisir, reste à y être rapide.", humble: "J'ai surtout beaucoup à y apprendre." });
  q("indoublable", "circuit", 2, function (c, x) { return typeof x.depasse === "number" && x.depasse < .25 && !!x.suivant; }, function (c, x) { return "On ne double presque pas à " + x.suivant + ". Le samedi vaut-il plus que le dimanche ?"; },
    { mesure: "Oui, tout le week-end se prépare pour la qualif.", assure: "On peut toujours doubler, il suffit d'oser.", evasif: "On verra." });
  q("deja_couru", "circuit", 3, function (c, x) { return !!x.ici; }, function (c, x) { return "Vous avez déjà couru à " + x.suivant + " cette saison, P" + x.ici.pos + ". Que ferez-vous différemment ?"; },
    { mesure: "On part avec nos notes, c'est un avantage énorme.", assure: "Gagner.", humble: "Éviter les erreurs que j'y ai faites." });

  /* --- Vie de pilote ------------------------------------------------------------------------ */
  q("simu", "vie", 2, function () { return true; }, function () { return "Combien de temps passez-vous au simulateur avant une course ?"; },
    { mesure: "Assez pour connaître chaque bordure, pas assez pour m'en lasser.", assure: "Plus que les autres, d'après mon ingénieur.", humble: "Jamais assez, à les entendre.", evasif: "C'est confidentiel." });
  q("peur", "vie", 2, function () { return true; }, function () { return "Avez-vous déjà eu peur au volant ?"; },
    { humble: "Oui. Ceux qui disent le contraire mentent.", assure: "Non. Le jour où j'aurai peur, j'arrêterai.", mesure: "Après coup, souvent. Pendant, jamais." });
  q("modele", "vie", 2, function () { return true; }, function () { return "Quel pilote regardiez-vous quand vous étiez enfant ?"; },
    { humble: "Tous. Je collectionnais les casques.", assure: "Je regardais surtout comment les battre.", mesure: "Les plus réguliers, pas les plus spectaculaires.", evasif: "Je jouais au foot." });
  q("famille", "vie", 2, function (c) { return c.age <= 22; }, function () { return "Votre famille a beaucoup sacrifié pour votre carrière. Y pensez-vous sur la grille ?"; },
    { humble: "À chaque fois que je mets le casque.", mesure: "Sur la grille, non. Le reste du temps, oui.", assure: "Je leur rendrai tout, avec les intérêts." });
  q("sommeil", "vie", 2, function () { return true; }, function () { return "La veille d'une course, vous dormez ?"; },
    { assure: "Comme un bébé.", humble: "Mal, depuis toujours.", mesure: "Ça dépend de la place sur la grille." });
  q("critiques", "vie", 2, function (c) { return c.courses >= 2; }, function () { return "Lisez-vous ce que nous écrivons sur vous ?"; },
    { mesure: "Parfois. C'est souvent plus juste que les réseaux.", provocateur: "Seulement quand j'ai besoin de rire.", humble: "Oui, et certaines critiques m'ont aidé.", evasif: "Non." });
  q("reseaux", "vie", 2, function (c) { return c.reputation >= 20; }, function () { return "Les réseaux sociaux prennent de plus en plus de place. Un pilote doit-il être une vedette ?"; },
    { mesure: "Il doit surtout être rapide. Le reste suit.", assure: "S'il gagne, il le devient.", provocateur: "Certains ne sont que ça.", humble: "J'essaie de rester moi-même." });
  q("hiver", "vie", 3, function (c) { return c.courses <= 2 && !c.premiereSaison; }, function () { return "Comment avez-vous préparé cette nouvelle saison ?"; },
    { assure: "Comme jamais. Vous allez le voir.", mesure: "Physique, simulateur, et un peu de repos.", humble: "En travaillant ce qui m'avait coûté cher l'an dernier." });
  q("regle", "sport", 2, function () { return true; }, function () { return "Si vous pouviez changer une seule règle du sport, laquelle ?"; },
    { mesure: "Plus de roulage le vendredi pour les jeunes.", provocateur: "Que les commissaires expliquent leurs décisions en face.", humble: "Je suis pilote, pas législateur.", assure: "Des points pour la pole." });
  q("securite", "sport", 2, function () { return true; }, function () { return "Les voitures sont plus sûres que jamais. Le danger fait-il encore partie du métier ?"; },
    { mesure: "Oui. On l'oublie jusqu'au jour où on nous le rappelle.", humble: "Je pense surtout aux commissaires au bord de la piste.", assure: "Il fait partie de ce qu'on aime." });
  q("ecologie", "sport", 2, function () { return true; }, function () { return "Que répondez-vous à ceux qui disent que votre sport appartient au passé ?"; },
    { mesure: "Que nos moteurs servent aussi à inventer ceux de demain.", provocateur: "Qu'ils viennent un dimanche de course.", humble: "Que la question est légitime, et qu'on doit y répondre.", assure: "Les tribunes sont pleines, voilà ma réponse." });
  q("agressif", "sport", 2, function (c) { return c.courses >= 3; }, function () { return "Vos dépassements divisent. Agressif, ou simplement décidé ?"; },
    { assure: "Décidé. Quand il y a une porte, j'y vais.", mesure: "Je laisse toujours la place d'une voiture.", provocateur: "Ceux qui se plaignent sont ceux que j'ai doublés.", humble: "J'ai parfois mal jugé, je l'ai dit à l'intéressé." });
  q("conseil", "vie", 2, function (c) { return c.saison >= 3; }, function () { return "Quel conseil donneriez-vous au pilote que vous étiez à vos débuts ?"; },
    { humble: "Écoute plus, parle moins.", mesure: "Sois patient, tout arrive.", assure: "Ne change rien." });

  (function boot(n) {
    if (window._rj100 && Array.isArray(_rj100.questions)) {
      T.forEach(function (x) { if (!_rj100.questions.some(function (y) { return y.id === x.id; })) _rj100.questions.push(x); });
      if (typeof window._rj64Champs === "function") window._rj64Champs("_rjPresseVues");
      console.log("[171-questions] actif —", _rj100.questions.length, "questions de presse");
      return;
    }
    if (n < 80) setTimeout(function () { boot(n + 1); }, 150);
  })(0);
})();
