// Capture côte à côte de deux GLB (avant / après optimisation).
// node tools/assets/comparer.mjs <a.glb> <b.glb> <sortie.png> [angle]
// Les chemins sont relatifs à la racine du dépôt (fichiers sous public/ ou ailleurs dans le dépôt).
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
const racine = resolve(new URL('../..', import.meta.url).pathname);
const [a, b, sortie, angle = '30'] = process.argv.slice(2);
if (!a || !b || !sortie) { console.error('usage : comparer.mjs a.glb b.glb sortie.png [angle]'); process.exit(1); }
const types = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm' };
const serveur = createServer(async (q, r) => {
  const p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  const f = p.startsWith('/@abs/') ? p.slice(5) : join(racine, p);
  try { const corps = await readFile(f); r.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' }); r.end(corps); }
  catch { r.writeHead(404); r.end(); }
}).listen(0);
const port = serveur.address().port;
const chemin = (x) => x.startsWith('/') ? '/@abs' + x : '/' + x;
const nav = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await nav.newPage({ viewport: { width: 1200, height: 640 } });
page.on('pageerror', (e) => console.error('erreur page :', e.message));
await page.goto(`http://localhost:${port}/tools/assets/comparer.html?a=${encodeURIComponent(chemin(a))}&b=${encodeURIComponent(chemin(b))}&angle=${angle}`);
await page.waitForFunction(() => document.title === 'pret', null, { timeout: 120000 });
console.log(await page.textContent('#t'));
await page.screenshot({ path: sortie });
await nav.close(); serveur.close();
