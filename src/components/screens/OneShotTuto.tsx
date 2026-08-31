import React, { useEffect, useRef, useState } from 'react';
import { SprinterApp } from '@/game/engine';
import { motion } from 'motion/react';
import { X, Timer, Ghost, Globe2 } from 'lucide-react';

const VU = 'sprinter_tuto_oneshot_vu';

export function oneShotTutoVu(): boolean {
  try { return localStorage.getItem(VU) === '1'; } catch { return true; }
}
export function marquerOneShotTutoVu() {
  try { localStorage.setItem(VU, '1'); } catch { /* sans memoire, il reviendra */ }
}

/**
 * Tutoriel du one shot.
 *
 * Le mode est peu utilise, et ce n'est pas une affaire de geste : les touches
 * y sont les memes qu'en carriere. Ce qui manque, c'est de savoir a quoi il
 * sert. On ne peut donc pas le faire pratiquer — on le montre, en trois plans
 * animes qui repondent chacun a une question : qu'est-ce que je choisis, ce
 * qui se passe si je rate, et ce que devient mon chrono.
 *
 * Les plans defilent seuls, et le dernier lance une course : le tutoriel se
 * termine dans le mode qu'il vient d'expliquer, pas sur un bouton « fermer ».
 */
export function OneShotTuto({ onClose }: { onClose: (lancer: boolean) => void }) {
  const { N } = SprinterApp;
  const [plan, setPlan] = useState(0);
  const timers = useRef<any[]>([]);

  useEffect(() => {
    timers.current.push(setTimeout(() => setPlan(1), 2600));
    timers.current.push(setTimeout(() => setPlan(2), 5200));
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const titres = ['os_tuto_1_t', 'os_tuto_2_t', 'os_tuto_3_t'];
  const sous = ['os_tuto_1_s', 'os_tuto_2_s', 'os_tuto_3_s'];

  return (
    <div className="fixed inset-0 z-[59] bg-[#060913] flex flex-col pointer-events-auto
                    px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]
                    pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)]">

      <div className="w-full max-w-lg mx-auto flex items-center gap-3 shrink-0">
        <div className="flex-1 flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
              <motion.div className="h-full bg-primary" initial={false}
                animate={{ width: i < plan ? '100%' : i === plan ? '100%' : '0%' }}
                transition={{ duration: i === plan ? 2.6 : 0.2, ease: 'linear' }} />
            </div>
          ))}
        </div>
        <button onClick={() => onClose(false)}
                className="shrink-0 p-2 rounded-xl bg-card/80 border border-white/10 hover:bg-white/10 transition-colors">
          <X className="w-4 h-4 opacity-70" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg mx-auto gap-5 min-h-0">

        <motion.div key={`t${plan}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22 }} className="flex flex-col items-center gap-1 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black font-display tracking-tight uppercase text-primary">
            {N.t(titres[plan])}
          </h2>
          <p className="text-xs md:text-sm text-foreground/70">{N.t(sous[plan])}</p>
        </motion.div>

        <div className="w-full flex items-center justify-center min-h-[140px]">

          {/* Plan 1 : les trois epreuves s'allument l'une apres l'autre. */}
          {plan === 0 && (
            <div className="flex gap-2 w-full max-w-xs">
              {['100', '200', '400'].map((k, i) => (
                <motion.div
                  key={k}
                  initial={{ opacity: 0.25, scale: 0.94 }}
                  animate={{ opacity: [0.25, 1, 1], scale: [0.94, 1, 1] }}
                  transition={{ duration: 0.5, delay: 0.3 + i * 0.55, times: [0, 0.5, 1] }}
                  className="flex-1 py-4 rounded-xl bg-primary/20 border-b-2 border-primary
                             text-primary font-bold tracking-wider text-center text-sm md:text-base"
                >
                  {k} M
                </motion.div>
              ))}
            </div>
          )}

          {/* Plan 2 : une seule ligne de chrono, qui se fige. Pas de reprise. */}
          {plan === 1 && (
            <div className="flex flex-col items-center gap-3">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-2 px-5 py-3 rounded-2xl border border-white/15 bg-black/30"
              >
                <Timer className="w-5 h-5 text-primary" />
                <Chrono />
              </motion.div>
              <motion.span
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
                className="text-[11px] md:text-sm font-bold tracking-wide text-destructive text-center max-w-xs leading-snug"
              >
                {N.t('os_once')}
              </motion.span>
            </div>
          )}

          {/* Plan 3 : le chrono part au classement, et devient un defi. */}
          {plan === 2 && (
            <div className="flex flex-col items-center gap-3 w-full max-w-xs">
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="w-full rounded-xl border border-primary/40 bg-primary/[0.08] px-4 py-3
                           flex items-center justify-between"
              >
                <span className="flex items-center gap-2 text-primary font-bold tracking-widest text-[11px]">
                  <Globe2 className="w-4 h-4" />{N.t('top500')}
                </span>
                <span className="font-mono font-black text-primary">9.62 s</span>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
                className="w-full rounded-xl border border-cyan-400/40 bg-cyan-400/[0.07] px-4 py-3
                           flex items-center gap-2"
              >
                <Ghost className="w-4 h-4 text-cyan-300" />
                <span className="text-cyan-300 font-bold tracking-widest text-[11px]">
                  {N.t('challenge_make')}
                </span>
              </motion.div>
            </div>
          )}
        </div>
      </div>

      <div className="w-full max-w-lg mx-auto shrink-0 flex flex-col gap-2">
        <button
          onClick={() => onClose(true)}
          className="w-full py-4 rounded-xl font-black font-display text-lg md:text-xl tracking-widest
                     text-background bg-primary hover:bg-primary/90 transition-all
                     border-b-4 border-amber-600 active:border-b-0 active:translate-y-1"
        >
          {N.t('os_tuto_go')}
        </button>
        <button onClick={() => onClose(false)}
                className="w-full py-2 text-[10px] tracking-widest text-muted-foreground hover:text-foreground transition-colors">
          {N.t('tuto_skip')}
        </button>
      </div>
    </div>
  );
}

/** Un chrono qui court puis se fige : la course a eu lieu, elle ne revient pas. */
function Chrono() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    let id = 0;
    const pas = () => {
      const dt = (performance.now() - t0) / 1000;
      if (dt >= 1.4) { setT(9.62); return; }
      setT(9.62 * (dt / 1.4));
      id = requestAnimationFrame(pas);
    };
    id = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <span className="font-mono font-black text-2xl md:text-3xl tabular-nums text-foreground">
      {t.toFixed(2)}<span className="text-sm font-normal"> s</span>
    </span>
  );
}
