import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { RESSORT } from '@/lib/mouvement';
import { ChevronUp, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import {
  MONDES, PLACE, allerAu, useMonde, type Monde, type Direction,
} from '@/game/mondes';
import { useGesteMondes } from '@/hooks/use-geste-mondes';
import { HAIES } from '@/game/haies.js';

/**
 * Les trois autres jeux, et le passage de l'un a l'autre.
 *
 * Chacun a son accueil : son nom, ses epreuves, et le chemin du retour. Les
 * epreuves y figurent toutes, meme celles qui ne se jouent pas encore —
 * annoncer ce que le jeu deviendra vaut mieux que de le cacher, a condition de
 * le dire clairement plutot que de laisser appuyer sur un bouton mort.
 */

/** D'ou entre le panneau, selon la direction prise. */
const ENTREE: Record<Direction, { x?: string; y?: string }> = {
  bas: { y: '100%' },
  droite: { x: '100%' },
  gauche: { x: '-100%' },
};

const FLECHE: Record<Direction, typeof ChevronUp> = {
  bas: ChevronUp, droite: ChevronLeft, gauche: ChevronRight,
};

/**
 * « 10 haies · 1,067 m · 9,14 m » — le reglement en une ligne.
 *
 * La mise en forme vit ici, dans l'ecran, et non dans la table des jeux : un
 * calcul fait au chargement d'un module n'est pas elaguable, et tout le
 * reglement des haies partait dans le build public ou rien ne l'affiche.
 */
function cotesDe(cle: string): string {
  const r = (HAIES as any)[cle];
  if (!r) return '';
  const nb = (v: number) => String(v).replace('.', ',');
  return `${r.haies.nombre} haies · ${nb(r.haies.hauteur)} m · ${nb(r.haies.ecart)} m`;
}

export function Mondes() {
  const monde = useMonde();
  if (monde === 'sprinter') return null;
  return <AccueilMonde monde={monde} />;
}

function AccueilMonde({ monde }: { monde: Exclude<Monde, 'sprinter'> }) {
  const { N } = SprinterApp;
  const d = MONDES[monde];
  const direction = PLACE[monde];
  const Fleche = FLECHE[direction];
  const rouleau = useRef<HTMLDivElement>(null);

  // On revient par la direction opposee : le chemin doit etre le meme dans les
  // deux sens, sans quoi on se retrouve quelque part sans savoir en sortir.
  const inverse: Direction = direction === 'bas' ? 'bas'
    : direction === 'droite' ? 'gauche' : 'droite';
  useGesteMondes(rouleau, (g) => {
    if (direction === 'bas' ? g === 'bas' : g === inverse) allerAu('sprinter');
  });

  // La touche « retour » du telephone ramene a Sprinter plutot que de sortir
  // du jeu : on est entre par un geste, on doit pouvoir sortir par le geste
  // que le systeme propose.
  useEffect(() => {
    const sortir = () => allerAu('sprinter');
    window.addEventListener('popstate', sortir);
    return () => window.removeEventListener('popstate', sortir);
  }, []);

  return (
    <AnimatePresence>
      <motion.div
        key={monde}
        initial={{ opacity: 0, ...ENTREE[direction] }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={{ opacity: 0, ...ENTREE[direction] }}
        transition={RESSORT.glissement}
        className="fixed inset-0 z-[45] pointer-events-auto overflow-hidden"
        style={{ background: d.fond }}
      >
        <div
          ref={rouleau}
          className="w-full h-full overflow-y-auto flex flex-col
                     px-[max(env(safe-area-inset-left),1.25rem)]
                     pr-[max(env(safe-area-inset-right),1.25rem)]
                     pt-[max(env(safe-area-inset-top),2.5rem)]
                     pb-[max(env(safe-area-inset-bottom),1.5rem)]"
        >
          {/* Une lueur de la couleur du jeu : c'est elle qui distingue les
              quatre univers d'un coup d'oeil, avant meme de lire le nom. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-72 opacity-45"
               style={{ background: `radial-gradient(60% 100% at 50% 0%, ${d.accent}, transparent 70%)` }} />

          <div className="relative flex-1 flex flex-col items-center justify-center gap-6 max-w-md mx-auto w-full">
            <div className="text-center">
              <h1 className="font-display font-black tracking-tight text-5xl md:text-6xl"
                  style={{ color: d.accent }}>
                {d.nom}
              </h1>
              <p className="mt-2 text-[11px] md:text-sm text-white/55 tracking-wide uppercase">
                {N.t(d.sous)}
              </p>
            </div>

            <div className="w-full flex flex-col gap-2">
              {d.disciplines.map(e => (
                <div key={e.cle}
                     className={`w-full px-4 py-3.5 rounded-2xl border flex items-center gap-3
                       ${e.jouable ? 'border-white/20 bg-white/[0.06]'
                                   : 'border-white/8 bg-white/[0.02]'}`}>
                  <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="font-bold tracking-widest text-sm md:text-base"
                          style={{ color: e.jouable ? '#fff' : 'rgba(255,255,255,0.4)' }}>
                      {N.t(e.nom)}
                    </span>
                    {/* Les cotes du reglement, sous le nom. Elles disent le jeu
                        avant qu'il existe : dix haies a 9,14 m les unes des
                        autres, on voit deja la course. */}
                    {e.cotes && (
                      <span className="font-mono text-[9px] tracking-wide text-white/30">
                        {cotesDe(e.cle)}
                      </span>
                    )}
                  </span>
                  {!e.jouable && (
                    <span className="flex items-center gap-1.5 text-[9px] tracking-widest
                                     text-white/35 shrink-0">
                      <Lock className="w-3 h-3" />
                      {N.t('monde_bientot')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Le chemin du retour, ecrit. Un jeu ou l'on entre par un geste doit
              dire par quel geste on en sort — sinon le geste est un piege. */}
          <button
            onClick={() => allerAu('sprinter')}
            className="relative mx-auto mt-8 flex items-center gap-2 px-4 py-2 rounded-full
                       border border-white/15 bg-black/30 text-white/60
                       text-[10px] tracking-widest hover:text-white transition-colors"
          >
            <Fleche className="w-3.5 h-3.5" />
            {N.t('monde_retour')}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
