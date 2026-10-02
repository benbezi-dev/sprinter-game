// -----------------------------------------------------------------------
// LE DEFI MEBA-MICKAEL ZEZE — sa musique de course, du calcul au mp3 du jeu.
//
//   node tools/musique/defi-meba.mjs [dossier]      (ffmpeg requis)
//
// Ecrit public/vedettes/defi-meba.mp3 ; avec un dossier, y pose aussi le WAV
// 24 bits et le mp3, pour l'ecouter ou le reprendre dans une station.
//
// LE CONTRAT AVEC LE JEU (src/game/musique-defi-meba.ts, docs : la fiche
// ~/Desktop/musique-defi-meba/FICHE-FL-STUDIO.md) :
//   - 150 BPM, le tempo des ZEZE (race3) ; la mineur, la tonique de race3 ;
//   - le fichier part au premier chiffre du 3-2-1, le pistolet tombe a 3,0 s ;
//   - puis une boucle de seize mesures (25,6 s) qui repart sur le pistolet ;
//   - a peu pres -12 LUFS, crete vraie sous -1 dBTP (Aurel est a -11,7).
//
// CE QUE LA COURSE RACONTE, depuis le pistolet (la mesure 1 de la boucle) :
//   avant      le stade se tait : un coeur qui bat, une tension qui monte,
//              rien sur les trois bips du decompte, puis un silence net ;
//   1-4        LE DEPART CANON : l'explosion au coup de feu, la foule, le
//              riff, le 808 — son depart doit s'entendre ;
//   5          la poussee vers la ligne : roulement, montee ;
//   6          LA LIGNE DU 100 M (8,39 s) : un temps de silence, puis tout
//              tombe a 8,4 s, sur la ligne ;
//   7-10       le deuxieme souffle du 200 m : la grosse caisse passe a quatre
//              temps, les arpeges entrent ;
//   11-12      LE CLIMAX, la ligne du 200 m (17,30 s) : le riff en octaves,
//              le choeur, les claps de la foule doublent ;
//   13-16      le verdict, puis la remontee qui retombe sur le depart.
//
// SA SIGNATURE : LES CLAPS DE STADE, sur chaque temps des le coup de feu —
// 2,5 par seconde, la cadence ou il fait lever le public (L.clap). Ils
// doublent au climax : un stade qui tape de plus en plus vite, c'est ce qui
// fait « championnat » (la musique du Stade, validee le 24/09).
//
// TOUT EST CALCULE ICI, rien n'est echantillonne : aucun son d'autrui, et le
// fichier sort identique a chaque calcul (le hasard a ses graines).
//
// LA BOUCLE SANS COUTURE. On calcule l'intro puis TROIS tours, et l'on garde
// le tour du milieu : son debut porte les queues de reverberation du tour
// precedent, qui sont celles de sa propre fin. Et la couture tombe sur un
// souffle — le silence d'avant le coup de feu, le meme a la fin de l'intro et
// a la fin de la boucle : un decodeur mp3 qui garderait le silence de tete de
// l'encodeur (Safari) decalerait la boucle de vingt-cinq millisecondes dans
// ce silence, sans qu'on l'entende.
// -----------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SORTIE = path.resolve(ICI, '..', '..', 'public', 'vedettes', 'defi-meba.mp3');
const DOSSIER = process.argv[2] || null;

const SR = 44100, TAU = 2 * Math.PI;
const BPM = 150, T = 60 / BPM, MES = 4 * T;       // un temps 0,4 s, une mesure 1,6 s
const INTRO = 3.0, BOUCLE = 16 * MES, TOURS = 3, QUEUE = 0.4;
const DUREE = INTRO + TOURS * BOUCLE + 2.0;
const N = Math.ceil(DUREE * SR);
const LIGNE_100 = 8.39, LIGNE_200 = 17.30;          // ses chronos (sprinter-core.js)

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
const ech = (s) => Math.round(s * SR);

// --- le hasard, a graines ----------------------------------------------------
function hasard(s) {
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- les pistes du melange (stereo) et les envois --------------------------------
const piste = () => [new Float32Array(N), new Float32Array(N)];
const BATTERIE = piste(), BASSE = piste(), MUSIQUE = piste(), FOULE = piste(), EFFETS = piste();
const REVERB = piste(), ECHO = piste();
const COUPS = [];            // les grosses caisses : le pompage de la sidechain

/** Poser un son (mono ou [G, D]) a l'instant t, avec son panoramique et ses envois. */
function poser(dest, son, t, { gain = 1, pan = 0, reverb = 0, echo = 0 } = {}) {
  const st = Array.isArray(son);
  const L = st ? son[0] : son, R = st ? son[1] : son;
  const a = (Math.max(-1, Math.min(1, pan)) + 1) * Math.PI / 4;
  const gl = gain * (st ? 1 : Math.cos(a) * Math.SQRT2), gr = gain * (st ? 1 : Math.sin(a) * Math.SQRT2);
  const i0 = ech(t);
  for (let i = 0; i < L.length; i++) {
    const k = i0 + i;
    if (k < 0) continue;
    if (k >= N) break;
    const l = L[i] * gl, r = R[i] * gr;
    dest[0][k] += l; dest[1][k] += r;
    if (reverb) { REVERB[0][k] += l * reverb; REVERB[1][k] += r * reverb; }
    if (echo) { ECHO[0][k] += l * echo; ECHO[1][k] += r * echo; }
  }
}

const MEMO = new Map();
const garder = (cle, f) => { if (!MEMO.has(cle)) MEMO.set(cle, f()); return MEMO.get(cle); };

// --- les briques du signal -----------------------------------------------------

/** Le filtre a variables d'etat (Simper) : bas, bande et haut d'un seul calcul,
 *  stable meme quand la coupure bouge a chaque echantillon. */
class Filtre {
  constructor() { this.s1 = 0; this.s2 = 0; this.bas = 0; this.bande = 0; this.haut = 0; }
  pas(x, fc, q) {
    const g = Math.tan(Math.PI * Math.min(fc, SR * 0.45) / SR), k = 1 / q;
    const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
    const v3 = x - this.s2, v1 = a1 * this.s1 + a2 * v3, v2 = this.s2 + a2 * this.s1 + a3 * v3;
    this.s1 = 2 * v1 - this.s1; this.s2 = 2 * v2 - this.s2;
    this.bas = v2; this.bande = v1; this.haut = x - k * v1 - v2;
    return v2;
  }
}

/** La scie sans repliement (PolyBLEP) : ses aigus ne reviennent pas en sifflant. */
function blep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}
const scie = (ph, dt) => 2 * ph - 1 - blep(ph, dt);
function carre(ph, dt, pw = 0.5) {
  let p2 = ph + pw; if (p2 >= 1) p2 -= 1;
  return scie(ph, dt) - scie(p2, dt);
}

const mono = (d) => new Float32Array(ech(d));
const stereo = (d) => [new Float32Array(ech(d)), new Float32Array(ech(d))];
function crete(son, c = 1) {
  const cs = Array.isArray(son) ? son : [son];
  let p = 0; for (const x of cs) for (let i = 0; i < x.length; i++) p = Math.max(p, Math.abs(x[i]));
  if (p > 0) for (const x of cs) for (let i = 0; i < x.length; i++) x[i] *= c / p;
  return son;
}
function renverser(son) {
  for (const x of (Array.isArray(son) ? son : [son])) x.reverse();
  return son;
}

// --- LA BATTERIE -----------------------------------------------------------------

/** La grosse caisse : un choc net, un corps court — le grave est au 808. */
function grosseCaisse(corps = 0.11, graine = 1) {
  const r = hasard(graine), d = 0.3, o = mono(d);
  let ph = 0;
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    ph += (52 + 230 * Math.exp(-t / 0.021) + 2300 * Math.exp(-t / 0.0013)) / SR;
    const env = Math.min(1, t / 0.0004) * Math.exp(-t / corps) * Math.min(1, (d - t) / 0.03);
    const s = Math.sin(TAU * ph) * env * 1.2 + 0.55 * (r() * 2 - 1) * Math.exp(-t / 0.0009);
    o[i] = Math.tanh(s * 2.4);
  }
  return crete(o, 0.95);
}

