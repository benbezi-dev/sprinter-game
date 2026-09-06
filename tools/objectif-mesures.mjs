// Les sept chiffres de l'Objectif du jour, lus sur le serveur.
//
// Le KPI est le premier et c'est le seul qui decide : « au moins trois courses
// par defi ». Les six autres servent a comprendre pourquoi il n'est pas
// atteint, le jour ou il ne le sera pas.
//
//   ADMIN_CLE=... node tools/objectif-mesures.mjs
//   ADMIN_CLE=... node tools/objectif-mesures.mjs --local --jours 7
//
// Lecture seule.

const local = process.argv.includes('--local');
const iJours = process.argv.indexOf('--jours');
const jours = iJours > 0 ? Number(process.argv[iJours + 1]) || 30 : 30;
const B = local ? 'http://127.0.0.1:8788'
                : 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';
const CLE = process.env.ADMIN_CLE || 'cle-de-test-locale-uniquement';

const r = await fetch(`${B}/objectif/mesures?jours=${jours}`,
                      { headers: { 'X-Sprinter-Admin': CLE } });
if (!r.ok) {
  console.error(`\n  ${B} repond ${r.status}.` +
    (r.status === 403 ? ' La cle d administration est-elle la bonne ?' : ''));
  console.error('  ADMIN_CLE=... node tools/objectif-mesures.mjs\n');
  process.exit(1);
}
const m = await r.json();

const pct = v => v === null || v === undefined ? '—' : `${v} %`;
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 56 - t.length))}`);

console.log(`\n  Objectif du jour — ${local ? 'base locale' : 'PRODUCTION'}, ${m.jours} derniers jours`);

const k = m.kpi_courses_par_defi;
titre('LE KPI : AU MOINS TROIS COURSES PAR DEFI');
if (!k.defis_joues) {
  console.log('   aucun defi joue sur la periode — rien a mesurer encore.');
} else {
  console.log(`   ${k.defis_joues} defis joues, ${k.courses} courses`);
  console.log(`   moyenne ${k.moyenne} courses par defi`);
  console.log(`   ${k.au_moins_trois} defis a trois courses ou plus (${pct(k.part_au_moins_trois)})`);
  console.log(`   ${k.une_seule} defis n'ont eu qu'une seule course`);
  // La lecture, pas seulement le chiffre : c'est ce qu'on regarde en premier
  // et c'est ce qu'on oublie d'ecrire.
  if (k.moyenne !== null) {
    console.log(`   → ${k.moyenne >= 3 ? 'la cible est tenue.'
      : 'SOUS LA CIBLE. La cible est peut-etre trop facile (on valide et on part)'}`);
    if (k.moyenne < 3) {
      console.log('     ou trop dure (on rate et on abandonne) — les paliers ci-dessous');
      console.log('     disent lequel des deux.');
    }
  }
}

const p = m.participation;
titre('PARTICIPATION');
console.log(`   ${p.joues} defis joues sur ${p.servis} servis (${pct(p.taux)})`);

titre('CE QUE LES JOUEURS DECROCHENT');
if (!m.paliers.length) console.log('   rien encore.');
for (const l of m.paliers) {
  console.log(`   ${String(l.palier).padEnd(8)} ${String(l.n).padStart(5)}   ${pct(l.part)}`);
}

const v = m.revanche;
titre('LA REVANCHE APRES UN ECHEC');
console.log(`   ${v.relances} relances sur ${v.apres_echec} defis ou la premiere n'a pas suffi` +
            `   (${pct(v.taux)})`);
console.log('   (approximation : on garde le nombre de tentatives, pas leur detail)');

titre('RETENTION');
for (const l of m.retention) {
  console.log(`   ${l.jour}   ${l.revenus} revenus sur ${l.cohorte}   ${pct(l.taux)}`);
}

const d = m.desabonnements;
titre('DESABONNEMENTS');
console.log(`   ${d.coupes} ont coupe les notifications`);
console.log(`   ${d.ralentis_par_choix} ont choisi une par jour`);
console.log('   (la seconde est une negociation, la premiere une porte qui se ferme)');
console.log();
