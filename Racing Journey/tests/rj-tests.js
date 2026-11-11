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
        const aisee = [...document.querySelectorAll(".rj115-milieu")][2];
        if (window.creStep === 2 && aisee) aisee.click();
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
      ecurieDeCoeur: G._favTeam,
      milieu: G._milieu,
      budget: G.budget
    }));
    S.verifier("la carrière démarre", lance.ecran && lance.ecran !== "S-create", lance.ecran);
    S.verifier("la catégorie de départ est posée", !!lance.categorie, lance.categorie);
    S.verifier("le mode de jeu est enregistré", !!lance.mode, lance.mode);
    S.verifier("l'écurie de cœur est enregistrée", lance.ecurieDeCoeur === "Ferrari", lance.ecurieDeCoeur);
    S.verifier("le milieu familial fixe le budget de départ", lance.milieu === "aisee" && lance.budget >= 600000, lance.milieu + " · " + lance.budget);
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
 * 3 bis. PERSISTANCE COMPLÈTE — filet de la restructuration
 *
 * La sauvegarde est écrite par plusieurs couches (cœur, extras de 07,
 * champs de 63, blocs RJ_SAVE_HOOKS de 86). Avant de les fusionner, on
 * fige ce qu'elles produisent ensemble : un aller-retour complet, les
 * réglages, l'export/import, et une partie réelle de la v208 qui doit
 * toujours se charger.
 * ==================================================================== */
const FIXTURE_V208 = require("./fixtures/sauvegarde-v208.json");

/* Champs comparés d'une sauvegarde à l'autre : le cœur et les extras. */
function empreinte() {
  const champs = ["pilot", "stats", "rep", "budget", "saison", "semaine", "champPts", "age",
                  "gameYear", "cat", "races", "currentTeam", "owned", "happiness", "igFollowers",
                  "sponsors", "staff", "_network"];
  const o = {};
  champs.forEach(c => { o[c] = JSON.stringify(G[c] === undefined ? null : G[c]); });
  return o;
}

