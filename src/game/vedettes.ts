// LES DEFIS DES VEDETTES — courir contre un athlete reel, et gagner son skin.
//
// Le premier est Aurel Manga, au 110 m haies, pour annoncer Hurdlers. Le
// suivant sera Mickael Meba-Zeze, au sprint : le module est ecrit pour qu'il
// n'y ait qu'une entree a ajouter ici, un look dans VEDETTES
// (sprinter-core.js), un stade-evenement dans STADES_HORS_SERIE et, s'il a un
// corps sculpte, ses retouches dans tools/blender/anatomie.py.
//
// CE QUI EST UN DEFI, ET CE QUI N'EN EST PAS. Un defi est un ONE SHOT : il a
// le faux depart, la pause, la trace, le RECOMMENCER du moteur. Ce qu'il ajoute
// tient en trois choses — un adversaire au chrono fixe (`cibles` du stade), un
// verdict qui ne regarde que lui, et un skin a la cle. Rien de tout cela n'a
// besoin d'un crochet dans la boucle : le stade porte l'adversaire, le moteur
// fait la course, et l'ecran de fin lit le resultat.
//
// LES ATHLETES ONT DONNE LEUR ACCORD. C'est ce qui permet a ce module, et a
// lui seul, d'ecrire de vrais noms propres dans le jeu (voir VEDETTES).

import { SprinterApp } from './engine';
import { gagnerSkin } from './vestiaire';

type Paire = [string, string];

export type Vedette = {
  cle: string;
  /** Le nom du coureur dans le moteur : VEDETTES et `names` du stade. */
  coureur: string;
  prenom: string;
  nom: string;
  /** L'epreuve du defi. */
  epreuve: string;
  /** La `cle` de son stade dans STADES_HORS_SERIE. */
  stade: string;
  /** Le skin qu'on gagne en le battant (game/vestiaire.ts). */
  skin: string;
  /** Ce qu'on dit de lui sur la fiche. Rien qui ne soit verifie. */
  palmares: Paire[];
};

export const VEDETTES: Record<string, Vedette> = {
  manga: {
    cle: 'manga', coureur: 'Aurel MANGA', prenom: 'Aurel', nom: 'MANGA',
    epreuve: '110h', stade: 'defi-manga', skin: 'manga',
    // Deux medailles, deux sources concordantes (World Athletics, resultats
    // officiels). Pas de record personnel ici : les sources ne s'accordent
    // pas, et une fiche fausse sur un athlete reel ne se corrige pas avec un
    // correctif — elle se voit.
    palmares: [
      ['Bronze mondial en salle · 60 m haies · Birmingham 2018',
       'World Indoor bronze · 60 m hurdles · Birmingham 2018'],
      ['Bronze européen en salle · 60 m haies · Glasgow 2019',
       'European Indoor bronze · 60 m hurdles · Glasgow 2019'],
      ['Équipe de France · 110 m haies', 'French national team · 110 m hurdles'],
    ],
  },
};

/** L'index du stade d'un defi dans LEVELS, ou -1 s'il n'y est pas (canal ferme). */
export function indexDuStade(v: Vedette): number {
  const niveaux = (SprinterApp as any).LEVELS as any[];
  return Array.isArray(niveaux) ? niveaux.findIndex(l => l && l.cle === v.stade) : -1;
}

/** Le defi peut-il se courir ici ? */
export function defiPossible(v: Vedette): boolean {
  return indexDuStade(v) >= 0;
}

let enCours: Vedette | null = null;

/**
 * Le defi qui se court en ce moment, s'il y en a un.
 *
 * On verifie aussi que la course affichee est bien la sienne : un defi qu'un
 * chemin de sortie aurait oublie de ranger ne doit pas coiffer la course
 * suivante de son ecran de fin.
 */
export function defiEnCours(): Vedette | null {
  const G = SprinterApp.G;
  if (!enCours || !G || G.mode !== 'oneshot') return null;
  return G.levelIdx === indexDuStade(enCours) ? enCours : null;
}

/** Lancer le defi : un one shot de son epreuve, sur son stade. */
export function lancerLeDefi(v: Vedette) {
  const idx = indexDuStade(v);
  if (idx < 0) return;
  const G = SprinterApp.G;
  enCours = v;
  // Le retour a l'accueil le range, par quelque chemin qu'il arrive — le
  // bouton de fin, l'abandon, le retour arriere du telephone. La place n'est
  // prise que si elle est libre : la nuit du molosse s'y pose aussi.
  if (!G.surRetourAccueil) G.surRetourAccueil = rangerLeDefi;
  (SprinterApp as any).startOneShot([v.epreuve], { levelIdx: idx });
}

export function rangerLeDefi() {
  enCours = null;
  const G = SprinterApp.G;
  if (G && G.surRetourAccueil === rangerLeDefi) G.surRetourAccueil = null;
}

export type Verdict = {
  battu: boolean;
  /** Le chrono du joueur, null sur faux depart ou abandon. */
  moi: number | null;
  lui: number | null;
  /** lui - moi : positif quand on l'a battu. */
  ecart: number | null;
  /** Le skin vient-il d'etre gagne sur cette course ? */
  nouveauSkin: boolean;
};

/**
 * Le verdict de la course qui vient de finir, et le skin s'il est gagne.
 *
 * Seul l'adversaire compte : on peut finir troisieme d'une finale ou les
 * autres n'ont pas couru et avoir battu Aurel Manga — c'est bien la question
 * que le defi pose.
 */
export function conclureLeDefi(v: Vedette): Verdict {
  const G = SprinterApp.G;
  const lui = (G.runners || []).find((r: any) => r.name === v.coureur);
  const moi = G.player && G.player.finishTime != null ? G.player.finishTime : null;
  const tLui = lui && lui.finishTime != null ? lui.finishTime : null;
  const battu = moi !== null && (tLui === null || moi < tLui);
  const nouveauSkin = battu ? gagnerSkin(v.skin) : false;
  if (moi !== null) retenirMeilleur(v, moi);
  return { battu, moi, lui: tLui, ecart: moi !== null && tLui !== null ? tLui - moi : null, nouveauSkin };
}

// --- le meilleur chrono de chaque defi, sur cet appareil ----------------------

const CLE_MEILLEURS = 'sprinter_defis_vedettes';

function meilleurs(): Record<string, number> {
  try {
    const m = JSON.parse(localStorage.getItem(CLE_MEILLEURS) || '{}');
    return m && typeof m === 'object' ? m : {};
  } catch { return {}; }
}

function retenirMeilleur(v: Vedette, t: number) {
  const m = meilleurs();
  if (!(m[v.cle] > 0) || t < m[v.cle]) {
    m[v.cle] = Math.round(t * 1000) / 1000;
    try { localStorage.setItem(CLE_MEILLEURS, JSON.stringify(m)); } catch { /* stockage ferme */ }
  }
}

/** Le meilleur chrono du joueur sur ce defi, ou null. */
export function meilleurDuDefi(v: Vedette): number | null {
  const t = meilleurs()[v.cle];
  return t > 0 ? t : null;
}
