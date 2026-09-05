/* ---------------------------------------------------------------------------
   LES NOTIFICATIONS, ET LES DEUX CHEMINS QU'ELLES EMPRUNTENT
   ---------------------------------------------------------------------------
   Une sonnerie part vers un appareil par l'un ou l'autre de deux transports,
   selon la facon dont le joueur a installe le jeu :

   - WEB PUSH (VAPID), pour un navigateur : Chrome sur Android, et iPhone a
     condition que le jeu ait ete ajoute a l'ecran d'accueil depuis Safari.
     Le message part VIDE — chiffrer le contenu demande AES-GCM et un echange
     ECDH (RFC 8291), et un push vide suffit : le service worker affiche un
     texte generique, et c'est le clic qui ouvre le jeu et charge le reel.

   - FIREBASE CLOUD MESSAGING, pour l'application des magasins. Une WebView
     n'a pas d'API Push — ni WKWebView sur iOS, ni celle d'Android — et le
     chemin ci-dessus n'y existe tout simplement pas. Ici le message porte son
     titre et son texte : c'est le systeme qui l'affiche, jeu ferme.

   Un appareil peut avoir les deux (le site ET l'application). On previent les
   deux : on ignore lequel il a en main, et une notification en double vaut
   mieux qu'une notification jamais recue.

   CE QUE LE MESSAGE PORTE : le genre de la nouvelle, et rien de plus. Pas de
   nom d'adversaire, pas de chrono, pas de code. La regle vient de la boite
   (`boite.js`) et vaut ici pour la meme raison — un seul endroit dit ce qui
   s'est passe, et c'est le serveur qu'on interroge apres — mais aussi pour une
   autre : une notification s'affiche sur un ecran verrouille, que n'importe
   qui peut lire par-dessus l'epaule.
--------------------------------------------------------------------------- */

const VAPID_SUBJECT = 'mailto:contact@sprinter-game.com';

/**
 * Ce que dit chaque genre de nouvelle, dans les deux langues.
 *
 * En un seul endroit, et pas au point d'appel : les memes cinq nouvelles
 * partent depuis quatre routes differentes, et un texte recopie est un texte
 * qu'on oublie de traduire. La langue est celle que le joueur avait au moment
 * ou il s'est abonne — on ne la devine pas a l'envoi.
 */
const MESSAGES = {
  defi: {
    fr: ['Un défi pour toi', 'Quelqu\u2019un t\u2019a défié. À toi de courir.'],
    en: ['A challenge for you', 'Someone challenged you. Your turn to run.'],
  },
  direct: {
    fr: ['Un duel, maintenant', 'On t\u2019attend sur la piste. L\u2019invitation tient dix minutes.'],
    en: ['A duel, right now', 'You are expected on the track. The invitation lasts ten minutes.'],
  },
  relais: {
    fr: ['On te veut dans une équipe', 'Un relais se forme, et il manque ta réponse.'],
    en: ['A relay team wants you', 'A relay is forming, and your answer is missing.'],
  },
  duel: {
    fr: ['Ton duel est tranché', 'Quelqu\u2019un a relevé ton défi. Le résultat est là.'],
    en: ['Your duel is settled', 'Someone took your challenge. The result is in.'],
  },
  mot: {
    fr: ['Un mot pour toi', 'Le vainqueur t\u2019a laissé quelque chose.'],
    en: ['A word for you', 'The winner left you something.'],
  },
};

const DEFAUT = { fr: ['Sprinter', 'Il y a du nouveau.'], en: ['Sprinter', 'Something new.'] };

/** Le titre et le texte d'une nouvelle, dans la langue d'un abonnement. */
function messageDe(type, langue) {
  const jeu = MESSAGES[type] || DEFAUT;
  return jeu[langue === 'en' ? 'en' : 'fr'] || jeu.fr;
}

/* ------------------------------------------------------------------ outils */

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

const enJson = o => btoa(JSON.stringify(o))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/* --------------------------------------------------------------- Web Push */

