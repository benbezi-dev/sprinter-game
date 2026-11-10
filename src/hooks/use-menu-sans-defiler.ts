import { useEffect, useRef } from 'react';

/**
 * LE MENU DE L'ACCUEIL TIENT A L'ECRAN, QUELLE QUE SOIT SA TAILLE (l'auteur, 02/11/2026 :
 * « le joueur doit avoir acces a tout l'ecran du menu sans avoir besoin de scroller, peu
 * importe la taille d'ecran »).
 *
 * La variante `serre:` resserre deja l'accueil sur un telephone debout pas tres haut. Ce qui
 * reste ne se regle pas a la main, ecran par ecran : un bandeau de championnat, un defi du jour,
 * une banderole d'evenement peuvent s'ajouter, et chaque telephone a sa hauteur. On mesure donc
 * la place que le menu PEUT prendre (la colonne entiere, moins le titre et le minimum de la
 * scene des coureurs) et ce qu'il demande, et l'on reduit le menu du rapport des deux.
 *
 * POURQUOI `zoom` ET PAS `transform: scale`. Le menu porte des fenetres `fixed` qui ne passent
 * pas par un portail (le tutoriel du one shot, la revelation du championnat...). Une
 * transformation en fait un bloc conteneur : elles seraient enfermees et decoupees au format du
 * menu (deja vu le 26/09 avec un `mask-image`, voir TitleScreen). `zoom` reduit la mise en page
 * elle-meme sans creer de bloc conteneur. Une largeur en pourcentage se resout toujours contre le
 * parent : la colonne garde donc toute sa largeur, seul son contenu rapetisse.
 *
 * Un plancher : sous la moitie, le texte ne se lirait plus. On s'y arrete, et le peu qui
 * deborderait encore defile : c'est le filet de securite du conteneur, pas le cas courant.
 */