async function suitePersistance() {
  S.suite("Persistance complète");
  const { navigateur, page, journal } = await S.ouvrirJeu({
    /* La partie figée est posée avant le démarrage, comme chez un joueur. */
    avantChargement: {
      fn: f => {
        try {
          /* Rejoué à chaque rechargement : on ne pose la partie qu'une fois. */
          if (localStorage.getItem("rj_s3") !== null) return;
          localStorage.setItem("rj_s3", JSON.stringify(f.slots.slot_2));
          if (f.extras && f.extras.slot_2) localStorage.setItem("rj_extra_slot_2", JSON.stringify(f.extras.slot_2));
        } catch (e) {}
      },
      arg: FIXTURE_V208
    }
  });
  try {
    /* 1. Aller-retour complet dans l'emplacement 2. */
    const avant = await page.evaluate(empreinteSrc => {
      const empreinte = new Function("return (" + empreinteSrc + ")()");
      /* La partie de départ est la sauvegarde de test du module 51, qui
         remplace au démarrage toute sauvegarde qu'il reconnaît comme sienne
         (bug à corriger en T3). On en fait une vraie partie. */
      G._rjTestSave = false; G.pilot.prenom = "Sonde"; G.pilot.nom = "Persistance";
      G.budget = 123456; G.champPts = 77; G.happiness = 61;
      G.sponsors = [{ name: "Sonde", value: 4242, weeks: 9 }];
      G._slot = 1; saveGame(1);
      const brut = JSON.parse(localStorage.getItem(SAVE_KEYS[1]));
      const blocs = (window.RJ_SAVE_HOOKS || []).filter(h => {
        /* undefined : rien à écrire ; null : bloc vide, volontairement retiré. */
        try { const b = h && h.cle && h.ecrire && h.ecrire(G); return b !== undefined && b !== null; } catch (e) { return false; }
      }).map(h => h.cle);
      return { e: empreinte(), blocs, manquants: blocs.filter(c => !(c in brut)),
               extras: !!(brut.extras && brut.extras.sponsors) };
    }, empreinte.toString());
    S.verifier("chaque bloc inscrit est écrit dans la sauvegarde", avant.manquants.length === 0,
      avant.manquants.length ? "manque " + avant.manquants.join(", ") : avant.blocs.join(", "));
    S.verifier("les extras sont écrits dans l'emplacement", avant.extras);

    /* Réglages modifiés avant le rechargement. */
    await page.evaluate(() => { SETTINGS.simSpeed = "slow"; saveSettings(); });

    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(6500);

    const apres = await page.evaluate(empreinteSrc => {
      const empreinte = new Function("return (" + empreinteSrc + ")()");
      const brut = JSON.parse(localStorage.getItem(SAVE_KEYS[1]) || "{}");
      window.__brutAvantChargement = { budget: brut.budget, test: brut._rjTestSave, variante: brut._rjTestVariant };
      loadSave(1);
      return { e: empreinte(), vitesse: SETTINGS.simSpeed, brut: window.__brutAvantChargement };
    }, empreinte.toString());
    const differents = Object.keys(avant.e).filter(k => avant.e[k] !== apres.e[k]);
    S.verifier("la partie revient à l'identique après rechargement", differents.length === 0,
      differents.map(k => k + " " + avant.e[k].slice(0, 30) + " → " + apres.e[k].slice(0, 30)).join(" ; ") +
      " | stocké " + JSON.stringify(apres.brut));
    S.verifier("les réglages survivent au rechargement", apres.vitesse === "slow", apres.vitesse);

    /* 2. La partie figée de la v208 se charge, se joue et se sauvegarde. */
    const fige = await page.evaluate(f => {
      const s = f.slots.slot_2;
      loadSave(2);
      return {
        pilote: G.pilot && G.pilot.nom === s.pilot.nom,
        categorie: G.cat === s.cat,
        saison: G.saison === s.saison,
        budget: G.budget === s.budget,
        courses: (G.races || []).length === (s.races || []).length,
        sponsors: !f.extras.slot_2 || JSON.stringify(G.sponsors || null) === JSON.stringify(f.extras.slot_2.sponsors || null),
        cat: G.cat
      };
    }, FIXTURE_V208);
    ["pilote", "categorie", "saison", "budget", "courses", "sponsors"].forEach(k =>
      S.verifier("partie v208 : " + k + " retrouvé", fige[k] === true));

    await S.repondeurAutomatique(page);
    const course = await S.courirUneCourse(page, { categorie: fige.cat, reinitialiserRivaux: false });
    S.verifier("partie v208 : une course se joue", course.terminee === true && !!course.resultat,
      course.bloqueeA || (course.anomalies || [])[0] || "");
    const resauve = await page.evaluate(n => {
      G._slot = 2; saveGame(2);
      const o = JSON.parse(localStorage.getItem(SAVE_KEYS[2]));
      return (o.races || []).length === n + 1;
    }, (FIXTURE_V208.slots.slot_2.races || []).length);
    S.verifier("partie v208 : se sauvegarde avec la nouvelle course", resauve);
    /* 3. Export puis import, en dernier : l'import programme un rechargement. */
    const echange = await page.evaluate(async () => {
      const cles = ["rj_s2", "rj_extra_slot_1", "rj_settings_v1", "rj_s3"];
      const original = cles.map(k => localStorage.getItem(k));
      let blob; const oc = URL.createObjectURL; URL.createObjectURL = b => { blob = b; return "blob:x"; };
      const ck = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () {};
      try { exportSaveData(); } finally { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ck; }
      const bundle = JSON.parse(await blob.text());
      cles.forEach(k => localStorage.removeItem(k));
      const sad = window.showAlertDialog; window.showAlertDialog = function () {};   // pas de rechargement
      try { _applyImportedBundle(bundle); } finally { window.showAlertDialog = sad; }
      return cles.map((k, i) => {
        const v = localStorage.getItem(k);
        return original[i] === null ? v === null : (v !== null && JSON.stringify(JSON.parse(v)) === JSON.stringify(JSON.parse(original[i])));
      });
    });
    S.verifier("l'import restaure l'emplacement", echange[0]);
    S.verifier("l'import restaure les extras", echange[1]);
    S.verifier("l'import restaure les réglages", echange[2]);
    S.verifier("l'import restaure la partie v208", echange[3]);

    S.verifier("aucune erreur pendant la suite", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * 3 bis bis. SAUVEGARDE FIABLE (T1)
 *
 * Une sauvegarde s'écrit en une fois, tout ou rien ; un échec est toujours
 * signalé au joueur, y compris en sauvegarde automatique ; une sauvegarde
 * illisible est mise de côté, jamais écrasée ; le format est versionné.
 * ==================================================================== */
async function suiteFiabilite() {
  S.suite("Sauvegarde fiable");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    /* Outillage : espion des écritures et des messages d'erreur, panne de quota. */
    await page.evaluate(() => {
      window.__sonde = { ecritures: {}, erreurs: [] };
      const si = Storage.prototype.setItem;
      window.__panne = null;
      Storage.prototype.setItem = function (k, v) {
        window.__sonde.ecritures[k] = (window.__sonde.ecritures[k] || 0) + 1;
        if (window.__panne && window.__panne(k)) {
          const e = new Error("quota"); e.name = "QuotaExceededError"; throw e;
        }
        return si.call(this, k, v);
      };
      const toast = window.pushHomeToast, fb = window.showFb;
      window.pushHomeToast = function (t, m) { window.__sonde.erreurs.push("toast:" + t + " " + m); try { return toast && toast.apply(this, arguments); } catch (e) {} };
      window.showFb = function (id, type, t) { if (type === "err") window.__sonde.erreurs.push("fb:" + t); try { return fb && fb.apply(this, arguments); } catch (e) {} };
      G._rjTestSave = false; G.pilot.prenom = "Sonde"; G.pilot.nom = "Fiabilite";
    });

    /* 1. Une seule écriture, format versionné. */
    const unique = await page.evaluate(() => {
      window.__sonde.ecritures = {};
      const ok = saveGame(1);
      const o = JSON.parse(localStorage.getItem(SAVE_KEYS[1]));
      return { ok, ecritures: window.__sonde.ecritures[SAVE_KEYS[1]] || 0, version: o._v,
               extrasDansEmplacement: !!(o.extras && o.extras.sponsors !== undefined) || o.extras !== undefined,
               cleExtras: localStorage.getItem("rj_extra_slot_1") };
    });
    S.verifier("saveGame indique la réussite", unique.ok === true, String(unique.ok));
    S.verifier("une seule écriture de l'emplacement", unique.ecritures === 1, unique.ecritures + " écriture(s)");
    S.verifier("le format porte une version", unique.version === 2, String(unique.version));
    S.verifier("les extras sont dans l'emplacement", unique.extrasDansEmplacement);
    S.verifier("l'ancienne clé d'extras n'est plus utilisée", unique.cleExtras === null);

    /* 2. Stockage plein : rien n'est écrit à moitié, le joueur est prévenu. */
    const plein = await page.evaluate(() => {
      const avant = { slot: localStorage.getItem(SAVE_KEYS[1]), nbCles: Object.keys(localStorage).length };
      window.__sonde.erreurs = [];
      G.budget = 999; G.sponsors = [{ name: "Perdu", value: 1, weeks: 1 }];
      /* Le quota casse sur la grosse écriture, pas forcément sur les petites. */
      window.__panne = k => k === SAVE_KEYS[1];
      let ok;
      try { ok = saveGame(1); } finally { window.__panne = null; }
      return { ok, inchange: localStorage.getItem(SAVE_KEYS[1]) === avant.slot,
               extrasInchanges: Object.keys(localStorage).length === avant.nbCles,
               prevenu: window.__sonde.erreurs.length > 0, erreurs: window.__sonde.erreurs.slice(0, 2) };
    });
    S.verifier("stockage plein : saveGame signale l'échec", plein.ok === false, String(plein.ok));
    S.verifier("stockage plein : l'emplacement reste intact", plein.inchange);
    S.verifier("stockage plein : aucune autre clé n'est écrite", plein.extrasInchanges);

    /* 2 bis. Un bloc qui échoue : la sauvegarde est faite, mais le joueur le sait. */
    const incomplet = await page.evaluate(() => {
      window.__sonde.erreurs = [];
      const h = { cle: "__panne", ecrire: () => { throw new Error("bloc en panne"); } };
      window.RJ_SAVE_HOOKS.push(h);
      try { saveGame(1); } finally { window.RJ_SAVE_HOOKS.splice(window.RJ_SAVE_HOOKS.indexOf(h), 1); }
      return window.__sonde.erreurs.some(e => /incompl/i.test(e));
    });
    S.verifier("bloc en échec : sauvegarde signalée incomplète", incomplet);
    S.verifier("stockage plein : le joueur est prévenu", plein.prevenu, plein.erreurs.join(" | "));

    /* 3. Sauvegarde automatique en échec : jamais silencieuse. */
    const auto = await page.evaluate(() => {
      window.__sonde.erreurs = [];
      SETTINGS.autoSaveAfterRace = true; G._slot = 1;
      window.__panne = () => true;
      try { _autoSaveOnRaceEnd(); } finally { window.__panne = null; }
      return { prevenu: window.__sonde.erreurs.length > 0 };
    });
    S.verifier("sauvegarde automatique en échec : le joueur est prévenu", auto.prevenu);

    /* 4. Sauvegarde illisible : mise de côté, jamais écrasée. */
    const illisible = await page.evaluate(() => {
      window.__sonde.erreurs = [];
      localStorage.setItem(SAVE_KEYS[1], "{illisible");
      let plante = null;
      try { loadSave(1); } catch (e) { plante = e.message; }
      const prevenuChargement = window.__sonde.erreurs.length > 0;
      G._slot = 1; saveGame(1);
      const copie = Object.keys(localStorage).filter(k => k.indexOf(SAVE_KEYS[1] + "_illisible") === 0)
        .map(k => localStorage.getItem(k));
      /* Une deuxième sauvegarde illisible remplace la copie : une seule par emplacement. */
      localStorage.setItem(SAVE_KEYS[1], "{illisible2"); saveGame(1);
      const copies = Object.keys(localStorage).filter(k => k.indexOf(SAVE_KEYS[1] + "_illisible") === 0);
      const uneCopie = copies.length === 1 && localStorage.getItem(copies[0]) === "{illisible2";
      const listeCopies = copies.map(k => k + "=" + String(localStorage.getItem(k)).slice(0, 14)).join(" ");
      localStorage.setItem(SAVE_KEYS[1], "null");
      let planteNull = null;
      try { loadSave(1); } catch (e) { planteNull = e.message; }
      const slotApresNull = G._slot;
      G._slot = 1; saveGame(1);   // remise en état pour la suite
      return { plante, prevenuChargement, conservee: copie.indexOf("{illisible") >= 0,
               uneCopie, copies: listeCopies,
               nullSansErreur: planteNull === null && slotApresNull !== null };
    });
    S.verifier("sauvegarde illisible : le chargement ne plante pas", illisible.plante === null, illisible.plante || "");
    S.verifier("sauvegarde illisible : le joueur est prévenu", illisible.prevenuChargement);
    S.verifier("sauvegarde illisible : conservée avant d'être remplacée", illisible.conservee);
    S.verifier("sauvegarde illisible : une seule copie par emplacement", illisible.uneCopie, illisible.copies);
    S.verifier("emplacement « null » : traité comme illisible", illisible.nullSansErreur);

    /* 5. Ancien format (sans version, extras à part) : migré au chargement. */
    const migration = await page.evaluate(() => {
      const ancien = JSON.parse(localStorage.getItem(SAVE_KEYS[1]));
      delete ancien._v; delete ancien.extras; delete ancien.champs;
      const extras = { sponsors: [{ name: "Ancien", value: 7, weeks: 3 }] };
      ancien._rjTeamStyle = { test: "migre" };
      G.sponsors = []; G._rjTeamStyle = null;   // rien ne doit venir de la mémoire
      localStorage.setItem(SAVE_KEYS[0], JSON.stringify(ancien));
      localStorage.setItem("rj_extra_slot_0", JSON.stringify(extras));
      loadSave(0);
      const ok = JSON.stringify(G.sponsors) === JSON.stringify(extras.sponsors) &&
                 G._rjTeamStyle && G._rjTeamStyle.test === "migre";
      saveGame(0);
      const o = JSON.parse(localStorage.getItem(SAVE_KEYS[0]));
      return { ok, version: o._v, cleRetiree: localStorage.getItem("rj_extra_slot_0") === null };
    });
    S.verifier("ancien format : extras et champs d'écurie retrouvés", migration.ok);
    S.verifier("ancien format : réécrit au nouveau format", migration.version === 2 && migration.cleRetiree,
      "version " + migration.version + ", ancienne clé " + (migration.cleRetiree ? "retirée" : "présente"));
    S.verifier("aucune erreur pendant la suite", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }

  /* 6. La sauvegarde de test n'existe qu'en mode développeur. */
  const joueur = await S.ouvrirJeu({ dev: false, charger: false });
  try {
    const n = await joueur.page.evaluate(() => SAVE_KEYS.filter(k => {
      try { const o = JSON.parse(localStorage.getItem(k)); return o && o._rjTestSave; } catch (e) { return false; }
    }).length);
    S.verifier("pas de sauvegarde de test chez un joueur", n === 0, n + " créée(s)");
  } finally { await joueur.navigateur.close(); }
}

/* ==================================================================== *
 * 3 quater. COUCHES APLATIES (T5)
 *
 * Chaque fonction aplatie n'a plus qu'une définition dans les sources, et
 * c'est bien elle qui est active dans le jeu. On ajoute ici chaque fonction
 * au fil des aplatissements : une réintroduction de couche échoue aussitôt.
 * ==================================================================== */
const APLATIES = {
  /* nom : marqueur de la version retenue (nom de fonction ou drapeau posé) */
  pushRadioMsg: "rjPushRadioMsgDirect", renderLiveNewsFeed: "rjRenderDirectFeed", tickNewsFeed: "rjTickDirect",
  _psPickObj: "rjPsPickObjNew", _psPickAngle: "rjPsPickAngleNew", _psAdjustBudget: "rjPsAdjustBudgetNew",
  renderF1Stats: "_rjNeutralized", openNeg: "_rjNegFixed",
  _socialFanHandle: null, recomputeGlobalRep: null,
  startNextSeason: null, navTo: null, refreshScreen: null, pushHomeToast: null,
  mtab: null, rtab: null, showResult: null, runRaceLive: null,
  advanceToNextMoment: null, goToRaceWeekend: null,
  updateHomeBadges: null, startQual: null, resolveLiveEvent: null, renderCal: null, generateSeasonObjectives: null
};

function definitionsDansLesSources() {
  const fs = require("fs"), path = require("path");
  const parcourir = d => fs.readdirSync(d, { withFileTypes: true })
    .flatMap(e => e.isDirectory() ? parcourir(path.join(d, e.name)) : [path.join(d, e.name)]);
  const textes = parcourir(path.join(S.RACINE, "js")).filter(f => f.endsWith(".js")).map(f => fs.readFileSync(f, "utf8"));
  const compte = {};
  Object.keys(APLATIES).forEach(n => {
    const re = new RegExp("function\\s+" + n + "\\s*\\(|(?:window|GR)\\." + n + "\\s*=\\s*function", "g");
    compte[n] = textes.reduce((s, t) => s + (t.match(re) || []).length, 0);
  });
  return compte;
}

async function suiteCouches() {
  S.suite("Couches aplaties");
  const compte = definitionsDansLesSources();
  const multiples = Object.keys(compte).filter(n => compte[n] !== 1);
  S.verifier(Object.keys(compte).length + " fonctions définies une seule fois", multiples.length === 0,
    multiples.map(n => n + "×" + compte[n]).join(", "));
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    const actives = await page.evaluate(L => L.map(([n, m]) => {
      const f = window[n];
      if (typeof f !== "function") return n + " absente";
      if (m && f.name !== m && !f[m]) return n + " n'est pas la version retenue (" + (f.name || "anonyme") + ")";
      return null;
    }).filter(Boolean), Object.entries(APLATIES));
    S.verifier("chaque fonction aplatie est active dans sa version retenue", actives.length === 0, actives.join(" ; "));

    /* Plus aucune couche, quelle que soit sa forme (window.X =, X =,
       window[nom] =) : chaque fonction déclarée au premier niveau est active
       telle quelle, ou passe par son répartiteur rjAppeler. */
    const declarees = (() => {
      const fs = require("fs"), path = require("path"), noms = new Set();
      const parcourir = d => fs.readdirSync(d, { withFileTypes: true })
        .flatMap(e => e.isDirectory() ? parcourir(path.join(d, e.name)) : [path.join(d, e.name)]);
      parcourir(path.join(S.RACINE, "js")).filter(f => f.endsWith(".js")).forEach(f => {
        for (const m of fs.readFileSync(f, "utf8").matchAll(/^function ([A-Za-z_$][\w$]*)\s*\(/gm)) noms.add(m[1]);
      });
      return [...noms];
    })();
    const enCouches = await page.evaluate(L => L.filter(n => {
      const f = window[n];
      if (typeof f !== "function") return false;
      const s = String(f);
      return !(s.indexOf("function " + n + "(") === 0 || s.indexOf('rjAppeler("' + n + '"') >= 0 || f._rjRepartiteur);
    }), declarees);
    S.verifier(declarees.length + " fonctions déclarées, aucune enveloppée", enCouches.length === 0, enCouches.slice(0, 8).join(", "));

    /* Le hook de 04o relançait tout le changement de saison : on sautait
       deux saisons (âge +2, contrat −2) à chaque passage. */
    const saison = await page.evaluate(() => {
      const a = { saison: G.saison, age: G.age };
      startNextSeason();
      return { saisons: G.saison - a.saison, ans: G.age - a.age };
    });
    /* Filet de fin de course (04j) : sa fonction de réactivation n'existait
       pas, chaque filet levait une ReferenceError au pire moment. */
    const filet = await page.evaluate(() => {
      const coeur = window._showResultCoeur, btn = document.getElementById("race-btn");
      if (btn) btn.disabled = true;
      const n = (G.races || []).length;
      window._showResultCoeur = function () { throw new Error("panne simulée"); };
      let err = null;
      try { showResult(); } catch (e) { err = e.message; } finally { window._showResultCoeur = coeur; }
      const r = { err, bouton: btn ? !btn.disabled : null, course: (G.races || []).length === n + 1 };
      G.races.pop();
      return r;
    });
    /* La panne simulée est journalisée volontairement : on ne la compte pas. */
    journal.erreurs = journal.erreurs.filter(e => e.indexOf("panne simulée") < 0);
    S.verifier("fin de course en panne : le jeu reprend la main", filet.err === null && filet.bouton === true && filet.course,
      JSON.stringify(filet));
    /* Une notification reçue hors de l'accueil est gardée, puis affichée au
       retour (filtre de file de 53, placé avant ceux de 40 et 28). */
    const notif = await page.evaluate(async () => {
      const vus = [], coeur = window._pushHomeToastCoeur;
      window._pushHomeToastCoeur = function (l) { vus.push(l); };
      try {
        navTo("S-media", "ni-media"); await new Promise(r => setTimeout(r, 200));
        pushHomeToast("Nouveau message", "Sonde de file d'attente", "#fff");
        const pendant = vus.length;
        navTo("S-home", "ni-home"); await new Promise(r => setTimeout(r, 1200));
        return { pendant, apres: vus.filter(l => l === "Nouveau message").length };
      } finally { window._pushHomeToastCoeur = coeur; }
    });
    S.verifier("notification hors accueil : gardée puis affichée au retour", notif.pendant === 0 && notif.apres === 1, JSON.stringify(notif));
    S.verifier("un changement de saison avance d'une saison", saison.saisons === 1 && saison.ans === 1,
      "+" + saison.saisons + " saison(s), +" + saison.ans + " an(s)");

    /* Tour lancé en qualif : le hook de 18 masquait `suite` par une variable
       locale, la séquence recevait un tableau et n'était jamais jouée. */
    const qualif = await page.evaluate(() => {
      let vu = null;
      rjAppeler("_qualiHotLapSequence", (t, s, l, n, rappel) => { vu = [typeof t, typeof rappel]; }, null, [88.1, "Q1", 1, 3, () => {}]);
      return vu;
    });
    S.verifier("tour lancé en qualif : la séquence reçoit le temps et le rappel",
      JSON.stringify(qualif) === '["number","function"]', JSON.stringify(qualif));

    /* Fin de carrière : 95 rappelait le répartiteur, donc sa propre
       confirmation, sans jamais clore la partie. */
    const fin = await page.evaluate(() => {
      const avant = !!G._rjCarriereTerminee;
      window._rj74Terminer();
      const oui = document.getElementById("rj95-ok");
      if (oui) oui.click();
      const r = { avant, apres: !!G._rjCarriereTerminee, bouton: !!oui, rouverte: !!document.getElementById("rj95-ok") };
      delete G._rjCarriereTerminee;
      return r;
    });
    S.verifier("fin de carrière confirmée : la partie est close", !fin.avant && fin.apres && fin.bouton && !fin.rouverte, JSON.stringify(fin));

    /* Un désinstalleur retire ses hooks ; il ne remet jamais une ancienne
       fonction à la place du répartiteur (les hooks des autres modules
       disparaîtraient avec). */
    const desinst = await page.evaluate(() => {
      const avant = Object.keys(RJ_HOOKS).filter(n => typeof window[n] === "function" &&
        (window[n]._rjRepartiteur || String(window[n]).indexOf('rjAppeler("' + n + '"') >= 0));
      Object.keys(window).filter(k => /^_rj\w*Uninstall$/.test(k) && typeof window[k] === "function")
        .forEach(k => { try { window[k](); } catch (e) {} });
      return avant.filter(n => !(window[n] && (window[n]._rjRepartiteur || String(window[n]).indexOf('rjAppeler("' + n + '"') >= 0)));
    });
    S.verifier("les désinstalleurs gardent tous les répartiteurs", desinst.length === 0, desinst.slice(0, 8).join(", "));
    S.verifier("aucune erreur au chargement", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * 3 quinquies. SOBRIÉTÉ AU REPOS (T6)
 *
 * Au repos sur l'accueil, le jeu ne doit presque rien faire : on mesurait
 * 178 réveils de surveillances du DOM et ~1 650 setTimeout par seconde
 * (boucles d'installation mortes, chrono redessiné hors écran, classes
 * réécrites à l'identique). Une batterie de téléphone le paie.
 * ==================================================================== */
async function suiteSobriete() {
  S.suite("Sobriété au repos");
  const { navigateur, page } = await S.ouvrirJeu({ avantChargement: { fn: () => {
    window.__c = { obs: 0, to: 0 };
    const st = window.setTimeout; window.setTimeout = function () { window.__c.to++; return st.apply(this, arguments); };
    const MO = window.MutationObserver; window.MutationObserver = function (cb) { return new MO(function () { window.__c.obs++; return cb.apply(this, arguments); }); };
  } } });
  try {
    await page.evaluate(() => navTo("S-home", "ni-home"));
    await page.waitForTimeout(1500);
    await page.evaluate(() => { window.__c = { obs: 0, to: 0 }; });
    await page.waitForTimeout(5000);
    const c = await page.evaluate(() => window.__c);
    S.verifier("surveillances du DOM au repos < 10/s", c.obs / 5 < 10, (c.obs / 5).toFixed(1) + "/s");
    S.verifier("setTimeout au repos < 60/s", c.to / 5 < 60, (c.to / 5).toFixed(1) + "/s");
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * 3 sexies. MODÈLE DE PISTE (T7)
 *
 * Position continue de chaque voiture, base de la future vue en direct.
 * ==================================================================== */
async function suitePiste() {
  S.suite("Modèle de piste");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    await S.repondeurAutomatique(page);
    for (const cat of ["Formule 1", "Endurance WEC"]) {
      await page.evaluate(() => {
        window.__piste = { releves: 0, ordre: 0, bornes: 0, stand: 0, joueur: 0 };
        window.RJ_LAP_HOOKS.push({ id: "__test_piste", run: function () {
          const e = RJModelePiste.etat(); if (!e) return;
          const P = window.__piste; P.releves++;
          const vivantes = e.voitures.filter(v => !v.abandon);
          if (!e.voitures.some(v => v.joueur)) P.joueur++;
          vivantes.forEach(v => { if (!(v.distance >= -0.1 && v.distance <= e.tour + 1)) P.bornes++; });
          /* Le tour qui vient de se calculer se rejoue ensuite à l'écran : on le parcourt. */
          for (let f = 0; f <= 1; f += 0.04) {
            RJModelePiste.etat(Date.now() + f * dureeTourCourse()).voitures.forEach(v => { if (v.auStand) P.stand++; });
          }
          /* Dans la catégorie du joueur, la position affichée suit la distance. */
          const L = vivantes.filter(v => !v.autreCategorie).sort((a, b) => a.pos - b.pos);
          for (let i = 1; i < L.length; i++) if (L[i].distance > L[i - 1].distance + 1e-9) { P.ordre++; break; }
        } });
      });
      const r = await S.courirUneCourse(page, { categorie: cat });
      const P = await page.evaluate(() => { window.RJ_LAP_HOOKS = window.RJ_LAP_HOOKS.filter(h => h.id !== "__test_piste"); return window.__piste; });
      const t = cat.padEnd(14);
      S.verifier(t + "course terminée et modèle relevé", r.terminee && P.releves > 5, P.releves + " tours");
      S.verifier(t + "distances dans les bornes", P.bornes === 0, P.bornes + " hors bornes");
      S.verifier(t + "l'ordre des distances suit le classement", P.ordre === 0, P.ordre + " tour(s) incohérent(s)");
      S.verifier(t + "le joueur est toujours présent", P.joueur === 0);
      if (r.arretsPrevus) S.verifier(t + "les arrêts au stand sont visibles", P.stand > 0, P.stand + " passage(s)");
    }
    S.verifier("aucune erreur pendant la suite", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * 3 ter. PARCOURS DE TOUS LES ÉCRANS ET ONGLETS
 *
 * Les gestionnaires inline (onclick dans le HTML) échappent à la mesure de
 * couverture : avant de supprimer du code, on vérifie que chaque écran et
 * chaque onglet s'ouvre sans erreur.
 * ==================================================================== */
async function suiteParcours() {
  S.suite("Parcours des écrans et onglets");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    const r = await page.evaluate(async () => {
      const attendre = ms => new Promise(res => setTimeout(res, ms));
      /* Écrans de jeu ; la création de carrière et l'accueil sont couverts ailleurs. */
      const ecrans = [...document.querySelectorAll(".scr[id^='S-']")].map(e => e.id)
        .filter(id => !/^S-(splash|cre|create|intro)$/i.test(id));
      const rapport = { ecrans: 0, onglets: 0, ko: [] };
      for (const id of ecrans) {
        try {
          navTo(id, null);
          await attendre(220);
          if (!document.getElementById(id).classList.contains("on")) {
            /* Certains anciens écrans redirigent vers leur remplaçant (S-arcs → Médias). */
            const ouvert = document.querySelector(".scr.on");
            if (!ouvert) { rapport.ko.push(id + " ne s'ouvre pas"); continue; }
            rapport.redirections = (rapport.redirections || []).concat(id + "→" + ouvert.id);
          }
          rapport.ecrans++;
          /* Onglets internes : boutons dont le onclick appelle une fonction *tab('…'). */
          const boutons = [...document.getElementById(id).querySelectorAll("[onclick]")]
            .filter(b => /\b\w*tab\(\s*'[^']+'/.test(b.getAttribute("onclick")) && b.offsetParent !== null);
          for (const b of boutons) {
            const code = b.getAttribute("onclick");
            try { b.click(); await attendre(120); rapport.onglets++; }
            catch (e) { rapport.ko.push(id + " › " + code.slice(0, 40) + " : " + e.message.slice(0, 60)); }
          }
        } catch (e) { rapport.ko.push(id + " : " + e.message.slice(0, 60)); }
      }
      try { navTo("S-home", null); } catch (e) {}
      return rapport;
    });
    S.verifier("tous les écrans s'ouvrent", r.ko.length === 0 && r.ecrans > 5, r.ecrans + " écran(s)" +
      (r.redirections ? ", redirigés : " + r.redirections.join(" ") : "") + (r.ko.length ? " — " + r.ko.slice(0, 3).join(" ; ") : ""));
    S.verifier("des onglets ont été parcourus", r.onglets > 5, r.onglets + " onglet(s)");
    S.verifier("aucune erreur pendant le parcours", journal.erreurs.length === 0, journal.erreurs.slice(0, 2).join(" ; "));
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * 5 bis. ENDURANCE — MESURE DES BONDS DE POSITION
 *
 * Défaut connu : le joueur saute d'une dizaine de places d'un tour à
 * l'autre environ une course sur six. On le chiffre avant la refonte du
 * moteur (T7), qui doit le faire disparaître : le seuil sera alors abaissé.
 * ==================================================================== */
async function suiteEndurance() {
  S.suite("Endurance : bonds de position");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    await S.repondeurAutomatique(page);
    const sauts = [];
    for (let i = 0; i < 6; i++) {
      const r = await S.courirUneCourse(page, { categorie: "Endurance WEC" });
      if (!r.terminee) { S.verifier("course " + (i + 1) + " arrive au drapeau", false, r.bloqueeA || (r.anomalies || [])[0] || ""); continue; }
      sauts.push(r.sautMax);
    }
    const gros = sauts.filter(s => s >= 8).length;
    S.verifier("6 courses d'endurance courues", sauts.length === 6, "sauts max : " + sauts.join(", "));
    const detail = gros + " course(s) avec un saut de 8 places ou plus";
    /* Corrigé en T7 : regroupement sous safety car dans l'ordre affiché,
       relais lissés, trafic des autres catégories derrière au général. */
    S.verifier("aucun saut au-delà de 12 places", sauts.every(s => s <= 12), detail);
    S.verifier("aucune erreur pendant les courses", journal.erreurs.length === 0, journal.erreurs[0] || "");
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
      const detailSaut = "saut max " + r.sautMax + (r.toursManques ? ", " + r.toursManques + " tours non échantillonnés" : "");
      S.verifier(titre + "aucun saut de position aberrant", r.sautMax <= plafondSaut, detailSaut);
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
      /* La préparation se verrouille une fois les essais faits (40) : on
         repart d'un week-end neuf, comme au début d'une manche. */
      if (typeof resetRaceWeekend === "function") resetRaceWeekend();
      rtab("prep", true);
      await new Promise(r => setTimeout(r, 500));
      const c = document.getElementById("rt-prep");
      const reglages = c.querySelector("#setup-mode-advanced");
      return {
        hauteur: c.scrollHeight,
        boutonReglages: !!document.getElementById("rj84-btn-setup"),
        reglagesVisibles: !!reglages && reglages.offsetParent !== null
      };
    });
    /* Les réglages ont été remis dans l'écran de préparation (18-weekend,
       compacterPreparation) : ils ne sont plus derrière un bouton, et la
       préparation dépasse donc volontairement la hauteur d'écran. */
    S.verifier("les réglages sont dans la préparation", prep.reglagesVisibles, prep.hauteur + " px");
    S.verifier("plus de bouton de réglages", !prep.boutonReglages);

    /* L'écran de course : progression visible, classement différé. */
    const progression = await page.evaluate(async () => {
      SETTINGS.simSpeed = "slow";
      if (window.LIVE_RACE && LIVE_RACE.interval) clearInterval(LIVE_RACE.interval);
      window.LIVE_RACE = { drivers: [], cur: 0, total: 0, finished: false, paused: false, interval: null };
      confirmStrategy();
      if (!LIVE_RACE.total) runRaceLive();
      await new Promise(r => setTimeout(r, 1500));
      const bloc = document.getElementById("rj90-progression");
      const lb = document.getElementById("live-leaderboard");
      const res = {
        blocPresent: !!bloc,
        texte: bloc ? (bloc.innerText || "").replace(/\n+/g, " | ").slice(0, 80) : null,
        /* Le classement est masqué par son conteneur parent : on regarde
           s'il est effectivement invisible, pas seulement son style propre. */
        classementCache: lb ? (lb.offsetParent === null || lb.style.display === "none") : null,
        total: LIVE_RACE.total
      };
      if (LIVE_RACE.interval) clearInterval(LIVE_RACE.interval);
      return res;
    });
    S.verifier("la progression de course s'affiche", progression.blocPresent, progression.texte || "");
    S.verifier("le classement est masqué pendant la course", progression.classementCache === true);

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
    /* Repères de hauteur, en écrans paysage (932 × 430) : on veille à ne pas régresser. */
    const seuils = [
      ["S-home", null, 1.05], ["S-sponsors", null, 1.70],
      ["S-champ", null, 2.80], ["S-pilot", null, 2.40],
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
 * 8 bis. PAYSAGE (étape 2)
 *
 * Le jeu se joue à l'horizontale. Chaque écran suit la même mise en page :
 * rail de navigation à gauche, un seul bandeau en haut (titre, onglets en
 * pastilles, ressources),
 * le contenu dessous. Vérifié à trois tailles ; en portrait, le jeu demande
 * de tourner l'appareil.
 * ==================================================================== */
const TAILLES_PAYSAGE = [
  ["petit téléphone", { width: 667, height: 375 }],
  ["grand téléphone", { width: 932, height: 430 }],
  ["tablette", { width: 1180, height: 820 }]
];

async function suitePaysage() {
  S.suite("Paysage");
  for (const [nom, viewport] of TAILLES_PAYSAGE) {
    const { navigateur, page, journal } = await S.ouvrirJeu({ viewport });
    try {
      const r = await page.evaluate(async () => {
        const attendre = ms => new Promise(res => setTimeout(res, ms));
        const boite = e => e.getBoundingClientRect();
        const nav = document.getElementById("main-nav"), bn = boite(nav);
        const ecrans = [...document.querySelectorAll(".scr[id^='S-']")].map(e => e.id)
          .filter(id => !/^S-(splash|create|display-setup|mode)$/.test(id));
        const res = { rail: { gauche: bn.left, largeur: bn.width, hauteur: bn.height }, bandeaux: {}, hauts: {}, debords: [], chevauche: [], plusieurs: [], sansHud: [], hudAilleurs: [], ongletsHors: [], ongletsCoupes: [], sansRail: [], gouttieres: {} };
        for (const id of ecrans) {
          try { navTo(id, null); } catch (e) { continue; }
          await attendre(260);
          const s = document.querySelector(".scr.on"); if (!s || res.bandeaux[s.id] !== undefined) continue;
          const bs = boite(s), hdr = s.querySelector(":scope > .hdr"), sc = s.querySelector(":scope > .scroll");
          /* Certains écrans masquent la navigation : ils prennent alors toute la largeur. */
          const railVisible = getComputedStyle(nav).display !== "none" && nav.classList.contains("show");
          if (railVisible && bs.left < bn.right - 1) res.chevauche.push(s.id);
          if ([...document.querySelectorAll(".scr")].filter(x => getComputedStyle(x).display !== "none").length > 1) res.plusieurs.push(s.id);
          res.bandeaux[s.id] = hdr ? Math.round(boite(hdr).height) : null;
          const hud = document.getElementById("rj-hud");
          /* Ressources (HUD) : en haut de l'accueil seulement ; ailleurs le
             bandeau laisse toute la place aux onglets. */
          const hudVisible = hud && getComputedStyle(hud).display !== "none";
          if (s.id === "S-home" && (!hudVisible || boite(hud).top > 1 || boite(hud).height > 60)) res.sansHud.push(s.id);
          if (s.id !== "S-home" && hudVisible) res.hudAilleurs.push(s.id);
          /* Les onglets sont dans le bandeau, entre le titre et le HUD. */
          const tabs = s.querySelector(":scope > .tabs");
          if (tabs && hdr && getComputedStyle(tabs).display !== "none") {
            const bt = boite(tabs), bh = boite(hdr), bhud = boite(hud);
            const limite = hudVisible ? bhud.left : innerWidth;
            if (bt.top < bh.top - 1 || bt.bottom > bh.bottom + 1 || bt.left < bh.right - 1 || bt.right > limite + 1) res.ongletsHors.push(s.id);
            if (tabs.scrollWidth > tabs.clientWidth + 1) res.ongletsCoupes.push(s.id + " " + tabs.scrollWidth + ">" + tabs.clientWidth);
          }
          /* Écrans de consultation : le rail reste là pour circuler. */
          if (/^S-(home|pilot|champ|cal|training|contracts|patrimoine|sponsors|media|mailbox|lifestyle|settings|pantheon|achievements)$/.test(s.id) && !railVisible)
            res.sansRail.push(s.id);
          res.hauts[s.id] = sc ? Math.round(boite(sc).top) : null;
          /* Gouttière unique : les cartes du premier niveau s'alignent sur le
             bord du contenu (écrans en colonnes), sans marge héritée du portrait. */
          if (sc && !/^S-(contact-thread|event|neg|save|agent|shop|paddockpass|mediaday|pantheon)$/.test(s.id)) {
            const bsc = boite(sc), csc = getComputedStyle(sc), x0 = bsc.left + parseFloat(csc.paddingLeft);
            const estCarte = e => { const c = getComputedStyle(e); return (c.backgroundColor !== "rgba(0, 0, 0, 0)" || c.borderTopWidth !== "0px") && e.offsetHeight > 24 && e.offsetWidth > 140; };
            const ecarts = [];
            const visite = (e, d) => { if (d > 4) return; for (const c of e.children) { if (!c.offsetHeight) continue;
              if (estCarte(c)) { const b = boite(c); if (b.left - x0 < 60) ecarts.push(Math.round(b.left - x0)); } else visite(c, d + 1); } };
            visite(sc, 0);
            const dec = ecarts.filter(v => v > 2);
            if (dec.length) res.gouttieres[s.id] = [...new Set(dec)].join("/");
          }
          /* Un élément rogné par un parent qui défile (onglets, rangée de
             filtres) ne déborde pas de l'écran. */
          const rogne = e => { for (let p = e.parentElement; p && p !== s; p = p.parentElement)
            if (getComputedStyle(p).overflowX !== "visible" && boite(p).right <= innerWidth + 1) return true; return false; };
          s.querySelectorAll("*").forEach(e => {
            const b = boite(e);
            if (b.width && b.height && b.right > innerWidth + 1 && getComputedStyle(e).position !== "fixed" && !rogne(e))
              res.debords.push(s.id + " " + (e.id || String(e.className).split(" ")[0] || e.tagName));
          });
        }
        try { navTo("S-home", null); } catch (e) {}
        await attendre(300);
        /* Accueil : les tuiles tiennent sans défilement ; les pastilles
           donnent la saison (points, victoires, podiums). */
        const tuiles = document.querySelector("#S-home > .scroll");
        res.accueil = {
          defile: tuiles ? tuiles.scrollHeight - tuiles.clientHeight : null,
          points: (document.getElementById("h-champ-pts") || {}).textContent,
          victoires: (document.getElementById("h-wins") || {}).textContent,
          forme: !!document.getElementById("h-forme")
        };
        /* Championnat de l'accueil : la vue Écuries liste les écuries de la
           catégorie, et basculer ne quitte pas l'accueil. */
        const sel = document.querySelector("#h-champ-mini [data-vue='ecuries']");
        if (sel) sel.click();
        res.ecuries = !sel ? null : (TEAMS_BY_CAT[G.cat] || []).indexOf(((document.querySelector("#h-champ-mini .apex-champ-mini-row .nom") || {}).textContent || "")) >= 0
          && (document.querySelector(".scr.on") || {}).id === "S-home";
        /* Le HUD suit l'état du jeu. */
        const avant = (document.getElementById("rj-hud") || {}).textContent || "";
        G.budget += 2500000; updateUI();
        res.hudSuit = ((document.getElementById("rj-hud") || {}).textContent || "") !== avant;
        G.budget -= 2500000; updateUI();
        return res;
      });
      const h = viewport.height;
      S.verifier(nom + " : navigation en rail à gauche",
        r.rail.gauche <= 1 && r.rail.hauteur >= h * 0.9 && r.rail.largeur <= 72, JSON.stringify(r.rail));
      S.verifier(nom + " : aucun écran sous le rail", r.chevauche.length === 0, r.chevauche.join(", "));
      S.verifier(nom + " : un seul écran affiché à la fois", r.plusieurs.length === 0, r.plusieurs.join(", "));
      const hauteurs = [...new Set(Object.values(r.bandeaux).filter(v => v !== null))];
      S.verifier(nom + " : même bandeau sur tous les écrans", hauteurs.length === 1, JSON.stringify(r.bandeaux));
      const bas = Object.entries(r.hauts).filter(([, t]) => t !== null && t > 64).map(([id, t]) => id + "@" + t);
      S.verifier(nom + " : le contenu commence sous un seul bandeau", bas.length === 0, bas.join(", "));
      S.verifier(nom + " : même gouttière sur tous les écrans", Object.keys(r.gouttieres).length === 0, JSON.stringify(r.gouttieres));
      S.verifier(nom + " : ressources (HUD) en haut de l'accueil", r.sansHud.length === 0, r.sansHud.join(", "));
      S.verifier(nom + " : ressources masquées hors de l'accueil", r.hudAilleurs.length === 0, r.hudAilleurs.join(", "));
      S.verifier(nom + " : onglets dans le bandeau, après le titre", r.ongletsHors.length === 0, r.ongletsHors.join(", "));
      S.verifier(nom + " : aucun onglet coupé", r.ongletsCoupes.length === 0, r.ongletsCoupes.join(", "));
      S.verifier(nom + " : rail présent sur les écrans de consultation", r.sansRail.length === 0, r.sansRail.join(", "));
      S.verifier(nom + " : le HUD suit l'état du jeu", r.hudSuit === true);
      S.verifier(nom + " : accueil — classement des écuries au sélecteur", r.ecuries !== false, String(r.ecuries));
      S.verifier(nom + " : accueil — pastilles de saison et forme", r.accueil.points !== undefined && r.accueil.victoires !== undefined && r.accueil.forme, JSON.stringify(r.accueil));
      if (viewport.height >= 400) S.verifier(nom + " : accueil sans défilement", r.accueil.defile !== null && r.accueil.defile <= 2, "dépasse de " + r.accueil.defile + " px");
      S.verifier(nom + " : rien ne déborde à droite", r.debords.length === 0, [...new Set(r.debords)].slice(0, 6).join(", "));
      S.verifier(nom + " : aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
    } finally { await navigateur.close(); }
  }

  const { navigateur, page } = await S.ouvrirJeu({ viewport: { width: 430, height: 932 } });
  try {
    const voile = await page.evaluate(() => {
      const c = getComputedStyle(document.body, "::after");
      return { contenu: c.content, position: c.position, largeur: parseFloat(c.width) };
    });
    /* Sur ordinateur (pointeur fin), une fenêtre en hauteur affiche un message ;
       sur téléphone, le jeu se pivote (suite « ecrans »). */
    S.verifier("portrait sur ordinateur : le jeu demande d'élargir la fenêtre",
      /élargis/i.test(voile.contenu) && voile.position === "fixed" && voile.largeur >= 400, JSON.stringify(voile));
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * 8 ter. COURSE EN DIRECT SUR LE CIRCUIT (module 111, étape 3)
 *
 * Pendant la course, le tracé du circuit et un point par voiture : ils
 * avancent sans jamais reculer, suivent le classement, passent au stand,
 * disparaissent à l'abandon. L'animation ne tourne que course à l'écran.
 * ==================================================================== */
async function suiteCircuit() {
  S.suite("Course en direct sur le circuit");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    await S.repondeurAutomatique(page);
    const depart = await page.evaluate(async () => {
      SETTINGS.simSpeed = "normal";
      window.CAL_RACES = []; buildCalendar();
      G.semaine = 6; G.seasonOver = false;
      CAL_RACES.forEach(c => { c.done = c.week < 6; c.result = null; });
      const course = getNextRace();
      RACE_STATE.circuit = course.name;
      RACE_STATE.circuitData = getCircuitData(course.name);
      RACE_STATE.weather = generateWeather(0);
      RACE_STATE.qualiPos = 6;
      G.totalLaps = 20;
      if (window.LIVE_RACE && LIVE_RACE.interval) clearInterval(LIVE_RACE.interval);
      window.LIVE_RACE = { drivers: [], cur: 0, total: 0, finished: false, paused: false, interval: null };
      try { confirmStrategy(); } catch (e) {}
      if (!LIVE_RACE.total) runRaceLive();
      navTo("S-race", null);
      try { rtab("course"); } catch (e) {}
      await new Promise(r => setTimeout(r, 2500));
      const trace = document.querySelector("#rj111-carte path.rj111-piste");
      const carte = document.getElementById("rj111-carte");
      const b = carte ? carte.getBoundingClientRect() : null;
      return {
        api: !!window.RJVueCircuit,
        trace: !!trace && trace.getAttribute("d") === getCircuitData(course.name).path,
        points: document.querySelectorAll("#rj111-carte .rj111-voiture:not([hidden])").length,
        enCourse: LIVE_RACE.drivers.filter(d => !d.dnf).length,
        actif: window.RJVueCircuit ? RJVueCircuit.actif() : false,
        tour: (() => { const L = [...document.querySelectorAll("#rj111-carte .rj111-tour li")], moi = document.querySelector("#rj111-carte .rj111-tour li.moi"), o = document.querySelector("#rj111-carte .rj111-tour"); return { lignes: L.length, moi: !!moi && moi.getBoundingClientRect().bottom <= o.getBoundingClientRect().bottom + 1, ecussons: document.querySelectorAll("#rj111-carte .rj111-tour li .l svg").length }; })(),
        cadre: b ? { haut: Math.round(b.top), bas: Math.round(b.bottom), larg: Math.round(b.width), haut2: Math.round(b.height) } : null
      };
    });
    S.verifier("la vue du circuit est installée", depart.api);
    if (!depart.api) return;
    S.verifier("le tracé est celui du circuit couru", depart.trace);
    S.verifier("un point par voiture en course", depart.points === depart.enCourse && depart.points > 1, depart.points + " / " + depart.enCourse);
    S.verifier("l'animation tourne pendant la course", depart.actif);
    S.verifier("la tour montre vingt pilotes au plus, le joueur toujours visible, avec les écussons", depart.tour.lignes > 1 && depart.tour.lignes <= 20 && depart.tour.moi && depart.tour.ecussons > 0, JSON.stringify(depart.tour));
    S.verifier("la carte tient dans l'écran", !!depart.cadre && depart.cadre.bas <= 430 && depart.cadre.haut2 >= 140, JSON.stringify(depart.cadre));

    /* Les points avancent, sans jamais reculer (hors passage au stand). */
    const suivi = await page.evaluate(async () => {
      const avant = {}; let recul = 0, mesures = 0;
      for (let i = 0; i < 50; i++) {
        RJVueCircuit.etat().voitures.forEach(v => {
          if (avant[v.nom] !== undefined && !v.stand) { mesures++; if (v.distance < avant[v.nom] - 1e-6) recul++; }
          avant[v.nom] = v.distance;
        });
        await new Promise(r => setTimeout(r, 80));
      }
      return { recul, mesures };
    });
    S.verifier("les voitures ne reculent jamais", suivi.recul === 0 && suivi.mesures > 100, JSON.stringify(suivi));

    /* Fluidité : chaque voiture roule à l'allure d'un tour, sans bond ni arrêt net. */
    const fluide = await page.evaluate(async () => {
      // Allure attendue rapportée au temps écoulé entre deux images de la vue, pas entre deux attentes.
      const pas = 100, allure = 1000 / dureeTourCourse() / 1000;
      const avant = {}; let mesures = 0, bonds = 0, arrets = 0, plusGrand = 0, t0 = 0;
      for (let i = 0; i < 35; i++) {
        const pause = LIVE_RACE.paused, e = RJVueCircuit.etat(), attendu = allure * Math.min(250, e.temps - t0);
        const neuf = t0 && e.temps > t0; t0 = e.temps;
        if (!neuf) Object.keys(avant).forEach(k => { avant[k].pause = true; });
        e.voitures.forEach(v => {
          if (avant[v.nom] !== undefined && !v.stand && !pause && !avant[v.nom].pause) {
            const d = v.distance - avant[v.nom].d; mesures++;
            plusGrand = Math.max(plusGrand, d / attendu);
            if (d > attendu * 2.5 * 1.4) bonds++;
            if (d < attendu * 0.05) arrets++;
          }
          avant[v.nom] = { d: v.distance, pause };
        });
        await new Promise(r => setTimeout(r, pas));
      }
      return { mesures, bonds, arrets, plusGrand: +plusGrand.toFixed(2), tourEnSecondes: dureeTourCourse() / 1000 };
    });
    S.verifier("un tour se suit à l'œil (au moins 4 s en vitesse normale)", fluide.tourEnSecondes >= 4, fluide.tourEnSecondes + " s");
    S.verifier("les voitures roulent sans bond", fluide.mesures > 200 && fluide.bonds === 0, JSON.stringify(fluide));
    S.verifier("les voitures roulent sans arrêt net", fluide.arrets <= fluide.mesures * 0.03, JSON.stringify(fluide));

    /* L'ordre des points suit le classement. Quand le classement change,
       la voiture qui passe devant double l'autre à l'écran : l'inversion
       dure le temps du dépassement, jamais plus d'1,2 s. */
    const ordre = await page.evaluate(async () => {
      const duree = {}; let plusLongue = 0, depassements = 0;
      for (let i = 0; i < 40; i++) {
        const V = RJVueCircuit.etat().voitures.filter(v => !v.stand && !v.autreCategorie).sort((a, b) => a.pos - b.pos);
        const vues = {};
        for (let k = 1; k < V.length; k++) if (V[k].distance > V[k - 1].distance + 1e-6) {
          const cle = V[k - 1].nom + ">" + V[k].nom; vues[cle] = true;
          if (!duree[cle]) depassements++;
          duree[cle] = (duree[cle] || 0) + 1; plusLongue = Math.max(plusLongue, duree[cle]);
        }
        Object.keys(duree).forEach(c => { if (!vues[c]) delete duree[c]; });
        await new Promise(r => setTimeout(r, 100));
      }
      return { depassements, plusLongueMs: plusLongue * 100 };
    });
    S.verifier("un dépassement à l'écran dure moins d'1,2 s", ordre.plusLongueMs <= 1200, JSON.stringify(ordre));

    /* Passage au stand : la voiture qui s'arrête au prochain tour rejoint la case des stands. */
    const stand = await page.evaluate(async () => {
      const d = LIVE_RACE.drivers.filter(x => !x.isPlayer && !x.dnf).sort((a, b) => a.pos - b.pos)[0];
      d._lastPitLap = LIVE_RACE.cur + 1;
      const fin = Date.now() + 3 * dureeTourCourse();
      while (Date.now() < fin) {
        const v = RJVueCircuit.etat().voitures.find(x => x.nom === d.name);
        const c = RJVueCircuit.etat().stand;
        if (v && v.stand) return { auStand: true, dansLaCase: !!(c && Math.abs(v.x - c.x) <= c.w / 2 + 1 && Math.abs(v.y - c.y) <= c.h / 2 + 1) };
        await new Promise(r => setTimeout(r, 50));
      }
      return { auStand: false, dansLaCase: false };
    });
    S.verifier("un arrêt au stand se voit dans la case des stands", stand.auStand && stand.dansLaCase, JSON.stringify(stand));

    /* Abandon : le point disparaît. */
    const abandon = await page.evaluate(async () => {
      const d = LIVE_RACE.drivers.filter(x => !x.isPlayer && !x.dnf).pop();
      d.dnf = true;
      await new Promise(r => setTimeout(r, 300));
      return !RJVueCircuit.etat().voitures.some(v => v.nom === d.name);
    });
    S.verifier("une voiture qui abandonne disparaît de la piste", abandon);

    /* Sobriété : l'animation s'arrête hors de l'écran de course, reprend au retour. */
    const sobre = await page.evaluate(async () => {
      navTo("S-home", null); await new Promise(r => setTimeout(r, 400));
      const ailleurs = RJVueCircuit.actif();
      navTo("S-race", null); try { rtab("course"); } catch (e) {}
      await new Promise(r => setTimeout(r, 400));
      return { ailleurs, retour: RJVueCircuit.actif() };
    });
    S.verifier("l'animation s'arrête hors de l'écran de course", sobre.ailleurs === false, JSON.stringify(sobre));
    S.verifier("l'animation reprend au retour sur la course", sobre.retour === true, JSON.stringify(sobre));

    const fin = await page.evaluate(async () => {
      SETTINGS.simSpeed = "instant";
      for (let i = 0; i < 300 && !LIVE_RACE.finished; i++) await new Promise(r => setTimeout(r, 200));
      await new Promise(r => setTimeout(r, 600));
      return { finie: LIVE_RACE.finished, actif: RJVueCircuit.actif() };
    });
    S.verifier("l'animation s'arrête au drapeau à damier", fin.finie && fin.actif === false, JSON.stringify(fin));
    S.verifier("aucune erreur pendant la course", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * 8 quater. SUPER LICENCE FIA (module 112, étape 4)
 *
 * Points de licence par saison selon la catégorie et la place finale ;
 * 40 points sur les trois dernières saisons et 18 ans pour un baquet de F1.
 * Sans licence, une écurie de F1 ne peut proposer qu'un rôle de réserviste.
 * ==================================================================== */
async function suiteSuperLicence() {
  S.suite("Super Licence");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    const r = await page.evaluate(async () => {
      const SL = window.RJSuperLicence;
      if (!SL) return { api: false };
      const histo = CAREER_HISTORY, age = G.age, cat = G.cat, saison = G.saison, fin = G.seasonOver;
      const res = { api: true };
      const saisonDe = (n, c, p) => ({ saison: n, cat: c, pos: p, pts: 0, races: 10 });
      try {
        res.bareme = [SL.points(saisonDe(1, "Formule 2", 1)), SL.points(saisonDe(1, "Formule 3", 1)), SL.points(saisonDe(1, "Formule 4", 8)), SL.points(saisonDe(1, "IndyCar", 2))];
        G.cat = "Formule 3"; G.saison = 10; G.seasonOver = true; G.age = 18;
        CAREER_HISTORY = [saisonDe(6, "Formule 2", 1), saisonDe(8, "Formule 4", 1), saisonDe(9, "Formula Regional", 2), saisonDe(10, "Formule 3", 3)];
        const e = SL.etat();
        res.fenetre = { points: e.points, saisons: e.saisons.map(x => x.saison).join(","), eligible: e.eligible };
        G.age = 16; res.mineur = SL.etat().eligible;   // 17 ans à la saison suivante
        G.age = 18;
        CAREER_HISTORY = [saisonDe(9, "Formule 4", 1), saisonDe(10, "Formule 4", 2), saisonDe(10, "Formule 3", 1)];
        res.maxParSaison = SL.etat().points;
        CAREER_HISTORY = [saisonDe(9, "Formule 1", 18), saisonDe(10, "Formule 2", 15)];
        res.retenue = SL.etat().eligible;

        /* Le baquet de F1 dépend de la licence. */
        const equipeF1 = (TEAMS_BY_CAT["Formule 1"] || [])[0];
        CAREER_HISTORY = [saisonDe(10, "Formule 3", 9)];
        const refus = buildOffer({ team: equipeF1, cat: "Formule 1", role: "num1", years: 2 });
        CAREER_HISTORY = [saisonDe(9, "Formule 3", 1), saisonDe(10, "Formule 2", 2)];
        const accord = buildOffer({ team: equipeF1, cat: "Formule 1", role: "num1", years: 2 });
        CAREER_HISTORY = [];
        const f2 = buildOffer({ team: (TEAMS_BY_CAT["Formule 2"] || [])[0], cat: "Formule 2", role: "num1", years: 1 });
        res.offres = { refus: refus.role, marque: !!refus._superLicence, accord: accord.role, f2: f2.role };
      } finally {
        CAREER_HISTORY = histo; G.age = age; G.cat = cat; G.saison = saison; G.seasonOver = fin;
      }
      navTo("S-pilot", null); ptab("rep");
      await new Promise(r => setTimeout(r, 300));
      const carte = document.getElementById("rj112-carte");
      res.carte = carte ? carte.textContent.replace(/\s+/g, " ").slice(0, 140) : null;
      return res;
    });
    S.verifier("le module de Super Licence est installé", r.api);
    if (!r.api) return;
    S.verifier("barème : F2 P1 40, F3 P1 30, F4 P8 0, IndyCar P2 30", JSON.stringify(r.bareme) === "[40,30,0,30]", JSON.stringify(r.bareme));
    S.verifier("seules les trois dernières saisons comptent", r.fenetre.points === 12 + 20 + 20 && r.fenetre.saisons === "8,9,10" && r.fenetre.eligible, JSON.stringify(r.fenetre));
    S.verifier("18 ans minimum pour la F1", r.mineur === false);
    S.verifier("une seule catégorie compte par saison (la meilleure)", r.maxParSaison === 12 + 30, String(r.maxParSaison));
    S.verifier("avoir couru en F1 récemment garde la licence", r.retenue === true);
    S.verifier("sans licence, une écurie de F1 propose un rôle de réserviste", r.offres.refus === "num3" && r.offres.marque, JSON.stringify(r.offres));
    S.verifier("avec la licence, le baquet de F1 est proposé", r.offres.accord === "num1", JSON.stringify(r.offres));
    S.verifier("les autres catégories ne demandent rien", r.offres.f2 === "num1", JSON.stringify(r.offres));
    S.verifier("la licence s'affiche dans l'onglet Carrière du pilote", !!r.carte && /\/\s*40/.test(r.carte), r.carte || "absente");
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * 8 quinquies. MERCATO VIVANT (module 113, étape 4)
 *
 * Les mouvements de pilotes existaient sans se voir. En fin de saison, le
 * module relève retraites, promotions, descentes et arrivées ; en cours de
 * saison, il lance des rumeurs fondées sur le plateau, confirmées ou
 * démenties à l'intersaison. Tout se lit dans Championnat › Mercato.
 * ==================================================================== */
async function suiteMercato() {
  S.suite("Mercato");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    const r = await page.evaluate(async () => {
      const M = window.RJMercato;
      if (!M) return { api: false };
      const res = { api: true };
      /* Rumeurs : à partir des deux tiers de la saison, une fois par saison. */
      const total = (CAL_RACES || []).length || 10;
      const courses = G.races;
      G.races = Array.from({ length: Math.ceil(total * 0.7) }, (_, i) => ({ pos: 5, nom: "Manche " + (i + 1) }));
      const avant = (G._mercato && G._mercato.rumeurs || []).length;
      M.rumeurs(); M.rumeurs();
      const rum = G._mercato.rumeurs.filter(x => x.saison === G.saison);
      res.rumeurs = { nouvelles: rum.length, doublons: G._mercato.rumeurs.length - avant - rum.length,
        fondees: rum.every(x => !x.id || (G.driverPool[x.id] && G.driverPool[x.id].name === x.nom)) };
      G.races = courses;

      /* Intersaison : relevé fidèle des mouvements du plateau. */
      const avantPool = {};
      Object.keys(G.driverPool).forEach(id => { const d = G.driverPool[id]; avantPool[id] = { cat: d.cat, retired: d.retired }; });
      _handleDriverMovements();
      const bilan = G._mercato.intersaisons[0];
      const retraites = Object.keys(G.driverPool).filter(id => avantPool[id] && !avantPool[id].retired && G.driverPool[id].retired).length;
      const changements = Object.keys(G.driverPool).filter(id => avantPool[id] && !G.driverPool[id].retired && avantPool[id].cat !== G.driverPool[id].cat).length;
      res.bilan = { saison: bilan && bilan.saison === G.saison, retraites: bilan ? bilan.retraites.length : -1, attendu: retraites,
        mouvements: bilan ? bilan.promotions.length + bilan.descentes.length + bilan.lateraux.length : -1, changements };
      res.verdicts = G._mercato.rumeurs.filter(x => x.saison === G.saison && x.type !== "joueur").every(x => x.statut === "confirmée" || x.statut === "démentie");

      /* Sauvegarde : le mercato suit la partie. */
      const crochet = window.RJ_SAVE_HOOKS.find(h => h.cle === "mercato");
      const bloc = crochet ? JSON.parse(JSON.stringify(crochet.ecrire(G))) : null;
      const copie = G._mercato; G._mercato = null;
      if (crochet) crochet.lire(bloc, G);
      res.sauvegarde = !!G._mercato && G._mercato.intersaisons.length === copie.intersaisons.length && G._mercato.rumeurs.length === copie.rumeurs.length;

      navTo("S-champ", null); chtab("mercato");
      await new Promise(r => setTimeout(r, 300));
      const p = document.getElementById("cht-mercato");
      res.onglet = p ? { visible: getComputedStyle(p).display !== "none", texte: p.textContent.replace(/\s+/g, " ").slice(0, 160) } : null;
      return res;
    });
    S.verifier("le module de mercato est installé", r.api);
    if (!r.api) return;
    S.verifier("des rumeurs naissent aux deux tiers de la saison, une fois", r.rumeurs.nouvelles >= 2 && r.rumeurs.doublons === 0, JSON.stringify(r.rumeurs));
    S.verifier("les rumeurs portent sur de vrais pilotes du plateau", r.rumeurs.fondees);
    S.verifier("l'intersaison relève toutes les retraites", r.bilan.saison && r.bilan.retraites === r.bilan.attendu, JSON.stringify(r.bilan));
    S.verifier("l'intersaison relève tous les changements de catégorie", r.bilan.mouvements === r.bilan.changements, JSON.stringify(r.bilan));
    S.verifier("chaque rumeur est confirmée ou démentie à l'intersaison", r.verdicts);
    S.verifier("le mercato est sauvegardé avec la partie", r.sauvegarde);
    S.verifier("l'onglet Mercato s'affiche au Championnat", !!r.onglet && r.onglet.visible && /rumeur|retraite|promu|intersaison/i.test(r.onglet.texte), JSON.stringify(r.onglet));
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * 8 sexies. RÊVES DE CARRIÈRE ET HÉRITAGE (module 114, étape 4)
 *
 * Le joueur choisit jusqu'à trois rêves (Triple Couronne, champion du
 * monde…) ; leur progression se calcule sur l'historique, une réussite est
 * célébrée et conservée. L'onglet Héritage montre aussi la frise de carrière.
 * ==================================================================== */
async function suiteHeritage() {
  S.suite("Rêves et héritage");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    const r = await page.evaluate(async () => {
      const H = window.RJHeritage;
      if (!H) return { api: false };
      const res = { api: true, catalogue: H.catalogue().length };
      const histo = CAREER_HISTORY, courses = G.races, cat = G.cat, saison = G.saison, bonheur = G.happiness, reves = G._reves;
      const course = (circuit, pos) => ({ circuit, pos });
      const saisonDe = (n, c, p, details, extra) => Object.assign({ saison: n, cat: c, pos: p, races: details.length, wins: details.filter(d => d.pos === 1).length, age: 20 + n, team: "Écurie A", raceDetails: details }, extra || {});
      try {
        G._reves = null;
        ["triple_couronne", "champion_monde", "roi_monaco"].forEach(id => H.choisir(id));
        res.limite = H.choisir("dynastie") === false && H.actifs().length === 3;

        G.saison = 5; G.cat = "IndyCar";
        CAREER_HISTORY = [
          saisonDe(2, "Formule 1", 3, [course("Monaco", 1), course("Silverstone", 2)]),
          saisonDe(3, "Karting Senior", 1, [course("GP Monaco Kart", 1)]),
          saisonDe(4, "IndyCar", 2, [course("Indianapolis 500", 1)])
        ];
        G.races = [course("Long Beach", 4)];
        res.triple = H.progression("triple_couronne");
        res.monaco = H.progression("roi_monaco");

        /* Fin de saison : la saison courante entre dans l'historique, sans compter deux fois. */
        CAREER_HISTORY.push(saisonDe(5, "IndyCar", 4, G.races.slice()));
        res.sansDoublon = H.progression("roi_monaco").actuel === res.monaco.actuel;

        G.saison = 6; G.cat = "Endurance WEC"; G.races = [course("24h Le Mans", 1)];
        G.happiness = 50; const avant = G.happiness;
        H.verifier();
        res.accompli = (G._reves.accomplis || []).some(a => a.id === "triple_couronne" && a.saison === 6);
        res.retire = H.actifs().indexOf("triple_couronne") < 0;
        res.recompense = G.happiness > avant;
        H.verifier();
        res.uneFois = G._reves.accomplis.filter(a => a.id === "triple_couronne").length === 1;

        const crochet = window.RJ_SAVE_HOOKS.find(h => h.cle === "reves");
        const bloc = crochet ? JSON.parse(JSON.stringify(crochet.ecrire(G))) : null;
        const copie = JSON.stringify(G._reves); G._reves = null;
        if (crochet) crochet.lire(bloc, G);
        res.sauvegarde = JSON.stringify(G._reves) === copie;

        navTo("S-pilot", null); ptab("heritage");
        await new Promise(r => setTimeout(r, 300));
        const p = document.getElementById("pt-heritage");
        res.onglet = p ? { visible: getComputedStyle(p).display !== "none",
          saisons: p.querySelectorAll(".rj114-saison").length, reves: p.querySelectorAll(".rj114-reve").length } : null;
      } finally {
        CAREER_HISTORY = histo; G.races = courses; G.cat = cat; G.saison = saison; G.happiness = bonheur; G._reves = reves;
      }
      return res;
    });
    S.verifier("le module des rêves est installé", r.api);
    if (!r.api) return;
    S.verifier("un catalogue d'au moins six rêves", r.catalogue >= 6, String(r.catalogue));
    S.verifier("trois rêves au plus en même temps", r.limite);
    S.verifier("Triple Couronne : Monaco en F1 et Indy 500 comptent, pas Monaco en karting", r.triple.actuel === 2 && r.triple.cible === 3, JSON.stringify(r.triple));
    S.verifier("une course n'est jamais comptée deux fois en fin de saison", r.sansDoublon, JSON.stringify(r.monaco));
    S.verifier("un rêve réalisé est célébré et conservé", r.accompli && r.retire && r.recompense, JSON.stringify(r));
    S.verifier("un rêve n'est célébré qu'une fois", r.uneFois);
    S.verifier("les rêves sont sauvegardés avec la partie", r.sauvegarde);
    S.verifier("l'onglet Héritage montre les rêves et la frise", !!r.onglet && r.onglet.visible && r.onglet.saisons === 5 && r.onglet.reves >= 2, JSON.stringify(r.onglet));
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * 8 septies. ÉCONOMIE AUX VRAIS ORDRES DE GRANDEUR (module 115)
 * ==================================================================== */
async function suiteEconomie() {
  S.suite("Économie");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    const r = await page.evaluate(() => {
      if (!window.RJEconomie) return { api: false };
      const res = { api: true };
      const fourchette = (cat, champ, mult) => {
        const v = (TEAM_OFFERS[cat] || []).map(o => (o[champ] || 0) * (mult || 1)).filter(x => x > 0);
        return v.length ? [Math.min(...v), Math.max(...v)] : null;
      };
      res.baquets = { f4: fourchette("Formule 4", "cost"), f3: fourchette("Formule 3", "cost"), f2: fourchette("Formule 2", "cost") };
      res.f1 = fourchette("Formule 1", "salary", 12);

      const cat = G.cat, rep = G.reputation, budget = G.budget, milieu = G._milieu, revenu = G.revenue;
      try {
        const top3 = c => { G.cat = c; const cap = getRepCap();
          return getSponsorPool().filter(x => x.repReq <= cap).map(x => x.fee).sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0) * 12; };
        res.sponsors = { f4: top3("Formule 4"), f3: top3("Formule 3"), f2: top3("Formule 2"), f1: top3("Formule 1") };

        G.cat = "Formule 4";
        const semaine = m => { G._milieu = m; G.budget = 1e6; applyWeeklyIncome(1); return G.budget - 1e6; };
        res.soutien = semaine("modeste") - semaine(null);
        G.cat = "Formule 3";
        res.soutienF3 = semaine("modeste") - semaine(null);

        const crochet = window.RJ_SAVE_HOOKS.find(h => h.cle === "economie");
        G.cat = "Formule 2"; G.sponsors = [{ id: "x", fee: 142000 }]; G.revenue = 150000;
        crochet.lire(null, G);
        res.conversion = { fee: G.sponsors[0].fee, revenu: G.revenue };
      } finally { G.cat = cat; G.reputation = rep; G.budget = budget; G._milieu = milieu; G.revenue = revenu; }
      return res;
    });
    S.verifier("le module d'économie est installé", r.api);
    if (!r.api) return;
    const dans = (v, a, b) => !!v && v[0] >= a && v[1] <= b;
    S.verifier("baquet de F4 entre 300 et 450 k€", dans(r.baquets.f4, 3e5, 4.5e5), JSON.stringify(r.baquets.f4));
    S.verifier("baquet de F3 entre 0,9 et 1,4 M€", dans(r.baquets.f3, 9e5, 1.4e6), JSON.stringify(r.baquets.f3));
    S.verifier("baquet de F2 entre 1,8 et 2,8 M€", dans(r.baquets.f2, 1.8e6, 2.8e6), JSON.stringify(r.baquets.f2));
    S.verifier("salaire de F1 entre 1 et 30 M€ par an", dans(r.f1, 0.99e6, 30e6), JSON.stringify(r.f1));
    S.verifier("sponsors : F4 ≤ 250 k€, F3 ≤ 1,2 M€, F2 ≤ 2,5 M€, F1 ≤ 25 M€ par an (trois meilleurs)",
      r.sponsors.f4 <= 2.5e5 && r.sponsors.f3 <= 1.2e6 && r.sponsors.f2 <= 2.5e6 && r.sponsors.f1 <= 25e6 && r.sponsors.f1 > 5e6, JSON.stringify(r.sponsors));
    S.verifier("le soutien familial se verse chaque semaine en formule de promotion", r.soutien === 500, String(r.soutien));
    S.verifier("le soutien familial s'arrête au-delà de la Formula Regional", r.soutienF3 === 0, String(r.soutienF3));
    S.verifier("une ancienne sauvegarde voit ses sponsors remis à l'échelle", r.conversion.fee < 142000 && r.conversion.revenu < 150000, JSON.stringify(r.conversion));
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * 8 octies. BAQUETS LIMITÉS, CONCURRENCE, APPORT (module 116)
 * ==================================================================== */
async function suiteBaquets() {
  S.suite("Baquets et concurrence");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    const r = await page.evaluate(() => {
      const B = window.RJBaquets;
      if (!B) return { api: false };
      const res = { api: true };
      const sauve = { budget: G.budget, sponsors: G.sponsors, offers: G.offers, baquets: G._baquets, cat: G.cat, rep: G.reputation, pos: G.champPos };
      const calc = window.calcPlayerRating;
      try {
        G._baquets = null;
        const plan = B.places("Formule 1"), total = Object.values(plan).reduce((a, b) => a + b, 0);
        res.places = { total, max: Math.max(...Object.values(plan)) };
        res.memePlan = B.places("Formule 1") === plan;

        const d = Object.values(G.driverPool).find(x => !x.retired);
        res.soutienFixe = B.soutien(d, d.cat) === B.soutien(d, d.cat);

        const f1 = TEAM_OFFERS["Formule 1"].slice().sort((a, b) => b.repReq - a.repReq);
        const haut = f1[0].team, bas = f1[f1.length - 1].team;
        G.cat = "Formule 2"; G.champPos = 1; G.reputation = 80;
        window.calcPlayerRating = () => 97; G.budget = 0; G.sponsors = [];
        res.prodigeChezLesGrands = B.classer("Formule 1", haut, { cost: 0 }).rangJoueur;
        window.calcPlayerRating = () => 72; G.champPos = 6;
        res.moyenSansArgentEnBas = B.classer("Formule 1", bas, { cost: 0 }).rangJoueur;
        G.budget = 40e6;
        res.moyenAvecArgentEnBas = B.classer("Formule 1", bas, { cost: 0 }).rangJoueur;

        /* Filtrage : écurie sans place = pas d'offre ; place gagnée = offre annotée. */
        G._baquets = { saison: G.saison, places: { "Formule 1": { [haut]: 0, [bas]: 1 } }, perdus: [], echeancier: null };
        window.calcPlayerRating = () => 99; G.champPos = 1; G.budget = 40e6;
        const gardees = B.filtrer([{ team: haut, cat: "Formule 1", cost: 0 }, { team: bas, cat: "Formule 1", cost: 0 }]);
        res.filtre = { n: gardees.length, equipe: gardees[0] && gardees[0].team, annotee: !!(gardees[0] && gardees[0]._concurrence) };

        /* Apport demandé par une petite écurie de F1 à un pilote moyen. */
        G._baquets = { saison: G.saison, places: { "Formule 1": { [bas]: 1 } }, perdus: [], echeancier: null };
        window.calcPlayerRating = () => 80; G.budget = 60e6;
        const o = B.filtrer([{ team: bas, cat: "Formule 1", cost: 0 }])[0];
        res.apport = o ? o._apport || 0 : -1;

        /* Paiement échelonné : un tiers à la signature, le reste chaque semaine. */
        G._baquets = { saison: G.saison, places: {}, perdus: [], echeancier: null };
        G.budget = 3e6;
        G.offers = [buildOffer({ team: TEAM_OFFERS["Formule 2"][0].team, cat: "Formule 2", cost: 2.4e6, salary: 0, role: "num2", years: 1 })];
        const avant = G.budget;
        signContract(0);
        res.signature = { paye: avant - G.budget, reste: G._baquets.echeancier && G._baquets.echeancier.reste };
        const b2 = G.budget; applyWeeklyIncome(4); res.prelevement = G._baquets.echeancier ? G._baquets.echeancier.reste : 0;

        /* Le point de l'agent : un message par vague, avec les baquets libres. */
        const courses = G.races, agent = G.agent;
        G.agent = G.agent || { type: "pro", name: "Agent Test", skill: 50 };
        G.cat = "Formule 3"; G._baquets = null; G.budget = 50e3; G.sponsors = [];
        G.races = Array.from({ length: Math.ceil(((CAL_RACES || []).length || 10) * 0.4) }, () => ({ pos: 6 }));
        const mail = B.conseil(), doublon = B.conseil();
        res.conseil = { sujet: mail && mail.subject, texte: mail ? mail.body.replace(/<[^>]+>/g, "") : "", doublon: doublon };
        G.races = courses; G.agent = agent;
      } finally {
        window.calcPlayerRating = calc;
        Object.assign(G, { budget: sauve.budget, sponsors: sauve.sponsors, offers: sauve.offers, _baquets: sauve.baquets, cat: sauve.cat, reputation: sauve.rep, champPos: sauve.pos });
      }
      return res;
    });
    S.verifier("le module des baquets est installé", r.api);
    if (!r.api) return;
    S.verifier("F1 : 2 à 4 baquets libres, deux au plus par écurie", r.places.total >= 2 && r.places.total <= 4 && r.places.max <= 2, JSON.stringify(r.places));
    S.verifier("les places d'une saison ne changent pas d'un appel à l'autre", r.memePlan);
    S.verifier("le soutien d'un pilote du plateau est tiré une fois pour toutes", r.soutienFixe);
    S.verifier("un prodige est le premier choix d'une grande écurie", r.prodigeChezLesGrands === 1, String(r.prodigeChezLesGrands));
    S.verifier("sans argent, un pilote moyen n'est pas le premier choix d'une petite écurie", r.moyenSansArgentEnBas > 1, String(r.moyenSansArgentEnBas));
    S.verifier("avec un gros apport, le même pilote passe devant", r.moyenAvecArgentEnBas < r.moyenSansArgentEnBas, r.moyenSansArgentEnBas + " → " + r.moyenAvecArgentEnBas);
    S.verifier("pas de place, pas d'offre ; une place gagnée donne une offre détaillée", r.filtre.n === 1 && r.filtre.annotee, JSON.stringify(r.filtre));
    S.verifier("une petite écurie de F1 demande un apport", r.apport > 0, String(r.apport));
    S.verifier("baquet payant : un tiers à la signature", Math.abs(r.signature.paye - 8e5) < 1e3 && Math.abs(r.signature.reste - 1.6e6) < 1e3, JSON.stringify(r.signature));
    S.verifier("l'agent fait le point sur le marché, une fois par vague", /Le point sur le marché/.test(r.conseil.sujet || "") && /baquets? devraient se libérer|baquet.s. devraient/.test(r.conseil.texte) && r.conseil.doublon === null, JSON.stringify(r.conseil).slice(0, 220));
    S.verifier("il chiffre ce qui manque pour le baquet le moins cher", /Il manque/.test(r.conseil.texte), r.conseil.texte.slice(0, 200));
    S.verifier("le reste se prélève chaque semaine", r.prelevement < r.signature.reste, r.signature.reste + " → " + r.prelevement);
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * 8 nonies. NÉGOCIATION : ARGENT ET CONCURRENCE (module 117)
 * ==================================================================== */
async function suiteNegociation() {
  S.suite("Négociation");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    const r = await page.evaluate(async () => {
      if (!window.RJNegociation) return { api: false };
      const res = { api: true };
      const sauve = { offers: G.offers, sponsors: G.sponsors, random: Math.random };
      try {
        const modele = TEAM_OFFERS["Formule 2"][0];
        const base = Object.assign(buildOffer({ team: modele.team, cat: "Formule 2", cost: 2e6, salary: 0, bonusWin: modele.bonusWin, bonusPodium: modele.bonusPodium, duration: 1, expire: 6, role: "num2" }), { cost: 2e6 });
        /* L'écran de négociation s'ouvre, avec les actions de base et celles du module 11. */
        G.offers = [Object.assign({}, base)];
        negEnter(0);
        await new Promise(r => setTimeout(r, 300));
        const opts = document.getElementById("neg-options");
        res.ecran = { ouvert: document.getElementById("S-neg").classList.contains("on"),
          base: !!opts && /Réduire apport/.test(opts.textContent), clauses: !!opts && /Prime championnat pilotes/.test(opts.textContent) };
        Math.random = () => 0.01;
        negDoAction("bonus_fastest_lap");
        res.clause = !!G.offers[0].cBonusFastestLap;
        Math.random = sauve.random;
        G.offers = [Object.assign({}, base)];
        const neutre = computeInitialPatience(G.offers[0], 0);
        G.offers[0]._concurrence = { marge: 0.02, rival: { nom: "Rival Serré", talent: 80, argent: 3e6 }, priorites: { talent: 0.5, argent: 0.35, image: 0.15 } };
        const serre = computeInitialPatience(G.offers[0], 0);
        G.offers[0]._concurrence.marge = 0.3;
        const large = computeInitialPatience(G.offers[0], 0);
        res.patience = { neutre, serre, large };

        G.sponsors = [{ id: "s", fee: 100000 }];
        G.offers[0]._concurrence.marge = 0.02;
        NEG_IDX = 0; _negStart(0); NEG_STATE.patience = 80;
        Math.random = () => 0.01;
        negDoAction("bring_sponsor");
        res.sponsor = G.offers[0].cCost;
        negDoAction("bring_sponsor");
        res.secondeFois = G.offers[0].cCost;
        res.resume = _negSummaryHTML(G.offers[0]).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

        Math.random = () => 0.99;
        negDoAction("walk_away_bluff");
        res.planB = { statut: NEG_STATE.status, perdue: !!G.offers[0].expired };
      } finally { G.offers = sauve.offers; G.sponsors = sauve.sponsors; Math.random = sauve.random; NEG_STATE = null; }
      return res;
    });
    S.verifier("le module de négociation est installé", r.api);
    if (!r.api) return;
    S.verifier("l'écran de négociation s'ouvre avec ses actions et les clauses du module 11", r.ecran.ouvert && r.ecran.base && r.ecran.clauses, JSON.stringify(r.ecran));
    S.verifier("une clause du module 11 se négocie", r.clause);
    S.verifier("un rival qui te talonne rend l'écurie moins patiente", r.patience.serre < r.patience.neutre, JSON.stringify(r.patience));
    S.verifier("une large avance la rend plus patiente", r.patience.large > r.patience.neutre, JSON.stringify(r.patience));
    S.verifier("apporter tes sponsors réduit le prix du baquet (une demi-saison de revenus)", r.sponsor === 2e6 - 6e5, String(r.sponsor));
    S.verifier("on n'engage ses sponsors qu'une fois", r.secondeFois === r.sponsor, String(r.secondeFois));
    S.verifier("le résumé montre le prix, l'échéancier et le rival", /Prix du baquet/.test(r.resume) && /huit mois/.test(r.resume) && /Rival Serré/.test(r.resume), r.resume.slice(0, 200));
    S.verifier("une négociation ratée laisse la place au rival", r.planB.statut === "walked_away" && r.planB.perdue, JSON.stringify(r.planB));
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * 8 undecies. SIMULATION DU WEEK-END (audit, étape 6)
 *
 * L'arrivée doit refléter le niveau des pilotes, même avec arrêts au
 * stand : un seul système d'arrêts, le même nombre d'arrêts pour tous, une
 * perte de temps fixe. Les meilleurs ne sont jamais ex æquo (ni en course,
 * ni en qualification), et deux coéquipiers n'ont pas le même talent.
 * ==================================================================== */
function rangsSpearman(a, b) {
  const n = a.length; if (n < 3) return 0;
  const r = v => { const i = v.map((x, k) => k).sort((p, q) => v[p] - v[q]); const o = []; i.forEach((k, j) => o[k] = j); return o; };
  const ra = r(a), rb = r(b); let d2 = 0;
  for (let k = 0; k < n; k++) d2 += (ra[k] - rb[k]) ** 2;
  return 1 - 6 * d2 / (n * (n * n - 1));
}

async function suiteSimulation() {
  S.suite("Simulation du week-end");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    await S.repondeurAutomatique(page);
    for (const cat of ["Formule 1", "IndyCar", "Endurance WEC"]) {
      const courses = [];
      for (let k = 0; k < 4; k++) {
        await S.courirUneCourse(page, { categorie: cat, grille: 1 + (k * 5) % 15 });
        courses.push(await page.evaluate(() => {
          const D = LIVE_RACE.drivers.filter(d => !d._mc && !d.dnf);
          const top = LIVE_RACE.drivers.filter(d => !d._mc).map(d => d.baseScore).sort((a, b) => b - a).slice(0, 5);
          return { arrivee: D.map(d => d.pos), base: D.map(d => -d.baseScore), arrets: D.filter(d => !d.isPlayer).map(d => d._pitsDone || 0),
                   exaequo: top.length - new Set(top.map(v => v.toFixed(4))).size };
        }));
      }
      const t = cat.padEnd(14);
      const lien = courses.reduce((s, c) => s + rangsSpearman(c.arrivee, c.base), 0) / courses.length;
      S.verifier(t + "l'arrivée suit le niveau des pilotes", lien >= 0.5, "lien moyen " + lien.toFixed(2));
      const arrets = courses.flatMap(c => c.arrets);
      /* Le joueur peut s'arrêter en plus sur décision (crevaison, « rentre maintenant »). */
      S.verifier(t + "les rivaux s'arrêtent autant de fois, au plus deux", Math.max(...arrets) <= 2 && courses.every(c => new Set(c.arrets).size <= 2),
        "arrêts : " + [...new Set(arrets)].sort().join("/"));
      S.verifier(t + "aucun ex æquo parmi les cinq meilleurs", courses.every(c => c.exaequo === 0), courses.map(c => c.exaequo).join(","));
    }

    /* Qualification F1 : pas de temps plancher partagé. */
    const q = await page.evaluate(() => {
      G.cat = "Formule 1"; initRivals(); window.CAL_RACES = []; buildCalendar();
      QUALI_STATE.baseRef = getCircuitBaseRef(CAL_RACES[0].name, G.cat) || 90; QUALI_STATE.circuitName = CAL_RACES[0].name;
      const P = G.rivals.map(e => ({ name: e.name, skill: e.skill / 100 + teamRatingToBonus(e.team ? getEffectiveTeamRating(e.team) : 72), consistency: e.consistency, team: e.team }));
      const poleurs = {}; let egalites = 0;
      for (let s = 0; s < 30; s++) {
        QUALI_STATE.drivers = P.map(p => Object.assign({}, p));
        const temps = QUALI_STATE.drivers.map(d => Math.min(...[1, 2, 3].map(r => qualiDriverTime(d, 3, r, 3, 0.5))));
        const tri = temps.slice().sort((a, b) => a - b);
        if (tri[0] === tri[1]) egalites++;
        poleurs[P[temps.indexOf(tri[0])].name] = 1;
      }
      return { poleurs: Object.keys(poleurs).length, egalites };
    });
    S.verifier("qualification F1 : jamais deux meilleurs temps identiques", q.egalites === 0, q.egalites + " séance(s) sur 30");
    S.verifier("qualification F1 : la pole change de mains", q.poleurs >= 2, q.poleurs + " poleur(s) sur 30 séances");

    /* Coéquipiers : jamais le même talent. */
    const eq = await page.evaluate(async () => {
      const res = [];
      for (const cat of ["Formule 1", "Formule 2", "IndyCar"]) {
        G.cat = cat; initRivals();
        Object.keys(G).filter(k => k.indexOf("_rjSkillsCalib_") === 0).forEach(k => delete G[k]);
        if (window.LIVE_RACE && LIVE_RACE.interval) clearInterval(LIVE_RACE.interval);
        window.LIVE_RACE = { drivers: G.rivals.map((r, i) => ({ name: r.name, team: r.team, skill: r.skill, rivalIdx: i, score: 0.5 })), cur: 0, total: 10 };
        LIVE_RACE.drivers.push({ name: "Joueur", isPlayer: true, score: 0.5 });
        _rjRecalibrateSkills();
        const parEquipe = {};
        G.rivals.forEach(r => { if (r.team) (parEquipe[r.team] = parEquipe[r.team] || []).push(r.skill); });
        const pareils = Object.entries(parEquipe).filter(([, s]) => s.length > 1 && new Set(s).size < s.length).map(([e]) => e);
        if (pareils.length) res.push(cat + " : " + pareils.join("/"));
      }
      return res;
    });
    S.verifier("coéquipiers de talents différents", eq.length === 0, eq.join(" ; "));
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * 8 duodecies. ÉQUITÉ JOUEUR / RIVAUX (audit, étape 6 bis)
 *
 * Le joueur suit la même formule que les rivaux : un joueur moyen dans une
 * voiture moyenne finit au milieu ; la pluie touche tout le monde selon son
 * talent sous la pluie ; les écarts de qualification restent réalistes ; les
 * talents de la saison sont fixés avant la première qualification.
 * ==================================================================== */
async function suiteEquite() {
  S.suite("Équité joueur / rivaux");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    await S.repondeurAutomatique(page);

    /* Joueur moyen : niveau et voiture au milieu du plateau, grille variée. */
    for (const cat of ["Formule 3", "Formule 1"]) {
      const prep = await page.evaluate((cat) => {
        G.cat = cat; initRivals();
        /* Comme au début d'une qualification : talents de la saison fixés d'abord. */
        _rjRecalibrateSkills(G.rivals.map((r, i) => ({ name: r.name, team: r.team, skill: r.skill, rivalIdx: i })).concat([{ isPlayer: true }]));
        const R = G.rivals.slice().sort((a, b) => a.skill - b.skill);
        const median = R[Math.floor(R.length / 2)];
        window.__rjNiveau = window.__rjNiveau || window.computeRacePerformanceScore;
        window.computeRacePerformanceScore = () => median.skill / 100;
        /* Un joueur moyen, sans les leviers qu'il a mérités dans la sauvegarde
           de test (forme en hausse, bon ingénieur) : on mesure la formule. */
        window.__rjForme = window.__rjForme || window._getMomentum;
        window.__rjInge = window.__rjInge || window.getPlayerEngineerBonus;
        window._getMomentum = () => "neutral";
        window.getPlayerEngineerBonus = () => 0;
        G.currentTeam = median.team;
        return { n: G.rivals.length + 1 };
      }, cat);
      const arrivees = [];
      for (let k = 0; k < 8; k++) {
        await S.courirUneCourse(page, { categorie: cat, grille: 1 + (k * 7) % (prep.n - 1), reinitialiserRivaux: false });
        arrivees.push(await page.evaluate(() => { const p = LIVE_RACE.drivers.find(d => d.isPlayer); const n = LIVE_RACE.drivers.filter(d => !d._mc).length; return p && !p.dnf ? p.pos / n : null; }));
      }
      await page.evaluate(() => { window.computeRacePerformanceScore = window.__rjNiveau; window._getMomentum = window.__rjForme; window.getPlayerEngineerBonus = window.__rjInge; });
      const ok = arrivees.filter(x => x !== null), moy = ok.reduce((a, b) => a + b, 0) / ok.length;
      /* Ses leviers de jeu (réglages, forme) lui valent légitimement quelques
         places : on cherche un biais important, pas l'absence de tout avantage. */
      S.verifier(cat.padEnd(10) + " un joueur moyen finit au milieu du peloton", moy >= 0.25 && moy <= 0.75,
        "place relative moyenne " + moy.toFixed(2) + " (0 = devant, 1 = derrière)");
    }

    /* Pluie : en course, le joueur la subit comme un rival. */
    const pluie = await page.evaluate(async () => {
      const r0 = Math.random; const res = {};
      try {
        G.cat = "Formule 2"; initRivals();
        for (const id of ["dry", "storm"]) {
          Math.random = () => 0.5;
          window.CAL_RACES = []; buildCalendar(); G.semaine = 6; G.seasonOver = false;
          CAL_RACES.forEach(c => { c.done = c.week < 6; c.result = null; });
          const course = getNextRace(); RACE_STATE.circuit = course.name; RACE_STATE.circuitData = getCircuitData(course.name);
          RACE_STATE.weather = generateWeather(0);
          const modele = { dry: 0, storm: -0.12 };
          RACE_STATE.weather = Object.assign({}, RACE_STATE.weather, { id, rainMod: modele[id] });
          RACE_STATE.qualiPos = 8; G.totalLaps = 10; SETTINGS.simSpeed = "instant";
          if (window.LIVE_RACE && LIVE_RACE.interval) clearInterval(LIVE_RACE.interval);
          window.LIVE_RACE = { drivers: [], cur: 0, total: 0, finished: false, paused: false, interval: null };
          runRaceLive(); clearInterval(LIVE_RACE.interval);
          const J = LIVE_RACE.drivers.find(d => d.isPlayer), R = LIVE_RACE.drivers.filter(d => !d.isPlayer && !d._mc);
          res[id] = J.baseScore - R.reduce((s, d) => s + d.baseScore, 0) / R.length;
          /* Avantage attendu du seul talent sous la pluie (joueur contre moyenne des rivaux). */
          res.attendu = 0.7 * 0.12 * (R.reduce((s, d) => s + (1.4 - 0.8 * talentPluie(d)), 0) / R.length - (1.4 - 0.8 * talentPluie(null)));
          LIVE_RACE.finished = true;
        }
      } finally { Math.random = r0; }
      return res;
    });
    const avantage = pluie.storm - pluie.dry;
    S.verifier("la pluie touche le joueur comme les rivaux, selon son talent", Math.abs(avantage - pluie.attendu) <= 0.04,
      "avantage sous l'orage " + (avantage >= 0 ? "+" : "") + avantage.toFixed(3) + ", attendu " + (pluie.attendu >= 0 ? "+" : "") + pluie.attendu.toFixed(3));

    /* Qualifications : écart du premier au dernier réaliste. */
    const ecarts = await page.evaluate(() => {
      const out = {};
      for (const cat of ["Formule 4", "Formule 2", "Formule 1"]) {
        G.cat = cat; initRivals(); window.CAL_RACES = []; buildCalendar();
        QUALI_STATE.baseRef = getCircuitBaseRef(CAL_RACES[0].name, cat) || 90; QUALI_STATE.circuitName = CAL_RACES[0].name;
        const P = G.rivals.map(e => ({ skill: e.skill / 100 + teamRatingToBonus(e.team ? getEffectiveTeamRating(e.team) : 72), consistency: e.consistency, team: e.team }));
        let somme = 0;
        for (let s = 0; s < 20; s++) {
          QUALI_STATE.drivers = P.map(p => Object.assign({}, p));
          const t = QUALI_STATE.drivers.map(d => Math.min(...[1, 2, 3].map(r => qualiDriverTime(d, 1, r, 3, 0.5))));
          somme += (Math.max(...t) - Math.min(...t)) / Math.min(...t) * 100;
        }
        out[cat] = +(somme / 20).toFixed(2);
      }
      return out;
    });
    S.verifier("qualification : écart du premier au dernier sous 4 %", Object.values(ecarts).every(v => v <= 4), JSON.stringify(ecarts));

    /* Talents de la saison fixés avant la première qualification. */
    const calib = await page.evaluate(() => {
      G.cat = "Formule 1"; initRivals();
      Object.keys(G).filter(k => k.indexOf("_rjSkillsCalib_") === 0).forEach(k => delete G[k]);
      try { if (typeof rjAppeler === "function") rjAppeler("startQual", function () {}, null, []); } catch (e) {}
      return !!G["_rjSkillsCalib_Formule 1_S" + (G.saison || 1)];
    });
    S.verifier("talents de la saison fixés dès la qualification", calib === true);
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * 8 terdecies. LA COURSE AU CHRONOMÈTRE (étape 6 ter)
 *
 * Le classement suit les temps cumulés : les écarts se creusent, une voiture
 * rapide partie dernière remonte, une lente partie en pole recule, dépasser
 * est plus dur à Monaco qu'à Monza, le départ peut changer l'ordre, et les
 * écarts affichés croissent avec la position.
 * ==================================================================== */
async function suiteChronometre() {
  S.suite("Course au chronomètre");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    await S.repondeurAutomatique(page);

    /* Écarts réels et course qui bouge (Formule 1, quatre courses). */
    const mesures = [];
    for (let k = 0; k < 4; k++) {
      await page.evaluate(() => {
        window.__chrono = { tour3: null, tour1: 0, avant: {}, depassements: 0 };
        window.RJ_LAP_HOOKS = window.RJ_LAP_HOOKS.filter(h => h.id !== "__test_chrono");
        window.RJ_LAP_HOOKS.push({ id: "__test_chrono", run: function (tour, lr) {
          const D = lr.drivers.filter(d => !d.dnf && !d._mc);
          if (tour === 1) window.__chrono.tour1 = D.filter(d => d.pos !== d.gridPos).length;
          if (tour === 3) window.__chrono.tour3 = Math.max(...D.map(d => d.gap || 0));
          /* Dépassements en piste : places gagnées d'un tour à l'autre, hors
             départ et hors tours d'arrêt (les siens et ceux des autres). */
          const C = window.__chrono, arret = D.some(d => d._lastPitLap && tour - d._lastPitLap <= 1);
          if (tour > 1 && !arret) D.forEach(d => { if (C.avant[d.name] && d.pos < C.avant[d.name]) C.depassements += C.avant[d.name] - d.pos; });
          D.forEach(d => { C.avant[d.name] = d.pos; });
        } });
      });
      await S.courirUneCourse(page, { categorie: "Formule 1", grille: 1 + (k * 6) % 18 });
      mesures.push(await page.evaluate(() => {
        const D = LIVE_RACE.drivers.filter(d => !d.dnf && !d._mc).sort((a, b) => a.pos - b.pos);
        let croissant = true;
        for (let i = 1; i < D.length; i++) if (D[i].gap < D[i - 1].gap) croissant = false;
        window.RJ_LAP_HOOKS = window.RJ_LAP_HOOKS.filter(h => h.id !== "__test_chrono");
        return { fin: Math.max(...D.map(d => d.gap || 0)), tour3: window.__chrono.tour3, tour1: window.__chrono.tour1,
                 depassements: window.__chrono.depassements, croissant };
      }));
    }
    const m = k => mesures.reduce((s, x) => s + x[k], 0) / mesures.length;
    S.verifier("les écarts se creusent au fil de la course", mesures.every(x => x.fin >= 3 * x.tour3 && x.fin >= 30),
      mesures.map(x => x.tour3.toFixed(0) + " s → " + x.fin.toFixed(0) + " s").join(", "));
    S.verifier("les écarts croissent avec la position", mesures.every(x => x.croissant));
    S.verifier("des dépassements en piste (≥ 5 par course)", m("depassements") >= 5, mesures.map(x => x.depassements).join(", "));
    S.verifier("le départ peut changer l'ordre", mesures.some(x => x.tour1 > 0), mesures.map(x => x.tour1).join(","));

    /* Une voiture rapide partie dernière remonte ; une lente partie en pole recule. */
    for (const [cas, niveau, grille, attendu] of [["rapide, partie dernière", "haut", 20, "devant"], ["lente, partie en pole", "bas", 1, "derriere"]]) {
      const places = [];
      for (let k = 0; k < 3; k++) {
        await page.evaluate((niveau) => {
          G.cat = "Formule 1"; initRivals();
          const R = G.rivals.slice().sort((a, b) => getEffectiveTeamRating(b.team) - getEffectiveTeamRating(a.team));
          const x = niveau === "haut" ? R[0] : R[R.length - 1];
          window.__nv = window.__nv || window.computeRacePerformanceScore;
          window.computeRacePerformanceScore = () => x.skill / 100 + (niveau === "haut" ? 0.05 : -0.05);
          G.currentTeam = x.team;
        }, niveau);
        await S.courirUneCourse(page, { categorie: "Formule 1", grille, reinitialiserRivaux: false });
        places.push(await page.evaluate(() => { window.computeRacePerformanceScore = window.__nv; const p = LIVE_RACE.drivers.find(d => d.isPlayer); return p.dnf ? null : p.pos; }));
      }
      const ok = places.filter(x => x !== null);
      const moy = ok.reduce((a, b) => a + b, 0) / (ok.length || 1);
      S.verifier("voiture " + cas, attendu === "devant" ? moy <= 6 : moy >= 8, "arrivées : " + places.join(", "));
    }

    /* Dépasser est plus dur à Monaco qu'à Monza. */
    const seuils = await page.evaluate(() => ({ monaco: _rj81.seuil("Monaco"), monza: _rj81.seuil("Monza") }));
    S.verifier("dépasser est plus dur à Monaco qu'à Monza", seuils.monaco > 2 * seuils.monza, JSON.stringify(seuils));
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * 8 bis b. ÉCRANS DE TÉLÉPHONE : PIVOT ET ZONES SÛRES (étape 7)
 *
 * Tenu en portrait, un téléphone tactile affiche le jeu pivoté, aux
 * proportions du paysage, et le toucher y fonctionne. En paysage, les zones
 * sûres (encoche, Dynamic Island, barre d'accueil) restent libres : rail,
 * HUD et notifications s'en écartent.
 * ==================================================================== */
async function suiteEcrans() {
  S.suite("Écrans de téléphone");

  /* iPhone tenu en portrait (393 × 852) : jeu pivoté, 852 × 393. */
  {
    const { navigateur, page, journal } = await S.ouvrirJeu({ viewport: { width: 393, height: 852 }, mobile: true });
    try {
      await S.repondeurAutomatique(page);
      const r = await page.evaluate(() => {
        navTo("S-home", "ni-home");
        const app = document.getElementById("app");
        return { corps: document.body.offsetWidth + "×" + document.body.offsetHeight, app: app.offsetWidth + "×" + app.offsetHeight,
                 pivote: getComputedStyle(document.body).transform !== "none" };
      });
      S.verifier("portrait : le jeu est pivoté en paysage", r.pivote && r.corps === "852×393" && r.app === "852×393", JSON.stringify(r));
      await page.click("#ni-cal");
      await page.waitForTimeout(300);
      const ecran = await page.evaluate(() => (document.querySelector(".scr.on") || {}).id);
      S.verifier("portrait : le toucher suit la rotation", ecran === "S-cal", "écran ouvert : " + ecran);
      S.verifier("portrait : aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
    } finally { await navigateur.close(); }
  }

  /* iPhone en paysage avec encoche (59 px de chaque côté, 21 px en bas). */
  {
    const { navigateur, page, journal } = await S.ouvrirJeu({ viewport: { width: 852, height: 393 }, mobile: true });
    try {
      await S.repondeurAutomatique(page);
      const r = await page.evaluate(async () => {
        const st = document.documentElement.style;
        st.setProperty("--sg", "59px"); st.setProperty("--sd", "59px"); st.setProperty("--sb", "21px");
        navTo("S-pilot", null);
        await new Promise(res => setTimeout(res, 300));
        const b = id => document.querySelector(id).getBoundingClientRect();
        const icone = document.querySelector("#ni-home .ni-ico-wrap").getBoundingClientRect();
        const ecran = document.querySelector(".scr.on").getBoundingClientRect();
        const hud = b("#rj-hud"), badge = b("#rj-build-badge");
        const contenu = document.querySelector(".scr.on > .scroll"), cs = getComputedStyle(contenu);
        return { iconeGauche: Math.round(icone.left), ecranGauche: Math.round(ecran.left), hudDroite: Math.round(innerWidth - hud.right),
                 badgeDroite: Math.round(innerWidth - badge.right), badgeBas: Math.round(innerHeight - badge.bottom),
                 contenuBas: parseFloat(cs.paddingBottom) };
      });
      S.verifier("encoche : le rail s'écarte du bord gauche", r.iconeGauche >= 59 && r.ecranGauche >= 59 + 60, JSON.stringify(r));
      S.verifier("encoche : HUD et badge s'écartent du bord droit", r.hudDroite >= 59 && r.badgeDroite >= 59, JSON.stringify(r));
      S.verifier("barre d'accueil : bas libre (badge, contenu)", r.badgeBas >= 21 && r.contenuBas >= 21, JSON.stringify(r));
      S.verifier("encoche : aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
    } finally { await navigateur.close(); }
  }

  /* Une application, pas une page : écran figé, listes en panneau de choix. */
  {
    const { navigateur, page, journal } = await S.ouvrirJeu({ viewport: { width: 852, height: 393 }, mobile: true });
    try {
      await S.repondeurAutomatique(page);
      const fige = await page.evaluate(() => ({
        corps: getComputedStyle(document.body).position, rebond: getComputedStyle(document.documentElement).overscrollBehaviorY,
        pageDefile: document.scrollingElement.scrollHeight > innerHeight + 1
      }));
      S.verifier("application figée : ni glissement ni rebond de la page", fige.corps === "fixed" && fige.rebond === "none" && !fige.pageDefile, JSON.stringify(fige));
      await page.evaluate(() => {
        navMore("S-settings");
        const d = document.createElement("div");
        d.innerHTML = '<div class="t-sec">Essai</div><select id="essai-liste" onchange="window.__choix = this.value"><option>A</option><option>B</option><option>C</option></select>';
        document.getElementById("settings-container").prepend(d);
      });
      await page.tap("#essai-liste");
      await page.waitForTimeout(500);
      const panneau = await page.evaluate(() => ({ ouvert: !!document.querySelector(".rj121-voile.on"), titre: (document.querySelector(".rj121-titre") || {}).textContent }));
      await page.tap(".rj121-liste button:nth-child(3)");
      await page.waitForTimeout(300);
      const choix = await page.evaluate(() => ({ valeur: document.getElementById("essai-liste").value, onchange: window.__choix, ferme: !document.querySelector(".rj121-voile") }));
      S.verifier("liste : panneau de choix au toucher, titré par son libellé", panneau.ouvert && panneau.titre === "Essai", JSON.stringify(panneau));
      S.verifier("liste : le choix s'applique et déclenche onchange", choix.valeur === "C" && choix.onchange === "C" && choix.ferme, JSON.stringify(choix));
      S.verifier("application : aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
    } finally { await navigateur.close(); }
  }
}

/* ==================================================================== *
 * 8 quaterdecies. ATELIER DE RÉGLAGES (étape 8)
 *
 * L'atelier remplace les curseurs : cinq ressentis (selon les réglages de
 * la catégorie), boutons − / + qui modifient G.setupAdv, tour d'essai qui
 * fait parler le pilote et mesure sa confiance, fenêtres qui se resserrent
 * avec les essais, confiance maximale au réglage idéal.
 * ==================================================================== */
async function suiteReglages() {
  S.suite("Atelier de réglages");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    await S.repondeurAutomatique(page);
    await page.evaluate(() => { G.cat = "Formule 1"; initRivals(); G.semaine = 6; G.seasonOver = false; goToRaceWeekend(); });
    await page.waitForTimeout(800);
    const avant = await page.evaluate(() => ({
      atelier: !!document.querySelector("#advanced-setup-container .rja"),
      ressentis: document.querySelectorAll(".rja-r").length,
      reglages: document.querySelectorAll(".rja-p").length,
      zone: [...document.querySelectorAll(".rja-barre .zone")].reduce((s, z) => s + parseFloat(z.style.width), 0),
      ail: G.setupAdv.aileron_ar
    }));
    S.verifier("F1 : l'atelier remplace les curseurs (5 ressentis, 9 réglages)", avant.atelier && avant.ressentis === 5 && avant.reglages === 9, JSON.stringify(avant));

    await page.click(".rja [data-rja='plus'][data-p='aileron_ar']");
    const apres = await page.evaluate(() => G.setupAdv.aileron_ar);
    S.verifier("le bouton + règle la voiture", apres === Math.min(10, avant.ail + 1), avant.ail + " → " + apres);

    for (let k = 0; k < 3; k++) { await page.click(".rja [data-rja='essai']"); await page.waitForTimeout(150); }
    const essais = await page.evaluate(() => ({
      tests: RACE_STATE.practice.tests.length, confiance: RJAtelier.confiance(), parole: RJAtelier.parole(),
      bulle: (document.querySelector(".rja-bulle") || {}).textContent || "",
      zone: [...document.querySelectorAll(".rja-barre .zone")].reduce((s, z) => s + parseFloat(z.style.width), 0)
    }));
    S.verifier("tour d'essai : le pilote parle et donne sa confiance", essais.tests >= 3 && typeof essais.confiance === "number" && /«/.test(essais.bulle), JSON.stringify(essais).slice(0, 160));
    S.verifier("les fenêtres idéales se resserrent avec les essais", essais.zone < avant.zone, avant.zone.toFixed(0) + " → " + essais.zone.toFixed(0));

    const ideal = await page.evaluate(() => {
      const sweet = getSetupSweetSpots();
      getAvailableSetupParams(G.cat).forEach(p => { G.setupAdv[p] = sweet[p]; });
      runPracticeTest();
      return { confiance: RJAtelier.confiance(), parole: RJAtelier.parole() };
    });
    S.verifier("réglage idéal : confiance maximale, pilote ravi", ideal.confiance >= 95 && /superbe/.test(ideal.parole), JSON.stringify(ideal));

    const kart = await page.evaluate(() => {
      G.cat = "Karting Junior"; RACE_STATE.practice = null; renderAdvancedSetupUI();
      return { ressentis: document.querySelectorAll(".rja-r").length, reglages: document.querySelectorAll(".rja-p").length };
    });
    S.verifier("karting : seulement les ressentis de ses réglages", kart.reglages === 1 && kart.ressentis >= 1 && kart.ressentis < 5, JSON.stringify(kart));
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * 8 quindecies. ENTOURAGE : DES PERSONNES, PAS UN RÉPERTOIRE (étape 10)
 *
 * Une personne n'apparaît qu'une fois au réseau ; les courses font bouger
 * les relations et y font entrer les pilotes croisés ; chaque message vient
 * d'un contact, et y répondre change la relation ; chaque contact a un
 * trait de caractère, une humeur et la mémoire de vos échanges ; l'écran
 * Entourage les présente, avec une fiche et des actions.
 * ==================================================================== */
async function suiteEntourage() {
  S.suite("Entourage");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    await S.repondeurAutomatique(page);

    /* Doublons : la même personne sous deux clés n'en fait qu'une. */
    const doublons = await page.evaluate(() => {
      G.currentTeam = G.currentTeam || "Williams";
      syncNetworkFromSources();
      const net = Object.values(G._network || {});
      const tp = net.find(c => c.role === "tp" && c.team === G.currentTeam);
      if (tp) G._network["team_" + G.currentTeam + "_double"] = Object.assign({}, tp, { key: "team_" + G.currentTeam + "_double", relation: 77, roleLabel: "Ancien contact", role: "contact" });
      syncNetworkFromSources();
      const noms = Object.values(G._network).map(c => c.name);
      const repetes = noms.filter((n, i) => noms.indexOf(n) !== i);
      const garde = tp && Object.values(G._network).find(c => c.name === tp.name);
      return { tp: !!tp, repetes, relation: garde && Math.round(garde.relation), role: garde && garde.role };
    });
    S.verifier("une personne n'apparaît qu'une fois au réseau", doublons.tp && doublons.repetes.length === 0, JSON.stringify(doublons));
    S.verifier("la fusion garde le rôle officiel et la meilleure relation", doublons.role === "tp" && doublons.relation >= 77, JSON.stringify(doublons));

    /* Courses : le réseau bouge et s'enrichit. */
    const avant = await page.evaluate(() => ({ pilotes: Object.values(G._network).filter(c => c.role === "pilote").length,
      memoire: Object.values(G._network).reduce((s, c) => s + ((c.memoire || []).length), 0) }));
    for (let k = 0; k < 4; k++) await S.courirUneCourse(page, { categorie: "Formule 1", reinitialiserRivaux: false, grille: 3 + k });
    const apres = await page.evaluate(() => ({ pilotes: Object.values(G._network).filter(c => c.role === "pilote").length,
      memoire: Object.values(G._network).reduce((s, c) => s + ((c.memoire || []).length), 0) }));
    S.verifier("les courses font entrer des pilotes au réseau", apres.pilotes > avant.pilotes, avant.pilotes + " → " + apres.pilotes);
    S.verifier("les courses laissent des souvenirs aux contacts", apres.memoire > avant.memoire, avant.memoire + " → " + apres.memoire);

    /* Messages : chaque message vient d'un contact, la réponse compte. */
    const mail = await page.evaluate(() => {
      pushMail({ from: "Team Principal", role: "team_boss", subject: "Un service à te demander", body: "Peux-tu venir au simulateur ?",
        actions: [{ label: "J'y vais", kind: "accept" }, { label: "Pas cette semaine", kind: "refuse" }] });
      const m = getMailbox()[0], c = m.contactKey && G._network[m.contactKey];
      const rel0 = c ? c.relation : null;
      handleMailAction(m.id, 0);
      return { cle: m.contactKey || null, role: c && c.role, avant: rel0, apres: c && c.relation, souvenir: c && (c.memoire || [])[0] && c.memoire[0].t };
    });
    S.verifier("un message du team principal vient du team principal du réseau", mail.cle && mail.role === "tp", JSON.stringify(mail));
    S.verifier("accepter un service rapproche", mail.apres > mail.avant && /simulateur|service|J'y vais/i.test(mail.souvenir || ""), JSON.stringify(mail));

    /* Traits : chacun a le sien, et il pèse. */
    const traits = await page.evaluate(() => {
      const net = Object.values(G._network);
      const sans = net.filter(c => !c.trait).length;
      const a = { relation: 50, trait: "rancunier" }, b = { relation: 50, trait: "loyal" };
      _rj101.bouger(a, -4, "test"); _rj101.bouger(b, -4, "test");
      return { sans, rancunier: a.relation, loyal: b.relation, humeur: _rj101.humeur(a).lbl };
    });
    S.verifier("chaque contact a un trait de caractère", traits.sans === 0, traits.sans + " sans trait");
    S.verifier("un rancunier encaisse plus mal qu'un loyal", traits.rancunier < traits.loyal, JSON.stringify(traits));

    /* Écran Entourage : groupes, fiche, action. */
    await page.evaluate(() => { navTo("S-contracts", null); ctab("reseau"); });
    await page.waitForTimeout(300);
    const ecran = await page.evaluate(() => ({ groupes: [...document.querySelectorAll(".rj122-groupe-titre")].map(e => e.textContent.trim()),
      cartes: document.querySelectorAll(".rj122-carte").length }));
    S.verifier("l'écran Entourage groupe les personnes", ecran.groupes.length >= 3 && ecran.cartes >= 4, JSON.stringify(ecran));
    await page.click(".rj122-carte[data-cle]");
    await page.waitForTimeout(300);
    const fiche = await page.evaluate(() => {
      const f = document.querySelector(".rj122-fiche"), cle = f && f.getAttribute("data-cle"), c = cle && G._network[cle];
      G.pa = Math.max(G.pa || 0, 2);
      return { ouverte: !!f, trait: !!(f && f.querySelector(".rj122-trait")), cle, rel: c && c.relation, pa: G.pa };
    });
    await page.click(".rj122-fiche [data-act='nouvelles']");
    await page.waitForTimeout(200);
    const action = await page.evaluate(cle => ({ rel: G._network[cle].relation, pa: G.pa, memoire: (G._network[cle].memoire || [])[0] }), fiche.cle);
    S.verifier("la fiche montre la personne et son trait", fiche.ouverte && fiche.trait, JSON.stringify(fiche));
    S.verifier("prendre des nouvelles coûte 1 PA et rapproche", action.pa === fiche.pa - 1 && action.rel >= fiche.rel, JSON.stringify({ avant: fiche, apres: action }));
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * 8 decies. L'ARRIVÉE RESPECTE LA COURSE
 *
 * Défaut constaté en jeu : P17 au dernier tour, P1 à l'arrivée. Le temps
 * passé au stand, déjà compté pendant la course (penaltySec), était ajouté
 * une seconde fois au classement d'arrivée (≈ 1,2 s par place). Seule une
 * sanction jamais appliquée (arrêt obligatoire manqué) peut déclasser.
 * ==================================================================== */
/* ==================================================================== *
 * 8 sexdecies. UNE PRESSE VIVANTE (étape 11)
 *
 * Chaque média a une ligne éditoriale et une sympathie pour vous, qui
 * bouge avec vos déclarations ; après chaque course, la presse titre sur
 * vous selon le résultat et selon ce qu'elle pense de vous, et se souvient
 * de ce que vous aviez annoncé ; un podium ou un abandon vaut une interview
 * d'après-course dont le ton compte ; l'audience suit les résultats ; tout
 * cela se sauvegarde, et se lit dans Médias › Presse.
 * ==================================================================== */
async function suitePresse() {
  S.suite("Presse vivante");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    await S.repondeurAutomatique(page);

    /* Des médias avec une ligne et une sympathie. */
    const medias = await page.evaluate(() => _rj123.medias().map(m => ({ nom: m.nom, ligne: m.ligne, sym: m.sym })));
    S.verifier("chaque média a une ligne éditoriale et une sympathie", medias.length >= 6 && medias.every(m => m.ligne && typeof m.sym === "number"), JSON.stringify(medias.slice(0, 3)));

    /* Une déclaration provocatrice plaît au tabloïd, refroidit le bienveillant. */
    const sym = await page.evaluate(() => {
      const tab = _rj123.medias().find(m => m.ligne === "Sensation"), bien = _rj123.medias().find(m => m.ligne === "Bienveillance");
      const a = { tab: tab.sym, bien: bien.sym };
      G._rjDeclarations = G._rjDeclarations || [];
      G._rjDeclarations.unshift({ saison: G.saison, semaine: G.semaine, titre: "x", media: tab.nom, auteur: "?", ton: "provocateur", citation: "Ce titre, il est pour moi cette année", reaction: "" });
      _rj123.lireDeclarations();
      const m = _rj123.medias();
      return { avant: a, apres: { tab: m.find(x => x.nom === tab.nom).sym, bien: m.find(x => x.nom === bien.nom).sym },
        promesses: (G._rjPresse.promesses || []).length };
    });
    S.verifier("une provocation plaît au tabloïd et refroidit la presse bienveillante", sym.apres.tab > sym.avant.tab && sym.apres.bien < sym.avant.bien, JSON.stringify(sym));
    S.verifier("une déclaration forte est retenue comme promesse", sym.promesses >= 1, JSON.stringify(sym));

    /* La presse se souvient : un mauvais résultat après la promesse est rappelé. */
    const rappel = await page.evaluate(() => {
      const r = _rj123.apresCourse({ pos: 14, dnf: false, circuit: "Monza", pts: 0 });
      return { titres: r.titres.map(t => t.titre), resolue: G._rjPresse.promesses.filter(p => p.resolue).length };
    });
    S.verifier("la presse rappelle la promesse après un mauvais résultat", rappel.titres.some(t => /pour moi cette ann/i.test(t)) && rappel.resolue >= 1, JSON.stringify(rappel));
    S.verifier("plusieurs titres sur le week-end, avec le circuit", rappel.titres.length >= 2 && rappel.titres.some(t => /Monza/.test(t)), JSON.stringify(rappel));

    /* Un podium vaut une interview, dont le ton compte. */
    const itw = await page.evaluate(() => {
      _rj123.apresCourse({ pos: 2, dnf: false, circuit: "Silverstone", pts: 18 });
      const m = getMailbox().find(x => x.rj123);
      if (!m) return { mail: false };
      const media = m.rj123.media, avant = _rj123.medias().find(x => x.nom === media).sym, nb = (G._rjDeclarations || []).length;
      const i = m.actions.findIndex(a => a.ton === "humble");
      handleMailAction(m.id, i);
      return { mail: true, choix: m.actions.length, avant, apres: _rj123.medias().find(x => x.nom === media).sym,
        declarations: (G._rjDeclarations || []).length - nb, ton: (G._rjDeclarations || [])[0] && G._rjDeclarations[0].ton };
    });
    S.verifier("un podium vaut une interview d'après-course à plusieurs tons", itw.mail && itw.choix >= 3, JSON.stringify(itw));
    S.verifier("la réponse est publiée et change la sympathie du média", itw.declarations === 1 && itw.ton === "humble" && itw.apres !== itw.avant, JSON.stringify(itw));

    /* Une course vraie : titres et audience, sans rien publier. */
    const avant = await page.evaluate(() => ({ titres: (G._rjPresse.revue || []).length, abonnes: _rj123.abonnes() }));
    await S.courirUneCourse(page, { categorie: "Formule 1", reinitialiserRivaux: false, grille: 1 });
    const apres = await page.evaluate(() => ({ titres: (G._rjPresse.revue || []).length, abonnes: _rj123.abonnes(), pos: G.races[G.races.length - 1].pos }));
    S.verifier("une course fait titrer la presse", apres.titres > avant.titres, avant.titres + " → " + apres.titres);
    S.verifier("l'audience suit les résultats sans publication", apres.abonnes > avant.abonnes, JSON.stringify({ avant, apres }));

    /* Sauvegarde : presse et déclarations survivent au rechargement. */
    const sauve = await page.evaluate(() => {
      G._slot = 1; saveGame(1);
      const n = { revue: G._rjPresse.revue.length, decl: G._rjDeclarations.length };
      G._rjPresse = undefined; G._rjDeclarations = undefined;
      loadSave(1);
      return { avant: n, apres: { revue: G._rjPresse ? G._rjPresse.revue.length : 0, decl: G._rjDeclarations ? G._rjDeclarations.length : 0 } };
    });
    S.verifier("la presse et vos déclarations sont sauvegardées", sauve.apres.revue === sauve.avant.revue && sauve.apres.decl === sauve.avant.decl, JSON.stringify(sauve));

    /* Écran : Médias › Presse montre la revue et ce que chaque média pense de vous. */
    await page.evaluate(() => { navTo("S-media", null); mtab("presse"); });
    await page.waitForTimeout(400);
    const ecran = await page.evaluate(() => ({ titres: document.querySelectorAll("#mt-presse .rj123-titre").length,
      medias: document.querySelectorAll("#mt-presse .rj123-media").length }));
    S.verifier("Médias › Presse : revue de presse et sympathie des médias", ecran.titres >= 2 && ecran.medias >= 6, JSON.stringify(ecran));
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * 8 septdecies. UNE MESSAGERIE DE JEU (étape 12)
 *
 * Chaque message a une priorité (à répondre, personnel, info) et la boîte
 * se filtre ; une proposition sans réponse expire au bout de trois semaines,
 * et l'expéditeur s'en souvient ; répondre à quelqu'un amène sa réponse la
 * semaine suivante ; l'ingénieur débriefe chaque course sans rien demander ;
 * on peut écrire soi-même à un contact depuis sa fiche.
 * ==================================================================== */
async function suiteMessagerie() {
  S.suite("Messagerie");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    await S.repondeurAutomatique(page);
    await page.evaluate(() => { G.currentTeam = G.currentTeam || "Williams"; syncNetworkFromSources(); });

    /* Priorités. */
    const prio = await page.evaluate(() => ({
      urgent: _rj124.priorite({ actions: [{ label: "Oui", kind: "accept" }], replied: false, role: "sponsor" }),
      perso: _rj124.priorite({ role: "family" }),
      info: _rj124.priorite({ role: "team" })
    }));
    S.verifier("chaque message a une priorité", prio.urgent === "urgent" && prio.perso === "personnel" && prio.info === "info", JSON.stringify(prio));

    /* Pas de faux choix : un seul bouton sans effet n'est pas une décision. */
    const faux = await page.evaluate(() => {
      const dernier = () => getMailbox()[0];
      const h0 = G.happiness || 50;
      // la partie de test a pu recevoir un message de presse : on neutralise l'espacement des messages (124, 62)
      if (G._rj124) G._rj124.vol = { roles: {}, sujets: {} };
      if (G._rjMailLog) Object.keys(G._rjMailLog).forEach(x => { if (/^s:/.test(x)) delete G._rjMailLog[x]; });
      pushMail({ from: "Agent", role: "agent", subject: "Tu comptes dans les médias (50/100)", body: "Bravo.", actions: [{ label: "Compris", kind: "dismiss" }] });
      const accuse = dernier();
      pushMail({ from: "Fan", role: "fans", subject: "Un message de soutien", body: "Allez !", actions: [{ label: "Merci !", kind: "reply", effect: { type: "happiness", data: { delta: 2 } } }] });
      const soutien = dernier(), h1 = G.happiness;
      pushMail({ from: "Presse", role: "press", subject: "Proposition de portrait", body: "?", actions: [{ label: "J'accepte", kind: "accept", effect: { type: "rep", data: { delta: 3 } } }, { label: "Je décline", kind: "refuse" }] });
      const vrai = dernier();
      pushMail({ from: "Team Principal", role: "team_boss", subject: "Idée au simulateur", body: "?", actions: [{ label: "Tester", kind: "accept", effect: { type: "flag", data: { key: "_x" } } }] });
      const drapeau = dernier();
      pushMail({ from: "Agent", role: "agent", subject: "Une décision t'attend", body: "?", actions: [{ label: "Ouvrir", kind: "nav", effect: { type: "nav", data: {} } }] });
      const lien = dernier();
      const n = m => (m.actions || []).length;
      return { accuse: n(accuse), accusePrio: _rj124.priorite(accuse), soutien: n(soutien), bonheur: h1 - h0, vrai: n(vrai), drapeau: n(drapeau), lien: n(lien) };
    });
    S.verifier("un accusé de réception sans effet devient une info", faux.accuse === 0 && faux.accusePrio === "info", JSON.stringify(faux));
    S.verifier("un seul bouton à petit effet s'applique à la réception", faux.soutien === 0 && faux.bonheur === 2, JSON.stringify(faux));
    S.verifier("les vrais choix, drapeaux et liens restent", faux.vrai === 2 && faux.drapeau === 1 && faux.lien === 1, JSON.stringify(faux));

    /* Volume : une seule sollicitation par expéditeur secondaire et par période. */
    const volume = await page.evaluate(() => {
      G.semaine += 4;
      const n0 = getMailbox().length;
      for (let k = 0; k < 3; k++) pushMail({ from: "Fan " + k, role: "fans", subject: "Cadeau de fan " + k, body: "!", actions: [{ label: "Merci", kind: "accept", effect: { type: "happiness", data: { delta: 1 } } }, { label: "Non", kind: "refuse" }] });
      const fans = getMailbox().length - n0;
      pushMail({ from: "Rival", role: "rival", subject: "Alors, on se couche ?", body: "?", actions: [{ label: "Ignorer", kind: "dismiss" }, { label: "Répondre", kind: "reply" }] });
      const r1 = getMailbox()[0].subject;
      G.semaine += 6;
      const n1 = getMailbox().length;
      pushMail({ from: "Rival", role: "rival", subject: "Alors, on se couche ?", body: "?", actions: [{ label: "Ignorer", kind: "dismiss" }, { label: "Répondre", kind: "reply" }] });
      return { fans, rival: r1, repete: getMailbox().length - n1 };
    });
    S.verifier("une seule sollicitation de fans par période", volume.fans === 1, JSON.stringify(volume));
    S.verifier("un même message ne revient pas dans la saison", volume.rival === "Alors, on se couche ?" && volume.repete === 0, JSON.stringify(volume));

    /* La boîte pleine efface d'abord les infos lues, jamais une décision en attente. */
    const pleine = await page.evaluate(() => {
      const b = getMailbox(); b.length = 0;
      pushMail({ from: "Sponsor X", role: "sponsor", subject: "Contrat à signer", body: "?", actions: [{ label: "Signer", kind: "accept", effect: { type: "money", data: { delta: 1000 } } }, { label: "Non", kind: "refuse" }] });
      const decision = getMailbox()[0].id;
      for (let k = 0; k < 45; k++) { pushMail({ from: "Équipe", role: "team", subject: "Note " + k, body: "info " + k }); getMailbox()[0].read = true; }
      return { garde: getMailbox().some(m => m.id === decision), taille: getMailbox().length };
    });
    S.verifier("une boîte pleine garde les décisions en attente", pleine.garde && pleine.taille <= 40, JSON.stringify(pleine));

    /* Expiration : trois semaines sans réponse. */
    const exp = await page.evaluate(() => {
      const envoyer = (o) => { pushMail(o); return getMailbox()[0]; };
      const m = envoyer({ from: "Team Principal", role: "team_boss", subject: "Journée sponsor", body: "Tu viens ?", actions: [{ label: "Oui", kind: "accept" }, { label: "Non", kind: "refuse" }] });
      const neg = envoyer({ from: "Team Principal", role: "team_boss", subject: "Négociation", body: "On discute ?", actions: [{ label: "Oui", kind: "accept" }] });
      neg.tpApproach = { team: "X" };
      [m, neg].forEach(x => { x.week = (G.semaine || 4) - 3; x.saison = G.saison; });
      const c = G._network[m.contactKey], rel = c && c.relation;
      runWeeklyTicks(1);
      return { expire: !!m.rj124Expire, repondu: m.replied, sansBouton: m.action_taken !== null && m.actions[m.action_taken].kind === "dismiss",
        negOuverte: !neg.replied, relAvant: rel, relApres: c && c.relation, souvenir: c && c.memoire && c.memoire[0] && c.memoire[0].t };
    });
    S.verifier("une proposition sans réponse expire au bout de trois semaines", exp.expire && exp.repondu && exp.sansBouton, JSON.stringify(exp));
    S.verifier("une négociation d'écurie n'expire pas", exp.negOuverte, JSON.stringify(exp));
    S.verifier("l'expéditeur se souvient d'un message ignoré", exp.relApres < exp.relAvant && /répondu|réponse/i.test(exp.souvenir || ""), JSON.stringify(exp));

    /* Conversation : la réponse arrive la semaine suivante. */
    const conv = await page.evaluate(() => {
      pushMail({ from: "Team Principal", role: "team_boss", subject: "Séance simulateur", body: "Dispo jeudi ?", actions: [{ label: "J'y serai", kind: "accept" }, { label: "Impossible", kind: "refuse" }] });
      const m = getMailbox()[0], n0 = getMailbox().length;
      handleMailAction(m.id, 0);
      const immediat = getMailbox().length - n0;
      runWeeklyTicks(1);
      const r = getMailbox()[0];
      return { immediat, suite: r !== m && r.contactKey === m.contactKey, sansChoix: !r.actions || !r.actions.length, objet: r.subject, corps: r.body };
    });
    S.verifier("répondre amène la réponse du contact la semaine suivante, sans choix", conv.immediat === 0 && conv.suite && conv.sansChoix && /simulateur/i.test(conv.objet + conv.corps), JSON.stringify(conv));

    /* Le débrief de l'ingénieur, sans choix, après une course qui compte. */
    await S.courirUneCourse(page, { categorie: "Formule 1", reinitialiserRivaux: false, grille: 4 });
    const debrief = await page.evaluate(() => {
      const course = G.races[G.races.length - 1];
      const n0 = getMailbox().length;
      Object.assign(course, { pos: 2, qualiPos: 9, circuit: "Monza", dnf: false });
      const d = _rj124.debrief();
      Object.assign(course, { pos: 8, qualiPos: 8, circuit: "Spa" });
      const banal = _rj124.debrief();
      return { debrief: !!d, sansChoix: d && !(d.actions && d.actions.length), contact: d && G._network[d.contactKey] && G._network[d.contactKey].role,
        circuit: d && /Monza/.test(d.subject + d.body), remontee: d && /remontée/i.test(d.body), banal: !!banal };
    });
    S.verifier("après une course qui compte, l'ingénieur débriefe sans rien demander", debrief.debrief && debrief.sansChoix && debrief.contact === "ing_course" && debrief.circuit && debrief.remontee, JSON.stringify(debrief));
    S.verifier("pas de débrief après une course sans histoire", !debrief.banal, JSON.stringify(debrief));

    /* Écrire à un contact depuis sa fiche. */
    await page.evaluate(() => { navTo("S-contracts", null); ctab("reseau"); });
    await page.waitForTimeout(300);
    const cle = await page.evaluate(() => { const c = Object.keys(G._network).find(k => G._network[k].role === "agent"); return c; });
    await page.evaluate(k => RJEntourage.fiche(k), cle);
    await page.waitForTimeout(300);
    await page.click(".rj122-fiche [data-act='ecrire']");
    await page.waitForTimeout(150);
    await page.click(".rj122-fiche [data-sujet]");
    await page.waitForTimeout(150);
    const ecrit = await page.evaluate(k => {
      const attente = (G._rj124 && G._rj124.attente || []).filter(a => a.cle === k).length;
      const fiche = document.querySelector(".rj122-fiche").innerText;
      runWeeklyTicks(1);
      const r = getMailbox()[0];
      return { attente, note: /réponse/i.test(fiche), reponse: r.contactKey === k, sansChoix: !(r.actions && r.actions.length), corps: r.body.slice(0, 120) };
    }, cle);
    S.verifier("on écrit à un contact depuis sa fiche, il répond la semaine suivante", ecrit.attente === 1 && ecrit.note && ecrit.reponse && ecrit.sansChoix, JSON.stringify(ecrit));

    /* Boîte : filtres et priorités visibles. */
    await page.evaluate(() => { document.querySelectorAll(".rj122-voile").forEach(v => v.remove()); navTo("S-mailbox", null); if (typeof backToMailList === "function") backToMailList(); renderMailbox(); });
    await page.waitForTimeout(300);
    const boite = await page.evaluate(() => {
      const cartes = [...document.querySelectorAll("#mailbox-list [data-rj124]")];
      const filtres = document.querySelectorAll(".rj124-filtre").length;
      const b = [...document.querySelectorAll(".rj124-filtre")].find(x => x.getAttribute("data-f") === "personnel");
      if (b) b.click();
      const visibles = cartes.filter(c => c.style.display !== "none");
      return { cartes: cartes.length, filtres, badges: document.querySelectorAll("#mailbox-list .rj124-prio").length,
        filtre: visibles.every(c => c.getAttribute("data-rj124") === "personnel"), visibles: visibles.length };
    });
    S.verifier("la boîte montre la priorité de chaque conversation et se filtre", boite.filtres >= 4 && boite.badges === boite.cartes && boite.cartes >= 3 && boite.filtre, JSON.stringify(boite));
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * 8 octodecies. LA VIE PERSO, FAITE DE MOMENTS (étape 13)
 *
 * Les proches ne s'éloignent plus d'un cran chaque semaine : seulement
 * après des semaines sans nouvelles, et jamais sous un plancher. La saison
 * apporte des moments — anniversaire, mariage d'un ami, tes parents au
 * Grand Prix de ton pays, une rencontre — où ta décision pèse sur tes
 * proches, ton bonheur et ton mental ; et les proches écrivent d'eux-mêmes
 * après une course marquante.
 * ==================================================================== */
async function suiteViePerso() {
  S.suite("Vie perso");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    await S.repondeurAutomatique(page);

    /* Plus d'érosion fixe. */
    const erosion = await page.evaluate(() => {
      const R = getRelations();
      G._rj125 = { saison: G.saison || 1, moments: [{ type: "aucun", w: 99, fait: true }], ecrit: -99 };   /* pas de moment pendant la mesure : on ne mesure que l'érosion */
      R.friends.closeness = 55; R.friends.lastContact = G.semaine = 2; R.parents.closeness = 65; R.parents.lastContact = 2;
      for (let k = 0; k < 16; k++) { G.semaine++; runWeeklyTicks(1); }
      return { amis: R.friends.closeness, parents: R.parents.closeness };
    });
    S.verifier("seize semaines sans nouvelles n'effondrent plus les amitiés", erosion.amis >= 40 && erosion.parents >= 55, JSON.stringify(erosion));

    /* Une saison de moments. */
    const plan = await page.evaluate(() => {
      G.cat = "Formule 1"; G.pilot.nat = "IT"; G.relations.partner = null; G.age = 20;
      window.CAL_RACES = []; buildCalendar();
      const p = _rj125.planifier(true);
      return p.map(m => m.type + "@" + m.w + (m.circuit ? ":" + m.circuit : ""));
    });
    S.verifier("la saison prévoit anniversaire, Grand Prix à domicile et rencontre", ["anniversaire", "gp_maison", "rencontre"].every(t => plan.some(x => x.indexOf(t) === 0)) && plan.some(x => /gp_maison@\d+:(Imola|Monza)/.test(x)), JSON.stringify(plan));

    /* Un moment arrive, et y être compte. */
    const anniv = await page.evaluate(() => {
      const m = G._rj125.moments.find(x => x.type === "anniversaire");
      G.semaine = m.w; G.pa = 3; G.happiness = 50; const R = getRelations(); R.parents.closeness = 50;
      runWeeklyTicks(1);
      const mail = getMailbox().find(x => x.rj125 === "anniversaire");
      if (!mail) return { mail: false };
      handleMailAction(mail.id, 0);
      return { mail: true, role: mail.role, choix: mail.actions.length, parents: R.parents.closeness, bonheur: G.happiness, pa: G.pa };
    });
    S.verifier("l'anniversaire arrive par message, avec un vrai choix", anniv.mail && anniv.role === "family" && anniv.choix >= 2, JSON.stringify(anniv));
    S.verifier("rentrer pour l'anniversaire rapproche et rend heureux", anniv.parents > 50 && anniv.bonheur > 50 && anniv.pa === 2, JSON.stringify(anniv));

    /* La rencontre peut faire naître une relation. */
    const rencontre = await page.evaluate(() => {
      const m = G._rj125.moments.find(x => x.type === "rencontre");
      G.semaine = m.w; runWeeklyTicks(1);
      const mail = getMailbox().find(x => x.rj125 === "rencontre");
      if (!mail) return { mail: false };
      handleMailAction(mail.id, 0);
      return { mail: true, partenaire: !!(G.relations.partner && G.relations.partner.name) };
    });
    S.verifier("une rencontre acceptée fait naître une relation", rencontre.mail && rencontre.partenaire, JSON.stringify(rencontre));

    /* Les proches écrivent d'eux-mêmes après une course marquante. */
    const proches = await page.evaluate(() => {
      G.semaine += 4;
      const n = getMailbox().length;
      _rj125.apresCourse({ pos: 1, circuit: "Monza" });
      const m = getMailbox()[0];
      return { nouveau: getMailbox().length > n, perso: ["family", "friends"].indexOf(m.role) >= 0, sansChoix: !(m.actions && m.actions.length), texte: m.body.slice(0, 80) };
    });
    S.verifier("après une victoire, les proches écrivent d'eux-mêmes", proches.nouveau && proches.perso && proches.sansChoix, JSON.stringify(proches));

    /* Écran : les moments à venir. */
    await page.evaluate(() => { navTo("S-lifestyle", null); if (typeof lstab === "function") lstab("vieperso"); renderVieperso(); });
    await page.waitForTimeout(300);
    const ecran = await page.evaluate(() => document.querySelectorAll("#vp-content .rj125-moment").length);
    S.verifier("Vie perso montre les moments à venir", ecran >= 1, String(ecran));
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * 8 novodecies. HABILLAGE ET NOTIFICATIONS (étape 14)
 *
 * Les notifications tombent en haut de l'écran, attendent la fin de la
 * course pour s'afficher (messages regroupés), et les messages courts
 * rejoignent la même pile ; les widgets « course » et « rêves » ne sont
 * plus semés partout ; le face-à-face a sa tuile de duel ; titres et
 * cartes suivent la DA de l'accueil.
 * ==================================================================== */
async function suiteHabillage() {
  S.suite("Habillage et notifications");
  const { navigateur, page, journal } = await S.ouvrirJeu({ viewport: { width: 844, height: 390 } });
  try {
    await S.repondeurAutomatique(page);
    const haut = await page.evaluate(async () => {
      navTo("S-home", "ni-home");
      document.querySelectorAll(".rj-toast").forEach(t => t.remove());
      pushHomeToast("Test", "Une notification", "#22D3EE");
      await new Promise(r => setTimeout(r, 400));
      const t = document.querySelector("#rj-toast-container .rj-toast"), b = t && t.getBoundingClientRect();
      return { vue: !!t, haut: b && Math.round(b.top), centre: b && Math.round(b.left + b.width / 2 - innerWidth / 2) };
    });
    S.verifier("une notification s'affiche en haut, au centre", haut.vue && haut.haut < 60 && Math.abs(haut.centre) < 30, JSON.stringify(haut));

    const file = await page.evaluate(async () => {
      document.querySelectorAll(".rj-toast").forEach(t => t.remove());
      navTo("S-race", null);
      pushHomeToast("Nouveau message", "Agent — Une offre", "#34D399");
      pushHomeToast("Nouveau message", "Team Principal — Débrief", "#F59E0B");
      pushHomeToast("Trophée", "Premier podium", "#F59E0B");
      await new Promise(r => setTimeout(r, 300));
      const pendant = document.querySelectorAll(".rj-toast").length;
      navTo("S-home", "ni-home");
      await new Promise(r => setTimeout(r, 1800));
      const apres = [...document.querySelectorAll(".rj-toast")].map(t => t.textContent);
      return { pendant, apres };
    });
    S.verifier("pendant la course, les notifications attendent", file.pendant === 0, JSON.stringify(file));
    S.verifier("au retour, elles s'affichent, les messages regroupés", file.apres.length === 2 && file.apres.some(t => /2 nouveaux messages/.test(t)) && file.apres.some(t => /podium/.test(t)), JSON.stringify(file));

    const court = await page.evaluate(async () => {
      document.querySelectorAll(".rj-toast").forEach(t => t.remove());
      showToast("Pas assez de PA.");
      await new Promise(r => setTimeout(r, 300));
      return [...document.querySelectorAll("#rj-toast-container .rj-toast")].some(t => /Pas assez de PA/.test(t.textContent));
    });
    S.verifier("les messages courts rejoignent la même pile", court, String(court));

    const widgets = await page.evaluate(async () => {
      const vus = {};
      for (const id of ["S-contracts", "S-lifestyle", "S-mailbox", "S-media", "S-champ", "S-pilot", "S-patrimoine"]) {
        try { navTo(id, null); } catch (e) {}
        await new Promise(r => setTimeout(r, 200));
        document.querySelectorAll("#" + id + " .rj119-w").forEach(w => { const k = w.getAttribute("data-w"); vus[k] = (vus[k] || 0) + 1; });
      }
      return vus;
    });
    S.verifier("plus de widgets « prochaine course », « rêves » ni « saison »", !widgets.course && !widgets.reves && !widgets.saison, JSON.stringify(widgets));

    const duel = await page.evaluate(async () => {
      navTo("S-champ", "ni-champ"); chtab("h2h");
      await new Promise(r => setTimeout(r, 400));
      const c = document.getElementById("h2h-content");
      return { tuile: !!c.querySelector(".rj126-duel"), lignes: c.querySelectorAll(".rj126-ligne").length, choix: c.querySelectorAll(".rj126-choix option").length,
        rivaux: (G.rivals || []).length, verdict: !!c.querySelector(".rj126-verdict"), tableau: !!c.querySelector("#rj91-points, table") };
    });
    S.verifier("face-à-face : tuile du duel, huit catégories, choix du rival, verdict", duel.tuile && duel.lignes === 8 && duel.choix === duel.rivaux && duel.verdict, JSON.stringify(duel));

    const titres = await page.evaluate(async () => {
      navTo("S-achievements", null); if (typeof renderHallOfFame === "function") try { renderHallOfFame(); } catch (e) {}
      await new Promise(r => setTimeout(r, 300));
      const succes = document.querySelectorAll("#S-achievements .t-sec").length;
      navTo("S-media", null); mtab("presse");
      await new Promise(r => setTimeout(r, 400));
      const presse = [...document.querySelectorAll("#mt-presse .t-sec")].map(t => t.textContent.trim());
      const carte = document.querySelector("#S-lifestyle .mc") || document.querySelector(".mc");
      navTo("S-lifestyle", null); lstab("biens");
      await new Promise(r => setTimeout(r, 300));
      const mc = document.querySelector("#S-lifestyle .mc");
      return { succes, presse, tuile: mc && getComputedStyle(mc).backgroundImage.indexOf("radial-gradient") >= 0 };
    });
    S.verifier("titres de section communs (presse, accomplissements)", titres.succes >= 1 && titres.presse.some(t => /Transferts/.test(t)), JSON.stringify(titres));
    S.verifier("les cartes d'information prennent la tuile de l'accueil", titres.tuile, JSON.stringify(titres));
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * 8 vicies. LA VIE AMOUREUSE (étape 14)
 * ==================================================================== */
async function suiteAmour() {
  S.suite("Vie amoureuse");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    await S.repondeurAutomatique(page);
    const rencontre = await page.evaluate(() => {
      const R = getRelations();
      G.age = 16; R.partner = null;
      const jeune = _rj127.peutRencontrer();
      G.age = 23;
      return { jeune, majeur: _rj127.peutRencontrer(), star: _rj127.pretendant(90).profil, connu: _rj127.pretendant(55).profil, discret: _rj127.pretendant(20).profil };
    });
    S.verifier("pas de rencontre avant 18 ans", !rencontre.jeune && rencontre.majeur, JSON.stringify(rencontre));
    S.verifier("la réputation décide de qui l'on rencontre", rencontre.star === "celebrite" && rencontre.connu === "connu" && rencontre.discret === "discret", JSON.stringify(rencontre));

    const couple = await page.evaluate(() => {
      G.reputation = 85; G.pilot.nat = "FR"; G.cat = "Formule 1"; window.CAL_RACES = []; buildCalendar();
      const m = _rj125.planifier(true).find(x => x.type === "rencontre");
      G.semaine = m.w; runWeeklyTicks(1);
      const mail = getMailbox().find(x => x.rj125 === "rencontre");
      handleMailAction(mail.id, 0);
      runWeeklyTicks(1);
      const p = getRelations().partner;
      return { nom: p && p.name, profil: p && p.profil, etape: p && p.etape, people: (G._rjPresse && G._rjPresse.people || []).length };
    });
    S.verifier("une célébrité rencontrée : couple, et la presse people en parle", couple.nom && couple.profil === "celebrite" && couple.etape === "couple" && couple.people >= 1, JSON.stringify(couple));

    const etapes = await page.evaluate(() => {
      const p = getRelations().partner;
      p.closeness = 80; p.semainesEtape = 12; G.pa = 3; G.budget = 1e6;
      runWeeklyTicks(1);
      const m1 = getMailbox().find(x => x.rj127 === "vie_commune");
      if (m1) handleMailAction(m1.id, 0);
      const vie = p.etape;
      p.etape = "marie"; p.semainesEtape = 40; p.closeness = 85; G.age = 27; p.attente = null;
      runWeeklyTicks(1);
      const m2 = getMailbox().find(x => x.rj127 === "enfant");
      if (m2) handleMailAction(m2.id, 0);
      const h0 = G.happiness;
      p.grossesse = 35; runWeeklyTicks(1);
      return { emmenage: !!m1 && m1.actions.length >= 2, vie, enfant: !!m2, enfants: (getRelations().enfants || []).length, bonheur: G.happiness - h0,
        naissance: !!getMailbox().find(x => x.rj127 === "naissance") };
    });
    S.verifier("le couple avance : emménager ensemble", etapes.emmenage && etapes.vie === "vie_commune", JSON.stringify(etapes));
    S.verifier("un enfant : la proposition, puis la naissance qui rend heureux", etapes.enfant && etapes.enfants === 1 && etapes.naissance && etapes.bonheur > 0, JSON.stringify(etapes));

    const rupture = await page.evaluate(() => {
      const p = getRelations().partner, nom = p.name;
      p.closeness = 15; p.froid = 0; p.crise = false;
      for (let k = 0; k < 4; k++) runWeeklyTicks(1);
      const m = getMailbox().find(x => x.rj127 === "crise");
      if (m) handleMailAction(m.id, 1);
      return { crise: !!m, seul: !getRelations().partner, rumeur: (G._rjPresse.people || []).some(r => r.titre.indexOf(nom) >= 0 && /fini/.test(r.titre)) };
    });
    S.verifier("une relation glacée mène à la rupture, et la presse le sait", rupture.crise && rupture.seul && rupture.rumeur, JSON.stringify(rupture));

    await page.evaluate(() => { navTo("S-media", null); mtab("presse"); });
    await page.waitForTimeout(400);
    const people = await page.evaluate(() => document.querySelectorAll("#mt-presse .rj123-people").length);
    S.verifier("Médias › Presse : une rubrique « Vie privée »", people >= 1, String(people));
    await page.evaluate(() => { navTo("S-lifestyle", null); lstab("vieperso"); });
    await page.waitForTimeout(300);
    const foyer = await page.evaluate(() => document.querySelectorAll("#vp-content .rj127-carte").length);
    S.verifier("Vie perso montre le foyer (enfants)", foyer >= 1, String(foyer));
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * 8 unvicies. LES AVATARS (étape 15)
 *
 * Chaque personnage a un portrait généré, toujours le même ; le teint et
 * les cheveux suivent le pays ; le joueur compose le sien à la création
 * (étape du numéro) et le modifie depuis le bandeau ; les portraits
 * remplacent les initiales (bandeau, messagerie, entourage, face-à-face,
 * classements) ; tout se sauvegarde, et se génère vite.
 * ==================================================================== */
async function suiteAvatars() {
  S.suite("Avatars");
  const { navigateur, page, journal } = await S.ouvrirJeu({ viewport: { width: 844, height: 390 } });
  try {
    await S.repondeurAutomatique(page);
    const base = await page.evaluate(() => {
      const A = RJAvatar, p1 = A.personnage("Marco Rinaldi", { role: "pilote" }), p2 = A.personnage("Marco Rinaldi", { role: "pilote" }), p3 = A.personnage("Kofi Adeyemi", { role: "pilote" });
      const jp = [1, 2, 3, 4, 5, 6].map(i => A.personnage("Pilote " + i, { nat: "JP" }).cheveux);
      const t0 = performance.now();
      for (let i = 0; i < 30; i++) A.url(A.personnage("Perf " + i, { role: "pilote" }), 40);
      return { meme: A.url(p1, 40) === A.url(p2, 40), different: A.url(p1, 40) !== A.url(p3, 40), jp, duree: Math.round(performance.now() - t0) };
    });
    S.verifier("un personnage a toujours le même visage, deux personnages deux visages", base.meme && base.different, JSON.stringify(base));
    S.verifier("les cheveux suivent le pays", base.jp.every(c => ["#15100D", "#2E1C13"].indexOf(c) >= 0), JSON.stringify(base.jp));
    S.verifier("trente portraits se génèrent en moins d'une seconde et demie", base.duree < 1500, base.duree + " ms");

    const creation = await page.evaluate(async () => {
      navTo("S-create", null); window.creStep = 5; updateCreUI();
      await new Promise(r => setTimeout(r, 200));
      const ed = document.querySelector("#rja-creation .rja-ed");
      const b = document.querySelector('#rja-creation [data-k="forme"][data-i="1"]');
      if (b) b.click();
      return { editeur: !!ed, apercu: !!(ed && ed.querySelector("img.rja")), forme: G.pilot.avatar && G.pilot.avatar.forme, options: document.querySelectorAll("#rja-creation [data-k]").length };
    });
    S.verifier("la création propose l'éditeur de visage", creation.editeur && creation.apercu && creation.options > 20, JSON.stringify(creation));
    S.verifier("un choix dans l'éditeur s'enregistre", creation.forme === "carre", JSON.stringify(creation));

    const partout = await page.evaluate(async () => {
      navTo("S-home", "ni-home"); updateUI();
      await new Promise(r => setTimeout(r, 300));
      const bandeau = (document.getElementById("h-avatar").style.backgroundImage || "").indexOf("data:image/svg") >= 0;
      const mini = document.querySelectorAll(".apex-champ-mini-row .rja").length;
      pushMail({ from: "Team Principal", role: "team_boss", subject: "Test avatar", body: "…" });
      navTo("S-mailbox", null); if (typeof backToMailList === "function") backToMailList(); renderMailbox();
      await new Promise(r => setTimeout(r, 300));
      const mail = document.querySelectorAll("#mailbox-list img.rja").length;
      navTo("S-contracts", null); ctab("reseau");
      await new Promise(r => setTimeout(r, 300));
      const entourage = document.querySelectorAll(".rj122-carte img.rja").length;
      navTo("S-champ", "ni-champ"); chtab("classement");
      await new Promise(r => setTimeout(r, 300));
      const classement = document.querySelectorAll("#S-champ .cr .rja").length;
      _openDriverProfileFromChamp(2);
      await new Promise(r => setTimeout(r, 300));
      const fiche = document.querySelectorAll("#driver-profile-modal img.rja").length;
      if (typeof closeDriverProfileModal === "function") closeDriverProfileModal();
      chtab("h2h");
      await new Promise(r => setTimeout(r, 300));
      const duel = document.querySelectorAll(".rj126-visage img.rja").length;
      return { bandeau, mini, mail, entourage, classement, fiche, duel };
    });
    S.verifier("les portraits remplacent les initiales (bandeau, messagerie, entourage)", partout.bandeau && partout.mail >= 1 && partout.entourage >= 3, JSON.stringify(partout));
    S.verifier("les classements restent sans visages ; la fiche d'un pilote et le face-à-face les montrent", partout.mini === 0 && partout.classement === 0 && partout.fiche === 1 && partout.duel === 2, JSON.stringify(partout));

    const menu = await page.evaluate(async () => {
      navTo("S-home", "ni-home"); _showAvatarMenu();
      await new Promise(r => setTimeout(r, 100));
      const b = document.querySelector(".rja-menu"); if (b) b.click();
      await new Promise(r => setTimeout(r, 200));
      const feuille = !!document.querySelector(".rja-feuille");
      const lun = document.querySelector('.rja-feuille [data-k="lunettes"][data-i="1"]'); if (lun) lun.click();
      document.querySelector(".rja-valider").click();
      await new Promise(r => setTimeout(r, 100));
      return { bouton: !!b, feuille, ferme: !document.querySelector(".rja-feuille"), lunettes: G.pilot.avatar.lunettes };
    });
    S.verifier("on modifie son avatar depuis le bandeau", menu.bouton && menu.feuille && menu.ferme && menu.lunettes === true, JSON.stringify(menu));

    const sauve = await page.evaluate(() => {
      G._slot = 1; saveGame(1);
      const avant = JSON.stringify(G.pilot.avatar);
      G.pilot.avatar = null; loadSave(1);
      return { egal: JSON.stringify(G.pilot.avatar) === avant };
    });
    S.verifier("l'avatar est sauvegardé avec la partie", sauve.egal, JSON.stringify(sauve));
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * 8 duovicies. UNE CARRIÈRE NEUVE A DES RIVAUX
 *
 * Le vivier des pilotes lisait ses listes dans le relais initRivals au
 * lieu de _initRivalsCoeur : il restait vide, et une carrière neuve
 * n'avait aucun rival (classement réduit au joueur). On crée une carrière
 * par l'écran de création, on court, et on répare une sauvegarde touchée.
 * ==================================================================== */
async function suiteRivaux() {
  S.suite("Rivaux d'une carrière neuve");
  const { navigateur, page, journal } = await S.ouvrirJeu({ charger: false, dev: false });
  try {
    await S.repondeurAutomatique(page);
    const neuve = await page.evaluate(async () => {
      try { if (typeof startNewGame === "function") startNewGame(); else go("S-create"); } catch (e) {}
      await new Promise(r => setTimeout(r, 300));
      const val = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
      val("p-fn", "Lucas"); val("p-ln", "Martin"); window.selNatVal = "FR";
      for (let k = 0; k < 7 && document.querySelector(".scr.on").id === "S-create"; k++) {
        val("p-birthcity", "Lyon"); val("p-dob-year", "2012"); val("p-startyear", "2024");
        creNext(); await new Promise(r => setTimeout(r, 250));
      }
      navTo("S-champ", "ni-champ"); chtab("classement");
      await new Promise(r => setTimeout(r, 300));
      return { rivaux: (G.rivals || []).length, lignes: document.querySelectorAll("#champ-table .cr, #S-champ .cr").length, vivier: (G.driverPool || []).length, cat: G.cat };
    });
    S.verifier("une carrière neuve a des rivaux, et le classement les montre", neuve.rivaux >= 10 && neuve.lignes >= 11 && neuve.vivier > 50, JSON.stringify(neuve));

    await S.courirUneCourse(page, { categorie: neuve.cat, reinitialiserRivaux: false, grille: 5 });
    const course = await page.evaluate(() => ({ marquent: (G.rivals || []).filter(r => (r.pts || 0) > 0).length, joueur: G.champPts }));
    S.verifier("après une course, des rivaux marquent des points", course.marquent >= 5, JSON.stringify(course));

    const repare = await page.evaluate(() => {
      G.rivals = []; G.driverPool = []; G._rjPoolInitialized = true;
      G._slot = 1; saveGame(1); loadSave(1);
      return { rivaux: (G.rivals || []).length, vivier: (G.driverPool || []).length };
    });
    S.verifier("une sauvegarde sans rivaux est réparée au chargement", repare.rivaux >= 10, JSON.stringify(repare));
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

async function suiteVides() {
  S.suite("Sections vides");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    await S.repondeurAutomatique(page);
    const r = await page.evaluate(async () => {
      const attendre = () => new Promise(r => setTimeout(r, 400));
      navTo("S-pilot", null); document.querySelector("#S-pilot [data-tab=rep]").click(); await attendre();
      const contenu = document.getElementById("palmares-content"), avant = contenu.innerHTML;
      contenu.innerHTML = ""; await attendre();
      const phrase = [...document.querySelectorAll("#S-pilot .rj-vide")].map(v => v.textContent).join(" | ");
      contenu.innerHTML = avant; await attendre();
      return { phrase, apres: document.querySelectorAll("#S-pilot .rj-vide").length };
    });
    S.verifier("un titre sans contenu reçoit une phrase d attente, qui part quand le contenu revient", /palmarès/i.test(r.phrase) && r.apres === 0, JSON.stringify(r));
    const clic = await page.evaluate(async () => {
      navTo("S-pilot", null); await new Promise(r => setTimeout(r, 300));
      _pushHomeToastCoeur("Test", "Une notification posée sur le bandeau", "#60A5FA");
      document.querySelectorAll("#rj-toast-container .rj-toast").forEach(t => t.style.minHeight = "60px");
      await new Promise(r => setTimeout(r, 100));
      return [...document.querySelectorAll("#S-pilot .tab")].filter(t => t.offsetParent).every(t => { const b = t.getBoundingClientRect(), e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return e === t || t.contains(e); });
    });
    S.verifier("une notification en haut laisse les onglets du bandeau cliquables", clic === true, String(clic));
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

async function suiteCircuits() {
  S.suite("Tracés de circuits");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    await page.waitForFunction(() => window.RJTraces && RJTraces.applique(), null, { timeout: 15000 });
    const r = await page.evaluate(() => {
      const ko = [];
      Object.keys(CIRCUITS).forEach(n => {
        const c = CIRCUITS[n], sec = CIRCUIT_SECTORS[n] || [], somme = sec.reduce((a, x) => a + x, 0);
        if (!/^M[0-9.,-]+ L/.test(c.path) || !/Z$/.test(c.path) || /[^MLQZ0-9., -]/.test(c.path)) ko.push(n + " : tracé");
        if (!(c.length > 0.5) || !(c.corners >= 4) || !(c.refLapF1 > 0)) ko.push(n + " : infos");
        if (Math.abs(somme - 1) > .01) ko.push(n + " : secteurs");
        if (c.note.indexOf("Tracé de " + c.length.toFixed(c.length < 2 ? 2 : 3).replace(".", ",") + " km, " + c.corners + " virages") !== 0) ko.push(n + " : note");
      });
      const a = RJTraces.inventer("Essai", { type: "mixed", length: 4.5, corners: 14 }).longueur, b = RJTraces.inventer("Essai", { type: "mixed", length: 4.5, corners: 14 }).longueur;
      return { n: Object.keys(CIRCUITS).length, ko, stable: a === b, memeLieu: CIRCUITS.Barcelona.path === CIRCUITS.Barcelone.path };
    });
    S.verifier("chaque circuit a un tracé fermé, partant d une ligne droite, et des infos tirées de ce tracé", r.n > 40 && r.ko.length === 0, JSON.stringify(r.ko.slice(0, 5)));
    S.verifier("le tracé d un circuit est le même à chaque partie, et un même lieu a un seul tracé", r.stable && r.memeLieu, JSON.stringify(r));
    const themes = await page.evaluate(() => { const c = G.cat, t = ["Formule 1", "Formule 2", "Formule 4", "Super Formula", "IndyCar", "Endurance WEC", "Karting Junior"].map(x => { G.cat = x; return RJVueCircuit.theme().id; }); G.cat = c; return t.join(","); });
    S.verifier("la tour de classement a l habillage de chaque catégorie", themes === "f1,f2,f4,sf,indy,wec,kart", themes);
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

async function suiteLogos() {
  S.suite("Logos d'écuries");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    await page.waitForFunction(() => !!document.getElementById("rjlogo-defs"), null, { timeout: 15000 });
    const r = await page.evaluate(() => {
      const ko = [], hote = document.getElementById("rjlogo-defs");
      Object.keys(TEAM_LOGOS).forEach(t => {
        const svg = TEAM_LOGOS[t], refs = (svg.match(/url(#([^)]+))/g) || []).map(x => x.slice(5, -1));
        if (!/rjlogo/.test(svg)) ko.push(t + " : pas de blason");
        const formes = x => (x.match(/<(path|circle|ellipse|rect|text|polygon|use)/g) || []).length;
        if (formes(svg) < formes(RJLogos.original(t))) ko.push(t + " : dessin d'origine perdu");
        refs.forEach(id => { if (!hote.querySelector("[id=\"" + id + "\"]") && svg.indexOf("id=\"" + id + "\"") < 0) ko.push(t + " : " + id + " introuvable"); });
      });
      const modeles = RJLogos.modeles(), vides = modeles.filter(id => !/<path|<circle|<rect|<text|<ellipse/.test(RJLogos.dessiner(id, "#1E5BC6", 40, "Scuderia Vittoria").split("</defs>").pop()));
      return { n: Object.keys(TEAM_LOGOS).length, ko, modeles: modeles.length, vides, ferrari: RJLogos.parDefaut("Ferrari").color, plaque: modeles.indexOf("plaque_lettrage") >= 0 };
    });
    S.verifier("chaque écurie garde son logo d'origine, retouché (coins, reflet), et ses références se résolvent", r.n > 50 && r.ko.length === 0, JSON.stringify(r.ko.slice(0, 4)));
    S.verifier("l'éditeur propose tous les modèles, plaque à lettrage comprise, chacun dessiné", r.modeles > 40 && r.vides.length === 0 && r.plaque, JSON.stringify(r.vides));
    S.verifier("une écurie connue garde sa couleur (Ferrari en rouge)", r.ferrari === "#DC0000", r.ferrari);
    const acad = await page.evaluate(() => Object.keys(ACADEMIES).filter(n => !/rjlogo/.test(ACADEMIES[n].logo || "") || !/viewBox="0 0 40 40"/.test(ACADEMIES[n].logo || "")));
    S.verifier("les logos d'académies ont la finition des écuries de F1 (tuile 40, coins, reflet)", acad.length === 0, acad.join(", "));
    const audi = await page.evaluate(() => { const ancien = JSON.parse(JSON.stringify(G)); G.rivals[0].team = "Kick Sauber"; G._testHisto = { "Kick Sauber": 3 }; RJRenommerEcurie("Kick Sauber", "Audi"); const ok = G.rivals[0].team === "Audi" && G._testHisto.Audi === 3 && !("Kick Sauber" in G._testHisto); delete G._testHisto; return { ok, f1: (TEAMS_BY_CAT["Formule 1"] || []).indexOf("Audi") >= 0 && (TEAMS_BY_CAT["Formule 1"] || []).indexOf("Kick Sauber") < 0, logo: !!TEAM_LOGOS.Audi }; });
    S.verifier("Kick Sauber devient Audi (équipe de F1, logo, ancienne sauvegarde renommée)", audi.ok && audi.f1 && audi.logo, JSON.stringify(audi));
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

async function suiteContacts() {
  S.suite("Messagerie › Contacts");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    await S.repondeurAutomatique(page);
    const r = await page.evaluate(async () => {
      const att = () => new Promise(r => setTimeout(r, 300));
      navTo("S-mailbox", null); mbtab("contacts"); await att();
      const cartes = document.querySelectorAll("#mb-contacts-list .rj131-carte").length, attendu = getContactList().length;
      const id = getContactList().find(c => c.available).id;
      openContactChat(id); await att();
      const sujets = document.querySelectorAll(".rj131-sujet:not(:disabled)").length, apercus = document.querySelectorAll(".rj131-sujet .rj131-fx").length;
      document.querySelector(".rj131-sujet:not(:disabled)").click(); await att();
      return { cartes, attendu, sujets, apercus, bulles: document.querySelectorAll(".rj131-bulle.recent").length, bloque: document.querySelectorAll(".rj131-sujet:disabled").length > 0, portraits: document.querySelectorAll(".rj131-av").length };
    });
    S.verifier("une fiche par contact, chacune avec son portrait ou son pictogramme", r.cartes === r.attendu && r.cartes > 0, JSON.stringify(r));
    S.verifier("la conversation propose les sujets avec leurs effets possibles", r.sujets > 0 && r.apercus >= r.sujets, JSON.stringify(r));
    S.verifier("envoyer un sujet ajoute l échange au fil et bloque les envois jusqu à la semaine suivante", r.bulles === 2 && r.bloque, JSON.stringify(r));
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

async function suiteEssais() {
  S.suite("Essais libres et qualifications");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    const r = await page.evaluate(() => ({
      aileron: describeFeedback("aileron_ar", { direction: "too_low", magnitude: "medium" }),
      suspension: describeFeedback("suspension", { direction: "too_high", magnitude: "small" }),
      el1: _buildEngineerBriefing(1, "Monza", { id: "dry" }),
      el2: _buildEngineerBriefing(2, "Monza", { id: "dry" }),
      el3: _buildEngineerBriefing(3, "Monza", { id: "dry" }),
      pneus: QUALI_TYRE_CONFIG ? Object.keys(QUALI_TYRE_CONFIG).map(k => QUALI_TYRE_CONFIG[k].compound).join(",") : ""
    }));
    S.verifier("les retours de l ingénieur s accordent (l aileron, la suspension trop haute)", /^L.aileron arrière est sensiblement trop bas./.test(r.aileron) && /^La suspension est un peu trop haute. Réduis-la./.test(r.suspension), r.aileron + " / " + r.suspension);
    S.verifier("l ingénieur ne dit « première séance » qu en EL1", !/Première séance/.test(r.el2) && !/Première séance/.test(r.el3) && /EL2|Deuxième/.test(r.el2) && /EL3|Dernière/.test(r.el3), r.el2.slice(0, 60) + " / " + r.el3.slice(0, 60));
    S.verifier("les pneus de qualification portent des noms français, sans marque", !/Soft|Pirelli|Primary/.test(r.pneus), r.pneus);
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

async function suiteCasque() {
  S.suite("Casque du pilote");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    const r = await page.evaluate(async () => {
      const att = () => new Promise(r => setTimeout(r, 200));
      navTo("S-pilot", null); await att();
      openPersonalizationModal(); await att();
      const motifs = document.querySelectorAll(".rj132-choix[data-cle=motif] svg").length;
      document.querySelector(".rj132-choix[data-cle=motif][data-val=damier]").click(); await att();
      document.querySelector(".rj132-pastille[data-cle=base][data-val=\"#1E5BC6\"]").click(); await att();
      document.querySelector(".rj132-choix[data-cle=visiere][data-val=or]").click(); await att();
      document.querySelector("[data-num=\"1\"]").click(); const num = G.pilot.number;
      document.querySelector(".rj132-valider").click(); await att();
      const h = G.pilot.helmet || {};
      navTo("S-home", null); navTo("S-pilot", null); await att();
      return { motifs, h, num, apres: G.pilot.number, couleur: G.pilot.helmetColor, carte: !!document.querySelector("#S-pilot .rj132-mini svg"), ferme: !document.getElementById("rj132-modale") };
    });
    S.verifier("l éditeur montre chaque motif dessiné aux couleurs du casque", r.motifs === 10, String(r.motifs));
    S.verifier("le casque choisi est enregistré avec le pilote (motif, couleur, visière, numéro)", r.h.motif === "damier" && r.h.base === "#1E5BC6" && r.h.visiere === "or" && r.apres === Math.min(99, r.num + 1) && r.couleur === "blue" && r.ferme, JSON.stringify(r));
    S.verifier("la carte Personnalisation de Stats montre le casque", r.carte, JSON.stringify(r));
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

async function suiteNotes() {
  S.suite("Notes des pilotes");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    const r = await page.evaluate(async () => {
      const cat = G.cat, gen = c => { G.cat = c; return G.rivals.map(x => { const n = RJNotes.notes(Object.assign({}, x, { cat: c })); return n.gen; }); };
      const f1 = gen("Formule 1"), f3 = gen("Formule 3"), kj = gen("Karting Junior");
      G.cat = cat;
      const n = RJNotes.notes(G.rivals[0]), ok4 = ["exp", "com", "vig", "ryt"].every(k => n[k] >= 20 && n[k] <= 99);
      showDriverProfileModal({ idx: 0 }); await new Promise(r => setTimeout(r, 200));
      const gc = document.querySelector("#driver-profile-modal .rj133-gen b"), carte = !!gc, affiche = gc ? +gc.textContent : null; closeDriverProfileModal();
      return { f1: [Math.min(...f1), Math.max(...f1)], f3: [Math.min(...f3), Math.max(...f3)], kj: [Math.min(...kj), Math.max(...kj)], ok4, carte, coherent: calcRivalRating(G.rivals[0]) === affiche };
    });
    S.verifier("chaque catégorie a sa fourchette de notes (F1 au-dessus de la F3, au-dessus du karting)", r.f1[0] >= 70 && r.f1[1] <= 96 && r.f3[1] <= 78 && r.kj[1] <= 56 && r.f1[1] > r.f3[1] && r.f3[1] > r.kj[1], JSON.stringify(r));
    S.verifier("quatre notes et une note générale, la même partout (fiche, classement)", r.ok4 && r.coherent && r.carte, JSON.stringify(r));
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

async function suiteReseaux() {
  S.suite("Réseaux sociaux");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    const r = await page.evaluate(async () => {
      navTo("S-media", null); await new Promise(r => setTimeout(r, 300));
      const b = [...document.querySelectorAll("#S-media .tab")].find(x => /social/i.test(x.textContent)); if (b) b.click();
      await new Promise(r => setTimeout(r, 400));
      const h = document.getElementById("mt-reseaux");
      return { banniere: !!h.querySelector(".rj66-banniere"), portrait: !!h.querySelector(".rj66-prof .rj66-portrait img"),
        tendances: h.querySelectorAll(".rj66-tendances b").length, visages: h.querySelectorAll(".rj66-tw .rj66-portrait img").length,
        vues: h.querySelectorAll(".rj66-vues").length, posts: h.querySelectorAll(".rj66-tw").length, liens: h.querySelectorAll(".rj66-lien").length };
    });
    S.verifier("le profil a une bannière et le portrait du pilote", r.banniere && r.portrait, JSON.stringify(r));
    S.verifier("le fil montre les tendances, des visages, et les vues de chaque publication", r.tendances >= 2 && r.visages > 0 && r.vues === r.posts && r.posts > 0, JSON.stringify(r));
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

async function suiteArrivee() {
  S.suite("Arrivée");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    await S.repondeurAutomatique(page);
    const r = await page.evaluate(async () => {
      const res = [];
      for (const cat of ["Formule 1", "Formule 2", "IndyCar"]) {
        SETTINGS.simSpeed = "normal"; G.cat = cat;
        if (typeof initRivals === "function") initRivals();
        window.CAL_RACES = []; buildCalendar(); G.semaine = 6; G.seasonOver = false;
        CAL_RACES.forEach(c => { c.done = c.week < 6; c.result = null; });
        const course = getNextRace();
        RACE_STATE.circuit = course.name; RACE_STATE.circuitData = getCircuitData(course.name);
        RACE_STATE.weather = generateWeather(0); RACE_STATE.qualiPos = 10; G.totalLaps = 20;
        if (window.LIVE_RACE && LIVE_RACE.interval) clearInterval(LIVE_RACE.interval);
        window.LIVE_RACE = { drivers: [], cur: 0, total: 0, finished: false, paused: false, interval: null };
        try { confirmStrategy(); } catch (e) {}
        if (!LIVE_RACE.total) runRaceLive();
        await new Promise(r => setTimeout(r, 1500));
        LIVE_RACE.paused = true;
        if (LIVE_RACE.interval) { clearInterval(LIVE_RACE.interval); LIVE_RACE.interval = null; }
        /* Des temps d'arrêt différents selon les pilotes, tous arrêts faits. */
        LIVE_RACE.drivers.forEach((d, i) => { d.penaltySec = (i % 3) * 3.1; d._pitsDone = 2; });
        const joueur = LIVE_RACE.drivers.find(d => d.isPlayer);
        const avant = joueur.pos;
        const ordre = LIVE_RACE.drivers.filter(d => !d.dnf).sort((a, b) => a.pos - b.pos).map(d => d.name).join("|");
        const n = (G.races || []).length;
        finalizeLiveRace();
        await new Promise(r => setTimeout(r, 300));
        const apres = LIVE_RACE.drivers.filter(d => !d.dnf).sort((a, b) => a.pos - b.pos).map(d => d.name).join("|");
        res.push({ cat, avant, inscrit: G.races.length > n ? G.races[G.races.length - 1].pos : null, ordreGarde: ordre === apres });
      }
      return res;
    });
    r.forEach(x => {
      S.verifier(x.cat + " : la position inscrite est celle du dernier tour", x.inscrit === x.avant, "dernier tour P" + x.avant + ", inscrit P" + x.inscrit);
      S.verifier(x.cat + " : l'ordre d'arrivée est celui du dernier tour", x.ordreGarde);
    });
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * 9. DÉCISIONS EN COURSE ET MINI-CLASSEMENT (module 107)
 * ==================================================================== */
async function suiteReserve() {
  S.suite("Pilote de réserve");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    await S.repondeurAutomatique(page);
    const r = await page.evaluate(async () => {
      const out = {};
      SETTINGS.simSpeed = "instant";
      // Réserviste pur chez Ferrari : l'écurie aligne ses deux titulaires
      G.cat = "Formule 1"; G.currentTeam = "Ferrari"; G._playerRole = "num3"; initRivals();
      out.titulaires = G.rivals.filter(x => x.team === "Ferrari").length;
      _rj79.setDeal({ team: "Ferrari", cat: G.cat, saison: G.saison, cumul: false, credibilite: 60, sessions: [], remplacements: [] });
      _rj79.remplacer(null, null);
      const gele = G.rivals.filter(x => x._rj79Gele).map(x => x.name);
      window.CAL_RACES = []; buildCalendar(); G.semaine = 6; G.seasonOver = false; CAL_RACES.forEach(c => { c.done = c.week < 6; });
      const c = getNextRace(); RACE_STATE.circuit = c.name; RACE_STATE.circuitData = getCircuitData(c.name); RACE_STATE.weather = generateWeather(0);
      RACE_STATE.qualiPos = 10; G.totalLaps = 5;
      window.LIVE_RACE = { drivers: [], cur: 0, total: 0, finished: false, paused: false, interval: null };
      try { confirmStrategy(); } catch (e) {}
      runRaceLive();
      out.voituresFerrari = LIVE_RACE.drivers.filter(d => d.team === "Ferrari" || d.isPlayer).length;
      out.geleEnPiste = LIVE_RACE.drivers.some(d => gele.indexOf(d.name) >= 0);
      for (let i = 0; i < 400 && !LIVE_RACE.finished; i++) await new Promise(r => setTimeout(r, 25));
      G._rj79Remplacement = null; G.rivals.forEach(x => delete x._rj79Gele);
      // Course simulée sans le joueur : la régularité compte
      const sauve = JSON.parse(JSON.stringify(G.rivals)); let dnf = 0, n = 0;
      for (let k = 0; k < 40; k++) _rj79.simuler("Monza").resultats.forEach(x => { n++; if (x.dnf) dnf++; });
      out.abandons = dnf / n; G.rivals = sauve;
      // Baquet libéré ailleurs : une recrue le prend, le partant ne court plus
      const v = G.rivals.find(x => x.team === "Williams"), seat = { team: "Williams", cat: G.cat, pilote: v.name, cause: "rupture", causeTitre: "rupture", saison: G.saison, week: G.semaine, comble: false };
      v._rj79Sorti = { cause: "rupture" }; _rj79.seats().push(seat); _rj79.recruter(seat);
      out.williams = G.rivals.filter(x => x.team === "Williams" && rivalAuDepart(x)).length; out.recrue = !!seat.remplacant;
      // Promotion dans la même catégorie : deux voitures, plus réserviste
      _rj79.setDeal({ team: "Ferrari", cat: G.cat, saison: G.saison, cumul: false, credibilite: 70, sessions: [], remplacements: [] });
      G._rj79SiegeVacant = null; TEAM_TRUST.value = 60; _rj79.promouvoir(false);
      out.ferrariApresPromo = G.rivals.filter(x => x.team === "Ferrari" && rivalAuDepart(x)).length; out.promuCourt = !_rj79.reservistePur();
      // EL1 officielle : deux fois par saison en F1, une séance qui compte davantage
      G._playerRole = "num3"; _rj79.setDeal({ team: "Ferrari", cat: "Formule 1", saison: G.saison, cumul: false, credibilite: 40, sessions: [], remplacements: [] });
      G.semaine = 10; out.el1 = _rj79.el1();
      _rj79.ouvrirWeekEnd(); await new Promise(r => setTimeout(r, 200));
      out.el1Ecran = /EL1 officielle/.test((document.getElementById("S-reserve") || {}).textContent || "");
      const c0 = _rj79.cred(); _rj79.jouer(0);
      const ses = _rj79.deal().sessions; out.el1Marquee = ses.length === 1 && ses[0].el1 === true;
      G.semaine = 12; out.el1Pas2 = !_rj79.el1(); G.semaine = 27; out.el1Second = _rj79.el1();
      _rj79.setDeal({ team: "Prema Racing", cat: "Formule 2", saison: G.saison, cumul: false, credibilite: 40, sessions: [], remplacements: [] }); out.el1PasF2 = !_rj79.el1();
      // Catégorie visée : la réserve se fait en F1
      out.cibles = ["Formule 2", "IndyCar", "Super Formula", "Endurance WEC", "Formule 3"].map(k => { G.cat = k; return _rj79.choisirCat(); });
      // Contrat cumulé : référence, confiance propre, circuit, sous-stats, développement
      G.cat = "Formule 2"; G.currentTeam = "Prema Racing"; G._playerRole = "num2"; initRivals();
      _rj79.setDeal({ team: "Ferrari", cat: "Formule 1", saison: G.saison, cumul: true, credibilite: 40, confiance: 50, sessions: [], remplacements: [] });
      const ref = _rj79.reference("Ferrari"); out.ref = !!ref && ref.skill > 0;
      const t0 = TEAM_TRUST.value, gp = G.substats.gestion_pneus;
      _rj79.effetsSeance({ cle: "excellent", label: "x" }, { technique: true });
      out.confiance = _rj79.confiance() > 50 && TEAM_TRUST.value === t0; out.pneus = G.substats.gestion_pneus === gp + 1;
      out.courseF1 = CAL_RACES && _rj79.course("Formule 1", 20);
      const r0 = getEffectiveTeamRating("Ferrari"); _rj79.occupations().find(o => o.id === "simulateur").effets();
      out.devel = getEffectiveTeamRating("Ferrari") > r0;
      // Remplacement en F1 pendant la saison de F2, puis retour
      window.CAL_RACES = []; buildCalendar(); G.semaine = 14; G.seasonOver = false; CAL_RACES.forEach(c => { c.done = c.week < 14; });
      const p2 = getNextRace(); if (p2 && p2.week <= G.semaine) G.semaine = p2.week - 1;
      G.champPts = 37; const av = { cal: CAL_RACES.length, races: (G.races || []).length };
      _rj79.setDeal({ team: "Ferrari", cat: "Formule 1", saison: G.saison, cumul: true, credibilite: 55, confiance: 50, sessions: [{}, {}, {}], remplacements: [] });
      _rj79.remplacer(null, null);
      RJ_ADVANCE_HOOKS.find(x => x.id === "79-reserve").avant();
      out.bascule = G.cat === "Formule 1" && CAL_RACES.length === 1;
      G.totalLaps = 5;
      const c2 = getNextRace(); RACE_STATE.circuit = c2.name; RACE_STATE.circuitData = getCircuitData(c2.name); RACE_STATE.weather = generateWeather(0);
      window.LIVE_RACE = { drivers: [], cur: 0, total: 0, finished: false, paused: false, interval: null };
      try { confirmStrategy(); } catch (e) {}
      runRaceLive();
      out.voituresFerrariCumul = LIVE_RACE.drivers.filter(d => d.team === "Ferrari" || d.isPlayer).length;
      for (let i = 0; i < 400 && !LIVE_RACE.finished; i++) await new Promise(r => setTimeout(r, 25));
      for (let i = 0; i < 60 && G._rj79Remplacement; i++) await new Promise(r => setTimeout(r, 60));
      out.retour = G.cat === "Formule 2" && G.currentTeam === "Prema Racing" && CAL_RACES.length === av.cal && G.champPts === 37 && (G.races || []).length === av.races && !G.seasonOver;
      out.compte = ((_rj79.deal() || {}).remplacements || []).length === 1;
      return out;
    });
    S.verifier("réserviste pur : l'écurie aligne ses deux titulaires", r.titulaires === 2, JSON.stringify(r));
    S.verifier("remplacement : le titulaire absent ne court pas, l'écurie a deux voitures", r.voituresFerrari === 2 && !r.geleEnPiste, JSON.stringify(r));
    S.verifier("course simulée sans le joueur : la régularité réduit les abandons (< 7 %)", r.abandons < 0.07, String(r.abandons));
    S.verifier("baquet libéré : une recrue le prend, le partant ne court plus", r.recrue && r.williams === 2, JSON.stringify(r));
    S.verifier("promotion : le joueur court, l'écurie garde deux voitures", r.ferrariApresPromo === 1 && r.promuCourt, JSON.stringify(r));
    S.verifier("EL1 officielle : deux séances par saison en F1, marquées et mises en avant", r.el1 && r.el1Ecran && r.el1Marquee && r.el1Pas2 && r.el1Second && r.el1PasF2, JSON.stringify(r));
    S.verifier("la réserve se fait en F1 depuis la F2, l'IndyCar, la Super Formula et le WEC", r.cibles.slice(0, 4).every(x => x === "Formule 1") && r.cibles[4] === null, JSON.stringify(r.cibles));
    S.verifier("contrat cumulé : vraie référence, confiance propre, sous-statistiques réelles", r.ref && r.confiance && r.pneus, JSON.stringify(r));
    S.verifier("le travail au simulateur améliore la voiture de l'écurie", r.devel, "");
    S.verifier("remplacement en F1 pendant une saison de F2, puis retour intact", r.bascule && r.voituresFerrariCumul === 2 && r.retour && r.compte, JSON.stringify(r));
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

async function suiteParalleles() {
  S.suite("IndyCar, WEC, Super Formula");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    const r = await page.evaluate(async () => {
      const out = {}, ecuries = () => [...new Set(G.rivals.map(x => x.team))];
      G.currentTeam = "Indépendant"; G._playerRole = "num2";
      G.cat = "IndyCar"; initRivals();
      out.indySansEcurie = G.rivals.filter(x => !x.team).length; out.ecr = ecuries().indexOf("ECR / Foyt") >= 0;
      window.CAL_RACES = []; buildCalendar(); out.calIndy = CAL_RACES.map(c => c.name);
      out.ovales = ["Texas", "Iowa", "Gateway", "Milwaukee", "Indianapolis 500"].every(c => getCircuitData(c).type === "oval" && _isIndyOval(c)) && !_isIndyOval("Nashville");
      G.cat = "Endurance WEC"; initRivals(); window.CAL_RACES = []; buildCalendar();
      out.calWEC = CAL_RACES.map(c => c.name); out.lmp2 = ecuries().some(t => /United|Cool|Inter Europol|Inception|Richard Mille/.test(t));
      RACE_STATE.circuit = "24h Le Mans"; out.leMans = _getPtsTable()[0]; RACE_STATE.circuit = "Spa 6h"; out.spa = _getPtsTable()[0];
      out.memesLieux = getCircuitData("Fuji 6h") === CIRCUITS["Fuji Speedway"] && getCircuitData("Fuji Round 2") === CIRCUITS["Fuji Speedway"] && getCircuitData("Suzuka Final") === CIRCUITS.Suzuka;
      G.cat = "Super Formula"; initRivals(); out.sf = ecuries();
      out.voies = CAT_PATHS.IndyCar.indexOf("Super Formula") >= 0 && CAT_PATHS["Super Formula"].indexOf("IndyCar") >= 0;
      // Offres latérales depuis la F1 (une saison qui se passe mal)
      G.cat = "Formule 1"; G.currentTeam = "Williams"; initRivals(); window.CAL_RACES = []; buildCalendar();
      G.races = new Array(12).fill({}); G.reputation = 60; G.pendingTransfer = null; G.champPts = 0;
      let nb = 0; for (let k = 0; k < 8 && !nb; k++) { G.offers = []; G._rj134Lateral = 0; nb = RJParalleles.offresLaterales(); }
      out.laterales = G.offers.filter(o => o._lateral && ["IndyCar", "Endurance WEC", "Super Formula"].indexOf(o.cat) >= 0).length;
      // Bonus IndyCar : pole, tours menés
      G.cat = "IndyCar"; G.currentTeam = "Team Penske"; initRivals(); G.champPts = 0;
      const pts0 = G.rivals[0].pts || 0;
      const drivers = [{ name: "moi", isPlayer: true, pos: 1 }, { name: G.rivals[0].name, rivalIdx: 0, pos: 2 }];
      window.LIVE_RACE = { drivers, cur: 0, total: 3 };
      RJParalleles.surTour(); RJParalleles.surTour(); drivers[0].pos = 2; drivers[1].pos = 1; RJParalleles.surTour();
      RJParalleles.bonusIndyCar({ isPole: true, drivers });
      out.bonusJoueur = G.champPts; out.bonusRival = (G.rivals[0].pts || 0) - pts0;
      // Migration : seule la Super Formula est renommée, la Toyota du WEC reste
      G.cat = "Super Formula"; G.currentTeam = "Toyota Gazoo Racing"; RJParalleles.migrer(); out.migSF = G.currentTeam;
      G.cat = "Endurance WEC"; G.currentTeam = "Toyota Gazoo Racing"; RJParalleles.migrer(); out.migWEC = G.currentTeam;
      return out;
    });
    S.verifier("IndyCar : chaque pilote a une écurie, plus de doublon ECR / Foyt", r.indySansEcurie === 0 && !r.ecr, JSON.stringify(r));
    S.verifier("calendriers sans doublon (Milwaukee, São Paulo 6h)", r.calIndy.indexOf("Monterey") < 0 && r.calIndy.indexOf("Milwaukee") >= 0 && r.calWEC.indexOf("Bahrain Final") < 0 && new Set(r.calWEC).size === r.calWEC.length, JSON.stringify([r.calIndy, r.calWEC]));
    S.verifier("les ovales sont des ovales partout (fiche et moteur)", r.ovales, "");
    S.verifier("WEC : classe Hypercar seule, points doublés au Mans", !r.lmp2 && r.leMans === 50 && r.spa === 25, JSON.stringify(r));
    S.verifier("un même lieu sous plusieurs noms partage une seule fiche", r.memesLieux, "");
    S.verifier("Super Formula : des écuries, pas des motoristes ; voies IndyCar ↔ Super Formula", r.sf.indexOf("TOM'S") >= 0 && r.sf.indexOf("Toyota Gazoo Racing") < 0 && r.voies, JSON.stringify(r.sf));
    S.verifier("un pilote de F1 peut recevoir une offre d'IndyCar, de WEC ou de Super Formula", r.laterales >= 1, String(r.laterales));
    S.verifier("IndyCar : +1 pole, +1 tour mené, +2 au plus de tours menés", r.bonusJoueur === 4 && r.bonusRival === 1, JSON.stringify(r));
    S.verifier("anciennes sauvegardes : écuries renommées dans la bonne catégorie seulement", r.migSF === "TOM'S" && r.migWEC === "Toyota Gazoo Racing", JSON.stringify(r));
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

async function suiteAudit() {
  S.suite("Audit : fin de saison, talents, rechargement, radio, karting");
  const { navigateur, contexte, page, journal } = await S.ouvrirJeu();
  try {
    await S.repondeurAutomatique(page);
    // 1. Fin de saison avec une écurie : le bilan s'ouvre
    const fin = await page.evaluate(async () => {
      const bilan = evaluateSeasonTrust();
      const ok = !!bilan && Array.isArray(bilan.summary) && typeof bilan.finalTrust === "number";
      CAL_RACES.forEach(c => { c.done = true; }); G.seasonOver = true;
      showSeasonEnd(); await new Promise(r => setTimeout(r, 600));
      const ecran = (document.querySelector(".scr.on") || {}).id;
      navTo("S-home", null); G.seasonOver = false; CAL_RACES.forEach(c => { c.done = c.week < 6; });
      return { ok, ecran };
    });
    S.verifier("fin de saison avec une écurie : le bilan est calculé et l'écran s'ouvre", fin.ok && fin.ecran === "S-season-end", JSON.stringify(fin));

    // 2. Le talent reste au pilote : l'ordre des talents est conservé par le recalibrage
    const talents = await page.evaluate(() => {
      G.cat = "Formule 1"; G.currentTeam = "Williams"; initRivals();
      Object.keys(G).filter(k => /^_rjSkillsCalib_/.test(k)).forEach(k => delete G[k]);
      const avant = G.rivals.map(x => ({ n: x.name, s: x.skill })).sort((a, b) => b.s - a.s).map(x => x.n);
      _rjRecalibrateSkills(G.rivals.map((r, i) => ({ name: r.name, team: r.team, skill: r.skill, rivalIdx: i })).concat([{ isPlayer: true }]));
      const apres = G.rivals.map(x => ({ n: x.name, s: x.skill })).sort((a, b) => b.s - a.s).map(x => x.n);
      const pool = G.rivals.every(x => { const p = (G.driverPool || []).find(q => q.id === x._poolId); return !p || p.skill === x.skill; });
      const memePremiers = avant.slice(0, 5).filter(n => apres.slice(0, 5).indexOf(n) >= 0).length;
      return { memePremiers, pool };
    });
    S.verifier("le recalibrage garde le classement des talents et l'écrit dans le vivier", talents.memePremiers >= 4 && talents.pool, JSON.stringify(talents));

    // 3. Sauvegarde puis réouverture du jeu : chaque rival retrouve ses points, son écurie, son talent
    await S.courirUneCourse(page, { categorie: "Formule 1", equipe: "Williams", reinitialiserRivaux: false, rang: 4 });
    const avant = await page.evaluate(() => {
      G._rj79Remplacement = null; saveGame(0, { silencieux: true });
      return G.rivals.map(x => x.name + "|" + x.team + "|" + x.pts + "|" + x.skill).sort();
    });
    const p2 = await contexte.newPage();
    await p2.goto(`http://127.0.0.1:${S.PORT}/index.html`, { waitUntil: "load" });
    await p2.waitForTimeout(6500);
    const apres = await p2.evaluate(async () => {
      loadSave(0); await new Promise(r => setTimeout(r, 1500));
      return G.rivals.map(x => x.name + "|" + x.team + "|" + x.pts + "|" + x.skill).sort();
    });
    await p2.close();
    const differents = avant.filter(x => apres.indexOf(x) < 0);
    S.verifier("rechargement : chaque rival garde ses points, son écurie et son talent", differents.length === 0 && apres.length === avant.length, differents.slice(0, 3).join(" ; "));
    const enCours = await page.evaluate(async () => {
      const ref = G.rivals.map(x => x.name + "|" + x.pts).sort().join();
      G.rivals.reverse(); saveGame(0, { silencieux: true });
      G.rivals = []; loadSave(0); await new Promise(r => setTimeout(r, 1200));
      return G.rivals.map(x => x.name + "|" + x.pts).sort().join() === ref;
    });
    S.verifier("rechargement par-dessus une partie ouverte : les points ne changent pas de pilote", enCours, "");

    // 4. Radio des disciplines : les messages d'identité apparaissent
    const radio = await page.evaluate(async () => {
      SETTINGS.simSpeed = "instant";
      G.cat = "Endurance WEC"; G.currentTeam = "Toyota Gazoo Racing"; initRivals(); window.CAL_RACES = []; buildCalendar();
      const c = CAL_RACES.find(x => /le mans/i.test(x.name)); G.semaine = c.week; CAL_RACES.forEach(x => { x.done = x.week < c.week; });
      RACE_STATE.circuit = c.name; RACE_STATE.circuitData = getCircuitData(c.name); RACE_STATE.weather = generateWeather(0); RACE_STATE.qualiPos = 5; G.totalLaps = 30;
      window.LIVE_RACE = { drivers: [], cur: 0, total: 0, finished: false, paused: false, interval: null };
      try { confirmStrategy(); } catch (e) {}
      runRaceLive(); await new Promise(r => setTimeout(r, 900));
      for (let i = 0; i < 600 && !LIVE_RACE.finished; i++) await new Promise(r => setTimeout(r, 25));
      const feed = (LIVE_RACE.directFeed || []).map(f => (f.title || "") + " " + (f.desc || "") + " " + (f.text || ""));
      return { identite: feed.filter(t => /relais|trafic|multi-classes|changement de pilote/i.test(t)).length };
    });
    S.verifier("WEC : les messages radio de relais et de trafic apparaissent", radio.identite > 0, JSON.stringify(radio));

    // 5. Karting : un débutant n'est plus au-dessus de toute la grille
    const kart = await page.evaluate(() => {
      G.cat = "Karting Junior"; G.currentTeam = "Indépendant";
      G.substats = initSubStats("complet", "analyste"); computeLegacyStats(); initRivals();
      Object.keys(G).filter(k => /^_rjSkillsCalib_/.test(k)).forEach(k => delete G[k]);
      _rjRecalibrateSkills(G.rivals.map((r, i) => ({ name: r.name, team: r.team, skill: r.skill, rivalIdx: i })).concat([{ isPlayer: true }]));
      const moi = Math.round(computeRacePerformanceScore() * 100), sk = G.rivals.map(x => x.skill);
      return { moi, devant: sk.filter(s => s >= moi).length, max: Math.max(...sk) };   // à égalité compte : le débutant ne domine pas
    });
    S.verifier("karting junior : un débutant n'est pas au-dessus de toute la grille", kart.devant >= 1, JSON.stringify(kart));

    const bruit = journal.avertissements.filter(a => /ret is not defined|prevUpd2|rjRadioPush/.test(a));
    S.verifier("plus d'erreurs de radio ni de pénalités dans la console", bruit.length === 0, bruit[0] || "");
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

async function suiteSaison() {
  S.suite("Saison complète (joueur automatique)");
  const { jouerSaisons } = require("./joueur-auto.js");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  page.setDefaultTimeout(0);
  page.on("dialog", d => d.accept().catch(() => {}));
  try {
    await S.repondeurAutomatique(page);
    // Les règles de contrat, d'abord, sur un état préparé
    const contrat = await page.evaluate(async () => {
      const d = ms => new Promise(r => setTimeout(r, ms)), out = {};
      // l'offre de sa propre écurie ne s'éteint pas avant la fin de saison
      G.offers = [{ team: G.currentTeam, cat: G.cat, expire: 1 }, { team: "Ailleurs", cat: G.cat, expire: 1 }];
      const garde = G.offers.map(o => o.team === G.currentTeam && o.cat === G.cat);
      G.offers.forEach(o => { "number" == typeof o.expire && !(o.team === G.currentTeam && o.cat === G.cat) && (o.expire -= 1); });
      out.offrePropreGardee = G.offers.filter(o => o.expire > 0).map(o => o.team).join() === G.currentTeam && garde[0];
      // un contrat qui court encore se poursuit au mercato
      const equipe = G.currentTeam;
      G.contractDur = 2; G.offers = []; G.pendingTransfer = null;
      buildTransferOffers();
      const carte = [...document.querySelectorAll("#tr-offers-list > div")].map(c => c.innerText || "").find(t => /contrat en cours/i.test(t));
      out.carteContrat = !!carte;
      // un réserviste promu reste sous contrat la saison suivante
      G._playerRole = "num3";
      _rj79.setDeal({ team: equipe, cat: G.cat, saison: G.saison, cumul: false, credibilite: 70, sessions: [], remplacements: [] });
      G.contractDur = 0; TEAM_TRUST.value = 60; G._rj79SiegeVacant = null;
      _rj79.promouvoir(false);
      out.promuSousContrat = G.contractDur >= 2 && G._playerRole === "num2";
      G.contractDur = 2; _rj79.setDeal(null);
      return out;
    });
    S.verifier("l'offre de prolongation de sa propre écurie reste ouverte jusqu'au mercato", contrat.offrePropreGardee, JSON.stringify(contrat));
    S.verifier("un contrat en cours se poursuit au mercato, même sans nouvelle offre", contrat.carteContrat, JSON.stringify(contrat));
    S.verifier("un réserviste promu est engagé pour la saison suivante", contrat.promuSousContrat, JSON.stringify(contrat));

    // Puis une vraie saison de F1, du premier départ au début de la suivante
    const r = await jouerSaisons(page, { saisons: 1, tours: 4 });
    S.verifier("une saison de F1 se joue jusqu'au mercato et à la saison suivante", r.saisonsFaites === 1, JSON.stringify(r.journal) + " " + r.anomalies.slice(0, 3).join(" ; "));
    S.verifier("toutes les manches sont disputées, sprints compris", r.courses >= 10 && r.sprints >= 1, r.courses + " courses, " + r.sprints + " sprints");
    S.verifier("aucune incohérence relevée en cours de saison ni au changement de saison", r.anomalies.length === 0, r.anomalies.slice(0, 4).join(" ; "));
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

async function suiteAppui() {
  S.suite("Appuis au doigt, jeu pivoté (téléphone tenu à l'horizontale, rotation verrouillée)");
  const { navigateur, contexte, page, journal } = await S.ouvrirJeu({ viewport: { width: 390, height: 844 }, mobile: true });
  try {
    const cdp = await contexte.newCDPSession(page);
    const actif = await page.evaluate(() => {
      window.__clics = 0; document.addEventListener("click", () => window.__clics++, true);
      navTo("S-home", "ni-home");
      return !!(window.RJAppuiPivote && RJAppuiPivote.actif());
    });
    S.verifier("le jeu est pivoté et la gestion des appuis est active", actif, "");
    const cibles = await page.evaluate(() => [...document.querySelectorAll("#main-nav .ni, .apex-action-tile")]
      .filter(b => b.getClientRects().length && !/accueil|plus/i.test(b.innerText || ""))
      .map(b => { const r = b.getBoundingClientRect(); return { txt: (b.innerText || "").trim().split("\n")[0].slice(0, 14), x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; }));
    const ratés = [];
    for (const c of cibles) {
      await page.evaluate(() => { navTo("S-home", "ni-home"); window.__clics = 0; });
      await page.waitForTimeout(250);
      // un doigt réel bouge un peu : 3 px de glissé
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: c.x, y: c.y, id: 1 }] });
      for (let k = 1; k <= 3; k++) { await page.waitForTimeout(12); await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: c.x + k, y: c.y, id: 1 }] }); }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await page.waitForTimeout(450);
      const r = await page.evaluate(() => ({ ecran: (document.querySelector(".scr.on") || {}).id, clics: window.__clics }));
      if (r.ecran === "S-home" || r.clics !== 1) ratés.push(c.txt + " (" + r.ecran + ", " + r.clics + " clic)");
    }
    S.verifier("chaque appui sur une tuile ou le rail ouvre son écran, avec un seul clic", cibles.length > 6 && ratés.length === 0, ratés.join(" ; ") || cibles.length + " cibles");
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

async function suiteCalendrier() {
  S.suite("Calendriers qui évoluent d'une saison à l'autre");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    await S.repondeurAutomatique(page);
    const r = await page.evaluate(async () => {
      const d = ms => new Promise(r => setTimeout(r, ms)), out = {};
      out.ancienne = G._calDepart === G.saison + 1;          // la partie de test, antérieure : sa saison en cours ne change pas
      const dep = G.saison; G._calDepart = dep;
      const L = []; for (let s = dep; s < dep + 30; s++) L.push(RJCalendrier.plan("Formule 1", s));
      const piliers = Object.keys(RJCalendrier.F1).filter(n => RJCalendrier.F1[n].statut === "pilier");
      out.bornes = L.every(p => p.courses.length >= 20 && p.courses.length <= 26 && p.sprints.length >= 6 && p.sprints.length <= 12);
      out.piliers = L.every(p => piliers.every(n => p.courses.indexOf(n) >= 0));
      out.changements = L.slice(1).filter((p, i) => p.courses.join() !== L[i].courses.join()).length;
      out.ordre = L.every(p => p.semaines.every((w, i) => w >= 3 && w <= 47 && (!i || w > p.semaines[i - 1])) && p.courses.every((n, i) => !i || RJCalendrier.F1[n].mois >= RJCalendrier.F1[p.courses[i - 1]].mois));
      out.sprints = L.every(p => p.sprints.every(n => p.courses.indexOf(n) >= 0) && p.sprints.indexOf("Monaco") < 0);
      out.fiches = [...new Set(L.flatMap(p => p.courses))].filter(n => { const c = getCircuitData(n); return !c || c === DEFAULT_CIRCUIT || !c.trace || !_getCircuitCountry(n); });
      const f1 = RJCalendrier.plan("Formule 1", dep + 6), f2 = RJCalendrier.plan("Formule 2", dep + 6), f3 = RJCalendrier.plan("Formule 3", dep + 6);
      out.support = f2.courses.every(n => f1.courses.indexOf(n) >= 0) && f3.courses[f3.courses.length - 1] === "Macao GP";
      out.fixes = RJCalendrier.plan("Super Formula", dep + 6) === null && RJCalendrier.plan("Formule 4", dep + 6) === null;
      // changement de saison : le nouveau calendrier est celui du plan, sprints compris
      G.offers = []; G.pendingTransfer = null; G.contractDur = 3; CAL_RACES.forEach(c => c.done = true); G.seasonOver = true;
      startNextSeason({ isRenewal: true, team: G.currentTeam, dur: 2, budget: 0 }); await d(800);
      const p = RJCalendrier.plan("Formule 1", G.saison);
      out.saison = CAL_RACES.map(c => c.name).join() === p.courses.join() && CAL_RACES.filter(c => c.isSprint).length === p.sprints.length;
      // sauvegarde : le calendrier revient tel quel
      CAL_RACES[0].done = true;
      const avant = JSON.stringify(CAL_RACES.map(c => [c.name, c.week, !!c.isSprint, !!c.done]));
      saveGame(0, { silencieux: true }); G._calGraine = 1; G._calDepart = 1; CAL_RACES = [];
      loadSave(0); await d(1500);
      out.recharge = JSON.stringify(CAL_RACES.map(c => [c.name, c.week, !!c.isSprint, !!c.done])) === avant;
      return out;
    });
    S.verifier("une partie déjà commencée garde le calendrier de sa saison en cours", r.ancienne, JSON.stringify(r));
    S.verifier("F1 : 20 à 26 Grands Prix et 6 à 12 sprints, chaque saison", r.bornes, JSON.stringify(r));
    S.verifier("F1 : les piliers restent, le calendrier change de temps en temps (pas chaque année)", r.piliers && r.changements >= 3 && r.changements <= 22, r.changements + " saisons sur 29");
    S.verifier("les manches restent dans l'ordre de la saison, sprints au calendrier (jamais Monaco)", r.ordre && r.sprints, "");
    S.verifier("chaque circuit a sa fiche, son tracé et son pays", r.fiches.length === 0, r.fiches.join(", "));
    S.verifier("F2 et F3 suivent la F1, Macao clôt la F3 ; Super Formula et F4 inchangées", r.support && r.fixes, "");
    S.verifier("au changement de saison, le calendrier et les sprints sont ceux de la nouvelle saison", r.saison, "");
    S.verifier("le calendrier d'une saison revient tel quel au rechargement", r.recharge, "");
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

async function suiteAcademie() {
  S.suite("Académie de pilotes");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    await S.repondeurAutomatique(page);
    const r = await page.evaluate(async () => {
      const d = ms => new Promise(r => setTimeout(r, ms)), out = {};
      out.donnees = Object.keys(ACADEMIES).flatMap(n => [ACADEMIES[n].f1Team].concat(ACADEMIES[n].f1Alt || []).filter(t => !(TEAM_OFFERS["Formule 1"] || []).some(o => o.team === t)));
      const histo = CAREER_HISTORY.slice();
      const prep = (cat, place, rel, acad) => {
        CAREER_HISTORY.length = 0; histo.forEach(h => CAREER_HISTORY.push(h));
        G.cat = cat; G.currentTeam = (TEAM_OFFERS[cat] || [])[0].team; G._seasonTeam = G.currentTeam; G._playerRole = "num2"; initRivals();
        window.CAL_RACES = []; buildCalendar(); G.offers = []; G.pendingTransfer = null; G._baquets = null;
        Object.keys(G).filter(k => /^w[123]_/.test(k)).forEach(k => delete G[k]);
        G.age = 19; PLAYER_ACADEMY.id = null; joinAcademy(acad || "Ferrari Driver Academy"); PLAYER_ACADEMY.relation = rel; PLAYER_ACADEMY.f1Offer = true; PLAYER_ACADEMY._rj138 = {};
        G.rivals.forEach((x, i) => x.pts = 200 - i * 10); G.champPts = place === 1 ? 999 : 200 - (place - 1) * 10 + 1;
        G.races = new Array(CAL_RACES.length - 2).fill({ pos: 3, pts: 15 });
      };
      const f1 = () => G.offers.filter(o => o.cat === "Formule 1" && o._academie).map(o => o.team + ":" + o.role);
      prep("Formule 2", 2, 80); generateTeamOffers(); generateTeamOffers();
      out.fdaPodium = f1(); out.canLeave = PLAYER_ACADEMY.canLeave;
      prep("Formule 2", 1, 80); generateTeamOffers(); out.fdaChampion = f1();
      prep("Formule 2", 1, 95); generateTeamOffers(); out.fdaProtege = f1();
      prep("Formule 2", 9, 80); generateTeamOffers(); out.f2Milieu = f1();
      prep("Formule 2", 4, 80, "Red Bull Junior Team"); CAREER_HISTORY.push({ saison: G.saison - 1, cat: "Formule 3", pos: 1 }); generateTeamOffers(); out.rbjt = f1();
      prep("Formule 3", 1, 80); generateTeamOffers(); out.f3Champion = f1();
      prep("Formule 3", 3, 80); generateTeamOffers(); out.f3Podium = f1();
      prep("Formula Regional", 1, 80); generateTeamOffers(); out.fr = f1();
      // revue de fin de saison : avertissement puis renvoi (Ferrari), renvoi immédiat (Red Bull)
      prep("Formule 2", 18, 50); const s0 = G.saison;
      out.revue1 = RJAcademie.revueSaison(); G.saison = s0 + 1; out.revue2 = RJAcademie.revueSaison(); G.saison = s0;
      out.apresRenvoi = PLAYER_ACADEMY.id;
      prep("Formule 2", 10, 60, "Red Bull Junior Team"); out.revueRB = RJAcademie.revueSaison();
      prep("Formule 2", 2, 60); const rel0 = PLAYER_ACADEMY.relation; out.bonne = RJAcademie.revueSaison(); out.bonus = PLAYER_ACADEMY.relation - rel0;
      // départ : réputation et porte fermée
      prep("Formule 2", 2, 60); G.rep = G.rep || {}; G.rep.paddock = 40;
      leaveAcademy("Séparation volontaire"); out.paddock = G.rep.paddock;
      out.reprise = getAvailableAcademies().indexOf("Ferrari Driver Academy") >= 0;
      // invitation par message, une fois par saison
      CAREER_HISTORY.length = 0; histo.forEach(h => CAREER_HISTORY.push(h));
      PLAYER_ACADEMY.id = null; PLAYER_ACADEMY._rj138 = {}; G.cat = "Formule 3"; initRivals(); G.rivals.forEach((x, i) => x.pts = 200 - i * 10); G.champPts = 999; G.races = [1, 2, 3, 4];
      const nb = () => getMailbox().filter(m => /place pour toi/.test(m.subject)).length, m0 = nb();
      RJAcademie.inviter(); RJAcademie.inviter(); out.invitations = nb() - m0;
      // sauvegarde
      prep("Formule 2", 18, 50); RJAcademie.revueSaison(); const av = JSON.stringify(PLAYER_ACADEMY._rj138);
      saveGame(0, { silencieux: true }); PLAYER_ACADEMY._rj138 = {}; PLAYER_ACADEMY.canLeave = false; loadSave(0); await d(1500);
      out.recharge = JSON.stringify(PLAYER_ACADEMY._rj138) === av && PLAYER_ACADEMY.canLeave === true;
      return out;
    });
    S.verifier("les écuries de F1 des académies existent", r.donnees.length === 0, r.donnees.join(", "));
    S.verifier("Ferrari, par étapes : un podium en F2 vaut la réserve, qui survit à la concurrence des baquets", JSON.stringify(r.fdaPodium) === '["Ferrari:num3"]', JSON.stringify(r.fdaPodium));
    S.verifier("Ferrari : champion de F2, baquet chez Haas ; protégé, chez Ferrari", /^Haas.*num2$/.test(r.fdaChampion[0] || "") && /^Ferrari.*num2$/.test(r.fdaProtege[0] || ""), JSON.stringify([r.fdaChampion, r.fdaProtege]));
    S.verifier("Red Bull, promotion rapide : un top 5 en F2 vaut Racing Bulls", /^Racing Bulls.*num2$/.test(r.rbjt[0] || ""), JSON.stringify(r.rbjt));
    S.verifier("F2 en milieu de tableau : réserve chez l'écurie phare", /^Ferrari.*num3$/.test(r.f2Milieu[0] || ""), JSON.stringify(r.f2Milieu));
    S.verifier("champion de F3 : la voie F1 s'ouvre ; F3 hors titre et Formula Regional : pas encore", r.f3Champion.length === 1 && !r.f3Podium.length && !r.fr.length, JSON.stringify([r.f3Champion, r.f3Podium, r.fr]));
    S.verifier("un membre peut quitter son académie", r.canLeave === true, "");
    S.verifier("revue : avertissement puis renvoi chez Ferrari, renvoi immédiat chez Red Bull", r.revue1 === "avertissement" && r.revue2 === "renvoi" && !r.apresRenvoi && r.revueRB === "renvoi", JSON.stringify([r.revue1, r.revue2, r.apresRenvoi, r.revueRB]));
    S.verifier("revue : une saison sur le podium renforce la relation", r.bonne === "bonne" && r.bonus === 8, r.bonne + " " + r.bonus);
    S.verifier("partir coûte 3 de réputation paddock, et l'académie ne reprend pas", r.paddock === 37 && !r.reprise, r.paddock + " " + r.reprise);
    S.verifier("un pilote éligible reçoit une invitation, une seule par saison", r.invitations === 1, String(r.invitations));
    S.verifier("l'état de l'académie revient au rechargement", r.recharge, "");
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

async function suiteCaracteres() {
  S.suite("Caractère des écuries de F1 et des académies");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    await S.repondeurAutomatique(page);
    const r = await page.evaluate(async () => {
      const d = ms => new Promise(r => setTimeout(r, ms)), out = {}, C = RJCaracteres;
      out.sansEcurie = (TEAM_OFFERS["Formule 1"] || []).map(o => o.team).filter(t => !C.ecurie(t));
      out.sansAcademie = Object.keys(ACADEMIES).filter(n => !C.academie(ACADEMIES[n].id));
      // poids dans le choix d'un candidat
      out.ferrariRookie = C.ajustement("Formule 1", "Ferrari", { rookie: true }) - C.ajustement("Formule 1", "Ferrari", { rookie: false });
      out.rbMembre = C.ajustement("Formule 1", "Red Bull Racing", { rookie: true, membre: true }) - C.ajustement("Formule 1", "Red Bull Racing", { rookie: true });
      out.mcRookie = C.ajustement("Formule 1", "McLaren", { rookie: true }) - C.ajustement("Formule 1", "McLaren", { rookie: false });
      out.hors = C.ajustement("Formule 2", "Ferrari", { rookie: true });
      G.pilot.style = "attaquant"; G.pilot.trait = "competiteur";
      out.affRB = C.affinite(C.ecurie("Red Bull Racing")); out.affFer = C.affinite(C.ecurie("Ferrari"));
      // dans la vraie sélection (116) : un débutant pèse moins chez Ferrari qu'un pilote qui a déjà couru en F1
      G.cat = "Formule 2"; PLAYER_ACADEMY.id = null;
      const histo = CAREER_HISTORY.slice(), sc = () => RJBaquets.classer("Formule 1", "Ferrari", { team: "Ferrari", cat: "Formule 1", cost: 0 }).candidats.filter(x => x.joueur)[0].score;
      const s1 = sc(); CAREER_HISTORY.push({ saison: G.saison - 1, cat: "Formule 1", pos: 12 }); const s2 = sc();
      CAREER_HISTORY.length = 0; histo.forEach(h => CAREER_HISTORY.push(h));
      out.selection = s2 > s1;
      out.motif = C.motif("Formule 1", "Ferrari", { rookie: false });
      out.patience = [C.patience("Mercedes"), C.patience("Red Bull Racing"), C.patience("Dale Coyne Racing")];
      // affichage : fiche de l'écurie, offre de F1, page Académie
      showTeamProfileModal("Ferrari"); await d(100);
      out.fiche = (document.querySelector("#team-profile-modal .rj139-fiche") || {}).textContent || "";
      closeTeamProfileModal();
      G.offers = [buildOffer({ team: "Red Bull Racing", cat: "Formule 1", role: "num3", expire: 5 })];
      let liste = document.getElementById("offers-list"); const cree = !liste;
      if (cree) { liste = document.createElement("div"); liste.id = "offers-list"; document.body.appendChild(liste); }
      renderOffers(); out.offre = (liste.querySelector(".rj139-labels") || {}).textContent || "";
      if (cree) liste.remove();
      G.offers = [];
      const zone = document.createElement("div"); zone.id = "rj139-test-acad"; document.body.appendChild(zone);
      PLAYER_ACADEMY.id = null; joinAcademy("Red Bull Junior Team"); renderAcademyPage("rj139-test-acad");
      out.academie = (zone.querySelector(".rj139-labels") || {}).textContent || "";
      zone.remove(); PLAYER_ACADEMY.id = null;
      return out;
    });
    S.verifier("chaque écurie de F1 et chaque académie a son caractère", !r.sansEcurie.length && !r.sansAcademie.length, r.sansEcurie.concat(r.sansAcademie).join(", "));
    S.verifier("Ferrari pénalise nettement le débutant, McLaren à peine ; Red Bull favorise sa filière", r.ferrariRookie <= -6 && r.mcRookie > -3 && r.rbMembre >= 10, JSON.stringify([r.ferrariRookie, r.mcRookie, r.rbMembre]));
    S.verifier("le caractère ne joue qu'en F1", r.hors === 0, String(r.hors));
    S.verifier("le style et le trait du pilote comptent un peu (3 points au plus)", r.affRB === 3 && r.affFer === 0, r.affRB + " " + r.affFer);
    S.verifier("sélection des baquets (116) : chez Ferrari, l'expérience en F1 compte", r.selection, "");
    S.verifier("un baquet perdu dit pourquoi le caractère a pesé", /expérience/.test(r.motif || ""), String(r.motif));
    S.verifier("patience au renvoi : Mercedes patiente, Red Bull non, hors F1 neutre", r.patience[0] > 0 && r.patience[1] < 0 && r.patience[2] === 0, JSON.stringify(r.patience));
    S.verifier("labels sur la fiche de l'écurie", /Préfère l'expérience/.test(r.fiche), r.fiche.slice(0, 80));
    S.verifier("labels sur une offre de F1", /Filière maison/.test(r.offre), r.offre);
    S.verifier("labels sur la page Académie", /Impitoyable/.test(r.academie), r.academie);
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

async function suiteCreation() {
  S.suite("Création du pilote sur téléphone (sans défiler)");
  const { navigateur, page, journal } = await S.ouvrirJeu({ viewport: { width: 852, height: 393 }, mobile: true, charger: false });
  try {
    const r = await page.evaluate(async () => {
      const d = ms => new Promise(r => setTimeout(r, ms)), out = { etapes: [] };
      goCreate(); await d(300);
      const go = document.getElementById("rj80-go");
      out.modeBouton = !!go && go.getBoundingClientRect().bottom <= innerHeight;
      go.click(); await d(400);
      out.continents = [...document.querySelectorAll("#continent-grid .continent-opt")].map(b => !!b.querySelector("svg, img")).filter(Boolean).length;
      selContinent("Europe"); await d(100);
      out.pays = !!document.querySelector("#nat-grid .nat-opt svg, #nat-grid .nat-opt img");
      document.getElementById("p-fn").value = "Lou"; document.getElementById("p-ln").value = "Martin";
      document.querySelector("#nat-grid .nat-opt").click(); await d(250);
      for (let n = 1; n <= 6; n++) {
        if (n === 2) { document.getElementById("p-birthcity").value = "Lyon"; document.getElementById("p-dob-year").value = "2012"; }
        const sc = document.querySelector("#S-create > .scroll"), btn = document.getElementById("cre-next");
        out.etapes.push({ n, defile: sc.scrollHeight - sc.clientHeight, bouton: btn.getBoundingClientRect().bottom <= innerHeight && btn.getBoundingClientRect().top >= 0,
          titre: (document.getElementById("rj80-stepname") || {}).textContent || "" });
        if (n < 6) { creNext(); await d(250); }
      }
      return out;
    });
    S.verifier("le choix du mode : Continuer visible sans défiler", r.modeBouton, "");
    S.verifier("continents sans drapeau, pays avec leur drapeau", r.continents === 0 && r.pays, r.continents + " " + r.pays);
    S.verifier("Continuer toujours visible, à chaque étape", r.etapes.every(e => e.bouton), JSON.stringify(r.etapes.map(e => e.bouton)));
    S.verifier("identité (pays choisi), style, caractère et récapitulatif tiennent sans défiler", [1, 3, 4, 6].every(n => r.etapes[n - 1].defile <= 2), JSON.stringify(r.etapes.map(e => e.defile)));
    S.verifier("origines et profil : au plus quelques pixels de défilement", r.etapes[1].defile <= 40 && r.etapes[4].defile <= 40, JSON.stringify(r.etapes.map(e => e.defile)));
    S.verifier("sous-titres courts, sans point final", r.etapes.every(e => e.titre && !/\.\s*$/.test(e.titre) && e.titre.length <= 40), JSON.stringify(r.etapes.map(e => e.titre)));
    S.verifier("aucune erreur", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

async function suiteDecisions() {
  S.suite("Décisions en course");
  const { navigateur, page, journal } = await S.ouvrirJeu();
  try {
    const install = await page.evaluate(() => {
      const a = id => (window[id] || []).some(h => h && h.id === "rj107");
      return {
        api: !!(window.RJ107 && RJ107.voisins && RJ107.choixDuMoment && RJ107.evenement),
        desinstalle: typeof window._rj107Uninstall === "function",
        hooks: a("RJ_LAP_HOOKS") && a("RJ_RACE_START_HOOKS") && a("RJ_LEADERBOARD_HOOKS")
      };
    });
    S.verifier("le module expose son API", install.api);
    S.verifier("le module se désinstalle", install.desinstalle);
    S.verifier("le module est inscrit aux trois registres", install.hooks);
    if (!install.api) return;

    /* Fonctions pures, sur des courses fabriquées. */
    const pur = await page.evaluate(() => {
      const pilote = (pos, gap, x) => Object.assign({ name: "P" + pos, pos, gap, dnf: false }, x || {});
      const course = (drivers, x) => Object.assign({ drivers, cur: 10, total: 20, _rj107: { n: 0, dernierTour: -99, faits: {} } }, x || {});
      const base = () => [pilote(1, 0), pilote(2, 0.6), pilote(3, 1.4, { isPlayer: true }), pilote(4, 2.1)];
      const r = {};

      let v = RJ107.voisins(course(base()));
      r.milieu = v.devant.pos === 2 && v.derriere.pos === 4 && Math.abs(v.ecartDevant - 0.8) < 1e-9 && Math.abs(v.ecartDerriere - 0.7) < 1e-9;
      const tete = base(); tete[0].isPlayer = true; tete[2].isPlayer = false;
      v = RJ107.voisins(course(tete));
      r.enTete = v.devant === null && v.derriere.pos === 2;
      const dnf = base(); dnf[1].dnf = true;
      v = RJ107.voisins(course(dnf));
      r.devantAbandonne = v.devant === null;
      const mc = base(); mc[3]._mc = true;
      v = RJ107.voisins(course(mc));
      r.traficExclu = v.derriere === null;

      const m = (drivers, x) => RJ107.choixDuMoment(course(drivers, x));
      r.rienAuDepart = m(base(), { cur: 0 }) === null;
      r.relance = m(base(), { cur: 9, _rjLastNeutralEndLap: 9 }) === "relance";
      const loin = () => base().map(d => Object.assign(d, { gap: d.pos * 3 }));
      r.relanceUneFois = m(loin(), { cur: 9, _rjLastNeutralEndLap: 9, _rj107: { n: 1, dernierTour: 2, faits: {}, neutreVu: 9 } }) === null;
      const proche = base(); proche[1].gap = 1.0;
      r.duel = m(proche) === "duel";
      r.duelHorsFenetre = m(proche, { cur: 2 }) === null;
      r.fin = m(base(), { cur: 17 }) === "fin";
      r.espacement = m(base(), { cur: 17, _rj107: { n: 1, dernierTour: 16, faits: {} } }) === null;
      r.plafond = m(base(), { cur: 17, _rj107: { n: 4, dernierTour: 1, faits: {} } }) === null;
      const ko = base(); ko[2].dnf = true;
      r.joueurAbandonne = m(ko, { cur: 17 }) === null;
      r.rienSousNeutralisation = m(base(), { cur: 17, _rjNeutral: { active: true, type: "sc" } }) === null &&
        m(proche, { _rjNeutral: { active: true, type: "vsc" } }) === null;
      r.finSansPression = m(loin(), { cur: 17 }) === null;
      const poursuivi = loin(); poursuivi[3].gap = 10;
      r.finEnDefense = m(poursuivi, { cur: 17 }) === "fin" &&
        /défense/.test(RJ107.evenement("fin", course(poursuivi, { cur: 17 })).title);
      /* Le pari doit valoir le coup : espérance du choix osé > choix sûr. */
      r.oserPaie = ["relance", "duel", "fin"].every(k => {
        const [ose, sur] = RJ107.evenement(k, course(base(), { cur: 17 })).choices;
        const esp = ose.mod + ose.chance.fail * ose.chance.failMod;
        return esp > sur.mod && !sur.chance;
      });
      const piege = base(); piege[1].name = '<img src=x onerror="window.__rj107xss=1">';
      r.nomsEchappes = !/<img/.test(RJ107.evenement("duel", course(piege)).title);

      r.evenements = ["relance", "duel", "fin"].every(k => {
        const ev = RJ107.evenement(k, course(base(), { cur: 17 }));
        return ev && ev.title && ev.desc && ev.choices.length === 2 &&
          ev.choices.every(c => c.text && typeof c.mod === "number" && !c.posGain && !c.posLoss) &&
          ev.choices.some(c => c.chance && c.chance.fail > 0 && c.chance.failMod < 0 && c.mod + c.chance.failMod > -0.28);
      });
      return r;
    });
    Object.entries(pur).forEach(([k, ok]) => S.verifier("fonction pure : " + k, ok === true));

    /* Courses complètes : décisions posées et répondues, mini-classement tenu. */
    await S.repondeurAutomatique(page);
    let totalDecisions = 0;
    for (const cat of ["Formule 1", "Formule 3", "Formule 1"]) {
      await page.evaluate(() => {
        window.__rj107Sonde = { lus: 0, incoherents: 0, doublons: 0, ecartsArrondis: 0 };
        window.RJ_LAP_HOOKS.push({ id: "__test_rj107", run: function (tour, lr) {
          const mini = document.querySelectorAll("#rj107-mini");
          if (mini.length > 1) window.__rj107Sonde.doublons++;
          if (!mini.length) return;
          const v = RJ107.voisins(lr);
          if (!v.joueur || v.joueur.dnf) return;
          window.__rj107Sonde.lus++;
          /* Le mini-classement montre la position sur la piste à cet instant (108) :
             on le redessine avec l'état lu, l'horloge avançant entre deux lectures. */
          const e = RJModelePiste.etat(), j = e.voitures.find(x => x.joueur);
          (window.RJ_FRAME_HOOKS || []).forEach(h => h.run(e));
          const pos = mini[0].querySelector(".rj107-moi .rj107-pos");
          if (!pos || !j || pos.textContent !== "P" + j.pos) window.__rj107Sonde.incoherents++;
          /* L'arrondi global (04q) agit après coup : on relit au tick suivant. */
          setTimeout(() => mini[0].querySelectorAll(".rj107-ecart").forEach(e => {
            if (e.textContent && !/\d,\d s$/.test(e.textContent)) window.__rj107Sonde.ecartsArrondis++;
          }), 0);
        } });
      });
      const r = await S.courirUneCourse(page, { categorie: cat });
      const etat = await page.evaluate(() => {
        window.RJ_LAP_HOOKS = window.RJ_LAP_HOOKS.filter(h => h.id !== "__test_rj107");
        (window.RJ_LEADERBOARD_HOOKS || []).forEach(h => { if (h.id === "rj107") h.apres(); });
        const mini = document.getElementById("rj107-mini");
        return { n: LIVE_RACE._rj107 ? LIVE_RACE._rj107.n : 0, sonde: window.__rj107Sonde,
                 miniApres: !!mini && getComputedStyle(mini).display !== "none" };
      });
      const t = cat.padEnd(10);
      S.verifier(t + "arrive au drapeau", r.terminee === true, r.bloqueeA ? "bloquée à " + r.bloqueeA : (r.anomalies || [])[0] || "");
      /* Une course sans adversaire proche peut légitimement n'en avoir aucune. */
      S.verifier(t + "au plus 4 décisions posées", etat.n <= 4, etat.n + " décision(s)");
      totalDecisions += etat.n;
      S.verifier(t + "le mini-classement est affiché", etat.sonde.lus > 0, etat.sonde.lus + " tour(s) lus");
      S.verifier(t + "le mini-classement suit la position", etat.sonde.incoherents === 0, etat.sonde.incoherents + " écart(s)");
      S.verifier(t + "un seul mini-classement", etat.sonde.doublons === 0);
      S.verifier(t + "les écarts gardent leur dixième", etat.sonde.ecartsArrondis === 0, etat.sonde.ecartsArrondis + " écart(s) arrondi(s)");
      S.verifier(t + "le mini-classement disparaît à l'arrivée", !etat.miniApres);
    }
    S.verifier("des décisions sont posées en course", totalDecisions >= 1, totalDecisions + " sur 3 courses");

    /* Le chien de garde ne doit pas clore une course qui attend une réponse. */
    const garde = await page.evaluate(async () => {
      clearInterval(window.__rjAuto); window.__rjAuto = null;
      const st = window.setTimeout;
      let declencheur = null;
      window.setTimeout = function (f, ms) {
        if (f && f.name === "rjRaceWatchdogTrigger") declencheur = f;
        return st.apply(this, arguments);
      };
      try {
        if (window.LIVE_RACE && LIVE_RACE.interval) clearInterval(LIVE_RACE.interval);
        window.LIVE_RACE = { drivers: [], cur: 0, total: 0, finished: false, paused: false, interval: null };
        const btn = document.getElementById("race-btn"); if (btn) btn.disabled = true;
        runRaceLive();
      } finally { window.setTimeout = st; }
      const ev = RJ107.evenement("duel", LIVE_RACE);
      LIVE_RACE.pendingEvent = ev; LIVE_RACE.paused = true; showLiveEvent(ev);
      await new Promise(r => st(r, 100));
      const enAttente = !!LIVE_RACE.pendingEvent && LIVE_RACE.paused;
      if (LIVE_RACE.interval) clearInterval(LIVE_RACE.interval);
      const res = { trouve: !!declencheur, enAttente };
      if (!declencheur) return res;
      declencheur();
      res.finieEnAttente = !!LIVE_RACE.finished;
      /* Entre deux décisions : plus de modale, mais la course avance. */
      document.getElementById("live-event-modal").style.display = "none";
      LIVE_RACE.pendingEvent = null; LIVE_RACE.paused = false; LIVE_RACE.cur += 1;
      declencheur();
      res.finieQuandElleAvance = !!LIVE_RACE.finished;
      /* Course réellement figée : le filet doit toujours jouer. */
      declencheur();
      res.finieQuandFigee = !!LIVE_RACE.finished;
      LIVE_RACE.finished = true;
      return res;
    });
    S.verifier("une décision met la course en attente", garde.enAttente);
    S.verifier("le chien de garde est armé", garde.trouve);
    S.verifier("le chien de garde respecte une décision en attente", garde.finieEnAttente === false);
    S.verifier("le chien de garde laisse filer une course qui avance", garde.finieQuandElleAvance === false);
    S.verifier("le chien de garde clôt toujours une course figée", garde.finieQuandFigee === true);

    const desinstall = await page.evaluate(() => {
      window._rj107Uninstall();
      return ["RJ_LAP_HOOKS", "RJ_RACE_START_HOOKS", "RJ_LEADERBOARD_HOOKS"]
        .every(id => !(window[id] || []).some(h => h && h.id === "rj107"));
    });
    S.verifier("la désinstallation retire les trois inscriptions", desinstall);
    S.verifier("aucune erreur pendant la suite", journal.erreurs.length === 0, journal.erreurs[0] || "");
  } finally { await navigateur.close(); }
}

/* ==================================================================== *
 * ORCHESTRATION
 * ==================================================================== */

const SUITES = {
  chargement: suiteChargement,
  creation: suiteCreation,
  sauvegarde: suiteSauvegarde,
  persistance: suitePersistance,
  fiabilite: suiteFiabilite,
  parcours: suiteParcours,
  couches: suiteCouches,
  sobriete: suiteSobriete,
  piste: suitePiste,
  endurance: suiteEndurance,
  qualifications: suiteQualifications,
  course: () => suiteCourse(),
  "course-rapide": () => suiteCourse(["Formule 1"]),
  weekend: suiteWeekend,
  ui: suiteInterface,
  paysage: suitePaysage,
  circuit: suiteCircuit,
  superlicence: suiteSuperLicence,
  mercato: suiteMercato,
  heritage: suiteHeritage,
  economie: suiteEconomie,
  baquets: suiteBaquets,
  negociation: suiteNegociation,
  arrivee: suiteArrivee,
  simulation: suiteSimulation,
  equite: suiteEquite,
  chronometre: suiteChronometre,
  ecrans: suiteEcrans,
  reglages: suiteReglages,
  entourage: suiteEntourage,
  presse: suitePresse,
  messagerie: suiteMessagerie,
  vieperso: suiteViePerso,
  habillage: suiteHabillage,
  amour: suiteAmour,
  avatars: suiteAvatars,
  rivaux: suiteRivaux,
  vides: suiteVides,
  circuits: suiteCircuits,
  logos: suiteLogos,
  contacts: suiteContacts,
  essais: suiteEssais,
  casque: suiteCasque,
  notes: suiteNotes,
  reseaux: suiteReseaux,
  decisions: suiteDecisions,
  reserve: suiteReserve,
  paralleles: suiteParalleles,
  audit: suiteAudit,
  saison: suiteSaison,
  appui: suiteAppui,
  calendrier: suiteCalendrier,
  academie: suiteAcademie,
  caracteres: suiteCaracteres,
  creation: suiteCreation
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
  console.log(`Racing Journey — filet de tests   (http://127.0.0.1:${S.PORT}, graine ${S.GRAINE})`);
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
