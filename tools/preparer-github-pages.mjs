// Cloudflare a deja recu les trois versions completes. GitHub Pages ne
// garde que la production et des entrees vers les deux versions de test.
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

export function preparerGithubPages(dossier) {
  const racine = resolve(dossier);
  if (!existsSync(join(racine, 'index.html'))) throw new Error('Build absent : index.html introuvable');
  for (const canal of ['test', 'test3d']) {
    const dest = join(racine, canal);
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dest, { recursive: true });
    writeFileSync(join(dest, 'index.html'), `<!doctype html>
<html lang="fr"><meta charset="utf-8"><title>Sprinter — version de test</title>
<meta name="robots" content="noindex"><script>
location.replace(new URL(location.pathname + location.search + location.hash, 'https://sprinter-game.pages.dev').href);
</script><a href="https://sprinter-game.pages.dev/${canal}/">Ouvrir la version de test</a></html>`);
  }
  const taille = d => readdirSync(d, { withFileTypes: true }).reduce((total, e) => {
    const p = join(d, e.name);
    if (e.isSymbolicLink()) throw new Error('Lien symbolique non pris en charge : ' + p);
    return total + (e.isDirectory() ? taille(p) : statSync(p).size);
  }, 0);
  const octets = taille(racine);
  if (octets > 1_000_000_000) throw new Error(`GitHub Pages : ${octets} octets, au-dessus de la limite de 1 Go`);
  return octets;
}

if (process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  console.log(`GitHub Pages : ${preparerGithubPages(process.argv[2] || 'dist')} octets`);
}
