// LA TRAQUE — les sons de la bete qui arrive, fabriques echantillon par echantillon.
//
// Jusqu'au 16/10, la bete ne faisait AUCUN bruit pendant la course : le seul
// son du mode etait le grognement du depart surpris (halloween-son.ts). Une
// bete qu'on ne voit que dans un coin de l'ecran reste une image ; une bete
// qu'on ENTEND gagner du terrain est une menace. Ce fichier fabrique ce qu'il
// faut pour cela, et halloween-traque.ts le joue.
//
// AUCUN IMPORT ICI, ET C'EST VOULU, comme halloween-loi.js : ce ne sont que des
// calculs. Chaque son est une fonction (frequence d'echantillonnage) ->
// echantillons, sans Web Audio, ce qui permet au harnais de les fabriquer sous
// node, de verifier qu'aucun ne sature ni ne contient de trou, et d'en ecrire
// un apercu a ecouter (tools/halloween-traque-test.mjs).
//
// RIEN N'EST ENREGISTRE, TOUT EST CALCULE, pour la meme raison que le reste du
// son du jeu : pas un octet a telecharger, et un son qu'on regle en changeant
// un nombre.
//
// CE QU'UN TELEPHONE NE JOUE PAS. Un haut-parleur de telephone ne rend presque
// rien sous deux cents hertz : un grondement a soixante hertz y est muet. Chaque
// son grave porte donc aussi ce qu'un telephone sait jouer — le raclement
// autour de six cents hertz, les harmoniques du coup, la terre sous les
// pattes —, et le grave n'est la que pour qui porte un casque.
//
// LES NEUF SONS, dans l'ordre ou le joueur les rencontre :
//   grondement  la gorge de la bete, en boucle, qui monte quand elle approche
//   patte       un appui du galop (deux variantes, pour ne pas faire mitraillette)
//   souffle     le halètement, cale sur la foulee (inspire et expire)
//   coeur       le coeur du coureur, qui s'emballe
//   arrivee     LE SIGNAL : elle arrive — une montee dissonante qui se coupe net
//               sur un impact
//   rage        a deux metres : un grognement qui finit en aboiement
//   morsure     la machoire qui claque, et la bete qui secoue
//   hurlement   elle renonce derriere la ligne, et hurle
//   salle       la reponse d'un lieu vide, pour la reverberation

/** Les sons, et ce qu'on attend de chacun : sa duree en secondes. */
export const DUREES = {
  grondement: 2.0, patte: 0.16, souffleIn: 0.16, souffleOut: 0.2, coeur: 0.5,
  arrivee: 2.8, rage: 0.95, morsure: 1.3, hurlement: 3.4, salle: 2.4,
} as const;

/** Un tirage pseudo-aleatoire fixe : le meme son a chaque fabrication. */
function alea(graine: number): () => number {
  let g = graine % 2147483647;
  if (g <= 0) g += 2147483646;
  return () => (g = (g * 16807) % 2147483647) / 2147483647 * 2 - 1;
}

