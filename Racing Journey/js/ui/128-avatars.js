/* =====================================================================
 * 128-avatars.js — DES VISAGES POUR TOUT LE MONDE
 *
 * POURQUOI
 * Pilotes, staff, journalistes, famille : tous étaient des initiales dans
 * un rond de couleur.
 *
 * CE QUE FAIT LE MODULE
 * Un portrait peint, généré par le jeu en couches vectorielles :
 *  - visage construit (pommettes, angle de la mâchoire, menton, tempes),
 *    éclairage latéral, orbites, paupières, iris texturé, grain de peau,
 *    barbe en poils, cheveux mèche par mèche, légère asymétrie ;
 *  - l'âge vieillit le visage (enfant, rides, cheveux gris), le rôle choisit
 *    la tenue (combinaison aux couleurs de l'écurie, polo de staff et casque
 *    radio, veste et badge presse, habits de ville) ;
 *  - un personnage a toujours le même visage : ses traits sont tirés de son
 *    nom ; le teint suit son pays.
 * Ton pilote se compose dans la création de carrière (étape « numéro »), et
 * se modifie depuis l'avatar du bandeau. Les avatars remplacent les
 * initiales : bandeau, classements, entourage, messagerie, face-à-face,
 * réseaux sociaux, vie perso.
 *
 * Rendu : chaque portrait devient une image (data URL), mise en cache ; en
 * petit, une version allégée (moins de mèches). Réversible :
 * window._rj128Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[128-avatars]";

  /* ------------------------------------------------------------ outils --- */
  function graine(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return function () { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; }; }
  function mix(a, b, t) { return "color-mix(in srgb, " + a + " " + Math.round((1 - t) * 100) + "%, " + b + ")"; }
  function choix(r, t) { return t[Math.floor(r() * t.length) % t.length]; }

  /* ------------------------------------------------------- les palettes --- */
  var TEINTS = ["#F3D3BC", "#EBC0A0", "#E2AE8A", "#D49A74", "#BF8460", "#A06A48", "#7E5034", "#5E3A25"];
  var CHEVEUX = ["#15100D", "#2E1C13", "#4A2E1C", "#6B4428", "#8E5C30", "#B98A4E", "#D6B57A", "#7A2416", "#8E8E95", "#D4D4DA"];
  var YEUX = ["#3a2418", "#5a3a22", "#6b5530", "#3d6c94", "#5c8aa8", "#4f6e4a", "#6b7b52", "#7c8d99"];
  var COUPES = ["courts", "raie", "rase", "boucles", "longs", "chignon", "degarni"];
  var FORMES = { ovale: { w: 41, j: .82, cw: 12, chin: 0 }, carre: { w: 43, j: .99, cw: 19, chin: -2 }, rond: { w: 46, j: .9, cw: 17, chin: -9 }, long: { w: 38, j: .84, cw: 12, chin: 11 }, triangle: { w: 43, j: .68, cw: 7, chin: 4 } };
  /* Cheveux selon la région : teintes et textures plausibles. */
  var ASIE = { JP: 1, CN: 1, KR: 1, TH: 1, ID: 1, IN: 1, VN: 1, MY: 1, PH: 1 }, AFRIQUE = { NG: 1, GH: 1, SN: 1, CI: 1, CM: 1, KE: 1 }, SUD = { BR: 1, CO: 1, MX: 1, AR: 1, MA: 1, DZ: 1, TN: 1, EG: 1, SA: 1, AE: 1, TR: 1, IT: 1, ES: 1, PT: 1 };
  /* Le teint suit le pays (code ISO) : une plage dans la palette. */
  var PAYS = { NG: [6, 7], GH: [6, 7], SN: [6, 7], CI: [6, 7], CM: [6, 7], KE: [6, 7], ZA: [2, 7], BR: [2, 6], CO: [2, 5], MX: [2, 5], AR: [1, 4], IN: [4, 6], JP: [1, 3], CN: [1, 3], KR: [1, 3], TH: [2, 4], ID: [3, 5], MA: [2, 5], DZ: [2, 5], TN: [2, 5], EG: [3, 5], SA: [3, 5], AE: [3, 5], TR: [2, 4], IT: [1, 4], ES: [1, 4], PT: [1, 4], FR: [0, 4], MC: [0, 3], GB: [0, 3], IE: [0, 2], DE: [0, 2], NL: [0, 2], BE: [0, 3], DK: [0, 2], SE: [0, 2], NO: [0, 2], FI: [0, 2], PL: [0, 2], AT: [0, 2], CH: [0, 3], US: [0, 7], CA: [0, 5], AU: [0, 4], NZ: [0, 4] };
  var FEMININS = /^(Élise|Elise|Sabine|Nadia|Claire|Ingrid|Yuki|Emma|Clara|Inès|Ines|Maya|Lana|Zoé|Zoe|Jade|Nina|Louise|Rose|Alma|Lina|Léa|Lea|Camille|Sophie|Julie|Laura|Marie|Anna|Sarah|Chloé|Chloe|Manon|Lucie|Eva|Mia|Alice|Ana|Maria|Elena|Giulia|Sofia|Hannah|Lena|Amélie|Charlotte|Isabella|Olivia|Grace|Aiko|Sakura|Mei|Priya)\b/i;
  function estFeminin(nom) { var p = String(nom || "").trim().split(/\s+/)[0] || ""; return FEMININS.test(p); }

  /* Paramètres d'un personnage, tirés de son identité : toujours les mêmes. */
  function parametres(id) {
    id = id || {};
    var r = graine((id.nom || "?") + "|" + (id.graine || "")), age = id.age == null ? 30 : id.age;
    var fem = id.fem != null ? id.fem : estFeminin(id.nom);
    var plage = PAYS[id.nat] || [0, 7], teint = TEINTS[plage[0] + Math.floor(r() * (plage[1] - plage[0] + 1))];
    var sombre = TEINTS.indexOf(teint) >= 5;
    var ch = sombre || ASIE[id.nat] || AFRIQUE[id.nat] ? choix(r, [CHEVEUX[0], CHEVEUX[0], CHEVEUX[1]]) : SUD[id.nat] ? choix(r, CHEVEUX.slice(0, 4)) : choix(r, CHEVEUX.slice(0, 8));
    if (age >= 62) ch = CHEVEUX[9]; else if (age >= 50) ch = r() > .4 ? CHEVEUX[8] : ch;
    var coupe = fem ? choix(r, ["longs", "longs", "chignon", "raie", "courts"]) : (sombre || AFRIQUE[id.nat]) && r() > .35 ? choix(r, ["boucles", "rase"]) : ASIE[id.nat] ? choix(r, ["courts", "raie", "rase", "courts"]) : age >= 50 && r() > .5 ? "degarni" : choix(r, ["courts", "raie", "rase", "courts", "boucles"]);
    var forme = choix(r, fem ? ["ovale", "ovale", "long", "triangle", "rond"] : ["ovale", "carre", "carre", "long", "rond", "triangle"]);
    return {
      nom: id.nom || "?", age: age, fem: fem, peau: teint, cheveux: ch, coupe: coupe, forme: forme,
      yeux: sombre ? choix(r, YEUX.slice(0, 3)) : choix(r, YEUX),
      barbe: !fem && age >= 18 && r() > .62 ? choix(r, ["courte", "courte", "pleine"]) : null,
      lunettes: age >= 45 ? r() > .45 : r() > .85, boucle: fem && r() > .5, sourire: r() > .45,
      role: id.role || "civil", tenue: id.tenue || choix(r, ["#2a2a33", "#3c4a6b", "#5a2e2e", "#2f4a3a", "#4a4a52"]), lisere: id.lisere || "#FF1801",
      fond: id.fond || id.tenue || "#3a3a44", casque: !!id.casque, numero: id.numero || null
    };
  }

  /* ------------------------------------------------------- le portrait --- */
  var N = 0;
  function svg(o, leger) {
    var idp = "rja" + (N++), r = graine(o.nom + "|traits"), jit = function (a) { return (r() - .5) * a; };
    var F = FORMES[o.forme] || FORMES.ovale, enfant = o.age < 14, vieux = o.age >= 55, fem = o.fem;
    var cx = 100, w = F.w - (fem ? 2.5 : 0) + (enfant ? 1 : 0), j = w * (F.j - (fem ? .07 : 0) - (enfant ? .06 : 0)) + (vieux ? 1.5 : 0), cw = F.cw - (fem ? 3 : 0) + (enfant ? 2 : 0);
    var yTop = enfant ? 66 : 56, yEye = enfant ? 119 : 112, yNez = enfant ? 137 : 142, yBouche = enfant ? 153 : 159;
    var yMenton = (enfant ? 170 : 183) + (enfant ? 0 : F.chin) + (fem ? -2 : 0);
    var peau = o.peau, ombre = mix(peau, "#4a1f12", .34), ombreF = mix(peau, "#24100a", .58), lumiere = mix(peau, "#fff4ea", .32), chaud = mix(peau, "#d4574a", .28);
    var ch = o.cheveux, chS = mix(ch, "#000", .5), chL = mix(ch, "#fff", .32), chM = mix(ch, "#000", .2);
    var B = function (n) { return "url(#" + idp + "b" + n + ")"; };
    /* Contour : crâne, tempe, pommette (le plus large), joue, angle de la
       mâchoire, ligne de la mâchoire, menton. */
    function cote(k) {
      return [
        "C" + (cx + k * w * .62) + " " + (yTop - 1) + " " + (cx + k * w * .97) + " " + (yTop + 14) + " " + (cx + k * w * .95) + " " + (yEye - 14),
        "C" + (cx + k * w * .97) + " " + (yEye - 6) + " " + (cx + k * (w + 1.5)) + " " + (yEye + 1) + " " + (cx + k * (w + 1)) + " " + (yEye + 10),
        "C" + (cx + k * (w + .3)) + " " + (yEye + 24) + " " + (cx + k * (j + 4)) + " " + (yBouche - 14) + " " + (cx + k * j) + " " + (yBouche + 1),
        "C" + (cx + k * (j - 3)) + " " + (yBouche + 9) + " " + (cx + k * (cw + 10)) + " " + (yMenton - 7) + " " + (cx + k * cw) + " " + (yMenton - 2),
        "C" + (cx + k * (cw - 4)) + " " + (yMenton + 1) + " " + (cx + k * 5) + " " + (yMenton + 1.5) + " " + cx + " " + (yMenton + 1.5)
      ];
    }
    var droit = cote(1);
    /* le côté gauche se parcourt à l'envers pour fermer le contour */
    var gaucheInv = [
      "C" + (cx - 5) + " " + (yMenton + 1.5) + " " + (cx - cw + 4) + " " + (yMenton + 1) + " " + (cx - cw) + " " + (yMenton - 2),
      "C" + (cx - cw - 10) + " " + (yMenton - 7) + " " + (cx - j + 3) + " " + (yBouche + 9) + " " + (cx - j) + " " + (yBouche + 1),
      "C" + (cx - j - 4) + " " + (yBouche - 14) + " " + (cx - w - .3) + " " + (yEye + 24) + " " + (cx - w - 1) + " " + (yEye + 10),
      "C" + (cx - w - 1.5) + " " + (yEye + 1) + " " + (cx - w * .97) + " " + (yEye - 6) + " " + (cx - w * .95) + " " + (yEye - 14),
      "C" + (cx - w * .97) + " " + (yTop + 14) + " " + (cx - w * .62) + " " + (yTop - 1) + " " + cx + " " + yTop
    ];
    var tete = "M" + cx + " " + yTop + " " + droit.join(" ") + " " + gaucheInv.join(" ") + " Z";
    var s = '<svg viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg"><defs>' +
      [0.5, 1, 2, 3.5, 6].map(function (v, i) { return '<filter id="' + idp + "b" + i + '" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="' + v + '"/></filter>'; }).join("") +
      '<filter id="' + idp + 'pores"><feTurbulence type="fractalNoise" baseFrequency="2.2" numOctaves="2" seed="' + Math.floor(r() * 99) + '"/><feColorMatrix values="0 0 0 0 .2  0 0 0 0 .08  0 0 0 0 .04  0 0 0 1.4 -.62"/></filter>' +
      '<filter id="' + idp + 'marbre"><feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="3" seed="' + Math.floor(r() * 99) + '"/><feColorMatrix values="0 0 0 0 .75  0 0 0 0 .25  0 0 0 0 .2  0 0 0 1.6 -.75"/></filter>' +
      '<filter id="' + idp + 'poils"><feTurbulence type="fractalNoise" baseFrequency="3.2" numOctaves="1" seed="' + Math.floor(r() * 99) + '"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 2.4 -1.25"/></filter>' +
      '<clipPath id="' + idp + 't"><path d="' + tete + '"/></clipPath>' +
      '<radialGradient id="' + idp + 'fond" cx="28%" cy="22%" r="95%"><stop offset="0" stop-color="' + mix(o.fond, "#fff", .12) + '"/><stop offset=".55" stop-color="' + mix(o.fond, "#000", .45) + '"/><stop offset="1" stop-color="' + mix(o.fond, "#000", .82) + '"/></radialGradient>' +
      '<linearGradient id="' + idp + 'habit" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + mix(o.tenue, "#fff", .14) + '"/><stop offset=".55" stop-color="' + o.tenue + '"/><stop offset="1" stop-color="' + mix(o.tenue, "#000", .6) + '"/></linearGradient>' +
      '<radialGradient id="' + idp + 'iris" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="' + mix(o.yeux, "#e8d38a", .35) + '"/><stop offset=".45" stop-color="' + mix(o.yeux, "#fff", .2) + '"/><stop offset=".85" stop-color="' + o.yeux + '"/><stop offset="1" stop-color="' + mix(o.yeux, "#000", .75) + '"/></radialGradient>' +
      '<linearGradient id="' + idp + 'chev" x1=".1" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="' + chM + '"/><stop offset=".35" stop-color="' + ch + '"/><stop offset="1" stop-color="' + chS + '"/></linearGradient>' +
      '<linearGradient id="' + idp + 'cou" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="' + mix(peau, "#000", .12) + '"/><stop offset=".6" stop-color="' + ombre + '"/><stop offset="1" stop-color="' + ombreF + '"/></linearGradient>' +
      '<radialGradient id="' + idp + 'vign" cx="50%" cy="45%" r="70%"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>' +
      '</defs><rect width="200" height="220" fill="url(#' + idp + 'fond)"/>';

    /* cheveux longs derrière */
    if (o.coupe === "longs") {
      s += '<path d="M' + (cx - w - 12) + " " + (yEye - 22) + " Q" + (cx - w - 18) + " " + (yTop - 22) + " " + cx + " " + (yTop - 20) + " Q" + (cx + w + 18) + " " + (yTop - 22) + " " + (cx + w + 12) + " " + (yEye - 22) + " Q" + (cx + w + 20) + " " + (yMenton + 10) + " " + (cx + w + 6) + " " + (yMenton + 48) + " L" + (cx - w - 6) + " " + (yMenton + 48) + " Q" + (cx - w - 20) + " " + (yMenton + 10) + " " + (cx - w - 12) + " " + (yEye - 22) + ' Z" fill="url(#' + idp + 'chev)"/>';
      for (var li = 0; li < (leger ? 25 : 70); li++) { var lk = r() > .5 ? 1 : -1, lx = cx + lk * (w + 2 + r() * 10), ly = yEye - 20 + r() * 30; s += '<path d="M' + lx + " " + ly + " q" + lk * (2 + r() * 6) + " " + (30 + r() * 20) + " " + lk * (r() * 4 - 2) + " " + (50 + r() * 40) + '" stroke="' + (r() > .6 ? chL : chS) + '" stroke-width="' + (.4 + r() * .9) + '" fill="none" opacity="' + (.25 + r() * .4) + '"/>'; }
    }

    /* cou, épaules, tenue */
    var yCou = yMenton - 16, yEp = yMenton + 24, jn = Math.min(j, w * .8);
    s += '<path d="M' + (cx - jn + 7) + " " + yCou + " C" + (cx - jn + 6) + " " + (yMenton + 16) + " " + (cx - jn + 2) + " " + (yMenton + 26) + " " + (cx - jn - 4) + " " + (yEp + 4) + " L" + (cx + jn + 4) + " " + (yEp + 4) + " C" + (cx + jn - 2) + " " + (yMenton + 26) + " " + (cx + jn - 6) + " " + (yMenton + 16) + " " + (cx + jn - 7) + " " + yCou + ' Z" fill="url(#' + idp + 'cou)"/>' +
      '<path d="M' + (cx - 12) + " " + (yMenton + 6) + " q-2 14 -8 24 M" + (cx + 13) + " " + (yMenton + 6) + ' q2 14 8 24" stroke="' + ombreF + '" stroke-width="3" fill="none" opacity=".35" filter="' + B(2) + '"/>' +
      '<path d="M' + (cx - jn + 4) + " " + (yMenton - 8) + " Q" + cx + " " + (yMenton + 20) + " " + (cx + jn - 4) + " " + (yMenton - 8) + " L" + (cx + jn - 6) + " " + (yMenton + 12) + " Q" + cx + " " + (yMenton + 28) + " " + (cx - jn + 6) + " " + (yMenton + 12) + ' Z" fill="' + ombreF + '" opacity=".7" filter="' + B(2) + '"/>';
    s += '<path d="M2 222 C6 ' + (yEp + 18) + " 36 " + (yEp + 1) + " " + (cx - 33) + " " + (yEp - 3) + " Q" + cx + " " + (yEp + 9) + " " + (cx + 33) + " " + (yEp - 3) + " C164 " + (yEp + 1) + " 194 " + (yEp + 18) + ' 198 222 Z" fill="url(#' + idp + 'habit)"/>' +
      '<path d="M' + (cx - 64) + " " + (yEp + 26) + " q14 -8 24 6 M" + (cx + 50) + " " + (yEp + 20) + ' q12 6 14 18" stroke="' + mix(o.tenue, "#000", .55) + '" stroke-width="4" fill="none" opacity=".45" filter="' + B(2) + '"/>';
    if (o.role === "pilote") {
      s += '<path d="M' + (cx - 33) + " " + (yEp - 3) + " Q" + cx + " " + (yEp + 11) + " " + (cx + 33) + " " + (yEp - 3) + " L" + (cx + 29) + " " + (yEp - 12) + " Q" + cx + " " + yEp + " " + (cx - 29) + " " + (yEp - 12) + ' Z" fill="' + mix(o.tenue, "#000", .3) + '"/>' +
        '<path d="M' + (cx - 74) + " 222 L" + (cx - 46) + " " + (yEp + 5) + " L" + (cx - 37) + " " + (yEp + 7) + " L" + (cx - 61) + ' 222 Z" fill="' + o.lisere + '"/><path d="M' + (cx + 74) + " 222 L" + (cx + 46) + " " + (yEp + 5) + " L" + (cx + 37) + " " + (yEp + 7) + " L" + (cx + 61) + ' 222 Z" fill="' + o.lisere + '"/>' +
        '<rect x="' + (cx - 42) + '" y="' + (yEp + 19) + '" width="17" height="6" rx="1" fill="' + o.lisere + '" opacity=".9"/>';
      s += o.numero ? '<text x="' + (cx + 27) + '" y="' + Math.min(yEp + 30, 214) + '" font-family="Rubik,Arial,sans-serif" font-weight="900" font-size="14" text-anchor="middle" fill="#fff" opacity=".92">' + o.numero + "</text>"
        : '<rect x="' + (cx + 16) + '" y="' + (yEp + 17) + '" width="22" height="9" rx="1.5" fill="#f2f2f4" opacity=".85"/>';
    }
    if (o.role === "staff") s += '<path d="M' + (cx - 27) + " " + (yEp - 5) + " L" + cx + " " + (yEp + 22) + " L" + (cx + 27) + " " + (yEp - 5) + " L" + (cx + 19) + " " + (yEp - 10) + " L" + cx + " " + (yEp + 9) + " L" + (cx - 19) + " " + (yEp - 10) + ' Z" fill="' + mix(o.tenue, "#fff", .22) + '"/><rect x="' + (cx + 26) + '" y="' + (yEp + 17) + '" width="15" height="8" rx="1.5" fill="' + o.lisere + '"/>';
    if (o.role === "presse") s += '<path d="M' + (cx - 30) + " " + (yEp - 5) + " L" + cx + " " + (yEp + 46) + " L" + (cx + 30) + " " + (yEp - 5) + ' Z" fill="#ebe9ee"/><path d="M' + (cx - 34) + " " + (yEp - 3) + " L" + (cx - 9) + " " + (yEp + 50) + " L" + (cx - 22) + " 222 L" + (cx - 66) + " 222 Z M" + (cx + 34) + " " + (yEp - 3) + " L" + (cx + 9) + " " + (yEp + 50) + " L" + (cx + 22) + " 222 L" + (cx + 66) + ' 222 Z" fill="' + mix(o.tenue, "#000", .15) + '"/><rect x="' + (cx + 36) + '" y="' + (yEp + 24) + '" width="15" height="20" rx="2" fill="#f4f4f6"/><rect x="' + (cx + 38) + '" y="' + (yEp + 28) + '" width="11" height="3" fill="' + o.lisere + '"/>';
    if (o.role === "civil") s += '<path d="M' + (cx - 25) + " " + (yEp - 5) + " Q" + cx + " " + (yEp + 14) + " " + (cx + 25) + " " + (yEp - 5) + '" stroke="' + mix(o.tenue, "#000", .3) + '" stroke-width="5" fill="none"/>';

    /* oreilles */
    [-1, 1].forEach(function (k) {
      var ex = cx + k * (w - .5), coul = k > 0 ? ombre : peau;
      s += '<path d="M' + ex + " " + (yEye - 6) + " C" + (ex + k * 11) + " " + (yEye - 11) + " " + (ex + k * 13) + " " + (yEye + 15) + " " + (ex + k * 2) + " " + (yNez + 3) + ' Z" fill="' + coul + '"/>' +
        '<path d="M' + (ex + k * 1.5) + " " + (yEye - 3) + " c" + k * 7 + " -3 " + k * 8 + " 12 " + k * 2 + ' 17" stroke="' + ombreF + '" stroke-width="2" fill="none" opacity=".55" filter="' + B(0) + '"/>' +
        '<path d="M' + (ex + k * 4) + " " + (yEye - 1) + " c" + k * 3 + " 2 " + k * 3 + " 8 0 11" + '" stroke="' + chaud + '" stroke-width="2.4" fill="none" opacity=".5" filter="' + B(1) + '"/>';
    });

    /* visage et modelé : lumière à gauche, ombre à droite, pommettes, mâchoire */
    var ecart = w * .4 + (enfant ? 1 : 0), lg = enfant ? 9.5 : 9, ht = enfant ? 6.5 : 5.4;
    s += '<path d="' + tete + '" fill="' + peau + '"/><g clip-path="url(#' + idp + 't)">' +
      (leger ? "" : '<rect width="200" height="220" filter="url(#' + idp + 'marbre)" opacity=".16"/>') +
      '<path d="M' + (cx + w * .35) + " " + (yTop - 4) + " C" + (cx + w * .55) + " " + yEye + " " + (cx + w * .3) + " " + yBouche + " " + (cx + cw * .4) + " " + (yMenton + 4) + " L" + (cx + w + 10) + " " + (yMenton + 4) + " L" + (cx + w + 10) + " " + (yTop - 4) + ' Z" fill="' + ombre + '" opacity=".7" filter="' + B(4) + '"/>' +
      '<ellipse cx="' + (cx - w * .42) + '" cy="' + (yTop + 15) + '" rx="' + (w * .5) + '" ry="12" fill="' + lumiere + '" opacity=".6" filter="' + B(4) + '"/>' +
      /* pommettes : un éclat sous l'œil côté lumière, un creux dessous */
      '<ellipse cx="' + (cx - w * .6) + '" cy="' + (yEye + 12) + '" rx="10" ry="6" fill="' + lumiere + '" opacity=".45" filter="' + B(3) + '"/>' +
      '<path d="M' + (cx - w + 3) + " " + (yEye + 20) + " Q" + (cx - w * .55) + " " + (yNez + 8) + " " + (cx - w * .35) + " " + (yBouche - 2) + '" stroke="' + ombre + '" stroke-width="7" fill="none" opacity="' + (enfant ? .05 : .32) + '" filter="' + B(3) + '"/>' +
      '<path d="M' + (cx + w - 3) + " " + (yEye + 20) + " Q" + (cx + w * .55) + " " + (yNez + 8) + " " + (cx + w * .35) + " " + (yBouche - 2) + '" stroke="' + ombreF + '" stroke-width="8" fill="none" opacity="' + (enfant ? .1 : .4) + '" filter="' + B(3) + '"/>' +
      '<ellipse cx="' + (cx - w + 4) + '" cy="' + (yEye - 13) + '" rx="7" ry="12" fill="' + ombre + '" opacity=".35" filter="' + B(3) + '"/>' +
      '<ellipse cx="' + cx + '" cy="' + (yEye - ht - 10) + '" rx="' + (w * .75) + '" ry="5" fill="' + lumiere + '" opacity=".35" filter="' + B(3) + '"/>' +
      [-1, 1].map(function (k) { return '<ellipse cx="' + (cx + k * ecart + k * 1.5) + '" cy="' + (yEye - 1) + '" rx="' + (lg + 4) + '" ry="' + (ht + 4) + '" fill="' + (k > 0 ? ombreF : ombre) + '" opacity="' + (k > 0 ? .55 : .42) + '" filter="' + B(3) + '"/>'; }).join("") +
      '<ellipse cx="' + (cx - w * .48) + '" cy="' + (yNez + 4) + '" rx="9" ry="6" fill="' + chaud + '" opacity="' + (fem || enfant ? .55 : .3) + '" filter="' + B(4) + '"/>' +
      '<ellipse cx="' + (cx + w * .48) + '" cy="' + (yNez + 4) + '" rx="9" ry="6" fill="' + chaud + '" opacity="' + (fem || enfant ? .4 : .22) + '" filter="' + B(4) + '"/>' +
      '<ellipse cx="' + cx + '" cy="' + (yNez - 1) + '" rx="5" ry="4" fill="' + chaud + '" opacity=".35" filter="' + B(2) + '"/>' +
      '<ellipse cx="' + (cx - 2) + '" cy="' + (yMenton - 7) + '" rx="' + (cw * .55) + '" ry="4" fill="' + lumiere + '" opacity=".45" filter="' + B(2) + '"/>' +
      /* ligne de la mâchoire : ombre sous l'os, de l'angle au menton */
      '<path d="M' + (cx - j - 2) + " " + (yBouche - 2) + " C" + (cx - j + 1) + " " + (yBouche + 12) + " " + (cx - cw - 8) + " " + (yMenton - 2) + " " + cx + " " + (yMenton + 2) + " C" + (cx + cw + 8) + " " + (yMenton - 2) + " " + (cx + j - 1) + " " + (yBouche + 12) + " " + (cx + j + 2) + " " + (yBouche - 2) + '" stroke="' + ombreF + '" stroke-width="5" fill="none" opacity=".5" filter="' + B(2) + '"/>' +
      '<rect width="200" height="220" filter="url(#' + idp + 'pores)" opacity=".28"/></g>' +
      '<path d="M' + (cx - w * .2) + " " + (yTop + 1) + " C" + (cx - w * .62) + " " + (yTop - 1) + " " + (cx - w * .97) + " " + (yTop + 14) + " " + (cx - w * .95) + " " + (yEye - 14) + " C" + (cx - w * .97) + " " + (yEye - 6) + " " + (cx - w - 1.5) + " " + (yEye + 1) + " " + (cx - w - 1) + " " + (yEye + 10) + '" stroke="' + lumiere + '" stroke-width="1.2" fill="none" opacity=".55" filter="' + B(0) + '"/>' +
      '<path d="M' + (cx + w + 1) + " " + (yEye + 10) + " " + droit[2] + '" stroke="' + mix(o.fond, "#fff", .45) + '" stroke-width="1.4" fill="none" opacity=".35" filter="' + B(1) + '"/>';

    /* barbe */
    if (o.barbe) {
      var zone = "M" + (cx - j - 4) + " " + (yNez - 4) + " Q" + (cx - j - 1) + " " + (yMenton + 8) + " " + cx + " " + (yMenton + 5) + " Q" + (cx + j + 1) + " " + (yMenton + 8) + " " + (cx + j + 4) + " " + (yNez - 4) + " Q" + (cx + 15) + " " + (yBouche - 3) + " " + cx + " " + (yNez + 6) + " Q" + (cx - 15) + " " + (yBouche - 3) + " " + (cx - j - 4) + " " + (yNez - 4) + " Z";
      s += '<clipPath id="' + idp + 'bz"><path d="' + zone + '"/></clipPath><g clip-path="url(#' + idp + 't)"><g clip-path="url(#' + idp + 'bz)">' +
        '<path d="' + zone + '" fill="' + mix(ch, "#3a4a5a", .3) + '" opacity="' + (o.barbe === "pleine" ? .75 : .32) + '" filter="' + B(1) + '"/>' +
        '<rect width="200" height="220" fill="' + ch + '" filter="url(#' + idp + 'poils)" opacity="' + (o.barbe === "pleine" ? 1 : .8) + '"/></g></g>';
    }

    /* yeux */
    [-1, 1].forEach(function (k) {
      var x = cx + k * ecart + jit(.8), y = yEye + jit(.8), ir = enfant ? 4.9 : 4.4;
      var oeil = "M" + (x - lg) + " " + (y + 1) + " C" + (x - lg * .5) + " " + (y - ht) + " " + (x + lg * .4) + " " + (y - ht - .6) + " " + (x + lg) + " " + (y - .5) + " C" + (x + lg * .45) + " " + (y + ht * .82) + " " + (x - lg * .45) + " " + (y + ht * .88) + " " + (x - lg) + " " + (y + 1) + " Z";
      s += '<path d="' + oeil + '" fill="#e9e2dc"/><clipPath id="' + idp + "o" + k + '"><path d="' + oeil + '"/></clipPath><g clip-path="url(#' + idp + "o" + k + ')">' +
        '<circle cx="' + (x + .6) + '" cy="' + (y + .2) + '" r="' + ir + '" fill="url(#' + idp + 'iris)"/>';
      if (!leger) for (var a = 0; a < 16; a++) { var ang = a / 16 * Math.PI * 2; s += '<path d="M' + (x + .6 + Math.cos(ang) * 1.8) + " " + (y + .2 + Math.sin(ang) * 1.8) + " L" + (x + .6 + Math.cos(ang) * ir * .92) + " " + (y + .2 + Math.sin(ang) * ir * .92) + '" stroke="' + mix(o.yeux, "#000", .45) + '" stroke-width=".35" opacity=".6"/>'; }
      s += '<circle cx="' + (x + .6) + '" cy="' + (y + .2) + '" r="' + ir + '" fill="none" stroke="' + mix(o.yeux, "#000", .7) + '" stroke-width=".8"/><circle cx="' + (x + .6) + '" cy="' + (y + .2) + '" r="' + (enfant ? 2.3 : 1.9) + '" fill="#0a0807"/>' +
        '<path d="M' + (x - lg - 1) + " " + (y - ht - 2) + " L" + (x + lg + 1) + " " + (y - ht - 2) + " L" + (x + lg + 1) + " " + (y - 1) + " Q" + x + " " + (y - 3.4) + " " + (x - lg - 1) + " " + y + ' Z" fill="' + ombreF + '" opacity=".5" filter="' + B(0) + '"/></g>' +
        '<circle cx="' + (x + 2.1) + '" cy="' + (y - 1.5) + '" r="1.15" fill="#fff" opacity=".95"/><circle cx="' + (x - k * (lg - 1.2)) + '" cy="' + (y + .8) + '" r="1.3" fill="#d98a86" opacity=".7"/>' +
        '<path d="M' + (x - lg - 1.5) + " " + (y + 1.5) + " C" + (x - lg * .5) + " " + (y - ht - 1.2) + " " + (x + lg * .4) + " " + (y - ht - 1.8) + " " + (x + lg + 1.5) + " " + (y - .2) + " C" + (x + lg * .4) + " " + (y - ht - (vieux ? 3.5 : 4.6)) + " " + (x - lg * .5) + " " + (y - ht - (vieux ? 3.5 : 4.4)) + " " + (x - lg - 1.5) + " " + (y + 1.5) + ' Z" fill="' + (k > 0 ? ombre : mix(peau, "#000", .06)) + '"/>' +
        '<path d="M' + (x - lg) + " " + (y + 1) + " C" + (x - lg * .5) + " " + (y - ht) + " " + (x + lg * .4) + " " + (y - ht - .6) + " " + (x + lg) + " " + (y - .5) + '" stroke="#24140f" stroke-width="' + (fem ? 2 : 1.5) + '" fill="none" stroke-linecap="round"/>' +
        '<path d="M' + (x - lg * .85) + " " + (y - ht - 3.5) + " Q" + x + " " + (y - ht - (vieux ? 5 : 6.2)) + " " + (x + lg * .9) + " " + (y - ht - 2.8) + '" stroke="' + ombreF + '" stroke-width="1" fill="none" opacity=".6"/>' +
        '<path d="M' + (x - lg * .8) + " " + (y + ht * .55) + " Q" + x + " " + (y + ht + .8) + " " + (x + lg * .85) + " " + (y + ht * .35) + '" stroke="' + mix(peau, "#c46a64", .35) + '" stroke-width="1.1" fill="none" opacity=".75"/>' +
        '<path d="M' + (x - lg * .7) + " " + (y + ht + 2.6) + " Q" + x + " " + (y + ht + 4.2) + " " + (x + lg * .7) + " " + (y + ht + 2.2) + '" stroke="' + ombreF + '" stroke-width="' + (vieux ? 1.2 : .8) + '" fill="none" opacity="' + (vieux ? .55 : .3) + '"/>';
      if (fem) for (var c = 0; c < 6; c++) { var t = .45 + c * .1, px = x - lg + 2 * lg * t; s += '<path d="M' + px + " " + (y - ht * Math.sin(t * Math.PI) * .95) + " l" + k * (1 + c * .25) + ' -2.2" stroke="#1a0e0a" stroke-width=".7" stroke-linecap="round"/>'; }
      var sy = y - ht - (fem ? 8.5 : 7.5) + jit(1), ep = fem ? 2.2 : 3.4, coulS = vieux ? mix(ch, "#c4c4cc", .55) : mix(ch, "#000", .25);
      s += '<path d="M' + (x - k * (lg + 2)) + " " + (sy + 2.5) + " Q" + (x - k) + " " + (sy - 2.5 - (fem ? 1.5 : 0)) + " " + (x + k * (lg + 3.5)) + " " + (sy + 1.8) + " Q" + (x + k * (lg + 1)) + " " + (sy + 1.5 + ep * .45) + " " + x + " " + (sy + ep - 1.5) + " Q" + (x - k * (lg - 2)) + " " + (sy + 2.5 + ep * .55) + " " + (x - k * (lg + 2)) + " " + (sy + 2.5) + ' Z" fill="' + coulS + '" opacity=".55" filter="' + B(0) + '"/>';
      for (var i2 = 0; i2 < (leger ? 12 : 26); i2++) { var tt = r(), bx = x - k * (lg + 1) + k * (2 * lg + 4) * tt, by = sy + 2.4 - Math.sin(tt * Math.PI) * (fem ? 3.6 : 3) + r() * ep * .6; s += '<path d="M' + bx + " " + by + " l" + k * (1.6 + r() * 1.6) + " " + (-.6 - r() * 1.1 + tt * 1.2) + '" stroke="' + coulS + '" stroke-width="' + (.35 + r() * .45) + '" stroke-linecap="round" opacity="' + (.5 + r() * .45) + '"/>'; }
    });

    /* nez */
    s += '<path d="M' + (cx + 3) + " " + (yEye + 2) + " C" + (cx + 5) + " " + (yEye + 14) + " " + (cx + 7) + " " + (yNez - 8) + " " + (cx + 9) + " " + yNez + '" stroke="' + ombreF + '" stroke-width="5" fill="none" opacity=".45" filter="' + B(2) + '"/>' +
      '<path d="M' + (cx - 2.5) + " " + (yEye + 3) + " C" + (cx - 3) + " " + (yEye + 14) + " " + (cx - 3.5) + " " + (yNez - 9) + " " + (cx - 4) + " " + (yNez - 4) + '" stroke="' + lumiere + '" stroke-width="2.6" fill="none" opacity=".7" filter="' + B(1) + '"/>' +
      '<ellipse cx="' + cx + '" cy="' + (yNez - 1) + '" rx="6" ry="5" fill="' + mix(peau, "#fff", .08) + '" filter="' + B(1) + '"/><ellipse cx="' + (cx - 1.5) + '" cy="' + (yNez - 2.5) + '" rx="2.4" ry="1.6" fill="#fff" opacity=".45" filter="' + B(0) + '"/>' +
      '<path d="M' + (cx - 9.5) + " " + (yNez - 1) + " Q" + (cx - 11) + " " + (yNez + 4) + " " + (cx - 6) + " " + (yNez + 4.5) + '" stroke="' + ombre + '" stroke-width="1.6" fill="none" opacity=".75" filter="' + B(0) + '"/>' +
      '<path d="M' + (cx + 9.5) + " " + (yNez - 1) + " Q" + (cx + 11) + " " + (yNez + 4) + " " + (cx + 6) + " " + (yNez + 4.5) + '" stroke="' + ombreF + '" stroke-width="1.8" fill="none" opacity=".85" filter="' + B(0) + '"/>' +
      '<path d="M' + (cx - 6.5) + " " + (yNez + 4) + " Q" + (cx - 4) + " " + (yNez + 2) + " " + (cx - 2) + " " + (yNez + 4.6) + " M" + (cx + 6.5) + " " + (yNez + 4) + " Q" + (cx + 4) + " " + (yNez + 2) + " " + (cx + 2) + " " + (yNez + 4.6) + '" stroke="#2a110b" stroke-width="1.8" fill="none" opacity=".75" stroke-linecap="round"/>' +
      '<ellipse cx="' + (cx + 1) + '" cy="' + (yNez + 9) + '" rx="9" ry="3.4" fill="' + ombreF + '" opacity=".5" filter="' + B(2) + '"/>';

    /* bouche */
    var lv = fem ? 4.4 : 3.1, lb = fem ? 1.35 : 1, lr = (fem ? 10.5 : 9.8) + jit(.6), tilt = jit(1.2);
    var levre = mix(peau, fem ? "#b23a4c" : "#9a4b45", fem ? .52 : .36), levreF = mix(levre, "#000", .32), levreL = mix(levre, "#fff", .2);
    s += '<path d="M' + (cx - lr) + " " + (yBouche + tilt) + " Q" + (cx - 5) + " " + (yBouche - lv - 1.2) + " " + (cx - 1.2) + " " + (yBouche - lv + 1) + " Q" + cx + " " + (yBouche - lv + 2) + " " + (cx + 1.2) + " " + (yBouche - lv + 1) + " Q" + (cx + 5) + " " + (yBouche - lv - 1.2) + " " + (cx + lr) + " " + (yBouche - tilt) + " Q" + cx + " " + (yBouche + 1.3) + " " + (cx - lr) + " " + (yBouche + tilt) + ' Z" fill="' + levreF + '"/>' +
      '<path d="M' + (cx - lr) + " " + (yBouche + tilt) + " Q" + cx + " " + (yBouche + 1.3) + " " + (cx + lr) + " " + (yBouche - tilt) + " Q" + (cx + 6.5) + " " + (yBouche + 4.8 * lb) + " " + cx + " " + (yBouche + 5.3 * lb) + " Q" + (cx - 6.5) + " " + (yBouche + 4.8 * lb) + " " + (cx - lr) + " " + (yBouche + tilt) + ' Z" fill="' + levre + '"/>' +
      '<ellipse cx="' + (cx - 2) + '" cy="' + (yBouche + 2.8 * lb) + '" rx="3.6" ry="1.1" fill="' + levreL + '" opacity=".7" filter="' + B(0) + '"/>' +
      '<path d="M' + (cx - lr + .6) + " " + (yBouche + tilt + .2) + " Q" + cx + " " + (yBouche + (o.sourire ? 2.8 : 1.4)) + " " + (cx + lr - .6) + " " + (yBouche - tilt + .2) + '" stroke="#2c100c" stroke-width="1.2" fill="none" opacity=".9"/>' +
      '<ellipse cx="' + cx + '" cy="' + (yBouche + 9.5) + '" rx="7" ry="2.6" fill="' + ombreF + '" opacity=".45" filter="' + B(1) + '"/>';
    if (vieux) s += '<path d="M' + (cx - 11) + " " + (yNez + 5) + " Q" + (cx - 17) + " " + (yBouche + 1) + " " + (cx - 15) + " " + (yBouche + 11) + " M" + (cx + 11) + " " + (yNez + 5) + " Q" + (cx + 17) + " " + (yBouche + 1) + " " + (cx + 15) + " " + (yBouche + 11) + '" stroke="' + ombreF + '" stroke-width="1.8" fill="none" opacity=".5" filter="' + B(1) + '"/>' +
      '<path d="M' + (cx - 21) + " " + (yTop + 14) + " q10 -2 20 0 q10 2 20 0 M" + (cx - 16) + " " + (yTop + 20) + ' q8 -2 16 0 q8 2 16 0" stroke="' + ombre + '" stroke-width="1" fill="none" opacity=".5"/>';
    else if (!enfant) s += '<path d="M' + (cx - 11) + " " + (yNez + 5) + " Q" + (cx - 16) + " " + yBouche + " " + (cx - 14) + " " + (yBouche + 6) + '" stroke="' + ombre + '" stroke-width="2" fill="none" opacity=".25" filter="' + B(1) + '"/>';

    /* cheveux */
    var formes = {
      courts: "M" + (cx - w - 3) + " " + (yEye - 10) + " C" + (cx - w - 6) + " " + (yTop - 17) + " " + (cx - 20) + " " + (yTop - 25) + " " + (cx + 4) + " " + (yTop - 23) + " C" + (cx + 30) + " " + (yTop - 23) + " " + (cx + w + 6) + " " + (yTop - 11) + " " + (cx + w + 3) + " " + (yEye - 10) + " C" + (cx + w - 2) + " " + (yTop + 12) + " " + (cx + 22) + " " + (yTop + 4) + " " + (cx + 8) + " " + (yTop + 8) + " C" + (cx - 8) + " " + (yTop + 12) + " " + (cx - w + 2) + " " + (yTop + 10) + " " + (cx - w - 3) + " " + (yEye - 10) + " Z",
      raie: "M" + (cx - w - 4) + " " + (yEye - 7) + " C" + (cx - w - 8) + " " + (yTop - 19) + " " + (cx - 16) + " " + (yTop - 27) + " " + (cx + 6) + " " + (yTop - 25) + " C" + (cx + 34) + " " + (yTop - 23) + " " + (cx + w + 8) + " " + (yTop - 7) + " " + (cx + w + 3) + " " + (yEye - 11) + " C" + (cx + w - 6) + " " + (yTop + 5) + " " + (cx + 18) + " " + (yTop - 4) + " " + (cx - 2) + " " + (yTop + 5) + " C" + (cx - 18) + " " + (yTop + 11) + " " + (cx - w + 2) + " " + (yTop + 18) + " " + (cx - w - 4) + " " + (yEye - 7) + " Z",
      rase: "M" + (cx - w + 1) + " " + (yEye - 14) + " C" + cx + " " + (yTop - 13) + " " + cx + " " + (yTop - 13) + " " + (cx + w - 1) + " " + (yEye - 14) + " C" + (cx + w - 6) + " " + (yTop + 6) + " " + (cx + 14) + " " + (yTop + 2) + " " + cx + " " + (yTop + 3) + " C" + (cx - 14) + " " + (yTop + 2) + " " + (cx - w + 6) + " " + (yTop + 6) + " " + (cx - w + 1) + " " + (yEye - 14) + " Z",
      boucles: "M" + (cx - w - 8) + " " + (yEye - 8) + " C" + (cx - w - 14) + " " + (yTop - 23) + " " + (cx - 20) + " " + (yTop - 33) + " " + cx + " " + (yTop - 31) + " C" + (cx + 22) + " " + (yTop - 33) + " " + (cx + w + 14) + " " + (yTop - 23) + " " + (cx + w + 8) + " " + (yEye - 8) + " C" + (cx + w) + " " + (yTop + 6) + " " + (cx + 18) + " " + (yTop + 5) + " " + cx + " " + (yTop + 5) + " C" + (cx - 18) + " " + (yTop + 5) + " " + (cx - w) + " " + (yTop + 6) + " " + (cx - w - 8) + " " + (yEye - 8) + " Z",
      longs: "M" + (cx - w - 5) + " " + (yEye - 2) + " C" + (cx - w - 9) + " " + (yTop - 19) + " " + (cx - 18) + " " + (yTop - 25) + " " + (cx + 2) + " " + (yTop - 23) + " C" + (cx + 24) + " " + (yTop - 25) + " " + (cx + w + 9) + " " + (yTop - 17) + " " + (cx + w + 5) + " " + (yEye - 2) + " C" + (cx + w - 2) + " " + (yTop + 10) + " " + (cx + 18) + " " + (yTop - 2) + " " + (cx + 4) + " " + (yTop + 4) + " C" + (cx - 10) + " " + (yTop + 2) + " " + (cx - w + 2) + " " + (yTop + 14) + " " + (cx - w - 5) + " " + (yEye - 2) + " Z",
      chignon: "M" + (cx - w - 2) + " " + (yEye - 8) + " C" + (cx - w - 6) + " " + (yTop - 17) + " " + (cx - 18) + " " + (yTop - 23) + " " + cx + " " + (yTop - 21) + " C" + (cx + 18) + " " + (yTop - 23) + " " + (cx + w + 6) + " " + (yTop - 17) + " " + (cx + w + 2) + " " + (yEye - 8) + " C" + (cx + w - 4) + " " + (yTop + 8) + " " + (cx + 16) + " " + (yTop + 2) + " " + cx + " " + (yTop + 4) + " C" + (cx - 16) + " " + (yTop + 2) + " " + (cx - w + 4) + " " + (yTop + 8) + " " + (cx - w - 2) + " " + (yEye - 8) + " Z"
    };
    if (o.coupe === "chignon") s += '<ellipse cx="' + (cx + 2) + '" cy="' + (yTop - 27) + '" rx="16" ry="12" fill="url(#' + idp + 'chev)"/>';
    var forme = formes[o.coupe];
    if (forme) {
      s += '<path d="' + forme + '" transform="translate(1 5)" fill="' + ombreF + '" opacity=".55" filter="' + B(2) + '" clip-path="url(#' + idp + 't)"/>' +
        '<path d="' + forme + '" fill="' + chS + '" filter="' + B(1) + '" opacity=".9"/><path d="' + forme + '" fill="url(#' + idp + 'chev)"/><clipPath id="' + idp + 'h"><path d="' + forme + '"/></clipPath><g clip-path="url(#' + idp + 'h)">';
      if (o.coupe === "boucles") for (var b = 0; b < (leger ? 60 : 140); b++) { var bx2 = cx - w - 8 + r() * (2 * w + 16), by2 = yTop - 31 + r() * 38, rr = 1.6 + r() * 2.4; s += '<path d="M' + (bx2 - rr) + " " + by2 + " a" + rr + " " + rr + " 0 1 1 " + rr * 2 + ' 0" stroke="' + (r() > .55 ? chL : chS) + '" stroke-width="' + (.5 + r() * .6) + '" fill="none" opacity="' + (.35 + r() * .4) + '"/>'; }
      else if (o.coupe === "rase") s += '<rect width="200" height="220" fill="' + ch + '" filter="url(#' + idp + 'poils)"/>';
      else for (var m = 0; m < (leger ? 80 : 220); m++) { var x0 = cx - w - 6 + r() * (2 * w + 12), y0 = yTop - 26 + r() * 12, dx = (x0 - cx) * (.3 + r() * .35) + jit(4), lo = 22 + r() * 46; s += '<path d="M' + x0 + " " + y0 + " q" + dx * .45 + " " + lo * .35 + " " + dx + " " + lo + '" stroke="' + (r() > .55 ? chL : r() > .5 ? ch : chS) + '" stroke-width="' + (.3 + r() * 1.1) + '" stroke-linecap="round" fill="none" opacity="' + (.2 + r() * .5) + '"/>'; }
      s += '<path d="M' + (cx - w * .8) + " " + (yTop - 8) + " Q" + (cx - 4) + " " + (yTop - 24) + " " + (cx + w * .55) + " " + (yTop - 12) + '" stroke="#fff" stroke-width="6" fill="none" opacity="' + (o.coupe === "rase" ? .06 : .16) + '" filter="' + B(2) + '"/></g>';
    }
    if (o.coupe === "degarni") {
      [-1, 1].forEach(function (k) {
        var z = "M" + (cx + k * (w + 1)) + " " + (yEye - 4) + " Q" + (cx + k * (w + 2)) + " " + (yTop + 2) + " " + (cx + k * (w - 12)) + " " + (yTop + 6) + " Q" + (cx + k * (w - 6)) + " " + (yEye - 14) + " " + (cx + k * (w - 4)) + " " + (yEye - 2) + " Z";
        s += '<path d="' + z + '" fill="' + chS + '" filter="' + B(1) + '"/><path d="' + z + '" fill="url(#' + idp + 'chev)"/>';
        for (var d = 0; d < 26; d++) { var dx2 = cx + k * (w - 10 + r() * 10), dy2 = yTop + 4 + r() * 8; s += '<path d="M' + dx2 + " " + dy2 + " q" + k * 2 + " 8 " + k * 3 + " " + (14 + r() * 10) + '" stroke="' + (r() > .5 ? chL : chS) + '" stroke-width=".5" fill="none" opacity=".55"/>'; }
      });
      s += '<ellipse cx="' + (cx - 8) + '" cy="' + (yTop + 6) + '" rx="16" ry="6" fill="#fff" opacity=".18" filter="' + B(3) + '"/>';
    }

    /* accessoires */
    if (o.lunettes) {
      [-1, 1].forEach(function (k) { var gx = cx + k * ecart; s += '<rect x="' + (gx - 12.5) + '" y="' + (yEye - 8.5) + '" width="25" height="15.5" rx="5" fill="#d8e4ee" fill-opacity=".08" stroke="#141418" stroke-width="2.2"/><path d="M' + (gx + k * 12.5) + " " + (yEye - 4) + " L" + (cx + k * (w + 2)) + " " + (yEye - 7) + '" stroke="#141418" stroke-width="2"/>'; });
      s += '<path d="M' + (cx - ecart + 12.5) + " " + (yEye - 3) + " Q" + cx + " " + (yEye - 7) + " " + (cx + ecart - 12.5) + " " + (yEye - 3) + '" stroke="#141418" stroke-width="2" fill="none"/>';
    }
    if (o.casque) s += '<path d="M' + (cx - w - 7) + " " + (yEye + 6) + " C" + (cx - w - 11) + " " + (yTop - 28) + " " + (cx + w + 11) + " " + (yTop - 28) + " " + (cx + w + 7) + " " + (yEye + 6) + '" fill="none" stroke="#1e1e24" stroke-width="5.5"/><rect x="' + (cx + w - 3) + '" y="' + (yEye - 7) + '" width="13" height="23" rx="5" fill="#2a2a31"/><rect x="' + (cx - w - 10) + '" y="' + (yEye - 7) + '" width="13" height="23" rx="5" fill="#33333b"/><path d="M' + (cx + w + 4) + " " + (yEye + 14) + " Q" + (cx + w - 4) + " " + (yBouche + 4) + " " + (cx + 13) + " " + (yBouche + 2) + '" stroke="#1e1e24" stroke-width="2.6" fill="none"/><ellipse cx="' + (cx + 12) + '" cy="' + (yBouche + 2) + '" rx="3.2" ry="2.6" fill="#1e1e24"/>';
    if (o.boucle) s += '<circle cx="' + (cx - w - 2) + '" cy="' + (yNez + 6) + '" r="2.4" fill="#e8c76a"/>';
    return s + '<rect width="200" height="220" fill="url(#' + idp + 'vign)"/></svg>';
  }

  /* ---------------------------------------------------- images en cache --- */
  var cache = {}, nbCache = 0;
  function cle(o, leger) { return JSON.stringify([o.nom, o.age < 14 ? "e" : o.age >= 55 ? "v" : "a", o.peau, o.cheveux, o.coupe, o.forme, o.yeux, o.barbe, o.lunettes, o.boucle, o.fem, o.role, o.tenue, o.lisere, o.fond, o.casque, o.numero, o.sourire, !!leger]); }
  function url(o, taille) {
    var leger = (taille || 200) < 90, k = cle(o, leger);
    if (!cache[k]) {
      if (nbCache > 400) { cache = {}; nbCache = 0; }
      cache[k] = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg(o, leger)); nbCache++;
    }
    return cache[k];
  }
  function html(o, taille, classe) {
    taille = taille || 40;
    return '<img class="rja ' + (classe || "") + '" src="' + url(o, taille) + '" width="' + taille + '" height="' + taille + '" alt="" loading="lazy" decoding="async">';
  }

  /* -------------------------------------------- qui est qui dans le jeu --- */
  function couleurEq(eq) { try { return (typeof window.couleurEcurie === "function" && window.couleurEcurie(eq)) || null; } catch (e) { return null; } }
  function age() { return G.age || (G.pilot && G.pilot.ageAtStart) || 20; }
  /* Ton pilote : les choix de l'éditeur, l'âge et la combinaison de ton écurie. */
  function joueur() {
    var a = (G.pilot && G.pilot.avatar) || parametres({ nom: ((G.pilot && G.pilot.prenom) || "") + " " + ((G.pilot && G.pilot.nom) || ""), nat: G.pilot && G.pilot.nat, role: "pilote" });
    var c = couleurEq(G.currentTeam) || "#1E3A8A";
    return Object.assign({}, a, { nom: "joueur", age: age(), role: "pilote", tenue: c, lisere: "#FF1801", fond: c, numero: G.pilot && G.pilot.number });
  }
  /* Un personnage du jeu, par son nom et ce qu'on sait de lui. */
  function personnage(nom, info) {
    info = info || {};
    var eq = info.equipe, c = eq ? couleurEq(eq) : null;
    var role = info.role || "civil";
    return parametres({ nom: nom, age: info.age, fem: info.fem, nat: info.nat, role: role, tenue: info.tenue || (role === "pilote" || role === "staff" ? c : null) || undefined,
      lisere: info.lisere || (c ? mix(c, "#fff", .5) : undefined), fond: info.fond || c || undefined, casque: info.casque });
  }
  /* Rôle des contacts du réseau (101) et des expéditeurs de messages. */
  var ROLE_RESEAU = { tp: "staff", dir_sport: "staff", dir_tech: "staff", ing_course: "staff", agent: "civil", journaliste: "presse", sponsor: "civil", pilote: "pilote", contact: "civil" };
  function contact(c) {
    if (!c) return null;
    return personnage(c.name, { role: ROLE_RESEAU[c.role] || "civil", equipe: c.team, casque: c.role === "ing_course", age: c.role === "tp" ? 52 : c.role === "pilote" ? 25 : 40, fond: c.color });
  }

  /* ------------------------------------------------------------ éditeur --- */
  var EDIT = {
    peau: { lbl: "Teint", val: TEINTS, type: "couleur" },
    forme: { lbl: "Visage", val: Object.keys(FORMES), noms: { ovale: "Ovale", carre: "Carré", rond: "Rond", long: "Allongé", triangle: "Fin" } },
    coupe: { lbl: "Coupe", val: COUPES, type: "apercu" },
    cheveux: { lbl: "Cheveux", val: CHEVEUX, type: "couleur" },
    yeux: { lbl: "Yeux", val: YEUX, type: "couleur" },
    barbe: { lbl: "Barbe", val: [null, "courte", "pleine"], noms: { "null": "Rasé", courte: "Courte", pleine: "Pleine" } },
    lunettes: { lbl: "Lunettes", val: [false, true], noms: { "false": "Sans", "true": "Avec" } },
    fem: { lbl: "Traits", val: [false, true], noms: { "false": "Masculins", "true": "Féminins" } }
  };
  function editeur(hote, valeurs, quandChange) {
    var v = Object.assign({}, valeurs);
    function apercuJoueur() { return Object.assign({}, v, { nom: "joueur", age: age(), role: "pilote", tenue: couleurEq(G.currentTeam) || "#1E3A8A", lisere: "#FF1801", fond: couleurEq(G.currentTeam) || "#7a1a14", numero: G.pilot && G.pilot.number }); }
    function rendre() {
      var h = '<div class="rja-ed"><div class="rja-ed-grand">' + html(apercuJoueur(), 220) + '<button type="button" class="rja-hasard" data-hasard="1">Aléatoire</button></div><div class="rja-ed-choix">';
      Object.keys(EDIT).forEach(function (k) {
        var e = EDIT[k];
        h += '<div class="rja-ligne"><span>' + e.lbl + '</span><div class="rja-opts">' + e.val.map(function (x, i) {
          var on = String(v[k]) === String(x) ? " on" : "";
          if (e.type === "couleur") return '<button type="button" class="rja-pastille' + on + '" data-k="' + k + '" data-i="' + i + '" style="background:' + x + '" aria-label="' + e.lbl + " " + (i + 1) + '"></button>';
          if (e.type === "apercu") return '<button type="button" class="rja-mini' + on + '" data-k="' + k + '" data-i="' + i + '">' + html(Object.assign({}, apercuJoueur(), { coupe: x, role: "civil", tenue: "#2a2a33" }), 44) + "</button>";
          return '<button type="button" class="rja-puce' + on + '" data-k="' + k + '" data-i="' + i + '">' + e.noms[String(x)] + "</button>";
        }).join("") + "</div></div>";
      });
      hote.innerHTML = h + "</div></div>";
    }
    hote.onclick = function (ev) {
      var b = ev.target.closest && ev.target.closest("[data-k], [data-hasard]");
      if (!b) return;
      if (b.hasAttribute("data-hasard")) v = Object.assign(parametres({ nom: "hasard" + Math.random(), nat: G.pilot && G.pilot.nat, fem: v.fem }), { fem: v.fem });
      else { var k = b.getAttribute("data-k"); v[k] = EDIT[k].val[+b.getAttribute("data-i")]; if (k === "fem" && v.fem && v.barbe) v.barbe = null; }
      rendre();
      if (quandChange) quandChange(v);
    };
    rendre();
    return { valeurs: function () { return v; } };
  }
  function valeursJoueur() {
    if (G.pilot && G.pilot.avatar) return G.pilot.avatar;
    var p = parametres({ nom: ((G.pilot && G.pilot.prenom) || "Pilote") + " " + ((G.pilot && G.pilot.nom) || ""), nat: G.pilot && G.pilot.nat, role: "pilote", age: 25 });
    return { peau: p.peau, forme: p.forme, coupe: p.coupe === "degarni" ? "courts" : p.coupe, cheveux: p.cheveux, yeux: p.yeux, barbe: p.barbe, lunettes: false, fem: p.fem, sourire: true };
  }
  function enregistrer(v) {
    G.pilot.avatar = { peau: v.peau, forme: v.forme, coupe: v.coupe, cheveux: v.cheveux, yeux: v.yeux, barbe: v.barbe, lunettes: v.lunettes, fem: v.fem, sourire: v.sourire !== false, boucle: !!v.boucle };
    rafraichirBandeau();
  }

  /* Création de carrière : l'éditeur rejoint l'étape « numéro de course ». */
  var edCreation = null;
  function brancherCreation() {
    var etape = document.getElementById("cs5");
    if (!etape || document.getElementById("rja-creation")) return;
    var bloc = document.createElement("div");
    bloc.id = "rja-creation";
    bloc.innerHTML = '<div class="t-sec">Ton visage</div><div id="rja-creation-ed"></div><div class="t-sec">Ton numéro</div>';
    etape.insertBefore(bloc, etape.firstChild);   // le visage d'abord, le numéro ensuite
    edCreation = editeur(document.getElementById("rja-creation-ed"), valeursJoueur(), enregistrer);
    enregistrer(edCreation.valeurs());
  }

  /* Modifier son avatar en cours de carrière : une feuille depuis le bandeau. */
  function ouvrirEditeur() {
    var voile = document.createElement("div");
    voile.className = "rja-voile";
    voile.innerHTML = '<div class="rja-feuille"><div class="t-sec">Ton visage</div><div class="rja-hote"></div><div class="rja-actions"><button type="button" class="rja-annuler">Annuler</button><button type="button" class="rja-valider">Valider</button></div></div>';
    document.body.appendChild(voile);
    var ed = editeur(voile.querySelector(".rja-hote"), valeursJoueur());
    voile.addEventListener("click", function (e) {
      if (e.target.classList.contains("rja-valider")) { enregistrer(ed.valeurs()); voile.remove(); try { if (typeof saveGame === "function") saveGame(G._slot || 0); } catch (er) {} }
      else if (e.target.classList.contains("rja-annuler") || e.target === voile) voile.remove();
    });
    requestAnimationFrame(function () { voile.classList.add("on"); });
  }

  /* ------------------------------------------ partout dans le jeu ------ */
  function rafraichirBandeau() {
    if (!G || !G.pilot) return;
    var src = url(joueur(), 120);
    ["h-avatar", "p-avatar"].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || (id === "h-avatar" && G.pilot.avatarPhoto)) return;
      el.classList.add("has-photo", "rja-fond");
      el.style.backgroundImage = 'url("' + src + '")';
      el.style.backgroundSize = "cover"; el.style.backgroundPosition = "center 18%";
      var ini = document.getElementById("h-avatar-initials");
      if (id === "h-avatar" && ini) ini.textContent = ""; else if (id === "p-avatar") el.textContent = "";
    });
  }

  /* Messagerie : l'avatar de la personne, pas ses initiales. */
  var ROLE_MAIL = { team_boss: "staff", team: "staff", journalist: "presse", rival: "pilote", agent: "civil", family: "civil", friends: "civil", sponsor: "civil" };
  function avatarMail(e, t) {
    if (!e || (typeof _mailIsPerson === "function" && !_mailIsPerson(e) && !e.contactKey)) return null;
    var c = e.contactKey && G._network && G._network[e.contactKey];
    var o = c ? contact(c) : personnage(e.from, { role: ROLE_MAIL[e.role] || "civil", age: e.role === "family" ? 55 : undefined, fem: /mère|Maman/i.test(e.from) ? true : undefined });
    return '<div class="rja-rond" style="width:' + t + "px;height:" + t + 'px">' + html(o, t) + "</div>";
  }

  /* Réseaux sociaux (66) : le même visage pour un pilote partout. */
  function avatarSocial(nom) {
    var me = G.pilot && nom && nom.indexOf(G.pilot.nom || "@@") >= 0;
    return '<div class="rja-rond" style="width:40px;height:40px">' + html(me ? joueur() : personnage(nom, { role: "pilote" }), 40) + "</div>";
  }

  /* Classement (championnat et accueil) : un visage devant chaque nom. */
  function decorerClassement() {
    var cibles = document.querySelectorAll("#S-champ .cr, .apex-champ-mini-row");
    cibles.forEach(function (row) {
      if (row.querySelector(".rja")) return;
      var nomEl = row.querySelector(".cr-name, .nom");
      if (!nomEl) return;
      var nom = (nomEl.textContent || "").trim(), plein = G.pilot ? ((G.pilot.prenom || "") + " " + (G.pilot.nom || "")).trim() : "@@";
      var moi = row.classList.contains("moi") || nom === plein || /background:var\(--red-lo\)/.test(row.getAttribute("style") || "");
      var riv = (G.rivals || []).filter(function (x) { return x.name && nom.indexOf(x.name.split(" ").pop()) >= 0; })[0];
      var o = moi ? joueur() : personnage(riv ? riv.name : nom, { role: "pilote", equipe: riv && riv.team, nat: riv && riv.nat, age: riv && riv.age });
      var t = document.createElement("span");
      t.className = "rja-rond rja-classement";
      t.innerHTML = html(o, 32);
      nomEl.insertBefore(t, nomEl.firstChild);   // dans le nom : la grille de la ligne ne bouge pas
    });
  }

  /* ------------------------------------------------------ installation --- */
  function installer() {
    if (typeof rjInscrire !== "function" || typeof window.G === "undefined") return false;
    if (typeof window._renderMailAvatar === "function") rjInscrire("_renderMailAvatar", { id: "128-avatars:mail", remplace: function (args, suite) { var h = null; try { h = avatarMail(args[0], args[1] || 40); } catch (e) {} return h || suite(); } });
    if (typeof window.updateUI === "function") rjInscrire("updateUI", { id: "128-avatars:updateUI", apres: function () { try { rafraichirBandeau(); decorerClassement(); } catch (e) {} } });
    if (typeof window.renderChamp === "function") rjInscrire("renderChamp", { id: "128-avatars:renderChamp", apres: function () { try { decorerClassement(); } catch (e) {} } });
    if (typeof window._refreshAvatar === "function") rjInscrire("_refreshAvatar", { id: "128-avatars:refresh", apres: function () { try { rafraichirBandeau(); } catch (e) {} } });
    if (typeof window.updateCreUI === "function") rjInscrire("updateCreUI", { id: "128-avatars:creation", apres: function () { try { if (window.creStep === 5) brancherCreation(); } catch (e) { console.warn(TAG, e && e.message); } } });
    if (typeof window._showAvatarMenu === "function") rjInscrire("_showAvatarMenu", { id: "128-avatars:menu", apres: function () {
      var carte = document.querySelector("#apex-avatar-menu .apex-avatar-menu-card");
      if (!carte || carte.querySelector(".rja-menu")) return;
      var b = document.createElement("button");
      b.className = "apex-avatar-menu-btn rja-menu"; b.innerHTML = "<span>Modifier mon avatar</span>";
      b.onclick = function () { if (typeof _closeAvatarMenu === "function") _closeAvatarMenu(); ouvrirEditeur(); };
      var titre = carte.querySelector(".apex-avatar-menu-title");
      carte.insertBefore(b, titre ? titre.nextSibling : carte.firstChild);
    } });
    window._rj66Avatar = avatarSocial;
    if (!Array.isArray(window.RJ_SCREEN_HOOKS)) window.RJ_SCREEN_HOOKS = [];
    window.RJ_SCREEN_HOOKS.push({ id: "128-avatars", ecran: "*", apres: function () { setTimeout(function () { try { decorerClassement(); rafraichirBandeau(); } catch (e) {} }, 60); } });
    rafraichirBandeau();
    return true;
  }
  var essais = 0;
  function boot() {
    if (installer()) { console.log(TAG, "actif — portraits générés pour tous les personnages"); return; }
    if (essais++ < 80) setTimeout(boot, 150);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  window.RJAvatar = { parametres: parametres, svg: svg, url: url, html: html, joueur: joueur, personnage: personnage, contact: contact, editeur: editeur, ouvrirEditeur: ouvrirEditeur, enregistrer: enregistrer, FORMES: FORMES };
  window._rj128Uninstall = function () { rjDesinscrire(["128-avatars:"]); window.RJ_SCREEN_HOOKS = (window.RJ_SCREEN_HOOKS || []).filter(function (h) { return h.id !== "128-avatars"; }); delete window.RJAvatar; };
})();
