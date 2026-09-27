// LE DEFI DE LA DEMI — un jeu pour patienter jusqu'a la demi-finale 2 (27/09).
//
// Le dimanche, trois heures separent les deux demi-finales (10:30 et 13:30
// UTC). Les huit de la deuxieme ont leur chambre d'appel et son echauffement ;
// tous les autres — les huit de la premiere, les eliminés des series, ceux qui
// suivent sans courir — n'avaient qu'un compte a rebours a regarder.
//
// Ils peuvent maintenant COURIR LA DEMI-FINALE 1. Sur la piste du championnat,
// contre les huit chronos qui viennent d'y etre courus : chaque demi-finaliste
// est pose dans son couloir et court exactement son temps — c'est le partant
// fictif du direct (`cible_ms`, voir armLives dans sprinter-app.js), celui que
// le rejeu utilise deja pour faire recourir une course a partir de ses chronos.
// La question du jeu est la seule qui compte ce jour-la : ou aurais-tu fini ?
//
// RIEN NE PART AU SERVEUR, et c'est voulu. Un jour de championnat, le worker
// ne se deploie pas pendant les courses ; un jeu d'attente ne doit dependre de
// rien qui puisse tomber pendant la demie qu'il fait attendre. Tout ce qu'il
// lit est deja dans `Edition` : les resultats, les couloirs, le calendrier. Le
// meilleur chrono de chacun reste sur son telephone.
//
// Trois regles, et elles viennent de la piste :
//
// - HUIT COULOIRS, PAS NEUF. Le joueur prend un couloir que la demie a laisse
//   vide (forfait, carton rouge, abandon), au plus pres du centre ; s'il n'y
//   en a pas, celui du dernier, qui lui cede sa place — et l'ecran le dit.
// - UN DEMI-FINALISTE REJOUE SA DEMIE. Il reprend son propre couloir, contre
//   les sept autres : son vrai chrono sort de la piste et devient la barre.
// - LE FAUX DEPART ELIMINE, comme en demi-finale. On recommence aussitot.

import { useSyncExternalStore } from 'react';
import { arrivee, type Edition } from './championnats';
import { couloirsDe } from './regarder';
import { niveauDuLieu } from './champ-rejeu';
import { quitterDirect } from './champ-direct';
import { getSavedName } from './leaderboard';
import { SprinterApp } from './engine';
import { EST_TEST } from './canal';

const PHASE = 'demies';
/** La demie qu'on court. */
const COURSE_COURUE = 1;
/** Celle qu'on attend. */
const COURSE_ATTENDUE = 2;
/**
 * Le defi ferme une minute avant le depart de la demie 2 : a cette heure-la,
 * la seule chose a faire est de la regarder. Une course deja partie se finit.
 */
const FERMETURE_AVANT_MS = 60_000;
/** Les couloirs libres, du meilleur au moins bon : le centre d'abord. */
const COULOIRS_PREFERES = [4, 5, 3, 6, 2, 7, 1, 8];

export type CoureurDefi = {
  cle: string;
  nom: string;
  pays: string | null;
  /** Son chrono dans la demie, ou `null` (carton rouge, abandon, forfait). */
  ms: number | null;
  /** Son couloir dans la demie, 1 a 8 ; 0 s'il n'a pas pu etre retrouve. */
  couloir: number;
};

/** Ce qu'il faut pour courir le defi : tout vient de l'edition. */
export type Defi = {
  edition: string;
  epreuve: string;
  lieu: string | null;
  /** « Demi-finale 1 » — ce qu'on court. */
  titre: string;
  /** « Demi-finale 2 » — ce qu'on attend. */
  attendue: string;
  /** L'heure de la demie 2 au calendrier, ou `null` s'il ne la dit pas. */
  departAttendue: number | null;
  /** Les partants de la demie 1, avec leur chrono. */
  coureurs: CoureurDefi[];
  /** Combien passent directement en finale par demie. */
  directs: number;
};

/** Ou le joueur court, et contre qui. */
export type Placement = {
  couloir: number;
  adversaires: CoureurDefi[];
  /** Le demi-finaliste qui lui cede son couloir, s'il a fallu en pousser un. */
  remplace: CoureurDefi | null;
  /** Sa propre ligne, s'il a couru cette demie : son vrai chrono est la barre. */
  moi: CoureurDefi | null;
};

