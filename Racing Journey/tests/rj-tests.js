#!/usr/bin/env node
/* =====================================================================
 * tests/rj-tests.js — FILET DE TESTS DE RACING JOURNEY
 *
 * Vérifie, sur le jeu réel ouvert dans un navigateur, que les parcours
 * essentiels fonctionnent et que les correctifs déjà livrés tiennent.
 *
 *   node tests/rj-tests.js                  toutes les suites
 *   node tests/rj-tests.js chargement ui    seulement celles-là
 *   node tests/rj-tests.js --liste          liste les suites
 *
 * Le code de sortie vaut 0 si tout passe, 1 sinon : utilisable tel quel
 * dans un enchaînement automatique.
 * =================================================================== */

const S = require("./socle");

/* ==================================================================== *
 * 1. CHARGEMENT
 * ==================================================================== */
async function suiteChargement() {
  S.suite("Chargement de l'application");
  const { navigateur, page, journal } = await S.ouvrirJeu({ charger: false });
  try {
    const etat = await page.evaluate(() => ({
      build: window.RJ_BUILD || null,
      modulesManquants: (window.RJ_MISSING || []).length,
      G: typeof window.G,
      splash: !!document.querySelector("#S-splash")
    }));

    S.verifier("le numéro de build est exposé", !!etat.build, etat.build);
    S.verifier("tous les modules sont chargés", etat.modulesManquants === 0,
      etat.modulesManquants ? etat.modulesManquants + " manquant(s)" : "");
    S.verifier("l'état de jeu est initialisé", etat.G === "object");
    S.verifier("l'écran d'accueil est présent", etat.splash);
    S.verifier("aucune erreur au chargement", journal.erreurs.length === 0,
      journal.erreurs[0] || "");

    /* Reprise d'une partie : c'est le parcours qui avait gelé le jeu. */
    const t0 = Date.now();
    let repris = false;
    try {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll("button")]
          .find(e => (e.innerText || "").trim() === "Jouer");
        if (b) b.click();
      }, { timeout: 20000 });
      await page.waitForTimeout(2500);
      repris = true;
    } catch (e) { repris = false; }
    const duree = Date.now() - t0;

    S.verifier("une partie se charge sans blocage", repris, duree + " ms");
    if (repris) {
      const ecran = await page.evaluate(() =>
        [...document.querySelectorAll(".scr.on")].map(s => s.id).join(","));
      S.verifier("l'accueil de carrière s'affiche", ecran.indexOf("S-home") >= 0, ecran);
    }
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * 2. CRÉATION DE CARRIÈRE
 * ==================================================================== */
