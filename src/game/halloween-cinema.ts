// LA NUIT DU MOLOSSE — ce qu'on raconte apres la course.
//
// Treize chapitres, un par nuit tenue, et quatre cauchemars pour les morsures
// (voir LE RECIT). Ils sont le vrai contenu du mode — la course dure onze
// secondes, l'histoire reste, et c'est elle qu'on revient chercher le
// lendemain.
//
// ELLES FONT PEUR (08/10, « je veux qu'il fasse peur »). La premiere serie
// faisait rire : un facteur promu, un short refuse par les commissaires. Elle
// allait contre tout le reste du mode — la lune rousse, les yeux entre les
// tombes, la tete de la bete au premier plan —, et le joueur sortait de la
// scene plus leger qu'il n'y etait entre. Elle est reecrite d'un bout a
// l'autre ; les deux regles qui suivent sont celles qui ont survecu.
//
// DEUX REGLES D'ECRITURE, ET ELLES VALENT PLUS QUE LE RESTE DU FICHIER.
//
// 1. LE FROID EST TOUJOURS SUR LA DERNIERE LIGNE, et les trois premieres ne
//    font que le preparer. Les trois premieres sont ordinaires, presque
//    rassurantes : un medecin, un bus, une porte fermee a double tour. Le jeu
//    affiche les quatre lignes une par une, a intervalle fixe, et la derniere
//    arrive dans un silence qu'on a le temps de sentir — c'est elle qui doit
//    retourner les trois autres. Une scenette qui annoncerait la peur avant
//    de la poser n'en ferait aucune.
//
// 2. ON NE MONTRE JAMAIS LA BLESSURE. La scenette parle d'une cicatrice qui
//    chauffe, d'un miroir, de traces autour d'un lit. La peur vient de ce qui
//    revient la nuit, pas de ce qui saigne : c'est ce qui separe une histoire
//    qui glace d'un truc desagreable. Un jeu ou l'on court se joue aussi chez
//    des gens de douze ans.
//
// ET ON NE FAIT PAS L'INVENTAIRE DE CE QUI EST ARRACHE (09/10). La serie du
// 08/10 faisait perdre un short, un petit doigt, une oreille, un nom : ecrit
// au plus froid, le principe restait un gag. Voir MORSURES.
//
// LES TEXTES VIVENT ICI ET NON DANS sprinter-i18n.js. Tout le mode doit
// pouvoir sortir du paquet d'un seul drapeau (canal.ts, HALLOWEEN_OUVERT) ;
// quatorze scenettes en deux langues posees dans la table commune y seraient
// restees, puisqu'un bundler ne peut pas suivre ce qui est publie sur un
// global. La forme, elle, est celle du reste du jeu : [francais, anglais].

import { SprinterI18N } from './engine';

export type Scene = {
  cle: string;
  /** Le bandeau au-dessus du titre. */
  sur: [string, string];
  /** Le titre, gros. */
  titre: [string, string];
  /** Les quatre lignes, servies une a une. */
  lignes: [string, string][];
};

/** La langue courante, sous la forme que ces tables attendent. */
function i(): 0 | 1 { return SprinterI18N.index() as 0 | 1; }

/** Le texte de la langue courante. */
export function dit(paire: [string, string]): string { return paire[i()]; }

/* ---------------------------------------------------------------------------
   LE RECIT — un chapitre par nuit tenue
   ---------------------------------------------------------------------------
   REECRIT LE 17/10 (« une vraie histoire, a travers les cartes, qui donne
   envie de revenir chaque jour pour la suite comme une recompense »).

   Les six scenettes de victoire etaient tirees au hasard : la nuit 9 pouvait
   raconter la meme chose que la nuit 2, et rien ne reliait un soir au
   suivant. Elles sont remplacees par TREIZE CHAPITRES, dans l'ordre, un par
   nuit. Tenir la nuit N, c'est lire le chapitre N — et c'est la seule facon de
   le lire. Le calendrier ouvre une nuit par jour : l'histoire avance donc
   d'un chapitre par jour, et chaque chapitre se termine sur ce qui manque
   pour comprendre (`accroche` du suivant), affiche avec le compte a rebours.

   L'HISTOIRE. Le joueur coupe chaque soir par la ruelle des Tanneurs. Une
   bete le poursuit ; elle court au temps exact d'un sprinteur de 1913,
   Lucien Marchal, disparu dans cette ruelle le 31 octobre, a deux metres de
   sa treizieme ligne d'arrivee. Son chien, Argos, recourt depuis cette
   course chaque nuit, en attendant que quelqu'un la finisse devant lui. La
   regle du mode (la bete passe la ligne a la seconde pres) devient le coeur
   de l'intrigue : ce sont les temps de Lucien.

   LES REGLES D'ECRITURE DU 08/10 TIENNENT TOUJOURS : le froid sur la derniere
   ligne, jamais de blessure montree, rien qui fasse rire. Le recit passe au
   TUTOIEMENT : l'ecran dit deja « TU ES PASSE » au-dessus, et une histoire
   qu'on gagne se lit mieux a la deuxieme personne. Lignes de 57 signes au
   plus (au-dela, un mot reste seul a 375 px).

   LES IMAGES. Les dix cartes rendues dans Unity (assets/molosse-cartes) sont
   distribuees sur les chapitres dont elles montrent la scene ; `cle` est le
   nom du fichier. Les chapitres 3, 7 et 13 n'ont pas d'image et retombent
   sur la scene dessinee.
--------------------------------------------------------------------------- */
export type Chapitre = Scene & {
  n: number;
  /** Ce qu'on sait du chapitre AVANT de l'avoir gagne : la promesse. */
  accroche: [string, string];
};

const CH = (n: number): [string, string] => [`CHAPITRE ${n}`, `CHAPTER ${n}`];

