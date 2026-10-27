// LA PISTE COUVERTE — le stade couvert Jesse Owens, Val-de-Reuil.
//
// L'auteur, 25/10 : « la piste fait 200 m avec les virages releves, le 400 m fait
// deux tours » ; virages releves, 6 couloirs sur l'anneau, 8 sur la ligne droite
// centrale (le 60 m ; les blocs numerotes de 1 a 8 aux France U18-U20 de 2026). Couloirs de 0,90 m, ligne
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
// (Compare le 26/10 au gabarit « Standard Short Track » de World Athletics — 35,368 m, raccord
// puis arc de 17,205 m, couloirs de 1,00 m, 10° constants : l'auteur a garde celui-ci.)
//
// LE 400 M SE RABAT (l'auteur, 27/10 : « le 2e tour se fait sur un couloir, tous les athletes se
// rabattent ») : en couloirs jusqu'a la sortie du second virage, puis a la corde (voir rabattement).
// shortcut: au dernier tour, tout le monde court sur la ligne de mesure du couloir 1 — le moteur n'a pas
// d'evitement entre coureurs : deux athletes a la meme distance s'y superposent.

const DROITE_SALLE = 35, MES = 0.2, COULOIR = 0.9, NC = 6;
let H = 17.2, A = H;                                  // la demi-largeur et la demi-longueur interieures
// le bord interieur : l'ellipse (demi-axes A, H), parametree par son cap tourne psi
const tEll = (psi) => Math.atan2(A * Math.sin(psi), H * Math.cos(psi));
const base = (psi) => { const u = tEll(psi); return [A * Math.sin(u), H * Math.cos(u)]; };
const courbure = (psi) => { const u = tEll(psi), c = Math.cos(u), s = Math.sin(u); return Math.pow(A * A * c * c + H * H * s * s, 1.5) / (A * H); };

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
// la demi-longueur qui donne 65 m au couloir 1
{
  let lo = H * 0.8, hi = H * 2;
  for (let i = 0; i < 50; i++) { A = (lo + hi) / 2; tables.clear(); if (longueurVirage(MES) < 65) lo = A; else hi = A; }
  tables.clear();
}

// LE RELEVEMENT (salle-3d.ts le dessine, le moteur en tire la pente qui ralentit et relance le coureur).
// LA PENTE SE RAIDIT VERS L'EXTERIEUR (« les couloirs du dessus ont un pourcentage de montee et
// descente de plus en plus fort », l'auteur, 26/10) : 10° au bord interieur, 18° au bord du
// sixieme couloir (15° en moyenne sur les couloirs exterieurs), puis 18° jusqu'au muret.
// shortcut: angles a caler sur les cotes reelles quand on les aura (la recherche est en cours).
const ALPHA0 = 10 * Math.PI / 180, ALPHA1 = 18 * Math.PI / 180, LARGE = NC * COULOIR;
/** La hauteur du revetement plein-releve a d metres du bord interieur (la pente tourne de ALPHA0 a ALPHA1). */
export function profil(d) {
  if (d <= 0) return 0;
  const k = (ALPHA1 - ALPHA0) / LARGE, dd = Math.min(d, LARGE);
  // (pente constante : k nul, la formule se reduit a d x tan)
  const plein = Math.abs(k) < 1e-9 ? dd * Math.tan(ALPHA0) : (Math.log(Math.cos(ALPHA0)) - Math.log(Math.cos(ALPHA0 + k * dd))) / k;
  return plein + Math.max(0, d - LARGE) * Math.tan(ALPHA1);
}
/** Une marche douce de a a b (derivees nulles aux deux bouts). */
export const lisse = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * t * (t * (t * 6 - 15) + 10); };
// le releve monte sur le premier tiers du virage, redescend sur le dernier (« trop sec », 26/10)
export const RAMPE = Math.PI / 3;
/** La hauteur du revetement au cap phi d'un virage, a d metres du bord interieur. */
const hauteur = (phi, d) => profil(d) * lisse(0, RAMPE, Math.min(phi, Math.PI - phi));
// LA PENTE DANS LE CHRONO (« le chrono du 200 m est plus ou moins bon par rapport a l'effort fourni, la
// montee et la descente des virages » ; « les chronos indoor sur 200 et 400 sont plus difficiles, dus aux
// virages et a la gestion du rythme dans les montees et descentes », l'auteur, 27/10). Mesure avant : le
// moteur ignorait le releve, le joueur courait le 200 m en salle 0,15 s seulement au-dessus du plein air a
// dix appuis par seconde. La montee freine (g x pente x MONTE), la descente rend moins (DESCEND), et le
// RYTHME compte (Runner.stepPlayer) : une cadence tenue dans la montee y perd moins, la descente ne rend que
// ce qu'on y tient. Calees sur le 200 m : le joueur a dix appuis y perd 3,5 % (l'ecart des records du monde,
// salle contre plein air : 19,92 / 19,19), 5 % a huit appuis, 2 % a treize. Au 400 m, la meme pente ne
// coute que 1,8 % (44,52 / 43,03 en donnerait 3,5) : la doubler pour lui rendrait le 200 m trop lent
// (tools/piste-salle-test.mjs mesure les deux).
const PENTE = { monte: 7, descend: 3.5 };
// LE PELOTON DU 400 M : passe la ligne, tout le monde rejoint la corde — chacun a son ecart vers l'exterieur
// (0 a 1,25 m), pris pendant la diagonale. Et les ACCROCHAGES (« sur le 400 m les accrochages sont possibles
// au 2e tour, il peut y avoir du contact », l'auteur, 27/10) : a moins de LONG metres l'un de l'autre et de
// LARGE en travers, c'est le contact — le joueur y laisse GARDE de sa vitesse et titube, une fois par REPIT.
const PELOTON = [0, 0.5, 1.0, 0.25, 0.75, 1.25];
const CONTACT = { long: 0.9, large: 0.55, garde: 0.93, repit: 1.5 };

