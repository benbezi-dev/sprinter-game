// L'Objectif du jour, simule sur les VRAIS joueurs.
//
// « Je veux voir ces chiffres avant l'activation. » Les voici, et ils viennent
// de la base de production, pas d'un modele : pour chaque joueur qui recevrait
// un objectif, on calcule sa cible exactement comme le cron le ferait, puis on
// regarde ses courses passees pour compter combien d'entre elles l'auraient
// atteinte. C'est ce comptage qui donne le taux de reussite par tentative — et
// donc le nombre de courses qu'il faut en moyenne pour valider, qui est le
// chiffre que tout le systeme cherche a placer autour de trois.
//
// LECTURE SEULE. Le script n'ecrit rien, nulle part.
//
//   node tools/objectif-simulation.mjs            # la production
//   node tools/objectif-simulation.mjs --local    # la base locale
//
// Ce qu'il ne peut pas dire : ce que feront les joueurs. Un taux calcule sur
// les courses passees suppose que le joueur continue de courir comme avant.
// Il court peut-etre mieux quand on lui donne une cible — c'est meme le pari
// du systeme — et le chiffre reel sera donc un peu meilleur que celui-ci.

import { execFileSync } from 'node:child_process';
import {
  calibrer, seuilsDe, palierDe, FENETRE, COURSES_MIN, EPREUVE, TOP_N,
} from '../worker/src/objectif.js';
import { PLUS_BAS } from '../worker/src/epreuves.js';

const local = process.argv.includes('--local');
const s2 = ms => (ms / 1000).toFixed(2);

