// L'Objectif du jour, cote jeu.
//
// Deux fois par jour le serveur calcule un chrono taille sur le record du
// joueur, et le range. Ce module va le chercher, lance la course, lui soumet
// le resultat, et tient le compte de la session en cours.
//
// TOUT LE CALCUL VIT SUR LE SERVEUR. Les seuils, les points, la serie, le
// palier : rien de tout cela n'est recopie ici. Un bareme en double est un
// bareme qui derive au premier reglage, et le joueur verrait alors l'ecran lui
// annoncer un palier que le classement ne lui donne pas.
//
// POURQUOI LE NOM ET PAS L'APPAREIL. Un joueur peut avoir un telephone et un
// ordinateur. Son classement est deja regroupe sur le nom, et son objectif
// doit l'etre aussi : deux objectifs pour la meme personne, ce serait deux
// fois les points et deux fois la notification.
//
// CE MODULE NE CASSE JAMAIS LE JEU. Le serveur peut etre injoignable, la route
// peut ne pas exister encore — on rend null et le jeu continue sans objectif.
// Un agrement qui empeche de jouer n'est plus un agrement.

import { useSyncExternalStore } from 'react';
import { getDeviceId, getSavedName, type RaceKey } from './leaderboard';
import { SprinterApp } from './engine';
import { rendreLeHasard } from './graine';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';

/**
 * Le plateau du defi. Fixe, et le meme pour tous.
 *
 * Le niveau decide de la force des adversaires. Le laisser au choix du joueur
 * ferait deux defis differents sous le meme nom ; le tirer de la graine
 * changerait la difficulte d'un jour a l'autre sans que le chrono cible en
 * tienne compte. C'est donc celui du one shot ordinaire, qui est aussi celui
 * sur lequel la plupart des courses de l'historique ont ete faites.
 */
const NIVEAU_DEFI = 4;

export type Palier = 'bronze' | 'argent' | 'or';

export type Objectif = {
  creneau: 'midi' | 'soir';
  jour: string;
  epreuve: RaceKey;
  cible_ms: number;
  pb_ms: number;
  tentatives: number;
  meilleur_ms: number | null;
  valide: boolean;
  points: number;
  graine: number | null;
  ouvre_le: number | null;
  expire_le: number | null;
  seuils: { bronze: number; argent: number; or: number };
  palier: Palier | null;
  /** Deja mis en forme par le serveur, dans la langue demandee. */
  titre: string;
  texte: string;
};

export type Resultat = {
  reussi: boolean;
  record: boolean;
  essai: number;
  palier: Palier | null;
  seuils: { bronze: number; argent: number; or: number };
  points: number;
  pointsTotal: number;
  detail: Record<string, number>;
  multiplicateur: number;
  /** Courses restantes avant le bonus de perseverance. Zero quand il est pris. */
  avantBonus: number;
  dejaValide: boolean;
  tempsMs: number;
  cibleMs: number;
  pbMs: number;
  meilleurMs: number;
  nouveauPbMs: number;
  /** La distance de ce defi, telle que le serveur l'a reconnue. */
  epreuve: RaceKey;
  creneau: 'midi' | 'soir';
  expireLe: number | null;
  graine: number | null;
};

/**
 * La trace de la course qui vient de finir.
 *
 * Le moteur la range dans `shotTraces` a l'arrivee de chaque course d'un
 * programme. Le defi n'en compte qu'une : c'est la premiere, et la seule.
 */
function traceDeLaCourse(): number[] {
  try {
    const t = (SprinterApp.G.shotTraces || [])[0];
    return Array.isArray(t) ? t : [];
  } catch { return []; }
}

/** La langue a laquelle ce joueur repond — meme regle que push.ts. */
function langue(): string {
  try {
    const l = document.documentElement.lang || '';
    return l.toLowerCase().startsWith('en') ? 'en' : 'fr';
  } catch { return 'fr'; }
}

/* ------------------------------------------------------------- la session

   Ce qui se passe entre le moment ou l'on entre dans le defi et celui ou l'on
   en sort. Le serveur tient le compte durable — tentatives, meilleur temps,
   points — mais l'ecran de revanche a besoin d'autre chose : ce qui s'est
   passe DEPUIS QUE LE JOUEUR EST ASSIS. « Ton meilleur essai de la session »
   n'est pas « ton meilleur essai du defi » quand on revient le soir. */

