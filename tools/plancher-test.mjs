// Le plancher des chronos (worker/src/plancher.js), route par route, sur une
// base SQLite en memoire : un chrono sous le plancher de son epreuve est
// refuse, un chrono juste au-dessus est accepte, une trace qui ne raconte pas
// le chrono est ecartee du fantome sans refuser le score. Les epreuves sans
// plancher (haies) gardent le comportement d'avant.
//
//   node tools/plancher-test.mjs
import { DatabaseSync } from 'node:sqlite';
import worker from '../worker/src/index.js';
import {
  plancherMs, plancherTotalMs, sousLePlancher, sousLePlancherTotal, traceIncoherente,
} from '../worker/src/plancher.js';
import { enregistrerCourse } from '../worker/src/championnats.js';
import { SalleDirecte } from '../worker/src/salle.js';
import { SalleChampionnat } from '../worker/src/salle-championnat.js';
import { noterCourse, choisirCamp } from '../worker/src/marques.js';

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

const ctx = { waitUntil(p) { Promise.resolve(p).catch(() => {}); }, passThroughOnException() {} };
const ENV = { DB: db, ADMIN_CLE: 'cle-admin-de-test' };
const appeler = async (chemin, corps, entetes = {}) => {
  const r = await worker.fetch(new Request('https://x.test' + chemin, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...entetes },
    body: JSON.stringify(corps),
  }), ENV, ctx);
  let json = null; try { json = await r.json(); } catch { /* vide */ }
  return { status: r.status, json };
};
const PLANCHER_MSG = 'temps impossible sur cette epreuve';
let n = 0;
const appareil = () => `appareil-plancher-${String(++n).padStart(4, '0')}`;
const nom = () => `Coureur${n}`;

/* ------------------------------------------------------------ les seuils */
titre('les seuils derives du moteur');
const P100 = plancherMs('100'), P200 = plancherMs('200'), P400 = plancherMs('400');
ok('100 m : 7,717 s (7,718 arrondi)', P100 === 7717, P100);
ok('200 m : 15,966 s (15,967 arrondi)', P200 === 15966, P200);
ok('400 m : 33,276 s', P400 === 33276, P400);
ok('haies : la seconde forfaitaire, pas de plancher derive',
  plancherMs('100h') === 1000 && plancherMs('110h') === 1000 && plancherMs('400h') === 1000);
ok('un cumul 100+200 : la somme des deux', plancherTotalMs(['100', '200']) === P100 + P200);
ok('un cumul 100+haies : seul le 100 compte', plancherTotalMs(['100', '100h']) === P100);
ok('un cumul de haies seules : la seconde forfaitaire, comme avant', plancherTotalMs(['100h', '110h', '400h']) === 1000);
ok('sousLePlancher : juste dessous / juste dessus',
  sousLePlancher('100', P100 - 1) && !sousLePlancher('100', P100));
ok('sousLePlancher : jamais sur les haies', !sousLePlancher('100h', 1500));
ok('sousLePlancherTotal : jamais sans epreuve a plancher', !sousLePlancherTotal(['110h'], 1500));
ok('sousLePlancherTotal : 100+200 a P100+P200-1',
  sousLePlancherTotal(['100', '200'], P100 + P200 - 1) && !sousLePlancherTotal(['100', '200'], P100 + P200));

/* ---------------------------------------------- la coherence d'une trace */
titre('traceIncoherente');
// Un 100 m en 10 s : 125 releves de 80 ms, de 0 a 1000 dm, regulierement.
const trace = (ms, dm, bruit = 0) => {
  const pts = Math.round(ms / 80);
  return Array.from({ length: pts }, (_, i) => Math.round(dm * (i + 1) / pts) + bruit);
};
ok('une trace de la bonne duree : coherente', !traceIncoherente('100', 10000, trace(10000, 1000)));
ok('une trace de 30 points pour un chrono de 10 s : incoherente', traceIncoherente('100', 10000, trace(2400, 1000)));
ok('une trace de 400 points pour un chrono de 10 s : incoherente', traceIncoherente('100', 10000, trace(32000, 1000)));
const saut = trace(10000, 1000); saut[60] = saut[59] + 200;
ok('un bond de 20 m en 80 ms : incoherent', traceIncoherente('100', 10000, saut));
ok('une trace vide : rien a juger', !traceIncoherente('100', 10000, []));
ok('haies : pas jugee', !traceIncoherente('110h', 10000, trace(2400, 1100)));

