/* =====================================================================
 * 138-academie.js — UNE ACADÉMIE QUI MÈNE VRAIMENT À LA F1
 *
 * POURQUOI
 * L'académie annonçait un « plan F1 » à 75 de relation, puis ne tentait
 * l'offre qu'auprès de son écurie phare, qui exigeait une réputation hors
 * de portée (impossible depuis la Formula Regional ou la F3). L'offre se
 * perdait au premier échec, l'accueil annonçait un volant qui n'existait
 * pas, on ne pouvait pas quitter son académie, et elle ne sanctionnait
 * jamais rien.
 *
 * CE QUE FAIT LE MODULE
 *   - VOIE F1 : une fois le plan F1 annoncé, et en F2, en Super Formula ou
 *     champion de F3, l'académie propose une place pour la saison suivante :
 *     dans son écurie sœur d'abord (Haas pour Ferrari, Racing Bulls pour
 *     Red Bull, Williams pour Mercedes), dans l'écurie phare si le pilote
 *     écrase la catégorie, sans condition de réputation (c'est l'académie
 *     qui pousse). Si ses résultats ne justifient pas encore un baquet,
 *     elle le place pilote de réserve de son écurie de F1. L'offre reste
 *     ouverte jusqu'au mercato ; à défaut, elle est retentée l'an suivant.
 *   - QUITTER : possible à tout moment (réputation −3, et l'académie ne
 *     reprend pas le pilote).
 *   - REVUE DE FIN DE SAISON : une bonne saison renforce la relation ; une
 *     saison ratée (place ou relation sous le seuil de l'académie, plus
 *     strict chez Red Bull) vaut un avertissement, la seconde un renvoi.
 *   - INVITATIONS : un pilote éligible reçoit une invitation par message
 *     (une fois par saison), au lieu de devoir penser à ouvrir l'onglet.
 *
 * Persistance : bloc « rj138 ». Réversible : window._rj138Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[138-academie]";
  /* Seuils de la revue de fin de saison : place maximale et relation minimale. */
  var EXIGENCE = { RBJT: { place: 6, relation: 40 } };
  var EXIGENCE_DEFAUT = { place: 12, relation: 20 };

  function A() { return typeof getPlayerAcademy === "function" ? getPlayerAcademy() : null; }
  function nomA() { return (typeof getAcademy === "function" && PLAYER_ACADEMY.id) ? getAcademy(PLAYER_ACADEMY.id) : "Ton académie"; }
  function etat() { var e = PLAYER_ACADEMY._rj138 = PLAYER_ACADEMY._rj138 || {}; return e; }
  function place() {
    var t = [{ p: G.champPts || 0, m: 1 }].concat((G.rivals || []).map(function (x) { return { p: x.pts || 0 }; }));
    t.sort(function (a, b) { return b.p - a.p; });
    return t.map(function (x) { return !!x.m; }).indexOf(true) + 1;
  }
  function f1(team) { return (typeof TEAM_OFFERS !== "undefined" && TEAM_OFFERS["Formule 1"] || []).filter(function (o) { return o.team === team; })[0] || null; }
  function mail(objet, corps) {
    if (typeof pushMail !== "function") return;
    try { pushMail({ from: nomA(), role: "academy", subject: objet, body: corps, actions: [{ label: "Compris", kind: "dismiss", responseBody: "Bien reçu." }] }); } catch (e) {}
  }

  /* --- Voie F1 ------------------------------------------------------------ */
  /* Super Licence (112) projetée à la fin de la saison : l'offre se fait avant que
     la saison compte. shortcut: projection avec une place de marge (p + 1) et sans
     la plus ancienne saison de la fenêtre ; un effondrement de fin de saison n'est
     pas rattrapé, à revoir si cela arrive en jeu. */
  function licenceProjetee(p) {
    var L = window.RJSuperLicence; if (!L) return true;
    var e = L.etat(); if (e.eligible) return true;
    if ((e.age || 0) + 1 < 18) return false;
    var total = e.saisons.slice(-2).reduce(function (t, x) { return t + x.points; }, 0) + L.points({ cat: G.cat, pos: p + 1 });
    return total >= L.requis;
  }


  function eligibleF1() {
    var a = A(); if (!a || !PLAYER_ACADEMY.f1Offer) return false;
    if (G.pendingTransfer && G.pendingTransfer.cat === "Formule 1") return false;
    if ((G.offers || []).some(function (o) { return o && o._academie; })) return false;
    var e = etat(); if (e.offreSaison === G.saison) return false;
    var total = (window.CAL_RACES || []).length || 10, faites = (G.races || []).length;
    if (faites < Math.floor(total * 0.55)) return false;                  // à partir de la mi-saison
    if (G.cat === "Formule 2" || G.cat === "Super Formula") return true;
    return G.cat === "Formule 3" && place() === 1;                       // champion de F3 : il peut sauter la F2
  }

  function proposerF1() {
    if (!eligibleF1() || typeof buildOffer !== "function") return null;
    var a = A(), p = place(), rel = PLAYER_ACADEMY.relation || 0;
    var soeur = (a.f1Alt || []).map(f1).filter(Boolean)[0], phare = f1(a.f1Team);
    var resultats = p <= 3, licence = licenceProjetee(p), baquet = resultats && licence;
    var o = null, cible;
    if (baquet) {
      cible = (p === 1 && rel >= 90 && phare) ? phare : (soeur || phare);
      if (cible) o = buildOffer({ team: cible.team, cat: "Formule 1", cost: 0, salary: cible.salary || 0, bonusWin: cible.bonusWin || 0,
        bonusPodium: cible.bonusPodium || 0, duration: 2, extra: "Voie académie", expire: 40, role: "num2", licenceAttendue: true });
    } else if (phare && !(window._rj79 && _rj79.deal && _rj79.deal())) {
      cible = phare;
      o = buildOffer({ team: phare.team, cat: "Formule 1", cost: 0, salary: Math.round((phare.salary || 0) * 0.15), bonusWin: 0, bonusPodium: 0,
        duration: 1, extra: "Voie académie — réserve", expire: 40, role: "num3" });
      if (o) o.role = "num3";                                              // un contrat de réserve, cumulé avec son baquet actuel
    }
    if (!o) return null;
    o._academie = true;
    /* Une seule offre de réserve à la fois (79) : celle de l'académie remplace une offre de réserve ordinaire. */
    G.offers = (G.offers || []).filter(function (x) { return !(o.role === "num3" && x && x.role === "num3"); });
    G.offers.push(o);
    etat().offreSaison = G.saison;
    mail(baquet ? "Ton volant de F1 est prêt" : "On te veut dans le garage de F1",
      baquet
        ? "La décision est prise : " + cible.team + " te propose un baquet de titulaire en Formule 1 pour la saison prochaine. C'est le plan F1 de " + nomA() + ".\n\nL'offre est dans tes contrats, elle reste ouverte jusqu'au mercato."
        : (resultats ? "Tu as le niveau, mais il te manquera la Super Licence en fin de saison. En attendant," : "Tes résultats ne justifient pas encore un baquet, mais") + " nous voulons t'avoir près de la F1 : " + cible.team + " te propose de devenir son pilote de réserve, en plus de ton baquet actuel.\n\nUne meilleure saison, et la porte du baquet s'ouvre. L'offre est dans tes contrats.");
    return o;
  }

  /* --- Revue de fin de saison -------------------------------------------- */
  function revueSaison() {
    var a = A(); if (!a || G.cat === "Formule 1") return null;          // arrivé en F1 : le programme a rempli son rôle
    var e = etat(), x = EXIGENCE[PLAYER_ACADEMY.id] || EXIGENCE_DEFAUT, p = place(), rel = PLAYER_ACADEMY.relation || 0;
    if (e.revueSaison === G.saison) return null;
    e.revueSaison = G.saison;
    if (p <= 3) { if (typeof changeAcademyRelation === "function") changeAcademyRelation(8, "Bilan de saison : P" + p); e.avertissement = null; return "bonne"; }
    if (p > x.place || rel < x.relation) {
      if (e.avertissement === G.saison - 1) {
        var n = nomA();
        if (typeof leaveAcademy === "function") leaveAcademy("Renvoi après deux saisons décevantes");
        if (typeof pushMail === "function") try { pushMail({ from: n, role: "academy", subject: "Fin de ton programme", body: "Deux saisons sous nos attentes : nous mettons fin à ton programme. Les places sont rares et d'autres pilotes attendent la leur.\n\nNous te souhaitons de rebondir ailleurs.", actions: [{ label: "Compris", kind: "dismiss", responseBody: "Je comprends." }] }); } catch (err) {}
        return "renvoi";
      }
      e.avertissement = G.saison;
      mail("Avertissement de fin de saison", "Ta saison (P" + p + ", relation " + rel + "/100) est en dessous de ce que nous attendons de nos pilotes. Nous te gardons, mais la prochaine saison doit être meilleure : sans progrès, le programme s'arrêtera.");
      return "avertissement";
    }
    e.avertissement = null;
    return "correcte";
  }

  /* --- Invitations -------------------------------------------------------- */
  function inviter() {
    if (PLAYER_ACADEMY.id || typeof getAvailableAcademies !== "function") return null;
    var e = etat(); if (e.invitation === G.saison) return null;
    if ((G.races || []).length < 3) return null;
    var dispo = getAvailableAcademies(); if (!dispo.length) return null;
    e.invitation = G.saison;
    var n = dispo[0];
    if (typeof pushMail === "function") try {
      pushMail({ from: n, role: "academy", subject: "Une place pour toi dans notre programme",
        body: "Nous suivons tes résultats depuis le début de la saison. " + n + " te propose de rejoindre son programme de jeunes pilotes" +
          (dispo.length > 1 ? " (et tu as aussi tapé dans l'œil de " + (dispo.length - 1) + " autre" + (dispo.length > 2 ? "s" : "") + " académie" + (dispo.length > 2 ? "s" : "") + ")" : "") +
          ".\n\nTout se décide dans Pilote › Académie.",
        actions: [{ label: "Je regarde", kind: "dismiss", responseBody: "Merci, je regarde ça." }] });
    } catch (err) {}
    return n;
  }

  /* Être membre permet de partir (contrepartie : réputation et porte fermée, 03). */
  function ouvrirDepart() { if (PLAYER_ACADEMY.id) PLAYER_ACADEMY.canLeave = true; }

  function installer() {
    if (typeof rjInscrire !== "function" || typeof window.generateTeamOffers !== "function" || !Array.isArray(window.WEEKLY_TICK_HOOKS) || !Array.isArray(window.RJ_SAVE_HOOKS)) return false;
    rjInscrire("generateTeamOffers", { id: "138-academie:voie-f1", apres: function () { try { proposerF1(); } catch (e) { console.warn(TAG, e && e.message); } } });
    if (!window.WEEKLY_TICK_HOOKS.some(function (h) { return h && h.id === "138-academie"; })) {
      window.WEEKLY_TICK_HOOKS.push({ id: "138-academie", run: function () { try { ouvrirDepart(); inviter(); } catch (e) {} } });
    }
    if (!Array.isArray(window.RJ_SEASON_HOOKS)) window.RJ_SEASON_HOOKS = [];
    if (!window.RJ_SEASON_HOOKS.some(function (h) { return h && h.id === "138-academie"; })) {
      window.RJ_SEASON_HOOKS.push({ id: "138-academie", avant: function () { try { revueSaison(); } catch (e) { console.warn(TAG, e && e.message); } } });
    }
    if (!window.RJ_SAVE_HOOKS.some(function (h) { return h && h.cle === "rj138"; })) {
      window.RJ_SAVE_HOOKS.push({ cle: "rj138",
        ecrire: function () { return PLAYER_ACADEMY._rj138 || null; },
        lire: function (bloc) { PLAYER_ACADEMY._rj138 = bloc || {}; ouvrirDepart(); } });
    }
    ouvrirDepart();
    return true;
  }

  window.RJAcademie = { proposerF1: proposerF1, eligibleF1: eligibleF1, revueSaison: revueSaison, inviter: inviter };
  window._rj138Uninstall = function () {
    if (typeof rjDesinscrire === "function") rjDesinscrire(["138-academie"], "generateTeamOffers");
    window.WEEKLY_TICK_HOOKS = (window.WEEKLY_TICK_HOOKS || []).filter(function (h) { return !(h && h.id === "138-academie"); });
    window.RJ_SEASON_HOOKS = (window.RJ_SEASON_HOOKS || []).filter(function (h) { return !(h && h.id === "138-academie"); });
    window.RJ_SAVE_HOOKS = (window.RJ_SAVE_HOOKS || []).filter(function (h) { return !(h && h.cle === "rj138"); });
    delete window.RJAcademie;
  };

  var essais = 0;
  (function boot() {
    if (installer()) { console.log(TAG, "actif"); return; }
    if (essais++ < 80) setTimeout(boot, 120);
  })();
})();
