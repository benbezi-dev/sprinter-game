// La presentation des athletes, et sa duree de vie.
//
// Elle se jouait sur un rideau noir, par-dessus le jeu : une silhouette
// dessinee a part, un nom, un numero de couloir. Cela tenait, et cela ne
// ressemblait a rien de ce que le joueur allait voir trois secondes plus tard.
//
// Elle se joue desormais SUR LA PISTE, avec les vrais athletes, dans leurs
// vrais couloirs. Ce n'est pas une question de finition : le moteur sait deja
// dessiner ces gens — maillots, morphologies, ombres, virage — et en fabriquer
// une seconde version plate, c'etait garantir que les deux divergeraient.
//
// Cela impose une chose, et c'est la raison d'etre de ce fichier. Pour que la
// piste soit a l'ecran, le moteur doit etre entre en course ; et quand il y
// entre, l'ecran-titre disparait avec le panneau qui portait la presentation.
// Elle vit donc ici, hors de cet arbre, exactement comme la salle du direct et
// la course de relais avant elle. Le panneau ne fait plus que la declarer.

import { useSyncExternalStore } from 'react';
import type { Presentation } from './live';
import type { EtatVoix } from './voix';

export type PresentationEnCours = {
  presentation: Presentation;
  /** Mon identifiant dans la salle : sert a savoir quand c'est mon tour. */
  moi: string;
  /**
   * Au changement d'athlete. C'est l'appelant qui ouvre le micro — la
   * presentation ne connait pas la liaison audio, et n'a pas a la connaitre.
   */
  onTour: (index: number, estMoi: boolean) => void;
  onFini: () => void;
  /**
   * L'etat du micro, demande au moment de l'affichage plutot que pousse.
   *
   * Le panneau qui tenait cet etat n'existe plus quand la presentation se
   * joue ; la liaison audio, elle, existe toujours. On va donc le chercher a
   * la source, ce qui evite d'avoir a le republier depuis un composant
   * demonte.
   */
  etatVoix: () => EtatVoix;
};

let courante: PresentationEnCours | null = null;
const abonnes = new Set<() => void>();

export function lancerPresentation(p: PresentationEnCours | null) {
  courante = p;
  for (const f of abonnes) f();
}

export function presentationCourante() { return courante; }

export function usePresentationDirecte(): PresentationEnCours | null {
  return useSyncExternalStore(
    (l) => { abonnes.add(l); return () => { abonnes.delete(l); }; },
    () => courante,
    () => courante,
  );
}
