#!/usr/bin/env node
/**
 * Le worker refuse les chronos impossibles en s'appuyant sur la physique du
 * moteur : la vitesse de pointe de chaque epreuve, et le multiplicateur de
 * transition. Ces trois nombres vivent dans `src/game/sprinter-core.js`, cote
 * client, et sont RECOPIES dans `worker/src/index.js` — le worker ne partage
 * aucun module avec le jeu, et une dependance vers `src/` casserait son
 * deploiement.
 *
 * Une copie derive. Si un jour `maxSpeed` monte dans le moteur sans monter
 * ici, le worker refusera des courses parfaitement jouables — et le refus
 * tombera sur le meilleur joueur, celui qui touche le plafond. Ce controle
 * relit les deux fichiers et compare.
 *
 *     node tools/verifier-plancher.mjs
 *
 * Sortie 0 si les deux s'accordent, 1 sinon.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const moteur = readFileSync(join(racine, 'src/game/sprinter-core.js'), 'utf8');
const worker = readFileSync(join(racine, 'worker/src/index.js'), 'utf8');

/** Les `maxSpeed` du moteur, lus dans les definitions d'epreuves de RACES. */
function vitessesDuMoteur() {
  const out = {};
  // Chaque epreuve s'ouvre par `'100': {` et porte un `maxSpeed: 12.435`.
  const bloc = /'(100|200|400)':\s*\{([\s\S]*?)\n    \}/g;
  let m;
  while ((m = bloc.exec(moteur))) {
    const v = /maxSpeed:\s*([\d.]+)/.exec(m[2]);
    if (v) out[m[1]] = Number(v[1]);
  }
  return out;
}

/** Le plus haut TRANS_VMAX : le seul releveur possible en course individuelle. */
function transVmaxDuMoteur() {
  const m = /TRANS_VMAX:\s*\[([^\]]+)\]/.exec(moteur);
  if (!m) return null;
  return Math.max(...m[1].split(',').map(s => Number(s.trim())));
}

function vitessesDuWorker() {
  const m = /const VMAX_EPREUVE = \{([^}]+)\}/.exec(worker);
  if (!m) return null;
  const out = {};
  for (const [, k, v] of m[1].matchAll(/'(\d+)':\s*([\d.]+)/g)) out[k] = Number(v);
  return out;
}

function transVmaxDuWorker() {
  const m = /const TRANS_VMAX_MAX = ([\d.]+)/.exec(worker);
  return m ? Number(m[1]) : null;
}

const vm = vitessesDuMoteur();
const vw = vitessesDuWorker();
const tm = transVmaxDuMoteur();
const tw = transVmaxDuWorker();

const ecarts = [];
if (!vw) ecarts.push('VMAX_EPREUVE introuvable dans le worker');
if (tw === null) ecarts.push('TRANS_VMAX_MAX introuvable dans le worker');
if (tm === null) ecarts.push('TRANS_VMAX introuvable dans le moteur');

for (const ep of ['100', '200', '400']) {
  if (vm[ep] === undefined) { ecarts.push(`${ep} m : maxSpeed absent du moteur`); continue; }
  if (!vw || vw[ep] === undefined) { ecarts.push(`${ep} m : absent du worker`); continue; }
  if (vm[ep] !== vw[ep]) ecarts.push(`${ep} m : moteur ${vm[ep]} vs worker ${vw[ep]}`);
}
if (tm !== null && tw !== null && tm !== tw) {
  ecarts.push(`TRANS_VMAX : moteur ${tm} vs worker ${tw}`);
}

const DIST = { 100: 100, 200: 200, 400: 400 };
console.log('Plancher de plausibilite, epreuve par epreuve :\n');
for (const ep of ['100', '200', '400']) {
  if (vm[ep] === undefined || tm === null) continue;
  const plafond = vm[ep] * tm;
  const plancher = DIST[ep] / plafond;
  console.log(
    `  ${ep.padStart(3)} m   vmax ${vm[ep].toFixed(3)} x ${tm}` +
    ` = ${plafond.toFixed(3)} m/s   ->   plancher ${plancher.toFixed(3)} s`
  );
}

if (ecarts.length) {
  console.error('\nLe worker et le moteur ne s\'accordent plus :');
  for (const e of ecarts) console.error('  - ' + e);
  console.error('\nCorriger VMAX_EPREUVE / TRANS_VMAX_MAX dans worker/src/index.js.');
  process.exit(1);
}
console.log('\nLe worker porte bien la physique du moteur.');
