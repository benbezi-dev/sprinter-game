/* ===========================================================================
   Le film vertical : gameplay + accroches + carte finale.

   Les cartes fixes tiennent sur X et passent sur Instagram. Sur TikTok elles
   ne font rien : ce qui s'y regarde bouge des la premiere image. On a 72
   photogrammes d'un 100 m au Stade du Danube qui dormaient faute d'encodeur —
   ce module les monte.

     node tools/video-riposte.mjs
     node tools/video-riposte.mjs --carte budapest-200m-h-story --nom riposte-200

   Sort communication/riposte-danube/video-1080x1920/<nom>.mp4

   LA FORME. Douze secondes, trois temps :
     0 → 3,5 s   le gameplay, une accroche posee dessus
     3,5 → 8 s   le gameplay continue, le chiffre tombe
     8 → 12 s    la carte, plein ecran, avec le lien

   L'accroche n'attend pas : sur TikTok la premiere seconde decide de tout, et
   une video qui commence par un logo est une video que personne ne finit.
   =========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const RACINE = path.resolve(ICI, '..');
const DOSSIER = path.join(RACINE, 'communication/riposte-danube');
const IMAGES = path.join(DOSSIER, 'video-1080x1920');
const CARTES = path.join(DOSSIER, 'cartes');

function lireArgs(argv) {
  const a = {
    carte: 'budapest-200m-h-story',
    nom: 'riposte',
    hook: 'Ils ont mis 10 millions de dollars\npour battre un record.',
    coup: 'Personne n’y est arrivé.',
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--carte') a.carte = String(argv[++i] || a.carte).replace(/\.png$/, '');
    else if (argv[i] === '--nom') a.nom = String(argv[++i] || a.nom);
    else if (argv[i] === '--hook') a.hook = String(argv[++i] || a.hook);
    else if (argv[i] === '--coup') a.coup = String(argv[++i] || a.coup);
  }
  return a;
}
const args = lireArgs(process.argv.slice(2));

/* ---------------------------------------------------------------------------
   OU EST L'ENCODEUR.

   Nulle part dans le PATH : cette machine n'a ni Homebrew ni ffmpeg installe.
   Mais le chantier des films promo tire `ffmpeg-static`, un paquet npm qui
   embarque le binaire — il dormait dans node_modules depuis le 6 septembre.

   On le prend LA, et on garde celui du PATH en second choix : le jour ou la
   machine en aura un vrai, il fera aussi bien, et le jour ou node_modules sera
   efface, l'autre prendra le relais. Aucun des deux n'est indispensable seul.
--------------------------------------------------------------------------- */
function trouverFfmpeg() {
  const embarque = path.join(RACINE,
    'assets-stores/promo/node_modules/ffmpeg-static/ffmpeg');
  for (const bin of [embarque, 'ffmpeg']) {
    try { execFileSync(bin, ['-version'], { stdio: 'ignore' }); return bin; }
    catch { /* au suivant */ }
  }
  return null;
}

const FFMPEG = trouverFfmpeg();
if (!FFMPEG) {
  console.error(`
Aucun encodeur trouve.

Le binaire attendu est :
  assets-stores/promo/node_modules/ffmpeg-static/ffmpeg

S'il a disparu, il se reinstalle depuis le chantier promo :
  cd assets-stores/promo && npm install
`);
  process.exit(1);
}

const premiere = path.join(IMAGES, 'f000.jpg');
if (!fs.existsSync(premiere)) {
  console.error(`Sequence introuvable : ${path.relative(RACINE, premiere)}`);
  process.exit(1);
}
const carte = path.join(CARTES, `${args.carte}.png`);
if (!fs.existsSync(carte)) {
  console.error(`Carte introuvable : ${path.relative(RACINE, carte)}
Genere-la d'abord, par exemple :
    node tools/carte-riposte.mjs --epreuve 200 --nom budapest-200m-h`);
  process.exit(1);
}

/* ---------------------------------------------------------------------------
   Les panneaux de texte.

   Ils sont dessines par le meme navigateur que les cartes, en PNG transparent,
   plutot qu'incrustes par ffmpeg : drawtext ne sait ni couper une ligne, ni
   poser une ombre lisible, ni utiliser la meme graisse que le reste du pack.
   Une image transparente superposee n'a aucun de ces defauts.
--------------------------------------------------------------------------- */
const requirePromo = createRequire(path.join(RACINE, 'assets-stores/promo/package.json'));
const puppeteer = requirePromo('puppeteer-core');
const CHROME = process.env.HOME +
  '/.cache/puppeteer/chrome-headless-shell/mac_arm-152.0.7977.54/chrome-headless-shell-mac-arm64/chrome-headless-shell';

