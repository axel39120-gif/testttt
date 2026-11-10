/* =====================================================================
 * tests/joueur-auto.js — UN JOUEUR AUTOMATIQUE QUI JOUE DES SAISONS ENTIÈRES
 *
 * Il suit le vrai déroulé du jeu : avancer depuis l'accueil, répondre aux
 * événements et aux journées médias, disputer les week-ends (sprint compris),
 * passer la fin de saison et le mercato, puis repartir. À chaque course et à
 * chaque changement de saison, il vérifie que l'état reste cohérent.
 *
 * C'est ce parcours qui a révélé la fin de saison bloquée (v258) : aucun
 * autre test ne jouait une saison jusqu'au bout.
 *
 * jouerSaisons(page, { saisons, depart, tours, maxIterations })
 *   depart : "neuf" (karting junior, débutant) ou une catégorie ; absent =
 *            la partie chargée telle quelle.
 *   Les essais et les qualifications sont sautés (grille tirée par le jeu) :
 *   ils sont vérifiés à part, par les suites essais et qualifications.
 * Renvoie { courses, sprints, saisonsFaites, anomalies[], journal[], etat }.
 * =================================================================== */
"use strict";

async function jouerSaisons(page, options) {
  options = Object.assign({ saisons: 1, depart: "", tours: 5, maxIterations: 4000 }, options || {});
  return page.evaluate(async (o) => {
    const dormir = ms => new Promise(r => setTimeout(r, ms));
    const journal = [], anomalies = [];
    const note = t => { if (anomalies.length < 80) anomalies.push("S" + G.saison + "/s" + G.semaine + " [" + G.cat + "] " + t); };
    SETTINGS.simSpeed = "instant";

    if (o.depart === "neuf") {
      G.cat = "Karting Junior"; G.currentTeam = "Indépendant"; G._seasonTeam = "Indépendant"; G._playerRole = "num2";
      G.substats = initSubStats((G.pilot && G.pilot.style) || "complet", (G.pilot && G.pilot.trait) || "analyste"); computeLegacyStats();
      G.age = 12; if (G.pilot && G.pilot.dob && G.gameYear) G.pilot.dob.year = G.gameYear - 12;
      G.rep = { medias: 5, public: 5, recruteurs: 5, paddock: 5 }; if (typeof recomputeGlobalRep === "function") recomputeGlobalRep();
      G.budget = 150000; G.revenue = 0; G.pendingTransfer = null; G.offers = []; G.contractDur = 0; G._baquets = null;
    } else if (o.depart) {
      G.cat = o.depart; G.pendingTransfer = null; G.offers = []; G._baquets = null;
      const eq = (typeof TEAM_OFFERS !== "undefined" && TEAM_OFFERS[o.depart] || [])[3];
      G.currentTeam = eq ? eq.team : "Indépendant"; G._seasonTeam = G.currentTeam; G._playerRole = "num2"; G.contractDur = 1;
    }
    if (o.depart) {
      initRivals(); window.CAL_RACES = []; buildCalendar(); G.semaine = 1; G.champPts = 0; G.races = []; G.seasonOver = false;
      G._scheduledEvents = []; try { scheduleSeasonEvents(); } catch (e) {}
    }

    const visible = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden" && getComputedStyle(el).display !== "none";
    const place = () => [{ p: G.champPts, m: 1 }].concat(G.rivals.map(x => ({ p: x.pts || 0 }))).sort((a, b) => b.p - a.p).findIndex(x => x.m) + 1;

    function repondreModale() {
      for (const s of ["#custom-confirm-yes", "#rj47-outcome-ok", "#rj106-ok"]) { const b = document.querySelector(s); if (visible(b)) { b.click(); return true; } }
      const choix = [...document.querySelectorAll(".event-choice, [onclick*='resolveEventChoice']")].filter(visible)[0];
      if (choix) { choix.click(); return true; }
      const fenetres = [...document.querySelectorAll("div")].filter(d => { const cs = getComputedStyle(d); return cs.position === "fixed" && (+cs.zIndex >= 100 || /overlay|modal/i.test(d.id + " " + d.className)) && visible(d) && d.querySelector("button"); });
      for (const f of fenetres) {
        const bs = [...f.querySelectorAll("button")].filter(visible);
        const b = bs.filter(x => !/annuler|fermer|plus tard|refuser|non\b/i.test(x.innerText || ""))[0] || bs[0];
        if (b) { b.click(); return true; }
      }
      return false;
    }

    let iter = 0, saisonsFaites = 0, courses = 0, sprints = 0, surAccueil = 0;
    let saisonCourante = G.saison, semainePrec = G.semaine;
    while (iter++ < o.maxIterations && saisonsFaites < o.saisons) {
      await dormir(40);
      if (repondreModale()) { await dormir(80); continue; }
      const ecran = (document.querySelector(".scr.on") || {}).id || "?";
      if (G.saison === saisonCourante && G.semaine < semainePrec) note("la semaine recule " + semainePrec + " → " + G.semaine);
      semainePrec = G.semaine;
      try {
        if (ecran === "S-home") {
          advanceToNextMoment(); await dormir(450);   // le jeu ignore un second appel dans les 400 ms
          if ((document.querySelector(".scr.on") || {}).id === "S-home" && !repondreModale()) {
            if (++surAccueil >= 10) { const nm = getNextMoment(); note("bloqué sur l'accueil (prochain moment : " + (nm ? nm.type + " " + ((nm.data && (nm.data.name || nm.data.eventId)) || "") + " s" + nm.week : "aucun") + ")"); break; }
          } else surAccueil = 0;
        } else if (ecran === "S-race") {
          surAccueil = 0;
          if (RACE_WEEKEND_STATE.courseDone) { advanceToNextMoment(); await dormir(450); continue; }
          const c = getNextRace();
          if (!c) { note("week-end sans course à venir"); advanceToNextMoment(); await dormir(450); continue; }
          RACE_WEEKEND_STATE.essaisDone = true;
          if (!RACE_WEEKEND_STATE.qualifDone) {
            RACE_WEEKEND_STATE.qualifDone = true; if (!RACE_STATE.qualiPos) RACE_STATE.qualiPos = 1 + Math.floor(Math.random() * 12);
          }
          RACE_STATE.circuit = c.name; RACE_STATE.circuitData = getCircuitData(c.name);
          RACE_STATE.weather = RACE_STATE.weather || generateWeather((RACE_STATE.circuitData || {}).rain || 0);
          G.totalLaps = Math.min(G.totalLaps || 20, o.tours);
          window.LIVE_RACE = { drivers: [], cur: 0, total: 0, finished: false, paused: false, interval: null };
          const avant = { courses: G.races.length, faites: CAL_RACES.filter(x => x.done).length };
          try { confirmStrategy(); } catch (e) {}
          if (!LIVE_RACE.total) runRaceLive();
          for (let i = 0; i < 800 && !LIVE_RACE.finished; i++) { repondreModale(); await dormir(25); }
          if (!LIVE_RACE.finished) { note("course bloquée à " + LIVE_RACE.cur + "/" + LIVE_RACE.total); break; }
          for (let i = 0; i < 60 && G.races.length === avant.courses && !RACE_WEEKEND_STATE.sprintDone; i++) { repondreModale(); await dormir(60); }
          if (RACE_WEEKEND_STATE.sprintDone && !RACE_WEEKEND_STATE.courseDone && G.races.length === avant.courses) { sprints++; continue; }   // on enchaîne la course principale
          for (let i = 0; i < 60 && G.races.length === avant.courses; i++) { repondreModale(); await dormir(80); }
          courses++; console.log("[JA] S" + G.saison + " " + G.cat + " manche " + G.races.length + "/" + CAL_RACES.length + " P" + ((G.races[G.races.length - 1] || {}).pos));
          const vivants = LIVE_RACE.drivers.filter(d => !d._mc && !d.dnf).map(d => d.pos);
          if (new Set(vivants).size !== vivants.length) note("positions en double à l'arrivée");
          if (G.races.length !== avant.courses + 1) note("la manche n'est pas enregistrée (" + avant.courses + " → " + G.races.length + ")");
          if (CAL_RACES.filter(x => x.done).length !== avant.faites + 1) note("le calendrier n'avance pas d'une manche");
          if (!isFinite(G.budget)) note("budget non fini");
          ["medias", "public", "recruteurs", "paddock"].forEach(k => { const v = (G.rep || {})[k]; if (!(v >= 0 && v <= 100)) note("réputation " + k + " hors bornes : " + v); });
          Object.keys(G.substats || {}).forEach(k => { const v = G.substats[k]; if (!(v >= 0 && v <= 100)) note("sous-statistique " + k + " hors bornes : " + v); });
          advanceToNextMoment(); await dormir(450);
        } else if (ecran === "S-reserve") {
          const b = [...document.querySelectorAll("#S-reserve [data-rj79]")].filter(visible)[0];
          if (b) b.click(); else navTo("S-home", null);
          await dormir(150);
        } else if (ecran === "S-season-end") {
          if (!G.seasonOver) note("fin de saison affichée alors que la saison n'est pas terminée");
          const restantes = CAL_RACES.filter(x => !x.done).length; if (restantes) note(restantes + " manche(s) jamais disputée(s)");
          journal.push("fin S" + G.saison + " : " + G.cat + " · " + G.currentTeam + " · P" + place() + " · " + G.champPts + " pts · " + G.races.length + "/" + CAL_RACES.length + " manches · âge " + G.age + " · offres : " + ((G.offers || []).map(x => x.team + "/" + x.cat).join(", ") || "aucune"));
          if (typeof _rj70Transferts === "function") _rj70Transferts(); else navTo("S-transfer", null);
          await dormir(400);
        } else if (ecran === "S-transfer") {
          const saisonAvant = G.saison, ageAvant = G.age;
          const boutons = [...document.querySelectorAll("#tr-offers-list button")].filter(visible);
          const b = boutons.find(x => /promotion|↑|↔/i.test((x.closest("#tr-offers-list > div") || x).innerText || "")) || boutons[0];   // on monte dès qu'on le peut
          if (!b) { note("mercato sans aucun choix"); break; }
          b.click(); await dormir(800);
          if (G.saison === saisonAvant) { note("le mercato n'a pas lancé la saison suivante"); break; }
          saisonsFaites++; saisonCourante = G.saison; semainePrec = G.semaine;
          if (G.age !== ageAvant + 1) note("âge " + ageAvant + " → " + G.age + " au changement de saison");
          if (G.champPts !== 0 || G.races.length !== 0) note("compteurs de championnat non remis à zéro");
          if (!CAL_RACES.length) note("calendrier vide");
          if (!G.rivals.length) note("grille vide");
          if (!/^Karting/.test(G.cat) && G.rivals.some(x => !x.team)) note("des rivaux sans écurie");
          if (G.rivals.some(x => x.pts)) note("des rivaux gardent leurs points de la saison passée");
          console.log("[JA] nouvelle saison " + G.saison + " en " + G.cat);
          journal.push("début S" + G.saison + " : " + G.cat + " · " + G.currentTeam + " · rôle " + G._playerRole + " · " + G.rivals.length + " rivaux · " + CAL_RACES.length + " manches");
        } else {
          const tous = [...document.querySelectorAll("#" + ecran + " button")].filter(visible);
          const suite = tous.find(x => /question suivante|terminer|valider|continuer|^\s*retour\s*$/i.test(x.innerText || ""));
          const b = suite || tous.filter(x => !/retour|annuler/i.test(x.innerText || "") && !/^\s*‹/.test(x.innerText || "") && !/navTo\(.S-home/.test(x.getAttribute("onclick") || ""))[0];
          if (b) b.click(); else navTo("S-home", null);
          await dormir(200);
        }
      } catch (e) { note("exception : " + (e && e.message)); await dormir(100); }
    }
    if (saisonsFaites < o.saisons && !anomalies.length) note("arrêt avant la fin (" + iter + " itérations)");
    return { courses, sprints, saisonsFaites, anomalies, journal,
      etat: { saison: G.saison, cat: G.cat, equipe: G.currentTeam, age: G.age, budget: Math.round(G.budget), reputation: G.reputation } };
  }, options);
}

module.exports = { jouerSaisons };
