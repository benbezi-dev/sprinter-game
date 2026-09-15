/**
 * L'ARRIVEE SERREE — un reel 9:16, une vingtaine de secondes, en francais.
 *
 *     node t2-arrivee-serree.mjs              # francais
 *     LANGUE=en node t2-arrivee-serree.mjs    # anglais, sur le rush anglais de f7
 *
 * LE RESSORT. Celui des publicites de jeux qui montrent une faute evidente :
 * le coureur filme MENE, leve les doigts avant la ligne et se fait reprendre
 * d'un rien. Le spectateur voit la faute avant le resultat — « mais appuie
 * jusqu'au bout ! » — et c'est cette faute, plus que le jeu, qui lui donne
 * envie d'essayer.
 *
 * ON NE DEMANDE RIEN (consigne du 15 septembre). Les joueurs potentiels sont
 * deja la ; on les attire, on ne les supplie pas. Aucune question au
 * spectateur, aucun « viens jouer », aucun « il nous manque ». Les cartons
 * CONSTATENT — il mene, il lache, 0,01 s — et la provocation vient de la
 * faute elle-meme : « Il suffisait d'appuyer. » La signature affirme le jeu,
 * elle n'invite pas.
 *
 * CE QUE LE FILM NE FAIT PAS, et c'est la difference avec ces publicites-la.
 *   · Pas de fausse image : c'est le vrai jeu, une vraie course en direct,
 *     deux telephones et un seul coup de pistolet. Seul le relachement est
 *     ecrit — voir f6-arrivee-serree.mjs.
 *   · Pas de statistique inventee. « 99 % des gens echouent » serait un
 *     chiffre, et aucun n'est mesure : les cartons ne disent que ce qui se
 *     voit ou se chronometre.
 *
 * LE RUSH : `_travail/06-arrivee-serree`, filme par f6. Les fenetres de plans
 * sont calees sur les REPERES de la camera (depart, relache, resultat) et sur
 * `faits.json`. Deux valeurs de `faits.json` sont RELEVEES a l'image et non
 * mesurees par le harnais — l'image ou la ligne passe sous le vainqueur
 * (`ligne_t`) et l'ecart que l'ecran de resultat affiche (`ecart_affiche_ms`) ;
 * chacune dit d'ou elle vient. Un autre rush demande de les relever a nouveau.
 */
import { rendre, legende, chiffre, signature } from './cartons.mjs';
import { monter } from './monter.mjs';
import { marques, bornes } from './commun.mjs';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const TRAVAIL = '/Volumes/MUSIQUE/BENBEZI/Sprinter/content/instagram/gameplay/_travail';
// v2 : un duel contre un FANTOME (f7), et non plus une course en direct
// (f6). En direct, le jeu affiche l'adversaire avec du retard, et la v1
// montrait TOI passer la ligne en premier d'une course perdue de 0,01 s.
// Chaque langue a SON rush : les mots sont dans l'image (« DÉFI PERDU » /
// « CHALLENGE LOST »), et un carton anglais sur un ecran francais serait un
// sous-titre qui le contredit.
const LANGUE = process.env.LANGUE === 'en' ? 'en' : 'fr';
const EN = LANGUE === 'en';
const RUSH = process.env.RUSH || `${TRAVAIL}/07-fantome-serre${EN ? '-en' : ''}`;
const LIVRE = '/Volumes/MUSIQUE/BENBEZI/Sprinter/content/instagram/gameplay';
const NOM = process.env.NOM || `sprinter_arrivee-serree_reel_${EN ? 'en_' : ''}v2`;
const IPS = 30;
const M = marques(RUSH);
const F = JSON.parse(readFileSync(`${RUSH}/faits.json`, 'utf8'));

// L'ecart est celui que l'ECRAN DU JEU affiche (« 0.01 s d'écart ») : il se
// calcule sur les millisecondes, et la difference des deux chronos arrondis
// (9.37 - 9.35) donnerait 0,02 — le film contredirait l'ecran qu'il montre.
// Ecrit a la virgule : c'est un nombre du film, pas une recopie de l'ecran.
// Un ecran qui affiche un ecart NUL (« GAP: 0.00 S ») sur une course perdue
// dit que l'ecart reel est sous le centieme : le carton ecrit « < 0.01 »,
// vrai, plutot que « 0.00 », qui se lirait comme une erreur, ou « 0.01 », que
// l'ecran dementirait.
const ECART = F.ecart_affiche_ms === 0 ? `&lt; ${EN ? '0.01' : '0,01'}`
  : (Math.abs(F.ecart_affiche_ms ?? F.ecart_ms) / 1000).toFixed(2).replace('.', EN ? '.' : ',');
const PERDUE = F.perdue;

