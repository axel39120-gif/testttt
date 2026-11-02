/* =====================================================================
 * 118-accueil.js — UN ACCUEIL QUI DIT OÙ ALLER ET CE QUI T'ATTEND
 *
 * POURQUOI
 * L'accueil montrait neuf grosses tuiles muettes (une icône, un mot) et
 * aucune action principale visible : la carte « Prochaine course » était
 * cliquable sans le dire.
 *
 * CE QUE FAIT LE MODULE
 *   - un bouton dans la carte de la prochaine course, au libellé et à la
 *     couleur de l'étape suivante (ceux du bouton Jouer du rail, module 105) ;
 *   - sous chaque tuile, l'information utile : séances d'entraînement
 *     restantes, contrat, sponsors, budget, bonheur, messages non lus…
 * Mise à jour : après updateUI et à l'ouverture de l'accueil. Style :
 * css/paysage.css (section Accueil).
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[118-accueil]";

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function pluriel(n, mot) { return n + " " + mot + (n > 1 ? "s" : ""); }
  function argent(n) { return (typeof _fmtCompactNum === "function" && Math.abs(n) >= 1000 ? _fmtCompactNum(Math.round(n)) : Math.round(n || 0)) + " €"; }

  /* Ce qu'on lit sous chaque tuile, d'après sa destination. */
  var INFOS = {
    "S-pilot": function () {
      var n = typeof calcPlayerRating === "function" ? calcPlayerRating() : null;
      return n === null ? "" : "Note " + n + (typeof getRatingTier === "function" ? " · " + getRatingTier(n).tier : "");
    },
    "S-training": function () { return G.pa > 0 ? pluriel(G.pa, "séance") + " à jouer" : "Aucune séance cette semaine"; },
    "S-media": function () { return "Réputation " + (G.reputation || 0); },
    "S-contracts": function () {
      var sem = G.contractWeeksLeft || 0;
      return (G.currentTeam || "Sans écurie") + (sem ? " · " + (sem >= 5 ? Math.round(sem / 4.33) + " mois" : sem + " sem.") : "");
    },
    "S-sponsors": function () { var n = Array.isArray(G.sponsors) ? G.sponsors.length : 0; return n ? pluriel(n, "contrat") + " actif" + (n > 1 ? "s" : "") : "Aucun sponsor"; },
    "S-patrimoine": function () { return "Budget " + argent(G.budget); },
    "S-mailbox": function (tuile) {
      var b = tuile.querySelector(".apex-action-badge"), n = b && b.style.display !== "none" ? parseInt(b.textContent, 10) || 0 : 0;
      return n ? pluriel(n, "non lu") : "Rien de nouveau";
    },
    "S-lifestyle": function () { return "Bonheur " + Math.round(G.happiness || 0) + " / 100"; },
    "save": function () { return "Semaine " + (G.semaine || 1) + ", saison " + (G.saison || 1); }
  };

  function cible(tuile) {
    var m = (tuile.getAttribute("onclick") || "").match(/'(S-[\w-]+)'/);
    return m ? m[1] : /showSaveMenu/.test(tuile.getAttribute("onclick") || "") ? "save" : null;
  }

  function majTuiles() {
    document.querySelectorAll("#S-home .apex-action-tile").forEach(function (t) {
      var f = INFOS[cible(t)];
      if (!f) return;
      var info = t.querySelector(".rj118-info");
      if (!info) { info = document.createElement("div"); info.className = "rj118-info"; t.appendChild(info); }
      var texte = "";
      try { texte = f(t) || ""; } catch (e) {}
      info.textContent = texte;
    });
  }

  /* Le bouton de la carte : même étape, même couleur que Jouer (105). */
  function majBouton() {
    var carte = document.querySelector("#S-home .apex-hero-race"), jouer = document.getElementById("ni-cta-continue");
    if (!carte) return;
    var b = carte.querySelector(".rj118-cta");
    if (!b) { b = document.createElement("div"); b.className = "rj118-cta"; b.setAttribute("role", "button"); carte.appendChild(b); }
    var lbl = (jouer && (jouer.getAttribute("data-rj105") || jouer.getAttribute("title"))) || "Continuer";
    b.textContent = lbl;
    var c = jouer && jouer.style.getPropertyValue("--rj105-c");
    if (c) carte.style.setProperty("--rj118-c", c);
  }

  function maj() {
    if (typeof G === "undefined" || !G || !G.pilot) return;
    try { majBouton(); majTuiles(); } catch (e) { console.warn(TAG, e && e.message); }
  }

  function boot() {
    if (typeof rjInscrire !== "function" || typeof updateUI !== "function" || !Array.isArray(window.RJ_SCREEN_HOOKS)) return setTimeout(boot, 100);
    rjInscrire("updateUI", { id: "118-accueil:updateUI", apres: function () { setTimeout(maj, 0); } });   // après le teint de 105
    if (!window.RJ_SCREEN_HOOKS.some(function (h) { return h && h.id === "118-accueil"; }))
      window.RJ_SCREEN_HOOKS.push({ id: "118-accueil", ecran: "S-home", apres: maj });
    maj();
    window._rj118Uninstall = function () {
      rjDesinscrire(["118-accueil:"], "updateUI");
      window.RJ_SCREEN_HOOKS = window.RJ_SCREEN_HOOKS.filter(function (h) { return !(h && h.id === "118-accueil"); });
      document.querySelectorAll(".rj118-cta, .rj118-info").forEach(function (e) { e.remove(); });
    };
    console.log(TAG, "actif — bouton de l'étape suivante et infos sous les tuiles");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
