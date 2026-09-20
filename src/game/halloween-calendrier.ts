// LE CALENDRIER DES TREIZE NUITS — la seule source de vérité du temps.
//
// Treize courses, une par jour, du 19 au 31 octobre 2026. La treizième n'ouvre
// qu'à 18 h le soir d'Halloween. Une course est jouable si SA DATE EST ATTEINTE
// et si LA PRÉCÉDENTE EST TENUE : deux verrous, et il faut les deux.
//
// UNE SEULE IMPLÉMENTATION, POUR LE JEU COMME POUR LES ESSAIS. Le voyageur
// temporel du mode test et le harnais automatisé tapent dans ce fichier et
// nulle part ailleurs. Deux implémentations du temps, c'est deux vérités : on
// vérifierait une logique et on en expédierait une autre.
//
// AUCUN IMPORT ICI, ET C'EST VOULU. Le harnais charge ce fichier NU — node
// enlève les types et c'est tout, sans Vite, sans résolution d'extension, sans
// `import.meta.env`. Un seul `import { EST_TEST } from './canal'` le ferait
// tomber sur ERR_MODULE_NOT_FOUND, et s'il passait la résolution il tomberait
// ensuite sur `import.meta.env` qui n'existe pas sous node. La leçon a déjà été
// payée une fois sur game/edition.ts ; elle est écrite là-bas aussi.
//
// Ce que le canal doit changer se décide donc CHEZ L'APPELANT. Ici, on ne
// répond que sur des instants.
//
// ON NE FAIT JAMAIS CONFIANCE À `Date.now()` SEUL. Trois garde-fous, détaillés
// plus bas : le temps du serveur, un cliquet qui ne redescend pas, et un mode
// hors-ligne qui n'accorde jamais un jour futur.

/** Combien de nuits dans l'édition. */
export const NB_NUITS = 13;

/**
 * Le premier jour, à minuit, heure de Paris.
 *
 * Écrit en UTC et commenté en heure de Paris, comme dans game/edition.ts et
 * pour la même raison : un test qui vérifie une frontière veut un instant
 * exact et ne peut pas dépendre du fuseau de la machine qui le lance.
 *
 * ATTENTION AU CHANGEMENT D'HEURE, QUI TOMBE AU MILIEU DE LA FENÊTRE. Paris est
 * à UTC+2 jusqu'au 25 octobre 2026, à UTC+1 après. Les jours ne sont donc PAS
 * espacés d'exactement 86 400 000 ms : on ne peut pas les calculer par
 * multiplication. `ouvertureDe` passe par un calendrier réel.
 */
export const PREMIER_JOUR_UTC = Date.UTC(2026, 9, 18, 22, 0, 0); // 19 oct., 00 h 00 à Paris

/** Le dernier jour : la nuit d'Halloween. */
export const DERNIER_JOUR_UTC = Date.UTC(2026, 9, 30, 23, 0, 0); // 31 oct., 00 h 00 à Paris (UTC+1)

/**
 * L'heure à laquelle la treizième s'ouvre, le 31 octobre.
 *
 * DIX-HUIT HEURES, HEURE LOCALE DU JOUEUR — c'est le brief, et c'est juste : la
 * nuit d'Halloween tombe le soir de chacun, pas le soir de Paris. Un joueur à
 * Montréal la joue à son heure, pas à minuit et demi.
 */
export const HEURE_FINALE = 18;

/** Le fuseau de Paris, en heures, avant et après le changement d'heure. */
const PARIS_ETE = 2;
const PARIS_HIVER = 1;
/** Dernier dimanche d'octobre 2026, à 01 h UTC : Paris repasse à UTC+1. */
const BASCULE_UTC = Date.UTC(2026, 9, 25, 1, 0, 0);

/** De combien Paris devance UTC à cet instant. */
function decalageParis(ms: number): number {
  return ms < BASCULE_UTC ? PARIS_ETE : PARIS_HIVER;
}

/**
 * L'instant où la nuit `n` s'ouvre, en UTC.
 *
 * Les douze premières s'ouvrent à minuit, heure de Paris ; la treizième à
 * 18 h — mais l'heure locale du joueur ne se connaît pas ici, où l'on ne parle
 * qu'en instants absolus. `ouverteAt` s'en charge, parce que lui reçoit le
 * décalage du joueur.
 *
 * On passe par `Date.UTC` sur un jour de calendrier réel plutôt que par une
 * multiplication : le 25 octobre ne dure pas vingt-quatre heures à Paris.
 */
export function ouvertureDe(n: number): number {
  const jour = 19 + (n - 1);           // 19 octobre pour la nuit 1
  const minuitNaif = Date.UTC(2026, 9, jour, 0, 0, 0);
  // On retire le décalage pour retomber sur minuit heure de Paris. Le décalage
  // se lit sur l'instant approché, ce qui suffit : la bascule tombe à 3 h du
  // matin, loin des minuits qu'on calcule.
  return minuitNaif - decalageParis(minuitNaif) * 3600000;
}

