import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { SprinterApp, useGameStore, dernierAppui } from '@/game/engine';

/**
 * LE GESTE S'APPREND DANS LA COURSE (game/premiers-pas.ts).
 *
 * Au tout premier lancement, le joueur ne passe plus par le tutoriel : il
 * court l'etape 1 de la carriere, et ce panneau lui dit, a l'instant ou il en
 * a besoin, la seule chose a faire. Rien d'autre ne parle :
 *
 *   AVANT LE PISTOLET  attendre — un faux depart, en carriere, gele le coureur
 *                      au coup de feu (engine.ts, padPress).
 *   AU DEPART          le pave a toucher maintenant s'allume, GAUCHE puis
 *                      DROITE : on apprend l'alternance en la faisant.
 *   DEUX FOIS DU MEME  « ALTERNE ! » — c'est la faute qui fait trebucher.
 *   UNE FOIS LANCE     « PLUS VITE ! », une fois, puis le panneau se tait.
 *
 * Il ne vit que pendant la premiere course (`G.premiereCourse`, efface a
 * l'arrivee par engine.ts) et ne prend aucun toucher : les paves sont dessous.
 */

/** Combien d'alternances justes avant de laisser le joueur seul. */
const ALTERNANCES_POUR_LACHER = 10;
/** Combien de temps reste affiche le rappel d'une faute, en ms. */
const FAUTE_MS = 900;

export function CoachPremiereCourse() {
  const etat = useGameStore(s => s.state);
  const { N, G } = SprinterApp;
  const [, setTic] = useState(0);
  const vu = useRef({ a: 0, cote: null as 'left' | 'right' | null, justes: 0, fauteA: 0, viteA: 0, fini: false });

  const actif = !!G.premiereCourse && (etat === 'count' || etat === 'race');

  useEffect(() => {
    if (!actif) return;
    // Dix lectures par seconde suffisent : le panneau suit une cadence de
    // huit a dix appuis, il n'a pas a tenir la frequence de l'image.
    const id = setInterval(() => {
      const d = dernierAppui();
      const v = vu.current;
      if (d.a !== v.a && etat === 'race') {
        if (v.cote && d.cote === v.cote) { v.fauteA = performance.now(); v.justes = 0; }
        else if (v.cote) v.justes++;
        v.cote = d.cote; v.a = d.a;
        if (!v.fini && v.justes >= ALTERNANCES_POUR_LACHER) { v.fini = true; v.viteA = performance.now(); }
      }
      setTic(t => t + 1);
    }, 100);
    return () => clearInterval(id);
  }, [actif, etat]);

  if (!actif || G.paused) return null;
  const v = vu.current;
  const maintenant = performance.now();
  const faute = maintenant - v.fauteA < FAUTE_MS;
  const vite = v.fini && maintenant - v.viteA < 1500;
  if (etat === 'race' && v.fini && !vite && !faute) return null;

  // Le pave attendu : l'autre que le dernier, et la gauche pour commencer.
  const attendu: 'left' | 'right' = v.cote === 'left' ? 'right' : 'left';

  return (
    <div className="absolute inset-0 z-[45] pointer-events-none select-none" aria-live="polite">
      <AnimatePresence mode="wait">
        {etat === 'count' && (
          <motion.div key="attends" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute inset-x-0 top-[38%] flex flex-col items-center gap-2 px-6 text-center">
            <span className="font-black font-display tracking-widest uppercase text-2xl md:text-4xl text-primary drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">
              {N.t('coach_attends')}
            </span>
            <span className="font-bold text-sm md:text-lg text-white/90 drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
              {N.t('coach_alterne')}
            </span>
          </motion.div>
        )}
        {etat === 'race' && (faute || vite) && (
          <motion.div key={faute ? 'faute' : 'vite'} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
            className={`absolute inset-x-0 top-[34%] text-center font-black font-display tracking-widest uppercase text-3xl md:text-5xl
                        drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] ${faute ? 'text-red-400' : 'text-primary'}`}>
            {N.t(faute ? 'coach_faute' : 'coach_vite')}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Au-dessus du pave a toucher : son nom, qui bat. Les paves occupent le
          bas de l'ecran (TouchControls.tsx), un cinquieme de sa hauteur. */}
      {etat === 'race' && !v.fini && (
        <div className={`absolute ${attendu === 'left' ? 'left-0' : 'right-0'} w-1/2 flex justify-center
                         bottom-[calc(min(max(20vh,70px),250px)+12px)] landscape:bottom-[calc(min(max(17vh,70px),250px)+12px)]`}>
          <motion.span key={`${attendu}-${v.a}`} initial={{ scale: 1.35, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.18 }}
            className="font-black font-display tracking-widest uppercase text-2xl md:text-3xl text-primary drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
            {attendu === 'left' ? `◀ ${N.t('coach_gauche')}` : `${N.t('coach_droite')} ▶`}
          </motion.span>
        </div>
      )}
    </div>
  );
}
