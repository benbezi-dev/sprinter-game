import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * DES CONFETTIS QUI TOMBENT, LE TEMPS D'UNE BONNE NOUVELLE.
 *
 * Une ligne de texte annonce un record ; elle ne le fete pas. Sur un ecran de
 * fin ou tout est deja ecrit — le chrono, le duel, le defi a renvoyer — le
 * seul moyen de dire « celui-la n'est pas comme les autres » est de faire
 * bouger l'ecran entier une fois, et de ne plus jamais le refaire tant que le
 * chrono ne le vaut pas.
 *
 * SUR UNE TOILE, ET NON EN CENT DIVS. Cent elements animes, ce sont cent
 * mises en page recalculees a chaque image sur un telephone qui vient de
 * rendre une course en 3D. Ici tout tient dans un seul canvas repeint par
 * `requestAnimationFrame`, pose au-dessus de l'ecran et transparent aux
 * doigts : RECOMMENCER reste cliquable pendant la pluie.
 *
 * ELLE S'ARRETE TOUTE SEULE. Quelques secondes, une derniere seconde qui
 * s'efface, puis la boucle rend la main — rien ne tourne en fond derriere un
 * ecran qu'on ne regarde plus.
 *
 * MOUVEMENT REDUIT : RIEN DU TOUT. C'est une decoration, elle ne porte aucune
 * information que le panneau ne dise deja. Qui a demande le calme le garde.
 */

/** Les cinq couleurs du sacre, celles de la cinematique de fin. */
const COULEURS = ['#f8cd4a', '#68d8ec', '#e879d8', '#6ce28a', '#eef0f8'];

type Piece = {
  x: number; y: number; vy: number;
  /** Vitesse et decalage du balancement lateral. */
  balance: number; phase: number;
  /** Rotation sur soi-meme : un confetti plat se voit tourner. */
  angle: number; vitesseAngle: number;
  l: number; h: number;
  couleur: string;
  rond: boolean;
};

export function Confettis({ duree = 5 }: { duree?: number }) {
  const toile = useRef<HTMLCanvasElement>(null);
  const doux = useReducedMotion();

  useEffect(() => {
    if (doux) return;
    const cv = toile.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    // Deux pixels par point suffisent : au-dela on quadruple la surface a
    // peindre pour des rectangles de six pixels que personne n'inspecte.
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

    // AU-DESSUS DE L'ECRAN, MAIS PAS TROP HAUT. La pluie doit arriver plutot
    // qu'apparaitre d'un coup, d'ou le rideau de depart hors champ ; etale
    // sur une hauteur d'ecran entiere, en revanche, les trois quarts des
    // pieces n'entraient jamais dans le champ avant la fin — il ne restait
    // qu'un filet en haut de l'ecran. Trois cents pixels : les premieres
    // tombent tout de suite, les dernieres ont franchi le bord au bout d'une
    // seconde, et la traversee suivante prend le relais.
    const naitre = (recyclee: boolean): Piece => ({
      x: Math.random() * L,
      y: -30 - Math.random() * (recyclee ? 80 : 300),
      vy: 260 + Math.random() * 260,
      balance: 1.2 + Math.random() * 2.2,
      phase: Math.random() * Math.PI * 2,
      angle: Math.random() * Math.PI * 2,
      vitesseAngle: (Math.random() * 2 - 1) * 4.5,
      l: 5 + Math.random() * 5,
      h: 8 + Math.random() * 6,
      couleur: COULEURS[(Math.random() * COULEURS.length) | 0],
      rond: Math.random() < 0.15,
    });

    const pieces = Array.from({ length: L < 520 ? 80 : 130 }, () => naitre(false));

    let raf = 0;
    let avant = performance.now();
    let t = 0;

    const image = (maintenant: number) => {
      // Onglet revenu au premier plan : sans ce plafond, tout le temps passe
      // ailleurs se rattrape en une image et les confettis se teleportent.
      const dt = Math.min((maintenant - avant) / 1000, 0.05);
      avant = maintenant;
      t += dt;
      mesurer();

      // La derniere seconde s'efface : couper net ferait un clignotement.
      const fin = Math.max(0, Math.min(1, (t - (duree - 1)) / 1));
      ctx.clearRect(0, 0, L, H);
      ctx.globalAlpha = 1 - fin;

      for (const p of pieces) {
        p.y += p.vy * dt;
        p.angle += p.vitesseAngle * dt;
        // Ce qui sort par le bas repart du haut tant que la pluie dure : la
        // densite tient jusqu'au bout au lieu de s'epuiser en deux secondes.
        // Une fois l'effacement commence, on laisse l'ecran se vider.
        if (p.y > H + 30) {
          if (fin > 0) continue;
          Object.assign(p, naitre(true));
        }
        ctx.save();
        ctx.translate(p.x + Math.sin(t * p.balance + p.phase) * 14, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.couleur;
        if (p.rond) {
          ctx.beginPath();
          ctx.arc(0, 0, p.l * 0.55, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.l / 2, -p.h / 2, p.l, p.h);
        }
        ctx.restore();
      }

      ctx.globalAlpha = 1;
      if (t < duree) raf = requestAnimationFrame(image);
      else ctx.clearRect(0, 0, L, H);
    };

    raf = requestAnimationFrame(image);
    return () => cancelAnimationFrame(raf);
  }, [doux, duree]);

  if (doux) return null;

  // ENTRE LE VOILE DU RECORD ET LA FENETRE DU RECORD DU MONDE. Sous le voile
  // (56) ils tomberaient dans le noir pendant les secondes ou ils comptent ;
  // au-dessus de la fenetre du record mondial (60) ils passeraient devant ce
  // qu'on doit lire et remplir. Ici ils traversent la fete puis le menu de
  // fin, sans jamais rien recouvrir d'important.
  return (
    <canvas
      ref={toile}
      aria-hidden
      className="fixed inset-0 z-[57] w-full h-full pointer-events-none"
    />
  );
}
