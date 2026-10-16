/* ---------------------------------------------------------------------------
   LE CHARGEMENT, A L'OUVERTURE DU JEU
   ---------------------------------------------------------------------------
   Chaque module allait chercher ses images au moment de les dessiner : les
   decors a la premiere image d'un stade, le public au coup de pistolet. Sur un
   telephone, cela se voyait — des gradins vides qui se remplissaient pendant
   la course, un spectateur a la fois, et des images lentes en plein depart.

   L'ecran d'ouverture fait donc le travail avant, en deux temps.

   1. CE QUI BLOQUE L'OUVERTURE : toutes les images des decors du palier
      ordinaire (et les affiches des panneaux) sont telechargees, puis l'atlas
      du public est DECODE. Le telechargement seul ne suffit pas pour lui :
      quatre-vingt-cinq megaoctets a decompresser, c'est ce qui laissait les
      tribunes vides au depart. On ne decode pas tous les decors : six cents
      megaoctets d'images decodees d'un coup, un telephone les rendrait en
      fermant l'onglet. Telecharges, ils s'ouvrent en un instant quand on en a
      besoin.

   2. CE QUI VIENT APRES : sur un ecran a trois pixels par point, les images
      de l'ultra se telechargent une fois le jeu ouvert, sans rien bloquer, et
      la couche de finition y monte a l'accueil (apporterUltra, dans
      rendu-premium.js) — jamais en course.

   1 BIS. PAS TOUT, SEULEMENT LA PREMIERE COURSE (14/10/2026). L'ouverture
      attendait les 1 225 images du palier ordinaire, 41 Mo — dont 605
      images et 30 Mo des nuits d'Halloween, un mode ferme en production. La
      moitie des appareils neufs partaient pendant cette attente (le tunnel du
      tableau de bord). Elle n'attend donc plus que l'ESSENTIEL : le public,
      le stade de la carriere (`day`) et celui des Jeux mondiaux (`mondiaux`,
      ou partent le one shot, les defis et les duels), le materiel, la nuit
      et les affiches — environ 5 Mo. Les autres stades se telechargent
      ENSUITE, sans rien bloquer, a l'accueil ; une course dans un stade pas
      encore arrive attend ses images avant le decompte, comme elle le
      faisait deja (stadeEnPreparation, plus bas).

      LES NUITS D'HALLOWEEN NE SE TELECHARGENT JAMAIS EN TACHE DE FOND
      (16/10). Elles partaient avec les autres stades des que le mode etait
      ouvert : 605 images et 30 Mo pour TOUS les joueurs — 75 Mo de plus a
      l'ultra sur un ecran dense —, y compris ceux qui n'ouvriront jamais le
      mode, et sur forfait mobile. Elles se demandent maintenant NUIT PAR
      NUIT, a l'ouverture du tableau des nuits : la seule serie d'angle de la
      nuit qu'on va courir, deux megaoctets et demi (prechargerLaNuit, plus
      bas).

   L'ouverture n'attend jamais plus d'ATTENTE_MAX_MS : un reseau qui traine ne
   doit pas enfermer le joueur devant une barre de progression. Le reste se
   charge alors comme avant, au fil des courses.

   3. CE QUI SE PREPARE AVANT CHAQUE COURSE (stadeEnPreparation). Tout
      decoder ici est impossible : les decors decodes pesent six cent
      quarante megaoctets au palier ordinaire, deux gigaoctets et demi a
      l'ultra, et le public se compose stade par stade — ses couleurs sont
      celles du stade. Ce qui se voit dans UNE course, en revanche, tient :
      les pieces de son stade, ses blocs, son public sous tous les caps du
      trace. Le decompte ne part donc qu'une fois tout cela pret (engine.ts).
      Mesure le 3/10/2026 sur un 400 m des Jeux mondiaux, ecran a trois
      pixels par point, processeur bride quatre fois : cinq cent trente
      images fabriquees et dix images de decor arrivees PENDANT la course —
      le public qui se completait spectateur par spectateur sous les yeux du
      joueur. La premiere course dans un stade attend son public ; les
      suivantes le retrouvent compose.

   4. CE QUI S'AVANCE A L'OUVERTURE ET A L'ACCUEIL (avancerLePublic). Ce
      public-la est le plus long a faire : sur un 400 m, toute la tribune
      sous ses vingt-six caps, mille huit cent quatre-vingt-dix-huit images,
      dix secondes d'attente au premier depart dans les memes conditions de
      mesure. On le compose donc d'avance : celui des Jeux mondiaux, ou
      partent par defaut le one-shot, les defis, les duels et le classement,
      a l'ouverture une fois les images la, puis, a l'accueil, celui du stade
      de la derniere course.

      L'OUVERTURE NE L'ATTEND PLUS (04/10, « l'animation au demarrage est
      tres longue voire bloquee »). Elle l'a attendu un jour, et sur un
      telephone le pourcentage restait a quatre-vingt-dix et quelques, le
      coureur arrete avant sa ligne, jusqu'au plafond de vingt-cinq secondes.
      Mesure processeur bride quatre fois : vingt-cinq secondes d'ouverture,
      le public toujours pas compose au bout ; et ses vingt millisecondes par
      image prises pendant les telechargements les ralentissaient d'autant
      (dix-huit secondes pour les images locales). Il ne commence donc qu'une
      fois les images la, et ce qui n'est pas fait quand l'ouverture se
      termine l'est a l'accueil, ou par l'attente d'avant le decompte, qui ne
      retient que les caps de la course qui va partir (tribune.js).

   5. LES ATHLETES EN VRAI MAILLAGE, A L'ACCUEIL (avancerLesMaillages). Les
      vedettes et leurs skins se dessinent en WebGL (game/vedette-3d.ts) :
      three.js, le contexte, le fichier, ses shaders. Demandes a la premiere
      image qui les dessinait, ils arrivaient pendant la presentation de la
      course — des a-coups sous les yeux du joueur. L'accueil les demande
      donc d'avance : ceux que game/jeux.ts dit attendus (le skin porte, les
      defis proposes), un a la fois, une fois les images de l'ouverture la
      et l'accueil installe.
--------------------------------------------------------------------------- */
import liste from 'virtual:precharge';

