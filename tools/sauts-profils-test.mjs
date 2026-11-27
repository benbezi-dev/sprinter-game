// Les profils d'athletes (src/game/sauts-profils.js), verifies contre les mesures publiees.
//
//   node tools/sauts-profils-test.mjs
//
// Les fourchettes sont les officielles (l'auteur, 27/11) : rapports World Athletics de
// Londres 2017, Koyama 2008 (Tokyo 1991), Lu & Wang 2005 (Edwards). Detail :
// references-sauts/DESIGN-SAUTS.md.

import { PROFILS_LONGUEUR, TRIPLE_CALIBRE, STYLES_LONGUEUR, STYLES_TRIPLE } from '../src/game/sauts-profils.js';
import { sauter, vol, optimumDe, essaiAdversaire, nouveauConcours, avancerJusquAuJoueur, RAMENE_VISE } from '../src/game/longueur-jeu.js';
import { sauterTriple, essaiTripleAdversaire, PLATEAU_TRIPLE } from '../src/game/triple-jeu.js';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);
const entre = (x, a, b) => x >= a && x <= b;
const f2 = x => x.toFixed(2);

titre('longueur : chaque style retombe sur sa mesure');
const attendu = {
  vitesse: { angle: [19, 21.5], m: [8.60, 8.91] },     // Lewis : envol rasant, 8,91 (vent +2,9) a Tokyo
  envol: { angle: [22.5, 25], m: [8.50, 8.95] },       // Powell : envol haut, 8,95
  precision: { angle: [21, 23], m: [8.40, 8.60] },     // Manyonga, Londres 2017 : 22,0°, 8,48
};
for (const k of STYLES_LONGUEUR) {
  const P = PROFILS_LONGUEUR[k], o = optimumDe(k), v = vol(P.vApproche, o.angle, P);
  const a = attendu[k];
  ok(`${P.style} : optimum a ${o.angle.toFixed(1)}° (attendu ${a.angle.join('-')}°)`, entre(o.angle, ...a.angle));
  ok(`${P.style} : ${f2(o.metres)} m au meilleur geste (attendu ${a.m.join('-')})`, entre(o.metres, ...a.m));
  // WA 2017 : perte de vitesse horizontale a l'appel entre -0,53 et -2,80 m/s, Vy 3,0-4,0
  ok(`${P.style} : perte a l'appel ${f2(v.perte)} m/s, vy ${f2(v.vy)} (WA 2017 : 0,53-2,80 / Osaka 3,01-3,78 ±0,2)`, entre(v.perte, 0.53, 2.80) && entre(v.vy, 2.8, 4.0));
}
// sur tout l'eventail jouable, la perte reste dans la fourchette officielle
for (const k of STYLES_LONGUEUR) {
  const P = PROFILS_LONGUEUR[k];
  // a trois degres de part et d'autre de son optimum (au-dela, on sort de son style)
  const o = optimumDe(k).angle, pertes = [o - 3, o, o + 3].map(a => vol(P.vApproche, a, P).perte);
  ok(`${P.style} : de ${(o - 3).toFixed(0)} a ${(o + 3).toFixed(0)}°, perte ${pertes.map(f2).join(' / ')} m/s dans 0,5-2,8`, pertes.every(p => entre(p, 0.5, 2.8)));
}
// Lewis avec son vent de Tokyo (+2,9 m/s) : autour de 8,91
{
  const P = PROFILS_LONGUEUR.vitesse, o = optimumDe('vitesse');
  const m = sauter({ vElan: P.vApproche, ecart: 0, angle: o.angle, avance: RAMENE_VISE, ciseau: true, vent: 2.9, profil: P }).metres;
  ok(`Vitesse avec +2,9 m/s de vent : ${f2(m)} m (Lewis, Tokyo : 8,91)`, entre(m, 8.75, 9.00));
}

