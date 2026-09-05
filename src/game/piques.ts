// Ce que le jeu dit a la fin d'un duel — et qui le dit.
//
// Un duel s'annoncait par deux chronos face a face. C'est exact, et c'est
// froid : on lit un ecart, on hausse les epaules, on passe. Ce qui donne envie
// de rejouer n'est pas le nombre, c'est la petite phrase qui pique.
//
// Trois familles vivent ici, et elles ne parlent ni de la meme bouche ni sur
// le meme ton : la PIQUE d'une defaite est la parole de l'adversaire, le BOOST
// d'une victoire est le jeu qui porte le gagnant, la RELANCE est le bouton qui
// suit. Chacune dit plus bas pourquoi elle est ecrite comme elle l'est.
//
// Ce qui suit vaut pour la premiere.
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
export const NB_PIQUES = 16;

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
  return N.t('pique_' + index(idDuel, NB_PIQUES),
             { n: adversaire || N.t('opponent') });
}

/**
 * Le tirage, une fois pour les trois familles de phrases.
 *
 * Une somme de caracteres, et rien de plus : ce qu'on demande a ce nombre
 * n'est pas d'etre imprevisible, c'est d'etre TOUJOURS LE MEME pour une graine
 * donnee. Le hasard, ici, ferait changer la phrase a chaque retour sur
 * l'ecran.
 */
function index(graine: string, combien: number): number {
  let somme = 0;
  const s = String(graine || '');
  for (let i = 0; i < s.length; i++) somme = (somme * 31 + s.charCodeAt(i)) >>> 0;
  return somme % combien;
}

/* ---------------------------------------------------------------------------
   LE BOOST — la victoire, et pourquoi ce n'est pas une pique retournee
   ---------------------------------------------------------------------------
   Une victoire s'annoncait par deux chronos et un nombre de points. C'est
   exact, et c'est le meme froid qu'une defaite sans phrase : on gagne, on lit
   un chiffre, on ferme.

   La reponse n'est pas de retourner les piques du dessus, pour deux raisons.

   D'abord la voix : une pique est la parole de l'adversaire, et l'adversaire
   n'est plus la — il a perdu il y a une minute ou trois jours, et il est
   parti. Ici, c'est le jeu qui parle.

   Ensuite le ton, et c'est le point : on ne chambre pas quelqu'un qui vient
   de gagner. Il est venu chercher exactement ce moment-la. Ces lignes le lui
   donnent — « personne ne t'a vu passer », « la ligne etait a toi ». Elles
   portent, elles ne degonflent pas.

   Aucune ne nomme personne : le perdant n'a pas a etre montre du doigt pour
   que le gagnant se sente bien.
--------------------------------------------------------------------------- */

/** Combien de boosts existent. Le nombre vit ici, comme au-dessus. */
export const NB_BOOSTS = 8;

/**
 * Le boost d'une victoire.
 *
 * Ne prend pas de nom — personne n'est vise. Il se tire d'une graine stable
 * pour la meme raison que les piques : une phrase qui change a chaque rendu
 * n'est plus une phrase.
 */
export function boost(graine: string): string {
  const { N } = SprinterApp;
  return N.t('boost_' + index(graine, NB_BOOSTS));
}

/* ---------------------------------------------------------------------------
   LA RELANCE — ce que dit le bouton qui mene au classement
   ---------------------------------------------------------------------------
   Meme principe que les piques, autre cible : ici le jeu chambre CELUI QUI
   LIT, pas l'adversaire. Se moquer du perdant qui a l'ecran sous les yeux fait
   rire ; se moquer de quelqu'un qui n'est pas la fait autre chose, et c'est ce
   qui rend ces lignes jouables entre amis.
--------------------------------------------------------------------------- */

/** Combien de relances par issue. Le nombre vit ici, comme pour les piques. */
export const NB_RELANCES = 3;

/**
 * Quelle relance afficher, pour une course donnee.
 *
 * L'index se tire d'une graine et jamais au hasard, pour la meme raison que
 * les piques : une phrase qui change a chaque rendu n'est plus une phrase,
 * c'est un scintillement. La graine est le code du defi quand il y en a un,
 * le chrono sinon — deux choses stables pendant qu'on lit l'ecran, et
 * differentes d'une course a l'autre.
 */
export function relance(issue: 'gagne' | 'perdu', graine: string) {
  const n = index(graine, NB_RELANCES);
  return { titre: `relance_${issue}_${n}`, sous: `relance_${issue}_${n}_sub` };
}
