/* ===========================================================================
   LE TOURNAGE — la course du reel, capturee dans le vrai jeu.

   Le jeu tourne dans un navigateur sans tete, mais PAS EN TEMPS REEL : on lui
   pose une horloge a nous. `requestAnimationFrame`, `performance.now` et
   `Date.now` sont remplaces avant que le premier script de l'application ne
   s'execute, si bien que le moteur avance exactement d'un pas de physique
   (1/240 s) chaque fois qu'on le lui demande, et pas d'un iota de plus.

   Trois consequences, et ce sont elles qui justifient tout le detour :

   1. LA COURSE EST REPRODUCTIBLE. Meme sequence d'appuis, meme chrono, a la
      milliseconde. On peut donc viser 8,75 s et les obtenir, au lieu de
      relancer une capture en temps reel jusqu'a ce que le hasard tombe juste.
   2. LES IMAGES SONT PROPRES. Aucune n'est sautee, aucune n'est doublee : la
      capture ne court pas apres le jeu, c'est le jeu qui attend la capture.
   3. C'EST LE VRAI RENDU. Le canevas du jeu et le HUD React, tels que les
      voit un joueur — pas une maquette qui leur ressemble.

   La sequence d'appuis vient de `course.json`, cherchee hors ligne sur le
   meme moteur (voir LISEZMOI).

     node tournage.mjs            capture les images dans images-jeu/
     node tournage.mjs 42         capture, en s'arretant a l'image 42
   =========================================================================== */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const CHROME = process.env.CHROME
  || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL_JEU = process.env.URL_JEU || 'http://127.0.0.1:4173/';

const FPS = 30;
const PAS = 1 / 240;              // le pas de physique du jeu
const SOUS_PAS = 240 / FPS;       // 8 sous-pas par image capturee
const AVANT_DEPART = 0.25;        // ce qu'on garde du compte a rebours
const SORTIE = 1.00;              // l'image figee, apres la ligne

const course = JSON.parse(fs.readFileSync(path.join(ICI, 'course.json'), 'utf8'));
const CHRONO = course.chrono;
const IMAGE_LIGNE = Math.round((AVANT_DEPART + CHRONO) * FPS);
const IMAGES = Math.round((AVANT_DEPART + CHRONO + SORTIE) * FPS);
const arret = Number(process.argv[2]) || IMAGE_LIGNE;

const sortie = path.join(ICI, 'images-jeu');
fs.rmSync(sortie, { recursive: true, force: true });
fs.mkdirSync(sortie, { recursive: true });

/* --------------------------------------------------------- l'horloge posee */
// Installee avant tout script de la page. `setTimeout` n'est PAS touche :
// l'ordonnanceur de React s'en sert pour vider ses rendus, et le figer
// laisserait le HUD une image en retard sur le canevas.
const HORLOGE = `(() => {
  let t = 0, id = 1;
  const rafs = new Map();
  window.requestAnimationFrame = cb => { const i = id++; rafs.set(i, cb); return i; };
  window.cancelAnimationFrame = i => rafs.delete(i);
  performance.now = () => t;
  Date.now = () => 1767225600000 + t;
  window.__avancer = ms => {
    t += ms;
    const dus = [...rafs.values()]; rafs.clear();
    for (const cb of dus) { try { cb(t); } catch (e) { console.error(e); } }
  };
})()`;

const navigateur = await puppeteer.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb',
         '--font-render-hinting=none', '--disable-lcd-text',
         '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
  // 540 x 960 points a l'echelle 2 : l'image sort en 1080 x 1920 pixels, et le
  // canevas du jeu y est rendu nativement (G.dpr plafonne a 2).
  //
  // C'EST LA LARGEUR EN POINTS QUI CHOISIT LA MISE EN PAGE, et 1080 points
  // donnaient celle d'un ordinateur : au-dessus du palier `md` de Tailwind, le
  // HUD ouvre un classement lateral que personne ne voit sur un telephone. A
  // 540 points on reste sous `sm`, donc sur la mise en page portrait — celle
  // du reel.
  defaultViewport: { width: 540, height: 960, deviceScaleFactor: 2 },
});
const page = await navigateur.newPage();
page.on('pageerror', e => console.error('ERREUR PAGE:', e.message));
await page.evaluateOnNewDocument(HORLOGE);
await page.goto(URL_JEU, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.SprinterApp && window.SprinterApp.G', { timeout: 30000 });
await page.evaluate(() => document.fonts.ready);

/* ------------------------------------------------------------- la course */
await page.evaluate(({ appuis }) => {
  const A = window.SprinterApp, G = A.G;
  let i = 0, cote = 'left';
  const touche = c => {
    const k = c === 'left' ? 'ArrowLeft' : 'ArrowRight';
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true }));
  };
  window.__preparer = () => {
    // Le jeu detecte sa langue depuis le navigateur, et un navigateur sans
    // tete annonce l'anglais : sans cette ligne, le reel sort en OLYMPIC GAMES
    // et TOP SPEED. On la repose a chaque course, pas seulement au chargement.
    A.N.setLang('fr');
    document.documentElement.lang = 'fr';
    // Le plateau se seme : memes adversaires, meme tirage, a chaque tournage.
    G.graineCourse = 20260906;
    // Aucun record personnel sur le 100 m : le chrono du HUD reste dore et la
    // ligne RECORD ne s'affiche pas. C'est la condition decrite au plan.
    G.runs = { '100': [], '200': [], '400': [] };
    A.startOneShot(['100'], { levelIdx: 4 });
    i = 0; cote = 'left';
  };
  window.__sousPas = () => {
    if (G.state === 'race') {
      while (i < appuis.length && appuis[i] < G.elapsed + 1 / 240 - 1e-9) {
        touche(cote); cote = cote === 'left' ? 'right' : 'left'; i++;
      }
    }
    window.__avancer(1000 / 240);
  };
  window.__etat = () => {
    const p = G.player, ordre = G.runners.slice().sort((a, b) => b.d - a.d);
    return { state: G.state, countT: G.countT, elapsed: G.elapsed,
      fini: !!(p && p.finished), chrono: p && p.finishTime,
      reaction: p && p.reaction, bonus: p && p.reactBonus,
      note: p && p.transGrade, appuis: i, d: p && p.d,
      phase: p && p.phase(), place: ordre.indexOf(p) + 1,
      carteReaction: G.reactFlash > 0, carteTransition: G.transFlash > 0,
      eclair: G.flash, champion: G.champion, championTime: G.championTime };
  };
}, { appuis: course.appuis });

