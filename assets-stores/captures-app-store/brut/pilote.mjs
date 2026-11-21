// Usage : node pilote.mjs <sortie> <etapes JSON>  — étapes : {clic:"texte"} | {js:"code"} | {att:ms} | {photo:"nom", dsf?}
import { createRequire } from 'node:module';
const require = createRequire('/Users/2times/Documents/sprinter/suivi/videos-modes/atelier/');
const puppeteer = require('puppeteer-core');
const etapes = JSON.parse(process.argv[2]);
const CACHER = () => {
  const pads=[...document.querySelectorAll('[class*="from-white/12"]')];
  for (const x of pads) { (x.parentElement||x).style.visibility='hidden'; }
  for (const x of document.querySelectorAll('body *')) if (!x.children.length && /^(ALTERNE|◀|GAUCHE|DROITE|TAPE)/i.test((x.textContent||'').trim())) { const c=x.closest('div'); (c||x).style.visibility='hidden'; }
  return pads.length;
};
const dsf = Number(process.env.DSF || 1), W = Number(process.env.W || 390), H = Number(process.env.H || 780);
const b = await puppeteer.launch({ headless: 'new', executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  userDataDir: process.cwd()+'/profil', args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'] });
const p = await b.newPage();
await p.setViewport({ width: W, height: H, deviceScaleFactor: dsf, isMobile: true, hasTouch: true });
await p.setRequestInterception(true);
p.on('request', r => {
  const u = r.url();
  if (/workers\.dev\/pieces\?/.test(u)) return r.respond({ status: 200, contentType: 'application/json', headers: {'access-control-allow-origin':'*'}, body: JSON.stringify({ reserve: true, solde: 1250, couts_continue: [50], bareme: {} }) });
  return /workers\.dev/.test(u) ? r.abort() : r.continue();
});
await p.evaluateOnNewDocument(() => { try { localStorage.setItem('sprinter_player_name', 'Nora'); } catch {} });
p.on('pageerror', e => console.log('ERR', String(e).slice(0,120)));
await p.goto(process.env.URL || 'https://sprinter-game.com/', { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 3500));
for (const e of etapes) {
  if (e.att) await new Promise(r => setTimeout(r, e.att));
  if (e.clic) { const ok = await p.evaluate(t => { const el=[...document.querySelectorAll('button,a,[role=button]')].find(x=>x.offsetParent && x.innerText.trim().replace(/\s+/g,' ').toUpperCase().includes(t.toUpperCase())); if(el){el.click();return true}return false }, e.clic); console.log('clic', e.clic, ok); await new Promise(r=>setTimeout(r,1200)); }
  if (e.cache) console.log('cache', await p.evaluate(CACHER));
  if (e.select) { await p.select('select', e.select); console.log('niveau', e.select); await new Promise(r=>setTimeout(r,600)); }
  if (e.js) console.log('js', JSON.stringify(await p.evaluate(e.js)).slice(0,600));
  if (e.attendreEtat) { for (let i=0;i<(e.max||600);i++){ const st=await p.evaluate(()=>SprinterApp.G.state); if(st===e.attendreEtat) break; await new Promise(r=>setTimeout(r,50)); } console.log('etat', await p.evaluate(()=>SprinterApp.G.state)); }
  if (e.courir) { const t0=Date.now(); const ph=[...(e.photos||[])]; let g=true; while(Date.now()-t0<e.courir){ await p.keyboard.press(g?'ArrowLeft':'ArrowRight'); g=!g; await new Promise(r=>setTimeout(r,e.cadence||70)); const el=Date.now()-t0; while(ph.length&&el>=ph[0][0]){ const [,n]=ph.shift(); if(e.cacher) await p.evaluate(CACHER); await p.screenshot({path:n+'.png'}); console.log('photo',n,'etat',await p.evaluate(()=>SprinterApp.G.state)); } } }
  if (e.photo) { await p.screenshot({ path: e.photo + '.png' }); console.log('photo', e.photo); }
}
console.log('boutons', JSON.stringify(await p.$$eval('button,a', els => els.filter(e => e.offsetParent).map(e => e.innerText.trim().replace(/\s+/g,' ')).filter(Boolean).slice(0,40))));
await b.close();