export const CHAPITRES: readonly Chapitre[] = [
  {
    n: 1, cle: 'empreintes', sur: CH(1),
    titre: ['LA RUELLE', 'THE ALLEY'],
    accroche: ['Quelque chose court dans la ruelle, la nuit.',
               'Something runs in the alley at night.'],
    lignes: [
      ['Chaque soir, tu coupes par la ruelle des Tanneurs.',
       'Every evening you cut through Tanners\' Alley.'],
      ['Ce soir, quelque chose t\'a couru après. Tu l\'as semé.',
       'Tonight something ran after you. You lost it.'],
      ['Ses empreintes repartaient vers une porte murée.',
       'Its prints led back to a bricked-up door.'],
      ['Sur la plaque, une date : 31 octobre 1913.',
       'On the plaque, a date: 31 October 1913.'],
    ],
  },
  {
    n: 2, cle: 'chrono', sur: CH(2),
    titre: ['LE CHRONO', 'THE WATCH'],
    accroche: ['Ta montre a vu quelque chose que tu n\'as pas vu.',
               'Your watch saw something you didn\'t.'],
    lignes: [
      ['Ce soir, ta montre a enregistré deux temps.',
       'Tonight your watch logged two times.'],
      ['Le tien. Et un second, un dixième derrière.',
       'Yours. And another, a tenth behind.'],
      ['La bête ne court pas au hasard. Elle court un temps.',
       'The beast doesn\'t run at random. It runs a time.'],
      ['Le temps de quelqu\'un qui courait ici avant toi.',
       'The time of someone who ran here before you.'],
    ],
  },
  {
    n: 3, cle: 'registre', sur: CH(3),
    titre: ['LE REGISTRE', 'THE LEDGER'],
    accroche: ['Un nom, dans le vieux registre du club.',
               'A name, in the club\'s old ledger.'],
    lignes: [
      ['Au club, tu as ouvert le registre des courses de 1913.',
       'At the club, you opened the 1913 race ledger.'],
      ['Une seule page tenait encore. Un seul nom :',
       'Only one page was left. Only one name:'],
      ['« Lucien Marchal. 100 m en 9″00. Et son chien. »',
       '“Lucien Marchal. 100 m in 9.00. And his dog.”'],
      ['En marge, d\'une autre encre : « Il court encore. »',
       'In the margin, in other ink: “He is still running.”'],
    ],
  },
  {
    n: 4, cle: 'faim', sur: CH(4),
    titre: ['LA PHOTO', 'THE PHOTOGRAPH'],
    accroche: ['Le journal du 1er novembre 1913.',
               'The newspaper of 1 November 1913.'],
    lignes: [
      ['Aux archives, le journal du 1er novembre 1913.',
       'In the archives: the paper of 1 November 1913.'],
      ['« Le sprinteur Lucien Marchal a disparu cette nuit. »',
       '“Sprinter Lucien Marchal vanished last night.”'],
      ['Dessous, une photo de la ruelle et de ses chiens.',
       'Below, a photo of the alley and its dogs.'],
      ['Au fond de la photo, quelqu\'un te ressemble.',
       'At the back of the photo, someone looks like you.'],
    ],
  },
  {
    n: 5, cle: 'reflet', sur: CH(5),
    titre: ['LE REFLET', 'THE REFLECTION'],
    accroche: ['La vitrine du vieux tailleur.',
               'The old tailor\'s window.'],
    lignes: [
      ['Tu as soufflé devant la vitrine du vieux tailleur.',
       'You caught your breath at the old tailor\'s window.'],
      ['Dans le reflet, tu portais un maillot d\'un autre siècle.',
       'In the glass, you wore a vest from another century.'],
      ['Un dossard cousu main. Le numéro 13.',
       'A hand-sewn bib. Number 13.'],
      ['Ton reflet a souri. Pas toi.',
       'Your reflection smiled. You didn\'t.'],
    ],
  },
  {
    n: 6, cle: 'appel', sur: CH(6),
    titre: ['L’APPEL', 'THE CALL'],
    accroche: ['Ton téléphone va sonner à 3 h 12.',
               'Your phone will ring at 3:12.'],
    lignes: [
      ['À 3 h 12, ton téléphone a sonné. Numéro masqué.',
       'At 3:12 your phone rang. Number withheld.'],
      ['Une voix d\'homme, essoufflée, venue de très loin.',
       'A man\'s voice, out of breath, from very far away.'],
      ['« Ne cours pas pour lui échapper. Cours pour finir. »',
       '“Don\'t run to escape it. Run to finish.”'],
      ['Derrière la voix, des griffes raclaient des pavés.',
       'Behind the voice, claws were scraping cobbles.'],
    ],
  },
  {
    n: 7, cle: 'porte-muree', sur: CH(7),
    titre: ['LA PORTE MURÉE', 'THE BRICKED-UP DOOR'],
    accroche: ['Une brique bouge, dans la porte murée.',
               'A brick is loose in the bricked-up door.'],
    lignes: [
      ['Tu es retourné à la porte murée. Une brique bougeait.',
       'You went back to the bricked-up door. A brick moved.'],
      ['Derrière : des pointes rouillées et un carnet.',
       'Behind it: rusted spikes and a notebook.'],
      ['Treize courses notées. Treize temps. Ceux de tes nuits.',
       'Thirteen races. Thirteen times. Those of your nights.'],
      ['Dernière page : « 31 octobre. Il me rattrape. »',
       'Last page: “31 October. It\'s catching me.”'],
    ],
  },
  {
    n: 8, cle: 'porte', sur: CH(8),
    titre: ['SOUS LE LIT', 'UNDER THE BED'],
    accroche: ['Tu as rapporté le carnet chez toi.',
               'You took the notebook home.'],
    lignes: [
      ['Tu as glissé le carnet de Lucien sous ton lit.',
       'You slid Lucien\'s notebook under your bed.'],
      ['Cette nuit, un souffle lent est monté du plancher.',
       'That night, slow breathing rose from the floor.'],
      ['Deux yeux rouges. Elle ne grognait pas. Elle veillait.',
       'Two red eyes. It wasn\'t growling. It was keeping watch.'],
      ['Elle dormait, la tête posée sur le carnet.',
       'It was asleep, its head resting on the notebook.'],
    ],
  },
  {
    n: 9, cle: 'traces', sur: CH(9),
    titre: ['LE NOM', 'THE NAME'],
    accroche: ['La bête a un nom. Elle va te le donner.',
               'The beast has a name. It will give it to you.'],
    lignes: [
      ['Au matin, des traces de terre faisaient le tour du lit.',
       'In the morning, muddy prints circled your bed.'],
      ['Au pied du lit, des griffes avaient creusé un mot.',
       'At the foot of the bed, claws had carved a word.'],
      ['ARGOS.',
       'ARGOS.'],
      ['Tu l\'as dit à voix haute. Sous le plancher, ça a gémi.',
       'You said it aloud. Under the floor, something whined.'],
    ],
  },
  {
    n: 10, cle: 'odeur', sur: CH(10),
    titre: ['L’ODEUR', 'THE SCENT'],
    accroche: ['Ce n\'est pas toi qu\'Argos renifle.',
               'It isn\'t you that Argos is sniffing for.'],
    lignes: [
      ['Ce soir, Argos ne t\'a pas suivi jusqu\'au bout.',
       'Tonight, Argos didn\'t follow you all the way.'],
      ['Il s\'est arrêté sous ta fenêtre, et il a reniflé.',
       'He stopped under your window, and sniffed.'],
      ['Ce n\'est pas ta trace qu\'il suit. C\'est celle de Lucien.',
       'It isn\'t your trail he follows. It\'s Lucien\'s.'],
      ['Et chaque nuit, il la trouve un peu plus sur toi.',
       'And every night, he finds more of it on you.'],
    ],
  },
  {
    n: 11, cle: 'miroir', sur: CH(11),
    titre: ['LE MIROIR', 'THE MIRROR'],
    accroche: ['Lucien va te parler. Dans le miroir.',
               'Lucien will speak to you. In the mirror.'],
    lignes: [
      ['Dans le miroir de la salle de bain, il y avait toi.',
       'In the bathroom mirror, there you were.'],
      ['Puis Lucien, derrière ton épaule. Il n\'avait pas vieilli.',
       'Then Lucien, behind your shoulder. He hadn\'t aged.'],
      ['« Il ne veut pas me mordre. Il veut que je finisse. »',
       '“He doesn\'t want to bite me. He wants me to finish.”'],
      ['« J\'ai abandonné à deux mètres de la ligne. »',
       '“I gave up two metres from the line.”'],
    ],
  },
  {
    n: 12, cle: 'marque', sur: CH(12),
    titre: ['MINUIT', 'MIDNIGHT'],
    accroche: ['Ce qu\'Argos attend depuis 1913.',
               'What Argos has been waiting for since 1913.'],
    lignes: [
      ['Lucien n\'a jamais fini sa treizième course.',
       'Lucien never finished his thirteenth race.'],
      ['Depuis, Argos la recourt chaque nuit, à son temps.',
       'Since then, Argos has run it every night, at his time.'],
      ['Il attend que quelqu\'un passe la ligne devant lui.',
       'He is waiting for someone to cross the line first.'],
      ['La treizième nuit est la sienne. Et il t\'a choisi.',
       'The thirteenth night is his. And he has chosen you.'],
    ],
  },
  {
    n: 13, cle: 'finale', sur: ['CHAPITRE 13 · LA FIN', 'CHAPTER 13 · THE END'],
    titre: ['LE JOUR SE LÈVE', 'DAYBREAK'],
    accroche: ['La treizième course de Lucien. À finir.',
               'Lucien\'s thirteenth race. Yours to finish.'],
    lignes: [
      ['Tu as passé la ligne. Argos s\'est arrêté net.',
       'You crossed the line. Argos stopped dead.'],
      ['Au bout de la ruelle, un homme en maillot l\'attendait.',
       'At the end of the alley, a man in a vest was waiting.'],
      ['Ils sont partis ensemble, au pas, vers le premier jour.',
       'They walked off together, towards the first light.'],
      ['Derrière toi, quelque chose d\'autre s\'est mis à courir.',
       'Behind you, something else started to run.'],
    ],
  },
];

/** Le chapitre de la nuit `n` (borne aux treize). */
export function chapitreDe(n: number): Chapitre {
  return CHAPITRES[Math.max(0, Math.min(CHAPITRES.length - 1, n - 1))];
}

/* ---------------------------------------------------------------------------
   APRES LA MORSURE — les nuits perdues
   ---------------------------------------------------------------------------
   Une morsure ne fait pas avancer l'histoire : le chapitre reste de l'autre
   cote de la ligne, et l'ecran le dit (`hw_ch_ferme`, avec l'accroche). Ce qui
   s'affiche, c'est un des cauchemars ci-dessous, tire sans repetition.

   PASSES AU TUTOIEMENT LE 17/10, comme le recit, et SANS NOM : ils peuvent
   tomber avant le chapitre 9, ou le nom de la bete se donne. Leurs clefs ne
   sont celles d'aucune image : les dix cartes appartiennent au recit, et un
   cauchemar qui montrerait l'image d'un chapitre le gacherait. Ils retombent
   sur la scene dessinee de la morsure.

   Regles de 09/10 inchangees : pas d'inventaire de ce qui est arrache, la
   bete MARQUE et revient.
--------------------------------------------------------------------------- */
const MORDU: [string, string] = ['APRÈS LA MORSURE', 'AFTER THE BITE'];

