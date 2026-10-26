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
// Repere neutre d'un virage : il bombe vers +X, X = 0 aux deux raccords ; phi est le cap
// tourne depuis le raccord cote Y > 0 (0 a pi).
//
// DEUX FORMES, pour comparer (l'auteur, 26/10 : « montre-moi les deux ») :
//  - l'actuelle : le bord interieur en demi-ellipse (largeur du plan), 35 m + 65 m ;
//  - ?anneau=wa : le gabarit « Standard Short Track » de World Athletics (plan de marquage S,
//    2026) — 35,368 m de ligne droite, un arc de raccord puis l'arc constant de 17,205 m
//    (11,939 m par quart au bord), couloirs de 1,00 m, ligne de course a 0,30 m, 10° constants.
//    Le rayon du raccord est resolu pour que la ligne de course fasse 200 m.
//
// shortcut: le 400 m reste en couloirs sur ses deux tours (depart en quinconce sur
// quatre virages) au lieu de se rabattre apres le premier tour : le moteur n'a pas
// d'evitement entre coureurs.

const WA = (() => { try { return new URLSearchParams(location.search).get('anneau') === 'wa'; } catch { return false; } })();
const DROITE_SALLE = WA ? 35.368 : 35, MES = WA ? 0.3 : 0.2, COULOIR = WA ? 1.0 : 0.9;
// la forme du bord interieur, au cap tourne psi : son point et son rayon de courbure
let H = 17.2, A = H;                                  // la demi-largeur et la demi-longueur interieures
let base, courbure;
if (WA) {
  const R = 17.205, TC = 11.939 / R, TT = Math.PI / 2 - TC;     // l'arc constant, le cap pris par le raccord
  // la ligne de course (0,30 m) fait 200 m : 2 droites + 4 x (raccord + quart constant) + 2 pi x 0,30
  const R1 = ((200 - 2 * DROITE_SALLE - 2 * Math.PI * MES) / 4 - R * TC) / TT;
  H = R1 - (R1 - R) * Math.cos(TT);
  const c2x = (R1 - R) * Math.sin(TT);
  A = c2x + R;
  base = (psi) => {
    const s = Math.sin(psi), c = Math.cos(psi);
    if (psi <= TT) return [R1 * s, H - R1 + R1 * c];
    if (psi >= Math.PI - TT) return [R1 * s, -(H - R1) + R1 * c];
    return [c2x + R * s, R * c];
  };
  courbure = (psi) => (psi <= TT || psi >= Math.PI - TT ? R1 : R);
} else {
  // l'ellipse (demi-axes A, H), parametree par son cap tourne
  const t = (psi) => Math.atan2(A * Math.sin(psi), H * Math.cos(psi));
  base = (psi) => { const u = t(psi); return [A * Math.sin(u), H * Math.cos(u)]; };
  courbure = (psi) => { const u = t(psi), c = Math.cos(u), s = Math.sin(u); return Math.pow(A * A * c * c + H * H * s * s, 1.5) / (A * H); };
}

/** Le point du virage au cap tourne phi, a d metres du bord interieur (repere neutre). */
function virage(phi, d) {
  const b = base(phi);
  return [b[0] + d * Math.sin(phi), b[1] + d * Math.cos(phi)];
}
/** Le cap tourne depuis le raccord (0 a pi) : c'est le parametre lui-meme. */
const capVirage = (phi) => phi;
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
/** Le cap phi atteint apres u metres depuis le raccord phi = 0, a d metres du bord. */
function phiVirage(u, d) {
  const t = table(d);
  if (u <= 0) return 0;
  if (u >= t[N_ARC]) return Math.PI;
  let lo = 0, hi = N_ARC;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (t[m] < u) lo = m; else hi = m; }
  return Math.PI * (lo + (u - t[lo]) / (t[hi] - t[lo])) / N_ARC;
}
/** Le point du virage le plus proche de (X, Y) (repere neutre, X >= 0) : son cap et l'ecart au bord. */
function surVirage(X, Y) {
  let phi = Math.max(0, Math.min(Math.PI, Math.atan2(X / A, Y / H)));
  for (let i = 0; i < 6; i++) {
    const b = base(phi);
    // (la tangente : (cos, -sin) ; le pas : la projection sur elle, divisee par la courbure)
    phi += ((X - b[0]) * Math.cos(phi) - (Y - b[1]) * Math.sin(phi)) / courbure(phi);
    phi = Math.max(0, Math.min(Math.PI, phi));
  }
  const b = base(phi);
  return { phi, d: (X - b[0]) * Math.sin(phi) + (Y - b[1]) * Math.cos(phi) };
}
// l'actuelle : la demi-longueur qui donne 65 m au couloir 1
if (!WA) {
  let lo = H * 0.8, hi = H * 2;
  for (let i = 0; i < 50; i++) { A = (lo + hi) / 2; tables.clear(); if (longueurVirage(MES) < 65) lo = A; else hi = A; }
  tables.clear();
}

export const SALLE = {
  rayon: H, couloir: COULOIR, mes1: MES, mesN: MES,
  couloirs: 6, couloirsDroite: 6,
  inclinaison: 15 * Math.PI / 180,   // en moyenne : la pente se raidit vers l'exterieur (salle-3d.ts, profil)
  demiLong: A, wa: WA,
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
