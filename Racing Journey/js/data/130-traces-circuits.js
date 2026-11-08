/* =====================================================================
 * 130-traces-circuits.js — DES TRACÉS INVENTÉS, DES INFOS QUI EN DÉCOULENT
 *
 * POURQUOI
 * Les tracés étaient des formes dessinées à la main, sans rapport avec les
 * infos du circuit (longueur, virages, DRS…), et la ligne d'arrivée tombait
 * parfois dans un virage.
 *
 * CE QUE FAIT LE MODULE
 * Chaque circuit reçoit un tracé original, tiré d'une graine (son nom) : un
 * polygone de virages arrondis, des chicanes sur certaines lignes droites,
 * des rayons selon le caractère du lieu (urbain : angles serrés ; rapide :
 * grandes courbes), un ovale pour les ovales. Le tirage s'inspire de la
 * longueur et du nombre de virages du lieu réel ; le meilleur de 60
 * candidats sans croisement est gardé. Le tracé est donc le même à chaque
 * partie.
 *
 * Tout est ensuite MESURÉ sur ce tracé (modèle de vitesse simple : vitesse en
 * virage selon le rayon, accélération et freinage en ligne droite) :
 *   length, corners, drsZones, overtake, overtakeQ, braking, downforce,
 *   secteurs (CIRCUIT_SECTORS), refLapF1 (recalé pour garder l'équilibre
 *   moyen du jeu), note (faits du tracé + phrases d'ambiance du lieu).
 * La ligne d'arrivée est au milieu de la ligne droite principale ; la voie
 * des stands (111) connaît sa longueur (voieStands).
 *
 * Réversible : window._rj130Uninstall() (rechargez pour revenir aux formes
 * d'origine).
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[130-traces]";
  var LARG = 200, HAUT = 120, MARGE = 13;

  function graine(nom) { var h = 2166136261; for (var i = 0; i < nom.length; i++) { h ^= nom.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function alea(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function borne(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* deux noms pour un même lieu : un seul tracé */
  var MEME_LIEU = { Barcelona: "Barcelone", Hungaroring: "Budapest", "Red Bull Ring": "Spielberg", "Laguna Seca": "Monterey" };

  function estOvale(c) { return c.type === "oval" || /\bovale?\b/i.test(c.note || ""); }
  function estKart(nom) { return /^GP /.test(nom); }

  /* --- Polygone de départ ------------------------------------------------ */
  var CARACTERE = {
    street:    { rMin: 20, rMax: 55, var: .45, carre: true },
    highspeed: { rMin: 70, rMax: 230, var: .4 },
    technical: { rMin: 20, rMax: 80, var: .5 },
    mixed:     { rMin: 25, rMax: 130, var: .45 }
  };

  function polygone(rnd, cible, car, kart) {
    var n = borne(Math.round(cible.virages * (kart ? .75 : .5)), 6, 11), pts = [];
    var replis = 1 + Math.floor(rnd() * 2), ou = [Math.floor(rnd() * n), Math.floor(rnd() * n)];
    for (var i = 0; i < n; i++) {
      var a = (i + (rnd() - .5) * .8) / n * Math.PI * 2;
      // quelques sommets rentrés vers le centre : les replis qui font un vrai circuit
      var r = (ou.slice(0, replis).indexOf(i) >= 0) ? .25 + rnd() * .2 : 1 - car.var * rnd();
      pts.push({ a: a, x: Math.cos(a) * r * 1.55, y: Math.sin(a) * r });
    }
    pts.sort(function (p, q) { return p.a - q.a; });
    if (car.carre) pts.forEach(function (p, i) {   // urbain : des pâtés de maisons
      if (i % 2) { var q = pts[i - 1]; if (Math.abs(p.x - q.x) < Math.abs(p.y - q.y)) p.x = q.x; else p.y = q.y; }
    });
    return pts.map(function (p) { return { x: p.x, y: p.y }; });
  }

  function longueurAretes(P) { var L = 0; for (var i = 0; i < P.length; i++) { var q = P[(i + 1) % P.length]; L += Math.hypot(q.x - P[i].x, q.y - P[i].y); } return L; }

  function chicanes(P, rnd, combien) {
    for (var k = 0; k < combien; k++) {
      var best = -1, lg = 0;
      for (var i = 1; i < P.length; i++) {         // jamais sur la ligne droite principale (arête 0)
        var q = P[(i + 1) % P.length], l = Math.hypot(q.x - P[i].x, q.y - P[i].y);
        if (l > lg && !P[i].chic && !q.chic) { lg = l; best = i; }
      }
      if (best < 0) return P;
      var A = P[best], B = P[(best + 1) % P.length], ux = (B.x - A.x) / lg, uy = (B.y - A.y) / lg, d = lg * .07 * (rnd() < .5 ? 1 : -1), t = .35 + rnd() * .3;
      var c1 = { x: A.x + ux * lg * (t - .04) + uy * d, y: A.y + uy * lg * (t - .04) - ux * d, chic: true };
      var c2 = { x: A.x + ux * lg * (t + .04) - uy * d, y: A.y + uy * lg * (t + .04) + ux * d, chic: true };
      P.splice(best + 1, 0, c1, c2);
    }
    return P;
  }

  function croise(P) {
    function seg(a, b, c, d) {
      function o(p, q, r) { return (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x); }
      return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
    }
    var n = P.length;
    for (var i = 0; i < n; i++) for (var j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (seg(P[i], P[(i + 1) % n], P[j], P[(j + 1) % n])) return true;
    }
    return false;
  }

  /* --- Géométrie : congés aux sommets, mesures ------------------------- */
  function geometrie(P, rayons) {
    var n = P.length, coins = [];
    for (var i = 0; i < n; i++) {
      var A = P[(i - 1 + n) % n], V = P[i], B = P[(i + 1) % n];
      var la = Math.hypot(A.x - V.x, A.y - V.y), lb = Math.hypot(B.x - V.x, B.y - V.y);
      var ux = (A.x - V.x) / la, uy = (A.y - V.y) / la, vx = (B.x - V.x) / lb, vy = (B.y - V.y) / lb;
      var inter = Math.acos(borne(ux * vx + uy * vy, -1, 1)), tour = Math.PI - inter;
      var t = rayons[i] / Math.tan(inter / 2);
      t = Math.min(t, la * .45, lb * .45);
      var r = t * Math.tan(inter / 2);
      coins.push({ V: V, tour: tour, r: r, t: t, P1: { x: V.x + ux * t, y: V.y + uy * t }, P2: { x: V.x + vx * t, y: V.y + vy * t }, la: la, lb: lb });
    }
    // Segments dans l'ordre : droite (P2 du coin i → P1 du coin i+1), puis le coin i+1.
    var segs = [];
    for (i = 0; i < n; i++) {
      var c = coins[i], s = coins[(i + 1) % n];
      segs.push({ droite: true, l: Math.hypot(s.P1.x - c.P2.x, s.P1.y - c.P2.y), de: i });
      segs.push({ droite: false, l: s.r * s.tour, coin: (i + 1) % n });
    }
    return { coins: coins, segs: segs };
  }

  function vitesseVirage(c, ovale) {
    var base = Math.sqrt(30 * Math.max(8, c.r)) * (ovale ? 1.45 : 1);
    var douceur = borne(1 - c.tour / (Math.PI / 2), 0, 1);   // un léger coup de volant ne ralentit guère
    return Math.min(ovale ? 100 : 86, base * (1 + douceur * 1.6));
  }

  function chrono(g, ovale) {
    var A = 9, D = 30, VMAX = 95, n = g.coins.length, t = 0, parts = [], lourds = 0, plusLongue = 0, droites = [];
    g.segs.forEach(function (s) {
      var dt;
      if (s.droite) {
        var v0 = vitesseVirage(g.coins[s.de], ovale), v1 = vitesseVirage(g.coins[(s.de + 1) % n], ovale), L = s.l;
        var vp = Math.sqrt((2 * A * D * L + D * v0 * v0 + A * v1 * v1) / (A + D));
        if (vp > VMAX) dt = (VMAX - v0) / A + (VMAX - v1) / D + Math.max(0, L - (VMAX * VMAX - v0 * v0) / (2 * A) - (VMAX * VMAX - v1 * v1) / (2 * D)) / VMAX, vp = VMAX;
        else if (vp < Math.max(v0, v1)) dt = 2 * L / (v0 + v1);
        else dt = (vp - v0) / A + (vp - v1) / D;
        if (vp - v1 > 38) lourds++;
        plusLongue = Math.max(plusLongue, L);
        droites.push(L);
      } else dt = s.l / vitesseVirage(g.coins[s.coin], ovale);
      parts.push({ l: s.l, t: dt, droite: s.droite });
      t += dt;
    });
    return { temps: t, parts: parts, lourds: lourds, plusLongue: plusLongue, droites: droites };
  }

  /* --- Un circuit -------------------------------------------------------- */
  function inventer(nom, c) {
    var kart = estKart(nom), ovale = estOvale(c);
    var cible = { m: (+c.length || (kart ? 1.2 : 4.5)) * 1000, virages: +c.corners || (kart ? 10 : 14) };
    var car = CARACTERE[c.type] || CARACTERE.mixed;
    if (kart) car = { rMin: 6, rMax: 22, var: .5 };
    var rnd = alea(graine(MEME_LIEU[nom] || nom)), meilleur = null;

    for (var essai = 0; essai < (ovale ? 1 : 60); essai++) {
      var P, rayons;
      if (ovale) {
        var indy = cible.virages >= 4 && /indianapolis/i.test(nom), h = indy ? .32 : .5;
        P = [{ x: -1, y: h }, { x: 1, y: h }, { x: 1, y: -h }, { x: -1, y: -h }].reverse();
      } else {
        P = polygone(rnd, cible, car, kart);
        // la plus longue arête devient la ligne droite principale (arête 0)
        var iMax = 0, lMax = 0;
        P.forEach(function (p, i) { var q = P[(i + 1) % P.length], l = Math.hypot(q.x - p.x, q.y - p.y); if (l > lMax) { lMax = l; iMax = i; } });
        P = P.slice(iMax).concat(P.slice(0, iMax));
        P = chicanes(P, rnd, borne(Math.round((cible.virages - P.length) / 2), 0, kart ? 2 : cible.m > 8000 ? 9 : 4));
      }
      // mise à l'échelle en mètres (deux passes : les congés raccourcissent le tour)
      var ech = cible.m / longueurAretes(P);
      P = P.map(function (p) { return { x: p.x * ech, y: p.y * ech, chic: p.chic }; });
      rayons = P.map(function (p) {
        if (ovale) return 1e6;
        return p.chic ? car.rMin * .8 : car.rMin + rnd() * (car.rMax - car.rMin);
      });
      for (var passe = 0; passe < 2; passe++) {
        var g0 = geometrie(P, rayons), L0 = g0.segs.reduce(function (a, s) { return a + s.l; }, 0), f = cible.m / L0;
        P = P.map(function (p) { return { x: p.x * f, y: p.y * f, chic: p.chic }; });
      }
      var g = geometrie(P, rayons);
      var virages = g.coins.filter(function (k) { return k.tour >= 0.26; }).length;
      var courtes = g.coins.filter(function (k) { return k.la < cible.m * .02 && !k.V.chic; }).length;
      var epingles = g.coins.filter(function (k) { return k.tour > 2.9; }).length;
      var serres = g.coins.filter(function (k) { return k.tour > 1.9 && !k.V.chic; }).length;
      // rentrants : sommets qui tournent à contre-sens du tour
      var sens = 0, rentrants = 0;
      P.forEach(function (p, i) { var a = P[(i - 1 + P.length) % P.length], b = P[(i + 1) % P.length]; var z = (p.x - a.x) * (b.y - p.y) - (p.y - a.y) * (b.x - p.x); sens += z; p._z = z; });
      P.forEach(function (p) { if (!p.chic && p._z * sens < 0) rentrants++; });
      var note = (croise(P) ? 1e6 : 0) + Math.abs(virages - cible.virages) * 3 + courtes * 4 + epingles * 6 +
                 (ovale ? 0 : Math.max(0, cible.m * .12 - g.coins[1].la) / 50 + Math.max(0, 2 - rentrants) * 5 + (serres ? 0 : 6));     // une vraie ligne droite principale
      if (!meilleur || note < meilleur.note) meilleur = { note: note, P: P, g: g, virages: virages };
    }
    return mesurer(nom, c, meilleur, ovale, kart);
  }

  function mesurer(nom, c, m, ovale, kart) {
    var g = m.g, ch = chrono(g, ovale), L = ch.parts.reduce(function (a, p) { return a + p.l; }, 0);
    // secteurs : temps cumulé aux tiers de la distance, depuis la ligne (milieu de l'arête 0)
    var depart = g.segs[0].l / 2, cum = 0, temps = 0, bornes = [L / 3, 2 * L / 3], sec = [], vu = 0;
    var ordre = ch.parts.slice(0);
    ordre.push({ l: depart, t: ch.parts[0].t * depart / Math.max(1, ch.parts[0].l), droite: true });
    ordre[0] = { l: ch.parts[0].l - depart, t: ch.parts[0].t * (1 - depart / Math.max(1, ch.parts[0].l)) };
    ordre.forEach(function (p) {
      if (!(p.l > 0)) { temps += p.t || 0; return; }
      while (vu < 2 && cum + p.l >= bornes[vu]) { sec.push(temps + p.t * (bornes[vu] - cum) / p.l); vu++; }
      cum += p.l; temps += p.t;
    });
    var parts = [sec[0] / temps, (sec[1] - sec[0]) / temps, 1 - sec[1] / temps].map(function (x) { return Math.round(x * 1000) / 1000; });
    var drs = ovale || kart ? 0 : borne(ch.droites.filter(function (l) { return l >= 500; }).length, 1, 3);
    var depasse = ovale ? (+c.overtake || .5) : borne(.06 + ch.plusLongue / 1200 * .3 + ch.lourds * .03 + drs * .03 - (c.type === "street" ? .08 : 0), .05, .85);
    return {
      P: m.P, g: g, virages: m.virages, longueur: L, temps: ch.temps, secteurs: parts, drs: drs,
      plusLongue: ch.plusLongue, lourds: ch.lourds, depasse: depasse,
      // part du tour passée en ligne droite (pied au plancher) : moins il y en a, plus il faut d'appui
      partDroite: ch.parts.filter(function (p) { return p.droite; }).reduce(function (a, p) { return a + p.t; }, 0) / ch.temps,
      freinage: borne(Math.round(2 + ch.lourds * 1.1), 1, 10)
    };
  }

  /* --- Dessin dans le cadre 200 × 120 (M, L, Q, Z) ---------------------- */
  function dessiner(m) {
    var P = m.P, best = null;
    for (var deg = 0; deg < 180; deg += 6) {
      var a = deg * Math.PI / 180, co = Math.cos(a), si = Math.sin(a);
      var R = P.map(function (p) { return { x: p.x * co - p.y * si, y: p.x * si + p.y * co }; });
      var xs = R.map(function (p) { return p.x; }), ys = R.map(function (p) { return p.y; });
      var w = Math.max.apply(null, xs) - Math.min.apply(null, xs), h = Math.max.apply(null, ys) - Math.min.apply(null, ys);
      var e = Math.min((LARG - 2 * MARGE) / w, (HAUT - 2 * MARGE) / h);
      if (!best || e > best.e) best = { e: e, co: co, si: si, x0: Math.min.apply(null, xs), y0: Math.min.apply(null, ys), w: w, h: h };
    }
    var b = best, ox = (LARG - b.w * b.e) / 2, oy = (HAUT - b.h * b.e) / 2;
    function T(p) { return { x: ((p.x * b.co - p.y * b.si) - b.x0) * b.e + ox, y: ((p.x * b.si + p.y * b.co) - b.y0) * b.e + oy }; }
    function f(p) { var q = T(p); return q.x.toFixed(1) + "," + q.y.toFixed(1); }
    var C = m.g.coins, n = C.length;
    var depart = { x: (C[0].P2.x + C[1].P1.x) / 2, y: (C[0].P2.y + C[1].P1.y) / 2 };
    var d = "M" + f(depart);
    for (var i = 1; i <= n; i++) { var k = C[i % n]; d += " L" + f(k.P1) + " Q" + f(k.V) + " " + f(k.P2); }
    d += " Z";
    var demi = m.g.segs[0].l / 2 * b.e;
    return { path: d, voieStands: { avant: demi, apres: demi } };
  }

  /* --- Application à tous les circuits --------------------------------- */
  function phrasesDuLieu(note) {
    return String(note || "").split(/(?<=\.)\s+/).filter(function (p) {
      return p && !/\d|virage|DRS|ligne droite|chicane|épingle|hairpin|\bT\d|tracé|ovale|km/i.test(p);
    }).join(" ");
  }
  function km(m) { return (m / 1000).toFixed(m < 2000 ? 2 : 3).replace(".", ","); }

  var applique = false, avant = {};
  function appliquer() {
    if (applique) return true;
    if (!window.CIRCUITS || !window.CIRCUIT_SECTORS || !window._rj52Applique) return false;
    var res = {}, ratios = { kart: [], autre: [] };
    Object.keys(CIRCUITS).forEach(function (nom) {
      var c = CIRCUITS[nom];
      if (!c || typeof c !== "object") return;
      try { res[nom] = inventer(nom, c); } catch (e) { console.warn(TAG, nom, e && e.message); return; }
      if (+c.refLapF1 > 0) ratios[estKart(nom) ? "kart" : "autre"].push(c.refLapF1 / res[nom].temps);
    });
    function mediane(a) { a = a.slice().sort(function (x, y) { return x - y; }); return a.length ? a[Math.floor(a.length / 2)] : 1; }
    var k = { kart: mediane(ratios.kart), autre: mediane(ratios.autre) };
    // appui : moins il y a de ligne droite, plus il en faut ; du plus dégagé (1) au plus sinueux (10)
    var parts = Object.keys(res).filter(function (n) { return !estOvale(CIRCUITS[n]); }).map(function (n) { return res[n].partDroite; });
    var pMin = Math.min.apply(null, parts), pMax = Math.max.apply(null, parts);
    var dep = Object.keys(res).map(function (n) { return res[n].depasse; }), depMoy = dep.reduce(function (a, x) { return a + x; }, 0) / dep.length;
    Object.keys(res).forEach(function (nom) {
      var c = CIRCUITS[nom], m = res[nom], ovale = estOvale(c), kart = estKart(nom);
      avant[nom] = { path: c.path, length: c.length, corners: c.corners, refLapF1: c.refLapF1, drsZones: c.drsZones, overtake: c.overtake, overtakeQ: c.overtakeQ, braking: c.braking, downforce: c.downforce, note: c.note, sec: CIRCUIT_SECTORS[nom] };
      var dessin = dessiner(m);
      c.path = dessin.path;
      c.voieStands = dessin.voieStands;
      c.length = Math.round(m.longueur) / 1000;
      c.corners = m.virages;
      // temps de référence : celui du lieu, ajusté par le tracé (±12 %), pour garder des chronos crédibles
      var brut = m.temps * k[kart ? "kart" : "autre"], ref = +avant[nom].refLapF1;
      c.refLapF1 = Math.round((ref > 0 ? ref * borne(brut / ref, .88, 1.12) : brut) * 10) / 10;
      c.drsZones = (+avant[nom].drsZones > 0) ? m.drs : 0;
      // dépassement : celui du lieu, modulé par le tracé (ligne droite, freinages, DRS) par rapport à la moyenne
      var dLieu = +avant[nom].overtake, d = dLieu > 0 ? borne(dLieu * borne(m.depasse / depMoy, .8, 1.25), .03, .95) : m.depasse;
      c.overtake = Math.round(d * 100) / 100;
      c.overtakeQ = borne(Math.round(d * 12), 1, 10);
      if (!ovale) { c.braking = m.freinage; c.downforce = borne(Math.round(1 + 9 * (pMax - m.partDroite) / Math.max(.01, pMax - pMin)), 1, 10); }
      c.trace = { plusLongueDroite: Math.round(m.plusLongue), freinagesAppuyes: m.lourds };
      CIRCUIT_SECTORS[nom] = m.secteurs;
      var faits = "Tracé de " + km(m.longueur) + " km, " + m.virages + " virages" +
        (ovale ? "" : ", plus longue ligne droite " + Math.round(m.plusLongue / 10) * 10 + " m") +
        (c.drsZones ? ", " + c.drsZones + " zone" + (c.drsZones > 1 ? "s" : "") + " DRS" : "") +
        (m.lourds ? ", " + m.lourds + " gros freinage" + (m.lourds > 1 ? "s" : "") : "") + ".";
      var lieu = phrasesDuLieu(avant[nom].note);
      c.note = faits + (lieu ? " " + lieu : "");
    });
    applique = true;
    console.log(TAG, Object.keys(res).length + " tracés inventés, infos mesurées sur le tracé");
    return true;
  }

  var essais = 0;
  function boot() { if (appliquer()) return; if (essais++ < 80) setTimeout(boot, 60); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  window.RJTraces = { inventer: inventer, dessiner: dessiner, applique: function () { return applique; } };
  window._rj130Uninstall = function () {
    Object.keys(avant).forEach(function (nom) {
      var c = CIRCUITS[nom], a = avant[nom]; if (!c) return;
      ["path", "length", "corners", "refLapF1", "drsZones", "overtake", "overtakeQ", "braking", "downforce", "note"].forEach(function (k) { c[k] = a[k]; });
      delete c.voieStands; delete c.trace;
      if (a.sec) CIRCUIT_SECTORS[nom] = a.sec; else delete CIRCUIT_SECTORS[nom];
    });
    delete window.RJTraces;
  };
})();