/** Ce que l'ouverture attend : la premiere course, ou qu'elle parte. */
const ESSENTIEL = ['/decors/tribune/', '/decors/day/', '/decors/mondiaux/',
                   '/decors/materiel/', '/decors/nuit/', '/pubs/'];
const essentiel = (u: string) => ESSENTIEL.some(d => u.startsWith(d));
/** Les nuits d'Halloween et leur materiel, au palier ordinaire comme a l'ultra. */
const halloween = (u: string) => /^\/decors(-ultra)?\/(halloween-|materiel-a\d)/.test(u);
/** Ce qui part en tache de fond : tout, sauf les nuits — elles se demandent a la nuit. */
const servi = (u: string) => !halloween(u);

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
const ATTENTE_MAX_MS = 25000;
// Des requetes en vol a la fois : assez pour remplir le tuyau, pas au point
// d'affamer les requetes du jeu lui-meme (classements, profil).
const EN_VOL = 6;

let lance = false;
let fini = false;
// l'atlas du public est decode : sa composition peut commencer
let atlasPret = false;
let part = 0;
let t0 = 0;
// Ou en est le chargement, lisible depuis la console d'un telephone branche
// (globalThis.SprinterChargement) : on ne voit pas autrement si les images de
// l'ultra sont arrivees.
const etat = { phase: 'attente', faits: 0, total: 0, ultraFaits: 0, ultraTotal: 0, ultraApporte: false,
                ensuiteFaits: 0, ensuiteTotal: 0,
                // le stade dont le public est compose d'avance, ou null
                publicAvance: null as string | null,
                // les maillages demandes d'avance, a l'accueil
                maillagesAvance: [] as string[] };
(globalThis as any).SprinterChargement = etat;

