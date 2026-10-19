// LA MEUTE — la nuit du molosse a plusieurs, jusqu'a huit (18/10).
//
// UNE SALLE DU DIRECT, ET RIEN D'AUTRE COTE SERVEUR. La piste a plusieurs
// existe deja (worker/src/salle.js) : huit couloirs, un pistolet date, les
// positions de chacun relayees a chacun. Elle apprend seulement trois choses
// quand elle court un trace de la nuit — le rang de la nuit choisie par celui
// qui l'ouvre, la morsure (« pris a 64 m ») qui classe les mordus entre eux,
// et qu'elle ne compte pas aux duels.
//
// UNE SEULE BETE, LA MEME SUR TOUS LES TELEPHONES. Le molosse n'est pas
// integre : sa position se calcule depuis le chrono de la course (positionDe,
// halloween-loi.js). Au meme pistolet, il est donc au meme metre partout, sans
// qu'un seul paquet n'ait a le transporter. Chacun la voit dans son propre
// couloir — c'est lui qu'elle chasse a l'ecran — et chacun juge sa morsure
// lui-meme, comme en solo, puis la dit a la salle.
//
// LE RECIT NE S'Y GAGNE PAS. Les chapitres sont la recompense de la nuit
// tenue seul, jour apres jour ; une nuit courue en meute ne range rien au
// carnet. On y court les nuits qu'on a deja ouvertes, pour le frisson d'etre
// plusieurs devant la meme bete.
//
// TOUT LE MONDE PART DES BLOCS (voir armerLaNuit) : le depart surpris tire son
// attente au hasard sur chaque telephone, il ne se synchronise pas.

import { SprinterApp, brancherSalle, reinitialiserEnvoi } from './engine';
import { Salle, ouvrirSalle, etatSalle, type EtatSalle, type ResultatDirect } from './live';
import { getSavedName } from './leaderboard';
import { inviterEnDirect } from './invitations-directes';
import { nomPourLeDirect } from './identity';
import { armerLaNuit, rangerLaNuit, nuitEnCours, nuitDe, etapeDuCimetiere } from './halloween';
import { COURSES } from './halloween-courses.js';
import { cameraDe } from './halloween-cameras.js';
import { prechargerLaNuit } from './chargement';

/** Les cinq traces de la nuit — les seuls qu'une salle de meute court. */
const TRACES_DE_LA_NUIT = Object.keys(COURSES);

export const MEUTE_MIN = 2;
export const MEUTE_MAX = 8;

export type ArriveeMeute = {
  id: string; nom: string;
  /** Passe la ligne : son chrono, en ms. */
  ms: number | null;
  /** Mordu : a combien de metres du depart. */
  mordu: number | null;
  /** Faux depart ou abandon. */
  abandon: boolean;
};

export type EtatMeute = {
  etape: 'repos' | 'connexion' | 'salon' | 'course' | 'fini';
  code: string;
  salon: EtatSalle | null;
  moi: string;
  hote: boolean;
  /** Qui est arrive, et comment, a mesure que la salle le dit. */
  arrivees: Record<string, ArriveeMeute>;
  /** La derniere position connue de chacun, en metres. */
  positions: Record<string, number>;
  /** Le verdict de la salle, quand tout le monde est arrive. */
  resultat: ResultatDirect | null;
  erreur: string;
  /** La nuit qu'on a voulu courir sans l'avoir debloquee. */
  nuitRefusee: number | null;
  /** Ceux du TOP 500 qu'on a invites dans cette meute, et ce qu'il en est. */
  invites: Record<string, 'envoi' | 'invite' | 'injoignable'>;
};

const VIDE: EtatMeute = {
  etape: 'repos', code: '', salon: null, moi: '', hote: false,
  arrivees: {}, positions: {}, resultat: null, erreur: '', nuitRefusee: null, invites: {},
};

let etat: EtatMeute = VIDE;
let salle: Salle | null = null;
const abonnes = new Set<() => void>();

function poser(p: Partial<EtatMeute>) {
  etat = { ...etat, ...p };
  for (const f of abonnes) { try { f(); } catch { /* un ecran casse n'arrete pas les autres */ } }
}

