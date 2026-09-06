// L'Objectif du jour : la calibration, et les routes.
//
// DEUX MOITIES, ET LA SECONDE EST LA PLUS IMPORTANTE.
//
// La premiere verifie le calcul de la cible sans rien monter — c'est du calcul
// pur, il se teste comme tel. La seconde APPELLE LES ROUTES, et elle existe a
// cause de ce qui s'est passe : les trois routes de l'objectif ont ete ecrites
// a l'interieur du bloc `/test/`, dont l'accolade fermante se trouvait cent
// lignes plus bas. Aucune adresse commencant par `/objectif` n'y entrait. Le
// code etait juste, lisible, commente, et repondait 404 a tout le monde en
// production pendant que le cron envoyait des notifications vers un jeu
// incapable de lire l'objectif annonce.
//
// Aucune relecture n'attrape ca. Un appel, si.
//
//   node tools/objectif-test.mjs                    # calibration seule
//   (cd worker && npx wrangler dev)                 # dans un autre terminal
//   node tools/objectif-test.mjs                    # ...et les routes avec
//
//   BASE=https://sprinter-leaderboard.benbezi-sprinter.workers.dev \
//     node tools/objectif-test.mjs                  # contre la production
//
// SUR UNE BASE NEUVE, ET C'EST LA QUE CA CASSE. Le worker local accumule les
// tables au fil des essais : au bout de deux lancements, tout existe, et une
// route qui ne sait pas creer ce qu'elle lit passe pour correcte. Deux bugs
// s'y sont deja caches — dont `ensureObjectifTables`, qui posait un index sur
// `races`, une table dont elle n'est pas proprietaire, et faisait rendre 500 a
// l'objectif entier sur un premier deploiement comme sur le canal de test.
//
// Pour retrouver cet etat, monter le worker AILLEURS, ou wrangler n'a pas
// d'etat local, et appeler /objectif AVANT toute autre route :
//
//   rm -rf /tmp/w && mkdir -p /tmp/w/src
//   cp worker/wrangler.toml worker/package.json worker/.dev.vars /tmp/w/
//   ln -s "$PWD/worker/node_modules" /tmp/w/node_modules
//   cp worker/src/*.js /tmp/w/src/
//   (cd /tmp/w && npx wrangler dev --local --port 8789)
//   BASE=http://127.0.0.1:8789 node tools/objectif-test.mjs
//
// ET SUR UNE BASE DEJA PEUPLEE, qui casse AUTREMENT. Un index pose sur une
// colonne qu'un ALTER n'a pas encore ajoutee passe sur une base neuve — le
// CREATE TABLE a mis la colonne — et fait echouer le lot entier sur une base
// existante, donc chez les joueurs qui ont deja un objectif. C'est le chemin
// qu'emprunte tout deploiement, et c'est celui qu'on voit le moins. Le worker
// local ordinaire (worker/, avec son .wrangler accumule) est justement cette
// base-la : le lancer sans effacer son etat est le second essai a faire.

import {
  calibrer, quantile, fuseauDe, creneauMaintenant, heureLocale, creerObjectif,
  fenetreDe, graineDe, hash32, CRENEAUX, enregistrerTentative,
  seuilsDe, palierDe, pointsDe, serieSuivante, serieEnCours, POINTS,
  SEUIL_BRONZE, SEUIL_OR, VIE_TOUS_LES_JOURS,
  MARGE_MIN, MARGE_MAX, MARGE_REPLI, COURSES_MIN, ACTIF_JOURS,
} from '../worker/src/objectif.js';
import {
  PLUS_BAS, PLUS_HAUT, directionDe, estMeilleur, meilleurDe, agregatSql,
} from '../worker/src/epreuves.js';
import { estAnonyme } from '../worker/src/records.js';
import { verifierTrace, vraisemblance, PAS_S, BOND_SUSPECT } from '../worker/src/preuve.js';
import {
  decalageDe, peutSonner, DECALAGE_MAX_MIN, DECALAGE_PAS_MIN,
  ECART_MIN_MS, SANS_OUVERTURE,
} from '../worker/src/journal.js';
import { readFileSync } from 'node:fs';

const B = process.env.BASE || 'http://127.0.0.1:8788';
// La cle d'administration du worker local, telle que .dev.vars la pose.
const ADMIN = process.env.ADMIN_CLE || 'cle-de-test-locale-uniquement';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);
const s2 = ms => (ms / 1000).toFixed(2);

/* ================================================================ calcul */

titre('LA CIBLE N EST JAMAIS MEILLEURE NI EGALE AU RECORD');

// L'invariant du systeme entier. Une cible egale au record exigerait de le
// battre pour valider — ce n'est pas ce qu'on annonce au joueur, et c'est la
// facon la plus sure de le faire decrocher. On le verifie sur des profils
// choisis, puis sur mille profils tires au hasard : c'est une propriete, pas
// un cas.
const profils = [
  ['aucune course',            8500, []],
  ['une seule course',         8500, [8600]],
  ['sous le seuil de calibrage', 8500, [8600, 8700, 8550]],
  ['metronome (±0,5 %)',       8500, Array.from({ length: 30 }, (_, i) => 8500 + (i % 5) * 10)],
  ['regulier (±2 %)',          8500, Array.from({ length: 30 }, (_, i) => 8500 + (i % 17) * 10)],
  ['dents de scie (±12 %)',    8280, Array.from({ length: 30 }, (_, i) => 8280 + (i % 30) * 33)],
  ['record par chance',        8280, Array.from({ length: 30 }, () => 9500 + Math.round(Math.random() * 400))],
  ['abandons dans l historique', 8500,
    [8600, 8700, 8550, 8620, 8580, 8610, 8590, 8640, 1199000, 1199000]],
];

for (const [nom, pb, courses] of profils) {
  const c = calibrer(pb, courses);
  ok(`${nom} : cible ${s2(c.cibleMs)} s > record ${s2(pb)} s`,
     c.cibleMs > pb, `cible ${c.cibleMs}, record ${pb}`);
}

let violations = 0;
for (let i = 0; i < 1000; i++) {
  const pb = 7000 + Math.round(Math.random() * 6000);
  const n = Math.round(Math.random() * 40);
  const dispersion = Math.random() * 0.25;
  const courses = Array.from({ length: n },
    () => Math.round(pb * (1 + Math.random() * dispersion)));
  const c = calibrer(pb, courses);
  if (!(c.cibleMs > pb)) violations++;
}
ok('mille profils tires au hasard, aucune exception', violations === 0,
   `${violations} cible(s) atteignant le record`);

titre('LA MARGE RESTE DANS SES BORNES');

for (const [nom, pb, courses] of profils) {
  const c = calibrer(pb, courses);
  const dansLesBornes = c.methode === 'repli'
    ? Math.abs(c.marge - MARGE_REPLI) < 0.02   // arrondi au pas d affichage
    : c.marge > 0 && c.marge <= MARGE_MAX + 1e-9;
  ok(`${nom} : marge ${(c.marge * 100).toFixed(2)} % (${c.methode})`, dansLesBornes);
}

titre('SANS HISTORIQUE, ON REPLIE PLUTOT QUE D INVENTER');

for (let n = 0; n < COURSES_MIN; n++) {
  const courses = Array.from({ length: n }, (_, i) => 8600 + i * 10);
  ok(`${n} course(s) : repli`, calibrer(8500, courses).methode === 'repli');
}
ok(`${COURSES_MIN} courses : on calibre`,
   calibrer(8500, Array.from({ length: COURSES_MIN }, (_, i) => 8600 + i * 10))
     .methode === 'quantile');

titre('PLUS ON EST REGULIER, PLUS LA MARGE EST PETITE');

// La these de tout le module, et la seule chose qui distingue ce calibrage
// d'un « record + 3 % ». Si elle tombe, le systeme perd sa raison d'etre.
const marge = etendue => calibrer(8500, Array.from({ length: 30 },
  (_, i) => 8500 + Math.round((i / 29) * 8500 * etendue))).marge;
const mMetronome = marge(0.01), mMoyen = marge(0.05), mIrregulier = marge(0.15);
ok(`metronome ${(mMetronome * 100).toFixed(2)} % < moyen ${(mMoyen * 100).toFixed(2)} %`,
   mMetronome < mMoyen);
ok(`moyen ${(mMoyen * 100).toFixed(2)} % < irregulier ${(mIrregulier * 100).toFixed(2)} %`,
   mMoyen < mIrregulier);

titre('LA CIBLE RESTE PLUS EXIGEANTE QUE LA MEDIANE');

// Un temps realise plus d'une fois sur deux n'est pas un objectif.
for (const [nom, pb, courses] of profils) {
  if (courses.length < COURSES_MIN) continue;
  const triees = courses.filter(Boolean).sort((a, b) => a - b);
  const mediane = quantile(triees, 0.5);
  const c = calibrer(pb, courses);
  ok(`${nom} : cible ${s2(c.cibleMs)} s < mediane ${s2(mediane)} s`, c.cibleMs < mediane);
}

titre('LE QUANTILE FAIT CE QU IL DIT');

