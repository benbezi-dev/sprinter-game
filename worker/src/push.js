/* ---------------------------------------------------------------------------
   PUSH NOTIFICATIONS NATIVES
   ---------------------------------------------------------------------------
   Envoie des push notifications Web (VAPID) quand une sonnerie arrive pour
   un joueur. Fonctionne avec le Web Crypto API natif de Cloudflare Workers.

   Ce module ne chiffre PAS le payload : il envoie des pushes vides. Le jeu,
   à la réception, affiche un message générique ; c'est le clic qui ouvre
   l'app et charge le contenu réel. Cela évite l'implémentation du protocole
   de chiffrement AES-GCM + ECDH (RFC 8291), complexe et fragile à maintenir.
--------------------------------------------------------------------------- */

const VAPID_SUBJECT = 'mailto:contact@sprinter-game.com';

function base64urlToBuffer(b64url) {
  const pad = '='.repeat((4 - b64url.length % 4) % 4);
  const b64 = (b64url + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  return Uint8Array.from([...bin].map(c => c.charCodeAt(0))).buffer;
}

function bufferToBase64url(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Signe un JWT ES256 avec la clé privée VAPID (format PKCS8 base64url). */
async function vapidJwt(audience, privateKeyB64url) {
  const header  = { typ: 'JWT', alg: 'ES256' };
  const now     = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 43200, sub: VAPID_SUBJECT };

  const enc = s => btoa(JSON.stringify(s))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unsigned = `${enc(header)}.${enc(payload)}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    base64urlToBuffer(privateKeyB64url),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${bufferToBase64url(sig)}`;
}

/**
 * Envoie un push vide (sonnerie) à un abonnement Web Push.
 * Retourne true si le push est accepté, false si l'abonnement est expiré/invalide.
 */
export async function envoyerPush(subscription, vapidPrivate, vapidPublic) {
  const endpoint = subscription.endpoint;
  const origin   = new URL(endpoint).origin;
  const token    = await vapidJwt(origin, vapidPrivate);

  const resp = await fetch(endpoint, {
    method:  'POST',
    headers: {
      Authorization:   `vapid t=${token},k=${vapidPublic}`,
      TTL:             '86400',
      'Content-Length': '0',
    },
  });

  if (resp.status === 410 || resp.status === 404) return false; // abonnement révoqué
  return resp.ok || resp.status === 201;
}

/**
 * Envoie un push à tous les abonnements d'un appareil et supprime les
 * abonnements révoqués au passage.
 */
export async function notifierAppareil(db, deviceId, vapidPrivate, vapidPublic) {
  const rows = await db.prepare(
    'SELECT rowid, subscription FROM push_subscriptions WHERE device_id = ?'
  ).bind(deviceId).all();

  if (!rows.results.length) return;

  const morts = [];
  await Promise.allSettled(rows.results.map(async row => {
    let sub;
    try { sub = JSON.parse(row.subscription); } catch { morts.push(row.rowid); return; }
    const ok = await envoyerPush(sub, vapidPrivate, vapidPublic);
    if (!ok) morts.push(row.rowid);
  }));

  // Nettoyage : on ne garde pas les endpoints révoqués.
  if (morts.length) {
    await db.prepare(
      `DELETE FROM push_subscriptions WHERE rowid IN (${morts.map(() => '?').join(',')})`
    ).bind(...morts).run();
  }
}
