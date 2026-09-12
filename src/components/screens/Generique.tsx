import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SprinterApp, useGameStore } from '@/game/engine';
import {
  arreterLeGenerique, dureeDuGenerique, jouerLeGenerique,
} from '@/game/generique';

/**
 * LE GENERIQUE DE FIN DE CARRIERE — le texte, par-dessus la scene.
 *
 * Ce qu'on voit derriere est dessine au canvas (game/scene-generique.ts) ; la
 * musique est tenue par game/generique.ts. Ici il n'y a que ce qui se lit : le
 * titre, le parcours des six etapes avec leurs chronos, puis le defile.
 *
 * C'EST CET ECRAN QUI TERMINE LA SCENE, ET C'EST DELIBERE. Les autres
 * cinematiques durent quinze secondes decidees par la boucle de jeu ; celle-ci
 * dure un morceau, et la seule chose qui sache quand le morceau finit, c'est
 * le morceau. `jouerLeGenerique` rappelle a la derniere note — ou au bout d'un
 * repli si le fichier n'est jamais arrive — et on rend alors la main au
 * tableau des chronos, comme le faisait le sacre avant.
 *
 * Le montage et le demontage portent donc la musique : monte, elle part ;
 * demonte — la scene passee, le jeu quitte, l'onglet ferme — elle s'arrete.
 * Rien d'autre n'a besoin de la connaitre.
 */

/** Quand le defile s'ebranle, en secondes depuis le debut de la scene. */
const DEBUT_DEFILE = 9;

/** Duree du defile quand le morceau ne dit pas la sienne, en secondes. */
const DEFILE_PAR_DEFAUT = 30;

