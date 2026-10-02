// LE DEFI MEBA-MICKAEL ZEZE — sa musique, et comment elle entre dans le jeu.
//
// Un morceau calcule a part, au tempo des ZEZE (150 BPM) :
// tools/musique/defi-meba.mjs l'ecrit dans public/vedettes/defi-meba.mp3,
// sur le scenario de la fiche de production (docs/musique-defi-meba.md).
// Comme celui d'Aurel Manga (musique-defi-aurel.ts), c'est un fichier et non
// une synthese au chargement : il doit sonner comme on l'a produit.
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
 * SES MAINS SONT CELLES DE SON MORCEAU (02/10, a sa demande : « recupere les
 * claps pour les claps de boost sur la presentation »). Les trois frappes
 * d'avant les blocs sont les claps de la batterie de sa musique
 * (tools/musique/defi-meba.mjs, `mains`) : meme calcul, memes graines, et la
 * meme salle — ses frappes et le morceau qui demarre au decompte se repondent.
 *
 * Un claquement, c'est trois chocs serres (la paume, puis les doigts) et le
 * creux des mains qui resonne, autour de 1 a 1,9 kHz ; celui-ci en reunit cinq,
 * un peu decales — des mains qui frappent fort, a plusieurs, comme sur un
 * temps de la batterie. Puis la reverberation du stade, celle du morceau
 * (Freeverb, piece 0,9) : le retour des tribunes.
 */

/** Le hasard a graines du morceau : les memes claps qu'au calcul de la musique. */
function hasard(s: number): () => number {
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Le filtre a variables d'etat du morceau (Simper) : bande et haut. */
class Filtre {
  s1 = 0; s2 = 0; bande = 0; haut = 0;
  pas(x: number, fc: number, q: number, sr: number): void {
    const g = Math.tan(Math.PI * Math.min(fc, sr * 0.45) / sr), k = 1 / q;
    const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
    const v3 = x - this.s2, v1 = a1 * this.s1 + a2 * v3, v2 = this.s2 + a2 * this.s1 + a3 * v3;
    this.s1 = 2 * v1 - this.s1; this.s2 = 2 * v2 - this.s2;
    this.bande = v1; this.haut = x - k * v1 - v2;
  }
}

/** Un claquement de mains : trois chocs serres, puis le creux des paumes. */
function mainsSeules(r: () => number, sr: number): Float32Array {
  const o = new Float32Array(Math.round(0.24 * sr)), f = new Filtre();
  const fc = 950 + 950 * r(), q = 1.3 + 1.4 * r();
  const chocs = [0, 0.0055 + 0.004 * r(), 0.012 + 0.005 * r()];
  const corps = 0.026 + 0.022 * r();
  for (let i = 0; i < o.length; i++) {
    const t = i / sr;
    let e = 0;
    for (let c = 0; c < 3; c++) if (t >= chocs[c]) e += Math.exp(-(t - chocs[c]) / 0.0021) * (c ? 0.72 : 1);
    if (t >= chocs[2]) e += 0.5 * Math.exp(-(t - chocs[2]) / corps);
    f.pas((r() * 2 - 1) * e, fc, q, sr);
    o[i] = f.bande * 2.4 + 0.3 * f.haut;
  }
  return o;
}

/** La reverberation du morceau (Freeverb : huit peignes, quatre passe-tout). */
function salle(entree: Float32Array[], sr: number): Float32Array[] {
  const k = sr / 44100, PEIGNES = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], PT = [556, 441, 341, 225];
  const fb = 0.9 * 0.28 + 0.7, dmp = 0.32 * 0.4, pre = Math.round(0.028 * sr), n = entree[0].length;
  return entree.map((x, c) => {
    const y = new Float32Array(n);
    const peignes = PEIGNES.map((l) => ({ b: new Float32Array(Math.round((l + c * 23) * k)), i: 0, f: 0 }));
    const pts = PT.map((l) => ({ b: new Float32Array(Math.round((l + c * 23) * k)), i: 0 }));
    let hp = 0, hpx = 0;
    for (let j = 0; j < n; j++) {
      const brut = j >= pre ? x[j - pre] : 0;
      hp = 0.985 * (hp + brut - hpx); hpx = brut;
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
      y[j] = s;
    }
    return y;
  });
}

/** Le clap n° k de la batterie du morceau (graine 100 + k), et sa salle. */
function clapDuMorceau(ctx: AudioContext, k: number): AudioBuffer {
  const sr = ctx.sampleRate, r = hasard(100 + k);
  const n = Math.round(1.5 * sr);
  const sec = [new Float32Array(n), new Float32Array(n)];
  // cinq mains, a quelques millisecondes les unes des autres, chacune a sa place
  for (let v = 0; v < 5; v++) {
    const s = mainsSeules(r, sr);
    const dec = Math.round(Math.abs((r() + r() + r() - 1.5) * 0.004) * sr);
    const a = ((r() * 2 - 1) * 0.92 + 1) * Math.PI / 4, g = 0.55 + 0.45 * r();
    for (let i = 0; i < s.length && i + dec < n; i++) {
      sec[0][i + dec] += s[i] * Math.cos(a) * g;
      sec[1][i + dec] += s[i] * Math.sin(a) * g;
    }
  }
  let pic = 0;
  for (const x of sec) for (let i = 0; i < n; i++) pic = Math.max(pic, Math.abs(x[i]));
  if (pic > 0) for (const x of sec) for (let i = 0; i < n; i++) x[i] /= pic;
  // le stade, au dosage du morceau (envoi 0,18, retour 1,25, pour une batterie a 0,95)
  const queue = salle(sec, sr);
  const buf = ctx.createBuffer(2, n, sr);
  // FORT SANS SATURER LA SORTIE : la sortie du jeu n'a pas de limiteur
  // (Audio_.sortie), et le premier clap tombe sur le « GO ». La crete est
  // ramenee a 0,78 : avec le gain d'applaudir (1 a 1,15) et la voix dessous,
  // la somme reste sous 1.
  const out = [buf.getChannelData(0), buf.getChannelData(1)];
  pic = 0;
  for (let c = 0; c < 2; c++) for (let i = 0; i < n; i++) {
    out[c][i] = sec[c][i] + 0.24 * queue[c][i];
    pic = Math.max(pic, Math.abs(out[c][i]));
  }
  if (pic > 0) for (let c = 0; c < 2; c++) for (let i = 0; i < n; i++) out[c][i] *= 0.78 / pic;
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
    // ET SES MAINS : les quatre claps de la batterie de son morceau
    // (clapDuMorceau) ; engine.ts, applaudir, en tire un a chaque frappe
    for (let i = 0; i < 4; i++) A.buf[`${CLAP}_${i}`] = clapDuMorceau(A.ctx, i);
    A.buf[CLAP] = A.buf[`${CLAP}_0`];
    cri = 'pret';
    return true;
  } catch {
    cri = 'refuse';
    return false;
  }
}
