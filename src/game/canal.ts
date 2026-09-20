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
 * Le raccourci RECOMMENCER, sur l'ecran d'arrivee du one shot.
 *
 * Ouvert a tout le monde : regarde tourner sur le canal de test, puis ouvert
 * a la version publique. Le drapeau vit ici plutot que dans game/reprise :
 * ce fichier-la ne contient que la regle, sans un seul import, pour que le
 * harnais puisse le charger seul et la verifier sans lancer une course. Y
 * glisser une dependance au canal casserait cela.
 */
export const RECOMMENCER_OUVERT = true;

/**
 * Le relais, et les trois autres jeux.
 *
 * Meme histoire que RECOMMENCER : eprouves sur le canal de test, puis ouverts
 * a tout le monde. Le drapeau remplace `EST_TEST` aux trois endroits qui
 * portaient ces modes — le vestiaire, la piste, et le geste vers les mondes.
 *
 * La forme compte autant qu'avant : une constante en tete d'un `&&` permet au
 * bundler de suivre. A true, le code part dans le build ; a false, il en
 * sort entierement, comme le faisait `EST_TEST`.
 */
export const RELAIS_OUVERT = true;

/**
 * La flamme des series de victoires, a cote du nom dans les duels.
 *
 * Meme histoire que RECOMMENCER et le RELAIS : regardee tourner sur le canal
 * de test, puis ouverte a tout le monde. Le serveur comptait deja la serie de
 * TOUT LE MONDE pendant ce temps — c'etait le but : ouvrir se reduit a ce
 * `true`, et les series en cours s'allument des la premiere ouverture du
 * classement, au lieu de repartir de zero le jour de l'ouverture.
 *
 * Une reserve, et elle a coute les series d'avant le 15 septembre 2026 : le
 * recalcul du classement les reconstruit depuis l'historique DEPUIS ce
 * jour-la seulement. Avant, il refaisait les lignes sans elles, et chaque
 * passage remettait toutes les flammes a zero — voir recalculerClassement
 * dans worker/src/duels.js.
 *
 * La forme compte, comme pour les deux autres : une constante en tete d'un
 * `&&` permet au bundler de suivre. A true, la flamme part dans le build ; a
 * false, elle en sort entierement.
 */
export const SERIE_OUVERTE = true;

/**
 * Le coup de poussee : ce qui part du coureur quand il reussit son geste.
 *
 * L'onde au sol sous ses appuis et l'aura sur son buste — le halo — sur une
 * reaction parfaite au pistolet ; les memes, plus sa trainee, sur une
 * transition parfaite en sortie de poussee. Le tout le temps d'un tiers de
 * seconde, et deux gestes qui ne se ressemblent pas ne se signent pas de la
 * meme image. Il remplace les trainees de
 * vitesse qui barraient l'ecran des que le coureur passait les trois quarts
 * de son maximum : elles etaient la deux images sur trois, et des traits
 * blancs suspendus en l'air se lisaient comme du vent de face plutot que
 * comme de la vitesse.
 *
 * OUVERT A TOUT LE MONDE LE 19 SEPTEMBRE 2026, comme les nouveautes avant
 * lui. Il a commence la ou elles ont commence — sur le canal de test — le
 * temps de verifier ce qui ne se voit qu'en jouant : qu'il recompense bien
 * deux gestes et non un etat, et qu'une course ordinaire n'en allume aucun.
 *
 * Le drapeau reste, et ne vaut plus `EST_TEST` : le remettre a `false`
 * eteint le declenchement, et le coureur repart sans rien qui l'accompagne.
 * C'est la seule chose a faire si l'effet devait repartir.
 *
 * Le dessin, lui, part desormais dans les deux builds. Il vit dans
 * sprinter-app.js, qui seul connait la position du coureur, et ne s'allume
 * que si l'impulsion a ete armee ici : sans elle, `partPoussee()` rend zero
 * et rien ne se dessine. Ce drapeau ferme donc le declenchement, pas le
 * dessin — voir drawOndePoussee et drawPousseeTrail.
 */
export const POUSSEE_OUVERTE = true;

/**
 * LE STARTER : « a vos marques » au 3, « pret » au 1, et le coup au signal.
 *
 * Le depart reste partout le decompte de trois secondes — c'est la consigne,
 * et l'essai d'un starter qui tirait quand il voulait (entre trois et dix
 * secondes) s'est arrete la. Ce drapeau n'ajoute qu'un personnage CALE sur le
 * chiffre : sa voix, son geste, son coup de pistolet — le prof d'ecole, livre
 * a la main, a la competition scolaire ; le juge en blanc ensuite. Il ne se
 * voit et ne s'entend que sur le canal de test, le temps qu'on decide s'il a
 * sa place dans le jeu.
 *
 * La forme compte, comme partout dans ce fichier : `EST_TEST` se replie a la
 * compilation, donc ce drapeau vaut `false` en dur dans le build public et
 * tout ce qui en depend en sort — la voix de synthese comme le dessin du
 * starter.
 */
export const DEPART_STARTER = EST_TEST;