export type Session = {
  /**
   * Les defis du creneau : un par distance ou le joueur est classe, de un a
   * trois, dans l'ordre du programme. C'est ce que l'accueil pose en cartes.
   */
  objectifs: Objectif[];
  /**
   * Celui qu'on court, ou celui qu'on courrait. Distinct de la liste : une
   * fois entre dans un defi, tout ce qui suit — la revanche, l'envoi, l'ecran
   * d'arrivee — parle de CELUI-LA et d'aucun autre.
   */
  objectif: Objectif | null;
  /** Le joueur court-il le defi EN CE MOMENT ?
   *
   *  Distinct de « un objectif existe » : l'accueil en connait un sans le
   *  courir, et c'est ce drapeau-la qui decide quel ecran de fin s'affiche. */
  enCours: boolean;
  /** Courses jouees depuis l'entree dans le defi. */
  courses: number;
  /** Le meilleur chrono de cette session, en ms. */
  meilleurMs: number | null;
  /** Le resultat de la derniere course, tel que le serveur l'a juge. */
  dernier: Resultat | null;
  /** Une course est-elle en cours d'envoi ? */
  envoi: boolean;
};

let session: Session = {
  objectifs: [], objectif: null, enCours: false, courses: 0,
  meilleurMs: null, dernier: null, envoi: false,
};
const ecouteurs = new Set<() => void>();

function poser(suite: Partial<Session>) {
  session = { ...session, ...suite };
  for (const f of [...ecouteurs]) { try { f(); } catch { /* ecran parti */ } }
}

export function surObjectif(f: () => void): () => void {
  ecouteurs.add(f);
  return () => { ecouteurs.delete(f); };
}

export function sessionCourante(): Session { return session; }

/** L'etat du defi en cours, pour un ecran. */
export function useObjectif(): Session {
  // `surObjectif` rend deja de quoi se desabonner : c'est exactement la
  // signature attendue. Et `session` est remplace, jamais mute — sans quoi
  // React comparerait un objet a lui-meme et ne redessinerait rien.
  return useSyncExternalStore(surObjectif, () => session, () => session);
}

/* ---------------------------------------------------------------- lecture */

/**
 * Les defis ouverts, un par distance. La liste peut etre vide.
 *
 * Vide couvre quatre cas qui se traitent pareil : il n'y en a pas encore
 * aujourd'hui, la fenetre est fermee, le joueur n'est classe nulle part, le
 * serveur ne repond pas. Aucun n'est une erreur du point de vue du jeu.
 *
 * `objectif` NE BOUGE PAS PENDANT UNE COURSE. L'accueil rappelle cette route
 * en revenant, et ecraser le defi qu'on court par le premier de la liste
 * renverrait le joueur sur le 100 m au milieu de son 400 m.
 */
export async function lireObjectif(): Promise<Objectif[]> {
  const nom = getSavedName();
  if (!nom) return [];
  try {
    const r = await fetch(
      `${API_BASE}/objectif?nom=${encodeURIComponent(nom)}&langue=${langue()}`);
    if (!r.ok) return [];
    const d = await r.json();
    // `objectifs` est la forme d'aujourd'hui ; `objectif` seul est celle d'un
    // serveur qui n'a pas encore ete deploye. Les deux se lisent, et le jeu ne
    // reste pas sans defi le temps d'un deploiement.
    const liste = (Array.isArray(d?.objectifs) ? d.objectifs
      : (d?.objectif ? [d.objectif] : [])) as Objectif[];
    poser(session.enCours
      ? { objectifs: liste }
      : { objectifs: liste, objectif: liste[0] || null });
    return liste;
  } catch { return []; }
}

/* ----------------------------------------------------------------- courir */

/**
 * Entre dans le defi et lance la premiere course.
 *
 * La graine est posee AVANT `startOneShot` : c'est `startShotRace` qui la lit,
 * et elle doit etre en place quand il construit le plateau. Elle y reste pour
 * les tentatives suivantes — chacune se court sur le meme terrain.
 */
export function lancerObjectif(o: Objectif): void {
  const G = SprinterApp.G;
  G.graineCourse = o.graine ?? null;
  G.objectifEnCours = o;
  poser({ objectif: o, enCours: true, courses: 0, meilleurMs: null, dernier: null });
  SprinterApp.startOneShot([o.epreuve], { levelIdx: NIVEAU_DEFI });
}

