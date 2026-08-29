// Le mot de l'adversaire, quand on perd.
//
// Un duel perdu s'annoncait par deux chronos face a face. C'est exact, et c'est
// froid : on lit un ecart, on hausse les epaules, on passe. Ce qui donne envie
// de rejouer n'est pas le nombre, c'est la petite phrase qui pique.
//
// UN POINT A SAVOIR, ET IL COMPTE : ces phrases sont ecrites par le jeu, pas
// par le joueur dont elles portent le nom. C'est un choix, et il a une raison —
// laisser quelqu'un ecrire librement un message qui s'affichera chez un autre
// demande une moderation, et le jeu n'en a pas encore. Les lignes sont donc
// taquines et jamais blessantes : on chambre un ami, on ne l'insulte pas.
//
// Le jour ou l'espace de communication existera, avec ce qu'il faut pour
// signaler et filtrer, ces phrases pourront ceder la place a de vrais messages.
// D'ici la, mieux vaut une pique ecrite d'avance qu'une porte ouverte sans
// serrure.

import { SprinterApp } from './engine';

/**
 * Combien de piques existent. Le nombre vit ici et non dans le dictionnaire :
 * les traductions se comptent mal, et une langue qui en aurait une de moins
 * ferait tomber le tirage sur une clef vide.
 */
export const NB_PIQUES = 8;

/**
 * La pique d'un duel donne.
 *
 * Tiree du code du duel, jamais au hasard : la meme defaite doit produire la
 * meme phrase. Un tirage a chaque affichage la ferait changer sous les yeux du
 * joueur a chaque retour sur l'ecran, et une phrase qui change n'est plus la
 * parole de personne.
 */
export function pique(idDuel: string, adversaire: string): string {
  const { N } = SprinterApp;
  let somme = 0;
  const s = String(idDuel || '');
  for (let i = 0; i < s.length; i++) somme = (somme * 31 + s.charCodeAt(i)) >>> 0;
  const n = somme % NB_PIQUES;
  return N.t('pique_' + n, { n: adversaire || N.t('opponent') });
}
