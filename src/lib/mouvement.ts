import { useEffect, useState } from 'react';

import type { TargetAndTransition, Transition } from 'motion/react';

/**
 * Le vocabulaire de mouvement du jeu.
 *
 * Vingt-huit ecrans animent quelque chose, et chacun avait choisi ses propres
 * chiffres : un panneau surgissait en ressort 320/22, le suivant en 380/28, un
 * troisieme en 400/30. A l'oeil, trois panneaux qui ne s'ouvrent pas de la
 * meme facon dans le meme jeu. Les valeurs sont donc nommees ici une fois, et
 * les ecrans les citent au lieu de les reinventer.
 *
 * Un ecran garde le droit de sortir du vocabulaire : la cinematique du faux
 * depart, par exemple, est une mise en scene et non un composant d'interface.
 * Ce qui est mutualise, ce sont les gestes qui reviennent — un voile qui se
 * pose, un panneau qui s'ouvre, une ligne qui monte.
 */

/**
 * Les durees, en secondes.
 *
 * L'echelle est courte volontairement : au-dela de cinq paliers, le choix
 * redevient un reglage a l'oeil.
 */
export const DUREE = {
  /** Ce qui suit le doigt ou la course : une jauge, une barre de poussee. */
  instant: 0.12,
  /** Un contenu qui change dans un panneau deja ouvert. */
  rapide: 0.2,
  /** L'entree ordinaire d'un element a l'ecran. */
  base: 0.4,
  /** Un titre, un chiffre de fin de course : on veut qu'il se laisse lire. */
  ample: 0.55,
  /** Un plan de cinematique, qui s'installe. */
  scene: 0.9,
} as const;

/**
 * Les courbes.
 *
 * Une entree decelere (elle arrive et se pose), une progression est lineaire
 * (elle represente du temps qui passe, et le temps ne ralentit pas), une
 * boucle respire.
 */
export const COURBE = {
  /** Entree standard : depart franc, arrivee posee. */
  sortie: [0.22, 0.8, 0.3, 1],
  /** Meme intention, en plus appuye : pour ce qui doit frapper. */
  elan: [0.16, 1, 0.3, 1],
  /** Une barre qui represente du temps ne doit pas ralentir a la fin. */
  lineaire: 'linear',
  /** Aller-retour d'une boucle : ni depart ni arrivee marques. */
  respiration: 'easeInOut',
} as const;

/**
 * Les ressorts.
 *
 * Un ressort se decrit par sa raideur et son amortissement. Plus
 * l'amortissement est bas par rapport a la raideur, plus ca rebondit : c'est
 * la seule difference entre un panneau qui s'ouvre proprement et un trophee
 * qui tombe sur la table.
 */
export const RESSORT = {
  /** Un panneau qui s'ouvre : rapide, sans rebond visible. */
  panneau: { type: 'spring', stiffness: 380, damping: 28 },
  /** Un ecran entier qui se deplace : plus lourd, la course est longue. */
  glissement: { type: 'spring', stiffness: 260, damping: 32 },
  /** Une barre ou une colonne qui pousse jusqu'a sa valeur. */
  jauge: { type: 'spring', stiffness: 200, damping: 22 },
  /** Une ligne de classement qui rejoint son nouveau rang : la course est
   *  courte et l'oeil suit la ligne, pas le mouvement. */
  rang: { type: 'spring', stiffness: 420, damping: 34 },
  /** Volontairement rebondissant : reserve a ce qui se fete. */
  trophee: { type: 'spring', stiffness: 260, damping: 12 },
} as const satisfies Record<string, Transition>;

/** Les transitions qui ne portent pas d'entree : boucles et progressions. */
export const TRANSITION = {
  /** Une jauge qui suit la course, image par image. */
  suivi: { duration: DUREE.instant, ease: COURBE.lineaire },
  /** Une barre d'etape de tutoriel qui se remplit. */
  progression: { duration: DUREE.rapide, ease: COURBE.lineaire },
  /** Une pulsation sans fin : pastille de message, halo d'un record. */
  battement: { duration: 1.7, repeat: Infinity, ease: COURBE.respiration },
} as const satisfies Record<string, Transition>;