/** Un claquement de mains : trois chocs serres, puis le creux des paumes. */
function mainsSeules(r) {
  const o = mono(0.24), f = new Filtre();
  const fc = 950 + 950 * r(), q = 1.3 + 1.4 * r();
  const chocs = [0, 0.0055 + 0.004 * r(), 0.012 + 0.005 * r()];
  const corps = 0.026 + 0.022 * r();
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    let e = 0;
    for (let c = 0; c < 3; c++) if (t >= chocs[c]) e += Math.exp(-(t - chocs[c]) / 0.0021) * (c ? 0.72 : 1);
    if (t >= chocs[2]) e += 0.5 * Math.exp(-(t - chocs[2]) / corps);
    const x = (r() * 2 - 1) * e;
    f.pas(x, fc, q);
    o[i] = f.bande * 2.4 + 0.3 * f.haut;
  }
  return o;
}

/** Des mains, a plusieurs : `nb` personnes, un peu en retard les unes sur les
 *  autres, chacune a sa place dans le stade. Peu nombreuses et serrees, c'est
 *  le clap de la batterie ; nombreuses et lachees, c'est la tribune. */
function mains(graine, nb, ecart) {
  const r = hasard(graine), o = stereo(0.34);
  for (let v = 0; v < nb; v++) {
    const s = mainsSeules(r);
    const dec = ech(Math.abs((r() + r() + r() - 1.5) * ecart));
    const a = ((r() * 2 - 1) * 0.92 + 1) * Math.PI / 4, g = 0.55 + 0.45 * r();
    for (let i = 0; i < s.length && i + dec < o[0].length; i++) {
      o[0][i + dec] += s[i] * Math.cos(a) * g;
      o[1][i + dec] += s[i] * Math.sin(a) * g;
    }
  }
  return crete(o, 1);
}

/** La caisse claire : un corps a 200 Hz qui chute, et un timbre de bruit clair. */
function caisseClaire(graine = 3) {
  const r = hasard(graine), o = mono(0.3), hp = new Filtre(), bp = new Filtre();
  let p1 = 0, p2 = 0;
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    p1 += (198 + 70 * Math.exp(-t / 0.01)) / SR;
    p2 += (342 + 90 * Math.exp(-t / 0.008)) / SR;
    const corps = (Math.sin(TAU * p1) * 0.8 + Math.sin(TAU * p2) * 0.35) * Math.exp(-t / 0.05);
    hp.pas(r() * 2 - 1, 1700, 0.7);
    bp.pas(hp.haut, 5600, 0.8);
    const timbre = (hp.haut * 0.5 + bp.bande * 0.7) * Math.exp(-t / 0.11);
    o[i] = Math.tanh((corps + timbre) * 1.7) * Math.min(1, t / 0.0003);
  }
  return crete(o, 0.9);
}

// Les six carres desaccordes du TR-808 : le metal des charlestons et des cymbales.
const METAL = [263, 400, 421, 474, 587, 845];

/** Charleston ou cymbale : le metal du 808, filtre haut, et une queue. */
function metal(d, tau, { mult = 1, bande = 8800, bruitPart = 0.25, graine = 5 } = {}) {
  const r = hasard(graine), o = mono(d), bp = new Filtre(), hp = new Filtre();
  const ph = METAL.map(() => r());
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    let s = 0;
    for (let j = 0; j < METAL.length; j++) {
      const f = METAL[j] * mult, dt = f / SR;
      ph[j] += dt; if (ph[j] >= 1) ph[j] -= 1;
      s += carre(ph[j], dt);
    }
    s = s / 6 + bruitPart * (r() * 2 - 1);
    bp.pas(s, bande, 0.9);
    hp.pas(bp.bande, 6500, 0.7);
    o[i] = hp.haut * Math.exp(-t / tau) * Math.min(1, t / 0.0005);
  }
  return crete(o, 1);
}

/** La cymbale crash, large : deux metaux voisins, un par cote. */
function crash() {
  return [crete(metal(2.4, 0.75, { mult: 1.9, bande: 7200, bruitPart: 0.6, graine: 11 }), 1),
          crete(metal(2.4, 0.78, { mult: 1.93, bande: 7600, bruitPart: 0.6, graine: 12 }), 1)];
}

/** Les toms du roulement d'avant le climax : un sinus qui tombe. */
function tom(f0, graine) {
  const r = hasard(graine), o = mono(0.4);
  let ph = 0;
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    ph += (f0 * (1 + 0.5 * Math.exp(-t / 0.03))) / SR;
    o[i] = Math.tanh((Math.sin(TAU * ph) * Math.exp(-t / 0.16) + 0.3 * (r() * 2 - 1) * Math.exp(-t / 0.004)) * 1.8);
  }
  return crete(o, 0.9);
}

// --- LA BASSE : LE 808 QUI GLISSE ---------------------------------------------

/**
 * Le 808 : un sinus et son octave, sature, qui glisse d'une note a la suivante.
 * `notes` : [debut (s), duree (s), note MIDI, glisse depuis (MIDI) ou null],
 * a la suite — la phase ne se rompt jamais d'une note a l'autre.
 */
function huitCentHuit(notes, longueur) {
  const o = mono(longueur);
  let ph = 0;
  for (const [t0, d, n, depuis] of notes) {
    const i0 = ech(t0), nb = ech(d), f1 = midi(n), f0 = depuis == null ? f1 : midi(depuis);
    for (let i = 0; i < nb && i0 + i < o.length; i++) {
      const t = i / SR;
      const f = depuis == null ? f1 : f1 * Math.pow(f0 / f1, Math.exp(-t / 0.045));
      ph += f / SR;
      const env = Math.min(1, t / 0.0025) * (0.72 + 0.28 * Math.exp(-t / 0.22)) * Math.min(1, (d - t) / 0.025);
      const s = Math.sin(TAU * ph) + 0.22 * Math.sin(2 * TAU * ph) + 0.06 * Math.sin(3 * TAU * ph);
      o[i0 + i] = Math.tanh(s * env * 2.3) * 0.85;
    }
  }
  return o;
}

// --- LES SYNTHES ---------------------------------------------------------------

/**
 * LE RIFF (« rage ») : sept scies desaccordees par note, ouvertes sur toute la
 * largeur, une scie a l'octave du dessous au centre, saturees ensemble. Une
 * ligne monophonique qui glisse d'une note a l'autre.
 * `notes` : [MIDI, debut (temps), duree (temps)].
 */
function riff(notes, { transpose = 0, voix = 7, desaccord = 0.24, clarte = 5600, drive = 1.7, graine = 21 } = {}) {
  const r = hasard(graine);
  const fin = notes.reduce((m, n) => Math.max(m, (n[1] + n[2]) * T), 0) + 0.25;
  const o = stereo(fin), fl = new Filtre(), fr = new Filtre();
  const ph = Array.from({ length: voix + 1 }, () => r());
  const det = Array.from({ length: voix }, (_, v) => ((v / (voix - 1)) * 2 - 1) * desaccord);
  const pan = Array.from({ length: voix }, (_, v) => (v % 2 ? 1 : -1) * (0.25 + 0.75 * Math.abs((v / (voix - 1)) * 2 - 1)));
  let fCour = midi(notes[0][0] + transpose);
  const nb = o[0].length;
  let idx = 0;
  for (let i = 0; i < nb; i++) {
    const t = i / SR;
    while (idx + 1 < notes.length && t >= notes[idx + 1][1] * T) idx++;
    const [n, deb, dur] = notes[idx];
    const tn = t - deb * T, dn = dur * T;
    const cible = midi(n + transpose);
    fCour = cible * Math.pow(fCour / cible, Math.exp(-1 / (0.018 * SR)));
    const vib = tn > 0.22 ? 1 + 0.0045 * Math.sin(TAU * 5.6 * tn) * Math.min(1, (tn - 0.22) / 0.2) : 1;
    let env = tn < 0 ? 0 : Math.min(1, tn / 0.004) * (0.82 + 0.18 * Math.exp(-tn / 0.1));
    const lie = idx + 1 < notes.length && Math.abs(notes[idx + 1][1] - (deb + dur)) < 1e-6;
    if (!lie && tn > dn - 0.045) env *= Math.max(0, (dn - tn) / 0.045);
    if (tn > dn) env = 0;
    let l = 0, rr = 0;
    for (let v = 0; v < voix; v++) {
      const f = fCour * vib * Math.pow(2, det[v] / 12), dt = f / SR;
      ph[v] += dt; if (ph[v] >= 1) ph[v] -= 1;
      const s = scie(ph[v], dt), a = (pan[v] + 1) * Math.PI / 4;
      l += s * Math.cos(a); rr += s * Math.sin(a);
    }
    const fs = fCour * vib / 2, dts = fs / SR;
    ph[voix] += dts; if (ph[voix] >= 1) ph[voix] -= 1;
    const sub = scie(ph[voix], dts) * 0.9;
    const fc = clarte * (0.62 + 0.38 * Math.exp(-Math.max(0, tn) / 0.14));
    fl.pas((l / voix + sub * 0.3) * env, fc, 0.75);
    fr.pas((rr / voix + sub * 0.3) * env, fc, 0.75);
    o[0][i] = Math.tanh(fl.bas * drive) / Math.tanh(drive);
    o[1][i] = Math.tanh(fr.bas * drive) / Math.tanh(drive);
  }
  return o;
}

