// Sur quel canal tourne cette copie du jeu.
//
// Deux versions sont publiees a la meme adresse : le jeu, et une version de
// test ou tout est ouvert — duels, relais, championnats, course en direct — et
// qui recoit les nouveautes avant tout le monde.
//
// Le canal est fixe a la compilation, pas au chargement, et ce detail compte :
// `VITE_CANAL` est remplace par sa valeur litterale au moment du build, si bien
// que `EST_TEST` devient `false` en dur dans la version publique. Le bundler
// supprime alors tout ce qui en depend — les modes fermes ne sont pas caches,
// ils ne sont pas embarques. Un drapeau lu au chargement n'aurait pas cette
// propriete : le code voyagerait quand meme, lisible par qui l'ouvre.

// La forme compte : ecrit exactement ainsi, `import.meta.env.VITE_CANAL` est
// remplace par sa valeur litterale a la compilation, et la comparaison se
// replie en un simple `false` que le bundler peut suivre. Toute precaution
// autour — un `as any`, un `?.` — casse ce remplacement, la condition devient
// une expression evaluee au chargement, et tout le code des modes fermes se
// retrouve embarque en production. C'est arrive une fois : 37 Ko de WebRTC et
// d'enregistrement video partis dans le build public.
export const EST_TEST = import.meta.env.VITE_CANAL === 'test';
export const CANAL: 'production' | 'test' = EST_TEST ? 'test' : 'production';

/**
 * Le jeu tourne-t-il dans l'enveloppe native, plutot que dans un navigateur ?
 *
 * On interroge le global pose par Capacitor sans rien importer de lui : le
 * build web ne doit pas embarquer une bibliotheque native dont il n'a que faire.
 *
 * Ce que cela change n'est pas cosmetique. Une application distribuee sur
 * l'App Store ne doit pas renvoyer ses joueurs vers un autre canal
 * d'installation — une banniere « ajoute le jeu a ton ecran d'accueil depuis
 * Safari » y est a la fois absurde et un motif de rejet.
 */
export const EST_NATIF: boolean = (() => {
  try {
    const c = (window as any).Capacitor;
    if (!c) return false;
    return typeof c.isNativePlatform === 'function' ? !!c.isNativePlatform() : !!c.isNative;
  } catch {
    return false;
  }
})();

const CLE = 'sprinter_acces_test';

/** Le code d'acces range dans ce navigateur, s'il y en a un. */
export function codeAcces(): string {
  if (!EST_TEST) return '';
  try { return localStorage.getItem(CLE) || ''; } catch { return ''; }
}

export function poserCode(code: string) {
  try { localStorage.setItem(CLE, code.trim().toUpperCase()); } catch { /* refuse */ }
}

export function oublierCode() {
  try { localStorage.removeItem(CLE); } catch { /* refuse */ }
}

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';

/** Demande au serveur si ce code ouvre encore. */
export async function verifierCode(code: string): Promise<{ ok: boolean; nom?: string }> {
  try {
    const r = await fetch(`${API_BASE}/test/entrer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.trim().toUpperCase() }),
    });
    if (!r.ok) return { ok: false };
    const d = await r.json();
    return { ok: !!d.ok, nom: d.nom };
  } catch {
    return { ok: false };
  }
}

/**
 * Fait porter le code d'acces a toutes les requetes vers notre serveur.
 *
 * On enveloppe `fetch` une fois plutot que de toucher aux sept modules qui
 * parlent au serveur. Ce n'est pas de l'elegance, c'est de la surete : sept
 * endroits a modifier, c'est sept occasions d'en oublier un — et un module
 * oublie enverrait ses ecritures dans la base de production depuis la version
 * de test, ce qui est exactement l'accident qu'on cherche a rendre impossible.
 *
 * L'enveloppe ne s'installe que sur le canal de test, et n'ajoute l'en-tete
 * qu'aux requetes qui partent vers notre serveur.
 */
export function brancherAcces() {
  if (!EST_TEST) return;
  const brut = window.fetch.bind(window);
  window.fetch = ((entree: any, init?: RequestInit) => {
    const cible = typeof entree === 'string' ? entree
      : entree instanceof Request ? entree.url : String(entree?.url || entree);
    if (!cible.startsWith(API_BASE)) return brut(entree, init);

    // Demander son code n'exige pas d'en avoir un.
    if (cible.startsWith(API_BASE + '/test/')) return brut(entree, init);

    const code = codeAcces();
    // Sans code, on ne laisse rien partir. C'est le point le plus important de
    // ce fichier : une requete non marquee atterrirait dans la base de
    // production, et une partie jouee sur la version de test entrerait au vrai
    // classement. On prefere une erreur reseau a une pollution silencieuse.
    if (!code) {
      return Promise.resolve(new Response(
        JSON.stringify({ error: 'acces au canal de test requis' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      ));
    }

    const entetes = new Headers((init && init.headers) ||
      (entree instanceof Request ? entree.headers : undefined));
    entetes.set('X-Sprinter-Test', code);
    return brut(entree, { ...(init || {}), headers: entetes });
  }) as typeof window.fetch;
}

/**
 * Ajoute le code a une URL.
 *
 * Les WebSockets n'acceptent pas d'en-tetes depuis un navigateur : la salle en
 * direct et celle du relais passent donc leur code par la requete elle-meme.
 */
export function avecAcces(url: string): string {
  const code = codeAcces();
  if (!code) return url;
  return url + (url.includes('?') ? '&' : '?') + 'acces=' + encodeURIComponent(code);
}
