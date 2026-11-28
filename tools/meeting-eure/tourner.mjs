/* ===========================================================================
   Le tournage : un 60 m dans la salle Jesse Owens, image par image, en 2K.

   Le serveur du jeu doit tourner : npx vite --port 5174 --host 127.0.0.1

     # vertical 1440x2560 (Reels, TikTok, story)
     node tools/meeting-eure/tourner.mjs --w=480 --h=854 --dsf=3 --passer=0 --out=<dossier>
     # paysage 2560x1440 (ecran geant, YouTube, message prive)
     node tools/meeting-eure/tourner.mjs --w=854 --h=480 --dsf=3 --passer=0 --out=<dossier>

   POURQUOI UNE HORLOGE VIRTUELLE (horloge.js). Sans carte graphique, la
   salle en 3D se dessine a moins de dix images par seconde, et une capture
   en temps reel donnerait un film saccade. Ici, rien n'avance sans nous :
   chaque image avance le temps du jeu d'exactement 1/30 s, puis on la
   photographie. La course est donc la vraie (le moteur, les adversaires, le
   chrono), seulement filmee au ralenti et rendue a vitesse normale.

   Les appuis gauche/droite tombent a leur instant exact (pas a l'image pres) :
   145 ms au depart, 98 ms apres 0,9 s, comme le joueur qui reussit sa poussee.

   Sort f00000.jpg... et journal.json (les etats du jeu et leur image), que
   monter.mjs lit pour couper.
   =========================================================================== */
import { chromium } from './pw.mjs';
import fs from 'node:fs'; import path from 'node:path';
const ICI = path.dirname(new URL(import.meta.url).pathname);
const A = Object.fromEntries(process.argv.slice(2).map(s => s.replace(/^--/, '').split('=')));
const W = +(A.w || 405), H = +(A.h || 720), DSF = +(A.dsf || 1), IPS = +(A.ips || 30);
const OUT = A.out || 'rush-test'; const CAPT = A.capt !== '0'; const EPR = A.epreuve || '60 M';
const MAXS = +(A.max || 70);
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris', colorScheme: 'dark' });
await ctx.addInitScript({ path: path.join(ICI, 'horloge.js') });
await ctx.addInitScript((nom) => { try { localStorage.setItem('sprinter_web_v1', JSON.stringify({ lang: 'fr' })); localStorage.setItem('sprinter_tuto_vu', '1'); localStorage.setItem('sprinter_tour_vu', '1'); localStorage.setItem('sprinter_bienvenue_vue', '1'); localStorage.setItem('sprinter_player_name', nom); } catch (e) {} }, A.nom || 'EURE');
const p = await ctx.newPage();
p.on('pageerror', e => console.log('  ! page:', String(e).slice(0, 200)));
const cdp = await ctx.newCDPSession(p);
const poserCadre = () => cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DSF, mobile: true });
await poserCadre();
await p.goto(`${A.url || 'http://127.0.0.1:5174/'}?rendu=3d&palier=${A.palier || 3}${A.q ? '&' + A.q : ''}`, { waitUntil: 'load' });
await p.waitForTimeout(7000);
if (A.mode === 'oneshot') await p.getByText('ONE SHOT', { exact: true }).click();
await p.getByText(EPR, { exact: true }).first().click().catch(() => {});
await p.getByText('COMMENCER', { exact: true }).click();
await p.waitForTimeout(500);
await poserCadre();
await p.evaluate(() => window.__virtuel());
const key = async (k, type) => cdp.send('Input.dispatchKeyEvent', { type, windowsVirtualKeyCode: k === 'L' ? 37 : 39, code: k === 'L' ? 'ArrowLeft' : 'ArrowRight', key: k === 'L' ? 'ArrowLeft' : 'ArrowRight' });
const appui = async k => { await key(k, 'rawKeyDown'); await key(k, 'keyUp'); };
const tap = async () => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: W / 2, y: H * 0.3 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
const dt = 1 / IPS; let n = 0, etatPrec = '', tGo = null, prochain = 0, g = 0, tFin = null, taps = 0;
const journal = [];
const st = () => p.evaluate(() => { const G = globalThis.SprinterApp?.G; return { s: G?.state, d: G?.runners?.find?.(r => r.isPlayer)?.d ?? null, fin: G?.runners?.find?.(r => r.isPlayer)?.finished ?? null }; });
for (let i = 0; i < MAXS * IPS; i++) {
  const e = await st();
  if (e.s !== etatPrec) { console.log(`${(i * dt).toFixed(2)}s  etat=${e.s}  img=${n}`); journal.push({ t: +(i * dt).toFixed(2), etat: e.s, image: n }); etatPrec = e.s; }
  // passer l'intro (deux touches) une seule fois, 2 s apres le debut
  if (A.passer !== '0' && i === Math.round(2.5 * IPS) && taps === 0) { await tap(); await p.evaluate(() => window.__pas(0.08)); await tap(); taps = 2; }
  if (e.s === 'race') {
    if (tGo == null) { tGo = i * dt; prochain = tGo + 0.13; }
    const tc = i * dt;
  }
  if (e.fin && tFin == null) { tFin = i * dt; console.log(`  arrivee a ${tFin.toFixed(2)}s img=${n}`); journal.push({ t: tFin, etat: 'arrivee', image: n }); }
  // les appuis tombent a leur instant exact, pas a l'image pres
  let fait = 0;
  if (e.s === 'race' && !e.fin) {
    while (prochain < (i + 1) * dt) {
      const ecart = Math.max(0, prochain - (i * dt + fait));
      if (ecart > 0) { await p.evaluate(d => window.__pas(d), ecart); fait += ecart; }
      await appui(g++ % 2 ? 'R' : 'L');
      const x = prochain - tGo; // 145 ms au depart, 98 ms apres 0,9 s
      prochain += x < 0.45 ? 0.145 : x < 0.9 ? 0.145 - (x - 0.45) / 0.45 * 0.047 : 0.098;
    }
  }
  await p.evaluate(d => window.__pas(d), dt - fait);
  if (CAPT || i % 15 === 0) {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, fromSurface: true });
    fs.writeFileSync(path.join(OUT, `f${String(n).padStart(5, '0')}.jpg`), Buffer.from(data, 'base64')); n++;
  }
  if (tFin != null && i * dt > tFin + +(A.apres || 6)) break;
}
fs.writeFileSync(path.join(OUT, 'journal.json'), JSON.stringify(journal, null, 1));
console.log('images', n, 'texte:', (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 300));
await b.close();
