// Qui est la, et ce qu'il fait.
//
// Le classement des duels montrait des centaines de noms sans dire lesquels
// avaient le jeu ouvert. Inviter quelqu'un en direct revenait a tirer au
// hasard : l'invitation vit dix minutes, et elle tombait le plus souvent chez
// quelqu'un qui dormait.
//
// ETRE CONNECTE, C'EST ETRE LA. Une WebSocket vers l'objet de presence tant
// que le jeu est au premier plan ; elle se ferme quand il passe en arriere-
// plan, et le joueur sort de la liste. Rien d'autre a tenir a jour cote
// serveur — voir worker/src/presence.js.
//
// Sur cette liaison, le jeu ne dit qu'une chose : ce qu'il fait. On le lit dans
// l'etat du moteur toutes les deux secondes, et on ne l'envoie que s'il change.
// Le battement, lui, est repondu sans reveiller le serveur.

import { useEffect, useState } from 'react';
import { getDeviceId, getSavedName, NOM_CHANGE } from './leaderboard';
import { avecAcces, codeAcces, EST_TEST } from './canal';
import { SprinterApp } from './engine';
import { salonCourant } from './salon-direct';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';
const WS_BASE = API_BASE.replace(/^http/, 'ws');

/**
 * Ce qu'un joueur present peut etre en train de faire. `menu` est le seul etat
 * ou il est disponible tout de suite — celui qu'on cherche pour un direct.
 */
export type Activite = 'menu' | 'course' | 'duel' | 'direct' | 'championnat' | 'relais';
export type Present = { nom: string; quoi: Activite; depuis: number };
export type Presences = { n: number; joueurs: Present[]; le: number };

/** Vingt-cinq secondes, comme la boite : sous la minute que les relais tolerent. */
const BATTEMENT_MS = 25000;
/** A quel rythme on relit l'etat du moteur. Rien ne part s'il n'a pas change. */
const SONDE_MS = 2000;
/** A quel rythme les ecrans qui montrent la presence relisent la liste. */
const LECTURE_MS = 20000;

let ws: WebSocket | null = null;
let battement: any = null;
let reprise: any = null;
let sonde: any = null;
let renommer: any = null;
let echecs = 0;
let voulue = false;
/** Le nom sous lequel la liaison ouverte s'est presentee. */
let nomOuvert = '';
/** Combien de fois on a retente de faire reconnaitre un nom refuse. */
let essaisNom = 0;
let derniere: Activite = 'menu';
/**
 * Le verdict du serveur sur le nom de la liaison ouverte : reserve ET relie a
 * cet appareil, ou pas. `null` tant qu'il n'a rien dit.
 */
let reconnu: boolean | null = null;

/**
 * Ce que fait le joueur, lu dans le moteur.
 *
 * L'ordre compte : le championnat et le relais passent tous deux par la course
 * en direct (`liveOn`), il faut donc les reconnaitre avant elle. Hors de la
 * piste, un salon direct ouvert — on attend des adversaires — n'est pas un
 * menu : le joueur ne repondra pas a une autre invitation.
 */
export function activiteDuJeu(): Activite {
  const G: any = SprinterApp.G;
  const surLaPiste = G.state !== 'title' && G.state !== 'open';
  if (!surLaPiste) return salonCourant() ? 'direct' : 'menu';
  if (G.champDirect) return 'championnat';
  if (G.liveOn && G.raceKey === '4x100') return 'relais';
  if (G.liveOn) return 'direct';
  if (G.challenge || G.revanche) return 'duel';
  return 'course';
}

function arreterBattement() {
  clearInterval(battement); battement = null;
}

function fermer() {
  arreterBattement();
  const s = ws; ws = null;
  try { s?.close(1000); } catch { /* deja fermee */ }
}

function replanifier() {
  if (!voulue || reprise) return;
  const delai = Math.min(30000, 1000 * Math.pow(2, Math.min(echecs, 5)));
  reprise = setTimeout(() => { reprise = null; brancher(); }, delai);
}