// Les instants du rush, en secondes. L'arrivee de chacun se deduit du depart
// et de son chrono : le jeu chronometre depuis le coup de pistolet.
const DEPART = M.depart;
const ARRIVEE_CAM = DEPART + F.moi_ms / 1000;
const ARRIVEE_RIV = DEPART + F.lui_ms / 1000;
// Le repere « depart » tombe environ 0,08 s apres le vrai coup de pistolet
// (le harnais le pose quand le voile du decompte a disparu) : l'image ou la
// ligne passe sous le vainqueur se RELEVE donc, `ligne_t`, plutot que de se
// deduire des chronos.
const LIGNE = F.ligne_t ?? Math.min(ARRIVEE_CAM, ARRIVEE_RIV);

// L'or se pose avec un `b` et non un `span` : la regle `.legende span` du
// gabarit vise les DESCENDANTS, et un mot en or devenait une plaque dans la
// plaque.
const T = {
  fr: {
    accroche: F.mode === 'defi-fantome' ? `Duel<br><b class="or">contre un fantôme</b>`
                                         : `1 contre 1<br><b class="or">en direct</b>`,
    // Ce que le panneau du jeu dit, et seulement quand il le dit. Sur le rush
    // du fantome VOLT part DERRIERE (-0,2 m) et ne passe au vert que vers
    // depart + 2 s : « depuis le depart » serait faux. « Plus de 2 m » est vrai
    // de `mene_depuis_t` jusqu'au relachement — et un chiffre au dixieme se
    // ferait dementir, le panneau oscillant d'un dixieme a l'autre.
    mene:     F.mene_depuis_t != null ? `Il mène<br><b class="or">de plus de ${F.mene_m} m</b>`
                                      : `Il mène<br><b class="or">depuis le départ</b>`,
    lache:    `Il lâche<br><b class="or">avant la ligne</b>`,
    photo:    `Photo-finish`,
    ecart:    `d'écart`,
    appuyer:  `Il suffisait d'appuyer.`,
    fin:      `Ici, tout se joue<br>au centième.`,
  },
  en: {
    accroche: `Duel<br><b class="or">against a ghost</b>`,
    mene:     F.mene_depuis_t != null ? `He leads<br><b class="or">by more than ${F.mene_m} m</b>`
                                      : `He leads<br><b class="or">from the start</b>`,
    lache:    `He lets go<br><b class="or">before the line</b>`,
    photo:    `Photo finish`,
    ecart:    `margin`,
    appuyer:  `He just had to keep tapping.`,
    fin:      `Here, it all comes down<br>to a hundredth.`,
  },
}[LANGUE];

console.log(`── reel · arrivee serree · ${LANGUE.toUpperCase()} · ${F.camera} contre ${F.adversaire} · ` +
            `${PERDUE ? 'perdue' : 'non perdue'} de ${ECART} s ─────────`);
// Les cartons de course se posent SOUS les coureurs, a 1 250 px. En haut de
// l'ecran du jeu il y a le panneau d'ecart — « +2,5 m », vert, qui fond apres
// le relachement — et c'est lui la preuve de la faute : un carton pose dessus
// cachait exactement ce qu'il annoncait.
const BAS = 1250;
const png = await rendre([
  legende('a1', T.accroche, BAS),
  legende('l1', T.mene, BAS),
  legende('l2', T.lache, BAS),
  legende('l3', T.photo, 290),
  chiffre('c1', `${ECART} s`, T.ecart, 1400),
  legende('l4', T.appuyer, 1480),
  signature('fin', T.fin),
], `${TRAVAIL}/_cartons/t2-fr-${NOM.split('_').pop()}`);
const C = Object.fromEntries(png.map(p => [p.split('/').pop().replace('.png', ''), p]));

/**
 * Cinq plans, et la course n'est jamais coupee.
 *
 *   1 · le dernier chiffre du decompte — « MODE FANTÔME », c'est l'ecran du
 *       jeu — et le coup de pistolet ;
 *   2 · la course, d'un seul tenant jusqu'au relachement : couper dans neuf
 *       secondes de course ferait sauter les positions, et c'est l'ecart
 *       entre les deux qu'on regarde ;
 *   3 · le RALENTI, qui commence juste avant que les doigts se levent et va
 *       jusqu'a la ligne. Ce n'est pas une rediffusion : le film ralentit au
 *       moment ou tout se joue, sans rien montrer deux fois ;
 *   4 · la ligne, FIGEE : la photo-finish, et l'ecart en or ;
 *   5 · l'ecran de resultat du jeu, serre sur les deux chronos — la preuve.
 *
 * LE PANNEAU D'ECART RESTE DANS LE CADRE. C'est lui qui montre la faute : vert
 * « +3,0 m » tant qu'il mene, puis qui fond. Il est en haut de l'ecran du jeu
 * (10 a 15 % de la hauteur) ; les poussees sont donc bornees et ancrees haut
 * pour ne jamais le couper.
 */
