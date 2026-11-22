// Identite, nationalite, objectifs : le serveur contre un worker local neuf.
//
//   bash tools/controles-defis.sh correctifs-serveur-22-11-test
//
// Les objectifs se jouent sur SQLite en memoire : il faut des lectures
// simultanees et des lignes semees, qu'aucune route ne sait fabriquer.
import { DatabaseSync } from 'node:sqlite';
import { ensureObjectifTables, enregistrerTentative, classementObjectifs } from '../worker/src/objectif.js';
import { ensureSuspectes, listerSuspectes } from '../worker/src/preuve.js';

const B = process.env.BASE || 'http://127.0.0.1:8788';
let mal = 0;
const ok = (nom, vrai, detail) => {
  console.log(`${vrai ? '✓' : '✗'} ${nom}${vrai ? '' : ' — ' + JSON.stringify(detail)}`);
  if (!vrai) mal++;
};
const post = (p, b) => fetch(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(b) }).then(async r => ({ statut: r.status, ...(await r.json().catch(() => ({}))) }));
const m = Math.random().toString(36).slice(2, 7);
const appareil = r => `appareil-${m}-${r}`;

// La reservation.
const NOM = `Ck${m}`, MOI = appareil('moi'), AUTRE = appareil('autre');
const couru = await post('/submit', { device_id: AUTRE, race_key: '100', name: NOM, time_ms: 11000, best_split_ms: 11000 });
ok('un chrono entre sous un nom libre', couru.statut === 200, couru);
const pris = await post('/claim', { device_id: MOI, name: NOM });
ok('le nom se reserve', pris.ok === true && !!pris.code, pris);
const second = await post('/claim', { device_id: AUTRE, name: NOM });
ok('seul l appareil qui reserve est relie', second.ok === false && second.pris === true && !second.code, second);
const relie = await post('/link', { device_id: AUTRE, name: NOM, code: pris.code });
ok('un autre appareil se relie avec le code', relie.ok === true, relie);

const double = await Promise.all(Array.from({ length: 6 }, () => post('/claim', { device_id: appareil('double'), name: `Db${m}` })));
ok('le meme appareil six fois : reserve, un seul code',
  double.every(r => r.ok === true) && new Set(double.map(r => r.code)).size === 1, double);
const course = await Promise.all(Array.from({ length: 6 }, (_, i) => post('/claim', { device_id: appareil('c' + i), name: `Cs${m}` })));
ok('six appareils a la fois : un gagnant, aucun 500',
  course.filter(r => r.ok === true).length === 1 && course.every(r => r.statut === 200), course);

// La nationalite.
const n1 = await post('/champ/pays', { device_id: MOI, name: NOM, pays: 'FR' });
ok('le premier choix passe', n1.statut === 200, n1);
const n2 = await post('/champ/pays', { device_id: MOI, name: NOM, pays: 'MA' });
ok('le second choix est refuse', n2.statut === 409 && n2.pays === 'FR', n2);
const n3 = await post('/champ/pays', { device_id: MOI, name: NOM, pays: 'FR' });
ok('reposer le meme pays passe', n3.statut === 200, n3);
const n4 = await post('/profil', { device_id: MOI, name: NOM, pays: 'MA' });
ok('/profil garde le message que le jeu attend', n4.statut === 409 && String(n4.error).startsWith('nationalite'), n4);
const VOEU = `Vo${m}`, V = appareil('voeu');
await post('/claim', { device_id: V, name: VOEU });
const voeux = await Promise.all(['FR', 'MA', 'SN', 'BE'].map(pays => post('/profil', { device_id: V, name: VOEU, pays })));
ok('quatre choix a la fois : un seul passe',
  voeux.filter(r => r.statut === 200).length === 1 && voeux.filter(r => r.statut === 409).length === 3, voeux);

// Les objectifs, sur SQLite.
function baseD1() {
  const sql = new DatabaseSync(':memory:');
  const requete = (q, a = []) => ({
    bind: (...v) => requete(q, v),
    async first() { return sql.prepare(q).get(...a) ?? null; },
    async all() { return { results: sql.prepare(q).all(...a) }; },
    async run() { return { meta: { changes: Number(sql.prepare(q).run(...a).changes) } }; },
  });
  return { sql, prepare: q => requete(q), batch: async l => { const r = []; for (const x of l) r.push(await x.run()); return r; } };
}
const db = baseD1();
await ensureObjectifTables(db);
await ensureSuspectes(db);
const t0 = new Date('2026-09-05T13:00:00Z'), T = t0.getTime();
db.sql.prepare(`INSERT INTO objectifs (name_key, jour, creneau, race_key, cible_ms, pb_ms, marge, methode, cree_le, ouvre_le, expire_le)
  VALUES ('zoe', '2026-09-05', 'midi', '100', 8800, 9000, 0.02, 'test', ?, ?, ?)`).run(T, T - 3600000, T + 3600000);
const essais = await Promise.all(Array.from({ length: 5 }, () => enregistrerTentative(db, 'zoe', 'Zoe', 8600, t0, '100')));
const ligne = db.sql.prepare(`SELECT points, tentatives FROM objectifs WHERE name_key = 'zoe'`).get();
const total = db.sql.prepare(`SELECT points FROM objectif_classement WHERE name_key = 'zoe'`).get();
ok('cinq envois a la fois : un seul compte',
  essais.filter(r => r && !r.refuse).length === 1 && ligne.points > 0 && total?.points === ligne.points,
  { essais: essais.length, ligne, total });

for (const k of ['ana', 'bea', 'cleo'])
  db.sql.prepare(`INSERT INTO objectif_classement (name_key, nom, points, maj_le) VALUES (?, ?, 10, 0)`).run(k, k);
for (const n of [-1, 1.5]) {
  const r = await classementObjectifs(db, n).catch(e => String(e));
  ok(`classement, n=${n} : une ligne`, Array.isArray(r) && r.length === 1, r);
}
const s = await listerSuspectes(db, 1.5).catch(e => String(e));
ok('suspectes, n decimal : pas d erreur', Array.isArray(s), s);

console.log(mal ? `\n${mal} en echec.` : '\nTout passe.');
process.exit(mal ? 1 : 0);
