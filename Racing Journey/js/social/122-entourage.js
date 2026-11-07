/* =====================================================================
 * 122-entourage.js — L'ENTOURAGE : DES PERSONNES, PAS UN RÉPERTOIRE
 *
 * POURQUOI
 * L'onglet Réseau listait des noms et une jauge. On ne savait ni qui était
 * qui, ni ce qu'il pensait de vous, ni pourquoi.
 *
 * CE QUE FAIT LE MODULE
 * Remplace le rendu de l'onglet (renderReseau, Contrats › Réseau) :
 *  - les personnes groupées par cercle : votre écurie, agent et
 *    partenaires, presse, grille, autres ;
 *  - une carte par personne : rôle, relation, humeur ;
 *  - toucher une carte ouvre sa fiche : ce qu'elle peut pour vous, son
 *    trait de caractère, ce qu'elle retient de vous, et deux actions
 *    (prendre des nouvelles, demander conseil) qui coûtent un PA.
 * Les données et la logique (traits, humeur, mémoire) sont dans
 * 101-reseau.js ; ce module n'est que l'écran.
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[122-entourage]";
  var R = function () { return window._rj101; };
  var ouverte = null;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function initiales(n) { return String(n || "?").split(/\s+/).map(function (m) { return m.charAt(0); }).join("").slice(0, 2).toUpperCase(); }
  /* Le portrait du contact (128), à défaut ses initiales. */
  function visage(c, t) { return window.RJAvatar ? window.RJAvatar.html(window.RJAvatar.contact(c), t) : esc(initiales(c.name)); }
  function couleurRel(r) { return r >= 70 ? "var(--green, #4ADE80)" : r >= 45 ? "#F59E0B" : "#EF4444"; }
  function semaine() { return (G.saison || 1) * 100 + (G.semaine || 1); }

  var CERCLES = [
    { id: "ecurie", lbl: "Ton écurie",           test: function (c) { return c.team && c.team === G.currentTeam && c.role !== "pilote"; } },
    { id: "proches", lbl: "Agent et partenaires", test: function (c) { return c.role === "agent" || c.role === "sponsor"; } },
    { id: "presse", lbl: "Presse",                test: function (c) { return c.role === "journaliste"; } },
    { id: "grille", lbl: "La grille",             test: function (c) { return c.role === "pilote"; } },
    { id: "autres", lbl: "Le paddock",            test: function () { return true; } }
  ];

  function carte(c, cle) {
    var h = R().humeur(c), rel = Math.round(c.relation || 0);
    return '<button type="button" class="rj122-carte" data-cle="' + esc(cle) + '" style="--teinte:' + esc(c.color || "#60A5FA") + '">' +
      '<span class="rj122-avatar">' + visage(c, 36) + "</span>" +
      '<span class="rj122-id"><b>' + esc(c.name) + "</b><small>" + esc(c.roleLabel || R().role(c.role).lbl) + (c.team ? " · " + esc(c.team) : "") + "</small></span>" +
      '<span class="rj122-humeur rj122-h-' + h.c + '">' + h.lbl + "</span>" +
      '<span class="rj122-rel"><span class="rj122-piste" style="--rel:' + rel + "%;--coul:" + couleurRel(rel) + '"></span><em>' + rel + "</em></span></button>";
  }

  function rendre() {
    var el = document.getElementById("reseau-content");
    if (!el || !R()) return;
    try { if (R().contactDuMail) R().contactDuMail({ role: "agent" }); } catch (e) {}
    var net = G._network || {}, cles = Object.keys(net), pris = {}, html = "";
    var allies = cles.filter(function (k) { return (net[k].relation || 0) >= 70; }).length;
    html += '<div class="rj122-entete"><div><b>' + cles.length + "</b><small>Personnes</small></div><div><b>" + allies +
      "</b><small>Alliés</small></div><div><b>" + (G.pa || 0) + "</b><small>PA cette semaine</small></div></div>";
    if (!cles.length) html += '<div class="rj122-vide">Personne encore. Les courses, la presse et ton écurie te feront rencontrer du monde.</div>';
    CERCLES.forEach(function (cercle) {
      var gens = cles.filter(function (k) { return !pris[k] && cercle.test(net[k]); })
        .sort(function (a, b) { return (net[b].relation || 0) - (net[a].relation || 0); });
      if (!gens.length) return;
      gens.forEach(function (k) { pris[k] = 1; });
      html += '<div class="rj122-groupe"><div class="rj122-groupe-titre">' + cercle.lbl + " <span>" + gens.length + "</span></div>" +
        '<div class="rj122-cartes">' + gens.map(function (k) { return carte(net[k], k); }).join("") + "</div></div>";
    });
    el.innerHTML = html;
  }

  /* ---------------------------------------------------------------- fiche */
  function fiche(cle) {
    var c = G._network && G._network[cle];
    if (!c) return;
    if (ouverte) { ouverte.remove(); ouverte = null; }   // on rouvre : pas d'animation de sortie, une seule fiche
    var r = R(), t = r.trait(c), h = r.humeur(c), rel = Math.round(c.relation || 0), dejaVu = c._rj122Vu === semaine();
    var souvenirs = (c.memoire || []).map(function (m) {
      return '<li class="' + (m.d > 0 ? "plus" : m.d < 0 ? "moins" : "") + '"><span>S' + m.s + " · sem. " + m.w + "</span>" + esc(m.t) + "</li>";
    }).join("") || '<li class="rien">Rien de marquant entre vous pour l\'instant.</li>';
    /* Écrire à quelqu'un passe par la messagerie (124), si elle est là. */
    var m124 = window._rj124, attend = m124 && m124.enAttente(cle);
    var voile = document.createElement("div");
    voile.className = "rj122-voile";
    voile.innerHTML = '<div class="rj122-fiche" role="dialog" aria-modal="true" data-cle="' + esc(cle) + '" style="--teinte:' + esc(c.color || "#60A5FA") + '">' +
      '<div class="rj122-fiche-tete"><span class="rj122-avatar">' + visage(c, 46) + "</span><div><b>" + esc(c.name) + "</b><small>" +
      esc(c.roleLabel || r.role(c.role).lbl) + (c.team ? " · " + esc(c.team) : "") + '</small></div><button type="button" class="rj122-x" data-act="fermer" aria-label="Fermer">×</button></div>' +
      '<div class="rj122-ligne"><span>Relation</span><span class="rj122-rel"><span class="rj122-piste" style="--rel:' + rel + "%;--coul:" + couleurRel(rel) + '"></span><em>' + rel + "</em></span>" +
      '<span class="rj122-humeur rj122-h-' + h.c + '">' + h.lbl + "</span></div>" +
      '<div class="rj122-peut">' + esc(r.role(c.role).peut) + "</div>" +
      '<div class="rj122-trait"><b>' + t.lbl + "</b> — " + esc(t.desc) + "</div>" +
      '<div class="rj122-sous">Ce qu\'il retient de toi</div><ul class="rj122-memoire">' + souvenirs + "</ul>" +
      '<div class="rj122-actions">' +
      '<button type="button" data-act="nouvelles"' + (dejaVu || (G.pa || 0) < 1 ? " disabled" : "") + ">Prendre des nouvelles <small>1 PA</small></button>" +
      '<button type="button" data-act="conseil"' + (dejaVu || rel < 60 || (G.pa || 0) < 1 ? " disabled" : "") + ">Demander conseil <small>1 PA · relation 60+</small></button>" +
      (m124 ? '<button type="button" data-act="ecrire"' + (attend ? " disabled" : "") + ">Écrire <small>gratuit · réponse la semaine suivante</small></button>" : "") +
      "</div>" + (dejaVu ? '<div class="rj122-note">Vous vous êtes déjà parlé cette semaine.</div>' : "") +
      (attend ? '<div class="rj122-note">Tu lui as écrit : réponse attendue la semaine prochaine.</div>' : "") + "</div>";
    var ouvertA = Date.now();
    voile.addEventListener("click", function (e) {
      if (Date.now() - ouvertA < 300) return;
      var su = e.target.closest && e.target.closest("[data-sujet]");
      if (su) { window._rj124.ecrire(cle, su.getAttribute("data-sujet")); fiche(cle); return; }
      var b = e.target.closest && e.target.closest("[data-act]");
      if (b && !b.disabled && b.getAttribute("data-act") === "ecrire") { sujetsEcrire(voile, cle); return; }
      if (b && !b.disabled) agir(cle, b.getAttribute("data-act"));
      else if (e.target === voile) fermer();
    });
    document.body.appendChild(voile);
    ouverte = voile;
    requestAnimationFrame(function () { voile.classList.add("on"); });
  }

  /* Les sujets dont on peut parler à cette personne, à la place des actions. */
  function sujetsEcrire(voile, cle) {
    var zone = voile.querySelector(".rj122-actions");
    if (!zone) return;
    zone.innerHTML = window._rj124.sujets(G._network[cle]).map(function (s) {
      return '<button type="button" data-sujet="' + esc(s.id) + '">' + esc(s.lbl) + "</button>";
    }).join("");
  }

  function fermer() {
    if (!ouverte) return;
    var o = ouverte; ouverte = null;
    o.classList.remove("on");
    setTimeout(function () { o.remove(); }, 160);
  }

  /* Un conseil, selon ce que la personne sait. */
  var CONSEILS = {
    tp: "« Montre-toi régulier, c'est ce que je regarde en fin de saison. »",
    dir_sport: "« Le marché bouge : garde un œil sur les écuries qui changent de pilote. »",
    dir_tech: "« La voiture de l'an prochain partira d'une nouvelle base, sois patient. »",
    ing_course: "« Fais confiance aux réglages de base en qualif, on affinera en course. »",
    agent: "« Ta valeur monte après chaque podium : c'est le moment de négocier. »",
    journaliste: "« Un ton mesuré en conférence te fera de meilleurs titres. »",
    sponsor: "« Nous suivons les pilotes qui gagnent en visibilité, pas seulement en points. »",
    pilote: "« En piste, je laisse de la place à ceux qui m'en laissent. »",
    contact: "« Tout le monde se connaît ici : soigne ta réputation. »"
  };

  function agir(cle, act) {
    if (act === "fermer") { fermer(); return; }
    var c = G._network[cle], r = R();
    if (!c || (G.pa || 0) < 1 || c._rj122Vu === semaine()) return;
    G.pa -= 1;
    c._rj122Vu = semaine();
    c.interactions = (c.interactions || 0) + 1;
    if (act === "nouvelles") {
      r.bouger(c, 3, "Tu as pris de ses nouvelles");
      if (typeof showToast === "function") showToast(c.name + " apprécie ton appel");
    } else if (act === "conseil") {
      r.bouger(c, 1, "Tu lui as demandé conseil");
      if (typeof showToast === "function") showToast(c.name + " : " + (CONSEILS[c.role] || CONSEILS.contact));
    }
    try { if (typeof updateHUD === "function") updateHUD(); } catch (e) {}
    rendre();
    fiche(cle);
  }

  function surClic(e) {
    var b = e.target.closest && e.target.closest(".rj122-carte[data-cle]");
    if (b) fiche(b.getAttribute("data-cle"));
  }

  function installer() {
    if (typeof rjInscrire !== "function" || !window._rj101) return false;
    rjInscrire("renderReseau", { id: "122-entourage:renderReseau", ordre: -2900, remplace: function () { rendre(); } });
    document.addEventListener("click", surClic);
    return true;
  }

  /* 101 s'installe au chargement de la page, parfois après quelques essais. */
  var essais = 0;
  function boot() {
    if (installer()) { console.log(TAG, "actif — l'onglet Réseau devient l'Entourage"); return; }
    if (essais++ < 80) setTimeout(boot, 150); else console.warn(TAG, "réseau (101) absent : écran non installé");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  window.RJEntourage = { rendre: rendre, fiche: fiche, fermer: fermer };
  window._rj122Uninstall = function () {
    fermer();
    rjDesinscrire(["122-entourage:"], "renderReseau");
    document.removeEventListener("click", surClic);
    delete window.RJEntourage;
  };
})();