/**
 * Un accord en scies desaccordees : les stabs (courts, filtre qui se ferme vite)
 * et les nappes (attaque lente, filtre pose).
 */
function accord(notes, d, { attaque = 0.003, declin = 0.12, maintien = 0.5, relache = 0.07, fc0 = 5200, fc1 = 1700,
                           tauF = 0.1, q = 0.8, voix = 7, desaccord = 0.18, graine = 31, fcFin = null } = {}) {
  const r = hasard(graine), o = stereo(d + relache), fl = new Filtre(), fr = new Filtre();
  const osc = [];
  for (const n of notes) {
    for (let v = 0; v < voix; v++) {
      const x = (v / (voix - 1)) * 2 - 1;
      osc.push({ f: midi(n) * Math.pow(2, x * desaccord / 12), ph: r(),
                 a: ((v % 2 ? 1 : -1) * (0.2 + 0.8 * Math.abs(x)) + 1) * Math.PI / 4 });
    }
  }
  const nb = o[0].length, ndur = ech(d);
  for (let i = 0; i < nb; i++) {
    const t = i / SR;
    let env = t < attaque ? t / attaque : maintien + (1 - maintien) * Math.exp(-(t - attaque) / declin);
    if (i > ndur) env *= Math.max(0, 1 - (t - d) / relache);
    let l = 0, rr = 0;
    for (const v of osc) {
      const dt = v.f / SR;
      v.ph += dt; if (v.ph >= 1) v.ph -= 1;
      const s = scie(v.ph, dt);
      l += s * Math.cos(v.a); rr += s * Math.sin(v.a);
    }
    let fc = fc1 + (fc0 - fc1) * Math.exp(-t / tauF);
    if (fcFin) fc = fcFin[0] * Math.pow(fcFin[1] / fcFin[0], Math.min(1, t / d));
    fl.pas(l * env, fc, q); fr.pas(rr * env, fc, q);
    o[0][i] = fl.bas; o[1][i] = fr.bas;
  }
  return crete(o, 1);
}

// Les voyelles du choeur : [frequence, gain, Q] de trois formants.
const VOYELLES = {
  a: [[800, 1, 7], [1150, 0.55, 9], [2900, 0.22, 12]],
  o: [[480, 1, 7], [820, 0.45, 9], [2830, 0.12, 12]],
};

/** Un choeur : des voix desaccordees, chacune son vibrato, passees par les
 *  formants d'une voyelle. Ni paroles ni souffle : une masse qui chante. */
function choeur(notes, d, { voyelle = 'a', attaque = 0.45, relache = 0.7, graine = 41 } = {}) {
  const r = hasard(graine), o = stereo(d + relache);
  const F = VOYELLES[voyelle];
  const voix = [];
  for (const n of notes) for (let v = 0; v < 4; v++) {
    voix.push({ f: midi(n) * Math.pow(2, (r() - 0.5) * 0.16 / 12), ph: r(), vf: 4.6 + 1.2 * r(), vp: r() * TAU,
                cote: v % 2 });
  }
  const filtres = [F.map(() => new Filtre()), F.map(() => new Filtre())];
  const nb = o[0].length, ndur = ech(d);
  for (let i = 0; i < nb; i++) {
    const t = i / SR;
    let env = Math.min(1, t / attaque);
    if (i > ndur) env *= Math.max(0, 1 - (t - d) / relache);
    const src = [0, 0];
    for (const v of voix) {
      const f = v.f * (1 + 0.006 * Math.sin(TAU * v.vf * t + v.vp)), dt = f / SR;
      v.ph += dt; if (v.ph >= 1) v.ph -= 1;
      src[v.cote] += scie(v.ph, dt);
    }
    for (let c = 0; c < 2; c++) {
      let s = 0;
      for (let k = 0; k < F.length; k++) { filtres[c][k].pas(src[c] * env, F[k][0], F[k][2]); s += filtres[c][k].bande * F[k][1]; }
      o[c][i] = s;
    }
  }
  return crete(o, 1);
}

/** La cloche du verdict (synthese FM) : le riff, tout bas, qui s'eloigne. */
function cloche(n, d = 1.4) {
  const o = mono(d), f = midi(n);
  let pc = 0, pm = 0;
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    pm += f * 3.5 / SR; pc += f / SR;
    const idx = 2.6 * Math.exp(-t / 0.35);
    o[i] = Math.sin(TAU * pc + idx * Math.sin(TAU * pm)) * Math.exp(-t / 0.55) * Math.min(1, t / 0.002);
  }
  return o;
}

/** Une note pincee, pour les arpeges du deuxieme souffle. */
function pincee(n) {
  const o = mono(0.26), fl = new Filtre(), f = midi(n);
  let p1 = 0, p2 = 0.37;
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    const dt = f / SR;
    p1 += dt; if (p1 >= 1) p1 -= 1;
    p2 += dt * 1.004; if (p2 >= 1) p2 -= 1;
    const s = carre(p1, dt, 0.32) * 0.6 + scie(p2, dt) * 0.5;
    fl.pas(s, 600 + 3600 * Math.exp(-t / 0.05), 1.1);
    o[i] = fl.bas * Math.exp(-t / 0.085) * Math.min(1, t / 0.0015);
  }
  return o;
}

// --- LES EFFETS DE COURSE -------------------------------------------------------

/** Le coup de feu dans la musique : un sous-grave qui tombe, un choc, la crash. */
function impact() {
  const d = 3.0, o = stereo(d), lp = new Filtre(), r = hasard(51);
  let ph = 0;
  for (let i = 0; i < o[0].length; i++) {
    const t = i / SR;
    ph += (24 + 52 * Math.exp(-t / 0.3)) / SR;
    lp.pas(r() * 2 - 1, 160 + 2400 * Math.exp(-t / 0.018), 0.8);
    const s = Math.sin(TAU * ph) * Math.exp(-t / 0.85) * 1.1 + lp.bas * Math.exp(-t / 0.11) * 1.6;
    o[0][i] = o[1][i] = Math.tanh(s * 1.4);
  }
  const c = crash();
  for (let i = 0; i < c[0].length && i < o[0].length; i++) { o[0][i] += c[0][i] * 0.55; o[1][i] += c[1][i] * 0.55; }
  return crete(o, 1);
}

/** La montee : un bruit dont la bande grimpe de 350 Hz a 9 kHz, et un son qui
 *  monte de deux octaves ; tout s'arrete net a la fin, sur le souffle. */
function montee(d, graine = 61) {
  const r = hasard(graine), o = stereo(d), fl = new Filtre(), fr = new Filtre(), ft = new Filtre();
  let p1 = 0, p2 = 0.5;
  for (let i = 0; i < o[0].length; i++) {
    const t = i / SR, u = t / d;
    const fc = 350 * Math.pow(9000 / 350, u);
    fl.pas(r() * 2 - 1, fc, 1.3); fr.pas(r() * 2 - 1, fc * 1.03, 1.3);
    const f = midi(45) * Math.pow(4, u * u), dt = f / SR;
    p1 += dt; if (p1 >= 1) p1 -= 1;
    p2 += dt * 1.007; if (p2 >= 1) p2 -= 1;
    ft.pas(scie(p1, dt) + scie(p2, dt), 1200 + 5000 * u, 0.7);
    const env = Math.pow(u, 2.2) * Math.min(1, (d - t) / 0.012);
    o[0][i] = (fl.bande * 1.6 + ft.bas * 0.35) * env;
    o[1][i] = (fr.bande * 1.6 + ft.bas * 0.35) * env;
  }
  return crete(o, 1);
}

