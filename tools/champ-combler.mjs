// Combler une grille de depart avec des partants fictifs, EN PRODUCTION.
//
// `championnat-peupler.mjs` fabrique un monde entier sur la base de test
// locale. Celui-ci fait autre chose, et il faut le dire clairement : il ecrit
// dans la base REELLE, celle que les joueurs voient. Il existe parce qu'un
// championnat national exige 32 joueurs classes et actifs (ECHELONS.national
// .minJoueurs) et que la France en compte 22 : sans complement, le serveur
// repond « pays trop petit » et aucune edition ne s'ouvre.
//
//   node tools/champ-combler.mjs                   apercu : ecrit le SQL, n'execute rien
//   node tools/champ-combler.mjs --reel            ecrit vraiment dans la base de production
//   node tools/champ-combler.mjs --effacer --reel  retire exactement ce qu'il a pose
//
// CE QU'IL POSE, ET CE QUE CELA REND VISIBLE.
//
// Deux lignes par joueur fictif : une dans `duel_players` (c'est elle qui le
// fait compter dans `effectifPays` et dans `classement()`), une dans
// `player_pays` avec `source = 'fictif'` — ce marqueur est ce qui rend le
// retrait exact, aucun joueur reel ne pouvant etre pris dedans.
//
// Consequence a connaitre avant de lancer : ces noms apparaitront dans le
// classement public des duels (`GET /duels`), drapeau compris. Ils n'auront en
// revanche aucune ligne dans `scores`, donc personne ne pourra leur adresser un
// defi — un defi se cible par `target_score_id`, c'est-a-dire par une ligne du
// classement chrono qu'ils n'ont pas. Aucun joueur reel n'attendra donc une
// reponse qui ne viendra jamais.

import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const WORKER = join(RACINE, 'worker');
// La base de PRODUCTION. Le peupleur, lui, vise 'sprinter-leaderboard-test'.
const BASE = 'sprinter-leaderboard';
const MARQUE = 'fictif';

const PAYS = 'FR';
const CONTINENT = 'EU';
// Le 100 m seul : c'est l'epreuve du championnat a ouvrir, et chaque ligne de
// plus serait un faux joueur de plus dans un classement (200 m, 400 m) que
// personne n'a demande de remplir.
const EPREUVES = (process.argv.find(a => a.startsWith('--epreuves='))
  || '--epreuves=100').split('=')[1].split(',').map(s => s.trim()).filter(Boolean);

const reel = process.argv.includes('--reel');
const effacer = process.argv.includes('--effacer');

// LE NIVEAU DE REFERENCE — releve sur la production le 22/09/2026.
//
//   Mickael zeze : palier 0, lp 32, 1 victoire 0 defaite, 7e au 100 m.
//
// C'est un milieu de grille, pas un sommet : le haut du classement est tenu
// par des paliers 6, 2 et 1. Des partants cales ici ne prennent donc le titre
// a personne par construction — mais ils se placent devant les quatorze
// joueurs a 0 point de ligue, et le classement ordonne par palier puis lp
// (ordreClassement) les fera entrer dans les series comme tetes de serie
// moyennes.
const REFERENCE = { palier: 0, lp: 32, mmr: 1215 };

// Dix noms pour passer de 22 a 32. Distincts de ceux deja en base, et
// volontairement ordinaires : un nom trop remarquable ferait une vedette dont
// on se demanderait ensuite pourquoi elle ne joue jamais.
const NOMS = [
  'Karim Belloc', 'Yanis Perret', 'Tom Vasseur', 'Noé Carrère',
  'Mathis Dupré', 'Enzo Rivière', 'Lucas Bréval', 'Nathan Goujon',
  'Ilan Mercadier', 'Théo Sarlat',
];

