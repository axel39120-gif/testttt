/* =====================================================================
 * equilibrage-baquets.js — CHANCES DE DÉCROCHER UN BAQUET, PAR PROFIL
 *
 *   NODE_PATH=… RJ_CHANNEL=chrome node tests/outils/equilibrage-baquets.js [essais]
 *
 * Pour chaque catégorie visée, simule de nombreuses intersaisons (places
 * libres et soutien des rivaux retirés à chaque fois) et mesure la part des
 * intersaisons où le joueur obtient au moins un baquet : premier choix d'une
 * écurie qui a une place, ou deuxième une fois sur trois. C'est la couche
 * « concurrence » de 116 ; la génération des offres du jeu (réputation,
 * classement) s'ajoute par-dessus.
 * =================================================================== */
const path = require("path");
const S = require(path.resolve(__dirname, "..", "socle.js"));
const ESSAIS = +process.argv[2] || 300;

const PROFILS = [
  { nom: "champion, petit budget", note: 92, pos: 1, argent: 0.1 },
  { nom: "3e, bonne note, petit budget", note: 85, pos: 3, argent: 0.1 },
  { nom: "6e, note moyenne, petit budget", note: 78, pos: 6, argent: 0.1 },
  { nom: "6e, note moyenne, soutien moyen", note: 78, pos: 6, argent: 1 },
  { nom: "6e, note moyenne, gros soutien", note: 78, pos: 6, argent: 3 }
];
const CIBLES = [["Formule 2", "Formule 1"], ["Formule 3", "Formule 2"], ["Formula Regional", "Formule 3"]];

(async () => {
  const srv = await S.servir();
  const { navigateur, page } = await S.ouvrirJeu();
  try {
    const res = await page.evaluate(({ PROFILS, CIBLES, ESSAIS }) => {
      const B = RJBaquets, calc = window.calcPlayerRating, sauve = { cat: G.cat, pos: G.champPos, budget: G.budget, sponsors: G.sponsors, b: G._baquets };
      const MEDIANE = { "Formule 1": 4e6, "Formule 2": 1.8e6, "Formule 3": 9e5 };
      const sortie = [];
      try {
        CIBLES.forEach(([depuis, vers]) => {
          PROFILS.forEach(p => {
            let gagnes = 0, premiers = 0, payables = 0;
            window.calcPlayerRating = () => p.note;
            G.cat = depuis; G.champPos = p.pos; G.sponsors = []; G.budget = p.argent * (MEDIANE[vers] || 1e6);
            for (let k = 0; k < ESSAIS; k++) {
              G._baquets = null;
              Object.values(G.driverPool).forEach(d => { delete d._soutien; });
              const plan = B.places(vers);
              let obtenu = false, payable = false;
              Object.keys(plan).filter(t => plan[t] > 0).forEach(t => {
                const o = (TEAM_OFFERS[vers] || []).find(x => x.team === t) || {};
                const garde = B.filtrer([Object.assign({}, o, { cat: vers })]);
                if (garde.length) { obtenu = true; premiers++;
                  // Payable : le tiers à la signature, avec le budget et les sponsors du profil.
                  if ((garde[0].cost || 0) / 3 <= B.apportJoueur()) payable = true; }
              });
              if (obtenu) gagnes++;
              if (payable) payables++;
            }
            sortie.push({ vers, profil: p.nom, chance: Math.round(100 * gagnes / ESSAIS), payable: Math.round(100 * payables / ESSAIS), premiersParSaison: +(premiers / ESSAIS).toFixed(2) });
          });
        });
      } finally {
        window.calcPlayerRating = calc;
        Object.assign(G, { cat: sauve.cat, champPos: sauve.pos, budget: sauve.budget, sponsors: sauve.sponsors, _baquets: sauve.b });
      }
      return sortie;
    }, { PROFILS, CIBLES, ESSAIS });
    let vers = "";
    res.forEach(r => {
      if (r.vers !== vers) { vers = r.vers; console.log("\n→ " + vers); }
      console.log("  " + r.profil.padEnd(32) + String(r.chance).padStart(4) + " % d'offre, " + String(r.payable).padStart(3) + " % payable   (" + r.premiersParSaison + " offre/saison)");
    });
  } finally { await navigateur.close(); srv.close && srv.close(); }
})();