/** La descente, apres un impact : la bande qui retombe, en s'eteignant. */
function descente(d, graine = 71) {
  const r = hasard(graine), o = stereo(d), fl = new Filtre(), fr = new Filtre();
  for (let i = 0; i < o[0].length; i++) {
    const t = i / SR, u = t / d;
    const fc = 7000 * Math.pow(250 / 7000, u);
    fl.pas(r() * 2 - 1, fc, 1.2); fr.pas(r() * 2 - 1, fc * 0.97, 1.2);
    const env = Math.exp(-t / (d * 0.4)) * Math.min(1, t / 0.02);
    o[0][i] = fl.bande * env; o[1][i] = fr.bande * env;
  }
  return crete(o, 1);
}

/** Le coeur du stade qui retient son souffle (le « coeur » du moteur : un
 *  sinus a 58 Hz qui tombe), double : poum-poum. */
function coeur() {
  const o = mono(0.36);
  for (const [t0, a] of [[0, 1], [0.13, 0.7]]) {
    let ph = 0;
    const i0 = ech(t0), nb = ech(0.2);
    for (let i = 0; i < nb; i++) {
      const q = i / nb;
      ph += 58 * (1 - 0.28 * q) / SR;
      o[i0 + i] += a * Math.exp(-6 * q) * Math.min(1, i / 90) * Math.sin(TAU * ph);
    }
  }
  return crete(o, 1);
}

/** Le tic de l'attente, sec, dans l'aigu. */
function tic(graine) {
  const r = hasard(graine), o = mono(0.03), f = new Filtre();
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    f.pas(r() * 2 - 1, 3400, 3);
    o[i] = (f.bande * 2 + 0.5 * Math.sin(TAU * 1700 * t)) * Math.exp(-t / 0.005);
  }
  return o;
}

/** Une nappe grave pour l'attente : la et mi, filtre qui s'ouvre, sans rien
 *  entre 600 et 700 Hz — la place des bips du decompte (660 Hz). */
function attente(d) {
  const o = stereo(d), fl = new Filtre(), fr = new Filtre();
  const notes = [33, 45, 52, 57, 59, 60];       // la1, la2, mi3, la3, si3, do4
  const ph = notes.map((_, j) => j * 0.13);
  for (let i = 0; i < o[0].length; i++) {
    const t = i / SR, u = t / d;
    let l = 0, rr = 0;
    notes.forEach((n, j) => {
      const f = midi(n) * (1 + (j % 2 ? 0.003 : -0.003)), dt = f / SR;
      ph[j] += dt; if (ph[j] >= 1) ph[j] -= 1;
      const s = j === 0 ? Math.sin(TAU * ph[j]) * 2 : scie(ph[j], dt);
      if (j % 2) l += s; else rr += s;
    });
    const fc = 260 * Math.pow(2400 / 260, u * u);
    fl.pas(l, fc, 0.9); fr.pas(rr, fc, 0.9);
    const env = Math.pow(u, 1.4) * Math.min(1, (d - t) / 0.015);
    o[0][i] = fl.bas * env; o[1][i] = fr.bas * env;
  }
  return crete(o, 1);
}

// --- LA FOULE -------------------------------------------------------------------

/**
 * Le stade : des groupes de voix — chacun un bruit dans sa bande, qui respire a
 * son rythme — repartis sur toute la largeur. Le murmure est lent et grave ;
 * la clameur, plus haute, vibre vite.
 */
function foule(d, { groupes = 24, bas = 300, haut = 2000, vite = false, graine = 81 } = {}) {
  const r = hasard(graine), o = stereo(d);
  for (let gI = 0; gI < groupes; gI++) {
    const f = new Filtre(), fc = bas * Math.pow(haut / bas, r()), q = 1.4 + 2.6 * r();
    const f1 = vite ? 2.5 + 5 * r() : 0.15 + 1.2 * r(), f2 = vite ? 0.6 + 2 * r() : 0.07 + 0.5 * r();
    const p1 = r() * TAU, p2 = r() * TAU, a = ((r() * 2 - 1) * 0.95 + 1) * Math.PI / 4, g = 0.5 + 0.5 * r();
    for (let i = 0; i < o[0].length; i++) {
      const t = i / SR;
      f.pas(r() * 2 - 1, fc, q);
      const m = 0.55 + 0.45 * Math.sin(TAU * f1 * t + p1) * (0.6 + 0.4 * Math.sin(TAU * f2 * t + p2));
      const s = f.bande * m * g;
      o[0][i] += s * Math.cos(a); o[1][i] += s * Math.sin(a);
    }
  }
  return crete(o, 1);
}

/** Les sifflets d'une clameur. */
function sifflet(graine) {
  const r = hasard(graine), d = 0.35 + 0.5 * r(), o = mono(d), f0 = 2300 + 1100 * r(), vf = 5.5 + 2 * r();
  let ph = 0;
  for (let i = 0; i < o.length; i++) {
    const t = i / SR;
    ph += (f0 + 60 * Math.sin(TAU * vf * t)) / SR;
    o[i] = Math.sin(TAU * ph) * Math.min(1, t / 0.03) * Math.min(1, (d - t) / 0.08);
  }
  return o;
}

// --- LES ESPACES : LA REVERBERATION DU STADE, L'ECHO ---------------------------

/** La reverberation de Schroeder et Moorer (Freeverb) : huit peignes, quatre
 *  passe-tout par cote. Grande, un peu sombre — un stade, pas une salle. */
function reverberer(entree, { piece = 0.9, amorti = 0.32, predelai = 0.028 } = {}) {
  const PEIGNES = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], PT = [556, 441, 341, 225], ECART = 23;
  const fb = piece * 0.28 + 0.7, dmp = amorti * 0.4, pre = ech(predelai);
  const sortie = piste();
  for (let c = 0; c < 2; c++) {
    const x = entree[c], y = sortie[c];
    const peignes = PEIGNES.map((l) => ({ b: new Float32Array(l + c * ECART), i: 0, f: 0 }));
    const pts = PT.map((l) => ({ b: new Float32Array(l + c * ECART), i: 0 }));
    let hp = 0, hpx = 0;
    for (let n = 0; n < N; n++) {
      const brut = n >= pre ? x[n - pre] : 0;
      hp = 0.985 * (hp + brut - hpx); hpx = brut;        // pas de grave dans la queue
      const e = hp * 0.015;
      let s = 0;
      for (const p of peignes) {
        const o = p.b[p.i];
        p.f = o * (1 - dmp) + p.f * dmp;
        p.b[p.i] = e + p.f * fb;
        if (++p.i >= p.b.length) p.i = 0;
        s += o;
      }
      for (const p of pts) {
        const o = p.b[p.i];
        p.b[p.i] = s + o * 0.5;
        if (++p.i >= p.b.length) p.i = 0;
        s = o - s;
      }
      y[n] = s;
    }
  }
  return sortie;
}

/** L'echo en ping-pong, a la croche pointee (0,3 s), qui s'assombrit. */
function echoPingPong(entree, retard = 0.75 * T, retour = 0.36) {
  const D = ech(retard), bg = new Float32Array(D), bd = new Float32Array(D), sortie = piste();
  let i = 0, lg = 0, ld = 0;
  for (let n = 0; n < N; n++) {
    const og = bg[i], od = bd[i];
    const m = (entree[0][n] + entree[1][n]) * 0.5;
    lg += 0.35 * (od - lg); ld += 0.35 * (og - ld);   // passe-bas dans la boucle
    bg[i] = m + ld * retour;
    bd[i] = lg * retour;
    sortie[0][n] = og; sortie[1][n] = od;
    if (++i >= D) i = 0;
  }
  return sortie;
}

// --- LA PARTITION ----------------------------------------------------------------

