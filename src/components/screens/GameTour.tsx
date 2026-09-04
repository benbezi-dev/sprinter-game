import React, { useEffect, useRef, useState } from 'react';
import { SprinterApp } from '@/game/engine';
import { motion } from 'motion/react';
import { MONTEE, COURBE, TRANSITION } from '@/lib/mouvement';
import { X, ChevronLeft, ChevronRight, Trophy, Ghost, Radio, Users, Flag } from 'lucide-react';

const VU = 'sprinter_tour_vu';

/**
 * La visite vient de se terminer.
 *
 * La fenetre de bienvenue attend ce moment-la : elle demande le nom, le pays
 * et Instagram, et deux panneaux empiles au tout premier lancement ne se
 * lisent ni l'un ni l'autre. Le marqueur seul ne suffit pas a la prevenir —
 * il vit dans localStorage, que rien ne surveille, et fermer la visite ne
 * fait pas bouger l'etat du jeu d'un pouce.
 */
export const TOUR_VU = 'sprinter:tour-vu';

export function tourVu(): boolean {
  try { return localStorage.getItem(VU) === '1'; } catch { return true; }
}
export function marquerTourVu() {
  try { localStorage.setItem(VU, '1'); } catch { /* sans memoire, il reviendra */ }
  try { window.dispatchEvent(new Event(TOUR_VU)); } catch { /* hors navigateur */ }
}

/**
 * La visite du jeu.
 *
 * Le tutoriel de course apprend le geste ; celui du one shot explique un mode.
 * Il manquait la vue d'ensemble : ce qu'on peut faire ici, et pourquoi on y
 * reviendrait. Un joueur qui n'a vu que l'accueil ne sait pas qu'il existe un
 * classement mondial, ni qu'on peut envoyer sa course a un ami.
 *
 * Cinq plans, joues seuls, chacun anime plutot que decrit — un texte qui
 * enumere des modes ne se lit pas, une piste qui bouge se regarde. On peut
 * revenir en arriere : c'est une visite, pas un couloir.
 */

type Plan = {
  titre: string; sous: string;
  Icone: typeof Trophy;
  couleur: string;
  scene: React.ReactNode;
};

const DUREE = 3400;

export function GameTour({ onClose }: { onClose: (jouer: boolean) => void }) {
  const { N } = SprinterApp;
  const [i, setI] = useState(0);
  const minuteur = useRef<any>(null);
  const [auto, setAuto] = useState(true);

  const plans: Plan[] = [
    {
      titre: 'tour_1_t', sous: 'tour_1_s', Icone: Flag, couleur: 'text-primary',
      scene: <Foulee />,
    },
    {
      titre: 'tour_2_t', sous: 'tour_2_s', Icone: Trophy, couleur: 'text-primary',
      scene: <Etapes />,
    },
    {
      titre: 'tour_3_t', sous: 'tour_3_s', Icone: Trophy, couleur: 'text-primary',
      scene: <Classement />,
    },
    {
      titre: 'tour_4_t', sous: 'tour_4_s', Icone: Ghost, couleur: 'text-cyan-300',
      scene: <Fantome />,
    },
    {
      titre: 'tour_5_t', sous: 'tour_5_s', Icone: Radio, couleur: 'text-emerald-400',
      scene: <Direct />,
    },
  ];

  useEffect(() => {
    clearTimeout(minuteur.current);
    if (!auto) return;
    if (i < plans.length - 1) {
      minuteur.current = setTimeout(() => setI(n => n + 1), DUREE);
    }
    return () => clearTimeout(minuteur.current);
  }, [i, auto, plans.length]);

  const aller = (n: number) => {
    setAuto(false);
    setI(Math.max(0, Math.min(plans.length - 1, n)));
  };

  const p = plans[i];
  const dernier = i === plans.length - 1;

  return (
    <div className="fixed inset-0 z-[59] bg-[#060913] flex flex-col pointer-events-auto
                    px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]
                    pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)]">

      <div className="w-full max-w-lg mx-auto flex items-center gap-3 shrink-0">
        <div className="flex-1 flex gap-1.5">
          {plans.map((_, k) => (
            <button key={k} onClick={() => aller(k)} className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
              <motion.div className="h-full bg-primary" initial={false}
                animate={{ width: k < i ? '100%' : k === i ? '100%' : '0%' }}
                transition={k === i && auto ? { duration: DUREE / 1000, ease: COURBE.lineaire }
                                            : TRANSITION.progression} />
            </button>
          ))}
        </div>
        <button onClick={() => onClose(false)}
                className="shrink-0 p-2 rounded-xl bg-card/80 border border-white/10 hover:bg-white/10 transition-colors">
          <X className="w-4 h-4 opacity-70" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg mx-auto gap-5 min-h-0">
        <motion.div key={`t${i}`} {...MONTEE}
                    className="flex flex-col items-center gap-1.5 text-center">
          <p.Icone className={`w-6 h-6 ${p.couleur}`} />
          <h2 className={`text-2xl sm:text-3xl md:text-4xl font-black font-display tracking-tight uppercase ${p.couleur}`}>
            {N.t(p.titre)}
          </h2>
          <p className="text-xs md:text-sm text-foreground/70 max-w-xs">{N.t(p.sous)}</p>
        </motion.div>

        <div key={`s${i}`} className="w-full flex items-center justify-center min-h-[130px]">
          {p.scene}
        </div>
      </div>

      <div className="w-full max-w-lg mx-auto shrink-0 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => aller(i - 1)} disabled={i === 0}
                  className="p-3 rounded-xl bg-white/5 border border-white/10 disabled:opacity-30 hover:bg-white/10 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => (dernier ? onClose(true) : aller(i + 1))}
            className="flex-1 py-4 rounded-xl font-black font-display text-lg md:text-xl tracking-widest
                       text-background bg-primary hover:bg-primary/90 transition-all
                       border-b-4 border-amber-600 active:border-b-0 active:translate-y-1"
          >
            {N.t(dernier ? 'tour_play' : 'tuto_next')}
          </button>
          <button onClick={() => aller(i + 1)} disabled={dernier}
                  className="p-3 rounded-xl bg-white/5 border border-white/10 disabled:opacity-30 hover:bg-white/10 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <button onClick={() => onClose(false)}
                className="w-full py-1.5 text-[10px] tracking-widest text-muted-foreground hover:text-foreground transition-colors">
          {N.t('tuto_skip')}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ scenes */

