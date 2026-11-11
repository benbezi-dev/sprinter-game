import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Footprints, Shuffle, ChevronsUp, Home, Feather, Trophy, Crown, Star, Shirt, FileSearch, Check, type LucideIcon } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import { VOILE, PANNEAU } from '@/lib/mouvement';
import { succesDu } from '@/game/succes';

const ICONE: Record<string, LucideIcon> = {
  course: Footprints, epreuves: Shuffle, haies: ChevronsUp, salle: Home, saut: Feather,
  carriere: Trophy, legende: Crown, vedette: Star, tenue: Shirt, marchal: FileSearch,
};

const lire = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };

/** Le nombre de succes gagnes et le total, pour le bouton du profil. */
export function compteSucces(): { n: number; t: number } {
  const s = succesDu(lire);
  return { n: s.filter(x => x.gagne).length, t: s.length };
}

/**
 * Les succes : ce que le joueur a deja accompli, deduit du profil (succes.js).
 * Gagnes en haut, puis les autres avec leur progression.
 */
export function Succes({ onFermer }: { onFermer: () => void }) {
  const { N } = SprinterApp;
  const liste = useMemo(() => {
    const s = succesDu(lire);
    return [...s.filter(x => x.gagne), ...s.filter(x => !x.gagne)];
  }, []);
  const n = liste.filter(x => x.gagne).length;

  // dans body : la fenetre du profil vit sous l'accueil, dont les boutons flottants passeraient devant
  return createPortal(
    <motion.div {...VOILE} onClick={e => { e.stopPropagation(); onFermer(); }}
      className="fixed inset-0 z-[61] flex items-center justify-center bg-black/70 backdrop-blur-md pointer-events-auto
                 px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]">
      <motion.div {...PANNEAU} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
        className="w-full max-w-sm max-h-[90dvh] bg-card/95 border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col gap-3">
        <div className="text-center">
          <h2 className="font-black font-display tracking-tight text-primary text-xl">{N.t('succ_titre')}</h2>
          <div className="text-xs text-muted-foreground">{N.t('succ_compte', { n, t: liste.length })}</div>
        </div>

        <ul className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 -mx-1 px-1">
          {liste.map(s => {
            const Icone = ICONE[s.cle.split('_')[0]] || Trophy;
            return (
              <li key={s.cle}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${s.gagne ? 'bg-primary/15 border border-primary/40' : 'bg-secondary/50'}`}>
                <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
                                 ${s.gagne ? 'bg-primary text-background' : 'bg-secondary text-muted-foreground'}`}>
                  <Icone className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-bold text-sm truncate ${s.gagne ? '' : 'text-foreground/70'}`}>{N.t('succ_' + s.cle)}</div>
                  <div className="text-[11px] text-muted-foreground leading-tight">{N.t('succ_' + s.cle + '_d')}</div>
                  {!s.gagne && s.but > 1 && (
                    <div className="mt-1 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full bg-primary/70" style={{ width: `${(100 * s.fait) / s.but}%` }} />
                      </div>
                      <span className="text-[10px] tabular-nums text-muted-foreground">{s.fait}/{s.but}</span>
                    </div>
                  )}
                </div>
                {s.gagne && <Check className="w-5 h-5 text-primary shrink-0" aria-hidden />}
              </li>
            );
          })}
        </ul>

        <button type="button" onClick={onFermer}
                className="w-full py-3 rounded-xl font-black font-display text-lg tracking-widest text-background bg-primary hover:bg-primary/90
                           transition-all border-b-4 border-[var(--primaire-fonce)] active:border-b-0 active:translate-y-1">
          {N.t('close')}
        </button>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
