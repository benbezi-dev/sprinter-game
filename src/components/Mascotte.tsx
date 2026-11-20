import React, { useEffect, useRef } from 'react';
import { vueMascotte, type Personnage, type Cadrage, type Vue } from '@/game/mascotte-3d';

/**
 * LA MASCOTTE ANIMEE DANS UN ECRAN (game/mascotte-3d.ts). Une toile transparente qui prend la
 * taille de sa boite ; la mascotte y joue `geste`, puis `ensuite` en boucle (idle par defaut).
 * Tant que son fichier charge, ou sans WebGL, la toile reste vide : rien ne bloque l'ecran.
 */
export function Mascotte({ personnage, geste, ensuite = 'idle', lacet, cadrage = 'pied', className, style }: {
  personnage: Personnage;
  geste: string;
  ensuite?: string | null;
  lacet?: number;
  cadrage?: Cadrage;
  className?: string;
  style?: React.CSSProperties;
}) {
  const toile = useRef<HTMLCanvasElement>(null);
  const vue = useRef<Vue | null>(null);

  useEffect(() => {
    if (!toile.current) return;
    const v = vueMascotte({ toile: toile.current, lacet, cadrage });
    vue.current = v;
    return () => { v.liberer(); vue.current = null; };
  }, [lacet, cadrage]);

  useEffect(() => {
    vue.current?.jouer(personnage, geste, ensuite);
  }, [personnage, geste, ensuite, lacet, cadrage]);

  return <canvas ref={toile} aria-hidden className={className}
    style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none', ...style }} />;
}
