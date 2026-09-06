/* ===========================================================================
   Le rendu des films d'explication.

   Un film est une page ou tout depend du temps : on pose window.renderFrame(t)
   puis on photographie. D'ou deux sorties depuis la MEME source, sans risque
   qu'elles divergent — les photos sont des images du film, pas des maquettes
   refaites a cote.

     node rendu.mjs photos [film...]   les images fixes declarees par le film
     node rendu.mjs film   [film...]   toutes les images, pour l'encodage
     node rendu.mjs voir   <film> <t>  une image a l'instant t, pour verifier

   Sans nom de film, tous les films du dossier y passent.
   =========================================================================== */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const CHROME = process.env.HOME +
  '/.cache/puppeteer/chrome-headless-shell/mac_arm-152.0.7977.54/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const FPS = 30;

const FILMS = fs.readdirSync(ICI)
  .filter(f => /^\d\d-.*\.html$/.test(f))
  .map(f => f.replace(/\.html$/, ''))
  .sort();

const mode = process.argv[2] || 'photos';
const args = process.argv.slice(3);
const choisis = mode === 'voir' ? [args[0]]
  : (args.length ? args.map(a => a.replace(/\.html$/, '')) : FILMS);

const navigateur = await puppeteer.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb',
         '--font-render-hinting=none', '--disable-lcd-text'],
  defaultViewport: { width: 1080, height: 1920, deviceScaleFactor: 1 },
});

for (const film of choisis) {
  const page = await navigateur.newPage();
  const soucis = [];
  page.on('pageerror', e => soucis.push(e.message));
  await page.goto('file://' + path.join(ICI, film + '.html'), { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 900));
  if (soucis.length) { console.error(`✗ ${film} : ${soucis[0]}`); await page.close(); continue; }

  const duree = await page.evaluate(() => window.VIDEO_DURATION);

  if (mode === 'voir') {
    const t = Number(args[1] || 0);
    const dossier = path.join(ICI, 'controle');
    fs.mkdirSync(dossier, { recursive: true });
    await page.evaluate(x => window.renderFrame(x), t);
    const nom = path.join(dossier, `${film}-t${t.toFixed(2).replace('.', '_')}.png`);
    await page.screenshot({ path: nom });
    console.log('→ ' + path.relative(ICI, nom));
  }

  if (mode === 'photos') {
    const photos = await page.evaluate(() => window.PHOTOS || []);
    const dossier = path.join(ICI, 'photos', film);
    fs.rmSync(dossier, { recursive: true, force: true });
    fs.mkdirSync(dossier, { recursive: true });
    for (let i = 0; i < photos.length; i++) {
      const [t, nom] = photos[i];
      await page.evaluate(x => window.renderFrame(x), t);
      await page.screenshot({
        path: path.join(dossier, `${String(i + 1).padStart(2, '0')}-${nom}.png`) });
    }
    console.log(`✓ ${film} — ${photos.length} photos`);
  }

  if (mode === 'film') {
    const dossier = path.join(ICI, 'images', film);
    fs.rmSync(dossier, { recursive: true, force: true });
    fs.mkdirSync(dossier, { recursive: true });
    const n = Math.round(duree * FPS);
    const t0 = Date.now();
    for (let i = 0; i < n; i++) {
      await page.evaluate(x => window.renderFrame(x), i / FPS);
      await page.screenshot({ path: path.join(dossier, `f${String(i).padStart(5, '0')}.jpg`),
        type: 'jpeg', quality: 96, optimizeForSpeed: true });
    }
    console.log(`✓ ${film} — ${n} images, ${duree}s, ${((Date.now() - t0) / 1000).toFixed(0)}s de rendu`);
  }

  await page.close();
}
await navigateur.close();
