import React from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '@/game/engine';

export function OpenScreen() {
  const openT = useGameStore(s => s.openT);
  const word = "SPRINTER".split("");

  return (
    <div className="w-full h-full flex flex-col items-center justify-between pointer-events-auto relative pt-[max(env(safe-area-inset-top),2rem)] pb-[max(env(safe-area-inset-bottom),2rem)]">
      <div className="flex-1 flex flex-col justify-end pb-[10vh] md:pb-12 z-10 w-full overflow-hidden">
        <div className="flex gap-1 sm:gap-2 justify-center px-4">
          {word.map((letter, i) => {
            const lt = openT - 1.5 - i * 0.085;
            if (lt <= 0) return <div key={i} className="w-[1ch] opacity-0 text-5xl sm:text-7xl md:text-8xl">{letter}</div>;
            
            const drop = Math.max(0, 1 - lt / 0.42);
            const bounce = Math.sin(Math.min(1, lt / 0.42) * Math.PI) * 12;
            const y = -300 * drop * drop + bounce;
            
            return (
              <div 
                key={i} 
                style={{ transform: `translateY(${y}px)` }}
                className="text-5xl sm:text-7xl md:text-8xl font-black font-display tracking-tighter text-primary drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-lg sm:text-2xl font-bold tracking-widest text-foreground/90 font-display whitespace-nowrap"
          >
            100 METRES &nbsp;&mdash;&nbsp; 200 METRES
          </motion.div>
        )}
        
        {openT > 4.0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-[10px] sm:text-sm md:text-base font-medium text-muted-foreground uppercase tracking-widest max-w-[280px] sm:max-w-none"
          >
            Six stages, one clock to beat
          </motion.div>
        )}
      </div>

      {openT > 4.6 && (
        <div className="absolute bottom-[max(env(safe-area-inset-bottom),2rem)] text-xs sm:text-sm md:text-base font-bold text-foreground/80 tracking-widest uppercase animate-pulse z-10">
          Tap to start
        </div>
      )}
    </div>
  );
}
