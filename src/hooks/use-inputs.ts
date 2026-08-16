import { useEffect } from 'react';
import { SprinterApp, padPress, useGameStore, toggleLang, toggleAudio, setTouchInput } from '@/game/engine';

export function useInputHandlers() {
  const state = useGameStore(s => s.state);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      SprinterApp.Audio_.init();
      // Le clavier reprend la main : on revient a la rigueur d'origine.
      if (e.key.startsWith('Arrow')) setTouchInput(false);

      if (e.key === 'ArrowLeft') {
        padPress('left');
        SprinterApp.G.touches.left = 1;
      } else if (e.key === 'ArrowRight') {
        padPress('right');
        SprinterApp.G.touches.right = 1;
      } else if (e.key === 's' || e.key === 'S') {
        toggleAudio();
      } else if (e.key === 'l' || e.key === 'L') {
        toggleLang();
      }
      
      if (e.key.startsWith('Arrow')) e.preventDefault();
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') delete SprinterApp.G.touches.left;
      if (e.key === 'ArrowRight') delete SprinterApp.G.touches.right;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
  
  return {
    handleLeftTouch: () => {
      SprinterApp.Audio_.init();
      setTouchInput(true);
      padPress('left');
      SprinterApp.G.touches.left = 1;
    },
    handleRightTouch: () => {
      SprinterApp.Audio_.init();
      setTouchInput(true);
      padPress('right');
      SprinterApp.G.touches.right = 1;
    },
    handleTouchEnd: (side: 'left' | 'right') => {
      delete SprinterApp.G.touches[side];
    }
  };
}
