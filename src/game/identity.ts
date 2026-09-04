// Identite du joueur, sans compte.
//
// Un nom appartient a qui le reserve en premier, et cette appartenance se
// prouve par un code court. C'est le strict necessaire pour relier ses
// appareils et empecher qu'on prenne son nom, sans tiers, sans e-mail et sans
// ecran de consentement.

import { getDeviceId, getSavedName } from './leaderboard';
import { nettoyerInsta } from './insta';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';
const CODE_KEY = 'sprinter_recovery_code';

export function savedCode(): string {
  try { return localStorage.getItem(CODE_KEY) || ''; } catch { return ''; }
}
function keepCode(code: string) {
  try { localStorage.setItem(CODE_KEY, code); } catch { /* sans memoire */ }
}

export type ClaimResult =
  | { etat: 'reserve'; name: string; code: string; deja: boolean }
  | { etat: 'pris' }
  // Le joueur a colle son code de recuperation dans le champ du nom. Ce n'est
  // pas une erreur de sa part : il a perdu son nom, il a son code sous la
  // main, et le seul champ visible est celui du nom. Le serveur nous rend le
  // nom auquel ce code appartient, pour qu'on propose la liaison.
  | { etat: 'est_un_code'; nom: string }
  | { etat: 'reseau' };

/**
 * Reserve un nom. Rend le code si le nom est libre ou deja a nous ; signale
 * qu'il est pris sinon — il faudra alors le code de son proprietaire.
 */
export async function claimName(name: string): Promise<ClaimResult> {
  try {
    const res = await fetch(`${API_BASE}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: getDeviceId(), name }),
    });
    if (!res.ok) return { etat: 'reseau' };
    const d = await res.json();
    if (d.ok) { keepCode(d.code); return { etat: 'reserve', name: d.name, code: d.code, deja: !!d.deja }; }
    if (d.est_un_code) return { etat: 'est_un_code', nom: d.nom };
    if (d.pris) return { etat: 'pris' };
    return { etat: 'reseau' };
  } catch {
    return { etat: 'reseau' };
  }
}

export type LinkResult = 'lie' | 'mauvais_code' | 'inconnu' | 'reseau';

/** Relie cet appareil a un nom deja reserve, code a l'appui. */
export async function linkDevice(name: string, code: string): Promise<LinkResult> {
  try {
    const res = await fetch(`${API_BASE}/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: getDeviceId(), name, code: code.trim().toUpperCase() }),
    });
    if (!res.ok) return 'reseau';
    const d = await res.json();
    if (d.ok) { keepCode(code.trim().toUpperCase()); return 'lie'; }
    if (d.mauvais_code) return 'mauvais_code';
    if (d.inconnu) return 'inconnu';
    return 'reseau';
  } catch {
    return 'reseau';
  }
}

/**
 * Lier son compte Instagram a son nom de joueur.
 *
 * Ce n'est pas une connexion : Instagram ne nous dit rien et ne verifie rien.
 * Le joueur declare son pseudo, et le serveur controle seulement qu'il a le
 * droit d'ecrire sous ce nom — sinon on pourrait accrocher le compte de
 * quelqu'un d'autre a son propre chrono.
 *
 * L'API qui permettait une vraie connexion Instagram pour un compte personnel
 * a ete retiree par Meta fin 2024 ; ce qui subsiste ne vaut que pour les
 * comptes professionnels et demande une revue d'application. D'ou ce choix.
 *
 * On accepte le pseudo sous la forme ou le joueur l'a sous la main : avec son
 * arobase, sans, ou en collant le lien du profil. Le nettoyage se fait ici
 * avant l'envoi — le serveur refait le meme, mais autant refuser tout de
 * suite ce qui n'ira pas plutot que d'attendre un aller-retour pour le dire.
 */
export async function lierInstagram(insta: string): Promise<
  { etat: 'ok'; insta: string | null } | { etat: 'invalide' | 'pas-a-toi' | 'sans-nom' | 'erreur' }
> {
  const propre = nettoyerInsta(insta);
  if (propre === null) return { etat: 'invalide' };
  try {
    const res = await fetch(`${API_BASE}/profil`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: getDeviceId(), name: getSavedName(), insta: propre,
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) return { etat: 'ok', insta: d.insta ?? null };
    if (res.status === 403) return { etat: 'pas-a-toi' };
    if (res.status === 409) return { etat: 'sans-nom' };
    return { etat: 'invalide' };
  } catch {
    return { etat: 'erreur' };
  }
}

