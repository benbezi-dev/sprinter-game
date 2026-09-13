#!/usr/bin/env node
// Filmer une VRAIE course, pas une reconstitution.
//
// POURQUOI. Une animation refaite a la main ressemble au jeu ; elle n'EST pas
// le jeu. Sur un reseau ou l'on promet « viens battre ce chrono », montrer
// autre chose que l'ecran reel est le genre de detail qu'un joueur repere en
// trois secondes — et qui coute plus cher que l'absence de video.
//
// COMMENT. Chrome est pilote en CDP brut : rien a installer, ni puppeteer ni
// playwright. Les menus se cliquent par le DOM ; la course, elle, se joue aux
// VRAIS appuis tactiles. C'est le moteur du jeu qui decide du chrono, pas ce
// fichier : celui qui s'affiche a l'arrivee est celui d'une course courue.
//
// AVANT DE LANCER, trois choses doivent tourner :
//   npm run build
//   (cd dist && python3 -m http.server 5200 --bind 127.0.0.1) &
//   chrome --headless --remote-debugging-port=9222 --user-data-dir=/tmp/chr about:blank &
//   node tools/filmer-course.mjs [cadence_ms] [epreuve]
//
// La cadence est l'ecart entre deux appuis en millisecondes : plus elle est
// courte, plus la course est rapide, jusqu'a la faute. 50 ms rend ~9,3 s.

import { connecter, ecranTelephone, doigt } from './pilote-chrome.mjs';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const CADENCE = Number(process.argv[2] || 50);
const EPREUVE = process.argv[3] || '100 M';
const SITE = process.env.SPRINTER_SITE || 'http://127.0.0.1:5200/';
const IMAGES = 'film-course';
const FF = 'node_modules/ffmpeg-static/ffmpeg';

// Les deux touches, en pixels CSS du viewport telephone (432 x 768).
const GAUCHE = [111, 687], DROITE = [320, 687];

const texteEcran = (p) => p.js(`document.body ? document.body.innerText : ''`);

const clicDom = (p, motif) => p.js(`(() => {
  const e = [...document.querySelectorAll('button,[role=button],a')]
    .filter(x => x.offsetParent !== null)
    .find(x => (x.innerText||'').toUpperCase().includes(${JSON.stringify(motif)}));
  if (!e) return 'introuvable'; e.click(); return 'ok';
})()`);

/** L'intro se passe au doigt, et elle prend le temps qu'elle prend. */
async function jusquAuMenu(p) {
  await p.envoyer('Page.enable');
  await ecranTelephone(p);
  await p.envoyer('Page.navigate', { url: SITE });
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const boutons = await p.js(
      `[...document.querySelectorAll('button')].filter(b=>b.offsetParent!==null&&b.innerText.trim()).length`);
    if (boutons > 0) return true;
    await doigt(p, 216, 384);
  }
  throw new Error("le menu n'est jamais apparu");
}

const p = await connecter();
await jusquAuMenu(p);
await clicDom(p, 'EN');                       // le jeu demarre en anglais
await new Promise((r) => setTimeout(r, 800));
await clicDom(p, 'ONE SHOT');
await new Promise((r) => setTimeout(r, 800));

// Le screencast plutot qu'une rafale de captures : une capture par image coute
// un aller-retour complet et ferait tomber la cadence des appuis — or c'est
// elle qui fait la course. On garde l'horodatage de chaque image, parce que le
// flux n'envoie une image que quand la page se repeint, jamais a intervalle
// fixe : encoder a 30 i/s un flux qui en produit 57 donnerait un ralenti, et
// le chrono affiche a l'ecran le trahirait aussitot.
const images = [], quand = [];
p.sur('Page.screencastFrame', ({ data, sessionId, metadata }) => {
  images.push(data); quand.push(metadata?.timestamp ?? Date.now() / 1000);
  p.envoyer('Page.screencastFrameAck', { sessionId }).catch(() => {});
});
await p.envoyer('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });

await clicDom(p, EPREUVE);

const tape = ([x, y]) => {
  p.envoyer('Input.dispatchTouchEvent',
    { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }).catch(() => {});
  p.envoyer('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }).catch(() => {});
};

// On laisse passer le decompte : un appui pendant « 3, 2, 1 » est un faux
// depart, et en one shot il elimine.
await new Promise((r) => setTimeout(r, 2600));
let appuis = 0;
const boucle = setInterval(() => tape(appuis++ % 2 ? DROITE : GAUCHE), CADENCE);

// On s'arrete a l'arrivee, pas au chronometre : la duree depend de la cadence.
let fin = '';
for (let i = 0; i < 45; i++) {
  await new Promise((r) => setTimeout(r, 400));
  fin = await texteEcran(p);
  if (/TERMIN|CUMUL/i.test(fin)) break;
}
clearInterval(boucle);
await new Promise((r) => setTimeout(r, 1800));   // on garde l'ecran d'arrivee
await p.envoyer('Page.stopScreencast');
p.fermer();

if (!images.length) { console.error('aucune image capturee'); process.exit(1); }
rmSync(IMAGES, { recursive: true, force: true });
mkdirSync(IMAGES, { recursive: true });
images.forEach((d, i) =>
  writeFileSync(`${IMAGES}/f${String(i).padStart(5, '0')}.jpg`, Buffer.from(d, 'base64')));

const duree = quand.length > 1 ? quand.at(-1) - quand[0] : images.length / 30;
const ips = Math.max(1, Math.min(60, images.length / duree));
const chrono = (fin.match(/(\d+[.,]\d+)\s*s/i) || [])[1] || '?';
console.log(`${images.length} images · ${appuis} appuis · ${duree.toFixed(1)} s a ${ips.toFixed(1)} i/s`);
console.log(`chrono de la course : ${chrono} s`);

if (!existsSync(FF)) {
  console.log(`\n${IMAGES}/ contient les images. Pour encoder :`);
  console.log(`  npm i --no-save ffmpeg-static && node tools/filmer-course.mjs`);
  process.exit(0);
}
execFileSync(FF, ['-y', '-loglevel', 'error', '-framerate', ips.toFixed(3),
  '-i', `${IMAGES}/f%05d.jpg`, '-vf', 'scale=1080:-2:flags=lanczos',
  '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
  '-preset', 'slow', '-crf', '19', '-movflags', '+faststart',
  'gameplay-course.mp4'], { stdio: 'inherit' });
console.log('-> gameplay-course.mp4  (1080 x 1920, H.264)');
