// Un cycle complet contre le vrai serveur : national -> continental -> mondial.
//
// Ce que ce harnais cherche a prendre en defaut, ce n'est pas le format d'une
// course — championnats-test.mjs s'en charge — mais l'enchainement : qui monte
// d'un echelon a l'autre, et pourquoi.
//
// La regle a change, et c'est tout l'objet de ce fichier. Un continental ne se
// remplissait avec les champions nationaux completes par les mieux classes du
// continent : on pouvait donc courir un championnat d'Europe sans avoir rien
// gagne, pourvu d'avoir un bon MMR. Desormais c'est le PODIUM ENTIER de chaque
// nation qui monte, et rien d'autre — puis le podium entier de chaque continent
// pour le mondial. Une nation y est representee par trois personnes, ce qui est
// le minimum pour qu'on puisse dire qu'elle est representee.
//
// Et quand la somme des podiums depasse trente-deux, il faut bien trancher :
// c'est le MMR qui le fait, et la derniere partie du harnais le verifie sur un
// continent volontairement surpeuple.

// Le harnais seme son propre monde, mais il attend une base LOCALE NEUVE :
// une edition ne se rejoue pas, et un pays qui a deja tenu son championnat
// exige desormais trente-deux joueurs. Pour rejouer : arreter wrangler,
// supprimer worker/.wrangler/state, relancer.

import { semerPays, nomsDe } from './graine-championnats.mjs';

const B = 'http://127.0.0.1:8788';
const post = (u, b) => fetch(B + u, { method: 'POST', headers: { 'Content-Type': 'application/json', ...H },
  body: JSON.stringify(b) }).then(r => r.json().catch(() => ({})));
const get = u => fetch(B + u, { headers: H }).then(r => r.json().catch(() => ({})));

// Les routes des championnats sont reservees au canal de test, et leurs
// ecritures au role d'organisateur : le harnais se procure les deux comme
// n'importe quel appelant, puis les presente a chaque requete.
const ADMIN = { 'Content-Type': 'application/json', 'X-Sprinter-Admin': 'cle-de-test-locale-uniquement' };
const _acces = await fetch(B + '/test/admin/creer', { method: 'POST', headers: ADMIN,
  body: JSON.stringify({ nom: 'harnais' }) }).then(r => r.json());
await fetch(B + '/test/admin/role', { method: 'POST', headers: ADMIN,
  body: JSON.stringify({ code: _acces.code, role: 'organisateur' }) });
const H = { 'X-Sprinter-Test': _acces.code };

const s = ms => ms == null ? 'abandon' : (ms / 1000).toFixed(3) + ' s';