/* --------------------------------------------------------------- /submit */
titre('POST /submit');
const soumet = (o) => appeler('/submit', {
  device_id: appareil(), name: nom(), race_key: '100', time_ms: 10000, best_split_ms: 10000, ...o,
});
let r = await soumet({ time_ms: P100 - 1, best_split_ms: P100 - 1 });
ok('100 m : cumul sous le plancher refuse', r.status === 400 && r.json.error === PLANCHER_MSG, r);
r = await soumet({ time_ms: 12000, best_split_ms: 1 });
ok('100 m : best_split_ms: 1 refuse (c\'est lui qui classe)', r.status === 400 && r.json.error === PLANCHER_MSG, r);
r = await soumet({ time_ms: 12000, best_split_ms: P100 - 1 });
ok('100 m : best_split_ms juste sous le plancher refuse', r.status === 400 && r.json.error === PLANCHER_MSG, r);
r = await soumet({ time_ms: P100, best_split_ms: P100 });
ok('100 m : pile au plancher accepte', r.status === 200, r);
r = await soumet({ race_key: '200', time_ms: P200 - 1, best_split_ms: P200 - 1 });
ok('200 m : sous le plancher refuse', r.status === 400 && r.json.error === PLANCHER_MSG, r);
r = await soumet({ race_key: '200', time_ms: P200, best_split_ms: P200 });
ok('200 m : au plancher accepte', r.status === 200, r);
r = await soumet({ race_key: '400', time_ms: P400 - 1, best_split_ms: P400 - 1 });
ok('400 m : sous le plancher refuse', r.status === 400 && r.json.error === PLANCHER_MSG, r);
r = await soumet({ race_key: '400', time_ms: P400, best_split_ms: P400 });
ok('400 m : au plancher accepte', r.status === 200, r);
r = await soumet({ race_key: '110h', time_ms: 1500, best_split_ms: 1500 });
ok('110 m haies : aucun plancher nouveau (1,5 s passe toujours)', r.status === 200, r);
r = await soumet({ race_key: '110h', time_ms: 900, best_split_ms: 900 });
ok('110 m haies : la seconde forfaitaire d\'avant tient toujours', r.status === 400 && r.json.error === 'temps invalide', r);
const NO_RUN = 20 * 60000;
r = await soumet({ time_ms: NO_RUN, best_split_ms: 9000 });
ok('100 m : la sentinelle (cumul NO_RUN) avec un vrai record passe', r.status === 200, r);

// La trace : on lit la ligne ecrite.
const lireTrace = (dev, race = '100') =>
  base.prepare(`SELECT trace, trace_ms FROM scores WHERE device_id = ? AND race_key = ?`).get(dev, race);
let dev = appareil();
r = await soumet({ device_id: dev, time_ms: 10000, best_split_ms: 10000, trace: trace(10000, 1000) });
ok('trace coherente : rangee comme fantome', r.status === 200 && !!lireTrace(dev)?.trace, [r.status, lireTrace(dev)]);
dev = appareil();
r = await soumet({ device_id: dev, time_ms: 10000, best_split_ms: 10000, trace: trace(2400, 1000) });
ok('trace incoherente : score accepte, fantome ecarte',
  r.status === 200 && !lireTrace(dev)?.trace, [r.status, lireTrace(dev)]);
ok('...et le score est bien au classement', base.prepare(`SELECT best_split_ms FROM scores WHERE device_id = ?`).get(dev)?.best_split_ms === 10000);

/* ----------------------------------------------------------------- /race */
titre('POST /race');
const course = (o) => appeler('/race', {
  device_id: appareil(), name: nom(), race_key: '100', time_ms: 10000, mode: 'campaign', level_idx: 1, ...o,
});
r = await course({ time_ms: P100 - 1 });
ok('100 m sous le plancher refuse', r.status === 400 && r.json.error === PLANCHER_MSG, r);
r = await course({ time_ms: P100 });
ok('100 m au plancher accepte', r.status === 200, r);
r = await course({ race_key: '200', time_ms: P200 - 1 });
ok('200 m sous le plancher refuse', r.status === 400 && r.json.error === PLANCHER_MSG, r);
r = await course({ race_key: '400', time_ms: P400 - 1 });
ok('400 m sous le plancher refuse', r.status === 400 && r.json.error === PLANCHER_MSG, r);
r = await course({ race_key: '400', time_ms: P400 });
ok('400 m au plancher accepte', r.status === 200, r);
r = await course({ race_key: '100h', time_ms: 1500 });
ok('100 m haies : pas de plancher nouveau', r.status === 200, r);