/** Signe un JWT ES256 avec la cle privee VAPID (format PKCS8 base64url). */
async function vapidJwt(audience, privateKeyB64url) {
  const now     = Math.floor(Date.now() / 1000);
  const unsigned = `${enJson({ typ: 'JWT', alg: 'ES256' })}.` +
                   `${enJson({ aud: audience, exp: now + 43200, sub: VAPID_SUBJECT })}`;

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

/* -------------------------------------------------------------------------
   LE CHIFFREMENT DU CONTENU (RFC 8291, encodage aes128gcm de la RFC 8188)
   -------------------------------------------------------------------------
   Un push web peut partir vide. C'est ce qu'il faisait, et cela se voyait :
   l'ecran verrouille affichait « Sprinter » et rien d'autre. On etait
   prevenu qu'il se passait quelque chose, sans savoir quoi — ni si cela
   valait la peine de deverrouiller.

   Le contenu ne peut pas partir en clair : il transite par le service de
   push du navigateur (Google, Mozilla, Apple), qui n'a aucune raison de
   pouvoir le lire. La specification impose donc un chiffrement de bout en
   bout, dont le navigateur seul a la cle.

   Le principe tient en trois temps. Le navigateur a donne, avec son
   abonnement, une cle publique (`p256dh`) et un secret partage (`auth`). On
   fabrique une paire ephemere, on la marie a sa cle publique par un echange
   Diffie-Hellman sur courbe P-256, et on derive de ce terrain commun — avec
   `auth` comme sel — la cle et le vecteur d'un AES-128-GCM. La cle publique
   ephemere voyage en clair dans l'entete du corps ; sans la cle privee du
   navigateur, elle ne sert a rien.

   Une seule chose est fragile ici, et c'est l'ordre des octets dans les
   « info » de derivation. Une inversion ne fait pas planter : elle produit
   une cle qui a l'air valable, le service de push accepte le message, et le
   navigateur echoue silencieusement a le dechiffrer. Aucune erreur nulle
   part, aucune notification jamais. C'est pourquoi le detail est ecrit ici
   plutot que devine a la lecture.
------------------------------------------------------------------------- */

const octets = s => new TextEncoder().encode(s);

function coller(...morceaux) {
  const total = morceaux.reduce((n, m) => n + m.length, 0);
  const out = new Uint8Array(total);
  let i = 0;
  for (const m of morceaux) { out.set(m, i); i += m.length; }
  return out;
}

/** HMAC-SHA256. C'est a la fois l'extraction et l'expansion de HKDF. */
async function hmac(cle, message) {
  const k = await crypto.subtle.importKey(
    'raw', cle, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, message));
}

/** HKDF-Expand reduit a un seul tour : on ne derive jamais plus de 32 octets. */
async function hkdf(sel, ikm, info, longueur) {
  const prk = await hmac(sel, ikm);
  const bloc = await hmac(prk, coller(info, new Uint8Array([1])));
  return bloc.slice(0, longueur);
}

/**
 * Chiffre un objet JSON pour un abonnement donne.
 *
 * Rend le corps complet a poster : sel, taille d'enregistrement, cle publique
 * ephemere, puis le chiffre. C'est l'ordre impose par la RFC 8188 — le
 * navigateur relit ces champs dans cet ordre exact pour retrouver de quoi
 * dechiffrer.
 */
async function chiffrer(charge, p256dhB64, authB64) {
  const clientPub = new Uint8Array(base64urlToBuffer(p256dhB64));
  const authSecret = new Uint8Array(base64urlToBuffer(authB64));

  // La paire ephemere. Une par message : c'est elle qui rend deux
  // notifications identiques indistinguables pour qui regarde passer.
  const paire = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const serveurPub = new Uint8Array(
    await crypto.subtle.exportKey('raw', paire.publicKey));

  const clientCle = await crypto.subtle.importKey(
    'raw', clientPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const partage = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientCle }, paire.privateKey, 256));

  // « WebPush: info » puis LA CLE DU NAVIGATEUR PUIS LA NOTRE. Cet ordre-la
  // et pas l'autre : l'inverser donne une cle plausible que personne ne peut
  // lire.
  const ikm = await hkdf(
    authSecret, partage,
    coller(octets('WebPush: info'), new Uint8Array([0]), clientPub, serveurPub),
    32);

  const sel = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(sel, ikm,
    coller(octets('Content-Encoding: aes128gcm'), new Uint8Array([0])), 16);
  const nonce = await hkdf(sel, ikm,
    coller(octets('Content-Encoding: nonce'), new Uint8Array([0])), 12);

  // Le 0x02 final marque le dernier enregistrement. Sans lui, le navigateur
  // dechiffre correctement puis rejette le resultat.
  const clair = coller(octets(JSON.stringify(charge)), new Uint8Array([2]));

  const cleAes = await crypto.subtle.importKey(
    'raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const chiffre = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 }, cleAes, clair));

  // sel(16) | taille d'enregistrement(4) | longueur de la cle(1) | cle(65) | chiffre
  const taille = new Uint8Array(4);
  new DataView(taille.buffer).setUint32(0, 4096);
  return coller(sel, taille, new Uint8Array([serveurPub.length]),
                serveurPub, chiffre);
}

