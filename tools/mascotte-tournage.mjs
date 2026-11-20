// LE RECEPTEUR DU TOURNAGE DE LA MASCOTTE (page tools/tournage-mascotte/index.html)
//
//   node tools/mascotte-tournage.mjs [--sortie dossier]
//   puis, le serveur de dev lance (npm run dev), ouvrir :
//   http://localhost:<port>/tools/tournage-mascotte/?p=heros-hilare&g=rire&f=story&tourner=1
//
// La page envoie chaque image (PNG transparent, horloge exacte a 60 i/s) ; a la fin de la prise,
// ce script monte trois fichiers dans le dossier de sortie (par defaut
// /Volumes/MUSIQUE/BENBEZI/assets-sources/mascotte/videos — HORS du depot, qui est public et ou
// des videos n'ont rien a faire) :
//   <prise>.mov   ProRes 4444 avec transparence : a poser par-dessus le jeu (CapCut ordinateur,
//                 Premiere, Final Cut, le studio)
//   <prise>.webm  VP9 avec transparence : pour une page web, plus leger
//   <prise>-vert.mp4  H.264 sur fond vert (#00B140) : pour les applis sans transparence
//                 (incrustation « fond vert » de CapCut telephone, Instagram Edits)
// Les images sont effacees une fois les videos faites. Il faut ffmpeg dans le PATH.
//
// TOUT SEUL, SANS FENETRE (--lot) : le script ouvre lui-meme la page dans un Chrome sans tete
// (puppeteer-core), tourne la liste et s'arrete. C'est la voie a prendre : dans un onglet cache ou
// une fenetre hors de vue, le navigateur etrangle le dessin (moins d'une image par seconde, mesure
// le 20/11) ; sans tete, la carte graphique tourne a plein (≈25 images par seconde).
//   node tools/mascotte-tournage.mjs --lot "heros:salut,heros-hilare:rire" [--format story|carre|large]
//        [--page http://localhost:5383] [--sortie dossier]
//   (CHROME_SANS_TETE et PUPPETEER_CORE pour d'autres chemins que ceux de ce Mac)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const arg = (nom, def) => { const k = args.indexOf('--' + nom); return k >= 0 ? args[k + 1] : def; };
const SORTIE = path.resolve(arg('sortie', '/Volumes/MUSIQUE/BENBEZI/assets-sources/mascotte/videos'));
const LOT = arg('lot', null), FORMAT = arg('format', 'story'), PAGE = arg('page', 'http://localhost:5383');
const PORT = 8770;
fs.mkdirSync(SORTIE, { recursive: true });

const nomSur = (s) => String(s || '').replace(/[^a-z0-9-]/gi, '').slice(0, 80);
const lire = (req) => new Promise((ok) => { const b = []; req.on('data', (c) => b.push(c)); req.on('end', () => ok(Buffer.concat(b))); });

function monter(prise, fps) {
  const images = path.join(SORTIE, '.images-' + prise);
  const entree = ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(images, '%05d.png')];
  const base = path.join(SORTIE, prise);
  execFileSync('ffmpeg', [...entree, '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', base + '.mov']);
  execFileSync('ffmpeg', [...entree, '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '28', '-row-mt', '1', base + '.webm']);
  // (le fond prend la taille ET la cadence des images : sans r=, la source color tourne a 25 i/s
  //  et la video sortait a 25 i/s, des images en moins)
  const png = fs.readFileSync(path.join(images, '00000.png'));
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
  execFileSync('ffmpeg', [...entree, '-filter_complex', `color=c=0x00B140:s=${w}x${h}:r=${fps}[f];[f][0:v]overlay=shortest=1,format=yuv420p`,
    '-r', String(fps),
    '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-movflags', '+faststart', base + '-vert.mp4']);
  const n = fs.readdirSync(images).length;
  fs.rmSync(images, { recursive: true, force: true });
  const taille = (f) => (fs.statSync(f).size / 1e6).toFixed(1) + ' Mo';
  return `${n} images -> ${base}.mov (${taille(base + '.mov')}), .webm (${taille(base + '.webm')}), -vert.mp4 (${taille(base + '-vert.mp4')})`;
}

const serveur = http.createServer(async (req, res) => {
  // (la page est servie par Vite sur localhost : seul ce cote-la a le droit d'ecrire ici)
  const origine = req.headers.origin || '';
  if (origine && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origine)) { res.writeHead(403).end(); return; }
  res.setHeader('Access-Control-Allow-Origin', origine || '*');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') {
    // (une image PNG part avec son type : le navigateur demande d'abord la permission)
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    res.writeHead(204).end(); return;
  }
  const u = new URL(req.url, 'http://x');
  const prise = nomSur(u.searchParams.get('prise'));
  try {
    if (u.pathname === '/ping') { res.end('ok'); return; }
    if (!prise) { res.writeHead(400).end('prise ?'); return; }
    const images = path.join(SORTIE, '.images-' + prise);
    if (u.pathname === '/debut') {
      fs.rmSync(images, { recursive: true, force: true });
      fs.mkdirSync(images, { recursive: true });
      res.end('ok'); return;
    }
    if (u.pathname === '/image') {
      const n = Math.max(0, Math.min(99999, parseInt(u.searchParams.get('n'), 10) || 0));
      fs.writeFileSync(path.join(images, String(n).padStart(5, '0') + '.png'), await lire(req));
      res.end('ok'); return;
    }
    if (u.pathname === '/fin') {
      const fps = Math.max(1, Math.min(120, parseInt(u.searchParams.get('fps'), 10) || 60));
      const r = monter(prise, fps);
      console.log(r);
      res.end(r); return;
    }
    res.writeHead(404).end();
  } catch (e) {
    console.error(e);
    res.writeHead(500).end(String(e && e.message || e));
  }
});
serveur.listen(PORT, '127.0.0.1', () => {
  console.log(`recepteur du tournage sur http://127.0.0.1:${PORT}, sortie ${SORTIE}`);
  if (LOT) tournerSansTete().then(() => serveur.close(), (e) => { console.error(e); process.exit(1); });
});

async function tournerSansTete() {
  const req = createRequire(import.meta.url);
  const puppeteer = req(process.env.PUPPETEER_CORE
    || '/Volumes/MUSIQUE/BENBEZI/caches/npm/_npx/702923228c2ce1e6/node_modules/puppeteer-core');
  const chrome = process.env.CHROME_SANS_TETE || process.env.HOME
    + '/.cache/puppeteer/chrome-headless-shell/mac-152.0.7977.54/chrome-headless-shell-mac-x64/chrome-headless-shell';
  // ANGLE sur Metal : la vraie carte graphique (sans ces drapeaux, le rendu logiciel)
  const b = await puppeteer.launch({ executablePath: chrome, headless: 'shell',
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  try {
    const p = await b.newPage();
    await p.setViewport({ width: 900, height: 1000 });
    const url = `${PAGE}/tools/tournage-mascotte/?f=${encodeURIComponent(FORMAT)}&lot=${encodeURIComponent(LOT)}`;
    await p.goto(url, { waitUntil: 'load', timeout: 120000 });
    for (;;) {
      const fini = await p.evaluate(() => window.__lotFini || null);
      if (fini) { console.log('lot fini :', fini.join(', ')); return; }
      await new Promise((r) => setTimeout(r, 3000));
    }
  } finally { await b.close(); }
}
