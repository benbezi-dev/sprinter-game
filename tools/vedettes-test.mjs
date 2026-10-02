// Les defis des vedettes — Aurel Manga, Meba-Mickael Zeze —, verifies sans
// navigateur.
//
// Ce que ce harnais tient, et que l'oeil ne voit pas :
//
//   1. le stade de l'evenement est a sa place d'ouvert — juste apres les
//      stades ouverts, avant ceux du canal de test — et LEVEL_NAMES le nomme
//      au meme rang : l'ouvrir ne devra rien deplacer ;
//   2. Aurel court au couloir 5, a cote du joueur, et son plateau porte toutes
//      les epreuves (une clef manquante fait tomber la construction) ;
//   3. son corps sculpte est bien charge, et son look reprend la carrure de
//      sa sculpture ;
//   4. UN SKIN NE CHANGE PAS LA FOULEE : le coureur du joueur habille en Aurel
//      Manga pose exactement ses appuis au meme endroit qu'en maillot or ;
//   5. MEBA-MICKAEL ZEZE : son stade derriere celui d'Aurel, ses deux chronos,
//      l'allure canon qui passe la ligne a l'heure pile, une pointe que rien
//      ne suit et une fin qu'on rattrape, son rituel dans les blocs et son
//      clap, ou les mains se rejoignent vraiment.
//
//   node tools/vedettes-test.mjs

import '../src/game/sprinter-i18n.js';
import '../src/game/coureur-hd.js';
import '../src/game/coureur-vedettes.js';
import '../src/game/coureur-premium.js';
import '../src/game/sprinter-core.js';
import { HAIES } from '../src/game/haies.js';

const K = globalThis.SprinterCore;
const I = globalThis.SprinterI18N;
const PREM = globalThis.SprinterPremium;

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const stades = K.STADES_HORS_SERIE;
const i = stades.findIndex(s => s.cle === 'defi-manga');
const S = stades[i];

titre('LE STADE DE L EVENEMENT');
ok('il existe', i >= 0);
ok('c est un evenement, ferme pour l instant', S && S.evenement === true && S.ouvert === false);
ok('il vient juste apres les stades ouverts',
   stades.slice(0, i).every(s => s.ouvert) && stades.slice(i + 1).every(s => !s.ouvert),
   stades.map(s => `${s.cle}:${s.ouvert ? 'o' : 'f'}`).join(' '));
I.setLang('fr');
const rang = K.LEVELS.length + i;
ok('LEVEL_NAMES le nomme au meme rang', I.levelName(rang) === 'Stade Jean-Delbert',
   `rang ${rang} : « ${I.levelName(rang)} »`);
ok('le defi Meba-Mickael Zeze vient juste apres, a la Riviera',
   stades[i + 1] && stades[i + 1].cle === 'defi-meba' && I.levelName(rang + 1) === 'Stade de la Riviera',
   `« ${I.levelName(rang + 1)} »`);
ok('et le stade d apres garde son nom', I.levelName(rang + 2) === 'Stade de la Riviera'
   && stades[i + 2] && stades[i + 2].cle === 'riviera', `« ${I.levelName(rang + 2)} »`);
ok('il se court au Stade Jean-Delbert', S.theme === 'montreuil');

titre('AUREL MANGA SUR LA LIGNE');
const lane = (n) => (n < 3 ? n : n + 1);
ok('il court au couloir 5 (index 4), a droite du joueur (index 3)',
   lane(S.names.indexOf('Aurel MANGA')) === 4);
const epreuves = [...Object.keys(K.RACES), ...Object.keys(HAIES)];
const manque = epreuves.filter(k => !S.plateau[k]);
ok('le plateau porte toutes les epreuves', manque.length === 0, manque.join(', '));
const cible = S.cibles['110h']['Aurel MANGA'];
ok('son chrono est fixe au 110 m haies', typeof cible === 'number' && cible > 0);
ok('les autres courent derriere lui', S.plateau['110h'][0] > cible,
   `plateau ${S.plateau['110h']} contre ${cible}`);

