/* =====================================================================
 * 111-vue-circuit.js — LA COURSE EN DIRECT, SUR LE TRACÉ
 *
 * Pendant la course, l'écran montre le circuit couru (getCircuitData().path)
 * avec ses secteurs, sa ligne d'arrivée et sa voie des stands (entrée,
 * muret, garages, sortie), un rond par voiture aux couleurs de son écurie
 * avec les initiales du pilote, et une tour de classement en direct
 * (position, écurie, écart au leader, tours de retard). La voiture du joueur
 * est plus grande, cerclée de blanc, avec sa position.
 *
 * POSITIONS
 * RJModelePiste.etat() (108) rejoue la course en temps réel : distance,
 * classement sur la piste et écart de chaque voiture à cet instant. La vue
 * les dessine telles quelles ; avant le départ, les feux s'allument.
 * Quatre fois par seconde, les modules inscrits dans RJ_FRAME_HOOKS
 * ({ id, run(etat) }) reçoivent le même état (mini-classement de 107).
 *
 * SOBRIÉTÉ
 * L'animation (requestAnimationFrame) ne tourne que si une course est en
 * cours ET à l'écran ; elle s'arrête au drapeau, hors de l'écran de course
 * ou application en arrière-plan, et repart au retour.
 *
 * API (tests, étape suivante) :
 *   RJVueCircuit.actif()  → l'animation tourne-t-elle ?
 *   RJVueCircuit.etat()   → { circuit, stand:{x,y,w,h},
 *                             voitures:[{ nom, pos, distance, stand, x, y, autreCategorie }] }
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[111-circuit]";
  var NS = "http://www.w3.org/2000/svg";
  var vue = null;          // carte construite pour un circuit
  var voitures = {};       // nom → { el, d, stand, x, y, pos, autre }
  var boucle = 0, dernier = 0;
  /* Colonne des temps : « ecart » (au premier) ou « intervalle » (à la voiture de devant).
     Un appui sur le classement bascule ; le choix est retenu. */
  var mode = "ecart";
  try { if (localStorage.getItem("rj111-mode") === "intervalle") mode = "intervalle"; } catch (x) { }
  function basculerMode() {
    mode = mode === "ecart" ? "intervalle" : "ecart";
    try { localStorage.setItem("rj111-mode", mode); } catch (x) { }
    var lr = LR(), e = window.RJModelePiste ? RJModelePiste.etat() : null;
    if (vue && lr && e) majTourDeClassement(lr, e);
  }
  /* Caméra : trois vues, un appui sur le circuit passe à la suivante (choix
     retenu) — « embarquée » (par défaut : gros plan, la piste file dans le
     sens de marche du joueur), « suivie » (gros plan, nord en haut) et
     « ensemble » (le tracé entier). */
  var ROT_MAX = 50;   // vitesse de rotation maximale de la caméra embarquée, en degrés par seconde
  var VUES = ["embarquee", "suivie", "ensemble"], NOMS_VUES = { embarquee: "Vue embarquée", suivie: "Vue suivie", ensemble: "Vue d'ensemble" };
  var modeVue = "embarquee";
  try {
    var m0 = localStorage.getItem("rj111-vue");
    if (VUES.indexOf(m0) >= 0) modeVue = m0; else if (localStorage.getItem("rj111-zoom") === "non") modeVue = "ensemble";
  } catch (x) { }
  var zoom = modeVue !== "ensemble";
  function basculerZoom() {
    modeVue = VUES[(VUES.indexOf(modeVue) + 1) % VUES.length];
    zoom = modeVue !== "ensemble";
    try { localStorage.setItem("rj111-vue", modeVue); } catch (x) { }
    if (vue) {
      vue.cam = null; vue.palier = null;
      if (vue.hud) { vue.hud.removeAttribute("data-vue"); void vue.hud.offsetWidth; vue.hud.setAttribute("data-vue", NOMS_VUES[modeVue]); }   // relance le rappel
    }
  }
  if (!Array.isArray(window.RJ_FRAME_HOOKS)) window.RJ_FRAME_HOOKS = [];

  function LR() { return (typeof window.LIVE_RACE !== "undefined") ? window.LIVE_RACE : null; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function couleur(equipe, nom) {
    var c = typeof window.couleurEcurie === "function" ? window.couleurEcurie(equipe) : null;
    if (c) return c;
    // Écurie sans logo coloré : une teinte stable tirée du nom.
    var h = 0, k = String(equipe || nom || "");
    for (var i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) % 360;
    return "hsl(" + h + ",70%,60%)";
  }

  function element(nom, attrs) {
    var e = document.createElementNS(NS, nom);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  /* --- La carte : bloc inséré en tête de l'écran de course ------------- */
  function carte() {
    var c = document.getElementById("rj111-carte");
    if (c) return c;
    var ecran = document.getElementById("race-screen");
    if (!ecran) return null;
    c = document.createElement("div");
    c.id = "rj111-carte";
    ecran.insertBefore(c, ecran.firstChild);
    return c;
  }

  /* --- Décors, sous la piste : herbe, bacs à graviers, arbres, tribunes ;
     sur la piste : vibreurs rouge et blanc dans les virages. ------------ */
  var DEMI = 3.5;   // demi-largeur de la piste (.rj111-piste : 7)
  function hache(i) { var x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); }
  function decors(monde, L, repere, plein, PLEIN) {
    var sous = element("g", { "class": "rj111-decors" });
    monde.insertBefore(sous, monde.firstChild);
    sous.appendChild(element("rect", { x: plein.x - 80, y: plein.y - 80, width: plein.w + 160, height: plein.h + 160, "class": "rj111-herbe" }));
    var ech = [];
    for (var d = 0; d < L; d += 1.5) ech.push(repere(d));
    // virages : variation de cap sur ±3 unités ; côté intérieur = vers le milieu de la corde
    var virages = [], cur = null;
    ech.forEach(function (p, i) {
      var a = ech[(i - 2 + ech.length) % ech.length], b = ech[(i + 2) % ech.length];
      var da = Math.atan2(b.ty, b.tx) - Math.atan2(a.ty, a.tx);
      da = Math.atan2(Math.sin(da), Math.cos(da));
      var mx = (a.x + b.x) / 2 - p.x, my = (a.y + b.y) / 2 - p.y;
      var cote = (mx * -p.ty + my * p.tx) >= 0 ? 1 : -1;   // normale (-ty, tx)
      if (Math.abs(da) > 0.28) {
        if (!cur) { cur = { pts: [], tour: 0, cote: cote }; virages.push(cur); }
        cur.pts.push(p); cur.tour += Math.abs(da);
      } else cur = null;
    });
    function bord(pts, cote, decal) {
      return "M" + pts.map(function (p) { var nx = -p.ty * cote, ny = p.tx * cote; return (p.x + nx * decal).toFixed(2) + "," + (p.y + ny * decal).toFixed(2); }).join(" L");
    }
    var dessus = element("g", { "class": "rj111-vibreurs" });
    virages.forEach(function (v) {
      if (v.pts.length < 2) return;
      if (v.tour > 1.6) sous.appendChild(element("path", { d: bord(v.pts, -v.cote, DEMI + 4.5), "class": "rj111-gravier" }));
      [v.cote, -v.cote].forEach(function (cote) {
        var dd = bord(v.pts, cote, DEMI);
        dessus.appendChild(element("path", { d: dd, "class": "rj111-vibreur-b" }));
        dessus.appendChild(element("path", { d: dd, "class": "rj111-vibreur-r" }));
      });
    });
    // arbres : sur une grille, loin de la piste
    var arbres = element("g", { "class": "rj111-arbres" }), n = 0;
    for (var gx = plein.x - 30; gx < plein.x + plein.w + 30 && n < 420; gx += 7) {
      for (var gy = plein.y - 30; gy < plein.y + plein.h + 30 && n < 420; gy += 7) {
        var k = Math.round(gx * 7 + gy * 13), x = gx + hache(k) * 5, y = gy + hache(k + 1) * 5;
        if (hache(k + 2) < 0.45) continue;
        var loin = true;
        for (var j = 0; j < ech.length; j += 2) { var dx = ech[j].x - x, dy = ech[j].y - y; if (dx * dx + dy * dy < 324) { loin = false; break; } }
        if (!loin) continue;
        arbres.appendChild(element("circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: (1.6 + hache(k + 3) * 1.8).toFixed(2), "class": "rj111-arbre a" + Math.floor(hache(k + 4) * 3) }));
        n++;
      }
    }
    sous.appendChild(arbres);
    // tribunes le long de la ligne droite, du côté opposé aux stands
    for (var sd = -PLEIN; sd <= PLEIN; sd += 6.5) {
      var r = repere(((sd % L) + L) % L), o = DEMI + 6;
      var ang = Math.atan2(r.ty, r.tx) * 180 / Math.PI;
      var tr = element("g", { transform: "translate(" + (r.x - r.nx * o).toFixed(2) + "," + (r.y - r.ny * o).toFixed(2) + ") rotate(" + ang.toFixed(1) + ")" });
      tr.appendChild(element("rect", { x: -3, y: -1.8, width: 6, height: 3.6, rx: .3, "class": "rj111-tribune" }));
      tr.appendChild(element("rect", { x: -2.7, y: -1.2, width: 5.4, height: .6, "class": "rj111-public" }));
      tr.appendChild(element("rect", { x: -2.7, y: .2, width: 5.4, height: .6, "class": "rj111-public b" }));
      sous.appendChild(tr);
    }
    // les vibreurs passent au-dessus de la piste, sous les voitures
    // sous les voitures : juste après la piste et ses repères
    monde.appendChild(dessus);
  }

  function construire(c, circuit) {
    var donnees = typeof getCircuitData === "function" ? getCircuitData(circuit) : null;
    if (!donnees || !donnees.path) { c.hidden = true; return null; }
    c.hidden = false;
    c.innerHTML = '<div class="rj111-tete"><span class="rj111-nom">' + esc(circuit) + "</span>" +
      '<span class="rj111-neutre" hidden></span></div><div class="rj111-corps"><div class="rj111-colonne" data-theme="' + theme().id + '">' +
      '<div class="rj111-entete"><b>' + theme().sigle + '</b><span class="rj111-tours"></span><span class="rj111-mode"></span></div><ol class="rj111-tour"></ol></div></div>';
    var corps = c.querySelector(".rj111-corps");
    var colonne = c.querySelector(".rj111-colonne");
    /* pas de role="button" : le module 57 viderait la tour (écussons, écarts) en la prenant pour un bouton */
    colonne.title = "Appuyer pour passer de l’écart au premier à l’intervalle";
    colonne.addEventListener("click", basculerMode);

    var scene = document.createElement("div");
    scene.className = "rj111-scene";
    corps.appendChild(scene);
    var svg = element("svg", { "class": "rj111-svg", role: "img", "aria-label": "Course en direct sur " + circuit });
    scene.appendChild(svg);
    svg.addEventListener("click", basculerZoom);
    var meteo = (typeof RACE_STATE !== "undefined" && RACE_STATE.weather && RACE_STATE.weather.id) || "";
    if (/rain|wet|storm/.test(meteo)) scene.classList.add("rj111-pluie", meteo === "storm" ? "forte" : "fine");
    var hud = document.createElement("div");
    hud.className = "rj111-hud";
    scene.appendChild(hud);
    var mini = element("svg", { "class": "rj111-mini", "aria-hidden": "true" });
    mini.appendChild(element("path", { d: donnees.path, "class": "rj111-mini-piste" }));
    var miniPoints = element("g");
    mini.appendChild(miniPoints);
    scene.appendChild(mini);
    var defs = element("defs");
    var damier = element("pattern", { id: "rj111-damier", width: 1.2, height: 1.2, patternUnits: "userSpaceOnUse" });
    damier.appendChild(element("rect", { width: 1.2, height: 1.2, fill: "#fff" }));
    damier.appendChild(element("rect", { width: 0.6, height: 0.6, fill: "#111" }));
    damier.appendChild(element("rect", { x: 0.6, y: 0.6, width: 0.6, height: 0.6, fill: "#111" }));
    defs.appendChild(damier);
    svg.appendChild(defs);
    var monde = element("g", { "class": "rj111-monde" });
    svg.appendChild(monde);
    monde.appendChild(element("path", { d: donnees.path, "class": "rj111-bord" }));
    monde.appendChild(element("path", { d: donnees.path, "class": "rj111-limite" }));
    var piste = element("path", { d: donnees.path, "class": "rj111-piste" });
    monde.appendChild(piste);

    var L = piste.getTotalLength(), b = piste.getBBox(), marge = 9;
    mini.setAttribute("viewBox", [b.x - 4, b.y - 4, b.width + 8, b.height + 8].join(" "));
    svg.setAttribute("viewBox", [b.x - marge, b.y - marge, b.width + 2 * marge, b.height + 2 * marge].join(" "));

    // Repères perpendiculaires au tracé : normale tournée vers l'intérieur du circuit.
    var cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    function repere(dist) {
      var p0 = piste.getPointAtLength(dist), p1 = piste.getPointAtLength(Math.min(L, dist + 1.5));
      var tx = p1.x - p0.x, ty = p1.y - p0.y, n = Math.hypot(tx, ty) || 1;
      tx /= n; ty /= n;
      var nx = -ty, ny = tx;
      if ((cx - p0.x) * nx + (cy - p0.y) * ny < 0) { nx = -nx; ny = -ny; }
      return { x: p0.x, y: p0.y, tx: tx, ty: ty, nx: nx, ny: ny };
    }
    [1 / 3, 2 / 3].forEach(function (part) {           // fins des secteurs 1 et 2
      var r = repere(part * L);
      monde.appendChild(element("line", { x1: r.x - r.nx * 3, y1: r.y - r.ny * 3, x2: r.x + r.nx * 3, y2: r.y + r.ny * 3, "class": "rj111-secteur" }));
    });
    var r0 = repere(0);
    var angle = Math.atan2(r0.ny, r0.nx) * 180 / Math.PI;
    monde.appendChild(element("rect", { x: -3, y: -0.6, width: 6, height: 1.2, fill: "url(#rj111-damier)",
      transform: "translate(" + r0.x.toFixed(2) + "," + r0.y.toFixed(2) + ") rotate(" + angle.toFixed(1) + ")" }));
    /* Voie des stands : parallèle à la ligne droite d'arrivée, côté intérieur,
       avec une entrée et une sortie qui rejoignent la piste, un muret et des
       garages. s = distance au départ (négative avant la ligne). */
    var vs = donnees.voieStands, ENTREE = vs ? Math.max(8, Math.min(18, vs.avant, vs.apres)) : 18, PLEIN = ENTREE - 5, ECART = 7;
    function surVoie(sd, decal) {
      var r = repere(((sd % L) + L) % L), a = Math.abs(sd);
      var k = a <= PLEIN ? 1 : Math.max(0, (ENTREE - a) / (ENTREE - PLEIN));
      var o = (decal == null ? ECART : decal) * k;
      return { x: r.x + r.nx * o, y: r.y + r.ny * o, r: r };
    }
    var pts = [];
    for (var sd = -ENTREE; sd <= ENTREE; sd += 1) pts.push(surVoie(sd));
    var trace = "M" + pts.map(function (p) { return p.x.toFixed(2) + "," + p.y.toFixed(2); }).join(" L");
    monde.appendChild(element("path", { d: trace, "class": "rj111-voie-bord" }));
    monde.appendChild(element("path", { d: trace, "class": "rj111-voie" }));
    var muret = [];
    for (sd = -PLEIN + 1; sd <= PLEIN - 1; sd += 1) muret.push(surVoie(sd, ECART / 2));
    monde.appendChild(element("path", { d: "M" + muret.map(function (p) { return p.x.toFixed(2) + "," + p.y.toFixed(2); }).join(" L"), "class": "rj111-muret" }));
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (sd = -PLEIN + 2; sd <= PLEIN - 2; sd += 2.4) {
      var g0 = surVoie(sd, ECART + 2.6), ang = Math.atan2(g0.r.ty, g0.r.tx) * 180 / Math.PI;
      monde.appendChild(element("rect", { x: -1, y: -1, width: 2, height: 2, rx: .3, "class": "rj111-garage",
        transform: "translate(" + g0.x.toFixed(2) + "," + g0.y.toFixed(2) + ") rotate(" + ang.toFixed(1) + ")" }));
    }
    pts.forEach(function (p, i) {
      if (Math.abs(i - ENTREE) > PLEIN) return;
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });
    // Boîte qui englobe la voie (API et tests) ; les voitures arrêtées s'y rangent.
    var stand = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, w: Math.max(2, maxX - minX), h: Math.max(2, maxY - minY),
                  place: function (i) { return surVoie(-PLEIN + 2 + (i % 10) * ((2 * PLEIN - 4) / 9)); } };
    var lieu = surVoie(0, ECART + 6.5);
    var lib = element("text", { x: lieu.x.toFixed(2), y: (lieu.y + 1.2).toFixed(2), "class": "rj111-stand-lib" });
    lib.textContent = "STANDS";
    monde.appendChild(lib);
    var tout = monde.getBBox();   // la voie peut déborder du cadre de la piste
    var plein = { x: tout.x - 4, y: tout.y - 4, w: tout.width + 8, h: tout.height + 8 };
    svg.setAttribute("viewBox", [plein.x, plein.y, plein.w, plein.h].join(" "));
    decors(monde, L, repere, plein, PLEIN);

    var groupe = element("g", { "class": "rj111-voitures" });
    monde.appendChild(groupe);

    voitures = {};
    return { circuit: circuit, svg: svg, monde: monde, piste: piste, longueur: L, groupe: groupe, stand: stand, plein: plein, cam: null, rot: 0,
             hud: hud, mini: mini, miniPoints: miniPoints, miniV: {},
             tour: c.querySelector(".rj111-tour"), tours: c.querySelector(".rj111-tours"), mode: c.querySelector(".rj111-mode"), majTour: 0, neutre: c.querySelector(".rj111-neutre") };
  }

  /* Une voiture : un rond aux couleurs de l'écurie, avec les initiales du pilote. */
  /* Une voiture : une petite monoplace aux couleurs de l'écurie, orientée
     dans le sens de la piste (corps), et son nom toujours à l'endroit (nom). */
  /* Silhouette vue de dessus (nez vers +x), selon la catégorie : un kart
     n'a ni ailerons ni coque, un prototype d'endurance a des roues carénées,
     une IndyCar porte l'aeroscreen ; les monoplaces grandissent de la F4 à
     la F1. k : échelle (joueur un peu plus grand). */
  var ECHELLE_CAT = { kart: 0.72, f4: 0.88, f3: 0.94, f2: 1, sf: 1, f1: 1.08, indy: 1.04, wec: 1.12 };
  function silhouette(corps, id, k, teinte) {
    var e = k * (ECHELLE_CAT[id] || 1);
    function r(x, y, w, h, cls, rx) { corps.appendChild(element("rect", { x: x * e, y: y * e, width: w * e, height: h * e, rx: (rx == null ? 0.1 : rx) * e, "class": cls })); }
    function chemin(pts, attrs) {
      corps.appendChild(element("path", Object.assign({ d: "M" + pts.map(function (p) { return (p[0] * e).toFixed(2) + "," + (p[1] * e).toFixed(2); }).join(" L") + "Z" }, attrs)));
    }
    if (id === "kart") {
      // quatre roues larges, châssis court, pare-chocs, pilote assis au centre
      [[-1.35, -1.05], [-1.35, 0.6], [0.75, -0.95], [0.75, 0.55]].forEach(function (p) { r(p[0], p[1], 0.75, 0.45, "rj111-pneu"); });
      r(-1.5, -0.55, 2.9, 1.1, "rj111-caisse", 0.3);
      corps.lastChild.setAttribute("fill", teinte);
      r(1.45, -0.7, 0.3, 1.4, "rj111-aileron", 0.15);   // pare-chocs avant
      corps.appendChild(element("circle", { cx: -0.3 * e, cy: 0, r: 0.42 * e, "class": "rj111-casque" }));
      return;
    }
    if (id === "wec") {
      // prototype fermé : carrosserie qui couvre les roues, cockpit, phares, aileron arrière
      r(-2.25, -0.95, 0.4, 1.9, "rj111-aileron");
      chemin([[-2, -0.85], [1.2, -0.85], [2.2, -0.45], [2.2, 0.45], [1.2, 0.85], [-2, 0.85]], { fill: teinte, "class": "rj111-caisse" });
      corps.appendChild(element("ellipse", { cx: 0.35 * e, cy: 0, rx: 0.7 * e, ry: 0.42 * e, "class": "rj111-verriere" }));
      r(2.0, -0.62, 0.18, 0.3, "rj111-phare", 0.05); r(2.0, 0.32, 0.18, 0.3, "rj111-phare", 0.05);
      return;
    }
    // monoplace : ailerons, roues découvertes, coque effilée, casque (et aeroscreen en IndyCar)
    r(-2.1, -0.95, 0.55, 1.9, "rj111-aileron");
    r(1.75, -1.05, 0.45, 2.1, "rj111-aileron");
    [[-1.45, -0.95], [-1.45, 0.55], [0.85, -0.9], [0.85, 0.5]].forEach(function (p) { r(p[0], p[1], 0.7, 0.4, "rj111-pneu"); });
    chemin([[-1.9, -0.55], [0.9, -0.35], [2.1, 0], [0.9, 0.35], [-1.9, 0.55]], { fill: teinte, "class": "rj111-caisse" });
    corps.appendChild(element("circle", { cx: -0.35 * e, cy: 0, r: 0.3 * e, "class": "rj111-casque" }));
    if (id === "indy") corps.appendChild(element("path", { d: "M" + (0.05 * e) + "," + (-0.45 * e) + " Q" + (0.45 * e) + ",0 " + (0.05 * e) + "," + (0.45 * e), "class": "rj111-aeroscreen" }));
  }

  function pastille(joueur, autre, teinte, nom) {
    var g = element("g", { "class": "rj111-voiture" + (joueur ? " rj111-joueur" : "") + (autre ? " rj111-autre" : "") });
    var k = joueur ? 1.15 : autre ? 0.7 : 1;
    if (joueur) g.appendChild(element("circle", { r: 3.2, "class": "rj111-halo" }));
    var corps = element("g", { "class": "rj111-corps-v" });
    silhouette(corps, autre ? "f" : theme().id, k, teinte);
    g.appendChild(corps);
    var nomG = element("g", { "class": "rj111-nom-v" });
    if (!autre) {
      var t = element("text", { y: joueur ? -2.6 : -2.1, "class": "rj111-initiales", "font-size": joueur ? 1.5 : 1.1 });
      t.textContent = joueur ? abrege(nom) : abrege(nom);
      nomG.appendChild(t);
    }
    g.appendChild(nomG);
    return g;
  }

  /* --- Une image ---------------------------------------------------------- */
  function visible() {
    var ecran = document.getElementById("S-race"), c = document.getElementById("rj111-carte");
    return !!(ecran && ecran.classList.contains("on") && c && c.offsetParent !== null && document.visibilityState !== "hidden");
  }

  function abrege(nom) {
    var mots = String(nom || "").trim().split(/\s+/);
    return (mots[mots.length - 1] || "").replace(/[^A-Za-zÀ-ÿ]/g, "").slice(0, 3).toUpperCase() || "???";
  }

  /* Habillage de la tour selon la catégorie, à la manière des retransmissions. */
  function theme() {
    var cat = String((typeof G !== "undefined" && G && G.cat) || "");
    if (/karting/i.test(cat)) return { id: "kart", sigle: "KART", dec: 1 };
    if (/indy/i.test(cat)) return { id: "indy", sigle: "INDY", dec: 3 };
    if (/wec|endurance|mans/i.test(cat)) return { id: "wec", sigle: "WEC", dec: 3 };
    if (/super formula/i.test(cat)) return { id: "sf", sigle: "SF", dec: 3 };
    var n = cat.match(/formule\s*(\d)/i);
    return n ? { id: "f" + n[1], sigle: "F" + n[1], dec: 3 } : { id: "f1", sigle: "F1", dec: 3 };
  }

  /* L'écusson de l'écurie, ou sa couleur quand elle n'en a pas. */
  var LIGNES = 20;
  function ecusson(equipe, nom) {
    var svg = equipe && window.TEAM_LOGOS && window.TEAM_LOGOS[equipe];
    return svg ? '<span class="l">' + svg + "</span>" : '<span class="c" style="background:' + couleur(equipe, nom) + '"></span>';
  }

  /* Tour de classement : l'ordre sur la piste à cet instant (108). */
  function majTourDeClassement(lr, e) {
    var parNom = {};
    lr.drivers.forEach(function (d) { parNom[d.name] = d; });
    var th = theme(), total = lr.total || lr.totalLaps || 0, tourEnCours = lr.finished ? total : Math.max(1, Math.min(total || 1e9, lr.cur || 0));   // même compte que la barre de progression (90)
    if (vue.tours) vue.tours.innerHTML = (lr.finished ? "ARRIVÉE" : "TOUR <b>" + tourEnCours + "</b>" + (total ? "/" + total : ""));
    if (vue.mode) vue.mode.textContent = mode === "ecart" ? "ÉCART" : "INTERVALLE";
    var avantDepart = !e.fini && !(e.temps > 0);   // sur la grille : personne n'a encore d'écart
    var vivants = e.voitures.filter(function (v) { return !v.abandon; })
      .sort(function (a, b) { return (a.autreCategorie - b.autreCategorie) || (a.pos - b.pos); });
    // les abandons restent dans la tour, en bas et grisés, « OUT » à la place de l'écart
    var abandons = e.voitures.filter(function (v) { return v.abandon; })
      .sort(function (a, b) { return (a.autreCategorie - b.autreCategorie) || (a.pos - b.pos); });
    var liste = vivants.concat(abandons);
    // vingt lignes ; le joueur toujours visible (à la dernière ligne s'il est plus loin)
    var montres = liste.slice(0, LIGNES), iJoueur = liste.findIndex(function (v) { return v.joueur; });
    if (iJoueur >= LIGNES) montres[LIGNES - 1] = liste[iJoueur];
    vue.tour.innerHTML = montres.map(function (v, k) {
      var d = parNom[v.nom] || {};
      if (v.abandon) {
        var meme = function (w) { return w.autreCategorie === v.autreCategorie; };
        var rang = vivants.filter(meme).length + abandons.filter(meme).indexOf(v) + 1;
        return '<li class="out' + (v.joueur ? " moi" : "") + (v.autreCategorie ? " autre" : "") + (k === LIGNES - 1 && liste.indexOf(v) >= LIGNES ? " detache" : "") + '"><span class="p">' + rang + "</span>" +
          ecusson(d.team, v.nom) + '<span class="n">' + esc(abrege(v.nom)) + '</span><span class="e">OUT</span></li>';
      }
      var i = vivants.indexOf(v);
      var tete = i === 0 || vivants[i - 1].autreCategorie !== v.autreCategorie;
      var x = mode === "intervalle" && !tete ? v.ecart - vivants[i - 1].ecart : v.ecart;
      var ecart = tete ? "TÊTE" : avantDepart ? ""
        : x >= e.tempsTour ? "+" + Math.floor(x / e.tempsTour) + " T" : "+" + Math.max(Math.pow(10, -th.dec), x).toFixed(th.dec);
      return '<li class="' + (v.joueur ? "moi" : "") + (v.autreCategorie ? " autre" : "") + (v.auStand ? " stand" : "") + (tete ? " tete" : "") + (k === LIGNES - 1 && liste.indexOf(v) >= LIGNES ? " detache" : "") + '"><span class="p">' + v.pos + "</span>" +
        ecusson(d.team, v.nom) +
        '<span class="n">' + esc(abrege(v.nom)) + '</span><span class="e">' + (v.auStand ? '<i class="pit">PIT</i>' : ecart) + "</span></li>";
    }).join("");
  }

  /* Caméra embarquée : le monde tourne autour du joueur pour que la piste
     file vers le haut de l'écran, dans son sens de marche ; le joueur est
     placé au tiers bas pour voir ce qui arrive. Vue d'ensemble : nord en haut. */
  function camera(joueur, e, dt) {
    var P = vue.plein, svg = vue.svg;
    if (!zoom || !joueur || e.fini) {
      if (vue.cam !== "plein") { svg.setAttribute("viewBox", [P.x, P.y, P.w, P.h].join(" ")); vue.monde.removeAttribute("transform"); vue.rot = 0; vue.cam = "plein"; }
      return;
    }
    var J = joueur.p;   // position de cette image (x, y ne sont écrits qu après la caméra)
    if (!J || !isFinite(J.x) || !isFinite(J.y)) return;
    var rc = svg.getBoundingClientRect(), asp = rc.width > 0 && rc.height > 0 ? rc.width / rc.height : 1.6;
    // la hauteur compte : c est la piste qu on voit arriver devant le joueur
    var H = Math.max(40, Math.min(60, Math.max(P.w, P.h) * 0.42)), W = H * asp;
    var neuve = !vue.cam || vue.cam === "plein";
    var c = neuve ? { x: J.x, y: J.y } : vue.cam;
    // lissage selon le temps écoulé (même rendu à 20 ou 120 images/s)
    var kp = 1 - Math.exp(-(dt || 16) / 90), kr = 1 - Math.exp(-(dt || 16) / 600);
    if (Math.hypot(J.x - c.x, J.y - c.y) > H * 0.6) { c.x = J.x; c.y = J.y; }
    else { c.x += (J.x - c.x) * kp; c.y += (J.y - c.y) * kp; }
    /* la direction où va le joueur pointe vers le haut : on vise un point de la
       piste plus loin devant (moyenne des prochains virages), pas le cap
       instantané qui tournerait sans cesse dans les chicanes. */
    var cap = joueur.cap || 0;
    if (!joueur.stand && typeof joueur.ici === "number") {
      var loin = vue.piste.getPointAtLength((joueur.ici + 30) % vue.longueur);
      cap = Math.atan2(loin.y - J.y, loin.x - J.x);
    }
    /* Confort : rotation plafonnée à ROT_MAX °/s (mesuré avant : 73 °/s en
       médiane, pointes à 230, à-coups à 1400 en vitesse rapide). En vitesse
       rapide ou instantanée, les tours défilent trop vite pour une vue qui
       tourne : la caméra suit le joueur, nord en haut. */
    var rapide = modeVue === "suivie" || (typeof SETTINGS !== "undefined" && /fast|instant/.test(SETTINGS.simSpeed || ""));
    var brute = rapide ? 0 : -90 - cap * 180 / Math.PI;
    /* Paliers de 45° avec hystérésis : la vue ne pivote que lorsque la direction
       générale s'écarte de plus de 35° de l'orientation retenue ; le reste du
       temps elle reste immobile (un tour ne dure que quelques secondes). */
    if (vue.palier == null || neuve || rapide) vue.palier = Math.round(brute / 45) * 45;
    else if (Math.abs(((brute - vue.palier) % 360 + 540) % 360 - 180) > 35) vue.palier = Math.round(brute / 45) * 45;
    var cible = vue.palier;
    var d = ((cible - vue.rot) % 360 + 540) % 360 - 180;
    var pas = ROT_MAX * (dt || 16) / 1000;
    vue.rot = neuve ? cible : vue.rot + Math.max(-pas, Math.min(pas, d * kr * 4));
    vue.rot = ((vue.rot % 360) + 540) % 360 - 180;
    vue.cam = c;
    vue.monde.setAttribute("transform", "rotate(" + vue.rot.toFixed(2) + " " + c.x.toFixed(2) + " " + c.y.toFixed(2) + ")");
    var cy = c.y - H * 0.2;   // le joueur au tiers bas
    svg.setAttribute("viewBox", [(c.x - W / 2).toFixed(2), (cy - H / 2).toFixed(2), W.toFixed(2), H.toFixed(2)].join(" "));
  }

  /* Mini-carte : le tracé entier, un point par voiture (le joueur en blanc). */
  function miniCarte(e, joueur) {
    vue.mini.style.display = zoom && joueur && !e.fini ? "" : "none";
    if (vue.mini.style.display) return;
    Object.keys(voitures).forEach(function (nom) {
      var r = voitures[nom], p = vue.miniV[nom];
      if (r.autre) return;
      if (!p) { p = vue.miniV[nom] = element("circle", { r: r === joueur ? 3.2 : 2.2, "class": r === joueur ? "moi" : "" }); vue.miniPoints.appendChild(p); }
      p.setAttribute("cx", r.x.toFixed(1)); p.setAttribute("cy", r.y.toFixed(1));
    });
    Object.keys(vue.miniV).forEach(function (nom) { if (!voitures[nom]) { vue.miniV[nom].remove(); delete vue.miniV[nom]; } });
  }

  /* HUD : position, tour, écarts avec la voiture de devant et de derrière. */
  function majHud(lr, e) {
    var vivants = e.voitures.filter(function (v) { return !v.abandon && !v.autreCategorie; }).sort(function (a, b) { return a.pos - b.pos; });
    var i = vivants.findIndex(function (v) { return v.joueur; });
    if (i < 0) { vue.hud.innerHTML = ""; return; }
    var moi = vivants[i], av = vivants[i - 1], ar = vivants[i + 1];
    var total = lr.total || 0, tour = lr.finished ? total : Math.max(1, Math.min(total || 1e9, lr.cur || 0));
    var ec = function (x) { return x >= e.tempsTour ? Math.floor(x / e.tempsTour) + " T" : x.toFixed(1) + " s"; };
    var duel = function (v, signe, cls) {
      if (!v || !(e.temps > 0)) return "";
      var x = Math.abs((v.ecart || 0) - (moi.ecart || 0));
      return '<div class="d ' + cls + (x < 1 ? " proche" : "") + '"><span>' + esc(abrege(v.nom)) + "</span><b>" + signe + ec(x) + "</b></div>";
    };
    vue.hud.innerHTML = '<div class="p"><b>P' + moi.pos + '</b><span>/' + vivants.length + "</span></div>" +
      '<div class="t">' + (lr.finished ? "ARRIVÉE" : "TOUR " + tour + (total ? "/" + total : "")) + "</div>" +
      duel(av, "−", "av") + duel(ar, "+", "ar");
  }

  function image(t) {
    boucle = 0;
    var lr = LR(), e = window.RJModelePiste ? RJModelePiste.etat() : null;
    var c = carte();
    if (!lr || !e || !c) return;
    var circuit = (typeof RACE_STATE !== "undefined" && RACE_STATE.circuit) || "";
    if (!visible()) return;   // hors écran : on s'arrête (et le tracé ne se mesure pas caché)
    if (!vue || vue.circuit !== circuit || !c.contains(vue.svg)) vue = construire(c, circuit);
    if (!vue) return;
    dernier = t;

    var parNom = {};
    lr.drivers.forEach(function (d) { parNom[d.name] = d; });
    var presents = {}, joueur = null;
    e.voitures.forEach(function (v) {
      if (v.abandon || v.distance === null) return;
      var cle = v.nom;
      presents[cle] = true;
      var r = voitures[cle];
      if (!r) {
        var d = parNom[cle];
        r = voitures[cle] = { el: pastille(v.joueur, v.autreCategorie, couleur(d && d.team, cle), cle), rang: Object.keys(voitures).length };
        vue.groupe.appendChild(r.el);
      }
      r.d = v.distance; r.pos = v.pos; r.stand = v.auStand; r.autre = v.autreCategorie;
      if (v.joueur) joueur = r;
      var lg = vue.longueur, ici = (((r.d % 1) + 1) % 1) * lg;
      r.ici = ici;
      if (r.stand) { var sp = vue.stand.place(r.rang); r.p = { x: sp.x, y: sp.y }; r.cap = Math.atan2(sp.r.ty, sp.r.tx); }
      else r.p = vue.piste.getPointAtLength(ici);
    });
    /* Deux voitures à moins de 5 unités l'une de l'autre se mettent côte à
       côte (couloirs) : les bagarres et les dépassements se voient. */
    var enPiste = Object.keys(presents).map(function (nom) { return voitures[nom]; }).filter(function (r) { return !r.stand; })
      .sort(function (a, b) { return a.ici - b.ici; });
    enPiste.forEach(function (r, i) {
      var prec = enPiste[i - 1], cible = 0;
      if (prec && r.ici - prec.ici < 5) cible = prec.cible > 0 ? -1.5 : 1.5;
      r.cible = cible;
      r.lat = (r.lat || 0) + (cible - (r.lat || 0)) * 0.12;
      var q = vue.piste.getPointAtLength((r.ici + 0.8) % vue.longueur), tx = q.x - r.p.x, ty = q.y - r.p.y, nn = Math.hypot(tx, ty) || 1;
      var cap = Math.atan2(ty, tx);
      // cap lissé (les virages serrés ne font pas sauter la voiture)
      r.cap = r.cap == null ? cap : r.cap + Math.atan2(Math.sin(cap - r.cap), Math.cos(cap - r.cap)) * 0.35;
      r.p = { x: r.p.x - ty / nn * r.lat, y: r.p.y + tx / nn * r.lat };
    });
    camera(joueur, e, vue.tPrec ? Math.min(500, t - vue.tPrec) : 16);
    vue.tPrec = t;
    var redresse = (-vue.rot).toFixed(1);   // les noms restent à l'endroit malgré la rotation du monde
    Object.keys(presents).forEach(function (nom) {
      var r = voitures[nom];
      r.x = r.p.x; r.y = r.p.y;
      r.el.setAttribute("transform", "translate(" + r.x.toFixed(2) + "," + r.y.toFixed(2) + ")");
      r.el.querySelector(".rj111-corps-v").setAttribute("transform", "rotate(" + ((r.cap || 0) * 180 / Math.PI).toFixed(1) + ")");
      r.el.lastChild.setAttribute("transform", "rotate(" + redresse + ")");
    });
    miniCarte(e, joueur);
    Object.keys(voitures).forEach(function (nom) {
      if (!presents[nom]) { voitures[nom].el.remove(); delete voitures[nom]; }
    });
    // Le joueur au premier plan, avec sa position.
    if (joueur) {
      vue.groupe.appendChild(joueur.el);
      var lbl = joueur.el.querySelector(".rj111-initiales");
      if (lbl && lbl.getAttribute("data-p") !== String(joueur.pos)) { lbl.setAttribute("data-p", joueur.pos); lbl.textContent = "P" + joueur.pos; }
    }
    if (t - vue.majTour > 250 || e.fini) {
      vue.majTour = t;
      majTourDeClassement(lr, e);
      majHud(lr, e);
      (window.RJ_FRAME_HOOKS || []).forEach(function (h) { try { h.run(e); } catch (x) { console.warn(TAG, h.id, x && x.message); } });
    }
    var n = lr._rjNeutral && lr._rjNeutral.active ? lr._rjNeutral : null;
    vue.neutre.hidden = !n && !e.feux;
    if (e.feux) vue.neutre.innerHTML = '<span class="rj111-feux">' + [1, 2, 3, 4, 5].map(function (i) { return "<i" + (i <= e.feux ? ' class="on"' : "") + "></i>"; }).join("") + "</span>";
    else if (n) vue.neutre.textContent = String(n.type || "SC").toUpperCase();

    if (!e.fini) boucle = requestAnimationFrame(image);
  }

  function demarrer() {
    if (boucle || !visible()) return;
    var lr = LR();
    if (!lr || !lr.drivers || !lr.drivers.length || lr.finished) return;
    dernier = 0;
    boucle = requestAnimationFrame(image);
  }

  function nouvelleCourse() {
    if (boucle) cancelAnimationFrame(boucle);
    boucle = 0; vue = null; voitures = {};
    carte();
    setTimeout(demarrer, 0);
  }

  function etat() {
    return {
      circuit: vue ? vue.circuit : null,
      temps: dernier,                 // horodatage de la dernière image
      rotation: vue && vue.cam !== "plein" ? vue.rot : 0,   // angle de la caméra embarquée (degrés)
      stand: vue ? vue.stand : null,
      voitures: Object.keys(voitures).map(function (nom) {
        var r = voitures[nom];
        return { nom: nom, pos: r.pos, distance: r.d, stand: !!r.stand, x: r.x, y: r.y, autreCategorie: !!r.autre };
      })
    };
  }

  function boot() {
    if (!Array.isArray(window.RJ_RACE_START_HOOKS) || !Array.isArray(window.RJ_LAP_HOOKS) ||
        !Array.isArray(window.RJ_SCREEN_HOOKS) || !Array.isArray(window.RJ_RACE_TAB_HOOKS)) return setTimeout(boot, 100);
    var deja = function (L) { return L.some(function (h) { return h && h.id === "111-circuit"; }); };
    if (!deja(window.RJ_RACE_START_HOOKS)) {
      window.RJ_RACE_START_HOOKS.push({ id: "111-circuit", apres: nouvelleCourse });
      window.RJ_LAP_HOOKS.push({ id: "111-circuit", run: demarrer });
      window.RJ_SCREEN_HOOKS.push({ id: "111-circuit", ecran: "*", apres: function () { setTimeout(demarrer, 0); } });
      window.RJ_RACE_TAB_HOOKS.push({ id: "111-circuit", apres: function () { setTimeout(demarrer, 0); } });
    }
    document.addEventListener("visibilitychange", demarrer);
    window.RJVueCircuit = { actif: function () { return !!boucle; }, etat: etat, theme: theme };
    window._rj111Uninstall = function () {
      ["RJ_RACE_START_HOOKS", "RJ_LAP_HOOKS", "RJ_SCREEN_HOOKS", "RJ_RACE_TAB_HOOKS"].forEach(function (r) {
        window[r] = window[r].filter(function (h) { return !(h && h.id === "111-circuit"); });
      });
      document.removeEventListener("visibilitychange", demarrer);
      if (boucle) cancelAnimationFrame(boucle);
      boucle = 0;
      var c = document.getElementById("rj111-carte"); if (c) c.remove();
      delete window.RJVueCircuit;
    };
    console.log(TAG, "actif — la course en direct sur le tracé");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
