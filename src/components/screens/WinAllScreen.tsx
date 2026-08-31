import React, { useEffect, useState } from 'react';
import { SprinterApp, useGameStore } from '@/game/engine';
import { motion } from 'motion/react';
import { MONTEE, SURGISSEMENT, retarde } from '@/lib/mouvement';
import { Globe2 } from 'lucide-react';
import {
  getSavedName, saveName, submitScore, fetchLeaderboardRaw,
  rankByRaceTime, rankOf, TOP_N,
} from '@/game/leaderboard';
import { LeaderboardScreen } from './LeaderboardScreen';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export function WinAllScreen() {
  const { runTime, runSplits, runRank, raceKey } = useGameStore();
  const { N } = SprinterApp;

  const [name, setName] = useState(getSavedName());
  // 'checking' : on regarde d'abord si le chrono entre au tableau. On ne
  // propose la saisie du nom que dans ce cas — inutile de faire saisir un nom
  // pour un chrono qui ne sera jamais affiche.
  const [status, setStatus] = useState<'checking' | 'outside' | 'idle' | 'sending' | 'done' | 'error'>('checking');
  const [worldRank, setWorldRank] = useState<number | null>(null);
  // chrono qui a valu ce rang : le meilleur temps sur une course, pas le cumul
  const [worldSplit, setWorldSplit] = useState<number | null>(null);
  const [wouldBe, setWouldBe] = useState<number | null>(null);
  const [showTop500, setShowTop500] = useState(false);

  // Meilleur chrono realise sur une seule course du parcours : c'est lui qui
  // est classe, pas le cumul.
  const bestSplitMs = runSplits.length ? Math.min(...runSplits) * 1000 : runTime * 1000;

  // Un seul envoi par parcours termine, meme si le composant se re-rend.
  useEffect(() => {
    let cancelled = false;
    fetchLeaderboardRaw(raceKey)
      .then(list => {
        if (cancelled) return;
        const rank = rankOf(rankByRaceTime(list), bestSplitMs);
        setWouldBe(rank);
        if (rank > TOP_N) { setStatus('outside'); return; }
        if (getSavedName()) handleSave(getSavedName());
        else setStatus('idle');
      })
      // Classement injoignable : on laisse la possibilite d'envoyer plutot
      // que de retenir un chrono qui meritait peut-etre sa place.
      .catch(() => { if (!cancelled) setStatus('idle'); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (nameToUse?: string) => {
    const finalName = (nameToUse ?? name).trim();
    if (!finalName) return;
    saveName(finalName);
    setStatus('sending');
    try {
      const bestSplit = bestSplitMs;
      const res = await submitScore(raceKey, finalName, runTime * 1000, bestSplit);
      // Le rang se joue sur le meilleur chrono d'une course. On le recalcule
      // depuis la liste renvoyee plutot que de dependre du champ du serveur.
      const mine = res.best_split_ms ?? bestSplit;
      setWorldSplit(mine);
      setWorldRank(rankOf(rankByRaceTime(res.entries || []), mine));
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  const handleReplay = () => {
    SprinterApp.startRun();
  };

  const handleHome = () => SprinterApp.goHome();

  return (
    <div className="w-full h-full flex flex-col pointer-events-auto bg-black/90 backdrop-blur-md overflow-y-auto px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)] pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)]">
      <div className="min-h-full flex flex-col items-center justify-center w-full">
        <motion.div {...SURGISSEMENT} className="flex flex-col items-center max-w-2xl w-full py-6 md:py-8 gap-4 md:gap-6">
          
          <div className="flex flex-col items-center text-center gap-1 md:gap-2">
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-black font-display text-primary tracking-tighter uppercase drop-shadow-[0_0_30px_rgba(248,205,74,0.4)]">
              {N.t('run_done')}
            </h1>
            
            <div className="text-[10px] sm:text-xs md:text-base font-medium text-foreground/80 tracking-widest uppercase">
              {N.t('six_in')}<span className="text-white font-bold ml-1 md:ml-2">{runTime.toFixed(2)} s</span>
            </div>
          </div>
          
          {/* Splits Card */}
          <div className="w-full bg-card/60 border border-white/10 rounded-2xl p-3 sm:p-4 md:p-8 shadow-2xl">
            <div className="flex flex-col gap-1.5 md:gap-3">
              {runSplits.map((split, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 md:px-4 md:py-3 rounded-xl border border-white/5 bg-black/20">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-4 overflow-hidden pr-2">
                    <span className="text-[10px] md:text-xs font-bold tracking-widest text-muted-foreground uppercase shrink-0">
                      {N.t('stage_low')} {i + 1}
                    </span>
                    <span className="font-bold tracking-wide text-foreground text-sm md:text-base truncate">
                      {N.levelName(i)}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-primary text-base md:text-lg shrink-0">
                    {split.toFixed(2)} s
                  </span>
                </div>
              ))}
            </div>
            
            <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-white/10 flex justify-between items-center px-2 md:px-4">
              <span className="font-bold tracking-widest text-foreground uppercase text-sm md:text-base">TOTAL</span>
              <span className="font-mono font-black text-xl md:text-2xl text-primary">{runTime.toFixed(2)} s</span>
            </div>
          </div>

          {/* Rank Badge */}
          {runRank && (
            <motion.div {...retarde(MONTEE, 0.5)} className="bg-primary text-background font-black font-display tracking-widest uppercase px-6 py-3 md:px-8 md:py-4 rounded-xl text-lg sm:text-xl md:text-2xl shadow-[0_0_30px_rgba(248,205,74,0.4)] text-center flex items-center gap-2 md:gap-3">
              <img
                src={`${BASE}/icons/${runRank === 1 ? 'medal1' : runRank <= 3 ? 'medal2' : 'star'}.png`}
                alt=""
                className="w-6 h-6 md:w-8 md:h-8"
              />
              {runRank === 1 ? N.t('best_run') : runRank <= 3 ? N.t('top3_runs') : N.t('top10_runs')}
            </motion.div>
          )}

          {/* Classement mondial TOP 500 */}
          <div className="w-full bg-card/60 border border-white/10 rounded-2xl p-3 sm:p-4 md:p-6 shadow-2xl flex flex-col gap-2 md:gap-3">
            <div className="flex items-center gap-2 justify-center">
              <Globe2 className="w-4 h-4 text-primary" />
              <h2 className="font-bold tracking-widest text-primary text-xs md:text-sm">{N.t('top500')}</h2>
            </div>

            {status === 'done' && worldRank !== null && (
              <div className="text-center text-primary font-bold text-sm md:text-base tracking-wide">
                {worldSplit
                  ? N.t('score_saved_race', { r: N.ord(worldRank), s: (worldSplit / 1000).toFixed(2) })
                  : N.t('score_saved', { r: N.ord(worldRank) })}
              </div>
            )}
            {status === 'error' && (
              <div className="text-center text-destructive text-xs md:text-sm">{N.t('score_save_fail')}</div>
            )}
            {status === 'checking' && (
              <div className="text-center text-xs md:text-sm text-muted-foreground animate-pulse">
                {N.t('loading_ranks')}
              </div>
            )}
            {/* Hors des 500 : on ne demande pas de nom, on annonce simplement
                le chrono qu'il aurait fallu battre pour entrer. */}
            {status === 'outside' && (
              <div className="flex flex-col items-center gap-1 py-1">
                <span className="text-sm md:text-base font-bold text-muted-foreground tracking-wide">
                  {N.t('outside_top500')}
                </span>
                <span className="font-mono text-xs md:text-sm text-foreground/70">
                  {(bestSplitMs / 1000).toFixed(2)} s
                </span>
              </div>
            )}

            {status === 'idle' && wouldBe !== null && (
              <div className="text-center text-primary font-bold text-sm md:text-base tracking-wide">
                {N.t('will_enter', { s: (bestSplitMs / 1000).toFixed(2), r: N.ord(wouldBe) })}
              </div>
            )}

            {status !== 'sending' && status !== 'checking' && status !== 'outside' && (
              <div className="flex gap-2">
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={N.t('your_name')}
                  maxLength={20}
                  className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                />
                <button
                  onClick={() => handleSave()}
                  disabled={!name.trim()}
                  className="shrink-0 px-4 py-2 rounded-xl font-bold tracking-wide text-xs md:text-sm text-background bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  {status === 'done' ? N.t('edit_name') : N.t('save_score')}
                </button>
              </div>
            )}
            {status === 'sending' && (
              <div className="text-center text-xs md:text-sm text-muted-foreground animate-pulse">{N.t('saving_score')}</div>
            )}

            <button
              onClick={() => setShowTop500(true)}
              className="text-xs md:text-sm text-muted-foreground hover:text-primary transition-colors underline underline-offset-2"
            >
              {N.t('view_top500')}
            </button>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full max-w-md mt-2">
            <button onClick={handleReplay} className="flex-1 py-3 md:py-4 rounded-xl font-black font-display text-lg sm:text-xl md:text-2xl tracking-widest text-background bg-primary hover:bg-primary/90 transition-all border-b-4 border-amber-600 active:border-b-0 active:translate-y-1">
              {N.t('replay')}
            </button>
            <button onClick={handleHome} className="flex-1 py-3 md:py-4 rounded-xl font-bold tracking-widest text-foreground bg-secondary hover:bg-secondary/80 transition-all border-b-4 border-black active:border-b-0 active:translate-y-1">
              {N.t('home')}
            </button>
          </div>

        </motion.div>
      </div>
    </div>
  );
}
