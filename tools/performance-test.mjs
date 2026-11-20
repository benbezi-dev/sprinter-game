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

  navigator.connection.saveData = false; SprinterApp.G.state = 'open';
  const depart = appels.length;
  const essentiels = ['/decors/tribune/a.webp','/decors/day/a.webp','/decors/materiel/a.webp','/pubs/a.webp'];
  const reportes = ['/decors/mondiaux/a.webp','/decors/nuit/a.webp'];
  const ouvertureSource = source.replace('const liste = { ordinaire: [], ultra: [] };',
    'const liste = ' + JSON.stringify({ ordinaire: [...essentiels, ...reportes], ultra: [] }) + ';');
  const ouvertureJs = (await transform(ouvertureSource, { loader: 'ts', format: 'esm' })).code;
  const ouverture = await import('data:text/javascript;base64,' + Buffer.from(ouvertureJs).toString('base64'));
  ouverture.lancerChargement(); await vider();
  vols.splice(0).forEach(f => f()); await vider();
  vols.splice(0).forEach(f => f()); await vider();
  assert.equal(ouverture.chargementFini(), true, 'la nuit et les Mondiaux ne bloquent pas l accueil');
  assert.deepEqual(appels.slice(depart).map(a => a.url).sort(), [...essentiels].sort());
  SprinterApp.G.state = 'title'; await reveiller();
  assert.deepEqual(appels.slice(depart + essentiels.length).map(a => a.url).sort(), [...reportes].sort());
  vols.splice(0).forEach(f => f()); await vider();
  console.log('✓ Ouverture : seuls les decors du premier accueil sont bloquants');


  const rendu = lire('src/game/course-3d.ts');
  const regle = rendu.slice(rendu.indexOf('const TELEPHONE ='), rendu.indexOf('// ?vue=survol'));
  const js = (await transform(regle, { loader: 'ts' })).code;
  const cadence = (retenu = null, query = '') => new Function('retenu', 'query', `
    const Q = new URLSearchParams(query), matchMedia = () => ({ matches: true });
    const ecrits = [];
    const localStorage = { getItem: () => retenu, setItem(k, v) { ecrits.push(v); } };
    const window = { devicePixelRatio: 3 };
    let ratio = 0, renderer = { setPixelRatio(r) { ratio = r; } }, soleil = null;
    const OMBRES = true, dimensionner = () => {};
    ${js}
    return { image: tenirLaCadence, lire: () => ({ palier, ratio }), ecrits, appliquerLePalier, grace: () => { qualiteApres = performance.now() + 1000; } };
  `)(retenu, query);
  // une course qui saccade : deux images a 16,7 ms, une a 50 ms — plus de la moitie du temps en images lentes
  const saccade = c => { for (let i = 0; i < 40; i++) { c.image(1/60, true); c.image(1/60, true); c.image(0.05, true); } };
  let c = cadence(); c.appliquerLePalier(); assert.equal(c.lire().ratio, 2);
  for (let i = 0; i < 200; i++) c.image(1/60, true);
  assert.equal(c.lire().palier, 2, '60 images/s gardent la qualite');
  c.image(0.1, true); assert.equal(c.lire().palier, 2, 'une seule image lente ne suffit pas');
  for (let i = 0; i < 200; i++) { c.image(1/60, true); c.image(1/30, true); }
  assert.equal(c.lire().palier, 2, '40 images/s (une image sur deux a 33 ms) gardent le palier, comme avant le 10/11');
  saccade(c);
  assert.equal(c.lire().palier, 1); assert.equal(c.lire().ratio, 1.5);
  assert.deepEqual(c.ecrits, ['1'], 'une baisse mesuree en course est retenue');
  saccade(c);
  assert.equal(c.lire().palier, 0);
  assert.equal(c.lire().ratio, 1.5, 'le telephone ne descend jamais sous 1,5 pixel par point');
  c = cadence('0'); c.appliquerLePalier(); assert.equal(c.lire().ratio, 1.5, 'palier bas memorise, toujours a 1,5');
  c = cadence(null, 'qualite=ultra'); for (let i = 0; i < 200; i++) c.image(0.06, true);
  assert.equal(c.lire().palier, 3, 'choix ultra explicite conserve');
  assert.ok(rendu.includes("PALIER_CLE = 'sprinter_palier3d-v4'"), 'les paliers retenus sous la regle du 10/11 repartent de zero');
  console.log('✓ Rendu : 60 et 40 images/s gardent la qualite, baisse durable, plancher 1,5 au telephone, memoire remise a zero');
  c = cadence(); for (let i = 0; i < 300; i++) c.image(1/30, true);
  assert.equal(c.lire().palier, 2, 'un ecran plafonne a 30 images/s (economie d energie) ne perd pas la qualite');
  c = cadence(); for (let i = 0; i < 20; i++) c.image(0.2, true);
  assert.ok(c.lire().palier < 2, 'une cadence de 5 images/s est comptee, pas ignoree');
  c = cadence(); for (let i = 0; i < 80; i++) c.image(0.042, true);
  assert.equal(c.lire().palier, 1, '24 images/s regulieres restent une cadence lente');
  c = cadence(); c.grace(); for (let i = 0; i < 100; i++) c.image(0.06, true);
  assert.equal(c.lire().palier, 2, 'la compilation du nouveau stade a sa periode de grace');
  c = cadence(); for (let i = 0; i < 100; i++) c.image(0.06, false);
  assert.equal(c.lire().palier, 2, 'hors course (presentation, decompte), rien ne se juge');
  c = cadence('1'); for (let i = 0; i < 700; i++) c.image(1/60, true);
  assert.equal(c.lire().palier, 2, 'dix secondes de course fluide font remonter');
  assert.deepEqual(c.ecrits, ['2']);
  const horlogeSource = rendu.slice(rendu.indexOf('  const maintenantImage ='), rendu.indexOf('  const T = G.track;', rendu.indexOf('  const maintenantImage =')));
  const horloge = new Function(`
    let imagePrecedente3D = null, instant = 0, dernier;
    const performance = { now: () => instant }, document = { hidden: false };
    const tenirLaCadence = (dt, actif) => { dernier = { dt, actif }; };
    return (G, t) => { instant = t; ${horlogeSource} return dernier; };
  `)();
  assert.equal(horloge({ state: 'race', elapsed: 2 }, 1000).dt, 0);
  assert.deepEqual(horloge({ state: 'race', elapsed: 2 }, 1200), { dt: 0.2, actif: true });
  assert.equal(horloge({ state: 'count' }, 1400).actif, false, 'le decompte ne se juge pas');
  assert.equal(horloge({ state: 'cut', cut: { kind: 'intro' } }, 1600).actif, false, 'la presentation ne se juge pas');
  assert.equal(horloge({ state: 'race', elapsed: 0.5 }, 1800).actif, false, 'la premiere seconde de course non plus');
  assert.equal(horloge({ state: 'race', elapsed: 2, paused: true }, 2000).actif, false);
  console.log('✓ Course seule : temps reel, tres faible cadence, periode de grace, pause, presentation exclue');


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
