import React, { useEffect, useState } from 'react';
import { SprinterApp, useGameStore, toggleLang, toggleAudio } from '@/game/engine';
import { Globe, Globe2 } from 'lucide-react';
import { LeaderboardScreen } from './LeaderboardScreen';
import { OneShotPanel, ChallengePanel } from './ModePanels';
import { DuelRanking } from './DuelRanking';
import { DUELS_OUVERTS, fetchDuels, type DuelRow } from '@/game/duels';
import { Ecusson } from '@/components/Insignes';
import { Swords } from 'lucide-react';
import { codeFromUrl } from '@/game/challenge';
import { codeDirectUrl } from '@/game/live';
import { Tutorial, tutoVu, marquerTutoVu } from './Tutorial';
import { GraduationCap } from 'lucide-react';
import { NameChip } from './NameChip';
import { GameTour, tourVu, marquerTourVu } from './GameTour';
import { TutoPropose } from './TutoPropose';
import { Compass } from 'lucide-react';
import { allerAu, mondeVers, MONDES_OUVERTS } from '@/game/mondes';
import { useGesteMondes } from '@/hooks/use-geste-mondes';
import type { Direction } from '@/game/mondes';
import { ChevronDown, ChevronLeft as FlecheG, ChevronRight as FlecheD, Mail } from 'lucide-react';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

type Tab = 'career' | 'oneshot' | 'versus';
const TABS: { id: Tab; key: string }[] = [
  { id: 'career', key: 'mode_career' },
  { id: 'oneshot', key: 'mode_oneshot' },
  { id: 'versus', key: 'mode_versus' },
];

/**
 * Le pied de l'accueil : les trois liens de bas de page.
 *
 * Il se tient SOUS le rouleau, hors de lui, et ne bouge donc plus. Avant,
 * chaque onglet portait ses liens au bas de son propre contenu : ils
 * remontaient avec le defi, dont le panneau est court, descendaient avec la
 * carriere, dont le panneau est long, et le contact se retrouvait seul quand
 * les deux autres ne vivaient qu'en carriere. Trois emplacements pour la meme
 * chose, decides par la hauteur du contenu et celle de la fenetre.
 *
 * Les libelles s'ecrivent en entier, sur deux lignes s'il le faut. « NOUS
 * CONT… » coupe au bord de l'ecran ne dit rien a personne, et un lien qu'on
 * ne lit pas n'est pas un lien. Sur un telephone tenu debout l'icone passe
 * donc au-dessus du mot, pour laisser toute la largeur de la colonne au
 * texte ; des qu'il y a de la place, elle revient a cote et la barre reprend
 * la moitie de sa hauteur — en paysage, chaque ligne gagnee compte.
 */
