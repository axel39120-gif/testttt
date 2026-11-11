/* =====================================================================
 * 140-creation-compacte.js — LA CRÉATION DU PILOTE SANS DÉFILER
 *
 * POURQUOI
 * Sur un téléphone tenu à l'horizontale (environ 390 px de haut), chaque
 * étape de la création défilait : jusqu'à 1 000 px pour atteindre le
 * bouton « Continuer » de la première. Champs empilés, grandes tuiles,
 * phrases d'introduction qui répétaient le nom de l'étape.
 *
 * CE QUE FAIT LE MODULE (une seule colonne centrée, plus dense)
 *   - Retour et Continuer dans une barre fixe en bas, toujours visible,
 *     avec le message d'erreur entre les deux ; même chose pour le choix
 *     du mode de jeu.
 *   - La progression et le rappel du mode passent dans le bandeau.
 *   - Les champs qui vont ensemble partagent une ligne : prénom et nom,
 *     date de naissance et année de début, ville et âge calculé.
 *   - Les phrases d'introduction qui doublent le nom de l'étape sont
 *     masquées ; les grilles de choix sont resserrées (css/creation.css).
 *
 * Aucun état : uniquement la disposition. Réversible : window._rj140Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[140-creation-compacte]";
  function $(id) { return document.getElementById(id); }

  /* Une ligne de champs : chaque paire libellé + champ devient une cellule. */
  function rangee(hote, avant, cellules, classe) {
    if (!hote || hote.querySelector("." + classe)) return;
    var r = document.createElement("div");
    r.className = "rj140-rangee " + classe;
    hote.insertBefore(r, avant);
    cellules.forEach(function (elems) {
      var c = document.createElement("div");
      c.className = "rj140-cellule";
      elems.forEach(function (e) { if (e) c.appendChild(e); });
      r.appendChild(c);
    });
  }
  function libelleDe(champ) {
    var p = champ && champ.previousElementSibling;
    return p && p.classList.contains("inp-label") ? p : null;
  }

  function identite() {
    var fn = $("p-fn"), ln = $("p-ln"), cs1 = $("cs1");
    if (!fn || !ln || !cs1) return;
    var lfn = libelleDe(fn), lln = libelleDe(ln), suite = ln.nextSibling;
    rangee(cs1, suite, [[lfn, fn], [lln, ln]], "rj140-noms");
  }

  function origines() {
    var cs2 = $("cs2"), jour = $("p-dob-day"), debut = $("p-startyear"), ville = $("p-birthcity"), age = $("cs2-age-preview");
    if (!cs2 || !jour || !debut || !ville || cs2.querySelector(".rj140-dates")) return;
    var grilleDate = jour.parentNode.parentNode, lDate = grilleDate.previousElementSibling;
    var boiteDebut = debut.parentNode, lDebut = boiteDebut.previousElementSibling, aide = boiteDebut.nextElementSibling;
    var lVille = libelleDe(ville);
    rangee(cs2, lDate, [[lDate, grilleDate], [lDebut, boiteDebut]], "rj140-dates");
    var apres = cs2.querySelector(".rj140-dates").nextSibling;
    rangee(cs2, apres, [[lVille, ville], [age]], "rj140-ville");
    if (aide && !aide.id && /calculé automatiquement/.test(aide.textContent)) aide.classList.add("rj140-cache");
    if (age) age.classList.add("rj140-age");
  }

  /* Le numéro rejoint l'aperçu du visage (128), dans la colonne de gauche :
     l'étape tient sur un écran. */
  function numero() {
    var num = $("p-num"), apercu = $("num-preview"), gauche = document.querySelector("#rja-creation .rja-ed-grand");
    if (!num || !apercu) return;
    var boite = num.parentNode;
    if (!boite.classList.contains("rj140-num")) {
      boite.classList.add("rj140-num");
      boite.insertBefore(apercu, boite.firstChild);
    }
    if (gauche && boite.parentNode !== gauche) gauche.appendChild(boite);
  }

  /* L'écurie de cœur (80) est facultative : une ligne qui se déplie. */
  function ecurieDeCoeur() {
    var bloc = $("rj80-fav"); if (!bloc) return;
    var titre = bloc.firstElementChild;
    if (!bloc.classList.contains("rj140-pli")) {
      bloc.classList.add("rj140-pli");
      titre.setAttribute("role", "button");
      titre.addEventListener("click", function () { bloc.classList.toggle("ouvert"); });
      bloc.addEventListener("click", function (ev) {
        if (ev.target.closest && ev.target.closest(".rj80-fav-opt")) setTimeout(function () { bloc.classList.remove("ouvert"); resume(); }, 30);
      });
    }
    resume();
    function resume() {
      var on = bloc.querySelector(".rj80-fav-opt.on"), r = titre.querySelector(".rj140-choix");
      if (!r) { r = document.createElement("span"); r.className = "rj140-choix"; titre.appendChild(r); }
      r.textContent = on && on.getAttribute("data-team") ? on.textContent.trim() : "Aucune préférence";
    }
  }

  /* Les phrases d'introduction des étapes répètent le nom de l'étape (80). */
  function introductions() {
    for (var n = 2; n <= 6; n++) {
      var cs = $("cs" + n); if (!cs) continue;
      var d = cs.firstElementChild;
      if (d && d.tagName === "DIV" && !d.id && !d.children.length && /font-size:\s*15px/.test(d.getAttribute("style") || "")) d.classList.add("rj140-cache");
    }
  }

  /* Le bandeau accueille la progression et le rappel du mode. */
  function bandeau() {
    var hdr = document.querySelector("#S-create > .apex-create-hdr"), prog = $("step-prog"), ban = $("rj80-banner");
    if (!hdr) return;
    var droite = hdr.querySelector(".rj140-droite");
    if (!droite) { droite = document.createElement("div"); droite.className = "rj140-droite"; hdr.appendChild(droite); }
    if (prog && prog.parentNode !== droite) droite.appendChild(prog);
    if (ban && ban.parentNode !== droite) droite.appendChild(ban);
    /* le nom de l'étape (80) ouvre le contenu */
    var nom = $("rj80-stepname"), corps = document.querySelector("#S-create .apex-create-body");
    if (nom && corps && corps.firstElementChild !== nom) corps.insertBefore(nom, corps.firstChild);
  }

  function barre(ecran, boutons) {
    var scr = $(ecran); if (!scr) return;
    var b = scr.querySelector(".rj140-barre");
    if (!b) { b = document.createElement("div"); b.className = "rj140-barre"; scr.appendChild(b); }
    boutons.forEach(function (id) { var e = $(id); if (e && e.parentNode !== b) b.appendChild(e); });
  }

  function arranger() {
    try {
      identite(); ecurieDeCoeur(); origines(); numero(); introductions(); bandeau();
      barre("S-create", ["cre-back", "cre-err", "cre-next"]);
      barre("S-mode", ["rj80-go"]);
    } catch (e) { console.warn(TAG, e && e.message); }
  }

  function installer() {
    if (typeof rjInscrire !== "function" || !$("S-create") || typeof window.updateCreUI !== "function" || typeof window.goCreate !== "function") return false;
    ["updateCreUI", "goCreate"].forEach(function (nom) {
      rjInscrire(nom, { id: "140-creation-compacte:" + nom, apres: function () { arranger(); setTimeout(arranger, 80); } });
    });
    arranger();
    return true;
  }

  window._rj140 = { arranger: arranger };
  window._rj140Uninstall = function () {
    if (typeof rjDesinscrire === "function") { rjDesinscrire(["140-creation-compacte"], "updateCreUI"); rjDesinscrire(["140-creation-compacte"], "goCreate"); }
    delete window._rj140;
  };

  var essais = 0;
  (function boot() {
    if (installer()) { console.log(TAG, "actif"); return; }
    if (essais++ < 80) setTimeout(boot, 120);
  })();
})();
