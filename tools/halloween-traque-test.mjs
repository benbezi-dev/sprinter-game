// LA TRAQUE — les sons de la bete qui arrive, verifies sans navigateur.
//
// Ce qu'on prouve ici, parce qu'un son casse ne se voit pas et s'entend trop
// tard — chez le joueur, la premiere nuit :
//
//   — aucun son ne contient de trou (NaN, infini) ni ne sature ;
//   — chacun a la duree annoncee ;
//   — le grondement boucle SANS COUTURE (un clic toutes les deux secondes
//     pendant une course de trente-six, c'est tout ce qu'on entendrait) ;
//   — les sons qui doivent s'entendre au telephone portent assez d'energie
//     au-dessus de trois cents hertz, la ou un haut-parleur de telephone
//     commence a rendre quelque chose ;
//   — la fabrique tient dans un budget : elle se fait avant la course, mais
//     sur un telephone.
//
// ET ON PEUT ECOUTER. Avec un dossier en argument, le harnais ecrit chaque son
// en WAV, plus deux apercus de course — une nuit perdue, une nuit tenue — ou
// la bete approche selon les memes regles que le jeu (halloween-traque.ts) :
//
//   node tools/halloween-traque-test.mjs
//   node tools/halloween-traque-test.mjs /chemin/vers/un/dossier

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import * as S from '../src/game/halloween-traque-sons.ts';

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

const sr = 48000;
const t0 = performance.now();
const sons = {
  grondement: S.grondement(sr), patteA: S.patte(sr, 17), patteB: S.patte(sr, 29),
  souffleIn: S.souffle(sr, false), souffleOut: S.souffle(sr, true), coeur: S.coeur(sr),
  arrivee: S.arrivee(sr), rage: S.rage(sr), morsure: S.morsure(sr), hurlement: S.hurlement(sr),
};
const salle = S.salle(sr);
const duree = performance.now() - t0;

titre('AUCUN TROU, AUCUNE SATURATION');
for (const [k, a] of Object.entries(sons)) {
  let pk = 0, trous = 0;
  for (const x of a) { if (!Number.isFinite(x)) trous++; else pk = Math.max(pk, Math.abs(x)); }
  ok(`${k} : ni NaN ni infini, crete ${pk.toFixed(2)} sous 1`, trous === 0 && pk <= 1 && pk > 0.5,
     `${trous} trou(s), crete ${pk}`);
}
ok('la salle a deux canaux sains',
   salle.length === 2 && salle.every(c => c.every(Number.isFinite)));

titre('LES DUREES ANNONCEES');
const attendues = {
  grondement: 'grondement', patteA: 'patte', patteB: 'patte', souffleIn: 'souffleIn',
  souffleOut: 'souffleOut', coeur: 'coeur', arrivee: 'arrivee', rage: 'rage',
  morsure: 'morsure', hurlement: 'hurlement',
};
for (const [k, d] of Object.entries(attendues)) {
  ok(`${k} dure ${S.DUREES[d]} s`, Math.abs(sons[k].length / sr - S.DUREES[d]) < 2 / sr * 10);
}

titre('LE GRONDEMENT BOUCLE SANS COUTURE');
{
  const g = sons.grondement;
  let pas = 0;
  for (let i = 1; i < g.length; i++) pas += Math.abs(g[i] - g[i - 1]);
  pas /= g.length - 1;
  const couture = Math.abs(g[0] - g[g.length - 1]);
  ok(`le saut a la couture (${couture.toFixed(4)}) ne depasse pas trois pas ordinaires (${pas.toFixed(4)})`,
     couture < pas * 3);
}

titre('CE QU UN TELEPHONE FAIT ENTENDRE');
// Un passe-haut d'ordre un a trois cents hertz : grossier, comme un
// haut-parleur de telephone.
const partHaute = a => {
  const rc = 1 / (2 * Math.PI * 300), al = rc / (rc + 1 / sr);
  let y = 0, xp = 0, eH = 0, eT = 0;
  for (const x of a) { y = al * (y + x - xp); xp = x; eH += y * y; eT += x * x; }
  return eH / eT;
};
for (const [k, min] of [['grondement', 0.25], ['patteA', 0.25], ['arrivee', 0.25],
                        ['rage', 0.4], ['morsure', 0.35], ['souffleOut', 0.4]]) {
  const p = partHaute(sons[k]);
  ok(`${k} : ${(p * 100).toFixed(0)} % de son energie au-dessus de 300 Hz (au moins ${min * 100} %)`, p >= min);
}

