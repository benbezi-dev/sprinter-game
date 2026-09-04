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
export function useTenirDansLEcran(plancher = 0.75, plafondRemplissage = 1.25) {
  /** Le conteneur qui defile : c'est lui qui connait la place disponible. */
  const cadre = useRef<HTMLDivElement | null>(null);
  /** Ce qu'on reduit. Sa hauteur de mise en page reste celle d'avant. */
  const contenu = useRef<HTMLDivElement | null>(null);

  const [echelle, setEchelle] = useState(1);
  /** La hauteur a reserver, ou nul quand rien n'est reduit. */
  const [hauteur, setHauteur] = useState<number | null>(null);
  /**
   * Doit-on ETALER le contenu sur toute la hauteur ?
   *
   * L'inverse du probleme d'origine, et il est arrive par la meme porte : a
   * force de retirer ce qui encombrait, certains ecrans ne remplissent plus le
   * telephone et le resultat flotte au milieu, un tiers de noir sous les
   * boutons. Etale, il se lit comme une affiche : le titre en haut, les
   * boutons en bas, le reste reparti.
   *
   * Mais seulement quand il ne manque PAS GRAND-CHOSE. Un ecran a moitie vide
   * qu'on etire ne se remplit pas, il se troue : des blocs isoles separes par
   * de grands vides, ce qui se voit bien plus qu'une marge en bas. D'ou le
   * plafond — au-dela, on recentre et on ne touche a rien.
   */
  const [remplir, setRemplir] = useState(false);

  useEffect(() => {
    let vivant = true;

    const mesurer = () => {
      const c = cadre.current, d = contenu.current;
      if (!vivant || !c || !d) return;
      if (d.contains(document.activeElement)) return;   // on tape : on ne touche a rien

      const st = getComputedStyle(c);
      const dispo = c.clientHeight
        - (parseFloat(st.paddingTop) || 0) - (parseFloat(st.paddingBottom) || 0);
      const besoin = naturel(d);
      if (!(dispo > 0) || !(besoin > 0)) return;

      const rapport = dispo / besoin;
      // Ca tient deja, ou la reduction ne suffirait pas : on n'y touche pas.
      const e = rapport >= 1 || rapport < plancher ? 1 : rapport;
      setEchelle(e);
      setHauteur(e < 1 ? Math.ceil(besoin * e) : null);
      setRemplir(e === 1 && rapport > 1 && rapport <= plafondRemplissage);
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
  }, [plancher, plafondRemplissage]);

  return { cadre, contenu, echelle, hauteur, remplir };
}

/**
 * LA HAUTEUR PROPRE DU CONTENU, ET POURQUOI CE N'EST PAS scrollHeight.
 *
 * Tant qu'on ne faisait que reduire, `scrollHeight` suffisait : une
 * transformation ne change pas la mise en page, la mesure restait la meme d'un
 * passage a l'autre. Etaler, si : la colonne prend alors toute la place
 * offerte, et `scrollHeight` vaut exactement la place disponible. On mesurerait
 * donc « ca tient pile », pour toujours — et le jour ou un panneau disparait,
 * on ne saurait plus qu'il y a maintenant trop de place, on garderait un ecran
 * etale et troue sans jamais pouvoir en sortir.
 *
 * La somme des blocs, elle, ne bouge pas quand on les ecarte. C'est donc elle
 * qu'on mesure : les hauteurs de mise en page (`offsetHeight`, insensible aux
 * transformations, la ou un rectangle mesure rendrait la taille reduite), plus
 * les gouttieres et les marges internes de la colonne.
 *
 * Le repli reste `scrollHeight` : sur un ecran bas la colonne passe en deux ou
 * trois colonnes typographiques, ou additionner des blocs ne veut plus rien
 * dire — et l'on n'etale pas non plus dans ce cas-la.
 */
function naturel(d: HTMLElement): number {
  const colonne = d.firstElementChild as HTMLElement | null;
  if (!colonne) return d.scrollHeight;
  const cs = getComputedStyle(colonne);
  if (cs.columnCount !== 'auto' && cs.columnCount !== '') return d.scrollHeight;
  const blocs = Array.from(colonne.children) as HTMLElement[];
  if (!blocs.length) return d.scrollHeight;
  const gouttiere = parseFloat(cs.rowGap) || 0;
  const marges = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  return blocs.reduce((t, b) => t + b.offsetHeight, 0)
       + gouttiere * (blocs.length - 1) + marges;
}
