// LA MUSIQUE DE SPRINTERGAME — celle des annonces iOS/Android, devenue la
// musique de course du jeu (23/11/2026).
//
// L'auteur l'a composee pour les quatre videos de lancement des applis (reel
// du 19.12, 100 m, 110 m haies, 400 m), puis : « j'aime trop ! garde cette
// musique pour le jeu », et « branche cette musique dans le jeu ». Elle
// remplace donc les quatre paliers synthetises (`race0` a `race3`) partout ou
// un stade n'a pas deja la sienne : Halloween, les defis, la Legende, la
// Riviera du canal de test et le championnat en direct gardent leur morceau
// (voir raceTrack, sprinter-app.js).
//
// C'EST UN FICHIER, comme les morceaux des defis : il doit sonner comme les
// videos. Sources et fabrication hors du depot : projet Logic Pro et scripts
// dans musique-sprintergame-2026-11-23/ (disque MUSIQUE), version « jeu ».
//
// SA FORME EST UN CONTRAT AVEC LE DECOMPTE, comme celle du defi Meba : la
// musique de course part au premier chiffre du 3-2-1 (engine.ts) et le
// pistolet tombe trois secondes plus tard. Le fichier ouvre sur INTRO secondes
// de montee qui retombent sur le coup de feu, puis la meme boucle de seize
// mesures deux fois. Le moteur boucle sur la SECONDE : elle porte deja les
// resonances de la fin de la premiere, la soudure ne s'entend pas.
//
// SON ABSENCE NE CASSE RIEN : tant que le fichier n'est pas la (reseau lent,
// decodage refuse), `raceTrack` rend les paliers synthetises comme avant. S'il
// arrive en pleine course, il attend la fin de celle-ci (`installer`).
//
// Ce module n'importe pas le moteur : c'est le moteur qui l'appelle (engine.ts,
// des que le son est debloque), et un import dans l'autre sens ferait une boucle.

/** Le nom sous lequel le moteur range le morceau. Voir raceTrack. */
export const NOM = 'sprintergame';

/** Le tempo de la musique des annonces. */
export const BPM = 150;
/** Du debut du fichier au coup de pistolet : le decompte du 3-2-1. */
export const INTRO = 3.0;
/** La boucle : seize mesures a 150 BPM. */
export const BOUCLE = 16 * 4 * 60 / BPM;   // 25,6 s

type Etat = 'absent' | 'en-cours' | 'pret' | 'refuse';
let etat: Etat = 'absent';

export function etatDeLaMusiqueDediee(): Etat { return etat; }

/**
 * Charger le morceau et le poser sur le moteur `A` (Audio_). Appelable a
 * chaque image : il ne part qu'une fois, et pas de nouvel essai apres un refus
 * (un decodage qui echoue echouera encore).
 */
export async function chargerLaMusiqueDediee(A: any, G: any): Promise<boolean> {
  if (etat === 'pret') return true;
  if (etat === 'en-cours' || etat === 'refuse') return false;
  // Pas de contexte audio avant le premier geste : ce n'est pas un refus,
  // l'appel suivant le trouvera ouvert.
  if (!A || !A.ok || !A.ctx) return false;

  etat = 'en-cours';
  try {
    const url = import.meta.env.BASE_URL.replace(/\/?$/, '/') + 'musique/sprintergame-course.mp3';
    const reponse = await fetch(url);
    if (!reponse.ok) throw new Error('reponse ' + reponse.status);
    const octets = await reponse.arrayBuffer();
    const buffer: AudioBuffer = await new Promise((resolu, rejete) => {
      A.ctx.decodeAudioData(octets, resolu, rejete);
    });
    // Plus court que l'intro et ses deux boucles : ce n'est pas le bon fichier.
    if (buffer.duration + 0.05 < INTRO + 2 * BOUCLE) throw new Error('trop court');
    installer(A, G, buffer);
    return true;
  } catch {
    etat = 'refuse';
    return false;
  }
}

/**
 * Poser le morceau sur le moteur. Le moteur relance `music(raceTrack(...))` a
 * chaque image : poser le tampon EN PLEINE COURSE ferait repartir le morceau
 * sur son intro, la montee du 3-2-1 apres le coup de feu. On attend donc que
 * la course en cours soit finie ; la suivante partira dessus.
 */
function installer(A: any, G: any, buffer: AudioBuffer): void {
  if (G && G.state === 'race') {
    setTimeout(() => installer(A, G, buffer), 500);
    return;
  }
  A.buf[NOM] = buffer;
  A.boucles[NOM] = [INTRO + BOUCLE, INTRO + 2 * BOUCLE];
  etat = 'pret';
}
