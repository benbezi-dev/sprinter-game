// L'EN-TETE D'UNE RETRANSMISSION : la competition, la date, l'heure.
//
// POURQUOI IL EXISTE. La video d'une course de championnat part dans une
// conversation, une story, un fil. Celui qui la recoit voit huit coureurs sur
// une piste et rien ne lui dit ce qu'il regarde : ni de quelle competition il
// s'agit, ni quel jour elle s'est courue. Le carton de fin repond une seconde
// et demie plus tard (voir `carton-film.ts`), mais une retransmission porte sa
// marque PENDANT, pas seulement a la fin — c'est ce que fait n'importe quelle
// chaine qui diffuse une finale.
//
// UNE SEULE SOURCE POUR L'ECRAN ET POUR LE FILM. Le HUD du jeu est du DOM
// React, le HUD du film est repeint au pinceau sur le canvas (`hud-film.ts`),
// et les deux doivent afficher le meme texte au meme endroit — un film qui ne
// ressemble pas au jeu est un defaut, pas une variante. Les deux lisent donc
// ce module, qui lit lui-meme `G` : pas d'etat React, pas d'abonnement, rien
// qui puisse prendre une image de retard sur l'autre.
//
// POURQUOI SUR `G` ET PAS DANS L'ETAT DU REJEU. `champ-rejeu.ts` importe
// `film-course.ts`, qui importe `hud-film.ts` : si le pinceau allait lire
// l'etat du rejeu, les trois modules se refermeraient en cycle. `G` est le
// tableau noir que tout le monde a deja sous la main.

import { SprinterApp } from './engine';

export type BandeauRejeu = {
  /** « Championnat de France », deja accorde par le serveur. */
  competition: string;
  /**
   * « Finale », « Demi-finale 2 » — ce qu'on regarde.
   *
   * Le HUD du jeu met ce nom a la place du nom du niveau des qu'on regarde une
   * course ; le pinceau du film le prend ici, faute de pouvoir lire l'etat du
   * rejeu sans refermer un cycle d'imports.
   */
  course: string;
  /** L'heure de la course, prise au calendrier de l'edition. `null` si inconnue. */
  quand: number | null;
  /**
   * LE MOT DU VAINQUEUR, POUR LE CARTON DE FIN.
   *
   * IL NE PEUT PAS ETRE CELUI DE LA COURSE QU'ON VIENT DE FILMER, et c'est
   * une limite de l'ordre des choses, pas un oubli : l'enregistreur s'arrete
   * sur la ligne d'arrivee, et le vainqueur ecrit son mot apres. Le film qui
   * sort dans la minute ne peut donc porter que le silence.
   *
   * Ce qu'il porte, c'est le mot DEJA POSE — celui qu'on retrouve en revoyant
   * une course courue plus tot. Le vainqueur qui veut son mot dans la video
   * le pose, puis relance le rejeu : la seconde prise l'emporte avec elle.
   */
  mot: { nom: string; texte: string } | null;
};

/** L'en-tete a peindre, ou `null` hors d'un rejeu de championnat. */
export function lireLeBandeau(): BandeauRejeu | null {
  const b = (SprinterApp as any)?.G?.rejeuBandeau;
  return b && b.competition ? b : null;
}

/**
 * La date et l'heure de la course, dans la langue du joueur.
 *
 * LE CALENDRIER EST EN UTC ET S'AFFICHE A L'HEURE D'ICI — c'est la regle de
 * l'ecran du championnat, et l'en-tete la suit : « le meme weekend partout »
 * n'a de sens que sur une horloge commune, mais personne ne lit UTC.
 *
 * L'ANNEE Y EST. Une course se revoit des mois apres, et une video de
 * championnat est une archive : « 22 sept. » seul ne dit pas de quelle edition
 * il s'agit des qu'il y en a eu deux.
 */
export function quandDeLaCourse(quand: number | null): string | null {
  if (quand == null) return null;
  try {
    const lang = (SprinterApp as any)?.N?.getLang?.() === 'en' ? 'en-GB' : 'fr-FR';
    const d = new Date(quand);
    const jour = d.toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' });
    const heure = d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
    return `${jour} · ${heure}`;
  } catch {
    // Une date illisible ne doit pas emporter l'en-tete entier : le nom de la
    // competition, lui, reste vrai.
    return null;
  }
}
