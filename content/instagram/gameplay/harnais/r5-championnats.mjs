/**
 * Le reel des championnats. 9:16, ~24 s.
 *
 * L'angle : le statut. Ce qui se raconte n'est pas « il y a des
 * championnats », c'est qu'un weekend se deroule tout seul — series,
 * repechages, demi-finales, finale — et qu'au bout il y a un titre, un
 * podium, et une medaille qui reste accrochee au nom.
 *
 * Le reel est un peu plus long que les autres parce que la fonctionnalite
 * l'est : une competition a des etages, et les montrer est le sujet.
 */
import { rendre, accroche, legende, chiffre, signature } from './cartons.mjs';
import { monter, photo, brut } from './monter.mjs';
import { marques, bornes } from './commun.mjs';
import { readFileSync } from 'node:fs';

const TRAVAIL = '/Volumes/MUSIQUE/BENBEZI/Sprinter/content/instagram/gameplay/_travail';
const RUSH    = `${TRAVAIL}/05-championnats`;
const LIVRE   = '/Volumes/MUSIQUE/BENBEZI/Sprinter/content/instagram/gameplay';
const IPS = 30;
const M = marques(RUSH);
const F = JSON.parse(readFileSync(`${RUSH}/faits.json`, 'utf8'));

console.log('── reel 5 · championnats ────────────────────────────────────');
const png = await rendre([
  accroche('a1', `Il y a un championnat<br>pour toi.<span class="fin">Trouve le tien.</span>`),
  legende('l1', `Séries <span class="or">·</span> demies <span class="or">·</span> finale`, 1500),
  legende('l2', `Les repêchés sortent du chrono`, 1560),
  legende('l3', `<span class="mono">${F.nationaux}</span> nationaux le même samedi`, 1500),
  chiffre('c1', `9.255 s`, `la finale`, 700),
  legende('l4', `Le titre se porte trois mois`, 1560),
  legende('l5', `La médaille reste sur ton nom`, 1420),
  signature('fin', `Il y a un titre<br>à prendre.`),
], `${TRAVAIL}/_cartons/05`);
const C = Object.fromEntries(png.map(p => [p.split('/').pop().replace('.png',''), p]));

const plans = [
  // 1 · le panneau : le nom du championnat, les trois etages, le compte a rebours.
  { de: 0.6,                      a: 3.4,                        zoom: [1.06, 1.22], ancre: [0.5, 0.66] },
  // 2 · les series tombent.
  { de: M['phase-1'] + 0.5,       a: M['phase-1'] + 2.9,         zoom: [1.18, 1.30], ancre: [0.5, 0.74] },
  // 3 · les repeches. Un ecran a part, et le plus beau du lot.
  { de: M['phase-1'] + 5.0,       a: M['phase-1'] + 8.0,         zoom: [1.04, 1.16], ancre: [0.5, 0.42] },
  // 4 · les demi-finales.
  { de: M['phase-2'] + 0.6,       a: M['phase-2'] + 3.0,         zoom: [1.18, 1.30], ancre: [0.5, 0.74] },
  // 5 · la finale, chronos a l'appui.
  { de: M['phase-3'] + 0.6,       a: M['phase-3'] + 3.2,         zoom: [1.16, 1.32], ancre: [0.5, 0.76] },
  // 6 · le sacre s'annonce.
  { de: M['finale-courue'] + 0.4, a: M['finale-courue'] + 2.6,   zoom: [1.14, 1.26], ancre: [0.5, 0.68] },
  // 7 · le podium. Le plan qui porte le reel.
  { de: M['podium'] + 0.5,        a: M['podium'] + 4.5,          zoom: [1.02, 1.18], ancre: [0.5, 0.46] },
  // 8 · ce qu'il en reste : une medaille sur la ligne du classement.
  // L'ancre descend jusqu'a SA ligne : la medaille est sur la sienne, pas sur
  // celles du haut du tableau.
  { de: M['medaille'] + 0.4,      a: M['medaille'] + 2.8,        zoom: [1.20, 1.34], ancre: [0.5, 0.80] },
];

const B = bornes(plans);
const cartons = [
  { png: C.a1, de: B[0].de + 0.10, duree: 2.50, entree: 'fondu' },
  { png: C.l1, de: B[1].de + 0.20, duree: 2.00, entree: 'bas' },
  { png: C.l2, de: B[2].de + 0.40, duree: 2.30, entree: 'bas' },
  { png: C.l3, de: B[3].de + 0.30, duree: 2.00, entree: 'bas' },
  { png: C.c1, de: B[4].de + 0.40, duree: 2.20, entree: 'bas' },
  { png: C.l4, de: B[6].de + 1.60, duree: 2.30, entree: 'bas' },
  { png: C.l5, de: B[7].de + 0.30, duree: 2.10, entree: 'bas' },
];

const { final, duree } = monter({
  nom: 'sprinter_championnats_reel_v1', rush: RUSH, ips: IPS, plans, cartons,
  fin: { png: C.fin, duree: 2.3 },
  travail: `${TRAVAIL}/_montage/05`, sortie: LIVRE,
});
console.log(`   ${final.split('/').pop()}  ·  ${duree.toFixed(1)} s`);

photo(RUSH, IPS, M['podium'] + 3.0, `${LIVRE}/sprinter_championnats_cover_v1.jpg`, { zoom: 1.14, ancre: [0.5, 0.46] });
photo(RUSH, IPS, M['phase-3'] + 2.8, `${LIVRE}/sprinter_championnats_moment_v1.jpg`, { zoom: 1.26, ancre: [0.5, 0.76] });
brut(RUSH, IPS, `${LIVRE}/sprinter_championnats_raw_v1.mp4`);
console.log('   photos et rush brut ecrits');
