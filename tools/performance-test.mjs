// Verifie les vrais chemins de chargement, de cadence et de premier geste.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transform } from 'esbuild';

const lire = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const vraisTimers = globalThis.setTimeout;
const attente = new Map();
let id = 0;
globalThis.setTimeout = fn => { attente.set(++id, fn); return id; };
const vider = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const reveiller = async () => {
  const fns = [...attente.values()]; attente.clear();
  for (const fn of fns) fn();
  await vider();
};
try {
  globalThis.document = { hidden: false };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { connection: {} } });
  globalThis.SprinterApp = { G: { state: 'race' } };
  const source = lire('src/game/chargement.ts').replace("import liste from 'virtual:precharge';", 'const liste = { ordinaire: [], ultra: [] };')
    .replaceAll('import.meta.env.BASE_URL', '"/"');
  const { code } = await transform(source + '\nexport { telecharger };', { loader: 'ts', format: 'esm' });
  const { telecharger } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
  let vols = [], appels = [], compte = 0, max = 0;
  globalThis.fetch = (url, opts) => {
    assert.ok(url && !url.includes('undefined'));
    appels.push({ url, opts });
    return new Promise(resolve => { vols.push(() => resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(0) })); max = Math.max(max, vols.length); });
  };
  const fond = telecharger(['a', 'b', 'c'], () => compte++, true);
  await vider(); assert.equal(appels.length, 0, 'aucun prechargement pendant la course');
  SprinterApp.G.state = 'title'; document.hidden = true;
  await reveiller(); assert.equal(appels.length, 0, 'aucun prechargement dans un onglet masque');
  document.hidden = false; await reveiller();
  assert.equal(vols.length, 2, 'deux requetes facultatives au plus');
  assert.equal(appels[0].opts.priority, 'low');
  SprinterApp.G.state = 'race';
  vols.splice(0).forEach(f => f()); await vider();
  assert.equal(appels.length, 2, 'la course suspend le lot suivant');
  SprinterApp.G.state = 'title'; await reveiller();
  assert.equal(appels.length, 3, 'la reprise ne depasse pas la fin du lot');
  vols.splice(0).forEach(f => f()); await fond;
  assert.equal(compte, 3); assert.equal(max, 2);
  navigator.connection.saveData = true;
  await telecharger(['economiser'], () => {}, true);
  assert.equal(appels.length, 3, 'economie de donnees respectee');
  const essentiel = telecharger(['1','2','3','4','5','6','7'], () => {});
  await vider(); assert.equal(vols.length, 6, 'le chargement essentiel garde ses six requetes');
  vols.splice(0).forEach(f => f()); await vider();
  vols.splice(0).forEach(f => f()); await essentiel;
  console.log('✓ Chargement : priorites, concurrence, pause/reprise, onglet masque et economie de donnees');

  const rendu = lire('src/game/course-3d.ts');
  const regle = rendu.slice(rendu.indexOf('const TELEPHONE ='), rendu.indexOf('// ?vue=survol'));
  const js = (await transform(regle, { loader: 'ts' })).code;
  const cadence = (retenu = null, query = '') => new Function('retenu', 'query', `
    const Q = new URLSearchParams(query), matchMedia = () => ({ matches: true });
    const localStorage = { getItem: () => retenu, setItem() {} };
    const window = { devicePixelRatio: 3 };
    let ratio = 0, renderer = { setPixelRatio(r) { ratio = r; } }, soleil = null;
    const OMBRES = true, dimensionner = () => {};
    ${js}
    return { image: tenirLaCadence, lire: () => ({ palier, ratio }), appliquerLePalier };
  `)(retenu, query);
  let c = cadence(); c.appliquerLePalier(); assert.equal(c.lire().ratio, 2);
  for (let i = 0; i < 100; i++) c.image(1/60, true);
  assert.equal(c.lire().palier, 2, '60 images/s gardent la qualite');
  c.image(0.1, true); assert.equal(c.lire().palier, 2, 'une seule image lente ne suffit pas');
  for (let i = 0; i < 65; i++) c.image(0.025, true);
  assert.equal(c.lire().palier, 1); assert.equal(c.lire().ratio, 1.5);
  for (let i = 0; i < 65; i++) c.image(0.025, true);
  assert.equal(c.lire().palier, 0); assert.equal(c.lire().ratio, 1);
  c = cadence('0'); assert.equal(c.lire().palier, 0, 'palier bas memorise sur telephone');
  c = cadence(null, 'qualite=ultra'); for (let i = 0; i < 200; i++) c.image(0.04, true);
  assert.equal(c.lire().palier, 3, 'choix ultra explicite conserve');
  console.log('✓ Rendu : 60 images/s, incident isole, baisse durable, resolution, memoire et choix explicite');

  const audio = lire('src/game/sprinter-app.js');
  const debut = audio.indexOf('    init() {');
  const fin = audio.indexOf('    /**', debut);
  const a = new Function('return ({' + audio.slice(debut, fin) + '})')();
  let tranches = 0, resumes = 0;
  a.ctx = { state: 'suspended', resume() { resumes++; this.state = 'running'; return Promise.resolve(); } };
  a.chantier = {};
  a.avancer = ms => { assert.equal(ms, 2); if (++tranches === 4) a.chantier = null; };
  a.init(); assert.equal(resumes, 1); assert.equal(tranches, 1, 'le geste ne finit pas la synthese');
  a.init(); assert.equal(tranches, 1, 'un deuxieme geste ne double pas le travail');
  await reveiller(); await reveiller(); await reveiller();
  assert.equal(a.chantier, null); assert.equal(tranches, 4);
  console.log('✓ Audio : reveil dans le geste, synthese fractionnee et sans minuteurs dupliques');
} finally { globalThis.setTimeout = vraisTimers; }
