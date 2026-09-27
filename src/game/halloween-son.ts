// LA NUIT DU MOLOSSE — le son de la bete.
//
// CE FICHIER A ETE ANNONCE AVANT D'EXISTER. Le commentaire en tete de
// halloween.ts renvoyait a « halloween-son.ts » depuis le premier jour du
// mode, et le fichier n'etait pas la : la bete arrivait derriere le joueur en
// silence complet. On la voyait dans un coin de l'ecran quand il etait deja
// trop tard, on sentait ses foulees dans le chassis de l'appareil, et c'etait
// tout. Le voici.
//
// LES COURBES NE SONT PAS ICI. Elles vivent dans halloween-son-loi.js, sans le
// moindre import, pour qu'un harnais les verifie sans navigateur ni contexte
// audio (tools/halloween-son-test.mjs). Ce fichier-ci ne fait que du cablage :
// il fabrique cinq sons, monte trois bus, et les nourrit image par image avec
// des nombres qu'il ne calcule pas.
//
// TROIS BUS, ET LA RAISON DE CHACUN.
//
//   LA BETE      grondement et foulees, DERRIERE un filtre passe-bas dont la
//                coupure suit la distance. C'est lui qui fait toute la
//                spatialisation : un son lointain perd ses aigus avant de
//                perdre son volume, et l'oreille s'en sert pour estimer une
//                distance depuis bien avant qu'on invente les haut-parleurs.
//   LE JOUEUR    son coeur. Il ne passe PAS par le filtre de la bete : il bat
//                dans sa poitrine, pas a douze metres derriere lui. Les
//                melanger aurait etouffe le coeur au moment precis ou il doit
//                s'entendre le mieux.
//   LE STINGER   seul, pour qu'on puisse l'attenuer sans toucher au reste —
//                c'est ce que demande l'option « frayeur reduite ».
//
// TOUT SE BRANCHE SUR `Audio_.sortie`, et non sur `ctx.destination`. Deux
// consequences, toutes les deux voulues : le bouton son du jeu coupe la bete
// comme le reste, et le replay de la course l'enregistre (voir `prise` dans
// sprinter-app.js). Une bete branchee en direct sur la sortie aurait continue
// de gronder dans un jeu qu'on a mis en sourdine, et aurait disparu des
// videos.
//
// LES CINQ SONS SONT SYNTHETISES, PAS CHARGES. C'est la regle du jeu — tout
// sort d'oscillateurs et de bruit, sauf la musique du mode qui est une piece
// ecrite. Un grognement enregistre aurait pese plus lourd que les treize
// nuits reunies, et il aurait fallu le charger avant de pouvoir faire peur.
//
// ON NE FABRIQUE RIEN TANT QU'UNE NUIT N'EST PAS ARMEE. Le contexte audio
// n'existe qu'apres le premier geste du joueur, et les cinq tampons coutent
// une poignee de millisecondes qu'il est inutile de payer dans un jeu ou
// personne n'ouvrira ce mode.

import { SprinterApp } from './engine';
import { HALLOWEEN_OUVERT } from './canal';
import {
  PLAFOND, grondement, coupure, foulee as gainFoulee,
  secondesDeBete, coeur, stinger as instantDuStinger, SILENCE, attenue,
} from './halloween-son-loi.js';

/** Le moteur audio du jeu, s'il est ouvert. */
function moteur(): any {
  const A = SprinterApp as any;
  return A && A.Audio_ && A.Audio_.ok ? A.Audio_ : null;
}

/* ---------------------------------------------------------------------------
   LES CINQ SONS
   ---------------------------------------------------------------------------
   Ecrits echantillon par echantillon dans des tampons, une fois pour toutes.
   Les jouer revient ensuite a brancher une source sur un bus : c'est ce que le
   moteur fait deja pour ses bruitages, et c'est ce qui tient les soixante
   images par seconde sur un telephone de milieu de gamme — cinq foulees par
   seconde, cinq sources, aucun calcul.
--------------------------------------------------------------------------- */

/** Un generateur de bruit reproductible. Le meme grondement a chaque partie. */
function bruit(graine: number): () => number {
  let s = graine | 0;
  return () => {
    s = (Math.imul(1103515245, s) + 12345) & 0x7fffffff;
    return s / 0x3fffffff - 1;
  };
}

