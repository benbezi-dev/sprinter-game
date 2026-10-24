// LA CARRIERE D'ATHLETE — les regles et le recit, sans navigateur.
//
// Ce qui compte et qui pourrait casser sans qu'on le voie :
//   1. une seance rend selon sa qualite, et moins quand la qualite est haute ;
//   2. les reglages de course restent pres de 1 (la frequence des appuis
//      doit garder la main) ;
//   3. la famille modeste paie ses deplacements, l'aisee non ;
//   4. le podium qualifie, le reste retente le meme niveau ;
//   5. l'histoire ne boucle pas (refuser les coachs ne les rappelle qu'apres
//      la course suivante).
//
//   node tools/athlete-test.mjs

import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const dir = mkdtempSync(join(tmpdir(), 'athlete-'));
const entree = join(dir, 'entree.ts');
writeFileSync(entree, `export * from '${join(process.cwd(), 'src/game/athlete/regles.ts')}';
export * from '${join(process.cwd(), 'src/game/athlete/recit.ts')}';`);
const sortie = join(dir, 'athlete.mjs');
await build({ entryPoints: [entree], bundle: true, format: 'esm', platform: 'node', outfile: sortie, logLevel: 'silent' });
const R = await import(sortie);

const toujours = v => () => v;

titre('les seances');
{
  const a = R.nouvelAthlete('T', 'aisee', 'polyvalent', null);
  a.evenement = null;
  const bon = R.gainDeSeance(a, 'lundi', 1).vitesse;
  const rate = R.gainDeSeance(a, 'lundi', 0).vitesse;
  ok('une bonne seance rend plus qu\'une ratee', bon > rate, `${bon} / ${rate}`);
  ok('une seance ratee rend quand meme', rate > 0);
  const haut = R.nouvelAthlete('T', 'aisee', 'polyvalent', null); haut.stats.vitesse = 90;
  ok('plus la qualite est haute, moins on y gagne', R.gainDeSeance(haut, 'lundi', 1).vitesse < bon);
  const r = R.faireLaSeance(a, 'lundi', 1, toujours(0.99));
  ok('la seance s\'applique', r && a.stats.vitesse > 28 && a.faites.includes('lundi'));
  ok('pas deux fois la meme seance', R.faireLaSeance(a, 'lundi', 1, toujours(0.99)) === null);
  a.fatigue = 90;
  const b = R.faireLaSeance(a, 'mercredi', 1, toujours(0));
  ok('s\'entrainer epuise blesse', b && b.blessure && a.blessure === 2);
  ok('blesse : plus de seance', R.seancePossible(a, 'vendredi') === 'blesse');
  R.finirLaSemaine(a); R.finirLaSemaine(a);
  ok('deux semaines plus tard, gueri', a.blessure === 0);
  const s = R.nouvelAthlete('T', 'aisee', 'specialiste', '100');
  ok('le specialiste gagne plus sur sa qualite cle',
     R.gainDeSeance(s, 'lundi', 1).vitesse > R.gainDeSeance(R.nouvelAthlete('T', 'aisee', 'polyvalent', null), 'lundi', 1).vitesse);
}

titre('la course');
{
  const a = R.nouvelAthlete('T', 'aisee', 'polyvalent', null);
  for (const k of R.STATS) a.stats[k] = 0;
  a.materiel = [];
  const bas = R.reglages(a, 0);
  for (const k of R.STATS) a.stats[k] = 100;
  a.materiel = ['pointes3', 'tenue', 'starting'];
  const haut = R.reglages(a, 0);
  ok('vitesse entre 0,94 et 1,07', bas.vitesse >= 0.94 && haut.vitesse <= 1.07, `${bas.vitesse} → ${haut.vitesse}`);
  ok('la poussee monte avec la force', haut.boost > bas.boost);
  ok('l\'endurance freine moins', haut.drag < bas.drag);
  ok('la technique fait moins tomber', haut.chute < bas.chute);
  a.fatigue = 100;
  ok('la fatigue coute de la vitesse', R.reglages(a, 0).vitesse < haut.vitesse);
}

