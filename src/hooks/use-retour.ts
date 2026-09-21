import { useEffect, useRef } from 'react';
import { empiler } from '@/game/retour';

/**
 * « Ce panneau se ferme comme ceci. »
 *
 * A poser dans tout ecran qu'on peut deja quitter par une croix ou un bouton,
 * en lui passant CE bouton : le geste et le retour du systeme ne font alors
 * rien de plus que ce que le joueur pouvait deja faire du doigt. Un ecran qui
 * attend une reponse — un code d'acces, un choix — ne s'annonce pas, et reste
 * donc insensible au retour.
 *
 * `actif` sert aux panneaux qui vivent toujours montes et decident eux-memes
 * de s'afficher : ils ne s'annoncent que pendant qu'ils sont visibles.
 */
export function useRetour(fermer: () => void, actif = true) {
  // La fonction change a chaque rendu, l'inscription non : sans cela le
  // panneau se desinscrit et se reinscrit sans arret, et remonte au sommet de
  // la pile a chaque image — un panneau ouvert par-dessus lui se ferait
  // doubler.
  const fn = useRef(fermer);
  fn.current = fermer;

  useEffect(() => {
    if (!actif) return;
    return empiler(() => fn.current());
  }, [actif]);
}