function PiedLiens({ onTour, onTuto }: { onTour: () => void; onTuto: () => void }) {
  const { N } = SprinterApp;
  const liens = [
    { cle: 'tour_open', Icone: Compass, action: onTour },
    { cle: 'tuto_open', Icone: GraduationCap, action: onTuto },
    // mailto: par window.location — un <a href> ne mene nulle part dans la
    // fenetre sans barre d'adresse d'une application installee.
    { cle: 'contact', Icone: Mail,
      action: () => { window.location.href = 'mailto:support@sprinter-game.com'; } },
  ];

  return (
    <div className="shrink-0 w-full max-w-md mx-auto mt-3 md:mt-4 grid grid-cols-3 gap-1">
      {liens.map(({ cle, Icone, action }) => (
        <button
          key={cle}
          onClick={action}
          className="min-w-0 px-1 py-1.5
                     flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5
                     text-[10px] md:text-[11px] font-bold tracking-wide leading-tight text-center
                     text-muted-foreground hover:text-primary transition-colors"
        >
          <Icone className="w-3.5 h-3.5 shrink-0" />
          <span className="w-full sm:w-auto break-words">{N.t(cle)}</span>
        </button>
      ))}
    </div>
  );
}

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
  /**
   * Ma division, affichee a l'entree du classement.
   *
   * Sans marquer la visite : ouvrir le jeu ne doit pas effacer les fleches
   * qu'on n'a pas encore vues. C'est le meme piege que sur l'ecran du
   * classement, ou un rafraichissement automatique les aurait fait
   * disparaitre toutes seules.
   */
  const [monRang, setMonRang] = useState<DuelRow | null>(null);
  useEffect(() => {
    if (!DUELS_OUVERTS) return;
    let annule = false;
    fetchDuels(false).then(b => { if (!annule) setMonRang(b?.moi || null); });
    return () => { annule = true; };
  }, []);
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

  // Le geste qui mene aux trois autres jeux. Il se pose sur le rouleau de
  // l'accueil, pas sur la fenetre : c'est la position de ce rouleau qui dit si
  // l'on est au bout, et donc si tirer encore veut dire « montre-moi les
  // haies » plutot que « fais defiler ».
  const rouleau = React.useRef<HTMLDivElement>(null);
  useGesteMondes(rouleau, (d: Direction) => allerAu(mondeVers(d)), MONDES_OUVERTS);

  return (
    <div className="w-full h-full flex flex-col pointer-events-auto overflow-hidden bg-black/20 px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)] pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),0.25rem)]">
      {/* Ce qui defile defile ici, et seulement ici : le pied de page reste
          en dehors, pose au bas de l'ecran. */}
      <div ref={rouleau} className="flex-1 min-h-0 overflow-y-auto">
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
              {/* Le rang, et rien d'autre.
                  Le bareme figurait ici sous forme de chiffres ; il n'a plus
                  de sens hors contexte, puisque ce qu'un duel rapporte depend
                  d'ou l'on se situe. Ce que le joueur vient chercher d'un coup
                  d'oeil, c'est sa division. */}
              {monRang
                ? <Ecusson etage={monRang.etage} division={monRang.division}
                           lp={monRang.etage === 'legende' ? monRang.lp : undefined} />
                : <span className="font-mono text-[9px] md:text-[10px] text-primary/60
                                   shrink-0 tracking-wider">—</span>}
            </button>}

            {/* Les trois autres jeux, annonces.
                Un geste que rien n'annonce n'existe pas : personne ne tire
                l'ecran vers le bas pour voir s'il se passe quelque chose. Ces
                trois reperes sont la pour etre remarques une fois, et oublies
                ensuite — c'est pourquoi ils sont discrets et ne prennent pas
                de place. */}
            {MONDES_OUVERTS && (
              <div className="flex items-center justify-between gap-2 px-1 pt-1 pb-0.5">
                <button onClick={() => allerAu('thrower')}
                        className="flex items-center gap-1 text-[9px] tracking-widest
                                   text-white/40 hover:text-white/80 transition-colors">
                  <FlecheG className="w-3 h-3" /> THROWER
                </button>
                <button onClick={() => allerAu('hurdlers')}
                        className="flex items-center gap-1 text-[9px] tracking-widest
                                   text-white/40 hover:text-white/80 transition-colors">
                  HURDLERS <ChevronDown className="w-3 h-3" />
                </button>
                <button onClick={() => allerAu('jumper')}
                        className="flex items-center gap-1 text-[9px] tracking-widest
                                   text-white/40 hover:text-white/80 transition-colors">
                  JUMPER <FlecheD className="w-3 h-3" />
                </button>
              </div>
            )}

            {tab === 'oneshot' && <OneShotPanel />}
            {tab === 'versus' && <ChallengePanel />}

            {tab === 'career' && <>
            {/* Les meilleurs parcours, resserres.
                Cette carte poussait COMMENCER sous la ligne de flottaison : il
                fallait derouler pour lancer une course, sur l'ecran dont c'est
                la seule raison d'etre. Trois blocs empiles sont devenus deux
                lignes, sans qu'aucune information disparaisse.

                Le titre et le bouton du TOP 500 partageaient le meme sens et
                occupaient deux etages ; ils tiennent sur une ligne. Et les
                lignes vides — celles des parcours qu'on n'a pas encore courus —
                ne sont plus dessinees : montrer cinq rangs dont quatre affichent
                « -- » prend la place de cinq resultats pour n'en donner qu'un. */}
            <div className="bg-card/70 backdrop-blur-xl border border-white/10 rounded-2xl p-3 md:p-5 shadow-2xl flex flex-col gap-2 md:gap-3">
              <div className="flex items-center gap-2">
                <img src={`${BASE}/icons/trophy.png`} alt="" className="w-4 h-4 shrink-0" />
                {/* Le titre passe a la ligne plutot que de se faire couper :
                    sur un ecran etroit il ne tient pas a cote du bouton, et
                    « MEILLEU… » ne dit rien. Deux lignes de titre restent bien
                    plus courtes que les deux blocs empiles d'avant. */}
                <h2 className="flex-1 min-w-0 font-bold tracking-widest text-primary
                               text-[11px] md:text-sm leading-tight">
                  {N.t('best_runs')}
                </h2>
                <button
                  onClick={() => setShowTop500(true)}
                  className="shrink-0 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/30
                             text-primary font-bold tracking-widest text-[9px] md:text-[11px]
                             flex items-center gap-1.5 hover:bg-primary/20 transition-colors"
                >
                  <Globe2 className="w-3 h-3 md:w-3.5 md:h-3.5 shrink-0" />
                  {N.t('top500_court')}
                </button>
              </div>

              {!currentRuns.length ? (
                <p className="text-[11px] md:text-sm text-center leading-snug text-muted-foreground">
                  {N.t('no_run')}
                  {' — '}
                  <span className="text-foreground/90 font-bold uppercase tracking-wide">
                    {N.t('furthest')} {furthest[raceKey]} {N.t('of_six')}
                  </span>
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  {currentRuns.slice(0, 5).map((run, i) => (
                    <div key={i} className="flex items-center text-[11px] md:text-sm font-mono
                                            bg-black/20 rounded-md px-2 py-1 md:px-3 md:py-1.5
                                            border border-white/5">
                      <span className="w-4 md:w-6 text-muted-foreground/50">{i + 1}.</span>
                      <span className={`font-bold ml-1 md:ml-2
                        ${i === 0 ? 'text-primary' : i < 3 ? 'text-cyan-400' : 'text-foreground'}`}>
                        {run.toFixed(2)} s
                      </span>
                      <div className="flex-1 ml-2 md:ml-4 h-1 md:h-1.5 bg-black/40 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${i === 0 ? 'bg-primary' : i < 3 ? 'bg-cyan-400' : 'bg-white/40'}`}
                          style={{ width: `${(currentRuns[0] / run) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
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

            </>}

          </div>
        </div>
      </div>
      </div>

      <PiedLiens onTour={() => setTour(true)} onTuto={() => setTuto(true)} />

      {/* A la toute premiere visite on montre le jeu avant de le faire jouer :
          un joueur qui n'a vu que l'accueil ignore qu'il existe un classement
          mondial et des defis. Le tutoriel du geste, lui, reste au moment de
          la premiere course — deux tutoriels d'affilee avant de courir, ce
          serait un de trop. */}
      {tour && <GameTour onClose={(jouer) => { marquerTourVu(); setTour(false); if (jouer) handleStart(); }} />}

      {propose && <TutoPropose onChoix={repondrePropose} />}

      {tuto && <Tutorial onClose={fermerTuto} />}

      {DUELS_OUVERTS && showDuels && <DuelRanking onClose={() => setShowDuels(false)} />}

      {showTop500 && (
        <LeaderboardScreen initialRace={raceKey} onClose={() => setShowTop500(false)} />
      )}
    </div>
  );
}
