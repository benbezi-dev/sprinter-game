// RIEN NE DOIT PASSER A TRAVERS LE CORPS DE LA MASCOTTE NI LE SOL — mesure et corrections.
//
//   node tools/mascotte-verifier.mjs [--page http://localhost:5383] [--marge 0.004]
//        [--mesurer-seulement]
//
// Le serveur de dev doit tourner (il sert tools/tournage-mascotte/verifier.html). Le script ouvre la
// page dans un Chrome sans tete, mesure chaque geste des 9 mascottes (src/game/mascotte-3d.ts,
// MASCOTTES) image par image (voir verifier.ts), puis calcule les decalages qui ramenent les mains
// hors du corps : la plus petite poussee qui marche, image par image, adoucie dans le temps, puis
// jusqu'a quatre passes de reprise (une main poussee hors du ventre peut toucher la cuisse, et
// l'adoucissement rouvre des creux : on remesure avec la correction posee). Il ecrit
// public/modeles/mascotte/anime/corrections.json, que le jeu relit, et imprime le rapport avant/apres.
// La marge (ce qu'on laisse entre la main et la peau) est en part de la taille : 0,004 ≈ 6 mm sur 1,60 m.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const arg = (nom, def) => { const k = args.indexOf('--' + nom); return k >= 0 ? args[k + 1] : def; };
const PAGE = arg('page', 'http://localhost:5383');
const MARGE = +arg('marge', 0.004);
const MESURER = args.includes('--mesurer-seulement');
const ICI = path.dirname(new URL(import.meta.url).pathname);
const SORTIE = path.join(ICI, '../public/modeles/mascotte/anime/corrections.json');

const req = createRequire(import.meta.url);
const puppeteer = req(process.env.PUPPETEER_CORE
  || '/Volumes/MUSIQUE/BENBEZI/caches/npm/_npx/702923228c2ce1e6/node_modules/puppeteer-core');
const chrome = process.env.CHROME_SANS_TETE || process.env.HOME
  + '/.cache/puppeteer/chrome-headless-shell/mac-152.0.7977.54/chrome-headless-shell-mac-x64/chrome-headless-shell';

const b = await puppeteer.launch({ executablePath: chrome, headless: 'shell', protocolTimeout: 0,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const p = await b.newPage();
  p.on('console', (m) => { if (m.type() === 'error') console.log('page :', m.text()); });
  await p.goto(`${PAGE}/tools/tournage-mascotte/verifier.html`, { waitUntil: 'load', timeout: 120000 });
  await p.waitForFunction(() => window.__pret, { timeout: 120000 });
  const montrer = (titre, rapport) => {
    console.log(`\n${titre}`);
    const touche = (r) => r.bras || r.jambes || r.tete || r.sol;
    for (const r of rapport) if (r.erreur || touche(r)) console.log(`  ${r.cle.padEnd(28)} ${r.erreur || `${r.images} images | bras ${r.bras} pts, jambes ${r.jambes} pts, tete ${r.tete} pts, sol ${r.sol} images (${r.pireSol} %)`}`);
    const n = rapport.filter(touche).length;
    const somme = (k) => rapport.reduce((s, r) => s + (r[k] ? 1 : 0), 0);
    console.log(`  -> ${n} geste(s) sur ${rapport.length} touches : bras ${somme('bras')}, jambes ${somme('jambes')}, tete ${somme('tete')}, sol ${somme('sol')}`);
    return n;
  };
  const passe = (corr, corriger, chercher) => p.evaluate(async (c, k, m, ch) => {
    window.__verifier.poserCorrections(c);
    return window.__verifier.passe({ corriger: k, marge: m, chercherAussi: ch });
  }, corr, corriger, MARGE, chercher);
  const cumuler = (a, b2) => p.evaluate((x, y) => window.__verifier.cumuler(x, y), a, b2);

  const avant = await passe(null, false, !MESURER);
  montrer('AVANT (gestes bruts)', avant.rapport);
  if (MESURER) process.exit(0);
  // 1 : la poussee la plus petite, image par image, puis adoucie dans le temps
  let corr = await p.evaluate((a) => window.__verifier.lisser(window.__verifier.cumuler({}, a)), avant.ajout);
  // 2 a 5 : ce qui reste (les creux de l'adoucissement, une main poussee dans la cuisse...)
  for (let k = 2; k <= 5; k++) {
    const r = await passe(corr, true, true);
    if (!Object.keys(r.ajout).length) break;
    corr = await cumuler(corr, r.ajout);
  }
  const apres = await passe(corr, true, false);
  montrer('APRES', apres.rapport);
  fs.writeFileSync(SORTIE, JSON.stringify(corr));
  console.log(`\n${SORTIE} : ${Object.keys(corr).length} geste(s) corrige(s), ${(fs.statSync(SORTIE).size / 1024).toFixed(1)} Ko`);
} finally { await b.close(); }
