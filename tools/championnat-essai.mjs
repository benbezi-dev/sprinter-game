/* ---------------------------------------------------------------------------
   OUVRIR UN CHAMPIONNAT D'ESSAI, TOUT DE SUITE
   ---------------------------------------------------------------------------
   Le salon ouvre les editions pour le samedi suivant : c'est la regle du sport,
   et elle est bonne. Elle est en revanche insupportable quand on veut
   simplement VOIR le systeme tourner — personne ne teste une fonctionnalite en
   attendant quatre jours.

   Ce script fait donc la seule chose que le salon ne sait pas faire : choisir
   la date. Il calcule le « samedi » de facon que la premiere serie tombe dans
   quelques minutes, ouvre l'edition, et affiche ce qu'il faut pour la suivre —
   les partants, les codes de salon de chaque course, et les rendez-vous.

   Il ne contourne aucune regle : le role d'organisateur est exige comme
   ailleurs, un pays trop petit reste refuse, et l'edition ouverte est une vraie
   edition qui consommera la premiere ouverture du pays. C'est pour cela que
   `--semer` existe : on essaie sur un pays de test avant de toucher a la France.

   USAGE
     node tools/championnat-essai.mjs [options]

   OPTIONS
     --pays FR         le pays a ouvrir (defaut : FR)
     --dans 3          minutes avant la premiere serie (defaut : 3)
     --code ABC123     le code d'acces au canal de test a utiliser
     --semer 8         cree d'abord N joueurs fictifs dans ce pays
     --local           parle au wrangler local (http://127.0.0.1:8788)

   ENVIRONNEMENT
     SPRINTER_URL      l'adresse du worker (defaut : celle de production)
     SPRINTER_CODE     le code d'acces, si l'on prefere ne pas l'ecrire en clair
     ADMIN_CLE         la cle d'administration ; si elle est posee, le script
                       donne lui-meme le role d'organisateur au code.
--------------------------------------------------------------------------- */

import { semerPays, nomsDe } from './graine-championnats.mjs';

const PROD = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';

function option(nom, defaut = null) {
  const i = process.argv.indexOf('--' + nom);
  if (i === -1) return defaut;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const B = option('local') ? 'http://127.0.0.1:8788' : (process.env.SPRINTER_URL || PROD);
const PAYS = String(option('pays', 'FR')).toUpperCase();
const DANS = Math.max(1, parseInt(option('dans', '3'), 10) || 3);
const CODE = option('code') || process.env.SPRINTER_CODE || '';
const SEMER = parseInt(option('semer', '0'), 10) || 0;
const ADMIN = process.env.ADMIN_CLE || '';

if (!CODE) {
  console.log('\n   Il manque le code d acces au canal de test.');
  console.log('   node tools/championnat-essai.mjs --code TONCODE [--pays FR] [--dans 3]\n');
  process.exit(1);
}

const H = { 'Content-Type': 'application/json', 'X-Sprinter-Test': CODE };
const post = (u, b) => fetch(B + u, { method: 'POST', headers: H, body: JSON.stringify(b) })
  .then(async r => ({ statut: r.status, ...(await r.json().catch(() => ({}))) }));
const get = u => fetch(B + u, { headers: H })
  .then(async r => ({ statut: r.status, ...(await r.json().catch(() => ({}))) }));

const heure = t => new Date(t).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  CHAMPIONNAT D ESSAI                                         ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log(`\n   serveur : ${B}`);
console.log(`   pays    : ${PAYS}`);

// --- le role d'organisateur, si l'on tient la cle --------------------------
if (ADMIN) {
  const r = await fetch(B + '/test/admin/role', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Sprinter-Admin': ADMIN },
    body: JSON.stringify({ code: CODE, role: 'organisateur' }),
  }).then(x => x.json().catch(() => ({})));
  console.log(`   role    : ${r.ok ? 'organisateur accorde a ' + CODE : 'REFUSE — ' + (r.error || '?')}`);
} else {
  console.log('   role    : ADMIN_CLE absente — le code doit deja etre organisateur');
}

// --- des joueurs, si on en demande ----------------------------------------
if (SEMER > 0) {
  const marque = Math.random().toString(36).slice(2, 5).toUpperCase();
  const noms = nomsDe(PAYS + marque, SEMER);
  console.log(`\n── ON SEME ${SEMER} JOUEURS FICTIFS ───────────────────────────`);
  console.log('   ' + noms.join(', '));
  await semerPays(B, H, PAYS, noms);
}

