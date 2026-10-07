// LE COMPTE DES CARRIERES GAGNEES — la clef de la carriere Legende.
//
// La Legende ne s'ouvre qu'apres 30 carrieres classiques gagnees jusqu'au
// bout, toutes epreuves confondues (decision de l'auteur : 99 le 6 octobre
// 2026, baisse a 30 le 7).
// Gagnee jusqu'au bout, parce qu'une carriere ne se termine pas autrement :
// elle s'arrete a la premiere defaite.
//
// ET CELLES D'AVANT COMPTENT AUSSI (l'auteur, 06/10 : « on comptabilise le
// nombre de fois le mode carriere deja termine avant »). Rien ne les comptait :
// on les RETROUVE une fois, a la premiere ouverture du jeu qui porte ce
// fichier, dans ce que l'appareil a garde (`estimerLesCarrieresDAvant`). Ce
// n'est qu'un MINIMUM — l'appareil ne garde pas tout —, et il est range a part
// (`avant`) pour qu'on sache toujours ce qui a ete compte et ce qui a ete
// retrouve.
//
// IL COMPTE SUR LES DEUX CANAUX. La Legende ne se voit que sur le canal de
// test (LEGENDE_OUVERTE, canal.ts), mais le jour ou elle ouvrira, les
// carrieres courues d'ici la devront deja y etre — comme les series de duels,
// que le serveur comptait pendant que la flamme restait eteinte. Ce fichier
// n'importe rien et ne dessine rien : il part dans le build public et n'y pese
// que quelques centaines d'octets. Le harnais (tools/legende-test.mjs) le
// charge seul.
//
// SUR L'APPAREIL SEULEMENT : perdu au changement de telephone, et modifiable
// par qui ouvre la console — la meme reserve que les skins gagnes
// (game/vestiaire.ts). Le site et sa version de test vivent a la meme origine
// (sprinter-game.com et /test/) : ils partagent ce compte. L'application
// installee a le sien.

/** Le seuil d'ouverture de la Legende. */
export const CARRIERES_REQUISES = 30;

const CLE = 'sprinter_carrieres_gagnees_v1';

export type Compte = {
  /** Comptees depuis l'arrivee de ce fichier, toutes epreuves confondues. */
  total: number;
  /** Par epreuve (`RACES`), pour le jour ou l'on voudra le montrer. */
  par: Record<string, number>;
  /** Horodatage de la premiere et de la derniere carriere comptees. */
  premiere: number;
  derniere: number;
  /** Retrouvees d'avant le compte (un minimum), ou null tant qu'on n'a pas cherche. */
  avant: number | null;
};

const VIDE: Compte = { total: 0, par: {}, premiere: 0, derniere: 0, avant: null };