titre('SON CORPS ET SON LOOK');
const L = K.lookFor('Aurel MANGA', 'divers');
ok('lookFor rend son look, pas un tirage', L === K.VEDETTES['Aurel MANGA']);
ok('son profil Blender est charge', PREM.sculpte(L.profil));
ok('bandeau, poignet gauche, barbe', !!L.bandeau && L.poignet && L.poignet.cote === 1 && !!L.barbe);
const carrure = 1.06;   // tools/blender/anatomie.py, ATHLETES.manga.carrure
ok('le look reprend la carrure de la sculpture', L.morph && L.morph.sh === carrure);
const parts = K.pose({ look: L, stride: 1.2, v: 11, maxSpeed: 12, fallAnim: 0, celebrate: 0 }, 0);
ok('il se pose sans erreur', parts.length > 60, `${parts.length} volumes`);
ok('le bandeau est colle aux cheveux (COLLE)',
   parts.some(p => p[0] === L.bandeau && (p[6] & PREM.COLLE)));

titre('UN SKIN NE CHANGE PAS LA FOULEE');
const R = K.RACES['100'];
const T = new K.Track(R);
const courir = (look) => {
  const r = new K.Runner('TOI', 3, { isPlayer: true, maxSpeed: R.maxSpeed, best: R.best, total: T.total });
  r.look = look;
  const pas = [];
  r.v = 0;
  for (let k = 0; k < 400; k++) {
    r.v = Math.min(r.maxSpeed, r.v + 0.08);
    pas.push(+r.strideLength().toFixed(6));
  }
  return pas.join(',');
};
ok('memes longueurs d appui en maillot or et en Aurel Manga',
   courir(K.PLAYER_LOOK) === courir(L));

// ---------------------------------------------------------------------------
titre('MEBA-MICKAEL ZEZE : LE STADE');
const NOM = 'Méba-Mickaël ZÉZÉ';
const iM = stades.findIndex(s => s.cle === 'defi-meba');
const M = stades[iM];
ok('un evenement ferme, au decor de la Riviera', M && M.evenement && !M.ouvert && M.theme === 'riviera');
ok('sa musique a lui, et celle des ZEZE en repli', M.musique === 'defi_meba' && M.musiqueRepli === 'race3');
ok('il court au couloir 5', lane(M.names.indexOf(NOM)) === 4);
ok('le plateau porte toutes les epreuves', epreuves.every(k => M.plateau[k]));
ok('8,39 au 100 m, 17,30 au 200 m', M.cibles['100'][NOM] === 8.39 && M.cibles['200'][NOM] === 17.30);
ok('les autres courent derriere lui',
   M.plateau['100'][0] > 8.39 && M.plateau['200'][0] > 17.30);
ok('il ne se confond pas avec Mickeal ZEZE de la finale',
   K.lookFor(NOM, 'sprint') === K.VEDETTES[NOM] && K.lookFor('Mickeal ZEZE', 'sprint') !== K.VEDETTES[NOM]);

titre('MEBA-MICKAEL ZEZE : SON CORPS ET SON LOOK');
const LM = K.VEDETTES[NOM];
ok('son profil Blender est charge', PREM.sculpte(LM.profil) && LM.profil === 'meba');
ok('epaules et bassin du look = ceux du maillage cartoon (1,20 / 1,22)',
   LM.morph && LM.morph.sh === 1.20 && LM.morph.hip === 1.22);
ok('1,77 m', LM.h === 1.77);
ok('cheveux noirs courts sans bandeau (ses photos), barbe pleine, chaine',
   LM.hair === 'fade' && !LM.bandeau && LM.barbePleine && !!LM.chaine);
ok('soixante-quatre facettes au moins', LM.facettes === 64);
const PMULTRA = K.pose({ look: LM, stride: 1.2, v: 11, maxSpeed: 12, fallAnim: 0, celebrate: 0 }, 3);
ok('il se pose a l ultra sans erreur', PMULTRA.length > 80, `${PMULTRA.length} volumes`);
ok('chaque volume a ses huit champs', PMULTRA.every(p => p.length === 8));

