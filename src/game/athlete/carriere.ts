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
  type Athlete, type Epreuve, COMPETITIONS, NATIONAL, reglages, coutDuDeplacement,
  conclureLaCompetition, finirLaSemaine, noter, declarerForfait, jourCale, type Resultat,
  faireUneAction, avancer, heureDe, DIMANCHE, payer, tirerLeCorps, BLESSURES,
  type RendezVousReel, type Tour, apresLeTour, HEURE_DU_TOUR,
} from './regles';
import { tirerLaSemaine } from './recit';
import { MOTS } from './mots';
import { recapMondial } from '../championnats';
import { lookDe, apparenceDe } from './apparence';
import { laSemainePasse } from './gens';
import { messagesDuReveil, messagesDeCourse, envoyer } from './telephone';
import { certificatRequis } from './sante';

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
    // les sauvegardes d'avant la journee : on se reveille un lundi matin
    if (d.jour === undefined) { d.jour = 0; d.heure = 7 * 60; }
    return d.v === 2 ? d as Athlete : null;
  } catch { return null; }
}

export function sauver(a: Athlete | null) {
  try {
    if (a) localStorage.setItem(CLE, JSON.stringify(a));
    else localStorage.removeItem(CLE);
  } catch { /* stockage ferme : la carriere vit le temps de la visite */ }
}

/**
 * Faire une action de la journee (regles.ts, ACTIONS). Si elle a tourne la
 * semaine (dormir le dimanche soir), la vie du club tire son evenement.
 */
