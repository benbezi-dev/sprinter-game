// LA PISTE COUVERTE — le stade couvert Jesse Owens, Val-de-Reuil.
//
// L'auteur, 25/10 : « la piste fait 200 m avec les virages releves, le 400 m fait
// deux tours » ; virages a 15 degres, 6 couloirs sur l'anneau, 6 aussi sur la ligne
// droite centrale (le 60 m ; le plan de la salle, img-010). Couloirs de 0,90 m, ligne
// de mesure a 0,20 m de la ligne au couloir 1 et au-dela.
//
// LA FORME (l'auteur, 26/10 : « deux lignes droites de 35 m + deux virages de 65 m,
// plus ou moins longs selon le couloir ») : avec la largeur interieure du plan
// (34,40 m), un virage de 65 m n'est pas un demi-cercle — il est allonge. Le bord
// interieur de chaque virage est une demi-ellipse : demi-largeur RAYON (17,20 m)
// en travers, demi-longueur `demiLong` dans l'axe, calculee pour que la ligne de
// mesure du couloir 1 fasse 65 m. Les autres couloirs sont ses paralleles (a d metres
// du bord interieur). Le moteur (sprinter-core.js, Track.boucle) et le decor
// (salle-3d.ts) tirent tout de ces fonctions.
//
// Repere neutre d'un virage : il bombe vers +X, X = 0 aux deux raccords ; phi va de
// 0 (raccord cote Y > 0) a pi (raccord cote Y < 0).
//
// shortcut: le 400 m reste en couloirs sur ses deux tours (depart en quinconce sur
// quatre virages) au lieu de se rabattre apres le premier tour : le moteur n'a pas
// d'evitement entre coureurs.

const RAYON = 17.2, DROITE_SALLE = 35, VIRAGE_SALLE = 65, MES = 0.2;
let A = RAYON;                     // la demi-longueur du virage (resolue plus bas)

/** Le point du virage a l'angle phi, a d metres du bord interieur (repere neutre). */
function virage(phi, d) {
  const s = Math.sin(phi), c = Math.cos(phi), nx = RAYON * s, ny = A * c, n = Math.hypot(nx, ny) || 1;
  return [A * s + d * nx / n, RAYON * c + d * ny / n];
}
/** Le cap tourne depuis le raccord (0 a pi) : celui du bord interieur, que ses paralleles partagent. */
const capVirage = (phi) => Math.atan2(RAYON * Math.sin(phi), A * Math.cos(phi));
// les longueurs cumulees le long d'un virage, par parallele (au millimetre)
const N_ARC = 720, tables = new Map();
function table(d) {
  const k = Math.round(d * 1000);
  let t = tables.get(k);
  if (!t) {
    t = new Float64Array(N_ARC + 1);
    let p = virage(0, d);
    for (let i = 1; i <= N_ARC; i++) { const q = virage(Math.PI * i / N_ARC, d); t[i] = t[i - 1] + Math.hypot(q[0] - p[0], q[1] - p[1]); p = q; }
    if (tables.size > 400) tables.clear();
    tables.set(k, t);
  }
  return t;
}
/** La longueur du virage a d metres du bord interieur. */
const longueurVirage = (d) => table(d)[N_ARC];
/** L'angle phi atteint apres u metres depuis le raccord phi = 0, a d metres du bord. */
function phiVirage(u, d) {
  const t = table(d);
  if (u <= 0) return 0;
  if (u >= t[N_ARC]) return Math.PI;
  let lo = 0, hi = N_ARC;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (t[m] < u) lo = m; else hi = m; }
  return Math.PI * (lo + (u - t[lo]) / (t[hi] - t[lo])) / N_ARC;
}
/** Le point du virage le plus proche de (X, Y) (repere neutre, X >= 0) : son angle et l'ecart au bord. */
function surVirage(X, Y) {
  let phi = Math.atan2(X / A, Y / RAYON);
  for (let i = 0; i < 4; i++) {
    const bx = A * Math.sin(phi), by = RAYON * Math.cos(phi), tx = A * Math.cos(phi), ty = -RAYON * Math.sin(phi);
    phi += ((X - bx) * tx + (Y - by) * ty) / (tx * tx + ty * ty);
    phi = Math.max(0, Math.min(Math.PI, phi));
  }
  const b = virage(phi, 0), n = virage(phi, 1);
  return { phi, d: (X - b[0]) * (n[0] - b[0]) + (Y - b[1]) * (n[1] - b[1]) };
}
// la demi-longueur qui donne 65 m au couloir 1
{
  let lo = RAYON * 0.8, hi = RAYON * 2;
  for (let i = 0; i < 50; i++) { A = (lo + hi) / 2; tables.clear(); if (longueurVirage(MES) < VIRAGE_SALLE) lo = A; else hi = A; }
  tables.clear();
}

export const SALLE = {
  rayon: RAYON, couloir: 0.9, mes1: MES, mesN: MES,
  couloirs: 6, couloirsDroite: 6,
  inclinaison: 15 * Math.PI / 180,   // en moyenne : la pente se raidit vers l'exterieur (salle-3d.ts, profil)
  demiLong: A,
  virage, capVirage, longueurVirage, phiVirage, surVirage,
};
/** La ligne droite de l'anneau. */
export const DROITE = DROITE_SALLE;
const ARC = longueurVirage(MES);

/** Les plateaux d'une epreuve en salle : ceux du plein air, un peu plus lents en virage serre. */
const plus = (ranges, k) => ranges.map(([a, b]) => [Math.round(a * k * 100) / 100, Math.round(b * k * 100) / 100]);
const R200 = [[25.00, 30.00], [22.40, 25.00], [20.00, 21.00], [19.16, 20.00], [19.16, 19.70], [17.75, 18.00]];
const R400 = [[55.00, 60.00], [49.00, 55.00], [44.50, 49.00], [43.50, 44.50], [43.18, 43.50], [36.70, 37.00]];

export const COURSES_EN_SALLE = {
  '60': {
    key: '60', label: '60 METRES', sub: 'la ligne droite en salle', salleDroite: true, couloirs: SALLE.couloirsDroite,
    arc: 0, straight: 60, maxSpeed: 12.435, best: 5.70,
    ranges: [[7.80, 9.00], [7.10, 7.80], [6.75, 7.00], [6.55, 6.75], [6.50, 6.65], [6.30, 6.45]],
  },
  '200s': {
    key: '200s', label: '200 METRES EN SALLE', sub: 'un tour d’anneau',
    salle: { ...SALLE, tours: 1 }, total: 200,
    arc: ARC, straight: DROITE, maxSpeed: 11.9, best: 18.60,
    ranges: plus(R200, 1.02),
  },
  '400s': {
    key: '400s', label: '400 METRES EN SALLE', sub: 'deux tours d’anneau',
    salle: { ...SALLE, tours: 2 }, total: 400,
    arc: ARC, straight: DROITE, maxSpeed: 11.45, best: 37.40,
    ranges: plus(R400, 1.015),
  },
};
export const EST_EN_SALLE = (cle) => !!COURSES_EN_SALLE[cle];
