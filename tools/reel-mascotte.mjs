// UN REEL « REACTION » : du vrai jeu, la mascotte par-dessus qui le vit, une accroche, une chute.
//
//   node tools/reel-mascotte.mjs [--variante perdu|gagne|rival] [--accroche "..."] [--chute "..."]
//        [--course rush.mp4] [--ligne rush.mp4] [--nom sortie] [--fin "sprinter-game.com"]
//
// Trois temps, 13 s, 1080x1920, 60 i/s :
//   0 → 5 s    la course (rush --course) ; la mascotte, en bas a droite, provoque ; l'accroche en haut
//   5 → 11 s   l'arrivee (rush --ligne) ; la mascotte reagit ; la chute en haut
//   11 → 13 s  la carte : la mascotte qui te montre du doigt, « Defie-le », le lien
// Variantes : `perdu` (le heros enrage : il ne supporte pas de perdre), `gagne` (il frime et rit),
// `rival` (le rival te toise, puis te nargue).
// La mascotte vient des clips transparents de tools/mascotte-tournage.mjs (.mov ProRes 4444), dans
// assets-sources/mascotte/videos ; les rushes, des tournages 2K du jeu. Le texte est dessine par
// sharp (ffmpeg de ce Mac n'a pas drawtext). Pas de son : la musique se pose dans l'appli.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const arg = (nom, def) => { const k = args.indexOf('--' + nom); return k >= 0 ? args[k + 1] : def; };
const MASCOTTE = '/Volumes/MUSIQUE/BENBEZI/assets-sources/mascotte';
const VIDEOS = path.join(MASCOTTE, 'videos');
const SORTIE = path.join(MASCOTTE, 'reels');
const VARIANTES = {
  perdu: { avant: 'heros-defi', apres: 'heros-furieux-trepigne',
           accroche: 'IL A DIT QU’IL ALLAIT GAGNER', chute: 'IL NE SUPPORTE PAS DE PERDRE' },
  gagne: { avant: 'heros-frime', apres: 'heros-hilare-fourire',
           accroche: 'PERSONNE NE LE BAT SUR 100 M', chute: 'ET IL TE LE FAIT SAVOIR' },
  rival: { avant: 'rival-toise', apres: 'rival-sourire-nargue',
           accroche: 'LUI, C’EST TON RIVAL', chute: 'TU VAS LE LAISSER RIRE ?' },
};
const V = VARIANTES[arg('variante', 'perdu')];
if (!V) { console.error('variante : perdu, gagne ou rival'); process.exit(1); }
const ACCROCHE = arg('accroche', V.accroche), CHUTE = arg('chute', V.chute), FIN = arg('fin', 'sprinter-game.com');
const COURSE = arg('course', '/Volumes/MUSIQUE/BENBEZI/promo-defi-6s59/rushes/course60-2k.mp4');
const LIGNE = arg('ligne', '/Volumes/MUSIQUE/BENBEZI/promo-defi-6s59/rushes/ligne60-2k.mp4');
const NOM = arg('nom', `reel-${arg('variante', 'perdu')}`);
for (const f of [COURSE, LIGNE, ...[V.avant, V.apres, 'heros-defi'].map((n) => path.join(VIDEOS, n + '-story.mov'))])
  if (!fs.existsSync(f)) { console.error('introuvable : ' + f); process.exit(1); }
fs.mkdirSync(SORTIE, { recursive: true });

// le texte : blanc, gras, contour noir, centre, sur deux lignes au plus
const req = createRequire(path.join(path.dirname(new URL(import.meta.url).pathname), '../package.json'));
const sharp = req('sharp');
const tmp = fs.mkdtempSync(path.join(SORTIE, '.tmp-'));
const echapper = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
async function texte(fichier, txt, taille, couleur = '#FFFFFF') {
  const mots = txt.split(' '), lignes = [''];
  for (const m of mots) { const l = lignes[lignes.length - 1]; if ((l + ' ' + m).trim().length > 18 && l) lignes.push(m); else lignes[lignes.length - 1] = (l + ' ' + m).trim(); }
  const h = lignes.length * taille * 1.15 + 40;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="${h}">${lignes.map((l, i) =>
    `<text x="500" y="${taille * (1 + i * 1.15)}" font-family="Arial Black, Arial" font-weight="900" font-size="${taille}" fill="${couleur}" stroke="#000" stroke-width="${taille / 9}" paint-order="stroke" text-anchor="middle">${echapper(l)}</text>`).join('')}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(fichier);
}
await texte(path.join(tmp, 'accroche.png'), ACCROCHE, 84);
await texte(path.join(tmp, 'chute.png'), CHUTE, 84, '#FFD84A');
await texte(path.join(tmp, 'fin1.png'), 'DÉFIE-LE', 120, '#FFD84A');
await texte(path.join(tmp, 'fin2.png'), FIN, 64);

const f = (n) => path.join(VIDEOS, n + '-story.mov');
const sortie = path.join(SORTIE, NOM + '.mp4');
// la mascotte en bas a droite, a 62 % : ses pieds au bord bas, sa tete sous la ligne de flottaison
const coin = (fond, m) => `scale=670:-1[${m}];[${fond}][${m}]overlay=x=W-w+40:y=H-h+60`;
execFileSync('ffmpeg', ['-y', '-loglevel', 'error',
  '-ss', '0', '-t', '5', '-i', COURSE,
  '-ss', '0', '-t', '6', '-i', LIGNE,
  '-t', '5', '-c:v', 'prores', '-i', f(V.avant),
  '-t', '6', '-c:v', 'prores', '-i', f(V.apres),
  '-t', '2', '-c:v', 'prores', '-i', f('heros-defi'),
  '-i', path.join(tmp, 'accroche.png'), '-i', path.join(tmp, 'chute.png'),
  '-i', path.join(tmp, 'fin1.png'), '-i', path.join(tmp, 'fin2.png'),
  '-filter_complex', [
    `[0:v]scale=1080:1920,fps=60,setsar=1[c0];[2:v]fps=60,${coin('c0', 'm1')}[a1];[a1][5:v]overlay=x=40:y=170[A]`,
    `[1:v]scale=1080:1920,fps=60,setsar=1[c1];[3:v]fps=60,${coin('c1', 'm2')}[a2];[a2][6:v]overlay=x=40:y=170[B]`,
    `color=c=0x0d1117:s=1080x1920:r=60:d=2[fond];[4:v]fps=60,scale=1080:-1[m3];[fond][m3]overlay=x=0:y=H-h+80[c2];[c2][7:v]overlay=x=40:y=150[c3];[c3][8:v]overlay=x=40:y=330[C]`,
    `[A][B][C]concat=n=3:v=1:a=0,format=yuv420p[out]`,
  ].join(';'),
  '-map', '[out]', '-r', '60', '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', sortie]);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${sortie} (${(fs.statSync(sortie).size / 1e6).toFixed(1)} Mo)`);
