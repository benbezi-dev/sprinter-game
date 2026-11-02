import { motion, AnimatePresence } from 'motion/react';
import { SprinterApp } from '@/game/engine';
import type { RaceKey } from '@/game/leaderboard';
import { nomCourt, EPREUVES_EN_SALLE, EPREUVES_DEHORS } from '@/game/jeux';
import { sonChoix, sonSelection } from '@/game/ui-son';

/* LE CHOIX DES EPREUVES, PARTAGE PAR LA CARRIERE ET LE ONE SHOT (l'auteur, 02/11/2026).
   Un interrupteur PLEIN AIR / SALLE et une ligne de trois distances :
   100 / 200 / 400 dehors, 60 / 200 / 400 en salle. Basculer garde les memes cases :
   100 <-> 60, 200 <-> 200 salle, 400 <-> 400 salle. */

export type Lieu = 'dehors' | 'salle';

export const estEnSalle = (k: string) => (EPREUVES_EN_SALLE as readonly string[]).includes(k);

/** L'epreuve d'en face, de l'autre cote de l'interrupteur (100 -> 60, 200s -> 200...). */
export function equivalente(k: string, vers: Lieu): RaceKey {
  const de = (vers === 'salle' ? EPREUVES_DEHORS : EPREUVES_EN_SALLE) as readonly string[];
  const a = (vers === 'salle' ? EPREUVES_EN_SALLE : EPREUVES_DEHORS) as readonly string[];
  const i = de.indexOf(k);
  return (i < 0 ? k : a[i]) as RaceKey;
}

/** L'interrupteur PLEIN AIR / SALLE : une pastille qui glisse, et le « tchk » du choix. */
export function InterrupteurLieu({ lieu, onChange, id }: { lieu: Lieu; onChange: (l: Lieu) => void; id: string }) {
  const { N } = SprinterApp;
  return (
    <div className="relative flex rounded-full bg-black/40 border border-white/10 p-0.5">
      {(['dehors', 'salle'] as const).map(l => (
        <button
          key={l}
          onClick={() => { if (l !== lieu) { onChange(l); sonChoix(); } }}
          className={`relative px-2.5 py-1 text-[9px] md:text-[10px] font-bold tracking-widest rounded-full transition-colors
            ${lieu === l ? 'text-background' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {lieu === l && (
            <motion.span
              layoutId={`lieu-${id}`}
              className="absolute inset-0 rounded-full bg-primary shadow-[0_0_12px_rgb(var(--primaire-rgb)/0.45)]"
              transition={{ type: 'spring', stiffness: 520, damping: 34 }}
            />
          )}
          <span className="relative">{l === 'salle' ? N.t('os_salle') : N.t('os_plein_air')}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * La ligne des epreuves. En basculant, les distances partent par le haut et les nouvelles
 * arrivent par le bas, l'une apres l'autre : la ligne change de lieu sans qu'aucune case
 * ne bouge de place. Toucher une case joue le « pop » de la selection.
 */
export function LigneEpreuves({ epreuves, coche, onToggle, fond = 'bg-black/30', haute = false, unique = false }: {
  epreuves: readonly RaceKey[];
  coche: (k: RaceKey) => boolean;
  onToggle: (k: RaceKey) => void;
  fond?: string;
  haute?: boolean;
  /** une seule epreuve a la fois (la carriere) : retoucher la case cochee ne la decoche pas */
  unique?: boolean;
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${epreuves.length}, minmax(0, 1fr))` }}>
      {epreuves.map((k, i) => {
        const oui = coche(k);
        return (
          <motion.button
            key={i}
            onClick={() => { if (unique && oui) return; sonSelection(!oui); onToggle(k); }}
            whileTap={{ scale: 0.93 }}
            animate={{ scale: oui ? 1 : 0.98 }}
            transition={{ type: 'spring', stiffness: 600, damping: 28 }}
            className={`relative overflow-hidden ${haute ? 'h-10 md:h-14' : 'h-10 md:h-12'} rounded-xl font-bold tracking-wider border-b-2 text-sm md:text-base transition-colors
              ${oui
                ? 'bg-primary/20 text-primary border-primary shadow-[0_0_15px_rgb(var(--primaire-rgb)/0.2)]'
                : `${fond} text-muted-foreground border-transparent hover:bg-white/10`}`}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={k}
                initial={{ y: 18, opacity: 0, filter: 'blur(3px)' }}
                animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                exit={{ y: -18, opacity: 0, filter: 'blur(3px)' }}
                transition={{ type: 'spring', stiffness: 420, damping: 30, delay: i * 0.04 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                {/* l'interrupteur dit deja ou l'on court : la case ne garde que la distance */}
                {estEnSalle(k) ? `${k.replace('s', '')} M` : nomCourt(k)}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        );
      })}
    </div>
  );
}