ok('un seul point', quantile([42], 0.2) === 42);
ok('mediane de cinq', quantile([1, 2, 3, 4, 5], 0.5) === 3);
ok('interpolation lineaire', quantile([0, 10], 0.5) === 5);
ok('borne basse', quantile([1, 2, 3], 0) === 1);
ok('borne haute', quantile([1, 2, 3], 1) === 3);

titre('L HEURE EST CELLE DU JOUEUR');

ok('la France a son fuseau', fuseauDe('FR') === 'Europe/Paris');
ok('un pays inconnu replie sur son continent',
   fuseauDe('XX', 'AS') === 'Asia/Shanghai');
ok('sans rien, Paris plutot qu UTC', fuseauDe(null, null) === 'Europe/Paris');

// 12:45 a Paris en heure d ete, c est 10:45 UTC.
const midiParis = new Date('2026-09-05T10:45:00Z');
ok('12:45 a Paris ouvre le creneau du midi',
   creneauMaintenant(midiParis, 'Europe/Paris')?.creneau === 'midi');
ok('...et personne a New York au meme instant',
   creneauMaintenant(midiParis, 'America/New_York') === null);
ok('20:15 a Paris ouvre le creneau du soir',
   creneauMaintenant(new Date('2026-09-05T18:15:00Z'), 'Europe/Paris')?.creneau === 'soir');
ok('12:00 n ouvre plus rien',
   creneauMaintenant(new Date('2026-09-05T10:00:00Z'), 'Europe/Paris') === null);
ok('12:30 non plus',
   creneauMaintenant(new Date('2026-09-05T10:30:00Z'), 'Europe/Paris') === null);

// Le cron passe tous les quarts d heure, et tous les fuseaux reels sont des
// multiples de quinze minutes. Une minute d envoi prise dans {0,15,30,45}
// finit donc par tomber juste partout — y compris a :45 et :15.
ok('l Inde (+05:30) tombe juste au midi',
   creneauMaintenant(new Date('2026-09-05T07:15:00Z'), 'Asia/Kolkata')?.creneau === 'midi');
ok('le Nepal (+05:45) tombe juste au midi',
   creneauMaintenant(new Date('2026-09-05T07:00:00Z'), 'Asia/Kathmandu')?.creneau === 'midi');
ok('les Chatham (+12:45) tombent juste au soir',
   creneauMaintenant(new Date('2026-09-05T07:30:00Z'), 'Pacific/Chatham')?.creneau === 'soir');
ok('toutes les minutes d envoi sont des quarts d heure',
   Object.values(CRENEAUX).every(c => [0, 15, 30, 45].includes(c.envoi.minute)),
   'sinon un fuseau a la demie ou au quart ne serait jamais servi');
ok('un fuseau illisible replie sur UTC sans lever',
   heureLocale(new Date('2026-09-05T10:00:00Z'), 'Pas/Un/Fuseau').heure === 10);

titre('L OBJECTIF EXPIRE, ET LA FENETRE EST UN INSTANT');

const fMidi = fenetreDe('2026-09-05', 'midi', 'Europe/Paris', midiParis);
const fSoir = fenetreDe('2026-09-05', 'soir', 'Europe/Paris', midiParis);
const heureParis = t => heureLocale(new Date(t), 'Europe/Paris');

ok('le midi ouvre a 12:45 locales',
   heureParis(fMidi.ouvre).heure === 12 && heureParis(fMidi.ouvre).minute === 45,
   JSON.stringify(heureParis(fMidi.ouvre)));
ok('...et expire a 18:59 le meme jour',
   heureParis(fMidi.expire).heure === 18 && heureParis(fMidi.expire).minute === 59
   && heureParis(fMidi.expire).jour === '2026-09-05');
ok('le soir ouvre a 20:15 locales',
   heureParis(fSoir.ouvre).heure === 20 && heureParis(fSoir.ouvre).minute === 15);
ok('...et expire a 2 h LE LENDEMAIN',
   heureParis(fSoir.expire).heure === 2 && heureParis(fSoir.expire).jour === '2026-09-06',
   JSON.stringify(heureParis(fSoir.expire)));
ok('une fenetre dure toujours plus d une heure',
   fMidi.expire - fMidi.ouvre > 3600000 && fSoir.expire - fSoir.ouvre > 3600000);
ok('les deux fenetres ne se chevauchent pas',
   fMidi.expire <= fSoir.ouvre,
   'sinon une tentative ne saurait pas a quel objectif elle appartient');

// Le meme creneau, deux fuseaux : deux instants differents, la meme heure
// locale. C est toute la raison d etre du calcul.
const fTokyo = fenetreDe('2026-09-05', 'midi', 'Asia/Tokyo', midiParis);
ok('Tokyo ouvre a 12:45 chez lui, pas chez nous',
   heureLocale(new Date(fTokyo.ouvre), 'Asia/Tokyo').heure === 12
   && fTokyo.ouvre !== fMidi.ouvre);

ok('le dernier jour du mois deborde correctement',
   heureLocale(new Date(fenetreDe('2026-09-30', 'soir', 'Europe/Paris', midiParis).expire),
               'Europe/Paris').jour === '2026-10-01');

titre('LA PISTE EST LA MEME POUR TOUT LE MONDE');

// La graine ne depend PAS du joueur : c est ce qui fait du defi une comparaison
// plutot qu une collection de courses sans rapport.
ok('la graine ne depend que du jour, du creneau et de l epreuve',
   graineDe('2026-09-05', 'midi', '100') === graineDe('2026-09-05', 'midi', '100'));
ok('deux creneaux du meme jour ne partagent pas la piste',
   graineDe('2026-09-05', 'midi', '100') !== graineDe('2026-09-05', 'soir', '100'));
ok('deux jours non plus',
   graineDe('2026-09-05', 'midi', '100') !== graineDe('2026-09-06', 'midi', '100'));
ok('deux epreuves non plus',
   graineDe('2026-09-05', 'midi', '100') !== graineDe('2026-09-05', 'midi', '200'));
ok('la graine est un entier non signe sur 32 bits',
   Number.isInteger(graineDe('2026-09-05', 'midi', '100'))
   && graineDe('2026-09-05', 'midi', '100') >= 0
   && graineDe('2026-09-05', 'midi', '100') < 2 ** 32);
ok('le hachage est stable dans le temps', hash32('sprinter') === hash32('sprinter'));
ok('...et deux textes voisins ne se ressemblent pas',
   Math.abs(hash32('2026-09-05') - hash32('2026-09-06')) > 1000);

ok(`on cesse de servir apres ${ACTIF_JOURS} jours sans courir`, ACTIF_JOURS === 30);

titre('UNE EPREUVE AU PLUS HAUT SE CALIBRE DANS L AUTRE SENS');

// Aucune epreuve du jeu ne se gagne encore au plus haut. On la teste quand
// meme, et c'est le seul moment ou on peut le faire honnetement : le jour ou
// elle existera, le harnais dira si le calcul tenait — plutot que le joueur.
//
// Le piege du sens inverse n'est pas qu'il plante, c'est qu'il ne plante pas.
// Un MIN() sur une distance couronne le plus mauvais, et une cible calculee a
// l'endroit sur une epreuve a l'envers est MEILLEURE que le record : elle
// exige de le battre, en se presentant comme atteignable.
const haut = { direction: PLUS_HAUT, pas: 10 };

const profilsHaut = [
  ['aucune course',        8500, []],
  ['une seule course',     8500, [8400]],
  ['metronome',            8500, Array.from({ length: 30 }, (_, i) => 8500 - (i % 5) * 10)],
  ['dents de scie',        8500, Array.from({ length: 30 }, (_, i) => 8500 - (i % 30) * 33)],
  ['record par chance',    8500, Array.from({ length: 30 }, () => 7300 - Math.round(Math.random() * 400))],
];

for (const [nom, pb, courses] of profilsHaut) {
  const c = calibrer(pb, courses, haut);
  ok(`${nom} : cible ${c.cibleMs} < record ${pb}`, c.cibleMs < pb,
     `cible ${c.cibleMs}, record ${pb}`);
  ok(`   ...et la marge reste positive et bornee`,
     c.marge > 0 && c.marge <= MARGE_MAX + 1e-9,
     `marge ${(c.marge * 100).toFixed(2)} %`);
}

for (const [nom, pb, courses] of profilsHaut) {
  if (courses.length < COURSES_MIN) continue;
  const mediane = quantile([...courses].sort((a, b) => a - b), 0.5);
  const c = calibrer(pb, courses, haut);
  ok(`${nom} : cible ${c.cibleMs} > mediane ${mediane} (plus exigeante)`,
     c.cibleMs > mediane);
}

let violationsHaut = 0;
for (let i = 0; i < 1000; i++) {
  const pb = 7000 + Math.round(Math.random() * 6000);
  const n = Math.round(Math.random() * 40);
  const dispersion = Math.random() * 0.25;
  const courses = Array.from({ length: n },
    () => Math.round(pb * (1 - Math.random() * dispersion)));
  const c = calibrer(pb, courses, haut);
  if (!(c.cibleMs < pb)) violationsHaut++;
}
ok('mille profils au plus haut, aucune cible n atteint le record',
   violationsHaut === 0, `${violationsHaut} exception(s)`);

