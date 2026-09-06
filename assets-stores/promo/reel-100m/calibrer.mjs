/* ===========================================================================
   LA CALIBRATION — trouver la sequence d'appuis dans le vrai navigateur.

   La simulation hors ligne (LISEZMOI) donne la bonne forme, mais pas le bon
   chiffre au centieme : le jeu quantifie chaque appui sur son pas de physique,
   et ce decalage d'un sous-pas suffisait a faire tomber la note de transition
   de PARFAITE a bonne — la simulation etait pile sur le seuil de 1,20.

   On calibre donc contre le moteur lui-meme : on court la course pour de vrai,
   sans photographier, on lit le chrono et la note, et on dichotomise la
   cadence tenue jusqu'a 8,75 s affiches. Une course sans images coute deux
   secondes ; la certitude en vaut le prix.

     node calibrer.mjs
   =========================================================================== */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL_JEU = process.env.URL_JEU || 'http://127.0.0.1:4173/';
const VISE = 8.75;
const N_MONTEE = 10;          // appuis de la montee en cadence
const REACTION = 40 / 240;    // premier appui, en secondes de course

const HORLOGE = `(() => {
  let t = 0, id = 1; const rafs = new Map();
  window.requestAnimationFrame = cb => { const i = id++; rafs.set(i, cb); return i; };
  window.cancelAnimationFrame = i => rafs.delete(i);
  performance.now = () => t;
  Date.now = () => 1767225600000 + t;
  window.__avancer = ms => { t += ms; const d = [...rafs.values()]; rafs.clear();
    for (const cb of d) { try { cb(t); } catch (e) { console.error(e); } } };
})()`;

const nav = await puppeteer.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb',
         '--font-render-hinting=none', '--disable-lcd-text', '--mute-audio',
         '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 540, height: 960, deviceScaleFactor: 2 },
});
const page = await nav.newPage();
page.on('pageerror', e => console.error('ERREUR PAGE:', e.message));
await page.evaluateOnNewDocument(HORLOGE);
await page.goto(URL_JEU, { waitUntil: 'domcontentloaded' });
await page.waitForFunction('window.SprinterApp && window.SprinterApp.G', { timeout: 30000 });

await page.evaluate(() => {
  const A = window.SprinterApp, G = A.G;
  window.__courir = (appuis) => {
    G.graineCourse = 20260906;
    G.runs = { '100': [], '200': [], '400': [] };
    A.startOneShot(['100'], { levelIdx: 4 });
    let i = 0, cote = 'left', pas = 0;
    const touche = c => {
      const k = c === 'left' ? 'ArrowLeft' : 'ArrowRight';
      window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true }));
    };
    while (pas < 240 * 25) {
      if (G.state === 'race') {
        while (i < appuis.length && appuis[i] < G.elapsed + 1 / 240 - 1e-9) {
          touche(cote); cote = cote === 'left' ? 'right' : 'left'; i++;
        }
      }
      window.__avancer(1000 / 240);
      pas++;
      if (G.player && G.player.finished) break;
    }
    const p = G.player;
    return { chrono: p.finishTime, reaction: p.reaction, bonus: p.reactBonus,
             note: p.transGrade, ratio: p.transRatio, appuis: i };
  };
});

const sequence = (g0, g1) => {
  const t = [REACTION];
  for (let k = 1; k <= N_MONTEE; k++)
    t.push(t.at(-1) + g0 + (g1 - g0) * ((k - 1) / (N_MONTEE - 1)));
  while (t.at(-1) < 13) t.push(t.at(-1) + g1);
  return t;
};
const courir = (g0, g1) => page.evaluate(a => window.__courir(a), sequence(g0, g1));

