// Noel 2026 — boules de neige et etoile du sapin (worker/src/noel.js), sur une
// base SQLite en memoire : entree, etoile allumee, fantome = derniere course,
// boules, neige qui ralentit puis fond, secouer en recourant, vol d'etoile,
// poids de l'etoile, un point par version, et le classement.
//
//   node tools/noel-test.mjs
import { DatabaseSync } from 'node:sqlite';
import {
  noterCourse, lancer, fantome, tableau, facteur, poidsEtoile, points,
  BOULES_DEPART, NEIGE_PCT, NEIGE_MAX, NEIGE_DUREE_MS, ETOILE_MAX, VOL_POINTS,
} from '../worker/src/noel.js';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || d === undefined ? '' : ' — ' + JSON.stringify(d)}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const base = new DatabaseSync(':memory:');
const db = {
  prepare(sql) {
    const faire = (args) => ({
      all: async () => ({ results: base.prepare(sql).all(...args) }),
      first: async () => base.prepare(sql).get(...args) ?? null,
      run: async () => { const r = base.prepare(sql).run(...args); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; },
    });
    return { bind: (...args) => faire(args), ...faire([]) };
  },
  async batch(liste) { for (const x of liste) await x.run(); return []; },
};

/** Une trace honnete de 60 m : decimetres tous les 0,08 s, ligne a `ms`. */
const traceDe = (ms) => {
  const n = Math.ceil(ms / 80) + 3;
  return Array.from({ length: n }, (_, i) => Math.round(600 * (i * 80) / ms));
};
let t = Date.UTC(2026, 11, 1, 18);
const H = 3600 * 1000;
const course = (k, ms, cible = null) =>
  noterCourse(db, { nameKey: k, name: k[0].toUpperCase() + k.slice(1), epreuve: '60', timeMs: ms, trace: traceDe(ms), cibleKey: cible, maintenant: t });

titre('le poids');
ok('sans rien, facteur 1', facteur({}) === 1);
ok('dix boules : +5 %', Math.abs(facteur({ neige: 10 }) - 1.05) < 1e-9);
ok('neige plafonnee a NEIGE_MAX', facteur({ neige: 99 }) === facteur({ neige: NEIGE_MAX }));
ok('etoile : +0,5 % par heure', Math.abs(poidsEtoile(6 * H) - 0.03) < 1e-9);
ok('etoile plafonnee', poidsEtoile(100 * H) === ETOILE_MAX);
ok('neige et etoile se multiplient', Math.abs(facteur({ neige: 10, etoileDepuis: 0, maintenant: 6 * H }) - 1.05 * 1.03) < 1e-9);

titre('entree et etoile');
let r = await course('kin', 9917);
ok('kin entre, allume l etoile, a ses boules', r.status === 200 && r.corps.etoile_allumee && r.corps.boules === BOULES_DEPART, r.corps);
r = await course('barnabe', 9929);
ok('barnabe entre sans allumer', r.corps.etoile_allumee === false && r.corps.boules === BOULES_DEPART);
await course('boa', 10217);
await course('pixou', 10308);
await course('moyen', 10717);
let tab = await tableau(db, { nameKey: 'pixou', maintenant: t });
ok('l etoile est a kin', tab.etoile && tab.etoile.key === 'kin');
ok('arene triee du plus dur a battre', tab.arene[0].key === 'kin' && tab.arene.at(-1).key === 'moyen', tab.arene.map(a => a.key));

titre('trace refusee, autre epreuve');
r = await noterCourse(db, { nameKey: 'triche', name: 'Triche', epreuve: '60', timeMs: 9000, trace: traceDe(11000), maintenant: t });
ok('chrono que la trace ne soutient pas : 422', r.status === 422);
r = await noterCourse(db, { nameKey: 'kin', name: 'Kin', epreuve: '200', timeMs: 19783, trace: [], maintenant: t });
ok('200 m : hors evenement', r.corps.ok === false);

titre('battre un fantome');
r = await course('pixou', 10290, 'moyen');
ok('pixou bat moyen : point et boule', r.corps.duel.gagne && r.corps.duel.nouveau && r.corps.boules === BOULES_DEPART + 1, r.corps);
r = await course('pixou', 10280, 'moyen');
ok('meme version de moyen : plus rien', r.corps.duel.gagne && !r.corps.duel.nouveau && r.corps.boules === BOULES_DEPART + 1, r.corps);
r = await course('pixou', 10300, 'kin');
ok('pixou ne bat pas kin frais', r.corps.duel.gagne === false);
ok('et son fantome est sa DERNIERE course', (await fantome(db, { cibleKey: 'pixou', maintenant: t })).corps.ms === 10300);
r = await course('pixou', 12000, 'kin');
ok('une course ratee remplace aussi le fantome', (await fantome(db, { cibleKey: 'pixou', maintenant: t })).corps.ms === 12000);
await course('pixou', 10308);

