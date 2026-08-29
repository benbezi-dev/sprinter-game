import React, { useCallback, useEffect, useRef } from 'react';
import { useInputHandlers } from '@/hooks/use-inputs';
import { useGameStore, SprinterApp, setStepCue, HAS_VIBRATION } from '@/game/engine';

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
  const countT = useGameStore(s => s.countT);

  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);
  const edgeL = useRef<HTMLDivElement | null>(null);
  const edgeR = useRef<HTMLDivElement | null>(null);
  const timers = useRef<{ left: number; right: number }>({ left: 0, right: 0 });
  const edgeTimers = useRef<{ left: number; right: number }>({ left: 0, right: 0 });

  useEffect(() => () => {
    clearTimeout(timers.current.left);
    clearTimeout(timers.current.right);
    clearTimeout(edgeTimers.current.left);
    clearTimeout(edgeTimers.current.right);
  }, []);

  // Remplacant du vibreur, pour les appareils qui n'en ont pas — c'est-a-dire
  // tous les iPhone. Une lueur breve sur le bord de l'ecran du cote joue :
  // la vision peripherique capte tres bien un eclat sans quitter le coureur
  // des yeux, la ou l'allumage du pad oblige a baisser le regard.
  useEffect(() => {
    if (HAS_VIBRATION) return;
    setStepCue((side, kind) => {
      const el = side === 'left' ? edgeL.current : edgeR.current;
      if (!el) return;
      el.style.transition = 'none';
      el.style.opacity = kind === 'trip' ? '1' : '0.42';
      el.style.background = kind === 'trip'
        ? `linear-gradient(to ${side === 'left' ? 'right' : 'left'}, rgba(239,68,68,0.85), transparent)`
        : `linear-gradient(to ${side === 'left' ? 'right' : 'left'}, rgba(248,205,74,0.75), transparent)`;
      clearTimeout(edgeTimers.current[side]);
      edgeTimers.current[side] = window.setTimeout(() => {
        el.style.transition = `opacity ${kind === 'trip' ? 260 : 130}ms ease-out`;
        el.style.opacity = '0';
      }, kind === 'trip' ? 90 : 45);
    });
    return () => setStepCue(null);
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
  // Le decompte suspendu, c'est la presentation des athletes : on regarde, on
  // ne court pas encore. Les pavés et leur consigne n'y ont rien a faire — ils
  // recouvraient la moitie basse de la piste au moment ou l'on presente
  // quelqu'un.
  if (state === 'count' && countT <= -90) return null;

  // Zone sensible et zone visible sont deux choses distinctes.
  //
  // Avant, c'etait la carte arrondie elle-meme qui recevait l'appui : les
  // marges, l'ecart central et la marge de securite du bas ne declenchaient
  // rien. Mesure sur un ecran de 375 pt : 8 px a gauche, 8 px entre les deux
  // pads, 7 px a droite, 8 px en bas — 6 % de la largeur, pile la ou les
  // pouces se posent, et l'ecart central tombe entre les deux mains.
  //
  // Or un appui perdu ne se contente pas de manquer : le coup suivant, du
  // cote oppose, devient une repetition aux yeux du jeu. Et une repetition,
  // c'est une chute dans un cas sur deux, jusqu'a neuf sur dix a pleine
  // vitesse. Une marge de 8 px se payait donc en chutes.
  //
  // Les deux moities sensibles couvrent maintenant toute la bande, bord a
  // bord, sans interstice. Les cartes arrondies ne sont plus que du decor.
  const hitClass =
    'flex-1 h-full flex items-center justify-center select-none touch-none pointer-events-auto';
  const cardClass =
    'w-full h-full rounded-2xl border-2 border-white/10 bg-card/40 backdrop-blur-sm ' +
    'flex items-center justify-center pointer-events-none';

  return (
    <>
    {!HAS_VIBRATION && (
      <>
        <div ref={edgeL} className="fixed left-0 top-0 h-full w-[14px] md:w-[20px] z-40 pointer-events-none" style={{ opacity: 0 }} />
        <div ref={edgeR} className="fixed right-0 top-0 h-full w-[14px] md:w-[20px] z-40 pointer-events-none" style={{ opacity: 0 }} />
      </>
    )}
    <div className="absolute bottom-0 w-full portrait:h-[20vh] landscape:h-[17vh] min-h-[70px] max-h-[250px] flex z-50 pointer-events-none">
      <div
        className={hitClass}
        onPointerDown={(e) => { e.preventDefault(); light('left'); handleLeftTouch(); }}
        onPointerUp={() => handleTouchEnd('left')}
        onPointerCancel={() => handleTouchEnd('left')}
      >
        <div
          ref={leftRef}
          className={cardClass}
          style={{
            color: IDLE_FG,
            marginLeft: 'max(env(safe-area-inset-left),0.5rem)',
            marginRight: '0.25rem',
            marginBottom: 'max(env(safe-area-inset-bottom),0.5rem)',
          }}
        >
          <Chevrons dir={-1} />
        </div>
      </div>

      <div
        className={hitClass}
        onPointerDown={(e) => { e.preventDefault(); light('right'); handleRightTouch(); }}
        onPointerUp={() => handleTouchEnd('right')}
        onPointerCancel={() => handleTouchEnd('right')}
      >
        <div
          ref={rightRef}
          className={cardClass}
          style={{
            color: IDLE_FG,
            marginLeft: '0.25rem',
            marginRight: 'max(env(safe-area-inset-right),0.5rem)',
            marginBottom: 'max(env(safe-area-inset-bottom),0.5rem)',
          }}
        >
          <Chevrons dir={1} />
        </div>
      </div>

      <div className="absolute top-[-20px] md:top-[-30px] w-full text-center pointer-events-none left-0">
        <span className="text-[10px] md:text-xs font-bold tracking-widest text-muted-foreground uppercase bg-black/40 px-3 py-0.5 md:px-4 md:py-1 rounded-full">
          {SprinterApp.N.t('alternate')}
        </span>
      </div>
    </div>
    </>
  );
}
