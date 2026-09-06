/* L'habillage, image par image : `habillage.html` pose le recadrage, les
   cartons et le sous-titre de l'image demandee, on photographie, et on
   recommence. Rien n'y depend du temps reel, donc deux rendus sont identiques.
     node habillage.mjs           les 300 images
     node habillage.mjs 0 90 200  quelques images de controle              */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const ICI = path.dirname(new URL(import.meta.url).pathname);
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const controle = process.argv.slice(2).map(Number);

const nav = await puppeteer.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb',
         '--font-render-hinting=none', '--disable-lcd-text',
         '--allow-file-access-from-files'],
  defaultViewport: { width: 1080, height: 1920, deviceScaleFactor: 1 },
});
const page = await nav.newPage();
page.on('pageerror', e => console.error('ERREUR PAGE:', e.message));
await page.goto('file://' + path.join(ICI, 'habillage.html'), { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
await new Promise(r => setTimeout(r, 600));

const IMAGES = await page.evaluate(() => window.IMAGES);
const liste = controle.length ? controle : Array.from({ length: IMAGES }, (_, i) => i);
const sortie = path.join(ICI, controle.length ? 'controle' : 'images-reel');
if (!controle.length) fs.rmSync(sortie, { recursive: true, force: true });
fs.mkdirSync(sortie, { recursive: true });

const t0 = Date.now();
for (const f of liste) {
  await page.evaluate(n => window.renderFrame(n), f);
  await page.screenshot({
    path: path.join(sortie, `f${String(f).padStart(5, '0')}.` + (controle.length ? 'png' : 'jpg')),
    ...(controle.length ? {} : { type: 'jpeg', quality: 96, optimizeForSpeed: true }),
  });
  if (!controle.length && f % 50 === 0)
    console.log(`  image ${String(f).padStart(3)}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
console.log(`OK ${liste.length} images -> ${sortie}`);
await nav.close();
