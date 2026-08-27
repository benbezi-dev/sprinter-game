import React from 'react';
import { SprinterApp, useGameStore } from '@/game/engine';
import { motion, AnimatePresence } from 'framer-motion';

export function RaceHUD() {
  const { 
    state, elapsed, countT, champion, championTime, levelIdx, runners, player,
    shake, falseFlash, reactFlash, transFlash, stumbleFlash,
    mode, shotRaces, shotIdx, ghostName,
    ghostOn, ghostD, ghostDone
  } = useGameStore();

  const { N, C } = SprinterApp;

  // Dans un defi, l'adversaire a battre est le fantome, pas le favori de l'IA.
  const ghostSplit: number | undefined = (SprinterApp.G.ghostSplits || [])[shotIdx];
  const rival = ghostName && ghostSplit != null
    ? { name: ghostName, time: ghostSplit }
    : champion ? { name: champion, time: championTime } : null;
  
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
  
  // Mode fantome : l'ecart avec l'adversaire, en direct. Les metres se lisent
  // sans reflechir, mais c'est en secondes qu'on pense une course — on donne
  // les deux, la seconde etant l'ecart converti a la vitesse du moment.
  const ecartM = ghostOn ? (player?.d || 0) - ghostD : 0;
  // La conversion se fait sur SA vitesse a soi, jamais sur celle du fantome :
  // le fantome avance en rejouant une trace echantillonnee, sa vitesse
  // instantanee saute d'une image a l'autre et donnerait un ecart qui
  // clignote. Sous 2 m/s on ne convertit pas du tout — au depart le rapport
  // partirait a l'infini.
  const vRef = player?.v || 0;
  const ecartS = vRef > 2 ? ecartM / vRef : null;
  const devant = ecartM > 0.15;
  const derriere = ecartM < -0.15;

  const pos = order.indexOf(player) + 1;
  const posTxt = N.ord(pos);
  const ph = player?.phase ? player.phase() : 0;
  const total = T?.total || 100;

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
          <div className={`text-[10px] sm:text-xs font-bold uppercase tracking-widest landscape:drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] ${ph === 0 ? 'text-primary' : ph === 1 ? 'text-cyan-400' : 'text-muted-foreground'}`}>
            {N.t(['phase_drive', 'phase_trans', 'phase_max'][ph])}
          </div>
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

      {/* Mode fantome : le seul repere qui compte pendant un duel. Il occupe
          la bande libre sous le HUD, la ou l'oeil revient naturellement entre
          deux foulees, et il disparait des que la course est finie. */}
      {isRace && ghostOn && !player?.finished && (
        <div className="absolute top-[104px] landscape:top-[46px] w-full flex justify-center
                        px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)] z-10">
          <div className={`w-full max-w-[300px] rounded-2xl border backdrop-blur-md px-3 py-1.5
                           flex flex-col gap-1 shadow-lg
            ${devant ? 'border-emerald-400/50 bg-emerald-500/[0.12]'
              : derriere ? 'border-destructive/50 bg-destructive/[0.12]'
              : 'border-cyan-400/40 bg-black/50'}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[8px] sm:text-[9px] font-bold tracking-[0.25em] text-cyan-300/90 truncate">
                {ghostName || N.t('ghost_mode')}
              </span>
              <span className={`text-[8px] sm:text-[9px] font-bold tracking-widest
                ${devant ? 'text-emerald-400' : derriere ? 'text-destructive' : 'text-muted-foreground'}`}>
                {devant ? N.t('ghost_ahead') : derriere ? N.t('ghost_behind') : N.t('ghost_level')}
              </span>
            </div>

            <div className="flex items-baseline justify-center gap-2 leading-none">
              <span className={`font-mono font-black tabular-nums text-xl sm:text-2xl
                ${devant ? 'text-emerald-400' : derriere ? 'text-destructive' : 'text-cyan-300'}`}>
                {ecartM > 0 ? '+' : ''}{ecartM.toFixed(1)}
                <span className="text-[9px] font-normal ml-0.5">m</span>
              </span>
              {ecartS !== null && (
                <span className="font-mono tabular-nums text-[10px] sm:text-xs text-foreground/70">
                  {ecartS > 0 ? '+' : ''}{ecartS.toFixed(2)} s
                </span>
              )}
            </div>

            {/* Les deux coureurs sur la meme reglette : la position relative
                se saisit d'un coup d'oeil, meme sans lire les chiffres. */}
            <div className="relative h-1.5 rounded-full bg-black/60 border border-white/10 overflow-hidden">
              <div className="absolute inset-y-0 left-0 bg-cyan-400/40"
                   style={{ width: `${Math.min(100, (ghostD / total) * 100)}%` }} />
              <div className="absolute inset-y-0 w-[3px] bg-cyan-300 rounded-full"
                   style={{ left: `calc(${Math.min(100, (ghostD / total) * 100)}% - 1.5px)` }} />
              <div className="absolute inset-y-0 w-[3px] bg-primary rounded-full shadow-[0_0_6px_rgba(248,205,74,0.9)]"
                   style={{ left: `calc(${Math.min(100, ((player?.d || 0) / total) * 100)}% - 1.5px)` }} />
            </div>

            {ghostDone && (
              <span className="text-[8px] sm:text-[9px] text-center tracking-wide text-cyan-300/70">
                {N.t('ghost_home')}
              </span>
            )}
          </div>
        </div>
      )}

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
          {mode === 'oneshot' && shotRaces.length > 1 && (
            <div className="mt-4 md:mt-8 text-[10px] sm:text-xs md:text-sm font-bold tracking-widest text-primary/80 uppercase">
              {N.t('event_n', { n: shotIdx + 1, t: shotRaces.length })}
            </div>
          )}
          {rival && (
            <div className={`mt-6 md:mt-12 bg-black/60 px-4 py-1.5 md:px-6 md:py-2 rounded-full border max-w-[90vw] text-center
              ${ghostName ? 'border-cyan-400/40' : 'border-fuchsia-500/30'}`}>
              <span className={`font-bold tracking-widest text-[10px] sm:text-xs md:text-base block truncate
                ${ghostName ? 'text-cyan-300' : 'text-fuchsia-400'}`}>
                {N.t('to_beat')} {rival.name} &mdash; {rival.time.toFixed(2)} s
              </span>
            </div>
          )}
          {ghostName && (
            <div className="mt-2 md:mt-3 flex flex-col items-center gap-0.5">
              <span className="text-[10px] md:text-xs font-black tracking-[0.3em] text-cyan-300">
                {N.t('ghost_mode')}
              </span>
              <span className="text-[9px] md:text-[10px] text-muted-foreground tracking-wide">
                {N.t('ghost_live')}
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
        
        {transFlash > 0 && player && player.transGrade !== null && (
          <div className="flex flex-col items-center mt-2 md:mt-4" style={{ opacity: Math.min(transFlash, 1) }}>
            <div className={`text-lg sm:text-xl md:text-2xl font-black tracking-widest uppercase ${player.transGrade === 2 ? 'text-primary' : player.transGrade === 1 ? 'text-emerald-400' : 'text-muted-foreground'}`}>
              {N.t(`trans_${player.transGrade}`)}
            </div>
            {player.transGrade > 0 && (
              <div className="text-xs sm:text-sm md:text-base font-bold text-cyan-400 font-mono tracking-wide bg-black/50 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full mt-1">
                +{C.TRANS_BOOST[player.transGrade].toFixed(2)} m/s &nbsp;&mdash;&nbsp; {Math.round((1 - C.TRANS_DRAG[player.transGrade]) * 100)}% drag
              </div>
            )}
          </div>
        )}
        
        {ph === 0 && elapsed > 0.1 && transFlash <= 0 && reactFlash <= 0 && !player?.finished && (
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
