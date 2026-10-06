// LE COMPTE DES CARRIERES GAGNEES — la clef de la carriere Legende.
//
// La Legende ne s'ouvre qu'apres 99 carrieres classiques gagnees jusqu'au
// bout, toutes epreuves confondues (decision de l'auteur, 6 octobre 2026).
// Gagnee jusqu'au bout, parce qu'une carriere ne se termine pas autrement :
// elle s'arrete a la premiere defaite. Rien ne les comptait — `G.runs` ne
// garde que les dix meilleurs cumuls par epreuve —, si bien que ce compte part
// de zero pour tout le monde, le jour ou il arrive sur l'appareil.
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
export const CARRIERES_REQUISES = 99;

const CLE = 'sprinter_carrieres_gagnees_v1';

export type Compte = {
  /** Toutes epreuves confondues : c'est lui qui ouvre la Legende. */
  total: number;
  /** Par epreuve (`RACES`), pour le jour ou l'on voudra le montrer. */
  par: Record<string, number>;
  /** Horodatage de la premiere et de la derniere carriere comptees. */
  premiere: number;
  derniere: number;
};

const VIDE: Compte = { total: 0, par: {}, premiere: 0, derniere: 0 };

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
    return { total: entier(d.total), par, premiere: entier(d.premiere), derniere: entier(d.derniere) };
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

export function carrieresGagnees(): number {
  return lireCompte().total;
}

/** La Legende est-elle gagnee au compte ? */
export function legendeMeritee(): boolean {
  return carrieresGagnees() >= CARRIERES_REQUISES;
}

// LE FORCAGE DU CANAL DE TEST. 99 carrieres gagnees, ce sont des heures de
// jeu : sans porte de service, personne ne pourrait essayer la Legende. Elle se
// force d'un bouton (ESSAYER, onglet CARRIERE) ou par l'adresse (`?legende=99`,
// et `?legende=0` pour la refermer), retenu sur l'appareil.
//
// CES FONCTIONS NE SONT APPELEES QUE DERRIERE `LEGENDE_OUVERTE && ...`
// (TitleScreen.tsx, Legende.tsx) : en production la condition se replie en
// `false` a la compilation et le bundler les retire — la porte n'existe pas
// hors du canal de test. Ce fichier, lui, n'importe toujours rien.
const CLE_FORCE = 'sprinter_legende_force';

export function legendeForcee(): boolean {
  try {
    const q = new URLSearchParams(location.search).get('legende');
    if (q === '99') localStorage.setItem(CLE_FORCE, '1');
    else if (q === '0') localStorage.removeItem(CLE_FORCE);
    return localStorage.getItem(CLE_FORCE) === '1';
  } catch { return false; }
}

export function forcerLaLegende(): void {
  try { localStorage.setItem(CLE_FORCE, '1'); } catch { /* stockage ferme */ }
}

/**
 * LA LEGENDE REMPLACE LA CARRIERE CLASSIQUE une fois celle-ci gagnee 99 fois
 * (decision de l'auteur, 06/10/2026) : l'onglet CARRIERE de Sprinter ne
 * propose plus que la Legende. A appeler derriere `LEGENDE_OUVERTE && ...`.
 */
export function legendeRemplaceLaCarriere(): boolean {
  return legendeMeritee() || legendeForcee();
}