titre('triple : les bonds mesures sont rendus');
const triples = {
  elastique: { m: [17.50, 18.30], parts: [33.1, 28.5, 38.4] },   // Edwards, 18,29
  amplitude: { m: [14.90, 15.74], parts: [34.7, 26.3, 39.0] },   // Rojas : 15,02 effectif a Londres
};
for (const k of STYLES_TRIPLE) {
  const P = TRIPLE_CALIBRE[k], a = triples[k];
  const r = sauterTriple({ vElan: P.vApproche, ecart: 0, angles: P.angles, poses: [0, 0], avance: RAMENE_VISE, ciseau: true, profil: P });
  const tot = r.bonds.reduce((x, y) => x + y, 0), parts = r.bonds.map(b => 100 * b / tot);
  ok(`${P.style} : ${f2(r.metres)} m (attendu ${a.m.join('-')})`, entre(r.metres, ...a.m));
  ok(`${P.style} : bonds ${r.bonds.map(f2).join(' / ')} m, soit ${parts.map(p => p.toFixed(1)).join(' / ')} % (mesure ${a.parts.join(' / ')} ±3)`,
    parts.every((p, i) => Math.abs(p - a.parts[i]) <= 3));
  ok(`${P.style} : le saut est le plus long des trois bonds`, r.bonds[2] === Math.max(...r.bonds));
  // les envols mesures sont retrouves a 5 cm/s pres
  const vx = r.vitesses.slice(1), mes = P.envols.map(x => x[0]);
  // (Rojas ne perd rien de son cloche-pied a son pas : le jeu garde ses 1,5 % de pose active)
  ok(`${P.style} : vx d'envol ${vx.map(f2).join(' / ')} (mesure ${mes.join(' / ')}, ±0,15)`, vx.every((v, i) => Math.abs(v - mes[i]) <= 0.15));
  // un appui ecrase coute : la meme chose avec la pose du pas 0,2 s en retard
  const ecrase = sauterTriple({ vElan: P.vApproche, ecart: 0, angles: P.angles, poses: [0, 0.2], avance: RAMENE_VISE, ciseau: true, profil: P });
  ok(`${P.style} : un pas ecrase coute ${f2(r.metres - ecrase.metres)} m (> 0,3)`, r.metres - ecrase.metres > 0.3);
}

titre('les adversaires a style');
let alea = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
for (const k of STYLES_LONGUEUR) {
  const essais = Array.from({ length: 400 }, () => essaiAdversaire(8.40, 3, alea, k));
  const bons = essais.filter(x => !x.mordu).map(x => x.metres);
  const moy = bons.reduce((a, b) => a + b, 0) / bons.length;
  ok(`${PROFILS_LONGUEUR[k].style} : niveau 8,40 -> moyenne ${f2(moy)}, max ${f2(Math.max(...bons))}, ${Math.round(100 * (1 - bons.length / 400))} % de mordus`,
    entre(moy, 7.6, 8.4) && Math.max(...bons) <= 8.40 * 1.01);
}
{
  const mordus = (k) => Array.from({ length: 2000 }, () => essaiAdversaire(8.40, 3, alea, k)).filter(x => x.mordu).length;
  ok('la Précision mord moins que l\'Envol', mordus('precision') < mordus('envol'));
}
for (const k of STYLES_TRIPLE) {
  const essais = Array.from({ length: 400 }, () => essaiTripleAdversaire(17.2, 3, alea, k));
  const bons = essais.filter(x => !x.mordu).map(x => x.metres);
  ok(`${TRIPLE_CALIBRE[k].style} : niveau 17,20 -> ${bons.length} essais valables sur 400, max ${f2(Math.max(...bons))}`, bons.length > 200 && Math.max(...bons) <= 17.2 * 1.02);
}
{
  const c = nouveauConcours({ etape: 3, noms: ['A', 'B', 'C', 'D', 'E', 'F'], alea });
  const faits = avancerJusquAuJoueur(c, alea);
  ok(`un concours distribue les styles (${c.athletes.filter(a => !a.joueur).map(a => a.style).join(', ')})`, c.athletes.filter(a => !a.joueur).every(a => STYLES_LONGUEUR.includes(a.style)));
  ok('et ses adversaires sautent avec', faits.length > 0 && faits.every(f => f.essai.style));
  const t = nouveauConcours({ etape: 3, noms: ['A', 'B', 'C'], alea, plateau: PLATEAU_TRIPLE, styles: STYLES_TRIPLE });
  t.essai = essaiTripleAdversaire;
  const ft = avancerJusquAuJoueur(t, alea);
  ok('au triple aussi', ft.length > 0 && ft.every(f => STYLES_TRIPLE.includes(f.essai.style)));
}

console.log('\n' + '─'.repeat(62) + `\n   ${e ? e + ' ECHEC(S).' : 'TOUT PASSE.'}`);
process.exit(e ? 1 : 0);