titre('MEBA-MICKAEL ZEZE : L ALLURE CANON');
for (const [cle, T] of [['100', 8.39], ['200', 17.30]]) {
  const race = K.RACES[cle], track = new K.Track(race);
  const r = new K.Runner(NOM, 4, { target: T, maxSpeed: race.maxSpeed, total: track.total, pool: 'sprint', style: 'canon' });
  ok(`${cle} m : il court a l allure canon`, !!r.canon && r.canon.style === 'canon');
  const dt = 1 / 240; let t = 0, vMax = 0, tMax = 0, d50 = null, fatigue = 0;
  while (!r.finished && t < 40) {
    t += dt; r.stepAI(dt, t);
    if (r.v > vMax) { vMax = r.v; tMax = t; }
    if (d50 === null && r.d >= 50) d50 = t;
    fatigue = r.fatigue;
  }
  ok(`${cle} m : il passe la ligne a ${T} pile`, Math.abs(r.finishTime - T) < 1e-9, `${r.finishTime}`);
  ok(`${cle} m : pointe au-dessus de 14 m/s avant vingt metres`, vMax > 14 && r.canon.A * 0 + tMax < 2,
     `${vMax.toFixed(2)} m/s a ${tMax.toFixed(2)} s`);
  ok(`${cle} m : il finit bien plus lent qu a sa pointe`, r.canon.vFin < 0.7 * r.canon.pic,
     `${r.canon.vFin.toFixed(2)} / ${r.canon.pic.toFixed(2)}`);
  ok(`${cle} m : sa foulee s alourdit jusqu a la ligne`, fatigue > 0.95, `${fatigue.toFixed(2)}`);
  // un doigt parfait, sans temps de reaction : ou en est-il a mi-course ?
  const joueur = (cad) => {
    const p = new K.Runner('TOI', 3, { isPlayer: true, maxSpeed: race.maxSpeed, best: race.best, total: track.total });
    const lui = new K.Runner(NOM, 4, { target: T, maxSpeed: race.maxSpeed, total: track.total, pool: 'sprint', style: 'canon' });
    let tt = 0, pr = 0, c = 0, avance = null;
    while (!p.finished && tt < 40) {
      if (tt >= pr) { p.press(c ? 'left' : 'right', tt); c ^= 1; pr += 1 / cad; }
      tt += dt; p.stepPlayer(dt, tt); lui.stepAI(dt, tt);
      if (avance === null && p.d >= track.total / 2) avance = lui.d - p.d;
    }
    return { chrono: p.finishTime, avance };
  };
  const j13 = joueur(13), j25 = joueur(25);
  ok(`${cle} m : a treize appuis par seconde, on ne le bat pas`, j13.chrono > T, `${j13.chrono.toFixed(2)}`);
  ok(`${cle} m : a vingt-cinq, il mene encore a mi-course`, j25.avance > 1.5, `${j25.avance.toFixed(2)} m`);
}
{
  const r = new K.Runner('Hugo Lestrade', 2, { target: 9.4, maxSpeed: 12.435, total: 100, pool: 'sprint' });
  ok('les autres coureurs gardent leur allure', r.canon === null && r.vmax > 0);
}

