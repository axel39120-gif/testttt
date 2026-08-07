#!/usr/bin/env node
/* =====================================================================
 * tests/couverture.js — QU'EST-CE QUI S'EXÉCUTE VRAIMENT ?
 *
 * Objectif : distinguer le code MORT du code RARE. Lire les fichiers ne
 * suffit pas — un module peut sembler actif et ne jamais s'installer, une
 * fonction peut sembler morte et servir une fois par saison.
 *
 * MÉTHODE
 *   1. On enregistre l'état du chargement : quels modules se sont
 *      installés, quelles fonctions globales ils ont enveloppées.
 *   2. On enveloppe TOUTES les fonctions globales avec un compteur.
 *   3. On joue un scénario long — plusieurs saisons, courses dans toutes
 *      les catégories, navigation dans tous les écrans, création de
 *      carrière — en comptant chaque appel.
 *   4. On croise avec l'inventaire des fichiers pour produire un rapport :
 *      fonctions jamais appelées, modules jamais installés, empilements
 *      d'enveloppes sur une même fonction.
 *
 * PRUDENCE — ce que ce rapport prouve et ne prouve pas :
 *   · « appelée N fois » est une certitude : le code sert ;
 *   · « jamais appelée » n'est PAS une preuve de code mort. Cela signifie
 *     seulement que le scénario ne l'a pas atteinte. Une fonction de fin
 *     de carrière, de retraite ou de mode bac à sable peut être vivante
 *     sans apparaître ici. Le rapport le signale explicitement.
 *
 *   node tests/couverture.js               scénario complet
 *   node tests/couverture.js --rapide      version courte
 *   node tests/couverture.js --json f.json rapport détaillé sur disque
 * =================================================================== */

const S = require("./socle");
const fs = require("fs");
const path = require("path");

const RACINE = S.RACINE;
const GRIS = "\u001b[90m", RAZ = "\u001b[0m", JAUNE = "\u001b[33m", VERT = "\u001b[32m";

/* ==================================================================== *
 * Inventaire statique des fichiers
 * ==================================================================== */

function inventaire() {
  const dossier = path.join(RACINE, "js");
  const html = fs.readFileSync(path.join(RACINE, "index.html"), "utf8");
  const charges = new Set();
  const re = /<script src="js\/([^"?]+)/g;
  let m;
  while ((m = re.exec(html))) charges.add(m[1]);

  return fs.readdirSync(dossier)
    .filter(f => f.endsWith(".js"))
    .map(f => {
      const contenu = fs.readFileSync(path.join(dossier, f), "utf8");
      const lignes = contenu.split("\n").length;
      /* déclarations de fonctions, tous styles confondus */
      const nommees = new Set();
      let x;
      const re1 = /function\s+([A-Za-z_$][\w$]*)\s*\(/g;
      while ((x = re1.exec(contenu))) nommees.add(x[1]);
      const re2 = /window\.([A-Za-z_$][\w$]*)\s*=\s*function/g;
      while ((x = re2.exec(contenu))) nommees.add(x[1]);
      /* Quelles fonctions globales ce fichier redéfinit-il ? C'est la
         mesure de l'empilement : dix fichiers qui réassignent la même
         fonction, ce sont dix couches qui se corrigent l'une l'autre. */
      const redefinies = new Set();
      const re3 = /window\.([A-Za-z_$][\w$]*)\s*=\s*function/g;
      while ((x = re3.exec(contenu))) redefinies.add(x[1]);

      return {
        fichier: f,
        charge: charges.has(f),
        octets: Buffer.byteLength(contenu),
        lignes,
        fonctions: [...nommees],
        redefinies: [...redefinies]
      };
    })
    .sort((a, b) => b.octets - a.octets);
}

/* ==================================================================== *
 * Instrumentation dans la page
 * ==================================================================== */

