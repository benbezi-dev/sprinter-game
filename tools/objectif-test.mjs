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

import {
  calibrer, quantile, fuseauDe, creneauMaintenant, heureLocale, creerObjectif,
  MARGE_MIN, MARGE_MAX, MARGE_REPLI, COURSES_MIN,
} from '../worker/src/objectif.js';

const B = process.env.BASE || 'http://127.0.0.1:8788';

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

// 12:00 a Paris en heure d ete, c est 10:00 UTC.
const midiParis = new Date('2026-09-05T10:00:00Z');
ok('midi a Paris ouvre le creneau du midi',
   creneauMaintenant(midiParis, 'Europe/Paris')?.creneau === 'midi');
ok('...et personne a New York au meme instant',
   creneauMaintenant(midiParis, 'America/New_York') === null);
ok('19:00 a Paris ouvre le creneau du soir',
   creneauMaintenant(new Date('2026-09-05T17:00:00Z'), 'Europe/Paris')?.creneau === 'soir');
ok('12:30 n ouvre rien',
   creneauMaintenant(new Date('2026-09-05T10:30:00Z'), 'Europe/Paris') === null);

// Les fuseaux a la demie et au quart d heure : le cron passe tous les quarts
// d heure, et c est ce qui garantit que personne n est manque.
ok('l Inde (+05:30) tombe juste',
   creneauMaintenant(new Date('2026-09-05T06:30:00Z'), 'Asia/Kolkata')?.creneau === 'midi');
ok('le Nepal (+05:45) tombe juste',
   creneauMaintenant(new Date('2026-09-05T06:15:00Z'), 'Asia/Kathmandu')?.creneau === 'midi');
ok('un fuseau illisible replie sur UTC sans lever',
   heureLocale(new Date('2026-09-05T10:00:00Z'), 'Pas/Un/Fuseau').heure === 10);

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
}

console.log('\n──────────────────────────────────────────────────────────────');
console.log(e ? `   ${e} ECHEC(S).` : '   TOUT PASSE.');
process.exit(e ? 1 : 0);
