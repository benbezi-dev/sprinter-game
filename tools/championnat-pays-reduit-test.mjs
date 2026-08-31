// La premiere edition d'un petit pays, en format reduit.
//
// Ce que ce harnais cherche a prendre en defaut tient en une phrase : un pays
// de dix joueurs doit pouvoir tenir un vrai championnat une fois, et une seule.
//
// Trois proprietes, et elles ne se verifient qu'ici :
//
//   1. la structure survit a l'effectif. Series, repechage revele apres la
//      derniere serie, demies, finale : un championnat a dix ne doit pas se
//      transformer en une course unique deguisee en finale ;
//   2. la deuxieme edition exige les trente-deux. L'ouverture reduite est une
//      naissance, pas un regime permanent — sinon le titre national d'un petit
//      pays se distribuerait tous les trois mois dans un vivier qui ne grandit
//      jamais ;
//   3. sous quatre joueurs, rien ne s'ouvre. Une « serie » de deux serait la
//      finale, et la competition ne raconterait plus rien.

// Le harnais seme son propre monde, mais il attend une base LOCALE NEUVE :
// une edition ne se rejoue pas, et un pays qui a deja tenu son championnat
// exige desormais trente-deux joueurs. Pour rejouer : arreter wrangler,
// supprimer worker/.wrangler/state, relancer.

import { semerPays, nomsDe } from './graine-championnats.mjs';

const B = 'http://127.0.0.1:8788';
const ADMIN = { 'Content-Type': 'application/json', 'X-Sprinter-Admin': 'cle-de-test-locale-uniquement' };

// Le harnais se procure un acces, puis le role d'organisateur : ouvrir une
// edition est un acte de calendrier, et le serveur le refuse a un simple code
// d'invitation. C'est exactement ce que verifie acces-test.mjs.
const _acces = await fetch(B + '/test/admin/creer', { method: 'POST', headers: ADMIN,
  body: JSON.stringify({ nom: 'harnais-reduit' }) }).then(r => r.json());
await fetch(B + '/test/admin/role', { method: 'POST', headers: ADMIN,
  body: JSON.stringify({ code: _acces.code, role: 'organisateur' }) });
const H = { 'X-Sprinter-Test': _acces.code };

const post = (u, b) => fetch(B + u, { method: 'POST', headers: { 'Content-Type': 'application/json', ...H },
  body: JSON.stringify(b) }).then(r => r.json().catch(() => ({})));
const get = u => fetch(B + u, { headers: H }).then(r => r.json().catch(() => ({})));