/**
 * UNE FOULEE — le son qui porte toute l'information du mode.
 *
 * Deux couches, et il faut les deux :
 *
 *   LA MASSE    une sinusoide qui tombe de 92 a 41 hertz en soixante
 *               millisecondes. C'est le poids de l'animal sur le sol, et
 *               c'est ce qui passe a travers un haut-parleur de telephone.
 *   LES GRIFFES une gifle de bruit tres courte, quinze millisecondes. Elle
 *               n'existe que pour etre COUPEE par le filtre de distance :
 *               tant que la bete est loin, on ne l'entend pas du tout ; sur
 *               le dos du joueur, elle passe, et c'est elle qui fait le saut
 *               au coeur.
 *
 * `lourde` distingue les deux temps du galop. Le temps leger n'est pas juste
 * plus faible : il est aussi plus haut et plus court — les anterieurs posent
 * moins de poids sur moins de surface. Deux copies du meme son a deux volumes
 * auraient fait un metronome.
 */
function tamponFoulee(ctx: AudioContext, lourde: boolean): AudioBuffer {
  const sr = ctx.sampleRate;
  const duree = lourde ? 0.30 : 0.22;
  const n = Math.ceil(duree * sr);
  const buf = ctx.createBuffer(1, n, sr);
  const ch = buf.getChannelData(0);
  const nz = bruit(lourde ? 20261031 : 20261101);

  const f0 = lourde ? 92 : 128;
  const f1 = lourde ? 41 : 62;
  const chute = lourde ? 0.060 : 0.042;
  let phase = 0;

  for (let i = 0; i < n; i++) {
    const t = i / sr;
    // La masse. La frequence tombe vite puis se pose : c'est la signature d'un
    // impact, par opposition a une note, qui garde sa hauteur.
    const f = f1 + (f0 - f1) * Math.exp(-t / chute);
    phase += f / sr;
    const env = Math.exp(-t * (lourde ? 14 : 19));
    let v = Math.sin(2 * Math.PI * phase) * env * (lourde ? 1 : 0.74);

    // Les griffes. Quinze millisecondes, et un passe-haut du pauvre : la
    // difference de deux echantillons de bruit successifs retire le grave et
    // ne laisse que le grain, qui est exactement ce que le filtre de distance
    // doit pouvoir supprimer.
    if (t < 0.015) {
      const g = nz();
      const gPrec = nz();
      v += (g - gPrec) * 0.5 * Math.exp(-t * 190) * (lourde ? 0.55 : 0.68);
    }
    ch[i] = v;
  }
  return normaliser(buf, 0.92);
}

/**
 * LE GRONDEMENT — deux secondes bouclees.
 *
 * Un bourdon a vingt-neuf hertz, sa quinte legerement desaccordee, et du bruit
 * filtre par une moyenne glissante. Le desaccord compte : deux graves justes
 * fusionnent en une seule note, qu'on entend comme un ronflement de machine ;
 * desaccordes d'un demi-hertz, ils battent lentement l'un contre l'autre, et
 * ce battement se lit comme quelque chose qui respire.
 *
 * LA BOUCLE EST RACCORDEE PAR UN FONDU CROISE, sans quoi le point de raccord
 * claque toutes les deux secondes — et un clic regulier dans un son
 * d'ambiance devient la seule chose qu'on entend.
 */
function tamponGrondement(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const duree = 2.0;
  const raccord = 0.25;
  const n = Math.ceil(duree * sr);
  const nz = bruit(20261031);
  const brut = new Float32Array(n + Math.ceil(raccord * sr));

  let lisse = 0;
  for (let i = 0; i < brut.length; i++) {
    const t = i / sr;
    // Moyenne glissante a un pole : un passe-bas tres doux, qui transforme le
    // bruit blanc en souffle grave.
    lisse += (nz() - lisse) * 0.035;
    brut[i] = Math.sin(2 * Math.PI * 29 * t) * 0.55
            + Math.sin(2 * Math.PI * 43.5 * t) * 0.22
            + lisse * 2.6;
  }

  const buf = ctx.createBuffer(1, n, sr);
  const ch = buf.getChannelData(0);
  const r = Math.ceil(raccord * sr);
  for (let i = 0; i < n; i++) ch[i] = brut[i];
  // Le fondu croise : la queue revient se poser sur la tete.
  for (let i = 0; i < r; i++) {
    const k = i / r;
    ch[i] = ch[i] * k + brut[n + i] * (1 - k);
  }
  return normaliser(buf, 0.80);
}

