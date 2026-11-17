/* =====================================================================
 * 152-coherence-equipe.js — PAS D'ÉQUIPE, PAS DE COÉQUIPIER… PAS D'HISTOIRES D'ÉQUIPE
 *
 * POURQUOI
 * En karting junior, le pilote court en indépendant : ni écurie, ni
 * coéquipier. Des événements hors course, des événements en course et des
 * messages parlaient pourtant de « ton équipe », de « l'écurie », de
 * l'ingénieur ou du coéquipier (avec un nom de repli : « ton coéquipier »).
 *
 * CE QUE FAIT LE MODULE
 *   - Indépendant : rien qui suppose une écurie (équipe, écurie, team
 *     principal, direction sportive, ingénieur, bureau d'études).
 *   - Sans coéquipier (indépendant, ou seul pilote de son écurie au départ) :
 *     rien qui parle d'un coéquipier.
 *   Événements hors course : remplacés par un autre, compatible, au moment
 *   de la programmation et à l'ouverture. Événements de course : écartés
 *   (la course continue). Messages : ceux des rôles d'écurie (direction,
 *   ingénieur, bureau d'études) n'arrivent pas à un indépendant ; aucun ne
 *   parle d'un coéquipier qui n'existe pas. Les offres des écuries (agent)
 *   ne sont jamais touchées.
 *
 * Réversible : window._rj152Uninstall().
 * =================================================================== */
(function () {
  "use strict";

  var TAG = "[152-coherence]";
  var R_EQUIPE = /(é|e)curie|(é|e)quipe|team principal|directeur sportif|direction sportive|ing(é|e)nieur|bureau d'(é|e)tudes/i;
  var R_MATE = /co-?(é|e)quipi|(é|e)quipier/i;
  var R_TON = /\b(ton|ta|tes|votre|vos) (é|e)curie|\b(ton|ta|tes|votre|vos) (é|e)quipe|\b(ton|tes) ing(é|e)nieur|\b(ton|ta) team principal/i;
  var ROLES_ECURIE = { team_boss: 1, tp: 1, team: 1, ing_course: 1, dir_sport: 1, dir_tech: 1 };

  function sansEcurie() { return !window.G || !G.currentTeam || G.currentTeam === "Indépendant"; }
  function sansCoequipier() {
    if (sansEcurie()) return true;
    var lr = window.LIVE_RACE;
    if (lr && lr.drivers && lr.drivers.length && !lr.finished) return !lr.drivers.some(function (d) { return d && !d.isPlayer && d.team === G.currentTeam; });
    return !(G.rivals || []).some(function (r) { return r && r.team === G.currentTeam; });
  }
  function texte(o) {
    if (!o) return "";
    var bouts = [o.title, o.titre, o.desc, o.text, o.body, o.subject, o.phase];
    (o.choices || o.actions || []).forEach(function (c) { if (c) bouts.push(c.text, c.label, c.desc, c.msg, c.result); });
    return bouts.filter(function (x) { return typeof x === "string"; }).join(" ").replace(/<[^>]+>/g, " ");
  }
  function interdit(o) {
    var t = texte(o);
    return (sansEcurie() && R_EQUIPE.test(t)) || (sansCoequipier() && R_MATE.test(t));
  }

  /* --- Événements hors course ------------------------------------------- */
  function ctxEvenement() { return { rep: G.reputation || 0, cat: G.cat, budget: G.budget, saison: G.saison, semaine: G.semaine, age: G.age }; }
  function apercu(def) { try { return typeof def.gen === "function" ? def.gen(ctxEvenement()) : def; } catch (e) { return null; } }
  function compatibles() {
    if (typeof SCHEDULED_EVENTS === "undefined") return [];
    var n = ctxEvenement();
    return SCHEDULED_EVENTS.filter(function (d) {
      if (d.cats && Array.isArray(d.cats) && d.cats.indexOf(G.cat) < 0) return false;
      if (typeof d.weightFn === "function") { try { if (d.weightFn(n) <= 0) return false; } catch (e) { return false; } }
      var p = apercu(d); return p && !interdit(p);
    });
  }
  /* Rend l'entrée compatible ; renvoie vrai si elle a été changée. */
  function assainir(e) {
    if (!e || e.resolved || typeof SCHEDULED_EVENTS === "undefined") return false;
    var def = SCHEDULED_EVENTS.find(function (d) { return d.id === e.eventId; });
    var p = e.preview || (def && apercu(def));
    if (!p || !interdit(p)) return false;
    var C = compatibles(); if (!C.length) return false;
    var choix = C[Math.floor(Math.random() * C.length)];
    e.eventId = choix.id; e.preview = apercu(choix);
    return true;
  }

  /* --- Événements de course --------------------------------------------- */
  function vientDeLaFile() {
    try {
      while (RACE_STATE.events && RACE_STATE.events[CURRENT_EVT_IDX] && interdit(RACE_STATE.events[CURRENT_EVT_IDX])) RACE_STATE.events.splice(CURRENT_EVT_IDX, 1);
      return !!(RACE_STATE.events && RACE_STATE.events[CURRENT_EVT_IDX]);
    } catch (e) { return true; }
  }

  function installer() {
    if (typeof rjInscrire !== "function" || typeof window.openScheduledEvent !== "function" || typeof window.pushMail !== "function") return false;
    rjInscrire("openScheduledEvent", { id: "152-coherence:ouverture", ordre: -9000, remplace: function (args, suite) {
      try { assainir(args[0]); } catch (e) { console.warn(TAG, e && e.message); }
      return suite();
    } });
    if (typeof window.scheduleSeasonEvents === "function")
      rjInscrire("scheduleSeasonEvents", { id: "152-coherence:programme", apres: function () {
        try { (G._scheduledEvents || []).forEach(function (e) { if (e.saison === G.saison) assainir(e); }); } catch (e) {}
      } });
    if (typeof window.showLiveEvent === "function")
      rjInscrire("showLiveEvent", { id: "152-coherence:direct", ordre: -9000, remplace: function (args, suite) {
        if (interdit(args[0])) { try { if (window.LIVE_RACE) { LIVE_RACE.pendingEvent = null; LIVE_RACE.paused = false; } } catch (e) {} return; }
        return suite();
      } });
    if (typeof window.showNextRaceEvent === "function")
      rjInscrire("showNextRaceEvent", { id: "152-coherence:file", ordre: -9000, remplace: function (args, suite) {
        if (!vientDeLaFile()) { try { if (typeof _hideRaceEventModal === "function") _hideRaceEventModal(); if (window.LIVE_RACE) LIVE_RACE.paused = false; } catch (e) {} return; }
        return suite();
      } });
    rjInscrire("pushMail", { id: "152-coherence:messages", ordre: -9500, remplace: function (args, suite) {
      var m = args[0];
      if (m && sansEcurie() && (ROLES_ECURIE[m.role] || R_TON.test(texte(m)))) return null;
      if (m && sansCoequipier() && R_MATE.test(texte(m))) return null;
      return suite();
    } });
    window._rj152 = { interdit: interdit, assainir: assainir, sansEcurie: sansEcurie, sansCoequipier: sansCoequipier };
    window._rj152Uninstall = function () {
      ["openScheduledEvent", "scheduleSeasonEvents", "showLiveEvent", "showNextRaceEvent", "pushMail"].forEach(function (f) { rjDesinscrire(["152-coherence:"], f); });
    };
    console.log(TAG, "actif");
    return true;
  }

  (function boot() { var n = 0; (function tenter() { if (!installer() && n++ < 80) setTimeout(tenter, 150); })(); })();
})();