export type LigneDefi = { nom: string; ms: number | null; couloir: number; moi: boolean };

export type ResultatDefi = {
  ms: number | null;
  fauxDepart: boolean;
  /** Sa place parmi ceux qui etaient sur la piste, ou `null` sans chrono. */
  place: number | null;
  partants: number;
  classement: LigneDefi[];
  /** Son meilleur chrono du defi sur cette edition, cette course comprise. */
  meilleur: number | null;
  meilleurePlace: number | null;
  nouveauMeilleur: boolean;
  essais: number;
};

export type EtatDefi = {
  defi: Defi | null;
  placement: Placement | null;
  resultat: ResultatDefi | null;
};

/* ------------------------------------------------------------- l'ouverture */

const cleDuJoueur = () => (getSavedName() || '').trim().toLowerCase();

/**
 * Le defi de cette edition, s'il est ouvert maintenant a ce joueur-la.
 *
 * Il l'est entre la demie 1 courue et la demie 2 appelee, pour qui ne court
 * pas la demie 2. Sur le canal de test, les editions sont datees au hasard et
 * leurs courses se lancent a la main : l'heure n'y ferme rien, seul le
 * resultat de la demie 2 le fait.
 */
export function defiOuvert(e: Edition | null, maintenant = Date.now(), moi = cleDuJoueur()): Defi | null {
  if (!e || e.etat !== 'ouverte' || e.phase !== PHASE) return null;
  const courue = arrivee(e, PHASE, COURSE_COURUE);
  if (!courue.some(r => r.ms != null && r.ms > 0)) return null;
  if (arrivee(e, PHASE, COURSE_ATTENDUE).length) return null;
  const rv = (e.calendrier || []).find(r => r.phase === PHASE && r.course === COURSE_ATTENDUE);
  const departAttendue = rv ? rv.at : null;
  if (!EST_TEST && departAttendue != null && maintenant > departAttendue - FERMETURE_AVANT_MS) return null;
  // Les partants de la demie 2 ont la chambre d'appel, et son echauffement.
  if (moi && couloirsDe(e, PHASE, COURSE_ATTENDUE).some(p => p.name_key === moi)) return null;

  // Les couloirs, derives comme partout ailleurs : le rang de duel, dans la
  // liste des partants de la course (voir `Grille` et `couloirsDe`).
  const couloirDe = new Map(couloirsDe(e, PHASE, COURSE_COURUE).map((p, i) => [p.name_key, i + 1]));
  const pays = new Map(e.partants.map(p => [p.name_key, p.pays ?? null]));
  const { N } = SprinterApp;
  const phase = e.phases.find(p => p.cle === PHASE);
  return {
    edition: e.id,
    epreuve: e.epreuve || '100',
    lieu: e.lieu ?? null,
    titre: N.courseNom(PHASE, COURSE_COURUE, phase?.courses ?? 2, phase?.nom),
    attendue: N.courseNom(PHASE, COURSE_ATTENDUE, phase?.courses ?? 2, phase?.nom),
    departAttendue,
    coureurs: courue.map(r => ({
      cle: r.name_key, nom: r.nom, pays: pays.get(r.name_key) ?? null,
      ms: r.ms != null && r.ms > 0 ? r.ms : null,
      couloir: couloirDe.get(r.name_key) ?? 0,
    })),
    directs: e.directsParCourse || 2,
  };
}

/** Le defi est-il encore ouvert, sans relire l'edition ? */
export function encoreOuvert(d: Defi, maintenant = Date.now()): boolean {
  return EST_TEST || d.departAttendue == null || maintenant <= d.departAttendue - FERMETURE_AVANT_MS;
}

/* -------------------------------------------------------------- la piste */

/**
 * Ou le joueur court, et contre qui. Voir les trois regles en tete du fichier.
 */
