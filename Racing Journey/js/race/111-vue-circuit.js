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
  /* Caméra : par défaut, gros plan sur la portion de circuit où roule le
     joueur (la piste paraît plus large, les bagarres se voient) ; un appui
     sur le circuit montre le tracé entier. Le choix est retenu. */
  var zoom = true;
  try { if (localStorage.getItem("rj111-zoom") === "non") zoom = false; } catch (x) { }
  function basculerZoom() {
    zoom = !zoom;
    try { localStorage.setItem("rj111-zoom", zoom ? "oui" : "non"); } catch (x) { }
    if (vue) vue.cam = null;
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
  function decors(svg, defs, L, repere, plein, PLEIN) {
    var sous = element("g", { "class": "rj111-decors" });
    svg.insertBefore(sous, defs.nextSibling);
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
    svg.appendChild(dessus);
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

    var svg = element("svg", { "class": "rj111-svg", role: "img", "aria-label": "Course en direct sur " + circuit });
    corps.appendChild(svg);
    svg.addEventListener("click", basculerZoom);
    var defs = element("defs");
    var damier = element("pattern", { id: "rj111-damier", width: 1.2, height: 1.2, patternUnits: "userSpaceOnUse" });
    damier.appendChild(element("rect", { width: 1.2, height: 1.2, fill: "#fff" }));
    damier.appendChild(element("rect", { width: 0.6, height: 0.6, fill: "#111" }));
    damier.appendChild(element("rect", { x: 0.6, y: 0.6, width: 0.6, height: 0.6, fill: "#111" }));
    defs.appendChild(damier);
    svg.appendChild(defs);
    svg.appendChild(element("path", { d: donnees.path, "class": "rj111-bord" }));
    svg.appendChild(element("path", { d: donnees.path, "class": "rj111-limite" }));
    var piste = element("path", { d: donnees.path, "class": "rj111-piste" });
    svg.appendChild(piste);

    var L = piste.getTotalLength(), b = piste.getBBox(), marge = 9;
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
      svg.appendChild(element("line", { x1: r.x - r.nx * 3, y1: r.y - r.ny * 3, x2: r.x + r.nx * 3, y2: r.y + r.ny * 3, "class": "rj111-secteur" }));
    });
    var r0 = repere(0);
    var angle = Math.atan2(r0.ny, r0.nx) * 180 / Math.PI;
    svg.appendChild(element("rect", { x: -3, y: -0.6, width: 6, height: 1.2, fill: "url(#rj111-damier)",
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
    svg.appendChild(element("path", { d: trace, "class": "rj111-voie-bord" }));
    svg.appendChild(element("path", { d: trace, "class": "rj111-voie" }));
    var muret = [];
    for (sd = -PLEIN + 1; sd <= PLEIN - 1; sd += 1) muret.push(surVoie(sd, ECART / 2));
    svg.appendChild(element("path", { d: "M" + muret.map(function (p) { return p.x.toFixed(2) + "," + p.y.toFixed(2); }).join(" L"), "class": "rj111-muret" }));
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (sd = -PLEIN + 2; sd <= PLEIN - 2; sd += 2.4) {
      var g0 = surVoie(sd, ECART + 2.6), ang = Math.atan2(g0.r.ty, g0.r.tx) * 180 / Math.PI;
      svg.appendChild(element("rect", { x: -1, y: -1, width: 2, height: 2, rx: .3, "class": "rj111-garage",
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
    svg.appendChild(lib);
    var tout = svg.getBBox();   // la voie peut déborder du cadre de la piste
    var plein = { x: tout.x - 4, y: tout.y - 4, w: tout.width + 8, h: tout.height + 8 };
    svg.setAttribute("viewBox", [plein.x, plein.y, plein.w, plein.h].join(" "));
    decors(svg, defs, L, repere, plein, PLEIN);

    var groupe = element("g", { "class": "rj111-voitures" });
    svg.appendChild(groupe);
    var etiquette = element("text", { "class": "rj111-etiquette" });
    svg.appendChild(etiquette);

    voitures = {};
    return { circuit: circuit, svg: svg, piste: piste, longueur: L, groupe: groupe, etiquette: etiquette, stand: stand, plein: plein, cam: null,
             tour: c.querySelector(".rj111-tour"), tours: c.querySelector(".rj111-tours"), mode: c.querySelector(".rj111-mode"), majTour: 0, neutre: c.querySelector(".rj111-neutre") };
  }

  /* Une voiture : un rond aux couleurs de l'écurie, avec les initiales du pilote. */
  function pastille(joueur, autre, teinte, nom) {
    var g = element("g", { "class": "rj111-voiture" + (joueur ? " rj111-joueur" : "") + (autre ? " rj111-autre" : "") });
    var rayon = joueur ? 1.9 : autre ? 1.1 : 1.6;
    g.appendChild(element("circle", { r: rayon, fill: teinte, "class": "rj111-caisse" }));
    if (!autre) {
      var t = element("text", { y: 0.42, "class": "rj111-initiales", "font-size": joueur ? 1.35 : 1.15 });
      t.textContent = abrege(nom);
      g.appendChild(t);
    }
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

  function camera(joueur, e) {
    var P = vue.plein, svg = vue.svg;
    if (!zoom || !joueur || e.fini) {
      if (vue.cam !== "plein") { svg.setAttribute("viewBox", [P.x, P.y, P.w, P.h].join(" ")); vue.cam = "plein"; }
      return;
    }
    var rc = svg.getBoundingClientRect(), asp = rc.width > 0 && rc.height > 0 ? rc.width / rc.height : 1.6;
    var W = Math.max(60, Math.min(100, Math.max(P.w, P.h) * 0.6)), H = W / asp;
    var c = vue.cam && vue.cam !== "plein" ? vue.cam : { x: joueur.x, y: joueur.y };
    // suit le joueur en douceur ; s il sort du cadre (images espacées), on recadre d un coup
    if (Math.abs(joueur.x - c.x) > W * 0.35 || Math.abs(joueur.y - c.y) > H * 0.35) { c.x = joueur.x; c.y = joueur.y; }
    else { c.x += (joueur.x - c.x) * 0.25; c.y += (joueur.y - c.y) * 0.25; }
    vue.cam = c;
    svg.setAttribute("viewBox", [(c.x - W / 2).toFixed(2), (c.y - H / 2).toFixed(2), W.toFixed(2), H.toFixed(2)].join(" "));
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
      r.p = r.stand ? vue.stand.place(r.rang) : vue.piste.getPointAtLength(ici);
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
      var q = vue.piste.getPointAtLength(Math.min(vue.longueur, r.ici + 0.8)), tx = q.x - r.p.x, ty = q.y - r.p.y, nn = Math.hypot(tx, ty) || 1;
      r.p = { x: r.p.x - ty / nn * r.lat, y: r.p.y + tx / nn * r.lat };
    });
    Object.keys(presents).forEach(function (nom) {
      var r = voitures[nom];
      r.x = r.p.x; r.y = r.p.y;
      r.el.setAttribute("transform", "translate(" + r.x.toFixed(2) + "," + r.y.toFixed(2) + ")");
    });
    camera(joueur, e);
    Object.keys(voitures).forEach(function (nom) {
      if (!presents[nom]) { voitures[nom].el.remove(); delete voitures[nom]; }
    });
    // Le joueur au premier plan, avec sa position.
    if (joueur) {
      vue.groupe.appendChild(joueur.el);
      vue.etiquette.setAttribute("x", (joueur.x + 2.4).toFixed(2));
      vue.etiquette.setAttribute("y", (joueur.y - 2.3).toFixed(2));
      vue.etiquette.textContent = "P" + joueur.pos;
    }
    if (t - vue.majTour > 250 || e.fini) {
      vue.majTour = t;
      majTourDeClassement(lr, e);
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