// Le meme joueur, la meme regularite, les deux sens : la marge doit etre la
// meme des deux cotes. Si elle ne l'est pas, un des deux sens est un accident.
const regulier = Array.from({ length: 30 }, (_, i) => (i % 17) * 10);
const mBas  = calibrer(8500, regulier.map(d => 8500 + d)).marge;
const mHaut = calibrer(8500, regulier.map(d => 8500 - d), haut).marge;
ok(`marge identique dans les deux sens (${(mBas * 100).toFixed(2)} % / ${(mHaut * 100).toFixed(2)} %)`,
   Math.abs(mBas - mHaut) < 0.002);

titre('LE SENS EST DECLARE, PAS DEDUIT');

ok('le 100 m se gagne au plus bas', directionDe('100') === PLUS_BAS);
ok('les trois epreuves du jeu aussi',
   ['100', '200', '400'].every(c => directionDe(c) === PLUS_BAS));
ok('au plus bas, 8,40 s bat 8,50 s', estMeilleur(PLUS_BAS, 8400, 8500));
ok('au plus haut, c est l inverse', estMeilleur(PLUS_HAUT, 8500, 8400));
ok('egaler n est pas battre, au plus bas', !estMeilleur(PLUS_BAS, 8500, 8500));
ok('egaler n est pas battre, au plus haut', !estMeilleur(PLUS_HAUT, 8500, 8500));
ok('sans reference, tout resultat est le meilleur',
   estMeilleur(PLUS_BAS, 8500, null));
ok('le meilleur d une liste, au plus bas',
   meilleurDe(PLUS_BAS, [8600, 8400, 8500]) === 8400);
ok('le meilleur d une liste, au plus haut',
   meilleurDe(PLUS_HAUT, [8600, 8400, 8500]) === 8600);
ok('une liste vide n a pas de meilleur', meilleurDe(PLUS_BAS, []) === null);
ok('SQL agrege dans le bon sens', agregatSql(PLUS_BAS) === 'MIN'
   && agregatSql(PLUS_HAUT) === 'MAX');

titre('LE SILENCE NE SE REFERME PAS SUR LE JOUEUR');

// La regle du silence a d'abord refuse la CREATION de l'objectif, et c'etait
// un piege sans fond : sans objectif, pas de tentative possible ; sans
// tentative, le compteur ne redescend jamais. Quatre creneaux sans reponse —
// deux jours — et le joueur etait tu pour toujours, meme en rouvrant le jeu
// tous les matins. Ce qui suit tient cette porte ouverte.
//
// Une fausse base plutot qu'un worker : ce qu'on verifie est une decision, et
// une decision se lit dans ce qu'elle rend.
function fausseBase({ derniers = [], deja = null }) {
  const ecrits = [];
  const reponse = (sql, args) => ({
    first: async () => {
      if (/SELECT \* FROM objectifs/.test(sql)) {
        if (deja) return deja;
        return ecrits.length ? ecrits[ecrits.length - 1] : null;
      }
      return null;
    },
    all: async () => ({
      results: /SELECT tentatives/.test(sql)
        ? derniers.map(t => ({ tentatives: t })) : [],
    }),
    run: async () => {
      if (/INSERT OR IGNORE INTO objectifs/.test(sql)) {
        ecrits.push({
          name_key: args[0], jour: args[1], creneau: args[2],
          cible_ms: args[4], pb_ms: args[5], tentatives: 0,
        });
      }
      return { success: true };
    },
  });
  return {
    ecrits,
    prepare: sql => ({ bind: (...args) => reponse(sql, args), ...reponse(sql, []) }),
    batch: async () => [],
  };
}

const joueur = {
  nameKey: 'zoe', nom: 'Zoe', rang: 12, pb: 8500, fuseau: 'Europe/Paris',
  courses: Array.from({ length: 30 }, (_, i) => 8600 + i * 10),
  jour: '2026-09-05', creneau: 'midi',
};

const muet = await creerObjectif(fausseBase({ derniers: [0, 0, 0, 0] }), joueur, new Date());
ok('quatre creneaux sans reponse : on cesse de sonner', muet.silencieux === true);
ok('...mais l objectif existe quand meme', !!muet.objectif,
   'sans lui, aucune tentative n est possible, et le silence devient definitif');
ok('...et il compte comme nouveau', muet.nouveau === true);

const parle = await creerObjectif(fausseBase({ derniers: [0, 0, 3, 0] }), joueur, new Date());
ok('une seule tentative dans les quatre rompt le silence', parle.silencieux === false);

const jeune = await creerObjectif(fausseBase({ derniers: [0, 0] }), joueur, new Date());
ok('deux creneaux ne suffisent pas a se taire', jeune.silencieux === false);

const rejoue = await creerObjectif(
  fausseBase({ deja: { name_key: 'zoe', jour: '2026-09-05', creneau: 'midi', tentatives: 1 } }),
  joueur, new Date());
ok('un cron rejoue ne cree pas de doublon', rejoue.nouveau === false,
   'c est la PK (joueur, jour, creneau) qui le garantit, pas l appelant');

titre('TROIS PALIERS, ET PERSONNE NE REPART LES MAINS VIDES');

const PB = 8500, CIBLE = 8800;
const seuils = seuilsDe(PB, CIBLE, PLUS_BAS);

ok(`bronze a ${seuils.bronze} ms (record + ${((SEUIL_BRONZE - 1) * 100).toFixed(0)} %)`,
   seuils.bronze === Math.round(PB * SEUIL_BRONZE));
ok('argent EST la cible calibree', seuils.argent === CIBLE);
ok(`or a ${seuils.or} ms (record - ${((1 - SEUIL_OR) * 100).toFixed(0)} %)`,
   seuils.or === Math.round(PB * SEUIL_OR));
ok('les trois seuils sont ordonnes', seuils.or < seuils.argent && seuils.argent < seuils.bronze,
   'sinon un palier en cache un autre');
ok('le bronze est plus lent que le record', seuils.bronze > PB,
   'c est l accroche : il doit tomber des la premiere course');
ok('l or est plus rapide que le record', seuils.or < PB);

for (const [nom, ms, attendu] of [
  ['une course tres lente n atteint rien', 12000, null],
  ['juste au-dessus du bronze',            seuils.bronze + 1, null],
  ['pile sur le bronze',                   seuils.bronze, 'bronze'],
  ['entre bronze et argent',               8900, 'bronze'],
  ['pile sur la cible',                    CIBLE, 'argent'],
  ['entre argent et or',                   8500, 'argent'],
  ['pile sur l or',                        seuils.or, 'or'],
  ['bien au-dela de l or',                 8000, 'or'],
]) {
  ok(`${nom} → ${attendu ?? 'rien'}`, palierDe(ms, seuils, PLUS_BAS) === attendu,
     String(palierDe(ms, seuils, PLUS_BAS)));
}

// La bande ou le bareme et l ecran ne disent pas la meme chose. Elle est
// documentee dans le module, et ce test existe pour qu elle reste connue.
const recordCourt = PB - 10;
ok('un record ameliore de moins de 1 % s arrete a l argent',
   palierDe(recordCourt, seuils, PLUS_BAS) === 'argent' && recordCourt < PB,
   'l ecran affiche pourtant « NOUVEAU RECORD » : SEUIL_OR a 1 les remettrait d accord');

// Au plus haut, tout doit s inverser sans que rien d autre change.
const sHaut = seuilsDe(PB, 8200, PLUS_HAUT);
ok('au plus haut, le bronze est plus BAS que le record', sHaut.bronze < PB);
ok('...et l or plus haut', sHaut.or > PB);
ok('...et l ordre des seuils est inverse',
   sHaut.or > sHaut.argent && sHaut.argent > sHaut.bronze);
ok('...et un gros score decroche l or', palierDe(9000, sHaut, PLUS_HAUT) === 'or');
ok('...un petit ne decroche rien', palierDe(1000, sHaut, PLUS_HAUT) === null);

titre('LES POINTS DU MEILLEUR PALIER, PAS LA SOMME DES TROIS');

ok('bronze seul', pointsDe('bronze', { tentatives: 1 }).total === POINTS.bronze);
ok('argent seul', pointsDe('argent', { tentatives: 1 }).total === POINTS.argent);
ok('or seul', pointsDe('or', { tentatives: 1 }).total === POINTS.or);
ok('l or ne vaut pas bronze + argent + or',
   pointsDe('or', { tentatives: 1 }).total !== POINTS.bronze + POINTS.argent + POINTS.or);
ok('rien du tout ne vaut rien', pointsDe(null, { tentatives: 1 }).total === 0);

const troisCourses = pointsDe(null, { tentatives: POINTS.courses_perseverance });
ok(`la perseverance tombe a ${POINTS.courses_perseverance} courses MEME SANS REUSSIR`,
   troisCourses.total === POINTS.perseverance,
   'c est exactement le joueur qu on risque de perdre');
