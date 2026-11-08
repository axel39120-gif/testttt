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

  /* --- Dessin : profil d'un casque intégral, tourné vers la droite -------- */
  var COQUE = "M30 104 C25 58 60 20 110 18 C152 16 184 46 188 86 C190 104 184 118 172 124 L152 128 C148 138 138 145 124 145 L66 145 C45 145 32 128 30 104 Z";
  var VISIERE = "M114 66 C132 58 168 61 184 76 C186 89 182 98 173 101 L120 101 C109 99 105 78 114 66 Z";
  function motif(m, d) {
    var S = d.second, A = d.accent;
    switch (m) {
      case "centrale": return '<path d="M26 92 C34 44 92 16 176 36 L182 52 C112 34 58 54 46 104 Z" fill="' + S + '"/><path d="M26 92 C34 44 92 16 176 36" fill="none" stroke="' + A + '" stroke-width="3"/><path d="M46 104 C58 54 112 34 182 52" fill="none" stroke="' + A + '" stroke-width="3"/>';
      case "bandes": return '<path d="M20 64 L200 40 V52 L20 76 Z" fill="' + S + '"/><path d="M20 82 L200 58 V64 L20 88 Z" fill="' + A + '"/>';
      case "chevron": return '<path d="M30 40 L120 82 L30 124 L30 104 L84 82 L30 60 Z" fill="' + S + '"/><path d="M30 60 L84 82 L30 104" fill="none" stroke="' + A + '" stroke-width="3"/>';
      case "flammes": return '<path d="M196 112 C160 108 150 96 132 102 C140 90 122 82 104 92 C110 78 92 66 70 80 C76 64 58 54 40 66 C48 50 36 40 22 46 L22 150 L196 150 Z" fill="' + S + '"/><path d="M196 112 C160 108 150 96 132 102 C140 90 122 82 104 92 C110 78 92 66 70 80 C76 64 58 54 40 66 C48 50 36 40 22 46" fill="none" stroke="' + A + '" stroke-width="3"/>';
      case "damier": var c = ""; for (var y = 0; y < 9; y++) for (var x = 0; x < 6; x++) if ((x + y) % 2 === 0) c += '<rect x="' + (22 + x * 11) + '" y="' + (20 + y * 14) + '" width="11" height="14" fill="' + S + '"/>';
        return c + '<path d="M88 18 V150" stroke="' + A + '" stroke-width="3"/>';
      case "etoiles": var e = ""; [[60, 50, 13], [92, 36, 9], [48, 86, 9], [84, 72, 16], [130, 40, 8]].forEach(function (p) {
          var pts = []; for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? p[2] * .45 : p[2]; pts.push((p[0] + r * Math.cos(a)).toFixed(1) + "," + (p[1] + r * Math.sin(a)).toFixed(1)); }
          e += '<polygon points="' + pts.join(" ") + '" fill="' + S + '" stroke="' + A + '" stroke-width="1.5"/>'; });
        return e;
      case "eclair": return '<path d="M40 30 L96 30 L74 70 L110 70 L46 140 L64 88 L34 88 Z" fill="' + S + '" stroke="' + A + '" stroke-width="3" stroke-linejoin="round"/>';
      case "diagonale": return '<path d="M20 150 L150 10 L200 10 L200 150 Z" fill="' + S + '"/><path d="M20 150 L150 10" stroke="' + A + '" stroke-width="4"/>';
      case "degrade": return '<rect x="0" y="0" width="200" height="160" fill="url(#' + d._id + '-deg)"/>';
      default: return "";
    }
  }

  function svg(d, taille) {
    d = d || design();
    var id = "rjcasque" + (++uid);
    d = Object.assign({}, d, { _id: id });
    var t = taille || 120, v = VISIERES[d.visiere] || VISIERES.fumee, num = String(numero());
    var stopsVis = v.slice(1).map(function (c, i, a) { return '<stop offset="' + (a.length > 1 ? i / (a.length - 1) : 0) + '" stop-color="' + c + '"/>'; }).join("");
    var brillance = d.finition === "mat" ? .12 : d.finition === "chrome" ? .55 : .38;
    var defs = '<defs><clipPath id="' + id + '-coque"><path d="' + COQUE + '"/></clipPath>' +
      '<linearGradient id="' + id + '-base" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + clair(d.base, .18) + '"/><stop offset=".6" stop-color="' + d.base + '"/><stop offset="1" stop-color="' + clair(d.base, -.45) + '"/></linearGradient>' +
      '<linearGradient id="' + id + '-vis" x1="0" y1="0" x2="1" y2="1">' + stopsVis + '</linearGradient>' +
      '<linearGradient id="' + id + '-deg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + d.second + '"/><stop offset=".55" stop-color="' + d.second + '" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="' + id + '-reflet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="' + brillance + '"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="' + id + '-chrome" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".5" stop-color="#000" stop-opacity=".15"/><stop offset="1" stop-color="#fff" stop-opacity=".3"/></linearGradient></defs>';
    var plaque = lum(d.accent) > .6 ? "#0B0B0E" : "#F4F4F6";
    var corps =
      '<path d="' + COQUE + '" fill="url(#' + id + '-base)"/>' +
      '<g clip-path="url(#' + id + '-coque)">' + motif(d.motif, d) +
        (d.finition === "chrome" ? '<rect width="200" height="160" fill="url(#' + id + '-chrome)"/>' : "") +
        '<path d="M40 60 C60 28 110 20 150 30 C110 30 70 44 52 74 Z" fill="url(#' + id + '-reflet)"/>' +
        '<path d="M30 118 C60 136 120 140 176 122 L190 160 L20 160 Z" fill="#000" opacity=".22"/>' +   // ombre du bas
      "</g>" +
      '<path d="' + COQUE + '" fill="none" stroke="' + clair(d.base, -.6) + '" stroke-width="2"/>' +
      // aération et mentonnière
      '<path d="M160 112 h18 M158 118 h16" stroke="' + d.accent + '" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M96 22 l14 -1 l-2 6 h-11 z" fill="' + d.accent + '"/>' +
      // visière
      '<path d="' + VISIERE + '" fill="url(#' + id + '-vis)" stroke="' + d.accent + '" stroke-width="3"/>' +
      '<path d="M120 70 C138 64 162 66 176 76" fill="none" stroke="#fff" stroke-width="2" opacity=".45"/>' +
      '<circle cx="116" cy="84" r="4" fill="' + d.accent + '" stroke="' + clair(d.accent, .4) + '" stroke-width="1"/>' +
      // numéro sur le côté
      '<g transform="translate(66 104)"><circle r="17" fill="' + plaque + '" stroke="' + d.accent + '" stroke-width="2.5"/>' +
      '<text y="7" text-anchor="middle" font-family="Arial Black,Impact,sans-serif" font-size="' + (num.length > 1 ? 18 : 21) + '" font-weight="900" font-style="italic" fill="' + (plaque === "#F4F4F6" ? "#0B0B0E" : "#F4F4F6") + '">' + esc(num) + "</text></g>";
    return '<svg viewBox="0 0 200 160" width="' + t + '" height="' + Math.round(t * .8) + '" class="rj132-casque" aria-label="Casque du pilote">' + defs + corps + "</svg>";
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
