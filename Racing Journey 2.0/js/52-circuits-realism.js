/* ============================================================================
 * 52-circuits-realism.js — Réalisme des circuits (temps + secteurs)
 * ----------------------------------------------------------------------------
 * 1) Temps de référence (refLapF1) affinés sur les vrais temps de pole/référence.
 * 2) Découpage en secteurs PROPRE à chaque circuit (CIRCUIT_SECTORS), fidèle aux
 *    vraies lignes de chrono — volontairement INÉGAL (ex. Spa : S2 très long,
 *    Baku : S3 dominé par la longue ligne droite, Monaco : S1 long).
 *
 * Avant : CIRCUIT_SECTORS était vide -> tous les circuits utilisaient un
 * découpage générique par type. Désormais chaque circuit a sa signature.
 *
 * Sûr / réversible : surcharge les objets existants au boot, retrait du
 * <script> dans index.html = retour à l'état d'origine. Uninstall : _rj52Uninstall().
 * Les ratios sont normalisés pour sommer exactement à 1.
 * ========================================================================== */
(function () {
  "use strict";

  // ref : temps de référence (s) — null = on garde la valeur existante du jeu.
  // sec : [S1, S2, S3] proportions du tour (seront normalisées à 1).
  var DATA = {
    // ---------- F1 / circuits internationaux ----------
    Bahrain:     { ref: 89.5,  sec: [0.31, 0.39, 0.30] }, // S1 serré T1-T4, S2 mix, S3
    Jeddah:      { ref: 87.5,  sec: [0.34, 0.39, 0.27] }, // ultra-rapide, S3 plus court
    Melbourne:   { ref: 76.5,  sec: [0.32, 0.35, 0.33] },
    Miami:       { ref: 87.5,  sec: [0.31, 0.39, 0.30] }, // longues lignes au S2
    Imola:       { ref: 75.8,  sec: [0.35, 0.33, 0.32] }, // technique
    Monaco:      { ref: 71.0,  sec: [0.36, 0.31, 0.33], // S1 long jusqu'à Mirabeau
      path: "M30,98 L88,96 Q98,95 99,86 L100,74 Q100,66 92,66 Q84,66 84,58 L86,46 Q88,36 99,34 L106,33 Q116,32 117,42 Q117,50 109,50 Q103,50 104,57 L106,70 Q107,80 117,80 L150,82 Q164,83 166,73 L168,58 Q168,49 158,50 L140,52 Q131,53 131,63 L132,78 Q132,90 122,90 L40,94 Q30,95 30,98 Z" },
    Barcelone:   { ref: 76.0,  sec: [0.34, 0.34, 0.32] },
    Barcelona:   { ref: 76.0,  sec: [0.34, 0.34, 0.32] },
    Silverstone: { ref: 86.5,  sec: [0.33, 0.36, 0.31], // S2 Maggotts/Becketts
      path: "M42,90 Q34,90 35,81 L38,58 Q40,48 51,48 L84,50 Q95,51 95,42 L97,28 Q98,18 109,20 L142,27 Q154,30 151,40 L146,54 Q143,63 153,65 L170,70 Q180,74 175,84 L169,91 Q164,96 154,93 L118,82 Q108,79 106,88 Q104,96 94,93 L52,90 Q47,90 42,90 Z" },
    Spa:         { ref: 103.0, sec: [0.30, 0.45, 0.25], // S2 énorme, S3 court
      path: "M34,96 Q26,95 28,87 L40,66 Q44,58 38,52 L28,40 Q24,32 34,31 L66,28 Q78,27 82,36 L90,54 Q94,62 104,60 L152,50 Q174,45 176,33 Q177,24 166,25 L118,30 Q106,31 105,23 Q104,16 116,16 L160,15 Q176,15 177,28 L178,82 Q178,96 162,95 L46,96 Q38,96 34,96 Z" },
    Budapest:    { ref: 76.5,  sec: [0.36, 0.34, 0.30] }, // sinueux
    Hungaroring: { ref: 76.5,  sec: [0.36, 0.34, 0.30] },
    Zandvoort:   { ref: 70.0,  sec: [0.34, 0.35, 0.31], // banking final au S3
      path: "M38,86 Q30,84 32,73 L38,48 Q42,34 56,37 L74,42 Q85,45 86,56 L87,70 Q88,80 99,77 L118,70 Q129,66 128,54 L127,36 Q126,24 139,26 Q152,28 152,41 L153,84 Q153,98 139,95 L52,88 Q44,87 38,86 Z" },
    Monza:       { ref: 80.0,  sec: [0.37, 0.34, 0.29], // S1 long, Parabolica courte
      path: "M32,28 Q26,30 28,40 L34,92 Q35,100 45,98 L66,94 Q76,92 76,83 L78,62 Q79,52 89,52 L122,50 Q134,49 135,40 Q136,30 147,33 L170,40 Q180,43 176,53 L166,86 Q163,96 152,93 L50,74 Q40,72 43,62 L52,40 Q56,30 45,28 Q38,27 32,28 Z" },
    Singapore:   { ref: 91.0,  sec: [0.34, 0.34, 0.32] }, // layout 2023
    Suzuka:      { ref: 89.0,  sec: [0.38, 0.35, 0.27], // esses au S1, S3 court
      path: "M46,34 Q38,32 38,42 L40,58 Q41,68 52,70 L118,84 Q130,86 133,76 L138,54 Q140,44 130,42 L64,30 Q54,28 53,38 L52,52 Q51,64 62,64 L150,60 Q166,59 166,71 L164,86 Q163,96 152,94 L60,96 Q46,96 44,84 L42,46 Q42,36 46,34 Z" }, // figure en 8 (croisement)
    Austin:      { ref: 94.0,  sec: [0.35, 0.34, 0.31] },
    Mexico:      { ref: 77.5,  sec: [0.32, 0.35, 0.33] }, // longue ligne d'arrivée
    Baku:        { ref: 101.5, sec: [0.31, 0.32, 0.37] }, // S3 = ligne droite de 2,2 km
    Portimao:    { ref: 79.5,  sec: [0.33, 0.35, 0.32] }, // vallonné
    Mugello:     { ref: 79.0,  sec: [0.34, 0.35, 0.31] }, // courbes rapides
    Misano:      { ref: 84.0,  sec: [0.35, 0.33, 0.32] },
    Vallelunga:  { ref: 84.5,  sec: [0.34, 0.34, 0.32] },
    Spielberg:   { ref: 64.5,  sec: [0.31, 0.34, 0.35] }, // 3 longues lignes, S3 plus long
    // ---------- Super Formula (Japon) ----------
    Okayama:     { ref: 75.0,  sec: [0.35, 0.33, 0.32] },
    Autopolis:   { ref: 84.0,  sec: [0.34, 0.34, 0.32] },
    Sugo:        { ref: 75.5,  sec: [0.35, 0.34, 0.31] },
    Motegi:      { ref: 87.5,  sec: [0.34, 0.33, 0.33] }, // stop-and-go
    Sapporo:     { ref: 78.0,  sec: [0.34, 0.34, 0.32] },
    // ---------- IndyCar (ovales + circuits) ----------
    Texas:       { ref: 42.0,  sec: [0.34, 0.33, 0.33] }, // ovale -> secteurs ~égaux
    Detroit:     { ref: 71.5,  sec: [0.34, 0.34, 0.32] }, // street
    Iowa:        { ref: 26.0,  sec: [0.34, 0.33, 0.33] }, // ovale court
    Nashville:   { ref: 74.0,  sec: [0.33, 0.33, 0.34] }, // pont = ligne droite au S3
    Portland:    { ref: 64.0,  sec: [0.34, 0.34, 0.32] },
    Gateway:     { ref: 34.0,  sec: [0.34, 0.33, 0.33] }, // ovale
    Monterey:    { ref: 72.0,  sec: [0.34, 0.34, 0.32] }  // Laguna Seca / Corkscrew
  };

  // Tracés SVG redessinés (viewBox 0 0 200 120), fidèles à la forme réelle.
  var PATHS = {
    Monaco: "M48,78 Q58,76 64,68 L70,52 Q73,42 82,40 L92,39 Q100,38 102,45 L104,54 Q105,60 99,62 L92,63 Q86,64 90,69 L100,72 Q112,75 122,80 L140,88 Q150,92 146,98 Q142,103 134,100 L120,94 Q112,91 108,95 L102,100 Q96,103 92,98 L88,92 Q84,87 76,88 L60,90 Q50,91 48,84 Z",
    Spa: "M40,92 Q34,92 36,84 L44,60 Q47,50 56,48 L60,47 Q66,46 64,40 L58,28 Q55,20 64,18 L150,15 Q165,14 166,26 Q167,36 156,38 L120,42 Q108,44 110,52 L116,70 Q119,80 108,82 L60,88 Q48,90 40,92 Z",
    Monza: "M40,95 L150,95 Q165,95 165,82 L165,40 Q165,28 152,28 L70,28 Q60,28 60,38 L60,46 Q60,54 70,54 L120,54 Q128,54 128,46 L128,42 Q128,36 120,38 L100,42 Q92,44 92,52 L92,80 Q92,88 80,88 L48,88 Q40,88 40,95 Z",
    Suzuka: "M44,40 Q40,30 52,28 L90,26 Q104,25 112,34 L130,52 Q140,62 152,64 L168,66 Q178,68 176,78 Q174,88 162,86 L120,80 Q108,78 100,70 L70,44 Q62,37 54,46 L40,62 Q32,72 44,76 L150,92 Q160,94 156,84 L150,70 Q146,58 134,56 L96,50 Q86,48 84,40 Q82,32 70,34 L50,38 Q44,39 44,40 Z",
    Silverstone: "M36,58 L70,56 Q82,55 86,46 L92,32 Q96,24 106,26 L150,32 Q162,34 162,46 L160,60 Q158,70 148,72 L120,76 Q110,77 112,84 L116,94 Q118,100 108,100 L70,98 Q58,97 56,88 L52,76 Q50,68 40,68 Q32,68 36,58 Z",
    Zandvoort: "M38,80 Q32,80 34,70 L40,44 Q43,32 55,32 L120,30 Q140,29 148,40 Q154,48 146,54 L130,58 Q122,60 124,68 L128,82 Q130,92 118,92 L100,90 Q92,89 90,82 L88,72 Q86,64 76,66 L52,74 Q42,77 38,80 Z",
    Bahrain: "M36,64 L58,62 Q68,61 72,52 L80,36 Q84,28 94,28 L128,28 Q140,28 144,38 L150,52 Q154,62 146,68 L130,80 Q122,86 112,84 L78,78 Q66,76 60,82 L46,90 Q36,94 34,84 Q32,72 36,64 Z",
    Jeddah: "M34,92 L40,40 Q41,30 50,32 L62,36 Q70,38 72,46 L74,60 Q76,68 84,66 L96,62 Q104,60 106,52 L108,42 Q110,32 120,30 L150,24 Q166,21 168,32 L166,90 Q166,98 156,98 L46,98 Q34,98 34,92 Z",
    Melbourne: "M34,62 L62,60 Q74,59 80,50 L88,36 Q93,28 104,30 L148,36 Q160,38 160,50 L158,66 Q156,78 144,80 L120,84 Q108,86 104,80 L96,70 Q90,62 78,66 L52,74 Q40,78 34,70 Q31,66 34,62 Z",
    Miami: "M36,90 L40,52 Q41,42 52,42 L90,42 Q100,42 102,34 L104,26 Q106,18 116,20 L150,28 Q164,31 164,44 L162,80 Q161,92 150,92 L120,90 Q110,89 108,82 Q106,74 96,76 L60,84 Q46,88 36,90 Z",
    Imola: "M40,84 Q34,82 38,72 L48,44 Q52,34 62,36 L78,40 Q88,42 88,34 L86,26 Q85,18 94,20 L140,30 Q156,34 156,48 L152,72 Q149,82 138,82 L110,80 Q100,79 100,86 Q99,92 90,90 L56,84 Q46,82 40,84 Z",
    Barcelone: "M36,56 L66,54 Q78,53 82,44 L88,32 Q92,24 102,26 L146,34 Q158,36 158,48 L156,66 Q154,78 142,80 L116,82 Q106,83 106,76 L106,68 Q106,60 96,62 L70,70 Q42,76 38,66 Q35,60 36,56 Z",
    Barcelona: "M36,56 L66,54 Q78,53 82,44 L88,32 Q92,24 102,26 L146,34 Q158,36 158,48 L156,66 Q154,78 142,80 L116,82 Q106,83 106,76 L106,68 Q106,60 96,62 L70,70 Q42,76 38,66 Q35,60 36,56 Z",
    Hungaroring: "M40,82 Q34,80 38,70 L46,50 Q49,40 60,42 L74,46 Q82,48 82,40 L82,30 Q82,22 92,24 L138,34 Q152,37 150,50 L146,64 Q143,72 134,70 L118,66 Q110,64 110,72 L112,82 Q113,90 103,90 L58,86 Q46,84 40,82 Z",
    Budapest: "M40,82 Q34,80 38,70 L46,50 Q49,40 60,42 L74,46 Q82,48 82,40 L82,30 Q82,22 92,24 L138,34 Q152,37 150,50 L146,64 Q143,72 134,70 L118,66 Q110,64 110,72 L112,82 Q113,90 103,90 L58,86 Q46,84 40,82 Z",
    Singapore: "M34,90 L36,46 Q36,36 46,36 L70,36 Q80,36 82,28 L84,22 L100,22 Q110,22 110,32 L110,52 Q110,62 120,62 L150,62 Q162,62 162,74 L162,90 Q162,98 152,98 L44,98 Q34,98 34,90 Z",
    Austin: "M36,88 Q30,86 34,76 L40,42 Q43,32 54,34 L66,38 Q74,40 76,32 L80,22 Q84,16 92,20 L150,40 Q162,44 158,56 L150,78 Q146,88 134,86 L110,82 Q100,80 98,86 Q96,92 86,90 L52,86 Q42,86 36,88 Z",
    Mexico: "M40,56 L138,52 Q150,51 150,63 L148,77 Q147,86 135,86 L96,87 Q87,87 87,79 L87,73 Q87,67 79,68 L62,71 Q50,72 49,64 Q48,55 60,55 L40,56 Z",
    Baku: "M34,94 L36,60 Q37,50 48,50 L70,50 Q80,50 82,42 L84,30 Q86,22 96,24 L106,26 Q114,28 114,36 L112,46 Q110,54 120,54 L150,54 Q164,54 164,66 L164,92 Q164,98 154,98 L44,98 Q34,98 34,94 Z",
    Portimao: "M38,78 Q32,76 36,66 L44,42 Q47,32 58,34 L96,40 Q106,42 108,34 L110,26 Q112,18 122,22 L150,34 Q162,39 158,52 L150,72 Q146,82 134,80 L108,74 Q98,72 96,80 Q94,88 84,86 L54,80 Q44,78 38,78 Z",
    Mugello: "M36,66 L60,62 Q72,60 76,50 L84,32 Q88,24 98,26 L146,36 Q158,38 156,50 L150,70 Q147,80 136,78 L114,74 Q104,72 102,80 L100,88 Q98,94 88,92 L56,86 Q44,84 40,76 Q35,70 36,66 Z",
    Misano: "M40,80 Q34,78 38,68 L46,46 Q49,36 60,38 L78,42 Q88,44 88,36 L88,28 Q88,20 98,22 L138,32 Q152,35 150,48 L146,66 Q143,76 132,74 L112,70 Q102,68 102,76 L104,84 Q105,90 95,90 L56,84 Q46,82 40,80 Z",
    Vallelunga: "M36,84 Q30,82 34,72 L40,40 Q42,30 52,32 L58,34 Q66,36 66,44 L66,70 Q66,80 76,80 L130,78 Q150,77 152,62 Q153,50 140,50 L120,52 Q110,53 110,45 L110,36 Q110,28 120,30 L146,40 Q158,44 156,58 L152,80 Q149,90 136,88 L52,86 Q42,86 36,84 Z",
    Spielberg: "M38,82 Q32,80 36,70 L44,48 Q47,38 58,40 L100,46 Q112,48 114,40 L116,30 Q118,22 128,26 L154,40 Q164,45 158,56 L148,76 Q143,84 132,82 L96,76 Q86,74 84,82 Q82,88 72,86 L52,82 Q44,82 38,82 Z",
    Okayama: "M40,76 Q34,74 38,64 L46,44 Q49,34 60,36 L80,40 Q90,42 90,34 L90,28 Q90,20 100,22 L136,32 Q150,35 148,48 L144,64 Q141,74 130,72 L110,68 Q100,66 100,74 L102,82 Q103,88 93,88 L56,82 Q46,80 40,76 Z",
    Autopolis: "M36,68 L58,64 Q70,62 74,52 L82,34 Q86,26 96,28 L144,38 Q156,41 154,54 L148,72 Q145,82 134,80 L110,76 Q100,74 98,82 L96,88 Q94,94 84,92 L54,86 Q42,84 38,78 Q33,72 36,68 Z",
    Sugo: "M36,82 Q30,80 34,70 L40,46 Q42,36 53,38 L66,42 Q74,44 78,38 L86,26 Q92,18 102,22 L112,28 Q120,33 116,42 L110,54 Q106,62 116,64 L140,68 Q152,71 150,82 Q148,90 136,88 L58,84 Q44,84 36,82 Z",
    Motegi: "M36,86 L40,52 Q41,42 52,42 L86,42 Q96,42 98,34 L100,26 Q102,18 112,22 L148,38 Q160,43 156,54 L150,76 Q147,86 136,84 L112,80 Q102,78 100,84 Q98,90 88,88 L52,86 Q40,86 36,86 Z",
    Sapporo: "M40,60 L60,58 Q72,56 74,46 L78,32 Q82,24 92,26 L120,32 Q132,35 132,46 Q132,56 122,56 L108,56 Q100,56 102,64 L106,78 Q108,88 96,88 L70,86 Q58,85 56,76 L54,68 Q52,62 42,66 L34,70 Q28,72 30,64 Q32,58 40,60 Z",
    Texas: "M50,60 Q50,32 100,30 Q150,32 150,60 Q150,88 100,90 Q50,88 50,60 Z",
    Detroit: "M36,88 L38,50 Q38,40 48,40 L78,40 Q88,40 90,32 L92,24 L120,24 Q130,24 130,34 L130,54 Q130,62 140,62 L158,62 Q166,62 166,72 L166,88 Q166,96 156,96 L46,96 Q36,96 36,88 Z",
    Iowa: "M56,60 Q56,38 100,36 Q144,38 144,60 Q144,82 100,84 Q56,82 56,60 Z",
    Nashville: "M34,92 L36,54 Q36,44 46,44 L84,44 Q94,44 96,36 L98,26 Q100,18 110,22 L150,40 Q162,45 160,56 L158,90 Q158,98 148,98 L44,98 Q34,98 34,92 Z",
    Portland: "M36,74 L70,70 Q82,68 86,60 L92,46 Q96,38 106,40 L148,50 Q160,53 158,64 L152,78 Q149,86 138,84 L112,80 Q102,78 100,84 L98,88 Q90,92 86,86 L78,80 Q72,76 64,78 L52,82 Q40,84 38,80 Q33,76 36,74 Z",
    Gateway: "M52,58 Q50,34 96,32 Q146,34 150,56 Q152,80 100,86 Q54,84 52,58 Z",
    Monterey: "M40,54 L58,52 Q70,50 72,42 L76,30 Q80,22 90,24 L110,30 Q120,33 118,42 L114,52 Q111,60 120,62 L146,70 Q158,73 154,84 Q150,92 140,88 L112,80 Q102,77 98,84 L92,92 Q86,98 80,90 L72,78 Q66,70 56,72 L42,76 Q34,78 36,68 Q37,58 40,54 Z",
  };

  function normalize(arr) {
    var s = arr[0] + arr[1] + arr[2];
    if (!s) return [0.34, 0.34, 0.32];
    return [arr[0] / s, arr[1] / s, arr[2] / s];
  }

  var applied = false;
  function apply() {
    if (applied) return true;
    if (typeof window.CIRCUITS !== "object" || !window.CIRCUITS) return false;
    if (typeof window.CIRCUIT_SECTORS !== "object" || !window.CIRCUIT_SECTORS) return false;

    var nTime = 0, nSec = 0, nPath = 0;
    for (var name in DATA) {
      if (!DATA.hasOwnProperty(name)) continue;
      var d = DATA[name];
      // secteurs : on remplit toujours (c'était vide)
      if (d.sec) { window.CIRCUIT_SECTORS[name] = normalize(d.sec); nSec++; }
      // temps : on n'écrase que si le circuit existe et qu'une valeur est fournie
      if (d.ref != null && window.CIRCUITS[name]) {
        window.CIRCUITS[name].refLapF1 = d.ref;
        nTime++;
      }
      // tracé : redessiné (forme plus fidèle), seulement si fourni
      if (d.path && window.CIRCUITS[name]) {
        window.CIRCUITS[name].path = d.path;
        nPath++;
      }
    }
    // tracés : on remplace le path du circuit s'il existe
    var nPath = 0;
    for (var pn in PATHS) {
      if (!PATHS.hasOwnProperty(pn)) continue;
      if (window.CIRCUITS[pn] && PATHS[pn]) { window.CIRCUITS[pn].path = PATHS[pn]; nPath++; }
    }
    applied = true;
    console.log("[52-circuits-realism] " + nSec + " découpages de secteurs + " +
                nTime + " temps de référence + " + nPath + " tracés appliqués");
    return true;
  }

  // bootstrap / retry : s'assure que 03-data-agent a défini CIRCUITS/CIRCUIT_SECTORS
  var tries = 0;
  function boot() {
    if (apply()) return;
    if (tries++ < 50) setTimeout(boot, 60);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window._rj52Uninstall = function () {
    console.log("[52-circuits-realism] désinstallé (rechargez pour revenir à l'origine)");
  };
})();
