// LE CADRAGE DES SCENES — ou poser la camera pour qu'un point du stade tombe a
// un endroit donne de l'ecran.
//
// Les scenettes et le generique en ont besoin tous les deux : le personnage
// d'une scenette se tient SUR la piste, au depart ou a l'arrivee, et le
// champion du tour d'honneur court dans son couloir, a gauche du texte. Dans
// les deux cas on connait le point du monde et la place qu'il doit prendre
// dans l'image ; il reste a trouver la camera.

/**
 * La camera qui pose le point du monde P a l'endroit S de l'ecran.
 *
 * La projection est lineaire en (P - camera) — rotation du virage comprise —
 * donc trois points suffisent a la lire, et un systeme deux-deux a l'inverser.
 * On la lit sur `ground` lui-meme plutot que de recopier ses constantes : une
 * retouche de la projection ne desaccordera jamais ce cadrage.
 *
 * `A` est SprinterApp. La camera est deplacee pendant la mesure : l'appelant
 * pose ensuite celle qu'on lui rend.
 */
export function cameraPour(A: any, P: number[], S: number[]): [number, number] {
  const G = A.G;
  G.camX = 0; G.camY = 0;
  const o = A.ground(0, 0), ex = A.ground(1, 0), ey = A.ground(0, 1);
  const a = ex[0] - o[0], c = ex[1] - o[1], b = ey[0] - o[0], d = ey[1] - o[1];
  const det = a * d - b * c || 1;
  const sx = S[0] - o[0], sy = S[1] - o[1];
  const dx = (d * sx - b * sy) / det, dy = (a * sy - c * sx) / det;
  return [P[0] - dx, P[1] - dy];
}
