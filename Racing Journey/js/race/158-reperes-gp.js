/* =====================================================================
 * 158-reperes-gp.js — CHAQUE GRAND PRIX A SON VISAGE
 *
 * POURQUOI
 * Depuis v297, le décor de la vue course suit le TYPE de lieu (port, ville,
 * désert, forêt, dunes, campagne). Mais Suzuka ressemblait à Silverstone,
 * Las Vegas à Bakou : rien ne disait où l'on courait.
 *
 * CE QUE FAIT LE MODULE
 * Il ajoute au décor de chaque Grand Prix ses repères connus, dessinés dans
 * le style de la vue course (vu de dessus, ombre portée) :
 *   Monaco : casino et yachts · Singapour : trois tours coiffées d'un toit,
 *   grande roue, nuit · Suzuka : grande roue · Las Vegas : sphère géante,
 *   néons, tours · Monza : vieil anneau de vitesse, allée d'arbres ·
 *   Silverstone : pistes de l'ancien aérodrome · Austin : tour d'observation
 *   · Mexico et Miami : stade · Abu Dhabi : hôtel au treillis et marina ·
 *   Bakou : remparts et tours-flammes · Montréal : fleuve, bassin, dôme ·
 *   Melbourne : lac · Jeddah : corniche et palmiers · Zandvoort : mer ·
 *   Spielberg : sommets · Spa, Mugello, Portimao : villages et reliefs · Paul Ricard : dégagements
 *   rayés · São Paulo : toits colorés · Sepang : tribune-feuille, palmiers…
 * Chaque repère est posé une fois, à la place libre la plus proche de la
 * piste ; la côte suit le tracé, et les arbres lui laissent la place.
 *
 * Appelé par 111 à la fin du décor (RJReperesGP.poser). Aucun état.
 * Plus tard, un repère pourra être remplacé par une image (img/gp/).
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[158-reperes]";

  /* ---------- Peintres : un repère centré sur (0,0), en unités de piste (piste = 7) ---------- */
  var P = {
    ombre: function (E, g, forme, attrs) { var o = E(forme, attrs); o.setAttribute("fill", "rgba(0,0,0,.28)"); o.setAttribute("transform", "translate(1.4,1.6)"); g.appendChild(o); },

    grandeRoue: function (E, g) {
      var r = 9;
      g.appendChild(E("rect", { x: -r * .9, y: r * .9, width: r * 1.8, height: 2.2, fill: "#6b7280", rx: .4 }));
      g.appendChild(E("circle", { r: r + .8, fill: "none", stroke: "rgba(0,0,0,.25)", "stroke-width": 1.4, transform: "translate(1.4,1.6)" }));
      g.appendChild(E("circle", { r: r, fill: "none", stroke: "#e5e7eb", "stroke-width": .9 }));
      g.appendChild(E("circle", { r: r * .25, fill: "#e5e7eb" }));
      for (var i = 0; i < 16; i++) {
        var a = i * Math.PI / 8, x = Math.cos(a) * r, y = Math.sin(a) * r;
        g.appendChild(E("line", { x1: 0, y1: 0, x2: x.toFixed(2), y2: y.toFixed(2), stroke: "rgba(229,231,235,.6)", "stroke-width": .25 }));
        g.appendChild(E("circle", { cx: x.toFixed(2), cy: y.toFixed(2), r: .9, fill: ["#ef4444", "#f59e0b", "#3b82f6", "#10b981"][i % 4] }));
      }
    },
    tour: function (E, g) {   // tour d'observation : ombre très longue, plateforme ronde
      g.appendChild(E("path", { d: "M0,0 L16,10 L15,12 L-1,2 Z", fill: "rgba(0,0,0,.3)" }));
      g.appendChild(E("circle", { r: 3.2, fill: "#9ca3af" }));
      g.appendChild(E("circle", { r: 2.2, fill: "#ef4444" }));
      g.appendChild(E("circle", { r: .8, fill: "#f3f4f6" }));
    },
    stade: function (E, g) {
      var w = 22, h = 15;
      P.ombre(E, g, "ellipse", { rx: w, ry: h });
      g.appendChild(E("ellipse", { rx: w, ry: h, fill: "#d1d5db" }));
      g.appendChild(E("ellipse", { rx: w * .86, ry: h * .8, fill: "#64748b" }));
      for (var i = 0; i < 3; i++) g.appendChild(E("ellipse", { rx: w * (.8 - i * .07), ry: h * (.74 - i * .07), fill: "none", stroke: i % 2 ? "#ef4444" : "#3b82f6", "stroke-width": .5, opacity: .7 }));
      g.appendChild(E("rect", { x: -w * .45, y: -h * .35, width: w * .9, height: h * .7, rx: 2, fill: "#2f7d3c" }));
      g.appendChild(E("rect", { x: -w * .45, y: -h * .35, width: w * .9, height: h * .7, rx: 2, fill: "none", stroke: "rgba(255,255,255,.5)", "stroke-width": .3 }));
    },
    sphere: function (E, g) {
      var r = 11;
      g.appendChild(E("circle", { r: r + 4, fill: "rgba(168,85,247,.18)" }));
      g.appendChild(E("circle", { r: r, fill: "#1e1b4b" }));
      g.appendChild(E("circle", { r: r * .92, fill: "#7c3aed" }));
      g.appendChild(E("circle", { cx: -r * .3, cy: -r * .3, r: r * .55, fill: "#a78bfa", opacity: .7 }));
      g.appendChild(E("circle", { cx: -r * .4, cy: -r * .4, r: r * .2, fill: "#f5f3ff", opacity: .8 }));
    },
    casino: function (E, g) {
      P.ombre(E, g, "rect", { x: -9, y: -6, width: 18, height: 12 });
      g.appendChild(E("rect", { x: -9, y: -6, width: 18, height: 12, rx: .6, fill: "#e8dcc4" }));
      g.appendChild(E("rect", { x: -9, y: -6, width: 18, height: 2.2, fill: "#c9b48c" }));
      g.appendChild(E("circle", { cx: -5, cy: 1, r: 2.4, fill: "#5b7f6e" }));   // coupoles vert-de-gris
      g.appendChild(E("circle", { cx: 5, cy: 1, r: 2.4, fill: "#5b7f6e" }));
      g.appendChild(E("rect", { x: -7, y: 7.5, width: 14, height: 7, rx: 3, fill: "#3f8f4a" }));   // jardins
      g.appendChild(E("circle", { cx: 0, cy: 11, r: 1.6, fill: "#7dd3fc" }));
    },
    yachts: function (E, g) {       // une marina : bassin, quai et bateaux
      g.appendChild(E("rect", { x: -9, y: -11.5, width: 18, height: 23, rx: 1.5, fill: "#94a3b8" }));
      g.appendChild(E("rect", { x: -8, y: -10.5, width: 16, height: 21, rx: 1, fill: "url(#rj111-vagues)" }));
      for (var i = 0; i < 5; i++) {
        var y = (i - 2) * 4.2;
        g.appendChild(E("path", { d: "M-6," + (y - 1.2) + " L4," + (y - 1.2) + " L6.5," + y + " L4," + (y + 1.2) + " L-6," + (y + 1.2) + " Z", fill: "#f8fafc" }));
        g.appendChild(E("rect", { x: -4, y: y - .6, width: 6, height: 1.2, rx: .3, fill: "#94a3b8" }));
      }
    },
    marinaBay: function (E, g) {   // trois tours reliées par un toit en forme de bateau
      [-6, 0, 6].forEach(function (x) { P.ombre(E, g, "rect", { x: x - 2.2, y: -8, width: 4.4, height: 16 }); });
      [-6, 0, 6].forEach(function (x) { g.appendChild(E("rect", { x: x - 2.2, y: -8, width: 4.4, height: 16, rx: .5, fill: "#cbd5e1" })); });
      g.appendChild(E("path", { d: "M-11,-1.6 L12,-1.6 L14,0 L12,1.6 L-11,1.6 Z", fill: "#334155" }));
      g.appendChild(E("rect", { x: -8, y: -.7, width: 12, height: 1.4, fill: "#38bdf8" }));   // piscine
    },
    hotelYas: function (E, g) {    // hôtel enjambant la piste : treillis lumineux
      P.ombre(E, g, "rect", { x: -16, y: -4, width: 32, height: 8 });
      g.appendChild(E("rect", { x: -16, y: -4, width: 32, height: 8, rx: 4, fill: "#0f172a" }));
      for (var x = -14; x <= 14; x += 2.4) g.appendChild(E("line", { x1: x, y1: -4, x2: x + 2, y2: 4, stroke: "#67e8f9", "stroke-width": .35, opacity: .85 }));
      for (var x2 = -14; x2 <= 14; x2 += 2.4) g.appendChild(E("line", { x1: x2 + 2, y1: -4, x2: x2, y2: 4, stroke: "#c084fc", "stroke-width": .35, opacity: .85 }));
    },
    flammes: function (E, g) {     // trois tours en forme de flamme
      [[-6, 1, 1], [0, -1, 1.25], [6, 1.5, 1]].forEach(function (t) {
        var x = t[0], y = t[1], s = t[2];
        var d = "M" + x + "," + (y - 6 * s) + " C" + (x + 3.4 * s) + "," + (y - 2 * s) + " " + (x + 3 * s) + "," + (y + 4 * s) + " " + x + "," + (y + 5 * s) +
                " C" + (x - 3 * s) + "," + (y + 4 * s) + " " + (x - 3.4 * s) + "," + (y - 2 * s) + " " + x + "," + (y - 6 * s) + " Z";
        var o = E("path", { d: d, fill: "rgba(0,0,0,.3)", transform: "translate(1.4,1.6)" }); g.appendChild(o);
        g.appendChild(E("path", { d: d, fill: "#38bdf8" }));
        g.appendChild(E("path", { d: d, fill: "none", stroke: "#f97316", "stroke-width": .5 }));
      });
    },
    remparts: function (E, g) {    // vieille ville : mur crénelé, tour ronde
      var d = "M-18,4 L-10,-2 L0,-3 L10,-1 L18,5";
      g.appendChild(E("path", { d: d, fill: "none", stroke: "rgba(0,0,0,.3)", "stroke-width": 2.4, transform: "translate(1.2,1.4)" }));
      g.appendChild(E("path", { d: d, fill: "none", stroke: "#c9a26b", "stroke-width": 2.2 }));
      g.appendChild(E("path", { d: d, fill: "none", stroke: "#8b6b3d", "stroke-width": 2.2, "stroke-dasharray": ".9 .9", opacity: .7 }));
      P.ombre(E, g, "circle", { cx: -4, cy: 7, r: 3.6 });
      g.appendChild(E("circle", { cx: -4, cy: 7, r: 3.6, fill: "#d6b27c" }));
      g.appendChild(E("circle", { cx: -4, cy: 7, r: 2.2, fill: "#b38b52" }));
    },
    dome: function (E, g) {        // dôme géodésique
      g.appendChild(E("circle", { r: 7, fill: "rgba(0,0,0,.25)", transform: "translate(1.4,1.6)" }));
      g.appendChild(E("circle", { r: 7, fill: "#cbd5e1" }));
      for (var i = -3; i <= 3; i++) {
        g.appendChild(E("line", { x1: i * 2, y1: -7, x2: i * 2, y2: 7, stroke: "#64748b", "stroke-width": .25 }));
        g.appendChild(E("line", { x1: -7, y1: i * 2, x2: 7, y2: i * 2, stroke: "#64748b", "stroke-width": .25 }));
      }
      g.appendChild(E("circle", { r: 7, fill: "none", stroke: "#475569", "stroke-width": .6 }));
    },
    anneau: function (E, g) {      // vieil anneau de vitesse relevé
      g.appendChild(E("path", { d: "M-26,10 Q0,-14 26,10", fill: "none", stroke: "rgba(0,0,0,.3)", "stroke-width": 5.5, transform: "translate(1.4,1.6)" }));
      g.appendChild(E("path", { d: "M-26,10 Q0,-14 26,10", fill: "none", stroke: "#a8a29e", "stroke-width": 5 }));
      g.appendChild(E("path", { d: "M-26,10 Q0,-14 26,10", fill: "none", stroke: "#78716c", "stroke-width": .5, "stroke-dasharray": "3 2" }));
    },
    aerodrome: function (E, g) {   // pistes croisées d'un ancien aérodrome
      [[0, 60], [0, -15]].forEach(function (t) {
        var r = E("g", { transform: "rotate(" + t[1] + ")" });
        r.appendChild(E("rect", { x: -34, y: -2.6, width: 68, height: 5.2, fill: "#8a8f98", opacity: .75 }));
        r.appendChild(E("line", { x1: -32, y1: 0, x2: 32, y2: 0, stroke: "#f8fafc", "stroke-width": .35, "stroke-dasharray": "2.4 2", opacity: .8 }));
        g.appendChild(r);
      });
    },
    lac: function (E, g) {
      var rx = 20, ry = 9;
      g.appendChild(E("ellipse", { rx: rx + 1.6, ry: ry + 1.6, fill: "#c2b280", opacity: .7 }));
      g.appendChild(E("ellipse", { rx: rx, ry: ry, fill: "url(#rj111-vagues)" }));
    },
    favelas: function (E, g, hache) {
      var c = ["#f87171", "#fbbf24", "#60a5fa", "#34d399", "#f472b6", "#e5e7eb", "#fb923c"];
      for (var i = 0; i < 42; i++) {
        var x = (i % 7) * 3.1 - 10, y = Math.floor(i / 7) * 3 - 9, j = hache(i * 7.3);
        g.appendChild(E("rect", { x: (x + j).toFixed(1), y: (y + hache(i * 3.1)).toFixed(1), width: 2.5, height: 2.3, fill: c[i % c.length], opacity: .9 }));
      }
    },
    tribuneFeuille: function (E, g) {   // tribune au toit en feuilles
      for (var i = -2; i <= 2; i++) {
        g.appendChild(E("path", { d: "M" + (i * 6) + ",-5 Q" + (i * 6 + 4) + ",0 " + (i * 6) + ",5 Q" + (i * 6 - 4) + ",0 " + (i * 6) + ",-5 Z", fill: "rgba(0,0,0,.25)", transform: "translate(1.2,1.4)" }));
        g.appendChild(E("path", { d: "M" + (i * 6) + ",-5 Q" + (i * 6 + 4) + ",0 " + (i * 6) + ",5 Q" + (i * 6 - 4) + ",0 " + (i * 6) + ",-5 Z", fill: "#f1f5f9" }));
      }
    },
    chateau: function (E, g) {
      P.ombre(E, g, "rect", { x: -7, y: -5, width: 14, height: 10 });
      g.appendChild(E("rect", { x: -7, y: -5, width: 14, height: 10, fill: "#a8a29e" }));
      g.appendChild(E("rect", { x: -4.5, y: -2.5, width: 9, height: 5, fill: "#57534e" }));
      [[-7, -5], [7, -5], [-7, 5], [7, 5]].forEach(function (p) { g.appendChild(E("circle", { cx: p[0], cy: p[1], r: 1.8, fill: "#d6d3d1" })); });
    },
    pont: function (E, g) {        // passerelle-tribune qui enjambe la piste
      P.ombre(E, g, "rect", { x: -4, y: -14, width: 8, height: 28 });
      g.appendChild(E("rect", { x: -4, y: -14, width: 8, height: 28, rx: 1, fill: "#e2e8f0" }));
      g.appendChild(E("rect", { x: -3, y: -13, width: 6, height: 26, fill: "#3b82f6", opacity: .55 }));
    },
    gratteCiel: function (E, g, hache, couleurs) {
      couleurs = couleurs || ["#94a3b8", "#cbd5e1", "#64748b", "#e2e8f0"];
      for (var i = 0; i < 6; i++) {
        var w = 3.5 + hache(i * 2.3) * 3, h = 3.5 + hache(i * 5.1) * 4, x = (i % 3) * 7 - 9, y = Math.floor(i / 3) * 8 - 4;
        g.appendChild(E("rect", { x: x + 2, y: y + 2.4, width: w, height: h, fill: "rgba(0,0,0,.35)" }));
        g.appendChild(E("rect", { x: x, y: y, width: w, height: h, rx: .3, fill: couleurs[i % couleurs.length] }));
        g.appendChild(E("rect", { x: x + w * .25, y: y + h * .25, width: w * .5, height: h * .5, fill: "rgba(255,255,255,.18)" }));
      }
    },
    neons: function (E, g) {
      ["#f472b6", "#22d3ee", "#facc15", "#a78bfa"].forEach(function (c, i) {
        g.appendChild(E("rect", { x: -14, y: i * 3 - 5, width: 28, height: .8, rx: .4, fill: c, opacity: .9 }));
        g.appendChild(E("rect", { x: -14, y: i * 3 - 5.6, width: 28, height: 2, rx: 1, fill: c, opacity: .22 }));
      });
    },
    palmiers: function (E, g) {
      for (var i = 0; i < 5; i++) {
        var p = E("g", { transform: "translate(" + (i * 5 - 10) + ",0) scale(1.4)" });
        p.appendChild(E("circle", { cx: .6, cy: .6, r: 1.5, fill: "rgba(0,0,0,.25)" }));
        p.appendChild(E("path", { d: "M0,-2 l.6,1.4 1.4,.6 -1.4,.6 -.6,1.4 -.6,-1.4 -1.4,-.6 1.4,-.6 Z", fill: "#3f9b4f" }));
        g.appendChild(p);
      }
    },
    rayures: function (E, g) {     // dégagements rayés bleu et rouge
      for (var i = -6; i <= 6; i++) g.appendChild(E("rect", { x: i * 3, y: -4, width: 1.5, height: 8, fill: i % 2 ? "#dc2626" : "#1d4ed8", opacity: .85 }));
    },
    montagnes: function (E, g) {   // sommets enneigés vus de dessus
      [[-9, 3, 12], [7, -4, 13], [8, 9, 9]].forEach(function (m) {
        var x = m[0], y = m[1], r = m[2], t = function (k) { return "M" + x + "," + (y - r * k) + " L" + (x + r * k) + "," + (y - r * .1 * k) + " L" + (x + r * .5 * k) + "," + (y + r * .8 * k) + " L" + (x - r * .6 * k) + "," + (y + r * .7 * k) + " L" + (x - r * k) + "," + (y - r * .2 * k) + " Z"; };
        g.appendChild(E("path", { d: t(1), fill: "#57534e" }));
        g.appendChild(E("path", { d: t(.66), fill: "#8a8580" }));
        g.appendChild(E("path", { d: t(.36), fill: "#f8fafc" }));
      });
    },
    moulin: function (E, g) {
      P.ombre(E, g, "circle", { r: 4 });
      g.appendChild(E("circle", { r: 4, fill: "#b45309" }));
      g.appendChild(E("circle", { r: 2.4, fill: "#78350f" }));
      for (var i = 0; i < 4; i++) g.appendChild(E("path", { d: "M-.35,0 L-.35,-9 L2,-9 L2,-2.5 L.35,-2 Z", fill: "#f8fafc", stroke: "#78716c", "stroke-width": .3, transform: "rotate(" + (i * 90 + 25) + ")" }));
    },
    mosquee: function (E, g) {
      P.ombre(E, g, "rect", { x: -7, y: -7, width: 14, height: 14 });
      g.appendChild(E("rect", { x: -7, y: -7, width: 14, height: 14, fill: "#e7e5e4" }));
      g.appendChild(E("circle", { r: 4.6, fill: "#0e7490" })); g.appendChild(E("circle", { cx: -1.2, cy: -1.2, r: 1.8, fill: "#67e8f9", opacity: .6 }));
      [[-8, -8], [8, -8], [-8, 8], [8, 8]].forEach(function (p) { g.appendChild(E("circle", { cx: p[0], cy: p[1], r: 1.4, fill: "#f5f5f4", stroke: "#0e7490", "stroke-width": .5 })); });
    },
    basilique: function (E, g) {   // croix latine et flèches
      P.ombre(E, g, "rect", { x: -4, y: -10, width: 8, height: 20 });
      g.appendChild(E("rect", { x: -4, y: -10, width: 8, height: 20, fill: "#d6b27c" })); g.appendChild(E("rect", { x: -9, y: -5, width: 18, height: 7, fill: "#d6b27c" }));
      [[-3, -9], [3, -9], [-3, 9], [3, 9], [-8, -1.5], [8, -1.5], [0, -1.5]].forEach(function (p, i) { g.appendChild(E("circle", { cx: p[0], cy: p[1], r: i === 6 ? 2.6 : 1.5, fill: "#92704a", stroke: "#f5e6c8", "stroke-width": .4 })); });
    },
    pyramide: function (E, g) {
      P.ombre(E, g, "rect", { x: -9, y: -9, width: 18, height: 18 });
      for (var i = 0; i < 5; i++) { var r = 9 - i * 1.7; g.appendChild(E("rect", { x: -r, y: -r, width: 2 * r, height: 2 * r, fill: ["#8b7355", "#9c8462", "#ad9570", "#bea67e", "#d6c29c"][i] })); }
      g.appendChild(E("rect", { x: -1.2, y: 0, width: 2.4, height: 9, fill: "#e7d9b8" }));
    },
    pagode: function (E, g) {
      P.ombre(E, g, "rect", { x: -8, y: -8, width: 16, height: 16 });
      [8, 5.6, 3.2].forEach(function (r, i) { g.appendChild(E("rect", { x: -r, y: -r, width: 2 * r, height: 2 * r, rx: .6, fill: i % 2 ? "#dc2626" : "#991b1b", stroke: "#facc15", "stroke-width": .6 })); });
      g.appendChild(E("circle", { r: 1.3, fill: "#facc15" }));
    },
    tentes: function (E, g) {
      [[-8, -3], [0, 4], [8, -4]].forEach(function (p) {
        g.appendChild(E("path", { d: "M" + (p[0] - 5) + "," + (p[1] + 4) + " L" + p[0] + "," + (p[1] - 5) + " L" + (p[0] + 5) + "," + (p[1] + 4) + " Z", fill: "#f5efe0" }));
        g.appendChild(E("path", { d: "M" + p[0] + "," + (p[1] - 5) + " L" + (p[0] + 5) + "," + (p[1] + 4) + " L" + p[0] + "," + (p[1] + 4) + " Z", fill: "#7f1d3a" }));
      });
    },
    toursPenchees: function (E, g) {
      [-1, 1].forEach(function (s) {
        g.appendChild(E("path", { d: "M" + s * 9 + ",7 L" + s * 4 + ",7 L" + s * .8 + ",-8 L" + s * 5.8 + ",-8 Z", fill: "#475569", stroke: "#cbd5e1", "stroke-width": .5 }));
        g.appendChild(E("rect", { x: s * 3.3 - 2.5, y: -8, width: 5, height: 3, fill: "#94a3b8" }));
      });
    },
    village: function (E, g, hache, mur, toit) {
      for (var i = 0; i < 14; i++) {
        var a = i * 2.4, r = 2.6 * Math.sqrt(i) + 1, x = Math.cos(a) * r, y = Math.sin(a) * r;
        g.appendChild(E("rect", { x: -1.3, y: -1, width: 3.2, height: 2.4, fill: "rgba(0,0,0,.3)", transform: "translate(" + (x + .5).toFixed(1) + "," + (y + .6).toFixed(1) + ")" }));
        var m = E("g", { transform: "translate(" + x.toFixed(1) + "," + y.toFixed(1) + ") rotate(" + Math.round(hache(i * 3.3) * 60 - 30) + ")" });
        m.appendChild(E("rect", { x: -1.6, y: -1.2, width: 3.2, height: 2.4, fill: toit })); m.appendChild(E("rect", { x: -1.6, y: 0, width: 3.2, height: 1.2, fill: mur, opacity: .55 }));
        g.appendChild(m);
      }
      g.appendChild(E("rect", { x: -1.4, y: -1.4, width: 2.8, height: 2.8, fill: mur })); g.appendChild(E("path", { d: "M0,-2 L2,0 L0,2 L-2,0 Z", fill: toit }));
    },
    villageArdoise: function (E, g, h) { P.village(E, g, h, "#94a3b8", "#334155"); },
    villageOcre: function (E, g, h) { P.village(E, g, h, "#fcd9a0", "#c2703d"); },
    villageBlanc: function (E, g, h) { P.village(E, g, h, "#ffffff", "#e8e4dc"); },
    villageRouge: function (E, g, h) { P.village(E, g, h, "#fef3c7", "#b91c1c"); }
  };

  /* ---------- Fonds : juste au-dessus du sol, sous les arbres ---------- */
  var RIVE = 15;   // terre ferme gardée de part et d'autre de la piste
  function poserFond(c, el) { c.sous.insertBefore(el, c.sous.children[1] || null); }
  function reliefs(c) {
    for (var i = 0; i < 9; i++) {
      var x = c.plein.x + c.hache(i * 11.1) * c.plein.w, y = c.plein.y + c.hache(i * 17.3) * c.plein.h;
      poserFond(c, c.E("ellipse", { cx: x.toFixed(1), cy: y.toFixed(1), rx: (25 + c.hache(i * 3.7) * 30).toFixed(1), ry: (16 + c.hache(i * 5.3) * 20).toFixed(1), fill: i % 2 ? "rgba(0,0,0,.16)" : "rgba(255,255,255,.07)" }));
    }
  }
  function savane(c) { poserFond(c, c.E("rect", { x: c.plein.x - 80, y: c.plein.y - 80, width: c.plein.w + 160, height: c.plein.h + 160, fill: "rgba(196,160,80,.28)" })); }
  /* L'eau : une étendue d'un côté (ou partout : île), puis la terre redessinée le long du
     tracé et à l'intérieur : la côte suit le circuit, la piste n'est jamais sur l'eau. */
  function eau(c, ou) {
    var p = c.plein, z = { x: p.x - 160, y: p.y - 160, w: p.w + 320, h: p.h + 320 };
    if (ou === "bas") { z.y = p.y + p.h * .6; z.h = p.h * .4 + 160; }
    if (ou === "gauche") z.w = 160 + p.w * .3;
    var piste = c.monde.querySelector(".rj111-piste"), sol = getComputedStyle(c.sous.children[0]).fill;
    var terre = c.E("path", { d: piste.getAttribute("d"), fill: sol, stroke: sol, "stroke-width": RIVE * 2, "stroke-linejoin": "round" });
    poserFond(c, terre);
    poserFond(c, c.E("rect", { x: z.x, y: z.y, width: z.w, height: z.h, fill: "url(#rj111-vagues)" }));
    // isPointInFill relance la mise en page à chaque arbre retiré (20 s à Singapour) : polygone calculé une fois
    var poly = []; for (var k = 0; k < c.L; k += 4) poly.push(c.repere(k));
    c.noye = function (x, y) {
      if (x < z.x || x > z.x + z.w || y < z.y || y > z.y + z.h || c.distPiste(x, y) < RIVE + 2) return false;
      for (var i = 0, j = poly.length - 1, dans = false; i < poly.length; j = i++)
        if ((poly[i].y > y) !== (poly[j].y > y) && x < (poly[j].x - poly[i].x) * (y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x) dans = !dans;
      return !dans;
    };
    vider(c, c.noye);
  }
  /* Retire arbres, immeubles et dunes là où « test » dit vrai. */
  function vider(c, test) {
    // centres lus une seule fois : mesurer après chaque retrait relançait la mise en page (1 à 2 s)
    if (!c.objets) c.objets = [].slice.call(c.sous.querySelectorAll(".rj111-arbres > *, .rj111-quartier > *, .rj111-dune")).map(function (e) {
      var b = e.getBBox(); return { e: e, x: b.x + b.width / 2, y: b.y + b.height / 2 };
    });
    c.objets = c.objets.filter(function (o) { if (!test(o.x, o.y)) return true; o.e.remove(); return false; });
  }
  var FONDS = { reliefs: reliefs, savane: savane, mer: function (c) { eau(c, "bas"); }, mergauche: function (c) { eau(c, "gauche"); }, ile: function (c) { eau(c, "ile"); } };

  /* ---------- Les Grands Prix : motif du nom, repères, fonds ---------- */
  var GP = [
    [/monaco/i, ["casino", "yachts"], []],
    [/singap/i, ["marinaBay", "grandeRoue"], ["mer"]],
    [/suzuka/i, ["grandeRoue"], ["reliefs"]],
    [/las vegas/i, ["sphere", "neons"], []],
    [/monza/i, ["anneau"], []],
    [/silverstone/i, ["aerodrome"], []],
    [/austin/i, ["tour"], ["reliefs"]],
    [/mexico/i, ["stade", "pyramide"], []],
    [/miami/i, ["stade", "yachts", "palmiers"], []],
    [/abu dhabi/i, ["hotelYas", "yachts"], []],
    [/baku|bakou/i, ["flammes", "remparts"], []],
    [/montr/i, ["dome"], ["ile"]],
    [/melbourne/i, ["lac", "gratteCiel"], []],
    [/jeddah/i, ["mosquee", "palmiers"], ["mergauche"]],
    [/zandvoort/i, ["moulin"], ["mergauche"]],
    [/^spa$|francorchamps/i, ["villageArdoise"], ["reliefs"]],
    [/spielberg|red bull ring/i, ["montagnes"], ["reliefs"]],
    [/imola/i, ["chateau", "lac"], ["reliefs"]],
    [/mugello/i, ["villageOcre"], ["reliefs"]],
    [/portimao/i, ["villageBlanc"], ["reliefs"]],
    [/budapest|hungaroring/i, ["villageRouge", "lac"], ["reliefs"]],
    [/istanbul/i, ["mosquee"], ["reliefs"]],
    [/n[üu]rburg/i, ["chateau"], ["reliefs"]],
    [/paul ricard/i, ["rayures"], []],
    [/sao paulo|interlagos/i, ["favelas", "lac"], []],
    [/sepang/i, ["tribuneFeuille", "palmiers"], []],
    [/shanghai/i, ["pont", "gratteCiel"], []],
    [/bahrain|sakhir/i, ["tour", "palmiers"], []],
    [/qatar|losail/i, ["tentes"], []],
    [/kyalami/i, ["lac"], ["savane"]],
    [/madrid/i, ["toursPenchees"], []],
    [/macao|macau/i, ["pagode"], []],
    [/barcelon/i, ["basilique"], ["reliefs"]]
  ];
  function decorDe(nom) {
    var g = GP.filter(function (x) { return x[0].test(nom || ""); })[0];
    return g ? { reperes: g[1], fonds: g[2] } : { reperes: [], fonds: [] };
  }

  /* Rayon occupé par chaque repère, ombre comprise. */
  var TAILLE = { grandeRoue: 13, tour: 12, stade: 24, sphere: 15, casino: 14, yachts: 13, marinaBay: 14, hotelYas: 18, flammes: 11, remparts: 19,
    dome: 9, anneau: 28, aerodrome: 35, lac: 22, favelas: 14, tribuneFeuille: 17, chateau: 11, pont: 16, gratteCiel: 14, neons: 15, palmiers: 13, rayures: 20,
    montagnes: 22, moulin: 10, mosquee: 13, basilique: 13, pyramide: 11, pagode: 11, tentes: 15, toursPenchees: 12,
    villageArdoise: 14, villageOcre: 14, villageBlanc: 14, villageRouge: 14 };

  /* La place libre la plus proche de la piste : dans le cadre, hors de l'eau, loin de la ligne
     de départ (tribunes, stands) et des autres repères ; plus petit s'il n'y a pas la place. */
  function placer(c, type) {
    var p = c.plein, r0 = c.repere(0), ech = [1, .8, .6, .45];
    for (var k = 0; k < ech.length; k++) {
      var t = TAILLE[type] * ech[k], best = null;
      for (var x = p.x + t * .8; x <= p.x + p.w - t * .8; x += 3) for (var y = p.y + t * .8; y <= p.y + p.h - t * .8; y += 3) {
        if (Math.hypot(x - r0.x, y - r0.y) < t + 26) continue;
        var d = c.distPiste(x, y);
        if (d < t + c.DEMI + 2 || (best && d >= best.d)) continue;
        if (type !== "yachts" && c.noye && c.noye(x, y)) continue;
        if (c.pris.some(function (q) { return Math.hypot(q.x - x, q.y - y) < q.t + t; })) continue;
        best = { x: x, y: y, d: d, t: t, s: ech[k] };
      }
      if (best) return best;
    }
    return null;
  }

  function poser(c) {
    var d = c.ctx.lieu === "kart" ? { reperes: [], fonds: [] } : decorDe(c.ctx.nom), n = 0;
    c.pris = [];
    // port dessiné par 111 : l'eau commence à 58 % de la hauteur du cadre
    if (c.ctx.lieu === "port") c.noye = function (x, y) { return y > c.plein.y + c.plein.h * .58 - 8 && c.distPiste(x, y) > 10; };
    d.fonds.forEach(function (f) { FONDS[f](c); });
    // hors du groupe des décors, que la nuit assombrit : les repères restent éclairés
    var groupe = c.E("g", { "class": "rj158" });
    c.monde.insertBefore(groupe, c.sous.nextSibling);
    d.reperes.forEach(function (type) {
      var q = placer(c, type);
      if (!q) return;
      c.pris.push(q);
      vider(c, function (x, y) { return Math.hypot(x - q.x, y - q.y) < q.t + 2; });
      var g = c.E("g", { "class": "rj158-" + type, transform: "translate(" + q.x.toFixed(1) + "," + q.y.toFixed(1) + ") scale(" + q.s + ")" });
      P[type](c.E, g, c.hache);
      groupe.appendChild(g); n++;
    });
    return n;
  }

  window.RJReperesGP = { poser: poser, decorDe: decorDe, peintres: P };
  console.log(TAG, "actif —", GP.length, "Grands Prix ont leurs repères");
})();
