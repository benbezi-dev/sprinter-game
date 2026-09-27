import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { SprinterApp, useGameStore } from '@/game/engine';
import { SURGISSEMENT } from '@/lib/mouvement';
import { dernierFranchissement, dernierCiseau, haiesPosees, plafondHaies } from '@/game/haies-course.js';

type Juge = {
  haie: number; note: 'parfait' | 'bon' | 'plane' | 'hache' | 'percute';
  tenu: boolean; appuis: number;
  // `jambe` n'existe que sous l'appel du joueur : true bonne jambe, false
  // mauvaise, null sur une haie percutee — on ne l'a attaquee d'aucune.
  jambe?: boolean | null;
};

/** Combien de temps le verdict d'une haie reste a l'ecran, en secondes. */
const TENUE = 1.1;

/**
 * Le ciseau tient moins longtemps : il arrive a la reception, donc a peine
 * plus d'un tiers de seconde apres le verdict de l'appel, et il doit avoir
 * disparu avant la haie suivante.
 */
const TENUE_CISEAU = 0.8;

type Ciseau = { haie: number; note: 'ciseau' | 'bon' | 'accroche' | 'traine' | 'absent'; ms: number | null };

const COULEUR_CISEAU: Record<Ciseau['note'], string> = {
  ciseau: 'text-green-400',
  bon: 'text-primary',
  accroche: 'text-amber-400',
  traine: 'text-amber-400',
  absent: 'text-destructive',
};

/**
 * LE VERT EST UN VERT, ET PAS UN EMERAUDE. Il l'etait — #34D399 — et ca
 * marchait tant que la couleur de Hurdlers etait un bleu doux. Depuis qu'elle
 * est cyan (index.css), l'emeraude n'en est plus qu'a vingt-sept degres de
 * teinte : « PARFAIT » et « BIEN » se lisaient pareil d'un coup d'oeil, et un
 * verdict qui dure une seconde ne se lit que d'un coup d'oeil.
 */
const COULEUR: Record<Juge['note'], string> = {
  parfait: 'text-green-400',
  bon: 'text-primary',
  plane: 'text-amber-400',
  hache: 'text-destructive',
  percute: 'text-destructive',
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
/**
 * `tuto` : le nombre de haies de la SEQUENCE en cours, quand ce bandeau sert
 * le tutoriel plutot qu'une course.
 *
 * Il fait deux choses, et elles ont la meme cause — le tutoriel pose les haies
 * d'un vrai 110 m mais n'en fait franchir que deux.
 *
 * LE COMPTE. « haie 1 sur 10 » etait faux : le joueur en a deux a passer, pas
 * dix, et un compteur qui annonce huit haies de plus que ce qui vient
 * enseigne a s'inquieter plutot qu'a courir.
 *
 * LA HAUTEUR. Le tutoriel ecrit son titre et sa consigne en haut de l'ecran,
 * la ou ce bandeau vient : les verdicts tombaient par-dessus la phrase qu'on
 * demande de lire. On le descend sous elle — c'est le tutoriel qui cede la
 * place, pas la course, dont le haut d'ecran est libre.
 */
export function HaiesHUD({ tuto }: { tuto?: number } = {}) {
  const { N } = SprinterApp;
  const elapsed = useGameStore(s => s.elapsed);
  const [juge, setJuge] = useState<{ j: Juge; t: number } | null>(null);
  const [cis, setCis] = useState<{ c: Ciseau; t: number } | null>(null);
  // Le plafond de l'intervalle, lu a chaque image du store : il change en
  // continu pendant qu'on le rattrape, et il doit se voir remonter.
  const [plafond, setPlafond] = useState(1);

  // Le jugement se lit une fois, puis s'efface cote moteur : on le garde ici le
  // temps de l'afficher.
  useEffect(() => {
    const j = dernierFranchissement() as Juge | null;
    if (j) setJuge({ j, t: elapsed });
    else if (juge && elapsed - juge.t > TENUE) setJuge(null);
    else if (juge && elapsed < juge.t) setJuge(null);   // une course neuve
  }, [elapsed]); // eslint-disable-line react-hooks/exhaustive-deps

  // LE SECOND TEMPS DU GESTE. Il a son propre canal parce qu'il arrive a la
  // reception, vingt-deux images apres l'appel : le verdict de l'appel est lu
  // et efface depuis longtemps quand celui-ci tombe.
  useEffect(() => {
    const c = dernierCiseau() as Ciseau | null;
    if (c) setCis({ c, t: elapsed });
    else if (cis && elapsed - cis.t > TENUE_CISEAU) setCis(null);
    else if (cis && elapsed < cis.t) setCis(null);
  }, [elapsed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setPlafond(plafondHaies() as number); }, [elapsed]);

  const posees = haiesPosees();
  if (!posees) return null;
  const total = tuto ?? posees.positions.length;

  return (
    <div className={`absolute inset-x-0 ${tuto ? 'top-[36%]' : 'top-[22%]'}
                     flex flex-col items-center pointer-events-none`}>
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
              {juge.j.jambe === false && <> · {N.t('haie_jambe')}</>}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LE PLAFOND DE L'INTERVALLE, quand la reception l'a entame.
          Une barre qui se remplit, et un mot. Sans elle, le coureur parait
          lent sans raison : le joueur verrait l'effet et jamais la cause, ce
          qui est la definition d'un jeu qu'on subit. */}
      {plafond < 0.995 && (
        <motion.div {...SURGISSEMENT} className="mt-1.5 flex flex-col items-center gap-1">
          <span className="font-mono text-[9px] sm:text-[10px] tracking-[0.3em] text-amber-300/90">
            {N.t('haie_relance')}
          </span>
          <div className="w-20 sm:w-24 h-1 rounded-full bg-black/50 overflow-hidden">
            <div className="h-full bg-amber-300/80 transition-[width] duration-75"
                 style={{ width: `${Math.round(plafond * 100)}%` }} />
          </div>
        </motion.div>
      )}

      {/* Le ciseau, sous le verdict de l'appel et plus discret : c'est le meme
          franchissement qui continue, pas un second evenement. Les
          millisecondes sont la charge utile — « ton ciseau traine a partir de
          la sixieme » est une phrase d'entrainement. */}
      <AnimatePresence>
        {cis && (
          <motion.div key={'c' + cis.c.haie} {...SURGISSEMENT}
                      className="mt-1 flex flex-col items-center
                                 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
            <span className={`font-black font-display tracking-wider text-base sm:text-lg
                              ${COULEUR_CISEAU[cis.c.note]}`}>
              {N.t('haie_c_' + cis.c.note)}
            </span>
            {cis.c.ms !== null && (
              <span className="font-mono text-[10px] sm:text-xs tracking-widest text-white/70">
                {N.t('haie_c_ms', { n: String(cis.c.ms) })}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