function envoyerQuoi() {
  const q = activiteDuJeu();
  if (q === derniere) return;
  derniere = q;
  if (ws && ws.readyState === WebSocket.OPEN) {
    try { ws.send(JSON.stringify({ t: 'quoi', q })); } catch { /* la fermeture suivra */ }
  }
}

function brancher() {
  if (!voulue || ws) return;
  // En arriere-plan on n'est pas la : ne rien ouvrir.
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  if (EST_TEST && !codeAcces()) return;
  const appareil = getDeviceId();
  if (!appareil) return;

  const nom = (getSavedName() || '').trim();
  derniere = activiteDuJeu();
  let url = `${WS_BASE}/presence/${encodeURIComponent(appareil)}?quoi=${derniere}`;
  if (nom) url += `&nom=${encodeURIComponent(nom)}`;

  let s: WebSocket;
  try { s = new WebSocket(avecAcces(url)); }
  catch { echecs++; replanifier(); return; }
  ws = s;
  nomOuvert = nom;
  reconnu = null;

  s.onopen = () => {
    echecs = 0;
    arreterBattement();
    battement = setInterval(() => {
      try { s.send('{"t":"ping"}'); } catch { /* la fermeture suivra */ }
    }, BATTEMENT_MS);
    // L'etat a pu changer pendant l'ouverture.
    envoyerQuoi();
  };

  s.onmessage = ev => {
    let m: any;
    try { m = JSON.parse(String(ev.data)); } catch { return; }
    if (m && m.t === 'ouverte' && ws === s) reconnu = !!m.nomme;
    // LE NOM N'A PAS ETE RECONNU alors qu'on en a un. Le cas courant : il vient
    // d'etre tape, et sa reservation n'etait pas encore faite quand la liaison
    // s'est ouverte. On retente un peu plus tard, trois fois au plus — un nom
    // reserve par quelqu'un d'autre ne le deviendra jamais.
    if (m && m.t === 'ouverte' && m.nomme === false && nomOuvert && essaisNom < 3) {
      essaisNom++;
      clearTimeout(renommer);
      renommer = setTimeout(() => { if (ws === s) { fermer(); brancher(); } }, 15000 * essaisNom);
    }
  };

  s.onerror = () => { /* le close suit toujours */ };

  s.onclose = () => {
    if (ws === s) ws = null;
    arreterBattement();
    if (!voulue) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    echecs++;
    replanifier();
  };
}

/**
 * Se declarer present, et le rester tant que le jeu est au premier plan.
 *
 * Le passage en arriere-plan FERME la liaison au lieu d'attendre que le
 * systeme la coupe : un joueur parti sur WhatsApp n'est pas la, et le dire
 * tout de suite vaut mieux que de le laisser « en ligne » une minute de plus.
 */
export function ouvrirPresence() {
  if (voulue) return;
  voulue = true;
  brancher();

  sonde = setInterval(() => {
    if (!ws) return;
    // Un autre nom : la liaison se represente sous le nouveau, que le serveur
    // reverifiera. On laisse a la reservation le temps de se faire.
    const nom = (getSavedName() || '').trim();
    if (nom !== nomOuvert) {
      essaisNom = 0;
      nomOuvert = nom;
      clearTimeout(renommer);
      renommer = setTimeout(() => { fermer(); brancher(); }, 3000);
      return;
    }
    envoyerQuoi();
  }, SONDE_MS);

  const suivreVisibilite = () => {
    if (document.visibilityState === 'hidden') {
      if (reprise) { clearTimeout(reprise); reprise = null; }
      fermer();
      return;
    }
    echecs = 0;
    if (reprise) { clearTimeout(reprise); reprise = null; }
    brancher();
  };
  document.addEventListener('visibilitychange', suivreVisibilite);
  // UN NOM ENREGISTRE, MEME INCHANGE. Valider le meme nom le reserve, relier
  // l'appareil le rend sien : dans les deux cas le serveur dirait maintenant
  // oui, et la sonde ne le verrait pas puisque le texte n'a pas bouge. On se
  // represente donc apres chaque enregistrement, le temps que la reservation
  // aboutisse — sinon le point vert attendrait la tentative suivante.
  window.addEventListener(NOM_CHANGE, () => {
    essaisNom = 0;
    nomOuvert = (getSavedName() || '').trim();
    reconnu = null;
    clearTimeout(renommer);
    renommer = setTimeout(() => { fermer(); brancher(); }, 3000);
  });
  window.addEventListener('pagehide', () => fermer());
  window.addEventListener('online', () => { echecs = 0; brancher(); });
  window.addEventListener('focus', () => { if (!ws) { echecs = 0; brancher(); } });
}

