/**
 * Le monteur.
 *
 * Il prend une suite d'images numerotees (le rush), un conducteur, et rend un
 * MP4 1080 x 1920 H.264. Trois partis pris, tous dictes par la charte :
 *
 *   · LA POUSSEE. Chaque plan monte lentement d'echelle, ou pousse vers un
 *     endroit precis — le chrono, le drapeau, la fleche du classement. Un plan
 *     fixe au milieu d'un film qui court s'arrete net.
 *     Le recadrage se fait sur une image DOUBLEE d'abord (2160 x 3840) : sans
 *     cela, `crop` arrondit a l'entier et la poussee tremble d'un pixel.
 *   · LES COUPES SECHES. Pas de fondu enchaine entre les plans. « Coupe tout
 *     temps mort, garde l'action et la reaction. »
 *   · LES CARTONS SE POSENT, ils ne remplacent pas. Fond transparent, entree
 *     par le bas, sortie en fondu. Seule la signature est pleine.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const FFMPEG = '/Volumes/MUSIQUE/BENBEZI/Sprinter/assets-stores/promo/node_modules/ffmpeg-static/ffmpeg';
const L = 1080, H = 1920;

const ff = (args, muet = true) =>
  execFileSync(FFMPEG, ['-hide_banner', '-loglevel', muet ? 'error' : 'info', '-y', ...args],
               { stdio: ['ignore', 'pipe', muet ? 'pipe' : 'inherit'], maxBuffer: 1 << 26 });

/**
 * Les plans, composes par PIL.
 *
 * Voir `plans.py` pour le pourquoi : ni `crop` ni `zoompan` ne savent faire
 * ici une fenetre qui retrecit proprement, et PIL le fait au sous-pixel.
 * Rend le nombre d'images ecrites, donc la duree exacte.
 */
function composerPlans(rush, sortie, plans, ips) {
  const spec = join(sortie, 'plans.json');
  mkdirSync(sortie, { recursive: true });
  const dossier = join(sortie, 'images');
  writeFileSync(spec, JSON.stringify({ rush, sortie: dossier, ips, plans }));
  const r = execFileSync('python3', [new URL('./plans.py', import.meta.url).pathname, spec],
                         { encoding: 'utf8' });
  // `plans.py` rend lui aussi une cle `images` — le NOMBRE d'images ecrites.
  // L'etaler par-dessus le chemin du dossier ecraserait ce chemin par un
  // entier, et ffmpeg recevrait un motif de fichier inutilisable.
  const compte = JSON.parse(r.trim().split('\n').pop());
  return { dossier, images: compte.images, duree: compte.duree };
}

/**
 * Monte un reel.
 *
 * `plans`    la suite des plans, dans l'ordre du film.
 * `cartons`  [{ png, de, duree, y, entree }] — `de` en secondes du FILM monte.
 * `fin`      le carton plein de la signature, et sa duree.
 * `son`      un WAV a poser sur le film, ou `null` pour un reel muet.
 * `pistes`    plusieurs bandes-son sur la MEME image : [{ suffixe, wav }].
 * `fonduFin`  un fondu au noir sur les dernieres secondes, ou 0 pour aucun.
 *
 * LE SON EST OPTIONNEL, ET TOUTES LES SORTIES SONT LIVREES. Les cinq reels de
 * septembre sont muets, parce qu'Instagram pose sa propre musique au moment
 * de publier ; un teaser, lui, doit s'entendre des la premiere seconde d'un
 * fil. On rend donc les deux — `<nom>.mp4` avec la piste, `<nom>_muet.mp4`
 * sans — et c'est au moment de publier qu'on choisit. Le muet n'est pas un
 * sous-produit : c'est celui qu'on garde pour poser un morceau sous licence.
 *
 * PLUSIEURS BANDES POUR UNE SEULE IMAGE. Un teaser avec voix off se livre
 * aussi sans elle : une voix de synthese ne convient pas partout, et le jour
 * ou une vraie voix sera enregistree c'est la version sans voix qu'on
 * reprendra. Ces versions ne different que par la piste audio — les rendre
 * par deux appels de `monter()` encoderait deux fois la meme image, et
 * laisserait derriere soi deux encodages qui peuvent diverger. `pistes`
 * les MULTIPLEXE donc sur un seul master, en `-c:v copy`.
 */
