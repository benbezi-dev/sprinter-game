// LES MUSIQUES DES DESTINATIONS DE LA LEGENDE, DECLINEES DE race3 (18/10).
//
// L'auteur : « dans le style de la course des ZEZE (race3), le theme du pays
// bien marque, qui reste en tete, qui colle au personnage ». La reference
// n'est pas un fichier : race3 est fabrique par le moteur (fabriquerCourse,
// sprinter-app.js). On repart donc de LUI, a l'echantillon pres — sa
// batterie, sa basse en doubles-croches, son arpege, son bourdon, ses
// stabs — et l'on ne change que ce qui fait le pays :
//   - l'harmonie (la cadence andalouse a Barcelone...) ;
//   - les mains du public quand le lieu en a (palmas...) ;
//   - UN REFRAIN, joue par un instrument du pays synthetise avec les memes
//     briques (`tone`) : guitare pincee, flute, anche, cloche.
// Au tempo de race3, 150 (160 essaye puis ecarte le 18/10).
//
//   node tools/musique/legende-race3.mjs <dossier> [lieu...]
// ecrit <lieu>.wav (cinq boucles, pour l'ecoute) ; `race3-150` et
// `race3-160` sont la reference.
//   node tools/musique/legende-race3.mjs --mesure [lieu...]
// donne, avant normalisation, le niveau (dB RMS) de ce qui fait le pays
// (refrain, contretemps, mains) et du socle race3 (batterie, basse, arpege,
// bourdon, stab) : l'ecart dit lequel passe devant.

import { Audio_, tampon, ecrireWav, SR } from './moteur.mjs';

// --- fabriquerCourse, recopie de sprinter-app.js (plus `melodie`) --------
function mains(d, t0, amp, graine) {
  const sr = d.sampleRate, ch = d.getChannelData(0);
  let g = (graine * 7919 + 17) | 0;
  const alea = () => { g = (Math.imul(1103515245, g) + 12345) & 0x7fffffff; return g / 0x7fffffff; };
  for (let c = 0; c < 10; c++) {
    const i0 = ((t0 + (alea() - 0.3) * 0.022) * sr) | 0;
    const a = amp * (0.05 + 0.05 * alea());
    const n = (0.05 * sr) | 0;
    let seed = (g ^ (c * 2654435761)) & 0x7fffffff, prev = 0;
    for (let i = 0; i < n; i++) {
      const k = i0 + i; if (k < 0 || k >= ch.length) continue;
      seed = (Math.imul(1103515245, seed) + 12345) & 0x7fffffff;
      const nz = seed / 0x3fffffff - 1;
      const hp = nz - prev; prev = nz;
      const q = i / sr;
      const env = Math.exp(-q * 95) + 0.6 * (q > 0.006 ? Math.exp(-(q - 0.006) * 120) : 0);
      ch[k] += a * env * hp;
    }
  }
}

// Les instruments du refrain : rien que des `tone` superposes.
const INSTRUMENTS = {
  // corde pincee (guitare, koto, charango, saz) : scie qui s'eteint vite + harmonique
  pincee: (d, t, dur, f, a) => {
    Audio_.tone(d, t, dur * 1.6, f, a, 'saw', 7);
    Audio_.tone(d, t, dur * 0.8, f * 2, a * 0.35, 'pulse', 16);
    Audio_.tone(d, t, 0.03, f * 4, a * 0.25, 'saw', 60);   // l'attaque du mediator
  },
  // souffle (flute, quena, shakuhachi) : sinus et un peu de triangle, attaque douce
  souffle: (d, t, dur, f, a) => {
    Audio_.tone(d, t, dur * 0.95, f, a, 'sin', 1.2);
    Audio_.tone(d, t, dur * 0.95, f * 2, a * 0.18, 'tri', 2.0);
    Audio_.tone(d, t, dur * 0.95, f * 1.004, a * 0.5, 'sin', 1.2);   // vibrato par battement
  },
  // anche (zurna, dizi, accordeon, cuivre) : impulsion nasale tenue
  anche: (d, t, dur, f, a) => {
    Audio_.tone(d, t, dur * 0.95, f, a * 0.8, 'pulse', 1.5);
    Audio_.tone(d, t, dur * 0.95, f * 1.003, a * 0.5, 'saw', 1.5);
  },
  // cloche (kalimba, carillon) : partiels inharmoniques qui s'eteignent
  cloche: (d, t, dur, f, a) => {
    Audio_.tone(d, t, dur * 2.5, f, a, 'sin', 4);
    Audio_.tone(d, t, dur * 1.2, f * 2.76, a * 0.4, 'sin', 9);
    Audio_.tone(d, t, dur * 0.6, f * 5.4, a * 0.2, 'sin', 16);
  },
};

