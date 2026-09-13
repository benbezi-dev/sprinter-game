/**
 * Le reel de la course en direct. 9:16, ~15 s.
 *
 * L'angle : l'immediatete. Le plan qui porte tout est l'arrivee — celle-ci
 * est un EX AEQUO au centieme, 9,26 s contre 9,26 s, sorti d'une vraie course
 * entre deux navigateurs. On ne pouvait pas l'ecrire ; on l'a filme.
 *
 * Le reel est court a dessein (la consigne dit 10-15 s) : la tension du
 * direct est une affaire de secondes, et un plan de plus la dilue.
 */
import { rendre, accroche, legende, chiffre, signature } from './cartons.mjs';
import { monter, photo, brut } from './monter.mjs';
import { marques, bornes } from './commun.mjs';
import { readFileSync } from 'node:fs';

const TRAVAIL = '/Volumes/MUSIQUE/BENBEZI/Sprinter/content/instagram/gameplay/_travail';
const RUSH    = `${TRAVAIL}/02-course-en-direct`;
const LIVRE   = '/Volumes/MUSIQUE/BENBEZI/Sprinter/content/instagram/gameplay';
const IPS = 30;
const M = marques(RUSH);
const F = JSON.parse(readFileSync(`${RUSH}/faits.json`, 'utf8'));
const s2 = ms => (ms / 1000).toFixed(2);

console.log('── reel 2 · course en direct ────────────────────────────────');
const png = await rendre([
  // La charte tient deja la formule, et elle est plus juste que « chaque
  // seconde compte » : ce qui est rare, ce n'est pas que le temps compte,
  // c'est qu'un seul pistolet parte pour deux telephones.
  accroche('a1', `Deux téléphones.<span class="fin">Un seul pistolet.</span>`),
  legende('l1', `On te présente sur la piste`, 1440),
  legende('l2', `Personne ne sait qui gagne`, 1440),
  chiffre('c1', `${s2(F.ecart_ms)} s`, `l’écart, à l’arrivée`, 1120),
  signature('fin', `Il reste un couloir.`),
], `${TRAVAIL}/_cartons/02`);
const C = Object.fromEntries(png.map(p => [p.split('/').pop().replace('.png',''), p]));

const plans = [
  // 1 · la piste ouverte : le code, et les deux couloirs a prendre.
  { de: M['piste-ouverte'] + 0.4,  a: M['piste-ouverte'] + 2.4,  zoom: [1.02, 1.14], ancre: [0.5, 0.42] },
  // 2 · la presentation des athletes, sur la piste.
  { de: M['presentation'] + 1.3,   a: M['presentation'] + 2.7,   zoom: [1.06, 1.16], ancre: [0.5, 0.56] },
  // 3 · le decompte, puis le pistolet.
  { de: M['arrivee'] - 12.7,       a: M['arrivee'] - 10.9,       zoom: [1.14, 1.02], ancre: [0.5, 0.42] },
  // 4 · les deux coureuses cote a cote, l'ecart a l'ecran.
  { de: M['arrivee'] - 8.3,        a: M['arrivee'] - 5.7,        zoom: [1.00, 1.10], ancre: [0.5, 0.46] },
  // 5 · la ligne.
  { de: M['arrivee'] - 2.7,        a: M['arrivee'] - 0.1,        zoom: [1.02, 1.16], ancre: [0.5, 0.50] },
  // 6 · ex aequo. Le plan pour lequel on a filme quatre prises.
  { de: M['resultat'] - 2.4,       a: M['resultat'] + 0.2,       zoom: [1.10, 1.30], ancre: [0.5, 0.26] },
];

const B = bornes(plans);
const cartons = [
  { png: C.a1, de: B[0].de + 0.10, duree: 1.90, entree: 'fondu' },
  { png: C.l1, de: B[1].de + 0.10, duree: 1.20, entree: 'bas' },
  { png: C.l2, de: B[3].de + 0.30, duree: 1.90, entree: 'bas' },
  { png: C.c1, de: B[5].de + 0.60, duree: 1.90, entree: 'bas' },
];

const { final, duree } = monter({
  nom: 'sprinter_course-en-direct_reel_v1', rush: RUSH, ips: IPS, plans, cartons,
  fin: { png: C.fin, duree: 1.9 },
  travail: `${TRAVAIL}/_montage/02`, sortie: LIVRE,
});
console.log(`   ${final.split('/').pop()}  ·  ${duree.toFixed(1)} s`);

photo(RUSH, IPS, M['resultat'] - 1.2, `${LIVRE}/sprinter_course-en-direct_cover_v1.jpg`, { zoom: 1.24, ancre: [0.5, 0.26] });
photo(RUSH, IPS, M['arrivee'] - 1.4, `${LIVRE}/sprinter_course-en-direct_moment_v1.jpg`, { zoom: 1.12, ancre: [0.5, 0.48] });
brut(RUSH, IPS, `${LIVRE}/sprinter_course-en-direct_raw_v1.mp4`);
console.log('   photos et rush brut ecrits');
