import React from 'react';
import { motion } from 'motion/react';
import { MONTEE, FONDU } from '@/lib/mouvement';
import { SprinterApp, useGameStore } from '@/game/engine';

export function OpenScreen() {
  const openT = useGameStore(s => s.openT);
  const { N } = SprinterApp;
  const word = "SPRINTER".split("");

  /**
   * Passer l'ouverture.
   *
   * L'ecran annonce « touche l'ecran pour commencer » depuis toujours, et
   * personne n'ecoutait : la seule sortie de l'etat « open » etait le
   * chronometre de engine.ts, a 6,4 s. Le geste existait pourtant dans
   * l'ancienne interface canvas (sprinter-ui.js, fonction tap), et il s'est
   * perdu au portage vers React — le chronometre a ete recopie, le geste non.
   * Resultat : six secondes quatre imposees a chaque lancement, y compris a
   * celui qui rouvre le jeu pour la dixieme fois de la journee, devant une
   * invitation a toucher qui ne repondait pas.
   *
   * Audio_.init() ici et pas ailleurs : un navigateur n'autorise le son
   * qu'apres un geste, et celui-ci est desormais le premier de la partie.
   */
  const passer = () => {
    SprinterApp.Audio_.init();
    SprinterApp.G.state = 'title';
  };

  return (
    <div onPointerDown={passer}
         className="w-full h-full flex flex-col items-center justify-between pointer-events-auto relative pt-[max(env(safe-area-inset-top),2rem)] pb-[max(env(safe-area-inset-bottom),2rem)]">
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
            100 &nbsp;&mdash;&nbsp; 200 &nbsp;&mdash;&nbsp; 400 {N.t('metres')}
          </motion.div>
        )}

        {/* Tout le texte de cet ecran etait ecrit en anglais, en dur, sur le
            premier ecran d'un jeu qui s'ouvre en francais. Ses traductions
            attendaient depuis le debut dans sprinter-i18n.js, sous les cles
            « tagline » et « tap_start », rangees dans la section « ouverture
            et accueil » — cet ecran-ci est le seul qui ne les lisait pas. */}
        {openT > 4.0 && (
          <motion.div
            {...FONDU}
            className="text-[10px] sm:text-sm md:text-base font-medium text-muted-foreground uppercase tracking-widest max-w-[280px] sm:max-w-none"
          >
            {N.t('tagline')}
          </motion.div>
        )}
      </div>

      {openT > 4.6 && (
        <div className="absolute bottom-[max(env(safe-area-inset-bottom),2rem)] text-xs sm:text-sm md:text-base font-bold text-foreground/80 tracking-widest uppercase animate-pulse z-10">
          {N.t('tap_start')}
        </div>
      )}
    </div>
  );
}
