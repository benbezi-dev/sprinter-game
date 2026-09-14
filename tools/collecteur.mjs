/* -----------------------------------------------------------------------
   Ramasser les images que la page lui envoie, et les poser sur le disque.

   Le navigateur qui fait tourner le jeu ne peut pas ecrire de fichiers, et
   la page est rendue hors ecran — aucun enregistreur d'ecran n'y verrait
   quoi que ce soit. On fait donc l'inverse : le moteur avance d'un pas de
   temps fixe, rend son image, et la poste ici. La sequence obtenue est
   exactement reproductible, ce qu'une capture d'ecran n'est jamais.

     node tools/collecteur.mjs <dossier> [port]
   ----------------------------------------------------------------------- */

import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dossier = process.argv[2] || 'tools/blender/sortie/course';
const port = Number(process.argv[3] || 5299);
mkdirSync(dossier, { recursive: true });

let recues = 0;
createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const m = /^\/f\/(\d+)$/.exec(req.url || '');
  if (req.method !== 'POST' || !m) { res.writeHead(404); return res.end(); }
  const bouts = [];
  req.on('data', b => bouts.push(b));
  req.on('end', () => {
    const data = Buffer.concat(bouts).toString('utf8').replace(/^data:image\/png;base64,/, '');
    writeFileSync(join(dossier, 'f' + String(m[1]).padStart(4, '0') + '.png'),
                  Buffer.from(data, 'base64'));
    recues++;
    if (recues % 25 === 0) process.stdout.write(`  ${recues} images\n`);
    res.writeHead(200); res.end('ok');
  });
}).listen(port, () => console.log(`collecteur sur ${port} -> ${dossier}`));