// 1. OU TOMBE LE PISTOLET, exactement.
//
// Le compte a rebours dure trois secondes de jeu, soit 720 sous-pas — en
// theorie. En pratique l'horloge du moteur accumule ses pas un a un et derive
// d'un sous-pas ou deux, ce qui suffit a decaler toute la capture : l'image de
// l'arrivee tombait a cinq centimetres de la ligne. On mesure donc le depart
// au lieu de le supposer, puis on rejoue la course en se calant dessus.
const AVANT = Math.round(AVANT_DEPART * 240);
await page.evaluate(() => window.__preparer());
const pistolet = await page.evaluate(() => {
  let n = 0;
  while (window.__etat().state === 'count' && n < 3000) { window.__sousPas(); n++; }
  return n;
});
console.log(`pistolet au sous-pas ${pistolet} (${(pistolet / 240).toFixed(4)} s)`);
await page.evaluate(() => window.__preparer());
await page.evaluate(n => { for (let k = 0; k < n; k++) window.__sousPas(); },
                    pistolet - AVANT);
{
  const e = await page.evaluate(() => window.__etat());
  console.log(`capture a ${AVANT_DEPART} s du depart — compte a rebours a `
    + `${e.countT.toFixed(4)}`);
}

// 2. capturer, une image tous les huit sous-pas
const t0 = Date.now();
const chronologie = [];
for (let f = 0; f <= arret; f++) {
  await page.screenshot({ path: path.join(sortie, `f${String(f).padStart(5, '0')}.jpg`),
                          type: 'jpeg', quality: 95, optimizeForSpeed: true });
  chronologie.push({ f, ...(await page.evaluate(() => window.__etat())) });
  if (f === arret) break;
  await page.evaluate(n => { for (let k = 0; k < n; k++) window.__sousPas(); }, SOUS_PAS);
  // laisser React vider son rendu avant la photo suivante
  await new Promise(r => setTimeout(r, 0));
  if (f % 30 === 0) {
    const e = chronologie[chronologie.length - 1];
    console.log(`  image ${String(f).padStart(3)}  chrono ${e.elapsed.toFixed(2)}`
      + `  ${(e.d || 0).toFixed(1)} m  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
}
const fin = await page.evaluate(() => window.__etat());
console.log('\nA L ARRIVEE');
console.log('  chrono   :', fin.chrono?.toFixed(4), '-> affiche', fin.chrono?.toFixed(2));
console.log('  reaction :', fin.reaction?.toFixed(4), '-> affiche', fin.reaction?.toFixed(3),
            's  +' + fin.bonus?.toFixed(2), 'm/s');
console.log('  note     :', ['ratee', 'bonne', 'PARFAITE'][fin.note]);
console.log('  appuis   :', fin.appuis);
console.log('  images   :', arret + 1, '->', sortie);
fs.writeFileSync(path.join(ICI, 'chronologie.json'), JSON.stringify(chronologie));
fs.writeFileSync(path.join(ICI, 'course-mesuree.json'), JSON.stringify({
  champion: fin.champion, championTime: fin.championTime,
  chrono: fin.chrono, reaction: fin.reaction, bonus: fin.bonus, note: fin.note,
  appuis: fin.appuis, imageLigne: IMAGE_LIGNE, images: IMAGES, fps: FPS,
  avantDepart: AVANT_DEPART, sortie: SORTIE }, null, 1));
await navigateur.close();