/** Telecharge `urls`, `EN_VOL` a la fois, et appelle `apres` a chacune. */
async function telecharger(urls: string[], apres: () => void) {
  let i = 0;
  const suivant = async (): Promise<void> => {
    while (i < urls.length) {
      const u = urls[i++];
      try {
        // `force-cache` : une image deja telechargee se relit du cache sans
        // redemander au serveur si elle a change. Sans lui, passe les dix
        // minutes de cache de GitHub Pages, chaque ouverture refaisait trois
        // cents allers-retours. Une image changee entre-temps, le module qui
        // la dessine la redemande de toute facon, lui.
        const r = await fetch(BASE + u, { cache: 'force-cache' });
        // lire la reponse jusqu'au bout : sinon elle n'entre pas au cache
        if (r.ok) await r.arrayBuffer();
      } catch { /* une image absente ne bloque pas les autres */ }
      apres();
    }
  };
  await Promise.all(Array.from({ length: EN_VOL }, suivant));
}

/** Decode l'atlas du public que la toile va utiliser. */
async function decoderLePublic() {
  const T = (globalThis as any).Tribune;
  if (!T || !T.pret || !T.images) return;
  T.pret();                          // cree les images de l'atlas du palier
  const ims: HTMLImageElement[] = T.images();
  await Promise.all(ims.map(im => (im.decode ? im.decode() : Promise.resolve()).catch(() => {})));
}

/** Lance le chargement ; sans effet s'il l'est deja. */
export function lancerChargement() {
  if (lance) return;
  lance = true;
  t0 = performance.now();
  (async () => {
    // L'ATLAS DU PUBLIC D'ABORD : une fois decode, le public de la premiere
    // course se compose (avancerLePublic) pendant que le reste se telecharge.
    // Le dernier, il ajoutait cinq secondes et demie a l'ouverture (mesure le
    // 3/10/2026 sur le serveur de dev).
    const dAbord = liste.ordinaire.filter(u => u.startsWith('/decors/tribune/'));
    const urls = liste.ordinaire.filter(u => essentiel(u) && !u.startsWith('/decors/tribune/'));
    const ensuite = liste.ordinaire.filter(u => !essentiel(u) && servi(u));
    const bloquants = dAbord.length + urls.length;
    // le decodage du public compte pour un dixieme de la barre
    const total = bloquants / 0.9;
    etat.phase = 'ordinaire'; etat.total = bloquants;
    const compter = () => { etat.faits++; part = Math.min(0.9, etat.faits / total); };
    await telecharger(dAbord, compter);
    etat.phase = 'public';
    await decoderLePublic();
    atlasPret = true;
    etat.phase = 'ordinaire';
    await telecharger(urls, compter);
    part = 1;
    fini = true;
    etat.phase = 'fini';

    // Les autres stades, sans rien bloquer : l'accueil est deja la.
    etat.phase = 'ensuite'; etat.ensuiteTotal = ensuite.length;
    await telecharger(ensuite, () => { etat.ensuiteFaits++; });
    etat.phase = 'fini';

    const P = (globalThis as any).RenduPremium;
    // un appareil qui a deja perdu l'ultra n'en telecharge plus les images
    const ultra = liste.ultra.filter(servi);
    if (P && P.DENSE && P.ultraAttendu && ultra.length) {
      etat.phase = 'ultra'; etat.ultraTotal = ultra.length;
      await telecharger(ultra, () => { etat.ultraFaits++; });
      P.apporterUltra();
      etat.ultraApporte = true;
      etat.phase = 'fini';
    }
  })();
}

