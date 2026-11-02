/* =====================================================================
 * 111-vue-circuit.js — LA COURSE EN DIRECT, SUR LE TRACÉ
 *
 * Pendant la course, l'écran montre le circuit couru (getCircuitData().path)
 * avec ses secteurs et sa ligne d'arrivée, une silhouette par voiture aux
 * couleurs de son écurie, orientée dans le sens de la piste, et une tour de
 * classement en direct (position, écurie, écart au leader, tours de retard).
 * La voiture du joueur est plus grande, cerclée de blanc, avec sa position.
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

  function construire(c, circuit) {
    var donnees = typeof getCircuitData === "function" ? getCircuitData(circuit) : null;
    if (!donnees || !donnees.path) { c.hidden = true; return null; }
    c.hidden = false;
    c.innerHTML = '<div class="rj111-tete"><span class="rj111-nom">' + esc(circuit) + "</span>" +
      '<span class="rj111-neutre" hidden></span></div><div class="rj111-corps"><ol class="rj111-tour"></ol></div>';
    var corps = c.querySelector(".rj111-corps");

    var svg = element("svg", { "class": "rj111-svg", role: "img", "aria-label": "Course en direct sur " + circuit });
    corps.appendChild(svg);
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
    var stand = { x: r0.x + r0.nx * 9 + r0.tx * 8, y: r0.y + r0.ny * 9 + r0.ty * 8, w: 22, h: 7 };
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
             tour: c.querySelector(".rj111-tour"), majTour: 0, neutre: c.querySelector(".rj111-neutre") };
  }

  /* Une voiture : silhouette aux couleurs de l'écurie, orientée dans le sens de la piste. */
  function silhouette(joueur, autre, teinte) {
    var g = element("g", { "class": "rj111-voiture" + (joueur ? " rj111-joueur" : "") + (autre ? " rj111-autre" : "") });
    var l = joueur ? 4.4 : autre ? 2.6 : 3.4, h = joueur ? 2.2 : autre ? 1.3 : 1.7;
    g.appendChild(element("rect", { x: -l / 2, y: -h / 2, width: l, height: h, rx: h / 2.5, fill: teinte, "class": "rj111-caisse" }));
    g.appendChild(element("rect", { x: l / 2 - l * 0.28, y: -h / 2, width: l * 0.12, height: h, fill: "rgba(0,0,0,.45)" }));   // aileron avant
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

  /* Tour de classement : l'ordre sur la piste à cet instant (108). */
  function majTourDeClassement(lr, e) {
    var parNom = {};
    lr.drivers.forEach(function (d) { parNom[d.name] = d; });
    var vivants = e.voitures.filter(function (v) { return !v.abandon; })
      .sort(function (a, b) { return (a.autreCategorie - b.autreCategorie) || (a.pos - b.pos); });
    vue.tour.innerHTML = vivants.map(function (v, i) {
      var d = parNom[v.nom] || {};
      var tete = i === 0 || vivants[i - 1].autreCategorie !== v.autreCategorie;
      var ecart = tete ? "Leader"
        : v.ecart >= e.tempsTour ? "+" + Math.floor(v.ecart / e.tempsTour) + " T" : "+" + Math.max(0.1, v.ecart).toFixed(1);
      return '<li class="' + (v.joueur ? "moi" : "") + (v.autreCategorie ? " autre" : "") + (v.auStand ? " stand" : "") + '"><span class="p">' + v.pos + "</span>" +
        '<span class="c" style="background:' + couleur(d.team, v.nom) + '"></span>' +
        '<span class="n">' + esc(v.joueur ? "TOI" : abrege(v.nom)) + '</span><span class="e">' + (v.auStand ? "STAND" : ecart) + "</span></li>";
    }).join("");
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
        r = voitures[cle] = { el: silhouette(v.joueur, v.autreCategorie, couleur(d && d.team, cle)) };
        vue.groupe.appendChild(r.el);
      }
      r.d = v.distance; r.pos = v.pos; r.stand = v.auStand; r.autre = v.autreCategorie;
      if (v.joueur) joueur = r;
      var lg = vue.longueur, ici = (((r.d % 1) + 1) % 1) * lg;
      var p = r.stand ? vue.stand : vue.piste.getPointAtLength(ici);
      var q = r.stand ? { x: p.x + 1, y: p.y } : vue.piste.getPointAtLength(Math.min(lg, ici + 0.8));
      var cap = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI;
      r.x = p.x; r.y = p.y;
      r.el.setAttribute("transform", "translate(" + p.x.toFixed(2) + "," + p.y.toFixed(2) + ") rotate(" + cap.toFixed(1) + ")");
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