const s = ms => ms == null ? 'abandon' : (ms / 1000).toFixed(3) + ' s';
let graine = 777;
const hasard = () => (graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

let echecs = 0;
const verifier = (nom, cond, detail) => {
  console.log(`   ${cond ? '✓' : '✗'} ${nom}${cond || !detail ? '' : ' — ' + detail}`);
  if (!cond) echecs++;
};

/** Deroule une edition entiere, de la premiere serie au sacre. */
async function courir(id) {
  const niveau = {};
  const phases = [];
  for (let garde = 0; garde < 6; garde++) {
    const etat = await get('/champ/edition/' + id);
    if (etat.error) return { erreur: etat.error };
    if (etat.etat === 'terminee') return { champion: etat.champion, phases };

    const courses = [...new Set(etat.partants
      .filter(p => p.phase === etat.phase).map(p => p.course))].sort((a, b) => a - b);
    phases.push({
      cle: etat.phase, nom: etat.phaseNom, courses: courses.length,
      parCourse: etat.parCourse, directs: etat.directsParCourse, repechages: etat.repechages,
      engages: etat.partants.filter(p => p.phase === etat.phase).length,
    });

    for (const c of courses) {
      const partants = etat.partants.filter(p => p.phase === etat.phase && p.course === c);
      const chronos = partants.map(p => {
        if (niveau[p.name_key] == null) niveau[p.name_key] = 9400 + (p.rang_duel || 8) * 25;
        return { cle: p.name_key, ms: Math.round(niveau[p.name_key] + (hasard() - 0.5) * 200) };
      });
      const r = await post('/champ/course', { edition: id, phase: etat.phase, course: c, chronos });
      if (r.error) return { erreur: r.error + ' (course ' + c + ')' };
    }
    const cl = await post('/champ/cloturer', { edition: id });
    if (cl.error) return { erreur: cl.error };
    if (cl.finale) return { champion: cl.champion, libelle: cl.libelle, podium: cl.podium, classement: cl.classement, phases };
  }
  return { erreur: 'trop de phases' };
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  UN PETIT PAYS, SA PREMIERE EDITION                          ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

// Deux pays fictifs, sans aucune edition anterieure. On prend des codes qui
// existent dans la table des continents, sans quoi le continental ne saurait
// pas ou les ranger — ici ce sont l'Islande et Malte, deux pays reels dont le
// jeu n'a pas de raison d'avoir des joueurs.
const PETIT = 'IS';        // ~10 joueurs : format reduit
const MINUSCULE = 'MT';    // 2 joueurs : rien ne s'ouvre
const samedi = Date.UTC(2026, 8, 5);

console.log('\n── ON SEME ──────────────────────────────────────────────────');
const dixJoueurs = nomsDe('Isl', 10);
await semerPays(B, H, PETIT, dixJoueurs);
await semerPays(B, H, MINUSCULE, nomsDe('Mlt', 2));
const pays = await get('/champ/pays');
const ligneIS = (pays.pays || []).find(p => p.pays === PETIT);
const ligneMT = (pays.pays || []).find(p => p.pays === MINUSCULE);
console.log(`   ${PETIT} : ${ligneIS ? ligneIS.joueurs : 0} joueurs · ` +
            `${MINUSCULE} : ${ligneMT ? ligneMT.joueurs : 0} joueurs`);
verifier('le petit pays est eligible malgre ses dix joueurs',
  !!ligneIS && ligneIS.eligible === true, JSON.stringify(ligneIS));
verifier('il est annonce comme premiere edition en format reduit',
  !!ligneIS && ligneIS.reduit === true && ligneIS.premiere === true, JSON.stringify(ligneIS));
verifier('le pays de deux joueurs n est pas eligible',
  !!ligneMT && ligneMT.eligible === false, JSON.stringify(ligneMT));

console.log('\n── LE SALON LE DIT AVANT DE L OUVRIR ────────────────────────');
const salon = await get('/champ/salon');
const prevIS = (salon.nations || []).find(p => p.zone === PETIT);
console.log(`   ${PETIT} : ${prevIS ? prevIS.partants : '?'} partants, ` +
            `${prevIS ? prevIS.courses : '?'} serie(s), ouvrable : ${prevIS && prevIS.ouvrable}`);
verifier('le salon annonce le format reduit avant l ouverture',
  !!prevIS && prevIS.ouvrable === true && prevIS.reduit === true);
verifier('le salon ne cache pas les pays trop petits',
  (salon.nations || []).some(p => p.zone === MINUSCULE && p.ouvrable === false));

console.log('\n── SOUS QUATRE JOUEURS, RIEN NE S OUVRE ─────────────────────');
const refusMT = await post('/champ/ouvrir', { pays: MINUSCULE, debut: samedi });
verifier('un pays de deux joueurs est refuse',
  refusMT.error === 'pays trop petit', JSON.stringify(refusMT).slice(0, 100));
verifier('le refus dit le plancher de la premiere edition',
  refusMT.requis === 4, 'requis = ' + refusMT.requis);

console.log('\n── L OUVERTURE EN FORMAT REDUIT ─────────────────────────────');
const ouv = await post('/champ/ouvrir', { pays: PETIT, debut: samedi });
verifier('l edition s ouvre', !ouv.error, JSON.stringify(ouv).slice(0, 120));
if (ouv.error) { console.log('\n   IMPOSSIBLE DE CONTINUER.'); process.exit(1); }

console.log(`   edition ${ouv.edition} — ${ouv.partants} partants`);
for (const c of ouv.grille) {
  console.log(`     serie ${c.course} : ` + c.joueurs.map(j => `${j.nom}(${j.rang})`).join(', '));
}
verifier('les dix joueurs sont dans la grille', ouv.partants === 10, ouv.partants + ' partants');
verifier('l ouverture se declare reduite', ouv.reduit === true);
verifier('le format fige compte trois phases', (ouv.format?.phases || []).length === 3,
  JSON.stringify(ouv.format?.phases?.map(p => p.cle)));
verifier('la finale ne depasse pas huit couloirs',
  ouv.format.phases[2].parCourse <= 8, 'finale a ' + ouv.format.phases[2].parCourse);
verifier('le podium reste a trois', ouv.format.phases[2].podium === 3);

const creneaux = (ouv.calendrier || []).filter(r => r.phase === 'series' && r.course);
verifier('le calendrier ne montre que les series qui existent',
  creneaux.length === ouv.format.phases[0].courses,
  `${creneaux.length} creneaux pour ${ouv.format.phases[0].courses} series`);

console.log('\n── ON COURT JUSQU AU SACRE ──────────────────────────────────');
const r = await courir(ouv.edition);
if (r.erreur) { console.log('   ✗ ' + r.erreur); echecs++; }
else {
  for (const p of r.phases) {
    console.log(`   ${p.nom.padEnd(13)} ${p.engages} engages · ${p.courses} course(s) de ${p.parCourse}` +
                ` · ${p.directs} direct(s) + ${p.repechages} repeche(s)`);
  }
  console.log(`\n   ★ ${r.libelle} : ${r.champion}`);
  if (r.podium) r.podium.forEach(p => console.log(`     ${p.place}. ${p.nom.padEnd(10)} ${s(p.ms)}`));

  verifier('la competition garde ses trois phases', r.phases.length === 3,
    r.phases.map(p => p.cle).join(' → '));
  verifier('un champion est sacre', !!r.champion);
  verifier('le podium compte trois places', (r.podium || []).length === 3,
    (r.podium || []).length + ' places');
  verifier('la finale n a pas plus de huit partants',
    (r.classement || []).length <= 8, (r.classement || []).length + ' finalistes');
  verifier('le titre porte le nom du pays',
    typeof r.libelle === 'string' && r.libelle.startsWith('Champion'), r.libelle);
}

console.log('\n── LA DEUXIEME EDITION EXIGE LES TRENTE-DEUX ────────────────');
const seconde = await post('/champ/ouvrir', { pays: PETIT, debut: samedi + 7 * 24 * 3600 * 1000 });
verifier('une seconde edition sous 32 joueurs est refusee',
  seconde.error === 'pays trop petit', JSON.stringify(seconde).slice(0, 110));
verifier('le refus exige desormais trente-deux joueurs',
  seconde.requis === 32, 'requis = ' + seconde.requis);

const paysApres = await get('/champ/pays');
const ligneApres = (paysApres.pays || []).find(p => p.pays === PETIT);
verifier('le pays n est plus annonce comme ouvrable',
  !!ligneApres && ligneApres.eligible === false, JSON.stringify(ligneApres));
verifier('il n est plus une premiere edition',
  !!ligneApres && ligneApres.premiere === false);

console.log('\n' + '─'.repeat(62));
console.log(echecs === 0 ? '   TOUT PASSE.' : `   ${echecs} VERIFICATION(S) EN ECHEC.`);
console.log('');
process.exit(echecs ? 1 : 0);