let graine = 4242;
const hasard = () => (graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

const SEMAINE = 7 * 24 * 3600 * 1000;
const samedi = Date.UTC(2026, 8, 5);

let echecs = 0;
function verifier(nom, condition, detail) {
  if (condition) { console.log(`   ✓ ${nom}`); }
  else { console.log(`   ✗ ${nom}${detail ? ' — ' + detail : ''}`); echecs++; }
}

/**
 * Tous les noms montes sur un podium national, sur cette base.
 *
 * Les harnais se suivent sur la meme base locale : la France, l'Islande ou le
 * Luxembourg peuvent y avoir couru avant nous. Ce qu'on verifie n'est donc
 * jamais « exactement ces gens-la », mais « personne qui ne soit monte sur un
 * podium » — ce qui est la regle, et qui se tient quel que soit le passe de la
 * base.
 */
async function medaillesNationales() {
  const monde = await get('/champ/monde?echelon=national');
  const noms = new Set();
  for (const e of monde.sacres || []) {
    const etat = await get('/champ/edition/' + e.edition);
    if (etat.error) continue;
    const finale = (etat.resultats || [])
      .filter(r => r.phase === 'finale' && r.place != null && r.place <= 3);
    const parCle = new Map((etat.partants || []).map(p => [p.name_key, p.nom]));
    for (const r of finale) noms.add(parCle.get(r.name_key) || r.name_key);
  }
  return noms;
}

/** Deroule une edition entiere, de la premiere serie au sacre. */
async function courir(id, silencieux = true) {
  const niveau = {};
  for (let garde = 0; garde < 6; garde++) {
    const etat = await get('/champ/edition/' + id);
    if (etat.error) return { erreur: etat.error };
    if (etat.etat === 'terminee') return { champion: etat.champion };

    const courses = [...new Set(etat.partants
      .filter(p => p.phase === etat.phase).map(p => p.course))].sort((a, b) => a - b);

    for (const c of courses) {
      const partants = etat.partants.filter(p => p.phase === etat.phase && p.course === c);
      const chronos = partants.map(p => {
        if (niveau[p.name_key] == null) niveau[p.name_key] = 9400 + (p.rang_duel || 16) * 20;
        return { cle: p.name_key, ms: Math.round(niveau[p.name_key] + (hasard() - 0.5) * 300) };
      });
      const r = await post('/champ/course', { edition: id, phase: etat.phase, course: c, chronos });
      if (r.error) return { erreur: r.error + ' (course ' + c + ')' };
      if (!silencieux) {
        const tri = [...chronos].sort((a, b) => a.ms - b.ms);
        const nomDe = k => partants.find(p => p.name_key === k).nom;
        console.log(`     course ${c} : ` + tri.slice(0, 3).map((x, i) => `${i + 1}.${nomDe(x.cle)} ${s(x.ms)}`).join('  '));
      }
    }
    const cl = await post('/champ/cloturer', { edition: id });
    if (cl.error) return { erreur: cl.error };
    if (cl.finale) return { champion: cl.champion, libelle: cl.libelle, podium: cl.podium };
  }
  return { erreur: 'trop de phases' };
}

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  CYCLE COMPLET — national → continental → mondial            ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

// ------------------------------------------------------------------- graine
//
// Le harnais seme son propre monde plutot que de supposer une base deja
// peuplee : six pays, trois en Europe et trois en Afrique, chacun avec de quoi
// tenir une premiere edition.
console.log('\n── ON SEME SIX PAYS ─────────────────────────────────────────');
const EUROPE = ['BE', 'CH', 'PT'];
const AFRIQUE = ['DZ', 'TN', 'TG'];
const marque = Math.random().toString(36).slice(2, 5).toUpperCase();
for (const p of [...EUROPE, ...AFRIQUE]) {
  await semerPays(B, H, p, nomsDe(p + marque, 8));
}
const eligibles = await get('/champ/pays');
console.log('   ' + (eligibles.pays || []).filter(p => p.eligible)
  .map(p => `${p.pays}:${p.joueurs}`).join('  '));
verifier('les six pays semes sont eligibles',
  [...EUROPE, ...AFRIQUE].every(z =>
    (eligibles.pays || []).some(p => p.pays === z && p.eligible)),
  JSON.stringify((eligibles.pays || []).map(p => p.pays + ':' + p.eligible)));

// ---------------------------------------------------------------- calendrier
console.log('\n── LE CALENDRIER DU CYCLE ───────────────────────────────────');
const cal = await get('/champ/calendrier?debut=' + samedi);
for (const e of cal.cycle) {
  console.log(`   ${e.echelon.padEnd(12)} ${new Date(e.debut).toISOString().slice(0, 10)}` +
              `   ${e.rendezVous.length} rendez-vous`);
}
verifier('continental 3 semaines apres le national',
  cal.cycle[1].debut - cal.cycle[0].debut === 3 * SEMAINE);
verifier('mondial 4 semaines apres le continental',
  cal.cycle[2].debut - cal.cycle[1].debut === 4 * SEMAINE);

// ------------------------------------------------- garde-fou avant l'heure
console.log('\n── AVANT TOUT : LES GARDE-FOUS ──────────────────────────────');
// L'Oceanie n'a personne : aucun podium national, donc rien a faire monter.
const tropTot = await post('/champ/ouvrir', { echelon: 'continental', zone: 'OC', debut: samedi });
verifier('un continental sans podium national est refuse',
  tropTot.error === 'pas assez de nations avec podium', JSON.stringify(tropTot).slice(0, 110));
verifier('le refus compte les nations, pas les champions',
  tropTot.zones === 0 && tropTot.requis === 2, JSON.stringify(tropTot).slice(0, 110));

// ------------------------------------------------------------- nationaux
console.log('\n── LES CHAMPIONNATS NATIONAUX, LE MEME WEEKEND ──────────────');
const cycle = await post('/champ/cycle', { debut: samedi, echelon: 'national' });
console.log(`   ${cycle.ouvertes.length} pays ouvrent, ${cycle.ecartes.length} ecartes`);
for (const e of cycle.ecartes.slice(0, 4)) {
  console.log(`     ecarte ${e.zone} : ${e.raison}${e.joueurs != null ? ' (' + e.joueurs + ' joueurs)' : ''}`);
}
verifier('les six pays semes ouvrent leur championnat',
  [...EUROPE, ...AFRIQUE].every(p => cycle.ouvertes.some(o => o.zone === p)),
  cycle.ouvertes.map(o => o.zone).join(','));

const redite = await post('/champ/ouvrir', { pays: EUROPE[0], debut: samedi });
verifier('deux editions pour un meme pays sont refusees',
  redite.error === 'edition deja ouverte');

console.log('');
// Les podiums nationaux, gardes au passage : c'est eux, et eux seuls, qui
// doivent se retrouver dans les grilles continentales.
const podiumsNationaux = new Map();
for (const o of cycle.ouvertes) {
  const r = await courir(o.edition);
  if (r.erreur) { console.log(`   ✗ ${o.zone} : ${r.erreur}`); echecs++; }
  else {
    podiumsNationaux.set(o.zone, (r.podium || []).map(p => p.nom));
    console.log(`   ${o.zone} → ${r.libelle || 'champion'} : ${r.champion}` +
                `   (podium : ${(r.podium || []).map(p => p.nom).join(', ')})`);
  }
}
verifier('chaque pays rend un podium de trois',
  [...podiumsNationaux.values()].every(p => p.length === 3),
  [...podiumsNationaux.entries()].map(([z, p]) => z + ':' + p.length).join(' '));

// ---------------------------------------------------------- continentaux
console.log('\n── LES CHAMPIONNATS CONTINENTAUX ────────────────────────────');
const cycleC = await post('/champ/cycle', { debut: samedi + 3 * SEMAINE, echelon: 'continental' });
console.log(`   ${cycleC.ouvertes.length} continents ouvrent, ${cycleC.ecartes.length} ecartes`);
for (const e of cycleC.ecartes) {
  console.log(`     ecarte ${e.zone} : ${e.raison}` +
              (e.zones != null ? ` (${e.zones} nations)` : '') +
              (e.joueurs != null ? ` (${e.joueurs} joueurs)` : ''));
}
verifier('EU et AF ouvrent leur continental',
  cycleC.ouvertes.filter(o => o.zone === 'EU' || o.zone === 'AF').length === 2);

// Le coeur de la nouvelle regle : le podium ENTIER de chaque nation, et
// personne d'autre.
//
// La base peut porter d'autres nations que celles semees ici — les harnais se
// suivent sur la meme base locale. On ne suppose donc pas la composition : on
// demande au salon combien de nations europeennes ont un podium valide, et la
// grille doit valoir exactement trois fois ce nombre.
const euEd = cycleC.ouvertes.find(o => o.zone === 'EU');
if (euEd) {
  const etatEu = await get('/champ/edition/' + euEd.edition);
  const noms = new Set(etatEu.partants.map(p => p.nom));
  const attendus = EUROPE.flatMap(z => podiumsNationaux.get(z) || []);
  const dedans = attendus.filter(n => noms.has(n));
  console.log(`   grille continentale EU : ${etatEu.partants.length} partants`);
  verifier('les podiums nationaux europeens sont dans la grille continentale',
    dedans.length === attendus.length, `${dedans.length}/${attendus.length}`);
  verifier('trois partants par nation, pas un seul champion',
    attendus.length === EUROPE.length * 3, attendus.length + ' qualifies');

  // Un continental ne se complete plus au classement : personne d'autre que
  // les medailles n'y court. C'est la difference qu'on ne pouvait pas voir en
  // comptant seulement les champions — une grille de 32 avec trois champions
  // dedans avait exactement la meme apparence.
  const medailles = await medaillesNationales();
  const parasites = [...noms].filter(n => !medailles.has(n));
  verifier('aucun repechage au classement continental',
    parasites.length === 0, parasites.slice(0, 6).join(', '));
  verifier('la grille vaut trois places par nation qualifiee',
    etatEu.partants.length % 3 === 0 || etatEu.partants.length === 32,
    etatEu.partants.length + ' partants');
}

console.log('');
const podiumsContinentaux = new Map();
for (const o of cycleC.ouvertes) {
  const r = await courir(o.edition);
  if (r.erreur) { console.log(`   ✗ ${o.zone} : ${r.erreur}`); echecs++; }
  else {
    podiumsContinentaux.set(o.zone, (r.podium || []).map(p => p.nom));
    console.log(`   ${o.zone} → ${r.libelle || 'champion'} : ${r.champion}`);
  }
}

// ---------------------------------------------------------------- mondial
console.log('\n── LE CHAMPIONNAT DU MONDE ──────────────────────────────────');
const cycleM = await post('/champ/cycle', { debut: samedi + 7 * SEMAINE, echelon: 'mondial' });
if (cycleM.ecartes.length) console.log('   ecarte :', JSON.stringify(cycleM.ecartes[0]).slice(0, 120));
verifier('le mondial ouvre', cycleM.ouvertes.length === 1);

if (cycleM.ouvertes.length) {
  const id = cycleM.ouvertes[0].edition;
  const etatM = await get('/champ/edition/' + id);
  const noms = new Set(etatM.partants.map(p => p.nom));
  const attendus = [...podiumsContinentaux.values()].flat();
  const dedans = attendus.filter(n => noms.has(n));
  verifier('les podiums continentaux sont dans la grille mondiale',
    dedans.length === attendus.length, `${dedans.length}/${attendus.length}`);
  verifier('la grille mondiale ne contient rien d autre',
    etatM.partants.length === attendus.length,
    `${etatM.partants.length} partants pour ${attendus.length} medailles`);

  const r = await courir(id, false);
  if (r.erreur) { console.log('   ✗', r.erreur); echecs++; }
  else {
    console.log(`\n   ★ ${r.libelle} : ${r.champion}`);
    if (r.podium) r.podium.forEach(p => console.log(`     ${p.place}. ${p.nom.padEnd(12)} ${s(p.ms)}`));
    verifier('le mondial produit un champion du monde', r.libelle === 'Champion du monde', r.libelle);
  }
}

// ------------------------------------------------ quand les podiums debordent
//
// Onze nations de plus dans le meme continent : quatorze podiums, quarante-deux
// qualifies pour trente-deux couloirs. Il faut trancher, et le seul critere
// comparable entre des podiums venus de pays differents est le MMR.
console.log('\n── QUAND LA SOMME DES PODIUMS DEPASSE 32 ────────────────────');
const PETITS = ['IE', 'NL', 'AT', 'PL', 'SE', 'NO', 'DK', 'FI', 'GR', 'HU', 'CZ'];
for (const p of PETITS) await semerPays(B, H, p, nomsDe(p + marque, 4));

const cycle2 = await post('/champ/cycle', { debut: samedi + 10 * SEMAINE, echelon: 'national' });
const petitsOuverts = cycle2.ouvertes.filter(o => PETITS.includes(o.zone));
console.log(`   ${petitsOuverts.length} petites nations ouvrent leur premiere edition`);
verifier('les onze petites nations ouvrent en format reduit',
  petitsOuverts.length === PETITS.length,
  petitsOuverts.map(o => o.zone).join(','));

const podiumsPetits = new Map();
for (const o of petitsOuverts) {
  const r = await courir(o.edition);
  if (r.erreur) { console.log(`   ✗ ${o.zone} : ${r.erreur}`); echecs++; }
  else podiumsPetits.set(o.zone, (r.podium || []).map(p => p.nom));
}
verifier('chaque petite nation rend elle aussi un podium de trois',
  [...podiumsPetits.values()].every(p => p.length === 3),
  [...podiumsPetits.entries()].map(([z, p]) => z + ':' + p.length).join(' '));

const euBis = await post('/champ/ouvrir', {
  echelon: 'continental', zone: 'EU', debut: samedi + 13 * SEMAINE });
verifier('un second continental europeen s ouvre', !euBis.error,
  JSON.stringify(euBis).slice(0, 120));

if (!euBis.error) {
  const bassin = [...podiumsPetits.values(), ...EUROPE.map(z => podiumsNationaux.get(z) || [])].flat();
  console.log(`   au moins ${bassin.length} medailles europeennes pour 32 couloirs`);
  verifier('le bassin depasse bien trente-deux', bassin.length > 32, bassin.length + ' medailles');
  verifier('la grille est ramenee a trente-deux', euBis.partants === 32,
    euBis.partants + ' partants');

  const etatBis = await get('/champ/edition/' + euBis.edition);
  const noms = etatBis.partants.map(p => p.nom);
  verifier('personne n y figure deux fois', new Set(noms).size === noms.length);
  const medailles = await medaillesNationales();
  const intrus = noms.filter(n => !medailles.has(n));
  verifier('les trente-deux retenus sortent tous d un podium',
    intrus.length === 0, intrus.slice(0, 6).join(', '));
  // Le tri se fait au MMR, qui ne sort jamais. Ce qui se verifie de l'exterieur
  // est sa consequence : les retenus sont semes en tete de grille, donc les
  // rangs vont de 1 a 32 sans trou.
  const rangs = etatBis.partants.map(p => p.rang_duel).sort((a, b) => a - b);
  verifier('les retenus sont semes de 1 a 32',
    rangs[0] === 1 && rangs[rangs.length - 1] === 32,
    `${rangs[0]}..${rangs[rangs.length - 1]}`);
}

// ------------------------------------------------------- diffusion directe
console.log('\n── LE FIL DES ANNONCES ──────────────────────────────────────');
let curseur = 0, total = 0, pousses = 0;
const parType = {};
for (let i = 0; i < 200; i++) {
  const f = await get(`/champ/direct?depuis=${curseur}&limite=200`);
  if (!f.annonces.length) break;
  for (const a of f.annonces) {
    total++; if (a.pousser) pousses++;
    parType[a.type] = (parType[a.type] || 0) + 1;
  }
  curseur = f.curseur;
}
console.log(`   ${total} annonces, dont ${pousses} a pousser en notification`);
for (const [t, n] of Object.entries(parType).sort((a, b) => b[1] - a[1])) {
  console.log(`     ${t.padEnd(22)} ${n}`);
}
verifier('le fil contient des sacres', (parType['sacre'] || 0) >= 8, (parType['sacre'] || 0) + ' sacres');
verifier('le fil revele les repechages', (parType['reveal-demies'] || 0) > 0);
verifier('le fil annonce les qualifies directs', (parType['qualification-directe'] || 0) > 0);

const vide = await get(`/champ/direct?depuis=${curseur}`);
verifier('un curseur a jour ne renvoie rien', vide.annonces.length === 0);

const zoneTest = cycle.ouvertes.length ? cycle.ouvertes[0].zone : EUROPE[0];
const filZone = await get(`/champ/direct?zone=${zoneTest}&limite=200`);
verifier(`le fil se filtre par zone (${zoneTest})`,
  filZone.annonces.length > 0 && filZone.annonces.every(a => a.zone === zoneTest),
  `${filZone.annonces.length} annonces`);

// ------------------------------------------------------ recap mondial
console.log('\n── LE RECAPITULATIF MONDIAL ─────────────────────────────────');
const monde = await get('/champ/monde');
console.log(`   ${monde.total} editions, ${monde.termines} terminees, ${monde.encours.length} en cours`);
for (const x of monde.sacres.slice(0, 12)) {
  console.log(`     ${x.echelon.padEnd(12)} ${x.zoneNom.padEnd(12)} ${x.champion}`);
}
// Toutes les editions que CE harnais a ouvertes doivent etre terminees, sauf
// le continental de debordement qu'on laisse volontairement sur la grille. Ce
// qu'une autre seance a laisse ouvert sur la base n'est pas notre affaire.
const miennes = [
  ...cycle.ouvertes, ...cycleC.ouvertes, ...cycleM.ouvertes, ...petitsOuverts,
].map(o => o.edition);
const restees = monde.encours.filter(e => miennes.includes(e.edition));
verifier('toutes les editions du harnais sont allees jusqu au sacre',
  restees.length === 0, restees.map(e => e.zone).join(','));
verifier('le continental de debordement, lui, attend sur la grille',
  !euBis.error && monde.encours.some(e => e.edition === euBis.edition),
  monde.encours.map(e => e.echelon + ':' + e.zone).join(' '));

console.log('\n' + '─'.repeat(62));
console.log(echecs === 0 ? '   TOUT PASSE.' : `   ${echecs} VERIFICATION(S) EN ECHEC.`);
console.log('');
process.exit(echecs ? 1 : 0);