/* ---------------------------------------------------------------------------
   UNE NUIT D'HALLOWEEN, A LA DEMANDE
   ---------------------------------------------------------------------------
   Chaque nuit se court sous sa camera (halloween-cameras.js), et la ruelle est
   rendue sous chacune d'elles : `halloween-a<deg>` pour les maisons, `materiel-
   a<deg>` pour les blocs. Le rendu prend la serie dont l'angle est le plus
   proche de la vue (serieDeLaVue, decors-stades.js) — on fait le meme choix
   ici, sur la meme liste, et on ne telecharge que celle-la.

   Appele a l'ouverture du tableau des nuits, pour la prochaine a courir, et au
   depart de chaque nuit : quand la course part, ses images sont deja la ou
   arrivent, et le decompte attend le reste comme pour tout stade
   (stadeEnPreparation). Une serie deja demandee ne se redemande pas.
--------------------------------------------------------------------------- */
const seriesDemandees = new Set<string>();

/** La serie de `base` la plus proche de `deg` parmi celles de la liste, ou null. */
function serieProche(urls: string[], racine: string, base: string, deg: number): string | null {
  const re = new RegExp('^' + racine + base + '-a([\\d.]+)/');
  let mieux: string | null = null, ecart = Infinity;
  const vus = new Set<string>();
  for (const u of urls) {
    const m = re.exec(u);
    if (!m || vus.has(m[1])) continue;
    vus.add(m[1]);
    const d = Math.abs(parseFloat(m[1]) - deg);
    if (d < ecart) { ecart = d; mieux = racine + base + '-a' + m[1] + '/'; }
  }
  return mieux;
}

/** Telecharge d'avance le decor d'une nuit vue sous `deg` degres. Sans effet s'il l'est deja. */
export function prechargerLaNuit(deg: number) {
  const P = (globalThis as any).RenduPremium;
  // l'ultra ne se demande que sur un ecran qui l'attend ou l'a deja
  const ultra = !!(P && P.DENSE && (P.ultraAttendu || etat.ultraApporte));
  const lots: string[][] = [liste.ordinaire, ...(ultra ? [liste.ultra] : [])];
  const urls: string[] = [];
  for (const l of lots) {
    const racine = l === liste.ultra ? '/decors-ultra/' : '/decors/';
    for (const base of ['halloween', 'materiel']) {
      const serie = serieProche(l, racine, base, deg);
      if (!serie || seriesDemandees.has(serie)) continue;
      seriesDemandees.add(serie);
      for (const u of l) if (u.startsWith(serie)) urls.push(u);
    }
  }
  if (urls.length) void telecharger(urls, () => { /* rien a compter */ });
}

/**
 * L'ouverture peut-elle ceder la place a l'accueil ? Quand les images sont la
 * — pas le public d'avance, qui continue a l'accueil (voir 4, plus haut).
 */
export function chargementFini() {
  return fini || (lance && performance.now() - t0 > ATTENTE_MAX_MS);
}

// Le niveau des Jeux mondiaux, ou partent par defaut le one-shot
// (ModePanels), les defis (objectif.ts), les duels (duels.ts) et le classement.
const NIVEAU_PAR_DEFAUT = 4;
let dernierNiveau: number | null = null;
// La part du public d'avance deja composee.
let partPublic = 0;
// une fois tout compose, on ne revient verifier qu'a cette heure-la
let revoirA = 0;

/** Le pistolet vient de partir : son stade est la cible de la suite. */
export function courseLancee(niveau: number) {
  dernierNiveau = niveau;
}

/**
 * COMPOSE D'AVANCE LE PUBLIC DE LA PROCHAINE COURSE PROBABLE, `ms`
 * millisecondes au plus. Appele a chaque image par engine.ts, a l'ouverture et
 * a l'accueil seulement — jamais en course ni en cinematique —, et sans effet
 * tant que les images se telechargent (voir 4, plus haut). La cible est le
 * stade de la derniere course, et avant toute course celui des Jeux mondiaux.
 * Une fois compose, l'appel ne coute qu'une lecture de table ; il reprend de
 * lui-meme si l'heure du jour change le stade ou si la montee en ultra change
 * l'atlas.
 *
 * Le temps libre du navigateur (requestIdleCallback) ne suffisait pas : le
 * jeu redessine son monde a chaque image, meme a l'accueil, et le processeur
 * n'est jamais au repos — sept images composees par seconde, mesure le
 * 3/10/2026. D'ou un budget par image, et la regle de qualite qui ne juge pas
 * ces images-la (voir composeDAvance dans rendu-premium.js).
 */
