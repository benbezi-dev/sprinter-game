// LE DEFI DES VEDETTES — les mots de l'evenement.
//
// Tout ce que les defis des vedettes ecrivent a l'ecran : la banniere de
// l'accueil, la fiche avant la course, le verdict, le skin gagne.
//
// UN MOT COMMUN, ET SA VERSION PAR ATHLETE. `mot('vd_regle', vars, 'meba')`
// cherche d'abord « vd_regle:meba », puis « vd_regle » : le defi d'Aurel
// Manga garde les siens tels quels, celui de Meba-Mickael Zeze ne redit que
// ce qui change.
//
// POURQUOI ILS NE SONT PAS DANS sprinter-i18n.js, avec les autres. Pour la
// raison des mots d'Halloween (halloween-mots.ts) : l'evenement doit sortir du
// paquet public d'un seul drapeau (canal.ts, DEFI_VEDETTE_OUVERT), et la table
// commune, publiee sur un global, ne s'elague pas. Ici, les mots partent avec
// l'evenement.
//
// La forme est celle du reste du jeu : [francais, anglais], dans cet ordre.

import { SprinterI18N } from './engine';

type Paire = [string, string];

const MOTS: Record<string, Paire> = {
  // --- la banniere de l'accueil
  vd_sur:         ['NOUVEAU · HURDLERS', 'NEW · HURDLERS'],
  vd_sur_haies:   ['ÉVÉNEMENT', 'EVENT'],
  vd_titre:       ['Défie {nom} au 110 m haies', 'Take on {nom} over 110 m hurdles'],
  vd_sous:        ['Bats-le au Stade Jean-Delbert : son skin et le stade sont à gagner',
                   'Beat him at Stade Jean-Delbert: his skin and the stadium are yours to win'],
  vd_courir:      ['RELEVER LE DÉFI', 'TAKE IT ON'],
  vd_gagne:       ['SKIN GAGNÉ', 'SKIN WON'],
  vd_meilleur:    ['ton meilleur : {s}', 'your best: {s}'],

  // --- la fiche, avant la course
  vd_fiche_sur:   ['LE DÉFI', 'THE CHALLENGE'],
  vd_pays:        ['France', 'France'],
  vd_epreuve:     ['110 m haies', '110 m hurdles'],
  vd_lieu:        ['Stade Jean-Delbert · Montreuil', 'Stade Jean-Delbert · Montreuil'],
  vd_regle_titre: ['LA RÈGLE', 'THE RULE'],
  // Rien sur sa facon de courir : comme Meba-Mickael, il en a trois
  // (STYLES_CANON, sprinter-core.js, depuis le 03/10), a decouvrir.
  vd_regle:       ['Il court au couloir 5, juste à ta droite. '
                   + 'Passe la ligne avant lui. Dix haies : prends-les bien, '
                   + 'chacune mal passée lui rend du terrain.',
                   'He runs in lane 5, right next to you. '
                   + 'Cross the line before him. Ten hurdles: clear them well, '
                   + 'every bad one hands him ground back.'],
  vd_recompense:  ['À GAGNER', 'TO WIN'],
  vd_recompense_sous: ['son skin, à porter sur les courses de haies',
                       'his skin, to wear in hurdles races'],
  vd_partir:      ['COURIR', 'RUN'],
  vd_apprendre:   ['apprendre la haie d’abord', 'learn the hurdle first'],
  vd_fermer:      ['PLUS TARD', 'LATER'],

  // --- le verdict
  vd_battu:       ['TU AS BATTU {nom}', 'YOU BEAT {nom}'],
  vd_perdu:       ['{nom} T’A BATTU', '{nom} BEAT YOU'],
  vd_faux:        ['FAUX DÉPART', 'FALSE START'],
  vd_toi:         ['TOI', 'YOU'],
  vd_avance:      ['{s} d’avance', '{s} ahead'],
  vd_retard:      ['il te manquait {s}', 'you were {s} short'],
  vd_debloque:    ['SKIN DÉBLOQUÉ', 'SKIN UNLOCKED'],
  vd_debloque_sous: ['Il se porte sur les courses de haies.',
                     'It is worn in hurdles races.'],
  vd_porter:      ['LE PORTER', 'WEAR IT'],
  vd_porte:       ['PORTÉ', 'WORN'],
  vd_retirer:     ['LE RETIRER', 'TAKE IT OFF'],
  vd_rejouer:     ['REJOUER', 'RUN AGAIN'],
  vd_revanche:    ['REVANCHE', 'REMATCH'],
  vd_accueil:     ['ACCUEIL', 'HOME'],

  // --- MEBA-MICKAEL ZEZE : l'evenement special du sprint
  'vd_sur:meba':        ['ÉVÉNEMENT SPÉCIAL · SPRINT', 'SPECIAL EVENT · SPRINT'],
  'vd_titre:meba':      ['Défie {nom} au 100 m et au 200 m', 'Take on {nom} over 100 m and 200 m'],
  'vd_sous:meba':       ['Bats-le au 100 m et au 200 m et gagne son skin premium',
                         'Beat him over 100 m and 200 m and win his premium skin'],
  'vd_epreuve:meba':    ['100 m · 200 m', '100 m · 200 m'],
  'vd_lieu:meba':       ['Stade de la Riviera', 'Riviera Stadium'],
  // Rien sur sa facon de courir : il en a trois (STYLES_CANON, sprinter-core.js),
  // et c'est au joueur de les trouver.
  'vd_regle:meba':      ['Il court au couloir 5, juste à ta droite. '
                         + 'Passe sous son chrono pour le battre.',
                         'He runs in lane 5, right next to you. '
                         + 'Beat his time to beat him.'],
  'vd_recompense_sous:meba': ['son skin premium, à porter sur les courses de sprint',
                              'his premium skin, to wear in sprint races'],
  'vd_debloque_sous:meba':   ['Il se porte sur les courses de sprint.', 'It is worn in sprint races.'],
  // son bonus (look.departParfait et look.transParfaite, sprinter-core.js)
  'vs_bonus:meba':      ['+20 % de marge au départ canon et à la transition parfaite',
                         '+20% margin on the cannon start and the perfect transition'],

  // le stade que sa double victoire debloque (le Stade de la Riviera)
  'vd_stade:meba':      ['Bats-le au 100 m ET au 200 m : son skin et le Stade de la Riviera (en one shot) se débloquent ensemble.',
                         'Beat him over 100 m AND 200 m: his skin and the Riviera Stadium (in one shot) unlock together.'],
  // apres une premiere victoire : ce qui reste a courir
  vd_encore_titre:      ['PLUS QU’UNE ÉPREUVE', 'ONE RACE TO GO'],
  vd_encore:            ['Bats-le aussi au {e} pour gagner son skin.',
                         'Beat him over {e} too to win his skin.'],
  'vd_encore:meba':     ['Bats-le aussi au {e} : son skin et le Stade de la Riviera sont au bout.',
                         'Beat him over {e} too: his skin and the Riviera Stadium await.'],
  vd_stade_debloque:    ['STADE DÉBLOQUÉ', 'STADIUM UNLOCKED'],
  vd_stade_debloque_sous: ['Il se choisit en one shot, parmi les lieux.',
                           'Pick it in one shot, among the venues.'],
  vd_stade_verrou:      ['{nom} · bats {qui} au 100 m et au 200 m',
                         '{nom} · beat {qui} over 100 m and 200 m'],

  // --- AUREL MANGA : le stade que sa victoire debloque (03/10)
  'vd_stade:manga':     ['Bats-le au 110 m haies : son skin et le Stade Jean-Delbert (en one shot) se débloquent ensemble.',
                         'Beat him over 110 m hurdles: his skin and Stade Jean-Delbert (in one shot) unlock together.'],
  'vd_stade_verrou:manga': ['{nom} · bats {qui} au 110 m haies',
                            '{nom} · beat {qui} over 110 m hurdles'],

  // --- LE VESTIAIRE : l'espace ou l'on choisit ce que son coureur porte
  vs_maillot_porte: ['ton maillot', 'your jersey'],
  vs_a_gagner_n:  ['{n} à gagner', '{n} to win'],
  vs_titre:       ['SKINS', 'SKINS'],
  vs_sous:        ['Choisis ce que ton coureur porte en course.',
                   'Choose what your runner wears in races.'],
  vs_maillot:     ['TON MAILLOT', 'YOUR JERSEY'],
  vs_maillot_sous: ['Sur toutes les courses.', 'In every race.'],
  vs_bonus_titre: ['BONUS', 'BONUS'],
  // celui du skin d'Aurel (look.freinHaie, sprinter-core.js) ; celui de Meba
  // est plus haut, avec ses mots
  'vs_bonus:manga': ['−20 % de freinage après une haie mal passée',
                     '−20% slowdown after a badly cleared hurdle'],
  vs_a_gagner:    ['À GAGNER', 'TO WIN'],
  vs_comment:     ['Bats-le au 110 m haies pour le gagner.',
                   'Beat him over 110 m hurdles to win it.'],
  'vs_comment:meba': ['Bats-le au 100 m ET au 200 m pour le gagner.',
                      'Beat him over 100 m AND 200 m to win it.'],
  vs_ou:          ['Pas sur le stade de son défi : on ne court pas contre lui dans sa peau.',
                   'Not at his own challenge: you don’t race him in his skin.'],

  vd_a_battre:    ['à battre : {s}', 'to beat: {s}'],
  vd_courir_sur:  ['COURIR LE {e}', 'RUN THE {e}'],
};

