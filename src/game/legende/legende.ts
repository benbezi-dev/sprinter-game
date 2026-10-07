// LA CARRIERE LEGENDE — le deroule : six etapes, une a la fois.
//
// LE MODE SE POSE SUR LE ONE SHOT, il ne s'en fabrique pas un autre — la
// regle de la nuit du molosse et des defis de vedettes (Halloween.tsx,
// vedettes.ts). Une etape EST un 100 m lance par `startOneShot` dans le stade
// de son lieu ; ce qui la distingue tient dans ce qu'on pose par-dessus : son
// plateau, son boss au chrono fixe, et l'ecran de fin qui decide de la suite.
// Un mode qui aurait pose sa propre boucle de course aurait perdu au passage
// le faux depart, la pause, l'enregistrement de la trace et les records.
//
// LA REGLE EST CELLE DE LA CARRIERE CLASSIQUE. On gagne une etape en passant
// la ligne en tete (G.won, finishRace) ; une etape perdue, et la Legende
// recommence a la plage (OverScreen : « on recourt ? » relance la carriere
// entiere). Recommencer, c'est une nouvelle carriere : le de des lieux roule
// de nouveau.
//
// CE FICHIER NE DESSINE RIEN. Les ecrans vivent dans Legende.tsx, la carte
// entre deux etapes dans carte.ts.

import { SprinterApp } from '../engine';
import { LEGENDE_OUVERTE } from '../canal';
import { ETAPES, type Lieu } from './etapes';
import { tirer, lieuDe, type Tirage } from './tirage';
import { inscrireLesStades, indexDuLieu, DIFFICULTE } from './stades';
import { poserEtape } from './etat';
import { entreeDe } from './entrees';
import { lointainDe, premierPlanDe, preparerLeLointain } from './decors';
import { legendeAccessible } from './compte';

type Parcours = {
  tirage: Tirage;
  /** L'etape en cours, de 0 a 5. */
  rang: number;
  /** Le chrono gagnant de chaque etape deja passee. */
  chronos: number[];
};

let parcours: Parcours | null = null;

/* --------------------------------------------------- ce qui se garde */

const CLE = 'sprinter_legende_v1';

type Memoire = {
  /** La plus loin qu'une Legende soit allee : 0 a 6 (6 = accomplie). */
  plusLoin: number;
  /** Combien de Legendes accomplies. */
  accomplies: number;
  /** Le meilleur chrono gagnant, lieu par lieu. */
  meilleurs: Record<string, number>;
};

export function memoire(): Memoire {
  try {
    const d = JSON.parse(localStorage.getItem(CLE) || '{}') || {};
    const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
    const meilleurs: Record<string, number> = {};
    if (d.meilleurs && typeof d.meilleurs === 'object') {
      for (const k of Object.keys(d.meilleurs)) { const t = n(d.meilleurs[k]); if (t) meilleurs[k] = t; }
    }
    return { plusLoin: Math.min(6, Math.floor(n(d.plusLoin))), accomplies: Math.floor(n(d.accomplies)), meilleurs };
  } catch {
    return { plusLoin: 0, accomplies: 0, meilleurs: {} };
  }
}

function retenir(m: Memoire) {
  try { localStorage.setItem(CLE, JSON.stringify(m)); } catch { /* stockage ferme : la course reste */ }
}

/* ------------------------------------------- l'ouverture, et son forcage */

/** La Legende est-elle ouverte a ce joueur : meritee, ou forcee pour l'essai. */
export function legendeDebloquee(): boolean {
  return LEGENDE_OUVERTE && legendeAccessible();
}

/* --------------------------------------------------- le parcours */

/** Le lieu de l'etape `rang` dans la Legende en cours (ou le premier tirage venu). */
export function lieuDeLEtape(rang: number): Lieu {
  return lieuDe(parcours ? parcours.tirage : tirer(() => 0), rang);
}

export function rangEnCours(): number { return parcours ? parcours.rang : 0; }
export function parcoursEnCours(): Readonly<Parcours> | null { return parcours; }

/**
 * Une Legende neuve : le de roule pour le national et le mondial, et l'on
 * part de la plage. `depuis` : commencer plus loin — reserve au canal de test,
 * pour essayer une etape sans courir celles d'avant.
 */
export function commencerLaLegende(depuis = 0, alea: () => number = Math.random) {
  if (!LEGENDE_OUVERTE) return;
  parcours = { tirage: tirer(alea), rang: Math.max(0, Math.min(ETAPES.length - 1, depuis)), chronos: [] };
}

/**
 * Lancer l'etape en cours : un 100 m dans le stade de son lieu.
 * Rend false si le stade est introuvable (le moteur n'est pas la).
 */
