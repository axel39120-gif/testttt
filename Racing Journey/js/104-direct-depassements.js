/* =====================================================================
 * 104-direct-depassements.js — LE DIRECT RACONTE ENFIN LA COURSE
 *
 * CE QU'IL Y AVAIT
 * Le fil « Direct » ne diffusait que des messages d'ambiance : consignes
 * radio, état des pneus, undercut d'un rival. Sur une course entière, huit
 * messages en tout — et pas un seul dépassement.
 *
 * Le joueur voyait donc son pilote doubler deux personnes dans le fil,
 * puis découvrait à l'arrivée qu'il en avait dépassé quinze. Le récit ne
 * correspondait pas à la course.
 *
 * CE QUE FAIT CE MODULE
 * À chaque tour, il compare la position du joueur à celle du tour
 * précédent et raconte ce qui vient de se passer, en nommant les pilotes
 * concernés. Il suit aussi la tête de course, les abandons et les luttes
 * en cours.
 *
 * Le fil appartient au module 08 : on lui passe les messages plutôt que
 * d'écrire dans le même nœud du DOM — un double propriétaire avait déjà
 * causé des scintillements par le passé.
 *
 * Réversible : window._rj104Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[104-direct]";

  function G_() { return (typeof window.G !== "undefined") ? window.G : null; }

  function pousser(item) {
    try {
      if (typeof window._rj08Direct === "function") { window._rj08Direct(item); return true; }
      if (typeof window.pushRadioMsg === "function") {
        window.pushRadioMsg(item.title, item.desc, { color: item.color, ttl: 5 });
        return true;
      }
    } catch (e) {}
    return false;
  }

  function pilotes() {
    try { return (window.LIVE_RACE && window.LIVE_RACE.drivers) || []; } catch (e) { return []; }
  }

  function moi() {
    var d = pilotes();
    for (var i = 0; i < d.length; i++) if (d[i].isPlayer) return d[i];
    return null;
  }

  function nomCourt(d) {
    if (!d || !d.name) return "un rival";
    var b = String(d.name).trim().split(/\s+/);
    return b.length > 1 ? b.slice(1).join(" ") : b[0];
  }

  /* Classement du tour précédent, pour savoir qui a été dépassé. */
  var etat = { positions: {}, tour: 0, place: null };

  function instantane() {
    var carte = {};
    pilotes().forEach(function (d) {
      if (d && d.name != null) carte[d.name] = d.pos;
    });
    return carte;
  }

  /* ==================================================================
   * LE RÉCIT
   * ================================================================== */
  var VERBES_GAIN = [
    "passe {qui}", "déborde {qui}", "prend l'avantage sur {qui}",
    "s'impose face à {qui}", "double {qui}"
  ];
  var VERBES_PERTE = [
    "se fait passer par {qui}", "cède devant {qui}",
    "ne peut rien contre {qui}", "perd sa place au profit de {qui}"
  ];
  function auHasard(t) { return t[Math.floor(Math.random() * t.length)]; }

  function raconterMouvement(avant, apres, doubles, doubleurs) {
    var G = G_();
    var nom = "";
    try { nom = (G.pilot.prenom || "") + " " + (G.pilot.nom || ""); } catch (e) { nom = "Le pilote"; }
    var court = nom.trim().split(/\s+/).slice(-1)[0] || "Toi";

    var gain = avant - apres;

    if (gain > 0) {
      /* On nomme ceux qui viennent d'être dépassés — c'est ce qui manquait :
         le fil disait « bonne course », jamais qui avait été doublé. */
      var qui = doubles.slice(0, 2).map(nomCourt).join(" et ");
      var titre;
      if (gain === 1 && qui) {
        titre = court + " " + auHasard(VERBES_GAIN).replace("{qui}", qui) + " !";
      } else if (gain === 1) {
        titre = court + " gagne une place";
      } else {
        titre = court + " remonte de " + gain + " places" + (qui ? " — " + qui + " sont derrière" : "");
      }
      /* Le fil n'affiche « title » que pour les messages radio ; les autres
         entrées passent par « text ». Fournir l'un sans l'autre affichait
         « undefined » à l'écran. */
      pousser({
        text: "<strong>" + titre + "</strong> \u00b7 P" + avant + " \u2192 P" + apres,
        title: titre,
        desc: "P" + avant + " \u2192 P" + apres,
        color: "#34D399",
        _key: "gain" + apres
      });
      return;
    }

    if (gain < 0) {
      var perte = -gain;
      var par = doubleurs.slice(0, 2).map(nomCourt).join(" et ");
      var t2;
      if (perte === 1 && par) {
        t2 = court + " " + auHasard(VERBES_PERTE).replace("{qui}", par);
      } else if (perte === 1) {
        t2 = court + " perd une place";
      } else {
        t2 = court + " recule de " + perte + " places";
      }
      pousser({
        text: "<strong>" + t2 + "</strong> \u00b7 P" + avant + " \u2192 P" + apres,
        title: t2,
        desc: "P" + avant + " \u2192 P" + apres,
        color: "#F87171",
        _key: "perte" + apres
      });
    }
  }

  /* Une lutte en cours : l'écart avec celui de devant devient faible. */
  function raconterLutte(m) {
    try {
      var devant = null;
      pilotes().forEach(function (d) { if (d && d.pos === m.pos - 1) devant = d; });
      if (!devant) return;
      var ecart = Math.abs((devant.gap || 0) - (m.gap || 0));
      if (ecart > 0 && ecart < 0.8) {
        pousser({
          text: "Dans les échappements de <strong>" + nomCourt(devant) +
                "</strong> \u2014 moins d'une seconde",
          title: "Dans les échappements de " + nomCourt(devant),
          desc: "Moins d'une seconde \u2014 l'attaque est possible",
          color: "#F59E0B",
          _key: "lutte" + devant.name
        });
      }
    } catch (e) {}
  }

  /* ==================================================================
   * LE SUIVI, TOUR PAR TOUR
   * ================================================================== */
  function surTour() {
    try {
      var m = moi();
      if (!m || m.dnf) return;
      var cur = (window.LIVE_RACE && window.LIVE_RACE.cur) || 0;
      if (cur === etat.tour) return;

      var avantCarte = etat.positions;
      var apresCarte = instantane();

      if (etat.place == null) {
        /* Premier relevé de la course : on note la grille sans commenter. */
        etat.positions = apresCarte; etat.place = m.pos; etat.tour = cur;
        return;
      }
      if (m.pos !== etat.place) {
        /* Qui a été dépassé : ceux qui étaient devant et sont maintenant
           derrière. Un abandon n'est pas un dépassement, on l'exclut. */
        var doubles = [], doubleurs = [];
        pilotes().forEach(function (d) {
          if (!d || d.isPlayer || d.dnf) return;
          var av = avantCarte[d.name];
          if (av == null) return;
          if (av < etat.place && d.pos > m.pos) doubles.push(d);
          if (av > etat.place && d.pos < m.pos) doubleurs.push(d);
        });
        raconterMouvement(etat.place, m.pos, doubles, doubleurs);
      } else if (cur > 2 && cur % 7 === 0) {
        raconterLutte(m);
      }

      etat.positions = apresCarte;
      etat.place = m.pos;
      etat.tour = cur;
    } catch (e) { console.warn(TAG, e && e.message); }
  }

  function reinitialiser() {
    etat = { positions: instantane(), tour: 0, place: (moi() || {}).pos || null };
  }

  /* ==================================================================
   * INSTALLATION
   * ================================================================== */
  /* Le registre des tours n'est pas alimenté par toutes les configurations
     de course — mesuré à zéro appel sur une course de cinquante-sept tours.
     On surveille donc directement le compteur de tours : c'est peu coûteux,
     et cela fonctionne quel que soit le moteur employé. */
  var veille = null;

  function surveiller() {
    if (veille) return;
    veille = setInterval(function () {
      try {
        var L = window.LIVE_RACE;
        if (!L || !L.drivers || !L.drivers.length) { etat.tour = 0; return; }
        var cur = L.cur || 0;
        if (cur < etat.tour) reinitialiser();      // nouvelle course
        if (cur !== etat.tour) surTour();
      } catch (e) {}
    }, 350);
  }

  function installer() {
    surveiller();
    /* Si le registre existe, on s'y branche aussi : deux sources valent
       mieux qu'une, la déduplication par clé évite les doublons. */
    if (Array.isArray(window.RJ_LAP_HOOKS) &&
        !window.RJ_LAP_HOOKS.some(function (h) { return h && h._rj104; })) {
      var hook = function () { surTour(); };
      hook._rj104 = true;
      window.RJ_LAP_HOOKS.push(hook);
    }
    return true;
  }

  function boot() {
    var essais = 0;
    (function tenter() {
      if (installer()) { console.log(TAG, "dépassements racontés dans le direct"); return; }
      if (essais++ < 80) setTimeout(tenter, 150);
    })();

    window._rj104 = { surTour: surTour, reinitialiser: reinitialiser, etat: function () { return etat; } };
    window._rj104Uninstall = function () {
      if (veille) { clearInterval(veille); veille = null; }
      if (Array.isArray(window.RJ_LAP_HOOKS)) {
        window.RJ_LAP_HOOKS = window.RJ_LAP_HOOKS.filter(function (h) { return !(h && h._rj104); });
      }
      console.log(TAG, "désinstallé");
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