/* ---------------------------------------------------- /objectif/tentative */
titre('POST /objectif/tentative');
// La route lit une trace et un objectif ; on ne regarde ici que la porte du
// plancher : la reponse doit etre CELLE-LA, ou PAS celle-la.
const tente = (o) => appeler('/objectif/tentative', {
  nom: nom(), device_id: appareil(), ms: 10000, epreuve: '100', ...o,
  trace: trace(o.ms, { '100': 1000, '200': 2000, '400': 4000, '110h': 1100 }[o.epreuve || '100']),
});
r = await tente({ ms: P100 - 1 });
ok('100 m sous le plancher (trace fabriquee a sa mesure) : refuse par le plancher',
  r.status === 400 && r.json.error === PLANCHER_MSG, r);
r = await tente({ epreuve: '200', ms: P200 - 1 });
ok('200 m sous le plancher : refuse par le plancher', r.status === 400 && r.json.error === PLANCHER_MSG, r);
r = await tente({ epreuve: '400', ms: P400 - 1 });
ok('400 m sous le plancher : refuse par le plancher', r.status === 400 && r.json.error === PLANCHER_MSG, r);
r = await appeler('/objectif/tentative', { nom: nom(), device_id: appareil(), ms: 5000, epreuve: '100', trace: [0, 1000, 1000] });
ok('une trace inventee garde sa reponse d\'avant : 422 et griefs (la preuve passe avant le plancher)',
  r.status === 422 && Array.isArray(r.json.griefs), r);
r = await tente({ ms: P100 });
ok('100 m au plancher : la porte du plancher est passee', !(r.status === 400 && r.json?.error === PLANCHER_MSG), r);
r = await tente({ epreuve: '110h', ms: 15000 });
ok('110 m haies : la porte du plancher n\'existe pas', !(r.status === 400 && r.json?.error === PLANCHER_MSG), r);

/* ----------------------------------------------- /challenge (et /camera) */
titre('POST /challenge, /challenge/camera');
const defi = (chemin, o) => appeler(chemin, {
  device_id: appareil(), name: nom(), races: ['100'], level_idx: 1, total_ms: 10000,
  splits: [10000], traces: [[]], ...o,
});
for (const chemin of ['/challenge', '/challenge/camera']) {
  r = await defi(chemin, { total_ms: P100 - 1 });
  ok(`${chemin} : 100 m sous le plancher refuse`, r.status === 400 && r.json.error === PLANCHER_MSG, r);
  r = await defi(chemin, { total_ms: P100 });
  ok(`${chemin} : 100 m au plancher accepte`, r.status === 200, r);
  r = await defi(chemin, { races: ['100', '200'], splits: [1, 1], traces: [[], []], total_ms: P100 + P200 - 1 });
  ok(`${chemin} : 100+200 sous la somme des planchers refuse`, r.status === 400 && r.json.error === PLANCHER_MSG, r);
  r = await defi(chemin, { races: ['100', '200'], splits: [1, 1], traces: [[], []], total_ms: P100 + P200 });
  ok(`${chemin} : 100+200 a la somme accepte`, r.status === 200, r);
  r = await defi(chemin, { races: ['110h'], total_ms: 1500 });
  ok(`${chemin} : haies, aucun plancher nouveau`, r.status === 200, r);
}

