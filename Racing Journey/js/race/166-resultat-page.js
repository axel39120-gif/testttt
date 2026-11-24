/* =====================================================================
 * 166-resultat-page.js — LE RÉSULTAT SUR UNE SEULE PAGE
 *
 * POURQUOI
 * Classement, incidents, moral, voiture, championnat s'empilaient : il
 * fallait descendre 770 px pour trouver le bouton de sortie.
 *
 * CE QUE FAIT LE MODULE
 * À l'écran : le bandeau (147), le podium, une rangée de boutons et la
 * suite du week-end. Tout le reste est rangé dans une réserve cachée et
 * s'ouvre en fenêtre, d'un appui. Les blocs sont déplacés, pas recopiés :
 * les modules qui les complètent continuent de les trouver.
 * Réversible : window._rj166Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var obs = null, timer = 0, ouverte = null;
  var GARDE = { rj147: 1, "rj56-podium": 1, "rj166-reserve": 1, "rj166-boutons": 1 };
  /* Du plus précis au plus large : le début du bloc dit ce qu'il est. */
  var RUBRIQUES = [
    ["classement", "Classement", /^\s*classement/i], ["incidents", "Incidents", /^\s*(incident|faits)/i],
    ["moral", "Mental et confiance", /^\W*(mental|confiance|momentum)|momentum/i], ["tour", "Meilleur tour", /^\W*meilleur tour/i],
    ["championnat", "Championnat", /championnat/i], ["voiture", "Voiture", /voiture|aéro|évolution|fiabilité|performance/i]
  ];
  function rubrique(e) {
    if (/^\s*(P\d|course sprint|abandon)/i.test((e.innerText || e.textContent || "").trim()) || e.querySelector(".badge")) return "resume";
    var t = (e.textContent || "").trim().slice(0, 200);
    for (var i = 0; i < RUBRIQUES.length; i++) if (RUBRIQUES[i][2].test(t)) return RUBRIQUES[i][0];
    return "resume";
  }
  function nom(k) { var r = RUBRIQUES.filter(function (x) { return x[0] === k; })[0]; return r ? r[1] : "Récit de course"; }

  function ranger() {
    timer = 0;
    var c = document.getElementById("res-content");
    if (!c || !c.children.length) return;
    var enfants = [].slice.call(c.children);
    if (!enfants.some(function (e) { return !GARDE[e.id]; })) return;
    var res = document.getElementById("rj166-reserve"), rangee = document.getElementById("rj166-boutons");
    if (!res) { if (ouverte) { ouverte.v.remove(); ouverte = null; } res = document.createElement("div"); res.id = "rj166-reserve"; }
    if (!rangee) { rangee = document.createElement("div"); rangee.id = "rj166-boutons"; }
    c.classList.add("rj166");
    var sorties = [];
    enfants.forEach(function (e) {
      if (GARDE[e.id]) return;
      if (e.tagName === "BUTTON") { sorties.push(e); return; }
      var k = rubrique(e), b = res.querySelector('[data-k="' + k + '"]');
      if (!b) { b = document.createElement("div"); b.setAttribute("data-k", k); res.appendChild(b); }
      b.appendChild(e);
    });
    c.appendChild(res);
    c.appendChild(rangee);
    [].forEach.call(rangee.querySelectorAll("[data-ouvre]"), function (b) { b.remove(); });
    var frag = document.createDocumentFragment();
    RUBRIQUES.map(function (x) { return x[0]; }).concat("resume").forEach(function (k) {
      if (!res.querySelector('[data-k="' + k + '"]')) return;
      var b = document.createElement("button"); b.type = "button"; b.setAttribute("data-ouvre", k); b.textContent = nom(k); frag.appendChild(b);
    });
    rangee.insertBefore(frag, rangee.firstChild);
    sorties.forEach(function (e) {
      var principal = /btn-prim/.test(e.className);
      e.className = principal ? "rj166-suite" : "rj166-autre"; e.removeAttribute("style");
      if (!principal && e.children.length) e.textContent = "Revoir la course";      // « Récap visuel », en carte
      rangee.appendChild(e);
    });
  }

  function ouvrir(k) {
    fermer();
    var bloc = document.querySelector('#rj166-reserve [data-k="' + k + '"]'); if (!bloc) return;
    var v = document.createElement("div"); v.className = "rj166-voile"; v.id = "rj166-fenetre"; v.setAttribute("data-rj-noround", "1");
    v.innerHTML = '<div class="rj166-carte"><div class="rj166-tete"><b>' + nom(k) + '</b><button type="button" class="rj166-x" aria-label="Fermer">×</button></div><div class="rj166-corps"></div></div>';
    v.querySelector(".rj166-corps").appendChild(bloc);
    if (k === "incidents") [].forEach.call(bloc.querySelectorAll("div"), function (x) { if (x.style.display === "none") x.style.display = ""; });   // repliés par 40
    v.addEventListener("click", function (e) { if (e.target === v || e.target.closest(".rj166-x")) fermer(); });
    document.body.appendChild(v);
    ouverte = { v: v, bloc: bloc };
  }
  function fermer() {
    if (!ouverte) return;
    var r = document.getElementById("rj166-reserve"); if (r) r.appendChild(ouverte.bloc);
    ouverte.v.remove(); ouverte = null;
  }
  function surClic(e) { var b = e.target.closest && e.target.closest("[data-ouvre]"); if (b) ouvrir(b.getAttribute("data-ouvre")); }
  function plusTard() { if (!timer) timer = setTimeout(ranger, 0); }

  function boot() {
    var c = document.getElementById("res-content");
    if (!c || !Array.isArray(window.RJ_SCREEN_HOOKS)) return setTimeout(boot, 150);
    obs = new MutationObserver(plusTard); obs.observe(c, { childList: true });
    document.addEventListener("click", surClic);
    window.RJ_SCREEN_HOOKS.push({ id: "166-resultat", ecran: "*", avant: fermer });
    window._rj166Uninstall = function () {
      obs.disconnect(); document.removeEventListener("click", surClic); fermer();
      window.RJ_SCREEN_HOOKS = window.RJ_SCREEN_HOOKS.filter(function (h) { return !h || h.id !== "166-resultat"; });
    };
    plusTard();
    console.log("[166-resultat] actif — le résultat sur une page");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
