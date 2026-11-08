// LES SONS DU MENU (l'auteur, 02/11/2026) : « un son pour le choix et un son pour la selection ».
//
// Fabriques ici echantillon par echantillon, comme ceux du Duel des marques (marques-son.ts),
// et ranges dans la table du moteur (`Audio_.buf`) : aucun fichier a charger, et `Audio_.sfx`
// respecte le son coupe par le joueur.
//
//   - LE CHOIX : basculer plein air / salle. Un « tchk » court et feutre — un bruit filtre
//     tres bref et une note haute qui s'eteint en 60 ms. On le joue souvent : il doit s'oublier.
//   - LA SELECTION : cocher une epreuve. Un « pop » rond qui monte (520 -> 880 Hz) avec une
//     quinte legere par-dessus. Decocher rejoue le meme, plus bas (rate 0,75).

import { SprinterApp } from './engine';

export const SON_CHOIX = 'ui-choix';
export const SON_SELECTION = 'ui-selection';

function moteur(): any {
  const A = SprinterApp as any;
  return A && A.Audio_ ? A.Audio_ : null;
}

function choix(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate, n = Math.floor(0.09 * sr);
  const buf = ctx.createBuffer(1, n, sr), out = buf.getChannelData(0);
  let g = 12345, lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    g = (g * 16807) % 2147483647;
    const bruit = (g / 2147483647) * 2 - 1;
    lp += 0.35 * (bruit - lp);                       // bruit adouci
    const clic = (bruit - lp) * Math.exp(-t * 180);  // l'attaque, tres breve
    const note = Math.sin(2 * Math.PI * 1760 * t) * Math.exp(-t * 55) * 0.5;
    out[i] = (clic * 0.6 + note) * Math.min(1, t * 2000);
  }
  return buf;
}

function selection(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate, n = Math.floor(0.16 * sr);
  const buf = ctx.createBuffer(1, n, sr), out = buf.getChannelData(0);
  let phase = 0, phase2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const f = 520 + 360 * (1 - Math.exp(-t * 40));    // glisse vers le haut
    phase += (2 * Math.PI * f) / sr;
    phase2 += (2 * Math.PI * f * 1.5) / sr;
    const env = Math.min(1, t * 900) * Math.exp(-t * 26);
    out[i] = (Math.sin(phase) + 0.22 * Math.sin(phase2)) * env * 0.8;
  }
  return buf;
}

function preparer(): any {
  const A = moteur();
  if (!A || !A.ctx || !A.buf) return null;
  try {
    if (!A.buf[SON_CHOIX]) A.buf[SON_CHOIX] = choix(A.ctx);
    if (!A.buf[SON_SELECTION]) A.buf[SON_SELECTION] = selection(A.ctx);
    return A;
  } catch { return null; }
}

/** Le « tchk » du choix (plein air / salle). Muet si le son est coupe. */
export function sonChoix() {
  const A = preparer();
  try { A?.sfx(SON_CHOIX, { gain: 0.32 }); } catch { /* muet */ }
}

/** Le « pop » de la selection ; `oui` a false = on decoche (plus bas). */
export function sonSelection(oui = true) {
  const A = preparer();
  try { A?.sfx(SON_SELECTION, { gain: 0.4, rate: oui ? 1 : 0.75 }); } catch { /* muet */ }
}