export function placer(d: Defi, moi = cleDuJoueur()): Placement {
  // Ceux qui ont un chrono courent ; les autres laissent leur couloir vide.
  const courent = d.coureurs.filter(c => c.ms != null);
  // Un couloir inconnu (0) ou deja pris se voit attribuer le premier libre :
  // deux coureurs dans le meme couloir, et l'un des deux disparait.
  const pris = new Set<number>();
  const places: CoureurDefi[] = [];
  const sansCouloir: CoureurDefi[] = [];
  for (const c of courent) {
    if (c.couloir >= 1 && c.couloir <= 8 && !pris.has(c.couloir)) { pris.add(c.couloir); places.push(c); }
    else sansCouloir.push(c);
  }
  for (const c of sansCouloir) {
    const l = COULOIRS_PREFERES.find(x => !pris.has(x));
    if (l == null) continue;
    pris.add(l); places.push({ ...c, couloir: l });
  }

  const miens = moi ? places.find(c => c.cle === moi) || null : null;
  if (miens) {
    return { couloir: miens.couloir, adversaires: places.filter(c => c !== miens), remplace: null, moi: miens };
  }
  // Il avait couru sans chrono (carton rouge, abandon) : son couloir est libre.
  const moiSansChrono = moi ? d.coureurs.find(c => c.cle === moi && c.ms == null) || null : null;
  if (moiSansChrono && moiSansChrono.couloir >= 1 && !pris.has(moiSansChrono.couloir)) {
    return { couloir: moiSansChrono.couloir, adversaires: places, remplace: null, moi: moiSansChrono };
  }
  const libre = COULOIRS_PREFERES.find(x => !pris.has(x));
  if (libre != null) return { couloir: libre, adversaires: places, remplace: null, moi: moiSansChrono };
  // Huit chronos, huit couloirs : le dernier cede le sien.
  const dernier = places.slice().sort((a, b) => (b.ms as number) - (a.ms as number))[0];
  return {
    couloir: dernier.couloir,
    adversaires: places.filter(c => c !== dernier),
    remplace: dernier,
    moi: moiSansChrono,
  };
}

/* ------------------------------------------------------------- l'etat */

let etat: EtatDefi = { defi: null, placement: null, resultat: null };
const abonnes = new Set<() => void>();
function publier(p: Partial<EtatDefi>) {
  etat = { ...etat, ...p };
  for (const f of abonnes) f();
}

export function useDefiDemie(): EtatDefi {
  return useSyncExternalStore(
    l => { abonnes.add(l); return () => { abonnes.delete(l); }; },
    () => etat, () => etat,
  );
}

/* ------------------------------------------------------- la course */

let essaiEnCours = 0;
let essaiConclu = 0;

/**
 * Lancer une course du defi. Rend faux si la piste n'a personne a y poser.
 */
export function courirLeDefi(d: Defi): boolean {
  if (!encoreOuvert(d)) return false;
  const p = placer(d);
  if (!p.adversaires.length) return false;
  // Une salle ouverte (un direct regarde) se ferme : le moteur ne court
  // qu'une course a la fois, et le lien vers la salle ne doit rien recevoir
  // de celle-ci.
  quitterDirect(false);
  // LE SON S'OUVRE DANS LE GESTE, comme a l'entree du direct : sans lui,
  // c'est le premier appui de la course qui fabrique tous les sons du jeu.
  try { SprinterApp.Audio_.init(); SprinterApp.Audio_.ctx?.resume?.(); } catch { /* sans le son, la course se court */ }

  const G = SprinterApp.G;
  SprinterApp.startLive([d.epreuve], {
    levelIdx: niveauDuLieu(d.lieu),
    autres: p.adversaires.map(c => ({
      id: 'defi:' + c.cle, nom: c.nom, couloir: c.couloir, cible_ms: c.ms,
    })),
    sansOrdinateur: true,
    // Les couloirs de la demie, tels qu'ils sont peints : c'est ce que le
    // mode championnat du moteur sait faire (indiceDuCouloir).
    championnat: true,
    monCouloir: p.couloir,
  });
  // Puis, comme l'echauffement de la chambre d'appel : l'affichage du
  // championnat (« TOI » au-dessus de la tete, pas de cerceau), sans son
  // juge. Le faux depart se juge ici et elimine, et la course s'arrete sur
  // l'ecran de fin au lieu d'attendre un verdict de salle qui ne viendra pas.
  G.champDirect = false;
  G.echauffementChamp = true;
  essaiEnCours += 1;
  // LE DRAPEAU VIT SUR `G`, et non ici : le moteur l'eteint de lui-meme a
  // l'accueil et a toute course neuve (goHome, buildLevel). Une sortie par le
  // menu de pause ne laisse donc pas l'ecran de fin du defi s'ouvrir sur le
  // one shot suivant. App le lit pour choisir cet ecran-la.
  G.defiDemie = { edition: d.edition, essai: essaiEnCours };
  SprinterApp.liveDepart(3000, null);
  publier({ defi: d, placement: p, resultat: null });
  return true;
}

