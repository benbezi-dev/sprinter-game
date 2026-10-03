// LA REVANCHE EN DIRECT : TOUT LE MONDE DIT OUI, DANS LA MEME SALLE.
//
// `direct-revanche-duel-test.mjs` verifie qu'une revanche COMPTE : deux
// courses dans la meme salle, deux duels au classement. Il fait dire « pret »
// aux deux joueurs a chaque fois, et c'est precisement ce qui laissait passer
// le defaut que ce harnais-ci prend en defaut : la salle ne demandait rien a
// personne. « Pret » restait pose apres le verdict, si bien que le premier qui
// se redeclarait pret trouvait tous les autres deja prets — de la course
// d'avant — et relancait la piste a lui seul.
//
// Ce qu'on verifie :
//   1. au verdict, la salle remet tout le monde a « pas pret », et le dit ;
//   2. un seul oui ne fait rien partir, ni deux sur trois ; le dernier, si ;
//   3. un couloir libere attend d'etre repris, et le nouveau venu doit dire
//      oui a son tour ;
//   4. une salle videe en pleine course ne garde pas son pistolet : qui la
//      rouvre sous le meme code ne part pas seul sur un depart perime ;
//   5. celui qui rejoint court la distance de celui qui a ouvert, quoi qu'il
//      ait demande ;
//   6. le CLIENT (src/game/live.ts, tel qu'il est ecrit) rouvre une piste
//      fermee sous le meme code, avec la distance et la taille de la salle —
//      meme quand c'est celui qui l'avait rejointe qui revient le premier — et
//      s'y redeclare pret quand c'est une revanche qu'il demandait.
//
//   cd worker && npx wrangler dev --local --port 8788
//   node tools/direct-revanche-accord-test.mjs

import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const B = process.env.BASE || 'http://127.0.0.1:8788';
const WS = B.replace(/^http/, 'ws');
const attendre = ms => new Promise(r => setTimeout(r, ms));

let echecs = 0;
const ok = (nom, cond, detail) => {
  console.log(`   ${cond ? '✓' : '✗'} ${nom}${cond || !detail ? '' : ' — ' + detail}`);
  if (!cond) echecs++;
};
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const m = Math.random().toString(36).slice(2, 6).toUpperCase();
const nouvelle = () => fetch(`${B}/live/nouveau`, { method: 'POST' }).then(r => r.json()).then(x => x.id);

/** Un joueur qui parle le protocole a la main. */
function client(code, nom, { places = 2, races = '100' } = {}) {
  const c = { nom, moi: null, etat: null, depart: null, resultats: [], bienvenue: null };
  const q = `name=${encodeURIComponent(nom)}&races=${races}&level=5&max=${places}`;
  c.ws = new WebSocket(`${WS}/live/${code}?${q}`);
  c.ouvert = new Promise(res => c.ws.addEventListener('open', res));
  c.ws.addEventListener('message', ev => {
    const x = JSON.parse(ev.data);
    if (x.t === 'bienvenue') { c.moi = x.moi; c.bienvenue = x; }
    if (x.t === 'bienvenue' || x.t === 'salle' || x.t === 'sorti') c.etat = x;
    if (x.depart_a) c.depart = x.depart_a;
    if (x.t === 'resultat') c.resultats.push(x);
  });
  c.envoyer = o => c.ws.send(JSON.stringify(o));
  c.pret = v => c.envoyer({ t: 'pret', pret: v });
  return c;
}

const jusqua = async (cond, ms = 6000) => {
  for (let t = 0; t < ms && !cond(); t += 50) await attendre(50);
  return cond();
};
const pretDe = (vu, qui) => !!vu.etat?.joueurs?.find(j => j.id === qui.moi)?.pret;

