// Le saut a l'ecran, verifie sur le vrai moteur et sur la vraie pose.
//
// Les harnais precedents jugent le reglement et le compte d'appuis ; aucun ne
// regarde le coureur. Celui-ci fait courir le coureur de sprinter-core.js avec
// le pas du hurdleur (haies-pas.js), pose sur lui ce que le rendu y pose
// (haies-rendu.js), et mesure le corps que pose() en tire : la jambe passe-
// t-elle au-dessus de la barre, la posture entre-t-elle et sort-elle du saut
// sans sauter d'une image a l'autre, et le coureur file-t-il jambes figees
// apres la reception du 400 m haies.

import '../src/game/coureur-hd.js';
import '../src/game/coureur-premium.js';
import '../src/game/sprinter-core.js';
import { HAIES } from '../src/game/haies.js';
import { APPEL } from '../src/game/haies-jeu.js';
import { nouvelleCourse, preparerCoureur, pas } from '../src/game/haies-pas.js';
import { sautDe, piedDAttaque, leveeDe, obstaclesDe } from '../src/game/haies-rendu.js';

const { Track, Runner, C, pose, GAITS } = globalThis.SprinterCore;

const CLES = ['100h', '110h', '400h'];
const TAU = Math.PI * 2;

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

/**
 * Les deux bouts de chaque volume du corps, en metres du rig, comme le rendu
 * les place avant de tourner le coureur dans son couloir (voir personCapsules
 * dans sprinter-app.js).
 */
function bouts(parts) {
  const out = [];
  for (const [, pv, ang, off, hf, yaw] of parts) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const yc = Math.cos(yaw), ys = Math.sin(yaw);
    for (const zs of [-1, 1]) {
      const lx = off[0], lz = off[2] + zs * hf[4];
      let x = pv[0] + lx * ca - lz * sa;
      const z = pv[2] + lx * sa + lz * ca;
      let y = pv[1] + off[1];
      if (yaw) { const t = x * yc - y * ys; y = x * ys + y * yc; x = t; }
      const rayon = zs < 0 ? (hf[0] + hf[1]) / 2 : (hf[2] + hf[3]) / 2;
      out.push([x, y, z, rayon]);
    }
  }
  return out;
}

/**
 * Une course jouee par un automate qui tape a cadence constante, 60 images
 * par seconde, avec le rendu des haies pose a chaque image comme le fait
 * drawRunner. `image` recoit le coureur apres chaque image.
 */
function courir(cle, { cadence, look = 'TOI', image } = {}) {
  const race = HAIES[cle];
  const track = new Track(race);
  const r = new Runner(look, 3, {
    isPlayer: true, maxSpeed: race.maxSpeed, best: race.best, total: track.total,
  });
  const course = nouvelleCourse(cle);
  preparerCoureur(course, r);
  const obst = obstaclesDe(course, new Map());
  const G = { player: r, elapsed: 0 };
  const dt = 1 / 60, sous = 4;
  let t = 0, prochain = 0, gauche = true;
  r.reaction = 0.15;
  while (t < 120 && r.d < track.total) {
    while (prochain <= t) {
      r.press(gauche ? 'a' : 'z', t);
      gauche = !gauche;
      prochain += 1 / cadence;
    }
    // Le jeu avance par pas de 1/240 s et appelle le pas du hurdleur a chaque
    // pas (engine.ts) ; le rendu, lui, passe une fois par image.
    for (let k = 0; k < sous; k++) {
      r.stepPlayer(dt / sous, t + (k * dt) / sous);
      pas(course, r);
    }
    t += dt;
    G.elapsed = t;
    obst.preparer(r, G, C);
    if (image) image(r, course);
  }
  return { r, course };
}

titre('LA FENETRE DU SAUT');

