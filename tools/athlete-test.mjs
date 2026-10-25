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
export * from '${join(process.cwd(), 'src/game/athlete/recit.ts')}';
export * from '${join(process.cwd(), 'src/game/athlete/gens.ts')}';`);
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
  const p = R.nouvelAthlete('T', 'aisee', 'polyvalent', null); p.evenement = null; p.stats.vitesse = 35.5;
  R.faireLaSeance(p, 'lundi', 1, toujours(0.99));
  ok('pas au-dela du plafond du niveau', p.stats.vitesse === R.COMPETITIONS[0].plafond);
  p.niveau = 1; p.faites = [];
  R.faireLaSeance(p, 'lundi', 1, toujours(0.99));
  ok('le niveau du dessus rouvre la progression', p.stats.vitesse > R.COMPETITIONS[0].plafond);
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
  ok('l\'aisee ne paie pas ses deplacements', R.coutDuDeplacement(riche, 3) === 0);
  ok('la modeste paie le sien', R.coutDuDeplacement(pauvre, 3) === 150);
  pauvre.club = 'quartier';
  ok('le club en prend la moitie', R.coutDuDeplacement(pauvre, 3) === 75);
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
  ok('aux departementaux, la suivante dans 2 semaines', a.prochaine === 6);
  const dep = R.COMPETITIONS[1].chronos['100'], reg = [11.2, 12.5];
  ok('les departementaux entre scolaire et regionaux', dep[0] > reg[0] && dep[1] < 15 && dep[1] > reg[1]);
  const r2 = R.conclureLaCompetition(a, '100', 5, 12.9);
  ok('hors podium : meme niveau', !r2.qualifie && a.niveau === 1);
  const f = R.conclureLaCompetition(a, '100', 1, null);
  ok('un faux depart ne qualifie pas', !f.qualifie && a.niveau === 1);
  a.niveau = 3; R.conclureLaCompetition(a, '100', 1, 10.2);
  ok('au national, 4 semaines de preparation', a.prochaine === a.semaine + 4);
  a.niveau = 5;
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

titre('les exercices, le kine, le parc');
{
  const a = R.nouvelAthlete('T', 'modeste', 'polyvalent', null);
  ok('seul : les cotes se font a la cote', R.exerciceDuJour(a, 'mercredi') === 'cotes' && R.lieuDeLExercice(a, 'cotes') === 'cote');
  ok('seul : le reste au parc', R.lieuDeLExercice(a, R.exerciceDuJour(a, 'lundi')) === 'parc');
  a.club = 'quartier'; a.coach = 'dede';
  const vus = new Set(); for (let s = 0; s < 6; s++) { a.semaine = s; for (const j of R.JOURS) vus.add(R.exerciceDuJour(a, j)); }
  ok('avec un coach, au moins huit exercices differents', vus.size >= 8, [...vus].join(','));
  ok('la muscu a la salle du club', R.lieuDeLExercice(a, 'muscu') === 'club_quartier');
  ok('les departs au stade', R.lieuDeLExercice(a, 'departs') === 'stade');
  a.argent = 100; a.fatigue = 60; a.blessure = 2;
  ok('le kine : la moitie payee par le club', R.chezLeKine(a) === null && a.argent === 80);
  ok('il soulage et fait guerir plus vite', a.fatigue === 35 && a.blessure === 1);
  ok('une fois par semaine', R.chezLeKine(a) === 'fait');
  a.blessure = 0;
  ok('le footing au parc repose', R.footingAuParc(a) && a.fatigue === 23 && !R.footingAuParc(a));
  R.finirLaSemaine(a);
  ok('la semaine suivante, on peut y retourner', !a.kine && !a.footing);
}

titre('la journee, comme les Sims');
{
  const a = R.nouvelAthlete('T', 'aisee', 'polyvalent', null);
  ok('on se reveille un lundi a 7 h', a.jour === 0 && a.heure === 420);
  const f0 = a.besoins.faim;
  R.avancer(a, 60);
  ok('une heure passe : la faim baisse', a.besoins.faim < f0 && a.heure === 480);
  ok('a 8 h, on peut aller en cours', R.actionPossible(a, 'cours') === null);
  const ev = R.avancer(a, 61);
  ok('9 h passe sans cours : absence notee', ev.includes('absence') && a.ecole < 60);
  const b = R.nouvelAthlete('T', 'aisee', 'polyvalent', null); b.heure = 8 * 60;
  R.faireUneAction(b, 'cours');
  ok('les cours menent a 16 h 30', b.heure === 990 && b.cours && b.ecole > 60);
  ok('pas deux fois les cours', R.actionPossible(b, 'cours') === 'fait');
  ok('lundi 16 h 30 : la seance du lundi est ouverte', R.seanceMaintenant(b, 'lundi') === null);
  ok('mais pas celle du mercredi', R.seanceMaintenant(b, 'mercredi') === 'pas_ce_jour');
  b.heure = 22 * 60; b.besoins.energie = 20;
  R.faireUneAction(b, 'dormir');
  ok('dormir : mardi 7 h, l\'energie remontee', b.jour === 1 && b.heure === 420 && b.besoins.energie > 90);
  const c = R.nouvelAthlete('T', 'aisee', 'polyvalent', null); c.evenement = null;
  c.jour = 6; c.heure = 22 * 60; c.semaine = c.prochaine;
  const s0 = c.semaine;
  R.faireUneAction(c, 'dormir');
  ok('dormir le dimanche soir tourne la semaine', c.semaine === s0 + 1 && c.jour === 0);
  ok('une competition manquee devient un forfait', c.journal.some(l => /Forfait/.test(l.fr)));
  const d = R.nouvelAthlete('T', 'aisee', 'polyvalent', null);
  const plein = R.gainDeSeance(d, 'lundi', 1).vitesse;
  d.besoins.energie = 5; d.besoins.faim = 5;
  ok('a jeun et sans sommeil, la seance rend moins', R.gainDeSeance(d, 'lundi', 1).vitesse < plein);
  ok('la pizza coute', (() => { const e = R.nouvelAthlete('T', 'modeste', 'polyvalent', null); e.argent = 5; return R.actionPossible(e, 'pizza') === 'argent'; })());
}

titre('les gens');
{
  const a = R.nouvelAthlete('T', 'aisee', 'polyvalent', null);
  a.heure = 9 * 60;
  ok('lundi 9 h : le prof et Ines au college', R.ouEst(a, 'prof') === 'college' && R.ouEst(a, 'amie') === 'college');
  ok('sans club : pas de coach', R.ouEst(a, 'coach') === null);
  a.heure = 17 * 60 + 30;
  ok('lundi 17 h 30 : Ines au parc, Yanis au stade', R.ouEst(a, 'amie') === 'parc' && R.ouEst(a, 'rival') === 'stade');
  a.heure = 20 * 60;
  ok('le soir, les parents a la maison', R.ouEst(a, 'maman') === 'maison' && R.ouEst(a, 'papa') === 'maison');
  a.club = 'horizon'; a.coach = 'mireille'; a.heure = 18 * 60;
  ok('au club Horizon, le coach a la salle du club', R.ouEst(a, 'coach') === 'club_horizon');
  const v0 = R.lienDe(a, 'amie');
  const r = R.interagir(a, 'amie', 'discuter', () => 0.5);
  ok('discuter avec Ines : une replique, la relation monte', r.replique && R.lienDe(a, 'amie') > v0);
  ok('le temps passe', a.heure === 18 * 60 + 15);
  a.argent = 10;
  ok('la pizza demande 24 euros', !!R.interagir(a, 'amie', 'pizza').refus);
  ok('pas de chambrage avec sa mere', !!R.interagir(a, 'maman', 'chambrer').refus);
  R.interagir(a, 'coach', 'conseil', () => 0);
  const b = R.bonusDeSeance(a);
  ok('le conseil du coach : un bonus pour la seance suivante, une fois', b > 0.05 && R.bonusDeSeance(a) < b);
  const plein = R.gainDeSeance(a, 'lundi', 1), bonifie = R.gainDeSeance(a, 'lundi', 1, 0.1);
  ok('le bonus fait gagner plus', bonifie.vitesse > plein.vitesse);
  a.argent = 0; const avant = R.lienDe(a, 'papa');
  R.interagir(a, 'papa', 'argent', () => 0);
  ok('famille aisee : papa donne 25 euros, une fois par semaine', a.argent === 25 && !!R.interagir(a, 'papa', 'argent').refus);
  const loin = R.lienDe(a, 'prof');
  a.vus_semaine = [];
  R.laSemainePasse(a);
  ok('une semaine sans se voir : la relation retombe', R.lienDe(a, 'prof') === loin - 2 && !a.argentParents);
  ok('chaque personne a de quoi faire', R.PERSONNES.every(p => R.interactionsAvec(p).length >= 2));
  ok('l\'etiquette suit la relation', R.etiquette(90)[0] === 'Inséparables' && R.etiquette(-60)[0] === 'En froid');
}

titre('le calage sur le direct, a partir de la France');
{
  const a = R.nouvelAthlete('T', 'aisee', 'polyvalent', null);
  a.semaine = 20; a.prochaine = 10;
  const rdv = { id: 'ED1', debut: 1_000_000 };
  a.niveau = 2;
  ok('aux regionaux, les semaines de jeu', R.jourCale(a, rdv, 0).jour && R.jourCale(a, rdv, 0).date === null);
  a.niveau = 3;
  ok('France annoncee : pas avant sa date reelle', !R.jourCale(a, rdv, 999_999).jour && R.jourCale(a, rdv, 0).date === 1_000_000);
  ok('France le jour venu : on court', R.jourCale(a, rdv, 1_000_000).jour);
  ok('sans championnat annonce : les semaines de jeu', R.jourCale(a, null, 0).jour);
  a.rendezVous = 'ED1';
  ok('un vrai championnat ne se court qu\'une fois', R.jourCale(a, rdv, 2_000_000).date === null);
}

titre('le plafond : un dixieme au plus');
{
  // L'auteur, 25/10 : jamais plus d'un dixieme sur qui ne joue pas a ce mode.
  // Le pire cas — 110 partout, materiel complet, pic de forme — contre le
  // coureur neutre, a la cadence de chacun, sur les trois epreuves.
  await import('../src/game/sprinter-core.js');
  const { RACES, Track, Runner } = globalThis.SprinterCore;
  const chrono = (cle, f, rj) => {
    const race = RACES[cle], track = new Track(race);
    const p = new Runner('TOI', 3, { isPlayer: true, maxSpeed: race.maxSpeed, best: race.best, total: track.total });
    if (rj) { p.maxSpeed *= rj.vitesse; p.coefBoost = rj.boost; p.coefDrag = rj.drag; p.coefChute = rj.chute; }
    const dt = 1 / 120; let t = 0, prochain = 0.18, cote = 0;
    while (!p.finished && t < 90) {
      while (t >= prochain) { p.press(cote ? 'R' : 'L', prochain); cote ^= 1; prochain += 1 / f; }
      p.stepPlayer(dt, t); t += dt;
    }
    return p.finishTime ?? t;
  };
  const a = R.nouvelAthlete('T', 'aisee', 'specialiste', '100');
  for (const k of R.STATS) a.stats[k] = 110;
  a.materiel = ['pointes3', 'tenue', 'starting'];
  a.objectif = 'monde'; a.assiduite = { proposees: 12, faites: 12 };
  const rj = R.reglages(a, R.NIVEAU_OBJECTIF.monde);
  let pire = 0, ou = '';
  for (const cle of ['100', '200', '400']) for (let f = 5; f <= 16; f += 0.5) {
    const g = chrono(cle, f, null) - chrono(cle, f, rj);
    if (g > pire) { pire = g; ou = `${cle} m a ${f}/s`; }
  }
  ok('le meilleur athlete gagne au plus 0,10 s', pire <= 0.1, `${pire.toFixed(3)} s (${ou})`);
  console.log(`      (pire cas : ${pire.toFixed(3)} s, ${ou})`);
  for (const k of R.STATS) a.stats[k] = 25;
  a.materiel = []; a.objectif = null;
  ok('le debutant perd franchement', chrono('100', 8, null) - chrono('100', 8, R.reglages(a, 0)) < -0.3);
}

console.log(e ? `\n${e} echec(s)\n` : '\nTout passe.\n');
process.exit(e ? 1 : 0);