ok('...et pas avant',
   pointsDe(null, { tentatives: POINTS.courses_perseverance - 1 }).total === 0);
ok('...et elle s ajoute au palier',
   pointsDe('argent', { tentatives: 3 }).total === POINTS.argent + POINTS.perseverance);

const sansSerie = pointsDe('argent', { tentatives: 1, serie: 0 });
const avecSerie = pointsDe('argent', { tentatives: 1, serie: 3 });
ok('la serie majore', avecSerie.total > sansSerie.total,
   `${sansSerie.total} → ${avecSerie.total}`);
ok('...de dix pour cent par jour',
   avecSerie.multiplicateur === 1 + 3 * POINTS.serie_pas);
ok('...et elle est plafonnee',
   pointsDe('or', { tentatives: 1, serie: 99 }).total
   === pointsDe('or', { tentatives: 1, serie: POINTS.serie_plafond }).total,
   `plafond a ${POINTS.serie_plafond} jours`);
ok('sans rien a majorer, la serie ne cree pas de points',
   pointsDe(null, { tentatives: 1, serie: 7 }).total === 0);

titre('UNE JOURNEE MANQUEE NE REMET PAS TOUT A ZERO');

const S = (serie, dernier, vie) => ({ serie, dernier_jour: dernier, vie_utilisee_le: vie });

ok('la premiere validation ouvre la serie',
   serieSuivante(0, null, '2026-09-10', null).serie === 1);
ok('deux jours de suite : elle monte',
   serieSuivante(3, '2026-09-09', '2026-09-10', null).serie === 4);
ok('deux fois le meme jour ne compte qu une fois',
   serieSuivante(3, '2026-09-10', '2026-09-10', null).serie === 3,
   'valider midi ET soir ne doit pas doubler la serie');

const rattrape = serieSuivante(5, '2026-09-08', '2026-09-10', null);
ok('un jour saute, et la vie rattrape', rattrape.serie === 6);
ok('...en se consommant', rattrape.vieConsommee === true);

const deuxieme = serieSuivante(6, '2026-09-10', '2026-09-12', '2026-09-10');
ok('une seconde vie dans la meme semaine est refusee',
   deuxieme.serie === 1 && deuxieme.vieConsommee === false,
   'une vie par semaine, sinon ce n est plus une serie');

const semaineApres = serieSuivante(6, '2026-09-17', '2026-09-19', '2026-09-10');
ok(`une vie se recharge apres ${VIE_TOUS_LES_JOURS} jours`,
   semaineApres.serie === 7 && semaineApres.vieConsommee === true);

ok('deux jours manques, c est une pause, pas un accident',
   serieSuivante(9, '2026-09-07', '2026-09-10', null).serie === 1);
ok('un mois d absence non plus',
   serieSuivante(9, '2026-08-01', '2026-09-10', null).serie === 1);

titre('LE MULTIPLICATEUR REGARDE LES JOURS DEJA ACQUIS');

ok('sans historique, aucun bonus', serieEnCours(null, '2026-09-10') === 0);
ok('la veille compte', serieEnCours(S(4, '2026-09-09', null), '2026-09-10') === 4);
ok('aujourd hui deja valide ne se compte pas deux fois',
   serieEnCours(S(4, '2026-09-10', null), '2026-09-10') === 3,
   'sinon le second creneau du jour serait majore une fois de trop');
ok('une serie morte ne majore plus rien',
   serieEnCours(S(9, '2026-08-01', null), '2026-09-10') === 0);
ok('un jour saute avec une vie disponible tient encore',
   serieEnCours(S(4, '2026-09-08', null), '2026-09-10') === 4);
ok('...mais pas si la vie vient d etre depensee',
   serieEnCours(S(4, '2026-09-08', '2026-09-06'), '2026-09-10') === 0);

titre('LES TENTATIVES SONT ILLIMITEES, ET SEULE LA MEILLEURE COMPTE');

/** Une base qui ne tient qu'un objectif, et applique l'ecriture qu'on lui fait. */
function baseObjectif(ligne) {
  const etat = Object.assign({
    name_key: 'zoe', jour: '2026-09-05', creneau: 'midi', race_key: '100',
    cible_ms: 8800, pb_ms: 8500, tentatives: 0, meilleur_ms: null,
    valide_le: null, points: 0, palier: null, ouvre_le: null, expire_le: null,
  }, ligne);
  const credits = [];
  const rep = (sql, args) => ({
    first: async () => {
      if (/FROM objectifs/.test(sql)) {
        const [, t1, jour, t2] = args;
        const ouvert = etat.ouvre_le == null || etat.ouvre_le <= t1;
        const vivant = etat.expire_le == null ? etat.jour >= jour : etat.expire_le > t2;
        return ouvert && vivant ? { ...etat } : null;
      }
      if (/FROM objectif_classement/.test(sql)) {
        return { points: 0, valides: 0, serie: 0, dernier_jour: null };
      }
      return null;
    },
    all: async () => ({ results: [] }),
    run: async () => {
      if (/UPDATE objectifs/.test(sql)) {
        // Le meme ordre que le vrai UPDATE, et il compte : `palier` s'est
        // glisse en troisieme position, et une fausse base restee sur
        // l'ancien ordre rangeait le palier dans `valide_le` et l'horodatage
        // dans les points. Les tests echouaient — sur eux-memes.
        const [tent, meilleur, palier, valide, pts] = args;
        etat.tentatives = tent;
        etat.meilleur_ms = meilleur;
        etat.palier = palier;
        etat.valide_le = etat.valide_le ?? valide;      // COALESCE
        etat.points = pts;                              // pose, pas ajoute
      }
      if (/INSERT INTO objectif_classement/.test(sql)) credits.push(args[2]);
      return {};
    },
  });
  return {
    etat, credits,
    prepare: sql => ({ bind: (...a) => rep(sql, a), ...rep(sql, []) }),
    batch: async () => [],
  };
}

const t0 = new Date('2026-09-05T13:00:00Z');
const ouverte = { ouvre_le: t0.getTime() - 3600000, expire_le: t0.getTime() + 3600000 };

{
  // Quatre courses sur le meme defi, et le compte a la fin doit valoir
  // exactement ce que vaut le meilleur palier, plus la perseverance. Ni la
  // somme des versements successifs, ni la somme des paliers traverses.
  const db = baseObjectif(ouverte);
  const total = () => db.credits.reduce((a, b) => a + b, 0);

  const un = await enregistrerTentative(db, 'zoe', 'Zoe', 9100, t0);
  ok('une course loin de la cible decroche quand meme le bronze',
     un.palier === 'bronze' && !un.reussi,
     'personne ne repart les mains vides : c est l accroche');
  ok('...elle compte comme tentative', un.essai === 1);
  ok('...elle pose le meilleur temps de la session', db.etat.meilleur_ms === 9100);
  ok(`...et rapporte ${POINTS.bronze} points`, total() === POINTS.bronze, String(total()));
  ok('...sans valider l objectif', db.etat.valide_le === null);
  ok(`...en annoncant les ${un.avantBonus} courses qui restent avant le bonus`,
     un.avantBonus === POINTS.courses_perseverance - 1);

  const deux = await enregistrerTentative(db, 'zoe', 'Zoe', 8700, t0);
  ok('la course suivante passe la cible', deux.reussi && deux.palier === 'argent');
  ok('...et le meilleur temps suit', db.etat.meilleur_ms === 8700);
  ok('...elle ne rapporte que la DIFFERENCE avec le bronze deja acquis',
     deux.points === POINTS.argent - POINTS.bronze, String(deux.points));
  ok(`...le total du defi vaut l argent, pas bronze + argent`,
     total() === POINTS.argent, String(total()));
  ok('...et l objectif est valide', db.etat.valide_le !== null);

  const trois = await enregistrerTentative(db, 'zoe', 'Zoe', 8600, t0);
  ok('on peut continuer APRES avoir valide', trois !== null && trois.essai === 3,
     'sinon on ferme la porte a celui qui vient justement de reussir');
  ok('...le jeu le sait', trois.dejaValide === true);
  ok('...la meilleure course est retenue', db.etat.meilleur_ms === 8600);
  ok('...et la troisieme course declenche la perseverance',
     trois.points === POINTS.perseverance && trois.avantBonus === 0,
     `${trois.points} pts, ${trois.avantBonus} restantes`);
  ok('le total vaut argent + perseverance, et rien de plus',
     total() === POINTS.argent + POINTS.perseverance, String(total()));

  const quatre = await enregistrerTentative(db, 'zoe', 'Zoe', 9500, t0);
  ok('une course plus lente ne degrade pas le meilleur temps',
     db.etat.meilleur_ms === 8600 && quatre.essai === 4);
  ok('...ne reprend aucun point', quatre.points === 0
     && total() === POINTS.argent + POINTS.perseverance);
  ok('...et n efface pas l heure de validation', db.etat.valide_le !== null);

  const cinq = await enregistrerTentative(db, 'zoe', 'Zoe', 8300, t0);
  ok('un record en fin de fenetre fait monter a l or', cinq.palier === 'or');
  ok('...et ne rapporte que ce qui manquait',
     cinq.points === POINTS.or - POINTS.argent, String(cinq.points));
  ok('...pour un total qui vaut l or plus la perseverance',
     total() === POINTS.or + POINTS.perseverance, String(total()));
  ok('...et le classement n a jamais ete credite deux fois du meme point',
     db.etat.points === total(), `${db.etat.points} vs ${total()}`);
}

