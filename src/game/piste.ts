// Ce qui est sur la piste en ce moment.
//
// Ce petit magasin existe pour une raison precise, et elle vaut d'etre ecrite.
//
// Les panneaux de mode vivent dans l'ecran-titre, et l'ecran-titre disparait au
// coup de pistolet : `state` passe a « count », React demonte le titre, et avec
// lui tout ce qu'il contenait. Un panneau qui tient une WebSocket dans un
// `useRef` et la ferme a son demontage ferme donc sa salle a la seconde exacte
// ou la course commence — chacun des deux cotes en meme temps, ce qui donne
// deux coureurs qui se voient figes l'un l'autre.
//
// Un relais ne peut pas s'en accommoder : le temoin se passe pendant la course,
// et le bouton doit etre a l'ecran par-dessus la piste. On sort donc la course
// de l'arbre du titre. Le vestiaire reste dans son onglet ; ce qui court vit
// ici, au-dessus de tout, et ne depend plus de l'etat du moteur.

import { useSyncExternalStore } from 'react';

export type SurLaPiste =
  | { genre: 'relais'; equipe: string }
  | {
      genre: 'confrontation';
      code: string;
      equipe: string;
      /** Combien d'equipes au plus. Le premier arrive le fixe. */
      max: number;
      /** Les courses enregistrees a affronter, par identifiant de course. */
      fantomes: number[];
    };

let courant: SurLaPiste | null = null;
const abonnes = new Set<() => void>();

function prevenir() { for (const f of abonnes) f(); }

/** Entrer sur la piste, ou en sortir avec `null`. */
export function entrerSurLaPiste(quoi: SurLaPiste | null) {
  courant = quoi;
  prevenir();
}

export function surLaPiste() { return courant; }

export function usePiste(): SurLaPiste | null {
  return useSyncExternalStore(
    (l) => { abonnes.add(l); return () => { abonnes.delete(l); }; },
    () => courant,
    () => courant,
  );
}
