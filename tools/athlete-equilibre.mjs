// LA CARRIERE D'ATHLETE — banc d'equilibre, sans navigateur.
//
// Deux questions qu'aucun test de regle ne tranche :
//   1. a quelle allure les stats montent-elles selon la qualite des seances ;
//   2. ce que ces stats changent a la course, face au plateau de chaque niveau,
//      pour un joueur qui tape a cadence donnee (alternance parfaite).
//
//   node tools/athlete-equilibre.mjs

import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import '../src/game/sprinter-core.js';

const { RACES, Track, Runner } = globalThis.SprinterCore;

const dir = mkdtempSync(join(tmpdir(), 'athlete-eq-'));
const entree = join(dir, 'entree.ts');
writeFileSync(entree, `export * from '${join(process.cwd(), 'src/game/athlete/regles.ts')}';`);
const sortie = join(dir, 'regles.mjs');
await build({ entryPoints: [entree], bundle: true, format: 'esm', platform: 'node', outfile: sortie, logLevel: 'silent' });
const R = await import(sortie);

/** Le chrono du joueur a `f` appuis par seconde, avec ces reglages. */
export function chrono(cle, f, rj) {
  const race = RACES[cle];
  const track = new Track(race);
  const p = new Runner('TOI', 3, { isPlayer: true, maxSpeed: race.maxSpeed, best: race.best, total: track.total });
  if (rj) { p.maxSpeed *= rj.vitesse; p.coefBoost = rj.boost; p.coefDrag = rj.drag; p.coefChute = rj.chute; }
  const dt = 1 / 120;
  let t = 0, prochain = 0.18, cote = 0;
  while (!p.finished && t < 90) {
    while (t >= prochain) { p.press(cote ? 'R' : 'L', prochain); cote ^= 1; prochain += 1 / f; }
    p.stepPlayer(dt, t);
    t += dt;
  }
  return p.finishTime ?? t;
}

/** Une carriere ou chaque seance vaut `score`, quatre seances par semaine. */
function carriere(score, semaines) {
  const a = R.nouvelAthlete('T', 'modeste', 'polyvalent', null);
  a.evenement = null;
  const releves = [];
  for (let s = 1; s <= semaines; s++) {
    if (s === 5) { a.club = 'quartier'; a.coach = 'dede'; }
    for (const j of ['lundi', 'mercredi', 'vendredi', 'samedi']) {
      if (j === 'samedi' && a.fatigue >= 60) continue;   // on ne se blesse pas expres
      R.faireLaSeance(a, j, score, () => 0.99);
    }
    if (s % 4 === 0) releves.push({ s, stats: { ...a.stats } });
    R.finirLaSemaine(a);
  }
  return releves;
}

const fmt = v => v.toFixed(2).padStart(6);
console.log('\n── stats sans jamais monter de niveau (semaines 4, 8 … 24) — le plafond du scolaire ──');
for (const sc of [0.3, 0.6, 0.9]) {
  const r = carriere(sc, 24);
  console.log(`score ${sc}: ` + r.map(x => `S${x.s} ${Math.round((x.stats.vitesse + x.stats.force + x.stats.technique + x.stats.endurance) / 4)}`).join('  '));
}

const athlete = moy => { const a = R.nouvelAthlete('T', 'modeste', 'polyvalent', null); for (const k of R.STATS) a.stats[k] = moy; a.materiel = []; return a; };
for (const cle of ['100', '200', '400']) {
  console.log(`\n── ${cle} m : chrono selon cadence et stats (plateaux : ${RACES[cle].ranges.slice(0, 5).map(r => r.join('-')).join(' | ')}) ──`);
  console.log('cadence   neutre   stats25  stats50  stats80');
  for (const f of [6, 7, 8, 9, 10, 12]) {
    const l = [chrono(cle, f, null), ...[25, 50, 80].map(m => chrono(cle, f, R.reglages(athlete(m), 0)))];
    console.log(`${String(f).padStart(4)}/s  ${l.map(fmt).join('   ')}`);
  }
}

// L'ECHELLE : la cadence qu'il faut pour le podium a chaque marche, avec les
// stats qu'on a en y arrivant (podium a chaque fois, seances a 0,6). Le podium
// se lit comme le troisieme des sept adversaires tires dans le plateau.
console.log('\n── 100 m : cadence pour le podium, marche apres marche (seances a 0,6) ──');
{
  const a = R.nouvelAthlete('T', 'modeste', 'polyvalent', null);
  a.evenement = null;
  for (let s = 1, niv = 0; niv < R.COMPETITIONS.length && s < 60; s++) {
    if (s === 5) { a.club = 'quartier'; a.coach = 'dede'; }
    for (const j of ['lundi', 'mercredi', 'vendredi', 'samedi']) {
      if (j === 'samedi' && a.fatigue >= 60) continue;
      R.faireLaSeance(a, j, 0.6, () => 0.99);
    }
    if (R.jourDeCompetition(a)) {
      const c = R.COMPETITIONS[niv];
      const [lo, hi] = (c.chronos && c.chronos['100']) || RACES['100'].ranges[c.plateau];
      const podium = lo + (hi - lo) * 3 / 8;
      const rj = R.reglages(a, niv);
      let f = 5; while (f < 16 && chrono('100', f, rj) > podium) f += 0.25;
      const moy = Math.round((a.stats.vitesse + a.stats.force + a.stats.technique + a.stats.endurance) / 4);
      console.log(`S${String(s).padStart(2)}  ${c.cle.padEnd(15)} stats ${moy}  podium < ${podium.toFixed(2)} s  →  ${f.toFixed(2)} appuis/s`);
      R.conclureLaCompetition(a, '100', 1, podium); niv++;
    }
    R.finirLaSemaine(a);
  }
}