/** Un entier positif ou zero ; tout le reste vaut zero. */
function entier(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

export function lireCompte(): Compte {
  try {
    const d = JSON.parse(localStorage.getItem(CLE) || 'null');
    if (!d || typeof d !== 'object') return { ...VIDE, par: {} };
    const par: Record<string, number> = {};
    if (d.par && typeof d.par === 'object') {
      for (const k of Object.keys(d.par)) { const n = entier(d.par[k]); if (n) par[k] = n; }
    }
    return { total: entier(d.total), par, premiere: entier(d.premiere), derniere: entier(d.derniere),
             avant: typeof d.avant === 'number' ? entier(d.avant) : null };
  } catch {
    return { ...VIDE, par: {} };
  }
}

/**
 * Une carriere de plus, gagnee jusqu'au bout dans l'epreuve `epreuve`.
 * Rend le compte tel qu'il est apres — tel qu'il a ete ecrit, ou tel qu'il
 * aurait du l'etre si l'appareil refuse d'ecrire (navigation privee pleine).
 */
export function compterCarriere(epreuve: string, quand: number = Date.now()): Compte {
  const c = lireCompte();
  c.total += 1;
  c.par[epreuve] = (c.par[epreuve] || 0) + 1;
  if (!c.premiere) c.premiere = quand;
  c.derniere = quand;
  try { localStorage.setItem(CLE, JSON.stringify(c)); } catch { /* compte perdu, jeu intact */ }
  return c;
}

/** Toutes les carrieres gagnees : comptees, plus celles retrouvees d'avant. */
export function carrieresGagnees(): number {
  const c = lireCompte();
  return c.total + (c.avant || 0);
}

/* ------------------------------------------------ les carrieres d'avant */

/**
 * Combien de carrieres l'appareil prouve-t-il avoir ete gagnees, avant ce
 * compte ? Deux traces, et on garde la plus haute — elles se recouvrent, les
 * additionner compterait deux fois les memes :
 *
 *  - LES MEILLEURS PARCOURS (`sprinter_web_v1`, `runs`) : le cumul d'une
 *    carriere n'y entre qu'au bout de la sixieme etape gagnee, et le jeu en
 *    garde les dix meilleurs par epreuve. Un parcours = une carriere.
 *  - L'HISTORIQUE (`sprinter_history`, les 300 dernieres courses) : une
 *    sixieme etape de carriere courue plus vite que le plus rapide possible
 *    de son plateau (`plusRapide`, le bas de la fourchette de l'etape 6) est
 *    forcement gagnee. Plus lente, on ne sait pas : on ne la compte pas.
 *
 * Un joueur qui en a gagne quarante au 100 m n'en a garde que dix : c'est un
 * minimum, jamais une estimation par le haut.
 */
export function estimerLesCarrieresDAvant(plusRapide: (epreuve: string) => number | null): number {
  let parcours = 0;
  try {
    const d = JSON.parse(localStorage.getItem('sprinter_web_v1') || '{}');
    const runs = d && typeof d === 'object' ? d.runs : null;
    if (runs && typeof runs === 'object') {
      for (const k of Object.keys(runs)) {
        const l = runs[k];
        if (Array.isArray(l)) parcours += l.filter(t => typeof t === 'number' && t > 0).length;
      }
    }
  } catch { /* sauvegarde illisible : rien a retrouver la */ }

  let sixiemes = 0;
  try {
    const h = JSON.parse(localStorage.getItem('sprinter_history') || '[]');
    if (Array.isArray(h)) {
      for (const c of h) {
        if (!c || c.m === 'oneshot' || c.l !== 5 || typeof c.t !== 'number') continue;
        const lo = plusRapide(String(c.r));
        if (lo !== null && c.t < lo) sixiemes += 1;
      }
    }
  } catch { /* historique illisible : idem */ }

  return Math.max(parcours, sixiemes);
}

/**
 * Chercher les carrieres d'avant, UNE fois par appareil : a l'ouverture du jeu
 * (engine.ts), avant qu'aucune course ne soit lancee — faite pendant le sacre,
 * la recherche compterait deux fois la carriere qu'on vient de gagner. Rend le
 * nombre retrouve (0 si deja cherche).
 */
export function poserLesCarrieresDAvant(plusRapide: (epreuve: string) => number | null): number {
  const c = lireCompte();
  if (c.avant !== null) return 0;
  // Les carrieres deja comptees ici (`total`) sont peut-etre aussi parmi les
  // meilleurs parcours : on les retire, quitte a retrouver un peu moins.
  c.avant = Math.max(0, estimerLesCarrieresDAvant(plusRapide) - c.total);
  try { localStorage.setItem(CLE, JSON.stringify(c)); } catch { /* on recherchera a la prochaine ouverture */ }
  return c.avant;
}

/** La Legende est-elle gagnee au compte ? */
export function legendeMeritee(): boolean {
  return carrieresGagnees() >= CARRIERES_REQUISES;
}

// LE FORCAGE DU CANAL DE TEST. 30 carrieres gagnees, ce sont des heures de
// jeu : sans porte de service, personne ne pourrait essayer la Legende. Elle se
// force par l'adresse seulement (`?legende=99`, et `?legende=0` pour la
// refermer), retenu sur l'appareil. Le bouton ESSAYER de l'onglet a ete retire
// le 07/10 : la Legende se montre FERMEE, avec le compte qui manque (l'auteur).
// La clef a change le meme jour (`_v2`) : les appareils forces par l'ancien
// bouton la revoient fermee.
//
// CES FONCTIONS NE SONT APPELEES QUE DERRIERE `LEGENDE_OUVERTE && ...`
// (TitleScreen.tsx, Legende.tsx) : en production la condition se replie en
// `false` a la compilation et le bundler les retire — la porte n'existe pas
// hors du canal de test. Ce fichier, lui, n'importe toujours rien.
const CLE_FORCE = 'sprinter_legende_force_v2';

export function legendeForcee(): boolean {
  try {
    const q = new URLSearchParams(location.search).get('legende');
    if (q === '99') localStorage.setItem(CLE_FORCE, '1');
    else if (q === '0') localStorage.removeItem(CLE_FORCE);
    return localStorage.getItem(CLE_FORCE) === '1';
  } catch { return false; }
}

/**
 * La Legende est-elle ouverte a ce joueur : meritee (CARRIERES_REQUISES), ou forcee
 * pour l'essai. Elle NE REMPLACE PAS la carriere classique (l'auteur, 07/10) :
 * l'onglet CARRIERE propose les deux, la Legende fermee tant qu'il manque des
 * carrieres. A appeler derriere `LEGENDE_OUVERTE && ...`.
 */
export function legendeAccessible(): boolean {
  return LIBRE_SUR_LE_CANAL_DE_TEST || legendeMeritee() || legendeForcee();
}

// OUVERTE A TOUS SUR LE CANAL DE TEST, le temps de l'essayer (l'auteur,
// 07/10/2026 : « ouvre la carriere legende dans le mode test pour que je
// puisse le tester »). La Legende n'existe que la (LEGENDE_OUVERTE) : la
// regle des 30 ne s'y voit donc plus. Remettre `false` pour revoir la carte
// fermee et son compte.
const LIBRE_SUR_LE_CANAL_DE_TEST = true;

/* ------------------------------------------------ le choix de l'onglet */

/** Les deux carrieres de l'onglet CARRIERE (TitleScreen.tsx). */
export type ChoixCarriere = 'classique' | 'legende';
