import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Mic, MicOff } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import type { Presentation } from '@/game/live';
import type { EtatVoix } from '@/game/voix';

/**
 * La presentation des participants, avant le depart.
 *
 * Le principe est celui des meetings : chaque athlete passe seul, son nom
 * s'affiche, il a quelques secondes, puis on passe au suivant. Ce qui fait
 * tenir la chose, c'est que les deux ecrans montrent le meme athlete au meme
 * instant — d'ou le fait que la salle annonce une date de debut plutot qu'un
 * signal, exactement comme pour le coup de pistolet. Chaque client compte
 * ensuite tout seul, ce qui evite d'echanger un message par participant.
 */

/** La palette des maillots du jeu, pour que la silhouette soit la bonne. */
const MAILLOTS = [
  [64, 178, 235], [72, 214, 132], [236, 92, 88],
  [176, 108, 235], [46, 206, 190], [246, 166, 52], [226, 96, 168],
];
const rgb = (c: number[], a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/** Une silhouette de sprinter, en position de depart lance. */
function Silhouette({ couleur }: { couleur: number[] }) {
  return (
    <svg viewBox="0 0 120 200" className="w-full h-full" aria-hidden="true">
      <defs>
        <linearGradient id="lueur" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={rgb(couleur, 0.95)} />
          <stop offset="100%" stopColor={rgb(couleur, 0.35)} />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="192" rx="34" ry="6" fill={rgb(couleur, 0.18)} />
      <g fill="url(#lueur)">
        <circle cx="62" cy="26" r="14" />
        <path d="M50 42 L74 42 L79 96 L45 96 Z" />
        <path d="M50 44 L30 74 L22 68 L42 36 Z" />
        <path d="M74 44 L96 70 L88 78 L68 52 Z" />
        <path d="M47 96 L57 96 L54 150 L40 176 L30 170 L42 146 Z" />
        <path d="M67 96 L79 96 L84 148 L92 178 L80 182 L70 150 Z" />
      </g>
      <g fill={rgb([250, 250, 255], 0.9)}>
        <ellipse cx="28" cy="172" rx="9" ry="5" />
        <ellipse cx="86" cy="182" rx="9" ry="5" />
      </g>
    </svg>
  );
}

type Props = {
  presentation: Presentation;
  /** Mon identifiant dans la salle, pour savoir quand c'est mon tour. */
  moi: string;
  voix: EtatVoix;
  /** Appele au changement de participant : l'appelant ouvre le micro. */
  onTour: (index: number, estMoi: boolean) => void;
  /** Appele une fois quand tout le monde est passe. */
  onFini: () => void;
};

export function PresentationDirect({ presentation, moi, voix, onTour, onFini }: Props) {
  const { N } = SprinterApp;
  const { par, micro, ordre } = presentation;

  // On fige l'instant de depart une seule fois : recalculer a chaque rendu
  // ferait deriver la sequence.
  const debut = useRef(Date.now() + presentation.dansMs);
  const [index, setIndex] = useState(-1);
  const [dansMicro, setDansMicro] = useState(false);
  const [avant, setAvant] = useState(Math.max(0, presentation.dansMs));
  const dernier = useRef(-2);
  const finiPose = useRef(false);

  useEffect(() => {
    const battre = () => {
      const ecoule = Date.now() - debut.current;
      if (ecoule < 0) { setAvant(-ecoule); setIndex(-1); return; }
      const i = Math.floor(ecoule / par);
      if (i >= ordre.length) {
        setIndex(ordre.length);
        setDansMicro(false);
        if (!finiPose.current) { finiPose.current = true; onFini(); }
        return;
      }
      setIndex(i);
      setDansMicro(ecoule - i * par < micro);
      if (i !== dernier.current) {
        dernier.current = i;
        onTour(i, ordre[i]?.id === moi);
      }
    };
    battre();
    const t = setInterval(battre, 100);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [par, micro, ordre.length, moi]);

  const courant = index >= 0 && index < ordre.length ? ordre[index] : null;
  const estMoi = !!courant && courant.id === moi;
  const couleur = MAILLOTS[((courant?.couloir || 1) - 1) % MAILLOTS.length];

  // Le micro n'est allume a l'ecran que quand il l'est vraiment : si la
  // permission a ete refusee, on montre qu'il est coupe plutot que de mentir.
  const microActif = estMoi && dansMicro && voix.ouvert;
  const microRefuse = estMoi && dansMicro && voix.refuse;

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center
                    bg-gradient-to-b from-black/92 via-black/88 to-black/95 backdrop-blur-sm px-6">

      <p className="text-[10px] tracking-[0.4em] text-emerald-400/80 font-bold mb-8 uppercase">
        {N.t('pres_title')}
      </p>

      {/* Avant le premier participant : un simple decompte. */}
      {index < 0 && (
        <motion.div key="avant" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="font-display font-black text-6xl text-white/80 tabular-nums">
          {Math.ceil(avant / 1000)}
        </motion.div>
      )}

      {courant && (
        <AnimatePresence mode="wait">
          <motion.div
            key={courant.id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.45, ease: [0.22, 0.8, 0.3, 1] }}
            className="flex flex-col items-center gap-3 w-full max-w-md"
          >
            {/* Le pseudo au-dessus de l'asset, comme demande. */}
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-xs tracking-widest text-white/45">
                {N.t('pres_lane')} {courant.couloir}
              </span>
              {estMoi && (
                <span className="font-mono text-[10px] tracking-widest text-emerald-400">
                  {N.t('pres_you')}
                </span>
              )}
            </div>
            <h2 className="font-display font-black tracking-tight text-white text-center leading-none
                           text-4xl md:text-6xl break-words max-w-full">
              {courant.nom}
            </h2>

            <div className="h-44 md:h-56 w-32 md:w-40 mt-1">
              <Silhouette couleur={couleur} />
            </div>

            {/* Le voyant micro : present uniquement pendant sa propre fenetre. */}
            <div className="h-8 flex items-center">
              {microActif && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full
                             bg-red-500/15 border border-red-400/40"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-70" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                  </span>
                  <Mic className="w-3.5 h-3.5 text-red-300" />
                  <span className="font-mono text-[10px] tracking-widest text-red-300">
                    {N.t('pres_mic_on')}
                  </span>
                </motion.div>
              )}
              {microRefuse && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full
                                bg-white/5 border border-white/15">
                  <MicOff className="w-3.5 h-3.5 text-white/40" />
                  <span className="font-mono text-[10px] tracking-widest text-white/40">
                    {N.t('pres_mic_off')}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Ou l'on en est dans la sequence. */}
      <div className="flex gap-1.5 mt-10">
        {ordre.map((o, i) => (
          <span key={o.id}
                className={`h-1 rounded-full transition-all duration-300
                  ${i === index ? 'w-8 bg-emerald-400' : i < index ? 'w-4 bg-white/35' : 'w-4 bg-white/12'}`} />
        ))}
      </div>
    </div>
  );
}
