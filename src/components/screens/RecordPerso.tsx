import React from 'react';
import { motion } from 'motion/react';
import { SprinterApp } from '@/game/engine';
import { Timer, Trophy } from 'lucide-react';
import { RESSORT, SURGISSEMENT } from '@/lib/mouvement';
import type { RaceKey } from '@/game/leaderboard';
import {
  useRecord, recordAvant, ecartAuRecord, estUnRecord, s2,
} from '@/game/record';

/**
 * Le record personnel, la ou le joueur le regarde.
 *
 * DEUX FORMES, ET PAS UNE DE PLUS. Une pastille qui le rappelle au repos —
 * accueil, profil, HUD — et une ligne d'arrivee qui dit ce que la course vient
 * d'en faire. Les deux vivent ici plutot que recopiees dans quatre ecrans :
 * elles montrent le MEME nombre, et un arrondi qui differe d'un ecran a
 * l'autre se remarque immediatement.
 *
 * CE N'EST PAS LE RECORD DU MONDE. `RecordPopup` annonce celui-la, et il
 * s'ouvre en plein ecran parce qu'il arrive une fois par an. Le record
 * personnel tombe dix fois la premiere semaine : il se dit a cote du chrono,
 * jamais par-dessus.
 */

/** La pastille de repos : « RECORD 8,50 s ». */
export function RecordChip({
  race, compact = false, avecEpreuve = false,
}: { race: RaceKey; compact?: boolean; avecEpreuve?: boolean }) {
  const { N } = SprinterApp;
  const record = useRecord(race);
  if (record.ms === null) return null;

  return (
    <div className={`self-start inline-flex items-center gap-1.5 rounded-full
                     border border-primary/40 bg-primary/10
                     ${compact ? 'px-2 py-0.5' : 'px-2.5 py-1'}`}>
      <Timer className={compact ? 'w-3 h-3 text-primary' : 'w-3.5 h-3.5 text-primary'} />
      <span className={`font-bold uppercase tracking-widest text-primary/80
                        ${compact ? 'text-[8px]' : 'text-[9px]'}`}>
        {/* Sur le profil, trois pastilles se suivent : sans la distance, elles
            annoncent trois records de rien. Sur l'accueil l'epreuve est deja
            choisie juste au-dessus, et la repeter serait du bruit. */}
        {avecEpreuve ? SprinterApp.RACES[race].label : N.t('pb_label')}
      </span>
      <span className={`font-mono font-black tabular-nums text-foreground
                        ${compact ? 'text-xs' : 'text-sm'}`}>
        {s2(record.ms)}<span className="text-primary/70"> s</span>
      </span>
      {/* La place ne s'affiche que si le serveur a repondu : annoncer un rang
          calcule sur le seul appareil serait un rang invente. */}
      {!compact && record.distant && record.rang !== null && (
        <span className="text-[9px] font-bold text-muted-foreground tracking-wide">
          {N.t('pb_rank', { o: N.ord(record.rang) })}
        </span>
      )}
    </div>
  );
}

/**
 * Ce que la course vient de faire au record.
 *
 * `ms` est le chrono de la course en millisecondes. La comparaison porte sur
 * le record d'AVANT — voir `recordAvant` : a l'instant ou cet ecran s'affiche,
 * le moteur a deja range la course, et comparer au record d'apres dirait
 * « egalite » exactement quand il faut dire « nouveau record ».
 */
export function EcartRecord({ race, ms }: { race: RaceKey; ms: number | null }) {
  const { N } = SprinterApp;
  const record = useRecord(race);
  if (ms === null || !Number.isFinite(ms) || ms <= 0) return null;

  const reference = recordAvant(race);
  const bat = estUnRecord(ms, reference);
  const ecart = ecartAuRecord(ms, reference);

  // Premiere course de l'epreuve : il n'y a rien a battre, et annoncer un
  // record contre personne sonnerait faux.
  if (reference === null) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-muted-foreground">
        <Timer className="w-3.5 h-3.5 text-primary/70" />
        <span className="uppercase tracking-wider">{N.t('pb_first')}</span>
      </div>
    );
  }

  if (bat) {
    return (
      <motion.div
        {...SURGISSEMENT}
        className="relative flex items-center gap-2 rounded-2xl border-2 border-primary/60
                   bg-primary/10 px-3 py-1.5 shadow-[0_0_28px_rgba(248,205,74,0.28)]"
      >
        {/* Le halo bat une fois, et s'arrete. Un clignotement perpetuel a cote
            d'un bouton REVANCHE finirait par se regarder au lieu de se lire. */}
        <motion.div
          aria-hidden
          className="absolute inset-0 rounded-2xl border-2 border-primary/50 pointer-events-none"
          initial={{ opacity: 0.8, scale: 1 }}
          animate={{ opacity: 0, scale: 1.12 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
        <motion.div
          initial={{ rotate: -18, scale: 0.5 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={RESSORT.trophee}
        >
          <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-primary drop-shadow-[0_0_10px_rgba(248,205,74,0.7)]" />
        </motion.div>
        <div className="flex flex-col leading-tight">
          <span className="font-black font-display uppercase tracking-tight text-primary
                           text-sm sm:text-base">
            {N.t('pb_new')}
          </span>
          <span className="text-[10px] sm:text-[11px] text-foreground/80 tabular-nums">
            {N.t('pb_gain', { n: (Math.abs(ecart ?? 0) / 1000).toFixed(2) })}
          </span>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-[11px] sm:text-xs">
      <Timer className="w-3.5 h-3.5 text-primary/70 shrink-0" />
      <span className="text-muted-foreground uppercase tracking-wider">
        {N.t('pb_mine')}
      </span>
      <span className="font-mono font-bold tabular-nums text-foreground">
        {s2(record.ms ?? reference)} s
      </span>
      <span className="text-muted-foreground tabular-nums">
        — {N.t('pb_short', { n: ((ecart ?? 0) / 1000).toFixed(2) })}
      </span>
    </div>
  );
}
