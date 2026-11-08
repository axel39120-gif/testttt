/* =====================================================================
 * 129-sections-vides.js — UN TITRE N'EST JAMAIS SUIVI DE RIEN
 *
 * POURQUOI
 * Un sous-titre sans rien dessous (« Palmarès » d'une carrière qui
 * commence, « Rivalités » avant les premiers duels…) ressemblait à un écran
 * cassé.
 *
 * CE QUE FAIT LE MODULE
 * Sur l'écran affiché, chaque titre de section dont la section est vide
 * reçoit une courte phrase d'attente, propre au sujet quand on la connaît.
 * Elle disparaît dès que la section a du contenu. Rien n'est écrit dans les
 * modules qui dessinent ces sections : on observe l'écran.
 *
 * Réversible : window._rj129Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TITRES = ".t-sec, .apex-sec, .sec-lbl, .rj114-titre, .rjf-kicker, .rj122-groupe-titre, .rj123-sous, .rj125-titre";
  var PHRASES = [
    [/palmar/i, "Aucun titre pour l'instant : ton palmarès s'écrira au fil des saisons."],
    [/rivalit/i, "Pas de rivalité pour l'instant : elles naîtront des duels en piste."],
    [/décision/i, "Aucune décision marquante pour l'instant."],
    [/troph|accompli/i, "Aucun trophée pour l'instant."],
    [/sponsor|contrat/i, "Rien de signé pour l'instant."],
    [/offre/i, "Aucune offre pour l'instant."],
    [/message|conversation/i, "Aucun message pour l'instant."],
    [/historique|saison/i, "Rien d'enregistré pour l'instant."],
    [/revue|presse|déclaration/i, "Rien dans la presse pour l'instant."]
  ];
  function phrase(titre) {
    for (var i = 0; i < PHRASES.length; i++) if (PHRASES[i][0].test(titre)) return PHRASES[i][1];
    return "Rien à afficher pour l'instant.";
  }

  /* Une section : les éléments qui suivent le titre jusqu'au titre suivant.
     Un titre seul dans son enveloppe a son contenu dans le bloc d'après. */
  function premierApres(t) {
    var n = t.nextElementSibling;
    while (n && n.classList.contains("rj-vide")) n = n.nextElementSibling;
    return n || (t.parentElement && t.parentElement.nextElementSibling);
  }
  function estVide(t) {
    var h = 0, texte = "", n = premierApres(t);
    /* on s'arrête au titre suivant, ou au bloc qui l'enveloppe (sauf le tout premier) */
    for (var k = 0; n && !n.matches(TITRES) && !(k++ && n.querySelector(TITRES)); ) {
      if (!n.classList.contains("rj-vide") && n.offsetParent) { h += n.getBoundingClientRect().height; texte += (n.textContent || "").trim(); }
      n = n.nextElementSibling;
    }
    return h < 10 && texte.length < 3;
  }

  function passer() {
    var ecran = document.querySelector(".scr.on");
    if (!ecran) return;
    ecran.querySelectorAll(TITRES).forEach(function (t) {
      if (!t.offsetParent) return;
      var suivant = t.nextElementSibling, deja = suivant && suivant.classList.contains("rj-vide");
      var vide = estVide(t);
      if (vide && !deja) {
        var d = document.createElement("div");
        d.className = "rj-vide";
        d.textContent = phrase(t.textContent || "");
        t.parentNode.insertBefore(d, t.nextSibling);
      } else if (!vide && deja) suivant.remove();
    });
  }

  var minuteur = null;
  function plusTard() { clearTimeout(minuteur); minuteur = setTimeout(function () { try { passer(); } catch (e) {} }, 120); }
  var obs = new MutationObserver(function (muts) {
    /* nos propres insertions ne relancent pas la passe */
    for (var i = 0; i < muts.length; i++) {
      var m = muts[i], nos = [].slice.call(m.addedNodes).concat([].slice.call(m.removedNodes)).every(function (x) { return x.classList && x.classList.contains("rj-vide"); });
      if (!nos) { plusTard(); return; }
    }
  });
  function demarrer() { obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] }); plusTard(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", demarrer); else demarrer();

  window.RJSectionsVides = { passer: passer };
  window._rj129Uninstall = function () { obs.disconnect(); document.querySelectorAll(".rj-vide").forEach(function (d) { d.remove(); }); delete window.RJSectionsVides; };
})();
