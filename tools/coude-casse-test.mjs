// LE CASSE SUR LA LIGNE et LE PELOTON DU 400 M EN SALLE (l'auteur, 09/11/2026) : ce que le moteur en fait.
//   node tools/coude-casse-test.mjs
import '../src/game/sprinter-core.js';
import { COURSES_EN_SALLE, SALLE } from '../src/game/piste-salle.js';
const K = globalThis.SprinterCore;
const { Track, Runner, RACES, CASSE } = K;
let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || d == null ? '' : ' — ' + d}`); if (!c) e++; };
const f3 = (x) => (x >= 0 ? '+' : '') + x.toFixed(3);

// Un 100 m couru a dix appuis par seconde, au pas du moteur (1/240 s) ; `casseA` : le casse donne a tant de metres
// de la ligne (null : jamais ; negatif : apres la ligne).
function courir(race, casseA, cadence = 10) {
  const T = new Track(race);
  const r = new Runner('TOI', 3, { isPlayer: true, maxSpeed: race.maxSpeed, best: race.best, total: T.total });
  const dt = 1 / 240;
  let t = 0, suivant = 0, g = 0, note = null, tente = false;
  while (t < 90 && !(r.finished && (casseA == null || casseA >= 0 || r.casseNote || t > r.finishTime + 0.6))) {
    if (t >= suivant) { r.press(g++ % 2 ? 'R' : 'L', t); suivant += 1 / cadence; }
    if (casseA != null && !tente && (T.total - r.d <= casseA || r.finished)) { tente = true; note = r.casser(t) || note; }
    r.stepPlayer(dt, t);
    t += dt;
  }
  return { t: r.finishTime, note: r.casseNote || note, gain: r.casseGain, r };
}

console.log('LE CASSE');
{
  const R = RACES['100'], sans = courir(R, null).t;
  console.log(`      100 m sans casse : ${sans.toFixed(3)} s`);
  const rangs = [0.4, 1.0, 1.6, 2.2, 2.8, 3.4, 4.5, 6, 9, 14];
  const vus = rangs.map(a => ({ a, ...courir(R, a) }));
  for (const v of vus) console.log(`      casse a ${String(v.a).padStart(4)} m : ${f3(sans - v.t)} s  ${v.note}  (annonce ${f3(v.gain)})`);
  const meilleur = vus.reduce((a, b) => (b.t < a.t ? b : a));
  ok(`le meilleur casse gagne quelques centiemes (${f3(sans - meilleur.t)} s a ${meilleur.a} m)`, sans - meilleur.t >= 0.015 && sans - meilleur.t <= 0.04);
  ok('il tombe sur la derniere foulee (1 a 3,5 m de la ligne)', meilleur.a >= 1 && meilleur.a <= 3.5);
  ok('le meilleur est note parfait', meilleur.note === 'parfait');
  const tot = vus.filter(v => v.a >= 6);
  ok(`trop tot (6 m et plus), on perd (${tot.map(v => f3(sans - v.t)).join(' ')})`, tot.every(v => v.t > sans + 0.005));
  ok('trop tot, note « tot »', tot.every(v => v.note === 'tot'));
  ok('a 40 cm, note « tard » et presque rien de gagne', vus[0].note === 'tard' && Math.abs(sans - vus[0].t) < 0.012);
  ok('la note suit le chrono : parfait et bon font gagner, trop tot et trop tard non',
     vus.every(v => (v.note === 'parfait' || v.note === 'bon') === (v.gain > CASSE.bon)));
  ok(`la note annoncee suit le chrono (ecart max ${Math.max(...vus.map(v => Math.abs((sans - v.t) - v.gain))).toFixed(4)} s)`,
     vus.every(v => Math.abs((sans - v.t) - v.gain) < 0.006));
  const apres = courir(R, -0.1);
  ok(`apres la ligne : « tard », le chrono ne bouge pas (${apres.t.toFixed(3)})`, apres.note === 'tard' && Math.abs(apres.t - sans) < 1e-9);
  const loin = courir(R, CASSE.zone + 5);
  ok(`hors des ${CASSE.zone} derniers metres, le geste ne fait rien`, loin.note == null && Math.abs(loin.t - sans) < 1e-9);
  // le 400 m, plus lent sur la ligne : le gain y est un peu plus grand
  const R4 = RACES['400'], s4 = courir(R4, null).t, m4 = Math.min(...[1.2, 1.8, 2.4].map(a => courir(R4, a).t));
  ok(`400 m : le meilleur casse gagne ${f3(s4 - m4)} s`, s4 - m4 >= 0.015 && s4 - m4 <= 0.045);
  // les adversaires cassent a l'image, sans toucher a leur chrono
  const a = new Runner('A', 2, { target: 10.2, total: 100, maxSpeed: 12 });
  let pic = 0; for (let t = 0; t < 10.6; t += 1 / 240) { a.stepAI(1 / 240, t); pic = Math.max(pic, a.casse || 0); }
  ok(`un adversaire casse sur la ligne (pic ${pic.toFixed(2)}), chrono intact (${a.finishTime})`, pic > 0.85 && a.finishTime === 10.2);
}

console.log('LE PELOTON DU 400 M EN SALLE');
{
  const T = new Track(COURSES_EN_SALLE['400s']), PE = SALLE.peloton;
  const R1 = SALLE.couloir;   // largeur d'un couloir
  // tout le monde dans le couloir 1 apres le rabattement : la corde ou l'epaule, jamais au-dela de son bord
  ok(`l'epaule reste dans le couloir 1 (corps a ${(SALLE.mes1 + PE.epaule + 0.225).toFixed(2)} m du bord, couloir de ${R1} m)`,
     SALLE.mes1 + PE.epaule + 0.225 <= R1);
  ok('le couloir 2 est dans le couloir 2', SALLE.mes1 + PE.dehors - 0.225 >= R1);
  const coureur = (d, lane, extra) => Object.assign({ d, lane, v: 9, isPlayer: false }, extra || {});
  const pose = (rs) => { for (let i = 0; i < 400; i++) T.placerPeloton(rs, 1 / 240); return rs; };
  {
    const rs = pose([coureur(300, 0), coureur(296, 1), coureur(292, 2), coureur(288, 3), coureur(284, 4), coureur(280, 5)]);
    ok('en file indienne, tous a la corde', rs.every(r => Math.abs(r.travers) < 1e-3));
  }
  {
    const rs = pose([coureur(300, 0), coureur(300.3, 1), coureur(299.8, 2), coureur(290, 3)]);
    const x = rs.map(r => r.traversVise);
    ok(`trois de front : corde, epaule, couloir 2 (${x.slice(0, 3).join(' / ')})`, x[1] === PE.corde && x[0] === PE.epaule && x[2] === PE.dehors);
  }
  {
    // le joueur derriere deux coureurs de front : enferme, il reste dans le couloir 1 et ne passe pas
    const j = coureur(299.4, 3, { isPlayer: true, v: 10.5 });
    const rs = pose([coureur(300, 0), coureur(300.1, 1), j]);
    ok(`enferme derriere deux coureurs de front, il reste au couloir 1 (${j.traversVise})`, j.enferme && j.traversVise <= PE.epaule);
    const devant = T.retenir(j, rs);
    ok(`retenu a la vitesse de celui de devant (${j.v.toFixed(2)} m/s)`, devant && j.v <= 9 + 1e-9);
    j.couloir2 = true; pose(rs);
    ok(`au couloir 2, il n'est plus enferme (${j.travers.toFixed(2)} m)`, !j.enferme && !T.retenir(j, rs) && Math.abs(j.travers - PE.dehors) < 0.01);
  }
  {
    // au coude a coude : corde et epaule a portee de coude, epaule et couloir 2 non
    const a = coureur(300, 0, { travers: PE.corde }), b = coureur(300.4, 1, { travers: PE.epaule }), c = coureur(300.2, 2, { travers: PE.dehors });
    ok('corde et epaule : a portee de coude', T.auContact(a, b, SALLE.coude));
    ok('epaule et couloir 2 : hors de portee', !T.auContact(b, c, SALLE.coude));
    ok('premier tour, dans les couloirs : jamais', !T.auContact(coureur(100, 0), coureur(100.2, 1), SALLE.coude));
  }
  {
    // le couloir 2 coute du chemin dans les virages, rien en ligne droite
    const virage = T.trajetPeloton(250, 0, PE.dehors), droite = T.trajetPeloton(T.total - 10, 0, PE.dehors);
    const perte = SALLE.longueurVirage(SALLE.mes1 + PE.dehors) - SALLE.longueurVirage(SALLE.mes1);
    ok(`un virage au couloir 2 : ${perte.toFixed(2)} m de plus (pi x ${PE.dehors} = ${(Math.PI * PE.dehors).toFixed(2)})`, Math.abs(perte - Math.PI * PE.dehors) < 0.05);
    ok(`en virage, chaque pas avance de ${virage.toFixed(3)} ; en ligne droite, de ${droite}`, virage < 0.96 && droite === 1);
  }
  {
    // le coup de coude recu : l'adversaire retarde, son chrono aussi, sans reculer
    const a = new Runner('A', 2, { target: 46, total: 400, maxSpeed: 11.45 });
    let d0 = 0, recule = false;
    for (let t = 0; t < 47; t += 1 / 240) {
      if (Math.abs(t - 30) < 1 / 480) a.retardVise = (a.retard || 0) + SALLE.coude.retard;
      const avant = a.d; a.stepAI(1 / 240, t); if (a.d < avant - 1e-9) recule = true;
      if (Math.abs(t - 30) < 1 / 480) d0 = a.d;
    }
    ok(`l'adversaire touche finit ${SALLE.coude.retard} s plus tard (${a.finishTime.toFixed(3)} s), sans reculer`, Math.abs(a.finishTime - 46 - SALLE.coude.retard) < 1e-6 && !recule && d0 > 0);
  }
}

console.log(e ? `\n${e} echec(s)\n` : '\nTout passe.\n');
process.exit(e ? 1 : 0);
