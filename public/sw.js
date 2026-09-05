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
