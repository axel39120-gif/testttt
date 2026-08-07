/* =====================================================================
 * tests/socle.js — SOCLE DU HARNAIS DE TESTS
 *
 * Sert le jeu en local, ouvre un Chromium au format d'un iPhone, et
 * fournit les outils communs à toutes les suites : assertions, mesure
 * d'écrans, pilotage d'une course, répondeur automatique aux modales.
 *
 * Aucune dépendance en dehors de Playwright, déjà présent.
 * =================================================================== */

const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const RACINE = path.resolve(__dirname, "..");
const PORT = Number(process.env.RJ_PORT || 8123);
const VIEWPORT = { width: 430, height: 932 };   // iPhone 16 Pro Max

/* ------------------------------------------------------------------ *
 * Serveur statique minimal
 * ------------------------------------------------------------------ */

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json"
};

function servir() {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      let rel = decodeURIComponent(req.url.split("?")[0]);
      if (rel === "/") rel = "/index.html";
      const abs = path.join(RACINE, rel);
      if (!abs.startsWith(RACINE)) { res.writeHead(403); return res.end(); }
      fs.readFile(abs, (err, data) => {
        if (err) { res.writeHead(404); return res.end("introuvable"); }
        res.writeHead(200, {
          "Content-Type": MIME[path.extname(abs)] || "application/octet-stream",
          "Cache-Control": "no-store"
        });
        res.end(data);
      });
    });
    srv.on("error", reject);
    srv.listen(PORT, "127.0.0.1", () => resolve(srv));
  });
}

/* ------------------------------------------------------------------ *
 * Rapport
 * ------------------------------------------------------------------ */

const VERT = "\u001b[32m", ROUGE = "\u001b[31m", JAUNE = "\u001b[33m", GRIS = "\u001b[90m", RAZ = "\u001b[0m";

const rapport = { ok: 0, ko: 0, ignores: 0, echecs: [], suite: "" };

function suite(nom) {
  rapport.suite = nom;
  console.log("\n" + nom);
  console.log("-".repeat(nom.length));
}

function verifier(intitule, condition, detail) {
  if (condition) {
    rapport.ok++;
    console.log("  " + VERT + "ok" + RAZ + "   " + intitule + (detail ? GRIS + "  (" + detail + ")" + RAZ : ""));
  } else {
    rapport.ko++;
    rapport.echecs.push(rapport.suite + " › " + intitule + (detail ? " — " + detail : ""));
    console.log("  " + ROUGE + "ÉCHEC" + RAZ + " " + intitule + (detail ? ROUGE + "  " + detail + RAZ : ""));
  }
  return !!condition;
}

function ignorer(intitule, pourquoi) {
  rapport.ignores++;
  console.log("  " + JAUNE + "–" + RAZ + "    " + intitule + GRIS + "  (" + pourquoi + ")" + RAZ);
}

function conclusion() {
  const total = rapport.ok + rapport.ko;
  console.log("\n" + "=".repeat(46));
  console.log(`${rapport.ok}/${total} vérifications passées` +
              (rapport.ignores ? `, ${rapport.ignores} ignorée(s)` : ""));
  if (rapport.echecs.length) {
    console.log("\n" + ROUGE + "Échecs :" + RAZ);
    rapport.echecs.forEach(e => console.log("  · " + e));
  }
  console.log("=".repeat(46));
  return rapport.ko === 0;
}

/* ------------------------------------------------------------------ *
 * Navigateur
 * ------------------------------------------------------------------ */