export function useMenuSansDefiler(plancher = 0.5) {
  /** Le conteneur du menu (celui qui defilerait). */
  const cadre = useRef<HTMLDivElement | null>(null);
  /** La colonne du menu : c'est elle qu'on reduit. */
  const contenu = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let vivant = true, prevu = 0;

    /** La hauteur que le menu peut occuper au plus. */
    const place = (c: HTMLElement): number => {
      const parent = c.parentElement;
      if (!parent) return c.clientHeight;
      // En paysage, le menu a sa colonne a lui : sa hauteur est la place.
      if (getComputedStyle(parent).flexDirection.startsWith('row')) return c.clientHeight;
      // Debout, il partage la colonne avec le titre et la scene des coureurs, qui se replie
      // jusqu'a son minimum.
      const gauche = parent.firstElementChild as HTMLElement | null;
      const scene = parent.querySelector('[data-accueil-scene]') as HTMLElement | null;
      const titre = scene?.parentElement?.firstElementChild as HTMLElement | null;
      const sp = getComputedStyle(parent), sc = getComputedStyle(c);
      const gap = parseFloat(sp.rowGap) || 0;
      const minScene = scene ? parseFloat(getComputedStyle(scene).minHeight) || 0 : 0;
      const hTitre = titre ? titre.offsetHeight + (parseFloat(getComputedStyle(titre).marginTop) || 0) : 0;
      const depasse = -(parseFloat(sc.marginBottom) || 0);     // le menu deborde vers le bas (-mb-4)
      if (gauche === c) return c.clientHeight;
      return parent.clientHeight - gap - hTitre - minScene + depasse;
    };

    /**
     * CE QUI DECIDE DU ZOOM, ET RIEN D'AUTRE (l'auteur, 10/11/2026, video a l'appui : « l'ecran
     * bouge, ca donne mal a la tete » — encore apres le premier correctif du matin).
     *
     * La video montrait le menu deplace de 1 a 4 pixels une image sur deux, quarante-cinq fois par
     * seconde : le rythme exact d'une boucle « on ecrit le zoom -> l'observateur de taille le voit
     * -> on remesure a l'image suivante -> on ecrit un zoom un peu different ». Le calcul d'avant
     * dependait de la valeur deja en place (raffinage, resserrage d'un cran, regle des 2 %) : il ne
     * retombait pas toujours sur le meme chiffre, et chaque ecart relancait le tour suivant.
     *
     * Desormais le zoom ne depend que de deux grandeurs que le zoom lui-meme ne peut pas changer :
     * la place offerte au menu (`place`, prise sur la colonne, le titre et la scene) et la hauteur
     * du menu NON reduit, a largeur fixe. Tant qu'elles n'ont pas bouge de 2 px, on n'ecrit rien :
     * nos propres ecritures ne peuvent donc plus relancer quoi que ce soit. Quand elles changent
     * vraiment (un bandeau arrive, l'ecran tourne), le zoom est recalcule de zero, toujours de la
     * meme facon, au centieme pres.
     */
    let vu: { dispo: number; besoin: number; largeur: number } | null = null;

    const mesurer = () => {
      const c = cadre.current, d = contenu.current;
      if (!vivant || !c || !d) return;
      // on tape dans un champ : le clavier rogne la hauteur, on ne touche a rien
      if (document.activeElement instanceof HTMLInputElement && d.contains(document.activeElement)) return;

      const dispo = place(c) - 2;   // deux pixels de marge : un arrondi ne doit pas faire defiler
      const largeur = c.clientWidth;
      // La hauteur du menu non reduit. Retirer puis remettre le zoom dans la meme tache ne se voit
      // pas a l'ecran (aucune image n'est dessinee entre les deux) et, la valeur remise etant la
      // meme, ne change aucune taille : l'observateur ne se reveille pas pour si peu.
      const enPlace = d.style.zoom;
      d.style.zoom = '';
      const besoin = d.offsetHeight;

      const pareil = vu
        && Math.abs(vu.dispo - dispo) < 2
        && Math.abs(vu.besoin - besoin) < 2
        && Math.abs(vu.largeur - largeur) < 2;
      if (pareil) { d.style.zoom = enPlace; return; }
      vu = { dispo, besoin, largeur };

      let e = 1;
      if (dispo > 0 && besoin > dispo) {
        // Reduit, le texte occupe moins de lignes (la colonne garde sa largeur, son contenu
        // rapetisse) : la hauteur vue n'est pas proportionnelle au zoom. On cherche donc, par
        // dichotomie et au centieme, le plus grand zoom qui tient. Plus le zoom est petit, plus le
        // menu vu est court : la recherche converge, et toujours vers la meme valeur.
        const tient = (z: number) => {
          d.style.zoom = String(z / 100);
          return d.getBoundingClientRect().height <= dispo;
        };
        const bas = Math.ceil(plancher * 100);
        let lo = bas, hi = 99;
        if (!tient(lo)) hi = lo;            // meme au plancher ca deborde : le plancher, et ca defile
        else while (lo < hi) {
          const m = Math.ceil((lo + hi) / 2);
          if (tient(m)) lo = m; else hi = m - 1;
        }
        e = lo / 100;
      }
      const ecrit = e < 1 ? String(e) : '';
      d.style.zoom = ecrit;
    };

    const planifier = () => {
      if (!vivant || prevu) return;
      prevu = requestAnimationFrame(() => { prevu = 0; mesurer(); });
    };

    planifier();
    // Le menu change apres coup : un bandeau arrive du reseau, un onglet change de contenu.
    // Un pixel n'est pas un changement : le menu reduit est centre dans son cadre, l'arrondi du
    // texte zoome depend de sa position, et sa hauteur hesite d'un pixel d'une mesure a l'autre.
    // Relancer la mesure sur ce pixel entretenait une boucle sans fin (le menu sautait d'un
    // pixel plusieurs fois par seconde). Seul un vrai changement de taille relance.
    const vues = new WeakMap<Element, { l: number; h: number }>();
    const ro = new ResizeObserver(entrees => {
      let reel = false;
      for (const en of entrees) {
        const { width: l, height: h } = en.contentRect;
        const v = vues.get(en.target);
        if (!v || Math.abs(v.l - l) >= 2 || Math.abs(v.h - h) >= 2) {
          vues.set(en.target, { l, h });
          reel = true;
        }
      }
      // ... sauf si ce pixel fait defiler : la, on resserre.
      const c = cadre.current;
      if (reel || (c && c.scrollHeight > c.clientHeight + 0.5)) planifier();
    });
    const mo = new MutationObserver(planifier);
    if (cadre.current) ro.observe(cadre.current);
    if (cadre.current?.parentElement) ro.observe(cadre.current.parentElement);
    if (contenu.current) ro.observe(contenu.current);
    if (contenu.current) mo.observe(contenu.current, { childList: true, subtree: true });
    window.addEventListener('resize', planifier);
    window.addEventListener('orientationchange', planifier);
    const rappels = [80, 300, 800, 1600, 3000].map(t => setTimeout(planifier, t));
    return () => {
      vivant = false;
      if (prevu) cancelAnimationFrame(prevu);
      rappels.forEach(clearTimeout);
      ro.disconnect(); mo.disconnect();
      window.removeEventListener('resize', planifier);
      window.removeEventListener('orientationchange', planifier);
    };
  }, [plancher]);

  return { cadre, contenu };
}