titre('MEBA-MICKAEL ZEZE : TROIS COURSES POUR LE MEME CHRONO');
for (const [cle, T] of [['100', 8.39], ['200', 17.30]]) {
  const race = K.RACES[cle], track = new K.Track(race), total = track.total;
  // chaque style, contre un doigt parfait a vingt-cinq appuis par seconde :
  // son temps aux dix metres, son avance quand le joueur passe chaque
  // cinquieme de la course, ses vitesses
  const courir = (style) => {
    const lui = new K.Runner(NOM, 4, { target: T, maxSpeed: race.maxSpeed, total, pool: 'sprint', style });
    const p = new K.Runner('TOI', 3, { isPlayer: true, maxSpeed: race.maxSpeed, best: race.best, total });
    const dt = 1 / 240, marques = [0.1, 0.3, 0.5, 0.7, 0.9].map(x => x * total);
    let tt = 0, pr = 0, c = 0, k = 0, t10 = null, vMin = 1e9, vMax = 0, fatigue = 0;
    const avance = [];
    while (!lui.finished && tt < 40) {
      if (!p.finished && tt >= pr) { p.press(c ? 'left' : 'right', tt); c ^= 1; pr += 1 / 25; }
      tt += dt; p.stepPlayer(dt, tt); lui.stepAI(dt, tt);
      if (t10 === null && lui.d >= 10) t10 = tt;
      while (k < marques.length && p.d >= marques[k]) { avance.push(lui.d - p.d); k++; }
      if (lui.d > 0.3 * total && !lui.finished) { vMin = Math.min(vMin, lui.v); vMax = Math.max(vMax, lui.v); }
      fatigue = Math.max(fatigue, lui.fatigue);
    }
    return { lui, t10, avance, vMin, vMax, fatigue };
  };
  const S = { canon: courir('canon'), finisseur: courir('finisseur'), regulier: courir('regulier') };
  for (const [nom, x] of Object.entries(S)) {
    ok(`${cle} m, ${nom} : il passe la ligne a ${T} pile`, x.lui.finishTime === T && x.lui.canon.style === nom,
       `${x.lui.finishTime}`);
  }
  const f = (a) => a.map(v => v.toFixed(1)).join(' ');
  ok(`${cle} m : le canon sort le premier des blocs, le finisseur le dernier`,
     S.canon.t10 < S.regulier.t10 - 0.1 && S.regulier.t10 < S.finisseur.t10 - 0.1,
     `${S.canon.t10.toFixed(2)} / ${S.regulier.t10.toFixed(2)} / ${S.finisseur.t10.toFixed(2)} s`);
  ok(`${cle} m : le canon mene a mi-course, le finisseur y est loin derriere`,
     S.canon.avance[2] > 3 && S.finisseur.avance[2] < -5,
     `canon ${f(S.canon.avance)} | finisseur ${f(S.finisseur.avance)}`);
  ok(`${cle} m : le finisseur relance de plus de 2 m/s, et finit le plus vite des trois`,
     S.finisseur.lui.canon.vFin - S.finisseur.vMin > 2
     && S.finisseur.lui.canon.vFin > S.regulier.lui.canon.vFin && S.regulier.lui.canon.vFin > S.canon.lui.canon.vFin,
     `${S.finisseur.vMin.toFixed(1)} -> ${S.finisseur.lui.canon.vFin.toFixed(1)} m/s`);
  ok(`${cle} m : le finisseur ne s alourdit pas`, S.finisseur.fatigue === 0, `${S.finisseur.fatigue}`);
  ok(`${cle} m : le regulier reste a moins de 2,5 m du joueur`,
     S.regulier.avance.every(a => Math.abs(a) < 2.5), f(S.regulier.avance));
  ok(`${cle} m : le regulier tient sa vitesse a 10 % pres`, S.regulier.vMin > 0.9 * S.regulier.vMax,
     `${S.regulier.vMin.toFixed(1)} - ${S.regulier.vMax.toFixed(1)} m/s`);
  ok(`${cle} m : sa foulee ne s alourdit qu a peine`, S.regulier.fatigue < 0.35, `${S.regulier.fatigue.toFixed(2)}`);
}
{
  // le tirage : jamais deux fois le meme de suite, et les trois sortent
  const tires = [];
  for (let n = 0; n < 60; n++) tires.push(new K.Runner(NOM, 4, { target: 8.39, maxSpeed: 12, total: 100, pool: 'sprint' }).canon.style);
  ok('chaque tentative tire sa course, jamais deux fois la meme de suite',
     tires.every((s, n) => n === 0 || s !== tires[n - 1]), tires.slice(0, 12).join(' '));
  ok('les trois sortent', ['canon', 'finisseur', 'regulier'].every(s => tires.includes(s)));
  ok('un autre athlete n en tire pas', new K.Runner('Hugo Lestrade', 2, { target: 9.4, maxSpeed: 12.435, total: 100 }).styleCourse === null);
}

titre('MEBA-MICKAEL ZEZE : LE RITUEL ET LE CLAP');
const poseDe = (o, lod = 0) => K.pose(Object.assign({ look: LM, stride: 0, v: 0, maxSpeed: 12,
  fallAnim: 0, celebrate: 0, d: 0 }, o), lod);
