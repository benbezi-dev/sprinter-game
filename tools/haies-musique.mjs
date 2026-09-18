// L'AIR DE HURDLERS — rendu en fichiers, et verifie contre ses accords.
//
// Une musique ne se relit pas. On peut regarder longtemps un tableau de
// demi-tons sans entendre qu'une note tombe une seconde mineure au-dessus de
// l'accord qui la porte : cela ne se remarque qu'a l'oreille, et une oreille
// n'ouvre pas un diff. Cet outil fait donc les deux choses qu'aucun autre
// harnais ne fait ici : il RE N D les cinq morceaux en .wav qu'on peut
// ecouter, et il verifie ce qui, lui, se verifie — que chaque note du theme
// appartient a l'accord de sa mesure ou en est un voisin admis, que la boucle
// tombe juste, et que rien ne sature.
//
//   node tools/haies-musique.mjs [dossier]
//
// Sans dossier, il ne rend rien et se contente des controles.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const JEU = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'game');
const SR = 48000;

let e = 0;
const ok = (n, c, d) => { console.log(`   ${c ? '✓' : '✗'} ${n}${c || !d ? '' : ' — ' + d}`); if (!c) e++; };
const titre = t => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 58 - t.length))}`);

/* ------------------------------------------------------------------------
   LE MOTEUR DANS NODE, ET UN CONTEXTE AUDIO QUI N'EST QU'UN TABLEAU

   On ne simule pas le Web Audio : `buildHaies` n'a besoin que d'une chose de
   son contexte, un tampon mono ou ecrire des flottants. On le lui donne, et
   tout le reste du calcul est celui du vrai jeu, au bit pres.
   ------------------------------------------------------------------------ */
function chargerLeMoteur() {
  const mem = new Map();
  globalThis.localStorage = {
    getItem: k => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: k => mem.delete(k),
  };
  globalThis.window = globalThis;
  globalThis.document = {
    documentElement: { style: {}, classList: { add() {}, remove() {} } },
    createElement: () => ({ style: {}, getContext: () => null, appendChild() {}, setAttribute() {} }),
    body: { appendChild() {} }, querySelector: () => null,
    addEventListener() {}, removeEventListener() {},
  };
  try {
    Object.defineProperty(globalThis, 'navigator',
      { value: { language: 'fr', userAgent: 'node' }, configurable: true });
  } catch { /* deja defini par Node : il fera l'affaire */ }
  globalThis.addEventListener = () => {};
  globalThis.requestAnimationFrame = () => 0;
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  globalThis.Image = class { set src(v) {} addEventListener() {} };
  globalThis.__META = { env: { VITE_CANAL: '', BASE_URL: '/' } };

  for (const f of ['sprinter-i18n.js', 'sprinter-core.js', 'sprinter-app.js']) {
    const src = fs.readFileSync(path.join(JEU, f), 'utf8').replace(/import\.meta/g, '__META');
    new Function(src).call(globalThis);
  }
  return globalThis.SprinterApp;
}

const A = chargerLeMoteur();
const { Audio_, MUSIQUES_HAIES, THEME_HAIES } = A;
Audio_.ctx = {
  sampleRate: SR,
  createBuffer: (_c, n) => {
    const data = new Float32Array(n);
    return { sampleRate: SR, length: n, getChannelData: () => data };
  },
};

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  HURDLERS — L\'AIR, SES ACCORDS, ET CE QU\'IL SONNE           ║');
console.log('╚══════════════════════════════════════════════════════════════╝');

/* ==================================================================== 1 ===
   L'AIR TOMBE-T-IL DANS SES ACCORDS ?

   Note par note, on demande a quel degre de l'accord de sa mesure elle
   correspond. Une note de l'accord ne s'entend jamais mal. Une neuvieme, une
   sixieme ou une onzieme non plus : ce sont des couleurs, et le morceau en
   vit. Ce qui s'entend mal, c'est la seconde mineure — une note collee a un
   demi-ton d'une note tenue en dessous d'elle — et c'est cela qu'on traque.
   ======================================================================== */
titre('L\'AIR ET SES ACCORDS');

/** Les intervalles, en demi-tons dans l'octave, entre l'air et l'accord. */
function ecarts(demiTon, root, acc) {
  return acc.map(n => (((demiTon - root - n) % 12) + 12) % 12);
}

let frottements = 0, horsAccord = 0, total = 0;
for (const [nom, cfg] of Object.entries(MUSIQUES_HAIES)) {
  THEME_HAIES.forEach((phrase, c) => {
    phrase.forEach(([i, st, dur]) => {
      // La cellule couvre deux mesures ; la croche i tombe dans la premiere
      // si i < 8, dans la seconde sinon.
      const mesure = c * 2 + (i < 8 ? 0 : 1);
      const [root, acc] = cfg.prog[mesure];
      const d = ecarts(st, root, acc);
      total++;
      if (!d.includes(0)) horsAccord++;
      // Une note qui frotte : a un demi-ton d'une note de l'accord, et tenue
      // assez longtemps pour qu'on l'entende frotter (plus d'une croche).
      if (dur > 1 && d.some(x => x === 1 || x === 11)) {
        frottements++;
        console.log(`      ${nom} mesure ${mesure + 1} : ${st} sur [${root}, ${acc}]`);
      }
    });
  });
}
ok('aucune note tenue ne frotte contre son accord', frottements === 0,
   `${frottements} sur ${total}`);
ok('l\'immense majorite des notes sont des notes d\'accord',
   horsAccord <= total * 0.25, `${horsAccord} hors accord sur ${total}`);

// L'air ne doit employer aucune tierce : c'est ce qui lui permet de se poser
// sur les grilles claires comme sur les sombres sans changer une note.
const degres = [...new Set(THEME_HAIES.flat().map(n => ((n[1] % 12) + 12) % 12))].sort((a, b) => a - b);
ok('l\'air n\'emploie ni tierce majeure ni tierce mineure',
   !degres.includes(3) && !degres.includes(4), `degres : ${degres.join(', ')}`);

titre('LE RYTHME DES HAIES');

// Trois appuis et l'envol : chaque cellule commence par trois croches de meme
// duree, puis une note qui saute plus haut et dure plus longtemps.
THEME_HAIES.forEach((phrase, c) => {
  const [a, b, d, envol] = phrase;
  const trois = a[2] === 1 && b[2] === 1 && d[2] === 1 && a[1] === b[1] && b[1] === d[1];
  ok(`cellule ${c + 1} : trois appuis sur la meme note`, trois);
  ok(`cellule ${c + 1} : puis l'envol, plus haut et tenu`,
     envol[1] > d[1] && envol[2] >= 3, `saut de ${envol[1] - d[1]} demi-tons, ${envol[2]} croches`);
});

