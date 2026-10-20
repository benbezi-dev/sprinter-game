// L'AURA DES NIVEAUX DIVINS — l'Olympe et l'apotheose (20/10).
//
// L'auteur : les musiques de ces niveaux « ne sonnent pas divin, pas assez
// d'aura ». race3 decline (race3-lieux.js) reste la course ; on pose dessus
// ce qui fait un temple :
//   - un CHOEUR qui tient les accords en « aah », par trois voix desaccordees
//     (une table d'onde par note, ses harmoniques pesees par les formants
//     d'un « a » chante) ;
//   - un HALO aigu, la quinte et l'octave tout en haut, qui scintille ;
//   - une HARPE qui monte l'accord au debut de chaque tour ;
//   - une GRANDE REVERBERATION ou passent le choeur, la harpe ET le refrain du
//     lieu (rejoue dans l'envoi seulement : le refrain sec reste devant).
// Tout s'ecrit modulo la longueur du tampon : la musique boucle, et la queue
// de la reverberation retombe sur le debut, sans couture.
//
// Pur : le jeu l'applique au morceau fini (musiques.ts), l'outil d'ecoute
// aussi (tools/musique/legende-race3.mjs). `jouer(nom, d, t, dur, f, a)` est
// l'instrument du moteur (Audio_.instrument), `semi(s, oct)` sa frequence.

const TAU = Math.PI * 2;

/** Une periode de « aah » a la frequence f : harmoniques pesees par trois formants. */
function tableDeVoix(f, sr, n = 1024) {
  const t = new Float32Array(n);
  const H = Math.max(1, Math.min(18, Math.floor(Math.min(6000, sr / 2.2) / f)));
  const formant = (x, c, l) => Math.exp(-(((x - c) / l) ** 2));
  let pk = 0;
  for (let h = 1; h <= H; h++) {
    const x = h * f;
    const w = 0.25 / h + formant(x, 800, 260) + 0.7 * formant(x, 1150, 300) + 0.25 * formant(x, 2900, 450);
    for (let i = 0; i < n; i++) t[i] += w * Math.sin(TAU * h * i / n);
  }
  for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(t[i]));
  for (let i = 0; i < n; i++) t[i] /= pk || 1;
  return t;
}

/** Une note tenue du choeur, de t0 pendant dur secondes, ecrite en boucle dans ch. */
function voix(ch, sr, t0, dur, f, amp) {
  const tab = tableDeVoix(f, sr), N = tab.length, L = ch.length;
  const i0 = (t0 * sr) | 0, n = (dur * sr) | 0;
  const att = 0.35 * sr, rel = 0.5 * sr;
  const ecarts = [-0.004, 0, 0.0045];
  const ph = [0.1, 0.4, 0.7];
  for (let i = 0; i < n; i++) {
    let env = 1;
    if (i < att) env = Math.sin((i / att) * Math.PI / 2) ** 2;
    if (i > n - rel) env *= Math.max(0, (n - i) / rel);
    const vib = 1 + 0.0035 * Math.sin(TAU * 5.1 * i / sr);
    let s = 0;
    for (let v = 0; v < 3; v++) {
      ph[v] += (f * (1 + ecarts[v]) * vib) / sr;
      const p = ph[v] - Math.floor(ph[v]);
      s += tab[(p * N) | 0];
    }
    ch[(i0 + i) % L] += amp * env * s / 3;
  }
}

/** Un sinus doux qui scintille (tremolo lent), en boucle. */
function halo(ch, sr, t0, dur, f, amp) {
  const L = ch.length, i0 = (t0 * sr) | 0, n = (dur * sr) | 0, att = 0.6 * sr;
  for (let i = 0; i < n; i++) {
    let env = i < att ? i / att : 1;
    if (i > n - att) env *= Math.max(0, (n - i) / att);
    const trem = 0.6 + 0.4 * Math.sin(TAU * 3.3 * i / sr);
    ch[(i0 + i) % L] += amp * env * trem * Math.sin(TAU * f * i / sr);
  }
}

