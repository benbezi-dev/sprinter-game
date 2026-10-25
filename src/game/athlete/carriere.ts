// LA CARRIERE D'ATHLETE — la sauvegarde, et le passage a la piste.
//
// LE MODE SE POSE SUR LE ONE SHOT, comme la Legende et les defis de vedettes
// (legende/legende.ts) : une competition EST un one shot lance par
// `startOneShot` au plateau de son niveau, avec l'etiquette `athlete`. Ce qui
// la distingue tient dans `G.reglagesJoueur` — le corps de l'athlete, que
// buildLevel pose sur le coureur du joueur — et dans l'ecran de fin
// (App.tsx le reconnait a l'etiquette).
//
// CANAL DE TEST SEULEMENT : ce fichier n'est atteint que par les ecrans du
// mode, eux-memes charges a la demande derriere CARRIERE_ATHLETE_OUVERTE.

import { SprinterApp } from '../engine';
import { CARRIERE_ATHLETE_OUVERTE } from '../canal';
import {
  type Athlete, type Epreuve, COMPETITIONS, reglages, coutDuDeplacement,
  conclureLaCompetition, finirLaSemaine, noter, declarerForfait, type Resultat,
} from './regles';
import { tirerLaSemaine } from './recit';

const CLE = 'sprinter_athlete_v1';

export function charger(): Athlete | null {
  try {
    const d = JSON.parse(localStorage.getItem(CLE) || 'null');
    return d && d.v === 1 && d.stats ? d as Athlete : null;
  } catch { return null; }
}

export function sauver(a: Athlete | null) {
  try {
    if (a) localStorage.setItem(CLE, JSON.stringify(a));
    else localStorage.removeItem(CLE);
  } catch { /* stockage ferme : la carriere vit le temps de la visite */ }
}

/** Tourner la semaine, tirer son evenement, et ranger. */
export function semaineSuivante(a: Athlete, alea: () => number = Math.random) {
  finirLaSemaine(a);
  if (!a.evenement) a.evenement = tirerLaSemaine(a, alea);
  sauver(a);
}

/* --------------------------------------------------- la competition */

/** Ce qu'on garde pendant que la course tourne : `a` est l'objet des ecrans. */
let enCourse: { a: Athlete; epreuve: Epreuve; niveau: number } | null = null;
/** Rouvrir le tableau de bord de la carriere en revenant a l'accueil. */
let rouvrir = false;

export function aRouvrir(): boolean { const r = rouvrir; rouvrir = false; return r; }
export function demanderReouverture() { rouvrir = true; }

/**
 * Partir a la competition du niveau en cours : payer le deplacement, poser
 * le corps de l'athlete sur le coureur, lancer le one shot. Rend false si le
 * deplacement n'est pas payable (le tableau de bord grise deja le bouton).
 */
export function partirALaCompetition(a: Athlete, epreuve: Epreuve): boolean {
  if (!CARRIERE_ATHLETE_OUVERTE) return false;
  const cout = coutDuDeplacement(a, a.niveau);
  if (a.argent < cout || a.blessure > 0) return false;
  a.argent -= cout;
  sauver(a);
  const G = SprinterApp.G;
  enCourse = { a, epreuve, niveau: a.niveau };
  G.reglagesJoueur = reglages(a, a.niveau);
  if (!G.surRetourAccueil) G.surRetourAccueil = rangerLaCourse;
  (SprinterApp as any).startOneShot([epreuve], { levelIdx: COMPETITIONS[a.niveau].plateau, etiquette: 'athlete' });
  return true;
}

/**
 * Retirer le corps de l'athlete : rien ne doit suivre le joueur ailleurs.
 * Une course quittee avant l'ecran de fin est un forfait : le deplacement est
 * perdu et la semaine tourne — sinon on la recourait en payant deux fois.
 */
export function rangerLaCourse() {
  const G = SprinterApp.G;
  if (enCourse) { declarerForfait(enCourse.a); semaineSuivante(enCourse.a); }
  enCourse = null;
  if (!G) return;
  G.reglagesJoueur = null;
  if (G.surRetourAccueil === rangerLaCourse) G.surRetourAccueil = null;
}

// UNE SEULE FOIS PAR COURSE : l'ecran de fin conclut au montage, et React
// peut monter deux fois. La course se reconnait a son plateau (`G.runners`
// est neuf a chaque construction) — la regle de legende.ts.
let concluPour: unknown = null;
let dernier: Resultat | null = null;

/**
 * Le resultat de la competition qui vient de finir, range UNE fois : place,
 * chrono, prime, qualification, puis la semaine tourne (la competition est
 * le dimanche).
 */
export function conclureLaCourse(a: Athlete): Resultat | null {
  const G = SprinterApp.G;
  if (dernier && G && concluPour === G.runners) return dernier;
  if (!enCourse || !G) return null;
  const moi = G.player && G.player.finishTime != null ? G.player.finishTime : null;
  const ordre: any[] = G.ranking || [];
  const place = moi === null ? (G.runners || []).length : Math.max(1, ordre.indexOf(G.player) + 1);
  const r = conclureLaCompetition(a, enCourse.epreuve, place, moi);
  const nom = COMPETITIONS[r.niveau].cle;
  noter(a, `${nom} — ${r.epreuve} m : ${place}e${moi !== null ? ` en ${moi.toFixed(2)} s` : ''}`,
           `${nom} — ${r.epreuve} m: P${place}${moi !== null ? ` in ${moi.toFixed(2)} s` : ''}`);
  semaineSuivante(a);
  enCourse = null;
  concluPour = G.runners;
  dernier = r;
  return r;
}
