// La sonnerie d'une invitation en direct : deux notes montantes, deux fois.
// Fabriquee ici comme les sons du menu (ui-son.ts) : rien a charger, et
// `Audio_.sfx` respecte le son coupe.

import { SprinterApp, buzz } from './engine';

const SON = 'sonnerie-direct';

function fabriquer(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate, n = Math.floor(1.05 * sr);
  const buf = ctx.createBuffer(1, n, sr), out = buf.getChannelData(0);
  // (debut s, duree s, frequence Hz)
  const notes: [number, number, number][] = [
    [0.00, 0.16, 784], [0.18, 0.22, 1175],
    [0.55, 0.16, 784], [0.73, 0.28, 1175],
  ];
  for (const [t0, d, f] of notes) {
    const i0 = Math.floor(t0 * sr), m = Math.floor(d * sr);
    for (let i = 0; i < m && i0 + i < n; i++) {
      const t = i / sr;
      const env = Math.min(1, t * 400) * Math.exp(-t * 7);
      const onde = Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t);
      out[i0 + i] += onde * env * 0.45;
    }
  }
  return buf;
}

/** Fait sonner et vibrer le telephone. */
export function sonnerDefiDirect() {
  const A = (SprinterApp as any)?.Audio_;
  try {
    if (A?.ctx && A.buf) {
      if (!A.buf[SON]) A.buf[SON] = fabriquer(A.ctx);
      A.sfx(SON, { gain: 0.6 });
    }
  } catch { /* sans son, il reste la carte et la vibration */ }
  buzz(120);
  setTimeout(() => buzz(120), 360);
  setTimeout(() => buzz(220), 720);
}

/** L'onglet clignote tant que la page n'est pas regardee. Rend de quoi l'arreter. */
export function clignoterOnglet(texte: string): () => void {
  const origine = document.title;
  let allume = false;
  const id = setInterval(() => {
    allume = document.hidden && !allume;
    document.title = allume ? texte : origine;
  }, 1000);
  return () => { clearInterval(id); document.title = origine; };
}

// L'invitation en direct et le defi de relais se posent au meme endroit :
// le relais attend que le direct soit tranche.
let directVisible = false;
const abonnes = new Set<() => void>();
export function poserDirectVisible(v: boolean) {
  if (directVisible === v) return;
  directVisible = v;
  for (const f of abonnes) f();
}
export const directEstVisible = () => directVisible;
export function abonnerDirectVisible(f: () => void) {
  abonnes.add(f);
  return () => { abonnes.delete(f); };
}
