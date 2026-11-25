// Les deux mots doivent continuer à bouger entre deux images à 60 Hz.
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { outputFiles } = await build({
  entryPoints: ['src/game/impact-parfait.ts'], bundle: true, write: false, format: 'esm',
});
const preference = { matches: false };
globalThis.matchMedia = () => preference;
const { mouvementImpact, dureeFlash, FIN_IMPACT } = await import(
  'data:text/javascript;base64,' + Buffer.from(outputFiles[0].contents).toString('base64')
);

for (const [type, duree] of Object.entries(dureeFlash)) {
  preference.matches = false;
  for (const couche of ['premierMot', 'titre']) {
    const positions = new Set();
    for (let image = 0; image < 120; image++) {
      const pose = mouvementImpact(type, duree - image / 120, couche);
      if (pose.alpha > 0.3) positions.add(pose.x);
    }
    assert.ok(positions.size > 100, type + ' / ' + couche);
  }
  assert.equal(mouvementImpact(type, duree - FIN_IMPACT - 0.01), null);
  preference.matches = true;
  assert.equal(mouvementImpact(type, duree - 0.2, 'elan'), null);
  assert.equal(mouvementImpact(type, duree - 0.2, 'choc'), null);
  assert.deepEqual(mouvementImpact(type, duree - 0.2), mouvementImpact(type, duree - 0.7));
}
console.log('Départ et transition vérifiés au pas de 1/120 s, mouvements réduits compris.');
