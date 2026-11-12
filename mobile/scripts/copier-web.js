// Copie le jeu web (« Racing Journey/ ») dans www/, le dossier que Capacitor embarque dans l'app.
// Tout est copié sauf ce qui ne sert qu'au développement ou à l'hébergement Cloudflare.
const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', '..', 'Racing Journey');
const cible = path.join(__dirname, '..', 'www');
const exclus = new Set(['tests', 'node_modules', 'RECAPITULATIF.md', 'diagnostic.html', '_headers',
  'logos-f1.png']); // logos-f1.png : image de travail non suivie par git, utilisée nulle part dans le jeu

if (!fs.existsSync(path.join(source, 'index.html'))) {
  console.error('Jeu web introuvable : ' + source);
  process.exit(1);
}
fs.rmSync(cible, { recursive: true, force: true });
fs.cpSync(source, cible, {
  recursive: true,
  filter: (src) => !exclus.has(path.basename(src)) && !src.endsWith('.md'),
});
console.log('Jeu web copié dans www/ (' + fs.readdirSync(path.join(cible, 'js')).length + ' dossiers js)');