// --- APRES UNE DEFAITE : ce qu'il te dit (03/10, a la demande de l'auteur).
//
// TROIS SITUATIONS, parce qu'on ne chambre pas de la meme facon un coureur
// parti avant le pistolet, un coureur battu de loin et un coureur battu d'un
// souffle (SERRE_S, DefiVedette.tsx). Plusieurs phrases pour chacune, tirees
// au hasard, sans jamais redire celle de la course d'avant : REVANCHE relance
// tout de suite, et la meme phrase deux fois de suite s'use.
//
// LE TON est celui du jeu entre potes (03/10, a la demande de l'auteur :
// « t'es tout tout propre, tu t'es fait laver ! », « il t'a fumé… c'est pas
// grave, ça reste entre nous ») : familier, ca chambre, ca ne rabaisse pas, et
// chaque phrase donne envie de la revanche. Ce sont de vrais athletes qui
// parlent : rien qu'ils ne puissent signer.
//
// DEUX VOIX. Une phrase est la sienne (« t'es tout tout propre… ») : elle
// s'affiche entre guillemets, signee de son nom. Ou c'est le jeu qui te parle
// de lui (`'jeu'`, « il t'a fumé… ») : ni guillemets ni signature, sans quoi
// on lirait Aurel parler de lui a la troisieme personne.
//
// LES PHRASES COMMUNES (`commun`) valent pour toutes les vedettes, et
// s'ajoutent aux siennes. Les guillemets ne sont pas dans les phrases :
// `phraseDeDefaite` les pose, a la francaise ou a l'anglaise.