export function agir(a: Athlete, id: string): null | string {
  const s = a.semaine;
  const r = faireUneAction(a, id);
  if (!r && a.semaine !== s) {
    laSemainePasse(a);
    if (!a.evenement) a.evenement = tirerLaSemaine(a, Math.random);
  }
  // au reveil, le telephone vibre : le coach, Ines, la famille (telephone.ts)
  if (!r && id === 'dormir') messagesDuReveil(a);
  sauver(a);
  return r;
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
export function jourDeLAthlete(a: Athlete, maintenant = Date.now()) {
  const c = jourCale(a, rendezVousDe(a.niveau), maintenant);
  // la journee existe : on ne court que le dimanche (sauf un vrai championnat, a sa date)
  if (c.date === null && a.jour !== undefined) return { jour: c.jour && a.jour === DIMANCHE, date: null, cetteSemaine: c.jour };
  return { ...c, cetteSemaine: c.jour };
}

/** Un vrai championnat ne se court qu'une fois : on le marque des qu'on part, ou qu'on renonce. */
function marquerLeRendezVous(a: Athlete) {
  const rdv = rendezVousDe(a.niveau);
  if (rdv && jourCale(a, rdv, Date.now()).date !== null) a.rendezVous = rdv.id;
}

/** Declarer forfait au jour de competition, et tourner la semaine. */
export function forfait(a: Athlete) {
  marquerLeRendezVous(a);
  declarerForfait(a);
  // sans journee (anciennes sauvegardes), la semaine tourne ici ; sinon au coucher du dimanche
  if (a.jour === undefined) semaineSuivante(a); else sauver(a);
}

/* --------------------------------------------------- la competition */

/** Ce qu'on garde pendant que la course tourne : `a` est l'objet des ecrans. */
/** `tour` : une course unique, ou serie, demie, finale a partir des France ; `vent` en m/s (null au 400 m). */
let enCourse: { a: Athlete; epreuve: Epreuve; niveau: number; vent: number | null; tour: 'unique' | Tour } | null = null;
/** Rouvrir le tableau de bord de la carriere en revenant a l'accueil. */
let rouvrir = false;

export function aRouvrir(): boolean { const r = rouvrir; rouvrir = false; return r; }
export function demanderReouverture() { rouvrir = true; }

/**
 * Partir a la competition du niveau en cours : payer le deplacement, poser
 * le corps de l'athlete sur le coureur, lancer le one shot. Rend false si le
 * deplacement n'est pas payable (le tableau de bord grise deja le bouton).
 */
export function partirALaCompetition(a: Athlete, epreuve: Epreuve, tour?: 'demie' | 'finale'): boolean {
  if (!CARRIERE_ATHLETE_OUVERTE) return false;
  if (a.blessure > 0) return false;
  if (!tour) {
    const cout = coutDuDeplacement(a, a.niveau);
    if (a.argent < cout || !jourDeLAthlete(a).jour || certificatRequis(a)) return false;
    marquerLeRendezVous(a);
    payer(a, -cout, 'Déplacement', 'Travel');
  }
  sauver(a);
  const G = SprinterApp.G;
  // le vent du jour (100 et 200 m) : il ne change pas la course — le plafond d'un dixieme
  // vaut aussi pour lui —, il decide seulement si un record est homologue (+2,0 m/s au plus)
  const vent = epreuve === '400' ? null : Math.round((-1.5 + Math.random() * 4.5) * 10) / 10;
  enCourse = { a, epreuve, niveau: a.niveau, vent, tour: tour || (a.niveau >= NATIONAL ? 'serie' : 'unique') };
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
  if (enCourse) { declarerForfait(enCourse.a); if (enCourse.a.jour === undefined) semaineSuivante(enCourse.a); else sauver(enCourse.a); }
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
  // SERIE ET DEMI-FINALE (a partir des France) : les quatre premiers passent au tour
  // suivant, l'apres-midi puis le soir ; les autres sont elimines (apresLeTour)
  const t = enCourse.tour, suite = t === 'unique' || moi === null ? null : apresLeTour(t, place);
  if (t !== 'unique' && suite && suite.suivant) {
    const vent = enCourse.vent, homologue = vent === null || vent <= 2.0, rec = a.records ||= {};
    const record = homologue && (rec[enCourse.epreuve] === undefined || moi! < rec[enCourse.epreuve]!);
    if (record) rec[enCourse.epreuve] = Math.round(moi! * 100) / 100;
    const corps = tirerLeCorps(a, 'course');
    const blesse = !!corps.blessure;
    const r: Resultat = { niveau: a.niveau, epreuve: enCourse.epreuve, place, chrono: moi, qualifie: false, prime: 0, reputation: 0, sommet: false,
      record, vent, homologue, tour: t, suivant: blesse ? undefined : suite.suivant, auTemps: suite.auTemps, blessure: corps.blessure };
    const [nfr, nen] = t === 'serie' ? ['Série', 'Heat'] : ['Demi-finale', 'Semi-final'];
    const [vfr, ven] = suite.suivant === 'demie' ? ['la demi-finale', 'the semi-final'] : ['la finale', 'the final'];
    noter(a, `${nfr} : ${place === 1 ? '1er' : `${place}e`} en ${moi!.toFixed(2)} s — qualifié${suite.auTemps ? ' au temps' : ''} pour ${vfr}.`,
             `${nen}: P${place} in ${moi!.toFixed(2)} s — through to ${ven}${suite.auTemps ? ' on time' : ''}.`);
    // le tour suivant a son heure, celle du dimanche du direct
    avancer(a, Math.max(30, HEURE_DU_TOUR[suite.suivant] - heureDe(a)), { energie: -10 });
    sauver(a);
    enCourse = null; concluPour = G.runners; dernier = r;
    return r;
  }
  const tour = enCourse.tour;
  const r = conclureLaCompetition(a, enCourse.epreuve, suite ? suite.placeFinale : place, moi, enCourse.vent);
  if (tour !== 'unique') r.tour = tour;
  messagesDeCourse(a, r);
  // le corps a couru lui aussi : sans echauffement, les ischios en premier
  const corps = tirerLeCorps(a, 'course');
  if (corps.blessure) {
    r.blessure = corps.blessure;
    envoyer(a, 'maman', [`On a vu que tu boitais en sortant… Va voir le médecin du sport.`, `We saw you limping afterwards… Go and see the sports doctor.`]);
  } else if (corps.gene) envoyer(a, a.club ? 'coach' : 'maman', [`${BLESSURES[corps.gene].gene[0]} Fais attention cette semaine.`, `${BLESSURES[corps.gene].gene[1]} Be careful this week.`]);
  const [fr, en] = MOTS[COMPETITIONS[r.niveau].cle];
  noter(a, `${fr} — ${r.epreuve} m : ${moi === null ? 'faux départ' : `${place === 1 ? '1er' : `${place}e`} en ${moi.toFixed(2)} s`}`,
           `${en} — ${r.epreuve} m: ${moi === null ? 'false start' : `P${place} in ${moi.toFixed(2)} s`}`);
  // la competition prend la journee ; la semaine tourne au coucher
  if (a.jour === undefined) semaineSuivante(a);
  else { avancer(a, Math.max(0, 18 * 60 - heureDe(a)), { energie: -25, hygiene: -40 }); sauver(a); }
  enCourse = null;
  concluPour = G.runners;
  dernier = r;
  return r;
}