async function ouvrirJeu(options) {
  options = options || {};
  const navigateur = await chromium.launch();
  const contexte = await navigateur.newContext({ serviceWorkers: "block", viewport: VIEWPORT });
  const page = await contexte.newPage();

  const journal = { erreurs: [], avertissements: [], messages: [] };
  page.on("pageerror", e => journal.erreurs.push("PAGEERROR: " + e.message.slice(0, 200)));
  page.on("console", m => {
    const t = m.text();
    if (/403|Failed to load resource|fonts\.googleapis/.test(t)) return;   // polices bloquées hors ligne
    if (m.type() === "error") journal.erreurs.push("CONSOLE: " + t.slice(0, 200));
    if (m.type() === "warning") journal.avertissements.push(t.slice(0, 160));
    journal.messages.push(t.slice(0, 200));
  });

  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(options.attente || 6500);

  if (options.charger !== false) {
    /* Le module de sauvegarde de test crée une partie au premier chargement :
       on la reprend, comme le ferait un joueur. */
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")]
        .find(e => (e.innerText || "").trim() === "Jouer");
      if (b) b.click();
    });
    await page.waitForTimeout(2500);
  }

  return { navigateur, contexte, page, journal };
}

/* Répond seul aux modales qui mettent la course en attente. */
async function repondeurAutomatique(page) {
  await page.evaluate(() => {
    if (window.__rjAuto) return;
    window.__rjAutoCompte = 0;
    window.__rjAuto = setInterval(() => {
      try {
        const ok = document.getElementById("rj47-outcome-ok");
        if (ok) { ok.click(); return; }
        const evt = document.getElementById("race-event-modal");
        if (evt && evt.style.display !== "none") {
          const b = evt.querySelector('[onclick*="resolveRaceEvt"]');
          if (b) { window.__rjAutoCompte++; b.click(); return; }
        }
        const live = document.getElementById("live-event-modal");
        if (live && live.style.display !== "none" && live.innerHTML.length > 200) {
          const b = live.querySelectorAll("button");
          if (b.length) { window.__rjAutoCompte++; b[0].click(); return; }
        }
      } catch (e) {}
    }, 20);
  });
}

/* ------------------------------------------------------------------ *
 * Outils de mesure et de pilotage
 * ------------------------------------------------------------------ */

/* Hauteur du contenu rapportée à la fenêtre, pour un écran donné. */
async function mesurerEcran(page, id, avant) {
  return page.evaluate(async ({ id, avant }) => {
    try { window.navTo(id, null); if (avant) eval(avant); } catch (e) { return null; }
    await new Promise(r => setTimeout(r, 450));
    const scr = document.getElementById(id);
    if (!scr || !scr.classList.contains("on")) return null;
    const sc = scr.querySelector(".scroll") || scr;
    /* Point de départ : le conteneur de défilement de l'écran. On cherche
       ensuite s'il existe un conteneur interne qui déborde davantage. */
    let pire = { h: sc.scrollHeight, v: sc.clientHeight || 831 };
    [scr, ...scr.querySelectorAll("*")].forEach(e => {
      const h = e.scrollHeight, v = e.clientHeight;
      if (v > 200 && h > v + 15 && (h / v) > (pire.h / Math.max(1, pire.v))) pire = { h, v };
    });
    const v = pire.v || 831;
    return { h: pire.h, v, pages: +(pire.h / Math.max(1, v)).toFixed(2) };
  }, { id, avant });
}

