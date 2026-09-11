import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const CHROME = process.env.HOME + '/.cache/puppeteer/chrome-headless-shell/mac_arm-152.0.7977.54/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const mode = process.argv[2] || 'preview';
const outDir = path.join(HERE, mode === 'preview' ? 'preview' : 'frames');
if (mode !== 'range') fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb',
         '--font-render-hinting=none', '--disable-lcd-text'],
  defaultViewport: { width: 1080, height: 1920, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
page.on('pageerror', e => console.error('PAGE ERROR:', e.message));
await page.goto('file://' + path.join(HERE, 'video.html'), { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
await new Promise(r => setTimeout(r, 900));

const DUR = await page.evaluate(() => window.VIDEO_DURATION);
const FPS = 30;

let times;
if (mode === 'preview') {
  times = process.argv.slice(3).map(Number);
  if (!times.length) times = [1.6, 4.4, 7.0, 11.6, 16.4, 20.6, 26.0, 29.0, 32.6, 37.5, 42.0, 44.6, 48.4, 52.5, 56.8, 60.0];
} else {
  times = Array.from({ length: Math.round(DUR * FPS) }, (_, i) => i / FPS);
}
let off = 0;
if (mode === 'range') {
  off = Number(process.argv[3]); const to = Number(process.argv[4]);
  times = times.slice(off, to);
}

const t0 = Date.now();
for (let i = 0; i < times.length; i++) {
  await page.evaluate(t => window.renderFrame(t), times[i]);
  const name = mode === 'preview'
    ? `t${times[i].toFixed(2).replace('.', '_')}.png`
    : `f${String(i + off).padStart(5, '0')}.jpg`;
  await page.screenshot({ path: path.join(outDir, name), optimizeForSpeed: true,
    ...(mode === 'preview' ? {} : { type: 'jpeg', quality: 96 }) });
  if (mode !== 'preview' && i % 100 === 0)
    console.log(`${i}/${times.length}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
console.log(`OK ${times.length} images en ${((Date.now() - t0) / 1000).toFixed(0)}s -> ${outDir}`);
await browser.close();
