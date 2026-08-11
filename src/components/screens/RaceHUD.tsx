import React from 'react';
import { SprinterApp, useGameStore } from '@/game/engine';
import { motion, AnimatePresence } from 'framer-motion';

export function RaceHUD() {
  const { 
    state, elapsed, countT, champion, championTime, levelIdx, runners, player,
    shake, falseFlash, reactFlash, stumbleFlash
  } = useGameStore();
  
  const { N, C } = SprinterApp;
  
  // Countdown overlay
  const isCount = state === 'count';
  const left = 3 - countT;
  const n = Math.ceil(left);
  const frac = left - Math.floor(left);
  
  // Race state
  const isRace = state === 'race';
  const T = SprinterApp.G.track;
  
  // Order logic matches original
  const order = [...runners].sort((a, b) => {
    const fa = a.finished ? 0 : 1;
    const fb = b.finished ? 0 : 1;
    if (fa !== fb) return fa - fb;
    return a.finished ? a.finishTime - b.finishTime : b.d - a.d;
  });
  
  const pos = order.indexOf(player) + 1;
  const posTxt = N.ord(pos);
  const ph = player?.phase ? player.phase() : 0;
  const total = T?.total || 100;
  // Rythme : lu a chaque frame sur le coureur, pour une jauge qui suit
  // reellement les appuis plutot qu'un etat fige.
  const rhythm = Math.max(0, Math.min(1, player?.rhythm ?? 0));
  const rhyCol = rhythm >= 0.75 ? 'text-primary'
    : rhythm >= 0.45 ? 'text-emerald-400' : 'text-orange-400';
  const rhyBar = rhythm >= 0.75 ? 'bg-primary'
    : rhythm >= 0.45 ? 'bg-emerald-400' : 'bg-orange-400';

  return (
    <div className="w-full h-full pointer-events-none absolute inset-0 font-sans z-10">
      
      {/* Top HUD Bar */}
      <div className="absolute top-0 left-0 w-full bg-card/80 landscape:bg-transparent backdrop-blur-md landscape:backdrop-blur-none border-b-2 landscape:border-b-0 border-primary/50 landscape:shadow-none text-foreground flex flex-row flex-wrap landscape:flex-nowrap justify-between items-center px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)] pt-[max(env(safe-area-inset-top),0.5rem)] pb-2 sm:py-3 shadow-lg gap-y-2">
        <div className="flex justify-between w-1/2 landscape:w-auto landscape:flex-1 items-center gap-2 sm:gap-4 order-1 min-w-0">
          <div className="flex-1 min-w-0 font-bold text-muted-foreground text-[10px] sm:text-xs md:text-sm tracking-widest uppercase truncate landscape:drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
            {N.levelName(levelIdx)}
          </div>
          <div className={`shrink-0 font-black landscape:font-semibold font-display text-xl sm:text-2xl md:text-3xl landscape:!text-sm landscape:drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] ${pos === 1 ? 'text-primary' : 'text-foreground'}`}>
            {posTxt}
          </div>
        </div>

        <div className="w-1/2 landscape:w-auto landscape:flex-1 flex justify-end items-center gap-2 sm:gap-4 order-2 landscape:order-3">
          {/* Jauge de rythme : etat en direct de la regularite des appuis.
              Remplace l'ancienne note de transition, qui n'apparaissait
              qu'une fois, apres coup, sans qu'on sache pourquoi. */}
          {isRace && (
            <div className="flex flex-col items-end gap-0.5 min-w-[68px] sm:min-w-[86px]">
              <div className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-widest landscape:drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] ${rhyCol}`}>
                {N.t('rhythm')} {Math.round(rhythm * 100)}%
              </div>
              <div className="w-full h-1.5 sm:h-2 bg-black/50 rounded-full overflow-hidden border border-white/10">
                <div
                  className={`h-full rounded-full transition-[width] duration-100 ${rhyBar}`}
                  style={{ width: `${Math.round(rhythm * 100)}%` }}
                />
              </div>
            </div>
          )}
          <div className="font-black font-mono text-2xl sm:text-3xl md:text-4xl text-primary tabular-nums landscape:drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
            {elapsed.toFixed(2)}
          </div>
        </div>

        <div className="w-full landscape:hidden flex justify-center order-3 px-4">
          {/* Progress Bar : retiree en paysage (place au classement/chrono,
              plus de largeur pour voir la course), gardee en portrait ou
              elle ne gene pas. */}
          <div className="w-full max-w-[280px] bg-black/50 h-2 md:h-2.5 rounded-full overflow-hidden flex relative border border-white/10">
            {/* Drive section */}
            <div className="h-full bg-primary/20" style={{ width: `${(C.DRIVE_END / total) * 100}%` }} />
            {/* Transition section */}
            <div className="h-full bg-cyan-400/20" style={{ width: `${((C.TRANS_END - C.DRIVE_END) / total) * 100}%` }} />
            
            {/* Player marker */}
            <div 
              className="absolute top-0 left-0 h-full bg-primary transition-all duration-75"
              style={{ width: `${(Math.min(player?.d || 0, total) / total) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Countdown Center Display */}
      {isCount && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] z-20 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
          {n > 0 && (
            <div className="mb-3 md:mb-5 bg-card/70 backdrop-blur-md px-4 py-1.5 md:px-6 md:py-2 rounded-full border border-white/10 shadow-lg">
              <span className="font-bold text-foreground tracking-widest text-xs sm:text-sm md:text-lg uppercase">
                {n >= 3 ? N.t('ready') : N.t('get_set')}
              </span>
            </div>
          )}
          <div
            className="w-24 h-24 sm:w-32 sm:h-32 md:w-48 md:h-48 rounded-full border-4 border-primary bg-card/60 flex items-center justify-center shadow-[0_0_50px_rgba(248,205,74,0.3)]"
            style={{ transform: `scale(${1 + 0.1 * (1 - frac)})` }}
          >
            <span className={`text-4xl sm:text-6xl md:text-8xl font-black font-display tracking-tighter ${n > 0 ? 'text-white drop-shadow-md' : 'text-primary'}`}>
              {n > 0 ? n : N.t('go')}
            </span>
          </div>
          {champion && (
            <div className="mt-6 md:mt-12 bg-black/60 px-4 py-1.5 md:px-6 md:py-2 rounded-full border border-fuchsia-500/30 max-w-[90vw] text-center">
              <span className="font-bold text-fuchsia-400 tracking-widest text-[10px] sm:text-xs md:text-base block truncate">
                {N.t('to_beat')} {champion} &mdash; {championTime.toFixed(2)} s
              </span>
            </div>
          )}
        </div>
      )}

      {/* Feedback Overlays */}
      <div className="absolute top-[130px] landscape:top-[80px] w-full flex flex-col items-center gap-1 sm:gap-2 px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)] pointer-events-none z-0">
        <AnimatePresence>
          {falseFlash > 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-xl sm:text-2xl md:text-3xl font-black text-destructive tracking-widest drop-shadow-md">
              {N.t('false_start')}
            </motion.div>
          )}
          {stumbleFlash > 0 && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: Math.min(stumbleFlash, 1), y: 0 }} exit={{ opacity: 0 }} className="text-2xl sm:text-3xl md:text-4xl font-black font-display text-destructive tracking-widest uppercase drop-shadow-lg">
              {N.t('stumble')}
            </motion.div>
          )}
        </AnimatePresence>

        {reactFlash > 0 && player && player.reaction !== null && !player.jumped && (
          <div className="flex flex-col items-center" style={{ opacity: Math.min(reactFlash, 1) }}>
            <div className={`text-base sm:text-lg md:text-xl font-black tracking-widest uppercase ${player.reactBonus > C.REACT_BONUS * 0.82 ? 'text-primary' : 'text-foreground'}`}>
              {player.reactBonus > C.REACT_BONUS * 0.82 ? N.t('react_top') : N.t('reaction')}
            </div>
            <div className="text-xs sm:text-sm md:text-base font-bold text-cyan-400 font-mono tracking-wide bg-black/50 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full mt-1">
              {player.reaction.toFixed(3)} s &nbsp;+{player.reactBonus.toFixed(2)} m/s
            </div>
          </div>
        )}
        
        {ph === 0 && elapsed > 0.1 && reactFlash <= 0 && !player?.finished && (
          <div className="text-xs md:text-sm font-medium text-muted-foreground tracking-widest uppercase mt-4 md:mt-8 animate-pulse">
            {N.t('drive_hint')}
          </div>
        )}
      </div>

      {/* Leaderboard Overlay (Desktop only) */}
      <div className="hidden md:block absolute left-4 top-[100px] w-64 bg-card/60 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden shadow-2xl">
        {order.map((r, i) => {
          const col = r.isPlayer ? 'text-primary' : r.name === champion ? 'text-fuchsia-400' : 'text-foreground/90';
          return (
            <div key={i} className={`flex justify-between items-center px-4 py-2 border-b border-white/5 last:border-0 ${r.isPlayer ? 'bg-primary/10' : ''}`}>
              <span className={`text-xs font-bold tracking-wide ${col}`}>
                {i + 1}. {(r.isPlayer ? N.t('you') : r.name).slice(0, 15)}
              </span>
              <span className={`text-xs font-mono font-bold ${col}`}>
                {Math.round(r.d)} m
              </span>
            </div>
          );
        })}
      </div>
      
      {/* gap to next runner (Mobile only) */}
      <div className="block md:hidden absolute right-[max(env(safe-area-inset-right),1rem)] top-[110px] landscape:top-[70px] z-10">
        {(() => {
          const me = order.indexOf(player);
          const other = me === 0 ? order[1] : order[me - 1];
          if (other) {
            const gap = other.d - player.d;
            return (
              <div className={`bg-card/80 backdrop-blur-md px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-white/10 text-[10px] sm:text-xs font-bold tracking-wide flex gap-1.5 sm:gap-2 ${gap > 0 ? 'text-destructive' : 'text-emerald-400'}`}>
                <span>{gap > 0 ? '+' : ''}{gap.toFixed(1)} m</span>
                <span className="opacity-80 truncate max-w-[60px]">{other.isPlayer ? '' : other.name.split(' ')[0]}</span>
              </div>
            );
          }
          return null;
        })()}
      </div>

    </div>
  );
}
