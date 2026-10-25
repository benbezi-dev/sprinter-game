// LE VESTIAIRE — les skins gagnes, et celui qu'on porte.
//
// Un skin se GAGNE, il ne s'achete pas : on bat l'athlete a qui il appartient
// (game/vedettes.ts), et son corps, sa tenue et ses signes — bandeau, poignet,
// barbe — deviennent ceux du coureur du joueur.
//
// CHAQUE SKIN SE PORTE LA OU IL S'EST GAGNE. C'est une demande, pas une limite
// du moteur : le skin d'un hurdleur se gagne a Hurdlers et se court a
// Hurdlers ; celui d'un sprinteur se gagne au sprint et se court sur le plat
// (`surHaies`). Ailleurs, le joueur garde son maillot or. La regle tient en un
// seul endroit — `habillerLeJoueur`, appele par game/jeux.ts a chaque course
// construite.
//
// IL NE CHANGE QUE LE DESSIN. La foulee du joueur reste mesuree sur son gabarit
// (Runner.strideLength, sprinter-core.js) : un skin plus grand ne court pas
// avec moins d'appuis, et le rythme des haies ne depend pas de la tenue.
//
// LES TENUES (voir TENUES) : des couleurs de kit sur le corps du joueur, qui
// se portent partout. Un skin porte passe devant, sur ses courses ; ailleurs,
// c'est la tenue choisie qui habille le joueur, et non plus le seul maillot or.
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

/**
 * Les skins qu'on peut gagner : clef -> nom du coureur dans VEDETTES
 * (sprinter-core.js), et ou il se porte — sur les haies, ou sur le plat.
 */
export const SKINS: Record<string, { coureur: string; surHaies: boolean }> = {
  manga: { coureur: 'Aurel MANGA', surHaies: true },
  // Le skin premium de l'evenement special du sprint : son corps, sa foulee,
  // son rituel dans les blocs et son clap (VEDETTES, sprinter-core.js).
  meba: { coureur: 'Méba-Mickaël ZÉZÉ', surHaies: false },
};

/**
 * LES TENUES (20/10, premiere serie, a l'essai) : des couleurs de kit pour le
 * coureur du joueur — maillot, short, pointes, et parfois un bandeau ou un
 * poignet. A la difference d'un skin, une tenue garde SON corps : seul le
 * dessin change, et elle se porte sur toutes les courses. Elles sont libres
 * pour l'instant ; c'est sur elles que se jugera ce qui vaut d'etre vendu.
 *
 * `or` est le maillot historique (PLAYER_LOOK, sprinter-core.js) : c'est la
 * tenue de qui n'en a pas choisi.
 */
type Rgb = [number, number, number];
export type Tenue = {
  nom: [string, string];
  jersey: Rgb; shorts: Rgb; shoe: Rgb;
  bandeau?: Rgb;
  poignet?: { col: Rgb; cote: 1 | -1 };
};
export const TENUES: Record<string, Tenue> = {
  or: { nom: ['OR', 'GOLD'], jersey: [248, 205, 74], shorts: [38, 40, 68], shoe: [250, 250, 255] },
  eclair: { nom: ['ÉCLAIR', 'LIGHTNING'], jersey: [36, 104, 236], shorts: [236, 240, 248],
            shoe: [214, 240, 44], bandeau: [236, 240, 248] },
  volcan: { nom: ['VOLCAN', 'VOLCANO'], jersey: [214, 44, 48], shorts: [22, 22, 28],
            shoe: [250, 132, 36], poignet: { col: [22, 22, 28], cote: 1 } },
  neon: { nom: ['NÉON', 'NEON'], jersey: [44, 46, 60], shorts: [26, 26, 34],
          shoe: [72, 250, 120], bandeau: [72, 250, 120], poignet: { col: [72, 250, 120], cote: -1 } },
};
const TENUE_PAR_DEFAUT = 'or';

type Etat = {
  /** Les clefs des skins gagnes. */
  gagnes: string[];
  /** Le skin porte, ou null : le maillot du joueur. */
  porte: string | null;
  /** La tenue portee quand aucun skin ne s'applique. */
  tenue: string;
};

const CLE = 'sprinter_vestiaire';
const VIDE: Etat = { gagnes: [], porte: null, tenue: TENUE_PAR_DEFAUT };

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
    const tenue = typeof brut.tenue === 'string' && TENUES[brut.tenue] ? brut.tenue : TENUE_PAR_DEFAUT;
    return { gagnes, porte, tenue };
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

/** Le stockage a change sous nos pieds (profil restaure, game/profil.ts) : relire. */
export function relireVestiaire() { ecrire(lire()); }

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

/** Porter une tenue. Elle remplace le skin porte : on choisit l'un ou l'autre. */
export function porterTenue(cle: string) {
  if (!TENUES[cle]) return;
  ecrire({ ...etatCourant(), tenue: cle, porte: null });
}

/**
 * L'apparence du coureur du joueur dans une tenue : son corps et sa foulee
 * (PLAYER_LOOK), aux couleurs de la tenue. Une par tenue, gardee : le rendu
 * range ses couleurs par objet (WeakMap, sprinter-app.js), et une apparence
 * neuve a chaque course les lui ferait recalculer.
 */
const looksTenue = new Map<string, any>();
export function lookDeTenue(cle: string): any {
  const t = TENUES[cle] || TENUES[TENUE_PAR_DEFAUT];
  if (cle === TENUE_PAR_DEFAUT || !TENUES[cle]) return SprinterCore.PLAYER_LOOK;
  let l = looksTenue.get(cle);
  if (!l) {
    l = { ...SprinterCore.PLAYER_LOOK, jersey: t.jersey, shorts: t.shorts, shoe: t.shoe,
          bandeau: t.bandeau || null, poignet: t.poignet || null };
    looksTenue.set(cle, l);
  }
  return l;
}

/** L'apparence d'un skin : celle de l'athlete a qui on l'a gagne. */
export function lookDuSkin(cle: string): any | null {
  const s = SKINS[cle];
  return s ? SprinterCore.VEDETTES[s.coureur] || null : null;
}

/**
 * Habiller le coureur du joueur pour la course qu'on vient de construire.
 *
 * Le skin porte sur les courses qui sont les siennes — les haies pour un
 * hurdleur, le plat pour un sprinteur —, le maillot partout ailleurs. Et pas
 * sur le stade d'un defi : on ne court pas contre Aurel Manga dans la peau
 * d'Aurel Manga — il y aurait deux fois le meme homme dans deux couloirs
 * voisins, et le joueur ne saurait plus lequel il est.
 */
export function habillerLeJoueur(epreuve: unknown) {
  const G = SprinterApp.G;
  if (!G || !G.player) return;
  const lvl = SprinterApp.LEVELS && SprinterApp.LEVELS[G.levelIdx];
  const porte = etatCourant().porte;
  const s = porte ? SKINS[porte] : null;
  const chezLui = !!s && typeof epreuve === 'string' && avecHaies(epreuve) === s.surHaies;
  const look = chezLui && !(lvl && lvl.evenement) ? lookDuSkin(porte as string) : null;
  G.player.look = look || lookDeTenue(etatCourant().tenue);
}

export function useVestiaire(): Etat {
  return useSyncExternalStore(
    (l) => { abonnes.add(l); return () => { abonnes.delete(l); }; },
    etatCourant,
    etatCourant,
  );
}
