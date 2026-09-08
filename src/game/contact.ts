// Nous ecrire.
//
// L'adresse vit ici et nulle part ailleurs : elle apparait a l'ecran, elle
// apparaitra un jour dans une fiche de magasin ou une page de mentions, et une
// adresse recopiee a trois endroits est une adresse qui finit par differer de
// l'un a l'autre.

import { EST_TEST } from './canal';

export const CONTACT = 'support@sprinter-game.com';

/**
 * Le lien d'ecriture, avec un objet deja pose.
 *
 * L'objet distingue la version de test du vrai jeu, et ce n'est pas un detail
 * de confort : un joueur qui signale un defaut ne sait pas sur laquelle des
 * deux il se trouve, alors que la reponse depend entierement de cela.
 */
export function lienContact(): string {
  const objet = EST_TEST ? 'Sprinter (version de test)' : 'Sprinter';
  return `mailto:${CONTACT}?subject=${encodeURIComponent(objet)}`;
}
