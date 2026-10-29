// LE FAUX DEPART SE VOIT (« provoque le mouvement franc du personnage pour que l'on voie le faux
// depart ; le personnage se tient ensuite la tete et adopte une attitude de deception », l'auteur,
// 24/10). Le moteur figeait la piste a l'instant du faux depart : le joueur restait dans ses blocs,
// et rien ne disait qu'il etait parti. Il jaillit donc des blocs — deux metres quatre-vingts,
// le buste bas qui se redresse, en freinant jusqu'a l'arret —, puis se prend la tete a deux mains,
// coudes ouverts, les yeux au sol, et se balance d'un pied sur l'autre.
//
// Tout passe par ce que pose() sait deja lire : `d` et `stride` pour la foulee, `enBloc` et
// `drivePitch` pour la sortie des blocs, `posture` (angles absolus, 0 vers le bas, positif vers
// l'avant ; buste negatif vers l'avant ; tete negative les yeux baisses ; roulis des bras
// positif vers l'axe du corps) pour la deception. Les autres restent dans leurs blocs.
import { SprinterApp } from './engine';

const doux = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const mel = (a: number, b: number, u: number) => a + (b - a) * u;

/** Ce qu'il parcourt, et quand il s'arrete (s). */
const COURSE = 2.8, ARRET = 1.5;
/** Quand les mains montent a la tete, et quand elles y sont (s). */
const MAINS0 = 1.1, MAINS1 = 2.0;

export function jouerLeFauxDepart(dt: number) {
  const G = (SprinterApp as any).G, C = (SprinterApp as any).C;
  const r = G && G.player;
  if (!r || !dt) return;
  G.falseOutT = (G.falseOutT || 0) + dt;
  const t = G.falseOutT;
  if (r.fauxD0 == null) r.fauxD0 = r.d || 0;

  // LE DEPART FRANC : vite au premier appui, puis il freine (une parabole qui s'aplatit)
  const u = Math.min(1, t / ARRET), avant = r.d;
  r.d = r.fauxD0 + COURSE * (1 - (1 - u) * (1 - u));
  r.v = (r.d - avant) / dt;
  if (r.v > 0 && typeof r.strideLength === 'function') r.stride = (r.stride || 0) + r.v * dt * Math.PI / r.strideLength();
  r.enBloc = 1 - doux(t / 0.25);
  r.drivePitch = (C ? C.DRIVE_PITCH : 0.62) * (1 - doux(t / ARRET));

  // LA DECEPTION : debout, les mains montent sur la tete, la tete basse qui dodeline
  const w = doux((t - 0.9) / 0.6), m = doux((t - MAINS0) / (MAINS1 - MAINS0));
  const bal = Math.sin(t * 2.1);
  const repos: [number, number] = [0.06, 0.28], tete: [number, number] = [2.55, 4.45];
  const bras: [number, number] = [mel(repos[0], tete[0], m), mel(repos[1], tete[1], m)];
  r.posture = {
    w,
    jambes: [[0.07 + 0.03 * bal, 0.05, 0], [-0.07 + 0.03 * bal, -0.05, 0]],
    bras: [bras, bras],
    buste: mel(0.02, -0.1, m),
    leve: -0.01 * Math.abs(bal),
    tete: mel(0.05, -0.38 + 0.07 * Math.sin(t * 1.3), m),
    // les coudes s'ouvrent (loin de l'axe), les avant-bras reviennent sur le crane (vers l'axe)
    roule: [mel(0, -0.45, m), mel(0, 0.7, m)],
  };
}

/** Hors du faux depart, le joueur rend sa posture. */
export function rangerLeFauxDepart() {
  const G = (SprinterApp as any).G, r = G && G.player;
  if (!r || r.fauxD0 == null) return;
  r.fauxD0 = null; r.posture = null;
}
