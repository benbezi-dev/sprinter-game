// LA TRAQUE — ce qu'on entend quand la bete arrive.
//
// La bete etait muette pendant la course (audit du 16/10) : la jauge, le voile
// et la secousse disaient qu'elle approchait, et l'oreille n'entendait que la
// musique. Ce fichier lui donne un corps sonore, qui suit l'ECART a chaque pas
// — la seule grandeur qui compte dans ce mode :
//
//   a vingt metres   on l'entend avant de la voir : un grondement au loin ;
//   a sept metres    ELLE ARRIVE — une montee dissonante, coupee net, un impact.
//                    Une fois par nuit (deux si on l'a semee entre-temps) ;
//   en se rapprochant le grondement monte et s'eclaircit, le halètement se cale
//                    sur sa foulee, le coeur du coureur s'emballe, et la musique
//                    recule pour leur laisser la place ;
//   a deux metres    elle enrage, et aboie ;
//   la morsure       la machoire claque, et tout se tait derriere ;
//   la ligne passee  elle s'arrete, et hurle au loin.
//
// LES SONS SONT FABRIQUES A PART (halloween-traque-sons.ts), sans Web Audio, ce
// qui permet a un harnais de les verifier. Ici, on ne fait que les ranger dans
// la table du moteur et les jouer, sur la sortie du jeu : le bouton son les
// coupe comme le reste, et le film de la course les enregistre comme le reste.
//
// ILS SE FABRIQUENT AVANT LA COURSE, jamais pendant. Un quart de seconde de
// calcul sur un ordinateur, pres d'une seconde sur un telephone : on les
// prepare un par un a l'ouverture du tableau des nuits, entre deux images, et
// la course les trouve prets (sinon elle finit d'une traite, avant le decompte).
//
// PAS DE BRUIT DE PAS (17/10, « retire les bruits de pas de l'athlete »). La
// bete avait ses pattes sur les paves, deux coups par foulee des vingt metres :
// une dizaine de coups sourds par seconde, de la premiere a la derniere
// foulee, que l'oreille prenait pour les pas du coureur. Ils sont retires ; la
// foulee de la bete ne se fait plus entendre que par son souffle.
//
// FRAYEUR REDUITE (reglage du tableau des nuits) : pas de signal d'arrivee, pas
// d'aboiement, pas de coeur, un grondement plus bas. La bete reste audible —
// c'est l'information du mode —, elle cesse seulement de faire sursauter.

import { SprinterApp } from './engine';
import {
  grondement, souffle, coeur, arrivee, rage, morsure, hurlement, salle,
} from './halloween-traque-sons';

/** Les noms sous lesquels les sons entrent dans la table du moteur. */
const SON = {
  grondement: 'molosse-grondement',
  souffleIn: 'molosse-inspire', souffleOut: 'molosse-expire', coeur: 'molosse-coeur',
  arrivee: 'molosse-arrivee', rage: 'molosse-rage', morsure: 'molosse-morsure',
  hurlement: 'molosse-hurlement', salle: 'molosse-salle',
} as const;

/** A partir de quelle distance on l'entend, en metres. */
const AUDIBLE = 20;
/** La portee de la menace : la meme que la jauge, le voile et la secousse. */
const PORTEE = 12;
/** La distance du signal : ELLE ARRIVE. */
const SEUIL_ARRIVEE = 7;
/** Pour le rejouer, il faut l'avoir semee jusque-la. */
const REARME_ARRIVEE = 13;
/** La rage, a bout de gueule. */
const SEUIL_RAGE = 2.2;
/** Le niveau de la musique, celui sur lequel le moteur l'a reglee. */
const MUSIQUE = 0.34;

function moteur(): any {
  const A = SprinterApp as any;
  return A && A.Audio_ ? A.Audio_ : null;
}

/* ===========================================================================
   LE REGLAGE « FRAYEUR REDUITE »
=========================================================================== */

const CLE_FRAYEUR = 'halloween2026.frayeur';

/** Le joueur a-t-il demande moins de frayeur ? */
export function frayeurReduite(): boolean {
  try { return localStorage.getItem(CLE_FRAYEUR) === 'reduite'; } catch { return false; }
}

/** Poser le reglage. */
export function poserFrayeurReduite(v: boolean) {
  try {
    if (v) localStorage.setItem(CLE_FRAYEUR, 'reduite');
    else localStorage.removeItem(CLE_FRAYEUR);
  } catch { /* sans stockage, le reglage vaut le temps de la session */ }
  reduiteSession = v;
}
let reduiteSession: boolean | null = null;
function reduite(): boolean { return reduiteSession ?? frayeurReduite(); }

/* ===========================================================================
   LA FABRIQUE — un son par battement, avant la course
=========================================================================== */

