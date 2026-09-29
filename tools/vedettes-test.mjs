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
ok('la carrure du look est celle de la sculpture (1,02)', LM.morph && LM.morph.sh === 1.02);
ok('1,77 m', LM.h === 1.77);
ok('vanilles blondes, bandeau, barbe pleine, chaine',
   LM.hair === 'twists' && !!LM.meches && !!LM.bandeau && LM.barbePleine && !!LM.chaine);
ok('soixante-quatre facettes au moins', LM.facettes === 64);
const PMULTRA = K.pose({ look: LM, stride: 1.2, v: 11, maxSpeed: 12, fallAnim: 0, celebrate: 0 }, 3);
ok('il se pose a l ultra sans erreur', PMULTRA.length > 80, `${PMULTRA.length} volumes`);
ok('chaque volume a ses huit champs', PMULTRA.every(p => p.length === 8));

titre('MEBA-MICKAEL ZEZE : L ALLURE CANON');
for (const [cle, T] of [['100', 8.39], ['200', 17.30]]) {
  const race = K.RACES[cle], track = new K.Track(race);
  const r = new K.Runner(NOM, 4, { target: T, maxSpeed: race.maxSpeed, total: track.total, pool: 'sprint' });
  ok(`${cle} m : il court a l allure canon`, !!r.canon);
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
    const lui = new K.Runner(NOM, 4, { target: T, maxSpeed: race.maxSpeed, total: track.total, pool: 'sprint' });
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
// l'avant-bras et de la main (roulis de plus d'un demi-radian), dans le tiers
// haut du geste.
const ecartMains = (parts) => {
  const m = parts.filter(p => p[0] === LM.skin && Math.abs(p[7] || 0) > 0.5).flatMap(bouts);
  const zMax = Math.max(...m.map(q => q[2]));
  const haut = m.filter(q => q[2] > zMax - 0.08);
  const g = haut.filter(q => q[1] > 0), d = haut.filter(q => q[1] < 0);
  if (!g.length || !d.length) return null;
  return { ecart: Math.min(...g.map(q => q[1])) - Math.max(...d.map(q => q[1])), haut: zMax };
};
const ferme = ecartMains(clap(true)), ouvert = ecartMains(clap(false));
ok('mains ouvertes : ecartees', ouvert && ouvert.ecart > 0.18, ouvert && `${ouvert.ecart.toFixed(3)} m`);
ok('a la frappe : elles se touchent', ferme && ferme.ecart < 0.07, ferme && `${ferme.ecart.toFixed(3)} m`);
// le crane culmine vers 1,64 m au-dessus de la piste, sur le rig du jeu
ok('et au-dessus de la tete', ferme && ferme.haut > 1.64, ferme && `${ferme.haut.toFixed(2)} m`);

console.log(`\n${'─'.repeat(62)}\n   ${e ? e + ' ECHEC(S).' : 'TOUT PASSE.'}`);
process.exit(e ? 1 : 0);