/**
 * Envoie une sonnerie a un abonnement Web Push.
 *
 * Avec son texte quand l'abonnement porte ses cles, vide sinon — un
 * abonnement enregistre avant que le chiffrement existe n'en a pas, et il
 * vaut mieux une notification muette qu'une notification perdue. Retourne
 * false si l'abonnement est expire ou revoque, et lui seul : une panne du
 * service de push n'est pas une raison d'oublier quelqu'un.
 */
export async function envoyerPush(subscription, vapidPrivate, vapidPublic, charge) {
  const endpoint = subscription.endpoint;
  const origin   = new URL(endpoint).origin;
  const token    = await vapidJwt(origin, vapidPrivate);

  const entetes = {
    Authorization: `vapid t=${token},k=${vapidPublic}`,
    TTL:           '86400',
  };
  let corps = null;

  const cles = subscription.keys || {};
  if (charge && cles.p256dh && cles.auth) {
    try {
      corps = await chiffrer(charge, cles.p256dh, cles.auth);
      entetes['Content-Encoding'] = 'aes128gcm';
      entetes['Content-Type']     = 'application/octet-stream';
    } catch {
      corps = null;               // on retombe sur la sonnerie muette
    }
  }
  if (!corps) entetes['Content-Length'] = '0';

  const resp = await fetch(endpoint, { method: 'POST', headers: entetes, body: corps });

  if (resp.status === 410 || resp.status === 404) return false; // abonnement revoque
  return resp.ok || resp.status === 201;
}

/**
 * Envoie un push a tous les abonnements web d'un appareil et supprime les
 * abonnements revoques au passage.
 */
async function notifierWeb(db, deviceId, type, vapidPrivate, vapidPublic) {
  const rows = await db.prepare(
    'SELECT rowid, subscription, langue FROM push_subscriptions WHERE device_id = ?'
  ).bind(deviceId).all();

  if (!rows.results.length) return;

  const morts = [];
  await Promise.allSettled(rows.results.map(async row => {
    let sub;
    try { sub = JSON.parse(row.subscription); } catch { morts.push(row.rowid); return; }
    const [titre, corps] = messageDe(type, row.langue);
    // `t` est le genre de la nouvelle : c'est lui qui, au clic, ouvre le bon
    // ecran plutot que l'accueil. Meme vocabulaire que la boite et que FCM.
    const ok = await envoyerPush(sub, vapidPrivate, vapidPublic,
                                 { title: titre, body: corps, t: type, tag: 'sprinter-' + type });
    if (!ok) morts.push(row.rowid);
  }));

  // Nettoyage : on ne garde pas les endpoints revoques.
  if (morts.length) {
    await db.prepare(
      `DELETE FROM push_subscriptions WHERE rowid IN (${morts.map(() => '?').join(',')})`
    ).bind(...morts).run();
  }
}

/* ------------------------------------------------- Firebase Cloud Messaging */

/**
 * Le jeton d'acces Google, garde en memoire tant qu'il vaut.
 *
 * Il dure une heure, et l'obtenir coute une signature RSA plus un aller-retour
 * vers oauth2.googleapis.com. Le refaire a chaque notification ajouterait ce
 * temps-la a chaque defi lance. La variable vit dans l'isolat : elle disparait
 * quand Cloudflare le recycle, et on la refait alors — c'est exactement le
 * comportement voulu, un cache sans invalidation a tenir.
 */
let jetonGoogle = { valeur: '', expire: 0 };

/** Le compte de service, lu une fois depuis le secret. Rend null s'il manque. */
function compteDeService(env) {
  if (!env || !env.FCM_COMPTE_SERVICE) return null;
  try {
    const c = typeof env.FCM_COMPTE_SERVICE === 'string'
      ? JSON.parse(env.FCM_COMPTE_SERVICE) : env.FCM_COMPTE_SERVICE;
    if (!c.client_email || !c.private_key || !c.project_id) return null;
    return c;
  } catch { return null; }
}

/** Le PEM d'une cle privee, en octets. */
function pemEnOctets(pem) {
  const corps = String(pem)
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(corps);
  return Uint8Array.from([...bin].map(c => c.charCodeAt(0))).buffer;
}