const TMP = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'sprinter-video-'));

const echappe = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function panneau(texte, { taille = 74, couleur = '#ffffff' } = {}) {
  return `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1080px;height:1920px;background:transparent;overflow:hidden}
  body{display:flex;align-items:center;justify-content:center;padding:0 92px;
       font:700 ${taille}px/1.22 "Helvetica Neue",Helvetica,Arial,sans-serif;
       color:${couleur};text-align:center;letter-spacing:-.015em;
       /* Le gameplay derriere est clair par endroits : sans ombre portee, une
          ligne sur deux devient illisible selon l'image. */
       text-shadow:0 6px 34px rgba(0,0,0,.92),0 2px 10px rgba(0,0,0,.85)}
  </style><div>${echappe(texte).replace(/\n/g, '<br>')}</div>`;
}

const navigateur = await puppeteer.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb',
         '--font-render-hinting=none', '--disable-lcd-text'],
});
const panneaux = [
  { fichier: path.join(TMP, 'p1.png'), html: panneau(args.hook), de: 0.4, a: 3.4 },
  { fichier: path.join(TMP, 'p2.png'), html: panneau(args.coup, { taille: 92, couleur: '#f7a93f' }), de: 4.0, a: 7.6 },
];
for (const p of panneaux) {
  const onglet = await navigateur.newPage();
  await onglet.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  await onglet.setContent(p.html, { waitUntil: 'load' });
  await onglet.screenshot({ path: p.fichier, type: 'png', omitBackground: true });
  await onglet.close();
}
await navigateur.close();

/* ------------------------------------------------------------------ l'encodage */
const sortie = path.join(IMAGES, `${args.nom}.mp4`);
const ff = (...a) => execFileSync(FFMPEG, ['-y', '-loglevel', 'error', ...a], { stdio: 'inherit' });

// 1. La sequence devient un plan de 4 s, boucle jusqu'a 8 s : 72 images a
//    18 i/s ne font que quatre secondes, trop court pour poser deux accroches.
const base = path.join(TMP, 'base.mp4');
ff('-framerate', '18', '-i', path.join(IMAGES, 'f%03d.jpg'),
   '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30',
   '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', base);

const boucle = path.join(TMP, 'boucle.mp4');
ff('-stream_loop', '1', '-i', base, '-t', '8', '-c', 'copy', boucle);

// 2. Les accroches se posent dessus, chacune sur sa fenetre de temps.
const avecTexte = path.join(TMP, 'texte.mp4');
ff('-i', boucle, '-i', panneaux[0].fichier, '-i', panneaux[1].fichier,
   '-filter_complex',
   `[0][1]overlay=0:0:enable='between(t,${panneaux[0].de},${panneaux[0].a})'[a];` +
   `[a][2]overlay=0:0:enable='between(t,${panneaux[1].de},${panneaux[1].a})'[v]`,
   '-map', '[v]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
   '-pix_fmt', 'yuv420p', avecTexte);

// 3. La carte ferme le film : c'est elle qui porte le lien, et elle doit rester
//    assez longtemps pour qu'on ait le temps de le lire et de le retaper.
const fin = path.join(TMP, 'fin.mp4');
ff('-loop', '1', '-i', carte, '-t', '4',
   '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30',
   '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', fin);

const liste = path.join(TMP, 'liste.txt');
fs.writeFileSync(liste, `file '${avecTexte}'\nfile '${fin}'\n`);
ff('-f', 'concat', '-safe', '0', '-i', liste, '-c', 'copy', sortie);

fs.rmSync(TMP, { recursive: true, force: true });

const taille = (fs.statSync(sortie).size / 1048576).toFixed(1);
console.log(`
  ${path.relative(RACINE, sortie)}   ${taille} Mo, 12 s, 1080x1920

Il n'y a PAS de son : TikTok et Reels en veulent un. Pose une musique dans
l'application au moment de publier — c'est aussi ce qui fait entrer la video
dans les sons qui tournent.
`);