const calibrer = async (g0) => {
  let lo = 0.030, hi = 0.130;
  for (let k = 0; k < 13; k++) {
    const g1 = (lo + hi) / 2;
    const r = await courir(g0, g1);
    if (r.chrono == null || r.chrono > VISE) hi = g1; else lo = g1;
  }
  for (const g1 of [lo, lo * 0.998, lo * 0.996, lo * 0.994, lo * 0.99]) {
    const r = await courir(g0, g1);
    if (r.chrono != null && r.chrono <= VISE + 1e-9 && r.chrono.toFixed(2) === VISE.toFixed(2)
        && r.note === 2 && r.ratio >= 1.30) return { g0, g1, ...r };
  }
  let meilleur = null;
  for (const g1 of [lo, (lo + hi) / 2, hi]) {
    const r = await courir(g0, g1);
    // LA LIGNE DOIT TOMBER AVANT L'IMAGE 270, PAS APRES. Cette image-la est
    // capturee a 8,75 s pile de chrono ; si l'arrivee se joue un sous-pas plus
    // tard, le HUD affiche bien 8.75 mais le buste est encore a cinq
    // centimetres. On n'accepte donc que les chronos qui affichent 8,75 SANS
    // le depasser — l'arrivee est alors deja franchie quand l'image est prise.
    if (r.chrono != null && r.chrono <= VISE + 1e-9
        && r.chrono.toFixed(2) === VISE.toFixed(2)
        && r.note === 2 && r.ratio >= 1.30)
      if (!meilleur || g1 > meilleur.g1) meilleur = { g0, g1, ...r };
  }
  return meilleur;
};

// LA MONTEE DECIDE DE LA CADENCE TENUE. Une montee qui part trop lentement
// coute du temps qu'il faut rattraper au sprint ; une montee trop plate perd
// la note de transition, donc 4,2 % de vitesse maximale. On balaie donc le
// premier ecart, et on garde la cadence LA PLUS LENTE qui donne encore 8,75 s
// avec la note parfaite — c'est celle qu'un vrai doigt pourrait tenir.
console.log('balayage du premier ecart de la montee (chrono vise :', VISE, 's)');
let choisi = null;
for (const g0 of [0.130, 0.135, 0.140, 0.145, 0.150]) {
  const r = await calibrer(g0);
  console.log(`  depart ${g0.toFixed(3)} s -> `
    + (r ? `tenue ${r.g1.toFixed(5)} s (${(1 / r.g1).toFixed(1)}/s)  ratio ${r.ratio.toFixed(3)}`
         : 'aucune cadence ne convient'));
  if (r && (!choisi || r.g1 > choisi.g1)) choisi = r;
}
if (!choisi) { console.error('\nAUCUNE cadence ne donne', VISE, 'avec la note parfaite'); process.exit(1); }
console.log('\nRETENU');
console.log('  montee   :', N_MONTEE, 'appuis, de', choisi.g0.toFixed(3), 'a', choisi.g1.toFixed(5), 's');
console.log('  tenue    :', choisi.g1.toFixed(5), 's =', (1 / choisi.g1).toFixed(1), 'appuis/s');
console.log('  chrono   :', choisi.chrono.toFixed(4), '-> affiche', choisi.chrono.toFixed(2));
console.log('  reaction :', choisi.reaction.toFixed(4), '-> affiche', choisi.reaction.toFixed(3),
            's  +' + choisi.bonus.toFixed(2), 'm/s');
console.log('  note     :', ['ratee', 'bonne', 'PARFAITE'][choisi.note], '— ratio', choisi.ratio.toFixed(3));
console.log('  appuis   :', choisi.appuis);
fs.writeFileSync(path.join(ICI, 'course.json'), JSON.stringify({
  reaction: REACTION, montee: N_MONTEE, g0: choisi.g0, g1: choisi.g1,
  chrono: choisi.chrono, note: choisi.note, ratio: choisi.ratio,
  reactionMesuree: choisi.reaction, bonus: choisi.bonus,
  appuis: sequence(choisi.g0, choisi.g1).filter(t => t < 9.6),
}, null, 1));
console.log('\ncourse.json ecrit');
await nav.close();