/** Un filtre du second ordre (formules RBJ), reglable en cours de route. */
// (Pas de « propriete de parametre » dans le constructeur : node, qui charge ce
// fichier en enlevant les types, ne sait pas la lire.)
class Filtre {
  b0 = 0; b1 = 0; b2 = 0; a1 = 0; a2 = 0;
  x1 = 0; x2 = 0; y1 = 0; y2 = 0;
  type: 'bas' | 'haut' | 'bande';
  sr: number;
  constructor(type: 'bas' | 'haut' | 'bande', f: number, q: number, sr: number) {
    this.type = type;
    this.sr = sr;
    this.regler(f, q);
  }
  regler(f: number, q: number) {
    const w = 2 * Math.PI * Math.max(20, Math.min(f, this.sr * 0.45)) / this.sr;
    const cs = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al;
    let b0: number, b1: number, b2: number;
    if (this.type === 'bas') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; }
    else if (this.type === 'haut') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; }
    else { b0 = al; b1 = 0; b2 = -al; }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0;
    this.a1 = -2 * cs / a0; this.a2 = (1 - al) / a0;
  }
  pas(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

/** Ramener la crete a `crete`, sans toucher a la forme. */
function normaliser(out: Float32Array, crete: number): Float32Array {
  let m = 0;
  for (let i = 0; i < out.length; i++) m = Math.max(m, Math.abs(out[i]));
  if (m > 0) for (let i = 0; i < out.length; i++) out[i] *= crete / m;
  return out;
}

const TAU = 2 * Math.PI;
const scie = (ph: number) => 2 * (ph - Math.floor(ph)) - 1;

/* ===========================================================================
   LE GRONDEMENT — la gorge, en boucle
   ===========================================================================
   Deux secondes qui bouclent sans couture. Tout ce qui module est periodique
   sur deux secondes (la respiration, le raclement a 28 Hz, la derive de la
   voix a 0,5 et 1,5 Hz) ; seule la phase de la voix ne l'est pas, et un fondu
   d'un quart de seconde recoud la fin sur le debut.

   C'est sa VITESSE DE LECTURE qui le fait monter quand la bete approche
   (halloween-traque.ts) : la gorge grimpe, le raclement s'accelere, sans
   qu'il faille fabriquer un second son. */
export function grondement(sr: number): Float32Array {
  const L = DUREES.grondement, X = 0.25;
  const nL = Math.round(L * sr), nX = Math.round(X * sr), n = nL + nX;
  const brut = new Float32Array(n);
  const bruit = alea(4242);
  const rauque = new Filtre('bande', 640, 1.3, sr);
  let ph = 0, ph2 = 0, lp1 = 0, lp2 = 0, nz = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    // une respiration par boucle : elle enfle, puis reprend son souffle
    const souffle = 0.62 + 0.38 * Math.pow(Math.sin(Math.PI * t / L), 2);
    const f0 = 61 + 4 * Math.sin(TAU * 0.5 * t) + 2.5 * Math.sin(TAU * 1.5 * t + 1);
    ph += f0 / sr;
    ph2 += (f0 * 2.02) / sr;           // une seconde voix un peu fausse : la gorge, pas l'oscillateur
    nz = nz * 0.96 + bruit() * 0.04;
    const racle = 0.3 + 0.7 * Math.abs(Math.sin(Math.PI * 28 * t));
    const s = (scie(ph) * 0.65 + Math.sin(TAU * ph2) * 0.2 + nz * 8) * racle;
    lp1 += 0.12 * (s - lp1);
    lp2 += 0.12 * (lp1 - lp2);
    // le raclement que joue un telephone, autour de six cents hertz
    const r = rauque.pas(nz * 7 * racle) * 0.55;
    brut[i] = (lp2 + r) * souffle;
  }
  const out = new Float32Array(nL);
  for (let i = 0; i < nL; i++) {
    if (i < nX) {
      // fondu a puissance constante : du bruit fondu lineairement creuse au milieu
      const a = i / nX;
      out[i] = brut[i] * Math.sin(a * Math.PI / 2) + brut[nL + i] * Math.cos(a * Math.PI / 2);
    } else out[i] = brut[i];
  }
  return normaliser(out, 0.9);
}

/* ===========================================================================
   UN APPUI DU GALOP
   ===========================================================================
   Un coup sourd qui tombe (le poids), la terre qui crisse (ce qu'un telephone
   entend), et la griffe qui accroche, trois millisecondes. */
export function patte(sr: number, graine: number): Float32Array {
  const n = Math.round(DUREES.patte * sr), out = new Float32Array(n);
  const bruit = alea(graine);
  const terre = new Filtre('bande', 1500 + (graine % 7) * 120, 0.9, sr);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const f = 45 + 75 * Math.exp(-t / 0.018);
    ph += f / sr;
    const coup = (Math.sin(TAU * ph) + 0.4 * Math.sin(TAU * ph * 2.7)) * Math.exp(-t / 0.035);
    const sol = terre.pas(bruit()) * Math.exp(-t / 0.024) * 2.2;
    const griffe = t < 0.006 ? bruit() * 0.7 * (1 - t / 0.006) : 0;
    out[i] = (coup * 0.9 + sol + griffe) * Math.min(1, t / 0.001);
  }
  return normaliser(out, 0.9);
}

/* ===========================================================================
   LE HALETEMENT
   ===========================================================================
   Un chien qui galope respire au rythme de sa foulee : l'air entre quand les
   anterieurs touchent, sort quand les posterieurs poussent. L'expire est plus
   grave, plus long, et rauque ; l'inspire siffle. */
