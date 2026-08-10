import React, { useState } from 'react';
import { SprinterApp, useGameStore, toggleLang, toggleAudio } from '@/game/engine';
import { Trophy, Volume2, VolumeX, Globe, Globe2 } from 'lucide-react';
import { LeaderboardScreen } from './LeaderboardScreen';

export function TitleScreen() {
  const { raceKey, runs, furthest } = useGameStore();
  const { Audio_, N, RACES } = SprinterApp;
  const [showTop500, setShowTop500] = useState(false);

  const handleStart = () => {
    SprinterApp.startRun();
  };

  const handleRaceToggle = (key: '100' | '200') => {
    SprinterApp.G.raceKey = key;
    SprinterApp.G.race = RACES[key];
    SprinterApp.buildLevel(0);
  };

  const currentRuns = runs[raceKey] || [];
  
  return (
    <div className="w-full h-full flex flex-col pointer-events-auto overflow-y-auto bg-black/20 px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)] pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)]">
      <div className="min-h-full flex flex-col w-full">
        {/* Header controls */}
        <div className="w-full flex justify-between items-start z-20 shrink-0 mb-2 md:mb-4">
          <button 
            onClick={() => toggleLang()}
            className="bg-card/80 backdrop-blur-md border border-white/10 px-3 py-1.5 md:px-4 md:py-2 rounded-xl flex items-center gap-1.5 md:gap-2 hover:bg-white/10 transition-colors"
          >
            <Globe className="w-3.5 h-3.5 md:w-4 md:h-4 text-muted-foreground" />
            <span className="font-bold text-xs md:text-sm text-foreground/90">{N.getLang().toUpperCase()}</span>
          </button>

          <button 
            onClick={() => toggleAudio()}
            className="bg-card/80 backdrop-blur-md border border-white/10 p-2 md:p-3 rounded-xl hover:bg-white/10 transition-colors"
          >
            {Audio_.on ? <Volume2 className="w-4 h-4 md:w-5 md:h-5 text-primary" /> : <VolumeX className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />}
          </button>
        </div>

        <div className="flex-1 flex flex-col landscape:flex-row justify-between items-center landscape:items-stretch gap-6 landscape:gap-8 max-w-5xl mx-auto w-full pb-4">
          
          {/* Left Side: Title */}
          <div className="flex-1 flex flex-col justify-center items-center landscape:items-start text-center landscape:text-left mt-4 md:mt-0">
            <div className="bg-card/60 backdrop-blur-sm border border-white/10 px-6 py-5 md:px-8 md:py-6 rounded-2xl w-full max-w-md border-t-white/20">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black font-display tracking-tight text-primary drop-shadow-md">
                SPRINTER
              </h1>
              <p className="mt-1 md:mt-2 text-[10px] sm:text-xs md:text-base lg:text-xl font-medium text-foreground/80 tracking-wide uppercase">
                {RACES[raceKey].label} &mdash; {N.t('six_stages')}
              </p>
            </div>
          </div>

          {/* Right Side: Records and Controls */}
          <div className="flex-1 flex flex-col justify-center gap-3 sm:gap-4 md:gap-6 max-w-md w-full">
            
            {/* Leaderboard Card */}
            <div className="bg-card/70 backdrop-blur-xl border border-white/10 rounded-2xl p-4 md:p-6 shadow-2xl">
              <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-6 justify-center">
                <Trophy className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                <h2 className="font-bold tracking-widest text-primary text-xs md:text-sm">{N.t('best_runs')}</h2>
              </div>
              <button
                onClick={() => setShowTop500(true)}
                className="w-full mb-3 md:mb-4 py-2 rounded-xl bg-primary/10 border border-primary/30 text-primary font-bold tracking-widest text-[10px] md:text-xs flex items-center justify-center gap-2 hover:bg-primary/20 transition-colors"
              >
                <Globe2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                {N.t('view_top500')}
              </button>

              {!currentRuns.length ? (
                <div className="py-4 md:py-8 text-center flex flex-col gap-1 md:gap-2">
                  <p className="text-xs md:text-sm text-muted-foreground font-medium">{N.t('no_run')}</p>
                  <p className="text-foreground/90 font-bold text-xs md:text-sm uppercase tracking-wide">
                    {N.t('furthest')} {furthest[raceKey]} {N.t('of_six')}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-1 md:gap-2">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const run = currentRuns[i];
                    return (
                      <div key={i} className="flex items-center text-xs md:text-sm font-mono bg-black/20 rounded-md px-2 py-1.5 md:px-3 md:py-2 border border-white/5">
                        <span className="w-4 md:w-6 text-muted-foreground/50">{i + 1}.</span>
                        {run ? (
                          <>
                            <span className={`font-bold ml-1 md:ml-2 ${i === 0 ? 'text-primary' : i < 3 ? 'text-cyan-400' : 'text-foreground'}`}>
                              {run.toFixed(2)} s
                            </span>
                            <div className="flex-1 ml-2 md:ml-4 h-1 md:h-1.5 bg-black/40 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${i === 0 ? 'bg-primary' : i < 3 ? 'bg-cyan-400' : 'bg-white/40'}`}
                                style={{ width: `${(currentRuns[0] / run) * 100}%` }}
                              />
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground ml-1 md:ml-2 font-medium">--</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Race Selectors */}
            <div className="flex gap-2">
              {(['100', '200'] as const).map(k => (
                <button
                  key={k}
                  onClick={() => handleRaceToggle(k)}
                  className={`flex-1 py-2 md:py-4 rounded-xl font-bold tracking-wider transition-all border-b-2 text-sm md:text-base
                    ${raceKey === k 
                      ? 'bg-primary/20 text-primary border-primary shadow-[0_0_15px_rgba(248,205,74,0.2)]' 
                      : 'bg-card/80 text-muted-foreground border-transparent hover:bg-white/10'}`}
                >
                  {k} M
                </button>
              ))}
            </div>

            {/* Start Button */}
            <button 
              onClick={handleStart}
              className="w-full py-3 md:py-5 rounded-xl font-black font-display text-xl md:text-2xl tracking-widest text-background bg-primary hover:bg-primary/90 transition-all border-b-4 border-amber-600 active:border-b-0 active:translate-y-1 shadow-[0_0_30px_rgba(248,205,74,0.4)]"
            >
              {N.t('start')}
            </button>

          </div>
        </div>
      </div>

      {showTop500 && (
        <LeaderboardScreen initialRace={raceKey} onClose={() => setShowTop500(false)} />
      )}
    </div>
  );
}
