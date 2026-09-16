import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { SprinterApp, useGameStore } from '@/game/engine';
import { SURGISSEMENT } from '@/lib/mouvement';
import { dernierFranchissement, haiesPosees } from '@/game/haies-course.js';

type Juge = {
  haie: number; note: 'parfait' | 'bon' | 'plane' | 'hache';
  tenu: boolean; appuis: number;
};

/** Combien de temps le verdict d'une haie reste a l'ecran, en secondes. */
const TENUE = 1.1;

const COULEUR: Record<Juge['note'], string> = {
  parfait: 'text-emerald-400',
  bon: 'text-primary',
  plane: 'text-amber-400',
  hache: 'text-destructive',
};

/**
 * LE VERDICT DE CHAQUE HAIE, LE TEMPS D'UNE FOULEE.
 *
 * Tout Hurdlers se joue la : arriver sur la haie au bon endroit, avec le bon
 * nombre d'appuis. Le moteur le juge a chaque haie (haies-pas.js), et sans ce
 * bandeau le joueur ne le saurait qu'au chrono d'arrivee, sans savoir quelle
 * haie lui a coute quoi.
 *
 * Un mot, gros, et dans quel SENS corriger : trop pres, trop loin. Le compte
 * d'appuis dessous, et « rythme casse » seulement quand il l'est — un compte
 * juste ne merite pas qu'on le lise.
 */
export function HaiesHUD() {
  const { N } = SprinterApp;
  const elapsed = useGameStore(s => s.elapsed);
  const [juge, setJuge] = useState<{ j: Juge; t: number } | null>(null);

  // Le jugement se lit une fois, puis s'efface cote moteur : on le garde ici le
  // temps de l'afficher.
  useEffect(() => {
    const j = dernierFranchissement() as Juge | null;
    if (j) setJuge({ j, t: elapsed });
    else if (juge && elapsed - juge.t > TENUE) setJuge(null);
    else if (juge && elapsed < juge.t) setJuge(null);   // une course neuve
  }, [elapsed]); // eslint-disable-line react-hooks/exhaustive-deps

  const posees = haiesPosees();
  if (!posees) return null;
  const total = posees.positions.length;

  return (
    <div className="absolute inset-x-0 top-[22%] flex flex-col items-center pointer-events-none">
      <AnimatePresence>
        {juge && (
          <motion.div key={juge.j.haie} {...SURGISSEMENT}
                      className="flex flex-col items-center gap-0.5
                                 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
            <span className="font-mono text-[9px] sm:text-[10px] tracking-widest text-white/70">
              {N.t('haie_n', { n: String(juge.j.haie), t: String(total) })}
            </span>
            <span className={`font-black font-display tracking-wider text-2xl sm:text-3xl
                              ${COULEUR[juge.j.note]}`}>
              {N.t('haie_' + juge.j.note)}
            </span>
            <span className={`font-mono font-bold text-[10px] sm:text-xs tracking-widest
                              ${juge.j.tenu ? 'text-white/80' : 'text-destructive'}`}>
              {N.t('haie_appuis', { n: String(juge.j.appuis) })}
              {!juge.j.tenu && <> · {N.t('haie_rythme')}</>}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
