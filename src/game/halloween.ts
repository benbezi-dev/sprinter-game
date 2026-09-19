// LA NUIT DU MOLOSSE — la regle, et rien que la regle.
//
// Treize nuits au cimetiere municipal. Un chien demoniaque part derriere toi,
// le chrono descend au lieu de monter, et il faut passer la ligne avant qu'il
// n'arrive a zero.
//
// UNE SEULE REGLE, DEUX FACONS DE LA VOIR, ET C'EST TOUT L'INTERET.
//
// « Passer la ligne dans le temps imparti » et « ne pas se faire rattraper par
// le chien » ne sont pas deux conditions : c'est la meme, ecrite deux fois. Le
// molosse est cale pour franchir la ligne d'arrivee EXACTEMENT au temps
// imparti — ni avant, ni apres. S'il te double, c'est que tu n'y seras pas
// dans les temps ; si tu passes avant lui, c'est que tu y es. Le chrono dit ce
// que la bete fait, la bete montre ce que le chrono compte.
//
// Deux conditions distinctes auraient donne un mode qu'on perd sans comprendre
// laquelle des deux a lache. Celle-ci se lit sans une ligne d'explication : le
// chien arrive, ou il n'arrive pas.
//
// LE MOLOSSE COURT LA COURSE D'UN ADVERSAIRE DU MOTEUR.
//
// Sa position ne suit pas une vitesse constante — un chien qui partirait a
// plein regime aurait rattrape le joueur avant sa troisieme foulee, puisque
// celui-ci part de l'arret. Il suit la LOI DES COUREURS DE L'ORDINATEUR
// (stepAI dans sprinter-core.js) : une montee en vitesse exponentielle calee
// pour couvrir sa distance dans le temps vise. Il accelere donc comme un etre
// qui court, il prend son retard au depart comme tout le monde, et il revient.
//
// La formule est recopiee ici plutot qu'empruntee au moteur, et c'est
// delibere : `stepAI` vit sur un Runner — un corps, huit couloirs, une piste,
// un chrono d'arrivee, un classement. Le molosse n'est rien de tout cela. Lui
// donner un Runner l'aurait fait entrer dans les resultats, dans les
// classements et dans le photo-finish, ou il n'a rien a faire. Six lignes de
// formule coutent moins cher qu'un coureur fantome a exclure partout.
//
// CE FICHIER NE DESSINE RIEN ET NE FAIT AUCUN BRUIT. Le molosse a l'ecran vit
// dans halloween-molosse.js, ses grognements dans halloween-son.ts, et ce
// qu'on raconte apres la course dans halloween-cinema.ts. La regle reste ici,
// seule, pour qu'un harnais puisse la verifier sans lancer une course.

import { SprinterApp } from './engine';
import { HALLOWEEN_OUVERT } from './canal';

/** Une nuit : ce qu'elle laisse comme temps, et d'ou part la bete. */
export type Nuit = {
  /** Son rang, de 1 a 13. */
  n: number;
  /** Le temps imparti, en secondes. C'est lui qui fait toute la difficulte. */
  imparti: number;
  /**
   * Le retard du molosse sur la ligne de depart, en metres.
   *
   * IL NE CHANGE PRESQUE RIEN A LA DIFFICULTE, ET BEAUCOUP A CE QU'ON VOIT.
   * Quel que soit ce retard, la bete franchit la ligne au temps imparti : elle
   * part de plus loin et court d'autant plus vite. Ce qu'il regle, c'est la
   * DISTANCE A LAQUELLE ELLE SE TIENT pendant la course — quatorze metres, on
   * l'entend derriere soi ; cinq metres, on la voit dans le coin de l'ecran
   * pendant dix secondes. C'est le levier de mise en scene des dernieres
   * nuits.
   */
  retard: number;
  /** Le nom de la nuit, en francais et en anglais. */
  nom: [string, string];
};

