/* -----------------------------------------------------------------------
   QUEL GESTE ALLUME QUOI.

   Le coup de poussee recompense deux gestes, et un seul des deux porte
   l'image remanente :

     - LE DEPART CANON     : le halo, c'est-a-dire l'onde au sol sous ses
                             appuis et l'aura sur son buste.
     - LA TRANSITION PARFAITE : le halo, et les copies du coureur derriere lui.

   ILS SONT INDEPENDANTS, et c'est la moitie de la regle. Un depart manque
   n'empeche pas la relance de se signer ; une relance manquee ne retire rien
   au depart ; les deux reussis allument les deux, l'un apres l'autre. Rien
   ici ne lit ce que l'autre geste a donne.

   POURQUOI CE FICHIER EXISTE. Cette regle vivait dans la boucle de rendu, au
   milieu de GameCanvas.tsx, ou aucun harnais ne peut l'atteindre — le
   harnais du coup de poussee le disait lui-meme : « le declenchement vit dans
   le composant qui tient la boucle de rendu et ne se joue pas sans
   navigateur ». Une regle qu'on ne peut pas jouer est une regle qu'on croit
   sur parole, et le 19 septembre 2026 deux changements de comportement sont
   passes inapercus de cette facon, dont un qui eteignait l'effet entier.

   Elle n'a pourtant besoin de rien : ni toile, ni stade, ni horloge. Un
   coureur avec trois nombres suffit. Sortie ici, elle se joue en memoire, et
   les quatre combinaisons de gestes tiennent en quatre lignes de harnais —
   voir tools/poussee-canal-test.mjs.

   CE QUI RESTE AILLEURS. Ce fichier dit ce qu'il faut armer ; il n'arme rien.
   Le drapeau qui ouvre ou ferme le declenchement est dans canal.ts, le prix
   de chaque effet dans rendu-premium.js, et le dessin dans sprinter-app.js.
   ----------------------------------------------------------------------- */

/** Une impulsion a armer : sa force, et si elle porte l'image remanente. */
export interface GestePoussee {
  force: number;
  echos: boolean;
}

/**
 * LE SEUIL DU DEPART CANON : 82 % du gain de reaction maximal.
 *
 * C'est le meme chiffre que le HUD, qui allume son « TOP » a cet endroit
 * exactement (voir sprinter-ui.js et hud-film.ts). Il le faut : l'image et le
 * texte annoncent le meme geste, et deux seuils voisins diraient au joueur
 * qu'il a bien parti sans rien lui montrer, ou l'inverse.
 */
export const SEUIL_CANON = 0.82;

/** Le depart canon : une reaction qui merite son halo. */
export function departCanon(p: any, reactBonusMax: number): boolean {
  return !p.jumped && p.reactBonus > reactBonusMax * SEUIL_CANON;
}

/** La transition parfaite : la seule note qui vaille, celle qui ajoute les echos. */
export function transitionParfaite(p: any): boolean {
  return p.transGrade === 2;
}

/**
 * Le guetteur d'une course : a chaque image, ce qu'il y a a armer.
 *
 * UN GESTE NE SE JUGE QU'UNE FOIS. Les deux notes restent posees sur le
 * coureur jusqu'a l'arrivee — `reaction` et `transGrade` ne redeviennent pas
 * nuls — si bien qu'une lecture naive rearmerait l'impulsion a chaque image
 * pendant tout le reste de la course. Le guetteur retient donc ce qu'il a
 * deja vu, et ne rend un geste qu'au moment ou il TOMBE.
 *
 * IL SE REMET A ZERO HORS COURSE, ce qui est la seule chose qui rende la
 * course suivante possible. On lui passe `enCourse` plutot que de lui faire
 * deviner : la boucle de rendu sait ou en est le jeu, pas lui.
 *
 * `reactBonusMax` est C.REACT_BONUS, le gain d'une reaction parfaite. Il
 * arrive en argument plutot que par un import : cette regle ne doit rien
 * connaitre du reste du jeu, c'est precisement ce qui la rend jouable en
 * memoire.
 */
export function guetteurDePoussee() {
  let vuReaction = false, vuTrans = false;

  return function guetter(p: any, enCourse: boolean, reactBonusMax: number): GestePoussee[] {
    if (!enCourse) { vuReaction = false; vuTrans = false; return []; }
    if (!p) return [];

    const gestes: GestePoussee[] = [];
    // DEUX TESTS SEPARES, ET JAMAIS UN « SINON » ENTRE EUX.
    //
    // L'alternative paraitrait sans consequence, et c'est ce qui la rend
    // dangereuse : dans une course ordinaire les deux notes tombent a
    // plusieurs secondes d'ecart — la reaction au premier appui, la
    // transition a la fin de la poussee — si bien que la relance serait
    // simplement jugee a l'image SUIVANTE, et personne ne verrait rien.
    //
    // Elle se perdrait seulement quand les deux notes sont connues d'un
    // coup, sur une premiere image ou le coureur les porte deja toutes les
    // deux. C'est rare, c'est invisible a la relecture, et c'est exactement
    // le genre de panne qu'un harnais doit tenir a notre place : voir la
    // ligne « deux notes connues d un coup » dans poussee-canal-test.mjs.
    if (!vuReaction && p.reaction !== null) {
      vuReaction = true;
      if (departCanon(p, reactBonusMax)) gestes.push({ force: 1, echos: false });
    }
    if (!vuTrans && p.transGrade !== null) {
      vuTrans = true;
      if (transitionParfaite(p)) gestes.push({ force: 1, echos: true });
    }
    return gestes;
  };
}
