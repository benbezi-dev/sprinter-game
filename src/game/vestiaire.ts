// LE VESTIAIRE — les skins gagnes, et celui qu'on porte.
//
// Un skin se GAGNE, il ne s'achete pas : on bat l'athlete a qui il appartient
// (game/vedettes.ts), et son corps, sa tenue et ses signes — bandeau, poignet,
// barbe — deviennent ceux du coureur du joueur.
//
// IL NE SE PORTE QUE SUR LES HAIES, POUR L'INSTANT. C'est une demande, pas une
// limite du moteur : le skin d'un hurdleur se gagne a Hurdlers et se court a
// Hurdlers. Sur le sprint, le joueur garde son maillot or. La regle tient en un
// seul endroit — `habillerLeJoueur`, appele par game/jeux.ts a chaque course
// construite — et c'est la qu'on l'elargira le jour venu.
//
// IL NE CHANGE QUE LE DESSIN. La foulee du joueur reste mesuree sur son gabarit
// (Runner.strideLength, sprinter-core.js) : un skin plus grand ne court pas
// avec moins d'appuis, et le rythme des haies ne depend pas de la tenue.
//
// AUCUN RESEAU. Ce que le joueur a gagne vit sur son appareil, comme son
// carnet d'Halloween. Les autres joueurs, en duel ou en direct, le voient avec
// l'apparence que leur jeu lui donne.

import { useSyncExternalStore } from 'react';
import { SprinterApp, SprinterCore } from './engine';
import { HAIES } from './haies.js';

/** L'epreuve se court-elle avec des haies ? (la meme question que game/jeux.ts,
 *  posee ici sans l'importer : jeux.ts importe ce module-ci.) */
const avecHaies = (cle: unknown) =>
  typeof cle === 'string' && Object.prototype.hasOwnProperty.call(HAIES, cle);

/** Les skins qu'on peut gagner : clef -> nom du coureur dans VEDETTES (sprinter-core.js). */
export const SKINS: Record<string, { coureur: string }> = {
  manga: { coureur: 'Aurel MANGA' },
};

type Etat = {
  /** Les clefs des skins gagnes. */
  gagnes: string[];
  /** Le skin porte, ou null : le maillot du joueur. */
  porte: string | null;
};

const CLE = 'sprinter_vestiaire';
const VIDE: Etat = { gagnes: [], porte: null };

function lire(): Etat {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) || 'null');
    if (!brut || typeof brut !== 'object') return VIDE;
    const gagnes = Array.isArray(brut.gagnes)
      ? brut.gagnes.filter((c: unknown) => typeof c === 'string' && SKINS[c as string])
      : [];
    // On ne porte que ce qu'on a gagne : une valeur recopiee a la main dans le
    // stockage ne suffit pas a enfiler un skin.
    const porte = typeof brut.porte === 'string' && gagnes.includes(brut.porte) ? brut.porte : null;
    return { gagnes, porte };
  } catch {
    return VIDE;
  }
}

// LU A LA PREMIERE QUESTION, PAS AU CHARGEMENT. Un appel au niveau du module
// est un effet de bord que le bundler ne sait pas retirer : l'evenement ferme
// (canal.ts, DEFI_VEDETTE_OUVERT), ce fichier serait reste dans le paquet
// public pour la seule lecture du stockage.
let lu: Etat | null = null;
const etatCourant = (): Etat => lu || (lu = lire());
const abonnes = new Set<() => void>();

function ecrire(e: Etat) {
  lu = e;
  try { localStorage.setItem(CLE, JSON.stringify(e)); } catch { /* stockage ferme */ }
  // Le coureur a l'ecran change tout de suite : l'accueil de Hurdlers montre
  // sa course, et c'est la qu'on veut voir le skin arriver.
  const G = SprinterApp.G;
  if (G && G.race) habillerLeJoueur(G.race.key);
  for (const f of abonnes) f();
}

export function skinGagne(cle: string): boolean { return etatCourant().gagnes.includes(cle); }
export function skinPorte(): string | null { return etatCourant().porte; }

/** Gagner un skin. Rend vrai s'il vient d'etre gagne, faux s'il l'etait deja. */
export function gagnerSkin(cle: string): boolean {
  const etat = etatCourant();
  if (!SKINS[cle] || etat.gagnes.includes(cle)) return false;
  ecrire({ ...etat, gagnes: [...etat.gagnes, cle] });
  return true;
}

/** Porter un skin gagne, ou `null` pour reprendre son maillot. */
export function porterSkin(cle: string | null) {
  const etat = etatCourant();
  if (cle !== null && !etat.gagnes.includes(cle)) return;
  ecrire({ ...etat, porte: cle });
}

/** L'apparence d'un skin : celle de l'athlete a qui on l'a gagne. */
export function lookDuSkin(cle: string): any | null {
  const s = SKINS[cle];
  return s ? SprinterCore.VEDETTES[s.coureur] || null : null;
}

/**
 * Habiller le coureur du joueur pour la course qu'on vient de construire.
 *
 * Le skin porte sur une course de haies, le maillot partout ailleurs. Et pas
 * sur le stade d'un defi : on ne court pas contre Aurel Manga dans la peau
 * d'Aurel Manga — il y aurait deux fois le meme homme dans deux couloirs
 * voisins, et le joueur ne saurait plus lequel il est.
 */
export function habillerLeJoueur(epreuve: unknown) {
  const G = SprinterApp.G;
  if (!G || !G.player) return;
  const lvl = SprinterApp.LEVELS && SprinterApp.LEVELS[G.levelIdx];
  const porte = etatCourant().porte;
  const look = avecHaies(epreuve) && porte && !(lvl && lvl.evenement) ? lookDuSkin(porte) : null;
  G.player.look = look || SprinterCore.PLAYER_LOOK;
}

export function useVestiaire(): Etat {
  return useSyncExternalStore(
    (l) => { abonnes.add(l); return () => { abonnes.delete(l); }; },
    etatCourant,
    etatCourant,
  );
}
