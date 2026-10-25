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
  conclureLaCompetition, finirLaSemaine, noter, declarerForfait, jourCale, type Resultat,
  type RendezVousReel,
} from './regles';
import { tirerLaSemaine } from './recit';
import { MOTS } from './mots';
import { recapMondial } from '../championnats';
import { lookDe, apparenceDe } from './apparence';

const CLE = 'sprinter_athlete_v1';

export function charger(): Athlete | null {
  try {
    const d = JSON.parse(localStorage.getItem(CLE) || 'null');
    if (!d || !d.stats) return null;
    // v1 n'avait pas les departementaux : tout ce qui depasse le scolaire monte d'un cran.
    if (d.v === 1) {
      const cran = (n: number) => (n >= 1 ? n + 1 : n);
      d.niveau = cran(d.niveau);
      for (const p of d.palmares || []) p.niveau = cran(p.niveau);
      d.v = 2;
    }
    return d.v === 2 ? d as Athlete : null;
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

/* ------------------------------------------- le calendrier du direct */

// L'echelon et la zone des vrais championnats qui comptent pour la carriere :
// la France, l'Europe, le monde (worker/src/championnats.js).
const DIRECT: Record<number, [string, string]> = { 3: ['national', 'FR'], 4: ['continental', 'EU'], 5: ['mondial', 'MONDE'] };
let calendrier: { id: string; echelon: string; zone: string; debut: number }[] | null = null;

/** Relire les championnats annonces et en cours. Hors ligne : on reste aux semaines de jeu. */
export async function chargerCalendrier(): Promise<void> {
  const m = await recapMondial();
  if (m) calendrier = [...m.annoncees, ...m.encours].map(l => ({ id: l.edition, echelon: l.echelon, zone: l.zone, debut: l.debut }));
}

/** Le prochain vrai championnat du niveau `niveau`, ou null. */
export function rendezVousDe(niveau: number): RendezVousReel | null {
  const z = DIRECT[niveau];
  if (!z || !calendrier) return null;
  const l = calendrier.filter(x => x.echelon === z[0] && x.zone === z[1]).sort((x, y) => x.debut - y.debut)[0];
  return l ? { id: l.id, debut: l.debut } : null;
}

/** Le jour de competition de cet athlete, cale sur le direct quand il y a lieu. */
export const jourDeLAthlete = (a: Athlete, maintenant = Date.now()) => jourCale(a, rendezVousDe(a.niveau), maintenant);

/** Un vrai championnat ne se court qu'une fois : on le marque des qu'on part, ou qu'on renonce. */
function marquerLeRendezVous(a: Athlete) {
  const rdv = rendezVousDe(a.niveau);
  if (rdv && jourCale(a, rdv, Date.now()).date !== null) a.rendezVous = rdv.id;
}

/** Declarer forfait au jour de competition, et tourner la semaine. */
export function forfait(a: Athlete) {
  marquerLeRendezVous(a);
  declarerForfait(a);
  semaineSuivante(a);
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
  if (a.argent < cout || a.blessure > 0 || !jourDeLAthlete(a).jour) return false;
  marquerLeRendezVous(a);
  a.argent -= cout;
  sauver(a);
  const G = SprinterApp.G;
  enCourse = { a, epreuve, niveau: a.niveau };
  G.reglagesJoueur = { ...reglages(a, a.niveau), plateau: COMPETITIONS[a.niveau].chronos || null,
                       look: lookDe(apparenceDe(a), false) };
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
  const [fr, en] = MOTS[COMPETITIONS[r.niveau].cle];
  noter(a, `${fr} — ${r.epreuve} m : ${moi === null ? 'faux départ' : `${place === 1 ? '1er' : `${place}e`} en ${moi.toFixed(2)} s`}`,
           `${en} — ${r.epreuve} m: ${moi === null ? 'false start' : `P${place} in ${moi.toFixed(2)} s`}`);
  semaineSuivante(a);
  enCourse = null;
  concluPour = G.runners;
  dernier = r;
  return r;
}