/**
 * LES TREIZE NUITS.
 *
 * Treize, parce que c'est le nombre de la fete, et parce que treize paliers
 * suffisent a aller de « tout le monde y arrive » a « presque personne ».
 *
 * L'ECHELLE EST CELLE DU JEU, PAS CELLE DU REEL. Mesure sur cette physique, le
 * 100 m se court en 10,25 s a huit appuis par seconde, 9,22 s a dix, 8,87 s a
 * treize et 8,61 s a dix-sept (voir RACES['100'] dans sprinter-core.js). Les
 * treize nuits sont posees sur cette regle-la :
 *
 *   - la premiere laisse 13,00 s, soit trois secondes de marge a un joueur qui
 *     tape mollement. On y perd si l'on ne comprend pas qu'il faut courir, et
 *     c'est tout ce qu'elle demande ;
 *   - la septieme, 10,40 s, tombe juste au-dessus des huit appuis par seconde :
 *     c'est la que le mode commence a se jouer ;
 *   - la treizieme, 8,80 s, se prend entre treize et dix-sept appuis par
 *     seconde. Au-dessus de ce que le championnat demande a sa finale
 *     mondiale, sous ce que les ZEZE exigent. Elle doit rester atteignable —
 *     une derniere nuit imprenable ne serait pas une derniere nuit, juste un
 *     mur.
 *
 * Ces nombres sont des DECISIONS, pas des mesures : on ne les recalcule pas
 * depuis une formule. Le jour ou la physique du jeu changera, c'est la liste
 * qu'il faudra rejouer au pouce, pas une constante a ajuster.
 */
export const NUITS: readonly Nuit[] = [
  { n: 1,  imparti: 13.00, retard: 14, nom: ['La ruelle', 'The alley'] },
  { n: 2,  imparti: 12.40, retard: 13, nom: ['Le portail', 'The gate'] },
  { n: 3,  imparti: 11.90, retard: 12, nom: ['Les cypres', 'The cypresses'] },
  { n: 4,  imparti: 11.45, retard: 12, nom: ['La lune rousse', 'The blood moon'] },
  { n: 5,  imparti: 11.05, retard: 11, nom: ['Le caveau', 'The vault'] },
  { n: 6,  imparti: 10.70, retard: 10, nom: ['Les corbeaux', 'The crows'] },
  { n: 7,  imparti: 10.40, retard: 10, nom: ['La terre remuee', 'Turned earth'] },
  { n: 8,  imparti: 10.15, retard: 9,  nom: ['Le glas', 'The knell'] },
  { n: 9,  imparti: 9.95,  retard: 8,  nom: ['Les cendres', 'The ashes'] },
  { n: 10, imparti: 9.78,  retard: 7,  nom: ['Le souffle', 'The breath'] },
  { n: 11, imparti: 9.62,  retard: 7,  nom: ['La gueule', 'The jaws'] },
  { n: 12, imparti: 9.48,  retard: 6,  nom: ['Minuit', 'Midnight'] },
  { n: 13, imparti: 8.80,  retard: 5,  nom: ['La nuit du molosse', "The hound's night"] },
];

/** L'index du cimetiere municipal dans la table des etapes du moteur. */
export function etapeDuCimetiere(): number {
  const LEVELS = (globalThis as any).SprinterCore.LEVELS as any[];
  const i = LEVELS.findIndex(x => x && x.cle === 'cimetiere');
  // Un index introuvable ne doit pas faire tomber le jeu : on retombe sur le
  // stade olympique, qui existe sur les deux canaux. Le cas n'est pas
  // theorique — c'est exactement ce qui arriverait si le stade sortait un jour
  // du build sans que ce module le sache.
  return i >= 0 ? i : 4;
}

/** La nuit de ce rang, ou la derniere si le rang deborde. */
export function nuitDe(n: number): Nuit {
  return NUITS[Math.max(0, Math.min(NUITS.length - 1, n - 1))];
}

/* ---------------------------------------------------------------------------
   LA COURSE DU MOLOSSE
   ---------------------------------------------------------------------------
   Une nuit armee, c'est un objet et un crochet pose sur le moteur. Rien de
   plus : c'est la boucle de course qui vient nous chercher, image apres image,
   exactement comme elle va chercher les haies.
--------------------------------------------------------------------------- */

