import { useState } from 'react';
import { SprinterApp, courirDecouverte } from '@/game/engine';
import { pushReprise } from '@/game/history';
import { premiersPasFaits } from '@/game/premiers-pas';
import { marquerTutoVu } from './Tutorial';
import { getSavedName } from '@/game/leaderboard';
import { marquerBienvenueVue } from './Bienvenue';
import { PanneauIdentite } from './NameChip';

export function FinDecouverte() {
  const [identite, setIdentite] = useState(false);
  const { G, N } = SprinterApp;
  const chrono = G.runSplits[0];
  const carriere = () => {
    premiersPasFaits();
    marquerTutoVu();
    SprinterApp.startRun();
  };
  const accueil = () => {
    premiersPasFaits();
    SprinterApp.goHome();
  };
  const secondes = chrono == null ? '' : `${chrono.toFixed(2).replace('.', N.getLang() === 'fr' ? ',' : '.')} s`;

  return (
    <div className="pointer-events-auto flex min-h-0 flex-1 flex-col items-center justify-center overflow-auto bg-background/90 px-6 py-8 text-center">
      <h1 className="font-display text-2xl font-black text-primary">{N.t(chrono == null ? 'decouverte_sans_chrono' : 'chrono_decouverte')}</h1>
      {secondes && <p className="mt-3 font-mono text-5xl font-black tabular-nums">{secondes}</p>}
      <div className="mt-6 grid w-full max-w-xs gap-3">
        <button type="button" className="rounded-xl bg-primary px-4 py-3 font-black text-background"
          onClick={() => { pushReprise(); courirDecouverte(); }}>
          {N.t('refaire_decouverte')}
        </button>
        <button type="button" className="rounded-xl border border-white/20 px-4 py-3 font-bold" onClick={carriere}>
          {N.t('carriere_decouverte')}
        </button>
        {!!secondes && !getSavedName().trim() && (
          <button type="button" className="rounded-xl border border-white/20 px-4 py-3 font-bold" onClick={() => setIdentite(true)}>
            {N.t('pseudo_decouverte')}
          </button>
        )}
        <button type="button" className="px-4 py-2 text-sm text-white/70" onClick={accueil}>{N.t('ouvrir_menu')}</button>
      </div>
      {identite && <PanneauIdentite bienvenue chrono={secondes} onFermer={alBout => {
        if (alBout) marquerBienvenueVue();
        setIdentite(false);
      }} />}
    </div>
  );
}
