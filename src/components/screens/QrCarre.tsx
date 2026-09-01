import React, { useMemo } from 'react';
import { qrChemin } from '@/game/qr';

/**
 * Un QR code, en SVG.
 *
 * Le fond blanc et la marge ne sont pas decoratifs : un lecteur a besoin du
 * contraste et de la zone calme autour du carre pour en trouver les bords. Un
 * QR pose directement sur le fond sombre du jeu, sans marge, ne se lit pas —
 * c'est la premiere chose qu'on rate en integrant un QR dans une interface.
 *
 * `shapeRendering="crispEdges"` empeche le navigateur de lisser les bords des
 * modules : un module flou est un module que la camera hesite a trancher.
 */
export function QrCarre({ texte, taille = 200 }: { texte: string; taille?: number }) {
  const carre = useMemo(() => qrChemin(texte), [texte]);
  if (!carre) return null;

  return (
    <svg
      width={taille} height={taille}
      viewBox={`0 0 ${carre.taille} ${carre.taille}`}
      shapeRendering="crispEdges"
      className="rounded-xl"
      role="img" aria-label={texte}
    >
      <rect width={carre.taille} height={carre.taille} fill="#ffffff" />
      <path d={carre.d} fill="#000000" />
    </svg>
  );
}