/* ----------------------------------------------------- /challenge/attempt */
titre('POST /challenge/attempt');
r = await defi('/challenge', { races: ['100', '200'], splits: [1, 1], traces: [[], []], total_ms: 40000 });
const code = r.json?.id;
ok('un defi 100+200 a servir', r.status === 200 && !!code, r);
const tentative = (o) => appeler('/challenge/attempt', {
  id: code, device_id: appareil(), name: nom(), total_ms: 40000, splits: [], traces: [], ...o,
});
r = await tentative({ total_ms: P100 + P200 - 1 });
ok('tentative sous la somme des planchers : refusee', r.status === 400 && r.json.error === PLANCHER_MSG, r);
const avant = base.prepare(`SELECT COUNT(*) AS n FROM challenge_attempts WHERE id = ?`).get(code).n;
r = await tentative({ total_ms: 1 });
ok('tentative a 1 ms : refusee, aucune ligne ecrite',
  r.status === 400 && base.prepare(`SELECT COUNT(*) AS n FROM challenge_attempts WHERE id = ?`).get(code).n === avant, r);
r = await tentative({ total_ms: P100 + P200 });
ok('tentative a la somme des planchers : acceptee', r.status === 200, r);
r = await defi('/challenge', { races: ['110h'], total_ms: 20000, splits: [20000], traces: [[]] });
const codeHaies = r.json?.id;
r = await appeler('/challenge/attempt', {
  id: codeHaies, device_id: appareil(), name: nom(), total_ms: 1500, splits: [], traces: [],
});
ok('tentative sur un defi de haies : aucun plancher nouveau', r.status === 200, r);

/* ------------------------------------------------------- duel des marques */
titre('duel des marques (marques.js, POST /marques/course)');
const marque = async (cle, epr) => {
  const dv = appareil();
  await choisirCamp(db, { nameKey: cle, name: cle, deviceId: dv, camp: 'ROUGE', epreuve: epr });
};
// Les camps ont des noms propres : on les lit dans la table des camps du module.
const { CAMPS } = await import('../worker/src/marques.js');
const camp = CAMPS[0];
const inscrire = async (cle, epr) => {
  const o = await choisirCamp(db, { nameKey: cle, name: cle, deviceId: appareil(), camp, epreuve: epr });
  return o.status;
};
ok('inscription 100 m', await inscrire('marq100', '100') === 200);
ok('inscription 200 m', await inscrire('marq200', '200') === 200);
ok('inscription 400 m', await inscrire('marq400', '400') === 200);
const noter = (cle, epr, ms, tr = trace(ms, { 100: 1000, 200: 2000, 400: 4000 }[epr])) =>
  noterCourse(db, { nameKey: cle, name: cle, epreuve: epr, timeMs: ms, trace: tr });
let m = await noter('marq100', '100', P100 - 1);
ok('noterCourse 100 m sous le plancher : 400', m.status === 400 && m.corps.error === PLANCHER_MSG, m);
m = await noter('marq200', '200', P200 - 1);
ok('noterCourse 200 m sous le plancher : 400', m.status === 400 && m.corps.error === PLANCHER_MSG, m);
m = await noter('marq400', '400', P400 - 1);
ok('noterCourse 400 m sous le plancher : 400', m.status === 400 && m.corps.error === PLANCHER_MSG, m);
ok('...aucun chrono enregistre', base.prepare(`SELECT COUNT(*) AS n FROM marques_chronos`).get().n === 0);
m = await noter('marq100', '100', P100 + 100);
ok('noterCourse 100 m juste au-dessus : accepte', m.status === 200 && m.corps.ok === true, m);
// La route elle-meme (via le worker) : meme porte.
r = await appeler('/marques/course', { device_id: appareil(), name: 'marq100', race_key: '100', time_ms: P100 - 1, trace: [] });
ok('la route /marques/course ne laisse rien passer sous le plancher',
  !(r.status === 200 && r.json?.ok === true), r);

