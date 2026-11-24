/* =====================================================================
 * 168-notes-version.js — LES NOTES DE VERSION
 *
 * Ce qui s'ouvre quand on touche le bouton « Build » : pour chaque version,
 * les nouveautés (+) et les corrections. La plus récente en tête. Une entrée
 * est à ajouter à chaque version (le test « notes308 » le vérifie).
 * Le diagnostic technique reste au bout d'un bouton.
 * =================================================================== */
(function () {
  "use strict";

  var NOTES = [
    { v: "v308", titre: "Notes de version",
      plus: ["Le bouton Build ouvre ces notes : nouveautés et corrections de chaque version."] },
    { v: "v307", titre: "Couleurs des secteurs",
      fix: ["Essais : secteurs en violet (meilleur de la séance), vert (ton meilleur) ou jaune, chacun sa couleur. Plus jamais de blanc.", "Les rivaux ont de vrais temps par secteur."] },
    { v: "v306", titre: "Négociations et fin de week-end",
      plus: ["Résultat de course sur une seule page, classements en fenêtres.", "Le titre est annoncé dès qu'il est mathématiquement acquis, pour toi ou un rival.", "Négociation refaite : une page, quatre onglets, contre-propositions, poignée de main.", "Salaire et primes signés sont vraiment versés."],
      fix: ["Les fenêtres ne remontent plus quand on touche un curseur.", "Essais : tu n'es plus en tête à chaque séance.", "Une prolongation acceptée n'est plus proposée à nouveau.", "Le résultat du sprint n'affiche plus la course précédente."] },
    { v: "v305", titre: "Essais libres, suite",
      plus: ["Programme Départs à la dernière séance.", "Bouton Déléguer une séance.", "Connaissance voiture : moins de fautes en qualif et en course."],
      fix: ["Les temps courts du débrief ne sont plus arrondis à 0 s."] },
    { v: "v304", titre: "Essais libres à programmes",
      plus: ["Trois programmes : Réglages, Tour rapide, Long relais, avec médailles et effets sur le week-end.", "La zone idéale se découvre en roulant.", "Les rivaux se préparent aussi."],
      fix: ["La feuille de temps ne se redéplie plus au stand."] },
    { v: "v303", titre: "Défilement et messages",
      fix: ["Essais et qualifs sans défilement sur téléphone à encoche.", "Les messages « Bureau d'études » s'ouvrent de nouveau."] },
    { v: "v302", titre: "Accords et fiches",
      plus: ["Accords sous condition, négociation conservée.", "Logos hors F1 redessinés.", "Carrière complète dans la fiche pilote.", "Temps au millième sur la grille."],
      fix: ["Boutons d'accueil entiers, note de saison figée."] },
    { v: "v301", titre: "Grands Prix et événements",
      plus: ["Un visuel par Grand Prix, grille de départ filmée.", "Dépassements selon la catégorie, bilan du mois, nouvelles notifications."],
      fix: ["Événements de course uniformes, contacts de messagerie uniques."] },
    { v: "v300", titre: "Circuits et fenêtres",
      plus: ["Herbe et arbres sur les circuits, logos des catégories.", "Le numéro 1 est réservé au champion du monde de F1."],
      fix: ["Les fenêtres tiennent dans l'écran."] }
  ];

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function liste(nom, classe, L) {
    return L && L.length ? '<h4 class="' + classe + '">' + nom + "</h4><ul>" + L.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "";
  }
  /* absents : modules non chargés ; diagnostic() : mesures techniques de la page. */
  function ouvrir(absents, diagnostic) {
    var vieux = document.getElementById("rj168"); if (vieux) { vieux.remove(); return; }
    var v = document.createElement("div");
    v.id = "rj168"; v.className = "rj166-voile"; v.setAttribute("data-rj-noround", "1");
    v.innerHTML = '<div class="rj166-carte"><div class="rj166-tete"><b>Notes de version</b><button type="button" class="rj166-x" aria-label="Fermer">×</button></div><div class="rj166-corps">' +
      (absents && absents.length ? '<p class="rj168-alerte">Modules non chargés : ' + esc(absents.join(", ")) + ". Ferme le jeu puis rouvre-le.</p>" : "") +
      NOTES.map(function (n, i) {
        return '<section class="' + (i ? "" : "neuf") + '"><h3><b>' + n.v + "</b> " + esc(n.titre) + (n.v === window.RJ_BUILD ? "<i>installée</i>" : "") + "</h3>" + liste("Nouveautés", "plus", n.plus) + liste("Corrections", "fix", n.fix) + "</section>";
      }).join("") + '<button type="button" class="rj168-diag">Diagnostic technique</button><pre hidden></pre></div></div>';
    v.addEventListener("click", function (e) {
      if (e.target === v || e.target.closest(".rj166-x")) return v.remove();
      if (!e.target.closest(".rj168-diag")) return;
      var p = v.querySelector("pre"); p.textContent = diagnostic ? diagnostic() : "indisponible"; p.hidden = false; e.target.remove();
    });
    document.body.appendChild(v);
  }
  window.RJNotesVersion = { notes: NOTES, ouvrir: ouvrir };
})();
