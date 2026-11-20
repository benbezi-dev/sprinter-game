// LES STORIES DE LA MASCOTTE : un geste, une phrase, le lien — 1080x1920, 60 i/s, sans son.
//
//   node tools/story-mascotte.mjs --geste heros-defi --texte "DÉFIE-MOI" [--sous "..."]
//        [--fond rush.mp4] [--nom sortie] [--fin "sprinter-game.com"]
//   node tools/story-mascotte.mjs --serie      (le lot ci-dessous, d'un coup)
//
// Le fond est une image du jeu (un rush 2K), floutee et assombrie : la mascotte s'en detache
// sans qu'on perde le stade. La mascotte au centre, a sa taille ; le texte en haut, le lien en bas.
// La duree est celle du geste (clip transparent de tools/mascotte-tournage.mjs). Sortie dans
// assets-sources/mascotte/stories.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { texte, fondFlou } from './texte-video.mjs';

const args = process.argv.slice(2);
const arg = (nom, def) => { const k = args.indexOf('--' + nom); return k >= 0 ? args[k + 1] : def; };
const MASCOTTE = '/Volumes/MUSIQUE/BENBEZI/assets-sources/mascotte';
const VIDEOS = path.join(MASCOTTE, 'videos');
const SORTIE = path.join(MASCOTTE, 'stories');
const FOND = arg('fond', '/Volumes/MUSIQUE/BENBEZI/promo-defi-6s59/rushes/ligne60-2k.mp4');
const FIN = arg('fin', 'sprinter-game.com');

// LA SERIE : une story par humeur, pour le calendrier
const SERIE = [
  { geste: 'heros-defi', texte: 'DÉFIE-MOI', sous: 'si tu l’oses' },
  { geste: 'heros-frime', texte: 'QUI ME BAT SUR 100 M ?', sous: 'personne. pour l’instant.' },
  { geste: 'heros-furieux-trepigne', texte: 'IL A PERDU', sous: 'et il le prend très mal' },
  { geste: 'heros-larmes-pleure', texte: 'BATTU DE 0,01', sous: 'ça fait mal' },
  { geste: 'heros-choque-doubletake', texte: 'NOUVEAU RECORD ?!', sous: 'viens voir le classement' },
  { geste: 'rival-toise', texte: 'TON RIVAL T’ATTEND', sous: 'il ne sourit pas' },
  { geste: 'rival-sourire-nargue', texte: 'IL T’A BATTU', sous: 'tu vas le laisser rire ?' },
];

fs.mkdirSync(SORTIE, { recursive: true });
const tmp = fs.mkdtempSync(path.join(SORTIE, '.tmp-'));
// le fond : une image du rush, une fois pour toutes
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '2', '-i', FOND, '-frames:v', '1', path.join(tmp, 'image.png')]);
await fondFlou(path.join(tmp, 'image.png'), path.join(tmp, 'fond.png'));

async function story({ geste, texte: phrase, sous, nom }) {
  const clip = path.join(VIDEOS, geste + '-story.mov');
  if (!fs.existsSync(clip)) throw new Error('introuvable : ' + clip);
  const t = (n) => path.join(tmp, `${geste}-${n}.png`);
  const hHaut = await texte(t('haut'), phrase, 96, '#FFD84A');
  const hSous = await texte(t('sous'), sous || '', 52);
  await texte(t('fin'), FIN, 56);
  // LE TEXTE AU-DESSUS DE LA TETE, JAMAIS DESSUS : la mascotte (cadre du clip 1080x1920, a 80 %)
  // descend sous le bloc de texte ; le lien reste en bas, sous ses pieds.
  const ySous = 110 + hHaut - 30, yMascotte = Math.max(ySous + hSous - 120, 300);
  const sortie = path.join(SORTIE, (nom || geste) + '.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error',
    '-loop', '1', '-framerate', '60', '-i', path.join(tmp, 'fond.png'),   // 0
    '-c:v', 'prores', '-i', clip,                                          // 1
    '-i', t('haut'), '-i', t('sous'), '-i', t('fin'),                      // 2 3 4
    '-filter_complex',
    `[1:v]fps=60,scale=860:-1[m];[0:v][m]overlay=x=(W-w)/2:y=${yMascotte}:shortest=1[a];` +
    `[a][2:v]overlay=x=40:y=110[b];[b][3:v]overlay=x=40:y=${ySous}[c];[c][4:v]overlay=x=40:y=H-h-30,format=yuv420p[out]`,
    '-map', '[out]', '-r', '60', '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', sortie]);
  console.log(`${sortie} (${(fs.statSync(sortie).size / 1e6).toFixed(1)} Mo)`);
}

try {
  if (args.includes('--serie')) for (const s of SERIE) await story(s);
  else {
    const geste = arg('geste', null), phrase = arg('texte', null);
    if (!geste || !phrase) { console.error('usage : --geste heros-defi --texte "DÉFIE-MOI" [--sous ".."] | --serie'); process.exit(1); }
    await story({ geste, texte: phrase, sous: arg('sous', ''), nom: arg('nom', null) });
  }
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