/**
 * La reverberation (Schroeder : quatre peignes amortis en parallele, deux
 * passe-tout en serie), CIRCULAIRE : deux tours de tampon, on ne garde que le
 * second, quand la queue du tour precedent est deja retombee sur le debut.
 */
function* reverberer(src, sr, sortie, gain) {
  const L = src.length, k = sr / 44100;
  const peignes = [1557, 1617, 1491, 1422].map((x) => ({ buf: new Float32Array((x * k) | 0), i: 0, lp: 0 }));
  const passes = [556, 225].map((x) => ({ buf: new Float32Array((x * k) | 0), i: 0 }));
  const FB = 0.86, AMORTI = 0.25;
  for (let tour = 0; tour < 2; tour++) {
    for (let j = 0; j < L; j++) {
      const x = src[j];
      let y = 0;
      for (const c of peignes) {
        const o = c.buf[c.i];
        c.lp = o * (1 - AMORTI) + c.lp * AMORTI;
        c.buf[c.i] = x + c.lp * FB;
        if (++c.i >= c.buf.length) c.i = 0;
        y += o;
      }
      for (const a of passes) {
        const o = a.buf[a.i];
        a.buf[a.i] = y + o * 0.5;
        y = o - y * 0.5;
        if (++a.i >= a.buf.length) a.i = 0;
      }
      if (tour === 1) sortie[j] += y * gain;
      if ((j & 8191) === 8191) yield;
    }
  }
}

/** Ajoute l'aura au morceau d (deja fabrique). Le rendre normalise reste a l'appelant. */
export function* auree(d, cfg, jouer, semi) {
  const sr = d.sampleRate, ch = d.getChannelData(0), L = ch.length;
  const beat = 60 / cfg.bpm, bar = beat * 4;
  const sec = new Float32Array(L);                 // choeur, halo, harpe : secs et reverberes
  const envoi = new Float32Array(L);               // le refrain, reverbere seulement
  const tSec = { sampleRate: sr, length: L, getChannelData: () => sec };
  const tEnvoi = { sampleRate: sr, length: L, getChannelData: () => envoi };
  const A = cfg.aura;
  for (let b = 0; b < cfg.prog.length; b++) {
    const [root, tri] = cfg.prog[b], t = b * bar;
    // le choeur : l'accord au medium, la fondamentale une octave plus haut
    for (const n of tri) { voix(sec, sr, t, bar * 1.12, semi(root + n, 3), 0.11 * A); yield; }
    voix(sec, sr, t, bar * 1.12, semi(root + 12, 3), 0.08 * A); yield;
    // le halo : quinte et octave, tout en haut
    halo(sec, sr, t, bar * 1.05, semi(root + tri[2], 6), 0.020 * A);
    halo(sec, sr, t, bar * 1.05, semi(root + 12, 6), 0.016 * A);
    yield;
    // le refrain du lieu, dans l'envoi — plafonne : l'anche d'Hermes, dense
    // et carree, faisait monter la reverberation de 6 dB au-dessus des autres
    for (const c of (cfg.couches || [])) {
      for (const [s, x, l] of c.melodie[b % c.melodie.length]) jouer(c.instrument, tEnvoi, t + x * beat, l * beat, semi(s, c.octave), Math.min(c.amp * 0.6, 0.12));
      yield;
    }
  }
  // la harpe, au debut du tour : l'accord monte sur deux octaves en un temps
  const [r0, t0] = cfg.prog[0];
  const notes = [0, 1, 2].flatMap((o) => t0.map((n) => r0 + n + 12 * o)).concat([r0 + 36]);
  notes.forEach((s, i) => jouer('cloche', tSec, i * beat / notes.length, beat * 1.5, semi(s, 4), 0.05 * A));
  yield;
  // tout ce qui est hors du tampon (jouer n'ecrit pas en boucle) est perdu :
  // rien n'y depasse, la harpe est au debut et le refrain dans ses mesures
  for (let j = 0; j < L; j++) envoi[j] += sec[j];
  yield;
  yield* reverberer(envoi, sr, ch, 0.11 * A);
  for (let j = 0; j < L; j++) ch[j] += sec[j];
  return d;
}