/** Pour useSyncExternalStore. */
export function abonnerMeute(f: () => void): () => void {
  abonnes.add(f);
  return () => { abonnes.delete(f); };
}
export function etatDeLaMeute(): EtatMeute { return etat; }

/** Est-on dans une meute en ce moment (salon, course ou ecran de fin) ? */
export function dansLaMeute(): boolean { return etat.etape !== 'repos'; }

/** La nuit que la salle court, ou null tant qu'elle ne l'a pas dit. */
export function nuitDeLaMeute(): number | null {
  const n = etat.salon?.nuit;
  return typeof n === 'number' && n >= 1 && n <= 13 ? n : null;
}

/** Les autres partants, avec leur couloir tel que la salle l'a attribue. */
function lesAutres() {
  const moi = salle?.moi || '';
  return (salle?.dernierEtat?.joueurs || [])
    .filter(j => j.id !== moi)
    .map(j => ({ id: j.id, nom: j.nom, couloir: j.couloir || 0 }));
}

/**
 * LE PISTOLET DE LA SALLE. La piste se monte, la bete s'arme, et le decompte
 * se cale sur la date annoncee — la meme pour les huit.
 */
function lancer(dansMs: number, departA: number) {
  const n = nuitDeLaMeute();
  if (!salle || n === null) return;
  // Une revanche part depuis l'ecran de fin : la nuit d'avant est encore armee.
  if (nuitEnCours()) rangerLaNuit();
  const nuit = nuitDe(n);
  prechargerLaNuit(cameraDe(n).deg);
  (SprinterApp as any).startLive([nuit.epreuve], {
    levelIdx: etapeDuCimetiere(), adversaire: '', autres: lesAutres(),
    sansOrdinateur: true, etiquette: 'halloween',
  });
  // APRES startLive, comme apres startOneShot en solo : la construction de la
  // course range les obstacles de la precedente.
  const s = salle;
  armerLaNuit(n, { aPlusieurs: true, surMorsure: d => s.mordu(d) });
  reinitialiserEnvoi();
  poser({ etape: 'course', arrivees: {}, positions: {}, resultat: null, erreur: '' });
  (SprinterApp as any).liveDepart(dansMs, departA);
}

function ecouteurs() {
  return {
    onEtat: (e: EtatSalle) => {
      poser({
        salon: e, moi: salle?.moi || '', hote: !!salle?.suisHote,
        etape: etat.etape === 'connexion' ? 'salon' : etat.etape,
      });
      // Quelqu'un part ou arrive pendant la course : son couloir suit.
      const G = SprinterApp.G;
      if (G.liveOn && (G.state === 'count' || G.state === 'race') && nuitEnCours()) {
        (SprinterApp as any).majLives(lesAutres());
      }
    },
    onDepart: (dansMs: number, departA: number) => lancer(dansMs, departA),
    onPos: (id: string, d: number, c?: number) => {
      (SprinterApp as any).liveDistDe(id, d, c);
      etat.positions[id] = d;
    },
    onFini: (nom: string, ms: number, abandon: boolean, id?: string, mordu?: number) => {
      if (!id) return;
      (SprinterApp as any).liveFiniDe(id, ms, abandon);
      poser({
        arrivees: {
          ...etat.arrivees,
          [id]: {
            id, nom,
            ms: abandon ? null : ms,
            mordu: mordu == null ? null : mordu,
            abandon: abandon && mordu == null,
          },
        },
      });
    },
    onResultat: (r: ResultatDirect) => {
      poser({ resultat: r, etape: 'fini' });
      // LE MORDU QUI REGARDAIT : la poursuite est finie, le dernier est passe
      // ou pris. On ferme la course, et l'ecran de la meute prend la suite.
      // PAS TOUT DE SUITE : le verdict part a l'instant ou le dernier passe
      // ou se fait prendre CHEZ LUI, et l'horloge de course d'un telephone
      // lent retarde sur celle des autres (le pas de temps y est plafonne).
      // On attend donc que CET ecran ait vu chaque survivant franchir la
      // ligne — une seconde de plus pour le voir — et six secondes au plus.
      const debut = Date.now();
      const id = setInterval(() => {
        const G = SprinterApp.G;
        if (!(G.spectateur && G.liveOn && nuitEnCours() && G.state === 'race')) { clearInterval(id); return; }
        const t = G.elapsed || 0;
        const vu = [...(G.lives || new Map()).values()]
          .every((g: any) => g.abandon || (g.fin != null && t >= g.fin + 1));
        if (!vu && Date.now() - debut < 6000) return;
        clearInterval(id);
        for (const r2 of G.runners) if (!r2.finished && !r2.isPlayer) r2.finishTime = r2.target;
        (SprinterApp as any).finishRace();
      }, 200);
    },
    onSorti: () => { /* l'etat qui suit dit qui reste */ },
    onFerme: (raison: string) => {
      if (raison === 'acces') poser({ erreur: 'acces' });
      else if (etat.etape === 'connexion') poser({ erreur: 'reseau', etape: 'repos' });
      else poser({ erreur: 'fermee' });
    },
  };
}

