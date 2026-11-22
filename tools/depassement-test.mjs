// « On vient de te depasser » et les textes de l'objectif, jusqu'au message
// remis a Firebase : le worker tourne ici, sur SQLite en memoire, et seul le
// reseau de Google est double.
//
//   node tools/depassement-test.mjs
import { DatabaseSync } from 'node:sqlite';
import { generateKeyPairSync } from 'node:crypto';
import worker, { SalleDirecte } from '../worker/src/index.js';
import { texteObjectif, texteResultat } from '../worker/src/objectif.js';
import { ensureDuelTables } from '../worker/src/duels.js';
import { ensureModerationTables, bloquer } from '../worker/src/moderation.js';
import { recordsBattus, doublesAuxDuels, texteRecordBattu } from '../worker/src/depassement.js';

let echecs = 0;
const ok = (nom, vrai, detail) => {
  console.log(`${vrai ? '✓' : '✗'} ${nom}${vrai || detail === undefined ? '' : ' — ' + JSON.stringify(detail)}`);
  if (!vrai) echecs++;
};

const base = new DatabaseSync(':memory:');
const db = {
  prepare(sql) {
    const faire = args => ({
      all: async () => ({ results: base.prepare(sql).all(...args) }),
      first: async () => base.prepare(sql).get(...args) ?? null,
      run: async () => ({ meta: { changes: base.prepare(sql).run(...args).changes } }),
    });
    return { bind: (...a) => faire(a), ...faire([]) };
  },
  async batch(liste) { const r = []; for (const x of liste) r.push(await x.run()); return r; },
};

// Google, double : on garde ce qui serait parti, rien ne sort.
let envois = [];
globalThis.fetch = async (u, o) => {
  if (String(u).startsWith('https://oauth2.googleapis.com/')) return Response.json({ access_token: 'jeton', expires_in: 3600 });
  if (String(u).startsWith('https://fcm.googleapis.com/')) {
    const { message: m } = JSON.parse(o.body);
    envois.push({ a: m.token.split(':')[1], t: m.data.t, titre: m.notification.title, corps: m.notification.body });
    return Response.json({});
  }
  throw new Error('reseau interdit : ' + u);
};
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = { DB: db, ADMIN_CLE: 'cle-de-test-locale-uniquement', FCM_COMPTE_SERVICE: {
  client_email: 'essai@local.test', project_id: 'essai',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
} };

let adresse = 0;
async function poster(chemin, corps) {
  const attentes = [];
  const r = await worker.fetch(new Request('https://local' + chemin, {
    method: 'POST', body: JSON.stringify(corps),
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.' + (++adresse >> 8) + '.' + (adresse & 255) },
  }), env, { waitUntil: p => attentes.push(p), passThroughOnException() {} });
  for (let vus = 0; vus < attentes.length;) {
    const lot = attentes.slice(vus); vus = attentes.length;
    await Promise.allSettled(lot);
  }
  return { statut: r.status, ...(await r.json().catch(() => ({}))) };
}

const app = n => 'appareil-test-' + n;
async function joueur(n, { push = true, langue = 'fr' } = {}) {
  const r = await poster('/claim', { device_id: app(n), name: n });
  if (!r.ok) throw new Error('claim ' + n + ' : ' + JSON.stringify(r));
  if (!push) return;
  const a = await poster('/push/natif/abonner', { device_id: app(n), jeton: `jeton-de-test-local:${n}`, plateforme: 'android', langue });
  if (!a.ok) throw new Error('jeton ' + n + ' : ' + JSON.stringify(a));
}
const course = (n, ms, race = '100') =>
  poster('/race', { device_id: app(n), name: n, race_key: race, time_ms: ms });
const submit = (n, ms, race = '100') =>
  poster('/submit', { device_id: app(n), name: n, race_key: race, time_ms: ms, best_split_ms: ms });
const recus = t => envois.filter(e => e.t === t).map(e => e.a).sort();
const oublierLesSonneries = () => {
  try { base.exec('DELETE FROM depassements_sonnes'); } catch { /* pas encore creee */ }
};

console.log('\n-- les records, par /race');
for (const n of ['ana', 'bea', 'cyd', 'dan', 'eli', 'flo', 'max', 'muet']) await joueur(n, { push: n !== 'muet', langue: n === 'cyd' ? 'en' : 'fr' });
// /submit cree la table des scores, que la production a depuis toujours.
await submit('ana', 9000);
for (const [n, ms] of [['bea', 9100], ['ana', 9000], ['cyd', 9200], ['dan', 9300], ['eli', 9400], ['flo', 9800]]) await course(n, ms);
await course('max', 9500);
oublierLesSonneries(); envois = [];