export function souffle(sr: number, expire: boolean): Float32Array {
  const D = expire ? DUREES.souffleOut : DUREES.souffleIn;
  const n = Math.round(D * sr), out = new Float32Array(n);
  const bruit = alea(expire ? 911 : 577);
  const f1 = new Filtre('bande', expire ? 850 : 1500, 1.6, sr);
  const f2 = new Filtre('bande', expire ? 2300 : 3300, 2.2, sr);
  let ph = 0, lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, k = t / D;
    const b = bruit();
    let s = f1.pas(b) * 1.2 + f2.pas(b) * 0.6;
    if (expire) {
      // la gorge vibre sur l'expire : un peu de voix, beaucoup de raclement
      ph += (150 - 30 * k) / sr;
      lp += 0.08 * (scie(ph) - lp);
      s = s * (0.55 + 0.45 * Math.abs(Math.sin(Math.PI * 38 * t))) + lp * 0.35;
    }
    const env = Math.pow(Math.sin(Math.PI * Math.min(1, k * 1.05)), 0.7) * Math.exp(-k * 1.2)
      * Math.min(1, t / (expire ? 0.015 : 0.025));
    out[i] = s * env;
  }
  return normaliser(out, 0.85);
}

/* ===========================================================================
   LE COEUR DU COUREUR
   ===========================================================================
   Deux coups, le second plus court. Le grave pour le casque, la deuxieme
   harmonique et le choc pour le telephone. */
export function coeur(sr: number): Float32Array {
  const n = Math.round(DUREES.coeur * sr), out = new Float32Array(n);
  const bruit = alea(73);
  // le choc dans la poitrine, vers quatre cents hertz : c'est lui qu'un
  // telephone fait entendre, le reste n'est que pour le casque
  const choc = new Filtre('bande', 380, 0.9, sr);
  let p1 = 0, p2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let s = 0;
    const fa = 48 + 95 * Math.exp(-t / 0.02);
    p1 += fa / sr;
    s += (Math.sin(TAU * p1) + 0.45 * Math.sin(TAU * p1 * 2) + 0.3 * Math.sin(TAU * p1 * 3))
      * Math.exp(-t / 0.07) * Math.min(1, t / 0.004);
    const u = t - 0.17;
    if (u > 0) {
      const fb = 58 + 110 * Math.exp(-u / 0.015);
      p2 += fb / sr;
      s += 0.7 * (Math.sin(TAU * p2) + 0.45 * Math.sin(TAU * p2 * 2) + 0.3 * Math.sin(TAU * p2 * 3))
        * Math.exp(-u / 0.055) * Math.min(1, u / 0.003);
    }
    s += choc.pas(bruit()) * (Math.exp(-t / 0.025) + (u > 0 ? 0.7 * Math.exp(-u / 0.02) : 0)) * 2.4;
    out[i] = s;
  }
  return normaliser(out, 0.9);
}

/* ===========================================================================
   L'ARRIVEE — le signal
   ===========================================================================
   Le seul son du mode qui soit fait pour faire sursauter. Une seconde et demie
   de montee — un amas de cordes dissonantes (la, si bemol, mi bemol : la
   seconde mineure et le triton, les deux intervalles qui ne se resolvent pas),
   un souffle qui s'eclaircit, un cri aigu qui glisse vers le haut — puis la
   coupure nette, et dans le silence qu'elle laisse, l'impact : un coup grave,
   un metal qui resonne, un craquement.

   La coupure compte plus que l'impact. C'est le trou d'un douzieme de seconde
   entre les deux qui fait monter le coeur. */
