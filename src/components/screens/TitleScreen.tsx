import React, { useState } from 'react';
import { SprinterApp, useGameStore, toggleLang, toggleAudio } from '@/game/engine';
import { Globe, Globe2 } from 'lucide-react';
import { LeaderboardScreen } from './LeaderboardScreen';
import { OneShotPanel, ChallengePanel } from './ModePanels';
import { DuelRanking } from './DuelRanking';
import { DUELS_OUVERTS } from '@/game/duels';
import { Swords } from 'lucide-react';
import { codeFromUrl } from '@/game/challenge';
import { codeDirectUrl } from '@/game/live';
import { Tutorial, tutoVu, marquerTutoVu } from './Tutorial';
import { GraduationCap } from 'lucide-react';
import { NameChip } from './NameChip';
import { GameTour, tourVu, marquerTourVu } from './GameTour';
import { TutoPropose } from './TutoPropose';
import { Compass } from 'lucide-react';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

type Tab = 'career' | 'oneshot' | 'versus';
const TABS: { id: Tab; key: string }[] = [
  { id: 'career', key: 'mode_career' },
  { id: 'oneshot', key: 'mode_oneshot' },
  { id: 'versus', key: 'mode_versus' },
];

export function TitleScreen() {
  const { raceKey, runs, furthest } = useGameStore();
  const { Audio_, N, RACES } = SprinterApp;
  const [showTop500, setShowTop500] = useState(false);
  const [showDuels, setShowDuels] = useState(false);
  const [tuto, setTuto] = useState(false);
  // La visite du jeu ne s'impose pas a quelqu'un qui arrive pour un duel.
  //
  // Un lien ?defi= ou ?direct= veut dire qu'on vient courir contre quelqu'un
  // de precis, souvent parce qu'un ami vient d'envoyer son chrono. Le duel se
  // joue entre gens qui savent deja courir : on ne les retient pas sur un
  // ecran d'explication. La visite reste a portee depuis l'accueil.
  //
  // Le relais fera exception le jour venu — le passage de temoin est un geste
  // neuf, qui ne se devine pas et qu'il faudra montrer.
  const venuPourUnDuel = !!(codeFromUrl() || codeDirectUrl());
  const [tour, setTour] = useState(() => !tourVu() && !venuPourUnDuel);
  const [propose, setPropose] = useState(false);
  // Un lien ?defi=CODE ou ?direct=CODE doit tomber sur l'onglet du defi.
  const [tab, setTab] = useState<Tab>(() => (venuPourUnDuel ? 'versus' : 'career'));

  // Premiere course : on PROPOSE le tutoriel, on ne l'impose pas. Le joueur
  // vient d'appuyer sur COMMENCER — il voulait courir. Lui ouvrir un tutoriel
  // d'office, avec un lien « passer » en petit dans un coin, c'est lui donner
  // autre chose que ce qu'il a demande.
  const handleStart = () => {
    if (!tutoVu()) { setPropose(true); return; }
    SprinterApp.startRun();
  };

  // Les deux reponses valent acceptation : on ne repose pas la question a la
  // course suivante, et le tutoriel reste a portee depuis l'accueil.
  const repondrePropose = (apprendre: boolean) => {
    setPropose(false);
    marquerTutoVu();
    if (apprendre) setTuto(true);
    else SprinterApp.startRun();
  };

  const fermerTuto = (lancer: boolean) => {
    marquerTutoVu();
    setTuto(false);
    if (lancer) SprinterApp.startRun();
  };

  const handleRaceToggle = (key: '100' | '200' | '400') => {
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

          {/* Le nom du joueur occupe le centre du bandeau, qui etait vide.
              C'est le seul ecran que tout le monde traverse. */}
          <NameChip />

          <button
            onClick={() => toggleAudio()}
            className="bg-card/80 backdrop-blur-md border border-white/10 p-2 md:p-3 rounded-xl hover:bg-white/10 transition-colors"
          >
            <img
              src={`${BASE}/icons/${Audio_.on ? 'audio-on' : 'audio-off'}.png`}
              alt=""
              className={`w-4 h-4 md:w-5 md:h-5 ${Audio_.on ? 'opacity-100' : 'opacity-40'}`}
            />
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
                {tab === 'career'
                  ? <>{RACES[raceKey].label} &mdash; {N.t('six_stages_bare')}</>
                  : N.t(tab === 'oneshot' ? 'oneshot_desc' : 'versus_desc')}
              </p>
            </div>
          </div>

          {/* Right Side: Records and Controls */}
          <div className="flex-1 flex flex-col justify-center gap-3 sm:gap-4 md:gap-6 max-w-md w-full">

            {/* Selecteur de mode */}
            {/* Le selecteur flotte au-dessus de la piste, tres claire : sans
                fond assez opaque les onglets inactifs deviennent illisibles. */}
            <div className="flex gap-1 p-1 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 py-2 rounded-xl font-bold tracking-widest text-[10px] md:text-xs transition-all
                    ${tab === t.id
                      ? 'bg-primary text-background shadow-[0_0_15px_rgba(248,205,74,0.25)]'
                      : 'text-foreground/70 hover:text-foreground hover:bg-white/10'}`}
                >
                  {N.t(t.key)}
                </button>
              ))}
            </div>

            {/* Classement des duels : accessible depuis les trois onglets,
                c'est une facon de jouer a part entiere. La piste derriere est
                claire et bariolee — sans fond opaque le bouton s'y noie.
                Ferme tant que DUELS_OUVERTS vaut false (voir game/duels). */}
            {DUELS_OUVERTS && <button
              onClick={() => setShowDuels(true)}
              className="w-full px-4 py-3 rounded-2xl bg-black/70 backdrop-blur-md
                         border border-primary/50 hover:bg-black/85 transition-colors
                         shadow-[0_0_25px_rgba(248,205,74,0.2)]
                         flex items-center justify-between gap-3 text-left"
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Swords className="w-4 h-4 md:w-5 md:h-5 text-primary shrink-0" />
                <span className="flex flex-col min-w-0">
                  <span className="font-bold tracking-widest text-primary text-[11px] md:text-sm truncate">
                    {N.t('duel_open')}
                  </span>
                  <span className="text-[9px] md:text-[10px] text-foreground/60 truncate">
                    {N.t('duel_sub')}
                  </span>
                </span>
              </span>
              <span className="font-mono text-[9px] md:text-[10px] text-primary/80 shrink-0 tracking-wider">
                +2 / -1
                <span className="block text-cyan-300/70">+1 / -2</span>
              </span>
            </button>}

            {tab === 'oneshot' && <OneShotPanel />}
            {tab === 'versus' && <ChallengePanel />}

            {tab === 'career' && <>
            {/* Leaderboard Card */}
            <div className="bg-card/70 backdrop-blur-xl border border-white/10 rounded-2xl p-4 md:p-6 shadow-2xl">
              <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-6 justify-center">
                <img src={`${BASE}/icons/trophy.png`} alt="" className="w-4 h-4 md:w-5 md:h-5" />
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
              {(['100', '200', '400'] as const).map(k => (
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

            {/* Toujours accessible : on oublie vite la regle de la transition,
                et les joueurs arrives par un lien de defi n'ont jamais vu le
                tutoriel. */}
            <button
              onClick={() => setTuto(true)}
              className="w-full -mt-1 py-1.5 text-[10px] md:text-xs font-bold tracking-widest
                         text-muted-foreground hover:text-primary transition-colors
                         flex items-center justify-center gap-1.5"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              {N.t('tuto_open')}
            </button>

            <button
              onClick={() => setTour(true)}
              className="w-full -mt-2 py-1.5 text-[10px] md:text-xs font-bold tracking-widest
                         text-muted-foreground hover:text-primary transition-colors
                         flex items-center justify-center gap-1.5"
            >
              <Compass className="w-3.5 h-3.5" />
              {N.t('tour_open')}
            </button>
            </>}

          </div>
        </div>
      </div>

      {/* A la toute premiere visite on montre le jeu avant de le faire jouer :
          un joueur qui n'a vu que l'accueil ignore qu'il existe un classement
          mondial et des defis. Le tutoriel du geste, lui, reste au moment de
          la premiere course — deux tutoriels d'affilee avant de courir, ce
          serait un de trop. */}
      {tour && <GameTour onClose={(jouer) => { marquerTourVu(); setTour(false); if (jouer) handleStart(); }} />}

      {propose && <TutoPropose onChoix={repondrePropose} />}

      {tuto && <Tutorial onClose={fermerTuto} />}

      {showDuels && <DuelRanking onClose={() => setShowDuels(false)} />}

      {showTop500 && (
        <LeaderboardScreen initialRace={raceKey} onClose={() => setShowTop500(false)} />
      )}
    </div>
  );
}
