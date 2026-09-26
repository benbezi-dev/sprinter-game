/* ---------------------------------------------------------------------------
   LE TCHAT RAPIDE — des phrases ecrites par le jeu, envoyees par les joueurs
   ---------------------------------------------------------------------------
   Un tchat libre dans une salle de course, c'est un texte ecrit par un inconnu
   qui s'affiche chez un autre, sans personne pour le relire : la boite a
   insultes que mot.js refuse d'ouvrir. L'organisateur l'a tranche le 26/09 :
   pas de texte libre, un tchat rapide.

   CE QUI VOYAGE N'EST PAS UNE PHRASE, C'EST SON IDENTIFIANT. Le serveur ne
   laisse passer qu'un nom pris dans la liste ci-dessous, et chaque telephone
   ecrit la phrase dans SA langue (sprinter-i18n.js, cles `rapide_*`). Rien a
   filtrer, rien a traduire, rien a moderer : on ne peut pas glisser un numero
   de telephone ou une insulte dans « p_blocs ».

   La liste est la meme cote jeu (src/game/tchat-rapide.ts). Un identifiant
   ajoute d'un seul cote est refuse ici, ou n'a pas de texte la-bas : les deux
   se modifient ensemble.

   Ce qui reste a tenir, c'est la cadence. Une phrase gentille repetee trente
   fois par seconde est du bruit, et une tribune de championnat pleine de
   spectateurs le fabrique vite. Deux verrous, en memoire :
   - par joueur : deux secondes entre deux envois, six au plus sur vingt ;
   - par salle : douze bulles au plus sur cinq secondes, tout le monde
     confondu. Au-dela, la bulle se perd sans bruit : l'ecran n'en montrerait
     de toute facon pas davantage.
--------------------------------------------------------------------------- */

/** Les identifiants recevables. Voir src/game/tchat-rapide.ts. */
export const RAPIDES = new Set([
  // Les piques : du chambrage entre coureurs, jamais blessant.
  'p_echauffement', 'p_ralenti', 'p_personne', 'p_blocs', 'p_forcer', 'p_ligne',
  // Les encouragements.
  'e_marques', 'e_meilleur', 'e_envoie', 'e_propre', 'e_bien', 'e_revanche',
  // L'arcade : des mots de borne, les memes dans les deux langues.
  'a_go', 'a_perfect', 'a_photo', 'a_combo',
  // Les emojis.
  'x_feu', 'x_eclair', 'x_bravo', 'x_force', 'x_rage', 'x_oups', 'x_choc', 'x_drapeau',
]);

export const ECART_MS = 2000;
export const FENETRE_MS = 20000;
export const MAX_FENETRE = 6;
const SALLE_FENETRE_MS = 5000;
const SALLE_MAX = 12;

/** L'identifiant est-il dans la liste ? Rien d'autre ne passe. */
export function rapideRecevable(q) {
  return typeof q === 'string' && RAPIDES.has(q);
}

/**
 * La cadence d'une salle.
 *
 * En memoire, comme tout le reste d'une salle : elle ne survit pas a la salle,
 * et n'a pas a le faire.
 */
export class DebitRapide {
  constructor() {
    /** @type {Map<string, number[]>} les envois recents de chacun */
    this.parJoueur = new Map();
    /** @type {number[]} les bulles recentes de la salle entiere */
    this.salle = [];
  }

  /**
   * Juge un envoi. Rend null s'il passe, 'debit' si ce joueur va trop vite,
   * 'salle' si la salle entiere deborde.
   */
  juger(qui, maintenant = Date.now()) {
    const siens = (this.parJoueur.get(qui) || []).filter(t => maintenant - t < FENETRE_MS);
    if (siens.length && maintenant - siens[siens.length - 1] < ECART_MS) return 'debit';
    if (siens.length >= MAX_FENETRE) return 'debit';
    this.salle = this.salle.filter(t => maintenant - t < SALLE_FENETRE_MS);
    if (this.salle.length >= SALLE_MAX) return 'salle';
    siens.push(maintenant);
    this.parJoueur.set(qui, siens);
    this.salle.push(maintenant);
    return null;
  }

  /** Un joueur parti n'a plus de cadence a tenir. */
  oublier(qui) { this.parJoueur.delete(qui); }
}
