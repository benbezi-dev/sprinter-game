import type { ReactNode } from 'react';
import { useTenirDansLEcran } from '@/hooks/use-tenir-dans-lecran';

/**
 * LE CADRE COMMUN DES ECRANS DE FIN DE COURSE (07/11 : « plus harmonieux sur
 * tous les ecrans et toujours sans avoir besoin de scroller »).
 *
 * Le meme mecanisme que l'ecran de fin du one shot (voir useTenirDansLEcran) :
 * centre quand il y a de la place, reduit d'un bloc quand il n'y en a pas.
 * Le plancher est plus bas que celui du one shot : la consigne est de ne
 * jamais defiler, et ces ecrans-ci disent moins de choses, ils ne descendent
 * donc pas aussi bas. Sous le plancher, le cadre defile encore — rien n'est
 * jamais coupe.
 */
export function TenirDansLEcran({ className, children, plancher = 0.6 }: {
  className: string; children: ReactNode; plancher?: number;
}) {
  // plafond de remplissage a 1 : ces ecrans se centrent, ils ne s'etalent pas
  const { cadre, contenu, echelle, hauteur, largeur } = useTenirDansLEcran(plancher, 1);
  return (
    <div ref={cadre} className={className}>
      <div className="min-h-full flex flex-col items-center w-full">
        <div className="w-full flex flex-col items-center my-auto" style={{ height: hauteur ?? undefined }}>
          <div ref={contenu} className="w-full flex flex-col items-center"
               style={echelle < 1 ? { width: largeur, transform: `scale(${echelle})`, transformOrigin: 'top center' } : undefined}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