async function instrumenter(page) {
  return page.evaluate(() => {
    window.__cv = { appels: {}, ignorees: 0 };
    const aEviter = new Set([
      "fetch", "setTimeout", "setInterval", "clearTimeout", "clearInterval",
      "requestAnimationFrame", "cancelAnimationFrame", "alert", "confirm",
      "prompt", "open", "close", "print", "postMessage", "addEventListener",
      "removeEventListener", "getComputedStyle", "queueMicrotask", "matchMedia",
      "structuredClone", "reportError", "blur", "focus", "scroll", "scrollTo",
      "scrollBy", "btoa", "atob", "encodeURIComponent", "decodeURIComponent",
      "requestIdleCallback", "getSelection", "createImageBitmap"
    ]);

    for (const nom of Object.keys(window)) {
      if (aEviter.has(nom) || nom.startsWith("__cv")) continue;
      let f;
      try { f = window[nom]; } catch (e) { continue; }
      if (typeof f !== "function") continue;
      /* on laisse les constructeurs natifs tranquilles */
      if (/^[A-Z]/.test(nom) && f.prototype &&
          Object.getOwnPropertyNames(f.prototype).length > 1) { window.__cv.ignorees++; continue; }
      try {
        const original = f;
        const enveloppe = function () {
          window.__cv.appels[nom] = (window.__cv.appels[nom] || 0) + 1;
          return original.apply(this, arguments);
        };
        enveloppe.__cvEnvelopee = true;
        /* on recopie les marqueurs posés par les modules (_rj79, _rj84…) */
        for (const cle of Object.keys(original)) {
          try { enveloppe[cle] = original[cle]; } catch (e) {}
        }
        /* Affectation simple : les déclarations de fonction au niveau global
           créent des propriétés NON CONFIGURABLES, que defineProperty refuse
           de remplacer. L'affectation, elle, passe (writable). */
        window[nom] = enveloppe;
        if (window[nom] !== enveloppe) { window.__cv.ignorees++; }
      } catch (e) { window.__cv.ignorees++; }
    }
    let posees = 0;
    for (const nom of Object.keys(window)) {
      try { if (typeof window[nom] === "function" && window[nom].__cvEnvelopee) posees++; } catch (e) {}
    }
    return { instrumentees: posees, ignorees: window.__cv.ignorees };
  });
}

/* Noms de fonctions réellement présents sur window : seuls ceux-là peuvent
   être mesurés. Les modules écrits en IIFE gardent leurs fonctions privées,
   elles n'apparaîtront jamais ici — d'où la mesure d'activation ci-dessous. */
async function fonctionsExposees(page) {
  return page.evaluate(() => {
    const noms = [];
    for (const n of Object.keys(window)) {
      try { if (typeof window[n] === "function") noms.push(n); } catch (e) {}
    }
    return noms;
  });
}

/* Un module est considéré comme ACTIF s'il a laissé une trace : une globale
   d'API ou de désinstallation, une enveloppe marquée, ou son message
   d'activation en console — c'est la convention du projet. */
async function modulesActifs(page, journalConsole) {
  const globales = await page.evaluate(() => {
    const t = [];
    for (const n of Object.keys(window)) if (/^_rj/i.test(n)) t.push(n);
    return t;
  });
  const traces = new Set();
  globales.forEach(g => {
    const m = g.match(/^_rj(\d+)/i);
    if (m) traces.add(m[1]);
  });
  (journalConsole || []).forEach(l => {
    const m = String(l).match(/\[(\d{2}[a-z]?)[-\]]/);
    if (m) traces.add(m[1]);
  });
  return traces;
}

/* Relevé des enveloppes posées par les modules eux-mêmes. */
async function relevéEnveloppes(page) {
  return page.evaluate(() => {
    const marques = {};
    for (const nom of Object.keys(window)) {
      let f;
      try { f = window[nom]; } catch (e) { continue; }
      if (typeof f !== "function") continue;
      const posees = Object.keys(f).filter(k => /^_rj/i.test(k));
      if (posees.length) marques[nom] = posees;
    }
    return marques;
  });
}

/* ==================================================================== *
 * Scénario de jeu
 * ==================================================================== */

