import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Mic, MicOff } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import { usePresentationDirecte } from '@/game/presentation-directe';
import type { EtatVoix } from '@/game/voix';

/**
 * La presentation des participants, sur la piste.
 *
 * Le principe est celui des meetings : chaque athlete passe seul, la camera
 * vient sur lui, son nom s'affiche, il a quelques secondes au micro, puis on
 * passe au suivant. Ce qui fait tenir la chose, c'est que les deux ecrans
 * montrent le meme athlete au meme instant — d'ou le fait que la salle annonce
 * une date de debut plutot qu'un signal, exactement comme pour le coup de
 * pistolet. Chaque client compte ensuite tout seul, ce qui evite d'echanger un
 * message par participant.
 *
 * Elle se jouait avant sur un rideau noir, avec une silhouette dessinee a part.
 * Elle se joue maintenant PAR-DESSUS le jeu, qui montre les vrais athletes dans
 * leurs vrais couloirs. Cet ecran n'est donc plus une scene : c'est une bande
 * de television posee sur une image que le moteur produit deja.
 */

/* ------------------------------------------------------------- le voyant */

function Micro({ voix, estMoi, dans }: { voix: EtatVoix; estMoi: boolean; dans: boolean }) {
  const { N } = SprinterApp;
  if (!estMoi || !dans) return <span className="h-7" />;
  // Le micro n'est allume a l'ecran que quand il l'est vraiment : si la
  // permission a ete refusee, on montre qu'il est coupe plutot que de mentir.
  if (voix.refuse) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full
                      bg-black/50 border border-white/15">
        <MicOff className="w-3.5 h-3.5 text-white/40" />
        <span className="font-mono text-[10px] tracking-widest text-white/40">
          {N.t('pres_mic_off')}
        </span>
      </div>
    );
  }
  if (!voix.ouvert) return <span className="h-7" />;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full
                 bg-red-500/20 border border-red-400/50 backdrop-blur-sm"
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
  );
}

/* ------------------------------------------------------------- l'ecran */

export function PresentationDirect() {
  const { N } = SprinterApp;
  const enCours = usePresentationDirecte();

  const [index, setIndex] = useState(-1);
  const [dansMicro, setDansMicro] = useState(false);
  const [avant, setAvant] = useState(0);
  const [voix, setVoix] = useState<EtatVoix>({
    micro: false, refuse: false, ouvert: false, connecte: false,
  });
  const debut = useRef(0);
  const dernier = useRef(-2);
  const finiPose = useRef(false);

  // L'instant de depart se fige une seule fois : le recalculer a chaque rendu
  // ferait deriver la sequence, et les deux ecrans ne montreraient plus le
  // meme athlete au meme moment.
  useEffect(() => {
    if (!enCours) return;
    debut.current = Date.now() + enCours.presentation.dansMs;
    dernier.current = -2;
    finiPose.current = false;
    setIndex(-1);
  }, [enCours]);

  useEffect(() => {
    if (!enCours) return;
    const { par, micro, ordre } = enCours.presentation;
    const battre = () => {
      setVoix(enCours.etatVoix());
      const ecoule = Date.now() - debut.current;
      if (ecoule < 0) { setAvant(-ecoule); setIndex(-1); return; }
      const i = Math.floor(ecoule / par);
      if (i >= ordre.length) {
        setIndex(ordre.length);
        setDansMicro(false);
        SprinterApp.presenterCoureur(null);
        if (!finiPose.current) { finiPose.current = true; enCours.onFini(); }
        return;
      }
      setIndex(i);
      setDansMicro(ecoule - i * par < micro);
      if (i !== dernier.current) {
        dernier.current = i;
        const c = ordre[i];
        const estMoi = c?.id === enCours.moi;
        // On designe l'athlete au moteur : la camera vient sur lui, il leve
        // les bras, les autres reprennent leur place.
        SprinterApp.presenterCoureur(coureurDe(c?.id, estMoi));
        enCours.onTour(i, estMoi);
      }
    };
    battre();
    const t = setInterval(battre, 100);
    return () => { clearInterval(t); SprinterApp.presenterCoureur(null); };
  }, [enCours]);

  if (!enCours) return null;
  const { ordre } = enCours.presentation;
  const courant = index >= 0 && index < ordre.length ? ordre[index] : null;
  const estMoi = !!courant && courant.id === enCours.moi;

  return (
    <div className="fixed inset-0 z-40 pointer-events-none flex flex-col justify-between
                    pt-[max(env(safe-area-inset-top),1rem)]
                    pb-[max(env(safe-area-inset-bottom),1rem)]">
      {/* Deux voiles, en haut et en bas, plutot qu'un rideau : la piste doit
          rester visible, c'est elle qu'on est venu montrer. */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/80 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/85 to-transparent" />

      <p className="relative text-center text-[10px] tracking-[0.4em] text-emerald-400/90
                    font-bold uppercase">
        {N.t('pres_title')}
      </p>

      {/* Avant le premier athlete : un simple decompte, la piste derriere. */}
      {index < 0 && (
        <motion.div key="avant" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="relative self-center font-display font-black text-7xl
                               text-white/85 tabular-nums drop-shadow-lg">
          {Math.ceil(avant / 1000)}
        </motion.div>
      )}

      <div className="relative flex flex-col items-center gap-3 px-6">
        <AnimatePresence mode="wait">
          {courant && (
            <motion.div
              key={courant.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: [0.22, 0.8, 0.3, 1] }}
              className="flex flex-col items-center gap-2 w-full"
            >
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-xs tracking-widest text-white/55">
                  {N.t('pres_lane')} {courant.couloir}
                </span>
                {estMoi && (
                  <span className="font-mono text-[10px] tracking-widest text-emerald-400">
                    {N.t('pres_you')}
                  </span>
                )}
              </div>
              <h2 className="font-display font-black tracking-tight text-white text-center
                             leading-none text-4xl md:text-6xl break-words max-w-full
                             drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
                {courant.nom}
              </h2>
              <Micro voix={voix} estMoi={estMoi} dans={dansMicro} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Ou l'on en est dans la sequence. */}
        <div className="flex gap-1.5 mt-1">
          {ordre.map((o, i) => (
            <span key={o.id}
                  className={`h-1 rounded-full transition-all duration-300
                    ${i === index ? 'w-8 bg-emerald-400'
                      : i < index ? 'w-4 bg-white/40' : 'w-4 bg-white/15'}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Le coureur du moteur qui porte cet identifiant de salle.
 *
 * Le joueur local n'est pas dans la table des adversaires — il EST le coureur
 * du jeu. Les autres y sont, ranges par l'identifiant que la salle leur a
 * donne, ce qui est justement ce qui permet de les retrouver ici.
 */
function coureurDe(id: string | undefined, estMoi: boolean) {
  const G = SprinterApp.G;
  if (estMoi) return G.player || null;
  if (!id || !G.lives) return null;
  return G.lives.get(id)?.runner || null;
}
