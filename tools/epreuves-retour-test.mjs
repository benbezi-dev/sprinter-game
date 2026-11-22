// Retour depuis une course : le panneau doit exister avant toute reponse reseau.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const effets = [], boutons = [], departs = [], attaques = [];
let fantomeDisponible = true;
globalThis.__epreuvesTest = {
  React, effets, boutons,
  start: (...args) => departs.push(args),
  defier: async (...args) => { attaques.push(args); return fantomeDisponible; },
};
globalThis.document = { body: {} };
globalThis.window = { setInterval: () => 1, clearInterval() {} };
// Le GET ne repond jamais : la navigation ne doit pas en dependre.
globalThis.fetch = () => new Promise(() => {});

const modules = {
  react: `const r = globalThis.__epreuvesTest.React;
    export default { ...r, createElement(type, props, ...children) {
      if (type === 'button') globalThis.__epreuvesTest.boutons.push({ ...props, children });
      return r.createElement(type, props, ...children);
    }};
    export const useState = r.useState;
    export const useEffect = fn => globalThis.__epreuvesTest.effets.push(fn);`,
  'react-dom': 'export const createPortal = node => node;',
  'motion/react': `const r = globalThis.__epreuvesTest.React;
    export const motion = new Proxy({}, { get: (_, tag) => ({ children }) => r.createElement(tag, null, children) });
    export const AnimatePresence = ({ children, initial }) => r.createElement('section', { 'data-initial': initial }, children);`,
  'lucide-react': 'export const Loader2 = () => null, Ghost = Loader2, Crosshair = Loader2, Vote = Loader2, Swords = Loader2;',
  '@/lib/mouvement': 'export const MONTEE = {}, useAnimationsReduites = () => true;',
  '@/game/engine': `export const SprinterApp = { N: { getLang: () => 'fr' }, startOneShot: globalThis.__epreuvesTest.start };`,
  '@/game/leaderboard': `export const getDeviceId = () => 'test', getSavedName = () => 'Moi';`,
  '@/game/duel-epreuves': `export const defier = globalThis.__epreuvesTest.defier, dernierVerdict = null, oublierVerdict = () => {};`,
  '@/hooks/use-retour': 'export const useRetour = () => {};',
};
const { outputFiles } = await build({
  stdin: { contents: readFileSync(new URL('../src/components/screens/BanderoleEpreuves.tsx', import.meta.url), 'utf8')
    + '\nexport { EcranEpreuves };', loader: 'tsx' },
  bundle: true, write: false, format: 'esm', define: { 'import.meta.env.BASE_URL': '"/"' },
  plugins: [{ name: 'doublures', setup(b) {
    b.onResolve({ filter: /.*/ }, ({ path }) => ({ path, namespace: 'doublure' }));
    b.onLoad({ filter: /.*/, namespace: 'doublure' }, ({ path }) => {
      assert.ok(path in modules, `Import non simule : ${path}`);
      return { contents: modules[path] };
    });
  } }],
});
const { BanderoleEpreuves, EcranEpreuves } = await import('data:text/javascript;base64,'
  + Buffer.from(outputFiles[0].text).toString('base64'));
const tableau = { ouvert: true, fin: Date.now() + 86400000, en_tete: '200s', voix_par_jour: 10,
  mes_voix_du_jour: 2, epreuves: Object.fromEntries(['60', '200s', '400s'].map(e => [e, { voix: 3, joueurs: 1 }])),
  fantomes: { '200s': [{ name: 'Rival', cible: 'rival', ms: 22000, a_battre_ms: 23000, voix: 3 }] } };
function afficher(composant, props) {
  boutons.length = 0; effets.length = 0;
  return renderToStaticMarkup(React.createElement(composant, props));
}
function monter() { for (const effet of effets.splice(0)) effet(); }
assert.equal(afficher(BanderoleEpreuves), '', 'Pas de retour demande : chargement normal');
monter();
for (const action of ['cible', 'automatique', 'vote', 'indisponible']) {
  fantomeDisponible = action !== 'indisponible';
  let ferme = false;
  afficher(EcranEpreuves, { premier: tableau, onClose: () => { ferme = true; } });
  const bouton = action === 'cible'
    ? boutons.find(b => b['aria-label'] === 'Défier le fantôme de Rival')
    : boutons.find(b => b.children.some?.(c => c === (action === 'vote' ? 'VOTER 200 m' : 'FANTÔME −3')));
  assert.ok(bouton, action);
  await bouton.onClick();
  assert.equal(ferme, fantomeDisponible);
  const html = afficher(BanderoleEpreuves);
  assert.equal(html.includes('QUELLE ÉPREUVE ?'), fantomeDisponible, `${action} : retour immediat`);
  if (fantomeDisponible) assert.ok(html.includes('data-initial="false"'), 'Pas de fondu sur le menu');
  monter();
  assert.equal(afficher(BanderoleEpreuves), '', 'Retour consomme : ne pas rouvrir a la visite suivante');
  monter();
}
assert.deepEqual(attaques, [['200s', 'rival'], ['200s', undefined], ['200s', undefined]]);
assert.deepEqual(departs, [[['200s'], { levelIdx: 4 }]]);
console.log('OK — retours fantome cible, automatique et vote sans reponse reseau ; echec sans navigation ; retour consomme.');