async function jouerScenario(page, rapide) {
  const etapes = [];
  const note = (quoi, detail) => { etapes.push(quoi + (detail ? " — " + detail : "")); };

  /* --- navigation dans tous les écrans --- */
  const ecrans = ["S-home", "S-pilot", "S-champ", "S-lifestyle", "S-contracts",
                  "S-media", "S-sponsors", "S-agent", "S-shop", "S-train", "S-messages"];
  await page.evaluate(async (liste) => {
    for (const id of liste) {
      try { navTo(id, null); await new Promise(r => setTimeout(r, 220)); } catch (e) {}
    }
    /* onglets internes */
    try { navTo("S-lifestyle", null); ["mesbiens", "acheter", "activites", "vieperso"].forEach(t => { try { lstab(t); } catch (e) {} }); } catch (e) {}
    try { navTo("S-sponsors", null); ["dispo", "actif", "events"].forEach(t => { try { sponsorTab(t); } catch (e) {} }); } catch (e) {}
  }, ecrans);
  note("navigation", ecrans.length + " écrans");

  /* --- semaines de carrière : événements, mails, finances, entraînement --- */
  await page.evaluate(async (n) => {
    for (let i = 0; i < n; i++) {
      try { if (typeof advanceWeek === "function") advanceWeek(); } catch (e) {}
      try { if (typeof runWeeklyTick === "function") runWeeklyTick(); } catch (e) {}
      await new Promise(r => setTimeout(r, 25));
    }
  }, rapide ? 12 : 40);
  note("semaines de carrière", (rapide ? 12 : 40) + " semaines");

  /* --- courses dans toutes les catégories --- */
  await S.repondeurAutomatique(page);
  const cats = rapide
    ? ["Formule 1", "Endurance WEC"]
    : ["Karting Junior", "Formule 4", "Formule 3", "Formule 2", "Formule 1", "Endurance WEC", "IndyCar"];
  for (const cat of cats) {
    const r = await S.courirUneCourse(page, { categorie: cat });
    note("course " + cat, r.terminee ? "terminée" : "non terminée");
  }

  /* --- qualifications, tous formats --- */
  await page.evaluate(async () => {
    for (const cat of ["Karting Junior", "Formule 3", "Formule 1", "IndyCar", "Endurance WEC"]) {
      try {
        G.cat = cat;
        QUALI_STATE.session = 1;
        QUALI_STATE.survived = Array.from({ length: 20 }, (_, i) => i);
        QUALI_STATE.drivers = Array.from({ length: 20 }, (_, i) => ({ name: "P" + i, isPlayer: i === 0 }));
        renderQualiSession();
        if (QUALI_STATE.session < 3) { QUALI_STATE.session = 2; renderQualiSession(); }
      } catch (e) {}
      await new Promise(r => setTimeout(r, 60));
    }
  });
  note("qualifications", "5 formats");

  /* --- fin de saison et saison suivante --- */
  await page.evaluate(async () => {
    try { if (typeof saveSeasonToHistory === "function") saveSeasonToHistory(); } catch (e) {}
    try { if (typeof showSeasonEnd === "function") showSeasonEnd(); } catch (e) {}
    await new Promise(r => setTimeout(r, 200));
    try { if (typeof startNextSeason === "function") startNextSeason(); } catch (e) {}
    await new Promise(r => setTimeout(r, 200));
  });
  note("passage de saison");

  /* --- contrats, sponsors, agent --- */
  await page.evaluate(async () => {
    try { if (typeof generateTeamOffers === "function") generateTeamOffers(); } catch (e) {}
    try { if (typeof renderOffers === "function") renderOffers(); } catch (e) {}
    try { if (typeof renderSponsorsNew === "function") { navTo("S-sponsors", null); renderSponsorsNew(); } } catch (e) {}
    try {
      const b = document.querySelector("[data-sign]");
      if (b) b.click();
    } catch (e) {}
    await new Promise(r => setTimeout(r, 200));
  });
  note("contrats et sponsors");

  /* --- pilote de réserve --- */
  await page.evaluate(async () => {
    try {
      if (window._rj79) {
        G._playerRole = "num3";
        window._rj79.setDeal({
          team: G.currentTeam, cat: G.cat, saison: G.saison, cumul: false,
          credibilite: 55, sessions: [], remplacements: []
        });
        window._rj79.tenter();
        window._rj79.balayer();
        window._rj79.offres();
        window._rj79.bilan();
        G._playerRole = "num2";
      }
    } catch (e) {}
    await new Promise(r => setTimeout(r, 150));
  });
  note("pilote de réserve");

  /* --- création d'une carrière (autre parcours complet) --- */
  await page.evaluate(async () => {
    try {
      goCreate();
      await new Promise(r => setTimeout(r, 400));
      const go = document.getElementById("rj80-go");
      if (go) go.click();
      await new Promise(r => setTimeout(r, 400));
      const poser = (id, v) => { const e = document.getElementById(id); if (e) { e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); } };
      poser("p-fn", "Couverture"); poser("p-ln", "Test"); poser("p-birthcity", "Lyon");
      if (typeof selContinent === "function") {
        selContinent("Europe");
        const n = document.querySelector("#nat-grid .nat-opt");
        if (n) n.click();
      }
      for (let i = 0; i < 8; i++) {
        if (window.creStep === 6) break;
        creNext();
        await new Promise(r => setTimeout(r, 120));
      }
    } catch (e) {}
  });
  note("création de carrière");

  return etapes;
}

