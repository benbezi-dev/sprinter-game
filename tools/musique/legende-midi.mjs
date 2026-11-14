// LES MUSIQUES DE LA LEGENDE EN MIDI, POUR LOGIC PRO (14/11).
//
// L'auteur : « utilise Logic Pro ». Logic ne se pilote pas depuis un script
// (aucun dictionnaire AppleScript, voir molosse-rendu.swift) et ne tourne pas
// hors de macOS. Le partage est donc celui du Molosse : ce script ecrit la
// partition — les MEMES notes que le jeu, lues dans race3-lieux.js — en un
// MIDI multipiste, une piste nommee par partie ; on l'ouvre dans Logic
// (Fichier > Importer > MIDI) et l'on prete a chaque piste un vrai
// instrument (Drummer ou Drum Kit Designer, basse, guitares, cuivres...).
//
//   node tools/musique/legende-midi.mjs <dossier> [lieu...] [--boucles N]
// ecrit <lieu>.mid (8 boucles de 4 mesures par defaut), au tempo du morceau.
//
// Hauteurs : le moteur joue semi(s, o) = 55 * 2^(o-1) * 2^(s/12) Hz, soit la
// note MIDI 33 + 12 (o - 1) + s. Batterie sur le canal 10 (General MIDI) :
// grosse caisse 36, caisse claire 38, mains 39, charleston 42.

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { MUSIQUES_LEGENDE } from '../../src/game/legende/race3-lieux.js';

const TPQ = 480;
const midi = (s, o) => Math.round(33 + 12 * ((o || 2) - 1) + s);
const vel = (amp, ref) => Math.max(30, Math.min(127, Math.round(100 * Math.sqrt(amp / ref))));

const vlq = (n) => {
  const b = [n & 0x7f];
  while ((n >>= 7)) b.unshift((n & 0x7f) | 0x80);
  return b;
};
const txt = (type, s) => { const d = [...Buffer.from(s, 'utf8')]; return [0xff, type, ...vlq(d.length), ...d]; };

/** Une piste : [{t (temps), dur (temps), note, vel}] -> octets MTrk. */
function piste(nom, canal, notes, tete = []) {
  const ev = [];
  for (const n of notes) {
    const on = Math.round(n.t * TPQ), off = Math.max(on + 1, Math.round((n.t + n.dur) * TPQ));
    ev.push([on, 1, [0x90 | canal, n.note, n.vel]], [off, 0, [0x80 | canal, n.note, 0]]);
  }
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const o = [0, ...txt(0x03, nom), ...tete];
  let t = 0;
  for (const [at, , m] of ev) { o.push(...vlq(at - t), ...m); t = at; }
  o.push(0, 0xff, 0x2f, 0);
  return [...Buffer.from('MTrk'), ...u32(o.length), ...o];
}
const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

function partition(cfg, boucles) {
  const P = {}; // nom -> {canal, programme, notes}
  const add = (nom, canal, programme, n) => (P[nom] ??= { canal, programme, notes: [] }).notes.push(n);
  const mes = cfg.prog.length;
  for (let k = 0; k < boucles; k++) for (let b = 0; b < mes; b++) {
    const t = (k * mes + b) * 4, [root, tri] = cfg.prog[b];
    for (const x of cfg.kick) add('Batterie', 9, 0, { t: t + x, dur: 0.25, note: 36, vel: 110 });
    for (const x of cfg.snare) add('Batterie', 9, 0, { t: t + x, dur: 0.25, note: 38, vel: 96 });
    for (const x of cfg.claps || []) add('Batterie', 9, 0, { t: t + x, dur: 0.25, note: 39, vel: 90 });
    for (let i = 0; i < cfg.hats; i++) add('Batterie', 9, 0, { t: t + i * 4 / cfg.hats, dur: 0.1, note: 42, vel: i % 2 ? 60 : 78 });
    const bl = 4 / cfg.bassDiv;
    for (let i = 0; i < cfg.bassDiv; i++)
      add('Basse', 1, 38, { t: t + i * bl, dur: bl * 0.92, note: midi(root + cfg.bassPat[i % cfg.bassPat.length], 2), vel: vel(cfg.bassAmp, 0.4) });
    if (cfg.padAmp) for (const n of tri) add('Nappe', 2, 89, { t, dur: 3.76, note: midi(root + n, 3), vel: vel(cfg.padAmp, 0.1) });
    if (cfg.arpAmp) for (let i = 0; i < cfg.arp; i++)
      add('Arpege', 3, 81, { t: t + i * 4 / cfg.arp, dur: 4 / cfg.arp * 0.55, note: midi(root + tri[i % tri.length], 5), vel: vel(cfg.arpAmp, 0.13) });
    if (cfg.stab) add('Stab', 4, 62, { t: t + 3.5, dur: 0.45, note: midi(root + (cfg.stabSemi ?? 6), 4), vel: vel(cfg.stab, 0.2) });
    if (cfg.contretemps) { const c = cfg.contretemps;
      for (const x of c.temps) for (const n of tri) add('Contretemps', 5, 27, { t: t + x, dur: 0.3, note: midi(root + n, c.octave), vel: vel(c.amp, 0.15) }); }
    (cfg.couches || []).forEach((c, j) => {
      const nom = c.nom || `Refrain ${j + 1} (${c.instrument})`;
      const prog = { pincee: 25, souffle: 73, anche: 61, cloche: 113 }[c.instrument] ?? 0;
      const canal = [6, 7, 8, 10, 11, 12, 13][j] ?? 14;
      for (const [s, x, l] of c.melodie[b % c.melodie.length])
        add(nom, canal, prog, { t: t + x, dur: l, note: midi(s, c.octave), vel: vel(c.amp, 0.4) });
    });
  }
  return P;
}

function ecrire(cle, cfg, dossier, boucles) {
  const P = partition(cfg, boucles);
  const us = Math.round(60e6 / cfg.bpm);
  const tempo = piste(cle, 0, [], [0, 0xff, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255, 0, 0xff, 0x58, 4, 4, 2, 24, 8]);
  const pistes = Object.entries(P).map(([nom, p]) => piste(nom, p.canal, p.notes, p.canal === 9 ? [] : [0, 0xc0 | p.canal, p.programme]));
  const tete = [...Buffer.from('MThd'), ...u32(6), 0, 1, 0, pistes.length + 1, TPQ >> 8, TPQ & 255];
  const f = join(dossier, cle + '.mid');
  writeFileSync(f, Buffer.from([...tete, ...tempo, ...pistes.flat()]));
  console.log(`${f}  ${cfg.bpm} BPM, ${boucles * cfg.prog.length} mesures, pistes : ${Object.keys(P).join(', ')}`);
}

const args = process.argv.slice(2);
const ib = args.indexOf('--boucles');
const boucles = ib >= 0 ? +args.splice(ib, 2)[1] : 8;
const [dossier, ...lieux] = args;
if (!dossier) { console.error('usage : node tools/musique/legende-midi.mjs <dossier> [lieu...] [--boucles N]'); process.exit(1); }
mkdirSync(dossier, { recursive: true });
for (const cle of lieux.length ? lieux : Object.keys(MUSIQUES_LEGENDE)) {
  if (!MUSIQUES_LEGENDE[cle]) { console.error('lieu inconnu : ' + cle); process.exit(1); }
  ecrire(cle, MUSIQUES_LEGENDE[cle], dossier, boucles);
}
