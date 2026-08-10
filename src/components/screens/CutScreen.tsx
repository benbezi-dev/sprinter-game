import React from 'react';
import { SprinterApp, useGameStore } from '@/game/engine';

export function CutScreen() {
  const { cut, skipArm } = useGameStore();
  const { N } = SprinterApp;
  
  if (!cut) return null;
  
  const ct = cut.t;
  const intro = cut.kind === 'intro';
  const champ = cut.kind === 'champion';

  // State text overlays
  const showTitle = ct > 0.35;
  const titleAlpha = SprinterApp.clamp((ct - 0.35) / 0.4, 0, 1);
  
  return (
    <div 
      className="w-full h-full absolute inset-0 pointer-events-auto"
      onClick={() => {
        if (skipArm > 0) SprinterApp.nextCut(); 
        else SprinterApp.G.skipArm = 1.6;
      }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      
      {/* Title block */}
      {showTitle && (
        <div 
          className="absolute portrait:left-[max(env(safe-area-inset-left),1.5rem)] portrait:top-[50vh] landscape:left-[45vw] landscape:top-[15vh] max-w-lg w-[calc(100vw-3rem)] landscape:w-[50vw] flex flex-col items-start z-10"
          style={{ opacity: titleAlpha }}
        >
          <div className="text-[10px] sm:text-xs md:text-sm font-bold tracking-widest uppercase mb-1 md:mb-2" style={{ color: champ ? '#F8CD4A' : '#38BDF8' }}>
            {champ ? N.t('crowned') : intro ? N.t('rival') : N.t('after_race')}
          </div>
          <h2 className={`text-3xl sm:text-4xl md:text-5xl font-black font-display tracking-tight uppercase ${champ ? 'text-primary' : 'text-foreground'}`}>
            {champ ? N.t('fastest_1') : cut.name}
          </h2>
          <div className="h-1 w-11/12 mt-1 md:mt-2" style={{ backgroundColor: champ ? '#F8CD4A' : '#38BDF8' }} />
          
          {champ && (
            <div className="mt-2 md:mt-4">
              <div className="text-lg sm:text-xl md:text-2xl font-medium text-foreground/90">{N.t('fastest_2')}</div>
              <div className="text-sm sm:text-base md:text-lg font-bold text-primary mt-1 md:mt-2">
                {N.t('full_run_in')} {SprinterApp.G.runTime.toFixed(2)} s
              </div>
            </div>
          )}
          {!champ && intro && (
            <div className="mt-2 md:mt-4 text-sm sm:text-base md:text-lg font-bold text-primary">
              {N.t('announced')} {SprinterApp.G.championTime.toFixed(2)} s
            </div>
          )}
        </div>
      )}

      {/* Story lines */}
      <div className="absolute portrait:left-[max(env(safe-area-inset-left),1.5rem)] portrait:top-[70vh] landscape:left-[45vw] landscape:top-[45vh] max-w-lg w-[calc(100vw-3rem)] landscape:w-[50vw] flex flex-col gap-1.5 md:gap-3 z-10">
        {cut.lines.map((line: string, i: number) => {
          const lt = ct - (1.3 + i * 2.6);
          if (lt <= 0) return null;
          const a = SprinterApp.clamp(lt / 0.45, 0, 1);
          return (
            <div 
              key={i} 
              className="text-xs sm:text-sm md:text-base font-medium text-foreground/90 leading-snug drop-shadow-md"
              style={{ opacity: a }}
            >
              {line}
            </div>
          );
        })}
      </div>
      
      {/* Top and Bottom hints */}
      <div className="absolute top-[max(env(safe-area-inset-top),1.5rem)] w-full text-center px-4 z-10">
        <span className={`text-[10px] sm:text-xs md:text-sm font-bold tracking-widest uppercase truncate block ${champ ? 'text-primary' : 'text-muted-foreground'}`}>
          {champ ? N.t('six_cleared') : `${N.t('stage_up')}${SprinterApp.G.levelIdx + 1}  —  ${N.levelName(SprinterApp.G.levelIdx)}`}
        </span>
      </div>

      <div className="absolute bottom-[max(env(safe-area-inset-bottom),1.5rem)] w-full text-center z-10">
        <span className={`text-[10px] sm:text-xs md:text-base font-bold tracking-widest ${skipArm > 0 ? 'text-primary animate-pulse' : 'text-muted-foreground'}`}>
          {skipArm > 0 ? N.t('skip_now') : N.t('skip_twice')}
        </span>
      </div>
      
    </div>
  );
}