for (const cle of CLES) {
  const pos = [HAIES[cle].haies.premiere];
  const a = APPEL[cle];
  const h = pos[0];
  ok(`${cle} : rien loin de la haie`, sautDe(h - a.avant - 2, pos, a) === null
     && sautDe(h + a.apres + 2, pos, a) === null);
  const appel = sautDe(h - a.avant, pos, a), reception = sautDe(h + a.apres, pos, a);
  ok(`${cle} : l'appel ouvre le vol, la reception le ferme`,
     appel && appel.t === 0 && appel.w === 1 && reception && reception.t === 1 && reception.w === 1,
     JSON.stringify({ appel, reception }));
  const milieu = sautDe(h + (a.apres - a.avant) / 2, pos, a);
  ok(`${cle} : a mi-vol, t vaut un demi`, milieu && Math.abs(milieu.t - 0.5) < 1e-9);
  const avant = sautDe(h - a.avant - 0.3, pos, a), apres = sautDe(h + a.apres + 0.25, pos, a);
  ok(`${cle} : la posture monte avant l'appel et redescend apres`,
     avant && avant.w > 0 && avant.w < 1 && apres && apres.w > 0 && apres.w < 1);
}
{
  const pos = [13.72, 22.86];
  const s = sautDe(22.86, pos, APPEL['110h']);
  ok('la seconde haie est bien reconnue comme la seconde', s && s.i === 1);
}

titre('LA JAMBE D ATTAQUE EST CELLE QUI N EST PAS AU SOL');

{
  // Au pas k, la jambe d'appel est au contact : c'est l'autre qui attaque. On
  // le verifie sur la pose elle-meme, pour chaque gestuelle du jeu — la regle
  // de parite ne vaut que si toutes les tables posent le pied a la phase 0.
  const styles = Object.keys(GAITS || {});
  let faux = [];
  for (const nom of ['TOI', ...styles]) {
    const r = new Runner('TOI', 3, { maxSpeed: 11, target: 13 });
    if (GAITS && GAITS[nom]) r.look = { ...r.look, gait: nom };
    r.v = 9;
    for (let k = 0; k < 4; k++) {
      r.stride = k * Math.PI;
      const b = bouts(pose(r, 2));
      // Les deux derniers volumes de chaque jambe sont la semelle et la
      // chaussure : on prend le point le plus bas de chaque cote.
      const bas = (cote) => Math.min(...b.filter(p => Math.sign(p[1]) === cote).map(p => p[2]));
      const auSol = bas(1) < bas(-1) ? 1 : -1;
      if (piedDAttaque(k) === auSol) faux.push(`${nom} k=${k}`);
    }
  }
  ok(`la jambe d'attaque n'est jamais celle qui pousse (${styles.length + 1} gestuelles)`,
     faux.length === 0, faux.join(', '));
}

titre('LA JAMBE PASSE AU-DESSUS DE LA BARRE');

for (const cle of CLES) {
  const H = HAIES[cle].haies.hauteur;
  const pos = [];
  for (let i = 0; i < 10; i++) pos.push(HAIES[cle].haies.premiere + i * HAIES[cle].haies.ecart);
  let pire = Infinity, ou = '';
  for (const look of ['TOI', 'BOLT']) {
    const { } = courir(cle, {
      cadence: 11, look,
      image: (r) => {
        if (!r.saut || r.saut.w < 1) return;
        const echelle = r.look.h / C.MODEL_H;
        for (const [x, y, z, rayon] of bouts(pose(r, 1))) {
          // Un bout du corps qui franchit le plan de la haie, dans la largeur
          // de la barre, doit passer au-dessus d'elle.
          const u = r.d + x * echelle;
          if (Math.abs(y * echelle) > 0.59) continue;
          if (!pos.some(h => Math.abs(u - h) < 0.06)) continue;
          const dessous = (z - rayon) * echelle;
          if (dessous < pire) { pire = dessous; ou = `${look} a ${r.d.toFixed(2)} m`; }
        }
      },
    });
  }
  ok(`${cle} : rien ne traverse la barre de ${H} m (plus bas : ${pire.toFixed(3)} m, ${ou})`,
     pire > H, `${(H - pire).toFixed(3)} m dans la barre`);
}
{
  const leve = leveeDe(1.067, 1.90, C);
  ok('un grand gabarit monte moins qu un petit sur la meme haie',
     leve < leveeDe(1.067, 1.72, C) && leve >= 0.05);
}