{
  const db = baseObjectif({ ouvre_le: t0.getTime() - 7200000, expire_le: t0.getTime() - 60000 });
  ok('une course apres l expiration ne trouve plus rien',
     (await enregistrerTentative(db, 'zoe', 'Zoe', 8000, t0)) === null);
}

{
  const db = baseObjectif({ ouvre_le: t0.getTime() + 60000, expire_le: t0.getTime() + 7200000 });
  ok('une course avant l ouverture non plus',
     (await enregistrerTentative(db, 'zoe', 'Zoe', 8000, t0)) === null);
}

{
  // Les objectifs d'avant la fenetre n'ont pas d'instants ranges. Les exclure
  // aurait fait disparaitre l'objectif en cours de tous ceux qui en avaient un
  // au moment du deploiement.
  const db = baseObjectif({ ouvre_le: null, expire_le: null, jour: '2026-09-05' });
  const r = await enregistrerTentative(db, 'zoe', 'Zoe', 8700, t0);
  ok('un objectif d avant la fenetre reste jouable', r !== null && r.reussi);
}

titre('CHACUN RECOIT A SON HEURE, ET TOUJOURS LA MEME');

const noms = Array.from({ length: 400 }, (_, i) => 'joueur' + i);
const decalages = noms.map(decalageDe);

ok('le decalage est stable pour un meme nom',
   decalageDe('zoe') === decalageDe('zoe'),
   'un rendez-vous qui bouge tous les jours n en est plus un');
ok(`il reste dans ±${DECALAGE_MAX_MIN} minutes`,
   decalages.every(d => Math.abs(d) <= DECALAGE_MAX_MIN));
ok(`et tombe sur un multiple de ${DECALAGE_PAS_MIN}`,
   decalages.every(d => d % DECALAGE_PAS_MIN === 0),
   'le cron ne passe que toutes les cinq minutes : le reste serait injoignable');

const repartition = new Map();
for (const d of decalages) repartition.set(d, (repartition.get(d) || 0) + 1);
const valeurs = [...repartition.keys()].sort((a, b) => a - b);
ok(`les ${valeurs.length} decalages possibles sont tous utilises`,
   valeurs.length === (2 * DECALAGE_MAX_MIN) / DECALAGE_PAS_MIN + 1,
   valeurs.join(', '));
const parts = [...repartition.values()];
ok('...et aucun ne ramasse tout le monde',
   Math.max(...parts) < noms.length * 0.4,
   `le plus charge en prend ${Math.max(...parts)} sur ${noms.length}`);

// Le decalage doit deplacer le creneau, et le deplacer VRAIMENT.
const midi1245 = new Date('2026-09-05T10:45:00Z');
ok('sans decalage, 12:45 ouvre le midi',
   creneauMaintenant(midi1245, 'Europe/Paris', 0)?.creneau === 'midi');
ok('avec +5, 12:45 n ouvre plus rien',
   creneauMaintenant(midi1245, 'Europe/Paris', 5) === null);
ok('...et 12:50 ouvre a sa place',
   creneauMaintenant(new Date('2026-09-05T10:50:00Z'), 'Europe/Paris', 5)?.creneau === 'midi');
ok('avec -10, c est 12:35',
   creneauMaintenant(new Date('2026-09-05T10:35:00Z'), 'Europe/Paris', -10)?.creneau === 'midi');
// Le soir a 20:15 moins dix, c est 20:05 : rien ne change d'heure ici, mais la
// regle doit tenir meme quand le decalage franchit une heure ronde.
ok('un decalage qui franchit l heure ronde tombe juste',
   creneauMaintenant(new Date('2026-09-05T18:05:00Z'), 'Europe/Paris', -10)?.creneau === 'soir');

titre('ON NE SONNE PAS N IMPORTE QUAND');

/** Une base qui ne tient que le journal d'un joueur. */
function baseJournal({ envois = [], pref = null } = {}) {
  const rep = (sql, args) => ({
    first: async () => {
      if (/FROM notif_prefs/.test(sql)) return pref ? { rythme: pref } : null;
      if (/MAX\(envoye_le\)/.test(sql)) {
        const vivants = envois.filter(e => e.statut !== 'retenu');
        return { t: vivants.length ? Math.max(...vivants.map(e => e.envoye_le)) : null };
      }
      return null;
    },
    all: async () => ({
      results: /SELECT ouvert_le/.test(sql)
        ? envois.slice(0, SANS_OUVERTURE) : [],
    }),
    run: async () => ({}),
  });
  return { prepare: sql => ({ bind: (...a) => rep(sql, a), ...rep(sql, []) }),
           batch: async () => [] };
}

const TREF = Date.parse('2026-09-05T18:15:00Z');
const ilYA = h => ({ envoye_le: TREF - h * 3600000, ouvert_le: null, statut: 'envoye' });

ok('un joueur neuf recoit',
   (await peutSonner(baseJournal(), 'zoe', 'soir', TREF)).ok);

ok(`deux sonneries a moins de ${ECART_MIN_MS / 3600000} h : la seconde attend`,
   !(await peutSonner(baseJournal({ envois: [ilYA(1)] }), 'zoe', 'soir', TREF)).ok,
   'chacune se justifie seule ; les quatre ensemble font desinstaller');
ok('...et la raison est dite',
   (await peutSonner(baseJournal({ envois: [ilYA(1)] }), 'zoe', 'soir', TREF)).raison
     === 'trop_rapproche');
ok('au-dela, elle part',
   (await peutSonner(baseJournal({ envois: [ilYA(5)] }), 'zoe', 'soir', TREF)).ok);

const sansReponse = { envois: Array.from({ length: SANS_OUVERTURE }, (_, i) => ilYA(24 + i * 12)) };
ok(`${SANS_OUVERTURE} sonneries sans une ouverture : plus qu une par jour`,
   !(await peutSonner(baseJournal(sansReponse), 'zoe', 'midi', TREF)).ok);
ok('...et c est le SOIR qu on garde',
   (await peutSonner(baseJournal(sansReponse), 'zoe', 'soir', TREF)).ok,
   'pas zero : celui qui n ouvre pas cette semaine ouvrira peut-etre la suivante');
ok('...la raison le dit',
   (await peutSonner(baseJournal(sansReponse), 'zoe', 'midi', TREF)).raison === 'sans_ouverture');

const avecOuverture = { envois: [
  { ...ilYA(24), ouvert_le: TREF - 20 * 3600000 },
  ilYA(36), ilYA(48), ilYA(60),
] };
ok('une seule ouverture suffit a revenir a deux par jour',
   (await peutSonner(baseJournal(avecOuverture), 'zoe', 'midi', TREF)).ok);

ok('le choix du joueur l emporte',
   !(await peutSonner(baseJournal({ pref: 'un' }), 'zoe', 'midi', TREF)).ok);
ok('...et la raison le distingue de l anti-fatigue',
   (await peutSonner(baseJournal({ pref: 'un' }), 'zoe', 'midi', TREF)).raison
     === 'rythme_choisi',
   'un joueur qui a choisi n est pas un joueur qui ne repond plus');
ok('...et il recoit quand meme le soir',
   (await peutSonner(baseJournal({ pref: 'un' }), 'zoe', 'soir', TREF)).ok);

titre('UNE COURSE SE PROUVE, ELLE NE SE DECLARE PAS');

// UNE VRAIE TRACE, prise dans le jeu le 6 septembre 2026 : 100 m en 13,858 s,
// 211 points, ligne franchie au point 174. Elle est ici en entier plutot
// qu'imitee — c'est elle qui a fixe les tolerances du module, et une imitation
// aurait valide mes hypotheses au lieu de les mettre a l'epreuve.
const VRAIE = ('0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,'
 + '0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,3,5,8,12,14,19,23,27,33,37,43,'
 + '49,56,61,68,75,82,90,96,104,112,119,128,137,144,152,160,170,179,186,195,204,213,'
 + '223,230,240,249,259,269,276,286,295,306,313,323,333,343,353,362,370,381,391,401,'
 + '409,418,428,438,448,456,466,476,485,495,504,514,524,533,543,551,561,571,581,591,'
 + '599,609,619,629,639,646,656,666,676,686,694,703,714,723,733,744,751,761,771,781,'
 + '791,799,809,819,829,839,846,856,866,876,884,894,904,913,924,932,941,951,961,971,'
 + '979,989,999,1008,1017,1025,1030,1037,1043,1048,1052,1057,1061,1064,1068,1071,1073,'
 + '1076,1078,1080,1082,1083,1085,1087,1088,1089,1090,1091,1092,1093,1094,1094,1095,'
 + '1095,1096,1096,1097,1097,1098,1098').split(',').map(Number);
const VRAI_MS = 13858;

