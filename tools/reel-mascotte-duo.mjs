// LE DUO : LE HEROS CONTRE LE RIVAL, en un reel de 14 s (1080x1920, 60 i/s, sans son).
//
//   node tools/reel-mascotte-duo.mjs [--accroche "..."] [--milieu "..."] [--chute "..."]
//        [--course rush.mp4] [--ligne rush.mp4] [--nom sortie] [--fin "sprinter-game.com"]
//
//   0 → 4 s    face a face sur fond sombre : le heros provoque (defi) a gauche, le rival le toise a droite
//   4 → 8 s    la course (rush 2K du jeu) : « UN SEUL GAGNE »
//   8 → 12 s   l'arrivee : le heros explose de rire, le rival enrage (colere froide)
//   12 → 14 s  la carte : les deux te montrent du doigt, « DEFIE-LES », le lien
// Le ton est celui du duel des marques : confrontation, frustration. Clips transparents de
// tools/mascotte-tournage.mjs (assets-sources/mascotte/videos), texte par tools/texte-video.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { texte } from './texte-video.mjs';

const args = process.argv.slice(2);
const arg = (nom, def) => { const k = args.indexOf('--' + nom); return k >= 0 ? args[k + 1] : def; };
const MASCOTTE = '/Volumes/MUSIQUE/BENBEZI/assets-sources/mascotte';
const VIDEOS = path.join(MASCOTTE, 'videos');
const SORTIE = path.join(MASCOTTE, 'reels');
const ACCROCHE = arg('accroche', 'LE FRIMEUR CONTRE LE GLACIAL');
const MILIEU = arg('milieu', 'UN SEUL GAGNE');
const CHUTE = arg('chute', 'ET TOI, TU PRENDS QUI ?');
const FIN = arg('fin', 'sprinter-game.com');
const COURSE = arg('course', '/Volumes/MUSIQUE/BENBEZI/promo-defi-6s59/rushes/course60-2k.mp4');
const LIGNE = arg('ligne', '/Volumes/MUSIQUE/BENBEZI/promo-defi-6s59/rushes/ligne60-2k.mp4');
const NOM = arg('nom', 'reel-duo');
const clip = (n) => path.join(VIDEOS, n + '-story.mov');
const CLIPS = ['heros-defi', 'rival-toise', 'heros-hilare-fourire', 'rival-fureur-colere', 'rival-defi'];
for (const f of [COURSE, LIGNE, ...CLIPS.map(clip)]) if (!fs.existsSync(f)) { console.error('introuvable : ' + f); process.exit(1); }
fs.mkdirSync(SORTIE, { recursive: true });

const tmp = fs.mkdtempSync(path.join(SORTIE, '.tmp-'));
const t = (n) => path.join(tmp, n + '.png');
await texte(t('a'), ACCROCHE, 84);
await texte(t('m'), MILIEU, 96, '#FFD84A');
await texte(t('c'), CHUTE, 84, '#FFD84A');
await texte(t('f1'), 'DÉFIE-LES', 120, '#FFD84A');
await texte(t('f2'), FIN, 64);

// les deux mascottes, chacune a 72 % de la largeur, l'une a gauche, l'autre a droite, pieds en bas
const paire = (fond, g, d, sortie) =>
  `[${g}]fps=60,scale=780:-1[${g}s];[${d}]fps=60,scale=780:-1[${d}s];` +
  `[${fond}][${g}s]overlay=x=-200:y=H-h+60[${sortie}g];[${sortie}g][${d}s]overlay=x=W-w+200:y=H-h+60[${sortie}]`;
const sortie = path.join(SORTIE, NOM + '.mp4');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error',
  '-t', '4', '-c:v', 'prores', '-i', clip('heros-defi'),            // 0
  '-t', '4', '-c:v', 'prores', '-i', clip('rival-toise'),           // 1
  '-ss', '0', '-t', '4', '-i', COURSE,                              // 2
  '-ss', '1', '-t', '4', '-i', LIGNE,                               // 3
  '-t', '4', '-c:v', 'prores', '-i', clip('heros-hilare-fourire'),  // 4
  '-t', '4', '-c:v', 'prores', '-i', clip('rival-fureur-colere'),   // 5
  '-ss', '1', '-t', '2', '-c:v', 'prores', '-i', clip('heros-defi'),// 6
  '-ss', '1', '-t', '2', '-c:v', 'prores', '-i', clip('rival-defi'),// 7
  '-i', t('a'), '-i', t('m'), '-i', t('c'), '-i', t('f1'), '-i', t('f2'), // 8 9 10 11 12
  '-filter_complex', [
    `color=c=0x0d1117:s=1080x1920:r=60:d=4[f0];${paire('f0', '0:v', '1:v', 'a0')};[a0][8:v]overlay=x=40:y=170[A]`,
    `[2:v]scale=1080:1920,fps=60,setsar=1[c2];[c2][9:v]overlay=x=40:y=170[B]`,
    `[3:v]scale=1080:1920,fps=60,setsar=1[c3];${paire('c3', '4:v', '5:v', 'a3')};[a3][10:v]overlay=x=40:y=170[C]`,
    `color=c=0x0d1117:s=1080x1920:r=60:d=2[f4];${paire('f4', '6:v', '7:v', 'a4')};[a4][11:v]overlay=x=40:y=150[a5];[a5][12:v]overlay=x=40:y=330[D]`,
    `[A][B][C][D]concat=n=4:v=1:a=0,format=yuv420p[out]`,
  ].join(';'),
  '-map', '[out]', '-r', '60', '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', sortie]);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${sortie} (${(fs.statSync(sortie).size / 1e6).toFixed(1)} Mo)`);
