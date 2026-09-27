// Le saut en longueur, verifie par ce qu'il doit produire.
//
//   node tools/longueur-test.mjs
//
// Le reglement se teste contre World Athletics : il y a une reponse exacte, on
// la compare. Le jeu n'en a pas — il a des PROPRIETES, et c'est elles qu'on
// verifie : l'angle optimum tombe ou tombent les finales, le record du monde
// se retrouve a la vitesse d'elan de celui qui l'a saute, une planche mordue
// ne se mesure pas, et un joueur qui ne fait qu'une chose mal n'est pas puni
// comme s'il avait tout rate.

import {
  PISTE_ELAN, PLANCHE, PLASTICINE, FOSSE, ESSAIS, VENT, RECORDS, TEMPS_ESSAI,
  marque, lireVent, homologable,
} from '../src/game/longueur.js';
import {
  AVANCE_PIED, APPEL_MAXI, jugerPlanche, angleDe, ANGLE_MIN, ANGLE_MAX, ANGLE_PAR_S, TENUE_MAXI,
  perteImpulsion, vol, hauteurA, jugerRamene, RAMENE_VISE, RECEPTION, sauter,
  PLATEAU, CONCURRENTS, essaiAdversaire, nouveauConcours, classement, aQui, inscrire,
  avancerJusquAuJoueur, joueurEnLice, placeDuJoueur, marquesDe, tours, tirerVent,
  HAUTEUR_ENVOL, HAUTEUR_RECEPTION,
} from '../src/game/longueur-jeu.js';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

