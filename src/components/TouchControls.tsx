import React from 'react';
import { useInputHandlers } from '@/hooks/use-inputs';
import { useGameStore, SprinterApp } from '@/game/engine';

export function TouchControls() {
  const { handleLeftTouch, handleRightTouch, handleTouchEnd } = useInputHandlers();
  const state = useGameStore(s => s.state);
  
  if (state !== 'race' && state !== 'count') return null;
  
  return (
    <div className="absolute bottom-0 w-full portrait:h-[20vh] landscape:h-[17vh] min-h-[70px] max-h-[250px] flex px-[max(env(safe-area-inset-left),0.5rem)] pr-[max(env(safe-area-inset-right),0.5rem)] pb-[max(env(safe-area-inset-bottom),0.5rem)] gap-2 z-50 pointer-events-none">
      <div 
        className="flex-1 rounded-2xl border-2 border-white/10 bg-card/40 backdrop-blur-sm flex items-end justify-center pb-4 md:pb-8 active:bg-primary/20 active:border-primary/50 transition-colors select-none touch-none pointer-events-auto"
        onPointerDown={(e) => { e.preventDefault(); handleLeftTouch(); }}
        onPointerUp={() => handleTouchEnd('left')}
        onPointerCancel={() => handleTouchEnd('left')}
      >
        <span className="text-4xl md:text-5xl font-black text-white/30">&lt;</span>
      </div>
      
      <div 
        className="flex-1 rounded-2xl border-2 border-white/10 bg-card/40 backdrop-blur-sm flex items-end justify-center pb-4 md:pb-8 active:bg-primary/20 active:border-primary/50 transition-colors select-none touch-none pointer-events-auto"
        onPointerDown={(e) => { e.preventDefault(); handleRightTouch(); }}
        onPointerUp={() => handleTouchEnd('right')}
        onPointerCancel={() => handleTouchEnd('right')}
      >
        <span className="text-4xl md:text-5xl font-black text-white/30">&gt;</span>
      </div>
      
      <div className="absolute top-[-20px] md:top-[-30px] w-full text-center pointer-events-none left-0">
        <span className="text-[10px] md:text-xs font-bold tracking-widest text-muted-foreground uppercase bg-black/40 px-3 py-0.5 md:px-4 md:py-1 rounded-full">
          {SprinterApp.N.t('alternate')}
        </span>
      </div>
    </div>
  );
}
