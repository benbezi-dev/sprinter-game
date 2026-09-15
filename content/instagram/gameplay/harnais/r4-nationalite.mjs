/**
 * Le reel de la nationalite. 9:16, ~21 s.
 *
 * Deux temps, comme la consigne le demande : LE CHOIX, puis CE QU'IL CHANGE.
 * Le premier tient en trois plans (la liste, le drapeau qui se pose, le
 * cadenas) ; le second en deux (la carte d'identite qui dit a quoi il sert,
 * et la ligne du classement qui le porte au milieu des autres pays).
 *
 * Un mot sur le ton : le jeu dit lui-meme « facultatif, et definitif ». On ne
 * l'enjolive pas — c'est ce qui donne du poids au geste, et le cacher serait
 * vendre un choix qu'on ne peut pas reprendre.
 */
import { rendre, accroche, legende, signature } from './cartons.mjs';
import { monter, photo, brut } from './monter.mjs';
import { marques, bornes } from './commun.mjs';

const TRAVAIL = '/Volumes/MUSIQUE/BENBEZI/Sprinter/content/instagram/gameplay/_travail';
const RUSH    = `${TRAVAIL}/04-nationalite`;
const LIVRE   = '/Volumes/MUSIQUE/BENBEZI/Sprinter/content/instagram/gameplay';
const IPS = 30;
const M = marques(RUSH);

console.log('── reel 4 · nationalité ─────────────────────────────────────');
const png = await rendre([
  accroche('a1', `Ton drapeau.<br>Ton camp.<span class="fin">Ta place à défendre.</span>`),
  legende('l1', `Facultatif <span class="or">·</span> et définitif`, 1400),
  legende('l2', `Tu cours pour la France`, 1400),
  legende('l3', `Il décide de ton championnat national`, 1400),
  legende('l4', `Ton drapeau te suit au classement`, 1400),
  signature('fin', `Un drapeau reste<br>à défendre.`),
], `${TRAVAIL}/_cartons/04`);
const C = Object.fromEntries(png.map(p => [p.split('/').pop().replace('.png',''), p]));

const plans = [
  // 1 · la liste des pays, et la phrase qui engage.
  { de: M['bienvenue-pays'] + 0.4,  a: M['bienvenue-pays'] + 3.4,  zoom: [1.04, 1.16], ancre: [0.5, 0.30] },
  // 2 · les drapeaux defilent : Cote d'Ivoire, Senegal, Maroc, France.
  { de: M['france-choisie'] - 2.8,  a: M['france-choisie'] + 0.2,  zoom: [1.30, 1.40], ancre: [0.5, 0.26] },
  // 3 · la carte d'identite : le drapeau pose, FERME (le cadenas), et la
  //     phrase du jeu qui dit a quoi il sert. C'est le plan du « deuxieme
  //     temps » — il porte deux cartons, donc il dure.
  //     (L'instant qui suit immediatement le choix ne montre rien : le
  //     panneau enchaine aussitot sur Instagram, et le drapeau n'y reste pas
  //     a l'ecran assez longtemps pour faire un plan.)
  { de: M['carte-identite'] + 0.4,  a: M['carte-identite'] + 5.2,  zoom: [1.08, 1.30], ancre: [0.5, 0.22] },
  // 4 · le classement, huit pays sur la meme page.
  { de: M['classement-drapeaux'] + 0.4, a: M['classement-drapeaux'] + 4.2, zoom: [1.04, 1.20], ancre: [0.5, 0.62] },
  // 5 · sa ligne a lui, drapeau compris.
  { de: M['sa-ligne'] + 0.2,        a: M['sa-ligne'] + 3.0,        zoom: [1.18, 1.34], ancre: [0.5, 0.55] },
];

const B = bornes(plans);
const cartons = [
  { png: C.a1, de: B[0].de + 0.10, duree: 2.20, entree: 'fondu' },
  { png: C.l1, de: B[1].de + 0.20, duree: 1.90, entree: 'bas' },
  { png: C.l2, de: B[2].de + 0.30, duree: 1.90, entree: 'bas' },
  { png: C.l3, de: B[2].de + 2.60, duree: 2.40, entree: 'bas' },
  { png: C.l4, de: B[3].de + 0.40, duree: 2.40, entree: 'bas' },
];

const { final, duree } = monter({
  nom: 'sprinter_nationalite_reel_v1', rush: RUSH, ips: IPS, plans, cartons,
  fin: { png: C.fin, duree: 2.4 },
  travail: `${TRAVAIL}/_montage/04`, sortie: LIVRE,
});
console.log(`   ${final.split('/').pop()}  ·  ${duree.toFixed(1)} s`);

photo(RUSH, IPS, M['carte-identite'] + 3.4, `${LIVRE}/sprinter_nationalite_cover_v1.jpg`, { zoom: 1.24, ancre: [0.5, 0.22] });
photo(RUSH, IPS, M['sa-ligne'] + 1.6, `${LIVRE}/sprinter_nationalite_moment_v1.jpg`, { zoom: 1.24, ancre: [0.5, 0.55] });
brut(RUSH, IPS, `${LIVRE}/sprinter_nationalite_raw_v1.mp4`);
console.log('   photos et rush brut ecrits');
