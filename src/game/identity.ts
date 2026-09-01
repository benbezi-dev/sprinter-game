// Identite du joueur, sans compte.
//
// Un nom appartient a qui le reserve en premier, et cette appartenance se
// prouve par un code court. C'est le strict necessaire pour relier ses
// appareils et empecher qu'on prenne son nom, sans tiers, sans e-mail et sans
// ecran de consentement.

import { getDeviceId, getSavedName, saveName } from './leaderboard';
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
  // Ce n'est pas un nom, c'est un code de recuperation. Le serveur rend le nom
  // auquel il appartient : l'ecran peut alors proposer la liaison plutot que
  // de refuser sans expliquer.
  | { etat: 'code'; name: string }
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
    if (d.est_un_code) return { etat: 'code', name: d.nom };
    if (d.pris) return { etat: 'pris' };
    return { etat: 'reseau' };
  } catch {
    return { etat: 'reseau' };
  }
}

/* --------------------------------------------------------- relier un appareil

   Taper un code a six caracteres sur un telephone, en le lisant sur l'ecran
   d'un autre appareil, est le genre de geste qui echoue une fois sur trois : on
   confond le 0 et le O, on inverse deux lettres, on recommence. Le code evite
   deja les caracteres ambigus ; le QR code evite la saisie tout court.

   Le jeton qui voyage dans le lien n'est pas le code de recuperation. Il vaut
   dix minutes, ne sert qu'une fois, et ne donne rien de plus que ce que
   l'appareil qui l'a tire pouvait deja donner. Le code permanent, lui, ne
   traverse jamais une URL — une URL se retrouve dans un historique, dans une
   capture d'ecran, dans le presse-papier de quelqu'un d'autre. */

const CLE_JETON = 'lier';

export type Transfert = { jeton: string; lien: string; expire_le: number };

/** Ouvrir une liaison depuis cet appareil, qui doit deja porter le nom. */
export async function nouveauTransfert(name: string): Promise<Transfert | null> {
  try {
    const res = await fetch(`${API_BASE}/transfert/nouveau`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: getDeviceId(), name }),
    });
    if (!res.ok) return null;
    const d = await res.json();
    if (!d.ok) return null;
    return { jeton: d.jeton, lien: lienDeTransfert(d.jeton), expire_le: d.expire_le };
  } catch {
    return null;
  }
}

/**
 * L'adresse que porte le QR code.
 *
 * Le jeton voyage dans le fragment — apres le `#` — et non dans la requete.
 * Un fragment n'est jamais envoye au serveur : il ne se retrouve donc ni dans
 * un journal d'acces, ni dans un en-tete de provenance vers un tiers. Le seul
 * a le lire est le jeu lui-meme, qui l'efface aussitot.
 */
export function lienDeTransfert(jeton: string): string {
  const base = window.location.origin + import.meta.env.BASE_URL;
  return `${base}#${CLE_JETON}=${encodeURIComponent(jeton)}`;
}

export type UtiliserResult =
  | { etat: 'lie'; name: string }
  | { etat: 'perime' | 'deja_utilise' | 'inconnu' | 'reseau' };

/** Presenter le jeton depuis le nouvel appareil. */
export async function utiliserTransfert(jeton: string): Promise<UtiliserResult> {
  try {
    const res = await fetch(`${API_BASE}/transfert/utiliser`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: getDeviceId(), jeton }),
    });
    if (!res.ok) return { etat: 'reseau' };
    const d = await res.json();
    if (d.ok) {
      keepCode(d.code);
      saveName(d.name);
      return { etat: 'lie', name: d.name };
    }
    if (d.perime) return { etat: 'perime' };
    if (d.deja_utilise) return { etat: 'deja_utilise' };
    return { etat: 'inconnu' };
  } catch {
    return { etat: 'reseau' };
  }
}

/** Le jeton present dans l'adresse au chargement, s'il y en a un. */
export function jetonDansUrl(): string {
  try {
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return (h.get(CLE_JETON) || '').trim().toUpperCase();
  } catch {
    return '';
  }
}

/** Retirer le jeton de l'adresse une fois consomme, sans recharger. */
export function nettoyerUrlJeton() {
  try {
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    h.delete(CLE_JETON);
    const reste = h.toString();
    const url = new URL(window.location.href);
    url.hash = reste ? `#${reste}` : '';
    window.history.replaceState({}, '', url.toString());
  } catch {
    // sans History API, le jeton reste affiche — il est deja consomme
  }
}

/* ------------------------------------------------- recuperer un code perdu

   Voir worker/src/identite.js pour ce qui prouve quoi. Cote jeu, il n'y a que
   trois choses a savoir : deposer la demande, montrer au joueur ce qu'il doit
   faire, et revenir voir si on lui a repondu. */

export type Recuperation =
  | { etat: 'rendu'; name: string; code: string }
  | { etat: 'attente'; insta: string | null; phrase: string | null; compte: string }
  | { etat: 'refuse' }
  | { etat: 'aucune' }
  | { etat: 'inconnu' }
  | { etat: 'reseau' };

/** Deposer une demande — ou recuperer son code tout de suite si on y a droit. */
export async function demanderRecuperation(
  name: string, indice?: string,
): Promise<Recuperation> {
  try {
    const res = await fetch(`${API_BASE}/recuperation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: getDeviceId(), name, indice: indice || '' }),
    });
    if (!res.ok) return { etat: 'reseau' };
    const d = await res.json();
    if (d.inconnu) return { etat: 'inconnu' };
    if (d.direct) { keepCode(d.code); saveName(d.name); return { etat: 'rendu', name: d.name, code: d.code }; }
    if (d.etat === 'attente') {
      return { etat: 'attente', insta: d.insta || null, phrase: d.phrase || null, compte: d.compte };
    }
    return { etat: 'reseau' };
  } catch {
    return { etat: 'reseau' };
  }
}

/** Ou en est ma demande ? Appele a l'ouverture de l'ecran, sans insister. */
export async function etatRecuperation(name: string): Promise<Recuperation> {
  try {
    const q = `device_id=${encodeURIComponent(getDeviceId())}&name=${encodeURIComponent(name)}`;
    const res = await fetch(`${API_BASE}/recuperation?${q}`);
    if (!res.ok) return { etat: 'reseau' };
    const d = await res.json();
    if (d.etat === 'accepte') {
      keepCode(d.code); saveName(d.name);
      return { etat: 'rendu', name: d.name, code: d.code };
    }
    if (d.etat === 'attente') {
      return { etat: 'attente', insta: d.insta || null, phrase: d.phrase || null, compte: d.compte };
    }
    if (d.etat === 'refuse') return { etat: 'refuse' };
    if (d.etat === 'inconnu') return { etat: 'inconnu' };
    return { etat: 'aucune' };
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