// La mineur : la, fa, do, sol — i, VI, III, VII, la cadence des hymnes.
const ACCORDS = {
  la: { notes: [57, 60, 64, 69, 72, 76], racine: 33 },
  fa: { notes: [57, 60, 65, 69, 72, 77], racine: 29 },
  do: { notes: [55, 60, 64, 67, 72, 76], racine: 36 },
  sol: { notes: [55, 59, 62, 67, 71, 74], racine: 31 },
};
// La grille des seize mesures (la 6 change a mi-mesure : fa, puis sol).
const GRILLE = ['la', 'fa', 'do', 'sol', 'la', 'fa', 'la', 'fa', 'do', 'sol', 'fa', 'sol', 'la', 'fa', 'do', 'sol'];

// LE RIFF. Quatre mesures, en croches, qui se chantent : une note repetee, un
// saut, la retombee. [note MIDI, debut (temps), duree (temps)].
const RIFF = [
  [76, 0, 0.5], [76, 0.5, 0.5], [81, 1, 0.75], [79, 1.75, 0.25], [76, 2, 0.5], [74, 2.5, 0.5], [76, 3, 1],
  [72, 4, 0.5], [72, 4.5, 0.5], [77, 5, 0.75], [76, 5.75, 0.25], [72, 6, 0.5], [69, 6.5, 0.5], [72, 7, 1],
  [79, 8, 0.5], [79, 8.5, 0.5], [84, 9, 0.75], [83, 9.75, 0.25], [79, 10, 0.5], [76, 10.5, 0.5], [79, 11, 1],
  [86, 12, 0.5], [86, 12.5, 0.5], [83, 13, 0.75], [81, 13.75, 0.25], [79, 14, 0.5], [81, 14.5, 0.5], [83, 15, 1],
];
// La poussee vers la ligne (mesure 5) : quatre noires qui montent.
const POUSSEE = [[81, 0, 1], [83, 1, 1], [84, 2, 1], [86, 3, 1]];
// La ligne du 100 m (mesure 6) : la note tenue, a partir du deuxieme temps.
const LIGNE = [[84, 1, 1.5], [86, 2.5, 1.5]];
// Le climax (mesures 11-12) : la deuxieme et la quatrieme phrase du riff, sur fa et sol.
const CLIMAX = [
  [84, 0, 0.5], [84, 0.5, 0.5], [89, 1, 0.75], [88, 1.75, 0.25], [84, 2, 0.5], [81, 2.5, 0.5], [84, 3, 1],
  [86, 4, 0.5], [86, 4.5, 0.5], [83, 5, 0.75], [81, 5.75, 0.25], [79, 6, 0.5], [81, 6.5, 0.5], [83, 7, 1],
];
// La tete du riff, en appel, juste avant le depart (mesure 16).
const APPEL = [[76, 0, 0.5], [76, 0.5, 0.5], [81, 1, 0.75], [79, 1.75, 0.25]];

/** Le 808 d'une mesure : sur les coups de grosse caisse, et il glisse vers la
 *  racine suivante sur la derniere croche des mesures paires. */
function basseDeMesure(m, racine, suivante, debut) {
  const motif = [[0, 0.75, 0], [0.75, 1.75, 0], [2.5, 1.0, 12], [3.5, 0.5, 0]];
  const out = [];
  for (const [b, d, oct] of motif) {
    let n = racine + oct, de = null;
    if (oct) de = racine;
    if (b === 3.5 && m % 2 === 0 && suivante != null) { n = suivante; de = racine; }
    out.push([debut + b * T, d * T, n, de]);
  }
  return out;
}

// --- LES SONS, CALCULES UNE FOIS -------------------------------------------------
console.log('les sons...');
const GC = grosseCaisse(0.11, 1), GC4 = grosseCaisse(0.15, 2);
const CLAP = [0, 1, 2, 3].map((k) => mains(100 + k, 5, 0.004));
const TRIBUNE = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => mains(200 + k, 18, 0.016));
const CAISSE = caisseClaire(3);
const CHF = [0, 1, 2, 3].map((k) => metal(0.07, 0.022, { graine: 300 + k }));
const CHO = metal(0.5, 0.17, { graine: 310 });
const CRASH = crash();
const TOMS = [tom(150, 401), tom(118, 402), tom(92, 403), tom(74, 404)];
const IMPACT = impact();
const COEUR = coeur();
const SIFFLETS = [0, 1, 2, 3, 4, 5].map((k) => sifflet(500 + k));

// --- LA PARTITION, POSEE ---------------------------------------------------------

