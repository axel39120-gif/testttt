/* =====================================================================
 * 162-logos.js — LES LOGOS DES ÉCURIES HORS F1
 *
 * Même direction artistique que les écuries de F1 (63-ecuries) : champ en
 * dégradé, emblème en matière (métal, arêtes, reflets, ombre portée), nom de
 * l'écurie. Dessins originaux : un emblème par écurie, aux couleurs que le
 * joueur connaît, sans reprendre les marques réelles.
 * 63 les lit par window.RJDessins[equipe] avant les anciens tracés au trait.
 * =================================================================== */
(function () {
  "use strict";

  /* Emblèmes dans un cadre 40 × 28. m : métal de l'écurie ; a : accent ; o : ombre (trait sombre) ; w : reflet. */
  function P(d, f, x) { return '<path d="' + d + '" fill="' + f + '"' + (x ? " " + x : "") + "/>"; }
  var T = 'stroke="url(#o)" stroke-width=".45" stroke-linejoin="round"', W = 'fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".5" stroke-linecap="round"';
  function L(d, f, w) { return '<path d="' + d + '" fill="none" stroke="' + f + '" stroke-width="' + (w || 1) + '" stroke-linecap="round" stroke-linejoin="round"/>'; }
  var m = "url(#m)", a = "url(#a)";
  var E = {
    trident: P("M20 4l2.600 4.200-1.300-.3V17h3.400c2.800 0 4.300-2 4.300-5V9.700l-1.700.8 3.200-6 3.200 6-1.700-.8V12.500c0 5.200-3.200 8.500-8 8.500h-2.700v7h-2.600v-7H16c-4.800 0-8-3.300-8-8.500V9.700l-1.700.8 3.200-6 3.200 6-1.700-.8V12c0 3 1.500 5 4.300 5h3.400V7.900l-1.300.3z", m, T) + L("M19.400 9v8", "#fff", .4),
    chevrons: P("M20 4l14 13v6L20 10.500 6 23v-6z", m, T) + P("M20 13.500l11 10v4.300L20 18 9 27.800v-4.300z", a, T) + L("M7 17L20 5l13 12", "#fff", .4),
    couronne: P("M7 24L5 9l8 6 7-10 7 10 8-6-2 15z", m, T) + P("M7 24.600h26v3.400H7z", a, T) + '<g fill="#fff"><circle cx="5" cy="8.500" r="1.400"/><circle cx="20" cy="4.500" r="1.600"/><circle cx="35" cy="8.500" r="1.400"/></g>' + L("M10 21h20", "#fff", .5),
    etoile: P("M20 3l4 8.700 9.500 1-7.100 6.400 2 9.400L20 23.700l-8.400 4.800 2-9.400-7.100-6.400 9.500-1z", m, T) + P("M20 3v20.700l-8.400 4.800 2-9.400-7.100-6.400 9.500-1z", "#000", 'opacity=".2"') + L("M20 3l4 8.700 9.500 1", "#fff", .5),
    eclair: P("M23 3L9 17.500h8L14 28l17-15.500h-9L27 3z", m, T) + L("M22.600 4L11 16.300", "#fff", .6) + P("M4 9h9l-2.500 2.500H4zM3 14h6l-2 2H3z", a),
    aigle: P("M20 8c2-3 5-3 7-2 4-1 8 0 10 2-3 .2-5 1-6 2 2 .3 3 1 3.500 2-3-.2-5 .5-6 1.500 1.500.3 2.500 1 3 2-4 0-7 1.500-8.500 5L20 28l-3-7.500c-1.500-3.500-4.500-5-8.500-5 .5-1 1.500-1.700 3-2-1-1-3-1.700-6-1.500.5-1 1.500-1.700 3.500-2-1-1-3-1.800-6-2 2-2 6-3 10-2 2-1 5-1 7 2z", m, T) + P("M20 8l2 2.500-2 3-2-3z", a) + L("M5 9c4-1 8 0 11 3M35 9c-4-1-8 0-11 3", "#fff", .4),
    faucon: P("M5 7c8 0 13 2 16 6 3-2 8-3 14-2-5 1-8 3-9 6 3 0 5 1 6 3-4-.500-7 .5-9 3l-3 5-2-6c-1-4-4-6-9-7 2-1 4-1 6-.500C12 11 9 9 5 7z", m, T) + P("M24 13.500l3.500-.5-2 2z", a) + L("M8 8c6 1 10 3 12 7", "#fff", .5),
    lion: P("M20 3l6 2 5 5 1 7-3 6-5 4-4 1-4-1-5-4-3-6 1-7 5-5z", a, T) + P("M20 7l5 2 3 4-1 3 1 3-4 5-4 2-4-2-4-5 1-3-1-3 3-4z", m, T) + P("M15 14.500l3.500 1.500-1 1.500-3-1zM25 14.500L21.500 16l1 1.500 3-1zM18.200 20h3.600L20 22.200z", "#120a04") + L("M20 22.200v1.600M17.500 24.500c1.500 1 3.500 1 5 0", "#120a04", .6) + L("M16 9.500l4-1.500 4 1.500", "#fff", .4),
    lynx: P("M8 4l6 4c4-1.500 8-1.500 12 0l6-4-1 11c0 7-5 11.500-11 13-6-1.500-11-6-11-13z", m, T) + P("M11 8l3 2-2 3zM29 8l-3 2 2 3z", a) + P("M12.500 15.500l5.500 1.500-1.500 2.200zM27.500 15.500L22 17l1.500 2.200z", "#ffe27a") + P("M18.300 22h3.400L20 24.200z", "#111") + L("M20 10v6M16 9.500l2 3M24 9.500l-2 3", "#111", .7),
    loup: P("M7 3l8 6h10l8-6-1 13-5 7-7 5-7-5-5-7z", m, T) + P("M7 3l8 6-3 7-4-1zM33 3l-8 6 3 7 4-1z", a) + P("M13 15.500l5 1-2.500 2.500zM27 15.500l-5 1 2.500 2.500zM18 24h4l-2 3z", "#0b0d12") + L("M20 10l-2 9 2 5 2-5z", "#fff", .4),
    requin: P("M4 24c4-3 8-4 12-4C15 13 18 7 24 4c-1 6 1 11 5 14 3 1 5 3 7 6-5-2-9-2-12-1l2 4c-4 0-7-1-9-3-4-.500-8 0-13 0z", m, T) + L("M22 7c-3 4-4 8-4 12", "#fff", .5) + P("M30 20.500l1.500.5-1.300.8z", a),
    cheval: P("M12.500 28h18c.5-5-.5-9-2.500-12 1-6-2.500-10.500-9-12l-1-2.500-2.300 3C11 6.500 9 10.500 6.500 14.500l2.300 3.700c2.200.3 4-1.700 6.200-1.700 1 3.500-2.500 5.500-2.500 11.500z", m, T) + P("M19 4c6.500 1.500 10 6 9 12 2 3 3 7 2.500 12h-4c.5-5-.5-9-3-12 .5-5-1-9-4.500-12z", a, T) + '<circle cx="14.500" cy="9.800" r=".9" fill="#111"/>' + L("M9 14.500l1.500.5M17 6c-3 1.500-5 4-6.500 7", "#fff", .45) + P("M11 29.200h20.500v1.300H11z", m),
    phenix: P("M20 4c1 4 4 5 5 9 3-1 5-4 5-8 4 5 4 12-1 16-3 3-6 4-9 7-3-3-6-4-9-7C6 17 6 10 10 5c0 4 2 7 5 8 1-4 4-5 5-9z", m, T) + P("M20 13c.5 3 3 4 3 7 0 2-1 4-3 6-2-2-3-4-3-6 0-3 2.500-4 3-7z", a) + L("M10.500 8c0 4 2 7 5 8", "#fff", .4),
    montagne: P("M3 27L15 8l5 7 4-6 13 18z", m, T) + P("M15 8l-4 6.500 3 1 2-1.500 2 2 1.800-1.200zM24 9l-2.600 4 2 .8 1.500-1 2 2 1.600-.5z", "#fff") + P("M3 27l9-5 6 3 8-4 11 6z", a, 'opacity=".85"'),
    soleil: '<g fill="url(#a)">' + [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(function (r) { return '<path d="M20 2.500l1.700 5h-3.400z" transform="rotate(' + r + ' 20 16)"/>'; }).join("") + '</g><circle cx="20" cy="16" r="7.800" fill="url(#m)" ' + T + '/><path d="M14.500 13a6.500 6.500 0 0 1 9-3" ' + W + '/>',
    vague: P("M3 21c5-10 13-15 23-14-3 1-5 3-5 6 3-2 8-2 10 2-3-1-5 0-6 2 4 0 8 2 12 5-8-1-12 4-20 4-5 0-9-2-14-5z", m, T) + L("M6 20c5-7 10-10 16-11M9 23c6 2 12 1 17-2", "#fff", .5) + P("M3 25c9 4 22 4 34-1-9 6-24 8-34 1z", a),
    feuille: P("M20 3c9 4 13 10 11 18-5 1-8 0-10-2l-.5 9h-1l-.5-9c-2 2-5 3-10 2C7 13 11 7 20 3z", m, T) + L("M20 6v14M20 12l5-3M20 16l6-2M20 12l-5-3M20 16l-6-2", "#0a1a0a", .6) + L("M12 11c2-3 4-5 7-6", "#fff", .4),
    fleur: '<g ' + T + '>' + [0, 60, 120, 180, 240, 300].map(function (r, i) { return '<path d="M20 16c-4-3-4-9 0-13 4 4 4 10 0 13z" fill="' + (i % 2 ? a : m) + '" transform="rotate(' + r + ' 20 16)"/>'; }).join("") + '</g><circle cx="20" cy="16" r="3" fill="#fff5c2" stroke="url(#o)" stroke-width=".5"/>',
    engrenage: '<g fill="url(#m)" ' + T + '>' + [0, 45, 90, 135, 180, 225, 270, 315].map(function (r) { return '<path d="M17.500 3h5l.8 4.500h-6.600z" transform="rotate(' + r + ' 20 16)"/>'; }).join("") + '<circle cx="20" cy="16" r="9.500"/></g><circle cx="20" cy="16" r="6" fill="url(#f)" stroke="url(#a)" stroke-width="1.200"/>' + P("M20 11l1.500 3.500 3.700.3-2.800 2.500.9 3.700-3.300-2-3.300 2 .9-3.700-2.800-2.500 3.700-.3z", a),
    volant: '<circle cx="20" cy="16" r="11.500" fill="none" stroke="url(#o)" stroke-width="4.400"/><circle cx="20" cy="16" r="11.500" fill="none" stroke="url(#m)" stroke-width="3.500"/>' + P("M10 14h20l-2 4h-5l-2 9h-2l-2-9h-5z", a, T) + '<circle cx="20" cy="16" r="3" fill="url(#m)" ' + T + '/><path d="M11 9.500a11.500 11.500 0 0 1 11-5" ' + W + '/>',
    piston: P("M13 4h14v9H13z", m, T) + L("M13 6.500h14M13 9h14", "#0008", .7) + P("M18 13h4l1.500 8h-7z", a, T) + '<circle cx="20" cy="24" r="4.300" fill="url(#m)" ' + T + '/><circle cx="20" cy="24" r="1.800" fill="url(#f)"/>' + L("M15 4.800v7.500", "#fff", .5),
    casque: P("M7 19C7 10 13 4 21 4c8 0 13 6 13 13v3l-3 6H12c-3 0-5-3-5-7z", m, T) + P("M17 12h16.500l.5 5.500-3 2H19c-2 0-3-2-2-7.500z", "#0c1016", T) + P("M10 10c3-4 8-5.500 14-5l-8 5.500z", a) + L("M19 13.500h12", "#fff", .6),
    samourai: P("M20 3l2.500 5C28 9 31 13 31 18l4 4-6 1-3 5-6-2-6 2-3-5-6-1 4-4c0-5 3-9 8.500-10z", m, T) + P("M20 1.500c-1 4-6 6-12 5 3 3 7 4 12 3 5 1 9 0 12-3-6 1-11-1-12-5z", a, T) + P("M13 17h14l-1.500 4h-11z", "#0c0c10") + L("M15 13h10", "#fff", .5),
    torii: P("M4 7c10 2.500 22 2.500 32 0v4c-10 2-22 2-32 0z", m, T) + P("M7 14h26v3H7z", a, T) + P("M10 11.500h4L13 28H9zM26 11.500h4L31 28h-4z", m, T) + L("M6 8.500c9 2 19 2 28 0", "#fff", .4),
    dragon: P("M6 25c2-10 7-14 13-14l-3-4 6 1 1-5 3 5 8 1-4 3 4 3-5 2 2 5-5-2c-1 5-5 8-11 8 3-2 4-4 4-7-4 1-8 3-13 4z", m, T) + P("M6 25c3-5 7-8 12-9-3 4-7 7-12 9z", a) + '<circle cx="26" cy="11.500" r="1" fill="#fff"/>' + L("M11 18c3-4 6-5 9-5", "#fff", .4),
    boussole: '<circle cx="20" cy="16" r="12.500" fill="url(#f)" stroke="url(#m)" stroke-width="2"/>' + P("M20 5l3 11-3 11-3-11z", m, T) + P("M9 16l11-3 11 3-11 3z", a, T) + '<circle cx="20" cy="16" r="1.800" fill="#fff"/>',
    globe: '<circle cx="20" cy="16" r="12.500" fill="url(#m)" ' + T + '/>' + L("M7.500 16h25M20 3.500c-8 7-8 18 0 25M20 3.500c8 7 8 18 0 25M10 9.500c6 3 14 3 20 0M10 22.500c6-3 14-3 20 0", "#000a", .8) + P("M6 22C14 14 24 9 35 7c-8 4-16 9-24 18z", a, T),
    helice: '<g ' + T + '>' + [0, 120, 240].map(function (r, i) { return '<path d="M20 16c-5-4-5-9 0-13.500 5 3 5 9 0 13.500z" fill="' + (i ? m : a) + '" transform="rotate(' + r + ' 20 16)"/>'; }).join("") + '</g><circle cx="20" cy="16" r="3.300" fill="url(#m)" ' + T + '/>',
    flamme: P("M21 3c1 5 8 8 8 16 0 5-4 9-9 9s-9-4-9-9c0-4 2-6 4-9 0 3 1 4 3 5 0-5 1-8 3-12z", m, T) + P("M20.500 14c1 3 4 5 4 8 0 3-2 5-4.500 5s-4.500-2-4.500-5c0-2 1-3 2-5 .5 2 1 2.500 2 3 0-2 0-4 1-6z", a) + L("M20 6c-1 4-2 6-1.500 10", "#fff", .5),
    diamant: P("M11 5h18l7 8-16 15L4 13z", m, T) + P("M11 5l3 8h12l3-8zM14 13l6 15 6-15z", a, 'opacity=".75"') + L("M4 13h32M11 5l3 8 6 15 6-15 3-8", "#fff", .4),
    hexa: P("M20 2.500l12 6.800v13.400l-12 6.800-12-6.800V9.300z", m, T) + P("M20 7l8 4.600v8.800L20 25l-8-4.600v-8.800z", "url(#f)") + P("M15 10.500h3v4h4v-4h3v11h-3v-4h-4v4h-3z", a, T) + L("M9 10l11-6.200", "#fff", .6),
    cible: '<circle cx="20" cy="16" r="12.500" fill="url(#m)" ' + T + '/><circle cx="20" cy="16" r="9" fill="url(#f)"/><circle cx="20" cy="16" r="6" fill="url(#a)"/><circle cx="20" cy="16" r="2.600" fill="#fff"/>' + P("M33 3l3 1-1 3-13 10-1-1z", m, T),
    aile: P("M3 9h34l-4 5H12zM8 16h25l-3 4H15zM14 22h15l-2.500 4H18z", m, T) + P("M3 9l9 5 3 6 3 6-9-8z", a, T) + L("M6 10h29", "#fff", .5),
    damier: P("M6 3h2.500v25H6z", m, T) + P("M9 5c8-4 15 4 26 0v16C24 25 17 17 9 21z", "#f4f4f6", T) + '<g fill="#111">' + [[9, 5], [16, 5.500], [23, 6.500], [12.500, 9.500], [19.500, 10.500], [27, 10.500], [9, 13.500], [16, 13.500], [23, 14.500], [30, 13]].map(function (p) { return '<path d="M' + p[0] + " " + p[1] + 'h4v4h-4z"/>'; }).join("") + "</g>" + P("M9 5c8-4 15 4 26 0v4C24 13 17 5 9 9z", a, 'opacity=".55"'),
    laurier: '<g fill="url(#m)" ' + T + '>' + [0, 1, 2, 3, 4].map(function (i) { var y = 25 - i * 5, x = 14 - Math.sin(i * .75) * 6; return '<path d="M' + x + " " + y + 'c-5 0-6-3-6-5 3 0 6 1 6 5z"/><path d="M' + (40 - x) + " " + y + 'c5 0 6-3 6-5-3 0-6 1-6 5z"/>'; }).join("") + "</g>" + P("M20 6l3 6 6.500.7-5 4.300 1.500 6.500-6-3.500-6 3.500 1.500-6.500-5-4.300L17 12z", a, T),
    pont: L("M4 24h32", m, 2.600) + L("M11 27V5M29 27V5", m, 2.600) + L("M3 21C6 15 9 10 11 5c3 10 15 10 18 0 2 5 5 10 8 16", a, 1.200) + L("M15 12v10M20 13v9M25 12v10M7 16v6M33 16v6", "#fff8", .6),
    soldat: P("M9 12c0-6 5-9 11-9s11 3 11 9l2 5h-4l-1 11h-4l-1-8h-6l-1 8h-4l-1-11H7z", m, T) + P("M17 1.500h6l1 8h-8z", a, T) + P("M13 14h5v3h-5zM22 14h5v3h-5z", "#0b0b0e") + L("M13 8c2-2 4-3 6-3", "#fff", .5),
    sceau: P("M20 2.500l3 2.500 4-.8 1.500 3.700 4 1.200-.3 4 2.800 3-2.800 3 .3 4-4 1.200-1.500 3.700-4-.8-3 2.500-3-2.500-4 .8-1.500-3.700-4-1.200.3-4L5 16.100l2.800-3-.3-4 4-1.200 1.500-3.700 4 .8z", m, T) + '<circle cx="20" cy="16" r="8.500" fill="url(#f)" stroke="url(#a)" stroke-width="1"/>',
    bouclier: P("M7 4h26v11c0 7-5 11-13 14C12 26 7 22 7 15z", m, T) + P("M10 7h20v8c0 5-4 8.500-10 11-6-2.500-10-6-10-11z", "url(#f)") + P("M10 15l20-8v5L10 20z", a, T) + L("M8.500 5.500h23", "#fff", .5),
    sabre: P("M6 26L28 4l6-1-1 6L11 27z", m, T) + P("M34 26L12 4 6 3l1 6 22 18z", a, T) + L("M10 24L30 5", "#fff", .5) + P("M4 24l6 5-2 1.500-5.500-5zM36 24l-6 5 2 1.500 5.500-5z", "#1a1a20", T),
    arche: P("M5 27V14C5 7 11 3 20 3s15 4 15 11v13h-6V15c0-4-4-6-9-6s-9 2-9 6v12z", m, T) + P("M14 27V17c0-3 3-4 6-4s6 1 6 4v10h-3v-9c0-1.500-6-1.500-6 0v9z", a, T) + L("M7 14c0-5 5-9 12-9.500", "#fff", .6)
  };

  /* Lettres-emblèmes : monogramme taillé, biseauté et penché. */
  function mono(t) {
    var n = t.length, s = n === 1 ? 27 : n === 2 ? 19 : n === 3 ? 14.500 : 11.500, y = n === 1 ? 25.500 : n === 2 ? 23 : 21.500;
    var tx = function (x, yy, f, e) { return '<text x="' + x + '" y="' + yy + '" text-anchor="middle" font-family="Arial Black,Impact,sans-serif" font-weight="900" font-style="italic" font-size="' + s + '" fill="' + f + '" ' + (e || "") + ">" + t + "</text>"; };
    return tx(20.700, y + .9, "#000", 'opacity=".55"') + tx(20, y, m, 'stroke="url(#o)" stroke-width=".7" paint-order="stroke"') + P("M5 " + (y + 2.200) + "h28l-2 2.200H3z", a, T);
  }

  /* champ clair, champ foncé, métal clair, métal foncé, accent clair, accent foncé */
  var C = {
    orange: ["#3a1a06", "#120701", "#ffb066", "#e85d00", "#fff1dd", "#f5a623"], bleu: ["#0c3a78", "#04122b", "#dff1ff", "#3f9bff", "#ffd34d", "#e09a00"], cyan: ["#074a5c", "#021820", "#d8fbff", "#12b6d6", "#ffffff", "#8bd7e6"],
    rouge: ["#7d0d12", "#250204", "#ffd9d4", "#f0332b", "#ffffff", "#c9ccd2"], noir: ["#2d3036", "#08090b", "#ffffff", "#9aa1ab", "#ff4a3d", "#b3120c"], vert: ["#0c5a35", "#03200f", "#dcffe9", "#27c46f", "#ffe36b", "#e0a800"],
    jaune: ["#3b3206", "#131001", "#fff5b0", "#f2bd00", "#ffffff", "#c7cad0"], violet: ["#3d1a78", "#12062b", "#efe0ff", "#9a5bff", "#ffcf5a", "#e08a00"], rose: ["#6b0d4a", "#220316", "#ffdcf1", "#f0469f", "#ffffff", "#f7b6d8"],
    marine: ["#16275c", "#060c22", "#ffffff", "#aebbe0", "#ff3b3b", "#b00d14"], acier: ["#4a525e", "#15181d", "#ffffff", "#b4bcc8", "#3ec3ff", "#0a78c2"], or: ["#4a3410", "#180f02", "#fff0c2", "#d9a032", "#ffffff", "#d5c7a3"],
    turquoise: ["#07584f", "#021f1b", "#d4fff8", "#17c8b0", "#ff8a3d", "#d94f00"], blanc: ["#f4f6fa", "#c4ccda", "#4c86ff", "#123a9c", "#ff4a3d", "#b3120c"], blancr: ["#f7f5f3", "#d6cfc8", "#f04438", "#8f0f0a", "#33373f", "#0c0d10"], brique: ["#5c2413", "#1d0903", "#ffe0cf", "#e8743b", "#ffd86b", "#d99a12"]
  };
  /* écurie : [couleurs, emblème ou « =monogramme », mot] */
  var D = {
    "Tony Kart": ["vert", "=TK", "TONY KART"], "Exprit Racing": ["cyan", "aile", "EXPRIT"], "KR Sport": ["noir", "=KR", "KR SPORT"], "Parolin Motorsport": ["rouge", "bouclier", "PAROLIN"], "Birel ART": ["rouge", "eclair", "BIREL ART"], "CRG Racing": ["jaune", "=CRG", "RACING"],
    "Zanardi Kart": ["violet", "=Z", "ZANARDI"], "Kosmic Racing": ["orange", "soleil", "KOSMIC"], "LN Racing Kart": ["marine", "=LN", "RACING KART"], "Ricciardo Kart": ["jaune", "volant", "RICCIARDO"], "OTK Kart Group": ["rouge", "engrenage", "OTK GROUP"], "Formula K": ["cyan", "=K", "FORMULA K"],
    "Sodi Kart": ["turquoise", "casque", "SODI KART"], "Praga Kart": ["brique", "pont", "PRAGA"], "Alpha Kart": ["acier", "loup", "ALPHA"], "DR Kart": ["violet", "=DR", "KART"], "Energy Corse": ["jaune", "eclair", "ENERGY"], "Lenze Kart": ["bleu", "piston", "LENZE"],
    "Prema Racing": ["rouge", "chevrons", "PREMA"], "Van Amersfoort Racing": ["orange", "lion", "VAN AMERSFOORT"], "PHM Racing": ["noir", "phenix", "PHM RACING"], "US Racing": ["marine", "etoile", "US RACING"], "Jenzer Motorsport": ["rouge", "montagne", "JENZER"], "ART Grand Prix": ["bleu", "=ART", "GRAND PRIX"],
    "R-ace GP": ["noir", "=R", "R-ACE GP"], "MP Motorsport": ["orange", "=MP", "MOTORSPORT"], "Trident": ["bleu", "trident", "TRIDENT"], "Hitech GP": ["acier", "hexa", "HITECH"], "DAMS": ["jaune", "damier", "DAMS"], "Virtuosi Racing": ["blanc", "sabre", "VIRTUOSI"], "Carlin": ["marine", "cheval", "CARLIN"],
    "Campos Racing": ["or", "soleil", "CAMPOS"], "BWR Motorsport": ["cyan", "diamant", "BWR"], "Iron Lynx": ["noir", "lynx", "IRON LYNX"], "Cram Motorsport": ["turquoise", "engrenage", "CRAM"], "Bhaitech Racing": ["or", "boussole", "BHAITECH"], "Xcel Racing": ["violet", "=X", "XCEL"],
    "Antonelli Motorsport": ["rouge", "=A", "ANTONELLI"], "Mugen F4": ["blancr", "samourai", "MUGEN F4"], "AKM Motorsport": ["vert", "faucon", "AKM"], "EFC Sports": ["brique", "=EFC", "SPORTS"], "G4 Racing": ["violet", "=G4", "RACING"], "Rodin Motorsport": ["rose", "cible", "RODIN"], "AIX Racing": ["turquoise", "requin", "AIX RACING"],
    "Charouz Racing": ["rose", "dragon", "CHAROUZ"], "Monolite Racing": ["acier", "arche", "MONOLITE"], "Toyota Gazoo Racing": ["blancr", "torii", "GAZOO"], "TOM'S": ["bleu", "=TOM", "TOM'S"], "Honda Racing": ["rouge", "aile", "HONDA"], "Dandelion Racing": ["blancr", "fleur", "DANDELION"], "Nakajima Racing": ["bleu", "vague", "NAKAJIMA"],
    "Kondoh Racing": ["noir", "dragon", "KONDOH"], "Cerumo Inging": ["vert", "feuille", "CERUMO"], "Mugen": ["noir", "samourai", "MUGEN"], "TGM Grand Prix": ["orange", "=TGM", "GRAND PRIX"], "Itochu Enex Team Impul": ["cyan", "helice", "IMPUL"], "Kygnus Sunoco Team": ["jaune", "phenix", "KYGNUS"], "Real Racing": ["marine", "couronne", "REAL RACING"],
    "Ferrari AF Corse": ["rouge", "cheval", "AF CORSE"], "Porsche Penske Motorsport": ["or", "bouclier", "PENSKE"], "Cadillac Racing": ["acier", "couronne", "CADILLAC"], "BMW M Team": ["blanc", "helice", "M TEAM"], "Peugeot TotalEnergies": ["acier", "lion", "PEUGEOT"], "Alpine Endurance": ["bleu", "montagne", "ALPINE"], "Glickenhaus Racing": ["brique", "aigle", "GLICKENHAUS"],
    "United Autosports": ["marine", "globe", "UNITED"], "AF Corse": ["jaune", "cheval", "AF CORSE"], "Proton Competition": ["violet", "boussole", "PROTON"], "Cool Racing": ["cyan", "vague", "COOL RACING"], "Inter Europol Competition": ["vert", "=IE", "EUROPOL"], "Richard Mille Racing": ["noir", "=RM", "RACING"], "Inception Racing": ["violet", "diamant", "INCEPTION"],
    "Team Penske": ["marine", "damier", "PENSKE"], "Chip Ganassi Racing": ["rouge", "etoile", "GANASSI"], "Andretti Global": ["bleu", "globe", "ANDRETTI"], "Arrow McLaren": ["orange", "faucon", "ARROW"], "Rahal Letterman Lanigan": ["marine", "=RLL", "RACING"], "Ed Carpenter Racing": ["noir", "soldat", "CARPENTER"], "Dale Coyne Racing": ["brique", "laurier", "DALE COYNE"],
    "AJ Foyt Enterprises": ["rouge", "aigle", "AJ FOYT"], "Dreyer Reinbold Racing": ["acier", "piston", "DREYER"], "Juncos Hollinger Racing": ["turquoise", "flamme", "JUNCOS"], "Meyer Shank Racing": ["rose", "sceau", "MEYER SHANK"], "ECR / Foyt": ["or", "=ECR", "FOYT"]
  };

  function dessiner(c, emb, mot) {
    var k = C[c], g = function (id, x, y, s) { return '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + x + '" y2="' + y + '">' + s + "</linearGradient>"; }, st = function (o, col) { return '<stop offset="' + o + '" stop-color="' + col + '"/>'; };
    var clair = c.indexOf("blanc") === 0, t = Math.min(4.300, 30 / (mot.length * .8));
    var corps = emb.charAt(0) === "=" ? mono(emb.slice(1)) : E[emb];
    if (emb === "sceau") corps += '<text x="20" y="19.300" text-anchor="middle" font-family="Arial Black,Impact,sans-serif" font-weight="900" font-size="8.500" fill="url(#m)">' + mot.split(" ").map(function (x) { return x[0]; }).join("") + "</text>";
    return '<svg viewBox="0 0 40 40" width="40" height="40"><defs>' + g("f", 0, 1, st(0, k[0]) + st(1, k[1])) + g("m", .25, 1, st(0, k[2]) + st(".46", k[3]) + st(".54", k[3]) + st(1, k[2])) + g("a", 0, 1, st(0, k[4]) + st(1, k[5])) + g("o", 0, 1, st(0, "#00000066") + st(1, "#000000cc")) +
      '<radialGradient id="h" cx=".5" cy=".4" r=".55">' + '<stop offset="0" stop-color="' + k[3] + '" stop-opacity=".38"/><stop offset="1" stop-color="' + k[3] + '" stop-opacity="0"/></radialGradient></defs>' +
      '<rect width="40" height="40" fill="url(#f)"/><rect width="40" height="40" fill="url(#h)"/><path d="M-4 36L30-4h6L-4 44z" fill="#fff" opacity=".045"/>' +
      '<g transform="translate(0 1.500)"><g transform="translate(.7 1)" opacity=".35">' + corps.replace(/fill="(?!none)[^"]*"/g, 'fill="#000"').replace(/stroke="(?!none)[^"]*"/g, 'stroke="#000"') + "</g>" + corps + "</g>" +
      '<rect x="4" y="31.300" width="32" height="6" rx="1.200" fill="' + (clair ? "#0f1420" : "#000") + '" opacity="' + (clair ? ".92" : ".5") + '"/><rect x="4" y="31.300" width="32" height="6" rx="1.200" fill="none" stroke="url(#a)" stroke-width=".5"/>' +
      '<text x="20" y="' + (34.300 + t * .36).toFixed(2) + '" text-anchor="middle" font-family="Arial Black,Impact,sans-serif" font-size="' + t.toFixed(2) + '" font-weight="900" fill="#fff" letter-spacing=".2">' + mot + "</text></svg>";
  }

  window.RJDessins = {};
  Object.keys(D).forEach(function (t) { window.RJDessins[t] = dessiner(D[t][0], D[t][1], D[t][2]); });
})();