/**
 * La nuit `n` est-elle ouverte par la DATE, à cet instant ?
 *
 * `decalageJoueur` est le décalage du joueur par rapport à UTC, en minutes,
 * tel que `-new Date().getTimezoneOffset()` le donne. Il ne sert qu'à la
 * treizième, qui suit l'heure locale.
 *
 * ET IL EST BORNÉ, PARCE QUE C'EST UNE ENTRÉE DU JOUEUR. Changer le fuseau de
 * son appareil est à la portée de tout le monde : sans borne, un joueur se
 * déclarant à UTC+23 ouvrirait la finale la veille. On plafonne donc à
 * l'éventail réel des fuseaux habités, de UTC-12 à UTC+14.
 */
export function ouverteAt(n: number, maintenant: number, decalageJoueur = 0): boolean {
  if (n < 1 || n > NB_NUITS) return false;
  const debut = ouvertureDe(n);
  if (n < NB_NUITS) return maintenant >= debut;

  const dec = Math.max(-12 * 60, Math.min(14 * 60, decalageJoueur)) * 60000;
  // 18 h chez le joueur, le 31 octobre de SON calendrier.
  const localMinuit = ouvertureDe(NB_NUITS) + (decalageParis(debut) * 3600000) - dec;
  return maintenant >= localMinuit + HEURE_FINALE * 3600000;
}

/**
 * Combien de nuits la DATE a ouvertes, à cet instant. Zéro avant le 19 octobre.
 *
 * Ne dit rien des victoires : c'est la moitié calendaire du verrou, et
 * `nuitsJouables` recolle les deux.
 */
export function nuitsParLaDate(maintenant: number, decalageJoueur = 0): number {
  let n = 0;
  for (let i = 1; i <= NB_NUITS; i++) if (ouverteAt(i, maintenant, decalageJoueur)) n = i;
  return n;
}

/**
 * LE DOUBLE VERROU, et c'est la seule fonction que les écrans doivent appeler.
 *
 * Une nuit est jouable si SA DATE EST ATTEINTE **et** si la précédente a été
 * tenue. `tenues` est le nombre de nuits gagnées d'affilée depuis la première.
 *
 * UNE NUIT PERDUE RESTE JOUABLE, le jour même et les jours suivants : on ne
 * punit pas l'échec par une attente. C'est la nuit SUIVANTE qui attend.
 */
export function nuitsJouables(tenues: number, maintenant: number, decalageJoueur = 0): number {
  return Math.min(nuitsParLaDate(maintenant, decalageJoueur), tenues + 1);
}

/** Cette nuit précise est-elle jouable ? */
export function nuitJouable(n: number, tenues: number, maintenant: number,
                            decalageJoueur = 0): boolean {
  return n >= 1 && n <= nuitsJouables(tenues, maintenant, decalageJoueur);
}

/**
 * Ce qui manque à une nuit pour être jouable : la date, la victoire, ou rien.
 *
 * Les cartes du Calendrier en ont besoin pour ne pas mentir. Une carte qui
 * affiche un compte à rebours alors que c'est la victoire de la veille qui
 * manque envoie le joueur attendre pour rien.
 */
export type Blocage = 'ouverte' | 'date' | 'victoire' | 'inconnue';

export function blocageDe(n: number, tenues: number, maintenant: number,
                          decalageJoueur = 0): Blocage {
  if (n < 1 || n > NB_NUITS) return 'inconnue';
  if (!ouverteAt(n, maintenant, decalageJoueur)) return 'date';
  if (n > tenues + 1) return 'victoire';
  return 'ouverte';
}

/* ===========================================================================
   LE TEMPS, ET LES TROIS GARDE-FOUS
   ===========================================================================
   `Date.now()` est l'horloge de l'appareil, et l'appareil appartient au joueur.
   Avancer sa montre de treize jours ouvre toute l'édition en trente secondes.

   On empile donc trois protections, et chacune couvre ce que les autres ne
   couvrent pas :

     1. LE TEMPS DU SERVEUR fait foi. Il ne se règle pas depuis un téléphone.
     2. LE CLIQUET interdit de redescendre. Un joueur qui a vu le jour 7 ne
        reverra jamais le jour 3, même hors ligne, même après avoir reculé son
        horloge. Sans lui, le mode hors-ligne serait la porte de derrière.
     3. LE MODE HORS-LIGNE n'accorde jamais un jour FUTUR. Sans serveur, on
        rend le dernier jour validé — jamais ce que l'appareil prétend.

   Ce qu'on n'empêche pas, et qu'il faut savoir : un joueur déterminé qui
   change de fuseau gagne au plus un jour sur la finale, et le cliquet l'y
   enferme ensuite. On borne l'éventail des fuseaux (voir `ouverteAt`) ; aller
   plus loin demanderait de refuser de jouer hors ligne, ce qui punirait
   surtout les gens honnêtes dans le métro.
=========================================================================== */

/** Ce que le jeu sait du temps, et d'où il le tient. */
export type Horloge = {
  /** L'instant retenu, en millisecondes depuis l'époque. */
  ms: number;
  /** D'où il vient — pour l'afficher au testeur, et pour le journal. */
  source: 'serveur' | 'cliquet' | 'appareil';
};