titre('LA FABRIQUE TIENT DANS SON BUDGET');
ok(`les dix sons et la salle en ${duree.toFixed(0)} ms (moins de 600 ms ici, quatre fois plus sur un telephone)`,
   duree < 600);

/* ------------------------------------------------------------- les apercus */

const dossier = process.argv[2];
if (dossier) {
  mkdirSync(dossier, { recursive: true });
  const wav = (nom, a) => {
    const n = a.length, b = Buffer.alloc(44 + n * 2);
    b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8);
    b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
    b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
    b.write('data', 36); b.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, a[i])) * 32767), 44 + i * 2);
    writeFileSync(join(dossier, nom), b);
  };
  for (const [k, a] of Object.entries(sons)) wav(`son-${k}.wav`, a);

  // UNE COURSE, MIXEE SELON LES REGLES DU JEU (halloween-traque.ts) : memes
  // seuils, memes niveaux, meme cadence de foulee (0,45 foulee par metre).
  const course = (mordu) => {
    const D = mordu ? 11 : 12.5, n = Math.round(D * sr), out = new Float32Array(n);
    const poser = (a, t, g, rate = 1) => {
      const i0 = Math.round(t * sr);
      for (let i = 0; i * rate < a.length && i0 + i < n; i++) {
        const j = i * rate, k = Math.floor(j), f = j - k;
        out[i0 + i] += g * (a[k] * (1 - f) + (a[k + 1] || 0) * f);
      }
    };
    // L'ecart : la bete part a douze metres et gagne ; perdue, elle mord a
    // neuf secondes ; tenue, elle reste a un metre et demi et la ligne passe.
    const ecartA = t => mordu ? Math.max(0, 12 - 12 * Math.pow(t / 9, 1.3))
                              : Math.max(1.5, 12 - 10.5 * Math.pow(Math.min(1, t / 8.2), 1.2));
    const FIN = mordu ? 9 : 8.6;
    let dBete = 0, demi = 0, expire = false, coeurA = 0.3, arme = true, rageA = -9;
    const g = sons.grondement;
    let phG = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      if (t >= FIN) break;
      const ecart = ecartA(t);
      const audible = Math.max(0, Math.min(1, 1 - ecart / 20));
      const menace = Math.max(0, Math.min(1, 1 - ecart / 12));
      // la gorge, lue plus vite en approchant
      const rate = 0.9 + 0.28 * menace;
      phG += rate; const k = Math.floor(phG) % g.length;
      out[i] += g[k] * Math.min(0.7, 0.1 * audible + 0.62 * Math.pow(menace, 1.4));
      // la foulee de la bete
      dBete += (9 + 3 * Math.min(1, t / 2)) / sr;
      const d = Math.floor(dBete * 0.45 * 2);
      if (d !== demi) {
        demi = d;
        const lourd = d % 2 === 0;
        poser(Math.random() < 0.5 ? sons.patteA : sons.patteB, t,
              (lourd ? 1 : 0.62) * (0.12 + 0.78 * audible * audible), 0.92 + Math.random() * 0.16);
        if (lourd && audible > 0.3) {
          expire = !expire;
          poser(expire ? sons.souffleOut : sons.souffleIn, t, 0.55 * Math.pow(audible, 1.6));
        }
      }
      if (arme && ecart < 7 && t > 0.4) { arme = false; poser(sons.arrivee, t, 0.85); }
      if (ecart < 2.2 && t - rageA > 3) { rageA = t; poser(sons.rage, t, 0.75); }
      if (menace > 0 && t >= coeurA) { poser(sons.coeur, t, 0.3 + 0.55 * menace); coeurA = t + 60 / (95 + 80 * menace); }
    }
    if (mordu) poser(sons.morsure, FIN, 0.95);
    else poser(sons.hurlement, FIN + 0.7, 0.42);
    // une reverberation grossiere, pour l'idee : deux echos qui s'eteignent
    for (let i = n - 1; i >= 0; i--) {
      const a = i - Math.round(0.11 * sr), b = i - Math.round(0.23 * sr);
      if (a >= 0) out[i] += out[a] * 0.22;
      if (b >= 0) out[i] += out[b] * 0.12;
    }
    let pk = 0; for (const x of out) pk = Math.max(pk, Math.abs(x));
    if (pk > 0.98) for (let i = 0; i < n; i++) out[i] *= 0.98 / pk;
    return out;
  };
  wav('apercu-nuit-perdue.wav', course(true));
  wav('apercu-nuit-tenue.wav', course(false));
  console.log(`\n   · apercus ecrits dans ${dossier}`);
}

console.log(e ? `\n${e} echec(s)` : '\nTout passe.');
process.exit(e ? 1 : 0);
