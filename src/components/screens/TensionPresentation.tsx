import React from 'react';
import { motion } from 'motion/react';
import { usePouls } from '@/game/tension-presentation';
import type { FicheAthlete } from '@/game/fiches-champ';
import type { Geste } from '@/lib/mouvement';

/**
 * CE QUI FAIT MONTER LA TENSION, A L'IMAGE.
 *
 * Le son et le rythme vivent dans `game/tension-presentation` ; ici, ce que
 * l'oeil en voit. Les deux presentations de championnat — le direct et la
 * retransmission — posent les memes pieces, pour que le meme athlete arrive
 * de la meme facon qu'on regarde sa course en direct ou apres coup.
 *
 *   le voile        les bords de l'ecran battent avec le coeur, et de plus
 *                   en plus fort a mesure que la sequence avance ;
 *   l'eclair        un flash de photographe a chaque athlete qui arrive ;
 *   le couloir      son numero, geant et en creux, qui traverse l'arriere-plan
 *                   pendant qu'il leve les bras ;
 *   le nom          il claque : il arrive trop grand et flou, et se pose net ;
 *   le sablier      le trait de l'athlete en cours se vide — son temps file.
 */

/**
 * LA SORTIE EST UNE COUPE, PAS UNE ANIMATION.
 *
 * L'athlete suivant n'entre qu'une fois le precedent sorti (AnimatePresence
 * en mode « wait »), et cette sortie attend TOUS les elements qui en ont une.
 * Ceux de la fiche heritaient de leur retard d'entree — jusqu'a une demi-
 * seconde — et le coup de tampon de son ressort : le nom suivant arrivait
 * presque une seconde apres l'impact qui l'annoncait. Chaque sortie est donc
 * breve et sans retard : on coupe, et l'on passe au suivant.
 */
const SORTIE_VIVE = { duration: 0.12, delay: 0 };
export function sortieVive(g: Geste): Geste {
  return { ...g, exit: { ...g.exit, transition: SORTIE_VIVE } };
}

/** Le nom qui claque : trop grand, flou, puis net d'un coup de ressort. */
export const CLAQUE: Geste = sortieVive({
  initial: { opacity: 0, scale: 1.35, filter: 'blur(10px)' },
  animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0 },
  transition: { type: 'spring', stiffness: 520, damping: 26, mass: 0.9 },
});

/** Les bords de l'ecran qui battent avec le coeur. */
export function VoilePouls() {
  const p = usePouls();
  if (!p.n) return null;
  return (
    <motion.div
      key={p.n}
      aria-hidden
      className="absolute inset-0 pointer-events-none"
      style={{
        background: 'radial-gradient(ellipse at center, transparent 45%, rgba(120,10,20,0.55) 100%)',
      }}
      initial={{ opacity: Math.min(1, p.force) }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 0.8, 0.3, 1] }}
    />
  );
}

/** Le flash d'arrivee d'un athlete. `cle` : celle de l'athlete, pour rejouer. */
export function EclairArrivee({ cle }: { cle: string | number }) {
  return (
    <motion.div
      key={cle}
      aria-hidden
      className="absolute inset-0 pointer-events-none bg-white"
      initial={{ opacity: 0.32 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.38, ease: 'easeOut' }}
    />
  );
}

/**
 * Le numero du couloir, geant et en creux, derriere le nom.
 *
 * Il entre par la droite et continue de glisser, lentement, tout le creneau :
 * un arriere-plan qui bouge dit que le temps passe, meme quand rien d'autre
 * ne change a l'ecran.
 */
export function CouloirGeant({ couloir, couleur = 'rgba(255,255,255,0.28)' }: {
  couloir: number; couleur?: string;
}) {
  return (
    <motion.span
      aria-hidden
      className="absolute left-1/2 -translate-x-1/2 -top-24 md:-top-36 pointer-events-none select-none
                 font-display font-black leading-none text-[11rem] md:text-[16rem] tabular-nums"
      style={{ color: 'transparent', WebkitTextStroke: `2px ${couleur}` }}
      initial={{ opacity: 0, x: 90 }}
      animate={{ opacity: 1, x: -40 }}
      transition={{
        x: { duration: 3, ease: [0.16, 1, 0.3, 1] },
        opacity: { duration: 0.35 },
      }}
    >
      {couloir}
    </motion.span>
  );
}

/**
 * Les traits de la sequence, un par athlete. Celui du moment se vide comme un
 * sablier : `avancement` va de 0 a 1 sur son creneau.
 */
export function Sablier({ n, index, avancement, couleur }: {
  n: number; index: number; avancement: number; couleur: string;
}) {
  return (
    <div className="relative flex justify-center gap-1.5">
      {Array.from({ length: n }, (_, i) => (
        <span key={i}
          className="relative h-1 rounded-full overflow-hidden transition-all duration-300"
          style={{
            width: i === index ? 32 : 14,
            background: i < index ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.14)',
          }}>
          {i === index && (
            <span className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${Math.max(0, 100 - avancement * 100)}%`, background: couleur,
                    transition: 'width 100ms linear',
                  }} />
          )}
        </span>
      ))}
    </div>
  );
}

/**
 * Le favori de la grille : le mieux classe en duel sur la distance, s'il est
 * seul en tete. Deux athletes au meme palier et aux memes points, c'est une
 * course ouverte — on ne designe personne plutot que d'en choisir un au
 * hasard. Il faut au moins deux athletes classes pour qu'il y ait un favori.
 */
export function favoriDe(cles: (string | undefined)[],
                         fiche: (cle: string) => FicheAthlete | null | undefined): string | null {
  const classes = cles
    .filter((c): c is string => !!c)
    .map(c => ({ c, f: fiche(c) }))
    .filter(x => x.f && x.f.niveau) as { c: string; f: FicheAthlete }[];
  if (classes.length < 2) return null;
  const score = (f: FicheAthlete) => f.niveau!.palier * 1e6 + f.niveau!.lp;
  classes.sort((a, b) => score(b.f) - score(a.f));
  return score(classes[0].f) > score(classes[1].f) ? classes[0].c : null;
}