/** Tout le monde pret, le pistolet, les chronos, le verdict. */
async function courir(joueurs, nom) {
  const avant = joueurs[0].resultats.length;
  for (const j of joueurs) j.pret(true);
  ok(`${nom} : le pistolet est annonce`, await jusqua(() => !!joueurs[0].depart));
  for (const j of joueurs) j.depart = null;
  joueurs.forEach((j, i) => j.envoyer({ t: 'fini', ms: 10500 + i * 300 }));
  ok(`${nom} : le verdict est rendu`,
     await jusqua(() => joueurs[0].resultats.length > avant));
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  REVANCHE EN DIRECT : TOUT LE MONDE DIT OUI                  ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

/* ------------------------------------------------------------------ 1, 2 */
titre('a deux : le oui de chacun, de nouveau');
{
  const code = await nouvelle();
  const a = client(code, `RA${m}A`), b = client(code, `RA${m}B`);
  await Promise.all([a.ouvert, b.ouvert]);
  await jusqua(() => a.etat?.joueurs?.length === 2);
  await courir([a, b], 'premiere course');

  ok('apres le verdict, la salle dit que personne n est pret',
     await jusqua(() => a.etat?.termine && a.etat.joueurs.every(j => !j.pret)),
     JSON.stringify(a.etat?.joueurs?.map(j => j.pret)));
  ok('les deux le voient', b.etat?.joueurs?.every(j => !j.pret));

  a.pret(true);
  ok('A demande la revanche : B le voit', await jusqua(() => pretDe(b, a)));
  await attendre(1200);
  ok('mais rien ne part sur le seul oui de A', !a.depart && !b.depart);

  a.pret(false);
  ok('A retire sa demande : B le voit', await jusqua(() => !pretDe(b, a)));
  b.pret(true);
  await attendre(1200);
  ok('B la demande a son tour : rien ne part encore', !a.depart && !b.depart);

  a.pret(true);
  ok('A accepte : la revanche part', await jusqua(() => !!a.depart && !!b.depart));
  ok('avec une presentation neuve', !!a.etat?.presentation);
  for (const j of [a, b]) j.depart = null;
  a.envoyer({ t: 'fini', ms: 10400 }); b.envoyer({ t: 'fini', ms: 10200 });
  ok('la revanche rend son verdict', await jusqua(() => a.resultats.length === 2));
  ok('et la salle redemande a tout le monde',
     await jusqua(() => a.etat.joueurs.every(j => !j.pret)));
  a.ws.close(); b.ws.close();
}

/* ------------------------------------------------------------------- 2, 3 */
titre('a trois : le dernier oui, et le couloir libere');
{
  const code = await nouvelle();
  const t = ['A', 'B', 'C'].map(x => client(code, `RA${m}3${x}`, { places: 3 }));
  await Promise.all(t.map(x => x.ouvert));
  await jusqua(() => t[0].etat?.joueurs?.length === 3);
  await courir(t, 'la course a trois');
  await jusqua(() => t[0].etat.joueurs.every(j => !j.pret));

  t[0].pret(true); t[1].pret(true);
  await jusqua(() => pretDe(t[2], t[1]));
  await attendre(1000);
  ok('deux oui sur trois : rien ne part', !t[0].depart);

  // Le troisieme s'en va sans repondre.
  t[2].ws.close();
  ok('il quitte la piste : les deux autres le voient',
     await jusqua(() => t[0].etat?.joueurs?.length === 2));
  await attendre(800);
  ok('les deux restants, prets, ne partent pas sur une piste incomplete', !t[0].depart);

  const d = client(code, `RA${m}3D`, { places: 3 });
  await d.ouvert;
  ok('quelqu un reprend le couloir', await jusqua(() => t[0].etat?.joueurs?.length === 3));
  await attendre(800);
  ok('il n a rien dit : rien ne part', !t[0].depart);
  ok('et il est bien « pas pret »', !pretDe(t[0], d));
  d.pret(true);
  ok('il dit oui : la revanche part', await jusqua(() => !!t[0].depart && !!d.depart));
  for (const x of [t[0], t[1], d]) x.ws.close();
}

/* --------------------------------------------------------------------- 4 */
titre('une salle videe en pleine course oublie son pistolet');
{
  const code = await nouvelle();
  const a = client(code, `RA${m}VA`), b = client(code, `RA${m}VB`);
  await Promise.all([a.ouvert, b.ouvert]);
  await jusqua(() => a.etat?.joueurs?.length === 2);
  a.pret(true); b.pret(true);
  ok('la course est lancee', await jusqua(() => !!a.depart));
  // Tout le monde s'en va avant l'arrivee : telephones fermes, reseau perdu.
  a.ws.close(); b.ws.close();
  const vide = async () => (await fetch(`${B}/live/${code}/etat`).then(r => r.json())).joueurs.length === 0;
  for (let i = 0; i < 40 && !(await vide()); i++) await attendre(100);
  ok('la salle les voit partir', await vide());

  const r = client(code, `RA${m}VR`);
  await r.ouvert;
  await jusqua(() => !!r.bienvenue);
  ok('la piste se rouvre sous le meme code', !!r.bienvenue);
  ok('sans pistolet perime', r.bienvenue?.depart_a == null, `depart_a=${r.bienvenue?.depart_a}`);
  ok('sans presentation perimee', r.bienvenue?.presentation == null);
  ok('sans course « terminee » qu il n a pas courue', r.bienvenue?.termine === false);
  ok('celui qui la rouvre en est l hote',
     !!r.bienvenue?.joueurs?.find(j => j.id === r.moi)?.hote);
  r.ws.close();
}

/* --------------------------------------------------------------------- 5 */
titre('la distance est celle de qui ouvre la piste');
{
  const code = await nouvelle();
  const h = client(code, `RA${m}DH`, { races: '400' });
  await h.ouvert; await jusqua(() => !!h.bienvenue);
  const j = client(code, `RA${m}DJ`, { races: '100' });
  await j.ouvert; await jusqua(() => !!j.bienvenue);
  ok('l hote ouvre un 400 m', h.bienvenue?.epreuves?.[0] === '400');
  ok('qui rejoint en demandant un 100 m apprend que c est un 400 m',
     j.bienvenue?.epreuves?.[0] === '400', JSON.stringify(j.bienvenue?.epreuves));
  const e = await fetch(`${B}/live/${code}/etat`).then(r => r.json());
  ok('l etat consulte avant d entrer le dit aussi', e.epreuves?.[0] === '400');
  h.ws.close(); j.ws.close();
}

/* --------------------------------------------------------------------- 6 */
titre('le client rouvre la piste fermee, sous le meme code');
{
  // La vraie classe du jeu, empaquetee telle quelle. Seules ses trois
  // dependances de navigateur sont remplacees : le nom (localStorage), le
  // canal (rien a ajouter en local) et le tchat rapide (React).
  const dossier = mkdtempSync(join(tmpdir(), 'sprinter-revanche-'));
  const entree = join(dossier, 'entree.ts');
  const sortie = join(dossier, 'paquet.mjs');
  writeFileSync(entree, `
    export { Salle } from '${join(process.cwd(), 'src/game/live.ts')}';
    export * from '${join(process.cwd(), 'src/game/salon-direct.ts')}';
  `);
  const bouchons = {
    leaderboard: `export const getSavedName = () => globalThis.__nom || 'Anonyme';
                  export const getDeviceId = () => 'appareil-test';`,
    canal: `export const EST_TEST = false; export const codeAcces = () => '';
            export const avecAcces = u => u;`,
    'tchat-rapide': `export const brancherRapide = () => {}; export const debrancherRapide = () => {};
                     export const recevoirRapide = () => {}; export const refusRapide = () => {};`,
  };
  await build({
    entryPoints: [entree], outfile: sortie, bundle: true,
    format: 'esm', platform: 'node', logLevel: 'silent',
    plugins: [{
      name: 'bouchons',
      setup(b) {
        b.onResolve({ filter: /^\.\/(leaderboard|canal|tchat-rapide)$/ },
                    a => ({ path: a.path.slice(2), namespace: 'bouchon' }));
        b.onLoad({ filter: /.*/, namespace: 'bouchon' },
                 a => ({ contents: bouchons[a.path], loader: 'js' }));
        // Le serveur de production est ecrit en dur : on vise le worker local.
        b.onLoad({ filter: /src\/game\/live\.ts$/ }, async a => ({
          contents: (await import('node:fs')).readFileSync(a.path, 'utf8')
            .replace(/https:\/\/sprinter-leaderboard\.[^'"]+/, B),
          loader: 'ts',
        }));
      },
    }],
  });
  const M = await import(sortie);

  const code = await nouvelle();
  const vus = { h: [], j: [] };
  const ecouteurs = qui => ({ onDepart: () => vus[qui].push('depart') });

  globalThis.__nom = `RA${m}CH`;
  const h = new M.Salle(code, ecouteurs('h'));
  h.connecter(['400'], 5, 2);
  await jusqua(() => !!h.moi);
  // Celui qui rejoint a laisse son selecteur sur 100 m et deux couloirs.
  globalThis.__nom = `RA${m}CJ`;
  const j = new M.Salle(code, ecouteurs('j'));
  let notes = 0;
  j.observer(() => notes++);
  j.connecter(['100'], 5, 2);
  await jusqua(() => !!j.moi && (h.dernierEtat?.joueurs?.length === 2));
  ok('qui rejoint retient la distance de la salle, pas la sienne',
     j.epreuves[0] === '400', JSON.stringify(j.epreuves));
  ok('l ecran qui regarde la salle est prevenu de ses changements', notes > 0);

  h.pret(true); j.pret(true);
  ok('la course part', await jusqua(() => vus.h.length === 1 && vus.j.length === 1));
  ok('chacun se voit pret, d apres la salle', h.pretMoi && j.pretMoi);
  h.fini(10300); j.fini(10600);
  ok('apres le verdict, personne n est plus pret',
     await jusqua(() => !h.pretMoi && !j.pretMoi && !!h.dernierEtat?.termine));

  // Personne ne demande la revanche : la salle se ferme d'elle-meme, comme
  // elle le fait pour ne pas rester eveillee — et facturee — pour rien. C'est
  // le cas qui obligeait a quitter et a ouvrir une autre piste.
  console.log('   … la salle se ferme d elle-meme apres le verdict (90 s)');
  ok('les deux se savent coupes',
     await jusqua(() => h.coupee && j.coupee, 100_000));
  ok('aucun n est plus en ligne', !h.enVie() && !j.enVie());

  // C'est celui qui avait REJOINT qui revient le premier, et c'est lui qui
  // refonde la piste : avec la distance et la taille de la salle, pas celles
  // de son selecteur. Et c'est une revanche qu'il demande : il y revient pret.
  const ancien = j.moi;
  globalThis.__nom = `RA${m}CJ`;
  M.poserSalon(j);
  M.voterRevanche(true);
  ok('il est reconnu sous une nouvelle identite',
     await jusqua(() => !!j.moi && j.moi !== ancien));
  ok('il n est plus coupe', !j.coupee && j.enVie());
  ok('il y est pret, sans avoir eu a le redire', await jusqua(() => j.pretMoi));
  ok('il en est l hote', j.suisHote);
  ok('la piste rouverte est un 400 m', j.dernierEtat?.epreuves?.[0] === '400',
     JSON.stringify(j.dernierEtat?.epreuves));
  ok('a deux couloirs', j.dernierEtat?.max === 2);
  await attendre(800);
  ok('seul, il ne part pas', vus.j.length === 1);

  globalThis.__nom = `RA${m}CH`;
  h.rouvrir(true);
  ok('l autre revient, pret lui aussi : la revanche part',
     await jusqua(() => vus.h.length === 2 && vus.j.length === 2),
     `departs ${vus.h.length}/${vus.j.length}`);
  ok('et les deux courent bien la meme piste',
     h.dernierEtat?.epreuves?.[0] === '400' && h.epreuves[0] === '400');

  M.quitterSalon(); h.fermer();
  ok('quitter ne passe pas pour une coupure', !h.coupee);
}

console.log(`\n${echecs === 0 ? '✓ tout passe' : '✗ ' + echecs + ' echec(s)'}\n`);
process.exit(echecs === 0 ? 0 : 1);