export type Verdict = 'court' | 'passe' | 'mordu';

type Chasse = {
  nuit: Nuit;
  /** La distance que la bete doit couvrir : la course, plus son retard. */
  course: number;
  /** Les deux constantes de la loi de vitesse (voir stepAI). */
  tau: number;
  vmax: number;
  /** Ou en est la bete, en metres depuis la ligne de depart (negatif au debut). */
  d: number;
  /** Sa vitesse a cet instant, en m/s — pour le dessin et le son. */
  v: number;
  /** L'ecart entre sa gueule et le dos du joueur, en metres. */
  ecart: number;
  verdict: Verdict;
  /** Le chrono de l'arrivee, quand la ligne est passee. */
  chrono: number;
  /** L'instant de la morsure, sur le chrono de la course. */
  morsure: number;
};

/** La nuit en cours. Nulle en dehors d'une nuit. */
let chasse: Chasse | null = null;

/** Court-on une nuit du molosse en ce moment ? */
export function nuitEnCours(): boolean { return chasse !== null; }

/** La nuit qu'on court, ou null. */
export function nuitCourante(): Nuit | null { return chasse ? chasse.nuit : null; }

/**
 * Ce que le HUD, le rendu et le son ont besoin de savoir.
 *
 * Rend l'objet tel quel plutot qu'une copie : il est lu a chaque image, par
 * trois appelants, et personne n'y ecrit. Une allocation par image et par
 * lecteur pour trois nombres n'aurait servi qu'a se rassurer.
 */
export function etatDeLaChasse(): Chasse | null { return chasse; }

/**
 * Le temps qu'il reste avant que la bete ne franchisse la ligne.
 *
 * C'est le chrono a l'envers, et c'est le seul nombre du mode : on le lit en
 * haut de l'ecran a la place du chronometre ordinaire. Il descend jusqu'a zero
 * et s'y arrete — un compte a rebours qui passerait en negatif dirait au
 * joueur qu'il lui reste quelque chose a jouer, alors que tout est joue.
 */
export function resteAuChrono(): number {
  if (!chasse) return 0;
  const G = SprinterApp.G;
  const t = G && G.state === 'race' ? (G.elapsed || 0) : 0;
  return Math.max(0, chasse.nuit.imparti - t);
}

/**
 * Armer une nuit : poser la bete derriere la ligne, et le crochet sur le
 * moteur.
 *
 * Appele une fois la course construite, comme l'armement des haies : le moteur
 * a deja pose la piste et les huit couloirs, on n'ajoute que ce qui court
 * derriere.
 */
export function armerLaNuit(n: number) {
  if (!HALLOWEEN_OUVERT) return;
  const nuit = nuitDe(n);
  const G = SprinterApp.G;
  const total = G && G.track ? G.track.total : 100;

  // LA LOI DE VITESSE DES COUREURS DE L'ORDINATEUR, recopiee de stepAI.
  //
  //   d(t) = vmax x (t - tau x (1 - exp(-t / tau)))
  //
  // `tau` est le temps de montee en vitesse, borne comme dans le moteur ;
  // `vmax` s'en deduit pour que la distance soit couverte exactement au temps
  // vise. Poser ces deux nombres ici, plutot que d'appeler le moteur, est ce
  // qui permet a un harnais de verifier la course de la bete sans piste.
  const T = nuit.imparti;
  const course = total + nuit.retard;
  const tau = Math.max(0.35, Math.min(1.10, T * 0.16));
  const den = T - tau * (1 - Math.exp(-T / tau));

  chasse = {
    nuit, course, tau,
    vmax: course / Math.max(0.01, den),
    d: -nuit.retard, v: 0,
    ecart: nuit.retard,
    verdict: 'court', chrono: 0, morsure: 0,
  };

  // LE CROCHET, PLUTOT QU'UN IMPORT — la meme regle que pour les haies, et
  // pour la meme raison. Le moteur ne connait pas le molosse et ne doit pas le
  // connaitre : un import de ce module depuis engine.ts ferait repartir tout le
  // mode dans le paquet public, ou il n'aurait rien a y faire une fois le
  // drapeau ferme. La dependance va donc dans l'autre sens.
  if (G) { G.pasMolosse = pasDuMolosse; G.molosseMord = false; }
}