function brancher(code: string, epreuves: string[], places: number, n: number, ouvertes: number) {
  const s = new Salle(code, ecouteurs());
  salle = s;
  brancherSalle({
    position: (d: number, c?: number) => s.position(d, c),
    fini: (ms: number) => s.fini(ms),
    // un faux depart elimine : la salle doit le savoir pour trancher
    abandon: () => s.abandon(),
  });
  poser({ ...VIDE, etape: 'connexion', code });
  // `ouvertes` : jusqu'ou ce telephone a debloque les nuits. La salle refuse
  // d'y faire entrer qui n'a pas encore la nuit qu'elle court.
  s.connecter(epreuves, etapeDuCimetiere(), places, false,
              { nuit: String(n), ouvertes: String(ouvertes) });
}

/**
 * Ouvrir une meute sur la nuit `n`, pour `places` coureurs.
 *
 * @param ouvertes la nuit la plus haute que CE telephone a debloquee : on
 *   n'ouvre une meute que sur une nuit qu'on a soi-meme.
 */
export async function ouvrirLaMeute(n: number, places: number, ouvertes: number): Promise<boolean> {
  if (n < 1 || n > ouvertes) { poser({ ...VIDE, erreur: 'verrouillee', nuitRefusee: n }); return false; }
  quitterLaMeute();
  poser({ ...VIDE, etape: 'connexion' });
  const code = await ouvrirSalle();
  if (!code) { poser({ ...VIDE, erreur: 'reseau' }); return false; }
  const p = Math.max(MEUTE_MIN, Math.min(MEUTE_MAX, Math.round(places)));
  brancher(code, [nuitDe(n).epreuve], p, n, ouvertes);
  return true;
}

/**
 * Rejoindre une meute par son code. Refuse une salle qui n'est pas une nuit :
 * le code d'un duel ordinaire ne mene pas ici.
 */
export async function rejoindreLaMeute(brut: string, ouvertes: number): Promise<boolean> {
  const code = String(brut || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length < 4) return false;
  quitterLaMeute();
  poser({ ...VIDE, etape: 'connexion', code });
  const e = await etatSalle(code);
  if (!e || !e.existe) { poser({ ...VIDE, erreur: 'introuvable' }); return false; }
  const ep = e.epreuves && e.epreuves[0];
  if (!ep || !TRACES_DE_LA_NUIT.includes(ep) || !e.nuit) {
    poser({ ...VIDE, erreur: 'pas_une_nuit' }); return false;
  }
  // UNE NUIT QU'ON N'A PAS DEBLOQUEE NE SE COURT PAS EN MEUTE : on la tient
  // seul d'abord (consigne du 18/10). La salle le refuse aussi.
  if (e.nuit > ouvertes) { poser({ ...VIDE, erreur: 'verrouillee', nuitRefusee: e.nuit }); return false; }
  if (e.complete) { poser({ ...VIDE, erreur: 'complete' }); return false; }
  if (e.depart_a) { poser({ ...VIDE, erreur: 'en_course' }); return false; }
  brancher(code, [ep], e.max || MEUTE_MAX, e.nuit, ouvertes);
  return true;
}

