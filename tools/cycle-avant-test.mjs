// LA MECANIQUE AVANT EN PLEINE COURSE (13/11, l'auteur : « attention au cycle de course en pleine course, pas de cycle
// arriere, respecte bien la technique de course des sprinters »). Mesure, sur un 100 m couru par le moteur, la jambe
// au fil d'une foulee en pleine vitesse : extension de cuisse derriere, pied derriere la hanche, part du cycle devant.
//   node tools/cycle-avant-test.mjs
import '../src/game/sprinter-core.js';
import '../src/game/coureur-hd.js';
import '../src/game/coureur-premium.js';
const K = globalThis.SprinterCore;
const { Track, Runner, RACES } = K;
const LT = 0.392, LS = 0.380, deg = (a) => Math.round(a * 180 / Math.PI);

export function mesurer(gaitCle, a = 55, b = 75) {
  const R = RACES['100'], T = new Track(R);
  K.poserLAllure('100');
  const r = new Runner('TOI', 3, { isPlayer: true, maxSpeed: R.maxSpeed, best: R.best, total: T.total });
  r.look = Object.assign({}, r.look, { gait: gaitCle });
  r.squelette3D = true;
  const dt = 1 / 240; let t = 0, suivant = 0, g = 0;
  const pts = [];
  while (t < 30 && r.d < b) {
    if (t >= suivant) { r.press(g++ % 2 ? 'R' : 'L', t); suivant += 1 / 10; }
    r.stepPlayer(dt, t); t += dt;
    if (r.d > a) { K.pose(r, 2); const j = r.squelette && r.squelette.jambes.find((x) => x.side === 1); if (j) pts.push({ q: r.stride, th: j.th, sk: j.sk }); }
  }
  // pied par rapport a la hanche (x devant, y vers le haut) : la jambe seule, buste ignore
  const pied = pts.map((p) => ({ ...p, x: LT * Math.sin(p.th) + LS * Math.sin(p.sk), y: -(LT * Math.cos(p.th) + LS * Math.cos(p.sk)) }));
  const sol = Math.min(...pied.map((p) => p.y));
  // l'impulsion : la cuisse au plus loin derriere. A pleine vitesse l'appui fait pres d'un metre, le pied y est donc
  // forcement loin derriere. Le CYCLE ARRIERE, c'est ce qui suit : le pied qui continue de reculer en montant, le talon
  // haut loin derriere le corps, au lieu de repartir aussitot vers l'avant sous la fesse. (Un cycle mesure, au milieu.)
  const n = pied.length, iMin = pied.reduce((m, p, i) => (i > n * 0.25 && i < n * 0.75 && p.th < pied[m].th ? i : m), Math.floor(n * 0.25));
  const parCycle = Math.round(n / ((r.stride - pts[0].q) / (2 * Math.PI)));
  const iTo = iMin, apres = pied.slice(iTo, iTo + Math.round(parCycle * 0.4));
  const xTo = iTo < 0 ? 0 : pied[iTo].x;
  const loin = apres.filter((p) => p.x < xTo + 0.10);                // encore a moins de 10 cm en avant de l'impulsion
  const cycle = pied.slice(iTo, iTo + parCycle);
  const leve = cycle.filter((p) => p.y > sol + 0.15);              // pied nettement en l'air
  return {
    cuisseDerriere: deg(Math.min(...pied.map((p) => p.th))), cuisseDevant: deg(Math.max(...pied.map((p) => p.th))),
    genouMax: deg(Math.max(...pied.map((p) => p.th - p.sk))),
    // le pied en l'air le plus loin derriere la hanche (m), et la part du cycle passee en l'air a plus de 30 cm derriere
    piedLeveDerriere: +(-Math.min(...leve.map((p) => p.x))).toFixed(2),
    partHautDerriere: +(cycle.filter((p) => p.y > sol + 0.15 && p.x < -0.30).length / cycle.length).toFixed(3),
    vitesse: +r.v.toFixed(2),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let e = 0;
  for (const g of Object.keys(K.GAITS)) {
    const m = mesurer(g);
    // seuils (13/11) : avant correction, 25 a 28 % du cycle pied haut a plus de 30 cm derriere, cuisse a -29 degres
    const ok = m.partHautDerriere <= 0.15 && m.cuisseDerriere >= -25 && m.cuisseDevant >= 70 && m.genouMax <= 150;
    if (!ok) e++;
    console.log(ok ? '✓' : '✗', g.padEnd(8), JSON.stringify(m));
  }
  process.exit(e ? 1 : 0);
}
