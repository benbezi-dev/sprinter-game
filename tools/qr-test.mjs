// Le QR code, relu par un vrai decodeur.
//
// src/game/qr.ts encode sans dependance, ce qui est un choix defendable pour
// un jeu qui tient a se charger vite — mais un encodeur maison qu'on ne
// verifie qu'a l'oeil est un encodeur dont on ignore s'il marche. On relit
// donc ce qu'il produit avec jsQR, qui ne partage aucune ligne avec lui : si
// les deux tombent d'accord sur le texte, c'est que le carre est lisible par
// n'importe quel telephone.
//
//   node --experimental-strip-types tools/qr-test.mjs

import jsQR from 'jsqr';
import { qrModules, qrChemin, CAPACITE_MAX } from '../src/game/qr.ts';

let echecs = 0;
const ok = (nom, cond, detail) => {
  console.log(`   ${cond ? '✓' : '✗'} ${nom}${cond || !detail ? '' : ' — ' + detail}`);
  if (!cond) echecs++;
};

/** Le carre en pixels, avec sa marge — ce que verrait un appareil photo. */
function enPixels(modules, echelle = 4, marge = 4) {
  const n = modules.length;
  const cote = (n + marge * 2) * echelle;
  const data = new Uint8ClampedArray(cote * cote * 4).fill(255);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!modules[r][c]) continue;
      for (let dy = 0; dy < echelle; dy++) {
        for (let dx = 0; dx < echelle; dx++) {
          const y = (r + marge) * echelle + dy;
          const x = (c + marge) * echelle + dx;
          const i = (y * cote + x) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
      }
    }
  }
  return { data, cote };
}

const relire = (texte) => {
  const m = qrModules(texte);
  if (!m) return { erreur: 'refuse' };
  const { data, cote } = enPixels(m);
  const lu = jsQR(data, cote, cote);
  return { taille: m.length, lu: lu ? lu.data : null };
};

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  LE QR CODE, RELU                                            ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// Ce que le jeu y met vraiment : l'adresse de liaison, sur les deux canaux.
const CAS = [
  ['la liaison en production', 'https://sprinter-game.com/#lier=ABCD2345'],
  ['la liaison sur le canal de test', 'https://sprinter-game.com/test/#lier=9MBA2UZZ'],
  ['un jeton tout en chiffres', 'https://sprinter-game.com/#lier=23456789'],
  ['une adresse courte', 'https://a.co/#l=A'],
  ['un seul caractere', 'A'],
  ['des accents', 'Séb — récupération'],
  ['la capacite maximale', 'x'.repeat(CAPACITE_MAX)],
];

for (const [nom, texte] of CAS) {
  const r = relire(texte);
  ok(nom, r.lu === texte, r.erreur || `lu : ${JSON.stringify(r.lu)}`);
}

// Le passage d'une version a l'autre est l'endroit ou un encodeur se trompe :
// on balaie toutes les longueurs autour des seuils plutot qu'une par version.
console.log('\n── TOUTES LES LONGUEURS ─────────────────────────────────────');
let bancales = [];
for (let n = 1; n <= CAPACITE_MAX; n++) {
  const texte = 'S'.repeat(n);
  const r = relire(texte);
  if (r.lu !== texte) bancales.push(n);
}
ok(`les ${CAPACITE_MAX} longueurs se relisent`, bancales.length === 0,
   `bancales : ${bancales.join(', ')}`);

// Au-dela, le refus doit etre franc plutot qu'un carre illisible.
console.log('\n── LES BORNES ───────────────────────────────────────────────');
ok('au-dela de la capacite, on refuse', qrModules('x'.repeat(CAPACITE_MAX + 1)) === null);
ok('le vide ne fait pas planter', Array.isArray(qrModules('')));

// Le chemin SVG doit decrire le meme carre que la matrice.
console.log('\n── LE CHEMIN SVG ────────────────────────────────────────────');
const texte = 'https://sprinter-game.com/#lier=ABCD2345';
const modules = qrModules(texte);
const chemin = qrChemin(texte);
const noirs = modules.flat().filter(Boolean).length;
ok('le chemin porte autant de carres que de modules noirs',
   (chemin.d.match(/M/g) || []).length === noirs,
   `${(chemin.d.match(/M/g) || []).length} vs ${noirs}`);
ok('la taille inclut les deux marges', chemin.taille === modules.length + 8,
   `${chemin.taille} vs ${modules.length + 8}`);

console.log(`\n${echecs === 0 ? '✓ tout passe' : `✗ ${echecs} echec(s)`}\n`);
process.exit(echecs === 0 ? 0 : 1);
