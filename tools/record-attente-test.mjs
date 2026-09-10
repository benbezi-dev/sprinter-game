// Le record garde, mis a l'epreuve sans navigateur ni serveur.
//
// C'est le genre de code qu'on ne voit pas echouer. Il ne s'execute que le
// jour ou un record du monde ne passe pas — un cas rare, chez un joueur, a
// trois heures du matin — et s'il se trompe, le chrono disparait exactement
// comme avant, sans que rien ne le signale. Le 8,22 s du 10 septembre 2026 a
// disparu de cette facon : refuse en 403, annonce comme « reessaie », perdu.
//
// On verifie donc les proprietes qui comptent :
//   - un refus garde le chrono plutot que de le laisser tomber ;
//   - un 403 est nomme comme tel, et pas confondu avec une panne de reseau ;
//   - le renvoi part sous le nom D'AUJOURD'HUI, sinon un nom reserve reprend
//     le meme refus pour l'eternite ;
//   - une reussite oublie ce qui attendait, et deux passages ne renvoient pas
//     deux fois.

import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

/* ------------------------------------------------------------- le decor
   Le module vit dans un navigateur : il lui faut un stockage, une fenetre et
   un `fetch`. Les trois sont ici des faux minuscules, et c'est le `fetch` qui
   porte le scenario — c'est lui qui refuse ou accepte. */

const memoire = new Map();
globalThis.localStorage = {
  getItem: k => (memoire.has(k) ? memoire.get(k) : null),
  setItem: (k, v) => memoire.set(k, String(v)),
  removeItem: k => memoire.delete(k),
};

const auditeurs = new Map();
globalThis.window = {
  addEventListener: (nom, f) => auditeurs.set(nom, [...(auditeurs.get(nom) || []), f]),
  dispatchEvent: ev => { for (const f of auditeurs.get(ev.type) || []) f(ev); return true; },
};
globalThis.Event = class { constructor(type) { this.type = type; } };

/** Ce que le serveur repondra, et ce qu'il a recu. */
let reponse = { status: 200 };
const envois = [];
globalThis.fetch = async (url, init) => {
  const corps = init?.body ? JSON.parse(init.body) : null;
  envois.push({ url: String(url), corps });
  const { status } = reponse;
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ rank: 1, best_time_ms: 0, best_split_ms: corps?.best_split_ms, entries: [] }),
  };
};

/* Les modules sont du TypeScript qui importe sans extension : on les passe par
   esbuild plutot que d'inventer un resolveur. Rien n'est ecrit dans le depot. */
const dossier = mkdtempSync(join(tmpdir(), 'sprinter-attente-'));
const entree = join(dossier, 'entree.ts');
const sortie = join(dossier, 'paquet.mjs');
writeFileSync(entree, `
  export * from '${join(process.cwd(), 'src/game/record-attente.ts')}';
  export { raisonDe, EnvoiRefuse, saveName, getSavedName, NOM_CHANGE }
    from '${join(process.cwd(), 'src/game/leaderboard.ts')}';
`);
await build({
  entryPoints: [entree], outfile: sortie, bundle: true,
  format: 'esm', platform: 'neutral', logLevel: 'silent',
});
const M = await import(sortie);

const RAZ = () => { memoire.clear(); envois.length = 0; };
const attente = () => M.enAttente();

/* ------------------------------------------------------- nommer le refus */

titre('NOMMER LE REFUS');

RAZ();
reponse = { status: 403 };
let leve = null;
try { await M.rejouerLesAttentes(); } catch (err) { leve = err; }
ok('rien a renvoyer ne leve rien et ne demande rien au serveur',
   leve === null && envois.length === 0);

M.garder('100', 8220, 'Léo', 'reseau');
memoire.set('sprinter_player_name', 'Léo');

reponse = { status: 403 };
ok('un nom reserve est nomme, pas confondu avec le reseau',
   await (async () => { await M.rejouerLesAttentes(); return attente()[0]?.raison; })() === 'nom-reserve',
   attente()[0]?.raison);

