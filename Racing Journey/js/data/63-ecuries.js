/* =====================================================================
 * 63-ecuries.js — IDENTITÉ ET ÉVOLUTION DES ÉCURIES
 *
 * Regroupe les deux modules qui donnent leur caractère aux équipes : leur
 * identité visuelle et leur nom d'une part, leur profil sportif et son
 * évolution au fil des saisons d'autre part. Les deux partagent la même
 * matière — l'écurie — et l'un renomme ce que l'autre affiche.
 * =================================================================== */

/* ==================================================================== *
 * Identité — noms, logos, onglets
 * (anciennement 63-team-identity.js)
 * ==================================================================== */

(function () {
  "use strict";

  var wrapped = {};
  var etat = { installe: false, erreur: null };
  window._rj63Status = function () { return etat; };

  /* ------------------------------------------------------- couleurs */
  var NUANCIER = [
    "#FF1801", "#E10600", "#FF6B00", "#F59E0B", "#FFD400",
    "#34D399", "#00A85A", "#00D4FF", "#0090D0", "#1E5BC6",
    "#5B4BE0", "#A78BFA", "#EC4899", "#B00050", "#8B5A2B",
    "#C0C0C8", "#7A8290", "#0E7C6B", "#7CB342", "#E0E0E6"
  ];

  function clamp(v) { return Math.max(0, Math.min(255, Math.round(v))); }
  function hex2rgb(h) {
    h = String(h || "#FF1801").replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
  }
  function rgb2hex(r, g, b) {
    return "#" + [r, g, b].map(function (v) {
      var s = clamp(v).toString(16); return s.length < 2 ? "0" + s : s;
    }).join("");
  }
  function melange(hex, vers, t) {
    var a = hex2rgb(hex), b = hex2rgb(vers);
    return rgb2hex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
  }
  function sombre(hex, t) { return melange(hex, "#000000", t || 0.45); }
  function clair(hex, t) { return melange(hex, "#FFFFFF", t || 0.35); }

  /* ------------------------------------------------- blasons d'écurie
   * Un logo d'écurie n'est pas un pictogramme : c'est un BLASON. On combine
   * donc une forme contenante (bouclier, médaillon, ovale, écusson), un
   * emblème (aile, fauve, laurier, couronne, éclair…) et le MONOGRAMME de
   * l'écurie, tiré de son nom. C'est ce monogramme qui donne immédiatement
   * l'impression d'une vraie marque plutôt que d'une icône.
   * ---------------------------------------------------------------- */

  /* Le mot qui porte l'écurie (« Scuderia Rossa » → ROSSA), pour la plaque à lettrage. */
  function motCourt(nom) {
    var n = String(nom || "RJ").replace(/\b(racing|team|motorsport|f1|gp|sport|scuderia|ecurie|écurie|engineering|works|kart|corse|grand|prix|competition)\b/gi, " ").trim();
    var mots = n.split(/[\s\-\/]+/).filter(function (m) { return m.length > 1; });
    var m = (mots.sort(function (a, b) { return b.length - a.length; })[0] || n || "RJ").toUpperCase();
    return m.length > 8 ? m.slice(0, 8) : m;
  }

  function initiales(nom) {
    var n = String(nom || "").trim();
    if (!n) return "RJ";
    // On retire les suffixes d'équipe qui n'apportent rien au monogramme.
    n = n.replace(/\b(racing|team|motorsport|f1|gp|sport|scuderia|ecurie|écurie|engineering|works)\b/gi, " ").trim();
    var liaison = { de: 1, du: 1, des: 1, la: 1, le: 1, les: 1, "l": 1, "d": 1, and: 1, "&": 1 };
    var mots = n.split(/[\s\-']+/).filter(function (m) {
      return m.length > 0 && !liaison[m.toLowerCase()];
    });
    // Un seul mot -> une seule lettre : « Renault » donne R, plus lisible et
    // plus proche d'un vrai monogramme qu'un « RE ».
    if (mots.length <= 1) return (mots[0] || n).charAt(0).toUpperCase();
    if (mots.length === 2) return (mots[0][0] + mots[1][0]).toUpperCase();
    return (mots[0][0] + mots[1][0] + mots[2][0]).toUpperCase();
  }

  var POLICE = "Impact, 'Arial Black', 'Helvetica Neue', sans-serif";

  /* Contexte du logo en cours de dessin : identifiants des dégradés. */
  var R = null, _uid = 0;
  function contexte(C, D, L) {
    // préfixe propre aux logos : un id court (« rjf24 ») croisait ceux d'autres modules
    var n = ++_uid, p = "rjlogo" + n + "-", id = { fond: p + "fond", metal: p + "metal", plein: p + "plein", lettre: p + "lettre", reflet: p + "reflet", ombre: p + "ombre" };
    return { C: C, L: L, id: id, extra: "", def: '<defs>' +
      '<radialGradient id="' + id.fond + '" cx="28%" cy="18%" r="95%"><stop offset="0" stop-color="' + melange(C, "#15151b", .78) + '"/><stop offset="1" stop-color="#08080b"/></radialGradient>' +
      '<linearGradient id="' + id.metal + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbfbfd"/><stop offset=".42" stop-color="' + L + '"/><stop offset=".58" stop-color="' + C + '"/><stop offset="1" stop-color="' + D + '"/></linearGradient>' +
      '<linearGradient id="' + id.plein + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + melange(C, "#000000", .42) + '"/><stop offset="1" stop-color="' + melange(C, "#000000", .86) + '"/></linearGradient>' +
      '<linearGradient id="' + id.lettre + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="' + L + '"/><stop offset="1" stop-color="' + C + '"/></linearGradient>' +
      '<linearGradient id="' + id.reflet + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".22"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>' +
      '<filter id="' + id.ombre + '" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation=".7" flood-color="#000" flood-opacity=".7"/></filter>' +
      '</defs>' };
  }
  function u(cle) { return R ? "url(#" + R.id[cle] + ")" : null; }

  function mono(txt, x, y, taille, fill) {
    // Aux couleurs de l'écurie : lettres gravées (dégradé clair, contour sombre).
    var grave = R && (fill === R.C || fill === R.L);
    if (grave) fill = u("lettre");
    // Une lettre seule peut être plus grande ; trois lettres doivent rétrécir
    // pour ne pas déborder du blason.
    var n = String(txt || "").length;
    if (n <= 1) taille = taille * 1.22;
    else if (n >= 3) taille = taille * 0.74;
    return '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-family="' + POLICE +
           '" font-size="' + taille + '" font-weight="900" letter-spacing="-0.5" fill="' + fill + '"' +
           (grave ? ' stroke="#050507" stroke-width=".9" paint-order="stroke"' : '') + '>' + txt + '</text>';
  }

  /* Emblèmes réutilisables, dessinés pour tenir dans un blason. */
  var EMB = {
    aile: function (C, L) {
      return '<path d="M9 20 h22 l-4 3 H13z" fill="' + C + '"/>' +
             '<path d="M12 16 h16 l-3 3 H15z" fill="' + L + '" opacity=".9"/>';
    },
    fauve: function (C, L) {   // silhouette animale cabrée, stylisée
      return '<path d="M17 26 c-1-4 0-7 2-9 c1-1 1-3 0-4 c2 0 3 1 4 3 c2-1 3 0 4 2 c-1 0-2 1-2 2 c1 2 1 5 0 7 ' +
             'l2 4 h-3 l-2-3 -1 3 h-3 l1-4z" fill="' + C + '"/>';
    },
    rapace: function (C, L) {
      return '<path d="M20 14 l9 5 -5 1 3 4 -7-3 -7 3 3-4 -5-1z" fill="' + C + '"/>' +
             '<path d="M20 18 v8" stroke="' + L + '" stroke-width="1.6"/>';
    },
    laurier: function (C, L) {
      return '<path d="M13 27 C9 23 9 17 13 13" fill="none" stroke="' + C + '" stroke-width="2"/>' +
             '<path d="M27 27 C31 23 31 17 27 13" fill="none" stroke="' + C + '" stroke-width="2"/>';
    },
    couronne: function (C, L) {
      return '<path d="M12 22 L14 13 l4 5 2-6 2 6 4-5 2 9z" fill="' + C + '"/>' +
             '<rect x="12" y="23" width="16" height="2.6" fill="' + L + '"/>';
    },
    eclair: function (C, L) {
      return '<path d="M22 10 L14 22 h5l-2 9 9-13h-5z" fill="' + C + '"/>';
    },
    trident: function (C, L) {
      return '<path d="M20 10 v18 M13 14 v6 M27 14 v6" stroke="' + C + '" stroke-width="2.6" stroke-linecap="round"/>' +
             '<path d="M12 20 h16" stroke="' + C + '" stroke-width="2.6" stroke-linecap="round"/>';
    },
    etoile: function (C, L) {
      return '<path d="M20 11 l2.6 5.4 6 .9-4.3 4.2 1 6L20 24.6 14.7 27.5l1-6L11.4 17.3l6-.9z" fill="' + C + '"/>';
    },
    chevron: function (C, L) {
      return '<path d="M11 24 L20 15 L29 24" fill="none" stroke="' + C + '" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>';
    },
    roue: function (C, L) {
      return '<circle cx="20" cy="20" r="7" fill="none" stroke="' + C + '" stroke-width="2.2"/>' +
             '<path d="M13 19 h14 M20 20 v7" stroke="' + C + '" stroke-width="2"/>';
    }
  };

  /* Formes contenantes : plein en dégradé, contour en métal, liseré intérieur. */
  function relief(debut, C, D) {
    if (!R) return debut + ' fill="' + D + '" stroke="' + C + '" stroke-width="2"/>';
    return debut + ' fill="' + u("plein") + '" stroke="' + u("metal") + '" stroke-width="2.4"/>' +
           debut + ' fill="none" stroke="rgba(255,255,255,.16)" stroke-width=".6" transform="translate(20 20) scale(.84) translate(-20 -20)"/>';
  }
  function bouclier(C, D) { return relief('<path d="M20 3 L34 8 v13c0 9-7 14-14 16-7-2-14-7-14-16V8z"', C, D); }
  function medaillon(C, D) { return relief('<circle cx="20" cy="20" r="16"', C, D); }
  function ovale(C, D) { return relief('<ellipse cx="20" cy="20" rx="17" ry="12"', C, D); }
  function ecusson(C, D) { return relief('<path d="M6 7 h28 v18 l-14 9 -14-9z"', C, D); }
  function hexa(C, D) { return relief('<path d="M20 3 L34 11 v18 L20 37 L6 29 V11z"', C, D); }

  var MODELES = {
    // --- blasons à monogramme ---
    bouclier_mono: function (C, D, L, ini) { return bouclier(C, D) + mono(ini, 20, 26, 15, C); },
    medaillon_mono: function (C, D, L, ini) { return medaillon(C, D) + mono(ini, 20, 26, 15, C); },
    ovale_mono: function (C, D, L, ini) { return ovale(C, D) + mono(ini, 20, 26, 14, C); },
    ecusson_mono: function (C, D, L, ini) { return ecusson(C, D) + mono(ini, 20, 24, 14, C); },
    hexa_mono: function (C, D, L, ini) { return hexa(C, D) + mono(ini, 20, 26, 14, C); },

    // --- blason + emblème + monogramme ---
    bouclier_aile: function (C, D, L, ini) { return bouclier(C, D) + EMB.aile(C, L) + mono(ini, 20, 33, 9, L); },
    bouclier_fauve: function (C, D, L, ini) { return bouclier(C, D) + EMB.fauve(C, L); },
    bouclier_eclair: function (C, D, L, ini) { return bouclier(C, D) + EMB.eclair(C, L) + mono(ini, 20, 35, 8, L); },
    bouclier_couronne: function (C, D, L, ini) { return bouclier(C, D) + EMB.couronne(C, L) + mono(ini, 20, 33, 9, L); },
    medaillon_laurier: function (C, D, L, ini) { return medaillon(C, D) + EMB.laurier(C, L) + mono(ini, 20, 25, 13, C); },
    medaillon_etoile: function (C, D, L, ini) { return medaillon(C, D) + EMB.etoile(C, L) + mono(ini, 20, 34, 8, L); },
    medaillon_rapace: function (C, D, L, ini) { return medaillon(C, D) + EMB.rapace(C, L) + mono(ini, 20, 32, 8, L); },
    ovale_chevron: function (C, D, L, ini) { return ovale(C, D) + EMB.chevron(C, L) + mono(ini, 20, 31, 8, L); },
    ovale_trident: function (C, D, L, ini) { return ovale(C, D) + EMB.trident(C, L); },
    hexa_roue: function (C, D, L, ini) { return hexa(C, D) + EMB.roue(C, L) + mono(ini, 20, 34, 8, L); },
    ecusson_fauve: function (C, D, L, ini) { return ecusson(C, D) + EMB.fauve(C, L); },

    // --- blasons à bande, très courants en sport auto ---
    bande_diagonale: function (C, D, L, ini) {
      return bouclier(C, D) + '<path d="M6 24 L34 12 v6 L6 30z" fill="' + C + '" opacity=".9"/>' + mono(ini, 20, 22, 11, "#0d0d12");
    },
    double_bande: function (C, D, L, ini) {
      return medaillon(C, D) + '<path d="M4 16 h32 v3.4 H4z M4 22 h32 v3.4 H4z" fill="' + C + '"/>' + mono(ini, 20, 34, 8, L);
    },
    banniere: function (C, D, L, ini) {
      return '<path d="M6 8 h28 v16 l-14 7 -14-7z" fill="' + D + '" stroke="' + C + '" stroke-width="2"/>' +
             '<rect x="4" y="26" width="32" height="8" rx="2" fill="' + C + '"/>' +
             mono(ini, 20, 20, 11, C) + mono("RACING", 20, 32, 5.4, "#0d0d12");
    },
    ecu_partage: function (C, D, L, ini) {
      return '<path d="M20 3 L34 8 v13c0 9-7 14-14 16 V3z" fill="' + C + '" opacity=".9"/>' +
             '<path d="M20 3 L6 8 v13c0 9 7 14 14 16z" fill="' + D + '"/>' +
             '<path d="M20 3 L34 8 v13c0 9-7 14-14 16-7-2-14-7-14-16V8z" fill="none" stroke="' + C + '" stroke-width="2"/>' +
             mono(ini, 20, 26, 13, L);
    },

    // --- plaque à lettrage : le nom de l'écurie, comme un logo de marque ---
    plaque_lettrage: function (C, D, L, ini, nom) {
      var mot = motCourt(nom), larg = Math.min(29, 4.2 * mot.length + 4);
      return '<rect x="3" y="11" width="34" height="18" rx="3" fill="' + (u("plein") || D) + '" stroke="' + (u("metal") || C) + '" stroke-width="1.8"/>' +
             '<rect x="3" y="25.5" width="34" height="2" fill="' + C + '"/>' +
             '<text x="20" y="23.2" text-anchor="middle" font-family="' + POLICE + '" font-size="9" font-weight="900" textLength="' + larg + '" lengthAdjust="spacingAndGlyphs" fill="' + (u("lettre") || L) + '" stroke="#050507" stroke-width=".7" paint-order="stroke">' + mot + '</text>';
    },
    bouclier_damier: function (C, D, L, ini) {
      var cases = "";
      for (var y = 0; y < 3; y++) for (var x = 0; x < 3; x++) if ((x + y) % 2 === 0) cases += '<rect x="' + (8 + x * 3.6) + '" y="' + (9 + y * 3.6) + '" width="3.6" height="3.6" fill="#f2f2f4" opacity=".85"/>';
      return bouclier(C, D) + cases + mono(ini, 24, 30, 12, C);
    },

    // --- emblèmes sans contenant, façon marque ---
    aile_libre: function (C, D, L, ini) {
      return '<path d="M4 21 h32 v3.4 H4z" fill="' + C + '"/>' +
             '<path d="M8 14 h24 l-4 5 H12z" fill="' + C + '" opacity=".75"/>' +
             mono(ini, 20, 34, 9, L);
    },
    fleche_marque: function (C, D, L, ini) {
      return '<path d="M20 6 L33 20 h-7v12h-12V20H7z" fill="' + C + '"/>' + mono(ini, 20, 29, 8, "#0d0d12");
    },
    monogramme_barre: function (C, D, L, ini) {
      return mono(ini, 20, 24, 19, C) + '<rect x="7" y="28" width="26" height="3.4" fill="' + C + '"/>';
    },
    cercle_barre: function (C, D, L, ini) {
      return '<circle cx="20" cy="20" r="15" fill="none" stroke="' + C + '" stroke-width="2.4"/>' +
             '<path d="M6 27 h28" stroke="' + C + '" stroke-width="3"/>' + mono(ini, 20, 24, 13, C);
    }
  };


  /* ------------------------------------------------- emblèmes purs -----
   * Beaucoup de marques automobiles se passent d'initiales : un losange,
   * des chevrons, un anneau suffisent à identifier la marque. Cette
   * seconde famille suit ce principe — formes symétriques, jeux de plein
   * et de vide, dégradés discrets pour donner du relief. Aucune n'imite
   * une marque existante : ce sont des compositions inventées.
   * ------------------------------------------------------------------ */

  var _gradN = 0;
  function grad(C, L) {
    var id = "rjlogo-g" + (++_gradN);
    var def = '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
           '<stop offset="0%" stop-color="' + L + '"/><stop offset="100%" stop-color="' + C + '"/>' +
           '</linearGradient></defs>';
    if (R) { R.extra += def; def = ""; }   // rangé avec les autres définitions du logo
    return { id: id, def: def };
  }

  var EMBLEMES = {
    losange_creux: function (C, D, L) {
      var g = grad(C, L);
      return g.def +
        '<path d="M20 3 L35 20 L20 37 L5 20z" fill="none" stroke="url(#' + g.id + ')" stroke-width="3"/>' +
        '<path d="M20 11 L28 20 L20 29 L12 20z" fill="url(#' + g.id + ')"/>';
    },
    losange_barre: function (C, D, L) {
      var g = grad(C, L);
      return g.def +
        '<path d="M20 4 L34 20 L20 36 L6 20z" fill="' + D + '" stroke="' + C + '" stroke-width="2"/>' +
        '<path d="M8 20 h24" stroke="url(#' + g.id + ')" stroke-width="3.4"/>' +
        '<path d="M20 8 v24" stroke="' + C + '" stroke-width="1.4" opacity=".5"/>';
    },
    triple_chevron: function (C, D, L) {
      return '<path d="M9 15 L20 6 L31 15 L20 11z" fill="' + L + '"/>' +
             '<path d="M9 24 L20 15 L31 24 L20 20z" fill="' + C + '"/>' +
             '<path d="M9 33 L20 24 L31 33 L20 29z" fill="' + D + '" stroke="' + C + '" stroke-width=".8"/>';
    },
    chevrons_inverses: function (C, D, L) {
      return '<path d="M8 12 L20 22 L32 12 L32 18 L20 28 L8 18z" fill="' + C + '"/>' +
             '<path d="M8 24 L20 34 L32 24 L32 28 L20 38 L8 28z" fill="' + L + '" opacity=".55"/>';
    },
    anneaux_lies: function (C, D, L) {
      var g = grad(C, L);
      return g.def +
        '<circle cx="15" cy="20" r="10" fill="none" stroke="url(#' + g.id + ')" stroke-width="2.8"/>' +
        '<circle cx="25" cy="20" r="10" fill="none" stroke="' + C + '" stroke-width="2.8" opacity=".75"/>';
    },
    orbite: function (C, D, L) {
      return '<ellipse cx="20" cy="20" rx="16" ry="7" fill="none" stroke="' + C + '" stroke-width="2.2" transform="rotate(-28 20 20)"/>' +
             '<ellipse cx="20" cy="20" rx="16" ry="7" fill="none" stroke="' + L + '" stroke-width="2.2" opacity=".6" transform="rotate(28 20 20)"/>' +
             '<circle cx="20" cy="20" r="4.4" fill="' + C + '"/>';
    },
    aile_abstraite: function (C, D, L) {
      var g = grad(C, L);
      return g.def +
        '<path d="M4 24 C12 14 24 12 36 14 C28 20 18 24 4 24z" fill="url(#' + g.id + ')"/>' +
        '<path d="M8 30 C16 22 26 20 34 21 C27 26 19 30 8 30z" fill="' + C + '" opacity=".5"/>';
    },
    fleche_orbitale: function (C, D, L) {
      return '<circle cx="20" cy="20" r="15" fill="none" stroke="' + C + '" stroke-width="2.2" opacity=".55"/>' +
             '<path d="M20 6 L28 20 L20 16 L12 20z" fill="' + C + '"/>' +
             '<path d="M20 34 L12 20 L20 24 L28 20z" fill="' + L + '" opacity=".8"/>';
    },
    triangles_croises: function (C, D, L) {
      return '<path d="M20 5 L34 29 H6z" fill="none" stroke="' + C + '" stroke-width="2.4"/>' +
             '<path d="M20 35 L6 11 h28z" fill="none" stroke="' + L + '" stroke-width="2.4" opacity=".7"/>' +
             '<circle cx="20" cy="20" r="3.4" fill="' + C + '"/>';
    },
    noeud_hexa: function (C, D, L) {
      var g = grad(C, L);
      return g.def +
        '<path d="M20 4 L33 12 v16 L20 36 L7 28 V12z" fill="none" stroke="url(#' + g.id + ')" stroke-width="2.6"/>' +
        '<path d="M20 12 L27 16 v8 L20 28 L13 24 v-8z" fill="' + C + '" opacity=".55"/>' +
        '<path d="M13 16 L27 24 M27 16 L13 24" stroke="' + C + '" stroke-width="1.4" opacity=".45"/>';
    },
    arcs_concentriques: function (C, D, L) {
      return '<path d="M8 26 A14 14 0 0 1 32 26" fill="none" stroke="' + C + '" stroke-width="3"/>' +
             '<path d="M12 28 A10 10 0 0 1 28 28" fill="none" stroke="' + L + '" stroke-width="2.6" opacity=".8"/>' +
             '<path d="M16 30 A6 6 0 0 1 24 30" fill="none" stroke="' + C + '" stroke-width="2.2" opacity=".6"/>';
    },
    vortex: function (C, D, L) {
      return '<path d="M20 6 C30 8 34 18 30 26 C27 32 19 34 14 30 C10 27 10 21 14 19 C18 17 22 20 21 24" ' +
             'fill="none" stroke="' + C + '" stroke-width="2.8" stroke-linecap="round"/>' +
             '<circle cx="20" cy="26" r="2.6" fill="' + L + '"/>';
    },
    lances: function (C, D, L) {
      return '<path d="M12 6 L28 34" stroke="' + C + '" stroke-width="3" stroke-linecap="round"/>' +
             '<path d="M28 6 L12 34" stroke="' + L + '" stroke-width="3" stroke-linecap="round" opacity=".75"/>' +
             '<circle cx="20" cy="20" r="7" fill="#0d0d12" stroke="' + C + '" stroke-width="2"/>';
    },
    cocarde: function (C, D, L) {
      var g = grad(C, L);
      return g.def +
        '<circle cx="20" cy="20" r="15" fill="' + D + '" stroke="' + C + '" stroke-width="1.6"/>' +
        '<path d="M5 20 a15 15 0 0 1 30 0z" fill="url(#' + g.id + ')"/>' +
        '<circle cx="20" cy="20" r="5" fill="#0d0d12" stroke="' + C + '" stroke-width="1.6"/>';
    },
    sommets: function (C, D, L) {
      var g = grad(C, L);
      return g.def +
        '<path d="M4 32 L14 14 L20 24 L26 10 L36 32z" fill="url(#' + g.id + ')"/>' +
        '<path d="M14 14 L18 21 h-8z" fill="#0d0d12" opacity=".6"/>';
    },
    carres_entrelaces: function (C, D, L) {
      return '<rect x="8" y="8" width="16" height="16" fill="none" stroke="' + C + '" stroke-width="2.6"/>' +
             '<rect x="16" y="16" width="16" height="16" fill="none" stroke="' + L + '" stroke-width="2.6" opacity=".8"/>' +
             '<rect x="16" y="16" width="8" height="8" fill="' + C + '" opacity=".55"/>';
    },
    goutte_double: function (C, D, L) {
      var g = grad(C, L);
      return g.def +
        '<path d="M20 4 C26 13 30 18 30 23 a10 10 0 0 1-20 0 c0-5 4-10 10-19z" fill="url(#' + g.id + ')"/>' +
        '<path d="M20 15 C23 20 25 22 25 24 a5 5 0 0 1-10 0 c0-2 2-4 5-9z" fill="#0d0d12" opacity=".55"/>';
    },
    horizon: function (C, D, L) {
      var g = grad(C, L);
      return g.def +
        '<circle cx="20" cy="20" r="15" fill="none" stroke="' + C + '" stroke-width="2.2"/>' +
        '<path d="M6 22 a14 14 0 0 0 28 0z" fill="url(#' + g.id + ')" opacity=".85"/>' +
        '<path d="M6 22 h28" stroke="' + L + '" stroke-width="1.8"/>';
    }
  };

  /* ------------------------------------------- famille « sport auto » -----
   * Ce qui fait un logo de course : un lettrage penché, des traits de
   * vitesse, des bandes de capot, un damier, des ailes, un numéro. Toutes
   * ces compositions sont inventées ; aucune ne reprend une marque réelle.
   * ------------------------------------------------------------------ */
  function penche(txt, x, y, taille, fill, largeur) {
    return '<g transform="translate(' + x + ' ' + y + ') skewX(-14)"><text x="0" y="0" text-anchor="middle" font-family="' + POLICE +
      '" font-size="' + taille + '" font-weight="900"' + (largeur ? ' textLength="' + largeur + '" lengthAdjust="spacingAndGlyphs"' : '') +
      ' fill="' + fill + '" stroke="#050507" stroke-width=".8" paint-order="stroke">' + txt + '</text></g>';
  }
  function vitesse(x, y, C, L) {   // trois traits de vitesse, du plus long au plus court
    return '<path d="M' + x + ' ' + y + ' h9 l-1.6 2.4 h-9z" fill="' + C + '"/>' +
           '<path d="M' + (x + 2) + ' ' + (y + 4) + ' h7 l-1.6 2.4 h-7z" fill="' + L + '"/>' +
           '<path d="M' + (x + 4) + ' ' + (y + 8) + ' h5 l-1.6 2.4 h-5z" fill="' + C + '" opacity=".7"/>';
  }
  var COURSE = {
    course_lettrage: function (C, D, L, ini, nom) {
      var mot = motCourt(nom), larg = Math.min(21, 3.2 * mot.length + 3);
      return '<rect x="2" y="9" width="36" height="22" rx="3" fill="' + (u("plein") || D) + '" stroke="' + (u("metal") || C) + '" stroke-width="1.4"/>' +
             vitesse(4, 13, C, L) +
             penche(mot, 24, 23, 9.5, u("lettre") || L, larg) +
             '<path d="M12 27 Q24 24.5 36 25.5" fill="none" stroke="' + C + '" stroke-width="1.6" stroke-linecap="round"/>';
    },
    course_monogramme: function (C, D, L, ini) {
      return '<path d="M3 13 h9 l-1.4 2 h-9z M2 18 h7 l-1.4 2 h-7z M3 23 h5 l-1.4 2 h-5z" fill="' + C + '"/>' +
             penche(ini, 23, 26, ini.length > 2 ? 14 : 19, u("lettre") || L) +
             '<path d="M8 32 Q22 27.5 37 29" fill="none" stroke="' + C + '" stroke-width="2.4" stroke-linecap="round"/>' +
             '<path d="M12 33.6 Q24 30 36 31" fill="none" stroke="' + L + '" stroke-width=".9" stroke-linecap="round" opacity=".8"/>';
    },
    course_ecu_bandes: function (C, D, L, ini) {
      return bouclier(C, D) +
             '<path d="M15.5 5 h3.4 v30 l-3.4-1.6z M21.1 5 h3.4 v28.4 l-3.4 1.6z" fill="' + L + '" opacity=".45"/>' +
             penche(ini, 20, 26, ini.length > 2 ? 11 : 15, u("lettre") || L);
    },
    course_ailes: function (C, D, L, ini) {
      var aile = 'M18 19 L3 12 L7 16.5 L2 17.5 L8 20.5 L4 22.5 L17 23.5z';
      return '<path d="' + aile + '" fill="' + (u("metal") || C) + '"/>' +
             '<path d="' + aile + '" fill="' + (u("metal") || C) + '" transform="translate(40 0) scale(-1 1)"/>' +
             '<circle cx="20" cy="21" r="7.4" fill="' + (u("plein") || D) + '" stroke="' + C + '" stroke-width="1.6"/>' +
             penche(ini, 20.4, 24.2, ini.length > 2 ? 6 : 8.5, u("lettre") || L);
    },
    course_damier: function (C, D, L, ini, nom) {
      var cases = "";
      for (var y = 0; y < 3; y++) for (var x = 0; x < 5; x++)
        cases += '<rect x="' + (x * 4) + '" y="' + (y * 4) + '" width="4" height="4" fill="' + ((x + y) % 2 ? C : "#f2f2f4") + '"/>';
      return '<path d="M8 6 v26" stroke="' + (u("metal") || C) + '" stroke-width="1.6" stroke-linecap="round"/>' +
             '<g transform="translate(9 7) skewY(-8)">' + cases + '</g>' +
             (motCourt(nom).length <= 6 ? penche(motCourt(nom), 20, 33, 7, u("lettre") || L, Math.min(24, 4 * motCourt(nom).length + 2)) : penche(ini, 21, 34, 9, u("lettre") || L));
    },
    course_chevrons: function (C, D, L, ini) {
      return '<path d="M3 12 L11 20 L3 28 h5 L16 20 L8 12z" fill="' + C + '"/>' +
             '<path d="M10 12 L18 20 L10 28 h4 L22 20 L14 12z" fill="' + L + '" opacity=".85"/>' +
             penche(ini, 30, 25, ini.length > 2 ? 9 : 13, u("lettre") || L);
    },
    course_bandes_capot: function (C, D, L, ini) {
      return '<rect x="5" y="4" width="30" height="32" rx="9" fill="' + (u("plein") || D) + '" stroke="' + (u("metal") || C) + '" stroke-width="1.6"/>' +
             '<path d="M15 4.6 h4 v30.8 h-4z M21 4.6 h4 v30.8 h-4z" fill="' + C + '"/>' +
             '<rect x="8" y="23" width="24" height="9" rx="2" fill="#050507" opacity=".75"/>' +
             penche(ini, 20, 30.8, ini.length > 2 ? 7.5 : 9.5, u("lettre") || L);
    },
    course_numero: function (C, D, L, ini, nom) {
      var n = String(hache(nom || ini) % 98 + 2);
      return '<ellipse cx="20" cy="20" rx="16.5" ry="13" fill="#f4f4f6" stroke="' + (u("metal") || C) + '" stroke-width="2.6"/>' +
             '<ellipse cx="20" cy="20" rx="13.6" ry="10.2" fill="none" stroke="' + C + '" stroke-width="1"/>' +
             '<g transform="translate(20.6 25.6) skewX(-12)"><text x="0" y="0" text-anchor="middle" font-family="' + POLICE + '" font-size="' + (n.length > 1 ? 15 : 17) + '" font-weight="900" fill="#0b0b0e">' + n + '</text></g>';
    }
  };
  Object.keys(COURSE).forEach(function (k) { MODELES[k] = COURSE[k]; });
  var IDS_COURSE = Object.keys(COURSE);

  // Les emblèmes ne reçoivent pas de monogramme : signature à 3 arguments.
  Object.keys(EMBLEMES).forEach(function (k) {
    var f = EMBLEMES[k];
    MODELES[k] = function (C, D, L) { return f(C, D, L); };
  });
  var IDS_EMBLEMES = Object.keys(EMBLEMES);

  var IDS = Object.keys(MODELES);

  function ranger(defs) {
    if (typeof document === "undefined" || !document.body) return defs;
    var hote = document.getElementById("rjlogo-defs");
    if (!hote) {
      hote = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      hote.id = "rjlogo-defs"; hote.setAttribute("aria-hidden", "true");
      hote.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden");
      document.body.appendChild(hote);
    }
    hote.insertAdjacentHTML("beforeend", defs.split("<defs>").join("").split("</defs>").join(""));
    return "";
  }

  function genLogo(id, couleur, taille, nom) {
    var C = couleur || "#FF1801";
    var D = sombre(C, 0.72), L = clair(C, 0.45);
    var f = MODELES[id] || MODELES.bouclier_mono;
    var t = taille || 40;
    var ini = initiales(nom);
    R = contexte(C, D, L);
    var corps;
    try { corps = f(C, D, L, ini, nom); } finally { var ctx = R; R = null; }
    // Les dégradés vont dans un bloc unique, toujours rendu : un logo répété dans un écran masqué
    // (display:none) rendait ses dégradés invisibles pour tous ses exemplaires.
    var defs = ranger(ctx.def + ctx.extra);
    return '<svg viewBox="0 0 40 40" width="' + t + '" height="' + t + '">' + defs +
           '<rect width="40" height="40" rx="7" fill="url(#' + ctx.id.fond + ')"/>' +
           '<g filter="url(#' + ctx.id.ombre + ')">' + corps + '</g>' +
           '<path d="M0 7 a7 7 0 0 1 7-7 h26 a7 7 0 0 1 7 7 v11 C26 14 14 14 0 18z" fill="url(#' + ctx.id.reflet + ')"/>' +
           '<rect x=".5" y=".5" width="39" height="39" rx="6.5" fill="none" stroke="rgba(255,255,255,.09)"/></svg>';
  }

  /* ---------------------------------------- blason par défaut ------ */
  var PAR_DEFAUT = ["course_lettrage", "course_monogramme", "course_ecu_bandes", "course_ailes", "course_damier", "course_chevrons",
                    "course_bandes_capot", "course_numero", "course_lettrage", "course_monogramme", "course_ailes", "course_ecu_bandes"];
  var ORIGINE = {};
  function couleurDuLogo(svg) {
    var best = null, score = -1, compte = {};
    (String(svg || "").match(/#[0-9A-Fa-f]{6}\b/g) || []).forEach(function (h) { h = h.toUpperCase(); compte[h] = (compte[h] || 0) + 1; });
    // la couleur dominante : saturée, assez claire, et la plus présente dans le logo
    Object.keys(compte).forEach(function (h) {
      var c = hex2rgb(h), mx = Math.max.apply(null, c), mn = Math.min.apply(null, c);
      var lum = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255, chroma = mx - mn;
      if (lum < 0.2) return;
      var sc = chroma + lum * 30 + compte[h] * 45;
      if (sc > score) { score = sc; best = h; }
    });
    return best || "#C0C0C8";
  }
  function hache(t) { var h = 0; t = String(t); for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0; return h; }
  // Couleurs d'écurie bien connues ; les autres sont lues dans l'ancien logo.
  var COULEURS = {
    "Ferrari": "#DC0000", "Scuderia Ferrari": "#DC0000", "Ferrari AF Corse": "#DC0000", "AF Corse": "#DC0000",
    "Red Bull Racing": "#1E41FF", "Racing Bulls": "#6692FF", "Mercedes": "#00D2BE", "Mercedes AMG F1": "#00D2BE",
    "McLaren": "#FF8000", "McLaren F1 Team": "#FF8000", "Arrow McLaren": "#FF8000", "Aston Martin": "#00806E", "Aston Martin F1": "#00806E",
    "Alpine": "#0093CC", "Alpine F1 Team": "#0093CC", "Alpine Endurance": "#0093CC", "Williams": "#005AFF", "Williams Racing": "#005AFF",
    "Haas F1 Team": "#B6BABD", "Audi": "#E4002B"
  };
  function blasonParDefaut(team) {
    if (!ORIGINE[team]) ORIGINE[team] = { logo: PAR_DEFAUT[hache(team) % PAR_DEFAUT.length], color: COULEURS[team] || couleurDuLogo(original(team)) };
    return ORIGINE[team];
  }
  /* Logo d'origine de chaque écurie (dessiné à la main dans 03), gardé tel
     quel puis légèrement retouché : coins arrondis, reflet, liseré et ombre
     intérieure. Les modèles de l'éditeur restent pour qui personnalise. */
  var ORIGINAUX = {};
  /* Écuries de F1 : dessins repris avec plus de matière (dégradés, chrome,
     ombres), dans l'esprit des logos d'origine sans copier les marques. */
  var DESSINS_F1 = {"Red Bull Racing":"<svg viewBox=\"0 0 40 40\" width=\"40\" height=\"40\"><defs><linearGradient id=\"f\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#22306b\"/><stop offset=\"1\" stop-color=\"#0a1233\"/></linearGradient><radialGradient id=\"s\" cx=\"45%\" cy=\"40%\" r=\"60%\"><stop offset=\"0\" stop-color=\"#ffe680\"/><stop offset=\"1\" stop-color=\"#f5b400\"/></radialGradient><linearGradient id=\"t\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#ff4a3d\"/><stop offset=\"1\" stop-color=\"#b3120c\"/></linearGradient></defs><rect width=\"40\" height=\"40\" fill=\"url(#f)\"/><circle cx=\"20\" cy=\"19\" r=\"7.2\" fill=\"url(#s)\"/><g id=\"b\" fill=\"url(#t)\" stroke=\"#5c0703\" stroke-width=\".35\"><path d=\"M3 22.2 C3 20.2 5.2 19 8.4 19 L13 18.6 C14.4 17.3 16 17 17.1 17.7 L19.8 16.8 L18.2 18.7 C18.8 19.7 18.5 20.9 17.4 21.5 L16.1 21.7 L15.5 25.6 L14 25.6 L13.6 22.7 L9.2 23.1 L8.3 26.8 L6.8 26.8 L6.9 23.2 C5.7 23.4 4.7 24.6 4.5 26.2 L3.3 26.2 C3.1 24.8 3.5 23.5 4.1 22.7 Z\"/></g><use href=\"#b\" transform=\"translate(40 0) scale(-1 1)\"/><rect x=\"6\" y=\"31\" width=\"28\" height=\"4.4\" rx=\"1\" fill=\"#0a1233\" stroke=\"#f5b400\" stroke-width=\".5\"/><text x=\"20\" y=\"34.4\" text-anchor=\"middle\" font-family=\"Arial Black,Impact,sans-serif\" font-size=\"3.4\" font-weight=\"900\" fill=\"#fff\" letter-spacing=\".4\">RED BULL</text></svg>",
    "Ferrari":"<svg viewBox=\"0 0 40 40\" width=\"40\" height=\"40\"><defs><linearGradient id=\"f\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#e3201b\"/><stop offset=\"1\" stop-color=\"#8f0a07\"/></linearGradient><linearGradient id=\"j\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#ffe45c\"/><stop offset=\"1\" stop-color=\"#f0b000\"/></linearGradient></defs><rect width=\"40\" height=\"40\" fill=\"url(#f)\"/><path d=\"M9 5 h22 v17 c0 7-5 11-11 13 c-6-2-11-6-11-13z\" fill=\"url(#j)\" stroke=\"#5a0000\" stroke-width=\".8\"/><path d=\"M9.4 5.4 h7.1 v3 h-7.1z\" fill=\"#009246\"/><path d=\"M16.5 5.4 h7 v3 h-7z\" fill=\"#f4f4f4\"/><path d=\"M23.5 5.4 h7.1 v3 h-7.1z\" fill=\"#ce2b37\"/><path d=\"M16.6 30 L17.2 25.6 C15.6 24.7 14.8 23.1 15.2 21.3 L12.6 18.3 C12.2 17.7 12.6 17.1 13.2 17.3 L15.8 18.5 L16 15.7 L14.4 13.9 C14.2 13.3 14.8 12.9 15.4 13.1 L17.4 14.3 C18.2 12.7 19.8 11.9 21.4 12.3 L22.6 11.1 L23 12.9 C24.4 13.7 25 15.1 24.6 16.7 L22.6 17.5 L23.2 20.1 C24.8 21.1 25.6 22.9 25.2 24.7 L27.2 28.5 L25.6 28.9 L23.6 25.9 L22 27.3 L21.6 30 Z\" fill=\"#111\"/><text x=\"20\" y=\"33\" text-anchor=\"middle\" font-family=\"Arial Black,Impact,sans-serif\" font-size=\"3.6\" font-weight=\"900\" fill=\"#111\">S F</text></svg>",
    "McLaren":"<svg viewBox=\"0 0 40 40\" width=\"40\" height=\"40\"><defs><linearGradient id=\"f\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#2a2a2e\"/><stop offset=\"1\" stop-color=\"#0c0c0e\"/></linearGradient><linearGradient id=\"p\" x1=\"0\" y1=\"1\" x2=\"1\" y2=\"0\"><stop offset=\"0\" stop-color=\"#ff6a00\"/><stop offset=\".6\" stop-color=\"#ff8a1f\"/><stop offset=\"1\" stop-color=\"#ffb35c\"/></linearGradient></defs><rect width=\"40\" height=\"40\" fill=\"url(#f)\"/><path d=\"M6 25 C10 14 22 9.5 34 11.5 C26 12.5 17 16.5 11.5 25.5 Z\" fill=\"url(#p)\"/><path d=\"M11.5 25.5 C17 18.5 25 14 34 11.5\" fill=\"none\" stroke=\"#fff\" stroke-width=\".5\" opacity=\".45\"/><g transform=\"translate(20 32) skewX(-10)\"><text x=\"0\" y=\"0\" text-anchor=\"middle\" font-family=\"Arial Black,Impact,sans-serif\" font-size=\"5\" font-weight=\"900\" fill=\"#f4f4f6\" letter-spacing=\".2\">McLAREN</text></g></svg>",
    "Mercedes":"<svg viewBox=\"0 0 40 40\" width=\"40\" height=\"40\"><defs><linearGradient id=\"f\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#1b1d20\"/><stop offset=\"1\" stop-color=\"#050607\"/></linearGradient><linearGradient id=\"m\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0\" stop-color=\"#ffffff\"/><stop offset=\".45\" stop-color=\"#c9cdd2\"/><stop offset=\".55\" stop-color=\"#8e949b\"/><stop offset=\"1\" stop-color=\"#e6e8eb\"/></linearGradient></defs><rect width=\"40\" height=\"40\" fill=\"url(#f)\"/><circle cx=\"20\" cy=\"20\" r=\"15.6\" fill=\"none\" stroke=\"#00d2be\" stroke-width=\".8\" opacity=\".55\"/><circle cx=\"20\" cy=\"20\" r=\"13.4\" fill=\"none\" stroke=\"url(#m)\" stroke-width=\"2.2\"/><path d=\"M20 7.8 L21.6 18.8 L31 26.4 L20 22.4 L9 26.4 L18.4 18.8 Z\" fill=\"url(#m)\" stroke=\"#6b7076\" stroke-width=\".3\"/><path d=\"M20 7.8 L20 22.4 M20 22.4 L31 26.4 M20 22.4 L9 26.4\" stroke=\"#ffffff\" stroke-width=\".35\" opacity=\".6\"/></svg>",
    "Aston Martin":"<svg viewBox=\"0 0 40 40\" width=\"40\" height=\"40\"><defs><linearGradient id=\"f\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#0e5a49\"/><stop offset=\"1\" stop-color=\"#022a21\"/></linearGradient><linearGradient id=\"a\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#f4f6f5\"/><stop offset=\"1\" stop-color=\"#a9b5b0\"/></linearGradient></defs><rect width=\"40\" height=\"40\" fill=\"url(#f)\"/><path d=\"M20 16 C14 14 8 13.6 3 14.6 C7 15.6 9.6 17 11 18.6 C8 18.4 6 18.8 4.6 19.6 C8.4 19.8 11.4 20.6 13.6 22 L20 22 Z\" fill=\"url(#a)\"/><path d=\"M20 16 C26 14 32 13.6 37 14.6 C33 15.6 30.4 17 29 18.6 C32 18.4 34 18.8 35.4 19.6 C31.6 19.8 28.6 20.6 26.4 22 L20 22 Z\" fill=\"url(#a)\"/><rect x=\"13.5\" y=\"16.4\" width=\"13\" height=\"5.2\" rx=\".6\" fill=\"#022a21\" stroke=\"url(#a)\" stroke-width=\".6\"/><text x=\"20\" y=\"20.4\" text-anchor=\"middle\" font-family=\"Arial,sans-serif\" font-size=\"2.6\" font-weight=\"700\" fill=\"#f4f6f5\" letter-spacing=\".25\">ASTON MARTIN</text><text x=\"20\" y=\"31\" text-anchor=\"middle\" font-family=\"Arial Black,Impact,sans-serif\" font-size=\"3.4\" font-weight=\"900\" fill=\"#cedc00\" letter-spacing=\".5\">F1 TEAM</text></svg>",
    "Alpine":"<svg viewBox=\"0 0 40 40\" width=\"40\" height=\"40\"><defs><linearGradient id=\"f\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#0b3f8f\"/><stop offset=\"1\" stop-color=\"#051a3d\"/></linearGradient><linearGradient id=\"a\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#ffffff\"/><stop offset=\"1\" stop-color=\"#7fc4ff\"/></linearGradient></defs><rect width=\"40\" height=\"40\" fill=\"url(#f)\"/><path d=\"M20 6.5 L33 29 H26.6 L20 17.4 L13.4 29 H7 Z\" fill=\"url(#a)\"/><path d=\"M20 21.6 L23.6 28 H16.4 Z\" fill=\"#ff4fa3\"/><text x=\"20\" y=\"35\" text-anchor=\"middle\" font-family=\"Arial Black,Impact,sans-serif\" font-size=\"4\" font-weight=\"900\" fill=\"#f4f8ff\" letter-spacing=\".6\">ALPINE</text></svg>",
    "Williams":"<svg viewBox=\"0 0 40 40\" width=\"40\" height=\"40\"><defs><linearGradient id=\"f\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#0a2a6e\"/><stop offset=\"1\" stop-color=\"#03112e\"/></linearGradient><linearGradient id=\"w\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#7fe0ff\"/><stop offset=\"1\" stop-color=\"#00a0de\"/></linearGradient></defs><rect width=\"40\" height=\"40\" fill=\"url(#f)\"/><path d=\"M6 10 h5.2 l3.6 13 l3.4-13 h3.6 l3.4 13 l3.6-13 H34 l-6.4 19 h-4.6 l-3-11 l-3 11 h-4.6 Z\" fill=\"url(#w)\"/><text x=\"20\" y=\"35\" text-anchor=\"middle\" font-family=\"Arial Black,Impact,sans-serif\" font-size=\"3.8\" font-weight=\"900\" fill=\"#ffffff\" letter-spacing=\".5\">WILLIAMS</text></svg>",
    "Racing Bulls":"<svg viewBox=\"0 0 40 40\" width=\"40\" height=\"40\"><defs><linearGradient id=\"f\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#f2f5fb\"/><stop offset=\"1\" stop-color=\"#c9d3e6\"/></linearGradient><linearGradient id=\"b\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#3b6cff\"/><stop offset=\"1\" stop-color=\"#1534a8\"/></linearGradient></defs><rect width=\"40\" height=\"40\" fill=\"url(#f)\"/><path d=\"M8 22 C8 14 13 9 20 9 C27 9 32 14 32 22\" fill=\"none\" stroke=\"url(#b)\" stroke-width=\"2.6\"/><path d=\"M12 15 L15.6 18 L24.4 18 L28 15 L26.6 20 C26 24 23.4 26.6 20 27.4 C16.6 26.6 14 24 13.4 20 Z\" fill=\"url(#b)\"/><circle cx=\"17.4\" cy=\"21\" r=\"1\" fill=\"#f2f5fb\"/><circle cx=\"22.6\" cy=\"21\" r=\"1\" fill=\"#f2f5fb\"/><text x=\"20\" y=\"35\" text-anchor=\"middle\" font-family=\"Arial Black,Impact,sans-serif\" font-size=\"3.6\" font-weight=\"900\" fill=\"#1534a8\" letter-spacing=\".4\">RACING BULLS</text></svg>",
    "Haas F1 Team":"<svg viewBox=\"0 0 40 40\" width=\"40\" height=\"40\"><defs><linearGradient id=\"f\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#3a3d42\"/><stop offset=\"1\" stop-color=\"#121315\"/></linearGradient><linearGradient id=\"c\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#ffffff\"/><stop offset=\"1\" stop-color=\"#b9bdc3\"/></linearGradient></defs><rect width=\"40\" height=\"40\" fill=\"url(#f)\"/><path d=\"M5 9 h30 v5 H5z\" fill=\"#e10600\"/><path d=\"M5 15.4 h30 v5 H5z\" fill=\"url(#c)\"/><text x=\"20\" y=\"31\" text-anchor=\"middle\" font-family=\"Arial Black,Impact,sans-serif\" font-size=\"9\" font-weight=\"900\" fill=\"url(#c)\" letter-spacing=\".8\">HAAS</text><text x=\"20\" y=\"35.6\" text-anchor=\"middle\" font-family=\"Arial,sans-serif\" font-size=\"2.8\" font-weight=\"700\" fill=\"#e10600\" letter-spacing=\"1\">F1 TEAM</text></svg>",
    "Audi":"<svg viewBox=\"0 0 40 40\" width=\"40\" height=\"40\"><defs><linearGradient id=\"f\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#34363a\"/><stop offset=\"1\" stop-color=\"#0c0d0f\"/></linearGradient><linearGradient id=\"c\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#ffffff\"/><stop offset=\".5\" stop-color=\"#c3c7cc\"/><stop offset=\".55\" stop-color=\"#8b9096\"/><stop offset=\"1\" stop-color=\"#e2e4e7\"/></linearGradient></defs><rect width=\"40\" height=\"40\" fill=\"url(#f)\"/><path d=\"M4 10 h32 v20 H4z\" fill=\"none\" stroke=\"url(#c)\" stroke-width=\"1.2\"/><text x=\"20\" y=\"23.6\" text-anchor=\"middle\" font-family=\"Arial Black,Impact,sans-serif\" font-size=\"10\" font-weight=\"900\" fill=\"url(#c)\" letter-spacing=\"1.2\">AUDI</text><path d=\"M8 26.6 h24\" stroke=\"#f50537\" stroke-width=\"1.6\"/><text x=\"20\" y=\"35.4\" text-anchor=\"middle\" font-family=\"Arial,sans-serif\" font-size=\"2.8\" font-weight=\"700\" fill=\"#f50537\" letter-spacing=\"1.4\">F1 TEAM</text></svg>"};
  var ALIAS_F1 = {"Scuderia Ferrari":"Ferrari","Mercedes AMG F1":"Mercedes","McLaren F1 Team":"McLaren","Aston Martin F1":"Aston Martin","Alpine F1 Team":"Alpine","Williams Racing":"Williams"};
  function original(team) {
    var dessin = DESSINS_F1[team] || DESSINS_F1[ALIAS_F1[team]];
    if (dessin) return dessin;
    if (!(team in ORIGINAUX)) ORIGINAUX[team] = (typeof TEAM_LOGOS !== "undefined" && TEAM_LOGOS[team]) || "";
    return ORIGINAUX[team];
  }
  function poli(svg, taille) {
    var tete = String(svg || "").match(/^<svg[^>]*>/);
    if (!tete) return svg;
    var t = taille || 40, n = ++_uid, p = "rjlogo" + n + "-";
    var corps = svg.slice(tete[0].length, svg.lastIndexOf("</svg>")), internes = "";
    corps = corps.replace(/<defs>([\s\S]*?)<\/defs>/g, function (_, d) { internes += d; return ""; });
    (internes.match(/\sid="[^"]+"/g) || []).concat(corps.match(/\sid="[^"]+"/g) || []).forEach(function (a) {
      var id = a.slice(5, -1), nouv = p + "i-" + id;
      function ren(t) { return t.split('id="' + id + '"').join('id="' + nouv + '"').split("url(#" + id + ")").join("url(#" + nouv + ")").split('href="#' + id + '"').join('href="#' + nouv + '"'); }
      internes = ren(internes); corps = ren(corps);
    });
    var ouverture = tete[0].replace(/swidth="[^"]*"/, " width=\"" + t + "\"").replace(/sheight="[^"]*"/, " height=\"" + t + "\"");
    var defs = ranger('<defs>' + internes + '<clipPath id="' + p + 'coins"><rect width="40" height="40" rx="7"/></clipPath>' +
      '<linearGradient id="' + p + 'reflet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".2"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient></defs>');
    return ouverture + defs + '<g clip-path="url(#' + p + 'coins)">' + corps +
      '<path d="M0 0 h40 v15 C27 11.5 13 11.5 0 15z" fill="url(#' + p + 'reflet)"/>' +
      '<rect x=".7" y=".7" width="38.6" height="38.6" rx="6.4" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="1.4"/>' +
      '<rect x=".4" y=".4" width="39.2" height="39.2" rx="6.7" fill="none" stroke="rgba(255,255,255,.16)" stroke-width=".7"/></g></svg>';
  }
  function refaireTout() {
    if (typeof TEAM_LOGOS === "undefined") return;
    var equipes = Object.keys(TEAM_LOGOS);
    equipes.forEach(original);                       // on garde les originaux avant de toucher à quoi que ce soit
    equipes.forEach(function (team) { TEAM_LOGOS[team] = poli(original(team)); });
  }
  if (typeof TEAM_LOGOS !== "undefined") Object.keys(TEAM_LOGOS).forEach(original);   // dès le chargement, avant tout autre module

  window.RJLogos = { original: original, dessiner: genLogo, modeles: function () { return IDS.slice(); }, parDefaut: function (t) { return blasonParDefaut(t); } };

  /* Renomme une écurie dans toute la partie (valeurs et clés), y compris l'historique. */
  function renommerPartout(ancien, nouveau) {
    var vus = typeof WeakSet === "function" ? new WeakSet() : null;
    function marche(o, prof) {
      if (!o || typeof o !== "object" || prof > 14 || (vus && vus.has(o))) return;
      if (vus) vus.add(o);
      Object.keys(o).forEach(function (k) {
        var v = o[k];
        if (v === ancien) o[k] = nouveau;
        else if (v && typeof v === "object") marche(v, prof + 1);
        if (k === ancien && !Object.prototype.hasOwnProperty.call(o, nouveau)) { o[nouveau] = o[k]; delete o[k]; }
      });
    }
    try { if (typeof G !== "undefined") marche(G, 0); } catch (e) {}
    try { if (typeof CAREER_HISTORY !== "undefined") marche(CAREER_HISTORY, 0); } catch (e) {}
    try { if (window.PLAYER_ACADEMY) marche(window.PLAYER_ACADEMY, 0); } catch (e) {}
  }
  window.RJRenommerEcurie = renommerPartout;

  /* ------------------------------------------------ persistance ---- */
  function styles() {
    if (typeof G === "undefined" || !G) return {};
    if (!G._rjTeamStyle) G._rjTeamStyle = {};
    return G._rjTeamStyle;
  }
  function styleDe(team) { return styles()[team] || null; }

  function appliquer(team) {
    var st = styleDe(team);
    if (typeof TEAM_LOGOS === "undefined") return;
    if (!st) { TEAM_LOGOS[team] = poli(original(team)); return; }
    TEAM_LOGOS[team] = genLogo(st.logo || IDS[0], st.color || "#FF1801", 40, team);
  }
  function appliquerTout() {
    var s = styles();
    Object.keys(s).forEach(appliquer);
  }

  function definir(team, color, logo) {
    var s = styles();
    var cur = s[team] || {}, o = blasonParDefaut(team);
    s[team] = { color: color || cur.color || o.color, logo: logo || cur.logo || o.logo };
    appliquer(team);
    try { if (typeof saveGame === "function" && typeof CURRENT_SLOT !== "undefined" && CURRENT_SLOT >= 0) saveGame(CURRENT_SLOT); } catch (e) {}
  }

  /* --------------------------------------------- éditeur : panneau -- */
  function panneauHTML(team) {
    var st = styleDe(team) || {}, o = blasonParDefaut(team);
    var C = st.color || o.color;
    var logoId = st.logo || o.logo;
    var nuances = NUANCIER.map(function (c) {
      var actif = (c.toLowerCase() === C.toLowerCase());
      return '<button type="button" onclick="_rjTeamSetColor(\'' + c + '\')" title="' + c + '" style="' +
        'width:26px;height:26px;border-radius:7px;cursor:pointer;background:' + c + ';' +
        'border:' + (actif ? '2px solid #fff' : '1px solid rgba(255,255,255,.18)') + ';"></button>';
    }).join("");

    return '<div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:var(--text3);' +
           'letter-spacing:.14em;text-transform:uppercase;margin:14px 0 8px">Identité visuelle</div>' +
      '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--r);padding:12px;margin-bottom:10px">' +
        '<div style="display:flex;align-items:center;gap:14px;margin-bottom:12px">' +
          '<button type="button" onclick="_rjTeamOpenLogos()" title="Changer de logo" style="' +
          'padding:0;border:1px solid ' + C + '66;border-radius:var(--r);background:transparent;cursor:pointer;line-height:0">' +
          (st.logo ? genLogo(logoId, C, 54, team) : poli(original(team), 54)) + '</button>' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-size:12px;color:var(--text);font-weight:700">' + team + '</div>' +
            '<div style="font-size:11px;color:var(--text3);margin-top:2px">Touche le logo pour en choisir un autre</div>' +
          '</div>' +
        '</div>' +
        '<div style="font-size:11px;color:var(--text2);margin-bottom:6px;font-weight:600">Couleur principale</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">' + nuances + '</div>' +
        '<div style="display:flex;align-items:center;gap:10px">' +
          '<input type="color" id="rj-team-color" value="' + C + '" onchange="_rjTeamSetColor(this.value)" ' +
          'style="width:44px;height:32px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);cursor:pointer">' +
          '<div style="font-size:11px;color:var(--text3)">Teinte libre — les logos s\'y adaptent</div>' +
        '</div>' +
      '</div>';
  }

  function rafraichirFiche() {
    try {
      if (typeof GE_SELECTED_TEAM !== "undefined" && GE_SELECTED_TEAM &&
          typeof geSwitchTab === "function") {
        geSwitchTab("teams");
      }
    } catch (e) {}
  }

  window._rjTeamSetColor = function (c) {
    var team = (typeof GE_SELECTED_TEAM !== "undefined") ? GE_SELECTED_TEAM : null;
    if (!team) return;
    definir(team, c, (styleDe(team) || {}).logo);
    rafraichirFiche();
  };

  window._rjTeamSetLogo = function (id) {
    var team = (typeof GE_SELECTED_TEAM !== "undefined") ? GE_SELECTED_TEAM : null;
    if (!team) return;
    definir(team, (styleDe(team) || {}).color, id);
    window._rjTeamCloseLogos();
    rafraichirFiche();
  };

  window._rjTeamResetLogo = function () {
    var team = (typeof GE_SELECTED_TEAM !== "undefined") ? GE_SELECTED_TEAM : null;
    if (!team) return;
    delete styles()[team];
    appliquer(team);
    try { if (typeof saveGame === "function" && typeof CURRENT_SLOT !== "undefined" && CURRENT_SLOT >= 0) saveGame(CURRENT_SLOT); } catch (e) {}
    window._rjTeamCloseLogos();
    rafraichirFiche();
  };

  window._rjTeamCloseLogos = function () {
    var m = document.getElementById("rj-logo-modal");
    if (m && m.parentNode) m.parentNode.removeChild(m);
  };

  // L'éditeur est monté à la volée : on repasse à chaque ouverture.
  window._rj63Tabs = function () { cssOnglets(); };

  window._rjTeamOpenLogos = function () {
    var team = (typeof GE_SELECTED_TEAM !== "undefined") ? GE_SELECTED_TEAM : null;
    if (!team) return;
    window._rjTeamCloseLogos();
    var st = styleDe(team) || {}, o = blasonParDefaut(team);
    var C = st.color || o.color;
    function vignettes(liste) {
      return liste.map(function (id) {
        var actif = (id === st.logo);
        return '<button type="button" onclick="_rjTeamSetLogo(\'' + id + '\')" style="' +
          'padding:6px;border-radius:var(--r);cursor:pointer;line-height:0;' +
          'background:' + (actif ? "rgba(255,255,255,.07)" : "transparent") + ';' +
          'border:' + (actif ? "2px solid " + C : "1px solid var(--border)") + ';">' +
          genLogo(id, C, 46, team) + '</button>';
      }).join("");
    }
    var blasons = IDS.filter(function (id) { return IDS_EMBLEMES.indexOf(id) < 0 && IDS_COURSE.indexOf(id) < 0; });
    var titre = function (t) {
      return '<div style="font-family:var(--font-display);font-size:9px;font-weight:800;color:var(--dim,#6b6b78);' +
             'letter-spacing:.14em;text-transform:uppercase;margin:12px 0 7px">' + t + '</div>';
    };
    // Retour possible au blason d'origine : sans cette entrée, une
    // personnalisation était définitive et le joueur ne pouvait plus
    // revenir en arrière.
    var perso = !!(styleDe(team) || {}).logo;
    var choix = titre("Blason d'origine") +
      '<button type="button" onclick="_rjTeamResetLogo()" style="width:100%;display:flex;' +
      'align-items:center;gap:10px;padding:9px 11px;border-radius:var(--r);cursor:pointer;' +
      'background:' + (perso ? "transparent" : "rgba(255,255,255,.07)") + ';' +
      'border:' + (perso ? "1px solid var(--border)" : "2px solid " + C) + '">' +
      '<span style="flex:0 0 40px;width:40px;height:40px;line-height:0">' + poli(original(team), 40) + '</span>' +
      '<span style="font-size:12px;color:var(--text2)">Rétablir le blason d\'origine</span></button>' +
      titre("Sport auto") +
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">' + vignettes(IDS_COURSE) + '</div>' +
      titre("Emblèmes") +
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">' + vignettes(IDS_EMBLEMES) + '</div>' +
      titre("Blasons à monogramme") +
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">' + vignettes(blasons) + '</div>';

    var ov = document.createElement("div");
    ov.id = "rj-logo-modal";
    // CORRECTIF — z-index 999 alors que la fenêtre de l'éditeur de jeu
    // (#game-editor-modal) est à 9990 : le sélecteur s'ouvrait bien, mais
    // DERRIÈRE elle. D'où l'impression qu'il fallait fermer l'éditeur pour
    // le faire apparaître, alors qu'on ne faisait que le dégager.
    ov.style.cssText = "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;" +
      "justify-content:center;background:rgba(0,0,0,.62);backdrop-filter:blur(3px);padding:16px";
    ov.innerHTML =
      '<div style="width:100%;max-width:340px;max-height:78vh;overflow:auto;border-radius:var(--r,12px);' +
      'background:linear-gradient(160deg,var(--bg2) 0%,var(--bg) 100%);border:1px solid var(--border-hi);padding:14px">' +
        '<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px">' +
          '<div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:var(--dim,#6b6b78);' +
          'letter-spacing:.14em;text-transform:uppercase">Logo de ' + team + '</div>' +
          '<button type="button" onclick="_rjTeamCloseLogos()" style="background:none;border:none;' +
          'color:var(--text3);font-size:20px;cursor:pointer;line-height:1">×</button>' +
        '</div>' +
        choix +
        '<div style="font-size:11px;color:var(--text3);margin-top:10px;line-height:1.45">' +
        'Les ' + IDS.length + ' modèles se teintent à la couleur de l\'écurie. Les emblèmes se passent d\'initiales ; la plaque porte le nom de l\'écurie.</div>' +
      '</div>';
    ov.addEventListener("click", function (e) { if (e.target === ov) window._rjTeamCloseLogos(); });
    document.body.appendChild(ov);
  };

  /* ------------------------------------------------------- montage -- */
  function installer() {
    if (typeof window.geRenderTeamDetail !== "function") return false;

    if (!window.geRenderTeamDetail._rj63) {
      var orig = window.geRenderTeamDetail;
      var fn = function (name) {
        var html = orig.apply(this, arguments);
        try { return html + panneauHTML(name); } catch (e) { return html; }
      };
      fn._rj63 = true;
      wrapped.geRenderTeamDetail = orig;
      rjInscrire("geRenderTeamDetail", { id: "63-ecuries:geRenderTeamDetail", ordre: -5200, remplace: function (args, suite) {
      var name = args[0];
        var html = suite();
        try { return html + panneauHTML(name); } catch (e) { return html; }
      } });
    }

    // le renommage doit déplacer aussi le style enregistré
    if (typeof window._geRenameTeam === "function" && !window._geRenameTeam._rj63) {
      var o2 = window._geRenameTeam;
      var f2 = function (oldName, newName) {
        var r = o2.apply(this, arguments);
        try {
          var s = styles();
          if (s[oldName] && oldName !== newName) { s[newName] = s[oldName]; delete s[oldName]; appliquer(newName); }
        } catch (e) {}
        return r;
      };
      f2._rj63 = true;
      wrapped._geRenameTeam = o2;
      rjInscrire("_geRenameTeam", { id: "63-ecuries:_geRenameTeam", ordre: -5200, remplace: function (args, suite) {
      var oldName = args[0], newName = args[1];
        var r = suite();
        try {
          var s = styles();
          if (s[oldName] && oldName !== newName) { s[newName] = s[oldName]; delete s[oldName]; appliquer(newName); }
        } catch (e) {}
        return r;
      } });
    }

    // réappliquer les logos personnalisés au chargement d'une partie
    if (!window.RJ_SAVE_HOOKS.some(function (h) { return h.cle === "__logos63"; })) {
      window.RJ_SAVE_HOOKS.push({ cle: "__logos63", lire: function () { setTimeout(appliquerTout, 60); } });
    }
    // Kick Sauber est devenue Audi : une ancienne sauvegarde est renommée au chargement.
    if (!window.RJ_SAVE_HOOKS.some(function (h) { return h.cle === "__audi"; })) {
      window.RJ_SAVE_HOOKS.push({ cle: "__audi", lire: function () { renommerPartout("Kick Sauber", "Audi"); } });
    }

    refaireTout();
    appliquerTout();
    polirAcademies();
    return true;
  }

  /* Les logos des académies (03) sont dessinés comme ceux des écuries de F1 :
     ils reçoivent la même finition (coins, reflet, liseré). */
  function polirAcademies() {
    if (typeof ACADEMIES === "undefined") return;
    Object.keys(ACADEMIES).forEach(function (n) {
      var a = ACADEMIES[n];
      if (a && a.logo && !a._logoPoli) { a.logo = poli(a.logo); a._logoPoli = true; }
    });
  }

  var essais = 0;
    /* ------------------------------------------------------------------
   * Barre d'onglets de l'éditeur : plus de défilement horizontal.
   *
   * Les cinq onglets (Pilote, Rivaux, Écuries, Staff, Agents) étaient
   * posés en flex avec min-width:90px sur un conteneur en overflow-x:auto.
   * Cinq × 90 px = 450 px minimum pour un écran de 390 : la barre glissait
   * donc de gauche à droite, et les derniers onglets restaient hors champ
   * tant qu'on n'avait pas pensé à faire défiler.
   *
   * On supprime la largeur minimale et on resserre le rembourrage : les
   * cinq tiennent alors dans la largeur, et le défilement est désactivé.
   * ---------------------------------------------------------------- */
  function cssOnglets() {
    if (document.getElementById("rj63-tabs-css")) return;
    var st = document.createElement("style");
    st.id = "rj63-tabs-css";
    st.textContent = [
      "#game-editor-modal .ge-tab{min-width:0 !important;padding:12px 2px !important;",
      "font-size:9.5px !important;letter-spacing:.02em !important;flex:1 1 0 !important}",
      "#game-editor-modal .ge-tab + .ge-tab{margin-left:0 !important}",
      /* le conteneur direct des onglets ne défile plus */
      "#game-editor-modal .ge-tab:first-child{margin-left:0}"
    ].join("");
    document.head.appendChild(st);

    // Le conteneur porte son overflow en style inline : on le neutralise
    // sur l'élément lui-même, une feuille ne pourrait pas le battre.
    try {
      var t = document.querySelector("#game-editor-modal .ge-tab");
      var bar = t && t.parentElement;
      if (bar && bar.style) {
        bar.style.overflowX = "hidden";
        bar.style.setProperty("overflow-x", "hidden", "important");
      }
    } catch (e) {}
  }

  function boot() {
    try {
      if (installer()) { etat.installe = true;
        cssOnglets();
        // L'éditeur est monté à la volée : la barre d'onglets n'existe pas
        // forcément au démarrage. On repasse quand elle apparaît.
        try {
          if (typeof MutationObserver === "function") {
            var obs = new MutationObserver(function () {
              if (document.querySelector("#game-editor-modal .ge-tab")) cssOnglets();
            });
            obs.observe(document.body, { childList: true, subtree: true });
          }
        } catch (e) {}
        console.log("[63-team-identity] actif — couleur d'écurie et " + IDS.length + " blasons générés");
        return;
      }
    } catch (e) { etat.erreur = String(e && e.message || e); }
    if (essais++ < 80) setTimeout(boot, 80);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj63Uninstall = function () {
    Object.keys(wrapped).forEach(function (k) { rjDesinscrire(["63-ecuries:"], k); });
    console.log("[63-team-identity] désinstallé");
  };
  window._rj63Apply = appliquerTout;   // utilisé après restauration d'une sauvegarde
  window._rj63Logos = function () { return IDS.slice(); };
  window._rj63GenLogo = genLogo;
})();


/* ==================================================================== *
 * Profils sportifs et évolution
 * (anciennement 64-team-profiles-evolution.js)
 * ==================================================================== */

(function () {
  "use strict";

  var wrapped = {};
  var etat = { installe: false, erreur: null };
  window._rj64Status = function () { return etat; };

  var REGLAGES = {
    derive: 0.07,        // amplitude de la dérive annuelle par dimension
    rappel: 0.02,        // rappel très léger : une écurie garde son identité,
                         // le rappel ne sert qu'à empêcher l'emballement
    devSeuil: 3,         // écart de note à partir duquel le développement pèse
    devEffet: 0.05,      // renforcement/érosion de la dimension dominante
    memoire: 0.20,       // part du caractère conservée après un règlement
    borne: 0.90
  };

  /* ---------------------------------------------------- aléa reproductible */
  function graine(txt) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function alea(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function borne(v) { return Math.max(-REGLAGES.borne, Math.min(REGLAGES.borne, v)); }

  /* ------------------------------------------------------------ stockage */
  function store() {
    if (typeof G === "undefined" || !G) return null;
    if (!G._rjProfiles) G._rjProfiles = {};
    if (!G._rjProfilesSaison) G._rjProfilesSaison = {};
    return G._rjProfiles;
  }

  // Profil d'origine : table explicite en F1, génération déterministe ailleurs.
  function profilBase(team, cat) {
    try {
      if (wrapped._getTeamProfile) return wrapped._getTeamProfile(team, cat).slice();
    } catch (e) {}
    return [0, 0, 0, 0];
  }

  function equipesDe(cat) {
    try {
      if (typeof TEAMS_BY_CAT !== "undefined" && TEAMS_BY_CAT[cat]) return TEAMS_BY_CAT[cat].slice();
    } catch (e) {}
    return [];
  }

  function notesDe(cat, saison) {
    try {
      if (typeof TEAM_RATINGS !== "undefined") return TEAM_RATINGS[cat + "_" + saison] || null;
    } catch (e) {}
    return null;
  }

  function reglementChange(cat, saison) {
    try {
      return !!(typeof TEAM_RATINGS !== "undefined" && TEAM_RATINGS[cat + "_" + saison + "_reset"]);
    } catch (e) { return false; }
  }

  /* ------------------------------------------------------- une transition */
  function transition(team, cat, saison, profil) {
    var r = alea(graine(team + "|" + cat + "|" + saison));
    var notesN = notesDe(cat, saison);
    var notesP = notesDe(cat, saison - 1);
    var note = (notesN && notesN[team]) || 72;

    if (reglementChange(cat, saison)) {
      // Nouvelle réglementation : le caractère est largement redistribué,
      // avec une amplitude proportionnelle au niveau de l'écurie.
      var ampleur = 0.35 + 0.45 * Math.max(0, Math.min(1, (note - 58) / 40));
      var neuf = [];
      for (var i = 0; i < 4; i++) {
        var tirage = (r() * 2 - 1) * ampleur;
        neuf.push(borne(profil[i] * REGLAGES.memoire + tirage * (1 - REGLAGES.memoire)));
      }
      return { profil: neuf, cause: "règlement" };
    }

    // Saison ordinaire : dérive légère + rappel + effet du développement.
    var out = profil.slice();
    for (var j = 0; j < 4; j++) {
      out[j] = out[j] * (1 - REGLAGES.rappel) + (r() * 2 - 1) * REGLAGES.derive;
    }

    if (notesN && notesP && typeof notesP[team] === "number") {
      var delta = note - notesP[team];
      if (Math.abs(delta) >= REGLAGES.devSeuil) {
        // dimension dominante = celle où l'écurie est la plus marquée
        var idx = 0, best = -1;
        for (var k = 0; k < 4; k++) {
          if (Math.abs(out[k]) > best) { best = Math.abs(out[k]); idx = k; }
        }
        var sens = out[idx] >= 0 ? 1 : -1;
        out[idx] += (delta > 0 ? 1 : -1) * sens * REGLAGES.devEffet;
      }
    }

    for (var m = 0; m < 4; m++) out[m] = borne(Math.round(out[m] * 100) / 100);
    return { profil: out, cause: "dérive" };
  }

  /* ------------------------------------------- mise à jour d'une catégorie */
  function majCategorie(cat, saison) {
    var s = store();
    if (!s || !cat || !saison) return;
    if (!s[cat]) s[cat] = {};
    var derniere = G._rjProfilesSaison[cat] || 0;

    // initialisation : on part des profils d'origine du jeu
    if (!derniere) {
      equipesDe(cat).forEach(function (t) {
        if (!s[cat][t]) s[cat][t] = profilBase(t, cat);
      });
      G._rjProfilesSaison[cat] = saison;
      return;
    }
    if (saison <= derniere) return;

    for (var an = derniere + 1; an <= saison; an++) {
      equipesDe(cat).forEach(function (t) {
        if (!s[cat][t]) s[cat][t] = profilBase(t, cat);
        var res = transition(t, cat, an, s[cat][t]);
        s[cat][t] = res.profil;
      });
    }
    G._rjProfilesSaison[cat] = saison;
  }


  /* ------------------------------------------------------- persistance ---
   * saveGame() ne sérialise qu'une liste FERMÉE de champs de G : tout ce que
   * les modules ajoutent (couleurs et logos d'écurie, profils techniques,
   * journal anti-répétition de la messagerie) était perdu au rechargement.
   * On complète donc l'écriture et la lecture de la sauvegarde. */
  var CHAMPS_SUP = ["_rjTeamStyle", "_rjProfiles", "_rjProfilesSaison", "_rjMailLog", "_rjSocial"];
  // Les autres modules peuvent déclarer leurs propres champs à sauvegarder.
  window._rj64Champs = function (nom) {
    if (nom && CHAMPS_SUP.indexOf(nom) < 0) CHAMPS_SUP.push(nom);
    return CHAMPS_SUP.slice();
  };


  /* Bloc « champs » de la sauvegarde (04s), relu après le chargement. */
  function installerPersistance() {
    if (window.RJ_SAVE_HOOKS.some(function (h) { return h.cle === "champs"; })) return;
    window.RJ_SAVE_HOOKS.push({
      cle: "champs",
      ecrire: function (G) {
        var champs = {};
        CHAMPS_SUP.forEach(function (c) { if (G[c] !== undefined) champs[c] = G[c]; });
        return Object.keys(champs).length ? champs : undefined;
      },
      lire: function (champs, G) {
        if (champs) CHAMPS_SUP.forEach(function (c) { if (champs[c] !== undefined) G[c] = champs[c]; });
        // les logos personnalisés doivent être réappliqués APRÈS restauration
        setTimeout(function () {
          try { if (typeof window._rj63Apply === "function") window._rj63Apply(); } catch (e) {}
        }, 40);
      }
    });
  }

  /* --------------------------------------------------------- surcharge --- */
  function installer() {
    if (typeof window._getTeamProfile !== "function") return false;

    if (!window._getTeamProfile._rj64) {
      wrapped._getTeamProfile = window._getTeamProfile;
      var fn = function (team, cat) {
        try {
          if (team && team !== "Indépendant") {
            var s = store();
            var saison = (typeof G !== "undefined" && G && G.saison) || 1;
            if (s) {
              if (!s[cat] || G._rjProfilesSaison[cat] !== saison) majCategorie(cat, saison);
              if (s[cat] && s[cat][team]) return s[cat][team].slice();
            }
          }
        } catch (e) {}
        return wrapped._getTeamProfile.apply(this, arguments);
      };
      fn._rj64 = true;
      rjInscrire("_getTeamProfile", { id: "63-ecuries:_getTeamProfile", ordre: -5200, remplace: function (args, suite) {
      var team = args[0], cat = args[1];
        try {
          if (team && team !== "Indépendant") {
            var s = store();
            var saison = (typeof G !== "undefined" && G && G.saison) || 1;
            if (s) {
              if (!s[cat] || G._rjProfilesSaison[cat] !== saison) majCategorie(cat, saison);
              if (s[cat] && s[cat][team]) return s[cat][team].slice();
            }
          }
        } catch (e) {}
        return suite();
      } });
    }

    // le renommage d'une écurie doit emporter son profil
    if (typeof window._geRenameTeam === "function" && !window._geRenameTeam._rj64) {
      var o2 = window._geRenameTeam;
      var f2 = function (oldName, newName) {
        var r = o2.apply(this, arguments);
        try {
          var s = store();
          if (s && oldName !== newName) {
            Object.keys(s).forEach(function (cat) {
              if (s[cat] && s[cat][oldName]) { s[cat][newName] = s[cat][oldName]; delete s[cat][oldName]; }
            });
          }
        } catch (e) {}
        return r;
      };
      f2._rj64 = true;
      wrapped._geRenameTeam = o2;
      rjInscrire("_geRenameTeam", { id: "63-ecuries:_geRenameTeam:1", ordre: -5201, remplace: function (args, suite) {
      var oldName = args[0], newName = args[1];
        var r = suite();
        try {
          var s = store();
          if (s && oldName !== newName) {
            Object.keys(s).forEach(function (cat) {
              if (s[cat] && s[cat][oldName]) { s[cat][newName] = s[cat][oldName]; delete s[cat][oldName]; }
            });
          }
        } catch (e) {}
        return r;
      } });
    }

    installerPersistance();
    return true;
  }

  var essais = 0;
  function boot() {
    try {
      if (installer()) {
        etat.installe = true;
        console.log("[64-team-profiles-evolution] actif — profils techniques évolutifs (dérive, règlement, développement)");
        return;
      }
    } catch (e) { etat.erreur = String(e && e.message || e); }
    if (essais++ < 80) setTimeout(boot, 80);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj64Uninstall = function () {
    Object.keys(wrapped).forEach(function (k) { rjDesinscrire(["63-ecuries:"], k); });
    console.log("[64-team-profiles-evolution] désinstallé");
  };
  window._rj64Reglages = REGLAGES;
  window._rj64Profil = function (team, cat) {
    var s = store();
    return (s && s[cat] && s[cat][team]) ? s[cat][team].slice() : null;
  };
})();