/**
 * Ranger la nuit. A appeler en quittant la course, sans quoi la bete suit — et
 * le prochain 100 m ordinaire se courrait avec un chien derriere.
 */
export function rangerLaNuit() {
  chasse = null;
  const G = SprinterApp.G;
  if (G) { G.pasMolosse = null; G.molosseMord = false; }
}

/**
 * Un pas de la bete, apres celui du joueur.
 *
 * LE MOLOSSE N'EST PAS INTEGRE, IL EST EVALUE. Sa position se calcule depuis
 * le chrono de la course, pas depuis sa position precedente : c'est ce que
 * fait deja stepAI, et c'est ce qui garantit qu'il franchit la ligne au temps
 * imparti a la milliseconde pres, quel que soit le nombre d'images par seconde
 * ou le temps passe en pause. Une integration pas a pas aurait derive, et la
 * derive se serait vue la ou elle coute le plus cher : sur la derniere foulee.
 */
export function pasDuMolosse(joueur: any) {
  if (!chasse || chasse.verdict !== 'court') return;
  const G = SprinterApp.G;
  const t = G.elapsed || 0;
  const c = chasse;

  const avant = c.d;
  c.d = -c.nuit.retard + c.vmax * (t - c.tau * (1 - Math.exp(-t / c.tau)));
  // La vitesse se lit sur le deplacement plutot que sur la derivee : elle sert
  // au galop et au grognement, qui n'ont que faire d'une exactitude analytique,
  // et elle vaut zero a la premiere image sans cas particulier.
  c.v = Math.max(0, (c.d - avant) * 240);
  c.ecart = joueur.d - c.d;

  // LE JOUEUR EST PASSE. On le juge sur `finished` et non sur sa distance :
  // c'est le moteur qui decide qu'une ligne est franchie, et le faire une
  // seconde fois ici les aurait fait diverger d'une image un jour ou l'autre.
  if (joueur.finished) {
    c.verdict = 'passe';
    c.chrono = joueur.finishTime != null ? joueur.finishTime : t;
    return;
  }

  // LA MORSURE. La bete a rejoint le dos du joueur avant la ligne.
  //
  // Le seuil est a zero et pas a « une longueur de chien » : `ecart` compte du
  // museau au dos, et c'est deja la bonne distance. Y ajouter une marge aurait
  // decale la morsure par rapport a ce que le chrono annonce, et casse la
  // seule chose que ce mode promet — que les deux disent la meme chose.
  if (c.ecart <= 0) {
    c.verdict = 'mordu';
    c.morsure = t;
    // Le coureur s'arrete net. On ne le fait pas tomber : le moteur reserve sa
    // chute au faux pas, et une chute ici aurait relance sa foulee au
    // relevement — le joueur aurait vu son athlete repartir apres s'etre fait
    // devorer. On le gele, et la cinematique prend la suite.
    joueur.v = 0;
    joueur.freeze = 9;
    // Et l'on previent la boucle de course, qui attend sinon une ligne que ce
    // coureur-la ne franchira plus (voir updateLogic dans engine.ts).
    G.molosseMord = true;
  }
}

/* ---------------------------------------------------------------------------
   CE QUI RESTE D'UNE NUIT A L'AUTRE
   ---------------------------------------------------------------------------
   Sur l'appareil, et nulle part ailleurs. Aucun serveur ne connait ce mode :
   il n'a ni classement ni duel, et une progression de treize cases n'a rien a
   faire dans une base.
--------------------------------------------------------------------------- */

const CLE = 'sprinter_halloween';