function interroger(sql) {
  const args = ['wrangler', 'd1', 'execute', 'sprinter-leaderboard',
                local ? '--local' : '--remote', '--json', '--command', sql];
  const brut = execFileSync('npx', args, { cwd: 'worker', maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(brut.toString())[0].results;
}

console.log(`\n  Objectif du jour — simulation sur ${local ? 'la base locale' : 'LA PRODUCTION'}`);
console.log(`  epreuve ${EPREUVE} m, fenetre de ${FENETRE} courses, seuil de calibrage ${COURSES_MIN}\n`);

// Les memes filtres que `joueursAServir` : classe, actif, et pas « Anonyme ».
const depuis = Date.now() - 30 * 86400000;
const joueurs = interroger(
  `SELECT lower(trim(s.name)) AS k, MIN(s.best_split_ms) AS pb
     FROM scores s
     LEFT JOIN (SELECT name_key, MAX(created_at) AS vu FROM races GROUP BY name_key) r
            ON r.name_key = lower(trim(s.name))
    WHERE s.race_key = '${EPREUVE}' AND s.best_split_ms > 0
      AND lower(trim(s.name)) <> 'anonyme'
    GROUP BY lower(trim(s.name))
   HAVING COALESCE(r.vu, MAX(s.updated_at)) >= ${depuis}
    ORDER BY pb ASC LIMIT ${TOP_N}`);

const courses = interroger(
  `SELECT k, time_ms FROM (
     SELECT lower(trim(name)) AS k, time_ms,
            ROW_NUMBER() OVER (PARTITION BY lower(trim(name))
                               ORDER BY created_at DESC) AS rn
       FROM races WHERE race_key = '${EPREUVE}'
   ) WHERE rn <= ${FENETRE}`);

const parJoueur = new Map();
for (const c of courses) {
  if (!parJoueur.has(c.k)) parJoueur.set(c.k, []);
  parJoueur.get(c.k).push(c.time_ms);
}

/* ------------------------------------------------------------- le calcul */

const lignes = [];
for (const j of joueurs) {
  const mes = parJoueur.get(j.k) || [];
  const c = calibrer(j.pb, mes, { direction: PLUS_BAS, pas: 10 });
  const seuils = seuilsDe(j.pb, c.cibleMs, PLUS_BAS);

  // Le taux de reussite mesure sur SES courses : combien d'entre elles
  // auraient atteint chaque palier.
  const vues = mes.slice(0, FENETRE);
  const compte = p => vues.filter(t => palierDe(t, seuils, PLUS_BAS) === p
                                    || (p === 'argent' && palierDe(t, seuils, PLUS_BAS) === 'or')).length;
  const argentOuMieux = vues.filter(t => t <= seuils.argent).length;
  const bronzeOuMieux = vues.filter(t => t <= seuils.bronze).length;
  const orTouche = vues.filter(t => t <= seuils.or).length;

  lignes.push({
    joueur: j.k, pb: j.pb, cible: c.cibleMs, marge: c.marge,
    methode: c.methode, n: vues.length,
    bronze: vues.length ? bronzeOuMieux / vues.length : null,
    argent: vues.length ? argentOuMieux / vues.length : null,
    or: vues.length ? orTouche / vues.length : null,
    essais: argentOuMieux ? vues.length / argentOuMieux : null,
    void: compte,
  });
}

/* -------------------------------------------------------------- l'affichage */

const quantile = (tab, p) => {
  if (!tab.length) return NaN;
  const t = [...tab].sort((a, b) => a - b);
  const i = (t.length - 1) * p;
  const b = Math.floor(i), h = Math.ceil(i);
  return b === h ? t[b] : t[b] + (t[h] - t[b]) * (i - b);
};

const bloc = (titre, valeurs, format) => {
  if (!valeurs.length) { console.log(`  ${titre} : aucune donnee`); return; }
  const f = format || (v => v.toFixed(2));
  console.log(`  ${titre}`);
  console.log(`    min ${f(Math.min(...valeurs))}   q1 ${f(quantile(valeurs, 0.25))}` +
              `   mediane ${f(quantile(valeurs, 0.5))}` +
              `   q3 ${f(quantile(valeurs, 0.75))}   max ${f(Math.max(...valeurs))}`);
};

const calibres = lignes.filter(l => l.methode === 'quantile');
const replis = lignes.filter(l => l.methode === 'repli');

console.log(`  ${lignes.length} joueurs seraient servis`);
console.log(`    ${calibres.length} calibres sur leur historique, ${replis.length} au repli`);

// LE RECORD PERIME FAUSSE TOUT LE RESTE, et il faut le dire avant les chiffres.
//
// La cible se calcule sur `scores.best_split_ms`. Quand l'historique contient
// mieux — ce qui arrivait a un joueur sur cinq avant que `/race` ne tienne le
// record a jour — la cible est calculee sur un record que le joueur a deja
// battu, et le taux de reussite qu'on lit plus bas n'est pas celui qu'il aura.
const perimes = lignes.filter(l => {
  const mes = parJoueur.get(l.joueur) || [];
  return mes.length && Math.min(...mes) < l.pb;
});
if (perimes.length) {
  console.log(`\n  !  ${perimes.length} joueur(s) ont dans leur historique une course PLUS`);
  console.log(`     RAPIDE que leur record enregistre. Leur cible est calculee sur un`);
  console.log(`     record faux, et ces lignes-la ne veulent rien dire tant que`);
  console.log(`     POST /records/recalculer n'a pas ete passe.`);
  for (const l of perimes.slice(0, 5)) {
    const vrai = Math.min(...(parJoueur.get(l.joueur) || []));
    console.log(`       ${l.joueur.slice(0, 18).padEnd(18)} record ${s2(l.pb)} s, ` +
                `mais ${s2(vrai)} s dans l'historique`);
  }
  if (perimes.length > 5) console.log(`       ...et ${perimes.length - 5} autre(s)`);
}
console.log();

bloc('CIBLE (s)', lignes.map(l => l.cible / 1000));
bloc('ECART AU RECORD (%)', lignes.map(l => l.marge * 100), v => v.toFixed(2) + ' %');
console.log();

const avecTaux = lignes.filter(l => l.argent !== null && l.n >= COURSES_MIN);
bloc('REUSSITE PAR TENTATIVE — ARGENT (%)',
     avecTaux.map(l => l.argent * 100), v => v.toFixed(1) + ' %');
bloc('REUSSITE PAR TENTATIVE — BRONZE (%)',
     avecTaux.map(l => l.bronze * 100), v => v.toFixed(1) + ' %');
bloc('REUSSITE PAR TENTATIVE — OR (%)',
     avecTaux.map(l => l.or * 100), v => v.toFixed(1) + ' %');
console.log();

const essais = avecTaux.filter(l => l.essais !== null).map(l => l.essais);
bloc('COURSES POUR VALIDER L ARGENT', essais, v => v.toFixed(1));

const jamais = avecTaux.filter(l => l.argent === 0).length;
const duPremier = avecTaux.filter(l => l.argent >= 0.5).length;
console.log();
console.log(`  LE KPI : au moins trois courses par defi.`);
if (essais.length) {
  const moy = essais.reduce((a, b) => a + b, 0) / essais.length;
  console.log(`    moyenne des courses necessaires : ${moy.toFixed(2)}`);
  console.log(`    mediane : ${quantile(essais, 0.5).toFixed(2)}`);
}
console.log(`    ${jamais} joueur(s) n'ont JAMAIS realise leur cible sur ${FENETRE} courses`);
console.log(`    ${duPremier} joueur(s) la realisent plus d'une fois sur deux`);
console.log(`      (les premiers decrochent, les seconds s'ennuient — les deux`);
console.log(`       bouts de la distribution sont ce qu'il faut surveiller)`);

const bronzeAcquis = avecTaux.filter(l => l.bronze >= 0.9).length;
console.log();
console.log(`  L ACCROCHE : ${bronzeAcquis} joueur(s) sur ${avecTaux.length} decrochent le`);
console.log(`    bronze plus de neuf fois sur dix — c'est ce qu'on attend de lui.`);

console.log(`\n  Les dix plus serres et les dix plus larges :`);
const tri = [...lignes].sort((a, b) => a.marge - b.marge);
for (const l of [...tri.slice(0, 5), null, ...tri.slice(-5)]) {
  if (!l) { console.log('    ...'); continue; }
  console.log(`    ${l.joueur.slice(0, 16).padEnd(16)} record ${s2(l.pb)} → cible ${s2(l.cible)}` +
              `  (${(l.marge * 100).toFixed(2)} %)  ${l.n} courses` +
              (l.argent !== null ? `  reussite ${(l.argent * 100).toFixed(0)} %` : '  (repli)'));
}
console.log();