/**
 * La revanche : une course de plus, tout de suite.
 *
 * Le meme chemin que l'entree, et volontairement : `startOneShot` remet la
 * course a zero et `startShotRace` repose la graine, donc le plateau est
 * identique a la tentative precedente. Passer par `recommencer()` du moteur
 * marcherait aussi, mais il efface des choses qui ne nous concernent pas et
 * n'a jamais promis de garder la graine.
 */
export function relancerObjectif(): boolean {
  const o = session.objectif;
  if (!o) return false;
  const G = SprinterApp.G;
  G.graineCourse = o.graine ?? null;
  G.objectifEnCours = o;
  poser({ enCours: true });
  SprinterApp.startOneShot([o.epreuve], { levelIdx: NIVEAU_DEFI });
  return true;
}

/**
 * Sort du defi et rend le hasard au jeu ordinaire.
 *
 * A APPELER SANS FAUTE. Une graine laissee en place ne fait pas planter le
 * jeu : elle le rend lentement identique a lui-meme, toutes les courses
 * suivantes sur le meme plateau, y compris en carriere.
 */
export function quitterObjectif(): void {
  const G = SprinterApp.G;
  G.graineCourse = null;
  G.objectifEnCours = null;
  // ET ON REND LE HASARD, EXPLICITEMENT.
  //
  // Effacer `graineCourse` ne suffit pas : seul `startShotRace` la relit, et
  // une course de CARRIERE passe par `startLevel`, qui ne la regarde jamais.
  // Le moteur restait donc seme apres etre sorti du defi — verifie, il l'etait
  // — et tout le jeu se mettait a derouler une seule suite. Rien n'a l'air
  // casse quand cela arrive : les plateaux changent toujours d'une course a
  // l'autre. Ils ne changent simplement plus d'un joueur a l'autre.
  rendreLeHasard();
  poser({ enCours: false, courses: 0, meilleurMs: null, dernier: null });
}

/** Court-on un defi en ce moment ? */
export function dansUnObjectif(): boolean {
  try { return !!SprinterApp.G.objectifEnCours; } catch { return false; }
}

/**
 * Soumet une course a l'objectif du jour.
 *
 * A appeler a CHAQUE course terminee dans le defi, sans verifier d'abord qu'un
 * objectif est ouvert : le serveur rend null quand il n'y a rien en cours, et
 * un aller-retour de trop vaut mieux qu'une validation manquee.
 *
 * Le compte de la session avance MEME si le serveur ne repond pas : la course
 * a bien eu lieu, et l'ecran de revanche doit pouvoir dire « troisieme essai »
 * sans dependre du reseau.
 */
export async function soumettreCourse(tempsMs: number): Promise<Resultat | null> {
  const nom = getSavedName();
  const ms = Math.round(tempsMs);
  if (!Number.isFinite(ms) || ms <= 0) return null;

  poser({
    courses: session.courses + 1,
    meilleurMs: session.meilleurMs === null ? ms : Math.min(session.meilleurMs, ms),
    envoi: true,
  });

  if (!nom) { poser({ envoi: false }); return null; }
  try {
    const r = await fetch(`${API_BASE}/objectif/tentative`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // LA TRACE ACCOMPAGNE LE CHRONO, et le serveur la reclame.
      //
      // C'est la distance du coureur toutes les 80 ms — celle qui sert deja a
      // rejouer une course en fantome. Elle dit la forme de la course, et pas
      // seulement son resultat : un chrono sans elle n'est plus qu'une
      // affirmation, et le serveur en refuse.
      body: JSON.stringify({
        nom, ms, langue: langue(),
        device_id: getDeviceId(),
        // LA DISTANCE QU'ON VIENT DE COURIR. Trois defis sont ouverts en meme
        // temps, et c'est elle qui dit lequel cette course vise : sans elle,
        // un 400 m irait valider le 100 m, qui n'a rien demande.
        epreuve: session.objectif?.epreuve,
        trace: traceDeLaCourse(),
      }),
    });
    if (!r.ok) throw new Error('indisponible');
    const d = await r.json();
    const res = (d?.resultat ?? null) as Resultat | null;
    poser({ dernier: res, envoi: false });
    return res;
  } catch {
    poser({ envoi: false });
    return null;
  }
}

