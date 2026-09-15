import React from 'react';
import { SprinterApp, useGameStore } from '@/game/engine';

/**
 * L'ecran d'une cinematique : le bandeau, le titre, et les lignes qui
 * arrivent une a une.
 *
 * `fige` sert au seul fondu enchaine du jeu — le sacre qui s'efface par-dessus
 * le generique qui vient de demarrer. Cet ecran-la n'est plus celui en cours :
 * il lit la cinematique sortante plutot que le store, s'affiche a l'opacite
 * qui lui reste, et ne prend plus les touches — elles reviennent au generique,
 * dessous. Voir nextCut dans game/sprinter-app.js.
 *
 * PLUS DE VOILE SUR LE STADE. Tout l'ecran passait sous un noir a 40 % et un
 * flou de deux pixels : le stade refait dans Blender y redevenait une bouillie
 * sombre, les spectateurs des taches, et les couleurs relevees pour la course
 * retombaient des qu'une scenette commencait. Le texte a maintenant sa propre
 * carte, et le stade reste net et franc derriere — comme en course.
 */
export function CutScreen({ fige }: { fige?: any } = {}) {
  const { cut: courant, skipArm } = useGameStore();
  const { N } = SprinterApp;

  const cut = fige || courant;
  const sortant = !!fige;

  if (!cut) return null;

  const ct = cut.t;
  const intro = cut.kind === 'intro';
  const champ = cut.kind === 'champion';
  const accent = champ ? '#F8CD4A' : '#38BDF8';

  // La carte monte avec le titre : elle n'a rien a montrer avant lui.
  const carte = SprinterApp.clamp((ct - 0.35) / 0.4, 0, 1);
  const glisse = 1 - Math.pow(1 - carte, 3);

  // Une pastille sombre sous les deux mentions du haut et du bas : sans le
  // voile, elles se posaient directement sur les gradins et ne se lisaient plus.
  const pastille = 'inline-block max-w-full truncate rounded-full bg-[rgba(8,11,22,0.72)] px-3 py-1 md:px-4 md:py-1.5';

  return (
    <div
      className={`w-full h-full absolute inset-0 ${sortant ? 'pointer-events-none' : 'pointer-events-auto'}`}
      style={sortant ? { opacity: cut.a } : undefined}
      onClick={sortant ? undefined : () => {
        if (skipArm > 0) SprinterApp.nextCut();
        else SprinterApp.G.skipArm = 1.6;
      }}
    >
      {carte > 0 && (
        <div
          className="absolute z-10 overflow-hidden rounded-2xl border border-white/10 bg-[rgba(9,12,24,0.82)]
                     shadow-[0_18px_48px_rgba(0,0,0,0.38)]
                     pl-5 pr-4 py-3 sm:pl-6 sm:pr-5 sm:py-4 md:pl-8 md:pr-7 md:py-6
                     portrait:left-4 portrait:right-4 portrait:bottom-[calc(max(env(safe-area-inset-bottom),1.25rem)+2.5rem)]
                     landscape:left-[45vw] landscape:top-[12vh] landscape:w-[min(46vw,38rem)]"
          style={{ opacity: carte, transform: `translateY(${((1 - glisse) * 14).toFixed(1)}px)` }}
        >
          {/* Le filet de couleur, a gauche : bleu pour un adversaire, or au sacre. */}
          <div className="absolute left-0 top-0 bottom-0 w-1 md:w-1.5" style={{ backgroundColor: accent }} />

          <div className="text-[10px] sm:text-xs md:text-sm font-bold tracking-widest uppercase mb-1 md:mb-2" style={{ color: accent }}>
            {champ ? N.t('crowned') : intro ? N.t('rival') : N.t('after_race')}
          </div>
          <h2 className={`text-3xl sm:text-4xl md:text-5xl font-black font-display tracking-tight uppercase leading-[0.95] ${champ ? 'text-primary' : 'text-foreground'}`}>
            {champ ? N.t('fastest_1') : cut.name}
          </h2>
          <div className="h-1 w-11/12 mt-2 md:mt-3" style={{ backgroundColor: accent }} />

          {champ && (
            <div className="mt-2 md:mt-4">
              <div className="text-lg sm:text-xl md:text-2xl font-medium text-foreground/90">{N.t('fastest_2')}</div>
              <div className="text-sm sm:text-base md:text-lg font-bold text-primary mt-1 md:mt-2">
                {N.t('full_run_in')} {SprinterApp.G.runTime.toFixed(2)} s
              </div>
            </div>
          )}
          {!champ && intro && (
            <div className="mt-2 md:mt-4 text-sm sm:text-base md:text-lg font-bold text-primary">
              {N.t('announced')} {SprinterApp.G.championTime.toFixed(2)} s
            </div>
          )}

          {/* Les lignes du recit. Chacune ouvre sa place en douceur au moment
              ou elle arrive : la carte grandit avec le texte au lieu de sauter
              d'un cran, et elle ne montre jamais de vide en attente. */}
          <div className="flex flex-col">
            {cut.lines.map((line: string, i: number) => {
              const lt = ct - (1.3 + i * 2.6);
              const a = SprinterApp.clamp(lt / 0.45, 0, 1);
              return (
                <div
                  key={i}
                  className="grid transition-[grid-template-rows] duration-500 ease-out"
                  style={{ gridTemplateRows: lt > 0 ? '1fr' : '0fr' }}
                >
                  <div className="overflow-hidden">
                    <div
                      className={`${i === 0 ? 'pt-3 md:pt-5' : 'pt-1.5 md:pt-3'} text-xs sm:text-sm md:text-base font-medium text-foreground/90 leading-snug`}
                      style={{ opacity: a }}
                    >
                      {line}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top and Bottom hints */}
      <div className="absolute top-[max(env(safe-area-inset-top),1.25rem)] w-full text-center px-4 z-10">
        <span className={`${pastille} text-[10px] sm:text-xs md:text-sm font-bold tracking-widest uppercase ${champ ? 'text-primary' : 'text-foreground/75'}`}>
          {champ ? N.t('six_cleared') : `${N.t('stage_up')}${SprinterApp.G.levelIdx + 1}  —  ${N.levelName(SprinterApp.G.levelIdx)}`}
        </span>
      </div>

      <div className="absolute bottom-[max(env(safe-area-inset-bottom),1.25rem)] w-full text-center px-4 z-10"
           style={sortant ? { display: 'none' } : undefined}>
        <span className={`${pastille} text-[10px] sm:text-xs md:text-base font-bold tracking-widest ${skipArm > 0 ? 'text-primary animate-pulse' : 'text-foreground/70'}`}>
          {skipArm > 0 ? N.t('skip_now') : N.t('skip_twice')}
        </span>
      </div>

    </div>
  );
}
