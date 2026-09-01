import { useEffect, useRef, useState } from 'react';

/**
 * FAIRE TENIR L'ECRAN DANS L'ECRAN, PLUTOT QUE DE CACHER CE QUI DEPASSE.
 *
 * L'ecran de fin de course dit huit choses a la fois : le resultat, le duel,
 * les chronos face au fantome, le TOP 500, le defi a renvoyer, l'image a
 * partager, et trois boutons. Mis en colonnes il tient sur un telephone
 * couche, mais dans ses configurations les plus chargees il depassait encore
 * d'une soixantaine de pixels — et un ecran qui depasse de si peu est le pire
 * des cas : on ne voit pas qu'il y a quelque chose en dessous, donc on ne
 * descend pas, donc on ne le lit jamais.
 *
 * Les deux issues evidentes etaient mauvaises l'une et l'autre. Laisser
 * defiler, c'est ce qu'on voulait corriger. Replier des panneaux derriere un
 * geste, c'est cacher une information qu'on avait justement decide de montrer.
 *
 * Celle-ci n'enleve rien : elle mesure ce qu'il faut, mesure ce qu'il y a, et
 * reduit le tout du rapport des deux. Le texte rapetisse un peu, l'ecran est
 * complet, et personne n'a besoin de savoir qu'il s'est passe quelque chose.
 *
 * TROIS PRECAUTIONS, ET ELLES COMPTENT :
 *
 * 1. TOUT OU RIEN, ET UN PLANCHER POUR EN DECIDER. On ne reduit que si la
 *    reduction suffit a TOUT montrer, et seulement dans la limite du
 *    plancher. Le demi-progres serait le pire des reglages : en portrait il
 *    faudrait descendre aux deux tiers pour un ecran qui defilerait encore —
 *    on aurait rapetisse le texte pour rien. Sous le plancher on ne touche
 *    donc a rien et l'ecran defile comme avant, entier, rien de coupe.
 *
 * 2. LA HAUTEUR RESERVEE. Une transformation ne change pas la mise en page :
 *    reduire sans rien dire laisserait le conteneur croire qu'il deborde
 *    toujours, avec sa barre de defilement et son centrage faux. On lui donne
 *    donc la hauteur VUE, celle d'apres reduction.
 *
 * 3. PAS PENDANT QU'ON TAPE. Le clavier du telephone rogne la hauteur visible
 *    de moitie. Sans ce garde-fou, poser le doigt dans le champ « ton nom »
 *    ferait rapetisser tout l'ecran sous les doigts, puis grandir en le
 *    refermant. On garde l'echelle qu'on avait le temps de la saisie.
 */
export function useTenirDansLEcran(plancher = 0.75) {
  /** Le conteneur qui defile : c'est lui qui connait la place disponible. */
  const cadre = useRef<HTMLDivElement | null>(null);
  /** Ce qu'on reduit. Sa hauteur de mise en page reste celle d'avant. */
  const contenu = useRef<HTMLDivElement | null>(null);

  const [echelle, setEchelle] = useState(1);
  /** La hauteur a reserver, ou nul quand rien n'est reduit. */
  const [hauteur, setHauteur] = useState<number | null>(null);

  useEffect(() => {
    let vivant = true;

    const mesurer = () => {
      const c = cadre.current, d = contenu.current;
      if (!vivant || !c || !d) return;
      if (d.contains(document.activeElement)) return;   // on tape : on ne touche a rien

      const st = getComputedStyle(c);
      const dispo = c.clientHeight
        - (parseFloat(st.paddingTop) || 0) - (parseFloat(st.paddingBottom) || 0);
      const besoin = d.scrollHeight;
      if (!(dispo > 0) || !(besoin > 0)) return;

      const rapport = dispo / besoin;
      // Ca tient deja, ou la reduction ne suffirait pas : on n'y touche pas.
      const e = rapport >= 1 || rapport < plancher ? 1 : rapport;
      setEchelle(e);
      setHauteur(e < 1 ? Math.ceil(besoin * e) : null);
    };

    // Mesurer une image plus tard, et une seule fois par image. Lire la
    // hauteur au milieu d'une animation d'entree donne un chiffre qui ne veut
    // rien dire, et deux mesures dans la meme image donnent deux fois le meme.
    let prevu = 0;
    const planifier = () => {
      if (!vivant || prevu) return;
      prevu = requestAnimationFrame(() => { prevu = 0; mesurer(); });
    };

    planifier();
    // Le contenu grandit — ou rapetisse — apres coup : le TOP 500 arrive du
    // reseau, le duel se tranche, une phrase remplace un chargement. Une seule
    // mesure au montage porterait sur un ecran qui n'existe pas encore.
    const ro = new ResizeObserver(planifier);
    if (cadre.current) ro.observe(cadre.current);
    if (contenu.current) ro.observe(contenu.current);
    window.addEventListener('resize', planifier);
    // Et quelques repassages, comme pour la hauteur visible dans App.tsx.
    // L'observateur suffit en theorie ; en pratique une notification se perd
    // quand elle arrive dans la meme image que celle ou l'on vient de poser
    // une echelle, et l'ecran restait alors a defiler pour rien. Cinq mesures
    // en trois secondes ne coutent rien et ferment le trou.
    const rappels = [80, 300, 800, 1600, 3000].map(d => setTimeout(planifier, d));
    return () => {
      vivant = false;
      if (prevu) cancelAnimationFrame(prevu);
      rappels.forEach(clearTimeout);
      ro.disconnect();
      window.removeEventListener('resize', planifier);
    };
  }, [plancher]);

  return { cadre, contenu, echelle, hauteur };
}
