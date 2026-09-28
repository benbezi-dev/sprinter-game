
// LE DEFI AUREL MANGA — sa musique, et comment elle entre dans le jeu.
//
// C'est la musique du teaser « les haies sont ouvertes », remise en boucle de
// seize mesures (tools/musique/defi-aurel.py). Comme celle du molosse, c'est
// un fichier et non une synthese a la volee : elle doit sonner exactement
// comme la video que les joueurs ont vue.
//
// MEME CONTRAT QUE LA NUIT DU MOLOSSE (voir halloween-musique.ts) :
//  - elle se charge a la demande, quand la fiche du defi s'ouvre — quelques
//    secondes avant la course ; qui n'ouvre jamais le defi ne la telecharge
//    jamais ;
//  - elle est rangee sous le nom que porte le theme `montreuil`
//    (sprinter-app.js), et `raceTrack` ne la choisit que si elle est la ;
//  - son absence ne casse rien : reseau lent, fichier manquant ou decodage
//    refuse, la course part sur la musique ordinaire des haies.

import { SprinterApp } from './engine';

/** Le nom sous lequel le moteur range le morceau. Voir le theme `montreuil`. */
export const NOM = 'defi_aurel';

type Etat = 'absent' | 'en-cours' | 'pret' | 'refuse';
let etat: Etat = 'absent';

function moteur(): any {
  const A = (SprinterApp as any);
  return A && A.Audio_ ? A.Audio_ : null;
}

/** Ou en est le chargement. */
export function etatDeLaMusiqueDuDefi(): Etat { return etat; }

/**
 * Charger le morceau et le poser sur le moteur. Appelable autant de fois
 * qu'on veut ; pas de nouvel essai apres un refus (meme raison que pour le
 * molosse : un decodage qui echoue echouera encore).
 */
export async function chargerLaMusiqueDuDefi(): Promise<boolean> {
  if (etat === 'pret') return true;
  if (etat === 'en-cours' || etat === 'refuse') return false;

  const A = moteur();
  // Pas de contexte audio avant le premier geste : ce n'est pas un refus,
  // l'appel suivant le trouvera ouvert.
  if (!A || !A.ok || !A.ctx) return false;

  etat = 'en-cours';
  try {
    const m = await import('@/assets/defi-aurel.mp3?url');
    const reponse = await fetch(m.default as string);
    if (!reponse.ok) throw new Error('reponse ' + reponse.status);
    const octets = await reponse.arrayBuffer();
    const buffer: AudioBuffer = await new Promise((resolu, rejete) => {
      A.ctx.decodeAudioData(octets, resolu, rejete);
    });
    A.buf[NOM] = buffer;
    etat = 'pret';
    relayer();
    return true;
  } catch {
    etat = 'refuse';
    return false;
  }
}

/**
 * Si la course du defi a deja demarre sur la musique ordinaire pendant le
 * chargement, passer a la sienne — une fois.
 */
function relayer(): void {
  const A = moteur();
  const G = (SprinterApp as any).G;
  if (!A || !G || !A.on) return;
  if (G.state !== 'race' && G.state !== 'count') return;
  if (A.raceTrack(G.levelIdx) !== NOM) return;
  A.cur = null;
  A.music(NOM);
}
