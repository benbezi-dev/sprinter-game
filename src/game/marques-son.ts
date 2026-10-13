// LE DUEL DES MARQUES — ce qu'on entend du face-a-face (13/10/2026).
//
// L'ouverture du duel (DuelMarques.tsx, `FaceAFace`) : Nike entre par la
// gauche, adidas par la droite, et le VS tombe entre les deux. Trois sons,
// FABRIQUES ici une fois, echantillon par echantillon, et ranges dans la table
// du moteur (`Audio_.buf`) comme le grognement du molosse — aucun fichier a
// charger, et `Audio_.sfx` respecte le son coupe par le joueur.
//
//   - LE SOUFFLE : un bruit qui monte et se resserre, le passage d'un panneau ;
//   - L'IMPACT : le VS qui s'ecrase — un coup grave qui chute de 110 a 38 Hz,
//     un claquement de bruit, et un tintement metallique qui s'eteint ;
//   - LE K.O. : deux coups secs et une note qui monte, quand un fantome adverse
//     tombe a l'arrivee.

import { SprinterApp } from './engine';

export const SOUFFLE = 'marques-souffle';
export const IMPACT = 'marques-impact';
export const KO = 'marques-ko';

function moteur(): any {
  const A = (SprinterApp as any);
  return A && A.Audio_ ? A.Audio_ : null;
}

/** Un alea reproductible : les memes sons a chaque fabrique. */
function alea(graine: number) {
  let g = graine;
  return () => (g = (g * 16807) % 2147483647) / 2147483647 * 2 - 1;
}

function normaliser(out: Float32Array, crete = 0.95) {
  let m = 0;
  for (let i = 0; i < out.length; i++) m = Math.max(m, Math.abs(out[i]));
  if (m > 0) for (let i = 0; i < out.length; i++) out[i] *= crete / m;
}

function souffle(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate, d = 0.42, n = Math.floor(d * sr);
  const buf = ctx.createBuffer(1, n, sr), out = buf.getChannelData(0);
  const r = alea(11);
  let lp = 0, bp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, x = t / d;
    // le filtre s'ouvre en passant : du sourd au siffle
    const a = 0.04 + 0.5 * x * x;
    lp += a * (r() - lp);
    bp = bp * 0.6 + (r() - lp) * 0.4;
    const env = Math.sin(Math.PI * Math.min(1, x * 1.15)) ** 2;
    out[i] = (lp * 0.8 + bp * 0.35 * x) * env;
  }
  normaliser(out, 0.8);
  return buf;
}

function impact(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate, d = 1.6, n = Math.floor(d * sr);
  const buf = ctx.createBuffer(1, n, sr), out = buf.getChannelData(0);
  const r = alea(29);
  let ph = 0, lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    // le coup grave qui chute
    const f = 38 + 72 * Math.exp(-t * 9);
    ph += f / sr;
    const grave = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 2.6);
    // le claquement : un bruit tres court, adouci
    lp += 0.35 * (r() - lp);
    const claque = lp * Math.exp(-t * 38) * 1.4;
    // le tintement : trois partiels inharmoniques, un gong bref
    const tinte = (Math.sin(2 * Math.PI * 523 * t) * 0.5 + Math.sin(2 * Math.PI * 1347 * t) * 0.3
                 + Math.sin(2 * Math.PI * 2210 * t) * 0.2) * Math.exp(-t * 5.5) * 0.35;
    // la saturation douce : un telephone rend mieux un coup « gros » que pur
    out[i] = Math.tanh((grave * 1.3 + claque + tinte) * 1.6);
  }
  normaliser(out);
  return buf;
}

function ko(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate, d = 1.1, n = Math.floor(d * sr);
  const buf = ctx.createBuffer(1, n, sr), out = buf.getChannelData(0);
  const r = alea(41);
  let ph = 0, lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let s = 0;
    // deux coups secs, a 0 et a 0,12 s
    for (const t0 of [0, 0.12]) {
      const u = t - t0;
      if (u >= 0) {
        lp += 0.3 * (r() - lp);
        s += (Math.sin(2 * Math.PI * (70 + 60 * Math.exp(-u * 20)) * u) * 0.9 + lp) * Math.exp(-u * 16);
      }
    }
    // la note qui monte, apres les coups
    const u = t - 0.24;
    if (u >= 0) {
      ph += (330 + 330 * Math.min(1, u / 0.25)) / sr;
      const sc = 2 * (ph - Math.floor(ph)) - 1;
      s += sc * 0.35 * Math.min(1, u / 0.02) * Math.exp(-u * 3.2);
    }
    out[i] = Math.tanh(s * 1.4);
  }
  normaliser(out, 0.9);
  return buf;
}

/** Fabriquer les trois sons, s'ils manquent. Sans contexte audio, rien. */
export function preparerSonsMarques(): boolean {
  const A = moteur();
  if (!A || !A.ctx || !A.buf) return false;
  try {
    if (!A.buf[SOUFFLE]) A.buf[SOUFFLE] = souffle(A.ctx);
    if (!A.buf[IMPACT]) A.buf[IMPACT] = impact(A.ctx);
    if (!A.buf[KO]) A.buf[KO] = ko(A.ctx);
    return true;
  } catch { return false; }
}

/** Jouer un des sons du duel, `delai` secondes plus tard. Muet si le joueur a coupe le son. */
export function jouer(nom: string, delai = 0, gain = 0.7) {
  const A = moteur();
  if (!A || !preparerSonsMarques()) return;
  try { A.sfx(nom, { gain, delay: delai }); } catch { /* muet */ }
}
