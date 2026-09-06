/* ===========================================================================
   CE QUE RAPPORTE CHAQUE CADENCE, mesure sur le moteur reel.

   Les chiffres inscrits dans `RACES['100']` — 10,25 s a huit appuis par
   seconde, 9,22 s a dix, 8,87 s a treize, 8,61 s a dix-sept — datent tous d'un
   DEPART PLAT : cadence constante du premier appui au dernier. Or une cadence
   constante ne monte pas, donc la note de transition est ratee, donc le
   coureur perd 4,2 % de vitesse maximale (`TRANS_VMAX`). Ces mesures disent ce
   que coute une course mal partie, pas ce qu'un bon depart rapporte — et s'en
   servir pour juger un chrono atteignable ou non fait dire au code l'inverse
   de ce qu'il mesure.

   Ce script refait la mesure autrement : pour chaque cadence tenue, il cherche
   la MEILLEURE forme de montee (nombre d'appuis, premier ecart) et rend le
   chrono qui en sort, note comprise. C'est ce tableau-la qui dit si un chrono
   affiche sur une couverture est a portee d'un doigt ou seulement d'un script.

   Il court dans le navigateur, sur le jeu construit et servi, avec l'horloge
   posee de `tournage.mjs` : une course y est reproductible a la milliseconde.
   Compter une vingtaine de minutes — c'est plusieurs centaines de courses.

     npm run build && npx vite preview --port 4173     # a la racine
     node cadences.mjs
   =========================================================================== */
import puppeteer from 'puppeteer-core';

const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL_JEU = process.env.URL_JEU || 'http://127.0.0.1:4173/';
const REACTION = 40 / 240;        // premier appui : un multiple du pas de physique

const HORLOGE = `(() => { let t = 0, id = 1; const rafs = new Map();
  window.requestAnimationFrame = cb => { const i = id++; rafs.set(i, cb); return i; };
  window.cancelAnimationFrame = i => rafs.delete(i);
  performance.now = () => t; Date.now = () => 1767225600000 + t;
  window.__avancer = ms => { t += ms; const d = [...rafs.values()]; rafs.clear();
    for (const cb of d) { try { cb(t); } catch (e) {} } }; })()`;

const nav = await puppeteer.launch({ executablePath: CHROME,
  args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 540, height: 960, deviceScaleFactor: 1 } });
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
    while (pas++ < 240 * 25) {
      if (G.state === 'race')
        while (i < appuis.length && appuis[i] < G.elapsed + 1 / 240 - 1e-9) {
          touche(cote); cote = cote === 'left' ? 'right' : 'left'; i++;
        }
      window.__avancer(1000 / 240);
      if (G.player && G.player.finished) break;
    }
    const p = G.player;
    return { chrono: p.finishTime, note: p.transGrade, ratio: p.transRatio, appuis: i };
  };
});

/** Montee lineaire de `g0` a `g1` sur `n` appuis, puis `g1` tenu. */
const sequence = (g0, g1, n) => {
  const t = [REACTION];
  for (let k = 1; k <= n; k++)
    t.push(t.at(-1) + g0 + (g1 - g0) * ((k - 1) / (n - 1)));
  while (t.at(-1) < 13) t.push(t.at(-1) + g1);
  return t;
};

console.log('cadence tenue   meilleur chrono   note        montee');
for (const f of [10, 12, 13, 14, 15, 17, 20, 25, 30, 40, 50]) {
  const g1 = 1 / f;
  let meilleur = null;
  for (let n = 8; n <= 24; n += 4)
    for (let g0 = g1; g0 <= 0.20; g0 += 0.015) {
      const r = await page.evaluate(a => window.__courir(a), sequence(g0, g1, n));
      if (r.chrono == null) continue;
      if (!meilleur || r.chrono < meilleur.chrono) meilleur = { ...r, g0, n };
    }
  console.log(`  ${String(f).padStart(2)} appuis/s      ${meilleur.chrono.toFixed(3)} s`
    + `        ${['ratee', 'bonne', 'PARFAITE'][meilleur.note].padEnd(9)}`
    + ` ${meilleur.n} appuis depuis ${meilleur.g0.toFixed(3)} s`);
}
await nav.close();
