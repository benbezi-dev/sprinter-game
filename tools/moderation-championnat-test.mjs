// Les bulles et les mots de championnat face a la moderation : banni refuse,
// signalement, retrait. Le worker tourne ici, sur une base SQLite en memoire :
// les requetes passent par les vraies routes.
//
//   node tools/moderation-championnat-test.mjs
import { DatabaseSync } from 'node:sqlite';
import worker from '../worker/src/index.js';
import { ensureChampTables, calendrierDe, poserBulle, poserMotDeCourse } from '../worker/src/championnats.js';
import { ensureModerationTables } from '../worker/src/moderation.js';

let echecs = 0;
const ok = (nom, vrai, detail) => {
  console.log(`${vrai ? '✓' : '✗'} ${nom}${vrai || detail === undefined ? '' : ' — ' + JSON.stringify(detail)}`);
  if (!vrai) echecs++;
};

const base = new DatabaseSync(':memory:');
const db = {
  prepare(sql) {
    const faire = (args) => ({
      all: async () => ({ results: base.prepare(sql).all(...args) }),
      first: async () => base.prepare(sql).get(...args) ?? null,
      run: async () => ({ meta: { changes: base.prepare(sql).run(...args).changes } }),
    });
    return { bind: (...args) => faire(args), ...faire([]) };
  },
  async batch(liste) { const r = []; for (const x of liste) r.push(await x.run()); return r; },
};

const ADMIN = 'cle-de-test-locale-uniquement';
let adresse = 0;
async function appel(chemin, corps, admin = false) {
  const attentes = [];
  const r = await worker.fetch(new Request('https://local' + chemin, {
    method: corps ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      // une adresse par appel : l'anti-abus n'est pas ce qu'on teste
      'CF-Connecting-IP': '10.0.0.' + (++adresse),
      ...(admin ? { 'X-Sprinter-Admin': ADMIN } : {}),
    },
    body: corps ? JSON.stringify(corps) : undefined,
  }), { DB: db, ADMIN_CLE: ADMIN }, { waitUntil: p => attentes.push(p), passThroughOnException() {} });
  await Promise.allSettled(attentes);
  return { statut: r.status, ...(await r.json().catch(() => ({}))) };
}

await ensureChampTables(db);
await ensureModerationTables(db);

const ED = 'MODTEST1';
const debut = Math.floor(Date.now() / 86400000) * 86400000 + 7 * 86400000;
base.prepare(`INSERT INTO champ_editions (id, echelon, zone, epreuve, debut, phase, etat, cree_le)
              VALUES (?, 'national', 'FR', '100', ?, 'demies', 'ouverte', ?)`).run(ED, debut, Date.now());
const JOUEURS = ['auteur', 'lecteur', 'autre'];
const appareil = n => `appareil-test-${n}`;
for (const [i, n] of JOUEURS.entries()) {
  base.prepare(`INSERT INTO champ_partants (edition, name_key, nom, rang_duel, phase, course)
                VALUES (?, ?, ?, ?, 'demies', 1)`).run(ED, n, n, i + 1);
  const r = await appel('/claim', { device_id: appareil(n), name: n });
  if (!r.ok) throw new Error('reservation impossible : ' + JSON.stringify(r));
}
base.prepare(`INSERT INTO champ_resultats (edition, phase, course, name_key, ms, place, couru_le)
              VALUES (?, 'series', 2, 'auteur', 10100, 1, ?)`).run(ED, Date.now());

const bulle = (texte, qui = 'auteur') => appel('/champ/bulle',
  { edition: ED, phase: 'demies', name: qui, device_id: appareil(qui), texte });
const mot = (corps) => appel('/champ/mot',
  { edition: ED, phase: 'series', course: 2, name: 'auteur', device_id: appareil('auteur'), ...corps });
const BULLE = `champ-bulle:${ED}:demies:auteur`;
const MOT = `champ-mot:${ED}:series:2`;
const signaler = (duel, qui = 'lecteur', name = qui) => appel('/moderation/signaler',
  { duel, motif: 'insulte', name, device_id: appareil(qui) });
const file = async () => (await appel('/moderation/file', null, true)).signalements;
const trancher = (id, verdict, bannir = false) => appel('/moderation/trancher', { id, verdict, bannir }, true);
const edition = () => appel(`/champ/edition/${ED}`);
const VOIX = Buffer.alloc(3000, 7).toString('base64');

console.log('\n-- une bulle : signalee, gardee, puis retiree');
ok('la bulle se pose', (await bulle('Je suis venu gagner.')).ok === true);
ok('son auteur ne la signale pas', (await signaler(BULLE, 'auteur')).statut === 400);
ok('un lecteur la signale', (await signaler(BULLE)).ok === true);
ok('deux fois : toujours accepte', (await signaler(BULLE)).ok === true);
let f = await file();
ok('une seule ligne, avec la copie du texte et le motif', f.length === 1 && f[0].mot === 'Je suis venu gagner.'
  && f[0].motif === 'insulte' && f[0].auteur === 'auteur' && f[0].par === 'lecteur', f);
ok('signaler n efface rien', (await edition()).bulles.length === 1);
ok('classer sans suite', (await trancher(f[0].id, 'garde')).ok === true);
ok('classee sans suite, la bulle reste', (await edition()).bulles.length === 1);