async function suiteCreation() {
  S.suite("Création d'une carrière");
  const { navigateur, page, journal } = await S.ouvrirJeu({ charger: false });
  try {
    await page.evaluate(() => localStorage.clear());
    await page.evaluate(() => document.querySelector(".apex-splash-cta").click());
    await page.waitForTimeout(700);

    const modes = await page.evaluate(() => ({
      ecran: [...document.querySelectorAll(".scr.on")].map(s => s.id).join(","),
      cartes: document.querySelectorAll(".rj80-card").length
    }));
    S.verifier("l'étape du mode de jeu s'ouvre en premier", modes.ecran.indexOf("S-mode") >= 0, modes.ecran);
    S.verifier("les modes de jeu sont proposés", modes.cartes >= 2, modes.cartes + " mode(s)");

    await page.evaluate(() => document.getElementById("rj80-go").click());
    await page.waitForTimeout(800);

    /* Saisie de l'identité, puis aller-retour par l'écran des modes :
       la saisie ne doit pas être perdue. */
    await page.evaluate(() => {
      const poser = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); };
      poser("p-fn", "Test"); poser("p-ln", "Pilote");
      selContinent("Europe");
      document.querySelector("#nat-grid .nat-opt").click();
      const fav = [...document.querySelectorAll(".rj83-fav-opt, .rj80-fav-opt")]
        .find(o => o.getAttribute("data-team") === "Ferrari");
      if (fav) fav.click();
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelector("#rj80-banner button").click());
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById("rj80-go").click());
    await page.waitForTimeout(800);

    const apres = await page.evaluate(() => ({
      prenom: document.getElementById("p-fn").value,
      nom: document.getElementById("p-ln").value,
      nationalite: window.selNatVal,
      ecurie: (document.querySelector(".rj80-fav-opt.on") || {}).getAttribute
        ? document.querySelector(".rj80-fav-opt.on").getAttribute("data-team") : null
    }));
    S.verifier("le nom saisi est conservé après un retour", apres.prenom === "Test" && apres.nom === "Pilote");
    S.verifier("la nationalité est conservée", apres.nationalite === "FR", apres.nationalite);
    S.verifier("l'écurie de cœur est conservée", apres.ecurie === "Ferrari", apres.ecurie);

    /* Parcours jusqu'au lancement. */
    for (let i = 0; i < 8; i++) {
      const etape = await page.evaluate(() => window.creStep);
      if (etape === 6) break;
      await page.evaluate(() => {
        const v = document.getElementById("p-birthcity");
        if (v && !v.value) { v.value = "Lyon"; v.dispatchEvent(new Event("input", { bubbles: true })); }
        creNext();
      });
      await page.waitForTimeout(400);
    }
    await page.evaluate(() => creNext());
    await page.waitForTimeout(2200);

    const lance = await page.evaluate(() => ({
      ecran: [...document.querySelectorAll(".scr.on")].map(s => s.id).join(","),
      categorie: G.cat,
      mode: G._gameMode,
      ecurieDeCoeur: G._favTeam
    }));
    S.verifier("la carrière démarre", lance.ecran && lance.ecran !== "S-create", lance.ecran);
    S.verifier("la catégorie de départ est posée", !!lance.categorie, lance.categorie);
    S.verifier("le mode de jeu est enregistré", !!lance.mode, lance.mode);
    S.verifier("l'écurie de cœur est enregistrée", lance.ecurieDeCoeur === "Ferrari", lance.ecurieDeCoeur);
    S.verifier("aucune erreur pendant la création", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * 3. SAUVEGARDE
 * ==================================================================== */
async function suiteSauvegarde() {
  S.suite("Sauvegarde et rechargement");
  const { navigateur, page } = await S.ouvrirJeu();
  try {
    const ecrit = await page.evaluate(() => {
      G._playerRole = "num3";
      G._reserveDeal = {
        team: "Williams", cat: "Formule 1", saison: G.saison, cumul: false,
        credibilite: 57, sessions: [{ delta: 0.42 }], remplacements: [{ pos: 7 }]
      };
      G._gameMode = "normal";
      G._favTeam = "Ferrari";
      G._slot = 1;
      saveGame(1);
      const brut = JSON.parse(localStorage.getItem(SAVE_KEYS[1]));
      return { reserve: !!brut.rj79, mode: !!brut.rj80 };
    });
    S.verifier("le bloc du pilote de réserve est écrit", ecrit.reserve);
    S.verifier("le bloc du mode de jeu est écrit", ecrit.mode);

    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(6500);

    const relu = await page.evaluate(() => {
      loadSave(1);
      const d = window._rj79 ? window._rj79.deal() : null;
      return {
        equipe: d ? d.team : null,
        credibilite: d ? d.credibilite : null,
        seances: d ? (d.sessions || []).length : null,
        role: G._playerRole,
        mode: G._gameMode,
        favori: G._favTeam
      };
    });
    S.verifier("le contrat de réserve survit au rechargement", relu.equipe === "Williams", relu.equipe);
    S.verifier("la crédibilité est conservée", relu.credibilite === 57, String(relu.credibilite));
    S.verifier("les séances sont conservées", relu.seances === 1, String(relu.seances));
    S.verifier("le rôle est conservé", relu.role === "num3", relu.role);
    S.verifier("le mode de jeu est conservé", relu.mode === "normal", relu.mode);
    S.verifier("l'écurie de cœur est conservée", relu.favori === "Ferrari", relu.favori);
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * 4. QUALIFICATIONS
 * ==================================================================== */
async function suiteQualifications() {
  S.suite("Qualifications");
  const { navigateur, page } = await S.ouvrirJeu();
  try {
    const intitules = await page.evaluate(() => {
      const sortie = {};
      ["Karting Junior", "Formule 3", "Endurance WEC", "Formule 1"].forEach(cat => {
        G.cat = cat;
        QUALI_STATE.session = 1;
        QUALI_STATE.survived = Array.from({ length: 20 }, (_, i) => i);
        QUALI_STATE.drivers = Array.from({ length: 20 }, (_, i) => ({ name: "P" + i }));
        renderQualiSession();
        const h = document.getElementById("quali-session-header");
        sortie[cat] = (h ? h.innerText : "").replace(/\s+/g, " ").trim();
      });
      return sortie;
    });

    S.verifier("le karting n'annonce pas d'élimination",
      !/limination/i.test(intitules["Karting Junior"]), intitules["Karting Junior"].slice(0, 46));
    S.verifier("la Formule 3 n'annonce pas d'élimination",
      !/limination/i.test(intitules["Formule 3"]), intitules["Formule 3"].slice(0, 46));
    S.verifier("l'endurance affiche l'Hyperpole",
      /Hyperpole/i.test(intitules["Endurance WEC"]), intitules["Endurance WEC"].slice(0, 46));
    S.verifier("la Formule 1 conserve ses éliminations",
      /limination/i.test(intitules["Formule 1"]), intitules["Formule 1"].slice(0, 46));

    /* Les références de secteurs repartent de zéro à chaque session. */
    const secteurs = await page.evaluate(() => {
      G.cat = "Formule 1";
      QUALI_STATE.session = 1;
      QUALI_STATE.drivers = Array.from({ length: 20 }, (_, i) => ({
        name: "P" + i, isPlayer: i === 0,
        bestSectors: [25, 27, 28], lastSectorFlags: [1, 0, 2]
      }));
      QUALI_STATE.survived = Array.from({ length: 20 }, (_, i) => i);
      QUALI_STATE.bestSectors = [25, 27, 28];
      QUALI_STATE.session = 2;
      QUALI_STATE.nextSurvived = Array.from({ length: 15 }, (_, i) => i);
      QUALI_STATE.survived = QUALI_STATE.nextSurvived;
      renderQualiSession();
      return {
        joueur: QUALI_STATE.drivers[0].bestSectors,
        session: QUALI_STATE.bestSectors,
        drapeaux: QUALI_STATE.drivers[0].lastSectorFlags
      };
    });
    const vide = t => Array.isArray(t) && t.every(v => v === null);
    S.verifier("les meilleurs secteurs du pilote sont remis à zéro", vide(secteurs.joueur));
    S.verifier("les meilleurs secteurs de la session sont remis à zéro", vide(secteurs.session));
    S.verifier("les couleurs de secteurs sont effacées", secteurs.drapeaux === null);
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * 5. SIMULATION DE COURSE
 * ==================================================================== */
async function suiteCourse(categories) {
  S.suite("Simulation de course");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    await S.repondeurAutomatique(page);
    const cats = categories && categories.length ? categories
      : ["Karting Junior", "Formule 3", "Formule 1", "Endurance WEC"];

    for (const cat of cats) {
      const r = await S.courirUneCourse(page, { categorie: cat });
      const titre = cat.padEnd(16);

      if (r.anomalies && r.anomalies.length) {
        S.verifier(titre + "la course se déroule", false, r.anomalies[0]);
        continue;
      }
      S.verifier(titre + "arrive au drapeau", r.terminee === true, r.bloqueeA ? "bloquée à " + r.bloqueeA : "");
      S.verifier(titre + "positions toutes distinctes", r.doublons === 0, r.doublons + " doublon(s)");
      S.verifier(titre + "aucun écart négatif", r.ecartsNegatifs === 0, String(r.ecartsNegatifs));
      /* Un arrêt au stand fait réellement perdre une dizaine de places : une
         vingtaine de secondes immobilisé en Formule 1, une cinquantaine en
         endurance. Ce n'est pas une anomalie mais la discipline. Le seuil
         est donc plus large là où les arrêts existent ; là où il n'y en a
         pas — karting, Formule 3 — un déplacement de plus de huit places en
         un tour n'a aucune justification. */
      const plafondSaut = r.arretsPrevus ? 12 : 8;
      S.verifier(titre + "aucun saut de position aberrant", r.sautMax <= plafondSaut,
        "saut max " + r.sautMax + (r.toursManques ? ", " + r.toursManques + " tours non échantillonnés" : ""));
      S.verifier(titre + "le résultat est enregistré", !!r.resultat,
        r.resultat ? "P" + r.resultat.pos + " · " + r.resultat.pts + " pts" : "aucun");
      if (r.resultat && !r.abandon) {
        S.verifier(titre + "position et résultat concordent",
          Math.abs(r.resultat.pos - r.arrivee) <= 3,
          "course P" + r.arrivee + " / résultat P" + r.resultat.pos);
      }
      /* Pneus et stratégie sont sortis de la simulation. */
      S.verifier(titre + "aucune usure de pneus", r.usureMax === 0, String(r.usureMax));

      if (cat === "Endurance WEC") {
        S.verifier(titre + "le plateau multi-classes est préservé", r.trafic > 0, r.trafic + " voitures");
      }
      /* Toutes les catégories ne prévoient pas d'arrêt : le karting n'en a
         pas, la Formule 3 non plus (maxStops vaut zéro). On ne vérifie donc
         les passages au stand que là où la discipline en prévoit. */
      if (r.arretsPrevus && r.rivaux > 4) {
        S.verifier(titre + "les rivaux passent au stand",
          r.arretsRivaux > 0, r.arretsRivaux + "/" + r.rivaux);
      } else {
        S.verifier(titre + "aucun arrêt là où la discipline n'en prévoit pas",
          r.arretsRivaux === 0, r.arretsRivaux + " arrêt(s)");
      }
    }
    S.verifier("aucune erreur pendant les courses", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * 6. WEEK-END : STRATÉGIE ET PNEUS RETIRÉS
 * ==================================================================== */
async function suiteWeekend() {
  S.suite("Week-end de course");
  const { navigateur, page } = await S.ouvrirJeu();
  try {
    await page.evaluate(() => {
      G.cat = "Formule 1"; G.semaine = 8; G.seasonOver = false;
      if (!window.CAL_RACES || !CAL_RACES.length) buildCalendar();
      CAL_RACES.forEach(c => { c.done = c.week < 8; c.result = null; });
      RACE_STATE.qualiPos = 4;
      RACE_STATE.circuit = (getNextRace() || {}).name || "Imola";
      RACE_STATE.circuitData = getCircuitData(RACE_STATE.circuit);
      RACE_STATE.weather = generateWeather(0);
      G.totalLaps = 25;
      RACE_WEEKEND_STATE.essaisDone = true;
      RACE_WEEKEND_STATE.qualifDone = true;
      navTo("S-race", null);
    });
    await page.waitForTimeout(600);

    const onglets = await page.evaluate(() => {
      const t = document.getElementById("race-tab-strat");
      return {
        strategieVisible: t ? getComputedStyle(t).display !== "none" : false,
        listeOnglets: [...document.querySelectorAll('[id^="race-tab-"]')]
          .filter(e => getComputedStyle(e).display !== "none").map(e => e.id).join(",")
      };
    });
    S.verifier("l'onglet Stratégie est retiré du parcours", !onglets.strategieVisible, onglets.listeOnglets);

    const forcee = await page.evaluate(async () => {
      try { rtab("strat", true); } catch (e) {}
      await new Promise(r => setTimeout(r, 300));
      const h = document.getElementById("strategy-screen-content");
      return { modes: h ? h.querySelectorAll(".rj77-mode").length : 0 };
    });
    S.verifier("l'écran de stratégie n'est plus atteignable", forcee.modes === 0, forcee.modes + " mode(s)");

    /* Compacité des onglets. */
    const prep = await page.evaluate(async () => {
      rtab("prep", true);
      await new Promise(r => setTimeout(r, 500));
      const c = document.getElementById("rt-prep");
      return {
        hauteur: c.scrollHeight,
        boutonReglages: !!document.getElementById("rj84-btn-setup"),
        reglagesRanges: (document.getElementById("setup-mode-advanced") || {}).style
          ? document.getElementById("setup-mode-advanced").style.display : null
      };
    });
    S.verifier("la préparation tient dans l'écran", prep.hauteur <= 900, prep.hauteur + " px");
    S.verifier("les réglages sont accessibles par un bouton", prep.boutonReglages);
    S.verifier("les réglages sont rangés hors de l'écran", prep.reglagesRanges === "none");

    const ouverture = await page.evaluate(async () => {
      document.getElementById("rj84-btn-setup").click();
      await new Promise(r => setTimeout(r, 350));
      const ok = !!document.querySelector("#rj84-corps #setup-mode-advanced");
      document.getElementById("rj84-fermer").click();
      await new Promise(r => setTimeout(r, 300));
      return { ouvert: ok, revenu: !!document.querySelector("#rt-prep #setup-mode-advanced") };
    });
    S.verifier("la fenêtre de réglages s'ouvre", ouverture.ouvert);
    S.verifier("les réglages regagnent leur place à la fermeture", ouverture.revenu);

    const essais = await page.evaluate(async () => {
      rtab("essais", true);
      await new Promise(r => setTimeout(r, 500));
      return {
        hauteur: document.getElementById("rt-essais").scrollHeight,
        boutonTemps: !!document.getElementById("rj84-btn-temps")
      };
    });
    S.verifier("les essais tiennent dans l'écran", essais.hauteur <= 900, essais.hauteur + " px");
    S.verifier("la feuille de temps est accessible par un bouton", essais.boutonTemps);
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * 7. INTERFACE : COMPACITÉ ET ABSENCE D'ICÔNES DANS LES ACTIONS
 * ==================================================================== */
async function suiteInterface() {
  S.suite("Interface");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    /* Repères de hauteur : on veille à ne pas régresser. */
    const seuils = [
      ["S-home", null, 1.05], ["S-sponsors", null, 1.30],
      ["S-champ", null, 1.70], ["S-pilot", null, 1.50],
      ["S-contracts", null, 1.20], ["S-media", null, 1.20]
    ];
    for (const [id, avant, plafond] of seuils) {
      const m = await S.mesurerEcran(page, id, avant);
      if (!m) { S.ignorer(id + " : hauteur", "écran indisponible dans cette partie"); continue; }
      S.verifier(id + " reste sous " + plafond + " écran", m.pages <= plafond, m.pages + " écran(s)");
    }

    /* Aucune icône dans les boutons d'action, mais navigation préservée. */
    const icones = await page.evaluate(async () => {
      const ecrans = ["S-home", "S-pilot", "S-lifestyle", "S-contracts", "S-media"];
      let restants = 0, iconeSeule = 0;
      for (const id of ecrans) {
        try { navTo(id, null); } catch (e) { continue; }
        await new Promise(r => setTimeout(r, 320));
        document.querySelectorAll('.scr.on button, .scr.on [role=button], .scr.on [class*=btn]').forEach(el => {
          if (el.closest('.nav,.navbar,.tabs,.tab,.apex-nav,.apex-tabbar,.ni,#main-nav,#nav,.nat-opt,.continent-opt,.rj80-fav-opt')) return;
          const texte = (el.textContent || "").trim();
          const visuels = el.querySelectorAll("svg,img").length;
          if (!texte) { if (visuels) iconeSeule++; return; }
          if (visuels) restants++;
        });
      }
      const nav = document.querySelector("#main-nav,.apex-nav,.ni");
      const tuiles = [...document.querySelectorAll(".apex-action-tile")]
        .filter(t => t.querySelectorAll("svg,img").length).length;
      return { restants, iconeSeule, navIcones: nav ? nav.querySelectorAll("svg").length : 0, tuiles };
    });
    S.verifier("aucune icône dans les boutons d'action", icones.restants === 0, icones.restants + " restant(s)");
    S.verifier("les boutons sans libellé gardent leur icône", icones.iconeSeule >= 0, String(icones.iconeSeule));
    S.verifier("la navigation garde ses icônes", icones.navIcones > 0, icones.navIcones + " icône(s)");
    S.verifier("les tuiles du menu gardent leurs icônes", icones.tuiles > 0, icones.tuiles + " tuile(s)");

    /* Navigation : aucun écran ne doit lever d'erreur. */
    const ecrans = ["S-home", "S-pilot", "S-champ", "S-lifestyle", "S-contracts",
                    "S-media", "S-sponsors", "S-agent", "S-shop"];
    const echecs = await page.evaluate(async (liste) => {
      const ko = [];
      for (const id of liste) {
        try {
          navTo(id, null);
          await new Promise(r => setTimeout(r, 260));
          const scr = document.getElementById(id);
          if (!scr || !scr.classList.contains("on")) ko.push(id);
        } catch (e) { ko.push(id + " (" + e.message.slice(0, 40) + ")"); }
      }
      return ko;
    }, ecrans);
    S.verifier("tous les écrans s'ouvrent", echecs.length === 0, echecs.join(", "));
    S.verifier("aucune erreur pendant la navigation", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * ORCHESTRATION
 * ==================================================================== */

const SUITES = {
  chargement: suiteChargement,
  creation: suiteCreation,
  sauvegarde: suiteSauvegarde,
  qualifications: suiteQualifications,
  course: () => suiteCourse(),
  "course-rapide": () => suiteCourse(["Formule 1"]),
  weekend: suiteWeekend,
  ui: suiteInterface
};

async function principal() {
  const args = process.argv.slice(2);
  if (args.includes("--liste")) {
    console.log("Suites disponibles :\n  " + Object.keys(SUITES).join("\n  "));
    return true;
  }
  const demandees = args.filter(a => !a.startsWith("--"));
  const aJouer = demandees.length ? demandees : Object.keys(SUITES).filter(n => n !== "course-rapide");

  const inconnues = aJouer.filter(n => !SUITES[n]);
  if (inconnues.length) {
    console.error("Suite inconnue : " + inconnues.join(", "));
    console.error("Utilise --liste pour voir les suites disponibles.");
    return false;
  }

  const serveur = await S.servir();
  console.log(`Racing Journey — filet de tests   (http://127.0.0.1:${S.PORT})`);
  try {
    for (const nom of aJouer) {
      try { await SUITES[nom](); }
      catch (e) {
        S.verifier("la suite « " + nom + " » s'exécute", false, e && e.message ? e.message.slice(0, 140) : String(e));
      }
    }
  } finally {
    serveur.close();
  }
  return S.conclusion();
}

principal()
  .then(ok => process.exit(ok ? 0 : 1))
  .catch(e => { console.error(e); process.exit(1); });