ok('une vraie course passe', verifierTrace(VRAIE, VRAI_MS, '100').length === 0,
   verifierTrace(VRAIE, VRAI_MS, '100').join(' ; '));
ok('...et elle depasse la ligne sans s arreter dessus',
   VRAIE[VRAIE.length - 1] > 1000,
   'le coureur decelere apres l arrivee : la trace ne s arrete pas au chrono');
ok('...et le chrono tombe a moins d un pas du passage de ligne',
   Math.abs(VRAIE.findIndex(d => d >= 1000) * PAS_S - VRAI_MS / 1000) < PAS_S);

ok('rien du tout ne prouve rien', verifierTrace([], VRAI_MS, '100').length > 0);
ok('un seul point non plus', verifierTrace([500], VRAI_MS, '100').length > 0);
ok('une epreuve inconnue est refusee', verifierTrace(VRAIE, VRAI_MS, '800').length > 0);

// Le meme chrono, une trace qui n'arrive jamais.
ok('une course qui n atteint pas la ligne est refusee',
   verifierTrace(VRAIE.map(d => Math.min(d, 900)), VRAI_MS, '100')
     .some(g => /atteint/.test(g)));

// La vraie trace, mais avec un chrono menteur : c'est la fraude la plus
// evidente — joindre une course honnete a un resultat qui ne l'est pas.
ok('une vraie trace avec un faux chrono est refusee',
   verifierTrace(VRAIE, 8200, '100').some(g => /ligne/.test(g)),
   verifierTrace(VRAIE, 8200, '100').join(' ; '));
ok('...meme quand le faux chrono est a peine plus rapide',
   verifierTrace(VRAIE, VRAI_MS - 400, '100').length > 0);
ok('...mais un ecart d un pas passe',
   verifierTrace(VRAIE, VRAI_MS - 70, '100').length === 0,
   'l arrondi joue des deux cotes : on ne refuse pas pour huit centiemes');

// Un coureur ne recule pas.
const recule = VRAIE.slice(); recule[100] = recule[100] - 200;
ok('une trace qui recule est refusee',
   verifierTrace(recule, VRAI_MS, '100').some(g => /recule/.test(g)));

// La trace la plus simple a inventer : une ligne droite instantanee.
const teleporte = [0, 1000, 1000, 1000];
ok('un saut jusqu a la ligne est refuse',
   verifierTrace(teleporte, 240, '100').length > 0,
   verifierTrace(teleporte, 240, '100').join(' ; '));

titre('UN BOND SOUDAIN SE NOTE, IL NE SE PUNIT PAS');

ok('sans passe, rien n est suspect', !vraisemblance(8000, null, 0).suspect);
ok('...ni sous cinq courses', !vraisemblance(6000, 10000, 4).suspect,
   'un joueur qui debute progresse par bonds, et c est normal');
ok('une progression ordinaire passe',
   !vraisemblance(9700, 10000, 50).suspect,
   `3 % d amelioration, seuil a ${(BOND_SUSPECT * 100).toFixed(0)} %`);
ok(`au-dela de ${(BOND_SUSPECT * 100).toFixed(0)} % d un coup, on note`,
   vraisemblance(8000, 10000, 50).suspect);
ok('...et on dit de combien',
   Math.abs(vraisemblance(8000, 10000, 50).bond - 0.2) < 1e-9);
ok('une course PLUS LENTE n est jamais suspecte',
   !vraisemblance(11000, 10000, 50).suspect);

titre('AUCUNE PHRASE N EN ECRASE UNE AUTRE');

// Une clef ecrite deux fois dans le meme dictionnaire ne previent pas : elle
// prend silencieusement la derniere valeur. Cinq des miennes sont tombees sur
// des clefs qui existaient deja cent lignes plus bas, et la carte du defi a
// affiche « il te manque 239 centiemes » a la place de « 239 min avant la
// fin ». Rien ne l'aurait dit sans regarder l'ecran.
{
  const texte = readFileSync('src/game/sprinter-i18n.js', 'utf8');
  const vues = new Map();
  const doubles = [];
  texte.split('\n').forEach((l, i) => {
    const m = l.match(/^\s{4}([A-Za-z_][A-Za-z0-9_]*):\s*\[/);
    if (!m) return;
    const clef = m[1];
    if (vues.has(clef)) doubles.push(`${clef} (lignes ${vues.get(clef)} et ${i + 1})`);
    else vues.set(clef, i + 1);
  });
  ok(`${vues.size} phrases, aucune en double`, doubles.length === 0,
     doubles.join(' ; '));
}

titre('LE MOTEUR SEME REND DEUX FOIS LA MEME COURSE');

// Le noyau du jeu est du JavaScript ancien, sans modules : on le charge comme
// le font les autres harnais, en l'evaluant sur globalThis.
new Function(readFileSync('src/game/sprinter-core.js', 'utf8'))();
const K = globalThis.SprinterCore;

const suite = (n) => Array.from({ length: n }, () => K.alea());

ok('sans graine, le tirage est celui du systeme', K.estSeme() === false);
const libre1 = suite(8), libre2 = suite(8);
ok('...et deux suites libres different',
   libre1.join() !== libre2.join(),
   'un jeu ordinaire ne doit rien changer du tout');

K.semer(1234);
const semee1 = suite(20);
K.semer(1234);
const semee2 = suite(20);
ok('la meme graine rend la meme suite', semee1.join() === semee2.join());
ok('...et le moteur le dit', (K.semer(1234), K.estSeme() === true));

K.semer(1235);
const autre = suite(20);
ok('une graine voisine rend une autre suite', semee1.join() !== autre.join());

ok('tous les tirages restent dans [0,1[',
   semee1.every(v => v >= 0 && v < 1), JSON.stringify(semee1.slice(0, 3)));

// La propriete qui compte pour le jeu : mille tirages semes se repartissent
// comme un hasard. Un generateur biaise donnerait des plateaux tous lents ou
// tous rapides, et le defi serait injuste d'un jour a l'autre plutot que d'un
// joueur a l'autre.
K.semer(99);
const mille = Array.from({ length: 1000 }, () => K.alea());
const moyenne = mille.reduce((a, b) => a + b, 0) / mille.length;
ok(`la moyenne de mille tirages tombe pres de 0,5 (${moyenne.toFixed(3)})`,
   Math.abs(moyenne - 0.5) < 0.03);
const quarts = [0, 0, 0, 0];
for (const v of mille) quarts[Math.min(3, Math.floor(v * 4))]++;
ok(`les quatre quarts sont peuples (${quarts.join(', ')})`,
   quarts.every(q => q > 200 && q < 300));

K.desemer();
ok('on rend la main au hasard du systeme', K.estSeme() === false);
const apres1 = suite(8), apres2 = suite(8);
ok('...et le tirage redevient imprevisible', apres1.join() !== apres2.join(),
   'une graine oubliee ferait rejouer la meme course a l infini');

titre('LES DEUX COTES CALCULENT LA MEME GRAINE');

// Le jeu recalcule la graine plutot que de croire celle qu'on lui envoie. Les
// deux implementations doivent donc rendre le meme nombre, au bit pres — et
// elles vivent dans deux fichiers, dans deux langages.
const { transform } = await import('esbuild');
const tsBrut = readFileSync('src/game/graine.ts', 'utf8')
  // `graine.ts` importe le moteur pour semer ; le hachage, lui, ne depend de
  // rien. On retire l'import plutot que de monter tout le jeu pour six lignes.
  .replace("import { SprinterCore } from './engine';", 'const SprinterCore = globalThis.SprinterCore;');
const { code } = await transform(tsBrut, { loader: 'ts', format: 'esm' });
const jeu = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

for (const texte of ['sprinter', '2026-09-05:midi:100', '', 'é', 'a'.repeat(300)]) {
  ok(`hachage identique pour « ${texte.slice(0, 22)}${texte.length > 22 ? '…' : ''} »`,
     jeu.hash32(texte) === hash32(texte),
     `${jeu.hash32(texte)} vs ${hash32(texte)}`);
}
for (const [j, c, e] of [['2026-09-05', 'midi', '100'], ['2026-12-31', 'soir', '400']]) {
  ok(`meme graine des deux cotes pour ${j} ${c} ${e} m`,
     jeu.graineDe(j, c, e) === graineDe(j, c, e));
}

/* ================================================================ routes */

titre('LES ROUTES REPONDENT');

const joignable = await fetch(B + '/leaderboard?race=100', { signal: AbortSignal.timeout(8000) })
  .then(r => r.ok).catch(() => false);

if (!joignable) {
  console.log(`   ⚠ ${B} ne repond pas — moitie des routes NON VERIFIEE.`);
  console.log('     (cd worker && npx wrangler dev), puis relancer.');
} else {
  const lire = async (u, h = {}) => {
    const r = await fetch(B + u, { headers: h, signal: AbortSignal.timeout(8000) });
    return { statut: r.status, corps: await r.json().catch(() => ({})) };
  };
  const poster = async (u, b) => {
    const r = await fetch(B + u, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(b), signal: AbortSignal.timeout(8000),
    });
    return { statut: r.status, corps: await r.json().catch(() => ({})) };
  };

  // Le coeur du harnais. Un 404 ici veut dire que la route n'existe pas —
  // c'est exactement l'etat dans lequel la fonctionnalite a ete livree.
  const classement = await lire('/objectif/classement?n=3');
  ok('/objectif/classement existe', classement.statut !== 404,
     `statut ${classement.statut}`);
  ok('...et rend une liste', Array.isArray(classement.corps.classement),
     JSON.stringify(classement.corps).slice(0, 80));

  const inconnu = await lire('/objectif?nom=' + encodeURIComponent('ZZ-personne-' + Date.now()));
  ok('/objectif existe', inconnu.statut !== 404, `statut ${inconnu.statut}`);
  ok('...et rend null pour qui n a pas d objectif',
     inconnu.corps.objectif === null, JSON.stringify(inconnu.corps).slice(0, 80));

  const sansNom = await lire('/objectif');
  ok('/objectif sans nom repond 400, pas 404', sansNom.statut === 400,
     `statut ${sansNom.statut}`);

  const inconnuNom = 'ZZ-personne-' + Date.now();
  const appareil = 'dev-preuve-' + Math.random().toString(36).slice(2, 8);
  const tentative = await poster('/objectif/tentative', { nom: inconnuNom, ms: 9000 });
  ok('/objectif/tentative existe', tentative.statut !== 404,
     `statut ${tentative.statut}`);

  titre('LA TENTATIVE NE S ACCEPTE PLUS SUR PAROLE');

  // Le trou que ces tests ferment : la route acceptait `{nom, ms}` et rien de
  // plus. Une ligne de curl validait l'objectif de n'importe quel joueur du
  // classement, ou s'attribuait un 5,00 s.
  ok('sans appareil, on refuse', tentative.statut === 400,
     `statut ${tentative.statut} — c est ce qui empeche de valider a la place d un autre`);

  const horsBornes = await poster('/objectif/tentative',
    { nom: inconnuNom, device_id: appareil, ms: 12 });
  ok('un chrono impossible est refuse', horsBornes.statut === 400,
     `statut ${horsBornes.statut}`);

  const sansPreuve = await poster('/objectif/tentative',
    { nom: inconnuNom, device_id: appareil, ms: 9000 });
  ok('sans trace, la course est refusee', sansPreuve.statut === 422,
     `statut ${sansPreuve.statut} ${JSON.stringify(sansPreuve.corps).slice(0, 60)}`);
  ok('...en disant ce qui cloche', Array.isArray(sansPreuve.corps.griefs)
     && sansPreuve.corps.griefs.length > 0,
     JSON.stringify(sansPreuve.corps.griefs));

  const bidon = await poster('/objectif/tentative',
    { nom: inconnuNom, device_id: appareil, ms: 5000, trace: [0, 1000, 1000] });
  ok('une trace inventee est refusee', bidon.statut === 422,
     JSON.stringify(bidon.corps.griefs || bidon.corps).slice(0, 90));

  // Une vraie trace, avec le bon chrono : elle passe la preuve, et le serveur
  // repond alors « pas d'objectif ouvert » — ce qui est la verite pour ce nom.
  const vraie = await poster('/objectif/tentative',
    { nom: inconnuNom, device_id: appareil, ms: 13858, trace: VRAIE });
  ok('une vraie course passe la preuve', vraie.statut === 200,
     `statut ${vraie.statut} ${JSON.stringify(vraie.corps).slice(0, 60)}`);
  ok('...et rend null quand aucun objectif n est ouvert',
     vraie.corps.objectif === null, JSON.stringify(vraie.corps).slice(0, 80));

  // `/objectif/suspectes` et non `/signalements` : ce dernier nom appartient a
  // la moderation des duels, table comprise. Avoir pris le nom a coute un 500
  // en production et un anti-triche qui n'ecrivait rien.
  const sig = await lire('/objectif/suspectes');
  ok('les courses suspectes sont fermees sans cle d administration',
     sig.statut === 403, `statut ${sig.statut}`);

  titre('LE RECORD PERSONNEL SUIT LES COURSES');

  const inconnu2 = await lire('/record?nom=' + encodeURIComponent('ZZ-' + Date.now()));
  ok('/record existe', inconnu2.statut !== 404, `statut ${inconnu2.statut}`);
  ok('...et rend null pour qui n a jamais couru',
     inconnu2.corps.record_ms === null, JSON.stringify(inconnu2.corps).slice(0, 90));
  ok('...en annoncant le sens de l epreuve',
     inconnu2.corps.direction === 'plus_bas', String(inconnu2.corps.direction));
  ok('/record refuse une epreuve inconnue',
     (await lire('/record?nom=zoe&race=800')).statut === 400);
  ok('/record refuse un nom vide', (await lire('/record')).statut === 400);
}

