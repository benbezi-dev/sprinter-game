import { useSyncExternalStore } from 'react';

/**
 * CE QUE L'ECRAN FAIT QUAND UN RECORD TOMBE.
 *
 * Deux records, deux fetes, et la difference doit se voir sans lire une
 * ligne. Battre son propre chrono arrive souvent, c'est le sel des dix
 * premieres courses : des confettis. Battre le meilleur chrono du monde
 * n'arrive presque jamais : des feux d'artifice, qu'on ne verra pas deux
 * fois dans la soiree et qui disent, tout seuls, que ce n'est pas la meme
 * chose. Les deux peuvent tomber ensemble — un record du monde est aussi un
 * record personnel — et c'est tant mieux : ce jour-la, tout part en l'air.
 *
 * POURQUOI UN MODULE, ET PAS UN BOOLEEN DANS CHAQUE ECRAN. La fete est
 * decidee a trois endroits qui ne se connaissent pas : le moteur au passage
 * de la ligne, l'ecran du one shot quand le TOP 500 a repondu, la fenetre du
 * record mondial quand le classement a tranche. Elle est jouee a un seul :
 * une toile posee sur tout le jeu. Chacun arme ici, la toile lit ici, et
 * personne ne monte deux pluies de confettis l'une sur l'autre.
 *
 * LE JETON EST LE COUREUR. Une fete appartient a la course qui l'a gagnee,
 * et un coureur neuf est construit a chaque depart : garder l'objet suffit a
 * ce que la fete meure d'elle-meme au coup de pistolet suivant, sans drapeau
 * a effacer ni minuteur a annuler.
 */

type Etat = {
  /** Le coureur dont le chrono a merite des confettis, ou null. */
  perso: unknown | null;
  /** Celui dont le chrono a merite les feux d'artifice. */
  monde: unknown | null;
};

let etat: Etat = { perso: null, monde: null };
const ecoutes = new Set<() => void>();

function poser(suite: Etat) {
  if (suite.perso === etat.perso && suite.monde === etat.monde) return;
  etat = suite;
  ecoutes.forEach(l => l());
}

/** Des confettis pour cette course-la. */
export function feterRecordPerso(course: unknown) {
  poser({ ...etat, perso: course ?? null });
}

/** Les feux d'artifice pour cette course-la. */
export function feterRecordDuMonde(course: unknown) {
  poser({ ...etat, monde: course ?? null });
}

export function useFete(): Etat {
  return useSyncExternalStore(
    l => { ecoutes.add(l); return () => { ecoutes.delete(l); }; },
    () => etat,
  );
}

/** Ce que le moteur range dans l'historique local, en abrege. */
type LigneBrute = { r: string; t: number };

/**
 * Les chronos deja courus sur cette distance, celui qu'on juge excepte.
 *
 * L'historique est ecrit AVANT que le moteur ne previenne la couche moderne :
 * le chrono qui vient de tomber est donc en tete de sa distance. Le laisser
 * la reviendrait a le comparer a lui-meme, et plus rien ne serait jamais un
 * record.
 */
function chronosDAvant(race: string): number[] {
  const brut = ((globalThis as any).SprinterApp?.raceHistory?.() || []) as LigneBrute[];
  return brut.filter(c => c.r === race).map(c => c.t).slice(1);
}

/**
 * Ce chrono bat-il tout ce que l'appareil a garde sur cette distance ?
 *
 * Une premiere course n'est pas un record : il n'y avait rien a battre, et
 * des confettis pour un chrono qu'on vient d'inventer ne veulent rien dire.
 * Un chrono egal non plus — on l'egale, on ne le bat pas.
 *
 * L'historique local est plafonne a trois cents courses. Passe ce mur, un
 * tres vieux record finit par sortir et le suivant sera fete a tort : c'est
 * le prix d'une mesure qui marche hors ligne et sans attendre le reseau, et
 * il se paie apres trois cents courses sur la meme distance.
 */
export function estRecordPerso(race: string, secondes: number): boolean {
  const avant = chronosDAvant(race);
  if (!avant.length) return false;
  return Math.round(secondes * 100) / 100 < Math.min(...avant);
}

/**
 * Une course vient d'etre rangee : decide de sa fete.
 *
 * Appele a chaque arrivee, record ou pas — c'est ce qui rend la mesure sure.
 * Une course sans record efface la fete de la precedente plutot que de la
 * laisser trainer, et le record du monde, lui, repart a zero : il ne se
 * confirme qu'apres, quand le classement a repondu.
 */
export function jugerLaCourse(race: string, secondes: number | null, course: unknown) {
  const perso = secondes != null && secondes > 0 && estRecordPerso(race, secondes);
  poser({ perso: perso ? (course ?? null) : null, monde: null });
}