/* ==================================================================== *
 * Rapport
 * ==================================================================== */

function produireRapport(fichiers, appels, enveloppes, etapes, instr, exposees, actifs) {
  const appelees = new Set(Object.keys(appels));

  /* Association fonction -> fichier qui la déclare */
  const declaree = {};
  fichiers.forEach(f => f.fonctions.forEach(fn => {
    if (!declaree[fn]) declaree[fn] = [];
    declaree[fn].push(f.fichier);
  }));

  const surWindow = new Set(exposees || []);

  const parFichier = fichiers.map(f => {
    /* On ne juge que ce qui est mesurable : les fonctions publiées sur
       window. Une fonction privée d'IIFE n'est pas observable ainsi. */
    const publiques = f.fonctions.filter(fn => surWindow.has(fn));
    const vues = publiques.filter(fn => appelees.has(fn)).length;
    const prefixe = (f.fichier.match(/^(\d{2}[a-z]?)/) || [])[1];
    return {
      ...f,
      total: publiques.length,
      privees: f.fonctions.length - publiques.length,
      vues,
      taux: publiques.length ? Math.round((vues / publiques.length) * 100) : null,
      jamais: publiques.filter(fn => !appelees.has(fn)),
      /* Un module est actif s'il a laissé une trace d'installation OU si
         l'une de ses fonctions publiques a été appelée. Les fichiers cœur
         ne suivent pas la convention de log : seul le second signal les
         concerne. */
      actif: (prefixe && actifs.has(prefixe)) || vues > 0
    };
  });

  /* Empilement mesuré sur les sources : qui redéfinit quoi. */
  const parFonction = {};
  fichiers.forEach(f => {
    if (!f.charge) return;
    (f.redefinies || []).forEach(fn => {
      (parFonction[fn] = parFonction[fn] || []).push(f.fichier);
    });
  });
  const empilements = Object.entries(parFonction)
    .map(([fn, liste]) => ({
      fonction: fn,
      couches: liste.length,
      fichiers: liste,
      appels: appels[fn] || 0
    }))
    .filter(e => e.couches >= 2)
    .sort((a, b) => b.couches - a.couches || b.appels - a.appels);

  return { parFichier, empilements, appels, etapes, instr };
}