/** Le pseudo actuellement lie a ce nom, s'il y en a un. */
export async function instagramDe(nom: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/profil?name=${encodeURIComponent(nom)}`);
    if (!res.ok) return null;
    return (await res.json()).insta || null;
  } catch {
    return null;
  }
}

/**
 * Le lien vers un profil Instagram.
 *
 * On renettoie au passage : un pseudo enregistre avant que l'arobase soit
 * acceptee partout pourrait en avoir garde une, et « instagram.com/@moi »
 * n'ouvre aucun profil.
 */
export function lienInstagram(insta: string): string {
  const propre = nettoyerInsta(insta) || String(insta || '');
  return `https://instagram.com/${encodeURIComponent(propre)}`;
}

/* ===========================================================================
   RETROUVER SON NOM

   Deux chemins, cote jeu. Voir worker/src/identite.js pour ce que chacun
   prouve — c'est la que la question est tranchee.
   =========================================================================== */

/* ---------------------------------------------------------- le transfert
   « J'ai un telephone qui me connait deja. »

   L'appareil relie tire un jeton a usage unique, l'affiche en QR code, et le
   nouveau telephone le vise. Personne n'epelle rien.

   Le jeton voyage dans le FRAGMENT de l'adresse (#lier=), pas dans sa partie
   interrogeable (?lier=). Un fragment ne quitte jamais le navigateur : il
   n'apparait ni dans les journaux du serveur, ni dans ceux du CDN, ni dans le
   referer envoye au site suivant. Pour ce qui ouvre un nom, c'est la seule
   place acceptable dans une URL. */

export type TransfertOuvert = { jeton: string; expire_le: number; vie_ms: number };

/** Depuis un appareil deja relie : ouvrir un lien de liaison. */
export async function ouvrirTransfert(nom: string): Promise<TransfertOuvert | null> {
  try {
    const res = await fetch(`${API_BASE}/transfert/nouveau`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: getDeviceId(), name: nom }),
    });
    if (!res.ok) return null;
    const d = await res.json();
    return d.ok ? { jeton: d.jeton, expire_le: d.expire_le, vie_ms: d.vie_ms } : null;
  } catch {
    return null;
  }
}

/** L'adresse a viser, celle que porte le QR code. */
export function lienDeLiaison(jeton: string): string {
  return `${window.location.origin}${window.location.pathname}#lier=${jeton}`;
}

/** Un jeton present dans l'adresse au chargement, s'il y en a un. */
export function jetonDepuisUrl(): string {
  try {
    const m = /[#&]lier=([A-Za-z0-9]{6,12})/.exec(window.location.hash);
    return m ? m[1].toUpperCase() : '';
  } catch {
    return '';
  }
}

/**
 * Retirer le jeton de l'adresse une fois pris en compte.
 *
 * Sans cela, recharger la page rejouerait une liaison deja faite — et
 * afficherait « ce lien a deja servi » a quelqu'un qui n'a rien demande.
 */
export function oublierJetonUrl() {
  try {
    const url = new URL(window.location.href);
    url.hash = url.hash.replace(/[#&]?lier=[A-Za-z0-9]{6,12}/, '').replace(/^#$/, '');
    window.history.replaceState({}, '', url.toString());
  } catch {
    /* pas d'History API : sans consequence, le jeton est deja consomme */
  }
}

export type LiaisonResult =
  | { etat: 'lie'; name: string; code: string }
  | { etat: 'inconnu' | 'deja_utilise' | 'perime' | 'reseau' };

/** Depuis le nouveau telephone : presenter le jeton. */
export async function utiliserTransfert(jeton: string): Promise<LiaisonResult> {
  try {
    const res = await fetch(`${API_BASE}/transfert/utiliser`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: getDeviceId(), jeton }),
    });
    if (!res.ok) return { etat: 'reseau' };
    const d = await res.json();
    if (d.ok) { keepCode(d.code); return { etat: 'lie', name: d.name, code: d.code }; }
    if (d.deja_utilise) return { etat: 'deja_utilise' };
    if (d.perime) return { etat: 'perime' };
    return { etat: 'inconnu' };
  } catch {
    return { etat: 'reseau' };
  }
}

/* -------------------------------------------------------- la recuperation
   « Je n'ai plus rien. »

   Personne ne peut trancher cela automatiquement : le chrono, le rang et le
   pseudo Instagram sont affiches au TOP 500, donc connus de qui veut les
   lire. La demande est deposee, un humain decide.

   Sauf si un compte Instagram est lie au nom. Alors le serveur tire un mot de
   passage, et le joueur l'envoie en message prive au compte du jeu DEPUIS ce
   compte-la. Declarer un pseudo ne prouve rien ; ecrire depuis le compte, si.
   C'est la seule verification reelle que ce jeu puisse offrir, et c'est
   pourquoi l'ecran pousse a lier son Instagram avant d'en avoir besoin. */

