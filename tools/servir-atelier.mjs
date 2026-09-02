/* ---------------------------------------------------------------------------
   SERVIR L'ATELIER
   ---------------------------------------------------------------------------
   L'atelier de publication est une page servie telle quelle, sans compilation
   — c'est d'ailleurs pour cela que `src/game/trace-affiche.js` est du
   JavaScript et pas du TypeScript. Reste qu'elle ne peut pas s'ouvrir en
   `file://` : elle importe un module ES, et le navigateur refuse un import
   depuis un fichier local.

   Ce serveur ne sert donc qu'a une chose : poser le depot sur un port, pour
   que `/src/game/trace-affiche.js` soit une adresse. Une trentaine de lignes
   sans dependance, plutot qu'un paquet a installer pour trois fichiers
   statiques.

   La racine servie est celle du DEPOT, pas `tools/` : l'atelier importe le
   meme fichier que le jeu, et le servir depuis ailleurs reviendrait a en
   garder une copie — donc a les laisser diverger, ce qui est exactement ce
   qu'on repare.

   `/reseaux.html` mene a `tools/reseaux.html`. L'atelier a longtemps vecu a la
   racine d'un autre dossier, et l'adresse qu'on avait dans ses favoris etait
   celle-la : la garder ne coute qu'une ligne.

       npm run atelier      puis      http://localhost:4178/reseaux.html
--------------------------------------------------------------------------- */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const RACINE = resolve(import.meta.dirname, '..');
const PORT = Number(process.env.PORT) || 4178;

/** Les raccourcis : l'adresse qu'on tape, et le fichier qu'elle designe. */
const RACCOURCIS = {
  '/': 'tools/reseaux.html',
  '/reseaux.html': 'tools/reseaux.html',
};

// Le type compte pour une seule de ces extensions, et il compte beaucoup : un
// module ES servi en `text/plain` est refuse par le navigateur, et l'erreur
// parle de type MIME sans dire lequel on attendait.
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.webmanifest': 'application/manifest+json',
};

createServer(async (req, rep) => {
  const chemin = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const relatif = RACCOURCIS[chemin] || normalize(chemin).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
  const fichier = join(RACINE, relatif);

  // Le depot et rien d'autre. Un serveur de developpement reste un serveur :
  // il ecoute, et « ../../.ssh » est une adresse comme une autre.
  if (!fichier.startsWith(RACINE)) {
    rep.writeHead(403).end('hors du depot');
    return;
  }

  try {
    const s = await stat(fichier);
    if (s.isDirectory()) throw new Error('dossier');
    const corps = await readFile(fichier);
    rep.writeHead(200, {
      'Content-Type': TYPES[extname(fichier).toLowerCase()] || 'application/octet-stream',
      // Rien en cache : on retouche le trace et l'on recharge. Un atelier qui
      // sert la version d'avant fait chercher le defaut dans le code.
      'Cache-Control': 'no-store',
    }).end(corps);
  } catch {
    rep.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
       .end(`introuvable : ${relatif}`);
  }
}).listen(PORT, () => {
  console.log(`\n  Atelier de publication  →  http://localhost:${PORT}/reseaux.html`);
  console.log(`  Depot servi depuis      →  ${RACINE}\n`);
});
