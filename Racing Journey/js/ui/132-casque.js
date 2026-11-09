/* =====================================================================
 * 132-casque.js — UN CASQUE À SOI
 *
 * POURQUOI
 * La personnalisation (Carrière › Stats) ne proposait qu'une couleur et un
 * numéro, montrés par un simple dégradé.
 *
 * CE QUE FAIT LE MODULE
 * Un éditeur de casque : aperçu dessiné (profil, visière, aération,
 * numéro), trois couleurs (principale, secondaire, accent), un motif parmi
 * dix, une visière parmi quatre, une finition (brillant, mat, chromé), et
 * le numéro de course. Le casque est rangé dans G.pilot.helmet (sauvegardé
 * avec le pilote) ; G.pilot.helmetColor reçoit la teinte la plus proche
 * pour les écrans qui l'utilisent encore. La carte « Personnalisation » de
 * Stats montre le casque.
 *
 * API : RJCasque.svg(design, taille), RJCasque.design(), RJCasque.ouvrir().
 * Réversible : window._rj132Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[132-casque]";
  var PALETTE = ["#FF1801", "#B00020", "#FF6B00", "#F5B400", "#FFE14D", "#34D399", "#00A85A", "#0E7C6B", "#00D4FF", "#1E5BC6",
                 "#0B1D4A", "#5B4BE0", "#A855F7", "#EC4899", "#F4F4F6", "#9CA3AF", "#3A3D44", "#0B0B0E"];
  var MOTIFS = { uni: "Uni", centrale: "Bande centrale", bandes: "Bandes", chevron: "Chevron", flammes: "Flammes",
                 damier: "Damier", etoiles: "Étoiles", eclair: "Éclair", diagonale: "Diagonale", degrade: "Dégradé" };
  var VISIERES = { fumee: ["Fumée", "#11141a", "#3b4250"], iridium: ["Iridium bleu", "#1e3a8a", "#38bdf8", "#a78bfa"],
                   or: ["Or", "#6b4a07", "#f5c542"], argent: ["Argent", "#4b5260", "#e5e7eb"] };
  var FINITIONS = { brillant: "Brillant", mat: "Mat", chrome: "Chromé" };

  var uid = 0;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function clair(hex, t) {
    var h = String(hex || "#888888").replace("#", ""); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var c = [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); });
    var cible = t >= 0 ? 255 : 0, a = Math.abs(t);
    return "#" + c.map(function (v) { var x = Math.round(v + (cible - v) * a); return (x < 16 ? "0" : "") + x.toString(16); }).join("");
  }
  function lum(hex) { var h = String(hex).replace("#", ""); var r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }

  /* --- Le design du joueur ------------------------------------------------ */
  function defaut() {
    var ancien = { red: "#FF1801", blue: "#3B82F6", yellow: "#F59E0B", green: "#10B981", purple: "#A855F7", cyan: "#06B6D4", pink: "#EC4899", white: "#E5E7EB", black: "#1F2937", orange: "#F97316" };
    var base = (typeof G !== "undefined" && G.pilot && ancien[G.pilot.helmetColor]) || "#FF1801";
    return { base: base, second: "#F4F4F6", accent: "#0B0B0E", motif: "centrale", visiere: "fumee", finition: "brillant" };
  }
  function design() {
    var d = (typeof G !== "undefined" && G.pilot && G.pilot.helmet) || null;
    var x = defaut();
    if (d) Object.keys(x).forEach(function (k) { if (d[k]) x[k] = d[k]; });
    return x;
  }
  function numero() { return (typeof G !== "undefined" && G.pilot && G.pilot.number) || 23; }

  /* --- Dessin : profil d'un casque intégral de course, tourné vers la droite.
     Coque haute et ronde, nuque qui redescend, mentonnière avancée ; bande de
     visière, visière fumée ou iridium avec pivot et languette, aileron
     arrière, prises d'air, bourrelet de nuque. Le volume vient de deux
     dégradés (reflet en haut, ombre sur le pourtour). --------------------- */
  var COQUE = "M46 140 C30 116 28 74 52 46 C76 18 118 8 154 15 C186 21 208 46 214 80 C218 100 217 118 210 130 C204 141 190 148 172 148 L74 150 C61 150 52 147 46 140 Z";
  var OUVERTURE = "M134 64 C158 54 196 56 214 74 C217 87 216 98 211 105 L139 105 C128 101 125 75 134 64 Z";
  var BANDE = "M126 60 C154 44 196 46 216 66 L216 74 C196 56 158 54 134 64 Z";
  var NUQUE = "M48 140 C62 152 168 154 206 136 L204 146 C166 162 60 160 44 148 Z";
  var AILERON = "M58 40 C52 34 40 32 32 36 L36 46 C42 43 50 44 56 48 Z";
  function motif(m, d) {
    var S = d.second, A = d.accent;
    switch (m) {
      case "centrale": return '<path d="M30 100 C36 50 96 16 184 34 L192 50 C120 32 60 58 52 112 Z" fill="' + S + '"/><path d="M30 100 C36 50 96 16 184 34" fill="none" stroke="' + A + '" stroke-width="3.5"/><path d="M52 112 C60 58 120 32 192 50" fill="none" stroke="' + A + '" stroke-width="3.5"/>';
      case "bandes": return '<path d="M20 70 L220 42 V56 L20 84 Z" fill="' + S + '"/><path d="M20 90 L220 62 V69 L20 97 Z" fill="' + A + '"/>';
      case "chevron": return '<path d="M30 40 L130 88 L30 136 L30 114 L92 88 L30 62 Z" fill="' + S + '"/><path d="M30 62 L92 88 L30 114" fill="none" stroke="' + A + '" stroke-width="3.5"/>';
      case "flammes": return '<path d="M216 120 L176 116 L192 104 L150 108 L166 92 L124 100 L140 82 L98 92 L112 72 L72 84 L86 62 L48 76 L58 52 L24 64 L24 170 L216 170 Z" fill="' + S + '" stroke="' + A + '" stroke-width="3" stroke-linejoin="round"/>';
      case "damier": var c = ""; for (var y = 0; y < 10; y++) for (var x = 0; x < 7; x++) if ((x + y) % 2 === 0) c += '<rect x="' + (24 + x * 12) + '" y="' + (12 + y * 15) + '" width="12" height="15" fill="' + S + '"/>';
        return c + '<path d="M108 10 V170" stroke="' + A + '" stroke-width="3.5"/>';
      case "etoiles": var e = ""; [[70, 56, 14], [104, 38, 10], [56, 94, 10], [96, 78, 17], [146, 40, 9]].forEach(function (p) {
          var pts = []; for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? p[2] * .45 : p[2]; pts.push((p[0] + r * Math.cos(a)).toFixed(1) + "," + (p[1] + r * Math.sin(a)).toFixed(1)); }
          e += '<polygon points="' + pts.join(" ") + '" fill="' + S + '" stroke="' + A + '" stroke-width="1.5"/>'; });
        return e;
      case "eclair": return '<path d="M46 30 L110 30 L84 76 L124 76 L52 152 L72 96 L38 96 Z" fill="' + S + '" stroke="' + A + '" stroke-width="3.5" stroke-linejoin="round"/>';
      case "diagonale": return '<path d="M20 170 L164 8 L220 8 L220 170 Z" fill="' + S + '"/><path d="M20 170 L164 8" stroke="' + A + '" stroke-width="4"/>';
      case "degrade": return '<rect x="0" y="0" width="220" height="170" fill="url(#' + d._id + '-deg)"/>';
      default: return "";
    }
  }

  function svg(d, taille) {
    d = d || design();
    var id = "rjcasque" + (++uid);
    d = Object.assign({}, d, { _id: id });
    var t = taille || 120, v = VISIERES[d.visiere] || VISIERES.fumee, num = String(numero());
    var stopsVis = v.slice(1).map(function (c, i, a) { return '<stop offset="' + (a.length > 1 ? i / (a.length - 1) : 0) + '" stop-color="' + c + '"/>'; }).join("");
    var brillance = d.finition === "mat" ? .14 : d.finition === "chrome" ? .7 : .5;
    var defs = '<defs><clipPath id="' + id + '-coque"><path d="' + COQUE + '"/></clipPath>' +
      '<linearGradient id="' + id + '-base" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + clair(d.base, .12) + '"/><stop offset=".55" stop-color="' + d.base + '"/><stop offset="1" stop-color="' + clair(d.base, -.35) + '"/></linearGradient>' +
      '<radialGradient id="' + id + '-volume" cx="42%" cy="40%" r="64%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>' +
      '<radialGradient id="' + id + '-eclat" cx="34%" cy="18%" r="42%"><stop offset="0" stop-color="#fff" stop-opacity="' + brillance + '"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="' + id + '-vis" x1="0" y1="0" x2="1" y2="1">' + stopsVis + '</linearGradient>' +
      '<linearGradient id="' + id + '-deg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + d.second + '"/><stop offset=".55" stop-color="' + d.second + '" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="' + id + '-chrome" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".4"/><stop offset=".45" stop-color="#000" stop-opacity=".2"/><stop offset=".6" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity=".15"/></linearGradient></defs>';
    var plaque = lum(d.accent) > .6 ? "#0B0B0E" : "#F4F4F6", encre = plaque === "#F4F4F6" ? "#0B0B0E" : "#F4F4F6";
    var sombre = clair(d.base, -.7);
    var corps =
      '<path d="' + NUQUE + '" fill="#141418"/>' +
      '<path d="' + COQUE + '" fill="url(#' + id + '-base)"/>' +
      '<g clip-path="url(#' + id + '-coque)">' + motif(d.motif, d) +
        (d.finition === "chrome" ? '<rect width="220" height="170" fill="url(#' + id + '-chrome)"/>' : "") +
        '<rect width="220" height="170" fill="url(#' + id + '-volume)"/>' +
        '<rect width="220" height="170" fill="url(#' + id + '-eclat)"/>' +
        '<path d="M58 54 C80 28 120 20 156 26" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="' + (brillance * .8).toFixed(2) + '"/>' +
        '<path d="' + BANDE + '" fill="' + d.accent + '"/>' +
      "</g>" +
      '<path d="' + COQUE + '" fill="none" stroke="' + sombre + '" stroke-width="2"/>' +
      '<path d="' + AILERON + '" fill="' + d.accent + '" stroke="' + sombre + '" stroke-width="1.5"/>' +
      // prises d'air : sommet et mentonnière
      '<path d="M120 12 l18 -1 l-2 6 h-15 z" fill="#0d0d10" stroke="' + sombre + '" stroke-width="1"/>' +
      '<g stroke="#0d0d10" stroke-width="3.2" stroke-linecap="round"><path d="M186 116 h18"/><path d="M184 123 h17"/><path d="M182 130 h15"/></g>' +
      // visière
      '<path d="' + OUVERTURE + '" fill="#08080a"/>' +
      '<path d="M136 66 C160 57 194 59 212 76 C214 87 213 96 209 102 L141 102 C131 98 128 76 136 66 Z" fill="url(#' + id + '-vis)"/>' +
      '<path d="M142 70 C164 62 190 64 206 77" fill="none" stroke="#fff" stroke-width="2.4" opacity=".5" stroke-linecap="round"/>' +
      '<path d="M146 96 L204 96" stroke="#fff" stroke-width="1" opacity=".18"/>' +
      '<rect x="207" y="92" width="7" height="9" rx="1.5" fill="' + d.accent + '"/>' +                     // languette d'arrachage
      '<circle cx="132" cy="84" r="5" fill="#1a1a1f" stroke="' + clair(d.accent, .3) + '" stroke-width="1.6"/><circle cx="132" cy="84" r="1.6" fill="' + clair(d.accent, .3) + '"/>' +
      // numéro sur le côté
      '<g transform="translate(84 112)"><circle r="18" fill="' + plaque + '" stroke="' + d.accent + '" stroke-width="2.6"/>' +
      '<text y="7" text-anchor="middle" font-family="Arial Black,Impact,sans-serif" font-size="' + (num.length > 1 ? 19 : 22) + '" font-weight="900" font-style="italic" fill="' + encre + '">' + esc(num) + "</text></g>";
    return '<svg viewBox="0 0 220 170" width="' + t + '" height="' + Math.round(t * 170 / 220) + '" class="rj132-casque" aria-label="Casque du pilote">' + defs + corps + "</svg>";
  }

  /* --- Éditeur -------------------------------------------------------------- */
  var brouillon = null, num = 23;
  function pastilles(cle) {
    return PALETTE.map(function (c) {
      return '<button type="button" class="rj132-pastille' + (brouillon[cle].toLowerCase() === c.toLowerCase() ? " on" : "") + '" style="background:' + c + '" data-cle="' + cle + '" data-val="' + c + '" title="' + c + '"></button>';
    }).join("") + '<input type="color" class="rj132-libre" data-cle="' + cle + '" value="' + brouillon[cle] + '" title="Teinte libre">';
  }
  function choix(cle, table, avecApercu) {
    return Object.keys(table).map(function (k) {
      var nom = Array.isArray(table[k]) ? table[k][0] : table[k];
      var ap = avecApercu ? svg(Object.assign({}, brouillon, { motif: k }), 64) : "";
      return '<button type="button" class="rj132-choix' + (brouillon[cle] === k ? " on" : "") + '" data-cle="' + cle + '" data-val="' + k + '">' + ap + "<span>" + esc(nom) + "</span></button>";
    }).join("");
  }
  function dessiner() {
    var m = document.getElementById("rj132-modale");
    if (!m) return;
    var sauve = G.pilot.number; G.pilot.number = num;        // l'aperçu montre le numéro en cours d'édition
    try {
      m.querySelector(".rj132-apercu").innerHTML = svg(brouillon, 240);
      m.querySelector(".rj132-corps").innerHTML =
        '<div class="rj132-ligne"><div class="rj132-lbl">Numéro</div><div class="rj132-num"><button type="button" data-num="-1">−</button><b>#' + num + '</b><button type="button" data-num="1">+</button></div></div>' +
        '<div class="rj132-lbl">Couleur principale</div><div class="rj132-palette">' + pastilles("base") + "</div>" +
        '<div class="rj132-lbl">Couleur secondaire</div><div class="rj132-palette">' + pastilles("second") + "</div>" +
        '<div class="rj132-lbl">Couleur d\'accent</div><div class="rj132-palette">' + pastilles("accent") + "</div>" +
        '<div class="rj132-lbl">Motif</div><div class="rj132-grille">' + choix("motif", MOTIFS, true) + "</div>" +
        '<div class="rj132-lbl">Visière</div><div class="rj132-rang">' + choix("visiere", VISIERES) + "</div>" +
        '<div class="rj132-lbl">Finition</div><div class="rj132-rang">' + choix("finition", FINITIONS) + "</div>";
    } finally { G.pilot.number = sauve; }
  }
  function ouvrir() {
    if (typeof G === "undefined" || !G.pilot) return;
    fermer();
    brouillon = design(); num = numero();
    var m = document.createElement("div");
    m.id = "rj132-modale";
    m.innerHTML = '<div class="rj132-carte"><div class="rj132-tete"><div><div class="rj132-kicker">Personnalisation</div><div class="rj132-titre">Ton casque</div></div>' +
      '<button type="button" class="rj132-fermer" aria-label="Fermer">×</button></div>' +
      '<div class="rj132-apercu"></div><div class="rj132-corps"></div>' +
      '<div class="rj132-actions"><button type="button" class="rj132-annuler">Annuler</button><button type="button" class="rj132-valider">Enregistrer</button></div></div>';
    document.body.appendChild(m);
    m.addEventListener("click", function (ev) {
      var b = ev.target.closest("button");
      if (ev.target === m || (b && (b.classList.contains("rj132-fermer") || b.classList.contains("rj132-annuler")))) return fermer();
      if (!b) return;
      if (b.classList.contains("rj132-valider")) return enregistrer();
      if (b.dataset.num) { num = Math.max(2, Math.min(99, num + (+b.dataset.num))); return dessiner(); }
      if (b.dataset.cle) { brouillon[b.dataset.cle] = b.dataset.val; dessiner(); }
    });
    m.addEventListener("input", function (ev) { if (ev.target.dataset && ev.target.dataset.cle) { brouillon[ev.target.dataset.cle] = ev.target.value; m.querySelector(".rj132-apercu").innerHTML = svg(brouillon, 240); } });
    m.addEventListener("change", function (ev) { if (ev.target.dataset && ev.target.dataset.cle) dessiner(); });
    dessiner();
  }
  function fermer() { var m = document.getElementById("rj132-modale"); if (m) m.remove(); }
  function teinteProche(hex) {
    var t = { red: "#FF1801", blue: "#3B82F6", yellow: "#F59E0B", green: "#10B981", purple: "#A855F7", cyan: "#06B6D4", pink: "#EC4899", white: "#E5E7EB", black: "#1F2937", orange: "#F97316" };
    function rgb(h) { h = h.replace("#", ""); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
    var c = rgb(hex), best = "red", dist = 1e9;
    Object.keys(t).forEach(function (k) { var o = rgb(t[k]), dd = Math.pow(o[0] - c[0], 2) + Math.pow(o[1] - c[1], 2) + Math.pow(o[2] - c[2], 2); if (dd < dist) { dist = dd; best = k; } });
    return best;
  }
  function enregistrer() {
    G.pilot.helmet = { base: brouillon.base, second: brouillon.second, accent: brouillon.accent, motif: brouillon.motif, visiere: brouillon.visiere, finition: brouillon.finition };
    G.pilot.helmetColor = teinteProche(brouillon.base);
    G.pilot.number = num; G._numberChosenByPlayer = true;
    try { if (typeof updateHomeNumber === "function") updateHomeNumber(); var h = document.getElementById("h-number"); if (h) h.textContent = "#" + num; } catch (e) {}
    try { if (typeof _applyHelmetColorToAvatar === "function") _applyHelmetColorToAvatar(); } catch (e) {}
    try { if (typeof saveGame === "function" && G._slot != null) saveGame(G._slot); } catch (e) {}
    fermer(); carte();
    try { if (typeof pushHomeToast === "function") pushHomeToast("Casque", "Ton nouveau casque est prêt pour la prochaine course.", brouillon.base); } catch (e) {}
  }

  /* --- La carte « Personnalisation » de Stats montre le casque ------------- */
  function carte() {
    var c = document.querySelector('#S-pilot .card[onclick="openPersonalizationModal()"]');
    if (!c || typeof G === "undefined" || !G.pilot) return;
    var ico = c.firstElementChild;
    if (ico && !ico.classList.contains("rj132-mini")) { ico.className = "rj132-mini"; ico.removeAttribute("style"); }
    if (ico) ico.innerHTML = svg(design(), 64);
    [].forEach.call(c.querySelectorAll("div"), function (el) {
      if (el.children.length) return;
      if (/^Numéro & couleur$/.test(el.textContent.trim())) el.textContent = "Casque & numéro";
      else if (/^Personnalise ton identité visuelle$/.test(el.textContent.trim())) el.textContent = "Couleurs, motif, visière, finition et numéro de course";
    });
  }

  function boot() {
    if (typeof window.rjInscrire !== "function" || typeof window.openPersonalizationModal !== "function" || !Array.isArray(window.RJ_SCREEN_HOOKS)) return setTimeout(boot, 100);
    rjInscrire("openPersonalizationModal", { id: "132-casque:editeur", remplace: function () { ouvrir(); } });
    if (!RJ_SCREEN_HOOKS.some(function (h) { return h.id === "132-casque"; })) RJ_SCREEN_HOOKS.push({ id: "132-casque", ecran: "S-pilot", apres: function () { setTimeout(carte, 30); } });
    window.RJCasque = { svg: svg, design: design, ouvrir: ouvrir, fermer: fermer, MOTIFS: MOTIFS };
    window._rj132Uninstall = function () {
      if (typeof rjDesinscrire === "function") rjDesinscrire(["132-casque"], "openPersonalizationModal");
      window.RJ_SCREEN_HOOKS = RJ_SCREEN_HOOKS.filter(function (h) { return h.id !== "132-casque"; });
      fermer(); delete window.RJCasque;
    };
    console.log(TAG, "actif");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
