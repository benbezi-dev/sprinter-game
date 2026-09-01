import { useEffect, useState } from 'react';

/** Combien de pixels sous la ligne de flottaison comptent comme « il en reste ». */
const BOUT = 24;

/**
 * Reste-t-il quelque chose sous la ligne de flottaison ?
 *
 * Un ecran qui deborde ne le dit pas. Celui qui connait le jeu fait glisser
 * sans y penser ; celui qui l'ouvre pour la premiere fois voit un ecran plein
 * et en conclut qu'il a tout vu. Le repere qui s'appuie la-dessus n'a de sens
 * qu'a cette condition : il parait quand il reste de la page, il disparait des
 * qu'on est au bout, et il ne ment jamais.
 *
 * D'ou trois guetteurs plutot qu'un :
 *
 * - LE DEFILEMENT, evidemment.
 * - LA TAILLE DU CADRE : une rotation, un clavier qui s'ouvre.
 * - LE CONTENU LUI-MEME, et c'est le seul qui demande une explication. On ne
 *   peut pas se contenter de surveiller la hauteur du bloc interieur : sur
 *   l'accueil, ce bloc est un `flex-1` dont la hauteur est celle du cadre, et
 *   ce qui depasse deborde de lui sans jamais le faire grandir. Sa taille ne
 *   bouge donc pas d'un pixel quand on change d'onglet, alors que la page,
 *   elle, passe de 824 a 727. On regarde donc les changements du DOM — un
 *   panneau qui apparait, une classe qui bascule — et on remesure.
 *
 * Tout passe par une image d'animation : dix mutations d'affilee ne coutent
 * qu'une seule mesure, et une mesure force le calcul de la mise en page.
 */
export function useResteDessous(cible: React.RefObject<HTMLElement | null>): boolean {
  const [reste, setReste] = useState(false);

  useEffect(() => {
    const el = cible.current;
    if (!el) return;

    let image = 0;
    const mesurer = () => {
      image = 0;
      setReste(el.scrollHeight - el.clientHeight - el.scrollTop > BOUT);
    };
    const remesurer = () => {
      if (image) return;
      image = requestAnimationFrame(mesurer);
    };
    mesurer();

    el.addEventListener('scroll', remesurer, { passive: true });
    const cadre = new ResizeObserver(remesurer);
    cadre.observe(el);
    // Les classes, et pas les styles : c'est une classe qui range un panneau
    // derriere son onglet. Les styles, eux, changent a chaque image des
    // animations et nous feraient mesurer soixante fois par seconde pour rien.
    const contenu = new MutationObserver(remesurer);
    contenu.observe(el, {
      childList: true, subtree: true,
      attributes: true, attributeFilter: ['class'],
    });

    return () => {
      if (image) cancelAnimationFrame(image);
      el.removeEventListener('scroll', remesurer);
      cadre.disconnect();
      contenu.disconnect();
    };
  }, [cible]);

  return reste;
}
