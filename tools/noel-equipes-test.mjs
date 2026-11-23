// Noel 2026, les quatre equipes (worker/src/noel-equipes.js), sur une base
// SQLite en memoire : candidats, vote, egalite et departage au 200 m, equipes,
// arrivants vers la moins nombreuse, points FFA du meilleur du jour, duels et
// defense des fantomes, pause du championnat, eliminations, finale.
//
//   node tools/noel-equipes-test.mjs
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import * as N from '../worker/src/noel-equipes.js';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || d === undefined ? '' : ' — ' + JSON.stringify(d)}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const base = new DatabaseSync(':memory:');
const db = {
  prepare(sql) {
    const faire = (args) => ({
      all: async () => ({ results: base.prepare(sql).all(...args) }),
      first: async () => base.prepare(sql).get(...args) ?? null,
      run: async () => { const r = base.prepare(sql).run(...args); return { meta: { changes: r.changes } }; },
    });
    return { bind: (...args) => faire(args), ...faire([]) };
  },
  // Comme D1 : un lot est une transaction.
  async batch(liste) {
    base.exec('BEGIN');
    try { for (const x of liste) await x.run(); base.exec('COMMIT'); } catch (err) { base.exec('ROLLBACK'); throw err; }
    return [];
  },
};

const traceDe = (ms, dm = 600) => Array.from({ length: Math.ceil(ms / 80) + 3 }, (_, i) => Math.min(dm + 5, Math.round(dm * (i * 80) / ms)));
const C = N.CALENDRIER;
const H = 3600_000;
const TOP = ['kin', 'barnabe', 'zeze', 'aurel', 'meba', 'lou', 'sam', 'ines', 'neuf'].map((k, i) => ({ name: k[0].toUpperCase() + k.slice(1), best_split_ms: 6600 + i * 40 }));
const top60 = async () => TOP;
const regler = t => N.regler(db, { test: true, t, top60 });
const nom = k => k[0].toUpperCase() + k.slice(1);
const DM = { '60': 600, '60h': 600, '200s': 2000, '400s': 4000 };
const course = (t, k, ms, cible = null, epreuve = '60') => N.noterCourse(db, {
  test: true, t, nameKey: k, name: nom(k), epreuve, timeMs: ms, trace: traceDe(ms, DM[epreuve]), cibleKey: cible });
const tab = (t, k = null) => N.tableau(db, { test: true, t, nameKey: k });

await N.ensureTables(db);

titre('le barème');
{
  const src = readFileSync(new URL('../src/game/bareme-ffa-donnees.ts', import.meta.url), 'utf8');
  for (const [cle, nomFFA] of [['60', '60m'], ['200s', '200m'], ['400s', '400m'], ['60h', '60m Haies 1.06m']]) {
    const l = src.match(new RegExp(`epreuve: "${nomFFA}", categories: 'CJESM'[^\\n]*\\n\\s*perfs: \\[([^\\]]*)\\]`));
    ok(`la ligne ${nomFFA} du worker = celle du jeu`, l && l[1].split(',').map(Number).join() === N.BAREMES[cle].join());
  }
  ok('60 m haies : 7,57 = IA', N.niveau('60h', 7570).code === 'IA');
  ok('épreuve hors barème (60hf) = 0', N.niveau('60hf', 8000).points === 0);
  ok('6,56 = IA 40', N.niveau60(6560).points === 40 && N.niveau60(6560).code === 'IA');
  ok('6,561 se lit 6,57 → IB', N.niveau60(6561).code === 'IB');
  ok('9,04 = D7 2', N.niveau60(9040).points === 2);
  ok('9,05 hors barème = 0', N.niveau60(9050).points === 0);
}

titre('l\'horloge');
ok('avant le 7/12', N.phaseA(C.vote - 1).phase === 'avant');
ok('vote', N.phaseA(C.vote).phase === 'vote');
ok('departage le 9', N.phaseA(C.voteFin).phase === 'departage');
ok('manche 1 le 10', N.phaseA(C.departageFin).manche === 1);
ok('pause le 19/12', N.phaseA(C.pause.debut + H).pause === true && N.phaseA(C.pause.debut + H).manche === 2);
ok('finale le 23', N.phaseA(C.manches[2].debut + H).manche === 3);
ok('fini apres le 25 21 h', N.phaseA(C.manches[2].fin).phase === 'fini');
ok('jour de Paris : 23 h 30 UTC le 10 = le 11', N.jourDe(Date.UTC(2026, 11, 10, 23, 30)) === '2026-12-11');