async function jetonAcces(compte) {
  const maintenant = Math.floor(Date.now() / 1000);
  // Cinq minutes de marge : un jeton qui expire pendant l'aller-retour vers
  // FCM rend un 401 qu'on ne saurait pas distinguer d'une cle revoquee.
  if (jetonGoogle.valeur && jetonGoogle.expire > maintenant + 300) return jetonGoogle.valeur;

  const aud = 'https://oauth2.googleapis.com/token';
  const unsigned = `${enJson({ alg: 'RS256', typ: 'JWT' })}.` + enJson({
    iss: compte.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud,
    iat: maintenant,
    exp: maintenant + 3600,
  });

  const cle = await crypto.subtle.importKey(
    'pkcs8',
    pemEnOctets(compte.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cle, new TextEncoder().encode(unsigned));

  const rep = await fetch(aud, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${bufferToBase64url(sig)}`,
    }),
  });
  if (!rep.ok) throw new Error('jeton Google refuse : ' + rep.status);
  const d = await rep.json();
  jetonGoogle = {
    valeur: d.access_token,
    expire: maintenant + (Number(d.expires_in) || 3600),
  };
  return jetonGoogle.valeur;
}

/**
 * Envoie une notification a un jeton FCM.
 *
 * Rend false quand le jeton ne designe plus rien — application desinstallee,
 * donnees effacees, jeton remplace. C'est le seul cas ou l'appelant doit
 * oublier la ligne : un 500 de Google, lui, n'est qu'une panne passagere.
 */
async function envoyerFcm(acces, projet, jeton, titre, corps, type) {
  const rep = await fetch(
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projet)}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${acces}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: jeton,
          notification: { title: titre, body: corps },
          // Le genre de la nouvelle, pour que le jeu ouvre le bon ecran quand
          // on touche la notification. Meme vocabulaire que la boite.
          data: { t: String(type) },
          android: {
            priority: 'HIGH',
            notification: { sound: 'default', default_vibrate_timings: true },
          },
          apns: {
            headers: { 'apns-priority': '10' },
            payload: { aps: { sound: 'default' } },
          },
        },
      }),
    },
  );

  if (rep.ok) return true;
  if (rep.status === 404) return false;                 // UNREGISTERED
  if (rep.status === 400) {                             // jeton malforme
    let texte = '';
    try { texte = await rep.text(); } catch { /* peu importe */ }
    return !/INVALID_ARGUMENT|registration token/i.test(texte);
  }
  return true;   // 401, 429, 5xx : une panne, pas un jeton mort
}

/** Previent tous les appareils natifs d'un joueur, et oublie les jetons morts. */
async function notifierNatif(db, deviceId, type, compte) {
  let lignes;
  try {
    const r = await db.prepare(
      'SELECT jeton, langue FROM push_jetons WHERE device_id = ?'
    ).bind(deviceId).all();
    lignes = r.results || [];
  } catch { return; }              // table pas encore creee : rien a prevenir
  if (!lignes.length) return;

  const acces = await jetonAcces(compte);
  const morts = [];
  await Promise.allSettled(lignes.map(async l => {
    const [titre, corps] = messageDe(type, l.langue);
    let vivant = true;
    try { vivant = await envoyerFcm(acces, compte.project_id, l.jeton, titre, corps, type); }
    catch { vivant = true; }       // une panne reseau n'est pas un jeton mort
    if (!vivant) morts.push(l.jeton);
  }));

  if (morts.length) {
    await db.prepare(
      `DELETE FROM push_jetons WHERE jeton IN (${morts.map(() => '?').join(',')})`
    ).bind(...morts).run();
  }
}

/* ----------------------------------------------------------------- l'entree */

/**
 * Previent un appareil, par tous les transports dont il dispose.
 *
 * Ne leve jamais et n'attend rien de personne : un transport mal configure —
 * pas de cle VAPID, pas de compte de service — est simplement saute. C'est ce
 * qui permet de deployer le serveur avant d'avoir les cles, et de brancher
 * l'un puis l'autre sans toucher au code qui appelle.
 */
export async function notifierAppareil(db, deviceId, type, env) {
  if (!db || !deviceId) return;

  const travaux = [];
  if (env && env.VAPID_PRIVATE_KEY && env.VAPID_PUBLIC_KEY) {
    travaux.push(notifierWeb(db, deviceId, type, env.VAPID_PRIVATE_KEY, env.VAPID_PUBLIC_KEY));
  }
  const compte = compteDeService(env);
  if (compte) travaux.push(notifierNatif(db, deviceId, type, compte));

  await Promise.allSettled(travaux);
}
