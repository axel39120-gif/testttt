/* =====================================================================
 * bareme-ecuries.js — RÉÉCRIT LES MONTANTS DES ÉCURIES D'APRÈS LE BARÈME
 *
 *   node tests/outils/bareme-ecuries.js            (écrit js/data/03-data-agent.js)
 *   node tests/outils/bareme-ecuries.js --voir     (affiche sans écrire)
 *
 * Le barème vit dans js/core/115-economie.js (BAREME). Pour chaque
 * catégorie de TEAM_OFFERS, les écuries sont classées par réputation
 * exigée : la plus huppée prend le haut de la fourchette.
 *   - catégories à baquet payant : cost = prix de la saison, salaire nul ;
 *   - catégories salariées (F1, Super Formula) : salary = salaire mensuel ;
 *   - WEC et IndyCar : moitié haute salariée (usines), moitié basse payante.
 * Primes : 1 % / 0,4 % du baquet en formules de promotion, 3 % / 1,2 % du
 * salaire annuel ailleurs. Rejouable : le résultat ne dépend que du barème.
 * =================================================================== */
const fs = require("fs"), path = require("path");
const racine = path.resolve(__dirname, "..", "..");
const fichierEco = path.join(racine, "js/core/115-economie.js");
const fichierData = path.join(racine, "js/data/03-data-agent.js");

const eco = fs.readFileSync(fichierEco, "utf8");
const BAREME = Function("return " + eco.match(/var BAREME = (\{[\s\S]*?\n  \});/)[1])();

const arrondi = (v, pas) => Math.round(v / pas) * pas;
const entre = (f, a, b) => a + (b - a) * f;

let src = fs.readFileSync(fichierData, "utf8");
const debut = src.indexOf("TEAM_OFFERS = {");
if (debut < 0) throw new Error("TEAM_OFFERS introuvable");
const RE = /team: "([^"]+)",(\s*)cost: [0-9e.]+,(\s*)salary: [0-9e.]+,(\s*)bonusWin: [0-9e.]+,(\s*)bonusPodium: [0-9e.]+,([\s\S]*?)repReq: (\d+)/g;

let compte = 0, rapport = [];
Object.keys(BAREME).forEach(cat => {
  const b = BAREME[cat];
  const i = src.indexOf(`"${cat}": [`, debut), j0 = src.indexOf(`${cat.includes(" ") ? '"' + cat + '"' : cat}: [`, debut);
  const ici = i >= 0 ? i : j0;
  if (ici < 0) { rapport.push(cat + " : absente"); return; }
  const fin = src.indexOf("}]", ici) + 2;
  let bloc = src.slice(ici, fin);
  const ecuries = [...bloc.matchAll(RE)].map(m => ({ team: m[1], rep: +m[7] }));
  const ordre = ecuries.slice().sort((a, c) => c.rep - a.rep).map(e => e.team);
  const n = ordre.length;
  bloc = bloc.replace(RE, (tout, team, s1, s2, s3, s4, reste, rep) => {
    const p = n > 1 ? 1 - ordre.indexOf(team) / (n - 1) : 1;      // 1 = la plus huppée
    let cost = 0, salaire = 0;
    if (b.baquet) cost = arrondi(entre(p, b.baquet[0], b.baquet[1]), 10e3);
    else if (b.baquetBas && p < 0.5) cost = arrondi(entre(p / 0.5, b.baquetBas[0], b.baquetBas[1]), 10e3);
    else if (b.salaire) salaire = arrondi(entre(b.baquetBas ? (p - 0.5) / 0.5 : p, b.salaire[0], b.salaire[1]), 10e3);
    const mensuel = arrondi(salaire / 12, 1e3);
    const win = cost ? arrondi(cost * 0.01, 100) : arrondi(salaire * 0.03, 1e3);
    const podium = cost ? arrondi(cost * 0.004, 100) : arrondi(salaire * 0.012, 1e3);
    rapport.push(`${cat.padEnd(17)} ${team.padEnd(26)} baquet ${String(cost).padStart(8)}  salaire/an ${String(salaire).padStart(9)}`);
    compte++;
    return `team: "${team}",${s1}cost: ${cost},${s2}salary: ${mensuel},${s3}bonusWin: ${win},${s4}bonusPodium: ${podium},${reste}repReq: ${rep}`;
  });
  src = src.slice(0, ici) + bloc + src.slice(fin);
});

console.log(rapport.join("\n"));
console.log(compte + " écuries recalées");
if (!process.argv.includes("--voir")) fs.writeFileSync(fichierData, src);
