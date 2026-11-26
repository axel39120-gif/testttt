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
    { v: "v320", titre: "Exporter sa partie",
      plus: ["Sauvegardes : un bouton « Exporter » enregistre la partie dans un fichier, pour la retrouver dans la future version du jeu."] },
    { v: "v319", titre: "Onglet Carrière",
      plus: ["Biographie réécrite comme un récit : les catégories anciennes se résument en une ligne, les plus récentes sont racontées, avec les académies et la vie privée.", "Sous-titre « Historique de carrière » au-dessus du filtre."],
      fix: ["Carrés Académies et Évolution carrière alignés sur les autres.", "Palmarès et Trophées réunis sous « Palmarès ».", "Le carré « Contrat actuel » est retiré de l'onglet."] },
    { v: "v318", titre: "Retours de week-end",
      plus: ["Week-ends sprint : l'onglet Sprint est orange, il devient Course en rouge. Les pastilles SPRINT/COURSE de l'en-tête et du circuit sont retirées."],
      fix: ["Le bouton Signer de DAMS (et des écuries aux couleurs claires) est lisible.", "L'auto-réglage se désactive à chaque nouveau week-end.", "Nombre de tours : le sprint et le circuit précédent ne changent plus la longueur des courses suivantes.", "Plus de messages de rivaux qui ne courent plus dans ta catégorie."] },
    { v: "v317", titre: "Académies et week-ends sprint",
      plus: ["Rare : une autre académie peut te proposer un baquet dans la catégorie supérieure, si tu la rejoins. Tu dis oui, l'écurie t'envoie son offre ; la signer engage les deux.", "Week-ends sprint comme en vrai. F1 : une séance d'essais, une qualification pour le sprint, une autre pour le Grand Prix. F2 et F3 : une qualification, les 10 (F2) ou 12 (F3) premiers partent en ordre inverse au sprint."],
      fix: ["Courir hors des écuries partenaires baisse un peu la relation et ne permet plus de changer d'académie.", "Après un départ, aucune académie ne vient te chercher avant trois saisons.", "F3 : les 10 premiers du sprint marquent (10 à 1 point)."] },
    { v: "v316", titre: "Vie privée, académies et réalisme",
      plus: ["Rencontres et vie de couple : séduction, caractères, situations à trancher (dès 18 ans).", "Académies Aston Martin (à la place de Haas) et Audi ; parcours d'académies dans l'onglet Carrière.", "Le patron de ton académie se contacte, et un baquet partenaire se négocie.", "Logos des écuries sans carré, McLaren redessiné.", "Course : commentaires, safety car et VSC dans le circuit, carte et classement plus grands.", "Sprint ou course principale : indiqué dans tout le week-end, et dans le calendrier."],
      fix: ["Difficulté : les rivaux vivent aussi des événements et progressent ; réglage et qualifs de karting remis à égalité.", "Classement de course : écarts au dixième, plus de « TÊTE ».", "Essais et qualifs alignés, tout à l'écran.", "L'académie se quitte à l'arrivée en F1 ; la presse y parle surtout des titres majeurs."] },
    { v: "v315", titre: "Formula Regional",
      plus: ["Une 10e manche en Formula Regional : Misano, avant la finale de Monza (dès la saison suivante)."] },
    { v: "v314", titre: "Presse, messages et qualifs",
      plus: ["70 nouvelles questions de conférence de presse : saison, résultats, qualifs, écurie, voiture, catégorie, circuit, marché…"],
      fix: ["Conférences : plus de question en double, ni dans une conférence, ni d'une conférence à l'autre.", "Team principal, ingénieur, coéquipier : une conversation par personne, neuve quand tu changes d'écurie.", "Le message d'une écurie qui veut te promouvoir arrive avec son offre, jamais après ta signature.", "À partir de la F4, le premier tour des qualifs compte : temps, secteurs et classement, pour toi comme pour les rivaux."] },
    { v: "v313", titre: "Week-ends avec sprint",
      fix: ["Après le sprint, la course principale ne démarre plus toute seule : elle part au bouton Départ.", "Une course en cours ne se quitte plus par erreur et ne tourne plus en arrière-plan.", "Le sprint d'une manche ne peut plus être couru deux fois."] },
    { v: "v312", titre: "Course plus réaliste",
      plus: ["Safety car, VSC et drapeau rouge suivent un vrai abandon et regroupent vraiment le peloton.", "Dépassements : niveau des pilotes, DRS, pression, pluie et relance comptent ; ils se concluent en bout de ligne droite.", "Accrochages, sorties de piste et causes d'abandon.", "Une attaque réussie prend vraiment la place ; le risque d'un choix dépend de ton niveau, de la pluie et du circuit."],
      fix: ["Fausses safety cars et faux drapeaux rouges retirés.", "Les événements collent à la situation : plus de « dans son sillage » à dix secondes de lui."] },
    { v: "v311", titre: "Académies et messagerie",
      fix: ["Une académie qui te contacte est toujours ouverte : plus d'expiration ni de niveau exigé.", "Stage d'académie réussi : une vraie place t'est offerte.", "Une discussion s'ouvre sur le dernier message.", "Le bandeau du contact occupe toute la largeur.", "Classements Constructeurs et Performances : espace en trop sous l'en-tête retiré."] },
    { v: "v310", titre: "Nouvelles icônes",
      plus: ["Toutes les icônes du jeu redessinées dans un seul style : pictogrammes pleins.", "Icônes du menu principal bien plus grandes dans leurs carrés."],
      fix: ["Drapeau du pays affiché pour tous les circuits.", "Essais délégués : séances et réglages repartent de zéro à chaque course.", "Qualifs : moins de hasard, ton niveau et ta préparation comptent davantage."] },
    { v: "v309", titre: "Cloche des notifications",
      fix: ["La cloche ne disparaît plus à partir de dix notifications ; elle et sa pastille rouge restent en place."] },
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