/** Pret, ou plus pret. C'est la salle qui fait foi. */
export function basculerPret() {
  if (!salle) return;
  if (salle.coupee && !salle.enVie()) { salle.rouvrir(true); return; }
  salle.pret(!salle.pretMoi);
}

/** Suis-je pret, d'apres la salle ? */
export function suisPret(): boolean { return !!salle?.pretMoi; }

/** Quitter la meute : la liaison se coupe, l'etat repart a zero. */
export function quitterLaMeute() {
  if (salle) { try { salle.fermer(); } catch { /* deja fermee */ } }
  salle = null;
  brancherSalle(null);
  if (etat.etape !== 'repos' || etat.erreur) poser({ ...VIDE });
}

/**
 * INVITER UN COUREUR DU TOP 500 DANS LA MEUTE.
 *
 * Le chemin du direct (game/invitations-directes.ts) : la salle ne connait que
 * le pseudonyme, le serveur trouve l'appareil, le telephone de l'invite sonne
 * et un bandeau lui propose de rejoindre. L'epreuve voyage avec — un trace
 * `nuit-*` — et c'est ce qui fait ouvrir le salon de la meute chez lui plutot
 * que celui du direct (InvitationDirecte.tsx).
 *
 * On n'invite qu'en son propre nom, et ce nom doit etre reserve (le serveur
 * le verifie) : rend 'nom' quand il ne l'est pas encore.
 */
export async function inviterDansLaMeute(nom: string): Promise<'invite' | 'injoignable' | 'nom' | 'plein'> {
  const n = nuitDeLaMeute();
  if (!salle || !etat.code || n === null) return 'injoignable';
  const max = etat.salon?.max || MEUTE_MAX;
  const pris = (etat.salon?.joueurs || []).length
    + Object.values(etat.invites).filter(v => v !== 'injoignable').length;
  if (pris >= max) return 'plein';
  if ((await nomPourLeDirect()) !== 'ok') return 'nom';
  poser({ invites: { ...etat.invites, [nom]: 'envoi' } });
  const r = await inviterEnDirect([nom], etat.code, nuitDe(n).epreuve);
  const v = r.invites.length ? 'invite' : 'injoignable';
  poser({ invites: { ...etat.invites, [nom]: v } });
  return v;
}

/* --- une invitation acceptee ailleurs dans le jeu --------------------------
   Le bandeau d'invitation vit a la racine de l'application ; le salon de la
   meute, dans le tableau des nuits. La demande passe par ici et attend que le
   tableau la prenne — comme `demanderRejoindre` pour le direct. */
let demande = '';
export function demanderLaMeute(code: string) {
  demande = String(code || '').trim().toUpperCase();
  for (const f of abonnes) { try { f(); } catch { /* idem */ } }
}
/** La demande en attente, retiree en la lisant. */
export function prendreLaDemande(): string { const c = demande; demande = ''; return c; }
export function demandeEnAttente(): string { return demande; }

/** Le lien a envoyer : le jeu, avec `?meute=CODE`. */
export function lienDeLaMeute(code: string): string {
  const u = new URL(window.location.href);
  u.search = `?meute=${encodeURIComponent(code)}`;
  u.hash = '';
  return u.toString();
}

/** Le code d'un lien `?meute=` ouvert a l'instant, ou ''. */
export function codeMeuteUrl(): string {
  try {
    const v = new URL(window.location.href).searchParams.get('meute') || '';
    return /^[A-Za-z0-9]{4,10}$/.test(v) ? v.toUpperCase() : '';
  } catch { return ''; }
}

/** Retirer `?meute=` de l'adresse une fois lu : un rechargement ne rejoint pas deux fois. */
export function nettoyerUrlMeute() {
  try {
    const u = new URL(window.location.href);
    if (!u.searchParams.has('meute')) return;
    u.searchParams.delete('meute');
    window.history.replaceState({}, '', u.toString());
  } catch { /* adresse non modifiable */ }
}

/** Le nom sous lequel on entre : celui du jeu, sinon « Anonyme ». */
export function nomDeMeute(): string { return getSavedName() || ''; }