/**
 * HURDLERS SE JOUE. Le 100 m, le 110 m et le 400 m haies, dans l'enveloppe de
 * Sprinter (game/jeux.ts).
 *
 * OUVERT A TOUT LE MONDE LE 19 SEPTEMBRE 2026. Il a vecu deux jours sur le
 * canal de test, le temps d'eprouver ce qui manquait : le bareme du 110 m,
 * ecrit au pouce plutot que deduit des proportions de Sprinter, et le dernier
 * plateau du 400 m, qui se serait sinon joue a un cheveu du record du monde
 * (voir BAREME et BAREME_PROPRE dans game/haies).
 *
 * Le drapeau reste, et ne vaut plus `EST_TEST` : le remettre a `false` referme
 * le monde sur son accueil « bientot » sans rien deranger d'autre. C'est la
 * seule chose a faire si les haies devaient repartir.
 *
 * Le code des haies partait deja dans le build public : la table des courses
 * les connait, parce qu'une quinzaine d'ecrans lisent `RACES[cle].label` sans
 * garde et qu'un lien de defi ou un duel de haies ne doit pas les faire
 * tomber. Ce drapeau fermait le chemin, pas le moteur.
 */
export const HAIES_OUVERTES = true;

/**
 * L'APPEL DECLENCHE PAR LE JOUEUR — le prototype, etape 1.
 *
 * Ce que Hurdlers a de casse aujourd'hui tient en une phrase : le joueur ne
 * saute pas. haies-pas.js choisit le pied d'appel, recale la foulee dessus et
 * garde le meilleur des appuis a portee (viser()). La cadence reste le seul
 * levier, et un harnais lui interdit meme de mal payer — « un point entier de
 * cadence ne fait jamais perdre de chrono ». Le jeu se joue donc comme
 * Sprinter, avec des haies dessinees par-dessus.
 *
 * A true, c'est le joueur qui quitte le sol : une touche par jambe d'attaque,
 * au-dessus des paves, un seul appui par haie. Le reglage automatique de la
 * foulee disparait, les frappes en vol se paient, et une haie que l'on
 * n'attaque pas se percute.
 *
 * DRAPEAU SEPARE DE HAIES_OUVERTES, et c'est le but : les haies peuvent rester
 * ouvertes pendant qu'on retouche l'appel, et inversement. Les deux ont ete
 * ouverts le meme jour, le 19 septembre 2026 — ouvrir les haies sans rendre
 * l'appel au joueur aurait publie precisement la version decrite ci-dessus,
 * celle ou il ne saute pas.
 */
export const APPEL_JOUEUR = true;

/**
 * LA NUIT DU MOLOSSE — la competition d'Halloween, edition limitee.
 *
 * Treize nuits au cimetiere municipal, un chien demoniaque derriere soi, et un
 * chrono qui descend au lieu de monter. Voir game/halloween.ts.
 *
 * DEUX CHOSES SE FERMENT ICI, ET UNE SEULE COMPTE. Ce drapeau ferme LE MODE :
 * l'accueil ne le propose plus, aucune nuit ne se lance, et le code du molosse
 * comme celui des cinematiques sort du build — la forme est celle du reste du
 * fichier, une constante en tete d'un `&&`, et le bundler la suit.
 *
 * Ce qu'il ne ferme PAS, c'est le stade. Le cimetiere municipal est un lieu
 * ouvert pour toujours, comme le Danube, et pour la meme raison ecrite dans
 * game/edition.ts : un stade qui disparait est un chrono qu'on ne peut plus
 * rejouer. C'est la BANNIERE qui est datee, pas le lieu.
 *
 * A false, le mode ne repart pas de zero pour autant : les nuits deja tenues
 * restent rangees sur l'appareil, et se retrouvent telles quelles a la
 * reouverture.
 *
 * IL VIT SUR LE CANAL DE TEST, comme toutes les nouveautes de ce jeu avant
 * lui — le relais, la poussee, les haies, la flamme des series. La forme
 * compte, et c'est celle du reste du fichier : `EST_TEST` se replie a la
 * compilation, donc ce drapeau vaut `false` EN DUR dans le build public et
 * tout ce qui en depend en sort — le molosse, les quatorze scenettes, les
 * treize nuits et le morceau de cinquante secondes.
 *
 * Ce qui reste en production, et qu'on assume : la definition du stade, qui
 * vit dans le moteur et voyage donc avec lui (voir le commentaire de la
 * boucle qui remplit LEVELS dans sprinter-app.js). Sept noms et huit chronos
 * font le voyage ; le lieu, lui, est inatteignable — aucune banniere ne le
 * propose et aucun ecran ne le lance.
 *
 * Pour ouvrir a tout le monde : `true` en dur, et rien d'autre a toucher.
 */
export const HALLOWEEN_OUVERT = EST_TEST;

