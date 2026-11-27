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

/**
 * UN ADVERSAIRE VA SAUTER : le sauteur du moteur `j` prend son nom (qui choisit
 * son corps, course-3d/corps.ts), sa tenue et son dossard, et le joueur attend
 * a sa place au bord de la piste. Rend la liste des coureurs a poser dans
 * G.runners. `moi` garde le joueur debout d'un saut a l'autre ({ r }).
 */
export function prendreSaPlace({ Runner, PLAYER_LOOK, attente, moi, j, nom, total, laneW }) {
  const place = attente.findIndex((r) => r.name === nom);
  const lui = place >= 0 ? attente[place] : new Runner(nom, 0, { total });
  j.name = nom; j.look = lui.look; j.dossard = lui.dossard || 9;
  j.adversaire = true;   // pas de fleche « TOI » au-dessus de lui (GameCanvas)
  if (place < 0) return [j, ...attente];
  if (!moi.r) {
    [moi.r] = athletesEnAttente(Runner, ['TOI'], { total, laneW, x0: 0, y: 0, cap: lui.cap });
    moi.r.look = PLAYER_LOOK; moi.r.dossard = 1;
  }
  moi.r.d = lui.d; moi.r.demi = lui.demi;
  return [j, ...attente.map((r, k) => (k === place ? moi.r : r))];
}
