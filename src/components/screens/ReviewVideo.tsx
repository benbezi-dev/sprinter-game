import React from 'react';
import { motion } from 'motion/react';
import { Download, Loader2, Film, Timer } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import { compteARebours, TTL_MS, type EtatReview } from '@/game/review';

/**
 * La video de la course, et son compte a rebours.
 *
 * Le decompte n'est pas decoratif : le fichier vit dans la memoire de l'onglet
 * et disparait au bout de dix minutes, telecharge ou non. L'afficher est la
 * seule facon honnete de presenter un bouton qui va s'eteindre — et accessoire-
 * ment ce qui donne envie d'appuyer maintenant.
 */
export function ReviewVideo({ etat, onTelecharger }: {
  etat: EtatReview;
  onTelecharger: () => void;
}) {
  const { N } = SprinterApp;
  if (etat.phase === 'inactif') return null;

  const mo = etat.taille ? (etat.taille / 1_048_576).toFixed(1) + ' Mo' : '';
  const part = etat.phase === 'prete' ? Math.max(0, etat.reste / TTL_MS) : 0;
  // Le rouge n'arrive que dans la derniere minute : avant, il crierait au loup.
  const urgent = etat.phase === 'prete' && etat.reste < 60_000;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card/70 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col gap-3"
    >
      <div className="flex items-center gap-2 justify-center">
        <Film className="w-4 h-4 text-emerald-400" />
        <h3 className="text-[10px] md:text-xs font-bold tracking-widest text-emerald-400">
          {N.t('review_title')}
        </h3>
      </div>

      {etat.phase === 'enregistre' && (
        <p className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {N.t('review_making')}
        </p>
      )}

      {etat.phase === 'impossible' && (
        <p className="text-center text-[11px] text-muted-foreground">{N.t('review_none')}</p>
      )}

      {etat.phase === 'prete' && (
        <>
          <button
            onClick={onTelecharger}
            className="w-full py-3 rounded-xl font-black font-display tracking-widest text-background
                       bg-emerald-400 hover:bg-emerald-400/90 transition-colors
                       flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            {N.t('review_dl')}{mo ? ` · ${mo}` : ''}
          </button>

          {/* La barre se vide en meme temps que le temps restant. */}
          <div className="h-1 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ease-linear
                ${urgent ? 'bg-red-400' : 'bg-emerald-400/70'}`}
              style={{ width: `${part * 100}%` }}
            />
          </div>
          <p className={`flex items-center justify-center gap-1.5 text-[11px] tabular-nums
                        ${urgent ? 'text-red-300' : 'text-muted-foreground'}`}>
            <Timer className="w-3.5 h-3.5" />
            {N.t('review_left', { t: compteARebours(etat.reste) })}
          </p>
        </>
      )}

      {etat.phase === 'expiree' && (
        <>
          <button
            disabled
            className="w-full py-3 rounded-xl font-black font-display tracking-widest
                       bg-white/5 text-white/25 border border-white/10
                       flex items-center justify-center gap-2 cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {N.t('review_dl')}
          </button>
          <p className="text-center text-[11px] text-muted-foreground">{N.t('review_gone')}</p>
          <p className="text-center text-[10px] text-muted-foreground/70">{N.t('review_kept')}</p>
        </>
      )}
    </motion.div>
  );
}