/**
 * L'EDITION LIMITEE D'HALLOWEEN 2026 — treize courses, une par jour.
 *
 * DRAPEAU SEPARE DE `HALLOWEEN_OUVERT`, et c'est le but. Le premier decide si
 * « La nuit du molosse » existe ; celui-ci decide si elle est servie SOUS LA
 * FORME D'UNE EDITION DATEE — un calendrier de treize cartes, une course par
 * jour du 19 au 31 octobre, l'heure prise au serveur.
 *
 * Les deux peuvent diverger, et c'est utile : on peut ouvrir le mode sans le
 * calendrier (ce qu'il est aujourd'hui sur /test, ou les nuits s'enchainent a
 * la victoire), ou preparer le calendrier sans encore montrer le mode.
 *
 * FERME EN PRODUCTION JUSQU'A L'OUVERTURE. `EST_TEST` se replie a la
 * compilation : le drapeau vaut `false` EN DUR dans le build public, et tout
 * ce qui en depend en sort — le calendrier, les cartes, les compte-a-rebours.
 *
 * ET CE N'EST PAS SEULEMENT UNE QUESTION D'ACCES. Une edition limitee ne vaut
 * que par la surprise : treize noms de courses lisibles dans le paquet public
 * un mois avant, c'est l'edition eventee. On l'a deja paye une fois — le
 * morceau `Halloween-*.js` et sa musique de 708 Ko se telechargeaient depuis
 * le site public le 20 septembre — et les deux remedes sont en place :
 * `@__PURE__` sur les `lazy` (App.tsx) et le greffon de vite.config.ts pour
 * les assets. Ce qui est pose dans `public/`, en revanche, echappe a tout :
 * les decors de l'edition ne doivent donc PAS y aller.
 *
 * Pour ouvrir a tout le monde le 19 octobre : `true` en dur, et rien d'autre
 * a toucher. Les dates, elles, sont dans game/halloween-calendrier.ts.
 */
export const HALLOWEEN_2026_OUVERT = EST_TEST;

/**
 * LA FETE DES RECORDS — des confettis pour un record personnel, des feux
 * d'artifice pour un record du monde.
 *
 * Elle devait s'ouvrir d'elle-meme le 5 septembre 2026 a 18 h de Paris, sans
 * remise en ligne : la date voyageait dans le paquet deja chez les joueurs,
 * pour qu'aucun humain n'ait a etre devant un clavier a l'heure dite. Cette
 * date est passee. Le drapeau est donc vrai en dur, et la fonction reste parce
 * que les ecrans l'appellent.
 */
export function feteDuRecordOuverte(): boolean {
  return true;
}

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

/* ------------------------------------------------------------------ le signet
 *
 * La base de production est repliquee : une lecture part vers la copie la plus
 * proche du joueur au lieu de traverser jusqu'a Paris. Ce que cela coute, c'est
 * du retard — une copie peut avoir quelques centaines de millisecondes de
 * decalage sur la primaire.
 *
 * Ce retard ne se voit qu'a un endroit, et il s'y voit tres mal : le joueur
 * pose son chrono, ouvre le classement dans la seconde, et son temps n'y est
 * pas. Rien, a cet instant, ne distingue une copie en retard d'une course
 * perdue — et c'est la course perdue qu'il croira.
 *
 * Le serveur renvoie donc sur chaque reponse la position de lecture atteinte,
 * et il suffit de la lui representer pour qu'il choisisse une copie au moins
 * aussi a jour. C'est tout ce que fait ce qui suit : garder le dernier signet
 * recu, et le reposer sur chaque requete.
 *
 * On enveloppe `fetch` une fois, pour la raison que `brancherAcces` explique
 * plus haut : sept modules parlent au serveur, et sept endroits a modifier
 * seraient sept occasions d'en oublier un. La difference est que celle-ci
 * s'installe sur LES DEUX canaux — la production est justement celle qui est
 * repliquee.
 */
const CLE_SIGNET = 'sprinter.d1.signet';

let signet: string | null = (() => {
  try { return sessionStorage.getItem(CLE_SIGNET); } catch { return null; }
})();

export function brancherSignet() {
  const brut = window.fetch.bind(window);
  window.fetch = (async (entree: any, init?: RequestInit) => {
    const cible = typeof entree === 'string' ? entree
      : entree instanceof Request ? entree.url : String(entree?.url || entree);
    if (!cible.startsWith(API_BASE)) return brut(entree, init);

    let appel = () => brut(entree, init);
    if (signet) {
      const entetes = new Headers((init && init.headers) ||
        (entree instanceof Request ? entree.headers : undefined));
      entetes.set('X-D1-Bookmark', signet);
      appel = () => brut(entree, { ...(init || {}), headers: entetes });
    }

    const rep = await appel();

    // Un signet absent n'efface pas celui qu'on tient. Une reponse servie par
    // le cache du service worker, ou une route qui ne touche pas la base, n'en
    // porte pas — et lacher le signet a cette occasion ferait repartir la
    // requete suivante sans garantie, parfois juste apres une ecriture.
    const recu = rep.headers.get('X-D1-Bookmark');
    if (recu) {
      signet = recu;
      try { sessionStorage.setItem(CLE_SIGNET, recu); } catch { /* onglet prive */ }
    }
    return rep;
  }) as typeof window.fetch;
}
