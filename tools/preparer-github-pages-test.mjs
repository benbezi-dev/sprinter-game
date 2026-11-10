import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync, rmSync, truncateSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { preparerGithubPages } from './preparer-github-pages.mjs';
const dossier = mkdtempSync(join(tmpdir(), 'sprinter-pages-'));
try {
  assert.throws(() => preparerGithubPages(dossier), /Build absent/);
  writeFileSync(join(dossier, 'index.html'), 'production');
  mkdirSync(join(dossier, 'assets')); writeFileSync(join(dossier, 'assets', 'jeu.js'), 'jeu');
  for (const canal of ['test', 'test3d']) {
    mkdirSync(join(dossier, canal)); writeFileSync(join(dossier, canal, 'ancien.glb'), 'modele');
  }
  const taille = preparerGithubPages(dossier);
  assert.equal(readFileSync(join(dossier, 'index.html'), 'utf8'), 'production');
  assert.equal(readFileSync(join(dossier, 'assets', 'jeu.js'), 'utf8'), 'jeu');
  for (const canal of ['test', 'test3d']) {
    assert.equal(existsSync(join(dossier, canal, 'ancien.glb')), false);
    const html = readFileSync(join(dossier, canal, 'index.html'), 'utf8');
    let cible;
    vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], {
      URL, location: { pathname: `/${canal}/`, search: '?code=A%26B', hash: '#jeu', replace: u => { cible = u; } },
    });
    assert.equal(cible, `https://benbezi-dev.github.io/sprinter/${canal}/?code=A%26B#jeu`);
    assert.ok(html.includes(`href="https://benbezi-dev.github.io/sprinter/${canal}/"`));
  }
  assert.equal(preparerGithubPages(dossier), taille, 'preparation idempotente');
  truncateSync(join(dossier, 'assets', 'jeu.js'), 1_000_000_001);
  assert.throws(() => preparerGithubPages(dossier), /au-dessus de la limite/);
  console.log('✓ Production conservee, tests rediriges, parametres et ancre preserves, preparation idempotente');
} finally { rmSync(dossier, { recursive: true, force: true }); }
