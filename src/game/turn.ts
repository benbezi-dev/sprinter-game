// Par ou passe la voix : en droite ligne, ou par un relais.
//
// STUN ne transporte rien. Il repond une seule question — « quelle adresse le
// monde voit-il de moi ? » — et cela suffit a la plupart des paires : chacun
// annonce son adresse publique, les deux percent un trou dans leur box, et le
// son passe en direct.
//
// Cela ne suffit pas a tout le monde, et c'est la raison d'etre de ce fichier.
// Derriere un NAT symetrique — beaucoup de reseaux mobiles, presque tous les
// reseaux d'entreprise, la plupart des wifis d'hotel — la box attribue une
// adresse DIFFERENTE pour chaque destinataire. Celle qu'on a apprise de STUN
// n'est donc pas celle que verra le pair, le trou perce ne mene nulle part, et
// la connexion finit en `failed`. Pour ces joueurs, le duel se jouait muet,
// sans que rien a l'ecran n'explique pourquoi.
//
// TURN releve le son au passage : les deux pairs parlent au relais, le relais
// les met en rapport. La latence monte un peu, la facture aussi — c'est du
// trafic paye au gigaoctet — mais la voix existe.
//
// LES IDENTIFIANTS VIENNENT DU SERVEUR, ET ILS EXPIRENT. Ils ne peuvent pas
// etre poses en dur ici : ce fichier part dans le paquet web, qui se lit, et
// dans l'application, qui se desassemble. Le Worker les fabrique a la demande
// pour une heure — voir `worker/src/turn.js`, qui explique le reste.
//
// ET UN ECHEC N'EST PAS UNE PANNE. Serveur muet, service pas encore ouvert,
// joueur hors ligne : on rend la liste STUN, et le duel se joue comme avant.
// Aucun chemin de ce fichier ne rejette.

import { getDeviceId } from './leaderboard';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';

/**
 * Les serveurs de decouverte, toujours presents.
 *
 * Ils restent en tete de liste meme quand un relais est disponible : un
 * candidat direct est toujours meilleur qu'un candidat relaye, et c'est le
 * navigateur qui tranche, en essayant les deux et en gardant celui qui marche.
 * TURN ne remplace pas STUN, il le complete.
 */
const STUN: RTCIceServer[] = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' },
];

/**
 * De combien on anticipe l'expiration.
 *
 * Un identifiant qui expire pendant une allocation en cours coupe la voix au
 * milieu d'une phrase. On le renouvelle donc bien avant : cinq minutes valent
 * large devant un duel qui en dure dix au plus.
 */
const MARGE_MS = 5 * 60_000;

/**
 * Au-dela, on se passe de relais.
 *
 * La liaison audio se monte au debut de la presentation et attend cette liste
 * avant d'emettre son offre. Un serveur qui ne repond jamais retiendrait donc
 * l'offre indefiniment, et la sequence entiere se jouerait muette — pour se
 * donner une chance d'avoir un relais, on perdrait la voix a coup sur. Deux
 * secondes et demie : au-dela, STUN seul, et le duel commence.
 */
const ATTENTE_MAX_MS = 2500;

let cache: { serveurs: RTCIceServer[]; expire: number } | null = null;
let enCours: Promise<RTCIceServer[]> | null = null;

/**
 * La liste a donner a `RTCPeerConnection`, relais compris s'il y en a un.
 *
 * Le resultat est garde jusqu'a l'expiration : un joueur qui enchaine trois
 * revanches ne redemande rien. Deux appels simultanes ne font qu'une requete —
 * la presentation monte la liaison pendant que l'ecran precharge encore.
 */
export async function serveursGlace(): Promise<RTCIceServer[]> {
  if (cache && Date.now() < cache.expire) return cache.serveurs;
  if (enCours) return enCours;

  enCours = (async () => {
    try {
      const stop = new AbortController();
      const minuteur = setTimeout(() => stop.abort(), ATTENTE_MAX_MS);
      let r: Response;
      try {
        r = await fetch(`${API_BASE}/direct/turn`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_id: getDeviceId() }),
          signal: stop.signal,
        });
      } finally {
        clearTimeout(minuteur);
      }
      if (!r.ok) return STUN;

      const d = await r.json();
      const relais: RTCIceServer[] = Array.isArray(d?.iceServers) ? d.iceServers : [];
      const ttl = Number(d?.ttl) || 0;
      if (!relais.length || ttl <= 0) return STUN;

      const serveurs = [...STUN, ...relais];
      cache = {
        serveurs,
        expire: Date.now() + Math.max(0, ttl * 1000 - MARGE_MS),
      };
      return serveurs;
    } catch {
      // Hors ligne, ou serveur injoignable. On ne met rien en cache : le duel
      // suivant retentera.
      return STUN;
    } finally {
      enCours = null;
    }
  })();

  return enCours;
}

/**
 * Va chercher la liste maintenant, pour qu'elle soit la quand on en aura besoin.
 *
 * Appele en rejoignant la salle. La liaison audio se monte au debut de la
 * presentation, mille cinq cents millisecondes avant l'annonce du premier
 * athlete : un aller-retour au serveur a ce moment-la retarderait l'offre. Fait
 * a l'entree du salon, il est depuis longtemps termine.
 */
export function prechargerGlace() {
  void serveursGlace().catch(() => { /* on retentera au moment venu */ });
}