export function arrivee(sr: number): Float32Array {
  const D = DUREES.arrivee, R = 1.45;
  const n = Math.round(D * sr), out = new Float32Array(n);
  const bruit = alea(1031);
  const souffleHaut = new Filtre('haut', 400, 0.8, sr);
  const cordes = new Filtre('bas', 300, 1.1, sr);
  const notes = [110, 116.54, 155.56, 164.81, 233.08];
  const phases = notes.map(() => 0);
  const metal: Array<[number, number]> = [[180, 1.1], [397, 0.8], [563, 0.9], [911, 0.6], [1270, 0.5], [1733, 0.35]];
  const coup = new Filtre('bande', 700, 0.6, sr);
  let phCri = 0, phSub = 0;
  const TROU = 0.085;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let s = 0;
    if (t < R) {
      const k = t / R;
      if (i % 64 === 0) {
        souffleHaut.regler(300 + 4200 * k * k, 0.8);
        cordes.regler(250 + 3400 * k * k, 1.2);
      }
      const nz = souffleHaut.pas(bruit()) * Math.pow(k, 3) * 0.55;
      let amas = 0;
      for (let j = 0; j < notes.length; j++) {
        const f = notes[j] * (1 + 0.035 * k) * (1 + 0.004 * Math.sin(TAU * (4.5 + j * 0.7) * t));
        phases[j] += f / sr;
        amas += scie(phases[j]);
      }
      amas = cordes.pas(amas / notes.length) * k * k * 1.1;
      // le cri : une plainte aiguë qui glisse vers le haut, de plus en plus tremblante
      const fc = (700 + 950 * k * k) * (1 + (0.01 + 0.03 * k) * Math.sin(TAU * 6.2 * t));
      phCri += fc / sr;
      const cri = Math.sin(TAU * phCri) * Math.pow(k, 2.5) * 0.22;
      s = (nz + amas + cri) * 1.15 * Math.min(1, (R - t) / 0.01);
    } else if (t >= R + TROU) {
      const u = t - R - TROU;
      const fSub = 32 + 50 * Math.exp(-u / 0.12);
      phSub += fSub / sr;
      const sub = Math.sin(TAU * phSub) * Math.exp(-u / 0.5);
      // ce que le telephone entend du coup : ses harmoniques
      const corps = (Math.sin(TAU * phSub * 2) * 0.55 + Math.sin(TAU * phSub * 3) * 0.3) * Math.exp(-u / 0.22);
      let m = 0;
      for (const [f, tau] of metal) m += Math.sin(TAU * f * u + f * 0.013) * Math.exp(-u / tau);
      const crack = u < 0.12 ? bruit() * Math.exp(-u / 0.02) : 0;
      // le souffle de l'impact, dans le medium : c'est lui qui frappe au telephone
      const souffleImpact = coup.pas(bruit()) * Math.exp(-u / 0.09);
      s = (sub * 0.8 + corps * 0.9 + m * 0.4 + crack * 1.5 + souffleImpact * 2.2)
        * Math.min(1, u / 0.002) * Math.min(1, (D - t) / 0.3);
    }
    out[i] = s;
  }
  return normaliser(out, 0.95);
}

/* ===========================================================================
   LA RAGE — a deux metres
   ===========================================================================
   Un grognement qui monte et s'ouvre, puis un aboiement sec. */
export function rage(sr: number): Float32Array {
  const n = Math.round(DUREES.rage * sr), out = new Float32Array(n);
  const bruit = alea(3301);
  const gorge = new Filtre('bande', 800, 1.1, sr);
  const ab1 = new Filtre('bande', 700, 3, sr);
  const ab2 = new Filtre('bande', 1450, 3.5, sr);
  let ph = 0, lp = 0, phA = 0;
  const B = 0.52;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let s = 0;
    if (t < B + 0.05) {
      const k = Math.min(1, t / B);
      ph += (118 + 80 * k * k) / sr;
      const v = scie(ph) * 0.8 + bruit() * 0.5;
      const racle = 0.2 + 0.8 * Math.abs(Math.sin(Math.PI * (32 + 10 * k) * t));
      lp += (0.18 + 0.15 * k) * (v * racle - lp);
      s += (lp + gorge.pas(v * racle) * 0.9) * Math.min(1, t / 0.03) * (0.6 + 0.4 * k)
        * Math.min(1, (B + 0.05 - t) / 0.05);
    }
    const u = t - B;
    if (u > 0) {
      const fa = 180 + 260 * Math.exp(-u / 0.06);
      phA += fa / sr;
      const v = scie(phA) + bruit() * 0.35;
      s += (ab1.pas(v) * 1.6 + ab2.pas(v) * 1.1) * Math.exp(-u / 0.09) * Math.min(1, u / 0.006) * 1.4;
    }
    out[i] = s;
  }
  return normaliser(out, 0.95);
}

/* ===========================================================================
   LA MORSURE
   ===========================================================================
   Un grognement court, la machoire qui claque, quelque chose qui craque, et la
   bete qui secoue la tete en grondant. Aucun cri humain : le mode ne montre
   aucune blessure, et le son non plus. */