/**
 * Un geste complet, pret a etre etale sur un `motion.div`.
 *
 * On expose les quatre proprietes plutot que des `variants` parce que les
 * ecrans du jeu ecrivent leurs animations en ligne : `{...PANNEAU}` se lit au
 * meme endroit que le reste des props, et se surcharge sans ceremonie.
 */
export type Geste = {
  initial: TargetAndTransition | false;
  animate: TargetAndTransition;
  exit: TargetAndTransition;
  transition: Transition;
};

/** Le fond sombre qui isole un panneau modal. */
export const VOILE: Geste = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: DUREE.rapide, ease: COURBE.sortie },
};

/**
 * Un panneau modal qui s'ouvre : il grandit et monte un peu.
 *
 * Le mouvement part de tres pres de sa taille finale. Un panneau qui part de
 * 0.7 attire l'oeil sur le panneau lui-meme ; a 0.94, l'oeil va directement au
 * texte, qui est ce qu'on est venu lire.
 */
export const PANNEAU: Geste = {
  initial: { opacity: 0, scale: 0.94, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.94 },
  transition: RESSORT.panneau,
};

/** L'entree ordinaire : le contenu monte de quelques pixels en apparaissant. */
export const MONTEE: Geste = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: DUREE.rapide, ease: COURBE.sortie },
};

/**
 * Un bandeau qui monte du bas de l'ecran, et qui repart par le bas.
 *
 * La course est longue exprès : ce qui arrive par le bord doit se voir venir,
 * sinon le bandeau semble avoir toujours ete la et on clique dessus par
 * accident.
 */
export const FEUILLE: Geste = {
  initial: { opacity: 0, y: 60 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 60 },
  transition: { duration: DUREE.base, ease: COURBE.sortie },
};

/** Apparition sur place, sans deplacement : pour ce qui a deja sa position. */
export const FONDU: Geste = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: DUREE.base, ease: COURBE.sortie },
};

/** Une pastille, une medaille, un chiffre : ca grandit jusqu'a sa taille. */
export const SURGISSEMENT: Geste = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
  transition: { duration: DUREE.base, ease: COURBE.sortie },
};

/** Le meme geste, declenche plus tard. */
export function retarde(geste: Geste, delai: number): Geste {
  return { ...geste, transition: { ...geste.transition, delay: delai } };
}

/**
 * Le meme geste pour le i-eme element d'une liste, en cascade.
 *
 * Le pas par defaut est court : au-dela, une liste de huit lignes met une
 * seconde a finir d'arriver, et on attend au lieu de lire.
 */
export function cascade(geste: Geste, i: number, pas = 0.08): Geste {
  return retarde(geste, i * pas);
}

/**
 * Le reglage systeme « reduire les animations ».
 *
 * Ce n'est pas un gout : pour une partie des gens, un mouvement a l'ecran
 * provoque des nausees ou declenche une migraine. Un classement qui se
 * reordonne en glissant est exactement le genre de mouvement vise.
 *
 * `<MotionConfig reducedMotion="user">`, pose a la racine, neutralise deja les
 * deplacements et les changements de taille pour ces gens-la, en laissant
 * passer les fondus. Ce crochet reste utile quand le reglage change autre
 * chose qu'une valeur animee — supprimer un `layout`, ne pas lancer une
 * boucle, choisir de ne rien animer du tout.
 */
export function useAnimationsReduites(): boolean {
  const requete = '(prefers-reduced-motion: reduce)';
  const [reduit, setReduit] = useState(() => {
    try { return window.matchMedia(requete).matches; } catch { return false; }
  });
  useEffect(() => {
    let m: MediaQueryList;
    try { m = window.matchMedia(requete); } catch { return; }
    const suivre = () => setReduit(m.matches);
    m.addEventListener('change', suivre);
    return () => m.removeEventListener('change', suivre);
  }, []);
  return reduit;
}
