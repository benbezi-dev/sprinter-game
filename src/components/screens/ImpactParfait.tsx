import React, { useLayoutEffect, useRef } from 'react';
import { useGameStore } from '@/game/engine';
import { tempoDuMonde } from '@/game/tempo';
import { useAnimationsReduites } from '@/lib/mouvement';
import {
  clesImpact, COUCHES_IMPACT, dureeFlash, FIN_IMPACT, HAUTEUR_IMPACT,
  LARGEUR_IMPACT, LIBELLE_IMPACT, peindreImpact, type Impact,
} from '@/game/impact-parfait';

export function ImpactParfait({ type, reste }: { type: Impact; reste: number }) {
  const conteneur = useRef<HTMLDivElement>(null);
  const animations = useRef<Animation[]>([]);
  const reduit = useAnimationsReduites();
  const pause = useGameStore(s => s.paused);
  const temps = Math.max(0, dureeFlash[type] - reste);
  const visible = temps < FIN_IMPACT;
  const vitesse = pause ? 0 : tempoDuMonde();

  useLayoutEffect(() => {
    const div = conteneur.current;
    if (!div) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    div.querySelectorAll('canvas').forEach((canvas, i) => {
      const couche = COUCHES_IMPACT[i];
      const cles = clesImpact(type, couche, reduit);
      if (!cles.length) return;
      canvas.width = Math.round(LARGEUR_IMPACT * ratio);
      canvas.height = Math.round(HAUTEUR_IMPACT * ratio);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const peindre = () => {
        if (conteneur.current !== div) return;
        ctx.setTransform(canvas.width / LARGEUR_IMPACT, 0, 0, canvas.height / HAUTEUR_IMPACT, 0, 0);
        ctx.clearRect(0, 0, LARGEUR_IMPACT, HAUTEUR_IMPACT);
        peindreImpact(ctx, type, couche);
      };
      peindre();
      if (!document.fonts.check('900 23px Outfit')) void document.fonts.ready.then(peindre);

      // Le compositeur interpole à chaque rafraîchissement, même entre deux images du moteur.
      const images = cles.map(([t, x, y, largeur, hauteur, angle, alpha]) => ({
        offset: t / FIN_IMPACT, opacity: alpha,
        transform: `translate(${x}px, ${y}px) rotate(${angle}deg) scale(${largeur}, ${hauteur})`,
      }));
      animations.current.push(canvas.animate(images, { duration: FIN_IMPACT * 1000, fill: 'both' }));
    });
    return () => {
      animations.current.forEach(animation => animation.cancel());
      animations.current = [];
    };
  }, [type, reduit, visible]);

  useLayoutEffect(() => {
    for (const animation of animations.current) {
      // Recaler après une pause ou une longue image, sans piloter chaque pose depuis React.
      const attendu = temps * 1000;
      if (!vitesse || animation.pending || Math.abs(Number(animation.currentTime) - attendu) > 80) {
        animation.currentTime = attendu;
      }
      if (animation.playbackRate !== vitesse) animation.playbackRate = vitesse;
    }
  }, [temps, vitesse, reduit, type]);

  if (!visible) return null;
  return <div ref={conteneur} className="pointer-events-none relative max-w-full"
    style={{ width: LARGEUR_IMPACT, aspectRatio: LARGEUR_IMPACT / HAUTEUR_IMPACT }}>
    {COUCHES_IMPACT.map(couche => <canvas key={couche}
      role={couche === 'titre' ? 'img' : undefined}
      aria-label={couche === 'titre' ? LIBELLE_IMPACT[type] : undefined}
      aria-hidden={couche !== 'titre' || undefined}
      className="pointer-events-none absolute inset-0 block h-full w-full opacity-0" />)}
  </div>;
}
