// LA PISTE GUIDE DU MORCEAU DE MEBA-MICKAEL ZEZE, pour le produire ailleurs.
//
//   node tools/musique/guide-defi-meba.mjs <dossier>
//
// Le morceau se fait dans FL Studio (docs/musique-defi-meba.md) ; ce script
// ne compose rien. Il ecrit ce que le producteur doit entendre en meme temps
// que sa musique pour la caler sur le jeu :
//
//   - un clic a 150 BPM (le tempo des ZEZE), accentue sur le premier temps ;
//   - les trois bips du decompte (0, 1 et 2 s) et le « go » du pistolet (3 s),
//     aux memes frequences que le moteur (blip, sprinter-app.js) ;
//   - deux reperes graves : la ligne du 100 m de Meba-Mickael (8,39 s apres le
//     pistolet) et celle du 200 m (17,30 s).
//
// Le fichier commence DEUX DIXIEMES avant le decompte : a 150 BPM, 3,0 s font
// sept temps et demi, et le pistolet ne tombe sur un premier temps que si
// l'on part d'une croche plus tot. Dans FL, le pistolet est donc la mesure 3,
// temps 1 ; a l'integration, on retire ces 0,2 s (voir la fiche).

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SR = 44100, BPM = 150, TEMPS = 60 / BPM;
const AVANCE = 0.2;                       // la croche avant le decompte
const INTRO = 3.0, BOUCLE = 16 * 4 * TEMPS;
const DUREE = AVANCE + INTRO + BOUCLE;    // 28,8 s
const N = Math.round(SR * DUREE);
const out = new Float32Array(N);

function blip(t0, f, dur, amp, glide = 1) {
  const i0 = Math.round((t0 + AVANCE) * SR), n = Math.round(dur * SR);
  let ph = 0;
  for (let i = 0; i < n && i0 + i < N; i++) {
    const q = i / n;
    ph += f * (1 + (glide - 1) * q) / SR;
    out[i0 + i] += amp * Math.exp(-6 * q) * Math.min(1, i / 90) * Math.sin(2 * Math.PI * ph);
  }
}
function clic(tAbs, fort) {
  const i0 = Math.round(tAbs * SR), n = Math.round(0.03 * SR);
  for (let i = 0; i < n && i0 + i < N; i++) {
    out[i0 + i] += (fort ? 0.5 : 0.28) * Math.exp(-i / (0.004 * SR)) * Math.sin(2 * Math.PI * (fort ? 1600 : 1100) * i / SR);
  }
}

// le clic, depuis le debut du fichier (temps 1 de la mesure 1)
for (let b = 0; b * TEMPS < DUREE; b++) clic(b * TEMPS, b % 4 === 0);
// le decompte et le pistolet, aux reglages du moteur
for (const t of [0, 1, 2]) blip(t, 660, 0.16, 0.30);
blip(3.0, 1050, 0.34, 0.34, 1.3);
// les deux lignes d'arrivee de Meba-Mickael
blip(3.0 + 8.39, 180, 0.5, 0.45, 0.8);
blip(3.0 + 17.30, 140, 0.6, 0.45, 0.8);

const dossier = process.argv[2] || '.';
mkdirSync(dossier, { recursive: true });
const pcm = Buffer.alloc(44 + N * 2);
pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + N * 2, 4); pcm.write('WAVE', 8);
pcm.write('fmt ', 12); pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(1, 22);
pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 2, 28); pcm.writeUInt16LE(2, 32); pcm.writeUInt16LE(16, 34);
pcm.write('data', 36); pcm.writeUInt32LE(N * 2, 40);
for (let i = 0; i < N; i++) pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(out[i] * 32767))), 44 + i * 2);
const f = join(dossier, 'guide-150bpm-decompte-pistolet.wav');
writeFileSync(f, pcm);
console.log(`ecrit ${f} (${DUREE.toFixed(1)} s)`);
