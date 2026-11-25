/* =====================================================================
 * 175-sprint.js — SPRINT OU COURSE PRINCIPALE, ÇA SE VOIT
 *
 * POURQUOI
 * Rien ne disait, au moment du départ, si l'on courait le sprint ou la course
 * principale : même onglet « Course », même bouton, même écran.
 *
 * CE QUE FAIT LE MODULE
 * Les jours de week-end à sprint : une pastille dans l'en-tête (« Week-end
 * sprint », puis « Sprint 1/2 » et « Course 2/2 »), l'onglet et
 * le bouton de départ au nom de la manche, et la mention sur l'accueil. La vue
 * circuit (111), la grille (159) et le calendrier (18) lisent RJSprint.
 *
 * Réversible : window._rj175Uninstall().
 * =================================================================== */
(function () {
  "use strict";
  var ID = "175-sprint";

  function estSprint(r) { try { return !!_isSprintWeekendForRace(r); } catch (e) { return false; } }
  /* La saison mélange-t-elle les deux formats ? */
  function melange() { var C = window.CAL_RACES || [], n = C.filter(estSprint).length; return n > 0 && n < C.length; }
  /* La manche courue ou à courir : "sprint", "course" (seconde course d'un week-end à sprint) ou "" (week-end classique). */
  function manche() {
    var lr = window.LIVE_RACE, enCourse = lr && lr.drivers && lr.drivers.length && !lr.finished, w = window.RACE_WEEKEND_STATE || {};
    if (enCourse && lr._isSprintMode) return "sprint";
    if (!estSprint(getNextRace())) return "";
    if (enCourse) return "course";
    return w.sprintDone ? "course" : "sprint";
  }
  function libelle() { var m = manche(); return m === "sprint" ? "Sprint" : m === "course" ? "Course principale" : ""; }

  function poser() {
    var titre = document.getElementById("race-title");
    var resultat = window.G && G.racePhase === "result", m = resultat ? "" : manche(), w = window.RACE_WEEKEND_STATE || {};
    var onglet = document.querySelector("#S-race .tab.on"), k = onglet && onglet.getAttribute("data-tab");
    var tab = document.getElementById("race-tab-course");
    if (tab) { var t = m === "sprint" ? "Sprint" : "Course"; if (tab.textContent.trim().replace(/\s*✓$/, "") !== t) tab.textContent = t; }
    var b = document.getElementById("race-btn");
    if (b && !b.disabled && /^\s*Départ/.test(b.textContent)) { var d = m === "sprint" ? "Départ du sprint !" : m === "course" ? "Départ de la course !" : "Départ !"; if (b.textContent !== d) b.textContent = d; }
    if (!titre) return;
    if (!m) { titre.removeAttribute("data-rj175"); return; }
    var gp = G.cat === "Formule 1" && !w.qualifDone && w.essaisDone;
    var texte = m === "course" ? (gp && !(window.LIVE_RACE && LIVE_RACE.interval) ? "Qualif GP" : "Course 2/2") : gp && k === "qualif" ? "Qualif SQ" : k === "course" || k === "res" || w.qualifDone ? "Sprint 1/2" : "Sprint";
    titre.setAttribute("data-rj175", texte); titre.setAttribute("data-rj175-m", m);   // pastille en CSS : le titre est réécrit à chaque rendu
  }
  function accueil() {
    var h = document.getElementById("h-race-s");
    if (h && estSprint(getNextRace()) && !/sprint/i.test(h.textContent)) h.textContent += " · Week-end sprint";
  }

  function boot() {
    if (typeof rjInscrire !== "function" || typeof getNextRace !== "function" || !Array.isArray(window.RJ_RACE_TAB_HOOKS) || !Array.isArray(window.RJ_RACE_START_HOOKS) || !Array.isArray(window.RJ_RESULT_HOOKS)) return setTimeout(boot, 120);
    var sur = function () { try { poser(); } catch (e) { console.warn("[175-sprint]", e && e.message); } };
    window.RJ_RACE_TAB_HOOKS.push({ id: ID, apres: function () { sur(); setTimeout(sur, 60); } });
    window.RJ_RACE_START_HOOKS.push({ id: ID, apres: sur });
    window.RJ_RESULT_HOOKS.push({ id: ID, apres: sur });
    if (typeof updateUI === "function") rjInscrire("updateUI", { id: ID, apres: function () { try { accueil(); } catch (e) {} sur(); } });
    if (typeof getPracticeMaxSessions === "function") rjInscrire("getPracticeMaxSessions", { id: ID, ordre: -9500, remplace: function (args, suite) { return G.cat === "Formule 1" && estSprint(getNextRace()) ? 1 : suite(); } });   // F1 : une seule séance d'essais
    window.RJSprint = { est: estSprint, melange: melange, manche: manche, libelle: libelle, poser: poser, accueil: accueil };
    window._rj175Uninstall = function () {
      ["RJ_RACE_TAB_HOOKS", "RJ_RACE_START_HOOKS", "RJ_RESULT_HOOKS"].forEach(function (k) { window[k] = window[k].filter(function (h) { return !h || h.id !== ID; }); });
      rjDesinscrire([ID], "updateUI"); rjDesinscrire([ID], "getPracticeMaxSessions"); delete window.RJSprint;
    };
    console.log("[175-sprint] actif");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
