import { useEffect } from 'react';
import { SprinterApp, padPress, useGameStore, toggleLang, toggleAudio, setTouchInput } from '@/game/engine';
import { APPEL_JOUEUR } from '@/game/canal';
import { appelHaies } from '@/game/haies-course.js';

/* Le jeu ecoute le clavier sur window, donc il recoit aussi les frappes
   destinees aux champs de texte. Sans ce filtre, taper son nom pilotait la
   course : un joueur appele Alex ou Lea basculait toute l'interface en anglais
   sur le "l", Sofia ou Ines coupaient le son sur le "s", l'espace et les
   fleches validaient des ecrans au lieu de deplacer le curseur. On rend donc
   le clavier au champ des qu'il en tient un. */
const zoneDeSaisie = (n: EventTarget | null): boolean => {
  const el = n as HTMLElement | null;
  if (!el || el.nodeType !== 1) return false;
  if (el.isContentEditable) return true;
  const balise = el.tagName;
  return balise === 'INPUT' || balise === 'TEXTAREA' || balise === 'SELECT';
};

export function useInputHandlers() {
  const state = useGameStore(s => s.state);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // e.target couvre le cas courant ; activeElement rattrape les
      // evenements reemis sur document ou window par un composant tiers.
      if (zoneDeSaisie(e.target) || zoneDeSaisie(document.activeElement)) return;
      SprinterApp.Audio_.init();
      // Le clavier reprend la main : on revient a la rigueur d'origine.
      if (e.key.startsWith('Arrow')) setTouchInput(false);

      // LES TOUCHES D'ATTAQUE AU CLAVIER (canal.ts, APPEL_JOUEUR).
      //
      // `e.code` et non `e.key` : il designe la POSITION PHYSIQUE de la touche
      // et non le caractere imprime dessus. KeyQ et KeyP restent donc les deux
      // extremites de la rangee du haut sur azerty comme sur qwerty ou qwertz —
      // sur azerty, KeyQ est la touche marquee A, c'est-a-dire le meme endroit
      // sous les doigts. Le jeu se lit en quatorze langues sur la branche d'a
      // cote ; ses commandes ne peuvent pas dependre d'un clavier.
      //
      // Le clavier n'existe ici que pour eprouver la regle au bureau. Ce qui
      // doit etre juge se joue au pouce, sur telephone.
      if (APPEL_JOUEUR && (e.code === 'KeyQ' || e.code === 'KeyP')) {
        appelHaies(e.code === 'KeyQ' ? 'left' : 'right');
        e.preventDefault();
        return;
      }

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
