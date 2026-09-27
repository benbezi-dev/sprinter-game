// LES SAUTS NE PARTENT PAS EN PRODUCTION — et /test les a bien.
//
// Le saut en longueur, le triple saut et le saut en hauteur (canal.ts,
// LONGUEUR_OUVERTE, TRIPLE_OUVERT, HAUTEUR_OUVERTE) vivent derriere l'accueil
// de Jumper (Jumper.tsx), charge a la demande derriere SAUTS_OUVERTS : un seul
// morceau, avec les ecrans, les jeux, les rendus et le sable. La musique des
// sauts, elle, vit dans le moteur (MUSIQUES_SAUTS) et se replie a vide.
//
//   node tools/longueur-canal-test.mjs
//
// Le concours est ouvert sur le canal de test seulement (canal.ts,
// LONGUEUR_OUVERTE = EST_TEST). Deux choses doivent alors sortir du paquet
// public, et elles n'en sortent pas pour la meme raison :
//
//   — LE CODE : l'ecran, le jeu du saut, son rendu. Mondes.tsx le charge par
//     `/* @__PURE__ */ lazy(...)` derriere `LONGUEUR_OUVERTE && ...` ; sans
//     l'annotation, Rollup garde l'appel, et le morceau avec lui.
//   — LE SABLE : les images rendues dans Blender. `import.meta.glob` les
//     importe en `?url`, et Vite emet un tel fichier des qu'il LIT le module,
//     avant tout elagage. On l'a mesure : le code etait bien parti, les douze
//     images restaient. C'est le greffon de vite.config.ts qui les retient.
//
// On bati donc les deux canaux pour de vrai — esbuild ne decoupe pas en
// morceaux et repondrait « c'est la » quoi qu'il arrive. Une trentaine de
// secondes : ce harnais se lance a la main.

import { execFileSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const batir = (canal, dossier) => {
  rmSync(dossier, { recursive: true, force: true });
  execFileSync('npx', ['vite', 'build', '--outDir', dossier], {
    env: { ...process.env, VITE_CANAL: canal, BASE_PATH: '/' },
    stdio: 'pipe',
  });
  const a = join(dossier, 'assets');
  return existsSync(a) ? readdirSync(a) : [];
};

const dossierProd = join(tmpdir(), 'sprinter-longueur-prod');
const dossierTest = join(tmpdir(), 'sprinter-longueur-test');
const prod = batir('production', dossierProd);
const test = batir('test', dossierTest);

const MORCEAUX = /^(Jumper|Longueur|Hauteur)-.*\.js$/;
const duSaut = f => MORCEAUX.test(f) || /^(fosse|empreinte|gerbe)-.*\.webp$/.test(f);
const texte = (dossier, fichiers) => fichiers.filter(f => f.endsWith('.js'))
  .map(f => readFileSync(join(dossier, 'assets', f), 'utf8')).join('\n');

titre('RIEN DU SAUT DANS LE PAQUET PUBLIC');
ok('aucun fichier du saut', prod.filter(duSaut).length === 0, prod.filter(duSaut).join(', '));
ok('pas le morceau de l accueil de Jumper ni des concours', !prod.some(f => MORCEAUX.test(f)));
ok('pas une image de sable', !prod.some(f => /^(fosse|empreinte|gerbe)-/.test(f)));

// Des mots qui n'existent que dans le jeu du saut : l'epreuve telle que le
// moteur la lit, la cle de la memoire, les finalistes des grands concours.
const MOTS = ['la planche et le sable', 'sprinter.longueur.v1', 'Tomas Weit', 'Mike Powell',
               // le triple saut, qui partage l'ecran et le morceau
               'sprinter.triple.v1', 'Jonathan Edwards',
               // le saut en hauteur, son record, ses finalistes
               'la barre et le tapis', 'sprinter.hauteur.v1', 'Javier Sotomayor', 'Mutaz Salto',
               // l'accueil de Jumper et les recits de ses etapes
               'sprinter.jumper.epreuve', 'bac à sable de la maternelle',
               // la musique des sauts, dans le moteur
               's_race3'];
const jsProd = texte(dossierProd, prod), jsTest = texte(dossierTest, test);
for (const m of MOTS) ok(`« ${m} » absent du paquet public`, !jsProd.includes(m));

titre('ET TOUT EST LA SUR /test');
ok('le morceau de Jumper est emis', test.some(f => MORCEAUX.test(f)), test.filter(duSaut).join(', '));
ok('la fosse ratissee est emise', test.some(f => /^fosse-terre-.*\.webp$/.test(f)));
ok('la gerbe est emise', test.some(f => /^gerbe-terre-.*\.webp$/.test(f)));
ok('les mots du saut y sont, sinon on ne verifierait rien', MOTS.every(m => jsTest.includes(m)),
   MOTS.filter(m => !jsTest.includes(m)).join(', '));

rmSync(dossierProd, { recursive: true, force: true });
rmSync(dossierTest, { recursive: true, force: true });
console.log(e ? `\n${e} echec(s)` : '\nTout passe.');
process.exit(e ? 1 : 0);
