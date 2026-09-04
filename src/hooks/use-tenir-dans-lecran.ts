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
 * s'y prend en TROIS TEMPS — deux quand l'ecran est trop court, un troisieme
 * quand il est trop long :
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
 * L'ordre de ces deux-la compte : resserrer se lit encore, reduire finit par
 * ne plus se lire. On ne descend donc a l'echelle que ce que le resserrement
 * n'a pas absorbe.
 *
 * 3. ELLE ETALE. Le probleme se pose aussi dans l'autre sens, et il est arrive
 *    le jour ou le TOP 500 a quitte cet ecran : moins de panneaux, et sur un
 *    telephone debout le resultat se ramassait en un bloc au milieu, un tiers
 *    d'ecran vide au-dessus et autant en dessous. Rien ne depassait, tout se
 *    lisait, et cela donnait quand meme l'impression d'un ecran inacheve.
 *
 *    La place qui reste est donc rendue aux panneaux plutot que laissee autour
 *    d'eux : le conteneur prend la hauteur disponible et `space-evenly`
 *    repartit le surplus entre les blocs. PLAFONNE PAR INTERVALLE, une
 *    centaine de pixels : sans plafond, trois panneaux sur un ecran tres haut
 *    finissent separes par deux cents pixels de noir, ce qui n'est plus un
 *    ecran mais une liste. Tant que la borne le permet, l'ecran se remplit.
 *
 *    LA MESURE RESTE CELLE DU CONTENU NU. `aise` est retranchee de la hauteur
 *    lue avant tout calcul : sans cela, etaler ferait grandir la mesure, qui
 *    ferait retrecir l'aise, qui ferait retrecir la mesure — l'ecran
 *    respirerait indefiniment.
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
  /** La place rendue aux panneaux quand il en reste, en pixels. */
  const [aise, setAise] = useState(0);
  // Lisible depuis la mesure, qui vit dans un effet monte une seule fois — et
  // surtout : c'est elle qu'on retranche de la hauteur lue, pour mesurer
  // toujours le contenu nu.
  const aiseRef = useRef(0);
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
      const besoin = d.scrollHeight - aiseRef.current;
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

      // TROISIEME TEMPS, QUAND IL RESTE DE LA PLACE : l'etaler. Rien a
      // reduire ici, et rien a resserrer non plus — on rend au contenu ce que
      // l'ecran lui laisse, sans jamais depasser le tiers de sa hauteur.
      if (besoin <= dispo) {
        const reste = dispo - besoin;
        // LE PLAFOND SE COMPTE PAR INTERVALLE, PAS EN PROPORTION. Une part de
        // la hauteur du contenu donnait le mauvais reglage aux deux bouts :
        // un ecran deja charge gagnait cent pixels dont il n'avait pas besoin,
        // un resultat de trois panneaux restait tasse au milieu d'un
        // telephone debout. Ce qui se voit, c'est l'espace ENTRE deux
        // panneaux : au-dela d'une centaine de pixels ils cessent d'etre lus
        // ensemble. On le borne donc la, et l'ecran se remplit tant que la
        // borne le permet. `space-evenly` compte un intervalle de plus que de
        // panneaux — un au-dessus du premier, un sous le dernier.
        const colonne = d.firstElementChild;
        const trous = Math.max(2, (colonne ? colonne.childElementCount : 1) + 1);
        // ON N'ETALE QUE CE QUI EST UNE COLONNE. Sous une certaine hauteur et
        // au-dela d'une certaine largeur — un telephone couche — l'ecran de
        // fin passe en multi-colonnes : le conteneur devient un bloc, ou
        // `space-evenly` ne veut plus rien dire. Lui reserver de la hauteur
        // n'y ajouterait pas de l'air, cela collerait le contenu en haut d'une
        // boite trop grande. On lit donc la mise en page reelle plutot que de
        // rejouer sa condition en JavaScript, ou elle divergerait du CSS.
        const enColonnes = !!colonne && getComputedStyle(colonne).display !== 'flex';
        // Quelques pixels ne valent pas un changement de mise en page.
        const a = (enColonnes || reste < 24) ? 0 : Math.round(Math.min(reste, trous * 96));
        aiseRef.current = a;
        setAise(a);
        setEchelle(1);
        setHauteur(a > 0 ? besoin + a : null);
        return;
      }

      // SECOND TEMPS : reduire ce qui depasse encore.
      aiseRef.current = 0;
      setAise(0);
      const rapport = dispo / besoin;
      // La reduction ne suffirait pas : on n'y touche pas, l'ecran defile.
      const e = rapport < plancher ? 1 : rapport;
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

  return { cadre, contenu, echelle, hauteur, serre, aise };
}
