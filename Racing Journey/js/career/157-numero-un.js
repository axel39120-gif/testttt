/* =====================================================================
 * 157-numero-un.js — LE NUMÉRO 1, RÉSERVÉ AU CHAMPION DU MONDE DE F1
 *
 * RÈGLE
 *   - Le n°1 ne se choisit pas (création, casque : de 2 à 99). Il revient au
 *     seul champion du monde de Formule 1 en titre.
 *   - En début de saison, après un titre de F1, le joueur choisit : prendre
 *     le n°1 pour la saison, ou garder son numéro.
 *   - Une saison plus tard, s'il n'est plus champion, une fenêtre le
 *     prévient qu'il rend le n°1 ; il retrouve automatiquement son ancien
 *     numéro (G.pilot._numeroAvant).
 * Avant (v299), le n°1 était posé d'office — y compris au champion de F2
 * promu en F1 — et jamais retiré.
 *
 * API : window.RJNumeroUn = { verifier(), championEnTitre() }.
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[157-numero-un]";

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* La saison qui vient de se terminer : la dernière ligne close de l'historique. */
  function saisonPrecedente() {
    var H = (typeof CAREER_HISTORY !== "undefined" && Array.isArray(CAREER_HISTORY)) ? CAREER_HISTORY : [];
    var closes = H.filter(function (e) { return e && !e.current; });
    return closes[closes.length - 1] || null;
  }
  function championEnTitre() {
    var p = saisonPrecedente();
    return !!(p && p.pos === 1 && p.cat === "Formule 1" && p.saison === G.saison - 1);
  }
  function ancienNumero() {
    var n = G.pilot && G.pilot._numeroAvant;
    return typeof n === "number" && n >= 2 && n <= 99 ? n : 23;
  }
  function majAffichage() {
    try { if (typeof updateHomeNumber === "function") updateHomeNumber(); } catch (e) {}
    try { var h = document.getElementById("h-number"); if (h) h.textContent = "#" + G.pilot.number; } catch (e) {}
    try { if (typeof updateUI === "function") updateUI(); } catch (e) {}
  }

  /* La fenêtre, à la manière des événements (carte 143). */
  function fenetre(type, titre, texte, boutons) {
    var anc = document.getElementById("rj157-modal");
    if (anc) anc.remove();
    var m = document.createElement("div");
    m.id = "rj157-modal";
    m.className = "rj143-modale";
    m.style.cssText = "position:fixed;inset:0;z-index:10001;display:flex;justify-content:center;background:rgba(0,0,0,.82);backdrop-filter:blur(4px)";
    m.innerHTML = '<div class="rj143-carte" data-rj-noround="1" style="--acc:#F5C542;width:min(560px,100%)">' +
      '<div class="rj143-tete"><span class="rj143-led"></span><span class="rj143-type">' + esc(type) + "</span></div>" +
      '<div class="rj143-corps"><div class="rj143-titre">' + esc(titre) + '</div><div class="rj143-desc">' + texte + "</div></div>" +
      '<div class="rj143-choix">' + boutons.map(function (b, i) {
        return '<button class="rj143-btn ' + (b.classe || "rj143-sur") + '" data-i="' + i + '"><span class="rj143-btxt">' + esc(b.label) + "</span>" +
          (b.detail ? '<span class="rj143-effet">' + esc(b.detail) + "</span>" : "") + "</button>";
      }).join("") + "</div></div>";
    document.body.appendChild(m);
    m.addEventListener("click", function (ev) {
      var b = ev.target.closest && ev.target.closest("button[data-i]");
      if (!b) return;
      var f = boutons[+b.getAttribute("data-i")].action;
      m.remove();
      try { if (f) f(); } catch (e) { console.warn(TAG, e); }
      majAffichage();
      try { if (typeof saveGame === "function") saveGame(); } catch (e) {}
    });
  }

  function proposer() {
    var actuel = G.pilot.number || 23;
    fenetre("Champion du monde", "Le numéro 1 t'attend",
      "Champion du monde de Formule 1 en titre, tu as droit au <b>n°1</b> pour cette saison. Tu peux aussi garder ton <b>#" + actuel + "</b>.",
      [{ label: "Prendre le n°1", detail: "Le numéro du champion, pour toute la saison", classe: "rj143-ose",
         action: function () { G.pilot._numeroAvant = actuel; G.pilot.number = 1; G._numeroUnSaison = G.saison; } },
       { label: "Garder le #" + actuel, detail: "Ton numéro, ta marque",
         action: function () { G._numeroUnRefuse = G.saison; } }]);
  }

  function retirer() {
    var retour = ancienNumero();
    G.pilot.number = retour;
    delete G._numeroUnSaison;
    fenetre("Nouvelle saison", "Tu rends le numéro 1",
      "Tu n'es plus champion du monde en titre : le n°1 revient au nouveau champion. Tu retrouves ton <b>#" + retour + "</b>.",
      [{ label: "Compris" }]);
  }

  /* Décision de début de saison. Le n°1 détenu sans titre (ancienne règle, ou
     sauvegarde d'avant v300) est rendu de la même façon. */
  function decider() {
    if (typeof G === "undefined" || !G || !G.pilot) return null;
    var champion = championEnTitre();
    if (champion && G.pilot.number !== 1 && G._numeroUnRefuse !== G.saison && G._numeroUnPropose !== G.saison) return "proposer";
    if (!champion && G.pilot.number === 1) return "retirer";
    return null;
  }

  /* On attend que l'écran soit libre (pas d'autre fenêtre ouverte) pour se montrer. */
  function quandLibre(f, essais) {
    essais = essais || 0;
    var occupe = [].some.call(document.body.children, function (e) {
      return e.id !== "app" && /modal|overlay|modale/i.test(e.id + " " + e.className) && getComputedStyle(e).display !== "none";
    });
    if (occupe && essais < 60) return setTimeout(function () { quandLibre(f, essais + 1); }, 500);
    f();
  }

  function verifier() {
    var d = decider();
    if (d === "proposer") { G._numeroUnPropose = G.saison; quandLibre(proposer); }
    else if (d === "retirer") quandLibre(retirer);
    return d;
  }

  function boot() {
    if (!Array.isArray(window.RJ_SEASON_HOOKS)) return setTimeout(boot, 100);
    if (!window.RJ_SEASON_HOOKS.some(function (h) { return h && h.id === "157-numero-un"; }))
      window.RJ_SEASON_HOOKS.push({ id: "157-numero-un", apres: function () { setTimeout(verifier, 800); } });
    window.RJNumeroUn = { verifier: verifier, decider: decider, championEnTitre: championEnTitre };
    console.log(TAG, "actif — le n°1 au seul champion du monde de F1");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