/** Un tour de seize mesures, a partir de t0 (le coup de pistolet). */
function tour(t0) {
  const M = (m, b = 0) => t0 + (m - 1) * MES + b * T;
  const kick = (t, son = GC, g = 0.92) => { poser(BATTERIE, son, t, { gain: g }); COUPS.push(t); };

  // LE COUP DE FEU : l'impact, la foule qui explose, la descente.
  poser(EFFETS, IMPACT, M(1), { gain: 0.62, reverb: 0.25 });
  poser(EFFETS, garder('descente', () => descente(3.2)), M(1, 0.25), { gain: 0.16, reverb: 0.3 });

  for (let m = 1; m <= 16; m++) {
    const nomA = GRILLE[m - 1], A = ACCORDS[nomA];
    const suivante = ACCORDS[GRILLE[m % 16]].racine;
    const plein = (m <= 4) || (m >= 7 && m <= 12);
    const quatre = m >= 7 && m <= 12;      // le deuxieme souffle : la grosse caisse a quatre temps
    const climax = m === 11 || m === 12;

    // --- la grosse caisse
    if (m <= 5) {
      for (const b of [0, 0.75, 2.5]) kick(M(m, b));
      if (m === 5) { kick(M(m, 2)); kick(M(m, 3)); kick(M(m, 3.5)); }
    } else if (m === 6) {
      for (const b of [1, 2, 3]) kick(M(m, b), GC4, 1);
    } else if (quatre) {
      for (const b of [0, 1, 2, 3]) kick(M(m, b), GC4);
      if (m === 9 || m === 10 || climax) kick(M(m, 2.75), GC, 0.6);
    } else if (m === 13 || m === 14) {
      kick(M(m, 0), GC4, 0.55);
    } else if (m === 15) {
      for (const b of [0, 1, 2, 3]) kick(M(m, b), GC4, 0.8);
    } else if (m === 16) {
      for (const b of [0, 1, 2]) kick(M(m, b), GC4, 0.85);
    }

    // --- le clap de la batterie, sur 2 et 4 (et la caisse claire avec lui)
    if (plein || m === 15) {
      for (const b of [1, 3]) {
        poser(BATTERIE, CLAP[(m + b) % 4], M(m, b), { gain: 0.58, reverb: 0.18 });
        poser(BATTERIE, CAISSE, M(m, b), { gain: 0.36, reverb: 0.12 });
      }
    }
    if (m === 6) for (const b of [1, 2, 3]) {
      poser(BATTERIE, CLAP[b % 4], M(m, b), { gain: 0.62, reverb: 0.25 });
      poser(BATTERIE, CAISSE, M(m, b), { gain: 0.42, reverb: 0.2 });
    }

    // --- LA TRIBUNE : des le coup de feu, sur chaque temps ; deux fois plus
    // vite au climax et dans la derniere remontee
    const pas = climax ? 0.5 : (m === 16 ? 0.5 : 1);
    for (let b = 0; b < 4; b += pas) {
      if (m === 6 && b < 1) continue;                 // le temps de silence avant la ligne
      if (m === 16 && b >= 3.5) continue;             // le souffle d'avant le depart
      const g = m === 13 || m === 14 ? 0.2 : (climax ? 0.27 : 0.25);
      poser(FOULE, TRIBUNE[(m * 4 + b * 2) % 8], M(m, b), { gain: g, reverb: 0.42 });
    }
    if (m === 16) for (let b = 3; b < 3.5; b += 0.125) {
      poser(FOULE, TRIBUNE[(b * 8) % 8], M(m, b), { gain: 0.12 + 0.2 * (b - 3), reverb: 0.4 });
    }

    // --- les charlestons
    if (plein || m === 5) {
      for (let s = 0; s < 16; s++) {
        const b = s / 4, acc = [1, 0.45, 0.7, 0.45][s % 4];
        poser(BATTERIE, CHF[s % 4], M(m, b), { gain: 0.16 * acc, pan: s % 2 ? 0.25 : -0.15 });
      }
      if (quatre) for (const b of [0.5, 1.5, 2.5, 3.5]) poser(BATTERIE, CHO, M(m, b), { gain: 0.09, pan: 0.3, reverb: 0.1 });
      // les roulements de fin de phrase : triolets puis triples croches
      if (m === 2 || m === 8) for (let k = 0; k < 6; k++) poser(BATTERIE, CHF[k % 4], M(m, 3 + k / 6), { gain: 0.1 + 0.02 * k, pan: 0.2 });
      if (m === 4 || m === 10 || m === 12) for (let k = 0; k < 8; k++) poser(BATTERIE, CHF[k % 4], M(m, 3 + k / 8), { gain: 0.1 + 0.015 * k, pan: -0.2 });
    }
    if (m === 15 || m === 16) {
      const div = m === 15 ? 2 : 4;
      for (let s = 0; s < 4 * div; s++) {
        const b = s / div;
        if (m === 16 && b >= 3.5) break;
        poser(BATTERIE, CHF[s % 4], M(m, b), { gain: 0.07 + 0.08 * ((m - 15) * 4 + b) / 8, pan: s % 2 ? 0.2 : -0.2 });
      }
    }

    // --- les roulements de caisse claire
    if (m === 5) {
      for (let k = 0; k < 4; k++) poser(BATTERIE, CAISSE, M(m, k * 0.5), { gain: 0.14 + 0.03 * k, reverb: 0.15 });
      for (let k = 0; k < 8; k++) poser(BATTERIE, CAISSE, M(m, 2 + k * 0.25), { gain: 0.22 + 0.035 * k, reverb: 0.15 });
    }
    if (m === 15) for (let k = 0; k < 4; k++) poser(BATTERIE, CAISSE, M(m, k), { gain: 0.16 + 0.02 * k, reverb: 0.2 });
    if (m === 16) {
      for (let k = 0; k < 12; k++) poser(BATTERIE, CAISSE, M(m, k * 0.25), { gain: 0.18 + 0.022 * k, reverb: 0.2 });
      for (let k = 0; k < 4; k++) poser(BATTERIE, CAISSE, M(m, 3 + k * 0.125), { gain: 0.45 + 0.04 * k, reverb: 0.2 });
    }
    // les toms qui jettent dans le climax
    if (m === 10) for (let k = 0; k < 8; k++) poser(BATTERIE, TOMS[Math.floor(k / 2)], M(m, 2 + k * 0.25), { gain: 0.45, pan: 0.5 - k * 0.14, reverb: 0.2 });

    // --- les crash
    if (m === 7 || m === 11) poser(BATTERIE, CRASH, M(m), { gain: 0.3, reverb: 0.2 });
    if (m === 6) poser(BATTERIE, CRASH, M(m, 1), { gain: 0.36, reverb: 0.25 });
    if (m === 11) poser(BATTERIE, CRASH, t0 + LIGNE_200 + 0.0, { gain: 0.3, reverb: 0.3 });
    if (m === 13) poser(BATTERIE, CRASH, M(m), { gain: 0.2, reverb: 0.4 });

    // --- LE 808
    if (m <= 5 || (m >= 7 && m <= 12)) {
      const notes = basseDeMesure(m, A.racine, suivante, 0);
      if (quatre) {                        // le deuxieme souffle : il rebondit sur chaque temps
        notes.length = 0;
        for (let b = 0; b < 4; b++) notes.push([b * T, T * 0.92, A.racine + (b % 2 ? 12 : 0), b % 2 ? A.racine : null]);
        if (m % 2 === 0) notes[3] = [3 * T, T * 0.92, suivante, A.racine];
      }
      poser(BASSE, huitCentHuit(notes, MES + 0.1), M(m), { gain: 0.62 });
    }
    if (m === 6) {
      const sol = ACCORDS.sol.racine, fa = ACCORDS.fa.racine;
      poser(BASSE, huitCentHuit([[0, T, fa, null], [T, T, fa + 12, fa], [2 * T, 2 * T * 0.95, sol, null]], 3 * T + 0.1), M(m, 1), { gain: 0.66 });
    }
    if (m === 13 || m === 14) poser(BASSE, huitCentHuit([[0, MES * 0.97, A.racine, null]], MES + 0.05), M(m), { gain: 0.2 });
    if (m === 15) poser(BASSE, huitCentHuit([0, 1, 2, 3].map((b) => [b * T, T * 0.9, A.racine + (b === 3 ? 12 : 0), null]), MES + 0.1), M(m), { gain: 0.5 });
    if (m === 16) poser(BASSE, huitCentHuit([[0, 3 * T * 0.95, A.racine, null], [3 * T, 0.45 * T, A.racine + 12, A.racine]], MES), M(m), { gain: 0.56 });

    // --- les accords : en croches a contretemps (le pompage), plus serres au climax
    if (plein && m !== 6) {
      const cle = 'stab:' + nomA;
      const stab = garder(cle, () => accord(A.notes, 0.16, { fc0: 6200, fc1: 1800, tauF: 0.09, graine: 31 + m }));
      const temps = climax ? [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5] : [0.5, 1.5, 2.5, 3.5];
      for (const b of temps) poser(MUSIQUE, stab, M(m, b), { gain: climax ? 0.15 : 0.17, reverb: 0.16 });
    }
    if (m === 5) {
      const ouvre = garder('stab-monte', () => accord(ACCORDS.la.notes, MES, { attaque: 0.01, maintien: 0.9, fcFin: [500, 7000], graine: 37 }));
      poser(MUSIQUE, ouvre, M(m), { gain: 0.13, reverb: 0.2 });
    }
    if (m === 6) {
      const fa = garder('coup-fa', () => accord(ACCORDS.fa.notes, 0.36, { fc0: 8000, fc1: 2600, tauF: 0.2, maintien: 0.7, graine: 38 }));
      const sol = garder('coup-sol', () => accord(ACCORDS.sol.notes, 0.36, { fc0: 8000, fc1: 2600, tauF: 0.2, maintien: 0.7, graine: 39 }));
      poser(MUSIQUE, fa, M(m, 1), { gain: 0.26, reverb: 0.3 });
      poser(MUSIQUE, fa, M(m, 2), { gain: 0.22, reverb: 0.3 });
      poser(MUSIQUE, sol, M(m, 3), { gain: 0.26, reverb: 0.3 });
    }
    // les nappes : le choeur du climax, les nappes du verdict et de la remontee
    if (climax) poser(MUSIQUE, garder('choeur:' + nomA, () => choeur(ACCORDS[nomA].notes.slice(0, 5), MES, { graine: 41 + m })), M(m), { gain: 0.2, reverb: 0.45 });
    if (m >= 13) {
      const nappe = garder('nappe:' + nomA, () => accord(A.notes.slice(0, 5), MES, { attaque: 0.35, declin: 1, maintien: 0.85, relache: 0.5, fc0: 1500, fc1: 1500, voix: 5, desaccord: 0.12, graine: 51 + m }));
      poser(MUSIQUE, nappe, M(m), { gain: m >= 15 ? 0.14 : 0.18, reverb: 0.5 });
    }
    if (m === 16) poser(MUSIQUE, garder('choeur-o', () => choeur(ACCORDS.sol.notes.slice(0, 5), 3.5 * T, { voyelle: 'o', attaque: 1.0, relache: 0.02, graine: 49 })), M(m), { gain: 0.16, reverb: 0.4 });

    // --- les arpeges du deuxieme souffle
    if (m >= 7 && m <= 10) {
      const ordre = [0, 2, 3, 4, 3, 2, 1, 2];
      for (let s = 0; s < 16; s++) {
        const n = A.notes[ordre[s % 8]] + 12;
        poser(MUSIQUE, garder('pince:' + n, () => pincee(n)), M(m, s / 4), { gain: 0.085, pan: s % 2 ? 0.45 : -0.45, echo: 0.25, reverb: 0.15 });
      }
    }
    // --- la cloche du verdict : le riff, tout bas, qui s'eloigne
    if (m === 13 || m === 14) {
      for (const [n, b] of RIFF.slice((m - 13) * 7, (m - 13) * 7 + 7)) {
        const bb = b - (m - 13) * 4;
        poser(MUSIQUE, garder('cloche:' + n, () => cloche(n)), M(m, bb), { gain: 0.11, pan: 0.2, echo: 0.35, reverb: 0.35 });
      }
    }
  }

  // --- LE RIFF
  const r1 = garder('riff', () => riff(RIFF));
  poser(MUSIQUE, r1, M(1), { gain: 0.3, reverb: 0.2, echo: 0.12 });
  poser(MUSIQUE, r1, M(7), { gain: 0.3, reverb: 0.2, echo: 0.12 });
  poser(MUSIQUE, garder('riff-oct', () => riff(RIFF, { transpose: 12, voix: 3, desaccord: 0.12, clarte: 7000, graine: 22 })), M(7), { gain: 0.1, reverb: 0.25 });
  poser(MUSIQUE, garder('poussee', () => riff(POUSSEE, { drive: 1.4 })), M(5), { gain: 0.26, reverb: 0.25 });
  poser(MUSIQUE, garder('ligne', () => riff(LIGNE, { drive: 1.9, clarte: 7200 })), M(6), { gain: 0.3, reverb: 0.35, echo: 0.2 });
  poser(MUSIQUE, garder('climax', () => riff(CLIMAX, { drive: 1.9 })), M(11), { gain: 0.3, reverb: 0.25, echo: 0.15 });
  poser(MUSIQUE, garder('climax-bas', () => riff(CLIMAX, { transpose: -12, voix: 5, clarte: 4200, graine: 23 })), M(11), { gain: 0.2, reverb: 0.2 });
  poser(MUSIQUE, garder('appel', () => riff(APPEL, { clarte: 3000, drive: 1.3 })), M(16), { gain: 0.16, reverb: 0.3, echo: 0.3 });

  // --- LES MONTEES, et le souffle juste avant chaque depart
  poser(EFFETS, garder('montee-100', () => montee(2.0, 61)), M(5), { gain: 0.24, reverb: 0.2 });
  poser(EFFETS, garder('crash-r', () => renverser([Float32Array.from(CRASH[0].subarray(0, ech(1.6))), Float32Array.from(CRASH[1].subarray(0, ech(1.6)))])), M(6, 1) - 1.6, { gain: 0.22 });
  poser(EFFETS, garder('montee-court', () => montee(MES * 0.5, 62)), M(10, 2), { gain: 0.16, reverb: 0.2 });
  poser(EFFETS, garder('montee-depart', () => montee(2.95, 63)), M(15, 0.125), { gain: 0.26, reverb: 0.2 });
  poser(EFFETS, garder('descente-verdict', () => descente(3.0, 72)), M(13), { gain: 0.14, reverb: 0.3 });

  // --- LA FOULE : le murmure, et trois clameurs — le coup de feu, les deux lignes
  const murmure = garder('murmure', () => foule(BOUCLE, { groupes: 22, graine: 81 }));
  const enveloppe = (t) => {           // le niveau du murmure dans la boucle
    if (t > BOUCLE - 0.5) return 0.28 * Math.max(0, (BOUCLE - 0.2 - t) / 0.3);
    if (t < 0.02) return 0.3 * t / 0.02;
    return 0.3;
  };
  const env = mono(BOUCLE);
  for (let i = 0; i < env.length; i++) env[i] = enveloppe(i / SR);
  poser(FOULE, [murmure[0].map((v, i) => v * env[i]), murmure[1].map((v, i) => v * env[i])], M(1), { gain: 0.42, reverb: 0.3 });
  const clameur = garder('clameur', () => foule(4.0, { groupes: 26, bas: 650, haut: 3400, vite: true, graine: 91 }));
  const forme = (montee_, tenue, chute) => {
    const e = mono(4.0);
    for (let i = 0; i < e.length; i++) {
      const t = i / SR;
      e[i] = t < montee_ ? Math.pow(t / montee_, 1.5) : (t < montee_ + tenue ? 1 : Math.exp(-(t - montee_ - tenue) / chute));
    }
    return [clameur[0].map((v, i) => v * e[i]), clameur[1].map((v, i) => v * e[i])];
  };
  poser(FOULE, garder('clameur-feu', () => forme(0.05, 0.4, 0.9)), M(1), { gain: 0.36, reverb: 0.35 });
  poser(FOULE, garder('clameur-100', () => forme(0.75, 0.6, 1.1)), t0 + LIGNE_100 - 0.75, { gain: 0.42, reverb: 0.35 });
  poser(FOULE, garder('clameur-200', () => forme(0.85, 0.7, 1.2)), t0 + LIGNE_200 - 0.85, { gain: 0.46, reverb: 0.35 });
  [0.15, 0.9, 1.6].forEach((dt, k) => poser(FOULE, SIFFLETS[k], t0 + LIGNE_100 + dt, { gain: 0.05, pan: k - 1, reverb: 0.4 }));
  [0.1, 0.7, 1.3].forEach((dt, k) => poser(FOULE, SIFFLETS[k + 3], t0 + LIGNE_200 + dt, { gain: 0.05, pan: 1 - k, reverb: 0.4 }));
}