export function morsure(sr: number): Float32Array {
  const n = Math.round(DUREES.morsure * sr), out = new Float32Array(n);
  const bruit = alea(6661);
  const claque = new Filtre('bande', 3000, 0.7, sr);
  const craque = new Filtre('bande', 1900, 1.2, sr);
  const gorge = new Filtre('bande', 700, 1.0, sr);
  let ph = 0, lp = 0, phThud = 0, phG = 0, lpG = 0;
  let clic = 0;
  const S = 0.28;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let s = 0;
    if (t < S) {
      ph += (140 + 160 * (t / S)) / sr;
      const v = scie(ph) * 0.8 + bruit() * 0.6;
      lp += 0.3 * (v * (0.25 + 0.75 * Math.abs(Math.sin(Math.PI * 40 * t))) - lp);
      s += (lp + gorge.pas(v) * 0.6) * Math.min(1, t / 0.02) * Math.min(1, (S - t) / 0.01) * 0.8;
    }
    const u = t - S;
    if (u >= 0) {
      // le claquement
      s += claque.pas(bruit()) * Math.exp(-u / 0.004) * 3.2;
      phThud += (60 + 70 * Math.exp(-u / 0.02)) / sr;
      s += Math.sin(TAU * phThud) * Math.exp(-u / 0.05) * 0.9;
      // le craquement : de petits clics serres, qui s'eteignent
      if (u > 0.02 && u < 0.4) {
        if (clic <= 0 && Math.abs(bruit()) > 0.997) clic = Math.round(0.004 * sr);
        if (clic > 0) { clic--; s += craque.pas(bruit()) * 1.8 * Math.exp(-(u - 0.02) / 0.18); }
        else craque.pas(0);
      }
      // la bete secoue : un grondement hache a onze coups par seconde
      if (u > 0.04) {
        const w = u - 0.04;
        phG += (88 + 10 * Math.sin(TAU * 3 * w)) / sr;
        const v = scie(phG) * 0.7 + bruit() * 0.4;
        lpG += 0.16 * (v - lpG);
        const secoue = 0.35 + 0.65 * Math.abs(Math.sin(Math.PI * 11 * w));
        s += (lpG + gorge.pas(v) * 0.5) * secoue * Math.min(1, w / 0.05) * Math.exp(-w / 0.55) * 0.9;
      }
    }
    out[i] = s * Math.min(1, (DUREES.morsure - t) / 0.08);
  }
  return normaliser(out, 0.95);
}

/* ===========================================================================
   LE HURLEMENT — elle renonce
   ===========================================================================
   Le joueur a passe la ligne, la bete s'arrete derriere et hurle. Loin, voile,
   tremblant : ce n'est pas une menace, c'est une promesse — elle reviendra
   demain soir. */
export function hurlement(sr: number): Float32Array {
  const D = DUREES.hurlement;
  const n = Math.round(D * sr), out = new Float32Array(n);
  const bruit = alea(2027);
  const voile = new Filtre('bas', 1400, 0.7, sr);
  const souffleF = new Filtre('bande', 1100, 2, sr);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let f = t < 0.7 ? 290 + 230 * Math.pow(t / 0.7, 0.6) : 520 - 70 * Math.pow((t - 0.7) / (D - 0.7), 1.5);
    const vib = 4 + 7 * Math.min(1, Math.max(0, (t - 0.5) / 1.5));
    f += vib * Math.sin(TAU * 5.6 * t);
    ph += f / sr;
    let s = Math.sin(TAU * ph) + 0.35 * Math.sin(TAU * ph * 2) + 0.12 * Math.sin(TAU * ph * 3);
    s += souffleF.pas(bruit()) * 0.5;
    const a = Math.min(1, t / 0.35), r = Math.min(1, (D - t) / 0.9);
    out[i] = voile.pas(s) * a * a * (3 - 2 * a) * r;
  }
  return normaliser(out, 0.8);
}

/* ===========================================================================
   LA SALLE — la reponse d'un lieu vide
   ===========================================================================
   Deux canaux de bruit qui s'eteignent en s'assombrissant, et trois premiers
   echos : une ruelle de pierre la nuit. Sert a la reverberation de l'arrivee,
   de la rage et du hurlement. */
export function salle(sr: number): [Float32Array, Float32Array] {
  const n = Math.round(DUREES.salle * sr);
  const canaux: [Float32Array, Float32Array] = [new Float32Array(n), new Float32Array(n)];
  canaux.forEach((out, c) => {
    const bruit = alea(c ? 8081 : 5051);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const a = 0.05 + 0.85 * Math.exp(-t / 0.9);
      lp += a * (bruit() - lp);
      out[i] = lp * Math.exp(-t / 0.55);
    }
    for (const [d, g] of [[0.013 + c * 0.004, 0.9], [0.029 + c * 0.003, 0.6], [0.041 + c * 0.006, 0.45]]) {
      const k = Math.round(d * sr);
      if (k < n) out[k] += g;
    }
    normaliser(out, 0.9);
  });
  return canaux;
}
