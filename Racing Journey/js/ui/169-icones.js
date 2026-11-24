/* =====================================================================
 * 169-icones.js — LE CATALOGUE D'ICÔNES (une seule direction artistique)
 *
 * POURQUOI (v310)
 * Deux catalogues (01) et quelque 150 dessins écrits dans les écrans, avec
 * des épaisseurs, des arrondis et des grilles différents.
 *
 * LA RÈGLE
 * Pictogrammes pleins sur une grille de 48, d'une seule couleur (currentColor) :
 *   [ forme principale pleine, forme secondaire à 62 %, détails en réserve ]
 * Les signes de commande (flèches, croix, coche) sont des traits épais : "L".
 * Chaque dessin est un <symbol id="ic-nom"> ; partout ailleurs, une icône est
 *   <svg viewBox="0 0 48 48"><use href="#ic-nom"/></svg>
 * Les logos, drapeaux, casques et avatars n'en font pas partie.
 *
 * API : RJIcones.svg(nom, taille, couleur), RJIcones.noms, RJIcones.alias.
 * =================================================================== */
(function () {
  "use strict";

  function C(x, y, r) { return "M" + (x - r) + " " + y + "a" + r + " " + r + " 0 1 0 " + 2 * r + " 0a" + r + " " + r + " 0 1 0 " + -2 * r + " 0z"; }
  function R(x, y, w, h, r) {
    r = r || 0;
    return "M" + (x + r) + " " + y + "h" + (w - 2 * r) + "a" + r + " " + r + " 0 0 1 " + r + " " + r + "v" + (h - 2 * r) + "a" + r + " " + r + " 0 0 1 " + -r + " " + r + "h" + -(w - 2 * r) + "a" + r + " " + r + " 0 0 1 " + -r + " " + -r + "v" + -(h - 2 * r) + "a" + r + " " + r + " 0 0 1 " + r + " " + -r + "z";
  }
  /* Polygone étoilé : n branches, rayons alternés ; crans de roue dentée avec plat. */
  function E(x, y, r1, r2, n) { var p = []; for (var i = 0; i < 2 * n; i++) { var a = -Math.PI / 2 + i * Math.PI / n, r = i % 2 ? r2 : r1; p.push((x + r * Math.cos(a)).toFixed(1) + " " + (y + r * Math.sin(a)).toFixed(1)); } return "M" + p.join("L") + "z"; }
  function D(x, y, r1, r2, n) { var p = []; for (var i = 0; i < 4 * n; i++) { var a = (i - 0.5) * Math.PI / (2 * n), r = i % 4 < 2 ? r1 : r2; p.push((x + r * Math.cos(a)).toFixed(1) + " " + (y + r * Math.sin(a)).toFixed(1)); } return "M" + p.join("L") + "z"; }
  function rayons(x, y, a, b, n) { var s = ""; for (var i = 0; i < n; i++) { var t = i * 2 * Math.PI / n, c = Math.cos(t), k = Math.sin(t), u = -k * 2, v = c * 2; s += "M" + (x + a * c - u).toFixed(1) + " " + (y + a * k - v).toFixed(1) + "L" + (x + b * c - u).toFixed(1) + " " + (y + b * k - v).toFixed(1) + "L" + (x + b * c + u).toFixed(1) + " " + (y + b * k + v).toFixed(1) + "L" + (x + a * c + u).toFixed(1) + " " + (y + a * k + v).toFixed(1) + "z"; } return s; }

  var NUAGE = "M14 31a10 10 0 0 1-1-20 13 13 0 0 1 24 3 8.600 8.600 0 0 1 0 17z", BOUCLIER = "M24 4l17 6v13c0 11-7 17-17 21C14 40 7 34 7 23V10z";
  var COEUR = "M24 43C10 33 3 25 3 16a11 11 0 0 1 21-5 11 11 0 0 1 21 5c0 9-7 17-21 27z", BULLE = "M24 5c12 0 21 8 21 18s-9 18-21 18c-3 0-6-.5-8-1.500L5 44l3-9c-3-3-5-7-5-12C3 13 12 5 24 5z";
  var ROND = C(24, 24, 20), TRIANGLE = "M20.500 6a4 4 0 0 1 7 0l18 32a4 4 0 0 1-3.500 6H6a4 4 0 0 1-3.500-6z";
  var BUSTE = C(24, 14, 10) + "M6 44c0-10 7-17 18-17s18 7 18 17z", LUNE = "M41 29A18 18 0 1 1 19 5a15 15 0 0 0 22 24z", VOITURE = "M3 30c0-4 2-6 6-7l6-9c1-2 3-3 6-3h11c3 0 5 1 7 4l5 8c3 1 4 3 4 6v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z";
  var ROUES = C(13, 35, 6.500) + C(35, 35, 6.500), DOC = "M11 4h17l11 11v25a4 4 0 0 1-4 4H11a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z", CASQUE = "M5 29C5 15 14 6 26 6c7 0 13 4 16 10H24a5 5 0 0 0-5 5v3a8 8 0 0 0 8 8h16v4a5 5 0 0 1-5 5H15C9 41 5 36 5 29z";
  var ANSE = "M13 21v-5a11 11 0 0 1 22 0v5h-5.500v-5a5.500 5.500 0 0 0-11 0v5z", CAL = R(4, 8, 40, 36, 4), CALTETE = "M8 8h32a4 4 0 0 1 4 4v7H4v-7a4 4 0 0 1 4-4z";

  var G = {
    /* commandes */
    menu: "LM6 12h36M6 24h36M6 36h36", retour: "LM30 8L14 24l16 16", suivant: "LM18 8l16 16-16 16", bas: "LM8 17l16 16 16-16", coche: "LM8 25l11 11L41 12", croix: "LM10 10l28 28M38 10L10 38",
    ajout: "LM24 7v34M7 24h34", moins: "LM8 24h32", fleche: "LM6 24h34M26 10l14 14-14 14", fleche_haut: "LM24 42V8M10 22L24 8l14 14", fleche_bas: "LM24 6v34M10 26l14 14 14-14",
    hausse: "LM5 36l13-13 9 7 15-17M30 12h13v13", baisse: "LM5 12l13 13 9-7 15 17M30 36h13V23", pouls: "LM3 25h9l6 15 10-32 6 17h11", echange: "LM34 4l8 8-8 8M42 12H14a8 8 0 0 0-8 8M14 44l-8-8 8-8M6 36h28a8 8 0 0 0 8-8",
    reset: "LM40 25a16 16 0 1 1-5-12M41 5v10H31", pause: "LM16 10v28M32 10v28",
    play: ["M13 6.500c0-2 2-3.200 3.800-2.200l26 17.400c1.600 1.100 1.600 3.500 0 4.600l-26 17.400c-1.800 1-3.800-.2-3.800-2.200z"], avance: ["M4 8l19 16L4 40z", "M25 8l19 16-19 16z"], rond: [C(24, 24, 9)], stop: [R(8, 8, 32, 32, 5)],
    /* menu et navigation */
    accueil: ["M24 4l21 18h-6v19a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V22H3z", R(18, 28, 12, 15, 1)],
    calendrier: [CAL, CALTETE, "M14 4v7M34 4v7M13 27h4M22 27h4M31 27h4M13 36h4M22 36h4"],
    trophee: ["M13 4h22v16a11 11 0 0 1-22 0z" + "M21 30h6v6h6a4 4 0 0 1 4 4v4H11v-4a4 4 0 0 1 4-4h6z", "M13 8H4v5c0 6 4 10 10 10v-4c-4 0-6-2-6-6h5zM35 8h9v5c0 6-4 10-10 10v-4c4 0 6-2 6-6h-5z", "M19 10v8"],
    pilote: [CASQUE, "M25 19h18c.7 2 1 4 1 6.500V29H28a6 6 0 0 1-6-6v-1a3 3 0 0 1 3-3z", "M28 37h9"],
    chrono: ["M24 11a16.500 16.500 0 1 0 0 33 16.500 16.500 0 0 0 0-33z", "M18 3h12v6H18zM37 8l5 5-3.500 3.500-5-5z", "M24 28V18M24 28l7 4"],
    photo: ["M8 14h7l3-6h12l3 6h7a4 4 0 0 1 4 4v19a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4z", C(24, 27, 9), "M38 20h.1"],
    contrat: [DOC, "M28 4l11 11h-8a3 3 0 0 1-3-3z", "M14 21h16M14 28h10M14 37c3-6 5 2 8-1s4 1 8-1"],
    sponsor: [BOUCLIER, E(24, 23.500, 11, 4.600, 5)],
    coffre: [R(4, 5, 40, 35, 4), C(28, 22.500, 9.500) + R(9, 40, 7, 4) + R(32, 40, 7, 4), "M11 16v4M11 25v4"],
    message: ["M9 6h30a5 5 0 0 1 5 5v19a5 5 0 0 1-5 5H25l-12 10V35H9a5 5 0 0 1-5-5V11a5 5 0 0 1 5-5z", "", "M13 16h22M13 25h14"],
    cocktail: ["M5 8h38L27 27v12h6a4 4 0 0 1 4 4H11a4 4 0 0 1 4-4h6V27z", "M31 8l5-8 3.500 2-4 6z", "M13 14h22"],
    disquette: ["M8 5h26l9 9v25a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8a3 3 0 0 1 3-3z", R(14, 5, 16, 11) + R(12, 26, 24, 17), ""],
    agent: [BUSTE, "M24 28l5 4-3 4 3 8H19l3-8-3-4z"], user: [BUSTE], users: [C(18, 15, 9) + "M2 43c0-10 6-16 16-16s16 6 16 16z", C(36, 18, 6.500) + "M37 28c5 1 9 6 9 13h-8c0-5-1-9-4-12z"],
    pantheon: ["M24 3l21 12v5H3v-5z" + R(4, 38, 40, 6, 1), R(8, 23, 6, 13) + R(21, 23, 6, 13) + R(34, 23, 6, 13)],
    boutique: ["M9 15h30l4 25a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z", "M13 15a11 11 0 0 1 22 0h-5a6 6 0 0 0-12 0z", "M17 23a7 7 0 0 0 14 0"],
    pass: [R(8, 9, 32, 36, 4), R(18, 3, 12, 8, 2) + C(24, 23, 6), "M16 37h16"], reglages: [D(24, 24, 21, 15.500, 8), C(24, 24, 7.500)],
    sortie: ["M8 5h18v38H8a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z", "M31 13l14 11-14 11v-7H17v-8h14z"], cloche: ["M24 4a13 13 0 0 1 13 13v12l6 6v2H5v-2l6-6V17A13 13 0 0 1 24 4z", "M17 40h14a7 7 0 0 1-14 0z", "M18 17a6 6 0 0 1 5-6"],
    livre: ["M4 8c8-2 14-1 18 3v31c-4-3-10-4-18-2z", "M44 8c-8-2-14-1-18 3v31c4-3 10-4 18-2z"], oeil: ["M24 9C12 9 5 17 2 24c3 7 10 15 22 15s19-8 22-15C43 17 36 9 24 9z", C(24, 24, 8.500)],
    /* course */
    drapeau: [R(7, 3, 5, 42, 2.500), "M12 6h29l-8 10 8 10H12z"],
    damier: [R(6, 3, 5, 42, 2.5) + "M12 6h8v8h-8zM28 6h8v8h-8zM20 14h8v8h-8zM36 14h8v8h-8zM12 22h8v8h-8zM28 22h8v8h-8z"],
    voiture: [VOITURE, ROUES, "M17 22l3-5h5v5zM30 17h3l4 5h-7z"], safety_car: [VOITURE, ROUES + R(19, 4, 12, 6, 2), "M17 22l3-5h5v5zM30 17h3l4 5h-7z"], kart: ["M9 29h15l8-6h9l4 6v4H9zM10 12h6l4 15H10z", C(11, 38, 7) + C(37, 38, 7) + "M26 14l4-2 4 10h-4z"],
    pneu: [ROND, C(24, 24, 10), "M11 18a14.500 14.500 0 0 1 7-7M37 30a14.500 14.500 0 0 1-7 7"], cle: ["M31 4a13 13 0 0 0-12 17L5 35a5.700 5.700 0 0 0 8 8l14-14a13 13 0 0 0 16-16l-7 7-8-1-1-8z", "", "M10 38h.1"],
    duel: ["M4 4h8l20 20 3-3 4 4-4 4 6 6-4 4-6-6-4 4-4-4 3-3L4 12z", "M44 4h-8L16 24l-3-3-4 4 4 4-6 6 4 4 6-6 4 4 4-4-3-3 22-22z"],
    strategie: ["M4 9h24V3l16 11-16 11v-6H4z", "M44 29H20v-6L4 34l16 11v-6h24z"], aileron: [R(10, 11, 28, 8, 2) + R(10, 24, 28, 6, 2), R(3, 7, 5, 28, 2) + R(40, 7, 5, 28, 2) + R(20, 33, 8, 9, 1)],
    carburant: [R(5, 4, 24, 40, 3), "M29 9l14 11v18a5.500 5.500 0 0 1-11 0v-8h-3v-5h4a3 3 0 0 1 3 3v10a1.500 1.500 0 0 0 3 0V23l-10-8z", "M11 11h12v8H11z"],
    alerte: [TRIANGLE, "", "M24 18v11M24 37v.1"], info: [ROND, "", "M24 22v12M24 14v.1"], alerte_rond: [ROND, "", "M24 13v13M24 35v.1"], croix_rond: [ROND, "", "M17 17l14 14M31 17L17 31"],
    vitesse: ["M24 7A21 21 0 0 0 5 39h38A21 21 0 0 0 24 7z", "", "M24 32l9-12M11 28h2M24 13v2M35 28h2"], eclair: ["M28 2L6 28h14l-3 18 25-27H27z"], cible: [ROND, C(24, 24, 7), C(24, 24, 13)],
    casque_audio: ["M24 5A19 19 0 0 0 5 24v12a4 4 0 0 0 4 4h7V25h-6v-1a14 14 0 0 1 28 0v1h-6v15h7a4 4 0 0 0 4-4V24A19 19 0 0 0 24 5z", "M33 41h5a8 8 0 0 1-8 5h-7v-4h7z"],
    micro: [R(16, 3, 16, 26, 8), "M7 22h5a12 12 0 0 0 24 0h5a17 17 0 0 1-14 16v7h-6v-7A17 17 0 0 1 7 22z"], porte_voix: ["M5 18h11L41 6v36L16 30H5z", "M12 32h9l4 12h-9z"],
    podium: [R(17, 8, 14, 36, 1), R(3, 20, 13, 24, 1) + R(32, 26, 13, 18, 1)], couronne: ["M4 11l10 11L24 5l10 17 10-11-4 25H8z", R(8, 38, 32, 6, 2)], medaille: [C(24, 17, 14), "M14 29l-5 17 15-6 15 6-5-17z", ""], etoile: [E(24, 25.500, 22, 9.500, 5)],
    /* météo */
    soleil: [C(24, 24, 10.500), rayons(24, 24, 15, 22.500, 8)], nuage: [NUAGE.replace("M14 31", "M14 37").replace("31", "37")], pluie: [NUAGE, "M14 35l-4 9h4l4-9zM24 35l-4 9h4l4-9zM34 35l-4 9h4l4-9z"], orage: [NUAGE, "M27 27l-12 12h8l-3 8 13-12h-8l4-8z"],
    flamme: ["M25 3c2 9 14 13 14 26a15 15 0 0 1-30 0c0-6 3-10 6-13 1 4 2 5 4 6 0-7 2-14 6-19z", "M24 26c5 4 7 7 7 11a7 7 0 0 1-14 0c0-4 4-6 7-11z"], thermometre: ["M24 3a7 7 0 0 0-7 7v17a11 11 0 1 0 14 0V10a7 7 0 0 0-7-7z", C(24, 36, 6), "M24 12v16"],
    /* corps, tête, entraînement */
    coeur: [COEUR], cardio: [COEUR, "", "M9 23h8l4-7 6 13 4-6h8"], cerveau: ["M22 5a8 8 0 0 0-11 6 8 8 0 0 0-5 12 9 9 0 0 0 4 14 8 8 0 0 0 12 5z", "M26 5a8 8 0 0 1 11 6 8 8 0 0 1 5 12 9 9 0 0 1-4 14 8 8 0 0 1-12 5z", "M14 18c3 0 4 2 4 4M14 31c3 0 4-1 4-4"],
    haltere: [R(8, 9, 10, 30, 3) + R(30, 9, 10, 30, 3) + R(17, 20, 14, 8), R(1, 16, 6, 16, 2) + R(41, 16, 6, 16, 2)], simu: [R(3, 5, 42, 28, 4), R(13, 38, 22, 6, 2) + R(20, 33, 8, 6), "M11 25l9-9 6 5 10-9"], repos: [LUNE, "M30 5h13L34 17h9v4H28l10-12h-8z"],
    video: [R(3, 10, 29, 28, 4), "M34 20l11-7v22l-11-7z"], lotus: [C(24, 9, 6) + "M24 17c5 0 8 4 8 10l11 8a4 4 0 0 1-3 7H8a4 4 0 0 1-3-7l11-8c0-6 3-10 8-10z"], fusee: ["M24 2c8 6 11 14 10 24l-4 6H18l-4-6C13 16 16 8 24 2z", "M13 23l-8 8v9l10-5zM35 23l8 8v9l-10-5zM19 35h10l-5 11z", C(24, 17, 2.500)], boussole: [ROND, "M34 14l-6 14-14 6 6-14z"],
    /* argent, carrière */
    donnees: [R(5, 26, 10, 17, 2) + R(33, 5, 10, 38, 2), R(19, 15, 10, 28, 2)], piece: [ROND, "", "M31 17a8.500 8.500 0 1 0 0 14M13 21h12M13 27h11"], portefeuille: [R(3, 10, 38, 32, 5), "M28 20h17v12H28a6 6 0 0 1 0-12z", "M29 26h.1"], recu: ["M9 3h30v42l-5-4-5 4-5-4-5 4-5-4-5 4z", "", "M16 14h16M16 23h16M16 32h9"],
    poignee: ["M2 13h9l9-4 6 4-8 8a4 4 0 0 0 6 5l7-5 12 12-4 4-3-2-2 4-4-1-3 4-4-1L12 32H2z", "M46 13v19h-5L30 20l8-7z"], diplome: ["M24 6l23 11-23 11L1 17z", "M11 25v10c0 3 6 7 13 7s13-4 13-7V25l-13 6zM42 20h4v17h-4z"], garage: ["M24 4l21 12v28H3V16z", R(11, 22, 26, 22), "M11 29h26M11 36h26"], bouclier: [BOUCLIER, "M24 4l17 6v13c0 11-7 17-17 21z"],
    journal: [R(3, 7, 36, 35, 3), "M39 16h6v21a5 5 0 0 1-6 5z", "M11 16h20M11 24h9M11 32h20"], enveloppe: [R(3, 9, 42, 31, 4), "", "M7 15l17 14 17-14"], commentaire: [BULLE, "", "M15 23h.1M24 23h.1M33 23h.1"], telephone: [R(12, 3, 24, 42, 5), R(16, 9, 16, 27, 1), "M23 40h2"],
    stylo: ["M32 6l10 10-25 25-13 3 3-13z", "M35 3a3 3 0 0 1 4 0l6 6a3 3 0 0 1 0 4l-2 2L33 5z"], image: [R(4, 6, 40, 36, 4), C(15, 17, 4.500) + "M8 38l11-13 7 7 7-9 8 11v4z"], corbeille: ["M8 15h32l-3 27a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3z", "M18 3h12l2 5h10v5H6V8h10z", "M19 22v15M29 22v15"],
    cadenas: [R(7, 20, 34, 25, 4), ANSE, "M24 30v6"], cadenas_ouvert: [R(7, 20, 34, 25, 4), "M13 21v-8a10 10 0 0 1 20-2l-5 2a5 5 0 0 0-9.500 1v7z", "M24 30v6"], telecharger: ["M19 4h10v15h9L24 34 10 19h9z", R(5, 37, 38, 7, 2)], televerser: ["M19 34h10V19h9L24 4 10 19h9z", R(5, 37, 38, 7, 2)], partager: [C(36, 10, 7) + C(11, 24, 7) + C(36, 38, 7), "M13 22L35 8l2 4-22 14zM13 26l22 14 2-4-22-14z"],
    base: ["M5 10v28c0 4 8 7 19 7s19-3 19-7V10z", "M24 3C13 3 5 6 5 10s8 7 19 7 19-3 19-7-8-7-19-7z", "M7 25c4 3 10 4 17 4s13-1 17-4"], ampoule: ["M24 3a15 15 0 0 0-9 27c2 2 3 4 3 6h12c0-2 1-4 3-6A15 15 0 0 0 24 3z", R(18, 38, 12, 7, 2)], lune: [LUNE], horloge: [ROND, "", "M24 13v12l8 5"], sablier: ["M9 3h30v6L28 24l11 15v6H9v-6l11-15L9 9z", "M15 39h18l-9-10z"], smiley: [ROND, "", "M15 28a10 10 0 0 0 18 0M17 18h.1M31 18h.1"], globe: [ROND, "", "M5 24h38M24 5c-9 11-9 27 0 38M24 5c9 11 9 27 0 38"], carte: ["M3 9l14-5v35L3 44zM31 9l14-5v35l-14 5z", "M17 4l14 5v35l-14-5z"], montagne: ["M2 42L18 10l10 17 5-7 13 22z", "M18 10l6 10-6 5-5-5z"], etincelles: [E(20, 27, 18, 5, 4), E(38, 11, 10, 3, 4)],
    /* loisirs, biens */
    musique: ["M18 8l25-5v30a7.500 7.500 0 1 1-5-7V15l-15 3v21a7.500 7.500 0 1 1-5-7z"], palette: ["M24 4a20 20 0 1 0 0 40c5 0 5-4 4-7s1-6 5-6h5c4 0 6-4 6-8C44 12 35 4 24 4z", C(14, 19, 3.500) + C(24, 13, 3.500) + C(34, 18, 3.500) + C(14, 30, 3.500)], pique: ["M24 3C18 12 6 17 6 27a9 9 0 0 0 15 7c0 5-2 8-5 11h16c-3-3-5-6-5-11a9 9 0 0 0 15-7C42 17 30 12 24 3z"], golf: [R(14, 4, 4, 38, 1), "M18 5l22 9-22 9z" + C(32, 39, 5)], couverts: ["M8 3h4v13h3V3h4v13h3V3h4v16a8 8 0 0 1-6 7v16a3.500 3.500 0 0 1-7 0V26a8 8 0 0 1-5-7z", "M40 3c-7 0-10 8-10 18 0 4 2 6 4 6v15a3.500 3.500 0 0 0 7 0V3z"], vague: ["M2 34c5 0 5-22 22-22 10 0 15 7 15 12-4-5-13-4-13 3 0 6 8 8 20 5v10H2z", C(39, 10, 5)], avion: ["M24 2c3 0 4 4 4 8v7l17 11v5l-17-5v9l6 5v4l-10-3-10 3v-4l6-5v-9L3 33v-5l17-11v-7c0-4 1-8 4-8z"], bateau: ["M3 31h42l-6 13H9z", "M22 3v25H7zM26 9l14 19H26z"], montre: [C(24, 24, 14), "M16 3h16l2 9H14zM14 36h20l-2 9H16z", "M24 17v8l5 3"], villa: ["M3 22L24 6l21 16v21H3z", R(9, 27, 9, 9) + R(26, 27, 12, 16)]
  };

  /* Noms employés par le jeu (apexIcon, renderIcon, modules) → catalogue. */
  var A = {};
  ("accueil:home,maison|play:continuer,start_btn|trophee:championnat,trophy,trophee_p1,champion,[P1]|menu:plus|coche:valider,check|croix:annuler,fermer,x|ajout:ajouter|moins:retirer,minus|avance:fast_forward,skip|hausse:trend_up,trend,trend-up|baisse:trend_down,downtrend|" +
   "pilote:helmet|chrono:entrainement,run,chrono_alt,pole|photo:medias,camera|contrat:contrats,candidature|sponsor:sponsors,sponsor_actif,sponsor_potentiel,msg_sponsor|message:messages|cocktail:style_vie,lifestyle|disquette:sauvegarder,save|agent:manager,cravate,msg_agent|pass:paddock_pass,membre|reglages:parametres|sortie:menu_principal|" +
   "drapeau:depart,drapeau_rouge,flag,[START],[RED]|safety_car:[SC]|pluie:pluie_meteo,wet,[RAIN]|cle:moteur,[ENG]|duel:duel_rivalite,rival,[DUEL]|pneu:pneus,pneus_stat,gestion_pneus,tyre,[TYRE]|strategie:strategie_stat,[STRAT]|alerte:incident,avertissement,alert,warn,[INC]|damier:[FINAL],[F]|carburant:[FUEL]|aileron:drs,[DRS]|" +
   "donnees:analyse_donnees,data|cerveau:mental,brain|video:film|haltere:musculation,physique,gym|kart:karting|eclair:energie,zap,bolt|simu:simulateur,sim,tv,monitor|repos:rest|fusee:boost,attaque,rocket|micro:conference_presse,mic,msg_presse|voiture:car,voiture_perso|calendrier:event,saison,calendar|casque_audio:radio,casque_micro|cible:objectif,target,adaptation_cible|piece:argent,salaire,money,coin|telephone:phone,tablette,tablet|etoile:star,ovr|journal:actualite,news|poignee:poignee_main,handshake,allie|commentaire:comment|soleil:sec,dry,vacances|nuage:nuageux,cloudy|orage:storm|flamme:chaleur,hot,fire|vitesse:vitesse_sim|bouclier:confort,shield,sang_froid_b|reset:reset_btn|pouls:regularite|thermometre:sang_froid|boussole:adaptation,compass|" +
   "porte_voix:medias_rep|users:public,famille,coequipier,followers|oeil:recruteurs|garage:paddock,constructeur,msg_ecurie|portefeuille:solde|recu:charges|diplome:academie_dispo|couronne:victoire,crown|medaille:medal|enveloppe:msg_nonlu,msg_lu|alerte_rond:msg_important|coeur:bonheur,heart|musique:music|palette:art|smiley:smile|stylo:feather|globe:globe_t|montagne:mountain|avion:plan|horloge:clock|etincelles:sparkles|carte:map|coffre:patrimoine")
    .split("|").forEach(function (l) { var p = l.split(":"); p[1].split(",").forEach(function (a) { A[a] = p[0]; }); });
  /* Couleurs propres aux marqueurs de course. */
  var TEINTES = { "[SC]": "#FBBF24", "[RAIN]": "#93C5FD", "[ENG]": "#9CA3AF", "[RED]": "#EF4444", "[INC]": "#F59E0B" };

  var DETAIL = 'fill="none" stroke="#000" stroke-width="3.400" stroke-linecap="round" stroke-linejoin="round"';
  function symbole(n) {
    var g = G[n];
    if (typeof g === "string") return '<symbol id="ic-' + n + '" viewBox="0 0 48 48"><path d="' + g.slice(1) + '" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></symbol>';
    var p = '<path d="' + g[0] + '" fill="currentColor" stroke="none" fill-rule="nonzero"', s = g[1] ? '<path d="' + g[1] + '" fill="currentColor" stroke="none" opacity=".62"/>' : "";
    if (!g[1] && !g[2]) return '<symbol id="ic-' + n + '" viewBox="0 0 48 48">' + p + "/></symbol>";
    return '<mask id="icm-' + n + '" maskUnits="userSpaceOnUse" x="-4" y="-4" width="56" height="56"><path d="M-4-4h56v56H-4z" fill="#fff" stroke="none"/>' +
      (g[1] ? '<path d="' + g[1] + '" fill="#000" stroke="#000" stroke-width="3.200" stroke-linejoin="round"/>' : "") + (g[2] ? '<path d="' + g[2] + '" ' + DETAIL + "/>" : "") +
      '</mask><symbol id="ic-' + n + '" viewBox="0 0 48 48">' + p + ' mask="url(#icm-' + n + ')"/>' + s + "</symbol>";
  }
  function poser() {
    if (document.getElementById("rj169")) return;
    var d = document.createElement("div");
    d.id = "rj169"; d.setAttribute("aria-hidden", "true"); d.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
    d.innerHTML = '<svg width="0" height="0">' + Object.keys(G).map(symbole).join("") + "</svg>";
    document.body.insertBefore(d, document.body.firstChild);
  }
  function svg(nom, taille, couleur) {
    var n = G[nom] ? nom : A[nom]; if (!n) return "";
    var c = couleur && couleur !== "currentColor" ? couleur : !couleur && TEINTES[nom] || "", t = taille || 24;
    return '<svg class="ic" width="' + t + '" height="' + t + '" viewBox="0 0 48 48" aria-hidden="true"' + (c ? ' style="color:' + c + '"' : "") + '><use href="#ic-' + n + '"/></svg>';
  }
  window.RJIcones = { svg: svg, noms: Object.keys(G), alias: A, a: function (n) { return !!(G[n] || A[n]); } };
  if (document.body) poser(); else document.addEventListener("DOMContentLoaded", poser);
})();