export type CasDeDefaite = 'perdu' | 'serre' | 'faux';

/** Une phrase [francais, anglais], et `'jeu'` quand ce n'est pas lui qui parle. */
type Phrase = Paire | [string, string, 'jeu'];

const DEFAITES: Record<string, Partial<Record<CasDeDefaite, Phrase[]>>> = {
  commun: {
    perdu: [
      ['T’es tout tout propre, tu t’es fait laver !',
       'You’re all squeaky clean, you just got washed!'],
      ['Il t’a fumé… c’est pas grave, ça reste entre nous.',
       'He smoked you… no big deal, it stays between us.', 'jeu'],
      ['Tu m’as vu de dos tout le long. Profite, c’est mon meilleur profil.',
       'You saw my back the whole way. Enjoy, it’s my best side.'],
      ['J’ai fini, j’ai bu, j’ai signé deux autographes. T’arrives ?',
       'I finished, had a drink, signed two autographs. You coming?'],
      ['Il t’a mis dans le vent… on dira que c’était le vent de face.',
       'He left you in the wind… let’s call it a headwind.', 'jeu'],
      ['Respire, ça va aller. Moi, ça va très bien, merci.',
       'Breathe, you’ll be fine. Me, I’m doing great, thanks.'],
    ],
    serre: [
      ['Ouh, ça a chauffé ! Mais c’est moi qui suis passé.',
       'Ooh, that got hot! But I’m the one who got through.'],
      ['Il a eu chaud. Il dira le contraire, mais il a eu chaud.',
       'He was sweating. He’ll say otherwise, but he was sweating.', 'jeu'],
      ['T’étais là, hein. Pas devant, mais là.',
       'You were there, huh. Not in front, but there.'],
    ],
    faux: [
      ['T’étais pressé de perdre ?',
       'In a hurry to lose?'],
      ['Doucement ! Le pistolet, c’est pas une suggestion.',
       'Easy! The gun isn’t a suggestion.'],
      ['Parti avant tout le monde, arrivé nulle part.',
       'First off the line, finished nowhere.', 'jeu'],
    ],
  },
  manga: {
    perdu: [
      // son entree : il pointe la ligne d'arrivee avant de s'installer
      ['Je t’avais montré l’arrivée avant le départ. Tu n’as pas regardé ?',
       'I pointed at the finish before the start. Weren’t you watching?'],
      ['Dix haies, et je ne t’ai vu à aucune.',
       'Ten hurdles, and I didn’t see you at a single one.'],
      ['Une haie, ça ne se saute pas, ça se court. Reviens quand tu l’auras compris.',
       'You don’t jump a hurdle, you run it. Come back when you’ve got that.'],
      ['Mon bandeau est resté sec.',
       'My headband stayed dry.'],
      ['Les haies ne bougent pas. C’est toi qui dois aller plus vite.',
       'The hurdles don’t move. You’re the one who has to go faster.'],
      ['Les haies, moi je suis passé dessus. Toi, c’est elles qui te sont passées dessus.',
       'I went over the hurdles. You, they went over you.'],
    ],
    serre: [
      ['À la dixième haie, je t’entendais. À la ligne, plus du tout.',
       'At the tenth hurdle I could hear you. At the line, not anymore.'],
      ['Encore un effort, et je vais devoir courir pour de vrai.',
       'One more push and I’ll have to actually run.'],
      ['Pas mal. Ne le répète à personne.',
       'Not bad. Don’t tell anyone I said that.'],
    ],
    faux: [
      ['Le pistolet, c’est pour tout le monde. Même pour toi.',
       'The gun is for everyone. Even you.'],
      ['Tu voulais tellement me battre que tu es parti sans moi.',
       'You wanted to beat me so badly you left without me.'],
      ['J’étais encore en train de régler mes blocs.',
       'I was still setting my blocks.'],
    ],
  },
  meba: {
    perdu: [
      // son cri derriere les blocs, et ses trois claps
      ['J’ai crié LET’S GO. Ça valait pour toi aussi.',
       'I shouted LET’S GO. That was for you too.'],
      ['J’ai eu le temps de me retourner pour te chercher.',
       'I had time to turn around and look for you.'],
      ['Tu peux applaudir, maintenant. Fort, comme moi.',
       'You can clap now. Loud, like me.'],
      ['Le couloir 5, c’est le mien. L’arrivée aussi.',
       'Lane 5 is mine. So is the finish line.'],
    ],
    serre: [
      ['Tu m’as fait peur. Pas longtemps, mais tu m’as fait peur.',
       'You scared me. Not for long, but you scared me.'],
      ['Encore un peu, et c’est toi qui criais LET’S GO.',
       'A little more and you’d be the one shouting LET’S GO.'],
      ['Sur la ligne, j’ai vu ton épaule. Juste derrière la mienne.',
       'At the line I saw your shoulder. Right behind mine.'],
    ],
    faux: [
      ['Mes claps, c’était pour moi. Pas un signal pour toi.',
       'My claps were for me. Not a signal for you.'],
      ['On attend le pistolet. Même quand on est pressé de me battre.',
       'You wait for the gun. Even when you’re in a hurry to beat me.'],
      ['Trop pressé. Ici, ça se paie cash.',
       'Too eager. Around here, that costs you.'],
    ],
  },
};