/** L'intro : du premier bip au coup de feu (0 a 3,0 s). Le stade se tait. */
function introduction() {
  const grille = (k) => INTRO - k * T;        // les temps, comptes a rebours depuis le pistolet
  poser(MUSIQUE, attente(2.8), 0, { gain: 0.22, reverb: 0.25 });
  for (let k = 7; k >= 1; k--) {
    poser(BASSE, COEUR, grille(k), { gain: 0.5 + 0.05 * (7 - k) });
    COUPS.push(grille(k));
  }
  for (let s = 0; s < 28; s++) {
    const t = 0.2 + s * T / 4;
    if (t >= 2.8) break;
    poser(BATTERIE, garder('tic' + (s % 4), () => tic(600 + s % 4)), t, { gain: 0.03 + 0.05 * (t / 2.8), pan: s % 2 ? 0.35 : -0.35 });
  }
  poser(EFFETS, garder('montee-intro', () => montee(1.8, 64)), 1.0, { gain: 0.2, reverb: 0.2 });
  poser(EFFETS, garder('crash-r2', () => renverser([Float32Array.from(CRASH[0].subarray(0, ech(1.2))), Float32Array.from(CRASH[1].subarray(0, ech(1.2)))])), 1.6, { gain: 0.18 });
  // le stade, au premier bip, se tait
  const hush = garder('hush', () => foule(1.2, { groupes: 18, graine: 85 }));
  const e = mono(1.2);
  for (let i = 0; i < e.length; i++) e[i] = Math.max(0, 1 - i / e.length) ** 2;
  poser(FOULE, [hush[0].map((v, i) => v * e[i]), hush[1].map((v, i) => v * e[i])], 0, { gain: 0.2, reverb: 0.3 });
}

console.log('la partition...');
introduction();
for (let k = 0; k < TOURS; k++) tour(INTRO + k * BOUCLE);

// --- LE MELANGE --------------------------------------------------------------------
console.log('les espaces...');
const RV = reverberer(REVERB);
const EC = echoPingPong(ECHO);

// LE POMPAGE : sous chaque grosse caisse, la musique s'efface et revient.
const pompe = new Float32Array(N).fill(1);
for (const t of COUPS) {
  const i0 = ech(t);
  for (let i = 0; i < ech(0.32) && i0 + i < N; i++) {
    const u = i / SR;
    const d = 1 - 0.55 * (u < 0.004 ? u / 0.004 : Math.exp(-(u - 0.004) / 0.1));
    if (d < pompe[i0 + i]) pompe[i0 + i] = d;
  }
}

console.log('le melange...');
const mix = piste();
for (let c = 0; c < 2; c++) {
  const o = mix[c];
  for (let n = 0; n < N; n++) {
    const p = pompe[n], pDoux = 0.5 + 0.5 * p;
    // (l'equilibre a ete regle sur le releve des pistes : le riff doit passer
    // devant, la tribune s'entendre, le 808 tenir le grave sans tout couvrir)
    o[n] = BATTERIE[c][n] * 0.95 + BASSE[c][n] * 0.78 * (0.7 + 0.3 * p) + MUSIQUE[c][n] * 2.8 * p
         + FOULE[c][n] * 1.8 * pDoux + EFFETS[c][n] + RV[c][n] * 1.25 * pDoux + EC[c][n] * 0.9 * p;
  }
}

