import React from 'react';

/**
 * Le drapeau d'un pays, la medaille d'un athlete, et l'ecusson de sa division.
 *
 * Les deux vivent ici parce qu'ils apparaissent aux memes endroits — le
 * classement general, les grilles de championnat, les podiums — et qu'ils
 * doivent y avoir exactement la meme forme partout. Les recopier a chaque
 * ecran, c'est se garantir qu'un jour l'un d'eux sera different des autres.
 */

/**
 * Le drapeau, en emoji, a partir du code du pays.
 *
 * Un drapeau emoji n'est pas une image : c'est la paire de lettres du pays,
 * ecrite avec les « indicateurs regionaux » d'Unicode, que le systeme
 * remplace par le dessin. Aucun fichier a charger, aucune licence a verifier,
 * et deux cents pays couverts par deux lignes de calcul.
 *
 * Sur les rares systemes qui ne les dessinent pas — Windows, essentiellement —
 * les deux lettres restent lisibles a la place. C'est degrade, pas casse.
 */
export function drapeauDe(code?: string | null): string {
  const c = String(code || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return '';
  return String.fromCodePoint(
    0x1F1E6 + c.charCodeAt(0) - 65,
    0x1F1E6 + c.charCodeAt(1) - 65,
  );
}

export function Drapeau({ pays, className = '' }: { pays?: string | null; className?: string }) {
  const d = drapeauDe(pays);
  if (!d) return null;
  return (
    <span className={`shrink-0 leading-none ${className}`}
          title={String(pays).toUpperCase()} aria-label={String(pays).toUpperCase()}>
      {d}
    </span>
  );
}

export type MedailleInfo = {
  echelon: 'national' | 'continental' | 'mondial';
  zone: string;
  zoneNom: string;
  place: number;
};

/** Or, argent, bronze. */
const COULEURS = ['#F8CD4A', '#CBD5E1', '#C1803F'];

/**
 * Le sigle de la competition, pas son nom complet.
 *
 * Le mondial n'a pas de zone a nommer ; les deux autres portent la leur, mais
 * abregee : une ligne de classement n'a pas la place d'ecrire « Championnat
 * national de France » a cote d'un pseudo.
 */
function sigle(m: MedailleInfo): string {
  if (m.echelon === 'mondial') return 'MONDE';
  return m.zoneNom.slice(0, 3).toUpperCase();
}

export function Medaille({ m, taille = 'petit' }: {
  m?: MedailleInfo | null; taille?: 'petit' | 'grand';
}) {
  if (!m || m.place < 1 || m.place > 3) return null;
  const c = COULEURS[m.place - 1];
  const petit = taille === 'petit';
  return (
    <span
      className={`shrink-0 inline-flex items-center gap-1 rounded-full border font-bold
                  tracking-widest ${petit ? 'px-1.5 py-[1px] text-[8px]' : 'px-2 py-0.5 text-[10px]'}`}
      style={{ color: c, borderColor: c + '55', backgroundColor: c + '18' }}
      title={`${m.place}${m.place === 1 ? 'er' : 'e'} — ${m.zoneNom}`}
    >
      {/* Le disque dit la couleur, le sigle dit la competition. Ensemble ils
          tiennent dans la largeur d'un pseudo. */}
      <span className={petit ? 'w-1.5 h-1.5 rounded-full' : 'w-2 h-2 rounded-full'}
            style={{ backgroundColor: c }} />
      {sigle(m)}
    </span>
  );
}


/* ------------------------------------------------------------- l'ecusson */

import { SprinterApp } from '@/game/engine';
import type { Etage } from '@/game/duels';

/**
 * La couleur d'un etage.
 *
 * Elle monte du terreux au dore, et le sommet est le seul a briller. Jamais la
 * couleur seule, cependant : l'ecusson porte toujours le nom de l'etage et,
 * sauf en Legende, le chiffre romain de la division. Quelqu'un qui ne
 * distingue pas l'ambre du bronze doit pouvoir lire son rang.
 */
const TEINTES: Record<Etage, string> = {
  departemental: 'text-amber-700/90 border-amber-700/40 bg-amber-700/10',
  regional:      'text-slate-300 border-slate-300/40 bg-slate-300/10',
  national:      'text-primary border-primary/40 bg-primary/10',
  elite:         'text-cyan-300 border-cyan-400/40 bg-cyan-400/10',
  legende:       'text-fuchsia-300 border-fuchsia-400/50 bg-fuchsia-400/12',
};

const ROMAINS = ['', 'I', 'II', 'III', 'IV'];

/** Le rang lisible : « NATIONAL II », ou « LÉGENDE ». */
export function nomDuRang(etage: Etage, division: number): string {
  const { N } = SprinterApp;
  const nom = N.t('rang_' + etage);
  return division > 0 ? `${nom} ${ROMAINS[division] || ''}`.trim() : nom;
}

/**
 * La forme courte, pour les lignes d'un classement.
 *
 * « DÉPARTEMENTAL IV » plus un nombre de points ne tient pas sur la largeur
 * d'un telephone a cote d'un pseudo : c'est le pseudo qui se faisait couper,
 * et c'est lui qu'on vient lire. Le nom entier reste dans l'etiquette lue par
 * les lecteurs d'ecran — abreger a l'oeil ne doit pas abreger a l'oreille.
 */
function abrege(etage: Etage, division: number): string {
  const { N } = SprinterApp;
  const court = N.t('rang_court_' + etage);
  return division > 0 ? `${court}${ROMAINS[division] || ''}` : court;
}

export function Ecusson({ etage, division, lp, compact = false, className = '' }: {
  etage: Etage; division: number; lp?: number;
  compact?: boolean; className?: string;
}) {
  if (!etage) return null;
  const teinte = TEINTES[etage] || TEINTES.departemental;
  const complet = nomDuRang(etage, division);
  return (
    <span className={`shrink-0 inline-flex items-baseline gap-1 px-1.5 py-0.5 rounded-md
                      border font-mono text-[9px] tracking-widest ${teinte} ${className}`}
          title={complet} aria-label={lp != null ? `${complet}, ${lp}` : complet}>
      <span className="font-bold" aria-hidden>
        {compact ? abrege(etage, division) : complet}
      </span>
      {lp != null && <span className="tabular-nums opacity-80" aria-hidden>{lp}</span>}
    </span>
  );
}
