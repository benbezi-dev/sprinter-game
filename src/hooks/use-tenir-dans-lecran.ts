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
 * Celle-ci n'enleve rien. Elle mesure ce qu'il faut, mesure ce qu'il y a, et
 * s'y prend en DEUX TEMPS, du moins visible au plus visible :
 *
 * 1. ELLE RESSERRE. La classe `serre` passe sur le contenu et les tailles se
 *    rabattent d'un cran — marges, interlignes, corps de texte. C'est le meme
 *    geste que la variante `court:` fait en paysage, ici declenche par la
 *    mesure et non par la forme de l'ecran. Sur un 360x640 charge, cela suffit
 *    a ramener 881 pixels sous les 608 disponibles.
 *
 * 2. ELLE REDUIT. Si le resserrement n'a pas suffi, tout est mis a l'echelle
 *    du rapport des deux hauteurs. Le texte rapetisse pour de bon, l'ecran est
 *    complet, et personne n'a besoin de savoir qu'il s'est passe quelque chose.
 *
 * L'ordre compte : resserrer se lit encore, reduire finit par ne plus se lire.
 * On ne descend donc a l'echelle que ce que le resserrement n'a pas absorbe.
 *
 * LE RESSERREMENT NE SE DEFAIT PAS. Une fois pose il reste pour la vie de
 * l'ecran, et c'est ce qui empeche le battement : resserrer fait tenir, ce qui
 * autoriserait a desserrer, ce qui ferait deborder — l'ecran clignoterait
 * entre deux tailles a chaque mesure. L'ecran de fin de course ne dure que le
 * temps d'une course ; la question se repose entiere a la suivante.
 *
 * TROIS PRECAUTIONS, ET ELLES COMPTENT :
 *
 * 1. TOUT OU RIEN, ET UN PLANCHER POUR EN DECIDER. On ne reduit que si la
 *    reduction suffit a TOUT montrer : rapetisser le texte pour un ecran qui
 *    defilerait quand meme serait le pire des reglages. Sous le plancher on
 *    ne touche donc a rien et l'ecran defile, entier, rien de coupe.
 *
 *    LE PLANCHER EST DESCENDU DE 0,75 A 0,6 le 02/09/2026, en meme temps que
 *    le resserrement est arrive. Les deux vont ensemble. A 0,75 la reduction
 *    etait le seul recours et devait rester lisible toute seule ; elle ne
 *    ramasse plus aujourd'hui que ce que le resserrement a laisse, quelques
 *    dizaines de pixels la ou il y en avait deux cents. Un ecran de duel
 *    gagne avec montee de division, mesure sur un 360x640, demandait 760
 *    pixels pour 608 : il passe a 0,80, et il aurait defile a l'ancien
 *    plancher pour vingt pixels de trop. C'est exactement le cas que les
 *    joueurs signalent, et il ne doit plus jamais defiler.
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
export function useTenirDansLEcran(plancher = 0.6) {
  /** Le conteneur qui defile : c'est lui qui connait la place disponible. */
  const cadre = useRef<HTMLDivElement | null>(null);
  /** Ce qu'on reduit. Sa hauteur de mise en page reste celle d'avant. */
  const contenu = useRef<HTMLDivElement | null>(null);

  const [echelle, setEchelle] = useState(1);
  /** La hauteur a reserver, ou nul quand rien n'est reduit. */
  const [hauteur, setHauteur] = useState<number | null>(null);
  /** Premier recours : les tailles rabattues d'un cran. Ne se defait pas. */
  const [serre, setSerre] = useState(false);
  // Double de `serre`, lisible depuis la mesure : celle-ci vit dans un effet
  // monte une seule fois, et ne verrait jamais l'etat changer autrement.
  const dejaSerre = useRef(false);

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

      // PREMIER TEMPS : resserrer. On rend la main sans rien mettre a
      // l'echelle — la classe change la hauteur, l'observateur rappellera, et
      // la mesure suivante portera sur l'ecran resserre. Se decider tout de
      // suite sur une echelle qu'on va invalider ferait sauter l'ecran deux
      // fois pour un seul reglage.
      if (besoin > dispo && !dejaSerre.current) {
        dejaSerre.current = true;
        setSerre(true);
        return;
      }

      // SECOND TEMPS : reduire ce qui depasse encore.
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

  return { cadre, contenu, echelle, hauteur, serre };
}