await course('max', 9450);
ok('record ameliore sans passer personne : silence', envois.length === 0, envois);
await course('max', 9050);
ok('les trois plus proches, pas le quatrieme', String(recus('record_battu')) === 'bea,cyd,dan', envois);
ok('ni celui qui reste devant, ni celui deja derriere', !envois.some(e => ['ana', 'flo', 'max'].includes(e.a)), envois);
const deBea = envois.find(e => e.a === 'bea');
ok('en francais, epreuve et Top 500', deBea?.titre === 'Ton record est battu'
  && deBea.corps === 'Un joueur de ton niveau vient de battre ton record du 100 m et te passe devant au Top 500.', deBea);
ok('en anglais pour qui joue en anglais', /^A runner close to your level/.test(envois.find(e => e.a === 'cyd')?.corps || ''));
ok('ni nom ni chrono sur l ecran verrouille', envois.every(e => !/max|9[.,]05/i.test(e.titre + e.corps)), envois);

envois = [];
await submit('max', 9050);
ok('/submit apres /race : rien deux fois', envois.length === 0, envois);
await course('max', 9060);
ok('une course moins bonne : silence', envois.length === 0, envois);

envois = [];
await course('bea', 9020);
await course('max', 8990);
ok('la meme personne : une fois par heure', !recus('record_battu').includes('bea'), envois);
base.exec(`UPDATE depassements_sonnes SET quand = quand - ${61 * 60000}`);
await course('bea', 8980); envois = [];
base.exec(`UPDATE depassements_sonnes SET quand = quand - ${61 * 60000}`);
await course('max', 8970);
ok('passe l heure, elle est prevenue', recus('record_battu').includes('bea'), envois);

console.log('\n-- les records, par /submit, et qui ne doit pas sonner');
await course('ana', 20000, '200'); await course('muet', 20100, '200'); await course('bea', 20200, '200');
oublierLesSonneries(); envois = [];
await submit('max', 19900, '200');
ok('/submit seul previent aussi', String(recus('record_battu')) === 'ana,bea', envois);

await ensureModerationTables(db);
await course('ana', 47000, '400');
await bloquer(db, 'ana', 'max');
oublierLesSonneries(); envois = [];
await course('max', 46000, '400');
ok('qui a bloque n est pas prevenu', envois.length === 0, envois);
await poster('/moderation/debloquer', { name: 'ana', device_id: app('ana'), cible: 'max' });

await course('muet', 46300, '400');
await course('dan', 46500, '400');
oublierLesSonneries(); envois = [];
await course('dan', 46100, '400');
ok('sans notifications actives : rien ne part', envois.length === 0, envois);

oublierLesSonneries(); envois = [];
await poster('/race', { device_id: app('flo'), name: 'max', race_key: '100', time_ms: 8600 });
ok('un nom refuse ne previent personne', envois.length === 0, envois);

console.log('\n-- le bord du Top 500');
const semer = base.prepare(`INSERT INTO scores (device_id, race_key, name, time_ms, best_split_ms, updated_at) VALUES (?, '60', ?, 1200000, ?, 0)`);
for (let i = 1; i <= 499; i++) semer.run('semis-' + i, 'semis' + i, 6000 + i);
semer.run(app('ana'), 'ana', 7000);
semer.run(app('bea'), 'bea', 7100);
semer.run(app('max'), 'max', 6990);
const bord = await recordsBattus(db, { epreuve: '60', deviceId: app('max'), ancien: null, ms: 6990 });
ok('le 500e etait au Top, le 501e non', JSON.stringify(bord.battus) === '[{"cle":"ana","auTop":true},{"cle":"bea","auTop":false}]', bord);
ok('hors Top, le texte n en parle pas', !texteRecordBattu('60', false, 'fr')[1].includes('Top'));

console.log('\n-- le classement des duels');
await ensureDuelTables(db);
const ligne = base.prepare(`INSERT INTO duel_players (name_key, epreuve, name, lp, palier, wins, updated_at) VALUES (?, ?, ?, ?, 0, 1, 0)`);
for (const [n, lp] of [['ana', 60], ['bea', 22], ['cyd', 20], ['dan', 15], ['eli', 12], ['flo', 1], ['max', 5]]) ligne.run(n, '100', n, lp);
await poster('/challenge/attempt', { id: 'AUCUN1', device_id: app('max'), name: 'max', total_ms: 9000 });
const defi = (id, qui, ms) => base.prepare(
  `INSERT INTO challenges (id, created_at, owner_device, owner_name, races, level_idx, total_ms, splits, traces)
   VALUES (?, ?, ?, ?, '["100"]', 0, ?, '[]', '[]')`).run(id, Date.now(), app(qui), qui, ms);
