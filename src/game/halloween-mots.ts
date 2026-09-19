// LA NUIT DU MOLOSSE — les mots du mode.
//
// Tout ce que le mode ecrit a l'ecran hors scenettes : la banderole de
// l'accueil, le tableau des treize nuits, le compte a rebours, les boutons.
//
// POURQUOI ILS NE SONT PAS DANS sprinter-i18n.js, avec les autres. Ce mode
// doit pouvoir sortir du paquet d'un seul drapeau (canal.ts,
// HALLOWEEN_OUVERT). La table commune est publiee sur un global : un bundler
// ne peut pas suivre ce qui y entre, et ces quarante lignes y seraient restees
// pour toujours, meme le mode ferme. Ici, elles partent avec lui.
//
// La forme est celle du reste du jeu, et c'est ce qui compte : [francais,
// anglais], dans cet ordre, comme UI dans sprinter-i18n.js.

import { SprinterI18N } from './engine';

type Paire = [string, string];

const MOTS: Record<string, Paire> = {
  // --- la banderole de l'accueil
  hw_sur:        ['EDITION LIMITEE', 'LIMITED EDITION'],
  hw_titre:      ['La nuit du molosse', "The hound's night"],
  hw_sous:       ['treize nuits, un chien, et un chrono a l\'envers',
                  'thirteen nights, one hound, and a clock running backwards'],
  hw_courir:     ['ENTRER', 'ENTER'],
  hw_reprendre:  ['REPRENDRE', 'RESUME'],

  // --- le tableau des nuits
  hw_nuits:      ['LES TREIZE NUITS', 'THE THIRTEEN NIGHTS'],
  hw_nuit_n:     ['NUIT {n}', 'NIGHT {n}'],
  hw_imparti:    ['{s} s pour passer', '{s}s to get through'],
  hw_meilleur:   ['ton chrono : {s} s', 'your time: {s}s'],
  hw_verrouille: ['tiens la nuit precedente', 'hold the previous night first'],
  hw_tenue:      ['TENUE', 'HELD'],
  hw_partir:     ['PARTIR', 'GO'],
  hw_fermer:     ['PLUS TARD', 'LATER'],

  // --- la regle, dite une fois, sur l'ecran d'entree
  hw_regle_titre: ['LA REGLE', 'THE RULE'],
  hw_regle: [
    'Un molosse part derriere toi, et il franchira la ligne d\'arrivee a la seconde pres. '
    + 'Passe-la avant lui. Le chrono en haut de l\'ecran ne compte pas ce que tu as couru : '
    + 'il compte ce qu\'il te reste.',
    'A hound starts behind you, and it will cross the finish line on the exact second. '
    + 'Get there first. The clock at the top of the screen does not count what you have run: '
    + 'it counts what you have left.',
  ],

  // --- pendant la course
  hw_reste:      ['RESTE', 'LEFT'],
  hw_derriere:   ['{m} m', '{m}m'],
  hw_dans_lecou: ['DANS TON COU', 'ON YOUR HEELS'],

  // --- apres la course
  hw_passe:      ['TU ES PASSE', 'YOU MADE IT'],
  hw_mordu:      ['IL T\'A EU', 'IT GOT YOU'],
  hw_chrono:     ['{s} s', '{s}s'],
  hw_marge:      ['{s} s d\'avance sur lui', '{s}s ahead of it'],
  hw_manque:     ['il te manquait {m} m', 'you were {m}m short'],
  hw_suivante:   ['NUIT SUIVANTE', 'NEXT NIGHT'],
  hw_encore:     ['ENCORE', 'AGAIN'],
  hw_sortir:     ['SORTIR', 'LEAVE'],
  hw_toutes:     ['LES TREIZE NUITS SONT TOMBEES', 'ALL THIRTEEN NIGHTS ARE DOWN'],
  hw_toutes_sous: ['Le cimetiere reste ouvert. Le chien aussi.',
                   'The cemetery stays open. So does the hound.'],
  hw_suite:      ['toucher pour continuer', 'tap to continue'],
};

/** Un mot du mode, dans la langue courante, avec ses variables. */
export function mot(cle: string, vars?: Record<string, string>): string {
  const paire = MOTS[cle];
  let s = paire ? paire[SprinterI18N.index()] : cle;
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}

/**
 * Un chrono, ecrit comme le jeu l'ecrit.
 *
 * AU POINT, ET PAS A LA VIRGULE. Le jeu entier affiche « 8.68 s » — c'est son
 * usage, discutable et discute ailleurs, mais un mode qui ecrirait « 8,68 s »
 * a cote des autres ecrans aurait juste l'air d'un mode ecrit par quelqu'un
 * d'autre. On suit, et le jour ou le jeu passera a la virgule, cette fonction
 * est le seul endroit a changer pour ce mode.
 */
export function chrono(s: number): string {
  return s.toFixed(2);
}
