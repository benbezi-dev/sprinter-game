// LA MUSIQUE DE CHAQUE DESTINATION DE LA LEGENDE (18/10).
//
// L'auteur : « pour chaque destination une musique iconique qui respecte le
// pays et le personnage », « dans le style de la course des ZEZE ». Ce sont
// des declinaisons de race3 (race3-lieux.js), fabriquees par le moteur comme
// race3 lui-meme : aucun fichier a telecharger.
//
// MEME CONTRAT QUE LES MORCEAUX DES DEFIS (musique-defi-aurel.ts) :
//  - la musique se fabrique a l'affiche de l'etape, quelques secondes avant
//    la course, par tranches de quelques millisecondes (le generateur de
//    `fabriquerCourse`) : l'affiche ne saccade pas, meme sur un petit
//    telephone ;
//  - elle est rangee sous `legende_<cle>`, le nom que porte l'entree de niveau
//    (stadeDe, stades.ts) ; `raceTrack` ne la choisit que si elle est la ;
//  - son absence ne casse rien : la course part sur la musique ordinaire, et
//    passe a la sienne si elle arrive en cours de route.

import { SprinterApp } from '../engine';
import { MUSIQUES_LEGENDE } from './race3-lieux.js';

/** Le nom sous lequel le moteur range le morceau du lieu `cle`. */
export const nomDeLaMusique = (cle: string) => 'legende_' + cle;

const enCours = new Set<string>();

function moteur(): any {
  const A = SprinterApp as any;
  return A && A.Audio_ ? A.Audio_ : null;
}

/** Fabriquer le morceau du lieu (une fois) et le poser sur le moteur. */
export function chargerLaMusiqueDuLieu(cle: string): void {
  const cfg = (MUSIQUES_LEGENDE as Record<string, unknown>)[cle];
  const A = moteur();
  const nom = nomDeLaMusique(cle);
  // pas de contexte audio avant le premier geste : l'appel suivant le trouvera
  if (!cfg || !A || !A.ok || !A.ctx || A.buf[nom] || enCours.has(cle)) return;
  enCours.add(cle);
  const gen = A.fabriquerCourse(cfg);
  const tranche = () => {
    const fin = performance.now() + 6;
    let r = gen.next();
    while (!r.done && performance.now() < fin) r = gen.next();
    if (!r.done) { setTimeout(tranche, 0); return; }
    A.buf[nom] = r.value;
    enCours.delete(cle);
    relayer(nom);
  };
  setTimeout(tranche, 0);
}

/** Si la course est deja partie sur la musique ordinaire, passer a la sienne — une fois. */
function relayer(nom: string): void {
  const A = moteur();
  const G = (SprinterApp as any).G;
  if (!A || !G || !A.on) return;
  if (G.state !== 'race' && G.state !== 'count') return;
  if (A.raceTrack(G.levelIdx) !== nom) return;
  A.cur = null;
  A.music(nom);
}
