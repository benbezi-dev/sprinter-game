import React from 'react';
import { SprinterApp, useGameStore } from '@/game/engine';
import { motion } from 'framer-motion';

export function WinAllScreen() {
  const { runTime, runSplits, runRank } = useGameStore();
  const { N } = SprinterApp;

  const handleReplay = () => {
    SprinterApp.startRun();
  };
  
  const handleHome = () => {
    SprinterApp.G.state = 'title';
    SprinterApp.buildLevel(0);
  };

  return (
    <div className="w-full h-full flex flex-col pointer-events-auto bg-black/90 backdrop-blur-md overflow-y-auto px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)] pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)]">
      <div className="min-h-full flex flex-col items-center justify-center w-full">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center max-w-2xl w-full py-6 md:py-8 gap-4 md:gap-6">
          
          <div className="flex flex-col items-center text-center gap-1 md:gap-2">
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-black font-display text-primary tracking-tighter uppercase drop-shadow-[0_0_30px_rgba(248,205,74,0.4)]">
              {N.t('run_done')}
            </h1>
            
            <div className="text-[10px] sm:text-xs md:text-base font-medium text-foreground/80 tracking-widest uppercase">
              {N.t('six_in')}<span className="text-white font-bold ml-1 md:ml-2">{runTime.toFixed(2)} s</span>
            </div>
          </div>
          
          {/* Splits Card */}
          <div className="w-full bg-card/60 border border-white/10 rounded-2xl p-3 sm:p-4 md:p-8 shadow-2xl">
            <div className="flex flex-col gap-1.5 md:gap-3">
              {runSplits.map((split, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 md:px-4 md:py-3 rounded-xl border border-white/5 bg-black/20">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-4 overflow-hidden pr-2">
                    <span className="text-[10px] md:text-xs font-bold tracking-widest text-muted-foreground uppercase shrink-0">
                      {N.t('stage_low')} {i + 1}
                    </span>
                    <span className="font-bold tracking-wide text-foreground text-sm md:text-base truncate">
                      {N.levelName(i)}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-primary text-base md:text-lg shrink-0">
                    {split.toFixed(2)} s
                  </span>
                </div>
              ))}
            </div>
            
            <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-white/10 flex justify-between items-center px-2 md:px-4">
              <span className="font-bold tracking-widest text-foreground uppercase text-sm md:text-base">TOTAL</span>
              <span className="font-mono font-black text-xl md:text-2xl text-primary">{runTime.toFixed(2)} s</span>
            </div>
          </div>

          {/* Rank Badge */}
          {runRank && (
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1, transition: { delay: 0.5 } }} className="bg-primary text-background font-black font-display tracking-widest uppercase px-6 py-3 md:px-8 md:py-4 rounded-xl text-lg sm:text-xl md:text-2xl shadow-[0_0_30px_rgba(248,205,74,0.4)] text-center">
              {runRank === 1 ? N.t('best_run') : runRank <= 3 ? N.t('top3_runs') : N.t('top10_runs')}
            </motion.div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full max-w-md mt-2">
            <button onClick={handleReplay} className="flex-1 py-3 md:py-4 rounded-xl font-black font-display text-lg sm:text-xl md:text-2xl tracking-widest text-background bg-primary hover:bg-primary/90 transition-all border-b-4 border-amber-600 active:border-b-0 active:translate-y-1">
              {N.t('replay')}
            </button>
            <button onClick={handleHome} className="flex-1 py-3 md:py-4 rounded-xl font-bold tracking-widest text-foreground bg-secondary hover:bg-secondary/80 transition-all border-b-4 border-black active:border-b-0 active:translate-y-1">
              {N.t('home')}
            </button>
          </div>

        </motion.div>
      </div>
    </div>
  );
}
