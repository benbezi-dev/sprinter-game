import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Swords, X } from 'lucide-react';
import { SprinterApp, useGameStore } from '@/game/engine';
import { TRANSITION } from '@/lib/mouvement';
import { mesDefis, type DefiRelais } from '@/game/relais';
import { entrerSurLaPiste, usePiste } from '@/game/piste';
import { getSavedName } from '@/game/leaderboard';
import { useSondageAuRepos, estAuCalme } from '@/hooks/use-sondage';
import { surCourrier } from '@/game/boite';

/**
 * Une equipe defie la mienne, en direct.
 *
 * Le panneau du relais liste deja les defis ouverts, mais il est replie sous
 * l'ecran des modes : sans ce bandeau, un defi recu n'existait que pour qui
 * pensait a l'ouvrir — et un relais en direct attend quatre personnes a la
 * meme minute. Meme forme que l'invitation a un duel en direct, et meme regle :
 * il ne parait qu'au repos, jamais au milieu d'une course.
 *
 * « Plus tard » ne fait que fermer le bandeau : le defi reste dans le panneau
 * du relais jusqu'a ce qu'il soit couru ou perime.
 */
export function DefiRelaisPopup() {
  const { N } = SprinterApp;
  useGameStore(s => s.state);
  const piste = usePiste();
  const [defis, setDefis] = useState<DefiRelais[]>([]);
  const [vus, setVus] = useState<Set<string>>(() => new Set());
  const annule = useRef(false);
  useEffect(() => { annule.current = false; return () => { annule.current = true; }; }, []);

  const interroger = useRef(() => {});
  interroger.current = () => {
    if (!getSavedName()) return;
    mesDefis().then(r => { if (!annule.current && r) setDefis(r.defis || []); });
  };
  useSondageAuRepos(() => interroger.current(), 20000);
  useEffect(() => surCourrier(quoi => {
    if (quoi === 'relais_defi') interroger.current();
  }), []);

  const cle = (d: DefiRelais) => d.conf + ':' + d.equipe;
  const d = defis.find(x => !x.lance_par_moi && !vus.has(cle(x)));
  if (piste || !d || !estAuCalme()) return null;

  const fermer = () => setVus(v => new Set(v).add(cle(d)));
  const entrer = () => {
    fermer();
    entrerSurLaPiste({ genre: 'confrontation', code: d.conf, equipe: d.equipe,
                       max: d.max, fantomes: [] });
  };

  return (
    <AnimatePresence>
      <motion.div
        key={cle(d)}
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -14 }}
        className="fixed z-[59] left-1/2 -translate-x-1/2 top-3 md:top-4 w-[min(92vw,26rem)]
                   rounded-2xl border border-primary/40 bg-[#0B0F19]/95 backdrop-blur
                   shadow-[0_2px_32px_rgba(0,0,0,0.45)] px-4 py-3 flex items-center gap-3"
      >
        <motion.span
          animate={{ opacity: [1, 0.4, 1] }}
          transition={TRANSITION.battement}
          className="shrink-0 w-8 h-8 rounded-full bg-primary/15 border border-primary/40
                     flex items-center justify-center text-primary"
        >
          <Swords className="w-4 h-4" />
        </motion.span>
        <div className="min-w-0 flex-1">
          {/* Le nom de l'equipe qui defie seul sur la premiere ligne : sur un
              telephone, la phrase entiere y etait coupee avant le mot utile. */}
          <p className="text-xs md:text-sm font-bold text-foreground truncate">
            {d.role === 'lanceur' ? d.lance_par : d.de}
          </p>
          <p className="text-[10px] md:text-xs text-muted-foreground truncate">
            {N.t(d.role === 'lanceur' ? 'defi_popup_lanceur' : 'defi_popup',
                 { moi: d.equipe_nom, n: String(d.max) })}
          </p>
        </div>
        <button onClick={entrer}
          className="shrink-0 px-3 py-1.5 rounded-xl font-black font-display tracking-widest
                     text-[10px] md:text-xs text-background bg-primary hover:bg-primary/90">
          {N.t('defi_entrer')}
        </button>
        <button onClick={fermer} aria-label={N.t('live_invit_non')} title={N.t('live_invit_non')}
          className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center
                     text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