/* -------------------------------------------------------------- championnat */
titre('championnat : enregistrerCourse (POST /champ/course) et salle');
await enregistrerCourse(db, { edition: 'X', phase: 'series', course: 1, chronos: [] }); // cree les tables
const edition = (id, ep) => {
  base.prepare(`INSERT INTO champ_editions (id, echelon, zone, epreuve, debut, cloture, phase, etat, cree_le, engagement)
                VALUES (?, 'national', 'FR', ?, 0, 0, 'series', 'ouverte', 0, 0)`).run(id, ep);
  base.prepare(`INSERT INTO champ_partants (edition, name_key, nom, rang_duel, phase, course, tenant)
                VALUES (?, 'ana', 'Ana', 1, 'series', 1, 0), (?, 'bob', 'Bob', 2, 'series', 1, 0)`).run(id, id);
};
edition('ED100', '100'); edition('ED400', '400');
const msDe = (id, cle) => base.prepare(`SELECT ms FROM champ_resultats WHERE edition = ? AND name_key = ?`).get(id, cle)?.ms;
const chrono = async (id, a, b) => {
  const r = await appeler('/champ/course', {
    edition: id, phase: 'series', course: 1,
    chronos: [{ cle: 'ana', ms: a }, { cle: 'bob', ms: b }],
  }, { 'X-Sprinter-Admin': ENV.ADMIN_CLE });
  return r;
};
r = await chrono('ED100', P100 - 1, P100);
ok('championnat 100 m : le chrono sous le plancher est ecarte, l\'autre range',
  r.status === 200 && msDe('ED100', 'ana') === undefined && msDe('ED100', 'bob') === P100, [r.status, msDe('ED100', 'ana'), msDe('ED100', 'bob')]);
r = await chrono('ED400', 9000, P400);
ok('championnat 400 m : 9 s (un 100 m) ecarte, 33,276 s range',
  r.status === 200 && msDe('ED400', 'ana') === undefined && msDe('ED400', 'bob') === P400, [r.status, msDe('ED400', 'ana'), msDe('ED400', 'bob')]);

// Les salles en direct : on injecte de faux sockets et l'on parle a `recu`.
const faux = () => ({ send() {}, close() {} });
const salle = new SalleDirecte({}, ENV);
salle.epreuves = ['100', '200']; salle.max = 2;
const w = faux();
salle.joueurs.set(w, { id: 'a1', nom: 'Ana', pret: false, d: 0, c: null, fin: null, parti: false, couloir: null, forfait: false });
salle.joueurs.set(faux(), { id: 'b1', nom: 'Bob', pret: false, d: 0, c: null, fin: null, parti: false, couloir: null, forfait: false });
const j = () => salle.joueurs.get(w);
salle.recu(w, JSON.stringify({ t: 'fini', ms: P100 + P200 - 1 }));
ok('salle directe 100+200 : fini sous la somme des planchers ignore', j().fin === null, j().fin);
salle.recu(w, JSON.stringify({ t: 'fini', ms: P100 + P200 }));
ok('salle directe 100+200 : fini a la somme accepte', j().fin === P100 + P200, j().fin);

const salleH = new SalleDirecte({}, ENV);
salleH.epreuves = ['110h']; salleH.max = 2;
const wh = faux();
salleH.joueurs.set(wh, { id: 'h1', nom: 'Hana', pret: false, d: 0, c: null, fin: null, parti: false, couloir: null, forfait: false });
salleH.joueurs.set(faux(), { id: 'h2', nom: 'Hugo', pret: false, d: 0, c: null, fin: null, parti: false, couloir: null, forfait: false });
salleH.recu(wh, JSON.stringify({ t: 'fini', ms: 1500 }));
ok('salle directe haies : aucun plancher nouveau', salleH.joueurs.get(wh).fin === 1500);

const sc = new SalleChampionnat({}, ENV);
sc.ctx = { epreuve: '100' }; sc.phase = 'course'; sc.departN = 1;
const wc = faux();
sc.sockets.set(wc, { id: 'k1', cle: 'ana', nom: 'Ana', role: 'coureur' });
sc.coureurs.set('ana', { cle: 'ana', nom: 'Ana', ws: wc, statut: 'engage', d: 0, c: null, fin: null });
sc.coureurs.set('bob', { cle: 'bob', nom: 'Bob', ws: faux(), statut: 'engage', d: 0, c: null, fin: null });
sc.recu(wc, JSON.stringify({ t: 'fini', ms: P100 - 1 }));
ok('salle de championnat 100 m : fini sous le plancher ignore', sc.coureurs.get('ana').fin === null, sc.coureurs.get('ana').fin);
sc.recu(wc, JSON.stringify({ t: 'fini', ms: P100 }));
ok('salle de championnat 100 m : fini au plancher accepte', sc.coureurs.get('ana').fin === P100, sc.coureurs.get('ana').fin);

console.log(`\n${e ? '✗ ' + e + ' echec(s)' : '✓ tout passe'}`);
process.exit(e ? 1 : 0);
