// LES POSTURES DES EXERCICES — ce que le corps du moteur ne sait pas faire en
// courant : le squat, la planche, les educatifs, le bond.
//
// Une posture imposee (pose(), sprinter-core.js, `r.posture`) donne les angles
// ABSOLUS de chaque membre — 0 vers le bas, positif vers l'avant —, le buste
// (negatif : penche en avant), la hauteur du bassin (`leve`, en unites du rig)
// et son recul sur les pieds (`hanche`). `w` est le poids de la posture : la
// foulee y entre et en sort sans a-coup. `jambes[0]` et `bras[0]` sont du cote
// de la phase de foulee 0 (le cote vu par la camera).

type Jambe = [number, number, number];
type Bras = [number, number];
export type Posture = { w: number; jambes?: [Jambe, Jambe]; bras?: [Bras, Bras]; buste?: number; leve?: number; hanche?: number };

const debout: Jambe = [0.02, 0, 0];

export const POSTURES = {
  /** Le squat, de 0 (debout) a 1 (cuisses paralleles) : la barre derriere la nuque. */
  squat(p: number): Posture {
    const d = Math.max(0, Math.min(1.1, p));
    const jambe: Jambe = [1.45 * d, -0.55 * d, 0.3 * d];
    // les mains tiennent la barre posee sur les trapezes : le bras monte en arriere, l'avant-bras revient vers la nuque
    const bras: Bras = [-1.75, -3.0];
    return { w: 1, jambes: [jambe, jambe], bras: [bras, bras], buste: -0.55 * d, leve: -0.42 * d, hanche: -0.22 * d };
  },
  /** La planche sur les avant-bras : le corps a l'horizontale, `tremble` en radians. */
  gainage(tremble = 0): Posture {
    // le bassin a la hauteur des epaules (~0,35 m) : les jambes descendent juste ce qu'il faut vers les pointes de pied
    const j: Jambe = [-1.2 + tremble, -1.2 + tremble, -1.45];
    return { w: 1, jambes: [j, j], bras: [[0.0, 1.57], [0.0, 1.57]], buste: -1.57 + tremble, leve: -0.5, hanche: -0.3 };
  },
  /** Montee de genoux : `cote` 1 (genou du cote vu) ou -1 ; `h` de 0 a 1. */
  genoux(cote: number, h = 1): Posture {
    const haut: Jambe = [1.5 * h, 0.1, 0.3];
    const j: [Jambe, Jambe] = cote > 0 ? [haut, debout] : [debout, haut];
    const ba: Bras = [-0.9 * h, 0.4], bb: Bras = [0.7 * h, 1.8];
    return { w: 1, jambes: j, bras: cote > 0 ? [ba, bb] : [bb, ba], buste: 0.05, leve: 0.06 * h };
  },
  /** Talons-fesses : le talon monte sous la fesse. */
  talons(cote: number, h = 1): Posture {
    const haut: Jambe = [0.15 * h, -2.5 * h, -0.4 * h];
    const j: [Jambe, Jambe] = cote > 0 ? [haut, debout] : [debout, haut];
    const ba: Bras = [-0.6 * h, 0.9], bb: Bras = [0.5 * h, 1.6];
    return { w: 1, jambes: j, bras: cote > 0 ? [ba, bb] : [bb, ba], buste: -0.08, leve: 0.03 * h };
  },
  /** Un bondissement : `t` de 0 (appel) a 1 (reception), jambe d'attaque `cote`. */
  bond(t: number, cote: number): Posture {
    const s = Math.sin(Math.PI * Math.max(0, Math.min(1, t)));
    const attaque: Jambe = [1.1 * s + 0.2, 0.2 - 0.5 * s, 0.2], pousse: Jambe = [-0.6 * s - 0.1, -0.9 * s, -0.5 * s];
    const j: [Jambe, Jambe] = cote > 0 ? [attaque, pousse] : [pousse, attaque];
    const ba: Bras = [1.2 * s, 2.0], bb: Bras = [-0.9 * s, -0.4];
    return { w: 1, jambes: j, bras: cote > 0 ? [bb, ba] : [ba, bb], buste: -0.18, leve: 0.25 * s };
  },
};