// Le bassin (le premier volume pose sur `hip`) : au rituel il monte bien
// au-dessus de sa hauteur « a vos marques ».
const bassin = (parts) => parts[0][1][2];
const zMarques = bassin(poseDe({ enBloc: 1, prets: 0, rituel: 0 }));
const zRituel = bassin(poseDe({ enBloc: 1, prets: 0, rituel: 1, rituelT: 0 }));
ok('au rituel, le bassin monte en V renverse', zRituel > zMarques + 0.3,
   `${zMarques.toFixed(2)} -> ${zRituel.toFixed(2)} m`);
// Les mains : le dernier volume de chaque bras est sa main ; on cherche la
// peau la plus haute et la plus proche de l'axe dans une pose de clap.
const mains = (parts) => parts.filter(p => p[0] === LM.skin && p[7]);
const clap = (ferme) => {
  // l'horloge du geste tombe sur une frappe (ferme) ou entre deux (ouvert)
  const tc = ferme ? 0.2 : 0;
  return poseDe({ finished: true, v: 1, gesteT: tc, stride: 3 });
};
ok('le clap sort les bras du plan de course (roulis)', mains(clap(true)).length > 0);
// Les deux bouts d'un volume, calcules comme personCapsules le fait.
const bouts = (p) => [-1, 1].map(sg => {
  const [, pv, ang, off, hf, , , roule] = p;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const lz = off[2] + sg * hf[4];
  let x = pv[0] + off[0] * ca - lz * sa, z = pv[2] + off[0] * sa + lz * ca, y = pv[1] + off[1];
  if (roule) { const dy = y - pv[1], dz = z - pv[2]; y = pv[1] + dy * Math.cos(roule) - dz * Math.sin(roule); z = pv[2] + dy * Math.sin(roule) + dz * Math.cos(roule); }
  return [x, y, z];
});
// L'ecart des mains : du point le plus a l'interieur de la main gauche a celui
// de la main droite — la ou elles se touchent. On ne garde que les volumes de
// l'avant-bras et de la main (roulis de plus de 0,05 rad), dans le tiers
// haut du geste.
const ecartMains = (parts) => {
  const m = parts.filter(p => p[0] === LM.skin && Math.abs(p[7] || 0) > 0.05).flatMap(bouts);
  const zMax = Math.max(...m.map(q => q[2]));
  const haut = m.filter(q => q[2] > zMax - 0.08);
  const g = haut.filter(q => q[1] > 0), d = haut.filter(q => q[1] < 0);
  if (!g.length || !d.length) return null;
  return { ecart: Math.min(...g.map(q => q[1])) - Math.max(...d.map(q => q[1])), haut: zMax };
};
const ferme = ecartMains(clap(true)), ouvert = ecartMains(clap(false));
ok('mains ouvertes : ecartees', ouvert && ouvert.ecart > 0.18, ouvert && `${ouvert.ecart.toFixed(3)} m`);
ok('a la frappe : elles se touchent', ferme && ferme.ecart < 0.07, ferme && `${ferme.ecart.toFixed(3)} m`);
// DEVANT LE VISAGE, PAS AU-DESSUS : le crane culmine vers 1,64 m sur le rig
// du jeu, les yeux vers 1,52 ; les mains montent a hauteur du visage.
ok('devant le visage, pas au-dessus de la tete', ferme && ferme.haut > 1.42 && ferme.haut < 1.62,
   ferme && `${ferme.haut.toFixed(2)} m`);

