import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { SprinterApp, useGameStore } from '@/game/engine';
import { Mascotte } from './Mascotte';
import type { Personnage } from '@/game/mascotte-3d';

/**
 * LA MASCOTTE REAGIT A TA COURSE (20/11/2026). Elle n'est pas jouable : elle est le frimeur et
 * le mauvais perdant du jeu, et elle vit ta course comme la sienne. Visage et corps vont ensemble
 * (assets-sources/mascotte/EXPRESSIONS.md) : chaque reaction est un fichier d'expression et un
 * de ses gestes. Elle se pose dans le coin bas gauche des ecrans de fin, sans rien capter du
 * toucher ; tant que son fichier charge (ou sans WebGL), le coin reste vide.
 */
type Reaction = [Personnage, string];
const REACTIONS: Record<string, Reaction[]> = {
  // gagne : il frime
  gagne: [['heros', 'celebration'], ['heros-hilare', 'rire'], ['heros-hilare', 'joie'], ['heros', 'frime']],
  // sur le podium sans gagner : il ne le supporte pas
  podium: [['heros-furieux', 'colere'], ['heros-choque', 'stupeur']],
  // au milieu : la crise
  milieu: [['heros-furieux', 'trepigne'], ['heros-furieux', 'rage']],
  // dernier : les larmes
  dernier: [['heros-larmes', 'pleure'], ['heros-larmes', 'genoux']],
  // faux depart, abandon : il n'en revient pas
  rate: [['heros-choque', 'doubletake']],
};

function issue(): keyof typeof REACTIONS {
  const G = SprinterApp.G;
  if (G.falseOut || !G.player || G.player.finishTime == null) return 'rate';
  const ordre: any[] = G.ranking || [];
  const place = ordre.indexOf(G.player) + 1;
  if (place === 1) return 'gagne';
  if (place > 0 && place <= 3) return 'podium';
  if (place > 0 && place === ordre.length) return 'dernier';
  return 'milieu';
}

export function MascotteReaction({ hauteur = 170 }: { hauteur?: number }) {
  const raceKey = useGameStore((s) => s.raceKey);
  const runTime = useGameStore((s) => s.runTime);
  // une reaction par course : elle ne change pas quand l'ecran se redessine
  const [personnage, geste] = useMemo<Reaction>(() => {
    const liste = REACTIONS[issue()];
    return liste[Math.floor(Math.random() * liste.length)];
  }, [raceKey, runTime]);

  // DANS L'ECRAN, PAS PAR-DESSUS : posee en coin, elle couvrait les boutons du bas (« Defier
  // quelqu'un », « Accueil ») sur telephone. Elle prend donc sa place en tete de l'ecran de fin,
  // au-dessus du titre, et la mise a l'echelle de l'ecran (TenirDansLEcran) la compte.
  return (
    <motion.div
      initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 140, damping: 18, delay: 0.2 }}
      className="pointer-events-none shrink-0"
      style={{ width: 'min(60vw, 240px)', height: hauteur }}>
      <Mascotte personnage={personnage} geste={geste} ensuite="idle" lacet={0.4} />
    </motion.div>
  );
}
