/**
 * Le terrain des captures : une population fabriquee, dans la base LOCALE de
 * production.
 *
 * Pourquoi la base de production locale et non celle de test : le canal de
 * test porte un bandeau « VERSION DE TEST » en haut de l'ecran et une porte a
 * code, et la charte interdit de presenter le canal de test comme le jeu
 * (§5.2). Le canal de production, lui, ouvre desormais tout — DUELS_OUVERTS et
 * RELAIS_OUVERT valent true — et ne porte aucune marque. Comme le serveur est
 * un `wrangler dev --local`, aucun joueur reel n'existe dans cette base et
 * aucune ecriture ne sort de cette machine.
 *
 * Aucun des noms ci-dessous n'appartient a un joueur reel : la charte interdit
 * de publier le pseudonyme de quelqu'un sans son accord (§5.4).
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VEDETTES, SANS_PAYS, dossard } from './noms.mjs';

const WORKER = '/Volumes/MUSIQUE/BENBEZI/Sprinter/worker';
const BASE = 'sprinter-leaderboard';
const MARQUE = 'captures';
const maintenant = Date.now();
const ech = s => String(s).replace(/'/g, "''");

/* ---------------------------------------------------------------- le peuple

   Les pays n'ont plus de listes de prenoms : depuis le 9 septembre 2026 le
   peloton porte des DOSSARDS (`dossard()` dans noms.mjs), et un dossard ne
   depend pas du pays. Ne reste donc ici que ce que la base exige de savoir
   d'un coureur : son pays et son continent. Voir noms.mjs pour le pourquoi du
   registre. */