function fabriquerCourse(cfg) {
  const beat = 60 / cfg.bpm, bar = beat * 4, tot = bar * cfg.prog.length;
  const d = tampon(tot);
  const F = (s, o) => Audio_.semi(s, o);
  for (let b = 0; b < cfg.prog.length; b++) {
    const ch = cfg.prog[b];
    const t = b * bar, root = ch[0], tri = ch[1];
    for (const x of cfg.kick) Audio_.drum(d, t + x * beat, 'k');
    for (const x of cfg.snare) Audio_.drum(d, t + x * beat, 's');
    for (const x of (cfg.claps || [])) mains(d, t + x * beat, cfg.clapAmp || 1, b * 16 + x * 4);
    for (let i = 0; i < cfg.hats; i++) Audio_.drum(d, t + i * beat * 4 / cfg.hats, 'h');
    const div = cfg.bassDiv, bl = beat * 4 / div;
    for (let i = 0; i < div; i++) {
      const sm = cfg.bassPat[i % cfg.bassPat.length];
      Audio_.tone(d, t + i * bl, bl * 0.92, F(root + sm, 2), cfg.bassAmp, 'saw', 5);
    }
    for (const n of tri) Audio_.tone(d, t, bar * 0.94, F(root + n, 3), cfg.padAmp, 'tri', 1.1);
    if (cfg.drone > 0) {
      Audio_.tone(d, t, bar * 0.99, F(cfg.droneSemi, 1), cfg.drone, 'sin', 0.22);
      Audio_.tone(d, t, bar * 0.99, F(cfg.droneSemi + 0.14, 1), cfg.drone * 0.7, 'sin', 0.22);
    }
    const n2 = cfg.arp;
    for (let i = 0; i < n2; i++)
      Audio_.tone(d, t + i * bar / n2, bar / n2 * 0.55, F(root + tri[i % tri.length], 5), cfg.arpAmp, 'pulse', 9);
    if (cfg.stab)
      Audio_.tone(d, t + beat * 3.5, beat * 0.45, F(root + (cfg.stabSemi ?? 6), 4), cfg.stab, 'saw', 7);
    // les accords plaques sur les contretemps (skank)
    if (cfg.contretemps) {
      const c = cfg.contretemps, jouer = INSTRUMENTS[c.instrument];
      for (const x of c.temps) for (const n of tri) jouer(d, t + x * beat, beat * 0.3, F(root + n, c.octave), c.amp);
    }
    // LE REFRAIN : [demi-ton depuis le la, temps, duree en temps], par mesure
    for (const c of (cfg.couches || [])) {
      const jouer = INSTRUMENTS[c.instrument], m = c.melodie[b % c.melodie.length];
      for (const [s, x, l] of m) jouer(d, t + x * beat, l * beat, F(s, c.octave), c.amp);
    }
  }
  return brut ? d : Audio_.norm(d);
}
let brut = false;

// --- les reglages : ceux du jeu (src/game/legende/race3-lieux.js) ---------
import { RACE3, MUSIQUES_LEGENDE } from '../../src/game/legende/race3-lieux.js';
const LIEUX = { 'race3-150': RACE3, 'race3-160': { ...RACE3, bpm: 160 }, ...MUSIQUES_LEGENDE };

const [dossier, ...noms] = process.argv.slice(2);
if (dossier === '--mesure') {
  brut = true;
  const db = (cfg) => {
    const ch = fabriquerCourse(cfg).getChannelData(0);
    let s = 0; for (let i = 0; i < ch.length; i++) s += ch[i] * ch[i];
    return 10 * Math.log10(s / ch.length + 1e-12);
  };
  for (const nom of noms.length ? noms : Object.keys(MUSIQUES_LEGENDE)) {
    const c = LIEUX[nom];
    const pays = db({ ...c, kick: [], snare: [], hats: 0, bassAmp: 0, padAmp: 0, arpAmp: 0, drone: 0, stab: 0 });
    const socle = db({ ...c, couches: [], contretemps: null, claps: [] });
    console.log(nom.padEnd(14), 'pays', pays.toFixed(1), 'dB  socle', socle.toFixed(1), 'dB  ecart', (pays - socle).toFixed(1));
  }
  process.exit(0);
}
if (!dossier) { console.error('usage : node legende-race3.mjs <dossier> [lieu...]'); process.exit(1); }
const fs = await import('node:fs');
fs.mkdirSync(dossier, { recursive: true });
for (const nom of noms.length ? noms : Object.keys(LIEUX)) {
  const boucle = fabriquerCourse(LIEUX[nom]).getChannelData(0);
  const out = new Float32Array(boucle.length * 5);
  for (let k = 0; k < 5; k++) out.set(boucle, k * boucle.length);
  await ecrireWav(`${dossier}/${nom}.wav`, out, SR);
  console.log(nom, (out.length / SR).toFixed(1) + ' s (boucle ' + (boucle.length / SR).toFixed(2) + ' s)');
}