/**
 * LE COEUR — deux battements, le second plus doux.
 *
 * C'est celui du JOUEUR. Un coeur ne claque pas : il pousse. D'ou une attaque
 * lente (douze millisecondes) la ou les foulees attaquent en une. Un coeur a
 * attaque rapide sonne comme un coup frappe a une porte, ce qui raconte une
 * autre histoire.
 *
 * Le tampon contient le cycle complet — lub, dub, et le silence apres. On le
 * rejoue a la cadence voulue en changeant sa vitesse de lecture : un seul
 * tampon pour tous les tempos, et le coeur qui s'emballe monte legerement en
 * hauteur au passage, ce qui est exactement ce que fait un vrai coeur qui
 * s'emballe.
 */
function tamponCoeur(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.ceil(0.68 * sr);
  const buf = ctx.createBuffer(1, n, sr);
  const ch = buf.getChannelData(0);

  const coup = (debut: number, force: number, hauteur: number) => {
    const i0 = Math.floor(debut * sr);
    const duree = 0.19;
    let phase = 0;
    for (let i = 0; i < duree * sr; i++) {
      const k = i0 + i; if (k >= n) break;
      const t = i / sr;
      const f = hauteur * (0.55 + 0.45 * Math.exp(-t / 0.028));
      phase += f / sr;
      let env = Math.exp(-t * 17);
      // L'attaque lente, qui fait la difference entre pousser et frapper.
      const montee = 0.012 * sr;
      if (i < montee) env *= i / montee;
      ch[k] += Math.sin(2 * Math.PI * phase) * env * force;
    }
  };

  coup(0.00, 1.00, 58);
  coup(0.26, 0.64, 48);
  return normaliser(buf, 0.90);
}

/**
 * LE STINGER — un par nuit, a un moment imprevisible.
 *
 * CE N'EST PAS UN CRI. Un pic a plein volume fait sursauter une fois, agace la
 * deuxieme, et fait baisser le son la troisieme — et le joueur qui a baisse le
 * son a perdu le seul instrument qui lui disait ou etait le chien. On perdrait
 * le mode pour un frisson.
 *
 * C'est donc une MONTEE : trois sinusoides desaccordees qui glissent vers le
 * haut sur huit dixiemes de seconde, avec un souffle qui enfle dessous. Ca ne
 * frappe pas, ca serre. Et comme le grondement se coupe quatre dixiemes de
 * seconde avant (voir SILENCE), ca tombe dans une oreille qui cherchait
 * quelque chose.
 */
function tamponStinger(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const duree = 1.15;
  const n = Math.ceil(duree * sr);
  const buf = ctx.createBuffer(1, n, sr);
  const ch = buf.getChannelData(0);
  const nz = bruit(1310);

  const voix = [
    { f0: 110, f1: 720, amp: 0.55, decal: 0 },
    { f0: 113, f1: 731, amp: 0.40, decal: 0.5 },
    { f0: 218, f1: 1448, amp: 0.26, decal: 0.25 },
  ];
  for (const v of voix) {
    let phase = v.decal;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const k = Math.min(1, t / 0.80);
      // Montee geometrique : l'oreille entend les octaves, pas les hertz.
      const f = v.f0 * Math.pow(v.f1 / v.f0, k * k);
      phase += f / sr;
      // Enfle, puis lache d'un coup a la fin de la montee.
      const env = t < 0.80 ? Math.pow(k, 1.6) : Math.exp(-(t - 0.80) * 11);
      ch[i] += Math.sin(2 * Math.PI * phase) * env * v.amp;
    }
  }
  let lisse = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    lisse += (nz() - lisse) * 0.12;
    const k = Math.min(1, t / 0.80);
    const env = t < 0.80 ? k * k : Math.exp(-(t - 0.80) * 9);
    ch[i] += lisse * 1.5 * env * 0.5;
  }
  return normaliser(buf, 0.88);
}