titre('LA POSTURE NE SAUTE PAS D UNE IMAGE A L AUTRE');

for (const cle of CLES) {
  let avant = null, pireCourse = 0, pireSaut = 0, images = 0;
  courir(cle, {
    cadence: 11,
    image: (r) => {
      const b = bouts(pose(r, 2));
      const echelle = r.look.h / C.MODEL_H;
      if (avant && avant.length === b.length && r.d > 3 && !r.finished) {
        let pire = 0;
        for (let i = 0; i < b.length; i++) {
          pire = Math.max(pire, Math.hypot(b[i][0] - avant[i][0], b[i][1] - avant[i][1],
                                           b[i][2] - avant[i][2]) * echelle);
        }
        if (r.saut && r.saut.w > 0) { pireSaut = Math.max(pireSaut, pire); images++; }
        else pireCourse = Math.max(pireCourse, pire);
      }
      avant = b;
    },
  });
  ok(`${cle} : le saut ne bouge pas plus vite que la course (${pireSaut.toFixed(3)} m contre ${pireCourse.toFixed(3)} m par image, ${images} images)`,
     images > 100 && pireSaut <= pireCourse * 1.5,
     `${(pireSaut / pireCourse).toFixed(2)} fois la course`);
}

titre('APRES LA RECEPTION, LES JAMBES TOURNENT');

{
  let fige = 0, glisse = 0, sautDePhase = 0, avant = null, avantGel = false;
  courir('400h', {
    cadence: 11,
    image: (r, course) => {
      const vue = r.stride + (r.decalePas || 0);
      const i = course.i - 1;
      const auSolGele = course.enVol && r.freeze > 0 && i >= 0 &&
        r.d > course.positions[i] + APPEL['400h'].apres;
      if (auSolGele) {
        glisse++;
        if (avant !== null && avantGel && Math.abs(vue - avant) < 1e-9) fige++;
      }
      if (avant !== null) {
        const d = ((vue - avant) % TAU + TAU) % TAU;
        const saut = Math.min(d, TAU - d);
        sautDePhase = Math.max(sautDePhase, saut);
      }
      avant = vue; avantGel = auSolGele;
    },
  });
  ok(`sur le tour, le coureur ne file pas jambes figees (${glisse} images au sol encore gele)`,
     glisse > 50 && fige === 0, `${fige} images sans mouvement`);
  ok(`et la foulee affichee ne saute jamais (au pire ${sautDePhase.toFixed(2)} rad par image)`,
     sautDePhase < 0.6);
}
{
  const { r } = courir('110h', { cadence: 11 });
  ok('sur les courtes, le vol finit avec le saut : rien a rattraper', !(r.decalePas > 0));
}

titre('RANGER LES HAIES REND LE COUREUR D AVANT');

{
  const course = nouvelleCourse('110h');
  const obst = obstaclesDe(course, new Map());
  const r = new Runner('TOI', 3, { isPlayer: true, maxSpeed: 11, total: 110 });
  r.v = 9; r.stride = 3.3;
  const nu = JSON.stringify(pose(r, 1));
  r.d = 13.72 - 1.0;
  obst.preparer(r, { player: r }, C);
  ok('le coureur prend la posture a l approche de la haie', r.saut && r.saut.w > 0);
  obst.oublier(r);
  ok('et la rend entiere quand on range les haies', JSON.stringify(pose(r, 1)) === nu);
  r.saut = { t: 0.5, w: 0, pied: 1, haut: 0.2 };
  ok('un saut de poids nul ne change rien a la pose', JSON.stringify(pose(r, 1)) === nu);
}

console.log('\n──────────────────────────────────────────────────────────────');
console.log(e ? `   ${e} ECHEC(S).` : '   TOUT PASSE.');
process.exit(e ? 1 : 0);
