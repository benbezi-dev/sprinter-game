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
export * from '${join(process.cwd(), 'src/game/athlete/gens.ts')}';
export * from '${join(process.cwd(), 'src/game/athlete/telephone.ts')}';
export * from '${join(process.cwd(), 'src/game/athlete/sante.ts')}';
export * from '${join(process.cwd(), 'src/game/athlete/guide.ts')}';`);
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
  a.fatigue = 96;
  const b = R.faireLaSeance(a, 'mercredi', 1, toujours(0));
  ok('s\'entrainer epuise : le surmenage', b && b.blessure && b.type === 'surmenage' && a.blessure >= 1 && a.blessureType === 'surmenage');
  ok('blesse : plus de seance', R.seancePossible(a, 'vendredi') === 'blesse');
  R.finirLaSemaine(a); R.finirLaSemaine(a);
  ok('deux semaines plus tard, gueri', a.blessure === 0 && a.blessureType === null);
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

titre('l\'age et les etapes de vie');
{
  const jeune = R.nouvelAthlete('T', 'modeste', 'polyvalent', null, undefined, 13);
  ok('13 ans : college, scolaire, l\'histoire du prof', R.etape(jeune) === 'college' && jeune.niveau === 0 && jeune.evenement === 'intro');
  const lyc = R.nouvelAthlete('T', 'modeste', 'polyvalent', null, undefined, 16); lyc.heure = 8 * 60;
  ok('16 ans : le lycee, pas le college', R.etape(lyc) === 'lycee' && R.actionPossible(lyc, 'cours') === 'etape' && R.actionPossible(lyc, 'cours_lycee') === null);
  const ad = R.nouvelAthlete('T', 'modeste', 'polyvalent', null, undefined, 26); ad.heure = 8 * 60;
  ok('26 ans : vie active, pas de lycee, departementaux d\'entree', R.etape(ad) === 'adulte' && R.actionPossible(ad, 'cours_lycee') === 'etape' && ad.niveau === 1 && ad.evenement === null);
  const m0 = ad.argent;
  R.faireUneAction(ad, 'travail');
  ok('une journee de travail : 17 h, salaire verse', ad.heure === 17 * 60 && ad.argent === m0 + R.SALAIRE);
  const m1 = ad.argent; R.finirLaSemaine(ad);
  ok('le loyer tombe en fin de semaine', ad.argent === m1 - R.LOYER);
  ok('le releve de compte garde la trace', ad.compte[0].fr === 'Loyer' && ad.compte[1].fr === 'Salaire');
  ok('categories d\'age', R.categorie(13)[0] === 'Benjamin' && R.categorie(15)[0] === 'Minime' && R.categorie(26)[0] === 'Senior' && R.categorie(36)[0] === 'Master');
  ok('adulte : Ines au travail, le patron aussi', (() => { ad.jour = 1; ad.heure = 10 * 60; return R.ouEst(ad, 'amie') === 'travail' && R.ouEst(ad, 'prof') === 'travail' && R.roleDe(ad, 'prof')[0] === 'Ton patron'; })());
  ok('adulte : les parents chez eux', (() => { ad.heure = 20 * 60; return R.ouEst(ad, 'maman') === 'parents'; })());
  const r = R.conclureLaCompetition(R.nouvelAthlete('T', 'aisee', 'polyvalent', null), '100', 1, 12.34);
  ok('un premier chrono est un record personnel', r.record);
}

titre('le telephone');
{
  const a = R.nouvelAthlete('T', 'modeste', 'polyvalent', null);
  a.club = 'quartier'; a.coach = 'dede'; a.jour = 6; a.heure = 22 * 60; a.evenement = null;
  R.faireUneAction(a, 'dormir'); R.messagesDuReveil(a, () => 0.99);
  ok('lundi matin avec un club : le coach rappelle la seance', a.messages.some(m => m.de === 'coach' && /Ce soir 18 h/.test(m.fr)));
  ok('les messages arrivent non lus', R.nonLus(a) > 0);
  R.toutLire(a);
  ok('et se lisent', R.nonLus(a) === 0);
  const c = R.classement(a, '100');
  ok('un classement de quarante, sans record : dernier', c.total === 40 && c.moi.temps === null && c.moi.rang === 40);
  a.records = { '100': 9.0 };
  ok('avec un record imbattable : premier', R.classement(a, '100').moi.rang === 1);
  ok('le classement est toujours le meme', R.classement(a, '200').lignes[3].nom === R.classement(a, '200').lignes[3].nom);
  a.heure = 23 * 60;
  ok('pas de bus la nuit', !!R.trajet(a, 'bus', 1000).refus);
  ok('pas de velo sans velo', !!R.trajet(a, 'velo', 1000).refus);
  a.heure = 10 * 60; a.velo = true;
  ok('le velo va trois fois plus vite qu\'a pied', R.trajet(a, 'velo', 1500).minutes * 3 <= R.trajet(a, 'pied', 1500).minutes + 6);
  const m0 = a.argent; R.voyager(a, 'bus', 1500);
  ok('le bus coute un ticket et du temps', a.argent === m0 - R.TICKET && a.heure > 10 * 60);
  const sem = R.agenda(a);
  ok('l\'agenda : sept jours, cours en semaine, seance le lundi', sem.length === 7 && sem[0].some(r => r.quoi[0] === 'Cours') && sem[0].length === 2);
  const ad = R.nouvelAthlete('T', 'modeste', 'polyvalent', null, undefined, 25);
  ok('adulte : le travail a l\'agenda', R.agenda(ad)[1].some(r => r.quoi[0] === 'Travail'));
  const r = R.conclureLaCompetition(a, '100', 2, 11.5);
  R.messagesDeCourse(a, r);
  ok('apres un podium : papa et le coach ecrivent', a.messages.some(m => m.de === 'papa') && a.messages.some(m => m.de === 'coach' && /11\.50/.test(m.fr)));
}

titre('le corps : des consequences, pas du hasard');
{
  // la meme semaine jouee deux fois donne exactement le meme corps
  const jouer = () => {
    const a = R.nouvelAthlete('T', 'aisee', 'specialiste', '100'); a.club = 'quartier'; a.coach = 'dede'; a.evenement = null;
    const vu = [];
    for (let k = 0; k < 6; k++) { a.faites = []; a.fatigue = 75; const r = R.faireLaSeance(a, 'lundi', 1, Math.random); vu.push(r && (r.blessure ? 'B' : r.gene ? 'G' : '.')); }
    return { vu: vu.join(''), usure: JSON.stringify(a.usure), blessure: a.blessure };
  };
  const x = jouer(), y = jouer();
  ok('sans hasard : deux fois la meme histoire', x.vu === y.vu && x.usure === y.usure && x.blessure === y.blessure, `${x.vu} / ${y.vu}`);
  ok('des departs fatigues a repetition : une gene, puis la blessure', /G.*B/.test(x.vu), x.vu);
  const a = R.nouvelAthlete('T', 'aisee', 'polyvalent', null); a.age = 20;
  const sans = R.usurePrevue(a, 'course').ischio; a.echauffe = true;
  const avec = R.usurePrevue(a, 'course').ischio;
  ok('courir sans echauffement use bien plus les ischios', sans >= avec + 10, `${sans} / ${avec}`);
  const f = R.nouvelAthlete('T', 'aisee', 'polyvalent', null); f.age = 20;
  const frais = R.usurePrevue(f, 'cotes').achille; f.fatigue = 90; f.besoins.energie = 20;
  ok('fatigue et vide : la meme seance use plus', R.usurePrevue(f, 'cotes').achille > frais * 1.8);
  const n = R.nouvelAthlete('T', 'aisee', 'polyvalent', null); n.usure = { ischio: 70, periostite: 0, achille: 0, cheville: 0 }; R.majGene(n);
  ok('a 70 sur les ischios : la gene', n.gene === 'ischio');
  n.heure = 22 * 60; R.faireUneAction(n, 'dormir');
  ok('une bonne nuit fait redescendre', n.usure.ischio < 70);
  n.argent = 100; R.chezLeKine(n);
  ok('le kine traite la zone la plus usee : plus de gene', n.usure.ischio < 50 && n.gene === null);
  const g = R.nouvelAthlete('T', 'aisee', 'polyvalent', null); g.usure = { ischio: 101, periostite: 0, achille: 0, cheville: 0 };
  R.tirerLeCorps(g, 'gainage');
  ok('pousse au-dela de 100 : grade 3, la plus longue absence', g.blessureType === 'ischio' && g.blessureGrade === 3 && g.blessure === 7);
}

titre('l\'espace sante');
{
  const a = R.nouvelAthlete('T', 'modeste', 'polyvalent', null, undefined, 20); a.argent = 500;
  a.usure = { ischio: 93, periostite: 0, achille: 0, cheville: 0 };
  R.tirerLeCorps(a, 'gainage');
  ok('blesse : grade 2 des ischios', a.blessureType === 'ischio' && a.blessureGrade === 2 && a.blessure === 4);
  ok('sans diagnostic, on ne connait que la douleur', R.etatDeSante(a).titre[0].startsWith('Douleur'));
  ok('pas d\'IRM sans prescription', !!R.soinPossible(a, 'irm'));
  const m0 = a.argent; R.soigner(a, 'medecin');
  ok('le medecin nomme la blessure, prescrit l\'IRM, et c\'est paye en partie', a.diagnostic && R.soinPossible(a, 'irm') === null && a.argent === m0 - R.resteACharge(a, 'medecin'));
  ok('il delivre aussi le certificat de la saison', !R.certificatRequis(a));
  R.soigner(a, 'irm');
  ok('l\'IRM lit le grade, la reeducation adaptee fait gagner une semaine', a.diagnostic.grade === 2 && a.blessure === 3);
  const p = R.nouvelAthlete('T', 'modeste', 'polyvalent', null); p.argent = 500;
  p.usure = { ischio: 0, periostite: 101, achille: 0, cheville: 0 }; R.tirerLeCorps(p, 'gainage'); R.soigner(p, 'medecin'); R.soigner(p, 'radio');
  ok('un tibia pousse au grade 3 : la radio trouve la fracture de fatigue', p.diagnostic.fracture === true);
  const q = R.nouvelAthlete('T', 'modeste', 'polyvalent', null); q.argent = 500;
  q.usure = { ischio: 0, periostite: 88, achille: 0, cheville: 0 }; R.tirerLeCorps(q, 'gainage'); R.soigner(q, 'medecin'); R.soigner(q, 'radio');
  ok('grade 1 : pas de fracture', !q.diagnostic.fracture);
  const riche = R.nouvelAthlete('T', 'aisee', 'polyvalent', null);
  ok('mineur, famille aisee : les parents paient tout', R.resteACharge(riche, 'irm') === 0 && R.resteACharge(riche, 'osteo') === 0);
  const adulte = R.nouvelAthlete('T', 'aisee', 'polyvalent', null, undefined, 25);
  ok('adulte sans certificat : il faut voir le medecin pour courir', R.certificatRequis(adulte));
  ok('l\'osteo n\'est pas rembourse', R.resteACharge(adulte, 'osteo') === 55);
  const nd = R.nouvelAthlete('T', 'modeste', 'polyvalent', null);
  nd.usure = { ischio: 0, periostite: 0, achille: 0, cheville: 86 }; R.tirerLeCorps(nd, 'gainage');
  const w = nd.blessure; R.finirLaSemaine(nd);
  ok('sans diagnostic, la blessure dure une semaine de plus', nd.blessure === w);
}

titre('le calage sur le direct, a partir de la France');
{
  const a = R.nouvelAthlete('T', 'aisee', 'polyvalent', null);
  a.semaine = 20; a.prochaine = 10;
  const rdv = { id: 'ED1', debut: 1_000_000 };
  a.niveau = 2;
  // l'auteur, 25/10 : departementaux et regionaux suivent aussi le calendrier des France
  ok('aux regionaux, la date reelle aussi', !R.jourCale(a, rdv, 0).jour && R.jourCale(a, rdv, 0).date === rdv.debut);
  a.niveau = 0;
  ok('au scolaire, les semaines de jeu', R.jourCale(a, rdv, 0).jour && R.jourCale(a, rdv, 0).date === null);
  a.niveau = 2;
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

titre('les tours : series, demies, finale (format du direct)');
{
  const t = R.apresLeTour;
  ok('1er et 2e de serie : demi-finale, en direct', t('serie', 2).suivant === 'demie' && !t('serie', 2).auTemps);
  ok('3e et 4e de serie : demi-finale au temps', t('serie', 4).suivant === 'demie' && t('serie', 3).auTemps);
  ok('5e de serie : elimine, 21e', t('serie', 5).suivant === null && t('serie', 5).placeFinale === 21);
  ok('4e de demie : finale au temps', t('demie', 4).suivant === 'finale' && t('demie', 4).auTemps);
  ok('8e de demie : 16e', t('demie', 8).suivant === null && t('demie', 8).placeFinale === 16);
  ok('la finale ne qualifie pour rien', t('finale', 1).suivant === null && t('finale', 1).placeFinale === 1);
}

titre('le cycle des championnats et les meetings');
{
  const france = { id: 'FR1', debut: Date.UTC(2026, 11, 5) }; // un samedi
  const d = R.rendezVousAvantFrance(1, france), r = R.rendezVousAvantFrance(2, france);
  ok('departementaux 8 semaines avant les France, un samedi', d.debut === france.debut - 56 * 864e5 && new Date(d.debut).getUTCDay() === 6);
  ok('regionaux 4 semaines avant', r.debut === france.debut - 28 * 864e5 && r.id !== d.id);
  ok('pas de France annoncee : pas de date', R.rendezVousAvantFrance(1, null) === null && R.rendezVousAvantFrance(3, france) === null);
  const a = R.nouvelAthlete('M', 'modeste', 'polyvalent', null); a.evenement = null;
  a.niveau = 1; a.jour = R.DIMANCHE; a.argent = 100;
  ok('un meeting le dimanche', R.meetingPossible(a, false) === null);
  ok('pas le jour du championnat', R.meetingPossible(a, true) !== null);
  const n0 = a.niveau, p0 = a.prochaine, m0 = a.argent;
  const res = R.conclureLeMeeting(a, '100', 1, 12.4, 0.5);
  ok('il ne qualifie pour rien et ne decale pas le championnat', a.niveau === n0 && a.prochaine === p0 && !res.qualifie);
  ok('prime et record', a.argent === m0 + 30 && a.records['100'] === 12.4 && a.palmares[0].meeting);
  a.meeting = a.semaine;
  ok('un seul meeting par dimanche', R.meetingPossible(a, false) !== null);
}

titre('le guide du moment');
{
  const a = R.nouvelAthlete('G', 'modeste', 'polyvalent', null); a.evenement = null;
  a.jour = 0; a.heure = 7 * 60 + 30; a.cours = false;
  ok('lundi 7 h 30 : aller en cours', R.conseil(a, false).lieu === 'college');
  a.besoinsJ = undefined; R.besoinsDe(a).energie = 10;
  ok('plus d’energie : rentrer dormir, en urgence', R.conseil(a, false).lieu === 'maison' && R.conseil(a, false).urgent);
  R.besoinsDe(a).energie = 90;
  a.blessure = 2; a.blessureType = 'ischio'; a.diagnostic = null;
  ok('blesse sans diagnostic : le medecin d’abord', R.conseil(a, false).lieu === 'kine');
  a.blessure = 0;
  a.cours = true; a.heure = 17 * 60;
  const s = R.seanceDuJourDe(a);
  ok('lundi 17 h : la seance, au bon lieu', s && R.conseil(a, false).lieu === s.lieu);
  a.faites.push('lundi');
  const j = R.journee(a, false);
  ok('la journee se coche : cours et seance faits', j.find(x => x.texte[0].startsWith('Aller')).fait && j.find(x => x.texte[0].startsWith('Séance')).fait);
  R.faireUneAction(a, 'douche');
  ok('la douche faite se coche, et se remet a zero au reveil', R.journee(a, false).find(x => x.texte[0] === 'Douche').fait);
  a.heure = 22 * 60; R.dormir(a);
  ok('…le lendemain, plus rien de coche hors seances', !R.journee(a, false).find(x => x.texte[0] === 'Douche').fait);
  a.jour = R.DIMANCHE; a.heure = 9 * 60;
  ok('jour de competition : la gare', R.conseil(a, true).lieu === 'gare');
}

console.log(e ? `\n${e} echec(s)\n` : '\nTout passe.\n');
process.exit(e ? 1 : 0);
