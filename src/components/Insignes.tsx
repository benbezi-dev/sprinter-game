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
import { Flame as IconeFlamme } from 'lucide-react';
import { nomDiscipline, type Etage } from '@/game/duels';

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

/**
 * `epreuve` nomme la DISCIPLINE de ce rang, et l'ecusson ne devrait presque
 * jamais s'en passer.
 *
 * Les niveaux ne sont pas partagés : « NATIONAL II » tout seul ne dit pas sur
 * quoi. Dans une liste on l'omet — l'écran entier porte déjà la distance en
 * titre, et la répéter sur trois cents lignes ne dirait rien de plus — mais
 * partout où l'écusson voyage seul, sur l'accueil notamment, il la porte.
 */
export function Ecusson({ etage, division, lp, epreuve, compact = false, className = '' }: {
  etage: Etage; division: number; lp?: number; epreuve?: string | null;
  compact?: boolean; className?: string;
}) {
  if (!etage) return null;
  const teinte = TEINTES[etage] || TEINTES.departemental;
  const complet = nomDuRang(etage, division);
  const distance = epreuve ? nomDiscipline(epreuve) : '';
  const lu = distance ? `${distance}, ${complet}` : complet;
  return (
    <span className={`shrink-0 inline-flex items-baseline gap-1 px-1.5 py-0.5 rounded-md
                      border font-mono text-[9px] tracking-widest ${teinte} ${className}`}
          title={distance ? `${complet} — ${distance}` : complet}
          aria-label={lp != null ? `${lu}, ${lp}` : lu}>
      {distance && <span className="opacity-70" aria-hidden>{distance}</span>}
      <span className="font-bold" aria-hidden>
        {compact ? abrege(etage, division) : complet}
      </span>
      {lp != null && <span className="tabular-nums opacity-80" aria-hidden>{lp}</span>}
    </span>
  );
}


/* -------------------------------------------------------------- la flamme */

/**
 * La serie de victoires, quand elle devient remarquable.
 *
 * Elle ne compte pas les duels joues mais ceux gagnes SANS EN PERDRE UN : une
 * seule defaite la ramene a zero. C'est ce qui la distingue de tout le reste
 * de l'ecran — le palier, les points, le bilan sont des acquis, elle est la
 * seule chose qu'on peut perdre en entier d'un coup.
 *
 * POURQUOI UN DESSIN ET PAS UN EMOJI. La flamme doit changer de couleur, et un
 * emoji ne le permet pas : le systeme le dessine lui-meme, toujours de la meme
 * couleur, et aucun style ne l'atteint. C'est l'inverse du drapeau plus haut,
 * ou l'on veut justement que le systeme dessine.
 */

/**
 * A partir de combien la flamme s'allume.
 *
 * Cinq, parce qu'en dessous ce n'est pas une serie, c'est une bonne journee.
 */
export const SERIE_MIN = 5;

/**
 * Les couleurs suivent la temperature d'une vraie flamme : rouge, orange,
 * jaune, blanc-bleu, violet. C'est la seule progression que l'oeil lit comme
 * « de plus en plus chaud » sans qu'on ait a l'expliquer — et le sommet tombe
 * sur le violet de LEGENDE, deja porte par l'ecusson le plus haut.
 *
 * Les seuils sont ici et nulle part ailleurs : les deplacer est une ligne.
 * Ils sont serres a dessein — sur un classement de trente joueurs, un palier
 * qu'on atteint une fois par an n'existe pas.
 */
const SERIES = [
  { seuil: 5,  corps: '#DC2626', coeur: '#FCA5A5', halo: 0.30 },
  { seuil: 8,  corps: '#F97316', coeur: '#FDBA74', halo: 0.40 },
  { seuil: 12, corps: '#F8CD4A', coeur: '#FEF3C7', halo: 0.55 },
  { seuil: 18, corps: '#67E8F9', coeur: '#F0FDFF', halo: 0.70 },
  { seuil: 25, corps: '#E879F9', coeur: '#FDF4FF', halo: 0.85 },
];

/** Le palier d'une serie, ou rien si elle n'a pas encore allume la flamme. */
export function palierDeSerie(serie?: number | null) {
  const n = Number(serie) || 0;
  if (n < SERIE_MIN) return null;
  let p = SERIES[0];
  for (const s of SERIES) if (n >= s.seuil) p = s;
  return p;
}

export function Flamme({ serie, taille = 'petit', className = '' }: {
  serie?: number | null; taille?: 'petit' | 'grand'; className?: string;
}) {
  const p = palierDeSerie(serie);
  if (!p) return null;
  const n = Number(serie);
  const { N } = SprinterApp;
  const petit = taille === 'petit';
  const px = petit ? 13 : 17;
  const halo = Math.round(p.halo * 255).toString(16).padStart(2, '0');
  // Le nombre accompagne toujours le dessin. Sans lui, la couleur devrait etre
  // apprise pour vouloir dire quelque chose, et quelqu'un qui distingue mal le
  // rouge de l'orange ne lirait rien du tout.
  return (
    <span className={`shrink-0 inline-flex items-center gap-1 font-bold tabular-nums
                      ${petit ? 'text-[9px]' : 'text-[11px]'} ${className}`}
          style={{ color: p.corps }}
          title={N.t('serie_titre', { n })} aria-label={N.t('serie_titre', { n })}>
      {/* Deux flammes l'une dans l'autre : le corps, et le coeur plus clair
          pose a sa base. Une seule couleur pleine faisait une goutte — c'est
          le coeur qui donne la lecture « ca brule » a treize pixels. */}
      <span className="relative inline-block shrink-0"
            style={{ width: px, height: px }} aria-hidden>
        <IconeFlamme size={px} fill={p.corps} stroke={p.corps} strokeWidth={1.6}
                     style={{ filter: `drop-shadow(0 0 ${petit ? 3 : 5}px ${p.corps}${halo})` }} />
        <IconeFlamme size={px * 0.52} fill={p.coeur} stroke={p.coeur} strokeWidth={2}
                     className="absolute"
                     style={{ left: px * 0.24, top: px * 0.40 }} />
      </span>
      {n}
    </span>
  );
}
