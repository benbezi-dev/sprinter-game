import { useState } from 'react';
import { SprinterApp, courirDecouverte, passerLOuverture, useGameStore } from '@/game/engine';
import { premierLancement, proposeLe100m } from '@/game/premiers-pas';
import { estHalloween } from '@/game/theme-accueil';

export function OpenScreen() {
  const charge = useGameStore(s => s.chargement ?? 0);
  const { N } = SprinterApp;
  const [menuDemande, setMenuDemande] = useState(false);
  return (
    <div data-halloween={estHalloween() ? '' : undefined}
      className="relative flex h-full w-full flex-col items-center justify-between px-6 pt-[max(env(safe-area-inset-top),3rem)] pb-[max(env(safe-area-inset-bottom),2rem)] text-center">
      <h1 className="font-display text-5xl font-black tracking-tight text-primary sm:text-7xl">SPRINTER</h1>
      <div className="flex w-full max-w-xs flex-col items-stretch gap-2">
        {proposeLe100m() && (
          <button type="button" onClick={courirDecouverte}
            className="pointer-events-auto rounded-xl bg-primary px-5 py-4 text-lg font-black text-background">
            {N.t('courir_decouverte')}
          </button>
        )}
        <button type="button" onClick={() => { setMenuDemande(true); passerLOuverture(); }}
          className="pointer-events-auto rounded-xl border border-white/20 bg-background/80 px-5 py-3 text-sm font-bold text-foreground">
          {N.t('ouvrir_menu')}
        </button>
        {(menuDemande || !premierLancement() || !proposeLe100m()) && charge < 1 && <progress className="h-1 w-full accent-primary" value={charge} max={1}
          aria-label={N.t('chargement_decouverte')} />}
      </div>
    </div>
  );
}