export function avancerLePublic(G: any, ms: number) {
  if (!atlasPret || !fini) return;
  const g = globalThis as any;
  const A = g.SprinterApp, T = g.Tribune, H = g.SprinterHeure;
  if (!A || !T || !T.composerDAvance || (partPublic >= 1 && performance.now() < revoirA)) return;
  const lvl = A.LEVELS && A.LEVELS[dernierNiveau ?? NIVEAU_PAR_DEFAUT];
  const brut = lvl && A.THEMES && A.THEMES[lvl.theme];
  if (!brut) return;
  // le stade tel que la course le dessinera : a l'heure (SprinterApp.theme)
  const th = H && H.eclairer ? H.eclairer(brut, G) : brut;
  const debut = performance.now();
  partPublic = T.composerDAvance(th, lvl.theme, debut + ms);
  if (partPublic >= 1) {
    etat.publicAvance = lvl.theme;
    revoirA = debut + 2000;
  } else {
    etat.publicAvance = null;
    // cette image a compose : elle ne compte pas pour la regle de qualite
    g.RenduPremium && (g.RenduPremium.composeDAvance = performance.now() + 250);
  }
}

// Le temps laisse a l'accueil pour s'installer — ses panneaux qui montent —
// avant d'y charger un maillage.
const POSE_ACCUEIL_MS = 2000;
// Chaque maillage ne se demande d'avance qu'une fois : un echec se rattrape
// a la course (game/vedette-3d.ts l'oublie, et elle le redemande).
const maillagesDemandes = new Set<string>();
let maillageEnVol = false;
let aLAccueilDepuis = 0, vuALAccueil = 0, revoirMaillagesA = 0;

/**
 * DEMANDE D'AVANCE LES MAILLAGES QUE LE JOUEUR VA VOIR (voir 5, plus haut).
 * Appele a chaque image par engine.ts, a l'accueil seulement. Un a la fois :
 * le suivant attend que le precedent ait fini de compiler ses shaders.
 * (Ses a-coups ne coutent rien a la finition premium : la regle de qualite
 * ne juge pas les images d'un maillage qui arrive, voir game/vedette-3d.ts.)
 */
export function avancerLesMaillages() {
  const g = globalThis as any;
  const maintenant = performance.now();
  // plus d'une demi-seconde sans appel : on revient a l'accueil
  if (maintenant - vuALAccueil > 500) aLAccueilDepuis = maintenant;
  vuALAccueil = maintenant;
  if (maillageEnVol || !fini || maintenant < revoirMaillagesA) return;
  if (maintenant - aLAccueilDepuis < POSE_ACCUEIL_MS) return;
  revoirMaillagesA = maintenant + 1000;
  const attendus = g.SprinterMaillagesAttendus, demander = g.SprinterDemanderMaillage;
  if (!attendus || !demander) return;
  const chemin = (attendus() as string[]).find(c => !maillagesDemandes.has(c));
  if (!chemin) return;
  maillagesDemandes.add(chemin);
  etat.maillagesAvance.push(chemin);
  maillageEnVol = true;
  Promise.resolve(demander(chemin)).catch(() => null).then(() => { maillageEnVol = false; });
}

/**
 * La course qui va partir attend-elle encore quelque chose ? Des images de
 * decor demandees et pas encore decodees (images-pretes.js), ou un public
 * dessine depuis `depuis` (performance.now()) qui n'a pas fini de se composer
 * (tribune.js).
 */
export function stadeEnPreparation(depuis: number) {
  const I = (globalThis as any).SprinterImages, T = (globalThis as any).Tribune;
  return !!((I && I.enAttente() > 0) || (T && T.enAttente && T.enAttente(depuis)));
}

/** La part chargee, de 0 a 1, pour la barre de l'ecran d'ouverture. */
export function partChargee() {
  return chargementFini() ? 1 : part;
}
