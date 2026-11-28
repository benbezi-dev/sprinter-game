/* ===========================================================================
   Le montage : un rush de tourner.mjs devient un MP4 2K pret a poster.

     node tools/meeting-eure/monter.mjs --rush=<dossier> --format=vertical
     node tools/meeting-eure/monter.mjs --rush=<dossier> --format=paysage

   Sort communication/meeting-eure/video/sprinter-salle-jesse-owens-<format>.mp4
   (H.264, 30 i/s, MUET : la musique se pose dans Instagram ou TikTok, ou
   les sons tendance comptent pour la diffusion).

   QUATRE TEMPS, coupes seches :
     1. la salle (le panoramique d'ouverture du jeu), l'accroche posee dessus ;
     2. le decompte, 2 · 1 ;
     3. le 60 m entier, du pistolet a l'arrivee, plus deux secondes ;
     4. la carte de fin (cartes/teaser-story.png ou -feed), trois secondes.

   Les coupes se lisent dans journal.json, ecrit par tourner.mjs : on n'y
   devine aucun numero d'image.
   =========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { chromium } from './pw.mjs';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const RACINE = path.resolve(ICI, '../..');
const KIT = path.join(RACINE, 'communication/meeting-eure');
const POLICES = pathToFileURL(path.join(RACINE, 'public/fonts')).href;
const A = Object.fromEntries(process.argv.slice(2).map(s => s.replace(/^--/, '').split('=')));
const RUSH = path.resolve(A.rush || '');
const FORMAT = A.format || 'vertical';
const IPS = 30;
const [L, H] = FORMAT === 'paysage' ? [2560, 1440] : [1440, 2560];
if (!fs.existsSync(path.join(RUSH, 'journal.json'))) { console.error('--rush=<dossier de tourner.mjs> (avec journal.json)'); process.exit(1); }

const journal = JSON.parse(fs.readFileSync(path.join(RUSH, 'journal.json'), 'utf8'));
const img = e => journal.find(j => j.etat === e)?.image;
const iRace = img('race'), iFin = img('arrivee');
const nImages = fs.readdirSync(RUSH).filter(f => /^f\d+\.jpg$/.test(f)).length;
if (iRace == null || iFin == null) { console.error('le journal ne porte ni depart ni arrivee'); process.exit(1); }

// les plans, en numeros d'image du rush
const debutSalle = +(A.salle || 1) * IPS;
const PLANS = [
  { de: debutSalle, a: debutSalle + Math.round(+(A.dureeSalle || 4.5) * IPS), calque: 'accroche' },
  { de: iRace - Math.round(2.3 * IPS), a: iRace, calque: null },   // le decompte du jeu suffit
  { de: iRace, a: Math.min(nImages, iFin + Math.round(2.2 * IPS)), calque: 'coin' },
];

// ------------------------------------------------------------ les calques
const paysage = FORMAT === 'paysage';
const k = (paysage ? H : L) / 1080;
const style = `
  @font-face{font-family:Outfit;font-weight:900;src:url(${POLICES}/Outfit-900-latin.woff2)}
  @font-face{font-family:Jakarta;font-weight:600;src:url(${POLICES}/PlusJakartaSans-600-latin.woff2)}
  *{margin:0;padding:0;box-sizing:border-box} html,body{width:${L}px;height:${H}px;background:transparent;overflow:hidden}
  .bloc{position:absolute;left:${paysage ? 110 * k : 70 * k}px;top:${paysage ? 120 * k : 250 * k}px;right:${70 * k}px}
  .k{font:600 ${26 * k}px/1.2 Jakarta;letter-spacing:.22em;text-transform:uppercase;color:#fff;display:inline-block;background:rgba(8,13,28,.72);padding:${12 * k}px ${18 * k}px;border-radius:${10 * k}px}
  h1{margin-top:${18 * k}px;font:900 ${(paysage ? 80 : 104) * k}px/0.98 Outfit;color:#fff;text-transform:uppercase;text-shadow:0 ${4 * k}px ${26 * k}px rgba(0,0,0,.7),0 0 ${4 * k}px rgba(0,0,0,.5)}
  h1 em{font-style:normal;color:#FFD23F}
  .coin{position:absolute;${paysage ? `right:${36 * k}px;top:${150 * k}px` : `left:50%;transform:translateX(-50%);bottom:${420 * k}px;white-space:nowrap`};font:900 ${30 * k}px/1 Outfit;color:#0b1222;background:#FFD23F;padding:${14 * k}px ${20 * k}px;border-radius:${12 * k}px;letter-spacing:.03em}`;
const CALQUES = {
  accroche: `<div class="bloc"><div class="k">Val-de-Reuil · 30.01.2027</div><h1>Cette année,<br>le public<br><em>prend${paysage ? '<br>' : ' '}le départ.</em></h1></div>`,
  coin: `<div class="coin">SALLE JESSE OWENS · 60 M</div>`,
};
const TMP = path.join(RUSH, '.montage');
fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: L, height: H } });
for (const [nom, corps] of Object.entries(CALQUES)) {
  const f = path.join(TMP, nom + '.html');
  fs.writeFileSync(f, `<!doctype html><html><head><meta charset="utf-8"><style>${style}</style></head><body>${corps}</body></html>`);
  await page.goto(pathToFileURL(f).href); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(TMP, nom + '.png'), omitBackground: true });
}
await b.close();

// ------------------------------------------------------- la sequence a plat
const SEQ = path.join(TMP, 'seq'); fs.mkdirSync(SEQ);
let n = 0; const bornes = [];
for (const pl of PLANS) {
  const d = n;
  for (let i = pl.de; i < pl.a; i++) {
    const src = path.join(RUSH, `f${String(i).padStart(5, '0')}.jpg`);
    if (!fs.existsSync(src)) continue;
    fs.symlinkSync(src, path.join(SEQ, `${String(n++).padStart(5, '0')}.jpg`));
  }
  bornes.push({ calque: pl.calque, t0: d / IPS, t1: n / IPS });
}
const duree = n / IPS;
const carte = path.join(KIT, 'cartes', paysage ? 'teaser-feed.png' : 'teaser-story.png');
const FIN = 3;

// ----------------------------------------------------------------- ffmpeg
const entrees = ['-framerate', String(IPS), '-i', path.join(SEQ, '%05d.jpg')];
let graphe = `[0:v]scale=${L}:${H}:force_original_aspect_ratio=increase,crop=${L}:${H},setsar=1,format=yuv420p[v0]`;
let cur = 'v0';
bornes.filter(bo => bo.calque).forEach((bo, j) => {
  entrees.push('-loop', '1', '-framerate', String(IPS), '-t', String(duree), '-i', path.join(TMP, bo.calque + '.png'));
  const fondu = `fade=t=in:st=${bo.t0}:d=0.25:alpha=1`;
  graphe += `;[${j + 1}:v]format=rgba,${fondu}[c${j}];[${cur}][c${j}]overlay=0:0:enable='between(t,${bo.t0},${bo.t1 - 0.001})'[v${j + 1}]`;
  cur = `v${j + 1}`;
});
const iCarte = bornes.filter(bo => bo.calque).length + 1;
entrees.push('-loop', '1', '-framerate', String(IPS), '-t', String(FIN), '-i', carte);
// la carte de fin : fond bleu nuit, carte centree (la feed 4:5 dans le paysage)
graphe += `;[${iCarte}:v]scale=${paysage ? `-2:${H}` : `${L}:${H}`},pad=${L}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x080d1c,setsar=1,format=yuv420p,fade=t=in:st=0:d=0.3[fin]`;
graphe += `;[${cur}]format=yuv420p[film];[film][fin]concat=n=2:v=1:a=0[out]`;
const SORTIE = path.join(KIT, 'video'); fs.mkdirSync(SORTIE, { recursive: true });
const mp4 = path.join(SORTIE, `sprinter-salle-jesse-owens-${FORMAT}.mp4`);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...entrees, '-filter_complex', graphe, '-map', '[out]',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', String(IPS),
  '-movflags', '+faststart', mp4], { stdio: 'inherit' });
fs.rmSync(TMP, { recursive: true, force: true });
console.log(`  ✓ ${path.relative(RACINE, mp4)}  (${(duree + FIN).toFixed(1)} s, ${L}x${H})`);
