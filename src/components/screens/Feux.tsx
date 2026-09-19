import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';

/**
 * DES FEUX D'ARTIFICE, POUR LE SEUL CHRONO QUI VAUT PLUS QUE LE SIEN.
 *
 * Les confettis tombent souvent : chaque fois qu'on se bat soi-meme, et c'est
 * tant mieux. Le record du monde, lui, se prend une fois — il fallait donc
 * autre chose que la meme pluie en plus dense, sans quoi les deux nouvelles
 * se liraient pareil. Un tir monte, casse en l'air, retombe en braises : on
 * sait ce que c'est avant d'avoir lu le titre de la fenetre.
 *
 * SUR LA MEME TOILE UNIQUE QUE LES CONFETTIS, et pour la meme raison :
 * quelques centaines d'etincelles vivent dans un canvas repeint par
 * `requestAnimationFrame`, pas dans des divs animes par le navigateur au
 * lendemain d'une course en 3D. Transparente aux doigts : le nom se tape et
 * s'envoie pendant que ca pete.
 *
 * LES TRAINEES SANS FOND NOIR. Un feu d'artifice sans trainee n'est qu'une
 * poussiere de points. La recette habituelle — repeindre l'image d'avant en
 * noir a peine transparent — donnerait ici un voile gris sur la fenetre du
 * record. On efface donc au lieu de peindre (`destination-out`) : l'image
 * d'avant perd un tiers de son opacite a chaque passage, la trainee reste, et
 * ce qu'il y a dessous continue de se lire.
 *
 * ELLE VISE LE HAUT DE L'ECRAN. La fenetre du record est au centre : les
 * tirs cassent au-dessus d'elle et les braises lui retombent dessus sans
 * jamais l'eteindre — les etincelles s'ajoutent a la lumiere (`lighter`),
 * elles n'encrent rien.
 *
 * MOUVEMENT REDUIT : RIEN DU TOUT. La fenetre dit deja tout ce qu'il y a a
 * savoir ; ceci n'est que la joie.
 */

/**
 * Les couleurs du sacre, celles des confettis, plus un orange de braise.
 *
 * Le blanc casse de la liste des confettis n'y est pas, et c'est voulu : une
 * gerbe blanche qui s'eteint traverse tous les gris avant de disparaitre, et
 * on ne voit plus un feu d'artifice mais de la cendre. Le blanc ne sert qu'au
 * coeur de l'explosion, ou il ne vit qu'un quart de seconde.
 */
const COULEURS = ['#f8cd4a', '#68d8ec', '#e879d8', '#6ce28a', '#ff8a5c'];

/** Ce qui fait retomber les braises, en pixels par seconde carree. */
const PESANTEUR = 340;
/**
 * Celle du tir qui monte est bien plus forte, et c'est un mensonge assume :
 * sous la vraie, un tir lance depuis le bas de l'ecran met deux secondes a
 * atteindre son sommet — une eternite quand la fenetre du record vient de
 * s'ouvrir et qu'il ne se passe rien dans le ciel. Ici il monte en une
 * seconde, et personne ne compte les metres.
 */
const PESANTEUR_TIR = 1500;

type Tir = { x: number; y: number; vx: number; vy: number; couleur: string };
type Braise = {
  x: number; y: number; vx: number; vy: number;
  /** Ce qu'il lui reste a vivre, et ce qu'elle avait au depart. */
  vie: number; bail: number;
  taille: number; couleur: string;
};

