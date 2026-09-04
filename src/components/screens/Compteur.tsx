import React, { useEffect, useState } from 'react';

/**
 * UN CHRONO QUI DEFILE JUSQU'A SA VALEUR.
 *
 * Le record se lit en arrivant : le nombre monte depuis zero et se pose, au
 * lieu d'etre deja la. Une seconde a peine — le temps que l'oeil suive le
 * mouvement jusqu'au chiffre, sans que personne attende apres lui.
 *
 * La course rapide au depart et l'arrivee posee comptent autant que la duree :
 * une progression lineaire donne un compteur de station-service, alors qu'ici
 * on annonce quelque chose.
 *
 * Il vivait dans la fenetre du record du monde, qui fut longtemps la seule a
 * en avoir besoin. Le record personnel a maintenant son propre ecran, et les
 * deux affichent le meme geste — il est donc ici, chez personne.
 */
export function Compteur({ vers, duree = 900 }: { vers: number; duree?: number }) {
  const [v, setV] = useState(0);

  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const pas = (maintenant: number) => {
      const p = Math.min(1, (maintenant - t0) / duree);
      // depart rapide, arrivee posee : on lit la valeur finale sans a-coup
      setV(vers * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(pas);
    };
    raf = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(raf);
  }, [vers, duree]);

  return <>{v.toFixed(2)}</>;
}