/**
 * Le nom porte ici est-il reconnu par le serveur — reserve, et relie a cet
 * appareil ?
 *
 * `false` est une certitude : c'est le serveur qui l'a dit, pour CE nom.
 * `null` veut dire qu'on n'en sait rien — pas de nom, pas de liaison, ou un nom
 * change depuis — et ne doit jamais etre lu comme un non.
 */
export function nomReconnu(): boolean | null {
  const nom = (getSavedName() || '').trim();
  if (!nom || nom !== nomOuvert) return null;
  return reconnu;
}

/** Referme tout. Sert aux essais ; le jeu, lui, reste present. */
export function fermerPresence() {
  voulue = false;
  clearInterval(sonde); sonde = null;
  clearTimeout(renommer); renommer = null;
  if (reprise) { clearTimeout(reprise); reprise = null; }
  fermer();
}

/* ------------------------------------------------------------- la liste */

/** Une photo de l'instant : qui est la, et ce qu'il fait. `null` si injoignable. */
export async function lirePresences(): Promise<Presences | null> {
  if (EST_TEST && !codeAcces()) return null;
  try {
    const r = await fetch(`${API_BASE}/presence`, { cache: 'no-store' });
    if (!r.ok) return null;
    const d = await r.json();
    if (!d || !Array.isArray(d.joueurs)) return null;
    return { n: Number(d.n) || 0, joueurs: d.joueurs, le: Number(d.le) || Date.now() };
  } catch { return null; }
}

/*
 * UNE SEULE LECTURE POUR TOUS LES ECRANS. L'accueil et le classement montrent
 * la meme liste : s'ils sondaient chacun de leur cote, ouvrir l'un par-dessus
 * l'autre doublerait les requetes pour la meme photo.
 */
const abonnes = new Set<(p: Presences | null) => void>();
let photo: Presences | null = null;
let minuteur: any = null;
let enVol = false;

async function relire() {
  if (enVol) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  enVol = true;
  const p = await lirePresences();
  enVol = false;
  if (p) photo = p;
  for (const f of [...abonnes]) f(photo);
}

/** Relit tout de suite — apres une invitation, par exemple. */
export function rafraichirPresences() { void relire(); }

/**
 * La presence, pour un ecran. Rend `null` tant que rien n'est arrive.
 *
 * La lecture ne tourne que tant qu'un ecran au moins la regarde.
 */
export function usePresences(): Presences | null {
  const [p, setP] = useState<Presences | null>(photo);
  useEffect(() => {
    abonnes.add(setP);
    if (!photo || Date.now() - photo.le > 5000) void relire();
    if (!minuteur) minuteur = setInterval(() => { void relire(); }, LECTURE_MS);
    return () => {
      abonnes.delete(setP);
      if (!abonnes.size) { clearInterval(minuteur); minuteur = null; }
    };
  }, []);
  return p;
}

/** Les presents par cle de nom, pour croiser avec un classement. */
export function parNom(p: Presences | null): Map<string, Present> {
  const m = new Map<string, Present>();
  for (const j of p?.joueurs || []) m.set(String(j.nom).trim().toLowerCase(), j);
  return m;
}