export function monter({ nom, rush, ips = 30, plans, cartons = [], fin = null,
                         son = null, pistes = [], fonduFin = 0, travail, sortie }) {
  mkdirSync(travail, { recursive: true });
  mkdirSync(sortie, { recursive: true });

  // 1 · les plans, composes en une seule suite d'images (coupes seches : il
  //     n'y a rien entre deux plans, donc rien a fondre).
  const { dossier, duree: dPlans } = composerPlans(rush, travail, plans, ips);
  const brutPlans = join(travail, 'plans.mp4');
  ff(['-framerate', String(ips), '-i', join(dossier, 'p%06d.jpg'),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14',
      '-pix_fmt', 'yuv420p', brutPlans]);
  let horloge = dPlans;

  // 2 · la signature, portee a la meme cadence que le reste
  const morceaux = [brutPlans];
  if (fin) {
    const f = join(travail, 'plan-fin.mp4');
    ff(['-loop', '1', '-framerate', String(ips), '-t', String(fin.duree), '-i', fin.png,
        '-vf', `scale=${L}:${H},setsar=1,fps=${ips}`, '-c:v', 'libx264', '-preset', 'veryfast',
        '-crf', '14', '-pix_fmt', 'yuv420p', f]);
    morceaux.push(f);
    horloge += fin.duree;
  }

  // 3 · bout a bout
  const liste = join(travail, 'morceaux.txt');
  writeFileSync(liste, morceaux.map(f => `file '${f}'`).join('\n'));
  const brut = join(travail, 'assemble.mp4');
  ff(['-f', 'concat', '-safe', '0', '-i', liste, '-c', 'copy', brut]);
  const reperes = [];

  // 4 · les cartons se posent dessus
  const entrees = ['-i', brut];
  const filtres = [];
  let courant = '0:v';
  cartons.forEach((c, k) => {
    // Les fondus par defaut sont COURTS : une legende doit arriver et partir
    // sans qu'on l'attende. Mais un carton plein qui enchaine sur un autre
    // carton plein a besoin de temps, et un cinquieme de seconde y produit une
    // saute. D'ou `ouverture` / `fermeture`, reglables carton par carton — et
    // toujours plafonnes au tiers de la duree, sans quoi un fondu mangerait le
    // texte qu'il sert a montrer.
    const d = c.duree;
    const ouv = Math.min(c.ouverture ?? 0.22, d / 3);
    const ferm = Math.min(c.fermeture ?? 0.26, d / 3);
    entrees.push('-loop', '1', '-framerate', String(ips), '-t', String(d), '-i', c.png);
    filtres.push(
      `[${k + 1}:v]format=rgba,scale=${L}:${H},setsar=1,` +
      `fade=t=in:st=0:d=${ouv.toFixed(2)}:alpha=1,` +
      `fade=t=out:st=${(d - ferm).toFixed(2)}:d=${ferm.toFixed(2)}:alpha=1,` +
      `setpts=PTS+${c.de.toFixed(3)}/TB[c${k}]`);
    // L'entree par le bas : vingt-huit pixels de course sur un quart de
    // seconde. Assez pour que l'oeil voie arriver le texte, trop peu pour
    // qu'il attende la fin du mouvement avant de lire.
    const glisse = c.entree === 'fixe' ? '0'
      : `${c.entree === 'haut' ? '-' : ''}28*(1-min(1\\,(t-${c.de.toFixed(3)})/0.26))`;
    filtres.push(
      `[${courant}][c${k}]overlay=x=0:y='${glisse}':` +
      `enable='between(t,${c.de.toFixed(3)},${(c.de + d).toFixed(3)})':` +
      `eof_action=pass[v${k}]`);
    courant = `v${k}`;
  });

  // Le film se rend d'abord SANS son : c'est lui qu'on livre en version muette,
  // et c'est sur lui qu'on colle la piste. Encoder deux fois l'image pour
  // obtenir les deux versions serait payer deux fois le meme travail — et
  // laisser deux encodages divergents derriere soi.
  // Les bandes-son a poser. `son` reste accepte — c'est le cas d'une seule
  // piste, et les cinq reels de septembre l'utilisent.
  const bandes = pistes.length ? pistes : (son ? [{ suffixe: '', wav: son }] : []);
  const final = join(sortie, bandes.length ? `${nom}_muet.mp4` : `${nom}.mp4`);
  if (cartons.length) {
    // Le fondu au noir de la toute fin. Un reel BOUCLE : sans lui, la derniere
    // image de la signature saute directement au coup de pistolet de la
    // premiere, et la boucle se lit comme un accroc plutot que comme un
    // recommencement. Un tiers de seconde suffit a en faire un battement.
    const noir = fonduFin > 0
      ? `,fade=t=out:st=${(horloge - fonduFin).toFixed(3)}:d=${fonduFin.toFixed(2)}` : '';
    filtres.push(`[${courant}]format=yuv420p${noir}[out]`);
    ff([...entrees, '-filter_complex', filtres.join(';'), '-map', '[out]',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-profile:v', 'high',
        '-level', '4.0', '-movflags', '+faststart', '-r', String(ips), final]);
  } else {
    ff(['-i', brut, '-c:v', 'libx264', '-preset', 'slow', '-crf', '19',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', final]);
  }
  // Le son se colle en RECOPIANT l'image (`-c:v copy`) : la reencoder pour
  // ajouter une piste audio lui ferait perdre une generation pour rien.
  // `-shortest` coupe sur la plus courte des deux, ce qui est l'image : la
  // piste porte volontairement une queue, pour qu'aucun son ne soit tranche.
  const sonores = bandes.map(({ suffixe, wav }) => {
    const chemin = join(sortie, `${nom}${suffixe}.mp4`);
    ff(['-i', final, '-i', wav, '-map', '0:v:0', '-map', '1:a:0',
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
        '-shortest', '-movflags', '+faststart', chemin]);
    return chemin;
  });
  return { final: sonores[0] || final, muet: bandes.length ? final : null,
           sonores, duree: horloge, reperes };
}

/**
 * Le rush brut, tel qu'il a ete filme : meme cadence, meme cadre, aucun
 * recadrage, aucun carton. On le livre a cote du montage parce qu'un montage
 * se reprend, et qu'une capture, elle, ne se refait pas a l'identique.
 */
export function brut(rush, ips, chemin) {
  ff(['-framerate', String(ips), '-i', join(rush, 'f%06d.jpg'),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
      '-pix_fmt', 'yuv420p', '-movflags', '+faststart', chemin]);
  return chemin;
}

/** Une photo tiree du rush, recadree par PIL et ecrite en JPEG de qualite. */
export function photo(rush, ips, t, chemin, { zoom = 1, ancre = [0.5, 0.5] } = {}) {
  const i = Math.round(t * ips);
  const src = join(rush, `f${String(i).padStart(6, '0')}.jpg`);
  execFileSync('python3', ['-c', `
from PIL import Image
im = Image.open(${JSON.stringify(src)}).convert('RGB')
w, h = im.size
z, ax, ay = ${zoom}, ${ancre[0]}, ${ancre[1]}
fw, fh = w / z, h / z
g, ht = (w - fw) * ax, (h - fh) * ay
im.resize((${L}, ${H}), Image.LANCZOS, box=(g, ht, g + fw, ht + fh)) \
  .save(${JSON.stringify(chemin)}, quality=94, subsampling=0)
`]);
  return chemin;
}
