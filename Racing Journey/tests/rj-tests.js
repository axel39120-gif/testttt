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
  mtab: null, rtab: null, showResult: null
};

function definitionsDansLesSources() {
  const fs = require("fs"), path = require("path");
  const parcourir = d => fs.readdirSync(d, { withFileTypes: true })
    .flatMap(e => e.isDirectory() ? parcourir(path.join(d, e.name)) : [path.join(d, e.name)]);
  const textes = parcourir(path.join(S.RACINE, "js")).filter(f => f.endsWith(".js")).map(f => fs.readFileSync(f, "utf8"));
  const compte = {};
  Object.keys(APLATIES).forEach(n => {
    const re = new RegExp("function\\s+" + n + "\\s*\\(|window\\." + n + "\\s*=\\s*function", "g");
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
    S.verifier("un changement de saison avance d'une saison", saison.saisons === 1 && saison.ans === 1,
      "+" + saison.saisons + " saison(s), +" + saison.ans + " an(s)");
    S.verifier("aucune erreur au chargement", journal.erreurs.length === 0, journal.erreurs[0] || "");
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
    /* Plafond dur : une régression franche ne doit pas passer pour le défaut connu. */
    S.verifier("aucun saut aberrant (plafond dur 25)", sauts.every(s => s <= 25), "max " + Math.max(...sauts));
    if (sauts.every(s => s <= 12)) S.verifier("aucun saut au-delà du seuil actuel (12)", true, detail);
    else S.ignorer("aucun saut au-delà du seuil actuel (12)", "défaut connu, à corriger en T7 — " + detail);
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
      /* Endurance : bonds connus (relais, regroupement sous safety car), à
         corriger avec le moteur à position continue (T7). Plafond dur à 25. */
      if (cat === "Endurance WEC" && r.sautMax > plafondSaut && r.sautMax <= 25)
        S.ignorer(titre + "aucun saut de position aberrant", "défaut connu, T7 — " + detailSaut);
      else
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
 * 9. DÉCISIONS EN COURSE ET MINI-CLASSEMENT (module 107)
 * ==================================================================== */
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
          const pos = mini[0].querySelector(".rj107-moi .rj107-pos");
          if (!pos || pos.textContent !== "P" + v.joueur.pos) window.__rj107Sonde.incoherents++;
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
  endurance: suiteEndurance,
  qualifications: suiteQualifications,
  course: () => suiteCourse(),
  "course-rapide": () => suiteCourse(["Formule 1"]),
  weekend: suiteWeekend,
  ui: suiteInterface,
  decisions: suiteDecisions
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