type Fabrique = [string, (sr: number) => Float32Array | [Float32Array, Float32Array]];
const FABRIQUE: Fabrique[] = [
  [SON.grondement, grondement],
  [SON.souffleIn, sr => souffle(sr, false)],
  [SON.souffleOut, sr => souffle(sr, true)],
  [SON.coeur, coeur],
  [SON.arrivee, arrivee],
  [SON.rage, rage],
  [SON.morsure, morsure],
  [SON.hurlement, hurlement],
  [SON.salle, salle],
];

let enFabrique = false;

/** Fabriquer un son et le ranger dans la table du moteur. */
function fabriquer(A: any, [cle, f]: Fabrique) {
  if (A.buf[cle]) return;
  const ctx: AudioContext = A.ctx;
  const sr = ctx.sampleRate;
  const r = f(sr);
  const canaux = Array.isArray(r) ? r : [r];
  const buf = ctx.createBuffer(canaux.length, canaux[0].length, sr);
  canaux.forEach((c, i) => buf.getChannelData(i).set(c));
  A.buf[cle] = buf;
}

/** Le moteur a-t-il un contexte audio ? Le cree sans geste au besoin (muet). */
function contexte(): any {
  const A = moteur();
  if (!A) return null;
  if (!A.ctx && typeof A.preparer === 'function') A.preparer();
  return A.ctx && A.buf ? A : null;
}

/**
 * Preparer les sons de la traque, un par battement, sans rien bloquer.
 *
 * Appele a l'ouverture du tableau des nuits. On attend un peu que le panneau
 * ait fini d'entrer : sa montee est une animation, et un calcul de soixante
 * millisecondes en plein milieu la ferait broncher.
 */
export function preparerLaTraque() {
  const A = contexte();
  if (!A || enFabrique) return;
  if (FABRIQUE.every(([cle]) => A.buf[cle])) return;
  enFabrique = true;
  let i = 0;
  const suivant = () => {
    const B = contexte();
    if (!B) { enFabrique = false; return; }
    while (i < FABRIQUE.length && B.buf[FABRIQUE[i][0]]) i++;
    if (i >= FABRIQUE.length) { enFabrique = false; return; }
    try { fabriquer(B, FABRIQUE[i]); } catch { /* ce son manquera, pas les autres */ }
    i++;
    setTimeout(suivant, 40);
  };
  setTimeout(suivant, 700);
}

/** Finir d'une traite ce qui manque — au plus tard a l'armement de la nuit. */
function finirLaFabrique(A: any) {
  for (const f of FABRIQUE) {
    try { fabriquer(A, f); } catch { /* idem */ }
  }
}

/* ===========================================================================
   LA TRAQUE D'UNE NUIT
=========================================================================== */

type Traque = {
  ctx: AudioContext;
  /** Le bus de la bete : tout passe par lui, et lui seul se coupe. */
  bus: GainNode;
  /** La reverberation de la ruelle, et son envoi. */
  salle: ConvolverNode | null;
  /** La gorge en boucle. */
  gorge: AudioBufferSourceNode | null;
  gorgeFiltre: BiquadFilterNode;
  gorgeGain: GainNode;
  /** Le prochain battement du coeur, sur l'horloge audio. */
  prochainCoeur: number;
  /** Le signal d'arrivee peut-il partir ? */
  armeArrivee: boolean;
  derniereArrivee: number;
  derniereRage: number;
  /** Le dernier pas de la bete (performance.now) : sans pas, la course est arretee. */
  dernierPas: number;
  dernierReglage: number;
  /** Le chien de garde qui coupe tout quand la course s'arrete (pause, onglet cache). */
  veille: number;
  /** Inspire, expire, a tour de role. */
  expire: boolean;
  /** La nuit a rendu son verdict : les sons qui restent jouent jusqu'au bout. */
  fini: boolean;
  /** Le bus est-il ouvert (course en marche, son actif) ? */
  ouvert: boolean;
};

let traque: Traque | null = null;

/** Regler doucement un parametre, sans claquement. */
function vers(p: AudioParam, v: number, ctx: AudioContext, tau = 0.08) {
  try { p.setTargetAtTime(v, ctx.currentTime, tau); } catch { p.value = v; }
}

/** Jouer un son de la table sur le bus de la bete. */
function jouer(T: Traque, cle: string, gain: number,
               o: { rate?: number; quand?: number; envoi?: number } = {}): AudioBufferSourceNode | null {
  const A = moteur();
  if (!A || !A.on || !A.buf[cle] || gain <= 0) return null;
  try {
    const s = T.ctx.createBufferSource();
    s.buffer = A.buf[cle];
    if (o.rate) s.playbackRate.value = o.rate;
    const g = T.ctx.createGain();
    g.gain.value = gain;
    s.connect(g);
    g.connect(T.bus);
    if (o.envoi && T.salle) {
      const e = T.ctx.createGain();
      e.gain.value = o.envoi;
      g.connect(e);
      e.connect(T.salle);
    }
    s.start(Math.max(T.ctx.currentTime, o.quand || 0));
    return s;
  } catch { return null; }
}

