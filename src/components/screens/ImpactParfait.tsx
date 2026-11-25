import React, { useLayoutEffect, useRef } from 'react';
import { HAUTEUR_IMPACT, LARGEUR_IMPACT, LIBELLE_IMPACT, mouvementImpact, peindreImpact, type Impact, type CoucheImpact } from '@/game/impact-parfait';

function Calque({ type, reste, couche }: { type: Impact; reste: number; couche: CoucheImpact }) {
  const toile = useRef<HTMLCanvasElement>(null);
  const pose = mouvementImpact(type, reste, couche);
  const visible = pose !== null;
  useLayoutEffect(() => {
    const canvas = toile.current;
    if (!canvas || !visible) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(LARGEUR_IMPACT * ratio);
    canvas.height = Math.round(HAUTEUR_IMPACT * ratio);
    const peindre = () => {
      if (toile.current !== canvas) return;
      ctx.setTransform(canvas.width / LARGEUR_IMPACT, 0, 0, canvas.height / HAUTEUR_IMPACT, 0, 0);
      ctx.clearRect(0, 0, LARGEUR_IMPACT, HAUTEUR_IMPACT);
      peindreImpact(ctx, type, couche);
    };
    peindre();
    if (!document.fonts.check('900 23px Outfit')) void document.fonts.ready.then(peindre);
  }, [type, couche, visible]);

  if (!pose) return null;
  return <canvas ref={toile} role={couche === 'titre' ? 'img' : undefined} aria-label={couche === 'titre' ? LIBELLE_IMPACT[type] : undefined} aria-hidden={couche === 'elan' || undefined}
    className="pointer-events-none absolute inset-0 block max-w-full"
    style={{ width: LARGEUR_IMPACT, aspectRatio: LARGEUR_IMPACT / HAUTEUR_IMPACT, opacity: pose.alpha,
      transform: `translate(${pose.x}px, ${pose.y}px) scale(${pose.taille})` }} />;
}

export function ImpactParfait({ type, reste }: { type: Impact; reste: number }) {
  if (!mouvementImpact(type, reste)) return null;
  return <div className="pointer-events-none relative max-w-full" style={{ width: LARGEUR_IMPACT, aspectRatio: LARGEUR_IMPACT / HAUTEUR_IMPACT }}>
    <Calque type={type} reste={reste} couche="elan" />
    <Calque type={type} reste={reste} couche="titre" />
  </div>;
}