export function Generique() {
  const { cut, skipArm } = useGameStore();
  const { N } = SprinterApp;
  const rouleau = useRef<HTMLDivElement>(null);
  const [hauteur, setHauteur] = useState(0);

  // La musique vit le temps de la scene, et c'est tout ce qui la tient.
  useEffect(() => {
    jouerLeGenerique(() => SprinterApp.nextCut());
    return () => arreterLeGenerique();
  }, []);

  // La hauteur du defile se mesure, elle ne s'estime pas : elle depend de la
  // langue, du nombre de lignes et de la largeur de l'ecran. C'est elle qui
  // donne la vitesse — sans quoi le texte finirait bien avant la musique, ou
  // resterait a mi-course a la derniere note.
  useLayoutEffect(() => {
    const el = rouleau.current;
    if (!el) return;
    const mesurer = () => setHauteur(el.scrollHeight);
    mesurer();
    const obs = new ResizeObserver(mesurer);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (!cut) return null;

  const ct: number = cut.t;
  const lignes: string[] = cut.lines || [];
  const splits: number[] = SprinterApp.G.runSplits || [];
  const total: number = SprinterApp.G.runTime || 0;

  const totale = dureeDuGenerique();
  const finDefile = totale > 0 ? Math.max(DEBUT_DEFILE + 12, totale - 5)
                               : DEBUT_DEFILE + DEFILE_PAR_DEFAUT;
  const avance = SprinterApp.clamp(
    (ct - DEBUT_DEFILE) / (finDefile - DEBUT_DEFILE), 0, 1);
  // Le rouleau part sous l'ecran et sort par le haut.
  const decalage = hauteur ? -avance * (hauteur + window.innerHeight) : 0;

  const titreVisible = SprinterApp.clamp((ct - 0.8) / 1.2, 0, 1) *
                       (1 - SprinterApp.clamp((ct - 7.2) / 1.6, 0, 1));
  // « FIN » : les dernieres secondes, quand le rouleau est sorti.
  const finVisible = avance > 0.985 ? 1 : 0;

  return (
    <div
      className="w-full h-full absolute inset-0 pointer-events-auto overflow-hidden"
      onClick={() => {
        if (skipArm > 0) SprinterApp.nextCut();
        else SprinterApp.G.skipArm = 1.6;
      }}
    >
      {/* Le titre, au centre, le temps que le stade s'eteigne. */}
      <div
        className="absolute inset-x-0 top-[26%] flex flex-col items-center text-center px-6 z-10"
        style={{ opacity: titreVisible }}
      >
        <div className="text-[10px] sm:text-xs md:text-sm font-bold tracking-[0.35em] uppercase text-primary/80">
          {N.t('ending_over')}
        </div>
        <h2 className="mt-2 text-3xl sm:text-5xl md:text-6xl font-black font-display tracking-tighter uppercase text-primary drop-shadow-[0_0_30px_rgba(248,205,74,0.45)]">
          {N.t('ending_title')}
        </h2>
        <div className="mt-3 h-1 w-40 md:w-64 bg-primary/80" />
        <div className="mt-3 text-sm md:text-lg font-bold text-foreground/90">
          {N.t('full_run_in')}
          <span className="text-primary ml-1">{total.toFixed(2)} s</span>
        </div>
      </div>

      {/* Le defile. */}
      <div
        ref={rouleau}
        className="absolute left-1/2 top-full w-[min(34rem,calc(100vw-2.5rem))] flex flex-col items-center text-center gap-8 md:gap-10 z-10 will-change-transform"
        // Le centrage horizontal tient dans ce meme transform, et non dans une
        // classe : Tailwind v4 pose ses utilitaires de translation sur la
        // propriete `translate`, qui se cumule avec `transform` au lieu de la
        // remplacer — les deux moities s'additionnaient et le rouleau sortait
        // de l'ecran par la gauche.
        style={{
          transform: `translate(-50%, ${decalage}px)`,
          // Le texte passe devant un stade eclaire et un coureur en mouvement :
          // sans ombre portee, une ligne sur deux devient illisible au moment ou
          // le tour d'honneur la traverse. Une ombre plutot qu'un panneau — on
          // veut lire le generique ET voir la scene.
          filter: 'drop-shadow(0 2px 7px rgba(0,0,0,0.95))',
        }}
      >
        {/* Le parcours, etape par etape. */}
        <div className="w-full flex flex-col gap-2">
          <div className="text-[10px] md:text-xs font-bold tracking-[0.3em] uppercase text-primary/80 mb-1">
            {N.t('ending_run')}
          </div>
          {splits.map((split, i) => (
            <div
              key={i}
              className="flex items-baseline justify-between gap-3 border-b border-white/10 pb-1.5"
            >
              <span className="text-[10px] md:text-xs font-bold tracking-widest text-muted-foreground shrink-0">
                {N.t('stage_low')} {i + 1}
              </span>
              <span className="text-sm md:text-base font-bold text-foreground/90 truncate">
                {N.levelName(i)}
              </span>
              <span className="font-mono text-sm md:text-base font-bold text-primary shrink-0">
                {split.toFixed(2)} s
              </span>
            </div>
          ))}
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-xs md:text-sm font-black tracking-widest uppercase text-foreground">
              {N.t('ending_total')}
            </span>
            <span className="font-mono text-lg md:text-xl font-black text-primary">
              {total.toFixed(2)} s
            </span>
          </div>
        </div>

        {/* Les lignes du generique. */}
        <div className="w-full flex flex-col gap-5 md:gap-6">
          {lignes.map((ligne, i) => (
            <p
              key={i}
              className="text-sm md:text-lg font-medium text-foreground/90 leading-snug drop-shadow-md"
            >
              {ligne}
            </p>
          ))}
        </div>

        <div className="w-full flex flex-col items-center gap-2 pb-[30vh]">
          <div className="h-px w-24 bg-white/20" />
          <div className="text-xs md:text-sm font-bold tracking-widest uppercase text-foreground/80">
            {N.t('ending_thanks')}
          </div>
          <div className="text-[10px] md:text-xs tracking-widest uppercase text-muted-foreground">
            {N.t('ending_music')}
          </div>
        </div>
      </div>

      {/* FIN. */}
      <div
        className="absolute inset-0 flex items-center justify-center z-10 transition-opacity duration-1000"
        style={{ opacity: finVisible }}
      >
        <span className="text-4xl md:text-6xl font-black font-display tracking-[0.3em] uppercase text-primary">
          {N.t('ending_end')}
        </span>
      </div>

      {/* Le rappel du passage s'efface une fois le defile lance : il a dit ce
          qu'il avait a dire, et il coupait une ligne sur deux pour le reste du
          morceau. Une touche le rappelle — c'est `skipArm` qui remonte. */}
      <div
        className="absolute bottom-[max(env(safe-area-inset-bottom),1.5rem)] w-full text-center z-10 transition-opacity duration-700"
        style={{ opacity: skipArm > 0 ? 1 : SprinterApp.clamp((13 - ct) / 2, 0, 1) }}
      >
        <span
          className={`text-[10px] sm:text-xs md:text-base font-bold tracking-widest ${
            skipArm > 0 ? 'text-primary animate-pulse' : 'text-muted-foreground'
          }`}
        >
          {skipArm > 0 ? N.t('skip_now') : N.t('skip_twice')}
        </span>
      </div>
    </div>
  );
}
