#!/usr/bin/env node
// Les rushes, avant le montage.
//
// CE QUE CET OUTIL CORRIGE. Les WebM que produit Playwright n'ont aucun index
// de recherche : dans Chromium, `video.currentTime = 32.6` ne fait rien, et un
// montage bati sur ces fichiers part faux sans prevenir. C'est ce piege qui a
// deja coute deux montages.
//
// La cause n'est pas le navigateur, c'est le fichier : Playwright ecrit son
// WebM comme un flux, et un flux ne porte pas de table Cues. Poser cette table
// ne demande pas de reencoder — on recopie les paquets tels quels et on ecrit
// l'index a la fin. Seize millisecondes pour un rush de 3,5 Mo.
//
// POURQUOI PAS « TOUT DANS LE NAVIGATEUR ». Le montage sur canvas avec
// MediaRecorder reste parfait pour composer. Mais couper, coller bout a bout et
// poser une piste son n'ont aucune raison de passer par un canvas : ce sont des
// operations sur des paquets, pas sur des images, et les refaire image par
// image coute un reencodage complet et une generation de perte.
//
// ffmpeg-static installe le binaire dans node_modules, sans rien toucher au
// systeme. C'est deja ce que fait assets-stores/promo/source-video/encode.sh.
//
//   npm i --no-save ffmpeg-static
//   node tools/rushes.mjs indexer  rush.webm          # repare le seek, sans perte
//   node tools/rushes.mjs montable rush.webm          # MP4, image-cle toutes les 0,5 s
//   node tools/rushes.mjs couper   rush.mp4 12.4 19.8 # un extrait
//   node tools/rushes.mjs coller   a.mp4 b.mp4 c.mp4  # bout a bout, sans reencoder

import { existsSync, writeFileSync, unlinkSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, extname, dirname, join } from 'node:path';

const FF = 'node_modules/ffmpeg-static/ffmpeg';
if (!existsSync(FF)) {
  console.error('ffmpeg-static absent. Poser le binaire sans toucher au systeme :');
  console.error('  npm i --no-save ffmpeg-static');
  process.exit(1);
}

const ff = (args) => execFileSync(FF, ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
const sansExt = (f) => join(dirname(f), basename(f, extname(f)));
const doitExister = (f) => {
  if (!existsSync(f)) { console.error(`introuvable : ${f}`); process.exit(1); }
  return f;
};

/** L'index Cues est-il la ? C'est lui qui rend un WebM navigable. */
function indexe(fichier) {
  try { return readFileSync(fichier).includes(Buffer.from('1c53bb6b', 'hex')); }
  catch { return false; }
}

const [, , action, ...reste] = process.argv;

if (action === 'indexer') {
  const source = doitExister(reste[0]);
  if (indexe(source)) { console.log(`${source} porte deja son index — rien a faire.`); process.exit(0); }
  const sortie = `${sansExt(source)}-indexe.webm`;
  // -c copy : les paquets sont recopies, pas reencodes. Aucune perte, et le
  // temps de travail ne depend que de la taille du fichier.
  ff(['-i', source, '-c', 'copy', sortie]);
  console.log(`${sortie} — index ${indexe(sortie) ? 'pose' : 'TOUJOURS ABSENT (a signaler)'}`);

} else if (action === 'montable') {
  const source = doitExister(reste[0]);
  const sortie = `${sansExt(source)}-montable.mp4`;
  // Une image-cle toutes les quinze images, soit une demi-seconde a 30 i/s, et
  // aucune coupe de scene automatique : sans cela ffmpeg place les images-cles
  // ou il veut, et un seek retombe jusqu'a plusieurs secondes en arriere.
  ff(['-i', source, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
      '-g', '15', '-keyint_min', '15', '-sc_threshold', '0',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', sortie]);
  console.log(`${sortie} — seek au centieme, lisible partout`);

} else if (action === 'couper') {
  const source = doitExister(reste[0]);
  const [debut, fin] = reste.slice(1).map(Number);
  if (!(fin > debut)) { console.error('usage : couper <fichier> <debut_s> <fin_s>'); process.exit(1); }
  const sortie = `${sansExt(source)}-${debut}-${fin}${extname(source)}`;
  // -ss AVANT -i : ffmpeg saute directement a l'image-cle, au lieu de decoder
  // tout ce qui precede. Sur un rush d'une minute la difference est d'un ordre
  // de grandeur.
  ff(['-ss', String(debut), '-to', String(fin), '-i', source, '-c', 'copy', sortie]);
  console.log(`${sortie} — ${(fin - debut).toFixed(2)} s`);

} else if (action === 'coller') {
  const morceaux = reste.map(doitExister);
  if (morceaux.length < 2) { console.error('usage : coller <a> <b> [c...]'); process.exit(1); }
  const liste = `${sansExt(morceaux[0])}-liste.txt`;
  // Le demuxeur concat lit une liste de chemins. Les apostrophes s'echappent,
  // sinon un fichier nomme « l'arrivee.mp4 » casse la liste.
  writeFileSync(liste, morceaux.map(f =>
    `file '${f.replace(/'/g, "'\\''")}'`).join('\n') + '\n');
  const sortie = `${sansExt(morceaux[0])}-colle${extname(morceaux[0])}`;
  try {
    ff(['-f', 'concat', '-safe', '0', '-i', liste, '-c', 'copy', sortie]);
    console.log(`${sortie} — ${morceaux.length} morceaux, sans reencoder`);
  } finally { unlinkSync(liste); }

} else {
  console.log(readFileSync(new URL(import.meta.url)).toString()
    .split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n'));
}