// --- ce que la zone donnerait ---------------------------------------------
const salon = await get('/champ/salon');
if (salon.statut === 403) {
  console.log('\n   REFUSE : ce code n a pas le role d organisateur.');
  console.log('   Pose ADMIN_CLE dans l environnement et relance, ou :');
  console.log(`   curl -X POST ${B}/test/admin/role -H 'Content-Type: application/json' \\`);
  console.log(`        -H "X-Sprinter-Admin: $ADMIN_CLE" -d '{"code":"${CODE}","role":"organisateur"}'\n`);
  process.exit(1);
}
const prevu = (salon.nations || []).find(n => n.zone === PAYS);
if (prevu) {
  console.log(`\n   ${prevu.zoneNom} : ${prevu.joueurs} joueur(s) classe(s) et actif(s)` +
              (prevu.reduit ? ' — 1re edition, format reduit' : '') +
              (prevu.ouvrable ? '' : `  ✗ ${prevu.raison || 'non ouvrable'} (requis : ${prevu.requis})`));
}

// --- l'ouverture, calee sur maintenant ------------------------------------
//
// Le calendrier place la premiere serie a 9 h UTC du samedi : on choisit donc
// le « samedi » pour que ce creneau tombe dans `DANS` minutes.
const premiereCourse = Date.now() + DANS * 60 * 1000;
const debut = premiereCourse - 9 * 3600 * 1000;

const ouv = await post('/champ/ouvrir', { pays: PAYS, debut });
if (ouv.error) {
  console.log(`\n   OUVERTURE REFUSEE : ${ouv.error}`);
  if (ouv.requis) console.log(`   il faut ${ouv.requis} joueurs, il y en a ${ouv.joueurs}.`);
  if (ouv.edition) console.log(`   edition deja ouverte : ${ouv.edition}`);
  console.log('   (essaie --semer 8, ou --pays sur un pays de test)\n');
  process.exit(1);
}

console.log('\n── OUVERTE ──────────────────────────────────────────────────');
console.log(`   edition  : ${ouv.edition}`);
console.log(`   partants : ${ouv.partants}${ouv.reduit ? ' (format reduit)' : ''}`);
console.log(`   format   : ` + ouv.format.phases
  .map(p => `${p.nom} ${p.courses}×${p.parCourse}`).join(' → '));

console.log('\n── LA GRILLE ET LES SALONS ──────────────────────────────────');
for (const c of ouv.grille) {
  // Meme calcul que le serveur et que le jeu : lettre de phase, numero de
  // course, identifiant d'edition.
  const code = ('S' + c.course + ouv.edition).slice(0, 10);
  console.log(`   serie ${c.course}  salon ${code}`);
  console.log('     ' + c.joueurs.map(j => j.nom).join(', '));
}

console.log('\n── LES RENDEZ-VOUS ──────────────────────────────────────────');
for (const r of ouv.calendrier) {
  console.log(`   ${heure(r.at).padEnd(18)} ${r.cle}`);
}

console.log('\n── CE QU IL RESTE A FAIRE ───────────────────────────────────');
console.log(`   1. chaque partant ouvre le jeu de test, onglet DEFI : son`);
console.log(`      championnat s affiche, et « REJOINDRE MA COURSE » apparait`);
console.log(`      ${DANS} minute(s) avant sa serie.`);
console.log('   2. tout le monde se declare pret : la salle donne le depart et');
console.log('      ecrit les chronos au championnat toute seule.');
console.log('   3. dans le salon, « cloturer la phase » quand les series sont');
console.log('      courues. Un absent bloque : « saisir un chrono », champ vide');
console.log('      pour un abandon.');
console.log('   4. recommencer pour les demies, puis la finale : sa cloture');
console.log('      sacre le champion. Le rendez-vous des demies est au');
console.log('      lendemain — pour tout derouler d une traite, chaque partant');
console.log('      passe par « entrer dans le salon avant l heure », sous la');
console.log('      ligne de sa course.');
console.log('\n   A savoir : il faut entrer par l ecran du championnat, pas par un');
console.log('   lien ?direct= — une salle ouverte hors championnat ne sait pas ou');
console.log('   ecrire son resultat.\n');
