// LE DEFI MEBA-MICKAEL ZEZE — sa musique, et comment elle entre dans le jeu.
//
// Un morceau fait a part, dans FL Studio, au tempo des ZEZE (150 BPM) : la
// fiche de production est dans docs/musique-defi-meba.md. Comme celui d'Aurel
// Manga (musique-defi-aurel.ts), c'est un fichier et non une synthese : il
// doit sonner comme on l'a produit.
//
// SA FORME EST UN CONTRAT AVEC LE DECOMPTE. La musique de course part au
// premier chiffre du 3-2-1 (engine.ts), et le pistolet tombe trois secondes
// plus tard. Le fichier ouvre donc sur INTRO secondes de montee qui retombent
// sur le coup de feu, puis une boucle de seize mesures ; seule la boucle se
// rejoue (`boucles`, voir Audio_.music) — l'intro ne revient pas en pleine
// course.
//
// MEME CONTRAT DE CHARGEMENT QUE LE MOLOSSE ET AUREL :
//  - il se charge quand la fiche du defi s'ouvre, quelques secondes avant la
//    course ; qui n'ouvre jamais le defi ne le telecharge jamais ;
//  - il est range sous le nom que porte le stade `defi-meba`
//    (STADES_HORS_SERIE), et `raceTrack` ne le choisit que s'il est la ;
//  - son absence ne casse rien : fichier pas encore livre, reseau lent ou
//    decodage refuse, la course part sur la musique des ZEZE (`musiqueRepli`).

import { SprinterApp } from './engine';
import { DEFI_VEDETTE_OUVERT } from './canal';

/** Le nom sous lequel le moteur range le morceau. Voir le stade `defi-meba`. */
export const NOM = 'defi_meba';

/** Le tempo des ZEZE : celui de `race3`, la finale intergalactique. */
export const BPM = 150;
/** Du debut du fichier au coup de pistolet : le decompte du one shot. */
export const INTRO = 3.0;
/** La boucle : seize mesures a 150 BPM. */
export const BOUCLE = 16 * 4 * 60 / BPM;   // 25,6 s

type Etat = 'absent' | 'en-cours' | 'pret' | 'refuse';
let etat: Etat = 'absent';

function moteur(): any {
  const A = (SprinterApp as any);
  return A && A.Audio_ ? A.Audio_ : null;
}

export function etatDeLaMusiqueDuDefi(): Etat { return etat; }

/** Charger le morceau et le poser sur le moteur. Pas de nouvel essai apres un refus. */
export async function chargerLaMusiqueDuDefi(): Promise<boolean> {
  if (etat === 'pret') return true;
  if (etat === 'en-cours' || etat === 'refuse') return false;
  if (!DEFI_VEDETTE_OUVERT) return false;
  const A = moteur();
  if (!A || !A.ok || !A.ctx) return false;

  etat = 'en-cours';
  try {
    // public/vedettes/, comme les portraits : le deploiement retire ce dossier
    // de la production (deploy.yml). Aucun import, pour la meme raison.
    const url = import.meta.env.BASE_URL.replace(/\/?$/, '/') + 'vedettes/defi-meba.mp3';
    const reponse = await fetch(url);
    if (!reponse.ok) throw new Error('reponse ' + reponse.status);
    const octets = await reponse.arrayBuffer();
    const buffer: AudioBuffer = await new Promise((resolu, rejete) => {
      A.ctx.decodeAudioData(octets, resolu, rejete);
    });
    // Un fichier plus court que l'intro et sa boucle n'est pas le bon : on le
    // refuse plutot que de boucler sur un morceau tronque.
    if (buffer.duration + 0.05 < INTRO + BOUCLE) throw new Error('trop court');
    A.buf[NOM] = buffer;
    A.boucles[NOM] = [INTRO, INTRO + BOUCLE];
    etat = 'pret';
    relayer();
    return true;
  } catch {
    etat = 'refuse';
    return false;
  }
}

/** La course a deja demarre sur le repli pendant le chargement : passer au sien, une fois. */
function relayer(): void {
  const A = moteur();
  const G = (SprinterApp as any).G;
  if (!A || !G || !A.on) return;
  if (G.state !== 'race' && G.state !== 'count') return;
  if (A.raceTrack(G.levelIdx) !== NOM) return;
  A.cur = null;
  A.music(NOM);
}

// --- SON CRI, « LET'S GOO ! » -------------------------------------------------
// Pris a l'une de ses videos, decoupe et pose dans public/vedettes/ : il le
// crie debout derriere ses blocs, avant de s'y installer (G.avantDepart, voir
// engine.ts et vedettes.ts). Meme contrat que la musique : charge a
// l'ouverture de la fiche, et son absence ne casse rien — la course part sans.