// La question revient telle quelle : c'est ce qui fait qu'on la retient.
ok('la question est rejouee au troisieme quart',
   JSON.stringify(THEME_HAIES[0]) === JSON.stringify(THEME_HAIES[2]));
ok('la reponse et l\'envol, eux, ne se repetent pas',
   JSON.stringify(THEME_HAIES[1]) !== JSON.stringify(THEME_HAIES[3]));

/* ==================================================================== 2 ===
   L'AIR ECRIT EST-IL L'AIR QU'ON ENTEND ?

   Les deux controles precedents lisent le tableau des notes ; celui-ci ecoute
   ce qui en sort. Entre les deux il y a le swing, l'octave du chant et le
   calcul des durees — trois endroits ou une melodie juste sur le papier se
   rend une note a cote, une croche trop tot, ou une octave trop haut, sans
   qu'aucun de ces trois fichiers ne paraisse fautif.

   On isole le chant en rendant deux fois, avec l'air et sans lui, et on
   demande a chaque note, en plein milieu de sa tenue, si l'energie est bien a
   la frequence ecrite plutot qu'a un demi-ton de la.
   ======================================================================== */
titre('L\'AIR, TEL QU\'IL SORT');

/** L'energie d'un signal a une frequence donnee, sur une fenetre. */
function goertzel(d, i0, n, f) {
  const w = 2 * Math.PI * f / SR, c = 2 * Math.cos(w);
  let s0 = 0, s1 = 0, s2 = 0;
  for (let i = 0; i < n; i++) {
    const k = i0 + i; if (k >= d.length) break;
    s0 = d[k] + c * s1 - s2; s2 = s1; s1 = s0;
  }
  return Math.sqrt(s1 * s1 + s2 * s2 - c * s1 * s2) / n;
}

