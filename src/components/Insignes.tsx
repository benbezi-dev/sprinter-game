import React from 'react';

/**
 * Le drapeau d'un pays, et la medaille d'un athlete.
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
