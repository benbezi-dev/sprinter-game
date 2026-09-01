// Service worker du tableau de bord admin.
//
// Reseau d'abord, cache en secours — comme celui du jeu : ce tableau change
// souvent, et il ne doit jamais figer un admin sur une vieille version.
// Il sert surtout a rendre la page installable ("Ajouter au Dock" sur
// macOS/Safari) et a garder la coquille utilisable hors reseau ; les chiffres
// eux-memes viennent toujours du worker, jamais du cache applicatif.

const CACHE = 'sprinter-admin-v1';

self.addEventListener('install', () => { self.skipWaiting(); });

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(noms.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch { return; }
  // L'API du worker ne passe jamais par ce cache : ses reponses sont deja
  // mises en cache a part, dans le localStorage de la page.
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
      if (req.mode === 'navigate') {
        const shell = await c.match(new URL('index.html', self.registration.scope).href)
          || await c.match(self.registration.scope);
        if (shell) return shell;
      }
      throw e;
    }
  })());
});