/** Un tirage seme : les memes nombres a chaque passage (mulberry32). */
function seme(g) {
  let s = g >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Le meilleur saut possible a cette vitesse : pointe sur la ligne, ramene juste. */
function optimum(v) {
  let best = { m: 0, a: 0 };
  for (let a = ANGLE_MIN; a <= ANGLE_MAX; a += 0.25) {
    const m = sauter({ vElan: v, ecart: 0, angle: a, avance: RAMENE_VISE }).metres;
    if (m > best.m) best = { m, a };
  }
  return best;
}

titre('le reglement, contre World Athletics');
ok('piste d\'elan : 40 m au moins, 45 recommandes, 1,22 m de large',
   PISTE_ELAN.minimum === 40 && PISTE_ELAN.recommandee === 45 && PISTE_ELAN.largeur === 1.22);
ok('planche : 1,22 m sur 0,20 m', PLANCHE.longueur === 1.22 && PLANCHE.largeur === 0.20);
ok('plasticine : 10 cm juste apres la ligne', PLASTICINE.largeur === 0.10);
ok('fosse : entre 2,75 et 3 m de large',
   FOSSE.largeur >= FOSSE.largeurMin && FOSSE.largeur <= FOSSE.largeurMax);
ok('le sable commence entre 1 et 3 m de la ligne',
   FOSSE.debut >= FOSSE.debutMin && FOSSE.debut <= FOSSE.debutMax);
ok('le fond de la fosse est a 10 m de la ligne au moins', FOSSE.fond >= FOSSE.fondMin);
ok('trois essais, trois de plus pour les huit meilleurs',
   ESSAIS.premiers === 3 && ESSAIS.derniers === 3 && ESSAIS.qualifies === 8 && tours() === 6);
ok('une minute par essai', TEMPS_ESSAI === 60);
ok('vent homologable jusqu\'a +2,0 m/s',
   VENT.homologation === 2 && homologable(2.0) && !homologable(2.1) && homologable(-1.5));
ok('records du monde : 8,95 m (Powell, 1991) et 7,52 m (Chistyakova, 1988)',
   RECORDS.hommes.m === 8.95 && RECORDS.hommes.an === 1991 &&
   RECORDS.femmes.m === 7.52 && RECORDS.femmes.an === 1988);

titre('la mesure');
ok('au centimetre inferieur : 8,959 -> 8,95', marque(8.959) === 8.95);
ok('8,95 reste 8,95 malgre la virgule flottante', marque(8.95) === 8.95 && marque(0.1 + 8.85) === 8.95);
ok('rien a mesurer, pas de marque', marque(0) === null && marque(-1) === null);
ok('le vent se lit signe compris', lireVent(1.23) === '+1.2' && lireVent(-0.44) === '-0.4' && lireVent(0) === '0.0');

titre('la planche');
ok('au-dela de la ligne, mordu', jugerPlanche(-0.01) === 'mordu');
ok('sur la planche jusqu\'a 20 cm', jugerPlanche(0) === 'planche' && jugerPlanche(0.2) === 'planche');
ok('au-dela, la planche est manquee', jugerPlanche(0.3) === 'proche' && jugerPlanche(0.8) === 'loin');
ok('la fenetre d\'appel tient dans une foulee', APPEL_MAXI > 0.8 && APPEL_MAXI < 2.3);
ok('le pied se pose devant le corps', AVANCE_PIED > 0.2 && AVANCE_PIED < 0.5);
{
  const s = sauter({ vElan: 11, ecart: -0.02, angle: 21, avance: RAMENE_VISE });
  ok('un essai mordu ne se mesure pas', s.mordu && s.metres === 0 && s.marque === null);
  const a = sauter({ vElan: 11, ecart: 0, angle: 21, avance: RAMENE_VISE }).metres;
  const b = sauter({ vElan: 11, ecart: 0.30, angle: 21, avance: RAMENE_VISE }).metres;
  ok('la mesure part de la ligne : 30 cm d\'appel manque coutent 30 cm',
     Math.abs((a - b) - 0.30) < 1e-9, (a - b).toFixed(3));
}

titre('l\'angle — il pese autant que la planche');
{
  const o = optimum(11);
  ok('l\'optimum tombe ou tombent les finales (18 a 24°)', o.a >= 18 && o.a <= 24, `${o.a}°`);
  const perte = (a) => o.m - sauter({ vElan: 11, ecart: 0, angle: a, avance: RAMENE_VISE }).metres;
  ok('cinq degres de trop coutent au moins 25 cm', perte(o.a + 5) > 0.25, perte(o.a + 5).toFixed(2));
  ok('cinq degres de moins aussi', perte(o.a - 5) > 0.25, perte(o.a - 5).toFixed(2));
  ok('rasant (10°), plus d\'un metre perdu', perte(10) > 1.0, perte(10).toFixed(2));
  ok('en cloche (33°), plus d\'un metre et demi perdu', perte(33) > 1.5, perte(33).toFixed(2));
  let monte = true;
  for (let a = 10; a < 40; a++) if (perteImpulsion(a + 1) < perteImpulsion(a)) monte = false;
  ok('plus on cherche la hauteur, plus la planche freine', monte);
  ok('l\'angle monte avec le maintien, borne des deux cotes',
     angleDe(0) === ANGLE_MIN && angleDe(10) === ANGLE_MAX && angleDe(0.2) > angleDe(0.1));
  const tenue = (o.a - ANGLE_MIN) / ANGLE_PAR_S;
  ok('le bon angle se tient entre deux et quatre dixiemes', tenue >= 0.2 && tenue <= 0.4, tenue.toFixed(3));
  ok('le maintien le plus long reste court', TENUE_MAXI > 0.5 && TENUE_MAXI < 1.2);
}

titre('le vol');
{
  const v = vol(11, 21);
  ok('vitesse horizontale d\'un finaliste (8,7 a 9,6 m/s)', v.vx > 8.7 && v.vx < 9.6, v.vx.toFixed(2));
  ok('vitesse verticale d\'un finaliste (3 a 4 m/s)', v.vy > 3 && v.vy < 4, v.vy.toFixed(2));
  ok('le centre de masse monte a 1,7 - 2,1 m', v.sommet > 1.7 && v.sommet < 2.1, v.sommet.toFixed(2));
  ok('le vol dure moins d\'une seconde', v.duree > 0.7 && v.duree < 1.0, v.duree.toFixed(3));
  ok('et il retombe ou on l\'attend',
     Math.abs(hauteurA(v, v.duree) - HAUTEUR_RECEPTION) < 1e-9 && hauteurA(v, 0) === HAUTEUR_ENVOL);
}

titre('le record du monde, a la vitesse de celui qui l\'a saute');
{
  const o = optimum(11.1);
  ok('11,1 m/s d\'elan, tout juste : a moins de 10 cm de 8,95 m',
     Math.abs(o.m - RECORDS.hommes.m) < 0.10, o.m.toFixed(2));
  const lent = optimum(8).m, moyen = optimum(10).m, vite = optimum(11.6).m;
  ok('un elan d\'ecolier (8 m/s) : cinq a six metres', lent > 5 && lent < 6.2, lent.toFixed(2));
  ok('la portee croit plus vite que la vitesse', (vite - moyen) / 1.6 > (moyen - lent) / 2 * 0.95,
     `${lent.toFixed(2)} / ${moyen.toFixed(2)} / ${vite.toFixed(2)}`);
  const zeze = optimum(11.6 * 1.042).m;
  ok('au plafond du moteur, transition parfaite : le meilleur ZEZE se bat',
     zeze > PLATEAU[5][1] && zeze < PLATEAU[5][1] + 0.5, zeze.toFixed(2));
  ok('sans la transition, il ne se bat pas', optimum(11.6).m < PLATEAU[5][1], optimum(11.6).m.toFixed(2));
}

titre('le ramene');
{
  ok('au bon moment, parfait', jugerRamene(RAMENE_VISE).note === 'parfait');
  ok('jamais ramene : les pieds sous le bassin', jugerRamene(null).gain === RECEPTION.sans);
  ok('beaucoup trop tot : assis derriere ses talons', jugerRamene(RAMENE_VISE + 0.3).note === 'assis'
     && jugerRamene(RAMENE_VISE + 0.3).gain < 0);
  ok('trop tard : on perd, sans tomber en arriere', jugerRamene(RAMENE_VISE - 0.25).note === 'tard'
     && jugerRamene(RAMENE_VISE - 0.25).gain > 0);
  ok('le ciseau elargit la fenetre',
     jugerRamene(RAMENE_VISE + 0.06, true).note !== 'tot' && jugerRamene(RAMENE_VISE + 0.06, false).note !== 'parfait');
  const bon = sauter({ vElan: 11, ecart: 0, angle: 21, avance: RAMENE_VISE }).metres;
  const assis = sauter({ vElan: 11, ecart: 0, angle: 21, avance: RAMENE_VISE + 0.4 }).metres;
  ok('tomber en arriere coute plus d\'un demi-metre', bon - assis > 0.5, (bon - assis).toFixed(2));
}

titre('un seul defaut ne vaut pas tous les defauts');
{
  const parfait = sauter({ vElan: 11, ecart: 0.02, angle: 21, avance: RAMENE_VISE }).metres;
  const planche = sauter({ vElan: 11, ecart: 0.6, angle: 21, avance: RAMENE_VISE }).metres;
  const angle = sauter({ vElan: 11, ecart: 0.02, angle: 15, avance: RAMENE_VISE }).metres;
  const ramene = sauter({ vElan: 11, ecart: 0.02, angle: 21, avance: null }).metres;
  const tout = sauter({ vElan: 11, ecart: 0.6, angle: 15, avance: null }).metres;
  ok('chaque defaut seul coute entre 30 cm et 1 m',
     [planche, angle, ramene].every(m => parfait - m > 0.3 && parfait - m < 1.0),
     [planche, angle, ramene].map(m => (parfait - m).toFixed(2)).join(' / '));
  ok('les trois ensemble coutent plus que chacun', tout < Math.min(planche, angle, ramene));
}

titre('le vent');
{
  const a = sauter({ vElan: 11, ecart: 0, angle: 21, avance: RAMENE_VISE, vent: 0 }).metres;
  const b = sauter({ vElan: 11, ecart: 0, angle: 21, avance: RAMENE_VISE, vent: 2 }).metres;
  ok('+2 m/s dans le dos : une dizaine de centimetres', b - a > 0.05 && b - a < 0.15, (b - a).toFixed(3));
  const r = seme(7);
  const vents = Array.from({ length: 2000 }, () => tirerVent(r));
  const moy = vents.reduce((s, v) => s + v, 0) / vents.length;
  const trop = vents.filter(v => !homologable(v)).length / vents.length;
  ok('le vent de concours est faible et plutot favorable', moy > 0.2 && moy < 0.8, moy.toFixed(2));
  ok('il depasse +2,0 de temps en temps, pas souvent', trop > 0.01 && trop < 0.15, (trop * 100).toFixed(1) + ' %');
}

titre('les adversaires');
{
  for (let et = 0; et < 6; et++) {
    const r = seme(100 + et);
    const [lo, hi] = PLATEAU[et];
    let meilleurs = [];
    for (let k = 0; k < 300; k++) {
      const niveau = lo + r() * (hi - lo);
      let b = 0;
      for (let s = 0; s < 6; s++) { const x = essaiAdversaire(niveau, et, r); if (!x.mordu && x.metres > b) b = x.metres; }
      meilleurs.push(b);
    }
    const moy = meilleurs.reduce((s, v) => s + v, 0) / meilleurs.length;
    ok(`etape ${et} : les meilleures marques restent dans le plateau (${lo.toFixed(2)} - ${hi.toFixed(2)})`,
       moy > lo - 0.25 && moy < hi + 0.05 && Math.max(...meilleurs) < hi + 0.12, moy.toFixed(2));
  }
  ok('le plateau du championnat du monde reste sous le record',
     PLATEAU[3][1] < RECORDS.hommes.m && PLATEAU[4][1] <= RECORDS.hommes.m);
}

titre('le concours');
{
  const r = seme(42);
  const noms = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
  const c = nouveauConcours({ etape: 3, noms, alea: r });
  ok('douze en finale d\'un championnat du monde', c.athletes.length === CONCURRENTS[3] && CONCURRENTS[3] === 12);
  ok('huit a une rencontre scolaire', nouveauConcours({ etape: 0, noms, alea: r }).athletes.length === 8);
  ok('chacun passe une fois par tour', new Set(c.ordre).size === c.athletes.length);
  // Le joueur saute toujours 8,00 : il est en lice apres trois tours.
  let tourJoueur = 0;
  for (let garde = 0; garde < 100 && !c.fini; garde++) {
    avancerJusquAuJoueur(c, r);
    if (c.fini) break;
    const j = aQui(c);
    ok(`tour ${c.tour} : c'est bien au joueur`, c.athletes[j].joueur);
    tourJoueur++;
    inscrire(c, sauter({ vElan: 11, ecart: 0.1, angle: 21, avance: RAMENE_VISE }));
  }
  ok('le concours finit', c.fini);
  ok('le joueur a saute six fois', tourJoueur === 6, String(tourJoueur));
  ok('huit athletes seulement ont saute six fois',
     c.athletes.filter(a => a.essais.length === 6).length === 8);
  ok('les quatre autres ont saute trois fois',
     c.athletes.filter(a => a.essais.length === 3).length === 4);
  const cl = classement(c);
  let range = true;
  for (let k = 1; k < cl.length; k++) if (cl[k].meilleur > cl[k - 1].meilleur) range = false;
  ok('le classement suit les meilleures marques', range);
  ok('le joueur a une place', placeDuJoueur(c) >= 1 && placeDuJoueur(c) <= 12);
}
{
  // L'ORDRE DES TROIS DERNIERS TOURS : le premier saute en dernier.
  const r = seme(9);
  const c = nouveauConcours({ etape: 3, noms: 'ABCDEFGHIJK'.split(''), alea: r });
  let apresTrois = null;
  const vus = [];
  for (let garde = 0; garde < 200 && !c.fini; garde++) {
    const i = aQui(c);
    if (c.tour === 4) vus.push(i);
    if (c.athletes[i].joueur) inscrire(c, { mordu: true, metres: 0, marque: null });
    else inscrire(c, essaiAdversaire(c.athletes[i].niveau, 3, r));
    // Le classement a l'instant de la coupe, avant qu'un seul essai du
    // quatrieme tour ne le bouscule.
    if (c.tour === 4 && c.rang === 0 && !apresTrois) {
      apresTrois = classement(c).filter(x => c.coupe.includes(x.index)).map(x => x.index);
    }
  }
  ok('au quatrieme tour, huit athletes seulement', vus.length === 8, String(vus.length));
  ok('le dernier qualifie ouvre', apresTrois && vus[0] === apresTrois[apresTrois.length - 1]);
  ok('et le premier ferme', apresTrois && vus[vus.length - 1] === apresTrois[0]);
  ok('trois essais mordus : le joueur est coupe', c.coupe && !c.coupe.includes(0) && !joueurEnLice(c));
}
{
  // LES EX AEQUO se departagent a la deuxieme marque.
  const c = { athletes: [
    { nom: 'X', essais: [{ marque: 8.10 }, { marque: 7.90 }] },
    { nom: 'Y', essais: [{ marque: 8.10 }, { marque: 8.00 }] },
    { nom: 'Z', essais: [{ marque: 8.10 }, { marque: 8.00 }] },
  ], coupe: null };
  const cl = classement(c);
  ok('la deuxieme marque departage', cl[0].nom === 'Y' && cl[2].nom === 'X');
  ok('rien ne departage : la meme place', cl[0].place === 1 && cl[1].place === 1 && cl[2].place === 3);
  ok('les marques se lisent de la meilleure a la moins bonne',
     marquesDe(c.athletes[0]).join() === '8.1,7.9');
}

console.log('\n──────────────────────────────────────────────────────────────');
console.log(e ? `   ${e} ECHEC(S).` : '   TOUT PASSE.');
process.exit(e ? 1 : 0);
