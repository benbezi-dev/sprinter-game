import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { SprinterApp, useGameStore } from '@/game/engine';
import { Mascotte } from './Mascotte';
import { REACTIONS_COURSE, REACTIONS_RIVAL, tirer, type IssueRival, type Reaction } from '@/game/mascotte-reactions';

/**
 * LA MASCOTTE REAGIT (20/11/2026). Elle n'est pas jouable.
 * - Sans `rival` : LE HEROS reagit a ta place dans la course (game/mascotte-reactions.ts).
 * - Avec `rival` : LE RIVAL, ton adversaire de duel — il provoque, toise, nargue ou enrage.
 * Elle prend sa place dans l'ecran (jamais par-dessus les boutons) ; tant que son fichier charge,
 * ou sans WebGL, la place reste vide.
 */
function issueCourse(): keyof typeof REACTIONS_COURSE {
  const G = SprinterApp.G;
  if (G.falseOut || !G.player || G.player.finishTime == null) return 'rate';
  const ordre: any[] = G.ranking || [];
  const place = ordre.indexOf(G.player) + 1;
  if (place === 1) return 'gagne';
  if (place > 0 && place <= 3) return 'podium';
  if (place > 0 && place === ordre.length) return 'dernier';
  return 'milieu';
}

export function MascotteReaction({ hauteur = 170, rival }: { hauteur?: number; rival?: IssueRival }) {
  const raceKey = useGameStore((s) => s.raceKey);
  const runTime = useGameStore((s) => s.runTime);
  // une reaction par course (ou par issue de duel) : elle ne change pas quand l'ecran se redessine
  const [personnage, geste] = useMemo<Reaction>(
    () => tirer(rival ? REACTIONS_RIVAL[rival] : REACTIONS_COURSE[issueCourse()]),
    [raceKey, runTime, rival],
  );

  // DANS L'ECRAN, PAS PAR-DESSUS : posee en coin, elle couvrait les boutons du bas (« Defier
  // quelqu'un », « Accueil ») sur telephone. Elle prend donc sa place en tete de l'ecran, et la
  // mise a l'echelle de l'ecran (TenirDansLEcran) la compte.
  return (
    <motion.div
      initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 140, damping: 18, delay: 0.2 }}
      className="pointer-events-none shrink-0"
      style={{ width: 'min(60vw, 240px)', height: hauteur }}>
      <Mascotte personnage={personnage} geste={geste} ensuite="idle" lacet={rival ? -0.4 : 0.4} />
    </motion.div>
  );
}
