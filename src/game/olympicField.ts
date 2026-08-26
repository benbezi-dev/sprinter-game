// Grille de depart des Jeux olympiques : les meilleurs mondiaux, pas des noms
// ecrits d'avance. Les sept adversaires de l'etape sont les sept premiers du
// TOP 500 de la distance courue — un classement par discipline, donc une
// grille par discipline.

import { SprinterApp } from './engine';
import {
  fetchLeaderboardRaw, getSavedName, onLeaderboard, onNameSaved,
  rankByRaceTime, type LeaderboardEntry, type RaceKey,
} from './leaderboard';

const RACES: RaceKey[] = ['100', '200', '400'];

/** Adversaires sur la ligne de depart, le joueur non compris. */
export const FIELD_SIZE = 7;

/** L'etape qui aligne les meilleurs mondiaux, reconnue a son decor. */
const OLYMPIC: number =
  SprinterApp.LEVELS.findIndex((l: any) => l.theme === 'olympic');

// Derniere grille connue, gardee d'une session a l'autre : au lancement
// suivant les Jeux olympiques ont leur vraie affiche des la premiere image,
// meme hors ligne, sans attendre la reponse du classement.
const CACHE_KEY = 'sprinter_olympic_field';

/**
 * Les sept noms de la ligne de depart, pris dans l'ordre propose.
 *
 * Un couloir par coureur, et un coureur par personne : on ne retient que la
 * premiere apparition de chaque nom, la place liberee revenant au suivant.
 *
 * Le joueur est le premier ecarte. Il a deja son couloir, sous « TOI » : si
 * son nom figure au TOP 500 il s'alignerait une seconde fois, contre
 * lui-meme. La place revient la aussi au coureur suivant.
 */
// Nom du joueur, garde ici plutot que relu a chaque fois : il peut etre
// choisi dans une partie ou localStorage n'ecrit pas, et c'est quand meme
// celui du joueur.
let playerName = '';
function setPlayerName(name: string) {
  playerName = (name || '').trim().toLowerCase();
}
setPlayerName(getSavedName());

function assemble(names: string[], size = FIELD_SIZE): string[] {
  const field: string[] = [];
  const seen = new Set<string>();
  if (playerName) seen.add(playerName);
  const take = (raw: string) => {
    const name = (raw || '').trim();
    if (!name || field.length >= size) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    field.push(name);
  };
  for (const n of names) take(n);
  return field;
}

/**
 * Les sept noms de la ligne de depart.
 *
 * Le TOP 500 classe des chronos, pas des personnes : un meme nom peut y
 * occuper plusieurs lignes (plusieurs appareils, plusieurs records). Si le
 * classement ne fournit pas sept noms — le joueur ecarte et les doublons
 * fondus —, on complete avec les coureurs de l'etape, ceux qui existent deja
 * dans le jeu.
 */
export function buildField(
  entries: LeaderboardEntry[], fallback: string[], size = FIELD_SIZE
): string[] {
  const ranked = rankByRaceTime(entries).map(e => e.name);
  return assemble(ranked.concat(fallback), size);
}

/** Les noms de l'etape, tels qu'ecrits dans le jeu. */
function fallbackNames(): string[] {
  return OLYMPIC >= 0 ? SprinterApp.LEVELS[OLYMPIC].names : [];
}

function remember(field: Record<string, string[] | null>) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(field)); } catch (e) { }
}

/** Grille d'une discipline, deduite d'une reponse du classement. */
export function setField(race: RaceKey, entries: LeaderboardEntry[]) {
  const field = SprinterApp.G.top500Field;
  field[race] = buildField(entries, fallbackNames());
  remember(field);
}

/**
 * Grille de la derniere session, posee avant tout appel reseau. Elle sera
 * remplacee des que le classement repond.
 */
export function loadCachedFields() {
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    for (const race of RACES) {
      const names = saved[race];
      if (Array.isArray(names) && names.length) {
        // Repassee au filtre : le joueur a pu prendre entre-temps le nom
        // d'un des coureurs de cette grille, il ne doit pas s'y retrouver.
        SprinterApp.G.top500Field[race] =
          assemble(names.map(String).concat(fallbackNames()));
      }
    }
  } catch (e) { }
}

/**
 * Le joueur vient de choisir son nom : les grilles deja composees s'y
 * conforment sans attendre la prochaine reponse du classement — un one-shot
 * olympique peut partir dans la seconde.
 */
function reapply() {
  const field = SprinterApp.G.top500Field;
  for (const race of RACES) {
    const names = field[race];
    if (names) field[race] = assemble(names.concat(fallbackNames()));
  }
  remember(field);
  // La grille en main ne contient que sept noms : la place liberee s'y
  // comble avec un coureur de l'etape. On relit le classement derriere pour
  // qu'elle revienne au vrai suivant.
  for (const race of RACES) refreshField(race);
}

/** Grille d'une discipline, relue au classement. */
export function refreshField(race: RaceKey): Promise<void> {
  // fetchLeaderboardRaw previent l'observateur : rien d'autre a faire ici.
  return fetchLeaderboardRaw(race).then(() => { }, () => { });
}

/**
 * Au demarrage : la grille de la session precedente tout de suite, puis les
 * trois disciplines relues en fond. Les Jeux olympiques arrivent tard dans
 * une carriere, mais un one-shot peut les lancer dans la seconde.
 */
export function primeFields() {
  if (OLYMPIC < 0) return;
  loadCachedFields();
  onLeaderboard(setField);
  onNameSaved(name => { setPlayerName(name); reapply(); });
  for (const race of RACES) refreshField(race);
}
