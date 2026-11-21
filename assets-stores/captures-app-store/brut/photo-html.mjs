import { createRequire } from 'node:module';
const require = createRequire('/Users/2times/Documents/sprinter/suivi/videos-modes/atelier/');
const puppeteer = require('puppeteer-core');
const [,, src, out, w, h, dsf='1'] = process.argv;
const b = await puppeteer.launch({ headless: 'new', executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args:['--allow-file-access-from-files'] });
const p = await b.newPage(); await p.setViewport({ width: +w, height: +h, deviceScaleFactor: +dsf });
await p.goto('file://' + src, { waitUntil: 'networkidle0' }); await p.evaluate(() => document.fonts.ready); await new Promise(r=>setTimeout(r,500));
await p.screenshot({ path: out }); await b.close();