/** Ramener un tampon a une crete donnee, avec un fondu aux deux bouts. */
function normaliser(buf: AudioBuffer, crete: number): AudioBuffer {
  const ch = buf.getChannelData(0);
  let pk = 0;
  for (let i = 0; i < ch.length; i++) pk = Math.max(pk, Math.abs(ch[i]));
  const g = pk > 0.0001 ? crete / pk : 1;
  const fondu = Math.min(64, (ch.length / 8) | 0);
  for (let i = 0; i < ch.length; i++) {
    let v = ch[i] * g;
    if (v > 1) v = 1; else if (v < -1) v = -1;
    if (i < fondu) v *= i / fondu;
    else if (i > ch.length - fondu) v *= (ch.length - i) / fondu;
    ch[i] = v;
  }
  return buf;
}

/* ---------------------------------------------------------------------------
   LE CABLAGE
--------------------------------------------------------------------------- */

type Montage = {
  ctx: AudioContext;
  /** Le bus de la bete, derriere le filtre de distance. */
  bete: GainNode;
  filtre: BiquadFilterNode;
  /** Le coeur du joueur, qui ne passe pas par le filtre. */
  joueur: GainNode;
  /** Le stinger, seul, pour pouvoir l'attenuer sans toucher au reste. */
  stinger: GainNode;
  tampons: {
    lourde: AudioBuffer; legere: AudioBuffer;
    grondement: AudioBuffer; coeur: AudioBuffer; stinger: AudioBuffer;
  };
  /** La source bouclee du grondement, vivante tant que la nuit dure. */
  bourdon: AudioBufferSourceNode | null;
  gainBourdon: GainNode | null;
};

let montage: Montage | null = null;

/** L'etat de la nuit en cours, du point de vue du son. */
type Etat = {
  /** L'instant du stinger, en secondes de course. */
  quandStinger: number;
  stingerJoue: boolean;
  /** Le prochain battement de coeur, en secondes de course. */
  prochainCoeur: number;
  /** Le chrono de la derniere image, pour ne pas rejouer le passe. */
  dernierT: number;
  /** Le chrono du dernier reglage applique. Voir PAS_DE_SON. */
  dernierReglage: number;
};

let etat: Etat | null = null;

/** La frayeur reduite. Posee par l'ecran des options, lue a chaque son. */
let reduite = false;

/**
 * Le joueur demande-t-il moins de mouvement ?
 *
 * Tant que l'option « frayeur reduite » n'a pas son interrupteur, on prend ce
 * que le systeme dit deja — le jeu le respecte ailleurs (voir lib/mouvement et
 * game/passage). Quelqu'un qui a demande moins d'animations a son systeme n'a
 * pas a le redemander a ce mode.
 */
