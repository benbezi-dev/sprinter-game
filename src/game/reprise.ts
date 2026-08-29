/* ---------------------------------------------------------------------------
   QUAND UNE COURSE PEUT SE REJOUER
   ---------------------------------------------------------------------------
   Une regle, trois interdits, et rien d'autre. Elle vit seule parce qu'elle
   decide de quelque chose qu'on ne peut pas reprendre apres coup : un chrono
   parti chez un adversaire est parti. Une regle pareille se lit d'un bloc et
   se verifie sans lancer une course.

   Le principe : ON REJOUE TANT QUE PERSONNE D'AUTRE N'EST ENGAGE.

   Une course qu'on court pour soi se reprend autant qu'on veut — apres un faux
   depart, apres une chute, ou simplement parce que le chrono ne plait pas.
   C'est ce que la carriere fait deja, et il n'y avait aucune raison que le one
   shot soit plus severe.

   Des qu'un adversaire entre en jeu, le chrono devient une parole donnee, et
   une parole ne se reprend pas. Quatre cas :

   LA COURSE EN DIRECT. Quelqu'un a couru au meme instant, a l'autre bout
   d'une WebSocket, et la salle a deja tranche. C'est le cas le plus engage
   qui soit, et c'est aussi celui qu'on oublie : une course en direct emprunte
   toute la plomberie du one shot et finit sur le meme ecran, sans qu'aucun
   defi n'ait ete recu ni envoye. Elle passait donc entre les trois autres
   verrous, et le bouton de reprise s'affichait apres un duel en direct perdu.

   REPONDRE A UN DEFI. Le resultat part au serveur des l'arrivee, avant meme
   que le joueur ait touche un bouton — l'adversaire attend un chrono, pas la
   meilleure de plusieurs tentatives. Il n'y a rien a rejouer, et c'etait deja
   vrai avant cette regle.

   AVOIR ENVOYE. Le code est chez l'ami, avec le chrono a battre et la trace du
   fantome. Rejouer ne changerait pas ce qu'il a recu : cela creerait un
   deuxieme chrono, et le joueur croirait avoir remplace le premier.

   LE FAUX DEPART DANS UNE CHAINE DE DUEL. Partir avant le signal est une
   defaite, pas un incident — pour celui qui recoit le defi comme pour celui
   qui le renvoie apres l'avoir recu. Le seul recours est d'ouvrir une
   nouvelle chaine, c'est-a-dire d'envoyer un nouveau defi.

   Hors de toute chaine de duel, le faux depart se rejoue comme le reste : le
   joueur n'a rien promis a personne.

   ET CELA CHANGE LE 5 SEPTEMBRE.

   Le jour ou le classement des duels ouvre, l'elimination redevient ce qu'elle
   etait : partir avant le signal met fin a la course, et il n'y a pas de
   reprise — meme seul sur la piste. C'est le meme drapeau qui ouvre le
   classement et qui referme cette porte, parce que c'est la meme decision :
   des lors que tout chrono peut devenir un defi, un faux depart qu'on
   recommence n'en est plus un.

   La reprise, elle, ne disparait pas pour autant. Un chrono qui ne plait pas
   se rejoue toujours, tant que le defi n'est pas parti. Ce sont deux regles
   distinctes et il faut les garder distinctes : ce qui redevient severe, c'est
   le faux depart, pas la course entiere.
--------------------------------------------------------------------------- */

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
  /**
   * Le classement des duels est ouvert — autrement dit, on est apres le
   * 5 septembre. Passe en parametre plutot que lu ici : cette regle doit
   * pouvoir se verifier dans les deux mondes sans qu'on bascule un drapeau
   * global pour la tester.
   */
  duelsOuverts: boolean;
};

/** Pourquoi la course ne se rejoue pas. Nul quand elle se rejoue. */
export type Verrou =
  | 'course_directe' | 'defi_recu' | 'defi_envoye'
  | 'faux_depart_duel' | 'faux_depart_elimine' | null;

/**
 * Qu'est-ce qui empeche de rejouer ?
 *
 * On renvoie la RAISON plutot qu'un oui-non : l'ecran doit pouvoir dire au
 * joueur pourquoi le bouton n'est pas la. Un bouton qui disparait sans
 * explication se cherche, et on finit par croire a une panne.
 */
export function verrouDeReprise(e: EtatCourse): Verrou {
  if (e.courseEnDirect) return 'course_directe';
  if (e.defiRecu) return 'defi_recu';
  if (e.defiEnvoye) return 'defi_envoye';
  if (e.fauxDepart && e.chaineDeDuel) return 'faux_depart_duel';
  // Apres le 5, tout faux depart elimine, meme seul sur la piste.
  if (e.fauxDepart && e.duelsOuverts) return 'faux_depart_elimine';
  return null;
}

/** La course peut-elle se rejouer ? */
export function peutRejouer(e: EtatCourse): boolean {
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
