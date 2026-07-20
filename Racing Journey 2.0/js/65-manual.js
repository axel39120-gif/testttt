/* =====================================================================
 * 65-manual.js — MANUEL DU PILOTE REFONDU
 *
 * Le manuel ne contenait que 12 entrées, toutes consacrées aux statistiques
 * du pilote. Tout le reste du jeu — week-end de course, contrats, écuries,
 * messagerie, filières de carrière — n'y figurait pas.
 *
 * Ce module :
 *   - enrichit CONCEPT_DEFS avec les mécanismes manquants ;
 *   - regroupe le manuel en RUBRIQUES au lieu d'une liste à plat ;
 *   - ajoute une section dédiée aux CATÉGORIES, avec la filière classique
 *     (karting jusqu'à la F1) et la voie alternative (Super Formula,
 *     endurance, IndyCar), chacune avec ses chiffres réels.
 *
 * Les entrées d'origine sont conservées : elles sont simplement rangées.
 *
 * Réversible : window._rj65Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var wrapped = {};
  var etat = { installe: false, erreur: null };
  window._rj65Status = function () { return etat; };

  /* ------------------------------------------------ nouvelles entrées --- */
  var AJOUTS = {
    /* --- carrière --- */
    Contrat: {
      title: "Contrat", iconKey: "contrat", color: "#34D399",
      desc: "Ton engagement avec une écurie : durée, salaire mensuel, statut de pilote et primes.",
      details: "Un contrat fixe ta durée d'engagement, ton salaire mensuel, ton statut (numéro 1, équivalent ou second pilote) et tes primes de victoire et de podium. Certaines écuries demandent un apport financier. Quand il approche de son terme, les offres concurrentes arrivent par ton agent : tu peux signer, négocier ou refuser."
    },
    Negociation: {
      title: "Négociation", iconKey: "poignee_main", color: "#00D4FF",
      desc: "Face à une offre, tu peux réclamer mieux — mais la patience de l'écurie s'épuise.",
      details: "Chaque demande (salaire, primes, durée, clauses, réduction d'apport) fait progresser la négociation mais consomme la patience de l'écurie. L'écran montre les deux mains qui se rapprochent à chaque concession obtenue, et leur couleur traduit la tension : sereine, crispée, à bout. Si la patience tombe à zéro, la négociation se rompt et l'offre est perdue."
    },
    Agent: {
      title: "Agent", iconKey: "msg_agent", color: "#34D399",
      desc: "Il relaie les offres, te conseille et négocie pour toi.",
      details: "En début de carrière, c'est un de tes parents qui tient ce rôle. Un agent professionnel arrive ensuite : meilleur il est, plus les offres affluent. C'est lui qui t'annonce les propositions d'écurie et de sponsor par la messagerie."
    },
    Reglement: {
      title: "Changement de règlement", iconKey: "alerte", color: "#F59E0B",
      desc: "Tous les cinq ans environ, la hiérarchie peut être entièrement rebattue.",
      details: "À partir de cinq saisons depuis le dernier changement, il existe chaque année une chance sur quatre qu'une nouvelle réglementation entre en vigueur. Les notes de toutes les écuries sont alors retirées au hasard, et leur profil technique redistribué : une écurie rapide en ligne droite peut devenir agile et sous-motorisée. Les anciens dominateurs conservent un léger avantage, rien de plus."
    },

    /* --- écurie et voiture --- */
    NoteEcurie: {
      title: "Note d'écurie", iconKey: "constructeur", color: "#A78BFA",
      desc: "La force brute de ta voiture, de 58 à 98. Elle évolue chaque saison.",
      details: "Cette note pèse lourd sur ton rythme. Elle est recalculée à chaque saison : les écuries au-dessus de 85 subissent une légère pression à la baisse, celles sous 70 un coup de pouce, avec un aléa de quelques points. Une écurie forte ne le reste donc pas éternellement."
    },
    ProfilTechnique: {
      title: "Profil technique", iconKey: "moteur", color: "#FF1801",
      desc: "Chaque écurie a un caractère : vitesse, aéro, agilité, freinage.",
      details: "Les quatre dimensions vont de −1 à +1. Une écurie très rapide en ligne droite mais peu agile brillera sur les circuits rapides et souffrira dans le lent. Ce caractère dérive légèrement chaque saison, se renforce quand l'écurie progresse, et peut être entièrement redistribué lors d'un changement de règlement."
    },
    AffiniteCircuit: {
      title: "Affinité circuit", iconKey: "damier", color: "#FF1801",
      desc: "Le croisement du profil de l'écurie et des exigences du circuit.",
      details: "Chaque circuit réclame un dosage précis de vitesse, d'appui, d'agilité et de freinage. L'affinité qui en résulte vaut jusqu'à environ une demi-seconde au tour, dans un sens comme dans l'autre. C'est ce qui explique qu'une même voiture soit redoutable sur un tracé rapide et quelconque dans le sinueux — et elle s'applique à toi comme à tes rivaux."
    },

    /* --- week-end de course --- */
    EssaisLibres: {
      title: "Essais libres", iconKey: "chrono", color: "#60A5FA",
      desc: "Le moment de régler la voiture et de découvrir la piste.",
      details: "Tu enchaînes des relais pour affiner tes réglages. Chaque run améliore ta connaissance du circuit et la qualité du setup, ce qui se paie ensuite en qualification et en course. La séance a une durée limitée : inutile de tout tenter."
    },
    Qualification: {
      title: "Qualification", iconKey: "chrono", color: "#00D4FF",
      desc: "Elle décide de ta place sur la grille — décisive sur les circuits où l'on ne dépasse pas.",
      details: "Le format dépend de la catégorie : séance unique en karting, F4, Formula Regional, F3, F2, Super Formula et endurance ; élimination en trois temps en Formule 1 ; deux phases en IndyCar. Le choix de gomme n'est pas individuel : il découle de l'état de la piste — tendre au sec, intermédiaire sur piste humide, pneu pluie sous l'averse, identique pour tout le monde."
    },
    Secteurs: {
      title: "Secteurs", iconKey: "analyse_donnees", color: "#FACC15",
      desc: "Le tour est découpé en trois portions, aux longueurs propres à chaque circuit.",
      details: "Les trois secteurs ne sont pas égaux : sur un tracé à très longue ligne droite, un seul secteur peut peser plus de 40 % du tour. Les couleurs sur la carte du circuit correspondent à ce découpage, et comparer tes temps secteur par secteur révèle où tu perds réellement du temps."
    },
    Strategie: {
      title: "Stratégie de course", iconKey: "strategie", color: "#FF1801",
      desc: "Style de pilotage, gommes et arrêts, choisis avant le départ.",
      details: "Le style — attaquer, gérer ou défendre — module ton rythme et l'usure de tes pneus. Selon la catégorie, tu choisis aussi la gomme de départ et le nombre d'arrêts. La F4, la Formula Regional et la F3 ne font aucun arrêt ; la F2 en impose un avec deux gommes différentes ; l'endurance et l'IndyCar ravitaillent en carburant."
    },
    EvenementsCourse: {
      title: "Événements de course", iconKey: "alerte", color: "#F59E0B",
      desc: "Des décisions à prendre en pleine course, avec un risque affiché.",
      details: "Chaque choix indique ses chances de réussite, d'échec et d'incident critique, calculées à partir de ton niveau, du contexte et de ton mental. Leur effet cumulé sur une course est plafonné : bien choisir rapporte quelques places, pas une victoire depuis le fond de grille. Certains circuits ont leurs événements propres — le Raidillon à Spa, le Tire-Bouchon à Laguna Seca, le sable à Bahreïn."
    },
    UsurePneus: {
      title: "Usure des pneus", iconKey: "pneus", color: "#F59E0B",
      desc: "Elle dépend de ta gestion, du circuit et de ton style de pilotage.",
      details: "Plus tu attaques, plus la gomme part vite. Certains tracés sont réputés destructeurs de pneus. Ta statistique de gestion des pneus atténue l'usure. Même en karting, où aucun arrêt n'est possible, l'usure se paie en rythme dans les derniers tours."
    },

    /* --- hors piste --- */
    Messagerie: {
      title: "Messagerie", iconKey: "messages", color: "#60A5FA",
      desc: "Agent, écurie, sponsors, presse, famille et amis t'écrivent.",
      details: "Les messages arrivent selon ce que tu vis : résultats, offres, sollicitations médiatiques, soutien après une mauvaise passe. Certains proposent des choix qui influent sur ta réputation, ta confiance avec l'équipe ou ton mental. Les notifications n'apparaissent que sur l'accueil et sont mises en attente ailleurs, pour ne pas te déranger en pleine course."
    },
    Sponsors: {
      title: "Sponsors", iconKey: "msg_sponsor", color: "#A78BFA",
      desc: "Des partenaires te financent en échange de visibilité.",
      details: "Les offres arrivent quand ta réputation franchit certains paliers, et expirent après quelques semaines. Elles rapportent un revenu régulier et parfois des primes, mais engagent ton image : un partenariat rompu se paie en réputation."
    },
    Mental: {
      title: "Mental", iconKey: "mental", color: "#EC4899",
      desc: "Ta confiance et ta résistance à la pression, qui montent et descendent.",
      details: "Une victoire, un soutien de tes proches ou un objectif atteint le font grimper ; une série de contre-performances, un conflit avec l'équipe ou une pression excessive le font chuter. Un mental haut améliore tes chances dans les événements de course, un mental bas les dégrade."
    },

    /* --- progression --- */
    Talent: {
      title: "Talent et potentiel", iconKey: "star", color: "#FBBF24",
      desc: "Chaque sous-statistique a son propre plafond, propre à ton pilote.",
      details: "Tu ne progresses pas indéfiniment : chaque sous-statistique approche d'un plafond de talent qui t'est propre. Plus tu t'en rapproches, plus les gains ralentissent — un gain complet devient une fraction. L'âge joue aussi : montée, plateau, puis déclin, comme pour tes rivaux."
    },
    Entrainement: {
      title: "Entraînement", iconKey: "musculation", color: "#34D399",
      desc: "Le moyen principal de progresser entre deux courses, contre des Points d'Action.",
      details: "Chaque séance cible une famille de statistiques et coûte un Point d'Action. Le rendement dépend de ta marge par rapport à ton plafond de talent : travailler une qualité déjà proche de son maximum rapporte peu, développer un point faible rapporte beaucoup."
    }
  };

  /* --------------------------------------------------------- rubriques -- */
  var GROUPES = [
    { titre: "Ta carrière", couleur: "#34D399",
      cles: ["PA", "Contrat", "Negociation", "Agent", "Reputation", "Réputation", "Followers"] },
    { titre: "Ton pilote", couleur: "#FBBF24",
      cles: ["Vitesse", "Régularité", "Sangfroid", "Pneus", "Stratégie", "Physique", "Attaque", "Adaptation",
             "Talent", "Entrainement", "Mental"] },
    { titre: "Le week-end de course", couleur: "#00D4FF",
      cles: ["EssaisLibres", "Qualification", "Secteurs", "Strategie", "EvenementsCourse", "UsurePneus"] },
    { titre: "L'écurie et la voiture", couleur: "#A78BFA",
      cles: ["Confiance équipe", "NoteEcurie", "ProfilTechnique", "AffiniteCircuit", "Reglement"] },
    { titre: "Hors piste", couleur: "#EC4899",
      cles: ["Messagerie", "Sponsors"] }
  ];

  /* ------------------------------------------- filières et catégories --- */
  var FILIERE = [
    { nom: "Karting Junior", res: "14 tours · ~13 min", quali: "chrono libre", arrets: "aucun",
      note: "Le point de départ. Aucun arrêt, un pneu unique, tout se joue au pilotage." },
    { nom: "Karting Senior", res: "18 tours · ~16 min", quali: "chrono libre", arrets: "aucun",
      note: "Plus rapide et plus disputé. Dernière marche avant la monoplace." },
    { nom: "Formule 4", res: "15 tours · ~27 min", quali: "par groupes", arrets: "aucun",
      note: "Première monoplace. Courses courtes, pas d'arrêt : la régularité prime." },
    { nom: "Formula Regional", res: "19 tours · ~34 min", quali: "séance unique", arrets: "aucun",
      note: "Palier intermédiaire, voitures à appui plus marqué." },
    { nom: "Formule 3", res: "23 tours · ~35 min", quali: "séance unique", arrets: "aucun",
      note: "Plateaux denses, la qualification devient déterminante." },
    { nom: "Formule 2", res: "33 tours · ~51 min", quali: "séance unique", arrets: "1 à 2, deux gommes",
      note: "L'antichambre de la F1 : la stratégie d'arrêt entre en jeu." },
    { nom: "Formule 1", res: "57 tours · ~1 h 24", quali: "élimination Q1-Q2-Q3", arrets: "1 à 3, deux gommes",
      note: "Le sommet. Écuries au caractère technique marqué, affinités circuit décisives." }
  ];

  var ALTERNATIVES = [
    { nom: "Super Formula", res: "32 tours · ~47 min", quali: "deux phases", arrets: "1 obligatoire",
      note: "Le championnat japonais : monoplaces très rapides, plateau réduit et relevé." },
    { nom: "IndyCar", res: "85 tours · ~1 h 35", quali: "deux phases", arrets: "2 à 5, ravitaillement",
      note: "Mélange unique de circuits routiers, de tracés urbains et d'ovales." },
    { nom: "Endurance WEC", res: "60 tours et plus", quali: "séance unique", arrets: "3 à 6, ravitaillement",
      note: "Courses longues, relais et gestion. Une autre façon de courir." }
  ];

  function carteCategorie(c, couleur) {
    return '<div style="padding:10px 12px;border-radius:9px;background:var(--surface2);' +
      'border:1px solid var(--border);border-left:3px solid ' + couleur + ';margin-bottom:6px">' +
      '<div style="font-family:var(--font-display);font-size:12.5px;font-weight:800;color:#fff">' + c.nom + '</div>' +
      '<div style="font-size:11px;color:' + couleur + ';margin:3px 0 5px">' + c.res +
      ' · qualif ' + c.quali + ' · arrêts : ' + c.arrets + '</div>' +
      '<div style="font-size:11.5px;color:var(--text2);line-height:1.45">' + c.note + '</div></div>';
  }

  function vueFilieres() {
    var h = '<div style="font-size:12px;color:var(--text2);line-height:1.55;margin-bottom:12px">' +
      'Une carrière commence toujours en karting. Les résultats ouvrent la marche suivante — ' +
      'mais la Formule 1 n\'est pas le seul horizon : plusieurs championnats offrent une carrière ' +
      'complète, parfois plus accessible.</div>';

    h += '<div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:#34D399;' +
      'letter-spacing:.14em;text-transform:uppercase;margin:14px 0 8px">Filière classique</div>';
    FILIERE.forEach(function (c, i) {
      h += carteCategorie(c, "#34D399");
      if (i < FILIERE.length - 1) {
        h += '<div style="text-align:center;color:var(--text3);font-size:13px;line-height:1;margin:-2px 0 4px">↓</div>';
      }
    });

    h += '<div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:#00D4FF;' +
      'letter-spacing:.14em;text-transform:uppercase;margin:18px 0 8px">Voie alternative</div>' +
      '<div style="font-size:11.5px;color:var(--text2);line-height:1.5;margin-bottom:8px">' +
      'Accessibles depuis la Formule 3 ou la Formule 2, ces championnats sortent de la filière ' +
      'principale. On peut y faire toute sa carrière — et ils recrutent aussi ceux que la F1 n\'a pas retenus.</div>';
    ALTERNATIVES.forEach(function (c) { h += carteCategorie(c, "#00D4FF"); });

    h += '<div style="margin-top:14px;padding:11px 12px;border-radius:9px;' +
      'background:rgba(255,24,1,.07);border:1px solid rgba(255,24,1,.28)">' +
      '<div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:#FF1801;' +
      'letter-spacing:.12em;text-transform:uppercase;margin-bottom:4px">Monter d\'une catégorie</div>' +
      '<div style="font-size:11.5px;color:var(--text2);line-height:1.5">' +
      'La promotion se mérite en résultats et en réputation : un titre ou un vice-championnat ouvre ' +
      'presque toujours la porte, un bon classement peut suffire si une écurie te repère. ' +
      'Rester une saison de plus pour dominer vaut souvent mieux que monter trop tôt dans une voiture faible.' +
      '</div></div>';
    return h;
  }

  /* -------------------------------------------------------- rendu ------- */
  function fermer() {
    var o = document.getElementById("glossary-overlay");
    if (o && o.parentNode) o.parentNode.removeChild(o);
  }

  function ligneConcept(cle, def) {
    var col = def.color || "#22D3EE";
    var ic = "";
    try {
      if (def.iconKey && typeof renderIcon === "function") ic = renderIcon(def.iconKey, 18, col);
    } catch (e) {}
    return '<div onclick="_rj65Detail(\'' + cle.replace(/'/g, "\\'") + '\')" ' +
      'style="display:flex;align-items:center;gap:10px;padding:10px 11px;background:var(--surface2);' +
      'border:1px solid var(--border);border-left:3px solid ' + col + ';border-radius:0 9px 9px 0;' +
      'cursor:pointer;margin-bottom:5px">' +
      '<span style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;' +
      'border-radius:8px;background:' + col + '1A;border:1px solid ' + col + '40;color:' + col + ';flex-shrink:0">' + ic + '</span>' +
      '<div style="flex:1;min-width:0">' +
      '<div style="font-family:var(--font-display);font-size:12.5px;font-weight:800;color:#fff">' + def.title + '</div>' +
      '<div style="font-size:11px;color:var(--text2);line-height:1.4;overflow:hidden;display:-webkit-box;' +
      '-webkit-line-clamp:2;-webkit-box-orient:vertical">' + def.desc + '</div></div>' +
      '<span style="color:var(--text3);font-size:17px;flex-shrink:0">›</span></div>';
  }

  window._rj65Detail = function (cle) {
    try {
      fermer();
      setTimeout(function () {
        if (typeof showConceptTooltip === "function") showConceptTooltip(cle);
      }, 140);
    } catch (e) {}
  };

  window._rj65Onglet = function (id) {
    var corps = document.getElementById("rj65-corps");
    if (!corps) return;
    document.querySelectorAll("[data-rj65-tab]").forEach(function (b) {
      var on = b.getAttribute("data-rj65-tab") === id;
      b.style.color = on ? "#22D3EE" : "var(--text3)";
      b.style.borderBottomColor = on ? "#22D3EE" : "transparent";
    });
    if (id === "filieres") { corps.innerHTML = vueFilieres(); return; }
    var h = "";
    GROUPES.forEach(function (g) {
      var lignes = "";
      g.cles.forEach(function (k) {
        if (typeof CONCEPT_DEFS !== "undefined" && CONCEPT_DEFS[k]) lignes += ligneConcept(k, CONCEPT_DEFS[k]);
      });
      if (!lignes) return;
      h += '<div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:' + g.couleur + ';' +
        'letter-spacing:.14em;text-transform:uppercase;margin:14px 0 7px">' + g.titre + '</div>' + lignes;
    });
    corps.innerHTML = h;
  };

  function ouvrir() {
    fermer();
    var ov = document.createElement("div");
    ov.id = "glossary-overlay";
    ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9996;display:flex;" +
      "align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px)";
    var ic = "";
    try { if (typeof renderIcon === "function") ic = renderIcon("diplome", 18, "#22D3EE"); } catch (e) {}
    ov.innerHTML =
      '<div style="background:linear-gradient(180deg,var(--bg3) 0%,var(--bg2) 100%);border:1px solid var(--border-hi);' +
      'border-radius:16px;max-width:430px;width:100%;max-height:86vh;display:flex;flex-direction:column;overflow:hidden">' +
        '<div style="padding:16px 16px 0">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">' +
            '<div style="display:flex;align-items:center;gap:10px">' +
              '<span style="display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;' +
              'border-radius:9px;background:rgba(34,211,238,.12);border:1px solid rgba(34,211,238,.30)">' + ic + '</span>' +
              '<div><div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:#22D3EE;' +
              'letter-spacing:.18em;text-transform:uppercase">Référence</div>' +
              '<div style="font-family:var(--font-display);font-size:17px;font-weight:900;color:#fff">Manuel du pilote</div></div>' +
            '</div>' +
            '<button type="button" onclick="_rj65Fermer()" style="background:none;border:none;color:var(--text3);' +
            'font-size:22px;cursor:pointer;width:30px;height:30px">×</button>' +
          '</div>' +
          '<div style="display:flex;gap:14px;border-bottom:1px solid var(--border)">' +
            '<button type="button" data-rj65-tab="concepts" onclick="_rj65Onglet(\'concepts\')" ' +
            'style="background:none;border:none;border-bottom:2px solid #22D3EE;color:#22D3EE;cursor:pointer;' +
            'padding:8px 2px;font-family:var(--font-display);font-size:11px;font-weight:800;letter-spacing:.08em;' +
            'text-transform:uppercase">Mécanismes</button>' +
            '<button type="button" data-rj65-tab="filieres" onclick="_rj65Onglet(\'filieres\')" ' +
            'style="background:none;border:none;border-bottom:2px solid transparent;color:var(--text3);cursor:pointer;' +
            'padding:8px 2px;font-family:var(--font-display);font-size:11px;font-weight:800;letter-spacing:.08em;' +
            'text-transform:uppercase">Catégories</button>' +
          '</div>' +
        '</div>' +
        '<div id="rj65-corps" style="padding:4px 14px 18px;overflow-y:auto;flex:1"></div>' +
      '</div>';
    ov.addEventListener("click", function (e) { if (e.target === ov) fermer(); });
    document.body.appendChild(ov);
    window._rj65Onglet("concepts");
  }

  window._rj65Fermer = fermer;

  /* ------------------------------------------------------------ montage - */
  function installer() {
    if (typeof CONCEPT_DEFS === "undefined" || !CONCEPT_DEFS) return false;
    Object.keys(AJOUTS).forEach(function (k) {
      if (!CONCEPT_DEFS[k]) CONCEPT_DEFS[k] = AJOUTS[k];
    });
    if (typeof window.showGlossary === "function" && !window.showGlossary._rj65) {
      wrapped.showGlossary = window.showGlossary;
      var fn = function () { try { ouvrir(); } catch (e) { return wrapped.showGlossary.apply(this, arguments); } };
      fn._rj65 = true;
      window.showGlossary = fn;
    }
    return true;
  }

  var essais = 0;
  function boot() {
    try {
      if (installer()) {
        etat.installe = true;
        console.log("[65-manual] manuel refondu — " + Object.keys(CONCEPT_DEFS).length +
                    " entrées, " + GROUPES.length + " rubriques + filières");
        return;
      }
    } catch (e) { etat.erreur = String(e && e.message || e); }
    if (essais++ < 80) setTimeout(boot, 80);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj65Uninstall = function () {
    Object.keys(wrapped).forEach(function (k) { window[k] = wrapped[k]; });
    console.log("[65-manual] désinstallé");
  };
})();