// Le souffle d'avant chaque depart : rien que la queue de la salle, et elle
// aussi s'efface — c'est la couture de la boucle (et la fin de l'intro).
const souffles = [INTRO];
for (let k = 1; k <= TOURS; k++) souffles.push(INTRO + k * BOUCLE);
for (const ts of souffles) {
  const i0 = ech(ts - 0.2), i1 = ech(ts);
  for (let i = i0; i < i1 && i < N; i++) {
    const u = (i - i0) / (i1 - i0), g = 0.25 * (1 - u) * (1 - u);
    if (i >= 0) { mix[0][i] *= g; mix[1][i] *= g; }
  }
}

// --- LE MASTER : coupe-bas, compression de bus, limiteur ---------------------------
function master(m) {
  const sortie = piste();
  // un coupe-bas a 28 Hz, du second ordre
  for (let c = 0; c < 2; c++) {
    const f = new Filtre();
    for (let n = 0; n < N; n++) { f.pas(m[c][n], 28, 0.707); sortie[c][n] = f.haut; }
  }
  // la colle : 2:1 au-dessus de -16 dB, attaque 10 ms, relache 150 ms
  let env = 0;
  const att = Math.exp(-1 / (0.01 * SR)), rel = Math.exp(-1 / (0.15 * SR)), seuil = Math.pow(10, -16 / 20);
  for (let n = 0; n < N; n++) {
    const x = Math.max(Math.abs(sortie[0][n]), Math.abs(sortie[1][n]));
    env = x > env ? att * env + (1 - att) * x : rel * env + (1 - rel) * x;
    const g = env > seuil ? Math.pow(env / seuil, -0.5) : 1;
    sortie[0][n] *= g; sortie[1][n] *= g;
  }
  return sortie;
}

function limiter(m, plafond, gain) {
  // limiteur a anticipation : 4 ms d'avance, relache 80 ms
  const ava = ech(0.004), rel = Math.exp(-1 / (0.08 * SR));
  const n = m[0].length, g = new Float32Array(n);
  let cour = 1;
  const pic = new Float32Array(n);
  for (let i = 0; i < n; i++) pic[i] = Math.max(Math.abs(m[0][i]), Math.abs(m[1][i])) * gain;
  // le gain voulu a chaque instant : celui du pic le plus haut des 4 ms qui viennent
  const voulu = new Float32Array(n);
  const file = [];
  for (let i = n - 1; i >= 0; i--) {
    const j = Math.min(n - 1, i + ava);
    let mx = 0;
    for (let k = i; k <= j; k += 8) mx = Math.max(mx, pic[k]);
    mx = Math.max(mx, pic[j]);
    voulu[i] = mx > plafond ? plafond / mx : 1;
  }
  for (let i = 0; i < n; i++) {
    cour = voulu[i] < cour ? voulu[i] : rel * cour + (1 - rel) * voulu[i];
    g[i] = cour;
  }
  const out = [new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < n; i++) {
    out[0][i] = Math.max(-plafond, Math.min(plafond, m[0][i] * gain * g[i]));
    out[1][i] = Math.max(-plafond, Math.min(plafond, m[1][i] * gain * g[i]));
  }
  return out;
}

// LE RELEVE DES PISTES, sur le tour du milieu : de quoi juger l'equilibre sans
// l'entendre (dB efficaces).
const dB = (x) => (20 * Math.log10(Math.max(1e-9, x))).toFixed(1);
function efficace(p, a = INTRO + BOUCLE, b = INTRO + 2 * BOUCLE) {
  let s = 0, n = 0;
  for (let c = 0; c < 2; c++) for (let i = ech(a); i < ech(b); i++) { s += p[c][i] * p[c][i]; n++; }
  return Math.sqrt(s / n);
}
for (const [nom, p] of [['batterie', BATTERIE], ['basse', BASSE], ['musique', MUSIQUE], ['foule', FOULE],
                        ['effets', EFFETS], ['reverb', RV], ['echo', EC], ['melange', mix]]) {
  console.log(`  ${nom.padEnd(9)} ${dB(efficace(p))} dB`);
}
// le melange ramene a -16 dB efficaces avant la colle du master
const ref = Math.pow(10, -16 / 20) / efficace(mix);
for (let c = 0; c < 2; c++) for (let n = 0; n < N; n++) mix[c][n] *= ref;

console.log('le master...');
const masterise = master(mix);

// LA DECOUPE : l'intro, le tour du milieu, et un peu du suivant derriere la
// boucle — le jeu boucle de 3,0 a 28,6 s, a l'interieur d'une matiere continue.
function decouper(m) {
  const a = ech(INTRO), b = ech(INTRO + BOUCLE), c = ech(INTRO + 2 * BOUCLE), d = ech(INTRO + 2 * BOUCLE + QUEUE);
  const n = a + (c - b) + (d - c);
  const o = [new Float32Array(n), new Float32Array(n)];
  for (let ch = 0; ch < 2; ch++) {
    o[ch].set(m[ch].subarray(0, a), 0);
    o[ch].set(m[ch].subarray(b, d), a);
  }
  return o;
}
const morceau = decouper(masterise);

// --- LA SONIE : -12 LUFS, mesuree par ffmpeg (EBU R128) -----------------------------
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'defi-meba-'));
function ecrireWav(fichier, m, bits = 32) {
  const n = m[0].length, oct = bits / 8, buf = Buffer.alloc(44 + n * 2 * oct);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2 * oct, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(bits === 32 ? 3 : 1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2 * oct, 28); buf.writeUInt16LE(2 * oct, 32); buf.writeUInt16LE(bits, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2 * oct, 40);
  let p = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) {
    const v = m[c][i];
    if (bits === 32) { buf.writeFloatLE(v, p); p += 4; }
    else { buf.writeIntLE(Math.max(-8388607, Math.min(8388607, Math.round(v * 8388607))), p, 3); p += 3; }
  }
  fs.writeFileSync(fichier, buf);
}
/** La sonie integree et la crete vraie, lues par ffmpeg (EBU R128). */
function mesurer(fichier) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', fichier, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                      { encoding: 'utf8' });
  const txt = (r.stderr || '') + (r.stdout || '');
  const resume = txt.slice(txt.lastIndexOf('Summary:'));
  const I = parseFloat((resume.match(/I:\s+(-?[\d.]+) LUFS/) || [])[1]);
  const TP = parseFloat((resume.match(/Peak:\s+(-?[\d.]+) dBFS/) || [])[1]);
  return { I, TP };
}

const CIBLE = -12.0, PLAFOND = Math.pow(10, -1.4 / 20);
let gain = 1;
let fini = null;
for (let essai = 0; essai < 4; essai++) {
  const essaiMix = limiter(morceau, PLAFOND, gain);
  const f = path.join(TMP, 'essai.wav');
  ecrireWav(f, essaiMix, 32);
  const { I, TP } = mesurer(f);
  console.log(`sonie : ${I.toFixed(2)} LUFS, crete vraie ${TP} dBFS (gain ${gain.toFixed(3)})`);
  fini = essaiMix;
  if (Math.abs(I - CIBLE) < 0.15) break;
  gain *= Math.pow(10, (CIBLE - I) / 20);
}

// --- L'ENCODAGE --------------------------------------------------------------------
const wavFinal = path.join(TMP, 'defi-meba.wav');
ecrireWav(wavFinal, fini, 24);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', wavFinal, '-c:a', 'libmp3lame', '-b:a', '192k', SORTIE]);
const { I, TP } = mesurer(SORTIE);
console.log(`ecrit ${path.relative(process.cwd(), SORTIE)} : ${(fini[0].length / SR).toFixed(2)} s, ` +
            `${(fs.statSync(SORTIE).size / 1024).toFixed(0)} Ko, ${I.toFixed(2)} LUFS, crete vraie ${TP} dBFS`);
if (DOSSIER) {
  fs.mkdirSync(DOSSIER, { recursive: true });
  fs.copyFileSync(wavFinal, path.join(DOSSIER, 'defi-meba-24bits.wav'));
  fs.copyFileSync(SORTIE, path.join(DOSSIER, 'defi-meba.mp3'));
  console.log('copie dans', DOSSIER);
}
fs.rmSync(TMP, { recursive: true, force: true });