function reduiteParDefaut(): boolean {
  try {
    return typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { return false; }
}

/** Poser la frayeur reduite. L'ecran des options appellera ceci. */
export function poserFrayeurReduite(v: boolean) { reduite = v; }

/** La frayeur reduite est-elle active ? */
export function frayeurReduite(): boolean { return reduite; }

/**
 * Monter le cablage, une fois.
 *
 * Rend `null` si le contexte audio n'est pas ouvert — ce qui arrive avant le
 * premier geste du joueur. Ce n'est pas une erreur : la nuit se joue alors
 * sans la bete, et le premier appui rouvrira la question.
 */
function monter(): Montage | null {
  if (montage) return montage;
  const A = moteur();
  if (!A || !A.ctx || !A.sortie) return null;
  try {
    const ctx: AudioContext = A.ctx;

    const filtre = ctx.createBiquadFilter();
    filtre.type = 'lowpass';
    // Une resonance legere : elle donne du relief a la coupure, si bien qu'on
    // ENTEND le filtre s'ouvrir a mesure que la bete approche au lieu de
    // simplement entendre le son devenir plus present.
    filtre.Q.value = 0.9;
    filtre.frequency.value = coupure(Infinity);

    const bete = ctx.createGain();
    bete.gain.value = 1;
    filtre.connect(bete);
    bete.connect(A.sortie);

    const joueur = ctx.createGain();
    joueur.gain.value = 1;
    joueur.connect(A.sortie);

    const st = ctx.createGain();
    st.gain.value = 1;
    st.connect(A.sortie);

    montage = {
      ctx, bete, filtre, joueur, stinger: st,
      tampons: {
        lourde: tamponFoulee(ctx, true),
        legere: tamponFoulee(ctx, false),
        grondement: tamponGrondement(ctx),
        coeur: tamponCoeur(ctx),
        stinger: tamponStinger(ctx),
      },
      bourdon: null, gainBourdon: null,
    };
    return montage;
  } catch {
    // Un navigateur qui refuse un noeud ne doit pas faire tomber la course :
    // on court sans le son de la bete, ce qui est l'etat d'avant ce fichier.
    return null;
  }
}

/** Le son est-il coupe par le joueur ? */
function muet(): boolean {
  const A = moteur();
  return !A || !A.on;
}

/**
 * ARMER LE SON D'UNE NUIT.
 *
 * Appele par `armerLaNuit`, juste apres que la bete soit posee derriere la
 * ligne. Tire l'instant du stinger, lance le grondement a volume nul, et
 * remet le coeur a zero.
 */
export function armerLeSon(imparti: number) {
  if (!HALLOWEEN_OUVERT) return;
  reduite = reduite || reduiteParDefaut();
  etat = {
    quandStinger: instantDuStinger(imparti, Math.random()),
    stingerJoue: false,
    prochainCoeur: 0,
    dernierT: 0,
    dernierReglage: -1,
  };
  const m = monter();
  if (!m || muet()) return;
  try {
    // Le grondement tourne en boucle d'un bout a l'autre de la nuit, a un
    // volume que la loi pilote. Le demarrer et l'arreter a chaque entree dans
    // la portee aurait fait claquer le graphe au pire moment — et un
    // grondement qui commence est un grondement qu'on entend commencer, ce qui
    // trahit la distance au lieu de la raconter.
    const src = m.ctx.createBufferSource();
    src.buffer = m.tampons.grondement;
    src.loop = true;
    const g = m.ctx.createGain();
    g.gain.value = 0;
    src.connect(g); g.connect(m.filtre);
    src.start();
    m.bourdon = src;
    m.gainBourdon = g;
  } catch { /* on court sans */ }
}

/** Couper tout, et tout oublier. Appele par `rangerLaNuit`. */
export function rangerLeSon() {
  etat = null;
  const m = montage;
  if (!m) return;
  try {
    if (m.bourdon) { m.bourdon.stop(); m.bourdon.disconnect(); }
    if (m.gainBourdon) m.gainBourdon.disconnect();
  } catch { /* deja arrete */ }
  m.bourdon = null;
  m.gainBourdon = null;
}

/**
 * UNE IMAGE DE SON.
 *
 * Appele par `pasDuMolosse`, apres que la position de la bete soit connue.
 * Trois choses : le grondement suit la distance, le coeur bat s'il doit
 * battre, et le stinger tombe s'il est l'heure.
 *
 * ON ECRIT LES GAINS SANS RAMPE. `setValueAtTime` a soixante images par
 * seconde donne un escalier de seize millisecondes, sous le seuil ou l'oreille
 * entend une marche — et les rampes programmees s'empilaient dans la file du
 * contexte, ou elles finissaient par lutter les unes contre les autres quand
 * une image sautait.
 *
 * ET ON N'EN APPLIQUE QU'UNE SUR QUATRE. L'appelant tourne a 240 Hz — c'est le
 * pas fixe de la boucle de course (voir updateLogic dans engine.ts), et non la
 * cadence d'affichage. Regler deux parametres audio deux cent quarante fois
 * par seconde ne s'entend pas davantage qu'a soixante : l'oreille ne distingue
 * pas deux rampes de gain espacees de quatre millisecondes. Cela coute en
 * revanche quatre fois le travail, sur le seul budget qui compte ici — les
 * soixante images par seconde d'un telephone de milieu de gamme.
 *
 * Le pire cas est l'argument decisif : quand une image tarde, la boucle
 * rattrape son retard en enchainant les pas d'un coup. Une course qui bloque
 * cent millisecondes rejouait vingt-quatre reglages a la suite, dont
 * vingt-trois pour rien — exactement au moment ou le telephone n'en avait pas
 * les moyens.
 *
 * La detection du stinger et le battement du coeur restent justes : ils se
 * lisent sur `t`, et un retard d'un soixantieme de seconde ne se percoit pas
 * sur un evenement qu'on n'attend pas.
 */
const PAS_DE_SON = 1 / 60;

export function imageDeSon(ecart: number, vitesse: number, t: number) {
  const e = etat;
  const m = montage;
  if (!e || !m || muet()) return;
  if (t - e.dernierReglage < PAS_DE_SON) return;
  e.dernierReglage = t;

  try {
    // Le grondement, et la coupure qui dit la distance.
    if (m.gainBourdon) {
      m.gainBourdon.gain.value = attenue(grondement(ecart), reduite, false);
    }
    m.filtre.frequency.value = coupure(ecart);

    // LE SILENCE AVANT LE STINGER. On coupe le lit quatre dixiemes de seconde
    // avant, et on le laisse revenir apres : une oreille qui vient de perdre
    // un son qu'elle suivait le cherche, et une oreille qui cherche est une
    // oreille ouverte.
    if (!e.stingerJoue && m.gainBourdon
        && t > e.quandStinger - SILENCE && t <= e.quandStinger) {
      m.gainBourdon.gain.value = 0;
    }

    // Le stinger, une fois, quand on franchit son instant.
    if (!e.stingerJoue && t >= e.quandStinger && e.dernierT < e.quandStinger) {
      e.stingerJoue = true;
      const src = m.ctx.createBufferSource();
      const g = m.ctx.createGain();
      src.buffer = m.tampons.stinger;
      g.gain.value = attenue(PLAFOND * 0.62, reduite, true);
      src.connect(g); g.connect(m.stinger);
      src.start();
    }

    // LE COEUR. Il se programme a son propre tempo, qui change a chaque
    // battement : on ne replanifie jamais un battement deja pose, sans quoi un
    // tempo qui monte reculerait le battement suivant.
    const c = coeur(secondesDeBete(ecart, vitesse));
    if (c) {
      if (e.prochainCoeur <= 0) e.prochainCoeur = t;
      if (t >= e.prochainCoeur) {
        const src = m.ctx.createBufferSource();
        const g = m.ctx.createGain();
        src.buffer = m.tampons.coeur;
        // Le tampon dure un cycle a 88 battements ; on l'accelere pour monter.
        src.playbackRate.value = c.bpm / 88;
        g.gain.value = attenue(c.gain, reduite, false);
        src.connect(g); g.connect(m.joueur);
        src.start();
        e.prochainCoeur = t + 60 / c.bpm;
      }
    } else {
      e.prochainCoeur = 0;
    }

    e.dernierT = t;
  } catch { /* une image sans son ne merite pas de faire tomber la course */ }
}

/**
 * UNE FOULEE DE LA BETE.
 *
 * Appele par `pasDuMolosse` au moment precis ou une demi-foulee change — le
 * meme instant qui fait trembler le sol. Le son et la secousse partent donc
 * ensemble, ce qui n'est pas un detail : deux signaux desynchronises de
 * quelques dizaines de millisecondes se lisent comme deux evenements, et l'on
 * perd la sensation d'un poids qui tombe.
 */
export function fouleeDeLaBete(ecart: number, lourde: boolean) {
  const m = montage;
  if (!m || !etat || muet()) return;
  const gain = attenue(gainFoulee(ecart, lourde), reduite, false);
  // Hors de portee, `gainFoulee` rend zero : on ne branche alors rien du tout
  // plutot qu'une source silencieuse, cinq fois par seconde, pendant toute la
  // course.
  if (gain <= 0.001) return;
  try {
    const src = m.ctx.createBufferSource();
    const g = m.ctx.createGain();
    src.buffer = lourde ? m.tampons.lourde : m.tampons.legere;
    // Un galop n'est pas une boucle : chaque appui tombe un peu differemment.
    // Trois pour cent de variation de hauteur suffisent a ce que l'oreille
    // cesse de reconnaitre un echantillon repete.
    src.playbackRate.value = 0.97 + Math.random() * 0.06;
    g.gain.value = gain;
    src.connect(g); g.connect(m.filtre);
    src.start();
  } catch { /* une foulee muette */ }
}

/**
 * LA MORSURE.
 *
 * Tout se coupe, sauf ce qui est deja parti. La cinematique prend la suite, et
 * un grondement qui continuerait sous l'ecran de fin dirait que la bete est
 * encore en train d'arriver — alors qu'elle est arrivee.
 */
export function morsureAuSon() {
  const m = montage;
  if (m && m.gainBourdon) {
    try { m.gainBourdon.gain.value = 0; } catch { /* rien */ }
  }
  if (etat) etat.prochainCoeur = 0;
}

/** Ce que le harnais et l'ecran de test ont besoin de savoir. */
export function etatDuSon() {
  return etat ? { ...etat, monte: !!montage, reduite } : null;
}
