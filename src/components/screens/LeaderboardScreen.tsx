import React, { useEffect, useState } from 'react';
import { Swords } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import {
  fetchLeaderboardRaw, fetchMyRank, rankByRaceTime, rankByRunTime, rankOf,
  NO_RUN_MS, type LeaderboardEntry, type RaceKey,
} from '@/game/leaderboard';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

// Deux facons de classer une meme discipline : le meilleur chrono realise sur
// une seule course, et le cumul du parcours complet en six etapes.
type Cat = 'race' | 'run' | 'mine';

type Course = { r: string; t: number; m: string; l: number; d: number };

export function LeaderboardScreen({ initialRace, onClose }: { initialRace: RaceKey; onClose: () => void }) {
  const { N, RACES } = SprinterApp;
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
  // L'historique est local : il n'attend aucune reponse reseau.
  const mesCourses: Course[] = (SprinterApp.raceHistory() as Course[])
    .filter(c => c.r === race);

  const entries = raw === null ? null : (cat === 'run' ? rankByRunTime(raw) : rankByRaceTime(raw));
  const myRank = entries && mySplit && cat === 'race' ? rankOf(entries, mySplit) : null;
  const value = (e: LeaderboardEntry) => (cat === 'race' ? e.best_split_ms : e.time_ms);
  // NO_RUN_MS n'est pas un chrono : c'est la marque d'une ligne nee d'un one
  // shot ou d'un defi, sans parcours complet derriere. L'afficher donnerait un
  // « parcours complet : 1200.00 s » absurde.
  const other = (e: LeaderboardEntry) => {
    const v = cat === 'race' ? e.time_ms : e.best_split_ms;
    return cat === 'race' && v >= NO_RUN_MS ? 0 : v;
  };
  const otherLabel = cat === 'race' ? N.t('run_total_tiny') : N.t('best_split_tiny');

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
                {N.t(cat === 'race' ? 'cat_race_sub' : cat === 'run' ? 'cat_run_sub' : 'cat_mine_sub')}
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
          {([['race', 'cat_race'], ['run', 'cat_run'], ['mine', 'cat_mine']] as const).map(([id, key]) => (
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

        {/* Historique personnel : tout ce qu'on a couru, y compris ce que le
            classement ne peut pas garder. Lu sur l'appareil, sans reseau. */}
        {cat === 'mine' ? (
          <div className="w-full bg-card/70 border border-white/10 rounded-2xl p-3 md:p-4 shadow-2xl">
            {mesCourses.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">{N.t('mine_empty')}</p>
            ) : (
              <>
                <div className="flex items-baseline justify-between px-1 pb-2 mb-1 border-b border-white/10">
                  <span className="text-[10px] md:text-xs font-bold tracking-widest text-muted-foreground">
                    {N.t('mine_count', {
                      n: mesCourses.length,
                      s: Math.min(...mesCourses.map(c => c.t)).toFixed(2),
                    })}
                  </span>
                  <span className="text-[9px] md:text-[10px] text-muted-foreground/70">
                    {RACES[race].label}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 max-h-[calc(100dvh-24rem)] min-h-[36vh] overflow-y-auto overscroll-contain pr-1">
                  {mesCourses.map((c, i) => {
                    const best = c.t === Math.min(...mesCourses.map(x => x.t));
                    return (
                      <div key={i} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border
                        ${best ? 'bg-primary/10 border-primary/30' : 'border-white/5 bg-black/20'}`}>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-[10px] md:text-xs text-muted-foreground truncate">
                            {new Date(c.d).toLocaleDateString(N.getLang() === 'fr' ? 'fr-FR' : 'en-GB',
                              { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="text-[9px] md:text-[10px] text-muted-foreground/70 truncate">
                            {N.t(c.m === 'oneshot' ? 'mode_oneshot_s' : 'mode_career_s')}
                            {c.m !== 'oneshot' && ` · ${N.levelName(c.l)}`}
                          </span>
                        </div>
                        <span className={`font-mono font-bold text-sm md:text-base shrink-0 tabular-nums
                          ${best ? 'text-primary' : 'text-foreground'}`}>
                          {c.t.toFixed(2)} s
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[9px] md:text-[10px] text-muted-foreground/70 leading-snug mt-3 pt-2 border-t border-white/10">
                  {N.t('mine_note')}
                </p>
              </>
            )}
          </div>
        ) : (
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
            <>
            {/* Combien de noms le tableau porte reellement, sur les 500
                places : sans ce reperage on ne sait pas si la liste est
                complete ou tronquee. */}
            <div className="flex items-baseline justify-between px-1 pb-2 mb-1 border-b border-white/10">
              <span className="text-[10px] md:text-xs font-bold tracking-widest text-muted-foreground">
                {N.t('top500_count', { n: entries.length })}
              </span>
              <span className="text-[9px] md:text-[10px] text-muted-foreground/70">
                {RACES[race].label}
              </span>
            </div>
            {/* La liste occupe toute la hauteur disponible : avec 500 noms,
                une fenetre de 50 vh obligeait a defiler dans un hublot. */}
            <div className="flex flex-col gap-1.5 max-h-[calc(100dvh-22rem)] min-h-[40vh] overflow-y-auto overscroll-contain pr-1">
              {entries.map((e, i) => {
                const rank = i + 1;
                const isMe = myRank === rank;
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl border ${isMe ? 'bg-primary/15 border-primary/40' : 'border-white/5 bg-black/20'}`}
                  >
                    {/* Le nom prend toute la place restante : flex-1 avec
                        min-w-0, sans quoi il se fait ecraser par le bouton et
                        les chronos, et ne reste qu'une initiale. */}
                    <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0 pr-2">
                      <span className={`font-bold w-6 md:w-8 shrink-0 text-xs md:text-sm ${rank === 1 ? 'text-primary' : rank === 2 ? 'text-slate-300' : rank === 3 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                        {rank}.
                      </span>
                      <span className={`font-bold tracking-wide truncate text-xs md:text-sm ${isMe ? 'text-primary' : 'text-foreground'}`}>
                        {e.name}
                      </span>
                    </div>
                    {/* Defier cette personne. Reduit a une icone : le libelle
                        mangeait la largeur du nom. Le titre et l'aria-label
                        gardent l'intention lisible. */}
                    {!isMe && e.id != null && (
                      <button
                        onClick={() => {
                          SprinterApp.G.challengeTarget = { scoreId: e.id, name: e.name };
                          onClose();
                          SprinterApp.startOneShot([race], { levelIdx: 4 });
                        }}
                        title={`${N.t('challenge_them')} — ${e.name}`}
                        aria-label={`${N.t('challenge_them')} ${e.name}`}
                        className="shrink-0 mr-2 w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center
                                   text-primary/70 border border-primary/30 hover:bg-primary/15 hover:text-primary transition-colors"
                      >
                        <Swords className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      </button>
                    )}
                    {/* Colonne des chronos calee sur son contenu le plus
                        large, pour que le reste revienne au nom. */}
                    <div className="flex flex-col items-end shrink-0 tabular-nums">
                      <span className={`font-mono font-bold text-sm md:text-base whitespace-nowrap ${rank === 1 ? 'text-primary' : 'text-foreground'}`}>
                        {(value(e) / 1000).toFixed(2)} s
                      </span>
                      {!!other(e) && (
                        <span className="font-mono text-[9px] md:text-[10px] text-muted-foreground whitespace-nowrap">
                          {otherLabel} {(other(e) / 1000).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            </>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
