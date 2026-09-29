/* ---------------------------------------------------------------------------
   JUMPER — la vue de profil
   ---------------------------------------------------------------------------
   UN SAUT SE REGARDE DE PROFIL. C'est ainsi que la television le montre, et
   c'est le seul angle ou l'on voit ce qui compte : la hauteur du vol, l'angle
   d'envol, la cambrure au-dessus de la barre, les jambes qui passent devant.

   On ne tourne pas la camera pour autant. La projection du moteur est une
   isometrie fixe, et les tribunes, le public et les decors sont rendus pour
   elle : les tourner les montrerait de travers. Mais dans cette isometrie, UNE
   direction du monde tombe exactement a l'horizontale de l'ecran — la
   diagonale (-1, +1). Un sautoir pose le long d'elle est vu de profil, et le
   stade reste le stade, en arriere-plan.

   Les sautoirs gardent donc leurs coordonnees de toujours — la piste d'elan le
   long de x, la fosse devant, la barre en travers —, et ce module les tourne
   dans le monde autour d'un pivot. Tout ce qui les lit passe par lui :

     - le coureur, que le moteur dessine au monde, et que le jeu du saut fait
       avancer dans ses coordonnees a lui (`poser`, `avec`) ;
     - le rendu du sautoir, qui recoit une `api` dont `ground`, `solid` et
       `depthOf` tournent d'abord le point (`api`) ;
     - la camera, et la zone ou le decor ne se pose pas.

   Le jeu du saut n'a pas change d'une ligne pour autant : il ne sait pas qu'il
   est tourne.
--------------------------------------------------------------------------- */

/** L'angle du monde qui tombe a l'horizontale de l'ecran, vers la droite. */
export const PROFIL = 135 * Math.PI / 180;

/**
 * Un repere de sautoir : `rot` tourne le sautoir dans le monde, autour de
 * `pivotLocal` pose en `pivotMonde`. `laneW` est la largeur d'un couloir : le
 * moteur place le coureur a `LANE_W / 2 + demi` de la corde.
 */
export function creerVue({ rot, pivotLocal, pivotMonde, laneW }) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const monde = (x, y) => {
    const dx = x - pivotLocal[0], dy = y - pivotLocal[1];
    return [pivotMonde[0] + dx * c - dy * s, pivotMonde[1] + dx * s + dy * c];
  };
  const local = (X, Y) => {
    const dx = X - pivotMonde[0], dy = Y - pivotMonde[1];
    return [pivotLocal[0] + dx * c + dy * s, pivotLocal[1] - dx * s + dy * c];
  };
  // L'etat LOCAL du coureur, tant qu'il est pose au monde. Nul quand le
  // coureur est dans ses coordonnees de sautoir.
  let garde = null;
  let apiVue = null, apiSource = null;

  const poser = (j) => {
    garde = { j, d: j.d, demi: j.demi || 0, cap: j.cap || 0 };
    const [X, Y] = monde(j.d, laneW * 0.5 + (j.demi || 0));
    j.d = X;
    j.demi = Y - laneW * 0.5;
    j.cap = garde.cap + rot;
  };

  return {
    rot, monde, local,
    /** Le coureur passe du sautoir au monde, ou le moteur le dessine. */
    poser,
    /**
     * Faire quelque chose dans les coordonnees du sautoir : le coureur y
     * revient le temps de `fn`, puis retourne au monde.
     */
    avec(j, fn) {
      if (!j || !garde || garde.j !== j) return fn();
      j.d = garde.d; j.demi = garde.demi; j.cap = garde.cap;
      garde = null;
      try { return fn(); } finally { poser(j); }
    },
    /** Un coureur neuf : l'ancien n'a plus rien a garder. */
    oublier() { garde = null; },
    /** L'api du rendu, tournee : le sautoir se dessine dans ses coordonnees. */
    api(api) {
      if (apiSource !== api || !apiVue) {
        apiSource = api;
        apiVue = {
          ...api,
          ground: (x, y) => { const p = monde(x, y); return api.ground(p[0], p[1]); },
          solid: (x, y, z) => { const p = monde(x, y); return api.solid(p[0], p[1], z); },
          depthOf: (x, y) => { const p = monde(x, y); return api.depthOf(p[0], p[1]); },
          rot,
        };
      }
      return apiVue;
    },
    /** La boite du monde qui contient ces points du sautoir, et une marge. */
    zone(points, marge = 2) {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const [x, y] of points) {
        const p = monde(x, y);
        x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]);
        y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
      }
      // Dans la pelouse, la zone s'arrete au bord de la piste (y = 0). Au-dela
      // du dernier couloir, le sautoir le long de la ligne droite, elle n'a
      // pas de piste a epargner.
      return { x0: x0 - marge, x1: x1 + marge, y0: y0 - marge, y1: y0 < 0 ? Math.min(0, y1 + marge) : y1 + marge };
    },
  };
}
