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
    // ET SES MAINS : le claquement du moteur (Audio_.mains, celui des
    // claps de la musique), rendu une fois dans un tampon court
    const sr = A.ctx.sampleRate;
    const clap: AudioBuffer = A.ctx.createBuffer(1, Math.ceil(0.25 * sr), sr);
    A.mains(clap, 0.012, 1.9, 41);
    A.buf[CLAP] = clap;
    cri = 'pret';
    return true;
  } catch {
    cri = 'refuse';
    return false;
  }
}
