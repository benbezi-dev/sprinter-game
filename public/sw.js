// Service worker de Sprinter.
//
// Strategie reseau d'abord, cache en secours. Le choix est deliberé : le jeu
// est redeploye souvent, et un service worker qui sert le cache en priorite
// fige les joueurs sur une vieille version pendant des jours — c'est le piege
// classique. Ici, en ligne on a toujours la derniere version ; hors ligne on
// retombe sur la derniere page vue.
//
// Il sert aussi a rendre le jeu installable : Chrome ne propose l'ajout a
// l'ecran d'accueil que si un service worker repond aux requetes.

const CACHE = 'sprinter-v1';

// La version de CE service worker, celle qui tourne vraiment sur l'appareil.
//
// Elle existe pour une question a laquelle on ne pouvait pas repondre : le
// service worker installe sur ce telephone sait-il afficher une notification ?
// Comparer le fichier servi par le site ne le dit pas — un jeu ajoute a
// l'ecran d'accueil il y a des mois peut porter une version d'avant les
// notifications, et rien, nulle part, ne le montre. `notifications.html` la
// demande a l'installe lui-meme.
const VERSION = '2026-09-05-rotation';

// De quoi refaire un abonnement tout seul, quand le navigateur renouvelle
// celui qu'on avait. La cle publique VAPID n'est pas un secret — elle voyage
// deja dans chaque abonnement — et elle doit etre ici parce qu'un service
// worker ne peut rien lire du jeu : ni localStorage, ni les modules.
// Elle est la meme que dans src/game/push.ts, et les deux doivent le rester.
const VAPID_PUBLIC_KEY = 'BAMcLBM4VSChNqcxJz6HMuByOxuFPUaHda7yHdEiHv4-6YIaksMxDYEVNHyjyQhsRUS20dCwi0d9p4flbKp9QM0';
const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';

self.addEventListener('install', () => {
  // La nouvelle version prend la main sans attendre la fermeture des onglets.
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(noms.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

// Le contenu arrive chiffre, et le navigateur le dechiffre avant de nous le
// donner (RFC 8291 — voir worker/src/push.js). Le repli sur un texte vide
// reste : les abonnements enregistres avant que le chiffrement existe ne
// portent pas de cles, et le serveur leur envoie encore une sonnerie muette.
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* payload vide ou malformé */ }
  const title = data.title ?? 'Sprinter';
  const body  = data.body  ?? 'Il y a du nouveau.';
  const tag   = data.tag   ?? 'sprinter-notif';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:  '/icon-192.png',
      badge: '/icon-192.png',
      tag,
      renotify: true,
      // `t` est le genre de la nouvelle. Il ne sert pas a l'affichage : il
      // sert au clic, pour ouvrir le bon ecran plutot que l'accueil.
      data: { url: self.registration.scope, t: data.t || '' },
    })
  );
});

// Le clic doit mener quelque part.
//
// Sans cela, toucher la notification ouvrait le jeu sur l'ecran d'accueil et
// le defi n'apparaissait qu'au sondage suivant : on est prevenu, on ouvre, et
// il n'y a rien. Deux chemins, parce qu'il y a deux situations : une fenetre
// deja ouverte s'apprend la nouvelle par message, une fenetre a ouvrir la
// recoit dans son adresse — elle n'a pas encore de service worker a qui
// parler au moment ou elle demarre.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const genre = (event.notification.data && event.notification.data.t) || '';
  const base = (event.notification.data && event.notification.data.url)
    || self.registration.scope;

  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const w = wins.find(c => c.url.startsWith(self.registration.scope) && 'focus' in c);
    if (w) {
      try { w.postMessage({ sprinter: 'courrier', t: genre }); } catch (e) { /* fenetre partie */ }
      return w.focus();
    }
    const url = genre
      ? base + (base.includes('?') ? '&' : '?') + 'sonnerie=' + encodeURIComponent(genre)
      : base;
    return self.clients.openWindow(url);
  })());
});

/* ---------------------------------------------------------------------------
   QUAND LE NAVIGATEUR RENOUVELLE L'ABONNEMENT TOUT SEUL

   Un abonnement Web Push n'est pas acquis une fois pour toutes. Chrome le
   remplace de son propre chef — a une mise a jour, a un menage du service de
   push, si la cle VAPID du serveur change — et il ne previent qu'ici. La page
   ne le sait pas ; le serveur encore moins.

   Sans ce gestionnaire, l'ancien endpoint restait en base. Chaque defi partait
   vers un abonnement mort, Google repondait 410, et le joueur cessait d'etre
   joignable pour toujours — sans erreur a l'ecran, sans ligne dans un journal,
   sans rien. C'est la panne qui frappe d'abord ceux qui ont installe le jeu il
   y a longtemps, c'est-a-dire les joueurs les plus fideles.

   On se refait donc un abonnement, et on le porte au serveur en presentant
   l'ANCIEN endpoint : c'est lui qui designe la ligne a corriger. Le service
   worker n'a pas acces au device_id — il vit dans le localStorage du jeu — et
   n'en a pas besoin.
--------------------------------------------------------------------------- */
function cleEnOctets(base64) {
  const pad = '='.repeat((4 - base64.length % 4) % 4);
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const brut = atob(b64);
  const out = new Uint8Array(brut.length);
  for (let i = 0; i < brut.length; i++) out[i] = brut.charCodeAt(i);
  return out;
}

self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil((async () => {
    const ancien = event.oldSubscription && event.oldSubscription.endpoint;
    // Chrome donne parfois deja le nouvel abonnement ; sinon on le demande.
    let neuf = event.newSubscription || null;
    if (!neuf) {
      try {
        neuf = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: cleEnOctets(VAPID_PUBLIC_KEY),
        });
      } catch (e) { return; }   // permission retiree : il n'y a rien a sauver
    }
    // Sans l'ancien endpoint, on ne sait pas quelle ligne corriger. Le jeu
    // reparera au prochain lancement — `reprendrePush` redit toujours au
    // serveur ou joindre ce telephone.
    if (!ancien || !neuf) return;
    try {
      await fetch(API_BASE + '/push/rotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ancien_endpoint: ancien, subscription: neuf.toJSON() }),
      });
    } catch (e) { /* hors ligne : le prochain lancement du jeu reparera */ }
  })());
});

// « Quelle version es-tu ? », demandee par la page de controle. La reponse
// part par le port du message : c'est le seul canal qui atteint l'appelant et
// lui seul, sans reveiller les autres onglets.
self.addEventListener('message', event => {
  const m = event.data;
  if (!m || m.sprinter !== 'version') return;
  const port = event.ports && event.ports[0];
  if (port) { try { port.postMessage({ version: VERSION }); } catch (e) { /* parti */ } }
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // On ne s'interpose ni devant l'API du classement ni devant les polices :
  // ce sont des donnees vivantes, le cache n'y a rien a faire.
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.ok && res.type === 'basic') {
        const c = await caches.open(CACHE);
        c.put(req, res.clone());
      }
      return res;
    } catch (e) {
      const c = await caches.open(CACHE);
      const garde = await c.match(req);
      if (garde) return garde;
      // Navigation hors ligne : on rend la coquille de l'application.
      if (req.mode === 'navigate') {
        const shell = await c.match(new URL('index.html', self.registration.scope).href)
          || await c.match(self.registration.scope);
        if (shell) return shell;
      }
      throw e;
    }
  })());
});