/** La phrase tiree la fois d'avant, par athlete et par situation. */
const dejaDite: Record<string, number> = {};

/** Ce qui s'affiche sous le verdict : le texte, et qui le dit. */
export type PhraseDeDefaite = { texte: string; voix: 'lui' | 'jeu' };

/**
 * Ce qu'on te dit apres une defaite contre cet athlete, dans la langue
 * courante — ses phrases et les communes — ou null s'il n'y a rien a dire.
 * Les siennes viennent entre guillemets ; celles du jeu, sans.
 */
export function phraseDeDefaite(qui: string, cas: CasDeDefaite): PhraseDeDefaite | null {
  const lot = [...(DEFAITES.commun[cas] || []), ...(DEFAITES[qui]?.[cas] || [])];
  if (!lot.length) return null;
  const k = `${qui}:${cas}`;
  let i = Math.floor(Math.random() * lot.length);
  if (lot.length > 1 && i === dejaDite[k]) i = (i + 1 + Math.floor(Math.random() * (lot.length - 1))) % lot.length;
  dejaDite[k] = i;
  const p = lot[i];
  const s = p[SprinterI18N.index()];
  if (p.length === 3) return { texte: s, voix: 'jeu' };
  return { texte: SprinterI18N.index() === 0 ? `«\u202F${s}\u202F»` : `“${s}”`, voix: 'lui' };
}

/** Ce mot existe-t-il pour cet athlete (sa version, ou la commune) ? */
export function aLeMot(cle: string, qui?: string): boolean {
  return !!((qui && MOTS[`${cle}:${qui}`]) || MOTS[cle]);
}

/** Un mot de l'evenement, dans la langue courante, avec ses variables. */
export function mot(cle: string, vars?: Record<string, string>, qui?: string): string {
  const paire = (qui && MOTS[`${cle}:${qui}`]) || MOTS[cle];
  let s = paire ? paire[SprinterI18N.index()] : cle;
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}

/** Un chrono comme le jeu l'ecrit : au point, deux decimales, « s ». */
export function chrono(s: number | null | undefined): string {
  return s == null || !Number.isFinite(s) ? '—' : s.toFixed(2) + ' s';
}

/** Un palmares, dans la langue courante. */
export function ligne(p: Paire): string {
  return p[SprinterI18N.index()];
}
