// Notifications push natives — abonnement et gestion de la permission.
//
// Ce module s'occupe de trois choses :
//   1. Demander la permission (une seule fois, au moment où ça a du sens)
//   2. S'abonner au service push du navigateur avec la clé VAPID publique
//   3. Envoyer l'abonnement au serveur, qui l'utilise quand une sonnerie arrive
//
// La permission n'est PAS demandée au chargement : une demande immédiate est
// refusée par réflexe. Elle se pose après une action qui en justifie le sens —
// un défi lancé, un premier résultat, quelque chose qui montre pourquoi on
// voudrait être prévenu.

import { getDeviceId } from './leaderboard';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';

// Clé publique VAPID (safe à exposer côté client).
const VAPID_PUBLIC_KEY = 'BAMcLBM4VSChNqcxJz6HMuByOxuFPUaHda7yHdEiHv4-6YIaksMxDYEVNHyjyQhsRUS20dCwi0d9p4flbKp9QM0';

// Rend un `ArrayBuffer` et non un `Uint8Array` : `applicationServerKey`
// attend un `BufferSource` adosse a un vrai `ArrayBuffer`, quand
// `Uint8Array.from` rend une vue dont le tampon peut aussi bien etre partage.
// Les deux se ressemblent a l'execution ; seul le second passe la compilation.
function cleEnOctets(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const octets = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) octets[i] = raw.charCodeAt(i);
  return octets.buffer;
}

async function enregistrerAbonnement(sub: PushSubscription): Promise<void> {
  const device = getDeviceId();
  if (!device) return;
  await fetch(`${API_BASE}/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: device, subscription: sub.toJSON() }),
  });
}

/**
 * Demande la permission et crée l'abonnement push.
 * Ne fait rien si le navigateur ne supporte pas les push ou si la permission
 * est déjà refusée.
 */
export async function activerPush(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (Notification.permission === 'denied') return;

  let permission: NotificationPermission = Notification.permission;
  if (permission !== 'granted') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') return;

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    await enregistrerAbonnement(existing);
    return;
  }

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: cleEnOctets(VAPID_PUBLIC_KEY),
  });
  await enregistrerAbonnement(sub);
}

/**
 * Supprime l'abonnement push (désactivation par le joueur).
 */
export async function desactiverPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const device = getDeviceId();
  if (device) {
    await fetch(`${API_BASE}/push/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: device }),
    }).catch(() => { /* non bloquant */ });
  }
  await sub.unsubscribe();
}

/**
 * L'abonnement est-il actif ?
 */
export async function pushActif(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  if (Notification.permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}