{
  const cfg = MUSIQUES_HAIES.h_race0;
  const brut = Audio_.norm;
  Audio_.norm = x => x;                    // sans normalisation, la soustraction est exacte
  const lit = Audio_.buildHaies({ ...cfg, lead: 0 }).getChannelData(0).slice();
  const tout = Audio_.buildHaies(cfg).getChannelData(0).slice();
  Audio_.norm = brut;
  const chant = Float32Array.from(tout.map((v, i) => v - lit[i]));

  const beat = 60 / cfg.bpm;
  const croche = i => (i + (i % 2 ? cfg.swing : 0)) * beat / 2;
  const cellule = beat * 8;
  let justes = 0, total2 = 0;
  THEME_HAIES.forEach((phrase, c) => {
    phrase.forEach(([i, st, dur]) => {
      const t = c * cellule + croche(i);
      const d = (croche(i + dur) - croche(i)) * 0.88;
      const i0 = ((t + d * 0.35) * SR) | 0;
      const n = Math.max(2048, (d * 0.4 * SR) | 0);
      const f = Audio_.semi(st + cfg.cle, cfg.leadOct);
      const e = goertzel(chant, i0, n, f);
      const bas = goertzel(chant, i0, n, f * Math.pow(2, -1 / 12));
      const haut = goertzel(chant, i0, n, f * Math.pow(2, 1 / 12));
      total2++;
      if (e > bas * 3 && e > haut * 3) justes++;
      else console.log(`      cellule ${c + 1}, croche ${i} : ${f.toFixed(0)} Hz attendus, introuvables`);
    });
  });
  ok('chaque note sonne a la hauteur ecrite', justes === total2, `${justes} sur ${total2}`);
}

/* ==================================================================== 3 ===
   LES CINQ MORCEAUX, RENDUS
   ======================================================================== */
titre('LES CINQ MORCEAUX');

/** Un .wav mono 16 bits, le format que tout lit. */
function wav(data) {
  const n = data.length, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, data[i]));
    b.writeInt16LE((v * 32767) | 0, 44 + i * 2);
  }
  return b;
}

const sortie = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (sortie) fs.mkdirSync(sortie, { recursive: true });

for (const [nom, cfg] of Object.entries(MUSIQUES_HAIES)) {
  const buf = Audio_.buildHaies(cfg);
  const d = buf.getChannelData(0);
  const duree = d.length / SR;
  const attendue = (60 / cfg.bpm) * 4 * cfg.prog.length;
  let pic = 0, somme = 0, sature = 0;
  for (let i = 0; i < d.length; i++) {
    const v = Math.abs(d[i]);
    if (v > pic) pic = v;
    if (v >= 0.999) sature++;
    somme += d[i] * d[i];
  }
  const rms = Math.sqrt(somme / d.length);
  ok(`${nom} : ${cfg.prog.length} mesures a ${cfg.bpm} — ${duree.toFixed(2)} s`,
     Math.abs(duree - attendue) < 0.02, `attendu ${attendue.toFixed(2)} s`);
  ok(`${nom} : ne sature pas`, sature === 0, `${sature} echantillons a fond`);
  ok(`${nom} : a du niveau sans etre ecrase`, rms > 0.06 && rms < 0.32,
     `rms ${rms.toFixed(3)}, pic ${pic.toFixed(3)}`);
  if (sortie) {
    const f = path.join(sortie, `${nom}.wav`);
    fs.writeFileSync(f, wav(d));
    console.log(`      → ${f}`);
  }
}

console.log(e ? `\n${e} controle(s) en echec.\n` : '\nTout tombe juste.\n');
process.exit(e ? 1 : 0);
