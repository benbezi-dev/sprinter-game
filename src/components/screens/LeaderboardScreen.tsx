import React, { useEffect, useState } from 'react';
import { SprinterApp } from '@/game/engine';
import {
  fetchLeaderboardRaw, fetchMyRank, rankByRaceTime, rankByRunTime, rankOf,
  type LeaderboardEntry, type RaceKey,
} from '@/game/leaderboard';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

// Deux facons de classer une meme discipline : le meilleur chrono realise sur
// une seule course, et le cumul du parcours complet en six etapes.
type Cat = 'race' | 'run';

export function LeaderboardScreen({ initialRace, onClose }: { initialRace: RaceKey; onClose: () => void }) {
  const { N } = SprinterApp;
  const [race, setRace] = useState<RaceKey>(initialRace);
  const [cat, setCat] = useState<Cat>('race');
  const [raw, setRaw] = useState<LeaderboardEntry[] | null>(null);
  const [mySplit, setMySplit] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRaw(null);
    setError(false);
    setMySplit(null);
    Promise.all([fetchLeaderboardRaw(race), fetchMyRank(race)])
      .then(([list, mine]) => {
        if (cancelled) return;
        setRaw(list);
        setMySplit(mine.found && mine.best_split_ms ? mine.best_split_ms : null);
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [race]);

  // Les deux categories se derivent de la meme reponse : un seul aller-retour
  // reseau, et le tri reste juste quelle que soit la version du serveur.
  const entries = raw === null ? null : (cat === 'race' ? rankByRaceTime(raw) : rankByRunTime(raw));
  const myRank = entries && mySplit && cat === 'race' ? rankOf(entries, mySplit) : null;
  const value = (e: LeaderboardEntry) => (cat === 'race' ? e.best_split_ms : e.time_ms);
  const other = (e: LeaderboardEntry) => (cat === 'race' ? e.time_ms : e.best_split_ms);
  const otherLabel = cat === 'race' ? N.t('run_total_short') : N.t('best_split_short');

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center pointer-events-auto px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)] pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] overflow-y-auto">
      <div className="w-full max-w-lg mx-auto flex flex-col items-center py-6 md:py-8 gap-4">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={`${BASE}/icons/trophy.png`} alt="" className="w-5 h-5" />
            <div className="flex flex-col">
              <h2 className="font-black font-display tracking-tight text-primary text-xl md:text-2xl leading-tight">
                {N.t('top500')}
              </h2>
              <span className="text-[9px] md:text-[10px] text-muted-foreground tracking-wide">
                {N.t(cat === 'race' ? 'cat_race_sub' : 'cat_run_sub')}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-card/80 border border-white/10 hover:bg-white/10 transition-colors">
            <img src={`${BASE}/icons/cross.png`} alt="" className="w-4 h-4 opacity-80" />
          </button>
        </div>

        <div className="flex gap-2 w-full">
          {(['100', '200', '400'] as const).map(k => (
            <button
              key={k}
              onClick={() => setRace(k)}
              className={`flex-1 py-2 md:py-3 rounded-xl font-bold tracking-wider transition-all border-b-2 text-sm md:text-base
                ${race === k
                  ? 'bg-primary/20 text-primary border-primary'
                  : 'bg-card/80 text-muted-foreground border-transparent hover:bg-white/10'}`}
            >
              {k} M
            </button>
          ))}
        </div>

        {/* Categorie de classement */}
        <div className="flex gap-1 p-1 rounded-2xl bg-black/30 border border-white/10 w-full">
          {([['race', 'cat_race'], ['run', 'cat_run']] as const).map(([id, key]) => (
            <button
              key={id}
              onClick={() => setCat(id)}
              className={`flex-1 py-2 rounded-xl font-bold tracking-widest text-[10px] md:text-xs transition-all
                ${cat === id
                  ? 'bg-primary text-background shadow-[0_0_15px_rgba(248,205,74,0.25)]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
            >
              {N.t(key)}
            </button>
          ))}
        </div>

        {myRank && (
          <div className="w-full bg-primary/10 border border-primary/30 rounded-xl px-4 py-2 text-center">
            <span className="font-bold text-primary tracking-widest text-sm">
              {N.t('your_rank', { r: String(myRank) })}
            </span>
          </div>
        )}

        <div className="w-full bg-card/70 border border-white/10 rounded-2xl p-3 md:p-4 shadow-2xl">
          {error && (
            <p className="text-center text-sm text-destructive py-6">{N.t('score_save_fail')}</p>
          )}
          {!error && entries === null && (
            <p className="text-center text-sm text-muted-foreground py-6">{N.t('loading_ranks')}</p>
          )}
          {!error && entries !== null && entries.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-6">
              {N.t(cat === 'run' ? 'empty_cat_run' : 'empty_top500')}
            </p>
          )}
          {!error && entries !== null && entries.length > 0 && (
            <div className="flex flex-col gap-1.5 max-h-[50vh] overflow-y-auto pr-1">
              {entries.map((e, i) => {
                const rank = i + 1;
                const isMe = myRank === rank;
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl border ${isMe ? 'bg-primary/15 border-primary/40' : 'border-white/5 bg-black/20'}`}
                  >
                    <div className="flex items-center gap-2 md:gap-3 overflow-hidden pr-2">
                      <span className={`font-bold w-8 shrink-0 text-xs md:text-sm ${rank === 1 ? 'text-primary' : rank === 2 ? 'text-slate-300' : rank === 3 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                        {rank}.
                      </span>
                      <span className={`font-bold tracking-wide truncate text-xs md:text-sm ${isMe ? 'text-primary' : 'text-foreground'}`}>
                        {e.name}
                      </span>
                    </div>
                    {/* Le chrono qui decide du classement passe en gros ;
                        l'autre reste en dessous, a titre indicatif. */}
                    <div className="flex flex-col items-end shrink-0">
                      <span className={`font-mono font-bold text-sm md:text-base ${rank === 1 ? 'text-primary' : 'text-foreground'}`}>
                        {(value(e) / 1000).toFixed(2)} s
                      </span>
                      {!!other(e) && (
                        <span className="font-mono text-[9px] md:text-[10px] text-muted-foreground">
                          {otherLabel} {(other(e) / 1000).toFixed(2)} s
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
