/* =====================================================================
 * 111-vue-circuit.js — LA COURSE EN DIRECT, SUR LE TRACÉ
 *
 * Pendant la course, l'écran montre le circuit couru (getCircuitData().path)
 * et un point par voiture, aux couleurs de son écurie : ils avancent,
 * se dépassent, passent par la case des stands, disparaissent à l'abandon.
 * Le point du joueur est plus gros, cerclé de blanc, avec sa position.
 *
 * POSITIONS
 * RJModelePiste.etat() (108) donne la distance de chaque voiture en tours.
 * Elle saute à chaque tour, quand le moteur recalcule les écarts : la vue
 * lisse donc la course vers la cible et n'autorise jamais de recul. Une
 * voiture qui perd du terrain marque le pas pendant que les autres passent,
 * ce qui se lit comme un dépassement.
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
  var RAPPEL = 8;          // vitesse de rattrapage de la cible, par seconde
  var ARRET_MIN = 1200;    // un passage au stand reste visible au moins 1,2 s
  var vue = null;          // carte construite pour un circuit
  var voitures = {};       // nom → { el, d, stand, x, y, pos, autre }
  var boucle = 0, dernier = 0;

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

  function construire(c, circuit) {
    var donnees = typeof getCircuitData === "function" ? getCircuitData(circuit) : null;
    if (!donnees || !donnees.path) { c.hidden = true; return null; }
    c.hidden = false;
    c.innerHTML = '<div class="rj111-tete"><span class="rj111-nom">' + esc(circuit) + "</span>" +
      '<span class="rj111-neutre" hidden></span></div>';

    var svg = element("svg", { "class": "rj111-svg", role: "img", "aria-label": "Course en direct sur " + circuit });
    c.appendChild(svg);
    svg.appendChild(element("path", { d: donnees.path, "class": "rj111-bord" }));
    var piste = element("path", { d: donnees.path, "class": "rj111-piste" });
    svg.appendChild(piste);

    var L = piste.getTotalLength(), b = piste.getBBox(), marge = 9;
    svg.setAttribute("viewBox", [b.x - marge, b.y - marge, b.width + 2 * marge, b.height + 2 * marge].join(" "));

    // Ligne de départ, perpendiculaire au tracé ; case des stands juste après,
    // côté intérieur du circuit.
    var p0 = piste.getPointAtLength(0), p1 = piste.getPointAtLength(Math.min(2, L));
    var tx = p1.x - p0.x, ty = p1.y - p0.y, n = Math.hypot(tx, ty) || 1;
    tx /= n; ty /= n;
    var nx = -ty, ny = tx;
    var cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    if ((cx - p0.x) * nx + (cy - p0.y) * ny < 0) { nx = -nx; ny = -ny; }
    svg.appendChild(element("line", { x1: p0.x - nx * 4, y1: p0.y - ny * 4, x2: p0.x + nx * 4, y2: p0.y + ny * 4, "class": "rj111-ligne" }));
    var stand = { x: p0.x + nx * 9 + tx * 8, y: p0.y + ny * 9 + ty * 8, w: 22, h: 7 };
    svg.appendChild(element("rect", { x: stand.x - stand.w / 2, y: stand.y - stand.h / 2, width: stand.w, height: stand.h, rx: 1.5, "class": "rj111-stand" }));
    var lib = element("text", { x: stand.x, y: stand.y + stand.h / 2 + 4.5, "class": "rj111-stand-lib" });
    lib.textContent = "STAND";
    svg.appendChild(lib);

    var groupe = element("g", { "class": "rj111-voitures" });
    svg.appendChild(groupe);
    var etiquette = element("text", { "class": "rj111-etiquette" });
    svg.appendChild(etiquette);

    voitures = {};
    return { circuit: circuit, svg: svg, piste: piste, longueur: L, groupe: groupe, etiquette: etiquette, stand: stand,
             neutre: c.querySelector(".rj111-neutre") };
  }

  /* --- Une image ---------------------------------------------------------- */
  function visible() {
    var ecran = document.getElementById("S-race"), c = document.getElementById("rj111-carte");
    return !!(ecran && ecran.classList.contains("on") && c && c.offsetParent !== null && document.visibilityState !== "hidden");
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

    var dt = dernier ? Math.min(0.25, (t - dernier) / 1000) : 0;
    dernier = t;
    var presents = {}, joueur = null, enPiste = [];
    e.voitures.forEach(function (v, i) {
      var d = lr.drivers[i];
      if (v.abandon || v.distance === null) return;
      var cle = v.nom || (v.joueur ? "joueur" : "#" + i);
      presents[cle] = true;
      var r = voitures[cle];
      if (!r) {
        r = voitures[cle] = { d: v.distance, el: element("circle", { "class": "rj111-voiture" + (v.joueur ? " rj111-joueur" : "") + (v.autreCategorie ? " rj111-autre" : ""), r: v.joueur ? 3 : (v.autreCategorie ? 1.5 : 2.1) }) };
        r.el.setAttribute("fill", couleur(d && d.team, cle));
        vue.groupe.appendChild(r.el);
      }
      if (v.auStand && !r.stand) r.standJusqua = t + ARRET_MIN;
      r.pos = v.pos; r.stand = v.auStand || t < (r.standJusqua || 0); r.autre = v.autreCategorie;
      r.cible = v.distance;
      if (v.joueur) joueur = r;
      enPiste.push(r);
    });

    /* Avancée, dans l'ordre du classement de chaque catégorie : une voiture
       rattrape sa cible sans jamais reculer, et ne dépasse pas à l'écran la
       voiture classée devant elle (elle se cale derrière). Un dépassement ne
       se voit donc que lorsque le classement change. */
    enPiste.sort(function (a, b) { return (a.autre - b.autre) || (a.pos - b.pos); });
    var devant = null;
    enPiste.forEach(function (r) {
      if (devant && devant.autre !== r.autre) devant = null;
      var vise = r.d + Math.max(0, r.cible - r.d) * Math.min(1, dt * RAPPEL);
      if (devant && !r.stand) vise = Math.min(vise, devant.d - 0.004);
      r.d = Math.max(r.d, vise);
      if (!r.stand) devant = r;
      var p = r.stand ? vue.stand : vue.piste.getPointAtLength((((r.d % 1) + 1) % 1) * vue.longueur);
      r.x = p.x; r.y = p.y;
      r.el.setAttribute("cx", p.x.toFixed(2));
      r.el.setAttribute("cy", p.y.toFixed(2));
    });
    Object.keys(voitures).forEach(function (nom) {
      if (!presents[nom]) { voitures[nom].el.remove(); delete voitures[nom]; }
    });
    // Le joueur au premier plan, avec sa position.
    if (joueur) {
      vue.groupe.appendChild(joueur.el);
      vue.etiquette.setAttribute("x", (joueur.x + 4).toFixed(2));
      vue.etiquette.setAttribute("y", (joueur.y - 3.5).toFixed(2));
      vue.etiquette.textContent = "P" + joueur.pos;
    }
    var n = lr._rjNeutral && lr._rjNeutral.active ? lr._rjNeutral : null;
    vue.neutre.hidden = !n;
    if (n) vue.neutre.textContent = String(n.type || "SC").toUpperCase();

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
    window.RJVueCircuit = { actif: function () { return !!boucle; }, etat: etat };
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
