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
  MARGE_MIN, MARGE_MAX, MARGE_REPLI, COURSES_MIN, ACTIF_JOURS,
} from '../worker/src/objectif.js';
import {
  PLUS_BAS, PLUS_HAUT, directionDe, estMeilleur, meilleurDe, agregatSql,
} from '../worker/src/epreuves.js';
import { estAnonyme } from '../worker/src/records.js';

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

titre('LES TENTATIVES SONT ILLIMITEES, ET SEULE LA MEILLEURE COMPTE');

/** Une base qui ne tient qu'un objectif, et applique l'ecriture qu'on lui fait. */
function baseObjectif(ligne) {
  const etat = Object.assign({
    name_key: 'zoe', jour: '2026-09-05', creneau: 'midi', race_key: '100',
    cible_ms: 8800, pb_ms: 8500, tentatives: 0, meilleur_ms: null,
    valide_le: null, points: 0, ouvre_le: null, expire_le: null,
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
        const [tent, meilleur, valide, pts] = args;
        etat.tentatives = tent;
        etat.meilleur_ms = meilleur;
        etat.valide_le = etat.valide_le ?? valide;      // COALESCE
        etat.points = (etat.points || 0) + pts;
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
  const db = baseObjectif(ouverte);
  const rate = await enregistrerTentative(db, 'zoe', 'Zoe', 9100, t0);
  ok('une course ratee compte comme tentative', rate.essai === 1 && !rate.reussi);
  ok('...et pose le meilleur temps de la session', db.etat.meilleur_ms === 9100);
  ok('...sans rapporter de points', rate.points === 0 && db.credits.length === 0);

  const gagne = await enregistrerTentative(db, 'zoe', 'Zoe', 8700, t0);
  ok('la course suivante valide', gagne.reussi && gagne.essai === 2);
  ok('...et rapporte', gagne.points > 0 && db.credits.length === 1);
  ok('...et le meilleur temps suit', db.etat.meilleur_ms === 8700);

  const encore = await enregistrerTentative(db, 'zoe', 'Zoe', 8600, t0);
  ok('on peut continuer APRES avoir valide', encore !== null && encore.essai === 3,
     'sinon on ferme la porte a celui qui vient justement de reussir');
  ok('...le jeu le sait', encore.dejaValide === true);
  ok('...la meilleure course est retenue', db.etat.meilleur_ms === 8600);
  ok('...et les points ne tombent qu une fois',
     encore.points === 0 && db.credits.length === 1,
     `${db.credits.length} credit(s)`);

  const moinsBien = await enregistrerTentative(db, 'zoe', 'Zoe', 9500, t0);
  ok('une course plus lente ne degrade pas le meilleur temps',
     db.etat.meilleur_ms === 8600 && moinsBien.essai === 4);
  ok('...et n efface pas l heure de validation', db.etat.valide_le !== null);
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

/* ================================================================ routes */

titre('LES ROUTES REPONDENT');

const joignable = await fetch(B + '/leaderboard?race=100', { signal: AbortSignal.timeout(8000) })
  .then(r => r.ok).catch(() => false);

if (!joignable) {
  console.log(`   ⚠ ${B} ne repond pas — moitie des routes NON VERIFIEE.`);
  console.log('     (cd worker && npx wrangler dev), puis relancer.');
} else {
  const lire = async u => {
    const r = await fetch(B + u, { signal: AbortSignal.timeout(8000) });
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

  const tentative = await poster('/objectif/tentative',
    { nom: 'ZZ-personne-' + Date.now(), ms: 9000 });
  ok('/objectif/tentative existe', tentative.statut !== 404,
     `statut ${tentative.statut}`);
  ok('...et rend null quand aucun objectif n est ouvert',
     tentative.corps.objectif === null || tentative.statut === 429,
     JSON.stringify(tentative.corps).slice(0, 80));

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
  const lire = async u => (await fetch(B + u)).json();
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
