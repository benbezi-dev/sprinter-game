import React from 'react';
import { SprinterApp } from '@/game/engine';
import { motion } from 'framer-motion';
import { GraduationCap, Play } from 'lucide-react';

/**
 * « Tu veux apprendre le geste, ou tu cours ? »
 *
 * Le tutoriel s'ouvrait tout seul a la premiere course, avec un lien « passer »
 * en petit dans un coin. C'est une porte fermee qu'il faut pousser : le joueur
 * a appuye sur COMMENCER, il voulait courir, et on lui donne autre chose.
 *
 * On le lui demande donc, en deux boutons de meme poids visuel. Les deux
 * reponses valent acceptation : on ne repose pas la question a la course
 * suivante, et le tutoriel reste accessible depuis l'accueil pour qui change
 * d'avis.
 */
export function TutoPropose({ onChoix }: { onChoix: (apprendre: boolean) => void }) {
  const { N } = SprinterApp;
  return (
    <div className="fixed inset-0 z-[58] bg-black/85 backdrop-blur-sm flex items-center justify-center
                    pointer-events-auto p-4">
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="w-full max-w-sm bg-card/95 border border-white/10 rounded-2xl shadow-2xl
                   p-5 md:p-6 flex flex-col items-center gap-4 text-center"
      >
        <div className="flex flex-col items-center gap-1">
          <h2 className="text-xl md:text-2xl font-black font-display tracking-tight uppercase text-primary">
            {N.t('tuto_ask_t')}
          </h2>
          <p className="text-xs md:text-sm text-foreground/70 max-w-[26ch] leading-snug">
            {N.t('tuto_ask_s')}
          </p>
        </div>

        <div className="w-full flex flex-col gap-2">
          <button
            onClick={() => onChoix(true)}
            className="w-full py-3.5 rounded-xl font-black font-display text-base md:text-lg
                       tracking-widest text-background bg-primary hover:bg-primary/90
                       transition-all border-b-4 border-amber-600 active:border-b-0 active:translate-y-1
                       flex items-center justify-center gap-2"
          >
            <GraduationCap className="w-4 h-4" />
            {N.t('tuto_ask_yes')}
          </button>
          <button
            onClick={() => onChoix(false)}
            className="w-full py-3 rounded-xl font-bold tracking-widest text-[11px] md:text-xs
                       text-foreground bg-white/5 border border-white/15 hover:bg-white/10
                       transition-colors flex items-center justify-center gap-2"
          >
            <Play className="w-3.5 h-3.5" />
            {N.t('tuto_ask_no')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