const PAYS = [
  { code: 'FR', continent: 'EU' },
  { code: 'ES', continent: 'EU' },
  { code: 'DE', continent: 'EU' },
  { code: 'US', continent: 'AM' },
  { code: 'CA', continent: 'AM' },
  { code: 'MA', continent: 'AF' },
  { code: 'CI', continent: 'AF' },
  { code: 'SN', continent: 'AF' },
];
const PAR_PAYS = 36;
let graine = 7013;
const hasard = () => (graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

/* ------------------------------------------------------- la tete d'affiche
   VEDETTES et SANS_PAYS sont dans `noms.mjs`, avec les points poses a la main
   et l'ordre du classement : la camera doit se tenir JUSTE derriere sa cible
   pour que le duel qu'on filme la fasse passer devant elle. */

/* Les chronos, pour que ces noms existent au TOP 500 — sans quoi on ne peut
   pas les defier depuis le classement : `defierDepuisClassement` cherche la
   cible dans le classement de vitesse, pas dans celui des duels. */
/* Les chronos des vedettes, poses a la main plutot que derives d'un rang.
   Le but est qu'une course FILMEE ne declenche ni record du monde ni record
   personnel : ces deux fenetres sont belles, mais elles s'ouvrent par-dessus
   l'ecran d'arrivee et coupent le recit du duel. On laisse donc le sommet du
   TOP 500 hors d'atteinte d'une bonne course (9,11 s), et on donne a chaque
   vedette un record personnel qu'elle ne battra pas ce jour-la. */
const CHRONOS = { '100': 9020, '200': 19240, '400': 43600 };
const APPAREILS = {};

const lignes = [];
const vider = process.argv.includes('--vider');
if (vider || !process.argv.includes('--garder')) {
  lignes.push(`DELETE FROM duel_players;`);
  lignes.push(`DELETE FROM player_pays;`);
  lignes.push(`DELETE FROM players;`);
  lignes.push(`DELETE FROM player_devices WHERE device_id LIKE 'cap-%';`);
  lignes.push(`DELETE FROM scores WHERE device_id LIKE 'cap-%';`);
  lignes.push(`DELETE FROM duel_results;`);
  // Les chronos herites des anciens harnais locaux : des 6,93 s, quand le
  // record du monde du jeu est 9,10. Un TOP 500 filme ne peut pas les porter.
  lignes.push(`DELETE FROM scores;`);
  for (const t of ['champ_resultats','champ_partants','champ_annonces','champ_medailles','champ_titres','champ_editions']) {
    lignes.push(`DELETE FROM ${t};`);
  }
}
if (vider) { ecrire(); process.exit(0); }

function poser(cle, nom, { pays, continent, palier, lp, mmr, wins, losses, source = MARQUE }) {
  lignes.push(
    `INSERT OR REPLACE INTO duel_players (name_key, name, points, wins, losses, draws, launched, last_delta, updated_at, received, mmr, lp, palier, bouclier) ` +
    `VALUES ('${ech(cle)}', '${ech(nom)}', ${wins*12}, ${wins}, ${losses}, 0, ${wins+losses}, 0, ${maintenant - Math.floor(hasard()*12*86400000)}, 0, ${mmr}, ${lp}, ${palier}, 0);`);
  if (pays) lignes.push(
    `INSERT OR REPLACE INTO player_pays (name_key, pays, continent, source, vu_le) ` +
    `VALUES ('${ech(cle)}', '${pays}', '${continent}', '${source}', ${maintenant});`);
}

/** Reserve le nom a un appareil, et lui pose trois chronos. */
function incarner(nom, rang) {
  const cle = nom.trim().toLowerCase();
  const appareil = `cap-${cle}-${'0'.repeat(Math.max(0, 12 - cle.length))}0001`.slice(0, 40);
  APPAREILS[nom] = appareil;
  lignes.push(`INSERT OR REPLACE INTO players (name_key, name, code, created_at) VALUES ('${ech(cle)}', '${ech(nom)}', '${cle.toUpperCase().padEnd(6,'X').slice(0,6)}', ${maintenant});`);
  lignes.push(`INSERT OR REPLACE INTO player_devices (name_key, device_id, added_at) VALUES ('${ech(cle)}', '${appareil}', ${maintenant});`);
  for (const [course, base] of Object.entries(CHRONOS)) {
    const ms = base + rang * (course === '100' ? 26 : course === '200' ? 58 : 130) + Math.floor(hasard() * 18);
    lignes.push(`INSERT OR REPLACE INTO scores (device_id, race_key, name, time_ms, best_split_ms, updated_at) VALUES ('${appareil}', '${course}', '${ech(nom)}', ${ms}, ${ms}, ${maintenant});`);
  }
}

for (const [i, v] of VEDETTES.entries()) { poser(v.nom.toLowerCase(), v.nom, { ...v, source: 'choix' }); incarner(v.nom, i); }
poser(SANS_PAYS.nom.toLowerCase(), SANS_PAYS.nom, { ...SANS_PAYS, pays: null, continent: null });
incarner(SANS_PAYS.nom, VEDETTES.length);

let n = 0;
for (const p of PAYS) {
  for (let i = 0; i < PAR_PAYS; i++) {
    const nom = dossard(n + 1);
    const cle = nom.trim().toLowerCase();
    if (VEDETTES.some(v => v.nom.toLowerCase() === cle)) continue;
    const mmr = Math.round(1520 - (i / (PAR_PAYS - 1)) * 620 + (hasard() - 0.5) * 80);
    const duels = 3 + Math.floor(hasard() * 22);
    const wins = Math.round(duels * (0.25 + 0.5 * (1 - i / (PAR_PAYS - 1))));
    const app = `cap-f${String(n).padStart(3,'0')}-${p.code}-${i}-0001`;
    for (const [course, base] of Object.entries(CHRONOS)) {
      const ms = base + 340 + Math.round((1520 - mmr) * (course === '100' ? 2.1 : course === '200' ? 4.2 : 9.4)) + Math.floor(hasard() * 90);
      lignes.push(`INSERT OR REPLACE INTO scores (device_id, race_key, name, time_ms, best_split_ms, updated_at) VALUES ('${app}', '${course}', '${ech(nom)}', ${ms}, ${ms}, ${maintenant - Math.floor(hasard()*20*86400000)});`);
    }
    poser(cle, nom, { pays: p.code, continent: p.continent, mmr,
                      palier: Math.min(9, Math.max(2, Math.floor((mmr - 900) / 70))),
                      lp: (wins * 7) % 100, wins, losses: duels - wins });
    n++;
  }
}
console.log(`   ${VEDETTES.length} vedettes + ${n} coureurs sur ${PAYS.length} pays.`);

function ecrire() {
  const f = join(mkdtempSync(join(tmpdir(), 'semer-')), 'semer.sql');
  writeFileSync(f, lignes.join('\n'));
  execFileSync('npx', ['wrangler','d1','execute',BASE,'--local','--file',f],
    { cwd: WORKER, stdio: ['ignore','ignore','inherit'] });
  writeFileSync(new URL('./appareils.json', import.meta.url),
                JSON.stringify(APPAREILS, null, 2));
  console.log('   base locale de production semee.');
}
ecrire();
