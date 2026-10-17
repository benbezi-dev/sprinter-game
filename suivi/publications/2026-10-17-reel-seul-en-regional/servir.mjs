// Sert le depot sur http://localhost:8765, sans aucune dependance (Node 22).
//
// Le monteur importe src/game/trace-affiche.js et ouvre un dossier avec
// showDirectoryPicker : il lui faut donc la racine du depot ET une origine
// sure — localhost en est une, file:// non.
//
//   node suivi/publications/2026-10-17-reel-seul-en-regional/servir.mjs
//   puis http://localhost:8765/suivi/publications/2026-10-17-reel-seul-en-regional/monteur-seul-en-regional.html

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = normalize(join(fileURLToPath(new URL('.', import.meta.url)), '../../..'));
const PORT = Number(process.env.PORT || 8765);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.png': 'image/png', '.woff2': 'font/woff2',
  '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};

createServer(async (req, res) => {
  const chemin = normalize(join(RACINE, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!chemin.startsWith(RACINE)) { res.writeHead(403).end(); return; }
  try {
    const corps = await readFile(chemin);
    res.writeHead(200, { 'Content-Type': TYPES[extname(chemin)] || 'application/octet-stream',
                         'Cache-Control': 'no-store' });
    res.end(corps);
  } catch {
    res.writeHead(404).end('introuvable');
  }
}).listen(PORT, () => {
  console.log(`http://localhost:${PORT}/suivi/publications/2026-10-17-reel-seul-en-regional/monteur-seul-en-regional.html`);
});
