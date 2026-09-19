// LA NUIT DU MOLOSSE — la musique, et comment elle entre dans le jeu.
//
// C'est le SEUL morceau du jeu qui ne soit pas synthetise a la volee. Tous
// les autres sortent de `buildRace` (sprinter-app.js) : quelques oscillateurs,
// une gamme, et pas un octet de donnees. Celui-ci est une vraie piece ecrite
// note a note (tools/musique/molosse-partition.py), rendue en audio, et
// embarquee comme fichier.
//
// POURQUOI FAIRE UNE EXCEPTION. La synthese du jeu sait faire une pulsation
// et une basse ; elle ne sait pas faire un orgue d'eglise, un choeur et un
// glas — et sans ces trois-la, une musique d'Halloween n'en est pas une. Le
// stade du cimetiere est le seul endroit du jeu qui le demande.
//
// ELLE SE CHARGE A LA DEMANDE, ET C'EST CE QUI LA REND ACCEPTABLE. Sept cents
// kilo-octets dans le paquet de depart seraient sept cents kilo-octets payes
// par tous les joueurs, y compris ceux qui n'ouvriront jamais le mode. Le
// fichier part donc dans un morceau separe, demande au moment ou le joueur
// ouvre le tableau des nuits — soit quelques secondes avant d'en avoir
// besoin.
//
// ET SON ABSENCE NE CASSE RIEN. Tant que le buffer n'est pas la, `raceTrack`
// ne le trouve pas et rend la musique de course ordinaire (voir
// sprinter-app.js) : un reseau lent, un fichier manquant ou un navigateur qui
// refuse de decoder donnent une course avec une autre musique, pas une course
// muette.

import { SprinterApp } from './engine';

/** Le nom sous lequel le moteur range le morceau. Voir le theme `halloween`. */
export const NOM = 'halloween';

type Etat = 'absent' | 'en-cours' | 'pret' | 'refuse';
let etat: Etat = 'absent';

/** Le moteur audio du jeu, s'il est ouvert. */
function moteur(): any {
  const A = (SprinterApp as any);
  return A && A.Audio_ ? A.Audio_ : null;
}

/** Ou en est le chargement. Sert au harnais et a l'ecran de test. */
export function etatDeLaMusique(): Etat { return etat; }

/**
 * Charger le morceau et le poser sur le moteur.
 *
 * Appelable autant de fois qu'on veut : le second appel ne fait rien tant que
 * le premier n'a pas abouti, et rien du tout une fois le morceau en place.
 *
 * ON NE REESSAIE PAS APRES UN REFUS, et c'est delibere. Un decodage qui echoue
 * echoue pour une raison qui ne changera pas dans la seconde — format non
 * reconnu, memoire, contexte ferme — et un mode qui retenterait a chaque
 * ouverture du panneau ferait dix requetes pour rien. La musique ordinaire
 * prend le relais, ce qui est une perte acceptable.
 */
export async function chargerLaMusique(): Promise<boolean> {
  if (etat === 'pret') return true;
  if (etat === 'en-cours' || etat === 'refuse') return false;

  const A = moteur();
  // Le contexte audio n'existe qu'apres le premier geste du joueur : avant, il
  // n'y a rien ou poser un buffer. On ne marque pas `refuse` pour autant —
  // c'est une question de moment, pas de possibilite, et l'appel suivant
  // trouvera le contexte ouvert.
  if (!A || !A.ok || !A.ctx) return false;

  etat = 'en-cours';
  try {
    const m = await import('@/assets/molosse.mp3?url');
    const url = m.default as string;
    const reponse = await fetch(url);
    if (!reponse.ok) throw new Error('reponse ' + reponse.status);
    const octets = await reponse.arrayBuffer();
    // `decodeAudioData` rend une promesse sur les navigateurs modernes ; la
    // forme a rappels reste acceptee partout, et c'est celle qui marche aussi
    // sur les Safari anciens que le jeu vise encore.
    const buffer: AudioBuffer = await new Promise((resolu, rejete) => {
      A.ctx.decodeAudioData(octets, resolu, rejete);
    });
    A.buf[NOM] = buffer;
    etat = 'pret';
    // LE MORCEAU EN COURS NE CHANGE PAS TOUT SEUL. `music()` sort aussitot
    // quand le nom demande est deja celui qui joue, et la course peut avoir
    // demarre sur la musique ordinaire pendant le chargement. On force donc
    // le relais une fois, et une seule.
    relayer();
    return true;
  } catch {
    etat = 'refuse';
    return false;
  }
}

/**
 * Passer a la musique du mode si une course du cimetiere est en cours.
 *
 * Le moteur choisit son morceau une fois, au changement d'etat (voir
 * `Audio_.music` et `raceTrack`) : un fichier arrive en retard ne serait
 * entendu qu'a la course suivante. Ce relais rattrape ce cas-la — il oublie
 * le morceau courant, ce qui force `music()` a en reprendre un.
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
