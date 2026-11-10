/* =====================================================================
 * 135-saison-blanche.js — UNE SAISON BLANCHE QUI SE DÉROULE VRAIMENT
 *
 * POURQUOI
 * Sans offre au mercato, le joueur choisit « Saison blanche » : il reste
 * dans sa catégorie sans écurie, le temps de retrouver un baquet. Mais
 * avancer était refusé à un pilote sans écurie (hors karting junior) :
 * le temps ne passait plus, aucune offre n'arrivait, la saison ne finissait
 * jamais. La carrière était bloquée pour de bon.
 *
 * CE QUE FAIT LE MODULE (seulement en saison blanche, hors karting junior)
 *   - avancer fait passer le temps : les événements se jouent, chaque course
 *     est disputée sans le joueur (simulation des rivaux, 79) et marquée faite ;
 *   - à trois moments de la saison, des écuries de la catégorie peuvent lui
 *     proposer un baquet AVEC EFFET IMMÉDIAT (il court dès la manche suivante),
 *     et celles du dessous un baquet pour la saison suivante, selon sa
 *     réputation et son niveau ; une saison peut donc commencer sans contrat ;
 *   - en signant en cours de saison, il prend la place du pilote le moins
 *     performant de l'écurie (jamais trois voitures) ;
 *   - le calendrier épuisé, la fin de saison s'ouvre, puis le mercato.
 *
 * Réversible : window._rj135Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[135-saison-blanche]";

  function enSaisonBlanche() {
    return typeof G !== "undefined" && G && G._saisonBlanche && G.cat !== "Karting Junior" &&
      (!G.currentTeam || G.currentTeam === "Indépendant") && !G.seasonOver;
  }

  /* Écart entre la note du pilote et le niveau médian de la grille de sa catégorie. */
  function ecartAuPlateau() {
    var note = typeof calcPlayerRating === "function" ? calcPlayerRating() : 60;
    var sk = (G.rivals || []).map(function (x) { return x.skill || 0; }).sort(function (a, b) { return a - b; });
    var med = sk.length ? sk[Math.floor(sk.length / 2)] : 70;
    return note - med;
  }

  /* Des écuries proposent un baquet pour la saison suivante (une fois par tiers de saison). */
  function proposerBaquets() {
    var total = (window.CAL_RACES || []).length || 1;
    var faites = (window.CAL_RACES || []).filter(function (c) { return c.done; }).length;
    var vague = faites >= Math.floor(total * 0.8) ? 3 : faites >= Math.floor(total * 0.55) ? 2 : faites >= Math.floor(total * 0.3) ? 1 : 0;
    G._rj135Vagues = G._rj135Vagues || {};
    var cle = G.saison + "_" + vague;
    if (!vague || G._rj135Vagues[cle] || typeof buildOffer !== "function" || typeof TEAM_OFFERS === "undefined") return 0;
    G._rj135Vagues[cle] = true;
    var cats = [G.cat];
    var i = (window.CATEGORIES || []).indexOf(G.cat);
    if (i > 0 && i <= 6) cats.push(CATEGORIES[i - 1]);           // la catégorie du dessous accepte plus volontiers
    /* Talent et réputation : on compare la note du pilote au niveau médian de
       la grille. Au-dessus, il est plus souvent appelé, et par de meilleures écuries. */
    var rep = G.reputation || 0, ecart = ecartAuPlateau();
    var p = Math.max(0.05, Math.min(0.8, 0.15 + rep / 200 + ecart / 40));
    var faitesIci = 0;
    cats.forEach(function (cat, k) {
      if (faitesIci >= 2 || Math.random() >= p + (k ? 0.15 : 0)) return;
      var ecuries = (TEAM_OFFERS[cat] || []).filter(function (t) { return (t.repReq || 0) <= rep + 5; })
        .filter(function (t) { return !(G.offers || []).some(function (o) { return o.team === t.team && o.cat === cat; }); })
        .sort(function (a, b) { return (b.repReq || 0) - (a.repReq || 0); });
      var debut = ecart >= 5 ? 0 : ecart >= -2 ? Math.floor(ecuries.length / 3) : Math.max(0, ecuries.length - 3);
      var t = ecuries[debut + Math.floor(Math.random() * Math.min(3, Math.max(1, ecuries.length - debut)))];
      if (!t) return;
      try {
        var o = buildOffer({ team: t.team, cat: cat, cost: t.cost || 0, salary: t.salary || 0, bonusWin: t.bonusWin || 0,
          bonusPodium: t.bonusPodium || 0, duration: Math.max(1, t.dur || 1), extra: t.extra || "", expire: 12, role: "num2" });
        if (!o) return;
        if (cat !== G.cat) o._lateral = true;                    // la carte de mercato change bien de catégorie
        else { o._rj79Immediate = true; o.duration = Math.max(2, o.duration || 1); }   // même catégorie : il court tout de suite
        G.offers = G.offers || [];
        G.offers.push(o);
        faitesIci++;
      } catch (e) {}
    });
    if (faitesIci && typeof pushMail === "function") {
      try {
        pushMail({ from: "Ton agent", role: "agent", subject: "Des écuries s'intéressent à toi",
          body: "Ta saison blanche n'est pas passée inaperçue. " + faitesIci + " écurie" + (faitesIci > 1 ? "s te proposent" : " te propose") +
            " un baquet. Une offre dans ta catégorie prend effet tout de suite : tu courrais dès la prochaine manche. Les offres sont dans tes contrats.",
          actions: [{ label: "Je regarde", kind: "dismiss", responseBody: "Merci, je regarde ça." }] });
      } catch (e) {}
    }
    return faitesIci;
  }

  /* Un pas de temps : jusqu'au prochain événement ou à la prochaine course. */
  function avancer() {
    if (!(window.CAL_RACES || []).length && typeof buildCalendar === "function") buildCalendar();
    var m = typeof getNextMoment === "function" ? getNextMoment() : null;
    if (!m) {
      G.seasonOver = true;
      if (typeof showSeasonEnd === "function") showSeasonEnd();
      return true;
    }
    var ecart = m.week - G.semaine;
    if (ecart > 0) {
      G.semaine = m.week;
      try { if (typeof applyWeeklyIncome === "function") applyWeeklyIncome(ecart); } catch (e) {}
      try { if (typeof runWeeklyTicks === "function") runWeeklyTicks(ecart); } catch (e) {}
      try { if (typeof announceNextEvents === "function") announceNextEvents(); } catch (e) {}
    }
    if (m.type === "event") {
      if (typeof openScheduledEvent === "function") openScheduledEvent(m.data);
      return true;
    }
    // la course a lieu sans le joueur
    var course = m.data;
    try { if (window._rj79 && typeof _rj79.simuler === "function") _rj79.simuler(course.name); } catch (e) { console.warn(TAG, e && e.message); }
    course.done = true;
    course.result = { blanche: true, pos: null, pts: 0 };
    proposerBaquets();
    if ((window.CAL_RACES || []).every(function (c) { return c.done; })) {
      G.seasonOver = true;
      if (typeof showSeasonEnd === "function") showSeasonEnd();
    } else {
      if (typeof showToast === "function") showToast("Saison blanche — " + course.name + " s'est couru sans toi.");
      if (typeof updateUI === "function") try { updateUI(); } catch (e) {}
      if (typeof renderChamp === "function") try { renderChamp(); } catch (e) {}
    }
    if (typeof saveGame === "function" && G._slot != null) try { saveGame(G._slot, { silencieux: true }); } catch (e) {}
    return true;
  }

  /* Après une signature : l'écurie rejointe n'aligne jamais trois voitures, et la
     saison blanche s'arrête. */
  function apresSignature() {
    if (typeof G === "undefined" || !G || !G.currentTeam || G.currentTeam === "Indépendant") return;
    G._saisonBlanche = false;
    var auDepart = typeof rivalAuDepart === "function" ? rivalAuDepart : function (r) { return !!r && !r._rj79Gele && !r._rj79Sorti; };
    var equipiers = (G.rivals || []).filter(function (r) { return r && r.team === G.currentTeam && auDepart(r); })
      .sort(function (a, b) { return (a.skill || 0) - (b.skill || 0); });
    if (equipiers.length >= 2) equipiers[0]._rj79Sorti = { cause: "remplace", saison: G.saison, week: G.semaine };
  }

  function installer() {
    if (!Array.isArray(window.RJ_ADVANCE_HOOKS) || typeof rjInscrire !== "function" || typeof window.signContract !== "function") return false;
    rjInscrire("signContract", { id: "135-saison-blanche:signature", apres: function () { try { apresSignature(); } catch (e) { console.warn(TAG, e && e.message); } } });
    if (!window.RJ_ADVANCE_HOOKS.some(function (h) { return h && h.id === "135-saison-blanche"; })) {
      /* ordre élevé : la planification de pré-saison et les conférences passent d'abord */
      window.RJ_ADVANCE_HOOKS.push({ id: "135-saison-blanche", ordre: 15, intercepte: function () {
        if (!enSaisonBlanche()) return false;
        try { return avancer(); } catch (e) { console.warn(TAG, e && e.message); return false; }
      } });
    }
    return true;
  }

  window.RJSaisonBlanche = { avancer: avancer, proposer: proposerBaquets, active: enSaisonBlanche, apresSignature: apresSignature, ecart: ecartAuPlateau };
  window._rj135Uninstall = function () {
    window.RJ_ADVANCE_HOOKS = (window.RJ_ADVANCE_HOOKS || []).filter(function (h) { return !(h && h.id === "135-saison-blanche"); });
    if (typeof rjDesinscrire === "function") rjDesinscrire(["135-saison-blanche"], "signContract");
    delete window.RJSaisonBlanche;
  };

  var essais = 0;
  (function boot() {
    if (installer()) { console.log(TAG, "actif"); return; }
    if (essais++ < 80) setTimeout(boot, 120);
  })();
})();