/* ------------------------------------------------------------ classement */

export type LigneClassement = {
  nom: string; points: number; valides: number; serie: number;
};

/** Le Classement des Objectifs. Distinct du TOP 500, qui classe les chronos. */
export async function lireClassementObjectifs(n = 100): Promise<LigneClassement[]> {
  try {
    const r = await fetch(`${API_BASE}/objectif/classement?n=${n}`);
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d?.classement) ? d.classement : [];
  } catch { return []; }
}

/* ---------------------------------------------------------------- lecture */

/** Le chrono tel que le jeu l'ecrit ailleurs : deux decimales. */
export const s2 = (ms: number) => (ms / 1000).toFixed(2);

/**
 * Ce qu'il reste a gratter, en secondes — la phrase la plus lue de l'ecran.
 *
 * Positive tant que la cible n'est pas atteinte. Calculee ici plutot qu'a
 * l'affichage : plusieurs ecrans la montrent, et un arrondi qui differe de
 * l'un a l'autre se remarque tout de suite.
 */
export function ecartALaCible(ms: number | null, cibleMs: number): number | null {
  if (ms === null || !Number.isFinite(ms)) return null;
  return Math.max(0, ms - cibleMs);
}

/** Combien de temps reste-t-il ? En minutes, ou null si pas de fenetre. */
export function minutesRestantes(o: Objectif | null): number | null {
  if (!o || !o.expire_le) return null;
  return Math.max(0, Math.round((o.expire_le - Date.now()) / 60000));
}

/* ------------------------------------------------------- la notification */

/**
 * Une notification d'objectif a ete touchee.
 *
 * DEUX CHOSES, ET LA PREMIERE EST INVISIBLE. On previent le serveur qu'elle a
 * ete ouverte : rien d'autre ne le lui dirait, et sans cela le taux
 * d'ouverture n'existe pas — donc ni l'anti-fatigue, ni la comparaison de deux
 * textes. Puis on ouvre le defi, directement, sans ecran intermediaire : c'est
 * ce qu'annonce la notification, et l'ecran d'accueil entre les deux est
 * exactement ou l'on perd les gens.
 *
 * Rend true si la course a ete lancee. False quand on n'etait pas en position
 * de le faire — au milieu d'une autre course, par exemple : interrompre celle
 * qu'on est en train de courir pour en ouvrir une autre serait pire que de ne
 * rien faire.
 *
 * ET FALSE AUSSI QUAND IL Y EN A PLUSIEURS. Depuis que le defi existe sur les
 * trois distances, la notification en annonce un et cite les autres — mais
 * rien dans ce qu'elle transmet ne dit au jeu LEQUEL a ete touche. Ouvrir le
 * 100 m a quelqu'un qui venait pour le tour de piste serait pire que de le
 * laisser choisir : on rend alors la main a l'accueil, ou les trois cartes
 * sont posees cote a cote et le choix coute un geste.
 */
export async function ouvrirDepuisNotification(): Promise<boolean> {
  const nom = getSavedName();
  if (nom) {
    fetch(`${API_BASE}/notifications/ouverte`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, type: 'objectif' }),
      keepalive: true,
    }).catch(() => { /* le compteur n'est pas vital */ });
  }

  const liste = await lireObjectif();
  if (liste.length !== 1) return false;
  const o = liste[0];

  const etat = SprinterApp.G.state;
  if (etat !== 'title' && etat !== 'open') return false;

  lancerObjectif(o);
  return true;
}

/* ------------------------------------------------------------- le rythme */

export type Rythme = { rythme: 'deux' | 'un'; choisi: boolean };

/** Une notification par jour, ou deux ? Et est-ce le joueur qui l'a choisi ? */
export async function lireRythme(): Promise<Rythme | null> {
  const nom = getSavedName();
  if (!nom) return null;
  try {
    const r = await fetch(`${API_BASE}/notifications/rythme?nom=${encodeURIComponent(nom)}`);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

/** Le joueur choisit son rythme. Rend false si le serveur a refuse. */
export async function poserRythme(rythme: 'deux' | 'un'): Promise<boolean> {
  const nom = getSavedName();
  if (!nom) return false;
  try {
    const r = await fetch(`${API_BASE}/notifications/rythme`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, device_id: getDeviceId(), rythme }),
    });
    return r.ok;
  } catch { return false; }
}
