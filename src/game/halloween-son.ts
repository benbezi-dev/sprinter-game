// LA NUIT DU MOLOSSE — ce qu'on entend de la bete.
//
// LE GROGNEMENT DU DEPART SURPRIS (09/10). Sur les nuits ou l'on part debout
// et surpris (voir `depart` dans halloween-loi.js), le coureur attend dans le
// silence, puis la bete gronde derriere lui — et seulement ensuite vient le
// decompte. Le jeu n'avait aucun son de molosse : celui-ci est FABRIQUE ici,
// echantillon par echantillon, une fois, et pose dans la table des sons du
// moteur (`Audio_.buf`) comme un fichier qu'on aurait charge.
//
// CE QUI FAIT UN GROGNEMENT, et dans cet ordre :
//   - UNE VOIX TRES GRAVE, en dents de scie autour de 60 Hz, qui derive un
//     peu : une gorge, pas un oscillateur ;
//   - LE RACLEMENT, une modulation d'amplitude vers 28 Hz : c'est lui qui fait
//     « rrrr » au lieu d'un bourdon ;
//   - DU SOUFFLE, un bruit filtre grave, melange a la voix ;
//   - LA MONTEE : la derniere demi-seconde, la voix grimpe et s'ouvre — la
//     bete passe du grondement au rugissement, et c'est la que le coeur saute.
// Le tout passe par deux filtres passe-bas pour qu'il n'en reste que la
// masse : un telephone le rend par son haut-parleur, ou les aigus mentent.

import { SprinterApp } from './engine';

export const GROGNEMENT = 'molosse-grogne';
/** Sa duree, en secondes : le depart surpris attend sa fin pour compter. */
export const DUREE_GROGNEMENT = 1.9;

function moteur(): any {
  const A = (SprinterApp as any);
  return A && A.Audio_ ? A.Audio_ : null;
}

/**
 * Fabriquer le grognement et le ranger dans la table des sons, s'il n'y est
 * pas deja. Sans contexte audio — il n'existe qu'apres un premier geste — on
 * ne fait rien : le depart surpris se passe alors du son, pas de l'image.
 */
export function preparerLeGrognement(): boolean {
  const A = moteur();
  if (!A || !A.ctx || !A.buf) return false;
  if (A.buf[GROGNEMENT]) return true;
  const ctx: AudioContext = A.ctx;
  const sr = ctx.sampleRate, n = Math.floor(DUREE_GROGNEMENT * sr);
  const buf = ctx.createBuffer(1, n, sr);
  const out = buf.getChannelData(0);
  let phase = 0, lp1 = 0, lp2 = 0, bruit = 0, graine = 7;
  const alea = () => (graine = (graine * 16807) % 2147483647) / 2147483647 * 2 - 1;
  let crete = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const fin = Math.max(0, (t - (DUREE_GROGNEMENT - 0.55)) / 0.55);   // la montee
    // la gorge : 58 Hz qui derive, puis grimpe a la fin
    const f0 = 58 + 6 * Math.sin(t * 2.3) + 4 * Math.sin(t * 7.1) + 70 * fin * fin;
    phase += f0 / sr;
    const scie = 2 * (phase - Math.floor(phase)) - 1;
    // le souffle : un bruit adouci
    bruit = bruit * 0.97 + alea() * 0.03;
    let s = scie * 0.7 + bruit * 9 * (0.5 + 0.8 * fin);
    // le raclement
    const racle = 0.35 + 0.65 * Math.abs(Math.sin(Math.PI * (27 + 6 * fin) * t));
    s *= racle;
    // deux passe-bas : il ne reste que la masse (s'ouvrent un peu a la fin)
    const a = 0.10 + 0.10 * fin;
    lp1 += a * (s - lp1);
    lp2 += a * (lp1 - lp2);
    // l'enveloppe : il monte du silence, gronde, rugit, s'arrete net
    const env = Math.min(1, t / 0.35) * (0.55 + 0.45 * fin) * Math.min(1, (DUREE_GROGNEMENT - t) / 0.08);
    out[i] = lp2 * env;
    crete = Math.max(crete, Math.abs(out[i]));
  }
  if (crete > 0) for (let i = 0; i < n; i++) out[i] *= 0.92 / crete;
  A.buf[GROGNEMENT] = buf;
  return true;
}
