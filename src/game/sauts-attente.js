/* ---------------------------------------------------------------------------
   JUMPER — les adversaires au bord du sautoir (27/11/2026)
   ---------------------------------------------------------------------------
   Les autres sauteurs du concours ne sont plus seulement une liste : ils se
   tiennent debout au bord de la piste d'elan, chacun avec son maillot, et
   regardent le joueur sauter. Ce sont des coureurs du moteur (memes corps,
   memes tenues que les sept du 100 m) marques `attend` : le moteur ne les fait
   pas courir (engine.ts). Leur essai reste tire par le jeu (avancerJusquAuJoueur).
--------------------------------------------------------------------------- */

/** Au plus sept corps de plus que le joueur, comme une finale de 100 m : le telephone le plus faible les tient deja. */
export const ATTENTE_MAX = 7;

/**
 * Les adversaires debout, en rang, du point (x0, y) dans la direction `dir`
 * (radians), espaces de `pas` metres, tournes de `cap`. Coordonnees du monde.
 */
export function athletesEnAttente(Runner, noms, { total, laneW, x0, y, dir = 0, pas = 1.1, cap = 0 }) {
  return (noms || []).slice(0, ATTENTE_MAX).map((nom, k) => {
    const r = new Runner(nom, 0, { total });
    r.attend = true;
    r.lane = 0; r.v = 0; r.drivePitch = 0;
    r.d = x0 + Math.cos(dir) * pas * k;
    r.demi = y + Math.sin(dir) * pas * k - laneW * 0.5;
    r.cap = cap;
    r.dossard = k + 2;   // le joueur porte le 1
    // deux gestes d'attente chacun, decales (sprinter-core.js, attitude ; sprinter-app.js, phaseBlocs)
    const k1 = Math.floor(Math.random() * 6);
    r.attitudes = [k1, (k1 + 1 + Math.floor(Math.random() * 5)) % 6];
    r.attDecal = Math.random() * 10;
    return r;
  });
}