/** La musique, au niveau `k` de son niveau ordinaire. */
function musique(k: number, tau = 0.25) {
  const A = moteur();
  if (!A || !A.gain || !A.ctx) return;
  vers(A.gain.gain, MUSIQUE * Math.max(0, Math.min(1, k)), A.ctx, tau);
}

/**
 * Armer la traque, au depart d'une nuit (armerLaNuit, halloween.ts).
 *
 * Le graphe se pose ici et se defait au rangement : un bus, la gorge en boucle
 * (muette tant que la bete est loin), la salle. Les autres sons sont des
 * sources d'un coup, posees sur le bus quand il le faut.
 */
export function armerLaTraque() {
  rangerLaTraque();
  const A = contexte();
  if (!A) return;
  finirLaFabrique(A);
  try {
    const ctx: AudioContext = A.ctx;
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(A.sortie || ctx.destination);
    let salleN: ConvolverNode | null = null;
    if (A.buf[SON.salle]) {
      salleN = ctx.createConvolver();
      salleN.buffer = A.buf[SON.salle];
      const retour = ctx.createGain();
      retour.gain.value = 0.55;
      salleN.connect(retour);
      retour.connect(bus);
    }
    const gorgeGain = ctx.createGain();
    gorgeGain.gain.value = 0;
    const gorgeFiltre = ctx.createBiquadFilter();
    gorgeFiltre.type = 'lowpass';
    gorgeFiltre.frequency.value = 400;
    gorgeFiltre.Q.value = 0.8;
    gorgeFiltre.connect(gorgeGain);
    gorgeGain.connect(bus);
    let gorge: AudioBufferSourceNode | null = null;
    if (A.buf[SON.grondement]) {
      gorge = ctx.createBufferSource();
      gorge.buffer = A.buf[SON.grondement];
      gorge.loop = true;
      gorge.connect(gorgeFiltre);
      gorge.start();
    }
    traque = {
      ctx, bus, salle: salleN, gorge, gorgeFiltre, gorgeGain,
      prochainCoeur: 0, armeArrivee: true, derniereArrivee: -99, derniereRage: -99,
      dernierPas: 0, dernierReglage: 0, veille: 0, expire: false, fini: false, ouvert: false,
    };
    // LE CHIEN DE GARDE. La traque ne vit que tant que la course avance : en
    // pause, onglet cache ou course figee, la bete ne fait plus de pas, et un
    // grondement qui continuerait par-dessus un menu de pause serait absurde.
    const T = traque;
    T.veille = window.setInterval(() => {
      if (traque !== T || T.fini) return;
      const A2 = moteur();
      const vivant = performance.now() - T.dernierPas < 250 && !!A2 && A2.on;
      if (!vivant && T.ouvert) { T.ouvert = false; vers(T.bus.gain, 0, T.ctx, 0.04); musique(1, 0.1); }
    }, 120);
  } catch { traque = null; }
}

/**
 * Un appui de la bete (deux par foulee, voir pasDuMolosse) : son souffle, une
 * fois par foulee. Aucun bruit de pas (voir l'en-tete).
 */
export function appuiDeLaBete(lourd: boolean, ecart: number) {
  const T = traque;
  if (!T || T.fini) return;
  const audible = Math.max(0, Math.min(1, 1 - ecart / AUDIBLE));
  if (audible <= 0) return;
  // le souffle se cale sur l'appui lourd : une respiration par foulee
  if (lourd && audible > 0.3) {
    T.expire = !T.expire;
    jouer(T, T.expire ? SON.souffleOut : SON.souffleIn,
          0.55 * Math.pow(audible, 1.6), { rate: 0.95 + Math.random() * 0.1 });
  }
}

/**
 * Suivre la bete, a chaque pas de la course (pasDuMolosse, 240 fois par
 * seconde). Les evenements partent tout de suite ; les niveaux ne se reglent
 * qu'une trentaine de fois par seconde, ce qui suffit a l'oreille.
 */
