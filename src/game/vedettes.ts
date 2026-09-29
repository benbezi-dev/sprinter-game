// LES DEFIS DES VEDETTES — courir contre un athlete reel, et gagner son skin.
//
// Le premier est Aurel Manga, au 110 m haies, pour annoncer Hurdlers. Le
// second est Meba-Mickael Zeze, l'evenement special du sprint, au 100 m ET au
// 200 m. Un defi, c'est une entree ici, un look dans VEDETTES
// (sprinter-core.js), un stade-evenement dans STADES_HORS_SERIE, son corps
// sculpte dans tools/blender/anatomie.py, et ses mots (vedettes-mots.ts).
//
// UN DEFI PEUT AVOIR PLUSIEURS EPREUVES. Celui de Meba-Mickael Zeze se court
// au 100 m ou au 200 m, contre deux chronos fixes : battre l'un OU l'autre
// donne le skin, et chaque epreuve garde son meilleur temps.
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

import { SprinterApp, SprinterCore } from './engine';
import { gagnerSkin } from './vestiaire';

type Paire = [string, string];

export type Vedette = {
  cle: string;
  /** Le nom du coureur dans le moteur : VEDETTES et `names` du stade. */
  coureur: string;
  prenom: string;
  nom: string;
  /** Les epreuves du defi : une seule pour Aurel, deux pour Meba-Mickael. */
  epreuves: string[];
  /** Le jeu dont l'accueil montre sa banniere : 'haies' (Hurdlers), 'sprint', ou les deux. */
  jeux: ('haies' | 'sprint')[];
  /** La `cle` de son stade dans STADES_HORS_SERIE. */
  stade: string;
  /** Le skin qu'on gagne en le battant (game/vestiaire.ts). */
  skin: string;
  /** Ce qu'on dit de lui sur la fiche. Rien qui ne soit verifie. */
  palmares: Paire[];
  /**
   * Son portrait 3D, rendu dans Blender (tools/blender/portrait_vedette.py) :
   * en buste et en pied, dans public/. C'est la qu'on le reconnait de pres ;
   * le coureur du jeu, lui, n'a pas de visage.
   */
  portraits: { buste: string; pied: string };
  /**
   * Les couleurs de sa banniere, prises a sa tenue : `vive` pour les traits,
   * `fonce` pour le fond, `pale` pour les petites lignes.
   */
  couleurs: { vive: string; fonce: string; pale: string; halo: string };
};

