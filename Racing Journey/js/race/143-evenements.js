/* =====================================================================
 * 143-evenements.js — ÉVÉNEMENTS DE COURSE : VARIÉTÉ, LISIBILITÉ, EFFETS
 *
 * POURQUOI (audit des événements, v278)
 * Sur 40 courses (4 par catégorie), le joueur voyait 1 à 5 événements, presque
 * toujours les mêmes : départ, « Duel avec … », « Derniers tours », « Dernier
 * tour — … à portée ». Les événements propres à une discipline (OTS, ovale,
 * nuit, relais) sortaient rarement, et rien n'empêchait de rejouer la même
 * scène d'une course à l'autre. Les choix prudents ne changeaient rien, et la
 * fenêtre d'événement ne disait ni le risque ni l'effet d'un choix.
 *
 * CE QUE FAIT LE MODULE
 * 1. Une banque d'une quarantaine d'événements par discipline (karting,
 *    F4/Regional, F3/F2, F1, Super Formula, WEC, IndyCar), selon la météo,
 *    le type de circuit, la position et la phase de course.
 * 2. Le calendrier de chaque course (buildLiveEventSchedule) : un seul duel,
 *    une seule scène de fin, puis des événements de la banque jusqu'à 3 à 6
 *    par course selon sa longueur, en écartant ceux des dernières courses
 *    (mémoire sauvegardée, RJ_SAVE_HOOKS « rj143 »).
 * 3. La fenêtre d'événement en piste (showLiveEvent) : choix côte à côte,
 *    risque en clair (« Sans risque », « 74 % de réussite », « Abandon si
 *    raté ») et effet attendu en secondes ; puis un résultat lisible
 *    (« Réussi · tu gagnes ≈ 0,8 s sur 2 tours »).
 *
 * Format d'un événement : celui du moteur (04) — { icon, color, title, desc,
 * choices: [{ text, mod, chance: { fail, failMod, msg, dnf, penalty } }] }.
 * mod ≈ 0,01 par 0,9 s gagnée (conversion de 04, _convertLegacyMod).
 *
 * Réversible : window._rj143Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[143-evenements]";
  var MEMOIRE = 24;          // identifiants retenus (≈ les 6 dernières courses)

  function LR() { return window.LIVE_RACE || null; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function auHasard(L) { return L[Math.floor(Math.random() * L.length)]; }
  function nom(d) { return d ? esc(String(d.name || "").split(" ").pop()) : ""; }

  /* ------------------------------------------------------------------
   * Contexte de course
   * ---------------------------------------------------------------- */
  function famille(cat) {
    if (/Karting/.test(cat)) return "kart";
    if (cat === "Formule 4" || cat === "Formula Regional") return "f4";
    if (cat === "Formule 3" || cat === "Formule 2") return "f3";
    if (cat === "Formule 1") return "f1";
    if (cat === "Super Formula") return "sf";
    if (cat === "Endurance WEC") return "wec";
    if (cat === "IndyCar") return "indy";
    return "f3";
  }

  function contexte() {
    var lr = LR(), cat = (window.G && G.cat) || "";
    var rs = window.RACE_STATE || {}, cd = rs.circuitData || {}, w = rs.weather || {};
    var L = lr && lr.drivers ? lr.drivers.filter(function (d) { return !d.dnf && !d._mc; }).sort(function (a, b) { return a.pos - b.pos; }) : [];
    var i = L.findIndex(function (d) { return d.isPlayer; });
    var p = i >= 0 ? L[i] : null;
    var ovale = false;
    try { ovale = typeof _isOvalRace === "function" && _isOvalRace(); } catch (e) { }
    return {
      cat: cat, fam: famille(cat), lr: lr, p: p, pos: p ? p.pos : 99, plateau: L.length,
      devant: i > 0 ? L[i - 1] : null, derriere: i >= 0 && i < L.length - 1 ? L[i + 1] : null,
      equipier: p ? L.filter(function (d) { return !d.isPlayer && d.team && d.team === p.team; })[0] || null : null,
      pluie: w.id === "wet" || w.id === "storm", chaud: w.id === "hot", sec: w.id === "dry" || w.id === "hot",
      rue: cd.type === "street", rapide: cd.type === "highspeed", technique: cd.type === "technical",
      nuit: !!cd.nightRace, ovale: ovale, part: lr && lr.total ? lr.cur / lr.total : 0
    };
  }

  /* ------------------------------------------------------------------
   * Choix types. mod > 0 : du temps gagné ; chance.failMod : ce que coûte
   * l'échec. L'espérance d'un choix osé doit dépasser celle du choix sûr,
   * sinon ce n'est pas un choix.
   * ---------------------------------------------------------------- */
  function sur(text, mod) { return { text: text, mod: mod == null ? 0.008 : mod }; }
  function cout(text, mod) { return { text: text, mod: mod == null ? -0.005 : mod }; }       // on lâche un peu, à coup sûr
  function ose(text, msg, fail) { return { text: text, mod: 0.035, chance: { fail: fail == null ? 0.3 : fail, failMod: -0.065, msg: msg } }; }
  function moyen(text, msg) { return { text: text, mod: 0.02, chance: { fail: 0.2, failMod: -0.04, msg: msg } }; }
  function penal(text, msg, sec) { return { text: text, mod: 0.028, chance: { fail: 0.25, failMod: -0.01, penalty: sec || 5, msg: msg } }; }
  function fatal(text, msg, fail) { return { text: text, mod: 0.045, chance: { fail: fail || 0.12, failMod: -0.35, dnf: true, msg: msg } }; }

  function ev(couleur, title, desc, choices) { return { icon: "flag", color: couleur, title: title, desc: desc, choices: choices }; }
  var JAUNE = "#F59E0B", ROUGE = "#EF4444", BLEU = "#60A5FA", VERT = "#34D399", VIOLET = "#A78BFA";

  /* ------------------------------------------------------------------
   * La banque. fam : disciplines (absent = toutes). quand : fenêtre de la
   * course (part 0 → 1). si(c) : condition. gen(c) : l'événement.
   * ---------------------------------------------------------------- */
  var BANQUE = [
    // --- Toutes disciplines --------------------------------------------------
    { id: "debris", quand: [0.15, 0.85], si: function (c) { return !c.ovale; }, gen: function () {
      return ev(JAUNE, "Débris sur la trajectoire", "Un morceau d'aileron traîne à la corde du virage 4. Les commissaires ne sont pas encore intervenus.", [
        cout("Passer large, quitte à perdre du temps"),
        sur("Suivre exactement la trajectoire de la voiture devant", 0.004),
        fatal("Garder la corde et rouler dessus", "Crevaison lente : le pneu se dégonfle, course terminée.", 0.1)
      ]); } },
    { id: "visiere", fam: ["kart", "f4", "f3", "f1", "sf", "indy"], quand: [0.2, 0.8], gen: function () {
      return ev(BLEU, "Visière couverte de gomme", "Des billes de caoutchouc et la poussière brouillent ta vue au freinage.", [
        sur("Arracher un tear-off dans la ligne droite", 0.01),
        moyen("Attendre la fin du secteur, rester dans le rythme", "Freinage manqué à cause de la visière : tu passes tout droit.")
      ]); } },
    { id: "pickup", fam: ["f4", "f3", "f1", "sf", "indy", "wec"], quand: [0.3, 0.8], gen: function (c) {
      return ev(JAUNE, "Pneus chargés de gomme", "Tu as roulé hors trajectoire" + (c.devant ? " en suivant " + nom(c.devant) : "") + " : les pneus ont ramassé des billes de caoutchouc, l'adhérence chute.", [
        sur("Zigzaguer dans la ligne droite pour les nettoyer", 0.006),
        moyen("Ignorer et pousser, elles partiront toutes seules", "Les pneus ne se nettoient pas : deux tours à glisser.")
      ]); } },
    { id: "huile", quand: [0.2, 0.75], si: function (c) { return !c.pluie; }, gen: function () {
      return ev(ROUGE, "Huile en piste", "Une voiture a perdu de l'huile entre les virages 7 et 9. Drapeau à bandes jaunes et rouges.", [
        cout("Lever franchement le pied dans la zone", -0.003),
        moyen("Chercher une ligne propre, à l'extérieur", "Tu touches la tache d'huile : tête-à-queue évité de justesse."),
        fatal("Ne rien changer", "La voiture part dans l'huile : sortie de piste, abandon.", 0.15)
      ]); } },
    { id: "erreur-devant", quand: [0.2, 0.9], si: function (c) { return !!c.devant; }, gen: function (c) {
      return ev(VERT, nom(c.devant) + " commet une erreur", nom(c.devant) + " a bloqué ses roues et sort large. La porte est ouverte… pour une seconde.", [
        ose("Plonger tout de suite à l'intérieur", "Il revient sur la trajectoire au même moment : contact léger, tu perds l'élan.", 0.25),
        sur("Rester derrière et profiter de sa sortie ratée", 0.012)
      ]); } },
    { id: "freins", fam: ["f4", "f3", "f1", "sf", "wec", "indy"], quand: [0.25, 0.8], si: function (c) { return !c.ovale && !!c.devant; }, gen: function (c) {
      return ev(ROUGE, "Freins en surchauffe", "Collé à " + nom(c.devant) + ", tu n'as plus d'air frais : les disques avant dépassent les 1 000 °C.", [
        cout("Laisser un trou d'une seconde pour refroidir", -0.004),
        moyen("Décaler la voiture dans les lignes droites", "Pas assez : les freins s'affaiblissent sur trois tours."),
        fatal("Rester collé coûte que coûte", "Le disque casse au freinage : abandon.", 0.1)
      ]); } },
    { id: "radio-hs", fam: ["f3", "f1", "sf", "wec", "indy"], quand: [0.25, 0.7], gen: function () {
      return ev(BLEU, "Radio coupée", "Plus aucune liaison avec le muret depuis deux tours. Tu ne sais plus où sont les autres ni quelle stratégie tenir.", [
        sur("Rouler au rythme prévu, sans rien changer", 0.006),
        moyen("Lire le panneau des stands et adapter ton rythme", "Mauvaise lecture du panneau : tu ralentis pour rien.")
      ]); } },
    { id: "attarde", quand: [0.35, 0.85], si: function (c) { return c.pos <= Math.ceil(c.plateau / 2) && !c.ovale; }, gen: function () {
      return ev(BLEU, "Un attardé ne se range pas", "Malgré les drapeaux bleus, la voiture que tu prends un tour reste sur la trajectoire.", [
        sur("Attendre la ligne droite pour passer proprement", 0.004),
        ose("Le passer par l'extérieur dans le virage", "Il ne te voit pas et resserre : tu dois freiner, le temps est perdu.", 0.3)
      ]); } },
    { id: "bleus", quand: [0.4, 0.9], si: function (c) { return c.pos > Math.ceil(c.plateau * 0.6); }, gen: function () {
      return ev(BLEU, "Drapeaux bleus", "Les leaders arrivent pour te prendre un tour. Il faut les laisser passer sans perdre ta propre bagarre.", [
        sur("Te ranger tout de suite, proprement", 0.005),
        penal("Attendre la ligne droite, au risque d'ignorer le drapeau", "Trois drapeaux bleus ignorés : 5 s de pénalité.", 5)
      ]); } },
    { id: "rupture", fam: ["f3", "f1", "sf", "wec", "indy"], quand: [0.3, 0.7], si: function (c) { return !!c.devant || !!c.derriere; }, gen: function () {
      return ev(VIOLET, "Le muret donne le rythme", "« On est à la limite de la fenêtre. Il nous faut trois dixièmes par tour pendant cinq tours. »", [
        ose("Mode qualif pendant cinq tours", "Trop d'usure : les pneus lâchent avant la fin de l'effort.", 0.3),
        moyen("Accélérer progressivement", "L'écart ne bouge pas : effort pour rien."),
        sur("Répondre que les pneus ne le permettent pas", 0.004)
      ]); } },
    { id: "boite", fam: ["f3", "f1", "sf", "wec"], quand: [0.3, 0.85], gen: function () {
      return ev(ROUGE, "Boîte de vitesses capricieuse", "Le 4e rapport saute de temps en temps. L'ingénieur voit la température de l'huile de boîte monter.", [
        sur("Sauter le 4e : passer du 3e au 5e", 0.003),
        cout("Passer les rapports en douceur, sans forcer", -0.004),
        fatal("Ignorer et attaquer", "La boîte casse : abandon.", 0.14)
      ]); } },
    { id: "equipier", fam: ["f3", "f1", "sf", "indy"], quand: [0.3, 0.85], si: function (c) { return !!c.equipier && Math.abs(c.equipier.pos - c.pos) === 1; }, gen: function (c) {
      var devant = c.equipier.pos < c.pos;
      return devant
        ? ev(VIOLET, "Ton équipier te bloque", nom(c.equipier) + ", juste devant, est plus lent que toi. Le muret hésite à donner une consigne.", [
            sur("Demander poliment de passer", 0.01),
            ose("L'attaquer sans attendre", "L'équipe n'apprécie pas : vous vous gênez et perdez du temps tous les deux.", 0.3)
          ])
        : ev(VIOLET, "Consigne d'équipe", nom(c.equipier) + " est plus rapide derrière toi. « Laisse-le passer au prochain virage. »", [
            cout("Obéir et le laisser passer", -0.008),
            penal("Refuser : c'est ta course", "Le muret insiste, tu perds ton rythme à discuter.", 0)
          ]); } },
    { id: "chaleur", quand: [0.4, 0.85], si: function (c) { return c.chaud && c.fam !== "kart"; }, gen: function () {
      return ev(ROUGE, "Chaleur : déshydratation", "Il fait plus de 50 °C dans le cockpit et ta gourde est vide. Tes temps commencent à baisser.", [
        sur("Respirer, rouler à 95 % et garder les yeux ouverts", 0.004),
        ose("Serrer les dents et tenir le rythme", "La fatigue gagne : deux erreurs coûteuses.", 0.35)
      ]); } },
    { id: "pression-pneus", quand: [0.35, 0.8], si: function (c) { return c.chaud || c.rapide; }, gen: function () {
      return ev(JAUNE, "Pressions des pneus en hausse", "L'ingénieur voit les pressions arrière monter : les pneus surchauffent dans les virages rapides.", [
        sur("Soulager l'arrière en sortie de virage", 0.007),
        moyen("Garder le rythme et surveiller", "Les pneus arrière décrochent : tu glisses pendant plusieurs tours.")
      ]); } },
    { id: "soleil", quand: [0.1, 0.6], si: function (c) { return c.sec && !c.nuit; }, gen: function () {
      return ev(JAUNE, "Soleil rasant", "Le soleil bas t'aveugle à l'entrée du virage 1. Impossible de voir le point de corde.", [
        sur("Prendre des repères sur les panneaux de distance", 0.008),
        moyen("Freiner au même endroit qu'avant", "Tu rates le point de freinage : tout droit dans le dégagement.")
      ]); } },
    // --- Pluie ---------------------------------------------------------------
    { id: "aquaplaning", quand: [0.15, 0.85], si: function (c) { return c.pluie; }, gen: function () {
      return ev(BLEU, "Aquaplaning", "Une rivière traverse la ligne droite principale. La voiture flotte à chaque passage.", [
        cout("Lever le pied dans la flaque", -0.003),
        sur("Décaler d'un mètre, là où l'eau est moins profonde", 0.006),
        fatal("Rester à fond", "Aquaplaning : la voiture part en tête-à-queue dans le mur.", 0.15)
      ]); } },
    { id: "ligne-seche", quand: [0.3, 0.9], si: function (c) { return c.pluie; }, gen: function () {
      return ev(VERT, "Une ligne sèche apparaît", "La trajectoire sèche par endroits. Les pneus pluie surchauffent dessus, mais elle est plus rapide.", [
        ose("Rouler sur la partie sèche", "Les pneus pluie se détruisent sur le sec : tu perds tout ce que tu as gagné.", 0.3),
        sur("Chercher l'eau dans les lignes droites pour refroidir les pneus", 0.01)
      ]); } },
    { id: "gerbes", quand: [0.1, 0.7], si: function (c) { return c.pluie && !!c.devant; }, gen: function (c) {
      return ev(BLEU, "Visibilité nulle", "Dans les gerbes d'eau de " + nom(c.devant) + ", tu ne vois plus rien au-delà de son feu arrière.", [
        sur("Décaler la voiture pour sortir des gerbes", 0.008),
        fatal("Rester dans son sillage et viser le dépassement", "Il freine plus tôt que prévu : collision.", 0.12)
      ]); } },
    // --- Circuits urbains -----------------------------------------------------
    { id: "mur", quand: [0.2, 0.85], si: function (c) { return c.rue; }, gen: function () {
      return ev(ROUGE, "Le mur t'embrasse", "Tu frôles le mur en sortie du virage 11. Un bruit sec, la direction tire légèrement à gauche.", [
        cout("Lever le pied deux tours pour tester la voiture", -0.006),
        moyen("Continuer, la voiture semble tenir", "Le parallélisme est faussé : tu perds du temps à chaque virage."),
        fatal("Ignorer et attaquer", "La suspension casse au tour suivant : abandon.", 0.12)
      ]); } },
    { id: "bosses", quand: [0.2, 0.8], si: function (c) { return c.rue; }, gen: function () {
      return ev(JAUNE, "Bosses au freinage", "La voiture rebondit sur les plaques d'égout au freinage du virage 3. Les roues se bloquent.", [
        sur("Freiner plus tôt et plus doucement", 0.006),
        ose("Freiner tard en évitant les plaques", "Blocage de roue : méplat sur le pneu avant.", 0.3)
      ]); } },
    // --- Karting --------------------------------------------------------------
    { id: "kart-carbu", fam: ["kart"], quand: [0.2, 0.7], gen: function () {
      return ev(JAUNE, "Carburation", "Le moteur bafouille en haut des tours. Le mécano te fait signe de toucher au pointeau.", [
        sur("Enrichir d'un quart de tour : plus sûr", 0.004),
        ose("Appauvrir pour plus de puissance", "Trop pauvre : le moteur serre, tu perds deux secondes.", 0.3)
      ]); } },
    { id: "kart-spoiler", fam: ["kart"], quand: [0.2, 0.85], si: function (c) { return !!c.devant; }, gen: function (c) {
      return ev(ROUGE, "Contact pare-chocs", "Tu as poussé " + nom(c.devant) + " au freinage : ton carénage avant s'est décroché. En karting, c'est une pénalité automatique.", [
        sur("Lever le pied pour ne pas aggraver", 0.002),
        penal("Continuer, ça passera peut-être", "Carénage décroché à l'arrivée : 5 s de pénalité.", 5)
      ]); } },
    { id: "kart-chaine", fam: ["kart"], quand: [0.3, 0.85], gen: function () {
      return ev(ROUGE, "Chaîne qui claque", "Un bruit métallique à chaque accélération : la chaîne est détendue.", [
        cout("Accélérer en douceur jusqu'au drapeau", -0.006),
        fatal("Rien changer", "La chaîne saute : abandon.", 0.18)
      ]); } },
    { id: "kart-train", fam: ["kart"], quand: [0.15, 0.7], si: function (c) { return !!c.devant && !!c.derriere; }, gen: function (c) {
      return ev(VIOLET, "Petit train à trois", "Toi, " + nom(c.devant) + " et " + nom(c.derriere) + " roulez roue dans roue. Le premier qui sort de l'aspiration perd.", [
        sur("Rester dans le train et attendre la fin de course", 0.006),
        ose("Sortir de l'aspiration au bout de la ligne droite", "Tu te fais passer des deux côtés.", 0.35)
      ]); } },
    { id: "kart-pression", fam: ["kart"], quand: [0.4, 0.85], gen: function () {
      return ev(JAUNE, "Pneus qui glissent", "Les pneus ont trop chauffé : le kart glisse de l'arrière en sortie d'épingle.", [
        sur("Arrondir les trajectoires", 0.006),
        moyen("Garder les trajectoires en V", "L'arrière décroche, tu perds du temps à chaque épingle.")
      ]); } },
    // --- F4 / Regional --------------------------------------------------------
    { id: "f4-retro", fam: ["f4"], quand: [0.2, 0.7], si: function (c) { return !!c.derriere; }, gen: function (c) {
      return ev(VIOLET, "Débutant agressif", nom(c.derriere) + " tente des plongées impossibles depuis trois tours. Il finira par te sortir.", [
        sur("Le laisser s'épuiser derrière en défendant l'intérieur", 0.008),
        cout("Le laisser passer, il sortira tout seul", -0.008),
        ose("Fermer la porte au dernier moment", "Il ne lève pas le pied : contact, tu perds ton aileron avant.", 0.3)
      ]); } },
    { id: "f4-freins-froids", fam: ["f4", "f3"], quand: [0.05, 0.35], gen: function () {
      return ev(JAUNE, "Freins encore froids", "Les freins carbone n'ont pas atteint leur température. Le premier gros freinage est piégeux.", [
        sur("Freiner tôt pendant deux tours", 0.005),
        ose("Freiner comme d'habitude", "Blocage des roues avant : méplat et tout droit.", 0.3)
      ]); } },
    // --- F3 / F2 --------------------------------------------------------------
    { id: "f3-aileron", fam: ["f3", "f4"], quand: [0.15, 0.75], gen: function () {
      return ev(ROUGE, "Aileron avant abîmé", "Un contact léger a plié l'extrémité de ton aileron avant. Sous-virage dans les virages rapides.", [
        cout("Adapter le pilotage et vivre avec", -0.004),
        moyen("Compenser avec l'équilibre de freins", "Mauvais réglage : la voiture devient instable."),
        fatal("Attaquer comme avant", "L'aileron se détache : il part sous la voiture, abandon.", 0.1)
      ]); } },
    { id: "f2-depart-pneus", fam: ["f3"], quand: [0.55, 0.9], gen: function () {
      return ev(JAUNE, "Pneus tendres en fin de vie", "Les Pirelli tendres plongent : tu perds une demi-seconde par tour sur les voitures en durs.", [
        sur("Gérer jusqu'au drapeau", 0.006),
        moyen("Attaquer tant qu'il reste du grip", "Les pneus s'effondrent : tu perds plusieurs places.")
      ]); } },
    // --- F1 -------------------------------------------------------------------
    { id: "f1-ers", fam: ["f1"], quand: [0.3, 0.9], si: function (c) { return !!c.devant || !!c.derriere; }, gen: function () {
      return ev(VIOLET, "Batterie à 40 %", "L'ingénieur : « On peut déployer maintenant ou garder pour les cinq derniers tours. »", [
        moyen("Tout déployer maintenant", "La batterie est vide quand il faut défendre : tu perds ce que tu as gagné."),
        sur("Garder la charge pour la fin", 0.009),
        ose("Mode overtake trois tours d'affilée", "Le moteur passe en mode protection : tu perds de la puissance.", 0.3)
      ]); } },
    { id: "f1-moteur", fam: ["f1"], quand: [0.2, 0.8], gen: function () {
      return ev(ROUGE, "Températures moteur", "Le moteur chauffe dans le sillage des autres. « Passe en mode 7, on le sauve pour la course suivante. »", [
        cout("Passer en mode 7 comme demandé", -0.006),
        moyen("Garder le mode 5 et chercher de l'air propre", "Le moteur bride lui-même sa puissance."),
        fatal("Rester en mode 2", "Le moteur casse dans un nuage de fumée : abandon.", 0.1)
      ]); } },
    { id: "f1-meplat", fam: ["f1", "f3", "sf"], quand: [0.15, 0.8], gen: function () {
      return ev(JAUNE, "Méplat", "Tu as bloqué la roue avant droite : un méplat fait vibrer toute la voiture au freinage.", [
        sur("Rouler avec, en freinant plus tôt", 0.004),
        moyen("Tenir le rythme malgré les vibrations", "La vibration abîme la suspension : tu perds du temps.")
      ]); } },
    { id: "f1-vent", fam: ["f1", "f3", "sf", "f4"], quand: [0.2, 0.8], si: function (c) { return c.rapide || c.sec; }, gen: function () {
      return ev(BLEU, "Rafale de vent", "Le vent a tourné : il pousse dans le dos au freinage du virage 1, la voiture devient nerveuse.", [
        sur("Freiner cinq mètres plus tôt", 0.006),
        ose("Garder tes repères", "Rafale au mauvais moment : tout droit.", 0.3)
      ]); } },
    // --- Super Formula --------------------------------------------------------
    { id: "sf-ots", fam: ["sf"], quand: [0.4, 0.9], gen: function () {
      return ev(VIOLET, "Réserve d'OTS", "Il te reste 60 secondes de surpuissance. Le minuteur s'affiche sur ton volant… et sur celui des autres.", [
        moyen("En brûler la moitié maintenant", "Ton rival répond avec son OTS : effort perdu."),
        sur("Tout garder pour les deux derniers tours", 0.009)
      ]); } },
    { id: "sf-pneus", fam: ["sf"], quand: [0.2, 0.6], gen: function () {
      return ev(JAUNE, "Pneus Yokohama trop chauds", "Les gommes Yokohama n'aiment pas la surchauffe : le grip baisse tour après tour.", [
        sur("Rouler dans l'air propre pour les refroidir", 0.007),
        moyen("Rester dans le paquet", "Les pneus surchauffent, tu perds une demi-seconde par tour.")
      ]); } },
    // --- WEC ------------------------------------------------------------------
    { id: "wec-hypercar", fam: ["wec"], quand: [0.1, 0.9], gen: function () {
      return ev(BLEU, "Une Hypercar arrive", "Une Hypercar beaucoup plus rapide arrive au freinage pendant que tu doubles une GT. Trois voitures pour deux places.", [
        sur("Laisser passer l'Hypercar, puis doubler la GT", 0.006),
        ose("Doubler la GT avant elle", "L'Hypercar plonge aussi : tu es pris en sandwich.", 0.3)
      ]); } },
    { id: "wec-fcy", fam: ["wec"], quand: [0.2, 0.8], gen: function () {
      return ev(JAUNE, "Full Course Yellow", "Tout le circuit sous drapeau jaune : 80 km/h imposés. Le moment de ralentir compte au centième.", [
        sur("Ralentir pile au signal", 0.006),
        penal("Ralentir un peu plus tard", "Délégués sévères : excès de vitesse sous FCY, 5 s.", 5)
      ]); } },
    { id: "wec-relais", fam: ["wec"], quand: [0.35, 0.75], gen: function () {
      return ev(VIOLET, "Double relais ?", "Ton équipier est épuisé. Le muret te demande d'enchaîner un deuxième relais.", [
        sur("Accepter et gérer ton effort", 0.008),
        cout("Refuser : la fatigue coûterait plus cher", -0.004),
        ose("Accepter en gardant le rythme qualif", "La fatigue te rattrape : erreurs en fin de relais.", 0.35)
      ]); } },
    { id: "wec-nuit", fam: ["wec"], quand: [0.4, 0.8], si: function (c) { return c.nuit; }, gen: function () {
      return ev(BLEU, "Phares en panne", "Un des phares a lâché : tu ne vois plus le point de corde à gauche.", [
        cout("Ralentir dans les gauches", -0.006),
        moyen("Suivre les feux arrière d'une GT", "Tu suis la GT trop loin : grosse perte de temps.")
      ]); } },
    { id: "wec-conso", fam: ["wec"], quand: [0.3, 0.7], gen: function () {
      return ev(JAUNE, "Objectif de consommation", "Le muret veut un tour de plus sur ce relais. Il faut économiser 3 % d'essence.", [
        sur("Lever et rouler en roue libre avant les freinages", 0.006),
        moyen("Ignorer et pousser", "Arrêt plus tôt que prévu : tu perds une place au relais.")
      ]); } },
    // --- IndyCar ---------------------------------------------------------------
    { id: "indy-haut", fam: ["indy"], quand: [0.2, 0.8], si: function (c) { return c.ovale; }, gen: function () {
      return ev(VIOLET, "Ligne haute ou ligne basse ?", "Sur l'ovale, la ligne basse est rapide mais embouteillée ; la haute est libre mais pleine de gomme.", [
        sur("Rester en bas, dans l'aspiration", 0.007),
        ose("Monter en haut pour passer deux voitures", "La gomme te fait glisser vers le mur : tu perds l'élan.", 0.3)
      ]); } },
    { id: "indy-p2p", fam: ["indy"], quand: [0.3, 0.9], si: function (c) { return !c.ovale; }, gen: function () {
      return ev(VIOLET, "Push-to-pass", "Il te reste 80 secondes de push-to-pass. Ton rival en a gardé davantage.", [
        moyen("En utiliser une partie pour l'attaquer", "Il répond avec le sien : rien de gagné."),
        sur("Garder tout pour défendre", 0.008)
      ]); } },
    { id: "indy-mur", fam: ["indy"], quand: [0.3, 0.85], si: function (c) { return c.ovale; }, gen: function () {
      return ev(ROUGE, "Vent de travers dans le virage 3", "Une rafale fait glisser l'arrière au plus près du mur.", [
        cout("Lever légèrement en entrée", -0.004),
        fatal("Garder le pied au plancher", "L'arrière décroche : la voiture tape le mur, abandon.", 0.12)
      ]); } }
  ];

  /* ------------------------------------------------------------------
   * Mémoire des événements vus (sauvegardée)
   * ---------------------------------------------------------------- */
  function vus() { return (window.G && Array.isArray(G._rj143Vus)) ? G._rj143Vus : []; }
  function noter(id) {
    if (!window.G) return;
    var L = vus().filter(function (x) { return x !== id; });
    L.push(id);
    G._rj143Vus = L.slice(-MEMOIRE);
  }

  /* ------------------------------------------------------------------
   * Calendrier d'une course
   * ---------------------------------------------------------------- */
  var FIN = /Sprint final|Dernière chance|Podium|Championnat/i;
  var DUEL = /Rivalité|Duel|Bagarre/i;

  /* 107 peut jouer « Derniers tours » jusqu'à quatre tours de l'arrivée, avant la
     scène de fin du calendrier : celle-ci s'efface alors. */
  var FIN_JOUEE = /Dernier tour|Derniers tours|Fin de course/i;
  function sauterSiFinJouee(s) {
    var gen = s.gen;
    s.gen = function () {
      var lr = LR();
      if (lr && (lr.resolvedEvents || []).some(function (e) { return e && FIN_JOUEE.test(String(e.title || "")); })) return null;
      return gen.apply(this, arguments);
    };
  }

  function cible(total) {
    if (total <= 16) return 3;
    if (total <= 30) return 4 + (Math.random() < 0.5 ? 1 : 0);
    return 5 + (Math.random() < 0.5 ? 1 : 0);
  }

  function enrichir(sched, total) {
    if (!Array.isArray(sched) || !total) return sched;
    // un seul duel et une seule scène de fin par course
    var vuFin = false, vuDuel = false;
    var garde = sched.filter(function (s) {
      var ph = String(s && s.phase || "");
      if (FIN.test(ph)) { if (vuFin) return false; vuFin = true; sauterSiFinJouee(s); }
      if (DUEL.test(ph)) { if (vuDuel) return false; vuDuel = true; }
      return true;
    });
    var cat = (window.G && G.cat) || "", fam = famille(cat), recents = vus();
    var candidats = BANQUE.filter(function (d) { return !d.fam || d.fam.indexOf(fam) >= 0; });
    // les jamais vus récemment d'abord, puis le reste, chacun dans un ordre aléatoire
    var neufs = candidats.filter(function (d) { return recents.indexOf(d.id) < 0; });
    var anciens = candidats.filter(function (d) { return recents.indexOf(d.id) >= 0; });
    var melange = function (L) { return L.map(function (x) { return [Math.random(), x]; }).sort(function (a, b) { return a[0] - b[0]; }).map(function (x) { return x[1]; }); };
    var ordre = melange(neufs).concat(melange(anciens));
    var n = cible(total), ecart = Math.max(2, Math.round(total * 0.08));
    var tours = garde.map(function (s) { return s.lap; });
    for (var k = 0; k < ordre.length && garde.length < n; k++) {
      var d = ordre[k], q = d.quand || [0.15, 0.85];
      var lap = Math.round(total * (q[0] + Math.random() * (q[1] - q[0])));
      lap = Math.max(2, Math.min(total - 1, lap));
      if (tours.some(function (t) { return Math.abs(t - lap) < ecart; })) continue;
      tours.push(lap);
      garde.push({ lap: lap, phase: "143:" + d.id, gen: generateur(d) });
    }
    garde.sort(function (a, b) { return a.lap - b.lap; });
    return garde;
  }

  // Au moment de jouer l'événement : la condition est relue (la course a bougé).
  function generateur(d) {
    return function () {
      var c = contexte();
      if (!c.p || (d.si && !d.si(c))) return null;
      var e = d.gen(c);
      if (e) { e._rj143 = d.id; noter(d.id); }
      return e;
    };
  }

  /* ------------------------------------------------------------------
   * Fenêtre d'événement
   * ---------------------------------------------------------------- */
  function secondes(x) { return (Math.round(Math.abs(x) * 10) / 10).toFixed(1).replace(".", ","); }

  function lecture(ch) {
    var c = ch.chance || null, mod = ch.mod || 0;
    var gain = mod * 90, risque, classe;
    if (!c || !(c.fail > 0)) {
      risque = "Sans risque"; classe = "sur";
    } else {
      var f = Math.round(c.fail * 100);
      if (c.dnf) { risque = "Abandon si raté · " + f + " %"; classe = "fatal"; }
      else if (c.penalty) { risque = "Pénalité si raté · " + f + " %"; classe = "penal"; }
      else { risque = (100 - f) + " % de réussite"; classe = "ose"; }
    }
    var effet = Math.abs(gain) < 0.25 ? "effet léger" : (gain > 0 ? "≈ " + secondes(gain) + " s gagnées" : "≈ " + secondes(gain) + " s perdues");
    if (c && c.fail > 0 && !c.dnf) {
      var perte = (mod + (c.failMod || 0)) * 90;
      effet += perte < -0.25 ? " · raté : ≈ " + secondes(perte) + " s perdues" + (c.penalty ? " + " + c.penalty + " s" : "") : (c.penalty ? " · raté : " + c.penalty + " s de pénalité" : "");
    }
    return { risque: risque, effet: effet, classe: classe };
  }

  function phaseDe(lr) {
    var p = lr && lr.total ? lr.cur / lr.total : 0;
    return p < 0.25 ? "Début de course" : p < 0.55 ? "Mi-course" : p < 0.85 ? "Fin de course" : "Derniers tours";
  }

  function situation() {
    var c = contexte();
    if (!c.p) return "";
    var ecart = function (a, b) { return a && b && typeof a.gap === "number" && typeof b.gap === "number" ? secondes(a.gap - b.gap) + " s" : ""; };
    var bits = ["<b>P" + c.pos + "</b>"];
    if (c.devant) bits.push(ecart(c.p, c.devant) + " derrière " + nom(c.devant));
    if (c.derriere) bits.push(ecart(c.derriere, c.p) + " devant " + nom(c.derriere));
    return bits.join(" · ");
  }

  function dessiner(e) {
    var t = document.getElementById("live-event-modal"), lr = LR();
    // résolution lit LIVE_RACE.pendingEvent : on dessine exactement ces choix-là
    if (lr && lr.pendingEvent && Array.isArray(lr.pendingEvent.choices)) e = lr.pendingEvent;
    if (!t || !e || !Array.isArray(e.choices) || !e.choices.length || !lr) return;
    var radio = false;
    try { radio = typeof _isRadioMessage === "function" && _isRadioMessage(e); } catch (x) { }
    var couleur = e.color || (radio ? "#22D3EE" : JAUNE);
    var html = '<div class="rj143-carte" data-rj-noround="1" style="--acc:' + esc(couleur) + '">' +
      '<div class="rj143-tete"><span class="rj143-led"></span><span class="rj143-type">' + (radio ? "Radio" : "Événement") + "</span>" +
      '<span class="rj143-tour">Tour ' + (lr.cur || 0) + " / " + (lr.total || 0) + " · " + phaseDe(lr) + "</span></div>" +
      '<div class="rj143-situation">' + situation() + "</div>" +
      '<div class="rj143-corps"><div class="rj143-titre">' + e.title + '</div><div class="rj143-desc" id="lec-desc-new">' + (e.desc || "") + "</div></div>" +
      '<div class="rj143-choix" id="lec-choices-new">' +
      e.choices.map(function (ch, i) {
        var l = lecture(ch);
        return '<button class="rj143-btn rj143-' + l.classe + '" data-rj-odds="1" onclick="resolveLiveEvent(' + i + ')">' +
          '<span class="rj143-btxt">' + (ch.text || ch.label || "") + "</span>" +
          '<span class="rj143-risque">' + l.risque + "</span>" +
          '<span class="rj143-effet">' + l.effet + "</span></button>";
      }).join("") +
      "</div>" +
      '<div class="rj143-resultat" id="lec-feedback-new" style="display:none"></div></div>';
    t.innerHTML = html;
    t.classList.add("rj143-modale");
  }

  /* Le résultat : réussi ou raté, et ce que ça change, en clair. */
  var capture = null;
  function resultat(choix) {
    var p = document.getElementById("lec-feedback-new");
    if (!p || !capture) return;
    var lr = LR(), j = lr && lr.drivers ? lr.drivers.find(function (d) { return d.isPlayer; }) : null;
    var c = choix && choix.chance, rate = !!(c && capture.note && c.msg && capture.note.indexOf(c.msg) >= 0);
    var lignes = [];
    (capture.effets || []).forEach(function (o) {
      if (o.paceMod && typeof o.paceMod.deltaSec === "number") {
        var tot = o.paceMod.deltaSec * o.paceMod.laps;
        lignes.push((tot < 0 ? "Tu gagnes ≈ " : "Tu perds ≈ ") + secondes(tot) + " s sur " + o.paceMod.laps + (o.paceMod.laps > 1 ? " tours" : " tour"));
      }
      if (o.penaltySec > 0) lignes.push(o.penaltySec + " s de pénalité");
      if (o.posGain > 0) lignes.push("+" + o.posGain + (o.posGain > 1 ? " places" : " place"));
      if (o.posLoss > 0) lignes.push("−" + o.posLoss + (o.posLoss > 1 ? " places" : " place"));
    });
    if (capture.penalite > 0 && !lignes.some(function (l) { return /pénalité/.test(l); })) lignes.push(capture.penalite + " s de pénalité");
    var fin = j && j.dnf;
    var verdict = fin ? "Abandon" : rate ? "Raté" : (c && c.fail > 0 ? "Réussi" : "Fait");
    var ton = fin || rate ? "mauvais" : (capture.mod > 0.003 ? "bon" : "neutre");
    p.className = "rj143-resultat rj143-" + ton;
    p.innerHTML = '<span class="rj143-verdict">' + verdict + "</span>" +
      (rate && c.msg ? '<span class="rj143-recit">' + esc(c.msg) + "</span>" : "") +
      '<span class="rj143-effets">' + (fin ? "Ta course s'arrête ici." : (lignes.join(" · ") || "Aucun changement notable")) + "</span>";
  }

  /* ------------------------------------------------------------------
   * Installation
   * ---------------------------------------------------------------- */
  function installer() {
    if (typeof rjInscrire !== "function" || typeof window.buildLiveEventSchedule !== "function" || typeof window.showLiveEvent !== "function") return false;
    // plus extérieur que 40 (−4500) : la banque complète le calendrier déjà allégé
    rjInscrire("buildLiveEventSchedule", { id: "143-calendrier", ordre: -5000, remplace: function (args, suite) {
      var s = suite();
      try { return enrichir(s, args[0]); } catch (e) { console.warn(TAG, e); return s; }
    } });
    rjInscrire("showLiveEvent", { id: "143-fenetre", ordre: 50, apres: function (res, args) {
      try { dessiner(args[0]); } catch (e) { console.warn(TAG, e); }
    } });
    var choixEnCours = null;
    rjInscrire("resolveLiveEvent", { id: "143-resultat", ordre: -9000,
      avant: function (args) {
        var lr = LR(), pe = lr && lr.pendingEvent;
        choixEnCours = pe && pe.choices ? pe.choices[args[0]] : null;
        capture = { effets: [], note: "", mod: 0, penalite: 0 };
      },
      apres: function () {
        try {
          var lr = LR(), r = lr && lr.resolvedEvents && lr.resolvedEvents[lr.resolvedEvents.length - 1];
          if (capture && r) { capture.note = String(r.note || ""); capture.mod = r.mod || 0; }
          var j = lr && lr.drivers ? lr.drivers.find(function (d) { return d.isPlayer; }) : null;
          var log = j && j.penaltyLog && j.penaltyLog[j.penaltyLog.length - 1];
          if (capture && log && log.lap === lr.cur && /\d/.test(String(log.sec))) capture.penalite = log.sec;
          resultat(choixEnCours);
        } catch (e) { console.warn(TAG, e); }
        capture = null; choixEnCours = null;
      } });
    rjInscrire("applyEventOutcome", { id: "143-capture", apres: function (res, args) {
      if (capture && args && args[1]) capture.effets.push(args[1]);
    } });
    if (!Array.isArray(window.RJ_SAVE_HOOKS)) window.RJ_SAVE_HOOKS = [];
    if (!window.RJ_SAVE_HOOKS.some(function (h) { return h && h.cle === "rj143"; })) {
      window.RJ_SAVE_HOOKS.push({ cle: "rj143",
        ecrire: function () { return vus().length ? vus().slice() : null; },
        lire: function (bloc, G_) { if (Array.isArray(bloc)) G_._rj143Vus = bloc.slice(-MEMOIRE); } });
    }
    window.RJ143 = { banque: BANQUE, enrichir: enrichir, lecture: lecture, contexte: contexte };
    window._rj143Uninstall = function () {
      rjDesinscrire("143-");
      window.RJ_SAVE_HOOKS = (window.RJ_SAVE_HOOKS || []).filter(function (h) { return !(h && h.cle === "rj143"); });
      var t = document.getElementById("live-event-modal"); if (t) t.classList.remove("rj143-modale");
    };
    console.log(TAG, "actif —", BANQUE.length, "événements en banque");
    return true;
  }

  (function boot(n) { if (!installer() && n < 80) setTimeout(function () { boot(n + 1); }, 100); })(0);
})();
