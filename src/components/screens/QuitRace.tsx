import React from 'react';
import { SprinterApp, useGameStore, pauseRace, resumeRace } from '@/game/engine';
import { motion, AnimatePresence } from 'motion/react';
import { VOILE, PANNEAU } from '@/lib/mouvement';

/**
 * Sortie de course, discrete.
 *
 * Deux exigences qui se contredisent : la commande doit se fondre dans le jeu,
 * et rester impossible a declencher par megarde alors que les pouces martelent
 * l'ecran. On la place donc loin des pads, tres effacee, et surtout l'appui ne
 * quitte rien : il suspend la course. Un appui accidentel ne coute alors que
 * le geste de reprendre, et le chrono ne tourne pas pendant l'hesitation.
 */
export function QuitRace() {
  const { state, paused } = useGameStore();
  const { N } = SprinterApp;

  if (state !== 'race' && state !== 'count') return null;

  return (
    <>
      {!paused && (
        <button
          onClick={pauseRace}
          aria-label={N.t('home')}
          className="fixed z-30 pointer-events-auto rounded-full
                     bg-black/25 hover:bg-black/50 active:bg-black/60
                     border border-white/10 backdrop-blur-sm
                     transition-colors flex items-center justify-center
                     w-8 h-8 md:w-9 md:h-9"
          style={{
            // Coin haut gauche, sous le bandeau : la ou aucun pouce ne passe
            // pendant la course.
            left: 'calc(max(env(safe-area-inset-left), 0.5rem))',
            top: 'calc(max(env(safe-area-inset-top), 0.5rem) + 4.6rem)',
          }}
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 md:w-[18px] md:h-[18px]"
               fill="none" stroke="currentColor" strokeWidth="2.2"
               strokeLinecap="round" strokeLinejoin="round"
               style={{ color: 'rgba(255,255,255,0.38)' }} aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      <AnimatePresence>
        {paused && (
          <motion.div
            {...VOILE}
            className="fixed inset-0 z-[55] flex items-center justify-center
                       bg-black/70 backdrop-blur-md pointer-events-auto
                       px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]"
          >
            <motion.div
              {...PANNEAU}
              className="w-full max-w-xs bg-card/90 border border-white/10 rounded-2xl
                         p-5 md:p-6 shadow-2xl flex flex-col items-center gap-4"
            >
              <h2 className="font-black font-display tracking-tight text-primary text-xl md:text-2xl text-center">
                {N.t('pause_title')}
              </h2>
              <p className="text-[10px] md:text-xs text-muted-foreground text-center leading-snug">
                {N.t('pause_note')}
              </p>
              <button
                onClick={resumeRace}
                className="w-full py-3 rounded-xl font-black font-display text-lg md:text-xl
                           tracking-widest text-background bg-primary hover:bg-primary/90
                           transition-all border-b-4 border-amber-600
                           active:border-b-0 active:translate-y-1"
              >
                {N.t('resume')}
              </button>
              <button
                onClick={() => SprinterApp.goHome()}
                className="w-full py-2.5 rounded-xl font-bold tracking-widest text-sm
                           text-muted-foreground hover:text-foreground bg-secondary/60
                           hover:bg-secondary transition-colors"
              >
                {N.t('home')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