/**
 * La course est finie : le resultat, calcule une fois par course.
 *
 * Le classement se refait ici, sur les chronos de la demie, plutot que d'etre
 * lu dans celui du moteur : les deux disent la meme chose — chaque coureur
 * fictif court exactement son temps — mais celui-ci ne depend pas de l'instant
 * ou le moteur a arrete la course.
 */
export function conclureLeDefi(): ResultatDefi | null {
  const G = SprinterApp.G;
  const d = etat.defi, p = etat.placement;
  if (!d || !p || !G?.defiDemie) return etat.resultat;
  const essai = G.defiDemie.essai;
  if (essai === essaiConclu && etat.resultat) return etat.resultat;
  essaiConclu = essai;

  const fauxDepart = !!G.falseOut;
  const ft = G.player?.finishTime;
  const ms = !fauxDepart && ft != null && ft > 0 ? Math.round(ft * 1000) : null;

  const classement: LigneDefi[] = [
    ...p.adversaires.map(c => ({ nom: c.nom, ms: c.ms, couloir: c.couloir, moi: false })),
    { nom: SprinterApp.N.t('you'), ms, couloir: p.couloir, moi: true },
  ].sort((a, b) => (a.ms ?? Infinity) - (b.ms ?? Infinity));
  const place = ms == null ? null : classement.findIndex(l => l.moi) + 1;

  const m = noterEssai(d.edition, ms, place);
  const resultat: ResultatDefi = {
    ms, fauxDepart, place, partants: classement.length, classement,
    meilleur: m.meilleur, meilleurePlace: m.place, nouveauMeilleur: m.nouveau, essais: m.essais,
  };
  publier({ resultat });
  return resultat;
}

/** Recourir tout de suite, sur la meme demie. */
export function recourir(): boolean {
  return etat.defi ? courirLeDefi(etat.defi) : false;
}

/** Rentrer a l'accueil : le moteur eteint le defi (goHome). */
export function quitterLeDefi() {
  publier({ resultat: null });
  SprinterApp.goHome();
}

/* -------------------------------------------------------- la memoire */

/**
 * Le meilleur chrono de chacun, par edition, sur ce telephone.
 *
 * Par edition, parce qu'un record du defi n'a de sens que contre les memes
 * huit chronos. On ne garde que les dix dernieres : sans plafond, la cle
 * grossirait d'une ligne par championnat et pour toujours.
 */
const MEMOIRE = 'sprinter_defi_demie';
type Souvenir = { meilleur: number | null; place: number | null; essais: number; au: number };

function lireMemoire(): Record<string, Souvenir> {
  try { return JSON.parse(localStorage.getItem(MEMOIRE) || '{}') || {}; } catch { return {}; }
}

export function monMeilleur(edition: string): Souvenir | null {
  return lireMemoire()[edition] || null;
}

function noterEssai(edition: string, ms: number | null, place: number | null) {
  const tout = lireMemoire();
  const avant = tout[edition] || { meilleur: null, place: null, essais: 0, au: 0 };
  const nouveau = ms != null && (avant.meilleur == null || ms < avant.meilleur);
  const apres: Souvenir = {
    meilleur: nouveau ? ms : avant.meilleur,
    place: nouveau ? place : avant.place,
    essais: avant.essais + 1,
    au: Date.now(),
  };
  tout[edition] = apres;
  try {
    const gardees = Object.entries(tout).sort((a, b) => b[1].au - a[1].au).slice(0, 10);
    localStorage.setItem(MEMOIRE, JSON.stringify(Object.fromEntries(gardees)));
  } catch { /* sans memoire, le defi se joue quand meme */ }
  // « Nouveau meilleur » ne se dit qu'a partir du deuxieme chrono : le premier
  // n'a rien battu.
  return { meilleur: apres.meilleur, place: apres.place, essais: apres.essais,
           nouveau: nouveau && avant.meilleur != null };
}