/**
 * LE CLAQUEMENT DE DEUX MAINS, ET D'UN SEUL HOMME (02/10, « les claps ne font
 * pas assez humain »). Celui du moteur (Audio_.mains) est celui d'une
 * TRIBUNE : dix rafales de bruit superposees sur vingt millisecondes. Pour un
 * seul homme, il sonnait comme une boite a rythmes.
 *
 * Un vrai claquement : un choc tres sec (la paume qui frappe, une milliseconde),
 * un second plus faible deux ou trois millisecondes apres (les doigts), et le
 * creux des mains qui resonne — un bruit filtre autour de 0,85 a 1,35 kHz,
 * eteint en vingt a vingt-cinq, des mains creusees qui frappent fort, pas
 * des mains timides. Et, dehors, le renvoi des tribunes un dixieme de
 * seconde plus tard. Chaque graine change la resonance, la secheresse et le
 * second choc : deux claquements ne sont jamais identiques.
 */
function clapHumain(ctx: AudioContext, graine: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.ceil(0.32 * sr);
  const buf = ctx.createBuffer(1, n, sr);
  const out = buf.getChannelData(0);
  let g = (graine * 2654435761) >>> 0;
  const alea = () => { g = (Math.imul(1664525, g) + 1013904223) >>> 0; return g / 4294967296; };
  const bruit = () => alea() * 2 - 1;
  // le creux des mains : un passe-bande (RBJ), sa frequence et sa largeur
  // (02/10, « 3 claps de mains forts et pas timides ») : des mains bien
  // creusees, qui frappent fort — la resonance plus grave, plus large
  const fc = 850 + 500 * alea(), Q = 1.2 + 1.0 * alea();
  const w0 = 2 * Math.PI * fc / sr, al = Math.sin(w0) / (2 * Q), a0 = 1 + al;
  const b0 = al / a0, b2 = -al / a0, a1 = -2 * Math.cos(w0) / a0, a2 = (1 - al) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const tau = 0.016 + 0.010 * alea();              // l'extinction du creux
  const t2 = 0.0015 + 0.002 * alea(), a2c = 0.35 + 0.3 * alea();  // les doigts
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const choc = (u: number) => (u < 0 ? 0 : (u < 0.0004 ? u / 0.0004 : Math.exp(-(u - 0.0004) / 0.0011)));
    const exc = bruit() * (choc(t) + a2c * choc(t - t2));
    const corps = bruit() * Math.exp(-t / tau) * (t < 0.0003 ? t / 0.0003 : 1);
    const x = corps;
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    // le choc garde ses aigus (un derive : le grave s'en va), le creux sonne
    const hp = exc - prev; prev = exc;
    out[i] = 0.7 * hp + 3.0 * y;
  }
  // le renvoi des tribunes : la meme chose, plus bas, plus sourde, plus tard
  const d = Math.floor((0.08 + 0.04 * alea()) * sr);
  const sourd = new Float32Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) { lp += 0.18 * (out[i] - lp); sourd[i] = lp; }
  for (let i = n - 1; i >= d; i--) out[i] += 0.5 * sourd[i - d];
  // FORT SANS SATURER LA SORTIE : la sortie du jeu n'a pas de limiteur
  // (Audio_.sortie), et le premier clap tombe sur le « GO ». Une saturation
  // douce resserre le claquement — plus de corps pour la meme crete —, puis
  // la crete est ramenee a 0,78 : avec le gain d'applaudir (1 a 1,15) et la
  // voix dessous, la somme reste sous 1.
  let pic = 0;
  for (let i = 0; i < n; i++) pic = Math.max(pic, Math.abs(out[i]));
  if (pic > 0) for (let i = 0; i < n; i++) out[i] = Math.tanh(2.2 * out[i] / pic) / Math.tanh(2.2);
  pic = 0;
  for (let i = 0; i < n; i++) pic = Math.max(pic, Math.abs(out[i]));
  if (pic > 0) for (let i = 0; i < n; i++) out[i] *= 0.78 / pic;
  return buf;
}

/** Le nom sous lequel le moteur range le cri (Audio_.sfx). */
export const CRI = 'meba_letsgo';
/** Et le claquement de ses mains, qui l'accompagne (engine.ts, applaudir). */
export const CLAP = 'meba_clap';
let cri: Etat = 'absent';

export async function chargerLeCri(): Promise<boolean> {
  if (cri === 'pret') return true;
  if (cri === 'en-cours' || cri === 'refuse') return false;
  if (!DEFI_VEDETTE_OUVERT) return false;
  const A = moteur();
  if (!A || !A.ok || !A.ctx) return false;
  cri = 'en-cours';
  try {
    const url = import.meta.env.BASE_URL.replace(/\/?$/, '/') + 'vedettes/meba-letsgo.mp3';
    const reponse = await fetch(url);
    if (!reponse.ok) throw new Error('reponse ' + reponse.status);
    const octets = await reponse.arrayBuffer();
    A.buf[CRI] = await new Promise<AudioBuffer>((ok, ko) => A.ctx.decodeAudioData(octets, ok, ko));
    // ET SES MAINS : quatre claquements d'homme, un peu differents
    // (clapHumain) ; engine.ts, applaudir, en tire un a chaque frappe
    for (let i = 0; i < 4; i++) A.buf[`${CLAP}_${i}`] = clapHumain(A.ctx, 11 + 7 * i);
    A.buf[CLAP] = A.buf[`${CLAP}_0`];
    cri = 'pret';
    return true;
  } catch {
    cri = 'refuse';
    return false;
  }
}
