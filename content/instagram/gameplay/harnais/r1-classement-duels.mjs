/**
 * Le reel du classement des duels. 9:16, ~19 s.
 *
 * L'angle : la reconnaissance. On ne montre pas « un mode duel », on montre
 * une ligne qui remonte — 6e, puis 3e — parce que c'est la seule chose qui
 * donne envie d'en lancer un.
 *
 * La voix est celle de la charte : present partout, le chiffre avant
 * l'adjectif, et une derniere ligne qui CONSTATE qu'une place est libre au
 * lieu de reclamer quoi que ce soit.
 */
import { rendre, accroche, legende, chiffre, signature } from './cartons.mjs';
import { monter, photo, brut } from './monter.mjs';
import { marques, bornes } from './commun.mjs';
import { readFileSync } from 'node:fs';

const TRAVAIL = '/Volumes/MUSIQUE/BENBEZI/Sprinter/content/instagram/gameplay/_travail';
const RUSH    = `${TRAVAIL}/01-classement-duels`;
const LIVRE   = '/Volumes/MUSIQUE/BENBEZI/Sprinter/content/instagram/gameplay';
const IPS = 30;
const M = marques(RUSH);
// Les chiffres des cartons viennent de ce que le SERVEUR a enregistre, pas
// d'une valeur recopiee a la main : un carton qui annonce un chrono que
// l'image ne montre pas est exactement le genre de detail qu'un lecteur
// verifie tout seul.
const F = JSON.parse(readFileSync(`${RUSH}/faits.json`, 'utf8'));
const s2 = ms => (ms / 1000).toFixed(2);

console.log('── reel 1 · classement des duels ────────────────────────────');
const png = await rendre([
  accroche('a1', `Il te défie.<span class="fin">Tu réponds.</span>`),
  legende('l1', `Tu prends le <span class="or">3<sup>e</sup></span> du classement`, 1400),
  legende('l2', `Ton chrono est posé`, 1460),
  chiffre('c1', `${s2(F.kenza_ms)} s`, `100 mètres`, 1000),
  chiffre('c2', `${s2(F.ecart_ms)} s`, `l’écart, à l’arrivée`, 1520),
  legende('l3', `<span class="mono">6<sup>e</sup> → 3<sup>e</sup></span> au classement`, 1200),
  signature('fin', `Il reste de la place<br>au-dessus.`),
], `${TRAVAIL}/_cartons/01`);
const C = Object.fromEntries(png.map(p => [p.split('/').pop().replace('.png',''), p]));

const plans = [
  // 1 · l'accroche, sur le tableau : on est 6e, et le 3e a un nom.
  { de: M['classement-avant'] + 0.6, a: M['epee-omar'],       zoom: [1.00, 1.12], ancre: [0.5, 0.36] },
  // 2 · l'epee. Le geste dure une seconde, on ne l'etire pas.
  { de: M['epee-omar'],              a: M['depart'] - 0.1,    zoom: [1.24, 1.32], ancre: [0.5, 0.74] },
  // 3 · le coup de pistolet.
  { de: M['depart'] + 2.8,           a: M['depart'] + 4.3,    zoom: [1.12, 1.02], ancre: [0.5, 0.46] },
  // 4 · la course, plein cadre, sans un mot dessus.
  { de: M['arrivee'] - 4.2,          a: M['arrivee'] - 1.1,   zoom: [1.00, 1.09], ancre: [0.5, 0.50] },
  // 5 · le chrono.
  { de: M['arrivee'] + 0.8,          a: M['arrivee'] + 2.9,   zoom: [1.14, 1.30], ancre: [0.5, 0.27] },
  // 6 · il a repondu, et il a perdu.
  // On pousse sur les DEUX chronos cote a cote : c'est la seule image ou
  // l'ecart se lit, et le carton se pose juste en dessous.
  { de: M['duel-gagne'] + 0.9,       a: M['duel-gagne'] + 4.3, zoom: [1.14, 1.42], ancre: [0.5, 0.42] },
  // 7 · la ligne remonte. C'est le plan que le reel existe pour montrer.
  { de: M['classement-monte'] - 0.5, a: M['classement-monte'] + 3.3, zoom: [1.10, 1.32], ancre: [0.5, 0.35] },
];

const B = bornes(plans);
const cartons = [
  { png: C.a1, de: B[0].de + 0.10, duree: 2.10, entree: 'fondu' },
  { png: C.l1, de: B[1].de,        duree: 1.05, entree: 'bas' },
  { png: C.l2, de: B[3].de + 0.30, duree: 1.70, entree: 'bas' },
  { png: C.c1, de: B[4].de + 0.20, duree: 1.90, entree: 'bas' },
  { png: C.c2, de: B[5].de + 0.60, duree: 2.60, entree: 'bas' },
  { png: C.l3, de: B[6].de + 1.10, duree: 2.50, entree: 'bas' },
];

const { final, duree } = monter({
  nom: 'sprinter_classement-duels_reel_v1', rush: RUSH, ips: IPS, plans, cartons,
  fin: { png: C.fin, duree: 2.2 },
  travail: `${TRAVAIL}/_montage/01`, sortie: LIVRE,
});
console.log(`   ${final.split('/').pop()}  ·  ${duree.toFixed(1)} s`);

// Les deux photos : la couverture est la ligne qui vient de passer ; le
// moment fort, la fenetre du duel avec les deux chronos cote a cote.
photo(RUSH, IPS, M['classement-monte'] + 2.6, `${LIVRE}/sprinter_classement-duels_cover_v1.jpg`, { zoom: 1.28, ancre: [0.5, 0.34] });
photo(RUSH, IPS, M['duel-gagne'] + 3.0, `${LIVRE}/sprinter_classement-duels_moment_v1.jpg`, { zoom: 1.14, ancre: [0.5, 0.40] });
brut(RUSH, IPS, `${LIVRE}/sprinter_classement-duels_raw_v1.mp4`);
console.log('   photos et rush brut ecrits');