/**
 * Le plus haut instant déjà atteint, tel qu'il a été rangé.
 *
 * `lire` et `ecrire` sont passés en paramètres plutôt que d'appeler
 * `localStorage` ici : ce module doit rester chargeable nu sous node, où
 * `localStorage` n'existe pas, et le harnais doit pouvoir lui donner une
 * mémoire de poche pour éprouver le cliquet.
 */
export type Memoire = {
  lire: () => string | null;
  ecrire: (v: string) => void;
};

/** Une mémoire qui ne retient rien — le repli quand le stockage est refusé. */
export const MEMOIRE_MUETTE: Memoire = { lire: () => null, ecrire: () => { /* refuse */ } };

/**
 * L'instant retenu, une fois les trois garde-fous appliqués.
 *
 * `duServeur` est l'instant que le serveur a donné, ou `null` s'il n'a pas
 * répondu. `deLAppareil` est `Date.now()`, passé en paramètre pour que le
 * harnais puisse mentir à sa guise.
 */
export function horlogeRetenue(duServeur: number | null, deLAppareil: number,
                               mem: Memoire): Horloge {
  const hautEau = Number(mem.lire() || 0) || 0;

  // 1. LE SERVEUR FAIT FOI, toujours, quand il a répondu — même s'il est en
  //    retard sur le cliquet. Une horloge serveur qui recule est un incident
  //    de serveur, pas une triche de joueur, et on ne veut pas qu'un joueur
  //    honnête reste bloqué sur une valeur fausse qu'on aurait gravée.
  if (duServeur !== null) {
    if (duServeur > hautEau) mem.ecrire(String(duServeur));
    return { ms: duServeur, source: 'serveur' };
  }

  // 2. SANS SERVEUR, LE CLIQUET est le plancher, et l'appareil ne peut que le
  //    confirmer, jamais le dépasser d'un jour.
  //
  //    On accorde tout de même à l'appareil d'avancer DANS LA JOURNÉE déjà
  //    acquise : sans cela, un joueur hors ligne verrait le temps figé et la
  //    finale ne s'ouvrirait jamais à 18 h pour lui.
  const plafond = plafondDuJour(hautEau);
  if (hautEau > 0 && deLAppareil > plafond) return { ms: plafond, source: 'cliquet' };
  if (hautEau > 0 && deLAppareil < hautEau) return { ms: hautEau, source: 'cliquet' };

  // 3. PREMIÈRE VISITE HORS LIGNE : on n'a rien à opposer à l'appareil. Il ne
  //    peut de toute façon rien ouvrir qu'il n'ait déjà, puisque rien n'est
  //    acquis — et la première réponse du serveur remettra tout d'aplomb.
  return { ms: deLAppareil, source: 'appareil' };
}

/**
 * La fin de la journée déjà acquise — le plus loin où l'appareil peut aller
 * tout seul.
 *
 * On passe par un calendrier UTC réel plutôt que par un arrondi sur
 * 86 400 000 : le 25 octobre ne dure pas vingt-quatre heures à Paris, et un
 * arrondi ferait dériver la frontière d'une heure au pire moment.
 */
function plafondDuJour(ms: number): number {
  if (!ms) return 0;
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0) - 1;
}

/* ===========================================================================
   LE JOUR SIMULÉ — une seule implémentation, pour les essais comme pour le jeu
   ===========================================================================
   Le voyageur temporel du mode test et le harnais automatisé passent par ici.
   Quand une date est posée, elle remplace l'horloge partout, sans qu'aucun
   autre fichier n'ait à savoir qu'on simule.

   C'EST UNE SUBSTITUTION, PAS UNE BRANCHE. Le reste du jeu appelle
   `maintenant()` et ne sait pas d'où vient la réponse : c'est ce qui garantit
   qu'on éprouve la logique réelle et non une doublure.
=========================================================================== */

let simule: number | null = null;
let horlogeVraie: Horloge = { ms: 0, source: 'appareil' };

/** Poser un instant simulé. `null` rend la main à l'horloge réelle. */
export function simuler(ms: number | null) { simule = ms; }

/** Simule-t-on en ce moment ? Le bandeau du mode test le demande. */
export function jourSimule(): number | null { return simule; }

/** Ranger l'horloge réelle, telle que les garde-fous l'ont retenue. */
export function poserHorloge(h: Horloge) { horlogeVraie = h; }

/** L'instant que tout le jeu doit lire. */
export function maintenant(): number {
  if (simule !== null) return simule;
  return horlogeVraie.ms || Date.now();
}

/** D'où vient l'instant courant. */
export function sourceDuTemps(): Horloge['source'] | 'simule' {
  return simule !== null ? 'simule' : horlogeVraie.source;
}

/** Le décalage du joueur par rapport à UTC, en minutes. */
export function decalageDeLAppareil(): number {
  try { return -new Date().getTimezoneOffset(); } catch { return 0; }
}
