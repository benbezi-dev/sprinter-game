// Les briques sonores de Sprinter, recopiées à l'identique depuis
// src/game/sprinter-app.js (Audio_.tone, drum, norm, semi, blip, phrase) —
// pour composer hors du navigateur. Seul l'AudioBuffer est simulé.
export const TAU = Math.PI * 2;
export const SR = 48000;

export function tampon(secondes, sr = SR) {
  const data = new Float32Array(Math.ceil(secondes * sr));
  return { sampleRate: sr, length: data.length, getChannelData: () => data };
}

export const Audio_ = {
  tone(d, t0, dur, f, amp, wave, decay) {
    const sr = d.sampleRate, ch = d.getChannelData(0);
    const i0 = (t0 * sr) | 0, n = (dur * sr) | 0;
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const k = i0 + i; if (k >= ch.length) break;
      ph += f / sr; const p = ph - (ph | 0);
      let s;
      if (wave === 'sq') s = p < 0.5 ? 1 : -1;
      else if (wave === 'saw') s = 2 * p - 1;
      else if (wave === 'tri') s = 4 * Math.abs(p - 0.5) - 1;
      else if (wave === 'pulse') s = p < 0.25 ? 1 : -1;
      else s = Math.sin(TAU * p);
      let env = Math.exp(-decay * i / sr);
      if (i < 120) env *= i / 120;
      ch[k] += amp * env * s;
    }
  },
  drum(d, t0, kind) {
    const sr = d.sampleRate, ch = d.getChannelData(0);
    const i0 = (t0 * sr) | 0;
    const n = ((kind === 'k' ? 0.16 : kind === 's' ? 0.13 : 0.05) * sr) | 0;
    let ph = 0, seed = 12345;
    for (let i = 0; i < n; i++) {
      const k = i0 + i; if (k >= ch.length) break;
      const q = i / n;
      seed = (Math.imul(1103515245, seed) + 12345) & 0x7fffffff;
      const nz = seed / 0x3fffffff - 1;
      if (kind === 'k') {
        ph += (118 * Math.exp(-5.2 * q) + 42) / sr;
        ch[k] += 0.9 * Math.exp(-7 * q) * Math.sin(TAU * ph);
      } else if (kind === 's') {
        ph += 190 / sr;
        ch[k] += 0.42 * Math.exp(-13 * q) * (0.72 * nz + 0.28 * Math.sin(TAU * ph));
      } else {
        ch[k] += 0.15 * Math.exp(-42 * i / sr) * nz;
      }
    }
  },
  norm(d) {
    const ch = d.getChannelData(0);
    let pk = 0;
    for (let i = 0; i < ch.length; i++) pk = Math.max(pk, Math.abs(ch[i]));
    const g = pk > 0.001 ? 0.86 / pk : 1;
    const fade = (0.006 * d.sampleRate) | 0;
    for (let i = 0; i < ch.length; i++) {
      let v = ch[i] * g;
      if (v > 1) v = 1; else if (v < -1) v = -1;
      if (i < fade) v *= i / fade;
      else if (i > ch.length - fade) v *= (ch.length - i) / fade;
      ch[i] = v;
    }
    return d;
  },
  semi(s, oct) { return 55 * Math.pow(2, (oct || 2) - 1) * Math.pow(2, s / 12); },
  phrase(notes, oct, wave) {
    const sr = SR;
    const fin = notes.reduce((m, n) => Math.max(m, n[1] + n[2]), 0);
    const d = tampon(fin + 0.3);
    notes.forEach(n => {
      this.tone(d, n[1], n[2], this.semi(n[0], oct), 0.34, wave || 'tri', 2.0);
      this.tone(d, n[1], n[2], this.semi(n[0], oct + 1), 0.15, 'sin', 2.4);
      this.tone(d, n[1], n[2], this.semi(n[0], oct - 1), 0.18, 'sq', 3.0);
    });
    return this.norm(d);
  },
  buf: {},
};

// Les bruitages de build(), mêmes paramètres.
const blip = (f, dur, amp, glide) => {
  const b = tampon(dur), ch = b.getChannelData(0); let ph = 0;
  for (let i = 0; i < ch.length; i++) {
    const q = i / ch.length;
    ph += f * (1 + (glide - 1) * q) / SR;
    ch[i] = amp * Math.exp(-6 * q) * Math.min(1, i / 90) * Math.sin(TAU * ph);
  }
  return Audio_.norm(b);
};
Audio_.buf.beep = blip(660, 0.16, 0.3, 1);
Audio_.buf.go = blip(1050, 0.34, 0.34, 1.3);
Audio_.buf.coeur = blip(58, 0.2, 0.55, 0.72);
Audio_.buf.fanfare = Audio_.phrase([
  [0, 0.00, 0.16], [4, 0.15, 0.16], [7, 0.30, 0.16],
  [12, 0.45, 0.22], [7, 0.68, 0.14], [12, 0.83, 0.85],
], 3);

export function ecrireWav(chemin, out, sr, crete = 0.89) {
  let pk = 0; for (let i = 0; i < out.length; i++) pk = Math.max(pk, Math.abs(out[i]));
  const g = crete / pk, n = out.length, buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(out[i] * g * 32767))), 44 + i * 2);
  return import('node:fs').then(fs => { fs.writeFileSync(chemin, buf); return pk; });
}
