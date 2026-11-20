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
  const boite = useRef<HTMLDivElement>(null);
  const vue = useRef<Vue | null>(null);

  // UNE TOILE NEUVE PAR VUE : liberer() rend le contexte WebGL (forceContextLoss, game/mascotte-3d.ts)
  // et une toile dont le contexte est perdu n'en redonne plus. Une vue recreee (autre lacet ou
  // cadrage) sur l'ancienne toile restait donc vide pour toujours.
  useEffect(() => {
    if (!boite.current) return;
    const toile = document.createElement('canvas');
    toile.setAttribute('aria-hidden', 'true');
    toile.style.cssText = 'width:100%;height:100%;display:block;pointer-events:none';
    boite.current.appendChild(toile);
    const v = vueMascotte({ toile, lacet, cadrage });
    vue.current = v;
    return () => { v.liberer(); vue.current = null; toile.remove(); };
  }, [lacet, cadrage]);

  useEffect(() => {
    vue.current?.jouer(personnage, geste, ensuite);
  }, [personnage, geste, ensuite, lacet, cadrage]);

  return <div ref={boite} aria-hidden className={className}
    style={{ width: '100%', height: '100%', pointerEvents: 'none', ...style }} />;
}