ok('un autre lecteur la signale', (await signaler(BULLE, 'autre')).ok === true);
f = await file();
ok('retirer', (await trancher(f[0].id, 'retire')).ok === true);
ok('la bulle n est plus servie', (await edition()).bulles.length === 0);
ok('l organisation la lit encore, marquee retiree',
  (await appel(`/champ/moderation?edition=${ED}`, null, true)).bulles[0]?.retire === true);
ok('une bulle retiree ne se signale plus', (await signaler(BULLE)).statut === 400);

console.log('\n-- une version reposee est un autre contenu');
await new Promise(r => setTimeout(r, 3));
await bulle('Pour ma ville.');
ok('le meme lecteur signale la nouvelle', (await signaler(BULLE)).ok === true);
f = await file();
ok('la file porte la nouvelle', f.length === 1 && f[0].mot === 'Pour ma ville.', f);
await new Promise(r => setTimeout(r, 3));
await bulle('Que le meilleur gagne.');
ok('retirer une version deja remplacee se tranche', (await trancher(f[0].id, 'retire')).ok === true);
ok('et laisse la version que personne n a relue',
  (await edition()).bulles[0]?.texte === 'Que le meilleur gagne.');

console.log('\n-- un mot : texte et voix');
ok('le mot se pose', (await mot({ texte: 'A la prochaine.', voix: VOIX, voix_type: 'audio/wav' })).ok === true);
ok('sa voix se lit', (await appel(`/champ/mot?edition=${ED}&phase=series&course=2`)).statut === 200);
// Un visiteur de la page Regarder n'a pas de pseudo ; un nom qui n'est pas a lui ne signe pas.
ok('sans pseudo, on signale', (await signaler(MOT, 'visiteur', '')).ok === true);
ok('sous le nom d un autre, on signale en son propre appareil', (await signaler(MOT, 'intrus', 'lecteur')).ok === true);
f = await file();
ok('copie du texte et de la voix', f.length === 2 && f[0].mot === 'A la prochaine.'
  && f[0].voix === VOIX && f[0].voix_type === 'audio/wav', f.map(s => [s.mot, s.voix_type]));
ok('signe par l appareil, pas par un nom', f.every(s => s.par.startsWith('appareil:')), f.map(s => s.par));
ok('retirer', (await trancher(f[0].id, 'retire')).ok === true);
ok('le mot n est plus servi', (await edition()).mots.length === 0);
ok('sa voix non plus', (await appel(`/champ/mot?edition=${ED}&phase=series&course=2`)).statut === 404);
ok('le second signalement se tranche aussi', (await trancher(f[1].id, 'retire')).ok === true);
ok('la file est vide', (await file()).length === 0);

console.log('\n-- une voix seule, et la file bornee');
ok('une voix seule se pose', (await mot({ voix: VOIX, voix_type: 'audio/wav' })).ok === true);
for (let i = 0; i < 7; i++) await signaler(MOT, 'v' + i, '');
f = await file();
ok('une voix seule est copiee', f[0]?.mot === null && f[0]?.voix === VOIX);
ok('cinq signalements en attente au plus par contenu', f.length === 5, f.length);

console.log('\n-- ce qui est refuse');
for (const [nom, duel] of [
  ['contenu inconnu', `champ-mot:${ED}:series:9`],
  ['identifiant malforme', 'champ-mot:rien'],
  ['phase malformee', `champ-bulle:${ED}:DEMIES:auteur`],
]) ok(nom, (await signaler(duel)).statut === 400);
ok('sans appareil', (await appel('/moderation/signaler', { duel: MOT, motif: 'autre', name: '' })).statut === 400);
ok('trancher sans la cle', (await appel('/moderation/trancher', { id: f[0].id, verdict: 'retire' })).statut === 403);

console.log('\n-- banni');
ok('retirer et bannir', (await trancher(f[0].id, 'retire', true)).banni === true);
let r = await bulle('Le chrono va parler.');
ok('banni : bulle refusee', r.statut === 403 && r.error === 'depot refuse', r);
r = await mot({ texte: 'Encore moi.' });
ok('banni : mot refuse', r.statut === 403 && r.error === 'depot refuse', r);
r = await mot({ voix: VOIX, voix_type: 'audio/wav' });
ok('banni : voix refusee', r.statut === 403 && r.error === 'depot refuse', r);
// La regle vit dans les fonctions : elle vaut pour tout appelant, pas la seule route.
const avant = calendrierDe(ED, debut).find(x => x.phase === 'demies' && x.course === 1).at - 600_000;
r = await poserBulle(db, { edition: ED, phase: 'demies', nom: ' Auteur ', texte: 'Pour ma ville.' }, avant);
ok('banni : poserBulle refuse en direct', r.code === 403 && r.error === 'depot refuse', r);
r = await poserMotDeCourse(db, { edition: ED, phase: 'series', course: 2, nom: 'AUTEUR', texte: 'Encore.' });
ok('banni : poserMotDeCourse refuse en direct', r.code === 403 && r.error === 'depot refuse', r);
ok('les autres posent toujours', (await bulle('Pour ma ville.', 'lecteur')).ok === true);

console.log(echecs ? `\n${echecs} ECHEC(S)` : '\nTOUT PASSE');
process.exit(echecs ? 1 : 0);
