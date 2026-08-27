import React, { useEffect, useState } from 'react';
import { SprinterApp } from '@/game/engine';
import { motion } from 'framer-motion';

/**
 * Cinematique du faux depart eliminatoire.
 *
 * En one-shot et en defi la course est unique : partir avant le signal ne
 * coute plus un blocage, cela met fin a l'epreuve. Un simple bandeau ne
 * dirait pas assez que tout est fini — d'ou cette sequence, jouee par-dessus
 * la piste figee, avec la phrase de defaite lancee par le moteur au moment
 * de l'elimination.
 */
export function FalseStartCut() {
  const { N } = SprinterApp;
  const [passe, setPasse] = useState(false);

  const suite = () => {
    if (passe) return;
    setPasse(true);
    SprinterApp.G.state = 'winall';
  };

  // La sequence dure le temps de la phrase de defaite. On peut la couper,
  // mais pas dans la premiere seconde : un doigt encore sur le pad la
  // sauterait avant meme de l'avoir vue.
  useEffect(() => {
    const fin = setTimeout(suite, 5200);
    return () => clearTimeout(fin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [armé, setArmé] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setArmé(true), 1100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      onClick={() => armé && suite()}
      className="fixed inset-0 z-50 pointer-events-auto flex flex-col items-center justify-center
                 px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]"
    >
      {/* Coup de rouge : bref, violent, puis un voile qui reste */}
      <motion.div
        className="absolute inset-0 bg-destructive"
        initial={{ opacity: 0.85 }}
        animate={{ opacity: [0.85, 0.1, 0.55, 0.12] }}
        transition={{ duration: 0.9, times: [0, 0.25, 0.4, 1] }}
      />
      <motion.div
        className="absolute inset-0 bg-black"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.78 }}
        transition={{ duration: 1.1, delay: 0.35 }}
      />

      {/* Bandes de couloir qui se referment : le geste d'un couloir qu'on ferme */}
      {[0, 1].map(i => (
        <motion.div
          key={i}
          className="absolute left-0 right-0 h-px bg-destructive/70"
          style={{ top: i === 0 ? '32%' : '68%' }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.7, delay: 0.5 + i * 0.12, ease: 'easeOut' }}
        />
      ))}

      <div className="relative flex flex-col items-center text-center gap-2 md:gap-4">
        <motion.span
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="text-[10px] md:text-xs font-bold tracking-[0.4em] uppercase text-destructive/90"
        >
          {N.t('false_out_gun')}
        </motion.span>

        <motion.h1
          initial={{ scale: 1.6, opacity: 0, letterSpacing: '0.3em' }}
          animate={{ scale: 1, opacity: 1, letterSpacing: '0em' }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl sm:text-6xl md:text-8xl font-black font-display uppercase
                     text-destructive drop-shadow-[0_0_40px_rgba(239,68,68,0.55)]"
        >
          {N.t('false_out')}
        </motion.h1>

        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5, delay: 0.75 }}
          className="h-0.5 w-40 md:w-64 bg-destructive origin-center"
        />

        <motion.span
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.05 }}
          className="text-base md:text-2xl font-black tracking-widest uppercase text-foreground"
        >
          {N.t('false_out_sub')}
        </motion.span>

        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6 }}
          className="text-[10px] md:text-xs tracking-widest uppercase text-muted-foreground"
        >
          {N.t('false_out_rule')}
        </motion.span>
      </div>

      <motion.button
        onClick={suite}
        initial={{ opacity: 0 }}
        animate={{ opacity: armé ? 1 : 0 }}
        className="absolute bottom-[max(env(safe-area-inset-bottom),1.5rem)]
                   px-6 py-2 rounded-xl border border-white/15 bg-white/5
                   text-[10px] md:text-xs font-bold tracking-[0.3em] text-foreground/70
                   hover:bg-white/10 transition-colors"
      >
        {N.t('cut_skip')}
      </motion.button>
    </div>
  );
}
