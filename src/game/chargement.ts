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

   L'ouverture n'attend jamais plus d'ATTENTE_MAX_MS : un reseau qui traine ne
   doit pas enfermer le joueur devant une barre de progression. Le reste se
   charge alors comme avant, au fil des courses.
--------------------------------------------------------------------------- */
import liste from 'virtual:precharge';

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
const ATTENTE_MAX_MS = 25000;
// Des requetes en vol a la fois : assez pour remplir le tuyau, pas au point
// d'affamer les requetes du jeu lui-meme (classements, profil).
const EN_VOL = 6;

let lance = false;
let fini = false;
let part = 0;
let t0 = 0;
// Ou en est le chargement, lisible depuis la console d'un telephone branche
// (globalThis.SprinterChargement) : on ne voit pas autrement si les images de
// l'ultra sont arrivees.
const etat = { phase: 'attente', faits: 0, total: 0, ultraFaits: 0, ultraTotal: 0, ultraApporte: false };
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
    const urls = liste.ordinaire;
    // le decodage du public compte pour un dixieme de la barre
    const total = urls.length / 0.9;
    etat.phase = 'ordinaire'; etat.total = urls.length;
    await telecharger(urls, () => { etat.faits++; part = Math.min(0.9, etat.faits / total); });
    etat.phase = 'public';
    await decoderLePublic();
    part = 1;
    fini = true;
    etat.phase = 'fini';

    const P = (globalThis as any).RenduPremium;
    // un appareil qui a deja perdu l'ultra n'en telecharge plus les images
    if (P && P.DENSE && P.ultraAttendu && liste.ultra.length) {
      etat.phase = 'ultra'; etat.ultraTotal = liste.ultra.length;
      await telecharger(liste.ultra, () => { etat.ultraFaits++; });
      P.apporterUltra();
      etat.ultraApporte = true;
      etat.phase = 'fini';
    }
  })();
}

/** L'ouverture peut-elle ceder la place a l'accueil ? */
export function chargementFini() {
  return fini || (lance && performance.now() - t0 > ATTENTE_MAX_MS);
}

/** La part chargee, de 0 a 1, pour la barre de l'ecran d'ouverture. */
export function partChargee() {
  return chargementFini() ? 1 : part;
}
