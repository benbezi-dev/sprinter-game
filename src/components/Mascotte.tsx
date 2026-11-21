import React, { useEffect, useRef } from 'react';
import { vueMascotte, type Personnage, type Cadrage, type Vue, type Repos } from '@/game/mascotte-3d';

/**
 * LA MASCOTTE ANIMEE DANS UN ECRAN (game/mascotte-3d.ts). Une toile transparente qui prend la
 * taille de sa boite ; la mascotte y joue `geste`, puis `ensuite` en boucle (idle par defaut).
 * Tant que son fichier charge, ou sans WebGL, la toile reste vide : rien ne bloque l'ecran.
 */
export function Mascotte({ personnage, geste, ensuite = 'idle', suite, repos, lacet, cadrage = 'pied', className, style }: {
  personnage: Personnage;
  geste: string;
  ensuite?: string | null;
  /** Les gestes qui suivent le premier, d'un visage a l'autre (fondu), puis le repos qui varie. */
  suite?: [Personnage, string][];
  repos?: Repos;
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

  // (la suite se compare par son contenu : un tableau recree a chaque rendu ne relance rien)
  const cleSuite = JSON.stringify([suite || null, repos || null]);
  useEffect(() => {
    const v = vue.current;
    if (!v) return;
    if (suite?.length || repos) v.enchainer([[personnage, geste], ...(suite || [])], repos);
    else v.jouer(personnage, geste, ensuite);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personnage, geste, ensuite, cleSuite, lacet, cadrage]);

  return <div ref={boite} aria-hidden className={className}
    style={{ width: '100%', height: '100%', pointerEvents: 'none', ...style }} />;
}
