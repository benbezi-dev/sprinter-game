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
import { EST_TEST } from './canal';

type Paire = [string, string];

const MOTS: Record<string, Paire> = {
  // --- la banderole de l'accueil
  hw_sur:        ['ÉDITION LIMITÉE', 'LIMITED EDITION'],
  hw_titre:      ['La nuit du molosse', "The hound's night"],
  hw_sous:       ['treize nuits, une bête, et le temps qu\'il te reste',
                  'thirteen nights, one beast, and the time you have left'],
  hw_courir:     ['ENTRER', 'ENTER'],
  hw_reprendre:  ['REPRENDRE', 'RESUME'],

  // --- le tableau des nuits
  hw_nuits:      ['LES TREIZE NUITS', 'THE THIRTEEN NIGHTS'],
  hw_nuit_n:     ['NUIT {n}', 'NIGHT {n}'],
  hw_imparti:    ['{s} s pour passer', '{s}s to get through'],
  // les cinq traces (halloween-courses.js), dont le libelle n'existe qu'en francais
  'hw_trace_nuit-100':  ['100 M', '100 M'],
  'hw_trace_nuit-100v': ['100 M EN COURBE', '100 M ON THE BEND'],
  'hw_trace_nuit-200':  ['200 M EN LIGNE', '200 M STRAIGHT'],
  'hw_trace_nuit-300':  ['300 M EN LIGNE', '300 M STRAIGHT'],
  'hw_trace_nuit-400':  ['400 M EN LIGNE', '400 M STRAIGHT'],
  // le depart de la nuit (voir `depart` dans halloween-loi.js)
  hw_dep_blocs:   ['dans les blocs', 'from the blocks'],
  hw_dep_surpris: ['départ surpris', 'caught off guard'],
  hw_dep_elan:    ['départ lancé', 'rocking start'],
  hw_meilleur:   ['ton chrono : {s} s', 'your time: {s}s'],
  hw_verrouille: ['tiens la nuit précédente', 'hold the previous night first'],

  // --- l'edition datee : une nuit par jour, du 19 au 31 octobre
  hw_cal_titre:  ['LE CALENDRIER', 'THE CALENDAR'],
  hw_cal_sous:   ['une nuit par jour, du 19 au 31 octobre',
                  'one night a day, 19 to 31 October'],
  hw_ouvre_dans: ['ouvre dans {d}', 'opens in {d}'],
  // les durees du compte a rebours — elles etaient ecrites en dur, en francais
  hw_duree_j:    ['{j} j {h} h', '{j}d {h}h'],
  hw_duree_h:    ['{h} h {m} min', '{h}h {m}m'],
  hw_duree_m:    ['{m} min', '{m} min'],
  hw_date:       ['{d} oct.', 'Oct {d}'],

  hw_tenue:      ['TENUE', 'HELD'],
  hw_partir:     ['PARTIR', 'GO'],
  hw_fermer:     ['PLUS TARD', 'LATER'],

  // --- la regle, dite une fois, sur l'ecran d'entree
  hw_regle_titre: ['LA RÈGLE', 'THE RULE'],
  hw_regle: [
    'Un molosse part derrière toi, et il franchira la ligne d\'arrivée à la seconde près. '
    + 'Passe-la avant lui. Le chrono en haut de l\'écran ne compte pas ce que tu as couru : '
    + 'il compte ce qu\'il te reste.',
    'A hound starts behind you, and it will cross the finish line on the exact second. '
    + 'Get there first. The clock at the top of the screen does not count what you have run: '
    + 'it counts what you have left.',
  ],

  // --- l'avertissement et le confort (16/10 : la bete fait du bruit)
  hw_avertissement: [
    'Sons inquiétants, sursauts, flashs rouges et vibrations. Joue avec le son — au casque, c\'est pire.',
    'Unsettling sounds, jump scares, red flashes and vibration. Play with sound on — headphones make it worse.',
  ],
  hw_frayeur:      ['Frayeur réduite', 'Reduced scares'],
  hw_frayeur_sous: ['moins de sursauts, pas de secousse — la bête reste audible',
                    'fewer jump scares, no shaking — you can still hear the beast'],

  // --- pendant la course
  hw_derriere:   ['{m} m', '{m}m'],
  hw_dans_lecou: ['DANS TON COU', 'ON YOUR HEELS'],

  // --- apres la course
  hw_passe:      ['TU ES PASSÉ', 'YOU MADE IT'],
  hw_mordu:      ['IL T\'A EU', 'IT GOT YOU'],
  hw_chrono:     ['{s} s', '{s}s'],
  hw_marge:      ['{s} s d\'avance sur lui', '{s}s ahead of it'],
  hw_frole:      ['il est passé à {m} m de toi', 'it came within {m}m of you'],
  hw_prochaine:  ['nuit {n} · ouvre dans {d}', 'night {n} · opens in {d}'],
  // --- le recit (halloween-cinema.ts, LE RECIT) : un chapitre par nuit tenue
  hw_ch_n:       ['CHAPITRE {n}', 'CHAPTER {n}'],
  hw_la_suite:   ['LA SUITE · CHAPITRE {n}', 'NEXT · CHAPTER {n}'],
  hw_ch_ouvert:  ['la nuit {n} est ouverte', 'night {n} is open'],
  hw_ch_ferme:   ['Le chapitre {n} est de l\'autre côté de la ligne.',
                  'Chapter {n} is on the other side of the line.'],
  hw_lire:       ['LIRE', 'READ'],
  hw_refermer:   ['FERMER', 'CLOSE'],
  hw_recit:      ['LE RÉCIT', 'THE STORY'],
  hw_recit_lu:   ['{n} / {t} chapitres', '{n} / {t} chapters'],
  hw_toucher:    ['touche pour continuer', 'tap to continue'],
  hw_suite_nuit: ['tiens la nuit {n} pour le lire', 'hold night {n} to read it'],
  hw_manque:     ['il te manquait {m} m', 'you were {m}m short'],
  hw_suivante:   ['NUIT SUIVANTE', 'NEXT NIGHT'],
  hw_encore:     ['ENCORE', 'AGAIN'],
  hw_sortir:     ['SORTIR', 'LEAVE'],
  hw_toutes:     ['LES TREIZE NUITS SONT TOMBÉES', 'ALL THIRTEEN NIGHTS ARE DOWN'],
  hw_toutes_sous: ['La quatorzième n\'est pas sur le calendrier. Elle viendra quand même.',
                   'The fourteenth is not on the calendar. It will come anyway.'],

  // --- la meute : la nuit a plusieurs, jusqu'a huit (halloween-meute.ts)
  hw_m_titre:     ['LA MEUTE', 'THE PACK'],
  hw_m_sous:      ['jusqu\'à 8 sur la même nuit, une seule bête', 'up to 8 on the same night, one beast'],
  hw_m_entrer:    ['À PLUSIEURS', 'WITH FRIENDS'],
  hw_m_regle:     ['Une seule bête pour toute la meute, au même pistolet. Ceux qui passent la ligne avant elle survivent ; les autres sont classés par la distance où elle les a pris. On ne court en meute que les nuits que chacun a déjà débloquées. Rien ne s\'inscrit au récit : il se gagne seul.',
                   'One beast for the whole pack, on the same gun. Those who cross before it survive; the others are ranked by how far they got before it took them. A pack only runs nights every runner has already unlocked. Nothing counts toward the story: that one you earn alone.'],
  hw_m_ouvrir:    ['OUVRIR UNE MEUTE', 'START A PACK'],
  hw_m_nuit:      ['la nuit', 'the night'],
  hw_m_places:    ['coureurs', 'runners'],
  hw_m_creer:     ['OUVRIR', 'OPEN'],
  hw_m_rejoindre: ['REJOINDRE', 'JOIN'],
  hw_m_code:      ['CODE', 'CODE'],
  hw_m_nom:       ['ton nom', 'your name'],
  hw_m_nom_requis: ['un nom d\'abord : la meute doit savoir qui elle perd', 'a name first: the pack needs to know who it loses'],
  hw_m_connexion: ['on cherche la meute…', 'finding the pack…'],
  hw_m_salon:     ['MEUTE {code}', 'PACK {code}'],
  hw_m_inviter:   ['ENVOIE LE CODE OU LE LIEN', 'SEND THE CODE OR THE LINK'],
  hw_m_copier:    ['COPIER LE LIEN', 'COPY LINK'],
  hw_m_copie:     ['COPIÉ', 'COPIED'],
  hw_m_partager:  ['PARTAGER', 'SHARE'],
  hw_m_invitation: ['Rejoins ma meute sur Sprinter — la nuit du molosse, code {code}', 'Join my pack on Sprinter — the hound\'s night, code {code}'],
  hw_m_attente:   ['la meute part quand les {n} sont là et prêts', 'the pack goes when all {n} are in and ready'],
  hw_m_place_vide: ['place libre', 'open spot'],
  hw_m_pret:      ['JE SUIS PRÊT', 'I\'M READY'],
  hw_m_plus_pret: ['PAS ENCORE', 'NOT YET'],
  hw_m_est_pret:  ['PRÊT', 'READY'],
  hw_m_attend:    ['attend', 'waiting'],
  hw_m_toi:       ['toi', 'you'],
  hw_m_hote:      ['a ouvert', 'host'],
  hw_m_quitter:   ['QUITTER', 'LEAVE'],
  hw_m_err_reseau: ['la meute ne répond pas — réessaie', 'the pack is not answering — try again'],
  hw_m_err_introuvable: ['aucune meute sous ce code', 'no pack under this code'],
  hw_m_err_pas_une_nuit: ['ce code ouvre une course, pas une nuit', 'this code opens a race, not a night'],
  hw_m_err_complete: ['cette meute est complète', 'this pack is full'],
  hw_m_err_en_course: ['cette meute court déjà', 'this pack is already running'],
  hw_m_err_fermee: ['la meute s\'est dispersée', 'the pack has scattered'],
  hw_m_err_verrouillee: ['tu n\'as pas encore débloqué la nuit {n} : tiens-la seul d\'abord, puis reviens courir avec la meute',
                         'you haven\'t unlocked night {n} yet: get through it alone first, then come back and run with the pack'],
  hw_m_err_acces: ['accès de test manquant', 'missing test access'],
  hw_m_survit:    ['TU AS TENU', 'YOU MADE IT'],
  hw_m_mordu_a:   ['mordu à {m} m', 'taken at {m}m'],
  hw_m_en_course: ['court encore · {m} m', 'still running · {m}m'],
  hw_m_faux:      ['sorti au départ', 'out at the start'],
  hw_m_survivants: ['{n} sur {t} ont tenu', '{n} of {t} made it'],
  hw_m_personne:  ['la bête les a tous pris', 'the beast took them all'],
  hw_m_pris:      ['LA BÊTE T\'A PRIS · TU REGARDES LA MEUTE', 'THE BEAST GOT YOU · WATCHING THE PACK'],
  hw_m_chasse:    ['elle chasse {n}', 'it is hunting {n}'],
  hw_m_top_ouvrir: ['INVITER DES COUREURS DU TOP 500', 'INVITE RUNNERS FROM THE TOP 500'],
  hw_m_top_titre:  ['LE TOP 500', 'THE TOP 500'],
  hw_m_top_places: ['{n} place(s) libre(s) — leur téléphone sonne, ils rejoignent d\'un toucher', '{n} open spot(s) — their phone rings, they join with one tap'],
  hw_m_top_plein:  ['la meute est pleine', 'the pack is full'],
  hw_m_top_chercher: ['chercher un nom', 'search a name'],
  hw_m_top_inviter: ['INVITER', 'INVITE'],
  hw_m_top_invite: ['INVITÉ', 'INVITED'],
  hw_m_top_dedans: ['DANS LA MEUTE', 'IN THE PACK'],
  hw_m_top_hors:   ['INJOIGNABLE', 'UNREACHABLE'],
  hw_m_top_injoignable: ['{n} n\'a pas réservé son nom : impossible de le joindre', '{n} has not claimed their name: cannot be reached'],
  hw_m_top_nom:    ['réserve ton nom pour inviter (vestiaire → ton nom)', 'claim your name to invite (locker room → your name)'],
  hw_m_top_fini:   ['RETOUR À LA MEUTE', 'BACK TO THE PACK'],
  hw_m_revanche:  ['ENCORE UNE NUIT', 'ONE MORE NIGHT'],
  hw_m_revanche_ok: ['PRÊT · {n}/{t}', 'READY · {n}/{t}'],
  hw_m_attendre:  ['on attend les derniers…', 'waiting for the last ones…'],
};

/**
 * LES MOTS DU MODE TEST, A PART ET DERRIERE `EST_TEST`.
 *
 * Le mode s'ouvre au public (game/halloween-ouverture.js) et ses mots partent
 * avec lui ; ceux des outils du testeur — le bandeau, le voyageur temporel —
 * ne doivent pas suivre. `EST_TEST` se replie a la compilation : en
 * production, cette table est un objet vide et le bundler retire le reste
 * (verifie par tools/molosse-canal-test.mjs).
 */
const MOTS_TEST: Record<string, Paire> = EST_TEST ? {
  hw_test_bandeau: ['MODE TEST', 'TEST MODE'],
  hw_test_jour:    ['jour simulé : {d}', 'simulated day: {d}'],
  hw_test_reel:    ['heure réelle', 'real time'],
  hw_test_tout:    ['tout ouvert', 'all unlocked'],
  hw_test_source:  ['heure : {s}', 'time: {s}'],
  hw_test_voyage:  ['VOYAGEUR TEMPOREL', 'TIME TRAVELLER'],
} : {};

/** Un mot du mode, dans la langue courante, avec ses variables. */
export function mot(cle: string, vars?: Record<string, string>): string {
  const paire = MOTS[cle] || MOTS_TEST[cle];
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