export function Feux({ duree = 7 }: { duree?: number }) {
  const toile = useRef<HTMLCanvasElement>(null);
  const doux = useReducedMotion();

  useEffect(() => {
    if (doux) return;
    const cv = toile.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let L = 0, H = 0;
    const mesurer = () => {
      const l = cv.clientWidth || window.innerWidth || 360;
      const h = cv.clientHeight || window.innerHeight || 640;
      if (l === L && h === H) return;
      L = l; H = h;
      cv.width = Math.round(l * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    mesurer();

    const tirs: Tir[] = [];
    const braises: Braise[] = [];

    /**
     * UN TIR PART DU BAS ET CASSE OU IL A DECIDE DE CASSER.
     *
     * La hauteur de rupture est tiree d'abord, la vitesse s'en deduit : avec
     * `v = racine(2 g h)`, le tir arrive a son sommet exactement la, sans
     * qu'on ait a guetter une altitude au pixel pres. Le haut de l'ecran,
     * jamais le centre — c'est la que la fenetre du record se lit.
     */
    const tirer = () => {
      const cible = H * (0.08 + Math.random() * 0.26);
      tirs.push({
        x: L * (0.12 + Math.random() * 0.76),
        y: H + 8,
        vx: (Math.random() * 2 - 1) * 30,
        vy: -Math.sqrt(2 * PESANTEUR_TIR * Math.max(40, H + 8 - cible)),
        couleur: COULEURS[(Math.random() * COULEURS.length) | 0],
      });
    };

    /**
     * LA RUPTURE. Une couleur par gerbe — un feu multicolore fait un bouquet
     * de fete foraine, une gerbe d'une seule couleur fait un feu d'artifice —
     * et un coeur blanc, court et gros, pour l'eclat du premier dixieme.
     *
     * La portee se mesure a l'ecran : sur un telephone etroit, une gerbe
     * calibree pour un ordinateur sortirait par les deux bords.
     */
    const casser = (t: Tir) => {
      const portee = Math.max(70, Math.min(L, H) * 0.26);
      const combien = L < 520 ? 46 : 70;
      for (let i = 0; i < combien; i++) {
        // Angle regulier plutot qu'au hasard : trente points tires au sort
        // laissent des trous et des paquets, et la gerbe cesse d'etre ronde.
        const a = (i / combien) * Math.PI * 2 + Math.random() * 0.12;
        const v = portee * (1.8 + Math.random() * 1.8);
        const bail = 0.9 + Math.random() * 0.9;
        braises.push({
          x: t.x, y: t.y,
          vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          vie: bail, bail,
          taille: 1.4 + Math.random() * 1.6,
          couleur: t.couleur,
        });
      }
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = portee * (0.4 + Math.random() * 0.9);
        braises.push({
          x: t.x, y: t.y,
          vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          vie: 0.28, bail: 0.28,
          taille: 3 + Math.random() * 2,
          couleur: '#ffffff',
        });
      }
    };

    let raf = 0;
    let avant = performance.now();
    let t = 0;
    // Les deux premiers partent tout de suite : une fenetre qui s'ouvre sur
    // un ciel vide pendant une seconde a deja rate son effet.
    let prochain = 0;
    // On arrete de tirer avant la fin pour que la derniere gerbe ait le temps
    // de retomber : une braise coupee en plein vol se voit.
    const dernierTir = duree - 2.4;

    const image = (maintenant: number) => {
      const dt = Math.min((maintenant - avant) / 1000, 0.05);
      avant = maintenant;
      t += dt;
      mesurer();

      if (t >= prochain && t < dernierTir) {
        tirer();
        if (t < 0.4) tirer();          // salve d'ouverture, deux d'un coup
        prochain = t + 0.45 + Math.random() * 0.5;
      }

      // L'image d'avant s'efface d'un tiers : ce qui reste fait la trainee.
      // Passe le dernier tir on efface plus vite, pour rendre une toile nette
      // plutot qu'un brouillard de braises mortes.
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = t > dernierTir ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.32)';
      ctx.fillRect(0, 0, L, H);

      ctx.globalCompositeOperation = 'lighter';

      for (let i = tirs.length - 1; i >= 0; i--) {
        const f = tirs[i];
        f.vy += PESANTEUR_TIR * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        // Sommet atteint : c'est la que ca casse.
        if (f.vy >= 0) { casser(f); tirs.splice(i, 1); continue; }
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = f.couleur;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let i = braises.length - 1; i >= 0; i--) {
        const b = braises[i];
        b.vie -= dt;
        if (b.vie <= 0 || b.y > H + 40) { braises.splice(i, 1); continue; }
        // Freinage de l'air : sans lui la gerbe serait une explosion de
        // shrapnel: elle doit s'ouvrir vite puis se laisser tomber.
        const frein = Math.pow(0.12, dt);
        b.vx *= frein;
        b.vy = b.vy * frein + PESANTEUR * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        // Elle s'eteint sur sa derniere moitie de vie, en scintillant : une
        // braise d'intensite constante ressemble a une LED.
        const reste = b.vie / b.bail;
        ctx.globalAlpha = Math.min(1, reste * 2) * (0.75 + Math.random() * 0.25);
        ctx.fillStyle = b.couleur;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.taille, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      if (t < duree || braises.length) raf = requestAnimationFrame(image);
      else ctx.clearRect(0, 0, L, H);
    };

    raf = requestAnimationFrame(image);
    return () => cancelAnimationFrame(raf);
  }, [doux, duree]);

  if (doux) return null;

  // AU-DESSUS DE LA FENETRE DU RECORD DU MONDE (60), et de tout le reste.
  // C'est le seul calque du jeu qui a le droit de passer devant elle : une
  // gerbe qui s'arreterait au bord d'un panneau ne serait plus une gerbe. Il
  // n'y a rien a y toucher, les doigts la traversent.
  return (
    <canvas
      ref={toile}
      aria-hidden
      className="fixed inset-0 z-[61] w-full h-full pointer-events-none"
    />
  );
}