export const MORSURES: readonly Scene[] = [
  {
    cle: 'cauchemar-marque', sur: MORDU,
    titre: ['LA MARQUE', 'THE MARK'],
    lignes: [
      ['Elle t\'a eu au mollet. Au matin, plus rien.',
       'It got you by the calf. By morning, nothing.'],
      ['Seulement quatre petites marques, en demi-cercle.',
       'Only four small marks, in a half circle.'],
      ['Chaque soir, elles sont un peu plus chaudes.',
       'Every evening, they are a little warmer.'],
      ['Ce soir, elles battent. Comme des pas qui approchent.',
       'Tonight they throb. Like footsteps coming closer.'],
    ],
  },
  {
    cle: 'cauchemar-chiens', sur: MORDU,
    titre: ['LES CHIENS', 'THE DOGS'],
    lignes: [
      ['Depuis la morsure, la lumière te brûle les yeux.',
       'Since the bite, light burns your eyes.'],
      ['Hier, les chiens du quartier aboyaient sur ton passage.',
       'Yesterday, the neighbourhood dogs barked at you.'],
      ['Aujourd\'hui, ils se taisent.',
       'Today they fall silent.'],
      ['Et ils baissent la tête quand tu passes.',
       'And they lower their heads as you go by.'],
    ],
  },
  {
    cle: 'cauchemar-sommeil', sur: MORDU,
    titre: ['TON SOMMEIL', 'YOUR SLEEP'],
    lignes: [
      ['Elle ne t\'a pas lâché. Elle a seulement desserré.',
       'It did not let go. It only loosened its grip.'],
      ['Dès que tu fermes les yeux, tu es dans la ruelle.',
       'Whenever you close your eyes, you are in the alley.'],
      ['Et tu cours. Tu cours toute la nuit.',
       'And you run. You run all night.'],
      ['Chaque nuit, elle part un peu plus près de toi.',
       'Every night, it starts a little closer.'],
    ],
  },
  {
    cle: 'cauchemar-piste', sur: MORDU,
    titre: ['LA PISTE', 'THE TRAIL'],
    lignes: [
      ['Elle t\'a lâché au bout de la ruelle. Elle a ton odeur.',
       'It let go at the end of the alley. It had your scent.'],
      ['Tu as changé de chemin pour rentrer. Deux fois.',
       'You changed your way home. Twice.'],
      ['Hier soir, sous ta fenêtre, quelque chose a reniflé.',
       'Last night, under your window, something sniffed.'],
      ['Elle n\'a jamais perdu une piste.',
       'It has never lost a trail.'],
    ],
  },
];

/** Les clefs des cauchemars, pour le tirage. */
export const CLES_MORSURES = MORSURES.map(s => s.cle);

/** Le cauchemar de cette clef, ou le premier a defaut. */
export function morsureDe(cle: string): Scene {
  return MORSURES.find(s => s.cle === cle) || MORSURES[0];
}

/* ---------------------------------------------------------------------------
   LA SCENE DESSINEE
   ---------------------------------------------------------------------------
   Derriere le texte, une image fixe et vivante : la silhouette d'un homme qui
   court, la bete a ses trousses, la lune derriere, et les tombes d'un
   cimetiere qui defile.

   ELLE EST EN SILHOUETTE, ET C'EST UNE DECISION PLUTOT QU'UNE ECONOMIE. Les
   cinematiques du jeu se jouent DANS le stade, avec le vrai coureur et ses
   vraies couleurs ; celle-ci se joue dans le souvenir de quelqu'un. Un
   contre-jour raconte cela sans une ligne de texte, et il laisse a la carte de
   texte le seul endroit lumineux de l'image — c'est elle qu'on doit lire.
--------------------------------------------------------------------------- */

const TAU = Math.PI * 2;

/* LA SCENE FAIT PEUR, ET C'EST LA SECONDE VERSION (07/10, « les scenes ne
   font pas assez peur »). La premiere etait une gravure : une lune pale et
   ronde, deux silhouettes nettes, un cimetiere qui defile. Belle, et calme —
   rien n'y menacait le regard. Ce qui fait peur dans une image fixe tient en
   quatre choses, et elles sont ajoutees dans cet ordre :

     - CE QU'ON NE VOIT PAS EN ENTIER : des nuages passent sur la lune, une
       brume monte du sol, les bords de l'image se noient dans le noir ;
     - CE QUI REGARDE : des paires d'yeux s'allument et s'eteignent entre les
       tombes. Il n'y a pas qu'une bete ;
     - CE QUI SURGIT : un eclair, deux fois par histoire, decoupe tout en
       blanc — et c'est a ce moment-la qu'on voit vraiment la bete ;
     - CE QUI EST TROP PRES : apres une morsure, la bete n'est plus au loin
       a hurler. Sa tete occupe le premier plan, de face, les yeux sur nous.

   La lune devient rousse : c'est la couleur des yeux, et le seul rouge de la
   scene avec eux. */