export function suivreLaTraque(ecart: number, t: number) {
  const T = traque;
  if (!T || T.fini) return;
  const A = moteur();
  const now = performance.now();
  T.dernierPas = now;
  if (!A || !A.on) return;
  const doux = reduite();
  if (!T.ouvert) { T.ouvert = true; vers(T.bus.gain, 0.95, T.ctx, 0.05); }

  const audible = Math.max(0, Math.min(1, 1 - ecart / AUDIBLE));
  const menace = Math.max(0, Math.min(1, 1 - ecart / PORTEE));

  // ELLE ARRIVE. Une fois, quand elle passe sous sept metres ; de nouveau
  // seulement si on l'a semee au-dela de treize, et pas avant quatre secondes.
  if (T.armeArrivee && ecart < SEUIL_ARRIVEE && t > 0.4) {
    T.armeArrivee = false;
    T.derniereArrivee = t;
    if (!doux) jouer(T, SON.arrivee, 0.85, { envoi: 0.5 });
    else jouer(T, SON.arrivee, 0.3, { envoi: 0.3 });
  } else if (!T.armeArrivee && ecart > REARME_ARRIVEE && t - T.derniereArrivee > 4) {
    T.armeArrivee = true;
  }

  // A BOUT DE GUEULE : elle enrage. Pas plus d'une fois toutes les trois secondes.
  if (!doux && ecart < SEUIL_RAGE && t - T.derniereRage > 3) {
    T.derniereRage = t;
    jouer(T, SON.rage, 0.75, { envoi: 0.35, rate: 0.96 + Math.random() * 0.08 });
  }

  // LE COEUR du coureur, sur l'horloge audio : de 95 a 175 battements, des
  // qu'elle entre dans la zone ou l'on peut encore faire quelque chose.
  if (!doux && menace > 0) {
    const ct = T.ctx.currentTime;
    if (T.prochainCoeur < ct) T.prochainCoeur = ct + 0.02;
    if (T.prochainCoeur < ct + 0.1) {
      jouer(T, SON.coeur, 0.3 + 0.55 * menace, { quand: T.prochainCoeur });
      T.prochainCoeur += 60 / (95 + 80 * menace);
    }
  }

  // LES NIVEAUX, une trentaine de fois par seconde.
  if (now - T.dernierReglage < 33) return;
  T.dernierReglage = now;
  // La gorge : un murmure a vingt metres, un grondement a bout de gueule.
  const gorge = Math.min(doux ? 0.32 : 0.7, 0.1 * audible + 0.62 * Math.pow(menace, 1.4));
  vers(T.gorgeGain.gain, gorge, T.ctx, 0.12);
  // Elle monte et s'eclaircit en approchant : la vitesse de lecture fait
  // grimper la voix et accelerer le raclement, le filtre s'ouvre.
  if (T.gorge) vers(T.gorge.playbackRate, 0.9 + 0.28 * menace, T.ctx, 0.2);
  vers(T.gorgeFiltre.frequency, 380 + 2200 * menace * menace, T.ctx, 0.15);
  // La musique recule pour lui laisser la place.
  musique(1 - (doux ? 0.3 : 0.6) * menace);
}

/** La bete a mordu : la machoire, puis le silence derriere. */
export function laBeteMord() {
  const T = traque;
  if (!T || T.fini) return;
  T.fini = true;
  const ct = T.ctx.currentTime;
  vers(T.gorgeGain.gain, 0, T.ctx, 0.05);
  if (!T.ouvert) vers(T.bus.gain, 0.95, T.ctx, 0.01);
  jouer(T, SON.morsure, 0.95, { envoi: 0.4 });
  // La musique se tait net, puis revient doucement sur l'ecran de fin.
  const A = moteur();
  if (A && A.gain) {
    try {
      A.gain.gain.cancelScheduledValues(ct);
      A.gain.gain.setTargetAtTime(0.02, ct, 0.03);
      A.gain.gain.setTargetAtTime(MUSIQUE, ct + 1.6, 0.8);
    } catch { /* tant pis */ }
  }
}

/** Le joueur est passe : la bete renonce, et hurle au loin. */
export function laBeteRenonce() {
  const T = traque;
  if (!T || T.fini) return;
  T.fini = true;
  vers(T.gorgeGain.gain, 0, T.ctx, 0.35);
  if (!T.ouvert) vers(T.bus.gain, 0.95, T.ctx, 0.01);
  jouer(T, SON.hurlement, reduite() ? 0.25 : 0.42, { quand: T.ctx.currentTime + 0.7, envoi: 0.9 });
  musique(1, 0.6);
}

/** Tout defaire : appele au rangement de la nuit, par quelque chemin qu'il arrive. */
export function rangerLaTraque() {
  const T = traque;
  traque = null;
  if (!T) return;
  clearInterval(T.veille);
  const ct = T.ctx.currentTime;
  try {
    // Un fondu court plutot qu'une coupure : le hurlement qui finit ne claque pas.
    T.bus.gain.cancelScheduledValues(ct);
    T.bus.gain.setTargetAtTime(0, ct, 0.08);
    if (T.gorge) T.gorge.stop(ct + 0.5);
    setTimeout(() => { try { T.bus.disconnect(); } catch { /* deja */ } }, 700);
  } catch { /* deja defait */ }
  if (!T.fini) musique(1, 0.2);
}
