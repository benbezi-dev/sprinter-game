// Les fiches de la presentation — `GET /champ/fiches` — contre le vrai serveur.
//
// Pre-requis : `wrangler dev --local` depuis worker/, avec ADMIN_CLE dans
// worker/.dev.vars. BASE=http://127.0.0.1:8791 pour viser un autre port.
//
// Le harnais pose lui-meme ce qu'il lit, dans la base de test LOCALE — une
// edition, huit lignes de duel, cinq medailles — et le retire en partant.
// Tout porte la marque « fiche harnais » dans la cle, ce qui rend le retrait
// exact.
//
// Ce qu'il cherche a prendre en defaut :
//   A. le niveau et le bilan sont ceux de la DISCIPLINE DE L'EDITION, pas ceux
//      d'une autre distance ou le joueur se bat aussi ;
//   B. un partant sans duel sur cette distance est « non classe », pas
//      departemental IV ;
//   C. le palmares garde les medailles expirees, les regroupe, et fait passer
//      la competition avant la couleur ;
//   D. `avant` retire ce qui a ete gagne apres l'heure de la course ;
//   E. seuls les partants de l'edition ont une fiche, quelle que soit la
//      casse de la cle demandee.

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const B = process.env.BASE || 'http://127.0.0.1:8791';
const CLE_ADMIN = process.env.ADMIN_CLE || 'cle-de-test-locale-uniquement';
const WORKER = fileURLToPath(new URL('../worker', import.meta.url));
const BASE_TEST = 'sprinter-leaderboard-test';

let echecs = 0;
const ok = (nom, cond, detail) => {
  console.log(`   ${cond ? '✓' : '✗'} ${nom}${cond || detail == null ? '' : ' — ' + detail}`);
  if (!cond) echecs++;
};

const ADMIN = { 'Content-Type': 'application/json', 'X-Sprinter-Admin': CLE_ADMIN };
const acces = await fetch(B + '/test/admin/creer', { method: 'POST', headers: ADMIN,
  body: JSON.stringify({ nom: 'harnais-fiches' }) }).then(r => r.json());
if (!acces.code) { console.log('pas d acces de test :', acces); process.exit(1); }
const H = { 'X-Sprinter-Test': acces.code };
// Une reprise, une seule : le peuplement dure quelques secondes, et le
// serveur ferme entre-temps la connexion que le client comptait reutiliser.
// Ce n'est pas la route qui echoue, c'est la socket qui a vieilli.
const lire = async u => {
  let r;
  try { r = await fetch(B + u, { headers: H }); }
  catch { r = await fetch(B + u, { headers: H }); }
  return { status: r.status, corps: await r.json() };
};

function sql(texte) {
  const dossier = mkdtempSync(join(tmpdir(), 'fiches-'));
  const fichier = join(dossier, 'fiches.sql');
  writeFileSync(fichier, texte);
  execFileSync('npx', ['wrangler', 'd1', 'execute', BASE_TEST, '--local', '--file', fichier],
    { cwd: WORKER, stdio: 'pipe' });
}

const ED = 'FICHEHAR';
const AUTRES = ['FICHEHA2', 'FICHEHA3'];
const K = n => 'fiche harnais ' + n;
const retirer = () => sql(`
  DELETE FROM champ_editions WHERE id IN ('${ED}', '${AUTRES.join("','")}');
  DELETE FROM champ_partants WHERE edition = '${ED}';
  DELETE FROM duel_players WHERE name_key LIKE 'fiche harnais %';
  DELETE FROM champ_medailles WHERE name_key LIKE 'fiche harnais %';
  DELETE FROM player_pays WHERE name_key LIKE 'fiche harnais %';`);

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  CHAMPIONNAT — LES FICHES DE LA PRESENTATION                 ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

// Les tables se creent a la premiere requete : on en fait une avant de poser.
const absente = await lire(`/champ/fiches?edition=${ED}&cles=x`);
ok('edition inconnue : 404', absente.status === 404, absente.status);
const invalide = await lire('/champ/fiches?edition=x');
ok('edition invalide : 400', invalide.status === 400, invalide.status);