export type Recuperation =
  /** L'appareil etait encore relie : il n'y avait rien a arbitrer. */
  | { etat: 'rendu'; name: string; code: string }
  | { etat: 'attente'; depuis?: number; insta: string | null; phrase: string | null; compte: string }
  | { etat: 'refuse' }
  | { etat: 'aucune' }
  | { etat: 'inconnu' }
  | { etat: 'reseau' };

/** Deposer une demande — ou recuperer son code tout de suite si on y a droit. */
export async function demanderRecuperation(nom: string, indice?: string): Promise<Recuperation> {
  try {
    const res = await fetch(`${API_BASE}/recuperation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: getDeviceId(), name: nom, indice }),
    });
    if (!res.ok) return { etat: 'reseau' };
    const d = await res.json();
    if (d.inconnu) return { etat: 'inconnu' };
    if (d.direct) { keepCode(d.code); return { etat: 'rendu', name: d.name, code: d.code }; }
    return {
      etat: 'attente', depuis: d.cree_le,
      insta: d.insta ?? null, phrase: d.phrase ?? null, compte: d.compte,
    };
  } catch {
    return { etat: 'reseau' };
  }
}

/** Ou en est ma demande ? C'est cette lecture qui delivre le code accepte. */
export async function etatRecuperation(nom: string): Promise<Recuperation> {
  try {
    const q = `device_id=${encodeURIComponent(getDeviceId())}&name=${encodeURIComponent(nom)}`;
    const res = await fetch(`${API_BASE}/recuperation?${q}`);
    if (!res.ok) return { etat: 'reseau' };
    const d = await res.json();
    if (d.etat === 'accepte') { keepCode(d.code); return { etat: 'rendu', name: d.name, code: d.code }; }
    if (d.etat === 'attente') {
      return {
        etat: 'attente', depuis: d.depuis,
        insta: d.insta ?? null, phrase: d.phrase ?? null, compte: d.compte,
      };
    }
    if (d.etat === 'refuse') return { etat: 'refuse' };
    if (d.etat === 'inconnu') return { etat: 'inconnu' };
    return { etat: 'aucune' };
  } catch {
    return { etat: 'reseau' };
  }
}

/**
 * Ouvrir la conversation avec le compte du jeu.
 *
 * Instagram n'expose aucune adresse qui preremplisse un message prive — la
 * seule chose qu'on puisse faire est d'amener le joueur sur le profil, le mot
 * de passage copie dans son presse-papiers. C'est aussi pour cela que l'ecran
 * affiche le mot en grand : il doit survivre a un aller-retour entre deux
 * applications.
 */
export function lienMessageJeu(compte: string): string {
  return `https://instagram.com/${encodeURIComponent(compte)}`;
}

/* ---------------------------------------------- la file, cote administrateur

   Celui qui tranche ne passe pas par la cle du tableau de bord. Lire des
   compteurs et rendre un nom a quelqu'un ne sont pas la meme responsabilite :
   la premiere se consulte depuis n'importe quel navigateur, la seconde ouvre
   une identite. Voir estTableau / estAdmin dans worker/src/acces.js.

   Comme pour le tableau de bord, la cle n'est pas verifiee par une route a
   part : on la presente a la file, et la reponse tranche. */

const CLE_ADMIN = 'sprinter_cle_admin';

export function cleAdmin(): string {
  try { return localStorage.getItem(CLE_ADMIN) || ''; } catch { return ''; }
}
export function poserCleAdmin(cle: string) {
  try { localStorage.setItem(CLE_ADMIN, cle); } catch { /* sans memoire */ }
}

export type DemandeRecuperation = {
  id: number;
  nom: string;
  name_key: string;
  appareil: string;
  indice: string | null;
  cree_le: number;
  etat: 'attente' | 'accepte' | 'refuse';
  tranche_le: number | null;
  nom_cree_le: number | null;
  /** De quel compte le message doit venir. */
  insta: string | null;
  /** Et quel mot il doit porter. Les deux ensemble, ou rien. */
  phrase: string | null;
  compte: string;
  appareils: number;
  courses: number;
  derniere_course: number | null;
};

export type FileRecuperations =
  | { etat: 'ok'; demandes: DemandeRecuperation[] }
  | { etat: 'refuse' | 'panne' };

export async function lireFileRecuperations(cle?: string, toutes = false): Promise<FileRecuperations> {
  const c = cle ?? cleAdmin();
  if (!c) return { etat: 'refuse' };
  try {
    const res = await fetch(`${API_BASE}/recuperations${toutes ? '?toutes=1' : ''}`, {
      headers: { 'X-Sprinter-Admin': c },
    });
    if (res.status === 404 || res.status === 403) return { etat: 'refuse' };
    if (!res.ok) return { etat: 'panne' };
    const d = await res.json();
    return { etat: 'ok', demandes: d.demandes || [] };
  } catch {
    return { etat: 'panne' };
  }
}

/** Accepter ou refuser. L'acceptation ne relie rien : c'est l'appareil
 *  demandeur qui viendra chercher sa reponse, et lui seul en profitera. */
export async function trancherRecuperation(id: number, accepte: boolean): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/recuperation/trancher`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Sprinter-Admin': cleAdmin() },
      body: JSON.stringify({ id, accepte }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------------------
   LA NATIONALITE
   ---------------------------------------------------------------------------
   Elle vit sur `/profil`, avec le pseudo Instagram, et non sous `/champ/` :
   cette porte-la est fermee en production (`championnatsOuverts` vaut
   `canal.test` cote worker), alors que l'ecran du nom tourne chez tous les
   joueurs. Un pays n'est pas une donnee de championnat — c'est ce qui permet a
   un joueur de dire d'ou il vient, des maintenant, pour des championnats qui
   viendront apres.

   Elle est OPTIONNELLE et le reste. Le serveur sait deja d'ou l'on se
   connecte — Cloudflare le voit a chaque course — mais ce qu'il voit est un
   lieu, pas une nationalite : quelqu'un qui joue depuis Bruxelles peut courir
   pour le Maroc. La detection ne sert donc qu'a proposer, jamais a decider,
   et un choix pose ici ne se fait plus jamais ecraser par elle.
--------------------------------------------------------------------------- */

export type Nation = { code: string; nom: string; continent: string | null };

/** Les pays que le jeu sait nommer. Chargés une fois, gardés. */
let nationsEnCache: Nation[] | null = null;
export async function nations(): Promise<Nation[]> {
  if (nationsEnCache) return nationsEnCache;
  try {
    const res = await fetch(`${API_BASE}/nations`);
    if (!res.ok) return [];
    nationsEnCache = (await res.json()).nations || [];
    return nationsEnCache!;
  } catch {
    return [];
  }
}

export type MonPays = {
  /** Le pays retenu, ou null si personne n'en a posé. */
  pays: string | null;
  /** 'choix' quand le joueur l'a dit, 'vu' quand ce n'est qu'une détection. */
  source: 'choix' | 'geo' | 'vu' | null;
  /** Vrai quand le pays a été choisi : il ne changera plus. */
  definitif: boolean;
};

/**
 * Le pays de ce nom, et d'où il vient.
 *
 * La `source` compte plus que le pays lui-même : elle dit à l'écran s'il doit
 * afficher un choix fait ou une simple suggestion. Les confondre reviendrait à
 * cocher une nationalité que personne n'a déclarée.
 */
export async function paysDe(nom: string): Promise<MonPays> {
  try {
    const res = await fetch(`${API_BASE}/profil?name=${encodeURIComponent(nom || '')}`);
    if (!res.ok) return { pays: null, source: null, definitif: false };
    const d = await res.json();
    return { pays: d.pays || null, source: d.source || null, definitif: d.source === 'choix' };
  } catch {
    return { pays: null, source: null, definitif: false };
  }
}

/**
 * Choisit la nationalité de ce nom. UNE FOIS.
 *
 * Le serveur refuse toute nationalité posée sur une nationalité déjà choisie.
 * Ce refus arrive en 409 — le MÊME code que « réserve d'abord ton nom », qui
 * existait avant : on tranche donc sur le message, pas sur le statut. Se fier
 * au seul 409 dirait au joueur de choisir un nom qu'il a déjà, ce qui est le
 * genre de message dont on ne se relève pas.
 */
export async function poserPays(pays: string): Promise<
  { etat: 'ok'; pays: string | null }
  | { etat: 'deja-choisi'; pays: string | null }
  | { etat: 'invalide' | 'pas-a-toi' | 'sans-nom' | 'erreur' }
> {
  try {
    const res = await fetch(`${API_BASE}/profil`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: getDeviceId(), name: getSavedName(), pays,
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) return { etat: 'ok', pays: d.pays ?? null };
    if (res.status === 403) return { etat: 'pas-a-toi' };
    if (res.status === 409) {
      const quoi = String(d.error || '');
      if (quoi.startsWith('nationalite')) return { etat: 'deja-choisi', pays: d.pays ?? null };
      return { etat: 'sans-nom' };
    }
    return { etat: 'invalide' };
  } catch {
    return { etat: 'erreur' };
  }
}