titre('l\'argent');
{
  const riche = R.nouvelAthlete('T', 'aisee', 'polyvalent', null);
  const pauvre = R.nouvelAthlete('T', 'modeste', 'polyvalent', null);
  ok('l\'aisee ne paie pas ses deplacements', R.coutDuDeplacement(riche, 2) === 0);
  ok('la modeste paie le sien', R.coutDuDeplacement(pauvre, 2) === 150);
  pauvre.club = 'quartier';
  ok('le club en prend la moitie', R.coutDuDeplacement(pauvre, 2) === 75);
  ok('un boulot rapporte', R.prendreUnBoulot(pauvre, 'marche') && pauvre.argent === 80);
  ok('un seul par semaine', !R.prendreUnBoulot(pauvre, 'livraison'));
  ok('le marche prend le samedi', R.seancePossible(pauvre, 'samedi') === 'boulot');
  ok('pas les pointes carbone sans les autres', R.achatPossible(riche, 'pointes3') === 'avant');
  ok('les pointes montent en gamme', R.acheter(riche, 'pointes2') && !riche.materiel.includes('pointes1'));
  ok('l\'argent de poche tombe', (() => { const m = riche.argent; R.finirLaSemaine(riche); return riche.argent === m + 30; })());
}

titre('les competitions');
{
  const a = R.nouvelAthlete('T', 'aisee', 'polyvalent', null);
  a.semaine = 4;
  ok('semaine 4 : jour de competition', R.jourDeCompetition(a));
  const r = R.conclureLaCompetition(a, '100', 2, 12.3);
  ok('le podium qualifie', r.qualifie && a.niveau === 1);
  ok('prochaine dans 4 semaines', a.prochaine === 8);
  const r2 = R.conclureLaCompetition(a, '100', 5, 12.9);
  ok('hors podium : meme niveau', !r2.qualifie && a.niveau === 1);
  const f = R.conclureLaCompetition(a, '100', 1, null);
  ok('un faux depart ne qualifie pas', !f.qualifie && a.niveau === 1);
  a.niveau = 4;
  ok('premier aux mondiaux : le sommet', R.conclureLaCompetition(a, '100', 1, 9.9).sommet);
}

titre('l\'histoire');
{
  const a = R.nouvelAthlete('T', 'modeste', 'polyvalent', null);
  ok('elle commence par le prof d\'EPS', a.evenement === 'intro');
  R.repondre(a, 0);
  ok('puis plus rien avant la premiere course', a.evenement === null);
  a.semaine = 4; R.conclureLaCompetition(a, '100', 6, 13.4);
  ok('apres la course, les coachs', R.tournant(a) === 'approche');
  a.evenement = 'approche';
  ok('Horizon trop cher pour la modeste', !R.repondre(a, 0));
  R.repondre(a, 2);
  ok('refuser ne rappelle pas les coachs tout de suite', a.evenement === null && R.tournant(a) === null);
  a.semaine = 8; R.conclureLaCompetition(a, '100', 6, 13.2);
  ok('ils reviennent apres la course suivante', R.tournant(a) === 'approche');
  a.evenement = 'approche';
  const avant = a.argent;
  R.repondre(a, 1);
  ok('le club de quartier, licence offerte', a.club === 'quartier' && a.argent === avant);
  ok('le programme suit', a.evenement === 'programme');
  R.repondre(a, 2);
  ok('objectif : les mondiaux', a.objectif === 'monde');
  let n = 0;
  for (let i = 0; i < 200; i++) if (R.tirerLaSemaine(a, Math.random)) n++;
  ok('la vie du club arrive une semaine sur deux environ', n > 70 && n < 150, `${n}/200`);
  ok('chaque evenement a au moins un choix', R.EVENEMENTS.every(x => x.choix.length > 0));
}

console.log(e ? `\n${e} echec(s)\n` : '\nTout passe.\n');
process.exit(e ? 1 : 0);
