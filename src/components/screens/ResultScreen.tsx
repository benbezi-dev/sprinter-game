import React from 'react';
import { SprinterApp, useGameStore } from '@/game/engine';
import { motion } from 'framer-motion';
import { EcranFin } from './EcranFin';

export function ResultScreen() {
  const {
    levelIdx, player, runTime, ranking, badge, mode, shotRaces, shotIdx
  } = useGameStore();
  const { N } = SprinterApp;
  const oneShot = mode === 'oneshot';

  const startRecap = () => {
    if (!player || player.reaction === null) return N.t('no_start');
    const g = player.transGrade === null ? 0 : player.transGrade;
    return N.t('start_line', { r: player.jumped ? '--' : player.reaction.toFixed(3), g: N.t('trans_' + g) });
  };

  // En one-shot il n'y a pas d'etape suivante au sens de la carriere :
  // on enchaine sur l'epreuve suivante du programme choisi.
  const handleNext = () => {
    if (oneShot) SprinterApp.nextShotRace();
    else SprinterApp.startLevel(levelIdx + 1);
  };

  const handleHome = () => SprinterApp.goHome();

  // Les deux boutons vivent dans la barre du bas, hors du rouleau : une
  // grille d'arrivee de huit coureurs les poussait hors de l'ecran, et
  // « ETAPE SUIVANTE » est precisement ce qu'on cherche en arrivant ici.
  const actions = (
    <div className="flex gap-2 md:gap-3">
      <button onClick={handleNext} className="flex-1 min-w-0 px-2 py-3 rounded-xl font-black font-display text-base sm:text-lg tracking-widest leading-tight text-background bg-primary hover:bg-primary/90 transition-all border-b-4 border-amber-600 active:border-b-0 active:translate-y-1">
        {oneShot ? N.t('next_event') : N.t('next_stage', { n: levelIdx + 2 })}
      </button>
      <button onClick={handleHome} className="flex-1 min-w-0 px-2 py-3 rounded-xl font-bold tracking-widest text-sm leading-tight text-foreground bg-secondary hover:bg-secondary/80 transition-all border-b-4 border-black active:border-b-0 active:translate-y-1">
        {N.t('home')}
      </button>
    </div>
  );

  return (
    <EcranFin fond="bg-black/80 backdrop-blur-sm" actions={actions}>
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex flex-col items-center max-w-2xl w-full py-4 md:py-8 gap-3 md:gap-5">
          
          <div className="flex flex-col items-center text-center gap-1 md:gap-2">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black font-display text-emerald-400 tracking-tight uppercase drop-shadow-md">
              {oneShot
                ? N.t('event_n', { n: shotIdx + 1, t: shotRaces.length })
                : N.t('stage_done', { n: levelIdx + 1 })}
            </h1>

            {/* total_of commence par " s   -   cumul " : le "s" du chrono de
                l'epreuve vient de la, il ne faut pas le doubler. */}
            <div className="text-sm sm:text-base font-medium text-foreground/80 tracking-wide">
              {oneShot
                ? <>{SprinterApp.RACES[SprinterApp.G.raceKey].label}{' '}</>
                : N.t('first_in')}
              {player?.finishTime != null
                ? <><span className="text-white font-bold">{player.finishTime.toFixed(2)}</span>{N.t('total_of')}</>
                : <><span className="text-destructive font-bold">{N.t('dnf')}</span>{N.t('total_of').replace(' s ', ' ')}</>}
              <span className="text-white font-bold">{runTime.toFixed(2)}</span> s
            </div>
            
            <div className="text-[10px] sm:text-xs md:text-sm font-bold tracking-widest text-cyan-400 uppercase">
              {startRecap()}
            </div>
          </div>

          {/* Leaderboard Card */}
          <div className="w-full bg-card/70 border border-white/10 rounded-2xl p-3 sm:p-4 md:p-6 shadow-2xl">
            <div className="flex flex-col gap-1.5 md:gap-2">
              {ranking.map((r, i) => {
                const isMe = r.isPlayer;
                const mc = i === 0 ? 'text-primary' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-muted-foreground';
                const nc = isMe ? 'text-primary' : r.isGhost ? 'text-cyan-300'
                  : r.name === SprinterApp.G.champion ? 'text-fuchsia-400' : 'text-foreground';
                const tc = r.finishTime ? 'text-foreground' : 'text-destructive';
                
                return (
                  <div key={i} className={`flex items-center justify-between px-3 py-2 md:px-4 md:py-3 rounded-xl border ${isMe ? 'bg-primary/10 border-primary/30' : r.isGhost ? 'bg-cyan-400/5 border-cyan-400/25' : 'border-white/5 bg-black/20'}`}>
                    <div className="flex items-center gap-2 md:gap-4 overflow-hidden pr-2">
                      <span className={`font-bold w-6 md:w-8 shrink-0 text-sm md:text-base ${mc}`}>{N.ord(i + 1)}</span>
                      <span className={`font-bold tracking-wide truncate text-sm md:text-base ${nc}`}>{isMe ? N.t('you') : r.name}</span>
                      {r.isGhost && (
                        <span className="shrink-0 text-[9px] md:text-[10px] font-bold tracking-widest text-cyan-300/80 border border-cyan-400/30 rounded px-1.5 py-0.5">
                          {N.t('ghost_label')}
                        </span>
                      )}
                    </div>
                    <span className={`font-mono font-bold shrink-0 text-sm md:text-base ${tc}`}>
                      {r.finishTime ? `${r.finishTime.toFixed(2)} s` : N.t('dnf')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Badge */}
          {badge && (
            <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-primary text-background font-black font-display tracking-widest uppercase px-4 py-2 md:px-6 md:py-3 rounded-xl text-lg sm:text-xl md:text-2xl shadow-[0_0_30px_rgba(248,205,74,0.4)] text-center">
              {N.t(badge[0])}
            </motion.div>
          )}

        </motion.div>
    </EcranFin>
  );
}