titre('SON SKIN : LE DEPART, LA TRANSITION ET LE COUDE');
// Vingt pour cent de marge en plus pour decrocher le depart parfait : le
// « TOP » du HUD tombe a 82 % du gain de reaction.
{
  const race = K.RACES['100'], track = new K.Track(race);
  const topA = (look, r) => {
    const p = new K.Runner('TOI', 3, { isPlayer: true, maxSpeed: race.maxSpeed, best: race.best, total: track.total });
    if (look) p.look = look;
    p.press('left', r);
    return p.reactBonus > K.C.REACT_BONUS * 0.82;
  };
  ok('maillot : 0,150 s est un depart parfait', topA(null, 0.150));
  ok('maillot : 0,180 s ne l est pas', !topA(null, 0.180));
  ok('sous son skin, 0,180 s l est', topA(LM, 0.180));
  ok('sous son skin, 0,190 s ne l est plus', !topA(LM, 0.190));
  // la marge : sous 0,156 s en maillot, sous 0,187 s sous son skin
  const seuil = (look) => { let r = 0.10; while (topA(look, r + 0.0005)) r += 0.0005; return r; };
  const a = seuil(null), b = seuil(LM);
  ok('la marge du depart parfait grandit de vingt pour cent', Math.abs(b / a - 1.2) < 0.01,
     `${a.toFixed(4)} s -> ${b.toFixed(4)} s`);
}
// ET LA TRANSITION PARFAITE (02/10) : vingt pour cent de marge aussi. La note
// juge le rapport des intervalles d'appui (debut de la poussee / fin) ; sous
// son skin, ce qui depasse 1 compte 1,2 fois. Huit appuis au moins, une fin de
// poussee a 0,118 s (sous le plancher de 0,125 s).
{
  const race = K.RACES['100'], track = new K.Track(race);
  const note = (look, ratio) => {
    const p = new K.Runner('TOI', 3, { isPlayer: true, maxSpeed: race.maxSpeed, best: race.best, total: track.total });
    if (look) p.look = look;
    const t = [0];
    for (let k = 0; k < 12; k++) t.push(t[t.length - 1] + (k < 6 ? 0.118 * ratio : 0.118));
    p.pressTimes = t;
    p.gradeTransition();
    return p.transGrade;
  };
  ok('son look porte les deux marges (1,2 et 1,2)', LM.departParfait === 1.2 && LM.transParfaite === 1.2);
  ok('maillot : un rapport de 1,21 est une transition parfaite', note(null, 1.21) === 2);
  ok('maillot : 1,18 n est qu une bonne', note(null, 1.18) === 1);
  ok('sous son skin, 1,18 est parfaite', note(LM, 1.18) === 2);
  ok('sous son skin, 1,16 ne l est plus', note(LM, 1.16) === 1);
  ok('maillot : 1,08 ne vaut rien ; sous son skin, c est une bonne', note(null, 1.08) === 0 && note(LM, 1.08) === 1);
  // la marge : ce qui depasse 1 dans le rapport exige, divise par 1,2
  const seuil = (look) => { let r = 1.30; while (note(look, r - 0.0005) === 2) r -= 0.0005; return r; };
  const a = seuil(null), b = seuil(LM);
  ok('la marge de la transition parfaite grandit de vingt pour cent', Math.abs((a - 1) / (b - 1) - 1.2) < 0.02,
     `parfaite des ${a.toFixed(4)} -> ${b.toFixed(4)}`);
  ok('le rapport garde reste le vrai', (() => {
    const p = new K.Runner('TOI', 3, { isPlayer: true, maxSpeed: race.maxSpeed, best: race.best, total: track.total });
    p.look = LM;
    const t = [0];
    for (let k = 0; k < 12; k++) t.push(t[t.length - 1] + (k < 6 ? 0.118 * 1.18 : 0.118));
    p.pressTimes = t; p.gradeTransition();
    return Math.abs(p.transRatio - 1.18) < 0.001;
  })());
}
// LE COUDE RESTE PLIE DERRIERE : quand le bras est derriere le corps, l'angle
// de l'avant-bras au bras ne descend pas sous 0,8 rad (45 degres).
{
  const G = K.GAITS.canon;
  let pire = 9;
  for (let i = 0; i < 64; i++) {
    const ph = i / 64 * Math.PI * 2;
    if (K.gait(G.arm, ph) < -0.5) pire = Math.min(pire, K.gait(G.elbow, ph));
  }
  ok('bras derriere, le coude garde son angle', pire > 0.8, `${pire.toFixed(2)} rad`);
}

console.log(`\n${'─'.repeat(62)}\n   ${e ? e + ' ECHEC(S).' : 'TOUT PASSE.'}`);
process.exit(e ? 1 : 0);