titre('le vote des chefs');
let t = C.vote + H;
await regler(t);
let T = await tab(t);
ok('8 candidats, pas le 9e', T.candidats.length === 8 && !T.candidats.some(c => c.key === 'neuf'), T.candidats.map(c => c.key));
ok('voter pour un non-candidat refuse', (await N.voter(db, { test: true, t, deviceId: 'd-x', cibleKey: 'neuf' })).status === 404);
// kin 3, barnabe 3, zeze 2, aurel 1, meba 1 → egalite aurel/meba pour la 4e place
const voix = { kin: 3, barnabe: 3, zeze: 2, aurel: 1, meba: 1 };
let d = 0;
for (const [k, n] of Object.entries(voix)) for (let i = 0; i < n; i++) await N.voter(db, { test: true, t, deviceId: `d${d++}`, cibleKey: k });
ok('changer d\'avis : une seule voix par appareil', (await N.voter(db, { test: true, t, deviceId: 'd0', cibleKey: 'kin' })).status === 200);
T = await tab(t);
ok('kin 3 voix', T.candidats.find(c => c.key === 'kin').voix === 3);
ok('voter apres la cloture refuse', (await N.voter(db, { test: true, t: C.voteFin, deviceId: 'dz', cibleKey: 'kin' })).status === 409);

titre('le departage au 200 m');
t = C.voteFin + H;
await regler(t);
T = await tab(t);
ok('3 surs, 1 place pour aurel/meba', T.departage.places === 1 && T.departage.egalite.map(x => x.key).sort().join() === 'aurel,meba', T.departage);
ok('pas encore d\'equipes', T.equipes.length === 0);
ok('un non ex-aequo ne court pas le departage', (await course(t, 'kin', 22000, null, '200s')).status === 403);
ok('meba court 22,50', (await course(t, 'meba', 22500, null, '200s')).status === 200);
ok('aurel court 22,10', (await course(t, 'aurel', 22100, null, '200s')).status === 200);
const r2 = await course(t, 'aurel', 23000, null, '200s');
ok('un moins bon chrono ne remplace pas le meilleur', r2.corps.meilleur === 22100, r2.corps);
ok('pas de 60 compte pendant le departage', (await course(t, 'kin', 6700)).status === 409);

titre('les equipes');
t = C.departageFin + H;
await regler(t);
await regler(t); // deux fois : rien ne se double
T = await tab(t);
ok('4 equipes, chefs kin barnabe zeze aurel', T.equipes.map(x => x.chef_key).join() === 'kin,barnabe,zeze,aurel', T.equipes.map(x => x.chef_key));
ok('chaque chef dans son equipe', T.equipes.every(x => x.effectif === 1 && x.membres[0].chef));
// 5 arrivants : 4 vont chacun dans une equipe, le 5e dans la 0
for (const k of ['a1', 'a2', 'a3', 'a4', 'a5']) await N.entrer(db, { test: true, t, nameKey: k, name: nom(k) });
T = await tab(t);
ok('arrivants vers la moins nombreuse', T.equipes.map(x => x.effectif).join() === '3,2,2,2', T.equipes.map(x => x.effectif));

titre('les points de la manche 1');
// kin (equipe 0) court 6,66 = IB 35 ; puis 6,56 = IA 40 → +5 seulement
let r = await course(t, 'kin', 6660);
ok('6,66 → IB 35', r.corps.gain === 35 && r.corps.niveau === 'IB', r.corps);
r = await course(t, 'kin', 6560);
ok('meilleur du jour 6,56 → +5', r.corps.gain === 5, r.corps);
r = await course(t, 'kin', 7000);
ok('moins bien le meme jour → 0', r.corps.gain === 0);
ok('le fantome de kin = sa derniere course (7,00)', (await N.fantome(db, { test: true, cibleKey: 'kin', epreuve: '60' })).corps.ms === 7000);
ok('pas de fantome de kin au 400 m', (await N.fantome(db, { test: true, cibleKey: 'kin', epreuve: '400s' })).status === 404);
r = await course(t + 24 * H, 'kin', 7000);
ok('le lendemain, le barème recompte (7,00 = N4 24)', r.corps.gain === 24, r.corps);
// barnabe (equipe 1) bat le fantome de kin (7,00)
r = await course(t, 'barnabe', 6900, 'kin');
ok('barnabe bat le fantome de kin → duel +5', r.corps.duel && r.corps.duel.gagne && r.corps.duel.points === 5, r.corps);
r = await course(t, 'barnabe', 6800, 'kin');
ok('une fois par paire et par jour', r.corps.duel && !r.corps.duel.compte);
// zeze (equipe 2) perd contre le fantome de barnabe (6,80) → defense +3 a l'equipe 1
r = await course(t, 'zeze', 7100, 'barnabe');
ok('le fantome de barnabe gagne → defense', r.corps.duel && !r.corps.duel.gagne && r.corps.duel.points === -3, r.corps);
ok('pas de duel dans sa propre equipe', (await course(t, 'a5', 7200, 'kin')).corps.duel === null);
T = await tab(t);
const s = T.equipes.map(x => x.score);
// eq0 : kin 35+5+24 ; a5 7,20 = IR1 21 → 85 ; eq1 : barnabe 6,90 N3 26 + 6,80 → N2 28 (+2) + duel 5 + defense 3 = 36
// eq2 : zeze 7,10 = N4 24 ; eq3 : 0
ok('scores 85 / 36 / 24 / 0', s.join() === '85,36,24,0', s);
ok('le fil montre la defense', T.fil.some(f => f.genre === 'defense' && f.a === 'Barnabe' && f.b === 'Zeze'));

