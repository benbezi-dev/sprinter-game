/**
 * Le reel du relais 4 × 100. 9:16, ~19 s.
 *
 * L'angle : l'equipe. Ce qui se raconte n'est pas « il y a un mode relais »,
 * c'est qu'on ne court plus seul — on monte une equipe, on lui donne un
 * ordre, et le temoin passe de main en main entre quatre telephones.
 *
 * Cette prise est la premiere ou la course du relais a pu etre filmee : les
 * trois passages sont notes « correct », l'equipe remonte de la 8e a la 2e
 * place, et boucle en 42,91 s.
 */
import { rendre, accroche, legende, chiffre, signature } from './cartons.mjs';
import { monter, photo, brut } from './monter.mjs';
import { marques, bornes } from './commun.mjs';

const TRAVAIL = '/Volumes/MUSIQUE/BENBEZI/Sprinter/content/instagram/gameplay/_travail';
const RUSH    = `${TRAVAIL}/03-relais-4x100`;
const LIVRE   = '/Volumes/MUSIQUE/BENBEZI/Sprinter/content/instagram/gameplay';
const IPS = 30;
const M = marques(RUSH);
const BOUCLE = 132.4;   // l'ecran « LE RELAIS EST BOUCLÉ », releve sur la planche

console.log('── reel 3 · relais 4 × 100 ──────────────────────────────────');
const png = await rendre([
  accroche('a1', `Seul on sprinte.<span class="fin">En équipe on gagne.</span>`),
  legende('l1', `Quatre noms <span class="or">·</span> une équipe`, 1420),
  legende('l2', `Tu fixes l’ordre des relayeurs`, 1420),
  legende('l3', `Le témoin se passe <span class="or">à deux</span>`, 1500),
  legende('l4', `<span class="mono">8<sup>e</sup> → 2<sup>e</sup></span> sur la piste`, 1500),
  legende('c1', `Quatre coureurs <span class="or">·</span> un seul chrono`, 1560),
  signature('fin', `Il manque toujours<br>un relayeur.`),
], `${TRAVAIL}/_cartons/03`);
const C = Object.fromEntries(png.map(p => [p.split('/').pop().replace('.png',''), p]));

const plans = [
  // 1 · monter l'equipe : le nom, les trois coequipiers.
  { de: M['equipe-saisie'] - 1.5, a: M['equipe-saisie'] + 0.9, zoom: [1.10, 1.24], ancre: [0.5, 0.62] },
  // 2 · l'equipe complete, dans l'ordre, prete a entrer.
  { de: M['equipe-prete'] + 0.7,  a: M['equipe-prete'] + 2.7,  zoom: [1.12, 1.26], ancre: [0.5, 0.60] },
  // 3 · le vestiaire : quatre noms sur la piste, un bouton chacun.
  { de: M['vestiaire'] + 0.4,     a: M['vestiaire'] + 2.4,     zoom: [1.06, 1.20], ancre: [0.5, 0.44] },
  // 4 · le pistolet. Un faux depart eliminerait les quatre.
  { de: M['depart'] + 0.4,        a: M['depart'] + 2.0,        zoom: [1.12, 1.02], ancre: [0.5, 0.42] },
  // 5 · le premier passage de temoin.
  { de: M['passe-1'] - 1.5,       a: M['passe-1'] + 0.9,       zoom: [1.04, 1.22], ancre: [0.5, 0.46] },
  // 6 · le troisieme, et la remontee du peloton.
  { de: M['passe-3'] - 1.2,       a: M['passe-3'] + 1.0,       zoom: [1.04, 1.22], ancre: [0.5, 0.46] },
  // 7 · la fin de course : l'equipe passe de la 8e a la 2e place.
  { de: 128.4,                    a: 131.0,                    zoom: [1.00, 1.14], ancre: [0.5, 0.46] },
  // 8 · le relais est boucle, et les trois passages sont notes.
  { de: BOUCLE + 0.7,             a: BOUCLE + 3.4,             zoom: [1.06, 1.22], ancre: [0.5, 0.40] },
];

const B = bornes(plans);
const cartons = [
  { png: C.a1, de: B[0].de + 0.10, duree: 2.10, entree: 'fondu' },
  { png: C.l1, de: B[1].de + 0.30, duree: 2.10, entree: 'bas' },
  { png: C.l3, de: B[4].de + 0.30, duree: 2.00, entree: 'bas' },
  { png: C.l4, de: B[6].de + 0.20, duree: 2.10, entree: 'bas' },
  { png: C.c1, de: B[7].de + 0.60, duree: 2.10, entree: 'bas' },
];

const { final, duree } = monter({
  nom: 'sprinter_relais_reel_v1', rush: RUSH, ips: IPS, plans, cartons,
  fin: { png: C.fin, duree: 2.1 },
  travail: `${TRAVAIL}/_montage/03`, sortie: LIVRE,
});
console.log(`   ${final.split('/').pop()}  ·  ${duree.toFixed(1)} s`);

// La carte d'equipe du panneau depasse du cadre : le quatrieme relayeur et le
// bouton tombent sous la ligne de flottaison. Le VESTIAIRE de la piste porte
// les memes quatre noms, centres, et sur la piste — c'est la meilleure image
// des « membres de l'equipe » que le jeu produise.
photo(RUSH, IPS, M['vestiaire'] + 1.5, `${LIVRE}/sprinter_relais_cover_v1.jpg`, { zoom: 1.10, ancre: [0.5, 0.46] });
photo(RUSH, IPS, BOUCLE + 3.0, `${LIVRE}/sprinter_relais_moment_v1.jpg`, { zoom: 1.18, ancre: [0.5, 0.40] });
brut(RUSH, IPS, `${LIVRE}/sprinter_relais_raw_v1.mp4`);
console.log('   photos et rush brut ecrits');
