/* =====================================================================
 * 160-notifications.js — LES NOTIFICATIONS
 *
 * POURQUOI
 * Cinq morceaux se disputaient le haut de l'écran : la pile de 03, la file
 * de 53, les filtres de 28 et 40, la file de 124, plus la pile des trophées.
 * Résultat : plusieurs bandeaux empilés sur le jeu, des avis perdus ou
 * affichés deux fois, et rien pour relire ce qu'on avait manqué.
 *
 * LES RÈGLES (jeu mobile, pouce et petit écran)
 *   1. UNE SEULE notification à la fois : une pastille étroite, sous
 *      l'encoche, qui ne prend pas le doigt en dehors d'elle.
 *   2. JAMAIS pendant qu'on joue : course, séances, conférence, événement,
 *      création, bilan de saison, ou fenêtre ouverte. Elle attend, sans se
 *      perdre, et on la retrouve au calme.
 *   3. PAS D'AVALANCHE : doublons ignorés, messages regroupés ; au plus deux
 *      avis d'affilée, le reste en une ligne (« 4 autres nouvelles »).
 *   4. UTILE : toucher ouvre l'écran concerné ; glisser vers le haut ferme.
 *   5. RIEN NE SE PERD : la cloche de l'accueil garde les 30 derniers avis.
 *   6. La réponse à une action du joueur (« Pas assez de PA ») est immédiate.
 *
 * API : pushHomeToast(titre, texte, couleur), showToast(texte) et
 * showAchievementUnlock(trophée) — inchangées pour tout le jeu —, et
 * window.RJNotifs = { etat, cloche, ouvrir, vider }.
 * Persistance : bloc « rj160 » (historique, réglage « discret »).
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[160-notifications]";
  var OCCUPE = { "S-race": 1, "S-mediaday": 1, "S-event": 1, "S-season-end": 1, "S-create": 1, "S-agent": 1, "S-mode": 1, "S-splash": 1, "S-preseason": 1 };
  var DUREE = 3200, COURTE = 1800, GROUPE = 900, RETENUES = 30;
  var file = [], enCours = null, minuterie = 0, historique = [], nonLus = 0, discret = false, derniers = {};

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function ecran() { var e = document.querySelector(".scr.on"); return e ? e.id : ""; }
  function fenetreOuverte() {
    return [].some.call(document.body.children, function (x) {
      if (x.id === "app" || x.id === "rj-toast-container") return false;
      var cs = getComputedStyle(x);
      return cs.position === "fixed" && cs.display !== "none" && cs.visibility !== "hidden" && cs.pointerEvents !== "none" &&
        x.offsetWidth > document.body.offsetWidth * 0.8 && x.offsetHeight > document.body.offsetHeight * 0.8;
    });
  }
  function calme() { var e = ecran(); return !!e && !OCCUPE[e] && !fenetreOuverte(); }

  /* Où mène l'avis : déduit de son titre. */
  var CIBLES = [[/message|messagerie/i, "S-mailbox"], [/sponsor/i, "S-sponsors"], [/offre|baquet|contrat|a signé|transfert|saison blanche/i, "S-contracts"],
    [/budget|prime|patrimoine/i, "S-patrimoine"], [/super licence|spécialité|casque|identité|rêve|troph/i, "S-pilot"], [/rivalité|titre|règlement/i, "S-champ"], [/abonnés|moment marquant/i, "S-media"], [/rupture/i, "S-lifestyle"]];
  function cibleDe(t) { for (var i = 0; i < CIBLES.length; i++) if (CIBLES[i][0].test(t)) return document.getElementById(CIBLES[i][1]) ? CIBLES[i][1] : null; return null; }
  var ICONES = { "S-mailbox": "M3 6h18v12H3z M3 7l9 6 9-6", "S-sponsors": "M12 2l8 4v6c0 5-3.5 8-8 10-4.500-2-8-5-8-10V6z", "S-contracts": "M6 2h9l4 4v16H6z M9 12h7 M9 16h7", "S-pilot": "M12 3a8 8 0 0 0-8 8v6h16v-6a8 8 0 0 0-8-8z M4 13h9l7 1", "S-champ": "M7 4h10v5a5 5 0 0 1-10 0z M12 14v5 M8 20h8" };
  var CLOCHE = "M6 17V11a6 6 0 0 1 12 0v6l2 2H4z M10 21h4";
  function icone(d) { return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>'; }

  function retenir(n) {
    if (n.court) return;
    historique.unshift({ t: n.titre, x: n.texte, c: n.couleur, s: G.saison, w: G.semaine, v: n.cible });
    historique.length = Math.min(historique.length, RETENUES);
    nonLus++; majCloche();
  }

  function recevoir(titre, texte, couleur, options) {
    options = options || {};
    titre = String(titre || "").trim(); texte = String(texte || "").trim();
    if (!titre && !texte) return;
    if (!titre) { titre = texte; texte = ""; }
    var n = { titre: titre, texte: texte, couleur: couleur || "#60A5FA", cible: cibleDe(titre + " " + texte), court: !!options.court, fort: !!options.fort };
    if (n.cible === ecran() && n.cible === "S-mailbox" && /message/i.test(titre)) return;      // on l'a sous les yeux
    var cle = titre + "|" + texte, t = Date.now();
    if (!n.court && derniers[cle] && t - derniers[cle] < 20000) return;                         // doublon
    derniers[cle] = t;
    if (n.court) { fermer(true); afficher(n); return; }
    retenir(n);
    if (discret && !n.fort && n.cible !== "S-contracts") return;                                 // réglage : la cloche suffit
    file.push(n);
    planifier(GROUPE);
  }

  function planifier(ms) { clearTimeout(minuterie); minuterie = setTimeout(suivante, ms); }

  /* La file devient au plus deux avis et une ligne pour le reste. */
  function reduire() {
    var mails = file.filter(function (n) { return n.titre === "Nouveau message"; }), autres = file.filter(function (n) { return n.titre !== "Nouveau message"; });
    if (mails.length > 1) autres.push({ titre: "Messagerie", texte: mails.length + " nouveaux messages à lire", couleur: mails[0].couleur, cible: "S-mailbox" });
    else if (mails.length) autres.push(mails[0]);
    autres.sort(function (a, b) { return (b.fort ? 1 : 0) - (a.fort ? 1 : 0); });
    if (autres.length > 3) autres = autres.slice(0, 2).concat({ titre: (autres.length - 2) + " autres nouvelles", texte: "À lire dans la cloche de l'accueil", couleur: "#9CA3AF", cloche: true });
    file = autres;
  }
  function suivante() {
    if (enCours || !file.length) return;
    if (!calme()) return planifier(1200);
    reduire();
    var n = file.shift();
    window._pushHomeToastCoeur(n.titre, n.texte, n.couleur, n);
    if (file.length && !enCours) planifier(700);
  }

  function conteneur() {
    var c = document.getElementById("rj-toast-container");
    if (!c) { c = document.createElement("div"); c.id = "rj-toast-container"; c.setAttribute("role", "status"); c.setAttribute("aria-live", "polite"); document.body.appendChild(c); }
    return c;
  }
  function afficher(n) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "rj-toast" + (n.court ? " court" : "") + (n.fort ? " fort" : ""); b.style.setProperty("--n", n.couleur);
    b.innerHTML = '<span class="rj160-ico">' + icone(ICONES[n.cible] || CLOCHE) + '</span><span class="rj160-txt"><b>' + esc(n.titre) + "</b>" + (n.texte ? "<span>" + esc(n.texte) + "</span>" : "") + "</span>" +
      (n.cible || n.cloche ? '<span class="rj160-va" aria-hidden="true">›</span>' : "");
    var y0 = null;
    b.addEventListener("pointerdown", function (e) { y0 = e.clientY; });
    b.addEventListener("click", function (e) {
      var glisse = y0 !== null && Math.abs(e.clientY - y0) > 12; fermer();
      if (glisse) return;
      if (n.cloche) ouvrir(); else if (n.cible && typeof navTo === "function") navTo(n.cible, null);
    });
    b.addEventListener("pointerup", function (e) { if (y0 !== null && y0 - e.clientY > 14) fermer(); });
    conteneur().appendChild(b);
    enCours = { el: b, fin: setTimeout(fermer, n.court ? COURTE : DUREE + (n.fort ? 1400 : 0)) };
  }
  function fermer(vite) {
    if (!enCours) return;
    var el = enCours.el; clearTimeout(enCours.fin); enCours = null;
    if (vite === true) el.remove(); else { el.classList.add("sort"); setTimeout(function () { el.remove(); }, 200); }
    if (file.length) planifier(700);
  }

  /* --- La cloche et son journal ------------------------------------- */
  /* v309 : un seul bouton pour toute la partie. Seul le nombre change ; la cloche
     et sa pastille ne sont plus jamais recréées. */
  var bouton = null;
  function cloche() {
    if (!bouton) {
      bouton = document.createElement("button");
      bouton.type = "button"; bouton.className = "rj-hud-chip rj160-cloche";
      bouton.innerHTML = icone(CLOCHE) + "<i></i>";
      bouton.addEventListener("click", function () { ouvrir(); });
    }
    majCloche();
    return bouton;
  }
  function majCloche() {
    if (!bouton) return;
    var n = bouton.querySelector("i"), t = nonLus ? String(Math.min(nonLus, 99)) : "";
    if (n.textContent !== t) n.textContent = t;
    n.hidden = !t;
    bouton.setAttribute("aria-label", t ? "Notifications, " + t + " non lues" : "Notifications");
  }
  function ouvrir() {
    nonLus = 0; majCloche(); fermer(true); file = [];
    var m = document.createElement("div"); m.id = "rj160-journal"; m.className = "rj160-voile";
    m.innerHTML = '<div class="rj160-carte"><div class="rj160-tete"><b>Notifications</b><label><input type="checkbox"' + (discret ? " checked" : "") + '> Mode discret</label><button type="button" class="rj160-x" aria-label="Fermer">×</button></div><div class="rj160-liste">' +
      (historique.length ? historique.map(function (h, i) {
        return '<button type="button" data-i="' + i + '" style="--n:' + esc(h.c) + '"><span class="rj160-txt"><b>' + esc(h.t) + "</b><span>" + esc(h.x) + '</span></span><em>S' + h.s + " · sem. " + h.w + "</em></button>";
      }).join("") : '<div class="rj-vide">Aucune notification pour l\'instant.</div>') + "</div></div>";
    m.addEventListener("click", function (e) {
      var l = e.target.closest("[data-i]");
      if (l) { var h = historique[+l.getAttribute("data-i")]; m.remove(); if (h.v) navTo(h.v, null); return; }
      if (e.target === m || e.target.closest(".rj160-x")) m.remove();
    });
    m.querySelector("input").addEventListener("change", function (e) { discret = e.target.checked; });
    document.body.appendChild(m);
  }

  window._pushHomeToastCoeur = function (titre, texte, couleur, n) { afficher(n || { titre: titre || texte, texte: titre ? texte : "", couleur: couleur || "#60A5FA", cible: cibleDe(titre + " " + texte) }); };
  window.pushHomeToast = function (titre, texte, couleur) { recevoir(titre, texte, couleur); };
  window.showAchievementUnlock = function (a) {
    var c = "#F59E0B"; try { c = _achTierInfo(a.tier).color || c; } catch (e) {}
    recevoir("Trophée : " + a.name, a.desc, c, { fort: true });
  };
  window.RJNotifs = { ouvrir: ouvrir, cloche: cloche, majCloche: majCloche, vider: function () { file = []; fermer(true); }, calme: calme,
    etat: function () { return { file: file.slice(), affichee: !!enCours, historique: historique.slice(), nonLus: nonLus, discret: discret }; } };

  window._rj160Uninstall = function () { file = []; fermer(true); rjDesinscrire("160-notifications:"); };

  function boot() {
    if (typeof rjInscrire !== "function" || !Array.isArray(window.RJ_SCREEN_HOOKS) || !Array.isArray(window.RJ_SAVE_HOOKS)) return setTimeout(boot, 100);
    rjInscrire("showToast", { id: "160-notifications:showToast", remplace: function (args) { recevoir("", args[0], "#FF1801", { court: true }); } });
    window.RJ_SCREEN_HOOKS.push({ id: "160-notifications", ecran: "*", apres: function () { if (OCCUPE[ecran()]) fermer(true); if (file.length) planifier(500); } });
    window.RJ_SAVE_HOOKS.push({ cle: "rj160", ecrire: function () { return { h: historique, n: nonLus, d: discret }; },
      lire: function (b) { historique = (b && b.h) || []; nonLus = (b && b.n) || 0; discret = !!(b && b.d); file = []; derniers = {}; majCloche(); } });
    console.log(TAG, "actif — une notification à la fois, jamais pendant qu'on joue");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