let graine = 4411;
const hasard = () => (graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const echapper = s => String(s).replace(/'/g, "''");

const maintenant = Date.now();
const lignes = [];
const apercu = [];

if (effacer) {
  lignes.push(`DELETE FROM duel_players WHERE name_key IN (SELECT name_key FROM player_pays WHERE source = '${MARQUE}');`);
  lignes.push(`DELETE FROM player_pays  WHERE source = '${MARQUE}';`);
  console.log(`\n   Retrait de tout ce qui porte source = '${MARQUE}'.`);
} else {
  for (const nom of NOMS) {
    // Le serveur derive la cle du nom (`cleanName(nom).trim().toLowerCase()`).
    // La recopier plutot qu'inventer une cle est ce qui permet au jeu de
    // retrouver le joueur par son nom, la ou tous les ecrans le cherchent.
    const cle = nom.trim().toLowerCase();
    // Autour de la reference, jamais au-dessus du premier palier : l'ecart
    // tient dans les points de ligue, comme chez les vrais joueurs de ce
    // niveau.
    const lp = Math.max(18, Math.min(40, Math.round(REFERENCE.lp + (hasard() - 0.5) * 14)));
    const mmr = Math.round(REFERENCE.mmr + (hasard() - 0.5) * 40);
    const wins = 1 + (hasard() < 0.35 ? 1 : 0);
    const losses = hasard() < 0.5 ? 1 : 0;
    // Actif dans la fenetre des soixante jours (fenetreActiviteJours), sans
    // quoi ni effectifPays ni classement() ne les comptent : trois a vingt
    // jours, pour que la date ne soit pas la meme pour les dix.
    const vu = maintenant - Math.round((3 + hasard() * 17) * 86400000);
    apercu.push({ nom, lp, mmr, wins, losses, jours: Math.round((maintenant - vu) / 86400000) });
    for (const ep of EPREUVES) {
      lignes.push(
        `INSERT OR REPLACE INTO duel_players (name_key, epreuve, name, wins, losses, draws, launched, received, mmr, lp, palier, bouclier, last_delta, updated_at) ` +
        `VALUES ('${echapper(cle)}', '${ep}', '${echapper(nom)}', ${wins}, ${losses}, 0, ${wins + losses}, 0, ${mmr}, ${lp}, ${REFERENCE.palier}, 0, 0, ${vu});`);
    }
    lignes.push(
      `INSERT OR REPLACE INTO player_pays (name_key, pays, continent, source, vu_le) ` +
      `VALUES ('${echapper(cle)}', '${PAYS}', '${CONTINENT}', '${MARQUE}', ${vu});`);
  }
  console.log(`\n   ${NOMS.length} partants ${PAYS} au niveau de reference (palier ${REFERENCE.palier}, ~${REFERENCE.lp} lp)`);
  console.log(`   Epreuve(s) : ${EPREUVES.join(', ')}\n`);
  for (const a of apercu) {
    console.log(`   ${a.nom.padEnd(18)} lp ${String(a.lp).padStart(2)}  mmr ${a.mmr}  ${a.wins}v ${a.losses}d  vu il y a ${a.jours} j`);
  }
}

const fichier = join(mkdtempSync(join(tmpdir(), 'champ-combler-')), 'combler.sql');
writeFileSync(fichier, lignes.join('\n'));
console.log(`\n   SQL : ${fichier}  (${lignes.length} instructions)`);

if (!reel) {
  console.log('\n   APERCU — rien n\'a ete ecrit. Ajouter --reel pour executer');
  console.log(`   sur la base de production « ${BASE} ».\n`);
  process.exit(0);
}

console.log(`\n   Ecriture sur ${BASE} (--remote)...`);
execFileSync('npx', ['wrangler', 'd1', 'execute', BASE, '--remote', '--file', fichier, '-y'],
  { cwd: WORKER, stdio: ['ignore', 'inherit', 'inherit'] });
console.log('\n   Fait. Verifier :');
console.log('   curl -s "https://sprinter-leaderboard.benbezi-sprinter.workers.dev/champ/pays?epreuve=100"\n');