export type Carnet = {
  /** La derniere nuit tenue. 0 tant qu'aucune ne l'est. */
  tenues: number;
  /** Le meilleur chrono de chaque nuit tenue, par rang. */
  chronos: Record<string, number>;
  /** Combien de fois la bete a mordu, toutes nuits confondues. */
  morsures: number;
  /** Les cinematiques deja vues, pour ne pas servir deux fois la meme. */
  vues: string[];
};

const VIERGE: Carnet = { tenues: 0, chronos: {}, morsures: 0, vues: [] };

function lire(): Carnet {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return { ...VIERGE, chronos: {}, vues: [] };
    const d = JSON.parse(brut);
    return {
      tenues: Number(d.tenues) || 0,
      chronos: d.chronos && typeof d.chronos === 'object' ? d.chronos : {},
      morsures: Number(d.morsures) || 0,
      vues: Array.isArray(d.vues) ? d.vues.map(String) : [],
    };
  } catch {
    // Un carnet illisible vaut un carnet vierge : on ne perd qu'une
    // progression de treize cases, et le mode s'ouvre quand meme.
    return { ...VIERGE, chronos: {}, vues: [] };
  }
}

function ecrire(c: Carnet) {
  try { localStorage.setItem(CLE, JSON.stringify(c)); } catch { /* refuse */ }
}

/** Le carnet de la nuit, tel qu'il est range sur cet appareil. */
export function carnet(): Carnet { return lire(); }

/** La nuit qu'on peut courir : la premiere non tenue, sans depasser la derniere. */
export function nuitOuverte(): number {
  return Math.min(NUITS.length, lire().tenues + 1);
}

/** Toutes les nuits sont-elles tombees ? */
export function toutesTenues(): boolean { return lire().tenues >= NUITS.length; }

/**
 * Ranger une nuit tenue.
 *
 * Le rang ne recule jamais : rejouer la nuit 3 quand on en est a la 7 ne
 * ramene pas la progression a 3. Seul le chrono de cette nuit-la s'ameliore.
 */
export function tenirLaNuit(n: number, chrono: number) {
  const c = lire();
  c.tenues = Math.max(c.tenues, n);
  const av = c.chronos[String(n)];
  if (av == null || chrono < av) c.chronos[String(n)] = chrono;
  ecrire(c);
}

/** Ranger une morsure. */
export function compterLaMorsure() {
  const c = lire();
  c.morsures += 1;
  ecrire(c);
}

/** Le meilleur chrono pose sur cette nuit, ou null. */
export function chronoDe(n: number): number | null {
  const v = lire().chronos[String(n)];
  return typeof v === 'number' ? v : null;
}

/**
 * Tirer une cinematique qu'on n'a pas encore vue.
 *
 * `cles` sont celles du repertoire ; on rend d'abord une inedite, et quand
 * toutes ont ete vues on repart du debut en evitant seulement la derniere. Un
 * tirage purement aleatoire aurait servi deux fois la meme histoire en deux
 * courses, ce qui est la facon la plus sure de tuer une blague.
 */
export function tirerLaScene(cles: readonly string[]): string {
  if (!cles.length) return '';
  const c = lire();
  const vues = new Set(c.vues);
  const inedites = cles.filter(k => !vues.has(k));
  const pool = inedites.length ? inedites
    : cles.filter(k => k !== c.vues[c.vues.length - 1]);
  const choix = (pool.length ? pool : cles.slice())[
    Math.floor(Math.random() * (pool.length ? pool.length : cles.length))];
  // On ne garde que le fil des dernieres vues : la liste sert a ne pas se
  // repeter, pas a tenir un journal. Le choix remonte en queue meme s'il y
  // etait deja, sinon une scene revue resterait en tete de liste et serait
  // reservie la fois suivante comme la plus ancienne.
  c.vues = [...c.vues.filter(k => k !== choix), choix].slice(-24);
  ecrire(c);
  return choix;
}

/** Tout oublier de ce mode — la progression comme les scenes vues. */
export function oublierLaNuit() {
  try { localStorage.removeItem(CLE); } catch { /* refuse */ }
}
