// LA COURSE EN VRAIE 3D — du repere du jeu a celui du stade (decoupe de course-3d.ts, 11/11/2026).

import { calageSalle, estEnSalle } from '../salle-3d';
import { DROITE1, R_CORDE, LANE_W } from './reglages';
import { virageApresLigne } from './stade';

// (au 100 m ; sur un virage, la ligne droite d'un vrai stade, 84,39 m, l'arrivee au meme endroit)

// DU REPERE DU JEU A CELUI DU STADE. En ligne droite, ce sont les memes. Sur un
// demi-tour, le jeu met son virage autour de l'origine et la ligne droite a y = r :
// on le pousse jusqu'au virage du stade. Sur un tour complet, il finit sur l'autre
// ligne droite, en sens inverse (y = -r, cap -pi) : on le retourne d'un demi-tour.
export let sx = 1, x0 = 0, y0 = 0;
// LE STADE COUVERT DE VAL-DE-REUIL (salle-3d.ts) : son anneau releve et sa ligne droite centrale
export let salleActive = false;
export function caler(T: any) {
  salleActive = estEnSalle(T, (globalThis as any).SprinterApp?.G?.race);
  if (salleActive) { ({ sx, x0, y0 } = calageSalle(T)); return; }
  // (en ligne droite aussi, l'arrivee tombe sur le damier : le 110 m haies part 10 m plus tot, sinon sa
  // derniere haie etait a 4,02 m de la ligne peinte au lieu de 14,02 — l'auteur, 31/10)
  if (!T.curved) { sx = 1; x0 = DROITE1 - (T.total || 100); y0 = 0; }
  else if (T.fullLap) { sx = -1; x0 = DROITE1; y0 = -R_CORDE; }
  else { sx = 1; x0 = DROITE1 - T.straight; y0 = -R_CORDE; }
}
export const ici = (p: number[]) => [x0 + sx * p[0], y0 + sx * p[1]];
export const capIci = (c: number) => (sx < 0 ? c + Math.PI : c);
// LE DEPART AU MILIEU DU COULOIR (« les starting blocks ne sont pas au centre du couloir », l'auteur,
// 23/10) : en virage, le moteur fait courir sur la ligne de mesure, a 20-30 cm du bord interieur.
// La 3D pose blocs et coureurs au milieu du couloir, puis les ramene sur la ligne en dix metres.
export const milieu = (T: any, k: number) => {
  // (la piste couverte : couloirs de 0,90 m, ligne de mesure a 0,20 m)
  if (T.salle) return T.salle.couloir / 2 - (k ? T.salle.mesN : T.salle.mes1);
  const C = (globalThis as any).SprinterApp?.C;
  return T.curved && C ? LANE_W / 2 - (k ? C.MES_N : C.MES_1) : 0;
};
// LE PELOTON DU 400 M EN SALLE (piste-salle.js, rabattement) : passe la ligne, le moteur mesure tout le monde
// sur la ligne de mesure du couloir 1. Chacun y tient sa place en travers — la corde, l'epaule, le couloir 2
// (r.travers, sprinter-app.js, placerPeloton ; piste-salle.js, PELOTON), prise pendant la diagonale.
const enPeloton = (T: any, r: any, d: number) =>
  T.salle && T.salle.rabat ? T.rabattu(d, r.lane) * (r.travers || 0) : 0;
// APRES LA LIGNE, LE VIRAGE, DANS SON COULOIR (« les coureurs deccelerent tout en restant dans leurs couloirs »,
// l'auteur, 08/11/2026). Au 100 m et au 200 m, le moteur prolonge la piste tout droit apres l'arrivee ; le stade,
// lui, tourne : passe la ligne, chacun filait droit hors du virage, jusqu'au pied de la tribune — d'autant plus
// loin qu'il etait arrive tot. A l'image seulement, on suit donc le premier virage (centre (DROITE1, -R_CORDE),
// comme posLap2 au 400 m), chacun a son rayon. Rend l'angle deja tourne (0 avant la ligne).
export const virageApres = (T: any, lane: number, d: number) => {
  if (!virageApresLigne || salleActive || T.fullLap || !T.total || d <= T.total) return 0;
  return (d - T.total) / Math.max(1, ici(T.pos(T.total, lane))[1] + R_CORDE);
};
export const ouCourt = (T: any, r: any, d: number = r.d) => {
  const theta = virageApres(T, r.lane, d), dl = theta ? T.total : d;
  const u = Math.min(1, Math.max(0, dl / 10)), garde = 1 - u * u * (3 - 2 * u);
  const p = ici(T.posDemi(dl, r.lane, (r.demi || 0) + milieu(T, r.lane) * garde + enPeloton(T, r, dl)));
  if (!theta) return p;
  const rad = p[1] + R_CORDE;
  return [p[0] + rad * Math.sin(theta), -R_CORDE + rad * Math.cos(theta)];
};