/* ======================================================= record et courses */

// Ce qui suit ECRIT, donc uniquement en local : on ne fabrique pas de courses
// dans la base de production pour verifier une regle.
if (joignable && !B.includes('workers.dev')) {
  const lire = async (u, h = {}) => (await fetch(B + u, { headers: h })).json();
  const poster = async (u, b, h = {}) => {
    const r = await fetch(B + u, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...h },
      body: JSON.stringify(b),
    });
    return { statut: r.status, corps: await r.json().catch(() => ({})) };
  };

  const marque = Math.random().toString(36).slice(2, 7);
  const nom = 'REC' + marque;
  const appareil = 'dev-rec-' + marque;
  const course = ms => poster('/race', {
    device_id: appareil, name: nom, race_key: '100',
    time_ms: ms, mode: 'oneshot', level_idx: 4,
  });

  const premiere = await course(9200);
  ok('la premiere course pose le record', premiere.corps.record?.ms === 9200,
     JSON.stringify(premiere.corps));
  ok('...et n avait rien a battre', premiere.corps.record?.ancien_ms === null);

  const pire = await course(9800);
  ok('une course plus lente ne touche pas au record', pire.corps.record === null);

  const mieux = await course(8700);
  ok('une course plus rapide le remplace', mieux.corps.record?.ms === 8700);
  ok('...en disant ce qu elle a battu', mieux.corps.record?.ancien_ms === 9200);

  const egale = await course(8700);
  ok('egaler son record n est pas le battre', egale.corps.record === null,
     'sinon chaque egalite ferait clignoter « NOUVEAU RECORD »');

  const vu = await lire('/record?nom=' + encodeURIComponent(nom));
  ok('/record rend le record du joueur', vu.record_ms === 8700, JSON.stringify(vu));
  ok('...et compte ses courses', vu.courses === 4, `${vu.courses} courses`);
  ok('...et sa place', typeof vu.rang === 'number' && vu.rang >= 1, `rang ${vu.rang}`);

  // Le meme joueur sur un second appareil : un seul record, pas deux.
  await poster('/race', {
    device_id: 'dev-rec2-' + marque, name: nom, race_key: '100',
    time_ms: 8400, mode: 'oneshot', level_idx: 4,
  });
  const deuxAppareils = await lire('/record?nom=' + encodeURIComponent(nom));
  ok('deux appareils, un seul record', deuxAppareils.record_ms === 8400,
     `record ${deuxAppareils.record_ms}`);

  titre('UNE COURSE ANONYME N A PAS DE RECORD');

  // Le piege que ce harnais existe pour tenir ferme. `/race` enregistre sous
  // « Anonyme » quand le joueur n'a pas de nom, et le classement regroupe PAR
  // NOM. Creer une ligne pour ces courses ferait entrer « Anonyme » au tableau
  // comme un seul joueur, avec le meilleur temps de tous les anonymes — mesure
  // sur la production du 6 septembre 2026 : 301 appareils, 1 399 courses,
  // meilleur 8,13 s, soit la premiere place devant le record reel de 8,25 s.
  ok('« Anonyme » est reconnu comme une absence de nom', estAnonyme('Anonyme'));
  ok('...quelle que soit la casse', estAnonyme('  anonyme '));
  ok('...comme une chaine vide', estAnonyme('') && estAnonyme(null));
  ok('...mais un vrai nom n en est pas une', !estAnonyme('Zoe'));

  const fantomeAnonyme = 'dev-anon-' + Math.random().toString(36).slice(2, 7);
  const anon = await poster('/race', {
    device_id: fantomeAnonyme, name: 'Anonyme', race_key: '100',
    time_ms: 7900, mode: 'oneshot', level_idx: 4,
  });
  ok('une course anonyme tres rapide ne pose aucun record',
     anon.corps.record === null, JSON.stringify(anon.corps));

  const tableau = await lire('/leaderboard?race=100');
  ok('...et « Anonyme » n apparait pas au classement',
     !(tableau.entries || []).some(e => estAnonyme(e.name)),
     (tableau.entries || []).filter(e => estAnonyme(e.name)).map(e => e.name).join(', '));

  const recalculAnon = await poster('/records/recalculer', {},
    { 'X-Sprinter-Admin': ADMIN });
  ok('le recalcul les compte sans les inscrire',
     recalculAnon.corps.anonymes > 0 && recalculAnon.corps.crees === 0,
     JSON.stringify(recalculAnon.corps).slice(0, 100));

  // Et meme quand on lui demande explicitement de creer, l'anonyme reste
  // dehors : le drapeau ouvre la porte aux joueurs NOMMES, pas au trou.
  const avecCreation = await poster('/records/recalculer', { creer: true },
    { 'X-Sprinter-Admin': ADMIN });
  ok('« creer » n inscrit toujours pas les anonymes',
     avecCreation.corps.anonymes > 0,
     JSON.stringify(avecCreation.corps).slice(0, 110));
  ok('...et le classement reste sans « Anonyme »',
     !((await lire('/leaderboard?race=100')).entries || []).some(e => estAnonyme(e.name)));

  const tableauApres = await lire('/leaderboard?race=100');
  ok('...et le classement ne contient toujours pas « Anonyme »',
     !(tableauApres.entries || []).some(e => estAnonyme(e.name)));

  titre('LES MESURES DISENT LE VRAI, MEME QUAND SQL PREFERE NULL');

  // Cinq defis dont on connait les chiffres a la main. Deux bugs se sont caches
  // ici, et aucun des deux ne plantait :
  //
  //   `NULL IN ('argent','or')` ne vaut pas faux, il vaut NULL — que AND
  //   propage, que NOT propage encore, et qu'un CASE compte comme zero. Le
  //   joueur qui court une fois sans rien decrocher, exactement celui qui rate
  //   et ne relance pas, sortait du denominateur : 100 % annonce pour 67 %.
  //
  //   Et `date(julianday(jour) + n - 2440588)` rendait une date qui ne
  //   correspondait a rien : la retention repondait zero, tout le temps, ce qui
  //   ressemble a « personne ne revient » et se lit comme un resultat.
  //
  // ON PEUPLE LA BASE DIRECTEMENT, par wrangler, et jamais par une route. Une
  // route d'essai est une porte de plus a tenir fermee en production ; le
  // harnais, lui, n'existe que sur cette machine.
  // Uniquement contre le worker local ORDINAIRE : le harnais peuple la base de
  // `worker/`, et un worker monte ailleurs — celui de l'essai sur base neuve,
  // par exemple — a la sienne. Interroger l'un en peuplant l'autre ne dit rien.
  if (B !== 'http://127.0.0.1:8788') {
    console.log(`   (mesures verifiees contre le worker local de worker/, pas ${B})`);
  } else {
    const { execFileSync } = await import('node:child_process');
    const sql = (commande) => execFileSync('npx',
      ['wrangler', 'd1', 'execute', 'sprinter-leaderboard', '--local',
       '--json', '--command', commande],
      { cwd: 'worker', maxBuffer: 32 * 1024 * 1024 }).toString();

    const marque = 'tm' + Math.random().toString(36).slice(2, 7);
    const maintenant = Date.now();
    const hier = maintenant - 86400000;
    const jourHier = new Date(hier).toISOString().slice(0, 10);
    const o = (qui, n, palier, valide) =>
      `('${marque}-${qui}','${jourHier}','midi','100',8800,8500,0.035,'repli',` +
      `${hier},${n},${palier ? 8700 : 9900},${valide ? hier : 'NULL'},0,` +
      `${palier ? `'${palier}'` : 'NULL'})`;

    // ON MESURE L'ECART, PAS LE TOTAL. La base locale peut deja contenir des
    // objectifs — les miens d'hier, ceux d'un autre essai — et vider la base
    // de quelqu'un pour faire passer un test est le genre de service qu'on ne
    // rend pas. Ce qu'on ajoute est connu ; c'est donc ce qu'on verifie.
    const avant = await lire('/objectif/mesures?jours=2', { 'X-Sprinter-Admin': ADMIN });

    sql(`DELETE FROM objectifs WHERE name_key LIKE '${marque}%';
         DELETE FROM races WHERE name_key LIKE '${marque}%';
         INSERT INTO objectifs (name_key,jour,creneau,race_key,cible_ms,pb_ms,
           marge,methode,cree_le,tentatives,meilleur_ms,valide_le,points,palier)
         VALUES ${[
           o('a', 4, 'argent', true),   // relance puis valide
           o('b', 1, 'argent', true),   // valide du premier coup
           o('c', 2, 'bronze', false),  // relance, pas valide
           o('d', 1, null, false),      // rate une fois, ne relance pas
           o('e', 0, null, false),      // servi, jamais joue
         ].join(',')};
         INSERT INTO races (device_id,name_key,name,race_key,time_ms,mode,level_idx,created_at)
         VALUES ('dtm','${marque}-a','A','100',8700,'oneshot',4,${maintenant}),
                ('dtm','${marque}-c','C','100',9000,'oneshot',4,${maintenant});`);

    const m = await lire('/objectif/mesures?jours=2', { 'X-Sprinter-Admin': ADMIN });
    const d = (apres, av) => (apres || 0) - (av || 0);
    const k = m.kpi_courses_par_defi, ka = avant.kpi_courses_par_defi;
    const palierDe_ = x => Object.fromEntries((x.paliers || []).map(p => [p.palier, p.n]));
    const pa = palierDe_(avant), pm = palierDe_(m);

    ok('quatre defis joues de plus, sur cinq servis de plus',
       d(k.defis_joues, ka.defis_joues) === 4
       && d(m.participation.servis, avant.participation.servis) === 5,
       JSON.stringify({ joues: d(k.defis_joues, ka.defis_joues),
                        servis: d(m.participation.servis, avant.participation.servis) }));
    ok('huit courses de plus', d(k.courses, ka.courses) === 8,
       String(d(k.courses, ka.courses)));
    ok('un seul defi de plus atteint les trois courses',
       d(k.au_moins_trois, ka.au_moins_trois) === 1,
       String(d(k.au_moins_trois, ka.au_moins_trois)));

    ok('deux argents, un bronze, un rien',
       d(pm.argent, pa.argent) === 2 && d(pm.bronze, pa.bronze) === 1
       && d(pm.rien, pa.rien) === 1,
       JSON.stringify({ argent: d(pm.argent, pa.argent),
                        bronze: d(pm.bronze, pa.bronze), rien: d(pm.rien, pa.rien) }));

    ok('la revanche compte TROIS echecs de plus, pas deux',
       d(m.revanche.apres_echec, avant.revanche.apres_echec) === 3
       && d(m.revanche.relances, avant.revanche.relances) === 2,
       `${d(m.revanche.relances, avant.revanche.relances)}/` +
       `${d(m.revanche.apres_echec, avant.revanche.apres_echec)} — celui qui rate sans ` +
       `rien decrocher a un palier NULL, et SQL le faisait disparaitre du denominateur`);

    const j1 = m.retention.find(r => r.jour === 'J1');
    const j1a = avant.retention.find(r => r.jour === 'J1');
    ok('la retention J1 voit les DEUX qui sont revenus',
       d(j1.cohorte, j1a.cohorte) === 5 && d(j1.revenus, j1a.revenus) === 2,
       `${d(j1.revenus, j1a.revenus)}/${d(j1.cohorte, j1a.cohorte)} — une date julienne ` +
       `mal convertie rendait zero, ce qui se lit comme « personne ne revient »`);

    sql(`DELETE FROM objectifs WHERE name_key LIKE '${marque}%';
         DELETE FROM races WHERE name_key LIKE '${marque}%';`);
  }

  titre('LE RECALCUL SE REJOUE SANS RIEN CASSER');

  const sansCle = await poster('/records/recalculer', {});
  ok('le recalcul refuse sans cle d administration', sansCle.statut === 403,
     `statut ${sansCle.statut}`);

  const entete = { 'X-Sprinter-Admin': ADMIN };
  const un = await poster('/records/recalculer', {}, entete);
  ok('le recalcul repond', un.statut === 200, JSON.stringify(un.corps).slice(0, 90));

  const deux = await poster('/records/recalculer', {}, entete);
  ok('...et un second passage ne corrige plus rien',
     deux.corps.corriges === 0 && deux.corps.crees === 0,
     JSON.stringify(deux.corps).slice(0, 90));

  const apres = await lire('/record?nom=' + encodeURIComponent(nom));
  ok('...sans avoir degrade le record',
     apres.record_ms === deuxAppareils.record_ms,
     `${deuxAppareils.record_ms} puis ${apres.record_ms}`);

  // Le cas qui a motive tout ceci : un record perime en base, un historique
  // qui porte mieux. Le recalcul doit le rattraper.
  await poster('/race', {
    device_id: appareil, name: nom, race_key: '100',
    time_ms: 8100, mode: 'oneshot', level_idx: 4,
  });
  const trois = await poster('/records/recalculer', {}, entete);
  ok('un historique meilleur que le record est rattrape',
     (await lire('/record?nom=' + encodeURIComponent(nom))).record_ms === 8100,
     JSON.stringify(trois.corps).slice(0, 90));
}

console.log('\n──────────────────────────────────────────────────────────────');
console.log(e ? `   ${e} ECHEC(S).` : '   TOUT PASSE.');
process.exit(e ? 1 : 0);