/** Deux pads qui battent en alternance : le geste, en une seconde. */
function Foulee() {
  const [cote, setCote] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setCote(c => 1 - c), 320);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
      {[0, 1].map(k => (
        <div key={k}
             className={`h-20 rounded-2xl border-2 flex items-center justify-center transition-colors duration-100
               ${cote === k ? 'border-primary bg-primary/25' : 'border-white/15 bg-white/[0.05]'}`}>
          {k === 0
            ? <ChevronLeft className={`w-7 h-7 ${cote === 0 ? 'text-primary' : 'text-foreground/40'}`} />
            : <ChevronRight className={`w-7 h-7 ${cote === 1 ? 'text-primary' : 'text-foreground/40'}`} />}
        </div>
      ))}
    </div>
  );
}

/** Six etapes qui se remplissent, du scolaire a l'intergalactique. */
function Etapes() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN(v => (v >= 6 ? 0 : v + 1)), 380);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="flex flex-col items-center gap-2 w-full max-w-xs">
      <div className="flex gap-1.5 w-full">
        {Array.from({ length: 6 }).map((_, k) => (
          <div key={k} className={`flex-1 h-8 rounded-lg border transition-colors duration-200
            ${k < n ? 'bg-primary/30 border-primary' : 'bg-black/30 border-white/10'}`} />
        ))}
      </div>
      <span className="font-mono text-[10px] text-muted-foreground">{n} / 6</span>
    </div>
  );
}

/** Un tableau ou l'on remonte : la place change sous les yeux. */
function Classement() {
  const [rang, setRang] = useState(4);
  useEffect(() => {
    const id = setInterval(() => setRang(r => (r <= 1 ? 4 : r - 1)), 700);
    return () => clearInterval(id);
  }, []);
  const lignes = [1, 2, 3, 4];
  return (
    <div className="flex flex-col gap-1 w-full max-w-xs">
      {lignes.map(k => {
        const moi = k === rang;
        return (
          <motion.div key={k} layout
            className={`flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs
              ${moi ? 'bg-primary/20 border-primary/50 text-primary font-bold'
                    : 'bg-black/25 border-white/5 text-muted-foreground'}`}>
            <span>{k}.</span>
            <span className="truncate">{moi ? 'TOI' : '—'}</span>
            <span className="font-mono">{(9.4 + k * 0.12).toFixed(2)} s</span>
          </motion.div>
        );
      })}
    </div>
  );
}

/** Un fantome translucide que l'on rattrape. */
function Fantome() {
  const [x, setX] = useState(0);
  useEffect(() => {
    let id = 0;
    const t0 = performance.now();
    const pas = () => {
      const q = ((performance.now() - t0) / 2600) % 1;
      setX(q);
      id = requestAnimationFrame(pas);
    };
    id = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className="w-full max-w-xs flex flex-col gap-3">
      <Couloir p={Math.min(1, x * 1.15)} couleur="bg-primary" etiquette="TOI" />
      <Couloir p={x} couleur="bg-cyan-400/50" etiquette="FANTÔME" />
    </div>
  );
}

/** Deux couloirs qui partent au meme instant. */
function Direct() {
  const [x, setX] = useState(0);
  useEffect(() => {
    let id = 0;
    const t0 = performance.now();
    const pas = () => {
      setX(((performance.now() - t0) / 2400) % 1);
      id = requestAnimationFrame(pas);
    };
    id = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className="w-full max-w-xs flex flex-col gap-3">
      <Couloir p={x} couleur="bg-primary" etiquette="TOI" />
      <Couloir p={Math.min(1, x * 0.93)} couleur="bg-emerald-400" etiquette="EN DIRECT" />
    </div>
  );
}

function Couloir({ p, couleur, etiquette }: { p: number; couleur: string; etiquette: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] tracking-widest text-muted-foreground">{etiquette}</span>
      <div className="relative h-3 rounded-full bg-black/50 border border-white/10">
        <div className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ${couleur}`}
             style={{ left: `calc(${Math.min(100, p * 100)}% - 5px)` }} />
      </div>
    </div>
  );
}
