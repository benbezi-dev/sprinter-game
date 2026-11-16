// LES BANCS QUI TOURNENT SANS SERVEUR, d'une seule commande : `npm test`.
//
// tools/ compte une centaine de bancs `*-test.mjs`, et aucun n'etait lance nulle part : seize
// avaient pourri sans que personne le voie (audit du 16/11). Ceux de la liste passent sur main
// et ne demandent ni worker local ni reseau. Les autres attendent un worker
// (`cd worker && npx wrangler dev --local --port 8788`) ou sont a reparer : voir tools/BANCS.md.
//
//   node tools/bancs.mjs            tous
//   node tools/bancs.mjs athlete    ceux dont le nom contient « athlete »
import { spawnSync } from 'node:child_process';

const BANCS = `
athlete-test
carte-defi-ouvert-html-test
championnats-test
classement-test
coude-casse-test
cycle-avant-test
faux-depart-test
fenetre-deploiement-test
haies-appel-test
haies-course-test
haies-jeu-test
haies-rendu-test
haies-serveur-test
haies-test
halloween-calendrier-test
halloween-camera-test
halloween-carnet-test
halloween-etapes-test
halloween-ouverture-test
halloween-traque-test
hauteur-test
heure-du-jour-test
insta-test
journal-defis-test
legende-test
lien-court-test
longueur-test
molosse-test
noel-test
objectif-distances-test
objectif-test
palette-affiche-test
panneaux-test
plancher-test
preparer-github-pages-test
profil-fusion-test
record-attente-test
records-du-monde-test
relais-regles-test
reprise-test
succes-test
tchat-marques-test
teintes-pub-test
triple-test
tunnel-test
vedettes-test
`.trim().split('\n');

const filtre = process.argv[2] || '';
let echecs = 0;
for (const b of BANCS.filter(n => n.includes(filtre))) {
  const r = spawnSync(process.execPath, [`tools/${b}.mjs`], { encoding: 'utf8', timeout: 120_000 });
  const bon = r.status === 0;
  console.log(`${bon ? '✓' : '✗'} ${b}`);
  if (!bon) { echecs++; console.log((r.stdout || '').split('\n').filter(l => l.includes('✗')).join('\n') || (r.stderr || '').slice(-600)); }
}
console.log(echecs ? `\n${echecs} banc(s) en echec\n` : '\nTous les bancs passent.\n');
process.exit(echecs ? 1 : 0);