export function lancerLEtape(): boolean {
  if (!LEGENDE_OUVERTE || !parcours) return false;
  inscrireLesStades();
  const lieu = lieuDeLEtape(parcours.rang);
  const idx = indexDuLieu(lieu);
  if (idx < 0) return false;
  const G = SprinterApp.G;
  // Le retour a l'accueil remballe la Legende, par quelque chemin qu'il
  // arrive — le bouton de fin, l'abandon, le retour arriere du telephone.
  // La place n'est prise que si elle est libre (la nuit du molosse et les
  // defis de vedettes s'y posent aussi).
  if (!G.surRetourAccueil) G.surRetourAccueil = rangerLaLegende;
  if (!G.sonDArrivee) G.sonDArrivee = sonDeLArrivee;
  // Le monument du lieu, au loin (decors.ts) : demande avant le pistolet,
  // le decompte attend les images en vol.
  preparerLeLointain(lieu.cle);
  monument = lointainDe(lieu.cle);
  G.lointainEvenement = monument;
  premierPlan = premierPlanDe(lieu.cle);
  G.premierPlanEvenement = premierPlan;
  (SprinterApp as any).startOneShot(['100'], { levelIdx: idx, etiquette: 'legende' });
  // LE BOSS ARRIVE AVANT SES BLOCS, A SA MANIERE (game/legende/entrees.ts) :
  // la camera va le chercher (entrerEnBoss, engine.ts), il fait son entree et
  // dit sa replique, puis le decompte part. APRES `startOneShot`, qui vient de
  // construire la course et de remettre `avantDepart` a zero.
  G.avantDepart = { reste: 99, t: 0, dit: true, entree: entreeDe(lieu) };
  // Hors du cadre des la mise en place : on ne doit pas le voir deja a son bloc.
  const lui = (G.runners || []).find((r: any) => r.name === lieu.boss);
  if (lui) lui.d = -40;
  poserEtape(idx);
  return true;
}

/** La course qui vient de finir est-elle une etape de la Legende ? */
export function etapeEnCours(): boolean {
  const G = SprinterApp.G;
  if (!parcours || !G || G.mode !== 'oneshot') return false;
  return G.levelIdx === indexDuLieu(lieuDeLEtape(parcours.rang));
}

export type Verdict = {
  gagne: boolean;
  /** Le chrono du joueur, null sur faux depart ou abandon. */
  moi: number | null;
  /** Sa place a l'arrivee (1 = premier). */
  place: number;
  boss: string;
  tBoss: number | null;
  rang: number;
  lieu: Lieu;
  /** La Legende vient-elle d'etre accomplie (sixieme etape gagnee) ? */
  accomplie: boolean;
};

function lireLArrivee(): Omit<Verdict, 'accomplie'> {
  const G = SprinterApp.G;
  const rang = parcours ? parcours.rang : 0;
  const lieu = lieuDeLEtape(rang);
  const moi = G.player && G.player.finishTime != null ? G.player.finishTime : null;
  const lui = (G.runners || []).find((r: any) => r.name === lieu.boss);
  const ordre: any[] = G.ranking || [];
  const place = Math.max(1, ordre.indexOf(G.player) + 1);
  return { gagne: !!G.won && moi !== null, moi, place, boss: lieu.boss,
           tBoss: lui && lui.finishTime != null ? lui.finishTime : null, rang, lieu };
}

// UNE SEULE FOIS PAR COURSE. L'ecran de fin conclut au montage, et React
// peut monter deux fois (mode strict, retour a l'ecran) : la seconde lecture
// rend le meme verdict sans rien compter de plus. La course se reconnait a
// son plateau — `G.runners` est un tableau neuf a chaque construction.
let concluPour: unknown = null;
let dernierVerdict: Verdict | null = null;

/**
 * Le verdict de l'etape qui vient de finir, range UNE fois (l'ecran de fin
 * l'appelle au montage) : la plus loin, les meilleurs chronos.
 */
export function conclureLEtape(): Verdict {
  const G = SprinterApp.G;
  if (dernierVerdict && G && concluPour === G.runners) return dernierVerdict;
  const v = lireLArrivee();
  const m = memoire();
  let accomplie = false;
  if (v.gagne && v.moi !== null && parcours) {
    parcours.chronos[v.rang] = v.moi;
    const prec = m.meilleurs[v.lieu.cle];
    if (!prec || v.moi < prec) m.meilleurs[v.lieu.cle] = v.moi;
    m.plusLoin = Math.max(m.plusLoin, v.rang + 1);
    if (v.rang === ETAPES.length - 1) { accomplie = true; m.accomplies += 1; }
  }
  retenir(m);
  concluPour = G ? G.runners : null;
  dernierVerdict = { ...v, accomplie };
  return dernierVerdict;
}

/** Passer a l'etape suivante apres une victoire. Rend false s'il n'y en a plus. */
export function etapeSuivante(): boolean {
  if (!parcours || parcours.rang >= ETAPES.length - 1) return false;
  parcours.rang += 1;
  return true;
}

/** Le son de l'arrivee : la fanfare en tete, la phrase de defaite sinon. */
function sonDeLArrivee(): string | null {
  if (!etapeEnCours()) return null;
  return lireLArrivee().gagne ? 'fanfare' : 'dirge';
}

/** Ranger la Legende : rien ne doit suivre le joueur dans un 100 m ordinaire. */
/** Le dessin du monument pose dans le moteur pour l'etape en cours. */
let monument: ReturnType<typeof lointainDe> = null;
let premierPlan: ReturnType<typeof premierPlanDe> = null;

export function rangerLaLegende() {
  parcours = null;
  poserEtape(null);
  const G = SprinterApp.G;
  if (!G) return;
  if (G.surRetourAccueil === rangerLaLegende) G.surRetourAccueil = null;
  if (G.sonDArrivee === sonDeLArrivee) G.sonDArrivee = null;
  if (monument && G.lointainEvenement === monument) G.lointainEvenement = null;
  if (premierPlan && G.premierPlanEvenement === premierPlan) G.premierPlanEvenement = null;
  monument = null;
  premierPlan = null;
}

/** Le chrono que le boss de l'etape court, pour l'annoncer avant la course. */
export function chronoDuBoss(rang: number): number {
  return DIFFICULTE[Math.max(0, Math.min(DIFFICULTE.length - 1, rang))].boss;
}
