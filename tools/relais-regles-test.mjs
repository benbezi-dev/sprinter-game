// Les regles du relais, sans rien monter.
//
// Le module est pur : ni socket, ni base, ni horloge de rendez-vous. On peut
// donc lui poser les cas limites directement, ce qui est precieux — un passage
// accepte a tort ressemble exactement a un passage valide, et ne se verrait
// jamais a l'ecran.
import { CourseEquipe, zoneDe, noterPasse, ZONE, LEG, PORTEE }
  from '../worker/src/relais-course.js';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c?'✓':'✗'} ${n}${c||!d?'':' — '+d}`); if(!c) e++; };
const neuve = () => new CourseEquipe('T1', 'Test');

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  LES REGLES DU RELAIS                                        ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

console.log('\n── LA GEOMETRIE ─────────────────────────────────────────────');
ok('le premier relayeur n a pas de zone', zoneDe(1).debut === 0);
ok('la zone du 2e commence a 100 m', zoneDe(2).debut === 100);
ok('elle fait trente metres', zoneDe(2).fin - zoneDe(2).debut === ZONE);
ok('celle du 4e va de 300 a 330', zoneDe(4).debut === 300 && zoneDe(4).fin === 330);

console.log('\n── LA MARQUE ────────────────────────────────────────────────');
{
  const c = neuve();
  ok('le premier ne place pas de marque', c.placer(1, 50) === false);
  c.placer(2, 118);
  ok('la marque se pose dans la zone', c.coureur(2).d === 118);
  c.placer(2, 999);
  ok('au-dela, elle est ramenee au bord', c.coureur(2).d === 130, String(c.coureur(2).d));
  c.placer(2, -5);
  ok('en deca aussi', c.coureur(2).d === 100, String(c.coureur(2).d));
}

console.log('\n── UN PASSAGE VALIDE ────────────────────────────────────────');
{
  const c = neuve();
  c.placer(2, 112);
  // A PORTEE DE BRAS, et non plus « chacun quelque part dans la zone » : le
  // porteur etait pose a 108 m pour un receveur a 112 m, soit quatre metres
  // d'ecart, ce que la regle du contact refuse maintenant.
  c.avancer(1, 111);           // le porteur entre dans la zone, contre son receveur
  const r1 = c.taper(1, 1000);
  ok('une seule tape ne passe rien', !r1.passe && !r1.elimine);
  const r2 = c.taper(2, 1060);
  ok('les deux tapes passent le temoin', !!r2.passe, JSON.stringify(r2));
  ok('le temoin change de main', c.porteur === 2);
  ok('le passage est note', r2.passe.note >= 0 && r2.passe.note <= 2,
     `note ${r2.passe.note}, ecart ${r2.passe.ecart} ms, ${r2.passe.dans_zone} m dans la zone`);
  ok('il porte le donneur et le receveur', r2.passe.de === 1 && r2.passe.vers === 2);
}

console.log('\n── CE QUI ELIMINE ───────────────────────────────────────────');
{
  const c = neuve(); c.placer(2, 105); c.avancer(1, 105);
  c.taper(1, 1000);
  c.coureur(2).d = 135;                       // le receveur est sorti
  const r = c.taper(2, 1050);
  ok('temoin passe hors de la zone (receveur)',
     r.elimine?.raison === 'temoin passe hors de la zone', JSON.stringify(r));
}
{
  const c = neuve(); c.placer(2, 110);
  c.avancer(1, 90);                           // le donneur n'est pas entre
  c.taper(1, 1000);
  const r = c.taper(2, 1050);
  ok('temoin donne avant la zone',
     r.elimine?.raison === 'temoin donne avant la zone', JSON.stringify(r));
}
{
  const c = neuve(); c.placer(2, 112);
  const r = c.avancer(2, 131);                // le receveur quitte sa zone
  ok('sortie de zone sans le temoin',
     r.elimine?.raison === 'sortie de zone sans le temoin', JSON.stringify(r));
}
{
  const c = neuve();
  const r = c.avancer(1, 131);                // le porteur emporte le temoin
  ok('le temoin a depasse la zone',
     r.elimine?.raison === 'le temoin a depasse la zone', JSON.stringify(r));
}
{
  const c = neuve(); c.placer(2, 112); c.avancer(1, 110);
  c.taper(1, 1000);
  const r = c.taper(2, 2000);                 // une seconde plus tard
  ok('deux tapes trop eloignees ne sont pas un passage', !r.passe && !r.elimine);
  ok('et n eliminent pas non plus : ce serait punir le reseau', !c.elimine);
}

console.log('\n── LA PORTEE : IL FAUT SE TOUCHER ───────────────────────────');
//
// La regle manquait, et c'etait le defaut le plus visible du relais : deux
// coureurs chacun dans sa zone mais separes de vingt metres se passaient le
// temoin, qui traversait la piste tout seul.
{
  const c = neuve(); c.placer(2, 129); c.avancer(1, 101);
  c.taper(1, 1000);
  const r = c.taper(2, 1020);              // 28 m d'ecart, tous deux en zone
  ok('vingt-huit metres : pas de transmission', !r.passe && !!r.tropLoin,
     JSON.stringify(r));
  ok('et ce n est pas une elimination', !c.elimine);
  ok('le temoin reste au donneur', c.porteur === 1);
}
{
  const c = neuve(); c.placer(2, 113.2); c.avancer(1, 110);
  c.taper(1, 1000);
  const r = c.taper(2, 1020);              // 3,2 m : un pas de trop
  ok('un pas de trop : refuse', !r.passe && r.tropLoin?.bras === 3.2, JSON.stringify(r));
}
{
  const c = neuve(); c.placer(2, 112.4); c.avancer(1, 110);
  c.taper(1, 1000);
  const r = c.taper(2, 1020);              // 2,4 m : bras tendus, dans la portee
  ok('bras tendus, juste a la portee : passe', !!r.passe, JSON.stringify(r));
  ok('le passage porte la distance des deux corps', r.passe?.bras === 2.4,
     String(r.passe?.bras));
}
{
  const c = neuve(); c.placer(2, 112); c.avancer(1, 111.6);
  c.taper(1, 1000);
  const r = c.taper(2, 1020);
  ok('le temoin pose dans la main : passe', !!r.passe && r.passe.bras <= PORTEE / 2,
     String(r.passe?.bras));
}
{
  // Une main tendue dans le vide ne doit pas laisser de trace : sans ce
  // menage, la tape du donneur resterait en attente et se combinerait avec
  // une tape du receveur arrivee bien plus tard, hors de tout geste commun.
  const c = neuve(); c.placer(2, 125); c.avancer(1, 105);
  c.taper(1, 1000); c.taper(2, 1020);       // refusee, hors de portee
  ok('les deux tapes sont oubliees', c.touches.size === 0, String(c.touches.size));
}

console.log('\n── LA NOTE ──────────────────────────────────────────────────');
ok('tapes ensemble, milieu de zone, main dans la main : parfait',
   noterPasse(60, 15, 0.5) === 2);
ok('tapes ensemble mais colle a l entree : correct', noterPasse(60, 2, 0.5) === 1);
ok('tapes ensemble, bien place, mais au bout des doigts : correct',
   noterPasse(60, 15, 2.4) === 1);
ok('tapes decalees : correct au mieux', noterPasse(280, 15, 0.5) === 1);
ok('tres decalees : rate', noterPasse(500, 15, 0.5) === 0);

console.log('\n── LA COURSE ENTIERE ────────────────────────────────────────');
{
  const c = neuve();
  for (const r of [2, 3, 4]) c.placer(r, (r - 1) * LEG + 12);
  for (const [d, v] of [[1, 2], [2, 3], [3, 4]]) {
    // Le porteur vient CHERCHER son receveur : 111 m, contre les 112 m de la
    // marque. Un metre, c'est le temoin dans la main.
    c.avancer(d, (d - 1) * LEG + 111);
    c.taper(d, 1000 * d);
    c.taper(v, 1000 * d + 70);
  }
  ok('le temoin est arrive au quatrieme', c.porteur === 4, String(c.porteur));
  ok('trois passages enregistres', c.passes.length === 3, String(c.passes.length));
  const t = c.terminer(4, 38310);
  ok('le chrono est accepte', t.total === 38310);
  ok('la course est finie', c.finie() && !c.elimine);
  ok('un chrono absurde est refuse', Object.keys(neuve().terminer(4, 12)).length === 0);
  ok('seul le quatrieme peut terminer', Object.keys(neuve().terminer(2, 38310)).length === 0);
  console.log('   passages : ' + c.passes.map(p=>`${p.de}→${p.vers} note ${p.note}`).join('  '));
}

console.log('\n' + '─'.repeat(62));
console.log(e === 0 ? '   TOUT PASSE.' : `   ${e} VERIFICATION(S) EN ECHEC.`);
process.exit(e ? 1 : 0);
