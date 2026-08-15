import React, { useCallback, useEffect, useRef } from 'react';
import { useInputHandlers } from '@/hooks/use-inputs';
import { useGameStore, SprinterApp } from '@/game/engine';

// Double chevron : plus lisible et plus soigne qu'un caractere "<" ou ">",
// et surtout parfaitement centrable puisqu'on maitrise le viewBox. La
// couleur suit currentColor, donc l'icone s'allume avec le pad.
function Chevrons({ dir }: { dir: 1 | -1 }) {
  return (
    <svg viewBox="-24 -24 48 48" className="w-11 h-11 md:w-16 md:h-16 block" aria-hidden="true">
      <g
        transform={`scale(${dir} 1)`}
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M-1 -11 L 10 0 L -1 11" />
        <path d="M-13 -11 L -2 0 L -13 11" opacity="0.45" />
      </g>
    </svg>
  );
}

const LIT_BG = 'rgba(248,205,74,0.20)';
const LIT_BORDER = 'rgba(248,205,74,0.90)';
const LIT_FG = 'rgb(248,205,74)';
const IDLE_FG = 'rgba(255,255,255,0.34)';
// Duree minimale d'allumage. A pleine cadence (~10 appuis/s, soit un appui
// tous les 200 ms sur un meme pad) la lumiere reste donc bien visible : elle
// clignote au rythme de la foulee au lieu de disparaitre.
const LIT_MS = 110;

export function TouchControls() {
  const { handleLeftTouch, handleRightTouch, handleTouchEnd } = useInputHandlers();
  const state = useGameStore(s => s.state);

  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);
  const timers = useRef<{ left: number; right: number }>({ left: 0, right: 0 });

  useEffect(() => () => {
    clearTimeout(timers.current.left);
    clearTimeout(timers.current.right);
  }, []);

  // L'allumage est pilote directement sur le noeud, pas par une classe CSS
  // :active ni par un etat React :
  //   - preventDefault() sur pointerdown empeche le navigateur de poser
  //     l'etat :active, donc l'ancien surlignage CSS ne partait pas ;
  //   - une transition de couleur n'a pas le temps d'aboutir sur un appui
  //     de 100 ms, donc a pleine vitesse on ne voyait plus rien.
  // Ici l'allumage est immediat (transition coupee), et il est garanti
  // visible au moins LIT_MS meme si le doigt se leve tout de suite.
  const light = useCallback((side: 'left' | 'right') => {
    const el = side === 'left' ? leftRef.current : rightRef.current;
    if (!el) return;
    el.style.transition = 'none';
    el.style.backgroundColor = LIT_BG;
    el.style.borderColor = LIT_BORDER;
    el.style.color = LIT_FG;
    clearTimeout(timers.current[side]);
    timers.current[side] = window.setTimeout(() => {
      el.style.transition = 'background-color 130ms ease-out, border-color 130ms ease-out, color 130ms ease-out';
      el.style.backgroundColor = '';
      el.style.borderColor = '';
      el.style.color = IDLE_FG;
    }, LIT_MS);
  }, []);

  if (state !== 'race' && state !== 'count') return null;

  const padClass =
    'flex-1 rounded-2xl border-2 border-white/10 bg-card/40 backdrop-blur-sm ' +
    'flex items-center justify-center select-none touch-none pointer-events-auto';

  return (
    <div className="absolute bottom-0 w-full portrait:h-[20vh] landscape:h-[17vh] min-h-[70px] max-h-[250px] flex px-[max(env(safe-area-inset-left),0.5rem)] pr-[max(env(safe-area-inset-right),0.5rem)] pb-[max(env(safe-area-inset-bottom),0.5rem)] gap-2 z-50 pointer-events-none">
      <div
        ref={leftRef}
        className={padClass}
        style={{ color: IDLE_FG }}
        onPointerDown={(e) => { e.preventDefault(); light('left'); handleLeftTouch(); }}
        onPointerUp={() => handleTouchEnd('left')}
        onPointerCancel={() => handleTouchEnd('left')}
      >
        <Chevrons dir={-1} />
      </div>

      <div
        ref={rightRef}
        className={padClass}
        style={{ color: IDLE_FG }}
        onPointerDown={(e) => { e.preventDefault(); light('right'); handleRightTouch(); }}
        onPointerUp={() => handleTouchEnd('right')}
        onPointerCancel={() => handleTouchEnd('right')}
      >
        <Chevrons dir={1} />
      </div>

      <div className="absolute top-[-20px] md:top-[-30px] w-full text-center pointer-events-none left-0">
        <span className="text-[10px] md:text-xs font-bold tracking-widest text-muted-foreground uppercase bg-black/40 px-3 py-0.5 md:px-4 md:py-1 rounded-full">
          {SprinterApp.N.t('alternate')}
        </span>
      </div>
    </div>
  );
}