reponse = { status: 429 };
await M.rejouerLesAttentes();
ok('une adresse trop bavarde est nommee aussi', attente()[0]?.raison === 'trop-vite',
   attente()[0]?.raison);

reponse = { status: 500 };
await M.rejouerLesAttentes();
ok('tout le reste est du reseau', attente()[0]?.raison === 'reseau', attente()[0]?.raison);

/* ------------------------------------------------------ ne rien perdre */

titre('NE RIEN PERDRE');

ok('le chrono a survecu a trois refus de suite', attente()[0]?.ms === 8220,
   String(attente()[0]?.ms));
ok('un seul record par epreuve, quoi qu il arrive', attente().length === 1,
   String(attente().length));

M.garder('100', 8400, 'Léo', 'reseau');
ok('un chrono moins bon ne remplace pas celui qui attend', attente()[0]?.ms === 8220,
   String(attente()[0]?.ms));
M.garder('100', 8100, 'Léo', 'reseau');
ok('un chrono meilleur, si', attente()[0]?.ms === 8100, String(attente()[0]?.ms));

M.garder('200', 17500, 'Léo', 'reseau');
ok('les epreuves ne se marchent pas dessus', attente().length === 2,
   attente().map(r => r.race).join(', '));

/* --------------------------------------------- renvoyer sous le bon nom */

titre('RENVOYER SOUS LE NOM D AUJOURD HUI');

RAZ();
M.garder('100', 8220, 'Léo', 'nom-reserve');
memoire.set('sprinter_player_name', 'Léo le vrai');
reponse = { status: 200 };
const passes = await M.rejouerLesAttentes();

ok('le renvoi porte le nom du jour, pas celui du refus',
   envois[0]?.corps?.name === 'Léo le vrai', envois[0]?.corps?.name);
ok('il porte le chrono au millieme, en millisecondes',
   envois[0]?.corps?.best_split_ms === 8220, String(envois[0]?.corps?.best_split_ms));
ok('il ne touche pas au cumul du parcours',
   envois[0]?.corps?.time_ms === 1200000, String(envois[0]?.corps?.time_ms));
ok('un record accepte est compte', passes === 1, String(passes));
ok('et il n attend plus', attente().length === 0, String(attente().length));

envois.length = 0;
await M.rejouerLesAttentes();
ok('un second passage ne renvoie pas ce qui est deja arrive', envois.length === 0,
   String(envois.length));

/* -------------------------------------------------- sans nom, rien ne part */

titre('SANS NOM, RIEN NE PART');

RAZ();
M.garder('100', 8220, '', 'reseau');
memoire.delete('sprinter_player_name');
await M.rejouerLesAttentes();
ok('un joueur sans nom ne poste rien', envois.length === 0, String(envois.length));
ok('mais son record continue d attendre', attente().length === 1);

/* ------------------------------------- le nom retrouve fait partir le record */

titre('LE NOM RETROUVE FAIT PARTIR LE RECORD');

RAZ();
M.garder('100', 8220, 'Léo', 'nom-reserve');
reponse = { status: 200 };
M.brancherRattrapage();                     // au lancement : sans nom, rien
await new Promise(r => setImmediate(r));
ok('le lancement seul ne poste rien tant que le nom manque', envois.length === 0,
   String(envois.length));

M.saveName('Léo le vrai');                  // le joueur relie son appareil
await new Promise(r => setImmediate(r));
await new Promise(r => setImmediate(r));
ok('poser un nom relance l envoi tout seul', envois.length === 1, String(envois.length));
ok('et le record est parti sous ce nom-la', envois[0]?.corps?.name === 'Léo le vrai',
   envois[0]?.corps?.name);
ok('la file est vide', attente().length === 0, String(attente().length));

console.log(`\n${e ? `✗ ${e} echec(s)` : '✓ tout passe'}\n`);
process.exit(e ? 1 : 0);