const T = Date.now();
const H1 = T - 3600e3;          // il y a une heure
const VIEUX = T - 120 * 864e5;  // il y a cent vingt jours
retirer();
sql(`
  INSERT INTO champ_editions (id, echelon, zone, epreuve, debut, phase, etat, cree_le) VALUES
    ('${ED}', 'national', 'FR', '100', ${T}, 'finale', 'ouverte', ${T}),
    ('${AUTRES[0]}', 'national', 'FR', '100', ${VIEUX}, 'finale', 'terminee', ${VIEUX}),
    ('${AUTRES[1]}', 'continental', 'EU', '200', ${VIEUX}, 'finale', 'terminee', ${VIEUX});
  INSERT INTO champ_partants (edition, name_key, nom, rang_duel, phase, course, tenant) VALUES
    ('${ED}', '${K('leo')}', 'Leo', 1, 'finale', 1, 1),
    ('${ED}', '${K('hugo')}', 'Hugo', 2, 'finale', 1, 0),
    ('${ED}', '${K('karim')}', 'Karim', 3, 'finale', 1, 0);
  INSERT INTO duel_players (name_key, epreuve, name, wins, losses, draws, lp, palier, updated_at) VALUES
    ('${K('leo')}', '100', 'Leo', 12, 5, 1, 40, 9, ${T}),
    ('${K('leo')}', '200', 'Leo', 3, 0, 0, 10, 2, ${T}),
    ('${K('hugo')}', '100', 'Hugo', 1, 0, 0, 32, 0, ${T}),
    ('${K('karim')}', '200', 'Karim', 4, 4, 0, 0, 1, ${T}),
    ('${K('intrus')}', '100', 'Intrus', 9, 9, 9, 0, 16, ${T});
  INSERT INTO champ_medailles (echelon, zone, name_key, nom, place, edition, obtenu_le, expire_le) VALUES
    ('national', 'FR', '${K('leo')}', 'Leo', 1, '${AUTRES[0]}', ${VIEUX}, ${VIEUX + 1000}),
    ('national', 'FR', '${K('leo')}', 'Leo', 1, '${AUTRES[0]}', ${VIEUX + 5000}, ${VIEUX + 6000}),
    ('continental', 'EU', '${K('leo')}', 'Leo', 3, '${AUTRES[1]}', ${VIEUX}, ${T + 864e5}),
    ('national', 'FR', '${K('hugo')}', 'Hugo', 2, '${AUTRES[0]}', ${H1}, ${T + 864e5}),
    ('national', 'FR', '${K('intrus')}', 'Intrus', 1, '${AUTRES[0]}', ${H1}, ${T + 864e5});
  INSERT INTO player_pays (name_key, pays, source, vu_le) VALUES ('${K('leo')}', 'FR', 'harnais', ${T});
`);

try {
  const cles = ['Fiche Harnais LEO', K('hugo'), K('karim'), K('intrus')].map(encodeURIComponent).join(',');
  const r = await lire(`/champ/fiches?edition=${ED.toLowerCase()}&cles=${cles}`);
  ok('reponse 200', r.status === 200, r.status);
  const f = r.corps.fiches || {};
  ok('la distance de l edition', r.corps.epreuve === '100', r.corps.epreuve);

  console.log('── A. le niveau de la discipline de l edition ───────────────');
  const leo = f[K('leo')];
  ok('Leo a une fiche, malgre la casse de la cle', !!leo);
  ok('niveau du 100 m : national III', leo?.niveau?.etage === 'national' && leo?.niveau?.division === 3,
     JSON.stringify(leo?.niveau));
  ok('bilan du 100 m, pas du 200 m', leo?.bilan?.v === 12 && leo?.bilan?.d === 5 && leo?.bilan?.n === 1,
     JSON.stringify(leo?.bilan));
  ok('tenant du titre, et son pays', leo?.tenant === true && leo?.pays === 'FR');

  console.log('── B. le partant sans duel sur la distance ──────────────────');
  const karim = f[K('karim')];
  ok('non classe au 100 m', karim && karim.niveau === null, JSON.stringify(karim?.niveau));
  ok('bilan vierge', karim?.bilan?.v === 0 && karim?.bilan?.d === 0 && karim?.bilan?.n === 0);
  ok('palmares vide', Array.isArray(karim?.palmares) && karim.palmares.length === 0);

  console.log('── C. le palmares ───────────────────────────────────────────');
  const p = leo?.palmares || [];
  ok('deux lignes : les deux ors regroupes', p.length === 2, p.length);
  ok('le bronze continental passe devant l or national',
     p[0]?.echelon === 'continental' && p[0]?.place === 3 && p[0]?.epreuve === '200',
     JSON.stringify(p[0]));
  ok('les medailles expirees comptent : or ×2', p[1]?.place === 1 && p[1]?.n === 2,
     JSON.stringify(p[1]));
  ok('le nom de la zone voyage', p[1]?.zoneNom === 'France' && !!p[1]?.zoneNomEn);

  console.log('── D. la borne de la retransmission ─────────────────────────');
  const avant = await lire(`/champ/fiches?edition=${ED}&cles=${encodeURIComponent(K('hugo'))}&avant=${H1 - 1000}`);
  const apres = await lire(`/champ/fiches?edition=${ED}&cles=${encodeURIComponent(K('hugo'))}&avant=${H1 + 1000}`);
  ok('gagnee apres la course : absente', avant.corps.fiches?.[K('hugo')]?.palmares?.length === 0);
  ok('gagnee avant la course : presente', apres.corps.fiches?.[K('hugo')]?.palmares?.length === 1);

  console.log('── E. rien que la grille ────────────────────────────────────');
  ok('le non-partant n a pas de fiche', !(K('intrus') in f));
  ok('trois fiches, pas quatre', Object.keys(f).length === 3, Object.keys(f).length);
} finally {
  retirer();
}

console.log(echecs ? `\n   ${echecs} echec(s)\n` : '\n   tout passe\n');
process.exit(echecs ? 1 : 0);