function afficher(r) {
  console.log("\nSCÉNARIO JOUÉ");
  console.log("-".repeat(46));
  r.etapes.forEach(e => console.log("  · " + e));

  const appelees = Object.keys(r.appels).length;
  const totalAppels = Object.values(r.appels).reduce((a, b) => a + b, 0);
  console.log("\n  " + appelees + " fonctions globales appelées, " +
              totalAppels.toLocaleString("fr-FR") + " appels au total");

  console.log("\nFICHIERS NON CHARGÉS PAR index.html");
  console.log("-".repeat(46));
  const orphelins = r.parFichier.filter(f => !f.charge);
  if (!orphelins.length) console.log("  aucun");
  orphelins.forEach(f => console.log("  " + JAUNE + f.fichier + RAZ +
    GRIS + "  " + Math.round(f.octets / 1024) + " Ko, " + f.lignes + " lignes" + RAZ));

  console.log("\nMODULES QUI NE SE SONT PAS ACTIVÉS");
  console.log("-".repeat(46));
  const inertes = r.parFichier.filter(f => f.charge && f.actif === false);
  if (!inertes.length) console.log("  aucun");
  inertes.forEach(f => console.log("  " + JAUNE + f.fichier.padEnd(32) + RAZ +
    GRIS + Math.round(f.octets / 1024) + " Ko" + RAZ));

  console.log("\nFONCTIONS PUBLIQUES JAMAIS APPELÉES  (fichiers de plus de 8)");
  console.log("-".repeat(46));
  const muets = r.parFichier
    .filter(f => f.charge && f.total >= 8 && f.vues === 0)
    .sort((a, b) => b.total - a.total);
  if (!muets.length) console.log("  aucun");
  muets.forEach(f => console.log("  " + JAUNE + f.fichier.padEnd(30) + RAZ +
    GRIS + f.total + " publiques, " + Math.round(f.octets / 1024) + " Ko" + RAZ));

  console.log("\nCOUVERTURE PAR FICHIER  (les 20 plus gros)");
  console.log("-".repeat(46));
  r.parFichier.filter(f => f.charge && f.total > 0).slice(0, 20).forEach(f => {
    const barre = "█".repeat(Math.round((f.taux || 0) / 10)).padEnd(10, "·");
    const couleur = f.taux >= 50 ? VERT : (f.taux >= 20 ? "" : JAUNE);
    console.log("  " + couleur + barre + RAZ + " " + String(f.taux).padStart(3) + "%  " +
      f.fichier.padEnd(28) + GRIS + f.vues + "/" + f.total + " publiques" +
      (f.privees ? ", " + f.privees + " privées" : "") + RAZ);
  });

  console.log("\nEMPILEMENTS D'ENVELOPPES SUR UNE MÊME FONCTION");
  console.log("-".repeat(46));
  console.log(GRIS + "  Comptage sur les SOURCES : une couche neutralisée à" +
              " l'exécution\n  reste comptée ici tant que son code n'est pas retiré." + RAZ);
  if (!r.empilements.length) console.log("  aucun");
  r.empilements.slice(0, 18).forEach(e =>
    console.log("  " + String(e.couches).padStart(2) + " couches  " + e.fonction.padEnd(24) +
      GRIS + (e.appels ? String(e.appels).padStart(6) + " appels  " : "".padStart(15)) +
      e.fichiers.map(f => f.replace(/\.js$/, "")).join(" ") + RAZ));

  console.log("\n" + "=".repeat(46));
  console.log("Deux limites à garder en tête :");
  console.log("  · « jamais appelée » ne prouve pas que le code est mort — le");
  console.log("    scénario ne l'a simplement pas atteinte (retraite, bac à");
  console.log("    sable, arcs rares…) ;");
  console.log("  · les fonctions privées des modules en IIFE ne sont pas");
  console.log("    mesurables : pour eux, seul compte le statut d'activation.");
  console.log("=".repeat(46));
}

/* ==================================================================== *
 * Exécution
 * ==================================================================== */

async function principal() {
  const rapide = process.argv.includes("--rapide");
  const iJson = process.argv.indexOf("--json");
  const cheminJson = iJson >= 0 ? process.argv[iJson + 1] : null;

  const fichiers = inventaire();
  console.log("Racing Journey — mesure de couverture");
  console.log(fichiers.length + " fichiers, " +
    Math.round(fichiers.reduce((a, f) => a + f.octets, 0) / 1024) + " Ko, " +
    fichiers.reduce((a, f) => a + f.lignes, 0).toLocaleString("fr-FR") + " lignes");

  const serveur = await S.servir();
  let resultat;
  try {
    const { navigateur, page, journal } = await S.ouvrirJeu();
    const journalActivation = journal.messages || [];
    try {
      const enveloppes = await relevéEnveloppes(page);
      const exposees = await fonctionsExposees(page);
      const actifs = await modulesActifs(page, journalActivation);
      const instr = await instrumenter(page);
      const etapes = await jouerScenario(page, rapide);
      const appels = await page.evaluate(() => window.__cv.appels);
      resultat = produireRapport(fichiers, appels, enveloppes, etapes, instr, exposees, actifs);
    } finally { await navigateur.close(); }
  } finally { serveur.close(); }

  afficher(resultat);

  if (cheminJson) {
    fs.writeFileSync(cheminJson, JSON.stringify({
      genere: new Date().toISOString(),
      fichiers: resultat.parFichier.map(f => ({
        fichier: f.fichier, charge: f.charge, octets: f.octets, lignes: f.lignes,
        fonctions: f.total, appelees: f.vues, taux: f.taux, jamaisAppelees: f.jamais
      })),
      empilements: resultat.empilements,
      appels: resultat.appels
    }, null, 1));
    console.log("\nRapport détaillé écrit dans " + cheminJson);
  }
  return true;
}

principal().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
