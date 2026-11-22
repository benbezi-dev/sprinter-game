// Le direct envoie l'appareil avec le nom, et la salle ne le montre a personne.
//
//   bash tools/controles-defis.sh direct-appareil-test
//
// Les adresses viennent du vrai client, empaquete, puis sont ouvertes sur le
// worker local.
import { build } from 'esbuild';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const B = process.env.BASE || 'http://127.0.0.1:8788';
let mal = 0;
const ok = (nom, vrai, detail) => {
  console.log(`   ${vrai ? '✓' : '✗'} ${nom}${vrai || !detail ? '' : ' — ' + detail}`);
  if (!vrai) mal++;
};

// Les seuls modules dont l'adresse depend ; le moteur et l'interface n'y sont pour rien.
const GARDES = /(^|\/)(live|salle-relais|salle-confrontation|liaison|leaderboard|canal)$/;
const bouchons = {
  name: 'bouchons',
  setup(b) {
    b.onResolve({ filter: /.*/ }, a =>
      a.kind === 'entry-point' || GARDES.test(a.path) ? null : { path: a.path, namespace: 'bouchon' });
    b.onLoad({ filter: /.*/, namespace: 'bouchon' }, () =>
      ({ contents: 'module.exports = Object.create(new Proxy({}, { get: () => () => null }));', loader: 'js' }));
  },
};
const { outputFiles } = await build({
  plugins: [bouchons],
  stdin: {
    contents: `export { Salle } from './src/game/live';
      export { SalleRelais } from './src/game/salle-relais';
      export { SalleConfrontation } from './src/game/salle-confrontation';
      export { getDeviceId } from './src/game/leaderboard';`,
    resolveDir: join(import.meta.dirname, '..'), loader: 'ts',
  },
  bundle: true, write: false, format: 'esm', platform: 'browser', logLevel: 'silent',
  define: { 'import.meta.env.VITE_CANAL': '""', 'import.meta.env': '{}' },
});
const dossier = mkdtempSync(join(tmpdir(), 'direct-appareil-'));
writeFileSync(join(dossier, 'client.mjs'), outputFiles[0].text);

const rangees = new Map();
globalThis.localStorage = {
  getItem: k => rangees.get(k) ?? null, setItem: (k, v) => rangees.set(k, String(v)),
  removeItem: k => rangees.delete(k),
};
const jeu = await import(join(dossier, 'client.mjs'));
rmSync(dossier, { recursive: true });

// Le client ne se connecte pas : on retient ou il serait alle.
const VraieWS = globalThis.WebSocket;
const adresses = [];
globalThis.WebSocket = class { constructor(u) { adresses.push(new URL(u)); } send() {} close() {} };

const code = 'T' + Math.random().toString(36).slice(2, 7).toUpperCase();
const appareil = jeu.getDeviceId();
const chemins = {
  'duel en direct': () => new jeu.Salle(code, {}).connecter(['100'], 4, 2),
  'salon de relais': () => new jeu.SalleRelais(code, {}, { salon: true }).connecter(),
  'relais d equipe': () => new jeu.SalleRelais(code, {}).connecter(),
  'confrontation': () => new jeu.SalleConfrontation(code, code, {}).connecter(),
};
const vues = {};
for (const [nom, aller] of Object.entries(chemins)) {
  aller();
  vues[nom] = adresses.at(-1);
  ok(`${nom} : l appareil part avec le nom`,
    vues[nom]?.searchParams.get('device') === appareil && !!vues[nom]?.searchParams.get('name'));
}
globalThis.WebSocket = VraieWS;

// Le serveur d'aujourd'hui accepte l'adresse et ne renvoie pas l'appareil.
const SECRET = `appareil-secret-${code.toLowerCase()}`;
for (const nom of ['duel en direct', 'salon de relais']) {
  const u = new URL(vues[nom]);
  const base = new URL(B);
  u.protocol = 'ws:'; u.host = base.host;
  const recus = [];
  const liens = [SECRET + '-a', SECRET + '-b'].map((id, i) => {
    const v = new URL(u);
    v.searchParams.set('device', id);
    v.searchParams.set('name', 'Coureur' + i);
    const ws = new WebSocket(v);
    ws.addEventListener('message', e => recus.push(String(e.data)));
    return ws;
  });
  await new Promise(r => setTimeout(r, 2000));
  ok(`${nom} : la salle accepte les deux`, liens.every(w => w.readyState === 1) && recus.length >= 2);
  const etat = await fetch(`${B}${u.pathname}/etat`).then(r => r.text());
  ok(`${nom} : l appareil ne revient a personne`,
    recus.length >= 2 && ![...recus, etat].some(x => x.includes(SECRET)));
  liens.forEach(w => w.close());
}

console.log(mal ? `\n${mal} en echec.` : '\nTout passe.');
process.exit(mal ? 1 : 0);