/** Un tirage fixe : les memes yeux et les memes eclairs d'une image a l'autre. */
function hasard(k: number): number {
  const x = Math.sin(k * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * L'eclair a l'instant `t` : 0 la plupart du temps, 1 au plus fort. Il frappe
 * en deux coups rapproches, comme un vrai — un seul flash se lit comme une
 * erreur d'affichage. Le premier tombe a 1,6 s, quand la premiere ligne vient
 * d'apparaitre et que l'oeil s'est pose sur le texte.
 */
function eclairA(t: number): number {
  const DATES = [1.6, 6.4, 11.8, 17.5];
  let e = 0;
  for (const d of DATES) {
    const u = t - d;
    if (u < 0 || u > 0.9) continue;
    e = Math.max(e, Math.exp(-u * 9) + (u > 0.16 ? 0.8 * Math.exp(-(u - 0.16) * 6) : 0));
  }
  return Math.min(1, e);
}

let grain: HTMLCanvasElement | null = null;
/** Une trame de bruit, faite une fois : la pellicule d'une vieille bande. */
function trameDeGrain(): HTMLCanvasElement {
  if (grain) return grain;
  grain = document.createElement('canvas');
  grain.width = grain.height = 128;
  const g = grain.getContext('2d')!;
  const im = g.createImageData(128, 128);
  for (let i = 0; i < im.data.length; i += 4) {
    const v = Math.random() * 255;
    im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
    im.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return grain;
}

/* LES QUATORZE CARTES EN IMAGE (16/10, « fais de vrais decors »).

   Une image par scenette, rendue dans Unity (projets/Sprinter-Unity-Halloween,
   Assets/Editor/CarteMolosse.cs) : la ruelle, la chambre, le cimetiere, la
   salle de bain, la vitrine, montes avec les modeles Tripo et le molosse
   TRELLIS. Sources et reperes : assets-sources/molosse-cartes/. 1080 x 1920 ;
   le haut porte le sujet, le bas reste sombre pour le texte.

   L'ATTENTE et SON SOMMEIL n'ont plus d'image (16/10, « retire ces deux
   la, garde les autres ») : la bete de face, en gros plan, se lisait comme
   une figurine. LA TOMBE et LE DERNIER BUS non plus (16/10, « retire la
   tombe et le dernier bus »). Elles retombent sur la scene dessinee.

   Hors production comme le reste du mode (HORS_PRODUCTION, vite.config.ts).
   Une carte dont l'image manque — fichier absent, chargement rate — retombe
   sur la scene dessinee d'avant. */
const CARTES = import.meta.glob('/src/assets/molosse-cartes/*.webp', { query: '?url', import: 'default' }) as
  Record<string, () => Promise<string>>;

/** Les yeux de la bete dans chaque carte (fractions de l'image), mesures dans Unity. */
const YEUX_DES_CARTES: Record<string, Array<[number, number]>> = {
  odeur: [[0.3618, 0.4227], [0.3193, 0.4150]],
};

type Carte = { im: HTMLImageElement | null; demande: number; ratee: boolean };
const cartes: Record<string, Carte> = {};

/** L'image de la carte `cle`, demandee au premier appel ; null tant qu'elle n'est pas la. */
function carteDe(cle: string): Carte | null {
  const deja = cartes[cle];
  if (deja) return deja;
  const charger = CARTES[`/src/assets/molosse-cartes/${cle}.webp`];
  if (!charger) return null;
  const c: Carte = { im: null, demande: performance.now(), ratee: false };
  cartes[cle] = c;
  charger().then((url) => {
    if (!url) { c.ratee = true; return; }
    const im = new Image();
    im.onload = () => { c.im = im; };
    im.onerror = () => { c.ratee = true; };
    im.src = url;
  }).catch(() => { c.ratee = true; });
  return c;
}

/** Faire venir l'image d'une carte avant d'en avoir besoin. */
export function prechargerLaCarte(cle: string) { carteDe(cle); }

/** La carte en image, couvrant la toile : elle sort du noir, la camera s'avance a peine. */
function peindreLaCarte(ctx: CanvasRenderingContext2D, cle: string, im: HTMLImageElement,
                        L: number, H: number, t: number, eclair: number) {
  const iw = im.naturalWidth, ih = im.naturalHeight;
  const k = Math.max(L / iw, H / ih);
  const u = Math.min(1, t / 14);
  const zoom = 1 + 0.06 * (1 - Math.pow(1 - u, 2));
  const yeux = YEUX_DES_CARTES[cle];
  // la camera s'avance vers les yeux s'il y en a, vers le haut de l'image sinon
  const foyer = yeux ? [(yeux[0][0] + yeux[1][0]) / 2, (yeux[0][1] + yeux[1][1]) / 2] : [0.5, 0.35];
  const w0 = iw * k, h0 = ih * k;
  // en portrait plus etroit que 9:16, on rogne les cotes ; plus large, on garde le haut
  const bx = (L - w0) * 0.5, by = Math.min(0, (H - h0) * 0.25);
  const fx = bx + foyer[0] * w0, fy = by + foyer[1] * h0;
  const w = w0 * zoom, h = h0 * zoom;
  const x0 = fx - foyer[0] * w, y0 = fy - foyer[1] * h;
  const entre = Math.min(1, t / 1.2);
  ctx.save();
  ctx.fillStyle = 'rgb(3,2,5)';
  ctx.fillRect(-L, -H, 3 * L, 3 * H);
  ctx.globalAlpha = entre;
  ctx.drawImage(im, x0, y0, w, h);
  if (eclair > 0.02) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.25 * eclair;
    ctx.drawImage(im, x0, y0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }
  // LES YEUX BATTENT et clignent : c'est eux qui font vivre l'image fixe
  if (yeux) {
    const pulse = 0.75 + 0.25 * Math.sin(t * 5.5);
    const cligne = ((t % 4.3) < 0.12) ? 0.1 : 1;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = entre * cligne;
    for (const [ux, uy] of yeux) {
      const ox = x0 + ux * w, oy = y0 + uy * h, r = w * 0.028 * pulse;
      const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
      g.addColorStop(0, 'rgba(255,70,35,0.75)');
      g.addColorStop(1, 'rgba(255,20,10,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(ox, oy, r, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

/**
 * Peindre la scene, a l'instant `t` (en secondes depuis son debut).
 *
 * `mordu` decide de ce qu'on regarde : la bete court derriere l'homme, ou
 * l'homme est a terre et la bete est sur nous. Le reste est la meme nuit.
 *
 * `cle` : la scenette tiree. Si sa carte en image est la, elle remplace le
 * decor dessine ; la brume, le noir des bords et le grain passent par-dessus.
 * Pendant son chargement (une seconde et demie au plus), on ne peint que du
 * noir, plutot que la scene dessinee qui sauterait ensuite.
 */
export function peindreLaScene(
  ctx: CanvasRenderingContext2D, L: number, H: number, t: number, mordu: boolean, cle?: string,
) {
  const carte = cle ? carteDe(cle) : null;
  if (carte && !carte.im && !carte.ratee && performance.now() - carte.demande < 1500) {
    ctx.fillStyle = 'rgb(3,2,5)';
    ctx.fillRect(0, 0, L, H);
    return;
  }
  const image = carte && carte.im ? carte.im : null;
  // La ligne de sol remonte en portrait : la carte de texte se pose en bas,
  // sur toute la largeur, et les silhouettes doivent rester au-dessus d'elle.
  const portrait = H > L * 1.1;
  const sol = H * (portrait ? 0.54 : 0.78);
  const m = Math.min(L / 12, H / (portrait ? 11 : 7));
  const eclair = eclairA(t);

  // LA SECOUSSE : l'eclair, et les appuis de la bete quand elle court.
  ctx.save();
  const tremble = eclair * m * 0.10 + (mordu ? 0 : Math.max(0, Math.sin(t * 3.4 * TAU)) * m * 0.02);
  ctx.translate((hasard(Math.floor(t * 30)) - 0.5) * tremble, (hasard(Math.floor(t * 30) + 7) - 0.5) * tremble);

  // LE CIEL : un noir qui tire au sang vers l'horizon.
  const ciel = ctx.createLinearGradient(0, 0, 0, sol);
  ciel.addColorStop(0, 'rgb(5,3,9)');
  ciel.addColorStop(0.7, 'rgb(26,8,18)');
  ciel.addColorStop(1, 'rgb(58,14,20)');
  ctx.fillStyle = ciel;
  ctx.fillRect(-m, -m, L + 2 * m, sol + m);

  // LA LUNE ROUSSE, a gauche (la seule zone libre des deux orientations, voir
  // FinDeLaNuit), et les silhouettes se decoupent dessus.
  const lx = L * 0.24, ly = sol - H * 0.36, lr = Math.min(L, H) * 0.19;
  const respire = 1 + Math.sin(t * 0.9) * 0.04;
  const halo = ctx.createRadialGradient(lx, ly, lr * 0.6, lx, ly, lr * 3.4 * respire);
  halo.addColorStop(0, 'rgba(220,60,36,0.34)');
  halo.addColorStop(1, 'rgba(220,60,36,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(lx, ly, lr * 3.4 * respire, 0, TAU); ctx.fill();
  const disque = ctx.createRadialGradient(lx - lr * 0.3, ly - lr * 0.3, lr * 0.1, lx, ly, lr);
  disque.addColorStop(0, 'rgb(236,120,74)');
  disque.addColorStop(1, 'rgb(170,44,30)');
  ctx.fillStyle = disque;
  ctx.beginPath(); ctx.arc(lx, ly, lr, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(110,22,18,0.45)';
  for (const [dx, dy, r] of [[-0.34, -0.22, 0.20], [0.26, 0.10, 0.26], [-0.08, 0.40, 0.14]]) {
    ctx.beginPath(); ctx.arc(lx + dx * lr, ly + dy * lr, r * lr, 0, TAU); ctx.fill();
  }

  // LES NUAGES, qui passent devant la lune et la mangent par moments. Des
  // bords flous : en aplats nets, ils faisaient des barres noires posees sur
  // l'image, pas un ciel.
  for (let k = 0; k < 4; k++) {
    const v = 0.035 + 0.02 * k;
    const cx = ((hasard(k) * 1.6 + t * v) % 1.6 - 0.3) * L;
    const cy = ly + (hasard(k + 9) - 0.5) * lr * 2.2;
    const R = lr * (1.5 + hasard(k + 3));
    for (const [dx, a] of [[-0.35, 0.55], [0, 0.75], [0.4, 0.5]]) {
      ctx.save();
      ctx.translate(cx + dx * R, cy);
      ctx.scale(1, 0.14 + 0.08 * hasard(k + 5));
      const n = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.8);
      n.addColorStop(0, `rgba(8,3,8,${a})`);
      n.addColorStop(1, 'rgba(8,3,8,0)');
      ctx.fillStyle = n;
      ctx.beginPath(); ctx.arc(0, 0, R * 0.8, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  // L'ECLAIR. Le ciel blanchit, et une fourche descend sur l'horizon : tout
  // ce qui est devant devient une decoupe noire nette.
  if (eclair > 0.02) {
    ctx.fillStyle = `rgba(214,206,236,${0.85 * eclair})`;
    ctx.fillRect(-m, -m, L + 2 * m, sol + m);
    const graine = Math.floor((t + 0.9) / 5);
    ctx.strokeStyle = `rgba(255,255,255,${eclair})`;
    ctx.lineWidth = Math.max(1.5, m * 0.05);
    ctx.beginPath();
    let x = L * (0.55 + 0.35 * hasard(graine)), y = 0;
    ctx.moveTo(x, y);
    for (let k = 1; k <= 7; k++) {
      x += (hasard(graine * 13 + k) - 0.5) * m * 1.6;
      y = sol * 0.85 * k / 7;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // LE SOL, presque noir, qui s'enfonce dans la nuit.
  const terre = ctx.createLinearGradient(0, sol, 0, H);
  terre.addColorStop(0, 'rgb(12,10,12)');
  terre.addColorStop(1, 'rgb(3,3,4)');
  ctx.fillStyle = terre;
  ctx.fillRect(-m, sol, L + 2 * m, H - sol + m);
  ctx.fillStyle = 'rgba(160,60,40,0.22)';
  ctx.fillRect(0, sol, L, 2);

  // LES TOMBES, LES CYPRES ET UN ARBRE MORT, en contre-jour, qui defilent.
  const glisse = (t * 26) % (L + 400);
  ctx.fillStyle = 'rgb(7,6,9)';
  ctx.strokeStyle = 'rgb(7,6,9)';
  for (let k = 0; k < 9; k++) {
    const x = ((k * 190 - glisse) % (L + 400) + L + 400) % (L + 400) - 200;
    if (k % 3 === 2) {
      ctx.beginPath();
      ctx.moveTo(x, sol);
      ctx.quadraticCurveTo(x - m * 0.30, sol - m * 1.5, x, sol - m * 2.6);
      ctx.quadraticCurveTo(x + m * 0.30, sol - m * 1.5, x, sol);
      ctx.fill();
    } else if (k === 4) {
      arbreMort(ctx, x, sol, m);
    } else {
      const l = m * 0.42, h = m * (0.62 + (k % 4) * 0.12);
      const pente = ((k * 37) % 11 - 5) * 0.03;
      ctx.save();
      ctx.translate(x, sol); ctx.rotate(pente);
      ctx.beginPath();
      ctx.moveTo(-l, 0); ctx.lineTo(-l, -h + l);
      ctx.arc(0, -h + l, l, Math.PI, 0);
      ctx.lineTo(l, 0);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  // LES YEUX DANS LE NOIR. Cinq paires, chacune a son rythme : elles
  // s'allument, restent, clignent, s'eteignent. Jamais deux en meme temps au
  // meme endroit, et jamais sur la lune — elles sont dans la terre sombre.
  for (let k = 0; k < 5; k++) {
    const periode = 3.2 + hasard(k + 20) * 3;
    const u = ((t + hasard(k + 30) * periode) % periode) / periode;
    if (u > 0.45) continue;
    const allume = Math.min(1, u / 0.08) * Math.min(1, (0.45 - u) / 0.08);
    const cligne = Math.abs(((u * periode) % 1.3) - 0.6) < 0.05 ? 0.1 : 1;
    const ex = L * (0.42 + 0.55 * hasard(k + 40 + Math.floor((t + hasard(k + 30) * periode) / periode)));
    const ey = sol + (H - sol) * (portrait ? 0.06 : 0.12) * hasard(k + 50) - m * 0.15;
    const r = m * (0.035 + 0.02 * hasard(k + 60));
    ctx.fillStyle = `rgba(255,${50 + 40 * hasard(k)},30,${0.9 * allume * cligne})`;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(ex + s * r * 2.2, ey, r, r * 0.6, 0, 0, TAU); ctx.fill();
    }
  }

  // LA NUIT TENUE EST UNE IMAGE (09/10) quand elle est chargee : elle couvre
  // tout ce qui precede (ciel, lune, tombes) ; la brume, l'eclair, le noir des
  // bords et le grain passent par-dessus comme sur le reste. Voir
  // imageDeVictoire.
  const fond = image || mordu ? null : victoire;
  if (image && cle) peindreLaCarte(ctx, cle, image, L, H, t, eclair);
  else if (fond) peindreLaVictoire(ctx, fond, L, H, t, eclair);

  // LA BRUME, qui monte du sol par nappes et noie les pieds de tout le monde.
  for (let k = 0; k < 5; k++) {
    const v = 8 + 10 * hasard(k + 70);
    const bx = ((hasard(k + 80) * (L + 600) + t * v) % (L + 600)) - 300;
    const by = sol + m * (0.1 - 0.35 * hasard(k + 90));
    const br = m * (2.4 + 1.5 * hasard(k + 100));
    const nappe = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    nappe.addColorStop(0, `rgba(150,120,140,${(image ? 0.06 : 0.16) + 0.10 * eclair})`);   // la carte a deja sa brume
    nappe.addColorStop(1, 'rgba(150,120,140,0)');
    ctx.fillStyle = nappe;
    ctx.beginPath(); ctx.ellipse(bx, by, br, br * 0.35, 0, 0, TAU); ctx.fill();
  }

  // LES SILHOUETTES.
  const cycle = (t * 3.4) % 1;
  ctx.fillStyle = 'rgb(4,3,6)';
  ctx.strokeStyle = 'rgb(4,3,6)';
  // RIEN DE DESSINE AU TRAIT N'Y RESTE (09/10, « les cartes restent droles ») :
  // le chien en silhouette et l'homme couche a terre se lisaient comme des
  // figurines de dessin anime. Il ne reste que la bete en image, et un homme
  // minuscule en contre-jour quand il s'en sort.
  if (image) {
    // la carte porte deja sa scene
  } else if (mordu) {
    // La bete sur nous, et rien d'autre.
    teteDeFace(ctx, L, H, sol, m, t, eclair, portrait);
  } else if (!fond) {
    // Il court vers la lune, petit et loin. La bete ne le poursuit plus : elle
    // le REGARDE partir, du noir du premier plan. Elle sait ou il habite.
    silhouetteCoureur(ctx, L * 0.26, sol, m * 0.7, cycle);
    teteQuiGuette(ctx, L, H, sol, t, eclair, portrait);
  }

  // LE NOIR QUI SE REFERME SUR LES BORDS, plus fort quand l'eclair retombe.
  const vignette = ctx.createRadialGradient(L * 0.45, sol * 0.8, Math.min(L, H) * 0.25,
                                            L * 0.45, sol * 0.8, Math.max(L, H) * 0.85);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, `rgba(0,0,0,${0.82 - 0.4 * eclair})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(-m, -m, L + 2 * m, H + 2 * m);

  // LE GRAIN, d'une vieille bande : il bouge a chaque image.
  const motif = ctx.createPattern(trameDeGrain(), 'repeat');
  if (motif) {
    ctx.globalAlpha = 0.07;
    ctx.translate(hasard(Math.floor(t * 24)) * 128, hasard(Math.floor(t * 24) + 3) * 128);
    ctx.fillStyle = motif;
    ctx.fillRect(-256, -256, L + 512, H + 512);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** Un arbre mort : un tronc tordu et des branches nues, comme des doigts. */
function arbreMort(ctx: CanvasRenderingContext2D, x: number, sol: number, m: number) {
  ctx.lineCap = 'round';
  const branche = (x0: number, y0: number, a: number, l: number, w: number, n: number) => {
    const x1 = x0 + Math.cos(a) * l, y1 = y0 - Math.sin(a) * l;
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    if (n > 0) {
      branche(x1, y1, a + 0.5 + hasard(n + x0) * 0.3, l * 0.68, w * 0.62, n - 1);
      branche(x1, y1, a - 0.45 - hasard(n + y0) * 0.3, l * 0.62, w * 0.6, n - 1);
    }
  };
  branche(x, sol, Math.PI / 2 + 0.12, m * 1.3, m * 0.24, 4);
}

/* LA TETE EST UNE IMAGE, PLUS UN DESSIN (09/10, « les cartes ne sont pas
   effrayantes mais droles »). Le trace au canvas — oreilles en triangles,
   crocs en dents de scie, yeux en fentes — se lisait comme un chat de dessin
   anime, quoi qu'on fasse du sourcil. La tete vient maintenant de FLUX
   (assets-sources/molosse-tete/, graine 1313) : un molosse de face qui sort du
   noir, les yeux en braise. Le fond de l'image est noir, et ses bords sont
   fondus une fois pour toutes (`teteFondue`) : posee sur le ciel rouge, elle
   n'a pas de cadre.

   Le fichier ne part pas en production (HORS_PRODUCTION, vite.config.ts). Tant
   qu'il n'est pas charge — ou s'il ne l'est jamais —, seuls deux yeux brulent
   dans le noir (`yeuxSeuls`) : l'ancien trace de la tete, qui faisait rire,
   ne revient jamais. */
let teteImage: HTMLImageElement | null = null;
let teteFondueCache: HTMLCanvasElement | null = null;
import('@/assets/molosse-tete.webp?url').then(m => {
  const url = m.default as string;
  if (!url) return;
  const im = new Image();
  im.onload = () => { teteImage = im; };
  im.src = url;
}).catch(() => { /* la doublure reste */ });

/** L'image de la tete, les bords fondus au noir transparent. */
function teteFondue(): HTMLCanvasElement | null {
  if (teteFondueCache || !teteImage) return teteFondueCache;
  const c = document.createElement('canvas');
  const W = c.width = c.height = teteImage.naturalWidth || 1024;
  const g = c.getContext('2d')!;
  g.drawImage(teteImage, 0, 0, W, W);
  g.globalCompositeOperation = 'destination-in';
  const masque = g.createRadialGradient(W * 0.5, W * 0.47, W * 0.20, W * 0.5, W * 0.47, W * 0.47);
  masque.addColorStop(0, 'rgba(0,0,0,1)');
  masque.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = masque;
  g.fillRect(0, 0, W, W);
  teteFondueCache = c;
  return c;
}

/* LA CARTE DE VICTOIRE (09/10, « les cartes restent droles »). Le chien en
   silhouette qui poursuivait le coureur se lisait comme un dessin anime. La
   scene vient de Tripo Studio (outil Image, Nano Banana, 9:16 ;
   assets-sources/molosse-victoire/) : un cimetiere dans le brouillard sous
   la lune rouge, l'homme minuscule qui s'enfuit sur l'allee, et la bete au
   premier plan qui le laisse partir — elle sait ou il habite. Le bas de
   l'image est noir : c'est la que se pose la carte de texte.

   Invite : « Vertical horror film still. Night, an old overgrown cemetery in
   heavy fog under a huge blood-red full moon in the upper left of the sky.
   Far away in the middle distance, a tiny lone athlete in running clothes
   sprints away along a path toward the moon, seen only as a dark silhouette.
   In the foreground on the right, crouched low between crooked gravestones,
   an enormous black mastiff hellhound watches him, mostly lost in shadow,
   only its two glowing ember-red eyes and its bared wet fangs catching the
   light. [...] No text, no letters, no logo. »

   Hors production comme la tete (HORS_PRODUCTION). Tant qu'elle n'est pas
   chargee, la scene dessinee (la tete qui guette) tient sa place. */
let victoire: HTMLImageElement | null = null;
import('@/assets/molosse-victoire.webp?url').then(m => {
  const url = m.default as string;
  if (!url) return;
  const im = new Image();
  im.onload = () => { victoire = im; };
  im.src = url;
}).catch(() => { /* la tete qui guette reste */ });

/** Les yeux de la bete dans l'image de victoire, mesures sur l'image (fractions). */
const YEUX_VICTOIRE = [[0.6354, 0.4825], [0.7043, 0.4811]];
/** Sa gueule (d'ou sort le souffle) et les deux filets de bave, au meme compte. */
const GUEULE_VICTOIRE = [0.671, 0.540];
const BAVE_VICTOIRE = [[0.655, 0.572], [0.686, 0.574]];
/** Le point vers lequel la camera s'avance : la bete. */
const FOYER_VICTOIRE = [0.67, 0.50];

/** L'image de victoire, en couverture (rognee sur les cotes en portrait). */
function peindreLaVictoire(ctx: CanvasRenderingContext2D, im: HTMLImageElement,
                          L: number, H: number, t: number, eclair: number) {
  const iw = im.naturalWidth, ih = im.naturalHeight;
  const k = Math.max(L / iw, H / ih);
  // LE TRAVELLING AVANT : la camera s'approche de la bete, lentement, sur
  // quatorze secondes — dix pour cent, assez pour qu'on le sente sans le voir.
  const u = Math.min(1, t / 14);
  const zoom = 1 + 0.10 * (1 - Math.pow(1 - u, 2));
  const w0 = iw * k, h0 = ih * k;
  const bx = (L - w0) * 0.5, by = (H - h0) * 0.42;
  const fx = bx + FOYER_VICTOIRE[0] * w0, fy = by + FOYER_VICTOIRE[1] * h0;
  const w = w0 * zoom, h = h0 * zoom;
  const x0 = fx - FOYER_VICTOIRE[0] * w, y0 = fy - FOYER_VICTOIRE[1] * h;
  // elle sort du noir pendant la premiere seconde
  const entre = Math.min(1, t / 1.0);
  ctx.save();
  ctx.fillStyle = 'rgb(3,2,5)';
  ctx.fillRect(-L, -H, 3 * L, 3 * H);
  ctx.globalAlpha = entre;
  // TOUT BOUGE (09/10, « anime tout ») : la photo est decoupee une fois en
  // morceaux (decorDeVictoire) — les arbres se balancent, la bete respire,
  // le coureur peint est efface et remplace par un coureur qui court
  // vraiment, des nuages passent sur la lune, des chauves-souris traversent.
  const D = decorDeVictoire(im);
  const P = (u: number, v: number): [number, number] => [x0 + u * w, y0 + v * h];
  ctx.drawImage(D.fond, x0, y0, w, h);
  // les arbres, au vent : un cisaillement ancre au pied, chacun a son rythme
  D.arbres.forEach((a, i) => {
    const kx = 0.018 * Math.sin(t * (0.7 + 0.23 * i) + i * 1.7) + 0.006 * Math.sin(t * 2.3 + i);
    poserMorceau(ctx, a, P, w, h, 1, 1, kx);
  });
  // la lune : son halo respire, et des nuages la mangent par moments
  lune(ctx, P, w, h, t);
  // des chauves-souris, haut dans le ciel
  chauvesSouris(ctx, P, w, t);
  // le coureur, qui s'eloigne vers la lune et rapetisse
  coureurQuiFuit(ctx, D.coureur, P, w, h, t);
  // la brume, en nappes qui derivent entre les tombes
  brumeDeVictoire(ctx, P, w, h, t);
  // LA BETE RESPIRE : son poitrail se souleve, une fois toutes les deux
  // secondes et demie. Ancree au sol sous ses pattes.
  const souffle = Math.sin(t * 2.5);
  poserMorceau(ctx, D.bete, P, w, h, 1 + 0.006 * souffle, 1 + 0.016 * souffle, 0);
  ctx.globalCompositeOperation = 'lighter';
  if (eclair > 0.02) {
    ctx.globalAlpha = 0.35 * eclair;
    ctx.drawImage(D.fond, x0, y0, w, h);
  }
  // LES YEUX BATTENT, et clignent lentement : l'image est une photo, ce sont
  // eux qui la font vivre.
  const pulse = 0.75 + 0.25 * Math.sin(t * 5.5);
  const cligne = ((t % 4.3) < 0.12) ? 0.1 : 1;
  ctx.globalAlpha = entre * cligne;
  for (const [u, v] of YEUX_VICTOIRE) {
    const ox = x0 + u * w, oy = y0 + v * h, r = w * 0.03 * pulse;
    const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
    g.addColorStop(0, 'rgba(255,80,40,0.8)');
    g.addColorStop(1, 'rgba(255,20,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(ox, oy, r, 0, TAU); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = entre;
  // SON SOUFFLE, en buee devant la gueule : une bouffee toutes les 1,7 s,
  // qui gonfle, monte un peu et se dissout dans le froid.
  const gx = x0 + GUEULE_VICTOIRE[0] * w, gy = y0 + GUEULE_VICTOIRE[1] * h;
  for (let i = 0; i < 2; i++) {
    const a = ((t + i * 0.85) % 1.7) / 1.7;
    const r = w * (0.03 + 0.09 * a);
    const cy = gy - a * w * 0.03;
    const b = ctx.createRadialGradient(gx, cy, 0, gx, cy, r);
    b.addColorStop(0, `rgba(200,210,225,${0.34 * (1 - a)})`);
    b.addColorStop(1, 'rgba(200,210,225,0)');
    ctx.fillStyle = b;
    ctx.beginPath(); ctx.ellipse(gx, cy, r * 1.3, r, 0, 0, TAU); ctx.fill();
  }
  // LA BAVE, qui s'etire puis tombe des crocs, chaque filet a son rythme.
  BAVE_VICTOIRE.forEach(([u0, v0], i) => {
    const a = ((t * 0.7 + i * 0.45) % 1);
    const bx2 = x0 + u0 * w, by2 = y0 + v0 * h;
    // le filet s'etire sous le croc, puis une goutte s'en detache et tombe
    const long = h * (0.003 + 0.010 * Math.min(1, a / 0.62));
    const chute = a > 0.62 ? (a - 0.62) / 0.38 : 0;
    ctx.fillStyle = 'rgba(190,198,210,0.30)';
    ctx.beginPath();
    ctx.ellipse(bx2, by2 + long * 0.5, w * 0.0018, long * 0.5, 0, 0, TAU);
    ctx.fill();
    if (chute > 0) {
      ctx.fillStyle = `rgba(190,198,210,${0.35 * (1 - chute)})`;
      ctx.beginPath();
      ctx.ellipse(bx2, by2 + long + chute * h * 0.05, w * 0.0022, w * 0.0035, 0, 0, TAU);
      ctx.fill();
    }
  });
  ctx.restore();
}

/* LA SCENE DE VICTOIRE EN MORCEAUX, decoupee une fois.

   Les reperes sont mesures sur l'image (Blender, pixels sombres et rouges) :
   le coureur peint tient dans x 0,357..0,403, y 0,428..0,499 ; la lune est
   centree en 0,312 / 0,170, rayon 0,103 de la largeur. */
type Morceau = { c: HTMLCanvasElement; x: number; y: number; w: number; h: number;
                 ax: number; ay: number };
let decorVictoire: { fond: HTMLCanvasElement; bete: Morceau; arbres: Morceau[]; coureur: Morceau } | null = null;

/** Un morceau de `src`, bords fondus, avec son point d'ancrage (fractions). */
function morceau(src: HTMLCanvasElement, u0: number, v0: number, u1: number, v1: number,
                 ax: number, ay: number): Morceau {
  const W = src.width, Hs = src.height;
  const x = u0 * W, y = v0 * Hs, cw = Math.ceil((u1 - u0) * W), ch = Math.ceil((v1 - v0) * Hs);
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const g = c.getContext('2d')!;
  g.drawImage(src, x, y, cw, ch, 0, 0, cw, ch);
  g.globalCompositeOperation = 'destination-in';
  g.save();
  g.translate(cw / 2, ch / 2);
  g.scale(cw / 2, ch / 2);
  const gr = g.createRadialGradient(0, 0, 0.55, 0, 0, 1);
  gr.addColorStop(0, 'rgba(0,0,0,1)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(-1, -1, 2, 2);
  g.restore();
  return { c, x: u0, y: v0, w: u1 - u0, h: v1 - v0, ax, ay };
}

function decorDeVictoire(im: HTMLImageElement) {
  if (decorVictoire) return decorVictoire;
  const fond = document.createElement('canvas');
  fond.width = im.naturalWidth; fond.height = im.naturalHeight;
  const g = fond.getContext('2d')!;
  g.drawImage(im, 0, 0);
  // LE COUREUR PEINT EST DECOUPE, puis efface sous un morceau de brume pris
  // juste a sa droite (un tampon de clonage) : c'est lui, deplace, qui court.
  // Un coureur redessine au trait se lisait comme un pictogramme de panneau.
  const coureur = morceau(fond, 0.345, 0.415, 0.415, 0.512, 0.380, 0.499);
  const W = fond.width, Hf = fond.height;
  const tampon = morceau(fond, 0.415, 0.415, 0.495, 0.515, 0, 0);
  g.drawImage(tampon.c, 0.338 * W, 0.415 * Hf, tampon.c.width, tampon.c.height);
  g.drawImage(tampon.c, 0.338 * W, 0.415 * Hf, tampon.c.width, tampon.c.height);
  decorVictoire = {
    fond,
    // la bete, ancree au sol sous ses pattes
    bete: morceau(fond, 0.47, 0.37, 0.99, 0.72, 0.73, 0.70),
    // les arbres de droite (cypres, arbre mort) et ceux de gauche
    arbres: [morceau(fond, 0.70, 0.10, 1.0, 0.47, 0.86, 0.47),
             morceau(fond, 0.0, 0.34, 0.18, 0.57, 0.08, 0.57)],
    coureur,
  };
  return decorVictoire;
}

/** Poser un morceau, mis a l'echelle et cisaille autour de son ancre. */
function poserMorceau(ctx: CanvasRenderingContext2D, m: Morceau,
                      P: (u: number, v: number) => [number, number], w: number, h: number,
                      sx: number, sy: number, kx: number) {
  const [ax, ay] = P(m.ax, m.ay);
  ctx.save();
  ctx.translate(ax, ay);
  ctx.transform(sx, 0, kx, sy, 0, 0);
  ctx.drawImage(m.c, (m.x - m.ax) * w, (m.y - m.ay) * h, m.w * w, m.h * h);
  ctx.restore();
}

/** La lune rousse de l'image : un halo qui respire, des nuages qui passent. */
function lune(ctx: CanvasRenderingContext2D, P: (u: number, v: number) => [number, number],
              w: number, h: number, t: number) {
  const [cx, cy] = P(0.312, 0.170), r = 0.103 * w;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const a = 0.10 + 0.06 * Math.sin(t * 0.9);
  const halo = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 2.6);
  halo.addColorStop(0, `rgba(210,40,25,${a})`);
  halo.addColorStop(1, 'rgba(210,40,25,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(cx, cy, r * 2.6, 0, TAU); ctx.fill();
  ctx.restore();
  for (let k = 0; k < 3; k++) {
    const v = 0.018 + 0.008 * k;
    const x = ((hasard(k + 200) * 1.6 + t * v) % 1.6 - 0.3);
    const [nx, ny] = P(x, 0.170 + (hasard(k + 210) - 0.5) * 0.06);
    const R = w * (0.16 + 0.06 * hasard(k + 220));
    ctx.save();
    ctx.translate(nx, ny);
    ctx.scale(1, 0.22);
    const n = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    n.addColorStop(0, 'rgba(18,22,26,0.42)');
    n.addColorStop(1, 'rgba(18,22,26,0)');
    ctx.fillStyle = n;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    ctx.restore();
  }
  void h;
}

/** Trois chauves-souris qui traversent le ciel, ailes battantes. */
function chauvesSouris(ctx: CanvasRenderingContext2D, P: (u: number, v: number) => [number, number],
                       w: number, t: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,12,0.85)';
  for (let k = 0; k < 3; k++) {
    const periode = 9 + 4 * hasard(k + 300);
    const u = ((t + hasard(k + 310) * periode) % periode) / periode;
    const sens = k % 2 ? -1 : 1;
    const x = sens > 0 ? -0.1 + 1.2 * u : 1.1 - 1.2 * u;
    const y = 0.08 + 0.2 * hasard(k + 320) + 0.02 * Math.sin(u * 14 + k);
    const [bx, by] = P(x, y);
    const e = w * (0.016 + 0.006 * hasard(k + 330));
    const bat = Math.sin(t * (13 + k * 2) + k);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx - e * 0.5, by - e * 0.5 * bat, bx - e, by - e * 0.6 * bat);
    ctx.quadraticCurveTo(bx - e * 0.55, by + e * 0.1, bx, by + e * 0.18);
    ctx.quadraticCurveTo(bx + e * 0.55, by + e * 0.1, bx + e, by - e * 0.6 * bat);
    ctx.quadraticCurveTo(bx + e * 0.5, by - e * 0.5 * bat, bx, by);
    ctx.fill();
    ctx.beginPath(); ctx.ellipse(bx, by + e * 0.05, e * 0.12, e * 0.2, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/**
 * LE COUREUR QUI FUIT : celui de la photo, decoupe, qui remonte l'allee vers
 * la lune. Il rapetisse en s'eloignant, rebondit a chaque foulee (trois par
 * seconde) et la brume le mange peu a peu.
 */
function coureurQuiFuit(ctx: CanvasRenderingContext2D, m: Morceau,
                        P: (u: number, v: number) => [number, number], w: number, h: number, t: number) {
  const u = Math.min(1, t / 16);
  const e = 1 - 0.42 * u;
  const foulee = Math.abs(Math.sin(t * 3.1 * Math.PI));
  const [px, py] = P(m.ax + 0.012 * u, m.ay - 0.040 * u);
  ctx.save();
  ctx.globalAlpha *= 1 - 0.5 * u;
  ctx.translate(px + Math.sin(t * 3.1 * Math.PI) * w * 0.0015, py - foulee * h * 0.004 * e);
  ctx.scale(e, e * (1 - 0.03 * foulee));
  ctx.drawImage(m.c, (m.x - m.ax) * w, (m.y - m.ay) * h, m.w * w, m.h * h);
  ctx.restore();
}

/** La brume de la scene de victoire, en nappes qui derivent entre les tombes. */
function brumeDeVictoire(ctx: CanvasRenderingContext2D, P: (u: number, v: number) => [number, number],
                         w: number, h: number, t: number) {
  ctx.save();
  for (let k = 0; k < 5; k++) {
    const v = 0.012 + 0.01 * hasard(k + 400);
    const x = ((hasard(k + 410) * 1.6 + t * v * (k % 2 ? 1 : -1)) % 1.6 + 1.6) % 1.6 - 0.3;
    const [bx, by] = P(x, 0.46 + 0.14 * hasard(k + 420));
    const R = w * (0.35 + 0.2 * hasard(k + 430));
    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(1, 0.18);
    const n = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    n.addColorStop(0, 'rgba(150,165,172,0.16)');
    n.addColorStop(1, 'rgba(150,165,172,0)');
    ctx.fillStyle = n;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  void h;
}

/** Ou sont les yeux et le croc gauche dans l'image (fractions de son cote). */
const OEIL_G = [0.293, 0.230], OEIL_D = [0.6875, 0.215], CROC = [0.375, 0.80];
/** La gueule ouverte de la tete, d'ou sort le souffle (fractions). */
const GUEULE_TETE = [0.52, 0.86];

/**
 * LA TETE DE LA BETE, DE FACE, AU PREMIER PLAN — l'image de la morsure.
 *
 * Elle monte du bas pendant la premiere seconde, puis respire ; les yeux
 * battent, la bave tombe, et l'eclair la blanchit d'un coup.
 */
function teteDeFace(ctx: CanvasRenderingContext2D, L: number, H: number, sol: number,
                    m: number, t: number, eclair: number, portrait: boolean) {
  const img = teteFondue();
  if (!img) {
    const D = Math.min(L, H) * (portrait ? 0.92 : 0.83);
    yeuxSeuls(ctx, L * (portrait ? 0.62 : 0.40) - D / 2, sol - D * 0.6, D, t);
    return;
  }
  const monte = 1 - Math.pow(1 - Math.min(1, t / 1.2), 3);
  const s = Math.min(L, H) * (portrait ? 0.42 : 0.36) * (1 + Math.sin(t * 1.7) * 0.015);
  // ELLE S'APPROCHE ENCORE (09/10, « anime tout ») : huit pour cent sur douze
  // secondes, pendant qu'on lit.
  const approche = 1 + 0.08 * (1 - Math.pow(1 - Math.min(1, t / 12), 2));
  const D = s * (portrait ? 2.2 : 2.3) * approche;
  const cx = L * (portrait ? 0.62 : 0.40);
  // la gueule au-dessus de la carte de texte, qui couvre le bas de l'image
  const cy = sol - s * (portrait ? 0.22 : 0.10) + (1 - monte) * s * 1.4;
  const x0 = cx - D / 2, y0 = cy - D / 2;
  ctx.save();
  ctx.globalAlpha = monte;
  ctx.drawImage(img, x0, y0, D, D);
  ctx.globalCompositeOperation = 'lighter';
  if (eclair > 0.02) {
    ctx.globalAlpha = 0.45 * eclair;
    ctx.drawImage(img, x0, y0, D, D);
  }
  // LES YEUX BATTENT, comme un pouls : l'image seule est une photo, ce sont
  // eux qui la font vivre.
  const pulse = 0.75 + 0.25 * Math.sin(t * 6.5);
  ctx.globalAlpha = monte;
  for (const [u, v] of [OEIL_G, OEIL_D]) {
    const ox = x0 + u * D, oy = y0 + v * D, r = D * 0.06 * pulse;
    const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
    g.addColorStop(0, 'rgba(255,90,30,0.75)');
    g.addColorStop(1, 'rgba(255,30,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(ox, oy, r, 0, TAU); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  // SON SOUFFLE, en buee, chaud contre le froid : une bouffee toutes les
  // 1,6 s, qui sort de la gueule ouverte et vient vers nous.
  const [bu, bv] = GUEULE_TETE;
  for (let i = 0; i < 2; i++) {
    const a = ((t + i * 0.8) % 1.6) / 1.6;
    const gx = x0 + bu * D, gy = y0 + bv * D + a * D * 0.04;
    const r = D * (0.12 + 0.18 * a);
    const b = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
    b.addColorStop(0, `rgba(200,205,220,${0.13 * (1 - a) * monte})`);
    b.addColorStop(1, 'rgba(200,205,220,0)');
    ctx.fillStyle = b;
    ctx.beginPath(); ctx.ellipse(gx, gy, r * 1.4, r, 0, 0, TAU); ctx.fill();
  }
  // la bave, qui tombe d'un croc
  ctx.fillStyle = 'rgba(210,205,215,0.6)';
  const goutte = (t * 0.8) % 1;
  ctx.beginPath();
  ctx.ellipse(x0 + CROC[0] * D, y0 + CROC[1] * D + goutte * D * 0.18, D * 0.005, D * 0.014, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Un coureur en contre-jour, jambes et bras en pleine foulee. */
function silhouetteCoureur(ctx: CanvasRenderingContext2D, x: number, sol: number,
                           m: number, cycle: number) {
  const a = cycle * TAU;
  const h = m * 1.75;
  const bassin = sol - h * 0.52;
  const epaule = sol - h * 0.86;
  const bond = Math.abs(Math.sin(a)) * m * 0.10;
  const y0 = sol - bond;

  ctx.lineCap = 'round';
  // jambes
  for (const s of [1, -1]) {
    const p = a + (s > 0 ? 0 : Math.PI);
    const genou = [x + Math.sin(p) * m * 0.34, bassin - bond + m * 0.42];
    const pied = [x + Math.sin(p) * m * 0.62, y0 - Math.max(0, Math.sin(p)) * m * 0.30];
    ctx.lineWidth = m * 0.15;
    ctx.beginPath();
    ctx.moveTo(x, bassin - bond); ctx.lineTo(genou[0], genou[1]); ctx.lineTo(pied[0], pied[1]);
    ctx.stroke();
  }
  // bras
  for (const s of [1, -1]) {
    const p = a + (s > 0 ? Math.PI : 0);
    ctx.lineWidth = m * 0.11;
    ctx.beginPath();
    ctx.moveTo(x, epaule - bond);
    ctx.lineTo(x + Math.sin(p) * m * 0.30, epaule - bond + m * 0.28);
    ctx.lineTo(x + Math.sin(p) * m * 0.52, epaule - bond + Math.cos(p) * m * 0.10);
    ctx.stroke();
  }
  // tronc et tete
  ctx.lineWidth = m * 0.26;
  ctx.beginPath();
  ctx.moveTo(x, bassin - bond); ctx.lineTo(x + m * 0.06, epaule - bond); ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + m * 0.10, epaule - bond - m * 0.20, m * 0.17, 0, TAU); ctx.fill();
}

/**
 * Deux yeux en braise dans le noir. `x0, y0, D` : le cadre de l'image de la
 * tete (les yeux tombent ou ils sont sur elle), qu'elle soit dessinee ou non.
 */
function yeuxSeuls(ctx: CanvasRenderingContext2D, x0: number, y0: number, D: number, t: number) {
  // un clignement lent, toutes les quatre secondes
  const cligne = ((t % 4.1) < 0.12) ? 0.08 : 1;
  const pulse = 0.8 + 0.2 * Math.sin(t * 6.5);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const [u, v] of [OEIL_G, OEIL_D]) {
    const ox = x0 + u * D, oy = y0 + v * D;
    const r = D * 0.045 * pulse;
    const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
    g.addColorStop(0, `rgba(255,120,50,${0.95 * cligne})`);
    g.addColorStop(0.25, `rgba(230,40,20,${0.6 * cligne})`);
    g.addColorStop(1, 'rgba(200,20,10,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(ox, oy, r, r * 0.55 * cligne + 0.5, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

let teteEteinteCache: HTMLCanvasElement | null = null;
/** La tete fondue, assombrie aux trois quarts : on devine la masse, pas le detail. */
function teteEteinte(img: HTMLCanvasElement): HTMLCanvasElement {
  if (teteEteinteCache) return teteEteinteCache;
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d')!;
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(2,1,4,0.72)';
  g.fillRect(0, 0, c.width, c.height);
  teteEteinteCache = c;
  return c;
}

/**
 * LA BETE QUI GUETTE — l'image de la nuit tenue.
 *
 * La meme tete que la morsure, mais presque eteinte : posee tres sombre au
 * premier plan, a droite, coupee par le bas de l'image. On n'en devine que
 * l'arrondi du crane et la truffe ; ce qui se voit, ce sont les yeux, qui
 * suivent l'homme minuscule qui s'enfuit vers la lune.
 */
function teteQuiGuette(ctx: CanvasRenderingContext2D, L: number, H: number, sol: number,
                       t: number, eclair: number, portrait: boolean) {
  const D = Math.min(L, H) * (portrait ? 1.05 : 0.95);
  const cx = L * (portrait ? 0.74 : 0.70);
  // elle se leve lentement du noir pendant les deux premieres secondes
  const leve = 1 - Math.pow(1 - Math.min(1, t / 2.2), 3);
  const cy = sol + D * 0.10 + (1 - leve) * D * 0.25;
  const img = teteFondue();
  const x0 = cx - D / 2, y0 = cy - D / 2;
  if (!img) { yeuxSeuls(ctx, x0, y0, D, t); return; }
  // OPAQUE, MAIS ETEINTE. Posee en transparence, elle laissait voir les
  // tombes a travers elle : un fantome, pas une bete. On la pose pleine et
  // assombrie (`teteEteinte`) ; l'eclair la revele en entier.
  ctx.save();
  ctx.globalAlpha = leve;
  ctx.drawImage(teteEteinte(img), x0, y0, D, D);
  if (eclair > 0.02) {
    ctx.globalAlpha = 0.7 * eclair * leve;
    ctx.drawImage(img, x0, y0, D, D);
  }
  ctx.restore();
  // les yeux, eux, brulent fort — et ils clignent, lentement
  yeuxSeuls(ctx, x0, y0, D, t);
}
