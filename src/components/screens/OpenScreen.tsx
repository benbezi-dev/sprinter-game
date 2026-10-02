import React from 'react';
import { motion } from 'motion/react';
import { MONTEE, FONDU } from '@/lib/mouvement';
import { useGameStore } from '@/game/engine';

export function OpenScreen() {
  const openT = useGameStore(s => s.openT);
  // La part des images deja chargee (game/chargement.ts) : l'ouverture ne
  // cede la place a l'accueil qu'une fois tout la.
  const charge = useGameStore(s => s.chargement ?? 0);
  const pret = charge >= 1;
  const word = "SPRINTER".split("");

  return (
    <div className="w-full h-full flex flex-col items-center justify-between pointer-events-auto relative pt-[max(env(safe-area-inset-top),2rem)] pb-[max(env(safe-area-inset-bottom),2rem)]">
      <div className="flex-1 flex flex-col justify-end pb-[10vh] md:pb-12 z-10 w-full overflow-hidden">
        <div className="flex gap-1 sm:gap-2 justify-center px-4">
          {word.map((letter, i) => {
            const lt = openT - 1.5 - i * 0.085;
            // Largeur fixe sur les deux etats (avant/pendant la chute) : sans
            // ca, chaque lettre passe d'un espace reserve d'1ch a sa largeur
            // naturelle des qu'elle apparait, ce qui decale ses voisines en
            // plein rebond et peut faire illusion d'une autre lettre.
            if (lt <= 0) return <div key={i} className="w-[0.85ch] sm:w-[1ch] text-center opacity-0 text-5xl sm:text-7xl md:text-8xl">{letter}</div>;

            const drop = Math.max(0, 1 - lt / 0.42);
            const bounce = Math.sin(Math.min(1, lt / 0.42) * Math.PI) * 12;
            const y = -300 * drop * drop + bounce;

            return (
              <div
                key={i}
                style={{ transform: `translateY(${y}px)` }}
                className="w-[0.85ch] sm:w-[1ch] text-center text-5xl sm:text-7xl md:text-8xl font-black font-display tracking-tighter text-primary drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
              >
                {letter}
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="flex-1 flex flex-col items-center pt-4 md:pt-8 gap-2 md:gap-4 z-10 text-center px-4">
        {openT > 3.1 && (
          <motion.div 
            {...MONTEE}
            className="text-lg sm:text-2xl font-bold tracking-widest text-foreground/90 font-display whitespace-nowrap"
          >
            100 &nbsp;&mdash;&nbsp; 200 &nbsp;&mdash;&nbsp; 400 METRES
          </motion.div>
        )}
        
        {openT > 4.0 && (
          <motion.div 
            {...FONDU}
            className="text-[10px] sm:text-sm md:text-base font-medium text-muted-foreground uppercase tracking-widest max-w-[280px] sm:max-w-none"
          >
            Six stages, one clock to beat
          </motion.div>
        )}
      </div>

      {openT > 4.6 && pret && (
        <div className="absolute bottom-[max(env(safe-area-inset-bottom),2rem)] text-xs sm:text-sm md:text-base font-bold text-foreground/80 tracking-widest uppercase animate-pulse z-10">
          Tap to start
        </div>
      )}

      {openT > 2.2 && !pret && (
        <div className="absolute bottom-[max(env(safe-area-inset-bottom),2rem)] flex flex-col items-center gap-2 z-10">
          <div className="text-[10px] sm:text-xs font-bold text-foreground/70 tracking-widest uppercase tabular-nums">
            Chargement {Math.floor(charge * 100)} %
          </div>
          <div className="w-40 sm:w-56 h-1 rounded-full bg-foreground/15 overflow-hidden">
            <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${Math.round(charge * 100)}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
