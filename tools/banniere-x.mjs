/* ===========================================================================
   La banniere X, 1500x500.

   Un compte qui repond sous un gros post est juge en une seconde, sur trois
   choses : l'avatar, le nom affiche, la banniere. Le @ vient en dernier — ce
   qui tombe bien quand le @ qu'on voulait est deja pris.

   La banniere se taille dans une capture du jeu plutot que dans une maquette :
   elle montre le stade, donc le produit, et c'est la seule image du profil qui
   ait la place de le faire.

     node tools/banniere-x.mjs

   Sort communication/riposte-danube/profil-x/banniere-1500x500.png

   Le cadrage vise le HAUT de la capture (gradins, projecteurs) : sur X, le
   bas-gauche de la banniere passe sous l'avatar et le bas-droit sous le
   bouton « Suivre ». Ce qu'on veut montrer doit vivre en haut.
   =========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const RACINE = path.resolve(ICI, '..');
const SOURCE = path.join(RACINE, 'communication/riposte-danube/stade/x-1600x900-ligne.png');
const SORTIE = path.join(RACINE, 'communication/riposte-danube/profil-x');

const requirePromo = createRequire(path.join(RACINE, 'assets-stores/promo/package.json'));
const puppeteer = requirePromo('puppeteer-core');
const CHROME = process.env.HOME +
  '/.cache/puppeteer/chrome-headless-shell/mac_arm-152.0.7977.54/chrome-headless-shell-mac-arm64/chrome-headless-shell';

if (!fs.existsSync(SOURCE)) {
  console.error(`Capture introuvable : ${path.relative(RACINE, SOURCE)}`);
  process.exit(1);
}
const image = 'data:image/png;base64,' + fs.readFileSync(SOURCE).toString('base64');

const page = `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1500px;height:500px;overflow:hidden;background:#14121e}
  .fond{position:absolute;inset:0;
        background:url("${image}") center 30% / cover no-repeat}
  /* Le coin bas-gauche disparait sous l'avatar : on l'assombrit pour que la
     photo de profil s'y detache au lieu de se noyer dans les gradins. */
  /* Pas de texte sur la banniere, et c'est deliberé : X la rogne sur les
     cotes en mobile, et la piste est orange clair — un titre pose dessus s'y
     noie. Le nom, le lien et la baseline vivent dans la bio, qui elle ne se
     rogne pas. La banniere ne fait qu'une chose : montrer le jeu.
     Seul reste un voile en bas a gauche, la ou l'avatar se pose. */
  .ombre{position:absolute;inset:0;
         background:radial-gradient(circle at 12% 92%,rgba(20,18,30,.88) 0%,
                    rgba(20,18,30,.45) 22%,rgba(20,18,30,0) 42%)}
  .liseré{position:absolute;left:0;right:0;bottom:0;height:8px;background:#e8622a}
  </style>
  <div class="fond"></div><div class="ombre"></div>
  <div class="liseré"></div>`;

fs.mkdirSync(SORTIE, { recursive: true });
const navigateur = await puppeteer.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb',
         '--font-render-hinting=none', '--disable-lcd-text'],
});
const onglet = await navigateur.newPage();
await onglet.setViewport({ width: 1500, height: 500, deviceScaleFactor: 1 });
await onglet.setContent(page, { waitUntil: 'load' });
const chemin = path.join(SORTIE, 'banniere-1500x500.png');
await onglet.screenshot({ path: chemin, type: 'png' });
await navigateur.close();

console.log(`  ${path.relative(RACINE, chemin)}`);
