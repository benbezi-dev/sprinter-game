/* ---------------------------------------------------------------------------
   RECOMMENCER N'EST PAS EFFACER
   ---------------------------------------------------------------------------
   Ce fichier a d'abord repondu a la mauvaise question, et il vaut mieux que
   cela reste ecrit : il decidait si l'on pouvait REJOUER une course, au sens
   de remplacer le chrono qu'on venait de poser. D'ou une regle a verrous — on
   ne remplace pas un chrono deja parti chez un adversaire — et un bouton qui
   disparaissait dans tous ces cas.

   Or ce n'est pas ce qui manquait aux joueurs. Ce qui leur manquait est plus
   simple et plus bete : apres un faux depart ou une course ratee, il fallait
   repasser par l'accueil, le menu, le mode, puis relancer. Quatre ecrans pour
   refaire dix secondes de course. Ils ne demandaient pas a effacer quoi que ce
   soit — ils demandaient un raccourci.

   LES DEUX QUESTIONS SONT DISTINCTES, ET LES CONFONDRE COUTAIT LE RACCOURCI.

     RECOMMENCER, c'est lancer une course de plus. La precedente reste ce
     qu'elle est ; si son chrono etait parti dans un duel, il y reste. Rien
     n'est repris a personne, donc rien ne justifie de l'interdire. Jamais,
     et pas davantage apres le 5 septembre.

     CE QUI EST DEFINITIF, c'est le chrono deja donne : un duel auquel on a
     repondu, un defi envoye, une course courue en direct. Cela ne se rejoue
     pas — mais cela n'a jamais empeche d'en courir une autre.

   Ce qui suit ne verrouille donc plus rien. Il dit ce qui est ACQUIS de la
   course qu'on vient de finir, pour que l'ecran puisse l'annoncer a cote du
   bouton au lieu de faire disparaitre le bouton.
--------------------------------------------------------------------------- */

/**
 * Peut-on lancer une course de plus ? Oui.
 *
 * La fonction existe pour porter cette phrase-la. Elle ne prend pas d'etat et
 * ne rend pas autre chose que vrai, et c'est le fait : rien dans une course
 * terminee ne peut interdire d'en commencer une autre. Le jour ou quelqu'un
 * voudra ajouter une condition ici, il tombera d'abord sur ce commentaire.
 */
export function peutRecommencer(): boolean {
  return true;
}

/** Ce qu'il faut savoir de la course qui vient de finir. */
export type EtatCourse = {
  /** La course s'est jouee en direct contre un adversaire reel. */
  courseEnDirect: boolean;
  /** On repondait a un defi recu. */
  defiRecu: boolean;
  /** Un defi a deja ete cree depuis cette course. */
  defiEnvoye: boolean;
  /** Le joueur est parti avant le signal. */
  fauxDepart: boolean;
  /** Cette course appartient a une chaine de duel — une revanche, typiquement. */
  chaineDeDuel: boolean;
};

/** Ce qui est acquis de la course qu'on vient de finir. Nul si rien ne l'est. */
export type Verrou =
  | 'course_directe' | 'defi_recu' | 'defi_envoye' | 'faux_depart_duel' | null;

/**
 * Qu'est-ce qui est deja joue dans cette course ?
 *
 * Sert a l'ANNONCER, plus a l'interdire. « Ton chrono est parti chez ton
 * adversaire » est une information utile a cote d'un bouton RECOMMENCER ; ce
 * n'etait pas une raison de retirer le bouton.
 */
export function verrouDeReprise(e: EtatCourse): Verrou {
  if (e.courseEnDirect) return 'course_directe';
  if (e.defiRecu) return 'defi_recu';
  if (e.defiEnvoye) return 'defi_envoye';
  if (e.fauxDepart && e.chaineDeDuel) return 'faux_depart_duel';
  return null;
}

/** La course qu'on vient de finir laisse-t-elle quelque chose de definitif ? */
export function rienNestJoue(e: EtatCourse): boolean {
  return verrouDeReprise(e) === null;
}

/**
 * Le faux depart compte-t-il comme une defaite seche ?
 *
 * Ce n'est pas la meme question que la precedente, et les confondre serait une
 * faute. Un faux depart en duel fait perdre, que l'on ait recu le defi ou
 * qu'on le renvoie. Seul sur la piste, il elimine mais ne fait perdre a
 * personne — et cela reste vrai apres le 5 septembre, ou la course s'arrete
 * sans se rejouer mais ou il n'y a toujours pas d'adversaire a qui perdre.
 *
 * L'ancien ecran disait « eliminé — le duel est perdu » a un joueur qui
 * courait seul. C'etait faux avant les modifications d'aujourd'hui, et le
 * redevenir serait une regression : on remet l'elimination, pas le mensonge.
 */
export function fauxDepartEstUneDefaite(e: EtatCourse): boolean {
  return e.fauxDepart && (e.courseEnDirect || e.defiRecu || e.chaineDeDuel);
}