export const VEDETTES: Record<string, Vedette> = {
  manga: {
    cle: 'manga', coureur: 'Aurel MANGA', prenom: 'Aurel', nom: 'MANGA',
    epreuves: ['110h'], jeux: ['haies', 'sprint'], stade: 'defi-manga', skin: 'manga',
    portraits: { buste: 'vedettes/manga-buste.webp', pied: 'vedettes/manga-pied.webp' },
    couleurs: { vive: '#8B5CF6', fonce: '#2A1650', pale: '#C4B5FD', halo: '#3B2470' },
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
  meba: {
    cle: 'meba', coureur: 'Méba-Mickaël ZÉZÉ', prenom: 'Méba-Mickaël', nom: 'ZÉZÉ',
    epreuves: ['100', '200'], jeux: ['sprint'], stade: 'defi-meba', skin: 'meba',
    portraits: { buste: 'vedettes/meba-buste.webp', pied: 'vedettes/meba-pied.webp' },
    // Le blanc et le bleu de l'equipe de France, le rouge en filet.
    couleurs: { vive: '#2F5BE0', fonce: '#0B1638', pale: '#A9C1FF', halo: '#1C3070' },
    // Chaque ligne est tenue par la FFA ou World Athletics ET une seconde
    // source (Wikipedia, resultats de la competition). Rien de ce que les
    // sources discutent : ni sa taille, ni le titre national du 100 m 2022.
    palmares: [
      ['Records : 9"99 au 100 m · 19"97 au 200 m (2022)',
       'Bests: 9.99 over 100 m · 19.97 over 200 m (2022)'],
      ['Finaliste olympique · 4 × 100 m · Paris 2024',
       'Olympic finalist · 4 × 100 m · Paris 2024'],
      ['Vice-champion d’Europe · 4 × 100 m · Amsterdam 2016 et Munich 2022',
       'European silver · 4 × 100 m · Amsterdam 2016 and Munich 2022'],
      ['Bronze · 200 m · Jeux méditerranéens 2018',
       'Bronze · 200 m · Mediterranean Games 2018'],
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
/** L'epreuve du defi en cours. */
let epreuveEnCours: string | null = null;

/** L'epreuve du defi qui se court, ou null. */
export function epreuveDuDefi(): string | null {
  return defiEnCours() ? epreuveEnCours : null;
}

/** Le chrono fixe de l'athlete sur cette epreuve (les `cibles` de son stade). */
export function chronoDeLaVedette(v: Vedette, epreuve: string): number | null {
  const lvl = ((SprinterApp as any).LEVELS as any[] || []).find(l => l && l.cle === v.stade)
    || ((SprinterCore as any).STADES_HORS_SERIE as any[] || []).find(l => l && l.cle === v.stade);
  const t = lvl && lvl.cibles && lvl.cibles[epreuve] && lvl.cibles[epreuve][v.coureur];
  return typeof t === 'number' ? t : null;
}

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

/** Lancer le defi : un one shot de l'une de ses epreuves, sur son stade. */
export function lancerLeDefi(v: Vedette, epreuve: string = v.epreuves[0]) {
  const idx = indexDuStade(v);
  if (idx < 0 || !v.epreuves.includes(epreuve)) return;
  const G = SprinterApp.G;
  enCours = v;
  epreuveEnCours = epreuve;
  // Le retour a l'accueil le range, par quelque chemin qu'il arrive — le
  // bouton de fin, l'abandon, le retour arriere du telephone. La place n'est
  // prise que si elle est libre : la nuit du molosse s'y pose aussi.
  if (!G.surRetourAccueil) G.surRetourAccueil = rangerLeDefi;
  (SprinterApp as any).startOneShot([epreuve], { levelIdx: idx });
}

/**
 * Le defi qui vient de finir a-t-il ete perdu ? Sans rien ranger : c'est la
 * question que pose le calque des confettis (FeteRecords.tsx), qui ne fete pas
 * un record personnel sous un « IL T'A BATTU ».
 */
export function defiPerdu(): boolean {
  const v = defiEnCours();
  if (!v) return false;
  const G = SprinterApp.G;
  const lui = (G.runners || []).find((r: any) => r.name === v.coureur);
  const moi = G.player && G.player.finishTime != null ? G.player.finishTime : null;
  const tLui = lui && lui.finishTime != null ? lui.finishTime : null;
  return !(moi !== null && (tLui === null || moi < tLui));
}

export function rangerLeDefi() {
  enCours = null;
  epreuveEnCours = null;
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
  if (moi !== null) retenirMeilleur(v, epreuveEnCours || v.epreuves[0], moi);
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

// La clef d'un meilleur temps : la vedette seule quand elle n'a qu'une
// epreuve — celle qu'Aurel Manga a toujours eue, que les appareils ont deja
// en memoire —, la vedette et l'epreuve sinon.
const clefDuMeilleur = (v: Vedette, epreuve: string) =>
  v.epreuves.length > 1 ? `${v.cle}:${epreuve}` : v.cle;

function retenirMeilleur(v: Vedette, epreuve: string, t: number) {
  const m = meilleurs();
  const k = clefDuMeilleur(v, epreuve);
  if (!(m[k] > 0) || t < m[k]) {
    m[k] = Math.round(t * 1000) / 1000;
    try { localStorage.setItem(CLE_MEILLEURS, JSON.stringify(m)); } catch { /* stockage ferme */ }
  }
}

/** Le meilleur chrono du joueur sur ce defi (et cette epreuve), ou null. */
export function meilleurDuDefi(v: Vedette, epreuve: string = v.epreuves[0]): number | null {
  const t = meilleurs()[clefDuMeilleur(v, epreuve)];
  return t > 0 ? t : null;
}