titre('les autres epreuves en salle');
{
  const t2 = t + 48 * H; // un autre jour : on ne touche pas aux scores verifies plus haut... sauf la manche
  r = await course(t2, 'lou2', 22840, null, '200s');
  ok('200 m en manche : 22,84 = IR2 20', r.status === 200 && r.corps.ffa === 20 && r.corps.niveau === 'IR2', r.corps);
  r = await course(t2, 'lou2', 7570, null, '60h');
  ok('60 m haies le meme jour : compte a part (IA 40)', r.corps.gain === 40, r.corps);
  r = await course(t2, 'lou2', 6600, null, '60');
  ok('et le 60 m aussi', r.corps.gain > 0, r.corps);
  r = await course(t2, 'lou2', 8000, null, '60hf');
  ok('60 m haies femmes : pas dans le jeu de Noel', r.corps.ok === false, r.corps);
  const autre = (await tab(t2, 'lou2')).moi.equipe;
  const cible = (await tab(t2)).equipes.find(e => e.n !== autre && e.eliminee == null).membres[0].key;
  await course(t2, cible, 46000, null, '400s');
  r = await course(t2, 'lou2', 45900, cible, '400s');
  ok('duel au 400 m contre le fantome du 400 m', r.corps.duel && r.corps.duel.gagne && r.corps.duel.cible_ms === 46000, r.corps);
  r = await course(t2, 'lou2', 6500, cible, '60');
  ok('pas de duel au 60 m sans fantome du 60 m', r.corps.duel === null, r.corps);
}

titre('elimination 1');
t = C.manches[0].fin + H;
await regler(t);
await regler(t);
T = await tab(t);
ok('l\'equipe d\'aurel (0 pt) est eliminee', T.equipes[3].eliminee === 1 && T.eliminations.length === 1, T.eliminations);
{ const ef = T.equipes.filter(x => x.eliminee == null).map(x => x.effectif);
  ok('ses joueurs repartis : 10 joueurs, ecart ≤ 1', ef.reduce((a, b) => a + b) === 10 && Math.max(...ef) - Math.min(...ef) <= 1, ef); }
ok('manche 2 repart de zero', T.equipes.every(x => x.score === 0));
ok('un nouvel arrivant ne va pas dans une equipe eliminee', (await N.entrer(db, { test: true, t, nameKey: 'b1', name: 'B1' })).corps.equipe !== 3);

titre('la pause du championnat');
const tp = C.pause.debut + 2 * H;
ok('une course pendant la pause ne compte pas', (await course(tp, 'zeze', 6600)).status === 409);

titre('elimination 2 et finale');
await course(C.pause.fin + H, 'zeze', 6700);   // equipe 2 marque, l'equipe 0 et 1 non
await course(C.pause.fin + H, 'barnabe', 7400);
t = C.manches[1].fin + H;
await regler(t);
T = await tab(t);
ok('l\'equipe de kin (0 pt en manche 2) est eliminee', T.equipes[0].eliminee === 2, T.equipes.map(x => [x.n, x.eliminee, x.scores]));
ok('reste 2 equipes', T.equipes.filter(x => x.eliminee == null).length === 2);
const eff = T.equipes.filter(x => x.eliminee == null).map(x => x.effectif);
ok('effectifs equilibres (ecart ≤ 1)', Math.abs(eff[0] - eff[1]) <= 1, eff);
await course(t, 'kin', 6600);   // kin joue desormais pour l'equipe 1 ou 2
const ek = (await tab(t, 'kin')).moi.equipe;
ok('kin a change d\'equipe', ek === 1 || ek === 2, ek);
t = C.manches[2].fin + H;
await regler(t);
T = await tab(t);
ok('vainqueur = l\'equipe de kin', T.vainqueur && T.vainqueur.equipe === ek, T.vainqueur);
ok('phase fini', T.phase === 'fini');

titre('le canal');
ok('ferme en production', N.ouvert(false) === false);
ok('ouvert sur le canal de test', N.ouvert(true) === true);

console.log(e ? `\n✗ ${e} echec(s)` : '\n✓ tout passe');
process.exit(e ? 1 : 0);