defi('DUEL01', 'flo', 9900);
oublierLesSonneries(); envois = [];
let r = await poster('/challenge/attempt', { id: 'DUEL01', device_id: app('max'), name: 'max', total_ms: 9600 });
ok('le duel se tranche', r.statut === 200, r);
const double = recus('duel_depasse');
ok('il previent ceux qu il double, trois au plus', double.length === 3 && double.every(n => ['bea', 'cyd', 'dan', 'eli'].includes(n)), envois);
ok('pas celui reste devant, pas celui deja derriere', !double.includes('ana') && !double.includes('flo'), double);
ok('le texte dit le classement et l epreuve', envois.find(e => e.t === 'duel_depasse')?.corps
  === 'Un joueur vient de te dépasser au classement des duels du 100 m.', envois);

oublierLesSonneries(); envois = [];
await poster('/challenge/attempt', { id: 'DUEL01', device_id: app('max'), name: 'max', total_ms: 9500 });
ok('une seconde tentative ne sonne pas', recus('duel_depasse').length === 0, envois);

defi('DUEL02', 'flo', 9700);
oublierLesSonneries(); envois = [];
await poster('/challenge/attempt', { id: 'DUEL02', device_id: app('dan'), name: 'dan', total_ms: 9700 });
ok('un nul ne passe devant personne', recus('duel_depasse').length === 0, envois);

console.log('\n-- une course en direct');
for (const [n, lp] of [['ana', 2], ['bea', 24], ['cyd', 10], ['dan', 90]]) ligne.run(n, '200', n, lp);
const salle = Object.assign(Object.create(SalleDirecte.prototype), {
  env, test: false, code: 'ESSAI', hote: 'a', epreuves: ['200'],
  annoncerPoints() {}, async crediterVainqueur() {},
});
oublierLesSonneries(); envois = [];
await salle.ecrire([{ id: 'a', nom: 'ana', fin: 20000 }, { id: 'c', nom: 'cyd', fin: 20500 }], 1);
ok('le direct previent qui est double', recus('duel_depasse').includes('cyd'), envois);
ok('et pas qui reste devant', !recus('duel_depasse').includes('dan'), envois);

ok('les plus proches derriere lui d abord', String(doublesAuxDuels(
  ['a', 'b', 'c', 'd', 'e', 'moi'], ['a', 'moi', 'b', 'c', 'd', 'e'], 'moi', new Set('abcde'))) === 'b,c,d');
ok('un nom non reserve ne prend pas une place', String(doublesAuxDuels(
  ['b', 'c', 'd', 'e', 'moi'], ['moi', 'b', 'c', 'd', 'e'], 'moi', new Set('cde'))) === 'c,d,e');

console.log('\n-- les textes de l objectif, toutes tournures');
const tous = { fr: new Set(), en: new Set() };
for (const langue of ['fr', 'en']) {
  for (const creneau of ['midi', 'soir']) {
    for (const midi of [null, { etat: 'absent' }, { etat: 'tente', meilleurMs: 21000, cibleMs: 20680 }, { etat: 'valide' }]) {
      for (let i = 0; i < 80; i++) {
        tous[langue].add(texteObjectif({ name_key: 'j' + i, jour: '2026-11-22', creneau, race_key: '200', cible_ms: 20680, pb_ms: 20100 },
          i % 2 ? 1 : 22, langue, true, midi, ['100', '400', '110h']).corps);
      }
    }
  }
}
const [fr, en] = [[...tous.fr], [...tous.en]];
ok('plus de phrase fausse', ![...fr, ...en].some(c => /compte double|Cinq essais|Five tries|Minuit|Midnight|keep a streak/.test(c)));
ok('virgule decimale en francais', fr.every(c => !/\d\.\d/.test(c)), fr.find(c => /\d\.\d/.test(c)));
ok('point decimal en anglais', en.some(c => c.includes('20.68')));
ok('nombre et unite inseparables', [...fr, ...en].every(c => !/\d [smh](?!\p{L})/u.test(c)), [...fr, ...en].find(c => /\d [smh](?!\p{L})/u.test(c)));
ok('1er, 22e', fr.some(c => /\b1er au/.test(c)) && fr.some(c => /\b22e au/.test(c)) && !fr.some(c => /\b1e /.test(c)));
ok('1st, 22nd', en.some(c => /\b1st in/.test(c)) && en.some(c => /\b22nd in/.test(c)));
ok('le message du telephone de l auteur, corrige', fr.includes('Objectif de midi validé au 200 m. Celui du soir t\'attend : 20,68 s. Le 100 m et le 400 m attendent aussi, et Hurdlers a ses objectifs.'));
ok('le resultat aussi parle avec une virgule', !/\d\.\d/.test(texteResultat(
  { tempsMs: 20900, cibleMs: 20680, palier: null, reussi: false }, 'fr').corps));

console.log(echecs ? `\n${echecs} ECHEC(S)` : '\nTOUT PASSE');
process.exit(echecs ? 1 : 0);
