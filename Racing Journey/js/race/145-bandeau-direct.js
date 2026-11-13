/* =====================================================================
 * 145-bandeau-direct.js — UN COMMENTAIRE À LA FOIS, EN HAUT DE L'ÉCRAN
 *
 * POURQUOI (v282, demande du joueur)
 * Le fil « Direct » empilait des messages répétitifs dans une colonne, à
 * côté d'un mini-classement redondant avec la tour. Il est remplacé par un
 * bandeau en haut de l'écran de course : un seul commentaire visible, qui
 * change au fil de la course, tiré de ce qui se passe vraiment sur la piste
 * (dépassements, bagarres, écarts, arrêts, abandons, meilleur tour, tours
 * restants) et d'une grande réserve de phrases pour varier.
 *
 * SOURCES
 *   RJ_FRAME_HOOKS (111) : l'état de la piste quatre fois par seconde
 *     (voitures : nom, pos, ecart, abandon, auStand, joueur).
 *   RJ_LAP_HOOKS (81) : une fois par tour (étapes de la course).
 *   LIVE_RACE.directFeed : les événements du moteur (safety car, pluie…),
 *     repris quand ils ne sont pas de simples messages d'ambiance.
 *
 * File d'attente à priorités : un commentaire reste au moins MIN ms ; s'il
 * ne se passe rien, une phrase d'ambiance toutes les CALME ms.
 * Réversible : window._rj145Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[145-bandeau]";
  var MIN = 3600, CALME = 7000;

  function LR() { return typeof window.LIVE_RACE !== "undefined" ? window.LIVE_RACE : null; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function court(nom) { var m = String(nom || "").trim().split(/\s+/); return m.length > 1 ? m.slice(1).join(" ") : m[0] || ""; }
  function hasard(L) { return L[Math.floor(Math.random() * L.length)]; }
  function remplir(modele, v) { return modele.replace(/\{(\w+)\}/g, function (_, k) { return v[k] != null ? v[k] : ""; }); }

  /* Réserve de phrases. Variables : {moi} {devant} {derriere} {pos} {gain}
     {tours} {ecart} {nom} {autre} {circuit}. */
  var P = {
    gain: [
      "{moi} plonge à l'intérieur et passe {derriere} ! P{pos}.",
      "Quel freinage de {moi} ! {derriere} n'a rien pu faire, P{pos}.",
      "{moi} prend l'aspiration et déborde {derriere} : P{pos}.",
      "Dépassement propre de {moi} sur {derriere}, on monte en P{pos}.",
      "{moi} met la pression et {derriere} craque : P{pos}.",
      "Belle manœuvre par l'extérieur ! {moi} gagne une place, P{pos}.",
      "{moi} sort mieux du virage et passe {derriere} dans la ligne droite.",
      "Une place de plus pour {moi}, qui remonte en P{pos}."
    ],
    gainPlus: [
      "{moi} gagne {gain} places d'un coup ! Le voilà P{pos}.",
      "Remontée fulgurante : +{gain} places pour {moi}, P{pos}.",
      "{moi} profite de la bagarre devant et grappille {gain} places."
    ],
    perte: [
      "{devant} passe {moi} au freinage. On recule en P{pos}.",
      "{moi} s'est fait surprendre par {devant}, P{pos}.",
      "Petite erreur de {moi}, {devant} en profite : P{pos}.",
      "{devant} était plus rapide, {moi} ne résiste pas. P{pos}.",
      "Dépassé par {devant}, {moi} doit se reconcentrer. P{pos}."
    ],
    pertePlus: [
      "Coup dur pour {moi}, {gain} places perdues. P{pos}.",
      "{moi} perd gros : {gain} places envolées, P{pos}."
    ],
    attaque: [
      "{moi} est dans l'aileron de {devant}, {ecart} s seulement !",
      "{moi} revient fort sur {devant} : {ecart} s d'écart.",
      "Ça va passer ? {moi} colle {devant} à {ecart} s.",
      "{devant} voit {moi} grossir dans ses rétros. {ecart} s.",
      "{moi} cherche l'ouverture sur {devant}, ils sont roue dans roue."
    ],
    defense: [
      "{derriere} attaque {moi} : {ecart} s entre eux.",
      "{moi} ferme la porte, {derriere} est juste derrière.",
      "Pression maximale sur {moi}, {derriere} à {ecart} s.",
      "{moi} défend sa P{pos} face à {derriere}."
    ],
    leader: [
      "Changement en tête : {nom} prend les commandes !",
      "{nom} passe {autre} et mène la course !",
      "Nouveau leader : {nom} devant {autre}."
    ],
    moiLeader: [
      "{moi} prend la tête de la course !",
      "{moi} est en tête ! Il faut maintenant tenir.",
      "P1 pour {moi} ! Le public est debout."
    ],
    abandon: [
      "Abandon de {nom}, la course s'arrête là pour lui.",
      "{nom} est à l'arrêt, c'est terminé.",
      "Drame pour {nom}, qui doit abandonner.",
      "Fumée chez {nom} : abandon."
    ],
    moiStand: [
      "{moi} rentre aux stands !",
      "Arrêt aux stands pour {moi}, l'équipe est prête.",
      "{moi} dans la voie des stands, on change les pneus."
    ],
    standAutre: [
      "{nom} s'arrête aux stands.",
      "Passage aux stands pour {nom}."
    ],
    mi: [
      "Mi-course à {circuit} : {moi} est P{pos}.",
      "On a fait la moitié du chemin, {moi} pointe en P{pos}.",
      "La moitié de la course est derrière nous. P{pos} pour {moi}."
    ],
    fin5: [
      "Plus que 5 tours ! {moi} est P{pos}.",
      "5 tours de la fin, chaque dixième compte.",
      "Dernière ligne droite : 5 tours, {moi} en P{pos}."
    ],
    dernier: [
      "Dernier tour ! {moi} est P{pos}.",
      "Drapeau blanc, c'est le dernier tour !",
      "Un tour pour tout donner. P{pos} pour {moi}."
    ],
    depart: [
      "Les feux s'éteignent, c'est parti à {circuit} !",
      "Départ donné ! {moi} s'élance de la P{pos}.",
      "Et c'est parti ! Le peloton se rue vers le premier virage."
    ],
    grille: [
      "Les voitures sont en place sur la grille de {circuit}.",
      "{moi} attend les feux, en P{pos} sur la grille.",
      "Tension maximale sur la grille, plus que quelques secondes."
    ],
    arrivee: [
      "Drapeau à damier ! {nom} remporte la course.",
      "C'est fini ! Victoire de {nom}.",
      "{nom} passe la ligne en vainqueur !"
    ],
    moiVainqueur: [
      "VICTOIRE ! {moi} remporte la course à {circuit} !",
      "{moi} gagne ! Quelle course !"
    ],
    moiArrivee: [
      "{moi} termine P{pos}.",
      "Drapeau à damier pour {moi}, P{pos} à l'arrivée."
    ],
    calmeTete: [
      "{moi} contrôle la course en tête, {ecart} s d'avance.",
      "Course solide de {moi}, toujours devant.",
      "{moi} gère son avance, rien ne semble l'inquiéter."
    ],
    calme: [
      "{moi} tient le rythme en P{pos}.",
      "{moi} roule seul, {ecart} s derrière {devant}.",
      "Rythme régulier pour {moi}, P{pos} à {tours} tours de la fin.",
      "L'écart avec {devant} est de {ecart} s.",
      "{moi} économise ses pneus en P{pos}.",
      "Tout est calme pour {moi} en P{pos}.",
      "Les tours défilent, {moi} reste P{pos}.",
      "{moi} cherche le bon rythme pour revenir sur {devant}.",
      "Course de patience pour {moi}, toujours P{pos}.",
      "Le stand annonce {tours} tours restants, {moi} est P{pos}."
    ],
    meilleurTour: [
      "Meilleur tour en course pour {moi} !",
      "{moi} signe le tour le plus rapide !",
      "Chrono violet : {moi} s'offre le meilleur tour."
    ]
  };

  /* ------------------------------------------------------------------ */
  var file = [], dernierAffichage = 0, dernierCalme = 0, minuterie = 0;
  var avant = null;           // état précédent de la piste
  var vusFeed = {}, meilleurTourVu = null;

  function poser(texte, prio) {
    if (!texte) return;
    file.push({ t: texte, p: prio || 1 });
    file.sort(function (a, b) { return b.p - a.p; });
    if (file.length > 4) file.length = 4;   // on ne raconte pas le passé
  }

  function bandeau() {
    var b = document.getElementById("rj145-bandeau");
    if (b) return b;
    var ecran = document.getElementById("race-screen");
    if (!ecran) return null;
    b = document.createElement("div");
    b.id = "rj145-bandeau";
    b.setAttribute("aria-live", "polite");
    b.innerHTML = '<span class="rj145-direct">Direct</span><span class="rj145-txt"></span>';
    ecran.insertBefore(b, ecran.firstChild);
    return b;
  }

  function afficher(texte) {
    var b = bandeau();
    if (!b) return;
    var s = b.querySelector(".rj145-txt");
    s.classList.remove("rj145-entre");
    void s.offsetWidth;   // relance l'animation d'entrée
    s.innerHTML = esc(texte);
    s.classList.add("rj145-entre");
    dernierAffichage = Date.now();
  }

  function valeurs(e) {
    var lr = LR(), moi = null, devant = null, derriere = null;
    var vivants = (e ? e.voitures : []).filter(function (v) { return !v.abandon && !v.autreCategorie; }).sort(function (a, b) { return a.pos - b.pos; });
    vivants.forEach(function (v, i) { if (v.joueur) { moi = v; devant = vivants[i - 1] || null; derriere = vivants[i + 1] || null; } });
    var circuit = (window.RACE_STATE && RACE_STATE.circuit) || "";
    return {
      vivants: vivants, moiV: moi, devantV: devant, derriereV: derriere,
      moi: moi ? court(moi.nom) : "Ton pilote", pos: moi ? moi.pos : "?",
      devant: devant ? court(devant.nom) : "", derriere: derriere ? court(derriere.nom) : "",
      tours: lr ? Math.max(0, (lr.total || 0) - (lr.cur || 0)) : "", circuit: circuit
    };
  }

  /* L'état de la piste, quatre fois par seconde (111). */
  function surImage(e) {
    var lr = LR();
    if (!lr || !e) return;
    var v = valeurs(e);
    if (!avant) {
      avant = { pos: v.moiV ? v.moiV.pos : null, tete: v.vivants[0] && v.vivants[0].nom, out: {}, stand: {}, depart: e.temps > 0, fini: false };
      if (!(e.temps > 0)) poser(remplir(hasard(P.grille), v), 2);
      e.voitures.forEach(function (x) { if (x.abandon) avant.out[x.nom] = 1; });
    }
    if (!avant.depart && e.temps > 0) { avant.depart = true; poser(remplir(hasard(P.depart), v), 5); }

    if (e.fini && !avant.fini) {
      avant.fini = true;
      var gagnant = v.vivants[0];
      if (v.moiV && v.moiV.pos === 1) poser(remplir(hasard(P.moiVainqueur), v), 9);
      else {
        poser(remplir(hasard(P.arrivee), { nom: gagnant ? court(gagnant.nom) : "" }), 8);
        if (v.moiV) poser(remplir(hasard(P.moiArrivee), v), 7);
      }
    }
    if (avant.fini) return;

    // le joueur gagne ou perd des places
    if (v.moiV && avant.pos != null && v.moiV.pos !== avant.pos && e.temps > 0) {
      var d = avant.pos - v.moiV.pos;
      var x = Object.assign({}, v, { gain: Math.abs(d), derriere: v.derriere, devant: v.devant });
      if (v.moiV.pos === 1 && d > 0) poser(remplir(hasard(P.moiLeader), x), 7);
      else if (d === 1) poser(remplir(hasard(P.gain), x), 6);
      else if (d > 1) poser(remplir(hasard(P.gainPlus), x), 6);
      else if (d === -1) poser(remplir(hasard(P.perte), x), 6);
      else poser(remplir(hasard(P.pertePlus), x), 6);
    }
    if (v.moiV) avant.pos = v.moiV.pos;

    // changement de leader (hors joueur, déjà raconté)
    var tete = v.vivants[0];
    if (tete && avant.tete && tete.nom !== avant.tete && !tete.joueur && e.temps > 0)
      poser(remplir(hasard(P.leader), { nom: court(tete.nom), autre: court(avant.tete) }), 5);
    if (tete) avant.tete = tete.nom;

    // abandons et arrêts aux stands
    e.voitures.forEach(function (c) {
      if (c.autreCategorie) return;
      if (c.abandon && !avant.out[c.nom]) { avant.out[c.nom] = 1; poser(remplir(hasard(P.abandon), { nom: court(c.nom) }), c.joueur ? 9 : 4); }
      if (c.auStand && !avant.stand[c.nom]) {
        avant.stand[c.nom] = 1;
        if (c.joueur) poser(remplir(hasard(P.moiStand), v), 6);
        else if (c.pos <= 5) poser(remplir(hasard(P.standAutre), { nom: court(c.nom) }), 2);
      }
      if (!c.auStand) delete avant.stand[c.nom];
    });

    // meilleur tour du joueur
    if (lr.bestLap && lr.bestLap.isPlayer && meilleurTourVu !== lr.bestLap.time) {
      meilleurTourVu = lr.bestLap.time; poser(remplir(hasard(P.meilleurTour), v), 5);
    }

    // événements du moteur (safety car, pluie, incidents…)
    (lr.directFeed || []).slice(-3).forEach(function (f) {
      var cle = f._key || f.text;
      if (!cle || vusFeed[cle]) return;
      vusFeed[cle] = 1;
      if (/^amb_|^gain|^loss|^perte/.test(String(f._key || ""))) return;   // ambiance et positions : déjà couvertes
      var t = String(f.title || f.text || "").replace(/<[^>]+>/g, "").trim();
      if (t) poser(t, 5);
    });
  }

  /* Une fois par tour : les étapes. */
  function surTour(tour, lr) {
    if (!lr || !lr.total) return;
    var e = window.RJModelePiste ? RJModelePiste.etat() : null, v = valeurs(e);
    var reste = lr.total - tour;
    if (tour === Math.round(lr.total / 2)) poser(remplir(hasard(P.mi), v), 3);
    else if (reste === 5) poser(remplir(hasard(P.fin5), v), 4);
    else if (reste === 1 || reste === 0 && !lr.finished) poser(remplir(hasard(P.dernier), v), 5);
  }

  /* Le défilement : la file d'abord, sinon une phrase d'ambiance. */
  function tic() {
    var lr = LR();
    if (!lr || !document.getElementById("race-screen")) return;
    var maintenant = Date.now();
    if (maintenant - dernierAffichage < MIN) return;
    if (file.length) { afficher(file.shift().t); return; }
    if (lr.finished || !avant || !avant.depart || maintenant - dernierCalme < CALME) return;
    dernierCalme = maintenant;
    var e = window.RJModelePiste ? RJModelePiste.etat() : null, v = valeurs(e);
    if (!v.moiV) return;
    var ecartDevant = v.devantV ? Math.abs((v.moiV.ecart || 0) - (v.devantV.ecart || 0)) : null;
    var ecartDerriere = v.derriereV ? Math.abs((v.derriereV.ecart || 0) - (v.moiV.ecart || 0)) : null;
    var x = Object.assign({}, v);
    if (v.moiV.pos === 1) { x.ecart = ecartDerriere != null ? ecartDerriere.toFixed(1) : "—"; afficher(remplir(hasard(P.calmeTete), x)); return; }
    if (ecartDevant != null && ecartDevant < 0.8) { x.ecart = ecartDevant.toFixed(1); afficher(remplir(hasard(P.attaque), x)); return; }
    if (ecartDerriere != null && ecartDerriere < 0.8) { x.ecart = ecartDerriere.toFixed(1); afficher(remplir(hasard(P.defense), x)); return; }
    x.ecart = ecartDevant != null ? ecartDevant.toFixed(1) : "—";
    var choix = P.calme.filter(function (m) { return v.devant || m.indexOf("{devant}") < 0; });
    afficher(remplir(hasard(choix), x));
  }

  function nouvelleCourse() {
    file = []; avant = null; vusFeed = {}; meilleurTourVu = null; dernierAffichage = 0; dernierCalme = Date.now();
    var b = bandeau();
    if (b) b.querySelector(".rj145-txt").textContent = "";
  }

  function boot() {
    if (!Array.isArray(window.RJ_FRAME_HOOKS) || !Array.isArray(window.RJ_LAP_HOOKS) || !Array.isArray(window.RJ_RACE_START_HOOKS)) return setTimeout(boot, 100);
    var deja = function (L) { return L.some(function (h) { return h && h.id === "145-bandeau"; }); };
    if (!deja(window.RJ_FRAME_HOOKS)) {
      window.RJ_FRAME_HOOKS.push({ id: "145-bandeau", run: function (e) { try { bandeau(); surImage(e); } catch (x) { console.warn(TAG, x && x.message); } } });
      window.RJ_LAP_HOOKS.push({ id: "145-bandeau", run: surTour });
      window.RJ_RACE_START_HOOKS.push({ id: "145-bandeau", apres: nouvelleCourse });
    }
    minuterie = setInterval(tic, 400);
    window.RJBandeau = { poser: poser, phrases: P, tic: tic };
    window._rj145Uninstall = function () {
      ["RJ_FRAME_HOOKS", "RJ_LAP_HOOKS", "RJ_RACE_START_HOOKS"].forEach(function (r) {
        window[r] = window[r].filter(function (h) { return !(h && h.id === "145-bandeau"); });
      });
      clearInterval(minuterie);
      var b = document.getElementById("rj145-bandeau"); if (b) b.remove();
      delete window.RJBandeau;
    };
    console.log(TAG, "actif — un commentaire à la fois, en haut de l'écran de course");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