/**
 * LE RABATTEMENT DU 400 M (l'auteur, 27/10 ; sa source, non verifiee : « ligne de rabattement a la sortie
 * du second virage, environ 150 m apres le depart, ligne verte ; apres elle, les coureurs rejoignent la
 * corde, le second tour se court en peloton »). Le plan de 2009 ne la montre pas : elle est posee a la
 * sortie du second virage, au debut de la ligne droite d'arrivee — 165 m au couloir 1 ici (65 + 35 + 65).
 * Chaque couloir y court dans son couloir, rejoint la corde en diagonale sur la ligne droite, puis fait
 * son dernier tour au couloir 1 : son depart (u0, en metres apres l'arrivee sur sa boucle) est cale pour
 * que tout le monde coure exactement `total`.
 */
export function rabattement(d, total) {
  const B = longueurVirage(d), tour = 2 * DROITE_SALLE + 2 * B;
  const tour1 = 2 * DROITE_SALLE + 2 * longueurVirage(MES), diag = Math.hypot(DROITE_SALLE, d - MES);
  const avant = total - diag - Math.round((total - tour1) / tour1) * tour1;   // jusqu'a la ligne
  return { avant, diag, u0: 2 * B + DROITE_SALLE - avant, tour, d1: MES };
}

export const SALLE = {
  rayon: H, couloir: COULOIR, mes1: MES, mesN: MES,
  couloirs: NC, couloirsDroite: 8,   // (la ligne droite centrale : 8 couloirs aux France 2026 ; 6 sur le plan de 2009)
  inclinaison: 15 * Math.PI / 180,   // en moyenne : la pente se raidit vers l'exterieur (salle-3d.ts, profil)
  demiLong: A,
  virage, capVirage, longueurVirage, phiVirage, surVirage, hauteur, rabattement, pente: PENTE,
  peloton: PELOTON, contact: CONTACT,
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
    salle: { ...SALLE, tours: 2, rabat: true }, total: 400,
    arc: ARC, straight: DROITE, maxSpeed: 11.45, best: 37.40,
    ranges: plus(R400, 1.015),
  },
};
export const EST_EN_SALLE = (cle) => !!COURSES_EN_SALLE[cle];