const HAUT = 0.28;                       // l'ancre verticale des plans de course
const plans = [
  { de: DEPART - 0.9, a: DEPART + 1.4, zoom: [1.02, 1.06], ancre: [0.5, 0.42] },
  { de: DEPART + 1.4, a: M.relache - 0.35, zoom: [1.06, 1.14], ancre: [0.45, HAUT] },
  { de: M.relache - 0.35, a: LIGNE + 0.05, vitesse: 0.5,
    zoom: [1.14, 1.26], ancre: [0.43, HAUT] },
  // La photo-finish entre par une POUSSEE SECHE (1,26 → 1,55) et se fige :
  // c'est le geste de la retransmission. Le cadre, decale a gauche, garde les
  // deux anneaux et la bande d'arrivee, et laisse hors champ la pastille de
  // droite du jeu (l'ecart a un coureur de l'ordinateur, sans rapport ici).
  { de: LIGNE, a: LIGNE, vitesse: 0, duree: 1.9,
    zoom: [1.55, 1.62], ancre: [0.25, 0.35] },
  // Le resultat, assez large pour tout lire : « DÉFI PERDU », « ÉCART :
  // 0.01 S », « TU DESCENDS EN NATIONAL II », le mot du vainqueur et « PRENDRE
  // MA REVANCHE ». Plus serre, le cadre coupait les noms au bord gauche.
  { de: M.resultat + 0.3, a: M.resultat + 3.1, zoom: [1.04, 1.08], ancre: [0.5, 0.12] },
];
const B = bornes(plans);

// Les cartons, poses sur les bornes des plans et sur les reperes : « il lache »
// tombe a l'image ou les doigts se levent — 0,35 s de rush avant le relachement,
// joues a mi-vitesse, font 0,7 s de film.
const tRelache = B[2].de + 0.35 / plans[2].vitesse;
// L'entree de « il mene de plus de 2 m » : l'image ou le panneau le dit.
const tMene = F.mene_depuis_t != null ? B[1].de + (F.mene_depuis_t - plans[1].de) : B[1].de + 1.8;
const cartons = [
  { nom: 'a1', png: C.a1, de: B[0].de + 0.05, duree: B[1].de - B[0].de + 1.0, entree: 'fondu' },
  { nom: 'l1', png: C.l1, de: tMene, duree: B[2].de + 0.3 - tMene, entree: 'bas' },
  { nom: 'l2', png: C.l2, de: tRelache - 0.1, duree: B[2].a - tRelache + 0.1, entree: 'bas' },
  { nom: 'l3', png: C.l3, de: B[3].de, duree: B[3].a - B[3].de, entree: 'fixe', ouverture: 0.08 },
  { nom: 'c1', png: C.c1, de: B[3].de + 0.3, duree: B[3].a - B[3].de - 0.3, entree: 'bas' },
  // Sur l'ecran du jeu qui dit « COURSE PERDUE » : le constat qui fait dire
  // au spectateur « c'etait pourtant simple ».
  { nom: 'l4', png: C.l4, de: B[4].de + 0.5, duree: B[4].a - B[4].de - 0.5, entree: 'bas' },
];

const FIN_SIGNATURE = 2.6;
const dureeFilm = B[B.length - 1].a + FIN_SIGNATURE;
const DOSSIER = `${TRAVAIL}/_montage/t2-fr-${NOM.split('_').pop()}`;
mkdirSync(DOSSIER, { recursive: true });

// La bande-son de la maison : ses impacts tombent sur les coupes, et sa seule
// respiration — ou tout tombe sauf la basse — tombe sur le RALENTI. C'est le
// moment ou le film retient son souffle, et la musique avec lui.
const WAV = `${DOSSIER}/bande-son.wav`;
const spec = `${DOSSIER}/musique.json`;
writeFileSync(spec, JSON.stringify({
  sortie: WAV, duree: Number(dureeFilm.toFixed(3)),
  coupes: B.slice(1).map(b => Number(b.de.toFixed(3))),
  date: Number(B[2].de.toFixed(3)),
  signature: Number(B[B.length - 1].a.toFixed(3)),
  voix: null,
}, null, 1));
console.log('   bande-son…');
execFileSync('python3', [new URL('./musique.py', import.meta.url).pathname, spec],
             { stdio: ['ignore', 'ignore', 'inherit'] });

const { muet, sonores, duree } = monter({
  nom: NOM, rush: RUSH, ips: IPS, plans, cartons,
  fin: { png: C.fin, duree: FIN_SIGNATURE }, fonduFin: 0.35,
  pistes: [{ suffixe: '', wav: WAV }],
  travail: DOSSIER, sortie: LIVRE,
});
console.log(`   ${sonores[0].split('/').pop()}  ·  musique  ·  ${duree.toFixed(1)} s`);
console.log(`   ${muet.split('/').pop()}  ·  muet`);
console.log('   plans : ' + B.map((b, i) => `${i + 1} ${b.de.toFixed(2)}→${b.a.toFixed(2)}`).join(' · '));
