/* =====================================================================
 * 121-selecteurs.js — DES CHOIX D'APPLICATION, PAS DES LISTES DE SITE
 *
 * POURQUOI
 * Les listes déroulantes (<select>) ouvraient le sélecteur du navigateur :
 * l'allure d'un formulaire de site web au milieu d'un jeu.
 *
 * CE QUE FAIT LE MODULE
 * Toucher une liste ouvre un panneau de choix qui glisse du bas, aux
 * couleurs du jeu : un titre, les options en lignes larges, une coche sur
 * le choix courant. La liste d'origine reste en place (cachée sous son
 * habillage, css/paysage.css) : sa valeur change et l'événement « change »
 * part comme avant, donc les onchange existants fonctionnent sans retouche.
 * Aucune liste n'est réécrite à l'avance : le module intercepte le toucher,
 * il couvre aussi celles que les écrans créent plus tard.
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[121-selecteurs]";
  var ouvert = null;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* Le titre du panneau : l'étiquette de la liste, sinon son libellé voisin. */
  function titre(sel) {
    if (sel.getAttribute("aria-label")) return sel.getAttribute("aria-label");
    if (sel.id) {
      var l = document.querySelector('label[for="' + sel.id + '"]');
      if (l) return l.textContent.trim();
    }
    var candidats = [sel.previousElementSibling, sel.parentElement && sel.parentElement.previousElementSibling];
    for (var i = 0; i < candidats.length; i++) {
      var t = candidats[i] && candidats[i].tagName !== "SELECT" && candidats[i].textContent.trim();
      if (t && t.length < 40) return t;
    }
    return "Choisir";
  }

  function fermer() {
    if (!ouvert) return;
    var o = ouvert; ouvert = null;
    o.classList.remove("on");
    setTimeout(function () { o.remove(); }, 180);
  }

  function ouvrir(sel) {
    fermer();
    var voile = document.createElement("div");
    voile.className = "rj121-voile";
    var options = [].slice.call(sel.options);
    voile.innerHTML = '<div class="rj121-feuille" role="dialog" aria-modal="true" aria-label="' + esc(titre(sel)) + '">' +
      '<div class="rj121-poignee"></div><div class="rj121-titre">' + esc(titre(sel)) + "</div>" +
      '<div class="rj121-liste" role="listbox">' + options.map(function (o, i) {
        return '<button type="button" role="option" data-i="' + i + '"' + (o.disabled ? " disabled" : "") +
          ' class="' + (i === sel.selectedIndex ? "on" : "") + '" aria-selected="' + (i === sel.selectedIndex) + '">' +
          "<span>" + esc(o.textContent) + "</span><i></i></button>";
      }).join("") + "</div></div>";
    var ouvertA = Date.now();
    voile.addEventListener("click", function (e) {
      // Le clic qui suit le toucher d'ouverture retombe sur le voile tout juste
      // posé : on l'ignore, sinon le panneau se refermerait aussitôt.
      if (Date.now() - ouvertA < 400) return;
      var b = e.target.closest && e.target.closest("[data-i]");
      if (b && !b.disabled) {
        var i = +b.getAttribute("data-i");
        if (i !== sel.selectedIndex) {
          sel.selectedIndex = i;
          sel.dispatchEvent(new Event("input", { bubbles: true }));
          sel.dispatchEvent(new Event("change", { bubbles: true }));
        }
        fermer();
      } else if (e.target === voile) fermer();
    });
    document.body.appendChild(voile);
    ouvert = voile;
    requestAnimationFrame(function () {
      voile.classList.add("on");
      var choisi = voile.querySelector(".rj121-liste .on");
      if (choisi) choisi.scrollIntoView({ block: "center" });
    });
  }

  function cible(e) {
    var s = e.target && e.target.closest && e.target.closest("select");
    return s && !s.disabled && !s.multiple ? s : null;
  }

  /* Le navigateur ouvre sa liste au pointeur (ordinateur, Android) ou au
     focus (iPhone) : on intercepte les deux, et le clavier. */
  function surPointeur(e) { var s = cible(e); if (!s) return; e.preventDefault(); ouvrir(s); }
  function surFocus(e) { var s = cible(e); if (!s || ouvert) return; s.blur(); ouvrir(s); }
  function surClavier(e) {
    if (e.key === "Escape" && ouvert) { fermer(); return; }
    var s = cible(e);
    if (s && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) { e.preventDefault(); ouvrir(s); }
  }

  document.addEventListener("pointerdown", surPointeur, true);
  document.addEventListener("focusin", surFocus, true);
  document.addEventListener("keydown", surClavier, true);
  window.RJSelecteurs = { ouvrir: ouvrir, fermer: fermer };
  window._rj121Uninstall = function () {
    fermer();
    document.removeEventListener("pointerdown", surPointeur, true);
    document.removeEventListener("focusin", surFocus, true);
    document.removeEventListener("keydown", surClavier, true);
    delete window.RJSelecteurs;
  };
  console.log(TAG, "actif — listes ouvertes en panneau de choix");
})();