/* Prépare un Grand Prix et le déroule jusqu'au drapeau. */
async function courirUneCourse(page, options) {
  options = options || {};
  return page.evaluate(async (o) => {
    const journal = { anomalies: [] };
    try {
      SETTINGS.simSpeed = "instant";
      G.cat = o.categorie;
      if (o.equipe) G.currentTeam = o.equipe;
      if (o.reinitialiserRivaux !== false && typeof initRivals === "function") initRivals();

      window.CAL_RACES = [];
      buildCalendar();
      G.semaine = 6; G.seasonOver = false;
      CAL_RACES.forEach(c => { c.done = c.week < 6; c.result = null; });

      const course = getNextRace();
      if (!course) { journal.anomalies.push("calendrier vide"); return journal; }
      RACE_STATE.circuit = course.name;
      RACE_STATE.circuitData = getCircuitData(course.name);
      RACE_STATE.weather = generateWeather((RACE_STATE.circuitData && RACE_STATE.circuitData.rain) || 0);
      RACE_STATE.qualiPos = o.grille || (1 + Math.floor(Math.random() * 8));
      G.totalLaps = (typeof getCatLaps === "function" ? getCatLaps(o.categorie) : 0) || 20;

      delete G._raceStrategy;
      G.raceStrategy = G.raceStrategy || {};
      G.raceStrategy.tyreCompound = "medium";
      G.raceStrategy.plannedStops = 1;
      G.raceStrategy.preset = "manage";

      if (window.LIVE_RACE && LIVE_RACE.interval) clearInterval(LIVE_RACE.interval);
      window.LIVE_RACE = { drivers: [], cur: 0, total: 0, finished: false, paused: false, interval: null };
      const coursesAvant = (G.races || []).length;

      if (typeof confirmStrategy === "function") { try { confirmStrategy(); } catch (e) {} }
      if (!LIVE_RACE.total) runRaceLive();
      if (!LIVE_RACE.drivers.length) { journal.anomalies.push("grille vide"); return journal; }

      /* Plusieurs modules d'identité (endurance, IndyCar) s'installent par
         un timer de 400 ms après le départ. En vitesse instantanée la course
         se termine avant qu'ils n'aient tourné : on leur laisse un tour
         d'horloge, sinon le test mesurerait une absence qui n'existe pas en
         conditions réelles. */
      await new Promise(r => setTimeout(r, o.attenteDemarrage || 700));

      const joueur = () => LIVE_RACE.drivers.find(d => d.isPlayer);
      try {
        var cfgPit = (typeof _pitConfigForCat === "function") ? _pitConfigForCat() : null;
        journal.arretsPrevus = !!(cfgPit && cfgPit.enabled && cfgPit.maxStops > 0);
      } catch (e) { journal.arretsPrevus = false; }
      journal.grille = (joueur() || {}).pos;
      journal.plateau = LIVE_RACE.drivers.length;
      journal.trafic = LIVE_RACE.drivers.filter(d => d._mc).length;

      /* Mesure depuis l'intérieur : on s'inscrit au registre de tour du jeu
         plutôt que d'échantillonner de l'extérieur. En vitesse instantanée
         un tour dure quelques millisecondes et l'échantillonnage en ratait
         jusqu'à vingt sur une course, ce qui faussait la mesure des sauts. */
      const mesure = { sautMax: 0, doublons: 0, ecartsNegatifs: 0, usureMax: 0, precedente: journal.grille, tours: 0 };
      if (!Array.isArray(window.RJ_LAP_HOOKS)) window.RJ_LAP_HOOKS = [];
      const sonde = {
        id: "__test_mesure",
        run: function () {
          const p = joueur();
          if (!p) return;
          mesure.tours++;
          if (!p.dnf) {
            /* Le registre n'est déclenché que lorsque le classement est
               recalculé : si un tour passe sans recalcul (course en pause,
               neutralisation), l'écart observé couvre plusieurs tours et
               n'est pas un bond. On ne mesure donc que les tours
               effectivement consécutifs. */
            const consecutif = (mesure.dernierTour !== undefined) &&
                               (LIVE_RACE.cur === mesure.dernierTour + 1);
            if (consecutif) {
              const saut = Math.abs(p.pos - mesure.precedente);
              if (saut > mesure.sautMax) mesure.sautMax = saut;
            } else if (mesure.dernierTour !== undefined) {
              mesure.toursNonConsecutifs = (mesure.toursNonConsecutifs || 0) + 1;
            }
            mesure.dernierTour = LIVE_RACE.cur;
            mesure.precedente = p.pos;
          }
          const vivants = LIVE_RACE.drivers.filter(d => !d.dnf);
          if (new Set(vivants.map(d => d.pos)).size !== vivants.length) mesure.doublons++;
          vivants.forEach(d => {
            if (typeof d.gap === "number" && d.gap < 0) mesure.ecartsNegatifs++;
            if ((d._tyreWearAccum || 0) > mesure.usureMax) mesure.usureMax = d._tyreWearAccum || 0;
          });
        }
      };
      window.RJ_LAP_HOOKS.push(sonde);

      let sautMax = 0, doublons = 0, ecartsNegatifs = 0, usureMax = 0;
      let precedente = journal.grille, tour = 0, garde = 0;

      while (!LIVE_RACE.finished && garde++ < 3000) {
        await new Promise(r => setTimeout(r, 15));
        const p = joueur();
        if (!p) break;
        if (LIVE_RACE.cur !== tour) {
          const avanceDe = LIVE_RACE.cur - tour;
          tour = LIVE_RACE.cur;
          if (!p.dnf) {
            /* En vitesse instantanée un tour dure une vingtaine de
               millisecondes : l'échantillonnage peut en manquer. Ne mesurer
               le saut que sur un tour effectivement consécutif, sinon on
               additionne plusieurs tours et l'on croit à un bond. */
            if (avanceDe === 1) {
              const saut = Math.abs(p.pos - precedente);
              if (saut > sautMax) sautMax = saut;
            } else {
              journal.toursManques = (journal.toursManques || 0) + (avanceDe - 1);
            }
            precedente = p.pos;
          }
          const vivants = LIVE_RACE.drivers.filter(d => !d.dnf);
          if (new Set(vivants.map(d => d.pos)).size !== vivants.length) doublons++;
          vivants.forEach(d => {
            if (typeof d.gap === "number" && d.gap < 0) ecartsNegatifs++;
            if ((d._tyreWearAccum || 0) > usureMax) usureMax = d._tyreWearAccum || 0;
          });
        }
      }

      /* On retire la sonde et on retient ses relevés, plus fiables. */
      const iSonde = window.RJ_LAP_HOOKS.indexOf(sonde);
      if (iSonde >= 0) window.RJ_LAP_HOOKS.splice(iSonde, 1);
      if (mesure.tours > 0) {
        sautMax = mesure.sautMax;
        doublons = mesure.doublons;
        ecartsNegatifs = mesure.ecartsNegatifs;
        usureMax = mesure.usureMax;
        journal.toursMesures = mesure.tours;
        journal.toursNonConsecutifs = mesure.toursNonConsecutifs || 0;
      }

      journal.terminee = !!LIVE_RACE.finished;
      if (!journal.terminee) {
        journal.bloqueeA = LIVE_RACE.cur + "/" + LIVE_RACE.total;
        if (LIVE_RACE.interval) clearInterval(LIVE_RACE.interval);
      }
      for (let i = 0; i < 40 && (G.races || []).length === coursesAvant; i++) {
        await new Promise(r => setTimeout(r, 60));
      }

      const p = joueur();
      const res = (G.races || []).length > coursesAvant ? (G.races || [])[(G.races || []).length - 1] : null;
      journal.arrivee = p ? p.pos : null;
      journal.abandon = p ? !!p.dnf : null;
      journal.tours = LIVE_RACE.total;
      journal.sautMax = sautMax;
      journal.doublons = doublons;
      journal.ecartsNegatifs = ecartsNegatifs;
      journal.usureMax = usureMax;
      journal.arretsRivaux = LIVE_RACE.drivers.filter(d => !d.isPlayer && !d._mc && (d._pitsDone || 0) > 0).length;
      journal.rivaux = LIVE_RACE.drivers.filter(d => !d.isPlayer && !d._mc).length;
      journal.resultat = res ? { pos: res.pos, pts: res.pts } : null;
    } catch (e) {
      journal.anomalies.push("exception : " + (e && e.message ? e.message.slice(0, 120) : e));
    }
    return journal;
  }, options);
}

module.exports = {
  PORT, RACINE, VIEWPORT,
  servir, ouvrirJeu, repondeurAutomatique,
  suite, verifier, ignorer, conclusion, rapport,
  mesurerEcran, courirUneCourse
};
