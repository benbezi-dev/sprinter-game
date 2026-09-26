// LES FICHES DE LA PRESENTATION.
//
// Quand la camera vient sur un athlete, avant une course de championnat, le
// speaker ne dit pas que son nom : il dit ce qu'il a gagne, a quel niveau il
// se bat, et combien de duels il a remportes. C'est ce que ce fichier va
// chercher — `GET /champ/fiches`, voir `fichesDe` cote worker — pour les deux
// presentations : celle du direct (PresentationDirect) et celle de la
// retransmission (RejeuChampionnat).
//
// LA FICHE DOIT ETRE LA AVANT L'ATHLETE. Un creneau dure trois secondes ; une
// fiche qui arrive au bout d'une seconde et demie en a perdu la moitie. Le
// direct la demande donc des que la salle publie sa grille, bien avant la
// presentation, et la presentation ne fait que relire ce qui est deja la.
// C'est pour cela que la memoire est tenue ici, par joueur, et non dans le
// composant : la grille de la chambre d'appel compte les absents, l'ordre de
// la presentation non, et les deux doivent pourtant tomber sur les memes
// fiches.
//
// UNE FICHE QUI N'ARRIVE PAS N'EMPECHE RIEN. La presentation garde son nom et
// son couloir ; elle perd seulement ce qu'elle aurait pu dire de plus.

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { Etage } from './duels';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';

/** Une ligne du palmares : une competition, une distance, une couleur. */
export type LignePalmares = {
  echelon: 'national' | 'continental' | 'mondial';
  zone: string;
  zoneNom: string;
  zoneNomEn?: string;
  /** '100', '200', '400' — la distance de l'edition ou elle a ete gagnee. */
  epreuve: string;
  /** 1 or, 2 argent, 3 bronze. */
  place: number;
  /** Combien de fois : deux ors au meme championnat font une ligne « ×2 ». */
  n: number;
  dernier: number;
};

export type FicheAthlete = {
  pays: string | null;
  /** Le tenant du titre de cette edition. */
  tenant: boolean;
  /** Son rang au classement des duels de la distance, ou null s'il n'y est pas. */
  niveau: { etage: Etage; division: number; palier: number; lp: number } | null;
  /** Sur la meme distance que le niveau : victoires, nuls, defaites. */
  bilan: { v: number; n: number; d: number };
  /** Du plus prestigieux au moins prestigieux. Vide : rien a annoncer. */
  palmares: LignePalmares[];
};

/**
 * D'ou viennent les fiches : l'edition, et l'heure de la course pour un rejeu.
 *
 * `avant` n'a de sens que pour la retransmission — une finale qu'on revoit ne
 * doit pas annoncer la medaille qu'elle va donner. En direct on le laisse
 * vide : tout ce qui a ete gagne compte.
 */
export type SourceFiches = { edition: string; avant?: number | null };

/** Fiche connue, ou `null` quand le serveur a repondu qu'il n'y en a pas. */
const memoire = new Map<string, { fiche: FicheAthlete | null; a: number }>();
const enVol = new Map<string, Promise<void>>();
const abonnes = new Set<() => void>();
let version = 0;

/**
 * Au-dela, on repart de zero. Une fiche pese quelques centaines d'octets et un
 * weekend de championnat n'en demande que quelques dizaines : le plafond ne
 * sert qu'a l'appareil qui resterait ouvert des semaines sur l'ecran.
 */
const MEMOIRE_MAX = 400;

/**
 * Au-dela, une fiche se redemande. Un joueur peut rester sur l'ecran du samedi
 * au dimanche, et entre sa serie et sa finale les autres ont continue de se
 * battre en duel : le niveau et le bilan de la veille ne sont plus ceux du
 * jour. Dix minutes couvrent largement la chambre d'appel et la presentation
 * d'une meme course, qui n'en demandent donc qu'une.
 */
const FRAICHEUR_MS = 10 * 60 * 1000;

const norme = (cle: string) => String(cle || '').trim().toLowerCase();
const cleMemoire = (s: SourceFiches, cle: string) =>
  `${s.edition}|${s.avant ? Math.round(s.avant) : ''}|${norme(cle)}`;

function publier() {
  version += 1;
  for (const f of abonnes) f();
}

/**
 * Demande au serveur les fiches qui manquent encore.
 *
 * Un echec ne laisse rien en memoire : la presentation suivante — ou la meme,
 * si elle n'a pas encore commence — pourra redemander.
 */
export function chargerFiches(source: SourceFiches | null | undefined, cles: string[]): Promise<void> {
  if (!source || !source.edition) return Promise.resolve();
  const maintenant = Date.now();
  const manquantes = [...new Set(cles.map(norme).filter(Boolean))]
    .filter(c => {
      const m = memoire.get(cleMemoire(source, c));
      return !m || maintenant - m.a > FRAICHEUR_MS;
    })
    .sort();
  if (!manquantes.length) return Promise.resolve();
  const vol = `${source.edition}|${source.avant ?? ''}|${manquantes.join(',')}`;
  const deja = enVol.get(vol);
  if (deja) return deja;

  const q = new URLSearchParams({ edition: source.edition, cles: manquantes.join(',') });
  if (source.avant) q.set('avant', String(Math.round(source.avant)));
  const p = fetch(API_BASE + '/champ/fiches?' + q)
    .then(r => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((r: { fiches?: Record<string, FicheAthlete> } | null) => {
      enVol.delete(vol);
      if (!r || !r.fiches) return;
      if (memoire.size > MEMOIRE_MAX) memoire.clear();
      const a = Date.now();
      for (const c of manquantes) memoire.set(cleMemoire(source, c), { fiche: r.fiches[c] || null, a });
      publier();
    });
  enVol.set(vol, p);
  return p;
}

/**
 * La fiche d'un partant, si elle est deja arrivee — meme un peu ancienne :
 * pendant qu'on la redemande, celle d'il y a une heure vaut mieux que rien.
 */
export function ficheDe(source: SourceFiches | null | undefined, cle: string | null | undefined) {
  if (!source || !cle) return undefined;
  return memoire.get(cleMemoire(source, cle))?.fiche;
}

/**
 * Les fiches d'une grille, pour un ecran React : demandees au montage, puis
 * relues a chaque arrivee.
 *
 * La valeur rendue est une fonction plutot qu'une table : c'est ce qui permet
 * a l'ecran de demander la fiche de l'athlete du moment sans reconstruire une
 * table a chaque battement de sa sequence.
 */
export function useFiches(source: SourceFiches | null | undefined, cles: string[]) {
  const v = useSyncExternalStore(
    l => { abonnes.add(l); return () => { abonnes.delete(l); }; },
    () => version, () => version,
  );
  const edition = source?.edition || '';
  const avant = source?.avant ?? null;
  const liste = cles.map(norme).filter(Boolean).sort().join(',');
  useEffect(() => {
    if (!edition || !liste) return;
    void chargerFiches({ edition, avant }, liste.split(','));
  }, [edition, avant, liste]);
  return useMemo(
    () => (cle: string | null | undefined) => (edition ? ficheDe({ edition, avant }, cle) : undefined),
    // `v` : une fiche vient d'arriver, la fonction doit changer pour que
    // l'ecran relise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [edition, avant, v],
  );
}
