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

    const mesurer = () => {
      const c = cadre.current, d = contenu.current;
      if (!vivant || !c || !d) return;
      // on tape dans un champ : le clavier rogne la hauteur, on ne touche a rien
      if (document.activeElement instanceof HTMLInputElement && d.contains(document.activeElement)) return;
      // Ce qui est a l'ecran maintenant, et si ca tient sans defiler (voir STABILITE plus bas).
      const avant = parseFloat(d.style.zoom) || 1;
      const avantTient = c.scrollHeight <= c.clientHeight + 0.5;
      const dispo = place(c) - 2;   // deux pixels de marge : un arrondi ne doit pas faire defiler
      // Deja reduit, tient sans defiler, et presque rien a regagner : on ne touche a rien. Toute
      // ecriture du zoom refait la mise en page du menu, et c'est elle qui le faisait trembler.
      if (avant < 1 && avantTient && d.getBoundingClientRect().height >= dispo - 12) return;
      // La mesure se fait sans reduction : sinon le calcul tourne en rond.
      d.style.zoom = '';
      const besoin = d.offsetHeight;
      let e = 1;
      if (dispo > 0 && besoin > dispo) {
        const r = Math.floor((dispo / besoin) * 1000) / 1000;
        // sous le plancher, on reduit quand meme jusqu'au plancher : le moins de defilement possible
        e = Math.max(r, plancher);
      }
      if (e < 1) {
        d.style.zoom = String(e);
        // reduit, le texte occupe moins de lignes dans la meme largeur : la colonne raccourcit
        // plus que prevu, on peut souvent reduire un peu moins
        const h = d.getBoundingClientRect().height;
        if (h > 0 && h < dispo - 4) {
          const e2 = Math.min(1, Math.floor(e * (dispo / h) * 1000) / 1000);
          d.style.zoom = e2 < 1 ? String(e2) : '';
          e = e2;
        }
        // les arrondis du zoom laissent parfois un pixel qui defile : on resserre d'un cran
        for (let i = 0; i < 6 && c.scrollHeight > c.clientHeight + 0.5 && e > plancher; i++) {
          e = Math.round((e - 0.01) * 1000) / 1000;
          d.style.zoom = String(e);
        }
      }
      // STABILITE (l'auteur, 10/11/2026 : « l'affichage bouge et donne mal a la tete »).
      // Les arrondis du zoom font hesiter le calcul entre deux valeurs voisines (0,62 et 0,628
      // mesures) : chaque changement redimensionne le cadre, l'observateur relance la mesure, qui
      // repart dans l'autre sens — le menu tremblait de quelques pixels sans fin. On ne regrandit
      // donc pas le menu pour un gain de moins de 2 % quand la valeur en place tient deja sans
      // defiler : elle reste. Rapetisser, en revanche, se fait toujours (sinon le menu defilerait).
      if (avant < 1 && avantTient && e > avant && e - avant < 0.02) {
        d.style.zoom = String(avant);
      }
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
