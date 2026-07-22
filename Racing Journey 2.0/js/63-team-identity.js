/* =====================================================================
 * 63-team-identity.js — IDENTITÉ DES ÉCURIES DANS L'ÉDITEUR
 *
 * L'éditeur permettait déjà de renommer une écurie et d'ajuster son
 * prestige, mais pas de toucher à son identité visuelle. Ce module ajoute :
 *
 *   - une COULEUR PRINCIPALE par écurie (nuancier + choix libre) ;
 *   - une bibliothèque de 24 LOGOS générés qui se teintent automatiquement
 *     avec cette couleur ;
 *   - un clic sur le logo ouvre une fenêtre de choix présentant les 24
 *     modèles, déjà colorés aux couleurs de l'écurie.
 *
 * Intégration : getTeamLogo() lit simplement TEAM_LOGOS[nom]. On y écrit
 * donc directement, ce qui propage le nouveau logo partout — fiches
 * d'écurie, offres de contrat, classement constructeurs — sans surcharge.
 * Le renommage d'écurie déplace déjà la clé de TEAM_LOGOS, rien à faire.
 *
 * Les choix sont rangés dans G._rjTeamStyle, donc sauvegardés avec la
 * partie et restaurés au chargement.
 *
 * Réversible : window._rj63Uninstall().
 * =================================================================== */
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

  function mono(txt, x, y, taille, fill) {
    // Une lettre seule peut être plus grande ; trois lettres doivent rétrécir
    // pour ne pas déborder du blason.
    var n = String(txt || "").length;
    if (n <= 1) taille = taille * 1.22;
    else if (n >= 3) taille = taille * 0.74;
    return '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-family="' + POLICE +
           '" font-size="' + taille + '" font-weight="900" letter-spacing="-0.5" fill="' + fill + '">' + txt + '</text>';
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

  /* Formes contenantes. */
  function bouclier(C, D) {
    return '<path d="M20 3 L34 8 v13c0 9-7 14-14 16-7-2-14-7-14-16V8z" fill="' + D + '" stroke="' + C + '" stroke-width="2"/>';
  }
  function medaillon(C, D) {
    return '<circle cx="20" cy="20" r="16" fill="' + D + '" stroke="' + C + '" stroke-width="2.2"/>';
  }
  function ovale(C, D) {
    return '<ellipse cx="20" cy="20" rx="17" ry="12" fill="' + D + '" stroke="' + C + '" stroke-width="2.2"/>';
  }
  function ecusson(C, D) {
    return '<path d="M6 7 h28 v18 l-14 9 -14-9z" fill="' + D + '" stroke="' + C + '" stroke-width="2"/>';
  }
  function hexa(C, D) {
    return '<path d="M20 3 L34 11 v18 L20 37 L6 29 V11z" fill="' + D + '" stroke="' + C + '" stroke-width="2"/>';
  }

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
    var id = "rjg" + (++_gradN);
    return {
      id: id,
      def: '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
           '<stop offset="0%" stop-color="' + L + '"/><stop offset="100%" stop-color="' + C + '"/>' +
           '</linearGradient></defs>'
    };
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

  // Les emblèmes ne reçoivent pas de monogramme : signature à 3 arguments.
  Object.keys(EMBLEMES).forEach(function (k) {
    var f = EMBLEMES[k];
    MODELES[k] = function (C, D, L) { return f(C, D, L); };
  });
  var IDS_EMBLEMES = Object.keys(EMBLEMES);

  var IDS = Object.keys(MODELES);

  function genLogo(id, couleur, taille, nom) {
    var C = couleur || "#FF1801";
    var D = sombre(C, 0.72), L = clair(C, 0.45);
    var f = MODELES[id] || MODELES.bouclier_mono;
    var t = taille || 40;
    var ini = initiales(nom);
    return '<svg viewBox="0 0 40 40" width="' + t + '" height="' + t + '">' +
           '<rect width="40" height="40" rx="7" fill="#0d0d12"/>' +
           f(C, D, L, ini) + '</svg>';
  }

  /* ------------------------------------------------ persistance ---- */
  function styles() {
    if (typeof G === "undefined" || !G) return {};
    if (!G._rjTeamStyle) G._rjTeamStyle = {};
    return G._rjTeamStyle;
  }
  function styleDe(team) { return styles()[team] || null; }

  function appliquer(team) {
    var st = styleDe(team);
    if (!st || typeof TEAM_LOGOS === "undefined") return;
    TEAM_LOGOS[team] = genLogo(st.logo || IDS[0], st.color || "#FF1801", 40, team);
  }
  function appliquerTout() {
    var s = styles();
    Object.keys(s).forEach(appliquer);
  }

  function definir(team, color, logo) {
    var s = styles();
    var cur = s[team] || {};
    s[team] = { color: color || cur.color || "#FF1801", logo: logo || cur.logo || IDS[0] };
    appliquer(team);
    try { if (typeof saveGame === "function" && typeof CURRENT_SLOT !== "undefined" && CURRENT_SLOT >= 0) saveGame(CURRENT_SLOT); } catch (e) {}
  }

  /* --------------------------------------------- éditeur : panneau -- */
  function panneauHTML(team) {
    var st = styleDe(team) || {};
    var C = st.color || "#FF1801";
    var logoId = st.logo || IDS[0];
    var nuances = NUANCIER.map(function (c) {
      var actif = (c.toLowerCase() === C.toLowerCase());
      return '<button type="button" onclick="_rjTeamSetColor(\'' + c + '\')" title="' + c + '" style="' +
        'width:26px;height:26px;border-radius:7px;cursor:pointer;background:' + c + ';' +
        'border:' + (actif ? '2px solid #fff' : '1px solid rgba(255,255,255,.18)') + ';"></button>';
    }).join("");

    return '<div style="font-family:var(--font-display);font-size:10px;font-weight:800;color:var(--text3);' +
           'letter-spacing:.14em;text-transform:uppercase;margin:14px 0 8px">Identité visuelle</div>' +
      '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:10px">' +
        '<div style="display:flex;align-items:center;gap:14px;margin-bottom:12px">' +
          '<button type="button" onclick="_rjTeamOpenLogos()" title="Changer de logo" style="' +
          'padding:0;border:1px solid ' + C + '66;border-radius:9px;background:transparent;cursor:pointer;line-height:0">' +
          genLogo(logoId, C, 54, team) + '</button>' +
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
    definir(team, (styleDe(team) || {}).color, null);
    window._rjTeamCloseLogos();
    rafraichirFiche();
  };

  window._rjTeamCloseLogos = function () {
    var m = document.getElementById("rj-logo-modal");
    if (m && m.parentNode) m.parentNode.removeChild(m);
  };

  window._rjTeamOpenLogos = function () {
    var team = (typeof GE_SELECTED_TEAM !== "undefined") ? GE_SELECTED_TEAM : null;
    if (!team) return;
    window._rjTeamCloseLogos();
    var st = styleDe(team) || {};
    var C = st.color || "#FF1801";
    function vignettes(liste) {
      return liste.map(function (id) {
        var actif = (id === st.logo);
        return '<button type="button" onclick="_rjTeamSetLogo(\'' + id + '\')" style="' +
          'padding:6px;border-radius:10px;cursor:pointer;line-height:0;' +
          'background:' + (actif ? "rgba(255,255,255,.07)" : "transparent") + ';' +
          'border:' + (actif ? "2px solid " + C : "1px solid var(--border)") + ';">' +
          genLogo(id, C, 46, team) + '</button>';
      }).join("");
    }
    var blasons = IDS.filter(function (id) { return IDS_EMBLEMES.indexOf(id) < 0; });
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
      'align-items:center;gap:10px;padding:9px 11px;border-radius:10px;cursor:pointer;' +
      'background:' + (perso ? "transparent" : "rgba(255,255,255,.07)") + ';' +
      'border:' + (perso ? "1px solid var(--border)" : "2px solid " + C) + '">' +
      ((typeof TEAM_LOGOS !== "undefined" && TEAM_LOGOS[team]) ? TEAM_LOGOS[team] : "") +
      '<span style="font-size:12px;color:var(--text2)">Rétablir le blason d\'origine</span></button>' +
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
        'Les ' + IDS.length + ' modèles se teintent à la couleur de l\'écurie. Les emblèmes se passent d\'initiales.</div>' +
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
      window.geRenderTeamDetail = fn;
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
      window._geRenameTeam = f2;
    }

    // réappliquer les logos personnalisés au chargement d'une partie
    if (typeof window.loadSave === "function" && !window.loadSave._rj63) {
      var o3 = window.loadSave;
      var f3 = function () {
        var r = o3.apply(this, arguments);
        try { setTimeout(appliquerTout, 60); } catch (e) {}
        return r;
      };
      f3._rj63 = true;
      wrapped.loadSave = o3;
      window.loadSave = f3;
    }

    appliquerTout();
    return true;
  }

  var essais = 0;
  function boot() {
    try {
      if (installer()) { etat.installe = true;
        console.log("[63-team-identity] actif — couleur d'écurie et " + IDS.length + " blasons générés");
        return;
      }
    } catch (e) { etat.erreur = String(e && e.message || e); }
    if (essais++ < 80) setTimeout(boot, 80);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj63Uninstall = function () {
    Object.keys(wrapped).forEach(function (k) { window[k] = wrapped[k]; });
    console.log("[63-team-identity] désinstallé");
  };
  window._rj63Apply = appliquerTout;   // utilisé après restauration d'une sauvegarde
  window._rj63Logos = function () { return IDS.slice(); };
  window._rj63GenLogo = genLogo;
})();
