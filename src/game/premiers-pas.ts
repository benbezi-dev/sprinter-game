/* ---------------------------------------------------------------------------
   LES PREMIERS PAS — COURIR D'ABORD, EXPLIQUER ENSUITE
   ---------------------------------------------------------------------------
   CE QUE DISAIT LE TUNNEL (14/10/2026, appareils neufs des 30 derniers jours).
   Un nouveau joueur traversait, avant sa premiere foulee : la visite (cinq
   plans, imposee en plein ecran), la bienvenue (nom, nationalite, Instagram),
   COMMENCER, la proposition du tutoriel, puis quinze secondes de cinematique.
   Une minute trente-sept en mediane entre l'ouverture et le premier depart,
   et la moitie de ceux qui voyaient l'accueil n'allaient jamais jusqu'a une
   course.

   LA REGLE, DECIDEE PAR L'AUTEUR LE 14/10 : au tout premier lancement, on
   court. L'accueil passe la main d'office a l'etape 1 de la carriere, au
   100 m, sans visite, sans bienvenue, sans cinematique d'intro. Le geste
   s'apprend PENDANT la course (CoachPremiereCourse.tsx) : un mot avant le
   pistolet, les paves qui s'allument dans l'ordre, un rappel si l'on tape deux
   fois du meme cote. Le tutoriel complet reste a portee depuis l'accueil.

   ET LE RESTE VIENT APRES LA PREMIERE ARRIVEE, quand le joueur a un chrono a
   lui : la question du nom (« mets ton nom sur ce chrono », Bienvenue.tsx),
   puis la visite en version courte — le classement, le fantome, le direct —,
   ce qu'on ne pouvait pas comprendre avant d'avoir couru.

   QUI EST CONCERNE. Un appareil qui n'a rien vu : ni visite, ni tutoriel, ni
   bienvenue, aucun nom, aucune course dans l'historique. Un joueur deja la
   avant cette version garde son chemin d'avant. Un lien de duel (`?defi=`,
   `?direct=`) aussi : il vient courir contre quelqu'un de precis, et l'accueil
   doit le poser sur cet onglet-la (TitleScreen.tsx).

   LES PHASES, gardees sur l'appareil :
     (absente)  rien decide encore — `premierLancement()` dit si l'on y entre
     'course'   la premiere course est lancee
     'arrivee'  elle est allee au bout : le nom, puis la visite courte
     'fait'     les premiers pas sont faits, on n'y revient plus
--------------------------------------------------------------------------- */

const CLE = 'sprinter_premiers_pas';

export type PhasePremiersPas = 'course' | 'arrivee' | 'fait' | null;

function lire(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}

export function phasePremiersPas(): PhasePremiersPas {
  const v = lire(CLE);
  return v === 'course' || v === 'arrivee' || v === 'fait' ? v : null;
}

function poser(p: Exclude<PhasePremiersPas, null>) {
  try { localStorage.setItem(CLE, p); } catch { /* sans memoire : le chemin d'avant */ }
  try { window.dispatchEvent(new Event(CHANGE_PREMIERS_PAS)); } catch { /* hors navigateur */ }
}

export const CHANGE_PREMIERS_PAS = 'sprinter:premiers-pas';

/**
 * L'appareil n'a encore rien vu du jeu. Lu une fois par lancement : la reponse
 * ne doit pas changer pendant qu'on y est (la premiere course pose des
 * marqueurs, et l'accueil qui revient apres elle n'est plus un premier
 * lancement).
 */
let premier: boolean | null = null;
export function premierLancement(): boolean {
  if (premier !== null) return premier;
  let historique = 0;
  try { historique = (JSON.parse(lire('sprinter_history') || '[]') as unknown[]).length; } catch { historique = 1; }
  premier = phasePremiersPas() === null
    && lire('sprinter_tour_vu') !== '1'
    && lire('sprinter_tuto_vu') !== '1'
    && lire('sprinter_bienvenue_vue') !== '1'
    && !(lire('sprinter_player_name') || '').trim()
    && historique === 0;
  // Sans localStorage, rien ne retiendrait qu'on est passe : on ne l'impose pas.
  try { localStorage.getItem('x'); } catch { premier = false; }
  return premier;
}

/** La premiere course part (TitleScreen.tsx). */
export function premiereCourseLancee() { poser('course'); }

/**
 * La premiere course est allee au bout (engine.ts, onRaceRecorded), en `t`
 * secondes. Le chrono est garde : c'est lui que la bienvenue demande de signer.
 */
export function premiereArrivee(t: number) {
  if (phasePremiersPas() !== 'course') return;
  try { localStorage.setItem(CLE_CHRONO, t.toFixed(2)); } catch { /* le nom se demandera sans lui */ }
  poser('arrivee');
}
const CLE_CHRONO = 'sprinter_premier_chrono';
/** Le chrono de la premiere course, « 12.84 s », ou null. */
export function premierChrono(): string | null {
  const v = lire(CLE_CHRONO);
  return v ? `${v} s` : null;
}

/** La bienvenue et la visite courte sont passees : c'est fini. */
export function premiersPasFaits() { poser('fait'); }

/** On est entre la premiere arrivee et la fin des premiers pas. */
export function apresLaPremiereArrivee(): boolean { return phasePremiersPas() === 'arrivee'; }

/**
 * La question du nom, posee sur l'ecran de fin de la premiere course, a ete
 * close — repondue ou repoussee. La visite courte l'attend pour ne pas
 * s'empiler sur elle, et l'accueil qui monte APRES ne pouvait pas entendre
 * l'evenement de fermeture : on le garde donc sur l'appareil.
 */
const CLE_NOM = 'sprinter_premier_nom_demande';
export function nomDemandeApresCourse() {
  try { localStorage.setItem(CLE_NOM, '1'); } catch { /* la visite attendra le nom */ }
}
export function nomDejaDemande(): boolean { return lire(CLE_NOM) === '1'; }