titre('les boules de neige');
r = await lancer(db, { nameKey: 'pixou', name: 'Pixou', cibleKey: 'pixou', n: 1, maintenant: t });
ok('pas sur soi', r.status === 400);
r = await lancer(db, { nameKey: 'pixou', name: 'Pixou', cibleKey: 'kin', n: 99, maintenant: t });
ok('pas plus que sa poche', r.status === 200 && r.corps.lancees === BOULES_DEPART + 1 && r.corps.boules === 0, r.corps);
ok('la cible est prevenue', r.sonner && r.sonner.pour === 'kin' && r.sonner.genre === 'noel_neige');
r = await lancer(db, { nameKey: 'pixou', name: 'Pixou', cibleKey: 'kin', n: 1, maintenant: t });
ok('poche vide : refuse', r.status === 409);
r = await lancer(db, { nameKey: 'boa', name: 'Boa', cibleKey: 'kin', n: 3, maintenant: t });
ok('une seule sonnerie par heure', r.status === 200 && r.sonner === null);
let f = await fantome(db, { cibleKey: 'kin', maintenant: t });
ok('kin porte 7 boules', f.corps.neige === 7, f.corps);
ok('son chrono a battre monte de 3,5 %', f.corps.a_battre_ms === Math.round(9917 * (1 + 7 * NEIGE_PCT)), f.corps);
r = await lancer(db, { nameKey: 'inconnu', name: 'X', cibleKey: 'kin', n: 1, maintenant: t });
ok('sans fantome, pas de boule', r.status === 409);

titre('l etoile pese, et tombe');
t += 6 * H;
f = await fantome(db, { cibleKey: 'kin', maintenant: t });
const attendu = Math.round(9917 * (1 + 7 * NEIGE_PCT) * 1.03);
ok('six heures plus tard : neige et etoile', f.corps.a_battre_ms === attendu, { a: f.corps.a_battre_ms, attendu });
r = await course('boa', 10217, 'kin');
ok('boa (10,22) bat kin enneige et alourdi', r.corps.duel.gagne && r.corps.duel.etoile, r.corps.duel);
ok('kin est prevenu du vol', r.sonner && r.sonner.pour === 'kin' && r.sonner.genre === 'noel_etoile');
tab = await tableau(db, { nameKey: 'kin', maintenant: t });
ok('l etoile est a boa, depuis maintenant', tab.etoile.key === 'boa' && tab.etoile.tenue_ms === 0);
const kin = tab.classement.find(x => x.key === 'kin');
ok('kin garde ses six heures : 24 points', kin.tenue_ms === 6 * H && kin.points === 24, kin);
const boa = tab.classement.find(x => x.key === 'boa');
ok('boa : un fantome + un vol', boa.points === 1 + VOL_POINTS, boa);
ok('le fil raconte le vol', tab.fil[0].genre === 'vol' && tab.fil[0].a === 'Boa' && tab.fil[0].b === 'Kin');

titre('recourir secoue la neige');
r = await course('kin', 9950);
ok('kin recourt : 7 boules secouees', r.corps.secoue === 7, r.corps);
f = await fantome(db, { cibleKey: 'kin', maintenant: t });
ok('et il est de nouveau frais (sans etoile)', f.corps.neige === 0 && f.corps.a_battre_ms === 9950, f.corps);
r = await course('boa', 10217, 'kin');
ok('boa ne le bat plus', r.corps.duel.gagne === false);
ok('et boa garde l etoile', (await tableau(db, { maintenant: t })).etoile.key === 'boa');

titre('la neige fond');
await lancer(db, { nameKey: 'boa', name: 'Boa', cibleKey: 'barnabe', n: 1, maintenant: t });
ok('barnabe enneige', (await fantome(db, { cibleKey: 'barnabe', maintenant: t })).corps.neige === 1);
ok('fondu apres 24 h', (await fantome(db, { cibleKey: 'barnabe', maintenant: t + NEIGE_DUREE_MS + 1 })).corps.neige === 0);

titre('nouvelle version, nouvelle proie');
r = await course('pixou', 10290, 'moyen');
ok('moyen deja battu', !r.corps.duel.nouveau);
await course('moyen', 10700);
r = await course('pixou', 10290, 'moyen');
ok('moyen a recouru : de nouveau une proie', r.corps.duel.nouveau && r.corps.duel.boule);

titre('points');
ok('formule', points({ battus: 3, vols: 1, tenue_ms: 2 * H }) === 3 + VOL_POINTS + 8);

console.log(e ? `\n✗ ${e} echec(s)` : '\n✓ tout passe');
process.exit(e ? 1 : 0);
